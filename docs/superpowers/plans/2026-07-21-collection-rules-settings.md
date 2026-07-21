# Страница настройки правил доступности мер — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отдельный экран «Настройки» в макете взыскания с живым редактированием четырёх осей правил доступности мер (В-9 роль×мера, стадия раздела, гейты орган/поручение, порядок фаз контура), переживающим F5.

**Architecture:** Все редактируемые структуры собираются в единый мутабельный `RULES`, сид = замороженные копии текущих констант (`RULES_DEFAULTS`, источник сброса). Гейт-функции (`subdivOf`, `subdivReason`, `sequenceReason`, `gateReason`, `contourOfPhase`) и рендеры читают `RULES.*` вместо литералов. Правки на экране `#settings` мутируют `RULES`, сохраняются в отдельный ключ localStorage и сразу отражаются в списке доступных мер у процессов.

**Tech Stack:** Единый self-contained HTML/JS файл `mockups/collection/collection.html` (без сборки, vanilla JS, template-strings рендер). Тесты — jsdom-харнесс `scripts/inspect/collection-check.mjs`.

## Global Constraints

- **Один файл, без сборки.** Весь код — в `mockups/collection/collection.html`. Никаких новых файлов, зависимостей, внешних ресурсов (строгая самодостаточность макета).
- **Дизайн-система gov-blue.** Новые элементы используют существующие CSS-классы (`.btn`, `.btn-tint`, `.btn-secondary`, `.cgrid`, `.panel-wrap`, `.pill`, `.section-h`, `.section-note`, `.view`). Новые стили — только если нет подходящего класса.
- **Русский язык интерфейса.** Все подписи, тосты, заголовки — на русском.
- **Демо-персист через localStorage.** Ключ правил `asubk-collection-rules-v1` — отдельно от ключа процессов `asubk-collection-state-v1`. `?reset` в URL чистит оба.
- **Только правила между существующими сущностями.** Не добавлять/не удалять фазы, разделы, роли, виды мер. Вкладка «Фазы» — только переупорядочивание.
- **Проверка после каждой задачи:** `node scripts/inspect/collection-check.mjs` — существующие 57 проверок остаются зелёными (`ПРОВАЛЕНО: 0`).
- **`CONTOUR_LEVEL` не редактируется** — остаётся константой; в `RULES` уходит только `SECTION_CLEVEL` (ось «стадия раздела»).

---

## Обзор структуры файла

**Модифицируется только `mockups/collection/collection.html`** и тест-харнесс `scripts/inspect/collection-check.mjs`.

Карта затрагиваемых участков `collection.html` (номера строк — на момент написания плана, свериться перед правкой):

| Участок | Строки | Роль |
|---|---|---|
| `MEASURE_SUBDIV`, `ROLE_SUBDIV`, `SECTION_SUBDIV` | 868–890 | В-9 матрица (сид) |
| `subdivOf`, `subdivReason`, `canRegisterMeasures` | 891–909 | чтение В-9 |
| `GATES`, `gateReason` | 928–944 | гейты орган/поручение |
| `CONTOUR_LEVEL`, `SECTION_CLEVEL` | 955–959 | ступени эскалации (сид) |
| `contourOfPhase`, `sequenceReason` | 960–982 | последовательность фаз |
| `phaseTimeline` | 2419–2427 | таймлайн (читает порядок фаз) |
| панель «Комитеты» (таблица гейтов) | 2486–2496 | read-only отображение гейтов |
| фильтр-бар (дропдаун фаз) | 2905 | читает порядок фаз |
| `persistState`/`restoreState`/`resetDemo` | 2568–2578 | демо-персист процессов (образец) |
| topbar `<header>` | 493–512 | шапка (кнопка-шестерёнка) |
| контейнеры `<section class="view">` | 516–600 | вставка `#view-settings` |
| `showView`, `setHash`, `restoreFromHash` | 2840–2856 | переключение видов |
| bootstrap-строка | 2963 | инициализация (вызов `restoreRules`) |

Новые сущности (все в `collection.html`): `RULES_DEFAULTS`, `RULES`, `deepClone`, `deepFreeze`, `phasesOf`, `RULES_KEY`, `persistRules`, `restoreRules`, `resetRulesAll`, `resetRulesSection`, `settingsTab`, `renderSettings`, `showSettingsTab`, `renderSettingsV9`, `renderSettingsStage`, `renderSettingsGates`, `renderSettingsPhases`, `toggleV9`, `setRoleSubdiv`, `setSectionClevel`, `toggleGate`, `movePhase`.

---

## Task 1: Слой `RULES` — единый источник правил, рероут чтения

