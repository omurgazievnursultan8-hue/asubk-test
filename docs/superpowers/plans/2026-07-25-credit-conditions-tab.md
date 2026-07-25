# Вкладка «Условия» кредита — версионность условий · план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Условия кредита становятся версионированными записями на параметр (дата вступления в силу, основание: заявка · ДС · суд · ПП, свои значения по каждому траншу), а вкладка «Условия» показывает действующий срез, срез на любую дату, расхождения по траншам и журнал изменений.

**Architecture:** Единственный источник истины — `t.conditionRecords[]` на каждом транше. Действующий комплект и любой исторический срез — производные функции (`conditionsAt`, `creditConditionsAt`), не хранятся (Р-11). `c.baseConditions` деградирует до шаблона наследования. `t.conditions` как хранимое поле исчезает; пять его потребителей переводятся на `conditionsAt`. Изменение условий после регистрации — только через запись с основанием, гейты Г-9/Г-10 (правятся) и Г-18…Г-21 (новые). Автопересчёта графика при ретроспективном изменении нет: красная плашка + переход в «Расчёты».

**Tech Stack:** один самодостаточный HTML-файл `mockups/loan-credit/credit.html` (vanilla JS, без сборки, состояние в памяти); headless-смоук `scripts/inspect/credit-check.mjs` (node, zero-dep, `node:vm` исполняет `<script>` из HTML и дёргает `window.CR`).

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-25-credit-conditions-tab-design.md`. Решения Д-1…Д-7 оттуда — обязательны.
- Все даты в модели и UI — строки `DD.MM.YYYY`. Сравнение только через `pd()`. Источником «сегодня» может быть только константа `TODAY = '23.07.2026'` — никаких `Date.now()` и никакого безаргументного `new Date()`. Конструирование `Date` из уже известной даты (как в существующих `pd`/`addM`) разрешено.
- Никакого физического удаления (Р-20, Г-21): функций `remove*` / `delete*` для записей условий не появляется; в коде не должно возникать кнопок со словом «Удалить» — проверка #28 это ловит.
- Язык интерфейса и комментариев — русский. Комментарии в коде — по стилю файла: `/* ... */` с указанием решения/гейта (`Р-21`, `Г-18`).
- Записи условий лежат **на транше** (`t.conditionRecords`), поля `scope` нет. Кредит-уровневые виды собираются через `c.tranches.flatMap(t => t.conditionRecords || [])`.
- Реестр параметров ровно этот, 10 ключей: `rate · reserveRate · penaltyMain · penaltyInt · term · freq · method · graceMain · graceInterest · graceAccrual`. `dayMethod`, `queue`, `penaltyMaxPct`, `floating`, `floatType`, `margin` в записи **не переводятся**.
- Единственная команда проверки: `node scripts/inspect/credit-check.mjs` (из корня репозитория). Она сама впечатывает результат в блок «SMOKE (node)» шапки HTML — изменённый HTML попадает в тот же коммит.
- Существующие проверки (#0a…#28) должны остаться зелёными на каждом коммите. Падение существующей проверки — стоп, а не «поправим потом».
- `К-1…K-6b` и фон `K-B*` — под смоуком, лишних правок демо-данных на них не делать; новые демо-сценарии вешать на `K-C*`, кроме прямо названных в плане (`K-2`, `K-3`, `K-4`).

---

## File Structure

| Файл | Ответственность | Что делаем |
|---|---|---|
| `mockups/loan-credit/credit.html` § «2. Модель» (~944–1000) | конструкторы, `PARAMS`, `BASIS_KINDS`, `mkTranche` | добавляем реестр, конструктор записи, `conditionRecords:[]` |
| то же, § «3. Производные» (~1700–1810) | `conditionsAt`, `creditConditionsAt`, `divergenceRows`, `basisGroups`, `retroFlags`; переезд 5 потребителей | задачи 1–5 |
| то же, § «4. Гейты» (`gate`, ~1826–1890) | Г-9 (правка), Г-10 (расширение), Г-18…Г-21 | задача 6 |
| то же, § «5. Мутаторы» (~1959–2110) | `addConditionRecords`, аудит, усечённый `addAgreement` | задачи 4, 6 |
| то же, `seedDb` (~1000–1420) | демо: первичные записи, ДС, суд, ПП, расхождение | задачи 1, 3, 4, 5 |
| то же, `tabUsloviya` (~2811–2895) | вся вкладка | задачи 7–9 |
| то же, § модалы (~3243–3360) | `CR.openCondModal` вместо `CR.openAgrModal` | задача 10 |
| то же, шапка-комментарий (~100–240) | журнал шагов, реестры Р-*/Г-* | задача 11 |
| `scripts/inspect/credit-check.mjs` | смоук; новые проверки #29…#36 | каждая задача |
| `docs/superpowers/specs/2026-07-25-credit-conditions-tab-design.md` | источник требований | не меняется |

---

### Task 1: Реестр параметров, конструктор записи, резолвер `conditionsAt`, первичные записи в seed

Записи появляются рядом с `t.conditions`, ничего пока не ломая. Критерий: срез на «сегодня» совпадает с прежним объектом условий на всех кредитах.

**Files:**
- Modify: `mockups/loan-credit/credit.html` — после `condDefaults()` (951); `mkTranche` (963–968); `seedDb` (перед `return`); экспорт `window.CR` (2106–2118)
- Test: `scripts/inspect/credit-check.mjs` — новый блок перед строкой `const pass = results.filter(...)`

**Interfaces:**
- Produces: `PARAMS: Array<{key,label,kind,options?}>`, `PARAM_KEYS: string[]`, `paramLabel(key)->string`, `BASIS_KINDS: Record<'application'|'agreement'|'court'|'govAct',{label,icon,owned,retro}>`, `mkConditionRecord(over)->record`, `crOrder(a,b)->number`, `conditionsAt(tranche,date)->Object`, `seedPrimaryRecords(credit)->void`. Экспорт: `CR.PARAMS`, `CR.PARAM_KEYS`, `CR.paramLabel`, `CR.BASIS_KINDS`, `CR.mkConditionRecord`, `CR.conditionsAt`.

- [ ] **Step 1: Написать падающие проверки**

В `scripts/inspect/credit-check.mjs` перед строкой `const pass = results.filter(r => r.pass).length;`:

```js
/* 29. Р-21: первичные записи условий заведены на каждом транше, и срез на TODAY
       совпадает с прежним хранимым t.conditions (регрессия переезда). */
(() => { const db = CR.seedDb();
  let bad = [], noRecs = [];
  for (const c of db.credits) for (const t of c.tranches){
    if (!(t.conditionRecords && t.conditionRecords.length)) { noRecs.push(t.id); continue; }
    const at = CR.conditionsAt(t, CR.TODAY);
    for (const k of CR.PARAM_KEYS) if (String(at[k]) !== String(t.conditions[k])) bad.push(t.id+'.'+k);
  }
  ok(29, noRecs.length===0 && bad.length===0,
     `безЗаписей=${noRecs.slice(0,3)} расхождения=${bad.slice(0,5)}`);
})();
/* 30. Реестр параметров — ровно 10 ключей, без параметров расчётного движка. */
(() => {
  const expect = ['rate','reserveRate','penaltyMain','penaltyInt','term','freq','method',
                  'graceMain','graceInterest','graceAccrual'];
  const same = CR.PARAM_KEYS.length===expect.length && expect.every(k => CR.PARAM_KEYS.includes(k));
  const noEngine = !CR.PARAM_KEYS.includes('dayMethod') && !CR.PARAM_KEYS.includes('queue')
                && !CR.PARAM_KEYS.includes('penaltyMaxPct');
  ok(30, same && noEngine, `keys=${CR.PARAM_KEYS.join(',')}`);
})();
/* 31. conditionsAt на дату до первой записи — пустой объект, без исключения. */
(() => { const db = CR.seedDb(); const t = db.credits[0].tranches[0];
  let threw = false, empty = false;
  try { empty = Object.keys(CR.conditionsAt(t, '01.01.2000')).length === 0; } catch(e){ threw = true; }
  ok(31, !threw && empty, `threw=${threw}`);
})();
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #29, #30, #31 — `CR.conditionsAt is not a function`, `CR.PARAM_KEYS` undefined. #0a…#28 — PASS.

- [ ] **Step 3: Реестр параметров и типов основания**

В `credit.html` сразу после `condDefaults()` (после 951):

```js
/* ---- Р-21: реестр параметров-условий. Меняться основанием может только то,
   что здесь перечислено. dayMethod/queue — параметры расчётного движка
   («Расчёты», шаг 14), судом и ПП не меняются; penaltyMaxPct мёртв (шаг 4). ---- */
const PARAMS = [
  { key:'rate',          label:'Ставка, %',                 kind:'num' },
  { key:'reserveRate',   label:'Ставка резерва, %',         kind:'num' },
  { key:'penaltyMain',   label:'Пеня по ОД, %/дн',          kind:'num' },
  { key:'penaltyInt',    label:'Пеня по %, %/дн',           kind:'num' },
  { key:'term',          label:'Срок, мес.',                kind:'num' },
  { key:'freq',          label:'Периодичность',             kind:'enum',
    options:['ежемесячно','ежеквартально','раз в полгода','ежегодно'] },
  { key:'method',        label:'Метод погашения',           kind:'enum',
    options:['аннуитет','равными долями','в конце срока'] },
  { key:'graceMain',     label:'Льгота по ОД, мес.',        kind:'num' },
  { key:'graceInterest', label:'Льгота по %, мес.',         kind:'num' },
  { key:'graceAccrual',  label:'Отсрочка начисления, мес.', kind:'num' }
];
const PARAM_KEYS = PARAMS.map(p => p.key);
const paramLabel = k => (PARAMS.find(p => p.key === k) || {}).label || k;

/* Типы основания. owned=false → документ живёт в другом модуле, кредит только
   ссылается (Д-4, паттерн Р-7/Р-16). retro=true → допустима дата вступления
   в прошлом (Г-19): внешний акт задним числом штатен, сделка сторон — нет. */
const BASIS_KINDS = {
  application:{ label:'Заявка / комиссия',           icon:'▪',  owned:true,  retro:false },
  agreement:  { label:'Доп. соглашение',             icon:'ДС', owned:true,  retro:false },
  court:      { label:'Решение суда',                icon:'⚖',  owned:false, retro:true  },
  govAct:     { label:'Постановление правительства', icon:'ПП', owned:false, retro:true  }
};

let _crSeq = 0;
/* CONDITION RECORD (Р-21) — запись «параметр × значение × дата вступления × основание».
   Лежит на ТРАНШЕ (Д-3): поля scope нет, транш и есть область действия. */
function mkConditionRecord(over){
  return Object.assign({
    id:'CR-' + (++_crSeq), param:'', value:null, effectiveFrom:'',
    basis:{ kind:'application', ref:'', label:'', date:'' },
    note:'', createdAt:TODAY, createdBy:currentRole
  }, over || {});
}
/* Порядок применения записей: по дате вступления; при равной дате — позже
   созданная; при равном createdAt — больший id (детерминизм сортировки). */
function crOrder(a, b){
  const d = pd(a.effectiveFrom) - pd(b.effectiveFrom);
  if (d) return d;
  const c = pd(a.createdAt) - pd(b.createdAt);
  if (c) return c;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric:true });
}
/* conditionsAt(tranche, date) — действующий комплект транша на дату (Р-11, рантайм). */
function conditionsAt(tranche, date){
  const lim = pd(date || TODAY), out = {};
  ((tranche && tranche.conditionRecords) || [])
    .filter(r => r.effectiveFrom && pd(r.effectiveFrom) <= lim)
    .sort(crOrder)
    .forEach(r => { out[r.param] = r.value; });     // позже по порядку перекрывает раннее
  return out;
}
```

