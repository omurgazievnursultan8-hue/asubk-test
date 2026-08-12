# Реструктуризация: расчёт живёт на транше — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать каждой сумме в заявке на реструктуризацию адрес — транш, — чтобы заявка,
охватывающая два и более кредита, считалась, показывалась и оформлялась по каждому из них
раздельно.

**Architecture:** Заявка перестаёт быть носителем одного расчёта и становится списком
расчётов, по одному на транш охвата. Расчёт (`Calc`) владеет базой, распоряжениями,
черновиком условий, срезом, фактом и ссылкой на своё допсоглашение. Ключ строки базы и
распоряжения — тройка `(транш, статья, срочность)`; внутри расчёта пара `(статья, срочность)`
остаётся парой, поэтому вся нынешняя механика распоряжений переезжает без правки. Миграция
идёт задачами-надстройками: до последней задачи однорасчётная заявка видна старому коду
через дверь-аксессор, и все 57 сторожей остаются зелёными без единой правки.

**Tech Stack:** Один самодостаточный HTML-макет (`mockups/restructuring/restructuring.html`,
~3285 строк, один прикладной `<script>`, zero-dep, без сборки). Сторож — headless-смоук
`scripts/inspect/restructuring-check.mjs` (node:vm, без DOM).

**Спека:** `docs/superpowers/specs/2026-08-11-restructuring-multicredit-design.md`

## Global Constraints

- **Сторож один и обязателен:** `node scripts/inspect/restructuring-check.mjs`. Сегодня
  **57/57 PASS**. После каждой задачи прогон обязан быть зелёным **целиком** — новый сценарий
  не оправдывает падение старого.
- **Скрипт вписывает результат в шапку `restructuring.html`** (блок после маркера
  `SMOKE (node scripts/inspect/restructuring-check.mjs):`). Это ожидаемая правка файла:
  коммитить вместе с кодом, руками шапку не трогать.
- **Правило умолчания расчёта:** функции уровня заявки принимают `calcId` **необязательным**.
  Один расчёт — можно опустить. Два и более — `calcId` обязателен, иначе функция отказывает
  сообщением, а не берёт первый. Тихий выбор за куратора запрещён.
- **`tranche.ops.push` вне `restructureApplied` не появляется** (ADR-0096, граница
  grep-проверяема).
- **Копейка сходится:** все суммы через `round2`; инвариант «сумма колонки = сумма
  распоряжения» держится в копейку, сирота 0,01 не заводится (РС-38).
- **Стиль файла:** русский язык интерфейса и комментариев; комментарий объясняет «почему»,
  а не «что»; ES2015 без внешних библиотек и без сборки.
- **Однотраншевая заявка не меняется ни на пиксель** — это и есть смысл того, что старые
  сценарии проходят без правок.
- **Номера, занятые сегодня:** правила спеки — по `РС-41`, инварианты — по `ИР-15`, ADR — по
  `0110`, сценарии смоука — по `#57`. Новое начинается с `РС-42`, `ИР-16`, `ADR-0111`, `#58`.

---

## File Structure

| Файл | Ответственность | Действие |
|---|---|---|
| `mockups/restructuring/restructuring.html` | вся логика и весь экран макета | правится во всех задачах |
| `scripts/inspect/restructuring-check.mjs` | сторожевой прогон, сценарии `#1…#57` | дописывается `#58…#66` |
| `mockups/restructuring/ASUBK-restrukturizatsiya-logika.md` | спека модуля (РС-*, ИР-*) | правится в задаче 8 |
| `docs/adr/0111-raschet-zhivet-na-transhe.md` | решение, на которое ссылается спека | создаётся в задаче 8 |
| `TODO.md` | реестр задач, синхронизируется с Google Sheet | строка задачи в задаче 8 |

Файл макета велик, но дробить его этот план не берётся: он самодостаточен по замыслу
(один HTML, открываемый двойным кликом), и разделение на модули — отдельное решение,
которого спека не принимала.

---

### Task 1: Каркас расчёта и дверь к единственному расчёту

**Files:**
- Modify: `mockups/restructuring/restructuring.html:1075` (рядом с `creditById` — новые хелперы)
- Modify: `mockups/restructuring/restructuring.html:1808-1814` (`baseApp`)
- Modify: `mockups/restructuring/restructuring.html:1550-1562` (`setCalcTranche`)
- Modify: `mockups/restructuring/restructuring.html:3255-3275` (экспорт `RS`)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарий `#58`)

**Interfaces:**
- Produces: `mkCalc(credit, tranche) → Calc`, `calcById(app, calcId) → Calc|null`,
  `calcTrancheOf(calc) → tranche|null`, `requireCalc(app, calcId) → Calc|null`,
  `attachCalc(app, tranche) → Calc`. Поле `app.calcs: Calc[]`. Аксессоры
  `app.base` / `app.dispositions` / `app.version` / `app.calcTranche` читают и пишут
  единственный расчёт.
- Consumes: ничего (первая задача).

- [ ] **Step 1: Написать падающий сценарий `#58`**

Дописать в `scripts/inspect/restructuring-check.mjs` **перед** блоком `/* ---- отчёт ---- */`:

```js
/* 58. Каркас расчёта: у демо-заявки с траншем-источником ровно один расчёт, он адресует транш
   и кредит, а старые поля app.base/app.dispositions/app.version — дверь к нему же, не второе
   хранилище (ИР-16). Заявка без транша-источника расчёта не имеет вовсе: пустой расчёт читался
   бы как «база ноль», а её ещё не собирали. */
(() => { fresh();
  const a = app('RS-1001');
  const c = a.calcs[0];
  const one = a.calcs.length === 1;
  const addressed = !!c && c.trancheId === a.calcTranche.id && c.creditId === a.creditIds[0];
  const door = !!c && a.base === c.base && a.dispositions === c.dispositions && a.version === c.version;
  const noTrancheNoCalc = RS.state.apps.filter(x => !x.calcTranche).every(x => x.calcs.length === 0);
  ok(58, one && addressed && door && noTrancheNoCalc,
    `один=${one} адрес=${addressed} дверь=${door} безТраншаНетРасчёта=${noTrancheNoCalc}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #58` — `a.calcs` не определено, прогон `57/58 PASS`, код возврата 1.

- [ ] **Step 3: Завести `Calc` и хелперы**

Вставить после `const creditById = ...` (`restructuring.html:1075`):

```js
/* ============ РАСЧЁТ (РС-42, ADR-0111) ============
   Расчёт — единица финансового ядра, и адресует он ТРАНШ, а не кредит: условия и график живут
   на транше (CONTEXT.md), перенос идёт из транша в транш (ADR-0092, ИР-3), а ИР-2 сверяет сумму
   колонок графика — тоже траншевого. Ключ по кредиту оставил бы кредит с двумя траншами в той же
   неразличимости, из которой мы выходим. Заявка держит список расчётов, по одному на транш
   охвата (ИР-16). */
function mkCalc(credit, tranche){
  return { id:'C-'+tranche.id, trancheId:tranche.id, creditId:credit.id,
           base:[], dispositions:[], version:null,
           cutoff:null, fact:null, dsRef:null, excluded:null };
}
function calcById(app, calcId){ return (app.calcs||[]).find(c=>c.id===calcId) || null; }
function calcTrancheOf(calc){
  const cr = calc && creditById(calc.creditId); if(!cr) return null;
  return (cr.tranches||[]).find(t=>t.id===calc.trancheId) || null;
}
function creditOfTranche(trancheId){
  return state.credits.find(c=>(c.tranches||[]).some(t=>t.id===trancheId)) || null;
}
/* Дверь однорасчётной заявки. Пока расчёт один, звать его по имени незачем — но как только их
   два, умолчание «первый» стало бы тихим выбором за куратора, и дверь обязана отказать, а не
   угадать. Тот же приём, что у гейта согласий: молчания как варианта нет. */
function requireCalc(app, calcId){
  const list = (app && app.calcs) || [];
  if(calcId) return calcById(app, calcId);
  return list.length===1 ? list[0] : null;
}
/* Заведение расчёта под транш. Идемпотентно: транш уже в охвате — возвращаем его расчёт, а не
   заводим второй (ИР-16). */
function attachCalc(app, tranche){
  const exist = (app.calcs||[]).find(c=>c.trancheId===tranche.id);
  if(exist) return exist;
  const cr = creditOfTranche(tranche.id); if(!cr) return null;
  const c = mkCalc(cr, tranche);
  app.calcs.push(c);
  return c;
}
```

- [ ] **Step 4: Переписать `baseApp` — старые поля становятся дверью**

Заменить `baseApp` (`restructuring.html:1808-1814`) целиком:

```js
/* Старые поля base/dispositions/version/calcTranche остаются ДВЕРЬЮ к единственному расчёту,
   а не вторым хранилищем: геттер читает calcs, сеттер пишет в calcs. Пока заявка однотраншевая,
   экран и сторожа разницы не замечают; как только расчётов два — дверь молчит, и звать нужно
   расчёт по имени (requireCalc). */
function baseApp(id,inn,borrower,kindIds,creditIds,regDate){
  const app = { id,inn,borrower,kindIds:[...kindIds],creditIds:[...creditIds],regDate,
    packetDocs:{}, analysisStarted:false, conclusions:[], committee:null, letterSent:null,
    initiator:null, conclusion:null, zk:null, resolution:null,
    ds:null, waiver:null, ops:[], automation:[], outcome:null, history:[],
    calcs:[], cutoff:null };
  ['base','dispositions','version'].forEach(k=>Object.defineProperty(app, k, {
    enumerable:true, configurable:true,
    get(){ const c=requireCalc(app); return c ? c[k] : (k==='version' ? null : []); },
    set(v){ const c=requireCalc(app); if(c) c[k]=v; }
  }));
  Object.defineProperty(app, 'calcTranche', {
    enumerable:true, configurable:true,
    get(){ const c=requireCalc(app); return c ? calcTrancheOf(c) : null; },
    set(t){ if(t) attachCalc(app, t); }
  });
  return app;
}
```

- [ ] **Step 5: Провести `setCalcTranche` через `attachCalc`**

Заменить тело `setCalcTranche` (`restructuring.html:1550-1562`), сохранив имя и подпись:

```js
function setCalcTranche(appId, trancheId){
  if(!guard('editVersion')) return;
  if(!trancheId){ toast('Выберите транш','err'); return; }
  const app=appById(appId);
  let found=null;
  (app.creditIds||[]).forEach(cid=>{ if(found) return; const cr=creditById(cid); if(!cr) return;
    const t=(cr.tranches||[]).find(x=>x.id===trancheId); if(t) found={cr,t}; });
  if(!found){ toast('Транш не найден','err'); return; }
  // Пере-выбор на однорасчётной заявке переставляет транш существующего расчёта, а не плодит
  // второй: куратор передумал, а не добавил кредит (ADR-0042 — черновик не пересоздаётся молча).
  const cur = requireCalc(app);
  if(cur && (app.calcs||[]).length===1){ cur.trancheId=found.t.id; cur.creditId=found.cr.id; }
  else attachCalc(app, found.t);
  const c = requireCalc(app) || calcById(app, 'C-'+found.t.id);
  if(c && !c.version) c.version=draftVersion(found.cr,{});
  app._t=TODAY; H(app,'Транш-источник расчёта выбран: '+found.t.no+' (кредит '+found.cr.no+').',state.role);
  toast('Транш-источник выбран','ok'); render();
}
```

- [ ] **Step 6: Открыть новое в `RS`**

В объект `RS` (`restructuring.html:3272`, строка `trancheCandidates, setCalcTranche, …`) дописать:

```js
  trancheCandidates, setCalcTranche, setVersionParam, recalcPlan,
  calcById, calcTrancheOf, creditOfTranche, requireCalc, attachCalc,
```

- [ ] **Step 7: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 58/58 PASS`, код возврата 0. Если падает любой из `#1…#57` — дверь
протекла, чинить дверь, а не сценарий.

- [ ] **Step 8: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): каркас расчёта — app.calcs и дверь к единственному расчёту"
```

---

### Task 2: Финансовое ядро переезжает на расчёт

**Files:**
- Modify: `mockups/restructuring/restructuring.html:1420-1528` (`defaultBase`,
  `ensureBaseDispositions`, `toggleBaseRow`, `setDisposition`, `setDispAmount`, `setDispPeriods`)
- Modify: `mockups/restructuring/restructuring.html:1711-1717` (`run`)
- Modify: `mockups/restructuring/restructuring.html:1567-1578` (`setVersionParam`)
- Modify: `mockups/restructuring/restructuring.html:1582-1593` (`recalcPlan`)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарий `#59`)

**Interfaces:**
- Consumes: `requireCalc(app, calcId)`, `calcTrancheOf(calc)`, `attachCalc(app, tranche)` из задачи 1.
- Produces: `defaultBase(calcOrApp, date)` (принимает и то и другое), `run(app, date, calcId)`,
  `recalcPlan(appId, calcId)`; четыре сеттера строки получают **последним** необязательным
  аргументом `calcId`: `toggleBaseRow(appId, article, urgency, calcId)`,
  `setDisposition(appId, article, urgency, kind, calcId)`,
  `setDispAmount(appId, article, urgency, value, calcId)`,
  `setDispPeriods(appId, article, urgency, mode, from, to, calcId)`.

- [ ] **Step 1: Написать падающий сценарий `#59`**

```js
/* 59. Два расчёта не смешивают строки. Одной заявке даём два транша разных кредитов, включаем
   строку в первом — во втором она не шевелится. Это и есть ответ на вопрос «по какому кредиту
   какая сумма»: ключ строки — тройка (транш, статья, срочность). */
(() => { fresh();
  const a = app('RS-1001');
  const other = RS.state.credits.find(c => c.id !== a.creditIds[0] && (c.tranches||[]).some(t => !t.closed));
  const t2 = other.tranches.find(t => !t.closed);
  const c2 = RS.attachCalc(a, t2);           // кредит транша ищется по state, охват для этого не нужен
  const c1 = a.calcs[0];
  const two = a.calcs.length === 2 && c1.id !== c2.id;
  RS.ensureBaseDispositions(c1); RS.ensureBaseDispositions(c2);
  const snapshot = JSON.stringify(c2.base);
  RS.toggleBaseRow(a.id, 'principal', 'cur', c1.id);            // трогаем ТОЛЬКО первый расчёт
  const secondIntact = JSON.stringify(c2.base) === snapshot;
  const firstMoved = JSON.stringify(c1.base) !== snapshot;
  const r1 = RS.AppSide.run(a, RS.TODAY, c1.id), r2 = RS.AppSide.run(a, RS.TODAY, c2.id);
  const separateSums = r1.transferSum !== r2.transferSum;
  const refuses = RS.AppSide.run(a, RS.TODAY) === null;          // без calcId при двух расчётах — отказ
  ok(59, two && secondIntact && firstMoved && separateSums && refuses,
    `два=${two} второйЦел=${secondIntact} первыйДвинулся=${firstMoved} суммыРазные=${r1.transferSum}/${r2.transferSum} отказБезИмени=${refuses}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #59` — `RS.ensureBaseDispositions(c1)` работает с заявкой, не с расчётом;
`AppSide.run` третьего аргумента не знает и на двух расчётах вернёт расчёт по пустой двери.

- [ ] **Step 3: Переписать сборку базы под расчёт**

Заменить `defaultBase` / `ensureBaseDispositions` (`restructuring.html:1420-1450`):

```js
/* Принимает расчёт; заявку принимает тоже — но только однорасчётную, через ту же дверь
   requireCalc. Разной логики у двух случаев нет, есть один вход и одно разрешение адреса. */
function asCalc(x, calcId){
  if(!x) return null;
  return x.trancheId ? x : requireCalc(x, calcId);
}
function defaultBase(x, date, calcId){
  const calc = asCalc(x, calcId); if(!calc) return [];
  const tranche = calcTrancheOf(calc); if(!tranche) return [];
  return debtAt(tranche, date).map(row => ({
    ...row,
    included: row.urgency==='over' && !row.disputed,
    blockedBy: row.disputed ? 'disputed' : null
  }));
}
function ensureBaseDispositions(x, calcId){
  const calc = asCalc(x, calcId); if(!calc) return null;
  const app = calc.__app || null;
  const date = (app && app.ds) ? app.ds.date : TODAY;
  if(!calc.base || !calc.base.length) calc.base = defaultBase(calc, date);
  if(!calc.dispositions || !calc.dispositions.length) calc.dispositions = defaultDispositions(calc.base);
  return calc;
}
```

Дата среза расчёта берётся у заявки — расчёт её не дублирует. Чтобы `ensureBaseDispositions`
её нашёл, `attachCalc` (задача 1) дописывает необратный указатель:

в `attachCalc`, сразу после `const c = mkCalc(cr, tranche);` добавить

```js
  Object.defineProperty(c, '__app', { value:app, enumerable:false });   // ссылка вверх, не данные
```

- [ ] **Step 4: Провести четыре сеттера через расчёт**

В каждой из четырёх функций (`toggleBaseRow:1456`, `setDisposition:1473`, `setDispAmount:1494`,
`setDispPeriods:1510`) заменить пролог. Образец для `toggleBaseRow`, остальные три — тем же
приёмом, `calcId` последним параметром:

