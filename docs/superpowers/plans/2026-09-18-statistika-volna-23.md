# Статистика, волна 23 — план исполнения

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** перевести движок макета `mockups/statistics/statistics.html` на модель волны 22
(`ADR-0237`…`ADR-0245`) и поставить сторожа каждому из `ИС-53`…`ИС-58` — закрыть `СС-Д18`.

**Architecture:** макет — один HTML с исполняемым движком в `<script>` (объект `window.ST`);
смоук `scripts/inspect/statistics-check.mjs` исполняет этот скрипт в `node:vm` и проверяет
поведение движка проверками `ok(n, cond, note)`. Волна идёт задачами `З-13`…`З-23`: каждая
сначала пишет падающих сторожей, потом правит движок, потом переписывает сторожей прежней
модели, потом проверяется мутацией во временной копии и коммитится одним коммитом.

**Tech Stack:** HTML + ванильный JS (макет), Node 20+ `node:vm` (смоук), Python 3 — только
вспомогательно. Внешних зависимостей нет.

**Spec:** `docs/superpowers/specs/2026-09-18-statistika-volna-23-design.md`

## Global Constraints

- Ветка `worktree-discussion`; все команды — из корня worktree. В `main` — только по команде
  пользователя.
- Одна задача — один коммит; сообщение коммита — по-русски, как в истории репозитория
  («Статистика: волна 23 З-13 — …»), с концовкой `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Смоук зелёный целиком после каждой задачи: `node scripts/inspect/statistics-check.mjs` →
  код выхода 0, в выводе ни одного `FAIL`.
- Смоук при каждом прогоне переписывает шапку `statistics.html` своим результатом — шапка
  коммитится вместе с задачей.
- Новые сторожа — с `#235`, по возрастанию, без пропусков. Номера снятых сторожей
  (`#132`…`#136`, `#184`…`#192`) не переиспользуются; на их месте в смоуке — надгробие-комментарий
  со ссылкой на ADR (образец — надгробие `#229`…`#234` после волны 19).
- Сторож прежней модели переписывается на месте под своим номером; каждый такой случай
  записывается в раздел «Ход работы» в конце этого файла.
- Модель в `fizschema.md` и ADR не правится. Расхождение — находка в «Ход работы» (потом в журнал).
- Не трогать: ТЗ 19, `docs/tasks/p22-statistika-tasks.html`, `STATUS.md`, `statistics-fields.html`.
- Комментарии в коде макета — в стиле файла: по-русски, объясняют «почему», со ссылкой на
  ADR/ИС. Идентификаторы — латиницей, как в файле.
- Решения по ходу — `СС-154`…; новые дефекты — `СС-Д19`…; записываются в «Ход работы».

## Как устроены файлы

| Файл | Что в нём | Что меняет волна |
|---|---|---|
| `mockups/statistics/statistics.html` | разметка + `<script>` с движком: `REGISTRY` (стр. ~1657), `OBJECTS` (~2364), `WORLD` (~2603), `CORE` (~2997), реестр-доступ (~3647), близнецы (~3777), схема витрины `martAdd` (~3857), сборщик строки (~3888), прогон (~4124), `seed()` (~5018), валидатор (~7036), дверь `ST.addRecord` (~7372), `ST.addObject` (~7608), экран «Реестры» (~8922) | движок, реестр, мир, экраны |
| `scripts/inspect/statistics-check.mjs` | 228 проверок `ok(n, …)`, блоками по волнам; в конце — отчёт и запись в шапку HTML | новые блоки волны 23, переписанные и снятые сторожа, дата штампа `SMOKE 2026-09-18` |
| `mockups/statistics/ASUBK-statistika-fizschema.md` | схема: §1–§11 таблицы строк, §12 служебные | только чтение (смоук разбирает её) |

## Приёмы, общие для всех задач

**Прогон смоука.**
```bash
node scripts/inspect/statistics-check.mjs > "$SCRATCH/smoke.txt" 2>&1; echo "exit=$?"
grep -E "^\s+FAIL" "$SCRATCH/smoke.txt"
```
где `SCRATCH=/tmp/claude-1000/-home-azamat-projects-asubk-credit-module--claude-worktrees-discussion/bc4f17c1-b142-456d-9cef-cdd78f26d932/scratchpad`.

**Мутационная проверка** — во временной копии, не в репозитории. Смоук ищет HTML и схему по
относительному пути `../../mockups/statistics/…` от себя, поэтому копия повторяет дерево:
```bash
M="$SCRATCH/mut"; rm -rf "$M"; mkdir -p "$M/scripts/inspect" "$M/mockups/statistics"
cp scripts/inspect/statistics-check.mjs "$M/scripts/inspect/"
cp mockups/statistics/statistics.html mockups/statistics/ASUBK-statistika-fizschema.md "$M/mockups/statistics/"
# правка движка в копии (python3 -c "…replace…" или sed), затем:
node "$M/scripts/inspect/statistics-check.mjs" | grep -E "FAIL  #(235|236)"
```
Мутация засчитана, если падают именно названные сторожа. Каждая мутация и её результат
записываются в «Ход работы».

**Где вставлять новые проверки.** Новый блок волны 23 — перед строкой `/* ---- отчёт ---- */`,
в виде IIFE `(() => { ST.seed(); … })();`, как блоки выше. Шапка-комментарий файла получает
строку блока волны 23.

---

## Этап 1 — реестр ложится на схему

### Task 1: З-13 — сверка реестра со схемой

**Files:**
- Modify: `mockups/statistics/statistics.html` — новый раздел `РЕЛИЗ` перед `/* ======================= РЕЕСТР: ДОСТУП` (~3647); `F_COMMON` (~3720); `REGISTRY` (~1657–2338), `OBJECTS` (~2364–2519), `WORLD` (~2603…), `CUR_DIM` (~3796), `withSomTwins`/`twinFor`/`isSomRow` (~3800–3853, ~7442), `checkInd` денежное правило (~7163)
- Modify: `scripts/inspect/statistics-check.mjs` — разборщик `fizschema.md`, блок волны 23 (`#235`…`#239`), правка сторожей, ссылающихся на снятые или переименованные записи

**Interfaces:**
- Produces (движок): `ST.VTYPES` — словарь «вид значения → суффиксы колонок»; `ST.release()` →
  `{id, tables: {<objId>: {table, storage, cols: string[]}}}` (копия); `ST.physOf(recId)` →
  `string[]` — физические колонки записи; у записи реестра реквизиты `col` (основа имени) и
  `vtype` (вид значения), у уровня иерархии — те же `col`, `vtype`.
- Produces (смоук): `fizSchema()` → `{<stat_row_x>: {want, cols: string[], bad: string[], storage}}`.
- Consumes: ничего из других задач.

- [ ] **Step 1: Разборщик схемы в смоуке и сторож самого разборщика `#235`**

В `statistics-check.mjs` после объявления `cI` (стр. ~80) добавить:

