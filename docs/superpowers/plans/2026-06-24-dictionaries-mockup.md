# Витрина справочников (мокап) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Один self-contained HTML-мокап `mockups/dictionaries/dictionaries.html` — витрина всех 50 справочников (47 из меню + 3 picker-only) в целевом (to-be) виде, переиспользуемая как база для других мокапов.

**Architecture:** Single-file HTML+CSS+JS. Данные справочников — один JS-литерал `DICTS` (массив описаний: title/route/archetype/columns/rows/note). Один обобщённый рендер-движок строит из `DICTS` все секции (тулбар + грид), sidebar-якоря, общую модалку (Просмотр/Изменить/Создать), фильтр и picker-демо. Никакого бэкенда/персистентности.

**Tech Stack:** Чистый HTML/CSS/JS (без сборки). Дизайн-токены `--asubk-*` копируются из `mockups/loan-program/loan-program.html`. Верификация — открытие `file://` в системном Chrome через `playwright-core` (паттерн `scripts/inspect/*.mjs`).

## Global Constraints

- **Single-file:** всё (CSS, JS, данные) внутри `mockups/dictionaries/dictionaries.html`. Без внешних зависимостей и сетевых запросов.
- **Дизайн-система:** только токены `--asubk-*` из loan-program; primary `#006AF5`, ink `#192434`, бейджи `.badge.success/warning/info/error`, грид-рамка `--asubk-border-base`, `--control-h:36px`. Не вводить новых цветов.
- **Язык интерфейса:** русский. Англоязычные подписи стенда (`agreement-template*`, `Destination accounts`) локализуются.
- **To-be данные:** тест-мусор вычищен (`соновное 1`, `123/321`, `hidshgiu`, `шрафы`, `Aibek rate`). Значения — со стенда (`.auth/dict/_all.json`), не норматив.
- **Усечение:** большие справочники → 6–8 строк + пометка `показано N из M` (no silent truncation).
- **Архетипы:** `R` = `industryDirections, collateralTypes, commissions, creditTerms, calculationCoefficients, individuals, organizations` (колонки Наименование·Код·Статус·Дата создания или доменные у реестров). Остальные — `S`.
- **Нет автотестов** в репозитории (CLAUDE.md). Каждая задача верифицируется в браузере (скриншот + визуальная проверка), не unit-тестом.
- Спека: `docs/superpowers/specs/2026-06-24-dictionaries-mockup-design.md`.

---

## Task 1: Скелет файла + дизайн-токены + раскладка

**Files:**
- Create: `mockups/dictionaries/dictionaries.html`
- Reference: `mockups/loan-program/loan-program.html:37-180` (блок `:root` токенов + базовые классы `.app/.sidebar/.main/.topbar`)

**Interfaces:**
- Produces: DOM-каркас с `#nav` (sidebar), `#dict-list` (контейнер секций), `#topbar-count`, `#modal-root`. CSS-классы `.app .sidebar .main .topbar .section .toolbar .grid .badge` готовы к использованию следующими задачами.

- [ ] **Step 1: Создать файл с каркасом**

Скопировать из `loan-program.html` блок `<style>:root{…}` (переменные `--asubk-*`, `--text-*`, `--space-*`, `--radius-*`, `--control-h`) и базовые правила `*{box-sizing}`, `body`, `.app`, `.sidebar`, `.main`, `.topbar`, скроллбар. Добавить HTML-шаблон комментария (как в loan-program: «MOCKUP … не прод-код», цель файла, что переиспользуется). Тело:

```html
<div class="app">
  <aside class="sidebar">
    <div class="brand">АСУБК · Справочники</div>
    <input id="nav-filter" class="nav-filter" placeholder="Фильтр справочников…">
    <nav id="nav" class="nav"></nav>
  </aside>
  <main class="main">
    <header class="topbar">
      <span class="crumb-title">Справочники</span>
      <span id="topbar-count" class="crumb-status"></span>
    </header>
    <div id="dict-list" class="dict-list"></div>
  </main>
</div>
<div id="modal-root"></div>
<script>/* DICTS + engine — следующие задачи */</script>
```

Добавить CSS: `.nav-filter` (поле в стиле инпутов loan-program), `.dict-list{padding:16px;display:flex;flex-direction:column;gap:32px}`, `.section`, `.section-head`, `.arch-chip`, `.slug`, `.row-count`.

