// Headless смоук для mockups/kuratorstvo/kuratorstvo.html — макет передаётся разработчику как
// ЭТАЛОН ЛОГИКИ, поэтому дефект в нём копируется в реализацию: смоук стоит именно против этого.
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Разделы (буква = блок кода ниже, номера проверок идут подряд):
//   A–E  каркас: виды и роли справочником, журнал append-only, обе ступени правила на живых
//        данных, фолбэк-лестница с порогами давности, шов curatorOn;
//   F–I  правило: кто правит, редакции (вступают днём сохранения и применяются сразу),
//        покрытие и пустоты, сторож текста (ИУ/ADR названы, имён в движке нет);
//   J–N  движение закрепления: рождение и снимок признаков, автоприменение с квитанцией
//        «было → стало», рука и возврат к правилу, ретро-правка до запертого дня;
//   O–Q  ответственность: два ответа (закреплённый и действующий) с лестницей замещения,
//        период с вычетом отсутствий, ведущий куратор заёмщика вычислением;
//   R–T  справочник признаков и группировки: гейт неназванного источника, редакции группировки
//        и снятие по обратному индексу, уникальность долей, «Прочие» всегда, сверенность
//        домена и объявленная попарная сочетаемость;
//   U    время и редакции (#93–#99): правка вслепую отбита со срезом в прошлом, вторая правка
//        того же дня ДОПИСЫВАЕТ редакцию, впереди действующей редакции пусто;
//   V    готовность к передаче (#100–#105): пакет объявлен в шапке, карта «экран → карточки»
//        покрывает все 14, «сегодня» заморожено, пятая роль названа паузой, адрес домена — именем,
//        экраны без пояснений (примечаний, сносок, подсказок и внутренних номеров на них нет).
// Инвариантов ИУ-26, из них пять снято волной 6 (17, 18, 21, 22, 26) — номера не переиспользуются;
// ADR-0118 отменён целиком, ADR-0023 сузился до требования в Взыскании. Пересчёта как операции,
// очереди передач и реестра отстранений в модуле НЕТ — решение заказчика, а не пробел смоука.
// Блоки, которые правят состояние, начинаются с KU.seed() — состояние между ними не течёт.
// Отчёт вписывается в шапку макета после маркера «SMOKE (node …):»; выход 1 при любом FAIL.
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

/* ---------- G. Редакции: вступают днём сохранения и применяются сразу (волна 6) ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');

  ok(27, typeof KU.setEff !== 'function' && KU.effOf(rule.id) === TODAY,
    `даты вступления в будущем нет и выбрать её нечем: редакция вступает днём сохранения (${
      TODAY}) — ждать её было бы некому, фонового пересчёта в модуле не существует (ИУ-10, ИУ-16)`);

  const before = rule.versions.length;
  const holeBefore = on('КД-2026/012', 'cur_loan');
  const res = KU.setCell(rule.id, 'Таласская', 'e_asanov');
  const nv = KU.verAt(rule, TODAY);
  const prev = rule.versions.find(v => v.no === nv.no - 1);
  ok(28, res.ok && rule.versions.length === before + 1 && nv.no === res.ver && nv.from === TODAY &&
        nv.cells['Таласская'] === 'e_asanov' && prev.until === '2026-08-14' &&
        KU.verStatus(nv) === 'действующая',
    `правка завела редакцию ${res.ver}, и она вступила сегодня; предыдущая закрыта ${
      prev.until} — интервалы не пересекаются, прошлое не переписано (ИУ-10)`);

  const holeAfter = on('КД-2026/012', 'cur_loan');
  const rec = KU.journalOf('КД-2026/012', 'cur_loan').slice(-1)[0];
  ok(29, holeBefore.fallback === true && holeAfter.fallback === false &&
        holeAfter.assigned === 'e_asanov' && rec.at === 'применение правила' &&
        rec.src === 'правило' && rec.ver.no === nv.no && rec.from === TODAY,
    `правило применилось само и сразу: пустую ячейку держала ${holeBefore.assignedName}, теперь ведёт ${
      holeAfter.assignedName} записью «${rec.at}» со ссылкой на редакцию ${rec.ver.no} — кнопки «пересчитать» нет (ИУ-16)`);

  const ch = KU.state.changes[0];
  ok(30, KU.state.changes.length === 1 && ch.moved === res.moved && ch.scanned === 9 &&
        ch.moved === 4 && ch.manual === 2 && ch.ver === nv.no && ch.kind === 'ячейка' &&
        KU.loadDiff(ch).length === 4,
    `у операции остался ровно один след — квитанция: пересмотрено ${ch.scanned}, переставлено ${
      ch.moved}, рукой держится ${ch.manual}, нагрузка сменилась у ${KU.loadDiff(ch).length} работников (ИУ-16)`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'admin';
  const top = KU.topRule('spec_app');
  const was = on('ЗК-2026/047', 'spec_app');
  const jb = KU.state.journal.length;
  const res = KU.setCell(top.id, 'Услуги', 'u_ind');
  const now = on('ЗК-2026/047', 'spec_app');
  const rec = KU.journalOf('ЗК-2026/047', 'spec_app').slice(-1)[0];
  ok(31, res.ok && KU.state.journal.length === jb + 1 && rec.unitId === 'u_ind' &&
        rec.at === 'применение правила' && was.unitId !== 'u_ind',
    `верхняя ступень больше не родильная: правка переставила живущую заявку в ${
      KU.unit(rec.unitId).name} — иначе после отмены передач отдел было бы не сменить ничем (ИУ-7)`);

  ok(32, now.assigned === KU.headOf('u_ind') && now.fallback === true && rec.src === 'фолбэк',
    `обе ступени отработали одной записью: отдел дало правило холдинга, имя — фолбэк принимающего отдела (${
      now.assignedName}); приёма и очереди между ними нет (ИУ-12)`);
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
  const saved = KU.saveKey(rule.id);
  const nv = KU.verAt(rule, TODAY);
  /* Имя переносится там, где ответ доказуемо не меняется: у «Ошской» был один куратор —
     значит он же ведёт и «Ошская | Частная», и «Ошская | Государственная». «Таласская»
     имени не имела — из неё выходят дыры. Второй признак группировкой не резан:
     форма собственности встаёт в ключ доменом справочника, всеми четырьмя значениями.
     Восемь областей плюс обязательная доля «Прочие» — девять на четыре формы, 36 ячеек. */
  ok(34, saved.ok && nv.key.join('+') === 'terr+forma' && KU.space(nv, TODAY).length === 36 &&
        Object.keys(nv.cells).length === 16 && saved.kept === 16 && saved.holes === 20 &&
        nv.grp.terr === 'g_terr_oblast' && !nv.grp.forma &&
        nv.cells['Ошская | Частная'] === 'e_ivanov' && !nv.cells['Таласская | Частная'] &&
        KU.state.changes.length === 1 && KU.state.changes[0].kind === 'ключ',
    `смена ключа — тоже редакция и тоже применяется сразу: ячеек ${KU.space(nv, TODAY).length}, имя перенесено в ${saved.kept} (ответ не меняется), дыр ${saved.holes}, переставлено ${KU.state.changes[0].moved} из ${KU.state.changes[0].scanned}`);
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

  const nav = (src.match(/class="nav-item"/g) || []).length;
  const titles = (m[1].match(/const TITLES = \{[\s\S]*?\};/) || [''])[0];
  const keys = (titles.match(/(\w+):/g) || []).map(s => s.replace(':', ''));
  const dead = ['viewRecalc', 'viewHandoffs', 'viewBans', 'viewStub', 'KU.recalcPreview',
    'KU.handoffSend', 'KU.banAdd', 'KU.dismissGate', 'KU.moveTails', 'KU.setEff']
    .filter(x => m[1].includes(x));
  ok(41, nav === 3 && keys.join(',') === 'feat,pol,chg' && dead.length === 0 &&
        /ГРАНИЦЫ МАКЕТА/.test(src) && !/STUBS/.test(m[1]),
    `экранов три и заглушек нет: ${keys.join(' · ')}; пересчёт, передачи, витрины и отстранения ` +
    `сняты волной 6 — ни одной мёртвой функции в файле не осталось${dead.length ? ' · жива: ' + dead.join(',') : ''}`);
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

  /* Территория — признак ЗАЁМЩИКА: правится она у «ОсОО «Дан-Азык»», а не на кредите.
     Волна 6: смена признака тоже применяет правило — «живут вне правила» больше не копится,
     потому что витрины, где это было бы видно, больше нет. */
  const wasAssigned = on('КД-2025/091', 'cur_loan').assigned;
  const chg = KU.setFeature('КД-2025/091', 'terr', 'Чуйский');
  const nowAssigned = on('КД-2025/091', 'cur_loan').assigned;
  const snapKept = KU.journalOf('КД-2025/091', 'cur_loan')[0].snap.terr;
  const off = KU.offRule('КД-2025/091', 'cur_loan', TODAY);
  const chRec = KU.state.changes[0];
  ok(44, chg.ok && nowAssigned === 'e_asanov' && nowAssigned !== wasAssigned && off === null &&
        snapKept === 'Кара-Сууйский' && chRec.kind === 'признак' && chRec.scanned === 1 && chRec.moved === 1,
    `признак поменялся в соседнем модуле — правило применилось сразу: вёл ${nm(wasAssigned)}, ведёт ${
      nm(nowAssigned)}, расхождения с правилом нет; прежняя запись хранит снимок «${snapKept}» — по нему видно, чем решали тогда (ИУ-15, ИУ-16)`);

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

