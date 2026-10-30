// Выписка каталога плиток из макета mockups/dashboard/dashboard.html для сверки перечня плиток
// (scripts/build_perechen_plitok.py). Движок макета исполняется в node:vm, как в смоуке
// scripts/inspect/dashboard-check.mjs; печатается JSON: плитки каталога, их отчёты, очереди и
// объявленные раскладки ролей.
//   node scripts/perechen_plitok_maket.mjs [dashboard.html]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML = process.argv[2] || resolve(__dir, '../mockups/dashboard/dashboard.html');
const m = readFileSync(HTML, 'utf8').match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
vm.runInContext(m[1], vm.createContext({ window: win, console, setTimeout: () => {}, clearTimeout: () => {} }));
const DB = win.DB;
if (!DB) { console.error('window.DB не экспортирован'); process.exit(1); }

// у главного числа-доли по разрезу («pct») второе число — «N из M», даже без своего second
const tiles = DB.TILES.filter(t => t.owner === 'catalog').map(t => ({
  id: t.id, title: t.title, kind: t.kind, report: t.report || null,
  queue: t.kind === 'link' ? DB.queueById(t.queue).name : null,
  second: !!(t.second || (t.main && t.main.pct)), tl: t.tl || null,
  shift: t.kind === 'link' ? null : (t.noShift ? 'none' : t.shift || 'none'),
  views: Object.keys(t.views || {}),
  params: t.kind === 'link' ? null : DB.paramChips(t).join(' · ') }));
const reports = [...new Set(tiles.map(t => t.report).filter(Boolean))].map(id => {
  const r = DB.reportById(id); return { id, title: r.title }; });
const layouts = Object.keys(DB.DECLARED_SEED).map(rid => {
  const items = []; let section = null;
  for (const x of DB.DECLARED_SEED[rid]) { if (x.startsWith('s:')) section = x.slice(2); else items.push({ section, tile: x }); }
  return { role: DB.ROLES.find(r => r.id === rid).name, items }; });
console.log(JSON.stringify({ tiles, reports, layouts }));