- [ ] **Step 2: Верифицировать в браузере**

```bash
node -e "const{chromium}=require('playwright-core');(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:1600,height:1000}});await p.goto('file://'+process.cwd()+'/mockups/dictionaries/dictionaries.html');await p.screenshot({path:'.auth/dict-mockup-t1.png'});await b.close();})()"
```
Expected: открывается без ошибок консоли; видны sidebar с заголовком/полем фильтра, topbar «Справочники», пустая область списка. Шрифт/цвета как в loan-program.

- [ ] **Step 3: Commit**

```bash
git add mockups/dictionaries/dictionaries.html
git commit -m "mockup(dicts): scaffold — design tokens, layout shell"
```

---

## Task 2: Генератор черновика данных из дампа

**Files:**
- Create: `scripts/inspect/tz/build-dict-data.mjs`
- Read: `.auth/dict/_all.json`
- Create (gen output, git-ignored ok): `.auth/dict-data.draft.json`

**Interfaces:**
- Produces: `.auth/dict-data.draft.json` — массив `{route,title,archetype,ncols,columns,rows,total}` для последующей ручной чистки и вставки в `DICTS`. `rows` — массив массивов строковых ячеек.

`cellSample` в дампе — row-major (заголовки + значения), пустые ячейки схлопнуты. Чтобы корректно разбить, задаём **число колонок per-route** (ниже). Где `ncols=1` — простой словарь. Скрипт режет `cellSample` на заголовок (первые `ncols`) и строки по `ncols`.

- [ ] **Step 1: Написать генератор**

```js
// build-dict-data.mjs — черновик DICTS из .auth/dict/_all.json (ручная чистка после)
import { readFileSync, writeFileSync } from 'node:fs';
const all = JSON.parse(readFileSync('.auth/dict/_all.json','utf8'));

// число колонок грида per-route (по заголовкам стенда; 1 = простой словарь)
const NCOLS = {
  'credit-order-states':1,'credit-order-types':1,'order-document-types':1,
  'entity-document-states':1,'entity-document-registered-bies':1,
  'document-package-states':1,'document-package-types':1,
  'applied-entity-list-states':1,'applied-entity-list-types':1,'applied-entity-states':1,
  'order-term-funds':1,'order-term-currencies':1,'loan-types':1,
  'industryDirections':2,'loan-credit-lines':1,'loan-type-repayment-accounts':1,
  'loan-grace-periods':1,'loan-percent-rates':1,'interest-rates':1,
  'order-term-floating-rate-types':1,'order-term-frequency-types':1,
  'order-term-rate-periods':1,'order-term-days-methods':1,'order-term-accr-methods':1,
  'order-term-transaction-orders':1,'agreement-templates':3,'agreement-template-codes':2,
  'collateralTypes':2,'employees':1,'commissions':4,'borrower-groups':1,
  'debtor-types':1,'work-sectors':1,'organization-forms':1,'loan-payment-capacity-groups':1,
  'loan-states':1,'loan-redemption-accounts':1,'loan-termses':1,'creditTerms':4,
  'calculationCoefficients':2,'installment-states':1,'payment-types':1,'good-types':1,
  'destination-accounts':1,'payment-purpose-requisites':2,
  'individuals':6,'organizations':4,
};
const R = new Set(['industryDirections','collateralTypes','commissions','creditTerms',
  'calculationCoefficients','individuals','organizations']);

const out = all.map(r => {
  const n = NCOLS[r.route] ?? 1;
  const cells = r.cellSample || [];
  const columns = cells.slice(0, n);
  const flat = cells.slice(n);
  const rows = [];
  for (let i = 0; i < flat.length; i += n) rows.push(flat.slice(i, i + n));
  return { route:r.route, title:r.title, archetype:R.has(r.route)?'R':'S',
           ncols:n, columns, rows, total:rows.length };
});
writeFileSync('.auth/dict-data.draft.json', JSON.stringify(out, null, 1));
console.log('dicts:', out.length, '→ .auth/dict-data.draft.json');
```

- [ ] **Step 2: Запустить генератор**

```bash
node scripts/inspect/tz/build-dict-data.mjs
```
Expected: `dicts: 47 → .auth/dict-data.draft.json`. Файл существует.

- [ ] **Step 3: Проверить разбиение многоколоночных**

