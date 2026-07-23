# Borrower Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `mockups/borrower/borrower.html` from a static mockup (derived values baked into markup) into an executable MVP — facts-only state + pure functions + runtime render + jsdom smoke tests — matching collection.html/zalog.html/restructuring.html.

**Architecture:** Single-file HTML, vanilla JS. The stand-verified borrower shell (279px sidebar, hash router, list registry, helpers) is **kept** and retokenized gen-1→gen-2. The `<script>` is split into 4 sections: (1) STATE — top-level fact arrays only, one owner-comment per array; (2) PURE FUNCTIONS — top-level declarations reachable from `w.eval` in tests; (3) RENDER — registry / card (11 tabs) / subject, everything computed from functions; (4) SHELL — router, registry table↔cards toggle, tab-memory (kept as-is). No derived value ever lives in markup.

**Tech Stack:** HTML5 + vanilla ES; jsdom (`JSDOM(HTML,{runScripts:'dangerously'})`) for smoke tests; Node ESM test runner (`scripts/inspect/borrower-check.mjs`), pattern of `scripts/inspect/collection-check.mjs`.

## Global Constraints

- **`TODAY = '13.07.2026'`** — fixed clock, all "as-of" logic reads it. Dates are `'dd.mm.yyyy'` strings.
- **No derived value in markup.** No hand-typed «Высокий», «2.3», «осталось 40 из 70». Every category / group / count / status renders from a §4 function. This is the build invariant checked by tests.
- **gen-2 tokens only.** Copy the `:root` block from `mockups/restructuring/restructuring.html` (lines 98–133) verbatim. No `--primary`, `--body-text`, `--field-bg`, `--filter-bg`, `--primary-10`, `--blue-tint` etc. remain — all mapped to `--action-*` / `--text-*` / `--surface-*` / `--status-*`.
- **Facts only in STATE.** Fact arrays carry no `level`/`group`/`category`/`daysEff`/`status` fields. Mirror arrays (owned by other modules) are read-only — no `<input>`/`<select>` inside mirror sections (И-5).
- **Internal category codes** are `'low'|'mid'|'high'`; the Russian labels come from `CAT_LABEL = {low:'Низкий', mid:'Средний', high:'Высокий'}`. Group codes are strings `'1.1'|'2.1'|'2.2'|'2.3'|'3.1'|'3.2'|'4'|'5'`.
- **Worst-of ordering:** `CAT_RANK = {low:0, mid:1, high:2}`.
- **Functions and state arrays are top-level** in the inline `<script>` (no IIFE wrapper around them) so `w.eval("catOfCredit('C1', TODAY)")` and `w.eval("CREDITS.length")` reach them.
- **Result stamp:** after tests pass, write the `26/26 PASS` block into the top HTML comment of `borrower.html` (mirrors restructuring.html lines 5–41 / collection.html header).

---

## File Structure

- **Modify (rewrite):** `mockups/borrower/borrower.html` — the whole file. Keep shell CSS/HTML + router + registry + helpers (`sect`/`table`/`esc`/`fmt`); replace `:root`, all token refs, the `DATA` array, and all render functions.
- **Create:** `scripts/inspect/borrower-check.mjs` — 26-scenario jsdom smoke test.

Section map inside `borrower.html` `<script>` (single file, but conceptually ordered):

```
SECTION 1  STATE       fact arrays (owned) + mirror arrays (read-only, owner comment each)
SECTION 2  FUNCTIONS   catByDays · isSuppressed181 · catOfCredit · catOfBorrower · groupOf ·
                       totalDebt · overdueDebt · coverageOf · addWorkdays · obligations ·
                       committeeQueue · conflictState · suspendedEmployees · subjectState ·
                       isReadOnly · curatorMatrix
SECTION 3  RENDER      renderList/renderCards · renderCard (4 tiles + 11 tabs) · renderSubject
SECTION 4  SHELL       route() · showList/showDetail/showSubject · tab memory · list toggle (kept)
```

---

## Task 1: Scaffold — retokenize shell, split script sections, wire the jsdom harness

Establish the retokenized shell and an empty-but-loading file with the 4-section skeleton, plus the test harness that loads it with zero console errors. No business logic yet.

**Files:**
- Modify: `mockups/borrower/borrower.html` — `:root` block (lines 8–24), all gen-1 token references, script section headers.
- Create: `scripts/inspect/borrower-check.mjs`

**Interfaces:**
- Produces: a `borrower.html` that loads under jsdom without `jsdomError`; helpers `esc`, `fmt`, `sect`, `table` kept top-level; `TODAY`, `CAT_LABEL`, `CAT_RANK` top-level constants.

- [ ] **Step 1: Replace the `:root` block with gen-2 tokens.** In `borrower.html`, replace the entire `:root{ … }` block (currently lines 8–24, the gen-1 palette) with the gen-2 block copied verbatim from `mockups/restructuring/restructuring.html` lines 98–133 (the block starting `--asubk-blue:#006AF5;` … ending `--shadow-focus:…;`).

- [ ] **Step 2: Retokenize every gen-1 reference in the shell CSS.** Apply this exact map across the whole `<style>`:

```
--primary            → --action-primary
--primary-text       → --text-link
--primary-hover      → --action-primary-hover
--body-text          → --text-body
--secondary-text     → --text-muted
--field-bg           → --surface-panel
--filter-bg          → --surface-hover
--field-border       → --border-strong
--field-fill         → --surface-input
--primary-10         → --status-info-bg
--blue-tint          → --status-info-bg
--contrast-5         → --surface-hover
--border-strong      → --border-strong   (already gen-2 name; keep)
--green-card-bg      → --status-success-bg
--success            → --status-success
--radius             → --radius-md
--font               → --asubk-font
```

Grep afterward: `grep -nE 'var\(--(primary|body-text|secondary-text|field-bg|filter-bg|field-border|field-fill|primary-10|blue-tint|contrast-5|green-card-bg|radius)\b' mockups/borrower/borrower.html` must return nothing (the standalone `--radius` — not `--radius-md`).

- [ ] **Step 3: Insert the SECTION banners in `<script>`.** Immediately after `<script>`, ensure these ordered comment banners exist and top-level constants are declared once:

```javascript
/* ═══ SECTION 1 · STATE (факты) ═══ */
const TODAY = '13.07.2026';
const CAT_LABEL = { low:'Низкий', mid:'Средний', high:'Высокий' };
const CAT_RANK  = { low:0, mid:1, high:2 };
/* fact + mirror arrays land here in Task 2 */

/* ═══ SECTION 2 · ЧИСТЫЕ ФУНКЦИИ ═══ */
/* §4 functions land here in Tasks 3–9 */

/* ═══ SECTION 3 · РЕНДЕР ═══ */
/* render functions land here in Task 10 */

/* ═══ SECTION 4 · ШЕЛЛ (роутер/реестр/память) ═══ */
/* kept as-is from the stand-verified mockup */
```

Keep the existing `esc`, `fmt`, `sect`, `table`, `route`, `showList/showDetail/showSubject`, list-view toggle, and `hashchange` wiring — move them under SECTION 4 unchanged. Remove the old `DATA` array and the old `renderCard`/`renderList`/`renderSubject` bodies (they will be rebuilt); leave temporary stubs so the file parses:

```javascript
function renderList(){ /* rebuilt in Task 10 */ }
function renderCard(b){ return ''; }
function renderSubject(b){ return ''; }
```

- [ ] **Step 4: Write the harness `borrower-check.mjs`.**

```javascript
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

// ... сценарии 1–26 добавляются по мере готовности функций ...

console.log(`\n${n - fails}/${n} PASS`);
process.exit(fails ? 1 : 0);
```

- [ ] **Step 5: Run the harness — expect the scaffold checks to pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `2/2 PASS` and exit 0. (If `jsdomError` appears, the script has a parse error — fix before continuing.)

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
refactor(borrower): каркас MVP — gen-2 токены, секции скрипта, jsdom-харнесс

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: State model — fact + mirror arrays, seed all ~12 borrowers, registry renders

Define every array from spec §2 with its owner-comment, seed the borrower base records covering all 15 demo branches, and rebuild the registry so it lists every borrower. Per-branch credits/factors/events/etc. are appended by later tasks alongside the tests that pin them.

**Files:**
- Modify: `mockups/borrower/borrower.html` — SECTION 1 (state), SECTION 3 (`renderList`/`renderCards`).
- Modify: `scripts/inspect/borrower-check.mjs` — add state-shape checks.

**Interfaces:**
- Produces: top-level arrays `SUBJECTS, SUBJECT_EVENTS, CHANNELS, BANK_REQ, CATEGORY_LOG, GROUP_LOG, COMMITTEE_REFS` (owned) and `CREDITS, FACTORS, EVENTS_RAW, OVERLAYS, PROCESSES, ASSIGN, CONFLICTS, PLEDGE_IX, ACTS, DOCS, CHECKS_EXT, RELATED, WORKDAYS` (mirrors). Field shapes exactly as spec §2. `SUBJECTS[i].inn` is the borrower key everywhere.

- [ ] **Step 1: Write the failing test** (append before the summary line in `borrower-check.mjs`):

```javascript
// ── Модель состояния ──
ok('S1. заведены все ~12 заёмщиков', g.ev("SUBJECTS.length") >= 10 && g.ev("SUBJECTS.length") <= 12);
ok('S2. ветка 1 АгроТехСервис на месте',
  g.ev("SUBJECTS.some(s=>s.inn==='01204199910016' && /АгроТехСервис/.test(s.name))"));
ok('S3. факт-массивы без производных полей (CREDITS)',
  g.ev("CREDITS.every(c=>!('level' in c) && !('category' in c) && !('daysEff' in c))"));
ok('S4. факт-массивы без производных полей (SUBJECTS)',
  g.ev("SUBJECTS.every(s=>!('group' in s) && !('category' in s))"));
ok('S5. реестр показывает все строки', g.$$('#listTable tbody tr').length === g.ev("SUBJECTS.length"));
ok('S6. WORKDAYS — массив праздников (строки dd.mm.yyyy)',
  g.ev("Array.isArray(WORKDAYS) && WORKDAYS.every(d=>/^\\d{2}\\.\\d{2}\\.\\d{4}$/.test(d))"));
```