```js
function toggleBaseRow(appId, article, urgency, calcId){
  if(!guard('editBase')) return; const app=appById(appId);
  const calc = ensureBaseDispositions(app, calcId);
  if(!calc){ toast('У заявки несколько расчётов — укажите, по какому траншу','err'); return; }
  const row = calc.base.find(r=>r.article===article && r.urgency===urgency);
  if(!row || row.blockedBy) return;
  row.included = !row.included;
  if(row.included){
    if(!dispositionFor(calc.dispositions, article, urgency))
      calc.dispositions.push({article,urgency,kind:'none',amount:row.amount,periods:allPeriods()});
  } else {
    calc.dispositions = calc.dispositions.filter(d=>!(d.article===article && d.urgency===urgency));
  }
  app._t=TODAY; render();
}
```

Внутри `setDisposition`, `setDispAmount`, `setDispPeriods` все обращения `app.base` /
`app.dispositions` заменяются на `calc.base` / `calc.dispositions`; `allowedDispositions(app)`
остаётся заявочным — виды живут на заявке (спека §3).

Тем же приёмом переписывается `setVersionParam` (`:1567`) — это второй из шести
`creditIds[0]`, и без правки он на многорасчётной заявке пишет черновик мимо расчёта:

```js
function setVersionParam(appId, key, val, calcId){
  if(!guard('editVersion')) return;
  const app=appById(appId);
  const calc=requireCalc(app, calcId);
  if(!calc){ toast('Сначала выберите транш-источник расчёта','err'); return; }
  if(calc.dsRef || (app.ds && app.ds.no)){ toast('ДС уже зарегистрировано — версия закрыта','err'); return; }
  if(!calc.version) calc.version=draftVersion(creditById(calc.creditId),{});
  const p=calc.version.params;
  if(key==='term') p.term=Number(val)||0;
  else if(key==='rate') p.rate=val===''?null:Number(val);
  else if(key==='schedule') p.schedule=val;
  else if(key==='method') p.method=val;
  app._t=TODAY; render();
}
```

Проверка «версия закрыта» получает второе основание — `calc.dsRef`: закрывает версию своё
соглашение, а не первое зарегистрированное по заявке. Старое условие по `app.ds` остаётся до
задачи 6, где `app.ds` становится дверью и держать его в паре перестаёт быть нужным.

- [ ] **Step 5: Провести `run` и `recalcPlan` через расчёт**

```js
function run(app, date, calcId){
  const calc = asCalc(app, calcId); if(!calc) return null;
  const base0 = (calc.base && calc.base.length ? calc.base : defaultBase(calc, date)).map(r=>({...r, carried:r.amount}));
  const dispositions = calc.dispositions && calc.dispositions.length ? calc.dispositions : defaultDispositions(base0);
  const st0 = { app, calc, date, base:base0, dispositions, forgiven:0, capitalized:0,
                capitalizedInterest:0, capitalizedPenalty:0,
                parts:[], spread:[], remainsOverdue:false, principalPart:0, transferSum:0, stack:[] };
  return PIPELINE.reduce((s, step) => { const {state, record} = step(s); state.stack.push(record); return state; }, st0);
}

function recalcPlan(appId, calcId){
  if(!guard('editVersion')) return;
  const app=appById(appId);
  const calc=requireCalc(app, calcId);
  if(!calc){ toast('У заявки несколько расчётов — укажите, по какому траншу','err'); return; }
  const tranche=calcTrancheOf(calc);
  if(!tranche || !calc.version){ toast('Сначала выберите транш-источник','err'); return; }
  const r=run(app, TODAY, calc.id);
  calc.version.plan=draftSchedule(tranche,{date:TODAY,transferSum:r.transferSum,
    principalPart:r.principalPart,parts:r.parts,params:calc.version.params});
  app._t=TODAY; toast('Черновой график пересчитан','ok'); render();
}
```

- [ ] **Step 6: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 59/59 PASS`. Сценарии `#43…#46`, `#55…#57` бьют по этим самым сеттерам на
однорасчётных заявках — их зелёный и есть доказательство, что дверь держит.

- [ ] **Step 7: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): база, распоряжения и прогон переезжают на расчёт"
```

---

### Task 3: Охват называет траншы; `creditIds` выводится

**Files:**
- Modify: `mockups/restructuring/restructuring.html:1529-1545` (`trancheCandidates`, `pickTrancheBlock`)
- Modify: `mockups/restructuring/restructuring.html:2966-2984` (`openAddCredit`, `addCredit`)
- Modify: `mockups/restructuring/restructuring.html:1361-1363` (`activeAppOnCredit`)
- Modify: `mockups/restructuring/restructuring.html:1808` (`baseApp` — `creditIds` становится аксессором)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарий `#60`)

**Interfaces:**
- Consumes: `attachCalc`, `calcTrancheOf`, `requireCalc` (задача 1).
- Produces: `addTrancheToScope(appId, trancheId)`, `removeTrancheFromScope(appId, calcId)`,
  `scopeTranches(app) → [{cr, t, calc}]`, `activeAppOnTranche(trancheId, exceptAppId)`.
  `app.creditIds` — выводимый список без повторов; ручная запись в него больше не источник охвата.

- [ ] **Step 1: Написать падающий сценарий `#60`**

Сперва — общая фикстура многокредитной заявки, на неё опираются все сценарии `#60…#65`.
Дописать её рядом с `fresh()`/`app()` в шапке смоука:

```js
/* Фикстура многокредитной заявки. Демо-данные не гарантируют, что у ИНН заявки найдётся второй
   кредит со свободным траншем, поэтому берём любой свободный и приписываем его тому же ИНН:
   охват ограничен одним заёмщиком, и без этого addTrancheToScope откажет по делу. Занятый другой
   заявкой транш исключаем — иначе сценарий упал бы на ИР-1, а не на своей теме. */
function secondTranche(a){
  const free = t => !t.closed && !RS.activeAppOnTranche(t.id, a.id);
  const cr = RS.state.credits.find(c => !(a.creditIds||[]).includes(c.id) && (c.tranches||[]).some(free));
  if(!cr) throw new Error('нет свободного кредита для ' + a.id);
  cr.inn = a.inn;
  return { cr, t: cr.tranches.find(free) };
}
```

```js
/* 60. Охват называет траншы (РС-2, ИР-16). Кредит появляется в охвате вместе со своим траншем,
   а не отдельным действием; повторное добавление того же транша второго расчёта не заводит;
   снятие транша уносит расчёт вместе с суммами, не оставляя адреса без суммы. ИР-1 ключуется
   траншем: тот же транш в другой активной заявке — занят. Чужой заёмщик в охват не входит. */
(() => { fresh();
  const a = app('RS-1001');
  const { cr, t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);
  const grew = a.calcs.length === 2 && a.creditIds.includes(cr.id);
  RS.addTrancheToScope(a.id, t.id);                        // повтор
  const idempotent = a.calcs.length === 2;
  const derived = a.creditIds.length === new Set(a.creditIds).size;
  const alien = RS.state.credits.find(c => c.inn !== a.inn && (c.tranches||[]).some(x => !x.closed));
  if(alien) RS.addTrancheToScope(a.id, alien.tranches.find(x => !x.closed).id);
  const noAlien = a.calcs.length === 2;
  const c2 = a.calcs.find(x => x.trancheId === t.id);
  RS.removeTrancheFromScope(a.id, c2.id);
  const shrank = a.calcs.length === 1 && !a.creditIds.includes(cr.id);
  const busy = !!RS.activeAppOnTranche(a.calcs[0].trancheId, 'RS-9999');
  ok(60, grew && idempotent && derived && noAlien && shrank && busy,
    `вырос=${grew} идемпотентно=${idempotent} безДублей=${derived} чужойНеВошёл=${noAlien} снят=${shrank} ИР-1=${busy}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #60` — `RS.addTrancheToScope` не существует.

- [ ] **Step 3: Сделать `creditIds` выводимым**

В `baseApp` убрать `creditIds` из литерала и добавить аксессор рядом с прочими:

```js
  const seededCredits = [...creditIds];        // охват до перехода на траншы (демо-сид, задача 8)
  Object.defineProperty(app, 'creditIds', {
    enumerable:true, configurable:true,
    // Охват называет траншы; кредит — производное от них. Пока у заявки нет ни одного расчёта,
    // источником остаётся сид: у заявки на стадии «Регистрация обращения» кредит уже назван,
    // а транш-источник ещё не выбран, и терять кредит из-за этого нельзя.
    get(){ const fromCalcs=[...new Set(app.calcs.map(c=>c.creditId))];
           return fromCalcs.length ? fromCalcs : seededCredits; },
    set(v){ seededCredits.length=0; (v||[]).forEach(x=>seededCredits.push(x)); }
  });
```