**Files:**
- Modify: `mockups/collection/collection.html` (вставка блока после строки 959; правки чтения на 891, 896, 907, 936, 960, 965, 971, 976, 980, 2420–2421, 2492–2494, 2905)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Produces:
  - `RULES` — `let`-объект с ключами `measureSubdiv` (obj kind→string[]), `sectionSubdiv` (obj section→string[]), `roleSubdiv` (obj role→string), `sectionClevel` (obj section→number), `gates` (obj kind→{organ?,point,label,poruchenie?}), `contourPhases` (obj contourKey→string[]).
  - `RULES_DEFAULTS` — замороженная глубокая копия сида (та же форма).
  - `deepClone(o)` → глубокая копия через JSON.
  - `phasesOf(contourKey)` → `string[]` порядок фаз контура из `RULES`.

- [ ] **Step 1: Написать провальный тест (регрессия + идентичность сиду)**

Вставить в `scripts/inspect/collection-check.mjs` перед строкой финального вывода итога (после последней существующей проверки, до `console.log` с «ВСЕГО ПРОВЕРОК»):

```javascript
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL на проверках 58–62 (`RULES is not defined` / `phasesOf is not defined`), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Вставить блок `RULES` после строки 959 (после `const SECTION_CLEVEL = …`)**

```javascript
/* ============================================================
   RULES — ЖИВОЙ СЛОЙ ПРАВИЛ доступности мер (редактируется на #settings).
   Сид = глубокие копии констант выше; RULES_DEFAULTS заморожен → источник сброса.
   Все гейты и рендеры читают RULES.*, а не литералы. Персист — ключ RULES_KEY.
   CONTOUR_LEVEL не редактируется (остаётся константой). ============ */
const deepClone = o => JSON.parse(JSON.stringify(o));
function deepFreeze(o){ Object.values(o).forEach(v=>{ if(v && typeof v==='object') deepFreeze(v); }); return Object.freeze(o); }
const RULES_DEFAULTS = deepFreeze({
  measureSubdiv: deepClone(MEASURE_SUBDIV),
  sectionSubdiv: deepClone(SECTION_SUBDIV),
  roleSubdiv:    deepClone(ROLE_SUBDIV),
  sectionClevel: deepClone(SECTION_CLEVEL),
  gates:         deepClone(GATES),
  contourPhases: Object.fromEntries(Object.keys(CONTOURS).map(c=>[c, CONTOURS[c].phases.slice()])),
});
let RULES = deepClone(RULES_DEFAULTS);
const phasesOf = c => (RULES.contourPhases[c] || (CONTOURS[c] ? CONTOURS[c].phases : []));
```

- [ ] **Step 4: Переключить чтение В-9 на `RULES` (строки 891, 896, 907)**

Строка 891 — было:
```javascript
const subdivOf = kind => MEASURE_SUBDIV[kind] || SECTION_SUBDIV[sectionOf(kind)] || null;
```
стало:
```javascript
const subdivOf = kind => RULES.measureSubdiv[kind] || RULES.sectionSubdiv[sectionOf(kind)] || null;
```

Строка 896 (внутри `subdivReason`) — было `const my = ROLE_SUBDIV[role] || '—';` стало `const my = RULES.roleSubdiv[role] || '—';`

Строка 907 (внутри `canRegisterMeasures`) — было `if((ROLE_SUBDIV[role] || '—') === '—') return false;` стало `if((RULES.roleSubdiv[role] || '—') === '—') return false;`

- [ ] **Step 5: Переключить чтение гейтов и стадии на `RULES` (строки 936, 965)**

Строка 936 (внутри `gateReason`) — было `const g = GATES[kind];` стало `const g = RULES.gates[kind];`

Строка 965 (внутри `sequenceReason`) — было:
```javascript
  const secL = SECTION_CLEVEL[sectionOf(kind)] ?? 1;
```
стало:
```javascript
  const secL = RULES.sectionClevel[sectionOf(kind)] ?? 1;
```
(`curL` из `CONTOUR_LEVEL` на строке 963 НЕ меняем — контурные уровни остаются константой.)

- [ ] **Step 6: Переключить чтение порядка фаз на `phasesOf` (строки 960, 971, 976, 980, 2420–2421, 2905)**

Строка 960 — было:
```javascript
function contourOfPhase(ph){ for(const c in CONTOURS){ if(CONTOURS[c].phases.includes(ph)) return c; } return null; }
```
стало:
```javascript
function contourOfPhase(ph){ for(const c in CONTOURS){ if(phasesOf(c).includes(ph)) return c; } return null; }
```

Строка 971 — было `for(const c in CONTOURS){ const idx=CONTOURS[c].phases.indexOf(ph); if(idx>=0){ C=c; i=idx; break; } }`
стало `for(const c in CONTOURS){ const idx=phasesOf(c).indexOf(ph); if(idx>=0){ C=c; i=idx; break; } }`

Строка 976 — было `const j = CONTOURS[C].phases.indexOf(p.phase);` стало `const j = phasesOf(C).indexOf(p.phase);`

Строка 980 — было `const prereq = CONTOURS[C].phases[i-1];` стало `const prereq = phasesOf(C)[i-1];`

Строки 2420–2421 (внутри `phaseTimeline`) — было:
```javascript
  const p=curProc; const cont=CONTOURS[p.contour]; if(!cont) return '';
  let phases=cont.phases.slice();
