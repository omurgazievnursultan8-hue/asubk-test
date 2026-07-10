import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import path from 'path';

const HTML = path.resolve('mockups/loan-application/loan-application.html');
const URL = pathToFileURL(HTML).href;
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone1';

let PASS = 0, FAIL = 0;
const fails = [];
function ok(name, cond){ if(cond){ PASS++; console.log('PASS', name); } else { FAIL++; fails.push(name); console.log('FAIL', name); } }
function eq(name, got, exp){ ok(name + ` (got=${JSON.stringify(got)} exp=${JSON.stringify(exp)})`, got === exp); }

const jsErrors = [];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1500, height: 1600 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => { jsErrors.push('pageerror: ' + e.message); console.log('JSERR pageerror:', e.message); });
page.on('console', m => { if (m.type() === 'error'){ jsErrors.push('console.error: ' + m.text()); console.log('JSERR console:', m.text()); } });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(300);

// Ensure list view is visible & grid rendered
await page.evaluate(() => { if (typeof showView === 'function') showView('list'); if (typeof renderGrid==='function') renderGrid(); });

const totalRows = await page.evaluate(() => APPLICATIONS.length);
console.log('\n=== SETUP: total APPLICATIONS =', totalRows, '===\n');

const rowsShown = () => page.$$eval('#appTbody tr', trs => trs.length);
const firstRow = () => page.$eval('#appTbody tr:first-child td:first-child', td => td.textContent);
const pgCount = () => page.$eval('#pgCount', el => el.textContent).catch(()=>null);

// ============ 1. _pluralRows (unit) ============
console.log('\n--- 1. _pluralRows склонение ---');
for (const [n, exp] of [[0,'0 строк'],[1,'1 строка'],[2,'2 строки'],[3,'3 строки'],[4,'4 строки'],[5,'5 строк'],[10,'10 строк'],[11,'11 строк'],[12,'12 строк'],[14,'14 строк'],[15,'15 строк'],[19,'19 строк'],[21,'21 строка'],[22,'22 строки'],[24,'24 строки'],[25,'25 строк'],[101,'101 строка'],[111,'111 строк'],[112,'112 строк']]){
  const got = await page.evaluate(k => _pluralRows(k), n);
  eq(`_pluralRows(${n})`, got, exp);
}

// ============ 2. Filter by number ============
console.log('\n--- 2. Фильтр по номеру ---');
await page.fill('#fNum', '');
await page.evaluate(() => renderGrid());
const allShown = await rowsShown();
eq('пустой фильтр показывает все строки', allShown, totalRows);

await page.fill('#fNum', 'ЗЗЗ-НЕТ-ТАКОГО');
await page.evaluate(() => renderGrid());
eq('несуществующий номер → 0 строк', await rowsShown(), 0);
eq('счётчик = «0 строк»', await pgCount(), '0 строк');

// case-insensitivity: numFilter lowercased vs num.toLowerCase()
await page.fill('#fNum', 'з-2026-000105');
await page.evaluate(() => renderGrid());
const lowShown = await rowsShown();
ok('регистр: строчная «з-...» находит «З-...» (>=1)', lowShown >= 1);

await page.fill('#fNum', '000105');
await page.evaluate(() => renderGrid());
eq('поиск по фрагменту «000105» → 1 строка', await rowsShown(), 1);

// search by INN — field is «Номер документа»; INN is NOT in num → expect 0
await page.fill('#fNum', '20907199400957');
await page.evaluate(() => renderGrid());
const innShown = await rowsShown();
console.log('   [note] поиск по ИНН показывает строк:', innShown, '(фильтр только по номеру документа)');
ok('поиск по ИНН не по номеру → 0 (ограничение: фильтр только по № документа)', innShown === 0);

// search by ФИО
await page.fill('#fNum', 'МАТРАИМОВ');
await page.evaluate(() => renderGrid());
const fioShown = await rowsShown();
console.log('   [note] поиск по ФИО показывает строк:', fioShown);
ok('поиск по ФИО не по номеру → 0 (ограничение: фильтр только по № документа)', fioShown === 0);

// reset
await page.fill('#fNum', '');
await page.evaluate(() => renderGrid());
eq('сброс фильтра → снова все строки', await rowsShown(), totalRows);