`a.creditIds.push(...)` в сценарии `#59` продолжает работать: он пишет в массив, отданный
геттером, и при пустых `calcs` это `seededCredits`.

- [ ] **Step 4: Завести охват траншами**

Заменить `trancheCandidates` и дописать рядом (`restructuring.html:1529`):

```js
function scopeTranches(app){
  return (app.calcs||[]).map(c=>({ cr:creditById(c.creditId), t:calcTrancheOf(c), calc:c }))
                        .filter(x=>x.cr && x.t);
}
/* Кандидаты — открытые траншы с остатком по кредитам, уже названным в охвате, ПЛЮС траншы
   прочих кредитов того же субъекта: заявка вправе охватывать несколько кредитов одного лица
   (РС-2). Субъект ищется по ИНН — тем же ключом, что naFillCredits (:3202); поля subjectKey у
   кредита нет, оно живёт на транше. Вошедшие вычитаются: второй расчёт на тот же транш
   запрещён (ИР-16). */
function trancheCandidates(app){
  const taken=new Set((app.calcs||[]).map(c=>c.trancheId));
  const list=[];
  state.credits.forEach(cr=>{
    const own = (app.creditIds||[]).includes(cr.id) || cr.inn===app.inn;
    if(!own) return;
    (cr.tranches||[]).forEach(t=>{
      if(t.closed || taken.has(t.id) || round2(balanceAt(t,TODAY))<=0) return;
      list.push({cr,t});
    });
  });
  return list;
}
function addTrancheToScope(appId, trancheId){
  if(!guard('editVersion')) return;
  if(!trancheId){ toast('Выберите транш','err'); return; }
  const app=appById(appId);
  const cr=creditOfTranche(trancheId); if(!cr){ toast('Транш не найден','err'); return; }
  const t=(cr.tranches||[]).find(x=>x.id===trancheId);
  // Заявка — обращение одного заёмщика: кредит чужого ИНН в охват не входит (РС-2).
  if(cr.inn!==app.inn){ toast('Кредит принадлежит другому заёмщику','err'); return; }
  const busy=activeAppOnTranche(trancheId, appId);
  if(busy){ toast('Транш уже в активной заявке '+busy.id+' (ИР-1)','err'); return; }
  const had=(app.calcs||[]).some(c=>c.trancheId===trancheId);
  const calc=attachCalc(app, t);
  if(!calc){ toast('Кредит транша не найден','err'); return; }
  if(!calc.version) calc.version=draftVersion(cr,{});
  if(!had){ app._t=TODAY; H(app,'В охват добавлен транш '+t.no+' (кредит '+cr.no+').',state.role); }
  render();
}
function removeTrancheFromScope(appId, calcId){
  if(!guard('editVersion')) return;
  const app=appById(appId), calc=calcById(app, calcId);
  if(!calc){ toast('Расчёт не найден','err'); return; }
  if(calc.dsRef){ toast('По этому траншу зарегистрировано ДС — из охвата не выводится','err'); return; }
  const t=calcTrancheOf(calc);
  app.calcs=app.calcs.filter(c=>c.id!==calcId);
  app._t=TODAY; H(app,'Из охвата выведен транш '+(t?t.no:calcId)+' вместе с расчётом.',state.role);
  render();
}
/* ИР-1 ключуется траншем, а не кредитом: два расчёта одного графика неразрешимы, а разные
   траншы одного кредита в разных заявках — разрешены (РС-2). */
function activeAppOnTranche(trancheId, exceptAppId){
  return state.apps.find(a=>a.id!==exceptAppId && !stageOf(a).closed
    && (a.calcs||[]).some(c=>c.trancheId===trancheId));
}
```

`activeAppOnCredit` остаётся как есть — им пользуется экран охвата и сценарий `#7`.

- [ ] **Step 5: Заменить действие «добавить кредит» на «добавить транш»**

`openAddCredit` (`:2966`) переименовать в `openAddTranche`, список строить из
`trancheCandidates(app)` с подписью `${t.no} · ${cr.no} · остаток ${fmt(balanceAt(t,TODAY))}`,
кнопку повесить на `RS.addTrancheToScope('${appId}', …)`. `addCredit` удалить. В `RS`:
`openAddCredit, addCredit` → `openAddTranche, addTrancheToScope, removeTrancheFromScope,
scopeTranches, activeAppOnTranche`. `pickTrancheBlock` удалить — его работу делает то же
действие охвата.

- [ ] **Step 6: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 60/60 PASS`. Сценарий `#7` (занятость кредита) обязан остаться зелёным:
он зовёт `activeAppOnCredit`, которую мы не трогали.

- [ ] **Step 7: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): охват называет траншы, creditIds выводится из расчётов"
```

---

### Task 4: Гейты пределов и производный транш — по каждому расчёту

**Files:**
- Modify: `mockups/restructuring/restructuring.html:1283-1290` (`limitsGateApp`)
- Modify: `mockups/restructuring/restructuring.html:2453-2457` (`resultTranche`)
- Modify: `mockups/restructuring/restructuring.html:2427-2438` (`limitsBody`)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарий `#61`)

**Interfaces:**
- Consumes: `scopeTranches(app)` (задача 3), `requireCalc` (задача 1).
- Produces: `limitsGateApp(app) → {ok, pending, messages, rows:[{calcId, creditNo, g}]}`,
  `resultTrancheOf(app, calcId) → tranche|null`.

- [ ] **Step 1: Написать падающий сценарий `#61`**

```js
/* 61. Пределы считаются по КРЕДИТУ каждого расчёта, а не по первому кредиту охвата: пол ставки
   меряется от первоначальной ставки кредита (п. 34, п. 92), предел длины графика — от остатка
   задолженности по кредиту (п. 90). Один app.version на заявку делал эти два гейта
   непроверяемыми, как только кредитов больше одного. */
(() => { fresh();
  const a = app('RS-1001');
  RS.addTrancheToScope(a.id, secondTranche(a).t.id);
  const g = RS.limitsGateApp(a);
  const perCalc = Array.isArray(g.rows) && g.rows.length === 2;
  const addressed = perCalc && g.rows.every(r => !!r.calcId && !!r.creditNo);
  const c2 = a.calcs[1];
  c2.version = { params:{ term: 999, rate: 0.01 } };         // заведомо вне обоих пределов
  const g2 = RS.limitsGateApp(a);
  const catches = g2.ok === false && g2.messages.some(m => /КД-|кредит/i.test(m));
  ok(61, perCalc && addressed && catches,
    `строкиПоРасчётам=${perCalc} адресованы=${addressed} ловитВторой=${catches} (${g2.messages.join(' | ')})`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #61` — `limitsGateApp` возвращает результат одного `limitsGate` без `rows`.

- [ ] **Step 3: Переписать `limitsGateApp` циклом по расчётам**

```js
/* Пределы — гейт КРЕДИТА, а не заявки: пол ставки от первоначальной ставки кредита (п. 34,
   п. 92), длина графика от остатка задолженности по кредиту (п. 90). Каждый расчёт несёт свои
   параметры и свой кредит, поэтому строк столько, сколько расчётов, и сообщение называет кредит:
   «не проходит» без адреса на многокредитной заявке нечинимо. */
function limitsGateApp(app){
  const rows=(app.calcs||[]).map(c=>{
    const credit=creditById(c.creditId);
    const fixed=c.dsRef && app.agreements ? app.agreements.find(d=>d.no===c.dsRef) : null;
    const params = fixed ? fixed.params : (c.version && c.version.params);
    const date   = fixed ? fixed.date   : app.regDate;
    if(!credit) return { calcId:c.id, creditNo:'—', g:{ ok:true, pending:true, messages:['Кредит не найден'] } };
    if(!params) return { calcId:c.id, creditNo:credit.no, g:{ ok:true, pending:true,
                         messages:['Условия ещё не выбраны — гейт неприменим до расчёта'] } };
    return { calcId:c.id, creditNo:credit.no, g:limitsGate(params, credit, date) };
  });
  if(!rows.length) return { ok:true, pending:true, messages:['Кредит не выбран'], rows:[] };
  const pending = rows.every(r=>r.g.pending);
  const ok = rows.every(r=>r.g.ok);
  const messages = rows.flatMap(r=>(r.g.messages||[]).map(m=>rows.length>1 ? r.creditNo+': '+m : m));
  return { ok, pending, messages, rows };
}
```

- [ ] **Step 4: Адресовать производный транш расчётом**