```
стало:
```javascript
  const p=curProc; if(!CONTOURS[p.contour]) return '';
  let phases=phasesOf(p.contour).slice();
```

Строка 2905 (фильтр-бар) — было `const phases   = f.contour ? CONTOURS[f.contour].phases : [];` стало `const phases   = f.contour ? phasesOf(f.contour) : [];`

- [ ] **Step 7: Переключить таблицу гейтов в панели «Комитеты» на `RULES.gates` (строки 2492–2494)**

Было:
```javascript
  const gateRows=Object.keys(GATES).map(k=>{
    const r=gateReason(p,k);
    return `<tr><td>${GATES[k].label}</td><td>${GATES[k].poruchenie?'Председатель Правления':GATES[k].organ}</td><td>п. ${GATES[k].point}</td>
```
стало:
```javascript
  const gateRows=Object.keys(RULES.gates).map(k=>{
    const r=gateReason(p,k);
    return `<tr><td>${RULES.gates[k].label}</td><td>${RULES.gates[k].poruchenie?'Председатель Правления':RULES.gates[k].organ}</td><td>п. ${RULES.gates[k].point}</td>
```

- [ ] **Step 8: Запустить тесты — убедиться, что всё зелёное**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 62 · ПРОВАЛЕНО: 0`, `ОШИБОК КОНСОЛИ (jsdomError): 0`.

- [ ] **Step 9: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): слой RULES — единый источник правил доступности мер

Четыре оси правил (В-9, стадия раздела, гейты, порядок фаз) собраны в
мутабельный RULES поверх замороженного RULES_DEFAULTS. Гейты и рендеры
читают RULES.* вместо литералов. Поведение не меняется (регрессия зелёная).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Персист и сброс правил

**Files:**
- Modify: `mockups/collection/collection.html` (вставка после `resetDemo`, строка 2578; правка bootstrap строка 2963)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `RULES`, `RULES_DEFAULTS`, `deepClone` (Task 1).
- Produces:
  - `RULES_KEY` = `'asubk-collection-rules-v1'`.
  - `persistRules()` — пишет `RULES` в localStorage.
  - `restoreRules()` — читает снимок в `RULES` (мутирует по ключам); при `?reset` чистит ключ.
  - `resetRulesAll()` — `RULES` ← `deepClone(RULES_DEFAULTS)`, persist.
  - `resetRulesSection(key)` — сброс одной секции `RULES[key]` ← дефолт, persist.

- [ ] **Step 1: Написать провальный тест**

Вставить в `scripts/inspect/collection-check.mjs` после блока Task 1:

```javascript
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL 63–65 (`persistRules is not defined`), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Вставить функции персиста после строки 2578 (после `resetDemo`)**

```javascript
/* Персист ПРАВИЛ — отдельный ключ от процессов. При смене схемы правил поднять версию. */
const RULES_KEY='asubk-collection-rules-v1';
function persistRules(){ try{ localStorage.setItem(RULES_KEY, JSON.stringify(RULES)); }catch(e){} }
function restoreRules(){
  try{
    if(/[?&]reset\b/.test(location.search)){ localStorage.removeItem(RULES_KEY); return; }
    const raw=localStorage.getItem(RULES_KEY); if(!raw) return;
    const data=JSON.parse(raw); if(!data || typeof data!=='object') return;
    Object.keys(RULES_DEFAULTS).forEach(k=>{ if(data[k]!=null) RULES[k]=data[k]; });
  }catch(e){}
}
function resetRulesAll(){ RULES=deepClone(RULES_DEFAULTS); persistRules(); }
function resetRulesSection(key){ RULES[key]=deepClone(RULES_DEFAULTS[key]); persistRules(); }
```

- [ ] **Step 4: Вызвать `restoreRules()` в bootstrap (строка 2963)**

Было:
```javascript
restoreState(); renderNav(); renderFilterBar(); renderChips(); renderList(); restoreFromHash();
```
стало (restoreRules ПЕРЕД restoreState, чтобы правила были готовы к первому рендеру):
```javascript
restoreRules(); restoreState(); renderNav(); renderFilterBar(); renderChips(); renderList(); restoreFromHash();
```

- [ ] **Step 5: Запустить тесты**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 65 · ПРОВАЛЕНО: 0`.

- [ ] **Step 6: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): демо-персист и сброс правил RULES

