# Вкладка «Заключения» заявки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переработать вкладку «Заключения» в мокапе заявки: отделы назначает кредитный специалист из справочника, у заключения есть ЖЦ (черновик → внесено → отзыв), структурированные условия, вложения и история; отрицательный вердикт блокирует отправку в комиссию.

**Architecture:** Мокап — один самодостаточный HTML-файл (`mockups/loan-application/loan-application.html`): CSS в `<style>`, весь JS — top-level `const`/`function` в немодульном `<script>`, панели вкладок рендерятся лениво через `PANEL_RENDER[panelId](app)`. Состояние живёт на объекте заявки (`app._concl`), перерисовка — `_panelRefresh('tab-concl')`. Новый код заменяет блок «CHECKPOINT 4b» целиком и точечно правит гейт (`sendReady`/`sendGateReason`), стадии (`_renderStages`), права (`can`), модель вкладок (`TABS`), возврат комиссией (`confirmDocReason`, ветка `comreq`) и фазу A вкладки «Комиссия».

**Tech Stack:** Vanilla JS + CSS в одном HTML-файле; проверка — Playwright (`playwright-core` + системный Chrome) скриптом `scripts/inspect/conclusions-check.mjs`, который грузит мокап по `file://`, драйвит флоу через `page.evaluate` и ассертит DOM/состояние. Юнит-тестов в репозитории нет — **проверочный скрипт и есть тест**.

## Global Constraints

- Язык интерфейса и всех строк — **русский**. Комментарии в коде — русские, как в остальном файле.
- Дизайн-система ASUBK: только существующие CSS-переменные (`--asubk-blue`, `--status-success`, `--status-success-bg`, `--status-warning`, `--status-warning-bg`, `--status-error`, `--status-error-bg`, `--text-heading`, `--text-body`, `--text-muted`, `--text-placeholder`, `--surface-card`, `--surface-hover`, `--surface-input`, `--border-default`, `--border-strong`, `--radius-sm`, `--radius-md`, `--radius-pill`, `--font-label`, `--text-base`, `--text-sm`, `--text-lg`, `--weight-regular`, `--weight-medium`, `--weight-semibold`, `--asubk-font`). Новых цветов не вводить.
- Никаких `alert()` / `confirm()` / `prompt()` — блокируют Playwright. Подтверждения — через существующие `openModal(id)` / `closeModal(id)`, уведомления — `showToast(text, type)` где `type ∈ {ok, warn, info}`.
- Любой пользовательский текст в HTML экранируется `_esc(s)`.
- Файл — единственный артефакт мокапа; **не** разносить на модули (репозиторий держит мокапы самодостаточными).
- Проверочный скрипт запускается как `node scripts/inspect/conclusions-check.mjs` и падает с ненулевым кодом при любом `FAIL` или JS-ошибке страницы.
- `DOC_STATUS`, `DEPT_DIR`, `CONCL_VERDICTS` и прочие top-level `const` **не являются свойствами `window`** — в `page.evaluate` обращаться к ним напрямую по имени (тот же realm), как это делает `scripts/inspect/doc-integration-request.mjs`.
- Факты о демо-данных, проверенные 2026-07-10 (на них опираются ассерты — не перепроверять, не менять):
  массив заявок называется **`APPLICATIONS`**; `hasCollateral` выводится из `PROGRAM_META[program].collateral`;
  `З-2026-000105` — программа «Поддержка сельхозпроизводителей» → **залога нет**, `isGroup:true`, `_seedConfirmed:true`
  (комплект подтверждён ГФ, статус «Новый»); `З-2026-000080` — программа «ТУР» → **залог есть**, статус
  «Требуется доп. информация», комплект **не** подтверждён ГФ. Хост пайплайна — `#detailStages`,
  таббар — `#detailTabbar` с кнопками `.tabbar-tab`.
- В CSS есть `.note-banner.ok` и `.note-banner.warn`, но **нет** `.note-banner.err` — его добавляет Task 4.
  `.btn-danger` уже существует — не дублировать.
- Коммит после каждой задачи. Сообщения — на русском, префикс `feat(mockup):` / `test(inspect):` / `docs(...)`.

---

## File Structure

| Файл | Ответственность | Действие |
|---|---|---|
| `mockups/loan-application/loan-application.html` | весь мокап: CSS, модель, рендер, гейты | **Modify** (блок `CHECKPOINT 4b` ~4632–4741 переписывается; точечные правки в `can`, `TABS`, `_renderStages`, `sendReady`, `sendGateReason`, `confirmDocReason`, `renderCommission`, `<style>`, шапка, модалки) |
| `scripts/inspect/conclusions-check.mjs` | проверка фичи: ассерты модели, прав, гейта, ЖЦ, стыков | **Create** |
| `TODO.md` | новая запись `P3-R39`, отметка хвоста в `P3-R35` | **Modify** |
| `STATUS.md` | дата «Last updated» + строка о фиче | **Modify** |
| `docs/superpowers/specs/2026-07-10-loan-app-conclusions-tab-design.md` | спек (уже написан) | — |

**Именование, зафиксированное на весь план** (Task 3 не имеет права переименовать то, что объявил Task 1):

```
DEPT_DIR, DEPT_MAP, CONCL_VERDICTS, _CONCL_VMAP
_conclNow() -> 'ДД.ММ.ГГГГ ЧЧ:ММ'      _conclToday() -> 'ДД.ММ.ГГГГ'
_conclItem() -> item                    _conclOf(app) -> {assigned, items}
_conclLog(app, dept, action, note)      _conclActor()
_conclSeed(app)                         _conclSyncColl(app)
_conclLocked(app, key) -> bool          _conclCounts(app) -> {pos,cond,neg,pending,done,total}
_conclNegDepts(app) -> [key]            _conclWaiting(app) -> [title]
conclusionsReady(app) -> bool
conclAssign(key)  conclUnassign(key)  conclUnassignConfirm()
conclSubmit(key)  conclSaveDraft(key)  conclClear(key)  conclWithdraw(key)  conclWithdrawConfirm()
conclCondAdd(key) conclCondDel(key, i) conclFileAdd(key) conclFileDel(key, i)
conclToggle(key)  conclToggleAll()     conclLogToggle(key)  conclScrollTo(kind)
_conclReadForm(key)                     renderConclusions(app)
setDept(k)  _deptKey  _syncDeptSwitch()
```

`can(app).editConcl` из `boolean` становится **функцией** `editConcl(dept) -> boolean`; `can(app).assignDepts` — новый boolean.

---

### Task 1: Модель — справочник отделов, состояние, сид, гейт

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (блок `CHECKPOINT 4b`, начинается строкой `/* ============================================================` перед `CHECKPOINT 4b:`, заканчивается `PANEL_RENDER['tab-concl'] = renderConclusions;`)
- Create: `scripts/inspect/conclusions-check.mjs`

**Interfaces:**
- Consumes: `condPhase(status)`, `_docStats(app)` (даёт `.met`, `.accMet`, `.confirmedMet`), `app.hasCollateral`, `_detailApp`, `_esc`, `showToast`
- Produces: `DEPT_DIR`, `DEPT_MAP`, `CONCL_VERDICTS`, `_CONCL_VMAP`, `_conclNow()`, `_conclToday()`, `_conclActor()`, `_conclItem()`, `_conclLog(app,dept,action,note)`, `_conclOf(app)`, `_conclSeed(app)`, `_conclSyncColl(app)`, `_conclLocked(app,key)`, `_conclCounts(app)`, `_conclNegDepts(app)`, `_conclWaiting(app)`, `conclusionsReady(app)`

**Замечание про порядок работ:** старые `renderConclusions`, `conclSave`, `conclClear`, `_conclusionsOf`, `_conclDone`, `CONCL_DEPTS` удаляются в этой задаче. Чтобы файл не сломался, в этой же задаче `renderConclusions` заменяется временной заглушкой (полноценный рендер — Task 4), а вызовы `_conclDone`/`CONCL_DEPTS` в `sendGateReason` переводятся на новые счётчики.

- [ ] **Step 1: Написать падающий тест — новый файл проверки**

Создать `scripts/inspect/conclusions-check.mjs`:

```js
// Проверка фичи «Заключения отделов» (спек 2026-07-10).
// Грузит мокап, драйвит назначение/ЖЦ заключений, ассертит модель и DOM. Ищет JS-ошибки.
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

const results = [];
const check = (name, ok) => { results.push((ok ? 'PASS ' : 'FAIL ') + name); };

// Заявка З-2026-000105 — демо-сид: комплект подтверждён ГФ, залога нет,
// заключения в трёх состояниях (submitted · submitted · draft · pending).
async function openConcl(num, role){
  await page.evaluate(([n, r]) => { setRole(r || 'spec'); gotoDetail(n, 'tab-concl'); showTab('tab-concl'); }, [num, role]);
  await page.waitForTimeout(250);
}

// ── T1: справочник и модель ──────────────────────────────────────────────
await openConcl('З-2026-000105');
const t1 = await page.evaluate(() => {
  const app = _detailApp, c = _conclOf(app);
  return {
    dirKeys:   DEPT_DIR.map(d => d.key),
    dflt:      DEPT_DIR.filter(d => d.dflt).map(d => d.key),
    hasColl:   app.hasCollateral,
    assigned:  c.assigned.map(a => a.dept),
    statuses:  c.assigned.map(a => c.items[a.dept].status),
    riskV:     c.items.risk.verdict,
    riskConds: c.items.risk.conds.length,
    riskFiles: c.items.risk.files.length,
    lockedRisk:   _conclLocked(app, 'risk'),
    lockedLegal:  _conclLocked(app, 'legal'),
    counts:    _conclCounts(app),
    ready:     conclusionsReady(app),
    logLen:    c.items.risk.log.length,
  };
});
check('T1 справочник содержит 7 отделов', t1.dirKeys.length === 7 && t1.dirKeys.includes('analytics') && t1.dirKeys.includes('monitor'));
check('T1 дефолтные — risk + credit', t1.dflt.join(',') === 'risk,credit');
check('T1 у демо-заявки 105 залога нет', t1.hasColl === false);
check('T1 сид 105: назначены risk,credit,legal,analytics', t1.assigned.join(',') === 'risk,credit,legal,analytics');
check('T1 сид 105: статусы submitted,submitted,draft,pending', t1.statuses.join(',') === 'submitted,submitted,draft,pending');
check('T1 сид 105: риск — «С условиями», 2 пункта, 1 вложение', t1.riskV === 'cond' && t1.riskConds === 2 && t1.riskFiles === 1);
check('T1 дефолтный отдел заперт, опциональный — нет', t1.lockedRisk === true && t1.lockedLegal === false);
check('T1 счётчики: pos1 cond1 neg0 pending2 done2 total4',
  t1.counts.pos === 1 && t1.counts.cond === 1 && t1.counts.neg === 0 && t1.counts.pending === 2 &&
  t1.counts.done === 2 && t1.counts.total === 4);
check('T1 гейт закрыт — внесены не все', t1.ready === false);
check('T1 у внесённого заключения есть история', t1.logLen >= 2);

// ── T1b: залог → авто-назначение отдела залога; без залога — только дефолтные;
//        отклонённая заявка — neg у риска ─────────────────────────────────
const t1b = await page.evaluate(() => {
  const coll   = APPLICATIONS.find(a => a.hasCollateral && condPhase(a.status) === 'draft');
  const noColl = APPLICATIONS.find(a => !a.hasCollateral && condPhase(a.status) === 'draft' && a.num !== 'З-2026-000105');
  const rej    = APPLICATIONS.find(a => a.status === 'Отклонена');
  return {
    collDepts:   coll ? _conclOf(coll).assigned.map(a => a.dept) : null,
    collAuto:    coll ? _conclOf(coll).assigned.find(a => a.dept === 'coll').auto : null,
    collLocked:  coll ? _conclLocked(coll, 'coll') : null,
    noCollDepts: noColl ? _conclOf(noColl).assigned.map(a => a.dept) : null,
    noCollLock:  noColl ? _conclLocked(noColl, 'coll') : null,
    rejVerdict:  rej ? _conclOf(rej).items.risk.verdict : null,
    rejReady:    rej ? conclusionsReady(rej) : null,
    negDepts:    rej ? _conclNegDepts(rej) : null,
  };
});
check('T1b при залоге отдел залога назначен авто и заперт',
  t1b.collDepts && t1b.collDepts.join(',') === 'risk,credit,coll' && t1b.collAuto === true && t1b.collLocked === true);
check('T1b без залога назначены только дефолтные, coll не заперт',
  t1b.noCollDepts && t1b.noCollDepts.join(',') === 'risk,credit' && t1b.noCollLock === false);
check('T1b отклонённая заявка: у риска отрицательное', t1b.rejVerdict === 'neg');
check('T1b отрицательное закрывает гейт', t1b.rejReady === false && t1b.negDepts.join(',') === 'risk');

console.log(results.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO JS ERRORS');
await ctx.close();
if (results.some(r => r.startsWith('FAIL')) || errors.length) process.exit(1);
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: FAIL / ненулевой код выхода, в `ERRORS` — `PAGEERROR: DEPT_DIR is not defined` (или `_conclOf is not defined`).

- [ ] **Step 3: Заменить блок CHECKPOINT 4b — справочник, состояние, сид, гейт**

Удалить `CONCL_DEPTS`, `_conclusionsOf`, `_conclDone`, `conclSave`, `conclClear`, старый `renderConclusions`.
Вставить на их место (сохранив хвост `PANEL_RENDER['tab-concl'] = renderConclusions;`):

```js
/* ============================================================
   CHECKPOINT 4b: Вкладка «Заключения» отделов (to-be, спек 2026-07-10)
   Отделы назначает кредитный специалист (дефолтные несъёмные, залоговый —
   авто по наличию залога). Заключение живёт циклом «черновик → внесено»
   с отзывом. Отрицательный вердикт блокирует отправку в комиссию;
   «С условиями» — не блокирует, условия едут в комиссию списком пунктов.
   ============================================================ */

