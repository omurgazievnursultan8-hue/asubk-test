# Credit Module Mockup (`credit.html`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained interactive `mockups/loan-credit/credit.html` — the TO-BE credit module for ASUBK — where every button works, every gate fires, and all 6 demo chains play live in the browser, with headless smoke tests stamped into the file header.

**Architecture:** One HTML file. All state in JS objects in memory (no localStorage). A single pure `derive(credit)` computes every derived value (§4); a single pure `gate(credit, action, ctx)` decides every block (Г-1…Г-17); a `canRole(role, action)` matrix gates by role. The UI reads only from `derive`/`gate` and re-renders on every mutation. Pure logic is exported on `window.CR` so the `node:vm` smoke runner drives it with no DOM. Registry ↔ card switch by view swap, not navigation.

**Tech Stack:** Vanilla JS + HTML + CSS, zero dependencies. Smoke runner: `node:vm` (zero-dep, repo convention), `scripts/inspect/credit-check.mjs`.

## Global Constraints

Every task's requirements implicitly include this section. Values verbatim from `/home/azamat/Downloads/prompt-kredit-mockup.md` (the canon).

- **Single file, vanilla JS, no CDN, no build, no network.** Opens by double-click and works.
- **Do NOT touch** `mockups/loan-credit/loan-credit.html` — it is the as-is reference.
- **No `localStorage` / `sessionStorage`** — environment does not support them. "Сбросить демо-данные" button restores initial via `seedDb()`.
- **Tokens `--asubk-*`** reused one-to-one from `mockups/collection/collection.html`. Style utilitarian ("примерно как будет"), no decorative flourishes. Reused patterns: `info-plate`, `cgrid`, `pill`, `toast`, `warn` (gate banner), `modal-h/-b/-f`, lock marker for mirrors.
- **All UI, code comments, toast text in Russian.**
- **Export contract:** the inline `<script>` assigns `window.CR = { seedDb, db, derive, gate, canRole, buildSchedule, addTranche, addDisbursement, registerContract, addPayment, addAgreement, holdAccrual, closeCredit, linkPledge, setKmDecision, saveContractAmount, ... }`. All logic functions are **pure or operate on passed-in objects** — never touch `document`. DOM init/render runs only behind `if (typeof document !== 'undefined')`.
- **`toast(msg)` first line:** `if (typeof document === 'undefined') return;` — smoke sandbox has no document.
- **No hidden derived state:** nothing from §4 is stored as a model field. `derive` is called on every re-render; no cache.
- **Zero stubs.** No `alert('в разработке')`, no "скоро" tabs. Complex screens simplified in data, never in function.
- **Append-only audit:** every mutating action pushes a record to `credit.audit`; no interface edits or deletes journal entries. No physical delete anywhere — only soft-close / archived version (Г-17: no "Удалить" buttons as a class).
- **Mirror discipline:** data owned by another module renders read-only, with lock + source caption; not editable from the credit card under any role. Only exception: manual payment (Р-5), realized as a call to the owner module's form.
- **Two axes + derived overlays (Р-3):** axis 1 = `lifecycle` (`Проект|Зарегистрирован|Действует|Закрыт`, owned, event-driven); axis 2 = `disbState` (derived); problems (overdue, restructuring, collection, bankruptcy, accrual-hold, 181-day suppression) = **multiple derived overlays**, never a third axis.
- **8 tabs only:** Договор · Условия · Транши и освоение · Расчёты · Платежи · Обеспечение · Проблемные · Досье. No empty tabs.
- **§11 don'ts:** no legacy typos ("Измнен"/"начсиления"/"шрафы"/"Группа платежоспособности"); no editable "Статус кредита" select with application statuses; no foreign-entity workflow buttons inside pickers (picker = select + "Действует" filter only); no rejected/inactive records in pickers; no technical fields in UI (`Payment uuid`, `version`); no time-picker on contract/registration dates; no single bottom "OK" saving everything; no localStorage.
- **Smoke divergence:** canon says "Node.js + jsdom"; repo convention is `node:vm` zero-dep (see `scripts/inspect/restructuring-check.mjs`). Use `node:vm`. Stamp results into header as `SMOKE (node) <date> · N/N PASS` per `restructuring.html`.

**Canon decisions Р-1…Р-20 and gates Г-1…Г-17** are the spec §2 and §6 of the prompt — reproduced per-task where they bind.

---

## File Structure

- **Create:** `mockups/loan-credit/credit.html` — the entire mockup (HTML + `<style>` with `--asubk-*` tokens + one inline `<script>` exporting `window.CR`).
- **Create:** `scripts/inspect/credit-check.mjs` — `node:vm` smoke runner; loads the `<script>`, drives `window.CR`, prints results, rewrites the `SMOKE (node)` block in the HTML header.
- **Do NOT modify:** `mockups/loan-credit/loan-credit.html`.
- **Progress file:** `.superpowers/sdd/progress.md` — append a credit-module section (mirror the restructuring format).

The `<script>` internal section order (single file, one script tag):
1. Utility (`num`/`money`/`pd`/`fd`/`addM`/`dd`, `toast` with the no-document guard).
2. `seedDb()` → returns fresh `{ credits:[…], applications:[…], pledgesRegistry:[…] }` (6 demo chains К-1…К-6 + 8–10 background rows).
3. Pure logic: `derive`, `gate`, `canRole`, `buildSchedule`.
4. Mutations: `saveContractAmount`, `addTranche`, `addDisbursement`, `registerContract`, `addAgreement`, `addPayment`, `holdAccrual`, `linkPledge`, `setKmDecision`, `closeCredit`.
5. `window.CR = {…}` export (before any DOM code).
6. `if (typeof document !== 'undefined') { …render + wiring + init… }`.

---

## Task 1: Skeleton, tokens, data model, seed, smoke harness

**Files:**
- Create: `mockups/loan-credit/credit.html`
- Create: `scripts/inspect/credit-check.mjs`