Отдельный ключ localStorage asubk-collection-rules-v1; restoreRules в
bootstrap; ?reset чистит и правила. resetRulesAll/resetRulesSection.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Экран «Настройки» — каркас, навигация, переключение вкладок

**Files:**
- Modify: `mockups/collection/collection.html` (topbar 493–512; вставка `<section id="view-settings">` после `view-list` блока ~543; `showView` 2842–2844; `restoreFromHash` 2854; вставка рендер-функций перед bootstrap)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `showView`, `setHash` (существуют); `resetRulesAll` (Task 2).
- Produces:
  - `settingsTab` — `let`-строка активной вкладки, старт `'v9'`.
  - `renderSettings()` — рендерит табы + тело активной вкладки в `#settingsHost`.
  - `showSettingsTab(tab)` — ставит `settingsTab`, зовёт `renderSettings()`.
  - Функции-заглушки `renderSettingsV9/Stage/Gates/Phases()` возвращают строку (наполняются в Task 4–7; сейчас возвращают `'<div class="section-note">—</div>'`).

- [ ] **Step 1: Написать провальный тест**

Вставить после блока Task 2:

```javascript
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL 66–70 (`Cannot read properties of null` — нет `#view-settings`), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Добавить кнопку-шестерёнку в topbar (после строки 511, перед `</header>` на 512)**

Вставить сразу после закрывающего `</div>` блока `role-wrap` (строка 511):
```html
      <button class="menu" title="Настройки правил" style="margin-left:12px;background:none;border:none" onclick="showView('settings')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
```

- [ ] **Step 4: Вставить контейнер `#view-settings` после закрытия `view-list` (после строки 543, перед комментарием DETAIL VIEW)**

```html
      <!-- ============ SETTINGS VIEW ============ -->
      <section class="view" id="view-settings">
        <div class="grid-wrap" style="padding:16px;display:block;overflow:auto">
          <div class="settings-tabbar" id="settingsTabbar"></div>
          <div id="settingsHost"></div>
        </div>
        <div class="footer">
          <button class="btn btn-secondary" onclick="if(confirm('Сбросить ВСЕ правила к дефолту?')){resetRulesAll();renderSettings();renderList();toast('Все правила сброшены к дефолту','ok');}">Сбросить все правила</button>
          <div style="flex:1"></div>
          <button class="btn btn-secondary" onclick="showView('list')">Закрыть</button>
        </div>
      </section>
```

- [ ] **Step 5: Добавить стили вкладок (в конце `<style>`-блока — найти закрывающий `</style>` и вставить перед ним)**

```css
.settings-tabbar{ display:flex; gap:4px; border-bottom:1px solid var(--border-strong); margin-bottom:16px; }
.settings-tab{ padding:8px 16px; cursor:pointer; border:none; background:none; font:var(--font-label); color:var(--text-muted); border-bottom:2px solid transparent; }
.settings-tab.active{ color:var(--brand); border-bottom-color:var(--brand); font-weight:600; }
.settings-grid{ border-collapse:collapse; width:100%; }
.settings-grid th,.settings-grid td{ border:1px solid var(--border-strong); padding:6px 10px; text-align:center; font:var(--font-body); }
.settings-grid th:first-child,.settings-grid td:first-child{ text-align:left; }
.warn-badge{ color:#b45309; font-size:12px; white-space:nowrap; }
```

(Если переменные `--brand`/`--border-strong`/`--font-label`/`--font-body`/`--text-muted` отсутствуют — свериться с `:root` в начале файла и подставить существующие аналоги. Класс `.warn-badge` цвет `#b45309` — не зависит от переменных.)

- [ ] **Step 6: Вставить рендер-функции настроек перед bootstrap-строкой (перед строкой `restoreRules(); restoreState(); …`)**

```javascript
/* ============================================================
   ЭКРАН НАСТРОЕК ПРАВИЛ (#settings). Четыре вкладки; каждая правит одну ось RULES,
   зовёт persistRules() и перерисовку. Наблюдатель-роль сюда доступ имеет — это админ-экран.
   ============================================================ */
let settingsTab='v9';
const SETTINGS_TABS=[['v9','В-9 «Кому»'],['stage','Стадии'],['gates','Гейты'],['phases','Фазы']];
function renderSettings(){
  const bar=SETTINGS_TABS.map(([k,l])=>`<button class="settings-tab${k===settingsTab?' active':''}" onclick="showSettingsTab('${k}')">${l}</button>`).join('');
  document.getElementById('settingsTabbar').innerHTML=bar;
  const body={v9:renderSettingsV9,stage:renderSettingsStage,gates:renderSettingsGates,phases:renderSettingsPhases}[settingsTab]();
  document.getElementById('settingsHost').innerHTML=body;
}
function showSettingsTab(tab){ settingsTab=tab; renderSettings(); }
function renderSettingsV9(){ return '<div class="section-note">—</div>'; }
function renderSettingsStage(){ return '<div class="section-note">—</div>'; }
function renderSettingsGates(){ return '<div class="section-note">—</div>'; }
function renderSettingsPhases(){ return '<div class="section-note">—</div>'; }
```

