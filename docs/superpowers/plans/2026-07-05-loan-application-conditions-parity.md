# Паритет условий заявки с программой — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Блок «Условия кредита» формы создания заявки (`#view-create`) становится дословной копией виджетов условий программы (вкладки 2–6 + reference-поля вкладки 1); программа = справка, не блокирует; расхождения помечаются.

**Architecture:** Переносим render-подсистему условий из `loan-program.html` в `loan-application.html`, но на локальный state-объект `cdraft` (аналог `draft` программы) и локальный ре-рендер `renderCond()` (аналог `renderWizBody`). Условия раскладываются 6 плоскими карточками-секциями внутри существующей `<section id="view-create">`. Значения выбранной программы кладутся в `_progSnapshot`, предзаполняют пустые поля и рисуются справкой (зачёркнуто + чип `⚑ отклонение`) при расхождении.

**Tech Stack:** Один self-contained HTML-файл, ванильный JS (template-string builders), без сборки/тестового раннера. Верификация — загрузка `file://…/loan-application.html` в браузере (claude-in-chrome / playwright) и проверка DOM/поведения.

## Global Constraints

- Файл self-contained: весь JS/CSS внутри `loan-application.html`. Никаких внешних include (конвенция мокапов, CLAUDE.md).
- Дизайн-система ASUBK gov-blue: не менять токены/классы; переиспользовать классы программы дословно ради визуального паритета.
- Русский язык интерфейса. Единицы: `%`, `мес.`, `дней`, `сом`.
- Значения-справочники берём из `loan-program.html` дословно (`LK`, `T2_REF`, `RATE_OPTS`, `T5_DUR_OPTS`) — не переизобретать.
- **Программа никогда не блокирует поле.** Она только предзаполняет и показывает справку/diff (управляющее правило спека, отменяет readonly-логику текущего `renderProgramConditions`).
- Мокап-деливерабл: реальную кодовую базу приложения (Jmix/Vaadin) не трогаем.
- Спек: `docs/superpowers/specs/2026-07-05-loan-application-conditions-parity-design.md`.
- Источник виджетов (анкеры даны на момент 2026-07-05): `mockups/loan-program/loan-program.html`.

---

### Task 1: State-объект `cdraft` + оркестрация ре-рендера условий + перенос CSS

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — HTML `#view-create` секция условий (1555–1631); JS рядом с create-логикой (после 3137); `<style>` (перенос недостающих классов).

**Interfaces:**
- Produces:
  - `cdraft` — объект state условий заявки (ключи из спека «Модель данных»).
  - `CP()` — фабрика дефолтного `cdraft` (аналог `P()` программы, `loan-program.html:964–981`), только condition-ключи.
  - `renderCond()` — перерисовывает контейнер `#cf-cond-body` из `cdraft`; вызывается после каждого изменения.
  - `saveCondInputs()` — снимает значения `[data-k]` внутри `#cf-cond-body` в `cdraft` (аналог `saveTabInputs` программы).
  - `esc()` — уже есть в заявке (`loan-application.html:3095`), переиспользовать.

- [ ] **Step 1: Заменить статический блок условий на контейнер-хост**

В `loan-application.html` заменить содержимое секции ② (строки 1556–1609, от `<div class="section-h">Условия кредита</div>` до закрытия `.cform-grid`) на:

```html
<div class="section-h">Условия кредита</div>
<div class="cform-grid">
  <div class="field required span2" id="cf-program-field">
    <span class="flabel">Кредитная программа</span>
    <div class="lookup">
      <span class="val" id="cf-program-val"></span>
      <button class="pick" onclick="openModal('modal-pick-program-create')" title="Выбрать">•••</button>
      <button onclick="clearPicker('cf-program')" title="Очистить" style="font-size:13px;color:var(--text-muted)">✕</button>
    </div>
    <span class="hint" id="cf-program-hint">Не выбрана — все условия задаются вручную</span>
    <span class="err">Поле является обязательным</span>
  </div>
</div>
<!-- Условия = дословная копия виджетов программы, рендерится из cdraft -->
<div id="cf-cond-body"></div>
```

Секцию ③ «Ручные параметры льготного периода» (1611–1631) удалить целиком — льготный период переезжает в секцию условий (Task 6). Секции ① Заявитель и ④ Доп.информация не трогать.

- [ ] **Step 2: Добавить фабрику `CP()` и state**

После строки 3137 (за `renderProgramConditions`) вставить. Значения-дефолты скопированы из `P()` программы (`loan-program.html:964–981`), оставлены только condition-ключи + добавлены `requestedAmount/requestedTerm`:

```js
/* ============================================================
   УСЛОВИЯ ЗАЯВКИ — дословная копия виджетов условий программы.
   cdraft = локальный state (аналог draft программы), renderCond = ре-рендер.
   Программа только предзаполняет и даёт справку; не блокирует (спек 2026-07-05).
   ============================================================ */
function CP(o){ return Object.assign({
  currency:'', source:'', kind:'', purpose:'', line:'', repayAcct:'',
  amountType:'Фиксированная', amountList:[], amountMin:'', amountMax:'', amountSel:null,
  termType:'Фиксированная',   termList:[], termMin:'', termMax:'', termSel:null,
  requestedAmount:'', requestedTerm:'',
  rateType:'Фиксированная', rateValues:[], rateMin:'', rateMax:'', floatRate:false, floatType:'', floatMargin:'',
  penaltyMainType:'Фиксированная', penaltyMainVal:'', penaltyMainFloatType:'',
  penaltyIntType:'Фиксированная', penaltyIntVal:'', penaltyIntFloatType:'', penaltyMaxPct:'20',
  graceMain:false, graceMainType:'', graceMainDur:[], graceMainDurFrom:'', graceMainDurTo:'', graceMainCond:'',
  graceAccr:false, graceAccrType:'', graceAccrDur:[], graceAccrDurFrom:'', graceAccrDurTo:'', graceAccrCond:'',
  graceInt:false,  graceIntType:'',  graceIntDur:[],  graceIntDurFrom:'',  graceIntDurTo:'',  graceIntCond:'',
  graceIntDistFrom:'', graceIntDistTo:'',
  payMode:'standard', periodicity:'', payMonths:[], payDay:'', weekend:'Не переносить',
  lastPaymentAnchor:'По дате первого платежа', dayCountNum:'Фактический', dayCountBase:'365',
  repayMethod:'Аннуитетный', queue:'', minDays:'', maxDays:''
}, o); }
let cdraft = CP({});
let _progSnapshot = null;   // значения выбранной программы для diff (Task 8)

// Справочники-значения — дословно из loan-program.html (LK, RATE_OPTS, T5_DUR_OPTS).
const CLK = {
  currency:['KGS','USD','EUR','RUB','KZT'],
  source:['Бюджет','Иностранные доноры','Собственные средства'],
  kind:['Бюджетный кредит','Бюджетная ссуда','Иностранный кредит'],
  purpose:['Пополнение оборотных средств','Инвестиции в осн. средства','Строительство','Рефинансирование','Приобретение техники/оборудования'],
  line:['АРР','ФРР','АБР','МАР','ВБ'],
  repayAcct:['Накопительный счёт','Бюджет'],
  penalty:['0,1%','0,2%','0,5%','1,0%'],
  payMonths:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  periodicity:['Ежемесячно','Ежеквартально','Раз в полгода','Ежегодно'],
  dayCountNum:['Финансовый (30)','Фактический'],
  dayCountBase:['360','365','Фактическая'],
  queue:['первочередный','Основная сумма → проценты → штрафы'],
  weekend:['Не переносить','Переносить на следующий рабочий день','Переносить на предыдущий рабочий день'],
  lastPaymentAnchor:['По дате первого платежа','По дате выдачи'],
  repayMethod:['Аннуитетный','Дифференцированный'],
};
const RATE_OPTS = ['4,00%','6,00%','8,00%','10,00%','12,00%'];
const T5_DUR_OPTS = ['1','3','6','12','18','24'];
```

- [ ] **Step 3: Добавить оркестрацию рендера**

Сразу после Step 2 вставить каркас (сами секции наполняются в Task 2–7 — здесь пустые заглушки, которые будут заменены):

```js
function renderCond(){
  saveCondInputs();
  const box = document.getElementById('cf-cond-body');
  if(!box) return;
  box.innerHTML =
      condSecParams()      // Task 2
    + condSecAmountTerm()  // Task 3
    + condSecRates()       // Task 4
    + condSecPenalty()     // Task 5
    + condSecGrace()       // Task 6
    + condSecPayments();   // Task 7
}
// временные заглушки, замещаются в следующих задачах:
function condSecParams(){ return ''; }
function condSecAmountTerm(){ return ''; }
function condSecRates(){ return ''; }
function condSecPenalty(){ return ''; }
function condSecGrace(){ return ''; }
function condSecPayments(){ return ''; }

function saveCondInputs(){
  const box = document.getElementById('cf-cond-body');
  if(!box) return;
  box.querySelectorAll('[data-k]').forEach(el=>{
    const k = el.dataset.k;
    if(el.type==='checkbox') cdraft[k] = el.checked;
    else cdraft[k] = el.value;
  });
}
```

- [ ] **Step 4: Инициализировать блок при открытии формы**

В `openCreateModal()` (`loan-application.html:2965`) заменить строку `renderProgramConditions(null);` (2971) на:

```js
  cdraft = CP({}); _progSnapshot = null; _condTouched = new Set();
  renderCond();
```
(`_condTouched` объявляется в Task 8 Step 1; если Task 8 ещё не выполнена, временно заменить на `renderCond();` без сброса.)

Удалить строки openCreateModal, ссылающиеся на удалённые id (`cf-method`, `cf-daymethod`, `cf-payday`, `cf-payday-field`, `cf-grace1..3`, `cf-amount`, `cf-term`, `cf-amount-range`, `cf-term-range`, `cf-amount-err`, `cf-term-err`) — строки 2974–2983, 2986–2987, 2994–2996. `cf-subject`/`cf-phone`/`cf-info`/`cf-addr` reset и `showView('create')` оставить.

- [ ] **Step 5: Перенести недостающий CSS**

Проверить, каких CSS-классов виджетов программы нет в заявке:

Run:
```bash
for c in t2-cols t2-range t2-sub t2-rowtools btn-rowadd btn-rowdel collgrid combo combo-pop combo-search combo-opts cval caret ms-combo ms-chip ms-pop warn-inline note-area char-count unit; do \
  a=$(grep -c "\.$c\b" mockups/loan-application/loan-application.html); \
  p=$(grep -c "\.$c\b" mockups/loan-program/loan-program.html); \
  echo "$c app=$a prog=$p"; done
```
Expected: строка по каждому классу. Для классов с `app=0 prog>0` — скопировать их CSS-правила из `<style>` программы в `<style>` заявки. Плюс добавить diff-классы:

```css
.cond-sec{margin-top:18px}
.control .unit{margin-left:6px;color:var(--text-muted);font-size:13px}
.cond-dev{display:inline-flex;align-items:center;gap:6px;margin-left:8px;font-size:12px;color:var(--danger,#c0392b)}
.cond-dev .prog-was{color:var(--text-muted);text-decoration:line-through}
```

- [ ] **Step 6: Verify — форма открывается, каркас пуст, ошибок нет**

