// Geometry-based label↔field pairing on application detail (all tabs).
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-applications/28', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

async function geo() {
  return await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
    const fieldSel = 'vaadin-text-field,vaadin-text-area,vaadin-number-field,vaadin-integer-field,vaadin-date-picker,vaadin-date-time-picker,vaadin-combo-box,vaadin-select,vaadin-checkbox,vaadin-big-decimal-field';
    // candidate label texts = leaf elements with short text
    const leaves = [...document.querySelectorAll('span,label,div,td')].filter(e =>
      e.childElementCount===0 && e.textContent.trim() && e.textContent.trim().length<50 && vis(e))
      .map(e => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
    const near = (fr) => {
      // label: left of field, vertical overlap, closest
      let best=null, bd=1e9;
      for (const l of leaves) {
        const vOverlap = Math.min(fr.bottom,l.r.bottom)-Math.max(fr.top,l.r.top);
        if (vOverlap < 6) continue;
        const gap = fr.left - l.r.right;
        if (gap < -4 || gap > 320) continue;
        if (gap < bd) { bd=gap; best=l.t; }
      }
      return best||'';
    };
    return [...document.querySelectorAll(fieldSel)].filter(vis).map(f => {
      const fr = f.getBoundingClientRect();
      return { label: near(fr), tag: f.tagName.toLowerCase(),
        value: (f.querySelector('input,textarea')?.value ?? '').toString().slice(0,70),
        ro: f.hasAttribute('readonly'), req: f.hasAttribute('required') };
    });
  });
}

const tabEls = await page.$$('vaadin-tab, [role=tab]');
const labels = [];
for (const t of tabEls) labels.push((await t.textContent()).trim());
const out = {};
for (let i=0;i<tabEls.length;i++){
  if(!labels[i]) continue;
  try { await tabEls[i].click(); await page.waitForTimeout(1000);} catch{}
  out[labels[i]] = await geo();
}
writeFileSync('.auth/app-detail-geo.json', JSON.stringify(out, null, 2));
console.log('done', Object.keys(out).join(' | '));
await ctx.close();
