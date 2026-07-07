import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const f = 'file://' + process.cwd() + '/mockups/borrower/borrower.html';
await p.goto(f, { waitUntil: 'networkidle' });
await p.screenshot({ path: '.auth/borrower/cmp-list.png' });
// open card via edit btn
await p.evaluate(() => { document.querySelector('#rows tr').click(); });
await p.evaluate(() => { document.getElementById('btnEdit').click(); });
await p.waitForTimeout(300);
await p.screenshot({ path: '.auth/borrower/cmp-card.png' });
// credits tab
await p.evaluate(() => document.querySelector('.tab[data-tab=credits]').click());
await p.waitForTimeout(200);
await p.screenshot({ path: '.auth/borrower/cmp-credits.png' });
// industry modal
await p.evaluate(() => document.getElementById('btnOk').click());
await p.evaluate(() => document.getElementById('fIndustryOpen').click());
await p.waitForTimeout(200);
await p.screenshot({ path: '.auth/borrower/cmp-modal.png' });
await b.close();
console.log('done');
