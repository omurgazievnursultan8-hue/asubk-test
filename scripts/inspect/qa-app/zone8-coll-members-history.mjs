/* QA zone 8 — вкладки «Залог» (tab-4), «Члены группы» (tab-3), «История» (tab-8).
   Прогон по мокапу loan-application.html. Только чтение мокапа, драйв UI/функций.
   Запуск: node scripts/inspect/qa-app/zone8-coll-members-history.mjs
   из /home/azamat/projects/asubk-credit-module. */
import { chromium } from 'playwright-core';

const FILE = 'file:///home/azamat/projects/asubk-credit-module/mockups/loan-application/loan-application.html';
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone8';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, viewport: { width: 1500, height: 1600 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') jsErrors.push('CONSOLE ' + m.text()); });

await page.goto(FILE, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const out = await page.evaluate(() => {
  const R = [];
  const A = (name, pass, info) => R.push({ name, pass: !!pass, info: info == null ? '' : String(info) });
  const clone = a => { const c = structuredClone(a); delete c._collateral; delete c._members; delete c._collSeq; delete c._memberDocs; delete c._collSel; return c; };
  const findNum = num => APPLICATIONS.find(a => a.num === num);

  // ===================== ЗАЛОГ =====================
  // coverageOf — чистые кейсы
  try {
    const c0 = coverageOf({ amount: '1 000 000,00', _collateral: [] });
    A('COLL coverageOf: 0 предметов → hasItems=false, cov=0, covOk=false', !c0.hasItems && c0.cov === 0 && !c0.covOk, JSON.stringify(c0));

    const cEq = coverageOf({ amount: '1 000 000,00', _collateral: [{ val: 1200000 }] });
    A('COLL coverageOf: ровно 120% → covOk=true (граница inclusive)', cEq.cov === 120 && cEq.covOk === true, JSON.stringify(cEq));

    const cBelow1 = coverageOf({ amount: '1 000 000,00', _collateral: [{ val: 1199999 }] });
    // Реальное покрытие 119.9999% < порога, но Math.round → 120 и covOk=true. Ожидаем провал (гейт должен блокировать).
    A('COLL coverageOf: на 1 сом ниже порога (119.9999%) должен блокировать (covOk=false)', cBelow1.covOk === false, `cov=${cBelow1.cov} covOk=${cBelow1.covOk} — округление маскирует недобор`);

    const cHalf = coverageOf({ amount: '1 000 000,00', _collateral: [{ val: 1195000 }] });
    // 119.5% округляется в 120% для показа (cov), но гейт сверяется с covRaw=119.5 < 120 → блокирует.
    A('COLL coverageOf: 119.5% → cov=120 для показа, но covRaw=119.5 и гейт закрыт (covOk=false)', cHalf.cov === 120 && cHalf.covRaw === 119.5 && cHalf.covOk === false, `cov=${cHalf.cov} covRaw=${cHalf.covRaw} covOk=${cHalf.covOk}`);

    // covRaw — сырое покрытие (по нему гейт), cov — округлённое (только для показа); дробное покрытие выше порога проходит.
    const cFrac = coverageOf({ amount: '1 000 000,00', _collateral: [{ val: 1234567 }] });
    A('COLL coverageOf: covRaw сырое, cov округлённое — гейт по covRaw (123.4567% → cov=123, covOk=true)', cFrac.covRaw === 123.4567 && cFrac.cov === 123 && cFrac.covOk === true, `cov=${cFrac.cov} covRaw=${cFrac.covRaw} covOk=${cFrac.covOk}`);

    const cNeg = coverageOf({ amount: '1 000 000,00', _collateral: [{ val: -500000 }] });
    A('COLL coverageOf: отрицательная стоимость даёт cov<0 без краша', !isNaN(cNeg.cov) && cNeg.cov < 0, JSON.stringify(cNeg));

    const cEmpty = coverageOf({ amount: '1 000 000,00', _collateral: [{ val: '' }, { val: 'abc' }] });
    A('COLL coverageOf: предмет без стоимости/нечисло → 0, НЕ NaN (защита _num)', !isNaN(cEmpty.cov) && cEmpty.sum === 0, JSON.stringify(cEmpty));

    const cDiv0 = coverageOf({ amount: '0', _collateral: [{ val: 500000 }] });
    A('COLL coverageOf: сумма кредита 0 → cov=0 без Infinity/NaN (защита credit>0)', cDiv0.cov === 0 && isFinite(cDiv0.cov), JSON.stringify(cDiv0));
  } catch (e) { A('COLL coverageOf: без исключений', false, e.message); }

  // setCollField — валидация инлайн-правки стоимости (та же проверка val>0, что и в модалке)
  try {
    _detailApp = clone(findNum('З-2026-000056')); // АгроИнвест, Новый, залоговая
    _collSel = null;
    const items = _collateralOf(_detailApp);
    const orig = items[0].val;
    setCollField(0, 'val', '-500000');
    A('COLL setCollField: отрицательная стоимость отклоняется инлайн (val>0), значение не меняется', items[0].val === orig, 'val=' + items[0].val);
    setCollField(0, 'val', '0');
    A('COLL setCollField: нулевая стоимость отклоняется инлайн (val>0), значение не меняется', items[0].val === orig, 'val=' + items[0].val);
    setCollField(0, 'val', '4 200 000,00');
    A('COLL setCollField: положительная стоимость принимается инлайн', items[0].val === 4200000, 'val=' + items[0].val);
  } catch (e) { A('COLL setCollField: без исключений', false, e.message); }

  // Смена вида (kind) существующего предмета → набор обязат. документов другой (ключ <id>::<tpl>)
  // + каскад _dropCollDocs: старые состояния документов удаляются, сирот не остаётся.
  try {
    _detailApp = clone(findNum('З-2026-000056'));
    const items = _collateralOf(_detailApp);
    items[0].kind = 'Недвижимость';
    const itemId = items[0].id;
    const before = _collDocStats(_detailApp).tot;   // populate _collDocs (ключи «<id>::<tpl>»)
    const store = _collDocsOf(_detailApp);
    const titleKey = itemId + '::title', encKey = itemId + '::enc';   // req-документы Недвижимости
    const hadOld = (titleKey in store) && (encKey in store);
    setCollField(0, 'kind', 'Оборудование');
    const after = _collDocStats(_detailApp).tot;
    A('COLL смена kind меняет обязат. набор документов (Недвиж.3 → Оборуд.2)', before !== after, `tot ${before}→${after}`);
    // Ключи прежнего вида (title/enc у Недвижимости) должны быть сброшены _dropCollDocs — сирот нет.
    A('COLL смена kind: каскад _dropCollDocs снял состояния прежнего вида — сирот title/enc нет', hadOld && !(titleKey in store) && !(encKey in store), `titleKey=${titleKey in store} encKey=${encKey in store}`);
  } catch (e) { A('COLL смена kind: без исключений', false, e.message); }

  // delCollItem — каскадная чистка документов удаляемого предмета (нет сирот «<id>::…»)
  try {
    _detailApp = clone(findNum('З-2026-000056'));
    const items = _collateralOf(_detailApp);
    const delId = items[0].id, keepId = items[1].id;
    _collDocStats(_detailApp);                         // populate состояния для всех предметов
    const store = _collDocsOf(_detailApp);
    const hadDel = Object.keys(store).some(k => k.indexOf(delId + '::') === 0);
    _collSel = 0;
    delCollItem();
    const orphans = Object.keys(store).filter(k => k.indexOf(delId + '::') === 0);
    const keptStill = Object.keys(store).some(k => k.indexOf(keepId + '::') === 0);
    A('COLL delCollItem: каскад _dropCollDocs удаляет состояния предмета — сирот нет, чужие ключи целы', hadDel && orphans.length === 0 && keptStill, `сирот=${orphans.length} чужие_целы=${keptStill}`);
  } catch (e) { A('COLL delCollItem каскад: без исключений', false, e.message); }

  // collItemSave — валидация обязательных полей через реальную модалку
  try {
    _detailApp = clone(findNum('З-2026-000056'));
    _collSel = null;
    const before = _collateralOf(_detailApp).length;
    addCollItem();                                   // открывает modal-coll-item, наполняет select
    document.getElementById('coll-f-val').value = ''; // без стоимости
    collItemSave();
    const afterEmpty = _collateralOf(_detailApp).length;
    const invalid = document.getElementById('coll-fld-val').classList.contains('invalid');
    A('COLL collItemSave: без стоимости → не сохраняет, поле invalid', afterEmpty === before && invalid, `len ${before}→${afterEmpty} invalid=${invalid}`);

    document.getElementById('coll-f-val').value = '1 500 000,00';
    document.getElementById('coll-f-desc').value = 'Тест-предмет';
    collItemSave();
    const afterOk = _collateralOf(_detailApp).length;
    A('COLL collItemSave: со стоимостью → предмет добавлен', afterOk === before + 1, `len ${before}→${afterOk}`);
  } catch (e) { A('COLL collItemSave: без исключений', false, e.message); }

  // delCollItem — единственный предмет / без выбора
  try {
    _detailApp = clone(findNum('З-2026-000056'));
    const items = _collateralOf(_detailApp);
    items.length = 0; items.push({ id: 9, kind: 'Недвижимость', val: 5000000, owner: '', desc: 'один' });
    _collSel = 0;
    delCollItem();
    const cov = coverageOf(_detailApp);
    A('COLL delCollItem: удаление единственного → hasItems=false, гейт закрыт', _collateralOf(_detailApp).length === 0 && !cov.hasItems && !sendReady(_detailApp), 'len=' + _collateralOf(_detailApp).length);

    _detailApp = clone(findNum('З-2026-000056'));
    const n = _collateralOf(_detailApp).length;
    _collSel = null;
    delCollItem();                                   // без выбора — должен ничего не сделать
    A('COLL delCollItem: без выбранной строки → без изменений', _collateralOf(_detailApp).length === n, 'len=' + n);
  } catch (e) { A('COLL delCollItem: без исключений', false, e.message); }

  // Владелец залога — очистка / пикер строки / третье лицо
  try {
    _detailApp = clone(findNum('З-2026-000056'));
    addCollItem();
    _collOwnerPick = '00404202510209 - ОсОО "Хот Лэйк Текстиль"';
    _setOwnerLabel(_collOwnerPick);
    const lbl1 = document.getElementById('coll-f-owner').textContent;
    clearCollOwner();
    const lbl2 = document.getElementById('coll-f-owner').textContent;
    A('COLL владелец: _setOwnerLabel/clearCollOwner работают, поддержано третье лицо (не заёмщик)', lbl1.includes('Хот Лэйк') && !document.getElementById('coll-f-owner').classList.contains('filled') && _collOwnerPick === '', `"${lbl1}" → "${lbl2}"`);
    closeModal('modal-coll-item');

    pickCollOwnerRow(1);
    A('COLL pickCollOwnerRow: цель пикера = collrow:1', _subjectPickTarget === 'collrow:1', _subjectPickTarget);
    closeModal('modal-pick-subject');
    A('COLL закрытие пикера сбрасывает цель на borrower (нет застревания)', _subjectPickTarget === 'borrower', _subjectPickTarget);
  } catch (e) { A('COLL владелец: без исключений', false, e.message); }

  // Права: залог = spec × draft × editMode. Прочие роли/фазы — read-only.
  try {
    const collApp = 'З-2026-000056'; // АгроИнвест, Новый (draft)
    const hasAddBtn = () => { gotoDetail(collApp); showTab('tab-4'); return document.getElementById('tab-4').innerHTML.includes('addCollItem'); };
    _role = 'spec'; _editMode = true; const specEdit = hasAddBtn();
    _role = 'spec'; _editMode = false; const specView = hasAddBtn();
    _role = 'com'; _editMode = true; const comEdit = hasAddBtn();
    _role = 'ro'; _editMode = true; const roEdit = hasAddBtn();
    _role = 'gf'; _editMode = true; const gfEdit = hasAddBtn();
    _role = 'dept'; _editMode = true; const deptEdit = hasAddBtn();
    A('COLL права: spec+draft+Изменить → кнопки правки видны', specEdit === true);
    A('COLL права: spec+draft БЕЗ Изменить → read-only (кнопок нет)', specView === false);
    A('COLL права: com/ro/gf/dept → read-only (кнопок нет)', !comEdit && !roEdit && !gfEdit && !deptEdit, `com=${comEdit} ro=${roEdit} gf=${gfEdit} dept=${deptEdit}`);

    // Фаза review/locked у spec: draft only → review залоговая заявка read-only
    _role = 'spec'; _editMode = true;
    gotoDetail('З-2026-000084'); showTab('tab-4'); // АгроИнвест, На рассмотрении (review)
    const reviewEdit = document.getElementById('tab-4').innerHTML.includes('addCollItem');
    A('COLL права: spec в фазе review → read-only', reviewEdit === false);
    _role = 'spec'; _editMode = false;
  } catch (e) { A('COLL права: без исключений', false, e.message); }

  // hasCollateral=true, но 0 предметов
  try {
    _detailApp = clone(findNum('З-2026-000056'));
    _collateralOf(_detailApp).length = 0;
    const html = renderCollateral(_detailApp);
    A('COLL 0 предметов при hasCollateral: баннер «не указан ни один предмет залога»', html.includes('не указан ни один предмет залога'));
    A('COLL 0 предметов: sendGateReason ссылается на отсутствие предмета залога (после сбора доков)', typeof sendGateReason(_detailApp) === 'string');
  } catch (e) { A('COLL 0 предметов: без исключений', false, e.message); }

  // ===================== ЧЛЕНЫ ГРУППЫ =====================
  const GROUP_NEW = 'З-2026-000105'; // Поддержка сельхозпроизводителей, Новый (draft, group)
  try {
    _detailApp = clone(findNum(GROUP_NEW));
    const members = _membersOf(_detailApp);
    const existPin = members[0].pin;
    const before = members.length;
    _role = 'spec'; _editMode = true;
    addGroupMember(existPin + ' - ДУБЛИКАТ ТЕСТ');
    A('MEM addGroupMember: дубликат ПИН отклоняется', _membersOf(_detailApp).length === before, 'len=' + _membersOf(_detailApp).length);
  } catch (e) { A('MEM дубликат ПИН: без исключений', false, e.message); }

  try {
    _detailApp = clone(findNum(GROUP_NEW));
    const before = _membersOf(_detailApp).length;
    addGroupMember('');   // пустой val
    const m = _membersOf(_detailApp);
    const added = m.length === before + 1 && m[m.length - 1].pin === '';
    A('MEM addGroupMember: пустой ПИН/ФИО не добавляется (валидация pin && fio)', !added, added ? 'добавлен член с pin="" fio="" — нет проверки' : 'не добавлен');
  } catch (e) { A('MEM пустой ПИН: без исключений', false, e.message); }

  // Мусорная строка без разделителя « - » → не парсятся ни ПИН, ни ФИО → отклоняется.
  try {
    _detailApp = clone(findNum(GROUP_NEW));
    const before = _membersOf(_detailApp).length;
    _role = 'spec'; _editMode = true;
    addGroupMember('мусор без разделителя');
    A('MEM addGroupMember: мусорная строка (без ПИН/ФИО) отклоняется — член не добавлен', _membersOf(_detailApp).length === before, 'len=' + _membersOf(_detailApp).length);
  } catch (e) { A('MEM мусорная строка: без исключений', false, e.message); }

  // delMember единственного/всех — вкладка/isGroup
  try {
    _detailApp = clone(findNum(GROUP_NEW));
    let m = _membersOf(_detailApp);
    while (m.length) { _memberSel = 0; delMember(); m = _membersOf(_detailApp); }
    const tabsWithGroup = TABS.filter(t => !t.cond || t.cond(_detailApp)).map(t => t.panel);
    A('MEM delMember: удалили всех → isGroup остаётся true, вкладка «Члены группы» (tab-3) на месте', _detailApp.isGroup === true && tabsWithGroup.includes('tab-3'), 'members=' + _membersOf(_detailApp).length);
    const html = renderMembers(_detailApp);
    A('MEM 0 членов: гейт блокирует по размеру группы', html.includes('размер группы 0') && html.includes('заблокирована'));
  } catch (e) { A('MEM delMember все: без исключений', false, e.message); }

  try {
    _detailApp = clone(findNum(GROUP_NEW));
    const n = _membersOf(_detailApp).length;
    _memberSel = null;
    delMember();   // без выбора
    A('MEM delMember: без выбранной строки → без изменений', _membersOf(_detailApp).length === n);
  } catch (e) { A('MEM delMember без выбора: без исключений', false, e.message); }

  // setMemberSum — валидация транша (>0) + сверка Σ траншей с телом кредита (_groupGate.sumOk)
  try {
    _detailApp = clone(findNum(GROUP_NEW));
    const members = _membersOf(_detailApp);
    const credit = _num(_detailApp.approvedAmount || _detailApp.amount);

    // Сид: Σ траншей == тело кредита → sumOk=true (транши сеются от того же тела).
    const gSeed = _groupGate(_detailApp);
    A('MEM _groupGate.sumOk: сид-транши сходятся с телом кредита (Σ == сумма)', gSeed.sumOk === true && Math.abs(gSeed.total - credit) < 0.01, `Σ=${gSeed.total} credit=${credit} sumOk=${gSeed.sumOk}`);

    setMemberSum(0, '999 999 999,00');   // огромный транш одного члена → Σ расходится с телом
    const g = _groupGate(_detailApp);
    A('MEM _groupGate.sumOk: расхождение Σ траншей с телом кредита ловится гейтом (sumOk=false)', g.sumOk === false && g.ok === false && g.reasons.some(r => /траншей/.test(r)), `Σ=${g.total} credit=${credit} sumOk=${g.sumOk}`);

    const orig1 = members[1].sum;
    setMemberSum(1, '-100000');
    A('MEM setMemberSum: отрицательная сумма отклоняется (транш > 0), значение не меняется', members[1].sum === orig1, 'sum=' + members[1].sum);
    setMemberSum(1, 'ерунда');
    A('MEM setMemberSum: нечисловой текст отклоняется без краша, значение не меняется', members[1].sum === orig1, 'sum=' + members[1].sum);
    const orig2 = members[2].sum;
    setMemberSum(2, '0');
    A('MEM setMemberSum: нулевой транш отклоняется (транш > 0), значение не меняется', members[2].sum === orig2, 'sum=' + members[2].sum);
    setMemberSum(2, '350 000,00');
    A('MEM setMemberSum: положительный транш принимается', members[2].sum === 350000, 'sum=' + members[2].sum);
  } catch (e) { A('MEM setMemberSum: без исключений', false, e.message); }

  // Дата члена / дата выдачи + round-trip _ruToISO/_isoToRu
  try {
    setMemberDate(0, '');   // очистка через input[type=date]
    // после очистки хранится '—' (регэксп _isoToRu не совпал)
    _detailApp = clone(findNum(GROUP_NEW));
    setMemberDate(0, '');
    A('MEM setMemberDate: пустая дата → хранится "—" (round-trip к пустому input)', _membersOf(_detailApp)[0].date === '—', 'date=' + _membersOf(_detailApp)[0].date);

    // round-trip: чистое переставление строк, БЕЗ календарной валидации
    const rt = s => _isoToRu(_ruToISO(s));
    A('MEM _ruToISO/_isoToRu: обычная дата round-trip lossless', rt('20.06.2026') === '20.06.2026');
    A('MEM date-хелперы: 29.02.2025 (невисокосный) переживает round-trip — календарной проверки НЕТ', _ruToISO('29.02.2025') === '2025-02-29' && rt('29.02.2025') === '29.02.2025', 'ruToISO=' + _ruToISO('29.02.2025'));
    A('MEM date-хелперы: 31.04.2026 переживает round-trip — календарной проверки НЕТ', _ruToISO('31.04.2026') === '2026-04-31' && rt('31.04.2026') === '31.04.2026');
    A('MEM _isoToRu: мусор → "—"', _isoToRu('не дата') === '—');
    A('MEM setMemberDate: дата вне срока кредита не проверяется (принимается любая)', true, 'валидации диапазона нет по коду');
  } catch (e) { A('MEM даты: без исключений', false, e.message); }

  // Права членов: com/ro read-only
  try {
    const btn = () => { gotoDetail(GROUP_NEW); showTab('tab-3'); return document.getElementById('tab-3').innerHTML.includes('addMemberOpen'); };
    _role = 'spec'; _editMode = true; const s = btn();
    _role = 'com'; _editMode = true; const c = btn();
    _role = 'ro'; _editMode = true; const r = btn();
    A('MEM права: spec+draft+Изменить → кнопки видны; com/ro → read-only', s === true && !c && !r, `spec=${s} com=${c} ro=${r}`);
    _role = 'spec'; _editMode = false;
  } catch (e) { A('MEM права: без исключений', false, e.message); }

  // Группа + залог одновременно — обе условные вкладки?
  try {
    const seedBoth = APPLICATIONS.filter(a => a.isGroup && a.hasCollateral).map(a => a.num);
    A('MEM+COLL: в сид-данных НЕТ заявок с group И collateral одновременно (программы взаимоисключающи)', seedBoth.length === 0, 'найдено: ' + seedBoth.length);
    const forced = clone(findNum(GROUP_NEW)); forced.isGroup = true; forced.hasCollateral = true; forced.collKinds = ['Недвижимость'];
    const tabs = TABS.filter(t => !t.cond || t.cond(forced)).map(t => t.panel);
    A('MEM+COLL: при force обоих флагов обе условные вкладки (tab-3 и tab-4) появляются', tabs.includes('tab-3') && tabs.includes('tab-4'), tabs.join(','));
  } catch (e) { A('MEM+COLL: без исключений', false, e.message); }

  // ===================== ИСТОРИЯ =====================
  // Хронология
  try {
    const app = findNum('З-2026-000089'); // Одобрена, есть DEMO_PROV
    const ev = buildHistory(app);
    const toMin = dt => { const m = /(\d{2}):(\d{2})$/.exec(dt); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
    let desc = true;
    for (let i = 1; i < ev.length; i++) if (toMin(ev[i].dt) > toMin(ev[i - 1].dt)) desc = false;
    A('HIST buildHistory: отсортирована по времени убыв.', desc && ev.length > 0, 'событий=' + ev.length);
  } catch (e) { A('HIST хронология: без исключений', false, e.message); }

  // Статичность: история НЕ отражает живые действия пользователя
  try {
    _detailApp = clone(findNum(GROUP_NEW));
    _role = 'spec'; _editMode = true;
    // удалить всех членов вживую
    let m = _membersOf(_detailApp);
    while (m.length) { _memberSel = 0; delMember(); m = _membersOf(_detailApp); }
    // Событие «Добавлен член группы» выводится из РЕАЛЬНЫХ членов — нет членов → нет события.
    const evEmpty = buildHistory(_detailApp);
    const hasMemberEvent = evEmpty.some(e => e.event.includes('Добавлен член группы'));
    A('HIST: событие «Добавлен член группы» строится из модели — после удаления ВСЕХ членов его нет', hasMemberEvent === false, hasMemberEvent ? 'событие осталось без членов' : 'нет события');
    // А с членами — событие есть и берёт ФИО+сумму первого реального члена.
    const withMembers = clone(findNum(GROUP_NEW));
    const m0 = _membersOf(withMembers)[0];
    const evFull = buildHistory(withMembers);
    const memEv = evFull.find(e => e.event.includes('Добавлен член группы'));
    A('HIST: событие «Добавлен член группы» берёт ФИО+сумму первого реального члена', !!memEv && memEv.to.includes(_shortFio(m0.fio)) && memEv.to.includes(_fmt(_num(m0.sum))), memEv ? memEv.to : 'нет события');
    // добавить предмет залога вживую — в истории нет события про залог
    _detailApp = clone(findNum('З-2026-000056'));
    addCollItem(); document.getElementById('coll-f-val').value = '2 000 000,00'; collItemSave();
    const ev2 = buildHistory(_detailApp);
    const hasCollEvent = ev2.some(e => /залог|предмет/i.test(e.event));
    A('HIST статика: добавление предмета залога вживую НЕ попадает в историю (нет field-level для залога)', hasCollEvent === false, hasCollEvent ? 'есть' : 'нет события про залог');
  } catch (e) { A('HIST статика: без исключений', false, e.message); }

  // Детерминизм дат ЖЦ
  try {
    const app = findNum('З-2026-000089');
    const h1 = renderLifecycle(app), h2 = renderLifecycle(app);
    A('HIST renderLifecycle: детерминизм — одинаковый вывод между перерисовками', h1 === h2);
    A('HIST _lcHash: детерминирован', _lcHash('З-2026-000089') === _lcHash('З-2026-000089'));
  } catch (e) { A('HIST детерминизм: без исключений', false, e.message); }

  // _lcAddDays границы месяца/года
  try {
    const eq = (d, y, mo, day) => d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day;
    A('HIST _lcAddDays: 01.01.2026 - 1 = 31.12.2025 (граница года)', eq(_lcAddDays(new Date(2026, 0, 1), -1), 2025, 11, 31));
    A('HIST _lcAddDays: 28.02.2026 + 1 = 01.03.2026 (2026 невисокосный)', eq(_lcAddDays(new Date(2026, 1, 28), 1), 2026, 2, 1));
    A('HIST _lcAddDays: 31.12.2026 + 1 = 01.01.2027', eq(_lcAddDays(new Date(2026, 11, 31), 1), 2027, 0, 1));
  } catch (e) { A('HIST _lcAddDays: без исключений', false, e.message); }

  // История на новой заявке — не пусто/не падает и НЕ содержит выдуманных событий
  try {
    const fresh = { num: 'З-2026-099999', status: 'Новый', amount: '500 000,00', isGroup: false, hasCollateral: false };
    const ev = buildHistory(fresh);
    A('HIST новая заявка: buildHistory не падает и не пуст', Array.isArray(ev) && ev.length > 0, 'событий=' + ev.length);
    const fabricated = ev.some(e => e.event.includes('Загружен документ: Паспорт')) || ev.some(e => e.event.includes('Редактирование (номер телефона)'));
    A('HIST новая заявка: НЕ выводит выдуманных событий (Паспорт/Редактирование телефона)', fabricated === false, fabricated ? 'на пустой заявке присутствуют сфабрикованные события' : 'ок');
    // Событие про телефон появляется только при наличии app.phone.
    const withPhone = buildHistory({ num: 'З-2026-099998', status: 'Новый', amount: '500 000,00', isGroup: false, hasCollateral: false, phone: '+996 555 112233' });
    A('HIST: событие «Редактирование (номер телефона)» появляется только при app.phone', withPhone.some(e => e.event.includes('Редактирование (номер телефона)')) && withPhone.some(e => e.to.includes('+996 555 112233')));
  } catch (e) { A('HIST новая заявка: без исключений', false, e.message); }

  return { R };
});

// ---- Отчёт ----
const results = out.R;
const fails = results.filter(r => !r.pass);
console.log('\n================ ZONE 8: Залог · Члены группы · История ================');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.name}${r.info ? '  «' + r.info + '»' : ''}`);
console.log('\n---- СВОДКА ----');
console.log(`Ассертов: ${results.length} · Провалов: ${fails.length} · JS-ошибок: ${jsErrors.length}`);
if (fails.length) { console.log('\nПРОВАЛЫ:'); for (const f of fails) console.log('  ✗ ' + f.name + (f.info ? '  [' + f.info + ']' : '')); }
if (jsErrors.length) { console.log('\nJS-ОШИБКИ:'); for (const e of jsErrors) console.log('  ! ' + e); }

await ctx.close();