- [ ] **Step 4: Поле `conditionRecords` в транше**

`mkTranche`, строка 966 — добавить массив, `conditions` пока оставить:

```js
    conditions: condDefaults(), conditionRecords: [], disbursements:[], schedules:[], ledger:[]
```

- [ ] **Step 5: Первичные записи в seed**

Рядом с `mkConditionRecord`:

```js
/* Первичный комплект (basis.kind='application'): условия, пришедшие из заявки.
   effectiveFrom = дата договора; ref = протокол комиссии из origin (Р-18). */
function seedPrimaryRecords(credit){
  for (const t of credit.tranches){
    const src = t.conditions || credit.baseConditions || condDefaults();
    t.conditionRecords = PARAM_KEYS.map(k => mkConditionRecord({
      param:k, value:src[k], effectiveFrom:credit.date,
      basis:{ kind:'application',
              ref:credit.origin.commissionId || credit.origin.applicationId || '',
              label:'Заявка ' + (credit.origin.applicationId || '—') + ' · комиссия ' +
                    (credit.origin.commissionId || '—'), date:credit.date },
      note:'Первичный комплект условий из заявки', createdAt:credit.date
    }));
  }
}
```

В `seedDb` непосредственно перед `return`, когда массив кредитов полностью собран:

```js
  credits.forEach(seedPrimaryRecords);          // Р-21: первичные записи по всем кредитам
```

Если массив внутри `seedDb` называется иначе — вызвать на том, который уезжает в `db.credits`.

- [ ] **Step 6: Экспорт**

В `window.CR` рядом с `derive, buildSchedule, gate, canRole,` добавить:

```js
  conditionsAt, mkConditionRecord, PARAMS, PARAM_KEYS, paramLabel, BASIS_KINDS,
```

- [ ] **Step 7: Запустить, убедиться, что зелено**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #29, #30, #31; #0a…#28 PASS; итог `35/35 PASS`.

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): Р-21 — записи условий на транше, резолвер conditionsAt

Реестр PARAMS (10 параметров), типы основания BASIS_KINDS, конструктор
mkConditionRecord, резолвер conditionsAt(tranche,date) и первичные записи
из заявки по всем демо-кредитам. t.conditions пока на месте: проверка #29
сравнивает срез на TODAY с прежним объектом — регрессионная страховка переезда."
```

---

### Task 2: Перевести потребителей на `conditionsAt`, удалить хранимое `t.conditions`

**Files:**
- Modify: `mockups/loan-credit/credit.html:1525` (`buildSchedule`), `:1747` (`computeReserve`), `:1796` (`termAgg` в `derive`), `:2820` (`dev()` в `tabUsloviya`), `:3292` (`CR.openSchedModal`), `mkTranche:966`, `seedPrimaryRecords`
- Test: `scripts/inspect/credit-check.mjs` — правка #29, новая #32

**Interfaces:**
- Consumes: `conditionsAt(tranche, date)` из Task 1.
- Produces: `t.conditions` больше не существует; любой чтец условий транша обязан звать `conditionsAt(t, TODAY)`.

- [ ] **Step 1: Переписать #29 и добавить #32**

Заменить блок #29 на:

```js
/* 29. Р-21/Д-3: t.conditions как хранимое поле удалено; conditionsAt даёт полный
       комплект из 10 параметров на каждом транше. */
(() => { const db = CR.seedDb();
  let stored = [], incomplete = [];
  for (const c of db.credits) for (const t of c.tranches){
    if (t.conditions !== undefined) stored.push(t.id);
    const at = CR.conditionsAt(t, CR.TODAY);
    if (CR.PARAM_KEYS.some(k => at[k] === undefined)) incomplete.push(t.id);
  }
  ok(29, stored.length===0 && incomplete.length===0,
     `хранимое=${stored.slice(0,3)} неполные=${incomplete.slice(0,3)}`);
})();
/* 32. Переезд не сдвинул цифры: агрегат срока (Р-13) и длина графика считаются
       из conditionsAt и совпадают с условиями транша. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-1');
  const terms = c.tranches.map(t => CR.conditionsAt(t, CR.TODAY).term);
  const d = CR.derive(c);
  const t1 = c.tranches[0];
  const from = (t1.disbursements[0] || {}).date;
  const rows = from ? CR.buildSchedule(t1, from).rows : [];
  ok(32, d.termAgg === Math.max(...terms) && rows.length === CR.conditionsAt(t1, CR.TODAY).term,
     `termAgg=${d.termAgg} terms=${terms} rows=${rows.length}`);
})();
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #29 (`хранимое=[K-1-T1,K-1-T2,K-2-T1]`). #32 — PASS уже сейчас; он страхует шаги ниже.

- [ ] **Step 3: `buildSchedule`**

`credit.html:1525`, заменить

```js
  const c = tranche.conditions || {};
```

на

```js
  const c = conditionsAt(tranche, TODAY);        // Р-21: условия транша — производное от записей
```

- [ ] **Step 4: `computeReserve`**

`credit.html:1747`, заменить

```js
    const rr = (t.conditions && t.conditions.reserveRate) || 0;
```

на

```js
    const rr = conditionsAt(t, TODAY).reserveRate || 0;      // Р-21
```

- [ ] **Step 5: `termAgg` в `derive`**

`credit.html:1796`, заменить

```js
  const termAgg       = Math.max(0, ...c.tranches.filter(activeTranche).map(t => (t.conditions && t.conditions.term) || 0));
```

на

```js
  const termAgg       = Math.max(0, ...c.tranches.filter(activeTranche)
                            .map(t => conditionsAt(t, TODAY).term || 0));   // Р-13 поверх Р-21
```

- [ ] **Step 6: `dev()` и модал графика**

`credit.html:2820`:

```js
    const dev=(t,key)=>{ const bv=b[key], tv=conditionsAt(t,TODAY)[key]; return String(bv)===String(tv)?esc(tv):`<span class="diff"><span class="diff-old">${esc(bv)}</span> → <span class="diff-new">${esc(tv)}</span></span>`; };
```

`credit.html:3292`:

```js
    const sel=c.tranches.find(t=>t.no===detailTrancheNo)||c.tranches[0]; const cnd=CR.conditionsAt(sel,CR.TODAY);
```

- [ ] **Step 7: Убрать поле из конструктора и из генератора записей**

`mkTranche` (966) — убрать `conditions: condDefaults(),`:

```js
    conditionRecords: [], disbursements:[], schedules:[], ledger:[]
```

В `seedPrimaryRecords` источником остаётся шаблон кредита:

```js
    const src = credit.baseConditions || condDefaults();
```

Демо-транши, задававшие свои условия литералом `conditions:{...}` (например `K-C*` через `tconds`), теряют их: расхождения заводятся отдельными записями в Task 3. На этом шаге допустимо, что все транши получают шаблон кредита — #32 следит за К-1, где транши равны.

`condDefaults()` остаётся: он всё ещё родит `baseConditions` (шаблон наследования).

- [ ] **Step 8: Запустить, убедиться, что зелено**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #29, #32 и весь прежний набор. Если падает #8b или #27b — `conditionsAt` вернул пусто там, где раньше был `condDefaults()`: проверить, что `seedPrimaryRecords` вызывается ПОСЛЕ полной сборки массива кредитов.

- [ ] **Step 9: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "refactor(credit): t.conditions удалено, условия транша — только через conditionsAt

Пять потребителей (buildSchedule, computeReserve, termAgg, дифф вкладки
«Условия», модал графика) переведены на резолвер. Хранимого объекта условий
на транше больше нет: единственный источник — conditionRecords (Р-21)."
```

---

### Task 3: Агрегат по кредиту и расхождения по траншам

**Files:**
- Modify: `mockups/loan-credit/credit.html` — § «3. Производные» рядом с `conditionsAt`; `seedDb` (после `credits.forEach(seedPrimaryRecords)`); экспорт
- Test: `scripts/inspect/credit-check.mjs` — новая #33

**Interfaces:**
- Consumes: `conditionsAt`, `activeTranche` (уже в файле), `mkConditionRecord`, `PARAM_KEYS`.
- Produces: `creditConditionsAt(credit, date) -> Record<param, {value}|{divergent:true, values:[{trancheNo,value}]}>`, `divergenceRows(credit, date) -> [{param, cells:[{trancheNo,value}]}]`. Экспорт `CR.creditConditionsAt`, `CR.divergenceRows`.

- [ ] **Step 1: Написать падающую проверку**

```js
/* 33. Д-7: агрегат по кредиту — одно значение при согласии траншей,
       divergent при расхождении; divergenceRows перечисляет только спорные
       параметры. В демо ровно один кредит с расхождением. */
