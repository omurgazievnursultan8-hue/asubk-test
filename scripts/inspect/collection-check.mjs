// Смоук-проверка мокапа взыскания v2 (mockups/collection/collection.html) на jsdom.
// Спецификация: ASUBK-vzyskanie-logika.md v2. Задание: prompt-vzyskanie-mockup-v2.md (§21).
// Запуск: node scripts/inspect/collection-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML = readFileSync(resolve('mockups/collection/collection.html'), 'utf8');

/* Свежий DOM на каждый мутирующий тест: openDetail/сторно/окно меняют глобальное состояние. */
function mk(){
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail?.message || e.message)));
  /* url задаёт неопальный origin — без него jsdom бросает SecurityError на
     любом реальном обращении к localStorage (нужен тестам персиста RULES, Task 2). */
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost/' });
  const w = dom.window, doc = w.document;
  const ev = s => w.eval(s);
  const $  = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  const active = () => doc.querySelector('#detailPanels .detail-panel.active');
  const setRole = r => { doc.getElementById('roleSel').value = r; };
  return { dom, w, doc, ev, $, $$, active, setRole, errs };
}

let fails = 0, n = 0;
const ok = (name, cond) => { n++; if (!cond) fails++; console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); };

const g = mk();   // общий DOM для read-only проверок

// ───────── Модель состояния (1–8) ─────────
g.ev("openDetail('142')");
ok('1. пять плиток в шапке карточки', g.$$('.phead-dims .dim').length === 5);
ok('2. ни одна плитка шапки не редактируема', g.$$('.phead-dims input, .phead-dims select').length === 0);
ok('3. у каждой плитки есть подпись источника', g.$$('.phead-dims .dim .src').length === 5);
g.ev("openDetail('210')");
ok('4. счётчик подтверждения процедуры работает (осталось 3 р.д.)',
  /осталось 3 р\.д\./.test(g.ev("procSourceLabel(PROCESSES.find(p=>p.id==='210'))")));
ok('5. группа не редактируется (в шапке нет полей ввода для группы)', g.$$('.phead-dims select, .phead-dims input').length === 0);
ok('6. словарь статусов процедуры закрыт (селектор из PROCEDURE_DICT)',
  g.ev("PROCEDURE_DICT.length") >= 8 && (g.ev("openProcChangeModal()"), g.$$('#newStatus option').length === g.ev("PROCEDURE_DICT.length")));
g.ev("closeModal()");
ok('7. в данных процесса нет полей cat / catDays / stage',
  g.ev("PROCESSES.some(p=>'cat' in p||'catDays' in p||'stage' in p)") === false);
ok('8. displayPhase объявлена и применяется (151 → «Рассмотрение вопроса реструктуризации»)',
  g.ev("typeof displayPhase==='function'") && g.ev("displayPhase(PROCESSES.find(p=>p.id==='151'))") === 'Рассмотрение вопроса реструктуризации');

// ───────── Машина фаз (9–17) ─────────
ok('9. семь контуров К0…К7 присутствуют', g.ev("['К0','К1','К2','К3','К4','К5','К6','К7'].every(k=>k in CONTOURS)"));
g.ev("openDetail('206')"); g.ev("switchTab(2)");
ok('10. таймлайн К6 показывает три шага банкротства', g.active().querySelectorAll('.tl-step').length === 3);
g.ev("openDetail('204')"); g.ev("switchTab(2)");
const tl204 = g.active().querySelector('.timeline').textContent;
g.ev("openDetail('205')"); g.ev("switchTab(2)");
const tl205 = g.active().querySelector('.timeline').textContent;
ok('11. безакцепт в таймлайне только при праве договора (204 да, 205 нет)',
  /Безакцептное списание/.test(tl204) && !/Безакцептное списание/.test(tl205));
ok('12. stageOf возвращает одно из четырёх значений',
  g.ev("['Досудебный порядок','Судебный порядок','Исполнительное производство','Отчуждение активов'].includes(stageOf('На исполнении'))")
  && g.ev("stageOf('Иск')") === 'Судебный порядок');