```bash
node -e "const d=require('./.auth/dict-data.draft.json');for(const r of d.filter(x=>x.archetype==='R')) console.log(r.route, r.columns, '| rows:', r.total, '| first:', JSON.stringify(r.rows[0]))"
```
Expected: у `commissions` columns=`['Наименование','Тип','Дата основания','Статус']`, первая строка из 4 ячеек; аналогично creditTerms/individuals/organizations. Если строки «съезжают» (пустые ячейки схлопнулись) — отметить такие route для ручной правки в Task 4.

- [ ] **Step 4: Commit**

```bash
git add scripts/inspect/tz/build-dict-data.mjs
git commit -m "mockup(dicts): draft-data generator from live dump"
```

---

## Task 3: Рендер-движок секций + бейджи + один S-справочник

**Files:**
- Modify: `mockups/dictionaries/dictionaries.html` (блок `<script>`, CSS грида/тулбара/бейджей)

**Interfaces:**
- Consumes: каркас из Task 1 (`#dict-list`).
- Produces: глобальные `DICTS` (массив), `renderSections()`, CSS `.toolbar .btn .grid .badge.success|warning|info|error .empty-note`. `statusBadge(text)` → HTML бейджа по словарю статусов.

- [ ] **Step 1: Добавить CSS грида/тулбара/бейджей**

Скопировать стили грида и `.btn` из `loan-program.html` (грид-рамка, заголовок 14px/500 `--asubk-ink-90`, тело 16px, padding `7px 14px`; primary/tertiary кнопки 36px). Добавить:

```css
.section-head{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.section-head h2{ font:var(--font-page-title); color:var(--text-heading); margin:0; }
.arch-chip{ font:600 12px/1 var(--asubk-font); padding:3px 7px; border-radius:var(--radius-pill);
  background:var(--asubk-blue-tint); color:var(--asubk-link); }
.arch-chip.r{ background:var(--asubk-green-tint); color:var(--asubk-green); }
.slug{ font:400 13px/1 ui-monospace,monospace; color:var(--text-muted); }
.row-count{ margin-left:auto; font:var(--font-label); color:var(--text-muted); }
.badge{ display:inline-block; padding:2px 9px; border-radius:var(--radius-pill); font:500 13px/1.4 var(--asubk-font); }
.badge.success{ background:var(--status-success-bg); color:var(--status-success); }
.badge.warning{ background:var(--status-warning-bg); color:var(--status-warning); }
.badge.info{ background:var(--status-info-bg); color:var(--status-info); }
.badge.error{ background:var(--status-error-bg); color:var(--status-error); }
.empty-note{ padding:14px 16px; color:var(--text-muted); border:1px dashed var(--border-default);
  border-radius:var(--radius-md); }
```

- [ ] **Step 2: Добавить движок и один справочник**

В `<script>` объявить `DICTS` пока с одним элементом (`loan-types`, S) и написать рендер:

```js
const STATUS_KIND = { // текст статуса → класс бейджа
  'Активный':'success','Активная':'success','Действует':'success','Одобрен':'success',
  'Неактивный':'warning','Закрыт':'warning','Черновик':'info','На рассмотрении':'info','Отклонён':'error',
};
const badge = t => `<span class="badge ${STATUS_KIND[t]||'info'}">${t}</span>`;
const isStatusCol = name => /статус/i.test(name);

const DICTS = [
  { route:'loan-types', title:'Вид кредита', archetype:'S', group:'src',
    columns:['Наименование'],
    rows:[['Бюджетная ссуда'],['Бюджетный кредит'],['ЮСАИД'],['МАР'],
          ['Фонд развития регионов'],['Имущественные активы']], total:6 },
];

function sectionHTML(d){
  const head = `<div class="section-head">
    <h2>${d.title}</h2>
    <span class="arch-chip ${d.archetype==='R'?'r':''}">${d.archetype}</span>
    <span class="slug">${d.route}</span>
    <span class="row-count">${d.note || (d.total+' строк')}</span></div>`;
  const toolbar = `<div class="toolbar">
    <button class="btn primary" data-act="create">Создать</button>
    <button class="btn" data-act="edit">Изменить</button>
    <button class="btn" data-act="view">Просмотр</button>
    <button class="btn" data-act="delete">Удалить</button>
    <button class="btn ghost" data-act="filter">+ Добавить условие поиска</button></div>`;
  let grid;
  if(!d.rows.length){ grid = `<div class="empty-note">Справочник не наполнен</div>`; }
  else {
    const th = d.columns.map(c=>`<th>${c}</th>`).join('');
    const tr = d.rows.map((r,i)=>`<tr data-i="${i}">`+
      r.map((c,ci)=> isStatusCol(d.columns[ci]) ? `<td>${badge(c)}</td>` : `<td>${c}</td>`).join('')
      +`</tr>`).join('');
    grid = `<table class="grid"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
  }
  return `<section class="section" id="sec-${d.route}" data-route="${d.route}">${head}${toolbar}${grid}</section>`;
}
function renderSections(){
  document.getElementById('dict-list').innerHTML = DICTS.map(sectionHTML).join('');
  document.getElementById('topbar-count').textContent = DICTS.length+' справочников';
}
renderSections();
```

- [ ] **Step 3: Верифицировать**

Скриншот (как Task 1, путь `.auth/dict-mockup-t3.png`). Expected: секция «Вид кредита» с чипом `S`, slug, «6 строк», тулбаром из 5 кнопок, гридом из 6 строк в стиле дизайн-системы.

- [ ] **Step 4: Commit**

```bash
git add mockups/dictionaries/dictionaries.html
git commit -m "mockup(dicts): render engine, badges, first S section"
```

---

## Task 4: Наполнить DICTS всеми 50 справочниками (to-be чистка)

**Files:**
- Modify: `mockups/dictionaries/dictionaries.html` (массив `DICTS`)
- Read: `.auth/dict-data.draft.json` (черновик из Task 2)

**Interfaces:**
- Consumes: `renderSections()`, `badge()`, `isStatusCol()` из Task 3; черновик данных из Task 2.
- Produces: полный `DICTS` из 50 элементов с полями `group` (id домена §7 спеки), `note` для усечённых.

Правила переноса (применять к каждому из 47 + добавить 3 picker-only):

- Брать `columns`/`rows`/`total` из `.auth/dict-data.draft.json`.
- **Чистка (to-be):** удалить строки-мусор `соновное 1` (credit-order-types), `123/321` (loan-type-repayment-accounts, loan-redemption-accounts), `hidshgiu/fgxdzxh` (borrower-groups), `шрафы`→`Штрафы` (order-term-transaction-orders), `Aibek rate` (order-term-floating-rate-types), `Кредит компании` мусор в loan-states.
- **Локализация заголовков:** `agreement-templates` колонки → `Наименование·Тип·Статус`; `agreement-template-codes` → `Код·Наименование`; `destination-accounts` title → `Счета назначения`.
- **Статусы→бейджи:** колонка со словом «Статус» рендерится бейджем автоматически (Task 3). Справочники-статусы (`*-states`, `loan-states`, `installment-states`) — значения тоже как бейджи: пометить такие `statusDict:true` и в `sectionHTML` для них оборачивать единственную колонку в `badge()` (добавить ветку).
- **Усечение:** для `industryDirections, organizations, individuals, commissions, interest-rates, creditTerms, loan-termses` оставить 6–8 показательных строк, выставить `note:'показано N из M'` (M = `total` из черновика: 111,199,96,30,29,20,19).
- **Пустые (13):** `order-document-types, entity-document-states, entity-document-registered-bies, document-package-states, document-package-types, applied-entity-list-states, applied-entity-list-types, applied-entity-states, order-term-frequency-types, order-term-rate-periods, order-term-accr-methods, work-sectors, good-types, loan-payment-capacity-groups` — `rows:[]` (рендерится плашка). Колонку дать осмысленную (`Наименование`).
- **group** per §7 спеки: `dec`(решения/получатели), `src`(источники/валюты/кредит), `rate`(ставки), `calc`(платежи/расчёты), `agr`(договоры/залог), `subj`(субъекты/заёмщик), `loan`(кредит/график), `goods`(товары/счета), `picker`(picker-only).
- **Picker-only 3** добавить вручную (нет в дампе), group `picker`:
  - `Цели кредита` — columns `['Наименование']`, rows: `Пополнение оборотных средств, Приобретение основных средств, Рефинансирование, Строительство`.
  - `Уровни проверки документов` — rows: `Первичная, Юридическая, Финансовая, Окончательная`.
  - `Типы расчёта процентов` — rows: `Аннуитет, Дифференцированный, В конце срока`.

- [ ] **Step 1: Расширить statusDict-ветку рендера**

В `sectionHTML` (Task 3) добавить: если `d.statusDict`, единственная колонка тела оборачивается в `badge()`.

```js
const cellHTML = (d,c,ci)=> (d.statusDict || isStatusCol(d.columns[ci])) ? `<td>${badge(c)}</td>` : `<td>${c}</td>`;
// заменить inline-тернар в map на cellHTML(d,c,ci)
```

- [ ] **Step 2: Вписать все 50 элементов в DICTS**

Перенести из `.auth/dict-data.draft.json` по правилам выше (заменить временный одноэлементный `DICTS` из Task 3 полным массивом, `loan-types` — с `group:'src'`). Каждый элемент: `{route,title,archetype,group,columns,rows,total[,note][,statusDict]}`.

- [ ] **Step 3: Верифицировать полноту и вид**

```bash
node -e "const{chromium}=require('playwright-core');(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:1600,height:1200}});await p.goto('file://'+process.cwd()+'/mockups/dictionaries/dictionaries.html');const n=await p.\$\$eval('.section',s=>s.length);console.log('sections:',n);await p.screenshot({path:'.auth/dict-mockup-t4.png',fullPage:true});await b.close();})()"
```
Expected: `sections: 50`. На full-page скриншоте: статусы — бейджами, усечённые — с «показано N из M», 13 пустых — с плашкой «Справочник не наполнен», англ. заголовки локализованы.

- [ ] **Step 4: Commit**

```bash
git add mockups/dictionaries/dictionaries.html
git commit -m "mockup(dicts): populate all 50 dictionaries, to-be cleanup"
```

---

## Task 5: Sidebar-якоря, scroll-spy, фильтр

**Files:**
- Modify: `mockups/dictionaries/dictionaries.html` (`<script>`, CSS `.nav*`)

**Interfaces:**
- Consumes: `DICTS` с полем `group`; секции `#sec-<route>`.
- Produces: `renderNav()`, обработчики клика-якоря, IntersectionObserver scroll-spy, фильтр по `#nav-filter`.

