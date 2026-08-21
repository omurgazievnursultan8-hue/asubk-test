// Headless smoke для mockups/classification/classification.html (ИК-1…ИК-21, ADR-0120…0137).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение движка, конструктора, фактов, шва и фиксации, а не разметка.
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
const cred = id => CL.classify('risk', 'кредит', id);

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
    `действующая ред. ${a && a.no} с ${a && a.from}, прошлая ред. ${past && past.no} до ${past && past.until}`);

  const draftPay = CL.draftVer('pay');
  ok(3, draftPay && !CL.activeVer('pay') && draftPay.values.length === 3,
    `у «Группы платёжеспособности» только черновик, значений ${draftPay && draftPay.values.length}, действующей нет`);
})();

/* ---------- B. Движок на демо-данных ---------- */
(() => {
  CL.seed();
  const r117 = cred('КД-2024/117');
  ok(4, r117.ok && r117.code === 'high' && r117.fired.length === 2 &&
       has(r117.fired.map(f => f.norm), 'п. 19.1') && has(r117.fired.map(f => f.norm), 'п. 11.3'),
    `КД-2024/117 → ${r117.label}, сработавших правил ${r117.fired.length} (${r117.fired.map(f => f.norm).join(' + ')}) — ИК-11`);

  const r210 = cred('КД-2023/210');
  const v = CL.indicatorsOfCredit(CL.credit('КД-2023/210'));
  ok(5, r210.ok && r210.code === 'mid' && v.daysOverdue === 200 && v.defer181 === true &&
       has(r210.fired.map(f => f.norm), 'п. 11.2') &&
       has(r210.fired.map(f => f.label), 'просрочка'),
    `КД-2023/210: 200 дн, отложение п. 19.1 включено → ${r210.label} по ${r210.fired.map(f => f.norm + ' («' + f.label + '»)').join(', ')}`);

  const r004 = cred('КД-2019/004');
  ok(6, !r004.ok && r004.out === true && has(r004.why, 'вне области'),
    `КД-2019/004 вне области: «${r004.why[0]}» — ИК-7`);

  const r043 = cred('КД-2025/043');
  const lvl043 = CL.indicatorsOfCredit(CL.credit('КД-2025/043')).factorLevel;
  ok(7, r043.ok && r043.code === 'low' && lvl043 === 'нет',
    `КД-2025/043: фактор без решения комитета в показатель не вошёл (уровень «${lvl043}») → ${r043.label} — ИК-10`);

  const r088 = cred('КД-2025/088');
  ok(8, r088.ok && r088.code === 'mid' && r088.fired.length === 2,
    `КД-2025/088 → ${r088.label}, правил сработало ${r088.fired.length} (просрочка + фактор п. 11.2)`);

  const i101 = CL.indicatorsOfCredit(CL.credit('КД-2025/101'));
  const r101 = cred('КД-2025/101');
  ok(9, i101.daysOverdue === 45 && i101.overdueLayer === 'мировое соглашение' && r101.code === 'mid',
    `КД-2025/101: худший слой «${i101.overdueLayer}» ${i101.daysOverdue} дн → ${r101.label} — пара показателей ИК-18`);

  const mute = CL.state.credits.map(c => CL.classify('risk', 'кредит', c.id)).filter(r => !(r.why || []).length);
  ok(10, mute.length === 0, `объяснение есть у всех ${CL.state.credits.length} кредитов, молчаливых отказов 0 — §0.3`);
})();

