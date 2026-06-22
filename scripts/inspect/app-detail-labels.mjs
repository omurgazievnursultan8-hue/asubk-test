// Pull ordered label/value pairs from the General-info tab of an application.
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

// For every visible field, find its label text via vaadin's [slot=label] / aria / nearest preceding text.
const pairs = await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  const fieldSel = 'vaadin-text-field,vaadin-text-area,vaadin-number-field,vaadin-integer-field,vaadin-date-picker,vaadin-date-time-picker,vaadin-combo-box,vaadin-select,vaadin-checkbox,vaadin-big-decimal-field';
  const labelOf = (f) => {
    // 1) slotted label element
    const l = f.querySelector('label,[slot=label]');
    if (l && l.textContent.trim()) return l.textContent.trim();
    // 2) aria-label
    if (f.getAttribute('aria-label')) return f.getAttribute('aria-label');
    // 3) shadow label part
    if (f.shadowRoot) { const sl = f.shadowRoot.querySelector('[part=label]'); if (sl && sl.textContent.trim()) return sl.textContent.trim(); }
    // 4) preceding sibling / parent's label-ish text
    let p = f.previousElementSibling;
    while (p) { const t = p.textContent.trim(); if (t && t.length<60) return '«prev» '+t; p = p.previousElementSibling; }
    return '';
  };
  return [...document.querySelectorAll(fieldSel)].filter(vis).map(f => ({
    label: labelOf(f),
    value: (f.querySelector('input,textarea')?.value ?? '').toString().slice(0,70),
    ro: f.hasAttribute('readonly'), req: f.hasAttribute('required'),
  }));
});

// Also: section headers + any standalone bold/caption text in the form
const headers = await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  return [...document.querySelectorAll('h1,h2,h3,h4,b,strong,[class*=title],[class*=header],[class*=caption]')]
    .filter(vis).map(e=>e.textContent.trim()).filter(t=>t && t.length<60);
});
writeFileSync('.auth/app-detail-labels.json', JSON.stringify({ pairs, headers }, null, 2));
console.log(JSON.stringify({ pairs, headers }, null, 2));
await ctx.close();