- [ ] **Step 7: Зарегистрировать вид в `showView` и `restoreFromHash`**

`showView` (строка 2842) — добавить заголовок в объект `titles`:
```javascript
  const titles={list:'Взыскание задолженности',hearings:'Реестр заседаний',claims:'Реестр претензий',committee:'Вопросы на коллегиальные органы',deadlines:'Сроки на контроле',settings:'Настройки правил доступности мер'};
```
И перед `if(titles[v]) …` (строка 2843) добавить рендер настроек при входе:
```javascript
  if(v==='settings') renderSettings();
```

`restoreFromHash` (строка 2854) — добавить `'settings'` в список видов:
```javascript
  const views=['list','hearings','claims','committee','deadlines','settings'];
```

- [ ] **Step 8: Запустить тесты**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 70 · ПРОВАЛЕНО: 0`.

- [ ] **Step 9: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): экран Настройки — каркас, шестерёнка, вкладки

Вид #settings с 4 вкладками (В-9/Стадии/Гейты/Фазы), кнопка в шапке,
persist вида в hash, глобальный сброс. Тела вкладок — заглушки.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Вкладка «В-9 Кому» — грид роль×мера + таблица ролей

**Files:**
- Modify: `mockups/collection/collection.html` (тело `renderSettingsV9`; добавить `toggleV9`, `setRoleSubdiv`)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `RULES`, `MEASURE_KINDS`, `SECTION_ORDER`, `sectionOf`, `subdivOf`, `availableKinds`, `persistRules`, `renderSettings`, `renderList` (существуют/Task 1–3).
- Produces:
  - `V9_SUBDIVS` = `['ДАК','ОД','РП','ДПО','ОПК','САК']` — столбцы грида.
  - `toggleV9(kind, subdiv)` — инвертирует наличие `subdiv` в `RULES.measureSubdiv[kind]` (материализует из `subdivOf` при первой правке), persist + перерисовка.
  - `setRoleSubdiv(role, subdiv)` — пишет `RULES.roleSubdiv[role]`, persist + перерисовка.

- [ ] **Step 1: Написать провальный тест**

Вставить после блока Task 3:

```javascript
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL 71–74 (`toggleV9 is not defined`, грид пуст), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Заменить заглушку `renderSettingsV9` и добавить хендлеры**

Заменить `function renderSettingsV9(){ return '<div class="section-note">—</div>'; }` на:
```javascript
const V9_SUBDIVS=['ДАК','ОД','РП','ДПО','ОПК','САК'];
function renderSettingsV9(){
  const head=`<tr><th>Вид меры</th>${V9_SUBDIVS.map(s=>`<th>${s}</th>`).join('')}<th></th></tr>`;
  const rows=SECTION_ORDER.map(sec=>{
    const kinds=MEASURE_KINDS.filter(k=>sectionOf(k)===sec);
    if(!kinds.length) return '';
    const secRow=`<tr><td colspan="${V9_SUBDIVS.length+2}" style="background:var(--surface-page);font-weight:600;text-align:left">${sec}</td></tr>`;
    const body=kinds.map(k=>{
      const allowed=subdivOf(k)||[];
      const cells=V9_SUBDIVS.map(s=>`<td><input type="checkbox" ${allowed.includes(s)?'checked':''} onchange="toggleV9('${k.replace(/'/g,"\\'")}','${s}')"></td>`).join('');
      const warn=allowed.length===0?'<td class="warn-badge">⚠ никто не сможет зарегистрировать</td>':'<td></td>';
      return `<tr><td>${k}</td>${cells}${warn}</tr>`;
    }).join('');
    return secRow+body;
  }).join('');
  const roleRows=Object.keys(RULES.roleSubdiv).map(role=>{
    const opts=['—',...V9_SUBDIVS].map(s=>`<option ${RULES.roleSubdiv[role]===s?'selected':''}>${s}</option>`).join('');
    return `<tr><td>${role}</td><td><select onchange="setRoleSubdiv('${role.replace(/'/g,"\\'")}',this.value)">${opts}</select></td></tr>`;
  }).join('');
  return `<p class="section-note">Галочка = подразделение может регистрировать этот вид меры (матрица В-9). Пусто в строке — вид недоступен никому.</p>
    <table class="settings-grid"><thead>${head}</thead><tbody>${rows}</tbody></table>
    <p class="section-h" style="margin-top:20px">Роль → подразделение</p>
    <table class="settings-grid" style="max-width:520px"><thead><tr><th>Роль</th><th>Подразделение</th></tr></thead><tbody>${roleRows}</tbody></table>
    <div style="margin-top:12px"><button class="btn btn-tint" onclick="resetRulesSection('measureSubdiv');resetRulesSection('sectionSubdiv');resetRulesSection('roleSubdiv');renderSettings();renderList();toast('В-9 сброшена к дефолту','ok')">Сбросить В-9 к дефолту</button></div>`;
}
function toggleV9(kind, subdiv){
  const cur=(RULES.measureSubdiv[kind] || subdivOf(kind) || []).slice();
  const i=cur.indexOf(subdiv);
  if(i>=0) cur.splice(i,1); else cur.push(subdiv);
  RULES.measureSubdiv[kind]=cur;
  persistRules(); renderSettings(); renderList();
}
function setRoleSubdiv(role, subdiv){ RULES.roleSubdiv[role]=subdiv; persistRules(); renderSettings(); renderList(); }
```

- [ ] **Step 4: Запустить тесты**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 74 · ПРОВАЛЕНО: 0`.

