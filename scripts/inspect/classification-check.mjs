// Headless smoke для mockups/classification/classification.html (ИК-1…ИК-18, ADR-0120…0127).
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
    `КД-2024/117 → ${r117.label}, сработавших условий ${r117.fired.length} (${r117.fired.map(f => f.norm).join(' + ')}) — ИК-11`);

  const r210 = cred('КД-2023/210');
  const v = CL.indicatorsOfCredit(CL.credit('КД-2023/210'));
  ok(5, r210.ok && r210.code === 'mid' && v.daysOverdue === 200 && v.defer181 === true &&
       has(r210.fired.map(f => f.norm), 'п. 16.1'),
    `КД-2023/210: 200 дн, отложение п. 19.1 включено → ${r210.label} по ${r210.fired.map(f => f.norm).join(', ')}`);

  const r004 = cred('КД-2019/004');
  ok(6, !r004.ok && r004.out === true && has(r004.why, 'вне области'),
    `КД-2019/004 вне области: «${r004.why[0]}» — ИК-7`);

  const r043 = cred('КД-2025/043');
  const lvl043 = CL.indicatorsOfCredit(CL.credit('КД-2025/043')).factorLevel;
  ok(7, r043.ok && r043.code === 'low' && lvl043 === 'нет',
    `КД-2025/043: фактор без решения комитета в показатель не вошёл (уровень «${lvl043}») → ${r043.label} — ИК-10`);

  const r088 = cred('КД-2025/088');
  ok(8, r088.ok && r088.code === 'mid' && r088.fired.length === 2,
    `КД-2025/088 → ${r088.label}, условий сработало ${r088.fired.length} (просрочка + фактор п. 11.2)`);

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
    `аннулирование без причины отклонено; после аннулирования F-003 факт остался в реестре, условий ${before} → ${after.fired.length}, значение ${after.label}`);

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
    `новое значение встало перед замыкающим (${posBefore + 1}-м); после «сделать по умолчанию» оно последнее и без условий — ИК-3`);
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
  ok(29, has(chk, 'значения по умолчанию') && has(chk, 'есть условия'),
    `условие у значения по умолчанию отклонено — ИК-3`);
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

  const activeCredits = CL.state.credits.filter(c => c.active).length;
  const res = CL.closePeriod();
  const written = CL.state.records.filter(r => r.period === '2026-07');
  const outOfScope = written.filter(r => r.objType === 'кредит' && !CL.credit(r.objId).active);
  ok(34, res.ok && res.period === '2026-07' &&
        written.filter(r => r.clfId === 'risk').length === activeCredits &&
        written.filter(r => r.clfId === 'sub').length === CL.state.borrowers.length &&
        outOfScope.length === 0,
    `июль закрыт: записей ${written.length} (риск ${activeCredits} действующих кредитов + подгруппа ${CL.state.borrowers.length} заёмщиков), объектов вне области 0 — ИК-7`);

  const again = CL.closePeriod();
  ok(35, CL.openPeriod() === '2026-08' && !again.ok && /не завершён/.test(again.why),
    `открылся август; повторное закрытие отклонено: «${again.why}» — ИК-13`);

  const rep = CL.report12('2026-07');
  const sum = rep.rows.reduce((a, r) => a + r.count, 0);
  ok(36, rep.asOf === '2026-08-01' && rep.deadline === '2026-08-15' && rep.late === false &&
        rep.total === activeCredits && sum === activeCredits,
    `отчёт п. 12 за июль: по состоянию на ${rep.asOf}, срок ${rep.deadline}, сформирован ${rep.closedAt} — в срок; кредитов ${rep.total}`);

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

/* ---------- G. Сторож текста: инварианты и решения названы в файле ---------- */
(() => {
  const iks = Array.from({ length: 18 }, (_, i) => 'ИК-' + (i + 1)).filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const adrs = ['ADR-0120','ADR-0121','ADR-0122','ADR-0123','ADR-0124','ADR-0125','ADR-0126','ADR-0127']
    .filter(a => !src.includes(a));
  ok(43, iks.length === 0 && adrs.length === 0,
    `в файле названы все 18 инвариантов и 8 решений волны${iks.length ? ' · нет: ' + iks.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const hardcoded = /(п\.\s*11\.3|п\.\s*19\.1|исполнительные листы)/.test(
    m[1].slice(m[1].indexOf('ДВИЖОК'), m[1].indexOf('ШОВ')));
  ok(44, !hardcoded, `в движке нет ни пунктов Порядка, ни ступеней лестницы — правила приходят данными (ADR-0120)`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-14 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const marker = 'SMOKE (node scripts/inspect/classification-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку classification.html');
}

process.exit(pass === results.length ? 0 : 1);
