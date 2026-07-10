/* ============================================================================
 * ZONE 3 QA — вкладки «Условия кредита» (tab-cond) + «Общая информация» (tab-0)
 * Тестирует self-contained мокап mockups/loan-application/loan-application.html.
 * Драйвит реальный UI (клики/ввод) + юнит-тестит чистые функции через evaluate.
 * Любая JS-ошибка (pageerror/console.error) = дефект.
 *
 * Запуск: node scripts/inspect/qa-app/zone3-conditions.mjs
 * ============================================================================ */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const REPO = path.resolve(process.cwd());
const FILE = path.join(REPO, 'mockups/loan-application/loan-application.html');
const URL  = pathToFileURL(FILE).href;
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone3';

/* ---- сбор результатов ---- */
let nAssert = 0, nFail = 0;
const fails = [];
const jsErrors = [];
function ok(cond, name, detail){
  nAssert++;
  if (!cond){ nFail++; fails.push({ name, detail: detail || '' }); console.log('  ✗ FAIL:', name, detail ? '· ' + detail : ''); }
  else console.log('  ✓', name);
}
function eq(a, b, name){ ok(a === b, name, `получено=${JSON.stringify(a)} ожидалось=${JSON.stringify(b)}`); }

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1500, height: 1600 },
});
const page = ctx.pages()[0] || await ctx.newPage();

page.on('pageerror', e => { jsErrors.push('pageerror: ' + e.message); console.log('  ‼ JS pageerror:', e.message); });
page.on('console', m => { if (m.type() === 'error'){ jsErrors.push('console.error: ' + m.text()); console.log('  ‼ console.error:', m.text()); } });

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => typeof APPLICATIONS !== 'undefined' && typeof renderConditions === 'function', { timeout: 10000 });

/* helper: перейти в детальный вид заявки, роль, режим правки, вкладку */
async function openApp(num, { role = 'spec', edit = false, tab = 'tab-cond' } = {}){
  await page.evaluate(({ num, role }) => { setRole(role); gotoDetail(num); }, { num, role });
  if (edit) await page.evaluate(() => enterEdit());
  await page.evaluate((t) => showTab(t), tab);
  await page.waitForTimeout(60);
}

/* helper: найти input по тексту cflabel внутри активной панели условий */
async function condInputByLabel(label){
  return page.evaluateHandle((label) => {
    const panel = document.getElementById('tab-cond');
    const fields = [...panel.querySelectorAll('.cond-field')];
    const f = fields.find(el => {
      const l = el.querySelector('.cflabel');
      return l && l.textContent.replace(/\s*\*$/, '').trim().startsWith(label);
    });
    return f ? f.querySelector('input,select,textarea') : null;
  }, label);
}

/* helper: ввести значение в текстовый condNum-инпут (симуляция реального ввода: value+input) */
async function typeCond(label, value){
  return page.evaluate(({ label, value }) => {
    const panel = document.getElementById('tab-cond');
    const fields = [...panel.querySelectorAll('.cond-field')];
    const f = fields.find(el => {
      const l = el.querySelector('.cflabel');
      return l && l.textContent.replace(/\s*\*$/, '').trim().startsWith(label);
    });
    if (!f) return { err: 'field-not-found' };
    const inp = f.querySelector('input');
    if (!inp) return { err: 'input-not-found' };
    inp.focus();
    inp.value = value;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const err = f.querySelector('.cf-err');
    return {
      value: inp.value,
      invalid: inp.classList.contains('cf-invalid'),
      errMsg: err ? err.textContent : '',
      errShown: err ? err.style.display !== 'none' : false,
      readonly: inp.readOnly,
      tag: inp.tagName,
    };
  }, { label, value });
}

console.log('\n══════════ A. ЧИСТЫЕ ФУНКЦИИ (юнит) ══════════');