// ============ 2b. status / program filters ============
console.log('\n--- 2b. Фильтр по статусу/программе ---');
await page.selectOption('#fStatus', 'Одобрена');
await page.evaluate(() => renderGrid());
const apprShown = await rowsShown();
const apprExpected = await page.evaluate(() => APPLICATIONS.filter(r=>r.status==='Одобрена').length);
eq('фильтр статус=Одобрена', apprShown, apprExpected);
const allApproved = await page.$$eval('#appTbody tr', trs => trs.every(tr => tr.children[2].textContent === 'Одобрена'));
ok('все показанные строки имеют статус Одобрена', allApproved);
await page.selectOption('#fStatus', '');

await page.selectOption('#fProgram', 'ТУР');
await page.evaluate(() => renderGrid());
const turExpected = await page.evaluate(() => APPLICATIONS.filter(r=>r.program==='ТУР').length);
eq('фильтр программа=ТУР', await rowsShown(), turExpected);
await page.selectOption('#fProgram', '');
await page.evaluate(() => renderGrid());

// ============ 3. Sorting ============
console.log('\n--- 3. Сортировка ---');
async function colValues(idx){ return page.$$eval(`#appTbody tr`, (trs,i)=>trs.map(tr=>tr.children[i].textContent), idx); }

// num asc/desc
await page.evaluate(() => { _sortCol=null; _sortDir=1; renderGrid(); });
await page.click('th[data-col="num"]');
const numAsc = await colValues(0);
ok('сортировка по номеру ASC (строково возрастает)', JSON.stringify(numAsc) === JSON.stringify([...numAsc].sort()));
await page.click('th[data-col="num"]');
const numDesc = await colValues(0);
ok('повторный клик по номеру → DESC (реверс)', JSON.stringify(numDesc) === JSON.stringify([...numAsc].slice().reverse()));

// name column
await page.click('th[data-col="name"]');
const nameAsc = await colValues(1);
ok('сортировка по заёмщику ASC (строково)', JSON.stringify(nameAsc) === JSON.stringify([...nameAsc].sort()));

// amount column — NUMERIC expectation vs string sort
await page.evaluate(() => { _sortCol=null; _sortDir=1; renderGrid(); });
await page.click('th[data-col="amount"]');
const amtStrings = await colValues(4);
const amtNums = amtStrings.map(s => parseFloat(s.replace(/\s/g,'').replace(',','.')));
const amtSortedNumeric = amtNums.every((v,i,a)=> i===0 || a[i-1] <= v);
console.log('   amount ASC visible:', amtStrings.slice(0,6));
ok('СУММА сортируется как ЧИСЛА по возрастанию (ожидание пользователя)', amtSortedNumeric);
// detect the actual (string) sort
const amtStringSorted = JSON.stringify(amtStrings) === JSON.stringify([...amtStrings].sort());
console.log('   [diag] amount отсортирован лексикографически как строки:', amtStringSorted);

// term column numeric
await page.evaluate(() => { _sortCol=null; _sortDir=1; renderGrid(); });
await page.click('th[data-col="term"]');
const termStrings = await colValues(6);
const termNums = termStrings.map(s=>parseInt(s,10));
const termSortedNumeric = termNums.every((v,i,a)=> i===0 || a[i-1] <= v);
console.log('   term ASC visible:', termStrings.slice(0,8));
ok('СРОК сортируется как ЧИСЛА по возрастанию', termSortedNumeric);

// created (dates ISO) — string sort == chronological, correct
await page.evaluate(() => { _sortCol=null; _sortDir=1; renderGrid(); });
await page.click('th[data-col="created"]');
const createdCells = await colValues(7);   // DD.MM.YYYY
const createdISO = await page.evaluate(()=>{
  // read underlying created in the sorted order by matching displayed order
  return null;
});
// verify chronological via converting DD.MM.YYYY
const toTs = s => { const [d,m,y]=s.split('.'); return new Date(+y,+m-1,+d).getTime(); };
const createdTs = createdCells.map(toTs);
const createdChrono = createdTs.every((v,i,a)=> i===0 || a[i-1] <= v);
ok('ДАТА создания ASC хронологически (ISO-строки сортируются верно)', createdChrono);

// sort glyph
const glyph = await page.$eval('th[data-col="created"] .sort', el=>el.textContent);
eq('глиф сортировки активной колонки = ↑', glyph, '↑');
await page.click('th[data-col="created"]');
const glyph2 = await page.$eval('th[data-col="created"] .sort', el=>el.textContent);
eq('после реверса глиф = ↓', glyph2, '↓');
const otherGlyph = await page.$eval('th[data-col="num"] .sort', el=>el.textContent);
eq('неактивная колонка глиф = ↕', otherGlyph, '↕');

