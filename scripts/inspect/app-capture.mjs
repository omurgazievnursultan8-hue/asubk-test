// scripts/inspect/app-capture.mjs
import { chromium } from 'playwright-core';

const BASE  = 'https://fkftest.okmot.kg/';
const USER  = process.env.OK_USER || 'admin';
const PASS  = process.env.OK_PASS || 'admin';
const ROUTE = process.env.ROUTE  || 'loan-applications';
const OPEN  = process.env.OPEN   || '';            // JS eval'd in page after load
const SHOT  = process.env.SHOT   || 'app-capture';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
if (OPEN) { await page.evaluate(OPEN); await page.waitForTimeout(2000); }

log('URL:', page.url());

log('TOOLBAR:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim()).filter(Boolean))));

log('TABS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim()))));

log('COLUMNS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')]
    .map(c => (c.getAttribute('header') || c.path || c.innerText || '').trim())
    .filter(Boolean))));

log('GRID_HEADER_CELLS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-cell-content')]
    .map(c => c.innerText.trim()).filter(Boolean).slice(0, 60))));

// NOTE: STATCARDS regex is screen-specific (loan-applications). Extend the
// pattern below when reusing app-capture on other routes with summary tiles.
log('STATCARDS:', JSON.stringify(await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount > 3) return;
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
    if (/Всего заявок|На рассмотрении|Одобрено|Отклонено|Требуется доп/i.test(t) && t.length < 60) {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      out.push({ t, x: Math.round(r.left), y: Math.round(r.top),
        bg: cs.backgroundColor, border: cs.border, color: cs.color });
    }
  });
  return out;
})));

log('FIELDS:', JSON.stringify(await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];
  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) { const p = el.closest('vaadin-form-item'); const lab = p?.querySelector('[slot=label]'); if (lab) l = lab.innerText; }
    if (!l && el.shadowRoot) { const sr = el.shadowRoot.querySelector('[part=label]'); if (sr) l = sr.innerText; }
    return (l || '').replace(/\s+/g, ' ').trim() || null;
  };
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      const f = el.shadowRoot?.querySelector('[part="input-field"]');
      const cs = f ? getComputedStyle(f) : null;
      return { tag: el.tagName.toLowerCase(), label: labelOf(el),
        required: el.required === true || el.hasAttribute('required'),
        readonly: el.readonly === true || el.hasAttribute('readonly'),
        value: el.value ?? null,
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
        bg: cs?.backgroundColor || null, radius: cs?.borderRadius || null, border: cs?.border || null };
    });
})));

log('SECTIONS:', JSON.stringify(await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount) return;                       // leaf nodes only
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 60) return;
    const cs = getComputedStyle(e);
    const fw = parseInt(cs.fontWeight, 10) || 400;
    const fs = parseFloat(cs.fontSize) || 0;
    if (fw < 600 && fs < 17) return;                        // headings: bold or large
    out.push({ t, x: Math.round(r.left), y: Math.round(r.top), fw, fs: cs.fontSize });
  });
  return out;
})));

await page.screenshot({ path: `.auth/${SHOT}.png`, fullPage: true });
log('SHOT saved:', `.auth/${SHOT}.png`);
await ctx.close();