Загрузить `file://<repo>/mockups/loan-application/loan-application.html`, нажать «Создать», в консоли выполнить:
```js
document.getElementById('cf-cond-body') !== null && typeof renderCond === 'function' && !!cdraft
```
Expected: `true`, нет ошибок в консоли, секция «Условия кредита» показывает поле «Кредитная программа» и пустой `#cf-cond-body`.

- [ ] **Step 7: Commit**

```bash
git add mockups/loan-application/loan-application.html docs/superpowers/plans/2026-07-05-loan-application-conditions-parity.md
git commit -m "feat(mockup): заявка — каркас cdraft/renderCond для блока условий"
```

---

### Task 2: Секция «Параметры» (combo-поля reference)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — заменить заглушку `condSecParams()`; добавить builders `condCombo` и helpers.

**Interfaces:**
- Consumes: `cdraft`, `CLK`, `renderCond`, `saveCondInputs`, `esc` (Task 1).
- Produces: `condCombo(label,key,opts,cfg)`, `condToggleCombo(e,key)`, `condPickCombo(key,val)`, `condFilterCombo(inp)`, `condDev(key)` (заглушка), `condSecParams()`.

- [ ] **Step 1: Портировать combo-builder программы, адаптировать под cdraft**

Скопировать `combo/comboToggle/comboPick/comboFilterInline` из `loan-program.html:1393–1413` как `condCombo/condToggleCombo/condPickCombo/condFilterCombo`. Адаптации: `draft`→`cdraft`, `saveTabInputs()`→`saveCondInputs()`, `renderWizBody()`→`renderCond()`, `comboOpenKey`→`condComboOpen`, id-префикс `combo_`→`ccombo_`. Вставить после `saveCondInputs` (Task 1 Step 3):

```js
let condComboOpen = null;
function condCombo(label, key, opts, cfg){
  cfg=cfg||{};
  const v=cdraft[key]||'';
  const open=condComboOpen===key;
  const o=opts.map(op=>`<div class="opt ${v===op?'sel':''}" data-v="${esc(op)}" onclick="condPickCombo('${key}','${esc(op)}')"><span class="mk">${v===op?'✓':''}</span>${esc(op)}</div>`).join('');
  return `<div class="field${cfg.req?' required':''}" data-field="${key}"><span class="flabel">${label}</span>
    <div class="combo ${open?'open':''}" id="ccombo_${key}" onclick="condToggleCombo(event,'${key}')">
      <span class="cval ${v?'filled':''}">${v?esc(v):'— выберите —'}</span>
      <span class="caret"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
      <div class="combo-pop" onclick="event.stopPropagation()">
        <input class="combo-search" placeholder="Поиск…" oninput="condFilterCombo(this)">
        <div class="combo-opts">${o}</div>
      </div>
    </div>${condDev(key)}${cfg.hint?`<span class="hint">${cfg.hint}</span>`:''}</div>`;
}
function condToggleCombo(e,key){ e.stopPropagation(); saveCondInputs(); condComboOpen=(condComboOpen===key?null:key); renderCond();
  if(condComboOpen===key){ const s=document.querySelector('#ccombo_'+key+' .combo-search'); if(s) s.focus(); } }
function condPickCombo(key,val){ saveCondInputs(); cdraft[key]=val; condComboOpen=null; if(typeof _condTouched!=='undefined')_condTouched.add(key); renderCond(); }
function condFilterCombo(inp){ const q=inp.value.toLowerCase();
  inp.closest('.combo-pop').querySelectorAll('.opt').forEach(o=>{ o.style.display=(!q||o.dataset.v.toLowerCase().includes(q))?'':'none'; }); }
function condDev(key){ return ''; }   // полная реализация — Task 8 Step 3
```

- [ ] **Step 2: Реализовать `condSecParams`**

Заменить заглушку `condSecParams(){ return ''; }` (Task 1 Step 3) на:

```js
function condSecParams(){
  return `<div class="cond-sec"><div class="section-h">Параметры</div><div class="cform-grid">
    ${condCombo('Валюта','currency',CLK.currency)}
    ${condCombo('Источник финансирования','source',CLK.source)}
    ${condCombo('Вид кредита','kind',CLK.kind)}
    ${condCombo('Назначение кредита','purpose',CLK.purpose)}
    ${condCombo('Кредитная линия','line',CLK.line)}
    ${condCombo('Вид счёта погашения','repayAcct',CLK.repayAcct)}
  </div></div>`;
}
```

- [ ] **Step 3: Verify — 6 combo-полей, выбор пишется в cdraft**