/* ---- A1. ruToNum / numToRu ---- */
console.log('\n[A1] ruToNum / numToRu');
{
  const r = await page.evaluate(() => ({
    plain:   ruToNum('1000000'),
    ruFull:  ruToNum('1 000 000,00'),
    nbsp:    ruToNum('1 000 000,00'),
    dot:     ruToNum('1000000.00'),
    comma:   ruToNum('1000000,50'),
    empty:   ruToNum(''),
    spaces:  ruToNum('   '),
    text:    ruToNum('abc'),
    neg:     ruToNum('-5'),
    numToRu: numToRu(1000000),
    numToRuNaN: numToRu(NaN),
  }));
  eq(r.plain, 1000000, 'ruToNum("1000000")=1000000');
  eq(r.ruFull, 1000000, 'ruToNum("1 000 000,00")=1000000 (пробелы+запятая)');
  eq(r.nbsp, 1000000, 'ruToNum с NBSP=1000000');
  eq(r.dot, 1000000, 'ruToNum("1000000.00")=1000000 (точка)');
  eq(r.comma, 1000000.5, 'ruToNum("1000000,50")=1000000.5');
  ok(Number.isNaN(r.empty), 'ruToNum("")=NaN');
  ok(Number.isNaN(r.text), 'ruToNum("abc")=NaN');
  eq(r.neg, -5, 'ruToNum("-5")=-5');
  // numToRu использует toLocaleString('ru-RU') → узкий неразрывный пробел U+202F;
  // ruToNum/condNumFmt используют обычный пробел. Сравниваем по нормализации пробелов.
  eq(r.numToRu.replace(/\s/g, ' '), '1 000 000', 'numToRu(1000000)="1 000 000" (пробелы нормализованы)');
  eq(r.numToRuNaN, '', 'numToRu(NaN)=""');
}

/* ---- A2. condPhase — все статусы ---- */
console.log('\n[A2] condPhase — сопоставление статус→фаза');
{
  const r = await page.evaluate(() => {
    const st = ['Новый','Требуется доп. информация','На рассмотрении','Ожидает решения/программы',
      'Одобрена','Отклонена','На оформлении','Оформлена','Отозвана'];
    return Object.fromEntries(st.map(s => [s, condPhase(s)]));
  });
  eq(r['Новый'], 'draft', 'Новый→draft');
  eq(r['Требуется доп. информация'], 'draft', 'Требуется доп.→draft');
  eq(r['На рассмотрении'], 'review', 'На рассмотрении→review');
  eq(r['Ожидает решения/программы'], 'review', 'Ожидает решения→review');
  eq(r['Одобрена'], 'locked', 'Одобрена→locked');
  eq(r['Отклонена'], 'locked', 'Отклонена→locked');
  eq(r['Оформлена'], 'locked', 'Оформлена→locked');
}

/* ---- A3. graceConstraint — все ветки ---- */
console.log('\n[A3] graceConstraint');
{
  const r = await page.evaluate(() => {
    const P = {
      onFix:true, fixType:'Фиксированный', fixDur:['3','6'],
      onRange:true, rangeType:'Диапазон', rFrom:'0', rTo:'3',
      onEmpty:true, emptyType:'Фиксированный', emptyDur:[],   // фикс без длительностей
      onBad:true, badType:'Неизвестный',
    };
    return {
      off:   graceConstraint(P, 'missing', 'x', 'y', 'a', 'b'),
      fixed: graceConstraint(P, 'onFix', 'fixType', 'fixDur', '_', '_'),
      range: graceConstraint(P, 'onRange', 'rangeType', '_', 'rFrom', 'rTo'),
      emptyFix: graceConstraint(P, 'onEmpty', 'emptyType', 'emptyDur', '_', '_'),
      badType:  graceConstraint(P, 'onBad', 'badType', 'x', 'a', 'b'),
    };
  });
  ok(r.off.locked === true, 'grace не предусмотрен программой → {locked}');
  eq(JSON.stringify(r.fixed), JSON.stringify({ list:['3','6'] }), 'Фиксированный c dur → {list}');
  eq(JSON.stringify(r.range), JSON.stringify({ min:'0', max:'3' }), 'Диапазон → {min,max}');
  ok(r.emptyFix.locked === true, 'Фиксированный без длительностей → {locked}');
  ok(r.badType.locked === true, 'неизвестный тип → {locked}');
}

