# Интерактивный ввод судебных заседаний (макет «Взыскание») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two interactive actions to the «Суд» tab of `mockups/collection/collection.html` — «Назначить заседание» (schedule a hearing) and «Внести исход» (record its outcome) — closing the gap where `p.hearings[]` could only be populated by seed data.

**Architecture:** Two new modal flows (`openHearingModal`/`saveHearing` and `openHearingOutcomeModal`/`saveHearingOutcome`), mirroring the existing `openCommitteeQuestionModal`/`openDecisionModal` pair in `panelKomitety()`. A hearing's «мера-основание» candidate list is derived (not stored) from `curProc.measures` via a new pure helper `hearingCandidates(r)`, reusing the `resultIsDocument && source==='наш документ'` flag pair already on `MEASURE_KINDS` (no new reference list). `panelSud()` gets a `gtoolbar` above the hearings table (button gated by the existing `canRegisterMeasures()`) and a new action column on each hearing row.

**Tech Stack:** Single self-contained HTML/JS file (`mockups/collection/collection.html`), no build step. Verified with the jsdom smoke harness `scripts/inspect/collection-check.mjs` (`node scripts/inspect/collection-check.mjs`).

## Global Constraints

- No optional chaining (`?.`) anywhere in `collection.html` — the file uses none; follow the existing `kd && kd.field` style (see `renderMBasedOn`).
- Exactly two hearing kinds, both already in use — `'Извещение о назначении судебного процесса'` (no outcome, see `HEARING_NO_OUTCOME_KINDS`) and `'Судебный процесс'` (has outcome). No free text, no third value.
- No schema change to `p.hearings[]` (stays `{measureNum, kind, place, when, participants[], outcome}`) and no `STORE_KEY` version bump (`persistState()`/`restoreState()` untouched).
- No editing of a hearing's outcome after it is saved — the «Внести исход» button must not re-render once `hDone(h)` is true.
- Do not touch `hearingsOf`, `hearingDeadlines`, `dlOf`, `hDone`, `hApplicable`, `hLeft`, `hRep`, the «Заседания (реестр)» registry, or `persistState`/`restoreState` — they already read `p.hearings` live (ADR-0001) and need no changes.
- Every interpolated string in rendered HTML goes through `escAttr(...)`.
- History entries follow the existing convention: `curProc.history.unshift({when:TODAY+' HH:MM', what:'...', who:role})`.
- Verification command for every step: `node scripts/inspect/collection-check.mjs` — must end with `ПРОВАЛЕНО: 0` and exit code 0.
- Spec: `docs/superpowers/specs/2026-08-07-collection-hearings-entry-design.md`. Context: ADR-0026, ADR-0031.