Открыть форму создания. В консоли:
```js
renderCond();
document.querySelectorAll('#cf-cond-body .combo').length
```
Expected: `>= 6`. Кликнуть «Валюта» → выбрать «USD»; проверить `cdraft.currency === 'USD'`. Визуально combo раскрывается и выглядит как в `loan-program.html`.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — секция «Параметры» (combo как в программе)"
```

---

### Task 3: Секция «Сумма и срок» (envelope Фикс/Диапазон + запрашиваемое значение)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — заглушка `condSecAmountTerm`; порт renderTab2-подсистемы; concrete-поля запроса.

**Interfaces:**
- Consumes: `cdraft`, `renderCond`, `saveCondInputs`, `esc`, `condDev`.
- Produces: `condF(label,key,opts)`, `t2col/t2add/t2del/t2sel/t2rangeMsg/t2num/joinRange` (адаптированные), `condSecAmountTerm()`, `condRange(kind)`, `validateReqAmount()/validateReqTerm()`.

- [ ] **Step 1: Портировать текстовый builder `f` → `condF`**

Скопировать `f` (`loan-program.html:1350–1364`) как `condF`. Адаптации: `draft`→`cdraft`; убрать `.err`-«обязательное»; добавить `type:'number'` и `unit`-суффикс; добавить `${condDev(key)}`; textarea-ветку сохранить для «Условия предоставления» (Task 6):

```js
function condF(label, key, opts){
  opts=opts||{};
  const type=opts.type||'text', hint=opts.hint||'', span=opts.span, unit=opts.unit||'', max=opts.max;
  const cls=`field${opts.req?' required':''}${span?' span2':''}`;
  const val=esc(cdraft[key]||'');
  const maxAttr = max?` maxlength="${max}"`:'';
  const suffix = unit?`<span class="unit">${unit}</span>`:'';
  const input = type==='textarea'
    ? `<textarea class="note-area" data-k="${key}"${maxAttr}>${val}</textarea>`
    : `<div class="control"><input type="${type==='number'?'number':'text'}" data-k="${key}" value="${val}"${maxAttr}>${suffix}</div>`;
  return `<div class="${cls}" data-field="${key}"><span class="flabel">${label}</span>${input}
    ${condDev(key)}${hint?`<span class="hint">${hint}</span>`:''}</div>`;
}
```

- [ ] **Step 2: Портировать renderTab2-подсистему**

Найти точные строки исходника:
Run: `grep -n "function t2add\|function t2del\|function t2sel\|function t2col\|const T2_REF\|const T2_PLUS\|const T2_TRASH\|function joinRange\|function t2num\|function t2rangeMsg" mockups/loan-program/loan-program.html`
Expected: номера строк перечисленных объявлений. Скопировать их тела целиком в заявку. Адаптации в каждом: `draft`→`cdraft`, `renderWizBody()`→`renderCond()`, `saveTabInputs()`→`saveCondInputs()`, `f(...)`→`condF(...)`. Удалить вызовы `t2syncStr()`/`t2hydrate()` legacy-парсинга; вместо `t2hydrate` тела оставить `function t2hydrate(){ if(cdraft._t2h)return; cdraft._t2h=true; cdraft.amountList=cdraft.amountList||[]; cdraft.termList=cdraft.termList||[]; }`. Классы `t2-cols/t2-range/t2-sub/collgrid/t2-rowtools/btn-rowadd/btn-rowdel` оставить дословно.

- [ ] **Step 3: Реализовать `condSecAmountTerm` + concrete-поля**

```js
function condSecAmountTerm(){
  t2hydrate();
  return `<div class="cond-sec"><div class="section-h">Сумма и срок</div>
    <div class="t2-cols">${t2col('amount')}${t2col('term')}</div>
    <div class="cform-grid" style="margin-top:12px">
      ${condF('Запрашиваемая сумма','requestedAmount',{type:'number',req:true,unit:'сом',hint:'Конкретная запрашиваемая сумма в рамках условий'})}
      ${condF('Запрашиваемый срок','requestedTerm',{type:'number',req:true,unit:'мес.',hint:'Конкретный запрашиваемый срок в рамках условий'})}
    </div></div>`;
}
```

- [ ] **Step 4: Валидация запрашиваемых значений в рамках envelope**

```js
function condRange(kind){
  const isAmt = kind==='amount';
  if(cdraft[isAmt?'amountType':'termType']==='Диапазон')
    return { min:t2num(cdraft[isAmt?'amountMin':'termMin']), max:t2num(cdraft[isAmt?'amountMax':'termMax']) };
  const list=(isAmt?cdraft.amountList:cdraft.termList).map(t2num).filter(n=>!isNaN(n));
  return list.length?{min:Math.min(...list),max:Math.max(...list)}:{min:NaN,max:NaN};
}
function validateReqAmount(){ const v=t2num(cdraft.requestedAmount),r=condRange('amount');
  return isNaN(v)?false:(isNaN(r.min)||(v>=r.min&&v<=r.max)); }
function validateReqTerm(){ const v=t2num(cdraft.requestedTerm),r=condRange('term');
  return isNaN(v)?false:(isNaN(r.min)||(v>=r.min&&v<=r.max)); }
```

- [ ] **Step 5: Verify — переключатель Фикс/Диапазон, grid add/del, диапазон-валидация**

Открыть форму. В консоли: `cdraft.amountType='Диапазон'; renderCond();` → появляются мин/макс поля. Вернуть `'Фиксированная'; renderCond();` → появляется collgrid с «Добавить». `cdraft.amountList=['100000','5000000']; cdraft.requestedAmount='9999999'; validateReqAmount()` → `false`; `cdraft.requestedAmount='200000'; validateReqAmount()` → `true`. Визуальная сверка колонок с вкладкой 2 программы.

- [ ] **Step 6: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — секция «Сумма и срок» (envelope + запрос)"
```

---

### Task 4: Секция «Ставки» (renderTab3: тип, multi-chip, плавающая)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — заглушка `condSecRates`; порт multi-select combo + чекбокс-builder.

**Interfaces:**
- Consumes: `cdraft`, `renderCond`, `saveCondInputs`, `condF`, `condCombo`, `condDev`, `RATE_OPTS`.
- Produces: `condMsCombo(label,key,opts,unit)`, `condMsToggle/condMsPick`, `condCheck(label,key)`, `condFloatTypes()`, `condSecRates()`.

- [ ] **Step 1: Портировать multi-select combo программы**

Найти источник:
Run: `grep -n "function msCombo\|msPick\|msToggle\|function renderTab3\|t3fixed\|floatRateType" mockups/loan-program/loan-program.html`
Expected: номера строк. Скопировать `msCombo` и его хендлеры как `condMsCombo/condMsToggle/condMsPick`. Адаптации: `draft`→`cdraft`, `renderWizBody`→`renderCond`, `saveTabInputs`→`saveCondInputs`; значение — массив в `cdraft[key]`; id-префикс `mscombo_`→`cmscombo_`; при выборе `_condTouched.add(key)` (guard `typeof`); добавить `${condDev(key)}`. Сохранить классы `ms-combo/ms-chip/ms-pop` дословно.

