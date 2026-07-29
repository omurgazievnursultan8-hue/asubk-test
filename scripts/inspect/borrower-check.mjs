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
/* СП-11: реестр листается, поэтому строк на экране — не больше размера страницы, а счётчик
   печатает «1–N из K». Раньше рисовались все строки, а стрелки были декорацией. */
ok('S5. реестр листается: строк на странице ≤ pgSize, счётчик знает общее число',
  g.$$('#listTable tbody tr').length === Math.min(g.ev("pgSize"), g.ev("SUBJECTS.length")) &&
  new RegExp('^1–\\d+ из ' + g.ev("SUBJECTS.length") + '$').test(g.$('#rowCount').textContent));
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
/* Носителя банкротства ищем в наборе, а не адресуем ИНН: у сидовых субъектов ИНН собирается
   по индексу. Заодно проверяем, что носитель — лицо, которое банкротом быть МОЖЕТ (И-13). */
const bankruptInn = g.ev("(SUBJECTS.find(s=>subgroupOf(s.inn,TODAY)==='3.2')||{}).inn");
ok('10. терминал «банкротство завершено» → 3.2 (Ш-2)',
  !!bankruptInn && g.ev(`subgroupOf('${bankruptInn}', TODAY)`)==='3.2' &&
  g.ev(`bankruptcyCapable((SUBJECTS.find(s=>s.inn==='${bankruptInn}')||{}).personKind)`));
/* Б-24: до 28.07.2026 этот терминал стоял на физлице — по Закону КР о банкротстве оно должником
   быть не может (ст.1 п.2, ст.2). Терминал умершего заёмщика — 4 «безнадёжные». */
ok('10б. терминал физлица — 4 «безнадёжные долги», а не банкротство (И-13, Б-24)',
  g.ev("subgroupOf('07701199970071', TODAY)")==='4' &&
  g.ev("SUBJECTS.find(s=>s.inn==='07701199970071').personKind")==='физ');
ok('10в. И-13: банкротная ступень, событие и контур К6 — только у юрлица и ИП',
  g.ev(`SUBJECTS.filter(s=>!bankruptcyCapable(s.personKind))
          .every(s=>!BANKRUPT_SUBS.has(subgroupOf(s.inn,TODAY)))`) &&
  g.ev(`BORROWER_EVENTS.filter(e=>e.kind==='завершено банкротство')
          .every(e=>bankruptcyCapable((SUBJECTS.find(s=>s.inn===e.inn)||{}).personKind))`) &&
  g.ev(`PROCESSES.filter(p=>p.contour==='К6').every(p=>{
          const inn = (CREDITS.find(c=>c.id===p.credits[0])||{}).inn;
          return bankruptcyCapable((SUBJECTS.find(s=>s.inn===inn)||{}).personKind); })`));
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
/* СП-7: вне лестницы группы нет — groupOf() отдаёт null, а не первую букву слова 'none'. */
ok('C3. группа — верхний уровень подгруппы (1…5), вне лестницы null',
  g.ev(`SUBJECTS.every(s=>{ const sub=subgroupOf(s.inn,TODAY), grp=groupOf(s.inn,TODAY);
        return NO_LADDER.has(sub) ? grp===null : grp===sub[0]; })`) &&
  g.ev("groupOf('06601199960061',TODAY)")==='2');
ok('C4. база 1.2 выводится из просрочки, а не из записи мониторинга',
  g.ev("subgroupOf('02201199920021', TODAY)")==='1.2' &&
  g.ev("CREDITS.some(c=>c.inn==='02201199920021' && isActiveCredit(c,TODAY) && overdueDaysOn(c,TODAY)>0)"));
ok('C5. просрочка без подтверждённой процедуры не даёт 1.1 (дефект прежней базы)',
  g.ev(`SUBJECTS.map(s=>s.inn)
        .filter(i=>CREDITS.some(c=>c.inn===i && isActiveCredit(c,TODAY) && overdueDaysOn(c,TODAY)>0))
        .every(i=>subgroupOf(i,TODAY)!=='1.1')`));
/* СП-3: один селект на два уровня — код без точки означает «вся группа». */
ok('C7. фильтр реестра по ГРУППЕ отбирает все её подгруппы',
  (() => { const f = mk();
    f.doc.getElementById('f-grp').value = '2';
    f.ev("pgSize = 1000; applyFilter();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>groupOf(s.inn,TODAY)==='2').length");
    return shown === want && shown > 0; })());
ok('C8. фильтр по ПОДГРУППЕ отбирает только её (два уровня в одном поле)',
  (() => { const f = mk();
    f.doc.getElementById('f-grp').value = '2.1';
    f.ev("pgSize = 1000; applyFilter();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>subgroupOf(s.inn,TODAY)==='2.1').length");
    return shown === want && shown > 0; })());
/* СП-3: прежние два поля позволяли выразить «группа 1 + подгруппа 2.1» — всегда пустой
   результат. Одно поле делает такую комбинацию невыразимой. */
ok('C9. противоречивую комбинацию группа+подгруппа выразить нечем (одно поле)',
  g.ev("typeof document.getElementById('f-group')") === 'object' &&
  g.ev("document.getElementById('f-group') === null && document.getElementById('f-sub') === null") &&
  g.ev("FIELDS.filter(f=>f.key==='grp').length") === 1);
ok('C6. подгруппа историчная: до заключения комиссии заёмщик не в 4',
  g.ev("subgroupOf('07701199970071','01.05.2025')")!=='4' &&
  g.ev("subgroupOf('07701199970071',TODAY)")==='4');

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
ok('16. просроченное О-1 → статус «срок вышел» (ветка 4)',
  g.ev("obligations('04401199940041', TODAY).find(o=>o.code==='О-1').status")==='срок вышел');
ok('17. О-4 при наличии просроченной задолженности (ветка 1)',
  /О-4/.test(codes('01204199910016')));

// ── Долг и обеспеченность (D1–D3) ──
ok('D1. totalDebt = сумма 5 статей по действующим (ветка 1)',
  g.ev("totalDebt('01204199910016')") === 5200000+130000 + 9400000+410000+88000 + 1100000+20000);
/* КЗ-23: средневзвешенный индекс удалён — усреднять нормированные на РАЗНЫЕ пороги величины
   нечем и незачем. Осталось два выводимых ответа: где хуже всего (с именем кредита) и
   сколько порогов нарушено из скольких оценённых. */
ok('D3. coverageOf — зеркало индекса: worst принадлежит конкретному кредиту (ветка 1)',
  (() => { const cv = g.ev("coverageOf('01204199910016')");
    const idx = g.ev(`creditCoverage(CREDITS.find(c=>c.id==='${cv.worstId}')).index`);
    return !!cv.worstId && Math.abs(idx - cv.worst) < 1e-9
      && g.ev("CREDITS.filter(c=>c.inn==='01204199910016' && isActiveCredit(c, DEBT_ASOF))"
            + ".map(c=>creditCoverage(c).index).filter(x=>x!=null)")
           .every(x => x >= cv.worst - 1e-9); })());

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
  && g.ev("obligations('01204199910016',TODAY).find(o=>o.code==='О-4'&&o.period==='06.2026').status")==='срок вышел');
ok('F5. факт закрытия приходит из модуля-источника: О-1 — документ досье, О-4 — решение комитета',
  g.ev("DOCS.some(x=>x.id===obligations('02201199920021',TODAY).find(o=>o.code==='О-1').closing.id)")
  && g.ev("COMMITTEE_REFS.some(r=>r.id===obligations('01204199910016',TODAY).find(o=>o.code==='О-4'&&o.period==='05.2026').closing.id)"));
ok('F6. два обязательства одной полосы расходятся по факту (ветка 2: О-1 закрыто, О-2 нет)',
  g.ev("obligations('02201199920021',TODAY).find(o=>o.code==='О-1').status")==='исполнено'
  && g.ev("obligations('02201199920021',TODAY).find(o=>o.code==='О-2').status")==='срок вышел'
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
  g.ev("defects('01204199910016',TODAY).some(x=>x.area==='обеспечение')")
  && g.ev("defects('01204199910016',TODAY).some(x=>x.area==='взыскание')")
  && g.ev("defects('01204199910016',TODAY).some(x=>x.area==='заёмщик')"));
ok('G8. стоп-фактор идёт первым независимо от степени (модальность важнее шкалы)',
  g.ev(`SUBJECTS.map(s=>s.inn).filter(i=>defects(i,TODAY).some(x=>x.stop))
        .every(i=>defectsSorted(i,TODAY)[0].stop === true)`));

/* ── Экраны (H1–H7, ревизия 26.07.2026) ──
   Пикеров «по состоянию на» было три — в «Кредитах», «Взыскании» и «Залоге», — и ни один
   не был подключён ни к чему: чистая декорация. Реестр показывал отрасль и район (искать
   по ним надо, смотреть — нет) и молчал о том, ради чего в него заходят: просрочка,
   дефекты, куратор. СБ-14: страницы субъекта в этом макете больше нет — её держит
   mockups/subject/subject.html, поэтому H7 проверяет только движок ролей, который здесь
   остался живым (found-box формы создания и блокировки удаления). */
ok('H1. дата среза одна и она рабочая: срез в прошлое меняет выводимое состояние',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const now = f.ev("catOfBorrower('01204199910016', asOf())");
    f.ev("setAsOf('2026-01-01')");
    const tile = f.$('.phead-dims .dim:nth-child(2) .dim-v');   // КЗ-4: плиток две, категория — вторая
    return now === 'high' && f.ev("asOf()") === '01.01.2026'
      && f.ev("catOfBorrower('01204199910016', asOf())") === 'mid'
      && /Средний/.test(tile.textContent)          // плитка перерисована, а не осталась вчерашней
      && /Срез 01\.01\.2026/.test(f.$('.asof-bar').textContent); })());
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
/* Колонок стало 8: «Задолженность» добавлена по СП-12 — без масштаба одинаковые дни просрочки
   у 900 тыс и у 17 млн читались одинаково. Отрасль и район остались только условиями фильтра. */
ok('H5. реестр — рабочий список: просрочка, просроченная часть, задолженность, дефекты, куратор',
  (() => { const f = mk();
    const th = f.$$('#listTable thead th').map(x => x.getAttribute('data-sort'));
    return th.length === 8 && ['ov','ovSum','debt','def','curator'].every(k => th.includes(k))
      && !th.includes('sector') && !th.includes('district'); })());
ok('H6. строка реестра считается движком и видит дыру кураторства по КРЕДИТУ',
  g.ev("listRow(SUBJECTS.find(s=>s.inn==='01204199910016')).curatorGap") === true
  && g.ev("listRow(SUBJECTS.find(s=>s.inn==='01204199910016')).stop") === true
  && g.ev("listRow(SUBJECTS.find(s=>s.inn==='01204199910016')).ov") > 200);
/* H7: экранную половину («страница субъекта показывает роли») удалили вместе с экраном —
   владелец страницы теперь mockups/subject/subject.html. Движок ролей остался живым кодом:
   его читают foundHtml (СП-16/17) и deleteBlockers (СП-19), поэтому проверка остаётся. */
ok('H7. роль выводится из участия, а не хранится полем (ADR-0001)',
  g.ev("subjectRoles('01204199910016').map(r=>r.role).join('+')") === 'Заёмщик+Залогодатель'
  && g.ev("SUBJECTS.every(s=>!('roles' in s))"));

// ── Рендер и зеркала (26 + DOM) ──
const h = mk();
h.ev("location.hash='#/b/01204199910016'"); h.ev("route()");
ok('R1. две плитки в шапке карточки (подгруппа · категория) — КЗ-4',
  h.$$('.phead-dims .dim').length === 2);
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

/* ── Экран списка: решения СП-1…СП-13 (сессия-гриллинг 26.07.2026; СП-14 и СП-20
   отменены 27.07.2026 — полоса двух дат и плашки рабочих списков сняты) ────────
   Дом решений — mockups/borrower/ASUBK-status-razrabotki.md. Карточный вид (прежние V1–V3)
   снят по СП-10: сортировка в нём была недоступна (заголовки скрыты), сетка карточек ломала
   сравнение чисел между строками, и два рендерера уже разошлись по составу полей. */
const L = mk();
ok('СП-10. карточного вида и переключателя в реестре нет',
  L.$('#cardsWrap') === null && L.$('#segCards') === null &&
  L.ev("typeof renderCards") === 'undefined' && L.ev("typeof listView") === 'undefined');
ok('СП-2. поиск — один инпут в тулбаре, вне свёрнутой панели фильтра',
  L.$('#f-q') !== null && L.$('.jt #f-q') !== null &&
  L.$('#f-name') === null && L.$('#f-inn') === null);
ok('СП-2. поиск работает по ИЛИ: ИНН находит ту же запись, что и наименование',
  (() => { const f = mk(); f.ev("pgSize = 1000;");
    const inn = f.ev("SUBJECTS[0].inn"), name = f.ev("SUBJECTS[0].name");
    f.doc.getElementById('f-q').value = inn; f.ev("applyFilter();");
    const byInn = f.$$('#listTable tbody tr').length;
    f.doc.getElementById('f-q').value = name; f.ev("applyFilter();");
    const byName = f.$$('#listTable tbody tr').length;
    return byInn === 1 && byName >= 1; })());
ok('СП-4. бейдж числа активных условий появляется и считает без поиска',
  (() => { const f = mk();
    if (!f.$('#jfCount').hidden) return false;
    f.doc.getElementById('f-q').value = '1'; f.ev("applyFilter();");
    if (!f.$('#jfCount').hidden) return false;          // поиск в счёт не идёт
    f.doc.getElementById('f-cat').value = 'Высокий'; f.ev("applyFilter();");
    return f.$('#jfCount').hidden === false && f.$('#jfCount').textContent === '1'; })());
ok('СП-4. категория «не применяется» отбирается фильтром',
  (() => { const f = mk(); f.ev("pgSize = 1000;");
    f.doc.getElementById('f-cat').value = f.ev("CAT_NA"); f.ev("applyFilter();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>!catOfBorrower(s.inn,TODAY)).length");
    return shown === want && shown > 0; })());
ok('СП-4. фильтр «без куратора» отбирает только записи с дырой',
  (() => { const f = mk(); f.ev("pgSize = 1000;");
    f.doc.getElementById('f-curator').value = f.ev("CURATOR_NONE"); f.ev("applyFilter();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>listRow(s).curatorGap).length");
    return shown === want && shown > 0; })());
ok('СП-4. диапазон дней просрочки «от—до» режет по границам включительно',
  (() => { const f = mk(); f.ev("pgSize = 1000;");
    f.doc.getElementById('f-ovFrom').value = '90';
    f.doc.getElementById('f-ovTo').value = '220';
    f.ev("applyFilter();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>{const o=listRow(s).ov; return o>=90 && o<=220;}).length");
    return shown === want && shown > 0; })());
ok('СП-4. фильтр дефектов «есть стоп» отбирает только блокирующие',
  (() => { const f = mk(); f.ev("pgSize = 1000;");
    f.doc.getElementById('f-def').value = 'stop'; f.ev("applyFilter();");
    const shown = f.$$('#listTable tbody tr').length;
    const want = f.ev("SUBJECTS.filter(s=>listRow(s).stop).length");
    return shown === want; })());
ok('СП-5. каскад: области и районы построены ИЗ ДАННЫХ, район сужается областью',
  (() => { const f = mk();
    const regs = f.$$('#f-region option').map(o => o.value).filter(Boolean);
    const want = f.ev("[...new Set(SUBJECTS.map(s=>REGION_OF[s.district]).filter(Boolean))]");
    if (regs.length !== want.length || !regs.every(r => want.includes(r))) return false;
    f.doc.getElementById('f-region').value = 'Чуй';
    f.ev("fillDistricts();");
    const ds = f.$$('#f-district option').map(o => o.value).filter(Boolean);
    return ds.length > 0 && ds.every(d => f.ev(`REGION_OF['${d}']`) === 'Чуй'); })());
ok('СП-5. метки панели без Jmix-синтаксиса («Субъект.» и «=» убраны)',
  L.$$('#jf .jf-label').every(el => !/Субъект\.|=\s*$/.test(el.textContent.trim())));
/* СП-7: прежняя база выдавала заёмщику без кредитов «1.1 Производят погашение по графику». */
/* Проверяется на РЕАЛЬНОЙ записи набора (предрегистрация, СП-6), а не на выдуманном ИНН:
   иначе ветка проходит тест, но в макете её никто не увидит. */
ok('СП-7. заёмщик без кредитов → «Кредитов не было», а не 1.1',
  g.ev("CREDITS.some(c=>c.inn==='11101199900111')") === false &&
  g.ev("subgroupOf('11101199900111', TODAY)") === 'none' &&
  g.ev("SUBGROUP_LABEL['none']") === 'Кредитов не было' &&
  g.ev("groupOf('11101199900111', TODAY)") === null &&
  g.ev("catOfBorrower('11101199900111', TODAY)") === null);
ok('СП-7. все кредиты закрыты без терминала → «Нет действующих», а не 1.1',
  (() => {
    const inns = g.ev(`SUBJECTS.map(s=>s.inn).filter(i=>
      CREDITS.some(c=>c.inn===i) && !CREDITS.some(c=>c.inn===i && isActiveCredit(c,TODAY)))`);
    if (!inns.length) return false;
    const subs = inns.map(i => g.ev(`subgroupOf('${i}', TODAY)`));
    return subs.some(s => s === 'closed') && subs.every(s => s !== '1.1');
  })());
ok('СП-7. оба состояния вне лестницы отбираются фильтром',
  L.$$('#f-grp option').map(o => o.value).includes('none') &&
  L.$$('#f-grp option').map(o => o.value).includes('closed'));
ok('СП-8. кнопки «Открыть» нет, строка открывается с клавиатуры',
  L.$('#tbOpen') === null &&
  L.$$('#listTable tbody tr').every(tr => tr.getAttribute('tabindex') === '0'));