ok('13. фильтр «Досудебный порядок» не возвращает процесс в фазе «Иск»',
  g.ev("(stageFilter='Досудебный порядок', visibleProcesses().some(p=>p.id==='142'))") === false);
g.ev("stageFilter=null");
ok('14. все четыре терминала распознаются isTerminal',
  g.ev("['Полное погашение','Признана безнадёжной','Списана','Завершена процедура банкротства'].every(o=>isTerminal({outcome:o}))"));
ok('15. фаза меняется только через веху (MILESTONE_PHASE), селектора нет в справочнике',
  g.ev("Object.keys(MILESTONE_PHASE).length>0 && MILESTONE_PHASE['Исковое заявление']==='Иск'"));
g.ev("openDetail('142')");
ok('16. в карточке нет селектора фазы', g.$$('#detailPanels select').length === 0);
ok('17. безакцепт — условная ветка (CONDITIONAL_PHASE)', g.ev("CONDITIONAL_PHASE") === 'Безакцептное списание');

// ───────── Категория (18–23) ─────────
ok('18. catOfCredit → «высокий» при нуле дней и факторе high (209)',
  g.ev("catOfCredit(PROCESSES.find(p=>p.id==='209').credits[0]).level") === 'high');
ok('19. подавление 181-го применяется до worst-of (210, кредит suppress181)',
  g.ev("catOfCredit(PROCESSES.find(p=>p.id==='210').credits[0]).suppressed") === true
  && g.ev("catOfCredit(PROCESSES.find(p=>p.id==='210').credits[0]).daysEff") === 'mid');
ok('20. категория процесса = worst-of по кредитам (210 → mid)',
  g.ev("catOfProcess(PROCESSES.find(p=>p.id==='210'))") === 'mid');
g.ev("openDetail('210')"); g.ev("catOpen=false; toggleCat()");
ok('21. раскрытие показывает входы покредитно (2 кредита + worst-of)',
  g.$$('.cat-expand .row').length === 3);
ok('22. честная категория видна при подавлении («подавлен»)', /подавлен/.test(g.$('.cat-expand').textContent));
ok('23. сортировка по категории идёт по тяжести (rank), не по алфавиту',
  g.ev("sortVal(PROCESSES.find(p=>p.id==='209'),'cat')") === g.ev("CAT_RANK.high"));

// ───────── Окно и сроки (24–31) ─────────
ok('24. гейт первичной претензии закрыт при открытом окне (201)',
  !!g.ev("measureGate(PROCESSES.find(p=>p.id==='201'),'Первичная претензия')"));
ok('25. причина гейта окна названа текстом',
  /Окно ожидания/.test(g.ev("measureGate(PROCESSES.find(p=>p.id==='201'),'Первичная претензия').reason")));
{ const m = mk(); m.ev("openDetail('201')"); m.ev("closeWindowMark()");
  ok('26. отметка куратора закрывает окно', m.ev("curProc.window.open") === false); }
ok('27. окно нигде не превышает 14 к.д.', g.ev("PROCESSES.every(p=>!p.window||p.window.days<=14)"));
ok('28. процесс, закрытый ретроспективно (203), скрыт по умолчанию',
  g.ev("visibleProcesses().some(p=>p.id==='203')") === false);
ok('29. остаток срока считается от базы шаблона, не от даты ввода (142 апелляция)',
  g.ev("PROCESSES.find(p=>p.id==='142').deadlines[0].base").includes('вынесения'));
ok('30. константа шаблонов сроков присутствует (39 строк) с базами и пунктами',
  g.ev("DEADLINE_TEMPLATES.length") === 39 && g.ev("DEADLINE_TEMPLATES.every(t=>t.base&&t.point)"));