(() => { const db = CR.seedDb();
  const k1 = db.credits.find(c => c.id === 'K-1');
  const agg1 = CR.creditConditionsAt(k1, CR.TODAY);
  const single = agg1.rate && agg1.rate.divergent !== true;
  const divergent = db.credits.filter(c => {
    const a = CR.creditConditionsAt(c, CR.TODAY);
    return CR.PARAM_KEYS.some(k => a[k] && a[k].divergent);
  });
  const rows = divergent.length ? CR.divergenceRows(divergent[0], CR.TODAY) : [];
  ok(33, single && divergent.length === 1 && rows.length >= 1 && rows.every(r => r.cells.length >= 2),
     `divergent=${divergent.map(c=>c.id)} rows=${rows.map(r=>r.param)}`);
})();
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #33 — `CR.creditConditionsAt is not a function`.

- [ ] **Step 3: Реализовать агрегат и расхождения**

Рядом с `conditionsAt`:

```js
/* creditConditionsAt — Д-7: на уровне кредита условия суть агрегат по активным
   траншам. Согласны → {value}; разошлись → {divergent:true, values:[...]}.
   Тот же приём, что Р-13 для срока: кредит ничем не владеет, только сводит. */
function creditConditionsAt(credit, date){
  const ts = credit.tranches.filter(activeTranche);
  const out = {};
  for (const k of PARAM_KEYS){
    const vals = ts.map(t => ({ trancheNo:t.no, value:conditionsAt(t, date)[k] }));
    const uniq = [...new Set(vals.map(v => String(v.value)))];
    out[k] = uniq.length <= 1 ? { value: vals.length ? vals[0].value : undefined }
                              : { divergent:true, values:vals };
  }
  return out;
}
/* divergenceRows — строки таблицы «Расхождения по траншам»: только параметры,
   по которым транши разошлись на указанную дату. */
function divergenceRows(credit, date){
  const agg = creditConditionsAt(credit, date);
  return PARAM_KEYS.filter(k => agg[k] && agg[k].divergent)
                   .map(k => ({ param:k, cells:agg[k].values }));
}
```

Экспорт в `window.CR`: `creditConditionsAt, divergenceRows,`.

- [ ] **Step 4: Демо-расхождение на двухтраншевом `K-C*`**

Сразу после `credits.forEach(seedPrimaryRecords);`:

```js
  /* Демо Д-7: расхождение условий по траншам. Берём первый двухтраншевый
     сценарный кредит (K-C*, tr2:true) и меняем метод погашения только
     на транше №2 отдельным ДС. */
  const multi = credits.find(c => /^K-C/.test(c.id) && c.tranches.length === 2);
  if (multi){
    const t2 = multi.tranches[1];
    t2.conditionRecords.push(mkConditionRecord({
      param:'method', value:'равными долями', effectiveFrom:'01.06.2026',
      basis:{ kind:'agreement', ref:'ДС-1007', label:'Доп. соглашение ДС-1007', date:'20.05.2026' },
      note:'Метод погашения изменён только по траншу №2', createdAt:'20.05.2026'
    }));
    multi.agreements.push({ num:'ДС-1007', date:'20.05.2026', source:'кредит', scan:'ds-1007.pdf' });
  }
```

- [ ] **Step 5: Запустить, убедиться, что зелено**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #33, всё прежнее PASS. Если `divergent` больше одного — какой-то `K-C*` получил разные условия ещё где-то; найти по выводу `divergent=[...]`.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): агрегат условий по кредиту + расхождения по траншам (Д-7)

creditConditionsAt сводит активные транши: согласны — одно значение, разошлись —
divergent со списком. divergenceRows даёт строки таблицы расхождений.
Демо: метод погашения изменён только по траншу №2 первого двухтраншевого K-C*."
```

---

### Task 4: Журнал по основаниям, миграция ДС, снос `before/after`

**Files:**
- Modify: `mockups/loan-credit/credit.html` — § «3. Производные»; `seedDb` (`K-4`, 1127–1128 и блок после `seedPrimaryRecords`); `addAgreement` (2052–2065); экспорт
- Test: `scripts/inspect/credit-check.mjs` — новая #34

**Interfaces:**
- Consumes: `conditionsAt`, `crOrder`, `PARAM_KEYS`, `paramLabel`, `BASIS_KINDS`, `fd`, `pd`.
- Produces: `basisGroups(credit) -> [{ref, kind, label, docDate, effectiveFrom, retro, trancheNos:number[], items:[{param, from, to, effectiveFrom, trancheNo, note}]}]`, отсортировано по `effectiveFrom` desc. Экспорт `CR.basisGroups`.

- [ ] **Step 1: Написать падающую проверку**

```js
/* 34. Д-2: журнал строится группировкой записей по основанию; ДС-РС-1004
       кредита К-4 стал записями (ставка 9→7, срок 36→48, с 01.05.2026),
       а поля before/after у соглашений больше не хранятся. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-4');
  const groups = CR.basisGroups(c);
  const ds = groups.find(g => g.ref === 'ДС-РС-1004');
  const prim = groups.find(g => g.kind === 'application');
  const rate = ds && ds.items.find(i => i.param === 'rate');
  const term = ds && ds.items.find(i => i.param === 'term');
  const noBeforeAfter = (c.agreements || []).every(a => a.before === undefined && a.after === undefined);
  const desc = groups.length < 2 || CR.pd(groups[0].effectiveFrom) >= CR.pd(groups[1].effectiveFrom);
  ok(34, !!ds && !!prim && rate && String(rate.from)==='9' && String(rate.to)==='7'
      && term && String(term.from)==='36' && String(term.to)==='48'
      && ds.effectiveFrom==='01.05.2026' && noBeforeAfter && desc,
     `groups=${groups.map(g=>g.ref).join('|')} rate=${rate&&rate.from+'->'+rate.to}`);
})();
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #34 — `CR.basisGroups is not a function`.

- [ ] **Step 3: Реализовать `basisGroups`**

Перед добавлением проверить наличие хелпера сдвига даты: `grep -n 'const addD\|function addD' mockups/loan-credit/credit.html`. Если нет — добавить рядом с `addM`:

```js
const addD = (dt, n) => { const x = new Date(dt.getTime()); x.setDate(x.getDate() + n); return x; };
```

Затем рядом с `divergenceRows`:

```js
/* basisGroups — журнал изменений условий (Д-2/Д-6): записи всех траншей,
   сгруппированные по документу-основанию. «Что изменил документ» — производное:
   from = значение параметра на день ДО вступления, to = значение записи.
   Сортировка по дате вступления, новые сверху. */
function basisGroups(credit){
  const map = new Map();
  for (const t of credit.tranches){
    for (const r of (t.conditionRecords || [])){
      const key = (r.basis.ref || r.basis.label || r.basis.kind) + '@' + r.basis.kind;
      if (!map.has(key)) map.set(key, {
        ref:r.basis.ref || '—', kind:r.basis.kind,
        label:r.basis.label || BASIS_KINDS[r.basis.kind].label,
        docDate:r.basis.date || '', effectiveFrom:r.effectiveFrom, retro:false,
        trancheNos:[], items:[]
      });
      const g = map.get(key);
      const dayBefore = fd(addD(pd(r.effectiveFrom), -1));
      g.items.push({ param:r.param, from:conditionsAt(t, dayBefore)[r.param], to:r.value,
                     effectiveFrom:r.effectiveFrom, trancheNo:t.no, note:r.note });
      if (!g.trancheNos.includes(t.no)) g.trancheNos.push(t.no);
      if (pd(r.effectiveFrom) < pd(g.effectiveFrom)) g.effectiveFrom = r.effectiveFrom;
      if (r.effectiveFrom && r.createdAt && pd(r.effectiveFrom) < pd(r.createdAt)) g.retro = true;
    }
  }
  const out = [...map.values()];
  out.forEach(g => { g.trancheNos.sort((a,b) => a-b);
    g.items.sort((a,b) => PARAM_KEYS.indexOf(a.param)-PARAM_KEYS.indexOf(b.param) || a.trancheNo-b.trancheNo); });
  return out.sort((a,b) => pd(b.effectiveFrom) - pd(a.effectiveFrom));
}
```

Экспорт: `basisGroups,`.

- [ ] **Step 4: Мигрировать `ДС-РС-1004` кредита К-4 в записи**

Строки 1127–1128 — соглашение без значений:

```js
    agreements:[{ num:'ДС-РС-1004', date:'12.06.2026', source:'реструктуризация', scan:'ds-rs-1004.pdf' }],
```

После `credits.forEach(seedPrimaryRecords);` (рядом с блоком расхождения из Task 3):

```js
  /* Демо: ДС-РС-1004 кредита К-4 — ставка 9→7 и срок 36→48 с 01.05.2026.
     Раньше лежало в agreements[].before/after; теперь — записи (Р-21). */
  const k4 = credits.find(c => c.id === 'K-4');
  if (k4) for (const t of k4.tranches){
    t.conditionRecords.push(mkConditionRecord({
      param:'rate', value:7, effectiveFrom:'01.05.2026',
      basis:{ kind:'agreement', ref:'ДС-РС-1004',
              label:'Доп. соглашение ДС-РС-1004 (реструктуризация)', date:'12.06.2026' },
      note:'Реструктуризация: ставка снижена', createdAt:'12.06.2026'
    }));
    t.conditionRecords.push(mkConditionRecord({
      param:'term', value:48, effectiveFrom:'01.05.2026',
      basis:{ kind:'agreement', ref:'ДС-РС-1004',
              label:'Доп. соглашение ДС-РС-1004 (реструктуризация)', date:'12.06.2026' },
      note:'Реструктуризация: срок продлён', createdAt:'12.06.2026'
    }));
  }
```

Чтобы `from` вышло `9` и `36`, первичные записи К-4 должны нести именно эти значения: проверить `grep -n "id:'K-4'" -A12 mockups/loan-credit/credit.html` и при расхождении править `baseConditions` кредита К-4, а не запись ДС.

- [ ] **Step 5: `addAgreement` — больше не носитель значений**

Заменить тело (2052–2065) на:

```js
/* addAgreement(credit, {num,date,source,scan}) — Г-10: регистрирует ДОКУМЕНТ-ДС.
   Значения условий документом больше не переносятся: их несут записи (Р-21),
   которые пишет addConditionRecords. Историю версий заменяет журнал basisGroups. */
