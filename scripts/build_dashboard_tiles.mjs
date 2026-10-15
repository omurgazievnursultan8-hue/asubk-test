// Собирает страницу-артефакт «Плитки дашборда» из макета mockups/dashboard/dashboard.html.
// Каждая плитка отрисована движком макета (тот же tileHTML, что на главной), рядом — паспорт: отчёт, на который она
// ссылается, значения параметров, главное и второе число, умолчания пяти видов (канон §3, §5), где она стоит,
// решения ДБ-* и поля замечаний.
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
js = js.replace(HOOK, HOOK + ' rawTileHTML: tileHTML, rawClickOf: clickOf, ctxOf, scopeText, DATE_MODES, STOCK_BASES, viewsFor, viewSel, srcOf, numSpec, VIEW_NAMES, queueOf, tlOn, mainQ, SHARE_COL, ');
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
// С волны 6 плитки, отличавшиеся только видом, слиты (ДБ-125): решения слитых плиток стоят на плитке-основе.
const TILE_DEC = {
  'lead-borr': ['ДБ-65', 'ДБ-71', 'ДБ-74', 'ДБ-82', 'ДБ-83', 'ДБ-84', 'ДБ-88'], 'cur-borod': ['ДБ-65', 'ДБ-75'], 'cur-npay': ['ДБ-65'],
  'lead-od': ['ДБ-Д13', 'ДБ-Д15'], 'cur-od': ['ДБ-Д15'],
  'lead-spin': ['ДБ-62'], 'lead-spcure': ['ДБ-62'], 'cur-spin': ['ДБ-62', 'ДБ-16'], 'cat-spopen': ['ДБ-62'],
  'lead-issued': ['ДБ-Д12'],
  'lead-recov': ['ДБ-61'], 'prob-recov': ['ДБ-61'], 'prob-cases': ['ДБ-61'], 'prob-court': ['ДБ-61'], 'prob-exp': ['ДБ-61'],
  'lead-rs': ['ДБ-60'], 'cur-rs': ['ДБ-60'], 'cur-rsout': ['ДБ-60'],
  'lead-ast': ['ДБ-63'], 'lead-astod': ['ДБ-63'],
  'cur-obl': ['ДБ-86'], 'prob-nocon': ['ДБ-86'], 'prob-dead': ['ДБ-74', 'ДБ-76'],
  'cat-brepsh': ['ДБ-83'],
  'cat-progn': ['ДБ-91', 'ДБ-93', 'ДБ-94', 'ДБ-97'], 'spec-pend': ['ДБ-93', 'ДБ-96'],
  'lead-paid': ['ДБ-22'], 'cur-plan0': ['ДБ-22', 'ДБ-16'], 'cur-plan1': ['ДБ-22'], 'cat-plan': ['ДБ-22', 'ДБ-90'],
  'tasks': ['ДБ-50', 'ДБ-11'], 'p-u2-agro': ['ДБ-4', 'ДБ-28'],
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
  return { html: strip(DB.rawTileHTML(t, res, { roleId: r, key: t.id })), state: res.state, user: u };
}