**Design note (deviation from the spec's literal wording, same intent):** the spec's field table names a new helper `tinp()` "по образцу `dinp()`". Closer reading of the codebase shows `dinp()`/`inp()`/`sel()` are only ever used for fields that do **not** participate in live Save-gating (e.g. `mDateEvent` in `openMeasureModal`); every field that gates a Save button (`mKind`, `mMsYears`, …) is hand-written inline with its own `onchange`/`oninput` handler calling the sync function, never routed through a generic helper. Every hearing-modal field (мера-основание, вид, место, дата, время) gates Save, so all five are hand-written the same way — a value-only `tinp()` would never be called and is dead code. It is dropped. The one genuinely new, genuinely reused helper is a `textarea` field — `ta()` — used for «Участники» in **both** modals (not gated, so a plain helper is correct there), mirroring `inp()`'s shape and reusing the already-defined-but-unused `.note-area` CSS class (`collection.html:592,602,732`).

---

### Task 1: Hearing helpers — `HEARING_KINDS`, `hearingCandidates()`, `ta()`

**Files:**
- Modify: `mockups/collection/collection.html:7639` (add `ta()` next to `dinp`)
- Modify: `mockups/collection/collection.html:8264` (add `HEARING_KINDS` + `hearingCandidates()` next to `courtActsOf`)
- Test: `scripts/inspect/collection-check.mjs` (new section after the КР-16 block, line 3135)

**Interfaces:**
- Produces: `HEARING_KINDS` — `['Извещение о назначении судебного процесса', 'Судебный процесс']` (array, index 0 is the form's default selection).
- Produces: `hearingCandidates(r)` — `(r) => Measure[]`; live measures on requirement `r` whose kind is a «мера-обращение» (`kindOf(m.kind).resultIsDocument && kindOf(m.kind).source==='наш документ'`), reusing `liveMeasuresOf(r)` (same storno handling as `courtActsOf`).
- Produces: `ta(label, value, id)` — `(string, string, string) => string`; renders `<div class="field col-span"><span class="flabel">${label}</span><div class="control"><textarea id="${id}" class="note-area">${escAttr(value)}</textarea></div></div>`.
- Consumed by: Task 2 (`openHearingModal`), Task 3 (`openHearingOutcomeModal`).

- [ ] **Step 1: Write the failing test**

Open `scripts/inspect/collection-check.mjs`, find this block (around line 3126-3136):

```js
head('КР-16 · границы волны');
/* МП5-17 добавила пятый гейт («Заявление о выдаче судебного приказа», п.21 приказная
   ветвь), а «Безакцептное списание» с п.16.5 несёт organByProject (развилка по типу
   проекта), не organ — обе формы органа проверяются через gateOrgans (§6.3), а не
   через голое `.organ`. */
ok('вкладка «Гейты» настроек по-прежнему читается',
   g.ev(`Object.keys(RULES.gates).length === 5`)
   && g.ev(`Object.keys(RULES.gates).every(k=>gateOrgans(RULES.gates[k]).length && !!RULES.gates[k].point && !!RULES.gates[k].topic)`));
ok('реестр требований и карточка волной не тронуты',   // затравка ЗС выросла волнами: 9 вкладок (КД-4) · 116 требований
   g.ev(`TABS.length === 9`) && g.ev(`allReqs().length === 116`));
```

Immediately after that last `ok(...)` call (before the `/* ADR-0031: жалоба фазу не двигает...` comment), insert:

```js

head('Назначение заседания — хелперы (ADR-0031 п.4)');
ok('HEARING_KINDS — ровно два вида, в порядке «извещение → процесс»',
   g.ev(`HEARING_KINDS.join('|')`) === 'Извещение о назначении судебного процесса|Судебный процесс');
ok('hearingCandidates — «мера-обращение» по требованию (333: только ИСК-333)',
   g.ev(`hearingCandidates(${R('333/333/з')}).map(m=>m.num).join(',')`) === 'ИСК-333');
ok('hearingCandidates — пусто, если дело не дошло до иска/жалобы/заявления (307, стадия «повторная»)',
   g.ev(`hearingCandidates(${R('307/307/з')}).length`) === 0);
ok('ta() — textarea в поле col-span, значение экранировано',
   /class="field col-span">.*<textarea id="xId" class="note-area">a &amp; b<\/textarea>/s.test(g.ev(`ta('L','a & b','xId')`)));
```

- [ ] **Step 2: Run and verify it fails**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -B1 -A6 "Назначение заседания — хелперы"`
Expected: all four lines under the new `head` print `FAIL` (with `! eval:` lines above them — `HEARING_KINDS`/`hearingCandidates`/`ta` are not defined yet).

- [ ] **Step 3: Implement `ta()`**

In `mockups/collection/collection.html`, find (line 7639):

```js
const dinp = (l,v,id)=>`<div class="field"><span class="flabel">${l}</span><div class="control grey"><input type="date"${id?` id="${id}"`:''} value="${escAttr(v||'')}"></div></div>`;
```

Add immediately after it:

```js
const ta = (l,v,id)=>`<div class="field col-span"><span class="flabel">${l}</span><div class="control"><textarea id="${id}" class="note-area">${escAttr(v||'')}</textarea></div></div>`;
```

- [ ] **Step 4: Implement `HEARING_KINDS` and `hearingCandidates()`**

Find `courtActsOf` (line 8264):

```js
const courtActsOf = r => liveMeasuresOf(r).filter(m=>COURT_ACT_KINDS.has(m.kind) && m.basedOn);
```

Add immediately after it (before the `ADR-0029 п.2` comment / `basedOnValid` function):

```js
/* ADR-0031 п.4: заседание крепится к мере-обращению — иску, жалобе, заявлению. Не
   заводим отдельный флаг на видах меры — resultIsDocument+«наш документ» уже и
   только у этих 13 (все судебные обращения), см. MEASURE_KINDS. */
const HEARING_KINDS = ['Извещение о назначении судебного процесса', 'Судебный процесс'];
const hearingCandidates = r => liveMeasuresOf(r).filter(m => {
  const kd = kindOf(m.kind);
  return kd && kd.resultIsDocument && kd.source === 'наш документ';
});
```

- [ ] **Step 5: Run and verify it passes**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -B1 -A6 "Назначение заседания — хелперы"`
Expected: all four lines print `ok`. Then run the full suite (`node scripts/inspect/collection-check.mjs`) and confirm the trailing summary is unchanged except for `+4` in `ВСЕГО ПРОВЕРОК` and `ПРОВАЛЕНО: 0`.

- [ ] **Step 6: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): хелперы для ввода судебных заседаний (HEARING_KINDS, hearingCandidates, ta)"
```

---

### Task 2: «Назначить заседание» — modal, save, toolbar button

**Files:**
- Modify: `mockups/collection/collection.html:9117` (`panelSud()` — add `gtoolbar` above the hearings table)
- Modify: `mockups/collection/collection.html:9121` (insert new functions right after `panelSud()`, before `panelKomitety()`)
- Test: `scripts/inspect/collection-check.mjs` (extend the section added in Task 1)

**Interfaces:**
- Consumes: `hearingCandidates(r)`, `ta()`, `HEARING_KINDS` (Task 1); `caret()`, `xIcon()`, `escAttr`, `ruDate`, `currentRole()`, `canRegisterMeasures()`, `curProc`, `curReq`, `TODAY`, `closeModal()`, `renderPanels()`, `toast()` (all pre-existing).
- Produces: `openHearingModal()` — no args, reads `curReq`/`curProc`.
- Produces: `syncHearingSave()` — no args; toggles `#hSave.disabled` based on `#hMeasure`/`#hKind`/`#hPlace`/`#hDate`/`#hTime`.
- Produces: `saveHearing()` — no args; pushes `{measureNum, kind, place, when, participants, outcome:''}` onto `curProc.hearings`.
- Consumed by: Task 3 places its own functions right after `saveHearing()` in the same block.

- [ ] **Step 1: Write the failing test**

Append to the `head('Назначение заседания — хелперы (ADR-0031 п.4)')` section added in Task 1 (right after the `ta()` assertion):

```js

{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('модалка: 1 кандидат (ИСК-333), Save заблокирован до заполнения места/даты/времени', m.ev(`(() => {
    openDetail('333/333/з', TAB_BY_SLUG('sud'));
    openHearingModal();
    const opts=[...document.querySelectorAll('#hMeasure option')].map(o=>o.value);
    if(opts.join(',') !== 'ИСК-333') return false;
    if(!document.getElementById('hSave').disabled) return false;
    document.getElementById('hPlace').value='Кантский районный суд'; syncHearingSave();
    document.getElementById('hDate').value='2026-09-15'; syncHearingSave();
    document.getElementById('hTime').value='10:00'; syncHearingSave();
    return !document.getElementById('hSave').disabled;
  })()`));
  ok('saveHearing пишет запись в p.hearings и в историю', m.ev(`(() => {
    const before = curProc.hearings.length;
    saveHearing();
    const h = curProc.hearings[curProc.hearings.length-1];
    return curProc.hearings.length === before+1
      && h.measureNum === 'ИСК-333' && h.kind === 'Извещение о назначении судебного процесса'
      && h.place === 'Кантский районный суд' && h.when === '15.09.2026 10:00' && h.outcome === ''
      && h.participants[0] === 'Отдел проблемных кредитов (ОПК) (представитель ФКФ)'
      && /Заседание назначено: /.test(curProc.history[0].what);
  })()`)); }
{ const m = mk(); m.setRole('Куратор ОД / ДАК / РП');
  ok('без меры-обращения в деле (307) — подсказка вместо выбора, Save недоступен', m.ev(`(() => {
    openDetail('307/307/з', TAB_BY_SLUG('sud'));
    openHearingModal();
    return !document.getElementById('hMeasure')
      && /нет ни одной меры-обращения/.test(document.getElementById('modalHost').textContent)
      && document.getElementById('hSave').disabled;
  })()`));
  ok('кнопка «Назначить заседание» видна при праве регистрировать меры (307, роль Куратор ОД/ДАК/РП)', m.ev(`(() => {
    openDetail('307/307/з', TAB_BY_SLUG('sud'));
    return /onclick="openHearingModal\\(\\)"/.test(document.querySelector('#detailPanels .detail-panel.active').innerHTML);
  })()`)); }
{ const m = mk(); m.setRole('Наблюдатель');
  ok('кнопка «Назначить заседание» скрыта у роли без подразделения (Наблюдатель)', m.ev(`(() => {
    openDetail('307/307/з', TAB_BY_SLUG('sud'));
    return !/onclick="openHearingModal\\(\\)"/.test(document.querySelector('#detailPanels .detail-panel.active').innerHTML);
  })()`)); }
```

- [ ] **Step 2: Run and verify it fails**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -B1 -A20 "Назначение заседания — хелперы"`
Expected: the four new checks fail (`openHearingModal is not defined`, etc.) while Task 1's four checks still pass.

- [ ] **Step 3: Add the toolbar button in `panelSud()`**

Find (line 9117):

```js
    <p class="section-h" style="margin-top:20px">Судебные заседания</p>
```

Replace with:

```js
    <div class="gtoolbar" style="margin-top:20px"><p class="section-h" style="margin:0">Судебные заседания</p><span class="spacer"></span>${canRegisterMeasures()?`<button class="btn btn-tint btn-sm" onclick="openHearingModal()">Назначить заседание</button>`:''}</div>
```

- [ ] **Step 4: Implement `openHearingModal()` and `syncHearingSave()`**

Find the end of `panelSud()` (line 9121, the closing `}` right before the `/* ---- panel: Комитеты ... ---- */` comment):

```js
      <tbody>${hear}</tbody></table></div></div>`;
}

/* ---- panel: Комитеты (вопросы на коллегиальные органы + гейты §6.3) ---- */
```