- [ ] **Step 2: Добавить `condCheck` (чекбокс-builder)**

Портировать `check` (`loan-program.html:1386–1388`) как `condCheck`, обёрнутый в full-width, с re-render:
```js
function condCheck(label, key){
  return `<label class="check" style="grid-column:1/-1"><input type="checkbox" data-k="${key}" ${cdraft[key]?'checked':''} onchange="saveCondInputs();if(typeof _condTouched!=='undefined')_condTouched.add('${key}');renderCond()"><span>${label}</span></label>`;
}
```

- [ ] **Step 3: Реализовать `condSecRates`**

Значения `condFloatTypes()` взять из `LK.floatRateType`/refbook программы (см. grep Step 1); если отдельного справочника нет — использовать перечень ниже, помеченный к сверке:
```js
function condFloatTypes(){ return ['Ключевая ставка НБКР','LIBOR','SOFR','EURIBOR']; } // сверить с refbook программы
function condSecRates(){
  const range = cdraft.rateType==='Диапазон';
  const float = cdraft.floatRate
    ? `${condCombo('Тип плавающей ставки','floatType',condFloatTypes())}${condF('Маржа к плавающей ставке','floatMargin',{unit:'%'})}`
    : '';
  return `<div class="cond-sec"><div class="section-h">Процентные ставки</div><div class="cform-grid">
    ${condCombo('Тип основной ставки','rateType',['Фиксированная','Диапазон'])}
    ${range ? condF('Значение ставки с','rateMin',{unit:'%'})+condF('Значение ставки по','rateMax',{unit:'%'})
            : condMsCombo('Значение фиксированной ставки','rateValues',RATE_OPTS,'%')}
    ${condCheck('Использовать плавающую ставку','floatRate')}
    ${float}
  </div></div>`;
}
```

- [ ] **Step 4: Verify — тип ставки, чипы, плавающая ветка**

Открыть форму. Консоль: `cdraft.rateType='Фиксированная';renderCond();` → мульти-combo ставок; выбрать 6,00% и 8,00% → `cdraft.rateValues` содержит оба. `cdraft.floatRate=true;renderCond();` → появляются «Тип плавающей» + «Маржа». Визуальная сверка с вкладкой 3 программы.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — секция «Ставки» (multi-chip + плавающая)"
```

---

### Task 5: Секция «Штрафы» (renderTab4: осн.сумма/проценты, макс. штраф)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — заглушка `condSecPenalty`.

**Interfaces:**
- Consumes: `cdraft`, `condCombo`, `condF`, `CLK.penalty`.
- Produces: `condSecPenalty()`, `condPenaltyFloatTypes()`.

- [ ] **Step 1: Портировать renderTab4**

Найти образец:
Run: `grep -n "function renderTab4\|penaltyMainFloatType\|Штрафы\.\.\.\|penaltyMaxPct" mockups/loan-program/loan-program.html`
Expected: строки. По образцу вкладки 4 (два блока + полоса «Ограничения штрафа») реализовать:

```js
function condPenaltyFloatTypes(){ return ['Ключевая ставка НБКР','LIBOR']; } // сверить с refbook штрафов программы
function condSecPenalty(){
  const mainFloat = cdraft.penaltyMainType==='Плавающая';
  const intFloat  = cdraft.penaltyIntType==='Плавающая';
  return `<div class="cond-sec"><div class="section-h">Штрафы</div><div class="t2-cols">
    <div><div class="t2-sub">Штраф за просрочку основной суммы</div><div class="cform-grid">
      ${condCombo('Тип штрафной ставки за основную сумму','penaltyMainType',['Фиксированная','Плавающая'])}
      ${mainFloat ? condCombo('Тип плавающей штрафной ставки по основной сумме','penaltyMainFloatType',condPenaltyFloatTypes())
                  : condCombo('Значение фиксированной штрафной ставки за основную сумму','penaltyMainVal',CLK.penalty)}
    </div></div>
    <div><div class="t2-sub">Штраф за просрочку процентов</div><div class="cform-grid">
      ${condCombo('Тип штрафной ставки за проценты','penaltyIntType',['Фиксированная','Плавающая'])}
      ${intFloat ? condCombo('Тип плавающей штрафной ставки по процентам','penaltyIntFloatType',condPenaltyFloatTypes())
                 : condCombo('Значение фиксированной штрафной ставки за проценты','penaltyIntVal',CLK.penalty)}
    </div></div>
  </div><div class="cform-grid" style="margin-top:12px">
    ${condF('Максимальный размер штрафа','penaltyMaxPct',{unit:'% от первоначальной суммы кредита',type:'number'})}
  </div></div>`;
}
```

- [ ] **Step 2: Verify — переключение Фикс/Плавающая, макс. штраф дефолт 20**

Открыть форму. Консоль: проверить что по умолчанию `cdraft.penaltyMaxPct==='20'` рисуется в поле; `cdraft.penaltyMainType='Плавающая';renderCond();` → combo меняется на «Тип плавающей…». Сверка с вкладкой 4 программы.

- [ ] **Step 3: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — секция «Штрафы»"
```

---

### Task 6: Секция «Льготный период» (renderTab5: 3 блока)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — заглушка `condSecGrace`.

**Interfaces:**
- Consumes: `cdraft`, `condCheck`, `condCombo`, `condMsCombo`, `condF` (с textarea-веткой), `T5_DUR_OPTS`.
- Produces: `condSecGrace()`, `condGraceBlock(...)`.

