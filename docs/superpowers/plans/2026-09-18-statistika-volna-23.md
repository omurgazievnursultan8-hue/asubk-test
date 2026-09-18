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

## Этап 2 — хранение (детализируется на остановке 1)

Код этапа 2 зависит от того, что осталось в движке после этапа 1 (состав объектов, имена
записей, переписанные сторожа), поэтому шаги с кодом пишутся на остановке 1. Задано заранее:
что должно заработать, какими сторожами это доказывается и какие мутации их обязаны ронять.

### Task 3: З-15 — строка каждый день, закрытый месяц хранит первые числа (`ИС-54`, `ADR-0238`)

Сторожа (с `#245`), каждый — отдельная проверка:
1. В открытом месяце у каждого живого объекта-состояния строка на каждую дату прогона без
   пропусков; некандидат получает копию вчерашней строки (значения равны, дата новая),
   счётчик прогона «скопировано» = числу некандидатов.
2. Срез на начало дня: строка `slice_date = 01.07` принадлежит июню (`periodOf(slice) === '2026-06'`),
   защёлка июня фиксирует именно её.
3. Закрытие месяца: неполные строки первого числа → отказ с перечнем, дни не тронуты;
   полные → дни 02…последний удалены, строка первого числа следующего месяца осталась,
   колонка календаря проставлена в том же шаге.
4. Дата внутри закрытого месяца → ответ «не хранится» с соседними первыми числами, а не
   ближайшая предыдущая (`ИС-12` сужен); дата внутри открытого — строка есть всегда.
5. Пропущенная ночь → `skipped`; следующий прогон догоняет каждую пропущенную дату по
   порядку; дыр в открытом месяце нет.
6. Повторное открытие: дни не восстанавливаются, первое число пересчитывается.
7. Легаси — только первые числа, период закрыт.
Снимаются `#184`…`#192` (надгробия), переписываются сторожа счёта строк (`#209`…`#215`,
легаси `#223`…`#228`, прочие по факту).
Мутации: копия пишет строку только кандидатам; закрытие не удаляет дни; «не хранится»
подменено ближайшей предыдущей; период строки = месяц `slice_date` (без `−1`).

### Task 4: З-16 — три способа хранения, поправка события (`ИС-55`, `ADR-0239`)

Сторожа:
1. Способ хранения берётся из `RELEASE` (объект не несёт своего): платёж, поступление —
   `event_delta`, мера — `event_full`, остальные — `state`; у событий нет ни копий, ни
   удаления при закрытии.
2. Дата строки платежа — `max(поступление, привязка) + 1`: опознанный задним числом платёж
   попадает в месяц опознания.
3. Открытый месяц: правка события переписывает строку на месте (одна строка).
4. Закрытый месяц: `reversal` и `rebind` в месяце исправления, исходная строка не тронута,
   сумма строк объекта — текущий итог; маркер `corrected_later` с `corr_slice_date`.
5. Мера — строка «мера × цель», последняя строка ≤ D отвечает за всё (`event_full`).
6. Чтение «событие на дату» — одна функция на способ; поток «погашено за июнь» — строки с
   `slice_date` 02.06…01.07 включая поправки.
7. Запись в закрытый период отбивается у всех таблиц; поправка в открытый — проходит.
Мутации: поправка переписывает исходную строку; маркер не ставится; дата платежа = дата
поступления; мера пишется одной строкой на меру.

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