Insert between the closing `}` and the `/* ---- panel: Комитеты ... */` comment:

```js

/* ---- Назначение заседания (ADR-0031 п.4) — крепится к мере-обращению, требует
   мера-основание+вид+место+дата+время; заседание не мера, фазу не двигает (ADR-0026). ----- */
function openHearingModal(){
  const r=curReq; if(!r){ toast('Требование не выбрано','warn'); return; }
  const host=document.getElementById('modalHost');
  const cands=hearingCandidates(r);
  const role=currentRole();
  host.innerHTML=`<div class="modal form">
    <div class="modal-h"><span class="mt">Назначить заседание · требование ${r.id}</span><button class="modal-x" onclick="closeModal()">${xIcon()}</button></div>
    <div class="modal-b"><p class="section-note">Заседание крепится к мере-обращению — иску, жалобе, заявлению (ADR-0031 п.4).</p>
    <div class="mform">
      ${cands.length
        ? `<div class="field col-span"><span class="flabel">Мера-основание</span><div class="control grey"><select id="hMeasure" onchange="syncHearingSave()">${cands.map(m=>`<option value="${escAttr(m.num||'')}">${escAttr(m.num||m.kind)} · ${escAttr(m.kind)}</option>`).join('')}</select>${caret()}</div></div>`
        : `<div class="field col-span"><span class="flabel">Мера-основание</span><div class="hint-inline">В деле нет ни одной меры-обращения (иск/жалоба/заявление) по этому требованию — заседание можно будет назначить после её регистрации.</div></div>`}
      <div class="field"><span class="flabel">Вид события</span><div class="control grey"><select id="hKind" onchange="syncHearingSave()">${HEARING_KINDS.map(k=>`<option${k===HEARING_KINDS[0]?' selected':''}>${escAttr(k)}</option>`).join('')}</select>${caret()}</div></div>
      <div class="field"><span class="flabel">Место</span><div class="control grey"><input id="hPlace" oninput="syncHearingSave()"></div></div>
      <div class="field"><span class="flabel">Дата</span><div class="control grey"><input type="date" id="hDate" oninput="syncHearingSave()"></div></div>
      <div class="field"><span class="flabel">Время</span><div class="control grey"><input type="time" id="hTime" oninput="syncHearingSave()"></div></div>
      ${ta('Участники', role?`${role} (представитель ФКФ)`:'', 'hParticipants')}
    </div></div>
    <div class="modal-f"><button class="btn btn-secondary" onclick="closeModal()">Отмена</button><button class="btn btn-primary" id="hSave" onclick="saveHearing()">Сохранить</button></div>
  </div>`;
  host.classList.add('open');
  syncHearingSave();
}
function syncHearingSave(){
  const save=document.getElementById('hSave'); if(!save) return;
  const val=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
  save.disabled = !(val('hMeasure') && val('hKind') && val('hPlace') && val('hDate') && val('hTime'));
}
function saveHearing(){
  const r=curReq; if(!r) return;
  const val=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
  const measureNum=val('hMeasure'), kind=val('hKind'), place=val('hPlace'), date=val('hDate'), time=val('hTime');
  if(!measureNum || !kind || !place || !date || !time){ toast('Заполните меру-основание, вид, место, дату и время','warn'); return; }
  const participants=(document.getElementById('hParticipants').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const p=curProc;
  p.hearings=p.hearings||[];
  p.hearings.push({ measureNum, kind, place, when:`${ruDate(date)} ${time}`, participants, outcome:'' });
  const role=currentRole()||'—';
  p.history=p.history||[];
  p.history.unshift({when:TODAY+' 12:00', what:`Заседание назначено: ${kind} · ${place} · ${ruDate(date)} ${time}`, who:role});
  closeModal(); renderPanels(); toast('Заседание назначено (демо)','ok');
}
```

