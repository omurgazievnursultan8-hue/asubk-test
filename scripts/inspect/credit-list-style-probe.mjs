// Scratch: capture live loansCredit list — filter/toolbar + grid columns + computed styles.
// Goal: mirror the new-app (fkftest) registry look in mockups/loan-credit/credit-v2.html.
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

await page.goto(BASE + 'loansCredit', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '.auth/credit-list-live.png', fullPage: true });

const data = await page.evaluate(() => {
  const cs = (el, props) => {
    if (!el) return null;
    const c = getComputedStyle(el); const o = {};
    props.forEach(p => o[p] = c.getPropertyValue(p));
    return o;
  };
  const grid = document.querySelector('vaadin-grid');
  const sr = grid && grid.shadowRoot;
  const headerCell = sr && sr.querySelector('th');
  const bodyCell = sr && sr.querySelector('td');
  const bodyRow = sr && sr.querySelector('tr');
  // toolbar / filter area: everything above the grid
  const toolbarBtns = [...document.querySelectorAll('vaadin-button,button')]
    .filter(b => { const r=b.getBoundingClientRect(); return r.width>0 && r.top < (grid?grid.getBoundingClientRect().top:9999); })
    .map(b => b.textContent.trim()).filter(Boolean);
  const filterFields = [...document.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-select,vaadin-date-picker,vaadin-multi-select-combo-box')]
    .filter(f => { const r=f.getBoundingClientRect(); return r.width>0; })
    .map(f => ({ tag:f.tagName.toLowerCase(), label:(f.getAttribute('label')||f.querySelector('input')?.getAttribute('placeholder')||'').trim(), placeholder:f.querySelector('input')?.getAttribute('placeholder')||'' }));
  const cols = [...document.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')]
    .map(c => (c.getAttribute('header')||c.getAttribute('path')||'').trim()).filter(Boolean);
  const headerTexts = sr ? [...sr.querySelectorAll('thead th vaadin-grid-cell-content, thead th')].map(t=>t.textContent.trim()).filter(Boolean).slice(0,30) : [];
  // Lumo tokens on :root
  const root = getComputedStyle(document.documentElement);
  const lumo = {};
  ['--lumo-primary-color','--lumo-primary-text-color','--lumo-base-color','--lumo-contrast-5pct','--lumo-contrast-10pct','--lumo-body-text-color','--lumo-secondary-text-color','--lumo-font-family','--lumo-font-size-m','--lumo-font-size-s','--lumo-border-radius-m','--lumo-size-m','--lumo-space-m'].forEach(t=>lumo[t]=root.getPropertyValue(t).trim());
  return {
    cols, headerTexts, toolbarBtns, filterFields, lumo,
    gridStyle: cs(grid, ['background-color','color','font-family','font-size','border']),
    headerCellStyle: cs(headerCell, ['background-color','color','font-size','font-weight','height','padding','border-bottom','text-transform']),
    bodyCellStyle: cs(bodyCell, ['background-color','color','font-size','height','padding','border-bottom']),
    bodyRowHeight: bodyRow ? bodyRow.getBoundingClientRect().height : null,
  };
});
writeFileSync('.auth/credit-list-style.json', JSON.stringify(data, null, 2));
console.log(JSON.stringify(data, null, 2));
await ctx.close();
