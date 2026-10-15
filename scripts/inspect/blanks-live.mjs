// Настройка бланков на новом стенде: печатные формы, шаблоны договоров, коды шаблонов,
// модуль «Отчеты» (Jmix Reports). Для каждого экрана — текст страницы, кнопки, скриншот;
// затем открывает первую строку списка и снимает форму записи.
//   node scripts/inspect/blanks-live.mjs [route ...]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const OUT = '.auth/blanks';
mkdirSync(OUT, { recursive: true });

const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'print-forms', 'agreement-templates', 'agreement-template-codes',
  'reports', 'reports/groups', 'reports/run', 'reports/tables',
];

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1920, height: 1080 },
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

const mainText = () => page.evaluate(() => {
  const main = document.querySelector('vaadin-app-layout') || document.body;
  // текст без бокового меню
  const drawer = document.querySelector('[slot=drawer]');
  const t = (main.innerText || '');
  const d = drawer ? drawer.innerText : '';
  return d ? t.replace(d, '') : t;
});
const buttons = () => page.evaluate(() => [...document.querySelectorAll('vaadin-button, vaadin-menu-bar-button')]
  .filter(b => !b.closest('[slot=drawer]'))
  .map(b => ((b.innerText || '').trim() || b.getAttribute('title') || b.getAttribute('aria-label') || '?') + (b.hasAttribute('disabled') ? ' [disabled]' : '')));
const fields = () => page.evaluate(() => [...document.querySelectorAll(
  'vaadin-text-field, vaadin-text-area, vaadin-combo-box, vaadin-select, vaadin-checkbox, vaadin-date-picker, vaadin-integer-field, vaadin-number-field, vaadin-big-decimal-field, vaadin-upload, jmix-file-upload-field, jmix-value-picker, vaadin-multi-select-combo-box, vaadin-details-summary, vaadin-tab')]
  .filter(f => !f.closest('[slot=drawer]'))
  .map(f => `${f.localName} | ${f.label || f.getAttribute('label') || (f.innerText || '').trim().slice(0, 60)} | value=${JSON.stringify(f.value ?? f.checked ?? '').slice(0, 120)}${f.required ? ' | required' : ''}${f.readonly ? ' | readonly' : ''}`));

const report = {};
for (const r of ROUTES) {
  const key = r.replace(/\//g, '_');
  const rec = report[r] = {};
  try {
    await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    rec.url = page.url();
    rec.text = await mainText();
    rec.buttons = await buttons();
    await page.screenshot({ path: `${OUT}/${key}-list.png`, fullPage: true });
    // открыть первую строку
    const cell = await page.$('vaadin-grid vaadin-grid-cell-content');
    if (cell) {
      const rows = await page.$$('vaadin-grid vaadin-grid-cell-content');
      // первая ячейка данных: пропускаем заголовки — ищем ячейку внутри tbody
      const target = await page.evaluateHandle(() => {
        const g = document.querySelector('vaadin-grid');
        if (!g) return null;
        const tb = g.shadowRoot.querySelector('#items tr:not([hidden]) td');
        if (!tb) return null;
        const slot = tb.querySelector('slot');
        return slot ? slot.assignedElements()[0] : null;
      });
      const el = target.asElement();
      if (el) {
        await el.dblclick();
        await page.waitForTimeout(2500);
        rec.detailUrl = page.url();
        rec.detailText = await mainText();
        rec.detailButtons = await buttons();
        rec.detailFields = await fields();
        await page.screenshot({ path: `${OUT}/${key}-detail.png`, fullPage: true });
      }
    }
  } catch (e) { rec.error = String(e).slice(0, 300); }
  console.log(`\n==================== ${r} ====================`);
  console.log(JSON.stringify(rec, null, 1).slice(0, 6000));
}
writeFileSync(`${OUT}/blanks-live.json`, JSON.stringify(report, null, 1));
await ctx.close();