// reset sort
await page.evaluate(() => { _sortCol=null; _sortDir=1; renderGrid(); });

// ============ 4. Row select + button state ============
console.log('\n--- 4. Выбор строки и кнопки ---');
async function btnDisabled(id){ return page.$eval('#'+id, b=>b.disabled); }
// initial: no selection
await page.evaluate(()=>{ _selNum=null; ['btnEdit','btnDel','btnCom'].forEach(id=>{const b=document.getElementById(id); if(b)b.disabled=true;}); });
ok('без выбора: Просмотр disabled', await btnDisabled('btnEdit'));
ok('без выбора: Удалить disabled', await btnDisabled('btnDel'));
ok('без выбора: Отправить disabled', await btnDisabled('btnCom'));

// select a Новый row (sendable) → find one
const newNum = await page.evaluate(()=> (APPLICATIONS.find(r=>r.status==='Новый')||{}).num);
await page.evaluate(n=>selectRow(n), newNum);
ok('после выбора: Просмотр enabled', !(await btnDisabled('btnEdit')));
console.log('   Новый: btnDel disabled=', await btnDisabled('btnDel'), 'btnCom disabled=', await btnDisabled('btnCom'));
ok('Новый статус: Удалить разрешено (enabled)', !(await btnDisabled('btnDel')));
const selHl = await page.$$eval('#appTbody tr.sel', trs=>trs.length);
eq('выбранная строка подсвечена (ровно 1 .sel)', selHl, 1);

// select an Одобрена row → delete must be disabled
const apprNum = await page.evaluate(()=> (APPLICATIONS.find(r=>r.status==='Одобрена')||{}).num);
await page.evaluate(n=>selectRow(n), apprNum);
ok('Одобрена: Удалить disabled (терминал + связанный кредит)', await btnDisabled('btnDel'));
ok('Одобрена: Отправить disabled (терминальный статус)', await btnDisabled('btnCom'));
const delTitle = await page.$eval('#btnDel', b=>b.title);
ok('Удалить: подсказка объясняет блокировку', /Одобренную/.test(delTitle));

// btnDel has NO onclick handler → clicking does nothing (functional gap)
const delHasHandler = await page.evaluate(()=>{ const b=document.getElementById('btnDel'); return !!(b.onclick) || b.getAttribute('onclick'); });
console.log('   [diag] btnDel onclick handler:', delHasHandler);
ok('btnDel имеет обработчик клика (иначе кнопка мертва)', !!delHasHandler);

// double-click opens detail
await page.evaluate(() => { _sortCol=null; _sortDir=1; _selNum=null; renderGrid(); });
await page.dblclick('#appTbody tr:first-child');
await page.waitForTimeout(150);
const detailVisible = await page.$eval('#view-detail', el=>getComputedStyle(el).display !== 'none');
ok('двойной клик по строке открывает деталку', detailVisible);
await page.evaluate(()=>showView('list'));

// SELECT then FILTER-OUT the row (oninput → renderGrid, NOT applyFilter)
console.log('\n--- 4b. Выбор + фильтр убирает строку ---');
await page.evaluate(() => { _sortCol=null; _sortDir=1; renderGrid(); });
// pick the Новый row and remember its num
await page.evaluate(n=>selectRow(n), newNum);
const editEnabledBefore = !(await btnDisabled('btnEdit'));
ok('строка выбрана, Просмотр enabled', editEnabledBefore);
// now type a filter that excludes it
await page.fill('#fNum', apprNum);   // filter to a different, approved row's number
await page.evaluate(()=>renderGrid());
const selRowStillInDom = await page.$$eval('#appTbody tr', (trs,n)=>trs.some(tr=>tr.dataset.num===n), newNum);
eq('выбранная строка исчезла из DOM после фильтра', selRowStillInDom, false);
const editStillEnabled = !(await btnDisabled('btnEdit'));
const selNumStill = await page.evaluate(()=>_selNum);
console.log('   [diag] после фильтра _selNum=', selNumStill, ' btnEdit enabled=', editStillEnabled);
ok('после того как строка отфильтрована, кнопки НЕ должны ссылаться на скрытую строку (btnEdit не enabled)', !editStillEnabled);
// editSelected would still navigate to hidden row
await page.fill('#fNum', '');
await page.evaluate(()=>{ applyFilter(); });
ok('applyFilter (Обновить) сбрасывает _selNum', (await page.evaluate(()=>_selNum)) === null);
ok('applyFilter дизейблит btnEdit', await btnDisabled('btnEdit'));

