// Собирает страницу-артефакт «Плитки дашборда» из макета mockups/dashboard/dashboard.html.
// Каждая плитка отрисована движком макета (тот же tileHTML, что на главной), рядом — паспорт её вопроса к
// статистике по шагам конструктора (канон §3.1), где она стоит, решения ДБ-* и поля замечаний.
// Замечания живут не в файле, а в хранилище артефакта (capability db, коллекция `notes`, документ = id плитки;
// общие — `notes/_general`): их читает Claude через ArtifactData и переносит в следующую волну макета.
//
// Артефакт опубликован один раз; после правки макета пересобрать и опубликовать В ТОТ ЖЕ адрес (url ниже),
// иначе замечания останутся у старой страницы.
//   ARTIFACT_URL: https://claude.ai/artifact/HXv2suq9JQ1YhKkAzLXYob
//
//   node scripts/build_dashboard_tiles.mjs        -> mockups/dashboard/tiles-review.html
//
// Шаблон страницы — scripts/build_dashboard_tiles.tpl.html. Числа — синтетические данные стенда макета
// (11.10.2026 14:15). Плитки эпизодов просрочки и движения клиентов показаны «после готовности соседа»:
// в макете они стоят черновиками, здесь включены ворота STAND.spells и STAND.clientFlows.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const MOCK = resolve(ROOT, 'mockups/dashboard/dashboard.html');
const CANON = resolve(ROOT, 'mockups/dashboard/ASUBK-dashbord-logika.md');
const STATUS = resolve(ROOT, 'mockups/dashboard/ASUBK-status-razrabotki.md');
const TPL = resolve(__dir, 'build_dashboard_tiles.tpl.html');
const OUT = resolve(ROOT, 'mockups/dashboard/tiles-review.html');

/* ---------- движок макета: тот же код, что в браузере, плюс доступ к рисованию плитки ---------- */
const src = readFileSync(MOCK, 'utf8');
const css = src.match(/<style>([\s\S]*?)<\/style>/)[1];
let js = src.match(/<script>([\s\S]*?)<\/script>/)[1];
const HOOK = 'const api = {';
if (!js.includes(HOOK)) { console.error('В макете не найден `const api = {` — генератор не может достать tileHTML'); process.exit(1); }
js = js.replace(HOOK, HOOK + ' tileHTML, ctxOf, scopeText, DATE_MODES, STOCK_BASES, ');
const win = {};
vm.runInContext(js, vm.createContext({ window: win, console, setTimeout: () => {}, clearTimeout: () => {} }), { filename: 'dashboard.inline.js' });
const DB = win.DB;
DB.seed();
DB.STAND.spells = true;        // ядро отдаёт эпизоды просрочки (P20-R33)
DB.STAND.clientFlows = true;   // статистика отдаёт потоки счёта клиентов (ДБ-71)

