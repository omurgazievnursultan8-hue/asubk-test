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

// ── Карточка: шапка и импортный слой (Task 5) ──
ok('4.1 карточка открывается по ключу и печатает тип лица с датой среза (инвариант 4)',
  (() => { g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    const t = g.$('#cardMount').textContent;
    return g.$('#view-card').classList.contains('active') && t.includes('Юр. лицо') && t.includes(g.ev("TODAY")); })());
ok('4.2 срез из маршрута меняет тип лица у бывшего ИП (ADR-0018)',
  (() => { g.ev("location.hash='#/s/04401199940041?on=2020-06-01'"); g.ev("route()");
    const was = g.$('#cardMount').textContent.includes('ИП');
    g.ev("location.hash='#/s/04401199940041'"); g.ev("route()");
    return was && g.$('#cardMount').textContent.includes('Физ. лицо'); })());
ok('4.3 шапка показывает дату и источник импортного снимка',
  (() => { g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    const t = g.$('#cardMount').textContent; return t.includes('12.05.2026') && t.includes('Тундук'); })());
ok('4.4 у группового заёмщика импортной строки и кнопки «Обновить из реестра» нет (СБ-5а)',
  (() => { g.ev("location.hash='#/s/ГР-001'"); g.ev("route()");
    return !g.$('#importBar') && !g.$('#btnRefreshImport'); })());
ok('4.5 инвариант 3: поле в состоянии «реестр» read-only, редактора у него нет',
  (() => { g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    return !!g.$('[data-field="nameFull"][data-state="реестр"]') &&
           !g.$('[data-field="nameFull"] input') && !g.$('[data-field="nameFull"] .btn-fill'); })());
/* Пишет в общий SUBJECTS (пусто→наше) — общий jsdom у Task 5–8, поэтому снимок до
   вызова и восстановление после (тот же приём, что 4.11 применяет к S-DUP.aliasOf). */
ok('4.6 пустое импортное поле заполняется руками, значение подписывается автором и датой',
  (() => { const has = !!g.$('[data-field="okpo"][data-state="пусто"] .btn-fill');
    g.ev("window.__snap46 = JSON.parse(JSON.stringify(subject('01204199910016').imported.f.okpo))");
    g.ev("fillOwn('01204199910016','okpo','27458119')");
    const pass = has && g.ev("subject('01204199910016').imported.f.okpo.st")==='наше' &&
           !!g.ev("subject('01204199910016').imported.f.okpo.by") &&
           !!g.ev("subject('01204199910016').imported.f.okpo.at");
    g.ev("subject('01204199910016').imported.f.okpo = window.__snap46");
    return pass; })());
ok('4.7 наше значение видно как «введено нами» с подписью',
  (() => { g.ev("route()"); const el = g.$('[data-field="director"][data-state="наше"]');
    return !!el && /введено нами/i.test(el.textContent) && /Асанова/.test(el.textContent); })());
ok('4.8 пришедшее позже значение реестра не затирает наше молча — показывается расхождение с выбором',
  (() => { const el = g.$('[data-field="director"]');
    return /расхожден/i.test(el.textContent) && el.querySelectorAll('[data-choice]').length === 2; })());
/* Пишет в общий SUBJECTS (наше+расхождение→реестр) — тот же приём восстановления. */
ok('4.9 выбор в пользу реестра переводит поле в состояние «реестр»',
  (() => { g.ev("window.__snap49 = JSON.parse(JSON.stringify(subject('01204199910016').imported.f.director))");
    g.ev("resolveConflict('01204199910016','director','реестр')");
    const pass = g.ev("subject('01204199910016').imported.f.director.st")==='реестр' &&
           g.ev("subject('01204199910016').imported.f.director.v")==='Асанов Талант Кубанычбекович' &&
           g.ev("!subject('01204199910016').imported.f.director.pending");
    g.ev("subject('01204199910016').imported.f.director = window.__snap49");
    return pass; })());
