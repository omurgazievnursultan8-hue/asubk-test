// scripts/inspect/commission-detail.mjs — open first commission row → Просмотр, scrape detail
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1200 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// select first grid data row
await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  const dataCell = cells.find(c => /Проверка ком/.test(c.innerText));
  (dataCell || cells[10])?.click();
});
await page.waitForTimeout(800);
// click Просмотр
await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(x => /Просмотр/.test(x.innerText));
  b?.click();
});
await page.waitForTimeout(3000);
log('URL:', page.url());

log('TABS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim()))));

log('BUTTONS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim()).filter(Boolean))));

log('HEADINGS:', JSON.stringify(await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount) return;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 70) return;
    const cs = getComputedStyle(e); const fw = parseInt(cs.fontWeight, 10) || 400; const fs = parseFloat(cs.fontSize) || 0;
    if (fw < 600 && fs < 16) return;
    out.push({ t, x: Math.round(r.left), y: Math.round(r.top), fw, fs: cs.fontSize, color: cs.color });
  });
  return out.sort((a,b)=>a.y-b.y);
})));

log('LABELVALUE:', JSON.stringify(await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-combo-box','vaadin-select','vaadin-date-picker'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e => e.getBoundingClientRect().width > 0)
    .map(el => ({ label: (el.label || el.getAttribute('label') || '').trim(), value: el.value ?? null,
      x: Math.round(el.getBoundingClientRect().left), y: Math.round(el.getBoundingClientRect().top) }))
    .sort((a,b)=>a.y-b.y);
})));

log('GRID_CELLS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.innerText.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,80))));

log('ALLTEXT:', JSON.stringify(await page.evaluate(() => {
  const seen = new Set(); const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount) return;
    const t = (e.innerText || '').replace(/\s+/g,' ').trim();
    if (t && t.length < 50 && !seen.has(t)) { seen.add(t); out.push(t); }
  });
  return out;
})));

await page.screenshot({ path: '.auth/commission-detail.png', fullPage: true });
log('SHOT saved');
await ctx.close();
