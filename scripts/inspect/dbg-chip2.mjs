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
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const combos = await page.evaluate(()=>[...document.querySelectorAll('vaadin-combo-box,vaadin-select,vaadin-text-field,vaadin-multi-select-combo-box')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName.toLowerCase(),id:e.id||null,val:(e.value||'').toString().slice(0,30),x:Math.round(r.left),y:Math.round(r.top)};}));
log('VISIBLE INPUTS:', JSON.stringify(combos,null,1));
const closes = await page.evaluate(()=>[...document.querySelectorAll('vaadin-icon[icon="vaadin:close"],vaadin-icon[icon*="close"]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top)};}));
log('CLOSE ICONS:', JSON.stringify(closes));
await ctx.close();
