// Headless smoke для mockups/classification/classification.html (ИК-1…ИК-26, ADR-0120…0137, ADR-0246).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение движка, хранимых интервалов, меток, ночного прохода, конструктора,
// фактов, шва и закрытия периода; разметка экранов — через panelHtml(), без браузера.
// Блоки, которые правят состояние, начинаются с CL.seed() — состояние между ними не течёт.
//   node scripts/inspect/classification-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/classification/classification.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'classification.inline.js' });
const CL = win.CL;
if (!CL) { console.error('window.CL не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const has = (arr, s) => (arr || []).some(x => String(x).includes(s));
const TODAY = '2026-08-14';
// Хранимый ответ на сегодня — то, что читают витрина и шов (ИК-24).
const stored = id => CL.riskCategory('кредит', id, CL.state.today);
const rulesOf = r => (r.whyItems || []).filter(w => w.k === 'rule');
const factsIn = r => (r.whyItems || []).filter(w => w.k === 'fact').map(w => w.id);
const series = (clf, type, id) => CL.store.series(clf, type, id);
const span = iv => iv.from + '…' + (iv.until || '');

/* ---------- A. Реестр показателей и журнал редакций ---------- */
(() => {
  CL.seed();
  const ind = CL.state.indicators;
  const noOwner = ind.filter(i => !i.owner);
  const retired = ind.filter(i => i.retired);
  const enums = ind.filter(i => i.type === 'перечисление' && !(i.domain || []).length);
  ok(1, ind.length >= 10 && noOwner.length === 0 && retired.length === 1 && enums.length === 0,
    `показателей ${ind.length}, без владельца ${noOwner.length}, снятых ${retired.length}, перечислений без домена ${enums.length}`);

  const a = CL.activeVer('risk');
  const past = CL.clf('risk').versions.find(v => v.status === 'прошлая');
  ok(2, a && a.no === 2 && a.from === '2026-07-06' && past && past.no === 1 && past.until === '2026-07-05',
    `действующая ред. ${a && a.no} с ${a && a.from}, прошлая ред. ${past && past.no} по ${past && past.until} включительно — стык днём раньше (ИК-22)`);

  const draftPay = CL.draftVer('pay');
  ok(3, draftPay && !CL.activeVer('pay') && draftPay.values.length === 3,
    `у «Группы платёжеспособности» только черновик, значений ${draftPay && draftPay.values.length}, действующей нет`);
})();

/* ---------- B. Движок на затравке — через хранимые интервалы ---------- */
(() => {
  CL.seed();
  const r117 = stored('КД-2024/117');
  const n117 = rulesOf(r117).map(w => w.norm);
  ok(4, r117.ok && r117.code === 'high' && n117.length === 2 && n117.includes('п. 19.1') && n117.includes('п. 11.3'),
    `КД-2024/117 → ${r117.label}, в «почему» интервала правил ${n117.length} (${n117.join(' + ')}) — ИК-11`);

  const r210 = stored('КД-2023/210');
  const v = CL.indicatorsOfCredit(CL.credit('КД-2023/210'), TODAY);
  ok(5, r210.ok && r210.code === 'mid' && v.daysOverdue === 200 && v.defer181 === true &&
       rulesOf(r210).length === 1 && rulesOf(r210)[0].norm === 'п. 11.2' && /просрочка/.test(rulesOf(r210)[0].label),
    `КД-2023/210: 200 дн по ответу Платежей, отложение п. 19.1 включено → ${r210.label} по ${rulesOf(r210).map(w => w.norm + ' («' + w.label + '»)').join(', ')}`);

  const r004 = stored('КД-2019/004');
  CL.state.view = 'show';
  const row004 = CL.panelHtml().split('<tr').find(r => r.includes('КД-2019/004'));
  ok(6, !r004.ok && r004.out === true && has(r004.why, 'вне области классификатора: кредит действующий = да') &&
       /кредит действующий = да \(сейчас нет\)/.test(row004),
    `КД-2019/004 — интервал «вне области»: хранится «${r004.why[0]}», витрина печатает с величиной «(сейчас нет)» — ИК-7`);

  const r043 = stored('КД-2025/043');
  const lvl043 = CL.indicatorsOfCredit(CL.credit('КД-2025/043'), TODAY).factorLevel;
  ok(7, r043.ok && r043.code === 'low' && lvl043 === 'нет' && !factsIn(r043).length,
    `КД-2025/043: фактор без решения комитета в показатель не вошёл (уровень «${lvl043}») → ${r043.label} — ИК-10`);

  const r088 = stored('КД-2025/088');
  ok(8, r088.ok && r088.code === 'mid' && rulesOf(r088).length === 2 && factsIn(r088).join() === 'F-003',
    `КД-2025/088 → ${r088.label}, правил в интервале ${rulesOf(r088).length} (просрочка + фактор п. 11.2), факт ${factsIn(r088).join()}`);

  const i101 = CL.indicatorsOfCredit(CL.credit('КД-2025/101'), TODAY);
  const r101 = stored('КД-2025/101');
  ok(9, i101.daysOverdue === 45 && i101.overdueLayer === 'мировое соглашение' && r101.code === 'mid',
    `КД-2025/101: худший слой «${i101.overdueLayer}» ${i101.daysOverdue} дн → ${r101.label} — пара показателей ИК-18`);

  const live = CL.state.credits.filter(c => c.issued <= TODAY);
  const mute = live.map(c => stored(c.id)).filter(r => !r.interval || !(r.why || []).length);
  ok(10, live.length === 8 && mute.length === 0,
    `у всех ${live.length} кредитов на сегодня есть интервал с «почему», молчаливых отказов 0 — §0.3`);
})();

/* ---------- C. Факты ---------- */
(() => {
  CL.seed();
  const f2 = CL.state.facts.find(f => f.id === 'F-002');
  ok(11, CL.fateOf(f2) === 'не засчитан: нет решения комитета', `F-002: «${CL.fateOf(f2)}» — ИК-10/ИК-12`);

  const f3 = CL.state.facts.find(f => f.id === 'F-003');
  ok(12, f3.occurred === '2026-06-12' && f3.counted === '2026-07-01' && f3.counted === CL.startOfOpen(),
    `F-003 наступил ${f3.occurred}, учтён с ${f3.counted} (начало открытого периода) — ИК-9`);

  const f4 = CL.state.facts.find(f => f.id === 'F-004');
  ok(13, CL.fateOf(f4) === 'не засчитан: интервал истёк', `F-004: «${CL.fateOf(f4)}» — ИК-12`);

  const add = CL.addFact({ creditId: 'КД-2024/117', kindId: 'f-noAct', occurred: '2026-08-01', doc: 'протокол КАБК № 20' });
  const light = CL.state.facts.find(f => f.id === add.id);
  const fate = CL.fateOf(light);
  ok(14, add.ok && fate === 'не засчитан: ведёт к более лёгкому значению, чем выбранное' && !factsIn(stored('КД-2024/117')).includes(add.id),
    `средний фактор при хранимом высоком: «${fate}», в «почему» интервала не вошёл — третья причина закрытого списка ИК-12`);

  const juneBefore = JSON.stringify(CL.store.at('risk', 'кредит', 'КД-2025/043', '2026-06-20'));
  const late = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-collDown', occurred: '2026-06-20', doc: 'протокол КАБК № 21' });
  ok(15, late.ok && late.counted === CL.startOfOpen() && late.markerFrom === '2026-07-01' &&
       JSON.stringify(CL.store.at('risk', 'кредит', 'КД-2025/043', '2026-06-20')) === juneBefore,
    `факт из закрытого июня принят, учтён и помечен с ${late.counted}; интервал июня не тронут — ИК-9, ИК-26`);

  const future = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-noAct', occurred: '2026-09-01', doc: 'протокол' });
  ok(16, !future.ok && /будущем/.test(future.why), `факт из будущего отклонён: «${future.why}»`);

  CL.seed();
  const noReason = CL.annulFact('F-003', '');
  const before = rulesOf(stored('КД-2025/088')).length;
  const annul = CL.annulFact('F-003', 'заведён на другой кредит');
  const after = stored('КД-2025/088');
  ok(17, !noReason.ok && annul.ok && CL.state.facts.some(f => f.id === 'F-003') &&
        before === 2 && rulesOf(after).length === 1 && after.code === 'mid' &&
        CL.indicatorsOfCredit(CL.credit('КД-2025/088'), '2026-07-01').factorLevel === 'нет',
    `аннулирование без причины отклонено; после аннулирования F-003 факт в реестре, правил ${before} → ${rulesOf(after).length}, уровень «нет» с 01.07.2026, значение ${after.label}`);

  CL.state.role = 'Наблюдатель';
  const denied = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-noAct', occurred: '2026-08-02' });
  ok(18, !denied.ok, `наблюдатель факты не вводит: «${denied.why}»`);
})();

/* ---------- D. Конструктор: черновик, порядок, публикация ---------- */
(() => {
  CL.seed();
  const direct = CL.addValue('risk', 'Запрещённое');
  ok(19, !direct.ok && /новую редакцию|новая редакция/i.test(direct.why),
    `действующая редакция не правится: «${direct.why}» — ИК-2`);

  const base = CL.activeVer('risk').values.length;
  const nd = CL.newDraft('risk');
  const d = CL.draftVer('risk');
  ok(20, nd.ok && d && d.no === 3 && d.values.length === base && d.status === 'черновик',
    `новая редакция ${d && d.no} открыта черновиком-копией: значений ${d && d.values.length} из ${base}`);

  CL.addValue('risk', 'Повышенный риск');
  const posBefore = d.values.findIndex(v => v.label === 'Повышенный риск');
  const dfltIdx = d.values.findIndex(v => v.dflt);
  const added = d.values[posBefore];
  CL.addRule('risk', added.code, 'проектное');
  CL.setDefault('risk', added.code);
  const nowLast = d.values[d.values.length - 1];
  ok(21, posBefore === dfltIdx - 1 && nowLast.code === added.code && !nowLast.rules.length &&
        d.values.filter(v => v.dflt).length === 1,
    `новое значение встало перед замыкающим (${posBefore + 1}-м); после «сделать по умолчанию» оно последнее и без правил — ИК-3`);
})();

(() => {
  CL.seed();
  const chk = CL.publishChecks('pay');
  ok(22, has(chk, 'по умолчанию') && has(chk, 'ИК-17') && has(chk, 'основание') && chk.length >= 4,
    `черновик «Группа платёжеспособности»: отказов ${chk.length} — нет значения по умолчанию, значения недостижимы (ИК-17), нет основания`);

  const pub = CL.publish('pay', {});
  ok(23, !pub.ok && pub.refusals.length === chk.length && CL.draftVer('pay').status === 'черновик',
    `публикация отклонена списком из ${pub.refusals.length} причин, версия осталась черновиком — §0.3`);

  CL.newDraft('risk');
  const early = CL.publish('risk', { basis: 'тест', from: '2026-06-15' });
  ok(24, !early.ok && has(early.refusals, 'раньше начала открытого периода'),
    `дата ввода 15.06.2026 отклонена: «${early.refusals.find(r => r.includes('раньше'))}» — ИК-4`);

  const good = CL.publish('risk', { basis: 'Порядок №41, уточнение п. 16.1', from: '2026-07-20' });
  const act = CL.activeVer('risk');
  const prev = CL.clf('risk').versions.find(v => v.no === 2);
  const iv = CL.store.at('risk', 'кредит', 'КД-2024/117', '2026-07-19');
  const iv3 = CL.store.at('risk', 'кредит', 'КД-2024/117', '2026-07-20');
  ok(25, good.ok && act.no === 3 && prev.status === 'прошлая' && prev.until === '2026-07-19' &&
       iv.verNo === 2 && iv.until === '2026-07-19' && iv3.verNo === 3 && iv3.from === '2026-07-20',
    `редакция 3 введена с 20.07.2026, редакция 2 закрыта днём раньше — 19.07.2026; ряд КД-2024/117 стыкуется ${span(iv)} / ${span(iv3)} — КФ-Д22`);

  const june = CL.riskCategory('кредит', 'КД-2025/088', '2026-06-01');
  ok(26, june.ok && june.source === 'хранимый интервал' && june.code === 'low' && june.verNo === 1 && june.closed === true,
    `после смены редакции июнь читается интервалом ред. 1 → «${june.label}», признак «период закрыт», пересчёта нет — ИК-8, ИК-24`);
})();

(() => {
  CL.seed();
  CL.newDraft('sub');
  const d = CL.draftVer('sub');
  d.basis = 'тест'; d.from = '2026-07-10';
  d.values[0].rules[0].preds.push({ i: 'daysOverdue', op: '≥', v: 5 });          // чужой объект
  d.values[1].rules[0].preds.push({ i: 'oldRating', op: '=', v: 'A' });          // снятый показатель
  d.values[2].rules[0].preds.push({ i: 'roleEnd', op: '=', v: 'ликвидирован' }); // вне домена
  const last = d.values[d.values.length - 1];
  last.rules = [{ norm: 'проектное', preds: [{ i: 'everCredits', op: '=', v: true }] }];
  const chk = CL.publishChecks('sub', d);
  ok(27, has(chk, 'ИК-15') && has(chk, 'вниз не смотрит'),
    `правило заёмщика с показателем кредита отклонено — ИК-15`);
  ok(28, has(chk, 'снятый показатель') && has(chk, 'не входит в домен'),
    `снятый показатель и константа вне домена отклонены — ИК-5`);
  ok(29, has(chk, 'значения по умолчанию') && has(chk, 'есть правила'),
    `правило у значения по умолчанию отклонено — ИК-3`);
})();

/* ---------- E. Реестр показателей ---------- */
(() => {
  CL.seed();
  const used = CL.retireIndicator('daysOverdue');
  ok(30, !used.ok && /ИК-16/.test(used.why), `снятие используемого показателя отклонено: «${used.why}»`);

  const noOwner = CL.addIndicator({ id: 'pledgeCover', name: 'Покрытие залогом', obj: 'кредит', type: 'булево' });
  const withOwner = CL.addIndicator({ id: 'pledgeCover', name: 'Покрытие залогом', obj: 'кредит', type: 'булево', owner: 'Залог' });
  const retire = CL.retireIndicator('pledgeCover');
  ok(31, !noOwner.ok && withOwner.ok && retire.ok && CL.ind('pledgeCover').retired,
    `показатель без владельца отклонён; заведённый с владельцем «Залог» снимается свободно — ссылок на него нет`);

  const dup = CL.addIndicator({ id: 'daysOverdue', name: 'дубль', owner: 'X' });
  ok(32, !dup.ok, `занятый идентификатор отклонён: «${dup.why}»`);
})();

/* ---------- F. Периоды: защёлка, отчёт п. 12, свёртка ---------- */
(() => {
  CL.seed();
  CL.state.role = 'Наблюдатель';
  const denied = CL.closePeriod();
  CL.state.role = 'Администратор классификации';
  ok(33, !denied.ok && /администратор классификации/.test(denied.why), `наблюдатель период не закрывает: «${denied.why}»`);

  const before = JSON.stringify(CL.state.intervals);
  const res = CL.closePeriod();
  const p = CL.period('2026-07');
  const locked = CL.store.add({ clf: 'risk', type: 'кредит', id: 'КД-2025/043', from: '2026-07-15' });
  ok(34, res.ok && res.period === '2026-07' && res.written === 0 && JSON.stringify(CL.state.intervals) === before &&
       p.klass && p.uchet && !locked.ok && /ИК-26/.test(locked.why),
    `июль закрыт защёлкой: записей 0, интервалы не изменились ни в одном байте, правка июльского интервала отклонена — ИК-26`);

  const again = CL.closePeriod();
  ok(35, CL.openPeriod() === '2026-08' && !again.ok && has(again.refusals, 'не завершён') && has(again.refusals, 'ИК-23'),
    `открылся август; повторное закрытие отклонено: «${again.refusals.join('» · «')}» — ИК-13, ИК-23`);

  const rep = CL.report12('2026-07');
  const cnt = rep.rows.map(r => r.count).join('/');
  ok(36, rep.asOf === '2026-08-01' && rep.deadline === '2026-08-15' && rep.late === false && rep.last === '2026-07-31' &&
        rep.total === 5 && cnt === '1/3/1' && rep.out.length === 2 && rep.nodata.length === 0,
    `отчёт п. 12 за июль из интервалов на ${rep.last}: ${cnt} (всего ${rep.total}), вне области ${rep.out.length} вне строк, по состоянию на ${rep.asOf}, срок ${rep.deadline} — в срок`);

  const closed = CL.riskCategory('кредит', 'КД-2024/117', '2026-07-15');
  const live = CL.riskCategory('кредит', 'КД-2024/117', CL.state.today);
  ok(37, closed.source === 'хранимый интервал' && live.source === 'хранимый интервал' && closed.code === live.code &&
       closed.closed === true && live.closed === false,
    `шов на 15.07 и на 14.08 читает один и тот же ряд; различаются только признаком «период закрыт» — ИК-24`);

  const after = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-noAct', occurred: '2026-07-20', doc: 'протокол КАБК № 22' });
  ok(38, after.ok && after.counted === '2026-08-01' && after.markerFrom === '2026-08-01',
    `факт от 20.07, вскрывшийся после закрытия июля, учтён и помечен с ${after.counted} — ИК-9`);
})();

(() => {
  CL.seed();
  const now = CL.riskCategory('заёмщик', '02107201910148', CL.state.today);
  const june = CL.riskCategory('заёмщик', '02107201910148', '2026-06-01');
  ok(39, now.ok && now.code === 'high' && now.sourceCreditId === 'КД-2024/117' &&
        june.ok && june.source === 'хранимый интервал' && june.closed && june.sourceCreditId === 'КД-2024/117' && june.verNo === 1,
    `свёртка worst-of хранится: сегодня — ${now.label} по ${now.sourceCreditId}, 01.06 — ${june.label} ред. 1 по тому же кредиту из запертого интервала`);

  CL.activeVer('risk').comparable = false;   // сторож: конструктор так не даёт, правим состояние
  const forbid = CL.foldBorrower('02107201910148');
  ok(40, !forbid.ok && forbid.forbidden === true && /ИК-6/.test(forbid.why[0]),
    `без признака сравнимости свёртка запрещена: «${forbid.why[0]}»`);

  CL.seed();
  const sub = inn => CL.valueAt('sub', 'заёмщик', inn, CL.state.today);
  const sub1 = sub('02107201910148'), sub2 = sub('11902199800433'), sub3 = sub('22508199500821');
  ok(41, sub1.code === '2.2' && sub2.code === '5' && sub3.code === '1.2' &&
        CL.activeVer('sub').comparable === false,
    `лестница подгруппы тем же движком, хранится интервалами: ${sub1.label} · ${sub2.label} · ${sub3.label}; признака сравнимости нет — свернуть нельзя`);

  const pay = CL.valueAt('pay', 'заёмщик', '02107201910148', CL.state.today);
  ok(42, !pay.ok && pay.draft === true && has(pay.why, 'черновик') && !series('pay', 'заёмщик', '02107201910148').length,
    `черновик значений не назначает и интервалов не имеет: «${pay.why[0]}»`);
})();

/* ---------- G. Классификатор: завести, остановить, сухой прогон, предпросмотр ---------- */
(() => {
  CL.seed();
  // ИК-4 сверху: публикация вводит редакцию в действие немедленно, отложенного пуска нет.
  CL.newDraft('risk');
  const future = CL.publish('risk', { basis: 'Порядок №41, п. 11', from: '2026-09-01' });
  ok(45, !future.ok && has(future.refusals, 'в будущем') && CL.draftVer('risk'),
    `дата ввода в будущем отклонена: «${future.refusals.find(r => /будущ/.test(r))}» — ИК-4`);

  CL.seed();
  // Четвёртая классификация — настройкой, а не релизом (ADR-0120).
  const made = CL.addClassifier({ id: 'pledge', name: 'Качество обеспечения', object: 'кредит' });
  const fresh = CL.clf('pledge');
  const silent = CL.valueAt('pledge', 'кредит', 'КД-2024/117', CL.state.today);
  const taken = CL.addClassifier({ id: 'risk', name: 'Дубль', object: 'кредит' });
  const badObj = CL.addClassifier({ id: 'x', name: 'Икс', object: 'залог' });
  CL.state.role = 'Кредитный инспектор';
  const notAdmin = CL.addClassifier({ id: 'y', name: 'Игрек', object: 'кредит' });
  ok(46, made.ok && fresh.versions.length === 1 && fresh.versions[0].status === 'черновик' &&
        !silent.ok && silent.draft === true &&
        !taken.ok && !badObj.ok && !notAdmin.ok,
    `классификатор заведён настройкой: редакция 1 — черновик, значений не назначает; занятый id, чужой объект и не-администратор отклонены — ADR-0120`);

  CL.seed();
  // Прекращение действия — не удаление: интервалы прошлых дат обязаны остаться читаемыми.
  CL.closePeriod();                                   // закрываем июль, чтобы было что читать
  const noReason = CL.stopClassifier('risk', { reason: '' });
  const early = CL.stopClassifier('risk', { reason: 'отмена признака', from: '2026-06-15' });
  const stop = CL.stopClassifier('risk', { reason: 'Порядок №41 отменил классификацию по признаку' });
  const after = CL.valueAt('risk', 'кредит', 'КД-2024/117', CL.state.today);
  const record = CL.riskCategory('кредит', 'КД-2024/117', '2026-07-15');
  ok(47, !noReason.ok && !early.ok && /ИК-4/.test(early.why) && stop.ok &&
        !after.ok && after.stopped === true && /прекращено с 14\.08\.2026/.test(after.why[0]) &&
        record.ok && record.source === 'хранимый интервал' && CL.activeVer('risk') === null,
    `действие прекращено с 14.08 (без причины и задним числом — отказ); на сегодня «${after.why[0].slice(0, 48)}…», интервал июля читается — ИК-19`);

  // Возобновление: черновик копирует последнюю редакцию, публикация снимает отметку.
  const d = CL.newDraft('risk');
  const copied = CL.draftVer('risk').values.length;
  const back = CL.publish('risk', { basis: 'Порядок №41, п. 11', from: CL.state.today });
  ok(48, d.ok && copied > 0 && back.ok && !CL.clf('risk').stopped &&
        CL.valueAt('risk', 'кредит', 'КД-2024/117', CL.state.today).ok,
    `возобновление публикацией: черновик открыт копией последней редакции (значений ${copied}), отметка о прекращении снята, интервал на сегодня снова есть — ИК-19`);
})();

(() => {
  CL.seed();
  // Сухой прогон считает, но ничего не пишет: значение ставит только действующая редакция (ИК-1).
  CL.newDraft('risk');
  const draft = CL.draftVer('risk');
  draft.scope = [{ label: 'действующий кредит с большой просрочкой',
                   preds: [{ i: 'creditActive', op: '=', v: true }, { i: 'daysOverdue', op: '≥', v: 300 }] }];
  const before = JSON.stringify(CL.state);
  const dry = CL.dryRun('risk');
  const afterState = JSON.stringify(CL.state);
  const live = stored('КД-2024/117');
  ok(49, dry.ok && dry.cnt.total === 8 && dry.cnt.lost > 0 &&
        dry.rows.every(r => typeof r.changed === 'boolean') &&
        before === afterState && live.ok && live.code === 'high' && !CL.state.markers.length,
    `сухой прогон: объектов ${dry.cnt.total}, изменится ${dry.cnt.changed}, потеряют значение ${dry.cnt.lost}; состояние не изменилось, меток нет, хранимое — от действующей редакции — ИК-1`);

  CL.seed();
  // Предпросмотр читает то же хранимое, что закрытие запирает: числа сходятся с рядами.
  const pv = CL.closePreview();
  const riskRow = pv.rows.find(r => r.clfId === 'risk');
  const byStore = CL.objectsOf('кредит', '2026-07-31').filter(o => (CL.store.at('risk', 'кредит', o.id, '2026-07-31') || {}).state === 'есть').length;
  const n0 = CL.state.intervals.length;
  const done = CL.closePeriod();
  ok(50, pv.ok && pv.period === done.period && riskRow.withValue === byStore && CL.state.intervals.length === n0 &&
        pv.silent === 1 && pv.rows.length === CL.state.classifiers.length,
    `предпросмотр читает интервалы на ${fmtD(pv.last)}: со значением ${riskRow.withValue} = ${byStore} в хранилище; закрытие новых интервалов не создало, классификаторов без интервалов ${pv.silent} — ИК-24, ИК-26`);
})();
function fmtD(iso){ return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4); }

(() => {
  CL.seed();
  // Список причин закрыт затем, чтобы по нему считали (ИК-12): сумма по судьбам = число фактов.
  const c = CL.factCounts();
  const sum = CL.FATES.reduce((a, k) => a + c[k], 0);
  const third = 'не засчитан: ведёт к более лёгкому значению, чем выбранное';
  ok(51, sum === c['всего'] && c['всего'] === CL.state.facts.length && c[third] > 0 &&
        CL.FATES.length === 5,
    `счётчики судьбы: всего ${c['всего']} = сумма по пяти судьбам; третья причина видна и в реестре (${c[third]}) — ИК-12`);
})();

/* ---------- H. Сторож разметки: модалка вместо браузерного диалога ---------- */
(() => {
  const code = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const dialogs = (code.match(/(?:^|[^.\w])(prompt|confirm|alert)\s*\(/g) || []);
  ok(52, dialogs.length === 0 && /function openModal/.test(m[1]),
    `браузерных диалогов в макете нет (${dialogs.length}), подтверждения идут модалкой — дизайн-система АСУБК`);
})();

/* ---------- I. Публикация нового классификатора: путь от заведения до действия ---------- */
(() => {
  CL.seed();
  // Проходим ровно тот путь, что делает администратор руками: завёл — наполнил — опубликовал.
  CL.addClassifier({ id: 'pledge', name: 'Качество обеспечения', object: 'кредит' });
  CL.addValue('pledge', 'достаточное');
  CL.setDefault('pledge', CL.draftVer('pledge').values[0].code);
  const beforeMeta = CL.publishChecks('pledge', CL.draftVer('pledge'));
  // Поля формы пишутся в черновик по мере ввода — не в момент нажатия кнопки (КФ-Д6).
  CL.setVerMeta('pledge', { basis: 'Порядок №41 от 06.07.2026, п. 11' });
  CL.setVerMeta('pledge', { from: CL.state.today });
  const afterMeta = CL.publishChecks('pledge', CL.draftVer('pledge'));
  const live = CL.publish('pledge');            // без opts: реквизиты уже в черновике
  const cls = CL.valueAt('pledge', 'кредит', 'КД-2024/117', CL.state.today);
  ok(53, has(beforeMeta, 'не указано основание') && has(beforeMeta, 'не указана дата ввода') &&
        afterMeta.length === 0 && live.ok && live.no === 1 &&
        CL.activeVer('pledge').basis.includes('№41') && cls.ok && cls.label === 'достаточное' && cls.interval.from === CL.state.today,
    `новый классификатор доведён до действия: реквизиты пишутся в черновик (отказов было ${beforeMeta.length}, стало ${afterMeta.length}), публикация поставила метки и записала интервалы с даты ввода — КФ-Д6, ИК-25`);

  // Сторож разметки: кнопка публикации не гаснет от отказов, поля привязаны к черновику.
  const card = m[1].slice(m[1].indexOf('function tabPublication'), m[1].indexOf('function tabJournal'));
  const deadBtn = /publishUI[\s\S]{0,120}disabled/.test(card);
  const bound = /id="pubBasis"[\s\S]{0,160}oninput/.test(card) && /id="pubFrom"[\s\S]{0,160}oninput/.test(card);
  ok(54, !deadBtn && bound && /id="pubRefusals"/.test(card),
    `форма публикации: кнопка отказами не блокируется, оба поля привязаны к черновику, список отказов перерисовывается — КФ-Д6`);
})();

/* ---------- J. Экраны: список → карточка, роли, вкладки, фильтр ---------- *
 * panelHtml() собирает ту же разметку, что видит человек, и не трогает DOM — поэтому
 * вид экрана проверяется здесь, а не только глазами в браузере.
 * ------------------------------------------------------------------------- */
(() => {
  CL.seed();
  const listHtml = CL.panelHtml();
  const rowsForAll = CL.state.classifiers.every(c => listHtml.includes(`CL.open('${c.id}')`));
  const listIsList = !listHtml.includes('<h3>Значения и правила') && !listHtml.includes('Прекратить действие');
  CL.open('risk');
  const cardHtml = CL.panelHtml();
  const inCard = cardHtml.includes('Значения и правила') && cardHtml.includes('Журнал редакций') &&
                 cardHtml.includes('Прекратить действие') && CL.deepName() === 'Категория кредитного риска';
  CL.back();
  ok(55, rowsForAll && listIsList && inCard && CL.state.curClf === null &&
        CL.panelHtml().includes('<th>Состояние</th>'),
    `экран разведён: список открывает карточку по строке, карточка несёт значения, журнал и прекращение действия, крошка возвращает в список`);

  // Роль без права правки: кнопок настройки нет вовсе, строка называет того, кто правит.
  CL.state.role = 'Наблюдатель';
  const roList = CL.panelHtml();
  CL.open('risk');
  const roCard = CL.panelHtml();
  const btns = roCard.match(/<button[^>]*>/g) || [];
  const onlyNav = btns.every(b => /class="tab/.test(b));
  const noEdit = onlyNav && !roCard.includes('act(CL.') && !roCard.includes('CL.stopUI') &&
                 !/<button/.test(roList);
  const named = roCard.includes('Только просмотр') && roCard.includes('Администратор классификации');
  const noDisabled = !/<button[^>]*disabled/.test(roCard);
  ok(56, noEdit && named && noDisabled,
    `роль «Наблюдатель»: в карточке ${btns.length} кнопок и все — вкладки, в списке ни одной; названа роль, которая правит; погашенных нет — §0.3`);
})();

(() => {
  CL.seed();
  CL.open('risk');
  const noPub = !CL.panelHtml().includes('Публикация редакции');
  CL.open('pay');
  const withPub = CL.panelHtml().includes('Публикация редакции 1');
  CL.state.clfTab = 'pub';
  const pubTab = CL.panelHtml().includes('id="pubBasis"') && CL.panelHtml().includes('Сухой прогон черновика');
  CL.state.role = 'Наблюдатель';
  const roNoPub = !CL.panelHtml().includes('id="pubBasis"');
  const roValues = CL.panelHtml().includes('Значения и правила');
  ok(57, noPub && withPub && pubTab && roNoPub && roValues,
    `вкладка публикации: есть у черновика администратора, нет у действующей редакции и нет у наблюдателя — вместо неё значения, а не пустой экран`);
})();

(() => {
  CL.seed();
  CL.go('ind');
  const all = CL.indShown().length;
  CL.state.indQ = 'просроч';
  const byName = CL.indShown();
  CL.state.indQ = '';
  CL.state.indObj = 'заёмщик';
  const byObj = CL.indShown();
  const allBorrower = byObj.every(i => i.obj === 'заёмщик');
  CL.state.indObj = 'все';
  const listHtml = CL.panelHtml();
  ok(58, all === CL.state.indicators.length && byName.length > 0 && byName.length < all &&
        byObj.length > 0 && byObj.length < all && allBorrower &&
        listHtml.includes('id="indRows"') && listHtml.includes('CL.indSearch(this.value)'),
    `реестр показателей: поиск сужает ${all} → ${byName.length}, фильтр по объекту → ${byObj.length}; строки перерисовываются точечно, фокус поиска не теряется — КФ-Д6`);

  CL.openInd('daysOverdue');
  const used = CL.usedBy('daysOverdue').filter(u => u.status === 'действующая');
  const card = CL.panelHtml();
  const shows = card.includes('Где используется') && used.every(u => card.includes(u.clf)) &&
                card.includes('События с меткой пересчёта') && card.includes('сторно платежа');
  const refusesByList = card.includes('Снять с реестра нельзя') && card.includes('ИК-16');
  const liveBtn = card.includes('CL.retireIndicator(') && !/<button[^>]*disabled[^>]*>\s*Снять/.test(card);
  CL.openInd('oldRating');
  const retired = CL.panelHtml().includes('снят с реестра') && !CL.panelHtml().includes('CL.retireIndicator(');
  ok(59, shows && refusesByList && liveBtn && retired && used.length > 0,
    `карточка показателя: «Где используется» ${used.length} живых ссылок и события, которые ставят метку; снятие отказывает списком до нажатия — ИК-16, ИК-25`);
})();

(() => {
  CL.seed();
  const notes = (src.match(/class="note"/g) || []).length;
  const off = /\.notes-off \.note\{ display:none; \}/.test(src);
  const wired = m[1].includes("'panel-wrap' + (st.notes ? '' : ' notes-off')") &&
                m[1].includes('CL.toggleNotes');
  ok(60, CL.state.notes === false && off && wired && notes >= 15,
    `пояснения: ${notes} блоков живы в разметке, по умолчанию свёрнуты тумблером в шапке — экран читается, объяснение доступно`);
})();

/* ---------- K. Язык правил: ИЛИ, «одно из списка», строгие операторы, область, ИК-20/ИК-21 ---------- */
const draftOf = clfId => { CL.newDraft(clfId); return CL.draftVer(clfId); };

(() => {
  CL.seed();
  const d = draftOf('risk');
  const high = d.values.find(v => v.code === 'high');
  const strict = high.rules[0].preds[0];
  const at180 = CL.classifyWith(d, {creditActive:true, daysOverdue:180, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'}, true);
  const at181 = CL.classifyWith(d, {creditActive:true, daysOverdue:181, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'}, true);
  ok(61, strict.op === '>' && strict.v === 180 && at180.code === 'mid' && at181.code === 'high',
    `строгий оператор: «${strict.op} ${strict.v}» даёт на 180 дн — ${at180.label}, на 181 дн — ${at181.label}; ≥ 181 и > 180 совпали бы только на целых днях`);

  const byOverdue = CL.classifyWith(d, {creditActive:true, daysOverdue:200, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'}, true);
  const byFactor  = CL.classifyWith(d, {creditActive:true, daysOverdue:0,   defer181:false, factorLevel:'высокий', overdueLayer:'нет просрочки'}, true);
  const both      = CL.classifyWith(d, {creditActive:true, daysOverdue:200, defer181:false, factorLevel:'высокий', overdueLayer:'свободный слой'}, true);
  ok(62, high.rules.length === 2 && byOverdue.code === 'high' && byFactor.code === 'high' &&
        both.fired.length === 2 && byOverdue.fired.length === 1 && byFactor.fired.length === 1,
    `ИЛИ между правилами: значение «${byOverdue.label}» берётся любым из ${high.rules.length} правил порознь, вместе сработали оба — ИК-11`);

  const mid = d.values.find(v => v.code === 'mid');
  const sameNorm = mid.rules.every(r => r.norm === 'п. 11.2') && mid.rules.every(r => !!r.label);
  const withLabels = CL.publishChecks('risk', d).filter(x => /ИК-21/.test(x)).length;
  CL.setRuleLabel('risk', 'mid', 0, '');
  const noLabel = CL.publishChecks('risk', d).filter(x => /ИК-21/.test(x));
  ok(63, sameNorm && withLabels === 0 && noLabel.length === 1 && /п\. 11\.2/.test(noLabel[0]),
    `повтор пункта внутри значения: с подписями отказов нет, без подписи — «${noLabel[0]}» — ИК-21`);
})();

(() => {
  CL.seed();
  const d = draftOf('risk');
  CL.addRule('risk', 'mid', 'проектное решение');
  const ri = d.values.find(v => v.code === 'mid').rules.length - 1;
  CL.addPred('risk', 'mid', ri);
  CL.setPred('risk', 'mid', ri, 0, 'i', 'overdueLayer');
  CL.setPred('risk', 'mid', ri, 0, 'op', '∈');
  CL.togglePredMember('risk', 'mid', ri, 0, 'нет просрочки', false);
  CL.togglePredMember('risk', 'mid', ri, 0, 'мировое соглашение', true);
  CL.togglePredMember('risk', 'mid', ri, 0, 'реструктуризация', true);
  const p = d.values.find(v => v.code === 'mid').rules[ri].preds[0];
  const inSet  = CL.classifyWith(d, {creditActive:true, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'мировое соглашение'}, true);
  const outSet = CL.classifyWith(d, {creditActive:true, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'нет просрочки'}, true);
  ok(64, p.op === '∈' && p.set.length === 2 && p.v === undefined &&
        inSet.code === 'mid' && outSet.code === 'low',
    `«одно из»: ${p.set.map(x => '«' + x + '»').join(' / ')} → ${inSet.label}; вне списка → ${outSet.label}`);

  CL.setPred('risk', 'mid', ri, 0, 'op', '∉');
  const notIn = CL.classifyWith(d, {creditActive:true, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'нет просрочки'}, true);
  CL.setPred('risk', 'mid', ri, 0, 'op', '=');
  const scalar = d.values.find(v => v.code === 'mid').rules[ri].preds[0];
  ok(65, notIn.code === 'mid' && scalar.v === 'мировое соглашение' && scalar.set === undefined,
    `«ни одно из» даёт зеркальный ответ (${notIn.label}); при переходе к «=» правая часть не обнулилась, осталась «${scalar.v}»`);

  CL.setPred('risk', 'mid', ri, 0, 'op', '∈');
  CL.togglePredMember('risk', 'mid', ri, 0, 'мировое соглашение', false);
  const empty = CL.publishChecks('risk', d).filter(x => /пустой список/.test(x));
  CL.togglePredMember('risk', 'mid', ri, 0, 'нет просрочки', true);
  CL.togglePredMember('risk', 'mid', ri, 0, 'свободный слой', true);
  CL.togglePredMember('risk', 'mid', ri, 0, 'мировое соглашение', true);
  CL.togglePredMember('risk', 'mid', ri, 0, 'реструктуризация', true);
  const whole = CL.publishChecks('risk', d).filter(x => /весь домен/.test(x));
  CL.setPred('risk', 'mid', ri, 0, 'i', 'daysOverdue');
  CL.setPred('risk', 'mid', ri, 0, 'op', '∈');
  const wrongType = CL.publishChecks('risk', d).filter(x => /только к показателю-перечислению/.test(x));
  ok(66, empty.length === 1 && whole.length === 1 && wrongType.length >= 1,
    `множество проверяется до публикации: пустой список, весь домен целиком и «одно из» на числе — три отказа по делу (ИК-5)`);
})();

(() => {
  CL.seed();
  const d = draftOf('risk');
  CL.addRule('risk', CL.SCOPE, '');
  CL.setRuleLabel('risk', CL.SCOPE, 1, 'кредит закрыт в этом году');
  CL.addPred('risk', CL.SCOPE, 1);
  CL.setPred('risk', CL.SCOPE, 1, 0, 'i', 'daysOverdue');
  CL.setPred('risk', CL.SCOPE, 1, 0, 'op', '>');
  CL.setPred('risk', CL.SCOPE, 1, 0, 'v', '0');
  const vals = {creditActive:false, daysOverdue:5, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'};
  const bySecond = CL.classifyWith(d, vals, true);
  const outAll = CL.classifyWith(d, {creditActive:false, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'нет просрочки'}, true);
  ok(67, d.scope.length === 2 && bySecond.ok && bySecond.code === 'mid' &&
        !outAll.ok && outAll.out === true && /ни одно из правил входа/.test(outAll.why[0]) &&
        /\(1\)/.test(outAll.why[0]) && /\(2\)/.test(outAll.why[0]),
    `область из ${d.scope.length} правил через ИЛИ: вход по второму даёт «${bySecond.label}»; отказ называет обе альтернативы — ИК-7`);

  const sub = CL.activeVer('sub');
  const anyone = CL.valueAt('sub', 'заёмщик', '22508199500821', CL.state.today);
  ok(68, (sub.scope || []).length === 0 && anyone.ok,
    `пустая область впускает всех: у подгруппы заёмщика правил входа нет, «${CL.borrower('22508199500821').name}» → ${anyone.label}`);
})();

(() => {
  CL.seed();
  // Нет данных — интервал с названным показателем и владельцем, а не тихий откат к умолчанию (ИК-20).
  const blind = stored('КД-2026/012');
  const named = CL.ind('daysOverdue');
  const fold = CL.riskCategory('заёмщик', '01503200110077', CL.state.today);
  ok(69, !blind.ok && blind.nodata === true && blind.state === 'нет данных' && has(blind.why, named.name) &&
        has(blind.why, named.owner) && has(blind.why, 'ИК-20') && blind.code === undefined,
    `нет данных → интервал «${blind.why[0]}» — значения нет вовсе, к умолчанию объект не съезжает — ИК-20`);
  ok(70, !fold.ok && fold.nodata === true && has(fold.why, 'КД-2026/012') && fold.interval.from === '2026-08-12',
    `свёртка заёмщика при неполном наборе — интервал «нет данных» с ${fmtD(fold.interval.from)}: «${fold.why[0].slice(0, 70)}…» — худшее из неполного не худшее`);

  const pv = CL.closePreview();
  const risk = pv.rows.find(r => r.clfId === 'risk');
  ok(71, pv.ok && risk.total === 7 && risk.withValue === 5 && risk.out.length === 2 && risk.nodata.length === 0 &&
        risk.withValue + risk.out.length + risk.nodata.length === risk.total,
    `предпросмотр июля разделил исходы: со значением ${risk.withValue}, вне области ${risk.out.length}, нет данных ${risk.nodata.length} — в сумме ${risk.total} кредитов; КД-2026/012 в июле ещё нет — КФ-Д21`);
})();

(() => {
  CL.seed();
  const num  = CL.opsFor(CL.ind('daysOverdue'));
  const enm  = CL.opsFor(CL.ind('factorLevel'));
  const bool = CL.opsFor(CL.ind('creditActive'));
  ok(72, num.join('') === '>≥<≤=≠' && enm.join('') === '=≠∈∉' && bool.join('') === '=≠',
    `операторы по типу: число ${num.join(' ')} · перечисление ${enm.join(' ')} · булево ${bool.join(' ')}`);

  CL.open('risk');
  const html = CL.panelHtml();
  const ors = (html.match(/class="or">или</g) || []).length;
  const ands = (html.match(/class="and">и</g) || []).length;
  ok(73, ors >= 2 && ands >= 1 && /любое из 2<\/b> правил/.test(html) &&
        /правила через ИЛИ/.test(html) && /Область — кто вообще классифицируется/.test(html),
    `связки написаны словом: «или» между блоками ${ors} раз, «и» между предикатами ${ands} раз, у значения — фраза о связке; область правится на том же экране — КФ-Д7, КФ-Д8`);
})();

/* ---------- L. Волна 5: дефекты ручного прогона (КФ-Д9…КФ-Д17) ---------- */
(() => {
  CL.seed();
  const cur = CL.activeVer('risk');
  const d = draftOf('risk');
  d.basis = 'Порядок №41 от 06.07.2026, п. 11';
  const refus = CL.publishChecks('risk', Object.assign(d, { from: '2026-07-02' }));
  const res = CL.publish('risk', { basis: d.basis, from: '2026-07-02' });
  const after = CL.activeVer('risk');
  ok(74, cur.from === '2026-07-06' && refus.length === 1 &&
       has(refus, 'не позже начала действующей редакции 2 от 06.07.2026') && !res.ok &&
       after === cur && cur.until === null,
    `дата ввода 02.07.2026 раньше действующей ред. 2 от 06.07.2026 отклонена: «${refus[0]}» — отрицательного интервала действия и двух действующих редакций сразу нет (ИК-22, КФ-Д12)`);

  CL.state.curClf = 'risk'; CL.state.clfTab = 'pub'; CL.state.view = 'clf';
  const pub = CL.panelHtml();
  ok(83, /держит\s+1\s+отказ\s+выше/.test(pub) && !/1 отказов/.test(pub),
    `один отказ пишется «держит 1 отказ выше», а не «держат 1 отказов» — КФ-Д17`);
})();

(() => {
  CL.seed();
  const base = { obj: 'кредит', type: 'перечисление', owner: 'Залог' };
  const noDom = CL.addIndicator({ ...base, id: 'x1', name: 'X1', domain: [] });
  const one   = CL.addIndicator({ ...base, id: 'x2', name: 'X2', domain: ['полное'] });
  const dup   = CL.addIndicator({ ...base, id: 'x3', name: 'X3', domain: ['полное', 'полное'] });
  const good  = CL.addIndicator({ ...base, id: 'pledgeLevel', name: 'Уровень покрытия залогом',
    domain: ['полное', ' частичное ', 'отсутствует'] });
  const stray = CL.addIndicator({ id: 'x4', name: 'X4', obj: 'кредит', type: 'булево',
    domain: ['да', 'нет'], owner: 'Залог' });
  const dom = (CL.ind('pledgeLevel') || {}).domain || [];
  ok(75, !noDom.ok && !one.ok && !dup.ok && !stray.ok && good.ok &&
       dom.length === 3 && dom[1] === 'частичное' && /id="niDomain"/.test(src) &&
       !/domain: type === 'перечисление' \? \['нет','да'\]/.test(src),
    `перечисление без домена, с одним членом и с повтором не заводится; домен читается с экрана (#niDomain), а не подставляется кодом: «${dom.join(' · ')}» — КФ-Д13`);
})();

(() => {
  const staleHandlers = (src.match(/onchange="act\(CL\.set(RuleNorm|RuleLabel)/g) || []).length;
  const quiet = (src.match(/oninput="CL\.quiet\(/g) || []).length;
  ok(76, staleHandlers === 0 && quiet >= 3 && /CL\.quiet = res =>/.test(src),
    `текстовые поля правила и число предиката правятся без перерисовки панели (${quiet} поля на oninput → CL.quiet), иначе первое нажатие соседней кнопки пропадает — КФ-Д9`);

  const errSlots = (src.match(/id="modalErr"/g) || []).length;
  const modalActs = (src.match(/modalAct\(/g) || []).length;
  const toastAbove = /#toastWrap\{[^}]*z-index:70/.test(src);
  const overlayAt = /\.overlay\{[^}]*z-index:60/.test(src);
  ok(77, errSlots === 4 && modalActs >= 5 && toastAbove && overlayAt,
    `отказ печатается внутри модального окна (${errSlots} окна с блоком причины), а тост поднят над затемнением (70 > 60) — КФ-Д10`);

  ok(80, /<div id="dryRun">/.test(src) && /dr\.innerHTML = dryRunCard\(clfId\)/.test(src),
    `сухой прогон пересчитывается тем же вводом, что и список отказов — двух взаимоисключающих утверждений в одном окне не остаётся, КФ-Д14`);
})();

(() => {
  CL.seed();
  CL.state.view = 'facts';
  CL.state.factForm = { credit: 'КД-2025/043', kind: 'f-noAct', when: '2026-08-10',
    doc: 'протокол КАБК №11 от 10.08.2026', until: '' };
  const h = CL.panelHtml();
  ok(78, /<option selected>КД-2025\/043<\/option>/.test(h) &&
       /value="f-noAct" selected/.test(h) && /id="fWhen"[^>]*value="2026-08-10"/.test(h) &&
       /value="протокол КАБК №11 от 10\.08\.2026"/.test(h),
    `форма факта рисуется из состояния: отказ по одному полю не стирает остальные четыре — КФ-Д11`);

  CL.seed();
  CL.state.view = 'facts'; CL.state.role = 'Наблюдатель';
  const obs = CL.panelHtml();
  const insp = (CL.seed(), CL.state.view = 'facts', CL.state.role = 'Кредитный инспектор', CL.panelHtml());
  ok(79, !/Завести факт по кредиту/.test(obs) && !/>аннулировать</.test(obs) &&
       /Только просмотр/.test(obs) && /Завести факт по кредиту/.test(insp) && />аннулировать</.test(insp),
    `экран фактов развёрнут по роли: у наблюдателя формы и кнопок нет вовсе, у инспектора есть — КФ-Д16`);
})();

(() => {
  CL.seed();
  const f = CL.addFact({ creditId: 'КД-2026/012', kindId: 'f-nonTarget', occurred: CL.state.today,
    doc: 'протокол КАБК №12 от 14.08.2026' });
  CL.state.view = 'show';
  const row = CL.panelHtml().split('<tr').find(r => r.includes('КД-2026/012'));
  const blind = stored('КД-2026/012');
  ok(81, f.ok && !blind.ok && blind.nodata === true && /нет данных/.test(row) &&
       /Реестр фактов кредита/.test(row) && /засчитан/.test(row),
    `у кредита без значения (${blind.why[0].slice(0, 40)}…) реестр фактов виден и факт числится засчитанным — причина отказа и судьба факта разные вопросы, КФ-Д15`);
})();

(() => {
  CL.seed();
  const vals = CL.activeVer('risk').values.length;
  const stop = CL.stopClassifier('risk', { reason: 'Порядок №41 отменил классификацию по этому признаку' });
  CL.state.view = 'clf'; CL.state.curClf = null;
  const row = CL.panelHtml().split('<tr').find(r => r.includes('risk'));
  ok(82, stop.ok && vals === 3 && new RegExp('<td class="mono">' + vals + '</td>').test(row) &&
       /действие прекращено/.test(row),
    `у прекращённого классификатора графа «Значений» показывает ${vals} — значения последней редакции, а не ноль при трёх заведённых, КФ-Д17`);
})();

/* ---------- M. Волна 7: хранимый результат (ADR-0246, ИК-23…ИК-26, P19 ред. 2) ---------- */
(() => {
  CL.seed();
  // P19-R24: ряд КД-2024/117 — какие интервалы и почему именно такие.
  const s = series('risk', 'кредит', 'КД-2024/117');
  const r1 = s.find(iv => iv.verNo === 1 && iv.code === 'high');
  const r2 = s.find(iv => iv.verNo === 2);
  const norms = r2 ? r2.why.filter(w => w.k === 'rule').map(w => w.norm).join(' + ') : '';
  const facts = r2 ? r2.why.filter(w => w.k === 'fact').map(w => w.id).join() : '';
  ok(84, s.length === 3 && r1 && r1.from === '2026-06-11' && r1.until === '2026-07-05' &&
       r2 && r2.from === '2026-07-06' && r2.until === null && norms === 'п. 19.1 + п. 11.3' && facts === 'F-001' &&
       !JSON.stringify(s).includes('214') && s[0].code === 'mid' && s[0].until === '2026-06-10',
    `ряд КД-2024/117: ${s.map(iv => span(iv) + ' ' + iv.code + ' ред.' + iv.verNo).join(' · ')}; в интервале ред. 2 — ${norms} и ${facts}, F-005 интервала не открыл, числа 214 в ряду нет — P19-R24, ИК-24`);
})();

(() => {
  CL.seed();
  // ИК-24: витрина, карточка разбора, шов, предпросмотр и отчёт движок не исполняют.
  let runs = 0;
  const orig = CL.classifyWith;
  CL.classifyWith = (...a) => { runs++; return orig(...a); };
  CL.state.view = 'show'; CL.panelHtml();
  CL.state.asOf = '2026-06-30'; CL.panelHtml(); CL.state.asOf = CL.state.today;
  CL.openObj('кредит', 'КД-2024/117'); CL.panelHtml();
  CL.openObj('заёмщик', '02107201910148'); CL.panelHtml();
  CL.go('per'); CL.panelHtml(); CL.closePreview(); CL.report12('2026-06');
  CL.state.credits.forEach(c => CL.riskCategory('кредит', c.id, '2026-07-31'));
  CL.statisticsValue('risk', 'кредит', 'КД-2023/210', '2026-08-15');
  const readRuns = runs;
  CL.nightly();
  CL.classifyWith = orig;
  ok(85, readRuns === 0 && runs > 0,
    `чтение не считает: витрина на две даты, карточки разбора, периоды, предпросмотр, отчёт п. 12 и шов — вызовов движка ${readRuns}; ночной проход — ${runs} — ИК-24`);
})();

(() => {
  CL.seed();
  // P19-R25: аннулирование F-003 — метка с 01.07, перезапись с 06.07, «было» целиком в журнале.
  const june = JSON.stringify(CL.store.at('risk', 'кредит', 'КД-2025/088', '2026-06-30'));
  const r = CL.annulFact('F-003', 'заведён на другой кредит');
  const j = CL.rewritesOf('кредит', 'КД-2025/088').filter(x => x.clf === 'risk');
  const was = j[0] && j[0].was[0];
  const now = CL.store.at('risk', 'кредит', 'КД-2025/088', CL.state.today);
  const r1 = CL.store.at('risk', 'кредит', 'КД-2025/088', '2026-07-03');
  const T = '2026-08-14 10:00';
  const before = CL.shownAt('risk', 'кредит', 'КД-2025/088', '2026-07-10', T);
  const later = CL.shownAt('risk', 'кредит', 'КД-2025/088', '2026-07-10', '2026-08-14 23:00');
  ok(86, r.ok && r.markerFrom === '2026-07-01' && !CL.state.markers.length && j.length === 1 &&
       j[0].D === '2026-07-01' && j[0].F === '2026-07-06' && j[0].cause === 'аннулирование F-003' &&
       was.from === '2026-07-06' && was.why.filter(w => w.k === 'rule').length === 2 && was.why.some(w => w.id === 'F-003') &&
       now.from === '2026-07-06' && now.why.length === 1 && r1.verNo === 1 && r1.from === '2026-05-01' && r1.until === '2026-07-05' &&
       JSON.stringify(CL.store.at('risk', 'кредит', 'КД-2025/088', '2026-06-30')) === june &&
       before.from === 'журнал перезаписи' && before.answer.why.length === 3 && later.from === 'текущий ряд' && later.answer.why.length === 1,
    `аннулирование F-003: метка с 01.07.2026 разобрана сразу; с 06.07 правило одно, прежний интервал (2 правила + F-003) — в журнале перезаписи с причиной «${j[0] && j[0].cause}»; отрезок 01.07–05.07 (часть интервала ред. 1 «низкий» с 01.05) и июнь не тронуты; «на момент ${T}» — из журнала — P19-R25, ИК-25`);
})();

(() => {
  CL.seed();
  // ИК-25: метки одного объекта сливаются по самой ранней дате; признак «обновляется».
  CL.setHandler(false);
  CL.annulFact('F-001', 'проверка слияния');
  CL.addFact({ creditId: 'КД-2024/117', kindId: 'f-lostColl', occurred: '2026-08-10', doc: 'протокол КАБК № 23' });
  const mk = CL.state.markers.filter(x => x.id === 'КД-2024/117');
  const upd = CL.riskCategory('кредит', 'КД-2024/117', CL.state.today);
  const old = CL.riskCategory('кредит', 'КД-2024/117', '2026-06-20');
  const fold = CL.riskCategory('заёмщик', '02107201910148', CL.state.today);
  const wait = (CL.go('wait'), CL.panelHtml());
  CL.state.role = 'Наблюдатель';
  const roWait = CL.panelHtml();
  const roRetry = CL.retryMarker('кредит', 'КД-2024/117');
  ok(87, mk.length === 1 && mk[0].from === '2026-07-01' && mk[0].events.length === 2 && upd.updating === true &&
       old.updating === false && fold.updating === true && /Висящие метки/.test(wait) && /КД-2024\/117/.test(wait) &&
       /разобрать сейчас/.test(wait) && !/разобрать сейчас/.test(roWait) && /КД-2024\/117/.test(roWait) && !roRetry.ok,
    `при остановленном обработчике два события КД-2024/117 дали одну метку с ${fmtD(mk[0].from)} (событий ${mk[0].events.length}); ответ на сегодня «обновляется», на 20.06 — нет, свёртка заёмщика тоже «обновляется»; очередь наблюдатель читает, повтор вручную — у администратора — ИК-25, ТЗ 17 §11`);
})();

(() => {
  CL.seed();
  // P19-R18: обработчик остановлен — закрытие июля отклонено перечнем; после разбора закрывается без записей.
  CL.setHandler(false);
  const f = CL.addFact({ creditId: 'КД-2025/088', kindId: 'f-collDown', occurred: '2026-06-12', doc: 'протокол КАБК № 19 от 30.06.2026' });
  const june = CL.store.at('risk', 'кредит', 'КД-2025/088', '2026-06-30');
  const first = CL.closePeriod();
  CL.setHandler(true);
  const n0 = CL.state.intervals.length;
  const second = CL.closePeriod();
  ok(88, f.ok && f.markerFrom === '2026-07-01' && june.code === 'low' && june.verNo === 1 &&
       !first.ok && first.refusals.includes('КД-2025/088 — ожидает пересчёта с 01.07.2026') &&
       second.ok && second.written === 0 && CL.state.intervals.length === n0 && CL.isClosed('2026-07-31'),
    `метка с 01.07.2026, интервал 30.06 («Низкий», ред. 1) не тронут; первое закрытие июля: «${first.refusals && first.refusals[0]}»; после разбора метки июль закрыт, записей 0 — P19-R18, ИК-26`);
})();

(() => {
  CL.seed();
  // ИК-23: защёлка классификации — только после защёлки учёта того же месяца.
  CL.period('2026-07').uchet = null;
  const r = CL.closePeriod();
  ok(89, !r.ok && r.refusals.length === 1 && /учёт ещё не закрыл июль 2026/.test(r.refusals[0]) && /ИК-23/.test(r.refusals[0]),
    `без защёлки учёта июль не закрывается: «${r.refusals[0]}» — ИК-23`);
})();

(() => {
  CL.seed();
  // ИК-26: сторож базы — интервал закрытого месяца не создаётся, не правится, не удаляется;
  // «по» пересекающего интервала — не раньше последнего дня закрытого месяца.
  const cross = CL.store.at('risk', 'кредит', 'КД-2024/117', '2026-06-20');   // 11.06–05.07
  const inside = CL.store.at('risk', 'кредит', 'КД-2024/117', '2026-05-20');  // 01.05–10.06
  const add = CL.store.add({ clf: 'risk', type: 'кредит', id: 'КД-2025/043', from: '2026-06-10' });
  const cut = CL.store.setUntil(cross, '2026-06-20');
  const cutOk = CL.store.setUntil(JSON.parse(JSON.stringify(cross)), '2026-06-30');
  const del = CL.store.remove(inside);
  const rw = CL.store.rewrite({ clf: 'risk', type: 'кредит', id: 'КД-2024/117' }, '2026-06-15', [], 'тест', CL.now());
  ok(90, !add.ok && !cut.ok && cutOk.ok && !del.ok && !rw.ok && [add, cut, del, rw].every(x => /ИК-26/.test(x.why)) &&
       cross.until === '2026-07-05' && CL.store.series('risk', 'кредит', 'КД-2024/117').length === 3,
    `закрытый июнь заперт: создать, удалить и переписать с 15.06 — отказ; «по» интервала 11.06–05.07 ставится на 30.06, но не на 20.06: «${cut.why}»`);
})();

(() => {
  CL.seed();
  // Ночной проход: смена по дате без события — движение вперёд, журнала перезаписи нет.
  const r = CL.nightly();
  const s = series('risk', 'кредит', 'КД-2025/043');
  const last = s[s.length - 1];
  const entry = CL.state.night.find(n => n.kind === 'смена по дате' && n.id === 'КД-2025/043');
  ok(91, r.ok && CL.state.today === '2026-08-15' && r.mismatches === 0 && r.transitions === 1 &&
       last.from === '2026-08-15' && last.code === 'mid' && s[s.length - 2].until === '2026-08-14' &&
       !CL.state.rewrites.length && entry && /текущая просрочка от 1 дня/.test(entry.text),
    `ночной проход 15.08 02:00: у КД-2025/043 первый день просрочки — «${entry && entry.text}»; интервал открыт с 15.08, журнал перезаписи пуст — ADR-0246 §5, §8`);
})();

(() => {
  CL.seed();
  // Дефект стыка: сторно без метки ряд не трогает; ночная сверка пишет расхождение с владельцами,
  // ставит метку и только тогда переписывает ряд задним числом.
  CL.simulate('storno043');
  const silent = CL.riskCategory('кредит', 'КД-2025/043', CL.state.today);
  const r = CL.nightly();
  const defect = CL.state.night.find(n => n.kind === 'расхождение');
  const j = CL.rewritesOf('кредит', 'КД-2025/043');
  const iv = CL.store.at('risk', 'кредит', 'КД-2025/043', '2026-07-20');
  ok(92, silent.code === 'low' && !silent.updating && r.mismatches === 1 && defect && defect.id === 'КД-2025/043' &&
       defect.owners.includes('Платежи') && j.length === 1 && j[0].F === '2026-07-15' && /дефект стыка/.test(j[0].cause) &&
       iv.code === 'mid' && !CL.state.markers.length,
    `сторно 14.07 без метки: ряд молчит («${silent.label}»); сверка за 14.08 записала расхождение, адресаты — ${defect && defect.owners.join(', ')}; ряд переписан с ${j[0] && fmtD(j[0].F)}, «было» в журнале — ИК-25, толкование ADR-0246 §5`);
})();

(() => {
  CL.seed();
  // ADR-0246 §9: недоступный владелец — сбой, а не «не отдан»: метка висит, интервалы не тронуты.
  const before = JSON.stringify(CL.state.intervals);
  CL.setOwnerDown('Платежи', true);
  const f = CL.addFact({ creditId: 'КД-2024/117', kindId: 'f-noAct', occurred: '2026-08-10', doc: 'протокол КАБК № 24' });
  const mk = CL.markerOf('кредит', 'КД-2024/117');
  const tries = mk && mk.attempts, err = mk && mk.lastError;
  const same = JSON.stringify(CL.state.intervals) === before;
  const upd = CL.riskCategory('кредит', 'КД-2024/117', CL.state.today);
  const retry = CL.retryMarker('кредит', 'КД-2024/117');
  CL.setOwnerDown('Платежи', false);
  const retry2 = CL.retryMarker('кредит', 'КД-2024/117');
  ok(93, f.ok && tries === 1 && /Платежи/.test(err) && same && upd.updating && upd.code === 'high' &&
       !retry.ok && retry2.ok && !CL.markerOf('кредит', 'КД-2024/117') &&
       !CL.state.intervals.some(iv => iv.state === 'нет данных' && iv.id === 'КД-2024/117'),
    `«Платежи» не отвечают: метка висит (попыток ${tries}, ошибка «${err}»), интервалы не тронуты, ответ «обновляется»; владелец вернулся — метка разобрана, «нет данных» по сбою не писалось — ADR-0246 §9`);
})();

(() => {
  CL.seed();
  // P19-R21: шов — хранимое на дату, признаки, статистика на D−1, дата обязательна.
  const a30 = CL.riskCategory('кредит', 'КД-2023/210', '2026-06-30');
  const a14 = CL.riskCategory('кредит', 'КД-2023/210', '2026-08-14');
  const s15 = CL.statisticsValue('risk', 'кредит', 'КД-2023/210', '2026-08-15');
  const noDate = CL.valueAt('risk', 'кредит', 'КД-2023/210');
  const days30 = CL.overdueOf(CL.credit('КД-2023/210'), '2026-06-30').days;
  ok(94, a30.code === 'high' && a30.verNo === 1 && a30.closed && has(a30.why, 'п. 19.1') && days30 >= 181 &&
       a14.code === 'mid' && a14.verNo === 2 && !a14.closed && !a14.updating &&
       s15.readDate === '2026-08-14' && s15.code === a14.code && !noDate.ok && noDate.nodate,
    `КД-2023/210: 30.06 — «${a30.label}», ред. 1, п. 19.1 (${days30} дн на ту дату), «период закрыт»; 14.08 — «${a14.label}», ред. 2; строка статистики 15.08 читает ${fmtD(s15.readDate)}; запрос без даты отклонён — P19-R21, КФ-Д21`);
})();

(() => {
  CL.seed();
  // P19-R22: платежи отзывают расчёт по КД-2025/043 с меткой — свёртка «нет данных» с именем кредита.
  const before = CL.riskCategory('заёмщик', '02107201910148', CL.state.today);
  const sim = CL.simulate('recall043');
  const after = CL.riskCategory('заёмщик', '02107201910148', CL.state.today);
  const yesterday = CL.riskCategory('заёмщик', '02107201910148', '2026-08-13');
  ok(95, before.code === 'high' && before.sourceCreditId === 'КД-2024/117' && sim.ok && sim.marker &&
       after.state === 'нет данных' && has(after.why, 'КД-2025/043') && after.interval.from === CL.state.today &&
       yesterday.code === 'high' && !CL.state.markers.length,
    `Ак-Жол: до события — «${before.label}» (источник ${before.sourceCreditId}); после отзыва расчёта — новый интервал «нет данных» с ${fmtD(after.interval.from)}, названа КД-2025/043; вчера по-прежнему «высокий» — P19-R22, ИК-20`);
})();

(() => {
  CL.seed();
  // P19-R19: предпросмотр июля при висящей метке — четыре графы и строка без интервалов.
  CL.setHandler(false);
  CL.annulFact('F-003', 'заведён на другой кредит');
  const pv = CL.closePreview();
  const risk = pv.rows.find(r => r.clfId === 'risk');
  const pay = pv.rows.find(r => r.clfId === 'pay');
  const vals = risk.values.map(v => v.objs.length).join('/');
  CL.setHandler(true);
  const pv2 = CL.closePreview();
  const risk2 = pv2.rows.find(r => r.clfId === 'risk');
  CL.go('per');
  const html = CL.panelHtml();
  ok(96, risk.withValue === 5 && vals === '1/3/1' && risk.out.length === 2 && risk.nodata.length === 0 &&
       pv.hanging.length === 1 && pv.hanging[0].id === 'КД-2025/088' && !pv.canClose &&
       pay.verNo === null && /интервалов за месяц нет/.test(pay.why) &&
       !pv2.hanging.length && risk2.withValue === 5 && pv2.canClose &&
       /Предпросмотр закрытия июль 2026/.test(html) && !/Записи фиксации/.test(html),
    `предпросмотр июля: со значением 5 (${vals}), вне области 2, нет данных 0, висящих меток 1 — КД-2025/088; «Группа платёжеспособности» без интервалов; после разбора метки — те же числа, меток 0 — P19-R19`);
})();

(() => {
  CL.seed();
  // P19-R20: отчёт за июнь из запертых интервалов; аннулирование F-001 его не двигает.
  const a = CL.report12('2026-06');
  CL.annulFact('F-001', 'проверка отчёта');
  const b = CL.report12('2026-06');
  const cnt = r => r.rows.map(x => x.count).join('/');
  ok(97, a.ok && cnt(a) === '2/1/2' && cnt(b) === '2/1/2' && JSON.stringify(a.rows) === JSON.stringify(b.rows) &&
       a.closedAt === '2026-07-03' && a.by === 'Сламкулов А. О.' && a.late && a.lateBy === 30 && a.verNo === 1,
    `отчёт п. 12 за июнь: ${cnt(a)} по ред. 1, закрыт ${fmtD(a.closedAt)} (${a.by}); после аннулирования F-001 — ${cnt(b)}; построен 14.08 — предупреждение о просрочке на ${a.lateBy} дн. — P19-R20, ИК-14`);
})();

(() => {
  CL.seed();
  // КФ-Д21: КД-2026/012 до выдачи интервалов не имеет; в июне у 210 — «высокий» по собственному числу.
  const s012 = series('risk', 'кредит', 'КД-2026/012');
  const jul = CL.riskCategory('кредит', 'КД-2026/012', '2026-07-31');
  const sub = series('sub', 'заёмщик', '01503200110077');
  ok(98, s012.length === 1 && s012[0].from === '2026-08-12' && s012[0].state === 'нет данных' &&
       !jul.interval && /ещё нет: он выдан 12\.08\.2026/.test(jul.why[0]) &&
       !sub.some(iv => iv.from < '2026-07-01'),
    `КД-2026/012: единственный интервал «нет данных» с 12.08.2026, на 31.07 — «${jul.why[0]}»; подгрупп до ввода ред. 1 (01.07) нет — КФ-Д21, ADR-0246 §2`);
})();

(() => {
  CL.seed();
  // Прекращение действия датой первого дня без редакции: ред. закрыта днём раньше, ряды укорочены.
  const bad = CL.stopClassifier('risk', { reason: 'x', from: '2026-07-06' });
  const st = CL.stopClassifier('risk', { reason: 'отменён признак', from: '2026-08-10' });
  const ver = CL.editionNo('risk', 2);
  const s = series('risk', 'кредит', 'КД-2024/117');
  const on = CL.valueAt('risk', 'кредит', 'КД-2024/117', '2026-08-10');
  const pre = CL.valueAt('risk', 'кредит', 'КД-2024/117', '2026-08-09');
  ok(99, !bad.ok && /ИК-22/.test(bad.why) && st.ok && ver.until === '2026-08-09' &&
       s[s.length - 1].until === '2026-08-09' && on.stopped && /прекращено с 10\.08\.2026/.test(on.why[0]) &&
       pre.ok && pre.code === 'high' && CL.rewritesOf('кредит', 'КД-2024/117').length === 1,
    `прекращение с 10.08.2026: ред. 2 по 09.08 включительно, ряд укорочен до 09.08 (изменение прошлых дней — в журнале перезаписи), на 10.08 — «${on.why[0].slice(0, 45)}…»; дата не позже ввода редакции отклонена — ИК-19, ИК-22`);
})();

(() => {
  CL.seed();
  // Экраны волны 7: меню, фильтр витрины, карточка разбора, ночной журнал.
  CL.go('show');
  CL.showFilterUI('нет данных');
  const rows = CL.panelHtml().split('<tr').filter(r => r.includes('CL.openObj(\'кредит\''));
  CL.showFilterUI(null);
  CL.annulFact('F-003', 'заведён на другой кредит');
  CL.openObj('кредит', 'КД-2025/088');
  const card = CL.panelHtml();
  CL.go('night');
  const night = CL.panelHtml();
  const nav = ['data-v="wait"', 'data-v="night"', 'id="waitCnt"'].every(x => src.includes(x));
  ok(100, rows.length === 1 && rows[0].includes('КД-2026/012') &&
       /История перезаписей объекта/.test(card) && /Что система показывала на момент T/.test(card) &&
       /Разбор по шагам — из хранимого интервала/.test(card) && /аннулирование F-003/.test(card) &&
       /Запустить ночной проход/.test(night) && /смена по дате/.test(night) && nav,
    `фильтр витрины «нет данных» оставляет один кредит — КД-2026/012; карточка разбора несёт ряд, историю перезаписей, «что показывала на момент T» и разбор по шагам; в меню «Ожидают пересчёта» и «Журнал ночного прохода» — P19-R13, R24, R25`);
})();

/* ---------- N. Сторож текста: инварианты и решения названы в файле ---------- */
(() => {
  const iks = Array.from({ length: 26 }, (_, i) => 'ИК-' + (i + 1)).filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const ivs = Array.from({ length: 26 }, (_, i) => 'И-' + (i + 1)).filter(k => !new RegExp('  ' + k + '\\s').test(src));
  const adrs = ['ADR-0120','ADR-0121','ADR-0122','ADR-0124','ADR-0125','ADR-0126','ADR-0127','ADR-0137','ADR-0204','ADR-0246']
    .filter(a => !src.includes(a));
  ok(43, iks.length === 0 && ivs.length === 0 && adrs.length === 0,
    `в файле названы все 26 инвариантов (И-1…И-26 в шапке, ИК-1…ИК-26 в коде) и 10 решений${iks.length ? ' · нет: ' + iks.join(',') : ''}${ivs.length ? ' · нет в шапке: ' + ivs.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const hardcoded = /(п\.\s*11\.3|п\.\s*19\.1|исполнительные листы)/.test(
    m[1].slice(m[1].indexOf('ДВИЖОК'), m[1].indexOf('ШОВ')));
  ok(44, !hardcoded, `в движке, хранилище интервалов и обработчике меток нет ни пунктов Порядка, ни ступеней лестницы — правила приходят данными (ADR-0120)`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.slice().sort((a, b) => a.n - b.n)
  .map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-09-18 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

// Результат вписывается в шапку макета — блок под строкой-маркером до конца комментария.
const marker = 'SMOKE (прогон на нашей стороне, `classification-check.mjs`; в пакет передачи не входит):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, (_, a, b) => a + injected + b), 'utf8');
  console.log('\n→ результат вставлен в шапку classification.html');
}

process.exit(pass === results.length ? 0 : 1);
