// Verify the to-be borrower mockup renders + interacts. Opens the local file,
// walks all 5 card tabs, screenshots each into .auth/, and exercises the new JS.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const FILE = 'file://' + process.cwd() + '/mockups/borrower/borrower.html';
const OUT = '.auth';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });

await page.goto(FILE, { waitUntil: 'load' });

// open card: double-click first borrower row (ОАО О!Банк)
await page.dblclick('#rows tr:first-child');
await page.waitForTimeout(200);
console.log('title after open:', await page.textContent('#pageTitle'));

// screenshot each tab
const tabs = ['main', 'credits', 'docs', 'history', 'contacts'];
for (const t of tabs) {
  await page.click(`#tabs .tab[data-tab="${t}"]`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/borrower-tab-${t}.png`, fullPage: true });
}

// checks
const idField = await page.locator('.form-grid label', { hasText: 'ID в системе' }).count();
console.log('«ID в системе» на форме (ожидаем 0):', idField);

await page.click('#tabs .tab[data-tab="docs"]');
const identCount = await page.textContent('.doc-acc[data-sec="ident"] .doc-acc-count');
console.log('Документы Юр · счётчик секции «Идентификация»:', identCount.trim());
// switch to физ
await page.selectOption('#docBtype', 'fiz');
await page.waitForTimeout(150);
const identCountFiz = await page.textContent('.doc-acc[data-sec="ident"] .doc-acc-count');
const urRowVisible = await page.locator('.doc-row[data-ft="ur"]:visible').count();
console.log('После переключения на Физ · счётчик:', identCountFiz.trim(), '· видимых Юр-строк (ожидаем 0):', urRowVisible);
await page.screenshot({ path: `${OUT}/borrower-tab-docs-fiz.png`, fullPage: true });

// contacts row selection
await page.selectOption('#docBtype', 'ur');
await page.click('#tabs .tab[data-tab="contacts"]');
await page.click('#contactRows tr:first-child');
const ctEditDisabled = await page.locator('#ctEdit').isDisabled();
console.log('«Изменить» после выбора контакта disabled (ожидаем false):', ctEditDisabled);

// credits -> Просмотр -> loan view
await page.click('#tabs .tab[data-tab="credits"]');
await page.click('#creditRows tr:first-child');
const btnViewDisabled = await page.locator('#btnCreditView').isDisabled();
console.log('«Просмотр» после выбора кредита disabled (ожидаем false):', btnViewDisabled);
await page.click('#btnCreditView');
await page.waitForTimeout(150);
console.log('title после «Просмотр» (ожидаем «Оформление кредита»):', await page.textContent('#pageTitle'));

console.log('\nJS-ошибки:', errs.length ? errs : 'нет');
await browser.close();
