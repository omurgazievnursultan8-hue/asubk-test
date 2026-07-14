// Аудит модуля «Управление организационной структурой» (мокап v2).
// Не регресс-тест (это org-structure-v2-check.mjs), а ПОЛНЫЙ ОБХОД ДЕЙСТВИЙ:
// что пользователь может сделать, что не может, и где логика пропускает ошибку.
//   node scripts/inspect/org-structure-v2-audit.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = 'file://' + path.join(root, 'mockups/org-structure/org-structure-v2.html');

const OK = [], GAP = [], BUG = [];
const ok  = (m)=> OK.push(m);
const gap = (m)=> GAP.push(m);
const bug = (m)=> BUG.push(m);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(200);

const reload = async () => { await page.goto(url); await page.waitForTimeout(150); };
const sel = (s) => page.locator(s);

/* ---------- 1. ИНВЕНТАРИЗАЦИЯ КНОПОК: что вообще кликабельно ---------- */
const inventory = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, .dtab, .metric, select, input').forEach(el => {
    const id = el.id || '';
    const cls = el.className && typeof el.className === 'string' ? el.className : '';
    const txt = (el.textContent || '').trim().slice(0, 40);
    const wired = !!(el.onclick || el.onchange);
    out.push({ tag: el.tagName, id, cls, txt, wired, disabled: !!el.disabled });
  });
  return out;
});

/* ---------- 2. МЁРТВЫЕ КНОПКИ В «ТРЕБУЕТ ВНИМАНИЯ» ---------- */
// «Назначить» / «Продлить» / «Добавить штатную единицу» — рисуются, но обработчика нет.
for (const [tab, label] of [['headVacant','Назначить'], ['actingExpiring','Продлить'], ['noStaff','Добавить штатную единицу']]) {
  await page.click(`#probTabs .dtab[data-prob="${tab}"]`).catch(()=>{});
  await page.waitForTimeout(80);
  const btn = sel('#probs .rowact').first();
  if (await btn.count() === 0) { ok(`«Требует внимания» → ${tab}: строк нет, кнопку «${label}» не проверяли`); continue; }
  const before = await page.evaluate(() => [state.view, JSON.stringify(state.sel), document.querySelectorAll('.modal-back.open').length].join('|'));
  await btn.click();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => [state.view, JSON.stringify(state.sel), document.querySelectorAll('.modal-back.open').length].join('|'));
  if (before === after) bug(`Кнопка «${label}» в рабочем списке «${tab}» МЁРТВАЯ: клик ничего не делает (нет onclick; bindProbs её явно исключает из перехода по строке).`);
  else ok(`Кнопка «${label}» в «${tab}» работает`);
}
await reload();