/* Справочник оргструктуры. В проде — таблица отделов; здесь плоский список,
   из которого специалист добирает нужные. dflt — несъёмный дефолт;
   auto:'collateral' — назначается/снимается автоматически по наличию залога. */
const DEPT_DIR = [
  { key:'risk',      title:'Отдел рисков',       emp:'ТУРСУНОВА Г. А.',  dflt:true,
    seed:'Кредитный риск умеренный. Показатель долговой нагрузки в пределах нормы, отрицательной кредитной истории не выявлено.' },
  { key:'credit',    title:'Кредитный отдел',    emp:'АБДЫЛДАЕВ Э. С.',  dflt:true,
    seed:'Цель кредита соответствует программе, условия финансирования обоснованы. Рекомендуется к вынесению на комиссию.' },
  { key:'coll',      title:'Отдел залога',       emp:'ЖУМАБЕКОВ Н. Т.',  auto:'collateral',
    seed:'Предмет залога оценён, коэффициент покрытия достаточный. Правоустанавливающие документы в порядке.' },
  { key:'legal',     title:'Юридический отдел',  emp:'ИСАКОВА Д. К.',
    seed:'Правоспособность заёмщика подтверждена. Обременений и судебных споров не выявлено.' },
  { key:'analytics', title:'Отдел аналитики',    emp:'САПАРОВА А. Б.',
    seed:'Прогноз денежного потока покрывает планируемые платежи с запасом.' },
  { key:'security',  title:'Отдел безопасности', emp:'КАРИМОВ Б. У.',
    seed:'Проверка учредителей и связанных лиц проведена, стоп-факторов не выявлено.' },
  { key:'monitor',   title:'Отдел мониторинга',  emp:'ТОКТОСУНОВ М. К.',
    seed:'Объект финансирования доступен для выездного мониторинга, риск-факторов не выявлено.' },
];
const DEPT_MAP = Object.fromEntries(DEPT_DIR.map(d => [d.key, d]));

const CONCL_VERDICTS = [
  { v:'pos',  label:'Положительное', cls:'v-pos'  },
  { v:'cond', label:'С условиями',   cls:'v-cond' },
  { v:'neg',  label:'Отрицательное', cls:'v-neg'  },
];
const _CONCL_VMAP = Object.fromEntries(CONCL_VERDICTS.map(x => [x.v, x]));

