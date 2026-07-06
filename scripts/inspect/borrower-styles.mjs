// Probe computed styles on the live borrower page for an exact mockup.
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
await page.goto(BASE + 'loan-applicants/18', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
const cs = (sel, props) => page.evaluate(([s, p]) => {
  const el = document.querySelector(s); if (!el) return null;
  const c = getComputedStyle(el); const o = {};
  p.forEach(k => o[k] = c.getPropertyValue(k)); return o;
}, [sel, props]);
const box = ['color','background-color','font-family','font-size','font-weight','border','border-radius','padding','margin'];
const out = {};
out.body = await cs('body', ['background-color','font-family','color','font-size']);
out.field = await cs('vaadin-text-field input', box);
out.fieldHost = await cs('vaadin-text-field', box);
out.label = await cs('vaadin-text-field::part(label)', box);
out.tab = await cs('vaadin-tab', box);
out.tabSelected = await cs('vaadin-tab[selected]', box);
out.okButton = await cs('vaadin-button[theme~=primary]', box);
// lumo css custom props
out.lumoVars = await page.evaluate(() => {
  const c = getComputedStyle(document.documentElement); const want = ['--lumo-primary-color','--lumo-primary-text-color','--lumo-base-color','--lumo-contrast-10pct','--lumo-contrast-20pct','--lumo-body-text-color','--lumo-secondary-text-color','--lumo-border-radius-m','--lumo-font-family','--lumo-font-size-m','--lumo-success-color','--lumo-error-color'];
  const o = {}; want.forEach(k => o[k] = c.getPropertyValue(k).trim()); return o;
});
// risk card bg (green)
out.riskCard = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => /Чёрный список/.test(e.textContent) && e.children.length < 6);
  const card = els[els.length - 1]?.closest('[class],div');
  if (!card) return null; const c = getComputedStyle(card);
  return { bg: c.backgroundColor, border: c.border, borderRadius: c.borderRadius, padding: c.padding };
});
writeFileSync('.auth/borrower-styles.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await ctx.close();
