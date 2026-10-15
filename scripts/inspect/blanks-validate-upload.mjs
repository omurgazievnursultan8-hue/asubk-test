// «Проверить шаблон» на загруженном, но не сохранённом docx: неизвестный код ${…},
// подстановка в чужом синтаксисе {{…}}, подстановка, разрезанная Word на два run.
// Новый шаблон, тип CREDIT, «Загрузить» → «Проверить шаблон» → «Отмена» (не сохраняется).
//   node scripts/inspect/blanks-validate-upload.mjs <file.docx> [...]
import { open, go } from './app-lib.mjs';

const files = process.argv.slice(2);
const { ctx, page } = await open();
await page.setViewportSize({ width: 1920, height: 1080 });

for (const f of files) {
  await go(page, 'agreement-templates');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.waitForTimeout(2000);
  await page.locator('vaadin-text-field:visible input').first().fill('QA проверка ' + f.split('/').pop());
  const cb = page.locator('vaadin-combo-box:visible').first();
  await cb.click(); await page.waitForTimeout(600);
  await page.locator('vaadin-combo-box-item', { hasText: 'CREDIT' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('jmix-upload-button input[type=file]').first().setInputFiles(f);
  await page.waitForTimeout(2500);
  const shown = await page.evaluate(() => document.querySelector('jmix-upload-button')?.closest('div')?.innerText);
  await page.getByRole('button', { name: 'Проверить шаблон' }).click();
  await page.waitForTimeout(2500);
  const vals = await page.evaluate(() => [...document.querySelectorAll('vaadin-text-area, vaadin-text-field')]
    .filter(x => !/Доступные/.test(x.label || '')).map(x => `${x.label}=${(x.value || '').slice(0, 300)}`));
  const notes = await page.evaluate(() => [...document.querySelectorAll('vaadin-notification-card')].map(n => n.innerText.trim()));
  console.log(`\n== ${f.split('/').pop()}\nfile area after upload: ${JSON.stringify(shown)}\n${vals.join('\n')}\nnotes: ${JSON.stringify(notes)}`);
  await page.screenshot({ path: `.auth/blanks/validate-upload-${f.split('/').pop()}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Отмена', exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(1000);
  const dlg = await page.evaluate(() => [...document.querySelectorAll('vaadin-dialog-overlay')].map(d => d.innerText.trim()));
  if (dlg.length) console.log('dialog on cancel:', JSON.stringify(dlg));
  const discard = page.locator('vaadin-dialog-overlay vaadin-button', { hasText: /Не сохранять|Отменить|Закрыть без|Да/ });
  if (await discard.count()) { console.log('discard:', await discard.first().innerText()); await discard.first().click().catch(() => {}); }
  await page.waitForTimeout(800);
}
await go(page, 'agreement-templates');
console.log('\nrows after:', await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.innerText.trim()).filter(Boolean).join(' | ')));
await ctx.close();
