# Оргструктура v2 — главная страница «Обзор». Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в модуль оргструктуры главную страницу «Обзор» — дашборд на дату среза (6 KPI-плиток + рабочие списки «Требует внимания» + мини-дерево + лента изменений), не трогая три существующих вида.

**Architecture:** `mockups/org-structure/org-structure-v2.html` — копия v1 (`org-structure.html`), в которую добавляется четвёртый вид `state.view='overview'` (первый пункт nav, вид по умолчанию). Модель данных и функции резолва v1 (`nameAt / parentAt / existsAt / liquidatedAt / childrenAt / headPosOf / actingOn / mainOn / occupantsOf / head / chainUp / checkMainInvariant`) переиспользуются как есть; поверх них пишется слой **чистых производных функций** (`metricsAt / problemsAt / staffRollupAt / changesSince`), из которых рендерится дашборд. Новых сущностей нет. Стили секций/метрик/ленты копируются из `mockups/vedomstvo/vedomstvo.html`.

**Tech Stack:** Один self-contained HTML (инлайн `<style>` + инлайн `<script>`, ноль зависимостей, ноль сборки). Проверка — Playwright (`playwright-core` + system Chrome) через `file://`, как остальные скрипты в `scripts/inspect/`.

## Global Constraints

- **Один файл.** Всё внутри `mockups/org-structure/org-structure-v2.html`. Никаких внешних CSS/JS/шрифтов/картинок.
- **Файл v1 не трогаем.** `org-structure.html` остаётся как есть — v2 это отдельный файл.
- **Язык интерфейса — русский.** Все подписи, заголовки, тексты пустых состояний.
- **Дизайн-система — токены `--asubk-*`** из v1 (они уже в `:root`). Новые классы копируются из `mockups/vedomstvo/vedomstvo.html` (`.section / .section-h / .section-b / .section-tools / .metrics / .metric / .otree / .audit / .toast`). Свои цвета не изобретать.
- **Всё считается на дату среза** `state.date`. Ни одна функция дашборда не читает системную дату; «сегодня» = константа `TODAY = '2026-07-11'` из v1.
- **Роль.** `canEdit()` (роль `hr`) — единственный гейт действий. У Наблюдателя все кнопки действий `disabled`.
- **Escape.** Любой текст из данных в HTML прогоняется через `esc()` из v1.
- **Дельта метрик** считается к дате «год назад» (`shiftYear(d,-1)`), подпись — «за год». В спеке было сказано «к предыдущему срезу (предыдущий чип)» — чипов всего три и дата свободно вводится в `input[type=date]`, поэтому «предыдущий чип» не определён для произвольной даты; фиксируем «год назад» и подписываем это в интерфейсе.
- **Коммиты** после каждой задачи, сообщения в стиле репозитория: `feat(mockup): оргструктура v2 — <что>`.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `mockups/org-structure/org-structure-v2.html` | **Создаётся.** Весь мокап: данные + резолв (из v1) + слой производных + рендер 4 видов. |
| `scripts/inspect/org-structure-v2-check.mjs` | **Создаётся.** Playwright-проверка: открывает `file://…/org-structure-v2.html`, гоняет даты и роли, ассертит DOM. Растёт от задачи к задаче. |
| `mockups/org-structure/org-structure.html` | **Не меняется.** Источник копирования. |
| `mockups/vedomstvo/vedomstvo.html` | **Не меняется.** Источник CSS для `.section/.metrics/.otree/.audit/.toast`. |

---

### Task 1: Каркас v2 — четвёртый вид «Обзор» и проверочный скрипт

**Files:**
- Create: `mockups/org-structure/org-structure-v2.html` (копия v1 + правки)
- Create: `scripts/inspect/org-structure-v2-check.mjs`

**Interfaces:**
- Consumes: всё из v1 (`state`, `render()`, `NAV`, `navClick()`, `canEdit()`, `esc()`).
- Produces: `state.view === 'overview'` (значение по умолчанию), контейнер `#view-overview` с `#ovBody`, функция `renderOverviewDash()` (пока заглушка), CSS-классы `.section/.section-h/.section-b/.section-tools/.metrics/.metric/.otree/.audit/.toast`.

- [ ] **Step 1: Скопировать v1 в v2**

```bash
cd /home/azamat/projects/asubk-credit-module
cp mockups/org-structure/org-structure.html mockups/org-structure/org-structure-v2.html
```

- [ ] **Step 2: Написать падающую проверку**

Создать `scripts/inspect/org-structure-v2-check.mjs`:

```js
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/org-structure/org-structure-v2.html')).href;
const fails = [];
const ok = (name) => console.log('PASS  ' + name);
const check = (name, cond) => cond ? ok(name) : (fails.push(name), console.log('FAIL  ' + name));

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(FILE, { waitUntil: 'load' });

// вид по умолчанию — «Обзор»
check('view-overview виден по умолчанию', await page.locator('#view-overview').isVisible());
check('crumb-title = «Оргструктура · Обзор»',
  (await page.locator('.crumb-title').innerText()).includes('Обзор'));
check('в nav есть пункт «Обзор»',
  await page.locator('.nav-item', { hasText: 'Обзор' }).count() === 1);
check('дерево подразделений НЕ показано на Обзоре',
  !(await page.locator('#view-units').isVisible()));

await ctx.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
```

- [ ] **Step 3: Запустить — проверка должна упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL на всех четырёх строках (`#view-overview` не существует, crumb = «Подразделения»).

- [ ] **Step 4: Добавить CSS-блок из vedomstvo.html**

Вставить в конец `<style>` файла v2 (перед `</style>`), скопировав значения из `mockups/vedomstvo/vedomstvo.html`:

```css
/* ---- дашборд «Обзор» (классы из mockups/vedomstvo/vedomstvo.html) ---- */
.ovwrap{ padding:18px 20px 40px; max-width:1180px; }
.section{ border:1px solid var(--border-default); border-radius:var(--radius-md); margin-bottom:18px;
  background:var(--surface-card); }
.sec-h{ display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:12px 16px; border-bottom:1px solid var(--border-default); }
.sec-h .sh-t{ font:var(--weight-semibold) 15px/1.2 var(--asubk-font); color:var(--text-heading); }
.sec-h .sh-act{ display:flex; align-items:center; gap:8px; }
.sec-b{ padding:16px; }
.sec-b.tscroll{ overflow-x:auto; }
.section-tools{ display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  padding:12px 20px; border-bottom:1px solid var(--border-default); }
.metrics{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
@media(max-width:1000px){ .metrics{ grid-template-columns:repeat(2,1fr); } }
.metric{ background:var(--surface-panel); border-radius:var(--radius-md); padding:14px 16px;
  border:1px solid transparent; cursor:pointer; text-align:left; width:100%; font:inherit; }
.metric:hover{ border-color:var(--border-strong); }
.metric.err{ background:var(--status-error-bg); }
.metric.warn{ background:var(--status-warning-bg); }
.metric .ml{ font:var(--weight-regular) 12px/1.3 var(--asubk-font); color:var(--text-muted); margin-bottom:6px; }
.metric .mv{ font:var(--weight-semibold) 22px/1.15 var(--asubk-font); color:var(--text-heading);
  font-variant-numeric:tabular-nums; }
.metric .mu{ font:var(--weight-regular) 12px/1.35 var(--asubk-font); color:var(--text-placeholder); margin-top:4px; }
.metric .md{ font:var(--weight-medium) 12px/1.3 var(--asubk-font); margin-top:8px; }
.metric .md.up{ color:var(--asubk-green); } .metric .md.down{ color:var(--asubk-red); }
.metric .md.flat{ color:var(--text-muted); }
.otree{ list-style:none; margin:0; padding:0; }
.otree li{ padding:8px 12px; border-bottom:1px solid var(--asubk-grid-line); cursor:pointer; display:flex;
  align-items:center; gap:8px; }
.otree li:last-child{ border-bottom:none; }
.otree li:hover{ background:var(--surface-hover); }
.otree .on{ font:var(--weight-medium) var(--text-base)/1.3 var(--asubk-font); color:var(--text-heading); flex:1; }
.otree .oh{ font:var(--font-label); color:var(--text-muted); }
.otree li.liq .on{ color:var(--text-muted); text-decoration:line-through; }
.otree .l1{ padding-left:12px; } .otree .l2{ padding-left:34px; } .otree .l3{ padding-left:56px; }
.audit{ font:var(--font-label); }
.audit .ae{ display:grid; grid-template-columns:110px 150px 1fr; gap:12px; padding:9px 12px;
  border-bottom:1px solid var(--asubk-grid-line); }
.audit .ae:last-child{ border-bottom:none; }
.audit .ae .aw{ color:var(--text-muted); font-variant-numeric:tabular-nums; }
.audit .ae .ab{ color:var(--text-heading); font-weight:var(--weight-medium); }
.toast{ position:fixed; left:50%; bottom:28px; transform:translateX(-50%) translateY(20px);
  background:var(--asubk-ink); color:#fff; padding:10px 18px; border-radius:var(--radius-pill);
  font:var(--font-label); opacity:0; pointer-events:none; transition:opacity 160ms ease, transform 160ms ease; z-index:60; }
.toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
.empty{ font:var(--font-label); color:var(--text-muted); padding:14px 4px; }
.readonly-tag{ font:var(--font-label); color:var(--text-muted); display:inline-flex; align-items:center; gap:6px; }
```

- [ ] **Step 5: Добавить контейнер вида в разметку**

В v2 вставить ПЕРЕД `<div class="mainview" id="view-units">` (строка ~367):

```html
    <div class="mainview" id="view-overview">
      <div class="section-tools">
        <span class="hint" style="margin:0">Данные на <b id="ovAsOf"></b></span>
        <span style="margin-left:auto; display:flex; gap:8px;">
          <button class="btn btn-secondary" id="ovPrint">Печать паспорта</button>
          <button class="btn btn-primary" id="ovAdd">+ Подразделение</button>
        </span>
      </div>
      <div class="content"><div class="ovwrap" id="ovBody"></div></div>
    </div>
```

И перед `</body>` (после `</div>` модалки):

```html
<div class="toast" id="toast"></div>
```

- [ ] **Step 6: Завести вид в состоянии, nav и оркестровке**

В `state` (строка ~601) заменить `view:'units'` на `view:'overview'`.

В `NAV`, в группе `org`, добавить «Обзор» первым пунктом и снять `active` с «Подразделения»:

```js
  { id:"org", label:"Организационная структура", open:true, subs:[
    { id:"org-all", headerless:true, items:[
      { label:"Обзор", active:true },
      { label:"Подразделения" },
      { label:"Должности" },
      { label:"Сотрудники подразделения" } ]} ]},
```

В `navClick` расширить карту и крошку:

```js
function navClick(l){
  document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active', a.textContent===l));
  const map = { 'Обзор':'overview', 'Подразделения':'units', 'Должности':'titles', 'Сотрудники подразделения':'people' };
  const v = map[l];
  if(v){ state.view = v;
    document.querySelector('.crumb-title').textContent = (v==='overview') ? 'Оргструктура · Обзор' : l;
    render(); }
}
```

Стартовую крошку в разметке (строка ~347) поменять на `<span class="crumb-title">Оргструктура · Обзор</span>`.

В `render()` (строка ~1008) добавить вид overview первым:

```js
function render(){
  const ab = document.getElementById('addUnitBtn'); if(ab) ab.disabled = !canEdit();
  document.getElementById('ovAdd').disabled = !canEdit();
  document.getElementById('view-overview').style.display = state.view==='overview' ? 'flex' : 'none';
  document.getElementById('view-units').style.display  = state.view==='units'  ? 'flex' : 'none';
  document.getElementById('view-titles').style.display = state.view==='titles' ? 'flex' : 'none';
  document.getElementById('view-people').style.display = state.view==='people' ? 'flex' : 'none';
  if(state.view==='overview'){ renderOverviewDash(); return; }
  if(state.view==='titles'){ renderTitles(); return; }
  if(state.view==='people'){ renderPeople(); return; }
  renderTree();
  document.querySelectorAll('.dtab').forEach(t=>t.classList.toggle('active', t.dataset.tab===state.tab));
  document.querySelectorAll('.detail-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('p-'+state.tab).classList.add('active');
  renderOverview(); renderStaff(); renderHistory(); renderLiq();
}
```

Добавить заглушку рендера дашборда (перед `render()`):

```js
function renderOverviewDash(){
  document.getElementById('ovAsOf').textContent = state.date;
  document.getElementById('ovBody').innerHTML = '';
}
```

Привязать кнопки тулбара (рядом с остальными обработчиками внизу):

```js
document.getElementById('ovAdd').onclick = openAddUnit;
document.getElementById('ovPrint').onclick = ()=> window.print();
```

- [ ] **Step 7: Запустить проверку — должна пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: `PASS` на всех четырёх, `ALL PASS`, exit 0.

- [ ] **Step 8: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — каркас вида «Обзор» + проверочный скрипт"
```

---

### Task 2: Слой производных функций (метрики и проблемы на дату)

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html` (новый блок функций после `checkMainInvariant`)
- Modify: `scripts/inspect/org-structure-v2-check.mjs` (ассерты через `page.evaluate`)