g.ev("openDetail('201')");
ok('31. кнопок назначения / переназначения / продления заданий нет',
  !/Назначить исполнителя|Переназначить|Продлить срок/i.test(g.$('#detailPanels').textContent));

// ───────── Гейты (32–38) ─────────
ok('32. безакцепт заблокирован без решения комитета (204)',
  g.ev("gateReason(PROCESSES.find(p=>p.id==='204'),'Безакцептное списание')") !== null);
{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('33. иск заблокирован без поручения Председателя (204, роль ОПК)',
    /поручени/i.test(m.ev("measureGate(PROCESSES.find(p=>p.id==='204'),'Исковое заявление').reason"))); }
ok('34. внесудебный порядок недоступен для имущественного комплекса (жёсткая блокировка)',
  g.ev("PROCESSES.find(p=>p.id==='104').colls.some(c=>/имущественный комплекс/.test(c.ban))"));
{ const m = mk(); m.ev("openDetail('120')"); m.ev("openAgreementModal()");
  // МС-1: срок графика >5 лет ПРИ истёкших сроках → гейт блокирует сохранение (п. 24).
  m.doc.getElementById('agYears').value = '6'; m.doc.getElementById('agExpired').checked = true; m.ev("agSync()");
  ok('35. МС-1: срок >5 лет при истёкших сроках — гейт блокирует Save',
    m.$('#agSave').disabled === true && /не превышает 5 лет/.test(m.$('#agTermGate').textContent)); }
{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  // 142 уже на фазе «Иск» (ИСК-77 подан): в measureGate его корректно перехватывает более ранний
  // гейт «веха пройдена» (sequence). Детекцию пересечения проверяем напрямую (симметрично 36b).
  ok('36. пересечение обнаружено на судебной стадии (142 по кредиту 56 ↔ 151)',
    m.ev("crossingOnCourt(PROCESSES.find(p=>p.id==='142'),PROCESSES.find(p=>p.id==='142').credits[0])") !== null);
  ok('36c. на 142 «Исковое заявление» перекрыто гейтом «веха уже пройдена» (уже на фазе Иск)',
    m.ev("measureGate(PROCESSES.find(p=>p.id==='142'),'Исковое заявление').kind") === 'sequence');
  ok('36b. гейт пересечения НЕ срабатывает при отсутствии другого судебного процесса (204)',
    m.ev("crossingOnCourt(PROCESSES.find(p=>p.id==='204'),PROCESSES.find(p=>p.id==='204').credits[0])") === null); }
{ const m = mk(); m.setRole('Отраслевой департамент (ОД)');
  ok('37. регистрация извещения недоступна отраслевому департаменту (В-9, полномочие ДПО)',
    /ДПО/.test(m.ev("subdivReason('Извещение об обращении на залог')"))); }
ok('38. каждый гейт называет причину и пункт',
  g.ev("Object.keys(GATES).every(k=>{const r=gateReason(PROCESSES.find(p=>p.id==='204'),k); return r===null||/п\\. /.test(r);})"));

// ───────── Меры и расчёт (39–45) ─────────
ok('39. три оси результата независимы (142 иск: result / resultKind / execStage)', g.ev(`(()=>{
  const m=PROCESSES.find(p=>p.id==='142').measures.find(x=>x.kind==='Исковое заявление');
  return !!m.result.group && !!m.resultKind && !!m.execStage && m.resultKind!==m.execStage;
})()`));
{ const m = mk(); m.ev("openDetail('142')"); const before = m.ev("curProc.measures.length");
  const idx = m.ev("curProc.measures.findIndex(x=>x.kind==='Исковое заявление')");
  m.ev(`openStornoModal(${idx})`); m.$('#stReason').value = 'ошибочная регистрация'; m.ev(`doStorno(${idx})`);
  ok('40. сторно не удаляет строку', m.ev("curProc.measures.length") === before && m.ev(`curProc.measures[${idx}].storno!=null`));
  ok('41. сторно меры-вехи откатывает фазу к предыдущей вехе (Иск → Повторная претензия)',
    m.ev("curProc.phase") === 'Повторная претензия'); }
