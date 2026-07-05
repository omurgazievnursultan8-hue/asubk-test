import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// open first program row -> select then Изменить; fallback dblclick
const first = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')].filter(c => c.innerText.trim());
  const c = cells.find(c => /[А-Яа-я]/.test(c.innerText)) || cells[0];
  if (!c) return 'no-cell';
  c.scrollIntoView(); c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return c.innerText.trim().slice(0, 40);
});
log('row selected:', first);
await page.waitForTimeout(700);
let opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /^(Изменить|Редактировать)$/i.test(b.innerText.trim()) && !b.disabled);
  if (b) { b.click(); return 'Изменить'; } return 'no-btn';
});
log('edit click:', opened);
await page.waitForTimeout(2500);
if (opened === 'no-btn') {
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll('vaadin-grid-cell-content')].filter(c => c.innerText.trim());
    const c = cells.find(c => /[А-Яа-я]/.test(c.innerText)) || cells[0];
    if (c) c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
  await page.waitForTimeout(2500);
}

// dump every field control: label + tagName (control type) + value + options if select/combo
const dump = await page.evaluate(() => {
  const root = document.querySelector('vaadin-dialog-overlay') || document;
  const els = [...root.querySelectorAll('vaadin-text-field,vaadin-text-area,vaadin-number-field,vaadin-big-decimal-field,vaadin-integer-field,jmix-value-picker,vaadin-select,vaadin-combo-box,vaadin-multi-select-combo-box,vaadin-checkbox,jmix-multi-value-picker,vaadin-date-picker')];
  return els.filter(e => e.getBoundingClientRect().width > 0).map(el => {
    const tag = el.tagName.toLowerCase();
    let opts = null;
    if (/select|combo/.test(tag)) {
      try { opts = (el.items || []).map(i => (typeof i === 'string' ? i : (i.label || i.value || JSON.stringify(i)))).slice(0, 12); } catch (e) {}
    }
    return {
      label: (el.label || el.getAttribute('label') || '').trim(),
      tag,
      readonly: !!(el.readonly || el.hasAttribute('readonly')),
      value: (el.value != null ? el.value.toString() : '').slice(0, 60),
      opts
    };
  });
});
log('PROGRAM EDIT FIELDS:\n' + JSON.stringify(dump, null, 1));
await page.screenshot({ path: '.auth/program-edit.png', fullPage: true });
await ctx.close();
