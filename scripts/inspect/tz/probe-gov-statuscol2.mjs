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

// load gov-decisions list
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Screenshot before clearing filter
await page.screenshot({ path: '.auth/statuscol-before.png' });

// Try to find and click the filter chip's remove/X button
// Jmix saved filters show as chips with a close button
const filterChipClose = await page.$$('[class*="filter"] button, [class*="chip"] button, vaadin-button[class*="remove"], [title*="Удалить фильтр"], [aria-label*="remove"], [aria-label*="Remove"]');
console.log('FILTER CHIP CLOSE BUTTONS FOUND:', filterChipClose.length);
for (const btn of filterChipClose) {
  const text = await btn.textContent().catch(() => '');
  const aria = await btn.getAttribute('aria-label').catch(() => '');
  console.log(' chip button text:', text, 'aria-label:', aria);
}

// Look for the filter label text near a remove button
const allButtons = await page.$$('vaadin-button');
console.log('TOTAL VAADIN BUTTONS:', allButtons.length);
for (const btn of allButtons) {
  const text = await btn.textContent().catch(() => '').then(t => t.trim());
  const theme = await btn.getAttribute('theme').catch(() => '');
  if (text.length < 30) console.log(' vaadin-button:', JSON.stringify(text), 'theme:', theme);
}

// Try clicking on the filter area to find the X/reset
// Look for any element containing "ФильтрПоСтатусу" or similar
const filterEls = await page.$$('*');
let filterChipEl = null;
for (const el of filterEls) {
  const text = await el.textContent().catch(() => '');
  if (text && text.includes('фильтр') && text.length < 50) {
    const tag = await el.evaluate(e => e.tagName);
    console.log('FILTER-RELATED ELEMENT:', tag, JSON.stringify(text.trim().substring(0, 60)));
    filterChipEl = el;
  }
}

// Screenshot after investigation
await page.screenshot({ path: '.auth/statuscol-filter-area.png' });

// Try to remove the saved filter via clicking X on each property filter chip
// In Jmix, property filter chips appear as closeable chips
const chipRemoveBtns = await page.$$('jmix-property-filter [part="remove-button"], jmix-filter-group [part="remove-button"]');
console.log('JMIX PROPERTY FILTER REMOVE BUTTONS:', chipRemoveBtns.length);

// Try CSS-based approach for Jmix filter chips
const jmixFilterItems = await page.$$('jmix-property-filter, jmix-filter-group');
console.log('JMIX FILTER ITEMS:', jmixFilterItems.length);

// Look specifically at the filter panel
const filterPanel = await page.$('jmix-filter, [class*="filter-panel"]');
if (filterPanel) {
  const filterHTML = await filterPanel.innerHTML().catch(() => '');
  console.log('FILTER PANEL HTML (first 1000):', filterHTML.substring(0, 1000));
}

await ctx.close();