g.ev("openDetail('142')"); g.ev("switchTab(2)");
ok('42. расхождение суммы помечено, сумма документа не переписана',
  /сумма расходится с расчётом/.test(g.active().textContent)
  && g.ev("PROCESSES.find(p=>p.id==='142').measures.find(x=>x.kind==='Исковое заявление').sum") === '48 900,00');
ok('43. пять статей долга (DEBT_BUCKETS + costs)',
  g.ev("DEBT_BUCKETS.length") === 5 && g.ev("'costs' in DEBT_LABELS"));
g.ev("openDetail('104')"); g.ev("switchTab(1)");
ok('44. строка возврата залогодателю присутствует при реализации залога (104)',
  /Возврат залогодателю/.test(g.active().textContent));
ok('45. непокрытый остаток ссылается на п. 33 (104)', /п\. 33/.test(g.active().textContent));

// ───────── Прочее (46+) ─────────
{ const m = mk(); m.ev("openDetail('104')"); m.ev("openRejectProc()");
  ok('46. чек-лист структурный: отклонение перечисляет позиции (7 позиций п. 20.2)',
    m.$$('#modalHost .rejChk').length === 7); }
ok('47. конфликт интересов блокирует действия (205, куратор отстранён)',
  g.ev("measureGate(PROCESSES.find(p=>p.id==='205'),'Повторная претензия').kind") === 'conflict');
{ const m = mk();
  const total = m.ev("PROCESSES.filter(p=>!isRetroClosed(p)).length");
  const sum = m.ev("['gate','window','procWait','overdue'].reduce((s,k)=>s+PROCESSES.filter(p=>!isRetroClosed(p)).filter(p=>listStatus(p)===k).length,0)");
  ok('48. сумма плиток равна «Всего» (partition, P3-R32)', total === sum && total > 0); }
{ const m = mk(); m.ev("openDetail('151')"); m.ev("recalcOnIzveschenie()");
  ok('49. пересчёт при извещении выполняется на клике (В-8, диалог с новой суммой)',
    /пересчитано с|пересчита/i.test(m.$('#modalHost').textContent)); }

// ───────── Дополнительно: целостность и отсутствие ошибок консоли ─────────
ok('50. 70 процессов в списке по умолчанию (ретро-закрытые 203/306/307 скрыты; +337 МС-проект)', g.$$('#listBody tr').length === 70);
ok('51. 13 колонок В-11 в списке', g.$$('#listHead th').length === 13);
ok('52. title у обрезаемых колонок (Заёмщик/Охват/Фаза/Процедура/Владелец)', g.$$('#listBody tr').every(tr => {
  const t = i => tr.children[i].getAttribute('title');
  return t(1) && t(3) && t(4) && t(5) && t(12);
}));
ok('53. terminal-процессы приглушены (097/207/208 + скрытый 203)', g.$$('#listBody tr.terminal').length >= 3);
ok('54. группа выводится из подтверждённой процедуры (208 → 5)', g.ev("groupOf(PROCESSES.find(p=>p.id==='208'))") === '5');
ok('55. группа не выведена при неподтверждённой процедуре (210)', g.ev("groupOf(PROCESSES.find(p=>p.id==='210'))") === null);

// ───────── RULES: единый слой правил (Task 1) ─────────
{ const m = mk();
  ok('58. RULES.measureSubdiv идентичен литералу MEASURE_SUBDIV',
    m.ev("JSON.stringify(RULES.measureSubdiv)===JSON.stringify(MEASURE_SUBDIV)"));
  ok('59. RULES.sectionClevel идентичен литералу SECTION_CLEVEL',
    m.ev("JSON.stringify(RULES.sectionClevel)===JSON.stringify(SECTION_CLEVEL)"));
  ok('60. RULES.contourPhases.К1 совпадает с CONTOURS.К1.phases',
    m.ev("JSON.stringify(RULES.contourPhases['К1'])===JSON.stringify(CONTOURS['К1'].phases)"));
  ok('61. phasesOf(К1) читает порядок из RULES',
    m.ev("phasesOf('К1').join('>')")==='Претензия>Повторная претензия>Безакцептное списание');
  ok('62. RULES_DEFAULTS заморожен',
    m.ev("Object.isFrozen(RULES_DEFAULTS)")===true); }

