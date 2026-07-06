// Live borrower list (/loan-applicants): toolbar buttons — style, size, and what
// changes when a row is selected. Captures computed CSS before/after selection.
import { chromium } from 'playwright-core';
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
await page.waitForTimeout(2800);

// snapshot every vaadin-button in the content toolbar (skip filter «Обновить» split etc. — capture all, we'll read)
const snap = () => page.evaluate(() => {
  const btns = [...document.querySelectorAll('vaadin-button')];
  return btns.map(b => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    // read inner part styles too (vaadin buttons theme via host)
    return {
      text: b.textContent.trim().replace(/\s+/g,' '),
      disabled: b.hasAttribute('disabled'),
      theme: b.getAttribute('theme') || '',
      w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, color: cs.color,
      border: cs.border, borderColor: cs.borderColor,
      radius: cs.borderRadius, font: cs.fontSize + '/' + cs.fontWeight,
      pad: cs.padding,
    };
  }).filter(b => b.text);
});

console.log('=== BEFORE selection ===');
console.log(JSON.stringify(await snap(), null, 1));

// selected-row highlight style + which row
const rowStyle = () => page.evaluate(() => {
  const row = document.querySelector('vaadin-grid tr[selected], vaadin-grid tbody tr[part~="selected-row"], vaadin-grid tbody tr');
  const sel = document.querySelector('vaadin-grid').shadowRoot?.querySelector('tbody tr[selected]');
  const info = {};
  const grid = document.querySelector('vaadin-grid');
  const sr = grid?.shadowRoot;
  if (sr) {
    const trs = [...sr.querySelectorAll('tbody tr')];
    const selTr = trs.find(t => t.hasAttribute('selected'));
    info.anySelected = !!selTr;
    if (selTr) {
      const cell = selTr.querySelector('td');
      const cs = getComputedStyle(cell);
      info.selBg = cs.backgroundColor;
    }
  }
  return info;
});

// click first data cell (10+ digit INN)
const cellH = await page.evaluateHandle(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  return cells.find(c => /^\d{10,}$/.test(c.textContent.trim()));
});
await cellH.asElement()?.click();
await page.waitForTimeout(1200);

console.log('\n=== AFTER selecting first row ===');
console.log('URL:', page.url());
console.log('row highlight:', JSON.stringify(await rowStyle()));
console.log(JSON.stringify(await snap(), null, 1));

await page.screenshot({ path: '.auth/borrower-selected.png' });
console.log('\nscreenshot -> .auth/borrower-selected.png');
await ctx.close();