/* ---------- K. Автоприменение: рука, подразделение, квитанция (волна 6, ИУ-16, ИУ-19) ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');
  const hand = KU.assignByHand('КД-2025/091', 'cur_loan', 'e_asanov', null, 'выравнивание нагрузки');
  const res = KU.setCell(rule.id, 'Ошская', 'e_toktogulova');
  const a = on('КД-2025/091', 'cur_loan');
  const ch = KU.state.changes[0];
  ok(47, hand.ok && res.ok && a.assigned === 'e_asanov' && a.src === 'рука' &&
        ch.manual === 3 && ch.moved + ch.manual <= ch.scanned,
    `ручное закрепление правку правила пережило: ${a.assignedName} держится источником «${a.src}», ` +
    `в квитанции таких ${ch.manual} из ${ch.scanned} — иначе «просто поменять куратора рукой» отменяла бы первая же правка (ИУ-19)`);

  const back = KU.backToRule('КД-2025/091', 'cur_loan');
  const after = on('КД-2025/091', 'cur_loan');
  ok(48, back.ok && after.assigned === 'e_toktogulova' && after.src === 'правило',
    `возврат к правилу — единственная дорога назад: объект снова ведёт ${after.assignedName} по правилу (ИУ-19)`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'admin';
  const top = KU.topRule('cur_loan');
  const cell = KU.keyVal(KU.verAt(top, TODAY), KU.obj('КД-2025/033'), TODAY);
  const was = on('КД-2025/033', 'cur_loan');
  const res = KU.setCell(top.id, cell, 'u_ind');
  const now = on('КД-2025/033', 'cur_loan');
  const rec = KU.journalOf('КД-2025/033', 'cur_loan').slice(-1)[0];
  const hand = on('КД-2024/205', 'cur_loan');       /* та же ячейка, но закреплено рукой */
  ok(49, res.ok && was.unitId === 'u_agro' && now.unitId === 'u_ind' && rec.from === TODAY &&
        rec.at === 'применение правила' && rec.unitId === 'u_ind' && rec.empId !== was.assigned &&
        KU.state.handoffs === undefined && hand.unitId === 'u_agro' && hand.src === 'рука',
    `верхняя ступень переставляет живущий объект без всякой передачи: ячейка «${cell}» → ${
      KU.unit('u_ind').name}, и КД-2025/033 уехал одной записью журнала (${KU.unit(was.unitId).name} → ${
      KU.unit(now.unitId).name}, ${was.assignedName} → ${now.assignedName} с ${rec.from}); ` +
    `очереди передач и приёма в модуле нет вовсе, а ручное закрепление КД-2024/205 осталось в ${
      KU.unit(hand.unitId).name} (ИУ-12, ИУ-19)`);

  const dbl = KU.setCell(top.id, cell, 'u_ind');
  ok(50, dbl.ok && dbl.moved === 0 && KU.state.changes[0].moved === 0,
    `повторная правка тем же значением никого не двигает: переставлено ${dbl.moved} — применение идемпотентно (ИУ-16)`);
})();

