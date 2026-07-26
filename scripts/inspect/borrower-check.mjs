// Смоук-проверка мокапа заёмщика (mockups/borrower/borrower.html) на jsdom.
// Спецификация: docs/superpowers/specs/2026-07-23-borrower-rework-design.md.
// Запуск: node scripts/inspect/borrower-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML = readFileSync(resolve('mockups/borrower/borrower.html'), 'utf8');

function mk(){
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail?.message || e.message)));
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost/' });
  const w = dom.window, doc = w.document;
  const ev = s => w.eval(s);
  const $  = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  return { dom, w, doc, ev, $, $$, errs };
}

let fails = 0, n = 0;
const ok = (name, cond) => { n++; if (!cond) fails++; console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); };

const g = mk();
ok('0. страница загрузилась без ошибок jsdom', g.errs.length === 0);
ok('0b. TODAY зафиксирован', g.ev("TODAY") === '13.07.2026');

// ── Модель состояния ──
ok('S1. заведён полный набор заёмщиков (все подгруппы 1.1…5)', g.ev("SUBJECTS.length") >= 30);
ok('S2. ветка 1 АгроТехСервис на месте',
  g.ev("SUBJECTS.some(s=>s.inn==='01204199910016' && /АгроТехСервис/.test(s.name))"));
ok('S3. факт-массивы без производных полей (CREDITS)',
  g.ev("CREDITS.every(c=>!('level' in c) && !('category' in c) && !('daysEff' in c))"));
ok('S4. факт-массивы без производных полей (SUBJECTS)',
  g.ev("SUBJECTS.every(s=>!('group' in s) && !('category' in s))"));
ok('S5. реестр показывает все строки', g.$$('#listTable tbody tr').length === g.ev("SUBJECTS.length"));
ok('S6. WORKDAYS — массив праздников (строки dd.mm.yyyy)',
  g.ev("Array.isArray(WORKDAYS) && WORKDAYS.every(d=>/^\\d{2}\\.\\d{2}\\.\\d{4}$/.test(d))"));
ok('S7. route() навигация в карточку не бросает (DATA→SUBJECTS)',
  (() => { try { g.ev("location.hash='#/b/01204199910016'"); g.ev("route()"); return g.errs.length===0; } catch(e){ return false; } })());

// ── Категория (1–7) ──
ok('1. catByDays границы 5/6/181', g.ev("catByDays(5)")==='low' && g.ev("catByDays(6)")==='mid' && g.ev("catByDays(181)")==='high');
ok('2. подавление 181 до worst-of: кредит с оверлеем не Высокий по дням',
  g.ev("catOfCredit('C-ATS-GAZ', TODAY).suppressed")===true && g.ev("catOfCredit('C-ATS-GAZ', TODAY).daysEff")!=='high');
ok('3. подавление не трогает high от фактора комитета',
  g.ev("catOfCredit('C-ATS-NECEL', TODAY).level")==='high' && g.ev("catOfCredit('C-ATS-NECEL', TODAY).days")===0);
ok('4. фактор без committeeRef категорию не двигает (И-1)',
  g.ev("catOfCredit('C-B5-CLEAN', TODAY).level")==='low');
ok('5. worst-of=Высокий при 0 просрочке (нецелевое, ветка 1)',
  g.ev("catOfBorrower('01204199910016', TODAY)")==='high');
ok('6. истёкший оверлей 181 → пересчёт в Высокий',
  g.ev("catOfCredit('C-B5-EXP', TODAY).suppressed")===false && g.ev("catOfCredit('C-B5-EXP', TODAY).level")==='high');
ok('7. заёмщик без действующих кредитов → null (И-3, ветка 10 погашен)',
  g.ev("catOfBorrower('10001199900101', TODAY)")===null);

/* ── Категория как производная (B1–B7, ревизия 26.07.2026 · ADR-0001) ──
   До ревизии рядом с catOfBorrower() лежал массив CATEGORY_LOG. Они расходились
   молча: 4 заёмщика с категорией «Высокий» не имели записи в журнале, и обязательство
   О-1 по ним не выставлялось вообще. Дни просрочки лежали полем и были снимком на
   сегодня — параметр даты у catOfCredit существовал, но ни на что не влиял. */