/* ---- A4. progBound / validateReqAmount / validateReqTerm — границы программы ---- */
console.log('\n[A4] Границы программы: сумма/срок (create-форма, envelope)');
{
  // АгроИнвест КР: amount 100000..10000000, term 6..60
  const cases = await page.evaluate(() => {
    _createProgram = PROGRAMS_MAP['АгроИнвест КР'];
    const setAmt = v => { cdraft.requestedAmount = v; return validateReqAmount(); };
    const setTrm = v => { cdraft.requestedTerm  = v; return validateReqTerm(); };
    const res = {
      amtMin:      setAmt('100000'),    // ровно нижняя
      amtMinM1:    setAmt('99999'),     // на 1 меньше
      amtMax:      setAmt('10000000'),  // ровно верхняя
      amtMaxP1:    setAmt('10000001'),  // на 1 больше
      amtZero:     setAmt('0'),
      amtNeg:      setAmt('-100'),
      amtEmpty:    setAmt(''),
      amtText:     setAmt('abc'),
      amtSpaces:   setAmt('1 000 000,00'),
      amtDot:      setAmt('5000000.50'),
      trmMin:      setTrm('6'),
      trmMinM1:    setTrm('5'),
      trmMax:      setTrm('60'),
      trmMaxP1:    setTrm('61'),
      trmZero:     setTrm('0'),
    };
    // без программы — только >0
    _createProgram = null;
    res.noProgPos = (cdraft.requestedAmount = '50', validateReqAmount());
    res.noProgZero = (cdraft.requestedAmount = '0', validateReqAmount());
    return res;
  });
  ok(cases.amtMin === true,   'сумма = нижняя граница (100000) валидна (<= включительно)');
  ok(cases.amtMinM1 === false,'сумма ниже минимума (99999) невалидна');
  ok(cases.amtMax === true,   'сумма = верхняя граница (10000000) валидна');
  ok(cases.amtMaxP1 === false,'сумма выше максимума (10000001) невалидна');
  ok(cases.amtZero === false, 'сумма 0 невалидна');
  ok(cases.amtNeg === false,  'сумма отрицательная невалидна');
  ok(cases.amtEmpty === false,'сумма пустая невалидна');
  ok(cases.amtText === false, 'сумма нечисло невалидна');
  ok(cases.amtSpaces === true,'сумма "1 000 000,00" (пробелы+запятая) валидна');
  ok(cases.amtDot === true,   'сумма "5000000.50" (точка) валидна');
  ok(cases.trmMin === true,   'срок = нижняя граница (6) валиден');
  ok(cases.trmMinM1 === false,'срок ниже минимума (5) невалиден');
  ok(cases.trmMax === true,   'срок = верхняя граница (60) валиден');
  ok(cases.trmMaxP1 === false,'срок выше максимума (61) невалиден');
  ok(cases.trmZero === false, 'срок 0 невалиден');
  ok(cases.noProgPos === true, 'без программы сумма>0 валидна');
  ok(cases.noProgZero === false,'без программы сумма 0 невалидна');
}

/* ---- A5. condDev — отклонение от программы ---- */
console.log('\n[A5] condDev — отклонение от программы');
{
  const r = await page.evaluate(() => {
    _progSnapshot = { source:'Бюджет', floatRate:false, rateValues:['10,00 %'] };
    const mk = (k, v) => { cdraft[k] = v; return condDev(k); };
    const res = {
      equal:   mk('source', 'Бюджет'),          // совпадает → пусто
      diff:    mk('source', 'Иностранные доноры'),// отличается → метка
      emptyCur:mk('source', ''),                 // пусто vs программа → отклонение
      boolEq:  mk('floatRate', false),           // false vs false → пусто
      boolDiff:mk('floatRate', true),            // true vs false → отклонение
      arrEq:   (cdraft.rateValues = ['10,00 %'], condDev('rateValues')),
      notInSnap: condDev('nonexistentKey'),
    };
    _progSnapshot = null;
    res.noSnap = condDev('source');
    return res;
  });
  eq(r.equal, '', 'condDev: равные значения → пусто');
  ok(r.diff.includes('отклонение'), 'condDev: различие → метка «отклонение»');
  ok(r.emptyCur.includes('отклонение'), 'condDev: пустое значение vs программа → отклонение');
  eq(r.boolEq, '', 'condDev: false==false → пусто');
  ok(r.boolDiff.includes('отклонение'), 'condDev: true vs false → отклонение');
  eq(r.arrEq, '', 'condDev: одинаковые массивы → пусто');
  eq(r.notInSnap, '', 'condDev: ключа нет в снимке → пусто');
  eq(r.noSnap, '', 'condDev: нет снимка программы → пусто');
}