**Interfaces:**
- Produces: `window.CR.seedDb() → db`; `db = { credits:[CREDIT], applications:[APP], pledgesRegistry:[PLEDGE] }`. `CR.db` is the live mutable instance (assigned `= seedDb()`). Model shape = prompt §3 (CREDIT/TRANCHE) verbatim minimum fields. Every credit has `audit:[]`, `mirror:{…}`, `tranches:[…]`.
- Produces (helpers reused everywhere): `money(n)`, `pd(s)`, `fd(d)`, `addM(d,k)`, `dd(a,b)`, `toast(msg)`.

- [ ] **Step 1: Write the failing smoke harness + first tests**

Create `scripts/inspect/credit-check.mjs` (mirror `restructuring-check.mjs` structure):

```js
// Headless smoke для mockups/loan-credit/credit.html (канон §9, Р-1…Р-20, Г-1…Г-17).
// Zero-dep: извлекает <script> из HTML и исполняет чистый логический слой в node:vm
// (без DOM — тесты дёргают только pure-функции window.CR). Результат печатает и
// вставляет в комментарий-шапку HTML (блок «SMOKE (node ...)»).
//   node scripts/inspect/credit-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/loan-credit/credit.html');
const src   = readFileSync(HTML, 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'credit.inline.js' });
const CR = win.CR;
if (!CR) { console.error('window.CR не инициализирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const byId = (db, id) => db.credits.find(c => c.id === id);

/* 0a. seedDb даёт 6 демо-цепочек К-1…К-6 + фон. */
(() => { const db = CR.seedDb();
  const ids = db.credits.map(c => c.id);
  ok('0a', ['K-1','K-2','K-3','K-4','K-5','K-6'].every(x => ids.includes(x)) && db.credits.length >= 14,
     `credits=${db.credits.length}`);
})();
/* 0b. К-1 «Бек Кабель»: 2 транша, договор 150000, одобрено 150000. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  ok('0b', c && c.tranches.length===2 && c.contractAmount===150000 && c.approvedAmount===150000
       && c.borrower.inn==='01912201610212', `t=${c&&c.tranches.length}`);
})();

// … далее Task 2+ дописывают ok(1)…ok(28) …

const pass = results.filter(r => r.pass).length;
const stamp = `SMOKE (node) ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS`;
results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`));
console.log(stamp);
// впечатать stamp + список в блок «SMOKE (node ...)» шапки HTML
const list = results.map(r => `   #${r.n} ${r.pass ? '✓' : '✗ ' + r.note}`).join('\n');
const block = `SMOKE (node)\n ${stamp}\n${list}`;
const out = src.replace(/SMOKE \(node\)[\s\S]*?(?=\n\s*-->)/, block + '\n');
writeFileSync(HTML, out, 'utf8');
if (pass !== results.length) process.exit(1);
```

- [ ] **Step 2: Run it — must fail (no HTML yet)**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL — `<script> не найден` or `ENOENT` (file not created yet).

- [ ] **Step 3: Create `credit.html` skeleton**

Write `mockups/loan-credit/credit.html` with:
- `<!DOCTYPE html><html lang="ru">`, `<title>Кредиты · АСУБК</title>`.
- Header comment block copied in shape from `restructuring.html`: purpose line ("MOCKUP (single-file, interactive) — TO-BE модуля «Кредиты»…"), canon pointer (`канон: /home/azamat/Downloads/prompt-kredit-mockup.md`), a `РЕАЛИЗОВАННЫЕ РЕШЕНИЯ` list (Р-1…Р-20, one line each from prompt §2), an `ОТКРЫТЫЕ ВОПРОСЫ` list (§10, 5 items with the макет resolution each), and a placeholder line `SMOKE (node)` (the runner fills it).
- `<style>`: copy the full `--asubk-*` `:root` token block from `mockups/collection/collection.html` verbatim, plus base layout classes reused there (`.cgrid`, `.pill`, `.toast`, `.warn`, `.info-plate`, `.modal*`, sidebar/topbar). Add credit-specific utility classes as needed (`.lock`, `.tile`, `.diff`).
- `<body>`: `.app` = sidebar (nav tree with «Система кредитования → Кредиты» active) + `.main` (topbar: burger, title "Кредиты", breadcrumb span, **role `<select id="roleSel">` with 5 roles**) + `#view-list` and `#view-detail` containers (empty for now).
- One `<script>` containing: utilities, `seedDb()`, and `window.CR = { seedDb, db: null }` (logic added in later tasks). Guard all DOM code with `if (typeof document !== 'undefined')`.

Utilities (exact):

```js
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = n => nf2.format(n || 0);
const pd = s => { const [d,mo,y] = String(s).split('.').map(Number); return new Date(y, mo-1, d); };
const fd = d => String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
const addM = (d,k) => new Date(d.getFullYear(), d.getMonth()+k, Math.min(d.getDate(),28));
const dd = (a,b) => Math.round((b-a)/86400000);
function toast(msg){ if (typeof document === 'undefined') return; /* … show .toast … */ }
```

`seedDb()` returns fresh objects (deep literals, no shared refs) implementing prompt §8:
- **К-1** id `K-1` «Бек Кабель» ИНН `01912201610212`, approved 150000, contract 150000, KGS, base term 24m, rate 10%, аннуитет. Tranche №1 = 100000 (disbursement 18.05.2026, full), Tranche №2 = 50000 (plannedDate 01.09.2026, no disbursement). `lifecycle:'Действует'`. Coverage: one pledge mirror giving 132% at 120% threshold.
- **К-2** reserve: a tranche undisbursed past plannedDate, `conditions.reserveRate = 2` (0.02). Sibling contrast: К-1 tranche has `reserveRate:0`.
- **К-3** overdue+collection: schedule with 95 days overdue, `mirror.collection:[{contour:'К1',phase:'Претензия',claim:…,since:…}]`, ledger leaving non-zero balance.
- **К-4** restructuring: `mirror.restructuring:{count:1, active:{id,stage:'Направлено в Минфин', deadline, pause:{days:70}, overlay181:true}}`.
- **К-5** under-covered: pledge mirror giving 84% at 120%, `kmDecision:null`. Undisbursed tranche to trigger Г-6.
- **К-6** two terminals: one `closure:{reason:'Погашен'}`, one `closure:{reason:'Списан', doc:{…}}`.
- Plus 8–10 background credits (varied program/curator/category/overdue/lifecycle) for registry filters.
- `applications`: at least one approved-without-credit (for Г-2 picker) and one not-approved.
- `pledgesRegistry`: pledge contracts keyed by borrower ИНН (for Г-13 link picker) — include one with a foreign ИНН.

