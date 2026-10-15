// /loan-credits/39 (2026-10-15): which schedule does each scope show?
// Switches «Область» to «Транш #22», reads График (summary tiles + first rows), Прогноз first rows,
// KPI strip; also lists «Показать расчёт» options on Детальный расчет. Read-only.
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

const tab = async name => {
  await page.evaluate(n => [...document.querySelector('vaadin-tabs').querySelectorAll('vaadin-tab')]
    .find(x => x.textContent.replace(/\s+/g, ' ').trim() === n)?.click(), name);
  await page.waitForTimeout(2000);
};
const kpi = () => page.evaluate(() => {
  const strip = [...document.querySelectorAll('div')].find(d => /Сумма договора/.test(d.textContent) &&
    /Признаки состояния/.test(d.textContent) && d.children.length >= 5 && d.children.length <= 9);
  return strip ? [...strip.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()) : null;
});
const view = () => page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const st = cell => { const s = cell.querySelector('slot'); return (s ? s.assignedElements().map(e => e.textContent).join(' ') : cell.textContent).replace(/\s+/g, ' ').trim(); };
  const panel = document.querySelector('vaadin-tabsheet, jmix-tabsheet') || document.body;
  const text = [...panel.querySelectorAll('[slot]:not([hidden])')].filter(vis).map(e => e.innerText).join('\n')
    .replace(/[ \t]+/g, ' ').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40);
  const grids = [...document.querySelectorAll('vaadin-grid')].filter(vis).map(g => ({
    size: g.size, heads: [...g.shadowRoot.querySelectorAll('#header tr:last-child th')].filter(t => !t.hidden).map(st),
    rows: [...g.shadowRoot.querySelectorAll('#items tr')].filter(tr => !tr.hidden && vis(tr)).slice(0, 4)
      .map(tr => [...tr.querySelectorAll('td')].filter(t => !t.hidden).map(st)) }));
  return { text, grids };
});
const setScope = async label => {
  const sel = await page.evaluateHandle(() => [...document.querySelectorAll('vaadin-select')]
    .find(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.top < 150; }));
  await sel.asElement().click(); await page.waitForTimeout(800);
  await page.evaluate(l => [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0)
    .find(i => i.textContent.replace(/\s+/g, ' ').trim().startsWith(l))?.click(), label);
  await page.waitForTimeout(2500);
};

const out = {};
await tab('Детальный расчет');
out.pokazat = await (async () => {
  const sel = await page.evaluateHandle(() => [...document.querySelectorAll('vaadin-select')]
    .find(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.top > 300; }));
  if (!(await sel.evaluate(e => !!e))) return null;
  await sel.asElement().click(); await page.waitForTimeout(800);
  const items = await page.evaluate(() => [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0).map(i => i.textContent.replace(/\s+/g, ' ').trim()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400); return items;
})();

await setScope('Транш');
out.scopeTranche = { kpi: await kpi() };
for (const t of ['График', 'Прогноз', 'Детальный расчет']) {
  await tab(t); out.scopeTranche[t] = await view();
  await page.screenshot({ path: `${OUT}/c-tranche-${t.replace(/\s+/g, '-')}.png` });
}
writeFileSync(`${OUT}/scope.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
await ctx.close();