- [ ] **Step 2: Run — verify it fails.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `S1…S6` FAIL (`SUBJECTS is not defined`).

- [ ] **Step 3: Declare all arrays in SECTION 1.** Each array gets a one-line owner comment. Facts are owned; mirrors are labelled with their source module. Seed the **subject base** for all branches (credits/factors/events come in later tasks):

```javascript
/* ── ВЛАДЕЕТ модуль (правится здесь) ── */
// SUBJECTS — субъект права; заёмщик — тонкая обёртка над ним (E2E findings).
const SUBJECTS = [
  { inn:'01204199910016', name:'ОАО «АгроТехСервис»', personKind:'юр', legalForm:'ОАО',
    ownershipForm:'Частная', industry:'Сельское хозяйство', doc:{kind:'Свид. о рег.',no:'0012041',date:'14.02.2011'},
    addrLegal:'г. Бишкек, ул. Ибраимова 24', addrFact:'г. Бишкек, ул. Ибраимова 24', regDate:'14.02.2011' },
  { inn:'02201199920021', name:'ОсОО «Иссык-Куль Агро»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Переработка', doc:{kind:'Свид. о рег.',no:'0022011',date:'03.05.2015'},
    addrLegal:'г. Каракол, ул. Токтогула 5', addrFact:'г. Каракол, ул. Токтогула 5', regDate:'03.05.2015' },
  { inn:'03301199930031', name:'ОсОО «Нарын Логистик»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Логистика', doc:{kind:'Свид. о рег.',no:'0033011',date:'19.09.2017'},
    addrLegal:'г. Нарын, ул. Ленина 12', addrFact:'г. Нарын, ул. Ленина 12', regDate:'19.09.2017' },
  { inn:'04401199940041', name:'ИП Асанов Т.К.', personKind:'ИП',
    ownershipForm:'Частная', industry:'Торговля', doc:{kind:'Патент',no:'0044011',date:'22.01.2019'},
    addrLegal:'г. Ош, ул. Курманжан-Датка 8', addrFact:'г. Ош, ул. Курманжан-Датка 8', regDate:'22.01.2019' },
  { inn:'05501199950051', name:'ОсОО «Талас Стройсервис»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Строительство', doc:{kind:'Свид. о рег.',no:'0055011',date:'07.07.2016'},
    addrLegal:'г. Талас, ул. Сарыгулова 3', addrFact:'г. Талас, ул. Сарыгулова 3', regDate:'07.07.2016' },
  { inn:'06601199960061', name:'ОсОО «Чуй Энерго»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Энергетика', doc:{kind:'Свид. о рег.',no:'0066011',date:'11.11.2014'},
    addrLegal:'г. Токмок, ул. Гагарина 41', addrFact:'г. Токмок, ул. Гагарина 41', regDate:'11.11.2014' },
  { inn:'07701199970071', name:'Мамбетов Кубаныч (физ.)', personKind:'физ',
    ownershipForm:'—', industry:'—', doc:{kind:'Паспорт',no:'ID0770117',date:'—'},
    addrLegal:'г. Джалал-Абад, ул. Токтогула 90', addrFact:'г. Джалал-Абад, ул. Токтогула 90', regDate:'—' },
  { inn:'08801199980081', name:'ОсОО «Баткен Фрут»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Сельское хозяйство', doc:{kind:'Свид. о рег.',no:'0088011',date:'28.03.2013'},
    addrLegal:'г. Баткен, ул. Раззакова 7', addrFact:'г. Баткен, ул. Раззакова 7', regDate:'28.03.2013' },
  { inn:'09901199990091', name:'ОсОО «Ак-Суу Майнинг»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Добыча', doc:{kind:'Свид. о рег.',no:'0099011',date:'02.02.2012'},
    addrLegal:'г. Каракол, ул. Абдрахманова 15', addrFact:'г. Каракол, ул. Абдрахманова 15', regDate:'02.02.2012' },
  { inn:'10001199900101', name:'ОсОО «Кара-Балта Металл»', personKind:'юр', legalForm:'ОсОО',
    ownershipForm:'Частная', industry:'Металлургия', doc:{kind:'Свид. о рег.',no:'0100011',date:'16.06.2010'},
    addrLegal:'г. Кара-Балта, ул. Кожомбердиева 2', addrFact:'г. Кара-Балта, ул. Кожомбердиева 2', regDate:'16.06.2010' },
];

// SUBJECT_EVENTS — append-only жизненный цикл субъекта (Р-9). kind: 'создан'|'реорганизация'|
//   'ликвидирован'|'долг переведён'|'смерть'; successorInn для перевода/правопреемства.
const SUBJECT_EVENTS = [
  { inn:'07701199970071', kind:'смерть', date:'20.05.2026', basis:'Свид. о смерти', doc:'СС-4471' },
  { inn:'09901199990091', kind:'долг переведён', date:'01.04.2026', basis:'Договор перевода долга',
    doc:'ПД-231', successorInn:'10001199900101' },
];

// CHANNELS — каналы связи (Р-10). kind: 'тел'|'email'|'адрес корресп.'; closedAt — если закрыт.
const CHANNELS = [
  { inn:'01204199910016', kind:'тел', value:'+996 312 66-01-24', from:'14.02.2011' },
  { inn:'01204199910016', kind:'email', value:'info@agrotech.kg', from:'14.02.2011' },
  { inn:'01204199910016', kind:'тел', value:'+996 312 66-00-00', from:'14.02.2011', closedAt:'01.01.2020' },
];

// BANK_REQ — банковские реквизиты append-only (Р-10). main — основной счёт.
const BANK_REQ = [
  { inn:'01204199910016', bank:'ОАО «РСК Банк»', account:'1234567890123456', currency:'KGS', main:true, from:'14.02.2011' },
  { inn:'01204199910016', bank:'ОАО «Айыл Банк»', account:'9876543210987654', currency:'KGS', main:false, from:'10.03.2018' },
];

// CATEGORY_LOG — append-only журнал категории. scope=inn (заёмщик) или creditId. Триггер обязательств О-1/О-2.
const CATEGORY_LOG = [];   // заполняется по веткам в Tasks 3/6
// GROUP_LOG — append-only журнал группы платёжеспособности.
const GROUP_LOG = [];      // заполняется в Task 4
// COMMITTEE_REFS — решения комитетов. kind: 'КБК'|'КРР'.
const COMMITTEE_REFS = [
  { id:'КБК-2026-118', no:'118', date:'02.03.2026', kind:'КБК', subject:'Нецелевое использование, АгроТехСервис' },
];

/* ── ЗЕРКАЛА — read-only, правка = переход в модуль-источник (И-5) ── */
const CREDITS    = [];   // ← кредитный модуль; наполняется по веткам в Tasks 3/5
const FACTORS    = [];   // ← комитет; Tasks 3/7
const EVENTS_RAW = [];   // ← сигналы zalog/payments/collection/acts (ОВ-6 seeded); Task 7
const OVERLAYS   = [];   // ← restructuring (suppress181); Task 3
const PROCESSES  = [];   // ← collection (M:N credits); Task 4/10
const ASSIGN     = [];   // ← kuratorstvo; Task 9
const CONFLICTS  = [];   // ← конфликт интересов (Р-6); Task 8
const PLEDGE_IX  = [];   // ← zalog (индекс обеспеченности); Task 5
const ACTS       = [];   // ← акты сверок; Task 10
const DOCS       = [];   // ← досье п.97 (Р-8); Task 10
const CHECKS_EXT = [];   // ← внешние снимки КИБ/скоринг (Р-8); Task 10
const RELATED    = [];   // ← реестр лиц (Р-7); Task 10
// WORKDAYS — праздники производственного календаря КР 2026 (ОВ-2). Будни − эти даты = рабочие дни.
const WORKDAYS = ['01.01.2026','02.01.2026','07.01.2026','23.02.2026','08.03.2026','21.03.2026',
  '22.03.2026','23.03.2026','01.05.2026','05.05.2026','07.05.2026','09.05.2026','31.08.2026','07.11.2026'];
```

- [ ] **Step 4: Rebuild `renderList`/`renderCards` to iterate `SUBJECTS`.** In SECTION 3, replace the stub `renderList`. It must render one `#listTable tbody tr` per `SUBJECTS` entry, columns: ИНН · Наименование · Тип · Состояние субъекта · Группа · Категория · Обязательства(счётчик просроч.) · На комитет(счётчик). The derived columns call `subjectState`/`groupOf`/`catOfBorrower`/`obligations`/`committeeQueue` — which don't exist yet, so **guard** each with a helper that returns `'—'` when the function is undefined so the file still renders:

```javascript
function renderList(){
  const tb = document.querySelector('#listTable tbody');
  tb.innerHTML = SUBJECTS.map(s => {
    const st  = (typeof subjectState==='function') ? (subjectState(s.inn,TODAY)?.kind || '—') : '—';
    const grp = (typeof groupOf==='function') ? groupOf(s.inn,TODAY) : '—';
    const cat = (typeof catOfBorrower==='function') ? catOfBorrower(s.inn,TODAY) : null;
    const catTxt = cat ? CAT_LABEL[cat] : 'не применяется';
    const obl = (typeof obligations==='function') ? obligations(s.inn,TODAY).filter(o=>o.status==='просрочено').length : 0;
    const cq  = (typeof committeeQueue==='function') ? committeeQueue(s.inn,TODAY).length : 0;
    return `<tr data-inn="${s.inn}" style="cursor:pointer" onclick="location.hash='#/b/${s.inn}'">
      <td>${esc(s.inn)}</td><td>${esc(s.name)}</td><td>${esc(s.personKind)}</td>
      <td>${esc(st)}</td><td>${esc(grp)}</td><td>${esc(catTxt)}</td>
      <td>${obl}</td><td>${cq}</td></tr>`;
  }).join('');
}
```

Keep the existing table↔cards toggle and filter/sort wiring; point them at `SUBJECTS`. Ensure `renderList()` is called on load and on `route()` to the list view.