/* Отметка времени для истории. Мокап — берём реальные часы браузера. */
function _conclNow(){
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function _conclToday(){ return _conclNow().slice(0, 10); }
/* Кто совершает действие — для истории. Роль «Отдел» подписывается сотрудником отдела. */
function _conclActor(){
  if (_role === 'dept' && DEPT_MAP[_deptKey]) return DEPT_MAP[_deptKey].emp;
  return (ROLE_LABEL[_role] || _role).replace(/^\S+\s/, '');
}

function _conclItem(){
  return { status:'pending', verdict:'', text:'', conds:[], files:[], author:'', date:'', log:[] };
}
function _conclLog(app, dept, action, note){
  const it = _conclOf(app).items[dept]; if (!it) return;
  it.log.push({ ts:_conclNow(), who:_conclActor(), action, note:note || '' });
}

/* Персистентное состояние заключений на объекте заявки. */
function _conclOf(app){
  if (!app._concl) _conclSeed(app);
  _conclSyncColl(app);                      // залоговый отдел следует за наличием залога
  return app._concl;
}

/* Демо-сид. Заявка З-2026-000105 (программа «Поддержка сельхозпроизводителей» —
   залога нет) показывает три состояния карточки сразу: внесено · внесено · черновик · ожидает.
   Заявки за пределами черновика — полный набор внесённых. Отклонённая — neg у риска. */
function _conclSeed(app){
  const c = { assigned:[], items:{} };
  app._concl = c;
  const add = (key, auto) => {
    c.assigned.push({ dept:key, auto:!!auto, locked:false, addedBy:'система (сид)', addedAt:_conclToday() });
    c.items[key] = _conclItem();
    c.items[key].log.push({ ts:_conclToday() + ' 09:00', who:'АСАНОВ Т. Б.', action:'assigned', note:'' });
  };
  ['risk', 'credit'].forEach(k => add(k));
  if (app.hasCollateral) add('coll', true);

  const fill = (key, verdict, conds, files) => {
    const d = DEPT_MAP[key], it = c.items[key];
    it.status = 'submitted'; it.verdict = verdict; it.text = d.seed;
    it.author = d.emp; it.date = _conclToday();
    it.conds = (conds || []).map((t, i) => ({ id:'c' + i, text:t }));
    it.files = (files || []).map(n => ({ name:n, size:'1,2 МБ' }));
    it.log.push({ ts:_conclToday() + ' 11:05', who:d.emp, action:'submitted', note:_CONCL_VMAP[verdict].label });
  };

  const phase = condPhase(app.status);
  if (app.status === 'Отклонена'){
    fill('risk', 'neg', [], []);
    c.assigned.forEach(a => { if (a.dept !== 'risk') fill(a.dept, 'pos', [], []); });
    return;
  }
  if (phase !== 'draft'){                    // у комиссии / решённые — всё внесено
    c.assigned.forEach(a => fill(a.dept, a.dept === 'risk' ? 'cond' : 'pos',
      a.dept === 'risk' ? ['Оформить страхование предмета залога до выдачи.'] : [], []));
    return;
  }
  if (app.num === 'З-2026-000105'){          // демо-микс: submitted · submitted · draft · pending
    add('legal');                            // допназначенные специалистом сверх дефолтных
    add('analytics');
    fill('risk', 'cond',
      ['Оформить страхование урожая до выдачи транша.',
       'Предоставить справку об отсутствии задолженности по налогам на дату выдачи.'],
      ['Скоринговый отчёт.pdf']);
    fill('credit', 'pos', [], []);
    const legal = c.items.legal;             // черновик: текст есть, вердикта нет
    legal.status = 'draft'; legal.text = DEPT_MAP.legal.seed;
    legal.log.push({ ts:_conclToday() + ' 10:40', who:DEPT_MAP.legal.emp, action:'drafted', note:'' });
  }
}

/* Отдел залога назначается/снимается автоматически. Снятие уносит и заключение —
   залога нет, судить нечего (специалист об этом узнаёт из тоста при правке залога). */
function _conclSyncColl(app){
  const c = app._concl; if (!c) return;
  const has = c.assigned.some(a => a.dept === 'coll');
  if (app.hasCollateral && !has){
    c.assigned.push({ dept:'coll', auto:true, locked:false, addedBy:'система (залог)', addedAt:_conclToday() });
    c.items.coll = _conclItem();
    c.items.coll.log.push({ ts:_conclNow(), who:'система', action:'assigned', note:'по заявке появился залог' });
  } else if (!app.hasCollateral && has){
    c.assigned = c.assigned.filter(a => a.dept !== 'coll');
    delete c.items.coll;
  }
}

/* Отдел нельзя снять: дефолтный либо залоговый при наличии залога. */
function _conclLocked(app, key){
  const d = DEPT_MAP[key]; if (!d) return false;
  if (d.dflt) return true;
  if (d.auto === 'collateral') return !!app.hasCollateral;
  return false;
}

function _conclCounts(app){
  const c = _conclOf(app);
  const out = { pos:0, cond:0, neg:0, pending:0, done:0, total:c.assigned.length };
  c.assigned.forEach(a => {
    const it = c.items[a.dept];
    if (it.status === 'submitted'){ out.done++; out[it.verdict]++; } else out.pending++;
  });
  return out;
}
function _conclNegDepts(app){
  const c = _conclOf(app);
  return c.assigned.map(a => a.dept).filter(k => c.items[k].verdict === 'neg');
}
function _conclWaiting(app){
  const c = _conclOf(app);
  return c.assigned.filter(a => c.items[a.dept].status !== 'submitted').map(a => DEPT_MAP[a.dept].title);
}

/* Гейт отправки: есть хотя бы один отдел, все внесли, ни одного отрицательного. */
function conclusionsReady(app){
  const c = _conclOf(app);
  return c.assigned.length > 0
      && c.assigned.every(a => c.items[a.dept].status === 'submitted' && c.items[a.dept].verdict !== 'neg');
}

/* Полноценный рендер — Task 4. Заглушка держит файл рабочим. */
function renderConclusions(app){
  const n = _conclCounts(app);
  return `<div class="concl-wrap"><div class="tab-note">Заключений внесено ${n.done} из ${n.total}.</div></div>`;
}
PANEL_RENDER['tab-concl'] = renderConclusions;
```

- [ ] **Step 4: Объявить `_deptKey` до первого использования**

`_conclActor()` читает `_deptKey`. Рядом с `let _role = 'spec';` (объявление ролей, ~строка 2583) добавить:

```js
let _deptKey = 'risk';                                // роль «Отдел»: от чьего имени вносим заключение
```

- [ ] **Step 5: Перевести `sendGateReason` на новые счётчики**

В `sendGateReason(app)` заменить последнюю строку-ветку:

```js
  if (!conclusionsReady(app)) return `Внесены не все заключения отделов (${_conclDone(app)} из ${CONCL_DEPTS.length})`;
```

на:

```js
  const cc = _conclCounts(app);
  if (!cc.total) return 'Отделы для заключений не назначены — назначьте хотя бы один';
  const neg = _conclNegDepts(app);
  if (neg.length) return `Отрицательное заключение: ${neg.map(k => DEPT_MAP[k].title).join(', ')} — устраните замечания, отдел отзовёт заключение и внесёт новое`;
  if (cc.done < cc.total) return `Внесено заключений: ${cc.done} из ${cc.total}. Ожидаются: ${_conclWaiting(app).join(', ')}`;
```

(Полный порядок веток и приоритеты — Task 6; здесь только снимаем ссылки на удалённые `_conclDone`/`CONCL_DEPTS`, чтобы файл грузился.)

- [ ] **Step 6: Убрать ссылку на удалённый `can().editConcl` из рендера**

Строка `const editable = can(app).editConcl;` жила в старом `renderConclusions` и удалена вместе с ним. Проверить, что других вхождений нет:

```bash
grep -n "CONCL_DEPTS\|_conclusionsOf\|_conclDone\|conclSave(\|editConcl" mockups/loan-application/loan-application.html
```

Ожидаемо: только строка `editConcl:` внутри `can()` (её переписывает Task 2) — она пока возвращает boolean и никем не читается.

- [ ] **Step 7: Запустить проверку — должна пройти**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все строки `PASS`, `NO JS ERRORS`, код выхода 0.

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs
git commit -m "feat(mockup): заключения — справочник отделов, состояние, сид, гейт (P3-R39)"
```

---

### Task 2: Роль «Отдел» с выбором конкретного отдела + права

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (шапка ~1253–1262, `can()` ~2600–2615, `setRole()` ~2626, `gotoDetail`, `<style>` рядом с `.roleswitch`)
- Modify: `scripts/inspect/conclusions-check.mjs`

**Interfaces:**
- Consumes: `DEPT_MAP`, `_conclOf(app)`, `_docStats(app).confirmedMet`, `condPhase`, `_detailApp`, `gotoDetail`
- Produces: `setDept(k)`, `_syncDeptSwitch()`, `can(app).assignDepts: boolean`, `can(app).editConcl: (dept) => boolean`, `can(app).withdrawConcl: (dept) => boolean`

- [ ] **Step 1: Написать падающий тест**

Дописать в `scripts/inspect/conclusions-check.mjs` перед финальным `console.log(results.join('\n'))`:

```js
// ── T2: роль «Отдел» + селектор отдела, права ────────────────────────────
await openConcl('З-2026-000105', 'dept');
const t2 = await page.evaluate(() => {
  const app = _detailApp;
  const sw  = document.getElementById('deptSwitch');
  const sel = document.getElementById('deptSel');
  const opts = sel ? [...sel.options].map(o => o.value) : [];
  setDept('legal');
  const c = can(_detailApp);
  return {
    switchVisible: sw && !sw.hidden,
    opts,
    ownLegal:  c.editConcl('legal'),
    otherRisk: c.editConcl('risk'),
    withdrawRiskAsLegal: c.withdrawConcl('risk'),
    assign:    c.assignDepts,
  };
});
check('T2 селектор отдела виден в роли «Отдел»', t2.switchVisible === true);
check('T2 селектор перечисляет назначенные отделы', t2.opts.join(',') === 'risk,credit,legal,analytics');
check('T2 отдел правит только свой блок', t2.ownLegal === true && t2.otherRisk === false);
check('T2 отдел не отзывает чужое заключение', t2.withdrawRiskAsLegal === false);
check('T2 отдел не назначает отделы', t2.assign === false);

const t2b = await page.evaluate(() => {
  // риск внёс заключение → своя роль может отозвать
  setRole('dept'); setDept('risk');
  const c1 = can(_detailApp);
  // спец назначает; заключения не правит
  setRole('spec');
  const c2 = can(_detailApp);
  const sw = document.getElementById('deptSwitch');
  return { withdrawOwn:c1.withdrawConcl('risk'), draftOwn:c1.editConcl('risk'),
           specAssign:c2.assignDepts, specEdit:c2.editConcl('risk'), switchHidden: sw.hidden };
});
check('T2b свой отдел: правка и отзыв внесённого доступны', t2b.withdrawOwn === true && t2b.draftOwn === true);
check('T2b спец назначает, но не пишет заключения', t2b.specAssign === true && t2b.specEdit === false);
check('T2b у спеца селектор отдела скрыт', t2b.switchHidden === true);

// внесение закрыто, пока комплект не подтверждён ГФ (заявка З-2026-000080 — не подтверждена)
const t2c = await page.evaluate(() => {
  setRole('dept'); gotoDetail('З-2026-000080', 'tab-concl'); setDept('risk');
  return { confirmed:_docStats(_detailApp).confirmedMet, edit:can(_detailApp).editConcl('risk') };
});
check('T2c без подтверждения ГФ внесение закрыто', t2c.confirmed === false && t2c.edit === false);
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: `FAIL T2 …`, в `ERRORS` — `PAGEERROR: setDept is not defined`.

- [ ] **Step 3: Разметка селектора отдела в шапке**

После блока `<span class="roleswitch" …>…</span>` (закрывающий тег перед `</header>`) вставить:

```html
      <!-- демо: от имени какого отдела вносится заключение (виден только в роли «Отдел») -->
      <span class="deptswitch" id="deptSwitch" hidden title="Демо: заключение вносит сотрудник выбранного отдела; чужие блоки — только на чтение">
        <label for="deptSel">Отдел:</label>
        <select id="deptSel" onchange="setDept(this.value)"></select>
      </span>
```

- [ ] **Step 4: CSS селектора**

Найти правило `.roleswitch` в `<style>` и добавить сразу после него:

```css
.deptswitch{ display:inline-flex; align-items:center; gap:6px; margin-left:10px; }
.deptswitch label{ font:var(--font-label); color:var(--text-muted); }
.deptswitch select{ font:inherit; padding:4px 8px; border:1px solid var(--border-default);
  border-radius:var(--radius-sm); background:var(--surface-card); color:var(--text-body); }
.deptswitch select:focus{ outline:none; border-color:var(--asubk-blue); }
```

- [ ] **Step 5: `setDept` + `_syncDeptSwitch`**

Сразу после `function setRole(r){ … }` вставить:

```js
/* Демо: от имени какого отдела действует роль «Отдел». Список — назначенные
   отделы открытой заявки; если текущий отдел не назначен, откатываемся к первому. */
function setDept(k){
  if (!DEPT_MAP[k]) return;
  _deptKey = k;
  _syncDeptSwitch();
  if (_detailApp) gotoDetail(_detailApp.num, 'tab-concl');
}
function _syncDeptSwitch(){
  const wrap = document.getElementById('deptSwitch'), sel = document.getElementById('deptSel');
  if (!wrap || !sel) return;
  wrap.hidden = (_role !== 'dept');
  if (wrap.hidden) return;
  const keys = _detailApp ? _conclOf(_detailApp).assigned.map(a => a.dept) : DEPT_DIR.map(d => d.key);
  if (!keys.includes(_deptKey)) _deptKey = keys[0] || 'risk';
  sel.innerHTML = keys.map(k => `<option value="${k}"${k === _deptKey ? ' selected' : ''}>${_esc(DEPT_MAP[k].title)}</option>`).join('');
}
```

- [ ] **Step 6: Вызывать `_syncDeptSwitch` при смене роли и открытии заявки**

В `setRole(r)` — после `applyRoleToListButtons();` добавить строку `_syncDeptSwitch();`.
Осторожно с порядком: `_syncDeptSwitch()` читает `_detailApp`, а `gotoDetail` ниже перерисовывает деталку — повторный вызов внутри `gotoDetail` пересоберёт список под новую заявку.

В `gotoDetail(num, tab)` — сразу после присвоения `_detailApp` (строка вида `_detailApp = …`) добавить:

```js
  _syncDeptSwitch();                                   // список отделов — из назначенных на этой заявке
```

- [ ] **Step 7: Права в `can(app)`**

В `can(app)` заменить строку

```js
    editConcl:  _role === 'dept' && phase === 'draft',     // отдел вносит заключение (риск/залог/юр/кредит)
```

на:

```js
    /* Заключения: назначает отделы кредитный специалист на черновике; вносит —
       роль «Отдел» и только за свой отдел, и только после подтверждения комплекта ГФ. */
    assignDepts: _role === 'spec' && phase === 'draft',
    editConcl: dept => _role === 'dept' && dept === _deptKey && phase === 'draft'
                    && _docStats(app).confirmedMet,
    withdrawConcl: dept => _role === 'dept' && dept === _deptKey && phase === 'draft'
                    && _docStats(app).confirmedMet
                    && (_conclOf(app).items[dept] || {}).status === 'submitted',
```

- [ ] **Step 8: Запустить проверку**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все `PASS` (T1 + T2), `NO JS ERRORS`.

- [ ] **Step 9: Коммит**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs
git commit -m "feat(mockup): заключения — роль «Отдел» с выбором отдела, права назначения и внесения (P3-R39)"
```

---

### Task 3: Панель назначения отделов

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (функции назначения рядом с блоком `CHECKPOINT 4b`; новая модалка рядом с `modal-doc-reason` ~1852; CSS рядом с `.concl-wrap` ~1142)
- Modify: `scripts/inspect/conclusions-check.mjs`

**Interfaces:**
- Consumes: `_conclOf`, `_conclLocked`, `_conclLog`, `_conclItem`, `DEPT_DIR`, `DEPT_MAP`, `can(app).assignDepts`, `openModal`, `closeModal`, `showToast`, `_panelRefresh`, `renderToolbar`, `_renderStages`
- Produces: `conclAssign(key)`, `conclUnassign(key)`, `conclUnassignConfirm()`, `_conclAssignPanel(app)` → HTML-строка, `_conclPendingUnassign` (переменная)

- [ ] **Step 1: Написать падающий тест**

Дописать в `scripts/inspect/conclusions-check.mjs` перед финальным `console.log`:

```js
// ── T3: панель назначения ────────────────────────────────────────────────
await openConcl('З-2026-000105', 'spec');
const t3 = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('#tab-concl .dept-chip')].map(c => c.dataset.dept);
  const locked = [...document.querySelectorAll('#tab-concl .dept-chip.locked')].map(c => c.dataset.dept);
  const addOpts = [...document.querySelectorAll('#tab-concl #conclAddSel option')].map(o => o.value).filter(Boolean);
  return { chips, locked, addOpts };
});
check('T3 чипы = назначенные отделы', t3.chips.join(',') === 'risk,credit,legal,analytics');
check('T3 заперты только дефолтные', t3.locked.join(',') === 'risk,credit');
// coll в списке добора не появляется никогда: он назначается автоматически по наличию залога
check('T3 в «добавить» — неназначенные, кроме авто-отдела', t3.addOpts.join(',') === 'security,monitor');

const t3b = await page.evaluate(() => {
  conclAssign('security');
  const c = _conclOf(_detailApp);
  const it = c.items.security;
  return { assigned:c.assigned.map(a => a.dept), status:it.status, log:it.log.map(l => l.action) };
});
check('T3b добавление отдела создаёт pending-карточку',
  t3b.assigned.join(',') === 'risk,credit,legal,analytics,security' && t3b.status === 'pending' && t3b.log[0] === 'assigned');

// снятие пустого отдела — без подтверждения; снятие с заключением — через модалку
const t3c = await page.evaluate(() => {
  conclUnassign('security');                               // pending → сразу
  const afterEmpty = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclUnassign('analytics');                              // тоже pending → сразу
  const afterPending = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclUnassign('legal');                                  // legal — draft → спросит
  const modalOpen = document.getElementById('modal-concl-unassign').classList.contains('open');
  const still = _conclOf(_detailApp).assigned.map(a => a.dept).includes('legal');
  conclUnassignConfirm();
  const afterConfirm = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclAssign('legal'); conclAssign('analytics');           // вернуть сид для следующих блоков
  _conclOf(_detailApp).items.legal.status = 'draft';
  _conclOf(_detailApp).items.legal.text = DEPT_MAP.legal.seed;
  return { afterEmpty, afterPending, modalOpen, still, afterConfirm };
});
check('T3c пустой отдел снимается сразу', t3c.afterEmpty === 'risk,credit,legal,analytics');
check('T3c pending снимается сразу', t3c.afterPending === 'risk,credit,legal');
check('T3c непустой отдел спрашивает подтверждение', t3c.modalOpen === true && t3c.still === true);
check('T3c подтверждение снимает отдел', t3c.afterConfirm === 'risk,credit');

const t3d = await page.evaluate(() => {
  conclUnassign('risk');                                   // заперт — снятие невозможно
  const kept = _conclOf(_detailApp).assigned.map(a => a.dept).includes('risk');
  setRole('dept'); showTab('tab-concl');                    // не спец → кнопок панели нет
  const btns = document.querySelectorAll('#tab-concl .dept-chip .chip-x, #tab-concl #conclAddSel').length;
  const panel = !!document.querySelector('#tab-concl .dept-panel');
  return { kept, btns, panel };
});
check('T3d дефолтный отдел снять нельзя', t3d.kept === true);
check('T3d не-спец видит панель, но без кнопок', t3d.panel === true && t3d.btns === 0);
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: `FAIL T3 …` (чипов в DOM нет — заглушка `renderConclusions` их не рисует), в `ERRORS` — `PAGEERROR: conclAssign is not defined`.

- [ ] **Step 3: Модалка подтверждения снятия**

После блока `<div class="overlay" id="modal-doc-reason">…</div>` (заканчивается на строке ~1869) вставить:

```html
<!-- Снятие отдела, у которого уже есть заключение: деструктивно, спрашиваем -->
<div class="overlay" id="modal-concl-unassign">
  <div class="modal" style="width:min(440px,96%)">
    <div class="modal-h">
      <span class="mt">Снять отдел</span>
      <button class="modal-x" onclick="closeModal('modal-concl-unassign')" aria-label="Закрыть">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-b">
      <p id="concl-unassign-text">Внесённое заключение будет удалено.</p>
    </div>
    <div class="modal-f">
      <button class="btn btn-secondary" onclick="closeModal('modal-concl-unassign')">Отмена</button>
      <button class="btn btn-danger" onclick="conclUnassignConfirm()">Снять отдел</button>
    </div>
  </div>
</div>
```

Класс `.btn-danger` в файле уже определён — новых правил не добавлять.

- [ ] **Step 4: Функции назначения**

В блоке `CHECKPOINT 4b`, после `conclusionsReady(app)`, вставить:

```js
/* ── Назначение отделов (кредитный специалист, стадия черновика) ── */
let _conclPendingUnassign = null;              // отдел, ждущий подтверждения снятия

function conclAssign(key){
  const app = _detailApp; if (!app || !DEPT_MAP[key]) return;
  if (!can(app).assignDepts){ showToast('Назначать отделы может кредитный специалист на черновике', 'warn'); return; }
  const c = _conclOf(app);
  if (c.assigned.some(a => a.dept === key)) return;
  c.assigned.push({ dept:key, auto:false, locked:false, addedBy:_conclActor(), addedAt:_conclToday() });
  c.items[key] = _conclItem();
  _conclLog(app, key, 'assigned', '');
  _conclRerender(app);
  showToast('Отдел назначен: ' + DEPT_MAP[key].title, 'ok');
}

function conclUnassign(key){
  const app = _detailApp; if (!app || !DEPT_MAP[key]) return;
  if (!can(app).assignDepts){ showToast('Снимать отделы может кредитный специалист на черновике', 'warn'); return; }
  if (_conclLocked(app, key)){
    showToast(DEPT_MAP[key].dflt ? 'Дефолтный отдел снять нельзя' : 'По заявке есть залог — отдел залога обязателен', 'warn');
    return;
  }
  const it = _conclOf(app).items[key];
  if (it && it.status !== 'pending'){                      // есть черновик/внесённое — спрашиваем
    _conclPendingUnassign = key;
    document.getElementById('concl-unassign-text').textContent =
      `Снять «${DEPT_MAP[key].title}»? ` + (it.status === 'submitted'
        ? 'Внесённое заключение будет удалено.' : 'Черновик заключения будет удалён.');
    openModal('modal-concl-unassign');
    return;
  }
  _conclDropDept(app, key);
}

function conclUnassignConfirm(){
  const app = _detailApp, key = _conclPendingUnassign;
  closeModal('modal-concl-unassign');
  _conclPendingUnassign = null;
  if (app && key) _conclDropDept(app, key);
}

function _conclDropDept(app, key){
  const c = _conclOf(app);
  c.assigned = c.assigned.filter(a => a.dept !== key);
  delete c.items[key];
  _conclRerender(app);
  showToast('Отдел снят: ' + DEPT_MAP[key].title, 'info');
}

/* Единая перерисовка после любого действия: панель + тулбар (гейт) + пайплайн + селектор отдела. */
function _conclRerender(app){
  _panelRefresh('tab-concl');
  renderToolbar(app);
  _renderStages(app);
  _syncDeptSwitch();
}
```

- [ ] **Step 5: Рендер панели**

Там же, перед `renderConclusions`, вставить:

```js
function _conclAssignPanel(app){
  const c = _conclOf(app);
  const may = can(app).assignDepts;
  const chips = c.assigned.map(a => {
    const d = DEPT_MAP[a.dept], locked = _conclLocked(app, a.dept);
    const why = d.dflt ? 'Дефолтный отдел — снять нельзя' : 'По заявке есть залог — отдел залога обязателен';
    const tail = locked
      ? `<span class="chip-lock" title="${_esc(why)}">🔒</span>${a.auto ? '<span class="chip-auto">авто</span>' : ''}`
      : (may ? `<button class="chip-x" onclick="conclUnassign('${a.dept}')" title="Снять отдел" aria-label="Снять отдел">✕</button>` : '');
    return `<span class="dept-chip${locked ? ' locked' : ''}" data-dept="${a.dept}">${_esc(d.title)}${tail}</span>`;
  }).join('');

  /* Авто-отделы (залоговый) в добор не попадают: их назначает наличие залога,
     а `_conclSyncColl` снимет назначенный вручную на следующей перерисовке. */
  const free = DEPT_DIR.filter(d => !d.auto && !c.assigned.some(a => a.dept === d.key));
  const adder = (may && free.length)
    ? `<select id="conclAddSel" onchange="conclAssign(this.value); this.value='';">
         <option value="">+ Добавить отдел</option>
         ${free.map(d => `<option value="${d.key}">${_esc(d.title)}</option>`).join('')}
       </select>`
    : '';

  return `<div class="dept-panel">
    <div class="dept-panel-h"><b>Назначенные отделы (${c.assigned.length})</b><span class="spacer"></span>${adder}</div>
    <div class="dept-chips">${chips || '<span class="concl-empty">Отделы не назначены</span>'}</div>
  </div>`;
}
```

Обновить заглушку рендера, чтобы панель попала в DOM (полная вкладка — Task 4):

```js
function renderConclusions(app){
  const n = _conclCounts(app);
  return `<div class="concl-wrap">${_conclAssignPanel(app)}<div class="tab-note">Заключений внесено ${n.done} из ${n.total}.</div></div>`;
}
```

- [ ] **Step 6: CSS панели**

В `<style>`, сразу после правила `.concl-wrap{ … }`, вставить:

```css
.dept-panel{ border:1px solid var(--border-default); border-radius:var(--radius-md); padding:12px 14px; margin:0 0 16px;
  background:var(--surface-input); }
.dept-panel-h{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.dept-panel-h b{ font:var(--weight-semibold) var(--text-base)/1.2 var(--asubk-font); color:var(--text-heading); }
.dept-panel-h .spacer{ flex:1; }
.dept-panel-h select{ font:inherit; font-size:var(--text-sm); padding:5px 8px; border:1px solid var(--border-default);
  border-radius:var(--radius-sm); background:var(--surface-card); color:var(--text-body); }
.dept-panel-h select:focus{ outline:none; border-color:var(--asubk-blue); }
.dept-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.dept-chip{ display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:var(--radius-pill);
  background:var(--surface-card); border:1px solid var(--border-default);
  font:var(--weight-medium) 12px/1.4 var(--asubk-font); color:var(--text-body); }
.dept-chip.locked{ color:var(--text-muted); }
.dept-chip .chip-lock{ font-size:11px; cursor:help; }
.dept-chip .chip-auto{ font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.4px; }
.dept-chip .chip-x{ border:0; background:none; cursor:pointer; color:var(--text-muted); font-size:13px; line-height:1; padding:0 2px; }
.dept-chip .chip-x:hover{ color:var(--status-error); }
```

- [ ] **Step 7: Запустить проверку**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все `PASS` (T1–T3), `NO JS ERRORS`.

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs
git commit -m "feat(mockup): заключения — панель назначения отделов (дефолтные несъёмные, залоговый авто) (P3-R39)"
```

---

### Task 4: Гейт-баннер, сводка вердиктов, карточки на чтение

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`renderConclusions` и новые рендер-хелперы; CSS)
- Modify: `scripts/inspect/conclusions-check.mjs`

**Interfaces:**
- Consumes: `_conclOf`, `_conclCounts`, `_conclNegDepts`, `_conclWaiting`, `conclusionsReady`, `_docStats(app).confirmedMet`, `condPhase`, `_docIcoOk`, `_docIcoInfo`, `_docIcoWarn`, `_conclAssignPanel`, `can(app)`
- Produces: `_conclOpen` (объект), `_conclOpenAll` (bool), `_conclLogOpen` (объект), `conclToggle(key)`, `conclToggleAll()`, `conclLogToggle(key)`, `conclScrollTo(kind)`, `_conclGateBanner(app)`, `_conclChips(app)`, `_conclCard(app, key)`, `_conclCondsRO(it)`, `_conclFilesRO(it, withDownload)`, `_conclBody(app, key)`, `_conclLogBlock(key, it)`, `renderConclusions(app)` (полный)

- [ ] **Step 1: Написать падающий тест**

Дописать в `scripts/inspect/conclusions-check.mjs` перед финальным `console.log`:

```js
// ── T4: баннер, чипы-счётчики, карточки ──────────────────────────────────
await openConcl('З-2026-000105', 'spec');
const t4 = await page.evaluate(() => {
  const banner = document.querySelector('#tab-concl .note-banner');
  const chips  = [...document.querySelectorAll('#tab-concl .vchip')].map(c => c.dataset.kind + ':' + c.dataset.n);
  const cards  = [...document.querySelectorAll('#tab-concl .concl-block')].map(c => c.dataset.dept);
  const badges = [...document.querySelectorAll('#tab-concl .concl-block .v-badge')].map(b => b.textContent.trim());
  return { banner: banner ? banner.textContent : '', chips, cards, badges };
});
check('T4 баннер называет, кого ждём', /Ожидаются/.test(t4.banner) && /Юридический отдел/.test(t4.banner));
check('T4 чипы-счётчики: pos1 cond1 neg0 pending2',
  t4.chips.join(' ') === 'pos:1 cond:1 neg:0 pending:2');
check('T4 карточки по всем назначенным', t4.cards.join(',') === 'risk,credit,legal,analytics');
check('T4 бейджи вердиктов', t4.badges.join('|') === 'С условиями|Положительное|Ожидает|Ожидает');

// раскрытая карточка внесённого заключения показывает текст, условия, вложения, историю
const t4b = await page.evaluate(() => {
  conclToggle('risk');
  const card = document.querySelector('#tab-concl .concl-block[data-dept="risk"]');
  return {
    open:  card.classList.contains('open'),
    text:  !!card.querySelector('.concl-text'),
    conds: card.querySelectorAll('.concl-cond-ro li').length,
    files: card.querySelectorAll('.concl-file').length,
    logBtn: !!card.querySelector('.concl-log-toggle'),
    logRowsHidden: card.querySelectorAll('.concl-log-row').length === 0,
  };
});
check('T4b карточка раскрывается', t4b.open === true && t4b.text === true);
check('T4b видны 2 условия и 1 вложение', t4b.conds === 2 && t4b.files === 1);
check('T4b история свёрнута под кнопкой', t4b.logBtn === true && t4b.logRowsHidden === true);

const t4c = await page.evaluate(() => {
  conclLogToggle('risk');
  const rows = document.querySelectorAll('#tab-concl .concl-block[data-dept="risk"] .concl-log-row').length;
  conclToggleAll();
  const openCards = document.querySelectorAll('#tab-concl .concl-block.open').length;
  return { rows, openCards };
});
check('T4c история разворачивается', t4c.rows >= 2);
check('T4c «развернуть все» раскрывает все карточки', t4c.openCards === 4);
// (карточек 4: risk, credit, legal, analytics)

// красный баннер при отрицательном
const t4d = await page.evaluate(() => {
  const rej = APPLICATIONS.find(a => a.status === 'Отклонена');
  gotoDetail(rej.num, 'tab-concl'); showTab('tab-concl');
  const b = document.querySelector('#tab-concl .note-banner');
  return { cls:b.className, txt:b.textContent };
});
check('T4d отрицательное — баннер-ошибка с названием отдела',
  /err|bad|error/.test(t4d.cls) && /Отдел рисков/.test(t4d.txt) && /заблокирован/i.test(t4d.txt));

// без подтверждения ГФ — баннер объясняет, что вносить рано, но панель назначения доступна
const t4e = await page.evaluate(() => {
  setRole('spec'); gotoDetail('З-2026-000080', 'tab-concl'); showTab('tab-concl');
  const b = document.querySelector('#tab-concl .note-banner');
  return { txt:b.textContent, panel: !!document.querySelector('#tab-concl .dept-panel') };
});
check('T4e до подтверждения ГФ баннер объясняет ожидание', /головным филиалом/.test(t4e.txt) && t4e.panel === true);
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: `FAIL T4 …` — в DOM нет `.vchip` и `.concl-block`.

- [ ] **Step 3: Состояние раскрытия + переключатели**

В блоке `CHECKPOINT 4b`, после функций назначения, вставить:

```js
/* ── Раскрытие карточек. Ключ отсутствует → авто: свой отдел раскрыт. ── */
const _conclOpen = {};        // dept -> bool (явный клик)
const _conclLogOpen = {};     // dept -> bool (история)
let _conclOpenAll = false;

function _conclIsOpen(key){
  if (key in _conclOpen) return _conclOpen[key];
  if (_conclOpenAll) return true;
  return _role === 'dept' && key === _deptKey;
}
function conclToggle(key){ _conclOpen[key] = !_conclIsOpen(key); _panelRefresh('tab-concl'); }
function conclToggleAll(){
  const app = _detailApp; if (!app) return;
  _conclOpenAll = !_conclOpenAll;
  _conclOf(app).assigned.forEach(a => { _conclOpen[a.dept] = _conclOpenAll; });
  _panelRefresh('tab-concl');
}
function conclLogToggle(key){ _conclLogOpen[key] = !_conclLogOpen[key]; _panelRefresh('tab-concl'); }

/* Клик по чипу-счётчику: раскрыть и подскроллить к первой карточке этого состояния. */
function conclScrollTo(kind){
  const app = _detailApp; if (!app) return;
  const c = _conclOf(app);
  const hit = c.assigned.map(a => a.dept).find(k => {
    const it = c.items[k];
    return kind === 'pending' ? it.status !== 'submitted' : (it.status === 'submitted' && it.verdict === kind);
  });
  if (!hit){ showToast('Заключений в этом состоянии нет', 'info'); return; }
  _conclOpen[hit] = true;
  _panelRefresh('tab-concl');
  const el = document.getElementById('concl-card-' + hit);
  if (el) el.scrollIntoView({ block:'center', behavior:'smooth' });
}
```

- [ ] **Step 4: Баннер, чипы, карточка, полный рендер**

Заменить заглушку `renderConclusions` (и `_conclAssignPanel` оставить как есть) на:

```js
/* Гейт-баннер: печатается первая сработавшая причина (порядок = спек §5.1). */
function _conclGateBanner(app){
  const draft = condPhase(app.status) === 'draft';
  const cc = _conclCounts(app);
  if (draft && !_docStats(app).confirmedMet)
    return `<div class="note-banner">${_docIcoInfo()}<span>Заключения вносятся после подтверждения комплектации головным филиалом. Назначить отделы можно уже сейчас.</span></div>`;
  if (!cc.total)
    return `<div class="note-banner warn">${_docIcoWarn()}<span>Отделы не назначены — назначьте хотя бы один.</span></div>`;
  const neg = _conclNegDepts(app);
  if (neg.length)
    return `<div class="note-banner err">${_docIcoWarn()}<span>Отрицательное заключение: <b>${_esc(neg.map(k => DEPT_MAP[k].title).join(', '))}</b>. Отправка в комиссию заблокирована — устраните замечания, отдел отзовёт заключение и внесёт новое.</span></div>`;
  if (cc.done < cc.total)
    return `<div class="note-banner">${_docIcoInfo()}<span>Внесено <b>${cc.done} из ${cc.total}</b>. Ожидаются: ${_esc(_conclWaiting(app).join(', '))}.</span></div>`;
  const conds = _conclOf(app).assigned.reduce((n, a) => n + _conclOf(app).items[a.dept].conds.length, 0);
  const tail = cc.cond ? ` Условий: ${conds} — комиссия рассмотрит.` : '';
  return `<div class="note-banner ok">${_docIcoOk()}<span>Все заключения внесены (<b>${cc.done}/${cc.total}</b>). Заявку можно отправить на рассмотрение комиссии.${tail}</span></div>`;
}

/* Сводка вердиктов: 4 чипа-счётчика, клик скроллит к первой такой карточке. */
function _conclChips(app){
  const cc = _conclCounts(app);
  const defs = [
    { kind:'pos',     cls:'v-pos',  label:'Положит.',    n:cc.pos },
    { kind:'cond',    cls:'v-cond', label:'С условиями', n:cc.cond },
    { kind:'neg',     cls:'v-neg',  label:'Отриц.',      n:cc.neg },
    { kind:'pending', cls:'v-none', label:'Ожидают',     n:cc.pending },
  ];
  return `<div class="vchips">${defs.map(d =>
    `<button class="vchip ${d.cls}${d.n ? '' : ' zero'}" data-kind="${d.kind}" data-n="${d.n}"
       onclick="conclScrollTo('${d.kind}')" title="Показать первое заключение в этом состоянии">
       <b>${d.n}</b> ${d.label}</button>`).join('')}</div>`;
}

/* Карточка отдела: свёрнутая строка + раскрытое тело (чтение). Редактор — Task 5. */
function _conclCard(app, key){
  const c = _conclOf(app), it = c.items[key], d = DEPT_MAP[key];
  const open = _conclIsOpen(key);
  const vb = it.status === 'submitted'
    ? `<span class="v-badge ${_CONCL_VMAP[it.verdict].cls}">${_CONCL_VMAP[it.verdict].label}</span>`
    : `<span class="v-badge v-none">Ожидает</span>`;
  const meta = it.status === 'submitted'
    ? `${_esc(it.author)} · ${_esc(it.date)}`
    : (it.status === 'draft' ? 'черновик' : 'не запрошено');
  const marks = it.status === 'submitted'
    ? `${it.files.length ? `<span class="cmark">📎${it.files.length}</span>` : ''}${it.conds.length ? `<span class="cmark">усл.${it.conds.length}</span>` : ''}`
    : '';

  const body = open ? `<div class="concl-body">${_conclBody(app, key)}</div>` : '';
  return `<div class="concl-block${open ? ' open' : ''}" id="concl-card-${key}" data-dept="${key}">
    <button class="concl-head" onclick="conclToggle('${key}')" aria-expanded="${open}">
      <span class="caret">${open ? '▾' : '▸'}</span>
      <span class="concl-title">${_esc(d.title)}</span>
      <span class="concl-meta">${meta}</span>
      ${marks}<span class="spacer"></span>${vb}
    </button>${body}</div>`;
}

/* Условия и вложения на чтение — общий кусок для тела карточки и для
   внесённого (замороженного) заключения своего отдела. */
function _conclCondsRO(it){
  if (!it.conds.length) return '';
  return `<div class="concl-sub">Условия (${it.conds.length})</div>`
       + `<ol class="concl-cond-ro">${it.conds.map(x => `<li>${_esc(x.text)}</li>`).join('')}</ol>`;
}
function _conclFilesRO(it, withDownload){
  if (!it.files.length) return '';
  const dl = withDownload ? ` <a href="#" onclick="showToast('Демо: файл не хранится','info');return false;">Скачать</a>` : '';
  return `<div class="concl-sub">Вложения (${it.files.length})</div>`
       + `<div class="concl-files">${it.files.map(f =>
           `<span class="concl-file">${_esc(f.name)} <i>${_esc(f.size)}</i>${dl}</span>`).join('')}</div>`;
}

/* Тело карточки на чтение. Редактор подменяет его в Task 5. */
function _conclBody(app, key){
  const it = _conclOf(app).items[key];
  if (it.status === 'pending' && !it.text) return `<div class="concl-empty">Заключение ещё не внесено отделом.</div>` + _conclLogBlock(key, it);
  return `<div class="concl-text">${_esc(it.text) || '—'}</div>${_conclCondsRO(it)}${_conclFilesRO(it, true)}${_conclLogBlock(key, it)}`;
}

function _conclLogBlock(key, it){
  if (!it.log.length) return '';
  const open = !!_conclLogOpen[key];
  const ACT = { assigned:'назначен отдел', drafted:'сохранён черновик', submitted:'внесено заключение',
                withdrawn:'заключение отозвано', reset_by_commission:'сброшено возвратом комиссии' };
  const rows = open ? `<div class="concl-log">${it.log.map(l =>
    `<div class="concl-log-row"><span class="ts">${_esc(l.ts)}</span><span class="who">${_esc(l.who)}</span><span class="act">${ACT[l.action] || l.action}${l.note ? ': ' + _esc(l.note) : ''}</span></div>`).join('')}</div>` : '';
  return `<button class="concl-log-toggle" onclick="conclLogToggle('${key}')">⟲ История (${it.log.length})</button>${rows}`;
}

function renderConclusions(app){
  const c = _conclOf(app);
  const cards = c.assigned.map(a => _conclCard(app, a.dept)).join('');
  const hint = (_role !== 'dept' && condPhase(app.status) === 'draft')
    ? `<div class="tab-note">Вносить заключения может роль <b>🧩 Отдел</b> — переключите роль в шапке.</div>` : '';
  const toggleAll = c.assigned.length
    ? `<div class="concl-listh"><span class="spacer"></span><button class="btn btn-ghost btn-sm" onclick="conclToggleAll()">${_conclOpenAll ? 'Свернуть' : 'Развернуть все'}</button></div>` : '';
  return `<div class="concl-wrap">${_conclGateBanner(app)}${_conclChips(app)}${_conclAssignPanel(app)}${hint}${toggleAll}${cards}</div>`;
}
PANEL_RENDER['tab-concl'] = renderConclusions;
```

- [ ] **Step 5: CSS карточек, чипов, истории**

Заменить старый блок CSS `/* ---- Tab «Заключения» … ---- */` (правила `.concl-*`, `.v-badge`, `.v-pos/.v-cond/.v-neg/.v-none`) на:

```css
/* ---- Tab «Заключения» (to-be): назначение отделов + карточки заключений ---- */
.concl-wrap{ padding:16px 20px 24px; max-width:1040px; }
.concl-listh{ display:flex; align-items:center; margin:0 0 8px; }
.concl-listh .spacer{ flex:1; }
.vchips{ display:flex; gap:8px; flex-wrap:wrap; margin:0 0 14px; }
.vchip{ display:inline-flex; align-items:baseline; gap:6px; padding:6px 12px; border-radius:var(--radius-pill);
  border:1px solid transparent; cursor:pointer; font:var(--weight-medium) 12px/1.2 var(--asubk-font); }
.vchip b{ font:var(--weight-semibold) var(--text-base)/1 var(--asubk-font); font-variant-numeric:tabular-nums; }
.vchip.zero{ opacity:.55; }
.vchip:hover{ border-color:var(--border-strong); }

.concl-block{ border:1px solid var(--border-default); border-radius:var(--radius-md); margin-bottom:10px; overflow:hidden; }
.concl-block.open{ border-color:var(--border-strong); }
.concl-head{ display:flex; align-items:center; gap:12px; width:100%; padding:12px 16px; background:var(--surface-hover);
  border:0; border-bottom:1px solid transparent; cursor:pointer; text-align:left; font:inherit; }
.concl-block.open .concl-head{ border-bottom-color:var(--border-default); }
.concl-head .caret{ color:var(--text-muted); width:12px; }
.concl-title{ font:var(--weight-semibold) var(--text-base)/1.2 var(--asubk-font); color:var(--text-heading); }
.concl-meta{ font:var(--font-label); color:var(--text-muted); }
.concl-head .cmark{ font:var(--font-label); color:var(--text-muted); }
.concl-head .spacer{ flex:1; }
.concl-body{ padding:14px 16px; }
.concl-sub{ font:var(--weight-semibold) var(--text-sm)/1.2 var(--asubk-font); color:var(--text-heading); margin:14px 0 6px; }
.concl-text{ font:var(--font-label); color:var(--text-body); white-space:pre-wrap; line-height:1.5; }
.concl-empty{ font:var(--font-label); color:var(--text-placeholder); font-style:italic; }
.concl-cond-ro{ margin:0; padding-left:20px; font:var(--font-label); color:var(--text-body); line-height:1.6; }
.concl-files{ display:flex; flex-direction:column; gap:5px; }
.concl-file{ font:var(--font-label); color:var(--text-body); }
.concl-file i{ color:var(--text-muted); font-style:normal; margin-left:6px; }
.concl-file a{ margin-left:10px; color:var(--asubk-blue); }
.concl-log-toggle{ margin-top:14px; border:0; background:none; padding:0; cursor:pointer;
  font:var(--font-label); color:var(--asubk-blue); }
.concl-log{ margin-top:8px; border-top:1px dashed var(--border-default); padding-top:8px; }
.concl-log-row{ display:flex; gap:12px; font:var(--font-label); color:var(--text-muted); padding:3px 0; }
.concl-log-row .ts{ font-variant-numeric:tabular-nums; min-width:118px; }
.concl-log-row .who{ min-width:150px; color:var(--text-body); }

.v-badge{ font:var(--weight-medium) 12px/1 var(--asubk-font); padding:5px 10px; border-radius:var(--radius-pill); display:inline-flex; }
.v-pos{ color:var(--status-success); background:var(--status-success-bg); }
.v-cond{ color:var(--status-warning); background:var(--status-warning-bg); }
.v-neg{ color:var(--status-error); background:var(--status-error-bg); }
.v-none{ color:var(--text-muted); background:var(--surface-input); }
```

`.note-banner.warn` в файле уже есть, `.note-banner.err` — нет. Добавить рядом с `.note-banner.ok` (строка ~1061):

```css
.note-banner.err{ background:var(--status-error-bg); color:var(--status-error); }
```

- [ ] **Step 6: Запустить проверку**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все `PASS` (T1–T4), `NO JS ERRORS`.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs
git commit -m "feat(mockup): заключения — гейт-баннер, сводка вердиктов, карточки с условиями/вложениями/историей (P3-R39)"
```

---

### Task 5: Редактор заключения — ЖЦ, условия, вложения, валидация, отзыв

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`_conclBody` ветвится на редактор; новые функции; модалка отзыва; CSS)
- Modify: `scripts/inspect/conclusions-check.mjs`