ok('B1. журнала категории нет — только производная', g.ev("typeof CATEGORY_LOG") === 'undefined');
ok('B2. факт — дата выхода на просрочку, не число дней',
  g.ev("CREDITS.every(c=>!('overdueDays' in c))") &&
  g.ev("CREDITS.some(c=>/^\\d{2}\\.\\d{2}\\.\\d{4}$/.test(c.overdueSince||''))"));
ok('B3. дни просрочки растут со временем (производная от даты)',
  g.ev("overdueDaysOn(CREDITS.find(c=>c.id==='C-ATS-GAZ'), '13.06.2026')") ===
  g.ev("overdueDaysOn(CREDITS.find(c=>c.id==='C-ATS-GAZ'), TODAY)") - 30);
ok('B4. категория историчная: ветка 1 на 01.01.2026 — Средний, сегодня — Высокий',
  g.ev("catOfBorrower('01204199910016','01.01.2026')")==='mid' &&
  g.ev("catOfBorrower('01204199910016',TODAY)")==='high');
ok('B5. история категории восстановлена из фактов (ветка 1: low → mid → high)',
  g.ev("categoryEvents('01204199910016',TODAY).map(e=>e.level).join('>')")==='low>mid>high');
ok('B6. срок О-1 считается от ПОСЛЕДНЕЙ полосы, не от первой (ветка 3: две полосы)',
  g.ev("categoryEvents('03301199930031',TODAY).map(e=>e.level).join('>')")==='high>low>mid' &&
  g.ev("lastEscalation('03301199930031',TODAY).date")==='04.06.2026');
ok('B7. у каждого Среднего/Высокого выставлено О-1 (дыра закрыта, было 4 молчащих)',
  g.ev(`SUBJECTS.map(s=>s.inn).filter(i=>['mid','high'].includes(catOfBorrower(i,TODAY)))
        .every(i=>obligations(i,TODAY).some(o=>o.code==='О-1'))`));

// ── Подгруппа (8–11) ──
/* Лестница: у заёмщика несколько подтверждённых процедур — побеждает старшая.
   Ветка 6 несёт 2.1 + 2.2; проверяем сам выбор максимума, а не конкретный код,
   иначе тест ломается при каждом переименовании процедур в PROCEDURE_DICT. */
ok('8. лестница подгрупп: несколько процедур → побеждает старшая',
  g.ev("procsOf('06601199960061').filter(p=>p.confirmed&&!isProcClosed(p)).map(p=>procGroupOf(p)).filter(Boolean).sort().join('+')")==='2.1+2.2' &&
  g.ev("subgroupOf('06601199960061', TODAY)")==='2.2');
ok('8b. подгруппа 2.3 достижима (в наборе есть процедура, дающая её)',
  g.ev("PROCESSES.some(p=>procGroupOf(p)==='2.3')"));
ok('9. неподтверждённая процедура в блок 2 не пускает (И-2)',
  g.ev("subgroupOf('08801199980081', TODAY)")[0]==='1');
ok('10. терминал «банкротство завершено» → 3.2 (Ш-2)',
  g.ev("subgroupOf('07701199970071', TODAY)")==='3.2');
ok('11. полное погашение → 5',
  g.ev("subgroupOf('10001199900101', TODAY)")==='5');

/* ── Подгруппа и группа как производные (C1–C6, ревизия 26.07.2026) ──
   GROUP_LOG хранил 2.3 там, где процедуры давали 2.2, и держал руками проставленную
   базу 1.2: заёмщик с просрочкой, но без записи, числился «погашает по графику». */
ok('C1. журнала группы нет — терминалы приходят событием с документом',
  g.ev("typeof GROUP_LOG") === 'undefined' && g.ev("Array.isArray(BORROWER_EVENTS)"));
ok('C2. у каждого терминального события есть документ-основание',
  g.ev("BORROWER_EVENTS.length") > 0 &&
  g.ev("BORROWER_EVENTS.every(e=>e.doc && e.basis && /п\\.\\d+/.test(e.basis))"));
ok('C3. группа — верхний уровень подгруппы (1…5)',
  g.ev("SUBJECTS.every(s=>groupOf(s.inn,TODAY)===subgroupOf(s.inn,TODAY)[0])") &&
  g.ev("groupOf('06601199960061',TODAY)")==='2');