ok('СП-11. пагинация рабочая: страница листается, счётчик пересчитывается',
  (() => { const f = mk();
    f.ev("pgSize = 10; pgPage = 1; renderList();");
    const first = f.$$('#listTable tbody tr').map(tr => tr.dataset.inn);
    const c1 = f.$('#rowCount').textContent;
    f.ev("gotoPage(2);");
    const second = f.$$('#listTable tbody tr').map(tr => tr.dataset.inn);
    const c2 = f.$('#rowCount').textContent;
    return first.length === 10 && second.length > 0 && c1 !== c2 &&
      !second.some(i => first.includes(i)) && /^11–/.test(c2); })());
ok('СП-11. на первой странице «назад» погашено, на последней — «вперёд»',
  (() => { const f = mk();
    f.ev("pgSize = 10; pgPage = 1; renderList();");
    if (!f.$('#pgPrev').classList.contains('dis') || f.$('#pgNext').classList.contains('dis')) return false;
    f.ev("gotoPage(pageCount(visibleSubjects().length));");
    return f.$('#pgNext').classList.contains('dis') && !f.$('#pgPrev').classList.contains('dis'); })());
/* СП-25 (27.07.2026): набор размеров страницы — 5 / 20 / 50, по умолчанию 20. Один набор
   на оба пейджера модуля: реестр (#pgSize) и таблица кредитов в карточке (#crSize), где
   раньше стояли 25/50/100 и 10/25/50/100 — две разные шкалы на одном экране. */
ok('СП-25. реестр: размеры страницы 5 / 20 / 50, выбрано 20',
  (() => { const f = mk();
    const opts = f.$$('#pgSize option').map(o => o.value);
    return opts.join(',') === '5,20,50' && f.$('#pgSize').value === '20' && f.ev("pgSize") === 20; })());
ok('СП-25. смена размера в реестре сбрасывает на первую страницу и режет выборку',
  (() => { const f = mk();
    f.ev("pgSize = 20; pgPage = 3; renderList();");
    const sel = f.$('#pgSize'); sel.value = '5';
    sel.dispatchEvent(new f.w.Event('change'));
    return f.ev("pgSize") === 5 && f.ev("pgPage") === 1 &&
      f.$$('#listTable tbody tr').length === 5 && /^1–5 из /.test(f.$('#rowCount').textContent); })());
ok('СП-25. карточка: тот же набор в пейджере кредитов, по умолчанию 20',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const sel = f.$('#crSize');
    if (!sel) return false;
    return f.$$('#crSize option').map(o => o.textContent).join(',') === '5,20,50' && sel.value === '20'; })());
ok('СП-12. под наименованием ИНН, а не «отрасль · район»',
  (() => {
    const tds = L.$$('#listTable tbody tr td.who');
    if (!tds.length) return false;
    return tds.every(td => /ИНН \d+/.test(td.textContent)) &&
      tds.every(td => { const inn = td.closest('tr').dataset.inn;
        const s = L.ev(`SUBJECTS.find(x=>x.inn==='${inn}')`);
        return !td.textContent.includes(s.industry); }); })());
ok('СП-12. колонка «Задолженность» есть и равна totalDebt',
  L.$$('#listTable thead th').some(th => th.dataset.sort === 'debt') &&
  L.ev("SUBJECTS.every(s=>listRow(s).debt === totalDebt(s.inn))"));
ok('СП-12. куратор: фамилия не подавляется дырой, дыра — отдельным бейджем',
  (() => {
    const both = L.ev(`SUBJECTS.map(s=>listRow(s)).filter(r=>r.curatorGap && r.curatorNames.length)`);
    if (!both.length) return false;                       // в наборе есть «и куратор, и дыра»
    return both.every(r => r.curator !== '—' && !/нет по/.test(r.curator)); })());
ok('СП-12. подгруппа в реестре — короткая подпись, полная в title',
  (() => {
    const cell = L.$('#listTable tbody tr .grp-badge');
    if (!cell) return false;
    const code = cell.querySelector('.grp-code');
    const full = L.ev(`SUBGROUP_LABEL['${code ? code.textContent : ''}']`);
    return cell.getAttribute('title') === full && cell.textContent.trim().length < full.length; })());
/* СП-13: «стоп» — модальность, а не степень (И-8); приём «+1000» кладёт её на числовую шкалу. */
ok('СП-13. сортировка дефектов — составной ключ, без «+1000»',
  (() => {
    const v = L.ev(`(function(){ const s=SUBJECTS.find(x=>listRow(x).stop);
      return s ? sortVal({s, r:listRow(s)}, 'def') : null; })()`);
    return Array.isArray(v) && v.length === 3 && v[0] === 1; })());
ok('СП-13. ячейка дефектов подписывает степень текстом, не только цветом',
  (() => {
    const s = L.ev(`SUBJECTS.find(x=>listRow(x).high>0)`);
    if (!s) return false;
    const html = L.ev(`defCell(listRow(SUBJECTS.find(x=>x.inn==='${s.inn}')))`);
    return /\d+в<\/span>/.test(html); })());
ok('СП-9. экспорт есть и оттиск собирается с условиями и обеими датами',
  L.$('#tbExport') !== null && L.ev("typeof exportRows") === 'function');

/* ── Экран списка: решения СП-15…СП-21 (продолжение гриллинга, ОВ-7…ОВ-12) ──────── */

/* СП-15: типовой конструктор условий Jmix убран — оба контрола были без обработчиков,
   а произвольная пара условий возвращает дефект, погашенный СП-3 структурно. */
/* Сверяем по отрендеренному тексту и составу кнопок, а не по innerHTML: в разметке остался
   комментарий с причиной удаления, и он законно содержит прежние подписи. */
ok('СП-15. мёртвых контролов панели фильтра нет',
  L.$('#fAddCond') === null &&
  L.$$('.jf-actions .btn-icon').length === 0 &&
  !/Условие поиска|Настройки фильтра/.test(L.$('.jf').textContent) &&
  L.$$('.jf-actions button').every(b => /Обновить|Сбросить/.test(b.textContent)));

/* СП-16: панель стартует свёрнутой, поэтому пустое состояние обязано само назвать условия. */
/* Условия подбираются от данных, а не вписываются: подпись области в сиде — «Нарын», и
   выдуманное «Нарынская» просто не попало бы ни в одну опцию, оставив селект пустым.
   Прежняя редакция теста из-за этого проходила вхолостую — сверяем, что строк реально ноль. */
ok('СП-16. пустое состояние называет активные условия человеческими метками',
  (() => { const f = mk();
    const reg = f.ev("[...document.getElementById('f-region').options].map(o=>o.value).filter(Boolean)[0]");
    f.doc.getElementById('f-region').value = reg;
    f.doc.getElementById('f-grp').value = 'none';        // «Кредитов не было» — есть ровно одна такая запись
    f.doc.getElementById('f-def').value = 'stop';        // и дефектов у неё быть не может
    f.ev("fillDistricts(); applyFilter();");
    const em = f.$('#listEmpty');
    const t = em.textContent;
    return f.$$('#listTable tbody tr').length === 0 && !em.hidden
      && t.includes('Область') && t.includes(reg)
      && t.includes('Классификатор') && t.includes('Кредитов не было')
      && t.includes('Дефекты') && t.includes('есть стоп')
      && !/\bstop\b|\bnone\b/.test(t);                   // кодов наружу нет
  })());
ok('СП-16. пустое состояние даёт сброс, и сброс чистит в том числе поиск',
  (() => { const f = mk();
    f.doc.getElementById('f-q').value = 'заведомо-нет-такого';
    f.doc.getElementById('f-cat').value = 'Высокий';
    f.ev("applyFilter();");
    const em = f.$('#listEmpty');
    if (em.hidden || !em.querySelector('button')) return false;
    f.ev("resetFilter();");
    return f.doc.getElementById('f-q').value === ''
      && f.doc.getElementById('f-cat').value === ''
      && f.ev("Object.keys(active).length") === 0
      && f.$('#listEmpty').hidden === true;
  })());
ok('СП-16. без условий пустое состояние не врёт про фильтр',
  L.ev("Object.keys(active).length") === 0 && !/услови/i.test(L.ev("renderEmpty()")));

/* СП-17: ИНН — единственный вход, ветка выбирается по нему. Дубль ИНН невозможен формой. */
ok('СП-17. «+ Добавить заёмщика» открывает форму, и она начинается с ИНН',
  (() => { const f = mk();
    if (!f.$('#mBack').hidden) return false;
    f.ev("openCreate();");
    return !f.$('#mBack').hidden && f.$('#cInn') !== null && f.$('#cStage').innerHTML === '';
  })());
ok('СП-17. существующий ИНН → реквизиты и переход в карточку, полей создания нет',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = f.ev("SUBJECTS[0].inn");
    el.dispatchEvent(new f.w.Event('input'));
    return f.$('.found-box') !== null && f.$('#cKind') === null
      && f.$('#mFoot').textContent.includes('Открыть карточку')
      && f.$('.found-box').textContent.includes(f.ev("SUBJECTS[0].name"));
  })());
ok('СП-17. неизвестный ИНН → поля создания субъекта',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '99999999999999';
    el.dispatchEvent(new f.w.Event('input'));
    return f.$('#cKind') !== null && f.$('.found-box') === null && f.$('#mCreate') !== null;
  })());
ok('СП-17. неполный ИНН не показывает ни одну из ветвей',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '112'; el.dispatchEvent(new f.w.Event('input'));
    return f.$('#cStage').innerHTML === '' && f.$('#cInnErr').textContent.includes('11');
  })());
ok('СП-17. ИНН принимает только цифры и только 14',
  L.ev("innShape('11101199900111')") === true &&
  L.ev("innShape('1110119990011')") === false &&
  L.ev("innShape('1110119990011a')") === false &&
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = 'abc123-456'; el.dispatchEvent(new f.w.Event('input'));
    return el.value === '123456'; })());

/* СП-18: обязательны ровно те поля, без которых запись выпадает из фильтров реестра. */
ok('СП-18. «Создать» заперта, пока обязательные поля пусты, и открывается их заполнением',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '99999999999999'; el.dispatchEvent(new f.w.Event('input'));
    if (!f.$('#mCreate').disabled) return false;
    f.ev("CREATE_REQ").forEach(id => {
      const x = f.doc.getElementById(id);
      x.value = x.tagName === 'SELECT' ? [...x.options].filter(o => o.value)[0].value
              : (x.type === 'date' ? '2026-01-15' : 'тест');
    });
    f.ev("validateCreate();");
    return f.$('#mCreate').disabled === false;
  })());
/* I4 (ревью 29.07.2026): проверка «орг-форма показана только юр. лицу» УДАЛЕНА — предмета
   не осталось. Поля cLegal/cLegalWrap в форме больше нет: legalForm читала только удалённая
   страница субъекта, после СБ-14 читателей у него ноль. Ослаблять было нечего — экрана,
   на котором орг-форма появлялась бы, в этом макете не существует. Организационная форма —
   реквизит лица, её заводит владелец (mockups/subject/subject.html). */
ok('СП-18. необязательный реквизит — во втором, свёрнутом уровне',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '99999999999999'; el.dispatchEvent(new f.w.Event('input'));
    const d = f.$('.fsect');
    /* прежде здесь назывались cAddrL/cAddrF — оба убраны вместе с читателями (I4);
       утверждение то же: необязательное лежит на втором уровне и в CREATE_REQ не входит */
    return d !== null && d.hasAttribute('open') === false
      && f.$('#cNote') !== null
      && f.ev("CREATE_REQ.includes('cNote')") === false;
  })());
/* I4: форма собирала вид документа, номер, дату документа и дату регистрации — все четыре
   ОБЯЗАТЕЛЬНЫМИ, — плюс форму собственности, орг-форму и два адреса. После схлопывания вида
   субъекта читателей у них не осталось ни одного: показывала их только удалённая страница
   лица. Оператор обязан был заполнить поля, след от которых нигде не виден — та же болезнь,
   что молчащая кнопка (Б-9).
   Сверяем РАВЕНСТВОМ набора ключей, а не «включает»: при «включает» возврат doc{} или
   regDate прошёл бы молча, а именно это и надо поймать. Обе стороны: осиротевшее не
   вернулось И нужное не потерялось. */
ok('СП-18/I4. форма не спрашивает того, чего не покажет; запись содержит ровно собранное',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '99999999999999'; el.dispatchEvent(new f.w.Event('input'));
    const orphans = ['cDocKind','cDocNo','cDocDate','cRegDate','cOwn','cAddrL','cAddrF','cLegal','cLegalWrap'];
    if (orphans.some(id => f.doc.getElementById(id))) return false;
    if (f.ev("JSON.stringify(CREATE_REQ)") !== JSON.stringify(['cKind','cName','cSector','cDistrict'])) return false;
    const set = (id, v) => { f.doc.getElementById(id).value = v; };
    set('cKind','Юр. лицо'); set('cName','ОсОО «Смоук Тест»');
    set('cSector', f.ev("SUBJECTS[0].industry")); set('cDistrict', f.ev("SUBJECTS[0].district"));
    set('cNote','заметка смоука');
    f.ev("validateCreate(); submitCreate();");
    const keys = JSON.parse(f.ev(
      "JSON.stringify(Object.keys(SUBJECTS.find(s=>s.inn==='99999999999999')).sort())"));
    return String(keys) === String(['audit','district','industry','inn','name','note','personKind']);
  })());
/* Вторая половина того же утверждения: у каждого сохранённого поля есть ЧИТАТЕЛЬ, то есть
   значение видно на экране. Равенство ключей выше запрещает лишнее; это — запрещает мёртвое. */
ok('СП-18/I4. каждое сохранённое поле новой записи видно в карточке (читатель есть)',
  (() => { const f = mk(); f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '99999999999999'; el.dispatchEvent(new f.w.Event('input'));
    const set = (id, v) => { f.doc.getElementById(id).value = v; };
    const sector = f.ev("SUBJECTS[0].industry"), district = f.ev("SUBJECTS[0].district");
    set('cKind','Физ. лицо'); set('cName','Смоуков Тест Тестович');
    set('cSector', sector); set('cDistrict', district); set('cNote','заметка смоука');
    f.ev("validateCreate(); submitCreate();");
    f.ev("location.hash='#/b/99999999999999'"); f.ev("route()");
    const t = f.$('#cardMount').textContent.replace(/\s+/g, ' ');
    if (!(t.includes('Смоуков Тест Тестович') && t.includes('99999999999999')
          && t.includes(sector) && t.includes('заметка смоука')
          /* audit — читает лента (historyItems), КЗ-9: аудит записи стал фактом ленты */
          && t.includes('Карточка заёмщика заведена'))) return false;
    /* район читает переход в реестр (СП-5) и found-box формы: сверяем через found-box.
       I-1 (ревью 29.07.2026): personKind переехал сюда же. Шапка карточки его больше не
       печатает — тип лица величина владельца (subject.html, personKindAt на дату), а здесь
       поле хранимое. Читатели у него остались: колонка реестра, выгрузка и вот этот
       found-box. Утверждение «у каждого сохранённого поля есть читатель» тем самым не
       ослаблено — оно проверяется у настоящего читателя, ровно как уже сделано для района. */
    f.ev("openCreate();");
    const el2 = f.doc.getElementById('cInn');
    el2.value = '99999999999999'; el2.dispatchEvent(new f.w.Event('input'));
    const fb = f.$('.found-box').textContent;
    return fb.includes(district) && fb.includes('Физ. лицо'); })());
ok('СП-18. созданная запись попадает в реестр и находится фильтрами (иначе её нет)',
  (() => { const f = mk(); f.ev("pgSize = 1000;");
    const before = f.ev("SUBJECTS.length");
    f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = '99999999999999'; el.dispatchEvent(new f.w.Event('input'));
    const set = (id, v) => { f.doc.getElementById(id).value = v; };
    set('cKind', 'Юр. лицо'); set('cName', 'ОсОО «Смоук Тест»');
    set('cSector', f.ev("SUBJECTS[0].industry")); set('cDistrict', f.ev("SUBJECTS[0].district"));
    f.ev("validateCreate();");   /* I4: полей документа и даты регистрации форма больше не собирает */
    f.ev("submitCreate();");
    if (f.ev("SUBJECTS.length") !== before + 1) return false;
    if (!f.$('#mBack').hidden) return false;
    /* без кредитов — предрегистрация, СП-7 */
    if (f.ev("subgroupOf('99999999999999', TODAY)") !== 'none') return false;
    f.ev("location.hash='#/'; route();");
    f.doc.getElementById('f-q').value = '99999999999999';
    f.ev("applyFilter();");
    return f.$$('#listTable tbody tr').length === 1;
  })());
ok('СП-18. дубль ИНН формой недостижим: submitCreate на существующем ИНН ничего не добавляет',
  (() => { const f = mk();
    const before = f.ev("SUBJECTS.length");
    f.ev("openCreate();");
    const el = f.doc.getElementById('cInn');
    el.value = f.ev("SUBJECTS[0].inn"); el.dispatchEvent(new f.w.Event('input'));
    f.ev("submitCreate();");
    return f.ev("SUBJECTS.length") === before;
  })());

/* СП-19: удаляется субъект, не роль — роль не хранится (ADR-0001), удалять нечем. */
ok('СП-19. удаление живёт в карточке, а не в списке (чекбоксов после СП-8 нет)',
  (() => { const f = mk();
    if (/Удалить/.test(f.$('.jt').textContent)) return false;
    if (f.$$('#listTable input[type=checkbox]').length) return false;
    f.ev("location.hash='#/b/01204199910016'; route();");
    return /Удалить запись/.test(f.$('#cardMount').textContent);
  })());
ok('СП-19. с кредитами кнопка заперта и причина названа до нажатия',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'; route();");
    const b = [...f.$$('#cardMount button')].find(x => /Удалить запись/.test(x.textContent));
    return b && b.disabled === true && /заёмщик/i.test(b.title)
      && f.ev("deleteBlockers('01204199910016').length") > 0;
  })());