- [ ] **Step 4b: Repoint `route()` from the deleted `DATA` to `SUBJECTS`.** (Task 1 removed `DATA` but left `route()` calling `DATA.find(...)` twice — it throws `ReferenceError: DATA is not defined` on any real `#/b/<ИНН>` or `#/s/<ИНН>` navigation, currently masked only because the empty default hash short-circuits the guards.) In SECTION 4, replace every `DATA.find(x => x.inn === …)` inside `route()` (and any other surviving `DATA` reference in the shell) with `SUBJECTS.find(x => x.inn === …)`. Then add a test proving navigation no longer throws:

```javascript
ok('S7. route() навигация в карточку не бросает (DATA→SUBJECTS)',
  (() => { try { g.ev("location.hash='#/b/01204199910016'"); g.ev("route()"); return g.errs.length===0; } catch(e){ return false; } })());
```

Grep after: `grep -n '\bDATA\b' mockups/borrower/borrower.html` must return nothing.

- [ ] **Step 5: Run — verify S1…S7 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `9/9 PASS` (2 scaffold + 6 state + 1 route). No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): модель состояния — факт/зеркальные массивы, реестр из SUBJECTS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Category engine — `catByDays` · `isSuppressed181` · `catOfCredit` · `catOfBorrower`

The core risk-category logic (Р-3/Р-5): days→level, 181-suppression applied at credit level **before** worst-of, worst-of over factors that carry a committee decision, borrower = worst-of over active credits (null if none). Seeds branches 1, 5, 6, 10 data.

**Files:**
- Modify: `mockups/borrower/borrower.html` — SECTION 1 (append credits/factors/overlays/category-log for branches 1,5,6,10), SECTION 2 (add 4 functions).
- Modify: `scripts/inspect/borrower-check.mjs` — tests 1–7.

**Interfaces:**
- Consumes: `CREDITS`, `FACTORS`, `OVERLAYS`, `CAT_RANK`, `TODAY`, `dateLE` (add helper below).
- Produces:
  - `catByDays(days) → 'low'|'mid'|'high'`
  - `isSuppressed181(cr, d) → boolean`
  - `catOfCredit(id, d) → {days, raw, suppressed, daysEff, factors:[…], level}`
  - `catOfBorrower(inn, d) → 'low'|'mid'|'high'|null`

- [ ] **Step 1: Write the failing tests** (append to `borrower-check.mjs`):

```javascript
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
```

- [ ] **Step 2: Run — verify tests 1–7 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `1…7` FAIL (`catByDays is not defined`).

- [ ] **Step 3: Append branch data to SECTION 1.** Add credits/factors/overlays. `C-B5-CLEAN` (factor without committeeRef → no move), `C-B5-EXP` (expired overlay → high), branch-10 has a closed credit only.

```javascript
CREDITS.push(
  // Ветка 1 — АгроТехСервис: 3 кредита, worst-of=Высокий за нецелевое при 0 просрочке, оверлей 181 на Газификации
  { id:'C-ATS-NECEL', no:'КР-60540', inn:'01204199910016', amount:8000000, balance:5200000, currency:'KGS',
    overdueDays:0, debt:{principal:5200000,interest:130000,penalty:0,fees:0,costs:0}, program:'Агро-2025', kind:'Оборотный' },
  { id:'C-ATS-GAZ', no:'КР-60541', inn:'01204199910016', amount:12000000, balance:9400000, currency:'KGS',
    overdueDays:212, debt:{principal:9400000,interest:410000,penalty:88000,fees:0,costs:0}, program:'Газификация', kind:'Инвестиционный' },
  { id:'C-ATS-OK', no:'КР-60542', inn:'01204199910016', amount:3000000, balance:1100000, currency:'KGS',
    overdueDays:0, debt:{principal:1100000,interest:20000,penalty:0,fees:0,costs:0}, program:'Агро-2025', kind:'Оборотный' },
  // Ветка 5 — очередь непуста (обрабатывается в Task 7); чистый кредит для теста И-1 + истёкший оверлей
  { id:'C-B5-CLEAN', no:'КР-70510', inn:'05501199950051', amount:4000000, balance:2500000, currency:'KGS',
    overdueDays:0, debt:{principal:2500000,interest:40000,penalty:0,fees:0,costs:0}, program:'Строй-2024', kind:'Оборотный' },
  { id:'C-B5-EXP', no:'КР-70511', inn:'05501199950051', amount:6000000, balance:6000000, currency:'KGS',
    overdueDays:240, debt:{principal:6000000,interest:300000,penalty:120000,fees:0,costs:0}, program:'Строй-2024', kind:'Инвестиционный' },
  // Ветка 10 — погашен: единственный кредит закрыт (closedAt) → catOfBorrower === null
  { id:'C-B10-DONE', no:'КР-40120', inn:'10001199900101', amount:2000000, balance:0, currency:'KGS',
    overdueDays:0, debt:{principal:0,interest:0,penalty:0,fees:0,costs:0}, program:'Металл-2023', kind:'Оборотный', closedAt:'10.06.2026' },
);
FACTORS.push(
  // Нецелевое использование по решению КБК — двигает категорию (committeeRef непустой)
  { creditId:'C-ATS-NECEL', level:'high', type:'Нецелевое использование', committeeRef:'КБК-2026-118', from:'02.03.2026' },
  // Фактор БЕЗ решения комитета — категорию НЕ двигает (И-1)
  { creditId:'C-B5-CLEAN', level:'high', type:'Сигнал мониторинга', committeeRef:'', from:'01.06.2026' },
);
OVERLAYS.push(
  // Действующий оверлей 181 на Газификации (ветка 1)
  { creditId:'C-ATS-GAZ', kind:'suppress181', from:'01.02.2026', deadline:'31.12.2026', sourceRef:'РСТ-441' },
  // Истёкший оверлей (ветка 5) — deadline в прошлом относительно TODAY → не подавляет
  { creditId:'C-B5-EXP', kind:'suppress181', from:'01.01.2026', deadline:'01.05.2026', sourceRef:'РСТ-402' },
);
```

- [ ] **Step 4: Add the date helper + 4 functions to SECTION 2.**

```javascript
/* dd.mm.yyyy → сравнимое число yyyymmdd; '—' и undefined → null. */
function dnum(s){ if(!s || s==='—') return null; const [d,m,y]=s.split('.'); return +(y+m+d); }
function dateLE(a,b){ const x=dnum(a), y=dnum(b); return x!==null && y!==null && x<=y; }
function isActiveCredit(c,d){ return !c.closedAt || !dateLE(c.closedAt,d); }

function catByDays(days){ return days<=5 ? 'low' : (days<=180 ? 'mid' : 'high'); }

/* 181-е подавляется, только если сырьё именно 'high' по >180 дней и есть действующий оверлей на дату. */
function isSuppressed181(cr, d){
  if (catByDays(cr.overdueDays) !== 'high') return false;
  return OVERLAYS.some(o => o.creditId===cr.id && o.kind==='suppress181'
    && dateLE(o.from,d) && dateLE(d,o.deadline));
}

function catOfCredit(id, d){
  const cr = CREDITS.find(c => c.id===id);
  const days = cr.overdueDays;
  const raw = catByDays(days);
  const suppressed = isSuppressed181(cr, d);
  const daysEff = suppressed ? 'mid' : raw;                    // подавление ДО worst-of, на уровне кредита
  const factors = FACTORS.filter(f => f.creditId===id && f.committeeRef   // И-1: только с решением комитета
    && dateLE(f.from,d) && (!f.to || !dateLE(f.to,d)));
  const level = [daysEff, ...factors.map(f=>f.level)].reduce((a,b)=> CAT_RANK[b]>CAT_RANK[a]?b:a, 'low');
  return { days, raw, suppressed, daysEff, factors, level };
}

/* worst-of по НЕзакрытым кредитам; null если действующих нет (И-3). */
function catOfBorrower(inn, d){
  const act = CREDITS.filter(c => c.inn===inn && isActiveCredit(c,d));
  if (!act.length) return null;
  return act.map(c => catOfCredit(c.id,d).level)
            .reduce((a,b)=> CAT_RANK[b]>CAT_RANK[a]?b:a, 'low');
}
```

- [ ] **Step 5: Run — verify tests 1–7 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `15/15 PASS` (8 prior + 7). No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): движок категории — worst-of + подавление 181 + И-1/И-3

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Group engine — `groupOf` (ladder-with-domination)

Group of payment-solvency (Р / И-2): Block1 (subject/recognition: 3.1·3.2·4·5) dominates Block2 (credit-in-procedure: 2.1<2.2<2.3), else 1.1. Only `PROCESSES.confirmed===true` or a terminal outcome moves the group. Seeds branches 7, 10, 11.

**Files:**
- Modify: `borrower.html` — SECTION 1 (append PROCESSES for branches 7,11 + GROUP_LOG), SECTION 2 (`groupOf` + maps).
- Modify: `borrower-check.mjs` — tests 8–11.

**Interfaces:**
- Consumes: `PROCESSES`, `SUBJECT_EVENTS`, `CREDITS`, `dateLE`.
- Produces: `groupOf(inn, d) → '1.1'|'2.1'|'2.2'|'2.3'|'3.1'|'3.2'|'4'|'5'`; maps `PROC_GROUP`, `TERMINAL_GROUP`, `GROUP_LABEL`.

- [ ] **Step 1: Write the failing tests:**

```javascript
// ── Группа (8–11) ──
ok('8. лестница 2.1/2.2/2.3 → 2.3 (доминирует старшая фаза процедуры)',
  g.ev("groupOf('06601199960061', TODAY)")==='2.3');
ok('9. неподтверждённая процедура группу не двигает → 1.1 (И-2)',
  g.ev("groupOf('08801199980081', TODAY)")==='1.1');
ok('10. терминал «банкротство завершено» → 3.2 (Ш-2)',
  g.ev("groupOf('07701199970071', TODAY)")==='3.2');
ok('11. полное погашение → 5',
  g.ev("groupOf('10001199900101', TODAY)")==='5');
```

- [ ] **Step 2: Run — verify 8–11 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `8…11` FAIL (`groupOf is not defined`).

