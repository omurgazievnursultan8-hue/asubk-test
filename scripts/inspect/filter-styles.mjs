// Dump the live list-view filter (Jmix generic filter) on /loan-applicants: DOM, computed styles, screenshot.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
const ROUTE = process.env.ROUTE || 'loan-applicants';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(3000);
}
await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const cs = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(), cls: el.getAttribute('class') || '',
      text: (el.innerText || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 60),
      w: Math.round(r.width), h: Math.round(r.height),
      fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color, background: s.backgroundColor,
      border: s.border, borderRadius: s.borderRadius, padding: s.padding, margin: s.margin, gap: s.gap,
      display: s.display, alignItems: s.alignItems,
    };
  };
  const res = {};
  const view = document.querySelector('.jmix-main-view-content, vaadin-app-layout') || document.body;
  res.viewHTML = view.innerHTML.slice(0, 25000);

  const gf = document.querySelector('jmix-generic-filter, .jmix-generic-filter');
  res.genericFilter = cs(gf);
  res.genericFilterHTML = gf ? gf.outerHTML.slice(0, 12000) : null;

  // any filter-ish component present
  res.components = [...new Set([...document.querySelectorAll('*')]
    .map(e => e.tagName.toLowerCase())
    .filter(t => /filter|toolbar|grid|button|combo|text-field|date|menu-bar|details/.test(t)))];

  // top-of-grid controls
  res.buttons = [...document.querySelectorAll('vaadin-button')].slice(0, 20).map(cs);
  res.fields = [...document.querySelectorAll('vaadin-text-field, vaadin-combo-box, vaadin-select, vaadin-date-picker, vaadin-number-field')].slice(0, 20).map(cs);
  res.grid = cs(document.querySelector('vaadin-grid'));
  res.gridHeaderCell = cs(document.querySelector('vaadin-grid th'));
  return res;
});

writeFileSync('.auth/filter-styles.json', JSON.stringify(dump, null, 2));
await page.screenshot({ path: '.auth/filter.png', fullPage: false });
console.log('COMPONENTS:', dump.components.join(', '));
console.log('\nGENERIC FILTER:', JSON.stringify(dump.genericFilter, null, 1));
console.log('\nHTML:\n', dump.genericFilterHTML ? dump.genericFilterHTML.slice(0, 6000) : '(none)');
console.log('\nBUTTONS:', JSON.stringify(dump.buttons, null, 1));
await ctx.close();