ok('СП-19. у предрегистрации связей нет — кнопка активна',
  (() => { const f = mk();
    if (f.ev("deleteBlockers('11101199900111').length") !== 0) return false;
    f.ev("location.hash='#/b/11101199900111'; route();");
    const b = [...f.$$('#cardMount button')].find(x => /Удалить запись/.test(x.textContent));
    return b && b.disabled === false;
  })());
ok('СП-19. подтверждение называет ИНН и наименование',
  (() => { const f = mk();
    f.ev("askDelete('11101199900111');");
    const t = f.$('#mBody').textContent;
    return !f.$('#mBack').hidden && t.includes('11101199900111') && /Нарын Агро Плюс/.test(t)
      && /Удалить/.test(f.$('#mFoot').textContent);
  })());
ok('СП-19. удаление проходит только для записи без связей',
  (() => { const f = mk();
    const before = f.ev("SUBJECTS.length");
    f.ev("doDelete('01204199910016');");                     // с кредитами — отказ
    if (f.ev("SUBJECTS.length") !== before) return false;
    f.ev("doDelete('11101199900111');");                     // предрегистрация — можно
    return f.ev("SUBJECTS.length") === before - 1
      && f.ev("SUBJECTS.some(s=>s.inn==='11101199900111')") === false
      && f.$('#mBack').hidden === true;
  })());
ok('СП-19. отказ объясняет, почему завершённый заёмщик не удаляется, а закрывается событием',
  (() => { const f = mk();
    f.ev("askDelete('01204199910016');");
    const t = f.$('#mBody').textContent;
    return f.$('#mTitle').textContent.includes('нельзя')
      && /событием|погашение|безнадёжн/i.test(t);
  })());

/* ── Шапка карточки: решения КЗ-1…КЗ-7 (гриллинг 26.07.2026, реализация 27.07.2026) ──
   Шапка стоит над одиннадцатью вкладками, поэтому её ошибки стоят одиннадцати экранов:
   ИНН не показывался нигде (Б-12), стоп-факторы были спрятаны во вкладке 1, срез не
   переживал ни ссылку, ни F5, а переход карточка → карточка уносил чужой срез (Б-2). */
const kz = mk();
kz.ev("location.hash='#/b/01204199910016'"); kz.ev("route()");

/* СБ-14: ссылка на субъекта уехала из id-sub в строку-зеркало под шапкой (там же отметка
   среза). Ищем её именно в шапке (.id-bar), а не «где-нибудь в #cardMount»: тот же адрес
   печатают ссылки залогодателя во вкладке «Обеспечение» — по карточке целиком проверка
   проходила бы и при невызванном subjectMirrorRow. Сила утверждения прежняя: паспорт
   записи + рабочий выход к владельцу данных, и оба обязаны быть в шапке. */
/* I-1 (ревью 29.07.2026): прежняя редакция требовала от шапки печати ХРАНИМОГО типа лица —
   и тем подпирала расхождение макетов. Тип лица у владельца — функция среза (personKindAt),
   здесь хранимое поле; шапка его больше не утверждает (borrower.html renderCard→idBar).
   Подпись под наименованием сверяем РАВЕНСТВОМ СОСТАВА, а не «включает»: на «включает»
   возврат `<span>Юр. лицо</span>` прошёл бы незамеченным — от лишнего текста такая проверка
   не краснеет. Ожидание строим из данных, а не из зашитых строк. */
ok('КЗ-1. id-bar в теле карточки: наименование, ИНН, отрасль, ссылка на субъекта — и никакого типа лица',
  (() => {
    const bar = kz.$('#cardMount .id-bar');
    if (!bar) return false;
    const name = kz.ev("SUBJECTS.find(x=>x.inn==='01204199910016').name");
    const ind  = kz.ev("SUBJECTS.find(x=>x.inn==='01204199910016').industry");
    const subs = [...bar.querySelectorAll('.id-sub span')]
      .map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const a = kz.$('#cardMount .id-bar a[href="../subject/subject.html#/s/01204199910016"]');
    /* хранимое поле в наборе ещё есть — значит негативная половина не вакуумна:
       было бы что напечатать, если бы шапка снова начала его печатать */
    return kz.ev("SUBJECTS.find(x=>x.inn==='01204199910016').personKind") === 'юр'
      && bar.querySelector('.id-name').textContent.trim() === name
      && String(subs) === String(['ИНН 01204199910016', ind]) && !!a;
  })());
ok('КЗ-1. топбар называет экран, а не запись (паспорт переехал в карточку)',
  kz.$('#pageTitle').textContent.trim() === 'Карточка заёмщика');

ok('КЗ-2. в норме дата среза — тихая строка: ни полосы, ни оговорки про деньги',
  (() => { const b = kz.$('.asof-bar');
    return !!b && !b.classList.contains('past') && !/снимок на/.test(b.textContent)
      && !!kz.$('#cardAsOf'); })());
ok('КЗ-2. в режиме среза — полоса во всю ширину с возвратом к сегодня',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()"); f.ev("setAsOf('2026-01-01')");
    const b = f.$('.asof-bar');
    return b.classList.contains('past') && /Срез 01\.01\.2026/.test(b.textContent)
      && /Вернуться к сегодня/.test(b.textContent); })());
ok('КЗ-2. оговорка про деньги стоит у денег, а не у переключателя даты',
  /снимок кредитного модуля на 10\.07\.2026/.test(kz.$('.tabpanel[data-panel="0"]').textContent));

ok('КЗ-3. срез уходит в маршрут: setAsOf пишет ?on= в адрес',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()"); f.ev("setAsOf('2026-01-01')");
    return /^#\/b\/01204199910016\/\d+\?on=2026-01-01$/.test(f.ev("location.hash")); })());
ok('КЗ-3. ссылка со срезом открывает карточку на этой дате, без параметра — сегодня',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016/1?on=2026-01-01'"); f.ev("route()");
    const cut = f.ev("asOf()") === '01.01.2026' && f.ev("activeTab()") === '1';
    f.ev("location.hash='#/b/01204199910016/1'"); f.ev("route()");
    return cut && f.ev("asOf()") === f.ev("TODAY"); })());
ok('КЗ-3/Б-2. переход карточка → карточка не уносит чужой срез',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()"); f.ev("setAsOf('2026-01-01')");
    f.ev("location.hash='#/b/10001199900101'"); f.ev("route()");
    return f.ev("asOf()") === f.ev("TODAY"); })());

ok('КЗ-4. плитки состояния субъекта больше нет — состояние живёт баннером',
  !/Состояние субъекта/.test(kz.$('.phead-dims').textContent));
ok('КЗ-4. стоп-факторы подняты в шапку: лента вне вкладок, видна со всех одиннадцати',
  (() => { const fr = kz.$$('.flags-row');
    return fr.length === 1 && !fr[0].closest('.tabpanel'); })());
ok('КЗ-4. запрет работы — красный баннер, событие без запрета — тихая строка',
  (() => { const a = mk(), b = mk();
    a.ev("location.hash='#/b/20270119991027'"); a.ev("route()");     // ликвидирован → read-only
    b.ev("location.hash='#/b/20120119991012'"); b.ev("route()");     // реорганизация → запрета нет
    return !!a.$('#cardMount .ro-banner') && !a.$('#cardMount .state-line')
      && !b.$('#cardMount .ro-banner') && !!b.$('#cardMount .state-line')
      && /реорганизация/.test(b.$('#cardMount .state-line').textContent); })());

ok('КЗ-5. GROUP_LABEL заведён на пять кодов, группа выводится из подгруппы',
  kz.ev("Object.keys(GROUP_LABEL).join('')") === '12345'
  && kz.ev("groupOfSub('2.1')") === '2' && kz.ev("groupOfSub('none')") === null);
ok('КЗ-5. плитка подгруппы двухуровневая: группа сверху, код с подписью снизу',
  (() => { const d = kz.$('.phead-dims .dim:nth-child(1)');
    return /Принудительное взыскание/.test(d.querySelector('.dim-v').textContent)
      && /2\.1/.test(d.querySelector('.dim-sub').textContent)
      && /Работа с судебными органами/.test(d.querySelector('.dim-sub').textContent); })());
ok('КЗ-5. solvencyOfGroup переименована в surveyClassOf (класс обследования, не платёжеспособность)',
  kz.ev("typeof solvencyOfGroup") === 'undefined' && kz.ev("typeof surveyClassOf") === 'function'
  && kz.ev("!!surveyOf(PLEDGE_OBJ.find(o=>!o.released))"));

ok('КЗ-6. замок read-only живёт внутри «как выведено», отдельной строкой его нет',
  (() => { const notes = kz.$$('#cardMount .ro-note');
    return notes.length === 2 && notes.every(x => !!x.closest('details.tile-more')); })());

ok('КЗ-7. таббар в две строки, состав строк задан TAB_DEFS.row',
  (() => { const bars = kz.$$('#cardMount .tabbar');
    if (bars.length !== 2 || !bars[0].classList.contains('row-top')) return false;
    const names = b => [...b.querySelectorAll('.tab')].map(x => x.childNodes[0].textContent.trim());
    const want = r => kz.ev(`JSON.stringify(TAB_DEFS.filter(d=>d.row===${r}).map(d=>d.name))`);
    return JSON.stringify(names(bars[0])) === want(1) && JSON.stringify(names(bars[1])) === want(2); })());
ok('КЗ-7. счётчики — только у пяти вкладок нагрузки и только при ненулевом счёте',
  (() => {
    const keys = JSON.parse(kz.ev("JSON.stringify(TAB_DEFS.map(d=>d.key))"));
    const cnt  = JSON.parse(kz.ev("JSON.stringify(TAB_DEFS.map(d=>tabCount('01204199910016', d.key)))"));
    const counted = keys.filter((k,i) => cnt[i] !== null).join(' ');
    const tabs = kz.$$('#cardMount .tabbar .tab');
    const shown = tabs.map(t => { const c = t.querySelector('.cnt'); return c ? Number(c.textContent) : null; });
    return counted === 'кредиты обеспечение обязательства взыскание проверки'
      && shown.every((v,i) => v === (cnt[i] ? cnt[i] : null)); })());
ok('КЗ-7. нулевой счёт цифру не печатает',
  (() => { const f = mk();
    f.ev("location.hash='#/b/20010119991001'"); f.ev("route()");     // кредиты есть, взыскания нет
    const ix = f.ev("tabIx('взыскание')");
    return f.ev("tabCount('20010119991001','взыскание')") === 0
      && !f.$(`#cardMount .tab[data-tab="${ix}"] .cnt`); })());

/* ── Дата среза в деньгах: дефекты Б-3, Б-4, Б-5 (КЗ-12) ───────────────────────
   Одна семья ошибок. Деньги приходят снимком на DEBT_ASOF (И-6), а МНОЖЕСТВО кредитов,
   по которому они складывались, выбиралось на другую дату: внутри totalDebt/overdueDebt/
   atRisk/coverageOf — жёстко на TODAY (Б-3), в самой сводке — на дате среза, то есть в
   одной карточке под одной подписью сходились три режима дат. Через totalDebt дата
   TODAY протекала в СОСТОЯНИЕ: существование обязательства О-2 решалось по сегодняшнему
   долгу, а срок того же обязательства — по дате среза (Б-4). А итог вкладки «Кредиты»
   складывался по ВСЕМ кредитам, тогда как витрина — по действующим (Б-5).
   Правило после правки одно: множество, по которому складываются деньги, выбирается на
   дате денег (DEBT_ASOF). Дате среза подчиняются состояния, а не суммы. */

// Б-3 · четыре функции выбирают множество по переданной дате, а не по TODAY.
// В сиде все закрытые кредиты с нулевым долгом, поэтому свидетель заводится на месте.
const seedClosed = (f, inn, closedAt, principal) => f.ev(
  `CREDITS.push({ id:'C-TEST-${closedAt.replace(/\\./g,'')}', inn:'${inn}', no:'КР-TEST', kind:'тест',
     date:'01.01.2024', amount:1000000, gov:'—', currency:'KGS', closedAt:'${closedAt}',
     overdueSince:'01.01.2026',
     debt:{ current:{principal:0,interest:0,penalty:0,fees:0,costs:0},
            overdue:{principal:${principal},interest:0,penalty:0,fees:0,costs:0}, asOf:DEBT_ASOF } });`);

ok('Б-3. totalDebt / overdueDebt / atRisk принимают дату и по ней выбирают множество',
  (() => { const f = mk(); const inn = '01204199910016';
    seedClosed(f, inn, '01.06.2026', 500000);
    const live = f.ev(`[totalDebt('${inn}','01.05.2026'), overdueDebt('${inn}','01.05.2026'), atRisk('${inn}','01.05.2026')]`);
    const gone = f.ev(`[totalDebt('${inn}','01.07.2026'), overdueDebt('${inn}','01.07.2026'), atRisk('${inn}','01.07.2026')]`);
    return live.every((v, i) => v - gone[i] === 500000); })());

ok('Б-3. дата по умолчанию — дата денег (DEBT_ASOF), а не TODAY',
  (() => { const f = mk(); const inn = '01204199910016';
    seedClosed(f, inn, '12.07.2026', 500000);        // закрыт ПОСЛЕ снимка, но ДО сегодня
    return f.ev(`totalDebt('${inn}')`) === f.ev(`totalDebt('${inn}', DEBT_ASOF)`)
        && f.ev(`totalDebt('${inn}')`) !== f.ev(`totalDebt('${inn}', TODAY)`); })());

// Обеспеченность считается от остатка, а остаток — тот же снимок: множество кредитов
// у coverageOf должно выбираться на той же дате. Проверяется через общее основание creditsOn.
ok('Б-3. coverageOf выбирает множество на дате денег, а переданную дату пропускает насквозь',
  (() => { const f = mk();
    f.ev("window.__co = []; (function(){ const orig = creditsOn;"
       + " window.creditsOn = function(inn, d){ window.__co.push(d); return orig(inn, d); }; })();");
    f.ev("coverageOf('01204199910016')");
    f.ev("coverageOf('01204199910016','01.05.2026')");
    return JSON.parse(f.ev("JSON.stringify(window.__co)"))
      .join('|') === f.ev("DEBT_ASOF") + '|01.05.2026'; })());

ok('Б-3/КЗ-12. сводка по кредитам — один режим дат: срез её не двигает',
  (() => { const f = mk();
    f.ev("location.hash='#/b/09901199990091'"); f.ev("route()");   // кредит закрыт 01.04.2026
    const now = f.ev("creditsSummaryCard('09901199990091')");
    f.ev("setAsOf('2026-03-01')");                                  // срез, где тот же кредит ещё действует
    return f.ev("creditsSummaryCard('09901199990091')") === now; })());

// Б-4 · дата обязательства не подменяется сегодняшней при проверке порога 50 млн.
ok('Б-4. obligations не подмешивает TODAY: порог О-2 считается на дате обязательства',
  (() => { const f = mk();
    f.ev("window.__td = []; (function(){ const orig = totalDebt;"
       + " window.totalDebt = function(inn, d){ window.__td.push(d); return orig(inn, d); }; })();");
    f.ev("obligations('02201199920021','01.07.2026')");             // Иссык-Куль Агро: Средний, долг 55,7 млн
    const seen = JSON.parse(f.ev("JSON.stringify(window.__td)"));
    return seen.length > 0 && seen.every(d => d === '01.07.2026'); })());

// Б-5 · витрина и итог вкладки «Кредиты» складывают одно и то же множество.
const money = t => { const m = String(t).match(/([\d\s ]+)/); return m ? Number(m[1].replace(/[\s ]/g,'')) : null; };
/* Ячейки итога адресуются по data-col, а не по номеру: состав колонок вкладки меняется
   решениями (Б-11 снял чекбоксы), а смысл столбца — нет. */
const footCell = (tr, col) => { const td = tr.querySelector('[data-col="' + col + '"]'); return td ? td.textContent.trim() : null; };
ok('Б-5. итог вкладки «Кредиты» считает по действующим — как витрина, а не по всем',
  (() => { const f = mk();
    f.ev("location.hash='#/b/09901199990091'"); f.ev("route()");    // 1 кредит, погашен: витрина 0, вкладка была 7 000 000
    const rows = [...f.$$('.tabpanel[data-panel="0"] .f')]
      .reduce((a, d) => (a[d.querySelector('.fk').textContent.trim()] = d.querySelector('.fv').textContent.trim(), a), {});
    f.ev("switchTab(tabIx('кредиты'))");
    const tr = [...f.$$('#crWrap > table > tfoot > tr')];
    if (!tr.length) return false;
    return money(rows['Сумма выдано']) === money(footCell(tr[0], 'amount'))
      && money(rows['Задолженность всего']) === money(footCell(tr[0], 'debt'))
      && /действ/.test(footCell(tr[0], 'label')); })());
ok('Б-5. погашенные кредиты не растворяются в сумме, а стоят отдельной строкой (КЗ-20)',
  (() => { const f = mk();
    f.ev("location.hash='#/b/09901199990091'"); f.ev("route()");
    f.ev("switchTab(tabIx('кредиты'))");
    const tr = [...f.$$('#crWrap > table > tfoot > tr')];
    if (tr.length !== 2) return false;
    return /Погашен/.test(footCell(tr[1], 'label')) && money(footCell(tr[1], 'amount')) === 7000000; })());

/* ── Сквозные приёмы: КЗ-14, КЗ-16, КЗ-22, КЗ-31 ────────────────────────────────
   Четыре решения, принятые один раз на все одиннадцать вкладок. Общее у них — язык
   экрана: подпись блока, ссылка, полоса дефектов и хвост хронологии выглядят одинаково
   везде, иначе одно и то же решение пришлось бы принимать одиннадцать раз и разойтись
   в одиннадцати местах. Проверяем на карточке целиком: все панели рисуются сразу. */

/* Карточка со всеми вкладками разом: панели рендерятся при showDetail, переключение
   вкладки их не создаёт — поэтому один route() даёт весь экран. */
const card = inn => { const f = mk(); f.ev(`location.hash='#/b/${inn}'`); f.ev("route()"); return f; };
const HINTS = f => f.$$('.section-head .hint').map(h => h.textContent);