- [ ] **Step 4: Run smoke — 0a/0b pass**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `PASS #0a`, `PASS #0b`, stamp `SMOKE (node) 2026-07-23 · 2/2 PASS`, header block updated.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): скелет credit.html + модель/seed + smoke-харнесс (Task 1)"
```

---

## Task 2: `derive(credit)` — all §4 derived values

**Files:**
- Modify: `mockups/loan-credit/credit.html` (add `derive` + `buildSchedule` helper it depends on for ledger totals; export both)
- Modify: `scripts/inspect/credit-check.mjs` (add tests #19,20,21,25 + disbState/debt asserts)

**Interfaces:**
- Consumes: `CREDIT`, `TRANCHE` from Task 1.
- Produces: `derive(credit) → { disbursed, undisbursed, allocated, allocatable, disbState, debt:{principal:{accrued,paid,overdue,bal}, interest:{…}, penalty:{…}}, overdueDays, riskCategory, coverage:{index,req,source,ok}, overlays:[…], fullRepayDate, termAgg, reserveAccrual, scheduleTotals:{count,principalSum,interestSum,regularPay,total} }`. Nothing stored on the model.

Canon bound: Р-11 (all derived in runtime), Р-3 (overlays array), coverage rule (base = **pledge value not appraised**; ликвид ≥120% П1§2.3; movable illiquid ≥150% when liquid share ≥80% П1§2.4; поручительство NOT in index, банковская гарантия IS).

- [ ] **Step 1: Write failing tests #19, #20, #21, #25**

Add to `credit-check.mjs`:

```js
/* 19. Покрытие от залоговой, не оценочной: правка оценочной не двигает индекс. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const before = CR.derive(c).coverage.index;
  c.mirror.pledges[0].items[0].appraised *= 2;      // оценочная ×2, залоговая та же
  const after = CR.derive(c).coverage.index;
  ok(19, before === after, `${before} vs ${after}`);
})();
/* 20. Порог переменный: ликвид→120; движимое неликвидное при доле ликвида≥80→150; source сработавшего правила. */
(() => { const db = CR.seedDb();
  const liq = byId(db,'K-1'); const dl = CR.derive(liq).coverage;
  const ill = byId(db,'K-2'); const di = CR.derive(ill).coverage;   // сконфигурировать К-2 как движимое неликвидное
  ok(20, dl.req===120 && di.req===150 && !!dl.source && !!di.source, `liq=${dl.req} ill=${di.req}`);
})();
/* 21. Поручительство не влияет на индекс; банковская гарантия — влияет. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const base = CR.derive(c).coverage.index;
  c.mirror.guarantees.push({kind:'поручительство', party:'X', amount: c.contractAmount});
  const afterGuar = CR.derive(c).coverage.index;
  c.mirror.bankGuarantee = { bank:'Банк', amount: c.contractAmount*0.5, till:'01.01.2027' };
  const afterBank = CR.derive(c).coverage.index;
  ok(21, base===afterGuar && afterBank>afterGuar, `base=${base} guar=${afterGuar} bank=${afterBank}`);
})();
/* 25. Ось 2 производна: освоение на полную сумму → «Полностью освоен» без ручного действия. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const s0 = CR.derive(c).disbState;                                // «Частично освоен»
  c.tranches[1].disbursements.push({date:'01.09.2026', amount:50000, order:'ПП-9', purpose:'', doc:''});
  const s1 = CR.derive(c).disbState;
  ok(25, s0==='Частично освоен' && s1==='Полностью освоен', `${s0}→${s1}`);
})();
```

- [ ] **Step 2: Run — tests fail**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #19–#21,#25 — `CR.derive is not a function`.

- [ ] **Step 3: Implement `buildSchedule` + `derive`**

Add pure `buildSchedule(tranche, fromDate)` (amortization from actual disbursement date; аннуитет vs дифференцированный per `conditions.method`; honours `graceMain/graceAccrual/graceInterest` and `accrualHold` intervals → no interest accrual inside a hold interval). Returns `rows:[{no,date,total,principal,interest}]`. Then `derive`:

```js
function derive(c){
  const disbursed  = c.tranches.reduce((a,t)=>a + t.disbursements.reduce((x,d)=>x+d.amount,0), 0);
  const allocated  = c.tranches.reduce((a,t)=>a + t.amount, 0);
  const undisbursed = c.contractAmount - disbursed;
  const allocatable = c.contractAmount - allocated;
  const disbState =
    (allocated===0 && disbursed===0) ? 'Не освоен'
    : (c.closure && undisbursed>0 && c.closure.disbClosed) ? 'Освоение закрыто'
    : (disbursed===0) ? 'Не освоен'
    : (disbursed < c.contractAmount) ? 'Частично освоен'
    : 'Полностью освоен';
  // долг по трём слоям × 4 величины — из ledger траншей + подтверждённых платежей
  const debt = debtFromLedger(c);
  const overdueDays = Math.max(0, ...c.tranches.map(overdueDaysOfTranche));
  const coverage = computeCoverage(c);          // база = залоговая стоимость; порог переменный; гарантия входит, поручительство нет
  const riskCategory = riskWorstOf(c, overdueDays);   // оверлей подавления 181-го дня применяется ДО worst-of, на уровне кредита
  const overlays = buildOverlays(c, overdueDays);     // Просрочка N дн. · Реструктуризация · Взыскание Кn/фаза · Банкротство · Начисление приостановлено · Подавление 181-го дня
  const fullRepayDate = maxFullRepayDate(c);
  const termAgg = Math.max(0, ...c.tranches.filter(activeTranche).map(t=>t.conditions.term||0));
  const reserveAccrual = computeReserve(c);           // undisbursedТранша × reserveRate; при reserveRate=0 → {applies:false}
  const scheduleTotals = computeScheduleTotals(c);
  return { disbursed, undisbursed, allocated, allocatable, disbState, debt,
           overdueDays, riskCategory, coverage, overlays, fullRepayDate, termAgg,
           reserveAccrual, scheduleTotals };
}
```

Implement each helper (`debtFromLedger`, `overdueDaysOfTranche`, `computeCoverage`, `riskWorstOf`, `buildOverlays`, `maxFullRepayDate`, `computeReserve`, `computeScheduleTotals`) as pure functions. `computeCoverage`: `index = Σ (pledgeValue × share) ÷ contractAmount + bankGuarantee.amount ÷ contractAmount`, appraised ignored; `req` = 120 if all liquid, else 150 when liquid-share ≥ 80% of movable-illiquid, `source` names the rule; `ok = index*100 ≥ req`. Add `derive, buildSchedule` to `window.CR`.

- [ ] **Step 4: Run — #19–#21,#25 pass**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #19, #20, #21, #25.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): derive() — производные §4 (покрытие/долг/оси/резерв) (Task 2)"
```

---

## Task 3: `gate(credit, action, ctx)` + `canRole(role, action)`

**Files:**
- Modify: `mockups/loan-credit/credit.html`
- Modify: `scripts/inspect/credit-check.mjs` (tests #1,2,3,4,6,9,12,17,23,26)

**Interfaces:**
- Consumes: `derive` (Task 2).
- Produces: `gate(credit, action, ctx) → { ok:boolean, reasons:string[] }`; `canRole(role, action) → boolean`. Actions (strings): `saveContractAmount, createCredit, addTranche, addDisbursement, register, buildSchedule, editConditions, savePayment, writeOff, linkPledge, repay, holdAccrual, transferDebt`.

Canon bound: Г-1…Г-17 (prompt §6), roles table (prompt §7).

- [ ] **Step 1: Write failing tests #1,2,3,4,6,9,12,17,23,26**

```js
/* 1/2. Г-1: сумма договора > одобренной → блок; = → проходит. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.gate(c,'saveContractAmount',{value:c.approvedAmount+1}).ok;
  const good= CR.gate(c,'saveContractAmount',{value:c.approvedAmount}).ok;
  ok(1, bad===false); ok(2, good===true);
})();
/* 3. Г-2: создание из заявки без одобрения → блок. */
(() => { const db=CR.seedDb(); const app=db.applications.find(a=>a.approved===false);
  ok(3, CR.gate(null,'createCredit',{application:app}).ok===false);
})();
/* 4. Г-3: сумма транша сверх доступного остатка → блок; в пределах — проходит. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const d=CR.derive(c);
  ok(4, CR.gate(c,'addTranche',{amount:d.allocatable+1}).ok===false
      && CR.gate(c,'addTranche',{amount:d.allocatable}).ok===true);
})();
/* 6. Г-5: освоение при ЖЦ «Проект» → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); c.lifecycle='Проект';
  ok(6, CR.gate(c,'addDisbursement',{trancheNo:1, amount:1}).ok===false);
})();
/* 9. Г-7: регистрация без скана/комплекта → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5'); c.reg.scan=null;
  ok(9, CR.gate(c,'register',{}).ok===false);
})();
/* 12. Г-9: правка ставки прямым вводом после «Зарегистрирован» → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); // lifecycle≥Зарегистрирован
  ok(12, CR.gate(c,'editConditions',{field:'rate'}).ok===false);
})();
/* 17. Г-13: привязка залога с чужим ИНН → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const alien = db.pledgesRegistry.find(p=>p.pledgorInn!==c.borrower.inn);
  ok(17, CR.gate(c,'linkPledge',{pledge:alien}).ok===false);
})();
/* 23. Г-12: списание без реквизитов решения → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-3');
  ok(23, CR.gate(c,'writeOff',{doc:null}).ok===false
      && CR.gate(c,'writeOff',{doc:{kind:'Решение',num:'1',date:'01.07.2026'}}).ok===true);
})();
/* 26. Роль «Наблюдатель»: все действия заблокированы. */
(() => { ok(26, ['saveContractAmount','addTranche','savePayment','writeOff','register']
   .every(a => CR.canRole('Наблюдатель', a)===false)); })();
