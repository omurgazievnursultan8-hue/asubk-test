// /loan-credits/39 (2026-10-15): full «Досье» tab — section headings in order, grid heads/rows, and
// screenshots while scrolling down (the first dump only caught the top). Read-only.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin', PASS = process.env.OK_PASS || 'admin';
const ID = process.env.LOAN_ID || '39';
const OUT = `.auth/loan-credit-${ID}`; mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile',
  { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER); await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-credits/' + ID, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const t = [...document.querySelectorAll('vaadin-tab')].find(x => x.textContent.trim() === 'Досье'); t.click();
});
await page.waitForTimeout(2500);

// Headings and grids in document order, below the tab strip.
const out = await page.evaluate(() => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const strip = [...document.querySelectorAll('vaadin-tabs')][0].getBoundingClientRect().bottom;
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || r.top < strip) continue;
    if (el.tagName === 'VAADIN-GRID') {
      const heads = [...el.shadowRoot.querySelectorAll('#header tr:last-child th')].map(th => {
        const s = th.querySelector('slot'); return s ? clean(s.assignedElements().map(e => e.textContent).join(' ')) : '';
      });
      const rows = [...el.shadowRoot.querySelectorAll('#items tr')].map(tr => [...tr.querySelectorAll('td')].map(td => {
        const s = td.querySelector('slot'); return s ? clean(s.assignedElements().map(e => e.textContent).join(' ')) : '';
      })).filter(r => r.some(Boolean));
      items.push({ grid: heads, rows });
    } else if (el.children.length === 0) {
      const fw = +getComputedStyle(el).fontWeight, txt = clean(el.textContent);
      if (txt && fw >= 600 && txt.length < 90) items.push({ head: txt });
    }
  }
  return items;
});
writeFileSync(`${OUT}/dosye.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 6000));

for (let i = 0; i < 4; i++) {
  await page.mouse.move(1100, 700); await page.mouse.wheel(0, 650); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/e-dosye-${i}.png` });
}
await ctx.close();
