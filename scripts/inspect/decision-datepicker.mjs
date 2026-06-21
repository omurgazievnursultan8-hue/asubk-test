import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation().catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// open the calendar via the toggle button
await page.evaluate(() => {
  const d = document.querySelector('vaadin-date-picker');
  d.shadowRoot?.querySelector('[part="toggle-button"]')?.click() || d.click();
});
await page.waitForTimeout(1500);

// deep dump: pierce shadow DOM of overlay + month-calendar
const cal = await page.evaluate(() => {
  const ov = document.querySelector('vaadin-date-picker-overlay');
  if (!ov) return { found: false };
  const out = { found: true };
  // overlay shadow content
  const sr = ov.shadowRoot;
  // month calendar lives in light or shadow; search both
  const mc = ov.querySelector('vaadin-month-calendar') || sr?.querySelector('vaadin-month-calendar')
    || ov.querySelector('vaadin-date-picker-overlay-content')?.shadowRoot?.querySelector('vaadin-month-calendar')
    || [...(sr?.querySelectorAll('*') || [])].find(e => e.tagName.toLowerCase() === 'vaadin-month-calendar');
  // try the overlay-content wrapper Vaadin uses
  const content = ov.querySelector('#overlay-content, vaadin-date-picker-overlay-content')
    || sr?.querySelector('#overlay-content, vaadin-date-picker-overlay-content');
  const csr = content?.shadowRoot;
  const mc2 = csr?.querySelector('vaadin-month-calendar');
  const realMc = mc || mc2;
  if (realMc) {
    const msr = realMc.shadowRoot;
    out.monthHeader = msr?.querySelector('[part="month-header"]')?.textContent?.trim() || null;
    out.weekdays = [...(msr?.querySelectorAll('[part="weekday"]') || [])].map(w => w.textContent.trim()).filter(Boolean);
    out.days = [...(msr?.querySelectorAll('[part~="date"]') || [])].map(d => d.textContent.trim()).filter(Boolean);
    out.todayCell = msr?.querySelector('[part~="today"]')?.textContent?.trim() || null;
  } else {
    out.note = 'vaadin-month-calendar not located';
  }
  // toolbar buttons
  out.buttons = [...(csr?.querySelectorAll('vaadin-button') || ov.querySelectorAll('vaadin-button'))].map(b => b.textContent.trim()).filter(Boolean);
  return out;
});
log('=== OPEN CALENDAR (shadow-pierced) ===');
log(JSON.stringify(cal, null, 2));

await page.screenshot({ path: '.auth/decision-cal-open.png' });
await ctx.close();