function addAgreement(credit, ctx){
  const g = gate(credit, 'addAgreement', ctx);                          // Г-10
  if (!g.ok) return g;
  const doc = { num:ctx.num, date:ctx.date, source:ctx.source || 'кредит', scan:ctx.scan || '' };
  credit.agreements.push(doc);
  pushAudit(credit, 'addAgreement', null, doc);
  return { ok:true, value:doc };
}
```

- [ ] **Step 6: Запустить, убедиться, что зелено**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #34 и весь набор. Если падает существующая проверка, опиравшаяся на `agreements[].active` или `before/after` — переписать её на `CR.basisGroups(c)` и упомянуть это в сообщении коммита.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): журнал изменений условий по основаниям, ДС мигрировано в записи

basisGroups группирует записи всех траншей по документу и выводит «было → стало»
как производное (значение на день до вступления). agreements[] сжалось до реестра
документов: before/after снесены, значения условий несут только conditionRecords."
```

---

### Task 5: Суд и постановление правительства, ретро-флаги

**Files:**
- Modify: `mockups/loan-credit/credit.html` — § «3. Производные» (`retroFlags`); `seedDb` (`K-3`, `K-2`); экспорт
- Test: `scripts/inspect/credit-check.mjs` — новая #35

**Interfaces:**
- Consumes: `mkConditionRecord`, `BASIS_KINDS`, `pd`.
- Produces: `retroFlags(credit) -> [{record, trancheNo, param, effectiveFrom, basisLabel}]`. Экспорт `CR.retroFlags`.

- [ ] **Step 1: Написать падающую проверку**

```js
/* 35. Д-4/Д-5: суд и ПП — источники изменения условий по ссылке на существующий
       документ; ретро-запись помечена флагом ровно на К-3. */
(() => { const db = CR.seedDb();
  const k3 = db.credits.find(c => c.id === 'K-3');
  const k2 = db.credits.find(c => c.id === 'K-2');
  const courtRec = k3.tranches.flatMap(t => t.conditionRecords).find(r => r.basis.kind === 'court');
  const govRec   = k2.tranches.flatMap(t => t.conditionRecords).find(r => r.basis.kind === 'govAct');
  const retroK3  = CR.retroFlags(k3);
  const retroOthers = db.credits.filter(c => c.id !== 'K-3' && CR.retroFlags(c).length);
  ok(35, courtRec && courtRec.param === 'penaltyMain' && Number(courtRec.value) === 0 && !!courtRec.basis.ref
      && govRec && govRec.param === 'reserveRate' && !!govRec.basis.ref
      && retroK3.length >= 1 && retroOthers.length === 0,
     `court=${!!courtRec} gov=${!!govRec} retroK3=${retroK3.length} прочие=${retroOthers.map(c=>c.id)}`);
})();
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #35 — `CR.retroFlags is not a function`.

- [ ] **Step 3: Реализовать `retroFlags`**

Рядом с `basisGroups`:

```js
/* retroFlags — Д-5: записи, вступившие в силу раньше дня своего создания.
   Автопересчёта нет: флаги питают красную плашку «требуется перегенерация
   графика» на вкладке «Условия» и бейдж на «Расчётах». */
function retroFlags(credit){
  const out = [];
  for (const t of credit.tranches) for (const r of (t.conditionRecords || [])){
    if (r.effectiveFrom && r.createdAt && pd(r.effectiveFrom) < pd(r.createdAt))
      out.push({ record:r, trancheNo:t.no, param:r.param,
                 effectiveFrom:r.effectiveFrom, basisLabel:r.basis.label || r.basis.ref });
  }
  return out;
}
```

Экспорт: `retroFlags,`.

- [ ] **Step 4: Демо-записи суда и ПП**

Проверить, что у К-3 непустой `mirror.court`: `grep -n "id:'K-3'" -A45 mockups/loan-credit/credit.html | grep court`. Если массив пуст — добавить решение по образцу существующих записей `mirror.court` (`num`, `date`, `kind`, `subject`): Д-4 требует ссылки на существующий документ.

После блоков из задач 3–4:

```js
  /* Демо Д-4/Д-5: решение суда списало пеню по ОД с начала года — запись
     ретроспективная (вступает 01.01.2026, создана 12.07.2026), ссылается
     на существующее решение из mirror.court (кредит его не заводит). */
  const k3 = credits.find(c => c.id === 'K-3');
  if (k3){
    const court = (k3.mirror.court || [])[0] || {};
    for (const t of k3.tranches) t.conditionRecords.push(mkConditionRecord({
      param:'penaltyMain', value:0, effectiveFrom:'01.01.2026',
      basis:{ kind:'court', ref:court.num || 'АД-118',
              label:'Решение суда № ' + (court.num || 'АД-118') + ' от ' + (court.date || '20.04.2026'),
              date:court.date || '20.04.2026' },
      note:'Пеня по основному долгу списана судом с начала года; график требует перегенерации',
      createdAt:'12.07.2026'
    }));
  }
  /* Демо Д-4: постановление правительства сняло ставку резерва.
     Ссылка — на ПП из блока «Происхождение» (Р-18), новый документ не заводится. */
  const k2 = credits.find(c => c.id === 'K-2');
  if (k2) for (const t of k2.tranches) t.conditionRecords.push(mkConditionRecord({
    param:'reserveRate', value:0, effectiveFrom:'01.06.2026',
    basis:{ kind:'govAct', ref:k2.origin.govDecisionId || 'ПП-КР-214',
            label:'Постановление правительства ' + (k2.origin.govDecisionId || 'ПП-КР-214'),
            date:'03.03.2026' },
    note:'Ставка резерва за неполное освоение снята постановлением',
    createdAt:'01.06.2026'
  }));
```

Внимание: `createdAt` записи ПП равен `effectiveFrom` — она НЕ ретроспективная, иначе #35 упадёт с `прочие=[K-2]`.

- [ ] **Step 5: Запустить, убедиться, что зелено**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #35, весь набор PASS. Если упала #33 (`divergent` стало 2) — записи суда/ПП добавлены не на все транши кредита.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): суд и постановление правительства как источники условий (Д-4)

Записи ссылаются на существующий документ (mirror.court, origin.govDecisionId) —
кредит их не заводит, паттерн Р-7/Р-16. retroFlags помечает записи, вступившие
раньше дня создания: К-3 — списание пени судом с 01.01.2026 (Д-5)."
```

---

### Task 6: Мутатор `addConditionRecords` и гейты Г-9, Г-10, Г-18…Г-21

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `gate` (1826–1890), § «5. Мутаторы» (после `addAgreement`), `ROLE_ACTS` (1897–1900), экспорт
- Test: `scripts/inspect/credit-check.mjs` — новая #36

**Interfaces:**
- Consumes: `gate`, `pushAudit`, `mkConditionRecord`, `PARAM_KEYS`, `paramLabel`, `BASIS_KINDS`, `conditionsAt`.
- Produces: `addConditionRecords(credit, ctx)`, где `ctx = {basis:{kind, ref?, label?, date?, num?, scan?, source?}, records:[{param, value, effectiveFrom, trancheNos:number[], note}]}` → `{ok:true, value:{added:number}}` либо `{ok:false, reasons:string[]}`. Ключ действия для гейтов и ролей — `'addConditionRecords'`. Экспорт `CR.addConditionRecords`.

- [ ] **Step 1: Написать падающую проверку**

```js
/* 36. Гейты Г-18…Г-21 вокруг записи условия. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-1');
  const t = c.tranches[0];
  const mk = (over) => Object.assign({
    basis:{ kind:'agreement', num:'ДС-2001', date:CR.TODAY, ref:'ДС-2001', label:'ДС-2001' },
    records:[{ param:'rate', value:5, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }]
  }, over || {});
  /* Г-18: раньше даты договора */
  const g18 = CR.addConditionRecords(c, mk({ records:[{ param:'rate', value:5,
    effectiveFrom:'01.01.2000', trancheNos:[t.no], note:'x' }] }));
  /* Г-19: ретро-ДС запрещено */
  const g19bad = CR.addConditionRecords(c, mk({ records:[{ param:'rate', value:5,
    effectiveFrom:'01.03.2026', trancheNos:[t.no], note:'x' }] }));
  /* Г-19: ретро-суд разрешено, но Г-20 требует примечания */
  const courtBasis = { kind:'court', ref:'АД-999', label:'Решение суда АД-999', date:'01.02.2026' };
  const g20bad = CR.addConditionRecords(c, { basis:courtBasis,
    records:[{ param:'rate', value:5, effectiveFrom:'01.03.2026', trancheNos:[t.no], note:'' }] });
  const g20ok  = CR.addConditionRecords(c, { basis:courtBasis,
    records:[{ param:'rate', value:5, effectiveFrom:'01.03.2026', trancheNos:[t.no], note:'по решению суда' }] });
  /* Г-10: суд без ссылки на документ */
  const g10 = CR.addConditionRecords(c, { basis:{ kind:'court', ref:'', label:'' },
    records:[{ param:'rate', value:5, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'x' }] });
  /* Г-21: функции удаления записей в API нет */
  const noDelete = Object.keys(CR).every(k => !/^(remove|delete).*[Cc]ondition/.test(k));
  ok(36, !g18.ok && !g19bad.ok && !g20bad.ok && g20ok.ok && !g10.ok && noDelete
      && CR.conditionsAt(t, CR.TODAY).rate === 5,
     `г18=${g18.ok} г19=${g19bad.ok} г20=${g20bad.ok}/${g20ok.ok} г10=${g10.ok} noDelete=${noDelete}`);
})();
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL #36 — `CR.addConditionRecords is not a function`.

- [ ] **Step 3: Гейты**

В `gate` рядом с `case 'addAgreement':` (1854):

```js
    case 'addConditionRecords': {                                          // Г-10 · Г-18 · Г-19 · Г-20
      const bs = ctx.basis || {}, meta = BASIS_KINDS[bs.kind];
      if (!meta) r.push('Основание обязательно: доп. соглашение · решение суда · постановление правительства');
      if (bs.kind === 'agreement' && (!bs.num || !bs.date))
        r.push('Доп. соглашение требует номер и дату (Г-10)');
      if (meta && !meta.owned && !bs.ref)
        r.push('Решение суда и постановление правительства указываются ссылкой на существующий документ (Г-10)');
      if (!ctx.records || !ctx.records.length) r.push('Не выбрано ни одного условия');
      for (const rec of (ctx.records || [])){
        if (!PARAM_KEYS.includes(rec.param)) r.push('Неизвестный параметр условия: ' + rec.param);
        if (!rec.trancheNos || !rec.trancheNos.length)
          r.push('Не выбран ни один транш для условия «' + paramLabel(rec.param) + '»');
        if (!rec.effectiveFrom){ r.push('Дата вступления в силу обязательна («' + paramLabel(rec.param) + '»)'); continue; }
        if (credit.date && pd(rec.effectiveFrom) < pd(credit.date))
          r.push('Дата вступления не может быть раньше даты договора ' + credit.date + ' (Г-18)');      // Г-18
        if (pd(rec.effectiveFrom) < pd(TODAY)){
          if (!meta || !meta.retro)
            r.push('Задним числом условия меняют только решение суда и постановление правительства (Г-19)'); // Г-19
          if (!rec.note || !String(rec.note).trim())
            r.push('Ретроспективное условие требует примечания: что пересчитывается (Г-20)');                // Г-20
        }
      }
      break;
    }