/* ---- A6. t2num / joinRange / t2rangeMsg — диапазоны/штрафы ---- */
console.log('\n[A6] t2num / joinRange / t2rangeMsg (диапазоны)');
{
  const r = await page.evaluate(() => ({
    t2plain: t2num('500 000,00'),
    t2dot:   t2num('12.5'),
    t2empty: t2num(''),
    jr:      joinRange('100', '200'),
    jrOne:   joinRange('100', ''),
    jrNone:  joinRange('', ''),
    msOK:    t2rangeMsg('100', '200'),
    msReverse: t2rangeMsg('200', '100'),   // от > до
    msEqual: t2rangeMsg('100', '100'),      // равны
    msMinNeg: t2rangeMsg('-5', '200'),      // min <=0
    msMaxNeg: t2rangeMsg('100', '-5'),      // max <=0
    msMinZero: t2rangeMsg('0', '200'),
  }));
  eq(r.t2plain, 500000, 't2num("500 000,00")=500000');
  eq(r.t2dot, 12.5, 't2num("12.5")=12.5');
  ok(Number.isNaN(r.t2empty), 't2num("")=NaN');
  eq(r.jr, '100 – 200', 'joinRange(100,200)');
  eq(r.jrOne, '100 – —', 'joinRange(100,"")="100 – —"');
  eq(r.jrNone, '', 'joinRange("","")=""');
  eq(r.msOK, '', 't2rangeMsg корректного диапазона → пусто');
  ok(r.msReverse.includes('не может быть больше'), 't2rangeMsg: min>max → ошибка (обратный диапазон)');
  ok(r.msEqual.includes('равен'), 't2rangeMsg: min==max → предупреждение');
  ok(r.msMinNeg.includes('больше 0'), 't2rangeMsg: min<=0 → ошибка');
  ok(r.msMaxNeg.includes('больше 0'), 't2rangeMsg: max<=0 → ошибка');
  ok(r.msMinZero.includes('больше 0'), 't2rangeMsg: min=0 → ошибка');
}

console.log('\n══════════ B. UI: вкладка «Условия кредита» ══════════');

/* ---- B1. Read-only рендер по фазам (нет JS-ошибок, корректный баннер) ---- */
console.log('\n[B1] Рендер tab-cond во всех фазах (read-only)');
{
  const scenarios = [
    ['З-2026-000056', 'spec', 'draft'],   // Новый, АгроИнвест
    ['З-2026-000103', 'spec', 'review'],  // На рассмотрении — спец только читает
    ['З-2026-000103', 'com',  'review'],  // На рассмотрении — комиссия правит
    ['З-2026-000089', 'com',  'locked'],  // Одобрено — зафиксировано
    ['З-2026-000080', 'spec', 'draft'],   // Требуется доп. — ТУР
  ];
  for (const [num, role, phase] of scenarios){
    await openApp(num, { role, edit: false });
    const info = await page.evaluate(() => {
      const p = document.getElementById('tab-cond');
      return { html: p.innerHTML.length, banner: (p.querySelector('.note-banner')||{}).textContent || '' };
    });
    ok(info.html > 200, `${num}/${role}: панель условий отрисована (${phase})`);
  }
}