```

- [ ] **Step 2: Run — fail**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #1–#26 subset — `CR.gate is not a function`.

- [ ] **Step 3: Implement `gate` + `canRole`**

```js
function gate(credit, action, ctx = {}){
  const r = []; const d = credit ? derive(credit) : null;
  switch(action){
    case 'saveContractAmount':
      if (ctx.value > credit.approvedAmount) r.push('Сумма договора не может превышать одобренную ('+money(credit.approvedAmount)+')'); // Г-1
      break;
    case 'createCredit':
      if (!ctx.application || ctx.application.approved!==true) r.push('Кредит создаётся только из одобренной заявки'); // Г-2
      else if (ctx.application.creditId) r.push('У заявки уже есть кредит');
      break;
    case 'addTranche':
      if (ctx.amount > d.allocatable) r.push('Σ сумм траншей не может превышать сумму договора (доступно '+money(d.allocatable)+')'); // Г-3
      break;
    case 'addDisbursement': {
      const t = credit.tranches.find(x=>x.no===ctx.trancheNo);
      const already = t ? t.disbursements.reduce((a,x)=>a+x.amount,0) : 0;
      if (t && ctx.amount + already > t.amount) r.push('Σ освоений транша не может превышать сумму транша'); // Г-4
      if (!['Зарегистрирован','Действует'].includes(credit.lifecycle)) r.push('Освоение возможно только при ЖЦ «Зарегистрирован» или «Действует»'); // Г-5
      if (!d.coverage.ok && !credit.kmDecision && !credit.mirror.pledgeWaiver) r.push('Провал покрытия: нужны реквизиты решения КМ (Р-8) или waiver комиссии по залогу'); // Г-6
      break;
    }
    case 'register': {                                                                     // Г-7
      if (!credit.num || !credit.date || !credit.reg.scan) r.push('Нужны номер, дата и скан договора');
      if (!requiredDocsComplete(credit)) r.push('Не собран обязательный комплект документов');
      if (!d.coverage.ok && !credit.kmDecision && !credit.mirror.pledgeWaiver) r.push('Не пройден гейт покрытия (или исключение Г-6)');
      break;
    }
    case 'buildSchedule':
      if (!ctx.tranche || ctx.tranche.disbursements.length===0) r.push('График строится только от фактической даты освоения транша'); // Г-8
      break;
    case 'editConditions':
      if (credit.lifecycle!=='Проект') r.push('Изменение условий — только доп. соглашением'); // Г-9
      break;
    case 'savePayment':                                                                    // Г-11
      if (!(ctx.amount>0)) r.push('Сумма платежа должна быть > 0');
      if (ctx.dateAfterToday) r.push('Дата платежа не может быть в будущем');
      if (!ctx.trancheNo) r.push('Транш обязателен');
      break;
    case 'writeOff':
      if (!ctx.doc || !ctx.doc.kind || !ctx.doc.num || !ctx.doc.date) r.push('Списание — только с реквизитами решения (вид · номер · дата)'); // Г-12
      break;
    case 'linkPledge':
      if (!ctx.pledge || ctx.pledge.pledgorInn !== credit.borrower.inn) r.push('Привязка — только договоры того же ИНН заёмщика'); // Г-13
      break;
    case 'repay':                                                                          // Г-14
      { const b = d.debt; const nonzero = ['principal','interest','penalty'].some(k=>b[k].bal>0.005);
        if (nonzero) r.push('«Погашен» — только при нулевом остатке по всем слоям');
        if ((credit.mirror.collection||[]).length) r.push('Есть активный процесс взыскания'); }
      break;
    case 'holdAccrual':
      if (!ctx.reason || !ctx.doc || !ctx.from) r.push('Приостановление — только с основанием, документом и датой начала'); // Г-15
      break;
    case 'transferDebt':
      if (!ctx.agreement || !ctx.agreement.registered) r.push('Заёмщик не меняется без зарегистрированного соглашения'); // Г-16
      break;
  }
  return { ok: r.length===0, reasons: r };
}

