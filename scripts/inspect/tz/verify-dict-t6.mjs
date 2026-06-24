// scripts/inspect/tz/verify-dict-t6.mjs
// Task 6 verification: row select, view modal, create modal, dblclick, delete.
// Screenshot of open modal → .auth/dict-mockup-t6.png
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dir, '../../../mockups/dictionaries/dictionaries.html');

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto(HTML, { waitUntil: 'load' });

// Scroll loan-types section into view inside the scrollable dict-list
await page.evaluate(() => {
  const sec = document.getElementById('sec-loan-types');
  sec.scrollIntoView({ block: 'center' });
  const list = document.getElementById('dict-list');
  list.scrollTop = sec.offsetTop - 60;
});
await page.waitForTimeout(500);

// 1. Click a row in loan-types → tr.sel via JS dispatch (the div scrolled container can intercept Playwright clicks)
await page.evaluate(() => {
  const tr = document.querySelector('#sec-loan-types tr[data-i="0"]');
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
const hasSel = await page.evaluate(() =>
  document.querySelector('#sec-loan-types tr[data-i="0"]').classList.contains('sel')
);
console.log('1. Row select (tr.sel):', hasSel ? 'OK' : 'FAIL');

// 2. Click «Просмотр» via JS dispatch
await page.evaluate(() => {
  document.querySelector('#sec-loan-types [data-act="view"]').dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true })
  );
});
await page.waitForSelector('.modal-head', { timeout: 5000 });
const modalHeadView = await page.locator('.modal-head').textContent();
const isReadonly = await page.locator('.modal-body input').first().getAttribute('readonly');
console.log('2. View modal title:', modalHeadView.trim());
console.log('   Readonly attr:', isReadonly !== null ? 'OK' : 'FAIL (not readonly)');
console.log('   First field value:', await page.locator('.modal-body input').first().inputValue());

// Screenshot with modal open
await page.screenshot({ path: '.auth/dict-mockup-t6.png', fullPage: false });
console.log('   Screenshot saved → .auth/dict-mockup-t6.png');

// Close modal (Закрыть)
await page.locator('[data-m="close"]').click();
await page.waitForTimeout(200);
const modalGone = await page.locator('.modal').count();
console.log('   Modal closed:', modalGone === 0 ? 'OK' : 'FAIL');

// 3. Click «Создать» → empty modal with editable fields
await page.evaluate(() => {
  document.querySelector('#sec-loan-types [data-act="create"]').dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true })
  );
});
await page.waitForSelector('.modal-head', { timeout: 5000 });
const modalHeadCreate = await page.locator('.modal-head').textContent();
const firstVal = await page.locator('.modal-body input').first().inputValue();
const isEditable = await page.locator('.modal-body input').first().getAttribute('readonly');
console.log('3. Create modal title:', modalHeadCreate.trim());
console.log('   Empty field:', firstVal === '' ? 'OK' : 'FAIL (not empty): ' + firstVal);
console.log('   Editable (no readonly):', isEditable === null ? 'OK' : 'FAIL');
await page.locator('[data-m="close"]').click();
await page.waitForTimeout(200);

// 4. Double-click a row → Просмотр modal
await page.evaluate(() => {
  const tr = document.querySelector('#sec-loan-types tr[data-i="0"]');
  tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
});
await page.waitForSelector('.modal-head', { timeout: 5000 });
const modalHeadDbl = await page.locator('.modal-head').textContent();
console.log('4. Dblclick modal title:', modalHeadDbl.trim());
await page.locator('[data-m="close"]').click();
await page.waitForTimeout(200);

// 5. Select row then delete → row disappears
await page.evaluate(() => {
  const tr = document.querySelector('#sec-loan-types tr[data-i="0"]');
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
page.on('dialog', d => d.accept()); // auto-confirm
await page.evaluate(() => {
  document.querySelector('#sec-loan-types [data-act="delete"]').dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true })
  );
});
await page.waitForTimeout(500);
const rowAfter = await page.locator('#sec-loan-types tr[data-i="0"]').count();
console.log('5. Delete row:', rowAfter === 0 ? 'OK' : 'FAIL (row still present)');

console.log('\nConsole errors:', errors.length === 0 ? 'none' : errors.join('; '));
console.log('DONE');

await browser.close();