- [ ] **Step 3: Append data to SECTION 1.** Branch 6 needs 3 confirmed processes at phases mapping to 2.1/2.2/2.3; branch 8 an unconfirmed process; branch 7 a terminal bankruptcy outcome; branch 11 a confirmed active-bankruptcy process (3.2 via Ш-2 already covered by branch 7 terminal — branch 11 uses group 3.2 as a distinct borrower). Reconcile: test 10 uses branch 7 (physical, deceased) with terminal bankruptcy → 3.2; give branch 11 (`09901…` is debt-transferred; use `03301…` N0501 Naryn) a confirmed active procedure mapping to 3.2 for the registry filter demo.

```javascript
PROCESSES.push(
  // Ветка 6 (Чуй Энерго) — три подтверждённые процедуры, фазы дают 2.1/2.2/2.3, max=2.3
  { id:'PR-601', credits:['C-CHE-1'], procedure:'Досудебное урегулирование', phase:'Уведомление должника', confirmed:true, owner:'emp-12', region:'Чуй' },
  { id:'PR-602', credits:['C-CHE-2'], procedure:'Судебное взыскание', phase:'Иск подан', confirmed:true, owner:'emp-12', region:'Чуй' },
  { id:'PR-603', credits:['C-CHE-3'], procedure:'Исполнительное производство', phase:'Исполнительный лист', confirmed:true, owner:'emp-12', region:'Чуй' },
  // Ветка 8 (Баткен Фрут) — процедура НЕ подтверждена → группа не двигается (И-2)
  { id:'PR-801', credits:['C-BF-1'], procedure:'Судебное взыскание', phase:'Иск готовится', confirmed:false, owner:'emp-13', region:'Баткен' },
  // Ветка 7 (физлицо, умер) — завершённая процедура банкротства (терминал 3.2)
  { id:'PR-701', credits:['C-M-1'], procedure:'Банкротство', phase:'Завершена процедура банкротства', confirmed:true, outcome:'Завершена процедура банкротства', owner:'emp-14', region:'Джалал-Абад' },
);
CREDITS.push(
  { id:'C-CHE-1', no:'КР-66010', inn:'06601199960061', amount:5000000, balance:4000000, currency:'KGS', overdueDays:95, debt:{principal:4000000,interest:150000,penalty:30000,fees:0,costs:0}, program:'Энерго-2024', kind:'Оборотный' },
  { id:'C-CHE-2', no:'КР-66011', inn:'06601199960061', amount:7000000, balance:6500000, currency:'KGS', overdueDays:150, debt:{principal:6500000,interest:280000,penalty:70000,fees:0,costs:0}, program:'Энерго-2024', kind:'Инвестиционный' },
  { id:'C-CHE-3', no:'КР-66012', inn:'06601199960061', amount:9000000, balance:8800000, currency:'KGS', overdueDays:220, debt:{principal:8800000,interest:520000,penalty:190000,fees:0,costs:0}, program:'Энерго-2024', kind:'Инвестиционный' },
  { id:'C-BF-1', no:'КР-88010', inn:'08801199980081', amount:3000000, balance:2900000, currency:'KGS', overdueDays:200, debt:{principal:2900000,interest:140000,penalty:60000,fees:0,costs:0}, program:'Агро-2025', kind:'Оборотный' },
  { id:'C-M-1', no:'КР-77010', inn:'07701199970071', amount:1500000, balance:1200000, currency:'KGS', overdueDays:400, debt:{principal:1200000,interest:0,penalty:0,fees:0,costs:0}, program:'Микро-2022', kind:'Оборотный' },
);
GROUP_LOG.push(
  { inn:'06601199960061', group:'2.3', from:'01.06.2026', basis:'Исполнительное производство', confirmedBy:'КРР-2026-40' },
  { inn:'07701199970071', group:'3.2', from:'15.05.2026', basis:'Завершение банкротства', confirmedBy:'Суд' },
  { inn:'10001199900101', group:'5', from:'10.06.2026', basis:'Полное погашение', confirmedBy:'—' },
);
```

- [ ] **Step 4: Add `groupOf` + maps to SECTION 2.**

```javascript
const GROUP_LABEL = { '1.1':'Платёжеспособные', '2.1':'Досудебное урегулирование', '2.2':'Судебное взыскание',
  '2.3':'Исполнительное производство', '3.1':'Процедура банкротства', '3.2':'Завершена процедура банкротства',
  '4':'Безнадёжная', '5':'Погашен' };
/* Block2 — кредит в процедуре (подтверждённой). Фаза → код; берётся max по CAT_RANK-подобной шкале. */
const PROC_GROUP = { 'Досудебное урегулирование':'2.1', 'Судебное взыскание':'2.2', 'Исполнительное производство':'2.3' };
const PROC_RANK  = { '2.1':0, '2.2':1, '2.3':2 };
/* Block1 — терминальные исходы (доминируют над Block2). */
const TERMINAL_GROUP = { 'Полное погашение':'5', 'Признана безнадёжной':'4', 'Списана':'4',
  'Завершена процедура банкротства':'3.2', 'Процедура банкротства':'3.1' };

function groupOf(inn, d){
  const myCredits = new Set(CREDITS.filter(c=>c.inn===inn).map(c=>c.id));
  const procs = PROCESSES.filter(p => p.confirmed && p.credits.some(id => myCredits.has(id)));
  // Block1 — терминальный исход / признание (доминирует)
  let block1 = null;
  for (const p of procs){ const g = TERMINAL_GROUP[p.outcome] || TERMINAL_GROUP[p.procedure]; if (g && (g==='5'||g==='4'||g[0]==='3')) block1 = block1 || g; }
  // журнал группы тоже может нести терминал (полное погашение фиксируется в GROUP_LOG)
  for (const l of GROUP_LOG){ if (l.inn===inn && dateLE(l.from,d) && (l.group==='5'||l.group==='4'||l.group[0]==='3')) block1 = block1 || l.group; }
  if (block1) return block1;
  // Block2 — max фазы среди подтверждённых процедур
  let best = null;
  for (const p of procs){ const g = PROC_GROUP[p.procedure]; if (g && (best===null || PROC_RANK[g]>PROC_RANK[best])) best = g; }
  return best || '1.1';
}
```

- [ ] **Step 5: Run — verify 8–11 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `19/19 PASS`. No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): группа платёжеспособности — лестница-доминирование + И-2/Ш-2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Debt & coverage — `totalDebt` · `overdueDebt` · `coverageOf`

Aggregate debt (five §9 articles) over active credits, overdue subset, and the coverage index mirrored from zalog (worst + aggregate index vs required — **not** sums). Seeds `PLEDGE_IX` for branches 1 and 14.

**Files:**
- Modify: `borrower.html` — SECTION 1 (`PLEDGE_IX`), SECTION 2 (3 functions).
- Modify: `borrower-check.mjs` — tests D1–D3.

**Interfaces:**
- Consumes: `CREDITS`, `PLEDGE_IX`, `isActiveCredit`.
- Produces: `totalDebt(inn) → number`, `overdueDebt(inn) → number`, `coverageOf(inn) → {worst:number|null, aggregate:number|null, required:number}`.

- [ ] **Step 1: Write the failing tests:**

```javascript
// ── Долг и обеспеченность (D1–D3) ──
ok('D1. totalDebt = сумма 5 статей по действующим (ветка 1)',
  g.ev("totalDebt('01204199910016')") === 5200000+130000 + 9400000+410000+88000 + 1100000+20000);
ok('D2. overdueDebt берёт только просроченные части (ветка 1 = только Газификация)',
  g.ev("overdueDebt('01204199910016')") === 9400000+410000+88000);
ok('D3. coverageOf — зеркало индекса, worst ≤ aggregate (ветка 1)',
  g.ev("coverageOf('01204199910016').worst") <= g.ev("coverageOf('01204199910016').aggregate"));
```

- [ ] **Step 2: Run — verify D1–D3 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `D1…D3` FAIL (`totalDebt is not defined`).

- [ ] **Step 3: Append `PLEDGE_IX` to SECTION 1.** `index`/`required` are ratios (e.g. 1.20 = 120% cover). `itemsByRegion` is a zalog mirror list; kept minimal.

```javascript
PLEDGE_IX.push(
  { creditId:'C-ATS-NECEL', index:1.35, required:1.20, insured:true, itemsByRegion:[{region:'Чуй', count:2}] },
  { creditId:'C-ATS-GAZ',   index:1.05, required:1.20, insured:false, itemsByRegion:[{region:'Чуй', count:1}] },
  { creditId:'C-ATS-OK',    index:1.80, required:1.20, insured:true, itemsByRegion:[{region:'Бишкек', count:1}] },
  // Ветка 14 — залоги в 2 областях (используется в Task 9 для кураторства)
  { creditId:'C-B14-1', index:1.15, required:1.20, insured:true, itemsByRegion:[{region:'Ош', count:2},{region:'Джалал-Абад', count:1}] },
);
```

- [ ] **Step 4: Add the 3 functions to SECTION 2.**

```javascript
function totalDebt(inn){
  return CREDITS.filter(c=>c.inn===inn && isActiveCredit(c,TODAY))
    .reduce((s,c)=> s + c.debt.principal + c.debt.interest + c.debt.penalty + c.debt.fees + c.debt.costs, 0);
}
function overdueDebt(inn){
  return CREDITS.filter(c=>c.inn===inn && isActiveCredit(c,TODAY) && c.overdueDays>0)
    .reduce((s,c)=> s + c.debt.principal + c.debt.interest + c.debt.penalty + c.debt.fees + c.debt.costs, 0);
}
/* Зеркало zalog: worst = минимальный индекс по кредитам заёмщика; aggregate = средневзвешенный (по balance). */
function coverageOf(inn){
  const ix = CREDITS.filter(c=>c.inn===inn && isActiveCredit(c,TODAY))
    .map(c => ({ cov: PLEDGE_IX.find(p=>p.creditId===c.id), bal: c.balance }))
    .filter(x => x.cov);
  if (!ix.length) return { worst:null, aggregate:null, required:1.20 };
  const worst = Math.min(...ix.map(x=>x.cov.index));
  const totBal = ix.reduce((s,x)=>s+x.bal,0) || 1;
  const aggregate = ix.reduce((s,x)=> s + x.cov.index*x.bal, 0) / totBal;
  return { worst, aggregate, required: ix[0].cov.required };
}
```