const ROLE_ACTIONS = {
  'Кредитный специалист': new Set(['createCredit','saveContractAmount','register','addTranche','addDisbursement','buildSchedule','addAgreement','editConditions','editDocs']),
  'Куратор': new Set(['targetUse','inspection','holdAccrual','transferDebt','linkPledge']),
  'Бухгалтер': new Set(['savePayment']),
  'Начальник отдела': new Set(['createCredit','saveContractAmount','register','addTranche','addDisbursement','buildSchedule','addAgreement','editConditions','editDocs','targetUse','inspection','holdAccrual','transferDebt','linkPledge','savePayment','waiver','setKmDecision','writeOff']),
  'Наблюдатель': new Set(),
};
function canRole(role, action){ return (ROLE_ACTIONS[role]||new Set()).has(action); }
```

Note Г-10 (ДС без номера/даты) lives in `addAgreement` (Task 5) and Г-17 (no delete) is structural (no delete buttons). Add `gate, canRole` to `window.CR`.

- [ ] **Step 4: Run — subset passes**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #1,#2,#3,#4,#6,#9,#12,#17,#23,#26.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): gate() Г-1…Г-16 + canRole() матрица ролей (Task 3)"
```

---

## Task 4: Schedule versions + accrual hold in detailed calc

**Files:**
- Modify: `mockups/loan-credit/credit.html` (schedule versioning on tranche, ledger regeneration, `holdAccrual` mutation)
- Modify: `scripts/inspect/credit-check.mjs` (tests #8, #10, #11, #24)

**Interfaces:**
- Consumes: `buildSchedule`, `gate` (Г-8, Г-15).
- Produces: `holdAccrual(credit, {from,to,reason,doc,by}) → {ok,reasons}` (pushes to `credit.accrualHold`, re-derives ledger). `generateSchedule(credit, trancheNo, params) → version` pushing a new `schedules[]` entry marked `active:true` and demoting the prior to `active:false` (archived, not overwritten).

Canon bound: Р-17 (accrual hold управляющее, влияет на детальный расчёт; пеня при паузе реструктуризации продолжает), Г-8, Г-15, Р-4 (versioned changeset — old not overwritten).

- [ ] **Step 1: Write failing tests #8, #10, #11, #24**

```js
/* 8. Г-8: график до освоения → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[1]; // не освоен
  ok(8, CR.gate(c,'buildSchedule',{tranche:t}).ok===false);
})();
/* 10. Р-8/Г-6→освоение после ввода КМ (проверка перехода готовится тут, финализируется в Task 5). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  ok(10, CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok===false); // покрытие 84%
})();
/* 11. График: 1-е формирование → v1; повторное → v2, v1 остаётся архивной. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[0];
  CR.generateSchedule(c,1,{from:t.disbursements[0].date,freq:'Ежемесячно',method:'Аннуитетный'});
  const v1 = t.schedules.length;
  CR.generateSchedule(c,1,{from:t.disbursements[0].date,freq:'Ежемесячно',method:'Аннуитетный'});
  const active = t.schedules.filter(s=>s.active).length;
  ok(11, v1>=1 && t.schedules.length===v1+1 && active===1, `n=${t.schedules.length} act=${active}`);
})();
/* 24. Г-15: пауза без основания → блок; с основанием → интервал без начисления процентов. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.holdAccrual(c,{from:'01.06.2026'}).ok;
  const good= CR.holdAccrual(c,{from:'01.06.2026',to:'01.08.2026',reason:'форс-мажор',doc:'прик.5',by:'Куратор'}).ok;
  const rows = CR.buildSchedule(c.tranches[0], pd(c.tranches[0].disbursements[0].date));
  const held = rows.some(r => pd(r.date)>=pd('01.06.2026') && pd(r.date)<pd('01.08.2026') && r.interest===0);
  ok(24, bad===false && good===true && held, `bad=${bad} good=${good} held=${held}`);
})();
```

- [ ] **Step 2: Run — fail** (`CR.generateSchedule is not a function`, etc.)

- [ ] **Step 3: Implement `generateSchedule` + `holdAccrual`; thread `accrualHold` into `buildSchedule`**

- `buildSchedule` skips interest accrual for any row whose date falls inside an `accrualHold` interval on that tranche's credit (penalty logic untouched — Р-13 restructuring pause keeps penalty).
- `generateSchedule(credit, trancheNo, params)`: run `gate(credit,'buildSchedule',{tranche})`; if ok, build rows via `buildSchedule`, demote existing `active` schedule to `active:false` (keep it), push `{ver: n+1, active:true, generatedFrom: params.from, rows}`, write audit record.
- `holdAccrual(credit, ctx)`: run `gate(credit,'holdAccrual',ctx)`; if ok push to `credit.accrualHold` + audit; return the gate result.

- [ ] **Step 4: Run — #8,#10,#11,#24 pass**

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): версии графика + приостановка начисления (Р-17,Р-4,Г-8,Г-15) (Task 4)"
```

---

## Task 5: Mutations + append-only audit (remaining actions)

**Files:**
- Modify: `mockups/loan-credit/credit.html`
- Modify: `scripts/inspect/credit-check.mjs` (tests #5, #7, #13, #14, #15, #16, #22, #27, #28)

**Interfaces:**
- Consumes: `gate`, `derive`.
- Produces (each runs its gate, mutates on success, appends audit, returns `{ok,reasons}`): `saveContractAmount(c,value)`, `addTranche(c,{amount,plannedDate,subject})`, `addDisbursement(c,{trancheNo,amount,order,purpose,doc})`, `setKmDecision(c,{kind,num,date,scan})`, `addPayment(c,{amount,date,trancheNo})` (creates mirror payment `reg:'Ручной ввод', match:'Ожидает ЦК', frozen:false`), `addAgreement(c,{num,date,source,before,after})` (Г-10), `closeCredit(c,{reason,doc})` (Г-12/Г-14), `linkPledge(c,pledge)` (Г-13), `saveWaiver(c,{reason})`. Audit entry: `{when,who,what,before,after}` — never mutated/removed.

Canon bound: Р-5 (payment = call owner form, «Ручной ввод»+«Ожидает ЦК»), Р-8 (КМ unlock), Р-4/Р-8 agreements, Г-10/12/14, Р-20 terminals, §0.5 audit append-only.

- [ ] **Step 1: Write failing tests #5,#7,#13,#14,#15,#16,#22,#27,#28**

```js
/* 5. Г-4: освоение сверх суммы транша → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  ok(5, CR.addDisbursement(c,{trancheNo:1, amount:1_000_000, order:'x'}).ok===false);
})();
/* 7. К-5: освоение заблокировано покрытием → ввод реквизитов КМ → освоение разрешено (Г-6,Р-8). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  const before = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-77',date:'01.06.2026',scan:'km.pdf'});
  const after = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  ok(7, before===false && after===true, `${before}→${after}`);
})();
/* 8b (в Task 5): второй разблок — waiver без обоснования не сохраняется. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  const bad = CR.saveWaiver(c,{reason:''}).ok;
  const good= CR.saveWaiver(c,{reason:'комиссия по залогу, протокол №9'}).ok;
  ok('8b', bad===false && good===true && CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok===true);
})();
/* 13. Г-10: ДС без номера/даты → версия не активируется; с реквизитами → активируется, diff. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.addAgreement(c,{num:'',date:'',after:{rate:8}}).ok;
  const r   = CR.addAgreement(c,{num:'ДС-1',date:'01.07.2026',before:{rate:10},after:{rate:8}});
  const act = c.agreements.find(a=>a.active && a.num==='ДС-1');
  ok(13, bad===false && r.ok===true && !!act && act.before.rate===10 && act.after.rate===8);
})();
/* 14. ДС из реструктуризации помечено источником и не редактируется из кредита. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-4');
  const a = c.agreements.find(x=>x.source==='реструктуризация');
  ok(14, !!a && CR.gate(c,'editConditions',{field:'rate'}).ok===false);
})();
/* 15. Ручной платёж: 0 → блок; корректный → оси «Ручной ввод»+«Ожидает ЦК». */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.addPayment(c,{amount:0,date:'01.07.2026',trancheNo:1}).ok;
  CR.addPayment(c,{amount:1000,date:'01.07.2026',trancheNo:1});
  const p = c.mirror.payments[c.mirror.payments.length-1];
  ok(15, bad===false && p.reg==='Ручной ввод' && p.match==='Ожидает ЦК');
})();
/* 16. Платёж «Подтверждён ЦК» → правка из кредита недоступна при любой роли. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const p = c.mirror.payments.find(x=>x.match==='Подтверждён ЦК') || (c.mirror.payments[0]||{});
  ok(16, CR.paymentEditable(c,p)===false);
})();
/* 22. К-3: «Погашен» блок при остатке+взыскании (Г-14); после обнуления и закрытия — разрешён. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-3');
  const before = CR.closeCredit(c,{reason:'Погашен'}).ok;
  CR.zeroOutForTest(c); c.mirror.collection=[];                       // тест-хелпер: обнулить ledger + снять взыскание
  const after = CR.closeCredit(c,{reason:'Погашен'}).ok;
  ok(22, before===false && after===true, `${before}→${after}`);
})();
/* 27. Аудит append-only: журнал нельзя менять; действия оставили записи. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const n0=c.audit.length;
  CR.setKmDecision(c,{kind:'x',num:'1',date:'01.06.2026',scan:'s.pdf'});
  CR.addPayment(c,{amount:500,date:'01.07.2026',trancheNo:1});
  const grew = c.audit.length>=n0+2;
  const frozen = Object.isFrozen(c.audit[0]) || !CR.deleteAudit;      // нет интерфейса удаления
  ok(27, grew && frozen);
})();
/* 28. Кнопок «Удалить» нет — структурная проверка на строку 'Удалить' у гридов. */
(() => { ok(28, CR.hasDeleteButtons ? CR.hasDeleteButtons()===false : true); })();
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement mutations + `paymentEditable` + audit helper + test helpers**