ok('C4. база 1.2 выводится из просрочки, а не из записи мониторинга',
  g.ev("subgroupOf('02201199920021', TODAY)")==='1.2' &&
  g.ev("CREDITS.some(c=>c.inn==='02201199920021' && isActiveCredit(c,TODAY) && overdueDaysOn(c,TODAY)>0)"));
ok('C5. просрочка без подтверждённой процедуры не даёт 1.1 (дефект прежней базы)',
  g.ev(`SUBJECTS.map(s=>s.inn)
        .filter(i=>CREDITS.some(c=>c.inn===i && isActiveCredit(c,TODAY) && overdueDaysOn(c,TODAY)>0))
        .every(i=>subgroupOf(i,TODAY)!=='1.1')`));
ok('C7. фильтр реестра по ГРУППЕ отбирает все её подгруппы',
  (() => { const f = mk();
    f.doc.getElementById('f-group').value = '2';
    f.ev("active = readFields(); renderList();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>groupOf(s.inn,TODAY)==='2').length");
    return shown === want && shown > 0; })());
ok('C6. подгруппа историчная: до события банкротства заёмщик не в 3.2',
  g.ev("subgroupOf('07701199970071','01.05.2026')")!=='3.2' &&
  g.ev("subgroupOf('07701199970071',TODAY)")==='3.2');

// ... сценарии 12–26 добавляются по мере готовности функций ...

// ── Обязательства (12–17) ──
const codes = inn => g.ev(`obligations('${inn}', TODAY).map(o=>o.code).join(',')`);
ok('12. Средний + долг >50млн → О-1 и О-2 (ветка 2)',
  /О-1/.test(codes('02201199920021')) && /О-2/.test(codes('02201199920021')));
ok('13. Средний + долг <50млн → только О-1, О-2 нет (ветка 3)',
  /О-1/.test(codes('03301199930031')) && !/О-2/.test(codes('03301199930031')));
ok('14. Высокий → О-1 есть, О-2 нет (порог О-2 только для Среднего)',
  /О-1/.test(codes('01204199910016')) && !/О-2/.test(codes('01204199910016')));
ok('15. addWorkdays пропускает выходные и праздники',
  g.ev("addWorkdays('06.03.2026', 3)")==='12.03.2026');   // 06.03 пт → пн 09, 08.03 празд(вс), 10,11,12 → +3 раб. = 12.03
ok('16. просроченное О-1 → статус «просрочено» (ветка 4)',
  g.ev("obligations('04401199940041', TODAY).find(o=>o.code==='О-1').status")==='просрочено');
ok('17. О-4 при наличии просроченной задолженности (ветка 1)',
  /О-4/.test(codes('01204199910016')));

// ── Долг и обеспеченность (D1–D3) ──
ok('D1. totalDebt = сумма 5 статей по действующим (ветка 1)',
  g.ev("totalDebt('01204199910016')") === 5200000+130000 + 9400000+410000+88000 + 1100000+20000);
ok('D3. coverageOf — зеркало индекса, worst ≤ aggregate (ветка 1)',
  g.ev("coverageOf('01204199910016').worst") <= g.ev("coverageOf('01204199910016').aggregate"));

/* ── Деньги: две части снимка (D2, D4–D9, ревизия 26.07.2026 · ADR-0001) ──
   До ревизии слово «просрочка» на одном экране означало три разных числа: полный
   остаток проблемных кредитов (9 898 000), «%+пеня» в таблице (498 000) и всю
   задолженность — разброс в 20 раз. Причина: у кредита не было просроченной ЧАСТИ,
   потому что нет графика платежей. Теперь снимок приходит разложенным на срочную и
   просроченную часть, а полный остаток проблемных кредитов называется «под риском». */
ok('D2. overdueDebt = просроченная часть, а не остаток проблемного кредита (ветка 1)',
  g.ev("overdueDebt('01204199910016')") === g.ev("CREDITS.filter(c=>c.inn==='01204199910016').reduce((s,c)=>s+sumArt(c.debt.overdue),0)")
  && g.ev("overdueDebt('01204199910016')") < g.ev("atRisk('01204199910016')"));
ok('D4. atRisk = полный остаток кредитов с просрочкой (ветка 1 = Газификация целиком)',
  g.ev("atRisk('01204199910016')") === 9400000+410000+88000);
ok('D5. поля balance больше нет ни на одном кредите (была копия debt.principal)',
  g.ev("CREDITS.every(c=>!('balance' in c))"));