- [ ] **Step 1: Группы и рендер навигации**

```js
const GROUPS = [
  {id:'dec', label:'Решения и получатели'},{id:'src', label:'Источники, валюты, кредит'},
  {id:'rate',label:'Ставки'},{id:'calc',label:'Платежи и расчёты'},
  {id:'agr', label:'Договоры и залог'},{id:'subj',label:'Субъекты и заёмщик'},
  {id:'loan',label:'Кредит и график'},{id:'goods',label:'Товары и счета'},
  {id:'picker',label:'Picker-only (нет в меню)'},
];
function renderNav(){
  const nav=document.getElementById('nav');
  nav.innerHTML=GROUPS.map(g=>{
    const items=DICTS.filter(d=>d.group===g.id).map(d=>
      `<a class="nav-item" href="#sec-${d.route}" data-route="${d.route}">${d.title}</a>`).join('');
    return `<div class="nav-group"><div class="nav-grp-label">${g.label}</div>${items}</div>`;
  }).join('');
  nav.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();
    document.getElementById('sec-'+a.dataset.route).scrollIntoView({behavior:'smooth',block:'start'});
  }));
}
renderNav();
```
CSS: `.nav-grp-label`(600/13px, muted, padding), `.nav-item`(как loan-program), `.nav-item.active{background:var(--asubk-nav-active)}`.

- [ ] **Step 2: Scroll-spy**

```js
const spy=new IntersectionObserver(es=>{
  es.forEach(en=>{ if(en.isIntersecting){
    document.querySelectorAll('.nav-item.active').forEach(x=>x.classList.remove('active'));
    const a=document.querySelector('.nav-item[data-route="'+en.target.dataset.route+'"]');
    if(a){a.classList.add('active'); a.scrollIntoView({block:'nearest'});}
  }});
},{rootMargin:'-10% 0px -80% 0px'});
document.querySelectorAll('.section').forEach(s=>spy.observe(s));
```

- [ ] **Step 3: Фильтр**

```js
document.getElementById('nav-filter').addEventListener('input',e=>{
  const q=e.target.value.trim().toLowerCase();
  DICTS.forEach(d=>{
    const hit=d.title.toLowerCase().includes(q)||d.route.toLowerCase().includes(q);
    document.getElementById('sec-'+d.route).style.display=hit?'':'none';
    document.querySelector('.nav-item[data-route="'+d.route+'"]').style.display=hit?'':'none';
  });
});
```