**Interfaces:**
- Consumes: `can(app).editConcl(dept)`, `can(app).withdrawConcl(dept)`, `_conclOf`, `_conclLog`, `_conclRerender`, `openModal`, `closeModal`, `showToast`, `CONCL_VERDICTS`
- Produces: `_conclReadForm(key)`, `conclSaveDraft(key)`, `conclSubmit(key)`, `conclClear(key)`, `conclWithdraw(key)`, `conclWithdrawConfirm()`, `conclCondAdd(key)`, `conclCondDel(key,i)`, `conclFileAdd(key)`, `conclFileDel(key,i)`, `_conclEditor(app,key)`

- [ ] **Step 1: Написать падающий тест**

Дописать в `scripts/inspect/conclusions-check.mjs` перед финальным `console.log`:

```js
// ── T5: редактор, валидация, ЖЦ ──────────────────────────────────────────
// Работаем отделом аналитики: в сиде он `pending` — чистый старт цикла.
await openConcl('З-2026-000105', 'dept');
const t5 = await page.evaluate(() => {
  setDept('analytics'); conclToggle('analytics');
  const own   = document.querySelector('#tab-concl .concl-block[data-dept="analytics"] .concl-edit');
  const other = document.querySelector('#tab-concl .concl-block[data-dept="risk"] .concl-edit');
  conclToggle('risk');
  const otherOpen = document.querySelector('#tab-concl .concl-block[data-dept="risk"] .concl-edit');
  return { own: !!own, other: !!other, otherOpen: !!otherOpen };
});
check('T5 редактор только у своего отдела', t5.own === true && t5.other === false && t5.otherOpen === false);

// валидация: пустой вердикт → тост, статус не меняется
const t5b = await page.evaluate(() => {
  conclSubmit('analytics');                                 // вердикт пуст
  const s1 = _conclOf(_detailApp).items.analytics.status;
  document.getElementById('concl-v-analytics').value = 'cond';
  conclSubmit('analytics');                                 // текст пуст
  const s2 = _conclOf(_detailApp).items.analytics.status;
  document.getElementById('concl-t-analytics').value = 'Денежный поток покрывает платежи.';
  conclSubmit('analytics');                                 // cond без условий
  const s3 = _conclOf(_detailApp).items.analytics.status;
  return { s1, s2, s3 };
});
check('T5b без вердикта / текста / условий заключение не вносится',
  t5b.s1 === 'pending' && t5b.s2 === 'pending' && t5b.s3 === 'pending');

const t5c = await page.evaluate(() => {
  conclCondAdd('analytics');
  const inp = document.querySelector('#tab-concl .concl-block[data-dept="analytics"] .concl-cond-inp');
  inp.value = 'Ежеквартально предоставлять управленческую отчётность.';
  document.getElementById('concl-v-analytics').value = 'cond';
  document.getElementById('concl-t-analytics').value = 'Денежный поток покрывает платежи с запасом.';
  conclSubmit('analytics');
  const it = _conclOf(_detailApp).items.analytics;
  return { status:it.status, verdict:it.verdict, conds:it.conds.length, author:it.author,
           acts:it.log.map(l => l.action), ro: !document.querySelector('#tab-concl .concl-block[data-dept="analytics"] .concl-edit') };
});
check('T5c валидное заключение вносится', t5c.status === 'submitted' && t5c.verdict === 'cond' && t5c.conds === 1);
check('T5c автор проставлен, история пополнена', !!t5c.author && t5c.acts.includes('submitted'));
check('T5c внесённое тело — read-only (редактора нет)', t5c.ro === true);

// отрицательное требует обоснования ≥ 20 символов
const t5d = await page.evaluate(() => {
  conclWithdraw('analytics'); conclWithdrawConfirm();       // вернулись в черновик
  document.getElementById('concl-v-analytics').value = 'neg';
  document.getElementById('concl-t-analytics').value = 'Нет.';
  conclSubmit('analytics');
  const s1 = _conclOf(_detailApp).items.analytics.status;
  document.getElementById('concl-v-analytics').value = 'neg';
  document.getElementById('concl-t-analytics').value = 'Прогноз денежного потока не покрывает планируемые платежи по графику.';
  conclSubmit('analytics');
  const it = _conclOf(_detailApp).items.analytics;
  return { s1, s2:it.status, v:it.verdict, ready:conclusionsReady(_detailApp), reason:sendGateReason(_detailApp) };
});
check('T5d короткое обоснование отрицательного отклоняется', t5d.s1 === 'draft');
check('T5d отрицательное вносится и закрывает гейт', t5d.s2 === 'submitted' && t5d.v === 'neg' && t5d.ready === false);
check('T5d причина гейта называет отдел', /Отдел аналитики/.test(t5d.reason) && /Отрицательное/.test(t5d.reason));

// отзыв: вердикт снят, текст/условия/вложения остались
const t5e = await page.evaluate(() => {
  conclWithdraw('analytics');
  const modal = document.getElementById('modal-concl-withdraw').classList.contains('open');
  const before = _conclOf(_detailApp).items.analytics.status;
  conclWithdrawConfirm();
  const it = _conclOf(_detailApp).items.analytics;
  return { modal, before, status:it.status, verdict:it.verdict, text:!!it.text, conds:it.conds.length,
           acts:it.log.map(l => l.action) };
});
check('T5e отзыв спрашивает подтверждение', t5e.modal === true && t5e.before === 'submitted');
check('T5e отзыв снимает вердикт, сохраняя содержимое',
  t5e.status === 'draft' && t5e.verdict === '' && t5e.text === true && t5e.conds === 1 && t5e.acts.includes('withdrawn'));

// черновик и вложения
const t5f = await page.evaluate(() => {
  document.getElementById('concl-t-analytics').value = 'Черновик текста заключения.';
  conclSaveDraft('analytics');
  conclFileAdd('analytics');
  const it = _conclOf(_detailApp).items.analytics;
  const n0 = it.files.length;
  conclFileDel('analytics', 0);
  return { status:it.status, text:it.text, n0, n1:it.files.length, acts:it.log.map(l => l.action) };
});
check('T5f черновик сохраняется без вердикта',
  t5f.status === 'draft' && /Черновик текста/.test(t5f.text) && t5f.acts.includes('drafted'));
check('T5f вложение добавляется и удаляется', t5f.n0 === 1 && t5f.n1 === 0);

// «Очистить» сбрасывает тело обратно в pending
const t5g = await page.evaluate(() => {
  conclClear('analytics');
  const it = _conclOf(_detailApp).items.analytics;
  return { status:it.status, text:it.text, conds:it.conds.length, files:it.files.length, log:it.log.length };
});
check('T5g «Очистить» возвращает карточку в «Ожидает», история цела',
  t5g.status === 'pending' && t5g.text === '' && t5g.conds === 0 && t5g.files === 0 && t5g.log > 0);
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: `FAIL T5 …`, в `ERRORS` — `PAGEERROR: conclSubmit is not defined`.

- [ ] **Step 3: Модалка отзыва**

После `<div class="overlay" id="modal-concl-unassign">…</div>` вставить:

```html
<!-- Отзыв внесённого заключения: заявка перестаёт быть готовой к отправке -->
<div class="overlay" id="modal-concl-withdraw">
  <div class="modal" style="width:min(440px,96%)">
    <div class="modal-h">
      <span class="mt">Отозвать заключение</span>
      <button class="modal-x" onclick="closeModal('modal-concl-withdraw')" aria-label="Закрыть">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-b">
      <p id="concl-withdraw-text">Заявка перестанет быть готовой к отправке в комиссию. Текст, условия и вложения сохранятся.</p>
    </div>
    <div class="modal-f">
      <button class="btn btn-secondary" onclick="closeModal('modal-concl-withdraw')">Отмена</button>
      <button class="btn btn-primary" onclick="conclWithdrawConfirm()">Отозвать</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Действия редактора**