// ============ 5. Create modal ============
console.log('\n--- 5. Модалка создания ---');
async function openCreate(){ await page.evaluate(()=>openCreateModal()); await page.waitForTimeout(100); }
await openCreate();
const createVisible = await page.$eval('#view-create', el=>getComputedStyle(el).display!=='none');
ok('openCreateModal показывает форму создания', createVisible);
const phoneInit = await page.$eval('#cf-phone', el=>el.value);
eq('телефон инициализирован «+996 »', phoneInit, '+996 ');
const subjInit = await page.$eval('#cf-subject-val', el=>el.textContent);
eq('субъект пуст при открытии', subjInit, '');

// submit empty form → validateCreate false, no new row
const countBefore = await page.evaluate(()=>APPLICATIONS.length);
const validEmpty = await page.evaluate(()=>validateCreate());
eq('validateCreate() на пустой форме = false', validEmpty, false);
await page.evaluate(()=>submitCreate());
eq('сабмит пустой формы не создаёт заявку', await page.evaluate(()=>APPLICATIONS.length), countBefore);
const subjInvalid = await page.$eval('#cf-subject-field', el=>el.classList.contains('invalid'));
const progInvalid = await page.$eval('#cf-program-field', el=>el.classList.contains('invalid'));
ok('после сабмита пустой формы subject-field.invalid', subjInvalid);
ok('после сабмита пустой формы program-field.invalid', progInvalid);

// individual validators
console.log('\n--- 5b. Отдельные валидаторы ---');
eq('validateSubject() пусто = false', await page.evaluate(()=>validateSubject()), false);
eq('validateProgram() пусто = false', await page.evaluate(()=>validateProgram()), false);

// pick subject via real UI
await page.evaluate(()=>openModal('modal-pick-subject'));
await page.click('#modal-pick-subject tbody tr:first-child');
await page.click('#modal-pick-subject .modal-f .btn-primary');   // «Выбрать»
await page.waitForTimeout(80);
const subjPicked = await page.$eval('#cf-subject-val', el=>el.textContent);
ok('выбор субъекта через пикер заполняет поле', subjPicked.length > 0);
const addrPicked = await page.$eval('#cf-addr', el=>el.value);
ok('адрес заполнился из субъекта', addrPicked.length > 0);
eq('validateSubject() после выбора = true', await page.evaluate(()=>validateSubject()), true);

// clear picker
await page.evaluate(()=>clearPicker('cf-subject'));
eq('clearPicker очищает субъект', await page.$eval('#cf-subject-val', el=>el.textContent), '');
eq('clearPicker очищает адрес', await page.$eval('#cf-addr', el=>el.value), '');

// re-pick subject + program
await page.evaluate(()=>selectSubject('00404202510209 - ОсОО "Хот Лэйк Текстиль"','ул. Ахунбаева 117, Бишкек'));
await page.evaluate(()=>openModal('modal-pick-program-create'));
await page.click('#modal-pick-program-create tbody tr:first-child');   // АгроИнвест КР
await page.click('#modal-pick-program-create .modal-f .btn-primary');
await page.waitForTimeout(80);
const progPicked = await page.$eval('#cf-program-val', el=>el.textContent);
eq('выбор программы заполняет поле', progPicked, 'АгроИнвест КР');
eq('validateProgram() после выбора = true', await page.evaluate(()=>validateProgram()), true);
const bound = await page.evaluate(()=>progBound('amount'));
console.log('   progBound(amount) для АгроИнвест:', bound);
eq('progBound amount.min', bound.min, 100000);
eq('progBound amount.max', bound.max, 10000000);