/* ---------- L. Квитанция «что изменилось»: считает за свою правку (волна 6) ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');
  KU.setCell(rule.id, 'Таласская', 'e_asanov');
  const first = KU.state.changes[0];
  KU.setCell(rule.id, 'Таласская', 'e_bekova');
  const second = KU.state.changes[0];
  ok(51, KU.state.changes.length === 2 && KU.state.changes[0].id !== first.id &&
        first.scanned === 9 && second.moved === 1 &&
        JSON.stringify(first.before) !== JSON.stringify(second.before),
    `строка отвечает за СВОЮ правку и задним числом не пересчитывается: первая переставила ${
      first.moved}, вторая — ${second.moved}; «что сделала редакция» и «сколько сейчас» — разные вопросы (ИУ-10)`);

  const d = KU.loadDiff(second);
  const sum = d.reduce((n, x) => n + (x.now - x.was), 0);
  ok(52, d.length === 2 && sum === 0 && d[0].now > d[0].was && d[d.length - 1].now < d[d.length - 1].was,
    `нагрузка «было → стало» сходится: ${d.map(x => x.name + ' ' + x.was + '→' + x.now).join(', ')} — ` +
    `сумма разниц ${sum}, объекты не исчезают и не рождаются (ИУ-11)`);
})();
/* ---------- M. Рука и возврат к правилу (P18-R13, ИУ-19) ---------- */
(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const bare  = KU.assignByHand('КД-2025/091', 'cur_loan', 'e_asanov', null, '');
  const alien = KU.assignByHand('КД-2025/091', 'cur_loan', 'e_duishev', null, 'нужен именно он');
  ok(53, !bare.ok && /причина обязательна/.test(bare.why) && !alien.ok &&
        /сначала правилом меняется подразделение/.test(alien.why),
    `закрепление рукой: без причины нельзя — «${bare.why}»; работник чужого отдела — «${alien.why}» (ИУ-12, ИУ-19)`);

  const was = on('КД-2025/072', 'cur_loan');
  const hand = KU.assignByHand('КД-2025/072', 'cur_loan', 'e_ivanov', null, 'знает заёмщика');
  const rec = KU.journalOf('КД-2025/072', 'cur_loan').slice(-1)[0];
  ok(54, hand.ok && rec.src === 'рука' && rec.ver === null && rec.reason === 'знает заёмщика' &&
        typeof KU.banAdd === 'undefined' && typeof KU.bansOf === 'undefined' &&
        KU.state.bans === undefined &&
        KU.state.objects.filter(o => o.ban || o.off || o.coi).length === 0 &&
        KU.state.journal.filter(r => /отстран/i.test(r.src || '')).length === 0,
    `отстранения в модуле нет вовсе — снято волной 6: назначение, которое раньше запрещал реестр, проходит ` +
    `(${was.assignedName} → ${nm('e_ivanov')}, источник «${rec.src}» без редакции); ни реестра, ни поля на объекте, ни записи журнала`);
})();

(() => {
  /* Расхождение «журнал против правила» после волны 6 умеет быть только ручным: правило
     применяется само, поэтому объект по правилу отстать от него не может. Затравка держит
     три таких расхождения из прошлых волн — первое же применение их подбирает. */
  KU.seed();
  const diverging = () => KU.state.journal.filter(r => r.to == null)
    .map(r => ({ objId: r.objId, src: on(r.objId, r.role).src, off: KU.offRule(r.objId, r.role, TODAY) }))
    .filter(x => x.off);
  const seeded = diverging();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const rule = KU.lowRule('u_agro', 'cur_loan');
  const v = KU.verAt(rule, TODAY);
  const cell = Object.keys(v.cells)[0];
  const res = KU.setCell(rule.id, cell, v.cells[cell]);   /* пересохранение той же ячейки */
  const after = diverging();
  ok(55, res.ok && seeded.filter(x => x.src === 'правило').length === 3 &&
        after.length > 0 && after.every(x => x.src === 'рука'),
    `вне правила умеет жить только рука: в затравке расходилось ${seeded.length} закреплений, ` +
    `из них по правилу ${seeded.filter(x => x.src === 'правило').length} — пересохранение ячейки их подобрало, ` +
    `осталось ${after.length} ручных (ИУ-16, ИУ-19)`);
})();

(() => {
  KU.seed();
  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const back = KU.backToRule('КД-2024/205', 'cur_loan');
  const recs = KU.journalOf('КД-2024/205', 'cur_loan');
  const last = recs[recs.length - 1];
  const twice = KU.backToRule('КД-2024/205', 'cur_loan');
  ok(56, back.ok && last.empId === 'e_ivanov' && last.src === 'правило' && recs.length === 3 &&
        !twice.ok && /и так стоит по правилу/.test(twice.why),
    `возврат к правилу — новая запись, а не откат: ${recs.length} записи по паре, сейчас ${nm(last.empId)} по правилу; повторно — «${twice.why}»`);
})();

/* ---------- N. Ретро-правка и запертый период (P18-R14, ИУ-20) ---------- */
(() => {
  KU.seed();
  const free = KU.retroFit('КД-2025/091', 'cur_loan', '2026-07-01');
  const fit  = KU.retroFit('КД-2024/117', 'cur_loan', '2026-05-01');
  ok(57, free.moved === false && free.from === '2026-07-01' &&
        fit.moved === true && fit.from === '2026-06-16' && fit.last.d === '2026-06-15',
    `задним числом можно, пока период не заперт: свободный — с 01.07 как просили; запертый — «${fit.note}»`);

  const st = KU.state; st.role = 'head'; st.headUnit = 'u_agro';
  const res = KU.assignByHand('КД-2024/117', 'cur_loan', 'e_bekova', '2026-05-01', 'передача портфеля');
  const inside = on('КД-2024/117', 'cur_loan', '2026-06-01');
  const now = on('КД-2024/117', 'cur_loan');
  const rec = KU.journalOf('КД-2024/117', 'cur_loan').slice(-1)[0];
  ok(58, res.ok && res.from === '2026-06-16' && res.moved === true &&
        inside.assigned === 'e_ivanov' && now.assigned === 'e_bekova' && rec.retro === true,
    `дата вступления поджата к первому свободному дню: внутри запертого периода ответ прежний (${inside.assignedName}), с ${rec.from} — ${now.assignedName} (ИУ-20)`);

  const noFacts = KU.retroFit('ЗЛ-8815', 'cur_coll', '2026-08-11');
  ok(59, noFacts.moved === false && noFacts.blockers.length === 0,
    `объект без закрытых фактов ретро-правке не сопротивляется: ${noFacts.from} как просили`);
})();