const cAts = card('01204199910016');   // АгроТехСервис — взыскание, залог, кураторство, дефекты
const cClean = card('10001199900101'); // кредит погашен — ни дефектов взыскания, ни дефектов обеспечения

ok('КЗ-14. подписи блоков не показывают внутренний номер решения (Р-N)',
  HINTS(cAts).concat(HINTS(cClean)).every(t => !/\bР-\d+/.test(t)));
ok('КЗ-14. жаргон разработки наружу не выходит (append-only, латиница модулей)',
  HINTS(cAts).concat(HINTS(cClean)).every(t => !/append-only/i.test(t) && !/[A-Za-z]{4,}/.test(t)));
ok('КЗ-14. ссылка на пункт Порядка остаётся — это основание, видимое пользователю',
  HINTS(cAts).some(t => /п\.\s*93/.test(t)) && HINTS(cAts).some(t => /п\.\s*97/.test(t)));

/* КЗ-16 / Б-9: ссылка, которая молча ничего не делает, читается как сломанный экран. */
const deadLinks = f => f.$$('a.lnk').filter(a => !a.getAttribute('href') && !a.getAttribute('onclick'));
ok('КЗ-16. мёртвых ссылок нет: у каждой ссылки есть маршрут или обработчик',
  deadLinks(cAts).length === 0 && deadLinks(cClean).length === 0);
ok('КЗ-16. переходы в чужие модули помечены «↗ внешний модуль»',
  (() => { const ext = cAts.$$('a.lnk.ext');
    return ext.length >= 5 && ext.every(a => /↗/.test(a.textContent) && /внешн/i.test(a.getAttribute('title') || '')); })());
ok('КЗ-16. нажатие на внешнюю ссылку даёт тост «маршрут не реализован»',
  (() => { const f = card('01204199910016');
    f.ev("notRouted('модуль залога')");
    const t = f.$('#toast');
    return !!t && /маршрут не реализован/i.test(t.textContent) && /модуль залога/.test(t.textContent); })());

/* КЗ-22: один движок полос, зелёная — тихой строкой, красная — кликабельна. */
ok('КЗ-22. полосы дефектов рисует один движок defectBar',
  cAts.ev("typeof defectBar === 'function'"));
ok('КЗ-22. «дефектов нет» — тихая строка, а не полноразмерная зелёная полоса',
  cClean.$$('.defect-bar.ok').length === 0 && cClean.$$('.def-ok').length >= 2);
ok('КЗ-22. дефект в полосе кликабелен и ведёт на вкладку «Проверки и дефекты»',
  (() => { const b = cAts.$$('.defect-bar .badge');
    return b.length > 0 && b.every(x => /switchTab/.test(x.getAttribute('onclick') || '')); })());

/* КЗ-31: ленту ведёт одна вкладка, остальные в неё указывают. */
ok('КЗ-31. хронология вкладки — не больше пяти записей',
  (() => { const tls = cAts.$$('.tab-tl');
    return tls.length >= 5 && tls.every(t => t.querySelectorAll('.tl-item').length <= 5); })());
ok('КЗ-31. хвост ленты ведёт в «Историю» с преднастроенной категорией',
  (() => { const a = cAts.$('.tab-tl[data-cat="kur"] a.lnk[href*="cat="]');
    return !!a && a.getAttribute('href') === `#/b/01204199910016/${cAts.ev("tabIx('история')")}?cat=kur`; })());
ok('КЗ-31. вкладка больше не ведёт собственную ленту («История кураторства» ушла)',
  HINTS(cAts).every(t => !/журнала назначений/.test(t)));
ok('КЗ-31. маршрут ?cat= открывает «Историю» с включённым фильтром категории',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016/" + f.ev("tabIx('история')") + "?cat=kur'"); f.ev("route()");
    const root = f.$('#histRoot'), on = f.$('#histChips .hchip.on');
    return !!root && root.dataset.cat === 'kur' && !!on && on.dataset.k === 'kur'; })());
ok('КЗ-31. выбранная полоса ленты пересылается ссылкой: чип кладёт категорию в адрес',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016/" + f.ev("tabIx('история')") + "'"); f.ev("route()");
    f.ev("switchTab(tabIx('история'))");
    f.ev("histFilter('coll')");
    return /\?cat=coll$/.test(f.w.location.hash); })());
ok('КЗ-31. срез и категория в маршруте уживаются',
  (() => { const f = mk();
    f.ev("location.hash='#/b/01204199910016/" + f.ev("tabIx('история')") + "?on=2026-03-01&cat=coll'"); f.ev("route()");
    return f.ev("VIEW_DATE") === '01.03.2026' && f.$('#histRoot').dataset.cat === 'coll'; })());

/* ── Вкладка 1 «витрина»: КЗ-8, КЗ-9, КЗ-10, КЗ-11, КЗ-13, КЗ-15, КЗ-17 ─────────
   Вкладка отвечает на один вопрос — «что с заёмщиком сейчас». Отсюда всё остальное:
   шесть сводок постоянного состава (КЗ-8), реквизиты уходят к субъекту (КЗ-9),
   слоты не тратятся на факты без даты (КЗ-11) и на норму (КЗ-15). Проверяем на двух
   карточках: рабочей (АгроТехСервис) и погашенной, где почти всё пусто. */
const panel0 = f => f.$('.tabpanel[data-panel="0"]');
const cards0 = f => [...panel0(f).querySelectorAll('.section')];

ok('КЗ-8. витрина — шесть сводок постоянного состава, пустая карточка тоже даёт шесть',
  cards0(cAts).length === 6 && cards0(cClean).length === 6);
ok('КЗ-8. у каждой сводки один адрес продолжения — своя вкладка',
  (() => { const keys = [...panel0(cAts).querySelectorAll('.section-head a.lnk')]
      .map(a => (/tabIx\('([^']+)'\)/.exec(a.getAttribute('onclick') || '') || [])[1])
      .filter(Boolean).sort();
    return String(keys) === String(['история','кредиты','кураторство','обеспечение','обязательства','связи']); })());

ok('КЗ-9. реквизитов на витрине нет: адреса и аудит записи сюда не относятся',
  !/Юридический адрес|Фактический адрес|Основные сведения|Изменён/.test(panel0(cAts).innerHTML));
/* СБ-14: проверка «адреса остались у субъекта» здесь удалена — экрана, который их показывал,
   в этом макете больше нет, как и subjectFieldsSect.

   I3 (ревью 29.07.2026): не обманываться насчёт того, куда покрытие переехало — оно НЕ
   переехало, а исчезло. Сверено 29.07.2026: в mockups/subject/subject.html строки
   «Юридический адрес» нет вовсе, «Фактический адрес» — единственное вхождение и то
   захардкоженное как ownRow('Фактический адрес','—') (:1261); у владельца есть только
   импортное поле «Адрес». В scripts/inspect/subject-check.mjs про почтовые адреса ноль
   утверждений (единственное вхождение слова «адрес» — 7.2, где это «адрес продолжения»,
   то есть ссылка). Итог: юридический и фактический адрес субъекта на сегодня не покрыты
   ни одним смоуком. Восстанавливать удалённый тест нельзя — предмета в этом макете нет;
   покрытие должен завести владелец, и до тех пор это дыра, а не «чужая ответственность».

   Что в этом макете про адрес всё-таки проверяется: addrLegal никуда не делся и печатается
   каналом «адрес корресп.» (borrower.html:2630) — это утверждает живой тест КЗ-10 ниже. */
ok('КЗ-9. аудит записи стал фактом ленты, а не полем витрины',
  cAts.ev("historyItems('01204199910016').some(it=>it.kind==='запись' && /заведена/.test(it.title))")
  && cAts.ev("historyItems('01204199910016').some(it=>it.kind==='запись' && /изменена/.test(it.title))"));

/* КЗ-10: канал связи без даты сверки нельзя набрать с уверенностью, а отсутствие связи —
   расхождение с Порядком, то есть дефект, а не пустой блок. */
ok('КЗ-10. контакты: адрес корреспонденции вернулся, основной помечен, дата сверки видна',
  (() => { const t = panel0(cAts).textContent;
    return /адрес корресп/i.test(t) && /основной/.test(t) && /сверено \d{2}\.\d{2}\.\d{4}/.test(t); })());
ok('КЗ-10. заёмщик без действующего канала связи поднимает дефект Д-КОНТ',
  (() => { const f = mk();
    const before = f.ev("borrowerChecks('01204199910016',TODAY).find(x=>x.code==='Д-КОНТ')");
    f.ev("CHANNELS.filter(c=>c.inn==='01204199910016').forEach(c=>c.closedAt='01.01.2020')");
    const after = f.ev("borrowerChecks('01204199910016',TODAY).find(x=>x.code==='Д-КОНТ')");
    return !!before && before.sev === 'ok' && !!after && after.sev === 'mid' && after.stop === false; })());

/* КЗ-11: лента — набор фактов, а не состояние; дате среза подчиняются состояния (И-9). */
ok('КЗ-11. факт без даты не занимает слот витрины, но и не исчезает',
  (() => { const r = cAts.ev("recentSlots([{date:'—'},{date:'01.07.2026'},{date:'02.07.2026'}], 2)");
    return r.shown.length === 2 && r.shown.every(x => x.date !== '—') && r.undated === 1; })());
ok('КЗ-11. лента дате среза не подчиняется: на срезе состав тот же',
  (() => { const base = cAts.ev("historyItems('01204199910016').length");
    const f = mk(); f.ev("location.hash='#/b/01204199910016?on=2026-03-01'"); f.ev("route()");
    return f.ev("VIEW_DATE") === '01.03.2026'
      && f.ev("historyItems('01204199910016').length") === base && base > 0; })());

/* КЗ-13: у витрины три слота на сроки — значит показываем ближайшие, а не первые попавшиеся. */
ok('КЗ-13. «Требует внимания» — топ-3 по сроку, ближайший первым, остальные счётом',
  (() => { const rows = [...panel0(cAts).querySelectorAll('.att-item')];
    const open = cAts.ev("openObligations('01204199910016', TODAY).length");
    const num = s => +s.split('.').reverse().join('');
    const dates = rows.map(r => (/до (\d{2}\.\d{2}\.\d{4})/.exec(r.textContent) || [])[1]).filter(Boolean);
    return open > 3 && rows.length === 3 && dates.length === 3
      && dates.every((d, i) => !i || num(dates[i-1]) <= num(d))
      && /ещё 1/.test(panel0(cAts).textContent); })());
ok('КЗ-13. очередь на комитет ушла с витрины — у коллегиального органа свой адрес',
  (() => { const f = card('05501199950051');
    return f.ev("committeeQueue('05501199950051', TODAY).length") > 0
      && !/очеред/i.test(panel0(f).textContent); })());
ok('КЗ-13. у срока «вышел», а не «просрочен»: просрочка на экране остаётся у долга',
  cAts.ev("statusOf('01.01.2026', TODAY)") === 'срок вышел'
  && !/просроч/i.test([...panel0(cAts).querySelectorAll('.att-item')].map(x => x.textContent).join(' ')));

ok('КЗ-15. послабление — не сводка витрины, а основание категории',
  (() => { const noBlock = !/Послабления по категории/.test(panel0(cAts).innerHTML);
    const basis = [...cAts.$$('.phead-dims .dim .src')].map(x => x.textContent).join(' | ');
    return noBlock && /послаблени/i.test(basis); })());

/* КЗ-17: coverageOf считала breaches и наружу их не отдавала — витрина молчала об обеспечении. */
ok('КЗ-17. обеспеченность на витрине: худший индекс и «нарушений N из M»',
  (() => { const cv = cAts.ev("coverageOf('01204199910016')"), t = panel0(cAts).textContent;
    return cv.rated > 0 && cv.breaches > 0 && new RegExp(cv.breaches + ' из ' + cv.rated).test(t); })());
ok('КЗ-17. кураторство на витрине: дыра показана числом, а не молчанием',
  (() => { const gaps = cAts.ev("curatorGaps('01204199910016', TODAY).length"), t = panel0(cAts).textContent;
    return gaps > 0 && /без куратора/.test(t) && t.includes(String(gaps)); })());

/* ── Вкладка 2 «Кредиты»: КЗ-18, КЗ-19, КЗ-20 + дефекты Б-10, Б-11 ─────────────
   Вкладка — зеркало кредитного модуля (И-5): ни одной точки ввода, все действия ведут
   маршрутом наружу (КЗ-18). Внутри — рабочий список: пять статей долга раскрытием, а не
   подсказкой, фильтр по состоянию, сортировка, валюта из данных (КЗ-19, Б-10). Итог
   считается по тому же множеству, которое показано (КЗ-20), и складывает валюты порознь. */
const credTab = inn => { const f = card(inn); f.ev("switchTab(tabIx('кредиты'))"); return f; };
const crRows = f => [...f.$$('#crWrap tbody tr.pl-row')];
const crPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('кредиты')") + '"]');
const setState = (f, v) => { const s = f.$('#crState'); s.value = v; s.dispatchEvent(new f.w.Event('change')); };
const kAts = credTab('01204199910016');   // 3 кредита, просрочка на одном (КР-60541, 212 дн.)

ok('КЗ-18. «добавить кредит» не притворяется формой здесь — ведёт маршрутом в модуль заявок',
  (() => { const b = [...crPanel(kAts).querySelectorAll('.toolbar button')]
      .find(x => /кредит/i.test(x.textContent) && !/сформировать/i.test(x.textContent));
    return !!b && /заявк/i.test(b.textContent + (b.getAttribute('onclick') || ''))
      && /notRouted/.test(b.getAttribute('onclick') || ''); })());
ok('КЗ-18. пункты «Сформировать» названы по смыслу и ни один не молчит',
  (() => { const items = [...crPanel(kAts).querySelectorAll('.dd-i')];
    return items.length >= 3
      && items.every(i => /notRouted/.test(i.getAttribute('onclick') || ''))
      && items.some(i => /Расчёт задолженности/.test(i.textContent))
      && !items.some(i => i.textContent.trim() === 'Расчёт'); })());

ok('Б-11. чекбоксов строк нет: выделение ни к чему не подключено и стиралось пагинацией',
  kAts.$$('#crWrap input[type="checkbox"]').length === 0);

ok('КЗ-19. пять статей долга — раскрытием строки, а не подсказкой в title',
  (() => { const tips = [...kAts.$$('#crWrap [title]')].map(x => x.getAttribute('title')).join(' ');
    const sub = kAts.$('#crWrap tr.pl-sub[data-sub="C-ATS-GAZ"]');
    if (!sub) return false;
    const t = sub.textContent;
    /* названия статей — по CONTEXT («Статья долга»): сборы и расходы по обращению взыскания,
       а не самодельные «Комиссии»/«Издержки» (КЗ-35 — один словарь ART_RU на файл) */
    return !/осн\. долг|Основной долг/i.test(tips)
      && ['Основной долг','Проценты','Пеня','Сборы','Расходы по обращению взыскания','Срочная','Просроченная']
           .every(w => t.includes(w)); })());
ok('КЗ-19. строка раскрывается кликом, переход в кредитный модуль — отдельной ссылкой',
  (() => { const f = credTab('01204199910016');
    const tr = f.$('#crWrap tr.pl-row[data-cr="C-ATS-GAZ"]');
    const sub = f.$('#crWrap tr.pl-sub[data-sub="C-ATS-GAZ"]');
    if (!tr || !sub || !sub.hidden) return false;
    tr.dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const opened = !sub.hidden;
    const link = tr.querySelector('a.lnk.ext');
    return opened && !!link && /кредитн/i.test(link.getAttribute('onclick') || ''); })());

ok('КЗ-19. фильтр по состоянию: «с просрочкой» оставляет только кредиты с просроченной частью',
  (() => { const f = credTab('01204199910016');
    const all = crRows(f).length;
    const ovN = f.ev("CREDITS.filter(c=>c.inn==='01204199910016' && creditOverdue(c)>0).length");
    setState(f, 'ov');
    const shown = crRows(f);
    return all === 3 && ovN === 1 && shown.length === ovN
      && shown[0].dataset.cr === 'C-ATS-GAZ'; })());
ok('КЗ-19. заголовок сортирует: «Задолженность» по возрастанию, повторный клик — обратно',
  (() => { const f = credTab('01204199910016');
    const col = () => crRows(f).map(tr => money(tr.querySelector('[data-col="debt"]').textContent));
    const th = f.$('#crWrap thead th[data-sort="debt"]');
    if (!th) return false;
    th.dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const asc = col();
    th.dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const desc = col();
    return asc.length === 3 && asc.every((v,i) => !i || asc[i-1] <= v)
      && String(desc) === String(asc.slice().reverse()); })());

ok('КЗ-20. итог следует фильтру: показано одно множество, сложено то же самое',
  (() => { const f = credTab('01204199910016');
    setState(f, 'ov');
    const tr = [...f.$$('#crWrap > table > tfoot > tr')];
    const want = f.ev("CREDITS.filter(c=>c.inn==='01204199910016' && creditOverdue(c)>0)"
                    + ".reduce((a,c)=>a+creditTotal(c),0)");
    return tr.length === 1 && money(footCell(tr[0], 'debt')) === want
      && /1 кред/.test(footCell(tr[0], 'label')); })());

ok('Б-10. валюта берётся из данных, а не вписана в разметку; валюты не складываются',
  (() => { const f = mk();
    f.ev("CREDITS.find(c=>c.id==='C-ATS-NECEL').currency='USD'");
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()"); f.ev("switchTab(tabIx('кредиты'))");
    const row = f.$('#crWrap tr.pl-row[data-cr="C-ATS-NECEL"] [data-col="amount"]');
    const feet = [...f.$$('#crWrap > table > tfoot > tr')].map(tr => ({ l: footCell(tr,'label'), a: money(footCell(tr,'amount')) }));
    const usd = feet.find(x => /USD/.test(x.l)), kgs = feet.find(x => /KGS/.test(x.l));
    return !!row && /USD/.test(row.textContent)
      && !!usd && !!kgs && usd.a === 8000000 && kgs.a === 15000000; })());