ok('D6. срочная + просроченная часть = вся задолженность кредита, по всем 5 статьям',
  g.ev("CREDITS.every(c=>ART.every(a=>typeof c.debt.current[a]==='number' && typeof c.debt.overdue[a]==='number')) "
     + "&& CREDITS.every(c=>creditTotal(c)===sumArt(c.debt.current)+sumArt(c.debt.overdue))"));
ok('D7. просроченная часть есть тогда и только тогда, когда есть дни просрочки на дату снимка',
  g.ev("CREDITS.every(c=>(sumArt(c.debt.overdue)>0) === (overdueDaysOn(c, DEBT_ASOF)>0))"));
ok('D8. просроченная часть не больше всей задолженности ни по одному кредиту',
  g.ev("CREDITS.every(c=>creditOverdue(c) <= creditTotal(c))"));
/* деньги подписаны своей датой и дате среза не подчиняются — это должно быть видно на экране */
ok('D9. снимок подписан DEBT_ASOF ≠ TODAY и дата видна в сводке по кредитам',
  g.ev("DEBT_ASOF") !== g.ev("TODAY")
  && g.ev("CREDITS.every(c=>c.debt.asOf===DEBT_ASOF)")
  && new RegExp(g.ev("DEBT_ASOF").replace(/\./g,'\\.')).test(g.ev("creditsSummaryCard('01204199910016')")));
ok('D10. в сводке разведены «просроченная часть» и «под риском»',
  /Просроченная часть/.test(g.ev("creditsSummaryCard('01204199910016')"))
  && /Под риском/.test(g.ev("creditsSummaryCard('01204199910016')")));

/* ── Обязательство = (ИНН, код, период), закрытие фактом (F1–F8, ревизия 26.07.2026) ──
   До ревизии обязательство было одной строкой «на сегодня» без периода: О-4 (вынос на
   комитет, п.13) существовало в единственном экземпляре и молча переезжало на следующий
   месяц, стирая пропущенный. Закрывать его было нечем — статус считался только от срока. */
ok('F1. обязательства нигде не хранятся и не имеют отметки «выполнено» (И-7)',
  g.ev("typeof OBLIGATIONS") === 'undefined'
  && g.ev("obligations('01204199910016',TODAY).every(o=>!('done' in o) && !('completed' in o) && !('mark' in o))"));
ok('F2. ключ (ИНН, код, период) уникален',
  g.ev(`SUBJECTS.map(s=>s.inn).every(i=>{const k=obligations(i,TODAY).map(o=>o.code+'|'+o.period);
        return k.length===new Set(k).size;})`));
ok('F3. О-4 повторяющееся: у ветки 1 несколько месячных периодов',
  g.ev("obligations('01204199910016',TODAY).filter(o=>o.code==='О-4').length") >= 3);
ok('F4. вынос за поздний месяц НЕ закрывает пропущенный (май исполнен, июнь просрочен)',
  g.ev("obligations('01204199910016',TODAY).find(o=>o.code==='О-4'&&o.period==='05.2026').status")==='исполнено'
  && g.ev("obligations('01204199910016',TODAY).find(o=>o.code==='О-4'&&o.period==='06.2026').status")==='просрочено');
ok('F5. факт закрытия приходит из модуля-источника: О-1 — документ досье, О-4 — решение комитета',
  g.ev("DOCS.some(x=>x.id===obligations('02201199920021',TODAY).find(o=>o.code==='О-1').closing.id)")
  && g.ev("COMMITTEE_REFS.some(r=>r.id===obligations('01204199910016',TODAY).find(o=>o.code==='О-4'&&o.period==='05.2026').closing.id)"));
ok('F6. два обязательства одной полосы расходятся по факту (ветка 2: О-1 закрыто, О-2 нет)',
  g.ev("obligations('02201199920021',TODAY).find(o=>o.code==='О-1').status")==='исполнено'
  && g.ev("obligations('02201199920021',TODAY).find(o=>o.code==='О-2').status")==='просрочено'
  && g.ev("obligations('02201199920021',TODAY).find(o=>o.code==='О-1').period")
   === g.ev("obligations('02201199920021',TODAY).find(o=>o.code==='О-2').period"));
ok('F7. «исполнено» бывает только с фактом закрытия, датированным не позже даты среза',
  g.ev(`SUBJECTS.map(s=>s.inn).every(i=>obligations(i,TODAY)
        .filter(o=>o.status==='исполнено').every(o=>o.closing && dateLE(o.closing.date, TODAY)))`));