```js
/* производный транш по итогам ДС — единственный признак связи назад к door: ops[0].basis. */
function resultTrancheOf(app, calcId){
  const calc=requireCalc(app, calcId); if(!calc || !calc.dsRef) return null;
  const credit=creditById(calc.creditId); if(!credit) return null;
  return credit.tranches.find(t=>{ const b=(t.ops[0]||{}).basis;
    return b && b.ds===calc.dsRef && b.from===calc.trancheId; }) || null;
}
function resultTranche(app){ return resultTrancheOf(app, null); }   // однорасчётная дверь
```

`limitsBody(app)` перебирает `lga.rows` и печатает по блоку на расчёт с заголовком-кредитом;
при одной строке заголовок не печатается — экран однокредитной заявки не меняется.

- [ ] **Step 5: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 61/61 PASS`. Сценарии `#21…#23`, `#36` бьют по пределам на однокредитных
заявках — их зелёный доказывает, что формат сообщения не поехал.

- [ ] **Step 6: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): пределы и производный транш адресуются расчётом"
```

---

### Task 5: Порог существенности — ступень 1 по расчёту, ступень 2 по заявке

**Files:**
- Modify: `mockups/restructuring/restructuring.html:1738-1773` (`cutoffDrift`, `driftGate`, `fixCutoff`, `fixFact`)
- Modify: `mockups/restructuring/restructuring.html:3121-3129` (`fixLetter` — фиксация среза)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарии `#62`, `#63`)

**Interfaces:**
- Consumes: `requireCalc`, `calcTrancheOf`, `scopeTranches`.
- Produces: `calcDrift(app, calcId) → {cutoffSum, factSum, delta, pct, tier, level}|null`,
  `appDrift(app, date) → {cutoffSum, factSum, delta, pct, tier, level}`,
  `driftGate(app, date) → {ok, applicable, level, …, rows:[{calcId, level, …}]}`,
  `fixCutoff(app, date)` (сеет срез **каждому** расчёту), `fixFact(app, date, calcId, transferSum)`.

- [ ] **Step 1: Написать падающие сценарии `#62` и `#63`**

```js
/* 62. Ступень 1 меряется от базы среза РАСЧЁТА: виза куратора блокирует регистрацию конкретного
   ДС, значит и меряться обязана тем, что в это ДС уходит. Считать её от суммы по заявке значит
   дать крупному кредиту охвата глушить расхождение по мелкому — виза не возникнет там, где
   возникла бы при отдельной заявке (спека §5). */
(() => { fresh();
  const a = app('RS-1001');
  RS.addTrancheToScope(a.id, secondTranche(a).t.id);
  RS.AppSide.fixCutoff(a, '2026-03-30');
  const seeded = a.calcs.every(c => c.cutoff && Array.isArray(c.cutoff.rows));
  const [big, small] = a.calcs;
  const row = amount => [{ article:'principal', urgency:'over', amount, since:'2026-03-30' }];
  big.cutoff.rows   = row(10000000); big.fact   = { date:'2026-07-19', rows: row(10000000) };  // не сдвинулся
  small.cutoff.rows = row(100000);   small.fact = { date:'2026-07-19', rows: row(115000) };    // +15 % — ступень 1
  const perCalc = RS.AppSide.calcDrift(a, small.id);
  const whole   = RS.AppSide.appDrift(a, RS.TODAY);
  ok(62, seeded && perCalc.level === 1 && whole.level === 0,
    `срезПоРасчётам=${seeded} расчёт=${perCalc.level} (${(perCalc.pct*100).toFixed(1)} %) заявка=${whole.level} (${(whole.pct*100).toFixed(1)} %)`);
})();

/* 63. Ступень 2 меряется от Σ базы среза ВСЕХ расчётов: она откатывает заявку целиком, а комитет
   высказывался по обращению, а не по кредиту. Сработала — блокировка ложится на все расчёты, а не
   только на превысивший. */
(() => { fresh();
  const a = app('RS-1001');
  RS.addTrancheToScope(a.id, secondTranche(a).t.id);
  RS.AppSide.fixCutoff(a, '2026-03-30');
  a.calcs.forEach(c => { c.cutoff.rows = [{ article:'principal', urgency:'over', amount: 1000000, since:'2026-03-30' }];
                         c.fact = { date: RS.TODAY, rows:[{ article:'principal', urgency:'over', amount: 1400000, since:'2026-03-30' }] }; });
  a.committee = { fixed:true, date:'2026-02-01' };                 // позиция комитета СТАРШЕ среза
  const g = RS.driftGate(a, RS.TODAY);
  const blockedAll = g.ok === false && g.level === 2 && (g.rows||[]).length === 2;
  a.committee = { fixed:true, date:'2026-08-01' };                 // комитет высказался заново
  const released = RS.driftGate(a, RS.TODAY).ok === true;
  ok(63, blockedAll && released, `ступень2=${g.level} блокировкаНаВсе=${blockedAll} послеКомитета=${released}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #62`, `FAIL #63` — `AppSide.calcDrift` / `AppSide.appDrift` не существуют,
`fixCutoff` пишет один `app.cutoff`.

- [ ] **Step 3: Расщепить срез и порог**

```js
/* Срез — согласовательная величина заявки: дата одна на обращение, суммы свои у каждого расчёта
   (спека §2). Ступень 1 меряется расчётом, ступень 2 — суммой по заявке (спека §5). */
function fixCutoff(app, date){
  app.cutoffDate = date;
  (app.calcs||[]).forEach(c=>{
    const t=calcTrancheOf(c);
    c.cutoff = { date, rows: t ? debtAt(t, date) : [], fixedAt: date };
  });
  app.cutoff = { date, rows: (app.calcs||[]).flatMap(c=>c.cutoff.rows), fixedAt: date };  // итог, не хранилище
  return app.cutoff;
}
function fixFact(app, date, calcId, transferSum){
  const calc=requireCalc(app, calcId); if(!calc) return null;
  const t=calcTrancheOf(calc);
  calc.fact = { date, rows: t ? debtAt(t, date) : [], transferSum: round2(transferSum) };
  // Факт переехал на расчёт, но app.ds.fact — публичный реквизит вступившего соглашения: его
  // читают экран (:2524) и сторож #14. Пока расчёт один, зеркалим; при двух его несёт своё ДС.
  if(app.ds && (app.calcs||[]).length===1) app.ds.fact = calc.fact;
  return calc.fact;
}
function sumRows(rows){ return round2((rows||[]).reduce((s,r)=>s+r.amount,0)); }
function driftOf(cutoffRows, factRows){
  const cutoffSum=sumRows(cutoffRows), factSum=sumRows(factRows);
  const delta=round2(factSum-cutoffSum);
  const tier=driftTier(delta, cutoffSum);
  return { cutoffSum, factSum, delta, pct: cutoffSum ? Math.abs(delta)/cutoffSum : 0,
           tier, level: tier?tier.level:0, material: !!tier };
}
function calcDrift(app, calcId){
  const c=requireCalc(app, calcId);
  if(!c || !c.cutoff || !c.fact) return null;
  return { calcId:c.id, ...driftOf(c.cutoff.rows, c.fact.rows) };
}
function appDrift(app, date){
  const list=(app.calcs||[]).filter(c=>c.cutoff);
  const cut=list.flatMap(c=>c.cutoff.rows);
  const fact=list.flatMap(c=>{
    if(c.fact) return c.fact.rows;
    const t=calcTrancheOf(c); return t ? debtAt(t, date||TODAY) : [];
  });
  return driftOf(cut, fact);
}
/* Гейт регистрации: ступень 2 считается по заявке и блокирует ВСЕ расчёты — вернуть на комитет
   половину обращения нельзя. Ступень 1 остаётся в строках: она про визу конкретного ДС. */
function driftGate(app, date){
  const list=(app.calcs||[]).filter(c=>c.cutoff && c.cutoff.rows);
  if(!list.length) return { ok:true, applicable:false, rows:[] };
  const whole=appDrift(app, date);
  const recommitted = !!(app.committee && app.committee.date && app.cutoff && app.cutoff.date
                         && app.committee.date > app.cutoff.date);   // как сегодня (:1755)
  const rows=list.map(c=>{
    const t=calcTrancheOf(c);
    const factRows = c.fact ? c.fact.rows : (t ? debtAt(t, date||TODAY) : []);
    return { calcId:c.id, creditNo:(creditById(c.creditId)||{}).no || '—', ...driftOf(c.cutoff.rows, factRows) };
  });
  return { ok: whole.level<2 || recommitted, applicable:true, recommitted, rows,
           level:whole.level, tier:whole.tier, delta:whole.delta,
           cutoffSum:whole.cutoffSum, factSum:whole.factSum, pct:whole.pct };
}
```

`cutoffDrift(app)` сохраняется как однорасчётная дверь: `return calcDrift(app, null);`.
В `AppSide` (`:1796`) дописать `calcDrift, appDrift, driftOf`.

- [ ] **Step 4: Поправить три места вызова `fixFact`**