/* ---------- 3. ЧТО ВООБЩЕ НЕЛЬЗЯ СДЕЛАТЬ (пропущенные действия) ---------- */
const missing = await page.evaluate(() => {
  const txt = document.body.innerText;
  const has = (re) => re.test(txt);
  // ищем в исходнике страницы все обработчики, чтобы понять, есть ли вообще такая операция
  const src = document.documentElement.innerHTML;
  return {
    renameUI:   /Переименовать|Изменить название/i.test(src),
    reparentUI: /Переподчинить|Сменить вышестоящее/i.test(src),
    editPosUI:  /Изменить единицу|Редактировать единицу|Удалить единицу/i.test(src),
    endAssignUI:/Освободить|Уволить|Прекратить назначение|Перевести/i.test(src),
    extendActUI:/onclick[^>]*Продлить/i.test(src),
    successorUI:/id="auSucc|Кому переданы функции.*select|правопреемник.*select/i.test(src),
    editTitleUI:/Изменить должность|Удалить должность/i.test(src),
    editTerrUI: /Изменить территорию/i.test(src),
    reopenUI:   /Открыть заново|Отменить закрытие/i.test(src),
    searchUI:   /type="search"|placeholder="Поиск/i.test(src),
    confirmLiq: /confirm\(/.test(src),
  };
});
const M = missing;
if (!M.renameUI)    gap('ПЕРЕИМЕНОВАНИЕ подразделения — в UI нет. NAME_VER версионируется в модели, демо-данные показывают переименование Сектора, но кадровик выполнить его не может.');
if (!M.reparentUI)  gap('ПЕРЕПОДЧИНЕНИЕ (смена вышестоящего) — в UI нет. PARENT_VER версионируется, демо показывает перенос Отдела рисков, но сделать это нельзя.');
if (!M.editPosUI)   gap('ШТАТНАЯ ЕДИНИЦА: только создание. Нельзя изменить число ставок, снять признак «руководитель», удалить ошибочную единицу.');
if (!M.endAssignUI) gap('НАЗНАЧЕНИЕ: только создание. Нельзя освободить/уволить/перевести — поле `to` после создания не меняется никогда.');
if (!M.successorUI) gap('ЗАКРЫТИЕ: некуда указать, КОМУ ПЕРЕДАНЫ ФУНКЦИИ. Событие всегда уходит без правопреемника.');
if (!M.editTitleUI) gap('СПРАВОЧНИК ДОЛЖНОСТЕЙ: только «+ Должность». Нельзя переименовать, снять признак «руководящая», удалить неиспользуемую.');
if (!M.editTerrUI)  gap('ТЕРРИТОРИЯ задаётся только при создании подразделения — потом не меняется.');
if (!M.reopenUI)    gap('ЗАКРЫТИЕ необратимо: «открыть заново» нет, а Ctrl+Z в модуле не существует.');
if (!M.searchUI)    gap('ПОИСКА нет нигде: ни по структуре, ни по должностям, ни по сотрудникам. На 12 демо-подразделениях незаметно, на реальном ФКФ — блокер.');
if (!M.confirmLiq)  bug('ЗАКРЫТИЕ подразделения выполняется по ОДНОМУ клику без подтверждения — необратимая операция без confirm.');

/* ---------- 4. СЦЕНАРИЙ «ЗАКРЫТЬ ОШСКОЕ РП» — доводится ли до конца? ---------- */
// Проверки требуют: убрать подчинённых и снять назначения. Есть ли в UI средства?
await page.evaluate(() => { state.view='units'; state.sel='osh'; state.tab='liq'; render(); });
await page.waitForTimeout(120);
const oshLiq = await page.evaluate(() => ({
  blocked: document.getElementById('liqBtn').disabled,
  gates: [...document.querySelectorAll('#p-liq .gate')].map(g => g.querySelector('.gh').textContent.trim() + ' :: ' + g.className),
}));
if (oshLiq.blocked) {
  bug('ТУПИК: закрытие Ошского РП заблокировано проверками («действующие подчинённые», «действующие назначения»), но снять ни то, ни другое в UI НЕЧЕМ — нет переподчинения и нет освобождения от должности. Сценарий закрытия непроходим для любого непустого подразделения.');
}

/* ---------- 5. ПЕРЕПОЛНЕНИЕ ШТАТНОЙ ЕДИНИЦЫ: ставок больше, чем по штату ---------- */
await reload();
await page.evaluate(() => {
  // ps_sector: 1 ставка, вакантна. Назначаем ДВОИХ по 1.0 (main + combine).
  ASSIGN.push({ id:'x1', empId:'e_und',  posId:'ps_sector', kind:'combine', from:'2020-01-01', to:null, rate:1.0 });
  ASSIGN.push({ id:'x2', empId:'e_aud',  posId:'ps_sector', kind:'combine', from:'2020-01-01', to:null, rate:1.0 });
  render();
});
const overfill = await page.evaluate(() => unitStaffAt('sector', state.date));
if (overfill.filled > overfill.planned)
  bug(`ПЕРЕПОЛНЕНИЕ ШТАТА не проверяется: в «Сектор мониторинга» 1 ставка по штату, а занято ${overfill.filled} (${overfill.pct}%). submitAssign проверяет только 0<ставка≤1 у одного человека, но не сумму по единице.`);

/* ---------- 6. ДВА СОВМЕСТИТЕЛЬСТВА НА ОДНОЙ ЕДИНИЦЕ У ОДНОГО ЧЕЛОВЕКА ---------- */
await reload();
const dupCombine = await page.evaluate(async () => {
  state.view='units'; state.sel='oshrisk'; state.tab='staff'; render();
  await new Promise(r=>setTimeout(r,50));
  document.querySelector('.asgbtn[data-pos="ps_oshrsp"]').click();   // гл. специалист, там уже совместитель Иманова
  document.getElementById('maEmp').value = 'e_spec';
  document.getElementById('maKind').value = 'combine';
  document.getElementById('maRate').value = '0.5';
  document.getElementById('maSubmit').click();
  return { err: document.getElementById('maErr').textContent,
           count: ASSIGN.filter(a=>a.empId==='e_spec' && a.posId==='ps_oshrsp').length };
});
if (dupCombine.count > 1)
  bug('ДУБЛЬ СОВМЕСТИТЕЛЬСТВА: одного сотрудника можно назначить на ОДНУ И ТУ ЖЕ штатную единицу дважды по совместительству. Спека (§4) требует «совместительств 0..N, но не на ту же единицу» — проверки в submitAssign нет.');
else ok('Дубль совместительства на ту же единицу отклонён: '+dupCombine.err);

/* ---------- 7. ПЕРЕСЕЧЕНИЕ ОСНОВНЫХ МЕСТ: проверка только на дату НАЧАЛА ---------- */
await reload();
const overlapMain = await page.evaluate(async () => {
  // у Каримова (e_und) основное с 2020-03-01 бессрочно. Оформляем ВТОРОЕ основное задним числом,
  // с 2020-01-01 по 2021-01-01 — на дату начала первое ещё не действует, проверка проходит.
  state.view='units'; state.sel='sector'; state.tab='staff'; render();
  await new Promise(r=>setTimeout(r,50));
  document.querySelector('.asgbtn[data-pos="ps_sector"]').click();
  document.getElementById('maEmp').value  = 'e_und';
  document.getElementById('maKind').value = 'main';
  document.getElementById('maFrom').value = '2020-01-01';
  document.getElementById('maTo').value   = '2021-01-01';
  document.getElementById('maRate').value = '1';
  document.getElementById('maSubmit').click();
  await new Promise(r=>setTimeout(r,50));
  return { err: document.getElementById('maErr').textContent,
           inv: checkMainInvariant('2020-06-01'), created: ASSIGN.some(a=>a.posId==='ps_sector' && a.empId==='e_und') };
});
if (overlapMain.created && overlapMain.inv.length)
  bug('ПЕРЕСЕЧЕНИЕ ОСНОВНЫХ МЕСТ пропускается: правило «одно основное место работы» проверяется ТОЛЬКО на дату начала (spanActive(a, from)), а не на весь интервал. Оформили задним числом второе основное — система приняла и тут же сама показала ошибку «несколько основных мест» на 2020-06-01.');
else if (overlapMain.created) ok('Второе основное создано, инвариант не нарушен');
else ok('Пересекающееся основное отклонено: '+overlapMain.err);

/* ---------- 8. ШТАТНОЕ РАСПИСАНИЕ НЕ ИСТОРИЧНО ---------- */
await reload();
const posNotHistoric = await page.evaluate(async () => {
  state.view='units'; state.sel='sector'; state.tab='staff'; render();
  await new Promise(r=>setTimeout(r,50));
  document.getElementById('addPosBtn').click();
  document.getElementById('mpTitle').value = 'chief';
  document.getElementById('mpUnits').value = '3';
  document.getElementById('mpSubmit').click();
  await new Promise(r=>setTimeout(r,60));
  const now = unitStaffAt('sector', '2026-07-11').planned;
  state.date = '2021-01-01'; document.getElementById('dateInp').value='2021-01-01'; render();
  await new Promise(r=>setTimeout(r,60));
  const past = unitStaffAt('sector', '2021-01-01').planned;
  return { now, past };
});
if (posNotHistoric.past === posNotHistoric.now)
  bug(`ШТАТНОЕ РАСПИСАНИЕ НЕ ВЕРСИОНИРУЕТСЯ: завели штатную единицу сегодня (2026-07-11) — она видна и на 2021-01-01 (ставок по штату там стало ${posNotHistoric.past}). У POSITIONS нет дат from/to, хотя «дата пронизывает всё» — название, подчинённость и назначения историчны, а штат нет. Историю штатной численности восстановить нельзя.`);

/* ---------- 9. ВТОРОЙ ВЕРХНИЙ УРОВЕНЬ ---------- */
await reload();
const secondRoot = await page.evaluate(async () => {
  document.getElementById('addUnitBtn').click();
  document.getElementById('auName').value = 'Второй головной офис';
  document.getElementById('auType').value = 'блок';
  document.getElementById('auParent').value = '';        // — верхний уровень
  document.getElementById('auSubmit').click();
  await new Promise(r=>setTimeout(r,80));
  const roots = UNITS.filter(u=>existsAt(u.id,state.date) && parentAt(u.id,state.date)==null);
  const h = head(roots[roots.length-1].id, state.date);
  return { roots: roots.length, headErr: !!h.error, err: document.getElementById('auErr').textContent };
});
if (secondRoot.roots > 1)
  bug(`ВТОРОЙ ВЕРХНИЙ УРОВЕНЬ создаётся без единого возражения: теперь корней ${secondRoot.roots}. Структура распадается на два несвязанных дерева, у нового руководитель не определяется (${secondRoot.headErr?'head() → ошибка в структуре':'—'}), а rootVacantAt() смотрит только на ПЕРВЫЙ корень (.find) — второй в мониторинг не попадает.`);

/* ---------- 10. ДРОБНЫЕ / ОГРОМНЫЕ СТАВКИ В ШТАТНОЙ ЕДИНИЦЕ ---------- */
await reload();
const fracUnits = await page.evaluate(async () => {
  state.view='units'; state.sel='sector'; state.tab='staff'; render();
  await new Promise(r=>setTimeout(r,50));
  document.getElementById('addPosBtn').click();
  document.getElementById('mpTitle').value = 'chief';
  document.getElementById('mpUnits').value = '2.5';
  document.getElementById('mpSubmit').click();
  await new Promise(r=>setTimeout(r,60));
  return { created: POSITIONS.filter(p=>p.unitId==='sector').some(p=>p.units===2.5),
           err: document.getElementById('mpErr').textContent };
});
if (fracUnits.created)
  bug('ШТАТНАЯ ЕДИНИЦА принимает дробное число ставок (2,5 ставки в одной единице) — валидация только `units >= 1`, шаг не проверяется.');

/* ---------- 11. НАЗНАЧЕНИЕ ЗАДНИМ ЧИСЛОМ РАНЬШЕ СОЗДАНИЯ ПОДРАЗДЕЛЕНИЯ ---------- */
await reload();
const preDate = await page.evaluate(async () => {
  state.view='units'; state.sel='osh'; state.tab='staff'; render();   // Ошское РП создано 2021-01-01
  await new Promise(r=>setTimeout(r,50));
  document.querySelector('.asgbtn[data-pos="ps_osh"]').click();
  document.getElementById('maEmp').value  = 'e_io';
  document.getElementById('maKind').value = 'main';
  document.getElementById('maFrom').value = '2015-01-01';
  document.getElementById('maSubmit').click();
  await new Promise(r=>setTimeout(r,60));
  return { created: ASSIGN.some(a=>a.posId==='ps_osh' && a.from==='2015-01-01'),
           err: document.getElementById('maErr').textContent };
});
if (preDate.created)
  bug('НАЗНАЧЕНИЕ РАНЬШЕ СОЗДАНИЯ ПОДРАЗДЕЛЕНИЯ: человека приняли в Ошское РП с 2015-01-01, хотя РП создано 2021-01-01. Дата назначения не сверяется ни с created подразделения, ни с датой закрытия.');

/* ---------- 12. И.О. НА ЛЮБОЙ СРОК, ХОТЬ НА 10 ЛЕТ; ПРОВЕРКА ПЕРЕСЕЧЕНИЯ — ТОЛЬКО НА ДАТУ НАЧАЛА ---------- */
await reload();
const actingOverlap = await page.evaluate(async () => {
  state.view='units'; state.sel='creditgo'; state.tab='staff'; render();  // на ps_creditgo и.о. с 2026-06-01 по 2026-07-31
  await new Promise(r=>setTimeout(r,50));
  document.querySelector('.asgbtn[data-pos="ps_creditgo"]').click();
  document.getElementById('maEmp').value    = 'e_aud';
  document.getElementById('maKind').value   = 'acting';
  document.getElementById('maKind').dispatchEvent(new Event('change'));
  document.getElementById('maFrom').value   = '2026-07-20';   // ВНУТРИ чужого и.о. → должно отклониться
  document.getElementById('maTo').value     = '2036-07-31';   // и.о. на 10 лет
  document.getElementById('maReason').value = 'приказ №1';
  document.getElementById('maSubmit').click();
  await new Promise(r=>setTimeout(r,60));
  const inside = ACTING.filter(a=>a.posId==='ps_creditgo').length;
  // а теперь — начало ПОСЛЕ чужого и.о., но чужой ещё действует… проверим обратный порядок
  return { blockedInside: inside === 1, err: document.getElementById('maErr').textContent };
});
if (actingOverlap.blockedInside) ok('Пересечение и.о. на дату начала отклоняется: '+actingOverlap.err);
const actingLong = await page.evaluate(async () => {
  state.view='units'; state.sel='osh'; state.tab='staff'; render();
  await new Promise(r=>setTimeout(r,50));
  document.querySelector('.asgbtn[data-pos="ps_osh"]').click();
  document.getElementById('maKind').value = 'acting';
  document.getElementById('maKind').dispatchEvent(new Event('change'));
  document.getElementById('maFrom').value   = '2026-07-11';
  document.getElementById('maTo').value     = '2046-01-01';
  document.getElementById('maReason').value = 'приказ №2';
  document.getElementById('maSubmit').click();
  await new Promise(r=>setTimeout(r,60));
  return ACTING.some(a=>a.posId==='ps_osh' && a.to==='2046-01-01');
});
if (actingLong)
  bug('И.О. НА 20 ЛЕТ: срок и.о. ничем не ограничен. Временная роль оформляется бессрочно по смыслу — предельный срок (напр. 6 мес.) не проверяется, вакансия руководителя маскируется навсегда.');

/* ---------- 13. И.О. НЕ ЗАКРЫВАЕТ ВАКАНСИЮ, НО СНИМАЕТ ЕЁ ИЗ РАБОЧЕГО СПИСКА ---------- */
const vacHidden = await page.evaluate(() => {
  const p = problemsAt(state.date);
  return { headVacant: p.headVacant.map(x=>x.unitId), vac: metricsAt(state.date).vac };
});
if (!vacHidden.headVacant.includes('osh') && vacHidden.vac.total > 0)
  bug(`ПРОТИВОРЕЧИЕ МЕТРИК: после назначения и.о. Ошское РП ИСЧЕЗЛО из списка «Вакансия руководителя» (плитка «Вакансии» его больше не считает: vacHead), но штатная единица по-прежнему числится вакантной в общем счётчике vacPos (${vacHidden.vac.total}). Две разные формулы вакантности на одном экране: «Вакансии всего» и «в т.ч. руководителя» считаются по разным правилам, и цифры расходятся необъяснимо для пользователя.`);

/* ---------- 14. ЗАКРЫТИЕ ПУСТОГО ЛИСТА (счастливый путь) ---------- */
await reload();
const closeLeaf = await page.evaluate(async () => {
  state.view='units'; state.sel='sector'; state.tab='liq'; render();
  await new Promise(r=>setTimeout(r,60));
  const btn = document.getElementById('liqBtn');
  const wasDisabled = btn.disabled;
  btn.click();
  await new Promise(r=>setTimeout(r,80));
  return { wasDisabled, liq: unit('sector').liquidated, ev: EVENT_LOG.slice(),
           succ: unit('sector').successor };
});
if (!closeLeaf.wasDisabled && closeLeaf.liq) {
  ok('Закрытие пустого листа (Сектор мониторинга) проходит, событие уходит: ' + closeLeaf.ev[0]);
  if (!closeLeaf.succ) bug('Закрытое через UI подразделение НАВСЕГДА остаётся без правопреемника — событие ушло как `unit.liquidated(id, дата)` без него, и дозаполнить негде.');
}

/* ---------- 15. ЗАКРЫТИЕ ПОДРАЗДЕЛЕНИЯ ЗАДНИМ ЧИСЛОМ / В БУДУЩЕМ ---------- */
await reload();
const closePast = await page.evaluate(async () => {
  state.date = '2020-06-01'; document.getElementById('dateInp').value = state.date;
  state.view='units'; state.sel='sector'; state.tab='liq'; render();
  await new Promise(r=>setTimeout(r,60));
  const btn = document.getElementById('liqBtn');
  if (btn.disabled) return { disabled:true };
  btn.click();
  await new Promise(r=>setTimeout(r,60));
  return { liq: unit('sector').liquidated, nameVers: NAME_VER.filter(v=>v.unitId==='sector').length };
});
if (closePast.liq === '2020-06-01')
  bug('ЗАКРЫТИЕ ЗАДНИМ ЧИСЛОМ: сектор закрыт на 2020-06-01, хотя в модели у него есть ПЕРЕИМЕНОВАНИЕ от 2023-06-01 — событие после даты закрытия. Дата закрытия не сверяется с более поздними версиями названия/подчинённости/назначений.');

/* ---------- 16. РОЛЬ «НАБЛЮДАТЕЛЬ» — реально ли только чтение ---------- */
await reload();
const obs = await page.evaluate(async () => {
  document.getElementById('roleSel').value = 'obs';
  document.getElementById('roleSel').dispatchEvent(new Event('change'));
  await new Promise(r=>setTimeout(r,80));
  const disabled = {
    addUnit: document.getElementById('addUnitBtn').disabled,
  };
  state.view='units'; state.sel='creditgo'; state.tab='staff'; render();
  await new Promise(r=>setTimeout(r,60));
  disabled.addPos = document.getElementById('addPosBtn').disabled;
  disabled.assign = document.querySelector('.asgbtn').disabled;
  state.tab='liq'; render(); await new Promise(r=>setTimeout(r,40));
  disabled.liq = document.getElementById('liqBtn')?.disabled;
  state.view='titles'; render(); await new Promise(r=>setTimeout(r,40));
  disabled.addTitle = document.getElementById('addTitleBtn').disabled;
  // а через консоль / без кнопки?
  const before = UNITS.length;
  openAddUnit();
  const modalOpen = document.getElementById('modalBack').classList.contains('open');
  return { disabled, modalOpen, before };
});
const allDisabled = Object.values(obs.disabled).every(Boolean);
if (allDisabled && !obs.modalOpen) ok('Роль «Наблюдатель»: все кнопки записи заблокированы, модалка создания не открывается даже программно (canEdit()-гард).');
else bug('Роль «Наблюдатель» дырявая: ' + JSON.stringify(obs));

/* ---------- 17. ПЕЧАТЬ / ЭКСПОРТ ---------- */
const printBits = await page.evaluate(() => {
  const src = document.documentElement.innerHTML;
  return { hasPrintBtn: !!document.getElementById('ovPrint'),
           printOnUnitCard: /Печать карточки/.test(src),
           hasExport: /Экспорт|CSV|XLSX|Выгрузить/i.test(src),
           printCss: /@media\s+print/.test(src) };
});
if (printBits.hasPrintBtn && !printBits.printCss)
  bug('ПЕЧАТЬ: кнопка «Печать» на «Обзоре» вызывает window.print(), но правил @media print в файле НЕТ — на бумагу уйдёт экран целиком, с сайдбаром, вкладками и кнопками.');
if (!printBits.hasExport) gap('ЭКСПОРТА нет (ни CSV, ни XLSX): выгрузить штатное расписание или структуру для кадров/приказа нечем.');
if (!printBits.printOnUnitCard) gap('Печать есть только на «Обзоре» — карточку подразделения (паспорт/штатку) распечатать нельзя.');

/* ---------- 18. КОНСОЛЬНЫЕ ОШИБКИ ---------- */
await reload();
await page.evaluate(async () => {
  for (const v of ['overview','units','titles','people']) { state.view=v; render(); await new Promise(r=>setTimeout(r,40)); }
  for (const t of ['overview','staff','history','liq']) { state.view='units'; state.tab=t; render(); await new Promise(r=>setTimeout(r,40)); }
  for (const d of ['2019-01-01','2020-06-01','2023-06-01','2026-07-11','2030-01-01']) {
    state.date=d; document.getElementById('dateInp').value=d; render(); await new Promise(r=>setTimeout(r,40));
  }
});
await page.waitForTimeout(200);

/* ---------- ВЫВОД ---------- */
console.log('\n=== ИНВЕНТАРИЗАЦИЯ УПРАВЛЯЮЩИХ ЭЛЕМЕНТОВ ===');
const dead = inventory.filter(e => e.tag === 'BUTTON' && !e.wired && !e.cls.includes('dtab') && !e.cls.includes('metric') && !e.cls.includes('nav-toggle') && !e.disabled);
console.log(`всего элементов: ${inventory.length}; кнопок без обработчика (на «Обзоре»): ${dead.length}`);
dead.forEach(d => console.log('   · ' + (d.id || d.cls) + ' — «' + d.txt + '»'));

console.log('\n=== ДЕФЕКТЫ ЛОГИКИ (' + BUG.length + ') ===');
BUG.forEach((m, i) => console.log(`${String(i + 1).padStart(2)}. ${m}\n`));
console.log('=== ПРОПУЩЕННЫЕ ДЕЙСТВИЯ (' + GAP.length + ') ===');
GAP.forEach((m, i) => console.log(`${String(i + 1).padStart(2)}. ${m}\n`));
console.log('=== РАБОТАЕТ (' + OK.length + ') ===');
OK.forEach(m => console.log('   ✓ ' + m));
console.log('\n=== ОШИБКИ В КОНСОЛИ: ' + errors.length + ' ===');
errors.forEach(e => console.log('   ! ' + e));

await browser.close();