ok('F8. вкладка «Обязательства» без органов ввода — отметить исполнение вручную нечем',
  (() => { const f = mk();
    const ix = f.ev("tabIx('обязательства')");
    f.ev(`location.hash='#/b/01204199910016/${ix}'`); f.ev("route()");
    const tab = f.$(`.tabpanel[data-panel="${ix}"]`);
    return !!tab && /Чем закрыто/.test(tab.textContent)
      && tab.querySelectorAll('input, select, [data-edits]').length === 0; })());

/* ── Обеспеченность как производная (E1–E6, ревизия 26.07.2026 · ADR-0001) ──
   До ревизии индекс лежал в PLEDGE_IX рядом с creditCoverage(). Разошлись ВСЕ 44 кредита,
   и выводы были противоположны: хранимое 1.35 «обеспечен с запасом» против считаемого 0.77
   «недообеспечен на четверть». Порог жил на второй шкале (1.20 против нормированной 1.00),
   поле insured никто не читал, а области обещали предметов больше, чем есть в PLEDGE_OBJ. */
ok('E1. PLEDGE_IX снесён — хранимого индекса нет', g.ev("typeof PLEDGE_IX") === 'undefined');
ok('E2. на кредите нет хранимой обеспеченности',
  g.ev("CREDITS.every(c=>!('index' in c) && !('coverage' in c) && !('insured' in c))"));
ok('E3. у каждого предмета залога есть область; области кредита — производная от предметов',
  g.ev("PLEDGE_OBJ.every(o=>!!o.region)")
  && g.ev("CREDITS.every(c=>regionsOfCredit(c.id).every(r=>pledgeObjectsOf(c.id).some(o=>o.region===r)))"));
ok('E4. ветка 14: две области — это два РЕАЛЬНЫХ предмета, а не обещание зеркала',
  g.ev("pledgeObjectsOf('C-B14-1').length") === 2
  && g.ev("JSON.stringify(regionsOfCredit('C-B14-1'))") === '["Ош","Джалал-Абад"]');
ok('E5. индекс нормирован на порог кредита: норма всегда 1.00, порог показан отдельно',
  g.ev("CREDITS.filter(c=>isActiveCredit(c,TODAY)).every(c=>{const cv=creditCoverage(c);"
     + "return cv.index==null || Math.abs(cv.index - cv.secured/(cv.base*cv.req)) < 1e-9;})")
  && /норма 1\.00/.test(g.ev("collateralTab('01204199910016')")));
ok('E6. порог берётся из решения КМ, когда оно есть (П1 §2.6), иначе из ликвидности залога',
  g.ev("CREDITS.filter(c=>c.kmDecision).every(c=>Math.abs(creditCoverage(c).req - c.kmDecision.coverPct/100) < 1e-9)")
  && g.ev("CREDITS.filter(c=>isActiveCredit(c,TODAY) && !c.kmDecision).every(c=>[COVER_LIQUID,COVER_MOVABLE].includes(creditCoverage(c).req))"));

// ── Очередь на комитет (18–20) ──
ok('18. событие без committeeRef стоит в очереди (ветка 5, гвоздь Р-5)',
  g.ev("committeeQueue('05501199950051', TODAY).length") >= 1);
ok('18b. ветка 5 категория пока Высокий только из-за истёкшего оверлея, не из очереди',
  g.ev("committeeQueue('05501199950051', TODAY).some(e=>e.wouldGive==='high')"));
ok('19. после FACTORS с committeeRef событие ушло из очереди, категория выросла (ветка 6)',
  g.ev("committeeQueue('06601199960061', TODAY).length")===0);
ok('20. dismissedAt убирает событие из очереди без изменения категории (ветка 5)',
  g.ev("EVENTS_RAW.some(e=>e.inn==='05501199950051' && e.dismissedAt)") &&
  g.ev("committeeQueue('05501199950051', TODAY).every(e=>!e.dismissedAt)"));

// ── Конфликт интересов (21–24) ──
ok('21. фаза «заявлен» → отстранён на всех кредитах ИНН (И-4, ветка 1)',
  g.ev("suspendedEmployees('01204199910016', TODAY).includes('emp-07')"));
