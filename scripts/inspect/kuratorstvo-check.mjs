// Headless смоук для mockups/kuratorstvo/kuratorstvo.html (ИУ-1…ИУ-26, ADR-0116…0118 + ADR-0023).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение движка, обеих ступеней, фолбэк-лестницы, шва и редакций (волна 1),
// а также движение закрепления — рождение и снимок, пересчёт, передачи, рука, ретро (волна 2) —
// и ответственность: реестр отстранений, второй ответ шва с лестницей замещения, период
// ответственности с вычетом, ведущий куратор заёмщика и гейт увольнения (волна 3),
// и справочник признаков: заведение группировки, её редакции и снятие по обратному индексу,
// уникальность имён долей, «Прочие» всегда, датные проверки ссылки (волна 4).
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
  /* Ролей в макете четыре: «Региональный исполнитель» снят 16.08.2026 (в каноне их пять). */
  ok(1, KINDS.length === 4 && ROLES.length === 4 && badKind.length === 0 &&
       !ROLES.some(r => r.id === DERIVED.id),
    `видов ${KINDS.length}, назначаемых ролей ${ROLES.length}, каждая при своём виде; «${DERIVED.name}» в списке назначаемых нет — ИУ-13, ИУ-14`);

  const sla = KINDS.map(k => k.id + ':' + k.sla).join(' ');
  ok(2, KU.kind('app').sla === 2 && KU.kind('claim').sla === 3 &&
       KU.kind('loan').sla === 5 && KU.kind('coll').sla === 5,
    `пороги давности живут в справочнике видов — ${sla} рабочих дн. (ИУ-9)`);

  const tops = KU.state.rules.filter(r => r.scope === 'top');
  const perRole = ROLES.every(r => tops.filter(t => t.role === r.id).length === 1);
  const keys = tops.map(t => KU.verAt(t, TODAY).key.join('+'));
  ok(3, tops.length === ROLES.length && perRole && new Set(keys).size >= 3,
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
  ok(6, births.length === expect && KU.state.journal.length === expect + 3,
    `рождение наполнило журнал: ${births.length} записей при ${expect} парах «объект и роль», плюс 3 корректировки`);

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

  /* Ролей у объекта ровно столько, сколько назначаемых ролей у его вида, и все они
     этого вида — чужая роль на объект не садится (ИУ-13). До 16.08.2026 проверка ловила
     две роли предмета залога; после снятия «Регионального исполнителя» роль осталась одна. */
  const collRoles = KU.dict.ROLES.filter(r => r.kind === 'coll');
  const two = KU.curatorsOfObject('ЗЛ-8801', TODAY);
  ok(10, two.length === collRoles.length && two.every(x => KU.role(x.role).kind === 'coll') &&
        two.every(x => x.ok),
    `у предмета залога ролей ${two.length} — ровно по числу ролей его вида: ${
      two.map(x => x.roleName + ' → ' + KU.unit(x.unitId).name + ' · ' + x.assignedName).join(' | ')} — ИУ-13`);

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
  ok(17, fb.length === 5 && fb.filter(f => f.overdue).length === 3,
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

  const a = on('КД-2023/210', 'cur_loan');
  ok(21, a.assigned === a.acting && a.substituted === false && 'acting' in a && 'assigned' in a,
    `ответов два и они названы: закреплённый ${a.assignedName}, действующий ${a.actingName} — без отстранения и отсутствия они совпадают (ИУ-2)`);

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
    `правка нижнего правила сама объекты не переставляет — ${holeNow.assignedName} держит их и после 01.09; переставляет пересчёт, отдельным действием (#49–#54)`);
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
  /* Имя переносится там, где ответ доказуемо не меняется: у «Ошской» был один куратор —
     значит он же ведёт и «Ошская | Частная», и «Ошская | Государственная». «Таласская»
     имени не имела — из неё выходят дыры. Второй признак группировкой не резан:
     форма собственности встаёт в ключ доменом справочника, всеми четырьмя значениями.
     Восемь областей плюс обязательная доля «Прочие» — девять на четыре формы, 36 ячеек. */
  ok(34, saved.ok && nv.key.join('+') === 'terr+forma' && KU.space(nv, '2026-09-01').length === 36 &&
        Object.keys(nv.cells).length === 16 && saved.kept === 16 && saved.holes === 20 &&
        nv.grp.terr === 'g_terr_oblast' && !nv.grp.forma &&
        nv.cells['Ошская | Частная'] === 'e_ivanov' && !nv.cells['Таласская | Частная'],
    `смена ключа — тоже редакция: ячеек ${KU.space(nv, '2026-09-01').length}, имя перенесено в ${saved.kept} (ответ не меняется), дыр ${saved.holes} — там, где имени не было`);
})();

/* ---------- H. Покрытие правил ---------- */
(() => {
  KU.seed();
  const ind = KU.coverage(KU.lowRule('u_ind', 'cur_loan'), TODAY);
  ok(35, ind.cells.length === 27 && ind.named.length === 6 && ind.holes.length === 21 &&
        ind.holesHot.indexOf('Нарынская | Граждане') >= 0,
    `составной ключ: ячеек ${ind.cells.length}, закрыто ${ind.named.length}, пустых с объектами ${ind.holesHot.length}`);

  const app = KU.coverage(KU.topRule('spec_app'), TODAY);
  ok(36, app.cells.length === 4 && app.holes.join() === 'Услуги,' + KU.OTHER &&
        app.holesHot.join() === 'Услуги',
    `верхнее правило заявок: не названы ячейки «${app.holes.join('», «')}», объект есть в «${app.holesHot.join()}»`);

  const low = KU.lowRule('u_agro', 'cur_loan');
  const lowV = KU.verAt(low, TODAY);
  const objs = KU.cellObjects(low, 'Ошская', TODAY);
  ok(37, objs.length === 5 &&
        objs.every(o => KU.groupOf(lowV, 'terr', KU.featVal(o, 'terr'), TODAY) === 'Ошская'),
    `счётчик ячейки и список за ним считаются одним расчётом: ${objs.map(o => o.id).join(', ')}`);
})();

