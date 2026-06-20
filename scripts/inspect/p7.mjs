// Phase 7 — Servicing (Обслуживание). Read-only inspection of three list screens
// under «Приложение»: payments (Платеж), loan-reserves (Резерв), loan-ledgers
// (LoanLedger). For each: dump list grid (columns/toolbar/statuses), open first
// row, walk every detail tab dumping fields/grids/buttons. No data mutated.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

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
      rowCount: g.querySelectorAll('tbody tr, [part~=row]').length || undefined,
    }));
    const buttons = [...document.querySelectorAll('vaadin-button,button')].filter(visible).map(b => ({
      label: b.textContent.trim(),
      disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
    })).filter(b => b.label);
    return { fields, grids, buttons };
  });
}

async function inspectScreen(route, key) {
  const r = { route, key };
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  r.listUrl = page.url();
  await page.screenshot({ path: `.auth/p7-${key}-list.png`, fullPage: true });
  r.list = await dumpComponents();

  const rowCells = await page.$$('vaadin-grid-cell-content');
  let opened = false;
  for (const c of rowCells) {
    const t = (await c.textContent()).trim();
    if (/^\d/.test(t)) { await c.dblclick(); opened = true; break; }
  }
  await page.waitForTimeout(2500);
  r.detailUrl = page.url();

  if (opened && page.url() !== r.listUrl) {
    const tabEls = await page.$$('vaadin-tab, [role=tab]');
    const tabLabels = [];
    for (const t of tabEls) tabLabels.push((await t.textContent()).trim());
    r.tabLabels = tabLabels.filter(Boolean);
    r.header = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent.trim()).filter(Boolean));
    r.tabs = [];
    for (let i = 0; i < tabEls.length; i++) {
      const label = tabLabels[i] || `tab-${i}`;
      if (!label.trim()) continue;
      try { await tabEls[i].click(); await page.waitForTimeout(1100); } catch {}
      const comps = await dumpComponents();
      const safe = label.replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 30);
      const shot = `.auth/p7-${key}-tab-${i}-${safe}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      r.tabs.push({ index: i, label, screenshot: shot, ...comps });
    }
    if (!r.tabs.length) {
      await page.screenshot({ path: `.auth/p7-${key}-detail.png`, fullPage: true });
      r.detail = await dumpComponents();
    }
  }
  return r;
}

const result = { phase: 7 };
for (const [route, key] of [['payments', 'payments'], ['loan-reserves', 'reserves'], ['loan-ledgers', 'ledger']]) {
  result[key] = await inspectScreen(route, key);
}

writeFileSync('.auth/p7.json', JSON.stringify(result, null, 2));
for (const key of ['payments', 'reserves', 'ledger']) {
  const s = result[key];
  console.log(`\n=== ${key} (${s.route}) ===`);
  console.log('listUrl:', s.listUrl);
  console.log('toolbar:', (s.list.buttons || []).map(b => b.label + (b.disabled ? '(off)' : '')).join(' | '));
  console.log('grid cells:', (s.list.grids[0]?.headerCells || []).join(' | '));
  console.log('detailUrl:', s.detailUrl);
  console.log('detail tabs:', (s.tabLabels || []).join(' | '));
}
console.log('\nwrote .auth/p7.json');
await ctx.close();
