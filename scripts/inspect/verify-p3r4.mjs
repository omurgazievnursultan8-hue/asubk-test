// Verify P3-R4 #3 (quorum/final-decision) and #4 (credit↔collateral gating)
// on the test stand. Read-only inspection — no data is created or mutated.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const out = { commission: {}, application: {} };

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

// dump a field control: enabled/readonly + tag
async function fieldInfo(labelText) {
  return await page.evaluate((lt) => {
    const labels = [...document.querySelectorAll('label, *')].filter(
      e => e.textContent && e.textContent.trim() === lt);
    for (const l of labels) {
      // find nearest input/select/value-picker after the label
      let scope = l.closest('vaadin-form-item, .v-formlayout-row, div') || l.parentElement;
      const f = scope && scope.querySelector('input, vaadin-select, vaadin-combo-box, select, vaadin-value-picker, [role=combobox]');
      if (f) return {
        found: true, tag: f.tagName.toLowerCase(),
        disabled: f.hasAttribute('disabled') || f.getAttribute('aria-disabled') === 'true',
        readonly: f.hasAttribute('readonly') || f.getAttribute('readonly') === 'true',
        value: (f.value || f.getAttribute('value') || f.textContent || '').trim().slice(0, 80),
      };
    }
    return { found: false };
  }, labelText);
}

// ---------- #3: commission governance ----------
await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '.auth/p3r4-commission-list.png', fullPage: true });

// toolbar action labels
out.commission.toolbar = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button, button')].map(b => b.textContent.trim()).filter(Boolean));

// select first data row, then click «Просмотр» (readonly)
{
  const cells = await page.$$('vaadin-grid-cell-content');
  for (const c of cells) {
    const t = (await c.textContent()).trim();
    if (/Проверка комиссии|^\d+$/.test(t)) { await c.click(); break; }
  }
  await page.waitForTimeout(800);
  const viewBtn = await page.$('vaadin-button:has-text("Просмотр"), button:has-text("Просмотр")');
  if (viewBtn) await viewBtn.click();
  await page.waitForTimeout(2500);
}
out.commission.detailUrl = page.url();
await page.screenshot({ path: '.auth/p3r4-commission-detail.png', fullPage: true });

// text getter that skips style/script/empty
const visText = (re, n) => [...document.querySelectorAll('body *')]
  .filter(e => e.childElementCount === 0 && !['STYLE','SCRIPT'].includes(e.tagName))
  .map(e => e.textContent.trim()).filter(t => t && re.test(t)).slice(0, n);

// capture voting-progress + tally text + final-decision control + quorum hints
out.commission.pageText = await page.evaluate((fn) => {
  const visText = eval('(' + fn + ')');
  return {
    progress: visText(/Прогресс голосования|^\d+\s*%$/, 6),
    tally: visText(/Одобрил|Отклонил|Воздерж|Не проголос|\d\/\d/, 12),
    quorumHint: visText(/кворум|quorum|порог|закрыть голосован/i, 6),
    finalDecisionLabel: visText(/Финальное решение/i, 3),
  };
}, visText.toString());
out.commission.finalDecision = await fieldInfo('Финальное решение');

// ---------- #4: application credit↔collateral gating ----------
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
out.application.toolbar = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button, button')].map(b => b.textContent.trim()).filter(Boolean));
await page.screenshot({ path: '.auth/p3r4-app-list.png', fullPage: true });

// #4 gating test: select a row, read disabled-state of both send-to-commission buttons
{
  const cells = await page.$$('vaadin-grid-cell-content');
  for (const c of cells) {
    const t = (await c.textContent()).trim();
    if (/Заявка -/.test(t)) { await c.click(); break; }
  }
  await page.waitForTimeout(800);
}
out.application.sendButtonsWhenRowSelected = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button, button')]
    .map(b => ({ label: b.textContent.trim(),
      disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' }))
    .filter(b => /комисс/i.test(b.label)));

// open first application row
const acells = await page.$$('vaadin-grid-cell-content');
for (const c of acells) {
  const t = (await c.textContent()).trim();
  if (/Заявка -|^Заявка/.test(t)) { await c.dblclick(); break; }
}
await page.waitForTimeout(2500);
out.application.detailUrl = page.url();
await page.screenshot({ path: '.auth/p3r4-app-detail.png', fullPage: true });

// tabs + two status tracks + send-to-commission buttons (gated?)
out.application.detail = await page.evaluate(() => {
  const txt = (re) => [...document.querySelectorAll('*')]
    .map(e => e.childElementCount === 0 ? e.textContent.trim() : '')
    .filter(t => t && re.test(t));
  const btns = [...document.querySelectorAll('vaadin-button, button')];
  return {
    tabs: [...document.querySelectorAll('vaadin-tab, [role=tab]')].map(t => t.textContent.trim()).filter(Boolean),
    statuses: txt(/На рассмотрении|Одобрен|Отклонен|Подача|Регистрация/).slice(0, 12),
    sendButtons: btns.map(b => ({
      label: b.textContent.trim(),
      disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
    })).filter(b => /комисс/i.test(b.label)),
  };
});

console.log(JSON.stringify(out, null, 2));
await ctx.close();