```

Там же поправить Г-9 (1866–1868):

```js
    case 'editConditions':
      if (credit.lifecycle!=='Проект')
        r.push('Изменение условий — только зарегистрированным основанием: доп. соглашение · решение суда · постановление правительства'); // Г-9
      break;
```

- [ ] **Step 4: Мутатор**

После `addAgreement`:

```js
/* addConditionRecords(credit, ctx) — Р-21: единственный способ изменить условия
   после регистрации. Одно действие = один документ-основание = N×M записей
   (N траншей × M параметров). Записи не удаляются и не «архивируются»: отмена —
   новая запись с прежним значением (Г-21). ДС при первом упоминании попадает
   в реестр документов credit.agreements. */
function addConditionRecords(credit, ctx){
  const g = gate(credit, 'addConditionRecords', ctx);            // Г-10 · Г-18 · Г-19 · Г-20
  if (!g.ok) return g;
  const bs = ctx.basis;
  const basis = { kind:bs.kind, ref:bs.ref || bs.num || '', date:bs.date || '',
                  label:bs.label || (BASIS_KINDS[bs.kind].label + ' ' + (bs.ref || bs.num || '')) };
  if (bs.kind === 'agreement' && !credit.agreements.some(a => a.num === bs.num))
    credit.agreements.push({ num:bs.num, date:bs.date, source:bs.source || 'кредит', scan:bs.scan || '' });
  let added = 0;
  for (const rec of ctx.records){
    for (const no of rec.trancheNos){
      const t = credit.tranches.find(x => x.no === no);
      if (!t) continue;
      const row = mkConditionRecord({ param:rec.param, value:rec.value,
        effectiveFrom:rec.effectiveFrom, basis, note:rec.note || '' });
      t.conditionRecords.push(row);
      pushAudit(credit, 'conditionRecord', null, row);
      added++;
    }
  }
  return { ok:true, value:{ added } };
}
```

- [ ] **Step 5: Роли и экспорт**

В `ROLE_ACTS` (1897–1900) добавить `'addConditionRecords'` в наборы «Кредитный специалист» и «Начальник отдела» — туда же, где `'addAgreement'`. «Наблюдателю» не добавлять.

В `window.CR` — `addConditionRecords,` рядом с `addAgreement`.

- [ ] **Step 6: Запустить, убедиться, что зелено**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS #36 и весь набор. #36 мутирует свой экземпляр `seedDb()`, на другие проверки это не влияет.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): addConditionRecords + гейты Г-18…Г-21, правка формулировки Г-9

Одно действие = документ-основание + N траншей × M параметров записей.
Г-18 — не раньше даты договора; Г-19 — задним числом только суд и ПП;
Г-20 — ретро требует примечания; Г-21 — удаления записей в API нет.
Г-9 больше не врёт «только доп. соглашением»: основанием может быть суд или ПП."
```

---

### Task 7: Вкладка — панель среза и карточки действующих условий

Первая UI-задача. На ней — панель среза + «Ставки»/«Погашение» с основанием под каждым значением и маркером расхождения; остальные блоки пока как были.

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `tabUsloviya` (2811–2895); состояние UI рядом с `let detailTrancheNo` (найти `grep -n 'let detailTrancheNo'`); хендлеры рядом с `CR.selectDetailTranche`
- Test: ручная проверка в браузере + `node scripts/inspect/credit-check.mjs` (регрессия)

**Interfaces:**
- Consumes: `creditConditionsAt`, `conditionsAt`, `crOrder`, `paramLabel`, `BASIS_KINDS`, `activeTranche`, существующие `roleBtn`, `cgrid`, `fld`, `jsAttr`, `esc`.
- Produces: состояние `condScope` (`'credit'` | номер транша), `condAsOf` (`DD.MM.YYYY`); хендлеры `CR.setCondScope(v)`, `CR.setCondAsOf(v)`, `CR.scrollToDivergence()`.

- [ ] **Step 1: Состояние и хендлеры**

Рядом с `let detailTrancheNo`:

```js
  let condScope = 'credit';         // 'credit' | номер транша — область просмотра условий (Д-7)
  let condAsOf  = TODAY;            // дата среза условий (Д-6)
```

Рядом с `CR.selectDetailTranche`:

```js
  CR.setCondScope=function(v){ condScope = (v==='credit'?'credit':+v); rerenderDetail(); };
  CR.setCondAsOf=function(v){ const s=String(v||'').trim();
    condAsOf = /^\d{2}\.\d{2}\.\d{4}$/.test(s)?s:TODAY; rerenderDetail(); };
  CR.scrollToDivergence=function(){ const el=document.getElementById('condDivergence');
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); };
  CR.openCondModal=function(){ toast('Конструктор условий — Task 10','warn'); };   // заглушка до Task 10
```

- [ ] **Step 2: Хелпер значения с основанием**

Внутри `tabUsloviya`, до `return`:

```js
    /* Значение параметра + подпись «основание · с даты» (Д-6) либо маркер
       расхождения по траншам (Д-7). Основание берём из записи, которая
       действует на дату среза. */
    const recFor=(t,param)=>((t.conditionRecords||[])
      .filter(r=>r.param===param && r.effectiveFrom && pd(r.effectiveFrom)<=pd(condAsOf))
      .sort(crOrder).pop());
    const srcLine=(t,param)=>{ const r=recFor(t,param);
      if(!r) return '<span class="src">нет записи на дату среза</span>';
      const ic=BASIS_KINDS[r.basis.kind]||{};
      return `<span class="src">${esc(ic.icon||'')} ${esc(r.basis.ref||ic.label||'')} · с ${esc(r.effectiveFrom)}</span>`; };
    const condCell=(param)=>{
      if (condScope!=='credit'){
        const t=c.tranches.find(x=>x.no===condScope)||c.tranches[0];
        const v=conditionsAt(t,condAsOf)[param];
        return `<div class="val">${esc(v===undefined?'—':v)}</div>${srcLine(t,param)}`;
      }
      const agg=creditConditionsAt(c,condAsOf)[param]||{};
      if (agg.divergent){
        const list=agg.values.map(v=>esc(v.value)).join(' / ');
        return `<div class="val">${list} <span class="pill mid" style="cursor:pointer" onclick="CR.scrollToDivergence()"
          title="Значения различаются по траншам — см. «Расхождения по траншам»">⚠ расх.</span></div>
          <span class="src">${agg.values.map(v=>'№'+v.trancheNo+': '+esc(v.value)).join(' · ')}</span>`;
      }
      const t0=c.tranches.filter(activeTranche)[0]||c.tranches[0];
      return `<div class="val">${esc(agg.value===undefined?'—':agg.value)}</div>${t0?srcLine(t0,param):''}`;
    };
    const cf=(param)=>`<div class="field"><span class="flabel">${esc(paramLabel(param))}${locked?' '+lockG9:''}</span>
      <div class="lookup"${locked?` title="${jsAttr(g9)}"`:''}>${condCell(param)}</div></div>`;
```

Класс `.src` уже используется в плитках шапки — переиспользуем. Проверить: `grep -n '\.src{' mockups/loan-credit/credit.html`; если нет — добавить в `<style>`: `.src{display:block;color:var(--text-muted);font-size:11px;margin-top:2px}`.

- [ ] **Step 3: Панель среза и переписанные карточки**

В `return` перед `<div class="pcards">`:

```js
      <div class="gtoolbar" style="margin-bottom:14px">
        <div class="field" style="max-width:280px"><span class="flabel">Область</span>
          <div class="control"><select onchange="CR.setCondScope(this.value)">
            <option value="credit"${condScope==='credit'?' selected':''}>по кредиту (агрегат)</option>
            ${c.tranches.map(t=>`<option value="${t.no}"${condScope===t.no?' selected':''}>Транш №${t.no}</option>`).join('')}
          </select><span class="caret">▾</span></div></div>
        <div class="field" style="max-width:200px"><span class="flabel">Условия на дату</span>
          <div class="control"><input value="${esc(condAsOf)}" placeholder="дд.мм.гггг"
            onchange="CR.setCondAsOf(this.value)"></div></div>
        ${condAsOf!==TODAY?`<button class="btn btn-secondary btn-sm" onclick="CR.setCondAsOf('${TODAY}')">⟲ сегодня</button>`:''}
        <span class="spacer"></span>
        ${roleBtn('addConditionRecords','Изменить условия','CR.openCondModal()','btn btn-primary btn-sm')}
      </div>
```

Тело карточки «Ставки»:

```js
          <div class="f2">
            ${cf('rate')}
            ${cf('reserveRate')}
            ${cf('penaltyMain')}
            ${cf('penaltyInt')}
          </div>
          ${b.floating?`<p class="section-note" style="margin-bottom:0">Плавающая: ${esc(b.floatType||'—')} + маржа ${esc(b.margin)}% (шаблон кредита; каждое пересчитанное значение приходит записью с основанием).</p>`:''}
```