/* ---------- C. Факты ---------- */
(() => {
  CL.seed();
  const f2 = CL.state.facts.find(f => f.id === 'F-002');
  ok(11, CL.factFate(f2) === 'не засчитан: нет решения комитета', `F-002: «${CL.factFate(f2)}» — ИК-10/ИК-12`);

  const f3 = CL.state.facts.find(f => f.id === 'F-003');
  ok(12, f3.occurred === '2026-06-12' && f3.counted === '2026-07-01' && f3.counted === CL.startOfOpen(),
    `F-003 наступил ${f3.occurred}, учтён с ${f3.counted} (начало открытого периода) — ИК-9`);

  const f4 = CL.state.facts.find(f => f.id === 'F-004');
  ok(13, CL.factFate(f4) === 'не засчитан: интервал истёк', `F-004: «${CL.factFate(f4)}» — ИК-12`);

  const add = CL.addFact({ creditId: 'КД-2024/117', kindId: 'f-noAct', occurred: '2026-08-01', doc: 'протокол КАБК № 20' });
  const light = CL.state.facts.find(f => f.id === add.id);
  const fate = CL.factFate(light, cred('КД-2024/117').code);
  ok(14, add.ok && fate === 'не засчитан: ведёт к более лёгкому значению, чем выбранное',
    `средний фактор при выбранном высоком: «${fate}» — третья причина закрытого списка ИК-12`);

  const late = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-collDown', occurred: '2026-06-20', doc: 'протокол КАБК № 21' });
  ok(15, late.ok && late.counted === CL.startOfOpen(),
    `факт из закрытого июня принят и учтён с ${late.counted}, прошлое не переписано — ИК-9/ИК-8`);

  const future = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-noAct', occurred: '2026-09-01', doc: 'протокол' });
  ok(16, !future.ok && /будущем/.test(future.why), `факт из будущего отклонён: «${future.why}»`);

  const noReason = CL.annulFact('F-003', '');
  const before = cred('КД-2025/088').fired.length;
  const annul = CL.annulFact('F-003', 'ошибка ввода вида фактора');
  const after = cred('КД-2025/088');
  ok(17, !noReason.ok && annul.ok && CL.state.facts.some(f => f.id === 'F-003') &&
        before === 2 && after.fired.length === 1 && after.code === 'mid',
    `аннулирование без причины отклонено; после аннулирования F-003 факт остался в реестре, правил ${before} → ${after.fired.length}, значение ${after.label}`);

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
  ok(25, good.ok && act.no === 3 && prev.status === 'прошлая' && prev.until === '2026-07-20',
    `редакция 3 введена с 20.07.2026, редакция 2 закрыта той же датой`);

  const june = CL.riskCategory('кредит', 'КД-2025/088', '2026-06-01');
  ok(26, june.ok && june.source === 'запись фиксации' && june.code === 'low' && june.verNo === 1,
    `после смены редакции июнь читается записью ред. 1 → «${june.label}», пересчёта нет — ИК-8`);
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

/* ---------- F. Периоды, фиксация, отчёт п. 12, свёртка ---------- */
(() => {
  CL.seed();
  CL.state.role = 'Наблюдатель';
  const denied = CL.closePeriod();
  CL.state.role = 'Администратор классификации';
  ok(33, !denied.ok, `наблюдатель период не закрывает: «${denied.why}»`);

  /* Записи получают только те, кто и в области, и с данными: «вне области» (ИК-7) и
     «нет данных» (ИК-20) — два разных законных повода не писать запись. */
  const riskOk = CL.state.credits.filter(c => CL.classify('risk', 'кредит', c.id).ok).length;
  const subOk  = CL.state.borrowers.filter(b => CL.classify('sub', 'заёмщик', b.inn).ok).length;
  const activeCredits = CL.state.credits.filter(c => c.active).length;
  const res = CL.closePeriod();
  const written = CL.state.records.filter(r => r.period === '2026-07');
  const outOfScope = written.filter(r => r.objType === 'кредит' && !CL.credit(r.objId).active);
  ok(34, res.ok && res.period === '2026-07' &&
        written.filter(r => r.clfId === 'risk').length === riskOk &&
        written.filter(r => r.clfId === 'sub').length === subOk &&
        riskOk < activeCredits && subOk < CL.state.borrowers.length &&
        outOfScope.length === 0,
    `июль закрыт: записей ${written.length} (риск ${riskOk} из ${activeCredits} действующих кредитов + подгруппа ${subOk} из ${CL.state.borrowers.length} заёмщиков); без записи остались вне области и без данных — ИК-7, ИК-20`);

  const again = CL.closePeriod();
  ok(35, CL.openPeriod() === '2026-08' && !again.ok && /не завершён/.test(again.why),
    `открылся август; повторное закрытие отклонено: «${again.why}» — ИК-13`);

  const rep = CL.report12('2026-07');
  const sum = rep.rows.reduce((a, r) => a + r.count, 0);
  ok(36, rep.asOf === '2026-08-01' && rep.deadline === '2026-08-15' && rep.late === false &&
        rep.total === riskOk && sum === riskOk,
    `отчёт п. 12 за июль: по состоянию на ${rep.asOf}, срок ${rep.deadline}, сформирован ${rep.closedAt} — в срок; кредитов ${rep.total} (столько же, сколько записей)`);

  const closed = CL.riskCategory('кредит', 'КД-2024/117', '2026-07-15');
  const live = CL.riskCategory('кредит', 'КД-2024/117', CL.state.today);
  ok(37, closed.source === 'запись фиксации' && live.source === 'расчёт' && closed.code === live.code,
    `шов на 15.07 отдаёт запись, на 14.08 — расчёт; потребитель различия не знает — ИК-8`);

  const after = CL.addFact({ creditId: 'КД-2025/043', kindId: 'f-noAct', occurred: '2026-07-20', doc: 'протокол КАБК № 22' });
  ok(38, after.ok && after.counted === '2026-08-01',
    `факт от 20.07, вскрывшийся после закрытия июля, учтён с ${after.counted} — ИК-9`);
})();

(() => {
  CL.seed();
  const now = CL.riskCategory('заёмщик', '02107201910148', CL.state.today);
  const june = CL.riskCategory('заёмщик', '02107201910148', '2026-06-01');
  ok(39, now.ok && now.code === 'high' && now.sourceCreditId === 'КД-2024/117' &&
        june.ok && june.source === 'запись фиксации' && june.sourceCreditId === 'КД-2024/117',
    `свёртка worst-of: сегодня — ${now.label} по ${now.sourceCreditId} (расчёт), июнь — по записям того же периода`);

  CL.activeVer('risk').comparable = false;   // сторож: конструктор так не даёт, правим состояние
  const forbid = CL.foldBorrower('02107201910148');
  ok(40, !forbid.ok && forbid.forbidden === true && /ИК-6/.test(forbid.why[0]),
    `без признака сравнимости свёртка запрещена: «${forbid.why[0]}»`);

  CL.seed();
  const sub1 = CL.classify('sub', 'заёмщик', '02107201910148');
  const sub2 = CL.classify('sub', 'заёмщик', '11902199800433');
  const sub3 = CL.classify('sub', 'заёмщик', '22508199500821');
  ok(41, sub1.code === '2.2' && sub2.code === '5' && sub3.code === '1.2' &&
        CL.activeVer('sub').comparable === false,
    `лестница подгруппы тем же движком: ${sub1.label} · ${sub2.label} · ${sub3.label}; признака сравнимости нет — свернуть нельзя`);

  const pay = CL.classify('pay', 'заёмщик', '02107201910148');
  ok(42, !pay.ok && pay.draft === true && has(pay.why, 'черновик'),
    `черновик значений не назначает: «${pay.why[0]}»`);
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
  const silent = CL.classify('pledge', 'кредит', 'КД-2024/117');
  const taken = CL.addClassifier({ id: 'risk', name: 'Дубль', object: 'кредит' });
  const badObj = CL.addClassifier({ id: 'x', name: 'Икс', object: 'залог' });
  CL.state.role = 'Кредитный инспектор';
  const notAdmin = CL.addClassifier({ id: 'y', name: 'Игрек', object: 'кредит' });
  ok(46, made.ok && fresh.versions.length === 1 && fresh.versions[0].status === 'черновик' &&
        !silent.ok && silent.draft === true &&
        !taken.ok && !badObj.ok && !notAdmin.ok,
    `классификатор заведён настройкой: редакция 1 — черновик, значений не назначает; занятый id, чужой объект и не-администратор отклонены — ADR-0120`);

  CL.seed();
  // Прекращение действия — не удаление: записи закрытых периодов обязаны остаться читаемыми.
  CL.closePeriod();                                   // закрываем июль, чтобы было что читать
  const noReason = CL.stopClassifier('risk', { reason: '' });
  const early = CL.stopClassifier('risk', { reason: 'отмена признака', until: '2026-06-15' });
  const stop = CL.stopClassifier('risk', { reason: 'Порядок №41 отменил классификацию по признаку' });
  const after = CL.classify('risk', 'кредит', 'КД-2024/117');
  const record = CL.riskCategory('кредит', 'КД-2024/117', '2026-07-15');
  ok(47, !noReason.ok && !early.ok && /ИК-4/.test(early.why) && stop.ok &&
        !after.ok && after.stopped === true && /прекращено/.test(after.why[0]) &&
        record.ok && record.source === 'запись фиксации',
    `действие прекращено (без причины и задним числом — отказ); значений больше нет, запись июля читается по-прежнему — ИК-19`);

  // Возобновление: черновик копирует последнюю редакцию, публикация снимает отметку.
  const d = CL.newDraft('risk');
  const copied = CL.draftVer('risk').values.length;
  const back = CL.publish('risk', { basis: 'Порядок №41, п. 11', from: CL.state.today });
  ok(48, d.ok && copied > 0 && back.ok && !CL.clf('risk').stopped &&
        CL.classify('risk', 'кредит', 'КД-2024/117').ok,
    `возобновление публикацией: черновик открыт копией последней редакции (значений ${copied}), отметка о прекращении снята — ИК-19`);
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
  const live = CL.classify('risk', 'кредит', 'КД-2024/117');
  ok(49, dry.ok && dry.cnt.total === CL.state.credits.length && dry.cnt.lost > 0 &&
        dry.rows.every(r => typeof r.changed === 'boolean') &&
        before === afterState && live.ok && live.code === 'high',
    `сухой прогон: объектов ${dry.cnt.total}, изменится ${dry.cnt.changed}, потеряют значение ${dry.cnt.lost}; состояние не изменилось, значения по-прежнему от действующей редакции — ИК-1`);

  CL.seed();
  // Предпросмотр закрытия считает тем же движком, что и закрытие: числа обязаны сойтись.
  const pv = CL.closePreview();
  const done = CL.closePeriod();
  const silentClf = CL.state.classifiers.filter(c => !CL.activeVer(c.id)).length;
  ok(50, pv.ok && pv.period === done.period && pv.willWrite === done.written &&
        pv.silent === silentClf && pv.rows.length === CL.state.classifiers.length,
    `предпросмотр закрытия сошёлся с закрытием: записей ${pv.willWrite} = ${done.written}, классификаторов без записи ${pv.silent} — ИК-13`);
})();

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
  const cls = CL.classify('pledge', 'кредит', 'КД-2024/117');
  ok(53, has(beforeMeta, 'не указано основание') && has(beforeMeta, 'не указана дата ввода') &&
        afterMeta.length === 0 && live.ok && live.no === 1 &&
        CL.activeVer('pledge').basis.includes('№41') && cls.ok && cls.label === 'достаточное',
    `новый классификатор доведён до действия: реквизиты пишутся в черновик (отказов было ${beforeMeta.length}, стало ${afterMeta.length}), публикация без аргументов прошла — КФ-Д6`);

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
  // Кнопок настройки в разметке нет вовсе: остаются только вкладки (переход, а не правка).
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
  // Вкладка публикации есть только у черновика и только у администратора.
  CL.open('risk');                       // действующая ред. 2, черновика нет
  const noPub = !CL.panelHtml().includes('Публикация редакции');
  CL.open('pay');                        // только черновик, ред. 1
  const withPub = CL.panelHtml().includes('Публикация редакции 1');
  CL.state.clfTab = 'pub';
  const pubTab = CL.panelHtml().includes('id="pubBasis"') && CL.panelHtml().includes('Сухой прогон черновика');
  CL.state.role = 'Наблюдатель';
  const roNoPub = !CL.panelHtml().includes('id="pubBasis"');   // вкладка снята, экран не пуст
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

  // Карточка показателя: где используется + отказ снятия списком, кнопка не гаснет.
  CL.openInd('daysOverdue');
  const used = CL.usedBy('daysOverdue').filter(u => u.status === 'действующая');
  const card = CL.panelHtml();
  const shows = card.includes('Где используется') && used.every(u => card.includes(u.clf));
  const refusesByList = card.includes('Снять с реестра нельзя') && card.includes('ИК-16');
  const liveBtn = card.includes('CL.retireIndicator(') && !/<button[^>]*disabled[^>]*>\s*Снять/.test(card);
  CL.openInd('oldRating');                      // снятый — кнопки снятия нет вовсе
  const retired = CL.panelHtml().includes('снят с реестра') && !CL.panelHtml().includes('CL.retireIndicator(');
  ok(59, shows && refusesByList && liveBtn && retired && used.length > 0,
    `карточка показателя: «Где используется» ${used.length} живых ссылок, снятие отказывает списком до нажатия, кнопка не блокируется — ИК-16`);
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

/* ---------- H. Волна 4: ИЛИ, «одно из списка», строгие операторы, область, ИК-20/ИК-21 ---------- */

// Правило значения адресуется парой (код значения, номер правила); область — тем же,
// но с псевдо-кодом CL.SCOPE. Ниже правки идут по черновику: действующая не правится (ИК-2).
const draftOf = clfId => { CL.newDraft(clfId); return CL.draftVer(clfId); };

(() => {
  CL.seed();
  const d = draftOf('risk');
  const high = d.values.find(v => v.code === 'high');
  // Строгие операторы: «свыше 180» — это > 180, а не ≥ 180.
  const strict = high.rules[0].preds[0];
  const at180 = CL.classifyWith(d, {creditActive:true, daysOverdue:180, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'}, true);
  const at181 = CL.classifyWith(d, {creditActive:true, daysOverdue:181, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'}, true);
  ok(61, strict.op === '>' && strict.v === 180 && at180.code === 'mid' && at181.code === 'high',
    `строгий оператор: «${strict.op} ${strict.v}» даёт на 180 дн — ${at180.label}, на 181 дн — ${at181.label}; ≥ 181 и > 180 совпали бы только на целых днях`);

  // ИЛИ между правилами значения: каждое правило доводит до значения в одиночку (ИК-11).
  const byOverdue = CL.classifyWith(d, {creditActive:true, daysOverdue:200, defer181:false, factorLevel:'нет', overdueLayer:'свободный слой'}, true);
  const byFactor  = CL.classifyWith(d, {creditActive:true, daysOverdue:0,   defer181:false, factorLevel:'высокий', overdueLayer:'нет просрочки'}, true);
  const both      = CL.classifyWith(d, {creditActive:true, daysOverdue:200, defer181:false, factorLevel:'высокий', overdueLayer:'свободный слой'}, true);
  ok(62, high.rules.length === 2 && byOverdue.code === 'high' && byFactor.code === 'high' &&
        both.fired.length === 2 && byOverdue.fired.length === 1 && byFactor.fired.length === 1,
    `ИЛИ между правилами: значение «${byOverdue.label}» берётся любым из ${high.rules.length} правил порознь, вместе сработали оба — ИК-11`);

  // Подпись различает два правила одного пункта; без неё публикация отказывает (ИК-21).
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
  // «Одно из списка»: ∈ по членам домена показателя-перечисления.
  CL.addRule('risk', 'mid', 'проектное решение');
  const ri = d.values.find(v => v.code === 'mid').rules.length - 1;
  CL.addPred('risk', 'mid', ri);
  CL.setPred('risk', 'mid', ri, 0, 'i', 'overdueLayer');
  CL.setPred('risk', 'mid', ri, 0, 'op', '∈');
  // Переход «=» → «∈» переносит уже выбранное значение в список: снимаем его вручную.
  CL.togglePredMember('risk', 'mid', ri, 0, 'нет просрочки', false);
  CL.togglePredMember('risk', 'mid', ri, 0, 'мировое соглашение', true);
  CL.togglePredMember('risk', 'mid', ri, 0, 'реструктуризация', true);
  const p = d.values.find(v => v.code === 'mid').rules[ri].preds[0];
  const inSet  = CL.classifyWith(d, {creditActive:true, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'мировое соглашение'}, true);
  const outSet = CL.classifyWith(d, {creditActive:true, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'нет просрочки'}, true);
  ok(64, p.op === '∈' && p.set.length === 2 && p.v === undefined &&
        inSet.code === 'mid' && outSet.code === 'low',
    `«одно из»: ${p.set.map(x => '«' + x + '»').join(' / ')} → ${inSet.label}; вне списка → ${outSet.label}`);

  // ∉ зеркально, и переключение оператора не теряет уже выбранное.
  CL.setPred('risk', 'mid', ri, 0, 'op', '∉');
  const notIn = CL.classifyWith(d, {creditActive:true, daysOverdue:0, defer181:false, factorLevel:'нет', overdueLayer:'нет просрочки'}, true);
  CL.setPred('risk', 'mid', ri, 0, 'op', '=');
  const scalar = d.values.find(v => v.code === 'mid').rules[ri].preds[0];
  ok(65, notIn.code === 'mid' && scalar.v === 'мировое соглашение' && scalar.set === undefined,
    `«ни одно из» даёт зеркальный ответ (${notIn.label}); при переходе к «=» правая часть не обнулилась, осталась «${scalar.v}»`);

  // Проверки множества перед публикацией (ИК-5).
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
  // Область — такой же список правил: вторая альтернатива входа через ИЛИ (КФ-Д8).
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

  // Пустая область впускает всех.
  const sub = CL.activeVer('sub');
  const anyone = CL.classify('sub', 'заёмщик', '22508199500821');
  ok(68, (sub.scope || []).length === 0 && anyone.ok,
    `пустая область впускает всех: у подгруппы заёмщика правил входа нет, «${CL.borrower('22508199500821').name}» → ${anyone.label}`);
})();

(() => {
  CL.seed();
  // Нет данных — отказ с названным показателем и владельцем, а не тихий откат к умолчанию (ИК-20).
  const blind = CL.classify('risk', 'кредит', 'КД-2026/012');
  const named = CL.ind('daysOverdue');
  const fold = CL.foldBorrower('01503200110077');
  ok(69, !blind.ok && blind.nodata === true && has(blind.why, named.name) && has(blind.why, named.owner) &&
        has(blind.why, 'ИК-20') && blind.code === undefined,
    `нет данных → «${blind.why[0]}» — значения нет вовсе, к умолчанию объект не съезжает — ИК-20`);
  ok(70, !fold.ok && fold.nodata === true && has(fold.why, 'КД-2026/012'),
    `свёртка заёмщика при неполном наборе запрещена: «${fold.why[0]}» — худшее из неполного не худшее`);

  // Предпросмотр закрытия различает «вне области» и «нет данных».
  const pv = CL.closePreview();
  const risk = pv.rows.find(r => /риск/i.test(r.clf));
  ok(71, pv.ok && pv.out > 0 && pv.nodata > 0 && risk.out === 2 && risk.nodata === 1 &&
        risk.willWrite + risk.out + risk.nodata === risk.total,
    `предпросмотр разделил исходы: записей ${risk.willWrite}, вне области ${risk.out}, нет данных ${risk.nodata} — в сумме все ${risk.total} кредитов`);
})();

(() => {
  CL.seed();
  // Наборы операторов по типу показателя и связки, написанные словом на экране (КФ-Д7).
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

/* ---------- G. Сторож текста: инварианты и решения названы в файле ---------- */
(() => {
  const iks = Array.from({ length: 21 }, (_, i) => 'ИК-' + (i + 1)).filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const adrs = ['ADR-0120','ADR-0121','ADR-0122','ADR-0123','ADR-0124','ADR-0125','ADR-0126','ADR-0127','ADR-0137']
    .filter(a => !src.includes(a));
  ok(43, iks.length === 0 && adrs.length === 0,
    `в файле названы все 21 инвариант и 9 решений${iks.length ? ' · нет: ' + iks.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const hardcoded = /(п\.\s*11\.3|п\.\s*19\.1|исполнительные листы)/.test(
    m[1].slice(m[1].indexOf('ДВИЖОК'), m[1].indexOf('ШОВ')));
  ok(44, !hardcoded, `в движке нет ни пунктов Порядка, ни ступеней лестницы — правила приходят данными (ADR-0120)`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.slice().sort((a, b) => a.n - b.n)
  .map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-21 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const marker = 'SMOKE (node scripts/inspect/classification-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку classification.html');
}

process.exit(pass === results.length ? 0 : 1);