/* ---------- O. Два ответа: закреплённый и действующий (ИУ-2, ИУ-23) ---------- */
(() => {
  KU.seed();
  const a = on('КД-2025/091', 'cur_loan');
  const rec = KU.journalOf('КД-2025/091', 'cur_loan').slice(-1)[0];
  ok(60, a.assigned === 'e_bekova' && a.acting === a.assigned && a.substituted === false &&
        rec.to == null && /работник на месте/.test(a.actingWhy),
    `после волны 6 ответы расходятся ТОЛЬКО из-за отсутствия: ${a.assignedName} на месте — ` +
    `закреплённый и действующий это один человек, подменять некому и незачем (ИУ-2)`);

  const dep = on('КД-2024/117', 'cur_loan');
  ok(61, dep.substituted === true && dep.acting === 'e_asanov' && /замещающий/.test(dep.actingStep) &&
        /отпуск/.test(dep.actingWhy),
    `замещающего называет модуль сотрудников, а не кураторство: ${dep.assignedName} в отпуске — работу ведёт ${dep.actingName}, ступень «${dep.actingStep}» (P12-R12, ИУ-23)`);

  const noDep = on('ТР-2025/018', 'cur_claim');
  ok(62, noDep.substituted === true && noDep.acting === 'e_abdylda' &&
        /заведующий отделом/.test(noDep.actingStep) && /замещающий не назван/.test(noDep.actingWhy),
    `замещающий не назван — работа уходит заведующему отделом: ${noDep.assignedName} → ${noDep.actingName} (ИУ-23)`);
})();

(() => {
  KU.seed();
  const open = () => KU.state.journal.filter(r => r.to == null);
  const subs = () => open().map(r => on(r.objId, r.role)).filter(x => x.substituted);
  const snap = () => open().map(r => r.objId + '‖' + r.role + '‖' + on(r.objId, r.role).assigned).join(';');
  const openRecs = open().length;
  const before = subs().length;
  const jbefore = KU.state.journal.length;
  const assignedBefore = snap();

  KU.setHr(false);
  const down = subs();
  const empty = down.filter(s => !s.acting);
  const toAdmin = down.filter(s => s.acting === KU.admin());
  ok(63, before === 3 && down.length === openRecs && empty.length === 0,
    `молчание контракта трактуется в безопасную сторону: было подмен ${before}, при молчащем модуле сотрудников — ${down.length} из ${openRecs} закреплений, и ни одного пустого действующего (ИУ-23)`);

  ok(64, toAdmin.length >= 1 && toAdmin.every(s => /администратор/.test(s.actingStep)),
    `лестница доходит до администратора там, где объект держит сама заведующая: таких закреплений ${toAdmin.length} → ${nm(KU.admin())} (ИУ-23)`);

  const assignedSame = snap() === assignedBefore;
  const drift = KU.state.journal.filter(r => r.src === 'подмена').length;
  KU.setHr(true);
  ok(65, KU.state.journal.length === jbefore && drift === 0 && assignedSame && subs().length === before,
    `подмена журнала не пишет и закрепления не двигает: записей ${KU.state.journal.length}, записей «подмена» ${drift}; контракт заговорил — подмен снова ${before} (ИУ-2)`);
})();

/* ---------- P. Период ответственности (ИУ-24) ---------- */
(() => {
  KU.seed();
  const r91 = KU.respOf('КД-2025/091', 'cur_loan', TODAY);
  ok(66, r91.days === 225 && r91.open === true && r91.cuts === undefined && r91.net === undefined &&
        /целиком/.test(r91.text),
    `период ответственности = отрезок журнала ЦЕЛИКОМ: ${r91.text} — вычитать из него после волны 6 нечего, ` +
    `отстранений нет, а вычетов «по кусочкам» модуль не считает (ИУ-24)`);

  const r117 = KU.respOf('КД-2024/117', 'cur_loan', TODAY);
  const a117 = on('КД-2024/117', 'cur_loan');
  ok(67, r117.empId === 'e_ivanov' && a117.acting === 'e_asanov' && a117.substituted === true &&
        /целиком/.test(r117.text) && r117.days === 120,
    `отсутствие период не режет: работу сегодня ведёт ${a117.actingName}, но спрос за ${r117.days} раб. дн. ` +
    `остаётся на закреплённом (${nm(r117.empId)}) — задание уходит, ответственность нет (ИУ-2, ИУ-24)`);

  const closed = KU.state.journal.filter(r => r.objId === 'КД-2024/117' && r.role === 'cur_loan' && r.to)[0];
  const past = KU.respOf('КД-2024/117', 'cur_loan', closed.to);
  ok(68, past.empId === 'e_bekova' && past.open === false && past.to === closed.to &&
        past.days === 533 && past.from !== r117.from,
    `периоды не склеиваются и закрытый не растёт: до ${past.to} отвечал ${nm(past.empId)} (${past.days} раб. дн.), ` +
    `с ${r117.from} — ${nm(r117.empId)}; вопрос «кто отвечал ТОГДА» отвечает журнал, а не сегодняшнее закрепление (ИУ-3)`);
})();

/* ---------- Q. Ведущий куратор заёмщика (P18-R16, ИУ-14, ИУ-25) ---------- */
(() => {
  KU.seed();
  const derived = KU.dict.DERIVED.id;
  const inJournal = KU.state.journal.filter(r => r.role === derived);
  const stored = KU.state.objects.filter(o => o.lead || o.leadCurator);
  ok(69, inJournal.length === 0 && stored.length === 0 && typeof KU.lead === 'function',
    `«${KU.dict.DERIVED.name}» не назначается и нигде не лежит: записей журнала с этой ролью ${inJournal.length}, полей на объектах ${stored.length} — вычисляется (ИУ-14)`);

  const now  = KU.lead('ОсОО «Ак-Жол»', TODAY);
  const next = KU.lead('ОсОО «Ак-Жол»', '2026-09-01');
  ok(70, now.ok && now.start === '2026-08-01' && now.objId === 'КД-2025/033' &&
        now.empId === 'e_bekova' && now.money.kgs === 17900000 && now.money.cur === 'USD' &&
        next.ok && next.objId === 'КД-2024/117' && next.empId === 'e_ivanov',
    `наибольший ОД на начало периода, валюта по курсу НБКР: на ${now.start} ведёт ${now.name} (${now.objId}, ${now.money.od} ${now.money.cur} = ${now.money.kgs} сом); погашение 10.08 внутри периода ответа не двигает, с 01.09 ведёт ${next.name} (${next.objId}) — ИУ-25`);

  const tie = KU.lead('ОсОО «Ак-Жол»', '2025-01-01');
  ok(71, tie.ok && tie.tie === true && tie.objId === 'КД-2024/117' &&
        /раньше/.test(tie.step),
    `равенство остатков разрешается ранним договором: ${tie.objId} против КД-2024/205 — ведёт ${tie.name}`);

  const closed = KU.lead('ОсОО «Береке»', TODAY);
  const appOnly = KU.lead('ОсОО «Мыкты Сервис»', TODAY);
  const none = KU.lead('ОсОО «Нет такого»', TODAY);
  ok(72, closed.ok && closed.objId === 'КД-2023/210' && /последнего закрытого/.test(closed.step) &&
        appOnly.ok && appOnly.objId === 'ЗК-2026/047' && /последней заявки/.test(appOnly.step) &&
        !none.ok && none.empty === true,
    `лестница ведущего: нет действующих кредитов — ${closed.name} по последнему закрытому; кредитов нет вовсе — ${appOnly.name} по заявке; объектов нет — законная пустота`);
})();