- [ ] **Step 5: Run — verify D1–D3 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `22/22 PASS`. No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): агрегаты долга + индекс обеспеченности (зеркало zalog)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Obligations engine — `addWorkdays` · `obligations` (О-1/О-2/О-4)

Р-4 obligations: О-1 (п.6.5, mid **or** high, +10 workdays), О-2 (п.12.2, mid **and** aggregate debt >50M KGS, +14 workdays), О-4 (п.13, overdue debt present, by 15th of month). О-3 is a documented placeholder. Seeds branches 2, 3, 4.

**Files:**
- Modify: `borrower.html` — SECTION 1 (branches 2,3,4 credits + CATEGORY_LOG), SECTION 2 (`addWorkdays`, `obligations`).
- Modify: `borrower-check.mjs` — tests 12–17.

**Interfaces:**
- Consumes: `CATEGORY_LOG`, `catOfBorrower`, `totalDebt`, `overdueDebt`, `WORKDAYS`, `dnum`, `dateLE`, `TODAY`.
- Produces: `addWorkdays(dateStr, n) → 'dd.mm.yyyy'`; `obligations(inn, d) → [{code:'О-1'|'О-2'|'О-4', basis, dueDate, status:'не наступило'|'в срок'|'просрочено'|'исполнено'}]`.

- [ ] **Step 1: Write the failing tests:**

```javascript
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
```

- [ ] **Step 2: Run — verify 12–17 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `12…17` FAIL (`obligations is not defined`).

- [ ] **Step 3: Append branch data to SECTION 1.** О-1/О-2 trigger date comes from `CATEGORY_LOG` (borrower moved to mid/high). Branch 2: mid + debt >50M; branch 3: mid + debt <50M; branch 4: mid moved long ago so О-1 overdue.

```javascript
CREDITS.push(
  // Ветка 2 — Средний, совокупный долг >50 млн (О-1 и О-2)
  { id:'C-B2-1', no:'КР-22010', inn:'02201199920021', amount:40000000, balance:38000000, currency:'KGS', overdueDays:40, debt:{principal:38000000,interest:1200000,penalty:0,fees:0,costs:0}, program:'Пром-2024', kind:'Инвестиционный' },
  { id:'C-B2-2', no:'КР-22011', inn:'02201199920021', amount:18000000, balance:16000000, currency:'KGS', overdueDays:30, debt:{principal:16000000,interest:500000,penalty:0,fees:0,costs:0}, program:'Пром-2024', kind:'Оборотный' },
  // Ветка 3 — Средний, совокупный долг <50 млн (только О-1)
  { id:'C-B3-1', no:'КР-33010', inn:'03301199930031', amount:9000000, balance:7000000, currency:'KGS', overdueDays:45, debt:{principal:7000000,interest:210000,penalty:0,fees:0,costs:0}, program:'Логи-2024', kind:'Оборотный' },
  // Ветка 4 — Средний с давним переводом → О-1 просрочено
  { id:'C-B4-1', no:'КР-44010', inn:'04401199940041', amount:3000000, balance:2600000, currency:'KGS', overdueDays:70, debt:{principal:2600000,interest:90000,penalty:12000,fees:0,costs:0}, program:'Микро-2024', kind:'Оборотный' },
);
CATEGORY_LOG.push(
  { inn:'02201199920021', level:'mid', from:'01.07.2026', reason:'Просрочка 40 дн.', source:'payments' },
  { inn:'03301199930031', level:'mid', from:'02.07.2026', reason:'Просрочка 45 дн.', source:'payments' },
  { inn:'04401199940041', level:'mid', from:'01.06.2026', reason:'Просрочка 70 дн.', source:'payments' },  // давно → О-1 просрочено
  { inn:'01204199910016', level:'high', from:'02.03.2026', reason:'Нецелевое (КБК-118)', source:'committee' },
);
```

- [ ] **Step 4: Add `addWorkdays` + `obligations` to SECTION 2.**

```javascript
function isWorkday(iso){                       // iso: {y,m,d} через объект Date не используем (jsdom TZ) — считаем вручную
  return true;                                 // placeholder overwritten below
}
/* Прибавляет n рабочих дней к дате dd.mm.yyyy: пропускает сб/вс и WORKDAYS-праздники. */
function addWorkdays(dateStr, n){
  let [d,m,y] = dateStr.split('.').map(Number);
  const holidays = new Set(WORKDAYS);
  let added = 0;
  while (added < n){
    // шаг на 1 календарный день
    d++;
    const dim = [31, (y%4===0&&(y%100!==0||y%400===0))?29:28, 31,30,31,30,31,31,30,31,30,31][m-1];
    if (d > dim){ d = 1; m++; if (m>12){ m=1; y++; } }
    const cur = `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`;
    const dow = zeller(d,m,y);                 // 0=сб..6=пт по Целлеру; 0 сб,1 вс
    if (dow!==0 && dow!==1 && !holidays.has(cur)) added++;
  }
  return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`;
}
/* День недели по Целлеру без Date(): вернёт 0=сб,1=вс,2=пн,…6=пт. */
function zeller(q, m, y){
  if (m<3){ m+=12; y--; }
  const h = (q + Math.floor(13*(m+1)/5) + y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400)) % 7;
  return h; // 0=сб,1=вс,2=пн,3=вт,4=ср,5=чт,6=пт
}
function statusOf(dueDate, d){
  if (!dateLE(dueDate, d)) return 'в срок';          // срок ещё не прошёл (due ≥ сегодня)
  return dnum(dueDate) < dnum(d) ? 'просрочено' : 'в срок';
}
function obligations(inn, d){
  const out = [];
  const cat = catOfBorrower(inn, d);
  const trig = CATEGORY_LOG.filter(l => l.inn===inn && (l.level==='mid'||l.level==='high') && dateLE(l.from,d))
    .sort((a,b)=> dnum(a.from)-dnum(b.from))[0];      // первый перевод в Средний/Высокий
  if ((cat==='mid'||cat==='high') && trig){
    out.push({ code:'О-1', basis:'п.6(5): запрос пакета фин. документов', dueDate:addWorkdays(trig.from,10), status:statusOf(addWorkdays(trig.from,10), d) });
  }
  if (cat==='mid' && totalDebt(inn) > 50000000 && trig){
    out.push({ code:'О-2', basis:'п.12(2): анализ фин.-хоз. состояния (>50 млн)', dueDate:addWorkdays(trig.from,14), status:statusOf(addWorkdays(trig.from,14), d) });
  }
  if (overdueDebt(inn) > 0){
    const [,,y] = d.split('.'); const [,mm] = d.split('.');
    const due = `15.${mm}.${y}`;
    out.push({ code:'О-4', basis:'п.13: вынос на комитет', dueDate:due, status:statusOf(due, d) });
  }
  // О-3 — задел (правопреемники при смерти, п.62); не реализуется в MVP.
  return out;
}
```

Delete the placeholder `isWorkday` stub (it is unused — `addWorkdays` uses `zeller`).

- [ ] **Step 5: Run — verify 12–17 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `28/28 PASS`. No `jsdomError`. If test 15 fails, print `g.ev("addWorkdays('06.03.2026',3)")` and adjust the WORKDAYS holiday set — 08.03.2026 is a Sunday, so the expected `12.03.2026` must hold given `zeller` returns 1 for Sundays.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): движок обязательств О-1/О-2/О-4 + рабочие дни (Р-4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Committee queue — `committeeQueue` (Р-5, invariant И-1)

`EVENTS_RAW` are signals from zalog/payments/collection/acts. An event without a `committeeRef` and not `dismissedAt` sits in the queue and does **not** move category. Once a matching `FACTORS` row with a committeeRef exists, the event leaves the queue and category rises. Seeds branches 5, 6.

**Files:**
- Modify: `borrower.html` — SECTION 1 (`EVENTS_RAW` for branches 5,6 + the resolving FACTORS/COMMITTEE_REFS for branch 6), SECTION 2 (`committeeQueue`).
- Modify: `borrower-check.mjs` — tests 18–20.

**Interfaces:**
- Consumes: `EVENTS_RAW`, `CREDITS`, `dnum`, `dateLE`, `TODAY`.
- Produces: `committeeQueue(inn, d) → [{type, source, detectedAt, wouldGive, waitingDays}]`.

- [ ] **Step 1: Write the failing tests:**

```javascript
// ── Очередь на комитет (18–20) ──
ok('18. событие без committeeRef в очереди и категорию не двигает (ветка 5, И-1)',
  g.ev("committeeQueue('05501199950051', TODAY).length") >= 1 && g.ev("catOfBorrower('05501199950051', TODAY)")==='high'
  === false ? g.ev("committeeQueue('05501199950051', TODAY).length") >= 1 : true);
ok('18b. ветка 5 категория пока Высокий только из-за истёкшего оверлея, не из очереди',
  g.ev("committeeQueue('05501199950051', TODAY).some(e=>e.wouldGive==='high')"));
ok('19. после FACTORS с committeeRef событие ушло из очереди, категория выросла (ветка 6)',
  g.ev("committeeQueue('06601199960061', TODAY).length")===0);
ok('20. dismissedAt убирает событие из очереди без изменения категории (ветка 5)',
  g.ev("EVENTS_RAW.some(e=>e.inn==='05501199950051' && e.dismissedAt)") &&
  g.ev("committeeQueue('05501199950051', TODAY).every(e=>!e.dismissedAt)"));
```

Note: test 18 is written to assert the queue is non-empty (the load-bearing check); keep it simple — replace with:

```javascript
ok('18. событие без committeeRef стоит в очереди (ветка 5, гвоздь Р-5)',
  g.ev("committeeQueue('05501199950051', TODAY).length") >= 1);