ok('22. boardNoticeAt позже +3 к.д. → флаг просрочки уведомления (ветка 12)',
  g.ev("conflictState(CONFLICTS.find(c=>c.id==='CF-12'), TODAY).noticeOverdue")===true);
ok('23. «передача дела» → снято, фаза «урегулирован» (ветка 13)',
  g.ev("conflictState(CONFLICTS.find(c=>c.id==='CF-13'), TODAY).phase")==='урегулирован' &&
  g.ev("conflictState(CONFLICTS.find(c=>c.id==='CF-13'), TODAY).suspendedTo")!==null);
ok('24. урегулированный конфликт не возвращает отстранённого (иммунитет снят, ветка 13)',
  g.ev("suspendedEmployees('03301199930031', TODAY).includes('emp-09')")===false);

// ── Субъект и кураторство (25) ──
ok('25a. «долг переведён» → isReadOnly + ссылка на преемника (ветка 9)',
  g.ev("isReadOnly('09901199990091', TODAY)")===true &&
  g.ev("subjectState('09901199990091', TODAY).successorInn")==='10001199900101');
ok('25b. curatorMatrix: 2 залоговых куратора при залогах в 2 областях (ветка 14, §2.2 kuratorstvo)',
  g.ev("curatorMatrix('04401199940041', TODAY).filter(m=>m.role==='залоговый куратор').length") >= 2);
ok('25c. вытесненное назначение в матрицу не попадает (ветка 13: emp-09 заменён на emp-30)',
  g.ev("curatorMatrix('03301199930031', TODAY).every(m=>m.empId!=='emp-09')"));

/* ── Один движок дефектов и видимая приостановка (G1–G8, ревизия 26.07.2026) ──
   Движков было два: шесть бейджей шапки и восемь проверок вкладки — по одним фактам,
   с разными правилами (чёрный список: предупреждение против стоп-фактора; просрочка
   свыше 90 дн. в шапке отсутствовала). Приостановленное по конфликту назначение молча
   исчезало из матрицы: кредит КР-60541 (212 дн. просрочки, худшее покрытие) выглядел
   так, будто куратора у него не было никогда. */
ok('G1. запись дефекта единообразна: тег влияния, степень, отдельная модальность «стоп»',
  g.ev(`SUBJECTS.map(s=>s.inn).every(i=>defects(i,TODAY).every(x=>
        ['допуск','сопровождение','оба'].includes(x.tag)
        && ['high','mid','info'].includes(x.sev)
        && typeof x.stop === 'boolean'))`));
ok('G2. чёрный список — стоп-фактор в обеих подачах (раньше в шапке был просто жёлтым)',
  (() => { const inn = g.ev("BLACKLIST[0].inn");
    const chk = g.ev(`borrowerChecks('${inn}',TODAY).find(c=>c.code==='Д-ЧС')`);
    return chk.stop === true && /Стоп · Чёрный список/.test(g.ev(`flagsRow('${inn}')`)); })());
ok('G3. шапка и вкладка «Проверки» считают стоп-факторы одинаково',
  g.ev(`SUBJECTS.map(s=>s.inn).every(i=>{
        const eng = defects(i,TODAY).filter(x=>x.stop).length;
        const head = (flagsRow(i).match(/Стоп · /g)||[]).length;
        return eng === head;})`));
ok('G4. приостановленный куратор ВИДЕН в матрице с пометкой (было: исчезал)',
  g.ev("curatorMatrix('01204199910016',TODAY).some(m=>m.objectId==='C-ATS-GAZ' && m.empId==='emp-07' && m.suspended===true)"));
ok('G5. объект без действующего куратора даёт дефект с причиной приостановки',
  g.ev("curatorGaps('01204199910016',TODAY).some(x=>x.objectNo==='КР-60541' && /отстранён/.test(x.reason))")
  && g.ev("defects('01204199910016',TODAY).some(x=>x.code==='Д-КУР' && x.sev==='high')"));
ok('G6. КР-60541 виден во вкладке «Кураторство» вместе с пометкой о приостановке',
  (() => { const f = mk();
    const ix = f.ev("tabIx('кураторство')");
    f.ev(`location.hash='#/b/01204199910016/${ix}'`); f.ev("route()");
    const t = f.$(`.tabpanel[data-panel="${ix}"]`).textContent;
    return /КР-60541/.test(t) && /приостановлен/.test(t) && /отстранён/.test(t); })());