/* ---- B2. Границы суммы/срока в режиме правки (spec, Новый, АгроИнвест) ---- */
console.log('\n[B2] Границы суммы/срока — режим правки (condNumRange)');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true, tab: 'tab-cond' });
  // проверим что поле редактируемое (не readonly)
  const sumProbe = await typeCond('Сумма', '100000');
  ok(sumProbe.tag === 'INPUT' && !sumProbe.readonly, 'Сумма — редактируемый инпут в draft/spec');

  const T = async (label, val, expectInvalid, note) => {
    const r = await typeCond(label, val);
    ok(r.invalid === expectInvalid, `${label}="${val}" → invalid=${expectInvalid} (${note})`,
       `value="${r.value}" msg="${r.errMsg}"`);
    return r;
  };
  // Сумма: 100000..10000000
  await T('Сумма', '100000', false, 'ровно нижняя');
  await T('Сумма', '99999',  true,  'на 1 меньше нижней');
  await T('Сумма', '10000000', false, 'ровно верхняя');
  await T('Сумма', '10000001', true, 'на 1 больше верхней');
  await T('Сумма', '0', true, 'ноль (< min)');
  const empt = await typeCond('Сумма', '');
  ok(empt.invalid === true && /Обязательное/.test(empt.errMsg),
     'Сумма пустая → подсвечена «Обязательное поле»', `msg="${empt.errMsg}"`);
  const spc = await typeCond('Сумма', '1 000 000,00');
  ok(spc.invalid === false, 'Сумма "1 000 000,00" (пробелы+запятая) валидна', `value="${spc.value}"`);
  const dot = await typeCond('Сумма', '5000000.50');
  ok(!dot.invalid, 'Сумма с точкой "5000000.50" валидна (точка→запятая)', `value="${dot.value}"`);
  // Проверка: минус стирается форматтером (нельзя ввести отрицательное)
  const neg = await typeCond('Сумма', '-5000000');
  ok(neg.value.indexOf('-') === -1, 'Сумма: знак минус стирается condNumFmt', `value="${neg.value}"`);
  // нечисло стирается
  const txt = await typeCond('Сумма', 'abcdef');
  ok(txt.value === '' , 'Сумма: буквы стираются condNumFmt', `value="${txt.value}"`);

  // Срок: 6..60 (целое)
  await T('Срок', '6', false, 'ровно нижняя');
  await T('Срок', '5', true, 'на 1 меньше');
  await T('Срок', '60', false, 'ровно верхняя');
  await T('Срок', '61', true, 'на 1 больше');
  await T('Срок', '0', true, 'ноль');
}

/* ---- B3. День платежа: 1,28,29,30,31,0,32,пусто ---- */
console.log('\n[B3] День платежа (min 1, max 31)');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  const day = async (v, expectInvalid) => {
    const r = await typeCond('День платежа', v);
    ok(r.invalid === expectInvalid, `День платежа="${v}" invalid=${expectInvalid}`, `value="${r.value}" msg="${r.errMsg}"`);
  };
  await day('1', false);
  await day('28', false);
  await day('29', false);
  await day('30', false);
  await day('31', false);
  await day('0', true);
  await day('32', true);
  const empt = await typeCond('День платежа', '');
  ok(empt.invalid === true, 'День платежа пустой → подсвечен как обязательный', `msg="${empt.errMsg}"`);
}

/* ---- B4. Льготный период — Диапазон (АгроИнвест: начисление 0..3) ---- */
console.log('\n[B4] Льготный период (диапазонное поле)');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  // «Льготный период по начислению %» — АгроИнвест graceAccr Диапазон 0..3
  const probe = await typeCond('Льготный период по начислению', '2');
  if (probe.err || probe.tag !== 'INPUT'){
    ok(false, 'Льготный (начисление) — ожидался числовой инпут (Диапазон)', JSON.stringify(probe));
  } else {
    const over = await typeCond('Льготный период по начислению', '5');
    ok(over.invalid, 'Льготный (начисление) > max программы (3) → подсвечен', `msg="${over.errMsg}"`);
    const okv = await typeCond('Льготный период по начислению', '3');
    ok(!okv.invalid, 'Льготный (начисление) = max (3) валиден');
    const neg = await typeCond('Льготный период по начислению', '-1');
    ok(neg.value.indexOf('-') === -1, 'Льготный: минус стирается форматтером', `value="${neg.value}"`);
  }
  // Проверка: нет кросс-валидации grace vs срок кредита (латентный дефект)
  const noCross = await page.evaluate(() => {
    // grace может быть задан независимо от срока — проверим наличие любой проверки «grace<=term»
    const src = renderConditions.toString() + condNum.toString() + condNumRange.toString();
    return /term|срок/i.test(src.replace(/hint|termRange|Срок, мес/gi,'')) ? 'has-ref' : 'none';
  });
  ok(true, `INFO: кросс-проверка «grace ≤ срок» в коде условий — ${noCross} (валидации нет, см. отчёт)`);
}