// ───────── RULES: персист и сброс (Task 2) ─────────
{ const m = mk();
  ok('63. persistRules пишет ключ RULES_KEY', m.ev(`(()=>{
    RULES.sectionClevel['Досудебный']=3; persistRules();
    return localStorage.getItem(RULES_KEY) && JSON.parse(localStorage.getItem(RULES_KEY)).sectionClevel['Досудебный']===3;
  })()`));
  ok('64. resetRulesAll восстанавливает дефолт', m.ev(`(()=>{
    RULES.sectionClevel['Досудебный']=3; resetRulesAll();
    return RULES.sectionClevel['Досудебный']===RULES_DEFAULTS.sectionClevel['Досудебный'];
  })()`));
  ok('65. resetRulesSection сбрасывает одну ось', m.ev(`(()=>{
    RULES.gates={}; RULES.sectionClevel['Судебный']=5; resetRulesSection('gates');
    return Object.keys(RULES.gates).length>0 && RULES.sectionClevel['Судебный']===5;
  })()`)); }

// ───────── Экран настроек: каркас (Task 3) ─────────
{ const m = mk();
  m.ev("showView('settings')");
  ok('66. showView(settings) показывает view-settings',
    m.$('#view-settings').style.display==='flex');
  ok('67. showView(settings) пишет hash', m.ev("location.hash")==='#settings');
  ok('68. на экране настроек 4 вкладки', m.$$('#view-settings .settings-tab').length===4);
  ok('69. переключение вкладки меняет settingsTab', m.ev("(()=>{ showSettingsTab('gates'); return settingsTab; })()")==='gates');
  const m2 = mk(); m2.w.location.hash='#settings'; m2.ev("restoreFromHash()");
  ok('70. restoreFromHash открывает настройки по #settings', m2.$('#view-settings').style.display==='flex'); }

// ───────── Вкладка В-9 (Task 4) ─────────
{ const m = mk(); m.ev("showView('settings'); showSettingsTab('v9')");
  ok('71. грид В-9 рендерит строку на каждый вид меры',
    m.$$('#settingsHost .settings-grid tbody tr').length === m.ev("MEASURE_KINDS.length"));
  ok('72. toggleV9 снимает последнее подразделение → вид исчезает из availableKinds', m.ev(`(()=>{
    RULES.measureSubdiv['Первичная претензия']=['ОД'];
    document.getElementById('roleSel').value='Куратор ОД / ДАК / РП';
    toggleV9('Первичная претензия','ОД');   // снять единственное
    const p=PROCESSES.find(x=>x.phase==='Досудебное урегулирование')||PROCESSES.find(x=>x.contour==='К0')||PROCESSES[0];
    return !availableKinds(p).includes('Первичная претензия');
  })()`));
  ok('73. вид без подразделений помечается предупреждением', m.ev(`(()=>{
    RULES.measureSubdiv['Акт сверки']=[]; renderSettings();
    return document.getElementById('settingsHost').innerHTML.includes('никто не сможет');
  })()`));
  ok('74. setRoleSubdiv меняет роль→подразделение', m.ev(`(()=>{ setRoleSubdiv('Наблюдатель','ОД'); return RULES.roleSubdiv['Наблюдатель']==='ОД'; })()`)); }