В блоке `CHECKPOINT 4b`, после функций раскрытия, вставить:

```js
/* ── Редактор заключения (роль «Отдел», свой отдел, после подтверждения ГФ) ── */
let _conclPendingWithdraw = null;

/* Снять значения формы в состояние — вызывается перед любой перерисовкой,
   иначе набранный, но не сохранённый текст теряется. */
function _conclReadForm(key){
  const it = _conclOf(_detailApp).items[key]; if (!it) return;
  const v = document.getElementById('concl-v-' + key);
  const t = document.getElementById('concl-t-' + key);
  if (v) it.verdict = v.value;
  if (t) it.text = t.value.trim();
  const inps = document.querySelectorAll(`#concl-card-${key} .concl-cond-inp`);
  if (inps.length) it.conds = [...inps].map((el, i) => ({ id:'c' + i, text:el.value.trim() }));
}

function conclCondAdd(key){
  _conclReadForm(key);
  const it = _conclOf(_detailApp).items[key];
  it.conds.push({ id:'c' + it.conds.length, text:'' });
  _panelRefresh('tab-concl');
}
function conclCondDel(key, i){
  _conclReadForm(key);
  _conclOf(_detailApp).items[key].conds.splice(i, 1);
  _panelRefresh('tab-concl');
}
/* Вложение — фиктивная запись: файлового хранилища у мокапа нет. */
function conclFileAdd(key){
  _conclReadForm(key);
  const it = _conclOf(_detailApp).items[key];
  it.files.push({ name:`Вложение ${it.files.length + 1}.pdf`, size:'1,2 МБ' });
  _panelRefresh('tab-concl');
  showToast('Файл прикреплён (демо — не хранится)', 'ok');
}
function conclFileDel(key, i){
  _conclReadForm(key);
  _conclOf(_detailApp).items[key].files.splice(i, 1);
  _panelRefresh('tab-concl');
}