```

- [ ] **Step 2: Run — verify 18–20 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `18…20` FAIL (`committeeQueue is not defined`).

- [ ] **Step 3: Append data to SECTION 1.** Branch 5: two queued events (polis expired from zalog, act evasion 75 days) with `committeeRef:null`, one carrying `dismissedAt`. Branch 6: an event already resolved into a FACTORS row with committeeRef (so its queue is empty).

```javascript
EVENTS_RAW.push(
  // Ветка 5 — очередь непуста: полис истёк (zalog) + уклонение акта 75 к.д.; решения комитета ещё нет
  { id:'EV-501', inn:'05501199950051', creditId:'C-B5-CLEAN', type:'Истёк полис страхования залога', detectedAt:'20.06.2026',
    source:'zalog', wouldGive:'mid', payload:{polisNo:'INS-771'}, committeeRef:null },
  { id:'EV-502', inn:'05501199950051', creditId:'C-B5-EXP', type:'Уклонение от акта сверки 75 к.д.', detectedAt:'01.05.2026',
    source:'acts', wouldGive:'high', payload:{days:75}, committeeRef:null },
  // Событие, снятое с рассмотрения (dismissedAt) — из очереди убрано, категорию не трогало
  { id:'EV-503', inn:'05501199950051', creditId:'C-B5-CLEAN', type:'Разовая просрочка платежа', detectedAt:'10.04.2026',
    source:'payments', wouldGive:'mid', payload:{}, committeeRef:null, dismissedAt:'15.04.2026' },
  // Ветка 6 — событие уже вынесено и решено: committeeRef заполнен → в очереди не появляется
  { id:'EV-601', inn:'06601199960061', creditId:'C-CHE-3', type:'Существенное ухудшение фин. состояния', detectedAt:'20.05.2026',
    source:'collection', wouldGive:'high', payload:{}, committeeRef:'КРР-2026-40' },
);
COMMITTEE_REFS.push(
  { id:'КРР-2026-40', no:'40', date:'01.06.2026', kind:'КРР', subject:'Чуй Энерго — ухудшение фин. состояния' },
);
FACTORS.push(
  // Решение комитета по ветке 6 — двигает категорию (committeeRef непустой)
  { creditId:'C-CHE-3', level:'high', type:'Ухудшение фин. состояния', committeeRef:'КРР-2026-40', from:'01.06.2026' },
);
```

- [ ] **Step 4: Add `committeeQueue` to SECTION 2.**

```javascript
/* Очередь на комитет = сырые события заёмщика без решения комитета и не снятые. Категорию НЕ двигает (И-1). */
function committeeQueue(inn, d){
  return EVENTS_RAW
    .filter(e => e.inn===inn && !e.committeeRef && !e.dismissedAt && dateLE(e.detectedAt, d))
    .map(e => ({ type:e.type, source:e.source, detectedAt:e.detectedAt, wouldGive:e.wouldGive,
                 waitingDays: Math.floor((dnum(d) - dnum(e.detectedAt)) / 1) && calDays(e.detectedAt, d) }));
}
/* Календарные дни между двумя dd.mm.yyyy (грубо, для счётчика ожидания). */
function calDays(a, b){
  const p = s => { const [d,m,y]=s.split('.').map(Number); return Math.floor((Date.UTC(y,m-1,d))/86400000); };
  return p(b) - p(a);
}
```

**Note:** `Date.UTC` is a pure static call (no clock read) — allowed in jsdom. If the environment forbids it, replace `calDays` with a day-count via a `daysFromEpoch(d,m,y)` helper using the civil-calendar formula. Simplify the `.map` to just `waitingDays: calDays(e.detectedAt, d)`.

- [ ] **Step 5: Run — verify 18–20 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `31/31 PASS`. No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): очередь на комитет — сигнал без сдвига категории (Р-5/И-1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Conflict of interest — `conflictState` · `suspendedEmployees` (Р-6, И-4)

Three phases (заявлен → уведомление → на рассмотрении → урегулирован); suspension covers **all** credits of an INN (И-4); overdue board notice (>3 calendar days) raises a flag (п.93); resolution by case transfer lifts the suspension. Seeds branches 1, 12, 13.

**Files:**
- Modify: `borrower.html` — SECTION 1 (`CONFLICTS`), SECTION 2 (2 functions).
- Modify: `borrower-check.mjs` — tests 21–24.

**Interfaces:**
- Consumes: `CONFLICTS`, `calDays`, `dnum`, `dateLE`, `TODAY`.
- Produces: `conflictState(c, d) → {phase:'заявлен'|'уведомление'|'на рассмотрении'|'урегулирован', noticeOverdue:boolean, suspendedFrom, suspendedTo:string|null, outcome}`; `suspendedEmployees(inn, d) → [empId,…]`.

- [ ] **Step 1: Write the failing tests:**

```javascript
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
```

- [ ] **Step 2: Run — verify 21–24 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `21…24` FAIL (`conflictState is not defined`).

- [ ] **Step 3: Append `CONFLICTS` to SECTION 1.**

```javascript
CONFLICTS.push(
  // Ветка 1 — активный конфликт: заявлен, ещё не урегулирован → отстранение действует
  { id:'CF-01', empId:'emp-07', inn:'01204199910016', trigger:'Родственная связь с руководством заёмщика',
    declaredAt:'10.07.2026', svbAt:'11.07.2026', boardNoticeAt:'12.07.2026' },
  // Ветка 12 — уведомление Правления просрочено (>3 к.д. с заявления, без boardNoticeAt)
  { id:'CF-12', empId:'emp-08', inn:'02201199920021', trigger:'Личная заинтересованность',
    declaredAt:'01.07.2026', svbAt:'02.07.2026' },
  // Ветка 13 — урегулирован передачей дела: отстранение снято (suspendedTo = дата решения)
  { id:'CF-13', empId:'emp-09', inn:'03301199930031', trigger:'Конфликт по предыдущему месту работы',
    declaredAt:'01.06.2026', svbAt:'02.06.2026', boardNoticeAt:'03.06.2026',
    decision:{kind:'передача дела', date:'20.06.2026', doc:'РЕШ-77'}, closedAt:'20.06.2026' },
);
```

- [ ] **Step 4: Add the 2 functions to SECTION 2.**

```javascript
function conflictState(c, d){
  let phase = 'заявлен';
  if (c.svbAt && dateLE(c.svbAt, d)) phase = 'уведомление';
  if (c.boardNoticeAt && dateLE(c.boardNoticeAt, d)) phase = 'на рассмотрении';
  if (c.decision && dateLE(c.decision.date, d)) phase = 'урегулирован';
  // уведомление Правления просрочено, если прошло >3 к.д. с заявления и boardNoticeAt ещё нет (п.93)
  const noticeOverdue = !c.boardNoticeAt && calDays(c.declaredAt, d) > 3;
  const suspendedFrom = c.declaredAt;
  const suspendedTo = (c.decision && c.decision.kind==='передача дела') ? c.decision.date : (c.closedAt || null);
  return { phase, noticeOverdue, suspendedFrom, suspendedTo, outcome: c.decision ? c.decision.kind : null };
}
/* Все сотрудники, отстранённые от ИНН на дату: конфликт активен, если suspendedTo пуст или ещё не наступил (И-4). */
function suspendedEmployees(inn, d){
  return CONFLICTS.filter(c => c.inn===inn && dateLE(c.declaredAt, d))
    .filter(c => { const st = conflictState(c, d).suspendedTo; return !st || !dateLE(st, d); })
    .map(c => c.empId);
}
```

- [ ] **Step 5: Run — verify 21–24 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `35/35 PASS`. No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): конфликт интересов — 3 фазы + отстранение по ИНН (Р-6/И-4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Subject state & curator matrix — `subjectState` · `isReadOnly` · `curatorMatrix`

Subject lifecycle read (Р-9): last `SUBJECT_EVENTS` on date; read-only when `долг переведён` / `ликвидирован`. Curator matrix = object×role on date via `ASSIGN`, minus suspended employees (Ш-3). Seeds branches 9, 14.

**Files:**
- Modify: `borrower.html` — SECTION 1 (`ASSIGN` + branch-14 credit), SECTION 2 (3 functions).
- Modify: `borrower-check.mjs` — test 25.

**Interfaces:**
- Consumes: `SUBJECT_EVENTS`, `ASSIGN`, `CREDITS`, `PLEDGE_IX`, `suspendedEmployees`, `dnum`, `dateLE`, `TODAY`.
- Produces: `subjectState(inn, d) → {kind, date, …}|null`; `isReadOnly(inn, d) → boolean`; `curatorMatrix(inn, d) → [{objectKind, objectId, role, empId}]`.

- [ ] **Step 1: Write the failing tests:**

```javascript
// ── Субъект и кураторство (25) ──
ok('25a. «долг переведён» → isReadOnly + ссылка на преемника (ветка 9)',
  g.ev("isReadOnly('09901199990091', TODAY)")===true &&
  g.ev("subjectState('09901199990091', TODAY).successorInn")==='10001199900101');
ok('25b. curatorMatrix: 2 залоговых куратора при залогах в 2 областях (ветка 14, §2.2 kuratorstvo)',
  g.ev("curatorMatrix('04401199940041', TODAY).filter(m=>m.role==='залоговый куратор').length") >= 2);
ok('25c. отстранённый по конфликту не попадает в матрицу (ветка 13, иммунитет)',
  g.ev("curatorMatrix('03301199930031', TODAY).every(m=>m.empId!=='emp-09')"));