/* ---- B5. Режим платежей: months ↔ standard, месяцы ---- */
console.log('\n[B5] condSetPayMode / месяцы (msCombo)');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  // переключить на months
  await page.evaluate(() => condSetPayMode('months'));
  await page.waitForTimeout(40);
  let st = await page.evaluate(() => ({ mode: _detailApp.payMode, months: _detailApp.payMonths || [] }));
  eq(st.mode, 'months', 'condSetPayMode("months") установил режим');
  // добавить месяцы
  await page.evaluate(() => { condMonthToggle({stopPropagation(){}}, 'Март'); condMonthToggle({stopPropagation(){}}, 'Сентябрь'); });
  st = await page.evaluate(() => _detailApp.payMonths.slice());
  eq(JSON.stringify(st), JSON.stringify(['Март','Сентябрь']), 'condMonthToggle добавил Март+Сентябрь');
  // дубликат через toggle → снятие
  await page.evaluate(() => condMonthToggle({stopPropagation(){}}, 'Март'));
  st = await page.evaluate(() => _detailApp.payMonths.slice());
  eq(JSON.stringify(st), JSON.stringify(['Сентябрь']), 'повторный toggle убирает месяц (нет дубликатов)');
  // выбрать все 12
  await page.evaluate(() => { _detailApp.payMonths = []; COND_MONTHS.forEach(m => condMonthToggle({stopPropagation(){}}, m)); });
  st = await page.evaluate(() => _detailApp.payMonths.length);
  eq(st, 12, 'выбор всех 12 месяцев');
  // снять все через unchip
  await page.evaluate(() => { for (let i = 11; i >= 0; i--) condMonthUnchip({stopPropagation(){}}, i); });
  st = await page.evaluate(() => _detailApp.payMonths.length);
  eq(st, 0, 'condMonthUnchip снял все месяцы (пустой список)');
  // round-trip: months → standard → months, не теряются ли месяцы
  await page.evaluate(() => { _detailApp.payMonths = ['Май','Июнь']; condSetPayMode('standard'); });
  await page.evaluate(() => condSetPayMode('months'));
  st = await page.evaluate(() => _detailApp.payMonths.slice());
  eq(JSON.stringify(st), JSON.stringify(['Май','Июнь']), 'round-trip months→standard→months сохраняет месяцы');
}

/* ---- B6. Аккордеон: открыть/закрыть эксклюзивно ---- */
console.log('\n[B6] Аккордеон условий (condAccToggle)');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  const heads = await page.$$('#tab-cond .cond-acc-head');
  ok(heads.length >= 2, `секций аккордеона: ${heads.length}`);
  if (heads.length >= 2){
    await heads[2 % heads.length].click(); await page.waitForTimeout(30);
    const openCount = await page.evaluate(() => document.querySelectorAll('#tab-cond .cond-acc.open').length);
    eq(openCount, 1, 'после клика открыта ровно одна секция (эксклюзивный аккордеон)');
    // повторный клик по открытой закрывает
    const idx = await page.evaluate(() => [...document.querySelectorAll('#tab-cond .cond-acc')].findIndex(a => a.classList.contains('open')));
    const h2 = await page.$$('#tab-cond .cond-acc-head');
    await h2[idx].click(); await page.waitForTimeout(30);
    const openCount2 = await page.evaluate(() => document.querySelectorAll('#tab-cond .cond-acc.open').length);
    eq(openCount2, 0, 'повторный клик по открытой секции — закрывает все');
  }
}