- [ ] **Step 5: Run and verify it passes**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -B1 -A20 "Назначение заседания — хелперы"`
Expected: all checks in the section print `ok`. Then run the full suite and confirm `ПРОВАЛЕНО: 0`.

- [ ] **Step 6: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): назначение судебного заседания — модалка, тулбар, сохранение"
```

---

### Task 3: «Внести исход» — action column, modal, save

**Files:**
- Modify: `mockups/collection/collection.html:9098-9120` (`panelSud()` — action column on the hearings table)
- Modify: `mockups/collection/collection.html` (insert new functions right after `saveHearing()`, added in Task 2)
- Test: `scripts/inspect/collection-check.mjs` (extend the section further)

**Interfaces:**
- Consumes: `ta()`, `hDone(h)`, `hApplicable(h)` (pre-existing); `escAttr`, `currentRole()`, `curProc`, `TODAY`, `closeModal()`, `renderPanels()`, `toast()`.
- Produces: `openHearingOutcomeModal(hearingIndex)` — `hearingIndex` is the index into `curProc.hearings` (not into the filtered `hearingsOf(r)` array).
- Produces: `syncHearingOutcomeSave()` — no args; toggles `#hoSave.disabled` based on `#hoOutcome`.
- Produces: `saveHearingOutcome(hearingIndex)` — writes `outcome`/`participants` onto `curProc.hearings[hearingIndex]`.