Аргумент вставлен в середину подписи, поэтому старый вызов молча отдал бы сумму как `calcId`.
Мест ровно три, все правятся в этой же задаче:

- `restructuring.html:1954` (демо-цепочка волны 1): `AppSide.fixFact(app,date,null,transferSum);`
- `restructuring.html:2182` (`buildWave2App`): `AppSide.fixFact(app, ds.date, null, ds.transferSum);`
- `restructuring.html:3053` (`regDS`): `AppSide.fixFact(app, date, null, ds.transferSum);`
  — задача 6 заменит `null` на `calc.id`.

- [ ] **Step 5: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 63/63 PASS`. Сценарии `#13` (срез/факт демо-заявки), `#14` (`a.ds.fact.rows`)
и `#33` (две ступени) обязаны остаться зелёными — они однорасчётные, и `cutoffDrift` для них
читает тот же расчёт.

- [ ] **Step 6: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): ступень 1 порога меряется расчётом, ступень 2 — заявкой"
```

---

### Task 6: N допсоглашений и гейт закрытия

**Files:**
- Modify: `mockups/restructuring/restructuring.html:3021-3058` (`openDS`, `regDS`)
- Modify: `mockups/restructuring/restructuring.html:1116-1125` (`formalGatesOk`, `stageOf`)
- Modify: `mockups/restructuring/restructuring.html:1237` (`dsGate`)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарии `#64`, `#65`)

**Interfaces:**
- Consumes: `requireCalc`, `calcTrancheOf`, `run(app, date, calcId)`, `driftGate(app, date)`.
- Produces: `app.agreements: ds[]` (`ds = {no, date, creditId, appId, calcIds[], transferSum,
  params, fact}`), `regDS(appId, calcId)`, `excludeCalc(appId, calcId, reason)`,
  `dsCoverage(app) → {done, pending:[calcId], excluded:[calcId], ok}`. `app.ds` — дверь к первому
  соглашению, сохраняется для однорасчётных заявок и стадии.

- [ ] **Step 1: Написать падающие сценарии `#64` и `#65`**

Базой берётся `RS-1005` — единственная демо-заявка, про которую сторож `#10` уже утверждает, что
её формальные гейты зелёные («Закрыта»). Синтетическая заявка их не прошла бы, и сценарий падал
бы на пакете документов вместо своей темы.

```js
/* 64. Допсоглашения регистрируются ПО ОЧЕРЕДИ, каждое своими гейтами и своей датой: регистрация
   по второму траншу не трогает уже вступившее соглашение по первому (спека §4, РС-2). */
(() => { fresh();
  const a = app('RS-1005');
  const seededNo = a.calcs[0].dsRef;                        // ДС из демо-цепочки
  const { t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);
  const c2 = a.calcs.find(x => x.trancheId === t.id);
  const res = RS.regDS(a.id, c2.id, { no:'ДС-Т64/2', date: RS.TODAY });
  const second = !!res && res.ok === true && c2.dsRef === 'ДС-Т64/2';
  const firstIntact = a.calcs[0].dsRef === seededNo && seededNo && seededNo !== 'ДС-Т64/2';
  const twoAgreements = (a.agreements||[]).length === 2
    && new Set(a.agreements.map(d => d.creditId)).size === 2;
  const cov = RS.dsCoverage(a);
  ok(64, second && firstIntact && twoAgreements && cov.ok === true && cov.pending.length === 0,
    `второе=${second} первоеЦело=${firstIntact} соглашений=${(a.agreements||[]).length} покрытие=${JSON.stringify(cov)}`);
})();

/* 65. Гейт «оформление → закрыта»: каждый расчёт либо зарегистрирован, либо ЯВНО снят с
   оформления с основанием. Молчания как варианта нет — тот же приём, что у гейта согласий ИР-8.
   Добавленный в охват транш снимает закрытие: заявка снова в оформлении, пока ответ не дан. */
(() => { fresh();
  const a = app('RS-1005');
  const closedBefore = RS.stageOf(a).closed === true;
  const { t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);
  const c2 = a.calcs.find(x => x.trancheId === t.id);
  const reopened = RS.stageOf(a).closed === false;                  // второй расчёт молчит
  const refused = RS.excludeCalc(a.id, c2.id, '') === false;        // без основания снять нельзя
  RS.excludeCalc(a.id, c2.id, 'Заёмщик отозвал обращение по этому кредиту');
  const closedNow = RS.stageOf(a).closed === true && RS.stageOf(a).label === 'Закрыта';
  ok(65, closedBefore && reopened && refused && closedNow,
    `былаЗакрыта=${closedBefore} приМолчании=${reopened} безОснованияОтказ=${refused} послеСнятия=${closedNow}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #64`, `FAIL #65` — `regDS` берёт номер из `document`, третьего аргумента не
знает и возвращает `undefined`; `RS.excludeCalc` / `RS.dsCoverage` не существуют.

- [ ] **Step 3: Расщепить `regDS` на чистое ядро и модальную оболочку**

```js
/* Одно ДС на кредит; регистрируется своими гейтами и своей датой вступления. Оболочка (модалка)
   отдаёт номер и дату, а решение принимает ядро — иначе сторожу пришлось бы поднимать DOM. */
function regDS(appId, calcId, fields){
  const app=appById(appId);
  const calc=requireCalc(app, calcId);
  if(!calc){ toast('У заявки несколько расчётов — укажите, по какому траншу','err'); return {ok:false, reasons:['Не указан расчёт']}; }
  const src = fields || { no:(document.getElementById('dsno').value||'').trim(),
                          date:(document.getElementById('dsdate').value||'').trim() };
  const no=(src.no||'').trim(), date=(src.date||'').trim();
  if(!no||!date){ toast('Номер и дата обязательны (Р-8)','err'); return {ok:false, reasons:['Номер и дата обязательны']}; }
  if(calc.dsRef){ toast('По этому траншу ДС уже зарегистрировано','err'); return {ok:false, reasons:['ДС уже зарегистрировано']}; }
  const tranche=calcTrancheOf(calc), credit=creditById(calc.creditId);
  if(!tranche||!credit){ toast('Транш-источник расчёта не найден','err'); return {ok:false, reasons:['Транш не найден']}; }
  const dg=driftGate(app, date);
  if(!dg.ok){ toast('Ступень 2 порога расхождения — требуется новая позиция комитета (РС-26)','err');
              return {ok:false, reasons:['Ступень 2 порога расхождения']}; }
  const r=run(app, date, calc.id);
  const ds={ no, date, app, sourceTranche:tranche, credit, transferSum:r.transferSum,
             principalPart:r.principalPart, parts:r.parts, params:{...(calc.version?calc.version.params:{})} };
  const res=CreditSide.restructureApplied(ds);
  if(!res.ok){ toast(res.reasons.join('; '),'err'); return res; }
  if(!app.agreements) app.agreements=[];
  app.agreements.push({ no, date, creditId:credit.id, appId:app.id, calcIds:[calc.id],
                        transferSum:ds.transferSum, sourceTrancheId:tranche.id, params:ds.params });
  calc.dsRef=no;
  fixFact(app, date, calc.id, ds.transferSum);
  if(!app.ds) app.ds={ no, date, transferSum:ds.transferSum, sourceTrancheId:tranche.id, params:ds.params, fact:calc.fact };
  const cov=dsCoverage(app);
  if(cov.ok && !app.outcome && app.resolution) app.outcome = app.resolution.decision==='изм'?'изм':'одобрена';
  app._t=date;
  H(app,'Доп. соглашение '+no+' зарегистрировано по кредиту '+credit.no+'. Перенесено '+fmt(ds.transferSum)+' на транш '+res.tranche.no+'. Счётчик реструктуризаций +1.',state.role);
  if(credit.collProc){ app.automation.push({when:date,kind:'unpause',text:'Оформление завершено — пауза снята штатно, взыскание закрыто по кредиту '+credit.no}); }
  if(typeof document!=='undefined') closeModal();
  toast('Доп. соглашение зарегистрировано','ok'); render();
  return res;
}
/* Снятие расчёта с оформления — второй из двух допустимых ответов (первый — регистрация ДС).
   Основание обязательно: «закрыто, потому что промолчали» неотличимо от забытого кредита. */
function excludeCalc(appId, calcId, reason){
  if(!guard('regDS')) return false;
  const app=appById(appId), calc=calcById(app, calcId);
  if(!calc){ toast('Расчёт не найден','err'); return false; }
  if(calc.dsRef){ toast('По этому траншу ДС уже зарегистрировано — снять нельзя','err'); return false; }
  if(!reason || !String(reason).trim()){ toast('Снятие расчёта с оформления требует основания','err'); return false; }
  calc.excluded={ reason:String(reason).trim(), date:TODAY, by:state.role };
  app._t=TODAY;
  H(app,'Расчёт по траншу '+((calcTrancheOf(calc)||{}).no||calcId)+' снят с оформления: '+calc.excluded.reason,state.role,'warn');
  render(); return true;
}
/* Покрытие оформления: ответ дан по каждому расчёту либо не дан. Молчание — не «нет». */
function dsCoverage(app){
  const list=app.calcs||[];
  const done=list.filter(c=>c.dsRef).map(c=>c.id);
  const excluded=list.filter(c=>!c.dsRef && c.excluded).map(c=>c.id);
  const pending=list.filter(c=>!c.dsRef && !c.excluded).map(c=>c.id);
  return { done, excluded, pending, ok: list.length>0 && pending.length===0 && done.length>0 };
}
```