- [ ] **Step 4: Верифицировать**

Скрипт: перейти на файл, ввести в `#nav-filter` «валют», проверить что видна только секция `order-term-currencies`; кликнуть nav-item, проверить скролл. Скриншот `.auth/dict-mockup-t5.png`.
Expected: фильтр прячет несовпадающие секции и пункты; клик скроллит; активный пункт следует за скроллом.

- [ ] **Step 5: Commit**

```bash
git add mockups/dictionaries/dictionaries.html
git commit -m "mockup(dicts): sidebar anchors, scroll-spy, filter"
```

---

## Task 6: Общая модалка (Просмотр/Изменить/Создать) + Удалить

**Files:**
- Modify: `mockups/dictionaries/dictionaries.html` (`<script>`, CSS `.modal*`)

**Interfaces:**
- Consumes: тулбар `data-act`, строки `tr[data-i]`, `DICTS`.
- Produces: `openModal(route, mode, rowIndex)`, делегированные обработчики тулбара и двойного клика.

- [ ] **Step 1: CSS модалки**

Скопировать overlay/диалог из loan-program (затемнение, карточка, заголовок, футер с кнопками Сохранить/Отмена). Поля — `.field label + input` в стиле дизайн-системы (обяз.→белый+рамка, readonly→серый — токены уже есть).

- [ ] **Step 2: Движок модалки**

```js
let selected={}; // route -> rowIndex
function openModal(route,mode,i){
  const d=DICTS.find(x=>x.route===route);
  const row = (i!=null && d.rows[i]) || d.columns.map(()=> '');
  const ro = mode==='view';
  const fields=d.columns.map((c,ci)=>`<div class="field"><label>${c}</label>
    <input value="${row[ci]??''}" ${ro?'readonly':''}></div>`).join('');
  const title={view:'Просмотр',edit:'Изменить',create:'Создать'}[mode]+' — '+d.title;
  document.getElementById('modal-root').innerHTML=`<div class="modal-overlay">
    <div class="modal"><div class="modal-head">${title}</div>
    <div class="modal-body">${fields}</div>
    <div class="modal-foot">${ro?'':'<button class="btn primary" data-m="save">Сохранить</button>'}
      <button class="btn" data-m="close">${ro?'Закрыть':'Отмена'}</button></div></div></div>`;
  const close=()=>document.getElementById('modal-root').innerHTML='';
  document.querySelector('[data-m="close"]').onclick=close;
  const save=document.querySelector('[data-m="save"]'); if(save) save.onclick=close;
}
```

- [ ] **Step 3: Привязать тулбар и Удалить**

```js
document.getElementById('dict-list').addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]'); if(!btn) return;
  const route=btn.closest('.section').dataset.route;
  const act=btn.dataset.act;
  if(act==='create') return openModal(route,'create',null);
  if(act==='filter') return btn.closest('.section').querySelector('.grid')?.classList.toggle('filtering'); // демо
  const i=selected[route];
  if(act==='view'||act==='edit'){ if(i==null) return alert('Выберите строку'); return openModal(route,act,i); }
  if(act==='delete'){ if(i==null) return alert('Выберите строку');
    if(confirm('Удалить запись?')){ const tr=document.querySelector('#sec-'+route+' tr[data-i="'+i+'"]'); tr&&tr.remove(); selected[route]=null; } }
});
// выбор строки + двойной клик → Просмотр
document.getElementById('dict-list').addEventListener('click',e=>{
  const tr=e.target.closest('tr[data-i]'); if(!tr) return;
  const route=tr.closest('.section').dataset.route;
  tr.closest('tbody').querySelectorAll('tr.sel').forEach(x=>x.classList.remove('sel'));
  tr.classList.add('sel'); selected[route]=+tr.dataset.i;
});
document.getElementById('dict-list').addEventListener('dblclick',e=>{
  const tr=e.target.closest('tr[data-i]'); if(!tr) return;
  openModal(tr.closest('.section').dataset.route,'view',+tr.dataset.i);
});
```
CSS: `tr.sel{background:var(--asubk-blue-tint)}`.

- [ ] **Step 4: Верифицировать**