Тело карточки «Погашение»:

```js
          <div class="f2">
            ${cf('term')}
            ${cf('freq')}
            ${cf('method')}
            ${cf('graceMain')}
            ${cf('graceInterest')}
            ${cf('graceAccrual')}
          </div>
```

Кнопку «Оформить доп. соглашение» из карточки «Доп. соглашения» убрать — её заменила «Изменить условия» в панели.

- [ ] **Step 4: Проверить в браузере**

Открыть `mockups/loan-credit/credit.html`:
- К-4: под «Ставка, %» — `7` и подпись `ДС ДС-РС-1004 · с 01.05.2026`;
- ввести в «Условия на дату» `01.04.2026` → ставка `9`, подпись меняется на заявку, появляется `⟲ сегодня`;
- К-3: «Пеня по ОД» = `0`, подпись `⚖ АД-118 · с 01.01.2026`;
- двухтраншевый `K-C*`, область «по кредиту»: у «Метод погашения» виден `⚠ расх.`.

- [ ] **Step 5: Регрессия**

Run: `node scripts/inspect/credit-check.mjs`
Expected: весь набор PASS.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): вкладка «Условия» — панель среза и действующие значения с основанием

Под каждым значением — документ-основание и дата вступления; область просмотра
переключается «по кредиту / транш», дата среза показывает условия на любой день.
Агрегат по кредиту помечает расхождение по траншам маркером ⚠ расх. (Д-6, Д-7)."
```

---

### Task 8: Таблица расхождений и журнал изменений условий

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `tabUsloviya` (блоки «Условия траншей — отклонение от базы» 2875–2878 и «Доп. соглашения» 2880–2885), хендлеры
- Test: ручная проверка + `node scripts/inspect/credit-check.mjs`

**Interfaces:**
- Consumes: `divergenceRows`, `basisGroups`, `paramLabel`, `BASIS_KINDS`, `crOrder`, `cgrid`, `jsAttr`.
- Produces: состояние `condBasisFilter` (`'all'|'agreement'|'court'|'govAct'|'application'`), `condOpenGroup` (`ref` развёрнутой группы или `null`); хендлеры `CR.setCondFilter(v)`, `CR.toggleCondGroup(ref)`.

- [ ] **Step 1: Состояние и хендлеры**

Рядом с `condAsOf`:

```js
  let condBasisFilter = 'all';      // фильтр журнала по типу основания
  let condOpenGroup   = null;       // ref развёрнутой группы журнала
```

Рядом с `CR.setCondScope`:

```js
  CR.setCondFilter=function(v){ condBasisFilter=v; rerenderDetail(); };
  CR.toggleCondGroup=function(ref){ condOpenGroup = (condOpenGroup===ref?null:ref); rerenderDetail(); };
```

- [ ] **Step 2: Таблица расхождений вместо «Условий траншей»**

Карточку с `<div class="section-h">Условия траншей — отклонение от базы</div>` заменить на:

```js
        <div class="pcard wide" id="condDivergence">
          <div class="section-h">Расхождения по траншам (на ${esc(condAsOf)})</div>
          <p class="section-note">Условия принадлежат траншу (Д-3). Здесь только параметры,
            по которым транши разошлись на дату среза; согласованные значения — в карточках выше.</p>
          ${(()=>{ const rows=divergenceRows(c,condAsOf);
            const cols=[{h:'Параметр'}].concat(c.tranches.map(t=>({h:'Транш №'+t.no})))
                                       .concat([{h:'Основание расхождения'}]);
            const trs=rows.map(r=>{
              const cells=c.tranches.map(t=>{ const cell=r.cells.find(x=>x.trancheNo===t.no);
                return `<td>${esc(cell?cell.value:'—')}</td>`; }).join('');
              const refs=[...new Set(c.tranches.map(t=>{ const rec=(t.conditionRecords||[])
                .filter(x=>x.param===r.param && x.effectiveFrom && pd(x.effectiveFrom)<=pd(condAsOf))
                .sort(crOrder).pop();
                return rec?(rec.basis.ref||''):''; }).filter(Boolean))];
              return `<tr><td>${esc(paramLabel(r.param))}</td>${cells}<td>${esc(refs.join(' · '))}</td></tr>`; });
            return cgrid(cols, trs, {empty:'Расхождений нет — условия всех траншей совпадают'});
          })()}
        </div>
```

- [ ] **Step 3: Журнал вместо «Доп. соглашений»**

Карточку `<div class="section-h">Доп. соглашения (Р-4)</div>` заменить на:

```js
        <div class="pcard wide">
          <div class="section-h">Журнал изменений условий</div>
          <p class="section-note">Каждая строка — документ-основание; «Изменено» и «было → стало» —
            производные от записей условий (Р-21). Записи не удаляются: отмена — новая запись (Г-21).</p>
          <div class="gtoolbar">
            ${['all','agreement','court','govAct','application'].map(k=>{
              const lbl = k==='all'?'все':BASIS_KINDS[k].label;
              return `<span class="pill ${condBasisFilter===k?'low':'neutral'}" style="cursor:pointer"
                onclick="CR.setCondFilter('${k}')">${esc(lbl)}</span>`; }).join(' ')}
          </div>
          ${(()=>{ const gs=basisGroups(c).filter(g=>condBasisFilter==='all'||g.kind===condBasisFilter);
            const trs=[];
            for (const g of gs){
              const ic=BASIS_KINDS[g.kind]||{};
              const uniq=[...new Set(g.items.map(i=>i.param))];
              const changed=uniq.slice(0,3).map(paramLabel).join(' · ')+(uniq.length>3?' …':'');
              trs.push(`<tr style="cursor:pointer" onclick="CR.toggleCondGroup('${jsAttr(g.ref)}')">
                <td>${esc(ic.icon||'')} ${esc(g.ref)}</td><td>${esc(g.docDate||'—')}</td>
                <td>${esc(g.effectiveFrom)}${g.retro?' <span class="pill high">задним числом</span>':''}</td>
                <td>${esc(changed)}</td><td>${g.trancheNos.map(n=>'№'+n).join(', ')}</td>
                <td>${condOpenGroup===g.ref?'▾':'▸'}</td></tr>`);
              if (condOpenGroup===g.ref) trs.push(`<tr><td colspan="6" style="background:var(--surface-panel)">
                ${cgrid([{h:'Параметр'},{h:'Было'},{h:'Стало'},{h:'Вступает'},{h:'Транш'},{h:'Примечание'}],
                  g.items.map(i=>`<tr><td>${esc(paramLabel(i.param))}</td>
                    <td><span class="diff-old">${esc(i.from===undefined?'—':i.from)}</span></td>
                    <td><span class="diff-new">${esc(i.to)}</span></td>
                    <td>${esc(i.effectiveFrom)}</td><td>№${i.trancheNo}</td><td>${esc(i.note||'')}</td></tr>`))}
                </td></tr>`);
            }
            return cgrid([{h:'Документ'},{h:'Дата док.'},{h:'Вступает'},{h:'Изменено'},{h:'Транши'},{h:''}],
                         trs, {empty:'Изменений условий не было'});
          })()}
        </div>
```

- [ ] **Step 4: Проверить в браузере**

К-4: две группы — `ДС-РС-1004` (вступает 01.05.2026) и заявка; клик разворачивает `Ставка 9 → 7`, `Срок 36 → 48`.
К-3: группа решения суда с пилюлей «задним числом», в развороте `Пеня по ОД 0.1 → 0`.
Фильтр «Решение суда» оставляет только судебные группы.
Двухтраншевый `K-C*`: в расхождениях строка «Метод погашения», `⚠ расх.` из Task 7 прокручивает к ней.

- [ ] **Step 5: Регрессия**

Run: `node scripts/inspect/credit-check.mjs`
Expected: весь набор PASS.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): таблица расхождений по траншам + журнал изменений условий

Блок «Условия траншей — отклонение от базы» заменён расхождениями на дату среза;
«Доп. соглашения» — журналом по документам-основаниям с фильтром по типу,
разворотом «было → стало» и пилюлей «задним числом» для ретро-записей."
```

---

### Task 9: Плашки, сводная матрица, шаблон наследования

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `tabUsloviya` (плашки сверху, два свёрнутых блока перед «Переводом долга»), `tabRaschety` (бейдж после `${svod}`), хендлеры
- Test: ручная проверка + `node scripts/inspect/credit-check.mjs`

**Interfaces:**
- Consumes: `retroFlags`, `PARAMS`, `paramLabel`, `cgrid`, `fld`, `svgInfo`.
- Produces: состояние `condMatrixOpen`, `condTemplateOpen`; хендлеры `CR.toggleCondMatrix()`, `CR.toggleCondTemplate()`, `CR.goToCalc()`.

- [ ] **Step 1: Состояние и хендлеры**

```js
  let condMatrixOpen = false, condTemplateOpen = false;
```

```js
  CR.toggleCondMatrix=function(){ condMatrixOpen=!condMatrixOpen; rerenderDetail(); };
  CR.toggleCondTemplate=function(){ condTemplateOpen=!condTemplateOpen; rerenderDetail(); };
  CR.goToCalc=function(){ detailTab='Расчёты'; rerenderDetail(); };
```

Имя переменной активной вкладки проверить: `grep -n "let detailTab\|detailTab *=" mockups/loan-credit/credit.html` — использовать существующее.

- [ ] **Step 2: Ретро-плашка над сеткой карточек**

В `tabUsloviya` сразу после плашки Г-9:

```js
      ${(()=>{ const rf=retroFlags(c); if(!rf.length) return '';
        const first=rf[0];
        return `<div class="warn-inline" style="margin-bottom:14px">${svgInfo()}<div>
          Условия изменены задним числом: ${esc(paramLabel(first.param))} действует с
          <b>${esc(first.effectiveFrom)}</b> (${esc(first.basisLabel)})${rf.length>1?` и ещё ${rf.length-1} записи`:''}.
          Автоматического пересчёта нет (Д-5): график и начисления построены по прежним условиям —
          требуется перегенерация.
          <div class="gtoolbar" style="margin-top:8px"><button class="btn btn-secondary btn-sm"
            onclick="CR.goToCalc()">Перейти к перегенерации графика</button></div>
        </div></div>`; })()}
```