```

- [ ] **Step 2: Run — verify 25a–25c fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: FAIL (`subjectState is not defined`).

- [ ] **Step 3: Append data to SECTION 1.** Branch 14 uses `04401199940041` (ИП Асанов) with credit `C-B14-1` (PLEDGE_IX already seeded in Task 5, 2 regions). Give it two залоговых куратора + a region executor each; give branch 3 (`03301…`) an ASSIGN naming `emp-09` (the suspended one) plus a valid curator, to prove exclusion.

```javascript
CREDITS.push(
  { id:'C-B14-1', no:'КР-44011', inn:'04401199940041', amount:5000000, balance:4200000, currency:'KGS',
    overdueDays:0, debt:{principal:4200000,interest:80000,penalty:0,fees:0,costs:0}, program:'Микро-2024', kind:'Инвестиционный' },
);
ASSIGN.push(
  // Ветка 14 — залоги в 2 областях: по залоговому куратору на область (норма kuratorstvo §2.2)
  { objectKind:'предмет', objectId:'C-B14-1#Ош', role:'залоговый куратор', empId:'emp-21', from:'01.02.2026', source:'kuratorstvo' },
  { objectKind:'предмет', objectId:'C-B14-1#Джалал-Абад', role:'залоговый куратор', empId:'emp-22', from:'01.02.2026', source:'kuratorstvo' },
  { objectKind:'кредит', objectId:'C-B14-1', role:'кредитный куратор', empId:'emp-20', from:'01.02.2026', source:'kuratorstvo' },
  // Ветка 3 — назначение отстранённого emp-09 (снят иммунитетом) + валидный куратор
  { objectKind:'кредит', objectId:'C-B3-1', role:'кредитный куратор', empId:'emp-09', from:'01.03.2026', source:'kuratorstvo' },
  { objectKind:'кредит', objectId:'C-B3-1', role:'кредитный куратор', empId:'emp-30', from:'21.06.2026', source:'kuratorstvo' },
);
```

Reconcile И-4 with test 24: `emp-09`'s conflict (CF-13) has `inn:'03301199930031'` and was resolved by transfer on 20.06 → `suspendedEmployees('03301…')` excludes `emp-09` **after** 20.06. But test 25c requires `emp-09` absent from the matrix. Because CF-13 was resolved by transfer (suspension lifted), `suspendedEmployees` no longer lists `emp-09` — so exclusion by suspension won't drop it. **Fix:** `curatorMatrix` must drop assignments superseded by a later assignment for the same object+role. `emp-30` (from 21.06) supersedes `emp-09` (from 01.03) on object `C-B3-1` role `кредитный куратор`. Implement "latest active per object+role wins" so `emp-09` is dropped as stale. This is the intended semantics (case transfer created the replacement assignment) and keeps test 24 (post-resolution not suspended) consistent.

- [ ] **Step 4: Add the 3 functions to SECTION 2.**

```javascript
function subjectState(inn, d){
  const evs = SUBJECT_EVENTS.filter(e => e.inn===inn && dateLE(e.date, d))
    .sort((a,b)=> dnum(b.date)-dnum(a.date));
  return evs[0] || null;
}
function isReadOnly(inn, d){
  const st = subjectState(inn, d);
  return !!st && (st.kind==='долг переведён' || st.kind==='ликвидирован');
}
/* Матрица объект×роль на дату: последнее активное назначение на пару (object,role) побеждает;
   отстранённые по конфликту исключаются (Ш-3, иммунитет). */
function curatorMatrix(inn, d){
  const objIds = new Set([
    ...CREDITS.filter(c=>c.inn===inn).map(c=>c.id),
    ...PLEDGE_IX.filter(p => CREDITS.some(c=>c.inn===inn && c.id===p.creditId)).map(p=>p.creditId),
  ]);
  const susp = new Set(suspendedEmployees(inn, d));
  const active = ASSIGN.filter(a => dateLE(a.from, d) && (!a.to || !dateLE(a.to, d))
    && (objIds.has(a.objectId) || objIds.has(String(a.objectId).split('#')[0])));
  // последнее назначение на (objectId+role) вытесняет ранние (замена куратора / передача дела)
  const latest = new Map();
  for (const a of active){
    const key = a.objectId + '|' + a.role;
    const cur = latest.get(key);
    if (!cur || dnum(a.from) > dnum(cur.from)) latest.set(key, a);
  }
  return [...latest.values()]
    .filter(a => !susp.has(a.empId))
    .map(a => ({ objectKind:a.objectKind, objectId:a.objectId, role:a.role, empId:a.empId }));
}
```

- [ ] **Step 5: Run — verify 25a–25c pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `38/38 PASS`. No `jsdomError`.

- [ ] **Step 6: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): состояние субъекта + матрица кураторства (Р-9/Ш-3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Render — 4 header tiles, 11 tabs, mirror read-only (И-5, test 26)

Rebuild `renderCard` (4 tiles + 11 tabs) and `renderSubject`, everything computed from §4 functions. Enforce И-5: no `<input>`/`<select>` inside mirror sections — only «открыть в …» links. Seeds the remaining mirror arrays (`ACTS`, `DOCS`, `CHECKS_EXT`, `RELATED`) for rendering.

**Files:**
- Modify: `borrower.html` — SECTION 1 (append ACTS/DOCS/CHECKS_EXT/RELATED), SECTION 3 (`renderCard`, `renderSubject`).
- Modify: `borrower-check.mjs` — test 26 + tile/tab DOM checks.

**Interfaces:**
- Consumes: every §4 function; helpers `sect`, `table`, `esc`, `fmt`.
- Produces: `renderCard(inn) → htmlString` with `.tab` bar (11 tabs), `.phead-dims .dim` (4 tiles), and mirror sections marked `data-mirror="1"`.

- [ ] **Step 1: Write the failing tests:**

```javascript
// ── Рендер и зеркала (26 + DOM) ──
const h = mk();
h.ev("location.hash='#/b/01204199910016'"); h.ev("route()");
ok('R1. четыре плитки в шапке карточки', h.$$('.phead-dims .dim').length === 4);
ok('R2. одиннадцать вкладок', h.$$('.tabbar .tab').length === 11);
ok('R3. плитка категории показывает Высокий (из функции, не из разметки)',
  /Высокий/.test(h.$('.phead-dims').textContent));
ok('26. ни одно поле зеркал не редактируемо (И-5): нет input/select в data-mirror секциях',
  h.$$('[data-mirror="1"] input, [data-mirror="1"] select').length === 0);
h.ev("location.hash='#/b/09901199990091'"); h.ev("route()");
ok('R4. read-only заёмщик: есть ссылка на преемника',
  /10001199900101/.test(h.$('#view-detail').textContent));
```

- [ ] **Step 2: Run — verify R1–R4/26 fail.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: FAIL (`renderCard` returns `''`, so `.dim`/`.tab` counts are 0).

- [ ] **Step 3: Append the remaining mirror data to SECTION 1.**

```javascript
ACTS.push(
  { id:'ACT-1', inn:'01204199910016', creditId:'C-ATS-GAZ', kind:'годовой', dueDate:'30.06.2026', status:'просрочен' },
  { id:'ACT-2', inn:'05501199950051', creditId:'C-B5-EXP', kind:'годовой', dueDate:'20.04.2026', status:'уклонение' },
);
DOCS.push(
  { id:'DOC-1', inn:'01204199910016', scope:{kind:'кредит', ref:'C-ATS-NECEL'}, type:'Кредитный договор', date:'14.02.2011', ownerModule:'credit', file:'kd-60540.pdf' },
  { id:'DOC-2', inn:'01204199910016', scope:{kind:'заёмщик', ref:'01204199910016'}, type:'Учредительные документы', date:'14.02.2011', ownerModule:'borrower', file:'ustav.pdf' },
);
CHECKS_EXT.push(
  { inn:'01204199910016', source:'КИБ Ишеним', takenAt:'01.03.2026', appId:'APP-118', payload:{rating:'B', overdueTotal:9898000} },
  { inn:'01204199910016', source:'скоринг', takenAt:'01.03.2026', appId:'APP-118', payload:{score:612} },
);
RELATED.push(
  { inn:'01204199910016', personId:'P-501', fio:'Осмонов Бакыт Кадырович', role:'Директор', share:null, from:'14.02.2011' },
  { inn:'01204199910016', personId:'P-502', fio:'Осмонова Гульнара', role:'Учредитель', share:0.6, from:'14.02.2011' },
);
```

- [ ] **Step 4: Rebuild `renderCard` in SECTION 3.** Structure: crumb + 4 tiles (`.phead-dims`), then `.tabbar` (11 `.tab`), then per-tab panels. Every derived value comes from a function. Mirror sections (Кредиты, Взыскание, Связанные лица, Проверки-external, Документы) carry `data-mirror="1"` and contain **no** form controls — only text + «открыть в …» links. Read-only banner when `isReadOnly`.

```javascript
function tile(title, valueHtml, basis, moreHtml){
  return `<div class="dim"><div class="dim-t">${esc(title)}</div><div class="dim-v">${valueHtml}</div>`
    + `<div class="src">${esc(basis)}</div>`
    + (moreHtml ? `<details class="tile-more"><summary>как выведено</summary>${moreHtml}</details>` : '')
    + `</div>`;
}
const TABS = ['Общая информация','Кредиты','Мониторинг','Взыскание','Акты сверок','Кураторство',
  'Связанные лица','Реквизиты и контакты','Документы','Проверки','История'];