/* ── Вкладка 3 «Обеспечение»: КЗ-21, КЗ-23…КЗ-26 + дефекты Б-6, Б-10, Б-14 ─────
   Вкладка перестаёт быть «Залогом»: обеспечение — родовое понятие, и держит два раздела
   (КЗ-21). Поручительство перестаёт быть значением поля role в реестре лиц и становится
   обеспечительным договором с номером, кредитом, объёмом и основанием прекращения
   (КЗ-26, ADR-0005). Сводка называет кредит худшего индекса (КЗ-23), обеспеченность
   показывается цепочкой вывода (КЗ-24), вид «по предметам» становится рабочим —
   поиск, сортировка, ИНН залогодателя (КЗ-25, Б-14). Итог обоих видов считает ровно
   показанное множество (Б-6, И-12), валюта берётся из данных (Б-10). */
const plTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('обеспечение'))"); return f; };
const plPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('обеспечение')") + '"]');
const plView  = (f, v) => f.$(v === 'objects' ? '#plSegOb' : '#plSegCr')
  .dispatchEvent(new f.w.Event('click', { bubbles:true }));
const plRows  = f => [...f.$$('#plWrap tbody tr')].filter(tr => !tr.classList.contains('pl-sub'));
const pAts = plTab('01204199910016');

ok('КЗ-21. вкладка называется «Обеспечение» и держит два раздела — залог и поручительство',
  (() => { const heads = [...plPanel(pAts).querySelectorAll('.section-head')].map(x => x.textContent.trim());
    return pAts.ev("TAB_DEFS[tabIx('обеспечение')].name") === 'Обеспечение'
      && heads.some(h => /^Залог/.test(h)) && heads.some(h => /^Поручительство/.test(h)); })());

ok('КЗ-26. поручительство — обеспечительный договор: номер, дата, кредит, объём, прекращение',
  g.ev("GUARANTEES.length > 0 && GUARANTEES.every(x => x.no && x.date && x.creditId && x.inn"
     + " && ('scope' in x) && ('endedAt' in x) && ('endBasis' in x))")
  && g.ev("GUARANTEES.some(x => x.endedAt && x.endBasis)"));
ok('КЗ-26. реестр связанных лиц поручительство больше не несёт',
  g.ev("RELATED.every(r => !/поручител/i.test(r.role || ''))"));
ok('КЗ-26. роль «Поручитель» выводится из действующего договора, прекращение её снимает',
  (() => { const f = mk();
    const inn = f.ev("(GUARANTEES.find(x => x.guarantorInn && !x.endedAt) || {}).guarantorInn");
    if (!inn) return false;
    const before = f.ev(`subjectRoles('${inn}').map(r => r.role).join('+')`);
    f.ev(`GUARANTEES.filter(x => x.guarantorInn === '${inn}')`
       + ".forEach(x => { x.endedAt = '01.01.2025'; x.endBasis = 'истечение срока'; })");
    const after = f.ev(`subjectRoles('${inn}').map(r => r.role).join('+')`);
    return /Поручитель/.test(before) && !/Поручитель/.test(after); })());
ok('КЗ-26. поручительство в залоговый индекс не входит — оно рядом, а не в цифре',
  (() => { const f = plTab('01204199910016');
    const cv = f.ev("coverageOf('01204199910016')");
    f.ev("GUARANTEES.length = 0");
    const cv2 = f.ev("coverageOf('01204199910016')");
    return cv.worst === cv2.worst && /не вход/i.test(plPanel(f).textContent); })());

ok('КЗ-23. сводка называет кредит худшего индекса и нарушения N из M; средневзвешенный удалён',
  (() => { const cv = pAts.ev("coverageOf('01204199910016')");
    const t = plPanel(pAts).textContent;
    return !('aggregate' in cv) && !!cv.worstNo && t.includes(cv.worstNo)
      && new RegExp('наруш\\S+ порога\\s*' + cv.breaches + ' из ' + cv.rated).test(t)
      && !/Средневзвешенн/i.test(pAts.$('#cardMount').textContent); })());

ok('КЗ-24. обеспеченность — цепочка вывода залоговая ÷ (остаток × порог), а не голый индекс',
  (() => { const f = plTab('01204199910016');
    const cell = f.$('#plWrap tr.pl-row[data-cr="C-ATS-GAZ"] [data-col="cover"]');
    if (!cell) return false;
    const cv = f.ev("creditCoverage(CREDITS.find(c => c.id === 'C-ATS-GAZ'))");
    const F = n => f.ev('fmt(' + Math.round(n) + ')');
    const t = cell.textContent;
    return t.includes(F(cv.secured)) && t.includes(F(cv.base))
      && t.includes(Math.round(cv.req*100) + ' %') && t.includes(cv.index.toFixed(2))
      && /÷/.test(t) && /×/.test(t)
      && !f.$('#plWrap thead th[data-col="req"]'); })());

ok('КЗ-25. вид «по предметам»: поиск сужает выборку по идентификатору',
  (() => { const f = plTab('01204199910016'); plView(f, 'objects');
    const all = plRows(f).length;
    const id = String(plRows(f)[0].querySelector('[data-col="ident"]').textContent).trim().split(/\s+/).pop();
    const s = f.$('#plSearch'); if (!s) return false;
    s.value = id; s.dispatchEvent(new f.w.Event('input', { bubbles:true }));
    const shown = plRows(f);
    return all > 1 && shown.length >= 1 && shown.length < all
      && shown.every(tr => tr.textContent.includes(id)); })());
ok('КЗ-25. вид «по предметам»: заголовок сортирует, повторный клик — обратно',
  (() => { const f = plTab('01204199910016'); plView(f, 'objects');
    const col = () => plRows(f).map(tr => money(tr.querySelector('[data-col="cv"]').textContent));
    const th = f.$('#plWrap thead th[data-sort="cv"]');
    if (!th) return false;
    th.dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const asc = col();
    th.dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const desc = col();
    return asc.length > 1 && asc.every((v,i) => !i || asc[i-1] <= v)
      && String(desc) === String(asc.slice().reverse()); })());
ok('КЗ-25 / Б-14. залогодатель — ИНН, а не строка-имя: переименование лица связь не рвёт',
  (() => { const f = mk();
    if (!f.ev("PLEDGE_OBJ.every(o => !('pledger' in o) && !!o.pledgerInn)")) return false;
    f.ev("SUBJECTS.find(s => s.inn === '01204199910016').name = 'ОАО «Переименовано»'");
    const roles = f.ev("subjectRoles('01204199910016').map(r => r.role).join('+')");
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()"); f.ev("switchTab(tabIx('обеспечение'))");
    f.$('#plSegOb').dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const cell = f.$('#plWrap tbody tr [data-col="pledger"]');
    return /Залогодатель/.test(roles) && !!cell && /01204199910016/.test(cell.textContent); })());

ok('Б-6. итог не зависит от вида: оба считают показанное множество (И-12)',
  (() => { const f = plTab('10001199900101');    // кредит погашен, предметы сняты
    const feet = v => { plView(f, v);
      return [...f.$$('#plWrap table > tfoot > tr')]
        .map(tr => ({ l: footCell(tr, 'label'), s: money(footCell(tr, 'sec')) })); };
    const cr = feet('credits'), ob = feet('objects');
    const aCr = cr.find(x => /действ/.test(x.l)), aOb = ob.find(x => /действ/.test(x.l));
    return !!aCr && !!aOb && aCr.s === 0 && aOb.s === 0
      && cr.some(x => /Погашено|Снято/.test(x.l)) && ob.some(x => /Снято/.test(x.l)); })());

ok('Б-10. валюта обеспечения берётся из данных; валюты не складываются',
  (() => { const f = mk();
    f.ev("PLEDGE_OBJ.filter(o => o.inn === '01204199910016' && !o.released).slice(0,1)"
       + ".forEach(o => { o.currency = 'USD'; })");
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()"); f.ev("switchTab(tabIx('обеспечение'))");
    f.$('#plSegOb').dispatchEvent(new f.w.Event('click', { bubbles:true }));
    const feet = [...f.$$('#plWrap table > tfoot > tr')].map(tr => footCell(tr, 'label'));
    return plRows(f).some(tr => /USD/.test(tr.textContent))
      && feet.some(l => /USD/.test(l)) && feet.some(l => /KGS/.test(l)); })());

/* ── Вкладка 4 «Обязательства» (КЗ-27) ─────────────────────────────────────────
   Ветка 1 (АгроТехСервис) — единственная, где обязательство повторяется по месяцам
   и в середине полосы пропуск: вынос на комитет есть за 03–05.2026, за 06/07 нет.
   На ней и проверяется главное следствие периода. */
const oblTab = inn => { const f = card(inn); f.ev("switchTab(tabIx('обязательства'))"); return f; };
const oblSects = f => [...f.$$('#oblWrap > .section')];
const oblRows  = (f, i) => [...oblSects(f)[i].querySelectorAll('tbody tr')];
const cellText = (tr, i) => tr.children[i].textContent.replace(/\s+/g,' ').trim();

ok('КЗ-27. подача по образцу «Актов сверок»: две секции — действующие и исполненные',
  (() => { const f = oblTab('01204199910016');
    const heads = oblSects(f).map(s => s.querySelector('.section-head').textContent);
    return heads.length === 2 && /Действующие/.test(heads[0]) && /Исполненные/.test(heads[1])
      && oblRows(f,0).length > 0 && oblRows(f,1).length > 0; })());

ok('КЗ-27. строку заголовит пункт Порядка; внутренний О-N в подаче не участвует',
  (() => { const f = oblTab('01204199910016');
    const wrap = f.$('#oblWrap');
    const first = oblRows(f,0).map(tr => cellText(tr,0));
    return first.every(t => /^п\.\d/.test(t)) && !/О-\d/.test(wrap.innerHTML); })());

ok('КЗ-27 / И-7. у действующего — «где закрывается», у исполненного — сам факт из модуля-источника',
  (() => { const f = oblTab('01204199910016');
    const open = oblRows(f,0).map(tr => cellText(tr,4));
    const done = oblRows(f,1).map(tr => cellText(tr,4));
    return open.every(t => /где закрывается ↗/.test(t) && /факта закрытия нет/.test(t))
      && done.some(t => /КРР-2026-\d+/.test(t) && /открыть ↗/.test(t))
      && !/выполнено|отметк/i.test(f.$('#oblWrap').textContent); })());

ok('КЗ-27. следствие периода в подаче: за соседний месяц факт есть, на пропущенный не переносится',
  (() => { const f = oblTab('01204199910016');
    const open = oblRows(f,0).map(tr => ({ p: cellText(tr,1), s: cellText(tr,3) }));
    const june = open.find(r => /06\.2026/.test(r.p));
    const july = open.find(r => /07\.2026/.test(r.p));      // срок ещё не настал — период не пропущен
    const closed = oblRows(f,1).map(tr => cellText(tr,1));
    return !!june && /факт есть за/.test(june.p) && /05\.2026/.test(june.p)
      && /на этот период он не переносится/.test(june.p)
      && !!july && /в срок/.test(july.s) && !/факт есть за/.test(july.p)
      && closed.some(t => /05\.2026/.test(t)) && !closed.some(t => /06\.2026/.test(t)); })());

/* ── Вкладка 5 «Взыскание»: КЗ-28…КЗ-30 + хвост Б-10 ───────────────────────────
   ADR-0002: единица работы — ТРЕБОВАНИЕ = дело × кредит × обязанное лицо. Строка
   таблицы — требование, а не дело: иначе два договора с разной судьбой (по одному иск,
   по другому претензия) сворачиваются в worst-of, а требование к поручителю рисуется
   судебным рельсом заёмщика. Фаза выводится из журнала мер, целящих в требование
   (М-2 · ADR-0003), пауза — состояние обязательства (М-11 · В-6), закрытие производно
   и исход берётся из закрытого словаря (М-9 · §3.3). Итог — по показанному множеству,
   валюты порознь, требование считается один раз на кредит (И-12 · §2.2 · Б-10). */
const cvTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('взыскание'))"); return f; };
const cvPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('взыскание')") + '"]');
const cvRows  = f => [...f.$$('#cvWrap tbody tr.pl-row')];
const cvGrp   = f => [...f.$$('#cvWrap tbody tr.grp-row')].map(tr => tr.textContent.replace(/\s+/g,' ').trim());
const vAts    = cvTab('01204199910016');   // 2 дела × (заёмщик + поручитель) = 4 требования

ok('КЗ-28. строка — требование: два кредита с поручителями дают четыре строки, не два дела',
  (() => { const rows = cvRows(vAts);
    return rows.length === 4
      && rows.filter(tr => /поручитель/.test(cellText(tr,1))).length === 2
      && rows.filter(tr => /заёмщик/.test(cellText(tr,1))).length === 2; })());

ok('КЗ-28. солидарные требования по одному кредиту стоят рядом и различаются фазой (ADR-0002)',
  (() => { const reqs = vAts.ev("JSON.stringify(reqsOfBorrower('01204199910016')"
      + ".map(r=>({c:r.creditId,role:r.role,ph:r.phase,claim:r.claim})))");
    const rs = JSON.parse(reqs);
    const byCredit = {}; rs.forEach(r => (byCredit[r.c] = byCredit[r.c] || []).push(r));
    return Object.values(byCredit).every(g => g.length === 2
        && g[0].claim === g[1].claim                       // §2.2: то же обязательство
        && g.find(r => r.role === 'заёмщик').ph !== g.find(r => r.role === 'поручитель').ph); })());

ok('КЗ-28. вид один: переключателя «по процессам / по кредитам» больше нет',
  !vAts.$('#cvSegPr') && !vAts.$('#cvSegCr')
  && /строка — требование/.test(cvPanel(vAts).querySelector('.toolbar').textContent));

ok('КЗ-28. кредит без требований из таблицы не исчезает — расхождение видно только здесь',
  (() => { const g = cvGrp(vAts);
    return g.length === 3 && g.some(t => /КР-60542/.test(t) && /требований нет/.test(t))
      && /требований взыскания нет|процесса нет/
         .test(vAts.$('#cvWrap').textContent.replace(/\s+/g,' ')); })());

ok('КЗ-29. фаза требования выводится из журнала мер, а не хранится на деле (М-2 · ADR-0003)',
  (() => { const f = mk();
    f.ev("PROCESSES.find(p=>p.id==='PR-102').measures.push("
       + "{num:'М-102-3',date:'01.07.2026',kind:'Требование обеспечителю',section:'Досудебный',"
       + "sets:'Претензия',targets:'поручитель',sum:5330000,doc:'ТРБ-102/1'})");
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const rs = JSON.parse(f.ev("JSON.stringify(reqsOfBorrower('01204199910016')"
      + ".filter(r=>r.creditId==='C-ATS-NECEL').map(r=>({role:r.role,ph:r.phase,k:r.contour})))"));
    const gr = rs.find(r => r.role === 'поручитель'), bo = rs.find(r => r.role === 'заёмщик');
    return gr.ph === 'Претензия' && gr.k === 'К1'          // мера сдвинула только своё требование
      && bo.ph === 'Повторная претензия'; })());           // М-5: чужая веха заёмщика не двигает

ok('КЗ-29. мера без адресата остаётся мерой заёмщика — обеспечитель не двигается молча (М-5)',
  (() => { const rs = JSON.parse(vAts.ev("JSON.stringify(reqsOfBorrower('01204199910016')"
      + ".map(r=>({role:r.role,ph:r.phase})))"));
    return rs.filter(r => r.role === 'поручитель').every(r => r.ph === 'Досудебное урегулирование'); })());

ok('КЗ-29. пауза — состояние требования: фаза подменяется, фактическая названа рядом (М-11 · В-6)',
  (() => { const f = cvTab('06601199960061');            // PR-602: обращение о реструктуризации
    const row = cvRows(f).find(tr => /PR-602/.test(tr.dataset.pr));
    const t = cellText(row, 3);
    return /Рассмотрение вопроса реструктуризации/.test(t) && /факт: Иск/.test(t)
      && f.ev("(r=>displayPhaseOf(r) !== reqPhase(r))"
            + "(reqsOfBorrower('06601199960061').find(x=>x.proc.id==='PR-602'))"); })());

ok('КЗ-30. архив — свёрнутый список требований, закрытие производно от дела (М-9)',
  (() => { const f = cvTab('09901199990091');
    const d = f.$('#cvArch');
    return !!d && d.tagName === 'DETAILS' && !d.hasAttribute('open')
      && /закрыт\S* требован/.test(d.querySelector('summary').textContent)
      && cvRows(f).length === 0; })());

ok('КЗ-30. исход вне закрытого словаря помечен, а не выдан за штатный (§3.3)',
  (() => { const f = cvTab('09901199990091');
    const t = f.$('#cvArch').textContent.replace(/\s+/g,' ');
    return /Долг переведён правопреемнику \(ПД-231\)/.test(t)
      && /вне закрытого словаря исходов/.test(t)
      && f.ev("TERMINAL_OUTCOMES.has('Полное погашение') && "
            + "!TERMINAL_OUTCOMES.has('Долг переведён правопреемнику (ПД-231)')"); })());

ok('Б-10. итог по валютам порознь, требование считается один раз на кредит (И-12 · §2.2)',
  (() => { const f = mk();
    f.ev("CREDITS.find(c=>c.id==='C-ATS-NECEL').currency='USD'");
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const feet = [...f.$$('#cvWrap > table > tfoot > tr')]
      .map(tr => tr.textContent.replace(/\s+/g,' ').trim());
    const tot = JSON.parse(f.ev("JSON.stringify(reqTotals(reqsOfBorrower('01204199910016')"
      + ".filter(r=>!isReqClosed(r))))"));
    return feet.length === 2 && feet.some(t => /USD/.test(t)) && feet.some(t => /KGS/.test(t))
      && tot.USD.claim === 5330000 && tot.USD.n === 1        // 2 требования, но кредит один
      && tot.KGS.claim === 9898000 && tot.KGS.n === 1; })());