Класс `.warn-inline` уже используется в `openSchedModal` — переиспользуем.

- [ ] **Step 3: Свёрнутая матрица и шаблон наследования**

Перед карточкой «Перевод долга»:

```js
        <div class="pcard wide">
          <div class="section-h" style="cursor:pointer" onclick="CR.toggleCondMatrix()">
            ${condMatrixOpen?'▾':'▸'} Сводная матрица условий (параметр × дата вступления)</div>
          ${condMatrixOpen?(()=>{
            const recs=c.tranches.flatMap(t=>(t.conditionRecords||[]).map(r=>({t,r})));
            const dates=[...new Set(recs.map(x=>x.r.effectiveFrom))].sort((a,b)=>pd(a)-pd(b));
            const cols=[{h:'Параметр'}].concat(dates.map(d=>({h:d})));
            const trs=PARAMS.map(p=>{
              const cells=dates.map(d=>{ const hit=recs.filter(x=>x.r.param===p.key && x.r.effectiveFrom===d);
                if(!hit.length) return '<td style="color:var(--text-placeholder)">·</td>';
                const vals=[...new Set(hit.map(x=>String(x.r.value)))].join(' / ');
                return `<td>${esc(vals)}<br><span class="src">${esc(hit[0].r.basis.ref||'')}</span></td>`; }).join('');
              return `<tr><td>${esc(p.label)}</td>${cells}</tr>`; });
            return `<p class="section-note">Модель Р-21 в лоб: у каждого условия своя дата вступления
              и своё основание. Пустая ячейка — в эту дату параметр не менялся.</p>
              ${cgrid(cols, trs, {empty:'Записей нет'})}`;
          })():''}
        </div>

        <div class="pcard wide">
          <div class="section-h" style="cursor:pointer" onclick="CR.toggleCondTemplate()">
            ${condTemplateOpen?'▾':'▸'} Шаблон наследования (что унаследует новый транш)</div>
          ${condTemplateOpen?`<p class="section-note">Не действующие условия (Д-3): значения,
            копируемые в записи при создании нового транша. Действующие — в карточках выше.
            Правка шаблона возможна только в ЖЦ «Проект» (Г-9).</p>
            <div class="f2">${PARAMS.map(p=>fld(p.label, esc(b[p.key]))).join('')}</div>`:''}
        </div>
```

- [ ] **Step 4: Бейдж на вкладке «Расчёты»**

В `tabRaschety` сразу после `${svod}`:

```js
      ${(()=>{ const rf=retroFlags(c); if(!rf.length) return '';
        return `<div class="warn-inline" style="margin-top:14px">${svgInfo()}<div>
          Условия изменены задним числом (с ${esc(rf[0].effectiveFrom)}, ${esc(rf[0].basisLabel)}).
          Расчёт ниже построен по прежним условиям — сформируйте график заново (Д-5).</div></div>`; })()}
```

- [ ] **Step 5: Проверить в браузере**

К-3: сверху «Условий» красная плашка про 01.01.2026 с кнопкой; кнопка переключает на «Расчёты», где виден такой же бейдж. К-1 — плашек нет. Матрица на К-4: колонки `05.11.2025` и `01.05.2026`, в пересечении «Ставка, %» — `7 · ДС-РС-1004`. «Шаблон наследования» — 10 полей из `baseConditions`.

- [ ] **Step 6: Регрессия**

Run: `node scripts/inspect/credit-check.mjs`
Expected: весь набор PASS.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): ретро-плашка с переходом в «Расчёты», сводная матрица, шаблон наследования

Ретроспективное изменение условий больше не молчит: плашка на «Условиях» и бейдж
на «Расчётах» говорят, что график построен по прежним условиям (Д-5, без
автопересчёта). Матрица параметр × дата и шаблон наследования — свёрнутыми блоками."
```

---

### Task 10: Конструктор «Изменить условия»

**Files:**
- Modify: `mockups/loan-credit/credit.html` — удалить `CR.openAgrModal` / `CR.agrDiff` / `CR.submitAgr` (3319–3350) и заглушку `CR.openCondModal` из Task 7; добавить новый модал
- Test: ручная проверка + `node scripts/inspect/credit-check.mjs`

**Interfaces:**
- Consumes: `modalGuard`, `currentCredit`, `CR.openModal`, `CR.closeModal`, `CR.modalErr`, `toast`, `rerenderDetail`, `CR.addConditionRecords`, `CR.conditionsAt`, `CR.PARAMS`, `CR.paramLabel`.
- Produces: `CR.openCondModal()`, `CR.condBasisChanged()`, `CR.condPreview()`, `CR.submitCond()`.

- [ ] **Step 1: Удалить старый конструктор ДС**

Удалить `CR.openAgrModal`, `CR.agrDiff`, `CR.submitAgr` (3319–3350) и заглушку `CR.openCondModal` из Task 7. Проверить: `grep -n 'openAgrModal\|agrDiff\|submitAgr' mockups/loan-credit/credit.html` → пусто.

- [ ] **Step 2: Новый модал**

На место удалённого блока:

```js
  /* 4) конструктор условий (addConditionRecords, Р-21 · Г-10 · Г-18…Г-20):
     основание → дата вступления → транши → параметры → предпросмотр «было → станет». */
  CR.openCondModal=function(){ const c=modalGuard('addConditionRecords'); if(!c) return;
    const courts=(c.mirror.court||[]);
    const gov=c.origin.govDecisionId?[{num:c.origin.govDecisionId}]:[];
    const body=`<p class="section-note">Условия меняются только зарегистрированным основанием (Г-9).
        Решение суда и постановление правительства здесь не заводятся — выбираются из существующих (Д-4).
        Задним числом (Г-19) возможны только они, и с обязательным примечанием (Г-20).</p>
      <div class="mform">
        <div class="field req col-span"><span class="flabel">Тип основания</span>
          <div class="control"><select id="cbKind" onchange="CR.condBasisChanged()">
            <option value="agreement">Доп. соглашение</option>
            <option value="court">Решение суда</option>
            <option value="govAct">Постановление правительства</option>
          </select><span class="caret">▾</span></div></div>
        <div id="cbAgrFields" class="col-span"><div class="mform">
          <div class="field req"><span class="flabel">Номер ДС</span><div class="control"><input id="cbNum" placeholder="ДС-..."></div></div>
          <div class="field req"><span class="flabel">Дата ДС</span><div class="control"><input id="cbDate" value="${esc(CR.TODAY)}" placeholder="дд.мм.гггг"></div></div>
          <div class="field col-span"><span class="flabel">Скан</span><div class="control"><input id="cbScan" placeholder="файл.pdf"></div></div>
        </div></div>
        <div id="cbRefField" class="field req col-span" style="display:none"><span class="flabel">Документ-основание</span>
          <div class="control"><select id="cbRef">
            ${courts.map(x=>`<option value="${jsAttr(x.num)}">⚖ ${esc(x.num)}${x.date?' от '+esc(x.date):''}</option>`).join('')}
            ${gov.map(x=>`<option value="${jsAttr(x.num)}">ПП ${esc(x.num)}</option>`).join('')}
          </select><span class="caret">▾</span></div></div>
        <div class="field req"><span class="flabel">Вступает в силу</span><div class="control"><input id="cbEff" value="${esc(CR.TODAY)}" placeholder="дд.мм.гггг" onchange="CR.condPreview()"></div></div>
        <div class="field col-span"><span class="flabel">Примечание (обязательно при дате в прошлом)</span><div class="control"><input id="cbNote" placeholder="что пересчитывается"></div></div>
        <div class="field col-span"><span class="flabel">Транши</span><div class="control">
          ${c.tranches.map(t=>`<label style="margin-right:14px"><input type="checkbox" class="cbTr" value="${t.no}" checked onchange="CR.condPreview()"> №${t.no}</label>`).join('')}
        </div></div>
      </div>
      <div class="section-h" style="margin-top:14px;font-size:15px">Условия</div>
      <div class="mform">
        ${CR.PARAMS.map(p=>{
          const t0=c.tranches[0], cur=t0?CR.conditionsAt(t0,CR.TODAY)[p.key]:'';
          const input = p.kind==='enum'
            ? `<select id="cbV_${p.key}" onchange="CR.condPreview()">${p.options.map(o=>`<option${String(o)===String(cur)?' selected':''}>${esc(o)}</option>`).join('')}</select><span class="caret">▾</span>`
            : `<input id="cbV_${p.key}" type="number" step="0.01" value="${esc(cur)}" oninput="CR.condPreview()">`;
          return `<div class="field"><span class="flabel"><label><input type="checkbox" class="cbP" value="${p.key}" onchange="CR.condPreview()"> ${esc(p.label)}</label></span>
            <div class="control">${input}</div></div>`;
        }).join('')}
      </div>
      <div class="section-h" style="margin-top:14px;font-size:15px">Предпросмотр (было → станет)</div>
      <div id="cbPreview" class="cat-expand"></div>`;
    CR.openModal('Изменение условий (Р-21 · Г-9 · Г-18…Г-20)', body,
      `<button class="btn btn-secondary" onclick="CR.closeModal()">Отмена</button>
       <button class="btn btn-primary" onclick="CR.submitCond()">Оформить</button>`);
    CR.condBasisChanged();
  };
  CR.condBasisChanged=function(){ const k=document.getElementById('cbKind').value;
    document.getElementById('cbAgrFields').style.display = k==='agreement'?'':'none';
    document.getElementById('cbRefField').style.display  = k==='agreement'?'none':'';
    CR.condPreview(); };
  CR.condPreview=function(){ const box=document.getElementById('cbPreview'); if(!box) return;
    const c=currentCredit(); if(!c) return;
    const eff=document.getElementById('cbEff').value;
    const nos=[...document.querySelectorAll('.cbTr:checked')].map(x=>+x.value);
    const keys=[...document.querySelectorAll('.cbP:checked')].map(x=>x.value);
    const rows=[];
    for (const k of keys) for (const no of nos){
      const t=c.tranches.find(x=>x.no===no); if(!t) continue;
      const from=CR.conditionsAt(t,CR.TODAY)[k];
      const to=document.getElementById('cbV_'+k).value;
      rows.push(`<div class="row"><span class="ck">№${no} · ${esc(CR.paramLabel(k))}</span>
        <span class="diff"><span class="diff-old">${esc(from===undefined?'—':from)}</span> → <span class="diff-new">${esc(to)}</span></span>
        <span class="src">с ${esc(eff)}</span></div>`);
    }
    box.innerHTML = rows.length?rows.join(''):`<div class="row" style="color:var(--text-placeholder)">Условия не выбраны</div>`; };
  CR.submitCond=function(){ const c=modalGuard('addConditionRecords'); if(!c) return;
    const kind=document.getElementById('cbKind').value;
    const eff=document.getElementById('cbEff').value, note=document.getElementById('cbNote').value;
    const nos=[...document.querySelectorAll('.cbTr:checked')].map(x=>+x.value);
    const keys=[...document.querySelectorAll('.cbP:checked')].map(x=>x.value);
    let basis;
    if (kind==='agreement'){
      const num=document.getElementById('cbNum').value, date=document.getElementById('cbDate').value;
      basis={ kind, num, date, scan:document.getElementById('cbScan').value,
              ref:num, label:'Доп. соглашение '+num };
    } else {
      const sel=document.getElementById('cbRef');
      const ref=sel&&sel.value?sel.value:'';
      basis={ kind, ref, date:'',
              label:(kind==='court'?'Решение суда № ':'Постановление правительства ')+ref };
    }
    const records=keys.map(k=>{ const p=CR.PARAMS.find(x=>x.key===k);
      const el=document.getElementById('cbV_'+k);
      return { param:k, value:(p.kind==='num'?+el.value:el.value),
               effectiveFrom:eff, trancheNos:nos, note }; });
    const r=CR.addConditionRecords(c,{basis,records});
    if(!r.ok){ CR.modalErr(r.reasons); return; }
    CR.closeModal(); toast('Записей условий добавлено: '+r.value.added,'ok'); rerenderDetail(); };