function conclSaveDraft(key){
  const app = _detailApp; if (!app || !can(app).editConcl(key)) return;
  _conclReadForm(key);
  const it = _conclOf(app).items[key];
  it.verdict = '';                                   // черновик вердикта не несёт
  it.status  = 'draft';
  _conclLog(app, key, 'drafted', '');
  _conclRerender(app);
  showToast('Черновик заключения сохранён', 'ok');
}

function conclSubmit(key){
  const app = _detailApp; if (!app || !can(app).editConcl(key)) return;
  _conclReadForm(key);
  const it = _conclOf(app).items[key];
  it.conds = it.conds.filter(c => c.text);           // пустые пункты не считаем
  if (!it.verdict){ showToast('Выберите вердикт', 'warn'); return; }
  if (!it.text){ showToast('Заполните текст заключения', 'warn'); return; }
  if (it.verdict === 'cond' && !it.conds.length){ showToast('Добавьте хотя бы один пункт условий', 'warn'); return; }
  if (it.verdict === 'neg' && it.text.length < 20){ showToast('Обоснуйте отрицательное заключение', 'warn'); return; }
  it.status = 'submitted';
  it.author = DEPT_MAP[key].emp;
  it.date   = _conclToday();
  _conclLog(app, key, 'submitted', _CONCL_VMAP[it.verdict].label);
  _conclRerender(app);
  showToast('Заключение внесено: ' + DEPT_MAP[key].title, it.verdict === 'neg' ? 'warn' : 'ok');
}