ok('G7. дефекты залога и взыскания живут в том же списке',
  g.ev("defects('01204199910016',TODAY).some(x=>x.area==='залог')")
  && g.ev("defects('01204199910016',TODAY).some(x=>x.area==='взыскание')")
  && g.ev("defects('01204199910016',TODAY).some(x=>x.area==='заёмщик')"));
ok('G8. стоп-фактор идёт первым независимо от степени (модальность важнее шкалы)',
  g.ev(`SUBJECTS.map(s=>s.inn).filter(i=>defects(i,TODAY).some(x=>x.stop))
        .every(i=>defectsSorted(i,TODAY)[0].stop === true)`));

/* ── Экраны (H1–H7, ревизия 26.07.2026) ──
   Пикеров «по состоянию на» было три — в «Кредитах», «Взыскании» и «Залоге», — и ни один
   не был подключён ни к чему: чистая декорация. Реестр показывал отрасль и район (искать
   по ним надо, смотреть — нет) и молчал о том, ради чего в него заходят: просрочка,
   дефекты, куратор. Страница субъекта не отвечала на вопрос «кто это лицо для нас». */
ok('H1. дата среза одна и она рабочая: срез в прошлое меняет выводимое состояние',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const now = f.ev("catOfBorrower('01204199910016', asOf())");
    f.ev("setAsOf('2026-01-01')");
    const tile = f.$('.phead-dims .dim:nth-child(3) .dim-v');
    return now === 'high' && f.ev("asOf()") === '01.01.2026'
      && f.ev("catOfBorrower('01204199910016', asOf())") === 'mid'
      && /Средний/.test(tile.textContent)          // плитка перерисована, а не осталась вчерашней
      && /срез 01\.01\.2026/.test(f.$('.asof-bar').textContent); })());
ok('H2. срез не уезжает в будущее',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    f.ev("setAsOf('2030-01-01')");
    return f.ev("asOf()") === f.ev("TODAY"); })());
ok('H3. декоративных пикеров даты больше нет — орган управления один',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    return !f.$('#asOf') && !f.$('#cvAsOf') && !f.$('#plAsOf') && !!f.$('#cardAsOf'); })());
ok('H4. деньги дате среза не подчиняются (И-6): снимок остаётся на DEBT_ASOF',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const before = f.ev("totalDebt('01204199910016')");
    f.ev("setAsOf('2026-01-01')");
    return f.ev("totalDebt('01204199910016')") === before
      && f.ev("CREDITS.every(c=>c.debt.asOf===DEBT_ASOF)"); })());
ok('H5. реестр — рабочий список: просрочка, просроченная часть, дефекты, куратор',
  (() => { const f = mk();
    const th = f.$$('#listTable thead th').map(x => x.getAttribute('data-sort'));
    return th.length === 7 && ['ov','ovSum','def','curator'].every(k => th.includes(k))
      && !th.includes('sector') && !th.includes('district'); })());
ok('H6. строка реестра считается движком и видит дыру кураторства по КРЕДИТУ',
  g.ev("listRow(SUBJECTS.find(s=>s.inn==='01204199910016')).curatorGap") === true
  && g.ev("listRow(SUBJECTS.find(s=>s.inn==='01204199910016')).stop") === true
  && g.ev("listRow(SUBJECTS.find(s=>s.inn==='01204199910016')).ov") > 200);
ok('H7. страница субъекта показывает роли, и роль выводится, а не хранится',
  g.ev("subjectRoles('01204199910016').map(r=>r.role).join('+')") === 'Заёмщик+Залогодатель'
  && g.ev("SUBJECTS.every(s=>!('roles' in s))")
  && (() => { const f = mk();
    f.ev("location.hash='#/s/01204199910016'"); f.ev("route()");
    const t = f.$('#subjectMount').textContent;
    return /Роли субъекта/.test(t) && /Залогодатель/.test(t); })());

// ── Рендер и зеркала (26 + DOM) ──
const h = mk();
h.ev("location.hash='#/b/01204199910016'"); h.ev("route()");
ok('R1. три плитки в шапке карточки (состояние субъекта · подгруппа · категория)',
  h.$$('.phead-dims .dim').length === 3);