- [ ] **Step 5: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): вкладка В-9 — грид роль×мера + таблица ролей

Чекбоксы подразделение×вид (48 строк, группировка по разделам), правка
пишет RULES.measureSubdiv; таблица роль→подразделение; бейдж-предупреждение
для видов без подразделений; сброс секции.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Вкладка «Стадии» — ступень доступности раздела

**Files:**
- Modify: `mockups/collection/collection.html` (тело `renderSettingsStage`; добавить `setSectionClevel`)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `RULES`, `SECTION_ORDER`, `sequenceReason`, `persistRules`, `renderSettings`, `renderList`.
- Produces:
  - `setSectionClevel(section, level)` — пишет `RULES.sectionClevel[section]=Number(level)`, persist + перерисовка.

- [ ] **Step 1: Написать провальный тест**

Вставить после блока Task 4:

```javascript
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL 75–76 (`setSectionClevel is not defined`), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Заменить заглушку `renderSettingsStage` и добавить хендлер**

Заменить `function renderSettingsStage(){ return '<div class="section-note">—</div>'; }` на:
```javascript
function renderSettingsStage(){
  const rows=SECTION_ORDER.map(sec=>{
    const cur=RULES.sectionClevel[sec] ?? 1;
    const opts=[0,1,2,3,4,5].map(n=>`<option ${cur===n?'selected':''}>${n}</option>`).join('');
    return `<tr><td>${sec}</td><td><select onchange="setSectionClevel('${sec.replace(/'/g,"\\'")}',this.value)">${opts}</select></td></tr>`;
  }).join('');
  return `<p class="section-note">Ступень эскалации, начиная с которой раздел доступен. Раздел открывается, когда контур процесса достиг этой ступени (0 — с самого начала, 5 — только на безнадёжной). Уровни контуров: К0=0, К1=1, К2/К3/К5=2, К4=3, К6=4, К7=5.</p>
    <table class="settings-grid" style="max-width:520px"><thead><tr><th>Раздел</th><th>Мин. ступень</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:12px"><button class="btn btn-tint" onclick="resetRulesSection('sectionClevel');renderSettings();renderList();toast('Стадии сброшены к дефолту','ok')">Сбросить стадии к дефолту</button></div>`;
}
function setSectionClevel(section, level){ RULES.sectionClevel[section]=Number(level); persistRules(); renderSettings(); renderList(); }
```

- [ ] **Step 4: Запустить тесты**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 76 · ПРОВАЛЕНО: 0`.

- [ ] **Step 5: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): вкладка Стадии — ступень доступности раздела

Селект мин. ступени эскалации на раздел (RULES.sectionClevel), сброс секции.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Вкладка «Гейты» — активность гейта органа/поручения

**Files:**
- Modify: `mockups/collection/collection.html` (тело `renderSettingsGates`; добавить `toggleGate`; правка `gateReason` строка 937 — флаг `off`)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `RULES`, `gateReason`, `persistRules`, `renderSettings`, `renderList`, `PROCESSES`.
- Produces:
  - `toggleGate(kind)` — инвертирует `RULES.gates[kind].off` (гейт активен ⟺ `off` не установлен), persist + перерисовка.

**Модель:** каждая запись `GATES` — ОДНО требование (орган ИЛИ поручение Председателя, для «Исковое заявление» — поручение). Двух взаимоисключающих тумблеров нет: один переключатель «гейт активен» на запись, тип требования показывается справочно. Добавление гейта к виду без гейта — вне охвата (требует метаданных organ/point/label, которых у чекбокса нет); зафиксировано как YAGNI-урезание относительно дизайн-дока.

