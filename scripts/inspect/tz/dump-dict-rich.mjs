// scripts/inspect/tz/dump-dict-rich.mjs
// 1:1 inspector for ASUBK "Справочник" screens — captures EXACT columns, rows,
// total, grid density (body font-size + measured row height), R/S archetype
// (presence of «Просмотр»), toolbar, and screenshot. Serialized single browser
// (one login) — DO NOT parallelize: launchPersistentContext locks the profile.
//
// Usage:
//   node scripts/inspect/tz/dump-dict-rich.mjs <route1> [route2] ...
//   node scripts/inspect/tz/dump-dict-rich.mjs --file .auth/dict-routes.txt
// Output: .auth/dict-rich/<route>.json + <route>.png, plus _all.json.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = process.env.OK_PROFILE || '.auth/profile';

let routes = [];
const args = process.argv.slice(2);
if (args[0] === '--file') routes = readFileSync(args[1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
else routes = args.map(s => s.replace(/^\//, ''));
if (!routes.length) { console.error('no routes'); process.exit(1); }

mkdirSync('.auth/dict-rich', { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
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
    await page.waitForTimeout(2000);
    const rec = await page.evaluate(() => {
      function* walkAll(root) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let n = w.nextNode();
        while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
      }
      const txt = el => (el.textContent || '').trim().replace(/\s+/g, ' ');
      const uniq = a => [...new Set(a.filter(Boolean))];
      function deepFind(pred) { for (const el of walkAll(document)) if (pred(el)) return el; return null; }
      const tagIs = t => (el => el.tagName.toLowerCase() === t);

      // ── title + toolbar ──
      const headings = [], buttons = [];
      for (const el of walkAll(document)) {
        const tag = el.tagName.toLowerCase();
        if (/^h[1-3]$/.test(tag) || el.classList?.contains('jmix-main-view-title')) { const t = txt(el); if (t && t.length < 120) headings.push(t); }
        if (tag === 'vaadin-button' || tag === 'button') { const t = txt(el); if (t && t.length < 50) buttons.push(t); }
      }
      const toolbarButtons = uniq(buttons).slice(0, 30);
      const hasView = toolbarButtons.some(b => /просмотр|показать|view/i.test(b));

      // ── grid cells → header vs body by geometry ──
      const grid = deepFind(tagIs('vaadin-grid'));
      let columns = [], rows = [], gridBody = null, gridHeader = null, rowHeight = null, bodyFont = null;
      if (grid) {
        const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')]
          .map(c => ({ t: txt(c), r: c.getBoundingClientRect(), el: c }))
          .filter(c => c.r.width > 0 && c.r.height > 0);
        // cluster by rounded y into rows
        const byY = new Map();
        for (const c of cells) { const k = Math.round(c.r.y / 4) * 4; if (!byY.has(k)) byY.set(k, []); byY.get(k).push(c); }
        const rowsByY = [...byY.entries()].sort((a, b) => a[0] - b[0])
          .map(([y, cs]) => ({ y, cells: cs.sort((a, b) => a.r.x - b.r.x) }));
        if (rowsByY.length) {
          const headerRow = rowsByY[0];
          columns = headerRow.cells.map(c => c.t).filter(Boolean);
          const bodyRows = rowsByY.slice(1).filter(r => r.cells.some(c => c.t));
          rows = bodyRows.map(r => r.cells.map(c => c.t));
          // density from a representative body cell
          if (bodyRows.length) {
            const sample = bodyRows[0].cells[0]?.el;
            if (sample) {
              const s = getComputedStyle(sample);
              bodyFont = s.fontSize;
              // measured row height: y-delta between first two body rows, else cell rect height
              rowHeight = bodyRows.length > 1
                ? Math.round(bodyRows[1].y - bodyRows[0].y) + 'px'
                : Math.round(bodyRows[0].cells[0].r.height) + 'px';
            }
            const hs = bodyRows[0].cells[0]?.el && getComputedStyle(headerRow.cells[0].el);
            gridHeader = hs ? { fontSize: hs.fontSize, fontWeight: hs.fontWeight, color: hs.color } : null;
            gridBody = { fontSize: bodyFont, rowHeight };
          }
        }
      }

      // ── total from pagination text («1-8 из 96», «96 строк», «Кол-во строк: 96») ──
      let totalText = null, total = null;
      for (const el of walkAll(document)) {
        const t = txt(el);
        const m = t.match(/(?:из|of)\s+(\d[\d\s]*)/i) || t.match(/^(\d[\d\s]*)\s*(?:строк|записей|rows)/i);
        if (m && t.length < 60) { totalText = t; total = parseInt(m[1].replace(/\s/g, ''), 10); break; }
      }
      if (total == null && rows.length) total = rows.length;

      return {
        title: document.title,
        h: uniq(headings).slice(0, 6),
        toolbarButtons, hasView,
        archetype: hasView ? 'R' : 'S',
        columns, rows, total, totalText,
        rowsShown: rows.length,
        gridBody, gridHeader,
        hasGrid: !!grid,
      };
    });
    rec.route = route;
    rec.url = page.url();
    all.push(rec);
    writeFileSync(`.auth/dict-rich/${route.replace(/\W+/g, '_')}.json`, JSON.stringify(rec, null, 1));
    await page.screenshot({ path: `.auth/dict-rich/${route.replace(/\W+/g, '_')}.png`, fullPage: false }).catch(() => {});
    console.log(`[ok] ${route} :: ${rec.h[0] || rec.title} | ${rec.archetype} cols=${rec.columns.length} rows=${rec.rowsShown}/${rec.total} font=${rec.gridBody?.fontSize} rowH=${rec.gridBody?.rowHeight}`);
  } catch (e) {
    const rec = { route, error: String(e).slice(0, 160) };
    all.push(rec);
    console.log(`[ERR] ${route} :: ${String(e).slice(0, 100)}`);
  }
  writeFileSync('.auth/dict-rich/_all.json', JSON.stringify(all, null, 1));
}
console.log(`\ndone: ${all.length} routes`);
await ctx.close();
