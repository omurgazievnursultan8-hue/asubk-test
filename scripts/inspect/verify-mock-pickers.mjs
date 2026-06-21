// Render the LOCAL loan-program.html mockup and screenshot the rebuilt picker
// dialogs to confirm the picker-fidelity fixes match the live stand.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('mockups/loan-program.html')).href;
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => openCreate());
await page.waitForTimeout(400);

async function shot(name, openFn) {
  await page.evaluate(openFn);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `.auth/mock-${name}.png` });
  const d = await page.evaluate(() => {
    const t = document.getElementById('modalTitle').innerText;
    const cnt = document.getElementById('rfCount')?.innerText || '';
    const cols = [...document.querySelectorAll('#modalBody thead th')].map(th => th.innerText.replace(/\s+/g,' ').trim());
    const rows = [...document.querySelectorAll('#modalBody #rfBody tr')].length;
    const search = document.getElementById('rfSearch')?.style.display || 'n/a';
    const w = Math.round(document.getElementById('modal').getBoundingClientRect().width);
    const btns = [...document.querySelectorAll('#modalFoot button, #modalBody .tb-actions button, #modalBody .mv-add button')].map(b=>b.innerText.trim()).filter(Boolean);
    return { title:t, count:cnt, cols, rows, searchDisplay:search, modalW:w, btns };
  });
  console.log(`\n[${name}]`, JSON.stringify(d));
  await page.evaluate(() => closeModal());
  await page.waitForTimeout(250);
}

await shot('source',   () => openLookup('source','source',false));
await shot('decision', () => openDecisionPicker());
await shot('industry', () => openLookup('industry','industry',false));
await shot('currency', () => openLookup('currency','currency',false));
await shot('collection',() => openLookup('applicantsFiz','applicantsFiz',true));
await ctx.close();
