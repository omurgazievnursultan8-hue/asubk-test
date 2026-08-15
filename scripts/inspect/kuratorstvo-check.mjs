// Headless смоук для mockups/kuratorstvo/kuratorstvo.html (ИУ-1…ИУ-14, ADR-0116…0118 + ADR-0023).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение движка, обеих ступеней, фолбэк-лестницы, шва и редакций, а не разметка.
// Блоки, которые правят состояние, начинаются с KU.seed() — состояние между ними не течёт.
//   node scripts/inspect/kuratorstvo-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/kuratorstvo/kuratorstvo.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'kuratorstvo.inline.js' });
const KU = win.KU;
if (!KU) { console.error('window.KU не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const nm = id => (KU.emp(id) || {}).name || String(id);
const TODAY = KU.state.today;
const on = (objId, roleId, d) => KU.curatorOn(objId, roleId, d || TODAY);

/* ---------- A. Каркас: виды, роли, правила холдинга ---------- */
(() => {
  KU.seed();
  const { KINDS, ROLES, DERIVED, ACCESS } = KU.dict;
  const badKind = ROLES.filter(r => !KU.kind(r.kind));
  ok(1, KINDS.length === 4 && ROLES.length === 5 && badKind.length === 0 &&
       !ROLES.some(r => r.id === DERIVED.id),
    `видов ${KINDS.length}, назначаемых ролей ${ROLES.length}, каждая при своём виде; «${DERIVED.name}» в списке назначаемых нет — ИУ-13, ИУ-14`);

  const sla = KINDS.map(k => k.id + ':' + k.sla).join(' ');
  ok(2, KU.kind('app').sla === 2 && KU.kind('claim').sla === 3 &&
       KU.kind('loan').sla === 5 && KU.kind('coll').sla === 5,
    `пороги давности живут в справочнике видов — ${sla} рабочих дн. (ИУ-9)`);

  const tops = KU.state.rules.filter(r => r.scope === 'top');
  const perRole = ROLES.every(r => tops.filter(t => t.role === r.id).length === 1);
  const keys = tops.map(t => KU.verAt(t, TODAY).key.join('+'));
  ok(3, tops.length === 5 && perRole && new Set(keys).size >= 4,
    `правил холдинга ${tops.length} — по одному на роль, ключи разные (${keys.join(' · ')}) — ИУ-6`);

  ok(4, ACCESS.length === 4 && !!KU.admin() && KU.dict.EMP.filter(e => e.admin).length === 1,
    `ролей доступа ${ACCESS.length}; администратор кураторства один и вакантным не бывает — ${nm(KU.admin())}`);
})();

/* ---------- B. Журнал: append-only, поля куратора нет ---------- */
(() => {
  KU.seed();
  const objs = KU.state.objects;
  const withField = objs.filter(o => o.curator || o.unit || o.emp || o.procOwner);
  ok(5, withField.length === 0,
    `ни у одного из ${objs.length} объектов нет атрибута куратора или подразделения — ИУ-1`);

  const births = KU.state.journal.filter(r => r.by === 'система');
  const expect = objs.reduce((n, o) => n + KU.rolesOf(o.kind).length, 0);
  ok(6, births.length === expect && KU.state.journal.length === expect + 2,
    `рождение наполнило журнал: ${births.length} записей при ${expect} парах «объект и роль», плюс 2 корректировки`);

  const half = KU.state.journal.filter(r => !r.from || !r.src || !r.reason);
  const open = KU.state.journal.filter(r => r.to == null);
  ok(7, half.length === 0 && open.length === expect,
    `каждая запись несёт дату, чем поставлена и причину; открытых отрезков ${open.length} — по одному на пару`);

  const recs = KU.state.journal.filter(r => r.objId === 'КД-2024/117' && r.role === 'cur_loan')
    .sort((a, b) => a.from < b.from ? -1 : 1);
  ok(8, recs.length === 2 && recs[0].to === '2026-02-28' && recs[1].from === '2026-03-01' &&
       recs[0].empId !== recs[1].empId,
    `корректировка не переписала запись, а закрыла её ${recs[0] && recs[0].to} и добавила новую — ИУ-4`);
})();

/* ---------- C. Две ступени на живых данных ---------- */
(() => {
  KU.seed();
  const a = on('ЗК-2026/041', 'spec_app');
  const d = KU.decide('ЗК-2026/041', 'spec_app', TODAY);
  ok(9, a.ok && a.assigned === 'e_ivanov' && d.unitId === 'u_agro' && a.src === 'правило',
    `обе ступени сработали: ${KU.unit(d.unitId).name} → ${a.assignedName}`);

  const two = KU.curatorsOfObject('ЗЛ-8801', TODAY);
  const units = two.map(x => x.unitId);
  ok(10, two.length === 2 && units[0] !== units[1] && two[0].assigned !== two[1].assigned,
    `у предмета залога две роли и два подразделения: ${two.map(x => x.roleName + ' → ' + KU.unit(x.unitId).name + ' · ' + x.assignedName).join(' | ')} — ИУ-13`);

  const c17 = on('ТР-2025/017', 'cur_claim'), c18 = on('ТР-2025/018', 'cur_claim');
  ok(11, c17.assigned !== c18.assigned && KU.obj('ТР-2025/017').of === KU.obj('ТР-2025/018').of,
    `два требования одного кредита ведут разные кураторы (${c17.assignedName} и ${c18.assignedName}) — ADR-0023`);

  const closed = KU.obj('КД-2023/210');
  const still = on('КД-2023/210', 'cur_loan');
  ok(12, !!closed.closed && still.ok && still.assigned === 'e_asanov',
    `кредит погашен ${closed.closed}, куратор жив: ${still.assignedName} — ИУ-5`);
})();

/* ---------- D. Фолбэк-лестница и пороги давности ---------- */
(() => {
  KU.seed();
  const up = KU.decide('ЗК-2026/047', 'spec_app', TODAY);
  const upA = on('ЗК-2026/047', 'spec_app');
  ok(13, up.src === 'фолбэк' && up.level === 'верхняя' && up.empId === KU.admin() &&
        upA.overdue === true && upA.heldDays === 4 && upA.sla === 2,
    `верхний пробел «Услуги» держит ${nm(up.empId)}: ${upA.heldDays} раб. дн. при пороге ${upA.sla} — просрочен (ИУ-8, ИУ-9)`);

  const noRule = KU.decide('ЗК-2026/050', 'spec_app', TODAY);
  const noRuleA = on('ЗК-2026/050', 'spec_app');
  ok(14, !KU.lowRule('u_ind', 'spec_app') && noRule.src === 'фолбэк' && noRule.level === 'нижняя' &&
        noRule.empId === KU.headOf('u_ind') && noRuleA.overdue === false,
    `правила подразделения нет вовсе — держит заведующий ${nm(noRule.empId)}, ${noRuleA.heldDays} раб. дн. при пороге ${noRuleA.sla}`);

  const hole = on('КД-2026/012', 'cur_loan');
  ok(15, hole.fallback && hole.assigned === KU.headOf('u_agro') && hole.heldDays === 7 && hole.overdue,
    `пустая ячейка «Таласская» держится заведующей ${hole.assignedName} ${hole.heldDays} раб. дн. при пороге ${hole.sla}`);

  const edge = on('ЗЛ-8815', 'cur_coll');
  ok(16, edge.fallback && edge.heldDays === 5 && edge.sla === 5 && edge.overdue === false,
    `граница порога: ${edge.heldDays} раб. дн. при пороге ${edge.sla} — ещё в сроке, не просрочка`);

  const fb = KU.fallbacks(TODAY);
  ok(17, fb.length === 6 && fb.filter(f => f.overdue).length === 3,
    `фолбэком держится ${fb.length} закреплений, дольше порога ${fb.filter(f => f.overdue).length}`);

  const born = KU.state.objects.filter(o => o.born <= TODAY);
  const empty = born.reduce((acc, o) => acc.concat(KU.curatorsOfObject(o.id, TODAY).filter(x => !x.ok)), []);
  ok(18, born.length > 0 && empty.length === 0,
    `«объект без куратора» невозможен: ${born.length} объектов, пустых ответов 0 — ИУ-9`);
})();

/* ---------- E. Шов curatorOn ---------- */
(() => {
  KU.seed();
  const noDate = KU.curatorOn('КД-2024/117', 'cur_loan', null);
  ok(19, !noDate.ok && /дат/i.test(noDate.why),
    `вопрос без даты не принимается: «${noDate.why}»`);

  const early = KU.curatorOn('КД-2024/117', 'cur_loan', '2024-01-01');
  ok(20, !early.ok && early.empty === true,
    `на дату до рождения объекта — единственный законный пустой ответ: «${early.why}» (ИУ-3)`);

  const a = on('КД-2024/117', 'cur_loan');
  ok(21, a.assigned === a.acting && a.substituted === false && 'acting' in a && 'assigned' in a,
    `ответов два и они названы: закреплённый ${a.assignedName}, действующий ${a.actingName}; замещения в волне 1 нет — ИУ-2`);

  const feb = on('КД-2024/117', 'cur_loan', '2026-02-28');
  const mar = on('КД-2024/117', 'cur_loan', '2026-03-01');
  ok(22, feb.assigned === 'e_bekova' && feb.ver.no === 1 && mar.assigned === 'e_ivanov' && mar.ver.no === 2,
    `ответ воспроизводим задним числом: 28.02 — ${feb.assignedName} (ред. ${feb.ver.no}), 01.03 — ${mar.assignedName} (ред. ${mar.ver.no}) — ИУ-10, ИУ-11`);

  const off33 = KU.offRule('КД-2025/033', 'cur_loan', TODAY);
  const off88 = KU.offRule('КД-2025/088', 'cur_loan', TODAY);
  const same = KU.offRule('КД-2024/117', 'cur_loan', TODAY);
  ok(23, off33 && off33.journal === 'e_bekova' && off88 && off88.src === 'рука' && same === null,
    `«живут вне правила»: ${nm(off33 && off33.journal)} вместо ${nm(off33 && off33.now)} после смены редакции; ${nm(off88 && off88.journal)} — закрепление рукой; пересчитанный кредит совпадает`);
})();

/* ---------- F. Кто правит правило ---------- */
(() => {
  KU.seed();
  const top = KU.topRule('cur_loan'), low = KU.lowRule('u_agro', 'cur_loan');
  const st = KU.state;

  st.role = 'reader'; const r1 = KU.canEdit(top);
  st.role = 'worker'; const r2 = KU.canEdit(low);
  ok(24, !r1.ok && !r2.ok, `наблюдатель и куратор правило не правят: «${r1.why}» · «${r2.why}»`);

  st.role = 'admin';
  const a1 = KU.canEdit(top), a2 = KU.canEdit(low);
  ok(25, a1.ok && !a2.ok && /заведующ/i.test(a2.why),
    `администратор владеет верхней ступенью и не правит нижнюю: «${a2.why}» — ADR-0117`);

  st.role = 'head'; st.headUnit = 'u_agro';
  const h1 = KU.canEdit(low), h2 = KU.canEdit(KU.lowRule('u_ind', 'cur_loan')), h3 = KU.canEdit(top);
  ok(26, h1.ok && !h2.ok && !h3.ok,
    `заведующий правит только своё подразделение: своё — да, чужое — «${h2.why}», верхняя — «${h3.why}»`);
})();

/* ---------- G. Редакции: дата вступления, ключ, родильность ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');

  const past = KU.setEff(rule.id, '2026-01-01');
  ok(27, !past.ok && /прошл/i.test(past.why), `дата вступления в прошлом отклонена: «${past.why}» — ИУ-10`);

  const before = rule.versions.length;
  const curBefore = JSON.stringify(KU.verAt(rule, TODAY).cells);
  KU.setEff(rule.id, '2026-09-01');
  const res = KU.setCell(rule.id, 'Таласская', 'e_asanov');
  const nv = KU.verAt(rule, '2026-09-01');
  ok(28, res.ok && rule.versions.length === before + 1 && nv.no === res.ver &&
        nv.cells['Таласская'] === 'e_asanov' && JSON.stringify(KU.verAt(rule, TODAY).cells) === curBefore,
    `правка завела редакцию ${res.ver} с 01.09.2026; действующая на сегодня не переписана — ИУ-10`);

  const prev = rule.versions.find(v => v.no === nv.no - 1);
  ok(29, prev.until === '2026-08-31' && KU.verStatus(nv) === 'будущая',
    `предыдущая редакция закрыта ${prev.until}, новая числится будущей — интервалы не пересекаются`);

  const holeNow = on('КД-2026/012', 'cur_loan');
  const holeThen = on('КД-2026/012', 'cur_loan', '2026-09-02');
  ok(30, holeNow.fallback === true && holeThen.fallback === true,
    `правка нижнего правила сама объекты не переставляет — ${holeNow.assignedName} держит их и после 01.09; переставляет пересчёт, отдельным действием (этап 3)`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'admin';
  const top = KU.topRule('spec_app');
  const before = JSON.stringify(KU.state.journal);
  KU.setEff(top.id, '2026-09-01');
  const res = KU.setCell(top.id, 'Услуги', 'u_ind');
  ok(31, res.ok && JSON.stringify(KU.state.journal) === before && /родильн/i.test(res.note),
    `правка верхней ступени журнал не тронула — живущие объекты остались в своих подразделениях (ИУ-7, ИУ-12)`);

  const still = on('ЗК-2026/047', 'spec_app');
  ok(32, still.assigned === KU.admin() && still.fallback === true,
    `заявка, рождённая до вступления, осталась у ${still.assignedName}: подразделение двигает только передача с приёмом — ADR-0023`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');
  const wrong = KU.keyDraftAdd(rule.id, 'vidzalog');
  ok(33, !wrong.ok && /не заведён/.test(wrong.why),
    `в ключ не встаёт признак чужого вида объекта: «${wrong.why}»`);

  KU.keyDraftInit(rule.id);
  KU.keyDraftAdd(rule.id, 'forma');
  KU.setEff(rule.id, '2026-09-01');
  const saved = KU.saveKey(rule.id);
  const nv = KU.verAt(rule, '2026-09-01');
  ok(34, saved.ok && nv.key.join('+') === 'oblast+forma' && KU.space(nv.key).length === 10 &&
        Object.keys(nv.cells).length === 0 && saved.holes === 10,
    `смена ключа — тоже редакция: ячеек ${KU.space(nv.key).length}, вслепую не перенесено ни одной, дыр ${saved.holes} (их держит заведующий)`);
})();

/* ---------- H. Покрытие правил ---------- */
(() => {
  KU.seed();
  const ind = KU.coverage(KU.lowRule('u_ind', 'cur_loan'), TODAY);
  ok(35, ind.cells.length === 10 && ind.named.length === 6 && ind.holes.length === 4 &&
        ind.holesHot.indexOf('Нарынская | Физическое лицо') >= 0,
    `составной ключ: ячеек ${ind.cells.length}, закрыто ${ind.named.length}, пустых с объектами ${ind.holesHot.length}`);

  const app = KU.coverage(KU.topRule('spec_app'), TODAY);
  ok(36, app.cells.length === 3 && app.holes.join() === 'Услуги' && app.holesHot.join() === 'Услуги',
    `верхнее правило заявок: не названа ячейка «${app.holes.join()}», и объект в ней есть`);

  const objs = KU.cellObjects(KU.lowRule('u_agro', 'cur_loan'), 'Ошская', TODAY);
  ok(37, objs.length === 2 && objs.every(o => o.f.oblast === 'Ошская'),
    `счётчик ячейки и список за ним считаются одним расчётом: ${objs.map(o => o.id).join(', ')}`);
})();

/* ---------- I. Сторож текста ---------- */
(() => {
  const ius = Array.from({ length: 14 }, (_, i) => 'ИУ-' + (i + 1))
    .filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const adrs = ['ADR-0116', 'ADR-0117', 'ADR-0118', 'ADR-0023'].filter(a => !src.includes(a));
  ok(38, ius.length === 0 && adrs.length === 0,
    `в файле названы все 14 инвариантов и 4 решения${ius.length ? ' · нет: ' + ius.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const engine = m[1].slice(m[1].indexOf('ДВИЖОК'), m[1].indexOf('ШОВ'));
  const leaked = ['cur_loan', 'spec_app', 'reg_exec', 'u_agro', 'u_opk', 'oblast', 'vidzalog', 'Ошская']
    .filter(x => engine.includes(x));
  ok(39, leaked.length === 0,
    `в движке нет ни одной роли, ни подразделения, ни признака по имени — всё приходит справочниками${leaked.length ? ' · утекло: ' + leaked.join(',') : ''}`);

  const ghost = /ASUBK-kuratorstvo-logika|§\s*\d/.test(src);
  ok(40, !ghost, `ни одной ссылки на утраченную спеку и её параграфы не осталось — КУ-Д9`);

  const stubs = ['Пересчёт', 'Передачи', 'Витрины', 'Отстранения'].filter(s => !src.includes(s));
  ok(41, stubs.length === 0 && /ГРАНИЦЫ ВОЛНЫ 1/.test(src),
    `четыре экрана следующих этапов стоят заглушками и границы волны объявлены в шапке`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-16 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const marker = 'SMOKE (node scripts/inspect/kuratorstvo-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку kuratorstvo.html');
}

process.exit(pass === results.length ? 0 : 1);
