// Verify «Счет погашения» picker on loan-credits/25 (tab «Общая информация»).
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-credits/25', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);

// ensure we're on the first tab
await page.evaluate(() => {
  const t = [...document.querySelectorAll('vaadin-tab')].find(t => t.textContent.trim() === 'Общая информация');
  if (t) t.click();
});
await page.waitForTimeout(1500);

// find the jmix-value-picker whose label is «Счет погашения» and click its icon
const found = await page.evaluate(() => {
  const clean = s => (s||'').replace(/\s+/g,' ').trim();
  const pickers = [...document.querySelectorAll('jmix-value-picker')].filter(e => e.getBoundingClientRect().width>0);
  const labels = pickers.map(p => clean(p.getAttribute('label') || p.querySelector('label')?.textContent));
  const idx = labels.findIndex(l => l === 'Счет погашения');
  return { labels, idx };
});
log('PICKER LABELS:', JSON.stringify(found.labels));
if (found.idx < 0) { log('ERROR: «Счет погашения» picker not found'); await ctx.close(); process.exit(1); }

const coords = await page.evaluate((idx) => {
  const pickers = [...document.querySelectorAll('jmix-value-picker')].filter(e => e.getBoundingClientRect().width>0);
  const p = pickers[idx];
  const icon = p.querySelector('vaadin-icon[slot=icon]') || p.querySelector('vaadin-icon') || p.querySelector('vaadin-button');
  const r = icon.getBoundingClientRect();
  p.scrollIntoView({block:'center'});
  return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
}, found.idx);

// re-read coords after scroll
const coords2 = await page.evaluate((idx) => {
  const pickers = [...document.querySelectorAll('jmix-value-picker')].filter(e => e.getBoundingClientRect().width>0);
  const p = pickers[idx];
  const icon = p.querySelector('vaadin-icon[slot=icon]') || p.querySelector('vaadin-icon') || p.querySelector('vaadin-button');
  const r = icon.getBoundingClientRect();
  return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
}, found.idx);
await page.mouse.click(coords2.x, coords2.y);
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const clean = s => (s||'').replace(/\s+/g,' ').trim();
  const ov = [...document.querySelectorAll('vaadin-dialog-overlay')].pop();
  if (!ov) return { err: 'no overlay' };
  const title = clean(ov.getAttribute('header-title') || ov.querySelector('[slot=title],h2,h3')?.textContent);
  const g = ov.querySelector('vaadin-grid');
  const cols = g ? [...g.querySelectorAll('vaadin-grid-column')].map(c => clean(c.getAttribute('header') || c.getAttribute('path'))) : [];
  const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c => ({t:clean(c.textContent), y:Math.round(c.getBoundingClientRect().top), x:Math.round(c.getBoundingClientRect().left)})).filter(c=>c.t);
  const btns = [...ov.querySelectorAll('vaadin-button')].map(b => clean(b.textContent)).filter(Boolean);
  const fullText = clean(ov.textContent).slice(0,600);
  const pager = (ov.textContent.match(/\d+\s+строк[аи]?/)||[''])[0];
  return { title, cols, cells, btns, fullText, pager };
});

log('\n===== MODAL DUMP =====');
log('TITLE:', dump.title);
log('COLUMNS:', JSON.stringify(dump.cols));
log('BUTTONS:', JSON.stringify(dump.btns));
log('PAGER:', dump.pager);
// group cells into rows by y
if (dump.cells) {
  const byRow = new Map();
  for (const c of dump.cells) { if(!byRow.has(c.y)) byRow.set(c.y,[]); byRow.get(c.y).push(c); }
  const rows = [...byRow.entries()].sort((a,b)=>a[0]-b[0]).map(([y,cs])=>cs.sort((a,b)=>a.x-b.x).map(c=>c.t));
  log('ROWS:', JSON.stringify(rows));
}
log('FULLTEXT:', dump.fullText);

await page.screenshot({ path: '.auth/field-schet.png', fullPage: true });
log('\nScreenshot -> .auth/field-schet.png');
await ctx.close();
