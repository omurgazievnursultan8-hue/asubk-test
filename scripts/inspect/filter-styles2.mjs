// Exact computed styles of the generic-filter parts: summary, panel, form-item label, field, buttons, toolbar, pager.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
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
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const cs = (el, label) => {
    if (!el) return { label, missing: true };
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      label, tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').slice(0, 40),
      text: (el.innerText || el.textContent || '').trim().slice(0, 40),
      w: Math.round(r.width), h: Math.round(r.height),
      fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, color: s.color,
      background: s.backgroundColor, border: s.border, borderRadius: s.borderRadius,
      padding: s.padding, margin: s.margin, gap: s.gap, textAlign: s.textAlign,
    };
  };
  const q = (sel) => document.querySelector(sel);
  const out = [];
  out.push(cs(q('vaadin-details.jmix-generic-filter > vaadin-details-summary'), 'filter summary'));
  const sumSpan = q('vaadin-details.jmix-generic-filter > vaadin-details-summary span');
  out.push(cs(sumSpan, 'summary text'));
  out.push(cs(q('.jmix-group-filter'), 'filter panel'));
  out.push(cs(q('vaadin-form-item'), 'form-item'));
  out.push(cs(q('vaadin-form-item > label[slot=label]'), 'field label'));
  out.push(cs(q('vaadin-select'), 'select'));
  out.push(cs(q('jmix-value-picker'), 'value-picker'));
  out.push(cs(q('.jmix-generic-filter-controls-layout'), 'controls row'));
  out.push(cs(q('vaadin-menu-bar[theme~="success"] vaadin-menu-bar-button'), 'Обновить btn'));
  out.push(cs(q('vaadin-menu-bar[theme~="success"] vaadin-menu-bar-item'), 'Обновить item'));
  out.push(cs(q('vaadin-menu-bar[jmix-role="jmix-dropdown-button"] vaadin-menu-bar-button'), 'cog btn'));
  out.push(cs([...document.querySelectorAll('vaadin-button')].find(b => b.textContent.includes('Добавить условие')), 'add-condition btn'));
  out.push(cs([...document.querySelectorAll('vaadin-button')].find(b => b.textContent.includes('Изменить')), 'Изменить btn'));
  out.push(cs(q('.jmix-simple-pagination, jmix-simple-pagination'), 'pagination'));
  out.push(cs(q('vaadin-grid'), 'grid'));

  // shadow parts for select/field/menu-bar button
  const shadow = {};
  const sel = q('vaadin-select');
  if (sel && sel.shadowRoot) shadow.selectField = [...sel.shadowRoot.querySelectorAll('[part]')].map(e => cs(e, 'select::' + e.getAttribute('part')));
  const vp = q('jmix-value-picker');
  if (vp && vp.shadowRoot) shadow.valuePicker = [...vp.shadowRoot.querySelectorAll('[part]')].map(e => cs(e, 'vp::' + e.getAttribute('part')));
  const mb = q('vaadin-menu-bar[theme~="success"] vaadin-menu-bar-button');
  if (mb && mb.shadowRoot) shadow.menuBtn = [...mb.shadowRoot.querySelectorAll('[part]')].map(e => cs(e, 'mb::' + e.getAttribute('part')));
  return { out, shadow };
});

writeFileSync('.auth/filter-styles2.json', JSON.stringify(dump, null, 2));
console.log(JSON.stringify(dump.out, null, 1));
console.log('\nSHADOW select:', JSON.stringify(dump.shadow.selectField, null, 1));
console.log('\nSHADOW menu btn:', JSON.stringify(dump.shadow.menuBtn, null, 1));
await ctx.close();