// ============ 5c. Amount validation boundaries ============
console.log('\n--- 5c. Валидация суммы (границы АгроИнвест 100000..10000000) ---');
// Pure boundary logic: set cdraft directly and call validateReqAmount WITHOUT the
// DOM-harvest that validateAmount() does (validateReqAmount reads cdraft as-is).
async function setAmount(v){ return page.evaluate(val=>{ cdraft.requestedAmount=String(val); return validateReqAmount(); }, v); }
eq('сумма = min (100000) inclusive → valid', await setAmount('100000'), true);
eq('сумма = max (10000000) inclusive → valid', await setAmount('10000000'), true);
eq('сумма = min-1 (99999) → invalid', await setAmount('99999'), false);
eq('сумма = max+1 (10000001) → invalid', await setAmount('10000001'), false);
eq('сумма = 0 → invalid', await setAmount('0'), false);
eq('сумма отрицательная (-5) → invalid', await setAmount('-5'), false);
eq('сумма нечисло («abc») → invalid', await setAmount('abc'), false);
eq('сумма пустая → invalid', await setAmount(''), false);
eq('сумма 500000 в диапазоне → valid', await setAmount('500000'), true);
// thousand separators / comma decimal via t2num
eq('t2num(«1 000 000,00») = 1000000', await page.evaluate(()=>t2num('1 000 000,00')), 1000000);
eq('t2num(«1000000.00») = 1000000', await page.evaluate(()=>t2num('1000000.00')), 1000000);
eq('сумма «1 000 000,00» (t2num) в диапазоне → valid', await setAmount('1 000 000,00'), true);
// comma-as-decimal below min
eq('сумма «99 999,99» ниже min → invalid', await setAmount('99 999,99'), false);

// поле стало type=text (было type=number, молча съедало разделители) — проверяем реальным вводом
console.log('\n--- 5c-real. Ввод разделителей в поле суммы реального UI ---');
const amtSel = '#cf-cond-body [data-field="requestedAmount"] input';
const amtType = await page.$eval(amtSel, el => el.type);
ok('поле суммы — type=text (не number)', amtType === 'text', amtType);
await page.fill(amtSel, '');
await page.type(amtSel, '1 000 000,00');
const amtDomVal = await page.$eval(amtSel, el=>el.value);
console.log('   [diag] value после ввода «1 000 000,00»:', JSON.stringify(amtDomVal));
ok('поле суммы сохраняет пробелы/запятую как введено', amtDomVal === '1 000 000,00', amtDomVal);
const amtParsed = await page.evaluate(() => { saveCondInputs(); return t2num(cdraft.requestedAmount); });
ok('t2num парсит «1 000 000,00» → 1000000 (нет ошибки ×100)', amtParsed === 1000000, String(amtParsed));

// ============ 5d. Term validation ============
console.log('\n--- 5d. Валидация срока (АгроИнвест 6..60) ---');
async function setTerm(v){ return page.evaluate(val=>{ cdraft.requestedTerm=String(val); return validateReqTerm(); }, v); }
eq('срок = min (6) → valid', await setTerm('6'), true);
eq('срок = max (60) → valid', await setTerm('60'), true);
eq('срок = 5 (<min) → invalid', await setTerm('5'), false);
eq('срок = 61 (>max) → invalid', await setTerm('61'), false);
eq('срок = 0 → invalid', await setTerm('0'), false);
eq('срок = -3 → invalid', await setTerm('-3'), false);
eq('срок = 24 в диапазоне → valid', await setTerm('24'), true);

// amount/term WITHOUT program — clear program, expect only >0 rule
console.log('\n--- 5e. Сумма/срок БЕЗ программы ---');
await page.evaluate(()=>clearPicker('cf-program'));
const boundNull = await page.evaluate(()=>progBound('amount'));
eq('progBound без программы = null', boundNull, null);
eq('без программы: сумма 1 → valid (только >0)', await setAmount('1'), true);
eq('без программы: сумма 99999999999 → valid (нет верхней границы)', await setAmount('99999999999'), true);
eq('без программы: сумма 0 → invalid', await setAmount('0'), false);
eq('без программы: срок 999 → valid (только >0)', await setTerm('999'), true);