```

- [ ] **Step 3: Проверить наличие `currentCredit`**

Run: `grep -n 'function currentCredit' mockups/loan-credit/credit.html`
Expected: функция найдена (её использует `modalGuard`). Если нет — заменить в `CR.condPreview` на тот способ получения текущего кредита, который использует `modalGuard`.

- [ ] **Step 4: Проверить в браузере**

На К-1 (ЖЦ «Действует») нажать «Изменить условия»:
- тип «Доп. соглашение», дата вступления `01.03.2026` → «Оформить» → ошибка Г-19;
- вернуть `23.07.2026`, отметить «Ставка, %» = 5, оба транша → предпросмотр показывает две строки → «Оформить» → тост «Записей условий добавлено: 2», в карточке «Ставки» значение 5 с подписью нового ДС, в журнале новая группа;
- тип «Решение суда», дата вступления в прошлом, примечание пустое → ошибка Г-20; заполнить примечание → проходит, в журнале пилюля «задним числом», сверху появляется красная плашка;
- роль «Наблюдатель» — кнопки «Изменить условия» нет.

- [ ] **Step 5: Регрессия**

Run: `node scripts/inspect/credit-check.mjs`
Expected: весь набор PASS.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): конструктор «Изменить условия» вместо конструктора ДС

Одна форма на все основания: ДС вводится реквизитами, суд и ПП выбираются из
существующих документов (Д-4). Дата вступления, транши чекбоксами, параметры
из реестра, предпросмотр «было → станет» по каждому траншу. Гейты Г-18…Г-20
показываются ошибками формы."
```

---

### Task 11: Шапка-журнал, реестры решений и гейтов, финальный прогон

**Files:**
- Modify: `mockups/loan-credit/credit.html` — шапка-комментарий: журнал шагов (после блока «Шаг 14»), «РЕАЛИЗОВАННЫЕ РЕШЕНИЯ» (197–220), «ОТКРЫТЫЕ ВОПРОСЫ» (229–238)
- Test: `node scripts/inspect/credit-check.mjs` (финальный прогон, вписывает штамп)

- [ ] **Step 1: Запись шага в журнал шапки**

После блока «Шаг 14 · ВКЛАДКА «УСЛОВИЯ» — КАРТОЧНАЯ РАСКЛАДКА…», перед строкой «СЛИЯНИЕ КАРТОЧКИ ЗАВЕРШЕНО»:

```
   Шаг 15 · ВКЛАДКА «УСЛОВИЯ» — ВЕРСИОННОСТЬ УСЛОВИЙ (Р-21) — выполнен 2026-07-25:
     МОДЕЛЬ. Условия перестали быть плоским объектом. Единица — ЗАПИСЬ на параметр
               (t.conditionRecords: param · value · effectiveFrom · basis · note),
               лежит на транше (Д-3: scope не нужен, транш и есть область). Хранимое
               t.conditions удалено; действующий комплект — conditionsAt(транш, дата),
               на кредите — агрегат creditConditionsAt с маркером расхождения (Д-7).
               Реестр PARAMS — 10 ключей; dayMethod/queue остались в «Расчётах»
               (параметры движка), penaltyMaxPct не взят (поле мёртвое, шаг 4).
     ИСТОЧНИКИ. basis.kind: application (первичный комплект из заявки, версия №0) ·
               agreement (ДС, кредит владеет документом) · court · govAct (Д-4:
               здесь не заводятся, только ссылка на mirror.court / origin — Р-7/Р-16).
     ГЕЙТЫ. Г-9 переформулирован (не «только доп. соглашением», а «зарегистрированным
               основанием»: суд и ПП тоже). Новые: Г-18 (не раньше даты договора) ·
               Г-19 (задним числом — только суд/ПП) · Г-20 (ретро требует примечания) ·
               Г-21 (записи не удаляются, отмена — новая запись).
     ВКЛАДКА. Панель среза (область: кредит/транш · дата) над карточками; под каждым
               значением — основание и дата вступления. «Условия траншей — отклонение
               от базы» → «Расхождения по траншам (на дату среза)». «Доп. соглашения»
               → «Журнал изменений условий» (группировка по документу, фильтр по типу,
               разворот «было → стало», пилюля «задним числом»). Добавлены свёрнутые
               «Сводная матрица (параметр × дата)» и «Шаблон наследования».
     РЕТРО. Автопересчёта нет (Д-5): плашка на «Условиях» + бейдж на «Расчётах»
               «график построен по прежним условиям» и переход к перегенерации.
     ДЕМО. К-4 — ДС-РС-1004 записями (ставка 9→7, срок 36→48 с 01.05.2026);
               К-3 — ретро-списание пени судом с 01.01.2026 (единственная красная плашка);
               К-2 — ставка резерва снята ПП; первый двухтраншевый K-C* — расхождение
               по методу погашения (транш №2, ДС-1007).
     НЕ ДЕЛАЛОСЬ: автопересчёт графика/леджера и сторно (Д-5) · перевод dayMethod/queue
               в записи · перевод долга Р-14 в записи (меняет субъекта, не параметр) ·
               вкладка «Условия кредита» заявки (Д-1).
```

- [ ] **Step 2: Реестр решений**

В «РЕАЛИЗОВАННЫЕ РЕШЕНИЯ» после `Р-20` добавить:

```
   Р-21 Условия — записи на параметр на транше (param · value · effectiveFrom · basis);
        действующий комплект и любой исторический срез — производные (Р-11).
```

`Р-2` уточнить, чтобы не противоречил Р-21:

```
   Р-2  Условия двухуровневые: шаблон кредита → записи транша; дифф «шаблон → транш»
        и расхождения между траншами (уточнено шагом 15: действующее — только на транше).
```

`Р-4` уточнить:

```
   Р-4  Изменение условий после регистрации — только зарегистрированным основанием
        (ДС · решение суда · постановление правительства), записью с датой вступления.
```

- [ ] **Step 3: Открытые вопросы**

В блок «ОТКРЫТЫЕ ВОПРОСЫ» добавить:

```
   6. Приоритет источников при одной дате вступления: ПП/суд против ДС.
      Макет: побеждает позже созданная запись — помечено как допущение.
   7. Новый транш, созданный после ретро-изменения: наследует шаблон кредита или
      действующий комплект соседних траншей. Макет: шаблон.
   8. Скан основания для суда/ПП: нужна ли копия файла в «Досье» кредита.
      Макет: только ссылка на документ-владелец.
```

- [ ] **Step 4: Финальный прогон смоука**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `40/40 PASS` (32 прежних + #29…#36); штамп впечатан в блок «SMOKE (node)» шапки HTML.

- [ ] **Step 5: Ручной прогон по вкладкам**

Открыть макет и пройти К-1, К-2, К-3, К-4 и двухтраншевый `K-C*`: все восемь вкладок (Договор · Условия · Транши и освоение · Расчёты · Платежи · Обеспечение · Проблемные · Досье) открываются без ошибок в консоли; «Сформировать график» на К-1 работает; смена роли на «Наблюдатель» убирает кнопку «Изменить условия».

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "docs(credit): шаг 15 в журнале шапки, Р-21 и Г-18…Г-21 в реестрах

Зафиксированы модель записей условий, источники (заявка · ДС · суд · ПП),
новые гейты, изменения вкладки, демо-сценарии и три открытых вопроса
(приоритет источников, наследование после ретро-правки, скан основания).
Р-2 и Р-4 уточнены, чтобы не противоречить Р-21."
```

---

## Порядок и зависимости

```
Task 1 (записи + резолвер)
  └─ Task 2 (снос t.conditions)
       ├─ Task 3 (агрегат/расхождения)
       ├─ Task 4 (журнал + миграция ДС)
       │    └─ Task 5 (суд/ПП + ретро-флаги)
       │         └─ Task 6 (мутатор + гейты)
       └─ Task 7 (панель среза + карточки)      ← нужен Task 3
            └─ Task 8 (расхождения + журнал)    ← нужны Task 3, 4
                 └─ Task 9 (плашки, матрица)    ← нужен Task 5
                      └─ Task 10 (конструктор)  ← нужен Task 6
                           └─ Task 11 (шапка + финальный прогон)
```

Tasks 3 и 4 между собой независимы. Остальное — строго по стрелкам.