ok('4.10 состав вкладок зависит от типа лица на дату',
  (() => { const org = g.ev("tabsFor('01204199910016',TODAY).map(t=>t.k).join(',')");
    const grp = g.ev("tabsFor('ГР-001',TODAY).map(t=>t.k).join(',')");
    const ipNow = g.ev("tabsFor('04401199940041',TODAY).map(t=>t.k).join(',')");
    const ipThen = g.ev("tabsFor('04401199940041','01.06.2020').map(t=>t.k).join(',')");
    return org.includes('units') && !org.includes('ipreg') &&
           grp.includes('members') && !grp.includes('units') &&
           ipNow.includes('ipreg') && !ipNow.includes('bank') && ipThen.includes('bank'); })());
ok('4.11 карточка по псевдониму называет присоединение прямо (СБ-11)',
  (() => { g.ev("subject('S-DUP').aliasOf='07701199970071'");
    g.ev("location.hash='#/s/S-DUP'"); g.ev("route()");
    const t = g.$('#cardMount').textContent;
    g.ev("delete subject('S-DUP').aliasOf");
    return /присоединён/i.test(t) && t.includes('07701199970071'); })());
/* Заведённый руками субъект несёт imported.asOf:'—' (Task 4) — это «канал есть, снимка не
   было». Показать его датой-прочерком значит соврать источником; ветка своя, значит и
   проверка своя. Ключ берём созданный тут же — на длину SUBJECTS не опираемся (тесты
   3.6/3.8 её уже сдвинули). */
ok('4.12 у заведённого руками субъекта импортная строка говорит «данных из реестра нет» (СБ-5б)',
  (() => { g.ev("createSubject({key:'22201199960061',source:'organizations',name:'ОсОО «Ручной ввод»'})");
    g.ev("location.hash='#/s/22201199960061'"); g.ev("route()");
    const t = g.$('#importBar').textContent;
    return /данных из реестра нет/.test(t) && !/Снимок/.test(t) && !/—/.test(t.replace(/Обновить.*/,'')); })());

// ── Связи и состав (Task 6) ──
ok('5.1 связь видна с обоих концов одной записью (инвариант 6)',
  (() => { const a = g.ev("linksOf('04401199940041').filter(l=>l.kind==='учредитель').length");
    const b = g.ev("linksOf('01204199910016').filter(l=>l.kind==='учредитель').length");
    return a === 1 && b === 1 && g.ev("LINKS.filter(l=>l.kind==='учредитель').length")===1; })());
ok('5.2 вкладка «Учредители» из онлайна поглощена связями (СБ-8) — отдельной вкладки нет',
  g.ev("TAB_DEFS.every(t=>!/учредител/i.test(t.t))"));
ok('5.3 повторная связь той же пары и вида отвергается (инвариант 6)',
  g.ev("(()=>{try{addLink({kind:'учредитель',a:'04401199940041',b:'01204199910016',from:'01.01.2026',doc:'X'});return false;}catch(e){return true;}})()"));
ok('5.4 ограничение по типу: учредитель — только к организации',
  g.ev("linkAllowed('учредитель','04401199940041','07701199970071')")===false &&
  g.ev("linkAllowed('учредитель','04401199940041','01204199910016')")===true);
ok('5.5 ограничение по типу: супруг — физлицо↔физлицо, член группы — физлицо↔группа',
  g.ev("linkAllowed('супруг','07701199970071','01204199910016')")===false &&
  g.ev("linkAllowed('член группы','07701199970071','ГР-001')")===true &&
  g.ev("linkAllowed('член группы','01204199910016','ГР-001')")===false);
ok('5.6 «Состав» группы — та же связь «член группы» с другого конца (СБ-7)',
  (() => { g.ev("location.hash='#/s/ГР-001?tab=members'"); g.ev("route()");
    const t = g.$('[data-panel="members"]').textContent;
    return g.ev("membersOf('ГР-001').length")===2 && /Осмонова/.test(t) && /Асанов/.test(t); })());
