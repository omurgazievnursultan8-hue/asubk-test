// Verify P3-R5 (bulk send/delete guarded by row status?) and
// P3-R8 (does the list expose an "Одобренная сумма" column?) on the test stand.
// Read-only inspection — selects rows and reads button states; creates/mutates nothing.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const out = { columns: {}, toolbar: {}, rows: [], perStatus: [] };

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
console.log('login url:', page.url());

await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '.auth/p3r5-app-list.png', fullPage: true });

// action-button state snapshot (labels of interest only)
const RE = /комисс|Удалить|Изменить|Создать/i;
async function actionState() {
  return await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    return [...document.querySelectorAll('vaadin-button, button')]
      .map(b => ({ label: b.textContent.trim(),
        disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' }))
      .filter(b => b.label && re.test(b.label));
  }, RE.source);
}

// 1) column headers (R8) — read grid header cells
out.columns.headers = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  if (!grid) return [];
  // header cell-content live in the grid's header part; collect th-role cells
  const heads = [...grid.querySelectorAll('vaadin-grid-cell-content')]
    .map(c => c.textContent.trim());
  // header labels are the ones matching known column words; dump first ~20 distinct
  return heads.slice(0, 30);
});
out.columns.hasApprovedAmount = await page.evaluate(() =>
  !![...document.querySelectorAll('vaadin-grid-cell-content, *')]
    .find(e => /Одобренн\w*\s+сумм/i.test(e.textContent || '')));

// 2) toolbar baseline (no selection)
out.toolbar.noSelection = await actionState();

// 3) build row→status map from grid body cells
out.rows = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')]
    .map(c => c.textContent.trim());
  const anchors = [];
  cells.forEach((t, i) => { if (/^Заявка\s*-\s*\d+/.test(t)) anchors.push(i); });
  return anchors.map(i => ({
    number: cells[i],
    borrower: cells[i + 1],
    statusApp: cells[i + 2],
    statusCollateral: cells[i + 3],
    reqAmount: cells[i + 4],
  }));
});

// 4) for one representative row per distinct Статус заявки, select & read action state
const seen = new Set();
const targets = [];
for (const r of out.rows) {
  if (!seen.has(r.statusApp)) { seen.add(r.statusApp); targets.push(r); }
}
for (const t of targets) {
  // click the Номер cell of this row to select it
  const cells = await page.$$('vaadin-grid-cell-content');
  for (const c of cells) {
    if ((await c.textContent()).trim() === t.number) { await c.click(); break; }
  }
  await page.waitForTimeout(700);
  out.perStatus.push({
    statusApp: t.statusApp, statusCollateral: t.statusCollateral,
    number: t.number, actions: await actionState(),
  });
}

console.log(JSON.stringify(out, null, 2));
await ctx.close();
