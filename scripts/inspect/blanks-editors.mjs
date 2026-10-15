// Редакторы бланков на новом стенде: шаблон договора (каждая строка через «Изменить»)
// и печатная форма / шаблон договора через «Создать» — без сохранения, выход «Отмена».
// Снимает поля, вкладки, кнопки, текст формы, варианты выпадающих списков, скриншоты.
//   node scripts/inspect/blanks-editors.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { open, go, gridAll, rowSlots } from './app-lib.mjs';

const OUT = '.auth/blanks';
mkdirSync(OUT, { recursive: true });
const { ctx, page } = await open();
await page.setViewportSize({ width: 1920, height: 1080 });

const snap = () => page.evaluate(() => {
  const d = document.querySelector('[slot=drawer]');
  const notDrawer = e => !d || !d.contains(e);
  let text = document.body.innerText; if (d) text = text.replace(d.innerText, '');
  const fields = [...document.querySelectorAll(
    'vaadin-text-field, vaadin-text-area, vaadin-combo-box, vaadin-select, vaadin-checkbox, vaadin-date-picker, vaadin-date-time-picker, vaadin-integer-field, vaadin-number-field, vaadin-big-decimal-field, vaadin-upload, jmix-file-upload-field, jmix-file-storage-upload-field, jmix-value-picker, jmix-entity-picker, vaadin-multi-select-combo-box, jmix-code-editor, vaadin-rich-text-editor, jmix-upload-button')]
    .filter(notDrawer)
    .map(f => `${f.localName} | ${f.label || f.getAttribute('label') || ''} | value=${JSON.stringify(f.value ?? '').slice(0, 160)}${f.required ? ' | required' : ''}${f.readonly ? ' | readonly' : ''}${f.disabled ? ' | disabled' : ''}`);
  const tabs = [...document.querySelectorAll('vaadin-tab')].filter(notDrawer).map(t => t.innerText.trim());
  const buttons = [...document.querySelectorAll('vaadin-button')].filter(notDrawer)
    .map(b => ((b.innerText || '').trim() || b.getAttribute('title') || '?') + (b.hasAttribute('disabled') ? ' [disabled]' : ''));
  return { url: location.href, text, fields, tabs, buttons };
});
const options = async () => {
  const out = {};
  const boxes = page.locator('vaadin-combo-box:visible, vaadin-select:visible');
  for (let i = 0; i < await boxes.count(); i++) {
    const b = boxes.nth(i);
    const label = await b.evaluate(e => e.label || e.getAttribute('label') || `#${Math.random()}`);
    await b.click().catch(() => {}); await page.waitForTimeout(800);
    out[label] = await page.evaluate(() => [...document.querySelectorAll('vaadin-combo-box-item, vaadin-select-item')]
      .filter(o => o.getBoundingClientRect().width > 0).map(o => o.innerText.trim()).filter(Boolean));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }
  return out;
};
const cancel = async () => {
  const b = page.getByRole('button', { name: /^(Отмена|Закрыть)$/ });
  if (await b.count()) await b.last().click().catch(() => {});
  await page.waitForTimeout(800);
  const discard = page.getByRole('button', { name: /Не сохранять|Отменить изменения|Да/ });
  if (await discard.count()) await discard.first().click().catch(() => {});
  await page.waitForTimeout(500);
};
const openRow = async (name) => {
  const slots = await rowSlots(page, name);
  const cell = page.locator(`vaadin-grid[data-qa=cur] > [slot="${slots[1] || slots[0]}"]`);
  await cell.click(); await page.waitForTimeout(700);
  const edit = page.getByRole('button', { name: 'Изменить', exact: true });
  if (!(await edit.isEnabled())) { await cell.click(); await page.waitForTimeout(700); }
  if (!(await edit.isEnabled())) { await cell.dblclick(); await page.waitForTimeout(2500); return; }
  await edit.click(); await page.waitForTimeout(2500);
};

const report = {};

// 1. Шаблоны договоров — каждая строка
await go(page, 'agreement-templates');
const rows = await gridAll(page);
report.templatesRows = rows;
console.log('TEMPLATE ROWS:', JSON.stringify(rows));
for (let i = 0; i < rows.length; i++) {
  const name = rows[i].find(Boolean);
  await go(page, 'agreement-templates');
  await openRow(name);
  const s = await snap();
  report[`template${i}`] = s;
  console.log(`\n===== template ${i}: ${name} =====\n`, JSON.stringify(s, null, 1).slice(0, 6000));
  await page.screenshot({ path: `${OUT}/agreement-template-${i}.png`, fullPage: true });
  for (let t = 1; t < s.tabs.length; t++) {
    await page.locator('vaadin-tab:visible').nth(t).click(); await page.waitForTimeout(1200);
    const st = await snap();
    console.log(`--- tab ${s.tabs[t]} ---\n`, JSON.stringify({ fields: st.fields, text: st.text.slice(0, 3000) }, null, 1));
    report[`template${i}_tab${t}`] = st;
    await page.screenshot({ path: `${OUT}/agreement-template-${i}-tab${t}.png`, fullPage: true });
  }
  await cancel();
}

// 2. Шаблон договора — «Создать»
await go(page, 'agreement-templates');
await page.getByRole('button', { name: 'Создать', exact: true }).click();
await page.waitForTimeout(2500);
report.templateNew = await snap();
report.templateNewOptions = await options();
console.log('\n===== template new =====\n', JSON.stringify(report.templateNew, null, 1).slice(0, 5000));
console.log('OPTIONS:', JSON.stringify(report.templateNewOptions, null, 1));
await page.screenshot({ path: `${OUT}/agreement-template-new.png`, fullPage: true });
await cancel();

// 3. Печатные формы — «Создать»
await go(page, 'print-forms');
report.printFormsRows = await gridAll(page);
console.log('\nPRINT FORM ROWS:', JSON.stringify(report.printFormsRows));
await page.getByRole('button', { name: 'Создать', exact: true }).click();
await page.waitForTimeout(2500);
report.printFormNew = await snap();
report.printFormNewOptions = await options();
console.log('\n===== print-form new =====\n', JSON.stringify(report.printFormNew, null, 1).slice(0, 5000));
console.log('OPTIONS:', JSON.stringify(report.printFormNewOptions, null, 1));
await page.screenshot({ path: `${OUT}/print-form-new.png`, fullPage: true });
await cancel();

// 4. Коды шаблонов — полный список
await go(page, 'agreement-template-codes');
report.codes = await gridAll(page);
console.log('\nCODES:', report.codes.length, JSON.stringify(report.codes));

writeFileSync(`${OUT}/blanks-editors.json`, JSON.stringify(report, null, 1));
await ctx.close();