// ───────── Вкладка Стадии (Task 5) ─────────
{ const m = mk(); m.ev("showView('settings'); showSettingsTab('stage')");
  ok('75. вкладка Стадии рендерит селект на каждый раздел',
    m.$$('#settingsHost .settings-grid tbody tr select').length === m.ev("SECTION_ORDER.length"));
  ok('76. повышение sectionClevel блокирует меру раздела на низкой ступени', m.ev(`(()=>{
    const p=PROCESSES.find(x=>x.contour==='К1'); // досудечка, curL=1
    const before=sequenceReason(p,'Акт сверки'); // Досудебный, secL=1 → open
    setSectionClevel('Досудебный',4);
    const after=sequenceReason(p,'Акт сверки'); // secL=4 > 1+1 → blocked
    return !before && !!after;
  })()`)); }

// ───────── Вкладка Гейты (Task 6) ─────────
{ const m = mk(); m.ev("showView('settings'); showSettingsTab('gates')");
  ok('77. вкладка Гейты рендерит строку на каждый гейт',
    m.$$('#settingsHost .settings-grid tbody tr').length === m.ev("Object.keys(RULES.gates).length"));
  ok('78. отключение гейта разблокирует Исковое на процессе без поручения', m.ev(`(()=>{
    const p=PROCESSES.find(x=>x.id==='151'); // нет poruchenie
    const before=gateReason(p,'Исковое заявление'); // требует поручения → blocked
    toggleGate('Исковое заявление');           // гейт → off
    const after=gateReason(p,'Исковое заявление'); // гейт снят → null
    return !!before && !after;
  })()`)); }

// ───────── Вкладка Фазы (Task 7) ─────────
{ const m = mk(); m.ev("showView('settings'); showSettingsTab('phases')");
  ok('79. вкладка Фазы рендерит блок на каждый контур',
    m.$$('#settingsHost .phase-contour').length === m.ev("Object.keys(CONTOURS).length"));
  ok('80. movePhase меняет порядок в RULES.contourPhases', m.ev(`(()=>{
    movePhase('К1',0,1); // Претензия <-> Повторная претензия
    return phasesOf('К1')[0]==='Повторная претензия' && phasesOf('К1')[1]==='Претензия';
  })()`));
  ok('81. переупорядочивание меняет предусловие sequenceReason', m.ev(`(()=>{
    resetRulesSection('contourPhases');
    const p=PROCESSES.find(x=>x.phase==='Претензия'); // фаза Претензия
    const before=sequenceReason(p,'Повторная претензия'); // prereq=Претензия==фаза → open
    movePhase('К1',0,1); // теперь Повторная на позиции 0, prereq иной
    const after=sequenceReason(p,'Повторная претензия');
    resetRulesSection('contourPhases');
    return !before && !!after;
  })()`)); }

// ───────── Мировое соглашение: решения МС-1…МС-7 ─────────
// Пур-функции (без DOM).
ok('82. МС-1: срок производный ≈ 3.5 (8 платежей × 6 мес)',
  g.ev("msTermYears(msSeedSchedule('15.08.2026',6,8,96400))") === 3.5);
ok('83. МС-1: срок производный === 3.0 (7 платежей × 6 мес)',
  g.ev("msTermYears(msSeedSchedule('15.10.2026',6,7,112000))") === 3.0);
ok('84. МС-1: гейт блок при >5 лет и истёкших сроках', g.ev("msTermGate(true,6).level") === 'block');
ok('85. МС-1: гейт warn (не блок) при >5 лет без истёкших', g.ev("msTermGate(false,6).level") === 'warn');
ok('86. МС-1: гейт ok при ≤5 лет', g.ev("msTermGate(true,5).level") === 'ok' && g.ev("msTermGate(true,3.5).level") === 'ok');
ok('87. МС-1: дефолт истёкших сроков из ускорения (п. 114)',
  g.ev("msExpiredDefault({scope:'полный остаток'})") === true
  && g.ev("msExpiredDefault({scope:'просроченная сумма',measures:[]})") === false);