/* ---- B7. Ставки: годовая (АгроИнвест — Диапазон 8..12) ---- */
console.log('\n[B7] Годовая ставка (Диапазон 8..12 %)');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  const probe = await typeCond('Годовая ставка', '10');
  if (probe.tag === 'INPUT'){
    const over = await typeCond('Годовая ставка', '100');
    ok(over.invalid, 'ставка 100% > max программы (12) → подсвечена', `msg="${over.errMsg}"`);
    const neg = await typeCond('Годовая ставка', '-5');
    ok(neg.value.indexOf('-') === -1, 'ставка: минус стирается', `value="${neg.value}"`);
    const frac = await typeCond('Годовая ставка', '9.5');
    ok(!frac.invalid, 'ставка дробная 9.5 (в пределах 8..12) валидна', `value="${frac.value}"`);
    const low = await typeCond('Годовая ставка', '0');
    ok(low.invalid, 'ставка 0 < min (8) → подсвечена');
  } else {
    ok(true, `INFO: годовая ставка — ${probe.tag} (список), не диапазон`);
  }
}

/* ---- B8. Роли/фазы: read-only vs editable ---- */
console.log('\n[B8] Гейтинг ролей: read-only vs editable');
{
  // спец на review (На рассмотрении) — условия только для чтения (нет cf-input inputs)
  await openApp('З-2026-000103', { role: 'spec', edit: false });
  let editable = await page.evaluate(() => document.querySelectorAll('#tab-cond input.cf-input:not([readonly]), #tab-cond select.cf-input').length);
  ok(editable === 0, 'спец на «На рассмотрении»: нет редактируемых полей (read-only)', `найдено ${editable}`);

  // комиссия на review + edit → есть редактируемые
  await openApp('З-2026-000103', { role: 'com', edit: true });
  editable = await page.evaluate(() => document.querySelectorAll('#tab-cond input.cf-input:not([readonly]), #tab-cond select.cf-input, #tab-cond textarea').length);
  ok(editable > 0, 'комиссия на «На рассмотрении» в режиме правки: поля редактируемы', `найдено ${editable}`);

  // locked (Одобрена) — даже комиссия только читает
  await openApp('З-2026-000089', { role: 'com', edit: false });
  const cap = await page.evaluate(() => { const c = can(_detailApp); return { phase: c.phase, editOp: c.editOp, canEditOp: c.canEditOp }; });
  eq(cap.phase, 'locked', 'Одобрена → phase locked');
  ok(cap.canEditOp === false, 'на locked комиссия не может править условия');
}

/* ---- B9. saveEdit реально пишет в объект; cancelEdit откатывает ---- */
console.log('\n[B9] saveEdit / cancelEdit — запись в объект заявки');
{
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  const before = await page.evaluate(() => _detailApp.amount);
  // ввести новую сумму через реальный инпут
  await typeCond('Сумма', '2 000 000');
  const afterInput = await page.evaluate(() => _detailApp.amount);
  ok(afterInput === '2 000 000', 'ввод пишется в _detailApp.amount вживую (bindCondInput)', `было="${before}" стало="${afterInput}"`);
  await page.evaluate(() => saveEdit());
  const saved = await page.evaluate(() => APPLICATIONS.find(a => a.num === 'З-2026-000056').amount);
  ok(saved === '2 000 000', 'saveEdit: значение зафиксировано в APPLICATIONS', `значение="${saved}"`);

  // cancelEdit откат
  await openApp('З-2026-000056', { role: 'spec', edit: true });
  await typeCond('Сумма', '9 999 999');
  await page.evaluate(() => cancelEdit());
  const reverted = await page.evaluate(() => APPLICATIONS.find(a => a.num === 'З-2026-000056').amount);
  ok(reverted === '2 000 000', 'cancelEdit: правка откатана к снимку', `значение="${reverted}"`);
}

console.log('\n══════════ C. UI: вкладка «Общая информация» (tab-0) ══════════');

/* ---- C1. Рендер tab-0 по разным статусам/типам заявителя ---- */
console.log('\n[C1] renderGeneral — разные заявки');
{
  const apps = ['З-2026-000105','З-2026-000103','З-2026-000101','З-2026-000074','З-2026-000080','З-2026-000089'];
  for (const num of apps){
    await openApp(num, { role: 'spec', edit: false, tab: 'tab-0' });
    const r = await page.evaluate(() => {
      const p = document.getElementById('tab-0');
      return { len: p.innerHTML.length, vtl: p.querySelectorAll('.vtl-item').length, hasSubj: !!p.querySelector('.subj-link, .cflabel') };
    });
    ok(r.len > 200 && r.vtl >= 5, `${num}: tab-0 отрисован, таймлайн ${r.vtl} вех`);
  }
}