/* ── Вкладка 6 «Кураторство»: КЗ-32…КЗ-34 ──────────────────────────────────────
   Вкладка отвечала на вопрос «кто ведёт», но молчала о времени: дыра покрытия не
   называла своего начала, приостановка — своей даты, заявка на передачу — давности.
   Работа без давности не приоритизируется: «не назначен» второй день и «не назначен»
   пятый месяц выглядели одной строкой. Плюс два слова чужого словаря: статусы передачи
   в зеркале звались по-своему («в очереди»/«исполнен» против 'ожидает'/'подтверждён'
   у владельца), а «Фаза» в конфликте интересов значила не то, что фаза во взыскании
   (ADR-0002). Отстранение действует на весь ИНН (И-4), и замещающим не может быть
   тот, кто сам отстранён. */
const kuTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('кураторство'))"); return f; };
const kuPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('кураторство')") + '"]');
const kuText  = f => f.$('#kuWrap').textContent.replace(/\s+/g,' ');
const kuAts    = kuTab('01204199910016');   // дыра по КР-60541 + зависшая передача по КР-60540

ok('КЗ-32. дыра покрытия называет начало и давность, а не только причину',
  (() => { const gs = JSON.parse(kuAts.ev("JSON.stringify(curatorGaps('01204199910016',TODAY)"
      + ".map(g=>({no:g.objectNo,since:g.since,days:g.days})))"));
    return gs.length === 1 && gs[0].no === 'КР-60541'
      && gs[0].since === '10.07.2026' && gs[0].days === 3     // с даты заявления о конфликте
      && /3 дн\. с 10\.07\.2026/.test(kuText(kuAts)); })());

ok('КЗ-32. начало дыры берётся из факта, который её открыл, а не из даты просмотра',
  (() => { const f = mk();
    // 1) назначение закрыто — дыра открыта с даты закрытия
    f.ev("ASSIGN.find(a=>a.objectId==='C-ATS-OK' && a.role==='кредитный куратор').to='01.06.2026'");
    f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const closed = JSON.parse(f.ev("JSON.stringify(curatorGaps('01204199910016',TODAY)"
      + ".find(g=>g.objectNo==='КР-60542'))"));
    // 2) назначения не было вовсе — дыра открыта с выдачи кредита (роль обязана быть с первого дня)
    const f2 = mk();
    f2.ev("ASSIGN.splice(ASSIGN.findIndex(a=>a.objectId==='C-ATS-OK' && a.role==='кредитный куратор'),1)");
    const never = JSON.parse(f2.ev("JSON.stringify(curatorGaps('01204199910016',TODAY)"
      + ".find(g=>g.objectNo==='КР-60542'))"));
    return closed.since === '01.06.2026' && closed.days === 42
      && never.since === f2.ev("CREDITS.find(c=>c.id==='C-ATS-OK').date"); })());

ok('КЗ-32. приостановка датирована: «приостановлен с …» вместо безымянной пометки',
  /приостановлен с 10\.07\.2026 · конфликт интересов/.test(kuText(kuAts))
  && kuAts.ev("suspendedSince('emp-07','01204199910016',TODAY)") === '10.07.2026');

ok('КЗ-32. фильтр по кредиту сужает множество покрытия и подписывает, что показан не весь',
  (() => { const f = kuTab('01204199910016');
    const sel = f.$('#kuCred');
    sel.value = 'C-ATS-GAZ'; sel.dispatchEvent(new f.w.Event('change'));
    const one = f.$('#kuWrap').textContent.replace(/\s+/g,' ');
    sel.value = 'all'; sel.dispatchEvent(new f.w.Event('change'));
    const all = f.$('#kuWrap').textContent.replace(/\s+/g,' ');
    return /показан один кредит из 3/.test(one) && /КР-60541/.test(one) && !/КР-60540/.test(one)
      && /КР-60540/.test(all) && /КР-60542/.test(all)
      && sel.hasAttribute('data-view-ctl'); })());       // орган просмотра, не правки (И-5)

ok('КЗ-33. в очереди стоят только живые заявки; закрытые ушли в свёрнутый журнал',
  (() => { const t = kuText(kuAts);
    const live = [...kuAts.$$('#kuWrap table')][1];        // вторая таблица — очередь передач
    const arch = kuAts.$('#kuHoArch');
    return /КР-60540/.test(live.textContent) && !/КР-60541/.test(live.textContent)
      && !!arch && /Журнал закрытых передач · 1 заявка/.test(arch.textContent)
      && /отклонён/.test(arch.textContent) && /приём не подтверждён/.test(t); })());

ok('КЗ-33. давность заявки считается и сравнивается с порогом владельца (10 к.д., §8)',
  (() => { const fresh = kuTab('06601199960061');        // заявка от 10.07.2026 — 3 дн.
    return /висит 54 дн\./.test(kuText(kuAts))
      && kuAts.ev("staleHandoffs('01204199910016',TODAY).length") === 1
      && !/висит/.test(kuText(fresh))
      && fresh.ev("liveHandoffs('06601199960061').length") === 1
      && fresh.ev("staleHandoffs('06601199960061',TODAY).length") === 0; })());

ok('КЗ-33. зависшая заявка поднимает дефект, и полоса вкладки — проекция общего движка',
  (() => { const codes = JSON.parse(kuAts.ev("JSON.stringify(defects('01204199910016',TODAY)"
      + ".filter(x=>x.tab===tabIx('кураторство')).map(x=>x.code))"));
    const bar = kuPanel(kuAts).querySelector('.defect-bar');
    return codes.includes('Д-ПЕР') && codes.includes('Д-КУР') && codes.includes('Д-КОНФ')
      && bar && bar.querySelectorAll('.badge').length === codes.length
      && /Очередь передач · 1 заявка не принята свыше 10 к\.д\./.test(bar.textContent); })());

ok('КЗ-33. словарь статусов передачи — владельца (kuratorstvo.html), а не свой',
  (() => { const OWN = readFileSync(resolve('mockups/kuratorstvo/kuratorstvo.html'), 'utf8');
    const mine = JSON.parse(kuAts.ev("JSON.stringify([...new Set(HANDOFF.map(h=>h.status))])"));
    /* «в очереди» в карточке ещё живёт — но в другом смысле (очередь событий на комитет),
       поэтому сверяется не файл целиком, а сам блок передач: статус в нём только из словаря. */
    const block = HTML.match(/const HANDOFF = \[\];[\s\S]*?^\);$/m)[0];
    return mine.every(s => ['ожидает','подтверждён','отклонён'].includes(s))
      && ['ожидает','подтверждён','отклонён'].every(s => OWN.includes("'" + s + "'"))
      && (block.match(/status:'[^']+'/g) || []).every(x => /'ожидает'|'подтверждён'|'отклонён'/.test(x))
      && !/'в очереди'|'исполнен'/.test(HTML); })());

ok('КЗ-34. колонка «Фаза» в конфликте интересов названа «Ходом рассмотрения»',
  (() => { const head = [...kuPanel(kuAts).querySelectorAll('table')]
      .map(t => t.querySelector('thead').textContent.replace(/\s+/g,' '))
      .find(h => /Замещающий/.test(h));
    return /Ход рассмотрения/.test(head) && !/Фаза/.test(head); })());

ok('КЗ-34. живой конфликт отделён от урегулированного тем же предикатом, что И-4',
  (() => { const done = kuTab('03301199930031');         // CF-13 урегулирован передачей дела
    const arch = done.$('#kuConfArch');
    return !kuAts.$('#kuConfArch')                        // у 012 архива нет — конфликт живой
      && /Родственная связь/.test(kuPanel(kuAts).textContent)
      && !!arch && /урегулированное заявление/.test(arch.textContent)
      && /снято 20\.06\.2026/.test(arch.textContent)
      && /Действующих заявлений о конфликте интересов нет/.test(kuPanel(done).textContent)
      && done.ev("suspendedEmployees('03301199930031',TODAY).length") === 0; })());

ok('КЗ-34 / G4. замещающим не может быть тот, кто сам отстранён',
  (() => { const tbl = [...kuPanel(kuAts).querySelectorAll('table')]
      .find(t => /Замещающий/.test(t.querySelector('thead').textContent));
    const cells = [...tbl.querySelectorAll('tbody tr td')];
    return /нет активного куратора/.test(cells[cells.length-1].textContent); })());

/* ── Вкладка 7 «Акты сверок»: КЗ-35 · КЗ-36 (вторая половина) · Б-8 · Б-13 · Б-16 ──
   Акт сверки — документ на заёмщика, и сверяет он ту же задолженность, что показывает
   карточка. Значит состав статей у акта и у кредита обязан быть ОДИН: раньше акт вёл три
   статьи своими словами («Штрафы» вместо пени), карточка — пять, и первый же ненулевой сбор
   развёл бы их молча (Б-8). Проверяем не текст шапки, а происхождение состава: словарь ART_RU
   один на файл и совпадает с глоссарием CONTEXT. Отдельно — что пятая статья (расходы по
   обращению взыскания) в долг по кредиту не входит: ею владеет взыскание (CONTEXT).
   КЗ-36: перечень кредитов акта называется составом акта, слово «охват» остаётся за
   предметом требования. Б-13: пороги вынесены в константы и честно названы внутренними.
   Б-16 (найден при этой правке): строка акта, ссылающаяся на кредит вне реестра, считается
   движком дефектов и помечается в таблице — оба следствия идут от одного счёта. */
const acTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('акты'))"); return f; };
const acPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('акты')") + '"]');
const acText  = f => acPanel(f).textContent.replace(/\s+/g,' ');
const acSub   = (f, id) => f.$('#actsWrap tr.pl-sub[data-sub="' + id + '"]').textContent.replace(/\s+/g,' ');
const acAts   = acTab('01204199910016');   // АгроТехСервис: подписанный акт + акт на подписании
const acTalas = acTab('05501199950051');   // Талас Стройсервис: уклонение + разногласия

ok('КЗ-35. состав статей акта берётся из общего словаря, а не переписан своими словами',
  (() => { const head = [...acAts.$$('#actsWrap table.mini thead th')].map(t => t.textContent.trim());
    const arts = acAts.ev("JSON.stringify(ART.map(k=>ART_TH[k]))");
    return acAts.ev("Object.keys(ART_RU).join(',')") === acAts.ev("ART.join(',')")
      && JSON.parse(arts).every(ru => head.includes(ru))
      && head.indexOf('Основной долг') < head.indexOf('Проценты')
      && head.indexOf('Проценты') < head.indexOf('Пеня'); })());

ok('КЗ-35. словарь статей совпадает с глоссарием CONTEXT («Статья долга»)',
  (() => { const ctx = readFileSync(resolve('CONTEXT.md'), 'utf8');
    const m = ctx.match(/\*\*Статья долга\*\*:\s*\n([\s\S]*?)\n_Avoid_/);
    if (!m) return false;
    const line = m[1].replace(/\s+/g,' ');
    return acAts.ev("Object.values(ART_RU)").every(ru => line.includes(ru.toLowerCase())); })());

ok('КЗ-35. слова «Штрафы» в карточке не осталось — статья называется пеней',
  !/Штраф/.test(acText(acAts) + acText(acTalas)) && !/'Штрафы'|>Штрафы</.test(HTML));

ok('КЗ-35 / Б-8. ненулевой сбор попадает в итог акта — на трёх статьях он терялся',
  (() => { const t = acAts.ev("JSON.stringify(actTotals(ACTS.find(a=>a.id==='ACT-118')).KGS)");
    const k = JSON.parse(t);
    return k.fees === 45000 && k.total === 15745000
      && k.total === k.principal + k.interest + k.penalty + k.fees   // четыре кредитные статьи
      && acSub(acAts, 'ACT-118').includes('15 745 000'); })());

ok('КЗ-35. пятая статья не входит в долг по кредиту — ею владеет взыскание',
  (() => { const t = JSON.parse(acTalas.ev("JSON.stringify(actTotals(ACTS.find(a=>a.id==='ACT-77')).KGS)"));
    const sub = acSub(acTalas, 'ACT-77');
    return t.costs === 62000 && t.total === 9200000 && t.all === t.total + t.costs
      && /Расходы по взысканию/.test(sub)
      && /в вопрос «погашен ли кредит» они не входят/.test(sub); })());

ok('КЗ-35. подпись о расходах появляется только там, где расходы есть',
  !/в вопрос «погашен ли кредит»/.test(acSub(acAts, 'ACT-118')));

ok('КЗ-36. перечень кредитов акта назван составом акта, а не охватом',
  (() => { const head = [...acAts.$$('#actsWrap > .section table th')].map(t => t.textContent.trim());
    return head.includes('Состав акта') && !/хват/.test(acText(acAts))
      && !/scope:/.test(HTML.match(/^ACTS\.push\(([\s\S]*?)^\);/m)[1]); })());

ok('КЗ-36. слово «охват» осталось за предметом требования (вкладка «Взыскание»)',
  (() => { const f = card('05501199950051');
    f.ev("switchTab(tabIx('взыскание'))");
    return /Охват/.test(f.$('.tabpanel[data-panel="' + f.ev("tabIx('взыскание')") + '"]').textContent); })());

ok('Б-13. порог уклонения вынесен в константу и назван внутренним, а не выдан за норму',
  (() => { const sub = acSub(acTalas, 'ACT-77');
    return acAts.ev("ACT_EVASION_DAYS") === 60
      && /свыше 60 к\.д\. \(внутренний порог, нормой не установлен\)/.test(sub)
      && /84 к\.д\./.test(sub); })());

ok('Б-13. пороги свежести снимка тоже стали константами — числа не живут в выражениях',
  acAts.ev("SNAPSHOT_FRESH_DAYS") === 183 && acAts.ev("SNAPSHOT_STALE_DAYS") === 365
    && !/days <= 183|days <= 365|takenAt, asOf\(\)\) > 365/.test(HTML));

ok('Б-16. строка акта без своего кредита помечена в таблице',
  (() => { const sub = acSub(acAts, 'ACT-121');
    return /C-ATS-USD/.test(sub) && /нет в реестре кредитов/.test(sub); })());

ok('Б-16 / один движок. тот же факт считает defects(), полоса вкладки — его проекция',
  (() => { const d = acAts.ev("JSON.stringify(defects('01204199910016',TODAY).filter(x=>x.tab===tabIx('акты')).map(x=>x.code))");
    const badges = acAts.$$('#actsWrap .defect-bar .badge').length;
    return JSON.parse(d).join(',') === 'Д-АКТ-РЕЕСТР' && badges === 1
      && /1 строка акта вне реестра кредитов/.test(acText(acAts)); })());

ok('Один движок. у Талас Стройсервиса полоса вкладки повторяет счёт движка (Д-АКТ)',
  (() => { const codes = JSON.parse(acTalas.ev("JSON.stringify(defects('05501199950051',TODAY).filter(x=>x.tab===tabIx('акты')).map(x=>x.code))"));
    return codes.join(',') === 'Д-АКТ'
      && acTalas.$$('#actsWrap .defect-bar .badge').length === codes.length
      && /2 акта не подтверждены/.test(acText(acTalas)); })());

/* ── Вкладка 8 «Проверки и дефекты»: КЗ-37 · Б-17 ──────────────────────────────
   Вкладка — третья подача одного движка (КЗ-22), а не свой набор проверок. Отсюда всё:
   список обязан совпадать с тем, что считает шапка и печатает счётчик вкладки (Б-17),
   кнопки пересчёта быть не может (производная считается при отображении, ADR-0001),
   а классификации на вкладке проверок — справочная строка, не третья сущность. */
const chTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('проверки'))"); return f; };
const chPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('проверки')") + '"]');
const chText  = f => chPanel(f).textContent.replace(/\s+/g, ' ');
const chAts   = chTab('01204199910016');   // дефекты залога и взыскания есть
const chClean = chTab('10001199900101');   // погашенный кредит — чужих дефектов нет

ok('Б-17. список вкладки — проекция общего движка: дефекты залога и взыскания в нём есть',
  (() => { const foreign = chAts.ev("JSON.stringify(defects('01204199910016',asOf()).filter(x=>x.area!=='заёмщик').map(x=>x.code))");
    const codes = [...new Set(JSON.parse(foreign))].sort();
    const t = chText(chAts);
    return codes.join(',') === 'Д-ВЗЫСК,Д-ЗАЛ' && codes.every(c => t.includes(c)); })());

ok('Б-17. число дефектов в таблице равно счётчику вкладки — над таблицей не висит чужая цифра',
  /* считаем по DOM: строка-дефект помечена ⛔ (стоп) или ⚠ (степень). Пройденная (✓) и
     справочная (i) — не дефекты: с Б-21 справочная запись выпала и из defects(), и из
     счётчика вкладки, поэтому предикат называет разряды прямо, а не «всё, кроме галочки». */
  (() => {
    const rows = [...chPanel(chAts).querySelectorAll('table.grid')[0].querySelectorAll('tbody tr')];
    const bad = rows.filter(r => /^[⛔⚠]/.test(r.querySelector('td.who').textContent.trim())).length;
    return bad > 0 && bad === chAts.ev("tabCount('01204199910016','проверки')"); })());

ok('Б-17. разряды итога не пересекаются и в сумме дают длину списка',
  (() => { const m = /Стоп-факторов: (\d+) · предупреждений: (\d+) ·(?: справочно: (\d+) ·)? пройдено: (\d+) — .*? всего проверок (\d+)/.exec(chText(chAts));
    if (!m) return false;
    const [stop, warn, info, pass, total] = [m[1], m[2], m[3] || '0', m[4], m[5]].map(Number);
    const len = chAts.ev("borrowerChecks('01204199910016',asOf()).length"
      + " + defects('01204199910016',asOf()).filter(x=>x.area!=='заёмщик').length");
    return stop + warn + info + pass === total && total === len; })());

ok('Б-17. стоп-фактор считается один раз: он в «стоп», а не ещё и в «предупреждениях»',
  (() => { const m = /Стоп-факторов: (\d+) · предупреждений: (\d+)/.exec(chText(chAts));
    const stop = chAts.ev("borrowerChecks('01204199910016',asOf()).concat(defects('01204199910016',asOf())"
      + ".filter(x=>x.area!=='заёмщик')).filter(c=>c.stop).length");
    const warn = chAts.ev("borrowerChecks('01204199910016',asOf()).concat(defects('01204199910016',asOf())"
      + ".filter(x=>x.area!=='заёмщик')).filter(c=>!c.stop && (c.sev==='high'||c.sev==='mid')).length");
    return !!m && Number(m[1]) === stop && Number(m[2]) === warn && stop > 0; })());