/* ---------- R. Гейт признака и группировки в справочнике (P18-R5, ADR-0131) ---------- */
(() => {
  /* Гейт допуска: у каждого признака объявлен ИСТОЧНИК, домен либо конечен и взят из
     справочника, либо признак числовой и несёт разбиение. Ничего третьего в справочнике нет. */
  KU.seed();
  const F = KU.dict.FEATURES;
  const srcOK  = F.every(f => f.src === 'borrower' || f.src === 'self');
  const domOK  = F.every(f => f.num ? Array.isArray(f.cutsDefault) && f.cutsDefault.length
                                    : Array.isArray(f.domain) && f.domain.length > 1);
  const kindOK = F.every(f => f.obj.length && f.obj.every(k => !!KU.kind(k)));
  ok(73, F.length === 12 && srcOK && domOK && kindOK,
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
  ok(74, noCopy && chg.ok && before.every(v => v === 'Агропромышленный комплекс') &&
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
  const saved = KU.saveKey(rule.id);
  const nv = KU.verAt(rule, TODAY);
  const cov = KU.coverage(rule, TODAY);
  ok(75, v0.grp && v0.grp.terr === 'g_terr_oblast' && !v0.groups && saved.ok &&
        !nv.grp.terr && cov.cells.length === KU.dom('terr').length &&
        nv.cells['Кара-Сууйский'] === v0.cells['Ошская'] && saved.kept === 7 && saved.holes === 5,
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
  ok(76, blocks[blocks.length - 1] === KU.OTHER && blocks.length === 4 &&
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
  ok(77, wasThen === 'Неликвидное' && wasLater === 'Ликвидное' && vOld.no === 1 && vNew.no === 2 &&
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
  const s4 = KU.saveKey(r3.id);
  const n4 = KU.verAt(r3, TODAY);
  const bands = KU.groupsOf(n4, 'summa', TODAY);
  const cell117 = KU.keyVal(n4, KU.obj('КД-2024/117'), TODAY);
  ok(78, !noGrp.ok && cuts.ok && !bad.ok && s4.ok &&
        n4.cuts.summa.join() === '5000000,15000000' && !n4.grp.summa &&
        bands.length === 3 && cell117 === 'Ошская | от 15 000 000',
    `пороги числового признака живут в редакции правила: доли — ${bands.join(' · ')}, ` +
    `КД-2024/117 встал в «${cell117}»; чужая группировка отбита («${noGrp.why}»), ` +
    `отрицательный порог тоже — ADR-0131`);
})();

/* ---------- S. Заведение группировки в справочнике (волна 4, ADR-0131, ИУ-6) ---------- */
(() => {
  /* Владелец справочника один: группировка едина на холдинг, и заводит её администратор
     кураторства. Числовой признак ею не режется — его пороги живут в редакции правила. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const byHead = KU.grpDraftNew('vidzalog');
  KU.state.role = 'admin';
  const byAdmin = KU.grpDraftNew('vidzalog');
  const num = KU.grpDraftNew('summa');
  ok(79, !byHead.ok && /только читает/.test(byHead.why) && byAdmin.ok && !num.ok &&
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
  ok(80, fill.ok && !fill.clash && !past.ok && /в прошлом/.test(past.why) && made.ok &&
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
  ok(81, !dup.ok && /уже занята группировкой/.test(dup.why) && !sys.ok &&
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
  ok(82, free.ok && !held.ok && hold.length === 2 && backOK &&
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
  const savedZ = KU.saveKey(rAgro.id);
  ok(83, !going.ok && /снимается с/.test(going.why) && zones.ok &&
        !soon.ok && /ещё не действует/.test(soon.why) && typeof KU.setEff === 'undefined' &&
        (KU.verAt(rAgro, TODAY).grp || {}).terr !== zones.id,
    `датные проверки ссылки: на уходящую — «${going.why.split('—')[1].trim()}», на будущую — ` +
    `«${soon.why.split('—')[1].trim()}»; обойти отказ сдвигом даты вступления больше нельзя — ` +
    `редакция вступает днём сохранения, будущая группировка просто недоступна до своей даты (волна 6)`);

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
  ok(84, ver2.ok && ver2.ver === 2 && ver2.orphans === 2 && ver2.rules === 2 &&
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
  ok(85, full.ok && dom.every(x => !!KU.grpVer('forma', full.id, TODAY).map[x]) &&
        fullParts.length === 3 && fullParts[fullParts.length - 1] === KU.OTHER &&
        loose === KU.OTHER,
    `«${KU.OTHER}» есть всегда: домен «${KU.feat('forma').name}» разложен без остатка, доли — ${
      fullParts.join(' · ')}; значение, которого в домене ещё нет, садится в «${loose}» — ИУ-9`);
})();

/* ---------- T. Сверенность домена и сочетаемость признаков (волна 5, ADR-0131) ---------- */
(() => {
  KU.seed();
  /* Отметка сверенности стоит на КАЖДОМ признаке и различает два непохожих случая:
     «источник назван, справочника ещё нет» и «источника нет вовсе». */
  const feats = KU.feats();
  const by = st => feats.filter(f => KU.sver(f.id).st === st);
  const okF = by('ok'), waitF = by('wait'), noneF = by('none');
  ok(86, feats.length === 12 && okF.length === 8 && waitF.length === 3 && noneF.length === 1 &&
        noneF[0].id === 'razmer' && okF.every(f => !!KU.sver(f.id).ref) &&
        waitF.every(f => !!KU.sver(f.id).ref && !!KU.sver(f.id).why) &&
        waitF.map(f => f.id).sort().join() === 'forma,terr,vidzaem',
    `сверенность объявлена у всех ${feats.length}: сверено ${okF.length} (у каждого ссылка file:line), ` +
    `ждут справочника ${waitF.length} (${waitF.map(f => f.name).join(', ')}), ` +
    `без названного источника ${noneF.length} — «${noneF[0].name}» (ADR-0131 п. 4)`);

  /* Гейт ключа: «ждёт справочника» пускается — источник назван, домен поедет за ним.
     «источник не назван» не пускается: ответ на дату нечем воспроизвести (ИУ-11). */
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const rl = KU.lowRule('u_agro', 'cur_loan');
  KU.keyDraftInit(rl.id);
  const noSrc = KU.keyDraftAdd(rl.id, 'razmer');
  const waits = KU.keyDraftAdd(rl.id, 'vidzaem');
  ok(87, !noSrc.ok && /не назван источник/.test(noSrc.why) &&
        /никто не ведёт/.test(noSrc.why) && waits.ok,
    `в ключ не встаёт признак без названного источника: «${noSrc.why.slice(0, 96)}…»; ` +
    `а «ждёт справочника» встаёт — «${KU.feat('vidzaem').name}» принят, плашка остаётся на признаке`);

  /* Домен режется СТРОКОЙ. Расхождение в одну букву с живым справочником не ломается
     громко — оно молча сажает объект в «Прочие», и ячейка уезжает к заведующему. */
  KU.seed();
  const dk = KU.dom('vidkred');
  const live = 'Фонд развитие регионов';          // опечатка живого справочника, credit.html:2215
  const kd = KU.obj('КД-2025/043');
  const part = KU.groupOf({ grp: { vidkred: 'g_vidkred_dengi' } }, 'vidkred', KU.featVal(kd, 'vidkred'), TODAY);
  ok(88, dk.indexOf(live) >= 0 && dk.indexOf('Фонд развития регионов') < 0 &&
        KU.featVal(kd, 'vidkred') === live && part === 'Бюджетные' && part !== KU.OTHER,
    `домен списан с живого справочника буква в букву, вместе с опечаткой «${live}»: ` +
    `КД-2025/043 встал в долю «${part}», а не в «${KU.OTHER}» — расхождение в одну букву ячейку не рвёт, ` +
    `оно молча уводит объект (credit.html:2215)`);

  /* Территория: справочника АТЕ в системе нет, домен собран из живых значений вручную —
     и потому обязан быть разложен без остатка, иначе половина районов уедет в «Прочие». */
  const terr = KU.dom('terr'), obl = KU.grpVer('terr', 'g_terr_oblast', TODAY);
  const zones = Object.keys(obl.map).map(k => obl.map[k]).filter((x, i, a) => a.indexOf(x) === i);
  ok(89, terr.length === 12 && terr.indexOf('Район') < 0 &&
        terr.every(v => !!obl.map[v]) && zones.length === 8 && KU.sver('terr').st === 'wait',
    `территория ждёт справочника АТЕ: домен — ${terr.length} живых районов без мусорного «Район», ` +
    `все разложены по ${zones.length} областям (${zones.slice(0, 3).join(', ')}…), ` +
    `отметка «${KU.sver('terr').st}» с ссылкой ${KU.sver('terr').ref}`);

  /* СОЧЕТАЕМОСТЬ. Программа сужает вид кредита: ячейка «ПРГ-1 | МАР» не дыра —
     её не закроет никто и никогда, и в мягкий предел она не идёт. */
  KU.state.role = 'head'; KU.state.headUnit = 'u_agro';
  const d1 = KU.keyDraftInit(rl.id);
  d1.key = ['progr', 'vidkred']; d1.grp = {}; d1.cuts = {};
  const all1 = KU.spaceAll(d1, TODAY), live1 = KU.space(d1, TODAY), dead1 = KU.dead(d1, TODAY);
  ok(90, all1.length === 48 && live1.length === 14 && dead1.length === 34 &&
        live1.indexOf('ПРГ-1 | МАР') < 0 && all1.indexOf('ПРГ-1 | МАР') >= 0 &&
        dead1.some(x => x.cell === 'ПРГ-1 | МАР' && /не допускает ни одного значения/.test(x.why)) &&
        live1.indexOf('ПРГ-5 | МАР') >= 0,
    `сочетаемость режет пространство до заполнимого: декартово произведение дало ${all1.length
      } ячеек, возможных ${live1.length}, невозможных ${dead1.length} — «ПРГ-1 | МАР» из счёта вычтена: ` +
    `${dead1.filter(x => x.cell === 'ПРГ-1 | МАР')[0].why}; «ПРГ-5 | МАР» осталась (ИУ-8, ИУ-9)`);

  /* Открытая доля невозможной не бывает: «Прочие» держит значения, которых в справочнике
     ещё нет, и объявить их несочетаемыми заранее нельзя (ИУ-9). */
  d1.grp = { vidkred: 'g_vidkred_dengi' };
  const all2 = KU.spaceAll(d1, TODAY), live2 = KU.space(d1, TODAY), dead2 = KU.dead(d1, TODAY);
  ok(91, all2.length === 24 && live2.length === 18 && dead2.length === 6 &&
        dead2.every(x => x.cell.indexOf(KU.OTHER) < 0) &&
        dead2.every(x => x.cell.split(' | ')[1] === 'Донорские') &&
        live2.filter(c => c.indexOf(KU.OTHER) >= 0).length === 8,
    `сочетаемость считается по долям, а не по значениям: с группировкой «по деньгам» ${all2.length
      } ячеек, невозможных ${dead2.length} — только донорские деньги у бюджетных программ; ` +
    `доля «${KU.OTHER}» невозможной не объявлена ни разу (${live2.filter(c => c.indexOf(KU.OTHER) >= 0).length
      } её ячеек живы): она держит то, чего в справочнике ещё нет`);

  /* Вторая объявленная пара — и проверка, что живые правила невозможными ячейками
     не задеты: ни один объект стенда в такой ячейке не стоит. */
  const d3 = KU.keyDraftInit(rl.id);
  d3.key = ['vidzaem', 'forma']; d3.grp = {}; d3.cuts = {};
  const dead3 = KU.dead(d3, TODAY);
  const covs = [KU.lowRule('u_agro', 'cur_loan'), KU.topRule('cur_loan'), KU.lowRule('u_ind', 'cur_loan'),
    KU.topRule('spec_app'), KU.lowRule('u_osh', 'cur_coll')].map(r => KU.coverage(r, TODAY));
  ok(92, KU.spaceAll(d3, TODAY).length === 16 && KU.space(d3, TODAY).length === 7 &&
        dead3.length === 9 && dead3.every(x => x.cell.indexOf('Частная') < 0) &&
        covs.every(c => c.dead.length === 0 && c.deadHot.length === 0),
    `у физлица, ИП и КФХ форма собственности всегда частная: из ${KU.spaceAll(d3, TODAY).length
      } ячеек возможны ${KU.space(d3, TODAY).length}, все ${dead3.length} невозможных — не «Частная»; ` +
    `в живых правилах стенда невозможных ячеек нет вовсе, объектов в них тоже (deadHot 0)`);
})();

/* ---------- U. «Написало успешно, а на экране ничего» (жалоба 17.08.2026, ИУ-10) ---------- */
(function blindEdit() {
  /* Экран рисует редакцию на ДАТУ СРЕЗА, правка кладёт новую поверх редакции на ДАТУ
     ВСТУПЛЕНИЯ. Пока это одна редакция — правится ровно то, что видно; разъехались —
     правка закрыта. А чтобы результат не оставался «где-то в будущем», после сохранения
     срез сам встаёт на дату вступления. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_ozo';
  const r = KU.lowRule('u_ozo', 'cur_coll');

  /* Путь A: срез в прошлом, редакция всё ещё одна — правка проходит, но экран уезжает
     на дату вступления, иначе она осталась бы невидимой. */
  KU.setAsOf('2026-01-15');
  const a = KU.setCell(r.id, 'Право аренды', 'e_mamatov');
  ok(93, a.ok && KU.state.asOf === TODAY && /рез экрана переставлен/.test(a.note) &&
        KU.verAt(r, KU.state.asOf).cells['Право аренды'] === 'e_mamatov' &&
        r.versions.length === 2,
    `правка со среза в прошлом не пропадает: редакция ${a.ver} заведена, срез сам встал на ${
      KU.state.asOf} и «Право аренды» на экране уже за Маматовым — «${
      a.note.slice(a.note.indexOf('Срез экрана')).trim()}»`);

  /* Путь B: тот же срез, но редакций уже две — теперь на экране одна, а правилась бы
     другая. Именно это и выглядело как «успешно, но ничего не изменилось». */
  KU.setAsOf('2026-01-15');
  const b = KU.setCell(r.id, 'Ценные бумаги', 'e_mamatov');
  const dr = KU.keyDraftInit(r.id); dr.key = ['vidzalog', 'terr'];
  const bk = KU.saveKey(r.id);
  ok(94, !b.ok && /править вслепую нельзя/.test(b.why) && /№ 1/.test(b.why) && /№ 2/.test(b.why) &&
        !bk.ok && /править вслепую нельзя/.test(bk.why) && r.versions.length === 2,
    `правка вслепую отбита и у ячейки, и у ключа: «${b.why.slice(0, 150)}…» — редакций как было ${
      r.versions.length}, ключ не сохранён`);

  /* Пути C «дата вступления в будущем» больше нет: редакция вступает днём сохранения
     (волна 6), поэтому вперёд экрану смотреть не на что — кроме справочника. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_ozo';
  const r3 = KU.lowRule('u_ozo', 'cur_coll');
  KU.setCell(r3.id, 'Право аренды', 'e_mamatov');
  const ahead = KU.state.rules.reduce((n, x) =>
    n + x.versions.filter(v => v.from > TODAY).length, 0);
  const list = KU.asOfList();
  ok(95, ahead === 0 && list.indexOf('2026-09-01') >= 0 && list.indexOf(TODAY) >= 0 &&
        list.every((d, i) => i === 0 || list[i - 1] <= d),
    `срез смотрит назад: редакций правил с будущей датой ${ahead} — их больше не завести; ` +
    `в списке срезов вперёд стоит только 01.09.2026 от группировки справочника, у неё свои даты — ${list.join(' · ')}`);
})();

/* -------- VII. «Назначается только один, второй не назначается» (жалоба 17.08.2026) -------- */
(function sameDay() {
  /* Интервалы редакций не пересекаются, значит двух редакций с одной датой вступления нет:
     первая правка дня заводит редакцию, остальные ложатся в неё (KU.verFor). Раньше вторая
     упиралась в «редакция N вступила DD.MM — новая раньше вступить не может». */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_ozo';
  const r = KU.lowRule('u_ozo', 'cur_coll');
  const one = KU.setCell(r.id, 'Право аренды', 'e_mamatov');
  const two = KU.setCell(r.id, 'Ценные бумаги', 'e_mamatov');
  const three = KU.setCell(r.id, 'Право аренды', 'e_toktosunova');
  const v = KU.verAt(r, TODAY);
  ok(96, one.ok && two.ok && three.ok && !one.merged && two.merged && three.merged &&
        one.ver === two.ver && two.ver === three.ver && r.versions.length === 2 &&
        v.cells['Ценные бумаги'] === 'e_mamatov' && v.cells['Право аренды'] === 'e_toktosunova' &&
        /второй редакции на тот же день не бывает/.test(two.note),
    `правки одного дня копятся в одной редакции: три назначения подряд прошли, редакций как было ${
      r.versions.length}, все три в редакции ${three.ver} — «Ценные бумаги» за ${nm(v.cells['Ценные бумаги'])
      }, «Право аренды» переназначено на ${nm(v.cells['Право аренды'])} (ИУ-10)`);

  /* Прошлое дописыванием не переписывается: до даты вступления отвечает прежняя редакция. */
  const prev = r.versions.filter(x => x.no !== v.no)[0];
  ok(97, prev.until === '2026-08-14' && prev.cells['Право аренды'] === undefined &&
        KU.verAt(r, '2026-08-14').no === prev.no,
    `дописывание не трогает прошлое: редакция ${prev.no} закрыта ${prev.until}, на 14.08.2026 ` +
    `«Право аренды» по-прежнему без имени — за прежние дни отвечает прежняя редакция (ИУ-10, ИУ-11)`);

  /* Ключ, сохранённый в тот же день, тоже ложится в неё — а не заводит третью. */
  const d = KU.keyDraftInit(r.id); d.key = ['vidzalog', 'terr'];
  const sk = KU.saveKey(r.id);
  const after = KU.verAt(r, TODAY);
  ok(98, sk.ok && sk.merged && sk.ver === v.no && r.versions.length === 2 &&
        after.key.join('+') === 'vidzalog+terr' && /дополнена/.test(sk.note),
    `ключ в тот же день ложится в ту же редакцию: ${sk.note.slice(0, 120)}… — редакций ${
      r.versions.length}, ключ редакции ${after.no} стал «${after.key.map(f => KU.feat(f).name).join(' + ')}»`);

  /* Правка «позади будущей редакции» после волны 6 невозможна по построению: заводится
     только редакция сегодняшним днём, поэтому впереди действующей ничего не стоит. */
  KU.seed();
  KU.state.role = 'head'; KU.state.headUnit = 'u_ozo';
  const r2 = KU.lowRule('u_ozo', 'cur_coll');
  const e1 = KU.setCell(r2.id, 'Право аренды', 'e_mamatov');
  const e2 = KU.setCell(r2.id, 'Ценные бумаги', 'e_mamatov');
  const last = KU.verAt(r2, TODAY);
  ok(99, e1.ok && e2.ok && r2.versions.length === 2 && last.until === null &&
        last.from === TODAY && r2.versions.every(v => v.from <= TODAY),
    `впереди действующей редакции пусто: обе правки легли в редакцию ${last.no} от ${last.from}, ` +
    `открытую бессрочно — «правка позади будущей редакции» отпала вместе с датой вступления (волна 6)`);
})();

/* ---------- V. Готовность к передаче разработчику (#100–#105) ---------- */
(() => {
  const hdr = src.slice(src.indexOf('<!--'), src.indexOf('-->'));

  /* Пакет объявлен в самом файле, и постановка названа ГОЛЫМ ИМЕНЕМ: два плоских файла лежат
     рядом, репозиторных путей к канону в пакете быть не должно. */
  const pkg = /ПАКЕТ ПЕРЕДАЧИ/.test(hdr) && hdr.includes('p18-kuratorstvo-tasks.html') &&
              /В ПАКЕТ НЕ ВХОДИТ/.test(hdr) && !/docs\/tasks\//.test(src);
  ok(100, pkg,
    `шапка объявляет пакет передачи: постановка p18-kuratorstvo-tasks.html голым именем плюс ` +
    `этот файл; всё прочее названо как «в пакет не входит»`);

  /* Карта «экран → карточки» покрывает ВСЕ 14 карточек редакции 2: разработчик должен видеть,
     где смотреть каждую, а не искать по файлу. */
  const map = hdr.slice(hdr.indexOf('КАРТА: ЭКРАН'), hdr.indexOf('ЧЕГО В МОДУЛЕ НЕТ'));
  const cards = ['P18-R1', 'P18-R2', 'P18-R3', 'P18-R4', 'P18-R5', 'P18-R6', 'P18-R7', 'P18-R8',
    'P18-R9', 'P18-R11', 'P18-R13', 'P18-R14', 'P18-R16', 'P18-R17'];
  const miss = cards.filter(c => !new RegExp(c + '(\\D|$)').test(map));
  const retired = ['P18-R10', 'P18-R12', 'P18-R15', 'P18-R18', 'P18-R19', 'P18-R20']
    .filter(c => new RegExp(c + '(\\D|$)').test(map));
  ok(101, miss.length === 0 && retired.length === 0 && map.length > 200,
    `карта «экран → карточки» называет все 14 карточек редакции 2 и ни одной снятой${
      miss.length ? ' · нет: ' + miss.join(',') : ''}${retired.length ? ' · снятая: ' + retired.join(',') : ''}`);

  /* «Сегодня» заморожено константой: иначе демо-данные значат другое каждый день, а прогон
     перестаёт воспроизводиться. Системных часов в макете нет ни в одном месте. */
  const frozen = /const TODAY\s*=\s*'2026-08-15'/.test(m[1]) &&
                 !/Date\.now\(\)/.test(m[1]) && !/new Date\(\s*\)/.test(m[1]);
  ok(102, frozen && KU.state.today === '2026-08-15' && /«СЕГОДНЯ» ЗАМОРОЖЕНО/.test(hdr),
    `«сегодня» заморожено на ${KU.state.today} константой TODAY, системных часов в макете нет — ` +
    `прогон воспроизводится, и граница «в прошлое редакция не заводится» стоит на месте`);

  /* Расхождение «ролей четыре, а в модели пять» названо в шапке и в комментарии к ROLES —
     на экране пояснений нет (#105), а молча недостающая роль читалась бы как решение. */
  const said = /РОЛЕЙ В МАКЕТЕ ЧЕТЫРЕ, В МОДЕЛИ ПЯТЬ/.test(hdr) &&
               /Региональный исполнитель[\s\S]{0,160}на паузе/.test(m[1]) &&
               /P18-R2/.test(m[1]);
  ok(103, said && KU.dict.ROLES.length === 4,
    `пятая роль названа как пауза, а не как отсутствие: шапка и комментарий к ROLES ссылаются ` +
    `на P18-R2, где список назначаемых ролей закрыт пятью`);

  /* Адрес происхождения домена показывается ИМЕНЕМ МОДУЛЯ; путь в чужом репозитории на экран
     не выводится вовсе — ни текстом, ни подсказкой. */
  const addr = /function srcAddr/.test(m[1]) && !/вне пакета/.test(m[1]) &&
               /borrower\.html/.test(hdr) &&
               KU.dict.FEATURES.some(f => /mockups\//.test((f.sver || {}).ref || ''));
  ok(104, addr,
    `отметка сверенности показывает источник домена именем модуля («прототип модуля «Заёмщик»»); ` +
    `путь в чужом репозитории лежит в данных признака и на экран не выводится`);

  /* ЧИСТКА 17.08.2026: экран показывает данные и запреты, а не пересказ модели. Внутренние
     номера, примечания и подсказки-пояснения с экранов сняты — в исполняемом коде их не
     остаётся. Комментарии кода свои номера сохраняют: они для читателя файла, не для
     пользователя. Два title= разрешены — это подписи кнопок-иконок «✕». */
  const noComm = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const nums = (noComm.match(/ИУ-\d|ADR-\d|P18-R/g) || []).length;
  const notes = (noComm.match(/class="note"|class="page-lead"/g) || []).length;
  const tips = (noComm.match(/title="/g) || []).length;
  const css = !/\.note\s*\{/.test(src) && !/\.page-lead\s*\{/.test(src);
  ok(105, nums === 0 && notes === 0 && tips === 2 && css &&
          /ПОЯСНЕНИЙ НА ЭКРАНАХ НЕТ/.test(hdr),
    `экраны без пояснений: примечаний и сносок 0, внутренних номеров в видимом тексте 0, ` +
    `подсказок ${tips} (обе — подписи кнопок-иконок «✕»); правила читаются в постановке и шапке`);
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
