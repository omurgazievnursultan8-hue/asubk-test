// Inspect the live borrower-list filter: exact styles, dropdown options, behaviour.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const out = {};

// tight screenshot of filter region
const filterBox = await page.evaluate(() => {
  // find the filter container by its text
  const all = [...document.querySelectorAll('*')];
  const el = all.find(e => /Статус/.test(e.textContent) && e.querySelector && e.querySelectorAll('*').length < 60 && /Обновить/.test(e.textContent));
  if (!el) return null; const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
if (filterBox) await page.screenshot({ path: '.auth/borrower/live-filter.png', clip: { x: Math.max(0,filterBox.x-4), y: Math.max(0,filterBox.y-30), width: Math.min(1590,filterBox.w+8), height: filterBox.h+70 } });

// filter field host styles
out.statusFieldTag = await page.evaluate(() => {
  const lbls = [...document.querySelectorAll('*')].filter(e => e.childElementCount===0 && /^Статус/.test(e.textContent.trim()));
  const l = lbls[0]; let host = l?.parentElement;
  // find the input-like sibling
  const combo = document.querySelector('vaadin-combo-box, vaadin-select, vaadin-multi-select-combo-box');
  return { statusLabelHtml: l?.outerHTML?.slice(0,120), firstComboTag: combo?.tagName };
});
out.comboTags = await page.evaluate(() => [...document.querySelectorAll('vaadin-combo-box,vaadin-select,vaadin-multi-select-combo-box,vaadin-entity-combo-box')].map(e=>({tag:e.tagName.toLowerCase(),label:e.getAttribute('label')||'',placeholder:e.getAttribute('placeholder')||''})));

// open Статус dropdown -> options
try {
  const statusCombo = await page.$('vaadin-combo-box, vaadin-select');
  if (statusCombo) {
    await statusCombo.click(); await page.waitForTimeout(1200);
    out.statusOptions = await page.evaluate(() => [...document.querySelectorAll('vaadin-combo-box-item, vaadin-select-item, vaadin-item')].map(i=>i.textContent.trim()).filter(Boolean));
    await page.keyboard.press('Escape');
  }
} catch(e){ out.statusErr = e.message; }

// computed style of a filter field host
out.fieldCss = await page.evaluate(() => {
  const el = document.querySelector('vaadin-combo-box, vaadin-select');
  if (!el) return null; const c = getComputedStyle(el);
  const inp = el.shadowRoot?.querySelector('[part=input-field]') || el.querySelector('input');
  const ic = inp ? getComputedStyle(inp) : null;
  return { hostH: c.height, hostBg: c.backgroundColor, inputBg: ic?.backgroundColor, inputBorder: ic?.border, inputRadius: ic?.borderRadius, inputH: ic?.height };
});
out.buttons = await page.evaluate(() => [...document.querySelectorAll('vaadin-button')].map(b=>({t:b.textContent.trim(),theme:b.getAttribute('theme')||'',bg:getComputedStyle(b).backgroundColor})).filter(b=>b.t));

writeFileSync('.auth/borrower-filter.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await ctx.close();