- [ ] **Step 1: Написать провальный тест**

Вставить после блока Task 5:

```javascript
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL 77–78 (`toggleGate is not defined`), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Добавить флаг `off` в `gateReason` (строка 937)**

Было:
```javascript
  const g = RULES.gates[kind];
  if(!g) return null;
```
стало:
```javascript
  const g = RULES.gates[kind];
  if(!g || g.off) return null;   // гейт отключён на #settings
```

- [ ] **Step 4: Заменить заглушку `renderSettingsGates` и добавить хендлер**

Заменить `function renderSettingsGates(){ return '<div class="section-note">—</div>'; }` на:
```javascript
function renderSettingsGates(){
  const rows=Object.keys(RULES.gates).map(k=>{
    const g=RULES.gates[k];
    const req=g.poruchenie?'поручение Председателя Правления':(g.organ||'решение органа');
    return `<tr><td>${k}</td>
      <td><input type="checkbox" ${g.off?'':'checked'} onchange="toggleGate('${k.replace(/'/g,"\\'")}')"></td>
      <td class="section-note" style="text-align:left">${req} · п. ${g.point||'—'}</td></tr>`;
  }).join('');
  return `<p class="section-note">Какие виды мер требуют предварительного решения перед регистрацией. Снятая галочка — гейт отключён (мера регистрируется без решения органа/поручения). Тип требования у каждого гейта фиксирован справочником.</p>
    <table class="settings-grid"><thead><tr><th>Вид меры</th><th>Гейт активен</th><th>Что требуется</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:12px"><button class="btn btn-tint" onclick="resetRulesSection('gates');renderSettings();renderList();toast('Гейты сброшены к дефолту','ok')">Сбросить гейты к дефолту</button></div>`;
}
function toggleGate(kind){
  const g=RULES.gates[kind]; if(!g) return;
  if(g.off) delete g.off; else g.off=true;
  persistRules(); renderSettings(); renderList();
}
```

- [ ] **Step 5: Запустить тесты**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 78 · ПРОВАЛЕНО: 0`.

- [ ] **Step 6: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): вкладка Гейты — активность гейта органа/поручения

Один переключатель «гейт активен» на запись GATES (флаг off), тип
требования справочно; gateReason уважает off; сброс секции.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Вкладка «Фазы» — переупорядочивание вех контура

**Files:**
- Modify: `mockups/collection/collection.html` (тело `renderSettingsPhases`; добавить `movePhase`)
- Test: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `RULES`, `CONTOURS`, `phasesOf`, `sequenceReason`, `persistRules`, `renderSettings`, `renderList`, `PROCESSES`.
- Produces:
  - `movePhase(contour, i, dir)` — меняет местами вехи `i` и `i+dir` в `RULES.contourPhases[contour]` (границы игнорируются), persist + перерисовка.

- [ ] **Step 1: Написать провальный тест**

Вставить после блока Task 6:

```javascript
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: FAIL 79–81 (`movePhase is not defined`), `ПРОВАЛЕНО` ≥ 1.

- [ ] **Step 3: Заменить заглушку `renderSettingsPhases` и добавить хендлер**

Заменить `function renderSettingsPhases(){ return '<div class="section-note">—</div>'; }` на:
```javascript
function renderSettingsPhases(){
  const blocks=Object.keys(CONTOURS).map(c=>{
    const phases=phasesOf(c);
    const items=phases.map((ph,i)=>`<tr>
      <td style="text-align:left">${i+1}. ${ph}</td>
      <td><button class="btn btn-tint" ${i===0?'disabled':''} onclick="movePhase('${c}',${i},-1)" title="Вверх">↑</button>
          <button class="btn btn-tint" ${i===phases.length-1?'disabled':''} onclick="movePhase('${c}',${i},1)" title="Вниз">↓</button></td></tr>`).join('');
    return `<div class="phase-contour" style="margin-bottom:16px">
      <p class="section-h">${c} · ${CONTOURS[c].name}</p>
      <table class="settings-grid" style="max-width:520px"><tbody>${items}</tbody></table></div>`;
  }).join('');
  return `<p class="section-note">Порядок вех внутри контура задаёт последовательность-предусловие для вех-мер (§3.1): веха на позиции i требует предыдущей фазы φ(i−1). Добавление/удаление фаз недоступно — только переупорядочивание.</p>
    ${blocks}
    <div style="margin-top:12px"><button class="btn btn-tint" onclick="resetRulesSection('contourPhases');renderSettings();renderList();toast('Порядок фаз сброшен к дефолту','ok')">Сбросить порядок фаз к дефолту</button></div>`;
}
function movePhase(contour, i, dir){
  const arr=RULES.contourPhases[contour]; if(!arr) return;
  const j=i+dir; if(j<0 || j>=arr.length) return;
  [arr[i],arr[j]]=[arr[j],arr[i]];
  persistRules(); renderSettings(); renderList();
}
```

- [ ] **Step 4: Запустить тесты**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -3`
Expected: `ВСЕГО ПРОВЕРОК: 81 · ПРОВАЛЕНО: 0`.