- [ ] **Step 1: Портировать renderTab5 (3 идентичных блока)**

Найти образец:
Run: `grep -n "function renderTab5\|t5typeSelect\|T5_DUR_OPTS\|graceMainCond" mockups/loan-program/loan-program.html`
Expected: строки. Реализовать блок-хелпер и вызвать трижды:

```js
function condGraceBlock(title, on, type, dur, from, to, cond){
  const check = condCheck('Использовать льготный период — '+title, on);
  if(!cdraft[on]) return `<div class="cf-grace-group"><div class="t2-sub">${title}</div>${check}</div>`;
  const range = cdraft[type]==='Диапазон';
  return `<div class="cf-grace-group"><div class="t2-sub">${title}</div>${check}
    <div class="cform-grid">
      ${condCombo('Тип льготного периода',type,['Фиксированный','Диапазон'])}
      ${range ? condF('Продолжительность c (в мес.)',from,{unit:'мес.',type:'number'})+condF('Продолжительность по (в мес.)',to,{unit:'мес.',type:'number'})
              : condMsCombo('Продолжительность льготного периода (в мес.)',dur,T5_DUR_OPTS,'мес.')}
      ${condF('Условия предоставления',cond,{span:true,type:'textarea',max:1000})}
    </div></div>`;
}
function condSecGrace(){
  return `<div class="cond-sec"><div class="section-h">Льготный период</div>
    ${condGraceBlock('по основной сумме','graceMain','graceMainType','graceMainDur','graceMainDurFrom','graceMainDurTo','graceMainCond')}
    ${condGraceBlock('по начислению процентов','graceAccr','graceAccrType','graceAccrDur','graceAccrDurFrom','graceAccrDurTo','graceAccrCond')}
    ${condGraceBlock('по процентам','graceInt','graceIntType','graceIntDur','graceIntDurFrom','graceIntDurTo','graceIntCond')}
    ${cdraft.graceInt ? `<div class="cform-grid">${condF('Распределять с периода №','graceIntDistFrom',{type:'number'})}${condF('Распределять по период №','graceIntDistTo',{type:'number'})}</div>`:''}
  </div>`;
}
```

- [ ] **Step 2: Verify — чекбокс раскрывает блок, распределение только для «по процентам»**

Открыть форму. Консоль: `cdraft.graceMain=true;renderCond();` → появляются Тип + Продолжительность + Условия. `cdraft.graceInt=true;renderCond();` → плюс поля «Распределять с/по». Переключить `cdraft.graceMainType='Диапазон';renderCond();` → мультивыбор меняется на c/по. Сверка с вкладкой 5 программы.

- [ ] **Step 3: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — секция «Льготный период» (3 блока)"
```

---

### Task 7: Секция «Платежи и расчёты» (renderTab6)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — заглушка `condSecPayments`.

**Interfaces:**
- Consumes: `cdraft`, `condCombo`, `condMsCombo`, `condF`, `CLK`.
- Produces: `condSecPayments()`, `condSelPair(label,key,pairs)` (combo с value/label парами для payMode).

- [ ] **Step 1: Добавить combo с парами value/label**

payMode хранит коды `standard`/`months`, показывает человекочитаемые лейблы. Добавить вариант:
```js
function condSelPair(label, key, pairs){ // pairs: [[value,label],...]
  const cur = cdraft[key];
  const curLabel = (pairs.find(p=>p[0]===cur)||[])[1] || '';
  const open = condComboOpen===key;
  const o = pairs.map(([v,l])=>`<div class="opt ${cur===v?'sel':''}" data-v="${esc(l)}" onclick="condPickCombo('${key}','${esc(v)}')"><span class="mk">${cur===v?'✓':''}</span>${esc(l)}</div>`).join('');
  return `<div class="field" data-field="${key}"><span class="flabel">${label}</span>
    <div class="combo ${open?'open':''}" id="ccombo_${key}" onclick="condToggleCombo(event,'${key}')">
      <span class="cval ${curLabel?'filled':''}">${curLabel||'— выберите —'}</span>
      <span class="caret"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
      <div class="combo-pop" onclick="event.stopPropagation()"><div class="combo-opts">${o}</div></div>
    </div>${condDev(key)}</div>`;
}
```

- [ ] **Step 2: Реализовать `condSecPayments`**

Сверить набор/лейблы с образцом:
Run: `grep -n "function renderTab6\|lastPaymentAnchor\|dayCountBase" mockups/loan-program/loan-program.html`
Expected: строки.

```js
function condSecPayments(){
  const byMonths = cdraft.payMode==='months';
  return `<div class="cond-sec"><div class="section-h">Платежи и расчёты</div><div class="t2-cols">
    <div><div class="cform-grid">
      ${condSelPair('Способ задания графика','payMode',[['standard','Стандартная периодичность'],['months','По конкретным месяцам']])}
      ${byMonths ? condMsCombo('Конкретные месяцы платежей','payMonths',CLK.payMonths,'')
                 : condCombo('Периодичность платежей','periodicity',CLK.periodicity)}
      ${condCombo('Метод расчёта дней в периоде','dayCountNum',CLK.dayCountNum)}
      ${condCombo('База дней в году','dayCountBase',CLK.dayCountBase)}
      ${condCombo('Очередь погашения','queue',CLK.queue)}
    </div></div>
    <div><div class="cform-grid">
      ${condF('День месяца для платежа','payDay',{type:'number'})}
      ${condCombo('Обработка нерабочих дней','weekend',CLK.weekend)}
      ${condCombo('Привязка последнего платежа','lastPaymentAnchor',CLK.lastPaymentAnchor)}
      ${byMonths ? condF('Метод погашения кредита','repayMethod',{type:'text'}) : condCombo('Метод погашения кредита','repayMethod',CLK.repayMethod)}
      ${condF('Минимальное кол-во дней (освоение→1й платёж)','minDays',{type:'number',unit:'дней'})}
      ${condF('Максимальное кол-во дней (освоение→1й платёж)','maxDays',{type:'number',unit:'дней'})}
    </div></div>
  </div></div>`;
}
```
(При `payMode==='months'` метод погашения в программе авто = «Индивидуальный» и readonly — здесь для паритета выставить `cdraft.repayMethod='Индивидуальный'` перед рендером ветки months.)

- [ ] **Step 3: Verify — все поля платежей, способ графика переключает периодичность↔месяцы, дефолты**

Открыть форму. Консоль: `cdraft.payMode='months';renderCond();` → «Конкретные месяцы» (мульти) вместо «Периодичность». Проверить дефолты сразу после `openCreateModal`: `cdraft.dayCountBase==='365'`, `cdraft.weekend==='Не переносить'`, `cdraft.lastPaymentAnchor==='По дате первого платежа'`, `cdraft.repayMethod==='Аннуитетный'`. Сверка с вкладкой 6 программы.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — секция «Платежи и расчёты»"
```