ok('Б-17. чужой дефект ведёт на свою вкладку, а не пересказывает разбор третьим текстом',
  (() => { const links = [...chPanel(chAts).querySelectorAll('a.lnk')]
      .filter(a => /разобрано на вкладке/.test(a.textContent));
    const tabs = links.map(a => a.getAttribute('href').split('/').pop());
    return links.length >= 2
      && tabs.includes(String(chAts.ev("tabIx('обеспечение')")))
      && tabs.includes(String(chAts.ev("tabIx('взыскание')"))); })());

ok('КЗ-37. кнопки «Проверить заново» нет: пересчитывать нечего (ADR-0001)',
  !/Проверить заново/.test(chText(chAts))
  && [...chPanel(chAts).querySelectorAll('button')].every(b => !/[Пп]ровери|[Пп]ересчит/.test(b.textContent)));

ok('КЗ-37. классификации — справочная строка, а не секция с рамкой',
  (() => { const t = chText(chAts);
    return !/Справочно — классификации/.test(t)
      && /Справочно · категория риска/.test(t)
      && /проверкой не являются/.test(t)
      && [...chPanel(chAts).querySelectorAll('.section .section-head')]
           .every(h => !/классификац/i.test(h.textContent)); })());

ok('КЗ-16. кнопка «запросить свежий снимок» отвечает маршрутом, а не молчанием',
  (() => { const b = [...chPanel(chAts).querySelectorAll('button')]
      .find(x => /свежий снимок/.test(x.textContent));
    return !!b && /notRouted\('модуль заявок'\)/.test(b.getAttribute('onclick') || ''); })());

ok('Б-17. карточка без чужих дефектов даёт список ровно из своих проверок',
  (() => { const t = chText(chClean);
    return chClean.ev("defects('10001199900101',asOf()).filter(x=>x.area!=='заёмщик').length") === 0
      && !/разобрано на вкладке/.test(t)
      && chClean.ev("borrowerChecks('10001199900101',asOf()).length")
         === chPanel(chClean).querySelectorAll('table.grid')[0].querySelectorAll('tbody tr').length; })());

/* ── Вкладка 9 «Документы»: КЗ-38 · Б-7 · Б-18 ─────────────────────────────────
   Знаменатель досье идёт от того, что ТРЕБУЕТСЯ (объекты в реестрах), а не от того, что уже
   лежит в папке: иначе объект без документов выпадает и из перечня, и из знаменателя, и ноль
   документов читается как полный комплект. Заявки непроверяемы — реестра заявок здесь нет. */
const dcTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('документы'))"); return f; };
const dcPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('документы')") + '"]');
const dcText  = f => dcPanel(f).textContent.replace(/\s+/g, ' ');
/* секция по заголовку: возвращает {head, rows} */
const dcSect  = (f, title) => { const s = [...dcPanel(f).querySelectorAll('.section')]
    .find(x => (x.querySelector('.section-head') || {}).textContent
      && x.querySelector('.section-head').textContent.trim().startsWith(title));
  return s ? { head: s.querySelector('.section-head').textContent.replace(/\s+/g,' '),
               rows: [...s.querySelectorAll('tbody tr')] } : null; };
const dcAts   = dcTab('01204199910016');   // 2 действующих залога, документ вне реестра, документ заявки
const dcClosed= dcTab('10001199900101');   // залог снят с ареста
const dcExp   = dcTab('06601199960061');   // полис на технике истёк
const dcNoTech= dcTab('04401199940041');   // залог без техники — полис не требуется

ok('Б-7. перечень объектов залога идёт из реестра, а не из приложенных документов',
  (() => { const s = dcSect(dcAts, 'Залог'); if (!s) return false;
    const nos = dcAts.ev("JSON.stringify(PLEDGE_AGR.filter(a=>a.inn==='01204199910016').map(a=>a.no))");
    const txt = s.rows.map(r => r.textContent).join(' ');
    const docd = dcAts.ev("DOCS.filter(d=>d.inn==='01204199910016'&&d.scope.kind==='залог'&&PLEDGE_AGR.some(a=>a.id===d.scope.ref)).length");
    return JSON.parse(nos).length === 2 && JSON.parse(nos).every(n => txt.includes(n)) && docd === 0; })());

ok('Б-7. залог без единого документа всё равно даёт свои требования в знаменателе',
  (() => { const s = dcSect(dcAts, 'Залог');
    const st = dcAts.ev("JSON.stringify(dossierStats('01204199910016').byKind['залог'])");
    const k = JSON.parse(st);
    return !!s && k.need === 6 && k.met === 2 && /2 из 6/.test(s.head); })());

ok('Б-7. процент досье считается от реестров: цифра полосы и основание Д-ДОСЬЕ — одна и та же',
  (() => { const t = dcText(dcAts);
    const st = JSON.parse(dcAts.ev("JSON.stringify(dossierStats('01204199910016'))"));
    const basis = dcAts.ev("borrowerChecks('01204199910016',asOf()).find(c=>c.code==='Д-ДОСЬЕ').basis");
    return t.includes(st.met + ' из ' + st.req + ' обязательных документов приложено')
      && basis.includes('приложено ' + st.met + ' из ' + st.req)
      && t.includes(Math.round(st.met / st.req * 100) + '%'); })());

ok('КЗ-38. заявки показаны, но не посчитаны: раздела нет ни в DOC_KINDS, ни в знаменателе',
  (() => { const s = dcSect(dcAts, 'Заявки'); if (!s) return false;
    const inKinds = dcAts.ev("DOC_KINDS.indexOf('заявка')");
    const app = dcAts.ev("appDocs('01204199910016').length");
    const before = dcAts.ev("dossierStats('01204199910016').req");
    return inKinds === -1 && app === 1 && s.rows.length === 1 && /не считается/.test(s.head)
      && before === dcAts.ev("DOC_KINDS.reduce((n,k)=>n+docRefs('01204199910016',k).reduce((m,r)=>m+reqForRef('01204199910016',k,r).length,0),0)"); })());

ok('КЗ-16. раздел заявок отвечает маршрутом в свой модуль, а не молчанием',
  (() => { const s = dcSect(dcAts, 'Заявки');
    const b = s && [...dcPanel(dcAts).querySelectorAll('button')].find(x => /Открыть заявки/.test(x.textContent));
    return !!b && /notRouted\('модуль заявок'\)/.test(b.getAttribute('onclick') || ''); })());

ok('КЗ-38. по снятому залогу срочные документы не требуются — «истёк» не висит вечно',
  (() => { const s = dcSect(dcClosed, 'Залог'); if (!s) return false;
    const req = JSON.parse(dcClosed.ev("JSON.stringify(reqForRef('10001199900101','залог',docRefs('10001199900101','залог')[0]).map(r=>r.t))"));
    return req.join(',') === 'Договор залога' && s.rows.length === 1
      && /снят/.test(s.rows[0].textContent) && !/истёк/.test(s.rows[0].textContent); })());

ok('Б-18. полис читается из источника: срок со вкладки «Обеспечение», а не «нет» в досье',
  (() => { const s = dcSect(dcAts, 'Залог'); if (!s) return false;
    const row = s.rows.find(r => /Страховой полис/.test(r.textContent));
    const till = dcAts.ev("(policyStatus(docRefs('01204199910016','залог')[0]).obj||{}).policyTill");
    return !!row && !!till && row.textContent.includes(till) && !/\bнет\b/.test(row.textContent); })());

ok('Б-18. истёкший полис досье и вкладка «Обеспечение» называют одинаково',
  (() => { const s = dcSect(dcExp, 'Залог'); if (!s) return false;
    const bad = s.rows.filter(r => /Страховой полис/.test(r.textContent) && /истёк/.test(r.textContent));
    return bad.length === dcExp.ev("dossierStats('06601199960061').exp")
      && bad.length === dcExp.ev("docRefs('06601199960061','залог').filter(r=>policyStatus(r).code==='expired').length"); })());

ok('Б-18. где техники нет — полис не требуется: строки-требования тоже нет',
  (() => { const s = dcSect(dcNoTech, 'Залог'); if (!s) return false;
    return dcNoTech.ev("docRefs('04401199940041','залог').every(r=>!pledgeTech(r).length)")
      && s.rows.every(r => !/Страховой полис/.test(r.textContent)); })());

ok('Б-18. документ вне реестра виден строкой с меткой, а не исчезает молча',
  (() => { const s = dcSect(dcAts, 'Залог'); if (!s) return false;
    const orph = JSON.parse(dcAts.ev("JSON.stringify(orphanDocs('01204199910016').map(d=>d.scope.ref))"));
    const marked = s.rows.filter(r => /нет в реестре договоров залога/.test(r.textContent));
    return orph.length === 1 && marked.length === 1 && marked[0].textContent.includes(orph[0])
      && /1 вне реестра/.test(s.head); })());

ok('Б-18 / один движок. тот же факт считает Д-ДОСЬЕ-РЕЕСТР, полоса вкладки — его проекция',
  (() => { const d = JSON.parse(dcAts.ev("JSON.stringify(defects('01204199910016',asOf())"
      + ".filter(x=>x.tab===tabIx('документы')).map(x=>x.code))"));
    const badges = [...dcPanel(dcAts).querySelectorAll('.defect-bar .badge')];
    return d.includes('Д-ДОСЬЕ-РЕЕСТР') && badges.length === d.length
      && badges.some(b => /вне реестра объектов/.test(b.textContent)); })());

/* ── Вкладка 10 «Реквизиты и связи»: КЗ-39 · КЗ-40 · Б-19 · Б-20 · Б-21 ────────
   Вкладка выводит два чужих множества: лица ведёт реестр лиц, реквизиты принадлежат
   СУБЪЕКТУ. Значит здесь не должно остаться ни одной точки ввода, каждый маршрут наружу
   обязан вести в живое место, а идентификатор лица — называться своим именем (ПИН). */
const lkTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('связи'))"); return f; };
const lkPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('связи')") + '"]');
const lkText  = f => lkPanel(f).textContent.replace(/\s+/g, ' ');
const lkSect  = (f, title) => { const s = [...lkPanel(f).querySelectorAll('.section')]
    .find(x => (x.querySelector('.section-head') || {}).textContent
      && x.querySelector('.section-head').textContent.trim().startsWith(title));
  return s ? { head: s.querySelector('.section-head').textContent.replace(/\s+/g,' '),
               rows: [...s.querySelectorAll('tbody tr')], el: s } : null; };
const lkAts   = lkTab('01204199910016');   // 3 связанных лица (одно — субъект), группа ГЗПМ-7
const lkGrp2  = lkTab('11101199900111');   // второй член той же группы
const lkNoCh  = lkTab('20190119991019');   // все каналы закрыты — уведомить нечем
const lkFiz   = lkTab('07701199970071');   // физлицо: ни связей, ни группы

ok('КЗ-39. идентификатор связанного лица назван ПИНом, а колонки «ИНН» над ПИНом нет',
  (() => { const s = lkSect(lkAts, 'Связанные лица'); if (!s) return false;
    const th = [...s.el.querySelectorAll('thead th')].map(x => x.textContent.trim());
    const pins = lkAts.ev("JSON.stringify(RELATED.filter(r=>r.inn==='01204199910016').map(r=>r.pin))");
    return th.includes('ПИН') && !th.includes('ИНН')
      && JSON.parse(pins).every(p => s.rows.some(r => r.textContent.includes(p))); })());

ok('КЗ-39. связанное лицо, заведённое субъектом, ведёт на страницу лица; прочие — в реестр',
  (() => { const s = lkSect(lkAts, 'Связанные лица'); if (!s) return false;
    const withSubj = s.rows.filter(r => r.querySelector('td.who a'));
    const cnt = lkAts.ev("RELATED.filter(r=>r.inn==='01204199910016' && r.subjInn).length");
    return withSubj.length === cnt && cnt > 0
      && withSubj[0].querySelector('td.who a').getAttribute('href')
         === '../subject/subject.html#/s/07701199970071'; })());   // СБ-14: страница лица — в макете субъекта

ok('Б-19. роль «Связанное лицо» выводится по ИНН субъекта, а не сопоставлением ФИО',
  (() => { const roles = JSON.parse(lkAts.ev("JSON.stringify(subjectRoles('07701199970071').map(r=>r.role))"));
    /* переименование лица роль не рвёт: имя не участвует в счёте */
    const after = JSON.parse(lkAts.ev("(()=>{const s=SUBJECTS.find(x=>x.inn==='07701199970071');"
      + "const old=s.name; s.name='ПЕРЕИМЕНОВАН';"
      + "const r=JSON.stringify(subjectRoles('07701199970071').map(x=>x.role)); s.name=old; return r;})()"));
    return roles.includes('Связанное лицо') && after.includes('Связанное лицо'); })());

ok('КЗ-39. ГЗПМ показана только тем, кто в группе состоит, и состоит из лиц с ИНН',
  (() => { const s = lkSect(lkAts, 'Группа совместного риска'); if (!s) return false;
    const members = JSON.parse(lkAts.ev("JSON.stringify(GROUPS.find(g=>g.id==='ГЗПМ-7').members)"));
    const hasBlock = members.every(m => s.rows.some(r => r.textContent.includes(m)));
    return hasBlock && s.rows.length === members.length
      && !lkSect(lkFiz, 'Группа совместного риска')            // не в группе — блока нет вовсе
      && !!lkSect(lkGrp2, 'Группа совместного риска'); })());   // второй член видит ту же группу

ok('КЗ-39. член группы, кроме самого заёмщика, ведёт на свою карточку',
  (() => { const s = lkSect(lkAts, 'Группа совместного риска'); if (!s) return false;
    const self = s.rows.find(r => r.textContent.includes('этот заёмщик'));
    const other = s.rows.find(r => !r.textContent.includes('этот заёмщик'));
    return !!self && !self.querySelector('a')
      && !!other && other.querySelector('a').getAttribute('href') === '#/b/11101199900111'; })());

ok('КЗ-40. на вкладке не осталось ни одной точки ввода: ни формы, ни молчащей кнопки',
  (() => { const p = lkPanel(lkAts);
    const inputs = [...p.querySelectorAll('input,select,textarea')];
    const mute = [...p.querySelectorAll('button')].filter(b => !b.getAttribute('onclick'));
    return inputs.length === 0 && mute.length === 0; })());

/* СБ-14: вторая половина этой проверки («и эта страница их показывает») удалена вместе с
   экраном — показывает их теперь владелец, mockups/subject/subject.html. Здесь остаётся то,
   за что отвечает карточка: правка не делается на месте, а уходит наружу по рабочему адресу. */
ok('КЗ-40. правка реквизитов уходит наружу — к владельцу, в макет субъекта',
  (() => { const s = lkSect(lkAts, 'Каналы связи'); if (!s) return false;
    const a = s.el.querySelector('.section-head a');
    return !!a && a.getAttribute('href') === '../subject/subject.html#/s/01204199910016'
      && a.getAttribute('target') === '_blank'; })());

ok('Б-20. канал показан теми же признаками, что на витрине: основной и дата сверки',
  (() => { const s = lkSect(lkAts, 'Каналы связи'); if (!s) return false;
    const main = lkAts.ev("liveChannels('01204199910016')[0].value");
    const chk  = lkAts.ev("liveChannels('01204199910016')[0].checkedAt");
    const first = s.rows[0].textContent;
    return first.includes(main) && first.includes('основной') && first.includes(chk)
      && /не сверялся/.test(s.el.textContent); })());   // канал без сверки честно подписан

ok('Д-КОНТ. заёмщик без действующих каналов поднимает дефект, и полоса вкладки его показывает',
  (() => { const d = JSON.parse(lkNoCh.ev("JSON.stringify(defects('20190119991019',asOf())"
      + ".filter(x=>x.tab===tabIx('связи')).map(x=>x.code))"));
    const badges = [...lkPanel(lkNoCh).querySelectorAll('.defect-bar .badge')];
    return lkNoCh.ev("liveChannels('20190119991019').length") === 0
      && d.length === 1 && d[0] === 'Д-КОНТ' && badges.length === 1
      && /действующих каналов нет/.test(badges[0].textContent); })());

ok('Б-21. справочная запись (sev info) не идёт в дефекты и не печатается «замечанием»',
  (() => { const inDef = lkAts.ev("defects('01204199910016',asOf()).some(x=>x.code==='Д-СВЯЗ')");
    const inChecks = lkAts.ev("borrowerChecks('01204199910016',asOf()).some(c=>c.code==='Д-СВЯЗ' && c.sev==='info')");
    const noInfo = lkAts.ev("defects('01204199910016',asOf()).every(x=>x.sev==='high'||x.sev==='mid')");
    /* у заёмщика со связями, но без дефектов вкладки, полоса говорит «дефектов нет» */
    return !inDef && inChecks && noInfo
      && /Дефектов реквизитов и связей нет/.test(lkText(lkAts)); })());

/* ── Вкладка 11 «История»: КЗ-41 · Б-22 · Б-23 ─────────────────────────────────
   Ленту ведёт одна вкладка (И-10), поэтому вопрос к ней двойной: ВЕСЬ ли модельный факт
   с датой в неё попал и можно ли в ней найти нужное. Отсюда три группы проверок: состав
   (реквизиты и связи), органы просмотра (поиск, период, переход к году) и итог — лента
   обязана считать ровно то множество, которое показывает (И-12). */
