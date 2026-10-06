// Application survey (read-only): open application ROW (doc number) or the
// create form (ROW=new), dump header + every tab: visible text, fields, grids,
// buttons, screenshot. Output: .auth/app-survey-<ROW>.json + per-tab PNGs.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const ROW  = process.env.ROW || 'З-2026-000185';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
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
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

if (ROW === 'new') {
  await page.locator('vaadin-button', { hasText: 'Создать' }).first().click();
} else {
  const cell = page.locator('vaadin-grid-cell-content', { hasText: ROW }).first();
  await cell.dblclick();
}
await page.waitForTimeout(3000);

const dump = () => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const fieldSel = 'vaadin-text-field,vaadin-text-area,vaadin-number-field,vaadin-integer-field,vaadin-big-decimal-field,vaadin-date-picker,vaadin-date-time-picker,vaadin-combo-box,vaadin-select,vaadin-checkbox,vaadin-radio-group,vaadin-multi-select-combo-box,jmix-value-picker,jmix-multi-value-picker,jmix-entity-combo-box';
  const fields = [...document.querySelectorAll(fieldSel)].filter(vis).map(f => {
    const inp = f.querySelector('input,textarea');
    return {
      tag: f.tagName.toLowerCase(),
      label: (f.label || f.getAttribute('label') || '').trim(),
      req: f.required || f.hasAttribute('required') || undefined,
      ro: f.readonly || f.hasAttribute('readonly') || undefined,
      dis: f.disabled || undefined,
      v: (inp?.value ?? f.value ?? '').toString().slice(0, 50),
    };
  });
  const grids = [...document.querySelectorAll('vaadin-grid')].filter(vis).map(g => ({
    cols: [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c => c.header || c.path || '').filter(Boolean),
    cells: [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => c.innerText.trim()).filter(Boolean).slice(0, 40),
  }));
  const buttons = [...document.querySelectorAll('vaadin-button')].filter(vis)
    .map(b => (b.innerText.trim() || b.title || b.getAttribute('aria-label') || '') + (b.disabled ? ' [off]' : '')).filter(Boolean);
  const main = document.querySelector('vaadin-app-layout') || document.body;
  return { fields, grids, buttons, text: main.innerText.replace(/\n{2,}/g, '\n').slice(0, 6000) };
});

const out = { url: page.url(), tabs: [] };
out.header = await dump();
await page.screenshot({ path: `.auth/app-survey-${ROW}-0.png`, fullPage: true });
const tabs = page.locator('vaadin-tab');
const n = await tabs.count();
for (let i = 0; i < n; i++) {
  const t = tabs.nth(i);
  if (!(await t.isVisible())) continue;
  const label = (await t.innerText()).trim();
  try { await t.click(); await page.waitForTimeout(1500); } catch { continue; }
  const d = await dump();
  await page.screenshot({ path: `.auth/app-survey-${ROW}-t${i}.png`, fullPage: true });
  out.tabs.push({ i, label, ...d });
}
writeFileSync(`.auth/app-survey-${ROW}.json`, JSON.stringify(out, null, 1));
console.log(out.url, '| tabs:', out.tabs.map(t => t.label).join(' | '));
await ctx.close();