/* ---------- паспорт плитки: ссылка на отчёт (канон §3), основа и пять видов (§5) ---------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AGG = { count: 'счёт', sum: 'сумма', max: 'наибольшее' };
const KIND = { stock: 'остаток на дату', flow: 'поток за период', event: 'событие за период' };
const DIR = { up_good: 'рост — хорошо', up_bad: 'рост — плохо', neutral: 'направление нейтральное' };
const UNIT = { sum: 'сом', pcs: 'шт.', days: 'дн.' };
const indName = id => (DB.IND[id] ? DB.IND[id].name : id === DB.SHARE_COL ? 'Доля' : id);
const indTxt = id => { const I = DB.IND[id]; return `${esc(I.name)} <span class="rv-m">${[AGG[I.agg], KIND[I.kind], UNIT[I.unit], DIR[I.dir]].join(' · ')}</span>`; };
const chips = list => list.map(x => `<span class="rv-cond">${esc(x)}</span>`).join('');
const srcObj = src => src.obj || DB.IND[src.inds[0]].obj;
const repKey = t => (t.kind === 'link' ? 'q:' + t.queue : t.report);

// значение параметра: «все», «я», «сегодня ± N», период или режим даты
function paramVal(v) {
  if (v === '*') return 'все';
  if (v === '@me') return 'я';
  const m = /^@today([+-]\d+)$/.exec(String(v));
  if (m) return `сегодня ${m[1][0] === '+' ? '+' : '−'} ${m[1].slice(1)} дн.`;
  return DB.PERIODS[v] ? DB.PERIODS[v].label : DB.DATE_MODES[v] ? DB.DATE_MODES[v].label : String(v);
}
const PARAM_DEFAULT = { date: 'today', period: 'curMonth' };
const OP_TXT = { le: '≤ ', ge: '≥ ' };
function paramsTxt(t, src) {
  if (t.kind === 'link') return '<span class="rv-m">очередь владельца — своих параметров нет</span>';
  const rows = Object.entries(src.params).map(([n, d]) => {
    const set = t.params && t.params[n] !== undefined;
    const v = set ? t.params[n] : (PARAM_DEFAULT[n] || '*');
    return `${esc(d.name)}: <b>${esc((OP_TXT[d.op] || '') + paramVal(v))}</b>${set ? '' : ' <span class="rv-m">· по умолчанию</span>'}`;
  });
  return rows.length ? `<div>${rows.join('</div><div>')}</div>` : '<span class="rv-m">отчёт параметров не объявил</span>';
}

function numTxt(t, which, src) {
  const sp = DB.numSpec(t, which, src);
  if (!sp) return '<span class="rv-m">нет</span>';
  if (sp.share) return `доля: ${esc(indName(sp.share[0]))} / ${esc(indName(sp.share[1]))}`;
  if (sp.pct) return `${indTxt(sp.inds[0])}<div class="rv-share">«% от итога группы»: ячейки ${esc(sp.pct.cells.join(' · '))} разреза «${esc(DB.DIMS[sp.pct.dim].name)}»</div>`;
  return indTxt(sp.inds[0]);
}
function timeTxt(t) {
  const q = DB.mainQ(t), ctx = DB.ctxOf(q);
  if (ctx.point) return `на дату: ${esc(DB.DATE_MODES[q.date || 'today'].label)}`;
  const P = DB.PERIODS[ctx.period];
  return `период: ${esc(P.label)}${P.partial ? ' <span class="rv-m">· неполный</span>' : ''}`;
}
function shiftTxt(t) {
  if (!t.shift) return '<span class="rv-m">нет</span>';
  const ctx = DB.ctxOf(DB.mainQ(t));
  if (ctx.point) return DB.STOCK_BASES[t.shift] ? esc('сдвиг ' + DB.STOCK_BASES[t.shift].label) : esc('сдвиг: ' + t.shift);
  return DB.PERIODS[ctx.period].partial ? 'сдвиг погашен: неполный период не с чем честно сравнить' : 'сдвиг к предыдущему такому же периоду';
}
const VIEW_TXT = {
  series: s => `${s.points} точек, шаг — месяц${s.of === 'second' ? ' · по второму числу' : ''}`,
  slice: s => `«${DB.DIMS[s.dim].name}» · топ-${s.top} + «ещё N»`,
  map: s => s.dims.map(d => '«' + DB.DIMS[d].name + '»').join(' × '),
  move: s => (s.month ? 'прошлый месяц' : 'текущий месяц'),
  table: s => `строки «${DB.DIMS[s.dim].name}» · колонки: ${s.cols.map(indName).join(', ')}`,
};
// умолчания пяти видов (ДБ-127): что полоса покажет при первом раскрытии, и почему вид погашен
function viewsTxt(t, u, r) {
  const li = DB.viewsFor(t, u, r, [], {}).map(v => {
    const name = esc(DB.VIEW_NAMES[v.kind]);
    if (!v.ok) return `<li class="off"><b>${name}</b> <span class="rv-m">погашен: ${esc(v.why)}</span></li>`;
    return `<li><b>${name}</b> <span class="rv-m">${esc(VIEW_TXT[v.kind](DB.viewSel(t, v.kind, {}, u, [], {})))}</span></li>`;
  });
  return `<ul class="rv-views">${li.join('')}</ul>`;
}
function clickTxt(t, u, r, O) {
  const c = DB.rawClickOf(t, u, r, {});
  if (c.act === 'queue') { const qo = DB.queueOf(t); return `очередь «${esc(qo.name)}» модуля «${esc(qo.module)}»`; }
  if (c.act === 'view') return `раскрывает полосу видом «${esc(DB.VIEW_NAMES[c.kind])}» — последним выбранным, у новой плитки Разрез`;
  return 'вид раскрыть нечем — открывается список';
}
function gateTxt(t, src) {
  const I = DB.IND[DB.numSpec(t, 'main', src).inds[0]]; const O = DB.OBJECTS[srcObj(src)];
  if (O.gate) return 'В макете стоит черновиком: ' + O.gateMsg + ' (P20-R33). Здесь показан вид после готовности.';
  if (I.flowsGate) return 'Вид «Движение» в макете погашен: статистика ещё не отдаёт потоки счёта клиентов. Здесь показан вид после готовности.';
  return '';
}
function decChip(id) {
  const d = decisions[id];
  const tip = d ? `${id} · ${d.q}: ${d.d}` : `${id} — нет в журнале решений канона`;
  return `<span class="rv-dec${d ? '' : ' missing'}" data-tip="${esc(tip)}">${esc(id)}</span>`;
}

function specHTML(t, r, u) {
  const src = DB.srcOf(t), link = t.kind === 'link', O = DB.OBJECTS[srcObj(src)];
  const rows = [];
  rows.push([link ? 'Очередь модуля' : 'Отчёт', link
    ? `«${esc(src.name)}» <span class="rv-m">· модуль «${esc(src.module)}» · вопрос объявляет владелец очереди</span>`
    : `${esc(src.title)} <span class="rv-m">· <code>${esc(src.id)}</code> · версия ${src.version} · полка «${esc(src.shelf)}»${src.state !== 'active' ? ' · ' + esc(src.state) : ''}</span>`]);
  rows.push(['Объект', `${esc(O.name)} <span class="rv-m">· владелец «${esc(O.owner)}» · волна ${O.wave}</span>`]);
  rows.push(['Показатели', `<ul class="rv-inds">${(src.cols || src.inds).map(i => `<li>${indTxt(i)}</li>`).join('')}</ul>`]);
  rows.push(['Разрезы', src.dims.length ? chips(src.dims.map(d => DB.DIMS[d].name)) : '<span class="rv-m">без разреза</span>']);
  rows.push(['Фильтр', src.filter.length ? chips(src.filter.map(DB.condText)) : '<span class="rv-m">без фильтра</span>']);
  rows.push(['Значения параметров', paramsTxt(t, src)]);
  rows.push(['Главное число', numTxt(t, 'main', src)]);
  rows.push(['Второе число', t.second ? `${numTxt(t, 'second', src)}${t.second.label ? `<div class="rv-sub">подпись: «${esc(t.second.label)}»</div>` : ''}` : '<span class="rv-m">нет</span>']);
  rows.push(['Дата и период', timeTxt(t)]);
  rows.push(['Сдвиг', shiftTxt(t)]);
  rows.push(['Светофор', t.tl ? esc(DB.tlText(t).replace(/^порог: /, '')) + (DB.tlOn(t) === 'second' ? ' <span class="rv-m">· по второму числу</span>' : '') : '<span class="rv-m">нет</span>']);
  rows.push(['Подпись', DB.qualOf(t) ? esc(DB.qualOf(t)) : '<span class="rv-m">—</span>']);
  const q = `<ol class="rv-q">${rows.map(([k, v]) => `<li><span class="rv-k">${k}</span><div class="rv-v">${v}</div></li>`).join('')}</ol>`;

  const extra = [];
  extra.push(['Пять видов', viewsTxt(t, u, r)]);
  extra.push(['Главный клик', clickTxt(t, u, r)]);
  extra.push(['Второе действие', `«Кто в этом числе» — значок ☰ в шапке; «Работать со списком» — ${esc(O.registry)} с фильтром отчёта и параметрами плитки`]);
  const where = (placed[t.id] || []).map(p => `${esc(ROLE[p.role].name)}${p.section ? ' › ' + esc(p.section) : ''}`);
  if (where.some(w => w.startsWith('Руководство'))) where.push('Аналитик (копия «Руководства»)');
  extra.push(['Где стоит', where.length ? where.join('<br>') : t.owner === 'catalog' ? 'только в каталоге — в стартовые раскладки не входит' : `личная плитка пользователя ${esc(u.name)}`]);
  extra.push(['Показана глазами', `${esc(u.name)} · роль «${esc(ROLE[r].name)}» · ${esc(DB.scopeText(u, r).replace(/^Охват роли: /, 'охват: '))}`]);
  if (!link && src.circle && !src.circle.all) extra.push(['Круг отчёта', `ограничен владельцем отчёта (${esc(DB.USERS.find(x => x.id === src.circle.owner)?.name || src.circle.owner)}) — остальные видят замок`]);
  const req = DB.reqOf(t);
  if (req.length) extra.push(['Заявки соседям', `<ul class="rv-req">${req.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`]);
  const gate = gateTxt(t, src);
  if (gate) extra.push(['Готовность', esc(gate)]);
  const sp = DB.numSpec(t, 'main', src);
  const decs = [...new Set([...(placed[t.id] || []).map(p => ROLE_DEC[p.role]), ...(TILE_DEC[t.id] || []),
    link ? 'ДБ-108' : 'ДБ-99', ...(link ? ['ДБ-120', 'ДБ-7'] : []),
    ...(t.second ? ['ДБ-116'] : []), ...(sp.share ? ['ДБ-19'] : []), ...(sp.pct ? ['ДБ-111'] : []),
    ...(t.shift ? ['ДБ-21'] : []), ...(t.tl ? ['ДБ-24'] : [])])]
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
  const src = DB.srcOf(t); const O = DB.OBJECTS[srcObj(src)];
  (TILE_DEC[id] || []).forEach(d => { if (!decisions[d]) missing.add(d); });
  tiles[id] = {
    id, title: t.title, kind: t.kind, personal: t.owner !== 'catalog', rep: repKey(t), repName: t.kind === 'link' ? 'Очередь «' + src.name + '»' : src.title,
    obj: srcObj(src), objName: O.name, state: out.state,
    roles: [...new Set((placed[id] || []).map(p => p.role))], home: r,
    group: placed[id] ? placed[id][0].role : t.owner !== 'catalog' ? 'own' : 'cat',
    search: [id, t.title, O.name, t.kind === 'link' ? src.name : src.title, ...(src.cols || src.inds).map(i => DB.IND[i].name), ...src.dims.map(d => DB.DIMS[d].name)].join(' ').toLowerCase(),
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
// отчёты (и очереди), на которые ссылаются плитки: один отчёт кормит несколько плиток (ДБ-114)
const reports = [...new Set(order.map(id => tiles[id].rep))].map(k => ({ id: k, name: tiles[order.find(id => tiles[id].rep === k)].repName, n: order.filter(id => tiles[id].rep === k).length }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
let rev = '';
try { rev = execSync('git log -1 --format=%h·%cs -- mockups/dashboard/dashboard.html', { cwd: ROOT }).toString().trim(); } catch { /* вне git */ }
const data = {
  meta: { rev, today: DB.TODAY.label, count: order.length, views: Object.values(DB.VIEW_NAMES), reports, objects },
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
const stale = Object.keys(TILE_DEC).filter(id => !tiles[id]);
if (stale.length) { console.error('TILE_DEC ссылается на плитки, которых нет в макете:', stale.join(', ')); process.exit(1); }
if (missing.size) { console.error('Решения без строки в журнале:', [...missing].join(', ')); process.exit(1); }