- [ ] **Step 5: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): вкладка Фазы — переупорядочивание вех контура

Кнопки ↑/↓ на вехах контура (RULES.contourPhases), меняют предусловие
последовательности; добавление/удаление недоступно; сброс секции.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Интеграционная проверка и браузерный смоук

**Files:**
- Modify: (правки только если найден дефект) `mockups/collection/collection.html`
- Test: `scripts/inspect/collection-check.mjs` (запуск полного набора)

**Interfaces:**
- Consumes: всё из Task 1–7.
- Produces: подтверждённый рабочий экран настроек.

- [ ] **Step 1: Полный прогон харнесса**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -4`
Expected: `ВСЕГО ПРОВЕРОК: 81 · ПРОВАЛЕНО: 0`, `ОШИБОК КОНСОЛИ (jsdomError): 0`.

- [ ] **Step 2: Проверить сквозной персист правил в браузере**

Поднять локальный сервер и открыть в Chrome (порт по образцу прошлых сессий):
```bash
cd mockups/collection && python3 -m http.server 8971 >/dev/null 2>&1 &
```
Через `claude-in-chrome` (tabs_context → tabs_create на `http://localhost:8971/collection.html`):
1. Открыть шестерёнку → вкладка «Стадии» → сменить «Судебный» на ступень 4.
2. Проверить `localStorage.getItem('asubk-collection-rules-v1')` содержит `"Судебный":4`.
3. Перезагрузить страницу (реальный reload). Открыть настройки → «Стадии» → значение «Судебный» = 4 сохранилось.
4. Открыть любой досудебный процесс (напр. 204) → в списке видов мер судебные пропали (ступень 4 не достигнута).
5. Нажать «Сбросить все правила» → значение вернулось к 2, судебные меры доступны по прежним правилам.

Expected: все пять пунктов проходят. Если нет — зафиксировать дефект и исправить в `collection.html`, повторить Step 1.

- [ ] **Step 3: Очистить тестовый снимок и остановить сервер**

Через `claude-in-chrome` javascript_tool: `localStorage.removeItem('asubk-collection-rules-v1'); localStorage.removeItem('asubk-collection-state-v1')`.
Остановить http.server (найти PID `lsof -ti:8971` и `kill`).

- [ ] **Step 4: Обновить прогресс-леджер (если ведётся)**

Проверить `.superpowers/sdd/progress.md` — при наличии раздела по взысканию дописать строку о странице настройки правил (дата 2026-07-21, файл спеки/плана). Если раздела нет — пропустить.

- [ ] **Step 5: Commit (если были правки в Step 2 или Step 4)**

```bash
git add -A
git commit -m "chore(collection): интеграционная проверка страницы настройки правил

Полный прогон харнесса зелёный (81/81), браузерный смоук персиста правил.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** слой RULES + рероут (Task 1) ✓; персист/сброс (Task 2) ✓; навигация+каркас (Task 3) ✓; вкладка В-9 «Кому» с предупреждением о нуле подразделений (Task 4) ✓; вкладка Стадии (Task 5) ✓; вкладка Гейты — включение/отключение (Task 6) ✓; вкладка Фазы reorder-only (Task 7) ✓; тесты-регрессия + браузерный персист (Task 1–8) ✓. `?reset` чистит оба ключа — Task 2 Step 3 ✓.
- **Урезание относительно дизайн-дока:** «добавить гейт к виду без гейта» (§Гейты дизайна) убрано по YAGNI — чекбокс не может задать метаданные organ/point/label новой записи; Task 6 переключает активность только существующих 4 гейтов. При необходимости добавления — отдельная итерация.
- **Плейсхолдеры:** нет — каждый шаг содержит реальный код/команду.
- **Согласованность типов:** `RULES` ключи (`measureSubdiv`/`sectionSubdiv`/`roleSubdiv`/`sectionClevel`/`gates`/`contourPhases`) едины во всех задачах; `phasesOf`, `persistRules`, `resetRulesSection`, `renderSettings`, `renderList` вызываются с одинаковыми сигнатурами; хендлеры (`toggleV9`/`setRoleSubdiv`/`setSectionClevel`/`toggleGate`/`movePhase`) определены каждый в своей задаче и не пересекаются по имени.
- **Замечание по CONTOUR_LEVEL:** намеренно оставлен константой (не в RULES) — ось «стадии» правит только `SECTION_CLEVEL`; зафиксировано в Global Constraints и Task 1 Step 5.