---

### Task 8: Программа = справка + diff/отклонение (управляющее правило)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — `saveCondInputs` (Task 1), `condDev` (Task 2 заглушка), `selectProgram` (3032), `clearPicker` ветка `cf-program` (3016–3021), `openCreateModal` (сброс `_condTouched`).

**Interfaces:**
- Consumes: `cdraft`, `renderCond`, `_progSnapshot`, `PROGRAMS_MAP`, `programToCond` (Task 9), `esc`.
- Produces: `_condTouched` (Set), `applyProgramSnapshot(prog)`, `condDev(key)` (полная реализация).

- [ ] **Step 1: Объявить `_condTouched` и отслеживать ручной ввод**

Рядом с `let _progSnapshot` (Task 1 Step 2) добавить `let _condTouched = new Set();`. В `saveCondInputs` (Task 1 Step 3) внутри `forEach`, после присваивания `cdraft[k]`, добавить:
```js
    if((el.type==='checkbox' && el.checked) || (el.type!=='checkbox' && el.value!=='')) _condTouched.add(k);
```
(`condPickCombo`/`condMsPick`/`condCheck` уже добавляют ключ — Task 2/4.)

- [ ] **Step 2: applyProgramSnapshot — предзаполнить пустые, снять снимок**

```js
function applyProgramSnapshot(prog){
  _progSnapshot = prog ? programToCond(prog) : null;   // programToCond — Task 9
  if(!_progSnapshot) return;
  Object.keys(_progSnapshot).forEach(k=>{
    const empty = Array.isArray(cdraft[k]) ? cdraft[k].length===0 : (cdraft[k]===''||cdraft[k]==null||cdraft[k]===false);
    if(empty && !_condTouched.has(k)) cdraft[k] = _progSnapshot[k];  // предзаполнить, НЕ блокировать
  });
}
```

- [ ] **Step 3: condDev — справка + зачёркнутое значение программы при расхождении**

Заменить заглушку `condDev` (Task 2 Step 1):
```js
function condDev(key){
  if(!_progSnapshot || !(key in _progSnapshot)) return '';
  const norm = v => Array.isArray(v) ? v.join(', ') : (v===true?'да':v===false?'нет':String(v==null?'':v));
  const cur = norm(cdraft[key]), prog = norm(_progSnapshot[key]);
  if(cur===prog) return '';
  return `<span class="cond-dev">⚑ отклонение от программы <span class="prog-was">программа: ${esc(prog)}</span></span>`;
}
```

- [ ] **Step 4: Врезать в selectProgram / clearPicker / openCreateModal**

В `selectProgram` (`loan-application.html:3032`) после `_createProgram = PROGRAMS_MAP[label] || null;` (3037) добавить:
```js
  applyProgramSnapshot(_createProgram);
  const ph=document.getElementById('cf-program-hint'); if(ph) ph.textContent = _createProgram ? 'Выбрана — значения подставлены как справка, можно менять' : '';
  renderCond();
```
Удалить строки 3038–3039 и 3042–3043 (обращения к удалённым `cf-amount-range`/`cf-term-range`/`cf-amount`/`cf-term`). Строку `closeModal('modal-pick-program-create')` (3044) оставить.

В `clearPicker` ветке `cf-program` (3016–3021) заменить тело на:
```js
    _createProgram = null; _progSnapshot = null;
    const ph=document.getElementById('cf-program-hint'); if(ph) ph.textContent = 'Не выбрана — все условия задаются вручную';
    renderCond();
```

В `openCreateModal` строку из Task 1 Step 4 привести к финалу: `cdraft = CP({}); _progSnapshot = null; _condTouched = new Set(); renderCond();`.

- [ ] **Step 5: Verify — предзаполнение, чип отклонения, зачёркивание, снятие**

Открыть форму. Сценарий:
1. Ввести ставку вручную: `cdraft.rateValues=['10,00%']; _condTouched.add('rateValues'); renderCond();`
2. Выбрать программу «АгроИнвест КР» (ставка 8%): через модалку или консолью `selectProgram('АгроИнвест КР')`.
3. Ожидается: поле ставки = `10,00%` (ручное сохранилось), рядом чип `⚑ отклонение от программы` + `программа: 8,00%` зачёркнуто.
4. Пустое перед выбором поле (напр. `queue`) предзаполнилось значением программы, без чипа.
5. Снять программу (`clearPicker('cf-program')`) → чипы исчезли, `cdraft.rateValues` остался `['10,00%']`.

