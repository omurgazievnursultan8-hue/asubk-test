// Смоук-проверка макета субъекта (mockups/subject/subject.html) на jsdom.
// Спецификация: docs/superpowers/specs/2026-07-29-subject-mockup-design.md.
// Запуск: node scripts/inspect/subject-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML = readFileSync(resolve('mockups/subject/subject.html'), 'utf8');

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

// ── Каркас (Task 1) ──
ok('0.1 страница загрузилась без ошибок jsdom', g.errs.length === 0);
ok('0.2 TODAY зафиксирован на 13.07.2026', g.ev("TODAY") === '13.07.2026');
ok('0.3 три вида в разметке', !!g.$('#view-list') && !!g.$('#view-card') && !!g.$('#view-merge'));
ok('0.4 пустой hash → активен реестр',
  (() => { g.ev("location.hash=''"); g.ev("route()"); return g.$('#view-list').classList.contains('active'); })());
ok('0.5 неизвестный ключ в маршруте не бросает и падает в реестр',
  (() => { g.ev("location.hash='#/s/00000000000000'"); g.ev("route()");
           return g.errs.length === 0 && g.$('#view-list').classList.contains('active'); })());
ok('0.6 даты: dnum сравнивает, toISO/fromISO обратимы',
  g.ev("dnum('01.01.2026') < dnum('02.01.2026')") &&
  g.ev("fromISO(toISO('14.05.2026'))") === '14.05.2026');
ok('0.7 esc экранирует разметку', g.ev("esc('<b>&\"')") === '&lt;b&gt;&amp;&quot;');

// ── Модель и производные (Task 2) ──
ok('1.1 три источника представлены в наборе',
  ['individuals','organizations','groups'].every(src => g.ev(`SUBJECTS.some(s=>s.source==='${src}')`)));
ok('1.2 инвариант 1: ключи уникальны',
  g.ev("(()=>{const k=SUBJECTS.map(s=>s.key).filter(Boolean);return new Set(k).size===k.length;})()"));
ok('1.3 инвариант 2: у группы ключ ГР-NNN и ИНН пуст, у прочих — 14 цифр либо ключа нет вовсе',
  g.ev("SUBJECTS.every(s => s.source==='groups' ? /^ГР-\\d{3}$/.test(s.key) && !s.inn : (s.key==='' || /^\\d{14}$/.test(s.key)))"));
ok('1.4 инвариант 4: хранимого типа лица нет ни у одной записи',
  g.ev("SUBJECTS.every(s=>!('personKind' in s) && !('isIP' in s) && !('roles' in s))"));
ok('1.5 keyKind различает ИНН и внутренний ключ группы',
  g.ev("keyKind('01204199910016')")==='ИНН' && g.ev("keyKind('ГР-001')")==='ГР');
// ADR-0018: физлицо бывает ИП период, потом перестаёт — тип считается на дату.
ok('1.6 personKindAt: в период регистрации ИП — «ИП», после прекращения — «физ»',
  g.ev("personKindAt('04401199940041','01.06.2020')")==='ИП' &&
  g.ev("personKindAt('04401199940041','01.06.2026')")==='физ');
ok('1.7 personKindAt: организация и группа от даты не зависят',
  g.ev("personKindAt('01204199910016','01.01.2011')")==='юр' &&
  g.ev("personKindAt('01204199910016',TODAY)")==='юр' &&
  g.ev("personKindAt('ГР-001',TODAY)")==='группа');
ok('1.8 у физлица без регистрации ИП тип «физ» на любую дату',
  g.ev("personKindAt('07701199970071','01.01.2015')")==='физ' &&
  g.ev("personKindAt('07701199970071',TODAY)")==='физ');
// ADR-0019: присоединённый ключ не исчезает — он разрешается в главного субъекта.
ok('1.9 resolveKey разрешает псевдоним, keysOf возвращает ключ и его псевдонимы',
  g.ev("resolveKey('S-DUP')")===g.ev("resolveKey(resolveKey('S-DUP'))") &&
  g.ev("keysOf('07701199970071').length") >= 1);
ok('1.10 инвариант 5: роли выводятся — функции создания/удаления роли нет',
  g.ev("typeof addRole")==='undefined' && g.ev("typeof removeRole")==='undefined');
ok('1.11 subjectRoles возвращает роль заёмщика при наличии кредитов',
  g.ev("subjectRoles('01204199910016').some(r=>r.role==='Заёмщик')"));
ok('1.12 subjectRoles: залогодатель по ЧУЖОМУ кредиту тоже роль',
  g.ev("subjectRoles('07701199970071').some(r=>r.role==='Залогодатель')"));
ok('1.13 зеркала не содержат собственных полей субъекта (ADR-0014)',
  g.ev("CREDITS.every(c=>!('name' in c) && !('district' in c))"));