function conclClear(key){
  const app = _detailApp; if (!app || !can(app).editConcl(key)) return;
  const it = _conclOf(app).items[key];
  const log = it.log;
  Object.assign(it, _conclItem());
  it.log = log;
  _conclRerender(app);
  showToast('Заключение очищено', 'info');
}

function conclWithdraw(key){
  const app = _detailApp; if (!app || !can(app).withdrawConcl(key)) return;
  _conclPendingWithdraw = key;
  openModal('modal-concl-withdraw');
}
function conclWithdrawConfirm(){
  const app = _detailApp, key = _conclPendingWithdraw;
  closeModal('modal-concl-withdraw');
  _conclPendingWithdraw = null;
  if (!app || !key) return;
  const it = _conclOf(app).items[key];
  it.status = 'draft'; it.verdict = ''; it.author = ''; it.date = '';   // текст/условия/вложения остаются
  _conclLog(app, key, 'withdrawn', '');
  _conclRerender(app);
  showToast('Заключение отозвано — заявка не готова к отправке', 'warn');
}
```

- [ ] **Step 5: Ветка редактора в `_conclBody`**

Заменить `_conclBody` на:

```js
function _conclBody(app, key){
  const it = _conclOf(app).items[key];
  if (can(app).editConcl(key)) return _conclEditor(app, key) + _conclLogBlock(key, it);
  if (it.status === 'pending' && !it.text) return `<div class="concl-empty">Заключение ещё не внесено отделом.</div>` + _conclLogBlock(key, it);
  return `<div class="concl-text">${_esc(it.text) || '—'}</div>${_conclCondsRO(it)}${_conclFilesRO(it, true)}${_conclLogBlock(key, it)}`;
}

/* Внесённое заключение своего отдела — тело заморожено, доступен только отзыв. */
function _conclEditor(app, key){
  const it = _conclOf(app).items[key];
  if (it.status === 'submitted'){
    return `<div class="concl-locked">${_docIcoLock()}<span>Заключение внесено ${_esc(it.date)} · ${_esc(it.author)}</span>
        <span class="spacer"></span><button class="btn btn-ghost btn-sm" onclick="conclWithdraw('${key}')">Отозвать</button></div>
      <div class="concl-text">${_esc(it.text)}</div>${_conclCondsRO(it)}${_conclFilesRO(it, false)}`;
  }

  const opts = CONCL_VERDICTS.map(x => `<option value="${x.v}"${it.verdict === x.v ? ' selected' : ''}>${x.label}</option>`).join('');
  const condReq = it.verdict === 'cond';
  const conds = it.conds.map((c, i) => `<div class="concl-cond-row">
      <input class="concl-cond-inp" value="${_esc(c.text)}" placeholder="Пункт условия…">
      <button class="cond-x" onclick="conclCondDel('${key}', ${i})" title="Удалить пункт" aria-label="Удалить пункт">✕</button>
    </div>`).join('');
  const files = it.files.map((f, i) => `<span class="concl-file">${_esc(f.name)} <i>${_esc(f.size)}</i>
      <button class="cond-x" onclick="conclFileDel('${key}', ${i})" title="Открепить" aria-label="Открепить">✕</button></span>`).join('');

  return `<div class="concl-edit">
    <label for="concl-v-${key}">Вердикт</label>
    <select id="concl-v-${key}" onchange="_conclReadForm('${key}'); _panelRefresh('tab-concl')">
      <option value="">— выберите —</option>${opts}
    </select>

    <label for="concl-t-${key}">Текст заключения</label>
    <textarea id="concl-t-${key}" placeholder="Изложите выводы отдела…">${_esc(it.text)}</textarea>

    <div class="concl-sub${condReq ? ' req' : ''}">Условия${condReq ? ' — обязательны при вердикте «С условиями»' : ''}</div>
    <div class="concl-conds">${conds}</div>
    <button class="btn btn-ghost btn-sm" onclick="conclCondAdd('${key}')">+ Добавить пункт</button>

    <div class="concl-sub">Вложения</div>
    <div class="concl-files">${files}</div>
    <button class="btn btn-ghost btn-sm" onclick="conclFileAdd('${key}')">+ Прикрепить файл</button>

    <div class="tab-toolrow" style="margin:12px 0 0">
      <button class="btn btn-primary btn-sm" onclick="conclSubmit('${key}')">Внести заключение</button>
      <button class="btn btn-ghost btn-sm" onclick="conclSaveDraft('${key}')">Сохранить черновик</button>
      <button class="btn btn-ghost btn-sm" onclick="conclClear('${key}')">Очистить</button>
    </div>
  </div>`;
}
```

Смена вердикта перерисовывает карточку (чтобы подсветить обязательность условий) — `_conclReadForm` перед этим снимает текст и пункты, ввод не теряется.

- [ ] **Step 6: CSS редактора**

Дописать после CSS-блока карточек:

```css
.concl-edit{ display:flex; flex-direction:column; gap:8px; max-width:660px; align-items:flex-start; }
.concl-edit label{ font:var(--font-label); color:var(--text-muted); }
.concl-edit select, .concl-edit textarea{ font:inherit; width:100%; padding:7px 9px; border:1px solid var(--border-default);
  border-radius:var(--radius-sm); background:var(--surface-card); color:var(--text-body); }
.concl-edit textarea{ min-height:80px; resize:vertical; }
.concl-edit select:focus, .concl-edit textarea:focus{ outline:none; border-color:var(--asubk-blue); }
.concl-sub.req{ color:var(--status-warning); }
.concl-conds{ display:flex; flex-direction:column; gap:6px; width:100%; }
.concl-cond-row{ display:flex; gap:6px; align-items:center; }
.concl-cond-inp{ flex:1; font:inherit; padding:6px 9px; border:1px solid var(--border-default);
  border-radius:var(--radius-sm); background:var(--surface-card); color:var(--text-body); }
.concl-cond-inp:focus{ outline:none; border-color:var(--asubk-blue); }
.cond-x{ border:0; background:none; cursor:pointer; color:var(--text-muted); font-size:13px; line-height:1; padding:2px 4px; }
.cond-x:hover{ color:var(--status-error); }
.concl-locked{ display:flex; align-items:center; gap:8px; padding:8px 10px; margin:0 0 12px;
  border:1px solid var(--border-default); border-radius:var(--radius-sm); background:var(--surface-input);
  font:var(--font-label); color:var(--text-muted); }
.concl-locked .spacer{ flex:1; }
```

- [ ] **Step 7: Запустить проверку**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все `PASS` (T1–T5), `NO JS ERRORS`.

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs
git commit -m "feat(mockup): заключения — редактор с ЖЦ черновик→внесено, условия, вложения, отзыв (P3-R39)"
```

---

### Task 6: Стыки — гейт отправки, пайплайн, вкладка, возврат комиссией, блок в комиссии

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`sendGateReason` ~4213–4243, `TABS` ~2524, `_renderStages` ~2736, `confirmDocReason` ветка `comreq` ~4614–4624, `renderCommission` фаза A, CSS)
- Modify: `scripts/inspect/conclusions-check.mjs`

**Interfaces:**
- Consumes: `conclusionsReady`, `_conclCounts`, `_conclNegDepts`, `_conclWaiting`, `_conclOf`, `_CONCL_VMAP`, `DEPT_MAP`, `appStage`
- Produces: `_conclCommissionBlock(app)` → HTML-строка; `_conclResetByCommission(app)`

- [ ] **Step 1: Написать падающий тест**

Дописать в `scripts/inspect/conclusions-check.mjs` перед финальным `console.log`:

```js
// ── T6: стыки ────────────────────────────────────────────────────────────
// вкладка «Заключения» видна всегда, даже на черновике без документов
const t6 = await page.evaluate(() => {
  setRole('spec'); gotoDetail('З-2026-000080', 'tab-0');
  const labels = [...document.querySelectorAll('#detailTabbar .tabbar-tab')].map(t => t.textContent.trim());
  return { has: labels.some(l => /Заключения/.test(l)) };
});
check('T6 вкладка «Заключения» видна с черновика', t6.has === true);

// порядок причин гейта: документы → ГФ → отделы → отрицательное → недобор
const t6b = await page.evaluate(() => {
  const app = _detailApp;                                   // З-2026-000080: комплект не собран
  const r1 = sendGateReason(app);
  const a = APPLICATIONS.find(x => x.num === 'З-2026-000105');
  gotoDetail(a.num, 'tab-concl');
  const r2 = sendGateReason(a);                             // ждём заключений (legal draft, analytics pending)
  // внесём всё положительно
  ['legal', 'analytics'].forEach(k => {
    const it = _conclOf(a).items[k];
    it.status = 'submitted'; it.verdict = 'pos'; it.text = DEPT_MAP[k].seed; it.author = DEPT_MAP[k].emp; it.date = '10.07.2026';
  });
  const r3 = sendGateReason(a), ready3 = sendReady(a);
  _conclOf(a).items.legal.verdict = 'neg';
  const r4 = sendGateReason(a), ready4 = sendReady(a);
  return { r1, r2, r3, r4, ready3, ready4 };
});
check('T6b пока нет документов — про документы', /комплект документов|обязательный комплект/i.test(t6b.r1));
check('T6b дальше — недобор заключений с именами отделов', /Ожидаются/.test(t6b.r2) && /Юридический отдел/.test(t6b.r2));
check('T6b все внесены — гейт открыт', t6b.r3 === '' && t6b.ready3 === true);
check('T6b отрицательное перекрывает недобор', /Отрицательное заключение/.test(t6b.r4) && t6b.ready4 === false);

// пайплайн: узел «Заключения отделов» (третий) красный при отрицательном
const t6c = await page.evaluate(() => {
  const a = _detailApp;
  _renderStages(a);
  const nodes = [...document.querySelectorAll('#detailStages .stg')].map(n => n.className);
  _conclOf(a).items.legal.verdict = 'pos';                  // вернём положительное
  _renderStages(a);
  const nodes2 = [...document.querySelectorAll('#detailStages .stg')].map(n => n.className);
  return { neg: nodes[2], pos: nodes2[2] };
});
check('T6c при отрицательном узел «Заключения» красный', /rej/.test(t6c.neg) && !/rej/.test(t6c.pos));

// возврат комиссией сбрасывает вердикты, сохраняя содержимое
const t6d = await page.evaluate(() => {
  const a = APPLICATIONS.find(x => x.num === 'З-2026-000105');
  const it = _conclOf(a).items.risk;
  const textBefore = it.text, condsBefore = it.conds.length;
  _conclResetByCommission(a);
  const after = _conclOf(a).items.risk;
  return { status:after.status, verdict:after.verdict, text:after.text === textBefore,
           conds:after.conds.length === condsBefore, act:after.log.map(l => l.action).includes('reset_by_commission'),
           ready:conclusionsReady(a) };
});
check('T6d возврат комиссии: вердикт снят, содержимое цело',
  t6d.status === 'draft' && t6d.verdict === '' && t6d.text === true && t6d.conds === true && t6d.act === true && t6d.ready === false);

// комиссия на фазе A видит блок заключений
const t6e = await page.evaluate(() => {
  const a = APPLICATIONS.find(x => x.status === 'На рассмотрении');
  setRole('com'); gotoDetail(a.num, 'tab-6'); showTab('tab-6');
  const block = document.querySelector('#tab-6 .concl-com');
  const rows  = document.querySelectorAll('#tab-6 .concl-com .concl-block').length;
  const edit  = document.querySelectorAll('#tab-6 .concl-com .concl-edit').length;
  return { has: !!block, rows, edit };
});
check('T6e комиссия видит блок заключений на фазе A', t6e.has === true && t6e.rows >= 2);
check('T6e блок в комиссии — только на чтение', t6e.edit === 0);
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: `FAIL T6 …`, в `ERRORS` — `PAGEERROR: _conclResetByCommission is not defined`.

- [ ] **Step 3: Вкладка всегда видна**

В `TABS` заменить строку

```js
  { panel:'tab-concl', label:'Заключения', cond: app => _docStats(app).met || condPhase(app.status) !== 'draft' },
```

на:

```js
  /* Видна всегда: назначение отделов идёт с черновика (спек 2026-07-10 §6).
     Хвост: состав вкладок упирается в гайдлайн «макс 7» — переучёт в спеке заявки. */
  { panel:'tab-concl', label:'Заключения' },