- [ ] **Step 6: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — программа как справка + diff отклонений"
```

---

### Task 9: Данные условий программы для diff (расширить PROGRAMS_MAP)

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — `PROGRAMS_MAP` (2161–2202); добавить `programToCond`.

**Interfaces:**
- Consumes: ключи `cdraft` (модель CP).
- Produces: `programToCond(prog)` → объект с ключами `cdraft`; расширенные записи `PROGRAMS_MAP`.

- [ ] **Step 1: Прочитать текущую форму PROGRAMS_MAP**

Run: `sed -n '2161,2202p' mockups/loan-application/loan-application.html`
Expected: печатает объект `PROGRAMS_MAP` (label → {amountRange, termRange, rate, …}). Зафиксировать реальные ключи и названия 3 программ.

- [ ] **Step 2: Расширить записи полями условий**

Для каждой из 3 программ добавить condition-поля, зеркалящие эталон `PROGRAMS` программы (`loan-program.html:984–1005`). Пример (значения — из соответствующей программы; при отсутствии исходных — правдоподобные, консистентные с диапазонами записи):

```js
'АгроИнвест КР': { /* …существующие amountRange/termRange/rate… */
  currency:'KGS', source:'Иностранные доноры', kind:'Бюджетная ссуда', purpose:'Приобретение техники',
  line:'АБР', repayAcct:'Накопительный счёт',
  amountType:'Диапазон', amountMin:'100000', amountMax:'10000000',
  termType:'Диапазон', termMin:'12', termMax:'60',
  rateType:'Фиксированная', rateValues:['8,00%'], floatRate:false,
  penaltyMainType:'Фиксированная', penaltyMainVal:'0,2%', penaltyIntType:'Фиксированная', penaltyIntVal:'0,1%', penaltyMaxPct:'20',
  periodicity:'Ежемесячно', dayCountNum:'Фактический', dayCountBase:'365', queue:'Основная сумма → проценты → штрафы',
  weekend:'Не переносить', lastPaymentAnchor:'По дате первого платежа', repayMethod:'Аннуитетный',
  graceMain:true, graceMainType:'Фиксированный', graceMainDur:['3','6'], minDays:'15', maxDays:'45'
},
```
Заполнить аналогично «Поддержка сельхозпроизводителей» и «ТУР». Не оставлять записи без condition-полей — diff должен иметь что показывать.

- [ ] **Step 3: programToCond — привести запись к ключам cdraft**

```js
function programToCond(prog){
  const out = {};
  ['currency','source','kind','purpose','line','repayAcct','amountType','amountMin','amountMax',
   'termType','termMin','termMax','rateType','rateValues','floatRate','penaltyMainType','penaltyMainVal',
   'penaltyIntType','penaltyIntVal','penaltyMaxPct','periodicity','dayCountNum','dayCountBase','queue',
   'weekend','lastPaymentAnchor','repayMethod','graceMain','graceMainType','graceMainDur','minDays','maxDays']
    .forEach(k=>{ if(prog[k]!==undefined) out[k]=prog[k]; });
  return out;
}
```

- [ ] **Step 4: Verify — снимок программы полный, diff видит расхождения**

Открыть форму, выбрать «АгроИнвест КР». Консоль:
```js
Object.keys(programToCond(PROGRAMS_MAP['АгроИнвест КР'])).length
```
Expected: `>= 15`. Изменить любое предзаполненное поле вручную → появляется чип отклонения (Task 8). Пустое перед выбором поле показывает значение программы.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): заявка условия — condition-данные программ для diff"
```

---

## Self-Review

**Spec coverage:**
- Аудит паритета (все отсутствующие поля) → Задачи 2–7 добавляют каждую группу (Параметры/Сумма-Срок/Ставки/Штрафы/Льготный/Платежи). ✔
- Решение 1 «точная копия виджетов» → порт builders дословно (combo/f/msCombo/t2col/renderTab3-6). ✔
- Решение 2 «плоские карточки» → `cond-sec`+`section-h` секции, без мастер-вкладок. ✔
- Решение 3 «только условия» → Документы/Залог/Отрасль/Предпросмотр вне плана. ✔
- Решение 4 «программа = справка, не блокирует; diff» → Task 8. ✔
- Решение 5 «envelope + конкретное поле» → Task 3 concrete `requestedAmount/requestedTerm` + envelope t2col. ✔
- Модель данных → CP() Task 1, `_progSnapshot`/`_condTouched` Task 8. ✔
- Валидация суммы/срока в рамках envelope → Task 3 Step 4. ✔

**Placeholder scan:** `condDev`/секции-заглушки в Task 1–2 — намеренные, замещаются в явно указанных задачах (Task 2/8). `condFloatTypes/condPenaltyFloatTypes` — значения с явной командой grep-сверки; не абстрактный TODO. Значения 2-й/3-й записей PROGRAMS_MAP — инструкция заполнить из данных, с конкретным эталоном (Task 9 Step 2).

**Type consistency:** builders единообразно `condX(...)`; state везде `cdraft`; ре-рендер везде `renderCond()`; harvest `saveCondInputs()`; ключи `cdraft` совпадают между `CP()`/`programToCond`/`condSec*`. Diff-чип класс `cond-dev` определён Task 1 Step 5, используется Task 8 Step 3. `condComboOpen` объявлен Task 2, переиспользован `condSelPair` Task 7. `_condTouched` объявлен Task 8 Step 1, ссылки в Task 2/4 обёрнуты `typeof`-guard'ом на случай порядка выполнения.

**Риск:** порт функций требует точных строк программы — в шагах даны grep-команды; при расхождении сигнатур использовать grep-вывод как источник истины (анкеры ориентировочны на 2026-07-05).