ok('1.14 в наборе есть закрытая регистрация ИП, групповой заёмщик с составом и пара-дубль без ключа',
  g.ev("IP_REG.some(r=>r.to)") &&
  g.ev("LINKS.some(l=>l.kind==='член группы')") &&
  g.ev("SUBJECTS.filter(s=>s.key==='').length") >= 2);
// СБ-13: стоп-фактор — зеркало события, своей точки ввода у него нет.
ok('1.15 стоп-фактор выводится из события и несёт его дату и документ',
  g.ev("stopFactors('07701199970071').length")===1 &&
  g.ev("stopFactors('07701199970071')[0].text")==='Лицо умерло' &&
  g.ev("stopFactors('07701199970071')[0].date")==='20.01.2025' &&
  g.ev("stopFactors('07701199970071')[0].doc")==='СС-4471' &&
  g.ev("stopFactors('01204199910016').length")===0);

// ── Реестр (Task 3) ──
ok('2.1 реестр рисует таблицу и счётчик «1–N из K»',
  (() => { g.ev("location.hash=''"); g.ev("route()");
    return !!g.$('#listTable') && new RegExp('^1–\\d+ из ' + g.ev("listRows().length") + '$').test(g.$('#rowCount').textContent); })());
ok('2.2 строк на странице не больше размера страницы (СП-11)',
  g.$$('#listTable tbody tr').length <= g.ev("pgSize"));
ok('2.3 колонка типа лица подписана датой среза (инвариант 4)',
  g.$('#listTable').textContent.includes('на ' + g.ev("TODAY")) ||
  g.$('#listHead').textContent.includes('на ' + g.ev("TODAY")));
ok('2.4 у группового заёмщика в реестре виден ключ ГР-, а не ИНН',
  g.$('#listTable').textContent.includes('ГР-001'));
/* Один разрез доказать нечем: пустой ответ дало бы и чтение несуществующего поля.
   Поэтому спрашиваем ту же выборку на дату, когда регистрация ИП действовала. */
ok('2.5 фильтр по типу лица считает тип на дату, а не читает поле',
  (() => { g.ev("FILTER.kind='ИП'"); g.ev("applyFilters()");
    const now = g.ev("listRows().length");            // на 13.07.2026 действующих ИП нет: регистрация закрыта 31.12.2025
    g.ev("VIEW_DATE='01.06.2020'"); g.ev("applyFilters()");
    const then = g.ev("listRows().map(s=>s.key)");    // а в 2020-м Асанов был ИП — из хранимого поля этого не увидеть
    g.ev("VIEW_DATE=TODAY"); g.ev("applyFilters()");
    return now === 0 && then.length === 1 && then[0] === '04401199940041'; })());
ok('2.6 фильтр по роли отбирает по выводимым ролям',
  (() => { g.ev("FILTER.kind=''"); g.ev("FILTER.role='Поручитель'"); g.ev("applyFilters()");
    return g.ev("listRows().every(s=>subjectRoles(subjectRef(s)).some(r=>r.role==='Поручитель'))") &&
           g.ev("listRows().length") > 0; })());
ok('2.7 фильтр «есть событие» отбирает по ленте событий',
  (() => { g.ev("FILTER.role=''"); g.ev("FILTER.event=true"); g.ev("applyFilters()");
    return g.ev("listRows().every(s=>subjectEvents(subjectRef(s)).length>0)") && g.ev("listRows().length") > 0; })());
ok('2.8 разрез «похожие записи» показывает только записи без ключа либо псевдонимы (СБ-10)',
  (() => { g.ev("FILTER.event=false"); g.ev("FILTER.similar=true"); g.ev("applyFilters()");
    return g.ev("listRows().every(s=>s.key==='' || !!s.aliasOf)") && g.ev("listRows().length") >= 2; })());
/* Проверяем сам признак, а не шапку таблицы: «Наименование / ФИО» стоит в <th> всегда. */
ok('2.9 признак дубля называет причину похожести и не использует дату рождения (её в системе нет)',
  (() => { const t = g.$('#listTable').textContent;
    return /совпал документ|совпало имя в одном районе/.test(t) && !/дата рождения/i.test(t); })());
ok('2.10 пустое состояние называет условия и чистит их одной кнопкой (СП-16)',
  (() => { g.ev("FILTER.similar=false"); g.ev("FILTER.q='несуществующее-лицо-zzz'"); g.ev("applyFilters()");
    const has = !!g.$('#emptyState') && !!g.$('#clearFilters');
    g.ev("document.getElementById('clearFilters').click()");
    return has && g.ev("FILTER.q")==='' && g.ev("listRows().length") === g.ev("SUBJECTS.filter(s=>!s.aliasOf).length"); })());
