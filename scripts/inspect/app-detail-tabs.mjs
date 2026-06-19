// Application DETAIL page — enumerate every tab and every component per tab.
// Read-only inspection: opens an existing application, walks tabs, dumps
// fields/grids/buttons + a screenshot per tab. No data created or mutated.
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

await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// open first application row
const acells = await page.$$('vaadin-grid-cell-content');
for (const c of acells) {
  const t = (await c.textContent()).trim();
  if (/Заявка/.test(t)) { await c.dblclick(); break; }
}
await page.waitForTimeout(2500);

const result = { detailUrl: page.url(), tabs: [] };

// component dumper for the currently-visible tab panel
async function dumpComponents() {
  return await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // form fields
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
        checked: f.hasAttribute('checked') || undefined,
      };
    });
    // grids inside this panel
    const grids = [...document.querySelectorAll('vaadin-grid')].filter(visible).map(g => ({
      columns: [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')]
        .map(c => (c.getAttribute('header') || c.getAttribute('path') || '').trim())
        .filter(Boolean),
      headerCells: [...g.querySelectorAll('vaadin-grid-cell-content')]
        .map(c => c.textContent.trim()).filter(Boolean).slice(0, 14),
      rowCount: g.querySelectorAll('tbody tr, [part~=row]').length || undefined,
    }));
    // buttons visible in panel/toolbar
    const buttons = [...document.querySelectorAll('vaadin-button,button')].filter(visible).map(b => ({
      label: b.textContent.trim(),
      disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
    })).filter(b => b.label);
    // free-standing labels/value displays (read-only detail rows)
    const details = [...document.querySelectorAll('vaadin-form-item')].filter(visible).map(fi => ({
      label: (fi.querySelector('label')?.textContent || '').trim(),
      text: fi.textContent.replace(fi.querySelector('label')?.textContent || '', '').trim().slice(0, 80),
    })).filter(d => d.label);
    return { fields, grids, buttons, details };
  });
}

// find tabs
const tabEls = await page.$$('vaadin-tab, [role=tab]');
const tabLabels = [];
for (const t of tabEls) tabLabels.push((await t.textContent()).trim());
result.tabLabels = tabLabels.filter(Boolean);

// header / top-of-form info (status tracks, title)
result.header = await page.evaluate(() => {
  const txt = (re) => [...document.querySelectorAll('*')]
    .map(e => e.childElementCount === 0 ? e.textContent.trim() : '')
    .filter(t => t && re.test(t)).slice(0, 10);
  return {
    statuses: txt(/рассмотрени|Одобрен|Отклон|Подача|Регистрац|Черновик|Закрыт|Новая/),
    h: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent.trim()).filter(Boolean),
  };
});

// walk each tab
for (let i = 0; i < tabEls.length; i++) {
  const label = tabLabels[i] || `tab-${i}`;
  if (!label.trim()) continue;
  try {
    await tabEls[i].click();
    await page.waitForTimeout(1200);
  } catch {}
  const comps = await dumpComponents();
  const safe = label.replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 30);
  const shot = `.auth/app-detail-tab-${i}-${safe}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  result.tabs.push({ index: i, label, screenshot: shot, ...comps });
}

writeFileSync('.auth/app-detail-tabs.json', JSON.stringify(result, null, 2));
console.log('detailUrl:', result.detailUrl);
console.log('tabs:', result.tabLabels.join(' | '));
console.log('wrote .auth/app-detail-tabs.json');
await ctx.close();
