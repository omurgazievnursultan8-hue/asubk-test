import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const MARK = 'ZZZ ТЕСТ фильтр статуса picker';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}

// ---------- CREATE a gov-decision (defaults to "На стадии рассмотрения") ----------
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const setVal = async (id, v) => { const el = page.locator('#' + id + ' >> input'); await el.fill(v).catch(async()=>{ await page.locator('#'+id).click(); await page.keyboard.type(v); }); };
await setVal('nameField', MARK);
await setVal('shortNameField', 'ZZZ-TEST');
await setVal('numberField', 'ZZZ-001');
await setVal('codeField', 'ZZZTEST');

// pick Вид решения (creditOrderTypeField): open lookup, click row "Основное", click "Выбрать"
await page.locator('#creditOrderTypeField #entityLookupAction').click({ timeout: 5000 }).catch(e=>log('vid lookup click err', String(e).slice(0,60)));
await page.waitForTimeout(2000);
await page.locator('vaadin-grid-cell-content').filter({ hasText: /^Основное$/ }).first().click({ timeout: 5000 }).catch(e=>log('row click err', String(e).slice(0,60)));
await page.waitForTimeout(500);
await page.locator('vaadin-button').filter({ hasText: 'Выбрать' }).first().click({ timeout: 5000 }).catch(e=>log('vybrat err', String(e).slice(0,60)));
await page.waitForTimeout(1500);
log('Вид решения value after pick:', await page.locator('#creditOrderTypeField input').inputValue().catch(()=>'(n/a)'));

// Save via OK (exact match, footer button)
await page.getByRole('button', { name: 'OK', exact: true }).first().click({ timeout: 5000 }).catch(e=>log('OK err', String(e).slice(0,60)));
await page.waitForTimeout(3000);
const toast = await page.evaluate(()=>[...document.querySelectorAll('vaadin-notification-card,[part=overlay]')].map(n=>n.textContent.trim()).filter(Boolean).slice(0,3));
log('AFTER SAVE url:', page.url(), 'toast:', JSON.stringify(toast));

// ---------- verify in list: the new decision + its status ----------
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const listCells = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean));
const idx = listCells.findIndex(c => c.includes('ZZZ ТЕСТ'));
log('LIST: test row found at idx', idx, '→ context:', JSON.stringify(listCells.slice(idx>2?idx-1:0, idx+6)));
log('LIST statuses present:', JSON.stringify([...new Set(listCells.filter(r=>/рассмотр|одобр|закры|действ|отклон|чернов|доработ/i.test(r)))]));

// ---------- THE TEST: does the loan-program picker show the under-review decision? ----------
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('#govDecisionField #entityLookupAction').click({ timeout: 5000 });
await page.waitForTimeout(2500);
const dlg = await page.evaluate(() => {
  const ov = [...document.querySelectorAll('vaadin-dialog-overlay')].pop();
  if (!ov) return null;
  const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean);
  return { cells, count: cells.length };
});
const shows = (dlg?.cells||[]).some(c => c.includes('ZZZ ТЕСТ'));
log('\n=== RESULT ===');
log('Picker statuses shown:', JSON.stringify([...new Set((dlg?.cells||[]).filter(r=>/рассмотр|одобр|закры|действ|отклон|чернов|доработ/i.test(r)))]));
log('Under-review test decision VISIBLE in loan-program picker?', shows ? 'YES — picker NOT filtered by status' : 'NO — picker filters out non-approved');
log('Picker cells:', JSON.stringify(dlg?.cells?.slice(0, 120)));
await page.screenshot({ path: '.auth/picker-after-test.png', fullPage: true });
await ctx.close();