ok('5.7 у связи обязательны период и документ-основание',
  g.ev("(()=>{try{addLink({kind:'аффилированность',a:'07701199970071',b:'01204199910016',from:'',doc:''});return false;}catch(e){return true;}})()"));
ok('5.8 «связанное лицо» ролью не является (СБ-7)',
  g.ev("subjectRoles('04401199940041').every(r=>r.role!=='Связанное лицо')"));
ok('5.9 оргструктура — своя вкладка только у организации (СБ-8)',
  (() => { g.ev("location.hash='#/s/01204199910016?tab=units'"); g.ev("route()");
    return /Производственный цех/.test(g.$('[data-panel="units"]').textContent); })());

// ── События, ИП, стоп-фактор (Task 7) ──
ok('6.1 событие «утрата статуса ИП» проставляет дату прекращения регистрации, а не тип (ADR-0018)',
  (() => { const reg = g.ev("IP_REG.find(r=>r.key==='04401199940041')");
    return g.ev("IP_REG.find(r=>r.key==='04401199940041').to")==='31.12.2025' &&
           g.ev("SUBJECTS.every(s=>!('personKind' in s))"); })());
/* Брифовая дата для второй проверки (01.06.2025) недостижима: она попадает ВНУТРЬ уже
   действующей на тот момент старой регистрации (22.01.2019–31.12.2025, IP_REG) — на неё
   personKindAt корректно и по уже проверенной логике (тесты 1.6/4.2) обязан вернуть «ИП»,
   а не «физ». Смысл проверки — «в разрыве между закрытой и новой регистрацией лицо снова
   физлицо» — сохранён датой 15.01.2026: она позже закрытия старой (31.12.2025) и раньше
   начала новой (01.02.2026). */
ok('6.2 новая регистрация ИП после закрытой возвращает тип «ИП» на новые даты',
  (() => { g.ev("addIpReg({key:'04401199940041',no:'ИП-0044012',from:'01.02.2026',doc:'Патент 0044012'})");
    return g.ev("personKindAt('04401199940041','01.03.2026')")==='ИП' &&
           g.ev("personKindAt('04401199940041','15.01.2026')")==='физ' &&
           g.ev("IP_REG.filter(r=>r.key==='04401199940041').length")===2; })());
ok('6.3 событие «утрата статуса ИП» закрывает действующую регистрацию датой события',
  (() => { g.ev("addEvent({key:'04401199940041',kind:'утрата статуса ИП',date:'01.07.2026',basis:'Заявление',doc:'ЗП-119'})");
    return g.ev("IP_REG.find(r=>r.no==='ИП-0044012').to")==='01.07.2026' &&
           g.ev("personKindAt('04401199940041',TODAY)")==='физ'; })());
/* Одного снимка зеркал мало: он совпал бы и у addEvent, не делающего вообще ничего.
   Поэтому сначала требуем, чтобы событие легло в ленту, и только потом — чтобы чужое
   осталось нетронутым. Иначе тест доказывает бездействие, а не невмешательство. */
ok('6.4 инвариант 7: событие ложится в ленту и не трогает кредиты, обеспечение и взыскание',
  (() => { const snap = g.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])");
    const n0 = g.ev("subjectEvents('02201199920021').length");
    g.ev("addEvent({key:'02201199920021',kind:'ликвидация',date:'01.07.2026',basis:'Решение суда',doc:'РС-88'})");
    return g.ev("subjectEvents('02201199920021').length") === n0 + 1 &&
           g.ev("subjectEvents('02201199920021').some(e=>e.kind==='ликвидация'&&e.doc==='РС-88')") &&
           g.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])") === snap; })());
ok('6.5 СБ-13: стоп-фактор — зеркало события, отдельной точки ввода нет',
  g.ev("stopFactors('02201199920021').some(f=>/ликвидирован/i.test(f.text))") &&
  g.ev("typeof addStopFactor")==='undefined' && g.ev("typeof STOP_FACTORS")==='undefined');
ok('6.6 «утрата статуса ИП» стоп-фактором не является',
  g.ev("stopFactors('04401199940041').length")===0);
