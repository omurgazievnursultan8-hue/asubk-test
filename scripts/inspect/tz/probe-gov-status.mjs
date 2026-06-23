import { chromium } from 'playwright-core';
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
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2000);
}
// toolbar on the list (filter out nav by reading buttons inside the main content area)
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
const toolbar = await page.evaluate(() => {
  const walk = (root, out) => { root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot, out); }); root.querySelectorAll('vaadin-button').forEach(b => out.push((b.textContent||'').trim())); return out; };
  // buttons inside the grid/content toolbar = those NOT inside <vaadin-app-layout> drawer
  const drawer = document.querySelector('[slot=drawer]');
  const all = [...document.querySelectorAll('vaadin-button')];
  return all.filter(b => !drawer || !drawer.contains(b)).map(b => (b.textContent||'').trim()).filter(Boolean);
});
console.log('TOOLBAR (non-drawer):', JSON.stringify([...new Set(toolbar)]));
// status enum: open create form, read the Статус combo options
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
const combos = await page.evaluate(() => {
  const res = [];
  document.querySelectorAll('vaadin-combo-box').forEach(c => {
    const items = c.items || c.filteredItems;
    res.push({ label: c.getAttribute('label'), value: c.value, items: items ? items.map(i => typeof i==='object'? (i.label||i.value||JSON.stringify(i)) : i) : null });
  });
  // also date-pickers required state
  const dates = [...document.querySelectorAll('vaadin-date-picker')].map(d => ({ label: d.getAttribute('label'), requiredAttr: d.hasAttribute('required'), requiredProp: d.required }));
  return { combos: res, dates };
});
console.log('COMBOS+DATES:', JSON.stringify(combos, null, 2));
await ctx.close();
