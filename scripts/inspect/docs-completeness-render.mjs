// Рендер вкладки «Документы» заявки в разных ролях/статусах — проверка статусов
// комплектации и кнопок (спек 2026-07-09). Ищет JS-ошибки, снимает скриншоты.
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
const shot = n => page.screenshot({ path:'.auth/docs-' + n + '.png', fullPage:true });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

// Хелпер: открыть заявку по № на вкладке «Документы» под ролью, опц. режим правки
async function open(num, role, edit){
  await page.evaluate(([num, role, edit]) => {
    setRole(role);
    gotoDetail(num, 'tab-2');
    if (edit) enterEdit();
    showTab('tab-2');
  }, [num, role, edit]);
  await page.waitForTimeout(300);
}

// 1. Спец, черновик, режим просмотра (ТУР → залог; статус «Требуется доп. информация» = draft)
await open('З-2026-000080', 'spec', false);
await shot('spec-draft-view');
// 2. Спец, черновик, режим «Изменить» — полный ярус A + панель B
await open('З-2026-000080', 'spec', true);
await shot('spec-draft-edit');
// 3. Комиссия, заявка на рассмотрении (АгроИнвест → залог) — вид «На проверке» + Принять/Отклонить
await open('З-2026-000103', 'com', false);
await shot('com-review');

// Дамп статус-чипов и кнопок из активной вкладки
const dump = await page.evaluate(() => {
  const tab = document.getElementById('tab-2');
  const chips = [...tab.querySelectorAll('.compl')].map(c => c.textContent.trim());
  const pkg = [...tab.querySelectorAll('.pkg-actions .btn')].map(b => b.textContent.trim() + (b.disabled ? ' [disabled]' : ''));
  const rowBtns = [...tab.querySelectorAll('.doc-actions .btn')].map(b => b.textContent.trim());
  const uniq = a => [...new Set(a)];
  return { chips: uniq(chips), pkg, rowBtns: uniq(rowBtns) };
});
console.log('CHIPS (com-review tab):', dump.chips);
console.log('ROW BTNS (com-review):', dump.rowBtns);

console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO JS ERRORS');
await ctx.close();