ok('6.7 стоп-фактор виден в шапке карточки и в реестре',
  (() => { g.ev("location.hash='#/s/02201199920021'"); g.ev("route()");
    const card = /ликвидирован/i.test(g.$('#cardMount').textContent);
    g.ev("location.hash=''"); g.ev("route()");
    return card && /ликвидирован/i.test(g.$('#listTable').textContent); })());
ok('6.8 реорганизация требует правопреемника, ликвидация — нет',
  g.ev("(()=>{try{addEvent({key:'01204199910016',kind:'реорганизация',date:'01.06.2026',basis:'Решение',doc:'Р-1'});return false;}catch(e){return true;}})()"));
ok('6.9 лента событий не удаляется — функции удаления нет (СБ-9)',
  g.ev("typeof removeEvent")==='undefined' && g.ev("typeof deleteEvent")==='undefined');

// ── Роли, документы, реквизиты (Task 8) ──
ok('7.1 вкладка ролей — таблица без создания и удаления (инвариант 5)',
  (() => { g.ev("location.hash='#/s/04401199940041?tab=roles'"); g.ev("route()");
    const p = g.$('[data-panel="roles"]');
    return /Поручитель/.test(p.textContent) && p.querySelectorAll('button').length === 0; })());
ok('7.2 у каждой роли назван объём и адрес продолжения в модуль (СБ-6)',
  (() => { const p = g.$('[data-panel="roles"]').textContent;
    return /договор/.test(p) && /модул/i.test(p); })());
ok('7.3 роли считаются по ключу и его псевдонимам (инвариант 8)',
  (() => { g.ev("subject('S-DUP').aliasOf='07701199970071'");
    const viaAlias = g.ev("subjectRoles('S-DUP').map(r=>r.role).join(',')");
    const viaMain  = g.ev("subjectRoles('07701199970071').map(r=>r.role).join(',')");
    g.ev("delete subject('S-DUP').aliasOf");
    return viaAlias === viaMain && viaAlias.length > 0; })());
ok('7.4 документы: вид · относительно · дата · файл',
  (() => { g.ev("location.hash='#/s/01204199910016?tab=docs'"); g.ev("route()");
    return /Устав/.test(g.$('[data-panel="docs"]').textContent); })());
ok('7.5 банковские реквизиты доступны организации и не показываются группе',
  g.ev("tabsFor('01204199910016',TODAY).some(t=>t.k==='bank')") &&
  g.ev("tabsFor('ГР-001',TODAY).length") > 0 &&
  g.ev("tabsFor('ГР-001',TODAY).every(t=>t.k!=='bank')"));
ok('7.6 у реквизита виден период действия',
  (() => { g.ev("location.hash='#/s/01204199910016?tab=bank'"); g.ev("route()");
    return /14\.02\.2011/.test(g.$('[data-panel="bank"]').textContent); })());
/* Негативная проверка на весь #cardMount проходит и на пустой карточке — сначала
   доказываем, что карточка реально что-то отрисовала (имя субъекта из шапки), и
   только потом проверяем отсутствие денежных полей (раздел 8 спеки не про эту вкладку). */
ok('7.7 денег карточка не показывает (раздел 8 спеки — задолженность у заёмщика)',
  (() => { const t = g.$('#cardMount').textContent;
    return /АгроТехСервис/.test(t) && !/задолженност|остаток долга|сом\b/i.test(t); })());

// ── Слияние (Task 9) ──
const m = mk();   // свежий DOM: слияние необратимо и мутирует набор
ok('8.1 экран сравнения открывается маршрутом и показывает расхождения поле-в-поле',
  (() => { m.ev("location.hash='#/merge/07701199970071/S-DUP'"); m.ev("route()");
    return m.$('#view-merge').classList.contains('active') &&
           m.ev("mergeDiff('07701199970071','S-DUP').length") > 0 &&
           m.$$('#mergeTable [data-pick]').length > 0; })());
