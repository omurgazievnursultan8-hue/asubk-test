/* ============================================================
   QA · Зона 7 — вкладка «График погашения» (tab-1 в DOM, «tab-3» в ТЗ-нумерации)
   Мокап: mockups/loan-application/loan-application.html  (ТОЛЬКО ЧТЕНИЕ)
   Запуск: node scripts/inspect/qa-app/zone7-schedule.mjs
   Проверяет: genSchedule/_computeRows (арифметика), правку (add/edit/del),
   права (роль×фаза), группу (свод/член), экспорт, аудит.
   Арифметику считаем НЕЗАВИСИМО в JS и сверяем с моделью.
   ============================================================ */
import { chromium } from 'playwright-core';

const FILE = 'file:///home/azamat/projects/asubk-credit-module/mockups/loan-application/loan-application.html';
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone7';

const asserts = [];
const arith = [];                       // расхождения: {in, exp, got}
const A = (name, pass, detail) => asserts.push({ name, pass: !!pass, detail: detail || '' });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, viewport: { width: 1500, height: 1600 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') jsErrors.push('CONSOLE ' + m.text()); });

await page.goto(FILE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

/* =========================================================================
   БЛОК 1. АРИФМЕТИКА genSchedule / _computeRows — через page.evaluate
   ========================================================================= */
const model = await page.evaluate(() => {
  const R = {};
  const mkApp = (o) => Object.assign({
    num: 'TEST', program: 'АгроИнвест КР', paymentFrequency: 'Ежемесячно', paymentDay: '15',
  }, o);
  const sumP = rows => rows.reduce((s, r) => s + r.principal, 0);
  const sumP2 = rows => rows.reduce((s, r) => s + Math.round(r.principal * 100) / 100, 0); // как отображается (2 знака)
  const sumI = rows => rows.reduce((s, r) => s + r.interest, 0);
  const sumT = rows => rows.reduce((s, r) => s + r.total, 0);

  // независимый пересчёт аннуитета (та же логика периодов, но отдельно)
  const chainOk = rows => rows.every((r, i) => i === 0 || Math.abs(rows[i - 1].close - r.open) < 1e-6);

  // --- T1 Аннуитет базовый ---
  {
    const app = mkApp({ approvedAmount: '500 000,00', approvedTerm: '36', annualRate: '10,00' });
    const g = genSchedule(app, {});
    const rows = g.rows, P = 500000;
    R.t1 = {
      n: rows.length, lastClose: rows[rows.length - 1].close,
      sumPrincipalRaw: sumP(rows), sumPrincipal2: sumP2(rows), P,
      sumInterest: sumI(rows), sumTotal: sumT(rows),
      totalEqPplusI: Math.abs(sumT(rows) - (sumP(rows) + sumI(rows))),
      chainOk: chainOk(rows), anyNegClose: rows.some(r => r.close < -0.001),
      firstPMT: rows[0].total, meta: g.meta,
    };
  }
  // --- T2 Ставка 0% ---
  {
    const app = mkApp({ approvedAmount: '300000', approvedTerm: '12', annualRate: '0' });
    R.t2 = { ret: genSchedule(app, {}) };
  }
  // --- T3 Ставка отрицательная ---
  {
    const app = mkApp({ approvedAmount: '300000', approvedTerm: '12', annualRate: '-5' });
    R.t3 = { ret: genSchedule(app, {}) };
  }
  // --- T4 Ставка 100% ---
  {
    const app = mkApp({ approvedAmount: '100000', approvedTerm: '12', annualRate: '100' });
    const g = genSchedule(app, {});
    R.t4 = g ? { n: g.rows.length, lastClose: g.rows[g.rows.length - 1].close, sumP: sumP(g.rows), P: 100000, anyNaN: g.rows.some(r => isNaN(r.total)) } : { g: null };
  }
  // --- T5 Срок 1 ---
  {
    const app = mkApp({ approvedAmount: '100000', approvedTerm: '1', annualRate: '10' });
    const g = genSchedule(app, {});
    R.t5 = { n: g.rows.length, lastClose: g.rows[g.rows.length - 1].close, principal0: g.rows[0].principal };
  }
  // --- T6 Срок 360 ---
  {
    const app = mkApp({ approvedAmount: '1000000', approvedTerm: '360', annualRate: '10' });
    const g = genSchedule(app, {});
    R.t6 = { n: g.rows.length, lastClose: g.rows[g.rows.length - 1].close, sumP2: sumP2(g.rows), P: 1000000, anyNeg: g.rows.some(r => r.close < -0.001) };
  }
  // --- T7 Сумма 0 ---
  {
    const app = mkApp({ approvedAmount: '0', approvedTerm: '12', annualRate: '10' });
    R.t7 = { ret: genSchedule(app, {}) };
  }
  // --- T8 Огромная сумма ---
  {
    const app = mkApp({ approvedAmount: '999999999999', approvedTerm: '24', annualRate: '10' });
    const g = genSchedule(app, {});
    R.t8 = { n: g.rows.length, lastClose: g.rows[g.rows.length - 1].close, sumP2: sumP2(g.rows), P: 999999999999, anyNaN: g.rows.some(r => isNaN(r.total)) };
  }
  // --- T9 Периодичность: ежеквартально / полгода / год ---
  {
    const q = genSchedule(mkApp({ approvedAmount: '360000', approvedTerm: '36', annualRate: '10', paymentFrequency: 'Ежеквартально' }), {});
    const h = genSchedule(mkApp({ approvedAmount: '360000', approvedTerm: '36', annualRate: '10', paymentFrequency: 'Раз в полгода' }), {});
    const y = genSchedule(mkApp({ approvedAmount: '360000', approvedTerm: '36', annualRate: '10', paymentFrequency: 'Ежегодно' }), {});
    R.t9 = { q: q.rows.length, h: h.rows.length, y: y.rows.length, qClose: q.rows[q.rows.length - 1].close };
  }
  // --- T10 payMode:'months' (З-2026-000103, Март+Сентябрь) — учитывается ли? ---
  {
    const real = APPLICATIONS.find(a => a.num === 'З-2026-000103');
    const g = genSchedule(real, {});
    R.t10 = { n: g ? g.rows.length : null, term: real.approvedTerm, freq: real.paymentFrequency, payMode: real.payMode, payMonths: real.payMonths,
      // если бы Март+Сентябрь учитывались за 36 мес → ~6 платежей; аннуитет ежемесячно → 36
      months: g ? g.rows.map(r => r.pay.slice(3, 5)) : [] };
  }
  // --- T11 Дифференцированный метод — есть ли отдельная ветка? ---
  {
    // берём метод «Дифференцированный» из PROGRAMS_MAP через repaymentMethod
    const app = mkApp({ approvedAmount: '120000', approvedTerm: '12', annualRate: '12', repaymentMethod: 'Дифференцированный' });
    const g = genSchedule(app, {});
    const pr = g.rows.map(r => +r.principal.toFixed(2));
    // дифференцированный ⇒ равные доли тела (кроме последней); аннуитет ⇒ растущее тело
    const equalShares = pr.slice(0, -1).every(x => Math.abs(x - pr[0]) < 0.01);
    const growing = pr[pr.length - 2] > pr[0] + 0.01;
    R.t11 = { equalShares, growing, first: pr[0], mid: pr[5], preLast: pr[pr.length - 2] };
  }
  // --- T12 Грейс (реальная З-2026-000089: GRACE_DEMO main:3, квартал) vs conditions graceInterest ---
  {
    const real = APPLICATIONS.find(a => a.num === 'З-2026-000089');
    const g = genSchedule(real, {});
    R.t12 = g ? {
      n: g.rows.length, graceMeta: g.meta.grace,
      firstPrincipals: g.rows.slice(0, 3).map(r => +r.principal.toFixed(2)),
      firstInterests: g.rows.slice(0, 3).map(r => +r.interest.toFixed(2)),
      condGraceMain: real.graceMain, condGraceInterest: real.graceInterest,
      lastClose: g.rows[g.rows.length - 1].close,
      graceDemo: (typeof GRACE_DEMO !== 'undefined') ? GRACE_DEMO['З-2026-000089'] : null,
    } : { g: null };
  }
  // --- T13 День платежа 31 в феврале (overflow даты) ---
  {
    const app = mkApp({ approvedAmount: '100000', approvedTerm: '3', annualRate: '10', paymentDay: '31' });
    const g = genSchedule(app, { issue: '15.01.2026' });
    R.t13 = { pays: g.rows.map(r => r.pay) };  // ждём 28/29.02, а не 03.03
  }
  // --- T14 День платежа на выходной + processingOption «Переносить» — переносится? ---
  {
    // 15.08.2026 — суббота. processingOption должен перенести на 17.08 (пн), если реализовано.
    const app = mkApp({ approvedAmount: '100000', approvedTerm: '2', annualRate: '10', paymentDay: '15', processingOption: 'Переносить на следующий рабочий день' });
    const g = genSchedule(app, { issue: '15.06.2026' });
    R.t14 = { pays: g.rows.map(r => r.pay), weekdays: g.rows.map(r => { const [d, m, y] = r.pay.split('.').map(Number); return new Date(y, m - 1, d).getDay(); }) };
  }
  // --- T15 _computeRows после ручной правки: некорректные входы ---
  {
    const app = mkApp({ approvedAmount: '100000', approvedTerm: '3', annualRate: '10' });
    const ctx = { obj: {}, P: 100000, rate: 10, base: 365, issue: '15.06.2026' };
    // текст, отрицательное, дата раньше предыдущей
    ctx.obj.schedule = [
      { pay: '15.07.2026', principal: 'абвгд' },        // текст → _num=0
      { pay: '10.07.2026', principal: '-50000,00' },     // дата раньше пред. + отрицат.
      { pay: '15.09.2026', principal: '20000,00' },
    ];
    const rows = _computeRows(app, ctx);
    R.t15 = {
      row0principal: rows[0].principal,          // текст → 0
      row1principal: rows[1].principal,          // отрицат. → clamp 0?
      row1days: rows[1].days,                    // дата назад → clamp 0?
      residual: rows[rows.length - 1].close,     // не закрывает долг
      anyNaN: rows.some(r => isNaN(r.total) || isNaN(r.interest)),
    };
  }
  return R;
});

// --- Ассерты по арифметике ---
{
  const t = model.t1;
  A('T1 аннуитет: 36 строк', t.n === 36, `n=${t.n}`);
  A('T1 остаток последней строки = 0', Math.abs(t.lastClose) < 0.005, `close=${t.lastClose}`);
  A('T1 нет отрицательных остатков', !t.anyNegClose, '');
  A('T1 остатки телескопируются (open=prev.close)', t.chainOk, '');
  A('T1 ИТОГО = проценты + тело (построчно)', t.totalEqPplusI < 1e-6, `Δ=${t.totalEqPplusI}`);
  const dRaw = Math.abs(t.sumPrincipalRaw - t.P);
  A('T1 Σ тело (raw) = телу кредита', dRaw < 0.005, `Δ=${dRaw.toFixed(4)}`);
  const d2 = Math.abs(t.sumPrincipal2 - t.P);
  A('T1 Σ тело (округл. до копейки, как в UI) = телу', d2 < 0.005, `Δ=${d2.toFixed(2)}`);
  if (d2 >= 0.005) arith.push({ in: 'Аннуитет 500000/36мес/10%', exp: '500 000,00 (Σ колонки «Погашение осн. долга»)', got: `${t.sumPrincipal2.toFixed(2)} (расхождение ${d2.toFixed(2)})` });
}
{
  const g = model.t2.ret, rows = g && g.rows;
  A('T2 ставка 0%: график строится (беспроцентная ссуда, не null)', !!g, `ret=${JSON.stringify(g && g.meta)}`);
  A('T2 ставка 0%: 12 строк, все проценты = 0', !!rows && rows.length === 12 && rows.every(r => r.interest === 0), `n=${rows && rows.length}`);
  A('T2 ставка 0%: равные доли тела (P/n = 25 000)', !!rows && rows.slice(0, -1).every(r => Math.abs(r.principal - 25000) < 0.005), `p0=${rows && rows[0].principal}`);
  A('T2 ставка 0%: остаток=0, без NaN', !!rows && Math.abs(rows[rows.length - 1].close) < 0.005 && !rows.some(r => isNaN(r.total)), `close=${rows && rows[rows.length - 1].close}`);
}
A('T3 ставка <0 → genSchedule=null', model.t3.ret === null, `ret=${JSON.stringify(model.t3.ret)}`);
{
  const t = model.t4;
  A('T4 ставка 100%: строится, нет NaN', t.n === 12 && !t.anyNaN, JSON.stringify(t));
  A('T4 ставка 100%: остаток=0', Math.abs(t.lastClose) < 0.005, `close=${t.lastClose}`);
}
A('T5 срок 1 мес: 1 строка, гасит всё', model.t5.n === 1 && Math.abs(model.t5.lastClose) < 0.005 && Math.abs(model.t5.principal0 - 100000) < 0.005, JSON.stringify(model.t5));
{
  const t = model.t6;
  A('T6 срок 360: 360 строк, остаток=0, без отрицат.', t.n === 360 && Math.abs(t.lastClose) < 0.005 && !t.anyNeg, `n=${t.n} close=${t.lastClose}`);
  const d = Math.abs(t.sumP2 - t.P);
  A('T6 срок 360: Σ тело(2 знака)=телу', d < 0.005, `Δ=${d.toFixed(2)}`);
  if (d >= 0.005) arith.push({ in: 'Аннуитет 1 000 000/360мес/10%', exp: '1 000 000,00', got: `${t.sumP2.toFixed(2)} (Δ ${d.toFixed(2)})` });
}
A('T7 сумма 0 → null', model.t7.ret === null, '');
{
  const t = model.t8;
  A('T8 огромная сумма: без NaN, остаток=0', !t.anyNaN && Math.abs(t.lastClose) < 0.5, JSON.stringify({ close: t.lastClose, anyNaN: t.anyNaN }));
  const d = Math.abs(t.sumP2 - t.P);
  A('T8 огромная сумма: Σ тело≈телу', d < 1, `Δ=${d.toFixed(2)}`);
  if (d >= 0.005) arith.push({ in: 'Аннуитет 999 999 999 999/24мес/10%', exp: '999 999 999 999,00', got: `${t.sumP2.toFixed(2)} (Δ ${d.toFixed(2)})` });
}
{
  const t = model.t9;
  A('T9 ежеквартально: n=12 (36/3)', t.q === 12, `q=${t.q}`);
  A('T9 полгода: n=6 (36/6)', t.h === 6, `h=${t.h}`);
  A('T9 ежегодно: n=3 (36/12)', t.y === 3, `y=${t.y}`);
  A('T9 квартал: остаток=0', Math.abs(t.qClose) < 0.005, `close=${t.qClose}`);
}
{
  const t = model.t10;
  const monthsSet = [...new Set(t.months)];
  const honored = t.n <= 8 && monthsSet.every(mm => mm === '03' || mm === '09');   // Март/Сентябрь
  A('T10 payMode:months (Март+Сент) — учитывается в графике', honored, `n=${t.n}, месяцы=${monthsSet.join(',')} (ожидалось только 03/09, ~6 строк)`);
  if (!honored) arith.push({ in: 'З-2026-000103 payMode:months [Март,Сентябрь], 36 мес', exp: '~6 платежей только в марте/сентябре', got: `${t.n} платежей ежемесячно, месяцы=${monthsSet.join(',')} — payMonths игнорируется` });
}
{
  const t = model.t11;
  A('T11 «Дифференцированный» даёт равные доли тела (не аннуитет)', t.equalShares && !t.growing,
    `equalShares=${t.equalShares} growing=${t.growing} (first=${t.first}, preLast=${t.preLast})`);
  if (!t.equalShares) arith.push({ in: 'repaymentMethod=Дифференцированный, 120000/12/12%', exp: 'равные доли осн. долга ≈10 000/мес', got: `аннуитет: тело растёт ${t.first}→${t.preLast} (ветка «дифф.» отсутствует)` });
}
{
  const t = model.t12;
  A('T12 грейс: график строится, meta.grace отражает льготу (3 мес.)', t && t.graceMeta === 3, JSON.stringify(t && { grace: t.graceMeta, n: t.n }));
  // З-2026-000089: graceInterest=3, graceMain=0 → отсрочены ПРОЦЕНТЫ, а не тело
  A('T12 грейс (отсрочка ПРОЦЕНТОВ): проценты 1-го периода = 0', t && t.firstInterests[0] === 0, `interests[0..2]=${t && t.firstInterests}`);
  A('T12 грейс (отсрочка ПРОЦЕНТОВ): тело 1-го периода НЕ ноль (тело не отсрочено)', t && t.firstPrincipals[0] > 0, `principals[0..2]=${t && t.firstPrincipals}`);
  A('T12 грейс: отложенные проценты добавлены в 1-й период после льготы (%_2 > %_3)', t && t.firstInterests[1] > t.firstInterests[2], `int_2=${t && t.firstInterests[1]}, int_3=${t && t.firstInterests[2]}`);
  A('T12 грейс: остаток=0', t && Math.abs(t.lastClose) < 0.01, `close=${t && t.lastClose}`);
  // рассинхрон: условия говорят graceInterest=3, а GRACE_DEMO применяет main:3
  const mismatch = t && t.condGraceMain === '0' && t.condGraceInterest === '3' && t.graceDemo && t.graceDemo.main === 3;
  A('T12 грейс: источник льготы = поля условий (graceMain/Interest), НЕ хардкод GRACE_DEMO', !mismatch,
    `условия: main=${t && t.condGraceMain}, int=${t && t.condGraceInterest}; применён GRACE_DEMO=${t && JSON.stringify(t.graceDemo)}`);
}
{
  const t = model.t13;
  const overflow = t.pays[0] && t.pays[0].slice(3, 5) === '03';  // 31 фев → перелив в март
  A('T13 payDay=31 в феврале: дата НЕ перетекает в март', !overflow, `pays=${t.pays.join(' | ')}`);
  if (overflow) arith.push({ in: 'payDay=31, платёж за февраль (issue 15.01)', exp: '28.02.2026 (или перенос)', got: `${t.pays[0]} — Date-overflow в март` });
}
{
  const t = model.t14;
  // 15.08.2026 суббота(6). Если перенос реализован — не должно быть 0(вс)/6(сб).
  const hasWeekend = t.weekdays.some(w => w === 0 || w === 6);
  A('T14 processingOption «Переносить»: платежи не попадают на выходные', !hasWeekend, `даты=${t.pays.join(' | ')} weekdays=${t.weekdays.join(',')}`);
  if (hasWeekend) arith.push({ in: 'processingOption=Переносить на след. раб. день; платёж 15.08.2026 (сб)', exp: 'перенос на 17.08.2026 (пн)', got: `${t.pays.join(' | ')} — перенос не выполняется` });
}
{
  const t = model.t15;
  A('T15 правка: текст в «тело» → 0 (без NaN)', t.row0principal === 0 && !t.anyNaN, `row0=${t.row0principal}`);
  A('T15 правка: отрицательное «тело» → clamp к 0', t.row1principal === 0, `row1=${t.row1principal}`);
  A('T15 правка: дата раньше предыдущей → Дней clamp к 0', t.row1days === 0, `days=${t.row1days}`);
  A('T15 правка: некорректный график НЕ закрывает долг (residual≠0 → должен быть баннер)', Math.abs(t.residual) > 0.01, `residual=${t.residual}`);
}

/* =========================================================================
   БЛОК 2. UI-ПРАВКА: add / edit / del, роли, аудит, группа — драйвим реальные функции
   ========================================================================= */
const ui = await page.evaluate(async () => {
  const R = {};
  const app80 = APPLICATIONS.find(a => a.num === 'З-2026-000080');   // индивид., draft (Требуется доп. инфо)
  const app89 = APPLICATIONS.find(a => a.num === 'З-2026-000089');   // индивид., locked (Одобрено)
  const app105 = APPLICATIONS.find(a => a.num === 'З-2026-000105');  // групповая, draft (Новый)

  const setState = (app, role, edit, view) => {
    _detailApp = app; _role = role; _editMode = edit;
    _schedView = (view === undefined ? null : view); _schedSel = null;
  };
  const clean = (app) => { delete app.schedule; delete app.scheduleManual; delete app.schedEdits;
    if (app._members) app._members.forEach(m => { delete m.schedule; delete m.scheduleManual; }); };

  // --- U1 Права: тулбар виден спецу в draft (canEditSched) ---
  { _detailApp = app80; _role = 'spec'; _editMode = true; _schedView = null; _schedSel = null;
    R.u1_specDraft = can(app80).editSched; }
  { _role = 'com'; R.u1_comDraft = can(app80).editSched; }               // com в draft → нет
  { _role = 'ro'; R.u1_roDraft = can(app80).editSched; }
  { _role = 'gf'; R.u1_gfDraft = can(app80).editSched; }
  { _role = 'dept'; R.u1_deptDraft = can(app80).editSched; }
  // спец в review (app84 «На рассмотрении») — не может
  { const app84 = APPLICATIONS.find(a => a.num === 'З-2026-000084'); _detailApp = app84; _role = 'spec'; _editMode = true;
    R.u1_specReview = can(app84).editSched; R.u1_phaseReview = can(app84).phase; }
  // com в locked (app89 Одобрено) — может
  { _detailApp = app89; _role = 'com'; _editMode = true; _schedView = null;
    R.u1_comLocked = can(app89).editSched; R.u1_phaseLocked = can(app89).phase; }
  // canEditSched без editMode → false
  { _detailApp = app80; _role = 'spec'; _editMode = false; R.u1_noEditMode = can(app80).editSched; }

  // --- U2 Тулбар в HTML: есть кнопки при editSched, нет при чтении ---
  { clean(app80); setState(app80, 'spec', true); _rerenderSched();
    const html = document.getElementById('tab-1').innerHTML;
    R.u2_editHasBuild = html.includes('schedBuild()');
    R.u2_editHasAdd = html.includes('schedAddRow()');
  }
  { clean(app80); setState(app80, 'ro', false); _rerenderSched();
    const html = document.getElementById('tab-1').innerHTML;
    R.u2_roNoTools = !html.includes('schedAddRow()');
    R.u2_roHasTable = html.includes('<table>');
  }

  // --- U3 schedAddRow (в конец и в середину) + man-флаг + материализация ---
  { clean(app80); setState(app80, 'spec', true); _rerenderSched();
    const before = (app80.schedule || genSchedule(app80, { P: _num(app80.amount), issue: ISSUE_DATE }).rows).length;
    // модалка мешает: schedAddRow вызывает schedEditRow (openModal). Закроем.
    _schedSel = null;
    const seedLen = (function () { _seedSchedule(app80, _schedCtx(app80)); return app80.schedule.length; })();
    // добавить в конец
    _schedSel = null; schedAddRow();
    const afterEnd = app80.schedule.length;
    const lastMan = app80.schedule[app80.schedule.length - 1].man;
    // добавить в середину (после строки 0)
    _schedSel = 0; schedAddRow();
    const afterMid = app80.schedule.length;
    const midMan = app80.schedule[1].man;
    R.u3 = { seedLen, afterEnd, afterMid, lastMan, midMan, manualFlag: app80.scheduleManual };
    try { closeModal('modal-sched-row'); } catch (e) {}
  }

  // --- U4 schedRowSave: валидация некорректных значений (текст/отрицат/дата вне срока/дата назад) ---
  { clean(app80); setState(app80, 'spec', true); _seedSchedule(app80, _schedCtx(app80));
    let toast = null; const ot = window.showToast; window.showToast = (m) => { toast = m; };
    _schedSel = 1;
    const orig = { pay: app80.schedule[1].pay, principal: app80.schedule[1].principal };
    // (а) нечисловой principal → отказ, строка без изменений, тост
    document.getElementById('sched-f-pay').value = _ruToISO(orig.pay);
    document.getElementById('sched-f-principal').value = 'не-число';
    schedRowSave();
    const afterText = { pay: app80.schedule[1].pay, principal: app80.schedule[1].principal, man: !!app80.schedule[1].man, toast };
    // (б) отрицательный principal → отказ
    toast = null;
    document.getElementById('sched-f-pay').value = _ruToISO(orig.pay);
    document.getElementById('sched-f-principal').value = '-100,00';
    schedRowSave();
    const afterNeg = { principal: app80.schedule[1].principal, toast };
    // (в) дата 2099 (за пределами срока кредита) → отказ
    toast = null;
    document.getElementById('sched-f-pay').value = '2099-01-01';
    document.getElementById('sched-f-principal').value = '100 000,00';
    schedRowSave();
    const afterFar = { pay: app80.schedule[1].pay, toast };
    // (г) дата ≤ предыдущего платежа → отказ
    toast = null;
    document.getElementById('sched-f-pay').value = _ruToISO(app80.schedule[0].pay);
    document.getElementById('sched-f-principal').value = '100 000,00';
    schedRowSave();
    const afterBack = { pay: app80.schedule[1].pay, toast };
    // после всех отказов график не тронут → баланс сходится, баннера нет
    _rerenderSched();
    const noWarnAfterReject = !document.getElementById('tab-1').innerHTML.includes('не закрывает долг');
    // (д) корректная правка → принята (man=true)
    toast = null;
    document.getElementById('sched-f-pay').value = _ruToISO(orig.pay);
    document.getElementById('sched-f-principal').value = '123 456,00';
    schedRowSave();
    const afterOk = { principal: app80.schedule[1].principal, man: !!app80.schedule[1].man, toast };
    window.showToast = ot;
    _rerenderSched();
    const html = document.getElementById('tab-1').innerHTML;
    R.u4 = { orig, afterText, afterNeg, afterFar, afterBack, noWarnAfterReject, afterOk,
      rendered: !html.includes('undefined') };
    try { closeModal('modal-sched-row'); } catch (e) {}
  }

  // --- U5 schedDelRow: удалить единственную строку (запрет), удалить норм. ---
  { clean(app80); setState(app80, 'spec', true); _seedSchedule(app80, _schedCtx(app80));
    const total = app80.schedule.length;
    // удалить все кроме одной
    let alertMsg = null; const origAlert = window.alert; window.alert = m => { alertMsg = m; };
    app80.schedule.length = 1;                            // оставили 1
    _schedSel = 0; schedDelRow();                          // попытка удалить единственную
    const afterSingle = app80.schedule.length;
    window.alert = origAlert;
    R.u5 = { blockedSingle: afterSingle === 1, alertMsg, totalWas: total };
  }
  { clean(app80); setState(app80, 'spec', true); _seedSchedule(app80, _schedCtx(app80));
    const before = app80.schedule.length; _schedSel = 2; schedDelRow();
    R.u5b = { before, after: app80.schedule.length, selReset: _schedSel === null };
  }

  // --- U6 schedBuild поверх ручных правок: предупреждение (confirm) ---
  { clean(app80); setState(app80, 'spec', true); _seedSchedule(app80, _schedCtx(app80));
    app80.schedule[0].principal = '1,00'; app80.scheduleManual = true;
    let confirmAsked = false; const oc = window.confirm;
    // сценарий А: отказ (confirm=false) → правки сохраняются
    window.confirm = () => { confirmAsked = true; return false; };
    schedBuild();
    const keptManual = app80.scheduleManual === true && app80.schedule[0].principal === '1,00';
    // сценарий Б: согласие (confirm=true) → пересборка, man сброшен
    window.confirm = () => true;
    schedBuild();
    const rebuilt = app80.scheduleManual === false;
    window.confirm = oc;
    R.u6 = { confirmAsked, keptManual, rebuilt };
  }

  // --- U7 Аудит: спец в draft (нет следа) vs комиссия в locked (есть след) ---
  { clean(app80); setState(app80, 'spec', true); _seedSchedule(app80, _schedCtx(app80));
    _schedSel = 0; document.getElementById('sched-f-pay').value = '';
    document.getElementById('sched-f-principal').value = '777,00'; schedRowSave();
    R.u7_specTrail = (app80.schedEdits || []).length;               // след пишется для любой роли → ≥1
    R.u7_specEvent = (app80.schedEdits || [])[0];
    try { closeModal('modal-sched-row'); } catch (e) {}
  }
  { clean(app89); _detailApp = app89; _role = 'com'; _editMode = true; _schedView = null; _schedSel = null;
    _seedSchedule(app89, _schedCtx(app89));
    _schedSel = 0; document.getElementById('sched-f-pay').value = '';
    document.getElementById('sched-f-principal').value = '888,00'; schedRowSave();
    schedBuild.__x; // no-op
    R.u7_comTrail = (app89.schedEdits || []).length;                // ожидаем ≥1
    R.u7_comEvent = (app89.schedEdits || [])[0];
    try { closeModal('modal-sched-row'); } catch (e) {}
  }

  // --- U8 Группа: schedView свод/член, агрегат = Σ членов ---
  { clean(app105); _detailApp = app105; _role = 'spec'; _editMode = false; _schedView = null; _schedSel = null;
    const members = _membersOf(app105);
    R.u8_isGroup = !!app105.isGroup;
    R.u8_nMembers = members.length;
    // рендер свода
    _schedView = 'all'; _rerenderSched();
    const aggHtml = document.getElementById('tab-1').innerHTML;
    R.u8_aggRenders = aggHtml.includes('Сводный график') || aggHtml.includes('<table>');
    // независимая проверка: Σ тел членов = сумма долей? (агрегат должен закрывать общий долг)
    const rate = _num(app105.annualRate || (PROG_ENV[app105.program] || {}).rate || (PROGRAMS_MAP[app105.program] || {}).rate);
    let sumMembersPrincipal = 0, totalP = 0;
    members.forEach(m => {
      totalP += _num(m.sum);
      const g = genSchedule(app105, { P: _num(m.sum), issue: m.date });
      if (g) sumMembersPrincipal += g.rows.reduce((s, r) => s + r.principal, 0);
    });
    R.u8_totalP = totalP; R.u8_sumMembersPrincipal = sumMembersPrincipal;
    R.u8_aggClosesDebt = Math.abs(sumMembersPrincipal - totalP) < 1;
    // член графика
    _schedView = 0; _rerenderSched();
    R.u8_memberRenders = document.getElementById('tab-1').innerHTML.includes('<table>');
  }

  // --- U9 Группа: член с нулевой суммой ---
  { clean(app105); _detailApp = app105; _role = 'spec'; _editMode = false;
    const members = _membersOf(app105);
    const saved = members[0].sum; members[0].sum = 0;
    _schedView = 0; let ok = true; try { _rerenderSched(); } catch (e) { ok = false; R.u9_err = e.message; }
    const html = document.getElementById('tab-1').innerHTML;
    R.u9 = { noThrow: ok, showsInsufficient: html.includes('Недостаточно данных') };
    members[0].sum = saved;
    // свод с нулевым членом
    _schedView = 'all'; let ok2 = true; try { _rerenderSched(); } catch (e) { ok2 = false; }
    R.u9_aggNoThrow = ok2;
  }

  // --- U10 Группа: удаление члена после генерации графика (клемп _schedView) ---
  { clean(app105); _detailApp = app105; _role = 'spec'; _editMode = false;
    const members = _membersOf(app105);
    const n = members.length;
    _schedView = n - 1;                 // выбрали последнего
    members.pop();                      // удалили последнего
    let ok = true; try { _rerenderSched(); } catch (e) { ok = false; R.u10_err = e.message; }
    R.u10 = { noThrow: ok, clampedView: _schedView, nAfter: members.length };
    _membersOf(app105).push({ pin: 'x', fio: 'ВОССТАНОВ Л.', sum: 1, date: '01.07.2026' }); // не критично
    delete app105._members;             // сброс кэша членов
  }

  // --- U11 Экспорт: не падает, тост ---
  { let toastMsg = null; const ot = window.showToast; window.showToast = (m) => { toastMsg = m; };
    let ok = true; try { schedExport('xlsx'); schedExport('pdf'); } catch (e) { ok = false; R.u11_err = e.message; }
    window.showToast = ot;
    R.u11 = { noThrow: ok, toast: toastMsg };
  }

  // очистка глобалов
  _detailApp = null; _role = 'spec'; _editMode = false; _schedView = null; _schedSel = null;
  return R;
});

// --- Ассерты UI ---
A('U1 право editSched: спец в draft = true', ui.u1_specDraft === true, '');
A('U1 право editSched: комиссия в draft = false', ui.u1_comDraft === false, '');
A('U1 право editSched: ro/gf/dept в draft = false', !ui.u1_roDraft && !ui.u1_gfDraft && !ui.u1_deptDraft, JSON.stringify({ ro: ui.u1_roDraft, gf: ui.u1_gfDraft, dept: ui.u1_deptDraft }));
A('U1 право editSched: спец в review = false (только чтение)', ui.u1_specReview === false, `phase=${ui.u1_phaseReview}`);
A('U1 право editSched: комиссия в locked = true (пост-одобрение)', ui.u1_comLocked === true, `phase=${ui.u1_phaseLocked}`);
A('U1 editSched=false без режима «Изменить»', ui.u1_noEditMode === false, '');
A('U2 тулбар (Построить/Добавить) виден в режиме правки', ui.u2_editHasBuild && ui.u2_editHasAdd, JSON.stringify(ui));
A('U2 роль «Остальные»: тулбара нет, таблица есть', ui.u2_roNoTools && ui.u2_roHasTable, JSON.stringify({ noTools: ui.u2_roNoTools, table: ui.u2_roHasTable }));
A('U3 schedAddRow в конец: +1 строка, man=true', ui.u3.afterEnd === ui.u3.seedLen + 1 && ui.u3.lastMan === true, JSON.stringify(ui.u3));
A('U3 schedAddRow в середину: +1, man=true, scheduleManual', ui.u3.afterMid === ui.u3.seedLen + 2 && ui.u3.midMan === true && ui.u3.manualFlag === true, JSON.stringify(ui.u3));
A('U4 schedRowSave: нечисловой ввод отклонён (строка без изменений) + тост', ui.u4.afterText.principal === ui.u4.orig.principal && ui.u4.afterText.pay === ui.u4.orig.pay && !ui.u4.afterText.man && /число/i.test(ui.u4.afterText.toast || ''), JSON.stringify(ui.u4.afterText));
A('U4 schedRowSave: отрицательное «тело» отклонено (строка без изменений) + тост', ui.u4.afterNeg.principal === ui.u4.orig.principal && !!ui.u4.afterNeg.toast, JSON.stringify(ui.u4.afterNeg));
A('U4 schedRowSave: дата 2099 (за пределами срока) отклонена + тост «срок»', ui.u4.afterFar.pay === ui.u4.orig.pay && /срок/i.test(ui.u4.afterFar.toast || ''), JSON.stringify(ui.u4.afterFar));
A('U4 schedRowSave: дата ≤ предыдущего платежа отклонена + тост', ui.u4.afterBack.pay === ui.u4.orig.pay && /позже предыдущей/i.test(ui.u4.afterBack.toast || ''), JSON.stringify(ui.u4.afterBack));
A('U4 после отклонённых правок график не тронут → баннера «не закрывает долг» нет', ui.u4.noWarnAfterReject, '');
A('U4 корректная правка принята (тело обновлено, man=true)', ui.u4.afterOk.principal === '123 456,00' && ui.u4.afterOk.man === true, JSON.stringify(ui.u4.afterOk));
A('U4 рендер не сломан (нет undefined)', ui.u4.rendered, '');
A('U5 удаление единственной строки заблокировано + alert', ui.u5.blockedSingle && /единствен/i.test(ui.u5.alertMsg || ''), JSON.stringify(ui.u5));
A('U5b удаление обычной строки: -1, выбор сброшен', ui.u5b.after === ui.u5b.before - 1 && ui.u5b.selReset, JSON.stringify(ui.u5b));
A('U6 schedBuild спрашивает confirm при ручных правках', ui.u6.confirmAsked, '');
A('U6 confirm=Отмена → ручные правки сохранены', ui.u6.keptManual, '');
A('U6 confirm=OK → график пересобран (man сброшен)', ui.u6.rebuilt, '');
A('U7 аудит: спец в draft — след ЕСТЬ (правка логируется для любой роли, ≥1)', ui.u7_specTrail >= 1, `trail=${ui.u7_specTrail}`);
A('U7 аудит: автор следа спеца = [credit-spec]', ui.u7_specEvent && ui.u7_specEvent.user === '[credit-spec]', JSON.stringify(ui.u7_specEvent));
A('U7 аудит: комиссия в locked — след ЕСТЬ (≥1), автор [commission]', ui.u7_comTrail >= 1 && ui.u7_comEvent && ui.u7_comEvent.user === '[commission]', `trail=${ui.u7_comTrail}, ev=${JSON.stringify(ui.u7_comEvent)}`);
A('U8 группа распознана, 3 члена', ui.u8_isGroup && ui.u8_nMembers === 3, JSON.stringify({ g: ui.u8_isGroup, n: ui.u8_nMembers }));
A('U8 свод группы рендерится', ui.u8_aggRenders, '');
A('U8 Σ тел членов = общий долг группы (свод закрывает долг)', ui.u8_aggClosesDebt, `Σчленов=${ui.u8_sumMembersPrincipal?.toFixed(2)} vs totalP=${ui.u8_totalP?.toFixed(2)}`);
A('U8 график члена рендерится', ui.u8_memberRenders, '');
A('U9 член с нулевой суммой: без throw, «Недостаточно данных»', ui.u9.noThrow && ui.u9.showsInsufficient, JSON.stringify(ui.u9));
A('U9 свод с нулевым членом: без throw', ui.u9_aggNoThrow, '');
A('U10 удаление члена после генерации: без throw, view клемпнут', ui.u10.noThrow && ui.u10.clampedView <= ui.u10.nAfter, JSON.stringify(ui.u10));
A('U11 экспорт (xlsx/pdf): без throw, тост показан', ui.u11.noThrow && !!ui.u11.toast, JSON.stringify(ui.u11));

/* =========================================================================
   ОТЧЁТ
   ========================================================================= */
await ctx.close();

const fails = asserts.filter(a => !a.pass);
console.log('\n================= ZONE 7 · ГРАФИК ПОГАШЕНИЯ =================');
console.log(`Ассертов: ${asserts.length} · Провалов: ${fails.length} · JS-ошибок: ${jsErrors.length}`);
console.log('\n--- ПРОВАЛЫ ---');
fails.forEach(f => console.log(`  ✗ ${f.name}  [${f.detail}]`));
if (!fails.length) console.log('  (нет)');
console.log('\n--- АРИФМЕТИЧЕСКИЕ РАСХОЖДЕНИЯ ---');
if (!arith.length) console.log('  (нет)');
arith.forEach(r => console.log(`  • вход: ${r.in}\n    ожидалось: ${r.exp}\n    получено:  ${r.got}`));
if (jsErrors.length) { console.log('\n--- JS-ОШИБКИ ---'); jsErrors.forEach(e => console.log('  ' + e)); }
console.log('\n--- ВСЕ АССЕРТЫ ---');
asserts.forEach(a => console.log(`  ${a.pass ? '✓' : '✗'} ${a.name}${a.detail ? '  ·  ' + a.detail : ''}`));
console.log('\nJSON_RESULT ' + JSON.stringify({ total: asserts.length, fails: fails.length, jsErrors: jsErrors.length, arith }));