`openDS(appId, calcId)` доносит `calcId` до кнопки модалки:
`onclick="RS.regDS('${appId}','${calcId||''}')"`; все нынешние предварительные проверки гейтов
в `openDS` остаются, `driftGate` среди них уже стоит.

- [ ] **Step 4: Перевести демо-сиды на реестр соглашений**

Обе демо-цепочки регистрируют ДС мимо `regDS` — прямым вызовом `CreditSide.restructureApplied`
(`:1946-1954` и `:2170-2182`). Пока они пишут только `app.ds`, `dsCoverage` считает их расчёт
неотвеченным и `RS-1005` перестанет быть «Закрытой» — сторож `#10` покраснеет. Обе ветви
дописывают реестр там же, где пишут `app.ds`:

```js
    const calc = requireCalc(app);
    calc.dsRef = ds.no;
    (app.agreements = app.agreements || []).push({ no:ds.no, date:ds.date, creditId:cr.id,
      appId:app.id, calcIds:[calc.id], transferSum:ds.transferSum, sourceTrancheId:T.id, params:ds.params });
```

(в волне 1 номер лежит в `no`, а не в `ds.no` — подставить тамошнее имя.)

- [ ] **Step 5: Провести стадию через покрытие**

В `RS` дописать `dsCoverage, excludeCalc, openAddTranche` (`dsGate`, `regDS`, `stageOf` там уже
есть). В `RS` из задачи 4 — `resultTrancheOf`.

```js
function dsGate(app){ const c=dsCoverage(app); return { ok:c.ok, pending:c.pending }; }
function stageOf(app){
  if(app.outcome==='возврат') return {idx:0, closed:true, label:'Возвращена без рассмотрения'};
  const cov=dsCoverage(app);
  if(cov.done.length){
    // Терминал требует ответа по КАЖДОМУ расчёту: зарегистрирован либо явно снят (спека §4).
    return (formalGatesOk(app) && cov.ok)
      ? {idx:8, closed:true, label:'Закрыта'}
      : {idx:7, closed:false, label:'Оформление'};
  }
  // ветви ниже (возврат, пакет, заключения, комитет, письмо, ПКМ) остаются дословно как в :1119-1135
}
```

- [ ] **Step 6: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 65/65 PASS`. Сценарий `#10` (стадии `RS-1005` = «Закрыта», `RS-1001` =
«Оформление») — прямая проверка того, что однорасчётная стадия не поехала.

`validateDS(ds)` (`:996`) в этой задаче **не правится, и это осознанно**: ИР-2 она меряет от
`ds.transferSum` и графика из `ds.sourceTranche`, ИР-15 — от `ds.parts`, пределы — от `ds.params`
и `ds.credit`. Всё это `regDS` теперь собирает из расчёта, поэтому обе проверки стали
«по расчёту» сами, без единой правки внутри. Спека §6 требует именно этого — переформулировки
инвариантов, а не переписывания проверки.

- [ ] **Step 7: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): N допсоглашений по очереди, закрытие требует ответа по каждому расчёту"
```

---

### Task 7: Экран — шапка-итог и секции по траншам

**Files:**
- Modify: `mockups/restructuring/restructuring.html:2509-2638` (`pCalcBase`)
- Modify: `mockups/restructuring/restructuring.html:2639-2723` (`pCalcSched`)
- Modify: `mockups/restructuring/restructuring.html:2465-2508` (`dispDoorRow` — адрес строки)
- Modify: `mockups/restructuring/restructuring.html:2361-2381` (`pScope` — охват траншами)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарий `#66`)

**Interfaces:**
- Consumes: `scopeTranches`, `dsCoverage`, `appDrift`, `run(app, date, calcId)`,
  `resultTrancheOf`.
- Produces: `calcSectionHead(app, calc) → html`, `pCalcBase(app)` рендерит шапку-итог плюс
  секцию на расчёт.

- [ ] **Step 1: Написать падающий сценарий `#66`**

Сценарий проверяет разметку по исходному тексту файла — тем же приёмом, что уже применён в
сторожах устройства (см. шапку смоука: «там, где сценарий проверяет его устройство, а не
результат на демо-данных, проверка идёт по исходному тексту файла»). `src` уже прочитан в
начале скрипта.

```js
/* 66. Экран расчёта: суммы складываются через кредиты РОВНО в одном месте — шапке-итоге, и оно
   подписано как итог, а не как база. Секция адресует транш и кредит; при одном расчёте заголовок
   секции не рисуется вовсе — экран однокредитной заявки не меняется. Четыре сеттера строки
   получают calcId, иначе клик в секции второго транша уехал бы в первый. */
(() => {
  const head   = /function calcSectionHead/.test(src);
  const total  = /Итог по заявке/.test(src);
  const single = /length<2\) return '';/.test(src);                 // один расчёт — заголовка нет
  const wired  = /const AC=/.test(src) && /RS\.setDispAmount\(\$\{AC\}/.test(src)
                                       && /RS\.toggleBaseRow\(\$\{AC\}/.test(src);
  const gone   = !/function pickTrancheBlock/.test(src) && !/creditIds\[0\]/.test(src);
  ok(66, head && total && single && wired && gone,
    `секция=${head} итог=${total} одинБезЗаголовка=${single} адресВДвери=${wired} староеСнесено=${gone}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #66` — `calcSectionHead` нет, `creditIds[0]` ещё встречается, `pickTrancheBlock`
на месте.

- [ ] **Step 3: Заголовок секции**

```js
/* Заголовок секции — адрес суммы: транш, кредит, база и судьба оформления. При одном расчёте не
   рисуется: подписывать единственную секцию значит объяснять куратору то, чего он не спрашивал. */
function calcSectionHead(app, calc){
  if((app.calcs||[]).length<2) return '';
  const t=calcTrancheOf(calc), cr=creditById(calc.creditId);
  const r=run(app, app.ds?app.ds.date:TODAY, calc.id);
  const fate = calc.dsRef ? `<span class="pill ok">${esc(calc.dsRef)}</span>`
             : calc.excluded ? `<span class="pill mid" title="${esc(calc.excluded.reason)}">снят с оформления</span>`
             : `<span class="pill neutral">не оформлено</span>`;
  return `<div class="section-h calc-h">${esc(t?t.no:'—')} · ${esc(cr?cr.no:'—')}
    · база ${fmt(rowsTotal((calc.base||[]).filter(x=>x.included)))}
    · перенос ${fmt(r?r.transferSum:0)} ${fate}</div>`;
}
```

- [ ] **Step 4: Шапка-итог и цикл секций в `pCalcBase`**

Нынешнее тело `pCalcBase` (со строки `const src=app.calcTranche;` и до конца функции) переезжает
в `calcBaseSection(app, calc)` целиком, с заменой `app.calcTranche` → `calcTrancheOf(calc)`,
`app.base` → `calc.base`, `app.dispositions` → `calc.dispositions`, `app.version` → `calc.version`.
Вместо прежнего короткого замыкания на `pickTrancheBlock` при пустом `calcTranche` пустой охват
теперь обрабатывает обёртка:

```js
function pCalcBase(app){
  if(!(app.calcs||[]).length)
    return `<div class="op-empty">Охват пуст — добавьте транш, и расчёт заведётся автоматически.
      <button class="btn" onclick="RS.openAddTranche('${app.id}')">Добавить транш в охват</button></div>`;
  return calcTotalsBar(app)
       + app.calcs.map(calc => calcSectionHead(app, calc) + calcBaseSection(app, calc)).join('');
}
```

Шапка-итог:

```js
function calcTotalsBar(app){
  const rows=(app.calcs||[]).map(c=>({c, r:run(app, app.ds?app.ds.date:TODAY, c.id)}));
  if(rows.length<2) return '';
  const base=round2(rows.reduce((s,x)=>s+rowsTotal((x.c.base||[]).filter(b=>b.included)),0));
  const transfer=round2(rows.reduce((s,x)=>s+(x.r?x.r.transferSum:0),0));
  const d=appDrift(app, TODAY);
  // Единственное место экрана, где суммы складываются через кредиты, — и потому подписано «итог».
  return `<div class="totals-bar"><b>Итог по заявке</b> · расчётов ${rows.length}
    · база ${fmt(base)} · перенос ${fmt(transfer)}
    · расхождение ${fmt(d.delta)} (${(d.pct*100).toFixed(1)} %)${d.level>=2
      ? ' <span class="pill high">ступень 2 — возврат на комитет (РС-26)</span>' : ''}</div>`;
}
```

- [ ] **Step 5: Адресовать дверь распоряжения**

В `dispDoorRow(app, row, d, canEdit, planLen)` добавить параметр `calc` и заменить

```js
  const A=`'${app.id}','${row.article}','${row.urgency}'`;
```

на

```js
  const A=`'${app.id}','${row.article}','${row.urgency}'`;
  const AC=`${A},'${calc.id}'`;                  // адрес строки — тройка (транш, статья, срочность)
```

`setDispAmount` и `setDispPeriods` в разметке зовутся через `AC` (у `setDispPeriods` `calcId`
идёт седьмым: `RS.setDispPeriods(${A},'range',null,this.value,'${calc.id}')`), `toggleBaseRow`
и `setDisposition` в теле секции — тоже через `AC`. Имя `name="per-…"` у радиокнопок получает
`calc.id`, иначе радиогруппы двух секций склеятся.

- [ ] **Step 6: Снести старое**

Удалить `pickTrancheBlock` и заменить шесть `creditIds[0]` (`:1284` уже переписан в задаче 4,
`:1571`, `:2455` — в задачах 2 и 4; остаются `:2510`, `:2640`, `:2809`) на цикл по `app.calcs`
либо `scopeTranches(app)`. `pScope` (`:2361`) перечисляет траншы, а не кредиты, и вешает
`RS.removeTrancheFromScope` на строку.

- [ ] **Step 7: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 66/66 PASS`.

- [ ] **Step 8: Открыть макет и посмотреть глазами**

Открыть `mockups/restructuring/restructuring.html` в браузере, зайти в `RS-1001` → вкладка
«Расчёт». Ожидается: экран **как раньше** — без шапки-итога и без заголовка секции, потому что
расчёт один.

- [ ] **Step 9: Коммит**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): вкладка расчёта — шапка-итог и секции по траншам"
```

---

### Task 8: Демо RS-1020, спека, ADR, реестр

**Files:**
- Modify: `mockups/restructuring/restructuring.html:2027-2029` (сид `RS-1020`), `:2092-2190` (`buildWave2App`)
- Modify: `mockups/restructuring/ASUBK-restrukturizatsiya-logika.md` (РС-2, РС-26, РС-42, ИР-2, ИР-15, ИР-16, §14)
- Create: `docs/adr/0111-raschet-zhivet-na-transhe.md`
- Modify: `TODO.md` (строка реестра)
- Test: `scripts/inspect/restructuring-check.mjs` (сценарий `#67`)

**Interfaces:**
- Consumes: всё предыдущее.
- Produces: демо-заявка `RS-1020` с двумя расчётами разных баз.

- [ ] **Step 1: Написать падающий сценарий `#67`**

```js
/* 67. RS-1020 — единственная многокредитная заявка сида, и до сих пор расчёта не имела вовсе.
   Два расчёта, базы РАЗНЫЕ (различие видно глазом, а не выводится из кода), Σ шапки равна их
   сумме, а ключ строки — тройка: одинаковая статья в двух расчётах живёт двумя строками. */
(() => { fresh();
  const a = app('RS-1020');
  const two = a.calcs.length === 2;
  const creditsDiffer = two && a.calcs[0].creditId !== a.calcs[1].creditId;
  const r = a.calcs.map(c => RS.AppSide.run(a, RS.TODAY, c.id));
  const basesDiffer = two && RS.round2(r[0].transferSum) !== RS.round2(r[1].transferSum);
  const sum = RS.round2(r[0].transferSum + r[1].transferSum);
  const whole = RS.round2(a.calcs.reduce((s, c) => s + RS.AppSide.run(a, RS.TODAY, c.id).transferSum, 0));
  const addsUp = sum === whole;
  const sameArticleTwice = a.calcs[0].base.some(x => x.article === 'principal')
                        && a.calcs[1].base.some(x => x.article === 'principal')
                        && a.calcs[0].base !== a.calcs[1].base;
  ok(67, two && creditsDiffer && basesDiffer && addsUp && sameArticleTwice,
    `расчётов=${a.calcs.length} кредитыРазные=${creditsDiffer} базыРазные=${r.map(x=>x.transferSum).join('/')} итогСходится=${addsUp} статьяДважды=${sameArticleTwice}`);
})();
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `FAIL #67` — `RS-1020` собирается `buildWave2App` с одним `calcTranche`.

- [ ] **Step 3: Засеять `RS-1020` двумя расчётами**

В `buildWave2App` (`:2106`) строка `app.calcTranche=cr.tranches[0];` заменяется на охват по
всем кредитам сценария:

```js
  // Охват называет траншы: у сценария с несколькими кредитами расчёт заводится на каждый
  // первый открытый транш, а не только на кредит[0] — иначе второй кредит в расчёт не входит.
  (s.credits||[]).forEach(cid=>{ const c=creditById(cid); const t=(c.tranches||[]).find(x=>!x.closed);
    if(t){ const calc=attachCalc(app, t); if(!calc.version) calc.version=draftVersion(c,{}); } });
```

Дальнейшие строки `buildWave2App`, писавшие `app.version.params` и `app.dispositions`,
переводятся на `app.calcs.forEach(calc=>…)` с теми же `s.params` / `s.disp`. Чтобы базы
`RS-1020` разошлись, второму кредиту сценария (`CR-62017`) в `demoCredits2` даётся собственная
просрочка — отличная от `CR-62021` и по сумме, и по составу статей.

- [ ] **Step 4: Прогнать — зелено целиком**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 67/67 PASS`.

- [ ] **Step 5: Записать решение в ADR**

Создать `docs/adr/0111-raschet-zhivet-na-transhe.md` по образцу `0110`: заголовок-утверждение,
статус/дата/модуль/связи (`ADR-0092` — перенос транш→транш, `ADR-0109` — строка графика несёт
статьи, `ADR-0096` — одна дверь в кредит), разделы «почему транш, а не кредит», «что на каком
уровне считается», «Отвергнуто» (ключ по кредиту · запрет многокредитной заявки · закрытие по
первому ДС), «Последствия» (ИР-16, расщепление порога, N ДС, шесть `creditIds[0]` сняты).

- [ ] **Step 6: Обновить спеку модуля**

В `mockups/restructuring/ASUBK-restrukturizatsiya-logika.md`:

- **РС-42 (новое, §6.2):** «Расчёт живёт на транше. Заявка держит список расчётов, по одному на
  транш охвата; ключ строки базы и распоряжения — тройка (транш, статья, срочность). Виды и
  дата среза остаются на заявке.»
- **РС-2:** дописать, что охват хранится траншами, а кредиты выводятся из них.
- **РС-26:** уточнить — ступень 1 меряется базой среза расчёта, ступень 2 — Σ по заявке.
- **§3, таблица гейтов:** строка `оформление → закрыта` дополняется «по каждому расчёту
  зарегистрировано ДС либо снятие с основанием».
- **§10:** ИР-2 и ИР-15 переформулировать «по расчёту»; добавить **ИР-16**.
- **§14:** дописать приёмку сценариев `#58…#67`.

- [ ] **Step 7: Строка в реестре**

В `TODO.md`, раздел реструктуризации, добавить строку с ID следующего свободного `P*-R*`,
названием «Многокредитная заявка: расчёт живёт на транше», приоритетом 🔴 Высокий и ссылкой на
спеку и ADR-0111. Хук `scripts/todo_hook.py` синхронизирует Sheet сам — руками Sheet не трогать.

- [ ] **Step 8: Финальный прогон и коммит**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `SMOKE … · 67/67 PASS`, код возврата 0.

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs \
        mockups/restructuring/ASUBK-restrukturizatsiya-logika.md \
        docs/adr/0111-raschet-zhivet-na-transhe.md TODO.md
git commit -m "feat(restructuring): демо RS-1020 на двух расчётах; спека, ADR-0111 и реестр"
```

---

## Порядок и зависимости

```
1 каркас ─→ 2 ядро ─→ 3 охват ─→ 4 гейты ─→ 5 порог ─→ 6 ДС ─→ 7 экран ─→ 8 демо и доки
```

Задачи строго последовательны: каждая опирается на интерфейсы предыдущей. Точка отката —
любой коммит: прогон зелёный после каждого.