/* ---------- I. Сторож текста ---------- */
(() => {
  const ius = Array.from({ length: 26 }, (_, i) => 'ИУ-' + (i + 1))
    .filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const adrs = ['ADR-0116', 'ADR-0117', 'ADR-0118', 'ADR-0023'].filter(a => !src.includes(a));
  ok(38, ius.length === 0 && adrs.length === 0,
    `в файле названы все 26 инвариантов и 4 решения${ius.length ? ' · нет: ' + ius.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const engine = m[1].slice(m[1].indexOf('ДВИЖОК'), m[1].indexOf('ШОВ'));
  const leaked = ['cur_loan', 'spec_app', 'cur_claim', 'u_agro', 'u_opk', 'otrasl', 'vidzalog', 'Ошская']
    .filter(x => engine.includes(x));
  ok(39, leaked.length === 0,
    `в движке нет ни одной роли, ни подразделения, ни признака по имени — всё приходит справочниками${leaked.length ? ' · утекло: ' + leaked.join(',') : ''}`);

  const ghost = /ASUBK-kuratorstvo-logika|§\s*\d/.test(src);
  ok(40, !ghost, `ни одной ссылки на утраченную спеку и её параграфы не осталось — КУ-Д9`);

  const stubBlock = (m[1].match(/const STUBS = \{[\s\S]*?\n\};/) || [''])[0];
  const stubIds = (stubBlock.match(/\n  (\w+): \{/g) || []).map(s => s.trim().replace(':', '').replace(' {', ''));
  ok(41, stubIds.length === 1 && stubIds[0] === 'show' &&
        /ГРАНИЦЫ ВОЛНЫ 4/.test(src) &&
        ['Признаки и группировки', 'Пересчёт', 'Передачи', 'Отстранения'].every(s => src.includes(s)),
    `экраны волны 4 рабочие, заглушкой остался один (${stubIds.join(', ')}) — границы волны объявлены в шапке`);
})();

/* ---------- J. Рождение объекта и снимок признаков (P18-R9, ИУ-15) ---------- */
(() => {
  KU.seed();
  const noPoint = KU.dict.KINDS.filter(k => !k.birth);
  const born = KU.state.journal.filter(r => r.by === 'система');
  const wrongAt = born.filter(r => r.at !== KU.kind(KU.obj(r.objId).kind).birth);
  ok(42, noPoint.length === 0 && wrongAt.length === 0,
    `у каждого вида своя точка рождения и запись журнала её называет: ${KU.dict.KINDS.map(k => k.name.toLowerCase() + ' — ' + k.birth).join(' · ')} (P18-R9)`);

  const b = born.find(r => r.objId === 'КД-2025/033' && r.role === 'cur_loan');
  const o = KU.obj('КД-2025/033');
  const same = b && Object.keys(o.f).every(k => b.snap[k] === o.f[k]);
  ok(43, !!b && !!b.snap && same && b.ver.ruleId === 'low_agro_loan',
    `решение хранит снимок признаков на свою дату: ${b && Object.keys(b.snap).length} признаков в записи от ${b && b.from} — ИУ-15`);

  /* Территория — признак ЗАЁМЩИКА: правится она у «ОсОО «Дан-Азык»», а не на кредите. */
  const wasAssigned = on('КД-2025/091', 'cur_loan').assigned;
  const chg = KU.setFeature('КД-2025/091', 'terr', 'Чуйский');
  const nowAssigned = on('КД-2025/091', 'cur_loan').assigned;
  const snapKept = KU.journalOf('КД-2025/091', 'cur_loan')[0].snap.terr;
  const off = KU.offRule('КД-2025/091', 'cur_loan', TODAY);
  ok(44, chg.ok && nowAssigned === wasAssigned && snapKept === 'Кара-Сууйский' && off && off.now === 'e_asanov',
    `признак поменялся в соседнем модуле — куратор не двинулся (${nm(nowAssigned)}), снимок хранит «${snapKept}», объект встал в «живут вне правила» (правило хочет ${nm(off && off.now)}) — ИУ-15`);

  const badFeat = KU.setFeature('КД-2025/091', 'vidzalog', 'Техника');
  ok(45, !badFeat.ok && /не заведён/.test(badFeat.why),
    `признак чужого вида объекту не ставится: «${badFeat.why}»`);
})();

(() => {
  KU.seed();
  const app  = KU.state.journal.find(r => r.objId === 'ЗК-2026/041' && r.role === 'spec_app');
  const loan = KU.state.journal.find(r => r.objId === 'КД-2025/033' && r.role === 'cur_loan');
  ok(46, app.at !== loan.at && app.empId !== loan.empId && app.ver.ruleId !== loan.ver.ruleId,
    `преемства «заявка → кредит» нет: заявка закреплена в точке «${app.at}» (${nm(app.empId)}), кредит — своим правилом в точке «${loan.at}» (${nm(loan.empId)}) — P18-R9`);
})();

/* ---------- K. Незакрытая работа: критерий рукопожатия (P18-R12, ИУ-17) ---------- */
(() => {
  KU.seed();
  const busy = KU.workOpen('КД-2025/033', TODAY);
  const free = KU.workOpen('КД-2025/091', TODAY);
  ok(47, busy.open === true && busy.items.length === 1 && busy.items[0].src === 's_loan' &&
        free.open === false && free.asked.length === 3 && free.silent.length === 0,
    `признак не хранится, а спрашивается у источников: у кредита с горящим сроком работа открыта (${busy.items[0].srcName}), у соседнего все ${free.asked.length} источника ответили «нет» — ИУ-17`);

  const silent = KU.workOpen('ЗЛ-8801', TODAY);
  ok(48, silent.open === true && silent.items.length === 0 && silent.silent.length === 1 &&
        /молчит/.test(silent.why) && /безопасн/.test(silent.why),
    `молчание источника «${silent.silent.join(', ')}» трактуется в безопасную сторону и пишется в отчёт: «${silent.why}»`);

  const mine = KU.workOfEmp('e_bekova', TODAY).map(x => x.objId);
  ok(49, mine.indexOf('КД-2025/033') >= 0 && mine.indexOf('КД-2025/091') < 0,
    `тот же признак читается по работнику (им же питается гейт увольнения, этап 4): у ${nm('e_bekova')} незакрыто ${mine.join(', ')}`);
})();

/* ---------- L. Пересчёт: четыре корзины и одна кнопка (P18-R11, ИУ-16) ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'admin';
  const g = KU.canRecalc('u_agro', 'cur_loan');
  const p = KU.recalcPreview('u_agro', 'cur_loan');
  ok(50, !g.ok && !p.ok && /кнопки пересчёта нет/.test(g.why),
    `у администратора кураторства кнопки пересчёта нет ни на одном экране: «${g.why}» — ИУ-7, ИУ-16`);

  st.role = 'head'; st.headUnit = 'u_agro';
  const alien = KU.canRecalc('u_ind', 'cur_loan');
  st.headUnit = 'u_ind';
  const noRule = KU.canRecalc('u_ind', 'spec_app');
  ok(51, !alien.ok && /своё подразделение/.test(alien.why) && !noRule.ok && /правила нет/.test(noRule.why),
    `пересчитывают только своё и только по существующему правилу: «${alien.why}» · «${noRule.why}»`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const p = KU.recalcPreview('u_agro', 'cur_loan');
  const ids = b => p[b].map(r => r.objId).join(',');
  ok(52, p.ok && ids('quiet') === 'КД-2025/091' && ids('hand') === 'КД-2025/033' &&
        ids('blocked') === 'КД-2025/072' && ids('manual') === 'КД-2024/205' && p.total === 2,
    `корзин четыре: тихо ${ids('quiet')} · рукопожатие ${ids('hand')} (${p.hand[0] && p.hand[0].work.items[0].what}) · отстранение ${ids('blocked')} · рука не тронута ${ids('manual')}`);

  const before = KU.state.journal.length;
  const closed = KU.recalcClose();
  ok(53, closed.ok && KU.state.preview === null && KU.state.journal.length === before,
    `предпросмотр закрывается без следа: журнал ${before} записей до и после — фонового пересчёта нет (ИУ-16)`);

  const manualRec = KU.journalOf('КД-2024/205', 'cur_loan').slice(-1)[0];
  const blockedRec = KU.journalOf('КД-2025/072', 'cur_loan').slice(-1)[0];
  const res = KU.recalcApply('u_agro', 'cur_loan');
  const moved = KU.journalOf('КД-2025/091', 'cur_loan').slice(-1)[0];
  const h = KU.pendingHandoff('КД-2025/033', 'cur_loan');
  ok(54, res.ok && res.moved === 1 && res.sent === 1 && KU.state.journal.length === before + 1 &&
        moved.src === 'правило' && moved.ver.no === 2 && moved.at === 'пересчёт' && moved.unitId === 'u_agro' &&
        KU.journalOf('КД-2024/205', 'cur_loan').slice(-1)[0].id === manualRec.id &&
        KU.journalOf('КД-2025/072', 'cur_loan').slice(-1)[0].id === blockedRec.id && !!h && h.src === 'пересчёт',
    `применение: тихо переставлен 1 (запись ссылается на редакцию ${moved.ver.no}, подразделение прежнее), отправлена ${res.sent} передача, ручное и заблокированное не тронуты — ИУ-16`);

  const again = KU.recalcPreview('u_agro', 'cur_loan');
  ok(55, again.total === 0 && again.pending.length === 1 && again.blocked.length === 1 && again.manual.length === 1,
    `повторный пересчёт без правки правила — нулевой diff: ${again.total} к переносу, в очереди ${again.pending.length}, заблокировано ${again.blocked.length}, рукой ${again.manual.length}`);

  ok(56, again.silent.length === 0 && p.silent.length === 0,
    `молчащих источников по кредитам нет — отчёт пересчёта их бы назвал (у предметов залога молчит «Обеспечение», #48)`);
})();

/* ---------- M. Передача с рукопожатием (P18-R10, ИУ-18) ---------- */
(() => {
  KU.seed();
  const h = KU.pendingHandoff('ЗЛ-8802', 'cur_coll');
  const a = on('ЗЛ-8802', 'cur_coll');
  ok(57, !!h && h.state === 'в очереди' && a.assigned === 'e_mamatov' && a.unitId === 'u_ozo',
    `до приёма не изменилось ничего: передача ${h && h.id} в очереди с ${h && h.sent}, объект ведёт ${a.assignedName} в подразделении ${KU.unit(a.unitId).name} — ИУ-18, ИУ-12`);

  const card = KU.handoffCard('h1');
  ok(58, card.ok && card.suggest === KU.headOf('u_osh') && card.fallback === true &&
        /ячейка/.test(card.why) && /заведующ/.test(card.why),
    `карточка приёма подставляет работника правилом принимающей стороны: ячейка пуста → ${nm(card.suggest)}, и сказано почему — «${card.why}»`);

  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const alien = KU.handoffAccept('h1');
  st.role = 'admin';
  const adm = KU.handoffAccept('h1');
  ok(59, !alien.ok && !adm.ok && /принимающая сторона/.test(alien.why),
    `разбирает передачу только принимающая сторона: чужой заведующий — «${alien.why}»; администратор — тоже нет`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_osh';
  const before = KU.journalOf('ЗЛ-8802', 'cur_coll').length;
  const res = KU.handoffAccept('h1');
  const recs = KU.journalOf('ЗЛ-8802', 'cur_coll');
  const prev = recs[recs.length - 2], now = recs[recs.length - 1];
  ok(60, res.ok && recs.length === before + 1 && now.from === TODAY && prev.to < TODAY &&
        now.unitId === 'u_osh' && now.empId === KU.headOf('u_osh') && now.src === 'фолбэк' &&
        KU.pendingHandoff('ЗЛ-8802', 'cur_coll') === null,
    `приём двигает подразделение: с ${now.from} ведёт ${nm(now.empId)} в ${KU.unit(now.unitId).name}, прежнее закрыто ${prev.to} — журнал без разрыва (ADR-0023)`);

  const late = KU.handoffAccept('h1');
  ok(61, !late.ok && /уже принята/.test(late.why), `принятую передачу второй раз не разобрать: «${late.why}»`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_osh';
  const bare = KU.handoffAccept('h1', 'e_duishev');
  const done = KU.handoffAccept('h1', 'e_duishev', 'вёл этот предмет до перемещения');
  const rec = KU.journalOf('ЗЛ-8802', 'cur_coll').slice(-1)[0];
  ok(62, !bare.ok && /требует причины/.test(bare.why) && done.ok && done.byHand === true &&
        rec.src === 'переопределение' && rec.ver === null && /вёл этот предмет/.test(rec.reason),
    `замена подставленного работника требует причины и меняет источник записи: «${bare.why}» → принято как «${rec.src}»`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_osh';
  const before = KU.state.journal.length;
  const bare = KU.handoffReject('h1');
  const res = KU.handoffReject('h1', 'предмет числится на площадке в Нарыне, акт не переоформлен');
  const a = on('ЗЛ-8802', 'cur_coll');
  ok(63, !bare.ok && res.ok && KU.state.journal.length === before &&
        a.assigned === 'e_mamatov' && a.unitId === 'u_ozo' &&
        KU.state.handoffs.find(x => x.id === 'h1').state === 'отклонена',
    `отклонение возвращает объект отправителю: журнал не тронут (${before} записей), ведёт прежний ${a.assignedName} в ${KU.unit(a.unitId).name} — ИУ-18`);
})();

/* ---------- N. Рука, отстранение, возврат к правилу (P18-R13, ИУ-19) ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const bare  = KU.assignByHand('КД-2025/091', 'cur_loan', 'e_asanov', null, '');
  const alien = KU.assignByHand('КД-2025/091', 'cur_loan', 'e_duishev', null, 'нужен именно он');
  ok(64, !bare.ok && /причина обязательна/.test(bare.why) && !alien.ok && /передачей с приёмом/.test(alien.why),
    `закрепление рукой: без причины нельзя — «${bare.why}»; работник чужого отдела — «${alien.why}» (ИУ-12, ИУ-19)`);

  const banned = KU.assignByHand('КД-2025/072', 'cur_loan', 'e_ivanov', null, 'знает заёмщика');
  ok(65, !banned.ok && /отстранён/.test(banned.why),
    `отстранение — отдельное измерение и оно запрещает назначение: «${banned.why}» — ADR-0118`);

  const done = KU.assignByHand('КД-2025/091', 'cur_loan', 'e_asanov', null, 'выравнивание нагрузки');
  const rec = KU.journalOf('КД-2025/091', 'cur_loan').slice(-1)[0];
  const p = KU.recalcPreview('u_agro', 'cur_loan');
  ok(66, done.ok && rec.src === 'рука' && rec.ver === null &&
        p.manual.map(r => r.objId).indexOf('КД-2025/091') >= 0 && p.quiet.length === 0,
    `рука держится вне правила: запись «${rec.src}» без редакции, и пересчёт её больше не трогает — она в корзине ручных (ИУ-19)`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const back = KU.backToRule('КД-2024/205', 'cur_loan');
  const recs = KU.journalOf('КД-2024/205', 'cur_loan');
  const last = recs[recs.length - 1];
  const twice = KU.backToRule('КД-2024/205', 'cur_loan');
  ok(67, back.ok && last.empId === 'e_ivanov' && last.src === 'правило' && recs.length === 3 &&
        !twice.ok && /и так стоит по правилу/.test(twice.why),
    `возврат к правилу — новая запись, а не откат: ${recs.length} записи по паре, сейчас ${nm(last.empId)} по правилу; повторно — «${twice.why}»`);
})();

/* ---------- O. Ретро-правка и запертый период (P18-R14, ИУ-20) ---------- */
(() => {
  KU.seed();
  const free = KU.retroFit('КД-2025/091', 'cur_loan', '2026-07-01');
  const fit  = KU.retroFit('КД-2024/117', 'cur_loan', '2026-05-01');
  ok(68, free.moved === false && free.from === '2026-07-01' &&
        fit.moved === true && fit.from === '2026-06-16' && fit.last.d === '2026-06-15',
    `задним числом можно, пока период не заперт: свободный — с 01.07 как просили; запертый — «${fit.note}»`);

  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const res = KU.assignByHand('КД-2024/117', 'cur_loan', 'e_bekova', '2026-05-01', 'передача портфеля');
  const inside = on('КД-2024/117', 'cur_loan', '2026-06-01');
  const now = on('КД-2024/117', 'cur_loan');
  const rec = KU.journalOf('КД-2024/117', 'cur_loan').slice(-1)[0];
  ok(69, res.ok && res.from === '2026-06-16' && res.moved === true &&
        inside.assigned === 'e_ivanov' && now.assigned === 'e_bekova' && rec.retro === true,
    `дата вступления поджата к первому свободному дню: внутри запертого периода ответ прежний (${inside.assignedName}), с ${rec.from} — ${now.assignedName} (ИУ-20)`);

  const noFacts = KU.retroFit('ЗЛ-8815', 'cur_coll', '2026-08-11');
  ok(70, noFacts.moved === false && noFacts.blockers.length === 0,
    `объект без закрытых фактов ретро-правке не сопротивляется: ${noFacts.from} как просили`);
})();

/* ---------- P. Реестр отстранений (P18-R15, ИУ-21, ИУ-22) ---------- */
(() => {
  KU.seed();
  const bans = KU.bansOf(TODAY);
  const onObj = KU.state.objects.filter(o => o.ban || o.off || o.coi);
  const inJournal = KU.state.journal.filter(r => /отстран/i.test(r.src || ''));
  ok(71, bans.length === 2 && bans.every(b => b.live) && onObj.length === 0 && inJournal.length === 0,
    `отстранение — свой реестр, а не поле объекта и не запись журнала: ${bans.length} живых отрезка, у объектов признака нет, в журнале записей об отстранении нет — ADR-0118, ИУ-21`);

  const st = KU.state;
  st.role = 'head'; st.headUnit = 'u_agro';
  const byHead = KU.banAdd('e_asanov', 'ОсОО «Темир»', TODAY, 'заведующий отделом', '02-14/900', TODAY, 'проверка прав');
  st.role = 'reader';
  const byReader = KU.banLift('b2', TODAY, 'проверка прав');
  ok(72, !byHead.ok && /администратор кураторства/.test(byHead.why) &&
        !byReader.ok && /администратор кураторства/.test(byReader.why),
    `вводит и снимает только администратор: заведующий — «${byHead.why}»; наблюдатель — «${byReader.why}» (P18-R15)`);

  st.role = 'admin';
  const noNote = KU.banAdd('e_asanov', 'ОсОО «Темир»', TODAY, 'заведующий отделом', '', '', '');
  const ahead  = KU.banAdd('e_asanov', 'ОсОО «Темир»', '2026-09-01', 'заведующий отделом', '02-14/901', TODAY, 'вперёд нельзя');
  const noSuch = KU.banAdd('e_asanov', 'ОсОО «Нет такого»', TODAY, 'заведующий отделом', '02-14/902', TODAY, 'заёмщика нет');
  ok(73, !noNote.ok && /служебная записка/.test(noNote.why) && !ahead.ok && /вперёд/.test(ahead.why) &&
        !noSuch.ok && /заёмщика/.test(noSuch.why),
    `основание обязательно и вперёд отстранение не заводится: «${noNote.why}» · «${ahead.why}»`);

  const before = KU.state.journal.length;
  const wasAssigned = on('КД-2024/117', 'cur_loan').assigned;
  const add = KU.banAdd('e_ivanov', 'ОсОО «Ак-Жол»', '2026-08-14', 'служба комплаенса', '02-14/500', '2026-08-13', 'родство с учредителем');
  const nowAssigned = on('КД-2024/117', 'cur_loan');
  const twice = KU.banAdd('e_ivanov', 'ОсОО «Ак-Жол»', TODAY, 'служба комплаенса', '02-14/501', TODAY, 'то же самое');
  ok(74, add.ok && add.hits >= 1 && KU.state.journal.length === before &&
        nowAssigned.assigned === wasAssigned && nowAssigned.substituted === true &&
        !twice.ok && /уже действует/.test(twice.why),
    `заведение журнал не тронуло: записей было ${before}, стало ${KU.state.journal.length}; закреплён по-прежнему ${nowAssigned.assignedName}, работу ведёт ${nowAssigned.actingName}; второе по той же паре — «${twice.why}» (ИУ-21)`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'admin';
  const bare = KU.banLift('b2', TODAY, '');
  const lift = KU.banLift('b2', '2026-08-10', 'записка № 02-14/455 — обстоятельства отпали');
  const b2 = KU.state.bans.find(b => b.id === 'b2');
  const inside = on('КД-2025/091', 'cur_loan', '2026-08-05');
  const after  = on('КД-2025/091', 'cur_loan');
  ok(75, !bare.ok && /причина снятия обязательна/.test(bare.why) && lift.ok &&
        KU.state.bans.length === 2 && b2.to === '2026-08-10' && !!b2.lifted.why &&
        inside.substituted === true && inside.acting === 'e_toktogulova' &&
        after.substituted === false && after.acting === 'e_bekova',
    `снятие не стирает: запись осталась в реестре с отрезком по 10.08 и причиной, внутри него работу по-прежнему ведёт ${inside.actingName}, после — ${after.actingName} (ИУ-4, ИУ-24)`);

  const self = KU.state.bans.find(b => b.id === 'b2');
  const hasSelf = KU.dict.BAN_INIT.some(i => /самоотвод/i.test(i));
  ok(76, hasSelf && /самоотвод/i.test(self.init) && self.by === 'Администратор кураторства' &&
        !!self.note.no && !!self.note.d && !!self.note.text,
    `инициатор пишется отдельно от того, кто ввёл: инициатор «${self.init}», ввёл ${self.by}, основание — записка № ${self.note.no} от ${self.note.d} (ИУ-22)`);
})();

/* ---------- Q. Два ответа: закреплённый и действующий (ИУ-2, ИУ-21, ИУ-23) ---------- */
(() => {
  KU.seed();
  const a = on('КД-2025/091', 'cur_loan');
  const rec = KU.journalOf('КД-2025/091', 'cur_loan').slice(-1)[0];
  ok(77, a.assigned === 'e_bekova' && a.acting === 'e_toktogulova' && a.substituted === true &&
        rec.to == null && rec.empId === 'e_bekova' && /отстранение/.test(a.actingWhy),
    `отстранение подменяет исполнителя, закрепление живёт: закреплён ${a.assignedName} (запись открыта), работу ведёт ${a.actingName} — ${a.actingWhy}`);

  const dep = on('КД-2024/117', 'cur_loan');
  ok(78, dep.substituted === true && dep.acting === 'e_asanov' && /замещающий/.test(dep.actingStep) &&
        /отпуск/.test(dep.actingWhy),
    `замещающего называет модуль сотрудников, а не кураторство: ${dep.assignedName} в отпуске — работу ведёт ${dep.actingName}, ступень «${dep.actingStep}» (P12-R12, ИУ-23)`);

  const noDep = on('ТР-2025/018', 'cur_claim');
  ok(79, noDep.substituted === true && noDep.acting === 'e_abdylda' &&
        /заведующий отделом/.test(noDep.actingStep) && /замещающий не назван/.test(noDep.actingWhy),
    `замещающий не назван — работа уходит заведующему отделом: ${noDep.assignedName} → ${noDep.actingName} (ИУ-23)`);
})();

(() => {
  KU.seed();
  const openRecs = KU.state.journal.filter(r => r.to == null).length;
  const before = KU.substitutions(TODAY).length;
  const jbefore = KU.state.journal.length;
  const snap = () => KU.state.journal.filter(r => r.to == null)
    .map(r => r.objId + '‖' + r.role + '‖' + on(r.objId, r.role).assigned).join(';');
  const assignedBefore = snap();
  KU.setHr(false);
  const subs = KU.substitutions(TODAY);
  const empty = subs.filter(s => !s.acting);
  const toAdmin = subs.filter(s => s.acting === KU.admin());
  ok(80, before === 4 && subs.length === openRecs && empty.length === 0,
    `молчание контракта трактуется в безопасную сторону: было подмен ${before}, при молчащем модуле сотрудников — ${subs.length} из ${openRecs} закреплений, и ни одного пустого действующего (ИУ-23)`);

  ok(81, toAdmin.length >= 1 && toAdmin.every(s => /администратор/.test(s.actingStep)),
    `лестница доходит до администратора там, где объект держит сама заведующая: ${toAdmin.map(s => s.objId).join(', ')} → ${nm(KU.admin())} (ИУ-23)`);

  const assignedSame = snap() === assignedBefore;
  const drift = KU.state.journal.filter(r => r.src === 'подмена').length;
  KU.setHr(true);
  ok(82, KU.state.journal.length === jbefore && drift === 0 && assignedSame &&
        KU.substitutions(TODAY).length === before,
    `подмена журнала не пишет и закрепления не двигает: записей ${KU.state.journal.length}, записей «подмена» ${drift}; контракт заговорил — подмен снова ${before} (ИУ-21)`);
})();

/* ---------- R. Период ответственности (ИУ-24) ---------- */
(() => {
  KU.seed();
  const r91 = KU.respOf('КД-2025/091', 'cur_loan', TODAY);
  ok(83, r91.days === 225 && r91.cutDays === 10 && r91.net === 215 &&
        r91.cuts.length === 1 && r91.cuts[0].banId === 'b2' && /вычтено отстранением/.test(r91.text),
    `период ответственности = отрезок журнала минус отстранение: ${r91.days} раб. дн., вычтено ${r91.cutDays}, чистых ${r91.net} (ИУ-24)`);

  const r72 = KU.respOf('КД-2025/072', 'cur_loan', TODAY);
  ok(84, r72.cutDays === 0 && r72.cuts.length === 0 && /целиком/.test(r72.text),
    `чужое отстранение период не режет: у ${nm(r72.empId)} по КД-2025/072 ${r72.days} раб. дн. целиком`);

  KU.state.role = 'admin';
  KU.banLift('b2', '2026-08-10', 'обстоятельства отпали');
  const cut = KU.respOf('КД-2025/091', 'cur_loan', TODAY);
  ok(85, cut.cutDays === 6 && cut.net === 219 && cut.cuts[0].to === '2026-08-10',
    `снятие сокращает вычет, но не отменяет его задним числом: было 10 раб. дн., стало ${cut.cutDays} (03.08—10.08) — ИУ-4`);
})();

/* ---------- S. Ведущий куратор заёмщика (P18-R16, ИУ-14, ИУ-25) ---------- */
(() => {
  KU.seed();
  const derived = KU.dict.DERIVED.id;
  const inJournal = KU.state.journal.filter(r => r.role === derived);
  const stored = KU.state.objects.filter(o => o.lead || o.leadCurator);
  ok(86, inJournal.length === 0 && stored.length === 0 && typeof KU.lead === 'function',
    `«${KU.dict.DERIVED.name}» не назначается и нигде не лежит: записей журнала с этой ролью ${inJournal.length}, полей на объектах ${stored.length} — вычисляется (ИУ-14)`);

  const now  = KU.lead('ОсОО «Ак-Жол»', TODAY);
  const next = KU.lead('ОсОО «Ак-Жол»', '2026-09-01');
  ok(87, now.ok && now.start === '2026-08-01' && now.objId === 'КД-2025/033' &&
        now.empId === 'e_bekova' && now.money.kgs === 17900000 && now.money.cur === 'USD' &&
        next.ok && next.objId === 'КД-2024/117' && next.empId === 'e_ivanov',
    `наибольший ОД на начало периода, валюта по курсу НБКР: на ${now.start} ведёт ${now.name} (${now.objId}, ${now.money.od} ${now.money.cur} = ${now.money.kgs} сом); погашение 10.08 внутри периода ответа не двигает, с 01.09 ведёт ${next.name} (${next.objId}) — ИУ-25`);

  const tie = KU.lead('ОсОО «Ак-Жол»', '2025-01-01');
  ok(88, tie.ok && tie.tie === true && tie.objId === 'КД-2024/117' &&
        /раньше/.test(tie.step),
    `равенство остатков разрешается ранним договором: ${tie.objId} против КД-2024/205 — ведёт ${tie.name}`);

  const closed = KU.lead('ОсОО «Береке»', TODAY);
  const appOnly = KU.lead('ОсОО «Мыкты Сервис»', TODAY);
  const none = KU.lead('ОсОО «Нет такого»', TODAY);
  ok(89, closed.ok && closed.objId === 'КД-2023/210' && /последнего закрытого/.test(closed.step) &&
        appOnly.ok && appOnly.objId === 'ЗК-2026/047' && /последней заявки/.test(appOnly.step) &&
        !none.ok && none.empty === true,
    `лестница ведущего: нет действующих кредитов — ${closed.name} по последнему закрытому; кредитов нет вовсе — ${appOnly.name} по заявке; объектов нет — законная пустота`);
})();

/* ---------- T. Гейт увольнения и перевод хвостов (P18-R17, ИУ-26) ---------- */
(() => {
  KU.seed();
  const busy = KU.dismissGate('e_bekova', TODAY);
  const free = KU.dismissGate('e_asanov', TODAY);
  ok(90, !busy.ok && busy.items.length === 1 && busy.items[0].objId === 'КД-2025/033' &&
        busy.tails === 3 && free.ok && free.tails === 2,
    `гейт держит незакрытая работа, а не число закреплений: ${nm('e_bekova')} — ${busy.items[0].objId} (${busy.items[0].why}) при ${busy.tails} хвостах; ${nm('e_asanov')} проходит при ${free.tails} (ИУ-26)`);

  const adm = KU.dismissGate(KU.admin(), TODAY);
  ok(91, !adm.ok && adm.admin === true && /вакантным не бывает/.test(adm.why),
    `администратора кураторства уволить нельзя: «${adm.why}»`);
})();

(() => {
  KU.seed();
  const st = KU.state;
  st.role = 'reader';
  const byReader = KU.moveTails('e_bekova', 'увольнение');
  st.role = 'admin';
  const bare = KU.moveTails('e_bekova', '');
  const move = KU.moveTails('e_bekova', 'увольнение работника');
  const fresh = st.journal.filter(r => r.src === 'перевод');
  const gate = KU.dismissGate('e_bekova', TODAY);
  ok(92, !byReader.ok && !bare.ok && /причина обязательна/.test(bare.why) &&
        move.ok && move.moved === 3 && fresh.length === 3 &&
        fresh.every(r => r.empId === 'e_toktogulova' && r.from === TODAY) &&
        gate.ok && gate.tails === 0,
    `хвосты переводятся одной пачкой и с причиной: ${move.moved} закреплений ушло к ${nm('e_toktogulova')} записями «перевод», после чего гейт пропускает — ${gate.why} (P18-R17)`);
})();

/* ---------- P. Гейт признака и группировки в справочнике (P18-R5, ADR-0131) ---------- */
(() => {
  /* Гейт допуска: у каждого признака объявлен ИСТОЧНИК, домен либо конечен и взят из
     справочника, либо признак числовой и несёт разбиение. Ничего третьего в справочнике нет. */
  KU.seed();
  const F = KU.dict.FEATURES;
  const srcOK  = F.every(f => f.src === 'borrower' || f.src === 'self');
  const domOK  = F.every(f => f.num ? Array.isArray(f.cutsDefault) && f.cutsDefault.length
                                    : Array.isArray(f.domain) && f.domain.length > 1);
  const kindOK = F.every(f => f.obj.length && f.obj.every(k => !!KU.kind(k)));
  ok(93, F.length === 12 && srcOK && domOK && kindOK,
    `справочник признаков ${F.length}: у каждого объявлен источник (заёмщик ${
      F.filter(f => f.src === 'borrower').length} · объект ${F.filter(f => f.src === 'self').length
      }), домен конечен либо признак числовой — ADR-0131`);

  /* Заёмщицкий признак на объекте НЕ хранится: у всех объектов заёмщика он один, и
     меняется он у заёмщика — сразу для всех (ADR-0131, ADR-0001). */
  KU.seed();
  const akObjs = KU.state.objects.filter(o => o.borrower === 'ОсОО «Ак-Жол»');
  const noCopy = akObjs.every(o => !('otrasl' in (o.f || {})) && !('terr' in (o.f || {}) && o.kind !== 'coll'));
  const before = akObjs.map(o => KU.featVal(o, 'otrasl'));
  const chg = KU.setFeature('КД-2024/117', 'otrasl', 'Пищевая и перерабатывающая');
  const after = akObjs.map(o => KU.featVal(o, 'otrasl'));
  ok(94, noCopy && chg.ok && before.every(v => v === 'Агропромышленный комплекс') &&
        after.every(v => v === 'Пищевая и перерабатывающая') && akObjs.length > 1,
    `заёмщицкий признак объект не хранит: правка отрасли у заёмщика прошла разом по ${akObjs.length
      } объектам «ОсОО «Ак-Жол»» — копии на объекте нет (ADR-0131, ADR-0001)`);

  /* Редакция хранит ССЫЛКУ на группировку, а не раскладку: снять ссылку — и ключ режет
     домен как есть, а имена переносятся туда, где ответ доказуемо тот же. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');
  const v0 = KU.verAt(rule, TODAY);
  KU.keyDraftInit(rule.id);
  KU.grpPick(rule.id, 'terr', '');                     // снять группировку — домен как есть
  KU.setEff(rule.id, '2026-09-01');
  const saved = KU.saveKey(rule.id);
  const nv = KU.verAt(rule, '2026-09-01');
  const cov = KU.coverage(rule, '2026-09-01');
  ok(95, v0.grp && v0.grp.terr === 'g_terr_oblast' && !v0.groups && saved.ok &&
        !nv.grp.terr && cov.cells.length === KU.dom('terr').length &&
        nv.cells['Кара-Сууйский'] === v0.cells['Ошская'] && saved.kept === 5 && saved.holes === 5,
    `редакция хранит ссылку на группировку, а не раскладку: было ${KU.space(v0, TODAY).length
      } долей «${KU.grpDef('terr', v0.grp.terr).name}», стало ${cov.cells.length
      } значений домена, имя перенесено в ${saved.kept} (Кара-Сууйский унаследовал ${
      nm(nv.cells['Кара-Сууйский'])} у «Ошская»), дыр ${saved.holes} — ADR-0131`);

  /* Открытая доля: «Предприятия прочих отраслей» ни к одному блоку не отнесены и попадают
     в «Прочие» — ячейка есть всегда, пополнение справочника не оставляет объект без ответа. */
  KU.seed();
  const top = KU.topRule('cur_loan'), tv = KU.verAt(top, TODAY);
  const blocks = KU.groupsOf(tv, 'otrasl', TODAY);
  KU.setFeature('КД-2026/012', 'otrasl', 'Предприятия прочих отраслей');
  const inOther = KU.cellObjects(top, KU.OTHER, TODAY).map(o => o.id);
  const decOther = KU.decide('КД-2026/012', 'cur_loan', TODAY);
  ok(96, blocks[blocks.length - 1] === KU.OTHER && blocks.length === 4 &&
        inOther.indexOf('КД-2026/012') >= 0 && decOther.ok && decOther.empId === KU.admin(),
    `у растущего домена доля открыта: доли «По блокам» — ${blocks.join(' · ')}; отрасль вне блоков ` +
    `сажает объект в «${KU.OTHER}», ячейка не названа — держит ${nm(decOther.empId)} (ИУ-8, ИУ-9)`);

  /* Группировка версионируется своими редакциями: ответ на дату берёт ту, что действовала
     тогда, — правка справочника прошлое не переписывает. */
  KU.seed();
  const ref = { grp: { vidzalog: 'g_zalog_likvid' } };
  const wasThen = KU.groupOf(ref, 'vidzalog', 'Товары в обороте', TODAY);
  const wasLater = KU.groupOf(ref, 'vidzalog', 'Товары в обороте', '2026-09-01');
  const vOld = KU.grpVer('vidzalog', 'g_zalog_likvid', TODAY);
  const vNew = KU.grpVer('vidzalog', 'g_zalog_likvid', '2026-09-01');
  ok(97, wasThen === 'Неликвидное' && wasLater === 'Ликвидное' && vOld.no === 1 && vNew.no === 2 &&
        vOld.until === '2026-08-31',
    `группировка версионируется своими редакциями: «Товары в обороте» на ${TODAY} — «${wasThen
      }» (ред. ${vOld.no}), на 2026-09-01 — «${wasLater}» (ред. ${vNew.no}); прошлое не переписано (ИУ-10, ИУ-11)`);

  /* Числовой признак: доли задают ПОРОГИ, и они объявляются в редакции правила, а не в
     справочнике — единого разбиения денег по холдингу нет. Группировкой его не резать. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const r3 = KU.lowRule('u_agro', 'cur_loan');
  KU.keyDraftInit(r3.id);
  const noGrp = KU.grpPick(r3.id, 'terr', 'g_zalog_dvizh');   // чужая группировка
  KU.keyDraftAdd(r3.id, 'summa');
  const cuts = KU.cutsSet(r3.id, 'summa', '5000000, 15000000');
  const bad = KU.cutsSet(r3.id, 'summa', '5000000, -1');
  KU.setEff(r3.id, '2026-09-01');
  const s4 = KU.saveKey(r3.id);
  const n4 = KU.verAt(r3, '2026-09-01');
  const bands = KU.groupsOf(n4, 'summa', '2026-09-01');
  const cell117 = KU.keyVal(n4, KU.obj('КД-2024/117'), '2026-09-01');
  ok(98, !noGrp.ok && cuts.ok && !bad.ok && s4.ok &&
        n4.cuts.summa.join() === '5000000,15000000' && !n4.grp.summa &&
        bands.length === 3 && cell117 === 'Ошская | от 15 000 000',
    `пороги числового признака живут в редакции правила: доли — ${bands.join(' · ')}, ` +
    `КД-2024/117 встал в «${cell117}»; чужая группировка отбита («${noGrp.why}»), ` +
    `отрицательный порог тоже — ADR-0131`);
})();

/* ---------- U. Заведение группировки в справочнике (волна 4, ADR-0131, ИУ-6) ---------- */
(() => {
  /* Владелец справочника один: группировка едина на холдинг, и заводит её администратор
     кураторства. Числовой признак ею не режется — его пороги живут в редакции правила. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const byHead = KU.grpDraftNew('vidzalog');
  KU.state.role = 'admin';
  const byAdmin = KU.grpDraftNew('vidzalog');
  const num = KU.grpDraftNew('summa');
  ok(99, !byHead.ok && /только читает/.test(byHead.why) && byAdmin.ok && !num.ok &&
        /числовой/.test(num.why),
    `справочник признаков правит один администратор кураторства: заведующему отказ («${
      byHead.why.split(':')[0]}»), числовому признаку тоже («${num.why.split('—')[1].trim()}»)`);

  /* Заведение целиком: раскладка списывается с колонки справочника-источника один раз,
     дальше живёт своей жизнью. Дата вступления — не раньше сегодня (ИУ-10). */
  const fill = KU.grpDraftFill('p_zalog_tech');
  KU.grpDraftSet('from', '2026-08-14');
  const past = KU.grpSave();
  KU.grpDraftSet('from', '2026-09-01');
  const made = KU.grpSave();
  const def = made.ok ? KU.grpDef('vidzalog', made.id) : null;
  const parts = made.ok ? KU.groupsOf({ grp: { vidzalog: made.id } }, 'vidzalog', '2026-09-01') : [];
  ok(100, fill.ok && !fill.clash && !past.ok && /в прошлом/.test(past.why) && made.ok &&
        def && def.versions.length === 1 && def.versions[0].from === '2026-09-01' &&
        parts.length === 2 && parts[parts.length - 1] === KU.OTHER,
    `группировка заводится целиком и с предзаполнением из колонки: «${def && def.name}» вступает ` +
    `01.09.2026, доли — ${parts.join(' · ')}; вчерашняя дата отбита («${past.why.split('—')[0].trim()}») — ИУ-10`);

  /* Имена долей уникальны в пределах признака: одно имя — один смысл, иначе витрины двух
     подразделений не складываются. Служебную «Прочие» рукой не заводят (ИУ-6, ИУ-9). */
  KU.seed(); KU.state.role = 'admin';
  KU.grpDraftNew('vidzalog');
  KU.grpDraftSet('name', 'Дубль'); KU.grpDraftSet('from', '2026-09-01');
  KU.grpDraftMap('Недвижимое имущество', 'Недвижимое');
  const dup = KU.grpSave();
  KU.grpDraftMap('Недвижимое имущество', KU.OTHER);
  const sys = KU.grpSave();
  KU.grpDraftDrop();
  ok(101, !dup.ok && /уже занята группировкой/.test(dup.why) && !sys.ok &&
        /заводит система/.test(sys.why),
    `имя доли уникально в пределах признака: «${dup.why.split(':')[0]}»; служебную долю рукой не завести — ` +
    `«${KU.OTHER}» есть в каждой группировке и держит неотнесённое (ИУ-6, ИУ-9)`);

  /* Снятие: удаления нет, есть дата. Обратный индекс отвечает, кто на группировку смотрит,
     и отказывает списком держателей — иначе снятие было бы слепым (ИУ-11). */
  KU.seed(); KU.state.role = 'admin';
  const free = KU.grpRetire('vidzalog', 'g_zalog_organ', '2026-09-01');
  const held = KU.grpRetire('vidzalog', 'g_zalog_dvizh', '2026-09-01');
  const hold = KU.grpUsageAfter('vidzalog', 'g_zalog_dvizh', '2026-09-01');
  const backOK = KU.grpActs('vidzalog', 'g_zalog_organ', TODAY) &&
                 !KU.grpActs('vidzalog', 'g_zalog_organ', '2026-09-01');
  ok(102, free.ok && !held.ok && hold.length === 2 && backOK &&
        hold.every(u => held.why.indexOf(KU.usageName(u)) >= 0),
    `снятие — датой и только вслепую нельзя: свободную сняли с 01.09.2026, на занятую отказ со списком ` +
    `держателей (${hold.map(KU.usageName).join('; ')}); прошлые ответы снятой воспроизводятся — ИУ-10, ИУ-11`);

  /* Редакция правила бессрочна: сославшись на уходящую группировку, она пережила бы её и
     после снятия отвечала бы заглушкой. Ссылка сверяется ещё раз при сохранении ключа. */
  KU.state.role = 'head'; KU.state.headUnit = 'u_ozo';
  const rOzo = KU.lowRule('u_ozo', 'cur_coll');
  KU.keyDraftInit(rOzo.id);
  const going = KU.grpPick(rOzo.id, 'vidzalog', 'g_zalog_organ');
  KU.state.role = 'admin';
  KU.grpDraftNew('terr'); KU.grpDraftFill('p_terr_obl');
  KU.grpDraftSet('name', 'Зоны'); KU.grpDraftSet('from', '2026-10-01');
  Object.keys(KU.state.grpDraft.map).forEach(k => KU.grpDraftMap(k, KU.state.grpDraft.map[k] + ' зона'));
  const zones = KU.grpSave();
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const rAgro = KU.lowRule('u_agro', 'cur_loan');
  KU.keyDraftInit(rAgro.id);
  const soon = KU.grpPick(rAgro.id, 'terr', zones.id);
  KU.setEff(rAgro.id, '2026-10-01');
  const later = KU.grpPick(rAgro.id, 'terr', zones.id);
  const savedZ = KU.saveKey(rAgro.id);
  ok(103, !going.ok && /снимается с/.test(going.why) && zones.ok &&
        !soon.ok && /ещё не действует/.test(soon.why) && later.ok && savedZ.ok &&
        KU.verAt(rAgro, '2026-10-01').grp.terr === zones.id,
    `датные проверки ссылки: на уходящую — «${going.why.split('—')[1].trim()}», на будущую — ` +
    `«${soon.why.split('—')[1].trim()}»; после сдвига редакции на 01.10.2026 ссылка принята и сохранена`);

  /* Осиротевшая доля: сохранить можно, но молча имя ячейки не переносится — задача летит
     владельцу задетого правила со сроком, а не успел — сработает фолбэк (ИУ-8). */
  KU.seed(); KU.state.role = 'admin';
  KU.grpDraftVer('vidzalog', 'g_zalog_dvizh');
  Object.keys(KU.state.grpDraft.map).forEach(k => {
    if (KU.state.grpDraft.map[k] === 'Недвижимое') KU.grpDraftMap(k, '');
  });
  KU.grpDraftSet('from', '2026-09-01');
  const ver2 = KU.grpSave();
  const tasks = KU.state.tasks;
  KU.state.role = 'head'; KU.state.headUnit = 'u_osh';
  const mineHead = KU.myTasks().length;
  KU.state.role = 'admin';
  const mineAdmin = KU.myTasks().length;
  const ref = { grp: { vidzalog: 'g_zalog_dvizh' } };
  const nowParts = KU.groupsOf(ref, 'vidzalog', '2026-09-01');
  const thenParts = KU.groupsOf(ref, 'vidzalog', TODAY);
  ok(104, ver2.ok && ver2.ver === 2 && ver2.orphans === 2 && ver2.rules === 2 &&
        tasks.length === 2 && mineHead === 1 && mineAdmin === 1 &&
        tasks.every(t => /пересоберите ячейки/.test(t.text) && t.due === '2026-09-01') &&
        nowParts.join() === 'Движимое,' + KU.OTHER &&
        thenParts.join() === 'Недвижимое,Движимое,' + KU.OTHER,
    `убранная доля не переносится молча: редакция ${ver2.ver} осиротила ${ver2.orphans} ячейки в ${
      ver2.rules} правилах, задачи ушли их владельцам со сроком 01.09.2026 (заведующему ${mineHead
      }, администратору ${mineAdmin}); на ${TODAY} доли прежние — ${thenParts.join(' · ')} (ИУ-8, ИУ-11)`);

  /* «Прочие» есть в каждой группировке, даже когда домен разложен без остатка: справочник
     значений растёт, и новое значение обязано попасть в существующую ячейку (ИУ-9). */
  KU.seed(); KU.state.role = 'admin';
  KU.grpDraftNew('forma');
  KU.grpDraftSet('name', 'Публичная и прочая'); KU.grpDraftSet('from', TODAY);
  const dom = KU.dom('forma');
  dom.forEach(x => KU.grpDraftMap(x, x === 'Частная' ? 'Частная форма' : 'Публичная форма'));
  const full = KU.grpSave();
  const fullRef = { grp: { forma: full.id } };
  const fullParts = KU.groupsOf(fullRef, 'forma', TODAY);
  const loose = KU.groupOf(fullRef, 'forma', 'Кооперативная', TODAY);   // значения в домене ещё нет
  ok(105, full.ok && dom.every(x => !!KU.grpVer('forma', full.id, TODAY).map[x]) &&
        fullParts.length === 3 && fullParts[fullParts.length - 1] === KU.OTHER &&
        loose === KU.OTHER,
    `«${KU.OTHER}» есть всегда: домен «${KU.feat('forma').name}» разложен без остатка, доли — ${
      fullParts.join(' · ')}; значение, которого в домене ещё нет, садится в «${loose}» — ИУ-9`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-17 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const marker = 'SMOKE (node scripts/inspect/kuratorstvo-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку kuratorstvo.html');
}

process.exit(pass === results.length ? 0 : 1);