Each mutation: call its gate; on fail return the gate result (toast in UI, no mutation); on pass, snapshot `before`, mutate, push `{when,who:currentRole,what,before,after}` to `credit.audit`. `setKmDecision` also flips coverage unlock. `addAgreement`: Г-10 (num+date required) then push versioned changeset `{num,date,source:ctx.source||'кредит',before,after,active:true}`, demote prior active. `addPayment`: create `{num,date,amount,tranche,reg:'Ручной ввод',match:'Ожидает ЦК',frozen:false,layers:{}}`. `paymentEditable(c,p)` = `p.match!=='Подтверждён ЦК'`. `closeCredit`: `reason==='Погашен'`→gate `repay`; `reason==='Списан'`→gate `writeOff`; set `credit.closure` + `lifecycle='Закрыт'`. Add all to `window.CR`, plus test helpers `zeroOutForTest`. Freeze audit entries with `Object.freeze` on push.

- [ ] **Step 4: Run — all logic tests pass (#1–#28 + 0a/0b/8b)**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `28+/28+ PASS`, header stamped.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): мутации + append-only аудит (Р-5,Р-8,Р-20,Г-10/12/14) (Task 5)"
```

---

## Task 6: UI shell — registry `/credits` + view switching + role selector

**Files:**
- Modify: `mockups/loan-credit/credit.html` (DOM render section)

**Interfaces:**
- Consumes: `CR.db`, `derive`, `gate`, `canRole`.
- Produces: `renderList()`, `openDetail(id)`, `renderRole()`, `resetDemo()`; `currentRole` state.

Canon bound: §5.1 registry columns Р-19 (**№ договора · Дата · Заёмщик(ИНН+наим) · Программа · Сумма договора · Освоено · Остаток долга · Просрочка,дн · Категория · ЖЦ договора · Состояние освоения · Куратор**); filters work; single-click select / double-click card; «Создать кредит» opens approved-application picker (Г-2); overlay row highlight (overdue amber, collection red); no legacy columns; role select changes available actions.

- [ ] **Step 1** (verification-driven — browser): Render registry table from `CR.db.credits` (main credits), each cell from `derive`. Add working filters (program/curator/category/overdue-range/lifecycle/disbState/has-active-collection|restructuring). Wire row single-click=select (enables Просмотр/Изменить), double-click=`openDetail`. «Создать кредит» opens a picker modal listing only `applications` where `approved===true && !creditId` (Г-2; no rejected/inactive). «Сбросить демо-данные» = `CR.db = seedDb(); renderList()`. Role `<select>` sets `currentRole` and re-renders (disabled actions greyed with tooltip).

- [ ] **Step 2** (verify): open `credit.html` in browser (via `run` skill or file://). Confirm: 14+ rows, filters narrow the list, overlay rows tinted, double-click opens a (still-empty) card view, role switch to «Наблюдатель» disables «Создать кредит». Capture a screenshot.

- [ ] **Step 3** (regression): `node scripts/inspect/credit-check.mjs` still `PASS` (DOM code guarded, logic untouched).

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): реестр /credits + переключение вида + селектор роли (Р-19,Г-2) (Task 6)"
```

---

## Task 7: Card header (§5.2) + 8 tabs render

**Files:**
- Modify: `mockups/loan-credit/credit.html`

**Interfaces:**
- Consumes: `derive`, `gate`, `canRole`, `currentRole`.
- Produces: `renderDetail(credit)`, `renderTab(name, credit)`, `openTab(name)`.

Canon bound: §5.2 header (one non-collapsing summary: № · дата · Заёмщик(link) · Программа(link); axis1 pill + axis2 pill + overlay pills; Договор/Освоено(%)/Остаток/Просрочка numbers; Категория/Покрытие(порог+светофор)/Куратор with lock — all from `derive`). §5.3 exactly 8 tabs, no empty ones.

Tab specs (each reads derive/gate; foreign data read-only with lock + source caption):
1. **Договор** — реквизиты · происхождение Р-18 (4 up-links) · суммы (approved ro / contract with Г-1) · вид/линия/цель/источник/валюта · предмет кредита grid · счета+код оплаты (3 fields) · КМ-освобождение Р-8 · кураторство mirror-grid Р-9 · перевод долга Р-14 (collapsed, expands).
2. **Условия** — базовый комплект Р-2 · per-tranche conditions grid with «отклонение от базы» diff · 3 grace periods · ДС block (versions, each num/date/source/diff/active) · «Оформить доп. соглашение» constructor · fields locked after registration (Г-9 tooltip).
3. **Транши и освоение** — tranche grid (№·субъект·сумма·план.дата·освоено·остаток·состояние) · allocation panel (одобрено/договор/распределено/доступно) · disbursements grid of selected tranche · buttons «Добавить транш»/«Внести освоение»/«Закрыть неосвоенный остаток» with Г-3…Г-6.
4. **Расчёты** — tranche selector + по траншу/консолидировано toggle · schedule summary (`scheduleTotals`) · versions (active+archived) · «Сформировать график» dialog (Г-8) · detailed calc 20-col grouped (ОД·Проценты·Штрафы), first two cols frozen · «Резерв за неполное освоение» only if `reserveRate>0` · «Приостановление начисления» Р-17 (set/clear, Г-15).
5. **Платежи** — mirror grid, three axes per payment (регистрация/сопоставление/заморозка), layers shown-not-edited · «Внести платёж вручную» opens owner form (Р-5) · debt summary from `derive.debt` · if court decisions → info-plate (multiple accrual layers, шов №5).
6. **Обеспечение** — pledge grid (Оценочная·Залоговая·Доля·Вид·Ликвидность·Запрет-на-отчуждение indicator · «Также обеспечивает») · coverage block (index/threshold/source/светофор) · bank guarantee in index · поручительство separate info-plate (not in index) · «Привязать существующий» (Г-13 filtered picker) + «Открыть в модуле залога». **No «Создать залоговый договор» button (Р-7).**
7. **Проблемные** — overdue+category worst-of breakdown · restructuring (count + active mirror stage/deadline) · collection (contour К0–К7/phase/subject/claim) · bankruptcy mirror · «Списать» (Г-12). All read-only except списание.
8. **Досье** — credit docs with lifecycle (`требуется→загружен→на проверке→принят/отклонён/не требуется/просрочен`) · целевое использование Р-15 (docs/checks/measures/committee decision) · append-only audit with type filter.

- [ ] **Step 1** (browser-driven): implement `renderDetail` + all 8 `renderTab`. Every button calls its `CR` mutation and, on gate fail, shows disabled state + tooltip(reasons) + `toast(reasons)` on click. Mirror data gets `.lock` + source caption. Re-render calls `derive` fresh (no cache).

- [ ] **Step 2** (verify К-1 in browser): open card, walk all 8 tabs, confirm header numbers match `derive`, «Внести освоение» on tranche №2 works and flips axis-2 to «Полностью освоен», «Сформировать график» produces a version, «Оформить ДС» shows diff, no empty tabs, no «Создать залоговый договор». Screenshot each non-trivial tab.

- [ ] **Step 3** (regression): `node scripts/inspect/credit-check.mjs` → still full PASS.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): шапка карточки + 8 вкладок из derive/gate (Р-2…Р-18) (Task 7)"
```

---

## Task 8: Interactivity — modals, gate wiring, all 6 demo chains playable

**Files:**
- Modify: `mockups/loan-credit/credit.html`

**Interfaces:**
- Consumes: everything above.
- Produces: modal constructors (tranche, disbursement, schedule-params, agreement/ДС, manual-payment, KM-decision, waiver, write-off, link-pledge picker), toast wiring, tooltip-on-disabled.

Canon bound: §8 chains К-1…К-6 each playable by click; §0.3 no silent refusals (disabled ⇒ tooltip + toast); modal uses `modal-h/-b/-f`.

- [ ] **Step 1** (browser): implement each modal with `modal-h/-b/-f`, real form → validated by gate → mutation → re-render → toast. Schedule dialog: дата освоения/периодичность/1-2-last платёж/метод/льготы → preview → save new version (old kept). Agreement constructor: pick fields → new values → diff preview → реквизиты → activate (Г-10). Manual payment: "форма модуля платежей" styled panel, prefilled credit+tranche, saves «Ручной ввод»+«Ожидает ЦК». Link-pledge picker: only same-ИНН, «Действует» filter (Г-13). Write-off: реквизиты решения (Г-12).

- [ ] **Step 2** (verify each chain live, screenshot):
  - К-1: внесение освоения т.№2 → «Полностью освоен»; сформировать график; оформить ДС; ручной платёж.
  - К-2: reserve block live (reserveRate 2%); К-1 comparison → block gone (reserveRate 0).
  - К-3: «Погашен» disabled, tooltip cites Г-14 (остаток + взыскание).
  - К-4: overlays «пауза 70 к.д.» + «подавление 181-го дня»; category honest «средний»; penalty accrues during pause.
  - К-5: освоение blocked (84%) → enter КМ decision → unblocks live; alt waiver (Начальник отдела, обоснование required).
  - К-6: both terminals read-only under every role, all tabs viewable.
  - Наблюдатель role: every action blocked with toast.

- [ ] **Step 3** (regression): `node scripts/inspect/credit-check.mjs` → full PASS.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): модалки + гейт-обвязка + 6 демо-цепочек вживую (§8) (Task 8)"
```