- [ ] **Step 1: Write the failing test**

Append to the same test section (after the last `ok(...)` from Task 2):

```js

{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('кнопка «Внести исход» — только у применимых заседаний без исхода (333: индексы 1 и 2, не 0)', m.ev(`(() => {
    openDetail('333/333/з', TAB_BY_SLUG('sud'));
    const html = document.querySelector('#detailPanels .detail-panel.active').innerHTML;
    return /openHearingOutcomeModal\\(1\\)/.test(html) && /openHearingOutcomeModal\\(2\\)/.test(html) && !/openHearingOutcomeModal\\(0\\)/.test(html);
  })()`));
  ok('saveHearingOutcome пишет исход, участников и историю; кнопка у этой строки исчезает', m.ev(`(() => {
    openDetail('333/333/з', TAB_BY_SLUG('sud'));
    openHearingOutcomeModal(1);
    document.getElementById('hoParticipants').value = 'Молдалиев Т.К. (представитель ФКФ)\\nОтветчик явился';
    document.getElementById('hoOutcome').value = 'иск удовлетворён частично';
    if(document.getElementById('hoSave').disabled) return false;
    saveHearingOutcome(1);
    const h = curProc.hearings[1];
    const html = document.querySelector('#detailPanels .detail-panel.active').innerHTML;
    return h.outcome === 'иск удовлетворён частично' && h.participants.length === 2
      && /Исход заседания внесён: /.test(curProc.history[0].what)
      && !/openHearingOutcomeModal\\(1\\)/.test(html) && /openHearingOutcomeModal\\(2\\)/.test(html);
  })()`));
  ok('Save заблокирован при пустом исходе', m.ev(`(() => {
    openDetail('333/333/з', TAB_BY_SLUG('sud'));
    openHearingOutcomeModal(2);
    return document.getElementById('hoSave').disabled;
  })()`)); }
```