```

- [ ] **Step 4: Полный порядок причин в `sendGateReason`**

Привести хвост `sendGateReason(app)` (после ветки `!st.confirmedMet`) к виду:

```js
  const cc = _conclCounts(app);
  if (!cc.total) return 'Отделы для заключений не назначены — назначьте хотя бы один';
  const neg = _conclNegDepts(app);
  if (neg.length) return `Отрицательное заключение: ${neg.map(k => DEPT_MAP[k].title).join(', ')} — устраните замечания, отдел отзовёт заключение и внесёт новое`;
  if (cc.done < cc.total) return `Внесено заключений: ${cc.done} из ${cc.total}. Ожидаются: ${_conclWaiting(app).join(', ')}`;
  return '';
```

Порядок остальных веток менять не нужно: документы → залог → ГФ → заключения. Он уже соответствует спеку (ветка залога стоит раньше ГФ — это существующее поведение, спек §6 перечисляет приоритеты, а не переставляет ветки).

- [ ] **Step 5: Красный узел пайплайна**

В `_renderStages(app)` внутри `.map` заменить тело на:

```js
  const negStage = !s.decided && _conclNegDepts(app).length > 0;     // отрицательное заключение — узел 3 красный
  const nodes = STAGE_LABELS.map((lab, idx) => {
    const n = idx + 1; let cls = 'stg';
    if (s.decided === 'approved')      cls += ' done';
    else if (s.decided === 'rejected') cls += (n < 5 ? ' done' : ' rej');
    else if (negStage && n === 3)      cls += ' rej';
    else if (n < active)               cls += ' done';
    else if (n === active)             cls += s.ready ? ' done' : ' cur';
    return `<span class="${cls}"><span class="stg-n">${n}</span>${lab}</span>`;
  }).join('<span class="stg-sep"></span>');
```

- [ ] **Step 6: Сброс заключений при возврате комиссией**

В блоке `CHECKPOINT 4b`, после `conclWithdrawConfirm`, вставить:

```js
/* Комиссия вернула заявку на доработку: внесённые заключения сбрасываются
   в черновик — текст, условия и вложения остаются и правятся заново (спек §2.7). */
function _conclResetByCommission(app){
  const c = _conclOf(app);
  c.assigned.forEach(a => {
    const it = c.items[a.dept];
    if (it.status !== 'submitted') return;
    it.status = 'draft'; it.verdict = ''; it.author = ''; it.date = '';
    it.log.push({ ts:_conclNow(), who:'система', action:'reset_by_commission', note:'' });
  });
}
```

В `confirmDocReason()`, в ветке `kind === 'comreq'`, перед `gotoDetail(app.num, 'tab-2')` добавить:

```js
    if (app){ _conclResetByCommission(app); if (app._com) app._com.phase = 'prelim'; app.status = 'Требуется доп. информация'; gotoDetail(app.num, 'tab-2'); }
```

(то есть в существующую строку добавляется вызов `_conclResetByCommission(app);` первым)

- [ ] **Step 7: Блок заключений в комиссии (фаза A)**

В блоке `CHECKPOINT 4b` добавить:

```js
/* Read-only свод заключений для комиссии: те же карточки, но без редактора и
   без панели назначения — решение принимается, видя условия отделов. */
function _conclCommissionBlock(app){
  const c = _conclOf(app);
  if (!c.assigned.length) return '';
  const cards = c.assigned.map(a => _conclCard(app, a.dept)).join('');
  return `<div class="concl-com">
    <div class="section-h">Заключения отделов (${c.assigned.length})</div>
    ${_conclChips(app)}${cards}</div>`;
}
```

В `renderCommission(app)` в ветке фазы A («Предварительное изучение») вставить `${_conclCommissionBlock(app)}` после списка обязательных документов, перед кнопками фазы. Найти место:

```bash
grep -n "prelim\|Предварительное изучение" mockups/loan-application/loan-application.html | head
```

Редактор в этом блоке не появится: `can(app).editConcl(dept)` требует роль `dept` и фазу `draft`, а комиссия смотрит на `phase==='review'`.

- [ ] **Step 8: CSS блока в комиссии**

Дописать после CSS редактора:

```css
.concl-com{ margin:18px 0 0; }
.concl-com .section-h{ margin:0 0 10px; }
.concl-com .vchips{ margin-bottom:10px; }
```

- [ ] **Step 9: Запустить проверку**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все `PASS` (T1–T6), `NO JS ERRORS`.

- [ ] **Step 10: Коммит**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs
git commit -m "feat(mockup): заключения — гейт отправки, красный узел пайплайна, сброс при возврате, свод в комиссии (P3-R39)"
```

---

### Task 7: Скриншот, TODO, STATUS

**Files:**
- Modify: `scripts/inspect/conclusions-check.mjs` (финальный скриншот)
- Modify: `TODO.md`
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: всё предыдущее
- Produces: `.auth/conclusions.png`, запись `P3-R39` в `TODO.md`

- [ ] **Step 1: Скриншот в конце проверки**

В `scripts/inspect/conclusions-check.mjs` перед `console.log(results.join('\n'))` вставить:

```js
// Скриншот: демо-заявка, все карточки раскрыты, редактор — у своего отдела (юридический).
// Страницу перезагружаем: предыдущие блоки намеренно мутировали состояние заявок.
await page.reload({ waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => {
  setRole('dept');
  gotoDetail('З-2026-000105', 'tab-concl'); showTab('tab-concl');
  setDept('legal');
  conclToggleAll();
});
await page.waitForTimeout(300);
await page.screenshot({ path:'.auth/conclusions.png', fullPage:true });
```

- [ ] **Step 2: Запустить, посмотреть скриншот**

Run: `node scripts/inspect/conclusions-check.mjs`
Expected: все `PASS`, `NO JS ERRORS`, файл `.auth/conclusions.png` создан.

Открыть `.auth/conclusions.png` и проверить глазами: чипы-счётчики читаются, карточки не разъезжаются, редактор виден только у «Юридического отдела» (свой отдел), у остальных — тело на чтение.

- [ ] **Step 3: Запись в `TODO.md`**

После записи `P3-R38` добавить:

```markdown
- [ ] P3-R39 🟠 Заявка · вкладка «Заключения»: назначение отделов, ЖЦ заключения, отрицательный вердикт как гейт
  - сейчас: макет знал 4 захардкоженных отдела (риск · залог · юр · кредит), обязательных всегда; любой пользователь роли «Отдел» правил все четыре блока; заключение — плоская запись «вердикт + текст» без ЖЦ, вложений и истории; отрицательный вердикт ничего не блокировал, «С условиями» был свободным текстом;
  - процесс (со слов заказчика 2026-07-10): состав отделов назначает **кредитный специалист** с черновика — риск и кредитный отдел несъёмные, залоговый добавляется автоматически при наличии залога, сверх них добавляется **любой** отдел справочника (аналитики, юр, безопасности, мониторинга); запрос уходит **на отдел** (не на сотрудника), **срока нет**; внесение открывается только после подтверждения комплекта **головным филиалом**; отдел видит все вкладки заявки на чтение;
  - сделано в макете (to-be, 2026-07-10, `mockups/loan-application/loan-application.html`):
    - **справочник** `DEPT_DIR` (7 отделов) вместо `CONCL_DEPTS`; состояние `app._concl = { assigned[], items{} }`;
    - **панель назначения**: чипы отделов, 🔒 у несъёмных с причиной в тултипе, снятие непустого отдела — через подтверждение (`modal-concl-unassign`), добор — селектом «+ Добавить отдел»;
    - **ЖЦ заключения** `pending → draft → submitted`: «Внести» замораживает тело, «Отозвать» (`modal-concl-withdraw`) снимает вердикт, сохраняя текст, условия и вложения; каждое действие пишется в **историю** карточки;
    - **условия — список пунктов** (обязателен ≥ 1 при вердикте «С условиями»), **вложения** (фиктивные записи), валидация: без вердикта / без текста / `neg` короче 20 символов не вносится;
    - **отрицательное блокирует** отправку в комиссию — узел «Заключения отделов» в пайплайне краснеет, причина гейта называет отдел; выход один: устранить замечания → отдел отзывает → вносит новое (отклонения по заключению отдела и эскалации «вопреки» нет);
    - **роль «Отдел»** несёт конкретный отдел (селектор `#deptSel` рядом со свитчером роли) — правит только свой блок;
    - **возврат комиссией** (`comreq`) сбрасывает внесённые заключения в черновик, содержимое сохраняется;
    - **комиссия** на фазе «Предварительное изучение» видит read-only свод заключений с условиями;
    - вкладка «Заключения» стала **безусловной** (назначение идёт с черновика);
  - спек — `docs/superpowers/specs/2026-07-10-loan-app-conclusions-tab-design.md`;
  - эталон-функции: `DEPT_DIR`/`_conclOf`/`_conclSeed`/`_conclSyncColl`/`_conclLocked`/`_conclCounts`/`_conclNegDepts`/`conclusionsReady`, `conclAssign`/`conclUnassign`, `conclSubmit`/`conclSaveDraft`/`conclWithdraw`/`conclClear`, `_conclResetByCommission`, `_conclCommissionBlock`, `can(app).editConcl(dept)`;
  - проверка — `scripts/inspect/conclusions-check.mjs`;
  - **хвост:** процесс записан со слов заказчика, на live-стенде не сверялся — отдельной задачей проверить и вынести в спек `requirements/tz/03-zayavka-komissiya.md`; серверную валидацию «нет отрицательных заключений» перед сменой статуса заявки подтвердить отдельно (UI-гейт защитой не является).
```

В записи `P3-R35` в подпункте «вкладка «Заключения»» дописать в конец строки:

```markdown
 — **переработана в `P3-R39`** (назначение отделов, ЖЦ, отрицательный вердикт как гейт).
```

- [ ] **Step 4: `STATUS.md`**

Обновить строку `Last updated` на `2026-07-10` и добавить в раздел мокапов/фаз строку:

```markdown
- Макет заявки: вкладка «Заключения» переработана (`P3-R39`) — отделы назначает специалист,
  ЖЦ «черновик → внесено» с отзывом, отрицательный вердикт блокирует комиссию.
  Проверка: `node scripts/inspect/conclusions-check.mjs`.
```

- [ ] **Step 5: Проверить синк TODO**

Run: `python3 scripts/sync_todos.py --dry-run`
Expected: строки `P3-R39` печатаются, ошибок нет. (Живой пуш сделает `PostToolUse`-хук после правки `TODO.md` через Claude Code; при правке внешним редактором — `python3 scripts/sync_todos.py`.)

- [ ] **Step 6: Финальный прогон + коммит**

```bash
node scripts/inspect/conclusions-check.mjs
git add mockups/loan-application/loan-application.html scripts/inspect/conclusions-check.mjs TODO.md STATUS.md
git commit -m "docs(sdd): заключения — запись P3-R39 в TODO, отметка в STATUS, скриншот проверки"
```

---

## Проверка покрытия спека

| Раздел спека | Задача |
|---|---|
| §2.1 назначение специалистом, дефолты, залоговый авто | T1 (сид, `_conclSyncColl`, `_conclLocked`), T3 (панель) |
| §2.2 запрос на отдел, срока нет | T2 (роль без исполнителя, дедлайнов нет нигде) |
| §2.3 внесение после ГФ, отдел видит вкладки | T2 (`editConcl` требует `confirmedMet`) |
| §2.4 ЖЦ черновик → внесено, отзыв | T5 |
| §2.5 вердикты, отрицательное блокирует, cond не блокирует | T1 (`conclusionsReady`), T5 (валидация), T6 (гейт, пайплайн) |
| §2.6 одно заключение на отдел, вложения | T1 (модель), T5 (вложения) |
| §2.7 возврат комиссией сбрасывает вердикт | T6 (`_conclResetByCommission`) |
| §3 модель данных | T1 |
| §4 роли и права | T2 |
| §5.1 гейт-баннер | T4 |
| §5.2 сводка вердиктов | T4 |
| §5.3 панель назначения | T3 |
| §5.4 карточка, редактор, валидация, отзыв | T4 (чтение), T5 (редактор) |
| §6 гейт, пайплайн, видимость вкладки, комиссия, возврат | T6 |
| §7 демо-сид | T1 |
| §8 что удаляется | T1 (`CONCL_DEPTS`, `_conclusionsOf`, `_conclDone`, `conclSave`), T6 (`cond` у вкладки) |
| §9 границы | T7 (хвосты в TODO) |