const hsTab   = inn => { const f = card(inn); f.ev("switchTab(tabIx('история'))"); return f; };
const hsPanel = f => f.$('.tabpanel[data-panel="' + f.ev("tabIx('история')") + '"]');
const hsText  = f => hsPanel(f).textContent.replace(/\s+/g, ' ');
const hsItems = f => [...hsPanel(f).querySelectorAll('#histRoot .tl-item')];
const hsVis   = f => hsItems(f).filter(el => el.style.display !== 'none');
const hsSum   = f => (f.$('#histSum') || {}).textContent || '';
const hsSet   = (f, id, v) => { f.$('#' + id).value = v; f.ev('histSearch()'); };
const hsAts   = hsTab('01204199910016');   // 52 события, 7 лет, req-полоса из 13 фактов
const hsFiz   = hsTab('07701199970071');   // физлицо без regDate: 6 фактов без даты
const hsQue   = hsTab('05501199950051');   // очередь на комитет — единственный носитель Д-ОЧЕР

ok('КЗ-41. датированные факты CHANNELS/BANK_REQ/RELATED/GROUPS вошли в ленту полосой «req»',
  (() => { const want = hsAts.ev(`(()=>{const inn='01204199910016';
      return CHANNELS.filter(c=>c.inn===inn).reduce((n,c)=>n+1+(c.checkedAt?1:0)+(c.closedAt?1:0),0)
        + BANK_REQ.filter(b=>b.inn===inn).length + RELATED.filter(r=>r.inn===inn).length
        + groupsOf(inn).length;})()`);
    const got = hsAts.ev("historyItems('01204199910016').filter(i=>i.cat==='req').length");
    return want === got && got === 13; })());

ok('КЗ-41. у канала три РАЗНЫЕ даты — заведён, сверен, закрыт, а не одна строка на канал',
  (() => { const req = JSON.parse(hsAts.ev("JSON.stringify(historyItems('01204199910016')"
      + ".filter(i=>i.cat==='req').map(i=>i.title+'|'+i.date))"));
    const ch = t => req.filter(x => x.startsWith(t)).length;
    return ch('Заведён канал связи') === 4 && ch('Канал сверен') === 2 && ch('Канал закрыт') === 1
      && req.includes('Канал закрыт: тел|01.01.2020')            // дата закрытия, не заведения
      && req.includes('Заведён канал связи: тел|14.02.2011'); })());

ok('КЗ-31. «Реквизиты и связи» получили хвост своей полосы и указатель в ленту с ?cat=req',
  (() => { const f = hsAts; f.ev("switchTab(tabIx('связи'))");
    const tl = f.$('.tabpanel[data-panel="' + f.ev("tabIx('связи')") + '"] .tab-tl');
    f.ev("switchTab(tabIx('история'))");
    if (!tl || tl.dataset.cat !== 'req') return false;
    const a = tl.querySelector('a.lnk[href]');
    return tl.querySelectorAll('.tl-item').length === 5      // пять последних, как у прочих вкладок
      && a && /\?cat=req$/.test(a.getAttribute('href')); })());

ok('КЗ-41. поиск сужает ленту, итог называет и показанное, и полное число',
  (() => { hsSet(hsAts, 'histQ', 'канал');
    const vis = hsVis(hsAts).length, all = hsItems(hsAts).length;
    const s = hsSum(hsAts);
    const okRes = vis === 7 && all === 52
      && s.includes('Показано 7 из 7') && s.includes('всего в ленте 52') && s.includes('поиск «канал»');
    hsAts.ev('histReset()');
    return okRes && hsVis(hsAts).length === 30 && /Событий в ленте: 52/.test(hsSum(hsAts)); })());

ok('КЗ-41. поиск без совпадений: лента пуста и говорит об этом, а не молчит',
  (() => { hsSet(hsAts, 'histQ', 'такого события нет');
    const none = hsAts.$('#histNone');
    const res = hsVis(hsAts).length === 0 && none.style.display !== 'none'
      && /Сбросить фильтры/.test(none.textContent);
    hsAts.ev('histReset()');
    return res && hsVis(hsAts).length === 30; })());

ok('КЗ-41. период отбирает окно дат, годы вне окна выключены',
  (() => { hsSet(hsAts, 'histFrom', '2011-01-01'); hsSet(hsAts, 'histTo', '2011-12-31');
    const vis = hsVis(hsAts);
    const years = [...hsPanel(hsAts).querySelectorAll('.hyear')];
    const on = years.filter(b => !b.disabled).map(b => b.dataset.y);
    const res = vis.length === 10 && vis.every(el => el.dataset.year === '2011')
      && on.length === 1 && on[0] === '2011'
      && hsSum(hsAts).includes('период 01.01.2011 — 31.12.2011');
    hsAts.ev('histReset()');
    return res; })());

ok('КЗ-41. начало периода позже конца — лента говорит об этом, а не притворяется пустой',
  (() => { hsSet(hsAts, 'histFrom', '2026-01-01'); hsSet(hsAts, 'histTo', '2011-12-31');
    const res = hsVis(hsAts).length === 0 && /начало периода позже конца/.test(hsSum(hsAts));
    hsAts.ev('histReset()');
    return res; })());

ok('И-12. факт без даты не исчезает из-под периода молча — итог считает именно его',
  (() => { const undated = hsFiz.ev("historyItems('07701199970071').filter(i=>dnum(i.date)===null).length");
    hsSet(hsFiz, 'histFrom', '2020-01-01');
    const s = hsSum(hsFiz);
    const res = undated === 6 && s.includes('6 событий без даты не попадают в период')
      && hsVis(hsFiz).every(el => el.dataset.date);
    hsFiz.ev('histReset()');
    /* без периода те же строки снова видны и стоят в начале ленты */
    return res && hsVis(hsFiz).filter(el => !el.dataset.date).length === undated
      && !hsItems(hsFiz)[0].dataset.date; })());

ok('КЗ-41. переход к году доматывает ленту до него, а не фильтрует по нему',
  (() => { const want = hsAts.ev("historyItems('01204199910016')"
      + ".filter(i=>dnum(i.date) && String(i.date).slice(-4)==='2011').length");
    const before = hsVis(hsAts).filter(el => el.dataset.year === '2011').length;
    hsAts.ev("histJump('2011')");
    const after = hsVis(hsAts).filter(el => el.dataset.year === '2011').length;
    /* фильтром это не было: события других лет остались на экране */
    const others = hsVis(hsAts).filter(el => el.dataset.year !== '2011').length;
    const res = want === 10 && before === 0 && after === want && others > 0;
    hsAts.ev('histReset()');
    return res; })());

ok('И-5. органы просмотра ленты помечены data-view-ctl, редакторов на вкладке нет',
  (() => { const ctl = [...hsPanel(hsAts).querySelectorAll('input, select, textarea')];
    const btns = [...hsPanel(hsAts).querySelectorAll('button')];
    return ctl.length === 3 && ctl.every(e => e.hasAttribute('data-view-ctl'))
      && btns.every(b => b.getAttribute('onclick') || b.type === 'submit' ? !!b.getAttribute('onclick') : false)
      && !/Добавить|Сохранить|Изменить/.test(hsText(hsAts)); })());

ok('КЗ-31. адрес несёт категорию ленты, но не черновик просмотра (поиск и период)',
  (() => { hsAts.ev("histFilter('req')");
    const withCat = hsAts.w.location.hash;
    /* сначала набран черновик, потом нажат чип: адрес переписывается ИМЕННО ЗДЕСЬ,
       и если бы поиск с периодом в него попадали, они попали бы этим нажатием */
    hsSet(hsAts, 'histQ', 'канал'); hsSet(hsAts, 'histFrom', '2011-01-01');
    hsAts.ev("histFilter('req')");
    const after = hsAts.w.location.hash;
    hsAts.ev('histReset()');
    return /\?cat=req$/.test(withCat) && after === withCat
      && !/cat=/.test(hsAts.w.location.hash); })());

ok('Б-22. полоса дефектов есть на КАЖДОЙ вкладке, которой дефект адресован (Д-ОЧЕР — «Истории»)',
  (() => { const bad = JSON.parse(hsQue.ev(`(()=>{const inn='01204199910016', out=[];
      TAB_DEFS.forEach((t,i)=>{
        const addressed = borrowerChecks(inn,asOf()).some(c=>c.tab===i);
        const bar = /defect-bar|def-ok/.test(tabMain(inn,i));
        /* «Общая» несёт шапку с флагами (первая подача), «Проверки» — сам перечень (третья) */
        const exempt = t.key==='общая' || t.key==='проверки';
        if (addressed && !bar && !exempt) out.push(t.key);
        if (bar && exempt) out.push('лишняя полоса: '+t.key);
      });
      return JSON.stringify(out);})()`));
    const badges = [...hsPanel(hsQue).querySelectorAll('.defect-bar .badge')];
    return bad.length === 0 && badges.length === 1
      && /Очередь на комитет · 2 события ждут решения/.test(badges[0].textContent); })());

ok('Б-23. число дефектов Д-ОБЯЗ читается фразой, а не «3 у обязательств вышел срок»',
  hsAts.ev("/^вышел срок у 3 обязательств$/.test("
    + "borrowerChecks('01204199910016',asOf()).find(c=>c.code==='Д-ОБЯЗ').result)"));

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

/* ── Имя лица: владелец — mockups/subject/subject.html (СБ-14, ADR-0014) ────────
   Ключ и имя — единственное, что зеркало ещё держит (СБ-14.3а). Раз имя перестало
   быть чистым именем, а стало пропечатывать тип лица прямо в строку («ИП …», «… (физ.)»),
   два макета читаются как две разные модели одного и того же человека, ровно то,
   ради чего схлопывалась страница субъекта. Сверяем по каждому ключу, который есть
   в ОБОИХ наборах, — не два зашитых ключа, чтобы третий разошедшийся ключ красил тест
   и без правки самого теста. */
const SUBJ_OWNER = readFileSync(resolve('mockups/subject/subject.html'), 'utf8');
const grabArray = (src, name) => {
  const m = src.match(new RegExp('const ' + name + ' = \\[[\\s\\S]*?\\n\\];'));
  return m ? new Function(m[0] + '\nreturn ' + name + ';')() : null;
};
const ownerSubjects = grabArray(SUBJ_OWNER, 'SUBJECTS') || [];
const mirrorSubjects = grabArray(HTML, 'SUBJECTS') || [];
const ownerByKey = new Map(ownerSubjects.filter(s => s.key).map(s => [s.key, s]));
const sharedKeys = mirrorSubjects.filter(s => ownerByKey.has(s.inn));
/* M-5 (финальное ревью 29.07.2026): сверка стояла на одном `name` — и `industry` разошлась
   молча. На 07701199970071 зеркало печатало «Частное предпринимательство» у лица, которое ни
   ИП, ни организацией не было никогда, а владелец — «—», и оба это ПОКАЗЫВАЛИ: зеркало в
   id-bar карточки и в found-box формы, владелец строкой «Отрасль» вкладки «Основное».
   Сверяем все поля, которые печатают оба макета, а не одно: имя, отрасль, район. Список
   назван явно — чтобы новое общее поле пришлось внести сюда осознанно, а не забыть молча. */
const PARITY_FIELDS = ['name', 'industry', 'district'];
const parityGaps = sharedKeys.flatMap(s => PARITY_FIELDS
  .filter(f => s[f] !== ownerByKey.get(s.inn)[f])
  .map(f => `${s.inn}.${f}: зеркало ${JSON.stringify(s[f])} ≠ владелец ${JSON.stringify(ownerByKey.get(s.inn)[f])}`));
if (parityGaps.length) console.log('      расхождения с владельцем: ' + parityGaps.join(' · '));
ok('W. словарь SUBJECTS совпадает с subject.html (владелец) по имени, отрасли и району на каждом общем ключе',
  sharedKeys.length > 0 && parityGaps.length === 0
  /* каждое сверяемое поле обязано быть непустым хоть где-то: иначе сверка «undefined ===
     undefined» была бы зелёной и после того, как поле исчезло бы из обоих наборов */
  && PARITY_FIELDS.every(f => sharedKeys.some(s => s[f])));

// ── СБ-14: вид субъекта схлопнут, владелец — mockups/subject/subject.html ──
ok('СБ-14.1 вида view-subject и renderSubject в макете заёмщика больше нет',
  !g.$('#view-subject') && g.ev("typeof renderSubject")==='undefined' && g.ev("typeof showSubject")==='undefined');
/* Имя проверки — про шапку карточки, а не про строку-зеркало: зеркало держит СБ-14.3а ниже.

   I-1 (ревью 29.07.2026). Прежняя редакция ТРЕБОВАЛА печати «Юр. лицо» — то есть требовала
   хранимого типа лица и закрепляла расхождение макетов как правильное поведение: перебивание
   P14 (снять personKindLabel из id-bar) роняло именно её. Тип лица — величина владельца и
   функция среза (personKindAt по регистрациям ИП); здесь его считать нечем, IP_REG в этом
   макете нет. Утверждение переписано на то, что действительно обязано остаться: шапка
   опознаёт запись ключом и наименованием и типа лица НЕ утверждает.
   Берём 04401199940041 — лицо, на котором расхождение и наблюдалось: хранимое поле здесь
   'ИП', владелец на 13.07.2026 даёт «Физ. лицо». Хранимое поле проверяем отдельной строкой:
   пока оно в наборе есть и непусто, негативная половина не вакуумна — печатать было бы что. */
ok('СБ-14.2 шапка карточки заёмщика опознаёт запись ключом и наименованием и типа лица не утверждает',
  (() => { const f = mk(); f.ev("location.hash='#/b/04401199940041'"); f.ev("route()");
    const bar = f.$('#cardMount .id-bar');
    if (!bar) return false;
    const t = bar.textContent.replace(/\s+/g, ' ').trim();
    const name = f.ev("SUBJECTS.find(x=>x.inn==='04401199940041').name");
    /* Негативную половину проверяем по СОСТАВУ подписи, а не поиском подстроки в тексте
       шапки: соседние <span> склеиваются в textContent без разделителя («…041ИПЧастное…»),
       и регулярка по границам слова такое не поймает — проверка осталась бы зелёной при
       вернувшемся типе. Список подписей берём из PERSON_KIND_LABEL, чтобы он не разъехался. */
    const subs = [...bar.querySelectorAll('.id-sub span')]
      .map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const labels = JSON.parse(f.ev("JSON.stringify(Object.values(PERSON_KIND_LABEL))"));
    return f.ev("SUBJECTS.find(x=>x.inn==='04401199940041').personKind") === 'ИП'
      && t.includes('04401199940041') && t.includes(name)
      && subs.length > 0 && subs.every(x => !labels.includes(x)); })());
ok('СБ-14.3 из карточки есть внешняя ссылка «Открыть субъекта» именно на этот ключ',
  !!g.$('#cardMount a[href="../subject/subject.html#/s/01204199910016"]'));
/* СБ-14.2 и СБ-14.3 сами по себе строку-зеркало НЕ держат: наименование, ключ и тип лица
   печатает и id-bar карточки, а тот же внешний адрес печатают ссылки залогодателя во
   вкладке «Обеспечение» — обе оставались зелёными при невызванном subjectMirrorRow.
   Зеркало пришпилено здесь: ищем его по внешней ссылке внутри .id-bar (в панелях вкладок
   таких строк нет).

   C1 (ревью 29.07.2026): состав зеркала урезан до наименования и ключа. Тип лица ушёл,
   потому что у владельца это ФУНКЦИЯ СРЕЗА (personKindAt по регистрациям ИП), а здесь было
   хранимое поле — на 04401199940041 зеркало печатало «ИП», владелец на ту же дату «Физ.
   лицо». Отметка «на <дата>» ушла следом: имя и ключ от asOf() не зависят, штамп утверждал
   снимок, которого нет. Проверка сторожит обе стороны — и что нужное печатается, и что
   убранное не вернулось: без второй половины возврат прежней формулировки прошёл бы
   незамеченным (тест на «включает» от лишнего текста не краснеет). */
ok('СБ-14.3а зеркало — отдельная строка шапки: наименование и ключ, без типа лица и без штампа среза',
  (() => { const f = mk(); f.ev("location.hash='#/b/01204199910016'"); f.ev("route()");
    const mirror = f.$$('#cardMount .id-bar')
      .find(b => b.querySelector('a[href^="../subject/subject.html#/s/"]'));
    if (!mirror) return false;
    /* Состав сверяем РАВЕНСТВОМ, а не «включает»: от лишнего текста проверка на включение
       не краснеет, и возврат «· Юр. лицо на 13.07.2026» прошёл бы незамеченным. */
    const name = f.ev("SUBJECTS.find(x=>x.inn==='01204199910016').name");
    const expect = name + ' · 01204199910016 · Открыть субъекта ↗';
    const t = mirror.textContent.replace(/\s+/g, ' ').trim();
    if (t !== expect) return false;
    /* и на сдвинутом срезе строка обязана быть той же: зеркало от asOf() не зависит,
       поэтому штамп даты в нём — утверждение о снимке, которого оно не делает */
    f.ev("setAsOf('2026-01-01')");
    const t2 = f.$$('#cardMount .id-bar')
      .find(b => b.querySelector('a[href^="../subject/subject.html#/s/"]'))
      .textContent.replace(/\s+/g, ' ').trim();
    return t2 === expect; })());
/* Проверка идёт переходом состояния, а не «какой-то вид активен»: карточка открыта
   (view-detail), после #/s/… обязан остаться реестр. Маршрут, который ничего не делает,
   оставит открытой карточку и тест покраснеет. Без этого тест проходил бы и при route(){}. */
ok('СБ-14.4 маршрут #/s/ в макете заёмщика больше не заявлен — адрес роняет в реестр',
  (() => { g.ev("location.hash='#/b/01204199910016'"); g.ev("route()");
    if (!g.$('#view-detail').classList.contains('active')) return false;
    g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    return g.$('#view-list').classList.contains('active') &&
           !g.$('#view-detail').classList.contains('active'); })());
ok('СБ-14.5 ГЗПМ (группа совместного риска, КЗ-39) не тронут — это не лицо (СБ-4)',
  g.ev("Array.isArray(GROUPS) && GROUPS.length > 0"));
ok('СБ-14.6 SUBJECTS остаётся зеркалом и данные не потеряны (ADR-0014)',
  g.ev("SUBJECTS.length") >= 30);

console.log(`\n${n - fails}/${n} PASS`);
process.exit(fails ? 1 : 0);
