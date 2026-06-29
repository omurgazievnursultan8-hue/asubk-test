// scripts/inspect/tz/dump-dict.mjs
// Rich inspector for ASUBK "Справочник" (dictionary) screens.
// For each route: data (title, toolbar, columns, sample rows, filter/pagination)
// + full CSS/spacing tokens (container, toolbar, buttons, grid header/body, badges).
//
// Usage:
//   node scripts/inspect/tz/dump-dict.mjs <route1> [route2] ...
//   node scripts/inspect/tz/dump-dict.mjs --file .auth/dict-routes.txt
// Output: .auth/dict/<route>.json (one per route) + .auth/dict/_all.json + screenshots.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

let routes = [];
const args = process.argv.slice(2);
if (args[0] === '--file') routes = readFileSync(args[1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
else routes = args.map(s => s.replace(/^\//, ''));
if (!routes.length) { console.error('no routes'); process.exit(1); }

mkdirSync('.auth/dict', { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

const all = [];
for (const route of routes) {
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1800);
    const data = await page.evaluate(() => {
      function* walkAll(root) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let n = w.nextNode();
        while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
      }
      const txt = el => (el.textContent || '').trim().replace(/\s+/g, ' ');
      const uniq = a => [...new Set(a.filter(Boolean))];
      // deep first-match by tag
      function deepFind(tag) { for (const el of walkAll(document)) if (el.tagName.toLowerCase() === tag) return el; return null; }
      function deepFindAll(tag) { const r = []; for (const el of walkAll(document)) if (el.tagName.toLowerCase() === tag) r.push(el); return r; }

      const headings = [], toolbarButtons = [], gridColumns = [];
      let hasFilter = false, hasPagination = false, gridCellRows = [];

      for (const el of walkAll(document)) {
        const tag = el.tagName.toLowerCase();
        if (/^h[1-3]$/.test(tag) || el.classList?.contains('jmix-main-view-title')) { const t = txt(el); if (t && t.length < 120) headings.push(t); }
        if (tag === 'vaadin-button' || tag === 'button') { const t = txt(el); if (t && t.length < 50) toolbarButtons.push(t); }
        if (tag === 'vaadin-grid-column' || tag === 'vaadin-grid-sort-column' || tag === 'vaadin-grid-filter-column') { const h = el.getAttribute('header') || el.getAttribute('path') || ''; if (h) gridColumns.push(h); }
        if (tag === 'jmix-filter' || tag === 'vaadin-text-field' && (el.getAttribute('placeholder')||'').match(/поиск|filter/i)) hasFilter = true;
        if (tag === 'vaadin-grid-pro' || tag === 'jmix-pagination' || el.classList?.contains('jmix-simple-pagination')) hasPagination = true;
      }
      // Grid rows: read vaadin-grid-cell-content grouped (header row first → columns; body → data)
      const cellEls = deepFindAll('vaadin-grid-cell-content').map(c => txt(c)).filter(c => c.length);
      // header cells (column names) usually appear; sample first 120 cell contents
      const cells = cellEls.slice(0, 200);

      // Row count: count grid rows if present
      const grid = deepFind('vaadin-grid');
      let approxRows = null;
      if (grid) { try { approxRows = grid.querySelectorAll('tr[part~="row"], tbody tr').length || null; } catch {} }

      return {
        title: document.title,
        h: uniq(headings).slice(0, 6),
        toolbarButtons: uniq(toolbarButtons).slice(0, 30),
        gridColumns: uniq(gridColumns).slice(0, 40),
        hasFilter, hasPagination,
        cellSample: cells,
        approxRows,
        hasGrid: !!grid,
      };
    });

    // CSS / spacing tokens
    const css = await page.evaluate(() => {
      function* walkAll(root) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let n = w.nextNode();
        while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
      }
      function deepFind(pred) { for (const el of walkAll(document)) if (pred(el)) return el; return null; }
      const cs = (el, props) => { if (!el) return null; const s = getComputedStyle(el); const o = {}; for (const p of props) o[p] = s.getPropertyValue(p); return o; };
      const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; };

      const tagIs = t => (el => el.tagName.toLowerCase() === t);
      const layout = deepFind(el => el.classList?.contains('jmix-view-root') || el.tagName.toLowerCase() === 'vaadin-vertical-layout');
      const title = deepFind(el => el.classList?.contains('jmix-main-view-title') || /^h[12]$/.test(el.tagName.toLowerCase()));
      const btnPrimary = deepFind(el => el.tagName.toLowerCase() === 'vaadin-button' && (el.getAttribute('theme')||'').includes('primary'));
      const btnAny = deepFind(tagIs('vaadin-button'));
      const grid = deepFind(tagIs('vaadin-grid'));
      // header cell vs body cell: vaadin-grid-cell-content within thead/tbody
      let headerCell = null, bodyCell = null;
      if (grid) {
        const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')];
        // header cells are rendered in light DOM but assigned to header slots; pick first 2 distinct y
        if (cells.length) { headerCell = cells[0]; bodyCell = cells.find(c => c.getBoundingClientRect().y > cells[0].getBoundingClientRect().y + 5) || cells[1] || null; }
      }
      const badge = deepFind(el => (el.getAttribute?.('theme')||'').includes('badge') || el.classList?.contains('badge'));
      const toolbar = btnAny ? btnAny.parentElement : null;

      const FONT = ['font-family','font-size','font-weight','line-height','color'];
      const BOX = ['padding','margin','gap','height','min-height','background-color','border','border-radius','box-shadow'];
      return {
        rootBg: cs(document.body, ['background-color','font-family','font-size']),
        layout: { style: cs(layout, ['padding','gap','background-color']), box: box(layout) },
        title: { tag: title?.tagName?.toLowerCase(), style: cs(title, FONT.concat(['margin','padding'])) },
        toolbar: { style: cs(toolbar, ['gap','padding','margin','display','justify-content']), box: box(toolbar) },
        buttonPrimary: { theme: btnPrimary?.getAttribute('theme'), style: cs(btnPrimary, FONT.concat(BOX)), box: box(btnPrimary) },
        buttonAny: { theme: btnAny?.getAttribute('theme'), style: cs(btnAny, FONT.concat(BOX)), box: box(btnAny) },
        grid: { style: cs(grid, ['font-size','font-family','border','--lumo-size-m']), box: box(grid) },
        gridHeaderCell: { style: cs(headerCell, FONT.concat(['background-color','padding','height','border-bottom'])), box: box(headerCell) },
        gridBodyCell: { style: cs(bodyCell, FONT.concat(['background-color','padding','height','border-bottom'])), box: box(bodyCell) },
        badge: badge ? { theme: badge.getAttribute('theme'), text: (badge.textContent||'').trim().slice(0,30), style: cs(badge, FONT.concat(['background-color','padding','border-radius'])) } : null,
      };
    });

    const rec = { route, url: page.url(), ...data, css };
    all.push(rec);
    writeFileSync(`.auth/dict/${route.replace(/\W+/g, '_')}.json`, JSON.stringify(rec, null, 1));
    await page.screenshot({ path: `.auth/dict/${route.replace(/\W+/g, '_')}.png`, fullPage: false }).catch(() => {});
    console.log(`[ok] ${route} :: ${data.h[0] || data.title} | cols=${data.gridColumns.length} rows~${data.approxRows} btns=[${data.toolbarButtons.join(',')}]`);
  } catch (e) {
    const rec = { route, error: String(e).slice(0, 120) };
    all.push(rec);
    console.log(`[ERR] ${route} :: ${String(e).slice(0, 80)}`);
  }
  writeFileSync('.auth/dict/_all.json', JSON.stringify(all, null, 1));
}
writeFileSync('.auth/dict/_all.json', JSON.stringify(all, null, 1));
console.log(`\ndone: ${all.length} routes`);
await ctx.close();
