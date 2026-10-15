// Read-only survey of «Кредит» card /loan-credits/39 (2026-10-15).
// Discovers top-level tabs dynamically, then for each tab dumps every visible field
// (label, value, readonly/required), checkbox, sub-tab, button and grid (headers + rows
// read from the grid shadow DOM, plus total size). Screenshot per tab.
// Output: .auth/loan-credit-39/{tab-NN.png, all-tabs.json}
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

const header = await page.evaluate(() => ({
  url: location.href, title: document.title,
  h: [...document.querySelectorAll('h1,h2,h3,h4,[slot=title],.jmix-main-view-title')].map(e => e.textContent.trim()).filter(Boolean),
  error: /Непредвиденная ошибка|Unexpected error|Internal Server Error/.test(document.body.innerText),
}));
console.log('HEADER', JSON.stringify(header));

// top-level tabs = tabs of the first (outermost) vaadin-tabs / tabsheet
const topTabs = await page.evaluate(() => {
  const tabs = document.querySelector('vaadin-tabs, jmix-tabsheet vaadin-tabs, vaadin-tabsheet vaadin-tabs');
  return tabs ? [...tabs.querySelectorAll('vaadin-tab')].map(t => t.textContent.replace(/\s+/g, ' ').trim()) : [];
});
console.log('TABS', topTabs.join(' | '));

const dump = () => page.evaluate(() => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const fsel = 'vaadin-text-field,vaadin-text-area,vaadin-combo-box,vaadin-date-picker,vaadin-date-time-picker,' +
    'vaadin-time-picker,vaadin-big-decimal-field,vaadin-number-field,vaadin-integer-field,vaadin-select,' +
    'jmix-value-picker,jmix-entity-picker,jmix-entity-combo-box,vaadin-multi-select-combo-box';
  const fields = [...document.querySelectorAll(fsel)].filter(vis)
    .filter(f => !f.closest('vaadin-grid'))
    .map(f => ({
      tag: f.tagName.toLowerCase().replace('vaadin-', ''),
      label: clean(f.getAttribute('label') || f.label),
      value: clean(f.value ?? f.querySelector('input')?.value ?? ''),
      ro: f.hasAttribute('readonly') || undefined,
      req: f.hasAttribute('required') || undefined,
      dis: f.hasAttribute('disabled') || undefined,
    }));
  const checks = [...document.querySelectorAll('vaadin-checkbox')].filter(vis).filter(c => !c.closest('vaadin-grid'))
    .map(c => ({ label: clean(c.getAttribute('label') || c.textContent), checked: c.hasAttribute('checked'), ro: c.hasAttribute('readonly') || undefined }));
  const subtabs = [...document.querySelectorAll('vaadin-tabs')].slice(1).filter(vis)
    .map(ts => [...ts.querySelectorAll('vaadin-tab')].map(t => clean(t.textContent) + (t.hasAttribute('selected') ? '*' : '')));
  const slotText = cell => {
    const s = cell.querySelector('slot'); if (!s) return clean(cell.textContent);
    return clean(s.assignedElements().map(e => e.textContent).join(' '));
  };
  const grids = [...document.querySelectorAll('vaadin-grid')].filter(vis).map(g => {
    const sr = g.shadowRoot;
    const heads = sr ? [...sr.querySelectorAll('#header tr:last-child th')].filter(th => !th.hidden).map(slotText) : [];
    const rows = sr ? [...sr.querySelectorAll('#items tr')].filter(tr => !tr.hidden && vis(tr))
      .map(tr => [...tr.querySelectorAll('td')].filter(td => !td.hidden).map(slotText)) : [];
    const foot = sr ? [...sr.querySelectorAll('#footer tr th')].map(slotText).filter(Boolean) : [];
    return { size: g.size ?? null, heads, rows: rows.filter(r => r.some(Boolean)), foot };
  });
  const buttons = [...document.querySelectorAll('vaadin-button')].filter(vis)
    .map(b => clean(b.textContent || b.getAttribute('title') || b.getAttribute('aria-label')) +
      ((b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true') ? '(off)' : ''))
    .filter(s => s && s !== '(off)');
  const labels = [...document.querySelectorAll('h3,h4,h5,.jmix-group-box-title,vaadin-details-summary,jmix-group-box legend,legend')]
    .filter(vis).map(e => clean(e.textContent)).filter(Boolean);
  return { labels, fields, checks, subtabs, grids, buttons };
});

const clickTop = async i => page.evaluate(i => {
  const tabs = document.querySelector('vaadin-tabs');
  const t = tabs?.querySelectorAll('vaadin-tab')[i]; if (t) t.click(); return !!t;
}, i);

const result = { header, topTabs, tabs: {} };
const n = Math.max(topTabs.length, 1);
for (let i = 0; i < n; i++) {
  if (topTabs.length) { await clickTop(i); await page.waitForTimeout(1800); }
  const d = await dump();
  const name = topTabs[i] || 'main';
  result.tabs[name] = d;
  await page.screenshot({ path: `${OUT}/tab-${String(i).padStart(2, '0')}.png`, fullPage: true });
  console.log(`TAB ${i} [${name}] fields=${d.fields.length} checks=${d.checks.length} grids=${d.grids.map(g => g.size + 'r/' + g.heads.length + 'c').join(',') || '-'} sub=${JSON.stringify(d.subtabs)}`);
  // walk sub-tabs of this tab, one level
  const subCount = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const ts = [...document.querySelectorAll('vaadin-tabs')].slice(1).filter(vis)[0];
    return ts ? ts.querySelectorAll('vaadin-tab').length : 0;
  });
  for (let j = 1; j < subCount; j++) {
    const subName = await page.evaluate(j => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const ts = [...document.querySelectorAll('vaadin-tabs')].slice(1).filter(vis)[0];
      const t = ts?.querySelectorAll('vaadin-tab')[j]; if (!t) return null; t.click();
      return t.textContent.replace(/\s+/g, ' ').trim();
    }, j);
    if (!subName) continue;
    await page.waitForTimeout(1500);
    const d2 = await dump();
    result.tabs[`${name} :: ${subName}`] = d2;
    await page.screenshot({ path: `${OUT}/tab-${String(i).padStart(2, '0')}-sub${j}.png`, fullPage: true });
    console.log(`  SUB [${subName}] fields=${d2.fields.length} grids=${d2.grids.map(g => g.size + 'r/' + g.heads.length + 'c').join(',') || '-'}`);
  }
}
writeFileSync(`${OUT}/all-tabs.json`, JSON.stringify(result, null, 2));
console.log('Saved', `${OUT}/all-tabs.json`);
await ctx.close();
