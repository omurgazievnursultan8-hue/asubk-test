// Кредитная программа → «Изменить» → «7. Документы»: что предлагает «Добавить»
// под «Шаблоны договоров» и под «Печатные формы». Ничего не сохраняет.
//   PID=15 node scripts/inspect/blanks-program-pick.mjs
import { mkdirSync } from 'node:fs';
import { open, go } from './app-lib.mjs';

const OUT = '.auth/blanks';
mkdirSync(OUT, { recursive: true });
const PID = process.env.PID || 15;
const { ctx, page } = await open();
await page.setViewportSize({ width: 1920, height: 1080 });

await go(page, 'loan-programs');
await page.goto(`https://fkftest.okmot.kg/loan-programs/${PID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const edit = page.getByRole('button', { name: 'Изменить', exact: true });
if (await edit.count() && await edit.first().isEnabled()) { await edit.first().click(); await page.waitForTimeout(2000); }
await page.locator('vaadin-tab:visible', { hasText: 'Документы' }).first().click();
await page.waitForTimeout(2000);

const dialogs = () => page.evaluate(() => [...document.querySelectorAll('vaadin-dialog-overlay')].map(d => d.innerText.trim().slice(0, 3000)));
const adds = page.locator('vaadin-button:visible', { hasText: 'Добавить' });
const n = await adds.count();
console.log('Добавить:', n);
// последние две кнопки «Добавить» на вкладке — «Шаблоны договоров» и «Печатные формы»
for (const [idx, name] of [[n - 2, 'Шаблоны договоров'], [n - 1, 'Печатные формы']]) {
  await adds.nth(idx).scrollIntoViewIfNeeded();
  await adds.nth(idx).click(); await page.waitForTimeout(2500);
  console.log(`\n[${name}] url:`, page.url());
  console.log(`[${name}] dialogs:`, JSON.stringify(await dialogs(), null, 1));
  await page.screenshot({ path: `${OUT}/program-pick-${name === 'Печатные формы' ? 'print' : 'tpl'}.png`, fullPage: true });
  const cancel = page.locator('vaadin-dialog-overlay vaadin-button', { hasText: /Отмена|Закрыть/ });
  if (await cancel.count()) await cancel.last().click().catch(() => {});
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}
const cancelForm = page.getByRole('button', { name: 'Отмена', exact: true });
if (await cancelForm.count()) await cancelForm.last().click().catch(() => {});
await ctx.close();