ok('8.2 слияние требует подтверждения вводом ключа главной записи (СП-19)',
  m.ev("(()=>{try{doMerge('07701199970071','S-DUP',{confirm:'не тот ключ'});return false;}catch(e){return true;}})()"));
/* Снимок зеркал доказывает невмешательство только если в них есть что переписывать:
   первая строка требует, чтобы ссылка на дубль в чужом модуле действительно была
   (П-102), иначе тест зелен и у слияния, которое чужое переписывает. */
ok('8.3 после слияния присоединённый ключ становится псевдонимом и ведёт на главную (инвариант 8)',
  (() => { const foreign = m.ev("PLEDGE_OBJ.some(o=>o.pledgerKey==='S-DUP')");
    const before = m.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])");
    m.ev("doMerge('07701199970071','S-DUP',{confirm:'07701199970071'})");
    const after = m.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])");
    return foreign &&
           m.ev("subject('S-DUP').aliasOf")==='07701199970071' &&
           m.ev("resolveKey('S-DUP')")==='07701199970071' &&
           m.ev("PLEDGE_OBJ.some(o=>o.pledgerKey==='S-DUP')") &&   /* чужое осталось как было */
           before === after; })());   /* инвариант 9: чужое не переписано */
ok('8.4 маршрут по присоединённой записи не пропадает — открывается главная с оговоркой',
  (() => { m.ev("location.hash='#/s/S-DUP'"); m.ev("route()");
    return m.$('#view-card').classList.contains('active') && /присоединён/i.test(m.$('#cardMount').textContent); })());
/* Одного «на дубле не осталось» мало: пустой массив дал бы то же самое. Каждую строку
   ищем на главном ключе поимённо — по документу, по связи и по реквизиту. */
ok('8.5 своё перенесено: документы, связи, события, реквизиты — на главном ключе',
  m.ev("DOCS.every(d=>d.key!=='S-DUP')") && m.ev("LINKS.every(l=>l.a!=='S-DUP'&&l.b!=='S-DUP')") &&
  m.ev("SUBJECT_EVENTS.every(e=>e.key!=='S-DUP')") && m.ev("BANK_REQ.every(b=>b.key!=='S-DUP')") &&
  m.ev("DOCS.some(d=>d.key==='07701199970071'&&d.file==='legacy-63545.pdf')") &&
  m.ev("LINKS.some(l=>l.id==='L-6'&&l.a==='07701199970071')") &&
  m.ev("SUBJECT_EVENTS.some(e=>e.key==='07701199970071'&&e.doc==='СС-4471-L')") &&
  m.ev("BANK_REQ.some(b=>b.key==='07701199970071'&&b.bik==='124001')"));
ok('8.6 роли считаются по обоим ключам и не переносятся (они производные, СБ-6)',
  m.ev("subjectRoles('S-DUP').map(r=>r.role).join(',')") === m.ev("subjectRoles('07701199970071').map(r=>r.role).join(',')"));
ok('8.7 слияние необратимо — функции разделения нет',
  m.ev("typeof unmerge")==='undefined' && m.ev("typeof splitSubject")==='undefined');
ok('8.8 инвариант 10: слитая запись не удаляется никогда',
  m.ev("canDelete('S-DUP')")===false &&
  m.ev("(()=>{try{deleteSubject('S-DUP');return false;}catch(e){return true;}})()"));
ok('8.9 инвариант 10: удаление возможно только при нуле ссылок',
  m.ev("canDelete('01204199910016')")===false);
/* «Обе записи живы» истинно и тогда, когда события вообще не случилось: сначала требуем,
   чтобы реорганизация легла в ленту, и лишь потом — что она никого не присоединила. */
ok('8.10 СБ-12: реорганизация — событие, а не слияние; обе записи остаются живыми',
  (() => { const n0 = m.ev("SUBJECTS.filter(s=>!s.aliasOf).length");
    m.ev("addEvent({key:'01204199910016',kind:'реорганизация',date:'01.06.2026',basis:'Решение собрания',doc:'РС-90',successorKey:'02201199920021'})");
    return m.ev("subjectEvents('01204199910016').some(e=>e.kind==='реорганизация'&&e.doc==='РС-90')") &&
           m.ev("SUBJECTS.filter(s=>!s.aliasOf).length") === n0 &&
           !m.ev("subject('01204199910016').aliasOf") &&
           !m.ev("subject('02201199920021').aliasOf"); })());