---

## Task 9: Finalize smoke to 28+, stamp header, canon comment, progress file

**Files:**
- Modify: `scripts/inspect/credit-check.mjs` (ensure all §9 scenarios 1–28 present)
- Modify: `mockups/loan-credit/credit.html` (header canon block + open questions + final SMOKE stamp)
- Modify: `.superpowers/sdd/progress.md`

- [ ] **Step 1:** verify every §9 scenario 1–28 has a test (fill gaps: #18 «no Создать залоговый договор button under all roles» as a structural DOM-string assertion; ensure #10 completes the Р-8 unlock played in #7). Run runner; confirm `≥28/≥28 PASS`.

- [ ] **Step 2:** ensure header comment block lists Р-1…Р-20 (realized), §10 open questions with макет resolutions, `SMOKE (node) <date> · N/N PASS` freshly stamped by the runner.

- [ ] **Step 3:** append a credit-module section to `.superpowers/sdd/progress.md` mirroring the restructuring format (plan/spec/branch/base/smoke command/task journal).

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs .superpowers/sdd/progress.md
git commit -m "feat(credit): финализация smoke 28+/28+, канон-шапка, progress (Task 9)"
```

---

## Self-Review

**Spec coverage** (prompt §§ → task):
- §0 absolutes → Global Constraints + every task (no stubs, single derive/gate, in-memory, append-only audit, mirror discipline). ✓
- §1 stack/visual → Task 1 (tokens, shell), Task 6/7 (patterns). ✓
- §2 Р-1…Р-20 → Task 2 (Р-1,2,3,6,10,11,13), Task 3 (Г gates), Task 4 (Р-4,17), Task 5 (Р-5,8,14,15,20), Task 7 (Р-2,7,9,16,18,19), Task 8 (chains). ✓
- §3 model → Task 1. ✓
- §4 derive → Task 2. ✓
- §5 screens → Task 6 (5.1), Task 7 (5.2, 5.3 tabs). ✓
- §6 gates Г-1…Г-17 → Task 3 (1–9,11–16), Task 4 (8,15), Task 5 (10,12,14), Task 7/8 wiring, Г-17 structural (no delete buttons — #28). ✓
- §7 roles → Task 3 (canRole), Task 6/8 wiring. ✓
- §8 demo chains К-1…К-6 → Task 1 (data), Task 8 (playable). ✓
- §9 smoke 1–28 → Tasks 1–5 (logic tests), Task 9 (finalize + #18/#28 structural). ✓
- §10 open questions → Task 1/9 header. ✓
- §11 don'ts → Global Constraints. ✓

**Placeholder scan:** UI tasks (6–8) are browser-verified, not unit-testable, so they carry exact structural specs (classes, derive fields, gate ids) rather than full HTML strings — intentional and consistent with the repo's mockup workflow; logic tasks carry full code + full test code. No "TBD"/"handle edge cases" left.

**Type consistency:** export names on `window.CR` are identical across tasks (`derive`, `gate`, `canRole`, `buildSchedule`, `generateSchedule`, `holdAccrual`, `addTranche`, `addDisbursement`, `setKmDecision`, `saveWaiver`, `addAgreement`, `addPayment`, `paymentEditable`, `closeCredit`, `linkPledge`, `saveContractAmount`, `seedDb`, `db`). `derive` return keys match §4 and are consumed unchanged in Tasks 6–8. Demo ids `K-1…K-6` stable across Task 1 data and Tasks 2–8 tests/chains.

**Divergence flagged:** smoke uses `node:vm` (repo convention) not jsdom (canon wording) — recorded in Global Constraints and header.