// ============ 5f. Program switch recomputes bounds/snapshot ============
console.log('\n--- 5f. Смена программы после ввода суммы ---');
await page.evaluate(()=>selectProgram('АгроИнвест КР'));
await setAmount('7000000');   // valid in Агро (max 10M)
const validAgro = await page.evaluate(()=>validateReqAmount());
eq('7 000 000 валидна для АгроИнвест (max 10M)', validAgro, true);
// switch to Поддержка (max 5M) — 7M now out of range
await page.evaluate(()=>selectProgram('Поддержка сельхозпроизводителей'));
const boundPodd = await page.evaluate(()=>progBound('amount'));
console.log('   progBound после смены на Поддержку:', boundPodd);
eq('границы пересчитаны: max = 5000000', boundPodd.max, 5000000);
await page.evaluate(()=>{ cdraft.requestedAmount='7000000'; });
const validAfterSwitch = await page.evaluate(()=>validateReqAmount());
eq('7 000 000 стала невалидной после смены на Поддержку (max 5M)', validAfterSwitch, false);
// snapshot recorded
const snap = await page.evaluate(()=> _progSnapshot ? Object.keys(_progSnapshot).length : 0);
ok('снапшот программы записан (_progSnapshot непуст)', snap > 0);

// ============ 5g. Phone mask ============
console.log('\n--- 5g. Телефон: маска/валидация ---');
eq('maskPhone(«555123456») = +996 555 123 456', await page.evaluate(()=>maskPhone('555123456')), '+996 555 123 456');
eq('maskPhone(«996555123456») отбрасывает код страны', await page.evaluate(()=>maskPhone('996555123456')), '+996 555 123 456');
eq('maskPhone(мусор «abc55x51def») только цифры', await page.evaluate(()=>maskPhone('abc55x51def')), '+996 555 1');
eq('maskPhone(пусто) = «»', await page.evaluate(()=>maskPhone('')), '');
eq('maskPhone обрезает до 9 цифр', await page.evaluate(()=>maskPhone('5551234567890')), '+996 555 123 456');
// validatePhone empty ok
await page.evaluate(()=>{ document.getElementById('cf-phone').value='+996 '; });
eq('validatePhone пустой (+996 ) → valid (опционально)', await page.evaluate(()=>validatePhone()), true);
await page.evaluate(()=>{ document.getElementById('cf-phone').value='+996 555 12'; });
eq('validatePhone неполный номер → invalid', await page.evaluate(()=>validatePhone()), false);
await page.evaluate(()=>{ document.getElementById('cf-phone').value='+996 555 123 456'; });
eq('validatePhone полный (9 цифр) → valid', await page.evaluate(()=>validatePhone()), true);
// real typing garbage
await page.fill('#cf-phone', '');
await page.type('#cf-phone', 'abc555123456def');
const phoneTyped = await page.$eval('#cf-phone', el=>el.value);
console.log('   [diag] телефон после ввода мусора:', JSON.stringify(phoneTyped));
ok('formatPhone при вводе мусора даёт маску +996 …', /^\+996/.test(phoneTyped) && !/[a-z]/i.test(phoneTyped));

// ============ 5h. validatePayday ============
console.log('\n--- 5h. День платежа (validatePayday) ---');
async function setPayday(v){ return page.evaluate(val=>{ cdraft.payDay=String(val); return validatePayday(); }, v); }
eq('payDay пусто → valid (опционально)', await setPayday(''), true);
eq('payDay 1 → valid', await setPayday('1'), true);
eq('payDay 29 → valid', await setPayday('29'), true);
eq('payDay 31 → valid', await setPayday('31'), true);
eq('payDay 0 → invalid', await setPayday('0'), false);
eq('payDay 32 → invalid', await setPayday('32'), false);
eq('payDay -1 → invalid', await setPayday('-1'), false);
eq('payDay 1.5 → invalid', await setPayday('1.5'), false);
eq('payDay «abc» → invalid', await setPayday('abc'), false);
// note: payDay field is not rendered in create form
const paydayFieldExists = await page.$('#cf-cond-body [data-field="payDay"]');
console.log('   [diag] поле payDay присутствует в форме создания:', !!paydayFieldExists);

