// Привязка бланков к кредитной программе (вкладка «7. Документы»):
// 1) по всем программам — сколько шаблонов договоров и печатных форм привязано;
// 2) в режиме «Изменить» — какие кнопки над сетками и что предлагает выбор шаблона/формы.
// Ничего не сохраняет: выход «Отмена»/«Закрыть».
//   node scripts/inspect/blanks-program-binding.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { open, go, gridAll } from './app-lib.mjs';

const OUT = '.auth/blanks';
mkdirSync(OUT, { recursive: true });
const { ctx, page } = await open();
await page.setViewportSize({ width: 1920, height: 1080 });

// id программ из списка (табличный вид)
await go(page, 'loan-programs');
const tableBtn = page.getByRole('button', { name: 'Таблица', exact: true });
if (await tableBtn.count()) { await tableBtn.click(); await page.waitForTimeout(1500); }
const rows = await gridAll(page);
console.log('PROGRAMS:', rows.length);

// карточки ведут на /loan-programs/{id}; переберём id подряд, пока отвечают
const result = [];
const sectionGrids = () => page.evaluate(() => {
  const vis = e => e.getBoundingClientRect().width > 0;
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,span,div')].filter(e => vis(e) && /^(Шаблоны договоров|Печатные формы)$/.test(e.innerText?.trim()) && e.children.length === 0);
  return heads.map(h => {
    let n = h, g = null;
    for (let i = 0; i < 6 && !g; i++) { n = n.parentElement; g = n?.querySelector('vaadin-grid'); }
    const names = g ? [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => c.innerText.trim()).filter(t => t && t !== 'Наименование') : null;
    return { section: h.innerText.trim(), size: g?.size ?? null, names };
  });
});
for (let id = 1; id <= (process.env.SKIP_SURVEY ? 0 : 40); id++) {
  await page.goto(`https://fkftest.okmot.kg/loan-programs/${id}?mode=readonly`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1200);
  if (!/loan-programs\/\d+/.test(page.url())) continue;
  const name = await page.evaluate(() => document.querySelector('vaadin-text-field')?.value || '');
  const tab = page.locator('vaadin-tab:visible', { hasText: 'Документы' });
  if (!(await tab.count())) continue;
  await tab.first().click(); await page.waitForTimeout(1000);
  const g = await sectionGrids();
  result.push({ id, name, g });
  console.log(id, name.slice(0, 50), JSON.stringify(g));
}

// режим «Изменить» на первой найденной программе
const pid = result[0]?.id || Number(process.env.PID || 1);
// закрыть «Имеются несохраненные изменения», если всплыл
const dismiss = async () => {
  const b = page.locator('vaadin-dialog-overlay vaadin-button', { hasText: /Не сохранять|Отменить|Закрыть без|Нет/ });
  if (await b.count()) { console.log('dismiss:', await b.first().innerText()); await b.first().click().catch(() => {}); await page.waitForTimeout(1000); }
};
if (pid) {
  await go(page, 'loan-programs');
  await page.goto(`https://fkftest.okmot.kg/loan-programs/${pid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); await dismiss();
  console.log('dialogs on open:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('vaadin-dialog-overlay')].map(d => d.innerText.slice(0, 300)))));
  const edit = page.getByRole('button', { name: 'Изменить', exact: true });
  if (await edit.count() && await edit.first().isEnabled()) { await edit.first().click(); await page.waitForTimeout(2000); await dismiss(); }
  await page.locator('vaadin-tab:visible', { hasText: 'Документы' }).first().click();
  await page.waitForTimeout(1500);
  const btns = await page.evaluate(() => [...document.querySelectorAll('vaadin-button')].filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText.trim() || b.title || b.getAttribute('aria-label') || b.querySelector('vaadin-icon')?.getAttribute('icon') || '?') + (b.disabled ? ' [off]' : '')));
  console.log('\nEDIT URL:', page.url(), '\nEDIT BUTTONS:', JSON.stringify(btns));
  await page.screenshot({ path: `${OUT}/program-edit-docs.png`, fullPage: true });
  // кнопки «Добавить» под заголовками «Шаблоны договоров» и «Печатные формы»
  for (const section of ['Шаблоны договоров', 'Печатные формы']) {
    const add = await page.evaluateHandle((section) => {
      const vis = e => e.getBoundingClientRect().width > 0;
      const h = [...document.querySelectorAll('*')].find(e => vis(e) && e.children.length === 0 && e.innerText?.trim() === section);
      let n = h;
      for (let i = 0; i < 6; i++) {
        n = n?.parentElement;
        const b = n && [...n.querySelectorAll('vaadin-button')].find(x => vis(x) && !x.disabled);
        if (b) return b;
      }
      return null;
    }, section);
    const el = add.asElement();
    if (!el) { console.log(`[${section}] кнопки добавления нет`); continue; }
    console.log(`[${section}] кнопка:`, await el.evaluate(b => b.innerText.trim() || b.title || b.querySelector('vaadin-icon')?.getAttribute('icon')));
    await el.click(); await page.waitForTimeout(2500);
    const dlg = await page.evaluate(() => [...document.querySelectorAll('vaadin-dialog-overlay')].map(d => d.innerText.trim().slice(0, 2000)));
    const items = await page.evaluate(() => [...document.querySelectorAll('vaadin-combo-box-item, vaadin-multi-select-combo-box-item')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim()));
    console.log(`[${section}] диалог:`, JSON.stringify(dlg), 'items:', JSON.stringify(items), 'url:', page.url());
    await page.screenshot({ path: `${OUT}/program-edit-${section === 'Печатные формы' ? 'print' : 'tpl'}-pick.png`, fullPage: true });
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const cancel = page.locator('vaadin-dialog-overlay vaadin-button', { hasText: /Отмена|Закрыть/ });
    if (await cancel.count()) { await cancel.first().click().catch(() => {}); await page.waitForTimeout(600); }
    if (!page.url().includes(`loan-programs/${pid}`)) { await page.goBack(); await page.waitForTimeout(1500); }
  }
}
writeFileSync(`${OUT}/blanks-program-binding.json`, JSON.stringify(result, null, 1));
await ctx.close();