ok('88. МС-5: мировое допустимо на судебной стадии, не раньше',
  g.ev("msStageEligible({phase:'Иск',measures:[]},'mirovoe').ok") === true
  && g.ev("msStageEligible({phase:'Извещение',measures:[]},'mirovoe').ok") === false);
ok('89. МС-5: добровольное требует судебного акта',
  g.ev("msStageEligible({measures:[{kind:'Решение суда',delivered:true}]},'dobrovolnoe').ok") === true
  && g.ev("msStageEligible({phase:'Иск',measures:[]},'dobrovolnoe').ok") === false);
ok('90. МС-2: аттестация «не льготнее» — только при attested',
  g.ev("msNotWorseOk({notWorse:{attested:true}})") === true
  && g.ev("msNotWorseOk({notWorse:{attested:false}})") === false
  && g.ev("msNotWorseOk({})") === false);
ok('91. МС-4: мини-гейт графика (нужен и отдел, и непустой schedule[])',
  g.ev("msScheduleReady({scheduleBy:'ОД',schedule:[{pay:'15.08.2026',principal:1}]})") === true
  && g.ev("msScheduleReady({scheduleBy:'',schedule:[{pay:'15.08.2026',principal:1}]})") === false
  && g.ev("msScheduleReady({scheduleBy:'ОД',schedule:[]})") === false);
ok('92. МС-1: каскад графика — последний остаток 0, сумма тела == итог', g.ev(`(()=>{
  const a=PROCESSES.find(p=>p.id==='120').agreements[0];
  const total=a.schedule.reduce((s,r)=>s+r.principal,0);
  const rows=msComputeRows(a,{rate:a.rate,base:365,start:a.approvedAt,principalTotal:total});
  const sump=rows.reduce((s,r)=>s+r.principal,0);
  return Math.abs(rows[rows.length-1].close)<0.01 && Math.abs(sump-total)<0.01;
})()`));

// DOM/переходы (МС-3/МС-7).
{ const m = mk(); m.ev("openDetail('337')"); m.ev("msApprove('МС-18')");
  ok('93. МС-3: утверждение под гейтом (337: график + аттестация есть)',
    m.ev("_msFind('МС-18').status") === 'утверждено судом');
  ok('94. МС-3: без графика отраслевого утвердить нельзя', m.ev(`(()=>{
    const a=_msFind('МС-18'); a.status='проект'; a.scheduleBy=''; msApprove('МС-18'); return a.status;
  })()`) === 'проект'); }
{ const m = mk(); m.ev("openDetail('337')"); m.ev("msReject('МС-18')");
  ok('95. МС-3: отказ в утверждении', m.ev("_msFind('МС-18').status") === 'отказано в утверждении'); }
{ const m = mk(); m.ev("openDetail('120')"); m.ev("msBreach('МС-12')");
  ok('96. МС-7: нарушение утверждённого МС ставит флаг breached',
    m.ev("_msFind('МС-12').breached") === true); }
{ const m = mk(); m.ev("openDetail('337')");
  ok('97. МС-7: msBreach не трогает проект (не утверждён судом)', m.ev(`(()=>{
    const a=_msFind('МС-18'); const b=a.breached; msBreach('МС-18'); return a.breached===b && !a.breached;
  })()`)); }
ok('98. МС-3: баннер зависит от статуса (утверждено / проект / нарушено)',
  /утверждено судом/.test(g.ev("msBanner(PROCESSES.find(p=>p.id==='120').agreements[0])"))
  && /проект, не утверждён/.test(g.ev("msBanner(PROCESSES.find(p=>p.id==='337').agreements[0])"))
  && /нарушено/.test(g.ev("msBanner({type:'mirovoe',num:'X',breached:true})")));

console.log(`\nОШИБОК КОНСОЛИ (jsdomError): ${g.errs.length}`);
g.errs.forEach(e => console.log('  ' + e));
console.log(`ВСЕГО ПРОВЕРОК: ${n} · ПРОВАЛЕНО: ${fails}`);
process.exit(fails || g.errs.length ? 1 : 0);