```js
/* ---- физическая схема: колонки таблиц строк из fizschema.md (волна 23, ИС-53) ----
   Релиз макета сверяется с документом схемы, а не с собственной копией списка: список,
   переписанный в смоук, разошёлся бы со схемой ровно так же тихо, как макет. Запись в
   схеме сжатая — `i_{total,over}_{v,som}` и слоты `d_clsN_*`; раскрытие проверяется
   счётом: сумма колонок строки таблицы равна графе «шт.», заголовок раздела — сумме. */
const FIZ_MD = resolve(__dir, '../../mockups/statistics/ASUBK-statistika-fizschema.md');
function fizSchema(){
  const lines = readFileSync(FIZ_MD, 'utf8').split('\n');
  const brace = t => t.split(/(\{[^}]*\})/).reduce((acc, p) => {
    const opts = p.startsWith('{') ? p.slice(1, -1).split(',') : [p];
    return acc.flatMap(a => opts.map(o => a + o));
  }, ['']);
  const expand = cell => {
    const slot = cell.match(/`(\w+?)N_(\w+)` · `_(\w+)` · `_(\w+)`/);
    if (cell.includes('…') && slot) {
      const out = [];
      for (let i = 1; i <= 10; i++) for (const s of [slot[2], slot[3], slot[4]]) out.push(`${slot[1]}${i}_${s}`);
      return out;
    }
    return [...cell.matchAll(/`([^`]+)`/g)].flatMap(m => brace(m[1]));
  };
  const tables = {}; let cur = null, grp = false;
  for (const line of lines) {
    const h = line.match(/^## \d+\. `(stat_row_\w+)` — .+? · колонок: (\d+)$/);
    if (h) { cur = h[1]; tables[cur] = {want: +h[2], cols: [], bad: [], storage: null}; grp = false; continue; }
    if (line.startsWith('## ')) { cur = null; continue; }
    if (!cur) continue;
    const s = line.match(/^- \*\*Способ хранения:\*\* `(\w+)`/);
    if (s) { tables[cur].storage = s[1]; continue; }
    if (line.startsWith('### ')) { grp = true; continue; }
    if (grp && line.startsWith('| `')) {
      const c = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());
      const n = +c[1].replace(/[`*]/g, ''), cols = expand(c[0]);
      if (cols.length !== n) tables[cur].bad.push(c[0]);
      tables[cur].cols.push(...cols);
    }
  }
  return tables;
}
const FIZ = fizSchema();
```

Перед `/* ---- отчёт ---- */` открыть блок волны 23 и добавить первую проверку:

```js
/* ===== Волна 23 — макет и сторожа догоняют физическую схему (ИС-53…ИС-58, СС-Д18) ===== */
(() => {
  ST.seed();
  const names = Object.keys(FIZ);
  const total = names.reduce((s, t) => s + FIZ[t].cols.length, 0);
  const off = names.filter(t => FIZ[t].cols.length !== FIZ[t].want || FIZ[t].bad.length);
  const dups = names.filter(t => new Set(FIZ[t].cols).size !== FIZ[t].cols.length);
  const noStore = names.filter(t => !FIZ[t].storage);
  ok(235, names.length === 11 && total === 602 && !off.length && !dups.length && !noStore.length,
    `схема читается смоуком сама, а не переписана в него: таблиц ${names.length}, колонок ${total} (в схеме — 602), разделов с расхождением счёта ${off.length}${off.length ? ' (' + off.join(', ') + ')' : ''}, с повторами ${dups.length}, без способа хранения ${noStore.length}. Сжатая запись раскрывается и сверяется графой «шт.»: список, переписанный в смоук, разошёлся бы со схемой так же тихо, как макет (ИС-53, ADR-0237 §3)`);
})();
```

- [ ] **Step 2: Прогнать смоук — `#235` проходит, остальное зелёное**

Run: прогон смоука (см. «Приёмы»).
Expected: `exit=0`, `PASS  #235`, FAIL нет. Разборщик проверяется до того, как на него
опрётся сторож релиза.

- [ ] **Step 3: Написать падающие сторожа релиза `#236` и сопоставления `#237`**

В тот же блок волны 23, после `#235`:

```js
  /* #236 — релиз макета есть подмножество схемы: таблица названа как в схеме, способ
     хранения тот же, и ни одной колонки, которой схема не знает. */
  const R = ST.release ? ST.release() : {tables: {}};
  const relObjs = Object.keys(R.tables);
  const relBad = [];
  relObjs.forEach(o => {
    const t = R.tables[o], f = FIZ[t.table];
    if (!f) { relBad.push(o + ': таблицы ' + t.table + ' в схеме нет'); return; }
    if (f.storage !== t.storage) relBad.push(t.table + ': способ ' + t.storage + ' ≠ ' + f.storage);
    t.cols.filter(c => f.cols.indexOf(c) < 0).forEach(c => relBad.push(t.table + '.' + c));
  });
  const objsNoRel = ST.state.objects.filter(o => !R.tables[o.id]).map(o => o.id);
  ok(236, relObjs.length >= 10 && !relBad.length && !objsNoRel.length,
    `релиз макета — подмножество схемы: таблиц в релизе ${relObjs.length}, у каждого объекта своя (без таблицы ${objsNoRel.length}${objsNoRel.length ? ': ' + objsNoRel.join(', ') : ''}); колонок и способов хранения, которых схема не знает, ${relBad.length}${relBad.length ? ' — ' + relBad.slice(0, 6).join('; ') : ''}. Колонку заводит релиз, а не запись реестра (ИС-53, ADR-0237 §1–§3)`);

  /* #237 — каждая действующая запись ложится в колонки релиза своего объекта. Агрегату
     колонка не нужна — он считается при чтении (ADR-0237 §5). */
  const recs = ST.state.registry.filter(r => r.src !== 'агрегат' && !r.until);
  const unmapped = recs.filter(r => !ST.physOf(r.id).length).map(r => r.id);
  const outside = [];
  recs.forEach(r => {
    const t = R.tables[r.obj];
    ST.physOf(r.id).filter(c => !t || t.cols.indexOf(c) < 0).forEach(c => outside.push(r.id + '→' + c));
  });
  const aggWithCol = ST.state.registry.filter(r => r.src === 'агрегат' && r.col).map(r => r.id);
  ok(237, recs.length > 100 && !unmapped.length && !outside.length && !aggWithCol.length,
    `каждая из ${recs.length} действующих записей реестра лежит в колонках релиза своего объекта: без колонки ${unmapped.length}${unmapped.length ? ' (' + unmapped.slice(0, 8).join(', ') + ')' : ''}, с колонкой вне релиза ${outside.length}${outside.length ? ' (' + outside.slice(0, 6).join(', ') + ')' : ''}. У агрегатов колонки нет ни одной (${aggWithCol.length}) — агрегат считается при чтении и релиза не стоит (ИС-53, ADR-0237 §3, §5)`);
```

- [ ] **Step 4: Прогнать смоук — `#236` и `#237` падают**

Expected: `FAIL  #236` (`ST.release` нет — таблиц 0), `FAIL  #237` (`ST.physOf` нет — ошибка
выполнения ловится как FAIL; если смоук падает исключением, обернуть `#237` в
`typeof ST.physOf === 'function' &&`).

- [ ] **Step 5: Движок — вид значения, релиз, `physOf`**

В `statistics.html` перед `/* ======================= РЕЕСТР: ДОСТУП` вставить:

```js
/* ================= РЕЛИЗ: ТАБЛИЦЫ СТРОК И ИХ КОЛОНКИ (ИС-53, ADR-0237) ================= *
   Колонку в таблице строк заводит МИГРАЦИЯ РЕЛИЗА, а запись реестра только ссылается на
   неё по имени (ADR-0237 §2, §3). До волны 23 было наоборот: запись реестра порождала
   колонку витрины (`ADD COLUMN`, ADR-0209 §6), и шестой объект стоил одной строки данных
   (ИС-18). Физической формы у этого обещания не нашлось — ни `jsonb`, ни DDL из
   приложения, ни запас безымянных колонок (ADR-0237, «Контекст»). Здесь релиз объявлен
   ДАННЫМИ: таблица на объект, способ хранения и колонки — подмножество схемы
   `ASUBK-statistika-fizschema.md`; смоук сверяет его с ней (#236).
   Вид значения задаёт суффиксы колонок так же, как `stat_registry.value_type` в схеме
   (§12.1): одна запись — одна основа имени, а колонок у неё одна, две или три. */
const VTYPES = {
  ref:['_id','_lbl'], ref_arr:['_ids','_lbls'], code:[''], cls:['_code','_lbl','_ord'],
  date:[''], int:[''], num:[''], bool:[''], money_cur:['_v','_som'], money_som:['_som'], cur:['']
};
/* Служебные колонки таблицы — по §0.4 схемы; у объекта они свои (соседи у всех разные). */
const RELEASE = {id:'макет · волна 23', tables:{
  'obj-credit':     {table:'stat_row_credit',     storage:'state',       cols:[/* заполняется в Step 6 */]},
  'obj-borrower':   {table:'stat_row_borrower',   storage:'state',       cols:[]},
  'obj-collateral': {table:'stat_row_collateral', storage:'state',       cols:[]},
  'obj-zdeal':      {table:'stat_row_zdeal',      storage:'state',       cols:[]},
  'obj-case':       {table:'stat_row_case',       storage:'state',       cols:[]},
  'obj-claim':      {table:'stat_row_claim',      storage:'state',       cols:[]},
  'obj-program':    {table:'stat_row_program',    storage:'state',       cols:[]},
  'obj-repay':      {table:'stat_row_repay',      storage:'event_delta', cols:[]},
  'obj-receipt':    {table:'stat_row_receipt',    storage:'event_delta', cols:[]},
  'obj-measure':    {table:'stat_row_measure',    storage:'event_full',  cols:[]}
}};
/* Физические колонки записи. Валютная сторона пары — `_v`, её сомовый близнец — `_som`:
   у них одна основа имени, потому что величина одна (ADR-0242 §1, ADR-0214 §2). Итог
   (`money_som`) валютной стороны не имеет вовсе (ADR-0240 §4). У иерархии колонки — у
   уровней: каждый уровень есть своя пара колонок (ADR-0241 §4). */
function physOf(r){
  if(!r || r.src === 'агрегат') return [];
  if(r.levels) return [].concat(...r.levels.map(L => physOf(L)));
  const sfx = VTYPES[r.vtype];
  if(!r.col || !sfx) return [];
  if(r.vtype === 'money_cur') return [r.col + (r.somOf ? '_som' : '_v')];
  return sfx.map(s => r.col + s);
}
ST.VTYPES = clone(VTYPES);
ST.release = () => clone(RELEASE);
ST.physOf = id => physOf(REC(id));
```

`clone` и `REC` объявлены ниже (раздел «РЕЕСТР: ДОСТУП») — вызовы идут после загрузки, так
что порядок объявления функций-стрелок безопасен только если `ST.physOf` не зовётся при
сборке. Если `seed()` понадобится `physOf` раньше — перенести раздел `РЕЛИЗ` сразу после
`/* ======================= РЕЕСТР: ДОСТУП` и объявления `clone`.

В `F_COMMON` (стр. ~3720) добавить `'col','vtype'`:

```js
const F_COMMON = ['id','kind','name','obj','since','until','note','access','grp','dates','history','col','vtype'];
```

В `somTwinOf` ничего не менять: близнец — `clone(r)` и наследует `col`, `vtype`.

- [ ] **Step 6: Сопоставить записи объекта «Кредит» и заполнить его релиз**

Порядок для каждого объекта (Step 6–15 — по одному объекту на шаг, после каждого — прогон
смоука, чтобы ошибка не копилась):

1. Открыть раздел схемы объекта (`## N. stat_row_…`).
2. Каждой записи объекта с источником «поле», «шов», «история» проставить `col` и `vtype` по
   смыслу колонки схемы. Правила вида: ссылка на запись справочника или соседа → `ref`;
   закрытый словарь (`text CHECK`) → `code`; значение классификатора → `cls`; дата → `date`;
   число, дни → `int`; ставка, порог → `num`; признак → `bool`; сумма в валюте → `money_cur`;
   итог только в сомах → `money_som`; валюта → `cur`. Уровням иерархии — свои `col`/`vtype`.
3. Колонки, на которые легли записи, плюс служебные колонки раздела (`object_id`,
   `slice_date`, `run_id`, `src_*`, `src_detail`, `is_partial`, `now_cols`, а у денег —
   `cur`, `rate`, `rate_date`) внести в `RELEASE.tables[<obj>].cols`.
4. Запись, которой в схеме соответствия нет, — снять (удалить из `REGISTRY` и из состава
   `OBJECTS`, с комментарием-надгробием на месте: «снято волной 23: …, ADR-…») либо, если
   схема явно ошибается, записать находку в «Ход работы» и оставить запись с `col`,
   указывающим колонку схемы-кандидата. По умолчанию — снимать, как требует спецификация.

Для кредита (§1 схемы) записи ложатся так (образец для остальных объектов):

```js
  {kind:'разрез', id:'d-curator', obj:'obj-credit', name:'Куратор кредита', src:'история', key:'curator', since:'2020-01-01',
   col:'d_curator', vtype:'ref'},
  {kind:'разрез', id:'d-category', obj:'obj-credit', name:'Категория риска', src:'шов', seam:'riskCategory', field:'category',
   since:'2020-01-01', col:'d_risk', vtype:'cls', note:'шов классификации (ADR-0124); статистика её не выводит'},
  {kind:'разрез', id:'d-industry', obj:'obj-credit', name:'Отрасль кредита', src:'поле', key:'industry', since:'2020-01-01',
   col:'d_industry', vtype:'ref'},
  {kind:'разрез', id:'d-status', obj:'obj-credit', name:'Статус', src:'история', key:'status', since:'2020-01-01',
   col:'d_status', vtype:'code'},
  {kind:'разрез', id:'d-cdate', obj:'obj-credit', name:'Дата кредитного договора', src:'поле', key:'cdate', since:'2020-01-01',
   buckets:['год','квартал','месяц'], owner:'Кредиты', note:'ТЗ #3', col:'d_cdate', vtype:'date'},
  {kind:'показатель', id:'m-debt', /* … прежние реквизиты … */ col:'i_od', vtype:'money_cur'},
  {kind:'показатель', id:'m-odays', /* … */ col:'i_over_days', vtype:'int'},
```

Иерархии кредита:

```js
  {kind:'разрез', id:'d-branch', obj:'obj-credit', name:'Подразделение выдачи кредита', src:'история', key:'branch', since:'2020-01-01',
   owner:'Оргструктура (кадры)', ref:'org',
   levels:[{name:'блок', src:'справочник', col:'d_unit_parent', vtype:'ref'},
           {name:'подразделение', src:'история', key:'branch', col:'d_unit', vtype:'ref'}]},
  {kind:'разрез', id:'d-region', obj:'obj-credit', name:'Территория выдачи кредита', src:'поле', key:'region', since:'2020-01-01',
   owner:'Справочник административного деления',
   levels:[{name:'область', src:'поле', key:'region', col:'d_terr_region', vtype:'ref'},
           {name:'район', src:'поле', key:'district', col:'d_terr_district', vtype:'ref'}], note:'…как было…'},
```

Точное имя колонки каждой записи берётся из §1 схемы (например, «Дней просрочки» —
`i_over_days` или как названо там; не угадывать — искать строку схемы по смыслу и источнику:
`python3 scripts/find.py` не нужен, достаточно `grep -n "<слово>" mockups/statistics/ASUBK-statistika-fizschema.md`).

Новые записи кредита по `СС-Д18`:

```js
  {kind:'разрез', id:'d-kind', obj:'obj-credit', name:'Вид кредита', src:'поле', key:'kind', since:'2020-01-01',
   owner:'Кредиты', col:'d_kind', vtype:'ref', note:'ТЗ #12 — вид кредита свой у кредита, а не только условие программы (СС-Д18, волна 23)'},
  {kind:'разрез', id:'d-decision', obj:'obj-credit', name:'Основание выдачи', src:'поле', key:'decision', since:'2020-01-01',
   owner:'Кредиты', col:'d_decision', vtype:'ref', note:'ТЗ #13 — решение правительства, по которому выдан кредит (СС-Д18, волна 23)'},
```

Обе добавить в `OBJECTS['obj-credit'].dims`; в `WORLD['obj-credit']` каждому кредиту — поля
`kind` и `decision` (значения — виды и решения из `WORLD['obj-program']` его программы, чтобы
срез «по виду» кредитов сходился с условиями программ).

Факторы риска п. 11 — у кредита, признаками (`bool`), только засчитанные комитетом
(`СС-140`). Записи заёмщика `m-bevade`, `m-bnodocs`, `m-bnomon` снять; у кредита завести
записи для тех факторов, которые они изображали (`d_rf_evade` — уклонение от акта сверки или
документов; `d_rf_nomon` — воспрепятствование мониторингу), источник «история» по новому
ключу `WORLD` (`h.rfEvade`, `h.rfNomon`), значения — перенести с заёмщиков на их кредиты.

Run: прогон смоука.
Expected: `#237` называет среди «без колонки» только записи объектов, ещё не сопоставленных;
сторожа, ссылающиеся на снятые записи, падают — переписать каждый (см. Step 16).

- [ ] **Step 7: «Заёмщик» (§2)** — сопоставить по тому же порядку. Снять: `m-blimit` и
  `a-sumblimit` (лимита нет, `ADR-0244` §4); `d-bstatus` заменить записью `d-sstate`
  «Состояние субъекта» (`col:'d_sstate', vtype:'code'`, значения — как в схеме §2.2, источник
  «история» по ключу `sstate` в `WORLD`); валютные стороны итогов — см. Step 16a.
- [ ] **Step 8: «Залог» (§4)** — снять `d-ccur` («Валюта оценки»); у `d-collkind` снять уровень
  «класс ликвидности» (разрез становится одноуровневым `ref` по виду; группы видов — слоты
  классификаторов, `ADR-0241` §5 — вне этой задачи); денежные — `money_som`.
- [ ] **Step 9: «Залоговый договор» (§5).**
- [ ] **Step 10: «Дело взыскания» (§6)** — снять `d-obranch`, `d-ocurator`, `d-oregion`,
  `d-ocur` (`ADR-0243`, `ADR-0244` §4); денежные — `money_som`. Охват дела станет правилом
  `via` только в З-19: до неё у дела `scope` ссылается на снятый разрез — временно объявить
  `scope:{open:'охват дела — правилом через требования (волна 23, З-19); до неё дело общее'}`
  и записать это в «Ход работы».
- [ ] **Step 11: «Требование» (§7).**
- [ ] **Step 12: «Кредитная программа» (§8).**
- [ ] **Step 13: «Платёж» (§9).**
- [ ] **Step 14: «Поступление» (§10).**
- [ ] **Step 15: «Мера взыскания» (§11).**

- [ ] **Step 16a: Итог — одна сомовая запись без близнеца**

У объектов, чьи денежные записи схема держит только в сомах (заёмщик, залог, дело, договор),
запись с `vtype:'money_som'` — сама сомовая величина. Правки движка:

```js
/* Близнец нужен ТОЛЬКО величине, возникшей в валюте (ADR-0240 §2). Итог — портфель
   заёмщика, оценка залога, итоги дела — валютной стороны не имеет вовсе: сложить его
   можно только в сомах, и сомовая запись здесь единственная (ADR-0240 §4, ИС-56). */
const isSomRow = r => !!r && r.kind === KIND.IND && r.src !== 'агрегат' && !!r.money &&
  !r.somOf && r.vtype !== 'money_som';
```

В `withSomTwins`/`twinFor` условие агрегата уже идёт через `isSomRow(over)` — агрегат над
итогом близнеца не получит. Итоговой записи проставить `unit:'сом'`, `roll:'аддитивный'`.

В `checkInd` денежное правило (стр. ~7163) пропускает итог:

```js
  if(spec.money && !spec.somOf && spec.vtype !== 'money_som' && spec.src !== 'агрегат' && spec.roll !== 'формульный'){
```

`CUR_DIM` (стр. ~3796): убрать ключи объектов, у которых разрез валюты снят (`obj-case`,
`obj-collateral`), и тех, у кого денежных записей в валюте не осталось.

- [ ] **Step 16: Переписать сторожей, ссылающихся на снятое и переименованное**

Run: прогон смоука; для каждого `FAIL` (кроме `#236`/`#237`, если ещё не зелёные):
- сторож проверял свойство, которое модель сохранила, а упал из-за снятого id → заменить id
  на действующую запись того же смысла, номер тот же;
- сторож проверял снятое как свойство модели (например, валюту оценки или лимит) → снять,
  номер не переиспользовать, на месте — надгробие:

```js
  /* #NNN — снят волной 23 (З-13): «…что проверял…» больше не часть модели — ADR-0244 §4 /
     ADR-0240 §4. Номер не переиспользуется. */
```

Каждый случай — строка в «Ход работы».

- [ ] **Step 17: Сторож снятого и добавленного `#238` и итогов в сомах `#239`**

```js
  /* #238 — снятое снято, добавленное добавлено (СС-Д18, ADR-0244 §4). */
  const gone = ['d-ccur','m-blimit','a-sumblimit','d-bstatus','m-bevade','m-bnodocs','m-bnomon',
                'd-obranch','d-ocurator','d-oregion','d-ocur'];
  const still = gone.filter(id => ST.REC(id));
  const born = ['d-kind','d-decision','d-sstate','d-rf-evade','d-rf-nomon'];
  const missing = born.filter(id => !ST.REC(id) || !ST.physOf(id).length);
  const liqLevel = (ST.REC('d-collkind') || {levels: []}).levels || [];
  ok(238, !still.length && !missing.length && !liqLevel.some(L => /ликвидн/i.test(L.name)) &&
        ST.REC('d-kind').obj === 'obj-credit' && ST.REC('d-rf-evade').obj === 'obj-credit',
    `снятое снято поимённо (осталось ${still.length}${still.length ? ': ' + still.join(', ') : ''}): «валюта оценки», лимит задолженности, статус «Активный», три фактора у заёмщика, подразделение, куратор, территория и валюта дела. Добавлено (не хватает ${missing.length}${missing.length ? ': ' + missing.join(', ') : ''}): вид кредита и основание выдачи — у самого кредита (ТЗ #12, #13), факторы риска — у кредита признаками, состояние субъекта — у заёмщика. Класс ликвидности уровнем вида не стоит (ADR-0244 §4, ADR-0243, СС-140, СС-141)`);

  /* #239 — итог только в сомах и без близнеца (ADR-0240 §4). */
  const totals = ST.state.registry.filter(r => r.money && r.src !== 'агрегат' &&
    ['obj-borrower','obj-collateral','obj-case','obj-zdeal'].indexOf(r.obj) >= 0);
  const notSom = totals.filter(r => r.vtype !== 'money_som' || r.somOf).map(r => r.id);
  const twinned = totals.filter(r => ST.REC(r.id + ST.SOM_SUFFIX)).map(r => r.id);
  ok(239, totals.length >= 8 && !notSom.length && !twinned.length &&
        totals.every(r => ST.unitOf(r.id) === 'сом'),
    `итоги заёмщика, залога, дела и договора — только в сомах: денежных записей ${totals.length}, не сомовых ${notSom.length}${notSom.length ? ' (' + notSom.join(', ') + ')' : ''}, с валютным близнецом ${twinned.length}. Состав по валютам без jsonb не хранится и не складывается, а вопрос «сколько у заёмщика в долларах» точнее отвечают строки его кредитов (ИС-56, ADR-0240 §4, §5)`);
```

Run: прогон смоука.
Expected: `exit=0`, `#235`…`#239` PASS, FAIL нет.

- [ ] **Step 18: Мутации**

В копии (см. «Приёмы»), по одной:
1. У `d-industry` удалить `col` → должен упасть `#237`.
2. В `RELEASE.tables['obj-credit'].cols` добавить `'d_nonexistent'` → `#236`.
3. У `obj-repay` поставить `storage:'state'` → `#236`.
4. Вернуть запись `m-blimit` в `REGISTRY` → `#238` (и `#237`, если без колонки).
5. В `isSomRow` убрать условие `r.vtype !== 'money_som'` → `#239`.

Каждый результат — в «Ход работы».

- [ ] **Step 19: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs docs/superpowers/plans/2026-09-18-statistika-volna-23.md
git commit -m "$(cat <<'EOF'
Статистика: волна 23 З-13 — реестр ложится на физическую схему

Макет объявляет релиз (таблица, способ хранения, колонки — подмножество
fizschema), у каждой записи — основа имени и вид значения. Снято, чего
схема не знает; итоги — одной сомовой записью. Сторожа #235…#239.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: З-14 — механизм релиза (`ИС-53`)

**Files:**
- Modify: `mockups/statistics/statistics.html` — `seed()` (~5018–5094), схема витрины (~3857–3883: `martAdd`, `st.mart`, `st.martLog`, `ST.martCol`, `ST.mart`, `ST.martLog`), `ST.addRecord` (~7372), `ST.changeKind` (~7482), `ST.retire` (~7530), `ST.addObject` (~7608), экран «Реестры» (~8922–9300)
- Modify: `scripts/inspect/statistics-check.mjs` — блок волны 23 (`#240`…`#244`); сторожа, опирающиеся на `ST.mart*` (`#163` и соседние в блоке АВ, `#170`, `#180`-ые у близнецов, `#188`, проверки `obj-guarantee` в блоках волн 1, 12, 13, 17)

**Interfaces:**
- Consumes: `RELEASE`, `physOf`, `ST.release()`, `ST.physOf(id)` из Task 1.
- Produces: `ST.awaiting()` → `[{id, name, obj, cols: string[]}]` — записи «ждёт колонку»;
  `ST.orphanCols()` → `[{obj, table, col}]` — колонки релиза без записи (служебные не
  считаются); `ST.colOf(id)` → `{table, cols, state: 'включена' | 'ждёт колонку' | 'агрегат'}`;
  `ST.addRecord(spec)` → дополнительно `waiting: true` у записи, ушедшей в «ждёт колонку».
  Снимаются: `ST.mart`, `ST.martLog`, `ST.martCol`, `st.mart`, `st.martLog`, `martAdd`.

- [ ] **Step 1: Падающие сторожа `#240`…`#244`**

```js
  /* #240 — сверка при старте: запись без колонки не включается, колонка без записи
     предупреждает (ADR-0237 §3). */
  ST.seed();
  const aw0 = ST.awaiting ? ST.awaiting() : null, or0 = ST.orphanCols ? ST.orphanCols() : null;
  ok(240, Array.isArray(aw0) && aw0.length === 0 && Array.isArray(or0) &&
        or0.every(c => !/^(object_id|slice_date|run_id|src_|is_partial|now_cols|cur$|rate)/.test(c.col)) &&
        ST.state.log.concat(ST.state.relLog || []).some(l => /колонка без записи/.test(l.msg || '')) === (or0.length > 0),
    `сверка реестра с релизом идёт при старте: ждут колонку ${aw0 ? aw0.length : '—'}, колонок без записи ${or0 ? or0.length : '—'} — служебные в этот счёт не входят, и каждая такая колонка названа предупреждением в журнале. Колонка без записи — поле у соседа, выведенное релизом, но ещё не названное в реестре (ADR-0237 §3)`);

  /* #241 — дверь без релиза: разрез-поле с колонкой, которой в релизе нет, заводится в
     «ждёт колонку» и в состав объекта не входит; с колонкой, что в релизе есть, — включается. */
  ST.seed();
  const w = ST.addRecord({kind:'разрез', id:'d-w23a', name:'Признак ожидания', obj:'obj-credit', src:'поле', key:'w23',
    perObject:'одно', dates:1, col:'d_w23_missing', vtype:'bool'});
  const inObj = ST.OBJ('obj-credit').dims.indexOf('d-w23a') >= 0;
  const awaitW = (ST.awaiting() || []).some(a => a.id === 'd-w23a');
  const orphan = (ST.orphanCols() || []).find(c => c.obj === 'obj-credit');
  const g = orphan ? ST.addRecord({kind:'разрез', id:'d-w23b', name:'Признак из релиза', obj:'obj-credit', src:'поле',
    key:'w23b', perObject:'одно', dates:1, col: orphan.col.replace(/_(id|lbl|code|ord|v|som)$/, ''),
    vtype: /_(id|lbl)$/.test(orphan.col) ? 'ref' : 'bool'}) : {ok:false};
  ok(241, w.ok && w.waiting === true && !inObj && awaitW && g.ok && !g.waiting &&
        ST.OBJ('obj-credit').dims.indexOf('d-w23b') >= 0,
    `без релиза запись о новой колонке не пропадает и не включается: «Признак ожидания» заведён (${w.ok}), стоит в «ждёт колонку» (${awaitW}) и в состав кредита не вошёл (${inObj}). Запись о колонке, которую релиз уже завёл${orphan ? ' (' + orphan.col + ')' : ''}, включается сразу (${g.ok && !g.waiting}) — это и есть единственный случай, где колонка без релиза не нужна (ADR-0237, «Контекст», §5)`);

  /* #242 — агрегат релиза не требует (ADR-0237 §5). */
  ST.seed();
  const a = ST.addRecord({kind:'показатель', id:'a-w23', name:'Наибольший остаток ОД', obj:'obj-credit', src:'агрегат',
    fn:'max', over:'m-debt-som', dates:1});
  ok(242, a.ok && !a.waiting && ST.OBJ('obj-credit').inds.indexOf('a-w23') >= 0 && ST.physOf('a-w23').length === 0,
    `агрегат заводится без релиза и включается сразу (${a.ok && !a.waiting}), колонок у него нет (${ST.physOf('a-w23').length}): он считается при чтении (ADR-0237 §5)`);

  /* #243 — новый объект стоит релиза (ИС-53 вместо ИС-18). */
  ST.seed();
  const obj = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства', owner:'Залог',
    born:{src:'поле', key:'gdate'}, scope:{open:'—'}, dims:[], inds:['a-count']});
  ok(243, !obj.ok && has(obj.why, 'релиз') && has(obj.why, 'ИС-53') && !ST.OBJ('obj-guarantee'),
    `новый объект без таблицы в релизе не заводится: «${String(obj.why).slice(0, 110)}…». Шестой объект больше не стоит одной строки данных — он стоит миграции: таблицы строк, сущности Jmix и записи реестра (ИС-53, ADR-0237 §5, снят ИС-18)`);

  /* #244 — схемы, порождаемой реестром, больше нет (ADR-0237, переписан ADR-0209 §6). */
  ST.seed();
  ok(244, ST.mart === undefined && ST.martLog === undefined && ST.martCol === undefined &&
        !('mart' in ST.state) && !('martLog' in ST.state) && !/ADD COLUMN/.test(JSON.stringify(ST.state.log)),
    `витрина, растущая от записи реестра (ADD COLUMN), снята целиком: дверей ST.mart/martLog/martCol нет, в состоянии нет ни схемы, ни её журнала, в журнале нет ни одного ADD COLUMN. Журнал колонок ведёт Liquibase, своей таблицы DDL у статистики нет (ADR-0237 §6)`);
```

- [ ] **Step 2: Прогнать — `#240`…`#244` падают.**

- [ ] **Step 3: Движок — сверка при старте**

Снять раздел «СХЕМА ВИТРИНЫ ПОРОЖДЕНА РЕЕСТРОМ» (`colType`, `martAdd`, `ST.martCol`,
`ST.mart`, `ST.martLog`) — на месте надгробие со ссылкой на `ADR-0237`. Вместо него:

```js
/* ============ СВЕРКА РЕЕСТРА С РЕЛИЗОМ ПРИ СТАРТЕ (ИС-53, ADR-0237 §3) ============ *
   Реестр — каталог СУЩЕСТВУЮЩИХ колонок. Запись, чьих колонок в релизе нет, не
   включается: в прогон, состав объекта и вопросы она не входит и стоит списком «ждёт
   колонку» у администратора. Колонка релиза без записи — предупреждение в журнал: поле
   у соседа выведено, а в статистике не названо. Служебные колонки в сверку не входят —
   записей реестра у них не бывает. */
const SERVICE_COL = /^(object_id|group_id|member_id|target_id|slice_date|run_id|src_\w+|is_partial|now_cols|cur|rate|rate_date|d_corr_kind|d_corr_date)$/;
function reconcile(st){
  st.awaiting = [];
  st.registry.forEach(r => {
    if(r.src === 'агрегат' || r.until) return;
    const t = RELEASE.tables[r.obj], cols = physOf(r);
    if(t && cols.length && cols.every(c => t.cols.indexOf(c) >= 0)) return;
    st.awaiting.push(r.id);
    st.objects.forEach(o => {
      let i = o.dims.indexOf(r.id); if(i >= 0) o.dims.splice(i, 1);
      i = o.inds.indexOf(r.id); if(i >= 0) o.inds.splice(i, 1);
    });
  });
  const used = {};
  st.registry.forEach(r => physOf(r).forEach(c => { used[r.obj + '|' + c] = true; }));
  st.orphanCols = [];
  Object.keys(RELEASE.tables).forEach(obj => {
    const t = RELEASE.tables[obj];
    t.cols.forEach(c => {
      if(SERVICE_COL.test(c) || used[obj + '|' + c]) return;
      st.orphanCols.push({obj, table: t.table, col: c});
      st.relLog.push({at: st.today, msg: 'колонка без записи: '+t.table+'.'+c+
        ' — выведена релизом, в реестре не названа (ADR-0237 §3)'});
    });
  });
}
ST.awaiting = () => ST.state.awaiting.map(id => { const r = REC(id);
  return {id, name: r.name, obj: r.obj, cols: physOf(r)}; });
ST.orphanCols = () => clone(ST.state.orphanCols);
ST.colOf = id => { const r = REC(id); if(!r) return null;
  if(r.src === 'агрегат') return {table: null, cols: [], state:'агрегат'};
  return {table: (RELEASE.tables[r.obj] || {}).table || null, cols: physOf(r),
          state: ST.state.awaiting.indexOf(id) >= 0 ? 'ждёт колонку' : 'включена'}; };
```

В `seed()`: из объекта `st` убрать `mart: [], martLog: []`, добавить `relLog: []`,
`awaiting: []`, `orphanCols: []`; строку `st.registry.forEach(r => martAdd(…))` заменить на
`reconcile(st);`. Журнал `st.log` в конце `seed()` обнуляется (`st.log = []`) — поэтому
предупреждения живут в `st.relLog`, а не в `st.log`.

- [ ] **Step 4: Дверь `ST.addRecord`, `ST.changeKind`, `ST.retire`, `ST.addObject`**

`ST.addRecord`: после `normRec(rec)` и проверки близнеца — вместо `martAdd` решать по
релизу:

```js
  const t = RELEASE.tables[rec.obj], cols = physOf(rec);
  const waiting = rec.src !== 'агрегат' && !(t && cols.length && cols.every(c => t.cols.indexOf(c) >= 0));
  rec.history = [{at: rec.since, what: waiting ? 'заведена, ждёт колонку' : 'заведена', kind: rec.kind, who: st.role}];
  st.registry.push(rec);
  if(waiting){
    st.awaiting.push(rec.id);
    log('заведена запись реестра «'+rec.name+'» — ждёт колонку: '+(cols.join(', ') || 'не названа')+
      ' в '+((t && t.table) || 'таблице объекта')+' нет. Колонку заводит релиз (ADR-0237 §2, §3)');
    return {ok:true, id: rec.id, kind: rec.kind, since: rec.since, waiting: true, cols};
  }
```

Дальше — прежний путь (состав объекта, `queueRegChange`, близнец), без `martAdd` и без
упоминаний `ADD COLUMN` в журнале. У близнеца колонка — `physOf(twin)`, он включается вместе
с валютной.

Валидатор: для неагрегатной записи `col` и `vtype` обязательны — в `validate` перед
`return kind === KIND.IND ? checkInd…`:

```js
  if(spec.src !== 'агрегат'){
    if(!spec.col) return 'у записи не названа колонка: реестр — каталог колонок релиза, и запись '+
      'ссылается на колонку по имени (ИС-53, ADR-0237 §3)';
    if(!VTYPES[spec.vtype] && !spec.levels) return 'вид значения «'+spec.vtype+'» вне списка: '+
      Object.keys(VTYPES).join(' · ')+' — из него выводятся суффиксы колонок (ADR-0237 §3, схема §12.1)';
  }
```

`ST.changeKind` и `ST.retire`: строки про схему витрины в комментариях и журнале заменить на
«колонка остаётся — её не удаляют никогда (ADR-0237 §4)»; поведение не меняется.

`ST.addObject`: первой проверкой после прав —

```js
  if(!RELEASE.tables[spec.id]) return {ok:false, why:'у объекта «'+(spec.name || spec.id)+
    '» нет таблицы строк в релизе: новый объект — это миграция (таблица stat_row_…, сущность '+
    'Jmix, записи реестра), а не строка данных (ИС-53, ADR-0237 §5; снят ИС-18)'};
```

Комментарии над `OBJECTS` и `ST.addObject`, утверждающие «шестой объект — строка реестра, а
не релиз (ИС-18)», переписать под `ИС-53`.

- [ ] **Step 5: Экран «Реестры»** — в панель реестров (~9249, рядом с кнопкой «Завести
  запись») добавить два списка: «Ждут колонку» (`ST.awaiting()`: имя, объект, колонки) и
  «Колонки без записи» (`ST.orphanCols()`: таблица.колонка). У записи в таблице реестра —
  столбец «колонка» (`ST.colOf(id).cols.join(', ')` и состояние). Прежний показ схемы витрины
  (`ST.mart()`) снять.

- [ ] **Step 6: Прогнать — `#240`…`#244` зелёные; переписать упавших**

Ожидаемо падают сторожа, опиравшиеся на `ST.mart*` и на `addObject('obj-guarantee')` без
релиза. Правило Step 16 из Task 1: смысл сохранился — переписать под свой номер (например,
`#163` «схема порождена реестром» → «колонки записей сверены с релизом, записей без колонки
0» с `ST.colOf`); смысл снят `ADR-0237` — надгробие. Проверки, заводившие `obj-guarantee`
для других целей (охват, рождение объекта, чужой разрез), — дать объекту таблицу в
`RELEASE` нельзя (поручительство снято `ADR-0244` §4); вместо этого проверять те же отказы
на отказе раньше релизной проверки либо переставить проверку релиза в `ST.addObject` после
проверок `born`/`dims`/`inds`, если сторож именно про их порядок. Решение по каждому — в
«Ход работы».

- [ ] **Step 7: Мутации**
1. В `reconcile` убрать вычёркивание из состава объекта → `#241` (или `#240`).
2. В `ST.addRecord` включать запись без проверки релиза → `#241`.
3. Вернуть в `ST.addObject` приём без таблицы → `#243`.
4. Вернуть `ST.mart = () => []` → `#244`.

- [ ] **Step 8: Коммит** — `Статистика: волна 23 З-14 — колонку заводит релиз, реестр ссылается на неё`.

### ⏸ Остановка 1

Показать пользователю: что снято (поимённо), что добавлено, находки схеме, переписанные и
снятые сторожа, счёт смоука. Ждать «дальше». Здесь же — детализировать кодом задачи этапа 2
в этом файле (раздел ниже заменяется пошаговым), опираясь на состояние движка после З-14.

---

## Этап 2 — хранение

Этап расписан на остановке 1 по движку после З-14 (`641fb9f`, смоук 246/246). Спецификация
задаёт две задачи — З-15 и З-16; здесь они разбиты на пять коммитов (`СС-163`), у каждого свои
сторожа, мутации и зелёный смоук. Новые сторожа — подряд с `#253`. Решения проектирования
(`СС-161`…`СС-178`) собраны первыми: шаги на них ссылаются. Номера строк — по `641fb9f`; после
каждой задачи они съезжают, поэтому место правки ищется по имени функции
(`grep -n "function doRun" mockups/statistics/statistics.html`), а номер — только подсказка.

Порядок задач этапа: **З-15a → З-15b → З-15c → З-16a → З-16b**. Каждая следующая опирается на
предыдущую, переставлять их нельзя.

### Решения этапа 2

**СС-161 — канун.** Строка с датой D — состояние на начало дня D, то есть мир на конец D−1
(`ADR-0238` §2). На канун читают только двери МИРА у сборщика строки: история в `readSrc`, шов
в `askSeam` (оба вызова `CORE.read`), курс поля в `readIndRaw`, окно курса в `movedCurs`.
Рождение сравнивается строго: объект, родившийся в день X, живёт со среза X+1 (`eachAlive`,
`candidatesOf`, `queueRegChange`, `ST.registryList`, экран ~9237). Все остальные даты в движке —
даты срезов. Живая дверь `CORE.objectRows(at)` отвечает «сейчас» и кануна не знает. `since`
записи реестра сравнивается с датой среза, как прежде.
*Почему:* одна точка пересчёта даты у дверей мира. Размажь канун по вызывающим — и строка 01.07
была бы июньской у защёлки и июльской у чтения.

**СС-162 — календарь демо-мира сдвинут на +1 день, числа мира — нет.**
- Прогоны сида: 06-01, 07-01, 08-01, 08-11, 08-19; пропуск 08-20 (записан 08-21); прогон 08-21.
- `today` — 08-22; ключи `LEGACY.totals` +1 день (2025-01-01…2026-04-01).
- Поток по умолчанию — `{from:'2026-07-16', to:'2026-08-19'}`; литералы дат-срезов в экранах +1.
- Даты ДЕЙСТВИЙ не меняются: закрытия, `corrections.at`, `LEGACY.at`, `refs.at`, тексты распоряжений.

*Почему:* те же факты мира ложатся в те же строки, и числа почти всех сторожей сохраняются.
Меняются только даты, которыми сторожа спрашивают.

**СС-163 — разбиение.** З-15 → З-15a (канун и период, механический сдвиг календаря) · З-15b
(строка каждый день, копия, догон, кэш сида) · З-15c (закрытие в две фазы, «не хранится»,
поток, повторное открытие, паспорт). З-16 → З-16a (адрес `part`, путь события-дельты, запрет
записи) · З-16b (мера × цель, чтение события на дату, поток событием).
*Почему:* перенумерация дат задевает ~80 сторожей и отделена от смены поведения. Иначе упавший
сторож нельзя было бы отнести ни к сдвигу, ни к модели. Каждый коммит объясним одной фразой.

**СС-164 — словарь счётчиков.** В `newTally`/`partOf` добавлены `copied` и `written`.
- У состояния `written = n + same + copied`; `n + same + copied + kept` = живых; `skip = 0`.
- `same` у состояния значит «строка на дату написана заново, значения прежние». Строка при
  этом есть: копии нет, пересчёт был.
- `skip` — только у событий: они пишутся при изменении до З-16 (`СС-167`) и дельтой после.
- `new_rows`/`corr_rows`/`markers` и сверка счётчиков с `failed` — З-22, здесь не заводятся.

*Почему:* «не менялось» больше не выводится из отсутствия строки (`ИС-45` снят). Счёт обязан
отличать копию от пересчёта: это разная работа ночи.

**СС-165 — догон.**
- Вид прогона «догон»: полный обход, `T` соседей не двигает (`ADR-0245` §2).
- Проходит по порядку каждую дату от последнего состоявшегося прогона до D.
- Даты закрытых месяцев и месяцев с удалёнными днями пропускает.
- Зовётся из `ST.run` перед ночью D и отдельной дверью `ST.catchUp(D)`.
- Правило `T` для ручного пересчёта — З-22.

*Почему:* отдельная дверь нужна сторожу. Изнутри `ST.run` сдвиг `T` догоном не отличить от
сдвига ночью D.

**СС-166 — кэш сида.**
- Ключ — отпечаток `[RELEASE, RATES, LEGACY, REGISTRY, OBJECTS, WORLD, REF, NEIGHBOURS]`.
- Хранится строка JSON собранного мира, не больше трёх ключей; каждый вызов получает свою
  копию (`JSON.parse`).
- `defineViews(st)` заново ставит неперечислимые виды `indicators`/`dims`.
- `ST.seed(true)` собирает мир мимо кэша; `ST.seedCache()` → `{size, hits, misses}`.

*Почему:* суточный сид — больше сотни прогонов, ~3 с, а смоук зовёт `ST.seed()` около 140 раз.
Проба на `641fb9f`: состояние сериализуется без потерь (undefined, функций, `Map` нет), разбор
~4 мс на мегабайт.

**СС-167 — события до З-16 идут прежним путём.** Строка события пишется при изменении, некандидат
— `skip`, копий у событий нет. Путь события меняют З-16a (дельта) и З-16b (мера).
*Почему:* З-15 — задача про состояния. Смени путь событий заодно — и сторожа З-15 падали бы от
чужой модели.

**СС-168 — закрытие запирает неполнота ИТОГА.** Итог — строки первого числа следующего
месяца; у идущего месяца — строки последней хранимой даты периода. К ним добавляются неполные
строки событий месяца. Неполнота промежуточного дня закрытия не запирает: закрытие этот день
удаляет. Порядок по `ADR-0245` §7:
1. **Доспрос первым, вне транзакции.** Строка, собранная из молчания, не пишется (известное
   не стирается, `ADR-0208` §3) и идёт в перечень. Дописанное и переписанное считаются порознь
   и при отказе не откатываются.
2. **Проверка.** Неполнота итога или перечень доспроса → отказ.
3. **Иначе закрытие.** Простановка колонки, удаление дней и фиксация — одним шагом.

`ST.periodBlockers` считает так же. Предупреждение о пропуске говорит, догнан ли он.
*Почему:* так велит `ADR-0245` §7. Прежний рубеж «неполнота до доспроса» (`ADR-0208` §4) снят —
см. находку 1 ниже.

**СС-169 — повторное открытие.** Снимает колонки (как прежде). Строку первого числа
пересчитывает прогон вида «повторное открытие»: полный обход, только состояния, `T` не
двигает. Открытые дни после первого числа — `retro` З-22; в демо-мире их числа те же.
Строка календаря хранит `daysDropped`, и после повторного открытия `storedOn` удалённые дни
хранимыми не считает. Прогон за удалённый день отбит: «дни … не восстанавливаются (ИС-54)».
*Почему:* `ADR-0238` §5 — дни не восстанавливаются. Без отметки в календаре открытый май
выглядел бы месяцем с дырами, и догон попытался бы их заполнить.

**СС-170 — `part` — четвёртое поле адреса строки.**
- `ST.ROW_SHAPE = ['obj','ref','date','part','dims','inds','when','srcs','fixed','by']`.
- `ST.ROW_KEY = ['obj','ref','date','part']`.
- У состояний и легаси `part = null`; у `event_delta` — вид поправки (`d_corr_kind`); у
  `event_full` — id цели (`target_id`).

*Почему:* ключи схемы — (`object_id`, `slice_date`, `d_corr_kind`) и (`object_id`,
`target_id`, `slice_date`). В одну дату у события ложится несколько строк, и без четвёртого
поля адрес их не различит.

**СС-171 — у события состояние читается на ночь прогона, всё прочее — на день события.**
Объект объявляет `evState` — записи состояния и вид поправки, который порождает их смена:
- платёж: `{'d-pcredit':'rebind', 'd-paystate':'reversal'}`;
- поступление: `{'d-rmatch':'match', 'd-rfrz':'freeze'}`;
- мера: `{'d-mstate':null, 'd-mresult':null}`.

Строка события = `buildRow` на день события плюс наложение `evState`, прочитанного на D. Деньги
и курс — на день события (схема §9.3: «курс НБКР на дату поступления»).
*Почему:* иначе исходная строка платежа несла бы курс ночи, в которую её переписали, а
поправка — не то состояние, которое исправляет.

**СС-172 — сценарии поправок в сторожах.** Правится `WORLD` в песочнице. Поле (`f.credit`,
`f.pstate`) — для записи статистики; датированная история (`h.credit`, `h.pstate`) — для
ядра, которое считает «погашено» кредита. Событие ставится в очередь
`ST.enqueue(obj, ref, 'распоряжение', note)`. Мир восстанавливается в `finally`.
*Почему:* запись-«поле» читается одинаково на любую дату, и `ownChanged` её смену не заметит.
Ответ соседа «ключ + дата действия» — З-22.

**СС-173 — `d_corr_date` в строке макета не хранится.** Это канун среза поправки, вычислимый из
`date`.
*Почему:* хранимый дубль разошёлся бы с датой на первой же правке (`ИС-15`).

**СС-174 — событие до запуска получает исходную строку первой своей ночью (02.05.2026).**
Миграция событий в макете не загружается. Касается `МВ-2026/12` и `МВ-2025/44`. Находка
`СС-Д25` — см. ниже.
*Почему:* `ADR-0245` §9 велит грузить платежи до запуска событийными строками легаси, а у
`LEGACY` есть только итоги кредитов. Без правила меры до запуска не имели бы строк вовсе.

**СС-175 — двери по мере читают строку представителя (`d_primary`).** Все пары «мера × цель»
отдаёт `ST.measureAt`. Представитель — цель-заёмщик, иначе единственная, иначе первая (схема
§11.2); объявлен реквизитом объекта `primaryBy`.
*Почему:* итоги сумм по схеме — «по `d_primary`», число мер — `count(distinct object_id)`.
Чтение представителя даёт то и другое без правки каждого агрегата. Дедуп по кредиту (`#124`)
остаётся как был.

**СС-176 — три записи реестра ради сторожей.**
- `d-pbdate`: `col:'d_bdate'`, `vtype:'date'`, поле `bdate`.
- `d-paystate`: `col:'d_pay_state'`, `vtype:'code'`, поле `pstate`, значения «подтверждён» ·
  «сторнирован».
- `d-mprimary`: `col:'d_primary'`, `vtype:'bool'`, поле `primary`.

Релиз: `d_bdate`, `d_pay_state` у `obj-repay`; `d_primary` у `obj-measure` (`target_id` и
`d_corr_kind` в релизе уже есть).
Реестр 308 → 311 (разрезов 79 → 82). `d-pstate` уже занят программой — отсюда имя `d-paystate`.
*Почему:* без даты привязки нечем сдвинуть строку платежа, без состояния — снять
сторнированную исходную, без представителя — посчитать итог меры. Все три колонки в схеме
есть (§9.2, §11.2).

**СС-177 — рождение события — день, когда оно стало известно.** `bornOn` у объекта с `evDay`
берёт поздний из этих полей (у платежа — день поступления и день привязки). Срез строки
события — этот день + 1, по общему правилу строгого рождения (`СС-161`).
*Почему:* одно правило даёт и дату строки (`ADR-0239` §2), и состав кандидатов, и реестр
владельца на дату. Заведи дату строки отдельно от рождения — и платёж, опознанный задним
числом, не попал бы в кандидаты: его день поступления раньше прошлой ночи.

**СС-178 — в `#202` ответ соседей замораживается подменой `CORE.read`.** После З-16a события
из множества критической даты уходят, а два оставшихся ключа (USD-кредит и его заёмщик) ядро
называет и опросом. Сторож подменяет `CORE.read` обёрткой, читающей мир не позже 20.08, и
возвращает прежний метод в `finally`.
*Почему:* «множество 2 не выводится из множества 1» доказывается только ключом, который назвала
одна критическая дата. Другого такого ключа в демо-мире нет, а заводить запись мира ради
сторожа — хуже, чем подменить ответ на время проверки.

**Граница макета, названная заранее.**
- Разнесение поступления после его дня не моделируется: виды `bind`/`refund`/`amount`
  объявлены, сторожами не проверяются.
- Повторная поправка того же события в той же дате — граница: ключ её не различит.
- Сид сохраняет порядок «все прогоны, потом закрытия». Поэтому в демо-мире нет изменения
  события после закрытия его месяца — такие сценарии строят сторожа.

**Находки проектирования (в журнал на остановке 2).**
1. `ADR-0245` §7 «сначала доспрос, потом неполнота» противоречит прежнему правилу закрытия
   (`ADR-0208` §4, комментарий у `repoll`): там неполнота вчерашней ночи отбивалась ДО доспроса.
   Следуем `ADR-0245` как более позднему. Сторожа `#198`, `#213` переписываются.
2. `ADR-0239` («строка в день события») и схема §11 («в открытом месяце строка переписывается»)
   для меры согласуются только так: исходная — в день события + 1, правка в открытом месяце —
   на месте этой строки. Так и сделано. Формулировку ADR стоит уточнить.
3. Строка 30 этого плана называет снятыми `#132`…`#136` и `#184`…`#192`. На деле все живы:
   `#184`…`#192` снимает З-15b, `#132`…`#136` — З-19. `#229` тоже живой.
4. `СС-Д25`: `ADR-0245` §9 требует событийных строк легаси для платежей до запуска. В макете
   легаси событий нет: форма легаси объявлена только у кредита.
5. Значения `d_mstate` в схеме — «действует» · «сторнирована», в мире — «зарегистрирована» ·
   «сторнирована». Этап 2 фильтрует по «≠ сторнирована»; словарь — З-18.
6. Коды `d_pay_state` в схеме — `pending` · `confirmed` · `reversed`. Макет пишет «подтверждён» ·
   «сторнирован» и состояния «ожидает» не заводит. Словарь — З-18 вместе с находкой 5.
7. `ADR-0239` велит читать деньги события на день события (схема §9.3), а разнесение
   поступления платежами идёт после его дня. Отсюда граница: разнесённое после дня
   поступления в его строку не попадает — вид `bind` объявлен, но не порождается. Решать
   моделью разнесения (З-22 или отдельный ADR), не этим этапом.

### Task 3a: З-15a — срез на начало дня: канун и период строки (`ИС-54`, `ADR-0238` §2, `ADR-0245` §8, §9)

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - даты (~1539–1551, после `monthEnd`), `LAUNCH` (~5303);
  - `readSrc`/`askSeam`/`readIndRaw` (~4305–4430), `eachAlive` (~4662), `movedCurs` (~4780),
    `candidatesOf` (~4844), `queueRegChange` (~4929);
  - `fixMonth`/`unfixMonth` (~5044–5065), `repoll` (~5125), `closeLayerCheck` (~5222);
  - `LEGACY.totals` (~5320), `loadLegacy` (~5368–5418), `seed()` (~5436–5555);
  - `ST.isClosed`/`ST.fixationOfMonth` (~5591–5605), `markExports` (~5726), `ST.run` (~5802–5815);
  - `rowsAsOf`/`resolveAsOf`/`dateGate` (~5927–6030), `latchFor` (~6311), `divergenceNote`
    (~6457);
  - `ST.registryList` (~7057), `ST.periodBlockers` (~7343–7349), `ST.divergence` (~8203),
    `ST.seriesDates` (~8233);
  - экраны (~8872, ~8986, ~9141, ~9225, ~9237, ~9322, ~9392, ~10030).
- Modify: `scripts/inspect/statistics-check.mjs`:
  - `TODAY`/`ASK` (стр. 82, 87) и помощник `eve`;
  - сдвиг дат-срезов в сторожах (список в Step 4);
  - блок З-15a (`#253`…`#255`) перед `/* ---- отчёт ---- */`.

**Interfaces:**
- Produces (движок):
  - `dayShift(d, n)`, `eveOf(d)`, `worldAt(slice)` = `eveOf`;
  - `periodOf(slice)` → `'YYYY-MM'` = месяц кануна;
  - `sliceOfMonth(month)` → первое число следующего месяца;
  - `preLaunch(d)` → `d <= LAUNCH`;
  - двери `ST.periodOf`, `ST.sliceOfMonth`, `ST.worldAt`.
- Produces (смоук): `eve(d)` — канун даты.
- Consumes: ничего нового из этапа 1.

- [ ] **Step 1: Падающие сторожа `#253`…`#255`**

Перед `/* ---- отчёт ---- */`:

```js
/* ===== Волна 23 · З-15a — срез на начало дня: канун и период строки (ИС-54, ADR-0238 §2,
   ADR-0245 §8, §9). Строка с датой D — состояние на НАЧАЛО дня D: мир на конец D−1. Отсюда
   три правила, и каждое движок считает одним местом: мир читается на канун, период строки
   — месяц кануна, итог месяца M — строка первого числа M+1. ===== */
(() => {
  /* #253 — строка 01.07 принадлежит ИЮНЮ. Защёлка июня фиксирует именно её, а 02.07 — уже
     июльская и открытая. Прогон за 01.07 отбит как за закрытый период (ИС-8). */
  ST.seed();
  const per253 = ST.periodOf ? [ST.periodOf('2026-07-01'), ST.periodOf('2026-07-02'), ST.periodOf('2026-01-01')] : [];
  const sl253 = ST.sliceOfMonth ? [ST.sliceOfMonth('2026-06'), ST.sliceOfMonth('2026-12')] : [];
  const jun253 = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.date === '2026-07-01');
  const shut253 = ST.run('2026-07-01', {});
  const open253 = ST.run('2026-07-02', {});
  ok(253, per253.join() === '2026-06,2026-07,2025-12' && sl253.join() === '2026-07-01,2027-01-01' &&
        jun253.length === 8 && jun253.every(r => r.fixed && r.fixed.period === '2026-06') &&
        ST.isClosed('2026-07-01') && !ST.isClosed('2026-07-02') &&
        !shut253.ok && has(shut253.why, 'июнь 2026') && has(shut253.why, 'ИС-8') && open253.ok,
    `срез на начало дня: строка 01.07 — ${per253[0] || '—'}, 02.07 — ${per253[1] || '—'}, 01.01 — ${per253[2] || '—'}; итог месяца — первое число следующего (${sl253.join(' · ') || '—'}). Защёлка июня фиксирует строки 01.07: кредитов ${jun253.length}, все с периодом «2026-06». Прогон за 01.07 отбит как за закрытый июнь («${String(shut253.why).slice(0, 60)}…»), за 02.07 — идёт (${open253.ok}). Период строки = месяц(slice − 1), и считается он одним местом (ИС-54, ADR-0238 §2, ADR-0245 §8)`);

  /* #254 — строка на D собрана из мира на конец D−1. Проверены все три двери мира: курс,
     история разреза и рождение объекта. */
  ST.seed();
  const W254 = vm.runInContext('WORLD', sandbox);
  const usd254 = W254['obj-credit'].find(x => x.id === 'КД-2025/043');
  const kd254 = W254['obj-credit'].find(x => x.id === 'КД-2024/117');
  const rd254 = r => ((r && r.inds['m-debt']) || {}).rateDate;
  const r0701 = ST.state.rows.find(r => r.obj === 'obj-credit' && r.ref === 'КД-2025/043' && r.date === '2026-07-01');
  const b0630 = ST.buildRow('obj-credit', usd254, '2026-06-30');
  const cur15 = ST.readDim('d-curator', kd254, '2026-07-15'), cur16 = ST.readDim('d-curator', kd254, '2026-07-16');
  const reg05 = ST.registryList('obj-repay', '2026-06-05'), reg06 = ST.registryList('obj-repay', '2026-06-06');
  const wa254 = ST.worldAt ? ST.worldAt('2026-07-01') : null;
  ok(254, wa254 === '2026-06-30' && rd254(r0701) === '2026-06-30' && rd254(b0630) === '2026-05-31' &&
        cur15 === 'Асанов А.' && cur16 === 'Бекова Н.' &&
        reg05.indexOf('ПГ-2026/1102') < 0 && reg06.indexOf('ПГ-2026/1102') >= 0,
    `срез на D читает мир на конец D−1 (ИС-54, ADR-0238 §2). Курс: строка USD на 01.07 несёт курс от ${rd254(r0701)}, собранная на 30.06 — от ${rd254(b0630)}. История: куратор КД-2024/117 сменился 15.07 — срез 15.07 его ещё не видит (${cur15}), срез 16.07 видит (${cur16}). Рождение: платёж ПГ-2026/1102 от 05.06 в срезе 05.06 не значится (${reg05.indexOf('ПГ-2026/1102') < 0}), в срезе 06.06 значится (${reg06.indexOf('ПГ-2026/1102') >= 0}) — событие дня D лежит в строке D+1`);

  /* #255 — легаси-итоги лежат на первых числах, и период их — месяц кануна: итог старой
     системы «на 31.03.2026» есть срез на начало 01.04 (ADR-0238 §2, ADR-0245 §9). Срез 01.05
     видит мир на конец 30.04 — это ещё легаси-сторона, и прогон за него отбит границей
     запуска; 02.05 — уже своя сторона (сейчас отбит закрытым маем, а не запуском). */
  ST.seed();
  const leg255 = ST.state.rows.filter(r => ST.isLegacyRow(r));
  const days255 = [...new Set(leg255.map(r => r.date))].sort();
  const pre255 = ST.run('2026-05-01', {});
  const own255 = ST.run('2026-05-02', {});
  ok(255, days255.length === 6 && days255.every(d => d.slice(8) === '01') &&
        days255[0] === '2025-01-01' && days255[5] === '2026-04-01' &&
        leg255.every(r => ST.periodOf && r.fixed.period === ST.periodOf(r.date)) && ST.isLegacyMonth('2026-03') &&
        !pre255.ok && has(pre255.why, 'раньше запуска') &&
        !own255.ok && has(own255.why, 'ИС-8') && !has(own255.why, 'запуска'),
    `легаси — только первые числа: дат ${days255.length} (${days255.join(' · ')}), период каждой строки — месяц кануна (итог «на 31.03.2026» лежит строкой 01.04 и принадлежит марту, закрытому выпуском миграции: ${ST.isLegacyMonth('2026-03')}). Срез 01.05 — ещё легаси-сторона, прогон отбит границей запуска («${String(pre255.why).slice(0, 70)}…»); 02.05 — своя сторона, и отбит он уже закрытым маем, а не запуском (ИС-54, ИС-41, ADR-0245 §9)`);
})();
```

- [ ] **Step 2: Прогнать — `#253`…`#255` падают**

Expected:
- `FAIL #253`: `ST.periodOf` нет, `per253` пуст; строк кредита на 01.07 нет — прогон пишет 30.06.
- `FAIL #254`: `ST.worldAt` нет; строки на 01.07 нет.
- `FAIL #255`: легаси лежит на концах кварталов.
- Остальные PASS. Смоук не должен падать исключением: все новые двери спрошены через
  `ST.x ? … : …`.

- [ ] **Step 3: Движок — даты, канун, период, первые числа**

(а) После `monthEnd` (~1549):

```js
/* ---- СРЕЗ НА НАЧАЛО ДНЯ (ИС-54, ADR-0238 §2, ADR-0245 §8) ----
   Строка с датой D — состояние на начало дня D, то есть мир на конец D−1. Отсюда три
   правила, и каждое считается ОДНИМ местом: мир читается на канун (`worldAt`), период
   строки — месяц кануна (`periodOf`), итог месяца M — строка первого числа M+1
   (`sliceOfMonth`). Разнеси их по вызывающим — и строка 01.07 оказалась бы июльской у
   защёлки и июньской у чтения: закрытие и ответ разошлись бы ровно на одну дату. */
const dayShift = (d, n) => new Date(Date.parse(d) + n*86400000).toISOString().slice(0,10);
const eveOf = d => dayShift(d, -1);
const worldAt = eveOf;
const periodOf = d => ym(eveOf(d));
const sliceOfMonth = m => first(nextM(m));
ST.periodOf = periodOf; ST.sliceOfMonth = sliceOfMonth; ST.worldAt = worldAt;
```

(б) После `const LAUNCH = '2026-05-01';`:

```js
/* Сторона запуска считается по СРЕЗУ: срез 01.05 видит мир на конец 30.04 и потому ещё
   легаси-сторона, а первая своя строка — 02.05 (ADR-0245 §9). Сравнения «d < LAUNCH» по
   всему файлу заменены этим одним правилом. */
const preLaunch = d => d <= LAUNCH;
```

(в) Двери мира у сборщика (`СС-161`). В комментариях этого куска — ни одного слова из словаря
`#5`.
- `readSrc`, ветка «история»: `const v = valueOn(item.h[spec.key], worldAt(dateISO));` и
  строка к комментарию: «история отвечает на канун среза: срез на начало дня видит мир на
  конец вчерашнего (ИС-54, ADR-0238 §2)».
- `askSeam`: оба вызова — `CORE.read(seam, item, worldAt(dateISO))`.
- `readIndRaw`, ветка «поле»: `const r = rateOn(item.f.cur || 'KGS', worldAt(dateISO));`.
- `movedCurs`: `if(RATES[cur].some(r => r[0] > worldAt(sinceISO) && r[0] <= worldAt(atISO))) out.push(cur);`.

(г) Рождение — строго (`СС-161`):
- `eachAlive`: `if(bornAt >= dateISO){ t.unborn++; return; }` и строка к комментарию:
  «рождение дня X видно срезу X+1 (ADR-0238 §2)».
- `candidatesOf`: `if(bornAt == null || bornAt >= dateISO) return;` и
  `if(bornAt >= prev) add('свой факт', o.id, item.id, 'рождение — '+bornAt);`.
- `queueRegChange`: `if(b == null || b >= rec.since) return;`.
- `ST.registryList`: `if(born == null || born >= dateISO) return false;`.
- Экран ~9237: `b < st.today`.

(д) Период строки — `periodOf` вместо `ym`:
- `fixMonth`, `unfixMonth`;
- `loadLegacy`: `fixed: {period: periodOf(d), …}`, `uniq(dates.map(periodOf))` — оба места;
- `ST.isClosed = dateISO => !!latchOf(ST.state, periodOf(dateISO), MY_LAYER);`;
- `ST.fixationOfMonth`, `markExports`, `latchFor`, `divergenceNote`;
- `ST.periodBlockers` — оба фильтра;
- `ST.run` — текст отказа `monLabel(periodOf(dateISO))`;
- экраны ~9141, ~9225, ~9392.

(е) Итог месяца — `sliceOfMonth` вместо `monthEnd`:
- `repoll`: `const dateISO = sliceOfMonth(month);` и строка к комментарию: «слепок — строка
  первого числа следующего месяца: она и есть итог месяца (ADR-0245 §9)».
- `ST.divergence`: `rowsAsOf(st, objId, sliceOfMonth(month))`.
- `ST.seriesDates`: `let m = periodOf(st.q.date);` и `out.unshift(i === 0 ? st.q.date : sliceOfMonth(m));`.
- `closeLayerCheck`:

```js
  if(sliceOfMonth(month) > st.today) return {ok:false, why:'период '+monLabel(month)+
    ' ещё не завершён: его итог — срез на начало '+fmt(sliceOfMonth(month))+
    ', закрытие возможно с этой даты (ADR-0245 §9)'};
```

(ж) Граница запуска — `preLaunch` вместо сравнений с `LAUNCH`: `rowsAsOf` (~5935),
`resolveAsOf` (~5964, ~5968), `dateGate` (~5994, ~5996, ~6009, ~6015). В `ST.run`:

```js
  if(preLaunch(dateISO)) return {ok:false, why:'прогон за '+fmt(dateISO)+' не запускается: '+
    'срез на начало дня видит мир на конец '+fmt(eveOf(dateISO))+', а это раньше запуска '+
    fmt(LAUNCH)+'. До запуска историю собирала другая система, и её итоги загружены выпуском '+
    'миграции ('+st.legacy.by+', '+fmt(st.legacy.at)+') — прогон их не считает, не видит и не '+
    'перепишет (ИС-41, ИС-54, ADR-0207 §3, §5)'};
```

(з) `LEGACY.totals` — каждый ключ +1 день. Концы кварталов
`2024-12-31 · 2025-03-31 · 2025-06-30 · 2025-09-30 · 2025-12-31 · 2026-03-31` становятся
`2025-01-01 · 2025-04-01 · 2025-07-01 · 2025-10-01 · 2026-01-01 · 2026-04-01`; числа итогов не
трогаются. В комментарии над `totals` добавить: «ключи — СРЕЗЫ на начало первого числа: итог
старой системы "на 31.03.2026" есть состояние на начало 01.04 (ИС-54, ADR-0238 §2)»; «после
31.12.2025» → «после 01.01.2026».

(и) `seed()` (`СС-162`):
- `today: '2026-08-22'`, `q.date: '2026-08-22'` (пересчитывается ниже, как прежде);
- `flow: {inds:'m-repaid', from:'2026-07-16', to:'2026-08-19'}`;
- прогоны `['2026-06-01','2026-07-01','2026-08-01','2026-08-11','2026-08-19']`;
- пропуск `{date:'2026-08-20', at:'2026-08-21', …}`, затем `doRun(st, '2026-08-21', 'плановый', null, null)`;
- в комментарии «19.08 — дыра … 21.08 — хвост» → «20.08 — дыра … 22.08 — хвост»;
- даты закрытий (`'2026-06-05'`…`'2026-07-09'`) не трогаются.

(к) Экраны:
- варианты потока ~8872–8873: `2026-05-13`/`13.05.2026` и `2026-07-16`/`16.07.2026`;
- `ST.runClosedUI` — `ST.run('2026-07-01', {})`;
- надпись ~9322 — «Попробовать переписать 01.07 (закрыт)»;
- `ST.exportClosedUI` — `date:'2026-06-01'`.

`CORE.objectRows(at)` и `checkQuery` (`D.since > q.date`) не трогаются (`СС-161`).

- [ ] **Step 4: Смоук — даты срезов на +1**

После `const has = …` (~стр. 81):

```js
/* Срез на начало дня (ИС-54, ADR-0238 §2): даты срезов смоука сдвинуты на +1 вместе с
   календарём демо-мира (СС-162) — та же ночь мира лежит в строке следующего дня. Курс,
   поставленный «к срезу X», ставится на его канун: `eve(X)`. */
const eve = d => new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10);
```

`TODAY = '2026-08-22'`, `ASK = '2026-08-21'`; `J` блока З-10 — `'2026-08-01'`. Ключ повода в
`#197`…`#200`: `'…/с-2026-08-21'`.

**Сдвигаются на +1:**
- даты аргументов `ST.run`, `ST.skip`, `ST.rowsAt`, `ST.rowsAsOf`, `ST.dateGate`,
  `ST.registryList`, `ST.buildRow`, `ST.isClosed`;
- `date`/`dates`/`from`/`to` вопросов; сравнения с `r.date`;
- строки `dd.mm` и `dd.mm.yyyy` дат срезов в `has(…)` и в текстах;
- даты легаси (`'2025-12-31'` → `'2026-01-01'` и т. д.) и `st.today = …` в сторожах `T`
  (`#203`, `#204`).

**Не сдвигаются:**
- строки месяцев (`'2026-07'`);
- четвёртый аргумент `ST.closeLayer` (`'2026-08-05'`, `'2026-08-07'`, `'2026-01-05'`);
- `rateDate` (`'2026-08-18'` в `#27`, `#28`, `#172`: курс — дата мира);
- даты историй `WORLD` (`#218`: `'2025-01-01'`, `'2026-07-15'`, `'2026-08-15'`);
- `fixed.at` `'2026-04-28'`;
- тексты распоряжений и актов (`'21.08.2026'`, `'14.07.2026'`), текст `LAUNCH` `'01.05.2026'`;
- `actsOn` `'2026-07-01'`, комментарий `'27.08.2026'`, штамп `SMOKE 2026-09-18`.

**Курс «к срезу» ставится на канун:** `RATES…push([eve(TODAY), 91.10])` в `#202`,
`push([eve(J), …])` в `#211`, `#212`, `#214` (это те же `'2026-08-21'` и `'2026-07-31'`, что
стоят сейчас).

**Затронутые сторожа** (по разбору литералов): `#1`, `#3`, `#11`–`#14`, `#17`–`#23`, `#27`,
`#28`, `#30`–`#32`, `#37`, `#38`, `#40`, `#66`, `#72`, `#73`, `#86`–`#89`, `#91`, `#99`, `#100`,
`#109`–`#111`, `#121`, `#129`–`#131`, `#136`, `#139`–`#147`, `#153`, `#157`, `#163`, `#172`,
`#182`–`#204`, `#208`–`#215`, `#218`–`#229`, `#250`. Номера и утверждения сторожей не меняются —
меняются только даты, которыми они спрашивают.

Проверка остатка — `grep -nE "'2026-0[5-8]-(31|30|18|19|20|10)'|'2025-(03|06|09|12)-3[01]'|'2024-12-31'" scripts/inspect/statistics-check.mjs`:
в выводе только исключения из списка «не сдвигаются».

- [ ] **Step 5: Прогнать — зелёный целиком**

Expected: `exit=0`, 249/249 PASS (246 + 3). Сторож, упавший по числу, а не по дате, —
признак ошибки в каноне кануна (`СС-161`), а не повод переписать число: найти дверь мира,
читающую дату среза, и поправить её.

- [ ] **Step 6: Мутации** (по одной, в копии — см. «Приёмы»)
1. `const periodOf = d => ym(d);` → `#253`.
2. `const worldAt = d => d;` → `#254`.
3. В `eachAlive` и `ST.registryList` вернуть нестрогое рождение (`> dateISO`) → `#254`.
4. Ключи `LEGACY.totals` — обратно на концы кварталов → `#255`.
5. `const preLaunch = d => d < LAUNCH;` → `#255`.

- [ ] **Step 7: Коммит** — `Статистика: волна 23 З-15a — срез на начало дня: канун, период строки, первые числа`.
Тело: календарь демо-мира на +1 (СС-161, СС-162), сторожа #253…#255, дат-сдвиг смоука без
смены утверждений. Строка в «Ход работы».

### Task 3b: З-15b — строка каждый день: копия, догон, кэш демо-мира (`ИС-54`, `ADR-0238` §1, §4; `ADR-0245` §2, §6)

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `newTally`/`partOf` (~4649);
  - новые помощники между `function deq` и `function doRun` (~4949): `storageOf`,
    `CATCHUP_SCAN`, `REOPEN_SCAN`, `fullScan`, `copyRow`, `gapsBefore`, `catchUp`;
  - `doRun` (~4954–5043);
  - `ST.run` (~5802–5864), `ST.catchUp` рядом с ним;
  - `seed()` и `ST.seed` (~5436–5561): суточные прогоны, `defineViews`, кэш.
- Modify: `scripts/inspect/statistics-check.mjs`:
  - блок З-15b (`#256`…`#259`);
  - надгробия `#184`…`#192` (~3568–3860);
  - переписка сторожей из Step 5.

**Interfaces:**
- Consumes: `dayShift`, `eveOf`, `periodOf`, `sliceOfMonth` (З-15a); `RELEASE.tables[obj].storage` (З-13).
- Produces:
  - `storageOf(objId)` → `'state' | 'event_delta' | 'event_full'`, дверь `ST.storageOf`;
  - у части журнала прогона поля `copied`, `written`;
  - `ST.run(…)` → дополнительно `copied`, `caught: string[]`; отказ `{ok:false, skipped:true, why}`,
    когда периода нет в календаре;
  - вид прогона «догон»; `ST.catchUp(dateISO)` → `{ok, date, dates}`;
  - `doRun(st, dateISO, kind, actor, reason, silent, how)`, где
    `how = {full, keepT, statesOnly, why}`;
  - `ST.seed(fresh)`; `ST.seedCache()` → `{size, hits, misses}`.

- [ ] **Step 1: Падающие сторожа `#256`…`#259`**

Перед `/* ---- отчёт ---- */`, после блока З-15a:

```js
/* ===== Волна 23 · З-15b — строка каждый день: копия, догон, кэш (ИС-54, ADR-0238 §1, §4,
   ADR-0245 §2, §6). Разрежённое хранение (ИС-45, ADR-0215) снято: в открытом месяце у
   объекта-состояния строка на КАЖДУЮ дату, и «не менялось» больше не выводится из
   отсутствия строки. Некандидат получает копию вчерашней, пропущенная ночь догоняется. ===== */
(() => {
  /* Новые двери спрашиваются через обёртку: до движка З-15b их нет, и сторож обязан упасть
     своим FAIL, а не уронить смоук исключением. */
  const stor = id => ST.storageOf ? ST.storageOf(id) : null;
  /* #256 — строка на каждую дату у каждого живого объекта-состояния; некандидату — копия
     вчерашней (значения те же, дата новая). Копий у событий нет. */
  ST.seed();
  const states256 = ST.state.objects.filter(o => stor(o.id) === 'state').map(o => o.id);
  const days256 = [...new Set(ST.state.runs.filter(r => r.kind !== 'пропуск' && r.kind !== 'защёлка' &&
    r.date >= '2026-07-02').map(r => r.date))];
  const holes256 = [];
  days256.forEach(d => states256.forEach(o => {
    if(ST.registryList(o, d).join() !== ST.rowsAt(o, d).map(r => r.ref).sort().join()) holes256.push(o + '@' + d);
  }));
  /* Некандидаты считаются ДО ночи — дверью состава кандидатов, а не выводом из журнала:
     «скопировано» обязано совпасть с числом тех, кого ночь не назвала (цель 1 задачи). */
  const c256 = ST.candidates(TODAY);
  const inCand = {};
  Object.keys(c256.by || {}).forEach(k => c256.by[k].forEach(x => { inCand[x.obj + '|' + x.ref] = 1; }));
  const nonCand = states256.reduce((n, o) => n + ST.registryList(o, TODAY).filter(ref => !inCand[o + '|' + ref]).length, 0);
  const r256 = ST.run(TODAY);
  const j256 = ST.state.runs[ST.state.runs.length - 1];
  const part256 = id => j256.parts.find(p => p.obj === id) || {};
  const stParts = j256.parts.filter(p => states256.indexOf(p.obj) >= 0);
  const evCopied = j256.parts.filter(p => states256.indexOf(p.obj) < 0).reduce((n, p) => n + (p.copied || 0), 0);
  const zd = ST.rowsAt('obj-zdeal', TODAY), zy = ST.rowsAt('obj-zdeal', ASK);
  const copyEq = zd.length === 5 && zd.every(x => { const y = zy.find(z => z.ref === x.ref);
    return y && JSON.stringify([x.dims, x.inds, x.when]) === JSON.stringify([y.dims, y.inds, y.when]) && !x.fixed; });
  ok(256, states256.length === 7 && days256.length >= 50 && holes256.length === 0 &&
        r256.ok && !c256.full && r256.copied === nonCand && r256.copied === 12 &&
        r256.written === 42 && r256.skip === 34 &&
        part256('obj-borrower').copied === 2 && part256('obj-zdeal').copied === 5 && part256('obj-program').copied === 5 &&
        evCopied === 0 && copyEq &&
        stParts.every(p => p.skip === 0 && p.written === p.n + p.same + p.copied &&
          p.n + p.same + p.copied + p.kept === ST.registryList(p.obj, TODAY).length),
    `строка каждый день (ИС-54, ADR-0238 §1): у ${states256.length} объектов-состояний на ${days256.length} дат открытого периода строк ровно столько, сколько живых записей у владельца, — дыр ${holes256.length}${holes256.length ? ' (' + holes256.slice(0, 5).join(', ') + ')' : ''}. Ночь ${TODAY}: написано ${r256.written}, из них скопировано ${r256.copied} — ровно столько, сколько живых записей ночь не назвала кандидатами (${nonCand}) (заёмщиков ${part256('obj-borrower').copied}, договоров ${part256('obj-zdeal').copied}, программ ${part256('obj-program').copied}) — копия равна вчерашней строке значениями и происхождением (${copyEq}), дата своя, фиксации нет. События не копируются (${evCopied}) и не обходятся некандидатами (${r256.skip}). Тождество части: написано = пересчитано + без изменений + скопировано, и вместе с зафиксированными это все живые (СС-164)`);

  /* #257 — пропущенная ночь не оставляет дыры: прогон сперва ДОГОНЯЕТ каждую пропущенную
     дату по порядку полным обходом, и `T` соседей догон не двигает — его двигает только
     ночной прогон (ADR-0245 §2). Периода нет в календаре — ночь записана пропуском (§6). */
  ST.seed();
  const st257 = ST.state;
  st257.today = '2026-08-25';
  const Ts = () => JSON.stringify(ST.polls().map(p => [p.nb, p.T]));
  const T0 = Ts();
  ST.skip('2026-08-22', 'сбой ночного планировщика');
  ST.skip('2026-08-23', 'сбой ночного планировщика');
  const cu257 = ST.catchUp ? ST.catchUp('2026-08-24') : {ok:false, dates:[]};
  const T1 = Ts();
  const cuRuns = st257.runs.filter(x => x.kind === 'догон' && x.date >= '2026-08-22');
  ST.skip('2026-08-24', 'окно обслуживания СУБД');
  const run257 = ST.run('2026-08-25');
  const order257 = st257.runs.slice(-2).map(x => x.kind + ' ' + x.date).join(' · ');
  const Tcore = (ST.polls().find(p => p.nb === 'ядро') || {}).T;
  const holes257 = [];
  ['2026-08-22','2026-08-23','2026-08-24','2026-08-25'].forEach(d =>
    ['obj-credit','obj-borrower','obj-program'].forEach(o => {
      if(ST.rowsAt(o, d).length !== ST.registryList(o, d).length) holes257.push(o + '@' + d); }));
  const again257 = ST.catchUp ? ST.catchUp('2026-08-25') : {dates:[1]};
  const skips257 = st257.runs.filter(x => x.kind === 'пропуск' && x.date >= '2026-08-22').length;
  st257.today = '2026-09-02';
  const nocal = ST.run('2026-09-02');
  const nocalRec = st257.runs[st257.runs.length - 1];
  ok(257, cu257.ok && cu257.dates.join() === '2026-08-22,2026-08-23' && T1 === T0 &&
        cuRuns.length === 2 && cuRuns.every(x => x.cand.scan === 'полный' && has(x.cand.why, 'ADR-0245 §2')) &&
        run257.ok && (run257.caught || []).join() === '2026-08-24' &&
        order257 === 'догон 2026-08-24 · плановый 2026-08-25' && Tcore === '2026-08-25' &&
        holes257.length === 0 && again257.dates.length === 0 && skips257 === 3 &&
        !nocal.ok && nocal.skipped === true && nocalRec.kind === 'пропуск' && has(nocalRec.reason, 'ADR-0245 §6'),
    `пропуск — запись журнала, а не дыра: пропущено ${skips257} ночи, и каждая догнана своей строкой по порядку (${cu257.dates.join(', ')} — дверью ST.catchUp; ${(run257.caught || []).join(', ')} — прогоном ${'2026-08-25'} перед своей ночью: «${order257}»). Дыр в строках ${holes257.length}. Догон — полный обход со своей причиной и НЕ двигает T соседей (до и после догона T одинаковы: ${T1 === T0}); T двигает ночь (ядро — ${Tcore}), иначе следующая ночь спросила бы соседа с уже съеденной даты (ADR-0245 §2). Повторный догон догонять нечего (${again257.dates.length}). Периода нет в календаре — ночь записана пропуском с причиной: «${String(nocalRec.reason).slice(0, 80)}…» (ADR-0245 §6)`);

  /* #258 — повторный прогон за пройденную дату ПЕРЕПИСЫВАЕТ строку на месте, пишет перезапись
     в журнал и не заводит дублей; соседняя дата не тронута. Он же — полный обход: копий в
     нём нет, каждая строка собрана заново. Держит смысл снятого #187 (ADR-0215 §6 в силе). */
  ST.seed();
  ST.run(TODAY);
  const R258 = vm.runInContext('RATES', sandbox);
  const todayRows = JSON.stringify(ST.rowsAt('obj-credit', TODAY));
  let re258, j258, usd258, dup258;
  R258.USD.push(['2026-08-20', 89.00]);
  try {
    re258 = ST.run(ASK, {manual: true, reason: 'уточнён курс за 20.08'});
    j258 = ST.state.runs[ST.state.runs.length - 1];
    usd258 = (ST.rowsAt('obj-credit', ASK).find(r => r.ref === 'КД-2025/043') || {inds: {}}).inds['m-debt'] || {};
    dup258 = ST.state.rows.filter(r => stor(r.obj) === 'state')
      .map(r => r.obj + '|' + r.ref + '|' + r.date).filter((k, i, a) => a.indexOf(k) !== i).length;
  } finally { R258.USD.pop(); }
  const pc258 = j258.parts.find(p => p.obj === 'obj-credit');
  /* Счёт — по состояниям: валютные события до З-16 ещё пишутся «при изменении» (СС-167), и
     курс 20.08 добавит их строки к общему `written`. Сторож не о них. */
  const stW258 = j258.parts.filter(p => stor(p.obj) === 'state').reduce((n, p) => n + p.written, 0);
  ok(258, re258.ok && stW258 === 42 && re258.copied === 0 && j258.cand.scan === 'полный' &&
        pc258.n === 1 && pc258.same === 7 && pc258.rewrote.some(x => x.ref === 'КД-2025/043' && x.fields.indexOf('m-debt') >= 0) &&
        usd258.rate === 89 && usd258.rateDate === '2026-08-20' &&
        dup258 === 0 && JSON.stringify(ST.rowsAt('obj-credit', TODAY)) === todayRows,
    `повторный прогон за ${ASK} — полный обход: копий ${re258.copied}, строк состояний написано ${stW258}, у кредитов переписано ${pc258.n} и без изменений ${pc258.same}. Переписанная строка стоит на месте, а не рядом (дублей адреса ${dup258}), и перезапись названа в журнале: КД-2025/043 · m-debt, курс ${usd258.rate} от ${usd258.rateDate}. Строки ${TODAY} не тронуты — пересчитывалась одна дата (ADR-0238 §1, ADR-0215 §6)`);

  /* #259 — кэш демо-мира (СС-166): копия независима, ключ — отпечаток данных мира. */
  const sc = () => ST.seedCache ? ST.seedCache() : {size: 0, hits: 0, misses: 0};
  const c0 = sc();
  const a259 = ST.seed(); a259.rows.pop(); a259.today = '2030-01-01';
  const b259 = ST.seed();
  const c1 = sc();
  const fresh259 = ST.seed(true);
  const same259 = JSON.stringify(fresh259) === JSON.stringify(ST.seed());
  const R259 = vm.runInContext('RATES', sandbox);
  let miss259 = -1, eur259 = null;
  R259.EUR.push(['2026-08-20', 97.00]);
  try {
    const m0 = sc().misses; ST.seed(); miss259 = sc().misses - m0;
    eur259 = (ST.rowsAt('obj-credit', ASK).find(r => r.ref === 'КД-2025/101') || {inds: {}}).inds['m-debt'];
  } finally { R259.EUR.pop(); }
  const back259 = sc().hits; ST.seed(); const hit259 = sc().hits - back259;
  ok(259, b259.today === '2026-08-22' && b259.rows.length === a259.rows.length + 1 &&
        c1.hits > c0.hits && same259 && Array.isArray(b259.indicators) && b259.indicators.length > 0 &&
        miss259 === 1 && eur259 && eur259.rate === 97 && hit259 === 1 && sc().size <= 3,
    `кэш демо-мира отдаёт независимую копию: правка одной копии (строк −1, «сегодня» 2030) не доехала до следующей (${b259.rows.length} строк, сегодня ${b259.today}); собранный мимо кэша мир равен кэшированному (${same259}); виды реестра на копии на месте (${b259.indicators.length}). Ключ — отпечаток данных: уточнённый курс евро собирает мир заново (промахов ${miss259}, курс в строке ${eur259 ? eur259.rate : '—'}), а возврат курса снова попадает в кэш (${hit259}). Ключей в кэше ${sc().size} из 3 (СС-166)`);
})();
```

- [ ] **Step 2: Прогнать — `#256`…`#259` падают**

Expected:
- `FAIL #256`: `ST.storageOf` нет — `states256` пуст; строк на каждую дату нет.
- `FAIL #257`: `ST.catchUp` нет.
- `FAIL #258`: `ST.storageOf` нет — счёт состояний пуст; да и разрежённый повторный прогон
  засчитывает написанными только изменённые строки, а не 42.
- `FAIL #259`: `ST.seedCache` нет.

- [ ] **Step 3: Движок — способ хранения, счётчики, копия, догон**

`newTally` и `partOf` — добавить `copied:0, written:0` и перенести их в часть:

```js
function newTally(){ return {n:0, kept:0, unborn:0, noborn:0, same:0, born:0, have:0,
                             partial:0, skip:0, copied:0, written:0, rewrote:[], filled:[]}; }
function partOf(o, t){
  return {obj: o.id, name: o.name, n: t.n, kept: t.kept, unborn: t.unborn, noborn: t.noborn,
          same: t.same, born: t.born, have: t.have, partial: t.partial, skip: t.skip,
          copied: t.copied, written: t.written, rewrote: t.rewrote, filled: t.filled};
}
```

Комментарий над `newTally` дополнить абзацем `СС-164`: «Волна 23 добавила `copied` и
`written`…» — тождество состояния и то, что `skip` остался только у событий.

Между `function deq` и `function doRun`:

```js
/* Способ хранения — реквизит РЕЛИЗА, а не объекта (ИС-55, ADR-0239 §1, ADR-0237 §2):
   таблицу строк объявляет миграция вместе со способом, и второго объявления рядом с
   объектом нет. Читается из релиза в состоянии — его дописывает миграция (З-14). */
function storageOf(objId){
  const rel = (ST.state && ST.state.release) || RELEASE;
  return (rel.tables[objId] || {}).storage || null;
}
ST.storageOf = objId => storageOf(objId);
/* Полный обход объявляется причиной (ИС-48). У догона и повторного открытия она своя: они
   удостоверяют дату, а не приращение (ADR-0245 §2, ADR-0221 §3). */
const CATCHUP_SCAN = 'догон пропущенной ночи: дата удостоверяется, а не приращается (ADR-0245 §2, ADR-0221 §3)';
const REOPEN_SCAN = 'повторное открытие: пересчитывается итог месяца, дни не восстанавливаются (ADR-0238 §5, ADR-0245 §2)';
function fullScan(why){ return {full:true, from:null, set:{}, by:{}, polls:[], moved:[], why}; }
/* Копия вчерашней строки НЕКАНДИДАТУ (ИС-54, ADR-0238 §1). Некандидат — объект, о котором
   ни один источник не сказал «посмотри»: соседи не назвали, курс не двигал, свой факт не
   менялся. Его состояние на D то же, что на D−1, и строка D — вчерашняя с новой датой.
   Судьба у копии своя: фиксации нет, писал прогон. Колонки источника и происхождение
   переходят с копией — ответ на D−1 и есть основание этой строки. */
function copyRow(y, dateISO){ return Object.assign(clone(y), {date: dateISO, fixed: null, by: 'прогон'}); }
/* ---------- ДОГОН (ИС-54, ADR-0238 §4, ADR-0245 §2) ----------
   Дыры в открытом месяце не бывает. Пропущенная ночь записывается пропуском (ИС-20), а
   следующий прогон сперва ДОГОНЯЕТ каждую пропущенную дату — по порядку, полным обходом.
   До волны 23 дыру закрывала подстановка при чтении: «на 19.08 — строки от 18.08, возраст
   1 день» (ИС-12). Теперь у пропущенной даты своя строка, и подставлять нечего.
   Догон `T` соседей НЕ ДВИГАЕТ: его двигает только ночной прогон — иначе ночь, пришедшая
   следом, спросила бы соседа с уже съеденной даты. Дата закрытого месяца не догоняется:
   в закрытое не пишет никто (ИС-8). */
const NIGHTLY = ['плановый','внеплановый','догон'];
function gapsBefore(st, dateISO){
  const done = st.runs.filter(r => NIGHTLY.indexOf(r.kind) >= 0 && r.date < dateISO).map(r => r.date).sort();
  if(!done.length) return [];
  const out = [];
  for(let d = dayShift(done[done.length - 1], 1); d < dateISO; d = dayShift(d, 1))
    if(!latchOf(st, periodOf(d), MY_LAYER)) out.push(d);
  return out;
}
function catchUp(st, dateISO, silent){
  const dates = gapsBefore(st, dateISO);
  dates.forEach(d => {
    doRun(st, d, 'догон', 'планировщик', 'догон пропущенной ночи '+fmt(d)+' перед ночью '+
      fmt(dateISO)+' (ИС-54, ADR-0245 §2)', silent, {full: true, keepT: true, why: CATCHUP_SCAN});
    /* Перед какой ночью шёл догон — реквизит записи: предупреждение о пропуске называет его
       (З-15c), а `at` у демо-мира один на все ночи сида. */
    st.runs[st.runs.length - 1].before = dateISO;
  });
  return dates;
}
```

- [ ] **Step 4: `doRun` — строка каждый день**

Новое тело. Комментарии прежние сохраняются там, где правило живо. Ссылки на `ИС-45` как на
действующее правило переписываются под `ИС-54`. Слов словаря `#5` в теле нет.

```js
function doRun(st, dateISO, kind, actor, reason, silent, how){
  how = how || {};
  let written = 0;
  const parts = [];
  /* Кого берёт эта ночь (ИС-48). Полный обход остаётся законным ответом и НАЗЫВАЕТСЯ
     причиной: без причины «полный» и «кандидаты» отличались бы только числом строк. */
  const cand = how.full ? fullScan(how.why) : candidatesOf(st, dateISO, silent);
  st.objects.forEach(o => {
    const t = newTally();
    const state = storageOf(o.id) === 'state';
    /* Повторное открытие пересчитывает ИТОГ — строки состояний на первое число; у событий
       итога на дату нет, их строки и есть месяц (ADR-0238 §5, ADR-0239). */
    if(how.statesOnly && !state){ parts.push(partOf(o, t)); return; }
    eachAlive(o, dateISO, t, item => {
      const i = st.rows.findIndex(r => r.obj === o.id && r.ref === item.id && r.date === dateISO);
      if(!cand.full && !cand.set[o.id+'|'+item.id]){
        /* Событие некандидатом не обходится: его строка пишется при изменении (СС-167).
           Состояние получает строку на КАЖДУЮ дату (ИС-54): некандидату — копию вчерашней.
           Строка на дату уже есть — её написал доспрос или прежний прогон, и она остаётся.
           Вчерашней нет — копировать нечего, и строка собирается заново. */
        if(!state){ t.skip++; return; }
        if(i >= 0){ if(st.rows[i].fixed) t.kept++; else { t.same++; t.written++; written++; } return; }
        const y = lastRowBefore(st, o.id, item.id, dateISO);
        if(y && y.date === eveOf(dateISO)){
          st.rows.push(copyRow(y, dateISO)); t.copied++; t.written++; written++; return;
        }
      }
      deq(st, o.id, item.id, 'досчёт', dateISO, 'обойдён прогоном');
      deq(st, o.id, item.id, 'распоряжение', dateISO, 'обойдён прогоном');
      const row = buildRow(o.id, item, dateISO, silent);
      const part = silentOf(row).length > 0;
      if(part) enq(st, o.id, item.id, 'дозаполнение', dateISO, 'прогон',
                   'молчали: '+silentOf(row).join(', '));
      else deq(st, o.id, item.id, 'дозаполнение', dateISO, 'строка написана полной');
      if(i >= 0){
        if(st.rows[i].fixed){ t.kept++; return; }
        const ch = rowDiff(st.rows[i], row);
        /* Повторный прогон той же даты, ничего не изменивший, — не перезапись. У состояния
           строка на дату при этом ЕСТЬ и засчитывается написанной: её подтвердила эта ночь. */
        if(!ch.length){ t.same++; if(state){ t.written++; written++; } return; }
        const sp = splitDiff(st.rows[i], row, ch);
        if(sp.rewrote.length) t.rewrote.push({ref: item.id, fields: sp.rewrote});
        if(sp.filled.length)  t.filled.push({ref: item.id, fields: sp.filled});
        st.rows[i] = row; t.n++; t.written++; written++; if(part) t.partial++; return;
      }
      const prev = lastRowBefore(st, o.id, item.id, dateISO);
      if(prev){
        const ch = rowDiff(prev, row);
        if(!ch.length){
          /* Не менялось. Событие строки не получает (СС-167); состояние — получает: строка
             на каждую дату открытого месяца, и «не менялось» больше не выводится из её
             отсутствия (ИС-45 снят ИС-54, ADR-0238 §1). */
          t.same++;
          if(!state) return;
          st.rows.push(row); t.written++; written++; if(part) t.partial++; return;
        }
        const sp = splitDiff(prev, row, ch);
        if(sp.filled.length) t.filled.push({ref: item.id, fields: sp.filled});
      } else t.born++;
      st.rows.push(row); t.n++; t.written++; written++; if(part) t.partial++;
    });
    parts.push(partOf(o, t));
  });
  st.runs.push({date: dateISO, kind, at: st.today, actor, reason, written, parts,
    silent: silent ? clone(silent) : null, cand: candSummary(cand)});
  /* `T` двигает ТОЛЬКО ночной прогон (ADR-0245 §2): догон и повторное открытие удостоверяют
     прошлую дату, и сдвинь они `T` — следующая ночь спросила бы соседа с уже съеденной даты.
     У ответившего `T` двигается только вперёд, молчавшему остаётся прежним (ADR-0221 §2). */
  if(!how.keepT) NEIGHBOURS.forEach(nb => {
    if(!nb.asks || (silent || {})[nb.id]) return;
    const p = st.polls[nb.id] || (st.polls[nb.id] = {T: null, at: null});
    if(p.T == null || p.T < dateISO){ p.T = dateISO; p.at = st.today; }
  });
  return written;
}
```

Комментарии к `silent`/`cand` в записи журнала (прежние, ~5018–5026) переносятся как есть.
Вводный комментарий раздела «РАЗРЕЖЁННОЕ ХРАНЕНИЕ (ИС-45, ADR-0215)» (~4540) переписать:
«СТРОКА КАЖДЫЙ ДЕНЬ (ИС-54, ADR-0238 §1). Разрежённое хранение снято: копия вчерашней строки
удостоверяет, что состояние на эту дату известно, а не только что прогон был; объём —
цена ответа на любую дату открытого месяца без подстановки. Закрытый месяц хранит итог
(З-15c)». Абзац «ГРАНИЦА ЭТОЙ ВОЛНЫ…» — про обход — остаётся.

- [ ] **Step 5: `ST.run`, `ST.catchUp`, сид суточными прогонами и кэш**

`ST.run`, после проверки `silent` и до вызова `doRun`:

```js
  /* ADR-0245 §6: периода нет в календаре — срезу некуда лечь, и ночь записывается
     ПРОПУСКОМ с причиной, а не отказом без следа: «прогона не было» обязано быть видно в
     журнале (ИС-20). */
  if(!calendarRow(st, periodOf(dateISO))){
    const why = 'периода '+monLabel(periodOf(dateISO))+' нет в календаре учётных периодов: срезу '+
      fmt(dateISO)+' некуда лечь (ADR-0245 §6)';
    st.runs.push({date: dateISO, kind:'пропуск', at: st.today, actor:'планировщик', reason: why, written:0});
    log('пропуск прогона за '+fmt(dateISO)+': '+why);
    return {ok:false, skipped:true, why};
  }
  /* Перед своей ночью прогон догоняет пропущенные (ИС-54, ADR-0238 §4). */
  const caught = catchUp(st, dateISO, silent);
```

Итог `ST.run`:
- `const copied = sum('copied');`;
- в строку журнала: `' · скопировано — '+copied` и
  `(caught.length ? ' · догнано — '+caught.map(fmt).join(', ') : '')`;
- в ответ: `copied, caught`.

Рядом с `ST.run`:

```js
/* Догон отдельной дверью: ночь начинается с него, и спросить «что догнано и тронут ли T»
   надо до ночи, а не выводить из её последствий (СС-165). */
ST.catchUp = dateISO => {
  const st = ST.state, d = dateISO || st.today;
  if(d > st.today) return {ok:false, why:'догон на будущую дату не запускается'};
  const dates = catchUp(st, d, null);
  if(dates.length) log('догон перед '+fmt(d)+': '+dates.map(fmt).join(', ')+
    ' — полным обходом, T соседей не тронут (ADR-0245 §2)');
  return {ok:true, date: d, dates};
};
```

`seed()`: блок прогонов З-15a заменить суточным:

```js
  /* СТРОКА КАЖДЫЙ ДЕНЬ (ИС-54): демо-мир прогоняется каждую ночь от первой своей — 02.05
     (срез 01.05 ещё легаси-сторона, ADR-0245 §9) — до 21.08. Одна ночь пропущена, 20.08, и
     её догоняет прогон 21.08: пропуск остаётся в журнале, а дыры в строках нет (ADR-0238 §4). */
  for(let d = dayShift(LAUNCH, 1); d <= '2026-08-21'; d = dayShift(d, 1)){
    if(d === '2026-08-20'){
      st.runs.push({date: d, kind:'пропуск', at: dayShift(d, 1), actor:'планировщик',
        reason:'сбой ночного планировщика: задание не стартовало', written:0});
      continue;
    }
    catchUp(st, d, null);
    doRun(st, d, 'плановый', null, null);
  }
```

Блок `Object.defineProperty(st, 'indicators' …)`/`'dims'` в `seed()` заменить вызовом
`defineViews(st);`. После `function seed(){…}` — `ST.seed` с кэшем (`СС-166`):

```js
/* КЭШ ДЕМО-МИРА (СС-166). Мир строится суточными прогонами — больше сотни ночей, — и смоук,
   зовущий `ST.seed()` перед каждым сторожем, собирал бы его заново сотни раз. Кэш хранит
   СОБРАННЫЙ мир строкой JSON и отдаёт каждому вызову независимую копию: сторож, правящий
   состояние, не портит его следующему. Ключ — отпечаток всех данных, из которых мир
   собран: сторож, поправивший курс или запись мира, получает мир, собранный заново, а не
   вчерашний из кэша. Виды `indicators`/`dims` неперечислимы и в JSON не попадают — их
   ставит `defineViews` на каждой копии. `ST.seed(true)` собирает мир мимо кэша. */
function defineViews(st){
  Object.defineProperty(st, 'indicators', {enumerable:false, configurable:true,
    get: () => st.registry.filter(r => r.kind === KIND.IND)});
  Object.defineProperty(st, 'dims', {enumerable:false, configurable:true,
    get: () => st.registry.filter(r => r.kind === KIND.DIM)});
}
const SEED_CACHE = new Map(), SEED_STAT = {hits: 0, misses: 0};
const seedPrint = () => JSON.stringify([RELEASE, RATES, LEGACY, REGISTRY, OBJECTS, WORLD, REF, NEIGHBOURS]);
ST.seed = fresh => {
  const key = seedPrint();
  let snap = fresh ? null : SEED_CACHE.get(key);
  if(snap) SEED_STAT.hits++;
  else {
    SEED_STAT.misses++;
    snap = JSON.stringify(seed());
    SEED_CACHE.delete(key); SEED_CACHE.set(key, snap);
    while(SEED_CACHE.size > 3) SEED_CACHE.delete(SEED_CACHE.keys().next().value);
  }
  const st = JSON.parse(snap);
  defineViews(st);
  ST.state = st;
  return st;
};
ST.seedCache = () => ({size: SEED_CACHE.size, hits: SEED_STAT.hits, misses: SEED_STAT.misses});
ST.state = ST.seed();
```

(Прежние `ST.seed = () => …` и `ST.state = seed();` снимаются.) Прежде чем полагаться на
кэш, проверить `seed()` пробой: `JSON.parse(JSON.stringify(seed()))` равен исходному по
`JSON.stringify` (на `641fb9f` — да). Если `REF` или `NEIGHBOURS` названы в файле иначе —
взять фактические имена справочников и списка соседей.

- [ ] **Step 6: Надгробия `#184`…`#192` и переписка сторожей**

Блок `#184`…`#192` (~3568–3860) снимается вместе с подготовкой; заголовок блока остаётся с
пометкой «снят волной 23 (З-15b)». На месте каждого сторожа — надгробие:

```js
  /* #184 — снят волной 23 (З-15b): «разрежённость по факту — строк написано меньше, чем
     живых на даты прогона» больше не часть модели: строка каждый день открытого месяца
     (ИС-45 и ADR-0215 сняты ИС-54, ADR-0238 §1). Смысл «строк ровно по живым» держит #256.
     Номер не переиспользуется. */
```

Остальные — тем же образцом, со своим «что проверял» и держателем:

| № | что проверял | держит |
|---|---|---|
| `#185` | три ответа паспорта: есть · не менялось · подстановка | `#261` (два ответа) |
| `#186` | плотный слепок на закрытии, разрежённая середина | `#260` |
| `#187` | перезапись в открытом периоде с журналом | `#258` |
| `#188` | запись посреди периода: `skip` без досчёта | `#245` |
| `#189` | фиксация — свойство периода, а не набора строк | `#253`, `#22` |
| `#190` | одна дверь чтения: `rowsAt` ≠ `rowsAsOf` | `#256`, `#261` |
| `#191` | подпись фиксации — у защёлки периода | `#253`, `#15` |
| `#192` | плотность — свойство даты, у ряда её нет | `#261` (плотности нет вовсе) |

Переписать под своим номером (утверждение прежнее, числа — новой модели):

| № | стало |
|---|---|
| `#11` | плановых прогонов 111; пропуск 20.08 с причиной; прогон «догон» за 20.08; последний прогон 21.08 < `TODAY`; `q.date` = 21.08 |
| `#20` | дата пропуска отвечает СВОЕЙ строкой: срез на 20.08 — `asOf === '2026-08-20'`, `age === 0`; в журнале за 20.08 есть и пропуск, и догон. Поля `substituted`/`skipped` не читаются — их снимает З-15c. Текст: «ИС-12 для пропуска внутри истории заменён догоном (ADR-0238 §4)» |
| `#30` | база потока 16.07 — своя: `baseDate === '2026-07-16'`, `baseNote` без «вместо» |
| `#63` | `sum` — сумма `p.written`, а не `p.n`: «сумма по объектам (написано) = строк прогона» |
| `#130` | прогонных дат у кредита 112 (02.05…21.08, 20.08 — догоном), легаси 6, всего 118 |
| `#201` | кандидатов 30; `written` 42, из них `copied` 12; `same` 0; `skip` 34 (события); `written + skip === 76`. `sparse201` считается только по объектам-состояниям (`ST.storageOf`): 0 до закрытия и 0 после |
| `#202` | `flat202.written === 42`; `run202.written === flat202.written + 4` остаётся — четыре валютных события переписаны курсом, они ещё «при изменении» (`СС-167`) |
| `#206` | кандидатов 31; `same` 1; `copied` 11; `written` 42; `skip` 34 |
| `#209`…`#215` | доспрос на закрытии дописывает 0 строк: у каждого состояния строка первого числа уже есть; переписано — прежним счётом |
| `#228`, `#229` | `written` 42 вместо прежнего счёта разрежённой ночи |

Прочие сторожа, упавшие по счёту строк или ночи, — тем же правилом. Номер и «было → стало» —
строкой в «Ход работы». Сторож, упавший по ЗНАЧЕНИЮ величины, не переписывается: это дефект
копии или догона, его чинят в движке.

- [ ] **Step 7: Прогнать — зелёный целиком**

Expected: `exit=0`, 244/244 PASS (249 + 4 новых − 9 надгробий). Время смоука записать в «Ход
работы»: сид без кэша ~3 с; промахов кэша — не больше числа сторожей, правящих `RATES`/`WORLD`.

- [ ] **Step 8: Мутации**
1. В `doRun` копию писать только кандидатам (ветку `copyRow` заменить на `t.skip++; return;`)
   → `#256`.
2. В `ST.run` убрать `catchUp(…)` → `#257`; то же в `ST.catchUp` (вернуть `dates` без прогона)
   → `#257`.
3. В `catchUp` передать `keepT: false` → `#257` (`T1 !== T0`).
4. В `doRun` при существующей строке на дату писать новую (`st.rows.push(row)` вместо
   `st.rows[i] = row`) → `#258`.
5. В `ST.seed` отдавать объект из кэша без копии (хранить объект, а не строку) → `#259`.
6. Из `seedPrint` убрать `RATES` → `#259`.

- [ ] **Step 9: Коммит** — `Статистика: волна 23 З-15b — строка каждый день: копия, догон, кэш демо-мира`.
Тело: копия некандидату, догон без сдвига T, пропуск по календарю (ADR-0245 §6), кэш сида;
сторожа #256…#259, надгробия #184…#192, переписанные — поимённо в «Ход работы».

### Task 3c: З-15c — закрытый месяц хранит первые числа: закрытие в две фазы, «не хранится», повторное открытие (`ИС-54`, `ИС-12` сужен; `ADR-0238` §3, §5; `ADR-0245` §7)

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `repoll` (~5125);
  - новые `periodBlockers`, `dropDays`, `closeMonth` — после `closeLayer` (~5250);
  - `ST.closePeriod` (~5636–5680), `ST.reopenPeriod` (~5758–5800), `ST.run` (~5802);
  - `gapsBefore` (З-15b);
  - `seed()` — закрытия мая и июня (~5540–5556);
  - `storedOn`, `notStored` — перед `datesOf` (~5945); `datesOf`, `resolveAsOf`, `rowsAsOf`, `dateGate`;
  - паспорт: `densityNote` (~6345), `skipNote` (~6442), `passportFor` (~6521), точки ряда (~6932–6956),
    `ST.flowBetween` (~7300), `ST.periodBlockers` (~7341);
  - экраны: `passportHtml` (~8353–8387), таблица ряда (~8761–8765), подпись ~8851, плитки ~8909,
    вариант базы потока ~8872.
- Modify: `scripts/inspect/statistics-check.mjs`: блок З-15c (`#260`…`#263`), переписка из Step 6.

**Interfaces:**
- Consumes: `storageOf`, `doRun(…, how)`, `REOPEN_SCAN`, `NIGHTLY`, `gapsBefore` (З-15b);
  `periodOf`, `sliceOfMonth`, `preLaunch`, `dayShift` (З-15a).
- Produces:
  - `repoll(st, month, who, atISO, silent)` → `{ok, nbs, mute: [{obj, ref, nbs}], made, again, written, parts}`;
  - `periodBlockers(st, month)` → `{blockers, warnings, at}`;
  - `dropDays(st, month, atISO, who)` → `{at, by, rows, rewrites, queue, shifted}`; отметка
    `daysDropped` в строке календаря;
  - `closeMonth(st, month, who, atISO, silent)`, через неё `ST.closePeriod` →
    `{ok, month, layer, fixed, made, filled, refreshed, dropped, repoll, by, order}`; поля `dense` нет;
    отказ → `{ok:false, blockers, mute, repoll, made, filled, refreshed, why}`;
  - `storedOn(st, objId, d)`, `notStored(st, objId, d)` → `null | {month, prev, next, legacy}`,
    дверь `ST.notStored(d, objId)`;
  - `resolveAsOf` → `{asOf, age, edition}` (поля `substituted` нет);
  - паспорт без `substituted`, `dense`, `carried`, `density`, `skipped`; `p.base = {requested, asOf}`;
  - отказ потока `{ok:false, notStored, why}`;
  - `ST.reopenPeriod(…)` → дополнительно `recount: {date, written, rewrote}`; вид прогона
    «повторное открытие».

- [ ] **Step 1: Падающие сторожа `#260`…`#263`**

Перед `/* ---- отчёт ---- */`, после блока З-15b:

```js
/* ===== Волна 23 · З-15c — закрытый месяц хранит первые числа (ИС-54, ADR-0238 §3, §5,
   ADR-0245 §7). Закрытие — в две фазы: доспрос первым, потом проверка неполноты ИТОГА,
   потом одним шагом простановка, удаление дней и фиксация. Дата внутри закрытого месяца
   «не хранится» и ближайшей предыдущей не подменяется (ИС-12 сужен). ===== */
(() => {
  const stor = id => ST.storageOf ? ST.storageOf(id) : null;
  const nsOf = (d, o) => ST.notStored ? ST.notStored(d, o) : null;
  /* #260 — закрытие в две фазы. Доспрос идёт первым и не откатывается; запирает неполнота
     ИТОГА — строк первого числа, — а неполнота промежуточного дня не запирает: закрытие этот
     день удаляет вместе с его записями перезаписей и выполненными заданиями. Невыполненные
     задания переезжают на первый открытый день (ADR-0245 §7, ADR-0238 §3). */
  ST.seed();
  const st260 = ST.state, who260 = 'Мамбетов Э., администратор статистики';
  const mute260 = {'кураторство': 'недоступен'};
  const S260 = '2026-08-01';
  const isState = r => stor(r.obj) === 'state';
  const inJul = r => ST.periodOf(r.date) === '2026-07';
  ST.run('2026-07-20', {silent: mute260});
  ST.run('2026-07-20');
  const doneJul = st260.queue.filter(q => q.done && ST.periodOf(q.at) === '2026-07').length;
  ST.run('2026-07-21', {silent: mute260});
  const open260 = st260.queue.filter(q => !q.done && q.why === 'дозаполнение').length;
  const inc260 = st260.rows.filter(r => r.date === '2026-07-21' &&
    Object.keys(r.srcs || {}).some(k => (r.srcs[k] || {}).reason)).length;
  ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
  const days0 = st260.rows.filter(r => isState(r) && inJul(r)).length;
  const ev0 = st260.rows.filter(r => !isState(r) && inJul(r)).length;
  const no260 = ST.closePeriod('2026-07', who260, mute260);
  const days1 = st260.rows.filter(r => isState(r) && inJul(r)).length;
  const closedAfterNo = ST.isClosed('2026-07-15');
  const muteObjs = new Set((no260.mute || []).map(m => m.obj));
  const yes260 = ST.closePeriod('2026-07', who260);
  const left260 = st260.rows.filter(r => isState(r) && inJul(r));
  const alive260 = st260.objects.filter(o => stor(o.id) === 'state')
    .reduce((n, o) => n + ST.registryList(o.id, S260).length, 0);
  const ev1 = st260.rows.filter(r => !isState(r) && inJul(r)).length;
  const runs0720 = st260.runs.filter(r => r.date === '2026-07-20' && r.parts);
  const clean0720 = runs0720.every(r => r.parts.filter(p => stor(p.obj) === 'state')
    .every(p => !p.rewrote.length && !p.filled.length));
  const doneLeft = st260.queue.filter(q => q.done && ST.periodOf(q.at) === '2026-07').length;
  const openAfter = st260.queue.filter(q => !q.done && q.why === 'дозаполнение');
  const cal260 = ST.calendar().find(p => p.month === '2026-07') || {};
  ok(260, doneJul > 0 && open260 > 0 && inc260 > 0 &&
        !no260.ok && (no260.mute || []).length === ST.registryList('obj-borrower', S260).length &&
        muteObjs.size === 1 && muteObjs.has('obj-borrower') &&
        no260.mute.every(m => m.nbs.indexOf('кураторство') >= 0) &&
        has(no260.why, 'доспрос') && has(no260.why, 'Кураторство') &&
        has(no260.why, 'не откатывается') && has(no260.why, 'ADR-0245 §7') &&
        days1 === days0 && !closedAfterNo &&
        yes260.ok && !('dense' in yes260) && ST.isClosed('2026-07-15') &&
        left260.length === alive260 && left260.every(r => r.date === S260) &&
        ev1 === ev0 && runs0720.length === 3 && clean0720 &&
        doneLeft === 0 && openAfter.length === open260 && openAfter.every(q => q.at === '2026-08-02') &&
        !!cal260.daysDropped && cal260.daysDropped.rows === days0 - alive260,
    `закрытие в две фазы (ADR-0245 §7). Доспрос первым: «кураторство» на нём молчит — строк, собранных из молчания, ${(no260.mute || []).length} (все — заёмщики), они не написаны, и закрытие отбито: «${String(no260.why).slice(0, 140)}…». Дни не тронуты (${days1} из ${days0}), колонки нет. Повтор той же дверью проходит, хотя строки 21.07 неполны (${inc260}) и заданий дозаполнения ${open260}: запирает неполнота ИТОГА — строк 01.08.2026, — а промежуточный день закрытие удаляет. Осталось ${left260.length} строк состояний июля, все на ${S260} (живых ${alive260}); удалено ${cal260.daysDropped ? cal260.daysDropped.rows : '—'}. Строки событий июля не тронуты (${ev1} = ${ev0}). Журнал прогонов 20.07 на месте (${runs0720.length}), перезаписи за удалённый день сняты (${clean0720}); выполненных заданий июля ${doneLeft}, невыполненные (${openAfter.length}) переехали на 02.08. Поля «плотный слепок» у закрытия больше нет (ИС-54, ADR-0238 §3)`);

  /* #261 — дата внутри закрытого месяца «не хранится» и называет соседние хранимые срезы;
     ближайшая предыдущая не подставляется (ИС-12 сужен). Дата открытого месяца и первое
     число закрытого отвечают своими строками. События хранятся на каждую дату. */
  ST.seed();
  const q261 = d => ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: d});
  const mid261 = q261('2026-06-15');
  const ns261 = nsOf('2026-06-15', 'obj-credit') || {};
  const first261 = q261('2026-07-01');
  const open261 = q261('2026-07-15');
  const leg261 = nsOf('2026-02-15', 'obj-credit') || {};
  const legGate = ST.dateGate('2026-02-15', 'obj-credit');
  const gone261 = ['substituted','dense','carried','density','skipped']
    .filter(k => open261.passport && k in open261.passport);
  ok(261, !mid261.ok && has(mid261.why, 'не хранится') && has(mid261.why, '01.06.2026') &&
        has(mid261.why, '01.07.2026') && has(mid261.why, 'ИС-12') &&
        ns261.month === '2026-06' && ns261.prev === '2026-06-01' && ns261.next === '2026-07-01' &&
        first261.ok && first261.passport.asOf === '2026-07-01' && first261.passport.fixation === 'зафиксировано' &&
        open261.ok && open261.passport.asOf === '2026-07-15' && open261.passport.age === 0 &&
        leg261.prev === '2026-01-01' && leg261.next === '2026-04-01' && leg261.legacy === true &&
        has(legGate, 'не хранится') && ST.dateGate('2026-01-01', 'obj-credit') === null &&
        ST.dateGate('2026-06-15', 'obj-repay') === null && gone261.length === 0,
    `закрытый месяц хранит только итог — срез первого числа следующего (ИС-54, ADR-0238 §3). На 15.06 ответ «не хранится» с соседними хранимыми срезами (${ns261.prev} и ${ns261.next}) и дорогой к живому расчёту владельца: «${String(mid261.why).slice(0, 120)}…» — ближайшая предыдущая не подставляется (ИС-12 сужен). Первое число отвечает своей строкой и зафиксировано (${first261.ok ? first261.passport.fixation : '—'}), день открытого июля — своей, возраст ${open261.ok ? open261.passport.age : '—'}. До запуска то же правило: 15.02 лежит между легаси-итогами ${leg261.prev} и ${leg261.next}. Событие хранится на каждую дату — платёж на 15.06 отвечает. Полей подстановки и плотности у паспорта нет (${gone261.join(', ') || 'ни одного'})`);

  /* #262 — поток считается между хранимыми срезами. База внутри закрытого месяца —
     отказ «не хранится» с полем, а не подстановка; база в открытом месяце — своя. */
  ST.seed();
  const fq = (from, to) => ST.flowBetween({obj:'obj-credit', inds:'m-repaid', from, to});
  const f1 = fq('2026-06-15', '2026-07-16');
  const f2 = fq('2026-06-01', '2026-07-01');
  const f3 = fq('2026-06-01', '2026-06-20');
  const f4 = fq('2026-07-16', ASK);
  ok(262, !f1.ok && !!f1.notStored && f1.notStored.prev === '2026-06-01' && f1.notStored.next === '2026-07-01' &&
        has(f1.why, 'не хранится') &&
        f2.ok && f2.value === 379980 && f2.baseDate === '2026-06-01' &&
        has(f2.passport.baseNote, '01.06.2026') && !has(f2.passport.baseNote, 'вместо') &&
        !f3.ok && has(f3.why, 'не хранится') &&
        f4.ok && f4.baseDate === '2026-07-16' && f4.passport.base.asOf === '2026-07-16' &&
        !('named' in f4.passport.base),
    `поток — разность двух ХРАНИМЫХ срезов. Погашено за июнь — от итога мая (01.06) до итога июня (01.07): ${f2.ok ? f2.value : '—'} сом, база «${f2.ok ? f2.passport.baseNote : '—'}» без подстановки. База 15.06 не хранится — отказ с соседними срезами (${f1.notStored ? f1.notStored.prev + ' и ' + f1.notStored.next : '—'}), а не «база 01.06 вместо 15.06»; конец 20.06 — тот же отказ. База в открытом июле своя: ${f4.ok ? f4.baseDate : '—'} (ИС-12 сужен, ИС-54, ADR-0238 §3)`);

  /* #263 — повторное открытие: дни не восстанавливаются, итог пересчитывается прогоном
     «повторное открытие» — полный обход, только состояния, `T` соседей не двигается
     (ADR-0238 §5, ADR-0245 §2). */
  ST.seed();
  const st263 = ST.state;
  const R263 = vm.runInContext('RATES', sandbox);
  const Ts263 = () => JSON.stringify(ST.polls().map(p => [p.nb, p.T]));
  const T0263 = Ts263();
  const may0 = st263.rows.filter(r => stor(r.obj) === 'state' && ST.periodOf(r.date) === '2026-05' && !ST.isLegacyRow(r)).length;
  let re263, rec263, usd263, run263, ns263;
  /* Курс «на 31.05» уточнён после закрытия мая: вставка сразу за прежней записью той же даты
     — `rateOn` берёт последнюю подходящую, и запись в хвосте списка испортила бы июнь–август. */
  R263.USD.splice(1, 0, ['2026-05-31', 90.00]);
  try {
    re263 = ST.reopenPeriod('2026-05', {no:'Р-2026/112', basis:'уточнён курс НБКР на 31.05.2026'}, 'Осмонова Г., главный бухгалтер');
    rec263 = st263.runs.filter(r => r.kind === 'повторное открытие');
    usd263 = ((ST.rowsAt('obj-credit', '2026-06-01').find(r => r.ref === 'КД-2025/043') || {inds: {}}).inds['m-debt']) || {};
    run263 = ST.run('2026-05-15');
    ns263 = nsOf('2026-05-15', 'obj-credit');
  } finally { R263.USD.splice(1, 1); }
  const may1 = st263.rows.filter(r => stor(r.obj) === 'state' && ST.periodOf(r.date) === '2026-05' && !ST.isLegacyRow(r));
  ok(263, re263.ok && !!re263.recount && re263.recount.date === '2026-06-01' &&
        re263.recount.rewrote.some(x => x.ref === 'КД-2025/043') &&
        rec263.length === 1 && rec263[0].date === '2026-06-01' && rec263[0].cand.scan === 'полный' &&
        has(rec263[0].cand.why, 'ADR-0238 §5') &&
        rec263[0].parts.filter(p => stor(p.obj) !== 'state').every(p => p.written === 0) &&
        usd263.rate === 90 && usd263.rateDate === '2026-05-31' &&
        Ts263() === T0263 && may1.length === may0 && may1.every(r => r.date === '2026-06-01') &&
        !run263.ok && has(run263.why, 'не восстанавливаются') && has(run263.why, 'ИС-54') &&
        !!ns263 && ns263.next === '2026-06-01',
    `повторное открытие мая (${re263.ok ? 'распоряжение ' + re263.order : re263.why}) дней не восстанавливает: строк состояний мая ${may1.length}, все на 01.06, — мир за 15.05 уже не спросить. Итог пересчитан прогоном «повторное открытие» на ${re263.recount ? re263.recount.date : '—'}: обход полный с причиной, события не тронуты, T соседей не сдвинут (${Ts263() === T0263}); уточнённый курс лёг в итог (КД-2025/043: ${usd263.rate} от ${usd263.rateDate}). Прогон за удалённый день отбит: «${String(run263.why).slice(0, 110)}…», и 15.05 по-прежнему «не хранится» (ИС-54, ADR-0238 §5)`);
})();
```

- [ ] **Step 2: Прогнать — `#260`…`#263` падают**

Expected:
- `FAIL #260`: доспрос с молчанием отбивает закрытие без перечня строк; повторное закрытие
  дни не удаляет, поле `dense` на месте.
- `FAIL #261`: `ST.notStored` нет; на 15.06 — подстановка 01.06 с возрастом.
- `FAIL #262`: база 15.06 подставлена, поля `notStored` нет.
- `FAIL #263`: `recount` нет; прогона «повторное открытие» нет; прогон за 15.05 не отбит.

- [ ] **Step 3: Движок — доспрос первым, неполнота итога, удаление дней**

`repoll` — новое тело. Слова словаря `#5` в комментариях не встречаются.

```js
function repoll(st, month, who, atISO, silent){
  /* Итог месяца — строки состояний на первое число следующего (ADR-0245 §9, ИС-54). У
     событий итога на дату нет: их строки и есть месяц, и доспрашивать по ним нечего
     (ADR-0239). */
  const dateISO = sliceOfMonth(month);
  const nbs = repollNbs(st, month, silent);
  let made = 0, again = 0, written = 0;
  const parts = [], mute = [];
  /* ДОСПРОС ИДЁТ ПЕРВЫМ И ВНЕ ТРАНЗАКЦИИ ЗАКРЫТИЯ (ADR-0245 §7). Всё, что он узнал, пишется
     и при отказе НЕ ОТКАТЫВАЕТСЯ: дописанное и переписанное — правда о сегодняшнем мире, и
     стирать её ради отказа значило бы снова спрашивать то, на что уже ответили. Строка,
     собранная из МОЛЧАНИЯ, не пишется вовсе: известное не стирается (ADR-0208 §3), а
     подписаться под недоспрошенным нельзя, — она идёт в перечень, и отказ его печатает.
     Прежний порядок «сперва неполнота, потом доспрос» (ADR-0208 §4) снят: неполноту
     проверяют ПОСЛЕ доспроса, иначе отказ приходил бы по строкам, которые доспрос починил бы. */
  st.objects.forEach(o => {
    const t = newTally();
    if(storageOf(o.id) !== 'state'){ parts.push(partOf(o, t)); return; }
    eachAlive(o, dateISO, t, item => {
      const i = st.rows.findIndex(r => r.obj === o.id && r.ref === item.id && r.date === dateISO);
      if(i >= 0 && st.rows[i].fixed){ t.kept++; return; }
      const row = buildRow(o.id, item, dateISO, silent);
      row.by = 'защёлка';
      const nb = silentOf(row);
      if(nb.length){ mute.push({obj: o.id, ref: item.id, nbs: nb}); t.partial++; return; }
      if(i < 0){ st.rows.push(row); t.n++; t.written++; made++; written++; return; }
      const ch = rowDiff(st.rows[i], row);
      if(!ch.length){ t.have++; return; }
      const sp = splitDiff(st.rows[i], row, ch);
      if(sp.rewrote.length) t.rewrote.push({ref: item.id, fields: sp.rewrote});
      if(sp.filled.length)  t.filled.push({ref: item.id, fields: sp.filled});
      st.rows[i] = row; t.n++; t.written++; again++; written++;
    });
    parts.push(partOf(o, t));
  });
  /* Запись журнала делается всегда: доспрос СОСТОЯЛСЯ, даже если кончился отказом, — а
     «доспрос не отвечен» и «закрытия не пробовали» разные ночи. Обход объявлен полным
     (ADR-0221 §3); суточный итог складывается одним способом (проверка #63). */
  st.runs.push({date: dateISO, kind:'защёлка', at: atISO, actor: who,
    reason: 'доспрос перед закрытием периода '+monLabel(month)+(mute.length ? ': не отвечено' : ''),
    written, parts, repoll: {nbs, made, again, mute: mute.length, done: !mute.length},
    cand: {scan:'полный', why: LATCH_SCAN, from:null, n:0, by:{}, polls:[], moved:[]}});
  return {ok: !mute.length, nbs, mute, made, again, written, parts};
}
```

После `closeLayer`:

```js
/* ЧТО ЗАПИРАЕТ ЗАКРЫТИЕ (ADR-0245 §7, СС-168). Неполнота ИТОГА: строк состояний на последнюю
   хранимую дату периода — первое число следующего, а у идущего месяца последний прогон, —
   и строк событий месяца. Неполнота промежуточного дня закрытия не запирает: закрытие этот
   день удаляет (ADR-0238 §3). Пропуск — предупреждение, и оно говорит, догнан ли он: дыры
   в строках после догона нет, а ночь в журнале осталась (ИС-20, ADR-0238 §4). */
function periodBlockers(st, month){
  const S = sliceOfMonth(month);
  const warnings = st.runs.filter(r => r.kind === 'пропуск' && periodOf(r.date) === month).map(s => {
    const cu = st.runs.find(r => r.kind === 'догон' && r.date === s.date);
    return 'прогон за '+fmt(s.date)+' не состоялся: '+s.reason+
      (cu ? ' · догнан перед ночью '+fmt(cu.before) : ' · не догнан');
  });
  const own = st.rows.filter(r => storageOf(r.obj) === 'state' && periodOf(r.date) === month && !isLegacyRow(r));
  const last = own.some(r => r.date === S) ? S : (own.map(r => r.date).sort().slice(-1)[0] || null);
  const bad = st.rows.filter(r => periodOf(r.date) === month && silentOf(r).length &&
    (storageOf(r.obj) === 'state' ? r.date === last : true));
  /* Перечень ПЕЧАТНЫЙ и сгруппирован по СОСЕДУ — единице, с которой разговаривают
     (ADR-0208, последствия). */
  const by = {};
  bad.forEach(r => silentOf(r).forEach(nb => {
    const k = by[nb] || (by[nb] = {nb, reasons:[], objs:{}, n:0});
    k.n++;
    k.objs[r.obj] = (k.objs[r.obj] || 0) + 1;
    const why = r.srcs[nb].reason;
    if(k.reasons.indexOf(why) < 0) k.reasons.push(why);
  }));
  const blockers = Object.keys(by).map(nb => {
    const k = by[nb];
    const objs = Object.keys(k.objs).map(id => (OBJ(id) || {name:id}).name+' — '+k.objs[id]);
    return {nb, n: k.n, reasons: k.reasons, objs: Object.keys(k.objs),
      text: 'сосед «'+nb+'» не ответил ('+k.reasons.join(', ')+'): строк — '+k.n+
            ' по объектам '+objs.join(' · ')};
  }).sort((a, b) => b.n - a.n);
  return {blockers, warnings, at: last};
}
/* УДАЛЕНИЕ ДНЕЙ (ИС-54, ADR-0238 §3). Закрытый месяц хранит итог — строку первого числа
   следующего. Промежуточные дни удаляются вместе с тем, что о них говорит: записями
   перезаписей (переписывать больше нечего) и выполненными заданиями очереди. Невыполненное
   задание переезжает на первый открытый день: работа не пропадает оттого, что день её
   постановки удалён. Строки событий и легаси не трогаются — первые и есть месяц, вторые
   пришли выпуском на первые числа. Записи прогонов остаются: ночь была. */
function dropDays(st, month, atISO, who){
  const S = sliceOfMonth(month), next = dayShift(S, 1);
  const gone = r => storageOf(r.obj) === 'state' && periodOf(r.date) === month &&
                    r.date !== S && !isLegacyRow(r);
  const rows = st.rows.filter(gone).length;
  st.rows = st.rows.filter(r => !gone(r));
  let rewrites = 0;
  st.runs.forEach(run => {
    if(!run.parts || run.date === S || periodOf(run.date) !== month) return;
    run.parts.forEach(p => {
      if(storageOf(p.obj) !== 'state') return;
      rewrites += p.rewrote.length + p.filled.length;
      p.rewrote = []; p.filled = [];
    });
  });
  const was = st.queue.length;
  st.queue = st.queue.filter(q => !(q.done && periodOf(q.at) === month));
  let shifted = 0;
  st.queue.forEach(q => { if(!q.done && periodOf(q.at) === month){ q.at = next; shifted++; } });
  const out = {at: atISO, by: who, rows, rewrites, queue: was - st.queue.length, shifted};
  /* Отметка в строке календаря — первая и единственная: повторное закрытие после
     повторного открытия удалять уже нечего, а «когда удалены дни» остаётся ответом первого. */
  const cal = calendarRow(st, month);
  if(!cal.daysDropped) cal.daysDropped = out;
  return out;
}
/* ЗАКРЫТИЕ МЕСЯЦА (ADR-0245 §7): ПРОВЕРИТЬ КАЛЕНДАРЬ · ДОСПРОСИТЬ · ПРОВЕРИТЬ ИТОГ ·
   ПРОСТАВИТЬ, УДАЛИТЬ ДНИ, ЗАФИКСИРОВАТЬ. Последние три — один шаг: колонка в общем
   справочнике без удалённых дней объявила бы закрытым месяц, который хранит все дни, а
   удалённые дни без колонки — открытый месяц с дырами. Одна функция на демо-мир и на
   человека: обойди её сид — сторож перестал бы что-либо доказывать. */
function closeMonth(st, month, who, atISO, silent){
  const pre = closeLayerCheck(st, month, MY_LAYER, who);
  if(pre) return pre;
  const rp = repoll(st, month, who, atISO, silent);
  const w = periodBlockers(st, month);
  const filled = rp.parts.reduce((n, p) => n + p.filled.length, 0);
  if(rp.mute.length || w.blockers.length){
    const byNb = {};
    rp.mute.forEach(m => m.nbs.forEach(nb => (byNb[nb] = byNb[nb] || []).push(m)));
    const muteText = Object.keys(byNb).map(nb => {
      const objs = {};
      byNb[nb].forEach(m => { objs[m.obj] = (objs[m.obj] || 0) + 1; });
      return '«'+(NB(nb) || {name: nb}).name+'» ('+((silent || {})[nb] || '—')+'): строк — '+byNb[nb].length+
        ' по объектам '+Object.keys(objs).map(id => (OBJ(id) || {name: id}).name+' — '+objs[id]).join(' · ');
    }).join(' · ');
    return {ok:false, blockers: w.blockers, mute: rp.mute, repoll: rp.nbs,
      made: rp.made, filled, refreshed: rp.again,
      why: 'период '+monLabel(month)+' не закрывается: '+
        (rp.mute.length ? 'на доспросе не ответил '+muteText+' — строки, собранные из молчания, не написаны' : '')+
        (rp.mute.length && w.blockers.length ? '; ' : '')+
        (w.blockers.length ? 'итог неполон — '+w.blockers.map(b => b.text).join(' · ') : '')+
        '. Доспрос идёт первым и не откатывается: дописано '+rp.made+', дозаполнено '+filled+
        ', переписано '+rp.again+'. Неполнота проверяется после него и по итогу — строкам '+
        fmt(sliceOfMonth(month))+'; промежуточные дни её не запирают, закрытие их удаляет '+
        '(ИС-46, ADR-0245 §7, ADR-0238 §3)'};
  }
  const r = closeLayer(st, month, MY_LAYER, who, atISO);
  if(!r.ok) return r;
  const dropped = dropDays(st, month, atISO, who);
  const n = fixMonth(st, month, who, atISO);
  return {ok:true, month, layer: MY_LAYER, fixed: n, made: rp.made, filled, refreshed: rp.again,
          dropped, repoll: rp.nbs, by: who, order: r.order};
}
```

`ST.closePeriod` — тело заменить. Длинный комментарий «ПОРЯДОК ЗАКРЫТИЯ… РУБЕЖ ПЕРВЫЙ…
РУБЕЖ ВТОРОЙ…» переписать под `ADR-0245` §7: рубеж один, после доспроса. Строка «прежний рубеж
снят» — со ссылкой на находку 1.

```js
ST.closePeriod = (month, who, silent) => {
  const st = ST.state;
  const r = closeMonth(st, month, who, st.today, silent || null);
  if(r.ok) log('период '+monLabel(month)+' закрыт ('+who+'): колонка «'+MY_LAYER+'» проставлена'+
    (r.order ? ' · повторно, распоряжение '+r.order : '')+' · доспрос дописал — '+r.made+
    ', дозаполнил — '+r.filled+', переписал — '+r.refreshed+' · удалено строк дней — '+r.dropped.rows+
    ' · зафиксировано строк — '+r.fixed);
  else if(r.mute) log('закрытие периода '+monLabel(month)+' отбито: '+r.why);
  return r;
};
ST.periodBlockers = month => periodBlockers(ST.state, month);
```

Прежнее тело `ST.periodBlockers` (~7341) снимается; его вводный комментарий (`ИС-20` сужена)
остаётся над новым `periodBlockers`.

`gapsBefore` (З-15b) — пропускать и месяцы с удалёнными днями:
`const cal = calendarRow(st, periodOf(d)); if(!latchOf(st, periodOf(d), MY_LAYER) && !(cal && cal.daysDropped)) out.push(d);`.

`seed()`, закрытия мая и июня:

```js
  [['2026-05', ['2026-06-05','2026-06-07','2026-06-08']],
   ['2026-06', ['2026-07-06','2026-07-08','2026-07-09']]].forEach(p => {
    LAYERS.slice(0, -1).forEach((L, i) => closeLayer(st, p[0], L, ACTORS[L], p[1][i]));
    /* Верхняя колонка — ТОЙ ЖЕ функцией, что у человека: доспрос, проверка итога,
       простановка, удаление дней, фиксация (ADR-0245 §7). */
    const r = closeMonth(st, p[0], ACTORS[MY_LAYER], p[1][LAYERS.length - 1], null);
    if(!r.ok) throw new Error('демо-мир: закрытие '+p[0]+' отбито — '+r.why);
  });
```

- [ ] **Step 4: Движок — «не хранится», чтение ровно на дату, паспорт без подстановки**

Перед `datesOf`:

```js
/* ХРАНИТСЯ ЛИ ДАТА (ИС-12 сужен, ИС-54, ADR-0238 §3). Состояние хранится на каждую дату
   открытого месяца, у закрытого — только на первое число следующего (его итог); до запуска
   — только легаси-итоги на первых числах. Событие хранится на любую дату: его строки и
   есть месяц. Дата, которая не хранится, ближайшей предыдущей НЕ подменяется: «как было
   15.06» отвечает живой расчёт владельца, а не срез. */
function storedOn(st, objId, d){
  if(storageOf(objId) !== 'state') return true;
  if(preLaunch(d)) return st.rows.some(r => r.obj === objId && r.date === d && isLegacyRow(r));
  const cal = calendarRow(st, periodOf(d));
  return cal && cal.daysDropped ? d === sliceOfMonth(periodOf(d)) : true;
}
function notStored(st, objId, d){
  if(storedOn(st, objId, d)) return null;
  const side = datesOf(st, objId).filter(x => preLaunch(x) === preLaunch(d));
  return {month: periodOf(d), prev: side.filter(x => x < d).slice(-1)[0] || null,
          next: side.find(x => x > d) || null, legacy: preLaunch(d)};
}
ST.notStored = (d, objId) => notStored(ST.state, objId || ST.state.q.obj, d);
```

`datesOf`: последней строкой `return uniq(runs.concat(leg)).filter(d => storedOn(st, objId, d)).sort();`
и строка к комментарию: «дата прогона в закрытом месяце хранится только первым числом:
остальные удалены закрытием (ИС-54)».

`resolveAsOf` — новое тело, комментарий переписать под `ИС-12` сужен:

```js
function resolveAsOf(st, objId, requested){
  if(!storedOn(st, objId, requested)) return null;
  const ds = datesOf(st, objId).filter(d => d <= requested && preLaunch(d) === preLaunch(requested));
  if(!ds.length) return null;
  const asOf = ds[ds.length - 1];
  /* Состояние отвечает РОВНО своей датой: строка есть на каждую хранимую дату, и подставлять
     нечего (ИС-54). Нет прогона на эту дату — ответа нет, а не вчерашний. */
  if(storageOf(objId) === 'state' && asOf !== requested) return null;
  return {asOf, age: daysBetween(asOf, requested), edition: preLaunch(asOf) ? FORM.LEGACY : FORM.NOW};
}
```

`rowsAsOf` — первой строкой тела, с комментарием «Состояние читается строками ровно своей
даты: переносить вперёд нечего (ИС-45 снят ИС-54, ADR-0238 §1)»:
`if(storageOf(objId) === 'state') return st.rows.filter(r => r.obj === objId && r.date === dateISO);`
Ветка событий остаётся прежней до З-16a; «ГРАНИЦА, названная вслух» в комментарии теперь
про события.

`dateGate` — сразу после отказа `side` (стороны запуска):

```js
  /* ИС-12 СУЖЕН (ИС-54, ADR-0238 §3): дата между двумя хранимыми срезами — «не хранится».
     Подстановки ближайшей предыдущей больше нет: у закрытого месяца хранится только итог, и
     «на 15.06» ответ итогом мая выдал бы майское число за июньское. */
  const ns = notStored(st, objId, requested);
  if(ns && ns.prev && ns.next) return 'на '+fmt(requested)+' строки не хранится: '+
    (ns.legacy ? 'до запуска '+fmt(LAUNCH)+' хранятся только легаси-итоги на первых числах кварталов'
               : 'месяц '+monLabel(ns.month)+' закрыт, а закрытый месяц хранит только итог — срез на первое число следующего')+
    '. Ближайшие хранимые срезы — '+fmt(ns.prev)+' и '+fmt(ns.next)+'; «как было '+fmt(requested)+
    '» отвечает живой расчёт владельца «'+(o ? o.owner : '—')+'», а не срез. Ближайшая предыдущая '+
    'не подставляется (ИС-12 сужен, ИС-54, ADR-0238 §3)';
```

Паспорт (`СС-168`, `ИС-54`):
- `passportFor`: снять `substituted`, `dense`, `carried`, `density`, `skipped`; абзац
  комментария про разрежённое хранение переписать: «ответ собран строками своей даты».
- `densityNote` и `skipNote` удалить. На их месте:
  `/* densityNote, skipNote — сняты волной 23 (З-15c): плотности и подстановки больше нет — строка на каждую хранимую дату (ИС-45 и ИС-12 в прежнем виде сняты ИС-54, ADR-0238 §1, §3). */`
- Точки ряда (~6932): снять `substituted`, `dense`, `carried`, `density`; строку
  `p.dense = null; …` и её комментарий снять.
- `passportHtml`: `cls` — без `p.substituted`; строка «Дата расчёта» — без плашки «спрошено…»;
  строки «Плотность» и «Почему не на дату» снять вместе с комментариями.
- Таблица ряда (~8761–8765): без плашки «строк нет, взято…» и без «не менялось — N».
- Подпись ~8851: предложение про «пишется при изменении» снять.
- Плитки ~8909: `r.passport.partial ? 'warn' : ''`.

`ST.flowBetween`, после отказа `tail`:

```js
  /* База потока — ХРАНИМЫЙ срез (ИС-54). База между хранимыми срезами не подменяется
     ближайшей предыдущей: отказ называет соседние и отдаёт их полем (ИС-12 сужен). */
  const nsFrom = notStored(st, q.obj, q.from);
  if(nsFrom) return {ok:false, notStored: nsFrom, why:'база периода '+fmt(q.from)+' не хранится: '+
    'ближайшие хранимые срезы — '+fmt(nsFrom.prev)+' и '+fmt(nsFrom.next)+'. Поток считается '+
    'между хранимыми срезами — разностью двух итогов (ИС-12 сужен, ИС-54, ADR-0238 §3)'};
```

Ниже: `p.base = a ? {requested: q.from, asOf: a.asOf} : null;` и
`p.baseNote = a ? 'база периода: '+fmt(a.asOf) : 'строки на начало периода нет — период считается от рождения объекта';`.
Вариант базы потока на экране (~8872, после З-15a `2026-05-13`) → `2026-06-01` / `01.06.2026`
(«итог мая»): 13.05 теперь не хранится.

- [ ] **Step 5: Движок — повторное открытие и прогон за удалённый день**

`ST.reopenPeriod`, после `const marked = markExports(…)`:

```js
  /* ИТОГ ПЕРЕСЧИТЫВАЕТСЯ, ДНИ НЕ ВОССТАНАВЛИВАЮТСЯ (ADR-0238 §5). Строку первого числа
     следующего месяца переписывает прогон «повторное открытие»: полный обход, только
     состояния, `T` соседей не двигается — он удостоверяет прошлую дату, а не приращает
     (ADR-0245 §2). Удалённые дни восстанавливать не из чего: мир за те даты уже не
     спросить. Открытые дни после первого числа пересчитывает retro (З-22). */
  let recount = null;
  if(dropped.indexOf(MY_LAYER) >= 0 && row.daysDropped){
    const S = sliceOfMonth(month);
    doRun(st, S, 'повторное открытие', who, 'пересчёт итога '+monLabel(month)+' по распоряжению '+order.no,
          null, {full: true, keepT: true, statesOnly: true, why: REOPEN_SCAN});
    const rec = st.runs[st.runs.length - 1];
    recount = {date: S, written: rec.written,
      rewrote: rec.parts.reduce((a, p) => a.concat(p.rewrote.map(x => Object.assign({obj: p.obj}, x))), [])};
  }
```

В запись `row.reopens` и в ответ добавить `recount`; в строку журнала —
`'; итог пересчитан на '+fmt(recount.date)+' — переписано '+recount.rewrote.length` (если `recount`).

`ST.run`, сразу после отказа `ST.isClosed`:

```js
  const calD = calendarRow(st, periodOf(dateISO));
  if(calD && calD.daysDropped && dateISO !== sliceOfMonth(periodOf(dateISO)))
    return {ok:false, why:'дни '+monLabel(periodOf(dateISO))+' удалены при закрытии ('+calD.daysDropped.by+
      ', '+fmt(calD.daysDropped.at)+') и не восстанавливаются: закрытый месяц хранит итог — срез на '+
      fmt(sliceOfMonth(periodOf(dateISO)))+', а мир за '+fmt(dateISO)+' уже не спросить. Итог '+
      'пересчитывает повторное открытие (ИС-54, ADR-0238 §5)'};
```

- [ ] **Step 6: Прогнать; переписать сторожей прежней модели**

Правило то же, что в Task 1 Step 16. Ожидаемо падают и переписываются под своим номером:

| № | было → стало |
|---|---|
| `#15` | `done.fixed > 0` остаётся; добавить `done.dropped.rows > 0` — закрытие удалило дни |
| `#17` | предупреждение о пропуске 20.08 говорит «догнан перед ночью 21.08.2026»; блокировка — по строкам последней даты периода (21.08), число — прежнее |
| `#20` | переписан в З-15b; снять обращения к `substituted`/`skipped`, если остались |
| `#88` | даты рождения внутри периода — по факту (строки на каждую дату) |
| `#130` | прогонных дат у кредита 53 (01.06, 01.07, 02.07…21.08), легаси 6, всего 59 |
| `#131` | `now.passport.substituted === false` снять |
| `#132` | по факту, если упал на составе дат |
| `#138`, `#139` | `c.fixed > 0` остаётся; `ST.isClosed('2026-08-01')`; по факту |
| `#141`…`#147` | перезакрытие: `unfixed` — число строк первого числа, а не месяца; в ответе `recount`; счёт по факту |
| `#193` | по факту |
| `#198` | молчание прогона 01.08 доспрос чинит сам, и закрытие проходит. Отказ теперь даёт молчание НА доспросе: `ST.closePeriod('2026-07', who, {'классификация':'ответил ошибкой'})` → отказ с перечнем («Классификация», «ответил ошибкой», «Кредит — 8», `ADR-0245 §7`); повтор без молчания → `ok`, `filled > 0` |
| `#200` | блокировок — по строкам последней даты периода; по факту |
| `#201` | после закрытия `sparse201` = 0 и строки месяца — только первое число |
| `#211`, `#212` | `dense` → `made` (0: строка первого числа уже есть), `refreshed` прежний; `j212.repoll.made === 0`, `j212.written === j212.repoll.again` |
| `#213` | отказ — на доспросе: `mute` — строки `{obj, ref, nbs}`, текст — «на доспросе не ответил», `ADR-0245 §7`; число записей журнала `+1` остаётся |
| `#214`…`#216`, `#218` | по факту: закрытие теперь удаляет дни, чтение — ровно на дату |
| `#224` | по факту |
| `#226` | прогонных дат 53, всего 59; ответ на дату внутри закрытого мая — «не хранится» |
| `#227` | разрыв редакций — у точки `'2026-07-01'` (после сдвига З-15a); по факту |
| `#228` | по факту |

Остальные упавшие — тем же правилом, строкой в «Ход работы». Сторож, упавший по значению
итога первого числа, не переписывается: это дефект доспроса или удаления дней.

Expected: `exit=0`, 248/248 PASS (244 + 4).

- [ ] **Step 7: Мутации**
1. В `closeMonth` не звать `dropDays` → `#260`.
2. В `periodBlockers` вернуть фильтр `periodOf(r.date) === month` без условия `r.date === last`
   (неполнота промежуточного дня запирает) → `#260`.
3. В `closeMonth` поставить `periodBlockers` перед `repoll` → `#260`.
4. `storedOn` → всегда `true`, `resolveAsOf` — прежняя подстановка ближайшей предыдущей → `#261`.
5. В `ST.flowBetween` снять отказ `nsFrom` → `#262`.
6. В `ST.reopenPeriod` не звать `doRun` → `#263`; передать `keepT: false` → `#263`.
7. В `ST.run` снять отказ за удалённый день → `#263`.

- [ ] **Step 8: Коммит** — `Статистика: волна 23 З-15c — закрытый месяц хранит первые числа, «не хранится» вместо подстановки`.
Тело: закрытие в две фазы по ADR-0245 §7, удаление дней, «не хранится» (ИС-12 сужен),
повторное открытие; сторожа #260…#263; переписанные — поимённо в «Ход работы».

### Task 4a: З-16a — событие дельтой: адрес `part`, дата по привязке, поправка в месяце исправления, запрет записи (`ИС-55`, `ADR-0239` §1–§4)

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `REGISTRY` — `d-pbdate`, `d-paystate` рядом с `d-pdate` (~1965);
  - `OBJECTS` — `obj-repay` (~2593), `obj-receipt` (~2605);
  - `WORLD['obj-repay']` (~2966) — поля `bdate`, `pstate` у 14 платежей;
  - `CORE.payOn`, `CORE.repaidOf` (~3285), `CORE.receiptSplit` (~3612);
  - `RELEASE.tables['obj-repay']` (~3893);
  - `bornOn` (~4347), `buildRow` (~4442), `ST.ROW_SHAPE`/`ST.ROW_KEY` с комментарием (~4497–4532),
    комментарий `FORM` (~5304);
  - `scanPlan` (~4722);
  - новые `writeRow`, `eventSliceOf`, `eventRow`, `cents`, `scaleCell`, `addCell`, `negRow`,
    `voided`, `deltaAt`, `deltaNight` — между `catchUp` (З-15b) и `function doRun`;
  - `doRun`, `repoll`, `loadLegacy` — запись через `writeRow`;
  - `FIRST_OWN` рядом с `LAUNCH`; `seed()` — `markers: []`; `ST.markers`;
  - `rowsAsOf` — ветка `event_delta`.
- Modify: `scripts/inspect/statistics-check.mjs`: блок З-16a (`#264`…`#268`), переписка из Step 6.

**Interfaces:**
- Consumes: `storageOf`, `copyRow`, `catchUp` (З-15b); `repoll`, `periodBlockers`, `closeMonth` (З-15c);
  `periodOf`, `dayShift`, `worldAt` (З-15a).
- Produces:
  - строка с полем `part`: `ST.ROW_SHAPE = ['obj','ref','date','part','dims','inds','when','srcs','fixed','by']`,
    `ST.ROW_KEY = ['obj','ref','date','part']` (`СС-170`);
  - реквизиты объекта `evDay`, `evState`, `corr`, `voidIf` (`СС-171`);
  - `writeRow(st, row, opts)` → `{ok, replaced} | {ok:false, why}`;
  - `deltaAt(st, objId, ref, D)` → действующая строка события на дату;
  - `st.markers` и дверь `ST.markers()` — маркеры `corrected_later`;
  - `CORE.payOn(p, d)` → `{credit, state, at}`;
  - записи реестра `d-pbdate`, `d-paystate` (`СС-176`).

- [ ] **Step 1: Падающие сторожа `#264`…`#268`**

Перед `/* ---- отчёт ---- */`, после блока З-15c:

```js
/* ===== Волна 23 · З-16a — событие дельтой (ИС-55, ADR-0239). Способ хранения — реквизит
   релиза; строка события ложится на срез дня, когда событие стало известно; в открытом
   месяце правка переписывает строку на месте, в закрытом — поправки в месяце исправления
   и маркер «исправлено позже». В закрытое не пишет никто — у всех таблиц одной функцией. ===== */
(() => {
  const stor = id => ST.storageOf ? ST.storageOf(id) : null;
  const W = vm.runInContext('WORLD', sandbox);
  const v = (r, id) => (((r || {}).inds || {})[id] || {}).v;
  const closeJuly = () => {
    ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
    ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
    return ST.closePeriod('2026-07', 'Мамбетов Э., администратор статистики');
  };

  /* #264 — три способа хранения из релиза; у событий нет ни копий, ни удаления при закрытии;
     адрес строки — четыре поля, `part` у состояния пуст, у события-дельты — вид поправки. */
  ST.seed();
  const R264 = vm.runInContext('RELEASE', sandbox), O264 = vm.runInContext('OBJECTS', sandbox);
  const ids264 = Object.keys(R264.tables);
  const off264 = ids264.filter(id => stor(id) !== R264.tables[id].storage);
  const own264 = O264.filter(o => 'storage' in o).map(o => o.id);
  const ev264 = ids264.filter(id => stor(id) !== 'state').sort().join();
  const evCopies = ST.state.runs.filter(r => r.parts).reduce((n, r) =>
    n + r.parts.filter(p => stor(p.obj) !== 'state').reduce((m, p) => m + (p.copied || 0), 0), 0);
  const june = ['ПГ-2026/1102','ПГ-2026/1118','ПГ-2026/1127','ПГ-2026/1133'];
  const juneRows = ST.state.rows.filter(r => r.obj === 'obj-repay' && june.indexOf(r.ref) >= 0);
  const KINDS = ['original','reversal','rebind','bind','refund','match','freeze','amount'];
  const stNull = ST.state.rows.filter(r => stor(r.obj) === 'state').every(r => r.part === null);
  const dKinds = ST.state.rows.filter(r => stor(r.obj) === 'event_delta').every(r => KINDS.indexOf(r.part) >= 0);
  ok(264, ids264.length === 10 && off264.length === 0 && own264.length === 0 &&
        ev264 === 'obj-measure,obj-receipt,obj-repay' && evCopies === 0 &&
        juneRows.length === 4 && juneRows.every(r => ST.periodOf(r.date) === '2026-06' && !!r.fixed && r.part === 'original') &&
        stNull && dKinds && ST.ROW_KEY.join() === 'obj,ref,date,part',
    `способ хранения — реквизит релиза, а не объекта (ИС-55, ADR-0239 §1): у ${ids264.length} таблиц расхождений ${off264.length}, своего способа у объектов ${own264.length}. События — ${ev264}; копий у них за весь мир ${evCopies}. Июньские платежи пережили закрытие июня: строк ${juneRows.length}, по одной исходной на платёж, все зафиксированы, — закрытие удаляет дни состояний, а строки событий и есть месяц. Адрес строки — ${ST.ROW_KEY.join(' · ')} (СС-170): у состояния part пуст (${stNull}), у события-дельты — вид поправки из списка схемы (${dKinds})`);

  /* #265 — дата строки платежа — поздний из дней поступления и привязки + 1: платёж,
     опознанный задним числом, попадает в месяц опознания, даже если поступление лежит в
     закрытом месяце (ИС-55, ADR-0239 §2). */
  ST.seed();
  closeJuly();
  let r265, rows265, at0801, atToday;
  W['obj-repay'].push({id:'ПГ-2026/1210',
    f:{credit:'КД-2024/117', receipt:'ПП-2026/0755', rdate:'2026-07-25', bdate:'2026-08-21',
       pstate:'подтверждён', cur:'KGS', kind:'плановое', region:'Чуйская', district:'Сокулукский', amount:18000},
    h:{branch:[['2026-07-25','Кредитный департамент']], curator:[['2026-07-25','Бекова Н.']]}});
  try {
    r265 = ST.run(TODAY);
    rows265 = ST.state.rows.filter(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1210');
    at0801 = ST.rowsAsOf('obj-repay', '2026-08-01').find(r => r.ref === 'ПГ-2026/1210');
    atToday = ST.rowsAsOf('obj-repay', TODAY).find(r => r.ref === 'ПГ-2026/1210');
  } finally { W['obj-repay'].pop(); }
  ok(265, r265.ok && rows265.length === 1 && rows265[0].date === TODAY && rows265[0].part === 'original' &&
        rows265[0].dims['d-pbdate'] === '2026-08-21' && rows265[0].dims['d-pdate'] === '2026-07-25' &&
        !rows265.some(r => ST.periodOf(r.date) === '2026-07') && !at0801 && v(atToday, 'm-ramount') === 18000,
    `платёж ПГ-2026/1210 поступил 25.07 (июль закрыт), а привязан к кредиту 21.08: строка одна, исходная, на срез ${rows265.length ? rows265[0].date : '—'} — поздний из двух дней + 1. В закрытый июль не легло ничего, на 01.08 платежа нет, на ${TODAY} — ${v(atToday, 'm-ramount')} сом. Иначе опознание задним числом переписывало бы закрытый месяц или терялось (ИС-55, ADR-0239 §2)`);

  /* #266 — открытый месяц: правка события переписывает строку НА МЕСТЕ и пишется в журнал
     перезаписей; сторнированная исходная в «погашено» не входит, и поток событиями равен
     приросту «погашено всего» кредита (ADR-0239 §3). */
  ST.seed();
  const i266 = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1196');
  const keep266 = JSON.stringify(W['obj-repay'][i266]);
  const rep266 = d => v(ST.rowsAt('obj-credit', d).find(r => r.ref === 'КД-2022/065'), 'm-repaid');
  const before266 = rep266(ASK) - rep266('2026-08-01');
  let r266, rows266, eff266, rw266 = [], flow266, ev266;
  try {
    const p = W['obj-repay'][i266];
    p.f.pstate = 'сторнирован';
    p.h.pstate = [['2026-08-12', 'подтверждён'], ['2026-08-21', 'сторнирован']];
    ST.enqueue('obj-repay', 'ПГ-2026/1196', 'распоряжение', 'сторно платежа');
    r266 = ST.run(TODAY);
    rows266 = ST.state.rows.filter(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1196');
    eff266 = ST.rowsAsOf('obj-repay', TODAY).find(r => r.ref === 'ПГ-2026/1196');
    rw266 = (ST.state.runs[ST.state.runs.length - 1].parts.find(x => x.obj === 'obj-repay') || {rewrote: []}).rewrote;
    flow266 = rep266(TODAY) - rep266('2026-08-01');
    ev266 = ST.state.rows.filter(r => r.obj === 'obj-repay' && r.date > '2026-08-01' && r.date <= TODAY &&
        r.dims['d-pcredit'] === 'КД-2022/065' && !(r.part === 'original' && r.dims['d-paystate'] === 'сторнирован'))
      .reduce((n, r) => n + (v(r, 'm-ramount') || 0), 0);
  } finally { W['obj-repay'][i266] = JSON.parse(keep266); }
  ok(266, before266 === 52000 && r266.ok && rows266.length === 1 && rows266[0].date === '2026-08-13' &&
        rows266[0].part === 'original' && rows266[0].dims['d-paystate'] === 'сторнирован' && !rows266[0].fixed &&
        rw266.some(x => x.ref === 'ПГ-2026/1196' && x.fields.indexOf('d-paystate') >= 0) &&
        v(eff266, 'm-ramount') === 0 && flow266 === 0 && ev266 === flow266,
    `сторно в открытом августе — перезапись на месте: строк у ПГ-2026/1196 ${rows266.length}, на ${rows266.length ? rows266[0].date : '—'}, состояние «${rows266.length ? rows266[0].dims['d-paystate'] : '—'}», в журнале перезаписей — d-paystate. Действующая сумма платежа ${v(eff266, 'm-ramount')}: сторнированная исходная в «погашено» не входит (NOT original AND сторнирован). Прирост «погашено всего» КД-2022/065 за август был ${before266}, стал ${flow266}, и поток строками событий равен ему (${ev266}) — одно число, а не два (ИС-55, ADR-0239 §3)`);

  /* #267 — закрытый месяц: исходная строка не трогается; в месяце исправления ложатся сторно
     прежней привязки и перепривязка к новой; сумма строк — текущий итог; маркер «исправлено
     позже» со срезом поправки. Смена одного признака поступления — строка состояния без сумм. */
  ST.seed();
  const iP = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1102');
  const iR = W['obj-receipt'].findIndex(r => r.id === 'ПП-2026/0611');
  const keepP = JSON.stringify(W['obj-repay'][iP]), keepR = JSON.stringify(W['obj-receipt'][iR]);
  const origBefore = JSON.stringify(ST.state.rows.find(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1102'));
  let r267, rows267 = [], eff267, mk267 = [], rw267 = [], rc267 = [];
  try {
    const p = W['obj-repay'][iP];
    p.f.credit = 'КД-2025/088';
    p.h.credit = [['2026-06-05', 'КД-2024/117'], ['2026-08-21', 'КД-2025/088']];
    const rc = W['obj-receipt'][iR];
    rc.h.match = rc.h.match.concat([['2026-08-21', 'отозвано']]);
    ST.enqueue('obj-repay', 'ПГ-2026/1102', 'распоряжение', 'перепривязка к КД-2025/088');
    ST.enqueue('obj-receipt', 'ПП-2026/0611', 'распоряжение', 'сопоставление отозвано');
    r267 = ST.run(TODAY);
    rows267 = ST.state.rows.filter(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1102');
    eff267 = ST.rowsAsOf('obj-repay', TODAY).find(r => r.ref === 'ПГ-2026/1102');
    mk267 = ST.markers ? ST.markers() : [];
    rw267 = (ST.state.runs[ST.state.runs.length - 1].parts.find(x => x.obj === 'obj-repay') || {rewrote: []}).rewrote;
    rc267 = ST.state.rows.filter(r => r.obj === 'obj-receipt' && r.ref === 'ПП-2026/0611' && r.date === TODAY);
  } finally {
    W['obj-repay'][iP] = JSON.parse(keepP);
    W['obj-receipt'][iR] = JSON.parse(keepR);
  }
  const byPart = k => rows267.find(r => r.part === k) || {dims: {}, inds: {}};
  const o267 = byPart('original'), rv267 = byPart('reversal'), rb267 = byPart('rebind');
  const mkP = mk267.find(m => m.ref === 'ПГ-2026/1102') || {changed: []};
  const mkR = mk267.find(m => m.ref === 'ПП-2026/0611') || {};
  ok(267, r267.ok && rows267.length === 3 && o267.date === '2026-06-06' && !!o267.fixed &&
        JSON.stringify(o267) === origBefore &&
        rv267.date === TODAY && rv267.dims['d-pcredit'] === 'КД-2024/117' && v(rv267, 'm-ramount') === -28000 &&
        rb267.date === TODAY && rb267.dims['d-pcredit'] === 'КД-2025/088' && v(rb267, 'm-ramount') === 28000 &&
        v(o267, 'm-ramount') + v(rv267, 'm-ramount') + v(rb267, 'm-ramount') === 28000 &&
        (eff267 || {dims: {}}).dims['d-pcredit'] === 'КД-2025/088' && v(eff267, 'm-ramount') === 28000 &&
        mkP.row_table === 'stat_row_repay' && mkP.slice_date === '2026-06-06' && mkP.target_id === null &&
        mkP.closed_how === 'corrected_later' && mkP.corr_slice_date === TODAY && mkP.changed.indexOf('d-pcredit') >= 0 &&
        !rw267.some(x => x.ref === 'ПГ-2026/1102') &&
        rc267.length === 1 && rc267[0].part === 'match' && rc267[0].dims['d-rmatch'] === 'отозвано' &&
        Object.keys(rc267[0].inds).length === 0 && mkR.corr_slice_date === TODAY,
    `перепривязка платежа закрытого июня (ИС-55, ADR-0239 §4): исходная строка 06.06 не тронута и зафиксирована; на ${TODAY} легли сторно прежней привязки (КД-2024/117, ${v(rv267, 'm-ramount')}) и перепривязка к новой (КД-2025/088, ${v(rb267, 'm-ramount')}). Сумма трёх строк ${v(o267, 'm-ramount') + v(rv267, 'm-ramount') + v(rb267, 'm-ramount')} — текущий итог, действующий кредит — ${(eff267 || {dims: {}}).dims['d-pcredit']}. Маркер «${mkP.closed_how}» со срезом поправки ${mkP.corr_slice_date}; в журнал перезаписей не попало ничего — закрытое не переписывают. Отзыв сопоставления поступления — строка «${rc267.length ? rc267[0].part : '—'}» без сумм и свой маркер`);

  /* #268 — в закрытый период не пишет НИКТО: запрет стоит в одной функции записи и
     отбивает все десять таблиц; поправка в открытый месяц проходит, выпуск миграции — тоже. */
  ST.seed();
  let wr = null;
  try { wr = vm.runInContext('writeRow', sandbox); } catch(e) { wr = null; }
  const probe = (o, d, opts) => wr ? wr(ST.state, {obj: o, ref: 'проба', date: d,
    part: stor(o) === 'state' ? null : (stor(o) === 'event_full' ? 'проба' : 'original'),
    dims: {}, inds: {}, when: {}, srcs: {}, fixed: null, by: 'проба'}, opts || null) : {ok: true};
  const objs268 = ST.state.objects.map(o => o.id);
  const denied = objs268.filter(o => { const a = probe(o, '2026-06-15'), b = probe(o, '2026-07-01');
    return !a.ok && !b.ok && has(a.why, 'ИС-8') && has(b.why, 'ADR-0239'); });
  const n268 = ST.state.rows.length;
  const pass268 = probe('obj-repay', TODAY);
  const leg268 = probe('obj-credit', '2026-03-01', {legacy: true});
  ok(268, !!wr && objs268.length === 10 && denied.length === 10 && pass268.ok && leg268.ok &&
        ST.state.rows.length === n268 + 2,
    `запись в закрытое отбита у ${denied.length} таблиц из ${objs268.length} одной функцией — и на 15.06, и на итог июня 01.07 (ИС-8, ADR-0239): разойдись проверка по писателям, поправка события однажды легла бы в закрытый месяц. Поправка в открытый август проходит (${pass268.ok}), выпуск миграции в легаси-период — тоже (${leg268.ok})`);
})();
```

- [ ] **Step 2: Прогнать — `#264`…`#268` падают**

Expected:
- `FAIL #264`: `ST.ROW_KEY` из трёх полей, `part` у строк нет.
- `FAIL #265`: у строки нет `part`; `d-pbdate` в реестре нет.
- `FAIL #266`: `d-paystate` нет — сторно строкой не видно.
- `FAIL #267`: `ST.markers` нет; поправки пишутся рядом с исходной без вида.
- `FAIL #268`: `writeRow` нет.

- [ ] **Step 3: Данные — реестр, объекты, мир, релиз, ядро**

`REGISTRY`, после `d-pdate`:

```js
  /* Волна 23 (ИС-55, ADR-0239 §2, §3, СС-176): день привязки и состояние платежа. Без первого
     нечем сдвинуть строку платежа, опознанного задним числом, без второго — снять
     сторнированную исходную из «погашено». Колонки в схеме есть (§9.2). */
  {kind:'разрез', id:'d-pbdate', col:'d_bdate', vtype:'date', obj:'obj-repay', name:'Дата привязки платежа', src:'поле', key:'bdate', since:'2020-01-01',
   buckets:['год','квартал','месяц'], owner:'Погашения',
   note:'схема §9.2 — день привязки платежа к кредиту; срез строки платежа — поздний из дней поступления и привязки + 1 (ИС-55, ADR-0239 §2)'},
  {kind:'разрез', id:'d-paystate', col:'d_pay_state', vtype:'code', obj:'obj-repay', name:'Состояние платежа', src:'поле', key:'pstate', since:'2020-01-01',
   owner:'Погашения', note:'схема §9.2 — подтверждён · сторнирован; сторнированная исходная строка в «погашено» не входит (ИС-55, ADR-0239 §3)'},
```

`OBJECTS`:
- `obj-repay`: в `dims` дописать `'d-pbdate','d-paystate'`; добавить реквизиты

```js
   /* Событие-дельта (ИС-55, ADR-0239, СС-171). `evDay` — поля, поздний из которых есть день,
      когда платёж стал известен статистике; срез его строки — этот день + 1. `evState` —
      записи состояния, читаемые на ночь прогона, и вид поправки, который порождает их смена.
      `corr` — виды поправки в порядке схемы: на одну дату побеждает последний (схема §9,
      array_position). `voidIf` — исходная строка в этом состоянии в сумму не входит. */
   evDay:['rdate','bdate'], evState:{'d-pcredit':'rebind', 'd-paystate':'reversal'},
   corr:['original','reversal','rebind'], voidIf:['d-paystate','сторнирован'],
```

- `obj-receipt`:
  `evDay:['rdate'], evState:{'d-rmatch':'match', 'd-rfrz':'freeze'}, corr:['original','bind','refund','match','freeze','amount'],`
  с той же строкой комментария.

`WORLD['obj-repay']`: в `f` каждого из 14 платежей дописать `bdate` — тот же день, что `rdate`,
и `pstate:'подтверждён'`. Числа мира от этого не меняются: у всех платежей день привязки равен
дню поступления.

`RELEASE.tables['obj-repay']`: `date:['d_rdate','d_bdate']`, добавить `code:['d_pay_state']`.
`d_corr_kind` уже есть у платежа и поступления (служебная колонка).

`CORE`, перед `repaidOf`:

```js
  /* Платёж на дату (ИС-55, СС-172): кредит и состояние берутся ДАТИРОВАННОЙ историей, если она
     есть, иначе полем карточки. День, с которого платёж существует для ядра, — поздний из
     дней поступления и привязки: до привязки деньги кредиту не зачтены. */
  payOn(p, d){
    const h = p.h || {};
    return {credit: h.credit ? valueOn(h.credit, d) : p.f.credit,
            state:  h.pstate ? valueOn(h.pstate, d) : (p.f.pstate || 'подтверждён'),
            at: [p.f.rdate, p.f.bdate].filter(Boolean).sort().slice(-1)[0]};
  },
```

`repaidOf` — сумма по `CORE.payOn(p, dateISO)`: `x.credit === item.id && x.state !== 'сторнирован' && x.at > ANCHOR && x.at <= dateISO`.
`receiptSplit` — `pays = CORE.paysOf(item.id).filter(p => { const x = CORE.payOn(p, dateISO); return x.at <= dateISO && x.state !== 'сторнирован'; })`.
К комментарию `repaidOf` — строка: «сторнированный платёж погашением не является (ADR-0239 §3)».

- [ ] **Step 4: Движок — адрес `part`, запрет записи, дельта**

`bornOn`:

```js
/* Рождение события — день, когда оно стало известно (ИС-55, ADR-0239 §2): у платежа поздний
   из дней поступления и привязки. Срез его строки — этот день + 1, по общему правилу
   строгого рождения (ADR-0238 §2). */
function bornOn(o, item, dateISO){
  if(o && o.evDay) return o.evDay.map(k => item.f[k]).filter(Boolean).sort().slice(-1)[0] || null;
  return o && o.born ? readSrc(o.born, item, dateISO) : null;
}
```

`buildRow` — `part: null` после `date`. `ST.ROW_SHAPE`, `ST.ROW_KEY` — по `СС-170`; к
комментарию над ними абзац: «ВОЛНА 23 ЗАВЕЛА ДЕСЯТОЕ ПОЛЕ — `part`, и это АДРЕС, а не судьба:
ключ строки события в схеме — (объект, срез, вид поправки), у меры — (объект, цель, срез). В одну
дату у события ложится несколько строк, и без четвёртого поля адреса их не различить (ИС-55,
ADR-0239)». Комментарий `FORM` («Заведи её десятым полем строки…») — дописать: «десятое поле
волна 23 завела — `part`, адрес, а не редакция». Слов словаря `#5` в этих комментариях нет.

`scanPlan`: `if(storageOf(o.id) === 'state') o.inds.forEach(…money…)` и строка комментария:
«критическая дата — у состояний: деньги события читаются на день события, и курс ночи их не
двигает (СС-171)».

После `LAUNCH`: `const FIRST_OWN = dayShift(LAUNCH, 1);` — «первая своя ночь: событие до
запуска получает исходную строку ею (СС-174)».

Между `catchUp` и `function doRun`:

```js
/* ЗАПРЕТ ЗАПИСИ В ЗАКРЫТОЕ — у ВСЕХ таблиц и в одном месте (ИС-8, ADR-0239 §4). Строку
   пишут прогон, доспрос, поправка события и выпуск миграции — и все идут сюда. Разойдись
   проверка по писателям — поправка события однажды легла бы в закрытый месяц, потому что
   её писатель стерёг бы только состояния. Выпуск миграции проходит признаком `legacy`:
   легаси-месяц приходит закрытым, и пишет его он один (ADR-0207 §3). */
function writeRow(st, row, opts){
  opts = opts || {};
  if(!opts.legacy && latchOf(st, periodOf(row.date), MY_LAYER))
    return {ok:false, why:'строка '+row.ref+' на '+fmt(row.date)+' не пишется: период '+
      monLabel(periodOf(row.date))+' зафиксирован, и в закрытое не пишет никто — поправка '+
      'события ложится в месяц исправления (ИС-8, ADR-0239)'};
  const i = st.rows.findIndex(r => r.obj === row.obj && r.ref === row.ref &&
                                   r.date === row.date && r.part === row.part);
  if(i >= 0 && st.rows[i].fixed) return {ok:false, why:'строка '+row.ref+' на '+fmt(row.date)+
    ' зафиксирована (ИС-8)'};
  if(i >= 0) st.rows[i] = row; else st.rows.push(row);
  return {ok:true, replaced: i >= 0};
}
/* ---------- СОБЫТИЕ ДЕЛЬТОЙ (ИС-55, ADR-0239) ----------
   Строка события ложится на срез дня, когда событие стало известно. Его деньги и прочее
   читаются на ЭТОТ день, состояние — на ночь прогона (СС-171): исходная строка несёт курс
   дня события, а поправка — то состояние, которое исправляет. В открытом месяце правка
   переписывает строку на месте; в закрытом исходная не трогается, а в месяце исправления
   ложатся строки поправки и маркер «исправлено позже». Сумма строк — текущий итог. */
function eventSliceOf(o, item){ const b = bornOn(o, item); return b ? dayShift(b, 1) : null; }
function eventRow(o, item, D, silent){
  const at = eventSliceOf(o, item);
  const row = buildRow(o.id, item, at < FIRST_OWN ? FIRST_OWN : at, silent);
  const ask = {silent: silent || null, srcs: row.srcs, when: row.when};
  Object.keys(o.evState || {}).forEach(id => {
    const x = readDim(id, item, D, ask);
    if(x == null) delete row.dims[id]; else row.dims[id] = x;
  });
  return row;
}
const cents = x => Math.round(x * 100) / 100;
/* Клетка умножается и складывается ЦЕЛИКОМ: число, состав по валютам и основание пересчёта.
   Сложи одно число — и сомовая сторона разошлась бы со своим основанием (ADR-0214 §3). */
function scaleCell(c, k){
  const out = clone(c);
  if(typeof out.v === 'number') out.v = cents(out.v * k);
  ['parts','from'].forEach(f => (out[f] || []).forEach(p => { p.value = cents(p.value * k); }));
  return out;
}
function addCell(a, b){
  if(!a) return clone(b);
  const out = clone(a);
  if(typeof b.v === 'number') out.v = cents((out.v || 0) + b.v);
  ['parts','from'].forEach(f => (b[f] || []).forEach(p => {
    const arr = out[f] || (out[f] = []);
    const q = arr.find(x => x.cur === p.cur);
    if(q) q.value = cents(q.value + p.value); else arr.push(clone(p));
  }));
  return out;
}
function negRow(r){
  const out = clone(r);
  Object.keys(out.inds).forEach(id => { out.inds[id] = scaleCell(out.inds[id], -1); });
  return out;
}
/* «Погашено» = NOT (исходная AND сторнирована): сторнированная исходная в сумму не входит,
   а сторно-поправка входит своим минусом (схема §9.3). */
function voided(o, r){ return !!(o.voidIf && r.part === 'original' && r.dims[o.voidIf[0]] === o.voidIf[1]); }
/* Событие на дату — СУММА его строк не позже даты; состояние — у последней. Строки одной
   даты упорядочены видом поправки по списку объекта: побеждает последний (схема §9). */
function deltaAt(st, objId, ref, D){
  const o = OBJ(objId);
  const rank = r => o.corr.indexOf(r.part);
  const rows = st.rows.filter(r => r.obj === objId && r.ref === ref && r.date <= D)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a) - rank(b));
  if(!rows.length) return null;
  const out = Object.assign(clone(rows[rows.length - 1]), {inds: {}});
  rows.forEach(r => Object.keys(r.inds).forEach(id => {
    if(!out.inds[id]) out.inds[id] = scaleCell(r.inds[id], 0); }));
  rows.filter(r => !voided(o, r)).forEach(r => Object.keys(r.inds).forEach(id => {
    out.inds[id] = addCell(out.inds[id], r.inds[id]); }));
  return out;
}
function deltaNight(st, o, item, D, cand, silent, t){
  if(eventSliceOf(o, item) > D){ t.unborn++; return 0; }
  const mine = st.rows.filter(r => r.obj === o.id && r.ref === item.id);
  const put = row => { const w = writeRow(st, row); if(w.ok){ t.n++; t.written++; } return w.ok ? 1 : 0; };
  if(!mine.length){
    /* Первая встреча: исходная строка на срез дня события. Лёг бы срез в закрытый месяц —
       событие стало известно позже его закрытия, и строка ложится на эту ночь (ИС-8). */
    const row = Object.assign(eventRow(o, item, D, silent), {part: 'original'});
    if(latchOf(st, periodOf(row.date), MY_LAYER)) row.date = D;
    t.born++;
    return put(row);
  }
  if(!cand.full && !cand.set[o.id+'|'+item.id]){ t.skip++; return 0; }
  deq(st, o.id, item.id, 'досчёт', D, 'обойдён прогоном');
  deq(st, o.id, item.id, 'распоряжение', D, 'обойдён прогоном');
  const was = deltaAt(st, o.id, item.id, D);
  const now = eventRow(o, item, D, silent);
  const diff = rowDiff(was, now);
  if(!diff.length){ t.same++; return 0; }
  const orig = mine.find(r => r.part === 'original');
  if(!orig.fixed){
    /* Открытый месяц: исходная переписывается на месте, перезапись — в журнал (ADR-0239 §3). */
    const sp = splitDiff(orig, now, diff);
    if(sp.rewrote.length) t.rewrote.push({ref: item.id, fields: sp.rewrote});
    if(sp.filled.length)  t.filled.push({ref: item.id, fields: sp.filled});
    return put(Object.assign(now, {part: 'original', date: orig.date}));
  }
  /* Закрытый месяц (ADR-0239 §4). Денежное событие поправляется парой: сторно прежнего
     (минус действующей строки, с изменённым состоянием, если сменилось оно) и перепривязка к
     новому — если новое состояние в сумму входит. Событие без денежной пары (поступление)
     пишет строку своего вида без сумм — на каждый сменившийся признак. Смена одних сумм у
     поступления после его дня — граница макета (разнесение не моделируется). */
  const ch = Object.keys(o.evState || {}).filter(id => diff.indexOf(id) >= 0);
  let w = 0;
  if(o.corr.indexOf('reversal') >= 0){
    const rev = Object.assign(negRow(was), {part: 'reversal', date: D, fixed: null, by: 'прогон'});
    ch.filter(id => o.evState[id] === 'reversal').forEach(id => { rev.dims[id] = now.dims[id]; });
    w += put(rev);
    if(!voided(o, Object.assign({}, now, {part: 'original'}))) w += put(Object.assign(now, {part: 'rebind', date: D}));
  } else {
    if(!ch.length){ t.same++; return 0; }
    uniq(ch.map(id => o.evState[id])).forEach(k => {
      w += put(Object.assign(clone(now), {part: k, date: D, inds: {}}));
    });
  }
  st.markers.push({row_table: (st.release.tables[o.id] || {}).table, obj: o.id, ref: item.id,
    slice_date: orig.date, target_id: null, corr_kind: 'original', changed: diff,
    basis: 'поправка ночи '+fmt(D), found_run: st.runs.length, closed_run: st.runs.length,
    closed_how: 'corrected_later', corr_slice_date: D});
  return w;
}
```

`doRun`: сразу после `if(how.statesOnly && !state)…` —

```js
    /* Событие-дельта пишется своим путём: исходная строка, правка на месте в открытом
       месяце, поправки и маркер в закрытом (ИС-55, ADR-0239). */
    if(storageOf(o.id) === 'event_delta'){
      eachAlive(o, dateISO, t, item => { written += deltaNight(st, o, item, dateISO, cand, silent, t); });
      parts.push(partOf(o, t)); return;
    }
```

Все `st.rows.push(row)` / `st.rows[i] = row` в `doRun`, `repoll` и `loadLegacy` — через
`writeRow(st, row)` (в `loadLegacy` — `writeRow(st, row, {legacy: true})`, строка — с `part: null`).
В `seed()`: `markers: []` рядом с `queue`; дверь `ST.markers = () => clone(ST.state.markers);`.

`rowsAsOf` — после ветки состояний:

```js
  /* Событие-дельта на дату — сумма его строк не позже даты (ADR-0239 §3). */
  if(storageOf(objId) === 'event_delta')
    return uniq(st.rows.filter(r => r.obj === objId && r.date <= dateISO).map(r => r.ref))
      .map(ref => deltaAt(st, objId, ref, dateISO));
```

- [ ] **Step 5: Прогнать — `#264`…`#268` зелёные**

- [ ] **Step 6: Переписать сторожей прежней модели**

| № | было → стало |
|---|---|
| `#3` | `shape.length === 10`, `shape.join(',') === 'obj,ref,date,part,dims,inds,when,srcs,fixed,by'` |
| `#223` | `Object.keys(lr).length === 10`, `lr.part === null` |
| `#194` | по факту (ряды формы: `part` — в адресе) |
| `#1`, `#181` | записей реестра 310, разрезов 81, с колонкой 193 (`withCols + aggN === 310`) |
| `#202` | события из множества критической даты ушли (`scanPlan`): `kd202` — два ключа, USD-кредит `КД-2025/043` и его заёмщик `10510198203112` (`СС-178`). Чтобы «только критической датой» осталось доказуемо, ответ соседей замораживается на канун: в `try/finally` `CORE.read` подменяется обёрткой, читающей мир не позже `'2026-08-20'` (`const C = vm.runInContext('CORE', sandbox)`, прежний метод возвращается в `finally`) — тогда `only202.length === 2` в двух объектах. `run202`: у строки USD-кредита на `TODAY` `rateDate === eve(TODAY)`; части событий в `run202` — `n === 0` |
| `#86`, `#87` | по факту: состав платежей идёт за днём привязки (равен дню поступления) |
| `#111`…`#114`, `#120` | сомовые суммы валютных платежей и поступлений (`ПГ-2026/1127`, `1149`, `1190`; `ПП-2026/0634`, `0715`, `0824`) — по курсу дня события, а не ночи: числа по факту, тождества те же |
| `#136` | по факту (охват поступлений) |

Прочие — тем же правилом. Сторож, упавший по тождеству «сумма = Σ статей» или «разнесено =
Σ платежей», не переписывается: это дефект сложения клеток (`addCell`).

Expected: `exit=0`, 253/253 PASS (248 + 5).

- [ ] **Step 7: Мутации**
1. `storageOf` → всегда `'state'` → `#264`.
2. `bornOn` без `evDay` (день поступления вместо позднего из двух) → `#265`.
3. В `deltaNight` снять ветку `!orig.fixed` (открытый месяц правится поправками) → `#266`.
4. В `deltaNight` писать поправку поверх исходной (`part:'original', date: orig.date`) → `#267`.
5. Убрать `st.markers.push` → `#267`.
6. В `writeRow` проверять защёлку только при `storageOf(row.obj) === 'state'` → `#268`.

- [ ] **Step 8: Коммит** — `Статистика: волна 23 З-16a — событие дельтой: дата по привязке, поправка в месяце исправления`.
Тело: адрес part (СС-170), состояние на ночь и деньги на день события (СС-171), запрет записи у
всех таблиц, маркер corrected_later, реестр +2 (СС-176); сторожа #264…#268.

### Task 4b: З-16b — мера × цель, событие на дату одной функцией, поток событиями (`ИС-55`, `ADR-0239` §5, §6; схема §11.2)

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `REGISTRY` — `d-mprimary` рядом с `d-mstate` (~1856);
  - `OBJECTS` — `obj-measure` (~2622);
  - `WORLD['obj-measure']` (~3059) — поле `targets` у пяти мер;
  - `RELEASE.tables['obj-measure']` (~3902) — `bool:['d_primary']` (`target_id` уже есть);
  - новые `pairsOf`, `fullNight`, `fullAt`, `eventAt` — после `deltaNight` (З-16a);
  - `doRun` — ветка `event_full`, снятие прежнего пути событий (`СС-167`);
  - `rowsAsOf` — ветка `event_full`;
  - двери `ST.eventAt`, `ST.repayAt`, `ST.receiptAt`, `ST.measureAt`, `ST.eventFlow` — рядом с `ST.rowsAsOf`.
- Modify: `scripts/inspect/statistics-check.mjs`: блок З-16b (`#269`…`#272`), переписка из Step 5.

**Interfaces:**
- Consumes: `writeRow`, `eventRow`, `eventSliceOf`, `deltaAt`, `voided`, `cents`, `st.markers` (З-16a).
- Produces:
  - реквизиты объекта `targets`, `primary`, `primaryBy` (`СС-175`); запись `d-mprimary` (`СС-176`);
  - `pairsOf(o, item)` → копии записи с `f.target`, `f.primary`;
  - `fullAt(st, objId, ref, target, D)`; `eventAt(st, objId, D)` — событие на дату по способу хранения;
  - `ST.eventAt(objId, D)`, `ST.repayAt(D)`, `ST.receiptAt(D)`, `ST.measureAt(D)` — все строки
    (у меры — все пары);
  - `ST.eventFlow(objId, indId, from, to, byDim)` → `{ok, from, to, rows, by, som}` за `(from, to]`.

- [ ] **Step 1: Падающие сторожа `#269`…`#272`**

Перед `/* ---- отчёт ---- */`, после блока З-16a:

```js
/* ===== Волна 23 · З-16b — мера × цель (ИС-55, ADR-0239 §5, схема §11.2), событие на дату
   одной функцией на способ хранения, поток событиями (ADR-0239 §6). ===== */
(() => {
  const W = vm.runInContext('WORLD', sandbox);
  const v = (r, id) => (((r || {}).inds || {})[id] || {}).v;
  const at = (fn, d) => ST[fn] ? ST[fn](d) : [];
  const cents272 = x => Math.round(x * 100) / 100;

  /* #269 — строка лежит у ПАРЫ «мера × цель»; представитель пары — цель-заёмщик. Итог сумм
     и число мер считаются по представителю: мер пять, а не семь (СС-175). */
  ST.seed();
  const ms = ST.state.rows.filter(r => r.obj === 'obj-measure');
  const pairs = new Set(ms.map(r => r.ref + ' × ' + r.part));
  const dist = new Set(ms.map(r => r.ref));
  const prim = new Set(ms.filter(r => r.dims['d-mprimary'] === true).map(r => r.ref + ' × ' + r.part));
  const door269 = at('measureAt', ASK);
  const cnt269 = ST.statSlice({obj:'obj-measure', dims:[], inds:['a-count'], date: ASK});
  ok(269, pairs.size === 7 && dist.size === 5 && prim.size === 5 &&
        pairs.has('МВ-2026/19 × ТВ-2026/03-2') && pairs.has('МВ-2026/31 × ТВ-2025/11-2') &&
        [...prim].every(k => /ТВ-2026\/03-1|ТВ-2025\/11-1|ТВ-2026\/07-1/.test(k)) &&
        door269.length === 7 && ST.rowsAsOf('obj-measure', ASK).length === 5 &&
        cnt269.ok && cnt269.total['a-count'].v === 5,
    `мера направлена на цели, и строка лежит у пары (ИС-55, схема §11.2): пар ${pairs.size}, мер ${dist.size}. Представитель у каждой меры один — цель-заёмщик (${[...prim].join(' · ')}); по нему считаются суммы, а число мер — различными мерами: срез отвечает ${cnt269.ok ? cnt269.total['a-count'].v : '—'}, а не ${pairs.size}. Дверь меры на дату отдаёт все пары (${door269.length}), срез — представителей (СС-175)`);

  /* #270 — у меры поправка — строка ПОЛНОГО состояния пары на срез исправления, не приращение:
     складывать у меры нечего, её последняя строка отвечает за всё (event_full). Исходные
     строки закрытого мая не тронуты; маркер у каждой пары — с целью. */
  ST.seed();
  const i270 = W['obj-measure'].findIndex(m => m.id === 'МВ-2026/19');
  const keep270 = JSON.stringify(W['obj-measure'][i270]);
  let r270, rows270 = [], mk270 = [];
  try {
    W['obj-measure'][i270].f.result = 'исполнено частично';
    ST.enqueue('obj-measure', 'МВ-2026/19', 'распоряжение', 'исход меры уточнён');
    r270 = ST.run(TODAY);
    rows270 = ST.state.rows.filter(r => r.obj === 'obj-measure' && r.ref === 'МВ-2026/19');
    mk270 = (ST.markers ? ST.markers() : []).filter(m => m.ref === 'МВ-2026/19');
  } finally { W['obj-measure'][i270] = JSON.parse(keep270); }
  const today270 = rows270.filter(r => r.date === TODAY);
  const orig270 = rows270.filter(r => r.date === '2026-05-09');
  ok(270, r270.ok && today270.length === 2 && new Set(today270.map(r => r.part)).size === 2 &&
        today270.every(r => v(r, 'm-mclaim') === 2870000 && r.dims['d-mresult'] === 'исполнено частично') &&
        orig270.length === 2 && orig270.every(r => !!r.fixed && r.dims['d-mresult'] === 'в работе') &&
        mk270.length === 2 && mk270.every(m => !!m.target_id && m.corr_slice_date === TODAY &&
          m.slice_date === '2026-05-09' && m.closed_how === 'corrected_later'),
    `исход меры МВ-2026/19 закрытого мая уточнён: на ${TODAY} легли ${today270.length} строки — по одной на пару, — каждая с ПОЛНЫМ требованием ${today270.length ? v(today270[0], 'm-mclaim') : '—'} и новым исходом, а не с разностью. Исходные строки 09.05 (${orig270.length}) не тронуты и зафиксированы; маркеров ${mk270.length}, у каждого своя цель (ИС-55, ADR-0239 §5)`);

  /* #271 — событие на дату — одна функция на способ хранения. Платёж: сумма строк, состояние
     последней, на одну дату побеждает перепривязка; сторнированная исходная в сумму не
     входит. Поступление — признак последней строки. Мера — последняя строка пары. */
  ST.seed();
  const iP = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1102');
  const iS = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1196');
  const iR = W['obj-receipt'].findIndex(r => r.id === 'ПП-2026/0611');
  const keep271 = [JSON.stringify(W['obj-repay'][iP]), JSON.stringify(W['obj-repay'][iS]), JSON.stringify(W['obj-receipt'][iR])];
  const a271 = at('repayAt', ASK).find(r => r.ref === 'ПГ-2026/1102');
  let b271, s271, rc271, m271 = [];
  try {
    const p = W['obj-repay'][iP];
    p.f.credit = 'КД-2025/088';
    p.h.credit = [['2026-06-05', 'КД-2024/117'], ['2026-08-21', 'КД-2025/088']];
    const s = W['obj-repay'][iS];
    s.f.pstate = 'сторнирован';
    s.h.pstate = [['2026-08-12', 'подтверждён'], ['2026-08-21', 'сторнирован']];
    const rc = W['obj-receipt'][iR];
    rc.h.match = rc.h.match.concat([['2026-08-21', 'отозвано']]);
    ['ПГ-2026/1102', 'ПГ-2026/1196'].forEach(id => ST.enqueue('obj-repay', id, 'распоряжение', 'правка платежа'));
    ST.enqueue('obj-receipt', 'ПП-2026/0611', 'распоряжение', 'сопоставление отозвано');
    ST.run(TODAY);
    b271 = at('repayAt', TODAY).find(r => r.ref === 'ПГ-2026/1102');
    s271 = at('repayAt', TODAY).find(r => r.ref === 'ПГ-2026/1196');
    rc271 = at('receiptAt', TODAY).find(r => r.ref === 'ПП-2026/0611');
    m271 = at('measureAt', TODAY).filter(r => r.ref === 'МВ-2026/31');
  } finally {
    W['obj-repay'][iP] = JSON.parse(keep271[0]);
    W['obj-repay'][iS] = JSON.parse(keep271[1]);
    W['obj-receipt'][iR] = JSON.parse(keep271[2]);
  }
  ok(271, !!a271 && a271.dims['d-pcredit'] === 'КД-2024/117' && v(a271, 'm-ramount') === 28000 &&
        !!b271 && b271.part === 'rebind' && b271.dims['d-pcredit'] === 'КД-2025/088' && v(b271, 'm-ramount') === 28000 &&
        !!s271 && v(s271, 'm-ramount') === 0 && s271.dims['d-paystate'] === 'сторнирован' &&
        !!rc271 && rc271.dims['d-rmatch'] === 'отозвано' && v(rc271, 'm-rsum') === 28000 &&
        m271.length === 2 && m271.every(r => r.dims['d-mstate'] === 'сторнирована'),
    `событие на дату — одна дверь на способ (ИС-55): ПГ-2026/1102 на ${ASK} — ${a271 ? a271.dims['d-pcredit'] : '—'}, на ${TODAY} — ${b271 ? b271.dims['d-pcredit'] : '—'}: сторно и перепривязка легли на одну дату, и побеждает перепривязка (схема §9), сумма та же. Сторнированный ПГ-2026/1196 — ${v(s271, 'm-ramount')}: «погашено» = NOT (исходная AND сторнирована). Поступление ПП-2026/0611 — «${rc271 ? rc271.dims['d-rmatch'] : '—'}» при прежней сумме. Мера МВ-2026/31 — последняя строка каждой пары (${m271.length}), состояние «${m271.length ? m271[0].dims['d-mstate'] : '—'}»`);

  /* #272 — поток событиями: «погашено за период» — строки со срезом в (from, to], поправки
     включительно, — равен приросту «погашено всего» по каждому кредиту (ADR-0239 §6, ИС-17). */
  ST.seed();
  const repOf = (d, ref) => v(ST.rowsAt('obj-credit', d).find(r => r.ref === ref), 'm-repaid') || 0;
  const credits = ST.registryList('obj-credit', '2026-07-01');
  const flowJun = ST.eventFlow ? ST.eventFlow('obj-repay', 'm-ramount', '2026-06-01', '2026-07-01', 'd-pcredit') : {ok:false, by:{}};
  const badJun = credits.filter(ref => cents272((flowJun.by || {})[ref] || 0) !== cents272(repOf('2026-07-01', ref) - repOf('2026-06-01', ref)));
  let flowAug = {ok:false, by:{}}, badAug = ['не посчитано'];
  const keepP272 = JSON.stringify(W['obj-repay'][iP]);
  try {
    const p = W['obj-repay'][iP];
    p.f.credit = 'КД-2025/088';
    p.h.credit = [['2026-06-05', 'КД-2024/117'], ['2026-08-21', 'КД-2025/088']];
    ST.enqueue('obj-repay', 'ПГ-2026/1102', 'распоряжение', 'перепривязка к КД-2025/088');
    ST.run(TODAY);
    flowAug = ST.eventFlow ? ST.eventFlow('obj-repay', 'm-ramount', '2026-08-01', TODAY, 'd-pcredit') : {ok:false, by:{}};
    badAug = ST.registryList('obj-credit', TODAY).filter(ref =>
      cents272((flowAug.by || {})[ref] || 0) !== cents272(repOf(TODAY, ref) - repOf('2026-08-01', ref)));
  } finally { W['obj-repay'][iP] = JSON.parse(keepP272); }
  ok(272, flowJun.ok && badJun.length === 0 && flowJun.by['КД-2024/117'] === 28000 &&
        flowAug.ok && badAug.length === 0 &&
        flowAug.by['КД-2024/117'] === 68000 && flowAug.by['КД-2025/088'] === 42500,
    `«погашено за период» строками событий равно приросту «погашено всего» по каждому кредиту: июнь (01.06 → 01.07] — расхождений ${badJun.length} (${Object.keys(flowJun.by || {}).map(k => k + ' ' + flowJun.by[k]).join(' · ')}); август после перепривязки ПГ-2026/1102 — расхождений ${badAug.length}: КД-2024/117 ${flowAug.by['КД-2024/117']} (96 000 − 28 000 сторно), КД-2025/088 ${flowAug.by['КД-2025/088']} (14 500 + 28 000 перепривязки). Поправки в месяце исправления входят в поток этого месяца, прошлый месяц не переписан (ИС-17, ADR-0239 §6)`);
})();
```

- [ ] **Step 2: Прогнать — `#269`…`#272` падают**

Expected:
- `FAIL #269`: строк меры по одной на меру, `part` у них нет.
- `FAIL #270`: поправка меры не пишется парами, маркеров нет.
- `FAIL #271`: дверей `ST.repayAt`/`ST.receiptAt`/`ST.measureAt` нет.
- `FAIL #272`: `ST.eventFlow` нет.

- [ ] **Step 3: Данные и движок — мера × цель**

`REGISTRY`, после `d-mstate`:

```js
  /* Волна 23 (ИС-55, СС-175, СС-176): представитель пары «мера × цель». Суммы меры считаются
     по нему, число мер — различными мерами: иначе мера о двух целях посчиталась бы дважды. */
  {kind:'разрез', id:'d-mprimary', col:'d_primary', vtype:'bool', obj:'obj-measure', name:'Представитель меры', src:'поле', key:'primary', since:'2020-01-01',
   owner:'Взыскание', note:'схема §11.2 — цель-заёмщик, иначе единственная, иначе первая; итоги сумм — по d_primary, число мер — count(distinct object_id)'},
```

`OBJECTS['obj-measure']`: в `dims` дописать `'d-mprimary'`; добавить

```js
   /* Событие полным состоянием (ИС-55, ADR-0239 §5): строка у пары «мера × цель», последняя
      строка пары отвечает за всё. `targets` — поле цели в записи мира, `primaryBy` — какая
      цель представляет меру (схема §11.2). Состояние и исход читаются на ночь прогона. */
   targets:'targets', primary:'d-mprimary', primaryBy:{obj:'obj-claim', field:'role', value:'заёмщик'},
   evState:{'d-mstate': null, 'd-mresult': null}, corr:['original'],
```

`WORLD['obj-measure']`, поле `targets` в `f`:
- `МВ-2026/12` — `['ТВ-2026/03-1']`;
- `МВ-2026/19` — `['ТВ-2026/03-1','ТВ-2026/03-2']`;
- `МВ-2025/44` — `['ТВ-2025/11-1']`;
- `МВ-2026/27` — `['ТВ-2026/07-1']`;
- `МВ-2026/31` — `['ТВ-2025/11-1','ТВ-2025/11-2']`.

Все цели — требования того же кредита и дела, что и мера, и все родились не позже меры.

`RELEASE.tables['obj-measure']`: добавить `bool:['d_primary']`.

После `deltaNight`:

```js
/* ---------- МЕРА × ЦЕЛЬ (ИС-55, ADR-0239 §5, схема §11.2) ----------
   Мера направлена на одну или несколько целей — требований, — и строка лежит у ПАРЫ: ключ
   (мера, цель, срез), цель — в поле адреса `part`. Строка пары — ПОЛНОЕ состояние, не
   приращение: у меры нечего складывать, её последняя строка отвечает за всё. В открытом
   месяце последняя строка пары переписывается на месте, в закрытом — новая строка полного
   состояния на срез исправления и маркер с целью. */
function pairsOf(o, item){
  const tg = item.f[o.targets] || [];
  const pb = o.primaryBy;
  const isB = id => { const c = (WORLD[pb.obj] || []).find(x => x.id === id); return !!(c && c.f[pb.field] === pb.value); };
  const prim = tg.filter(isB)[0] || tg[0] || null;
  const one = (id, p) => Object.assign(clone(item), {f: Object.assign({}, item.f, {target: id, primary: p})});
  return tg.length ? tg.map(id => one(id, id === prim)) : [one(null, true)];
}
function fullAt(st, objId, ref, target, D){
  const rows = st.rows.filter(r => r.obj === objId && r.ref === ref && r.part === target && r.date <= D)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return rows.length ? rows[rows.length - 1] : null;
}
function fullNight(st, o, item, D, cand, silent, t){
  if(eventSliceOf(o, item) > D){ t.unborn++; return 0; }
  const named = cand.full || !!cand.set[o.id+'|'+item.id];
  let w = 0;
  const put = row => { const x = writeRow(st, row); if(x.ok){ t.n++; t.written++; w++; } return x.ok; };
  pairsOf(o, item).forEach(pr => {
    const tgt = pr.f.target;
    const last = fullAt(st, o.id, item.id, tgt, D);
    const now = Object.assign(eventRow(o, pr, D, silent), {part: tgt});
    if(!last){
      if(latchOf(st, periodOf(now.date), MY_LAYER)) now.date = D;
      t.born++; put(now); return;
    }
    if(!named){ t.skip++; return; }
    const diff = rowDiff(last, now);
    if(!diff.length){ t.same++; return; }
    if(!last.fixed){
      const sp = splitDiff(last, now, diff);
      if(sp.rewrote.length) t.rewrote.push({ref: item.id, target: tgt, fields: sp.rewrote});
      if(sp.filled.length)  t.filled.push({ref: item.id, target: tgt, fields: sp.filled});
      put(Object.assign(now, {date: last.date}));
      return;
    }
    if(put(Object.assign(now, {date: D})))
      st.markers.push({row_table: (st.release.tables[o.id] || {}).table, obj: o.id, ref: item.id,
        slice_date: last.date, target_id: tgt, corr_kind: null, changed: diff,
        basis: 'поправка ночи '+fmt(D), found_run: st.runs.length, closed_run: st.runs.length,
        closed_how: 'corrected_later', corr_slice_date: D});
  });
  if(named){
    deq(st, o.id, item.id, 'досчёт', D, 'обойдён прогоном');
    deq(st, o.id, item.id, 'распоряжение', D, 'обойдён прогоном');
  }
  return w;
}
/* СОБЫТИЕ НА ДАТУ — одна функция на способ хранения (ИС-55, ADR-0239 §6): у дельты — сумма
   строк не позже даты, у полного состояния — последняя строка каждой пары. */
function eventAt(st, objId, D){
  const o = OBJ(objId), kind = storageOf(objId);
  const refs = uniq(st.rows.filter(r => r.obj === objId && r.date <= D).map(r => r.ref));
  if(kind === 'event_delta') return refs.map(ref => deltaAt(st, objId, ref, D));
  if(kind === 'event_full') return [].concat(...refs.map(ref =>
    uniq(st.rows.filter(r => r.obj === objId && r.ref === ref && r.date <= D).map(r => r.part))
      .map(tgt => fullAt(st, objId, ref, tgt, D))));
  return null;
}
```

`doRun`: ветку `event_delta` (З-16a) расширить — `event_full` идёт в `fullNight`. Прежний путь
событий в `doRun` снять: ветки `if(!state){ t.skip++; return; }` и `if(!state) return;` больше
не нужны — до них доходят только состояния (`СС-167` снят). Комментарии, говорившие «событие
пишется при изменении», переписать: «событие пишется своим путём (ИС-55)».

`rowsAsOf`: ветку событий заменить —

```js
  /* Событие отвечает дверью «на дату» своего способа (ИС-55). Мера — строками представителей:
     суммы меры считаются по ним, число мер — различными мерами (СС-175). */
  if(storageOf(objId) !== 'state'){
    const rows = eventAt(st, objId, dateISO);
    const o = OBJ(objId);
    return o.primary ? rows.filter(r => r.dims[o.primary] === true) : rows;
  }
```

Рядом с `ST.rowsAsOf`:

```js
ST.eventAt   = (objId, D) => (eventAt(ST.state, objId, D) || []).map(clone);
ST.repayAt   = D => ST.eventAt('obj-repay', D);
ST.receiptAt = D => ST.eventAt('obj-receipt', D);
ST.measureAt = D => ST.eventAt('obj-measure', D);
/* ПОТОК СОБЫТИЯМИ (ИС-55, ADR-0239 §6): «погашено за период» — сумма строк со срезом в
   (from, to], поправки включительно; сторнированная исходная не входит. Интервал открыт
   слева: строка на `from` — последний день прошлого периода, на `to` — последний день этого.
   Сумма по разрезу — в валюте строк: разрез платежа по кредиту одновалютен; сом — отдельно. */
ST.eventFlow = (objId, indId, from, to, byDim) => {
  const st = ST.state, o = OBJ(objId);
  if(!o || storageOf(objId) !== 'event_delta') return {ok:false, why:'поток событиями считается '+
    'у событий-дельт (ИС-55): у «'+(o ? o.name : objId)+'» способ «'+(storageOf(objId) || '—')+'»'};
  const rows = st.rows.filter(r => r.obj === objId && r.date > from && r.date <= to && !voided(o, r));
  const by = {};
  let som = 0;
  rows.forEach(r => {
    const c = r.inds[indId];
    if(!c) return;
    const k = byDim ? String(r.dims[byDim]) : 'всего';
    by[k] = cents((by[k] || 0) + c.v);
    const s = r.inds[indId + SOM_SUFFIX];
    if(s) som = cents(som + s.v);
  });
  return {ok:true, from, to, rows: rows.length, by, som};
};
```

- [ ] **Step 4: Прогнать — `#269`…`#272` зелёные**

- [ ] **Step 5: Переписать сторожей прежней модели**

| № | было → стало |
|---|---|
| `#1`, `#181` | записей реестра 311, разрезов 82, с колонкой 194 |
| `#126` | `M.dims.length === 8` (добавлен представитель) |
| `#86` | состав мер на даты — по представителям: числа те же |
| `#98`, `#121`, `#127`, `#182` | по факту |
| `#124` | утверждения те же (`a-count` 5, дедуп по кредиту — `ADR-0199`); если число строк меры выросло — только в двери `ST.measureAt`, срез его не видит |

Expected: `exit=0`, 257/257 PASS (253 + 4).

- [ ] **Step 6: Мутации**
1. `pairsOf` возвращает одну пару на меру (`[one(tg[0] || null, true)]`) → `#269`.
2. В `fullNight` писать поправку разностью (`inds` = `now − last`) → `#270`.
3. В `deltaAt` обратить порядок видов одной даты (`rank(b) - rank(a)`) → `#271`.
4. В `deltaAt` убрать фильтр `voided` → `#271`.
5. В `ST.eventFlow` интервал `[from, to)` (`r.date >= from && r.date < to`) → `#272`.

- [ ] **Step 7: Коммит** — `Статистика: волна 23 З-16b — мера × цель, событие на дату одной функцией, поток событием`.
Тело: пара «мера × цель» с представителем (СС-175), двери события на дату, поток событиями
(ADR-0239 §6), прежний путь событий снят (СС-167); сторожа #269…#272.

### ⏸ Остановка 2 — детализировать этап 3.

---

## Этап 3 — деньги, разрезы, охват, служебное (детализируется на остановке 2)

### Task 5: З-17 — деньги (`ИС-56`, `ADR-0240`)
Сторожа: `cur`/`rate`/`rate_date` один раз на строку; у каждого остатка `_som = _v × rate`
(сторож `ADR-0214` §5 на строке); потоки — обе стороны от ядра, курс строки к ним не
применяется (найти поток, где `_som ≠ _v × rate`, — и это законно); клетки с `parts`/`mixed`
нет ни в одной строке. Мутации: курс строки применён к потоку; `parts` вернулся.

### Task 6: З-18 — разрез значением (`ИС-57`, `ADR-0241`)
Сторожа: ссылка хранит id и подпись на дату — переименование в справочнике после прогона
старую строку не меняет; значение вне закрытого словаря отбивается при записи строки;
классификатор хранит код, подпись и порядок, новое значение версии не требует релиза;
подразделение — два уровня на дату (переподчинение после даты прошлую строку не двигает);
признаки заёмщика у кредита читаются путём к строке заёмщика той же даты, копий в строке
кредита нет. Мутации: подпись берётся сегодняшняя; словарь не проверяется; признак
заёмщика скопирован в строку кредита.

### Task 7: З-19 — охват правилами (`ИС-58`, `ADR-0243`)
Сторожа: у каждого объекта ≥ 1 правило, вид ∈ `own · via · open`; объект без правила и
правило без вида валят загрузку; дело видно под ролью, если видно хоть одно его требование,
счёт дел — `distinct`; мера видна через требование-цель ИЛИ автору после передачи
требования; договор, поступление, программа — `open`, паспорт печатает причину, краткая
форма «всего N»; охват режет до группировки; путь признаков охватом не режется. Снимаются
`#132`…`#136`; временный `open` дела из З-13 заменён правилом `via`. Мутации: ИЛИ → И;
`via` читает не ту дату; `open` без причины принят.

### Task 8: З-20 — группа совместного риска (`ADR-0244` §2)
Сторожа: таблица членства «группа × член × дата» в релизе и в строках; сумма группы =
сумма строк заёмщиков-членов на ту же дату; итог по всем группам считает заёмщика из двух
групп один раз; член без кредитов даёт ноль, а не отсутствие; охват члена — `via` заёмщик.
Мутации: заёмщик двух групп посчитан дважды; сумма группы хранится в строке группы.

### Task 9: З-21 — признак «текущее» массивом (`ADR-0242`)
Сторожа: в строке `now_cols` — массив имён величин, карты `when` нет; не названная величина —
«на дату»; копия строки переносит массив, пересчёт пишет заново; величина молчавшего соседа
в массив не попадает; паспорт отвечает «на дату · текущее · смешанно». Переписываются
`#209`…`#215` (датировка). Мутации: молчавшая величина попадает в `now_cols`; копия
обнуляет массив.

### Task 10: З-22 — прогон (`ADR-0245` §2–§4, §12)
Сторожа: источник — перечисление `ok · unavailable · error · timeout · denied · legacy`,
`is_partial` вычисляется из него; счётчики прогона по объекту (`скопировано` только у
состояний, `new_rows`/`corr_rows` только у событий, `markers` у всех), расхождение
счётчиков → `failed`, дата не публикуется; сосед отвечает ключом и датой действия: дата в
открытом месяце → `retro` с неё, в закрытом → маркер на каждое первое число и `retro` с
первого открытого дня; у объекта ≤ 1 открытой задачи очереди, слияние по более ранней дате;
журнал перезаписи с причинами (`backfill` у дозаполнения). Мутации: `T` двигает догон;
вторая задача не сливается; дозаполнение без записи в журнал.

### Task 11: З-23 — маркеры, выгрузки, слоты (`ADR-0245` §5, §11; `ADR-0241` §5)
Сторожа: маркер у состояния пишется только при реальном отличии пересчёта и закрывается
`converged`/`reopen`; выгрузка получает `expired`, задание остаётся; слотов 10, слот
занимается навсегда и не переиспользуется, при 8 из 10 — предупреждение, 11-й
классификатор ждёт релиза. Мутации: маркер без отличия; освобождённый слот переиспользуется.

### ⏸ Остановка 3 — затем бумага (спецификация §6).

---

## Ход работы

Заполняется по ходу: задача → коммит; переписанные сторожа (номер, было → стало, почему);
снятые сторожа; мутации и результат; решения `СС-154`…; находки схеме и соседям.

| задача | коммит | заметки |
|---|---|---|
| З-13 — сверка реестра со схемой | «Статистика: волна 23 З-13 — реестр ложится на физическую схему» | смоук 233/233 PASS, exit 0 (было 230/230: +5 новых, −2 надгробия); подробности ниже |
| З-13, правка ревью 1 | «Статистика: волна 23 З-13 — счёт кредитов заёмщика по схеме (i_credits = всего)» | `m-bcnt` = все договоры (схема §2.3); #72 и #8 переписаны на месте; смоук 233/233 PASS, exit 0 |
| З-14 — механизм релиза | «Статистика: волна 23 З-14 — колонку заводит релиз, реестр ссылается на неё» | смоук 243/243 PASS, exit 0 (было 233/233: +10 новых #240–#249, надгробий 0); подробности ниже |
| З-14, правка ревью 1 | «Статистика: волна 23 З-14 — ожидающая запись закрыта на всех дверях, пара прекращается целиком» | период и расхождение отказывают ждущей записи; пара прекращается целиком; деньги только на `money_*`; #128 под ИС-53; +3 сторожа #250–#252; смоук 246/246 PASS, exit 0 |
| З-15a — срез на начало дня: канун, период строки | «Статистика: волна 23 З-15a — срез на начало дня: канун, период строки, первые числа» | смоук 249/249 PASS, exit 0 (было 246/246: +3 новых #253–#255, надгробий 0); подробности ниже |
| З-15b — строка каждый день: копия, догон, кэш демо-мира | «Статистика: волна 23 З-15b — строка каждый день: копия, догон, кэш демо-мира» | смоук 244/244 PASS, exit 0 (было 249/249: +4 новых #256–#259, −9 надгробий #184–#192); подробности ниже |
| З-15b, правка ревью 1 | «Статистика: волна 23 З-15b — догон не пишет вне календаря, кэш сверяется с миром честно» | догон за дату без строки календаря — пропуск §6, а не строки; #259 сравнивает кэш со сборкой мимо него; ключ кэша — все 27 входов сборки (`SEED_INPUTS`); #257 и #259 дописаны; смоук 244/244 PASS, exit 0; подробности ниже |

### З-13 — сверка реестра со схемой

**Отправная точка.** Смоук до задачи — 230/230 PASS, а не 228, как стоит в таблице файлов выше
(«228 проверок»).

**Релиз.** `RELEASE` объявлен после `ST.roundOf`, а не рядом с `REGISTRY`: `relCols` читает
словарь `VTYPES`, а обращение раньше объявления падает на TDZ. `VTYPES` получил ключ
`id: ['_id']` (см. СС-Д19). Сирота из релиза кредита — пара `d_terr_aokrug_id` + `d_terr_aokrug_lbl`
(айылный округ выдачи). Её нет ни у одной записи реестра, и она стоит в релизе с комментарием
(ADR-0237 §3).

**Реестр: было 369 записей, стало 308.** Снято 26 собственных записей и 40 близнецов, добавлено 5.

- **Снято по ADR-0244 §4:**
  - `d-ccur` — «валюта оценки»;
  - `m-blimit`, `a-sumblimit` — лимит задолженности;
  - `d-bstatus` — статус «Активный»;
  - `m-bevade`, `m-bnodocs`, `m-bnomon` — факторы у заёмщика. Они переехали к кредиту как
    `d-rf-evade` (уклонение от акта сверки ИЛИ от документов: в схеме это один фактор) и
    `d-rf-nomon`;
  - `d-obranch`, `d-ocurator`, `d-oregion`, `d-ocur` — подразделение, куратор, территория и
    валюта дела;
  - `m-cins` — страхование залога.
- **Снято по ADR-0028 и схеме §11 «Снято»:**
  - `d-mrkind`, `d-mstage`, `d-mdeliv` — три оси результата меры. Результат теперь плоский
    по виду (`d-mresult`);
  - `d-mregion` — территория меры;
  - `m-mdays`, `a-maxmdays`, `a-avgmdays` — хранимые «дни с направления».
- **Снято, потому что схема не хранит (§10.3, §10.4):**
  - `m-pfree`, `a-sumpfree` — свободный слой платежа. Он выводится как сумма минус судебный
    слой;
  - `m-runal`, `a-sumrunal` — нераспределённый остаток. Он выводится как сумма минус
    зачтённое минус возвращённое;
  - `m-rwait`, `a-maxrwait`, `a-avgrwait` — дни без опознания.
- **Близнецы.** Итоги заёмщика (8), залога (5) и дела (2) — `m-btotal` … `m-cexp` — стали
  `money_som` без близнеца (ADR-0240 §4). Так же у кредита `m-secured` и `m-secliq`: в схеме они
  `money_som`. Итого снято 40 записей `-som` вместе с близнецами агрегатов.
- **Добавлено:**
  - `d-kind`, `d-decision` — у кредита (ТЗ #12, #13). Имя `d-kind` — «Вид кредита по
    договору», чтобы не спорить с `d-pkind` программы (ИС-40);
  - `d-rf-evade`, `d-rf-nomon` — у кредита, `bool`;
  - `d-sstate` — у заёмщика.
- **Прочее.**
  - `d-collkind` стал одноуровневым: класс ликвидности уровнем не стоит, ADR-0241 §5;
    `REF.collkind` остался только шву покрытия.
  - У `d-csolv` колонкой уровня стал `d_worst_sub` (`cls`).
  - У дела разрезов нет; охват пока `open` (временно: `via` — З-19).

**Правки движка.**

1. **`flowBetween`.** Для `money_som` поток считается по основанию `from`, а не по `parts`.
   - Без этого курс протекал в поток: у заёмщика вышло 489 360 вместо 462 720, ADR-0151 §3.
2. **`fxCursOf`.** Валютность сомового итога читается по `from`.
   - Без этого заёмщик с долларовым долгом выпадал из множества «критическая дата»: курс
     уточнён, сомовый итог на дату другой, а ночь его не трогает.
   - Нашёл #202 (kd 6 → 5).

**Переписано на месте** (было → стало, почему):

| № | было → стало | почему |
|---|---|---|
| #1 | показателей 285 → 229 (своих 171 → 155, близнецов 114 → 74), разрезов 84 → 79, записей 369 → 308 | снятое по ADR-0244, ADR-0240, ADR-0028 |
| #6 | объект без разрезов спрашивается `dims: []` | у дела разрезов не осталось |
| #67 | близнецов 27 → 25, базовых 58 → 56; денежные разведены на `money_cur` и `money_som` (`m-secured`, `m-secliq`) | итоги без близнеца |
| #69 | строчных у заёмщика 20 → 16, близнецов 9 → 0, сомовых итогов 8 | ADR-0240 §4 |
| #70 | состав по валютам сверяется с основанием `from`, а не с `parts` | клетка итога сомовая |
| #71 | «валютный свод отказывает, сомовый отвечает» → итог — одно сомовое число, свод отвечает во всех 3 группах | ADR-0240 §4 переписал ADR-0184 §3 |
| #73 | показателей-перечислений и булевых 6 → 2 | сняты `m-cins` и три фактора у заёмщика |
| #78 | близнецов шва у предмета 4 → 0 | итоги залога сомовые |
| #81 | разрезов залога 11 → 10, `d-ccur` нет, вид одноуровневый, у `z77` вид «техника» | ADR-0244 §4, ADR-0241 §5 |
| #96 | близнецов у дела 2 → 0 | ADR-0240 |
| #111 | клеток шва в платеже 7 → 6, сомовых 7 → 6 | снят `m-pfree` |
| #112 | свободный слой вычисляется как сумма минус судебный; `!REC('m-pfree')` | схема не хранит, §10.3 |
| #113 | `m-runal` → «сумма − зачтено − возвращено ≥ 0», для `ov` = 4000 | схема не хранит, §10.4 |
| #119 | платёж: инд 8 → 7, агр 9 → 8, сомовых 16 → 14. Поступление: инд 6 → 4, агр 8 → 5, сомовых 8 → 6 | сняты `m-pfree`, `m-runal`, `m-rwait` |
| #126 | разрезов меры 11 → 7, инд 2 → 1, агр 4 → 2 | ADR-0028, схема §11 |
| #132 | режутся разрезом 7 → 6, общих 1 → 2, отказом 2, разрезов охвата 7 → 6 | у дела охват `open` (временно, З-19) |
| #134 | пар «объект — разрез охвата» 7 → 6 | довод #132 |
| #150 | сравнение уровней без `col` и `vtype`, уровней территории 6 → 4 | уровни получили колонки |
| #172 | аудит продлён на клетки `money_som` (`somOnlyWhy`): просмотрено 2127 → 2023, сомовых 576, своих строк 258 → 248 | итоги без близнеца |
| #175 | портфель заёмщика сверяется по `from` одной сомовой клетки | ADR-0240 §4 |
| #176 | близнецов 114 → 74 | итоги без близнеца |
| #179 | денежных строчных 57 → 37 `money_cur` плюс 17 `money_som`, аддитивных, без `rollBy` | ADR-0240 |
| #180 | `money_som` исключён из порождения близнецов: денежных агрегатов 57 → 37, сомовых 17, у сомовых близнецов 0 | ADR-0240 |
| #181 | 369 / 285 / 84 / 171 / 114 → 308 / 229 / 79 / 155 / 74; новые разрезы `d-clcur`, `d-mcur`; `!REC('d-ocur')` | снятое |
| #183 | денежных 171 → 128, своих 114 → 91, унаследованных 57 → 37 | снятое |
| #184 | хранимых строк 258 → 248 (плотных 379) | ушли счётчики дней, росшие каждую ночь |
| #186 | написано 37 → 36, без изменений 21 → 22, зафиксировано 100 → 99, дописано 19 → 20 | МВ-2026/12 больше не меняется каждую ночь и материализуется слепком |
| #193 | швов реестра 15 → 14 | `measureClock` никто не читает; объявлен у взыскания по-прежнему |
| #201 | кандидатов 37 → 30, написано 34 → 30, без изменений 3 → 0, не обойдено 39 → 46 | ушли 5 мер (`measureClock`) и 2 квитанции (`m-rwait`); «без изменений» держит #206 |
| #202 | ночь без курса 34 → 30; добавлено: заёмщик в множестве критической даты | довод #201; правка `fxCursOf` |
| #204 | взыскание обходит 14 → 9 записей, объектов 3 → 2 (дело и требование) | мера к соседу не ходит |
| #206 | кандидатов 38 → 31, написано 34 → 30, без изменений 4 → 1, не обойдено 38 → 45 | довод #201 |
| #209 | одна дверь `calcPledge`: 15 → 11 записей, «на дату» 11 → 7 | сомовые близнецы залога сняты |
| #210 | в строке залога величин 27 → 20, текущих 12 → 9 | сняты `d-ccur`, `m-cins`, близнецы |
| #211 | защёлка дописывает 19 → 20 | довод #186 |
| #212 | дописано 19 → 20, всего 23 → 24; добавлено: заёмщик среди переписанных | довод #186; итог пересчитан от основания |
| #228 | прогон за 21.08 пишет 34 → 30 | довод #201 |

- **Попутно в #132:** в тексте сообщения стояло `&&` перед шаблоном, и отчёт печатал `false`
  вместо текста. Исправлено.

**Снятые сторожа** (надгробие в смоуке, номер не переиспользуется):

- **#122** — «три оси результата меры независимы». Основание: ADR-0028, схема §11 «Снято».
- **#123** — «дней с направления меры» хранится и сворачивается. Основание: схема §11,
  ADR-0244 «Границы».

**Новые сторожа:** #235–#239 PASS.

- **RED.**
  - До правки реестра #236 и #237 падали: таблиц в релизе 0, записей без колонки 225.
  - #235 зелёный с первого прогона: он разбирает только схему.
  - Условия #238 и #239 на HEAD: осталось 11 снятых, не хватает 5 добавленных; итогов 32,
    все не сомовые, 16 с близнецом.
- **#239 считает точно** (решение контролёра): итогов 15 — у заёмщика 8, у залога 5, у дела 2,
  у договора залога 0.

**Мутации** (в копии, смоук с выводом в файл). Все пять засчитаны.

| № | мутация | упали |
|---|---|---|
| 1 | `d-industry` без `col` | только #237 |
| 2 | `'d_nonexistent'` в релизе кредита | только #236 |
| 3 | `obj-repay` с `storage: 'state'` | только #236 |
| 4 | вернули `m-blimit` | #238, #237, #239, плюс счётные #1, #128, #176, #179, #181, #183 |
| 5 | `isSomRow` без `r.vtype !== 'money_som'` | #239, плюс 16 сторожей близнецов и сомовых сторон |

- **Приём.** В пайп вывод смоука обрезается на 132 строке: `process.exit` приходит раньше,
  чем опустеет буфер. Приём из «Приёмов» (`node … | grep`) может не увидеть `FAIL`, поэтому
  мутации гонялись с выводом в файл. Счёт в первой строке пайпа при этом верный.

**Находки к журналу.**

- **СС-Д19.** В словаре `value_type` схемы (§12.1) нет вида для голого идентификатора. Поэтому
  у `d_receipt_id`, `d_credit_id`, `d_case_id`, `d_parent_id` нет своего `vtype`. В макете
  заведён `id: ['_id']`.
- **СС-Д20.** Схема §11 снимает валюту меры «как разрез», но у меры оставлены `cur` и
  `i_claim_v`. `d-mcur` оставлен с колонкой `cur`, комментарий называет находку.
- **`m-bcnt` приведён к схеме** (правка ревью, раунд 1, решение контролёра «b»).
  - **Было.** `m-bcnt` («Действующих договоров») считал действующие договоры и лежал в
    `i_credits`. Схема §2.3 определяет эту колонку как «кредитов: всего». Имя тут ни при
    чём: в колонке хранилось бы другое число.
  - **Стало.** Запись переименована в «Договоров всего», агрегат — в «Договоров всего,
    итого». Колонка та же, `i_credits`. Шов `calcPortfolio.credits` считает все договоры,
    у которых на дату есть статус, включая закрытые.
  - **Действующие** не хранятся. Их считают при чтении как `m-bcnt` − `m-bclosed`, т.е.
    `i_credits` − `i_closed_credits`. «N активных кредитов» карточки (ТЗ 04 §3.2) — эта
    же разность.
  - **Сторожа переписаны на месте.**

    | № | было | стало |
    |---|---|---|
    | #72 | на закрытии `m-bcnt` падал 1 → 0 | `i_credits` стоит на 1, `i_closed_credits` 0 → 1, действующих при чтении 1 → 0 |
    | #8 | «договоров 0» у 45607195804119 | всего 1, закрытых 1, действующих при чтении 0 |

  - **Что не изменилось.** #77 держит «договоров 0» у заёмщика без договоров вовсе. Счёт
    ночи и защёлки тоже не сдвинулся: на закрытии строка меняется всё равно, через
    `m-bclosed`.
- **Приближение.** `d_frozen` у поступления в схеме `bool`, а мир держит строку. Это к З-18.
- **Расхождения со схемой, оставленные следующим задачам.**
  - Охват поступления в макете `denied`, в схеме `open` (З-19).
  - Объект `obj-guarantee` снят ADR-0244 §4, но блок C смоука заводит его через
    `ST.addObject`: это проба двери, а не модель. Оставлено.
- **Следствие снятия.** У заёмщика без договоров клетки итога нет. Раньше сомовая сторона
  давала ему значение, теперь нет.
- **Ошибки в этом плане.**
  - Строка 30 называет «снятыми» номера #132…#136 и #184…#192, но в смоуке это живые
    сторожа.
  - Живой и #229, хотя строка 31 ссылается на «надгробие #229…#234 после волны 19».
  - Номера я не трогал.

### З-14 — механизм релиза (`ИС-53`)

**Устройство.**

- **Релиз — состояние.** `st.release = clone(RELEASE)` в `seed()`. Релиз читают сверка, дверь
  реестра, `ST.release()`, `ST.colOf` и `ST.addObject`. `ST.migrate` дописывает колонки в
  `st.release`, а не в константу.
- **Сверка при старте** (`reconcile`, в `seed()` до легаси). Идёт в два прохода: сперва строчные
  записи, потом агрегаты.
  - Запись, чьих колонок нет в релизе, встаёт в `st.awaiting`, уходит из состава объекта и
    пишется в `st.relLog`.
  - Пара `money_cur` + близнец — одна единица (решение D, `pairOf`): не хватает любой колонки —
    ждут обе.
  - Колонки релиза без записи (кроме служебных `SERVICE_COL`) попадают в `st.orphanCols` и
    предупреждением в `st.relLog`. `reOrphan` пересчитывает их после двери и миграции и пишет
    в журнал только новые.
  - Журнал сверки — `st.relLog`, а не `st.log`: `seed` в конце обнуляет журнал действий.
- **Дверь реестра** колонку не заводит, а ищет (`missingOf`). Нашла — запись включается, досчёт
  встаёт в очередь. Не нашла — `{ok:true, waiting:true, missing, cols}`, запись в реестре и в
  `awaiting`, в составе объекта её нет. `col`/`somCol` в ответе заменены на `cols`/`somCols`.
- **`ST.migrate({obj, cols, note})`** (решение B).
  - Объект без таблицы — отказ (ИС-53).
  - Имена колонок — латиница; уже имеющиеся не добавляются (повтор — пустой шаг).
  - Журнал: «миграция: таблица + колонки (changeset Liquibase)».
  - Затем сверка заново по ждущим записям объекта: у кого больше нечего ждать, включается —
    пара целиком, строчные раньше агрегатов, досчёт в очередь один раз на пару.
  - Ответ: `{ok, obj, table, added, included}`. Прав администратора не спрашивает: это
    выкладка, а не действие в модуле.
- **`ST.migrateTable({obj, table, storage, cols})`** (решение G, СС-156) заводит таблицу нового
  объекта.
  - Имя строго `stat_row_<x>` и уникально; способ хранения из трёх (ADR-0239).
  - Заведено только ради проб двери #9, #89, #152. Таблиц в `RELEASE` и в #236 не прибавилось.
- **`ST.addObject`** без таблицы в релизе отказывает, ссылаясь на ИС-53 и ADR-0237 §5.
  - Порядок проверок: права → id → множество владельца (`WORLD`) → таблица → рождение → …
    (СС-157).
- **Каталог в `validate`** (решение C). `checkCatalog` — последняя проверка, после проверок
  породы.
  - Без `col` — отказ (ИС-53).
  - `vtype` вне `VTYPES` — отказ со списком (схема §12.1).
  - У агрегата `col`/`vtype`/`levels` — отказ (СС-158).
  - У иерархии колонки несут уровни (решение E, СС-154).
- **`money_som`** (решение F, в `checkInd`): без `unit:'сом'` и `roll:'аддитивный'` — отказ по
  ADR-0240 §4.
- **Схема витрины снята** — `colType`, `martAdd`, `ST.mart`, `ST.martLog`, `ST.martCol`,
  `st.mart`, `st.martLog`. На их месте надгробный комментарий (ADR-0237; переписан ADR-0209 §6).
- **Вопрос к ждущей записи** — отказ «ждёт колонку … (ИС-53)» в `checkQuery`, и у разреза, и у
  показателя (СС-155).
- **Прочее.**
  - `changeKind` ждущую запись в состав новой породы не ставит.
  - `retire` снимает запись из ожидания и из состава (`dropFromObjects`).
- **Экран «Реестры».**
  - Карточка «Схема витрины порождена реестром» заменена на «Реестр и релиз: колонку заводит
    релиз» с двумя списками сверки.
  - У записи новая колонка таблицы «Колонка релиза».
  - В форме поля «Колонка релиза» и «Вид значения».
  - В «Чего здесь завести нельзя» два новых пункта.
  - `addObjUI` показывает отказ; кнопка — «Попробовать завести объект без релиза».
  - `addDimUI` несёт `col`/`vtype` и заводит запись в ожидание.
  - Проверено в headless Chrome: ошибок консоли нет.
- **Комментарии про ИС-18.**
  - «Шестой объект стоит одной строки данных / заводится строкой, а не релизом» переписаны под
    ИС-53 и ADR-0237 §7: шапка движка, слои, `OBJECTS`, `obj-zdeal`, `obj-task`,
    `WORLD['obj-guarantee']`, шапка сборщика, `addObject`, `addObjUI`, лид экрана объектов.
  - В шапке файла ИС-18 помечен снятым, добавлены ИС-53 и строка ADR-0237. У ADR-0149 и
    ADR-0209 названо, что переписано.
  - Добавлен абзац «Волна 23 З-14».

**Новые сторожа #240–#249.**

| № | что держит |
|---|---|
| #240 | сверка на старте; вторая половина вынимает из `RELEASE` `d_industry_lbl` и `i_od_som`: ждут отрасль, обе половины пары и два свода над парой, из состава вынуты, в журнале 5 строк; релиз возвращается в `finally` |
| #241 | дверь без релиза: колонки нет — ждёт; колонка-сирота `d_terr_aokrug` (`ref`, решение A) — включается, сирот не остаётся |
| #242 | агрегат релиза не стоит |
| #243 | новый объект без таблицы — отказ (ИС-53) |
| #244 | `ST.mart`/`martLog`/`martCol` и `st.mart`/`st.martLog` сняты, `ADD COLUMN` в журнале нет |
| #245 | заведена → ждёт → чужая миграция не включает (и даёт сироту) → своя включает: состав, очередь, прогон заполняет, повтор миграции пуст; вопрос к ждущей — отказ «ждёт колонку» |
| #246 | дверь каталога: без колонки, чужой вид, порядок (тип раньше колонки), агрегат с колонкой, `money_som` без «сом»/«аддитивный» (решение F), годный `money_som` без близнеца |
| #247 | пара ждёт и включается целиком, близнец встаёт сразу за своей записью (решение D) |
| #248 | уровень без колонки отбит поимённо; новый уровень ждёт; «группа» у `d-subgroup`/`d-csolv` колонки не требует (СС-154) |
| #249 | агрегат над ждущим основанием ждёт с ним, вопрос к нему — отказ, миграция основания включает обоих (СС-155) |

**TDD.**

- **RED 1** (до движка): 234/242. Упали #240, #241, #243–#248. #242 зелёный с первого
  прогона: колонок у агрегата не было и раньше, а `waiting` был `undefined`.
- **RED 2** (#249 и расширенный #240, до СС-155): 241/243, упали #240 и #249. Свод над ждущей
  записью отвечал `0`.
- **GREEN:** 243/243 PASS, exit 0 (вывод в файл, решение H).

**Переписано на месте** (было → стало, почему).

| № | было → стало | почему |
|---|---|---|
| #5 | довод «— ИС-18» → «механизм прогона общий, таблица своя (ADR-0237 §7; ИС-18 снят, эта часть осталась)» | ИС-18 снят |
| #9 | «одиннадцатый объект заведён строкой» → отказ без таблицы (ИС-53), затем `migrateTable` `stat_row_guarantee`, объект, свои разрезы с `col`/`vtype`, `m-gsec` на `i_secured` (`money_cur`); все включены, сирот у объекта нет | ADR-0237 §5, §7 |
| #32 | `ST.migrate` `d_segment_id/_lbl` → затем `d-segment` с `col:'d_segment'` | запись ссылается на колонку |
| #40 | `ST.migrate` `i_idle_v/_som` → затем `m-idle` на `i_idle` (`money_cur`) | то же |
| #58 | `ST.martCol('a-sumdebt')` → `colOf.state === 'агрегат'`, колонок 0 | схема витрины снята; §4, §5 |
| #62 | `ST.migrate` `d_fdate` у погашения; `d-fdate` с `col`/`vtype`; уровни `d-div2` — объектами с колонками; обе записи включены | ИС-53, ADR-0241 §4 |
| #89 | перед пробой «без рождения» — `migrateTable`, иначе отказ был бы про таблицу, а не про рождение | ИС-33 должен остаться причиной |
| #121 | комментарий и довод «вернётся строкой» → «вернётся релизом: таблица строк и записи реестра» | ИС-53, ADR-0237 §5 |
| #148 | годная `d-t4` с `col:'d_zterr'` (ждёт) | каталог |
| #149 | `d-t8` с `col:'d_appr_terr'` | каталог |
| #152 | `migrateTable` перед пробой объекта определения; свой разрез включён | ИС-40 должен остаться причиной |
| #156 | `m-n4` с `col`/`vtype` (ждёт; даты заведения и прекращения те же) | каталог |
| #158 | `d-d6` с `col`/`vtype` | каталог |
| #160 | `d-f4` с `col:'d_f4'` (`cls`) | каталог |
| #161 | «схема витрины не тронута» → колонка записи та же, релиз не тронут, запись включена до и после | ADR-0237 §3, §4 |
| #162 | «колонка витрины цела» → колонка `m-bworst` в релизе и не сирота, релиз не тронут; `m-nb`/`d-nb` с `col`/`vtype` | ADR-0237 §4 |
| #163 | «схема ПОРОЖДЕНА реестром» (ADD COLUMN, nullable, журнал DDL, `kindAt`) → «реестр ССЫЛАЕТСЯ на релиз»: безымянных 0, мимо релиза 0, разных источников на одной колонке 0 (общая колонка — у одной величины в двух ролях, 5), сироты — только `d_terr_aokrug`; две новые записи ждут, релиз не тронут дверью, переездом и прекращением, строк DDL 0. Проверки `ST.mart`/`martLog`/`kindAt` сняты внутри сторожа | схема витрины снята (ADR-0237 §2, §6) |
| #165 | `m-q4` с `col`/`vtype` | каталог |
| #166 | `m-w5` с `col`/`vtype` | каталог |
| #168 | `m-p4` с `col`/`vtype` | каталог |
| #169 | `m-k1` с `col`/`vtype` | каталог |
| #170 | `ST.martCol('m-debt-som')` (nullable, тип) → `colOf`: включена, та же таблица, `_som` той же основы, что `_v` | ADR-0237 §3, ADR-0242 §1 |
| #176 | `m-n2`/`m-n3` с `col`/`vtype`; `!martCol('m-n3')` → нет ни записи, ни ожидания | иначе пару отбил бы каталог раньше имени |
| #177 | `m-s3` с `col:'i_s3'` (`money_cur`) | каталог |
| #179 | `m-r5` с `col:'i_r5'` (`money_cur`) | каталог |
| #180 | «ADD COLUMN, ADD COLUMN, nullable» → `migrate` `i_t9_v/_som`, затем дверь: включена без ожидания, `cols`/`somCols`, релиз дверью не тронут | ADR-0237 §2, §3 |
| #181 | «колонок витрины = записей, сомовых 74» → с колонками 191, агрегатов 117 (сумма 308), сомовых близнецов с колонкой 37, ждущих 0 | у агрегата колонки нет (§5) |
| #183 | `m-q7` с `col:'i_q7'` (`money_cur`) | каталог |
| #188 | `migrate` `i_w17` у программы → затем `m-w17` включена сразу; `martCol` → `colOf` | ИС-53; путь «ждёт → миграция» держит #245 |

- Сегменты #1 и #155 изменились только комментариями шапки и блока АВ.
- Надгробий нет: ни один сторож не снят. Номера #240–#249 идут подряд.

**`obj-guarantee` (решение G).**

- **#9** (блок C) — через `migrateTable`. Сторож доказывает путь «миграция → объект →
  записи»: без таблицы отказ ИС-53, с таблицей всё включено.
- **#89, #152** — через `migrateTable`. Их причина — рождение (ИС-33) и объект определения
  (ИС-40); без таблицы они отбивались бы про релиз.
- **#243** — отказ без таблицы, новый сторож.
- **#10** (`obj-ghost`) держится порядком проверок: множество владельца раньше таблицы.
- **`addObjUI`** — демонстрация отказа.
- Упомянутые в решении G «волны 1, 12, 13, 17» — это блоки #9, #89 и #152. Других
  `addObject('obj-guarantee')` в смоуке нет.

**Мутации** (копия в scratchpad, смоук с выводом в файл). Все 12 пойманы.

| № | мутация | упали |
|---|---|---|
| 1 | сверка не вынимает запись из состава (`dropFromObjects` снят) | #240 |
| 2 | дверь включает, не спросив релиз (`waiting = false`) | #163, #241, #245, #246, #247, #248, #249 |
| 3 | `addObject` без проверки таблицы | #9, #243 |
| 4 | `ST.mart = () => []` | #244 |
| 5 | миграция не сверяет заново (решение B) | #245, #247, #249 |
| 6 | нет проверки `money_som` (решение F) | #246 |
| 7 | пара решается по одной половине (решение D) | #247 |
| 8 | каталог первым (решение C) | #9, #39, #51, #149, #157, #158, #164, #167, #168, #176, #177, #179, #183, #193, #246 |
| 9 | уровень со своим источником без колонки пропущен (решение E) | #248 |
| 10 | сироты не ищутся | #163, #241, #245 |
| 11 | агрегат не ждёт основание (СС-155) | #240, #249 |
| 12 | вопрос не спрашивает ожидание (СС-155) | #245, #249 |

- **Мутация 1 против #240 из брифа выжила** (242/242). На демо-релизе ждущих нет, и сверка
  ничего не вынимает. Поэтому #240 получил вторую половину — колонки вынимаются из `RELEASE`.

**Решения.**

- **СС-154 — уровень иерархии без колонки.**
  - Уровень `справочник` может не иметь колонки: он выводится при чтении из уровня ниже
    (`readPath`, ADR-0241 §3). Пример — «группа» у `d-subgroup` и `d-csolv`.
  - Уровень со своим источником без колонки на двери отбит поимённо, а при сверке ждёт. Хотя бы
    один уровень несёт колонку.
  - Почему: строгое чтение решения E поставило бы `d-subgroup` и `d-csolv` в ожидание, и #240
    не прошёл бы.
- **СС-155 — агрегат над ждущим основанием ждёт вместе с ним**, включается той же миграцией.
  Вопрос к ждущей записи — отказ «ждёт колонку (ИС-53)», и у разреза, и у показателя.
  - Найдено самопроверкой: без решения свод над ждущим показателем включался сразу и отвечал
    `0` — придуманное наблюдение. Разрез отбивался составом объекта, но отказ называл «чужой
    объект определения».
- **СС-156 — отдельная дверь `ST.migrateTable` для новой таблицы.** `ST.migrate` таблиц не
  заводит.
- **СС-157 — порядок `addObject`:** множество владельца раньше таблицы. Без множества объекта
  нет, и никакой релиз его не создаст.
- **СС-158 — у агрегата `col`/`vtype`/`levels` — отказ.** Колонка у агрегата была бы второй
  копией свода (ИС-3).
- **СС-159 — миграция не спрашивает прав администратора.** Это выкладка, а не действие в
  модуле.

**Находки.**

- **СС-Д21 — доводы движка цитируют снятый ИС-18.**
  - Где: «объекта нет в реестре объектов (ИС-18)» ×5, объект определения «(ИС-18, ИС-40)»,
    «тем же читателем (ИС-18)» в комментариях.
  - Смысл жив как ADR-0237 §7 и ADR-0149 в неснятой части. Сторожа #121 и #156 проверяют
    строку «ИС-18» в отказе.
  - Переписать отдельной правкой вместе с этими двумя сторожами. В шапке это оговорено.
- **СС-Д22 — (объект, `col_name`) в схеме §12.1 не уникален, и это верно.** Одна величина в двух
  ролях лежит на одной колонке:
  - `d_worst` (`d-bworst`/`m-bworst`);
  - `i_overdue_days` (`d-odays`/`m-odays`);
  - `i_worst_days` (`d-bodays`/`m-bodays`).
  - Ограничение уникальности ставить нельзя.
  - Пара `d-bworst`/`m-bworst` связана не `basis`, а одним швом и полем — связь неявная,
    ADR-0209 §5.
- **СС-Д23 — ADR-0237 §5 молчит про агрегат над ждущим основанием.** В макете решено СС-155.
  Долг бумаге — ADR и ТЗ 19.
- **СС-Д24 — у `stat_registry_level` нет `value_type`.** Уровень подгруппы — `cls` (три
  колонки: `_code`, `_lbl`, `_ord`), уровни территории и подразделения — `ref` (две). По схеме
  суффиксы уровня не вывести.

### З-14, правка ревью 1

Ревью нашло три важных дефекта и один пропуск правила плана. Исправлены новым коммитом поверх
`18de476`; каждый дефект держит свой сторож. Решения СС-154 и СС-155 контролёр принял.

1. **Дверь периода отвечала ждущей записи нулём.** `ST.flowBetween` шёл мимо `checkQuery`, и
   `divergence` тоже. Теперь обе двери после поиска записи спрашивают `waitsCol` и отказывают
   `waitsWhy`.
   - Сторож **#250**: ждущий поток спрошен тремя дверями — период, расхождение, ряд. Все три
     отказывают «ждёт колонку (ИС-53)», и числа ни одна не даёт. Контроль: включённый
     `m-accr` дверь периода по-прежнему считает.
2. **Миграция возвращала прекращённую сторону ждущей пары.**
   - `pairOf` не берёт прекращённых.
   - `includeRec` прекращённую не включает.
   - `migrate` снимает прекращённую с ожидания и не включает её.
   - **`ST.retire` прекращает пару целиком** — какую сторону ни назови, и у ждущей, и у
     включённой пары (СС-160). Проверки агрегатов, корзин, дедупа и ссылок идут по обеим
     сторонам.
   - `ST.colOf` у прекращённой строчной записи говорит «прекращена».
   - Сторож **#251** проверяет три случая:
     - ждущая пара: прекращена валютная сторона → прекращены обе, из ожидания ушли обе,
       миграция их колонок никого не включила, история «заведена, ждёт колонку → прекращена»;
     - включённая пара: прекращена сомовая сторона → прекращены обе, в составе ни одной;
     - страховка миграции: пара, прекращённая данными мимо двери (дата подложена руками),
       не включается и снимается с ожидания.
3. **Денежная запись с видом `num` схлопывала пару в одну колонку.** `checkCatalog`: у денежной
   записи вид только `money_cur` или `money_som`; денежный вид — только у денег (ADR-0240 §1,
   §2, §4, схема §12.1). Близнец наследует вид своей записи и проверку проходит.
   - Сторож **#252**: отбиты четыре записи — `money` + `num`, `money_cur` без `money`,
     `money_som` без `money`, разрез с `money_cur`. Ни одна не оставила записи. Годная пара
     получила две разные колонки.
4. **#128** (правило плана). Довод «владелец заведён СТРОКОЙ реестра (ИС-18)» переписан: у
   владельца своя таблица строк в релизе и запись реестра объектов (ИС-53, ADR-0237 §5).
   - В сторож добавлены проверки: таблица `stat_row_zdeal` в релизе, в ней `d_zdate`, запись
     `d-zdate` включена.
   - Тексты отказов движка с «ИС-18» не тронуты — это СС-Д21, отложено.

**TDD.**

- **RED:** 243/246, упали #250, #251, #252.
  - #250: отказал только ряд. Период и расхождение ответили.
  - #251: сомовая сторона не прекращена; миграция вернула обе (`m-w23r`, `m-w23r-som`); история
    «… → прекращена → включена».
  - #252: ни один из четырёх отказов.
  - #128 прошёл сразу: правка текста и проверки того, что уже верно.
- **GREEN:** 246/246 PASS, exit 0, 0 FAIL (вывод в файл).

**Мутации** (копия в scratchpad; каждая откатывает правку).

| мутация | упали |
|---|---|
| период без `waitsCol` | #250 |
| расхождение без `waitsCol` | #250 |
| правка 2 целиком (`pairOf` с прекращёнными, `retire` по одной записи, включение без `until`) | #251 |
| `retire` прекращает только названную сторону | #251 |
| `pairOf` и миграция не смотрят `until` | #251 — ловит страховка, подложенная в #251 |
| деньги на любом виде значения | #252 |

- Первые 12 мутаций З-14 перепроверены на исправленном движке: все пойманы. Мутация 7 теперь
  ловится ещё и #252.

**Решение.**

- **СС-160 — пара прекращается целиком**, какую сторону ни назови, и у включённой пары тоже.
  Это решение D, доведённое до двери прекращения.
  - Прежде прекращение валютной стороны оставляло сомовую действующей. #58 (прекращение
    `a-sumdebt`) теперь прекращает и `a-sumdebt-som`; сторож это не проверял и проходит.

### З-15a — срез на начало дня: канун и период строки (`ИС-54`, `ADR-0238` §2, `ADR-0245` §8, §9)

**Движок.**

- Новые примитивы после `monthEnd`: `dayShift(d, n)`, `eveOf(d) = dayShift(d, -1)`,
  `worldAt = eveOf`, `periodOf(d) = ym(eveOf(d))`, `sliceOfMonth(m) = first(nextM(m))`; двери
  `ST.periodOf`, `ST.sliceOfMonth`, `ST.worldAt`.
- `preLaunch = d => d <= LAUNCH` (было бы `d < LAUNCH` — граница запуска теперь ВКЛЮЧАЕТ сам
  `LAUNCH`: строка `01.05.2026` смотрит на канун `30.04.2026`, ещё легаси-сторону; первая своя
  строка — `02.05.2026`).
- Четыре «двери в мир» читают на канун (`СС-161`): `readSrc` (ветка «история»), `askSeam`
  (оба вызова `CORE.read`), `readIndRaw` (ветка «поле», курс), `movedCurs` (оба края окна
  курса). `CORE.objectRows(at)` и `checkQuery`'s `D.since > q.date` НЕ тронуты — решение
  осталось в силе.
- Рождение — строго (`bornAt >= dateISO` значит «ещё не рождён»): `eachAlive`, `candidatesOf`
  (оба места), `queueRegChange`, `ST.registryList`, один экран (список «родившихся»).
- Период строки — `periodOf` вместо `ym` везде, где считается принадлежность строки периоду:
  `fixMonth`/`unfixMonth`, `loadLegacy` (`fixed.period` и обе выборки `uniq(dates.map(...))`),
  `ST.isClosed`, `ST.fixationOfMonth`, `markExports`, `latchFor`, `divergenceNote`,
  `ST.periodBlockers` (оба фильтра), `ST.run` (текст отказа «период зафиксирован»).
- Итог месяца — `sliceOfMonth` вместо `monthEnd`: `repoll`, `ST.divergence`, `ST.seriesDates`,
  `closeLayerCheck` (текст отказа «период ещё не завершён» вместо старого монтэнда).
- Граница запуска — `preLaunch` вместо прямых сравнений с `LAUNCH`: `rowsAsOf`, `resolveAsOf`,
  `dateGate` (четыре места), `ST.run` (отказ «прогон … не запускается: срез на начало дня
  видит мир на конец `eveOf(dateISO)`, а это раньше запуска»).
- `LEGACY.totals`: каждый ключ +1 день (все шесть концов кварталов → первые числа следующего
  квартала); суммы итогов не тронуты. Комментарий над `totals` объясняет почему («ключи —
  СРЕЗЫ на начало первого числа»).
- `seed()` (`СС-162`, демо-календарь целиком на +1): `today`/`q.date` = `2026-08-22`, поток
  `16.07…19.08`, прогоны `01.06/01.07/01.08/11.08/19.08`, пропуск `20.08`, хвост-прогон
  `21.08`. Даты закрытий мая и июня (`'2026-06-05'`…`'2026-07-09'`) НЕ тронуты — это факты
  мира, а не срезы (`СС-162`).
- Экраны: варианты потока (`13.05.2026`/`16.07.2026`), `ST.runClosedUI`
  (`ST.run('2026-07-01', {})`), подпись кнопки «Попробовать переписать 01.07 (закрыт)»,
  `ST.exportClosedUI` (`date:'2026-06-01'`).

**Новые сторожа `#253`–`#255`** (текст и код — дословно из брифа):

| № | что держит |
|---|---|
| #253 | период строки = месяц кануна (`periodOf('2026-07-01')`→«2026-06», `periodOf('2026-07-02')`→«2026-07», `periodOf('2026-01-01')`→«2025-12»); итог месяца = первое число следующего (`sliceOfMonth('2026-06')`→«2026-07-01», `sliceOfMonth('2026-12')`→«2027-01-01»); защёлка июня фиксирует строку `01.07` восемью кредитами, все с периодом «2026-06»; прогон за `01.07` отбит как за закрытый июнь, за `02.07` идёт |
| #254 | все четыре двери мира читают канун разом: курс USD строки `01.07` несёт ставку от `30.06` (а собранной на `30.06` — от `31.05`); история куратора КД-2024/117 меняется `15.07` — срез `15.07` его ещё не видит, `16.07` видит; платёж ПГ-2026/1102 от `05.06` не значится в срезе `05.06`, значится в срезе `06.06` — событие дня D лежит в строке D+1 |
| #255 | легаси-итоги — только первые числа (6 дат: `2025-01-01`…`2026-04-01`), период каждой строки — месяц кануна (итог «на 31.03.2026» лежит строкой `01.04` и принадлежит марту); срез `01.05` — ещё легаси-сторона (граница запуска инклюзивна, `preLaunch`), прогон отбит границей запуска, а не «периодом»; `02.05` — своя сторона, отбита уже закрытым маем |

**TDD.**

- **RED** (копия HEAD-движка + HEAD-смоука + добавленный дословно блок `#253`–`#255`,
  scratchpad): `246/249 PASS`, упали ровно `#253`, `#254`, `#255`, `exit=1` — совпадает с
  ожиданием брифа (`ST.periodOf`/`ST.worldAt` не определены, кредитные строки на `01.07` не
  находятся, легаси-даты стоят на концах кварталов).
- **GREEN** (репозиторий, `node scripts/inspect/statistics-check.mjs`): `249/249 PASS`,
  `exit=0`.

**Смоук — даты срезов и помощник `eve`.**

- Добавлен `const eve = d => new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10);`
  сразу после `has`.
- `TODAY`: `2026-08-21` → `2026-08-22`; `ASK`: `2026-08-20` → `2026-08-21`.
- Сдвиг применён ОДНИМ проходом — `re.sub` с единой альтернацией по словарю замен поверх
  ПЕРВОЗДАННОГО файла (без ручных правок до прохода), а не последовательными точечными
  правками: иначе значение, уже сдвинутое одним ключом словаря, могло совпасть со СЛЕДУЮЩИМ
  ключом и сдвинуться повторно. В первом заходе я нарушил это правило (см. «Находки») и
  переделал по порядку.
- Затронуты (даты-аргументы `ST.run`/`ST.skip`/`ST.rowsAt`/`ST.rowsAsOf`/`ST.dateGate`/
  `ST.registryList`/`ST.buildRow`/`ST.isClosed`, `date`/`dates`/`from`/`to` вопросов, строки
  `dd.mm`/`dd.mm.yyyy` в `has(…)` и текстах, легаси-даты, `st.today` в `T`) — сторожа
  `#1`, `#3`, `#11`–`#14`, `#17`–`#23`, `#27`, `#28`, `#30`–`#32`, `#37`, `#38`, `#40`, `#66`,
  `#72`, `#73`, `#86`–`#89`, `#91`, `#99`, `#100`, `#109`–`#111`, `#121`, `#129`–`#131`,
  `#136`, `#139`–`#147`, `#153`, `#157`, `#163`, `#172`, `#182`–`#204`, `#208`–`#215`,
  `#218`–`#229`, `#250`. Номера и утверждения не менялись — только даты, которыми сторожа
  спрашивают (кроме двух исключений ниже, где даты изменили и сам результат).
- Не сдвинуты, как предписано: `rateDate` в `#27`, `#28`, `#172` и в прямых пробах
  `CORE.toSom`; 4-й аргумент `ST.closeLayer`; даты историй `WORLD` внутри `#218`; `fixed.at`;
  тексты распоряжений/актов и текст `LAUNCH`; штамп `SMOKE`.
- Проверка остатка — `grep -nE "'2026-0[5-8]-(31|30|18|19|20|10)'|'2025-(03|06|09|12)-3[01]'|'2024-12-31'" scripts/inspect/statistics-check.mjs`
  — все совпадения это либо уже корректно сдвинутые НОВЫЕ значения (пересечение окон замены,
  например новые прогонные даты `'2026-08-19'`/`'2026-08-20'`), либо защищённые `rateDate`.
  Висячих старых литералов не осталось.

**Переписано на месте — курс «к срезу» ставится на канун** (даты, а не утверждения):

| № | было → стало | почему |
|---|---|---|
| #187 | `RATES.USD.push([ASK, 90.15])` → `push([eve(ASK), 90.15])`; `(cell187.parts\|\|[]).every(p => p.rateDate === ASK)` → `=== eve(ASK)` | прогон за `ASK` читает мир на `worldAt(ASK) = eve(ASK)` (ИС-54) — курс, поставленный ровно на `ASK`, не попадал в окно `movedCurs` |
| #202 | `RATES202.USD.push([TODAY, 91.10])` → `push([eve(TODAY), 91.10])` | то же: окно `movedCurs` — `(worldAt(since), worldAt(TODAY)]` |
| #211 | `RATES.USD.push([J, 91.10])` → `push([eve(J), 91.10])` | доспрос слепка `J` видит мир на `worldAt(J) = eve(J)` |
| #212 | тот же приём | то же |

Проверено напрямую (без правки чисел): после переноса даты все прежние утверждения — числа
`#187` (`written=6, same=70, rewrote=2, born=0, kept=0`), состав кандидатов `#202`
(`kd202.length=6`, `run202.written=34`), состав переписи `#211`/`#212` — сошлись БЕЗ единой
правки литералов результата.

**Переписано на месте — числа, прямое и проверенное мутацией следствие строгого рождения
(`bornAt >= dateISO`, ИС-54, а не признак ошибки в дверях мира):**

| № | было → стало | почему | как проверено |
|---|---|---|---|
| #143, #144 | локальный помощник `mFixed = m => rows.filter(r => r.date.slice(0,7)===m && r.fixed)` → `filter(r => ST.periodOf(r.date)===m && r.fixed)`; те же две строки контрфакта в `#144` (`if(r.date.slice(0,7)==='2026-05')` → `if(ST.periodOf(r.date)==='2026-05')`, дважды) | месячный слепок мая лежит СТРОКОЙ `01.06` (период мая, а не литерал мая) — счёт по литералу датой не находил ни одной зафиксированной строки | без правки `mFixed('2026-05')` возвращал `0` вместо `42`; с `ST.periodOf` — `42`; оба сторожа зелёные, ни одно другое утверждение не изменилось |
| #186 | `run186.written` `36→33`, `run186.born` `7→4`; `cp186.fixed` `99→96`; окно `july186` — с `r.date >= '2026-07-01' && r.date <= '2026-08-01'` на `ST.periodOf(r.date) === '2026-07'`, `july186.length` `99→96` | три записи с датой рождения ровно `15.07` в срезе `15.07` ещё не рождены (видны с `16.07`, ИС-54); а строка `01.07` принадлежит ИЮНЮ (закрыта его закрытием), а не июлю — окно периода обязано считаться по `ST.periodOf`, не по литералу | мутация «вернуть `bornAt > dateISO`» в `eachAlive`/`ST.registryList` (копия движка) точно восстановила `36/7/99` — причина изолирована и подтверждена |
| #191 | `rp191.passport.dense` `4→2` (`carried` не изменилась, `4`) | два платежа с датой поступления ровно `15.07` в срезе `15.07` ещё не рождены | та же мутация восстановила `4`; сырые строки (`ST.rowsAsOf`) вручную дают `2` своих + `4` перенесённых = `6`, а не `8` |

Обе категории выше — не «сторож упал по числу, значит где-то не поставлен `worldAt`»
(предостережение брифа, Step 5): причина в КАЖДОМ случае найдена и подтверждена мутацией или
прямым пересчётом, а не предположена. `#254` брифа проверяет ровно тот же механизм на своём
собственном примере («платёж от `05.06` не значится в срезе `05.06`») — `#186`/`#191`
столкнулись с ним потому, что их пробные даты (`15.07`) случайно совпали с датой рождения
конкретных записей демо-мира.

**Мутации** (копия движка в scratchpad; смоук — из репозитория, без изменений). Все 5 из
брифа пойманы:

| № | мутация | упали |
|---|---|---|
| 1 | `const periodOf = d => ym(d);` | смоук падает КРАХОМ раньше сторожей — экран «Журнал» (`#44`, второй непойманный вызов `ST.go('journal')`): `ST.fixationOfMonth('2026-05')` → `null` → `TypeError` на `.by`. `#253` сам поймал бы её первым же условием (период `01.07` вышел бы «2026-07», а не «2026-06»), но крах наступает раньше по тексту файла |
| 2 | `const worldAt = d => d;` | `243/249`: `#254` (целевой) + коллатераль `#31`, `#202`, `#212`, `#214`, `#227` — курс и история читаются без кануна везде разом |
| 3 | нестрогое рождение (`bornAt > dateISO`) в `eachAlive` и `ST.registryList` | `243/249`: `#254` (целевой) + коллатераль `#184`, `#186`, `#191`, `#211`, `#212` — ровно те сторожа, что переписаны числами выше, откатываются к своим СТАРЫМ значениям |
| 4 | `LEGACY.totals` — ключи обратно на концы кварталов | `247/249`: `#255` (целевой) + коллатераль `#226` |
| 5 | `const preLaunch = d => d < LAUNCH;` | `248/249`: только `#255`, без коллатерали |

**Находки.**

- **Двойной сдвиг смоука** (самоисправлено в процессе, до коммита). Ручная правка
  `TODAY`/`ASK` на конечные значения ДО прогона блочного `re.sub`-сдвига дала повторный
  сдвиг: уже верное `ASK='2026-08-21'` совпало со СТАРЫМ ключом словаря замен (тем же текстом,
  который сам был целью более раннего правила) и сдвинулось ещё раз — в `'2026-08-22'`, попутно
  испортив дословно вставленный блок `#253`–`#255` (их собственные пробные даты — не срезы
  модели, а фиксированные примеры из брифа, и под блочный сдвиг попадать не должны были).
  Восстановлено `git checkout -- scripts/inspect/statistics-check.mjs`; порядок исправлен:
  сначала блочный сдвиг по первозданному файлу, потом ручные вставки (`eve`, шапка, блок
  `#253`–`#255`) поверх уже сдвинутого.
- **`#203`** держал литерал «TODAY+1» (`'2026-08-22'` при старом `TODAY='2026-08-21'`) как
  самостоятельную пробу «взгляд на завтра», а не как значение самого `TODAY`. Блочный словарь
  не мог его тронуть (это не КЛЮЧ словаря, а число, совпавшее с НОВЫМ значением `TODAY`), и
  после сдвига проба стала указывать на СЕГОДНЯ вместо ЗАВТРА (`TypeError` на
  `next203['ядро'].from`). Поправлено вручную на `'2026-08-23'` (оба места — аргумент
  `ST.candidates` и сравнение `.to`), подтверждено разбором `git show HEAD` — исходное
  значение действительно было «TODAY+1», а не «TODAY».
- Ключ повода в `#197`…`#200` (`'…/с-2026-08-21'`) сдвинулся блочно вместе с `ASK`, без
  ручного вмешательства.
- Долг бумаге — нет: задача техническая (перенос модели хранения), комментарии в движке уже
  цитируют `ИС-54`/`ADR-0238`/`ADR-0245` по месту.

### З-15b — строка каждый день: копия, догон, кэш демо-мира (`ИС-54`, `ADR-0238` §1, §4; `ADR-0245` §2, §6)

**Движок.**

- `newTally`/`partOf`: счётчики `copied` и `written` (`СС-164`); комментарий над ними —
  тождество состояния `written = n + same + copied`, `n + same + copied + kept` = живые,
  `skip` только у событий.
- Между `deq` и `doRun` (код брифа дословно): `storageOf` + `ST.storageOf`, `CATCHUP_SCAN`,
  `REOPEN_SCAN` (заведён для З-15c, пока не используется), `fullScan`, `copyRow`, `NIGHTLY`,
  `gapsBefore`, `catchUp`.
- `doRun(st, dateISO, kind, actor, reason, silent, how)` — тело брифа; прежние комментарии,
  чьё правило живо, перенесены (снятие очереди обходом, неполнота написанной строки,
  возврат неполной в очередь, перезапись как событие журнала `ADR-0215` §6, `silent`/`cand`
  записи журнала), ссылки на `ИС-45` как на действующее правило переписаны под `ИС-54`.
  Сторож `#5` (слова предметной области в `doRun`) зелёный.
- Вводный комментарий раздела «РАЗРЕЖЁННОЕ ХРАНЕНИЕ» → «СТРОКА КАЖДЫЙ ДЕНЬ (ИС-54, ADR-0238
  §1)»; абзац «ГРАНИЦА ЭТОЙ ВОЛНЫ» оставлен (с пометкой «волна 17 ч.7»). В абзаце про `when`
  «ночь написала бы строку каждому объекту» → «ночь посчитала бы изменившимся каждый
  объект»: строку ночь теперь пишет всем состояниям и так.
- `ST.run`: отказ-пропуск по календарю (`ADR-0245` §6, `{ok:false, skipped:true, why}` +
  запись «пропуск» в журнале), догон перед ночью, в ответе `copied`, `caught`, в журнале
  «скопировано — N» и «догнано — …». `ST.catchUp(dateISO)` рядом.
- `seed()`: суточные ночи 02.05…21.08, пропуск 20.08 догоняется ночью 21.08; вместо двух
  `Object.defineProperty` — `defineViews(st)`. `ST.seed(fresh)` с кэшем, `ST.seedCache()`;
  `ST.state = ST.seed()`.
- **Отступление от брифа 1 — `repoll`.** Защёлка теперь считает `t.written` там же, где
  `written` записи (дописано и переписано). Без этого часть журнала защёлки несла бы
  `written: 0` при `written: 19` у записи, и переписанный по брифу `#63` («сумма `p.written`
  = строк прогона») падал бы: последняя запись с частями после сида — защёлка июня, а не ночь.
- **Отступление от брифа 2 — отпечаток кэша.** В `seedPrint` добавлен `CORE.DATING`:
  объявленная датировка швов ложится в `when` каждой строки (`CORE.stamp`), то есть это вход
  сборки мира, а `#211` правит её в песочнице. Сегодня `#211` правит её уже после `ST.seed()` и
  возвращает до следующего — устаревшего попадания не было бы, но `СС-166` требует отпечаток
  ВСЕХ данных мира. Прочие изменяемые смоуком глобалы песочницы (`CARD`, `ORDERS`, `ROLLS`,
  `SHOWN`, `CONSUMERS`, `F_*`/`FIELDS`) сборкой мира не читаются.
- Проба `JSON.parse(JSON.stringify(seed()))`: равен по `JSON.stringify`; обходом сырого
  состояния — `undefined` 0, функций 0, не-плоских объектов 0, общих ссылок 0, аксессоры только
  `indicators`/`dims`. Сид без кэша 2,6 с, мир — 16,7 МБ JSON, разбор копии ~60 мс.

**Новые сторожа `#256`…`#259`** (текст и код — дословно из брифа):

| № | что держит |
|---|---|
| #256 | строка на каждую дату у 7 объектов-состояний на 51 дату открытого периода, дыр 0; ночь 22.08: написано 42, скопировано 12 = некандидатов по двери `ST.candidates`; копия равна вчерашней значениями и происхождением; событий не копируется; тождество части |
| #257 | догон 22.08, 23.08 дверью `ST.catchUp` и 24.08 — прогоном 25.08; догон полным обходом и `T` не двигает; повторный догон пуст; период без календаря — пропуск с `ADR-0245 §6` |
| #258 | повторный прогон за 21.08 — полный обход: копий 0, строк состояний 42, у кредитов переписан 1 на месте, дублей адреса 0, строки 22.08 не тронуты |
| #259 | кэш отдаёт независимую копию, мир мимо кэша равен кэшированному, ключ — отпечаток (уточнённый курс EUR — промах, возврат — попадание), ключей ≤ 3 |

**TDD.**

- **RED** (репозиторий: HEAD-движок + блок `#256`…`#259` дословно;
  `node scripts/inspect/statistics-check.mjs`): `249/253 PASS`, `exit=1`, упали ровно `#256`
  (объектов-состояний 0, скопировано `undefined`), `#257` (нет `ST.catchUp`, дыр 11),
  `#258` (строк состояний 0, копий `undefined`), `#259` (нет `ST.seedCache`) — как в брифе.
- Движок без переписки сторожей: `229/253`, 24 FAIL — `#11`, `#20`, `#30`, `#109`, `#116`,
  `#130`, `#144`, `#172`, `#184`…`#188`, `#190`…`#192`, `#200`…`#202`, `#206`, `#211`,
  `#212`, `#226`, `#228` (`#189` из снимаемых проходил и так).
- **GREEN** (репозиторий): `244/244 PASS`, `exit=0` (249 + 4 новых − 9 надгробий).

**Надгробия `#184`…`#192`.** Блок АЕ снят вместе с подготовкой; заголовок блока оставлен с
пометкой «снят волной 23 (З-15b)» и абзацем, почему. На месте каждого — надгробие со ссылкой
на `ADR-0238` и держателем смысла:

| № | что проверял | держит |
|---|---|---|
| #184 | разрежённость по факту: строк меньше, чем живых на даты прогона | #256 |
| #185 | три ответа паспорта: есть · не менялось · подстановка | #261 (два ответа) |
| #186 | плотный слепок на закрытии, разрежённая середина | #260 |
| #187 | перезапись в открытом периоде с журналом | #258 |
| #188 | запись посреди периода: `skip` без досчёта | #245 |
| #189 | фиксация — свойство периода, а не набора строк | #253, #22 |
| #190 | одна дверь чтения: `rowsAt` ≠ `rowsAsOf` | #256, #261 |
| #191 | подпись фиксации — у защёлки периода | #253, #15 |
| #192 | плотность — свойство даты, у ряда её нет | #261 (плотности нет вовсе) |

`#260`, `#261` заводит З-15c — ссылки вперёд, как в таблице брифа.

**Переписано на месте — счёт строк и ночей** (утверждение прежнее):

| № | было → стало | причина |
|---|---|---|
| #11 | плановых 6 → 111; добавлено: запись «догон» за 20.08 ровно одна | ночь каждый день, пропуск догнан |
| #20 | срез 20.08: `asOf` 19.08 → 20.08, возраст 1 → 0, `substituted`/`skipped` не читаются (снимает З-15c); добавлено: за 20.08 в журнале и пропуск, и догон | дата пропуска отвечает своей строкой (`ADR-0238` §4) |
| #30 | `baseDate` 01.07 → **15.07**, `baseNote` без «вместо» | база — своя строка (`ADR-0238` §6). Бриф называл 16.07, но сторож спрашивает поток `from: '2026-07-15'` (З-15a сдвинула поток по умолчанию сида, а не этот вопрос), и своя база — 15.07 |
| #63 | сумма `p.n` → сумма `p.written`, объект с нулём — по `written` | по брифу (`СС-164`). Сторож не падал: последняя запись с частями после сида — защёлка июня, у неё `n = written`; см. отступление 1 |
| #130 | дат 12 → 118, прогонных 6 → 112; добавлено: 20.08 среди дат | ночь каждый день, 20.08 — строкой догона |
| #144 | `reRun.same`/`keptRun.kept` сравниваются со строками даты 01.06 (42), а не со всем периодом мая (теперь 1208); `reRun.written` 0 → 39 (строки состояний на дату), добавлено `reRun.rewrote === 0` | в периоде мая строка каждого дня; у состояния строка на дату засчитана подтверждённой (`СС-164`) |
| #172 | строк 248 → 4535, прогонов 6 → 112, сомовых клеток 2023 → 33 889, итогов 576 → 10 680; расхождений по-прежнему 0 | счёт строк |
| #200 | «строк, равных предшественнице» — только у событий (0); у состояний их 12 (копии), печатается | у состояния равная вчерашней строка — правило `ИС-54`, у событий следствие в силе (`СС-167`) |
| #201 | написано 30 → 42, скопировано 12, не обойдено 46 → 34, `written + skip = 76`; разрежённость на 01.08 — только по состояниям: 6 → 0 до закрытия, 0 после | по брифу |
| #202 | `flat202.written` 30 → 42; «+4» осталась | проверено пробой: +4 — погашения 2 и поступления 2 (события, переписанные курсом, `СС-167`); строки состояний есть в обеих ночах |
| #206 | написано 30 → 42, скопировано 11, без изменений 1, не обойдено 45 → 34 | по брифу |
| #211 | дописано 20 → 19; добавлено: состояний среди дописанных 0 (по частям журнала защёлки) | см. находку 2 |
| #212 | дописано 20 → 19 (оба закрытия), всего 24 → 23, зафиксировано 63 → 1276; переписано — прежние 4 | то же; в периоде июля строка каждого дня |
| #226 | дат 12 → 118, прогонных 6 → 112; ворота «разрыв между итогом и первым прогоном» — на построенном мире; добавлено: в демо-мире 15.05 ворота пропускают | см. находку 3 |
| #228 | `run228.written` 30 → 42 | по брифу |

Из названных брифом не падали и не тронуты: `#209`, `#210`, `#213`, `#214`, `#215`, `#229`
(`#229` — сторож корешков конструктора, с прогоном не связан; видимо, описка брифа).

**Переписано на месте — ЗНАЧЕНИЕ величины, доказанное следствие модели** (приём З-15a: мутация
в копии возвращает прежнее число):

| № | было → стало | почему | как проверено |
|---|---|---|---|
| #109 | поток KGS 16.07→19.08: 825 500 → 305 500 сом. | база 15.07 теперь своя строка, а не 01.07, подставленная ближайшей раньше (`ADR-0238` §6 переписывает `ADR-0151` §6); погашенное 01.07…15.07 (520 000) в интервал больше не входит | мутация «прежний календарь ночей сида» (01.06, 01.07, 01.08, 11.08, 19.08, 21.08) возвращает ровно 825 500 |
| #116 | история сопоставления ПП-2026/0620: «отозвано → восстановлено» → «подтверждено → отозвано → восстановлено»; строки упорядочиваются по дате | ночь каждый день видит каждую смену оси (мир: 10.06, 22.06, 04.07); порядок вставки хранилища больше не порядок дат — защёлка июня дописывает строку 01.07 («отозвано», `by: 'защёлка'`) после всех ночей, и без сортировки хвост был бы ложным «→ отозвано» | та же мутация: отсортированная дорожка снова «отозвано → восстановлено»; порядок строк проверен пробой |

Той же мутацией `#30` возвращается к «база периода: 01.07.2026 вместо 15.07.2026».

**Мутации** (копия дерева в scratchpad, одна копия на мутацию; смоук — копия репозиторного):

| № | мутация | упали |
|---|---|---|
| 1 | в `doRun` некандидату вместо копии `t.skip++` | `236/244`: `#256` (целевой) + `#172`, `#200`, `#201`, `#206`, `#211`, `#212`, `#257` |
| 2a | в `ST.run` без `catchUp` (`caught = []`) | `243/244`: только `#257` |
| 2b | `ST.catchUp` возвращает `gapsBefore` без прогона | `243/244`: только `#257` |
| 3 | догон с `keepT: false` | `243/244`: только `#257` (`T1 !== T0`) |
| 4 | перезапись существующей строки — `st.rows.push(row)` вместо `st.rows[i] = row` | `238/244`: `#258` (целевой) + `#195`…`#198`, `#200` |
| 5 | кэш хранит объект, а не строку, и отдаёт его без копии | смоук падает КРАХОМ раньше `#259` — на `#32` (`TypeError` на `past.why`): состояние, поправленное одним сторожем, доехало до следующего. `#259`, исполненный отдельно на той же копии движка, — FAIL («сегодня 2030-01-01», строк 4568 у обеих копий); на движке репозитория — PASS |
| 6 | из `seedPrint` убран `RATES` | `243/244`: только `#259` |

Контроль прозрачности кэша: смоук на копии движка, где `ST.seed` каждый раз собирает мир
заново и отдаёт его без JSON-копии, — `243/244`: упал только `#259` (промахов 0 — статистика
кэша без кэша бессмысленна); строки остальных 243 сторожей совпали с прогоном с кэшем байт в
байт. Кэш, значит, ответов не меняет. Тот же смоук без кэша шёл ~7 мин 15 с против 24,6 с.

**Время смоука.** HEAD `fbb3a11`: 29,4 с. После З-15b: 24,6 с (под параллельной нагрузкой —
до 29,6 с) — быстрее, хотя ночей в сиде 111 вместо 6: кэш заменил ~140 сборок мира разбором
копии. Кэш за прогон смоука: попаданий 139, промахов 4 — загрузка файла, `#240` (релиз без двух
колонок, возвращается в `finally`), `#259` мимо кэша (`ST.seed(true)`) и `#259` с курсом EUR;
ключей в конце 3.

**Находки.**

1. **`#30` в брифе — 16.07, в стороже — 15.07.** Бриф писался по потоку сида по умолчанию
   (`16.07…19.08`, З-15a), а `#30` (и `#109`) спрашивают поток с `'2026-07-15'`. Утверждение
   «база своя, без „вместо“» держится на своей дате вопроса — 15.07.
2. **Закрытие дописывает не 0 строк, а 19 — все строки событий** (погашения 8, поступления 8,
   меры 3). У состояний строка первого числа уже есть, и дописано им 0 — это `#211` теперь
   проверяет по частям журнала. События до З-16 пишутся при изменении (`СС-167`), а плотный
   слепок защёлки (`ADR-0215` §4) ещё жив и дописывает им строку первого числа; его снимает
   З-15c (закрытие в две фазы). Бриф ожидал 0 для всех `#209`…`#215`.
3. **Третьи ворота `#226` в демо-мире недостижимы.** Разрыв «последний легаси-итог … первый
   прогон» существовал, пока первая ночь была 01.06. Теперь первая ночь — 02.05, первая своя
   дата, и 15.05 ворота пропускают. Ветка `dateGate` жива (первая ночь после запуска может не
   состояться, и догон её не вернёт — догонять не от чего), поэтому случай построен в стороже:
   из журнала и строк сняты свои ночи до 20.05.
4. **Порядок вставки ≠ порядок дат** (`#116`). Защёлка пишет строки первого числа после всех
   ночей сида; сторож, читающий `st.rows` подряд как историю, должен сортировать по дате.
   Других таких мест смоук не показал.
5. **`#17`: предупреждение о пропуске 20.08 остаётся, хотя пропуск догнан.** Сторож зелёный;
   сказать «догнан» — дело З-15c (`СС-168`: «предупреждение о пропуске говорит, догнан ли
   он»).
6. **Напечатанные, но не проверяемые числа сдвинулись той же причиной, что `#109`.** `#37`
   печатает «прогон записал 42 строк» (было 0 — повторный прогон за пройденную дату теперь
   засчитывает строки состояний подтверждёнными), `#66` — начислено 312 757,23 → 223 398,06 и
   списано 22 780 → 18 020 (поток с `'2026-07-15'`, база теперь своя строка 15.07). Оба
   сторожа зелёные: этих чисел они не утверждают.
7. Техника: мутационный прогон через `subprocess` с `stdout` в трубу терял хвост вывода —
   `process.exit()` у node обрезает асинхронную запись в трубу. Смоук запускается с выводом в
   файл, как велит «Приёмы».

### З-15b, правка ревью 1

Ревью нашло два важных дефекта (оба — в коде брифа) и один несущий пункт (решение
контролёра). Исправлены новым коммитом поверх `6efc33a`; новых номеров нет — дописаны
конъюнкты `#257` и `#259`.

1. **Догон писал строки в период, которого нет в календаре** (`ADR-0245` §6: «прогон на
   дату, чьего периода нет в календаре, строк не пишет»). Правило стояло только в `ST.run`;
   `gapsBefore` исключал лишь закрытые периоды, и `ST.catchUp` гнал `doRun` на каждую дыру.
   Проба рецензента: сид, «сегодня» 05.09, `ST.catchUp('2026-09-05')` — 14 дат и 126 строк
   на 02.09…04.09 (сентябрь), тогда как `ST.run('2026-09-04')` отказывает `skipped`.
   - Движок: `calendarGap(st, d)` — причина §6 или `null`, `skipRecord` — запись «пропуск»;
     `ST.run` и `catchUp` зовут одно и то же. Дата вне календаря получает пропуск с той же
     причиной, что у ночи, а не `doRun`; пропуск за дату пишется один (ночь или прежний
     догон, уже записавшие его, второго не требуют). `catchUp` отвечает `{dates, noCalendar}`;
     `ST.catchUp` и `ST.run` отдают `noCalendar` и называют его в журнале. Сами даты остаются
     дырами `gapsBefore` — заведут период в календаре, и следующий догон их возьмёт.
   - `#257` дописан: «сегодня» 05.09, `ST.catchUp('2026-09-05')` дважды — догнано 7 дат
     (26.08…01.09; 01.09 — итог августа), вне календаря 02.09, 03.09, 04.09: строк на них 0,
     догонов 0, пропусков по дате ровно по одному (02.09 записан ночью раньше), повторный догон
     догоняет 0.
2. **Конъюнкт `same259` не мог упасть.** `ST.seed(true)` кладёт снимок под тот же ключ, и
   следующий `ST.seed()` отдавал его же — сборка сравнивалась с собой. Теперь сравнивается
   `b259` (из кэша, взят до сборки мимо кэша, не правлен) со сборкой мимо кэша.
3. **Ключ кэша не был «отпечатком всех данных мира».** Сборка читает ещё `COLL_K`,
   `SURVEY_MATRIX`, `PAY_SPLIT`, `PAY_LAYER`, `CUR_DIM`, `FLAT_TYPES` (названы рецензентом) и,
   как показал обход чтений, `VTYPES`, `ARTICLES`, `RISK_RANK`, `BANKRUPT_SUBGROUPS`,
   `CORE.SOM_ROUNDING`, `KIND`, `DATING`, `FORM`, `LAYERS`, `MON`, `NIGHTLY`, `CAND_SRC` — всего
   27 входов, в ключе было 9. Проба рецензента: правка `COLL_K` — `ST.seed()` отдаёт мир залога,
   отличный от `ST.seed(true)`.
   - Движок: `SEED_INPUTS` — именованный список 27 входов, ключ — его отпечаток,
     `ST.seedInputs()` — имена. Комментарий перечисляет ровно их по происхождению и называет,
     что не входит и почему: функции (код), `CORE.calls` (сборка двигает, в мир не попадает —
     проверено пробой: мир при `CORE.calls` + 123 457 тот же), константы-примитивы
     (переприсвоить `const` нельзя), данные, которых сборка не читает. Проверено и то, что мир
     не зависит от прежнего `ST.state` (проба: мир, собранный поверх искалеченного
     состояния, тот же).
   - `#259` дописан двумя путями. (а) Случай рецензента: правка `COLL_K['недвижимость']`
     0,7 → 0,6 даёт промах, строки залога сдвигаются, и мир из `ST.seed()` равен сборке
     `seed()` мимо кэша. (б) Обход чтений: та же сборка идёт с ловушкой на каждом верхнем
     свойстве каждой константы модуля (и объектных членов `CORE` и `ST`); первое чтение
     отмечает константу и возвращает свойство на место. Прочитанное (27) обязано совпасть с
     `ST.seedInputs()` — ни пропущенного, ни лишнего; новая константа, которую начнёт читать
     сборка (З-16a/b), уронит сторож, пока её не внесут в ключ.

**TDD.** Конъюнкты дописаны до правки движка: `242/244`, `exit=1`, упали ровно `#257` («догнано
10 дат … строк на них 126, догонов 3, пропусков по дате 1 · 0 · 0») и `#259` («промах (0),
строки залога сдвинулись (false), … не в ключе ARTICLES, … VTYPES» — 27 имён, `ST.seedInputs`
ещё не было). `same259` на прежнем движке проходил — кэш для нетронутого мира верен.
После правки: `244/244 PASS`, `exit=0`.

**Мутации** (копия дерева в scratchpad, смоук — копия репозиторного):

| мутация | упали |
|---|---|
| `catchUp` без проверки календаря (прежнее поведение) | `243/244`: только `#257` — догнано 10, строк 126, догонов 3, пропусков 1 · 0 · 0 |
| пропуск вне календаря пишется при каждом догоне | `243/244`: только `#257` — пропусков 3 · 2 · 2 |
| `COLL_K` убран из `SEED_INPUTS` | `243/244`: только `#259` — промах 0, строки залога не сдвинулись, кэш ≠ сборка, «не в ключе COLL_K» |
| `CUR_DIM` убран из `SEED_INPUTS` (правкой в стороже не покрыт) | `243/244`: только `#259` — «не в ключе CUR_DIM» |
| в `SEED_INPUTS` добавлен непрочитанный `CARD` | `243/244`: только `#259` — «в ключе без чтения CARD» |
| прежний ключ из 9 входов при прежнем списке имён | `243/244`: только `#259` — промах 0, кэш ≠ сборка (обход чтений здесь проходит: имена верны, ключ собран не из них — это ловит путь (а)) |

Устаревший мир в кэше и `same259` (`#259` отдельно, на движке с прежним ключом из 9 входов,
перед сторожем правлен `COLL_K`): новый `same259` — `false`, прежний — `true`; на движке
репозитория оба `true`. Прежнее сравнение устаревшего мира не видело.

**Время смоука.** 24,6 с → 30,5 с: `#259` собирает мир ещё дважды (промах по `COLL_K` и
сборка с ловушками), `#257` догоняет 7 ночей.
