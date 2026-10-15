// Follow-up on /loan-credits/39 (2026-10-15): close-ups for the survey in loan-credit-39.mjs.
// 1) dropdown options of «Область» and «Показать расчёт»; 2) displayed text of «Статус кредита»;
// 3) close-up screenshots of Договор bottom, Состав, Платеж, Обеспечение, Проблемные (требования), Досье;
// 4) KPI strip before/after «Обновить сводку» (the only mutating step — recomputes the stored summary).
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin', PASS = process.env.OK_PASS || 'admin';
const ID = process.env.LOAN_ID || '39';
const OUT = `.auth/loan-credit-${ID}`; mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile',
  { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER); await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-credits/' + ID, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
const out = {};
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

const tab = async name => {
  await page.evaluate(n => {
    const t = [...document.querySelector('vaadin-tabs').querySelectorAll('vaadin-tab')]
      .find(x => x.textContent.replace(/\s+/g, ' ').trim() === n); t?.click();
  }, name);
  await page.waitForTimeout(1800);
};
const kpi = () => page.evaluate(() => {
  const strip = [...document.querySelectorAll('div')].find(d => /Сумма договора/.test(d.textContent) &&
    /Признаки состояния/.test(d.textContent) && d.children.length >= 5 && d.children.length <= 9);
  return strip ? [...strip.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()) : null;
});
// open a vaadin-select by label and read its overlay items
const selectOptions = async label => {
  const sel = await page.evaluateHandle(l => [...document.querySelectorAll('vaadin-select')]
    .find(s => { const r = s.getBoundingClientRect(); return r.width > 0 && (s.getAttribute('label') || '').trim() === l; }), label);
  if (!(await sel.evaluate(e => !!e))) return null;
  await sel.asElement().click(); await page.waitForTimeout(800);
  const items = await page.evaluate(() => [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => { const r = i.getBoundingClientRect(); return r.width > 0; })
    .map(i => i.textContent.replace(/\s+/g, ' ').trim()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  return items;
};
const shotSection = async (heading, file) => {
  const el = await page.evaluateHandle(h => {
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,span,div')].filter(e => e.children.length === 0 &&
      e.textContent.trim() === h);
    return hs[0]?.closest('[class*=card],[class*=box],[class*=panel],vaadin-vertical-layout,div') || null;
  }, heading);
  if (!(await el.evaluate(e => !!e))) return false;
  await el.asElement().scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}.png` }); return true;
};

out.kpiBefore = await kpi();
// «Область» select in header has no label attribute; find it by neighbouring text
out.oblast = await (async () => {
  const sel = await page.evaluateHandle(() => [...document.querySelectorAll('vaadin-select')]
    .find(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.top < 150; }));
  if (!(await sel.evaluate(e => !!e))) return null;
  await sel.asElement().click(); await page.waitForTimeout(800);
  const items = await page.evaluate(() => [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0).map(i => i.textContent.replace(/\s+/g, ' ').trim()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400); return items;
})();

// Договор: status text + bottom of form
await tab('Договор');
out.status = await page.evaluate(() => {
  const cb = [...document.querySelectorAll('vaadin-combo-box')].find(c => /Статус кредита/.test(c.getAttribute('label') || ''));
  return cb ? { input: cb.querySelector('input')?.value, selectedItem: JSON.stringify(cb.selectedItem ?? null) } : null;
});
await page.evaluate(() => [...document.querySelectorAll('vaadin-combo-box')].find(c => /Статус кредита/.test(c.getAttribute('label') || ''))?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/b-dogovor-bottom.png` });

await tab('Детальный расчет');
out.pokazat = await selectOptions('Показать расчёт');

for (const [t, f] of [['Состав', 'b-sostav'], ['Платеж', 'b-platezh'], ['Обеспечение', 'b-obesp'], ['Досье', 'b-dosye'], ['План', 'b-plan']]) {
  await tab(t); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: true });
}
await tab('Проблемные');
await shotSection('Требования взыскания', 'b-trebovaniya');

// mutate: recompute stored summary, then re-read KPI
await page.evaluate(() => [...document.querySelectorAll('vaadin-button')].find(b => b.textContent.trim() === 'Обновить сводку')?.click());
await page.waitForTimeout(4000);
out.kpiAfter = await kpi();
await page.screenshot({ path: `${OUT}/b-kpi-after.png`, clip: { x: 280, y: 60, width: 1640, height: 230 } });

writeFileSync(`${OUT}/followup.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await ctx.close();