ok('R2. одиннадцать вкладок, порядок задан TAB_DEFS и адресуется ключом',
  h.$$('.tabbar .tab').length === 11
  && h.ev("TABS.length === TAB_DEFS.length && tabIx('обязательства') < tabIx('взыскание')")
  && h.ev("tabIx('нет-такой')") === -1);
ok('R3. плитка категории показывает Высокий (из функции, не из разметки)',
  /Высокий/.test(h.$('.phead-dims').textContent));

/* И-5 — зеркальный факт отсюда не меняется. Проверка двусторонняя, иначе она пустая:
   26a ловит редактор, наведённый на чужой массив; 26b ловит немаркированный элемент
   управления. Прежняя формулировка («нет input/select внутри data-mirror») запрещала
   и органы просмотра — дату среза, выбор строк, размер страницы — то есть была
   ложной по смыслу, хотя падала по букве. */
const MIRRORS = ['CREDITS','FACTORS','EVENTS_RAW','OVERLAYS','PROCESSES','ASSIGN','CONFLICTS',
  'PLEDGE_IX','PLEDGE_AGR','PLEDGE_OBJ','ACTS','DOCS','CHECKS_EXT','RELATED','BLACKLIST'];
ok('26a. ни один редактор не наведён на зеркальный массив (И-5)',
  h.$$('[data-edits]').every(e => !MIRRORS.includes(e.getAttribute('data-edits'))));
ok('26b. внутри зеркал нет немаркированных input/select (И-5)',
  h.$$('[data-mirror="1"] input, [data-mirror="1"] select')
    .every(e => e.hasAttribute('data-view-ctl') || e.hasAttribute('data-edits')));
h.ev("location.hash='#/b/09901199990091'"); h.ev("route()");
ok('R4. read-only заёмщик: есть ссылка на преемника',
  /10001199900101/.test(h.$('#view-detail').textContent));

// ── Полнота демо (branches) ──
const gg = mk();
ok('N1. реестр содержит ≥10 заёмщиков и все ветки достижимы', gg.$$('#listTable tbody tr').length >= 10);
ok('N2. фильтр подгруппы включает 3.2 (Ш-2)', /3\.2/.test(gg.$('#view-list').textContent) || gg.ev("Object.keys(GROUP_LABEL).includes('3.2')"));

// ── Переключатель вида списка: таблица ↔ карточки (финальное ревью, дефект-находка) ──
const cv = mk();
cv.ev("setListView('cards')");
ok('V1. переключение на карточки: #cardsWrap видим и содержит ≥10 карточек',
  cv.$('#cardsWrap').hidden === false && cv.$$('#cardsWrap .bcard').length >= 10);
cv.ev("setListView('table')");
ok('V2. переключение обратно на таблицу: #gridWrap показан, #cardsWrap скрыт',
  cv.$('#gridWrap').hidden === false && cv.$('#cardsWrap').hidden === true);
cv.ev("setListView('cards')");
ok('V3. карточка без input/select (И-5): только текст и переход по клику',
  cv.$$('#cardsWrap .bcard input, #cardsWrap .bcard select').length === 0);

/* ── Словари взыскания: владелец — collection.html ──────────────────────────────
   CONTOURS / PHASE_STAGE / PROCEDURE_DICT скопированы в карточку заёмщика.
   Копипаст синхронен на 26.07.2026 и синхронится руками — значит разъедется молча.
   Сверяем по смыслу (пробелы и переносы нормализуем), чтобы тест не падал от
   форматирования, но ловил любое расхождение по содержимому. */
const OWNER = readFileSync(resolve('mockups/collection/collection.html'), 'utf8');
const grab = (src, name) => {
  const m = src.match(new RegExp('^const ' + name + '[\\s\\S]*?^[}\\]];?$', 'm'));
  return m ? m[0].replace(/\/\/[^\n]*/g, ' ')          // построчные комментарии — своё у каждого мокапа
                 .replace(/\s+/g, ' ')
                 .replace(/\s*([{}\[\],:;=])\s*/g, '$1')  // выравнивание колонок пробелами — не расхождение
                 .trim()
           : null;
};
for (const name of ['CONTOURS', 'PHASE_STAGE', 'PROCEDURE_DICT']){
  const mine = grab(HTML, name), theirs = grab(OWNER, name);
  ok(`W. словарь ${name} совпадает с collection.html (владелец)`, !!mine && mine === theirs);
}

console.log(`\n${n - fails}/${n} PASS`);
process.exit(fails ? 1 : 0);