- [ ] **Step 2: Run and verify it fails**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -B1 -A30 "Назначение заседания — хелперы"`
Expected: the three new checks fail (`openHearingOutcomeModal is not defined`); all prior checks in the section still pass.

- [ ] **Step 3: Add the action column to the hearings table in `panelSud()`**

Find (lines 9098-9110):

```js
  const hear=hearingsOf(r).map(h=>{
    const n=hLeft(h);
    // Ревью раунд1, IMPORTANT 4 (раунд2 фикс порядка): !hApplicable ДОЛЖНО стоять
    // ПОСЛЕ проверки n<0 — иначе предстоящее (ещё не наступившее) извещение теряет
    // отсчёт «предстоит · через N к.д.» и молча показывает «без исхода — уведомление»
    // раньше времени: применимость исхода вообще не вопрос, пока дата не наступила.
    const out=hDone(h)?escAttr(h.outcome)
      :n!=null&&n<0?(hApplicable(h)?'<span class="pill high">исход не внесён</span>':'<span class="dl-muted">без исхода — уведомление</span>')
      :`<span class="pill info">предстоит${n!=null?` · через ${n} к.д.`:''}</span>`;
    return `<tr>
    <td>${h.measureNum}${boundToReq(r,h.measureNum)===null?' '+dealLevelPill:''}</td><td>${h.kind}</td><td>${h.place}</td><td>${h.when}</td>
    <td>${(h.participants||[]).join('<br>')||'<span class="dl-muted">не указаны</span>'}</td><td>${out}</td></tr>`;}).join('')
    || `<tr><td colspan="6"><div class="cgrid-empty">Заседаний по требованию нет — иск по нему в суд не подавался либо дата ещё не назначена. Сводно по всем делам — реестр <span class="rowlink" onclick="navClick('Заседания (реестр)')">«Заседания»</span>.</div></td></tr>`;
```

Replace with:

```js
  const hear=hearingsOf(r).map(h=>{
    const n=hLeft(h);
    // Ревью раунд1, IMPORTANT 4 (раунд2 фикс порядка): !hApplicable ДОЛЖНО стоять
    // ПОСЛЕ проверки n<0 — иначе предстоящее (ещё не наступившее) извещение теряет
    // отсчёт «предстоит · через N к.д.» и молча показывает «без исхода — уведомление»
    // раньше времени: применимость исхода вообще не вопрос, пока дата не наступила.
    const out=hDone(h)?escAttr(h.outcome)
      :n!=null&&n<0?(hApplicable(h)?'<span class="pill high">исход не внесён</span>':'<span class="dl-muted">без исхода — уведомление</span>')
      :`<span class="pill info">предстоит${n!=null?` · через ${n} к.д.`:''}</span>`;
    const hi=p.hearings.indexOf(h);
    const act=(!hDone(h)&&hApplicable(h))?`<button class="btn btn-tint btn-sm" onclick="openHearingOutcomeModal(${hi})">Внести исход</button>`:'';
    return `<tr>
    <td>${h.measureNum}${boundToReq(r,h.measureNum)===null?' '+dealLevelPill:''}</td><td>${h.kind}</td><td>${h.place}</td><td>${h.when}</td>
    <td>${(h.participants||[]).join('<br>')||'<span class="dl-muted">не указаны</span>'}</td><td>${out}</td><td>${act}</td></tr>`;}).join('')
    || `<tr><td colspan="7"><div class="cgrid-empty">Заседаний по требованию нет — иск по нему в суд не подавался либо дата ещё не назначена. Сводно по всем делам — реестр <span class="rowlink" onclick="navClick('Заседания (реестр)')">«Заседания»</span>.</div></td></tr>`;
```

Then find the hearings table header (line 9119):

```js
      <thead><tr><th>Мера-основание</th><th>Вид события</th><th>Место</th><th>Дата / время</th><th>Участники</th><th>Исход</th></tr></thead>
```

Replace with:

```js
      <thead><tr><th>Мера-основание</th><th>Вид события</th><th>Место</th><th>Дата / время</th><th>Участники</th><th>Исход</th><th></th></tr></thead>
```

- [ ] **Step 4: Implement `openHearingOutcomeModal()`, `syncHearingOutcomeSave()`, `saveHearingOutcome()`**

Find the end of `saveHearing()` (added in Task 2, right before the `/* ---- panel: Комитеты ... ---- */` comment) and insert after it:

```js

/* ---- Внесение исхода заседания. Не мера — нет сторно-пары, но та же дисциплина:
   дыра «исход не внесён» закрывается один раз, кнопка после сохранения не рисуется. ----- */
