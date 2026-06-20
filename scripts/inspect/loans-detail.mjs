// Phase 5 — probe loan detail open paths. Read-only.
// 1) select a real data row in loansCredit list, try Просмотр + Изменить (capture state)
// 2) hit several /loan-credits/{id} directly, record whether each crashes.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}

const out = { listToolbarAfterSelect: null, viewAttempt: null, idProbes: [] };
const pageText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400));
const hasError = () => page.evaluate(() => /Непредвиденная ошибка|Unexpected error|Internal Server Error|500/.test(document.body.innerText));

// ---- list: select first data row, read toolbar enablement, try Просмотр ----
await page.goto(BASE + 'loansCredit', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
// click the first body row cell (Номер регистрации column has reg numbers)
const cells = await page.$$('vaadin-grid-cell-content');
for (const c of cells) {
  const t = (await c.textContent()).trim();
  if (/^\d{5,}/.test(t)) { await c.click(); break; } // a registration/borrower id cell
}
await page.waitForTimeout(800);
out.listToolbarAfterSelect = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].map(b => ({
    label: b.textContent.trim(),
    disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
  })).filter(b => b.label));

// click Просмотр if enabled
const viewBtn = await page.evaluateHandle(() =>
  [...document.querySelectorAll('vaadin-button')].find(b => /Просмотр/.test(b.textContent) &&
    !b.hasAttribute('disabled') && b.getAttribute('aria-disabled') !== 'true'));
if (viewBtn && (await viewBtn.evaluate(e => !!e))) {
  await viewBtn.asElement()?.click();
  await page.waitForTimeout(2500);
  out.viewAttempt = { url: page.url(), error: await hasError(), text: await pageText() };
  await page.screenshot({ path: '.auth/loans-view-attempt.png', fullPage: true });
} else {
  out.viewAttempt = { note: 'Просмотр disabled even after row select' };
}

// ---- direct id probes ----
for (const id of [18, 19, 20, 21, 22]) {
  await page.goto(BASE + 'loan-credits/' + id, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  out.idProbes.push({ id, url: page.url(), error: await hasError(), text: (await pageText()).slice(0, 160) });
}
await page.screenshot({ path: '.auth/loans-detail-last.png', fullPage: true });

writeFileSync('.auth/loans-detail.json', JSON.stringify(out, null, 2));
console.log('toolbar after select:', out.listToolbarAfterSelect.map(b => b.label + (b.disabled ? '(off)' : '(on)')).join(' | '));
console.log('view attempt:', JSON.stringify(out.viewAttempt).slice(0, 200));
for (const p of out.idProbes) console.log(`id ${p.id}: error=${p.error}  ${p.text.slice(0,80)}`);
console.log('wrote .auth/loans-detail.json');
await ctx.close();