**Interfaces:**
- Consumes: `UNITS, POSITIONS, ASSIGN, ACTING, TITLES, EMPLOYEES, existsAt, liquidatedAt, childrenAt, parentAt, nameAt, headPosOf, actingOn, mainOn, occupantsOf, checkMainInvariant, spanActive` — всё из v1.
- Produces (все чистые, все принимают дату `d` строкой ISO):
  - `shiftYear(d, n) -> string` — дата ± n лет.
  - `daysBetween(a, b) -> number` — целых дней от `a` до `b`.
  - `liveUnitsAt(d) -> Unit[]` — существующие и не ликвидированные на дату.
  - `positionsAt(d) -> Position[]` — позиции живых узлов.
  - `metricsAt(d) -> {units:{total,byType}, staff:{planned,filled,pct}, vac:{total,head}, acting:{total,expiring}, combine:number, inv:string[]}`
  - `problemsAt(d) -> {headVacant:[], actingExpiring:[], invariant:[], noStaff:[], liqBlocked:[], orphanTerr:[]}` — каждая запись содержит `unitId` (кроме `invariant`, где `empId`).
  - `staffRollupAt(d) -> [{type, planned, filled, vac}]`
  - `changesSince(d, days) -> [{date, kind, unitId, text}]` — отсортировано по убыванию даты.

- [ ] **Step 1: Написать падающие проверки**

Дописать в `org-structure-v2-check.mjs` перед `await ctx.close()`:

```js
// --- слой производных функций (считается на 2026-07-11, демо-данные v1) ---
const m = await page.evaluate(() => metricsAt('2026-07-11'));
check('metricsAt: 7 узлов создано, 1 ликвидирован → 6 живых', m.units.total === 6);
check('metricsAt: 9 штатных единиц (1+1+1+2+1+1+1+1)', m.staff.planned === 9);
check('metricsAt: вакансия руководителя — 2 (Ошский филиал, Сектор)', m.vac.head === 2);
check('metricsAt: 1 действующее и.о.', m.acting.total === 1);
check('metricsAt: и.о. истекает ≤30 дней (до 2026-07-31)', m.acting.expiring === 1);
check('metricsAt: 1 совместительство', m.combine === 1);
check('metricsAt: инвариант не нарушен', m.inv.length === 0);

const p = await page.evaluate(() => problemsAt('2026-07-11'));
check('problemsAt: вакансия руководителя у osh и sector',
  p.headVacant.map(x => x.unitId).sort().join(',') === 'osh,sector');
check('problemsAt: и.о. истекает — 1 запись', p.actingExpiring.length === 1);
check('problemsAt: ликвидация заблокирована у go (корень) и osh (потомки+назначения)',
  p.liqBlocked.map(x => x.unitId).includes('osh') && p.liqBlocked.map(x => x.unitId).includes('go'));
check('problemsAt: узлы без штатки — их нет в демо-данных', p.noStaff.length === 0);

const ch = await page.evaluate(() => changesSince('2024-07-01', 3650).map(e => e.kind));
check('changesSince: за 10 лет есть создания, переименование, переподчинение, ликвидация',
  ['create','rename','move','liquidate'].every(k => ch.includes(k)));
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL, в выводе `ReferenceError: metricsAt is not defined` (Playwright бросит на `page.evaluate`).

- [ ] **Step 3: Реализовать слой**

Вставить в v2 сразу после функции `checkMainInvariant` (строка ~596):

```js
/* =========================================================================
   ПРОИЗВОДНЫЕ ДЛЯ ДАШБОРДА «ОБЗОР». Чистые функции, всё считается НА ДАТУ.
   Новых сущностей нет — только агрегаты над UNITS/POSITIONS/ASSIGN/ACTING.
   ========================================================================= */
const EXPIRING_DAYS = 30;   // окно «и.о. скоро истекает»
const CHANGES_DAYS  = 30;   // окно ленты изменений