Скрипт: кликнуть строку в `loan-types`, нажать «Просмотр» → модалка readonly; «Создать» → пустая модалка; двойной клик → Просмотр; «Удалить» после выбора → строка исчезает. Скриншот модалки `.auth/dict-mockup-t6.png`.
Expected: модалка открывается/закрывается, поля заполнены, readonly в Просмотре.

- [ ] **Step 5: Commit**

```bash
git add mockups/dictionaries/dictionaries.html
git commit -m "mockup(dicts): shared view/edit/create modal + delete + row select"
```

---

## Task 7: Picker-демо (режим только выбора) + финальная проверка

**Files:**
- Modify: `mockups/dictionaries/dictionaries.html`

**Interfaces:**
- Consumes: `DICTS`, секции группы `picker`.
- Produces: кнопка «Открыть как picker» в секциях группы `picker`, `openPicker(route)` — полноэкранный диалог выбора без CRUD (эталон P2-R9).

- [ ] **Step 1: Кнопка picker в секциях группы `picker`**

В `sectionHTML`: если `d.group==='picker'`, добавить в тулбар `<button class="btn" data-act="picker">Открыть как picker</button>` и баннер `<div class="picker-note">Доступен только из формы (picker-диалог)</div>`.

- [ ] **Step 2: openPicker**

```js
function openPicker(route){
  const d=DICTS.find(x=>x.route===route);
  const rows=d.rows.map((r,i)=>`<label class="picker-row"><input type="radio" name="pick"><span>${r.join(' · ')}</span></label>`).join('');
  document.getElementById('modal-root').innerHTML=`<div class="modal-overlay">
    <div class="modal picker"><div class="modal-head">Выбор: ${d.title}</div>
    <div class="modal-body">${rows||'<div class="empty-note">нет значений</div>'}</div>
    <div class="modal-foot"><button class="btn primary" data-m="ok">Выбрать</button>
    <button class="btn" data-m="close">Отмена</button></div></div></div>`;
  const close=()=>document.getElementById('modal-root').innerHTML='';
  document.querySelector('[data-m="close"]').onclick=close;
  document.querySelector('[data-m="ok"]').onclick=close;
}
// в делегате тулбара (Task 6) добавить: if(act==='picker') return openPicker(route);
```
CSS: `.picker-row{display:flex;gap:8px;padding:8px;border-bottom:1px solid var(--border-default);cursor:pointer}` `.picker-note{font:var(--font-label);color:var(--text-muted);margin:4px 0}`.

- [ ] **Step 3: Финальная сквозная проверка**

```bash
node -e "const{chromium}=require('playwright-core');(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:1600,height:1200}});const errs=[];p.on('console',m=>m.type()==='error'&&errs.push(m.text()));await p.goto('file://'+process.cwd()+'/mockups/dictionaries/dictionaries.html');const n=await p.\$\$eval('.section',s=>s.length);console.log('sections:',n,'errors:',errs.length,errs);await p.screenshot({path:'.auth/dict-mockup-final.png',fullPage:true});await b.close();})()"
```
Expected: `sections: 50 errors: 0`. Проверить по критериям §10 спеки: 50 секций, тулбары/гриды, бейджи, усечение с пометкой, пустые с плашкой, picker-демо в группе picker — режим выбора без Создать/Изменить/Удалить.

- [ ] **Step 4: Обновить STATUS.md и README.md**

Добавить строку про `mockups/dictionaries/dictionaries.html` в карту мокапов (README) и отметить в STATUS.md (обновить дату «Last updated»).

- [ ] **Step 5: Commit**

```bash
git add mockups/dictionaries/dictionaries.html STATUS.md README.md
git commit -m "mockup(dicts): picker select-only demo; docs map + status"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** §3 файл/токены→T1; §4 раскладка→T1/T5; §5 данные/колонки/чистка/усечение/пустые→T2/T4; §6 интерактив (просмотр/правка/создать/удалить/picker/фильтр)→T5/T6/T7; §7 группировка→T4/T5; §8 переиспользование (движок/токены/picker/таблицы)→совокупно; §10 критерий→T7 step 3. Покрыто.
- **Плейсхолдеры:** код приведён в каждом шаге, путей-заглушек нет.
- **Согласованность типов:** `renderSections/renderNav/openModal/openPicker`, поля `DICTS` (`route,title,archetype,group,columns,rows,total,note,statusDict`), `selected[route]` — единообразны между задачами.