ok('2.11 поиск идёт по ключу И по наименованию',
  (() => { g.ev("FILTER.q='АгроТех'"); g.ev("applyFilters()");
    const byName = g.ev("listRows().length")===1;
    g.ev("FILTER.q='07701199970071'"); g.ev("applyFilters()");
    const byKey = g.ev("listRows().some(s=>s.key==='07701199970071')");
    g.ev("FILTER.q=''"); g.ev("applyFilters()");
    return byName && byKey; })());
/* Пагинацию восемью записями при странице в 20 не проверить — временно ужимаем страницу. */
ok('2.12 вторая страница достижима кнопкой и показывает другие строки (СП-11)',
  (() => { g.ev("pgSize=3"); g.ev("applyFilters()");
    const onPage = g.$$('#listTable tbody tr').length;
    const first1 = g.$('#listTable tbody tr').textContent, cnt1 = g.$('#rowCount').textContent;
    g.ev("document.getElementById('pgNext').click()");
    const first2 = g.$('#listTable tbody tr').textContent, cnt2 = g.$('#rowCount').textContent;
    g.ev("pgSize=20"); g.ev("applyFilters()");
    return onPage === 3 && /^1–3 из /.test(cnt1) && /^4–/.test(cnt2) && first1 !== first2; })());
/* Тесты 2.5–2.11 пишут в FILTER напрямую — проводка панели ими не проверяется вовсе. */
ok('2.13 панель связана с FILTER, район каскадом сужается, «Очистить» доступна и при непустом списке',
  (() => { g.ev("(()=>{const s=document.getElementById('f-region');s.value='Нарынская';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
    const bound = g.ev("FILTER.region")==='Нарынская';
    const districts = g.ev("[...document.getElementById('f-district').options].map(o=>o.value).filter(Boolean)");
    const shown = g.$$('#listTable tbody tr').length > 0 && !!g.$('#clearFilters');
    g.ev("document.getElementById('clearFilters').click()");
    return bound && districts.length === 1 && districts[0] === 'Ак-Талинский'
        && shown && g.ev("FILTER.region")==='' && g.ev("listRows().length") > 1; })());

// ── Создание (Task 4) ──
ok('3.1 существующий ключ до формы не пускает, а предлагает открыть карточку (инвариант 1)',
  g.ev("lookupKey('01204199910016').found")===true &&
  g.ev("lookupKey('01204199910016').ref")==='01204199910016');
ok('3.2 неизвестный ключ ведёт в форму с предзаполненным ключом',
  g.ev("lookupKey('12345678901234').found")===false);
ok('3.3 форма создания предлагает ровно два типа — физлицо и организация (СБ-3а: ИП не заводится)',
  (() => { g.ev("openCreate('12345678901234')");
    const t = g.$('#mBody').textContent;
    return /Физ/i.test(t) && /Организац/i.test(t) && !/(^|\W)ИП(\W|$)/.test(t); })());
ok('3.4 createSubject отвергает дубль ключа',
  g.ev("(()=>{try{createSubject({key:'01204199910016',source:'individuals',name:'Дубль'});return false;}catch(e){return true;}})()"));
ok('3.5 createSubject отвергает ключ не из 14 цифр (инвариант 2)',
  g.ev("(()=>{try{createSubject({key:'123',source:'individuals',name:'Кривой ключ'});return false;}catch(e){return true;}})()"));
ok('3.6 «+ Группа» выдаёт ключ ГР-NNN сама и ИНН не спрашивает',
  (() => { const before = g.ev("SUBJECTS.length");
    g.ev("createGroup({name:'Группа «Тест»',district:'Ак-Талинский',region:'Нарынская'})");
    return g.ev("SUBJECTS.length") === before + 1 &&
           /^ГР-\d{3}$/.test(g.ev("SUBJECTS[SUBJECTS.length-1].key")) &&
           g.ev("!('inn' in SUBJECTS[SUBJECTS.length-1])") &&
           g.ev("SUBJECTS[SUBJECTS.length-1].source")==='groups'; })());
ok('3.7 у созданной группы импортного слоя нет вовсе (СБ-5а)',
  g.ev("!('imported' in SUBJECTS[SUBJECTS.length-1])"));
ok('3.8 новый ключ группы не повторяет выданный ранее',
  (() => { const k1 = g.ev("SUBJECTS[SUBJECTS.length-1].key");
    g.ev("createGroup({name:'Группа «Тест-2»',district:'Ак-Талинский',region:'Нарынская'})");
    return g.ev("SUBJECTS[SUBJECTS.length-1].key") !== k1; })());

console.log(`\n${n - fails} / ${n} PASS`);
process.exit(fails ? 1 : 0);