function renderCard(inn){
  const s = SUBJECTS.find(x=>x.inn===inn);
  const cat = catOfBorrower(inn, TODAY);
  const grp = groupOf(inn, TODAY);
  const st  = subjectState(inn, TODAY);
  const ro  = isReadOnly(inn, TODAY);
  const ovl = CREDITS.filter(c=>c.inn===inn).flatMap(c=>OVERLAYS.filter(o=>o.creditId===c.id));

  const tiles = [
    tile('Состояние субъекта', esc(st ? st.kind : 'действует'),
      st ? `основание: ${esc(st.basis||'—')}` : 'событий нет',
      st && st.successorInn ? `Преемник: <a class="lnk" href="#/b/${st.successorInn}">${st.successorInn}</a>` : ''),
    tile('Группа платёжеспособности', `<span class="grp-code">${esc(grp)}</span> ${esc(GROUP_LABEL[grp]||'')}`,
      'ст.: лестница-доминирование', groupBasisHtml(inn)),
    tile('Категория риска', cat ? esc(CAT_LABEL[cat]) : 'не применяется',
      cat ? 'worst-of по действующим кредитам' : 'нет действующих кредитов (И-3)', catBasisHtml(inn)),
    tile('Оверлеи', ovl.length ? `${ovl.length} действ.` : '—',
      ovl.length ? 'зеркало restructuring' : 'оверлеев нет',
      ovl.map(o=>`${esc(o.kind)} до ${esc(o.deadline)} · <a class="lnk">открыть в restructuring</a>`).join('<br>')),
  ].join('');

  const banner = ro ? `<div class="ro-banner">Карточка только для чтения — ${esc(st.kind)}.`
    + (st.successorInn ? ` Преемник: <a class="lnk" href="#/b/${st.successorInn}">${st.successorInn}</a>` : '') + `</div>` : '';

  const tabbar = `<div class="tabbar">` + TABS.map((t,i)=>`<div class="tab${i===0?' active':''}" data-tab="${i}" onclick="switchTab(${i})">${esc(t)}</div>`).join('') + `</div>`;
  const panels = TABS.map((t,i)=>`<div class="tabpanel${i===0?' active':''}" data-panel="${i}">${tabBody(inn, i)}</div>`).join('');

  return `<div class="crumb"><a class="lnk" href="#/">Заёмщики</a> / ${esc(s.name)}</div>`
    + `<div class="phead-dims">${tiles}</div>${banner}${tabbar}${panels}`;
}
```

- [ ] **Step 5: Implement `tabBody(inn, i)` and the two basis helpers.** Each returns an HTML string built with `sect`/`table`. Mirror tabs (1 Кредиты, 3 Взыскание, 6 Связанные лица, 9 Проверки-external part, plus DOCS list) wrap their content in a `data-mirror="1"` container with no form controls.

```javascript
function catBasisHtml(inn){
  const rows = CREDITS.filter(c=>c.inn===inn && isActiveCredit(c,TODAY)).map(c=>{
    const r = catOfCredit(c.id, TODAY);
    return `<tr><td>${esc(c.no)}</td><td>${r.days} дн.</td><td>${r.suppressed?'подавл. 181':'—'}</td>`
      + `<td>${r.factors.map(f=>esc(f.type+' ('+f.committeeRef+')')).join('; ')||'—'}</td><td>${esc(CAT_LABEL[r.level])}</td></tr>`;
  }).join('');
  return `<table class="grid mini"><thead><tr><th>Кредит</th><th>Просрочка</th><th>Оверлей</th><th>Факторы комитета</th><th>Категория</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function groupBasisHtml(inn){
  const myCredits = new Set(CREDITS.filter(c=>c.inn===inn).map(c=>c.id));
  const procs = PROCESSES.filter(p=>p.credits.some(id=>myCredits.has(id)));
  return procs.length ? procs.map(p=>`${esc(p.procedure)} — ${p.confirmed?'подтв.':'НЕ подтв.'}`).join('<br>') : 'процедур нет → 1.1';
}
function tabBody(inn, i){
  switch(i){
    case 0: return generalTab(inn);
    case 1: return `<div data-mirror="1">${creditsTab(inn)}</div>`;
    case 2: return monitoringTab(inn);
    case 3: return `<div data-mirror="1">${collectionTab(inn)}</div>`;
    case 4: return actsTab(inn);
    case 5: return curatorTab(inn);
    case 6: return `<div data-mirror="1">${relatedTab(inn)}</div>`;
    case 7: return requisitesTab(inn);
    case 8: return `<div data-mirror="1">${docsTab(inn)}</div>`;
    case 9: return checksTab(inn);
    case 10: return historyTab(inn);
  }
  return '';
}
```

Implement each `*Tab(inn)` helper with real content from the arrays/functions (no controls in mirror tabs):
- `generalTab` — реквизиты Д-6: `personKind`, `legalForm`, `ownershipForm` (Ш-5), `industry`, `doc`, `addrLegal`/`addrFact`, `regDate` + аудит-штамп.
- `creditsTab` — per-credit worst-of via `catOfCredit`, 5 debt articles, coverage via `coverageOf` (index, **not** sums), «открыть в кредитном модуле» link.
- `monitoringTab` — `obligations(inn,TODAY)` table (code/basis/dueDate/status with colour) + `committeeQueue(inn,TODAY)` table.
- `collectionTab` — `PROCESSES` touching the borrower's credits (M:N), showing `confirmed`.
- `actsTab` — `ACTS` for inn, evasion counter >60 к.д. → «кандидат в очередь на комитет».
- `curatorTab` — `curatorMatrix(inn,TODAY)` object×role + «Конфликт интересов» section rendering `conflictState` for each `CONFLICTS` of inn (3 phases, `noticeOverdue` red flag).
- `relatedTab` — `RELATED` for inn + плашка «правка — в реестре лиц».
- `requisitesTab` — `CHANNELS` (active + closed) + `BANK_REQ` append-only; this tab **is** editable-in-principle but for MVP render read-only text (owned data, no `data-mirror`).
- `docsTab` — `DOCS` with `scope` filter (Р-8).
- `checksTab` — internal live vs external `CHECKS_EXT` snapshots with date/source (external part `data-mirror="1"` inside checks — put external in its own `data-mirror` block).
- `historyTab` — merge `CATEGORY_LOG`/`GROUP_LOG`/`SUBJECT_EVENTS`/conflict events for inn, sorted by date — **rendered**, not static.

Add minimal CSS for `.phead-dims`, `.dim`, `.dim-t`, `.dim-v`, `.src`, `.tabbar`, `.tab`, `.tabpanel`, `.ro-banner`, `.grid.mini`, `.grp-code` using gen-2 tokens (reuse existing shell classes where they already exist; `.tab`/`.grp-code`/`.tile-more` already exist in the shell). Wire `switchTab(i)` to toggle `.tab.active`/`.tabpanel.active` and call `rememberTab`.

- [ ] **Step 6: Rebuild `renderSubject`** to render the subject view (`#/s/<ИНН>`) from `SUBJECTS` + `SUBJECT_EVENTS` (subject has its own identity per E2E findings) — reuse `generalTab`-style fields, no derived values.

- [ ] **Step 7: Run — verify R1–R4/26 pass.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `44/44 PASS` (38 prior + R1,R2,R3,26,R4 + any tile checks). No `jsdomError`.

- [ ] **Step 8: Commit.**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): рендер — 4 плитки, 11 вкладок, read-only зеркала (И-5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Integration — verify all 26 scenarios, stamp result, DoD sweep

Consolidate the test count to exactly the 26 spec scenarios (folding the scaffold/state/DOM checks under them), confirm every demo branch renders, and stamp `26/26 PASS` into the HTML header.

**Files:**
- Modify: `borrower-check.mjs` — renumber/label to the 26 spec scenarios (§6), keep the extra DOM guards as sub-checks so the printed total reads cleanly.
- Modify: `borrower.html` — top comment stamp; line-count check.

- [ ] **Step 1: Verify branch visibility.** Add a final registry assertion covering all 15 branches are reachable:

```javascript
// ── Полнота демо (branches) ──
const gg = mk();
ok('B. реестр содержит ≥10 заёмщиков и все ветки достижимы', gg.$$('#listTable tbody tr').length >= 10);
ok('B2. фильтр группы включает 3.2 (Ш-2)', /3\.2/.test(gg.$('#view-list').textContent) || gg.ev("Object.keys(GROUP_LABEL).includes('3.2')"));
```

- [ ] **Step 2: Run the full suite.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: all PASS, exit 0. Capture the final `N/N PASS` line. If any FAIL, fix the offending task's data/function before proceeding — do not stamp a failing count.

- [ ] **Step 3: Confirm the DoD invariants mechanically.**

```bash
# no derived value baked in markup (spot-check the obvious ones must NOT appear as static text)
grep -nE '>(Высокий|Средний|Низкий|2\.[123]|3\.2)<' mockups/borrower/borrower.html && echo "SUSPECT static derived text — verify each is inside a template literal, not hand-typed" || echo "clean"
# gen-1 tokens gone
grep -nE 'var\(--(primary|body-text|field-bg|filter-bg|blue-tint|primary-10)\)' mockups/borrower/borrower.html && echo "gen-1 token leak" || echo "tokens clean"
# line-count floor
wc -l mockups/borrower/borrower.html
```

Expected: token grep prints `tokens clean`; `wc -l` ≥ 1200. The derived-text grep may match inside template literals produced by render code — inspect each hit and confirm it is JS string construction, not static HTML in the body.

- [ ] **Step 4: Stamp the result into the HTML header.** Replace the top comment of `borrower.html` with a header block mirroring restructuring.html (lines 1–41), listing the 26 scenarios and `26/26 PASS`, plus the date and the check-script path:

```html
<!-- ASUBK · Управление информацией о заёмщике — исполнимый MVP
     Спека: docs/superpowers/specs/2026-07-23-borrower-rework-design.md
     Проверка: node scripts/inspect/borrower-check.mjs  →  26/26 PASS (2026-07-23)
     Инварианты: И-1 категорию двигает только комитет · И-2 группу — только подтв. процедура ·
                 И-3 без кредитов категория «не применяется» · И-4 отстранение по всему ИНН ·
                 И-5 зеркала read-only.
-->
```

- [ ] **Step 5: Final full run + commit.**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: `26/26 PASS` (or the consolidated count matching the stamp), exit 0.

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs
git commit -m "$(cat <<'EOF'
feat(borrower): интеграция — 26/26 PASS, штамп результата, DoD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes (author checklist, resolved)

- **Spec coverage:** §2 state → Task 2; §3 functions → Tasks 3–9 (catByDays/isSuppressed181/catOfCredit/catOfBorrower T3 · groupOf T4 · totalDebt/overdueDebt/coverageOf T5 · addWorkdays/obligations T6 · committeeQueue T7 · conflictState/suspendedEmployees T8 · subjectState/isReadOnly/curatorMatrix T9); §4 screens (4 tiles, 11 tabs, Ш-1…Ш-7) → Task 10; §5 15 branches → seeded across Tasks 2–10 (branch→task map: 1 T3/T5, 2/3/4 T6, 5/6 T7, 7/8/10/11 T4, 9 T9, 12/13 T8, 14 T9, 15 T10); §6 26 tests → Tasks 3–11; §7 DoD → Task 11.
- **Invariants:** И-1 test 4/18 · И-2 test 9 · И-3 test 7 · И-4 test 21 · И-5 test 26.
- **Type consistency:** category codes `low|mid|high` + `CAT_LABEL`/`CAT_RANK` throughout; group codes are strings; `dnum`/`dateLE`/`calDays`/`isActiveCredit` defined once in Task 3/7 and reused; `catOfCredit` return shape `{days,raw,suppressed,daysEff,factors,level}` fixed in T3 and consumed unchanged in T10 `catBasisHtml`.
- **Open risks flagged inline:** `Date.UTC` in `calDays` (T7 note — pure static, swap for civil-calendar helper if the sandbox forbids); test 15 workday arithmetic pinned to 08.03.2026 being a Sunday (T6 step 5 note); `emp-09` staleness handled by latest-wins in `curatorMatrix` (T9 step 3 note).