/* ---------- решения канона: вопрос и ответ для подсказок ---------- */
const decisions = {};
const cell = s => s.replace(/`/g, '').replace(/\*\*/g, '').trim();
for (const line of readFileSync(CANON, 'utf8').split('\n')) {
  const m = line.match(/^\| (ДБ-\d+) \|([^|]*)\|([^|]*)\|/);
  if (m) decisions[m[1]] = { q: cell(m[2]), d: cell(m[3]) };
}
for (const line of readFileSync(STATUS, 'utf8').split('\n')) {
  const m = line.match(/^- \*\*(ДБ-Д\d+) · ([^*]+?)\.?\*\*\s*(.*)$/);
  if (m) decisions[m[1]] = { q: m[2].trim(), d: cell(m[3]).replace(/\*/g, '').slice(0, 220) };
}

// роль → решение о её стартовой раскладке (канон §13)
const ROLE_DEC = { lead: 'ДБ-40', cur: 'ДБ-41', prob: 'ДБ-42', acc: 'ДБ-43', zal: 'ДБ-44', spec: 'ДБ-45', com: 'ДБ-46',
  gof: 'ДБ-47', otd: 'ДБ-48', rep: 'ДБ-49', ast: 'ДБ-63', an: 'ДБ-50' };
// плитка → решения, которые её прямо называют (канон §3.10, §3.11, §13; дефекты волн — статус-файл)
const TILE_DEC = {
  'lead-borod': ['ДБ-65'], 'cur-borod': ['ДБ-65', 'ДБ-75'], 'cur-npay': ['ДБ-65'],
  'lead-odsh': ['ДБ-Д15'], 'cur-odsh': ['ДБ-Д15'],
  'lead-spin': ['ДБ-62'], 'lead-spcure': ['ДБ-62'], 'cur-spin': ['ДБ-62', 'ДБ-16'], 'cat-spopen': ['ДБ-62'], 'cat-spser': ['ДБ-62'],
  'lead-bodays': ['ДБ-74'], 'lead-bmove': ['ДБ-71', 'ДБ-74'], 'lead-bdebt': ['ДБ-82', 'ДБ-88'],
  'lead-issued': ['ДБ-Д12'], 'lead-odser': ['ДБ-Д13'], 'lead-prog': ['ДБ-91'], 'lead-progis': ['ДБ-91'],
  'lead-recov': ['ДБ-61'], 'prob-recov': ['ДБ-61'], 'prob-cases': ['ДБ-61'], 'prob-court': ['ДБ-61'], 'prob-exp': ['ДБ-61'],
  'lead-rs': ['ДБ-60'], 'lead-rslate': ['ДБ-60'], 'cur-rs': ['ДБ-60'], 'cur-rslate': ['ДБ-60'], 'cur-rsstage': ['ДБ-60'], 'cur-rsout': ['ДБ-60'],
  'lead-ast': ['ДБ-63'], 'lead-astod': ['ДБ-63'],
  'cur-obl': ['ДБ-86'], 'prob-nocon': ['ДБ-86'], 'prob-dead': ['ДБ-74', 'ДБ-76'],
  'cat-brep': ['ДБ-83'], 'cat-brepsh': ['ДБ-83'], 'cat-bhist': ['ДБ-84'],
  'cat-progn': ['ДБ-94'], 'cat-progsrc': ['ДБ-93'], 'cat-balsrc': ['ДБ-97'], 'spec-pend': ['ДБ-93', 'ДБ-96'],
  'lead-paid': ['ДБ-22'], 'cur-plan0': ['ДБ-22', 'ДБ-16'], 'cur-plan1': ['ДБ-22'], 'cat-plan': ['ДБ-22', 'ДБ-90'],
  'lead-heat': ['ДБ-17'], 'tasks': ['ДБ-50', 'ДБ-11'], 'p-u2-agro': ['ДБ-4', 'ДБ-28'],
};

/* ---------- где стоит плитка ---------- */
const ROLE = Object.fromEntries(DB.ROLES.map(r => [r.id, r]));
const placed = {};   // id -> [{role, section}]
for (const [r, L] of Object.entries(DB.DECLARED_SEED)) {
  let sec = '';
  for (const k of L) { if (k.startsWith('s:')) { sec = k.slice(2); continue; } (placed[k] = placed[k] || []).push({ role: r, section: sec }); }
}
const homeRole = t => (placed[t.id] ? placed[t.id][0].role : t.owner === 'catalog' ? 'an' : DB.USERS.find(u => u.id === t.owner).roles[0]);
const userOf = r => DB.USERS.find(u => u.roles.includes(r));

/* ---------- рисование плитки: как на главной, без обработчиков ---------- */
const strip = h => h.replace(/\s(onclick|onchange|ondragstart|draggable)="[^"]*"/g, '').replace(/\n\s+/g, '\n');
function render(t, r) {
  const u = userOf(r); DB.state.userId = u.id;
  const res = DB.ask(t, u, r, {});
  return { html: strip(DB.tileHTML(t, res, { roleId: r, key: t.id })), state: res.state, user: u };
}

/* ---------- паспорт вопроса ---------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AGG = { count: 'счёт', sum: 'сумма', max: 'наибольшее' };
const KIND = { stock: 'остаток на дату', flow: 'поток за период', event: 'событие за период' };
const DIR = { up_good: 'рост — хорошо', up_bad: 'рост — плохо', neutral: 'направление нейтральное' };
const UNIT = { sum: 'сом', pcs: 'шт.', days: 'дн.' };
const SIZE_TXT = { '1x1': '1×1', '2x1': '2×1', '2x2': '2×2' };
const indTxt = id => { const I = DB.IND[id]; return `${esc(I.name)} <span class="rv-m">${[AGG[I.agg], KIND[I.kind], UNIT[I.unit], DIR[I.dir]].join(' · ')}</span>`; };
const chips = list => list.map(x => `<span class="rv-cond">${esc(x)}</span>`).join('');

function timeTxt(t) {
  const ctx = DB.ctxOf(t);
  if (t.format === 'series') return `ряд: ${t.points || 12} точек, шаг — месяц; последняя точка — дата среза`;
  if (ctx.point) return `на дату: ${DB.DATE_MODES[t.date || 'today'].label}`;
  return `период: ${DB.PERIODS[ctx.period].label}${DB.PERIODS[ctx.period].partial ? ' <span class="rv-m">· неполный</span>' : ''}`;
}
function formatTxt(t) {
  const parts = [`${DB.FORMAT_NAMES[t.format]} · ${SIZE_TXT[DB.SIZE[t.format]]}`];
  if (t.format === 'slice') parts.push(`топ-${t.top || 3} + «ещё N», итог узлом`);
  if (t.format === 'move' && t.mvMonth === -1) parts.push('за прошлый месяц');
  if (t.format === 'move' && !t.mvMonth) parts.push('за текущий месяц');
  if (t.format === 'shift') {
    const ctx = DB.ctxOf(t);
    if (ctx.point) parts.push('сдвиг ' + DB.STOCK_BASES[t.shift || 'prevMonthEnd'].label);
    else parts.push(DB.PERIODS[ctx.period].partial ? 'сдвиг погашен: неполный период' : 'сдвиг к предыдущему такому же периоду');
  }
  return parts.join(' · ');
}
function gateTxt(t) {
  const I = DB.IND[t.inds[0]]; const O = DB.OBJECTS[I.obj];
  if (O.gate) return 'В макете стоит черновиком: ' + O.gateMsg + ' (P20-R33). Здесь показан вид после готовности.';
  if (t.format === 'move' && I.flowsGate) return 'В макете стоит черновиком: статистика ещё не отдаёт потоки счёта клиентов (дата погашения всего портфеля, месяц первого договора). Здесь показан вид после готовности.';
  if (O.wave > 1) return `Объект «${O.name}» объявляется статистикой в волне ${O.wave} — до неё плитка стоит черновиком.`;
  return '';
}
function decChip(id) {
  const d = decisions[id];
  const tip = d ? `${id} · ${d.q}: ${d.d}` : `${id} — нет в журнале решений канона`;
  return `<span class="rv-dec${d ? '' : ' missing'}" data-tip="${esc(tip)}">${esc(id)}</span>`;
}

function specHTML(t, r, u) {
  const I = DB.IND[t.inds[0]]; const O = DB.OBJECTS[I.obj];
  const rows = [];
  rows.push(['Объект', `${esc(O.name)} <span class="rv-m">· владелец «${esc(O.owner)}» · волна ${O.wave}</span>`]);
  let inds = `<ul class="rv-inds">${t.inds.map(i => `<li>${indTxt(i)}</li>`).join('')}</ul>`;
  if (t.share) {
    const a = DB.IND[t.share[0]].name, b = DB.IND[t.share[1]].name;
    inds += `<div class="rv-share">доля: ${t.numFilter ? `${esc(a)} с фильтром числителя / ${esc(b)}` : `${esc(a)} / ${esc(b)}`}</div>`;
  }
  rows.push(['Показатели', inds]);
  rows.push(['Разрезы', t.dims.length ? chips(t.dims.map(d => DB.DIMS[d].name)) : '<span class="rv-m">без разреза</span>']);
  let flt = t.filter.length ? chips(t.filter.map(DB.condText)) : '<span class="rv-m">без фильтра</span>';
  if (t.numFilter) flt += `<div class="rv-sub">фильтр числителя: ${chips(t.numFilter.map(DB.condText))}</div>`;
  rows.push(['Фильтр', flt]);
  rows.push(['Дата и период', timeTxt(t)]);
  rows.push(['Формат', esc(formatTxt(t))]);
  rows.push(['Светофор', t.tl ? esc(DB.tlText(t).replace(/^порог: /, '')) : '<span class="rv-m">нет</span>']);
  rows.push(['Подпись', DB.qualOf(t) ? esc(DB.qualOf(t)) : '<span class="rv-m">—</span>']);
  const q = `<ol class="rv-q">${rows.map(([k, v]) => `<li><span class="rv-k">${k}</span><div class="rv-v">${v}</div></li>`).join('')}</ol>`;

  const extra = [];
  extra.push(['Главный клик', t.kind === 'link'
    ? `очередь «${esc(t.queue.name)}» модуля «${esc(t.queue.module)}»`
    : `«Кто в этом числе» — строки объекта «${esc(O.name)}» на дату среза`]);
  extra.push(['Второе действие', t.kind === 'link' ? `«Кто в этом числе» · «Работать со списком» — ${esc(O.registry)}` : `«Работать со списком» — ${esc(O.registry)} с фильтром плитки`]);
  const where = (placed[t.id] || []).map(p => `${esc(ROLE[p.role].name)}${p.section ? ' › ' + esc(p.section) : ''}`);
  if (where.some(w => w.startsWith('Руководство'))) where.push('Аналитик (копия «Руководства»)');
  extra.push(['Где стоит', where.length ? where.join('<br>') : t.owner === 'catalog' ? 'только в каталоге — в стартовые раскладки не входит' : `личная плитка пользователя ${esc(u.name)}`]);
  extra.push(['Показана глазами', `${esc(u.name)} · роль «${esc(ROLE[r].name)}» · ${esc(DB.scopeText(u, r).replace(/^Охват роли: /, 'охват: '))}`]);
  const req = DB.reqOf(t);
  if (req.length) extra.push(['Заявки соседям', `<ul class="rv-req">${req.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`]);
  const gate = gateTxt(t);
  if (gate) extra.push(['Готовность', esc(gate)]);
  const decs = [...new Set([...(placed[t.id] || []).map(p => ROLE_DEC[p.role]), ...(TILE_DEC[t.id] || []),
    ...(t.share ? ['ДБ-19'] : []), ...(t.numFilter ? ['ДБ-70'] : []), ...(t.format === 'shift' ? ['ДБ-21'] : []), ...(t.tl ? ['ДБ-24'] : []), ...(t.kind === 'link' ? ['ДБ-7'] : [])])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  extra.push(['Решения', decs.map(decChip).join(' ')]);
  return q + `<dl class="rv-ex">${extra.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

/* ---------- сборка ---------- */
const tabsOrder = ['lead', 'cur', 'prob', 'acc', 'zal', 'spec', 'com', 'gof', 'otd', 'rep', 'ast'];
const tiles = {}; const order = []; const missing = new Set();
const seen = new Set();
const pushTile = id => { if (seen.has(id)) return; seen.add(id); order.push(id); };
tabsOrder.forEach(r => DB.DECLARED_SEED[r].filter(k => !k.startsWith('s:')).forEach(pushTile));
DB.TILES.forEach(t => pushTile(t.id));

for (const id of order) {
  const t = DB.tileById(id); const r = homeRole(t); const out = render(t, r);
  const I = DB.IND[t.inds[0]];
  (TILE_DEC[id] || []).forEach(d => { if (!decisions[d]) missing.add(d); });
  tiles[id] = {
    id, title: t.title, kind: t.kind, personal: t.owner !== 'catalog', format: t.format, formatName: DB.FORMAT_NAMES[t.format],
    size: DB.SIZE[t.format], obj: I.obj, objName: DB.OBJECTS[I.obj].name, state: out.state,
    roles: [...new Set((placed[id] || []).map(p => p.role))], home: r,
    group: placed[id] ? placed[id][0].role : t.owner !== 'catalog' ? 'own' : 'cat',
    search: [id, t.title, DB.OBJECTS[I.obj].name, ...t.inds.map(i => DB.IND[i].name), ...t.dims.map(d => DB.DIMS[d].name)].join(' ').toLowerCase(),
    html: out.html, spec: specHTML(t, r, out.user),
  };
}
const layouts = {};
for (const r of tabsOrder) {
  // html — только если глазами этой роли плитка выглядит иначе, чем в паспорте («Мои задания» у каждого свои)
  layouts[r] = DB.DECLARED_SEED[r].map(k => { if (k.startsWith('s:')) return { s: k.slice(2) };
    const html = render(DB.tileById(k), r).html; return html === tiles[k].html ? { id: k } : { id: k, html }; });
}
layouts.cat = order.filter(id => !tiles[id].personal && !placed[id]).map(id => ({ id }));
layouts.own = order.filter(id => tiles[id].personal).map(id => ({ id }));
const tabs = [...tabsOrder.map(r => ({ id: r, name: ROLE[r].name, user: userOf(r).name, scope: DB.scopeText(userOf(r), r), dec: ROLE_DEC[r] })),
  { id: 'cat', name: 'Каталог', user: userOf('an').name, scope: 'Плитки каталога сверх стартовых раскладок; показаны глазами аналитика (весь портфель)', dec: 'ДБ-30' },
  { id: 'own', name: 'Личные', user: 'Бекова А. Т.', scope: 'Личная плитка видна только автору (ДБ-4)', dec: 'ДБ-4' }];

const objects = [...new Set(order.map(id => tiles[id].obj))].map(o => ({ id: o, name: DB.OBJECTS[o].name }));
let rev = '';
try { rev = execSync('git log -1 --format=%h·%cs -- mockups/dashboard/dashboard.html', { cwd: ROOT }).toString().trim(); } catch { /* вне git */ }
const data = {
  meta: { rev, today: DB.TODAY.label, count: order.length, formats: DB.FORMAT_NAMES, sizes: DB.SIZE, objects },
  order, tiles, layouts, tabs, decisions: Object.fromEntries(Object.entries(decisions).filter(([k]) => /^ДБ-/.test(k))),
};

const json = JSON.stringify(data).replace(/</g, '\\u003c');
const tpl = readFileSync(TPL, 'utf8');
const page = tpl.replace('/*__MOCKUP_CSS__*/', () => css).replace('__DATA__', () => json);
writeFileSync(OUT, page);
const kb = Math.round(Buffer.byteLength(page) / 1024);
console.log(`${order.length} плиток, ${tabs.length} вкладок, ${Object.keys(decisions).length} решений → ${OUT.replace(ROOT + '/', '')} (${kb} КБ)`);
const notOk = order.filter(id => !['ok', 'zero'].includes(tiles[id].state));
if (notOk.length) console.log('Не ответили:', notOk.join(', '));
if (missing.size) { console.error('Решения без строки в журнале:', [...missing].join(', ')); process.exit(1); }