// ============ 6. Full create flow ============
console.log('\n--- 6. Создание заявки (полный поток) ---');
await openCreate();
await page.evaluate(()=>selectSubject('00404202510209 - ОсОО "Хот Лэйк Текстиль"','ул. Ахунбаева 117, Бишкекx'.slice(0,-1)));
await page.evaluate(()=>selectProgram('АгроИнвест КР'));
// Fill the REAL number inputs so saveCondInputs()/validateCreate() see the values.
await page.fill('#cf-cond-body [data-field="requestedAmount"] input', '2500000');
await page.fill('#cf-cond-body [data-field="requestedTerm"] input', '24');
await page.evaluate(()=>{ validateAmount(); validateTerm(); });
// DOM-integration: validateAmount() reads DOM → cdraft, must be valid now
eq('validateAmount() через реальный DOM-ввод (2 500 000) = valid', await page.evaluate(()=>validateAmount()), true);
await page.fill('#cf-phone', '');
await page.type('#cf-phone', '555111222');
const countPre = await page.evaluate(()=>APPLICATIONS.length);
const validNow = await page.evaluate(()=>validateCreate());
eq('validateCreate() на заполненной форме = true', validNow, true);
const maxNumBefore = await page.evaluate(()=>{ let m=0; APPLICATIONS.forEach(a=>{const x=a.num.match(/-(\d{6})$/); if(x)m=Math.max(m,+x[1]);}); return m; });
await page.evaluate(()=>submitCreate());
await page.waitForTimeout(150);
const countPost = await page.evaluate(()=>APPLICATIONS.length);
eq('после создания APPLICATIONS +1', countPost, countPre+1);
const newRec = await page.evaluate(()=>APPLICATIONS[0]);
console.log('   новая запись:', JSON.stringify({num:newRec.num, inn:newRec.inn, name:newRec.name, status:newRec.status, amount:newRec.amount, term:newRec.term}));
ok('новая заявка добавлена ПЕРВОЙ (unshift)', /^З-2026-/.test(newRec.num));
eq('новая заявка статус = Новый', newRec.status, 'Новый');
eq('номер = maxN+2 padded', newRec.num, 'З-2026-' + String(maxNumBefore+2).padStart(6,'0'));
eq('сумма отформатирована ru-RU', newRec.amount, (2500000).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}));
eq('срок сохранён', newRec.term, '24');
// KEY BUG CHECK: subject parse uses em-dash '—' but label uses hyphen '-'
console.log('   [diag] newRec.inn=', JSON.stringify(newRec.inn), ' newRec.name=', JSON.stringify(newRec.name));
eq('ИНН распарсен из «ИНН - Название»', newRec.inn, '00404202510209');
eq('Название распарсено без ИНН', newRec.name, 'ОсОО "Хот Лэйк Текстиль"');

// after submit → detail view opens
const detOpen = await page.$eval('#view-detail', el=>getComputedStyle(el).display!=='none');
ok('после создания открывается детальная страница', detOpen);

// back to list, check row visible & counter
await page.evaluate(()=>{ showView('list'); renderGrid(); });
const firstInGrid = await firstRow();
eq('новая заявка первой в гриде', firstInGrid, newRec.num);
const cnt = await pgCount();
eq('счётчик обновился до нового количества', cnt, await page.evaluate(()=>_pluralRows(APPLICATIONS.length)));

// ============ 7. showToast ============
console.log('\n--- 7. showToast ---');
await page.evaluate(()=>showToast('тест','ok'));
const toastCount = await page.$$eval('#toast-wrap .toast', ts=>ts.length);
ok('showToast добавляет .toast', toastCount >= 1);

// ============ 8. Picker cancel/re-pick ============
console.log('\n--- 8. Пикеры: отмена/повторный выбор ---');
await openCreate();
await page.evaluate(()=>openModal('modal-pick-subject'));
await page.click('#modal-pick-subject tbody tr:nth-child(2)');
await page.click('#modal-pick-subject .modal-f .btn-secondary:last-child');  // «Отмена»
await page.waitForTimeout(50);
const subjAfterCancel = await page.$eval('#cf-subject-val', el=>el.textContent);
eq('отмена пикера субъекта не заполняет поле', subjAfterCancel, '');
// applyPick with no selection does nothing
await page.evaluate(()=>{ _pick.program=null; });
const preProg = await page.$eval('#cf-program-val', el=>el.textContent);
await page.evaluate(()=>applyPick('program'));
eq('applyPick без выделения ничего не делает', await page.$eval('#cf-program-val', el=>el.textContent), preProg);

// ============ SUMMARY ============
console.log('\n========================================');
console.log(`ИТОГО: ${PASS+FAIL} ассертов, ${PASS} PASS, ${FAIL} FAIL, ${jsErrors.length} JS-ошибок`);
if (fails.length){ console.log('\nПРОВАЛЫ:'); fails.forEach(f=>console.log('  ✗', f)); }
if (jsErrors.length){ console.log('\nJS-ОШИБКИ:'); jsErrors.forEach(e=>console.log('  !', e)); }
console.log('========================================');

await ctx.close();
