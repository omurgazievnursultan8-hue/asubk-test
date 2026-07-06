// How does the live borrower list open a detail? Test single-click, double-click, Изменить.
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
const firstRowCell = async () => {
  return page.evaluateHandle(() => {
    const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
    return cells.find(c => /^\d{10,}$/.test(c.textContent.trim()));
  });
};
const btnState = () => page.evaluate(() => [...document.querySelectorAll('vaadin-button')]
  .map(b => b.textContent.trim() + (b.hasAttribute('disabled') ? '(off)' : '(on)')).filter(Boolean));

// --- single click ---
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
let h = await firstRowCell(); await h.asElement()?.click(); await page.waitForTimeout(1000);
console.log('after single-click URL:', page.url());
console.log('  toolbar:', (await btnState()).join(' '));

// --- double click ---
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
h = await firstRowCell();
await h.asElement()?.dispatchEvent('dblclick');
await page.waitForTimeout(2500);
console.log('after double-click URL:', page.url());

// --- select + Изменить ---
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
h = await firstRowCell(); await h.asElement()?.click(); await page.waitForTimeout(800);
const editBtn = await page.evaluateHandle(() => [...document.querySelectorAll('vaadin-button')]
  .find(b => /Изменить/.test(b.textContent) && !b.hasAttribute('disabled')));
if (editBtn && await editBtn.evaluate(e => !!e)) { await editBtn.asElement()?.click(); await page.waitForTimeout(2500); }
console.log('after Изменить URL:', page.url());
await ctx.close();
