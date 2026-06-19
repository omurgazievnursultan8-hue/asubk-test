import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation().catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}

async function gotoNew() { await page.goto(BASE + 'loan-programs/new', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2200); }

await gotoNew();
const labels = await page.$$eval('jmix-value-picker', els => els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(e => e.querySelector(':scope > label[slot="label"]')?.textContent?.trim() || null));
console.log('visible pickers tab1:', labels.length, JSON.stringify(labels));

const out = [];
for (let i = 0; i < labels.length; i++) {
  await gotoNew();
  const pickers = (await page.$$('jmix-value-picker'));
  const vis = [];
  for (const p of pickers) { if (await p.isVisible()) vis.push(p); }
  const pk = vis[i]; if (!pk) { out.push({ label: labels[i], error: 'not found' }); continue; }
  try {
    const actBtn = await pk.evaluateHandle(el => el.querySelector('div[slot="actions"]')?.querySelector('vaadin-button,button,[role="button"]') || el.querySelector('div[slot="actions"]')?.firstElementChild);
    const el = actBtn.asElement();
    if (el) await el.click({ timeout: 5000, force: true }).catch(e=>console.log('clickerr', String(e).slice(0,50)));
    await page.waitForTimeout(1400);
    const dlg = await page.evaluate(() => {
      const ov = document.querySelector('vaadin-dialog-overlay, vaadin-combo-box-overlay, [class*="overlay"][opened]');
      if (!ov) return { empty: true };
      const title = ov.querySelector('h2,[part="title"],[slot="title"]')?.textContent?.trim() || null;
      const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,50);
      const cbItems = [...ov.querySelectorAll('vaadin-combo-box-item')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,50);
      return { title, cells, cbItems };
    });
    out.push({ label: labels[i], ...dlg });
    console.log(`[${i}] ${labels[i]} => ${(dlg.cells||dlg.cbItems||[]).slice(0,14).join(' | ') || dlg.title || 'EMPTY'}`);
  } catch (e) { out.push({ label: labels[i], error: String(e).slice(0,80) }); console.log(`[${i}] ERR`, String(e).slice(0,60)); }
}
writeFileSync('.auth/lookups-tab1.json', JSON.stringify(out, null, 1));
console.log('captured', out.length);
await ctx.close();