function shiftYear(d,n){ const [y,m,dd]=d.split('-').map(Number); return `${y+n}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
function daysBetween(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); }

function liveUnitsAt(d){ return UNITS.filter(u=>existsAt(u.id,d) && !liquidatedAt(u.id,d)); }
function positionsAt(d){ const live=new Set(liveUnitsAt(d).map(u=>u.id)); return POSITIONS.filter(p=>live.has(p.unitId)); }

function metricsAt(d){
  const live = liveUnitsAt(d);
  const byType = {};
  live.forEach(u=> byType[u.type]=(byType[u.type]||0)+1);

  const poss = positionsAt(d);
  const planned = poss.reduce((s,p)=>s+p.units,0);
  // занято: сумма долей ставок действующих назначений на позициях живых узлов (и.о. — не назначение, не считаем)
  const posIds = new Set(poss.map(p=>p.id));
  const acts = ASSIGN.filter(a=>posIds.has(a.posId) && spanActive(a,d));
  const filled = acts.reduce((s,a)=>s+a.rate,0);

  // вакансии: позиция без единого действующего назначения (и.о. вакансию не закрывает — он временный)
  const vacPos  = poss.filter(p=>!ASSIGN.some(a=>a.posId===p.id && spanActive(a,d)));
  const vacHead = vacPos.filter(p=>p.isHead);

  const ios = ACTING.filter(a=>posIds.has(a.posId) && spanActive(a,d));
  const expiring = ios.filter(a=>a.to!=null && daysBetween(d,a.to) <= EXPIRING_DAYS);

  return {
    units:  { total: live.length, byType },
    staff:  { planned, filled, pct: planned ? Math.round(filled/planned*100) : 0 },
    vac:    { total: vacPos.length, head: vacHead.length },
    acting: { total: ios.length, expiring: expiring.length },
    combine: acts.filter(a=>a.kind==='combine').length,
    inv: checkMainInvariant(d),
  };
}

function problemsAt(d){
  const live = liveUnitsAt(d);
  const posIds = new Set(positionsAt(d).map(p=>p.id));

  const headVacant = live.filter(u=>{
    const hp = headPosOf(u.id);
    return hp && !mainOn(hp.id,d) && !actingOn(hp.id,d);
  }).map(u=>{
    const hp = headPosOf(u.id);
    // «вакантно с» — конец последнего основного назначения на позицию, иначе дата создания узла
    const last = ASSIGN.filter(a=>a.posId===hp.id && a.kind==='main' && a.to!=null).sort((a,b)=>a.to<b.to?1:-1)[0];
    const since = last ? last.to : u.created;
    return { unitId:u.id, posId:hp.id, since, days: daysBetween(since,d) };
  });

  const actingExpiring = ACTING.filter(a=>posIds.has(a.posId) && spanActive(a,d) && a.to!=null
      && daysBetween(d,a.to) <= EXPIRING_DAYS)
    .map(a=>{ const p=POSITIONS.find(x=>x.id===a.posId);
      return { unitId:p.unitId, posId:a.posId, empId:a.empId, to:a.to, days:daysBetween(d,a.to), reason:a.reason }; });

  const invariant = checkMainInvariant(d).map(empId=>({
    empId,
    posIds: ASSIGN.filter(a=>a.empId===empId && a.kind==='main' && spanActive(a,d)).map(a=>a.posId),
  }));

  const noStaff = live.filter(u=>!POSITIONS.some(p=>p.unitId===u.id)).map(u=>({ unitId:u.id }));

  const liqBlocked = live.map(u=>{
    const reasons = [];
    if(parentAt(u.id,d)==null) reasons.push('корень дерева');
    const kids = childrenAt(u.id,d).filter(k=>!liquidatedAt(k.id,d));
    if(kids.length) reasons.push('действующие потомки: '+kids.map(k=>nameAt(k.id,d)).join(', '));
    const occ = POSITIONS.filter(p=>p.unitId===u.id).flatMap(p=>occupantsOf(p.id,d));
    if(occ.length) reasons.push('действующие назначения/и.о.: '+occ.length);
    return reasons.length ? { unitId:u.id, reasons } : null;
  }).filter(Boolean);

  // территория ликвидированного узла, которую на дату не обслуживает ни один живой узел
  const covered = new Set(live.flatMap(u=>u.territory));
  const orphanTerr = UNITS.filter(u=>liquidatedAt(u.id,d))
    .flatMap(u=>u.territory.filter(t=>!covered.has(t)).map(t=>({ terr:t, unitId:u.id, since:u.liquidated })));

  return { headVacant, actingExpiring, invariant, noStaff, liqBlocked, orphanTerr };
}

function staffRollupAt(d){
  const live = liveUnitsAt(d);
  const rows = {};
  live.forEach(u=>{
    const r = rows[u.type] || (rows[u.type]={ type:u.type, planned:0, filled:0, vac:0 });
    POSITIONS.filter(p=>p.unitId===u.id).forEach(p=>{
      r.planned += p.units;
      const acts = ASSIGN.filter(a=>a.posId===p.id && spanActive(a,d));
      r.filled  += acts.reduce((s,a)=>s+a.rate,0);
      if(!acts.length) r.vac += 1;
    });
  });
  return Object.values(rows).sort((a,b)=>b.planned-a.planned);
}

// Лента изменений: события восстанавливаются из версий (отдельного журнала в модели нет).
function changesSince(d, days){
  const from = new Date(Date.parse(d) - days*86400000).toISOString().slice(0,10);
  const inWin = x => x>=from && x<=d;
  const out = [];
  UNITS.forEach(u=>{
    if(inWin(u.created)) out.push({ date:u.created, kind:'create', unitId:u.id, text:'Создан узел' });
    if(u.liquidated && inWin(u.liquidated)) out.push({ date:u.liquidated, kind:'liquidate', unitId:u.id,
      text:'Ликвидация'+(u.successor?' · правопреемник '+nameAt(u.successor,d):'') });
  });
  NAME_VER.forEach(v=>{
    if(v.from!==unit(v.unitId).created && inWin(v.from))
      out.push({ date:v.from, kind:'rename', unitId:v.unitId, text:'Переименование → '+v.name });
  });
  PARENT_VER.forEach(v=>{
    if(v.from!==unit(v.unitId).created && inWin(v.from))
      out.push({ date:v.from, kind:'move', unitId:v.unitId, text:'Переподчинение → '+nameAt(v.parentId,d) });
  });
  ASSIGN.forEach(a=>{
    if(!inWin(a.from)) return;
    const p = POSITIONS.find(x=>x.id===a.posId); if(!p) return;
    out.push({ date:a.from, kind:'assign', unitId:p.unitId,
      text:'Назначение · '+fmtEmp(a.empId)+' → '+TITLES[p.titleId].name+(a.kind==='combine'?' (совмест.)':'') });
  });
  return out.sort((a,b)=>a.date<b.date?1:-1);
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: все `PASS`, `ALL PASS`, exit 0.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — слой производных (метрики, проблемы, лента) на дату"
```

---

### Task 3: Метрики — 6 плиток, баннеры, пустой срез

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html` (`renderOverviewDash`)
- Modify: `scripts/inspect/org-structure-v2-check.mjs`

**Interfaces:**
- Consumes: `metricsAt(d)`, `banner(kind,icon,html)` и `ICONS` из v1, `shiftYear`.
- Produces: DOM `.metrics` с шестью `<button class="metric" data-jump="…">`, ключи `data-jump`: `units | staff | vac | acting | combine | inv`. Функция `deltaHtml(cur, prev, invert)`.

- [ ] **Step 1: Написать падающие проверки**

Дописать в скрипт:

```js
// --- метрики на экране ---
check('на дашборде 6 плиток', await page.locator('#ovBody .metric').count() === 6);
check('плитка вакансий красная (вакантен руководитель)',
  await page.locator('#ovBody .metric[data-jump=vac]').evaluate(el => el.classList.contains('err')));
check('% укомплектованности показан',
  (await page.locator('#ovBody .metric[data-jump=staff]').innerText()).includes('%'));

// пустой срез: до создания корня (2020-01-01) структуры нет
await page.fill('#dateInp', '2019-06-01');
await page.dispatchEvent('#dateInp', 'change');
check('пустой срез: плашка «структура не существует»',
  (await page.locator('#ovBody').innerText()).includes('не существует'));
check('пустой срез: метрики нулевые',
  (await page.locator('#ovBody .metric[data-jump=units] .mv').innerText()).trim() === '0');
await page.click('.date-chip[data-d="2026-07-11"]');
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL — `.metric` не найдены (0 вместо 6).

- [ ] **Step 3: Реализовать метрики**

Заменить заглушку `renderOverviewDash` на:

```js
function deltaHtml(cur, prev, invert){
  const diff = cur - prev;
  if(!diff) return `<div class="md flat">без изменений за год</div>`;
  const good = invert ? diff < 0 : diff > 0;
  return `<div class="md ${good?'up':'down'}">${diff>0?'+':''}${diff} за год</div>`;
}

function renderOverviewDash(){
  const d = state.date;
  document.getElementById('ovAsOf').textContent = d;
  const el = document.getElementById('ovBody');

  const m  = metricsAt(d);
  const mp = metricsAt(shiftYear(d,-1));

  // пустой срез — структуры на дату ещё нет
  if(m.units.total === 0){
    el.innerHTML = banner('info', ICONS.info,
      '<b>На выбранную дату структура не существует.</b> Первый узел создан 2020-01-01 — сдвиньте дату среза вперёд. Создание узла доступно: он родится на дату среза.')
      + metricsHtml(m, mp);
    bindMetricJumps();
    return;
  }

  // баннер: вакантна руководящая позиция корня — ошибка конфигурации, не «нарушение»
  const rootId = liveUnitsAt(d).find(u=>parentAt(u.id,d)==null)?.id;
  const rootPos = rootId && headPosOf(rootId);
  const rootVacant = rootPos && !mainOn(rootPos.id,d) && !actingOn(rootPos.id,d);
  let banners = '';
  if(rootVacant) banners += banner('danger', ICONS.block,
    '<b>Ошибка конфигурации:</b> руководящая позиция корня вакантна на дату — контролёр не определяется ни для одного узла (§5/§7).');
  if(m.inv.length) banners += banner('danger', ICONS.block,
    '<b>Нарушение инварианта §4:</b> более одного основного назначения — '+m.inv.map(fmtEmp).join(', '));

  el.innerHTML = banners + metricsHtml(m, mp);
  bindMetricJumps();
}

function metricsHtml(m, mp){
  const types = Object.entries(m.units.byType).map(([t,n])=>esc(t)+' '+n).join(' · ') || '—';
  const tile = (key, cls, label, val, sub, delta) =>
    `<button class="metric ${cls}" data-jump="${key}">
       <div class="ml">${label}</div><div class="mv">${val}</div><div class="mu">${sub}</div>${delta||''}
     </button>`;
  return `<div class="metrics">
    ${tile('units','', 'Действующих узлов', m.units.total, types, deltaHtml(m.units.total, mp.units.total, false))}
    ${tile('staff','', 'Штат и факт', m.staff.pct+'%', `${m.staff.filled} из ${m.staff.planned} ед. — укомплектованность`, deltaHtml(m.staff.pct, mp.staff.pct, false))}
    ${tile('vac', m.vac.head?'err':'', 'Вакансии', m.vac.total, m.vac.head? `в т.ч. вакансий руководителя: ${m.vac.head}` : 'вакансий руководителя нет', deltaHtml(m.vac.total, mp.vac.total, true))}
    ${tile('acting', m.acting.expiring?'warn':'', 'И.о.', m.acting.total, m.acting.expiring? `истекают ≤ ${EXPIRING_DAYS} дн.: ${m.acting.expiring}` : 'истекающих нет', deltaHtml(m.acting.total, mp.acting.total, false))}
    ${tile('combine','', 'Совместительства', m.combine, 'действующих на дату', deltaHtml(m.combine, mp.combine, false))}
    ${tile('inv', m.inv.length?'err':'', 'Нарушения инварианта', m.inv.length, m.inv.length? m.inv.map(fmtEmp).join(', ') : '«одно основное назначение» соблюдён', '')}
  </div>`;
}

// клик по плитке — переход к соответствующему рабочему списку (Task 4 добавит списки)
function bindMetricJumps(){
  document.querySelectorAll('#ovBody .metric').forEach(b=>{
    b.onclick = ()=>{
      const map = { vac:'headVacant', acting:'actingExpiring', inv:'invariant', staff:'noStaff', units:'liqBlocked', combine:'invariant' };
      const t = map[b.dataset.jump];
      if(!t) return;
      state.prob = t;
      renderOverviewDash();
      document.getElementById('probs')?.scrollIntoView({ behavior:'smooth', block:'start' });
    };
  });
}
```

В `state` добавить поле `prob:'headVacant'` (активный рабочий список; используется в Task 4).

- [ ] **Step 4: Запустить — должно пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: все `PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — 6 KPI-плиток, баннеры, пустой срез"
```

---

### Task 4: Блок «Требует внимания» — 6 рабочих списков с переходами

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html`
- Modify: `scripts/inspect/org-structure-v2-check.mjs`

**Interfaces:**
- Consumes: `problemsAt(d)`, `state.prob`, `canEdit()`.
- Produces: секция `#probs` с табами `<button class="dtab" data-prob="…">` (ключи те же, что у `problemsAt`) и таблицей `.cgrid`; функция `gotoUnit(unitId, tab)` — переключает на вид «Подразделения», выбирает узел и вкладку.

- [ ] **Step 1: Написать падающие проверки**

```js
// --- рабочие списки ---
check('есть секция «Требует внимания»',
  (await page.locator('#probs .sh-t').innerText()).includes('Требует внимания'));
check('6 табов проблем', await page.locator('#probs .dtab').count() === 6);
await page.locator('#probs .dtab[data-prob=headVacant]').click();
check('таб вакансий показывает 2 строки',
  await page.locator('#probs table.cgrid tbody tr').count() === 2);
await page.locator('#probs .dtab[data-prob=noStaff]').click();
check('пустой список пишет «Нарушений нет», а не прячется',
  (await page.locator('#probs').innerText()).includes('Нарушений нет'));

// клик по строке уводит в карточку узла
await page.locator('#probs .dtab[data-prob=headVacant]').click();
await page.locator('#probs table.cgrid tbody tr').first().click();
check('переход в вид «Подразделения»', await page.locator('#view-units').isVisible());
check('открыта вкладка «Штатка»',
  await page.locator('.dtab[data-tab=staff]').evaluate(el => el.classList.contains('active')));
await page.locator('.nav-item', { hasText: 'Обзор' }).click();

// роль Наблюдателя гасит действия
await page.selectOption('#roleSel', 'obs');
check('Наблюдатель: «+ Подразделение» задизейблена', await page.locator('#ovAdd').isDisabled());
check('Наблюдатель: кнопки действий в списке задизейблены',
  await page.locator('#probs .rowact').first().isDisabled());
await page.selectOption('#roleSel', 'hr');
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL — `#probs` не существует.

- [ ] **Step 3: Реализовать блок**

Добавить функции и дописать вывод в `renderOverviewDash` (в конец `el.innerHTML`, ПОСЛЕ метрик):

```js
const PROB_TABS = [
  { key:'headVacant',     label:'Вакансия руководителя' },
  { key:'actingExpiring', label:'И.о. истекает' },
  { key:'invariant',      label:'Нарушение «одно основное»' },
  { key:'noStaff',        label:'Узлы без штатки' },
  { key:'liqBlocked',     label:'Ликвидация заблокирована' },
  { key:'orphanTerr',     label:'Осиротевшая территория' },
];

function probsHtml(d){
  const p = problemsAt(d);
  const cur = state.prob;
  const tabs = PROB_TABS.map(t=>{
    const n = p[t.key].length;
    return `<button class="dtab${t.key===cur?' active':''}" data-prob="${t.key}">${t.label}${n?` <span class="pill ${t.key==='orphanTerr'?'warn':'err'}">${n}</span>`:''}</button>`;
  }).join('');

  const rows = p[cur];
  let head = '', body = '';
  const act = (label)=> `<button class="btn btn-secondary rowact" style="height:28px; padding:0 10px; font-size:13px" ${canEdit()?'':'disabled'}>${label}</button>`;

  if(!rows.length){
    body = `<div class="empty">Нарушений нет на выбранную дату.</div>`;
  } else if(cur==='headVacant'){
    head = '<tr><th>Узел</th><th>Тип</th><th>Родитель</th><th>Вакантно с</th><th>Дней</th><th></th></tr>';
    body = rows.map(r=>{ const u=unit(r.unitId); const par=parentAt(r.unitId,d);
      return `<tr data-unit="${r.unitId}" data-tab="staff"><td><b>${esc(nameAt(r.unitId,d))}</b></td><td>${esc(u.type)}</td>
        <td>${par?esc(nameAt(par,d)):'— (корень)'}</td><td class="mono">${r.since}</td>
        <td class="mono">${r.days}</td><td>${act('Назначить')}</td></tr>`; }).join('');
  } else if(cur==='actingExpiring'){
    head = '<tr><th>Узел</th><th>Сотрудник</th><th>До</th><th>Осталось дней</th><th>Основание</th><th></th></tr>';
    body = rows.map(r=>`<tr data-unit="${r.unitId}" data-tab="staff"><td><b>${esc(nameAt(r.unitId,d))}</b></td>
      <td>${fmtEmp(r.empId)}</td><td class="mono">${r.to}</td><td class="mono">${r.days}</td>
      <td class="muted">${esc(r.reason)}</td><td>${act('Продлить')}</td></tr>`).join('');
  } else if(cur==='invariant'){
    head = '<tr><th>Сотрудник</th><th>Конфликтующие позиции</th></tr>';
    body = rows.map(r=>{ const first=POSITIONS.find(p2=>p2.id===r.posIds[0]);
      return `<tr data-unit="${first?first.unitId:''}" data-tab="staff"><td><b>${fmtEmp(r.empId)}</b></td>
        <td>${r.posIds.map(pid=>{ const p2=POSITIONS.find(x=>x.id===pid);
          return `<div>${esc(nameAt(p2.unitId,d))} · ${esc(TITLES[p2.titleId].name)}</div>`; }).join('')}</td></tr>`; }).join('');
  } else if(cur==='noStaff'){
    head = '<tr><th>Узел</th><th>Тип</th><th>Создан</th><th></th></tr>';
    body = rows.map(r=>{ const u=unit(r.unitId);
      return `<tr data-unit="${r.unitId}" data-tab="staff"><td><b>${esc(nameAt(r.unitId,d))}</b></td>
        <td>${esc(u.type)}</td><td class="mono">${u.created}</td><td>${act('Добавить позицию')}</td></tr>`; }).join('');
  } else if(cur==='liqBlocked'){
    head = '<tr><th>Узел</th><th>Сработавшие гейты</th></tr>';
    body = rows.map(r=>`<tr data-unit="${r.unitId}" data-tab="liq"><td><b>${esc(nameAt(r.unitId,d))}</b></td>
      <td>${r.reasons.map(x=>`<div class="muted">${esc(x)}</div>`).join('')}</td></tr>`).join('');
  } else if(cur==='orphanTerr'){
    head = '<tr><th>Территория</th><th>Осиротела с</th><th>Бывший узел</th></tr>';
    body = rows.map(r=>`<tr data-unit="${r.unitId}" data-tab="overview"><td><b>${esc(r.terr)}</b></td>
      <td class="mono">${r.since}</td><td class="muted">${esc(nameAt(r.unitId,d))}</td></tr>`).join('');
  }

  const table = rows.length
    ? `<table class="cgrid"><thead>${head}</thead><tbody>${body}</tbody></table>`
    : body;

  return `<div class="section" id="probs">
    <div class="sec-h"><span class="sh-t">Требует внимания</span>
      <span class="sh-act readonly-tag">${canEdit()?'':'роль «Наблюдатель» — только чтение'}</span></div>
    <div class="detail-tabbar" id="probTabs" style="padding:6px 10px 0">${tabs}</div>
    <div class="sec-b tscroll">${table}</div>
  </div>`;
}

// переход в карточку узла из любого списка
function gotoUnit(unitId, tab){
  if(!unitId) return;
  state.view='units'; state.sel=unitId; state.tab=tab||'overview';
  document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active', a.textContent==='Подразделения'));
  document.querySelector('.crumb-title').textContent = 'Подразделения';
  render();
}
```

В `renderOverviewDash` собрать вывод как `banners + metricsHtml(m,mp) + probsHtml(d)` (и в ветке пустого среза — `banner + metricsHtml(m,mp) + probsHtml(d)`), после `innerHTML` вызвать `bindMetricJumps(); bindProbs();`.

Добавить биндинг:

```js
function bindProbs(){
  document.querySelectorAll('#probTabs .dtab').forEach(t=>{
    t.onclick = ()=>{ state.prob = t.dataset.prob; renderOverviewDash(); };
  });
  document.querySelectorAll('#probs table.cgrid tbody tr').forEach(tr=>{
    tr.style.cursor = 'pointer';
    tr.onclick = (e)=>{
      if(e.target.closest('.rowact')) return;   // кнопка действия — не переход
      gotoUnit(tr.dataset.unit, tr.dataset.tab);
    };
  });
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: все `PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — блок «Требует внимания» и переходы в карточку узла"
```

---

### Task 5: Мини-дерево и «Штат и факт»

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html`
- Modify: `scripts/inspect/org-structure-v2-check.mjs`

**Interfaces:**
- Consumes: `childrenAt`, `nameAt`, `parentAt`, `liquidatedAt`, `headPosOf`, `mainOn`, `actingOn`, `head`, `staffRollupAt`, `gotoUnit`.
- Produces: секции `#miniTree` (`ul.otree`, кнопка `#treeExpand`) и `#staffRoll` (таблица `.cgrid`).

- [ ] **Step 1: Написать падающие проверки**

```js
// --- мини-дерево и штат/факт ---
check('мини-дерево: 2 уровня по умолчанию (ГО + 3 ребёнка = 4 строки)',
  await page.locator('#miniTree .otree li').count() === 4);
await page.click('#treeExpand');
check('после «раскрыть всё» строк больше',
  await page.locator('#miniTree .otree li').count() > 4);
check('вакансия руководителя помечена точкой',
  await page.locator('#miniTree .otree li .dotv').count() >= 1);
await page.locator('#miniTree .otree li').first().click();
check('клик по узлу открывает карточку', await page.locator('#view-units').isVisible());
await page.locator('.nav-item', { hasText: 'Обзор' }).click();
check('«Штат и факт»: строка на каждый тип узла',
  await page.locator('#staffRoll tbody tr').count() >= 3);
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL — `#miniTree` не существует.

- [ ] **Step 3: Реализовать**

Добавить в `state` поле `treeAll:false`. Добавить функции:

```js
function miniTreeHtml(d){
  const roots = liveUnitsAt(d).filter(u=>parentAt(u.id,d)==null).map(u=>u.id);
  const maxLvl = state.treeAll ? 99 : 1;   // 0 = корень, 1 = его дети
  const lines = [];
  (function walk(id, lvl){
    if(lvl > maxLvl) return;
    const u = unit(id);
    const liq = liquidatedAt(id,d);
    const hp = headPosOf(id);
    const vacant = hp && !mainOn(hp.id,d) && !actingOn(hp.id,d);
    const h = head(id,d);
    const who = h.error ? '<span style="color:var(--asubk-red)">руководитель не определён</span>'
      : `${fmtEmp(h.empId)} · ${h.via}${h.escalatedFrom?' (эскалация)':''}`;
    lines.push(`<li class="l${Math.min(lvl,3)}${liq?' liq':''}" data-unit="${id}">
      <span class="tico">${typeIcon(u.type)}</span>
      <span class="on">${esc(nameAt(id,d))}</span>
      ${vacant && !liq ? '<span class="dotv" title="вакансия руководителя"></span>' : ''}
      <span class="oh">${who}</span></li>`);
    childrenAt(id,d).forEach(k=>walk(k.id, lvl+1));
  });
  roots.forEach(r=>walk(r,0));
  return `<div class="section" id="miniTree">
    <div class="sec-h"><span class="sh-t">Дерево на ${d}</span>
      <span class="sh-act"><button class="btn btn-secondary" id="treeExpand" style="height:28px; padding:0 10px; font-size:13px">${state.treeAll?'Свернуть':'Раскрыть всё'}</button></span></div>
    <ul class="otree">${lines.join('')}</ul>
  </div>`;
}

function staffRollHtml(d){
  const rows = staffRollupAt(d).map(r=>`<tr>
    <td><b>${esc(r.type)}</b></td>
    <td class="mono">${r.planned}</td>
    <td class="mono">${r.filled}</td>
    <td class="mono">${r.vac ? `<span class="pill warn">${r.vac}</span>` : '—'}</td>
    <td class="mono">${r.planned ? Math.round(r.filled/r.planned*100) : 0}%</td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Штатных позиций на дату нет.</td></tr>';
  return `<div class="section" id="staffRoll">
    <div class="sec-h"><span class="sh-t">Штат и факт по типам узлов</span></div>
    <div class="sec-b tscroll"><table class="cgrid">
      <thead><tr><th>Тип узла</th><th>Штат, ед.</th><th>Занято</th><th>Вакансий</th><th>Укомпл.</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
}
```

В `renderOverviewDash` вывод становится `banners + metricsHtml(m,mp) + probsHtml(d) + miniTreeHtml(d) + staffRollHtml(d)`; после `innerHTML` добавить `bindTree();`:

```js
function bindTree(){
  const b = document.getElementById('treeExpand');
  if(b) b.onclick = ()=>{ state.treeAll = !state.treeAll; renderOverviewDash(); };
  document.querySelectorAll('#miniTree .otree li').forEach(li=>{
    li.onclick = ()=> gotoUnit(li.dataset.unit, 'overview');
  });
}
```

В CSS добавить точку вакансии для мини-дерева (в блок дашборда):

```css
.otree .dotv{ width:7px; height:7px; border-radius:50%; background:var(--asubk-red); flex:none; }
.otree .tico{ flex:none; display:inline-flex; color:var(--text-muted); }
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: все `PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — мини-дерево на дату и сводка «штат и факт»"
```

---

### Task 6: Лента изменений за 30 дней

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html`
- Modify: `scripts/inspect/org-structure-v2-check.mjs`

**Interfaces:**
- Consumes: `changesSince(d, days)`, `CHANGES_DAYS`, `nameAt`, `gotoUnit`.
- Produces: секция `#changes` (`.audit`, строки `.ae`), переключатель окна `#chgWin` (30 / 365 дней).

- [ ] **Step 1: Написать падающие проверки**

```js
// --- лента изменений ---
check('лента: за 30 дней от 2026-07-11 событий нет → пустое состояние',
  (await page.locator('#changes').innerText()).includes('Изменений за'));
await page.selectOption('#chgWin', '365');
check('лента: за 365 дней события появились',
  await page.locator('#changes .ae').count() > 0);
await page.selectOption('#chgWin', '30');
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL — `#changes` не существует.

- [ ] **Step 3: Реализовать**

В `state` добавить `chgWin: CHANGES_DAYS`. Добавить функцию:

```js
const CHG_LABEL = { create:'Создание', rename:'Переименование', move:'Переподчинение',
                    liquidate:'Ликвидация', assign:'Назначение' };

function changesHtml(d){
  const win = state.chgWin;
  const evs = changesSince(d, win);
  const body = evs.length
    ? `<div class="audit">${evs.map(e=>`<div class="ae" data-unit="${e.unitId}" style="cursor:pointer">
         <span class="aw">${e.date}</span>
         <span class="ab">${CHG_LABEL[e.kind]||e.kind}</span>
         <span>${esc(nameAt(e.unitId,d))} — ${esc(e.text)}</span></div>`).join('')}</div>`
    : `<div class="empty">Изменений за ${win} дн. до ${d} нет.</div>`;
  return `<div class="section" id="changes">
    <div class="sec-h"><span class="sh-t">Последние изменения</span>
      <span class="sh-act"><select id="chgWin" style="height:28px; border-radius:var(--radius-md); border:1px solid var(--border-strong); background:var(--surface-card); font:var(--font-label); padding:0 8px;">
        <option value="30"${win===30?' selected':''}>30 дней</option>
        <option value="365"${win===365?' selected':''}>365 дней</option>
      </select></span></div>
    <div class="sec-b tscroll">${body}</div></div>`;
}
```

Дописать `+ changesHtml(d)` в вывод `renderOverviewDash` и биндинг:

```js
function bindChanges(){
  const s = document.getElementById('chgWin');
  if(s) s.onchange = ()=>{ state.chgWin = Number(s.value); renderOverviewDash(); };
  document.querySelectorAll('#changes .ae').forEach(r=>{
    r.onclick = ()=> gotoUnit(r.dataset.unit, 'history');
  });
}
```

Вызвать `bindChanges();` рядом с остальными биндингами в `renderOverviewDash`.

- [ ] **Step 4: Запустить — должно пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: все `PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — лента изменений (30/365 дней)"
```

---

### Task 7: Создание узла с дашборда, тост, печать паспорта

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html`
- Modify: `scripts/inspect/org-structure-v2-check.mjs`

**Interfaces:**
- Consumes: `openAddUnit / submitAddUnit` из v1, `state.view`.
- Produces: `toast(msg)`; `submitAddUnit` больше не уводит на вид «Подразделения», если создание запущено с «Обзора»; `@media print` показывает только `#ovBody`.

- [ ] **Step 1: Написать падающие проверки**

```js
// --- создание узла с дашборда ---
const unitsBefore = Number(await page.locator('#ovBody .metric[data-jump=units] .mv').innerText());
await page.click('#ovAdd');
await page.fill('#auName', 'Отдел взыскания Ошского филиала');
await page.selectOption('#auParent', 'osh');
await page.click('#auSubmit');
check('остались на «Обзоре» после создания', await page.locator('#view-overview').isVisible());
check('счётчик узлов вырос',
  Number(await page.locator('#ovBody .metric[data-jump=units] .mv').innerText()) === unitsBefore + 1);
check('показан тост', await page.locator('#toast.show').isVisible());
await page.locator('#probs .dtab[data-prob=noStaff]').click();
check('новый узел попал в «Узлы без штатки»',
  (await page.locator('#probs').innerText()).includes('Отдел взыскания'));
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: FAIL — после `#auSubmit` активен вид «Подразделения» (v1 делает `state.sel=id; state.tab='overview'` и `render()`), `#view-overview` скрыт.

- [ ] **Step 3: Реализовать**

Добавить тост:

```js
let toastT = null;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2600);
}
```

Поправить хвост `submitAddUnit` — вид не менять, если создавали с «Обзора»:

```js
  NAME_VER.push({ unitId:id, name, from:d, to:null });
  state.sel = id;
  if(state.view !== 'overview'){ state.tab = 'overview'; }
  closeAddUnit();
  render();
  toast(`Узел «${name}» создан на ${d}`);
```

Добавить печатный слой в конец `<style>`:

```css
@media print{
  .sidebar, .topbar, .section-tools, #probTabs, #treeExpand, #chgWin, .toast{ display:none !important; }
  .app{ display:block; height:auto; }
  .content{ overflow:visible; }
  .ovwrap{ max-width:none; padding:0; }
  .section{ break-inside:avoid; }
  .metric{ cursor:default; }
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: все `PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — создание узла с дашборда, тост, печать паспорта"
```

---

### Task 8: Шапка-комментарий, скриншоты, финальная проверка

**Files:**
- Modify: `mockups/org-structure/org-structure-v2.html` (комментарий-шапка, `<title>`)
- Modify: `scripts/inspect/org-structure-v2-check.mjs` (скриншоты)

**Interfaces:**
- Consumes: всё выше.
- Produces: `.auth/org-v2-<date>-<role>.png` — скриншоты для передачи дев-команде.

- [ ] **Step 1: Обновить `<title>` и шапку**

`<title>` → `Оргструктура · Обзор · АСУБК`.

Комментарий-шапку v1 (строки 7–67) дополнить блоком в начале, сохранив описание шести швов:

```
  ВЕРСИЯ 2 — ГЛАВНАЯ СТРАНИЦА «ОБЗОР» (дашборд на дату среза).
  Спека: docs/superpowers/specs/2026-07-14-org-structure-v2-design.md
  Новых сущностей нет: 6 KPI-плиток, блок «Требует внимания» (6 рабочих списков),
  мини-дерево, «штат и факт», лента изменений — всё производное от модели v1
  (UNITS / NAME_VER / PARENT_VER / TITLES / POSITIONS / ASSIGN / ACTING).
  Дельта метрик считается к дате «год назад» (shiftYear(d,-1)).
  Границы прежние: кураторство, карточки сотрудников и ведомство — чужие модули.
```

- [ ] **Step 2: Добавить съёмку скриншотов в проверочный скрипт**

Перед `await ctx.close()`:

```js
// скриншоты для дев-команды
for (const [d, label] of [['2026-07-11', 'today'], ['2023-09-01', '2023']]) {
  await page.click(`.date-chip[data-d="${d}"]`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `.auth/org-v2-${label}-hr.png`, fullPage: true });
}
await page.selectOption('#roleSel', 'obs');
await page.screenshot({ path: '.auth/org-v2-today-obs.png', fullPage: true });
await page.selectOption('#roleSel', 'hr');
```

- [ ] **Step 3: Прогнать полную проверку**

Run: `node scripts/inspect/org-structure-v2-check.mjs`
Expected: `ALL PASS`, exit 0; в `.auth/` появились три PNG.

- [ ] **Step 4: Глазами посмотреть скриншоты**

Открыть `.auth/org-v2-today-hr.png` и `.auth/org-v2-today-obs.png`. Критерий (§6 спеки): метрики и списки пересчитаны от даты среза; у Наблюдателя все кнопки действий серые.

- [ ] **Step 5: Коммит**

```bash
git add mockups/org-structure/org-structure-v2.html scripts/inspect/org-structure-v2-check.mjs
git commit -m "feat(mockup): оргструктура v2 — шапка-спека, скриншоты, финальная проверка"
```

---

## Покрытие спеки

| Требование спеки | Задача |
|---|---|
| §3 дата среза + роль пронизывают дашборд | 1, 3, 4 (проверка роли), 8 (скриншоты) |
| §4.1–4.3 каркас: sidebar «Обзор», топбар, section-tools | 1 |
| §4.4 шесть KPI-плиток + дельта + кликабельность | 3 |
| §4.5 «Требует внимания» — 6 списков, колонки, действия, deep-link | 4 |
| §4.6 мини-дерево | 5 |
| §4.7 «штат и факт» | 5 |
| §4.8 лента изменений за 30 дней | 6 |
| §4.9 модалка «Новое подразделение» | 7 |
| §4.10 тост + печатный слой | 7 |
| §5 пустой срез | 3 |
| §5 вакансия корня — отдельный баннер | 3 |
| §5 пустой список пишет «Нарушений нет» | 4 |
| §5 ликвидированные вне метрик, но в ленте и дереве | 2 (`liveUnitsAt` / `changesSince`), 5 |
| §6 проверка: даты, роли, переходы | 1–8 (растущий `org-structure-v2-check.mjs`) |