function openHearingOutcomeModal(hi){
  const h=(curProc.hearings||[])[hi]; if(!h) return;
  const host=document.getElementById('modalHost');
  host.innerHTML=`<div class="modal form">
    <div class="modal-h"><span class="mt">Внести исход заседания</span><button class="modal-x" onclick="closeModal()">${xIcon()}</button></div>
    <div class="modal-b"><p class="section-note"><b>${escAttr(h.measureNum)}</b> · ${escAttr(h.kind)} · ${escAttr(h.place)} · ${escAttr(h.when)}</p>
    <div class="mform">
      ${ta('Участники', (h.participants||[]).join('\n'), 'hoParticipants')}
      <div class="field col-span"><span class="flabel">Исход</span><div class="control grey"><input id="hoOutcome" oninput="syncHearingOutcomeSave()"></div></div>
    </div></div>
    <div class="modal-f"><button class="btn btn-secondary" onclick="closeModal()">Отмена</button><button class="btn btn-primary" id="hoSave" onclick="saveHearingOutcome(${hi})">Сохранить</button></div>
  </div>`;
  host.classList.add('open');
  syncHearingOutcomeSave();
}
function syncHearingOutcomeSave(){
  const save=document.getElementById('hoSave'); if(!save) return;
  const el=document.getElementById('hoOutcome');
  save.disabled = !(el && el.value.trim());
}
function saveHearingOutcome(hi){
  const h=(curProc.hearings||[])[hi]; if(!h) return;
  const outcome=(document.getElementById('hoOutcome').value||'').trim();
  if(!outcome){ toast('Внесите исход','warn'); return; }
  h.outcome=outcome;
  h.participants=(document.getElementById('hoParticipants').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const role=currentRole()||'—';
  curProc.history=curProc.history||[];
  curProc.history.unshift({when:TODAY+' 12:30', what:`Исход заседания внесён: ${outcome}`, who:role});
  closeModal(); renderPanels(); toast('Исход внесён (демо)','ok');
}
```

- [ ] **Step 5: Run and verify it passes**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -B1 -A30 "Назначение заседания — хелперы"`
Expected: every check in the section prints `ok`. Then run the full suite (`node scripts/inspect/collection-check.mjs`) and confirm the trailing summary reads `ПРОВАЛЕНО: 0` with exit code 0 (`echo $?`).

- [ ] **Step 6: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(collection): внесение исхода судебного заседания — колонка действия, модалка, сохранение"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-08-07-collection-hearings-entry-design.md`):
- «Кандидаты «мера-основание»» → `hearingCandidates()`, Task 1. ✓ (implemented via `liveMeasuresOf`, a strict superset-safe equivalent of the spec's `!m.storno` check — also handles per-target storno via `stornoTargets`, matching `courtActsOf`'s own pattern.)
- «Модалка «Назначить заседание»» (all 6 fields, gating, write shape, history, close+render) → Task 2. ✓
- «Модалка «Внести исход»» (read-only header, участники+исход, gating, write, button disappears) → Task 3. ✓
- «Затронутые функции» — new: `openHearingModal`, `saveHearing`, `openHearingOutcomeModal`, `saveHearingOutcome` all present; `tinp` replaced by `ta` (see Global Constraints deviation note) since every gated field is hand-written, not helper-generated. `panelSud()` toolbar + action column → Tasks 2/3. Unchanged list (`hearingsOf`, `hearingDeadlines`, …) → untouched by all three tasks. ✓
- «Не-цель» bullets — no new hearing-kind reference (✓, `HEARING_KINDS` is exactly the 2 existing strings), no outcome re-edit (✓, button vanishes once `hDone`), no schema/version bump (✓, only existing `p.hearings[]` fields are written), no standalone attendance entity (✓, `participants[]` free-text lines). ✓

**Placeholder scan:** no TBD/TODO; every step has real, complete code; every test assertion has real expected values (not stubbed).

**Type/signature consistency:** `hearingCandidates(r)` (Task 1) called with a requirement object in Task 2's `openHearingModal` — matches. `openHearingOutcomeModal(hi)`/`saveHearingOutcome(hi)`/`syncHearingOutcomeSave()` (Task 3) — `hi` consistently means "index into `curProc.hearings`" everywhere it's produced (`panelSud()`'s `p.hearings.indexOf(h)`) and consumed (`(curProc.hearings||[])[hi]`). `ta(l,v,id)` signature identical at both call sites (Task 2 `hParticipants`, Task 3 `hoParticipants`).
