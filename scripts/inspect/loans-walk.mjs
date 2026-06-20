// Phase 5 — walk the loan detail (edit) page of a known-good record. Read-only:
// opens loan-credits/{ID} and clicks through tabs dumping components. No save.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const ID = process.env.LOAN_ID || '18';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}

async function dumpComponents() {
  return await page.evaluate(() => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const fieldSel = 'vaadin-text-field,vaadin-text-area,vaadin-number-field,vaadin-integer-field,vaadin-date-picker,vaadin-date-time-picker,vaadin-time-picker,vaadin-combo-box,vaadin-select,vaadin-checkbox,vaadin-checkbox-group,vaadin-radio-group,vaadin-multi-select-combo-box,vaadin-big-decimal-field,vaadin-email-field,vaadin-password-field';
    const fields = [...document.querySelectorAll(fieldSel)].filter(visible).map(f => {
      const inp = f.querySelector('input,textarea');
      return {
        tag: f.tagName.toLowerCase(),
        label: (f.getAttribute('label') || f.querySelector('label')?.textContent || '').trim(),
        required: f.hasAttribute('required'),
        disabled: f.hasAttribute('disabled') || f.getAttribute('aria-disabled') === 'true',
        readonly: f.hasAttribute('readonly'),
        value: (inp?.value ?? f.getAttribute('value') ?? '').toString().slice(0, 60),
      };
    });
    const grids = [...document.querySelectorAll('vaadin-grid')].filter(visible).map(g => ({
      headerCells: [...g.querySelectorAll('vaadin-grid-cell-content')]
        .map(c => c.textContent.trim()).filter(Boolean).slice(0, 24),
    }));
    const buttons = [...document.querySelectorAll('vaadin-button,button')].filter(visible).map(b => ({
      label: b.textContent.trim(),
      disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
    })).filter(b => b.label);
    return { fields, grids, buttons };
  });
}

await page.goto(BASE + 'loan-credits/' + ID, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const result = { id: ID, url: page.url(), tabs: [] };
result.header = await page.evaluate(() =>
  [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 6));

const tabEls = await page.$$('vaadin-tab, [role=tab]');
const tabLabels = [];
for (const t of tabEls) tabLabels.push((await t.textContent()).trim());
result.tabLabels = tabLabels.filter(Boolean);

for (let i = 0; i < tabEls.length; i++) {
  const label = tabLabels[i] || `tab-${i}`;
  if (!label.trim()) continue;
  try { await tabEls[i].click(); await page.waitForTimeout(1200); } catch {}
  const comps = await dumpComponents();
  const safe = label.replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 30);
  const shot = `.auth/loans-walk-tab-${i}-${safe}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  result.tabs.push({ index: i, label, screenshot: shot, ...comps });
}

writeFileSync('.auth/loans-walk.json', JSON.stringify(result, null, 2));
console.log('id', ID, 'url', result.url);
console.log('header:', result.header.join(' / '));
console.log('tabs:', result.tabLabels.join(' | '));
for (const t of result.tabs)
  console.log(`  [${t.label}] fields=${t.fields.length} grids=${t.grids.length} btns=${t.buttons.map(b=>b.label).slice(0,8).join(',')}`);
console.log('wrote .auth/loans-walk.json');
await ctx.close();