ok('8.11 экран слияния называет отличие от реорганизации словами (СБ-12)',
  (() => { m.ev("location.hash='#/merge/01204199910016/02201199920021'"); m.ev("route()");
    return /реорганизац/i.test(m.$('#mergeMount').textContent); })());
ok('8.12 разрез «похожие записи» в реестре даёт ссылку на сравнение',
  (() => { m.ev("location.hash=''"); m.ev("FILTER.similar=true"); m.ev("applyFilters()");
    return m.$$('#listTable a[href^="#/merge/"]').length > 0; })());
/* Обратное слияние — разделение через порчу: без защиты оба ключа получают aliasOf,
   resolveKey зацикливается на самом себе, и живое лицо уходит из реестра. */
ok('8.13 обратное слияние отвергается — уже присоединённая запись в слиянии не участвует',
  (() => { const alive = m.ev("listRows().length");
    const thrown = m.ev("(()=>{try{doMerge('S-DUP','07701199970071',{confirm:'S-DUP'});return false;}catch(e){return true;}})()");
    return thrown && m.ev("resolveKey('S-DUP')")==='07701199970071' &&
           !m.ev("subject('07701199970071').aliasOf") &&
           m.ev("keysOf('07701199970071').length")===2 &&
           m.ev("listRows().length") === alive; })());
/* СБ-10: дубль живёт там, где ключа нет. Пустить безключевую запись в главные значит
   увести лицо с настоящим ИНН под внутренний id. */
ok('8.14 безключевая запись главной стать не может',
  m.ev("(()=>{try{doMerge('S-DUP2','01204199910016',{confirm:'S-DUP2'});return false;}catch(e){return /с ключом/.test(e.message);}})()"));
/* Инвариант 10 проверялся только запретами: canDelete, прибитый к false, проходил их все.
   S-DUP2 — единственная запись демо-набора без единой ссылки. */
ok('8.15 инвариант 10: при нуле ссылок удаление действительно удаляет',
  (() => { const before = m.ev("SUBJECTS.some(s=>s.id==='S-DUP2')");
    const can = m.ev("canDelete('S-DUP2')")===true;
    m.ev("deleteSubject('S-DUP2')");
    return before && can && m.ev("SUBJECTS.every(s=>s.id!=='S-DUP2')"); })());
/* Все проверки выше зовут doMerge напрямую — сам экран не проверен ничем. Здесь слияние
   идёт тем же путём, что у оператора: выбор значения кнопкой, ключ в поле, клик «Слить». */
ok('8.16 экран слияния сливает кликом и применяет выбранное значение поля',
  (() => { const m2 = mk();
    m2.ev("location.hash='#/merge/07701199970071/S-DUP'"); m2.ev("route()");
    const pick = m2.$('#mergeTable [data-pick=\"b\"]');
    if (!pick) return false;
    const fname = pick.dataset.fname, want = m2.ev("fval(subject('S-DUP'),'" + fname + "')");
    m2.ev("document.querySelector('#mergeTable [data-pick=\\'b\\']').click()");
    m2.ev("(()=>{const i=document.getElementById('mergeConfirm');i.value='07701199970071';i.dispatchEvent(new Event('input',{bubbles:true}));})()");
    m2.ev("document.getElementById('btnMerge').click()");
    return m2.ev("subject('S-DUP').aliasOf")==='07701199970071' &&
           m2.ev("subject('S-DUP').aliasAt")==='13.07.2026' &&
           m2.ev("fval(subject('07701199970071'),'" + fname + "')") === want; })());

console.log(`\n${n - fails} / ${n} PASS`);
process.exit(fails ? 1 : 0);