/* ---- C2. Телефон/доп.инфо редактируемы в draft/spec, read-only иначе ---- */
console.log('\n[C2] tab-0 — редактируемость по фазе');
{
  await openApp('З-2026-000056', { role: 'spec', edit: false, tab: 'tab-0' });
  // renderGeneral использует can(app).editReq — но editReq требует _editMode.
  let editableView = await page.evaluate(() => document.querySelectorAll('#tab-0 input, #tab-0 textarea').length);
  await openApp('З-2026-000056', { role: 'spec', edit: true, tab: 'tab-0' });
  let editableEdit = await page.evaluate(() => document.querySelectorAll('#tab-0 input, #tab-0 textarea').length);
  ok(editableEdit >= editableView, `tab-0: полей ввода в режиме правки ${editableEdit} ≥ просмотр ${editableView}`);

  // На рассмотрении (review) — спец не правит заявителя
  await openApp('З-2026-000103', { role: 'spec', edit: false, tab: 'tab-0' });
  const roReview = await page.evaluate(() => document.querySelectorAll('#tab-0 input, #tab-0 textarea').length);
  ok(roReview === 0, 'tab-0 на «На рассмотрении»/спец: read-only (нет инпутов)', `найдено ${roReview}`);
}

/* ---- C3. Заявка с отсутствующим субъектом (нет в SUBJECTS_MAP) ---- */
console.log('\n[C3] tab-0 — заявитель отсутствует в справочнике (нет JS-ошибки)');
{
  await openApp('З-2026-000105', { role: 'spec', edit: false, tab: 'tab-0' });
  const r = await page.evaluate(() => {
    // inn 20907199400957 (Матраимов) — есть ли в SUBJECTS_MAP?
    const app = _detailApp;
    return { inn: app.inn, inMap: !!SUBJECTS_MAP[app.inn], rendered: document.getElementById('tab-0').innerHTML.length };
  });
  ok(r.rendered > 200, `tab-0 отрисован даже без записи субъекта (inMap=${r.inMap})`);
}

/* ---- D. condNumFmt (форматтер) прямые проверки через DOM ---- */
console.log('\n══════════ D. condNumFmt (форматтер чисел) ══════════');
{
  const r = await page.evaluate(() => {
    const el = document.createElement('input');
    const f = (v, isInt) => { el.value = v; condNumFmt(el, isInt); return el.value; };
    return {
      intGroups: f('1000000', true),      // целое → пробелы
      intStrip:  f('12ab34', true),        // буквы стерты
      decGroups: f('1000000.5', false),    // точка → запятая, группировка
      decComma:  f('1000000,50', false),
      decTwo:    f('12,999', false),        // дробь обрезается до 2
      neg:       f('-500', false),          // минус стерт
      dotOnly:   f('1000.', false),
    };
  });
  eq(r.intGroups, '1 000 000', 'condNumFmt целое: группировка пробелами');
  eq(r.intStrip, '1 234', 'condNumFmt целое: буквы стёрты');
  eq(r.decGroups, '1 000 000,5', 'condNumFmt дробь: точка→запятая + группировка');
  eq(r.decComma, '1 000 000,50', 'condNumFmt дробь с запятой');
  eq(r.decTwo, '12,99', 'condNumFmt: дробь обрезается до 2 знаков');
  ok(r.neg.indexOf('-') === -1, 'condNumFmt: минус стирается', `value="${r.neg}"`);
}

/* ============================ ИТОГ ============================ */
console.log('\n════════════════════════════════════════════');
console.log(`ИТОГ: ${nAssert} ассертов · ${nFail} провалов · ${jsErrors.length} JS-ошибок`);
if (fails.length){
  console.log('\nПРОВАЛЫ:');
  fails.forEach(f => console.log(`  ✗ ${f.name} ${f.detail ? '· ' + f.detail : ''}`));
}
if (jsErrors.length){
  console.log('\nJS-ОШИБКИ:');
  [...new Set(jsErrors)].forEach(e => console.log('  ‼ ' + e));
}

await ctx.close();
process.exit(nFail || jsErrors.length ? 1 : 0);
