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
- Новые сторожа — с `#235`, по возрастанию, без пропусков. Номер снятого сторожа не
  переиспользуется; на его месте в смоуке — надгробие-комментарий: волна, задача, ADR и
  сторож-преемник (образец — надгробия `#184`…`#192`, снятых З-15b). `#132`…`#136` снимает З-19;
  `#229` жив; `#231`…`#234` в смоуке нет.
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

## Этап 3 — поправка месяца, деньги, разрезы, охват, служебное

Этап расписан на остановке 2 по движку после З-16b (`137baf5`). Спецификация задаёт семь задач
(З-17…З-23); к ним впереди встала З-16c — её поставило решение владельца `СС-180`. Задачи
разбиты на пятнадцать коммитов (`СС-185`). Новые сторожа — подряд с `#273`; снятые `#132`…`#136`
получают надгробия (З-19). Решения — `СС-180` (владелец) и `СС-181`…`СС-213`, собраны первыми:
шаги на них ссылаются.

Как читать правки. З-16c и З-17 даны кусками «было → стало» по снимку `137baf5`. З-18a…З-22a
прототипированы на копии и даны разностью по функциям: `-` — строка до правки, `+` — после,
без знака — окружение для поиска; метка над куском — функция или сторож, `~N` — подсказка
строки по снимку после предыдущей задачи. З-22b…З-23c не прототипированы: код написан по
снимку после З-22a, числа сторожей, зависящие от прогона, — «по факту». Такое число снимается из
первого зелёного прогона и вписывается в таблицу переписки с доводом. Место правки всегда
ищется по имени функции (`grep -n "function doRun" mockups/statistics/statistics.html`).

Порядок: **З-16c → З-17 → З-18a → З-18b → З-18c → З-19 → З-20 → З-21 → З-22a → З-22b → З-22c →
З-22d → З-23a → З-23b → З-23c**. Каждая следующая опирается на предыдущую.

| задача | содержание | новые сторожа | смоук после |
|---|---|---|---|
| З-16c | поправка в месяце исправления | `#273`…`#279` | 264 |
| З-17 | курс на строку, клетка — одно число | `#280`, `#281` | 266 |
| З-18a | закрытый словарь, CHECK у двери | `#282`, `#283` | 268 |
| З-18b | ключ и подпись на дату, порядок из версии | `#284`…`#286` | 271 |
| З-18c | путь «таблица + ключ» | `#287` | 272 |
| З-19 | охват правилами, снято `#132`…`#136` | `#288`…`#291` | 271 |
| З-20 | член группы совместного риска | `#292`, `#293` | 273 |
| З-21 | «текущее» массивом имён | `#294`, `#295` | 275 |
| З-22a | колонка источника перечислением | `#296` | 276 |
| З-22b | одна задача на запись, журнал перезаписи | `#297`, `#298` | 278 |
| З-22c | ответ соседа ключом и датой, `retro` | `#299` | 279 |
| З-22d | счётчики прогона, `failed` | `#300` | 280 |
| З-23a | маркер состояния при отличии | `#301` | 281 |
| З-23b | выгрузка `expired` | `#302` | 282 |
| З-23c | слоты классификаторов | `#303` | 283 |

Счёт «смоук после» — число сторожей, он не зависит от прогона. До З-22a включительно зелёный
прогон проверен на копии; дальше — цель.

### Решения этапа 3

**СС-180 — поправка в месяце исправления (решение владельца, остановка 2, 19.09.2026).**
`ADR-0239` §3, вариант 1. Событие переписывается на месте, только если исправление ложится в
месяц строки события. Иначе — строка-поправка в месяце исправления с маркером
`corrected_later`, открыт месяц строки или закрыт. Тождество «поток событий = прирост
состояния» держится всегда. Текст ADR не правится: «`ADR-0239` §3 уточнить» — находка в журнал.
*Почему:* сторно июльского платежа ПГ-2026/1141 (КД-2022/065, 520 000), найденное 22.08,
переписывало июль на месте. Строки состояния июля уже легли, и поток июля расходился с
приростом.

**СС-181 — месяц исправления — период ночи, нашедшей его.** Берётся `periodOf` (`ADR-0238` §2):
ночь 01.09 — август. Правило одно у обоих способов событий (`deltaNight`, `fullNight`).
*Почему:* календарный месяц даты развёл бы поток и итог на первом числе.

**СС-182 — строка пары исправляется поправкой, если зафиксирована или лежит в другом периоде,
чем сменившая её** (`corrOf` в `fullNight`).
*Почему:* у меры то же правило, что у дельты, — иначе мера о двух целях расходилась бы с мерой
об одной.

**СС-183 — ночь, поставившая строке пары «сторнирована»** (`offNightOf`): берётся не позже
следующей строки пары.
*Почему:* снятие сторно закрытого месяца должно найти ту ночь, а не последнюю.

**СС-184 — работа у пути состояний снимается только за дверью.**
*Почему:* отбитая строка закрытого месяца не сделала работы; сними её — изменение не ляжет никогда.

**СС-185 — разбиение.** З-16c — одним коммитом. З-18 → a (словарь и CHECK) · b (значение и
подпись на дату) · c (путь «таблица + ключ»). З-22 → a (источник) · b (очередь и журнал) · c
(ответ соседа, `retro`) · d (счётчики, `failed`). З-23 → a (маркер состояния) · b (выгрузки) ·
c (слоты).
*Почему:* каждая часть объясняется одной фразой и падает своими сторожами. Иначе упавший сторож
нельзя отнести к части модели.

**СС-186 — курс лежит в строке один раз.** Поле `fx = {rate, rateDate}` — у объекта, таблице
которого релиз вывел `rate`, иначе `null`; у легаси — `null`. Клетка — `{v}`.
*Почему:* `ИС-56`; курс в каждой клетке расходился бы внутри строки.

**СС-187 — день курса события — реквизит объекта `rateDay`.** Объявлен только у платежа
(`'rdate'`, день поступления); у прочих событий — день рождения строки.
*Почему:* деньги платежа пришли днём поступления, а не днём банковской выписки.

**СС-188 — поток в сомах — разность сомовых колонок.** `ST.flowBetween` по сомовой записи
отвечает, отказа «период по сомовой не считается» больше нет.
*Почему:* сомовая колонка потока — от ядра по курсам операций; разность её и есть поток.

**СС-189 — `CORE.flowSom`: поток по курсам дней операций.** Сомовая сторона ответа несёт
`som.flow = true`.
*Почему:* курс строки к потоку не применяется (`ADR-0240`).

**СС-190 — `rowDiff` называет `fx`, когда курс строки сменился.**
*Почему:* иначе новый курс не был бы изменением строки.

**СС-191 — у дельты `fx` — от последней строки с деньгами.**
*Почему:* поправка без сумм курса не несёт.

**СС-192 — `readIndRaw` у денег отдаёт `{v, som, curs}`; в строку ложится только `v`.**
*Почему:* валюты состава нужны критической дате, но в строке они — второй курс.

**СС-193 — список значений закрытого словаря лежит у таблицы в релизе** (`checks`) — у каждой
колонки вида `code` и у `d_corr_kind` событий; 19 списков, после З-20 — 20. Новое значение —
миграцией.
*Почему:* CHECK — свойство таблицы (`ADR-0241` §2), а не записи реестра.

**СС-194 — слова мира — коды схемы.** Состояние платежа — `pending · confirmed · reversed`,
меры — `действует · сторнирована`. Находки остановки 2 `d_mstate` и `d_pay_state` закрыты
здесь.
*Почему:* иначе CHECK отбил бы весь мир.

**СС-195 — значение вне словаря отбивает дверь записи** (`checkRow` в `writeRow`); отказ — в
`relLog` с `who:'CHECK'`.
*Почему:* писатель один (`ИС-8`); проверка в отчёте пропустила бы строку в таблицу.

**СС-196 — подпись на дату — двенадцатое поле `lbls`, ключ остаётся в `dims`.** Подпись входит
в пробу: переименование — изменение строки.
*Почему:* пара `_id`/`_lbl` схемы; прошлая строка держит подпись своей даты.

**СС-197 — порядок категорий — `ord` версии классификатора на дату; `RISK_RANK` снят.**
*Почему:* новое значение классификатора — данные владельца, не релиз (`ADR-0241` §3).

**СС-198 — путь «таблица + ключ» — запись без своей колонки.** Значение берётся join-ом строки
соседа той же даты; копии в строке нет; охват путь не режет.
*Почему:* `ADR-0241` §8; копия в строке кредита разошлась бы с заёмщиком.

**СС-199 — охват — список правил `own · via · open`, объединённых ИЛИ.** Объект без правила и
правило без вида валят загрузку (`scopeErrors`); «не спрашивается» снято.
*Почему:* `ИС-58`, `ADR-0243`; дело видно через требование, мера — через цель или автору.

**СС-200 — суммы группы — из строк заёмщиков-членов на ту же дату; итог — по различным членам.**
Денег в строке членства нет.
*Почему:* `ADR-0244` §2; заёмщик двух групп иначе считался бы дважды.

**СС-201 — признак «текущее» — массив имён `now` в строке.** Копия переносит его, пересчёт
пишет заново, молчание имени не даёт.
*Почему:* `ADR-0242`; карта «величина → слово» дублировала реестр.

**СС-202 — имена `now` сверяет дверь записи.** Отбиваются чужая величина, величина без
значения, повтор, прежняя карта. Строка без массива ложится с `[]`.
*Почему:* `ADR-0242` §5; колонка `now_cols NOT NULL DEFAULT '{}'`.

**СС-203 — источник — перечисление `stat_source_state`, причина — `detail`.** Дверь отбивает
слово вне списка, `legacy` у своей строки и `ok` с причиной.
*Почему:* `ADR-0245` §12; `is_partial` вычисляется из состояния.

**СС-204 — задачи очереди трёх видов.** `досчёт` и `распоряжение` — `manual`, `retro` ставит
ответ соседа, `reopen` объявлен. Писателя `reopen` в макете нет: повторное открытие пересчитывает
итог своим прогоном (`ADR-0238` §5).
*Почему:* слова двери остались прежними — десятки сторожей ставят работу ими.

**СС-205 — у записи одна открытая задача.** Новая сливается с ней: `from` — более ранний, `at` —
более поздний; закрывает её ночь, дошедшая до `at`.
*Почему:* «дата берётся более ранняя» (`ADR-0245` §4) — это дата пересчёта. Закрыть по ранней
значило бы бросить позднюю работу.

**СС-206 — дозаполнения в очереди нет.** Неполная последняя строка зовёт запись в ночь
источником «очередь».
*Почему:* `ADR-0245` §4 уточняет `ADR-0208` §5: очередью неполных служат сами строки.

**СС-207 — журнал перезаписи выводится из журнала прогона** (`rewrote`, `filled`). Причина —
по виду прогона, дописанное — `backfill`. Дни закрытого месяца отсекаются, первые числа
остаются.
*Почему:* ночь уже называет перезапись поимённо; второй писатель разошёлся бы с первым.

**СС-208 — ответ соседа «ключ + дата действия» подаёт дверь `ST.nbChanged`; `fedChanged`
остаётся.** Ночь забирает ответ задачей `retro` с `from + 1`. Если это день закрытого месяца —
с первого открытого дня. Открытые дни пересчитывает `retroPass` до своей ночи. Ответ
молчавшего соседа ждёт.
*Почему:* журнала соседа в макете нет. Сравнение на две даты видит только изменения внутри
окна и даты действия не знает.

**СС-209 — счётчики по способу хранения и сверка в конце `doRun`.** `null` значит «не
относится». У состояния строк на дату ровно `written`, и `written = n + same + copied`. Не
сошлось — `failed`, и `dateGate` не публикует дату. Защёлка не сверяется.
*Почему:* `ADR-0245` §2. Доспрос защёлки пишет не все строки даты, и тождество у него своё.

**СС-210 — маркер состояния — только при настоящем отличии пересчёта итога закрытого месяца.**
Повторная находка обновляет запись. Сошлось — `converged`, период открыт — `reopen`. Маркеры
ответа входят в счётчик `markers` ночи.
*Почему:* `ADR-0245` §5; «сосед назвал» — повод посмотреть, а не находка.

**СС-211 — файл выгрузки живёт `EXPORT_KEEP_DAYS = 30` дней, задание — всегда.** Просрочку
считает ночь. Выполнение — отдельная дверь `ST.exportRun`.
*Почему:* `ADR-0245` §11. Число дней — параметр; 30 — значение макета, не требование.

**СС-212 — слоты занимаются по порядку и навсегда.** Колонки `d_clsN_*` объявлены семейством и
в `cols` релиза не перечисляются.
*Почему:* `ADR-0241` §5. Перечень добавил бы 90 колонок и сдвинул счёт релиза у десятка сторожей
без нового смысла. Расхождение с перечнем схемы — находка.

**СС-213 — `bind` вне этапа.** Вид поправки платежа `bind` в схеме есть, в макете нет:
список `corr` платежа — `original · reversal · rebind`. Список закрытого словаря (`#282`) держит
ровно их.
*Почему:* первая привязка непривязанного платежа в мире не встречается. Завести вид без
случая — сторож без содержания. Находка остаётся в журнале.

**Затронутые находки.**
- `СС-Д19` (голый идентификатор без `value_type`) — у `d-ggroup`/`d-gmember` (З-20) вид `id`, как у прочих.
- `СС-Д24` (у уровня нет `value_type`) — З-18b читает подпись и вышестоящее по уровню, суффиксы — прежние.
- `СС-Д25` (легаси событий нет) — З-22a даёт `legacy` только строкам легаси-кредита.
- Новая `СС-Д27` — З-20: в словаре `value_type` нет вида `text`, у `d_group_lbl` нет пары `_id`.

### Task 4c: З-16c — поправка в месяце исправления (СС-180, ADR-0239 §3)

Задача не из спецификации: её поставило решение владельца на остановке 2 (`СС-180`), и в неё
же сложены три отложенных мелких ревью 3 З-16b — (а), (б), (г) ниже; (в) — правка слова в
комментарии `dequeueSeen`. Номера строк — по `137baf5`.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `deltaNight` (~5378) — условие перезаписи на месте и комментарий над ним (~5438–5444),
    шапка «СОБЫТИЕ ДЕЛЬТОЙ» (~5200);
  - новая `offNightOf` — перед `fullNight`; в `fullNight` (~5577) — `corrOf`, `wholeOff`,
    `back`, `here`, условие снятия, два `mark`; комментарии «изменение одних данных» (~5560) и
    «СМЕНА НАБОРА … СТОРНО ВСЕЙ МЕРЫ» (~5621);
  - `doRun` (~5728), путь состояний — снятие работы после двери (~5774);
  - комментарий `dequeueSeen` (~5346–5371) — п. 1 и последняя фраза;
  - комментарий двери `ST.eventFlow` (~7071–7094) — абзац «ГРАНИЦА … ОТКРЫТЫЙ ВОПРОС».
- Modify: `scripts/inspect/statistics-check.mjs`: шапка (строки блока З-16b и новая З-16c),
  переписка `#272`, `#116`, `#172`, `#212`, блок З-16c (`#273`…`#279`) перед отчётом.

**Interfaces:**
- Consumes: `deltaNight`, `fullNight`, `fullAt`, `pairsOf`, `markCorrected`/`unmarkCorrected`,
  `rowGate`, `dequeueSeen`, `periodOf` (З-15a), `st.runs[].parts[].created/rewrote` (З-16a, З-16b),
  `ST.eventFlow`, `ST.markers`, `ST.repayAt`/`receiptAt`/`measureAt`.
- Produces:
  - правило «на месте — только в месяце строки» у обоих способов событий (`СС-180`, `СС-181`);
  - `corrOf(p, l)` — локальная в `fullNight`: строка `p` исправляется поправкой, если она
    зафиксирована или лежит в другом периоде, чем `l`;
  - `offNightOf(st, o, r)` → дата ночи, поставившей строке пары её нынешнее «сторнирована»
    (или создавшей её), не позже следующей строки пары (`СС-183`);
  - снятие работы у пути состояний — только за дверью (`СС-184`).

- [ ] **Step 1: Падающие сторожа `#273`…`#279`**

Перед `/* ---- отчёт ---- */`, после блока З-16b:

```js
/* ===== Волна 23 · З-16c — поправка в месяце исправления (СС-180, ADR-0239 §3). Решение
   владельца на остановке 2 (19.09.2026): событие переписывается на месте, только если
   исправление ложится в месяц строки события; иначе — строка-поправка в месяце исправления
   и маркер «исправлено позже», тем же путём, что у закрытого месяца. Месяц — период среза
   (ADR-0238 §2): ночь 01.09 — август. Месячное тождество «поток событий = прирост
   состояния» держится навсегда. Сюда же — три отложенных мелких З-16b: снятая цель не
   оживает (а), отбитая строка состояния работу не снимает (б), снятие сторно меры закрытого
   месяца (г). ===== */
(() => {
  const W = vm.runInContext('WORLD', sandbox);
  const v = (r, id) => (((r || {}).inds || {})[id] || {}).v;
  const D23 = '2026-08-23', S01 = '2026-09-01';
  const rowsOf = (obj, ref) => ST.state.rows.filter(r => r.obj === obj && r.ref === ref)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.part < b.part ? -1 : 1);
  const mkOf = ref => ST.markers().filter(m => m.ref === ref);
  const partOf = obj => (ST.state.runs[ST.state.runs.length - 1].parts || []).find(p => p.obj === obj) || {rewrote: []};
  const repOf = (d, ref) => v(ST.rowsAt('obj-credit', d).find(r => r.ref === ref), 'm-repaid') || 0;
  const c2 = x => Math.round(x * 100) / 100;
  const badOf = (a, b) => {
    const f = ST.eventFlow('obj-repay', 'm-ramount', a, b, 'd-pcredit');
    if(!f.ok) return ['отказ: ' + f.why];
    return ST.registryList('obj-credit', b).filter(ref => c2((f.by || {})[ref] || 0) !== c2(repOf(b, ref) - repOf(a, ref)));
  };
  const keep = (list, i) => JSON.stringify(list[i]);

  /* #273 — ДЕЛЬТА, ТОТ ЖЕ МЕСЯЦ: на месте, маркера нет. Платёж ПГ-2026/1196 (строка 13.08,
     август) сторнирован 31.08; его находит ночь 01.09 — срез 01.09 лежит в периоде августа
     (месяц кануна, ADR-0238 §2), и исправление ложится в месяц строки: строка одна, на 13.08,
     переписана, журнал называет d-paystate, маркера нет. Тождество августа (01.08, 01.09]
     держится: сторнированная исходная в поток не входит, и итог 01.09 кредита её не несёт. */
  ST.seed();
  const i273 = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1196');
  const k273 = keep(W['obj-repay'], i273);
  let s273 = {rows: '', mk: -1, rw: '', bad: ['не посчитано'], ok: false};
  try {
    ST.state.today = S01;
    ST.catchUp(S01);
    const p = W['obj-repay'][i273];
    p.f.pstate = 'сторнирован';
    p.h.pstate = [['2026-08-12', 'подтверждён'], ['2026-08-31', 'сторнирован']];
    ST.enqueue('obj-repay', 'ПГ-2026/1196', 'распоряжение', 'сторно 31.08');
    const r = ST.run(S01);
    s273 = {ok: r.ok,
      rows: rowsOf('obj-repay', 'ПГ-2026/1196').map(x => x.date.slice(5) + ':' + x.part + ':' + x.dims['d-paystate']).join(' '),
      mk: mkOf('ПГ-2026/1196').length,
      rw: partOf('obj-repay').rewrote.filter(x => x.ref === 'ПГ-2026/1196').map(x => x.fields.join()).join(),
      bad: badOf('2026-08-01', S01)};
  } finally { W['obj-repay'][i273] = JSON.parse(k273); }
  ok(273, s273.ok && s273.rows === '08-13:original:сторнирован' && s273.mk === 0 &&
        s273.rw === 'd-paystate' && s273.bad.length === 0,
    `исправление в месяце строки — на месте (СС-180): ПГ-2026/1196 (строка 13.08) сторнирован 31.08, ночь 01.09 — срез августа, а не сентября (месяц кануна, ADR-0238 §2): строки ${s273.rows || '—'}, маркеров ${s273.mk}, журнал перезаписи — ${s273.rw || '—'}. Тождество августа (01.08, 01.09] — расхождений ${s273.bad.length} (ADR-0239 §3, §6)`);

  /* #274 — ДЕЛЬТА, ДРУГОЙ МЕСЯЦ, МЕСЯЦ ОТКРЫТ: поправка и маркер. Июль в конце сида открыт.
     Платёж ПГ-2026/1163 (июль, КД-2024/117, 28 000) перепривязан к КД-2025/088 с 21.08,
     поступление ПП-2026/0748 (июль) отозвано 21.08; ночь 22.08 — месяц исправления август:
     июльские строки не тронуты, на 22.08 — сторно и перепривязка платежа и строка `match`
     поступления, у каждого маркер «исправлено позже» на июльскую строку. Поток июля тот же,
     что до правки, и ответ на 01.08 — прежний: закрытый завтра июль не разойдётся с июлем
     сегодняшним. */
  ST.seed();
  const i274 = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1163');
  const j274 = W['obj-receipt'].findIndex(p => p.id === 'ПП-2026/0748');
  const k274 = [keep(W['obj-repay'], i274), keep(W['obj-receipt'], j274)];
  const jul274 = () => JSON.stringify(ST.eventFlow('obj-repay', 'm-ramount', '2026-07-01', '2026-08-01', 'd-pcredit').by);
  const before274 = jul274();
  let s274 = {};
  try {
    const p = W['obj-repay'][i274];
    p.f.credit = 'КД-2025/088';
    p.h.credit = [['2026-07-15', 'КД-2024/117'], ['2026-08-21', 'КД-2025/088']];
    ST.enqueue('obj-repay', 'ПГ-2026/1163', 'распоряжение', 'перепривязка июльского платежа');
    const rc = W['obj-receipt'][j274];
    rc.h.match = rc.h.match.concat([['2026-08-21', 'отозвано']]);
    ST.enqueue('obj-receipt', 'ПП-2026/0748', 'распоряжение', 'отзыв июльского поступления');
    const r = ST.run(TODAY);
    const mp = mkOf('ПГ-2026/1163'), mr = mkOf('ПП-2026/0748');
    s274 = {ok: r.ok,
      pay: rowsOf('obj-repay', 'ПГ-2026/1163').map(x => x.date.slice(5) + ':' + x.part + ':' + x.dims['d-pcredit'] + ':' + v(x, 'm-ramount')).join(' '),
      rc: rowsOf('obj-receipt', 'ПП-2026/0748').map(x => x.date.slice(5) + ':' + x.part + ':' + x.dims['d-rmatch']).join(' '),
      mk: mp.concat(mr).map(m => m.slice_date.slice(5) + '>' + m.corr_slice_date.slice(5) + ':' + m.closed_how).join(' '),
      jul: jul274(),
      at: ST.receiptAt('2026-08-01').find(x => x.ref === 'ПП-2026/0748').dims['d-rmatch'] + '/' +
          ST.receiptAt(TODAY).find(x => x.ref === 'ПП-2026/0748').dims['d-rmatch'],
      bad: badOf('2026-07-01', '2026-08-01').concat(badOf('2026-08-01', TODAY))};
  } finally {
    W['obj-repay'][i274] = JSON.parse(k274[0]);
    W['obj-receipt'][j274] = JSON.parse(k274[1]);
  }
  ok(274, s274.ok && s274.pay === '07-16:original:КД-2024/117:28000 08-22:rebind:КД-2025/088:28000 08-22:reversal:КД-2024/117:-28000' &&
        s274.rc === '07-22:original:подтверждено 08-22:match:отозвано' &&
        s274.mk === '07-16>08-22:corrected_later 07-22>08-22:corrected_later' &&
        s274.jul === before274 && s274.at === 'подтверждено/отозвано' && s274.bad.length === 0,
    `исправление в другом месяце, пока тот открыт, — поправкой в месяце исправления и маркером, как у закрытого (СС-180): ПГ-2026/1163 — ${s274.pay || '—'}; ПП-2026/0748 — ${s274.rc || '—'}; маркеры ${s274.mk || '—'}. Поток июля до правки и после — ${s274.jul === before274 ? 'тот же' : 'разный'}; поступление на 01.08 и на 22.08 — ${s274.at || '—'}; тождество июля и августа — расхождений ${(s274.bad || ['—']).length} (ADR-0239 §3, §4, §6)`);

  /* #275 — МЕРА, ТОТ ЖЕ МЕСЯЦ: на месте, маркера нет. Исход МВ-2026/27 (строка 03.08)
     уточнён; ночь 01.09 — период августа: строка пары одна, переписана на месте, журнал
     называет цель, маркера нет. */
  ST.seed();
  const i275 = W['obj-measure'].findIndex(m => m.id === 'МВ-2026/27');
  const k275 = keep(W['obj-measure'], i275);
  let s275 = {};
  try {
    ST.state.today = S01;
    ST.catchUp(S01);
    W['obj-measure'][i275].f.result = 'исполнено';
    ST.enqueue('obj-measure', 'МВ-2026/27', 'распоряжение', 'исход уточнён');
    const r = ST.run(S01);
    s275 = {ok: r.ok,
      rows: rowsOf('obj-measure', 'МВ-2026/27').map(x => x.date.slice(5) + ':' + x.dims['d-mresult']).join(' '),
      mk: mkOf('МВ-2026/27').length,
      rw: partOf('obj-measure').rewrote.filter(x => x.ref === 'МВ-2026/27').map(x => x.target + ':' + x.fields.join()).join()};
  } finally { W['obj-measure'][i275] = JSON.parse(k275); }
  ok(275, s275.ok && s275.rows === '08-03:исполнено' && s275.mk === 0 && s275.rw === 'ТВ-2026/07-1:d-mresult',
    `мера, исправление в месяце строки — на месте (СС-180): МВ-2026/27 (строка 03.08), ночь 01.09 — ${s275.rows || '—'}, маркеров ${s275.mk}, журнал — ${s275.rw || '—'} (ADR-0239 §3, §5)`);

  /* #276 — МЕРА, ДРУГОЙ МЕСЯЦ, МЕСЯЦ ОТКРЫТ: строки полного состояния и маркеры с целью.
     Июльской меры в демо-мире нет — сторож заводит её сам: МВ-2026/45 (20.07, две цели).
     Ночь 22.08 рождает её на срез 21.07 открытого июля; исход уточнён — ночь 23.08 кладёт
     строки полного состояния обеих пар на 23.08 и два маркера с целью, июльские строки не
     тронуты, ответ на 01.08 (итог июля) — прежний. Исход вернули — ночь 24.08 поправки и
     маркеры снимает: поправка, которая ничего не исправляет, не лежит. */
  ST.seed();
  const Wm = W['obj-measure'];
  Wm.push({id: 'МВ-2026/45', f: {mdate: '2026-07-20', cur: 'KGS', kind: 'претензия', credit: 'КД-2022/065',
             targets: ['ТВ-2025/11-1', 'ТВ-2025/11-2'], result: 'в работе', sent: '2026-07-20', amount: 300000},
           h: {branch: [['2026-07-20', 'Кредитный департамент']], curator: [['2026-07-20', 'Асанов А.']],
               mstate: [['2026-07-20', 'зарегистрирована']]}, k: {}});
  let s276 = {};
  const rows276 = () => rowsOf('obj-measure', 'МВ-2026/45').map(x => x.date.slice(5) + ':' + x.part.slice(-4) + ':' + x.dims['d-mresult']).join(' ');
  const at276 = d => ST.measureAt(d).filter(x => x.ref === 'МВ-2026/45').map(x => x.dims['d-mresult']).join();
  try {
    ST.run(TODAY);
    const born = rows276();
    const m = Wm.find(x => x.id === 'МВ-2026/45');
    m.f.result = 'исполнено частично';
    ST.enqueue('obj-measure', 'МВ-2026/45', 'распоряжение', 'исход июльской меры уточнён');
    ST.state.today = D23;
    const r = ST.run(D23);
    s276 = {ok: r.ok, born, rows: rows276(),
      mk: mkOf('МВ-2026/45').map(x => x.slice_date.slice(5) + '>' + x.corr_slice_date.slice(5) + ':' + x.target_id.slice(-4)).sort().join(' '),
      jul: at276('2026-08-01'), now: at276(D23)};
    m.f.result = 'в работе';
    ST.enqueue('obj-measure', 'МВ-2026/45', 'распоряжение', 'исход возвращён');
    ST.state.today = '2026-08-24';
    ST.run('2026-08-24');
    Object.assign(s276, {back: rows276(), mkBack: mkOf('МВ-2026/45').length});
  } finally { Wm.splice(Wm.findIndex(x => x.id === 'МВ-2026/45'), 1); }
  ok(276, s276.ok && s276.born === '07-21:11-1:в работе 07-21:11-2:в работе' &&
        s276.rows === '07-21:11-1:в работе 07-21:11-2:в работе 08-23:11-1:исполнено частично 08-23:11-2:исполнено частично' &&
        s276.mk === '07-21>08-23:11-1 07-21>08-23:11-2' &&
        s276.jul === 'в работе,в работе' && s276.now === 'исполнено частично,исполнено частично' &&
        s276.back === '07-21:11-1:в работе 07-21:11-2:в работе' && s276.mkBack === 0,
    `мера, исправление в другом месяце, пока тот открыт, — строками полного состояния на ночь исправления и маркером с целью (СС-180): МВ-2026/45 рождена ${s276.born || '—'}; исход уточнён ночью 23.08 — ${s276.rows || '—'}, маркеры ${s276.mk || '—'}; ответ на 01.08 (итог июля) — ${s276.jul || '—'}, на 23.08 — ${s276.now || '—'}. Исход вернули ночью 24.08 — ${s276.back || '—'}, маркеров ${s276.mkBack}: поправка, которая ничего не исправляет, снята (ADR-0239 §4, §5)`);

  /* #277 — (а) СНЯТАЯ ЦЕЛЬ НЕ ОЖИВАЕТ задним числом. Цель снята ночью 23.08 (строка пары
     «сторнирована» на 23.08), потом мера сторнирована целиком — на месте строки
     представителя 10.08 (ночь 24.08, тот же месяц). Снятие сторно и возврат цели — ночью 25.08
     (вариант А) или порознь, 25.08 и 26.08 (вариант Б). Прежде возврат читал представителя на
     23.08 по его строке, переписанной позже, принимал снятие цели за сторно меры и переписывал
     строку снятия на месте — цель отвечала живой на 23.08 и 24.08, хотя мир говорил «снята».
     Представитель спрашивается о ночи, поставившей его сторно (`offNightOf`): она позже ночи
     снятия — значит, пара снята сама, и возврат — смена набора на эту ночь. */
  const scen277 = variant => {
    ST.seed();
    const src = Wm.find(x => x.id === 'МВ-2026/31');
    const x = JSON.parse(JSON.stringify(src));
    x.id = 'МВ-2026/61';
    x.h.mstate = [['2026-08-09', 'зарегистрирована']];
    Wm.push(x);
    const me = () => Wm.find(y => y.id === 'МВ-2026/61');
    const night = (d, why) => { ST.state.today = d; ST.enqueue('obj-measure', 'МВ-2026/61', 'распоряжение', why); ST.run(d); };
    try {
      ST.run(TODAY);
      me().f.targets = ['ТВ-2025/11-1'];
      night(D23, 'цель снята');
      me().h.mstate = me().h.mstate.concat([['2026-08-23', 'сторнирована']]);
      night('2026-08-24', 'мера сторнирована');
      if(variant === 'А'){
        me().f.targets = ['ТВ-2025/11-1', 'ТВ-2025/11-2'];
        me().h.mstate = me().h.mstate.concat([['2026-08-24', 'зарегистрирована']]);
        night('2026-08-25', 'цель возвращена, сторно снято');
      } else {
        me().f.targets = ['ТВ-2025/11-1', 'ТВ-2025/11-2'];
        night('2026-08-25', 'цель возвращена');
        me().h.mstate = me().h.mstate.concat([['2026-08-25', 'зарегистрирована']]);
        night('2026-08-26', 'сторно снято');
      }
      const at = d => ST.measureAt(d).filter(y => y.ref === 'МВ-2026/61')
        .map(y => y.part.slice(-4) + (y.dims['d-mprimary'] === true ? '+' : '') + (y.dims['d-mstate'] === 'сторнирована' ? '×' : '')).sort().join(' ');
      return {row23: rowsOf('obj-measure', 'МВ-2026/61').filter(y => y.date === D23).map(y => y.part.slice(-4) + ':' + y.dims['d-mstate']).join(),
              at: [D23, '2026-08-24', '2026-08-25', '2026-08-26'].map(at)};
    } finally { Wm.splice(Wm.findIndex(y => y.id === 'МВ-2026/61'), 1); }
  };
  const a277 = scen277('А'), b277 = scen277('Б');
  ok(277, a277.row23 === '11-2:сторнирована' && b277.row23 === '11-2:сторнирована' &&
        a277.at.join(' | ') === '11-1+× 11-2× | 11-1+× 11-2× | 11-1+ 11-2 | 11-1+ 11-2' &&
        b277.at.join(' | ') === '11-1+× 11-2× | 11-1+× 11-2× | 11-1+× 11-2× | 11-1+ 11-2',
    `(а) снятая цель не оживает задним числом: цель снята ночью 23.08, мера сторнирована ночью 24.08 на месте строки представителя, возврат цели и снятие сторно — вместе (А) или порознь (Б). Строка снятия 23.08 — А ${a277.row23 || 'переписана'}, Б ${b277.row23 || 'переписана'}; ответ на 23.08 · 24.08 · 25.08 · 26.08 — А ${a277.at.join(' | ')}, Б ${b277.at.join(' | ')} («+» представитель, «×» сторнирована). Сторно представителя поставила ночь позже снятия — пара снята сама, и её возврат — смена набора на ночь возврата (правка ревью 3 З-16b, решение Б)`);

  /* #278 — (б) ОТБИТАЯ СТРОКА СОСТОЯНИЯ РАБОТУ НЕ СНИМАЕТ. Досчёт программы БК-2021 от 10.06
     (как ставит его запись реестра, заведённая задним числом, — `queueRegChange`) обходит
     прогон за закрытое 15.06, позванный мимо дверей: строка отбита (июнь закрыт), и прежде
     путь состояний снимал работу при обходе, до записи — изменение недатированного поля
     терялось навсегда. Теперь досчёт открыт, и ночь 23.08 его пишет и снимает. */
  ST.seed();
  ST.run(TODAY);
  const enq278 = vm.runInContext('enq', sandbox), doRun278 = vm.runInContext('doRun', sandbox);
  const i278 = W['obj-program'].findIndex(x => x.id === 'БК-2021');
  const k278 = keep(W['obj-program'], i278);
  let s278 = {};
  try {
    W['obj-program'][i278].f.decision = 'ПКМ №999 (сторож #278)';
    enq278(ST.state, 'obj-program', 'БК-2021', 'досчёт', '2026-06-10', 'сторож', 'сторож #278');
    const q = () => ST.state.queue.filter(x => x.obj === 'obj-program' && x.ref === 'БК-2021' && x.note === 'сторож #278');
    doRun278(ST.state, '2026-06-15', 'внеплановый', 'сторож', 'прогон за закрытое мимо дверей', null,
             {full: true, why: 'сторож #278', keepT: true});
    const kept = (partOf('obj-program') || {}).kept;
    const open = q().filter(x => !x.done).length;
    ST.state.today = D23;
    ST.run(D23);
    s278 = {kept, open, done: q().map(x => x.done ? x.done.at : 'открыто').join(),
      dec: (ST.state.rows.find(r => r.obj === 'obj-program' && r.ref === 'БК-2021' && r.date === D23) || {dims: {}}).dims['d-pdec']};
  } finally { W['obj-program'][i278] = JSON.parse(k278); }
  ok(278, s278.kept === 5 && s278.open === 1 && s278.done === D23 && s278.dec === 'ПКМ №999 (сторож #278)',
    `(б) отбитая строка состояния работу не снимает: прогон за закрытое 15.06 мимо дверей — не тронуто ${s278.kept}, досчёт БК-2021 от 10.06 открыт (${s278.open}); ночь 23.08 его сняла (${s278.done || '—'}) и написала изменение — «${s278.dec || '—'}» (ИС-8, правка ревью 3 З-16b)`);

  /* #279 — (г) СНЯТИЕ СТОРНО МЕРЫ ЗАКРЫТОГО МЕСЯЦА — одинаково у меры о двух целях и у меры
     об одной: МВ-2026/19 (закрытый май) и её клон МВ-2026/52 с одной целью. Клон заведён ДО
     сида — ключ кэша сида (СС-166) его видит, и мир собирается с ним: его строка тоже лежит на
     09.05 и зафиксирована. Сторно с 20.08 — ночь 22.08 кладёт поправки на 22.08 и маркеры;
     сторно снято с 22.08 — ночь 23.08 поправки и маркеры снимает у обеих мер. */
  const one279 = JSON.parse(JSON.stringify(Wm.find(x => x.id === 'МВ-2026/19')));
  one279.id = 'МВ-2026/52';
  one279.f.targets = ['ТВ-2026/03-1'];
  Wm.push(one279);
  let s279 = {};
  const sig279 = ref => rowsOf('obj-measure', ref).map(x => x.date.slice(5) + ':' + x.part.slice(-4) +
    (x.dims['d-mprimary'] === true ? '+' : '') + (x.dims['d-mstate'] === 'сторнирована' ? '×' : '') + (x.fixed ? '*' : '')).join(' ');
  const i279 = Wm.findIndex(x => x.id === 'МВ-2026/19');
  const k279 = keep(Wm, i279);
  try {
    ST.seed();
    const both = [Wm[i279], Wm.find(x => x.id === 'МВ-2026/52')];
    both.forEach(x => { x.h.mstate = x.h.mstate.concat([['2026-08-20', 'сторнирована']]);
                        ST.enqueue('obj-measure', x.id, 'распоряжение', 'сторно'); });
    ST.run(TODAY);
    const storno = sig279('МВ-2026/19') + ' | ' + sig279('МВ-2026/52') + ' | ' + mkOf('МВ-2026/19').length + '/' + mkOf('МВ-2026/52').length;
    both.forEach(x => { x.h.mstate = x.h.mstate.concat([['2026-08-22', 'зарегистрирована']]);
                        ST.enqueue('obj-measure', x.id, 'распоряжение', 'сторно снято'); });
    ST.state.today = D23;
    ST.run(D23);
    s279 = {storno, back: sig279('МВ-2026/19') + ' | ' + sig279('МВ-2026/52') + ' | ' +
      mkOf('МВ-2026/19').length + '/' + mkOf('МВ-2026/52').length};
  } finally {
    Wm[i279] = JSON.parse(k279);
    Wm.splice(Wm.findIndex(x => x.id === 'МВ-2026/52'), 1);
  }
  ok(279, s279.storno === '05-09:03-1+* 05-09:03-2* 08-22:03-1+× 08-22:03-2× | 05-09:03-1+* 08-22:03-1+× | 2/1' &&
        s279.back === '05-09:03-1+* 05-09:03-2* | 05-09:03-1+* | 0/0',
    `(г) снятие сторно меры закрытого месяца — одинаково у меры о двух целях и у меры об одной: сторно ночью 22.08 — ${s279.storno || '—'}; снято ночью 23.08 — ${s279.back || '—'} («+» представитель, «×» сторнирована, «*» зафиксирована; в конце — маркеры двух целей / одной). Поправка, которая ничего не исправляет, не лежит ни у той, ни у другой (ADR-0239 §4, §5; ревью 3 З-16b)`);
})();
```

- [ ] **Step 2: Переписать `#272` на месте**

`#272` — от комментария `/* #272 — поток событиями` до строки перед `})();` блока З-16b —
заменить целиком:

```js
  /* #272 — поток событиями: «погашено за период» — строки со срезом в (from, to], поправки
     включительно, — равен приросту «погашено всего» по каждому кредиту (ADR-0239 §6, ИС-17).
     Волна 23, З-16c (переписан на месте): тождество держится НАВСЕГДА, на каждой паре
     хранимых первых чисел — решение владельца СС-180 (остановка 2, 19.09.2026): событие
     переписывается на месте, только если исправление ложится в месяц его строки; иначе —
     поправка в месяце исправления, как у закрытого месяца (ADR-0239 §3). Было: сторож держал
     тождество, «пока после конца интервала ни одно его событие не переписано на месте», и
     называл сторно открытого месяца открытым вопросом. Теперь сторно июльского платежа
     ПГ-2026/1141 (КД-2022/065, 520 000), найденное ночью 22.08, кладёт поправку −520 000 в
     август: поток июля — 520 000, как и прирост июля, а август несёт −520 000. Перепривязка
     ПГ-2026/1102 закрытого июня — та же поправка в августе, и та же пара чисел августа.
     Усиление (новых номеров нет): сумма разных валют числом не бывает (ADR-0214 §1) — поток
     без разреза по разновалютному множеству отказывает и называет валюты, по разрезу валюты
     считается, и сом — одно число; у меры потока событиями нет — складывать у неё нечего.
     Конец потока — дата прогона (ИС-36), те же ворота, что у потока итогов; начало — не
     раньше запуска, пока легаси-строк событий нет (СС-Д25). */
  ST.seed();
  const mix272 = ST.eventFlow('obj-repay', 'm-ramount', '2026-06-01', '2026-07-01');
  const cur272 = ST.eventFlow('obj-repay', 'm-ramount', '2026-06-01', '2026-07-01', 'd-pcur');
  const msr272 = ST.eventFlow('obj-measure', 'm-mclaim', '2026-05-01', TODAY);
  const ev272 = (a, b, dim) => ST.eventFlow('obj-repay', 'm-ramount', a, b, dim);
  const tail272 = ev272('2026-08-01', '2026-08-31', 'd-pcredit');
  const fb272 = ST.flowBetween({obj: 'obj-credit', inds: 'm-repaid', from: '2026-08-01', to: '2026-08-31'});
  const y2025 = ev272('2025-01-01', '2025-12-31');
  const pre272 = ev272('2026-04-15', '2026-07-01', 'd-pcredit');
  const launch272 = ev272('2026-05-01', '2026-07-01', 'd-pcredit');
  const guard272 = !mix272.ok && has(mix272.why, 'KGS') && has(mix272.why, 'USD') && has(mix272.why, 'ADR-0214 §1') &&
    cur272.ok && Object.keys(cur272.by).sort().join() === 'KGS,USD' && cur272.by.KGS === 83500 && cur272.by.USD === 3400 &&
    cur272.som === 380830 && !msr272.ok && has(msr272.why, 'event_full');
  const gate272 = !tail272.ok && has(tail272.why, 'прогона не было') && has(tail272.why, 'ИС-36') &&
    !fb272.ok && has(fb272.why, 'прогона не было') &&
    !y2025.ok && has(y2025.why, 'запуска') && !pre272.ok && has(pre272.why, 'СС-Д25') && launch272.ok;
  const repOf = (d, ref) => v(ST.rowsAt('obj-credit', d).find(r => r.ref === ref), 'm-repaid') || 0;
  /* пары интервалов: соседние хранимые первые числа с запуска и хвост до сегодня */
  const firsts272 = ST.askDates('obj-credit').filter(d => d.slice(8) === '01' && d >= '2026-05-01');
  const pairs272 = firsts272.map((d, i) => [d, firsts272[i + 1] || TODAY]);
  const bad272 = () => pairs272.map(([a, b]) => {
    const f = ev272(a, b, 'd-pcredit');
    const bad = f.ok ? ST.registryList('obj-credit', b)
      .filter(ref => cents272((f.by || {})[ref] || 0) !== cents272(repOf(b, ref) - repOf(a, ref))) : ['отказ'];
    return a.slice(5) + '→' + b.slice(5) + ' ' + bad.length;
  });
  /* сид ночь 22.08 не прогоняет — хвост до сегодня отвечает после плановой ночи (ИС-36) */
  ST.run(TODAY);
  const before272 = bad272();
  const iS272 = W['obj-repay'].findIndex(p => p.id === 'ПГ-2026/1141');
  const keep272 = [JSON.stringify(W['obj-repay'][iP]), JSON.stringify(W['obj-repay'][iS272])];
  let after272 = ['не посчитано'], jul272 = {by: {}}, aug272 = {by: {}}, dJul272 = null, dAug272 = null, mk272 = '';
  try {
    const p = W['obj-repay'][iP];
    p.f.credit = 'КД-2025/088';
    p.h.credit = [['2026-06-05', 'КД-2024/117'], ['2026-08-21', 'КД-2025/088']];
    ST.enqueue('obj-repay', 'ПГ-2026/1102', 'распоряжение', 'перепривязка к КД-2025/088');
    const s = W['obj-repay'][iS272];
    s.f.pstate = 'сторнирован';
    s.h.pstate = [['2026-07-02', 'подтверждён'], ['2026-08-21', 'сторнирован']];
    ST.enqueue('obj-repay', 'ПГ-2026/1141', 'распоряжение', 'сторно июльского платежа в августе');
    ST.run(TODAY);
    after272 = bad272();
    jul272 = ev272('2026-07-01', '2026-08-01', 'd-pcredit');
    aug272 = ev272('2026-08-01', TODAY, 'd-pcredit');
    dJul272 = cents272(repOf('2026-08-01', 'КД-2022/065') - repOf('2026-07-01', 'КД-2022/065'));
    dAug272 = cents272(repOf(TODAY, 'КД-2022/065') - repOf('2026-08-01', 'КД-2022/065'));
    mk272 = ST.markers().filter(m => m.ref === 'ПГ-2026/1141' || m.ref === 'ПГ-2026/1102')
      .map(m => m.ref.slice(-4) + ' ' + m.slice_date.slice(5) + '>' + m.corr_slice_date.slice(5)).sort().join(' · ');
  } finally {
    W['obj-repay'][iP] = JSON.parse(keep272[0]);
    W['obj-repay'][iS272] = JSON.parse(keep272[1]);
  }
  const zero272 = list => list.length === pairs272.length && list.every(x => / 0$/.test(x));
  ok(272, pairs272.length === 3 && zero272(before272) && zero272(after272) &&
        jul272.ok && jul272.by['КД-2022/065'] === 520000 && dJul272 === 520000 &&
        aug272.ok && aug272.by['КД-2022/065'] === -468000 && dAug272 === -468000 &&
        aug272.by['КД-2024/117'] === 68000 && aug272.by['КД-2025/088'] === 42500 &&
        mk272 === '1102 06-06>08-22 · 1141 07-03>08-22' && guard272 && gate272,
    `«погашено за период» строками событий равно приросту «погашено всего» по каждому кредиту на КАЖДОЙ паре хранимых первых чисел с запуска и на хвосте до сегодня — до правок (${before272.join(' · ')}) и после (${after272.join(' · ')}), число — расхождения. Сторно июльского ПГ-2026/1141, найденное ночью 22.08, — поправкой в месяце исправления (СС-180, ADR-0239 §3): КД-2022/065 за июль ${jul272.by['КД-2022/065']} при приросте ${dJul272}, за август ${aug272.by['КД-2022/065']} при приросте ${dAug272}; перепривязка ПГ-2026/1102 закрытого июня — там же: КД-2024/117 ${aug272.by['КД-2024/117']} (96 000 − 28 000), КД-2025/088 ${aug272.by['КД-2025/088']} (14 500 + 28 000). Маркеры «исправлено позже» — ${mk272 || '—'}. Июнь без разреза — отказ: «${String(mix272.why || '').slice(0, 72)}…»; по валюте — ${Object.keys(cur272.by || {}).map(k => k + ' ' + cur272.by[k]).join(' · ')}, сом одним числом ${cur272.som} (ADR-0214 §1). У меры — «${String(msr272.why || '').slice(0, 60)}…». Конец потока — дата прогона (ИС-36): (01.08, 31.08] — «${String(tail272.why || 'считается').slice(0, 64)}…», как у потока итогов (${fb272.ok ? 'считается' : 'отказ'}); 2025 год — ${y2025.ok ? 'считается' : 'отказ'}; начало 15.04 — ${pre272.ok ? 'считается' : 'отказ (СС-Д25)'}, с 01.05 — ${launch272.ok ? 'считается' : 'отказ'}`);
```

`iP` и `cents272` — те же, что выше в блоке З-16b (`#271`, заголовок блока).

- [ ] **Step 3: Прогнать — падают `#272`, `#274`, `#276`, `#277`, `#278`**

```bash
node scripts/inspect/statistics-check.mjs > "$SCRATCH/smoke.txt" 2>&1; echo "exit=$?"
grep -E "^\s+FAIL" "$SCRATCH/smoke.txt"
```
Expected: `exit=1`, 259/264 PASS. `#273`, `#275` и `#279` проходят и на `137baf5`: первые два —
граница правила (тот же месяц — на месте, так и было), `#279` — сторож без своего дефекта
(мелкое (г) ревью 3: случая, которого не стерёг никто). Их ловят мутации шага 9. `#116`, `#172`,
`#212` на этом шаге проходят — они падают после шага 4 (довод — шаг 8).

- [ ] **Step 4: Движок — дельта: на месте только в месяце строки**

В `deltaNight` комментарий над условием перезаписи и само условие:

```js
  /* На месте событие переписывается, только если исправление ложится в МЕСЯЦ ЕГО СТРОКИ —
     решение владельца СС-180 (остановка 2, 19.09.2026) к ADR-0239 §3. Месяц — период среза
     (`periodOf`, ADR-0238 §2): ночь 01.09 — август (СС-181). Исправление из другого месяца
     идёт поправкой в месяц исправления с маркером «исправлено позже» — тем же путём, что у
     закрытого, даже если месяц строки ещё открыт: строки состояния на прошедшие даты уже
     легли и не переписываются, и перезапись события на месте развела бы поток событий месяца
     с приростом состояния за тот же месяц — июль, закрытый завтра, разошёлся бы с июлем,
     отвеченным сегодня. Список перезаписи — по сырым строкам. Есть поправки — правка идёт
     поправкой (правка ревью 1 З-16a). */
  if(!orig.fixed && periodOf(orig.date) === periodOf(D) && mine.every(r => r.part === 'original')){
```

Шапку «СОБЫТИЕ ДЕЛЬТОЙ» (над `eventSliceOf`) — фразу «В открытом месяце правка переписывает
строку на месте; в закрытом исходная не трогается, а в месяце исправления ложатся строки
поправки и маркер «исправлено позже»» заменить на:

```js
   дня события, а поправка — то состояние, которое исправляет. Правка в месяце строки
   переписывает строку на месте; правка из другого месяца — открыт он или закрыт — исходную не
   трогает, а в месяце исправления ложатся строки поправки и маркер «исправлено позже»
   (СС-180). Сумма строк — текущий итог. */
```

- [ ] **Step 5: Движок — мера: `corrOf`, `here`, маркеры, снятие поправки**

В `fullNight`, сразу после `const lastOf = …`:

```js
    /* Строку `p` исправляет поправка, а не перезапись, если она зафиксирована или лежит в
       другом периоде, чем строка `l`, которая её сменила (СС-180, СС-182): маркер ставится
       и снимается тем же судом, каким выбирается путь. */
    const corrOf = (p, l) => !!p && (!!p.fixed || periodOf(p.date) !== periodOf(l.date));
```

`here`, условие снятия и две ветки с маркером:

```js
      const here = !last.fixed && periodOf(last.date) === periodOf(D) && (last.date === D || !setChange);
      if(here && prev && !deltaDiff(prev, raw).length && (last.date === D || corrOf(prev, last))){
```
```js
        ops.push({put: Object.assign(raw, {date: last.date}), tgt,
                  sp: splitDiff(last, raw, rowDiff(last, raw)),
                  mark: corrOf(prev, last) ? {slice: prev.date, changed: deltaDiff(prev, raw)} : null});
```
```js
      ops.push({put: Object.assign(raw, {date: D}), tgt, mark: corrOf(last, raw) ? {slice: last.date, changed: diff} : null});
```

Комментарии: в шапке `fullNight` пункт «изменение одних данных … идёт по ADR-0239 §3, §4: на
месте в открытом месяце, поправкой в закрытом» → «на месте в месяце строки пары, поправкой —
из другого месяца, открыт он или закрыт (СС-180)»; над `here` — «На месте строка пары
переписывается, если она не зафиксирована, лежит в периоде ночи (СС-180) и не раньше ночи при
смене набора»; над второй веткой — «Из другого месяца или у зафиксированной строки — поправка
полного состояния и маркер с целью (ADR-0239 §4, §5, СС-180); у строки того же месяца раньше
ночи при смене набора — новая строка на D, прежняя отвечает за свои даты»; в комментарии
«СМЕНА НАБОРА … СТОРНО ВСЕЙ МЕРЫ» — «в открытом месяце на месте (ADR-0239 §3), в закрытом —
поправкой» → «в месяце строки на месте, из другого месяца — поправкой (СС-180)».

- [ ] **Step 6: Движок — снятая цель и сторно меры различаются ночью сторно (а)**

Новая функция — перед `function fullNight`:

```js
/* НОЧЬ, ПОСТАВИВШАЯ СТРОКЕ ПАРЫ ЕЁ «СТОРНИРОВАНА» (правка ревью 3 З-16b, решение Б; СС-183).
   Строка пары, переписанная на месте, не помнит, когда её переписали, — помнит журнал
   прогонов: ночь, которая её создала (`created`) или переписала поле сторно (`rewrote` с
   `pairOff[0]`), не позже следующей строки той же пары. Снятую цель от сторнированной меры
   отличает не строка представителя на дату — её могли сторнировать на месте ПОЗЖЕ снятия, —
   а порядок ночей: сторно, поставленное представителю не раньше, чем паре её снятие, — сторно
   меры; раньше — пара снята сама. */
function offNightOf(st, o, r){
  const next = st.rows.reduce((m, x) => x.obj === o.id && x.ref === r.ref && x.part === r.part &&
    x.date > r.date && (!m || x.date < m) ? x.date : m, null);
  let n = r.date;
  st.runs.forEach(R => {
    if(R.date <= n || (next && R.date >= next)) return;
    const p = (R.parts || []).find(q => q.obj === o.id);
    if(p && (p.created || []).concat(p.rewrote.filter(x => (x.fields || []).indexOf(o.pairOff[0]) >= 0))
      .some(x => x.ref === r.ref && x.target === r.part)) n = R.date;
  });
  return n;
}
```

В `fullNight` `wholeOff` принимает строку, а не дату, и `back` зовёт его так:

```js
    const wholeOff = l => {
      const rep = had.map(tg => fullAt(st, o.id, item.id, tg, l.date)).find(r => !!r && r.dims[o.primary] === true);
      return !!(off && rep && rep.dims[off[0]] === off[1] && offNightOf(st, o, rep) <= offNightOf(st, o, l));
    };
```
```js
    const back = pairs.some(pr => { const l = lastOf(pr.f.target); return isOff(l) && !isOff(rowOf(pr)) && !wholeOff(l); });
```

В комментарии над `wholeOff` к фразе «Различает их представитель на дату этой строки» дописать:
«— и ночь, поставившая ему сторно: не раньше ночи снятия пары (`offNightOf`). Сторно меры,
положенное на месте строки представителя позже снятия цели, снятую цель не оживляет».

- [ ] **Step 7: Движок — путь состояний снимает работу за дверью (б), слово (в)**

В `doRun`, путь состояний — вместо `dequeueSeen(st, o, item, dateISO);` перед `buildRow`:

```js
      /* Работа снимается, только если строка пройдёт дверь (СС-184): отбитая строка закрытого
         периода работу не снимает — её применит ближайшая открытая ночь, как у событий. */
      if(!rowGate(st, {obj: o.id, ref: item.id, date: dateISO, part: null}).why) dequeueSeen(st, o, item, dateISO);
```

Комментарий `dequeueSeen`, п. 1 — последние две фразы («Путь состояний зовёт её, как и прежде,
при обходе, до записи строки: … ворота правки 2 состояний не касались.») заменить на: «Путь
состояний зовёт её при обходе, до записи строки, но только если строка пройдёт дверь (`rowGate`,
З-16c): отбитая строка закрытого периода работу не снимает.» Последнюю фразу п. 2 («Строже,
`q.at ≤ worldAt(D)`, мерить нельзя без потери смысла пересчёта: …») заменить на (слово (в)):
«Строже, `q.at ≤ worldAt(D)`, мерить не нужно: внеплановый пересчёт ночи того же дня, для
которого распоряжение и ставят, изменение пишет — и оставлять работу открытой ему незачем.»

- [ ] **Step 8: Комментарий двери `ST.eventFlow`, переписка `#116`, `#172`, `#212`, шапка смоука**

В комментарии над `ST.eventFlow` фразы «Поправка события ЗАКРЫТОГО месяца ложится в месяц
исправления … Событие открытого месяца переписывается на месте — см. границу ниже.» заменить на
«Поправка события ложится в месяц исправления и входит в ЕГО поток, если исправление пришло не
в месяце строки события, — открыт тот месяц или закрыт (СС-180); месяц строки она не
переписывает (ИС-17, ИС-8).» Абзац «ГРАНИЦА, названная вслух, — и ОТКРЫТЫЙ ВОПРОС …» до конца
комментария заменить на:

```js
   ТОЖДЕСТВО ДЕРЖИТСЯ НАВСЕГДА (СС-180, решение владельца на остановке 2): поток событий
   месяца равен приросту «погашено всего» за тот же месяц по каждому кредиту. Прежде событие
   открытого месяца переписывалось на месте, а строки кредита на прошедшие даты — нет, и
   сторно, пришедшее после конца месяца, их разводило (ПГ-2026/1141: поток июля 0 при
   приросте 520 000). Теперь такое сторно — поправка в месяце исправления: июль несёт 520 000,
   август −520 000 (#272). */
```

`#116` — после комментария «Волна 23, З-16a (переписан на месте) …» дописать абзац и заменить
выборку и условие:

```js
  /* Волна 23, З-16c (переписан на месте): «на месте» — только в месяце строки события
     (СС-180, ADR-0239 §3). Отзыв 22.06 нашла ночь 23.06 — июнь, месяц строки: исходная на
     11.06 переписана на месте на «отозвано». Восстановление 04.07 нашла ночь 05.07 — июль,
     другой месяц: строка-поправка `match` на 05.07 с «восстановлено» и маркер «исправлено
     позже» на 11.06, хотя июнь тогда ещё был открыт. Строк 1 → 2, журнал перезаписи называет
     одну ночь — 23.06; история оси видна строками и журналом вместе. */
  const rows0620 = st.rows.filter(r => r.ref === 'ПП-2026/0620')
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const mk0620 = ST.markers().filter(m => m.ref === 'ПП-2026/0620')
    .map(m => m.slice_date + '>' + m.corr_slice_date + ':' + m.closed_how).join();
```
```js
       hist.length === 2 && rows0620.length === 2 && rows0620[0].part === 'original' &&
       rows0620[0].date === '2026-06-11' && rows0620[0].dims['d-rmatch'] === 'отозвано' &&
       rows0620[1].part === 'match' && rows0620[1].date === '2026-07-05' &&
       rows0620[1].dims['d-rmatch'] === 'восстановлено' &&
       mk0620 === '2026-06-11>2026-07-05:corrected_later' && rw0620.join() === '2026-06-23',
```

и в тексте — хвост «сопоставление ПП-2026/0620 двигалось дважды в открытом июне, …» на:

```js
сопоставление ПП-2026/0620 двигалось дважды, пока июнь был открыт, и строки у него — ${rows0620.map(r => r.date.slice(5) + ' ' + r.part + ' «' + r.dims['d-rmatch'] + '»').join(', ')}: отзыв, найденный в июне, переписал исходную на месте, а восстановление, найденное в июле, легло поправкой в месяц исправления с маркером ${mk0620 || '—'}; журнал перезаписи называет ночь ${rw0620.join(', ') || '—'} (ИС-10, ИС-55, ADR-0239 §3, СС-180)`);
```

`#172` — `own172.length === 2195` → `2196`, комментарий:

```js
  /* Волна 23, З-16c (переписан на месте): строк 2195 → 2196 — восстановление ПП-2026/0620,
     найденное ночью 05.07, легло строкой-поправкой в месяце исправления, а не на месте июньской
     строки (СС-180, ADR-0239 §3; довод у #116). Сомовых клеток прежние 16109 — у поступления
     сомового близнеца нет; дат прежние 59 — 05.07 уже дата строк. Расхождений — ноль. */
```

`#212` — `r212.fixed === 52` → `53`, к последнему абзацу комментария дописать:

```js
     Волна 23, З-16c (переписан на месте): зафиксировано 52 → 53 — строк событий июля 12 → 13:
     поправка `match` ПП-2026/0620 на 05.07 (СС-180; довод у #116). Итог 01.08 — прежние 40. */
```

Шапка смоука: в строке блока З-16b хвост «поправки — в месяце исправления, пока после конца
интервала ни одно его событие не переписано на месте (открытый вопрос ADR-0239 §3)» →
«поправки — в месяце исправления»; после блока З-16b — строки:

```js
// блок волны 23 З-16c — поправка в месяце исправления (СС-180, решение владельца; ADR-0239
// §3): событие переписывается на месте, только если исправление ложится в месяц его строки
// (месяц — период среза, ночь 01.09 — август); иначе строка-поправка в месяце исправления и
// маркер «исправлено позже», как у закрытого месяца, — у дельты и у меры × цель; поток событий
// месяца равен приросту состояния за месяц навсегда · снятая цель не оживает, когда меру
// сторнировали на месте позже · отбитая строка состояния работу не снимает · снятие сторно
// меры закрытого месяца одинаково у меры о двух целях и об одной.
```

Почему `#116`, `#172`, `#212` падают — следствие модели, а не значение: у ПП-2026/0620 теперь две
строки вместо одной (счёт строк), и та же строка — тринадцатая строка событий июля. Доказано
мутацией 1 шага 9 (снять условие периода в `deltaNight` — все три возвращаются к прежним
числам).

- [ ] **Step 9: Прогнать — зелёный целиком**

Expected: `exit=0`, **264/264 PASS** (257 + 7). Сид: строк 2229 → 2230, строк событий 36 → 37,
маркеров 0 → 1 (ПП-2026/0620).

- [ ] **Step 10: Мутации** (копия дерева в scratchpad, одна копия на мутацию; проверено на
прототипе `$SCRATCH/plan3`, смоук шага 9):

| № | мутация | падает |
|---|---|---|
| 1 | `deltaNight`: снять `periodOf(orig.date) === periodOf(D) &&` | `#116`, `#172`, `#212`, `#272`, `#274` |
| 2 | `deltaNight`: `ym(orig.date) === ym(D)` вместо `periodOf` (ночь 01.09 — сентябрь) | `#273` |
| 3 | `fullNight`: снять условие периода у `here` | `#276` |
| 4 | `fullNight`: `ym` вместо `periodOf` у `here` | `#275` |
| 5 | `corrOf = (p, l) => !!p && !!p.fixed` — маркер только у зафиксированной | `#276` |
| 6 | условие снятия поправки — прежнее `(last.date === D \|\| prev.fixed)` | `#276` |
| 7 | `wholeOff` — прежний, без `offNightOf` | `#277` |
| 8 | путь состояний снимает работу без `rowGate` | `#278` |
| 9 | `back` без `&& !wholeOff(l)` | `#269`, `#279` |

Без мутаций — 264/264. Каждая мутация роняет ровно названные сторожа.

- [ ] **Step 11: Коммит** — `Статистика: волна 23 З-16c — поправка в месяце исправления: тождество потока навсегда`.
Тело: решение владельца `СС-180` (ADR-0239 §3 уточнён в журнале, текст ADR не правится),
`СС-181`…`СС-184`; сторожа `#273`…`#279`; переписаны `#272`, `#116`, `#172`, `#212`.

### Task 5: З-17 — деньги: курс один раз на строку, клетка — одно число (ИС-56, ADR-0240)

Спецификация §4 З-17. Решения — `СС-186`…`СС-192`. Номера строк — по `137baf5` плюс З-16c, подсказки.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - шапка — строка `ИС-16` (~747);
  - `OBJECTS` — реквизит `rateDay` у `obj-repay` (~2649);
  - `CORE` (~3250–3450) — `flowSom`, `flowCell`, `portfolioFlow`; швы `calcAccrual`,
    `calcAllocation`, `calcDebt.writtenOff`, `calcPortfolio` (потоки);
  - новые `fxObj`, `curDimOf`, `fxOf`, `rowCur` — перед `ST.VTYPES = clone(VTYPES)` (~4000);
  - `readInd` / `readIndRaw` (~4458–4530), `buildRow` (~4531), `ROW_SHAPE`/`ROW_VALUES` (~4619);
  - `rowDiff` (~4670), `bareOf` (~4905), `fxCursOf` (~4923) и комментарий над ним;
  - дельта: `scaleCell` … `cellSig` (~5220–5290; `partKey`, `ownParts`, `mergeParts`, `normCell`
    снимаются), `deltaAt` (~5306);
  - `loadLegacy` (~6339), `ST.eventFlow` (~7095), `matchFilter` (~7330), `rowSrc` (~7345),
    `registryList` (~8217), `partsOf` (~7766, снимается), `aggValue` (~7836), `ST.flowBetween`
    (~8385), экран `indCellText` (~9393) и строка курса (~9954).
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#3`, `#27`, `#29`, `#70`,
  `#71`, `#170`, `#172`, `#173`, `#175`, `#182`, `#183`, `#202`, `#223`, `#254`, `#258`, `#259`,
  `#262`, `#263`, `#267`; блок З-17 (`#280`, `#281`) перед отчётом.

**Interfaces:**
- Consumes: `CORE.toSom`, `CORE.somRound`, `CORE.cell`, `CORE.portfolioCell`, `CORE.grow`,
  `CORE.repaidOf`, `CORE.debtParts`, `rateOn`, `ANCHOR`, `worldAt`, `RELEASE`/`st.release`
  (З-14), `readDim`, `markDating`, `deltaAt`, `rowDiff`/`splitDiff`, `ST.flowBetween`, `ST.eventFlow`.
- Produces:
  - поле строки `fx` = `{rate, rateDate}` у объекта, в таблице которого релиз вывел колонку
    `rate` (кредит, требование, платёж, поступление, мера; мигрированный объект — так же), иначе
    `null`; у легаси — `null` (`СС-186`); `ST.ROW_SHAPE` — 11 полей, `ST.ROW_VALUES = dims,inds,fx`;
  - клетка величины — `{v}` и ничего больше; валюта величины — `ST.rowCur(row, indId)` (сомовая
    запись → `'KGS'`, валютная → разрез строки с колонкой `cur`); `ST.curDimOf(objId)`;
  - `OBJECTS[].rateDay` — реквизит дня курса события; объявлен только у платежа (`'rdate'`,
    `СС-187`), у прочих событий день курса — день рождения строки;
  - `CORE.flowSom(item, get, dateISO)` → сомовый поток, операции по курсам их дней;
    `CORE.flowCell(item, get, dateISO)`, `CORE.portfolioFlow(list, dateISO, get)`; сомовая
    сторона денежного ответа потока несёт `som.flow = true` (`СС-189`);
  - `readIndRaw` у денег отдаёт `{v, som, curs}` — сомовое число и валюты состава из ответа ядра;
    в строку они не ложатся (`СС-192`);
  - `ST.flowBetween` по валютной и по сомовой записи потока отвечает сомовым числом разности
    сомовых колонок (`СС-188`); отказа «период по сомовой записи не считается» больше нет;
  - `rowDiff` называет `fx`, когда курс строки сменился (`СС-190`); `deltaAt` — `fx` последней
    строки с деньгами (`СС-191`);
  - `ST.partsOf` снят.

- [ ] **Step 1: Падающие сторожа `#280`, `#281`**

В шапку смоука, после строк блока З-16c:

```js
// меры закрытого месяца одинаково у меры о двух целях и об одной.
// блок волны 23 З-17 — деньги (ИС-56, ADR-0240): валюта, курс и дата курса один раз на строку,
// клетка — одно число; курс строки только к остаткам, у потока обе колонки от ядра по курсам
// операций; курс события — на день события; итоги заёмщика, залога, договора, дела — в сомах.
// Zero-dep:
```

Перед `/* ---- отчёт ---- */`, после блока З-16c:

```js
/* ===== Волна 23 · З-17 — деньги (ИС-56, ADR-0240). Валюта, курс и дата курса лежат в строке
   ОДИН РАЗ; клетка величины — одно число; курс строки применяется только к остаткам; у потока
   обе колонки от ядра, по курсам операций; курс события — на день события; итоги — в сомах. ===== */
(() => {
  const CORE = vm.runInContext('CORE', sandbox), W = vm.runInContext('WORLD', sandbox);
  const rateOn = vm.runInContext('rateOn', sandbox);
  const one = c => !!c && Object.keys(c).length === 1 && 'v' in c;

  /* #280 — форма денег. Каждая клетка каждой строки — одно число: хранимые строки, легаси,
     действующие ответы событий и ответы двери строк. Курс строки — у объектов, в таблице
     которых релиз вывел колонку `rate`, и только у них; у легаси он пуст. Курс события — на
     день события: перепривязка валютного платежа от 18.06, легшая строкой 22.08, несёт курс
     18.06, а не курс кануна 22.08, который несёт строка кредита той же даты (ADR-0240 §3). И
     платёж, опознанный задним числом: клон ПГ-2026/1127 с привязкой 10.08 заведён ДО сида (ключ
     кэша его видит, СС-166) — строка ложится 11.08, деньги читаются днём привязки, а курс — дня
     поступления 18.06 (`rateDay`, СС-187), не 10.08. */
  const Wp280 = W['obj-repay'];
  const late280 = JSON.parse(JSON.stringify(Wp280.find(x => x.id === 'ПГ-2026/1127')));
  late280.id = 'ПГ-2026/1227'; late280.f.bdate = '2026-08-10';
  Wp280.push(late280);
  let lr280 = null;
  try {
    ST.seed();
    lr280 = ST.state.rows.find(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1227') || null;
  } finally { Wp280.splice(Wp280.findIndex(x => x.id === 'ПГ-2026/1227'), 1); }
  ST.seed();
  const rel280 = ST.release();
  const fxObjs280 = Object.keys(rel280.tables).filter(id => rel280.tables[id].cols.indexOf('rate') >= 0).sort();
  /* `_v` — только у величин, возникших в валюте: таблицы с валютной колонкой — ровно таблицы с
     курсом; у итогов заёмщика, залога, залогового договора и дела денежные записи — только
     сомовые (ADR-0240 §1, §4). */
  const vObjs280 = Object.keys(rel280.tables).filter(id => rel280.tables[id].cols.some(c => /_v$/.test(c))).sort();
  const somOnly280 = ['obj-borrower', 'obj-collateral', 'obj-zdeal', 'obj-case'].every(o =>
    ST.OBJ(o).inds.map(ST.IND).filter(i => i && i.money && i.src !== 'агрегат').every(i => i.vtype === 'money_som'));
  const ans280 = ['obj-repay', 'obj-receipt', 'obj-measure'].reduce((a, o) => a.concat(ST.rowsAsOf(o, ASK)), [])
    .concat(ST.statRows({obj:'obj-credit', date: ASK}).rows, ST.statRows({obj:'obj-borrower', date: ASK}).rows);
  const all280 = ST.state.rows.concat(ans280);
  const badCell280 = all280.reduce((n, r) => n + Object.keys(r.inds).filter(id => !one(r.inds[id])).length, 0);
  const badFx280 = all280.filter(r => ST.isLegacyRow(r) ? r.fx !== null
    : (fxObjs280.indexOf(r.obj) >= 0 ? !(r.fx && Object.keys(r.fx).sort().join() === 'rate,rateDate' && r.fx.rate > 0)
                                      : r.fx !== null)).length;
  const p280 = W['obj-repay'].find(x => x.id === 'ПГ-2026/1127');
  const keep280 = {f: p280.f.credit, h: p280.h.credit};
  let rb280 = null, cr280 = null;
  try {
    p280.f.credit = 'КД-2025/101'; p280.h.credit = [['2026-06-18', 'КД-2025/043'], ['2026-08-21', 'КД-2025/101']];
    ST.enqueue('obj-repay', 'ПГ-2026/1127', 'распоряжение', 'перепривязка к КД-2025/101');
    ST.run(TODAY);
    rb280 = ST.state.rows.find(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1127' && r.date === TODAY && r.part === 'rebind');
    cr280 = ST.rowsAt('obj-credit', TODAY).find(r => r.ref === 'КД-2025/043');
  } finally {
    p280.f.credit = keep280.f;
    if(keep280.h === undefined) delete p280.h.credit; else p280.h.credit = keep280.h;
  }
  const ev280 = rateOn('USD', '2026-06-18');
  ok(280, fxObjs280.join() === 'obj-claim,obj-credit,obj-measure,obj-receipt,obj-repay' &&
        vObjs280.join() === fxObjs280.join() && somOnly280 &&
        badCell280 === 0 && badFx280 === 0 && typeof ST.partsOf === 'undefined' &&
        ST.ROW_VALUES.join() === 'dims,inds,fx' &&
        ST.OBJ('obj-repay').rateDay === 'rdate' &&
        !!lr280 && lr280.date === '2026-08-11' && lr280.fx.rate === 87.45 && lr280.fx.rateDate === '2026-05-31' &&
        !!rb280 && rb280.fx.rate === ev280.rate && rb280.fx.rateDate === ev280.rateDate &&
        rb280.inds['m-ramount-som'].v === CORE.somRound(rb280.inds['m-ramount'].v * ev280.rate, ST.roundOf('m-ramount-som')) &&
        !!cr280 && cr280.fx.rateDate === '2026-08-18' && cr280.fx.rate !== rb280.fx.rate,
    `клетка — одно число: из ${all280.length} строк и ответов (хранимые, легаси, действующие события, двери строк) клеток не одним числом ${badCell280}; нормализатора состава «ST.partsOf» больше нет (${typeof ST.partsOf}). Курс строки — у объектов, в таблице которых релиз вывел колонку курса (${fxObjs280.join(', ')}), и только у них; строк с курсом не на месте ${badFx280}, у легаси курса нет. Валютная колонка «_v» — у тех же таблиц и только у них (${vObjs280.join(', ')}); у заёмщика, залога, залогового договора и дела денежные записи только сомовые (${somOnly280}). Курс события — на день события: перепривязка ПГ-2026/1127 от 18.06 легла строкой ${TODAY} с курсом ${rb280 ? rb280.fx.rate + ' от ' + rb280.fx.rateDate : '—'} — курсом 18.06, а строка кредита той же даты несёт курс кануна ${cr280 ? cr280.fx.rate + ' от ' + cr280.fx.rateDate : '—'}; сомовая сумма платежа посчитана курсом дня события. Платёж, опознанный 10.08 задним числом, лёг строкой ${lr280 ? lr280.date : '—'} с курсом ${lr280 ? lr280.fx.rate + ' от ' + lr280.fx.rateDate : '—'} — дня поступления, а не дня привязки (ИС-56, ADR-0240 §2, §3, СС-187)`);

  /* #281 — поток: обе колонки от ядра, по курсам операций. «Выдано» долларового договора в
     сомах — по курсу дня выдачи (выдача лежит до якоря зеркала, курс якоря), а не по курсу
     строки: переоценки у выданного нет. «Погашено» в сомах — сумма платежей, каждый по курсу
     своего дня, и сторож складывает их сам, днём за днём. Остаток той же строки — на курс
     строки. Период по потоку — разность сомовых колонок, и курсовой разницы в нём нет: прежнее
     приведение разностей по валютам курсом конца периода дало бы другое число. Итог заёмщика
     по потоку — сумма сомовых потоков его договоров (ADR-0240 §3, §4). */
  ST.seed();
  const ANCHOR = vm.runInContext('ANCHOR', sandbox);
  const r281 = ST.statRows({obj:'obj-credit', date: ASK}).rows.find(r => r.ref === 'КД-2025/043');
  const it281 = W['obj-credit'].find(x => x.id === 'КД-2025/043');
  const v281 = id => ((r281 || {inds: {}}).inds[id] || {}).v;
  const R = ST.roundOf('m-repaid-som');
  let byDay281 = CORE.repaidOf(it281, ANCHOR) * rateOn('USD', ANCHOR).rate, prev281 = CORE.repaidOf(it281, ANCHOR);
  for(let d = ANCHOR; d < ST.worldAt(ASK); ){
    d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
    const now = CORE.repaidOf(it281, d);
    byDay281 += (now - prev281) * rateOn('USD', d).rate; prev281 = now;
  }
  byDay281 = CORE.somRound(byDay281, R);
  const iss281 = CORE.somRound(v281('m-issued') * rateOn('USD', ANCHOR).rate, ST.roundOf('m-issued-som'));
  const fx281 = r281 ? r281.fx.rate : null;
  const jun281 = ST.flowBetween({obj:'obj-credit', inds:'m-repaid', from:'2026-06-01', to:'2026-07-01'});
  const e281 = ST.statRows({obj:'obj-credit', date:'2026-07-01'}).rows, b281 = ST.statRows({obj:'obj-credit', date:'2026-06-01'}).rows;
  const old281 = e281.reduce((n, r) => {
    const b = b281.find(x => x.ref === r.ref);
    const dv = ((r.inds['m-repaid'] || {}).v || 0) - (b ? ((b.inds['m-repaid'] || {}).v || 0) : 0);
    return n + dv * r.fx.rate;
  }, 0);
  const bor281 = ST.statRows({obj:'obj-borrower', date: ASK}).rows.find(r => r.ref === '01234199010101');
  const his281 = ST.statRows({obj:'obj-credit', date: ASK}).rows.filter(r => r.dims['d-binn'] === '01234199010101');
  const sum281 = CORE.somRound(his281.reduce((n, r) => n + r.inds['m-repaid-som'].v, 0), R);
  ok(281, !!r281 && fx281 === 88.3 &&
        v281('m-issued-som') === iss281 && v281('m-issued-som') !== CORE.somRound(v281('m-issued') * fx281, R) &&
        v281('m-repaid-som') === byDay281 && v281('m-repaid-som') !== CORE.somRound(v281('m-repaid') * fx281, R) &&
        v281('m-debt-som') === CORE.somRound(v281('m-debt') * fx281, ST.roundOf('m-debt-som')) &&
        jun281.ok && jun281.value === 380830 && CORE.somRound(old281, R) === 379980 &&
        !!bor281 && his281.map(r => ST.rowCur(r, 'm-debt')).sort().join() === 'EUR,KGS' &&
        bor281.inds['m-brepaid'].v === sum281,
    `поток — обе колонки от ядра, по курсам операций. КД-2025/043 на ${ASK}: выдано ${v281('m-issued')} USD = ${v281('m-issued-som')} сом. по курсу дня выдачи (${rateOn('USD', ANCHOR).rate}), а не ${CORE.somRound(v281('m-issued') * fx281, R)} по курсу строки ${fx281} — выданное не переоценивается; погашено ${v281('m-repaid')} USD = ${v281('m-repaid-som')} сом., и сторож сложил платежи по курсам их дней сам (${byDay281}), а курс строки дал бы ${CORE.somRound(v281('m-repaid') * fx281, R)}. Остаток той же строки — на курс строки: ${v281('m-debt')} × ${fx281} = ${v281('m-debt-som')}. Погашено за июнь — ${jun281.value} сом. разностью сомовых колонок; приведение разностей по валютам курсом конца периода дало бы ${CORE.somRound(old281, R)} — курсовую разницу внутри движения. Итог заёмщика 01234199010101 (кредиты ${his281.map(r => ST.rowCur(r, 'm-debt')).join(' + ')}) по потоку «погашено» — ${bor281 ? bor281.inds['m-brepaid'].v : '—'}, ровно сумма сомовых потоков его договоров (${sum281}) (ИС-56, ADR-0240 §3, §4)`);
})();

```

- [ ] **Step 2: Переписать сторожей формы денег**

Все переписки — одного рода: клетка теряла `cur`/`rate`/`rateDate`/`parts`/`from`/`round`, и
сторож, читавший их в клетке, читает то же в строке (`r.fx`, `ST.rowCur`) или в ответе ядра. Числа
сторожей прежние, кроме `#262` — там значение, и довод у него (мутация M5).

`#3` — в блоке A, `valKeys` и условие:

```js
  /* Волна 23, З-17 (переписан на месте): полей 10 → 11 — `fx`, курс строки, и он в ряду
     ЗНАЧЕНИЙ: это ответ ядра о курсе на дату (ИС-56, ADR-0240 §2). Носителей значений три, и
     ключи двух из них — имена записей реестра, а у третьего ключи закрыты: курс и его дата.
     Записью реестра курс не стал — его колонки `rate` и `rate_date` в схеме служебные, как `cur`. */
  const valKeys = vals.filter(f => f !== 'fx').reduce((a, f) => a.concat(Object.keys(u3[f] || {})), []);
```
```js
  ok(3, shape.length === 11 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
```
```js
       shape.join(',') === 'obj,ref,date,part,dims,inds,fx,when,srcs,fixed,by' &&
       key.join(',') === 'obj,ref,date,part' &&
       vals.join(',') === 'dims,inds,fx' && orig.length === 1 && both.length === 0 && cover &&
       !!u3.fx && Object.keys(u3.fx).sort().join() === 'rate,rateDate' &&
```

и в тексте «Полей десять — …» → «Полей одиннадцать — десятое, «part», стоит в адресе (СС-170), одиннадцатое, «fx», курс строки, — в ряду значений (ИС-56):».

`#27` — блок H:

```js
  /* Волна 23, З-17 (переписан на месте): валюта, курс и дата курса лежат в СТРОКЕ один раз —
     валюта разрезом, курс и дата полем `fx`, — и клетка валютной величины несёт одно число;
     сомовая сторона — своя клетка, тоже одно число (ИС-56, ADR-0240 §2). */
  const somCell = usd.inds[ST.somIdOf('m-debt')];
  const fx27 = usd.fx || {};
  ok(27, ST.rowCur(usd, 'm-debt') === 'USD' && usd.dims['d-cur'] === 'USD' &&
        fx27.rate === 88.30 && fx27.rateDate === '2026-08-18' && !stored &&
        Object.keys(cell).join() === 'v' && somCell && Object.keys(somCell).join() === 'v' &&
        somCell.v === Math.round(cell.v * fx27.rate * 100)/100,
```

текст:

```js
    `сумма — в валюте договора (${cell.v} ${ST.rowCur(usd, 'm-debt')}), курс и дата курса — в строке один раз (${fx27.rate} от ${fx27.rateDate}); сомовой стороны валютная клетка в себе не несёт (приложением к чужой клетке величина не живёт), а несёт её СОСЕДНЯЯ колонка — ${(somCell || {}).v} сом. Клетка — одно число; перемножить и сверить можно не выходя из строки — ИС-16 сужен, ИС-44, ИС-56, ADR-0240 §2`);
```

`#29`: `ST.somValue(usd, 'm-debt') === Math.round(cell.v * usd.fx.rate * 100)/100`.

`#70` — сборка `single` берёт валюту строки:

```js
    const inn = r.dims['d-binn'], c = r.inds['m-total'], cur = ST.rowCur(r, 'm-total');
    if(!inn || !c) return;
    single[inn] = single[inn] || {};
    single[inn][cur] = Math.round(((single[inn][cur] || 0) + c.v) * 100) / 100;
```

и сверка с портфелем — с составом ответа ядра:

```js
  /* Волна 23, З-17 (переписан на месте): основания `from` в клетке больше нет — клетка одно
     число (ИС-56, ADR-0240 §2, §4). Тождество «свод = сумма одиночных ответов по каждой валюте»
     сверяется с СОСТАВОМ ОТВЕТА ЯДРА на канун среза — тем, из которого ночь посчитала сомовое
     число строки, — а сомовое число строки с его сомовой стороной. «Остаток = просрочено +
     срочно» держится на строке в сомах: три числа округлены порознь, разница не больше двух
     копеек. */
  const W70 = vm.runInContext('WORLD', sandbox), CORE70 = vm.runInContext('CORE', sandbox);
  const port70 = r => {
    const it = W70['obj-borrower'].find(x => x.id === r.ref);
    return it ? CORE70.read('calcPortfolio', it, ST.worldAt(ASK)) : null;
  };
  brows.forEach(r => {
    const a = port70(r) || {};
    const parts = ((a.total || {}).parts || []).filter(p => p.value != null).map(p => ({cur: p.cur, v: p.value}));
    const want = single[r.ref] || {};
    Object.keys(want).forEach(cur => {
      const got = parts.find(x => x.cur === cur);
      if(!got || Math.abs(got.v - want[cur]) > 0.01) broken.push(r.ref + ' ' + cur);
    });
    if(parts.length !== Object.keys(want).length) broken.push(r.ref + ' состав');
    const t = r.inds['m-btotal'], o = r.inds['m-bover'], c = r.inds['m-bcurr'];
    if(t && (!a.total || Math.abs(t.v - a.total.som.value) > 0.005)) broken.push(r.ref + ' сом');
    if(t && Math.abs(t.v - ((o || {v: 0}).v + (c || {v: 0}).v)) > 0.02) broken.push(r.ref + ' тождество');
  });
```

`#71`:

```js
  const mixCell = mix ? mix.inds['m-btotal'] : null;
  /* Волна 23, З-17 (переписан на месте): основания в клетке нет (ИС-56) — части и их курсы
     называет ответ ядра на канун среза, и сомовое число строки обязано быть их суммой. */
  const W71 = vm.runInContext('WORLD', sandbox), CORE71 = vm.runInContext('CORE', sandbox);
  const it71 = mix ? W71['obj-borrower'].find(x => x.id === mix.ref) : null;
  const from = it71 ? (CORE71.read('calcPortfolio', it71, ST.worldAt(ASK)).total.parts || [])
    .filter(p => p.value != null) : [];
  const byHand = from.reduce((a, x) => a + x.value * x.rate, 0);
```
```js
  ok(71, mixCell && Object.keys(mixCell).join() === 'v' && mix.fx === null && mixCell.v === Math.round(byHand * 100)/100 &&
```

текст: «…ОДНИМ числом в сомах: …» → «лежит в строке заёмщика ОДНИМ числом в сомах: ${(mixCell || {}).v}, и это ровно ${from.map(x => x.value + ' ' + x.cur + '×' + x.rate).join(' + ')}, посчитанное ядром; части и курсы называет ответ ядра, в строке их нет — у заёмщика и курса строки нет (${mix ? String(mix.fx) : '—'}).».

`#170`: `cell170.cur === 'KGS'` → `Object.keys(cell170).join() === 'v' && ST.rowCur(rows170.rows[0], 'm-debt-som') === 'KGS'`.

`#172` — сторож на каждой записи целиком заменяет `somOnlyWhy` и `audit` (до `const a172 = audit();`):

```js
  /* Волна 23, З-17: курс лежит в СТРОКЕ (`r.fx`), а клетка — одно число (ИС-56, ADR-0240 §2).
     Сомовых клеток по-прежнему два рода, но сверяются они по-разному, и граница — не род
     клетки, а род величины. ОСТАТОК (долг, просрочка, сумма платежа) — на курс строки: его
     сомовое число — валютное, перемноженное курсом дня, и перемножить его можно, не выходя
     из строки. ПОТОК (выдано, погашено, начислено, списано) и ИТОГ В СОМАХ — сумма операций по
     курсам их дней (ADR-0240 §3, §4): одного курса у него нет, и сверяется он с ЯДРОМ на дату
     строки. Ядро демо-мира детерминировано и курсов задним числом в засеве не уточняет,
     поэтому его ответ на канун даты строки и есть то, что ночь записала. */
  const W172 = vm.runInContext('WORLD', sandbox);
  const itemOf172 = r => (W172[r.obj] || []).find(x => x.id === r.ref) || null;
  const coreSom172 = (rec, r) => {
    const it = itemOf172(r);
    if(!it) return undefined;
    if(rec.src === 'поле') return it.f[rec.key] == null ? undefined : it.f[rec.key];
    const a = CORE.read(rec.seam, it, ST.worldAt(r.date));
    const c = a && a[rec.field];
    return c && c.som ? c.som.value : undefined;
  };
  /* Объект с валютой — тот, в таблице которого релиз вывел колонку курса: схема, а не
     список в сторож (ADR-0240 §2). */
  const REL172 = ST.release();
  const fxObj172 = id => !!REL172.tables[id] && REL172.tables[id].cols.indexOf('rate') >= 0;
  const oneNumber = c => !!c && Object.keys(c).length === 1 && 'v' in c;
  const audit = () => {
    const bad = [];
    let seen = 0, som = 0, flow = 0, bal = 0, fxOn = 0, fxOff = 0;
    ST.state.rows.filter(r => !ST.isLegacyRow(r)).forEach(r => {
      const withFx = fxObj172(r.obj);
      if(withFx){
        fxOn++;
        if(!r.fx || !(r.fx.rate > 0) || !r.fx.rateDate) bad.push({ref: r.ref, date: r.date, id: 'fx', why: 'курс строки не назван'});
      } else {
        fxOff++;
        if(r.fx !== null) bad.push({ref: r.ref, date: r.date, id: 'fx', why: 'курс у объекта без валюты'});
      }
      Object.keys(r.inds).forEach(id => {
        const rec = ST.IND(id), c = r.inds[id];
        if(!rec) return;
        if(!oneNumber(c)){ bad.push({ref: r.ref, date: r.date, id, why: 'клетка — не одно число: ' + Object.keys(c).join(',')}); return; }
        const rule = ST.roundOf(id);
        if(rec.vtype === 'money_som' && !rec.somOf && rec.src !== 'агрегат'){
          seen++; som++;
          const want = coreSom172(rec, r);
          if(want === undefined || Math.abs(c.v - want) > 0.005)
            bad.push({ref: r.ref, date: r.date, id, why: 'итог разошёлся с ядром: ' + c.v + ' ≠ ' + want});
          return;
        }
        if(!rec.somOf) return;
        seen++;
        if(!rule){ bad.push({ref: r.ref, date: r.date, id, why: 'запись не назвала правила округления'}); return; }
        const O = ST.IND(rec.somOf), o = r.inds[rec.somOf];
        if(!o){ bad.push({ref: r.ref, date: r.date, id, why: 'валютной клетки нет'}); return; }
        if(O.flow){
          flow++;
          const want = coreSom172(O, r);
          if(want === undefined || Math.abs(c.v - want) > 0.005)
            bad.push({ref: r.ref, date: r.date, id, why: 'поток разошёлся с ядром: ' + c.v + ' ≠ ' + want});
          return;
        }
        bal++;
        const byHand = r.fx ? CORE.somRound(o.v * r.fx.rate, rule) : null;
        if(byHand == null || Math.abs(c.v - byHand) > 0.005)
          bad.push({ref: r.ref, date: r.date, id, why: 'число не равно произведению: ' + c.v + ' ≠ ' + byHand});
      });
    });
    return {bad, seen, som, flow, bal, fxOn, fxOff};
  };
```

условие:

```js
  /* Волна 23, З-17 (переписан на месте): сверка ушла из основания в клетке в курс строки и в
     ядро — основания `from` в клетке больше нет (ИС-56, ADR-0240 §2, §3). Остаток сверяется
     внутри строки: валютная клетка × курс строки по правилу записи. Поток и итог в сомах —
     с ядром на дату строки: их сомовое число — сумма операций по курсам их дней, и одного
     курса, которым его можно было бы перемножить в строке, у них нет. Строк, дат и клеток
     прежнее число; остатков 9338, потоков 1696, итогов 5075, расхождений — ноль. Курс лежит
     у 745 строк объектов с валютой и пуст у прочих 1451 и у 34 легаси. */
  ok(172, a172.bad.length === 0 && a172.seen === 16109 && a172.som === 5075 && a172.flow === 1696 &&
        a172.bal === 9338 && a172.fxOn === 745 && a172.fxOff === 1451 &&
        dates172.length === 59 && objs172.length === 10 &&
        own172.length === 2196 && leg172.length === 34 && legSom172 === 0 && leg172.every(r => r.fx === null),
```

`#173` — от `const clean0 = audit();` до `/* #174 …`:

```js
  /* Волна 23, З-17 (переписан на месте): основания в клетке больше нет, и два подброшенных
     дефекта — другие. Первый — КУРС СТРОКИ: он один на строку, и подмена его ломает каждый
     остаток строки разом, а называется одна строка. Второй — сомовое число ПОТОКА: курса у
     него нет, и поймать его может только сверка с ядром. */
  const clean0 = audit();
  const victims = ST.state.rows.filter(r => r.obj === 'obj-credit' && !ST.isLegacyRow(r) &&
    ST.rowCur(r, 'm-debt') !== 'KGS' && r.inds['m-debt-som'] && r.inds['m-repaid-som']);
  const vRate = victims.find(r => ST.rowCur(r, 'm-debt') === 'USD');
  const vNum = victims.find(r => r.ref !== (vRate || {}).ref);
  const keptRate = vRate ? vRate.fx.rate : null;
  const keptNum = vNum ? vNum.inds['m-repaid-som'].v : null;
  if(vRate) vRate.fx.rate = keptRate + 7;
  if(vNum) vNum.inds['m-repaid-som'].v = keptNum + 0.05;
  const a173 = audit();
  const named = Array.from(new Set(a173.bad.map(b => b.ref))).sort().join(', ');
  const wanted = [vRate, vNum].filter(Boolean).map(v => v.ref).sort().join(', ');
  if(vRate) vRate.fx.rate = keptRate;
  if(vNum) vNum.inds['m-repaid-som'].v = keptNum;
  const back = audit();
  ok(173, !!vRate && !!vNum && clean0.bad.length === 0 && named === wanted &&
        a173.bad.filter(b => b.ref === vRate.ref).every(b => has(b.why, 'не равно произведению')) &&
        a173.bad.filter(b => b.ref === vNum.ref).length === 1 &&
        a173.bad.some(b => has(b.why, 'поток разошёлся с ядром')) &&
        back.bad.length === 0 && back.seen === clean0.seen,
    `сторож умеет ПРОВАЛИТЬСЯ, и потому его «чисто» что-то значит. Подброшены два разных дефекта в две разные строки: в «${(vRate || {}).ref}» подменён КУРС СТРОКИ (${keptRate} → ${keptRate + 7}) — он один на строку, и сторож назвал её по каждому остатку (${a173.bad.filter(b => b.ref === (vRate || {}).ref).length} клеток) арифметикой; в «${(vNum || {}).ref}» подменено сомовое число ПОТОКА «погашено» на пять копеек — курса у потока нет, и поймала его только сверка с ядром. Названы ровно эти строки (${named}). Пять копеек ловятся потому, что округление ОБЪЯВЛЕНО (ADR-0214 §6). После восстановления сторож снова чист (${back.seen} клеток, ${back.bad.length} расхождений) — ловит он дефект, а не собственную обстановку (ИС-56, ADR-0240 §2, §3)`);

```

`#175` — от `const rr = ST.statRows(…)` до `/* #176 …`:

```js
  /* Волна 23, З-17 (переписан на месте): курс и дата курса лежат в строке ОДИН РАЗ, рядом со
     всеми её числами (`fx`), а не в каждой клетке; валюта — разрез строки (ИС-56, ADR-0240 §2).
     Остаток перемножается, не выходя из строки. Итог заёмщика — одна сомовая колонка без
     основания в клетке: разновалютный портфель ложится в неё одним числом, и число это —
     ответ ядра, а состав по валютам отвечают строки его кредитов (ADR-0240 §4). */
  const rr = ST.statRows({obj:'obj-credit', date: ASK}).rows;
  const usd = rr.find(r => ST.rowCur(r, 'm-debt') === 'USD');
  const o175 = usd.inds['m-debt'], s175 = usd.inds['m-debt-som'];
  const W175 = vm.runInContext('WORLD', sandbox);
  const pr = ST.statRows({obj:'obj-borrower', date: ASK}).rows.find(r => {
    const it = W175['obj-borrower'].find(x => x.id === r.ref);
    const c = it && CORE.read('calcPortfolio', it, ST.worldAt(ASK)).total;
    return c && (c.parts || []).length > 1;
  });
  const it175 = pr ? W175['obj-borrower'].find(x => x.id === pr.ref) : null;
  const core175 = it175 ? CORE.read('calcPortfolio', it175, ST.worldAt(ASK)).total : null;
  const ps = (pr || {inds:{}}).inds['m-btotal'] || {};
  ok(175, !!s175 && !!pr && usd.fx && usd.fx.rate > 1 && !!usd.fx.rateDate &&
        Object.keys(o175).join() === 'v' && Object.keys(s175).join() === 'v' &&
        Math.abs(s175.v - CORE.somRound(o175.v * usd.fx.rate, ST.roundOf('m-debt-som'))) < 0.005 &&
        Object.keys(ps).join() === 'v' && pr.fx === null && core175 && core175.parts.length > 1 &&
        Math.abs(ps.v - core175.som.value) < 0.005 && !pr.inds['m-btotal-som'] &&
        ST.somValue(usd, 'm-debt') === s175.v,
    `курс и дата курса лежат В СТРОКЕ, один раз на строку: «${usd.ref}» — ${o175.v} ${ST.rowCur(usd, 'm-debt')} × ${usd.fx.rate} от ${usd.fx.rateDate} = ${(s175 || {}).v} сом., и перемножить это можно, не выходя из строки и не открывая справочника курсов. Клетка — одно число: ни валюты, ни курса, ни состава в ней нет (ИС-16 сужен). Портфель «${(pr || {}).ref}» ложится ОДНОЙ сомовой колонкой — ${ps.v} сом., — и это ответ ядра (${core175 ? core175.parts.map(p => p.cur).join(' + ') : '—'} по курсам своих дней); курса у строки заёмщика нет (${pr ? String(pr.fx) : '—'}), валютной колонки у итога тоже (${pr && pr.inds['m-btotal-som'] ? 'ЕСТЬ близнец' : 'и близнеца нет'}) — состав по валютам отвечают строки его кредитов (ИС-56, ADR-0240 §2, §4)`);

```

`#182`:

```js
  /* #182 — Волна 23, З-17 (переписан на месте): ADR-0240 §3 ПЕРЕПИСАЛ ADR-0151 §3 и ADR-0214 §7.
     Сомовая колонка потока — сумма операций по курсам их дней, от ядра, и разность двух её
     строк — операции периода по их курсам: курсовой разницы в ней нет, и отказывать больше не
     в чем. Период по ВАЛЮТНОЙ записи потока отвечает ТЕМ ЖЕ сомовым числом: разности по
     валютам, приведённые курсом конца периода, дали бы число, которого не было. */
  st = ST.seed();
  const flowSom = ST.flowBetween({obj:'obj-credit', inds:'m-accr-som', from:'2026-07-15', to:'2026-08-19'});
  const end182 = ST.statRows({obj:'obj-credit', date:'2026-08-19'}).rows;
  const base182 = ST.statRows({obj:'obj-credit', date:'2026-07-15'}).rows;
  const s182 = r => ((r && r.inds['m-accr-som']) || {v: 0}).v;
  const byHand182 = CORE.somRound(end182.reduce((n, r) => n + s182(r) - s182(base182.find(x => x.ref === r.ref)), 0),
                                  ST.roundOf('m-accr-som'));
```
```js
  ok(182, flowSom.ok && flowSom.cur === 'KGS' && flowSom.value > 0 && flowSom.value === byHand182 &&
        flowCur.ok && flowCur.cur === 'KGS' && flowCur.value === flowSom.value &&
```

текст — начало до «Остаток за период…»:

```js
    `период по сомовой записи потока ОТВЕЧАЕТ (${flowSom.value} ${flowSom.cur}) и равен разности сомовых колонок строк конца и базы (${byHand182}): сомовая колонка потока — сумма операций по курсам их дней, и курсовой разницы в разности нет (ADR-0240 §3 переписал ADR-0151 §3 и ADR-0214 §7). Тот же период по валютной записи — то же сомовое число (${flowCur.value} ${flowCur.cur}): приводить разности курсом конца периода значило бы назвать число, которого не было.
```

`#183`:

```js
  /* Волна 23, З-17 (переписан на месте): клетка — одно число, применённого правила в ней нет
     (ИС-56). Что соседняя сомовая колонка посчитана ОБЪЯВЛЕННЫМ правилом, доказывает её число:
     валютное на курс строки, округлённое по RULE. */
  const tot183 = row1183.inds['m-total'], totS183 = row1183.inds['m-total-som'];
  const kept183 = !!tot183 && !!totS183 && !!row1183.fx &&
    totS183.v === CORE.somRound(tot183.v * row1183.fx.rate, RULE);
```

`#202`: `usd202 = (ST.rowsAt('obj-credit', TODAY).find(r => r.ref === 'КД-2025/043') || {}).fx || {};`

`#223`:

```js
  /* Волна 23, З-17 (переписан на месте): полей 10 → 11 — `fx`, курс строки (ИС-56). Завела его
     не редакция, а ряд значений, и у легаси-строки он ПУСТ: старая система курса не хранила,
     а пересчитать её остаток сегодняшним курсом значило бы выдать сегодняшнее за историческое
     (ИС-41). Валюта легаси-итога — разрез строки, как у своей. */
  ok(223, shape && Object.keys(lr).length === 11 && lr.part === null && lr.fx === null &&
        lr.dims['d-cur'] === 'KGS' && Object.keys(lr.inds).every(id => Object.keys(lr.inds[id]).join() === 'v') &&
```

`#254`:

```js
  /* Волна 23, З-17 (переписан на месте): дата курса — поле строки `fx`, а не клетки (ИС-56). */
  const rd254 = r => ((r && r.fx) || {}).rateDate;
```

`#258`:

```js
    usd258 = (ST.rowsAt('obj-credit', ASK).find(r => r.ref === 'КД-2025/043') || {}).fx || {};
```
```js
        /* Волна 23, З-17 (переписан на месте): уточнённый курс не двигает валютного числа —
           перезапись называет курс строки и сомовые стороны, а не «Остаток ОД» (ИС-56). */
        pc258.n === 1 && pc258.same === 7 &&
        pc258.rewrote.some(x => x.ref === 'КД-2025/043' && x.fields.indexOf('fx') >= 0 &&
          x.fields.indexOf('m-debt-som') >= 0 && x.fields.indexOf('m-debt') < 0) &&
```

`#259`: `eur259 = (ST.rowsAt('obj-credit', ASK).find(r => r.ref === 'КД-2025/101') || {}).fx;`

`#262`:

```js
        /* Волна 23, З-17 (переписан на месте): 379980 → 380830 — поток валютной записи отвечает
           сомовой колонкой потока, операции июня — по курсам их дней, а не разностью по валютам
           на курс конца периода (ADR-0240 §3). Доказано мутацией M5: вернуть в `flowBetween`
           приведение разностей курсом конца — и число снова 379980. */
        f2.ok && f2.value === 380830 && f2.baseDate === '2026-06-01' &&
```

`#263`: `usd263 = (ST.rowsAt('obj-credit', '2026-06-01').find(r => r.ref === 'КД-2025/043') || {}).fx || {};`

`#267` — сверка действующего ответа, признак клетки и курс действующего:

```js
  /* Сверка ДЕЙСТВУЮЩЕГО ответа — та же мерка, что у #172 для хранимых строк: сомовое число
     остатка — валютное на курс строки по объявленному правилу округления. Волна 23, З-17
     (переписан на месте): курс — поле строки, у действующего — курс последней строки с
     деньгами (ИС-56, ADR-0240 §2). */
```
```js
      const c = r.inds[id], o = r.inds[rec.somOf];
      const byHand = r.fx && o ? CORE267.somRound(o.v * r.fx.rate, ST.roundOf(id)) : null;
      if(byHand == null || Math.abs(c.v - byHand) > 0.005) bad.push(r.ref + ' ' + id);
```
```js
  /* Волна 23, З-17 (переписан на месте): состава в клетке нет — клетка одно число (ИС-56), и
     следу сторно в составе лечь некуда. Считается клетка, несущая что-то кроме числа. */
  const zeroOf267 = r => Object.keys(r.inds).filter(id => Object.keys(r.inds[id]).join() !== 'v').length;
```

`cell:` → `eff.fx ? eff.fx.rate + '/' + eff.fx.rateDate : '—'` (строка `const c = (eff.inds || {})['m-ramount'] || {};` снимается), текст «клетка ответа — курс …, нулевых частей …» → «курс действующего — ${usd267.cell}, клеток не одним числом ${usd267.zero};».

- [ ] **Step 3: Прогнать — падает**

```bash
node scripts/inspect/statistics-check.mjs > "$SCRATCH/smoke.txt" 2>&1; echo "exit=$?"
head -5 "$SCRATCH/smoke.txt"
```
Expected: смоук обрывается `TypeError: ST.rowCur is not a function` на `#27` — двери валюты строки
ещё нет.

- [ ] **Step 4: Шапка и день курса события**

Шапка, строка `ИС-16`:

```
  ИС-16 Сумма отдаётся в валюте, где возникла, с курсом и датой курса (ADR-0135 §7). СУЖЕН
        волной 23 (ИС-56, ADR-0240): валюта, курс и дата курса лежат в строке ОДИН раз, клетка
        величины — одно число, состава по валютам в клетке нет; итоги — только в сомах; у
        потока обе колонки от ядра, по курсам операций.
```

`OBJECTS`, у `obj-repay` после `evDay…evState…`:

```js
   evDay:['rdate','bdate'], evState:{'d-pcredit':'rebind', 'd-paystate':'reversal'},
   /* Курс платежа — на день ПОСТУПЛЕНИЯ (ИС-56, ADR-0240 §3, СС-187), а не на день, когда он
      стал известен: платёж, опознанный задним числом, читается днём привязки (`evDay`), но
      пересчитывается курсом дня, когда пришли деньги. У поступления и меры день события и
      день курса совпадают (рождение — `rdate`, `mdate`), и реквизит им не нужен. */
   rateDay:'rdate',
```

День курса назван только у платежа: у поступления и меры день рождения строки и есть день
денег (`rdate`, `mdate`), а у платежа, опознанного задним числом, строка рождается днём привязки
`bdate`, деньги же пришли днём поступления (`СС-187`). Сторожит клон ПГ-2026/1227 в `#280` и
мутация M2.

- [ ] **Step 5: Ядро — поток по курсам операций (`СС-189`)**

В `CORE`, вместо строки `money(…)`:

```js
  money(item, field, dateISO){ return CORE.cell(item, CORE.grow(item, field, dateISO), dateISO); },
  /* ПОТОК В СОМАХ — ПО КУРСУ ДНЯ КАЖДОЙ ОПЕРАЦИИ (ИС-56, ADR-0240 §3). Выдано, погашено,
     начислено и списано копились по курсу своего дня, и сомовая сторона потока — сумма
     операций, каждая по своему курсу, а не нарастающий итог, умноженный на курс сегодняшнего
     дня: такого числа не было. Зеркало ядра знает операции так: прирост величины за день —
     операция этого дня (у погашения это платежи, `repaidOf`); итог до якоря — по курсу
     якоря. У сомового договора сомовый поток — сама величина. */
  flowSom(item, get, dateISO){
    const cur = item.f.cur || 'KGS';
    const at = d => get(d) || 0;
    const op = (value, d) => { const r = rateOn(cur, d); return {cur, value, rate: r.rate, rateDate: r.rateDate}; };
    /* Операции собираются СОСТАВОМ и пересчитываются одним `toSom`: умножения на курс вне
       него ядро не заводит, и правило округления одно (ADR-0214 §3, §6). */
    const ops = [];
    if(cur === 'KGS' || dateISO <= ANCHOR) ops.push(op(at(dateISO), dateISO));
    else {
      let prev = at(ANCHOR);
      ops.push(op(prev, ANCHOR));
      for(let d = dayShift(ANCHOR, 1); d <= dateISO; d = dayShift(d, 1)){
        const now = at(d);
        if(now !== prev) ops.push(op(now - prev, d));
        prev = now;
      }
    }
    const s = CORE.toSom(ops, CORE.SOM_ROUNDING.id);
    return s ? s.value : null;
  },
  /* Денежный ответ ПОТОКА: договорная сторона — как у всякой суммы, сомовая — сумма операций
     по их курсам (`flowSom`), а не пересчёт итога курсом дня. */
  flowCell(item, get, dateISO){
    return Object.assign(CORE.cell(item, get(dateISO), dateISO),
      {som: {value: CORE.flowSom(item, get, dateISO), round: CORE.SOM_ROUNDING.id, flow: true}});
  },
```

`calcAccrual`:

```js
  calcAccrual(item, dateISO){ CORE.calls++;
    return {interest: CORE.flowCell(item, d => CORE.grow(item, 'interest', d), dateISO)}; },
```

`calcAllocation`:

```js
    return {issuedTotal: CORE.flowCell(item, d => CORE.grow(item, 'issuedTotal', d), dateISO),
            repaidTotal: CORE.flowCell(item, d => CORE.repaidOf(item, d), dateISO)};
```

`calcDebt`, строка `writtenOff`:

```js
      writtenOff: CORE.flowCell(item, d => CORE.debtParts(item, d).writtenOff, dateISO),
      overpaid:   CORE.cell(item, p.overpaid,   dateISO)
```

перед `calcPortfolio(item, dateISO){`:

```js
  /* Поток по множеству: число — как у всякой портфельной клетки, сомовая сторона — сумма
     сомовых потоков договоров, каждый по курсам своих операций (ADR-0240 §3, §4). */
  portfolioFlow(list, dateISO, get){
    const c = CORE.portfolioCell(list, dateISO, x => get(x, dateISO));
    c.som = {value: CORE.somRound(list.reduce((n, x) => n + CORE.flowSom(x, d => get(x, d), dateISO), 0),
                                  CORE.SOM_ROUNDING.id), round: CORE.SOM_ROUNDING.id, flow: true};
    return c;
  },
  calcPortfolio(item, dateISO){
```

в `calcPortfolio` четыре потока:

```js
      issuedTotal:CORE.portfolioFlow(all, dateISO, (c, d) => CORE.grow(c, 'issuedTotal', d)),
      repaidTotal:CORE.portfolioFlow(all, dateISO, (c, d) => CORE.repaidOf(c, d)),
      accrued:    CORE.portfolioFlow(all, dateISO, (c, d) => CORE.grow(c, 'interest', d)),
      writtenOff: CORE.portfolioFlow(all, dateISO, (c, d) => CORE.debtParts(c, d).writtenOff),
```

Умножений на курс в файле по-прежнему два и оба в `toSom`/`cell` (`#171`): `flowSom` собирает
операции составом и отдаёт их одному `toSom`.

- [ ] **Step 6: Курс строки и клетка — одно число (`СС-186`, `СС-187`, `СС-192`)**

Перед `ST.VTYPES = clone(VTYPES);`:

```js
/* КУРС СТРОКИ (ИС-56, ADR-0240 §2, СС-186). Валюта, курс и дата курса лежат в строке ОДИН
   РАЗ — у объекта, в таблице которого релиз вывел колонку `rate` (кредит, требование, платёж,
   поступление, мера). Валюта — разрез объекта с колонкой `cur`, курс и его дата — поле строки
   `fx`. У прочих объектов денег в валюте нет вовсе: их итоги — в сомах (ADR-0240 §4), и `fx`
   пуст. Курс состояния — на канун среза (ADR-0238 §2). Курс события — на день события
   (ADR-0240 §3): строка события и так читается на день, когда событие стало известно
   (СС-171), а где этот день не день денег — у платежа, опознанного задним числом, — объект
   называет день курса реквизитом `rateDay` (СС-187). */
function fxObj(objId){
  const t = ((ST.state && ST.state.release) || RELEASE).tables[objId];
  return !!t && t.cols.indexOf('rate') >= 0;
}
function curDimOf(objId){
  const o = OBJ(objId);
  return (o && o.dims.find(id => { const d = DIM(id); return !!d && d.vtype === 'cur' && d.col === 'cur'; })) || null;
}
function fxOf(o, item, dateISO){
  if(!fxObj(o.id)) return null;
  const cd = curDimOf(o.id);
  const cur = (cd && readDim(cd, item, dateISO, null)) || 'KGS';
  const r = rateOn(cur, o.rateDay && item.f[o.rateDay] ? item.f[o.rateDay] : worldAt(dateISO));
  return {rate: r.rate, rateDate: r.rateDate};
}
/* Валюта величины в строке: у сомовой записи — сом, у валютной — разрез валюты строки. */
function rowCur(r, indId){
  const I = IND(indId);
  if(I && (I.somOf || I.vtype === 'money_som')) return 'KGS';
  const cd = curDimOf(r.obj);
  return (cd && r.dims[cd]) || 'KGS';
}
ST.rowCur = rowCur; ST.curDimOf = curDimOf;
ST.VTYPES = clone(VTYPES);
```

`readInd`, комментарий над `if(m.somOf){` — основания `from` в клетке больше нет:

```js
  /* Сомовая запись — обычная колонка строки, читаемая ТЕМ ЖЕ читателем (ИС-18, ИС-44).
     Считает её ЯДРО одним своим пересчётом (ADR-0214 §3). Волна 23 З-17 (ИС-56, ADR-0240):
     основания в клетке больше нет — курс и дата курса лежат в строке один раз (`fx`), и у
     остатка сторож перемножает валютную клетку на курс строки, не выходя из строки; у потока
     и итога сомовое число — сумма операций по их курсам, и сверяется оно с ядром. Сложить
     сомовую клетку с валютной колонкой соседа нельзя, с сомовой — можно всегда. Валютная
     клетка сомовой стороны в себе НЕ несёт: величина живёт в своей колонке под своим именем,
     а не приложением к чужой (ADR-0214 §2). */
```

`readInd` — от `if(m.somOf){` до конца функции:

```js
  if(m.somOf){
    /* Сомовая сторона читает ТУ ЖЕ величину тем же читателем, значит и молчание соседа
       наследует: промолчало ядро — нет ни валютной колонки, ни сомовой. Считай сомовую
       в обход — и у неполной строки завелась бы полная половина (ИС-44, ИС-42). */
    /* Признак датировки сомовой стороны НАСЛЕДУЕТСЯ у валютной: величина та же, пересчёт
       курсом её ко времени иначе не привязывает. Пометка валютной записи при этом не
       остаётся на ней «за компанию»: если сама она в объекте не объявлена, её след
       снимается — иначе строка несла бы происхождение величины, которой в ней нет. */
    const O = IND(m.somOf);
    const had = ask && ask.when ? ask.when[m.somOf] : undefined;
    const src = O ? readIndRaw(O, m.somOf, item, dateISO, ask) : null;
    const inner = ask && ask.when ? ask.when[m.somOf] : undefined;
    if(ask && ask.when){ if(had === undefined) delete ask.when[m.somOf]; else ask.when[m.somOf] = had; }
    if(!src || src.v == null) return null;
    markDating(ask, indId, inner || DATING.NOW);
    /* ПОТОК — обе колонки от ядра (ADR-0240 §3): сомовая сторона потока — сумма операций по
       их курсам, и курс строки к ней не применяется. ОСТАТОК — валютная колонка на курс строки
       по правилу округления записи (ADR-0214 §5, §6): курс в строке один (ADR-0240 §2). */
    if(O.flow) return src.som == null ? null : {v: src.som};
    const fx = ask && ask.fx ? ask.fx : fxOf(OBJ(m.obj), item, dateISO);
    const s = fx ? CORE.toSom([{value: src.v, rate: fx.rate, rateDate: fx.rateDate}], roundOf(m)) : null;
    return s ? {v: s.value} : null;
  }
  /* ИТОГ В СОМАХ (`money_som`) — одна колонка `_som`, без валютной пары и без состава
     (ADR-0240 §4, ИС-56): сомовое число шва, как его отдало ядро. У потока-итога оно — сумма
     сомовых потоков договоров по курсам их операций (`portfolioFlow`). */
  if(m.vtype === 'money_som'){
    const raw = readIndRaw(m, indId, item, dateISO, ask);
    if(!raw) return null;
    const v = raw.som != null ? raw.som : raw.v;
    return v == null ? null : {v};
  }
  const raw = readIndRaw(m, indId, item, dateISO, ask);
  /* Клетка валютной величины — одно число: валюта — разрез строки, курс — поле строки
     (ADR-0240 §2). Сомовое число шва в клетку не ложится — его несёт своя колонка. */
  return raw && m.money ? (raw.v == null ? null : {v: raw.v}) : raw;
}
```

`readIndRaw`, ветка поля:

```js
    if(!m.money) return {v};
    return {v, som: null, curs: [item.f.cur || 'KGS']};
```

ветка шва:

```js
    if(!m.money) return cell.value == null ? null : {v: cell.value};
    /* Сомовое число и валюты состава — ответ ЯДРА, в строку не ложатся: сомовое берёт своя
       колонка, валюты — разведка критической даты (`fxCursOf`). */
    return {v: cell.value, som: cell.som ? cell.som.value : null,
            curs: cell.parts && cell.parts.length ? cell.parts.map(p => p.cur) : [cell.cur]};
```

`buildRow`:

```js
  const ask = {silent: silent || null, srcs: {}, when: {}, fx: fxOf(o, item, dateISO)};
  o.dims.forEach(id => { const v = readDim(id, item, dateISO, ask); if(v != null) dims[id] = v; });
  o.inds.forEach(id => { const c = readInd(id, item, dateISO, ask); if(c) inds[id] = c; });
  return {obj: objId, ref: item.id, date: dateISO, part: null, dims, inds, fx: ask.fx, when: ask.when,
          srcs: ask.srcs, fixed: null, by: 'прогон'};
```

`ROW_SHAPE` и `ROW_VALUES`:

```js
/* ВОЛНА 23 З-17 ЗАВЕЛА ОДИННАДЦАТОЕ ПОЛЕ — `fx`, курс строки: {курс, дата курса} один раз
   на строку у объекта с валютой, `null` у прочих и у легаси (ИС-56, ADR-0240 §2, СС-186).
   Это ЗНАЧЕНИЕ — ответ ядра о курсе на дату, — и оно в ряду значений; но не запись реестра:
   колонки `rate` и `rate_date` в схеме служебные, как `cur` у валюты. Валюта строки — разрез
   с колонкой `cur`: второго места для неё нет. Клетки величин с этой волны несут ОДНО число —
   ни валюты, ни курса, ни состава по валютам (ИС-16 сужен). */
ST.ROW_SHAPE = ['obj','ref','date','part','dims','inds','fx','when','srcs','fixed','by'];
```
```js
ST.ROW_VALUES = ['dims','inds','fx'];
```

- [ ] **Step 7: Сравнение, критическая дата, дельта (`СС-190`, `СС-191`, `СС-192`)**

`rowDiff`:

```js
function rowDiff(was, now){
  const out = [];
  ['dims','inds'].forEach(k => {
    Object.keys(was[k]).concat(Object.keys(now[k])).forEach(id => {
      if(out.indexOf(id) >= 0) return;
      if(JSON.stringify(was[k][id]) !== JSON.stringify(now[k][id])) out.push(id);
    });
  });
  /* Курс строки — ЗНАЧЕНИЕ (ИС-56, ADR-0240 §2): уточнённый курс переписывает строку и там,
     где ни одно число не сдвинулось (нулевой остаток валютного договора), — иначе строка
     несла бы курс, которого на её дату уже нет. В журнале он назван полем строки `fx`
     (колонки `rate` и `rate_date` схемы): записи реестра у курса нет. */
  if(JSON.stringify(was.fx || null) !== JSON.stringify(now.fx || null)) out.push('fx');
  return out;
}
```

`bareOf` с комментарием над ним — значение без обстановки есть само значение:

```js
/* Значение БЕЗ ОБСТАНОВКИ. С волны 23 З-17 обстановки в значении нет: курс и дата курса
   лежат в строке (`fx`), клетка — одно число (ИС-56, СС-186). Сравнивай с курсом — и в ночь
   его смены сосед назвал бы всех своих валютных, а второе множество (критическая дата)
   вывелось бы из первого, чего ADR-0221 §1 прямо не допускает: курс — факт ВРЕМЕНИ, а не
   факт соседа. Сомовые стороны в пробу не входят (`scanPlan`), и курса проба не видит. */
function bareOf(v){ return v == null ? null : v; }
```

`fxCursOf` целиком:

```js
function fxCursOf(money, item, dateISO){
  const out = [];
  money.forEach(id => {
    const m = IND(id);
    const c = m ? readIndRaw(m, id, item, dateISO, null) : null;
    if(!c) return;
    (c.curs || []).forEach(x => { if(x && x !== 'KGS' && out.indexOf(x) < 0) out.push(x); });
  });
  return out;
}
```

и в комментарии над ним конец абзаца:

```js
   близнеца нет, и клетка сама в сомах. Валюты состава в строке не лежат (ИС-56, З-17): их
   называет ответ ядра (`curs` у `readIndRaw`), и спрашивается он тем же вызовом, что прежде
   читал клетку, — число вызовов ядра прежнее. Без них заёмщик, чей долг долларовый, из
   множества 2 выпал бы: курс уточнён, сомовый итог на дату стал другим, а ночь бы его не
   тронула. */
```

Дельта: от `/* Клетка умножается и складывается ЦЕЛИКОМ…` до `/* Разница ДЕЙСТВУЮЩИХ состояний…` —
`scaleCell`, `partKey`, `ownParts`, `mergeParts`, `addCell`, `normCell`, `cellSig` заменяются на:

```js
/* Клетка — одно число (ИС-56, З-17): умножается и складывается число. Курс лежит в строке, и
   у каждой строки события он свой — курс дня события, каким его знала ночь строки; сомовая
   сторона каждой строки посчитана её курсом, и сумма сомовых сторон строк — сомовая сторона
   действующего (ADR-0239 §4, ADR-0240 §2). */
function scaleCell(c, k){
  const out = clone(c);
  if(typeof out.v === 'number') out.v = cents(out.v * k);
  return out;
}
function addCell(a, b){
  if(!a) return clone(b);
  const out = clone(a);
  if(typeof b.v === 'number') out.v = cents((out.v || 0) + b.v);
  return out;
}
/* Подпись клетки — её суть: число и прочие поля как есть. */
function cellSig(c){
  if(c == null) return '-';
  const rest = Object.keys(c).filter(k => k !== 'v').sort().map(k => k+':'+JSON.stringify(c[k])).join(',');
  return [c.v, rest].join('#');
}
```

`deltaAt`, сборка действующего:

```js
  const out = Object.assign(clone(rows[rows.length - 1]), {inds: {}});
  rows.forEach(r => Object.keys(r.inds).forEach(id => {
    if(!out.inds[id]) out.inds[id] = scaleCell(r.inds[id], 0); }));
  rows.filter(r => !voided(o, r)).forEach(r => Object.keys(r.inds).forEach(id => {
    out.inds[id] = addCell(out.inds[id], r.inds[id]); }));
  /* Курс действующего — курс последней строки, несущей деньги: ею посчитана его валютная
     сторона после поправки (после уточнения курса задним числом — новым курсом), и сомовая
     сторона действующего равна валютной на этот курс (ADR-0240 §2, ADR-0214 §5). */
  const money = rows.filter(r => !voided(o, r) && Object.keys(r.inds).some(id => r.inds[id].v));
  if(money.length) out.fx = clone(money[money.length - 1].fx);
  return out;
```

- [ ] **Step 8: Читатели — валюта строки (`СС-188`)**

`ST.eventFlow`, цикл по строкам:

```js
    const c = r.inds[indId];
    if(!c) continue;
    const k = byDim ? String(r.dims[byDim]) : 'всего';
    const rc = rowCur(r, indId);
    if(cur[k] && cur[k] !== rc) return {ok:false, why:'поток «'+I.name+'» по группе «'+k+
      '» не складывается: в ней строки в '+cur[k]+' и в '+rc+', а сумма разных валют числом не бывает. '+
      'Режьте поток разрезом валюты или берите сомовую сторону — поле `som` (ADR-0214 §1)'};
    cur[k] = cur[k] || rc;
```

`matchFilter`, денежная константа:

```js
  const v = cell.v;
  if(o.money && src.cur && src.cur(o.id) !== (c.cur || 'KGS')) return false;
  return matchNum(c, v == null ? null : Number(v));
```

комментарий над ней:

```js
  /* Денежная константа несёт ВАЛЮТУ и сравнивается с величиной той же валюты — валюты
     строки (ИС-56). Пересчёта в фильтре нет: он потребовал бы курса, а курс отбора — не курс
     показа. */
```

`rowSrc`:

```js
const rowSrc = r => ({dim: id => r.dims[id], ind: id => r.inds[id], cur: id => rowCur(r, id)});
```

`registryList`, фильтр:

```js
    const cd = curDimOf(objId);
    return matchFilter(filter, {dim: id => readDim(id, item, dateISO),
                                ind: id => readInd(id, item, dateISO),
                                cur: id => rowCur({obj: objId, dims: cd ? {[cd]: readDim(cd, item, dateISO)} : {}}, id)});
```

`partsOf` с комментарием над ним и `ST.partsOf` — снять целиком.

`aggValue`, денежная часть:

```js
  /* Деньги агрегируются ПО СТРОКАМ: валюта величины — валюта строки, курс — курс строки
     (ИС-56, ADR-0240 §2). Состава по валютам в клетке нет: у итогов он не нужен — они в
     сомах (ADR-0240 §4). */
  const parts = rows.filter(r => r.inds[I.over] && r.inds[I.over].v != null)
    .map(r => ({cur: rowCur(r, I.over), v: r.inds[I.over].v, rateDate: r.fx ? r.fx.rateDate : null}));
  if(!parts.length && EMPTY_IS_NOT_ZERO.indexOf(I.fn) >= 0) return null;
  const curs = uniq(parts.map(p => p.cur));
  const rd = parts.map(p => p.rateDate).filter(Boolean).sort().slice(-1)[0] || null;
```

`ST.flowBetween`: комментарий «ПЕРИОД ПО СОМОВОЙ ЗАПИСИ НЕ СЧИТАЕТСЯ…» и отказ под ним
заменяются на:

```js
  /* ПОТОК В СОМАХ — РАЗНОСТЬ СОМОВЫХ КОЛОНОК ПОТОКА (ИС-56, ADR-0240 §3, СС-188). Сомовая
     колонка потока — сумма операций по курсам их дней, от ядра; разность двух её строк —
     операции периода по их курсам, и курсовой разницы в ней нет. Прежний отказ «период по
     сомовой записи не считается» (ADR-0151 §3, ADR-0214 §7) стоял на сомовой колонке,
     посчитанной курсом дня среза, — такой у потока больше нет. Поток по ВАЛЮТНОЙ записи
     отвечает тем же сомовым числом: разности по валютам, приведённые курсом конца периода,
     дали бы число, которого не было (ADR-0240 §3, «Отвергнуто»). */
  const somId = I.somOf || I.vtype === 'money_som' ? q.inds : (I.money ? ST.somIdOf(q.inds) : null);
```

цикл суммы (`flowParts` и приведение по валютам снимаются):

```js
  let sum = 0; const born = [];
  endRows.forEach(r => {
    const end = r.inds[somId || q.inds]; if(!end || end.v == null) return;
    const bs = baseRows.find(x => x.ref === r.ref);
    if(!bs) born.push(r.ref);
    const was = bs && bs.inds[somId || q.inds];
    sum += end.v - (was && was.v != null ? was.v : 0);
  });
```

`loadLegacy`: `inds[id] = {v: vals[i]};` и `writeRow(st, {…, dims, inds, fx: null, when, srcs, …})`
— валюта легаси-итога уже лежит разрезом `d-cur` формы.

Экран, `indCellText`:

```js
  if(I.money){
    const cur = row ? rowCur(row, I.id) : 'KGS';
    const som = row ? ST.somValue(row, I.id) : null;
    return esc(money(c.v, cur))+
      (som != null && cur !== 'KGS' ? ' <span class="muted">= '+esc(money(som, 'KGS'))+'</span>' : '');
  }
```

строка курса под таблицей:

```js
  const rate = res.rows.map(r => r.fx).filter(Boolean)[0];
```

- [ ] **Step 9: Прогнать — зелёный**

```bash
node scripts/inspect/statistics-check.mjs > "$SCRATCH/smoke.txt" 2>&1; echo "exit=$?"
grep -E "^\s+FAIL" "$SCRATCH/smoke.txt"
```
Expected: `exit=0`, `SMOKE … · 266/266 PASS`, строк `FAIL` нет. Строк мира 2230 (из них своих 2196), клеток сомовых 16109:
остатков 9338, потоков 1696, итогов 5075; курс у 745 строк, пусто у 1451 и у 34 легаси (`#172`).

Таблица переписки (по факту прототипа, `$SP/plan3t5/`):

| сторож | упал на | переписан |
|---|---|---|
| `#3` | полей 11, `fx` в ряду значений | форма: 11 полей, `vals = dims,inds,fx`, `fx` — `rate,rateDate` |
| `#27`, `#29` | `cell.cur`/`cell.rate` | курс из `usd.fx`, валюта `ST.rowCur`, клетка `{v}` |
| `#70` | состав из `from` | состав — ответ ядра `calcPortfolio.total.parts`; тождество в сомах ±0,02 |
| `#71` | `from` в клетке | части и курсы — из ответа ядра; клетка `{v}`, `mix.fx === null` |
| `#170` | `cell170.cur` | клетка `{v}`, валюта сомовой записи `KGS` |
| `#171` | — | не переписан: умножений на курс по-прежнему 2 |
| `#172` | `ST.partsOf` (исключение) | остаток — `v × fx.rate` в строке; поток и итог — с ядром на дату строки |
| `#173` | основание `from` | дефекты — курс строки и сомовое число потока |
| `#175` | курс в клетке | курс в строке; портфель — ответ ядра |
| `#182` | отказ по сомовой записи | ответ; валютная = сомовой = разности сомовых колонок |
| `#183` | `cell.round` | соседняя сомовая = валютное × курс строки по RULE |
| `#202`, `#254`, `#259`, `#263` | курс в клетке | курс из `r.fx` |
| `#223` | полей 10 | 11 полей, `fx === null`, валюта — `d-cur` |
| `#258` | `fields` без `m-debt` | перезапись называет `fx` и сомовые стороны, не `m-debt` |
| `#262` | 379980 | **значение** 380830 — довод и мутация M5 |
| `#267` | `ST.partsOf` (исключение) | действующий — на курс строки; `cell` — курс `eff.fx` |

- [ ] **Step 10: Мутации**

Копия дерева в scratchpad, одна копия на мутацию; проверено на прототипе `$SCRATCH/plan3t5`,
смоук шага 9:

| № | мутация | падает |
|---|---|---|
| 1 | `calcAllocation`: `repaidTotal: CORE.cell(item, CORE.repaidOf(item, dateISO), dateISO)` — поток на курс строки | `#262`, `#281` |
| 2 | `fxOf`: `rateOn(cur, worldAt(dateISO))` — `rateDay` не читается | `#280` |
| 3 | `readInd`: клетка денег `{v: raw.v, cur: item.f.cur \|\| 'KGS'}` — валюта вернулась в клетку | `#27`, `#79`, `#172`, `#173`, `#175`, `#267`, `#280` |
| 4 | `readInd`: снять строку `if(O.flow) return src.som == null ? null : {v: src.som};` — поток на курс строки | `#172`, `#173`, `#262`, `#281` |
| 5 | `ST.flowBetween`: разность по валюте × курс строки конца вместо разности сомовых колонок | `#182`, `#262`, `#281` |
| 6 | `rowDiff`: снять строку сравнения `fx` | `#258` |
| 7 | `deltaAt`: `out.fx = clone(money[0].fx)` — курс первой строки с деньгами | `#267` |
| 8 | `calcPortfolio`: `repaidTotal:cell(c => CORE.repaidOf(c, dateISO))` — поток портфеля на курс кануна | `#281` |
| 9 | `fxObj`: `return !!t;` — курс у всех объектов с таблицей | `#71`, `#172`, `#173`, `#175`, `#280` |
| 10 | `loadLegacy`: `fx: {rate: 1, rateDate: d}` — курс у легаси | `#172`, `#223`, `#280` |

Без мутаций — 266/266. Каждая мутация роняет ровно названные сторожа.

- [ ] **Step 11: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-17 — деньги: курс один раз на строку, клетка — одно число, поток по курсам операций"
```

### Task 6a: З-18a — закрытый словарь: список значений в релизе, CHECK у двери записи (`ИС-57`, `ADR-0241` §2)

Спецификация §4 З-18, первая треть (`СС-185`). Решения — `СС-193`…`СС-195`. Сюда же — находка
`d_mstate` и `d_pay_state` (остановка 2): словари состояний меры и платежа берутся по схеме.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - тело скрипта (после `<script>`) — слова мира `'подтверждён'`/`'сторнирован'`/`'зарегистрирована'`;
  - записи реестра `d-mstate`, `d-paystate` — `note`;
  - после `RELEASE` (~4020) — `RELEASE_CHECKS` и раздача списков по таблицам;
  - `ST.migrate` (~4429) — реквизит `check`, итог `widened`;
  - перед `writeRow` — `checkRow`; `writeRow` отбивает значение вне списка.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#269`, `#273`; блок З-18a
  (`#282`, `#283`) перед отчётом.

**Interfaces:**
- Consumes: `RELEASE.tables`, `st.release`, `ST.migrate`, `writeRow`, `st.relLog`, `DIM`.
- Produces:
  - `RELEASE.tables[obj].checks` — `{колонка: [значения]}` у каждой колонки вида `code` и у
    `d_corr_kind` событий (`СС-193`); 19 списков;
  - `ST.migrate({obj, check: {col: [...]}})` — расширяет список, итог `widened`, запись `relLog`;
    удалять значение не умеет;
  - `checkRow(st, row)` → `{col, value}` | `null`; `writeRow` отбивает, отказ — в `relLog` с
    `who:'CHECK'` (`СС-195`);
  - словари схемы: состояние платежа `pending · confirmed · reversed`, состояние меры
    `действует · сторнирована` (`СС-194`).

- [ ] **Step 1: Падающие сторожа `#282`, `#283`**

Шапка смоука, строки блока З-17:

```js
// операций; курс события — на день события; итоги заёмщика, залога, договора, дела — в сомах.
```
→
```js
// операций; курс события — на день события; итоги заёмщика, залога, договора, дела — в сомах.
// блок волны 23 З-18a — закрытый словарь (ИС-57, ADR-0241 §2): список значений лежит у таблицы
// в релизе, значение вне списка не пишется и называется в журнале сверки, новое значение —
// миграцией; состояния платежа и меры — коды схемы.
```

Перед `/* ---- отчёт ---- */`:

```js
/* ===== Волна 23 · З-18a — закрытый словарь: список значений в релизе (ИС-57, ADR-0241 §2).
   Колонка вида `code` — `text` + CHECK: значения задаёт модель, список лежит у таблицы в
   релизе, значение вне списка не пишется, новое значение приходит релизом. ===== */
(() => {
  const W = vm.runInContext('WORLD', sandbox);

  /* #282 — у каждой колонки закрытого словаря есть список, и списков без колонки нет. Колонки
     словаря таблицы — колонки записей вида `code` её объекта и вид поправки события там, где
     он есть в ключе. Каждое значение каждой хранимой строки — в списке своей колонки: и у
     строк прогона, и у легаси, и у поправок событий. Два словаря, которые выводит сама
     статистика, приведены к схеме: состояние платежа — коды `pending · confirmed · reversed`
     (схема §9.2), состояние меры — `действует · сторнирована` (схема §11.2); прежних слов
     («подтверждён», «зарегистрирована») нет ни в мире, ни в строках (СС-194). */
  ST.seed();
  const rel282 = ST.release();
  const codeCols = o => {
    const t = rel282.tables[o];
    const own = ST.OBJ(o).dims.map(ST.DIM).filter(d => d && d.vtype === 'code' && d.col).map(d => d.col);
    return own.concat(t.cols.indexOf('d_corr_kind') >= 0 ? ['d_corr_kind'] : [])
      .filter((c, i, a) => a.indexOf(c) === i).sort();
  };
  const shape282 = Object.keys(rel282.tables).filter(o =>
    codeCols(o).join() !== Object.keys(rel282.tables[o].checks || {}).sort().join() ||
    Object.keys(rel282.tables[o].checks).some(c => !rel282.tables[o].checks[c].length));
  const bad282 = [];
  ST.state.rows.forEach(r => {
    const ck = rel282.tables[r.obj].checks;
    if(r.part != null && ck.d_corr_kind && ck.d_corr_kind.indexOf(r.part) < 0) bad282.push(r.ref + ' ' + r.part);
    Object.keys(r.dims).forEach(id => {
      const d = ST.DIM(id);
      if(d && d.vtype === 'code' && ck[d.col] && ck[d.col].indexOf(r.dims[id]) < 0) bad282.push(r.ref + ' ' + d.col + '=' + r.dims[id]);
    });
  });
  /* Вид поправки события назначает сама статистика из объявленного `corr` объекта: он обязан
     лежать в списке `d_corr_kind` своей таблицы целиком. */
  const corr282 = Object.keys(rel282.tables).filter(o => (ST.OBJ(o) || {}).corr)
    .filter(o => ST.OBJ(o).corr.some(k => ((rel282.tables[o].checks || {}).d_corr_kind || []).indexOf(k) < 0 &&
                                           rel282.tables[o].cols.indexOf('d_corr_kind') >= 0));
  const nCk282 = Object.keys(rel282.tables).reduce((n, o) => n + Object.keys(rel282.tables[o].checks).length, 0);
  const pay282 = rel282.tables['obj-repay'].checks.d_pay_state.join();
  const msr282 = rel282.tables['obj-measure'].checks.d_mstate.join();
  const old282 = W['obj-repay'].filter(p => [p.f.pstate].concat((p.h.pstate || []).map(x => x[1]))
      .some(v => v != null && ['pending', 'confirmed', 'reversed'].indexOf(v) < 0)).length +
    W['obj-measure'].filter(m => (m.h.mstate || []).some(x => ['действует', 'сторнирована'].indexOf(x[1]) < 0)).length;
  const legacy282 = ST.state.rows.filter(r => ST.isLegacyRow(r)).length;
  ok(282, shape282.length === 0 && nCk282 === 19 && bad282.length === 0 && legacy282 > 0 && corr282.length === 0 &&
        pay282 === 'pending,confirmed,reversed' && msr282 === 'действует,сторнирована' && old282 === 0,
    `закрытый словарь — список значений в релизе: у ${nCk282} колонок вида «code» и вида поправки события списки лежат у таблиц, таблиц со списком не на месте ${shape282.length} (${shape282.join(', ') || '—'}); значений вне списка в ${ST.state.rows.length} хранимых строках, из них ${legacy282} легаси, — ${bad282.length}${bad282.length ? ' (' + bad282.slice(0, 3).join('; ') + ')' : ''}; объявленный вид поправки вне списка своей таблицы — у ${corr282.length} объектов. Словари, которые выводит сама статистика, — по схеме: состояние платежа ${pay282}, состояние меры ${msr282}; записей мира с прежними словами ${old282} (ИС-57, ADR-0241 §2, СС-193, СС-194)`);

  /* #283 — значение вне списка отбивается, новое значение приходит релизом. Кредит получает
     статус, которого в словаре нет: ночь строку не пишет — ни с этим словом, ни пустой (пустое
     значило бы «сосед молчал», а он ответил), — и отказ ложится в журнал сверки релиза с
     именем колонки и значения. Прочие строки ночи пишутся. Миграция, расширившая CHECK,
     впускает значение: та же работа следующей ночью строку пишет. Миграция не ставит список на
     чужую колонку и не принимает список не списком. Значение классификатора так не стережётся
     — у него списка нет (З-18b). */
  ST.seed();
  const c283 = W['obj-credit'].find(x => x.id === 'КД-2024/117');
  const keep283 = JSON.stringify(c283.h.status);
  let miss283 = null, log283 = '', rest283 = 0, all283 = 0, mig283 = {}, back283 = null, wrong283 = {}, flat283 = {};
  try {
    c283.h.status = c283.h.status.concat([['2026-08-21', 'приостановлен']]);
    ST.enqueue('obj-credit', 'КД-2024/117', 'распоряжение', 'приостановлен договор');
    ST.run(TODAY);
    const today283 = ST.rowsAt('obj-credit', TODAY);
    miss283 = today283.find(r => r.ref === 'КД-2024/117') || null;
    rest283 = today283.length;
    all283 = ST.rowsAt('obj-credit', ASK).length;
    log283 = (ST.relLog().filter(e => e.who === 'CHECK').slice(-1)[0] || {}).msg || '';
    wrong283 = ST.migrate({obj:'obj-credit', check:{d_nope:['x']}});
    flat283 = ST.migrate({obj:'obj-credit', check:{d_status:'приостановлен'}});
    mig283 = ST.migrate({obj:'obj-credit', check:{d_status:['приостановлен']}, note:'статус «приостановлен» у «Кредитов»'});
    ST.enqueue('obj-credit', 'КД-2024/117', 'распоряжение', 'приостановлен договор');
    ST.run(TODAY);
    back283 = ST.rowsAt('obj-credit', TODAY).find(r => r.ref === 'КД-2024/117') || null;
  } finally { c283.h.status = JSON.parse(keep283); }
  ST.seed();
  ok(283, miss283 === null && rest283 === all283 - 1 &&
        /stat_row_credit\.d_status = «приостановлен»/.test(log283) &&
        wrong283.ok === false && flat283.ok === false &&
        mig283.ok === true && (mig283.widened || []).join() === 'd_status + «приостановлен»' &&
        !!back283 && back283.dims['d-status'] === 'приостановлен',
    `значение вне словаря отбивается: КД-2024/117 со статусом «приостановлен» ночью ${TODAY} строки не получил (${miss283 ? 'строка есть' : 'строки нет'}), прочие легли — ${rest283} из ${all283}; журнал сверки релиза: «${log283.slice(0, 120)}…». Миграция, поставившая список на чужую колонку, — ${wrong283.ok ? 'принята' : 'отказ'}, список не списком — ${flat283.ok ? 'принят' : 'отказ'}; миграция CHECK ${(mig283.widened || []).join(', ') || '—'} — и та же работа строку пишет: «${back283 ? back283.dims['d-status'] : '—'}» (ИС-57, ADR-0241 §2, СС-195)`);
})();
```

- [ ] **Step 2: Переписать сторожей со словами мира**

`#269` (блок З-16b) — два места:

```js
        cl269.ask === 'зарегистрирована, представитель' && cl269.now === 'сторнирована' &&
```
→
```js
        cl269.ask === 'действует, представитель' && cl269.now === 'сторнирована' &&
```
и
```js
        all269(uns269.at, 'зарегистрирована/зарегистрирована'),
```
→
```js
        all269(uns269.at, 'действует/действует'),
```

`#273` (блок З-16c):

```js
  ok(273, s273.ok && s273.rows === '08-13:original:сторнирован' && s273.mk === 0 &&
```
→
```js
  ok(273, s273.ok && s273.rows === '08-13:original:reversed' && s273.mk === 0 &&
```

Числа прежние — сменились только слова (`СС-194`).

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `FAIL #269`, `#273`, `#282`, `#283` — списков нет, слова старые.

- [ ] **Step 4: Слова мира — коды схемы (`СС-194`)**

Только в теле скрипта (шапку пишет смоук): `'подтверждён'` → `'confirmed'`, `'сторнирован'` →
`'reversed'`, `'зарегистрирована'` → `'действует'` — все вхождения после `<script>`. Записи
реестра:

```js
   owner:'Взыскание', note:'ТЗ 13 §9.3 — зарегистрирована · сторнирована'},
```
→
```js
   owner:'Взыскание', note:'схема §11.2 — действует · сторнирована: признак сторно по цели (ТЗ 13 §9.3; ИС-57, СС-194)'},
```
и
```js
   owner:'Погашения', note:'схема §9.2 — подтверждён · сторнирован; сторнированная исходная строка в «погашено» не входит (ИС-55, ADR-0239 §3)'},
```
→
```js
   owner:'Погашения', note:'схема §9.2 — pending ожидает · confirmed подтверждён · reversed сторнирован (ИС-57, СС-194); сторнированная исходная строка в «погашено» не входит (ИС-55, ADR-0239 §3)'},
```

- [ ] **Step 5: Списки у таблиц (`СС-193`)**

Конец `RELEASE` (строка меры и закрывающие скобки):

```js
     code:['d_mstate'], id:['d_credit'], bool:['d_primary'], money_cur:['i_claim']})}
}};
```
→
```js
     code:['d_mstate'], id:['d_credit'], bool:['d_primary'], money_cur:['i_claim']})}
}};
/* ЗАКРЫТЫЙ СЛОВАРЬ — СПИСОК ЗНАЧЕНИЙ В РЕЛИЗЕ (ИС-57, ADR-0241 §2, СС-193). Колонка вида `code`
   — `text` + CHECK: значения задаёт модель, и новое значение приходит релизом вместе с правкой
   модели, а не записью реестра. Список лежит у ТАБЛИЦЫ, рядом с колонками, — как CHECK лежит у
   таблицы в changeset'е. Вид поправки события (`d_corr_kind`) — тоже закрытый словарь, свой у
   платежа и у поступления (схема §9.2, §10.2).
   Значение в списке — то, что отдаёт владелец (схема §0.3). Владельцы в макете — заглушки, и
   у половины колонок их слова не те, что у настоящих владельцев в схеме: список релиза макета
   держит слова заглушек, расхождение названо находкой СС-Д26, а не спрятано. Два словаря
   выводит сама статистика — состояние платежа из признака сторно и состояние меры из сторно по
   цели, — и они приведены к схеме: `pending · confirmed · reversed`, `действует · сторнирована`
   (СС-194). */
const RELEASE_CHECKS = {
  'obj-credit':     {d_status:['действующий','погашен'],
                     d_cov_state:['обеспечен','ниже порога','доля ликвида ниже 80 %','без обеспечения']},
  'obj-borrower':   {d_ptype:['юридическое лицо','индивидуальный предприниматель','физическое лицо'],
                     d_sstate:['действует','смерть','ликвидирован','долг переведён'],
                     d_pstate:['действующий','весь портфель погашен','без договоров'],
                     d_pcur:['KGS','USD','EUR','разновалютный']},
  'obj-collateral': {d_zstate:['свободен','резервируется','в залоге','реализуется','выбыл','освобождён'],
                     d_ban:['не требуется','не наложен','просрочен','наложен','подлежит снятию'],
                     d_ctl:['в срок','срок подошёл','просрочен','обследований не было','отнесений нет',
                            'по договору со спецадминистратором']},
  'obj-claim':      {d_role:['заёмщик','поручитель','залогодатель'],
                     d_scope_vol:['просроченная сумма','вся задолженность'],
                     d_phase:['досудебная','судебная','исполнительное производство']},
  'obj-program':    {d_pstate:['действует','закрыта для выдачи','закрыта']},
  'obj-repay':      {d_pay_state:['pending','confirmed','reversed'],
                     d_corr_kind:['original','reversal','rebind']},
  'obj-receipt':    {d_chan:['платёжный шлюз','банк','казначейство','ручной ввод'],
                     d_match:['ожидает','подтверждено','отозвано','восстановлено','расхождение'],
                     d_corr_kind:['original','bind','refund','match','freeze','amount']},
  'obj-measure':    {d_mstate:['действует','сторнирована']}
};
Object.keys(RELEASE.tables).forEach(o => { RELEASE.tables[o].checks = clone(RELEASE_CHECKS[o] || {}); });
```

- [ ] **Step 6: Миграция расширяет словарь**

В `ST.migrate`:

```js
  const cols = spec.cols || [];
  if(!cols.length || cols.some(c => !/^[a-z][a-z0-9_]*$/.test(String(c))))
```
→
```js
  const cols = spec.cols || [], check = spec.check || null;
  /* Новое значение закрытого словаря — тоже выкладка (ИС-57, ADR-0241 §2): CHECK меняет
     changeset, и дверь у него та же, что у колонки. Удалить значение не умеет ни одна дверь —
     оно лежит в прошлых строках. */
  if(check && Object.keys(check).some(c => t.cols.indexOf(c) < 0 || !Array.isArray(check[c])))
    return {ok:false, why:'список значений ставится на колонку своей таблицы — в '+t.table+' её нет (ИС-57, ADR-0241 §2)'};
  if((!cols.length && !check) || cols.some(c => !/^[a-z][a-z0-9_]*$/.test(String(c))))
```

```js
  if(added.length) st.relLog.push({at: st.today, who:'релиз', msg:'миграция: '+t.table+' + '+
    added.join(', ')+(spec.note ? ' — '+spec.note : '')+' (changeset Liquibase, ADR-0237 §2, §6)'});
```
→
```js
  if(added.length) st.relLog.push({at: st.today, who:'релиз', msg:'миграция: '+t.table+' + '+
    added.join(', ')+(spec.note ? ' — '+spec.note : '')+' (changeset Liquibase, ADR-0237 §2, §6)'});
  const widened = [];
  Object.keys(check || {}).forEach(c => {
    const list = t.checks[c] || (t.checks[c] = []);
    check[c].forEach(v => { if(list.indexOf(v) < 0){ list.push(v); widened.push(c+' + «'+v+'»'); } });
  });
  if(widened.length) st.relLog.push({at: st.today, who:'релиз', msg:'миграция: '+t.table+' CHECK '+
    widened.join(', ')+(spec.note ? ' — '+spec.note : '')+' (новое значение закрытого словаря — релиз, ADR-0241 §2)'});
```

```js
  reOrphan(st);
  return {ok:true, obj, table: t.table, added, included};
```
→
```js
  reOrphan(st);
  return {ok:true, obj, table: t.table, added, included, widened};
```

- [ ] **Step 7: Дверь записи (`СС-195`)**

```js
function writeRow(st, row, opts){
  const g = rowGate(st, row, opts);
  if(g.why) return {ok:false, why: g.why};
```
→
```js
/* ЗАКРЫТЫЙ СЛОВАРЬ СТЕРЕЖЁТ ЗАПИСЬ (ИС-57, ADR-0241 §2, СС-195). CHECK — свойство таблицы, и
   нарушить его не может ни один писатель: прогон, доспрос, поправка события, выпуск легаси
   идут одной дверью. Значение вне списка не пишется — ни «как есть», ни пустым: пустое значило
   бы «сосед молчал» (ADR-0208 §1), а сосед ответил. Отказ ложится в журнал сверки релиза:
   лечится он релизом, а не ночью. Сверяются разрезы: вид поправки события назначает сама
   статистика из объявленного `corr` объекта, и что объявленное лежит в списке релиза, стережёт
   смоук, как и список у каждой колонки вида `code`. */
function checkRow(st, row){
  const t = st.release.tables[row.obj], ck = (t && t.checks) || {};
  for(const id of Object.keys(row.dims)){
    const d = DIM(id);
    if(!d || d.vtype !== 'code' || !ck[d.col]) continue;
    if(ck[d.col].indexOf(row.dims[id]) < 0) return {col: d.col, value: row.dims[id]};
  }
  return null;
}
function writeRow(st, row, opts){
  const g = rowGate(st, row, opts);
  if(g.why) return {ok:false, why: g.why};
  const bad = checkRow(st, row);
  if(bad){
    const why = 'строка '+row.ref+' на '+fmt(row.date)+' не пишется: '+st.release.tables[row.obj].table+'.'+
      bad.col+' = «'+bad.value+'» — значения нет в списке релиза; новое значение закрытого словаря '+
      'приходит релизом вместе с правкой модели (ИС-57, ADR-0241 §2)';
    st.relLog.push({at: st.today, who:'CHECK', msg: why});
    return {ok:false, why, check: bad};
  }
```

- [ ] **Step 8: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 268/268 PASS` (проверено на копии).

- [ ] **Step 9: Мутация**

`checkRow` не сверяет (`if(ck[d.col].indexOf(row.dims[id]) < 0)` → `if(false)`) → `#283` RED
(267/268). Проверено; прочие пробы (слово мира вернули, список меры без «сторнирована»,
`bind` у платежа) валят `#282` и соседей.

- [ ] **Step 10: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-18a — закрытый словарь: список в релизе, CHECK у двери записи"
```

### Task 6b: З-18b — разрез значением: ключ в `dims`, подпись на дату в `lbls`, порядок и вышестоящее на дату (`ИС-57`, `ADR-0241` §1, §3, §4)

Спецификация §4 З-18, вторая треть (`СС-185`). Решения — `СС-196`, `СС-197`.

Правки ниже даны разностью «до → после» по функциям: `-` — строка до правки, `+` — после,
без знака — окружение для поиска. Метка над куском — место правки (функция или сторож);
`~N` — подсказка строки по снимку после З-18a, не адрес.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `REF` — `org.parent` историей `[[since, узел]]`, `org.lbl`; классификатор `risk` версиями
    со значениями `{lbl, ord}`; `RISK_RANK` снят;
  - `REGISTRY` — `d-category`, `d-bworst` читают код значения;
  - `WORLD` — категории кредитов кодами (`low`/`mid`/`high`/`loss`/`bad`);
  - `CORE` — «худшая» по `ord` версии на дату;
  - новые `refLbl`, `clsVal`, `parentOn`, `lblsOf`, `ST.lblsOf` — перед `readPath`;
    `readPath` — вышестоящее на дату;
  - `buildRow`, `eventRow`, `loadLegacy` — поле `lbls`; `ROW_SHAPE`, `ROW_VALUES`;
  - `rowDiff` — различие подписи; `probeRec` — подпись входит в пробу;
  - шапка `SEED_INPUTS` и сам список — без `RISK_RANK`;
  - `ST.statSlice`, `sliceTable`, `tilesBlock` — группа держит ключ, печатается подписью.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#3`, `#31`, `#223`, `#280`;
  блок З-18b (`#284`…`#286`) перед отчётом.

**Interfaces:**
- Consumes: `REF`, `DIM`, `valueOn`, `worldAt`, `readDim`/`readPath`, `buildRow`, `rowDiff`,
  `probeRec`, `ST.statSlice`, `checkRow` (З-18a).
- Produces:
  - поле строки `lbls` — `{имя разреза: подпись на дату}` у разрезов вида `ref`/`cls`; ключи —
    подмножество `dims`; у легаси — `{}` (`СС-196`); `ST.ROW_SHAPE` — 12 полей,
    `ST.ROW_VALUES = dims,lbls,inds,fx`;
  - `refLbl(ref, key, day)`, `clsVal(ref, code, day)` → `{lbl, ord}` версии на дату,
    `parentOn(ref, key, day)`, `lblsOf(d, v, dateISO)`, `ST.lblsOf(dimId, v, dateISO)`;
  - порядок категорий — `ord` версии классификатора на дату, `RISK_RANK` снят (`СС-197`);
  - переименование — событие справочника: прошлая строка держит подпись своей даты; ответ
    группирует по ключу, печатает подписью на дату среза.

- [ ] **Step 1: Падающие сторожа `#284`…`#286`**

Перед `/* ---- отчёт ---- */`, после блока З-18a:

```js
/* ===== Волна 23 · З-18b — ссылка: ключ и подпись на дату; классификатор: код, подпись, порядок;
   подразделение: два уровня на дату (ИС-57, ADR-0241 §1, §3, §4). Строка держит ключ разреза в
   `dims` и подпись на дату среза в `lbls`; группируют по ключу, печатают подпись. ===== */
(() => {
  const REF = vm.runInContext('REF', sandbox), W = vm.runInContext('WORLD', sandbox);
  const lblOf = (r, id, i) => { const l = ((r || {}).lbls || {})[id]; return l == null ? null : i == null ? l : l[i]; };

  /* #284 — переименование в справочнике прошлую строку не меняет. Ошское РП переименовано
     21.08: ночь 22.08 — обычная ночь с кандидатами, а не полный обход, — пишет его объектам
     новую подпись, хотя ни один их факт не менялся: проба кандидата видит подпись (СС-196), и
     копия вчерашней строки со вчерашней подписью не ложится. Строки 21.08 — прежние: подпись
     та, что была на их дату; ключ тот же, и срез по подразделению на 22.08 группирует по
     ключу, а печатает новую подпись. Подпись на дату считается от кануна: срез 22.08 видит
     справочник на 21.08, срез 21.08 — на 20.08. Ссылка без словаря (куратор) подписана своим
     ключом — у каждой хранимой строки. Поправка события несёт подпись того, что исправляет:
     перепривязка платежа к другому кредиту — подпись нового кредита. Проба видит подпись и у
     объекта, о котором молчат все соседи: заёмщика 84302196109115 не называет никто, а его
     подгруппа «5.2» той же ночью переподписана владельцем лестницы — строка 22.08 с новой
     подписью, а не копия вчерашней (ИС-54). Повторный прогон пройденной даты — полный обход, и
     строка, у которой сменилась одна подпись, переписывается на месте: сравнение строк видит
     подпись, перезапись названа в итоге ночи (ADR-0215 §6). */
  ST.seed();
  const was284 = JSON.stringify(REF.org.lbl);
  let t284 = [], y284 = [], cand284 = null, sl284 = null, eve284 = null, now284 = null, sg284 = null, sy284 = null;
  const ours284 = r => (r.dims['d-branch'] || r.dims['d-lbranch'] || [])[1] === 'Ошское РП';
  const pk284 = Object.keys(REF.paygroup.parent);
  const pv284 = l => pk284.reduce((a, k, i) => (a[k] = {lbl: k === '5.2' ? l : k, ord: i + 1}, a), {});
  try {
    REF.org.lbl['Ошское РП'] = [['2026-08-21', 'Ошское региональное представительство']];
    REF.paygroup.versions = [{since:'2020-01-01', values: pv284('5.2')}, {since:'2026-08-21', values: pv284('5.2 — безнадёжные')}];
    const res = ST.run(TODAY);
    sg284 = ST.rowsAt('obj-borrower', TODAY).find(r => r.ref === '84302196109115') || null;
    sy284 = ST.rowsAt('obj-borrower', ASK).find(r => r.ref === '84302196109115') || null;
    cand284 = res.ok ? (ST.state.runs[ST.state.runs.length - 1].cand || {}).scan : null;
    t284 = ['obj-credit', 'obj-borrower'].reduce((a, o) => a.concat(ST.rowsAt(o, TODAY).filter(ours284)), []);
    y284 = ['obj-credit', 'obj-borrower'].reduce((a, o) => a.concat(ST.rowsAt(o, ASK).filter(ours284)), []);
    const s = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: TODAY, levels:{'d-branch': 2}});
    const g = s.ok ? ST.findNode(s.groups, 'Блок регионального развития / Ошское РП') : null;
    sl284 = g ? {n: g.n, lbl: g.labels.join(' / ')} : null;
    eve284 = (ST.lblsOf('d-branch', ['Блок регионального развития', 'Ошское РП'], '2026-08-21') || [])[1];
    now284 = (ST.lblsOf('d-branch', ['Блок регионального развития', 'Ошское РП'], TODAY) || [])[1];
  } finally { REF.org.lbl = JSON.parse(was284); delete REF.paygroup.versions; }
  ST.seed();
  let rr284 = null, ra284 = null;
  try {
    REF.paygroup.versions = [{since:'2020-01-01', values: pv284('5.2')}, {since:'2026-08-20', values: pv284('5.2 — безнадёжные')}];
    rr284 = ST.run(ASK);
    ra284 = ST.rowsAt('obj-borrower', ASK).find(r => r.ref === '84302196109115') || null;
  } finally { delete REF.paygroup.versions; }
  ST.seed();
  const newL = 'Ошское региональное представительство';
  const idOf = r => (r.dims['d-branch'] || r.dims['d-lbranch'])[1];
  const lbOf = r => lblOf(r, r.dims['d-branch'] ? 'd-branch' : 'd-lbranch', 1);
  const cur284 = ST.rowsAt('obj-credit', ASK).find(r => r.ref === 'КД-2024/117');
  let plain284 = 0, off284 = 0;
  ST.state.rows.forEach(r => {
    if(ST.isLegacyRow(r)) return;
    Object.keys(r.dims).forEach(id => {
      const d = ST.DIM(id);
      if(!d || d.vtype !== 'ref' || d.ref || d.levels) return;
      plain284++; if(r.lbls[id] !== r.dims[id]) off284++;
    });
  });
  const p284 = W['obj-repay'].find(x => x.id === 'ПГ-2026/1127');
  const keep284 = {f: p284.f.credit, h: p284.h.credit};
  let rb284 = null;
  try {
    p284.f.credit = 'КД-2025/101'; p284.h.credit = [['2026-06-18', 'КД-2025/043'], ['2026-08-21', 'КД-2025/101']];
    ST.enqueue('obj-repay', 'ПГ-2026/1127', 'распоряжение', 'перепривязка к КД-2025/101');
    ST.run(TODAY);
    rb284 = ST.state.rows.find(r => r.obj === 'obj-repay' && r.ref === 'ПГ-2026/1127' && r.part === 'rebind') || null;
  } finally {
    p284.f.credit = keep284.f;
    if(keep284.h === undefined) delete p284.h.credit; else p284.h.credit = keep284.h;
  }
  ST.seed();
  ok(284, t284.length === 5 && y284.length === 5 && cand284 === 'кандидаты' &&
        t284.every(r => idOf(r) === 'Ошское РП' && lbOf(r) === newL) &&
        y284.every(r => idOf(r) === 'Ошское РП' && lbOf(r) === 'Ошское РП') &&
        !!sl284 && sl284.n === 3 && sl284.lbl === 'Блок регионального развития / ' + newL &&
        eve284 === 'Ошское РП' && now284 === newL &&
        !!cur284 && cur284.lbls['d-curator'] === cur284.dims['d-curator'] && plain284 > 0 && off284 === 0 &&
        !!rb284 && rb284.dims['d-pcredit'] === 'КД-2025/101' && rb284.lbls['d-pcredit'] === 'КД-2025/101' &&
        !!sg284 && sg284.dims['d-subgroup'][1] === '5.2' && sg284.lbls['d-subgroup'][1].lbl === '5.2 — безнадёжные' &&
        !!sy284 && sy284.lbls['d-subgroup'][1].lbl === '5.2' && sg284.lbls['d-subgroup'][1].ord === 10 &&
        !!rr284 && rr284.ok && rr284.rewrote === 1 && !!ra284 && ra284.lbls['d-subgroup'][1].lbl === '5.2 — безнадёжные',
    `ссылка — ключ и подпись на дату: Ошское РП переименовано 21.08; ночь ${TODAY} (обход — ${cand284 || '—'}) дала его ${t284.length} объектам (кредиты и заёмщики) подпись ${t284.map(lbOf).filter((x, i, a) => a.indexOf(x) === i).join(', ') || '—'} при ключе ${t284.map(idOf).filter((x, i, a) => a.indexOf(x) === i).join(', ') || '—'}, а строки ${ASK} (${y284.length}) держат прежнюю — ${y284.map(lbOf).filter((x, i, a) => a.indexOf(x) === i).join(', ') || '—'}. Срез по подразделению на ${TODAY} собирает группу по ключу и печатает её «${sl284 ? sl284.lbl : '—'}» (${sl284 ? sl284.n : '—'}). Подпись на дату — от кануна: на срез 21.08 «${eve284 || '—'}», на ${TODAY} «${now284 || '—'}». Ссылка без словаря подписана своим ключом: куратор «${cur284 ? cur284.lbls['d-curator'] : '—'}»; таких подписей в хранимых строках ${plain284}, не равных ключу ${off284}. Перепривязка ПГ-2026/1127 легла поправкой с кредитом «${rb284 ? rb284.dims['d-pcredit'] : '—'}» и его подписью «${rb284 ? rb284.lbls['d-pcredit'] : '—'}». Заёмщик 84302196109115, о котором молчат все соседи, переподписан той же ночью: подгруппа «${sy284 ? sy284.lbls['d-subgroup'][1].lbl : '—'}» → «${sg284 ? sg284.lbls['d-subgroup'][1].lbl : '—'}»; повторный прогон ${ASK} после переподписи с 20.08 переписал строк ${rr284 ? rr284.rewrote : '—'} — подпись «${ra284 ? ra284.lbls['d-subgroup'][1].lbl : '—'}» (ИС-54, ИС-57, ADR-0215 §6, ADR-0241 §1, СС-196)`);

  /* #285 — значение классификатора: код, подпись и порядок из версии на дату, и новая версия
     релиза не требует. Классификация публикует 21.08 новую версию: «high» подписан иначе, а
     между «mid» и «high» встал новый код «watch». КД-2025/101 получает «watch»: ночь 22.08
     строку пишет — CHECK у классификатора нет, релиз тот же, журнал сверки отказов не знает.
     Порядок — из версии: худшая категория заёмщика 01234199010101 (второй его договор — «mid»)
     — «watch». Строки 21.08 держат прежнюю подпись «high». */
  ST.seed();
  const was285 = JSON.stringify(REF.risk.versions);
  const c285 = W['obj-credit'].find(x => x.id === 'КД-2025/101');
  const keepC285 = JSON.stringify(c285.h.category);
  const rel285 = JSON.stringify(ST.release());
  let r285 = null, hi285 = null, hy285 = null, b285 = null, relSame285 = false, chk285 = -1, eve285 = null;
  try {
    const v2 = JSON.parse(JSON.stringify(REF.risk.versions[0]));
    v2.since = '2026-08-21'; v2.values.high.lbl = 'Высокий риск'; v2.values.watch = {lbl:'Под наблюдением', ord:25};
    REF.risk.versions.push(v2);
    c285.h.category = c285.h.category.concat([['2026-08-21', 'watch']]);
    const logN = ST.relLog().filter(e => e.who === 'CHECK').length;
    ST.run(TODAY);
    r285 = ST.rowsAt('obj-credit', TODAY).find(r => r.ref === 'КД-2025/101') || null;
    hi285 = ST.rowsAt('obj-credit', TODAY).find(r => r.ref === 'КД-2023/210') || null;
    hy285 = ST.rowsAt('obj-credit', ASK).find(r => r.ref === 'КД-2023/210') || null;
    b285 = ST.rowsAt('obj-borrower', TODAY).find(r => r.ref === '01234199010101') || null;
    relSame285 = JSON.stringify(ST.release()) === rel285;
    chk285 = ST.relLog().filter(e => e.who === 'CHECK').length - logN;
    eve285 = (ST.lblsOf('d-category', 'high', ASK) || {}).lbl;
  } finally { REF.risk.versions = JSON.parse(was285); c285.h.category = JSON.parse(keepC285); }
  ST.seed();
  const cl = (r, id) => JSON.stringify(lblOf(r, id));
  ok(285, !!r285 && r285.dims['d-category'] === 'watch' && cl(r285, 'd-category') === '{"lbl":"Под наблюдением","ord":25}' &&
        !!hi285 && hi285.dims['d-category'] === 'high' && lblOf(hi285, 'd-category').lbl === 'Высокий риск' &&
        !!hy285 && hy285.dims['d-category'] === 'high' && lblOf(hy285, 'd-category').lbl === 'Высокий кредитный риск' &&
        !!b285 && b285.dims['d-bworst'] === 'watch' && lblOf(b285, 'd-bworst').ord === 25 &&
        relSame285 && chk285 === 0 && eve285 === 'Высокий кредитный риск',
    `значение классификатора — код, подпись и порядок из версии на дату: КД-2025/101 на ${TODAY} — «${r285 ? r285.dims['d-category'] : '—'}» ${r285 ? cl(r285, 'd-category') : '—'}; КД-2023/210 тем же кодом «high» подписан на ${ASK} «${hy285 ? lblOf(hy285, 'd-category').lbl : '—'}», на ${TODAY} — «${hi285 ? lblOf(hi285, 'd-category').lbl : '—'}»; версия берётся на канун среза — на ${ASK} «${eve285 || '—'}». Худшая заёмщика 01234199010101 по порядку версии — «${b285 ? b285.dims['d-bworst'] : '—'}» (${b285 ? lblOf(b285, 'd-bworst').ord : '—'}). Новая версия классификатора релиза не потребовала: релиз ${relSame285 ? 'тот же' : 'другой'}, отказов CHECK ${chk285} (ИС-57, ADR-0241 §3, ADR-0125, СС-197)`);

  /* #286 — подразделение: два уровня на дату, не дерево владельца. Иссык-Кульское РП
     переподчинено Блоку кредитования с 15.08: строки до 15.08 включительно держат прежнее
     вышестоящее, с 16.08 — новое; ключ конечного подразделения тот же. Вышестоящее лежит в
     строке и при чтении не пересчитывается: срез по блокам на 01.08 и на 21.08 отвечает разным
     составом. Уровней у подразделения два — у релиза пара `d_unit` и пара `d_unit_parent`, и
     колонок на тип узла нет. */
  const was286 = JSON.stringify(REF.org.parent);
  let b286 = null, a286 = null, s0 = null, s1 = null, bor286 = null;
  try {
    REF.org.parent['Иссык-Кульское РП'] = [['2020-01-01', 'Блок регионального развития'], ['2026-08-15', 'Блок кредитования']];
    ST.seed();
    b286 = ST.rowsAt('obj-credit', '2026-08-15').find(r => r.ref === 'КД-2025/088') || null;
    a286 = ST.rowsAt('obj-credit', '2026-08-16').find(r => r.ref === 'КД-2025/088') || null;
    bor286 = ST.rowsAt('obj-borrower', ASK).find(r => r.ref === '31804196611227') || null;
    const cnt = d => { const s = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: d, levels:{'d-branch': 1}});
      const g = s.ok ? ST.findNode(s.groups, 'Блок кредитования') : null; return g ? g.n : null; };
    s0 = cnt('2026-08-01'); s1 = cnt(ASK);
  } finally { REF.org.parent = JSON.parse(was286); }
  ST.seed();
  const unitCols = ST.release().tables['obj-credit'].cols.filter(c => /^d_unit/.test(c)).join();
  ok(286, !!b286 && b286.dims['d-branch'].join(' / ') === 'Блок регионального развития / Иссык-Кульское РП' &&
        !!a286 && a286.dims['d-branch'].join(' / ') === 'Блок кредитования / Иссык-Кульское РП' &&
        !!bor286 && bor286.dims['d-lbranch'][0] === 'Блок кредитования' &&
        s0 === 4 && s1 === 5 && ST.DIM('d-branch').levels.length === 2 &&
        unitCols === 'd_unit_id,d_unit_lbl,d_unit_parent_id,d_unit_parent_lbl',
    `подразделение — два уровня на дату: Иссык-Кульское РП переподчинено Блоку кредитования с 15.08; КД-2025/088 на 15.08 — «${b286 ? b286.dims['d-branch'].join(' / ') : '—'}», на 16.08 — «${a286 ? a286.dims['d-branch'].join(' / ') : '—'}», его заёмщик на ${ASK} — «${bor286 ? bor286.dims['d-lbranch'].join(' / ') : '—'}». Вышестоящее лежит в строке: срез по блокам — «Блок кредитования» на 01.08 ${s0}, на ${ASK} ${s1}. Уровней ${ST.DIM('d-branch').levels.length}, колонки релиза — ${unitCols} (ИС-57, ADR-0241 §4, СС-197)`);
})();
```

- [ ] **Step 2: Шапка и переписанные сторожа**

`шапка` (~111):

```diff
 // в релизе, значение вне списка не пишется и называется в журнале сверки, новое значение —
 // миграцией; состояния платежа и меры — коды схемы.
+// блок волны 23 З-18b — разрез значением (ИС-57, ADR-0241 §1, §3, §4): ключ в `dims`, подпись на
+// дату в `lbls`; переименование прошлую строку не меняет; классификатор — код, подпись, порядок
+// из версии без релиза; подразделение — два уровня на дату.
 // Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
 // render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
```

`сторож #3` (~269):

```diff
      полем строки не становится: одиннадцатое поле («run_id») встало бы вне всех четырёх рядов,
      и запрет ИС-15 его бы не касался. Эта ночь — факт журнала прогона (ADR-0215 §6). */
+  /* Волна 23, З-18b (переписан на месте): полей 11 → 12 — `lbls`, подписи разрезов на дату, и
+     они в ряду ЗНАЧЕНИЙ: пара `_id`/`_lbl` схемы лежит в строке двумя полями — ключ в `dims`,
+     подпись в `lbls` (ИС-57, ADR-0241 §1). Ключи `lbls` — имена записей реестра, как у `dims`. */
   const sorted3 = shape.slice().sort().join();
   const evRows3 = ST.state.rows.filter(r => ST.storageOf(r.obj) === 'event_delta');
   const ans3 = ['obj-repay', 'obj-receipt'].reduce((a, o) => a.concat(ST.rowsAsOf(o, '2026-08-21')), []);
   const outside3 = ST.state.rows.concat(ans3).filter(r => Object.keys(r).slice().sort().join() !== sorted3);
-  ok(3, shape.length === 11 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
+  ok(3, shape.length === 12 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
        evRows3.length > 0 && ans3.length > 0 && outside3.length === 0 &&
-       shape.join(',') === 'obj,ref,date,part,dims,inds,fx,when,srcs,fixed,by' &&
+       shape.join(',') === 'obj,ref,date,part,dims,lbls,inds,fx,when,srcs,fixed,by' &&
        key.join(',') === 'obj,ref,date,part' &&
-       vals.join(',') === 'dims,inds,fx' && orig.length === 1 && both.length === 0 && cover &&
+       vals.join(',') === 'dims,lbls,inds,fx' && orig.length === 1 && both.length === 0 && cover &&
+       Object.keys(u3.lbls).length > 0 && Object.keys(u3.lbls).every(k => k in u3.dims) &&
        !!u3.fx && Object.keys(u3.fx).sort().join() === 'rate,rateDate' &&
        valKeys.length > 0 && valKeys.every(k => !!ST.REC(k)) &&
```

`сторож #3` (~285):

```diff
        som3 === 'm-debt-som' && !('som' in u3) && !('som' in u3.inds['m-debt']) &&
        u3.inds[som3] && u3.inds[som3].v > 0 && ST.IND(som3).unit === 'сом',
-    `форма строки закрыта: ${shape.join(' · ')} — долей и дельт нет (ИС-15). Полей одиннадцать — десятое, «part», стоит в адресе (СС-170), одиннадцатое, «fx», курс строки, — в ряду значений (ИС-56): рядов четыре и вместе они покрывают форму без остатка, не пересекаясь ни одним полем: АДРЕС (${key.join(' · ')}) · ЗНАЧЕНИЯ (${vals.join(' · ')}) · ПРОИСХОЖДЕНИЕ (${orig.join(' · ')}) · СУДЬБА (${fate.join(' · ')}). Прежний критерий различения на четвёртом ряду сломался и заменён: ключей в ряду значений ${valKeys.length} и каждый — запись реестра, но ключей в ряду ПРОИСХОЖДЕНИЯ ${origKeys.length} и каждый — тоже запись реестра, так что по именам эти ряды не разводятся. Разводит их словарь: значений в ряду происхождения ${origVals.length}, и все до одного — слова закрытого списка из двух (${ST.DATING.join(' · ')}), величины среди них нет ни одной (ИС-39, ADR-0205 §1). Ряд судьбы стоит особняком по-прежнему: ключей ${fateKeys.length} (${fateKeys.join(', ')}), и не запись реестра ни один — это имена СОСЕДЕЙ (ИС-42, ADR-0208 §2). Сомовая величина вошла в строку колонкой внутри inds под именем записи реестра «${ST.IND(som3).name}» (${(u3.inds[som3] || {}).v} ${ST.IND(som3).unit}), а не полем формы: поле нельзя назвать в отчёте и прекратить датой, запись — можно (ИС-44, ADR-0214 §2). Форму держит каждая строка: из ${ST.state.rows.length} хранимых (строк событий ${evRows3.length}) и ${ans3.length} действующих ответов событий на 21.08 вне формы ${outside3.length}${outside3.length ? ' (' + outside3[0].obj + ' ' + outside3[0].ref + ': ' + Object.keys(outside3[0]).filter(k => shape.indexOf(k) < 0).join(', ') + ')' : ''}`);
+    `форма строки закрыта: ${shape.join(' · ')} — долей и дельт нет (ИС-15). Полей двенадцать — десятое, «part», стоит в адресе (СС-170), одиннадцатое, «fx», курс строки, и двенадцатое, «lbls», подписи разрезов на дату, — в ряду значений (ИС-56, ИС-57); подписей у строки ${Object.keys(u3.lbls).length}, и каждая — у разреза, чей ключ лежит в dims: рядов четыре и вместе они покрывают форму без остатка, не пересекаясь ни одним полем: АДРЕС (${key.join(' · ')}) · ЗНАЧЕНИЯ (${vals.join(' · ')}) · ПРОИСХОЖДЕНИЕ (${orig.join(' · ')}) · СУДЬБА (${fate.join(' · ')}). Прежний критерий различения на четвёртом ряду сломался и заменён: ключей в ряду значений ${valKeys.length} и каждый — запись реестра, но ключей в ряду ПРОИСХОЖДЕНИЯ ${origKeys.length} и каждый — тоже запись реестра, так что по именам эти ряды не разводятся. Разводит их словарь: значений в ряду происхождения ${origVals.length}, и все до одного — слова закрытого списка из двух (${ST.DATING.join(' · ')}), величины среди них нет ни одной (ИС-39, ADR-0205 §1). Ряд судьбы стоит особняком по-прежнему: ключей ${fateKeys.length} (${fateKeys.join(', ')}), и не запись реестра ни один — это имена СОСЕДЕЙ (ИС-42, ADR-0208 §2). Сомовая величина вошла в строку колонкой внутри inds под именем записи реестра «${ST.IND(som3).name}» (${(u3.inds[som3] || {}).v} ${ST.IND(som3).unit}), а не полем формы: поле нельзя назвать в отчёте и прекратить датой, запись — можно (ИС-44, ADR-0214 §2). Форму держит каждая строка: из ${ST.state.rows.length} хранимых (строк событий ${evRows3.length}) и ${ans3.length} действующих ответов событий на 21.08 вне формы ${outside3.length}${outside3.length ? ' (' + outside3[0].obj + ' ' + outside3[0].ref + ': ' + Object.keys(outside3[0]).filter(k => shape.indexOf(k) < 0).join(', ') + ')' : ''}`);
 
   const edit = ST.tryEditRow();
```

`сторож #31` (~640):

```diff
   const aug = ST.statRows({obj:'obj-credit', date:'2026-08-19'}).rows.find(r => r.ref === 'КД-2024/117');
   ok(31, may.dims['d-curator'] === 'Асанов А.' && aug.dims['d-curator'] === 'Бекова Н.' &&
-        may.dims['d-category'] === 'Низкий кредитный риск' && aug.dims['d-category'] === 'Средний кредитный риск',
-    `смена куратора 15.07 майскую строку не переписала: май — ${may.dims['d-curator']}, август — ${aug.dims['d-curator']} — ИС-4`);
+        /* Волна 23, З-18b (переписан на месте): категория лежит кодом значения классификатора,
+           подпись — рядом, в `lbls` (ИС-57, ADR-0241 §3). Утверждение прежнее. */
+        may.dims['d-category'] === 'low' && may.lbls['d-category'].lbl === 'Низкий кредитный риск' &&
+        aug.dims['d-category'] === 'mid' && aug.lbls['d-category'].lbl === 'Средний кредитный риск',
+    `смена куратора 15.07 майскую строку не переписала: май — ${may.dims['d-curator']}, август — ${aug.dims['d-curator']}; категория — «${may.lbls['d-category'].lbl}» и «${aug.lbls['d-category'].lbl}» — ИС-4`);
 
   /* Волна 23 (переписан на месте): релиз идёт ПЕРЕД записью — колонку `d_segment` заводит
```

`сторож #223 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5115):

```diff
      а пересчитать её остаток сегодняшним курсом значило бы выдать сегодняшнее за историческое
      (ИС-41). Валюта легаси-итога — разрез строки, как у своей. */
-  ok(223, shape && Object.keys(lr).length === 11 && lr.part === null && lr.fx === null &&
+  /* Волна 23, З-18b (переписан на месте): полей 11 → 12 — `lbls`, подписи разрезов (ИС-57). У
+     легаси-строки он ПУСТ: старая система подписей на дату не отдавала, и сегодняшняя подпись
+     в строке 2025 года была бы подписью не её даты. */
+  ok(223, shape && Object.keys(lr).length === 12 && lr.part === null && lr.fx === null &&
+        JSON.stringify(lr.lbls) === '{}' &&
         lr.dims['d-cur'] === 'KGS' && Object.keys(lr.inds).every(id => Object.keys(lr.inds[id]).join() === 'v') &&
         lr.by === 'миграция, вып. 1' && lr.fixed && lr.fixed.edition === 'легаси' &&
```

`сторож #280 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~7596):

```diff
         vObjs280.join() === fxObjs280.join() && somOnly280 &&
         badCell280 === 0 && badFx280 === 0 && typeof ST.partsOf === 'undefined' &&
-        ST.ROW_VALUES.join() === 'dims,inds,fx' &&
+        ST.ROW_VALUES.join() === 'dims,lbls,inds,fx' &&
         ST.OBJ('obj-repay').rateDay === 'rdate' &&
         !!lr280 && lr280.date === '2026-08-11' && lr280.fx.rate === 87.45 && lr280.fx.rateDate === '2026-05-31' &&
```

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL `#3`, `#31`, `#223`, `#280`, `#284`…`#286` — поля `lbls` и версий нет.

- [ ] **Step 4: Движок**

`const REF = {` (~1454):

```diff
    оргструктуры статистика не держит (ADR-0176 §7). */
 const REF = {
+  /* Узел оргструктуры — ключ и подпись на дату; вышестоящее — тоже на дату (ИС-57, ADR-0241 §1,
+     §4). Переподчинение и переименование — события справочника с датой действия: строка
+     прошлой даты держит то вышестоящее и ту подпись, что были на её дату, и не едет за
+     сегодняшним справочником. Переименований в демо-мире нет — подпись узла есть его ключ. */
   org: {owner:'Оргструктура (кадры)', parent:{
-    'Кредитный департамент':'Блок кредитования',
-    'Ошское РП':'Блок регионального развития',
-    'Иссык-Кульское РП':'Блок регионального развития'}},
+    'Кредитный департамент':[['2020-01-01','Блок кредитования']],
+    'Ошское РП':[['2020-01-01','Блок регионального развития']],
+    'Иссык-Кульское РП':[['2020-01-01','Блок регионального развития']]},
+    lbl:{}},
+  /* Категория риска — классификатор владельца: значения принадлежат ОПУБЛИКОВАННОЙ ВЕРСИИ
+     (ADR-0125), у значения код, подпись и порядок (ИС-57, ADR-0241 §3). Новая версия — данные
+     владельца, а не релиз статистики: CHECK у классификатора нет. Порядок — от лучшей к
+     худшей, по нему считается «худшая»; до волны 23 его зеркалил список `RISK_RANK`. */
+  risk: {owner:'Классификация', versions:[{since:'2020-01-01', values:{
+    low:  {lbl:'Низкий кредитный риск',  ord:10},
+    mid:  {lbl:'Средний кредитный риск', ord:20},
+    high: {lbl:'Высокий кредитный риск', ord:30},
+    loss: {lbl:'Потери',                 ord:40},
+    bad:  {lbl:'Убыток',                 ord:50}}}]},
   /* Одиннадцать классов лестницы (ADR-0125). Соответствие «подгруппа → группа» держит
      владелец: группа — первая цифра, и второй раз её здесь не выводят (ADR-0012). */
```

`const REGISTRY = [` (~1501):

```diff
   {kind:'разрез', id:'d-curator', col:'d_curator', vtype:'ref', obj:'obj-credit', name:'Куратор кредита', src:'история', key:'curator', since:'2020-01-01'},
   {kind:'разрез', id:'d-category', col:'d_risk', vtype:'cls', obj:'obj-credit', name:'Категория риска', src:'шов', seam:'riskCategory', field:'category',
-   since:'2020-01-01', note:'шов классификации (ADR-0124); статистика её не выводит'},
+   since:'2020-01-01', owner:'Классификация', ref:'risk', note:'шов классификации (ADR-0124); статистика её не выводит'},
   /* Ступени по сроку неплатежа — КОРЗИНА, а не набор показателей: строка хранит число
      как есть, ступень применяется при чтении, и смена набора прошлое не переписывает
```

`const REGISTRY = [` (~1660):

```diff
      показатель предъявляют предикату классификации (ADR-0185 §3). Второго источника нет. */
   {kind:'разрез', id:'d-bworst', col:'d_worst', vtype:'cls', obj:'obj-borrower', name:'Худшая категория', src:'шов', seam:'riskCategory', field:'category',
-   since:'2020-01-01', owner:'Классификация',
+   since:'2020-01-01', owner:'Классификация', ref:'risk',
    note:'у заёмщика категория не присвоена, а свёрнута по худшему (ADR-0121 §2) — и потому носит своё имя'},
   /* Подгруппа — ОДИН разрез с двумя уровнями: группа есть первая цифра подгруппы,
```

`const WORLD = {` (~2523):

```diff
     {branch:[['2024-03-11','Кредитный департамент']], curator:[['2025-01-01','Асанов А.'],['2026-07-15','Бекова Н.']],
      rfEvade:[['2024-03-11',false]], rfNomon:[['2024-03-11',false]],
-     status:[['2024-03-11','действующий']], category:[['2026-01-01','Низкий кредитный риск'],['2026-06-01','Средний кредитный риск']]},
+     status:[['2024-03-11','действующий']], category:[['2026-01-01','low'],['2026-06-01','mid']]},
     {principal:[940000,-28000], interest:[18400,6200], daysOverdue:[0,0], issuedTotal:[1200000,0], repaidBase:[260000]}),
   it('КД-2023/210', {cdate:'2023-05-04', inn:'22903197505433', line:'оборотная', cur:'KGS', amount:3400000, program:'БК-2021', kind:'бюджетный кредит', decision:'ПП КР №218 от 12.05.2021', industry:'Сельское хозяйство', region:'Ошская', district:'Кара-Сууйский'},
     {branch:[['2023-05-04','Ошское РП']], curator:[['2025-01-01','Бекова Н.']],
      rfEvade:[['2023-05-04',true]], rfNomon:[['2023-05-04',false]],
-     status:[['2023-05-04','действующий']], category:[['2026-01-01','Средний кредитный риск'],['2026-07-01','Высокий кредитный риск']]},
+     status:[['2023-05-04','действующий']], category:[['2026-01-01','mid'],['2026-07-01','high']]},
     {principal:[2870000,-41000], interest:[96300,17800], daysOverdue:[128,30], issuedTotal:[3400000,0], repaidBase:[530000], disputedDays:[31,0]}),
   it('КД-2025/043', {cdate:'2025-02-19', inn:'10510198203112', line:'оборотная', cur:'USD', amount:180000, program:'РКФР-2023', kind:'иностранный кредит', decision:'ПП КР №77 от 30.01.2023', industry:'Торговля', region:'Чуйская', district:'Аламудунский'},
     {branch:[['2025-02-19','Кредитный департамент']], curator:[['2025-02-19','Бекова Н.']],
      rfEvade:[['2025-02-19',false]], rfNomon:[['2025-02-19',false]],
-     status:[['2025-02-19','действующий']], category:[['2026-01-01','Низкий кредитный риск']]},
+     status:[['2025-02-19','действующий']], category:[['2026-01-01','low']]},
     {principal:[152000,-3400], interest:[2280,760], daysOverdue:[0,0], issuedTotal:[180000,0], repaidBase:[28000]}),
   it('КД-2025/088', {cdate:'2025-06-30', inn:'31804196611227', line:'инвестиционная', cur:'KGS', amount:750000, program:'ФРР-2025', kind:'бюджетная ссуда', decision:'ПП КР №102 от 21.02.2025', industry:'Услуги', region:'Иссык-Кульская', district:'Тонский'},
     {branch:[['2025-06-30','Иссык-Кульское РП']], curator:[['2025-06-30','Асанов А.']],
      rfEvade:[['2025-06-30',false]], rfNomon:[['2025-06-30',true]],
-     status:[['2025-06-30','действующий']], category:[['2026-01-01','Средний кредитный риск']]},
+     status:[['2025-06-30','действующий']], category:[['2026-01-01','mid']]},
     {principal:[612000,-14500], interest:[13700,4100], daysOverdue:[47,30], issuedTotal:[750000,0], repaidBase:[138000]}),
   it('КД-2025/101', {cdate:'2025-08-12', inn:'01234199010101', line:'инвестиционная', cur:'EUR', amount:120000, program:'ЕАБР-2025', kind:'иностранный кредит', decision:'ПП КР №140 от 08.04.2025', industry:'Переработка', region:'Чуйская', district:'Сокулукский'},
     {branch:[['2025-08-12','Кредитный департамент']], curator:[['2025-08-12','Бекова Н.']],
      rfEvade:[['2025-08-12',false]], rfNomon:[['2025-08-12',false]],
-     status:[['2025-08-12','действующий']], category:[['2026-01-01','Средний кредитный риск']]},
+     status:[['2025-08-12','действующий']], category:[['2026-01-01','mid']]},
     {principal:[104500,-2100], interest:[1830,590], daysOverdue:[45,30], issuedTotal:[120000,0], repaidBase:[15500]}),
   it('КД-2022/065', {cdate:'2022-04-01', inn:'22903197505433', line:'инвестиционная', cur:'KGS', amount:5100000, program:'БК-2021', kind:'бюджетный кредит', decision:'ПП КР №218 от 12.05.2021', industry:'Строительство', region:'Чуйская', district:'Аламудунский'},
     {branch:[['2022-04-01','Кредитный департамент']], curator:[['2025-01-01','Асанов А.']],
      rfEvade:[['2022-04-01',true]], rfNomon:[['2022-04-01',false]],
-     status:[['2022-04-01','действующий']], category:[['2026-01-01','Высокий кредитный риск']]},
+     status:[['2022-04-01','действующий']], category:[['2026-01-01','high']]},
     {principal:[3980000,-52000], interest:[214000,31500], daysOverdue:[214,30], issuedTotal:[5100000,0], repaidBase:[1120000], disputedDays:[90,0]}),
   it('КД-2021/012', {cdate:'2021-09-15', inn:'45607195804119', line:'оборотная', cur:'KGS', amount:900000, program:'БК-2021', kind:'бюджетный кредит', decision:'ПП КР №218 от 12.05.2021', industry:'Торговля', region:'Ошская', district:'Узгенский'},
     {branch:[['2021-09-15','Ошское РП']], curator:[['2025-01-01','Бекова Н.']],
      rfEvade:[['2021-09-15',false]], rfNomon:[['2021-09-15',false]],
-     status:[['2021-09-15','действующий'],['2026-07-20','погашен']], category:[['2026-01-01','Низкий кредитный риск']]},
+     status:[['2021-09-15','действующий'],['2026-07-20','погашен']], category:[['2026-01-01','low']]},
     {principal:[86000,-43000], interest:[1900,0], daysOverdue:[0,0], issuedTotal:[900000,0], repaidBase:[814000], overpaid:[1250,0]}),
   /* Кредитная линия, освоенная НЕ полностью: выдано 1 540 000 из 2 200 000. Неосвоенные
```

`const WORLD = {` (~2562):

```diff
     {branch:[['2026-02-03','Ошское РП']], curator:[['2026-02-03','Асанов А.']],
      rfEvade:[['2026-02-03',false]], rfNomon:[['2026-02-03',false]],
-     status:[['2026-02-03','действующий']], category:[['2026-01-01','Низкий кредитный риск']]},
+     status:[['2026-02-03','действующий']], category:[['2026-01-01','low']]},
     {principal:[1450000,-21000], interest:[29500,7900], daysOverdue:[0,0], issuedTotal:[1540000,0], repaidBase:[90000]})
 ],
```

`const ARTICLES = ['collection','charges','principal','accInterest','interest','accPenalty'` (~2922):

```diff
    в зеркале ядра, и статистике не известен: она спрашивает поле шва по имени. */
 const ARTICLES = ['collection','charges','principal','accInterest','interest','accPenalty','penalty'];
-/* Порядок категорий — от лучшей к худшей. Он объявлен ВЛАДЕЛЬЦЕМ (классификация,
-   ADR-0125) и здесь только зеркалится: «худшая» без объявленного порядка не значит
-   ничего, а статистика порядок сравнения не изобретает. */
-const RISK_RANK = ['Низкий кредитный риск', 'Средний кредитный риск', 'Высокий кредитный риск',
-                   'Потери', 'Убыток'];
 /* Залоговый коэффициент вида — справочник ВЛАДЕЛЬЦА (залог, §2 канона; демо-значения).
    Класс ликвидности здесь не дублируется: он лежит в REF.collkind и оттуда же берётся
```

`const CORE = {` (~3289):

```diff
     const cats = CORE.creditsOf(item.id).map(c => valueOn(c.h.category, dateISO)).filter(Boolean);
     let worst = null;
-    cats.forEach(c => { if(worst == null || RISK_RANK.indexOf(c) > RISK_RANK.indexOf(worst)) worst = c; });
+    /* «Худшая» — по порядку значения в версии классификатора на дату (ИС-57, ADR-0241 §3). */
+    cats.forEach(c => { if(worst == null || clsVal('risk', c, dateISO).ord > clsVal('risk', worst, dateISO).ord) worst = c; });
     return {category: {value: worst},
             subgroup: {value: valueOn((item.h || {}).subgroup, dateISO)}};
```

`function readPath(d, item, dateISO, ask){` (~4312):

```diff
    берутся у владельца (ADR-0176 §7). Путь обрывается на первом пустом уровне: объект
    без нижнего уровня остаётся у родителя и не исчезает (ADR-0176 §5). */
+/* ПОДПИСЬ, ПОРЯДОК И ВЫШЕСТОЯЩЕЕ — НА ДАТУ (ИС-57, ADR-0241 §1, §3, §4; СС-196, СС-197). Разрез
+   лежит в строке ключом (`dims`) — по нему группируют и сравнивают; подпись, какой она была на
+   дату среза, лежит рядом (`lbls`) — её печатают. У ссылки подпись — строка, у значения
+   классификатора — подпись и порядок из версии на дату, у уровня иерархии — подпись уровня.
+   Справочник без подписей отвечает ключом: в демо-мире ключ соседа и есть его имя. Все три
+   функции берут день МИРА: канун среза считает вызывающий (ADR-0238 §2). */
+function refLbl(ref, key, day){
+  const h = ((REF[ref] || {}).lbl || {})[key];
+  return (h && valueOn(h, day)) || key;
+}
+function clsVal(ref, code, day){
+  const R = REF[ref] || {};
+  if(R.versions){
+    const ver = R.versions.filter(v => v.since <= day).slice(-1)[0];
+    const x = ver && ver.values[code];
+    return x ? {lbl: x.lbl, ord: x.ord} : {lbl: code, ord: null};
+  }
+  /* Лестница без версий (подгруппы): порядок — место значения в справочнике владельца. */
+  const keys = Object.keys(R.parent || {});
+  return {lbl: code, ord: keys.indexOf(code) >= 0 ? keys.indexOf(code) + 1 : null};
+}
+function parentOn(ref, key, day){
+  const h = ((REF[ref] || {}).parent || {})[key];
+  return Array.isArray(h) ? valueOn(h, day) : (h || null);
+}
+function lblsOf(d, v, dateISO){
+  if(!d || v == null) return null;
+  const day = worldAt(dateISO);
+  const one = (vt, k) => vt === 'ref' ? refLbl(d.ref, k, day) : vt === 'cls' ? clsVal(d.ref, k, day) : null;
+  if(d.levels) return v.map((k, i) => d.levels[i] && d.levels[i].col ? one(d.levels[i].vtype, k) : null);
+  if(d.vtype === 'ref_arr') return [].concat(v).map(k => refLbl(d.ref, k, day));
+  return one(d.vtype, v);
+}
+ST.lblsOf = (dimId, v, dateISO) => lblsOf(DIM(dimId), v, dateISO);
 function readPath(d, item, dateISO, ask){
   /* Признак датировки у ПУТИ один на разрез, и собирается он по всем уровням, которые в
```

`function readPath(d, item, dateISO, ask){` (~4320):

```diff
     if(d.levels[i].src === 'справочник'){
       const below = vals[i+1];
-      vals[i] = below == null ? null : (((REF[d.ref] || {}).parent || {})[below] || null);
+      vals[i] = below == null ? null : parentOn(d.ref, below, worldAt(dateISO));
     }
   }
```

`function buildRow(objId, item, dateISO, silent){` (~4402):

```diff
 function buildRow(objId, item, dateISO, silent){
   const o = OBJ(objId);
-  const dims = {}, inds = {};
+  const dims = {}, lbls = {}, inds = {};
   /* Спрос ведётся ОДНИМ контекстом на строку: колонка источника собирается по ходу
      чтения, а не досочиняется после по списку записей объекта. Досочини её — и она
      говорила бы о СОСТАВЕ объекта, а не о том, кого этой ночью правда спрашивали. */
   const ask = {silent: silent || null, srcs: {}, when: {}, fx: fxOf(o, item, dateISO)};
-  o.dims.forEach(id => { const v = readDim(id, item, dateISO, ask); if(v != null) dims[id] = v; });
+  o.dims.forEach(id => {
+    const v = readDim(id, item, dateISO, ask);
+    if(v == null) return;
+    dims[id] = v;
+    const l = lblsOf(DIM(id), v, dateISO);
+    if(l != null) lbls[id] = l;
+  });
   o.inds.forEach(id => { const c = readInd(id, item, dateISO, ask); if(c) inds[id] = c; });
-  return {obj: objId, ref: item.id, date: dateISO, part: null, dims, inds, fx: ask.fx, when: ask.when,
+  return {obj: objId, ref: item.id, date: dateISO, part: null, dims, lbls, inds, fx: ask.fx, when: ask.when,
           srcs: ask.srcs, fixed: null, by: 'прогон'};
 }
```

`ST.ROW_SHAPE = ['obj','ref','date','part','dims','inds','fx','when','srcs','fixed','by'];` (~4494):

```diff
    с колонкой `cur`: второго места для неё нет. Клетки величин с этой волны несут ОДНО число —
    ни валюты, ни курса, ни состава по валютам (ИС-16 сужен). */
-ST.ROW_SHAPE = ['obj','ref','date','part','dims','inds','fx','when','srcs','fixed','by'];
+/* ВОЛНА 23 З-18b ЗАВЕЛА ДВЕНАДЦАТОЕ ПОЛЕ — `lbls`, подписи разрезов на дату: у ссылки строка,
+   у значения классификатора подпись и порядок, у иерархии — по уровню (ИС-57, ADR-0241 §1,
+   §3, §4, СС-196). Это ЗНАЧЕНИЕ, и ключи его — имена записей реестра, как у `dims`: пара
+   колонок `_id`/`_lbl` схемы лежит в строке двумя полями, ключ отдельно от подписи, потому
+   что группируют по ключу, а печатают подпись. У легаси подписей нет — `lbls` пуст. */
+ST.ROW_SHAPE = ['obj','ref','date','part','dims','lbls','inds','fx','when','srcs','fixed','by'];
 /* Ряды формы названы порознь, чтобы «форма закрыта» осталось проверяемым числом, а не
    счётом полей: значений в строке ДВА места, и запрет ИС-15 стоит именно на них. Рядов
```

`ST.ROW_VALUES = ['dims','inds','fx'];` (~4502):

```diff
    СУДЬБА — что с этим было: кого спросили, кто удостоверил, кто написал. */
 ST.ROW_KEY = ['obj','ref','date','part'];
-ST.ROW_VALUES = ['dims','inds','fx'];
+ST.ROW_VALUES = ['dims','lbls','inds','fx'];
 ST.ROW_ORIGIN = ['when'];
 ST.ROW_FATE = ['srcs','fixed','by'];
```

`function rowDiff(was, now){` (~4547):

```diff
 function rowDiff(was, now){
   const out = [];
-  ['dims','inds'].forEach(k => {
-    Object.keys(was[k]).concat(Object.keys(now[k])).forEach(id => {
+  /* Подпись — значение (ИС-57): переименование в справочнике переписывает строку своей даты и
+     названо в журнале именем разреза (СС-196). */
+  ['dims','lbls','inds'].forEach(k => {
+    Object.keys(was[k] || {}).concat(Object.keys(now[k] || {})).forEach(id => {
       if(out.indexOf(id) >= 0) return;
-      if(JSON.stringify(was[k][id]) !== JSON.stringify(now[k][id])) out.push(id);
+      if(JSON.stringify((was[k] || {})[id]) !== JSON.stringify((now[k] || {})[id])) out.push(id);
     });
   });
```

`function probeRec(id, item, dateISO){` (~4756):

```diff
    написанной строке, а не разведке (ADR-0208 §2).                                     */
 function probeRec(id, item, dateISO){
-  return DIM(id) ? readDim(id, item, dateISO, null) : readInd(id, item, dateISO, null);
+  if(!DIM(id)) return readInd(id, item, dateISO, null);
+  /* Подпись входит в пробу (ИС-57, СС-196): переименование в справочнике — изменение записи на
+     дату, и объект, о котором промолчали бы все источники, иначе получил бы копию вчерашней
+     строки со вчерашней подписью (ИС-54). */
+  const v = readDim(id, item, dateISO, null);
+  const l = lblsOf(DIM(id), v, dateISO);
+  return l == null ? v : {v, l};
 }
 const sameVal = (a, b) => JSON.stringify(bareOf(a)) === JSON.stringify(bareOf(b));
```

`function eventRow(o, item, D, silent){` (~5110):

```diff
   Object.keys(o.evState || {}).forEach(id => {
     const x = readDim(id, item, D, ask);
+    const l = x == null ? null : lblsOf(DIM(id), x, D);
     if(x == null) delete row.dims[id]; else row.dims[id] = x;
+    if(l == null) delete row.lbls[id]; else row.lbls[id] = l;
   });
   return row;
```

`function loadLegacy(st){` (~6232):

```diff
         /* Пишет ТА ЖЕ функция записи, что у прогона (ИС-8, ADR-0239 §4): выпуск миграции
            проходит её признаком `legacy` — легаси-месяц приходит закрытым, и пишет его он один. */
-        const w = writeRow(st, {obj: objId, ref: t.ref, date: d, part: null, dims, inds, fx: null, when, srcs,
+        const w = writeRow(st, {obj: objId, ref: t.ref, date: d, part: null, dims, lbls: {}, inds, fx: null, when, srcs,
           /* §3: строка приходит СРАЗУ ОКОНЧАТЕЛЬНОЙ. Незафиксированной её положить нельзя:
              открытая строка — обещание пересчитать, а пересчитывать нечем. */
```

`/* ВХОД СБОРКИ — ровно те данные модуля, которые читает 'seed()' (СС-166: ключ — отпечаток` (~6418):

```diff
 const SEED_CACHE = new Map(), SEED_STAT = {hits: 0, misses: 0};
 /* ВХОД СБОРКИ — ровно те данные модуля, которые читает `seed()` (СС-166: ключ — отпечаток
-   ВСЕХ данных мира). Их 27, по происхождению:
+   ВСЕХ данных мира). Их 26, по происхождению:
    - мир и его владельцы: `WORLD`, `OBJECTS`, `REF`, `RATES`, `LEGACY`, `NEIGHBOURS`,
      реестр `REGISTRY`, релиз `RELEASE` и виды значений его колонок `VTYPES`;
    - справочники владельцев, которыми считает ядро: `COLL_K` (залоговый коэффициент вида),
      `SURVEY_MATRIX` (периодичность обследования), `PAY_SPLIT`/`PAY_LAYER` (разнесение платежа
-     по статьям и слоям), `ARTICLES`, `RISK_RANK`, `BANKRUPT_SUBGROUPS`;
+     по статьям и слоям), `ARTICLES`, `BANKRUPT_SUBGROUPS`; порядок категорий риска с волны 23
+     лежит в версии классификатора `REF.risk` (З-18b);
    - данные ядра: `CORE.DATING` (объявленная датировка швов — ложится в `when` каждой строки,
      ADR-0205 §1) и `CORE.SOM_ROUNDING` (правило округления, ADR-0214 §6);
```

`const SEED_INPUTS = () => ({WORLD, OBJECTS, REF, RATES, LEGACY, NEIGHBOURS, REGISTRY, RELE` (~6436):

```diff
    совпадения — ни пропущенного, ни лишнего. */
 const SEED_INPUTS = () => ({WORLD, OBJECTS, REF, RATES, LEGACY, NEIGHBOURS, REGISTRY, RELEASE, VTYPES,
-  COLL_K, SURVEY_MATRIX, PAY_SPLIT, PAY_LAYER, ARTICLES, RISK_RANK, BANKRUPT_SUBGROUPS,
+  COLL_K, SURVEY_MATRIX, PAY_SPLIT, PAY_LAYER, ARTICLES, BANKRUPT_SUBGROUPS,
   'CORE.DATING': CORE.DATING, 'CORE.SOM_ROUNDING': CORE.SOM_ROUNDING,
   KIND, DATING, FORM, LAYERS, MON, NIGHTLY, CAND_SRC, FLAT_TYPES, CUR_DIM});
```

`ST.statSlice = q => {` (~7849):

```diff
   const hier = dims.length === 1 && DIM(dims[0]) && DIM(dims[0]).levels ? DIM(dims[0]) : null;
   const depth = hier ? Math.min((q.levels && q.levels[hier.id]) || hier.levels.length, hier.levels.length) : 1;
+  /* Группа держит КЛЮЧ, печатается ПОДПИСЬЮ на дату среза (ИС-57, ADR-0241 §1): строки одной
+     даты несут одну подпись ключа, и берётся она из строки, а не из сегодняшнего справочника. */
+  const txt = x => x == null ? null : typeof x === 'object' ? x.lbl : String(x);
+  const labelsOf = (key, parts, rws, lvl) => {
+    const r = rws[0] || {lbls: {}, dims: {}};
+    if(hier) return parts.map((p, i) => txt(((r.lbls || {})[hier.id] || [])[i]) || p);
+    return dims.map((d, i) => {
+      const D = DIM(d), l = (r.lbls || {})[d];
+      if(l == null || D.buckets) return parts[i];
+      if(D.levels){
+        const n = (q.levels && q.levels[d]) || D.levels.length;
+        return l.slice(0, n).map((x, j) => txt(x) || (r.dims[d] || [])[j]).join(' / ');
+      }
+      return Array.isArray(l) ? l.join(', ') : txt(l);
+    });
+  };
   const node = (key, parts, rws, lvl) => ({
-    key, parts, level: lvl, n: rws.length, refs: rws.map(r => r.ref),
+    key, parts, labels: labelsOf(key, parts, rws, lvl), level: lvl, n: rws.length, refs: rws.map(r => r.ref),
     values: inds.reduce((acc, m) => { acc[m] = aggValue(m, rws); return acc; }, {}),
     children: [], own: rws.length
```

`function sliceTable(res){` (~9662):

```diff
       '<td style="padding-left:'+(10 + (g.level - 1) * 26)+'px">'+
         (g.level > 1 ? '<span class="muted">└ </span>' : '')+
-        esc(g.parts[g.parts.length - 1] || g.key)+'</td>'+
+        esc(g.labels[g.labels.length - 1] || g.parts[g.parts.length - 1] || g.key)+'</td>'+
       (deep ? '<td class="num">'+(g.level < res.hier.depth ? g.own : '—')+'</td>' : '')+
       cell(g)+'</tr>'+(g.children || []).map(line).join('');
```

`function tilesBlock(){` (~9851):

```diff
     const r = ST.callSeam(t.module, 'statSlice', t.q);
     if(!r.ok) return '<div class="card"><h3>'+esc(t.title)+'</h3><div class="banner danger">'+esc(r.why)+'</div></div>';
-    const lines = r.groups.map(g => '<div class="row"><span class="k">'+esc(g.parts[g.parts.length-1] || g.key || 'всего')+
+    const lines = r.groups.map(g => '<div class="row"><span class="k">'+esc(g.labels[g.labels.length-1] || g.parts[g.parts.length-1] || g.key || 'всего')+
       '</span>'+g.n+' · '+cellText(g.values[t.q.inds[1]])+'</div>').join('');
     /* Краткая форма паспорта — одна строка, и объявлена ПРОИЗВОДИТЕЛЕМ: сокращать
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 271/271 PASS` (проверено на копии).

- [ ] **Step 6: Мутация**

В `clsVal` версия берётся последняя, а не на дату
(`R.versions.filter(v => v.since <= day).slice(-1)[0]` → `R.versions.slice(-1)[0]`) →
`#285` RED (270/271). Проверено.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-18b — разрез значением: ключ и подпись на дату, порядок классификатора из версии"
```

| Переписан | Почему |
|---|---|
| `#3`, `#223`, `#280` | полей 11 → 12 (`lbls`); у легаси `lbls` пуст |
| `#31` | категория лежит кодом, подпись — в `lbls`; утверждение прежнее |

### Task 6c: З-18c — признак чужого объекта путём «таблица + ключ» (`ИС-57`, `ADR-0241` §8)

Спецификация §4 З-18, последняя треть (`СС-185`). Решение — `СС-198`. Правки — разностью по
функциям, как в Task 6b; `~N` — по снимку после З-18b.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `REGISTRY` — путь `d-cbptype` «Тип лица заёмщика» у кредита: `src:'путь'`,
    `via:{by:'d-binn', dim:'d-ptype'}`; `OBJECTS` — `obj-credit.dims` + `d-cbptype`;
  - `F_ROAD` и `missingOf`, `ST.colOf` — путь колонки не заводит;
  - `readDim` — путь в строке не лежит (`null`);
  - новые `viaIds`, `joinVia`, `viaTarget`, `storedDims`, `checkVia`; `ST.statSlice` — join строки
    соседа той же даты; `editionNote`; `checkInd`, `checkCatalog` — дверь пути; `viewJournal`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#1`, `#163`, `#181`, `#237`;
  блок З-18c (`#287`) перед отчётом.

**Interfaces:**
- Consumes: `ST.statSlice`, `rowsAsOf`, `readDim`, `DIM`, `REC`, `st.release.tables`, `applyScope`
  (появится в З-19 — здесь срез режет прежним охватом).
- Produces:
  - запись реестра вида «путь»: `src:'путь'`, `via:{by: разрез-ключ своего объекта, dim: разрез
    соседа}`; своей колонки нет, копии в строке нет (`СС-198`);
  - `joinVia(st, rows, ids, asOf)` — значение пути из строки соседа той же даты по ключу;
    `viaTarget(spec)` → `{table, cols, key}`; `checkVia(st, spec)` — путь с чужим ключом или с
    колонкой отбивается; `storedDims(o)` — разрезы, лежащие в строке;
  - реестр: записей 311 → 312, разрезов 82 → 83.

- [ ] **Step 1: Падающий сторож `#287`**

Перед `/* ---- отчёт ---- */`, после блока З-18b:

```js
/* ===== Волна 23 · З-18c — признак чужого объекта путём «таблица + ключ» (ИС-57, ADR-0241 §8,
   ADR-0206 §5). Признак заёмщика у кредита лежит в строке заёмщика; срез кредитов берёт его
   join-ом по ключу заёмщика на ту же дату среза, копии в строке кредита нет. ===== */
(() => {
  /* #287 — путь, а не копия. Срез кредитов «по типу лица заёмщика» на 21.08 группирует кредиты
     ровно так, как их группирует join строк кредита со строками заёмщиков той же даты; ни в
     одной хранимой строке кредита значения пути нет. Правка строки заёмщика одной даты
     сдвигает срез кредитов ровно этой даты: значение читается из строки соседа, а не из
     копии и не из вчерашней строки. Охват путь не режет: аналитик видит кредит КД-2023/210,
     а строку его заёмщика (ведущий куратор другой) — нет, и тип лица у кредита всё равно
     назван. Путь — своя запись со своим именем: признак заёмщика его собственной записью у
     кредита по-прежнему не спрашивается (ИС-40), а у пути нет колонки в таблице кредита.
     Дверь реестра заводит путь без релиза — колонки у него нет, ждать нечего, — и отбивает
     путь с чужим ключом и путь, назвавший свою колонку. */
  const ASK287 = ASK, PREV287 = '2026-08-20';
  const cmp287 = v => ({sets:[{cmps:[{kind:'dim', id:'d-cbptype', op:'∈', values:[v]}]}]});
  const byKey287 = s => s.ok ? s.groups.map(g => g.key + ':' + g.n).join(', ') : 'отказ: ' + s.why;
  const join287 = d => {
    const b = new Map(ST.rowsAt('obj-borrower', d).map(r => [r.ref, r.dims['d-ptype']]));
    const out = {};
    ST.rowsAt('obj-credit', d).forEach(r => { const k = b.get(r.dims['d-binn']); const kk = k == null ? '—' : k; out[kk] = (out[kk] || 0) + 1; });
    return Object.keys(out).sort((a, c) => a.localeCompare(c, 'ru', {numeric:true})).map(k => k + ':' + out[k]).join(', ');
  };
  const q287 = d => ({obj:'obj-credit', dims:['d-cbptype'], inds:['a-count'], date: d});
  ST.seed();
  const s0 = ST.statSlice(q287(ASK287));
  const j0 = join287(ASK287);
  const fl = ST.statSlice(Object.assign(q287(ASK287), {dims:[], filter: cmp287('физическое лицо')}));
  const copy0 = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.dims['d-cbptype'] !== undefined).length;
  const col287 = ST.colOf('d-cbptype');
  const credT = ST.release().tables['obj-credit'];
  const own287 = ST.statSlice({obj:'obj-credit', dims:['d-ptype'], inds:['a-count'], date: ASK287});
  const back287 = ST.statSlice({obj:'obj-borrower', dims:['d-cbptype'], inds:['a-count'], date: ASK287});
  /* Правка строки заёмщика 10510198203112 на 21.08 — только этой даты. */
  const br287 = ST.state.rows.find(r => r.obj === 'obj-borrower' && r.ref === '10510198203112' && r.date === ASK287);
  const was287 = br287 ? br287.dims['d-ptype'] : null;
  if(br287) br287.dims['d-ptype'] = 'юридическое лицо';
  const s1 = ST.statSlice(q287(ASK287));
  const p1 = ST.statSlice(q287(PREV287));
  const pj = join287(PREV287);
  if(br287) br287.dims['d-ptype'] = was287;
  /* Охват: аналитик (куратор Бекова Н.) видит КД-2023/210, а строку его заёмщика — нет. */
  ST.state.role = 'Аналитик';
  const sa = ST.statSlice(q287(ASK287));
  const bSeen = ST.statSlice({obj:'obj-borrower', dims:[], inds:['a-count'], date: ASK287});
  const b210 = ST.applyScope(ST.rowsAt('obj-borrower', ASK287), 'obj-borrower').some(r => r.ref === '22903197505433');
  ST.state.role = 'Администратор статистики';
  const copy1 = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.dims['d-cbptype'] !== undefined).length;
  const vBy = ST.addDim({dates:1, id:'d-v1', name:'Проба пути чужим ключом', obj:'obj-credit', src:'путь',
    via:{by:'d-lcurator', dim:'d-bform'}, owner:'Заёмщики'});
  const vCol = ST.addDim({dates:1, id:'d-v2', name:'Проба пути с колонкой', obj:'obj-credit', src:'путь',
    via:{by:'d-binn', dim:'d-bform'}, owner:'Заёмщики', col:'d_form', vtype:'ref'});
  const vOk = ST.addDim({dates:1, id:'d-v3', name:'Организационно-правовая форма заёмщика', obj:'obj-credit', src:'путь',
    via:{by:'d-binn', dim:'d-bform'}, owner:'Заёмщики'});
  const vSt = vOk.ok ? ST.colOf('d-v3') : null;
  ST.seed();
  ok(287, s0.ok && byKey287(s0) === j0 && j0 === 'индивидуальный предприниматель:1, физическое лицо:3, юридическое лицо:4' &&
        fl.ok && fl.total['a-count'].v === 3 &&
        copy0 === 0 && copy1 === 0 && !!col287 && col287.state === 'путь' && col287.table === 'stat_row_borrower' &&
        col287.cols.join() === 'd_ptype' && col287.key === 'd_borrower_id' && credT.cols.indexOf('d_ptype') < 0 &&
        !own287.ok && has(own287.why, 'ИС-40') && !back287.ok &&
        s1.ok && byKey287(s1) === 'физическое лицо:3, юридическое лицо:5' &&
        p1.ok && byKey287(p1) === pj && pj === 'индивидуальный предприниматель:1, физическое лицо:3, юридическое лицо:4' &&
        sa.ok && byKey287(sa) === 'индивидуальный предприниматель:1, физическое лицо:1, юридическое лицо:3' &&
        bSeen.ok && !b210 &&
        !vBy.ok && has(vBy.why, 'ключ связи') && !vCol.ok && has(vCol.why, 'нет своей колонки') &&
        vOk.ok && !vOk.waiting && !!vSt && vSt.state === 'путь' && vSt.cols.join() === 'd_form_id,d_form_lbl',
    `признак заёмщика у кредита — путём «таблица + ключ», а не копией: срез кредитов по «${ST.REC('d-cbptype').name}» на ${ASK287} — ${byKey287(s0)}, join строк кредита со строками заёмщиков той же даты — ${j0}; фильтр «физическое лицо» — ${fl.ok ? fl.total['a-count'].v : '—'}. Значения пути в хранимых строках кредита ${copy0} до среза и ${copy1} после; колонки у пути своей нет — он читает ${col287 ? col287.table + '.' + col287.cols.join() : '—'} по ключу ${col287 ? col287.key : '—'}. Строка заёмщика 10510198203112 на ${ASK287} переправлена «${was287 || '—'}» → «юридическое лицо»: срез этой даты — ${byKey287(s1)}, срез ${PREV287} прежний — ${byKey287(p1)}. Охват путь не режет: аналитику строка заёмщика КД-2023/210 ${b210 ? 'видна' : 'не видна'}, а срез его кредитов — ${byKey287(sa)}. Собственная запись заёмщика у кредита не спрашивается: «${String(own287.why).slice(0, 60)}…». Дверь реестра: путь «${vOk.ok ? 'Организационно-правовая форма заёмщика' : '—'}» заведён ${vOk.waiting ? 'в ожидание' : 'сразу'} (${vSt ? vSt.table + '.' + vSt.cols.join('/') : '—'}), путь с чужим ключом — «${String(vBy.why).slice(0, 50)}…», с колонкой — «${String(vCol.why).slice(0, 50)}…» (ИС-57, ADR-0241 §8, ADR-0206 §5, СС-198)`);
})();
```

- [ ] **Step 2: Шапка и переписанные сторожа**

`шапка` (~114):

```diff
 // дату в `lbls`; переименование прошлую строку не меняет; классификатор — код, подпись, порядок
 // из версии без релиза; подразделение — два уровня на дату.
+// блок волны 23 З-18c — признак чужого объекта путём «таблица + ключ» (ИС-57, ADR-0241 §8): тип
+// лица заёмщика у кредита — join строки кредита со строкой заёмщика той же даты, копии в строке
+// кредита нет, охват путь не режет.
 // Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
 // render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
```

`сторож #1` (~218):

```diff
      представитель пары «мера × цель» `d-mprimary` (СС-175, СС-176): без него итог сумм меры о
      двух целях считался бы дважды (ИС-55, схема §11.2). */
+  /* Волна 23, З-18c (переписан на месте): разрезов 82 → 83, записей 311 → 312 — у кредита заведён
+     путь «Тип лица заёмщика» `d-cbptype` (СС-198): признак заёмщика у кредита читается join-ом,
+     а не копией, и путь — своя запись со своим именем (ИС-57, ADR-0241 §8, ADR-0206 §1). */
   const own1 = st.indicators.filter(i => !i.somOf), twin1 = st.indicators.filter(i => i.somOf);
   ok(1, st.objects.length === 10 && st.indicators.length === 229 && own1.length === 155 &&
        twin1.length === 74 && twin1.every(t => !!ST.IND(t.somOf)) &&
-       st.dims.length === 82 && ST.registry().length === 311 && badSrc.length === 0 &&
+       st.dims.length === 83 && ST.registry().length === 312 && badSrc.length === 0 &&
        formula.length === 0 && badFn.length === 0,
     `объектов ${st.objects.length}, показателей ${st.indicators.length} — ${own1.length} своих и ${twin1.length} сомовых сторон, и у каждой стороны валютная запись на месте; разрезов ${st.dims.length}, всего записей реестра ${ST.registry().length}. Счёт назван точным числом, а не «не меньше 85»: неравенство пережило бы молча потерю сотни записей, а потеря близнеца — это денежная величина, которую нельзя сложить по портфелю. Без объявленного источника ${badSrc.length}, с формулой ${formula.length} (сомовая сторона — не формула, а вторая колонка той же величины), с функцией вне списка ${badFn.length} — ИС-6, ИС-7, ИС-44`);
```

`сторож #163` (~3015):

```diff
   ST.seed();
   const rel0 = ST.release(), relJ0 = JSON.stringify(rel0);
-  const live0 = ST.state.registry.filter(r => r.src !== 'агрегат');
+  /* Волна 23, З-18c (переписан на месте): путь «таблица + ключ» — как агрегат, запись без своей
+     колонки: он читает колонку соседа по ключу (СС-198), и его колонки сверяет #287. */
+  const live0 = ST.state.registry.filter(r => r.src !== 'агрегат' && r.src !== 'путь');
   const inRel = (obj, c) => !!rel0.tables[obj] && rel0.tables[obj].cols.indexOf(c) >= 0;
   const unnamed = live0.filter(r => !ST.physOf(r.id).length);
```

`сторож #181` (~3720):

```diff
      193 → 194 — представитель меры `d_primary` (СС-175, СС-176) заведён вместе с колонкой
      релиза (схема §11.2). Агрегатов по-прежнему 117. */
-  ok(181, st.registry.length === 311 && nInd === 229 && nDim === 82 &&
+  /* Волна 23, З-18c (переписан на месте): записей 311 → 312, разрезов 82 → 83 — путь «Тип лица
+     заёмщика» `d-cbptype` (СС-198). Своей колонки у него нет, как у агрегата: записи с колонками,
+     агрегаты и пути вместе дают весь реестр. */
+  const pathN = st.registry.filter(r => r.src === 'путь').length;
+  ok(181, st.registry.length === 312 && nInd === 229 && nDim === 83 && pathN === 1 &&
         ownInd === 155 && somInd === 74 && somInd === 37 * 2 && !ST.REC('d-ocur') &&
         newDims.every(d => d && /валют/i.test(d.name) && ST.OBJ(d.obj).dims.indexOf(d.id) >= 0) &&
         newDims.map(d => d.obj).join(',') === 'obj-claim,obj-measure' &&
-        withCols === 194 && aggN === 117 && withCols + aggN === st.registry.length &&
+        withCols === 194 && aggN === 117 && withCols + aggN + pathN === st.registry.length &&
         somCols === 37 && ST.awaiting().length === 0,
     `реестр сверен со схемой, и число названо по факту, а не смягчено: ${st.registry.length} записей — ${nInd} породы «показатель» (${ownInd} своих и ${somInd} сомовых близнецов: ${somInd / 2} строчных и столько же агрегатов) и ${nDim} породы «разрез». Реестр сверен и с релизом: строчных записей с колонками ${withCols} (сомовых близнецов из них ${somCols}), агрегатов без колонки ${aggN}, ждущих колонку ${ST.awaiting().length} (ИС-53, ADR-0237 §3, §5). Своих разрезов валюты у объектов, заведённых волной 17, осталось два — ${newDims.map(d => d ? '«' + d.name + '» у ' + ST.OBJ(d.obj).name : '—').join(', ')}: разрез валюты дела снят вместе с валютой дела (${ST.REC('d-ocur') ? 'ОСТАЛСЯ' : 'снят'}), итоги дела только в сомах (ADR-0244 §4, ADR-0240 §4; ИС-40, ИС-44, ADR-0214 §1, ADR-0206 §3)`);
```

`сторож #237 · блок «Волна 23 — макет и сторожа догоняют физическую схему (ИС-53…»` (~5548):

```diff
   /* #237 — каждая действующая запись ложится в колонки релиза своего объекта. Агрегату
      колонка не нужна — он считается при чтении (ADR-0237 §5). */
-  const recs = ST.state.registry.filter(r => r.src !== 'агрегат' && !r.until);
+  /* Волна 23, З-18c (переписан на месте): путь «таблица + ключ» колонки не заводит — он читает
+     колонку соседа по ключу (СС-198), и его колонки сверяет #287. */
+  const recs = ST.state.registry.filter(r => r.src !== 'агрегат' && r.src !== 'путь' && !r.until);
   const physOf = id => (typeof ST.physOf === 'function' ? ST.physOf(id) : []);
   const unmapped = recs.filter(r => !physOf(r.id).length).map(r => r.id);
```

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL `#1`, `#181`, `#287` — записи пути нет (`#163`, `#237` зелёные: фильтр по
`'путь'` пока ничего не отсекает).

- [ ] **Step 4: Движок**

`const REGISTRY = [` (~1583):

```diff
   {kind:'разрез', id:'d-binn', col:'d_borrower', vtype:'ref', obj:'obj-credit', name:'Заёмщик', src:'поле', key:'inn', since:'2020-01-01',
    owner:'Заёмщики', note:'им же сверяется свод портфеля с суммой одиночных (ADR-0184 §1)'},
+  /* ПРИЗНАК ЗАЁМЩИКА У КРЕДИТА — ПУТЁМ «ТАБЛИЦА + КЛЮЧ», А НЕ КОПИЕЙ (ИС-57, ADR-0241 §8,
+     ADR-0206 §5, СС-198). Своей колонки у записи нет: значение лежит в строке заёмщика, и срез
+     кредитов берёт его join-ом `stat_row_credit.d_borrower → stat_row_borrower` на ту же дату
+     среза. Копия в строке кредита — второй путь к тому же признаку: разъехалась бы со строкой
+     заёмщика при первом его событии (E2E-09 в разрезной форме). Запись своя, со своим именем, а
+     не «тип лица», спрошенный у кредита: объект определения виден из имени (ADR-0206 §1). */
+  {kind:'разрез', id:'d-cbptype', obj:'obj-credit', name:'Тип лица заёмщика', src:'путь',
+   via:{by:'d-binn', dim:'d-ptype'}, since:'2020-01-01', owner:'Заёмщики',
+   note:'join по ключу заёмщика на дату среза; охватом не режется (ADR-0241 «Границы», ADR-0243)'},
   /* Вид кредита и основание выдачи — СВОИ у кредита, а не только условие его программы:
      у программы видов набор (`d_kind_ids`), у кредита вид один, и срез «по виду» кредитов
```

`const OBJECTS = [` (~2263):

```diff
    born:{src:'поле', key:'cdate'}, scope:{dim:'d-curator'},
    dims:['d-branch','d-curator','d-category','d-odays','d-industry','d-cur','d-status','d-region',
-         'd-cdate','d-line','d-program','d-binn','d-covstate','d-covreq',
+         'd-cdate','d-line','d-program','d-binn','d-cbptype','d-covstate','d-covreq',
          'd-kind','d-decision','d-rf-evade','d-rf-nomon'],
    inds:['m-total','m-over','m-curr',
```

`const F_ROAD = ['src','seam','field','key'];` (~3899):

```diff
    формулы у неё нет, есть АДРЕС происхождения, и по нему сторож перемножает колонки. */
 const F_IND  = ['type','unit','money','flow','fn','over','live','dedupBy','roll','rollBy','somOf','round'];
-const F_DIM  = ['levels','buckets','edges','ref','owner','perObject','basis','order'];
+const F_DIM  = ['levels','buckets','edges','ref','owner','perObject','basis','order','via'];
 const FIELDS = {};
 FIELDS[KIND.IND] = F_COMMON.concat(F_ROAD, F_IND);
```

`function missingOf(st, objId, recs){` (~4077):

```diff
   const need = c => { if((!t || t.cols.indexOf(c) < 0) && out.indexOf(c) < 0) out.push(c); };
   recs.forEach(r => {
+    /* Путь колонки не заводит: он читает колонку соседа по своему ключу — ждёт он их (СС-198). */
+    if(r.via){
+      const T = st.registry.find(x => x.id === r.via.dim), K = st.registry.find(x => x.id === r.via.by);
+      if(!T || !K){ out.push('путь «'+r.name+'»: записи '+(T ? r.via.by : r.via.dim)+' в реестре нет'); return; }
+      missingOf(st, T.obj, [T]).concat(missingOf(st, K.obj, [K])).forEach(m => out.push('путь: '+m));
+      return;
+    }
     if(r.src === 'агрегат'){
       const b = r.over && st.registry.find(x => x.id === r.over);
```

`ST.colOf = id => { const r = REC(id); if(!r) return null;` (~4161):

```diff
   const waits = ST.state.awaiting.indexOf(id) >= 0;
   if(r.src === 'агрегат') return {table: null, cols: [], state: waits ? 'ждёт колонку' : 'агрегат'};
+  if(r.via){ const T = REC(r.via.dim), K = REC(r.via.by);
+    return {table: (ST.state.release.tables[T.obj] || {}).table || null, cols: physOf(T), key: physOf(K)[0],
+            state: waits ? 'ждёт колонку' : 'путь'}; }
   return {table: (ST.state.release.tables[r.obj] || {}).table || null, cols: physOf(r),
           state: waits ? 'ждёт колонку' : r.until ? 'прекращена' : 'включена'}; };
```

`function readDim(dimId, item, dateISO, ask){` (~4256):

```diff
   if(!d) return null;
   if(d.since > dateISO) return null;                       /* разрез действует вперёд */
+  /* Путь в строке не лежит: его значение — в строке соседа, и берёт его срез join-ом (СС-198).
+     Прочитай его здесь — и в строке объекта легла бы копия признака соседа. */
+  if(d.via) return null;
   return d.levels ? readPath(d, item, dateISO, ask) : readSrc(d, item, dateISO, ask, d.id);
 }
```

`function editionNote(st, objId, res, rows, inds, dims){` (~7570):

```diff
         ' — отсутствующее пришло ОТСУТСТВУЮЩИМ, а не нулём и не вчерашним (ADR-0207 §2)' : '')+
       (all && o ? '. Форма легаси собирала '+(form.dims.length + form.inds.length)+
-        ' величин из '+(o.dims.length + o.inds.length)+', объявленных объектом сегодня: '+
+        ' величин из '+(storedDims(o).length + o.inds.length)+', объявленных объектом сегодня: '+
         'остальные ОТСУТСТВУЮТ КЛЮЧОМ, а не лежат нулём (ADR-0207 §2)' : ''));
   }
```

`ST.statSlice = q => {` (~7900):

```diff
 
 /* Сколько и на сколько, в таком-то разрезе, на такую-то дату. */
+/* ПУТЬ «ТАБЛИЦА + КЛЮЧ» ПРИ ЧТЕНИИ (ИС-57, ADR-0241 §8, СС-198). Признак соседа в строке
+   объекта не лежит: срез берёт его из строки соседа на ТУ ЖЕ дату среза по ключу связи — join
+   `stat_row_credit.d_borrower → stat_row_borrower`. Охватом путь не режется: у кредита виден
+   признак его заёмщика, даже если строка заёмщика спрашивающему не видна (ADR-0241 «Границы»,
+   ADR-0243). Хранимые строки не меняются: срез получает их копии с приложенным значением и
+   подписью соседа. Нет у соседа строки на дату — нет и значения: группа «—», а не вчерашнее. */
+function viaIds(q){
+  const ids = (q.dims || []).slice();
+  ((q.filter && q.filter.sets) || []).forEach(s => (s.cmps || []).forEach(c => { if(c.kind !== 'ind') ids.push(c.id); }));
+  return ids.filter((id, i) => ids.indexOf(id) === i && DIM(id) && DIM(id).via);
+}
+function joinVia(st, rows, ids, asOf){
+  if(!ids.length) return rows;
+  const idx = {};
+  ids.forEach(id => {
+    const T = viaTarget(DIM(id)).dim;
+    if(idx[T.obj]) return;
+    idx[T.obj] = new Map(rowsAsOf(st, T.obj, asOf).map(r => [r.ref, r]));
+  });
+  return rows.map(r => {
+    const x = Object.assign({}, r, {dims: Object.assign({}, r.dims), lbls: Object.assign({}, r.lbls || {})});
+    ids.forEach(id => {
+      const D = DIM(id), T = viaTarget(D).dim, key = r.dims[D.via.by];
+      const nb = key == null ? null : idx[T.obj].get(key);
+      if(!nb || nb.dims[T.id] == null) return;
+      x.dims[id] = nb.dims[T.id];
+      if(nb.lbls && nb.lbls[T.id] != null) x.lbls[id] = nb.lbls[T.id];
+    });
+    return x;
+  });
+}
 ST.statSlice = q => {
   const st = ST.state;
```

`ST.statSlice = q => {` (~7908):

```diff
   let rows = rowsAsOf(st, q.obj, res.asOf);
   rows = applyScope(rows, q.obj);                            /* ДО группировки — ИС-13 */
+  rows = joinVia(st, rows, viaIds(q), res.asOf);             /* путь — после охвата, им не режется */
   const badF = checkFilterDomain(q.filter, rows);            /* отказ ДО счёта — ADR-0180 §8 */
   if(badF) return {ok:false, why: badF};
```

`function checkInd(st, spec){` (~8741):

```diff
 }
 
+/* --- путь «таблица + ключ» (ИС-57, ADR-0241 §8, СС-198) ---
+   Путь называет КЛЮЧ СВЯЗИ — свой разрез-ссылку объекта — и ПРИЗНАК СОСЕДА — разрез того
+   объекта, на чью строку ключ указывает. Колонки у пути нет, уровней и корзин тоже: он
+   читает значение соседа как есть. Одноимённость, объект определения и владелец — те же, что
+   у любого разреза. */
+function viaTarget(spec){
+  const v = spec && spec.via;
+  return v ? {key: DIM(v.by), dim: DIM(v.dim)} : null;
+}
+/* Разрезы, которые лежат в строке объекта: путь в составе объекта — объект его спрашивает, —
+   но в строке его нет, и в счёт величин строки он не входит. */
+function storedDims(o){ return o.dims.filter(id => !(DIM(id) || {}).via); }
+function checkVia(st, spec){
+  const t = viaTarget(spec);
+  if(!t) return 'у разреза-пути объявляются ключ связи и признак соседа: via {by, dim} (ИС-57, ADR-0241 §8)';
+  if(!t.key || t.key.obj !== spec.obj || t.key.vtype !== 'ref')
+    return 'ключ связи пути — свой разрез-ссылка объекта «'+spec.obj+'»: «'+spec.via.by+'» им не является (ИС-57, ADR-0241 §8)';
+  if(!t.dim || t.dim.obj === spec.obj || t.dim.via)
+    return 'признак пути — разрез СОСЕДНЕГО объекта со своей колонкой: «'+spec.via.dim+'» им не является (ИС-57, ADR-0241 §8)';
+  if(t.dim.levels || t.dim.buckets)
+    return 'путь читает значение соседа как есть: уровней и корзин у него нет (ИС-57, ADR-0241 §8)';
+  if(spec.col || spec.levels || spec.buckets)
+    return 'у пути нет своей колонки: значение лежит в строке соседа, копия была бы вторым путём (ИС-57, ADR-0241 §8)';
+  const taken = nameTaken(st, spec, KIND.DIM);
+  if(taken) return taken;
+  return null;
+}
+
 /* --- реквизиты породы «разрез» (ADR-0209 §3) --- */
 function checkDim(st, spec){
-  if(['история','поле','шов'].indexOf(spec.src) < 0) return 'разрез объявляет источник: история · поле · шов';
+  if(spec.src === 'путь') return checkVia(st, spec);
+  if(spec.via) return 'путь «таблица + ключ» объявляется у разреза с источником «путь»: у записи со своей '+
+    'колонкой второго пути к значению не бывает (ИС-57, ADR-0241 §8)';
+  if(['история','поле','шов'].indexOf(spec.src) < 0) return 'разрез объявляет источник: история · поле · шов · путь';
   /* Единственный вопрос владельцу реестра — и он задаётся ЗДЕСЬ, при заведении, а не
      при разборе странного числа (ADR-0179 §2). */
```

`function checkCatalog(spec){` (~8876):

```diff
     return null;
   }
+  /* Путь колонки не называет: он читает колонку соседа по ключу, и её сверяет дверь пути (СС-198). */
+  if(spec.src === 'путь') return null;
   if(spec.levels){
     for(const L of spec.levels){
```

`function viewJournal(){` (~10201):

```diff
       const o = OBJ(objId), f = leg.form[objId], all = f.dims.concat(f.inds);
       return '<li><b>'+esc((o || {name: objId}).name)+'</b> — форма легаси собирала <b>'+
-        all.length+'</b> величин из <b>'+(o ? o.dims.length + o.inds.length : '?')+
+        all.length+'</b> величин из <b>'+(o ? storedDims(o).length + o.inds.length : '?')+
         '</b>, объявленных объектом сегодня: '+
         all.map(id => '«'+esc((REC(id) || {}).name || id)+'»').join(', ')+
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 272/272 PASS` (проверено на копии).

- [ ] **Step 6: Мутация**

`readDim` читает путь сам и кладёт копию в строку кредита (`if(d.via) return null;` → чтение
`readDim(d.via.by, …)` и значения соседа) → `#287` RED (271/272). Проверено.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-18c — признак чужого объекта путём «таблица + ключ»"
```

| Переписан | Почему |
|---|---|
| `#1`, `#181` | записей 311 → 312, разрезов 82 → 83; путь — третий вид записи без колонки |
| `#163`, `#237` | путь колонки не заводит — из выборки «записи с колонками» исключён |

### Task 7: З-19 — охват правилами own · via · open (`ИС-58`, `ADR-0243` §1–§5)

Спецификация §4 З-19. Решение — `СС-199`. Правки — разностью по функциям, как в Task 6b;
`~N` — по снимку после З-18c. Задача снимает сторожей `#132`…`#136` (проверено по снимку:
все пять живы до З-19 и держат форму «охват — одно из трёх состояний») — на их месте
надгробия со ссылкой на преемников.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `OBJECTS` — `scope` у каждого объекта списком правил: `own` (свой разрез куратора), `via`
    (правило через объект-владелец по ключу), `open` (общий, с причиной); `REGISTRY` — у
    записей, что держали охват состоянием, реквизит снят;
  - новые `scopeShapeBad`, `scopeErrors`, `seesItem`, `scopeTest`, `applyScope`, `ruleText`;
    `ST.scopeErrors`, `ST.scopeShapeBad`, `ST.applyScope`;
  - `seed` — объект без правила или правило без вида валят загрузку;
  - `checkQuery` — ворот «не спрашивается» нет; `rowsFor`, `ST.statSlice`, `ST.statSeries`,
    `ST.flowBetween`, `ST.registryList`, `ST.workList`, `ST.operandValues` — строки режутся
    `applyScope`; `passportFor`, `editionNote` — строка охвата в паспорте;
  - `ST.scopeOf`, `ST.curatorOf`, `ST.dateGate`, `ST.addObject`, `ST.addObjUI`, `ST.addCmp`, `CORE`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; надгробия `#132`…`#136`; переписка
  `#9`, `#117`, `#152`; блок З-19 (`#288`…`#291`) перед отчётом.

**Interfaces:**
- Consumes: `OBJECTS[].scope` (прежняя форма `{dim}`/`open`/`denied`), `DIM`, `rowsAsOf`,
  `ST.state.role`, `ST.state.scope`, `checkQuery`, `passportFor`.
- Produces:
  - `scope: [{kind:'own', dim}, {kind:'via', obj, key}, {kind:'open', reason}]`, правила
    объединяются ИЛИ (`СС-199`);
  - `scopeTest(st, rule, value, asOf)` — `via` прямой: ключ `r.dims[key]` или `part`; обратный —
    когда `DIM(key).obj === rule.obj`;
  - `applyScope(rows, objId, asOf)` → строки, видимые роли на дату; `ST.applyScope`;
  - `scopeErrors(objects, registry)` → список ошибок формы; непустой — загрузка валится;
  - паспорт: `scope` — текст правил (`ruleText`), `scoped` — резалось ли.

- [ ] **Step 1: Падающие сторожа `#288`…`#291`**

Перед `/* ---- отчёт ---- */`, после блока З-18c:

```js
/* ===== Волна 23 · З-19 — охват правилами (ИС-58, ADR-0243). Охват объекта — одно или несколько
   правил own · via · open, соединённых ИЛИ; объект без правила и правило без вида валят
   загрузку; общий объект печатает причину; via читает связанные строки на дату вопроса. ===== */
(() => {
  /* #288 — правила вместо состояний (ИС-58, ADR-0243 §1–§5, СС-199; преемник #132, #135, #136).
     У каждого объекта хотя бы одно правило, вид — из трёх; объект без правила, правило без
     вида, общий без причины и «через» с ключом, не ведущим к таблице, валят загрузку, а у
     двери объекта — отбиваются. Договор, поступление, программа — общие, и паспорт под ролью
     печатает причину, а краткая форма говорит «всего N». Состояния «не спрашивается» нет ни у
     одной двери: ворот охвата больше нет, охват — фильтр строк. */
  ST.seed();
  const st288 = ST.state;
  const kinds288 = {};
  st288.objects.forEach(o => (o.scope || []).forEach(r => { kinds288[r.kind] = (kinds288[r.kind] || []).concat(o.id); }));
  const errs288 = ST.scopeErrors();
  const OB288 = vm.runInContext('OBJECTS', sandbox);
  const case288 = OB288.find(o => o.id === 'obj-case'), keep288 = JSON.stringify(case288.scope);
  const load288 = sc => {
    case288.scope = sc;
    try { ST.seed(true); return null; } catch(e){ return String(e.message); }
    finally { case288.scope = JSON.parse(keep288); }
  };
  const noRule = load288([]), noKind = load288([{obj:'obj-claim', key:'d-clcase'}]),
        noWhy = load288([{kind:'open'}]), badKey = load288([{kind:'via', obj:'obj-claim', key:'d-curator'}]);
  ST.seed();
  const mig288 = ST.migrateTable({obj:'obj-guarantee', table:'stat_row_guarantee', storage:'state',
    cols:['object_id','slice_date','run_id','now_cols']});
  const G288 = sc => ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'}, scope: sc,
    dims:[], inds:['a-count']});
  const dNone = G288(undefined), dOpen = G288([{kind:'open'}]),
        dDen = G288({denied:{why:'куратора не отдают', road:'спросите другой объект'}});
  ST.seed();
  ST.setRole('Аналитик');
  const op288 = ['obj-zdeal','obj-program','obj-receipt'].map(id => {
    const s = ST.statSlice({obj:id, dims:[], inds:['a-count'], date: ASK});
    return {id, s, short: s.ok ? ST.passportShort(s.passport) : ''};
  });
  const zRows = ST.statRows({obj:'obj-zdeal', date: ASK});
  const rWork = ST.workList('obj-receipt');
  const rSer = ST.statSeries({obj:'obj-receipt', inds:'a-sumrsum', dates:['2026-08-01', ASK]});
  ST.setRole('Администратор статистики');
  ok(288, errs288.length === 0 && st288.objects.every(o => Array.isArray(o.scope) && o.scope.length >= 1) &&
        (kinds288.own || []).join() === 'obj-credit,obj-borrower,obj-collateral,obj-claim,obj-repay,obj-measure' &&
        (kinds288.via || []).join() === 'obj-case,obj-measure' &&
        (kinds288.open || []).join() === 'obj-zdeal,obj-program,obj-receipt' &&
        has(noRule, 'правил охвата нет') && has(noKind, 'без вида') && has(noWhy, 'причина не названа') &&
        has(badKey, 'ключ связи') &&
        mig288.ok && !dNone.ok && has(dNone.why, 'правил охвата нет') && !dOpen.ok && has(dOpen.why, 'причина не названа') &&
        !dDen.ok && has(dDen.why, 'ИС-58') &&
        op288.every(x => x.s.ok && x.s.passport.scoped === false && has(x.s.passport.scope, '(ИС-58)') &&
                         has(x.short, 'всего ' + x.s.n)) &&
        has(op288[0].s.passport.scope, 'решение пользователя 17.09.2026') &&
        has(op288[2].s.passport.scope, 'решение пользователя 17.09.2026') &&
        has(op288[1].s.passport.scope, 'общее знание') &&
        zRows.ok && zRows.rows.length === op288[0].s.n && rWork.ok && rWork.n === op288[2].s.n && rSer.ok &&
        typeof ST.scopeGate === 'undefined',
    `охват — правила, соединённые ИЛИ (ИС-58): у каждого из ${st288.objects.length} объектов правило есть, ошибок сверки правил с реестром ${errs288.length}; своей колонкой режутся ${(kinds288.own || []).length} (${(kinds288.own || []).join(', ')}), через другую таблицу ${(kinds288.via || []).length} (${(kinds288.via || []).join(', ')}), общие ${(kinds288.open || []).length} (${(kinds288.open || []).join(', ')}). Загрузка валится: без правила — «${String(noRule).slice(0, 60)}…», без вида — «${String(noKind).slice(0, 60)}…», общий без причины — «${String(noWhy).slice(0, 60)}…», ключ не к той таблице — «${String(badKey).slice(0, 60)}…»; дверь объекта отбивает то же («${String(dNone.why).slice(0, 60)}…»), и прежнее состояние «отказ» ей не форма. Под ролью аналитика общие отвечают с причиной: ${op288.map(x => x.id + ' — ' + (x.s.ok ? x.s.n + ', «' + x.short + '»' : x.s.why)).join('; ')}; строки договоров ${zRows.ok ? zRows.rows.length : '—'}, список поступлений ${rWork.ok ? rWork.n : '—'}, ряд поступлений ${rSer.ok ? 'отвечает' : '—'} — «не спрашивается» нет ни у одной двери (ADR-0243 §4, §5, СС-199)`);

  /* #289 — own: своя колонка, тот же читатель у среза и у реестра владельца (преемник #133,
     #134). Заёмщик режется ведущим куратором — вычисляемым швом, а не историей; срез и реестр
     владельца сходятся у всех объектов с правилами, кроме общих. */
  ST.seed();
  const st289 = ST.state;
  ST.setRole('Аналитик');
  const bAll = ST.rowsAsOf('obj-borrower', ASK);
  const bRows = ST.statRows({obj:'obj-borrower', date: ASK});
  const bReg = ST.registryList('obj-borrower', st289.today, null);
  const lead = ST.DIM('d-lcurator');
  const W289 = vm.runInContext('WORLD', sandbox);
  const noHist289 = (W289['obj-borrower'] || []).filter(i => i.h && i.h.curator).length;
  const pairs289 = st289.objects.filter(o => !o.scope.some(r => r.kind === 'open')).map(o => ({
    id: o.id, slice: (ST.statRows({obj:o.id, date: ASK}).rows || []).length,
    reg: ST.registryList(o.id, st289.today, null).length}));
  const drift289 = pairs289.filter(x => x.slice !== x.reg);
  ST.setRole('Администратор статистики');
  ok(289, bAll.length === 8 && bRows.ok && bRows.rows.length === 3 && bReg.length === 3 &&
        has(bRows.passport.scope, 'ведущий куратор') && bRows.passport.scoped === true &&
        lead.src === 'шов' && lead.seam === 'leadCurator' && noHist289 === 0 &&
        pairs289.length === 7 && drift289.length === 0,
    `own — своя колонка строки: заёмщиков на ${ASK} ${bAll.length}, аналитику видно ${bRows.ok ? bRows.rows.length : '—'} по ведущему куратору — «${bRows.ok ? bRows.passport.scope : '—'}»; реестр владельца отдаёт тех же ${bReg.length}. Ведущий куратор — шов «${lead.seam}», истории «curator» у заёмщика нет ни в одной записи мира (${noHist289}), и охват читается тем же читателем, что разрез. Срез и реестр владельца сходятся у всех ${pairs289.length} объектов с правилами own и via, расхождений ${drift289.length}${drift289.length ? ' (' + drift289.map(x => x.id + ' ' + x.slice + '/' + x.reg).join(', ') + ')' : ''} (ИС-14, ИС-18, ИС-58)`);

  /* #290, #291 — via на дату вопроса и ИЛИ у меры. Требование ТВ-2025/11-1 с 20.08 передано
     Бековой, ТВ-2026/03-1 — от неё Осмонову. Дело видно, если видно хоть одно его требование
     в строке ТОЙ ЖЕ даты: ДВ-2025/11 видно в срезе 21.08 и не видно в срезе 20.08; ДВ-2026/03
     видно через оставшееся у Бековой ТВ-2026/03-3, и два его требования дают одно дело —
     счёт дел различный. Мера видна через требование-цель ИЛИ автору: меры по ТВ-2025/11-1
     пришли через цель, а меры Бековой по ТВ-2026/03-1 остались за ней как за автором после
     передачи требования. Охват режет до группировки: группы среза мер складываются в число
     видимых строк. */
  ST.seed();
  ST.setRole('Аналитик');
  const c290a = ST.statSlice({obj:'obj-case', dims:[], inds:['a-count'], date: ASK});
  const cl290 = (ST.statRows({obj:'obj-claim', date: ASK}).rows || []).filter(r => r.dims['d-clcase'] === 'ДВ-2026/03').length;
  const m290a = ST.statSlice({obj:'obj-measure', dims:['d-mkind'], inds:['a-count'], date: ASK});
  ST.setRole('Администратор статистики');
  const cq1 = W289['obj-claim'].find(x => x.id === 'ТВ-2025/11-1'), cq2 = W289['obj-claim'].find(x => x.id === 'ТВ-2026/03-1');
  const kq1 = JSON.stringify(cq1.h.curator), kq2 = JSON.stringify(cq2.h.curator);
  let c290 = null, c290p = null, cw290 = null, m291 = null, mw291 = null;
  try {
    cq1.h.curator = cq1.h.curator.concat([['2026-08-20', 'Бекова Н.']]);
    cq2.h.curator = cq2.h.curator.concat([['2026-08-20', 'Осмонов Т.']]);
    ST.seed();
    ST.setRole('Аналитик');
    c290 = ST.statSlice({obj:'obj-case', dims:[], inds:['a-count'], date: ASK});
    c290p = ST.statSlice({obj:'obj-case', dims:[], inds:['a-count'], date: '2026-08-20'});
    cw290 = ST.workList('obj-case');
    m291 = ST.statSlice({obj:'obj-measure', dims:['d-mkind'], inds:['a-count'], date: ASK});
    mw291 = ST.workList('obj-measure');
  } finally {
    ST.setRole('Администратор статистики');
    cq1.h.curator = JSON.parse(kq1); cq2.h.curator = JSON.parse(kq2);
  }
  ST.seed();
  const refs = s => s && s.ok ? s.groups.map(g => g.refs.join('+')).join('|') : '—';
  const grp = s => s && s.ok ? s.groups.map(g => g.key + ':' + g.n).join(', ') : '—';
  ok(290, c290a.ok && c290a.n === 1 && refs(c290a) === 'ДВ-2026/03' && cl290 === 2 &&
        c290.ok && c290.n === 2 && c290.total['a-count'].v === 2 && refs(c290) === 'ДВ-2026/03+ДВ-2025/11' &&
        c290p.ok && c290p.n === 1 && refs(c290p) === 'ДВ-2026/03' &&
        has(c290.passport.scope, 'через требования взыскания') && c290.passport.scoped === true &&
        cw290.ok && cw290.list.join() === 'ДВ-2025/11,ДВ-2026/03' && cw290.inSlice === 2,
    `дело — через свои требования на дату вопроса (ADR-0243 §3): аналитику видно ${c290a.ok ? c290a.n : '—'} дело (${refs(c290a)}) — у него ${cl290} видимых требования, и счёт дел различный. После передачи ТВ-2025/11-1 Бековой с 20.08 срез ${ASK} видит ${c290 && c290.ok ? c290.n : '—'} (${refs(c290)}), срез 2026-08-20 — ${c290p && c290p.ok ? c290p.n : '—'} (${refs(c290p)}): владелец требования для дела — тот, кто владеет им в строке той же даты. Паспорт: «${c290 && c290.ok ? c290.passport.scope : '—'}»; реестр владельца — ${cw290 && cw290.ok ? cw290.list.join(', ') : '—'} (ИС-58, СС-199)`);
  ok(291, m290a.ok && m290a.n === 2 && grp(m290a) === 'исковое заявление:1, претензия:1' &&
        m291.ok && m291.n === 4 && grp(m291) === 'исковое заявление:1, исполнительный лист:1, претензия:1, реализация залога:1' &&
        m291.groups.reduce((a, g) => a + g.n, 0) === m291.n &&
        m291.groups.some(g => g.refs.indexOf('МВ-2026/12') >= 0) && m291.groups.some(g => g.refs.indexOf('МВ-2025/44') >= 0) &&
        !m291.groups.some(g => g.refs.indexOf('МВ-2026/27') >= 0) &&
        has(m291.passport.scope, ' ИЛИ ') && has(m291.passport.scope, 'куратор меры взыскания — Бекова Н.') &&
        mw291.ok && mw291.n === 4 && mw291.inSlice === 4,
    `мера — через требование-цель ИЛИ автору (ADR-0243 §3): до передач аналитику видно ${m290a.ok ? m290a.n : '—'} (${grp(m290a)}), после — ${m291 && m291.ok ? m291.n : '—'} (${grp(m291)}): меры по ТВ-2025/11-1 пришли через цель, меры Бековой по ТВ-2026/03-1 остались за ней как за автором, а чужая претензия МВ-2026/27 не видна. Группы складываются в число видимых строк — охват резал до группировки. Паспорт: «${m291 && m291.ok ? m291.passport.scope : '—'}»; реестр владельца — ${mw291 && mw291.ok ? mw291.n : '—'}. Путь признаков охватом не режется — #287 (ИС-58, ADR-0241 §8, СС-199)`);
})();
```

- [ ] **Step 2: Шапка, надгробия, переписанные сторожа**

`шапка` (~12):

```diff
 // хвост отказывает и называет дорогу, дыра внутри истории подставляет с возрастом (ИС-12),
 // блок Ю — волна 15: закрытый СС-Д11 — охват ролей ОБЪЯВЛЕН реквизитом объекта, а не зашит
-// именем разреза (ИС-37, ADR-0203): режется своим разрезом · общий · отказ с дорогой,
+// именем разреза (ИС-37, ADR-0203); снят волной 23 (З-19) — надгробия #132…#136, охват держат
+// правила ИС-58 (#288…#291),
 // блок Я — волна 17: календарь учётных периодов — ОДИН общий справочник ниже всех слоёв
 // (ИС-38, ADR-0204): строка = период, в ней колонка-защёлка на слой со своим актором и
```

`шапка` (~117):

```diff
 // лица заёмщика у кредита — join строки кредита со строкой заёмщика той же даты, копии в строке
 // кредита нет, охват путь не режет.
+// блок волны 23 З-19 — охват правилами (ИС-58, ADR-0243): own · via · open через ИЛИ; объект без
+// правила и правило без вида валят загрузку; общий печатает причину; via — на дату вопроса.
 // Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
 // render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
```

`смоук` (~360):

```diff
   ST.seed();
   const before = ST.statSlice({obj:'obj-guarantee', dims:[], inds:['a-count'], date: ASK});
+  /* Волна 23, З-19 (переписан на месте): охват — правило, а не состояние (ИС-58, СС-199);
+     смысл прежний — поручительство режется своим куратором. */
   const G_OBJ = {id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
     owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
-    scope:{dim:'d-gcurator'}, dims:[], inds:['a-count']};
+    scope:[{kind:'own', dim:'d-gcurator'}], dims:[], inds:['a-count']};
   const noTable = ST.addObject(G_OBJ);
   const mig = ST.migrateTable({obj:'obj-guarantee', table:'stat_row_guarantee', storage:'state',
```

`сторож #117` (~1925):

```diff
   const role0 = st.role;
   ST.setRole('Аналитик');
-  const aR = ST.statRows({obj:'obj-receipt', date: D});
+  /* Волна 23, З-19 (переписан на месте): поступление больше не отвечает отказом — оно общее,
+     решение пользователя 17.09.2026 с названной ценой (ADR-0243 §4; «не спрашивается» снято,
+     §5). СС-Д11 остаётся закрытым: пустого экрана нет — ответ полный и с причиной. */
+  const aR = ST.statSlice({obj:'obj-receipt', dims:[], inds:['a-count'], date: D});
   const aP = ST.statRows({obj:'obj-repay', date: D});
   ST.setRole(role0);
-  ok(117, !aR.ok && has(aR.why, 'не спрашивается') && has(aR.why, 'многозначен') &&
-       has(aR.why, 'Платёж') && aP.ok && aP.rows.length === 9,
-    `СС-Д11 ЗАКРЫТ (волна 15): поступление отвечает ОТКАЗОМ с дорогой, а не пустым экраном — «${String(aR.why).slice(0, 96)}…». Куратор у сводного поступления на дату многозначен (см. #114), и объявленный охват объекта — «отказ», а не «режется d-curator»: показать 15 строк целиком нельзя (§9: объём чужой работы не выдаётся даже итогом), показать 0 — соврать. Дорога настоящая и уровнем ниже: платежей аналитику видно ${aP.rows.length} (ИС-37, ADR-0203)`);
+  ok(117, aR.ok && aR.n === 15 && aR.passport.scoped === false &&
+       has(aR.passport.scope, 'решение пользователя 17.09.2026') && aP.ok && aP.rows.length === 9,
+    `СС-Д11 закрыт иначе (волна 23): поступление под ролью ОБЩЕЕ — аналитику видно ${aR.ok ? aR.n : '—'}, и паспорт называет причину: «${aR.ok ? aR.passport.scope : aR.why}». Куратор у сводного поступления на дату многозначен (см. #114), и объём чужой работы виден итогом — цена названа и принята пользователем (ADR-0243 §4). Платежей аналитику видно ${aP.rows.length} — они режутся своим куратором (ИС-58, СС-199)`);
 
   const byId = {}; (W['obj-receipt'] || []).forEach(r => byId[r.id] = r);
```

`сторож #132` (~2203):

```diff
 })();
 
-/* ---------- Ю. Волна 15: охват объявлен объектом, а не зашит именем разреза ----------
-   СС-Д11 звучал как «объект БЕЗ разреза охвата», и три волны подряд его так и читали.
-   Волна 15 замерила и нашла четвёртый случай — противоположного рода: у ЗАЁМЩИКА разрез
-   охвата ЕСТЬ, он просто зовётся иначе («d-lcurator»: ведущий куратор ВЫЧИСЛЯЕТСЯ, ТЗ 16
-   §11). Зашитое в applyScope имя «d-curator» отдавало аналитику 0 строк из 8 при 3 своих,
-   а паспорт печатал «по 0 объектам, доступным вам» — не пустой экран, а НЕВЕРНЫЙ ответ,
-   заверенный как верный. Класс дефекта, значит, не «объект без разреза», а «охват прибит
-   к имени разреза»: ИС-37, ADR-0203.                                                    */
-(() => {
-  ST.seed();
-  const st = ST.state;
-  const role0 = st.role;
+/* ---------- Ю. Волна 15: охват объявлен объектом — снят волной 23 (З-19) ----------
+   Блок закрывал СС-Д11: охват прибит не к имени разреза, а объявлен реквизитом объекта с
+   тремя состояниями — режется разрезом · общий · отказ с дорогой (ИС-37, ADR-0203). ADR-0243
+   снял ИС-37: охват — одно или несколько правил own · via · open через ИЛИ (ИС-58), состояния
+   «не спрашивается» нет, договор и поступление общие по решению пользователя 17.09.2026. Урок
+   блока — охват читается тем же читателем, что разрез, и срез сходится с реестром владельца —
+   перенесён в #289. На месте каждого сторожа — надгробие; номера не переиспользуются. */
 
-  /* #132 — вход: реквизит обязателен у КАЖДОГО объекта, и состояний ровно три. Тот же
-     урок, что дал #128 (сирота реестра) и СС-Д14: чинится класс, а не случай. */
-  const bad = st.objects.filter(o => {
-    const s = o.scope;
-    if (!s) return true;
-    const kinds = ['dim','open','denied'].filter(k => s[k] != null);
-    if (kinds.length !== 1) return true;
-    if (s.dim) return !ST.DIM(s.dim) || o.dims.indexOf(s.dim) < 0;
-    if (s.denied) return !s.denied.why || !s.denied.road;
-    return typeof s.open !== 'string' || !s.open;
-  });
-  const byKind = k => st.objects.filter(o => o.scope && o.scope[k] != null);
-  const cut = byKind('dim'), open = byKind('open'), den = byKind('denied');
-  const dims = new Set(cut.map(o => o.scope.dim));
-  /* Волна 17: у каждого режущегося объекта разрез охвата теперь СВОЙ и определён НА НЁМ
-     же — «Куратор кредита» и «Куратор меры взыскания» суть разные признаки, и одно имя
-     «Куратор» на семь объектов означало бы, что охват семи объектов сложим (ИС-40). */
-  const alienScope = cut.filter(o => (ST.DIM(o.scope.dim) || {}).obj !== o.id);
-  /* Волна 23 (переписан на месте): режутся разрезом 7 → 6, общими 1 → 2 — у дела разреза
-     куратора больше нет (ADR-0243), и до правила `via` (З-19) оно объявлено общим. Заодно
-     исправлен давний изъян записи: перед текстом стояло `&&` вместо запятой, и пояснение
-     уходило в условие — сторож печатал пустую строку. */
-  ok(132, bad.length === 0 && cut.length + open.length + den.length === st.objects.length &&
-        cut.length === 6 && open.length === 2 && den.length === 2 && dims.size === 6 &&
-        alienScope.length === 0,
-    `охват — ОБЪЯВЛЕННЫЙ реквизит записи объекта, девятый после рождения (ИС-37): объектов без него или с двумя состояниями сразу ${bad.length} из ${st.objects.length}. Режутся разрезом ${cut.length}, объявлены общими ${open.length}, отвечают отказом ${den.length}. Разрезов охвата ШЕСТЬ — по одному на режущийся объект (${[...dims].join(', ')}), и каждый определён НА СВОЁМ объекте (чужих ${alienScope.length}). Ровно в этом был СС-Д11: имя разреза принадлежит ОБЪЕКТУ, а зашитое в движок «d-curator» молча пустило под нож всех, кто назвал свой охват иначе; одно имя «Куратор» на все объекты вдобавок заявляло бы, что их охваты между собой складываются (ИС-40, ADR-0206 §3). У отказа объявлены и причина, и дорога: отказ без дороги — половина ответа (§8.4)`);
+/* #132 — снят волной 23 (З-19): «охват — реквизит записи с ровно одним из трёх состояний
+   dim · open · denied» больше не часть модели (ИС-37 снят ИС-58, ADR-0243 §1, §5). Смысл
+   «охват объявлен у каждого объекта, необъявленный валит загрузку» держит #288. Номер не
+   переиспользуется. */
 
-  /* #133 — тот самый четвёртый случай, ради которого волна и случилась. */
-  ST.setRole('Аналитик');
-  const B = ST.OBJ('obj-borrower');
-  const bAll = ST.rowsAsOf('obj-borrower', ASK);
-  const mine = bAll.filter(r => r.dims['d-lcurator'] === 'Бекова Н.');
-  const bRows = ST.statRows({obj:'obj-borrower', date: ASK});
-  const bReg = ST.registryList('obj-borrower', st.today, null);
-  ok(133, B.scope.dim === 'd-lcurator' && bAll.length === 8 && mine.length === 3 &&
-        bRows.ok && bRows.rows.length === 3 && bReg.length === 3 &&
-        has(bRows.passport.scope, 'ведущий куратор') && bRows.passport.scoped === true,
-    `заёмщик режется СВОИМ разрезом — и до волны 15 не резался вовсе: строк на ${ASK} — ${bAll.length}, из них ведущим куратором Бековой ${mine.length}, а охват показывал 0. Это не «пустой экран вместо отказа», а НЕВЕРНЫЙ ответ: паспорт заверял «по 0 объектам, доступным вам» там, где доступны ${mine.length}. Теперь и срез, и реестр владельца дают ${bRows.rows.length}, а паспорт называет разрез поимённо: «${bRows.passport.scope}»`);
+/* #133 — снят волной 23 (З-19): «заёмщик режется своим разрезом d-lcurator» стоял на форме
+   `scope.dim`; правило own держит тот же случай — #289. Номер не переиспользуется. */
 
-  /* #134 — у охвата ОДИН читатель, тот же, что у разреза (ИС-18). registryList читал
-     «item.h.curator» напрямую: второй читатель, не знающий ни швов, ни полей. Поэтому
-     дорога, которую называет отказ, сама отвечала спрашивающему НОЛЬ. */
-  const seam = ST.DIM('d-lcurator');
-  const world = vm.runInContext('WORLD', sandbox);
-  const noHist = (world['obj-borrower'] || []).filter(i => i.h && i.h.curator).length;
-  const pairs = st.objects.filter(o => o.scope.dim).map(o => ({
-    o, slice: (ST.statRows({obj:o.id, date: ASK}).rows || []).length,
-    reg: ST.registryList(o.id, st.today, null).length}));
-  const drift = pairs.filter(x => x.slice !== x.reg);
-  /* Волна 23 (переписан на месте): режущихся объектов 7 → 6 — дело больше не режется своим
-     разрезом (ADR-0243; до З-19 оно общее). */
-  ok(134, seam.src === 'шов' && seam.seam === 'leadCurator' && noHist === 0 &&
-        drift.length === 0 && pairs.length === 6,
-    `охват читается ТЕМ ЖЕ читателем, что разрез (ИС-18, ИС-37): у «${seam.name}» источник — ${seam.src} «${seam.seam}», истории «curator» у заёмщика нет ни в одной записи мира (${noHist} из ${(world['obj-borrower'] || []).length}), и прежний прямой доступ к item.h.curator не мог его увидеть в принципе. Срез и реестр владельца сходятся на всех ${pairs.length} режущихся объектах, расхождений ${drift.length} (ИС-14): дорога, которую называет отказ, теперь и правда отвечает`);
+/* #134 — снят волной 23 (З-19): «охват читается тем же читателем, что разрез; срез и реестр
+   владельца сходятся на режущихся объектах» — перенесено на правила own и via, теперь у 7
+   объектов, а не у 6: #289. Номер не переиспользуется. */
 
-  /* #135 — «общий» и «не спрашивается» разводит УТЕЧКА, а не вкус (§9, ADR-0203 §3). */
-  const prog = ST.statSlice({obj:'obj-program', dims:['d-pstate'], inds:['a-count'], date: ASK});
-  const rcp = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], inds:['a-count'], date: ASK});
-  const zd = ST.statSlice({obj:'obj-zdeal', dims:['d-zdate'], inds:['a-count'], date: ASK,
-    buckets:{'d-zdate':'год'}});
-  const rcpWork = ST.workList('obj-receipt');
-  const zdWork = ST.workList('obj-zdeal');
-  const progShort = ST.passportShort(prog.passport);
-  ok(135, prog.ok && prog.n === 5 && prog.passport.scoped === false &&
-        has(prog.passport.scope, 'программа общая') && has(progShort, 'всего 5') &&
-        !rcp.ok && !zd.ok && !rcpWork.ok && !zdWork.ok &&
-        has(rcp.why, 'Платёж') && has(zd.why, 'предмет залога'),
-    `«общий» и «не спрашивается» — РАЗНЫЕ ответы, и разводит их утечка, а не вкус (§9). Программа общая: она не принадлежит куратору, состав программ — общее знание, и аналитик законно видит все ${prog.n}; паспорт это НАЗЫВАЕТ («${prog.passport.scope}»), а краткая форма говорит «всего», не «вам видно» — иначе одно и то же N читалось бы двумя разными утверждениями. Поступление и залоговый договор отказывают: отдать их целиком значит показать объём чужой работы даже итогом. Обе двери закрыты заодно — и срез, и «работать со списком»: иначе отказ обходился бы за один шаг`);
+/* #135 — снят волной 23 (З-19): «общий и не спрашивается разводит утечка» больше не часть
+   модели — «не спрашивается» снято (ADR-0243 §5), договор и поступление общие (§4). Смысл
+   «общий печатает причину, краткая форма — всего N» держит #288. Номер не переиспользуется. */
 
-  /* #136 — ворота стоят в ОБЩЕЙ проверке вопроса, и все двери получают их даром (СС-130). */
-  const doors = [
-    ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], inds:['a-count'], date: ASK}),
-    ST.statRows({obj:'obj-receipt', date: ASK}),
-    ST.statSeries({obj:'obj-receipt', inds:'a-sumrsum', dates:['2026-08-01', ASK]}),
-    ST.exportJob({obj:'obj-receipt', date: ASK}),
-    ST.workList('obj-receipt')];
-  ST.setRole('Администратор статистики');
-  const aSlice = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], inds:['a-count'], date: ASK});
-  const aRows = ST.statRows({obj:'obj-receipt', date: ASK});
-  const aWork = ST.workList('obj-receipt');
-  ST.setRole(role0);
-  ok(136, doors.every(d => d && d.ok === false && has(d.why, 'не спрашивается')) &&
-        doors.every(d => has(d.why, 'ИС-37')) &&
-        aSlice.ok && aSlice.n === 15 && aWork.ok && aWork.n === 15 &&
-        !aRows.ok && !has(aRows.why, 'не спрашивается') && has(aRows.why, 'порог показа'),
-    `ворота охвата стоят в ОБЩЕЙ проверке вопроса, рядом с воротами даты, и все ${doors.length} дверей получают их даром — срез, строки, ряд, выгрузка и список (СС-130): отказ у всех один и тот же, с причиной и дорогой. Роль без сужения проходит: администратору срез отдаёт ${aSlice.n} поступлений, список — ${aWork.n}. Строкам он отказывает — но ПО ДРУГОЙ причине и другими словами: «${String(aRows.why).slice(0, 60)}…» (ИС-22, порог показа). Два отказа на одной двери не сливаются в один: охват говорит «вам этого не спрашивают», порог — «столько списком не отдаётся». Запрет охвата — не на объект, а на пару «объект + роль»`);
-})();
+/* #136 — снят волной 23 (З-19): «ворота охвата в общей проверке вопроса отбивают все двери»
+   больше не часть модели — ворот нет, охват — фильтр строк у каждой двери. Смысл «все двери
+   режут одними правилами» держат #288 (общие двери отвечают) и #289…#291 (срез и реестр
+   владельца сходятся). Номер не переиспользуется. */
 
 /* ---------- Я. Волна 17: календарь учётных периодов — общий справочник ----------
```

`сторож #152` (~2707):

```diff
     owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
     scope:{open:'обеспечение общее'}, dims:['d-bregion'], inds:['a-count']});
+  /* Волна 23, З-19 (переписано на месте): охват — правило «общий» с причиной (ИС-58, СС-199). */
   const ownObj = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
     owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
-    scope:{open:'обеспечение общее'}, dims:[], inds:['a-count']});
+    scope:[{kind:'open', reason:'обеспечение общее'}], dims:[], inds:['a-count']});
   const ownDim = ST.addDim({dates:1, id:'d-gregion2', obj:'obj-guarantee', name:'Территория поручительства',
     src:'поле', key:'region', perObject:'одно', owner:'Справочник административного деления',
```

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL, среди них `#117` и `#288`…`#291` — правил нет, ворота стоят.

- [ ] **Step 4: Движок**

`const REGISTRY = [` (~2255):

```diff
    До неё строки нет вовсе: небытие не «пусто» и не «ноль». Читается тем же читателем,
    что разрез и показатель-поле, и потому может прийти полем, историей или швом. */
-/* scope — ОХВАТ РОЛЕЙ, девятый обязательный реквизит записи (ИС-37, ADR-0203). До волны
-   15 охвата в записи не было вовсе: applyScope резал по «d-curator», зашитому в файл, —
-   тем же способом, каким волна 14 держала список дат константой DATES. Состояний три, и
-   каждое ОБЪЯВЛЕНО, потому что различает их не движок, а решение:
-     {dim:'…'}            — режется ЭТИМ разрезом. Имя разреза у объекта СВОЁ: у заёмщика
-                            ведущий куратор ВЫЧИСЛЯЕТСЯ (ТЗ 16 §11) и лежит в «d-lcurator»,
-                            и зашитое «d-curator» отдавало ему ноль строк из трёх своих;
-     {open:'причина'}     — объект ОБЩИЙ, роль его не сужает, видны все строки законно;
-     {denied:{why, road}} — под ролью не спрашивается вовсе: ОТКАЗ с дорогой. Показать
-                            такой объект целиком нельзя — это утечка через §9 (итог по
-                            холдингу человеку без права на холдинг), а показать пусто —
-                            СС-Д11.
-   Необъявленный охват валит загрузку (проверка #132) — тот же вход, что у СС-Д14 и #128. */
+/* scope — ОХВАТ РОЛЕЙ, девятый обязательный реквизит записи: ОДНО ИЛИ НЕСКОЛЬКО ПРАВИЛ,
+   соединённых ИЛИ (ИС-58, ADR-0243; снят ИС-37 с его тремя состояниями). Строка видна под
+   ролью, если её пропускает хоть одно правило. Вид правила — закрытый список из трёх:
+     {kind:'own', dim:'…'}          — своя колонка строки: разрез охвата объекта равен
+                                      значению роли. Имя разреза у объекта СВОЁ: у заёмщика
+                                      ведущий куратор ВЫЧИСЛЯЕТСЯ (ТЗ 16 §11) и лежит в
+                                      «d-lcurator»;
+     {kind:'via', obj:'…', key:'…'} — через строки другой таблицы на ТУ ЖЕ дату вопроса:
+                                      строка видна, если под ролью видна хотя бы одна
+                                      связанная. Ключ — разрез той таблицы, указывающий на
+                                      объект (дело ← требования), или ссылка объекта на ту
+                                      строку (мера → требование-цель, `target`);
+     {kind:'open', reason:'…'}      — общий: роль не сужает, причина обязательна, её печатает
+                                      паспорт.
+   Состояния «не спрашивается» нет (ADR-0243 §5): ни один объект его не использует.
+   Объект без правила и правило без вида валят загрузку реестра (`scopeErrors`, СС-199) —
+   тот же вход, что у СС-Д14 и #128. */
 const OBJECTS = [
   {id:'obj-credit', name:'Кредит', plural:'кредиты', owner:'Кредиты', refName:'номер договора',
-   born:{src:'поле', key:'cdate'}, scope:{dim:'d-curator'},
+   born:{src:'поле', key:'cdate'}, scope:[{kind:'own', dim:'d-curator'}],
    dims:['d-branch','d-curator','d-category','d-odays','d-industry','d-cur','d-status','d-region',
          'd-cdate','d-line','d-program','d-binn','d-cbptype','d-covstate','d-covreq',
```

`const OBJECTS = [` (~2298):

```diff
      заверял его как верный (СС-133, ADR-0203 §2). */
   {id:'obj-borrower', name:'Заёмщик', plural:'заёмщики', owner:'Заёмщики', refName:'ИНН',
-   born:{src:'поле', key:'bdate'}, scope:{dim:'d-lcurator'},
+   born:{src:'поле', key:'bdate'}, scope:[{kind:'own', dim:'d-lcurator'}],
    /* Волна 23: «Статус заёмщика» заменён состоянием субъекта (`d-sstate`); факторы п. 11
       уехали к кредиту, лимит снят вовсе (СС-140, СС-141, ADR-0244 §4). */
```

`const OBJECTS = [` (~2318):

```diff
      оценка всегда в сомах, страховка в схеме — состояние, а не булево (ADR-0244 §4). */
   {id:'obj-collateral', name:'Залог', plural:'предметы залога', owner:'Залог', refName:'номер предмета',
-   born:{src:'поле', key:'adm'}, scope:{dim:'d-ccurator'},
+   born:{src:'поле', key:'adm'}, scope:[{kind:'own', dim:'d-ccurator'}],
    dims:['d-cbranch','d-ccurator','d-collkind','d-cregion','d-cadm','d-czstate','d-cban',
          'd-cpledger','d-cctl','d-csolv'],
```

`const OBJECTS = [` (~2337):

```diff
      одной, и это законно (ADR-0201 §3): суммы по договору залог не отдаёт, а вывести её
      самим запрещает ИС-1. Филиала и куратора нет по той же причине — это заявка владельцу,
-     а не поле; из-за них объект третьим попадает под СС-Д11 (объект без разреза охвата
-     молча пустеет под ролью). */
+     а не поле. Охват — общий: решение пользователя 17.09.2026, цена — объём чужой работы
+     виден итогом — названа и принята (ADR-0243 §4; был отказ с дорогой, ADR-0203 §3). */
   {id:'obj-zdeal', name:'Залоговый договор', plural:'залоговые договоры', owner:'Залог',
    refName:'номер залогового договора',
    born:{src:'поле', key:'zdate'},
-   scope:{denied:{why:'куратора залогового договора владелец не отдаёт — это заявка залогу, а не поле (СС-120)',
-                  road:'спросите предмет залога: у него охват есть, а договоры вещи видны в её карточке'}},
+   scope:[{kind:'open', reason:'решение пользователя 17.09.2026: договор общий, объём виден итогом (ADR-0243 §4)'}],
    dims:['d-zdate'],
    inds:['a-count']},
   /* Волна 23: разрезов у дела не осталось — подразделение, куратор, территория и валюта
-     сняты (ADR-0243, ADR-0244 §4). Охват дела станет правилом `via` — через строки его
-     требований — только в З-19; до неё объявлен общим, иначе он ссылался бы на снятый
-     разрез куратора. Это ВРЕМЕННО и записано в «Ходе работы» плана волны 23. */
+     сняты (ADR-0243, ADR-0244 §4). Куратора у дела нет вовсе (ADR-0023), и охват идёт через
+     строки его требований на дату вопроса: дело видно, если видно хоть одно его требование
+     (ADR-0243 §3, З-19). Временный «общий» З-13 снят. */
   {id:'obj-case', name:'Дело взыскания', plural:'дела взыскания', owner:'Взыскание', refName:'номер дела',
    born:{src:'поле', key:'odate'},
-   scope:{open:'охват дела — правилом через требования (волна 23, З-19); до неё дело общее'},
+   scope:[{kind:'via', obj:'obj-claim', key:'d-clcase'}],
    dims:[],
    inds:['m-claim','m-cclaims','m-ccredits','m-cexp',
```

`const OBJECTS = [` (~2362):

```diff
   {id:'obj-claim', name:'Требование взыскания', plural:'требования взыскания', owner:'Взыскание',
    refName:'номер требования',
-   born:{src:'поле', key:'qdate'}, scope:{dim:'d-clcurator'},
+   born:{src:'поле', key:'qdate'}, scope:[{kind:'own', dim:'d-clcurator'}],
    dims:['d-clbranch','d-clcurator','d-phase','d-clcase','d-clcred','d-crole','d-clscope','d-clcur'],
    inds:['m-clsum','m-clphdays','a-count','a-sumclsum','a-avgclphdays']},
```

`const OBJECTS = [` (~2392):

```diff
       сужать её ролью нечем и незачем. Утечки здесь нет — состав программ и есть общее
       знание холдинга (ADR-0203 §3). */
-   scope:{open:'программа общая: она не принадлежит куратору, и роль её не сужает'},
+   scope:[{kind:'open', reason:'состав программ — общее знание: программа не принадлежит куратору, и роль её не сужает (ADR-0243 §4)'}],
    dims:['d-psource','d-pstate','d-pgline','d-pgcur','d-pkind','d-ppurp','d-pdec','d-pgindustry','d-pstart'],
    inds:['a-count']},
```

`const OBJECTS = [` (~2401):

```diff
      «сумма − судебный» и читается при чтении, а не хранится (схема §9). */
   {id:'obj-repay', name:'Платёж', plural:'платежи', owner:'Погашения', refName:'номер платежа',
-   born:{src:'поле', key:'rdate'}, scope:{dim:'d-pcurator'},
+   born:{src:'поле', key:'rdate'}, scope:[{kind:'own', dim:'d-pcurator'}],
    /* Событие-дельта (ИС-55, ADR-0239, СС-171). `evDay` — поля, поздний из которых есть день,
       когда платёж стал известен статистике; срез его строки — этот день + 1. `evState` —
```

`const OBJECTS = [` (~2431):

```diff
       сопоставления или заморозки после закрытия месяца — строка своего вида без сумм. */
    evDay:['rdate'], evState:{'d-rmatch':'match', 'd-rfrz':'freeze'}, corr:['original','bind','refund','match','freeze','amount'],
-   /* Отказ, а не «общий»: сводное поступление гасит кредиты РАЗНЫХ кураторов, и отдать
-      его целиком значит показать куратору объём чужой работы — та самая утечка, которую
-      §9 запрещает даже итогом. Дорога настоящая: уровнем ниже стоит платёж, и он режется
-      (ADR-0203 §3). */
-   scope:{denied:{why:'сводное поступление гасит кредиты разных кураторов: на дату куратор у него многозначен (СС-105, ИС-21)',
-                  road:'спросите объект «Платёж» — на нём куратор один, и охват работает'}},
+   /* Общий, а не отказ: сводное поступление гасит кредиты разных кураторов, и объём чужой
+      работы виден итогом — это решение пользователя 17.09.2026 с названной ценой; вариант
+      «через платежи» предлагался и не выбран (ADR-0243 §4, «Отвергнуто»). */
+   scope:[{kind:'open', reason:'решение пользователя 17.09.2026: поступление общее, объём виден итогом (ADR-0243 §4)'}],
    dims:['d-rchan','d-rmatch','d-rfrz','d-rcur','d-rdate'],
    /* Волна 23: нераспределённый остаток и «дней без опознания» считаются при чтении и
```

`const OBJECTS = [` (~2446):

```diff
      сняла территорию и хранимые «дни с направления» (схема §11 «Снято»). */
   {id:'obj-measure', name:'Мера взыскания', plural:'меры взыскания', owner:'Взыскание', refName:'номер меры',
-   born:{src:'поле', key:'mdate'}, scope:{dim:'d-mcurator'},
+   /* Охват меры — ДВА правила через ИЛИ (ADR-0243 §3): работу видит владелец требования-цели
+      на дату вопроса, а автор меры видит свою меру и после передачи требования в другой отдел. */
+   born:{src:'поле', key:'mdate'}, scope:[{kind:'via', obj:'obj-claim', key:'target'}, {kind:'own', dim:'d-mcurator'}],
    /* Событие полным состоянием (ИС-55, ADR-0239 §5): строка у пары «мера × цель», последняя
       строка пары отвечает за всё. `targets` — поле цели в записи мира, `primaryBy` — какая
```

`const CORE = {` (~3599):

```diff
         alien.map(x => '«'+x+'»').join(', ')+': перечень объявляет ВЛАДЕЛЕЦ, и необъявленное '+
         'поле шов не отдаёт (ADR-0181 §2, «Отвергнуто»)'};
-    const den = scopeGate(objId);
-    if(den) return {ok:false, why: den};
     const all = (WORLD[objId] || []).filter(item => {
       const b = bornOn(o, item, at);
```

`const CORE = {` (~3607):

```diff
     const s = ST.scopeOf(objId);
     let vis = all;
-    if(s && s.dim) vis = all.filter(item => readDim(s.dim, item, at) === s.value);
+    if(s) vis = all.filter(item => seesItem(objId, item, at, s));
     const hidden = all.length - vis.length;
     if(q && q.refs) vis = vis.filter(item => q.refs.indexOf(item.id) >= 0);
```

`function seed(){` (~6369):

```diff
      и в реестр, и в состав её объекта одним действием (ИС-44). */
   const objs = clone(OBJECTS);
+  /* Охват валит загрузку (ИС-58, ADR-0243, СС-199): объект без правила и правило без вида —
+     не «общий по умолчанию», а реестр, который загрузить нельзя. */
+  const scopeBad = scopeErrors(objs, REGISTRY);
+  if(scopeBad.length) throw new Error('загрузка реестра: '+scopeBad.join('; ')+' (ИС-58, ADR-0243)');
   const st = {
     today: '2026-08-22',
```

`ST.curatorOf = () => ST.state.scope[ST.state.role] || null;` (~6559):

```diff
    назвавший свой охват иначе, молча пустел (СС-Д11). */
 ST.curatorOf = () => ST.state.scope[ST.state.role] || null;
-/* Охват объекта: null — роль не сужает (администратор, либо объект объявлен общим),
-   {dim,value} — режется разрезом, {denied} — под ролью не спрашивается (отказ с дорогой). */
+/* ПРАВИЛА ОХВАТА (ИС-58, ADR-0243 §1–§5, СС-199). Форма правила проверяется у двери
+   объекта (`scopeShapeBad`), связи правила с реестром — на загрузке (`scopeErrors`): у двери
+   объект заводится раньше своих разрезов, и разрез охвата называет ещё не заведённую запись. */
+function scopeShapeBad(rules){
+  /* Список видов — внутри функции: загрузка зовёт её из `seed()` раньше, чем исполнится
+     объявление ниже по файлу. */
+  const SCOPE_KINDS = ['own','via','open'];
+  if(!Array.isArray(rules) || !rules.length) return 'правил охвата нет: объект без правила не загружается';
+  for(let i = 0; i < rules.length; i++){
+    const r = rules[i] || {};
+    if(SCOPE_KINDS.indexOf(r.kind) < 0) return 'правило '+(i+1)+' без вида из '+SCOPE_KINDS.join(' · ');
+    if(r.kind === 'own' && !r.dim) return 'правило '+(i+1)+' own: разрез охвата не назван';
+    if(r.kind === 'via' && (!r.obj || !r.key)) return 'правило '+(i+1)+' via: таблица или ключ связи не названы';
+    if(r.kind === 'open' && !(typeof r.reason === 'string' && r.reason.trim()))
+      return 'правило '+(i+1)+' open: причина не названа — паспорт обязан её напечатать';
+  }
+  if(rules.some(r => r.kind === 'open') && rules.length > 1) return 'общий объект других правил не несёт: ИЛИ с «общим» — тот же общий';
+  return null;
+}
+function scopeErrors(objects, registry){
+  const objBy = id => objects.find(x => x.id === id), dimBy = id => registry.find(x => x.id === id);
+  const out = [];
+  objects.forEach(o => {
+    const shape = scopeShapeBad(o.scope);
+    if(shape){ out.push(o.id+': '+shape); return; }
+    o.scope.forEach((r, i) => {
+      if(r.kind === 'own'){
+        const d = dimBy(r.dim);
+        if(!d || d.obj !== o.id || o.dims.indexOf(r.dim) < 0) out.push(o.id+' правило '+(i+1)+': разрез охвата «'+r.dim+'» не свой разрез объекта');
+      }
+      if(r.kind === 'via'){
+        const t = objBy(r.obj), k = dimBy(r.key);
+        if(!t || t.id === o.id) out.push(o.id+' правило '+(i+1)+': таблицы «'+r.obj+'» для охвата нет');
+        else if(r.key === 'target' ? !o.targets : !(k && (k.obj === t.id || k.obj === o.id)))
+          out.push(o.id+' правило '+(i+1)+': ключ связи «'+r.key+'» не ведёт от «'+o.id+'» к «'+t.id+'»');
+        else if((t.scope || []).some(x => x.kind === 'via')) out.push(o.id+' правило '+(i+1)+': охват через «'+t.id+'», который сам идёт через другую таблицу');
+      }
+    });
+  });
+  return out;
+}
+ST.scopeErrors = objects => scopeErrors(objects || ST.state.objects, ST.state.registry);
+ST.scopeShapeBad = scopeShapeBad;
+/* Охват объекта под ролью: null — роль не сужает (администратор, либо объект общий),
+   иначе {rules, value} — правила объекта и значение роли. */
 ST.scopeOf = objId => {
   const c = ST.curatorOf();
```

`ST.scopeOf = objId => {` (~6566):

```diff
   const o = OBJ(objId || (ST.state.q && ST.state.q.obj));
   if(!o) return null;
-  const s = o.scope;
-  /* Необъявленный охват сюда не доходит: его валит загрузка (проверка #132). Ветка
-     оставлена ЯВНОЙ — молчаливое «значит, общий» и есть тот дефект, который волна чинит. */
-  if(!s) return {denied:{why:'у объекта «'+o.name+'» охват ролей не объявлен', road:'заведите реквизит scope записью реестра (ИС-37)'}};
-  if(s.open) return null;
-  if(s.denied) return {denied: s.denied, obj: o};
-  return {dim: s.dim, value: c};
+  if(o.scope.some(r => r.kind === 'open')) return null;
+  return {rules: o.scope, value: c, obj: o.id};
 };
+/* Тот же охват над ЗАПИСЬЮ владельца, а не над строкой (ИС-14, ИС-18): реестр владельца и
+   карточка режутся теми же правилами и тем же читателем, что и срез. */
+function seesItem(objId, item, dateISO, s){
+  const o = OBJ(objId);
+  return s.rules.some(r => {
+    if(r.kind === 'own') return readDim(r.dim, item, dateISO) === s.value;
+    const t = OBJ(r.obj), list = WORLD[r.obj] || [];
+    const vis = x => t.scope.some(q => q.kind === 'open') || seesItem(r.obj, x, dateISO, {rules: t.scope, value: s.value});
+    if(r.key === 'target') return [].concat(item.f[o.targets] || []).some(id => { const x = list.find(w => w.id === id); return !!x && vis(x); });
+    if((DIM(r.key) || {}).obj === r.obj) return list.some(x => readDim(r.key, x, dateISO) === item.id && vis(x));
+    const x = list.find(w => w.id === readDim(r.key, item, dateISO));
+    return !!x && vis(x);
+  });
+}
 
 /* ------------------------ ПЕРИОДЫ И ЗАЩЁЛКА ------------------------- */
```

`ST.dateGate = (requested, objId) => dateGate(ST.state, objId || ST.state.q.obj, requested)` (~7168):

```diff
 /* ИС-13: роль режет СТРОКИ, а не итог. Обратный порядок дал бы закрытую сумму
    вычитанием двух доступных срезов — утечку за два запроса.
-   ИС-37: КАКИМ разрезом резать — берётся из записи объекта. Объект, чей охват объявлен
-   отказом, сюда не доходит: его отбивают ворота scopeGate до счёта (СС-135). */
-function applyScope(rows, objId){
+   ИС-58: ЧЕМ резать — правила объекта, соединённые ИЛИ (ADR-0243). Правило `via` читает
+   связанные строки на ДАТУ ВОПРОСА (ADR-0243 «Границы»): владелец требования для меры на
+   15.06 — тот, кто владеет требованием в строке 15.06. У состояния дата вопроса совпадает с
+   датой строки; у события строка лежит на дне события, и дату вопроса называет вызывающий.
+   Путь признаков (СС-198) охватом не режется — join идёт после этой функции и мимо неё. */
+function scopeTest(st, rule, value, asOf){
+  if(rule.kind === 'own') return r => r.dims[rule.dim] === value;
+  const days = {};
+  const seenOn = d => days[d] || (days[d] = applyScope(rowsAsOf(st, rule.obj, d), rule.obj, d));
+  const back = rule.key !== 'target' && (DIM(rule.key) || {}).obj === rule.obj;
+  return r => {
+    const other = seenOn(asOf || r.date);
+    if(back) return other.some(x => x.dims[rule.key] === r.ref);
+    const link = rule.key === 'target' ? r.part : r.dims[rule.key];
+    return link != null && other.some(x => x.ref === link);
+  };
+}
+function applyScope(rows, objId, asOf){
   const s = ST.scopeOf(objId || (rows[0] && rows[0].obj));
-  if(!s || s.denied) return rows;
-  return rows.filter(r => r.dims[s.dim] === s.value);
+  if(!s) return rows;
+  const tests = s.rules.map(r => scopeTest(ST.state, r, s.value, asOf));
+  return rows.filter(r => tests.some(t => t(r)));
 }
-/* Ворота охвата — рядом с воротами даты и по той же причине (СС-130): стоят в ОБЩЕЙ
-   проверке вопроса, и все двери получают их даром. Отказ называет причину и дорогу:
-   отказ без дороги — половина ответа (§8.4). */
-function scopeGate(objId){
-  const s = ST.scopeOf(objId);
-  if(!s || !s.denied) return null;
-  const o = OBJ(objId);
-  return 'объект «'+(o ? o.name : objId)+'» под ролью «'+ST.state.role+'» не спрашивается: '+
-    s.denied.why+'. Показать его целиком нельзя — это выдало бы объём чужой работы даже '+
-    'итогом (§9), а показать пусто значит соврать. '+s.denied.road+' (ИС-37, ADR-0203)';
-}
-ST.scopeGate = scopeGate;
 /* ==================== ФИЛЬТР ВОПРОСА (ADR-0180) ====================== *
    Форма одна: ДНФ БЕЗ СКОБОК. Фильтр — наборы через ИЛИ, набор — сравнения через И,
```

`ST.applyScope = applyScope;` (~7398):

```diff
 ST.applyScope = applyScope;
 
-/* Состояний охвата три, и паспорт называет ТО, которое сработало (ИС-37, ADR-0203 §4).
+/* Паспорт называет правила, которые сработали (ИС-58, ADR-0243 §4; ADR-0203 §4 в силе).
    «Общий» и «вам видно всё» — разные вещи: у администратора роль не сужает НИЧЕГО, у
    аналитика на общей программе роль не сужает ЭТОТ объект, и различить их по числу
-   нельзя — оба ответа дадут одинаковое N. */
+   нельзя — оба ответа дадут одинаковое N. Общий объект печатает свою причину. */
+function ruleText(r, value){
+  if(r.kind === 'own') return (DIM(r.dim) ? DIM(r.dim).name.toLowerCase() : r.dim)+' — '+value;
+  const t = OBJ(r.obj);
+  return 'через '+(t ? t.plural : r.obj)+', видимые вам на дату вопроса';
+}
 function scopeText(objId, n){
   const s = ST.scopeOf(objId), o = OBJ(objId);
-  if(s && s.dim) return 'по '+n+' объектам «'+o.name+'», доступным вам: роль «'+ST.state.role+
-    '», '+(DIM(s.dim) ? DIM(s.dim).name.toLowerCase() : s.dim)+' — '+s.value;
-  if(ST.curatorOf() && o && o.scope && o.scope.open)
-    return 'по всем '+n+' объектам «'+o.name+'»: '+o.scope.open+' (ИС-37)';
+  const open = o && o.scope.find(r => r.kind === 'open');
+  if(s) return 'по '+n+' объектам «'+o.name+'», доступным вам: роль «'+ST.state.role+'», '+
+    s.rules.map(r => ruleText(r, s.value)).join(' ИЛИ ');
+  if(ST.curatorOf() && open) return 'по всем '+n+' объектам «'+o.name+'»: '+open.reason+' (ИС-58)';
   return 'по всем объектам «'+o.name+'» системы: '+n;
 }
```

`function editionNote(st, objId, res, rows, inds, dims){` (~7596):

```diff
   }
   const s = ST.scopeOf(objId);
-  if(s && s.dim && form.dims.indexOf(s.dim) < 0){
+  const lost = s ? s.rules.filter(r => r.kind === 'own' && form.dims.indexOf(r.dim) < 0) : [];
+  if(s && lost.length === s.rules.length){
     const n = st.rows.filter(r => r.obj === objId && isLegacyRow(r) && r.date === res.asOf).length;
     if(n) parts.push('под ролью «'+ST.state.role+'» легаси-строк не видно НИ ОДНОЙ (их '+n+
-      ' на эту дату): охват режется разрезом «'+((REC(s.dim) || {}).name || s.dim)+
+      ' на эту дату): охват режется разрезом «'+lost.map(r => (REC(r.dim) || {}).name || r.dim).join('», «')+
       '», а форма легаси его не собирала — исключение названо, а не скрыто (ADR-0175 §2, ADR-0207 §2)');
   }
```

`function passportFor(st, objId, requested, res, rows, filter, inds, dims, meta){` (~7641):

```diff
     partial: partialNote(rows),
     scope: scopeText(objId, rows.length),
-    scoped: !!(ST.scopeOf(objId) || {}).dim,
+    scoped: !!ST.scopeOf(objId),
     filter: filterText(filter),
     composition: compositionText(dims, inds, meta),
```

`function checkQuery(q, needAgg){` (~7868):

```diff
   const tail = dateGate(ST.state, q.obj, q.date);
   if(tail) return tail;
-  /* Охват — сразу за датой и по той же причине: спрашивающему, которому объект не
-     виден вовсе, объяснять про разрезы значит вести его по двум отказам подряд (ИС-37). */
-  const den = scopeGate(q.obj);
-  if(den) return den;
   for(const d of (q.dims || [])){
     const D = DIM(d);
```

`ST.statSlice = q => {` (~7960):

```diff
   if(!res) return {ok:false, why:'строк на '+fmt(q.date)+' и ранее нет: подстановка запрещена (ИС-12)'};
   let rows = rowsAsOf(st, q.obj, res.asOf);
-  rows = applyScope(rows, q.obj);                            /* ДО группировки — ИС-13 */
+  rows = applyScope(rows, q.obj, res.asOf);                  /* ДО группировки — ИС-13 */
   rows = joinVia(st, rows, viaIds(q), res.asOf);             /* путь — после охвата, им не режется */
   const badF = checkFilterDomain(q.filter, rows);            /* отказ ДО счёта — ADR-0180 §8 */
```

`ST.statSeries = q => {` (~8058):

```diff
      четыре точки дали бы четыре разных вердикта одному и тому же фильтру. */
   const lastAt = resolveAsOf(st, q.obj, dates[dates.length-1]);
-  const badF = lastAt ? checkFilterDomain(q.filter, applyScope(rowsAsOf(st, q.obj, lastAt.asOf), q.obj)) : null;
+  const badF = lastAt ? checkFilterDomain(q.filter, applyScope(rowsAsOf(st, q.obj, lastAt.asOf), q.obj, lastAt.asOf)) : null;
   if(badF) return {ok:false, why: badF};
   /* СОСТАВ ряда — это МНОЖЕСТВО записей, попавших хоть в одну точку, а не сумма точек.
```

`ST.statSeries = q => {` (~8076):

```diff
       continue;
     }
-    let rows = applyFilter(applyScope(rowsAsOf(st, q.obj, res.asOf), q.obj), q.filter);
+    let rows = applyFilter(applyScope(rowsAsOf(st, q.obj, res.asOf), q.obj, res.asOf), q.filter);
     rows.forEach(r => seen.set(r.ref, r));
     points.push({date:d, asOf:res.asOf, age:res.age,
```

`function rowsFor(st, q){` (~8129):

```diff
   const res = resolveAsOf(st, q.obj, q.date);
   if(!res) return {ok:false, why:'строк на '+fmt(q.date)+' и ранее нет: подстановка запрещена (ИС-12)'};
-  let rows = applyScope(rowsAsOf(st, q.obj, res.asOf), q.obj);
+  let rows = applyScope(rowsAsOf(st, q.obj, res.asOf), q.obj, res.asOf);
   const badF = checkFilterDomain(q.filter, rows);
   if(badF) return {ok:false, why: badF};
```

`ST.workList = (objId, sliceDate) => {` (~8175):

```diff
   const o = OBJ(objId);
   if(!o) return {ok:false, why:'объекта «'+objId+'» нет в реестре объектов (ИС-18)'};
-  /* Дверь к «как сейчас» стоит под теми же воротами, что и срез. Иначе отказ по охвату
-     обходился бы за один шаг: не отдав поступления срезом, макет отдал бы их списком —
-     и «нельзя показать целиком» стало бы неправдой в соседней строке (ИС-37, §9). */
-  const den = scopeGate(objId);
-  if(den) return {ok:false, why: den};
+  /* Дверь к «как сейчас» режется теми же правилами, что и срез (ИС-58): реестр владельца
+     читает их над записью, строки среза — над строкой. */
   const today = ST.registryList(objId, st.today, null);
   const res = resolveAsOf(st, objId, sliceDate || st.q.date);
-  const inSlice = res ? applyScope(rowsAsOf(st, objId, res.asOf), objId).length : 0;
+  const inSlice = res ? applyScope(rowsAsOf(st, objId, res.asOf), objId, res.asOf).length : 0;
   return {ok:true, obj: objId, list: today, n: today.length, asOf: res ? res.asOf : null, inSlice,
     note:'в реестре «'+o.owner+'» на сегодня '+today.length+
```

`ST.registryList = (objId, dateISO, filter) => {` (~8204):

```diff
        ни полей: у заёмщика ведущий куратор приходит ШВОМ, истории «curator» у него нет
        вовсе, и дорога, которую называет отказ, отвечала спрашивающему НОЛЬ (СС-134). */
-    if(s && s.denied) return false;      /* дверь — workList, и она отказывает вслух */
-    if(s && readDim(s.dim, item, dateISO) !== s.value) return false;
+    if(s && !seesItem(objId, item, dateISO, s)) return false;
     /* Фильтр списку и фильтр числу — ОДНО сравнение над разными источниками: у среза
        строка, у владельца запись на дату. Двух правил здесь не бывает (ИС-14, ИС-18). */
```

`ST.flowBetween = q => {` (~8426):

```diff
   const badF = checkFilterShape(q.filter, q.obj);
   if(badF) return {ok:false, why: badF};
-  const endScoped = applyScope(rowsAsOf(st, q.obj, b.asOf), q.obj);
+  const endScoped = applyScope(rowsAsOf(st, q.obj, b.asOf), q.obj, b.asOf);
   const badD = checkFilterDomain(q.filter, endScoped);
   if(badD) return {ok:false, why: badD};
   const endRows = applyFilter(endScoped, q.filter);
-  const baseRows = applyFilter(applyScope(rowsAsOf(st, q.obj, a.asOf), q.obj), q.filter);
+  const baseRows = applyFilter(applyScope(rowsAsOf(st, q.obj, a.asOf), q.obj, a.asOf), q.filter);
   let sum = 0; const born = [];
   endRows.forEach(r => {
```

`ST.addObject = spec => {` (~9313):

```diff
   }
   for(const m of (spec.inds || [])) if(!IND(m)) return {ok:false, why:'показателя «'+m+'» нет в реестре показателей (ИС-7)'};
+  /* Охват — правила (ИС-58): объект без правила и правило без вида не заводятся. */
+  const sb = scopeShapeBad(spec.scope);
+  if(sb) return {ok:false, why:'охват объекта «'+(spec.name || spec.id)+'»: '+sb+' (ИС-58, ADR-0243)'};
   st.objects.push(clone(spec));
   log('заведён объект статистики «'+spec.name+'» — строки появятся ближайшим прогоном');
```

`ST.operandValues = (kind, id, bucket) => {` (~9545):

```diff
   const bk = o.vtype === 'корзина' ? (bucket || o.dim.buckets[0]) : null;
   const set = new Set();
-  applyScope(rowsAsOf(st, st.q.obj, res.asOf), st.q.obj).forEach(r => {
+  applyScope(rowsAsOf(st, st.q.obj, res.asOf), st.q.obj, res.asOf).forEach(r => {
     if(o.kind === 'dim'){
       const v = r.dims[id];
```

`ST.addCmp = () => {` (~9623):

```diff
   const res = resolveAsOf(st, st.q.obj, st.q.date);
   const bad = ST.filterCheck(trial, st.q.obj,
-    res ? applyScope(rowsAsOf(st, st.q.obj, res.asOf), st.q.obj) : null);
+    res ? applyScope(rowsAsOf(st, st.q.obj, res.asOf), st.q.obj, res.asOf) : null);
   if(bad) return toast(bad, 'err');
   st.q.filter = trial;
```

`ST.addObjUI = () => act(ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'п` (~10723):

```diff
 ST.addObjUI = () => act(ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
   owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
-  scope:{dim:'d-gcurator'}, dims:[], inds:['a-count']}));
+  scope:[{kind:'own', dim:'d-gcurator'}], dims:[], inds:['a-count']}));
 
 /* ------- ЭКРАН РЕЕСТРОВ: АДРЕС ВЕЛИЧИНЫ (ИС-51, ADR-0222) ------- *
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 271/271 PASS` — снято пять, прибавлено четыре (проверено на копии).

- [ ] **Step 6: Мутация**

`applyScope` объединяет правила И вместо ИЛИ
(`rows.filter(r => tests.some(t => t(r)))` → `tests.every`) → `#291` RED (270/271). Проверено.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-19 — охват правилами own · via · open, надгробия #132…#136"
```

| Снят | Надгробие → преемник |
|---|---|
| `#132` | охват объявлен у каждого объекта → `#288` |
| `#133` | заёмщик режется своим куратором → `#289` |
| `#134` | один читатель у среза и реестра владельца → `#289` |
| `#135` | «общий» печатает причину → `#288` |
| `#136` | все двери режут одними правилами → `#288`, `#289`…`#291` |

| Переписан | Почему |
|---|---|
| `#9` | фикстура `G_OBJ` объявляет охват правилом `own` |
| `#117` | «не спрашивается» снято: общий объект отвечает, `scoped === false` |
| `#152` | «свой объект» определяется правилом `own`, а не `scope.dim` |

### Task 8: З-20 — член группы совместного риска: двенадцатый объект, суммы группы из строк членов (`ADR-0244` §2, `ADR-0199`)

Спецификация §4 З-20. Решение — `СС-200`; дефект `СС-Д27`. Правки — разностью по функциям,
как в Task 6b; `~N` — по снимку после З-19.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `VTYPES` — вид `text` (`СС-Д27`, комментарий);
  - `RELEASE` — `'obj-gmember'`: `stat_row_group_member`, колонки `group_id, member_id,
    slice_date, run_id, src_subj, now_cols`, `text: d_group_lbl`, `code: d_group_state`;
    `RELEASE_CHECKS` — `d_group_state: ['действует','распущена']`;
  - `REGISTRY` — `d-ggroup`, `d-gmember`, `d-glbl`, `d-gstate` перед `d-bform`;
  - `OBJECTS` — `obj-gmember` перед `obj-collateral`: `refName 'группа · член'`,
    `scope [{kind:'via', obj:'obj-borrower', key:'d-gmember'}]`, `inds ['a-count']`;
  - `WORLD` — пять членств: `ГСР-01` (три заёмщика, с 01.06.2025, «Ала-Тоо»), `ГСР-02` (два,
    с 01.07.2026, «Ош-Агро»); комментарий «Двенадцатый объект»;
  - новая `ST.groupSums(q)` — перед `ST.flowBetween`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#1`, `#6`, `#89`, `#121`,
  `#172`, `#181`, `#201`, `#202`, `#206`, `#212`, `#228`, `#256`, `#258`, `#264`, `#268`,
  `#282`, `#288`, `#289`; блок З-20 (`#292`, `#293`) перед отчётом.

**Interfaces:**
- Consumes: `checkQuery`, `resolveAsOf`, `rowsAsOf`, `applyScope` (З-19), `IND`, `cents`,
  `RELEASE`/`RELEASE_CHECKS` (З-18a).
- Produces:
  - объект `obj-gmember` (состояние, строка на пару «группа · член»); охват — через заёмщика;
  - `ST.groupSums({date, inds})` → `{ok, asOf, groups:[{group, lbl, members, values}], total,
    noRow, passport:{scope, dedup}}`: величины — только денежные величины заёмщика; строки
    членств и заёмщиков — одной датой `asOf`; итог — по различным членам, не сумма сумм групп
    (`СС-200`); член без строки заёмщика на дату — в `noRow`;
  - объектов 11 → 12; строк на 21.08 — по факту прогона (в пробе: скопировано 17, записано 47).

- [ ] **Step 1: Падающие сторожа `#292`, `#293`**

Перед `/* ---- отчёт ---- */`, после блока З-19:

```js
/* ===== Волна 23 · З-20 — член группы совместного риска (ADR-0244 §2, ADR-0199, СС-200) =====
   Группа — не разрез заёмщика: у заёмщика групп может быть несколько (ADR-0179). Членство —
   своя таблица «группа × член × дата», сумм у неё нет: суммы группы — join строк членства со
   строками заёмщиков-членов ТОЙ ЖЕ даты; итог по всем группам — по различным членам. */
(() => {
  /* #292 — членство — своя таблица состояния с ключом «группа × член», а не разрез заёмщика
     и не копия денег. Адрес строки — пара ключей: заёмщик в двух группах — две строки, и
     ни одна не поглощает другую. Подпись группы лежит без пары-ключа (`d_group_lbl`, вид
     `text` — СС-Д27), состояние — закрытым словарём у таблицы (#282). Охват — через строку
     заёмщика-члена на дату вопроса (ИС-58, ADR-0243 §3): член без строки заёмщика под ролью
     не виден никому, кроме администратора. */
  ST.seed();
  const o292 = ST.OBJ('obj-gmember');
  const rel292 = vm.runInContext('RELEASE', sandbox).tables['obj-gmember'] || {cols: []};
  const need292 = ['group_id', 'member_id', 'slice_date', 'run_id', 'src_subj', 'now_cols', 'd_group_lbl', 'd_group_state'];
  const miss292 = need292.filter(c => rel292.cols.indexOf(c) < 0);
  const bDims292 = ST.OBJ('obj-borrower').dims.filter(d => /совместн/i.test((ST.DIM(d) || {}).name || '') || (ST.DIM(d) || {}).obj === 'obj-gmember');
  const at292 = d => ST.state.rows.filter(r => r.obj === 'obj-gmember' && r.date === d);
  const ask292 = at292(ASK), jul292 = at292('2026-07-01'), jul2292 = at292('2026-07-02');
  const two292 = ask292.filter(r => r.dims['d-gmember'] === '01234199010101').map(r => r.dims['d-ggroup']).sort().join('+');
  const money292 = ST.state.rows.filter(r => r.obj === 'obj-gmember' && Object.keys(r.inds).length > 0).length;
  const col292 = ST.colOf('d-glbl'), key292 = ST.colOf('d-gmember');
  const sA292 = ST.statSlice({obj: 'obj-gmember', dims: ['d-ggroup'], inds: ['a-count'], date: ASK});
  ST.setRole('Аналитик');
  const sB292 = ST.statSlice({obj: 'obj-gmember', dims: ['d-ggroup'], inds: ['a-count'], date: ASK});
  const rB292 = ST.statRows({obj: 'obj-gmember', date: ASK});
  const bB292 = ST.statRows({obj: 'obj-borrower', date: ASK});
  ST.setRole('Администратор статистики');
  const grp292 = s => s.ok ? s.groups.map(g => g.key + ':' + g.n).join(', ') : s.why;
  const seenB292 = bB292.ok ? bB292.rows.map(r => r.ref) : [];
  const viaOk292 = rB292.ok && rB292.rows.every(r => seenB292.indexOf(r.dims['d-gmember']) >= 0) &&
    !rB292.rows.some(r => r.dims['d-gmember'] === '50101199500017');
  ok(292, !!o292 && o292.scope.length === 1 && o292.scope[0].kind === 'via' && o292.scope[0].obj === 'obj-borrower' &&
        o292.scope[0].key === 'd-gmember' && o292.inds.join() === 'a-count' &&
        rel292.table === 'stat_row_group_member' && rel292.storage === 'state' && miss292.length === 0 &&
        rel292.cols.indexOf('d_group_id') < 0 && bDims292.length === 0 &&
        ask292.length === 5 && jul292.length === 3 && jul2292.length === 5 && two292 === 'ГСР-01+ГСР-02' &&
        money292 === 0 && col292.table === 'stat_row_group_member' && col292.cols.join() === 'd_group_lbl' &&
        key292.cols.join() === 'member_id' &&
        grp292(sA292) === 'ГСР-01:3, ГСР-02:2' && grp292(sB292) === 'ГСР-01:2, ГСР-02:1' &&
        rB292.ok && rB292.rows.length === 3 && viaOk292 && has(sB292.passport.scope, 'через заёмщики'),
    `группа совместного риска — своя таблица членства «группа × член × дата» (${rel292.table}, способ ${rel292.storage}), а не разрез заёмщика: разрезов с группой у заёмщика ${bDims292.length}, колонок ${need292.length} на месте (недостаёт ${miss292.length}${miss292.length ? ': ' + miss292.join(', ') : ''}), пары d_group_id нет — подпись «${col292.cols.join()}» лежит одна (СС-Д27). Строк членства на ${ASK} ${ask292.length}; 01234199010101 — в двух группах (${two292}), и это две строки, а не одна; на 01.07 строк ${jul292.length}, на 02.07 ${jul2292.length} — «Ош-Агро» заведена 01.07, и срез на начало дня видит её со следующего. Денег в строках членства ${money292}: суммы группы — из строк заёмщиков (#293). Срез по группам: ${grp292(sA292)}; аналитику — ${grp292(sB292)} (строк ${rB292.ok ? rB292.rows.length : '—'}): видны те члены, чья строка заёмщика видна ему на дату вопроса (${viaOk292}), а 50101199500017 без строки заёмщика не виден — «${sB292.ok ? sB292.passport.scope : '—'}» (ИС-58, ADR-0243 §3, ADR-0244 §2)`);

  /* #293 — суммы группы — из строк заёмщиков-членов на ТУ ЖЕ дату (ADR-0244 §2): группа
     сходится с суммой строк заёмщиков её членов до копейки; итог по всем группам — по
     различным членам, а не сумма сумм групп (ADR-0199); член без строки заёмщика даёт ноль и
     из числа членов не выпадает. Правка строки заёмщика на 21.08 двигает сумму группы на
     21.08 и не трогает 20.08 — join идёт по дате строки, не по кануну. */
  ST.seed();
  const I293 = ['m-btotal', 'm-bdebt'];
  const c293 = x => Math.round(x * 100) / 100;
  const byRef293 = d => new Map(ST.statRows({obj: 'obj-borrower', date: d}).rows.map(r => [r.ref, r]));
  const sumOf293 = (refs, m, bor) => c293(refs.reduce((a, x) => a + (((bor.get(x) || {inds: {}}).inds[m] || {}).v || 0), 0));
  const g293 = ST.groupSums({date: ASK, inds: I293});
  const bor293 = byRef293(ASK);
  const agree293 = g293.ok && g293.groups.every(g => I293.every(m => g.values[m] === sumOf293(g.members, m, bor293))) &&
    I293.every(m => g293.total[m] === sumOf293(g293.members, m, bor293));
  const G1 = g293.ok ? g293.groups.find(g => g.group === 'ГСР-01') : null;
  const G2 = g293.ok ? g293.groups.find(g => g.group === 'ГСР-02') : null;
  const naive293 = g293.ok ? c293(g293.groups.reduce((a, g) => a + g.values['m-btotal'], 0)) : 0;
  const jul293 = ST.groupSums({date: '2026-07-01', inds: I293});
  const yday293 = ST.groupSums({date: '2026-08-20', inds: I293});
  const row293 = ST.state.rows.find(r => r.obj === 'obj-borrower' && r.ref === '10510198203112' && r.date === ASK);
  row293.inds['m-btotal'] = {v: c293(row293.inds['m-btotal'].v + 1000)};
  const moved293 = ST.groupSums({date: ASK, inds: I293});
  const ydayAfter293 = ST.groupSums({date: '2026-08-20', inds: I293});
  ST.seed();
  const badAgg293 = ST.groupSums({date: ASK, inds: ['a-sumbtotal']});
  const badCnt293 = ST.groupSums({date: ASK, inds: ['m-bcnt']});
  const badCr293 = ST.groupSums({date: ASK, inds: ['m-debt']});
  const leg293 = ST.groupSums({date: '2025-01-01', inds: I293});
  ST.setRole('Аналитик');
  const an293 = ST.groupSums({date: ASK, inds: I293});
  ST.setRole('Администратор статистики');
  const gv = (r, g, m) => r.ok ? ((r.groups.find(x => x.group === g) || {values: {}}).values[m]) : null;
  ok(293, g293.ok && agree293 && g293.asOf === ASK && g293.rows === 5 && g293.members.length === 4 &&
        G1.values['m-btotal'] === 23769830.97 && G2.values['m-btotal'] === 18379040.65 &&
        g293.total['m-btotal'] === 31178072.67 && naive293 === 42148871.62 &&
        G1.n === 3 && G1.noRow.join() === '50101199500017' && G2.noRow.length === 0 &&
        has(g293.passport.dedup, '4 на 5') &&
        jul293.ok && jul293.groups.map(g => g.group).join() === 'ГСР-01' && jul293.rows === 3 &&
        gv(moved293, 'ГСР-01', 'm-btotal') === c293(23769830.97 + 1000) &&
        gv(moved293, 'ГСР-02', 'm-btotal') === 18379040.65 &&
        moved293.total['m-btotal'] === c293(31178072.67 + 1000) &&
        yday293.ok && gv(ydayAfter293, 'ГСР-01', 'm-btotal') === gv(yday293, 'ГСР-01', 'm-btotal') &&
        !badAgg293.ok && !badCnt293.ok && !badCr293.ok && has(badAgg293.why, 'ADR-0244 §2') &&
        !leg293.ok && has(leg293.why, 'ИС-41') &&
        an293.ok && an293.rows === 3 && gv(an293, 'ГСР-01', 'm-btotal') === 23769830.97 &&
        gv(an293, 'ГСР-02', 'm-btotal') === 10970798.95 && an293.total['m-btotal'] === 23769830.97 &&
        has(an293.passport.scope, 'через заёмщики'),
    `суммы группы — из строк заёмщиков-членов на ту же дату (ADR-0244 §2): у каждой группы и у итога расхождений с суммой строк заёмщиков нет (${agree293}). «${G1 ? G1.lbl : '—'}» — ${G1 ? G1.values['m-btotal'] : '—'} сом по ${G1 ? G1.n : '—'} членам, из них без строки заёмщика ${G1 ? G1.noRow.join() : '—'}: субъект без кредитов даёт НОЛЬ и из числа членов не выпадает; «${G2 ? G2.lbl : '—'}» — ${G2 ? G2.values['m-btotal'] : '—'}. Итог по всем группам ${g293.ok ? g293.total['m-btotal'] : '—'} — по ${g293.ok ? g293.members.length : '—'} различным членам на ${g293.ok ? g293.rows : '—'} строк членства, а сумма сумм групп ${naive293} посчитала бы 01234199010101 дважды (ADR-0199): «${g293.ok ? g293.passport.dedup : '—'}». На 01.07 групп ${jul293.ok ? jul293.groups.length : '—'} (${jul293.ok ? jul293.rows : '—'} строк). Правка строки заёмщика 10510198203112 на ${ASK} (+1000) сдвинула «Ала-Тоо» на ${ASK} до ${gv(moved293, 'ГСР-01', 'm-btotal')} и итог до ${moved293.ok ? moved293.total['m-btotal'] : '—'}, а 20.08 осталось ${gv(ydayAfter293, 'ГСР-01', 'm-btotal')} — join по дате строки, не по кануну. Не денежная величина заёмщика отбита: агрегат — «${String(badAgg293.why).slice(0, 70)}…», счётчик и деньги кредита — тоже (${!badCnt293.ok && !badCr293.ok}); дата до запуска — отказ ИС-41. Аналитику: строк ${an293.ok ? an293.rows : '—'}, «Ала-Тоо» ${gv(an293, 'ГСР-01', 'm-btotal')}, «Ош-Агро» ${gv(an293, 'ГСР-02', 'm-btotal')} — по видимым членам, итог ${an293.ok ? an293.total['m-btotal'] : '—'} (ИС-58, ADR-0243 §3)`);
})();
```

- [ ] **Step 2: Шапка и переписанные сторожа**

`шапка` (~120):

```diff
 // блок волны 23 З-19 — охват правилами (ИС-58, ADR-0243): own · via · open через ИЛИ; объект без
 // правила и правило без вида валят загрузку; общий печатает причину; via — на дату вопроса.
+// блок волны 23 З-20 — член группы совместного риска (ADR-0244 §2, ADR-0199): таблица членства
+// «группа × член × дата» без денег; суммы группы — из строк заёмщиков той же даты, итог — по
+// различным членам; охват через строку заёмщика-члена.
 // Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
 // render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
```

`сторож #1` (~228):

```diff
      а не копией, и путь — своя запись со своим именем (ИС-57, ADR-0241 §8, ADR-0206 §1). */
   const own1 = st.indicators.filter(i => !i.somOf), twin1 = st.indicators.filter(i => i.somOf);
-  ok(1, st.objects.length === 10 && st.indicators.length === 229 && own1.length === 155 &&
+/* Волна 23, З-20 (переписан на месте): объектов 11 и разрезов 87 — член группы совместного риска
+     со своими четырьмя разрезами (ADR-0244 §2); показателей у членства нет, кроме счёта. */
+  ok(1, st.objects.length === 11 && st.indicators.length === 229 && own1.length === 155 &&
        twin1.length === 74 && twin1.every(t => !!ST.IND(t.somOf)) &&
-       st.dims.length === 83 && ST.registry().length === 312 && badSrc.length === 0 &&
+       st.dims.length === 87 && ST.registry().length === 316 && badSrc.length === 0 &&
        formula.length === 0 && badFn.length === 0,
     `объектов ${st.objects.length}, показателей ${st.indicators.length} — ${own1.length} своих и ${twin1.length} сомовых сторон, и у каждой стороны валютная запись на месте; разрезов ${st.dims.length}, всего записей реестра ${ST.registry().length}. Счёт назван точным числом, а не «не меньше 85»: неравенство пережило бы молча потерю сотни записей, а потеря близнеца — это денежная величина, которую нельзя сложить по портфелю. Без объявленного источника ${badSrc.length}, с формулой ${formula.length} (сомовая сторона — не формула, а вторая колонка той же величины), с функцией вне списка ${badFn.length} — ИС-6, ИС-7, ИС-44`);
```

`сторож #6` (~333):

```diff
     return {name: o.name, ok: r.ok, n: r.ok ? r.n : 0, g: r.ok ? r.groups.length : 0};
   });
-  ok(6, each.every(x => x.ok && x.n > 0) && each.length === 10,
-    `десять объектов одним движком: ${each.map(x => x.name + ' ' + x.n + '/' + x.g + ' групп').join(' · ')}`);
+/* Волна 23, З-20 (переписан на месте): объектов одиннадцать — членство в группе (ADR-0244 §2). */
+  ok(6, each.every(x => x.ok && x.n > 0) && each.length === 11,
+    `одиннадцать объектов одним движком: ${each.map(x => x.name + ' ' + x.n + '/' + x.g + ' групп').join(' · ')}`);
 
   const cr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: ASK});
```

`сторож #89` (~1517):

```diff
   const guess = /первое звено|первый прогон|Object\.values\(item\.h\)/.test(
     m[1].slice(m[1].indexOf('function bornOn'), m[1].indexOf('function readPath')));
-  ok(89, declared.length === 10 && tbl89.ok && !noBorn.ok && has(noBorn.why, 'ИС-33') && !guess,
+/* Волна 23, З-20 (переписан на месте): у членства рождение объявлено — дата вступления «since». */
+  ok(89, declared.length === 11 && tbl89.ok && !noBorn.ok && has(noBorn.why, 'ИС-33') && !guess,
     `рождение объявлено, а не угадано: у всех ${declared.length} объектов born со ссылкой на реквизит владельца, объект без него не заводится даже с таблицей строк в релизе — «${noBorn.why}» (ИС-33, ИС-53)`);
 
```

`сторож #121` (~2034):

```diff
   });
   const orphan = st.indicators.filter(i => i.src === 'агрегат' && i.fn !== 'count' && !ST.IND(i.over));
-  ok(121, st.objects.length === 10 && !gone.ok && has(gone.why, 'нет в реестре объектов') &&
+/* Волна 23, З-20 (переписан на месте): объектов 11 — членство в группе добавлено релизом; снятое
+     задание кураторства по-прежнему снято. */
+  ok(121, st.objects.length === 11 && !gone.ok && has(gone.why, 'нет в реестре объектов') &&
         has(gone.why, 'ИС-18') && !inWorld && dangling.length === 0 && orphan.length === 0,
     `«Задание кураторства» снято СТРОКОЙ реестра, а не релизом: объектов ${st.objects.length}, спрос отвечает отказом — «${gone.why}», а не пустым экраном (ИС-24). Источник снят, а не спрятан: записей в мире 0, висячих ссылок на снятые разрезы и меры ${dangling.length}, агрегатов над несуществующей мерой ${orphan.length}. Владельца, ОТДАЮЩЕГО множество, у заданий нет: кураторство отказывается от них дословно (ТЗ 16 §1.1), своего ТЗ и места в очереди у них нет, ФО-20 ещё спрашивается у заказчика. Вернётся в день, когда владелец появится, — релизом: таблица строк и записи реестра (ИС-53, ADR-0237 §5; ADR-0201 §1)`);
```

`сторож #172` (~3386):

```diff
      у 745 строк объектов с валютой и пуст у прочих 1451 и у 34 легаси. */
   ok(172, a172.bad.length === 0 && a172.seen === 16109 && a172.som === 5075 && a172.flow === 1696 &&
-        a172.bal === 9338 && a172.fxOn === 745 && a172.fxOff === 1451 &&
-        dates172.length === 59 && objs172.length === 10 &&
-        own172.length === 2196 && leg172.length === 34 && legSom172 === 0 && leg172.every(r => r.fx === null),
+        /* Волна 23, З-20 (переписан на месте): +261 строка членства без валюты (5 в день с
+           02.07, 3 до того) — сомовых клеток в них нет, число клеток прежнее. */
+        a172.bal === 9338 && a172.fxOn === 745 && a172.fxOff === 1712 &&
+        dates172.length === 59 && objs172.length === 11 &&
+        own172.length === 2457 && leg172.length === 34 && legSom172 === 0 && leg172.every(r => r.fx === null),
     `сверено НЕ на примере, а на каждой записи: ${a172.seen} сомовых клеток в ${own172.length} строках ${objs172.length} объектов на всех ${dates172.length} датах строк (${dates172[0].slice(5)}…${dates172[dates172.length-1].slice(5)}), расхождений ${a172.bad.length}. Остатков ${a172.bal}: сомовое число обязано равняться валютной клетке той же строки, умноженной на КУРС СТРОКИ, по правилу округления, названному в записи; курс лежит в строке один раз (${a172.fxOn} строк объектов с валютой), у прочих ${a172.fxOff} его нет вовсе. Потоков ${a172.flow} и итогов в сомах ${a172.som} — с ядром на дату строки: их сомовое число — сумма операций по курсам их дней, одного курса у него нет, и перемножать в строке нечего (ИС-56, ADR-0240 §2–§4). Легаси-строк рядом ${leg172.length}, и сомовых клеток в них ${legSom172}: старая система близнеца не считала, и в её форме его НЕТ КЛЮЧОМ — не ноль и не пересчёт сегодняшним курсом (ИС-41, ADR-0207 §2)`);
 
```

`сторож #181` (~3669):

```diff
      агрегаты и пути вместе дают весь реестр. */
   const pathN = st.registry.filter(r => r.src === 'путь').length;
-  ok(181, st.registry.length === 312 && nInd === 229 && nDim === 83 && pathN === 1 &&
+/* Волна 23, З-20 (переписан на месте): записей 316, разрезов 87, строчных с колонками 198 — четыре
+     разреза членства (ключи group_id, member_id, подпись, состояние). */
+  ok(181, st.registry.length === 316 && nInd === 229 && nDim === 87 && pathN === 1 &&
         ownInd === 155 && somInd === 74 && somInd === 37 * 2 && !ST.REC('d-ocur') &&
         newDims.every(d => d && /валют/i.test(d.name) && ST.OBJ(d.obj).dims.indexOf(d.id) >= 0) &&
         newDims.map(d => d.obj).join(',') === 'obj-claim,obj-measure' &&
-        withCols === 194 && aggN === 117 && withCols + aggN + pathN === st.registry.length &&
+        withCols === 198 && aggN === 117 && withCols + aggN + pathN === st.registry.length &&
         somCols === 37 && ST.awaiting().length === 0,
     `реестр сверен со схемой, и число названо по факту, а не смягчено: ${st.registry.length} записей — ${nInd} породы «показатель» (${ownInd} своих и ${somInd} сомовых близнецов: ${somInd / 2} строчных и столько же агрегатов) и ${nDim} породы «разрез». Реестр сверен и с релизом: строчных записей с колонками ${withCols} (сомовых близнецов из них ${somCols}), агрегатов без колонки ${aggN}, ждущих колонку ${ST.awaiting().length} (ИС-53, ADR-0237 §3, §5). Своих разрезов валюты у объектов, заведённых волной 17, осталось два — ${newDims.map(d => d ? '«' + d.name + '» у ' + ST.OBJ(d.obj).name : '—').join(', ')}: разрез валюты дела снят вместе с валютой дела (${ST.REC('d-ocur') ? 'ОСТАЛСЯ' : 'снят'}), итоги дела только в сомах (ADR-0244 §4, ADR-0240 §4; ИС-40, ИС-44, ADR-0214 §1, ADR-0206 §3)`);
```

`сторож #201` (~4244):

```diff
   const onlyFirst201 = july201.length > 0 && july201.every(r => r.date === '2026-08-01');
   ok(201, c201.ok && c201.full === false && c201.n === 30 && r201.cand.n === 30 &&
-        r201.written === 42 && r201.copied === 12 && r201.same === 0 && r201.skip === 34 &&
-        r201.written + r201.skip === 76 &&
+        /* Волна 23, З-20 (переписан на месте): +5 строк членства в ночь — соседи их не
+           называют, и они копируются (ИС-54): написано 47, скопировано 17, живых 81. */
+        r201.written === 47 && r201.copied === 17 && r201.same === 0 && r201.skip === 34 &&
+        r201.written + r201.skip === 81 &&
         Object.keys(j201.cand.by).length === 4 &&
         Object.keys(j201.cand.by).join(' · ') === 'опрос · критическая дата · свой факт · очередь' &&
```

`сторож #202` (~4313):

```diff
         run202.ok && usd202.rate === 91.10 && usd202.rateDate === eve(TODAY) &&
         ev202.length === 3 && ev202.every(p => p.n === 0) &&
-        run202.written === flat202.written && flat202.written === 42 &&
+        /* Волна 23, З-20 (переписан на месте): 42 → 47 — пять строк членства (довод у #201). */
+        run202.written === flat202.written && flat202.written === 47 &&
         new Set(only202.map(k => k.split('|')[0])).size === 2,
     `критическая дата — СВОЁ множество, а не тень опроса (ADR-0193 × ADR-0221 §1). В обычную ночь курс не двигался, и множество пусто (${bare202.by['критическая дата'].length}, валют ${bare202.moved.length}); уточним курс доллара задним числом на ${TODAY} — и в кандидаты приходит ${kd202.length} записей с названной причиной («${String((c202.by['критическая дата'][0] || {}).why)}»). Ключевое здесь ${only202.length}: столько из них НЕ НАЗВАЛ НИ ОДИН сосед, когда ответ соседей заморожен на канун, — у ядра по этим записям не изменилось ничего, изменилось ВРЕМЯ. Записи эти лежат в ${new Set(only202.map(k => k.split('|')[0])).size} объектах (${kd202.join(', ')}), и ночь без множества 2 прошла бы мимо них молча: курс ${usd202.rate} от ${usd202.rateDate} лёг в строку USD-кредита. Событий в множестве нет — их деньги читаются на день события, и курс ночи их не двигает (СС-171): частей событий в прогоне ${ev202.length}, переписанных строк в них ${ev202.reduce((n, p) => n + p.n, 0)}, написано ${run202.written} против ${flat202.written} без уточнения. Обратная сторона правила: курс из сравнения значений соседа ВЫЧЕРКНУТ (bareOf) — войди он туда, множество 2 выводилось бы из множества 1, и независимость четырёх множеств была бы словами (ИС-48)`);
```

`сторож #206` (~4439):

```diff
         add206.ok && twice206.ok && ST.queueWhy().length === 3 && c206.n === 31 &&
         c206.by['очередь'].length === 1 && has(c206.by['очередь'][0].why, 'распоряжение') &&
-        run206.written === 42 && run206.copied === 11 && run206.same === 1 && run206.skip === 34 &&
+        /* Волна 23, З-20 (переписан на месте): 42 → 47, копий 11 → 16 — довод у #201. */
+        run206.written === 47 && run206.copied === 16 && run206.same === 1 && run206.skip === 34 &&
         open206 === 0 && all206 === 1 &&
         done206.done.how === 'обойдён прогоном' &&
```

`сторож #212` (~4706):

```diff
      поправка `match` ПП-2026/0620 на 05.07 (СС-180; довод у #116). Итог 01.08 — прежние 40. */
   ok(212, base212.ok && base212.made === 0 && !('dense' in base212) && base212.refreshed === 0 &&
-        r212.ok && r212.made === 0 && r212.refreshed === 2 && r212.fixed === 53 &&
+        /* Волна 23, З-20 (переписан на месте): зафиксировано больше на строки членства итога
+           июля — число по факту пробы. */
+        r212.ok && r212.made === 0 && r212.refreshed === 2 && r212.fixed === 58 &&
         j212.kind === 'защёлка' && j212.written === 2 &&
         j212.written === j212.repoll.again &&
```

`сторож #228 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5319):

```diff
            Волна 23, З-15b: 30 → 42 — у состояния строка каждый день, некандидату копия
            (ИС-54, довод у #201). */
-        run228.ok && run228.written === 42 && run228.date === '2026-08-22' &&
+        /* Волна 23, З-20: 42 → 47 — пять строк членства (довод у #201). */
+        run228.ok && run228.written === 47 && run228.date === '2026-08-22' &&
         legBefore === 34 && legAfter === 34 && touched === 0 &&
         ST.queue().length === 0 &&
```

`сторож #256 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~5920):

```diff
   const copyEq = zd.length === 5 && zd.every(x => { const y = zy.find(z => z.ref === x.ref);
     return y && JSON.stringify([x.dims, x.inds, x.when]) === JSON.stringify([y.dims, y.inds, y.when]) && !x.fixed; });
-  ok(256, states256.length === 7 && days256.length >= 50 && holes256.length === 0 &&
-        r256.ok && !c256.full && r256.copied === nonCand && r256.copied === 12 &&
-        r256.written === 42 && r256.skip === 34 &&
+/* Волна 23, З-20 (переписан на месте): объектов-состояний 8, копий 17, написано 47 — членство
+     копируется каждую ночь, как всякое состояние, которое никто не назвал (ИС-54). */
+  ok(256, states256.length === 8 && days256.length >= 50 && holes256.length === 0 &&
+        r256.ok && !c256.full && r256.copied === nonCand && r256.copied === 17 &&
+        r256.written === 47 && r256.skip === 34 &&
         part256('obj-borrower').copied === 2 && part256('obj-zdeal').copied === 5 && part256('obj-program').copied === 5 &&
+        part256('obj-gmember').copied === 5 &&
         evCopied === 0 && copyEq &&
         stParts.every(p => p.skip === 0 && p.written === p.n + p.same + p.copied &&
           p.n + p.same + p.copied + p.kept === ST.registryList(p.obj, TODAY).length),
-    `строка каждый день (ИС-54, ADR-0238 §1): у ${states256.length} объектов-состояний на ${days256.length} дат открытого периода строк ровно столько, сколько живых записей у владельца, — дыр ${holes256.length}${holes256.length ? ' (' + holes256.slice(0, 5).join(', ') + ')' : ''}. Ночь ${TODAY}: написано ${r256.written}, из них скопировано ${r256.copied} — ровно столько, сколько живых записей ночь не назвала кандидатами (${nonCand}) (заёмщиков ${part256('obj-borrower').copied}, договоров ${part256('obj-zdeal').copied}, программ ${part256('obj-program').copied}) — копия равна вчерашней строке значениями и происхождением (${copyEq}), дата своя, фиксации нет. События не копируются (${evCopied}) и не обходятся некандидатами (${r256.skip}). Тождество части: написано = пересчитано + без изменений + скопировано, и вместе с зафиксированными это все живые (СС-164)`);
+    `строка каждый день (ИС-54, ADR-0238 §1): у ${states256.length} объектов-состояний на ${days256.length} дат открытого периода строк ровно столько, сколько живых записей у владельца, — дыр ${holes256.length}${holes256.length ? ' (' + holes256.slice(0, 5).join(', ') + ')' : ''}. Ночь ${TODAY}: написано ${r256.written}, из них скопировано ${r256.copied} — ровно столько, сколько живых записей ночь не назвала кандидатами (${nonCand}) (заёмщиков ${part256('obj-borrower').copied}, договоров ${part256('obj-zdeal').copied}, программ ${part256('obj-program').copied}, членств ${part256('obj-gmember').copied}) — копия равна вчерашней строке значениями и происхождением (${copyEq}), дата своя, фиксации нет. События не копируются (${evCopied}) и не обходятся некандидатами (${r256.skip}). Тождество части: написано = пересчитано + без изменений + скопировано, и вместе с зафиксированными это все живые (СС-164)`);
 
   /* #257 — пропущенная ночь не оставляет дыры: прогон сперва ДОГОНЯЕТ каждую пропущенную
```

`сторож #258 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~5999):

```diff
      раньше не трогает (правка ревью 1 З-16a). Сторож не о них. */
   const stW258 = j258.parts.filter(p => stor(p.obj) === 'state').reduce((n, p) => n + p.written, 0);
-  ok(258, re258.ok && stW258 === 42 && re258.copied === 0 && j258.cand.scan === 'полный' &&
+/* Волна 23, З-20 (переписан на месте): 42 → 47 — пять строк членства (довод у #201). */
+  ok(258, re258.ok && stW258 === 47 && re258.copied === 0 && j258.cand.scan === 'полный' &&
         /* Волна 23, З-17 (переписан на месте): уточнённый курс не двигает валютного числа —
            перезапись называет курс строки и сомовые стороны, а не «Остаток ОД» (ИС-56). */
```

`сторож #264 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~6286):

```diff
   const stNull = ST.state.rows.filter(r => stor(r.obj) === 'state').every(r => r.part === null);
   const dKinds = ST.state.rows.filter(r => stor(r.obj) === 'event_delta').every(r => KINDS.indexOf(r.part) >= 0);
-  ok(264, ids264.length === 10 && off264.length === 0 && own264.length === 0 &&
+/* Волна 23, З-20 (переписан на месте): таблиц 11 — stat_row_group_member хранит состояние. */
+  ok(264, ids264.length === 11 && off264.length === 0 && own264.length === 0 &&
         ev264 === 'obj-measure,obj-receipt,obj-repay' && evCopies === 0 &&
         juneRows.length === 4 && juneRows.every(r => ST.periodOf(r.date) === '2026-06' && !!r.fixed && r.part === 'original') &&
```

`сторож #268 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~6761):

```diff
   const goneOk268 = gone268.r && gone268.cl && gone268.before === '2026-06-06:original*,2026-07-20:reversal*,2026-07-20:rebind*' &&
     gone268.after === gone268.before && gone268.mk === 1 && gone268.mkAfter === 1 && gone268.rw === 0 && wG268 === 0;
-  ok(268, !!wr && objs268.length === 10 && denied.length === 10 && pass268.ok && leg268.ok &&
+/* Волна 23, З-20 (переписан на месте): таблиц 11 — запись в закрытое отбита и у членства. */
+  ok(268, !!wr && objs268.length === 11 && denied.length === 11 && pass268.ok && leg268.ok &&
         grew268 && refused268 && tally268 && goneOk268,
     `запись в закрытое отбита у ${denied.length} таблиц из ${objs268.length} одной функцией — и на 15.06, и на итог июня 01.07 (ИС-8, ADR-0239): разойдись проверка по писателям, поправка события однажды легла бы в закрытый месяц. Поправка в открытый август проходит (${pass268.ok}), выпуск миграции в легаси-период — тоже (${leg268.ok}). Отбитая запись не считается написанной: прогон за закрытое 15.06 написал ${w268} (не тронуто ${j268.parts.reduce((n, p) => n + p.kept, 0)}), доспрос закрытого июня — ${rp268.made} + ${rp268.again}, повторный выпуск миграции — ${leg268n}. Счёт и журнал — после удачной записи: рождено ${j268.parts.reduce((n, p) => n + p.born, 0)}, дозаполнено ${j268.parts.reduce((n, p) => n + p.filled.length, 0)}, тождество «написано = записано + не менялось + скопировано» у состояний — ${j268.parts.filter(p => stor(p.obj) === 'state').every(p => p.written === p.n + p.same + p.copied)} (у заёмщиков «не менялось» ${(j268.parts.find(p => p.obj === 'obj-borrower') || {}).same}, не тронуто ${(j268.parts.find(p => p.obj === 'obj-borrower') || {}).kept}). Снятие поправок идёт через ту же дверь: перепривязка ночи 20.07 после закрытия июля и прогона 20.07 мимо дверей — строк ${gone268.after || '—'} (было ${gone268.before || '—'}), маркеров ${gone268.mk} → ${gone268.mkAfter}, в журнале перезаписей ${gone268.rw}`);
```

`сторож #282 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~7656):

```diff
     W['obj-measure'].filter(m => (m.h.mstate || []).some(x => ['действует', 'сторнирована'].indexOf(x[1]) < 0)).length;
   const legacy282 = ST.state.rows.filter(r => ST.isLegacyRow(r)).length;
-  ok(282, shape282.length === 0 && nCk282 === 19 && bad282.length === 0 && legacy282 > 0 && corr282.length === 0 &&
+/* Волна 23, З-20 (переписан на месте): списков 20 — состояние группы d_group_state. */
+  ok(282, shape282.length === 0 && nCk282 === 20 && bad282.length === 0 && legacy282 > 0 && corr282.length === 0 &&
         pay282 === 'pending,confirmed,reversed' && msr282 === 'действует,сторнирована' && old282 === 0,
     `закрытый словарь — список значений в релизе: у ${nCk282} колонок вида «code» и вида поправки события списки лежат у таблиц, таблиц со списком не на месте ${shape282.length} (${shape282.join(', ') || '—'}); значений вне списка в ${ST.state.rows.length} хранимых строках, из них ${legacy282} легаси, — ${bad282.length}${bad282.length ? ' (' + bad282.slice(0, 3).join('; ') + ')' : ''}; объявленный вид поправки вне списка своей таблицы — у ${corr282.length} объектов. Словари, которые выводит сама статистика, — по схеме: состояние платежа ${pay282}, состояние меры ${msr282}; записей мира с прежними словами ${old282} (ИС-57, ADR-0241 §2, СС-193, СС-194)`);
```

`сторож #288 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~7961):

```diff
   ok(288, errs288.length === 0 && st288.objects.every(o => Array.isArray(o.scope) && o.scope.length >= 1) &&
         (kinds288.own || []).join() === 'obj-credit,obj-borrower,obj-collateral,obj-claim,obj-repay,obj-measure' &&
-        (kinds288.via || []).join() === 'obj-case,obj-measure' &&
+        /* Волна 23, З-20 (переписан на месте): членство режется через строку заёмщика. */
+        (kinds288.via || []).join() === 'obj-gmember,obj-case,obj-measure' &&
         (kinds288.open || []).join() === 'obj-zdeal,obj-program,obj-receipt' &&
         has(noRule, 'правил охвата нет') && has(noKind, 'без вида') && has(noWhy, 'причина не названа') &&
```

`сторож #289 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~7996):

```diff
         has(bRows.passport.scope, 'ведущий куратор') && bRows.passport.scoped === true &&
         lead.src === 'шов' && lead.seam === 'leadCurator' && noHist289 === 0 &&
-        pairs289.length === 7 && drift289.length === 0,
+        /* Волна 23, З-20 (переписан на месте): пар 8 — членство через заёмщика. */
+        pairs289.length === 8 && drift289.length === 0,
     `own — своя колонка строки: заёмщиков на ${ASK} ${bAll.length}, аналитику видно ${bRows.ok ? bRows.rows.length : '—'} по ведущему куратору — «${bRows.ok ? bRows.passport.scope : '—'}»; реестр владельца отдаёт тех же ${bReg.length}. Ведущий куратор — шов «${lead.seam}», истории «curator» у заёмщика нет ни в одной записи мира (${noHist289}), и охват читается тем же читателем, что разрез. Срез и реестр владельца сходятся у всех ${pairs289.length} объектов с правилами own и via, расхождений ${drift289.length}${drift289.length ? ' (' + drift289.map(x => x.id + ' ' + x.slice + '/' + x.reg).join(', ') + ')' : ''} (ИС-14, ИС-18, ИС-58)`);
 
```

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL, среди них `#1`, `#6`, `#181`, `#292`, `#293` — объекта нет.

- [ ] **Step 4: Движок**

`const REGISTRY = [` (~1701):

```diff
    since:'2020-01-01', owner:'Субъекты',
    note:'действует · смерть · ликвидирован · долг переведён; реорганизация — «действует» (СС-141, волна 23)'},
+  /* Член группы совместного риска (ADR-0244 §2, схема §3). Группа и член — КЛЮЧ строки
+     (`group_id`, `member_id`), и оба — разрезы: срез «по группам» группирует по первому, а
+     второй — ключ join к строке заёмщика той же даты. Ключевые колонки служебные, как `cur`
+     у денег, — и, как у `cur`, на них ссылаются записи реестра. */
+  {kind:'разрез', id:'d-ggroup', col:'group', vtype:'id', obj:'obj-gmember', name:'Группа совместного риска', src:'поле', key:'group',
+   since:'2020-01-01', owner:'Субъекты', note:'ключ строки group_id (схема §3.1)'},
+  {kind:'разрез', id:'d-gmember', col:'member', vtype:'id', obj:'obj-gmember', name:'Член группы совместного риска', src:'поле', key:'member',
+   since:'2020-01-01', owner:'Субъекты', note:'ключ строки member_id и ключ join к stat_row_borrower (схема §3.1)'},
+  {kind:'разрез', id:'d-glbl', col:'d_group_lbl', vtype:'text', obj:'obj-gmember', name:'Название группы', src:'история', key:'glbl',
+   since:'2020-01-01', owner:'Субъекты', note:'название группы на дату (схема §3.2)'},
+  {kind:'разрез', id:'d-gstate', col:'d_group_state', vtype:'code', obj:'obj-gmember', name:'Состояние группы', src:'история', key:'gstate',
+   since:'2020-01-01', owner:'Субъекты', note:'действует · распущена (схема §3.2)'},
   {kind:'разрез', id:'d-bform', col:'d_form', vtype:'ref', obj:'obj-borrower', name:'Организационно-правовая форма', src:'поле', key:'bform', since:'2020-01-01',
    owner:'Заёмщики', note:'ТЗ 16 — соседний ряд просит её вместе с видом лица и территорией'},
```

`const OBJECTS = [` (~2321):

```diff
      когда владелец отдаст его множество. Волна 23 сняла «валюту оценки» и «застрахован»:
      оценка всегда в сомах, страховка в схеме — состояние, а не булево (ADR-0244 §4). */
+  /* Член группы совместного риска — объект статистики с таблицей членства (ADR-0244 §2,
+     ADR-0213). У заёмщика групп может быть несколько, и разрезом заёмщика группа быть не может
+     (ADR-0179): строка — «группа × член × дата», адрес строки — пара ключей. Показателей у
+     членства нет — суммы группы берутся из строк заёмщиков-членов той же даты (`ST.groupSums`).
+     Охват — через строку заёмщика-члена на дату вопроса (ADR-0243 §3). */
+  {id:'obj-gmember', name:'Член группы совместного риска', plural:'члены групп совместного риска', owner:'Субъекты',
+   refName:'группа · член', born:{src:'поле', key:'since'},
+   scope:[{kind:'via', obj:'obj-borrower', key:'d-gmember'}],
+   dims:['d-ggroup','d-gmember','d-glbl','d-gstate'],
+   inds:['a-count']},
   {id:'obj-collateral', name:'Залог', plural:'предметы залога', owner:'Залог', refName:'номер предмета',
    born:{src:'поле', key:'adm'}, scope:[{kind:'own', dim:'d-ccurator'}],
```

`const WORLD = {` (~2927):

```diff
      mstate:[['2026-08-09','действует'],['2026-08-14','сторнирована']]}, {})
 ],
-/* Одиннадцатый объект: данные владельца есть, записи в OBJECTS нет и таблицы строк в
+/* Члены групп совместного риска — данные «Субъектов» (ADR-0213): адрес записи — «группа ·
+   член». 01234199010101 состоит в двух группах; 50101199500017 — субъект без кредитов: строки
+   заёмщика у него нет (ADR-0244 §3), и в сумме группы он даёт ноль. Группа «Ош-Агро» заведена
+   01.07.2026 — до этой даты строк её членства нет. */
+'obj-gmember': [
+  it('ГСР-01 · 01234199010101', {group:'ГСР-01', member:'01234199010101', since:'2025-06-01'},
+    {glbl:[['2025-06-01','Группа «Ала-Тоо»']], gstate:[['2025-06-01','действует']]}, {}),
+  it('ГСР-01 · 10510198203112', {group:'ГСР-01', member:'10510198203112', since:'2025-06-01'},
+    {glbl:[['2025-06-01','Группа «Ала-Тоо»']], gstate:[['2025-06-01','действует']]}, {}),
+  it('ГСР-01 · 50101199500017', {group:'ГСР-01', member:'50101199500017', since:'2025-06-01'},
+    {glbl:[['2025-06-01','Группа «Ала-Тоо»']], gstate:[['2025-06-01','действует']]}, {}),
+  it('ГСР-02 · 01234199010101', {group:'ГСР-02', member:'01234199010101', since:'2026-07-01'},
+    {glbl:[['2026-07-01','Группа «Ош-Агро»']], gstate:[['2026-07-01','действует']]}, {}),
+  it('ГСР-02 · 22903197505433', {group:'ГСР-02', member:'22903197505433', since:'2026-07-01'},
+    {glbl:[['2026-07-01','Группа «Ош-Агро»']], gstate:[['2026-07-01','действует']]}, {})
+],
+/* Двенадцатый объект: данные владельца есть, записи в OBJECTS нет и таблицы строк в
    релизе нет. Без релиза ST.addObject ему отказывает (ИС-53, ADR-0237 §5); путь «миграция
    таблицы → объект → записи» проверяет смоук (#9). Поручительство снято моделью
```

`const VTYPES = {` (~3727):

```diff
      находка СС-Д19 волны 23. Вид заведён здесь, чтобы запись легла на колонку честно,
      а не через `ref` с несуществующей подписью `_lbl`. */
-  id:['_id']
+  id:['_id'],
+  /* Подпись без пары-ключа — `d_group_lbl` членства в группе (схема §3.2): id группы лежит в
+     ключе строки `group_id`, и пары `d_group_id` у таблицы нет. В перечне `value_type` схемы
+     (§12.1) такого вида тоже нет — находка СС-Д27 волны 23, того же рода, что СС-Д19 у `id`. */
+  text:['']
 };
 /* Колонки релиза записаны сжато, как в самой схеме (§0.2): служебные — именами, остальное —
```

`const RELEASE = {id:'макет · волна 23', tables:{` (~3752):

```diff
      money_som:['i_secured','i_secliq'],
      int:['i_overdue_days','i_disputed_days','i_npay_days','i_full_days']})},
+  /* Член группы совместного риска — таблица ЧЛЕНСТВА «группа × член × дата» (ADR-0244 §2,
+     схема §3): своих сумм у группы нет, они берутся из строк заёмщиков-членов той же даты. */
+  'obj-gmember':    {table:'stat_row_group_member', storage:'state',     cols: relCols(
+    ['group_id','member_id','slice_date','run_id','src_subj','now_cols'],
+    {text:['d_group_lbl'], code:['d_group_state']})},
   'obj-borrower':   {table:'stat_row_borrower',   storage:'state',       cols: relCols(
     ['object_id','slice_date','run_id','src_core','src_class','src_curation','src_detail','is_partial','now_cols'],
```

`const RELEASE_CHECKS = {` (~3815):

```diff
   'obj-credit':     {d_status:['действующий','погашен'],
                      d_cov_state:['обеспечен','ниже порога','доля ликвида ниже 80 %','без обеспечения']},
+  'obj-gmember':    {d_group_state:['действует','распущена']},
   'obj-borrower':   {d_ptype:['юридическое лицо','индивидуальный предприниматель','физическое лицо'],
                      d_sstate:['действует','смерть','ликвидирован','долг переведён'],
```

`ST.statSlice = q => {` (~8093):

```diff
       {levels: q.levels, buckets: q.buckets, colDim: q.colDim}));
 };
+/* СУММЫ ГРУППЫ — ИЗ СТРОК ЗАЁМЩИКОВ-ЧЛЕНОВ НА ТУ ЖЕ ДАТУ (ADR-0244 §2, ADR-0199, СС-200).
+   Своих сумм у группы нет: вторая копия денег, уже лежащих в строках заёмщиков, разъехалась
+   бы с ними при первом платеже. Группа — join строк членства со строками заёмщиков той же даты
+   по ключу члена; итог по всем группам считает заёмщика ОДИН раз, сколько бы групп его ни
+   держало (ADR-0199); член без кредитов строки заёмщика не имеет и даёт НОЛЬ — в группе он
+   есть, денег за ним нет, и из числа членов он не выпадает. Охват — у строк членства (via
+   заёмщик, ADR-0243 §3): сумма группы под ролью — по видимым членам. */
+ST.groupSums = q => {
+  const st = ST.state;
+  const bad = checkQuery({obj:'obj-gmember', date: q.date, dims:[], inds:[]}, false);
+  if(bad) return {ok:false, why: bad};
+  const inds = q.inds || [];
+  /* Своя величина строки заёмщика и денежная: у агрегата признака денег нет — в строке он
+     не лежит (ИС-3), — и отдельной ветки на него не нужно. */
+  for(const m of inds){
+    const I = IND(m);
+    if(!I || I.obj !== 'obj-borrower' || !I.money)
+      return {ok:false, why:'сумма группы берётся из денежной величины строки заёмщика: «'+m+'» ею не является (ADR-0244 §2)'};
+  }
+  const res = resolveAsOf(st, 'obj-gmember', q.date);
+  if(!res) return {ok:false, why:'строк членства на '+fmt(q.date)+' и ранее нет: подстановка запрещена (ИС-12)'};
+  const mem = applyScope(rowsAsOf(st, 'obj-gmember', res.asOf), 'obj-gmember', res.asOf);
+  const bor = new Map(rowsAsOf(st, 'obj-borrower', res.asOf).map(r => [r.ref, r]));
+  const sum = (refs, m) => cents(refs.reduce((a, ref) => {
+    const c = (bor.get(ref) || {inds: {}}).inds[m];
+    return a + (c && c.v != null ? c.v : 0);
+  }, 0));
+  const byG = new Map();
+  mem.forEach(r => {
+    const g = r.dims['d-ggroup'];
+    if(!byG.has(g)) byG.set(g, {group: g, lbl: r.dims['d-glbl'] || g, members: []});
+    byG.get(g).members.push(r.dims['d-gmember']);
+  });
+  const groups = [...byG.values()].sort((a, b) => a.group.localeCompare(b.group)).map(g => ({
+    group: g.group, lbl: g.lbl, members: g.members.slice().sort(), n: g.members.length,
+    noRow: g.members.filter(x => !bor.has(x)).sort(),
+    values: inds.reduce((a, m) => { a[m] = sum(g.members, m); return a; }, {})}));
+  const all = [...new Set(mem.map(r => r.dims['d-gmember']))].sort();
+  const total = inds.reduce((a, m) => { a[m] = sum(all, m); return a; }, {});
+  return {ok:true, asOf: res.asOf, groups, total, members: all, rows: mem.length,
+    passport: {scope: scopeText('obj-gmember', mem.length),
+      dedup: 'итог по всем группам — по различным членам: '+all.length+' на '+mem.length+' строк членства (ADR-0199)'}};
+};
 /* Узел ищется по всему дереву: детализация родителя обязана открываться так же,
    как детализация листа. */
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 273/273 PASS` (проверено на копии).

- [ ] **Step 6: Мутация**

Итог группы — сумма сумм групп, а не по различным членам (`const total = inds.reduce((a, m) =>
{ a[m] = sum(all, m); …` → `cents(groups.reduce((s, g) => s + g.values[m], 0))`) → `#293` RED
(272/273): заёмщик `01234199010101` в обеих группах посчитан дважды. Проверено.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-20 — член группы совместного риска, суммы группы из строк членов"
```

| Переписан | Почему |
|---|---|
| `#1`, `#6`, `#89`, `#121`, `#264`, `#268` | объектов 11 → 12 |
| `#172`, `#181`, `#201`, `#202`, `#206`, `#212`, `#228`, `#256`, `#258` | строк, записей и колонок больше на членства (`#212` — 58 зафиксированных, по пробе) |
| `#282` | списков закрытых словарей 19 → 20 (`d_group_state`) |
| `#288`, `#289` | у членства правило `via`; пар «срез ↔ реестр владельца» 8 |

### Task 9: З-21 — признак «текущее» массивом имён величин (`ADR-0242`)

Спецификация §4 З-21. Решения — `СС-201`, `СС-202`. Правки — разностью по функциям, как в
Task 6b; `~N` — по снимку после З-20.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `markDating` — копит массив `ask.now`; «на дату» — пустая операция; новая `datingOf`;
  - сомовая сторона (`readInd`) — признак ставится ПОСЛЕ того, как значение посчитано, и
    равен признаку валютной; имя базы снимается, если его добавило только это чтение;
  - `buildRow` — `now: []` / `now: ask.now`; `ROW_SHAPE` — `now` вместо `when`;
    `ROW_ORIGIN = ['now']`; `eventRow` — `now: row.now`, имя снимается, если разрез-состояние
    события пуст; `loadLegacy` — `now = []`; поправка без сумм — `now` только из разрезов;
  - новая `nowBad(row)` — перед `writeRow`; `writeRow` — `DEFAULT []` и отказ (`ADR-0242` §5);
  - `datingNote`, клетки карточки — через `datingOf`; `ST.datingOf`, `ST.nowCols(row)`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#3`, `#209`, `#211`,
  `#223`, `#256`; блок З-21 (`#294`, `#295`) перед отчётом.

**Interfaces:**
- Consumes: `markDating`, `DATING`, `readInd`, `readDim`, `buildRow`, `eventRow`, `copyRow`,
  `writeRow`, `ST.OBJ`, `ST.registry()` (`somOf`), `st.release.tables` (физические имена).
- Produces:
  - поле строки `now` — массив имён величин и разрезов, собранных «текущими»; не названное —
    «на дату»; пустой массив — «всё на дату» (легаси) (`СС-201`); копия переносит массив как
    есть, пересчёт пишет заново; молчание соседа имени не даёт;
  - `datingOf(row, id)` → `DATING.NOW` | `DATING.ASOF`; `ST.datingOf`;
  - `ST.nowCols(row)` → физические имена (`now_cols`): сомовая сторона — колонка базы, разрез
    с уровнями — колонки уровней;
  - `nowBad(row)` — не массив · имя вне величин объекта · имя без значения · повтор; `writeRow`
    отбивает до записи, строку без `now` кладёт с `[]` (`СС-202`).

- [ ] **Step 1: Падающие сторожа `#294`, `#295`**

Перед `/* ---- отчёт ---- */`, после блока З-20:

```js
/* ===== Волна 23 · З-21 — признак «текущее» массивом имён (ADR-0242, СС-201, СС-202) =====
   Карта `when` «величина → слово» снята: в строке — массив `now` имён величин, собранных
   «текущими»; не названная величина — «на дату». Копия переносит массив как есть, пересчёт
   пишет заново; величина молчавшего соседа в массив не попадает; имя сверяется дверью записи. */
(() => {
  /* #294 — массив имён вместо карты слов, и он замерзает со строкой. Проверяется на всей
     витрине (формы `when` нет ни у одной строки), на копии (переносит массив вчерашней
     строки как есть) и на пересчёте (пишет его заново, даже если вчерашний стёрт), на
     молчании соседа (имени без величины нет) и на паспорте (одно слово из трёх). */
  ST.seed();
  const st294 = ST.state;
  const noArr294 = st294.rows.filter(r => !Array.isArray(r.now) || 'when' in r).length;
  const leg294 = st294.rows.filter(r => ST.isLegacyRow(r));
  const own294 = st294.rows.filter(r => !ST.isLegacyRow(r));
  const full294 = own294.filter(r => r.now.length > 0).length;
  /* Пустой массив — «всё на дату», а не «признак не известен»: у легаси-строки читается «на
     дату» каждая величина (ADR-0242, «не названная — на дату»). */
  const legDate294 = leg294.every(r => Object.keys(r.inds).concat(Object.keys(r.dims))
    .every(id => ST.datingOf(r, id) === 'на дату'));
  const alien294 = st294.rows.filter(r => r.now.some(id => {
    const o = ST.OBJ(r.obj);
    return (o.dims.indexOf(id) < 0 && o.inds.indexOf(id) < 0) || !((r.dims[id] != null) || (r.inds[id] != null));
  })).length;
  /* Сомовая сторона — та же величина: её признак равен признаку валютной (ADR-0242 §1). */
  const twins294 = ST.registry().filter(x => x.somOf);
  const pair294 = st294.rows.filter(r => twins294.some(t => r.inds[t.id] != null && r.inds[t.somOf] != null &&
    (r.now.indexOf(t.id) >= 0) !== (r.now.indexOf(t.somOf) >= 0))).length;
  const u294 = st294.rows.find(r => r.obj === 'obj-credit' && r.ref === 'КД-2025/043' && r.date === ASK);
  const cols294 = ST.nowCols(u294);
  const cl294 = st294.rows.find(r => r.obj === 'obj-collateral' && r.ref === 'ЗЛ-2024/41' && r.date === ASK);
  /* Копия переносит, пересчёт пишет заново. У вчерашних строк состояний массив стёрт: ночь
     22.08 копирует некандидатов — их массив остаётся пустым, как у вчерашней строки, — а
     пересчитанным пишет свой. */
  const run294a = ST.run(TODAY);
  const j294a = st294.runs[st294.runs.length - 1];
  const copied294 = j294a.parts.reduce((n, p) => n + (p.copied || 0), 0);
  const copies294 = st294.rows.filter(r => r.date === TODAY && ['obj-zdeal', 'obj-program', 'obj-gmember'].indexOf(r.obj) >= 0);
  const carried294 = copies294.filter(r => {
    const y = st294.rows.find(x => x.obj === r.obj && x.ref === r.ref && x.date === ASK);
    return y && y.now.length > 0 && JSON.stringify(y.now) === JSON.stringify(r.now);
  }).length;
  ST.seed();
  const stS294 = ST.state.objects.filter(o => ST.storageOf(o.id) === 'state').map(o => o.id);
  ST.state.rows.filter(r => r.date === ASK && stS294.indexOf(r.obj) >= 0).forEach(r => { r.now = []; });
  const run294b = ST.run(TODAY);
  const todays294 = ST.state.rows.filter(r => r.date === TODAY && stS294.indexOf(r.obj) >= 0);
  const blank294 = todays294.filter(r => r.now.length === 0);
  const blankBy294 = blank294.reduce((a, r) => { a[r.obj] = (a[r.obj] || 0) + 1; return a; }, {});
  const credT294 = todays294.filter(r => r.obj === 'obj-credit');
  const fresh294 = credT294.length === 8 && credT294.every(r => r.now.length > 0 &&
    JSON.stringify(r.now) === JSON.stringify(ST.buildRow('obj-credit', vm.runInContext('WORLD', sandbox)['obj-credit'].find(w => w.id === r.ref), TODAY).now));
  ST.seed();
  /* Молчание соседа — отсутствие, а не «текущее» (ADR-0242, «Границы»; ADR-0208 §1). */
  const itC294 = vm.runInContext('WORLD', sandbox)['obj-collateral'].find(w => w.id === 'ЗЛ-2024/41');
  const talk294 = ST.buildRow('obj-collateral', itC294, ASK);
  const mute294 = ST.buildRow('obj-collateral', itC294, ASK, {'ядро': 'недоступен'});
  const gone294 = talk294.now.filter(id => mute294.now.indexOf(id) < 0).sort();
  const muteOk294 = mute294.now.every(id => (mute294.dims[id] != null) || (mute294.inds[id] != null)) &&
    gone294.every(id => mute294.inds[id] == null && mute294.dims[id] == null);
  /* Паспорт — одно слово из трёх по запрошенным величинам (ADR-0242 §4). */
  const w294 = q => { const s = ST.statSlice(Object.assign({obj: 'obj-collateral', date: ASK}, q)); return s.ok ? s.passport.dating : {word: s.why, now: []}; };
  const pNow294 = w294({dims: ['d-collkind'], inds: ['a-count']});
  const pAsof294 = w294({dims: ['d-cbranch'], inds: ['a-sumcpledge']});
  const pMix294 = w294({dims: ['d-collkind'], inds: ['a-sumcpledge']});
  ok(294, noArr294 === 0 && ST.ROW_ORIGIN.join() === 'now' && ST.ROW_SHAPE.indexOf('when') < 0 &&
        leg294.length === 34 && leg294.every(r => r.now.length === 0) && legDate294 && alien294 === 0 && pair294 === 0 &&
        full294 === 2331 && own294.length === 2457 &&
        cl294.now.indexOf('m-csurv') >= 0 && cl294.now.indexOf('m-cpledge') < 0 &&
        ST.datingOf(cl294, 'm-cpledge') === 'на дату' && ST.datingOf(cl294, 'm-csurv') === 'текущее' &&
        u294.now.indexOf('m-amount') >= 0 && u294.now.indexOf('m-amount-som') >= 0 &&
        cols294.filter(c => c === 'i_amount').length === 1 && cols294.indexOf('d_terr_region') >= 0 &&
        cols294.indexOf('d_terr_district') >= 0 && cols294.length === u294.now.length &&
        run294a.ok && copied294 === 17 && copies294.length === 15 && carried294 === 15 &&
        run294b.ok && blank294.length === 20 &&
        JSON.stringify(blankBy294) === JSON.stringify({'obj-borrower': 2, 'obj-gmember': 5, 'obj-zdeal': 5, 'obj-case': 3, 'obj-program': 5}) &&
        fresh294 &&
        gone294.join() === 'd-cctl,m-cnext,m-creval,m-csurv' && muteOk294 && mute294.now.length === 5 &&
        pNow294.word === 'текущее' && pAsof294.word === 'на дату' && pMix294.word === 'смешанно' &&
        pMix294.now.join() === 'd-collkind',
    `признак «текущее» — массив имён величин в строке, а не карта слов (ADR-0242): строк без массива или с картой «when» ${noArr294}, ряд происхождения — «${ST.ROW_ORIGIN.join()}». Имён вне величин объекта или без величины в той же строке ${alien294}; у сомовой стороны признак тот же, что у валютной, расхождений ${pair294} (§1). Легаси-строк ${leg294.length}, и у всех массив пуст — каждая величина читается «на дату» (${legDate294}). Строк с «текущими» ${full294} из ${own294.length} своих — доля и есть мера зрелости швов. У «${cl294.ref}» «Залоговая стоимость» — ${ST.datingOf(cl294, 'm-cpledge')}, «Дней с последнего обследования» — ${ST.datingOf(cl294, 'm-csurv')}. Физические имена строки «${u294.ref}»: ${cols294.join(', ')} — ${u294.now.length} имён на ${cols294.length} величин, сумма выдачи с её сомовой стороной — одно «i_amount», территория — оба уровня. Ночь ${TODAY}: скопировано ${copied294}, у 15 копий договоров, программ и членств массив вчерашний (${carried294}); стёрли массив у вчерашних строк — пустыми вышли ${blank294.length} (${JSON.stringify(blankBy294)}: 17 копий и 3 дела, у которых «текущих» нет вовсе), а 8 пересчитанных кредитов записали свой заново (${fresh294}). Молчит ядро — из массива «${cl294.ref}» ушли ${gone294.join(', ')}: их величин нет, и «текущими» они не названы (${muteOk294}). Паспорт: «${pNow294.word}» · «${pAsof294.word}» · «${pMix294.word}» (текущим — ${pMix294.now.join()}) (ADR-0242 §4, ADR-0205 §2)`);

  /* #295 — имя в массиве сверяется дверью записи (ADR-0242 §5, СС-202): чужая величина,
     величина без значения, повтор и прежняя карта слов отбиты ДО записи; строка без массива
     ложится с пустым — `DEFAULT '{}'`. Писатель один (ИС-8, ADR-0239 §4), и дверь та же. */
  ST.seed();
  const wr295 = vm.runInContext('writeRow', sandbox);
  const base295 = JSON.parse(JSON.stringify(ST.state.rows.find(r => r.obj === 'obj-collateral' && r.ref === 'ЗЛ-2024/41' && r.date === ASK)));
  const n295 = ST.state.rows.length;
  const try295 = (ref, patch) => wr295(ST.state, Object.assign(JSON.parse(JSON.stringify(base295)), {ref}, patch));
  const foreign295 = try295('проба-1', {now: base295.now.concat('m-debt')});
  const silent295 = try295('проба-2', {now: base295.now.concat('m-cpledge'), inds: Object.assign({}, base295.inds, {'m-cpledge': null})});
  const twice295 = try295('проба-3', {now: base295.now.concat(base295.now[0])});
  const map295 = try295('проба-4', {now: {'m-csurv': 'текущее'}});
  const grew295 = ST.state.rows.length - n295;
  const refused295 = grew295 === 0;
  const bare295 = JSON.parse(JSON.stringify(base295)); delete bare295.now; bare295.ref = 'проба-5';
  const def295 = wr295(ST.state, bare295);
  const put295 = ST.state.rows.find(r => r.ref === 'проба-5');
  ST.seed();
  ok(295, !foreign295.ok && has(foreign295.why, 'не величина объекта') && has(foreign295.why, 'ADR-0242 §5') &&
        !silent295.ok && has(silent295.why, 'молчание — не «текущее»') &&
        !twice295.ok && has(twice295.why, 'названо дважды') &&
        !map295.ok && has(map295.why, 'массив имён') && refused295 &&
        def295.ok && !!put295 && Array.isArray(put295.now) && put295.now.length === 0,
    `имя в массиве сверяется дверью записи, а не отчётом (ADR-0242 §5): чужая величина — «${String(foreign295.why).slice(-60)}», величина без значения — «${String(silent295.why).slice(-70)}», повтор — отбит (${!twice295.ok}), прежняя карта слов — «${String(map295.why).slice(-70)}»; строк от четырёх отказов прибавилось ${grew295}. Строка без массива ложится с пустым (${def295.ok && put295 ? JSON.stringify(put295.now) : '—'}) — «now_cols NOT NULL DEFAULT '{}'»: без массива значит без «текущих» (ИС-8, ADR-0239 §4)`);
})();
```

- [ ] **Step 2: Шапка и переписанные сторожа**

`шапка` (~123):

```diff
 // «группа × член × дата» без денег; суммы группы — из строк заёмщиков той же даты, итог — по
 // различным членам; охват через строку заёмщика-члена.
+// блок волны 23 З-21 — признак «текущее» массивом имён (ADR-0242): поле `now` вместо карты
+// `when`; копия переносит, пересчёт пишет заново; молчание в массив не попадает; имя сверяет
+// дверь записи.
 // Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
 // render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
```

`сторож #3` (~275):

```diff
      Записью реестра курс не стал — его колонки `rate` и `rate_date` в схеме служебные, как `cur`. */
   const valKeys = vals.filter(f => f !== 'fx').reduce((a, f) => a.concat(Object.keys(u3[f] || {})), []);
-  const origKeys = Object.keys(u3.when || {});
-  const origVals = origKeys.map(k => u3.when[k]);
+  /* Волна 23, З-21 (переписан на месте): ряд ПРОИСХОЖДЕНИЯ — массив `now` имён величин,
+     собранных «текущими», а не карта «величина → слово» (ADR-0242, СС-201). Критерий снова
+     механический — по форме: ряд значений — карты «запись → значение», ряд происхождения —
+     массив имён без единого значения, и каждое имя называет величину той же строки. */
+  const origKeys = Array.isArray(u3.now) ? u3.now.slice() : [];
+  const origOwn = origKeys.filter(k => k in u3.dims || k in u3.inds);
   const fateKeys = Object.keys(u3.srcs || {});
   /* Волна 23, З-16a (переписан на месте): полей 9 → 10 — `part`, вид поправки события, и он
```

`сторож #3` (~295):

```diff
   ok(3, shape.length === 12 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
        evRows3.length > 0 && ans3.length > 0 && outside3.length === 0 &&
-       shape.join(',') === 'obj,ref,date,part,dims,lbls,inds,fx,when,srcs,fixed,by' &&
+       shape.join(',') === 'obj,ref,date,part,dims,lbls,inds,fx,now,srcs,fixed,by' &&
        key.join(',') === 'obj,ref,date,part' &&
        vals.join(',') === 'dims,lbls,inds,fx' && orig.length === 1 && both.length === 0 && cover &&
```

`сторож #3` (~302):

```diff
        valKeys.length > 0 && valKeys.every(k => !!ST.REC(k)) &&
        origKeys.length > 0 && origKeys.every(k => !!ST.REC(k)) &&
-       ST.DATING.length === 2 && origVals.every(v => ST.DATING.indexOf(v) >= 0) &&
+       Array.isArray(u3.now) && origOwn.length === origKeys.length &&
        fateKeys.length > 0 && fateKeys.every(k => !ST.REC(k)) &&
        som3 === 'm-debt-som' && !('som' in u3) && !('som' in u3.inds['m-debt']) &&
        u3.inds[som3] && u3.inds[som3].v > 0 && ST.IND(som3).unit === 'сом',
-    `форма строки закрыта: ${shape.join(' · ')} — долей и дельт нет (ИС-15). Полей двенадцать — десятое, «part», стоит в адресе (СС-170), одиннадцатое, «fx», курс строки, и двенадцатое, «lbls», подписи разрезов на дату, — в ряду значений (ИС-56, ИС-57); подписей у строки ${Object.keys(u3.lbls).length}, и каждая — у разреза, чей ключ лежит в dims: рядов четыре и вместе они покрывают форму без остатка, не пересекаясь ни одним полем: АДРЕС (${key.join(' · ')}) · ЗНАЧЕНИЯ (${vals.join(' · ')}) · ПРОИСХОЖДЕНИЕ (${orig.join(' · ')}) · СУДЬБА (${fate.join(' · ')}). Прежний критерий различения на четвёртом ряду сломался и заменён: ключей в ряду значений ${valKeys.length} и каждый — запись реестра, но ключей в ряду ПРОИСХОЖДЕНИЯ ${origKeys.length} и каждый — тоже запись реестра, так что по именам эти ряды не разводятся. Разводит их словарь: значений в ряду происхождения ${origVals.length}, и все до одного — слова закрытого списка из двух (${ST.DATING.join(' · ')}), величины среди них нет ни одной (ИС-39, ADR-0205 §1). Ряд судьбы стоит особняком по-прежнему: ключей ${fateKeys.length} (${fateKeys.join(', ')}), и не запись реестра ни один — это имена СОСЕДЕЙ (ИС-42, ADR-0208 §2). Сомовая величина вошла в строку колонкой внутри inds под именем записи реестра «${ST.IND(som3).name}» (${(u3.inds[som3] || {}).v} ${ST.IND(som3).unit}), а не полем формы: поле нельзя назвать в отчёте и прекратить датой, запись — можно (ИС-44, ADR-0214 §2). Форму держит каждая строка: из ${ST.state.rows.length} хранимых (строк событий ${evRows3.length}) и ${ans3.length} действующих ответов событий на 21.08 вне формы ${outside3.length}${outside3.length ? ' (' + outside3[0].obj + ' ' + outside3[0].ref + ': ' + Object.keys(outside3[0]).filter(k => shape.indexOf(k) < 0).join(', ') + ')' : ''}`);
+    `форма строки закрыта: ${shape.join(' · ')} — долей и дельт нет (ИС-15). Полей двенадцать — десятое, «part», стоит в адресе (СС-170), одиннадцатое, «fx», курс строки, и двенадцатое, «lbls», подписи разрезов на дату, — в ряду значений (ИС-56, ИС-57); подписей у строки ${Object.keys(u3.lbls).length}, и каждая — у разреза, чей ключ лежит в dims: рядов четыре и вместе они покрывают форму без остатка, не пересекаясь ни одним полем: АДРЕС (${key.join(' · ')}) · ЗНАЧЕНИЯ (${vals.join(' · ')}) · ПРОИСХОЖДЕНИЕ (${orig.join(' · ')}) · СУДЬБА (${fate.join(' · ')}). Критерий различения на четвёртом ряду — форма: ключей в ряду значений ${valKeys.length} и каждый — запись реестра со значением, а ряд ПРОИСХОЖДЕНИЯ — массив из ${origKeys.length} имён записей реестра без единого значения, и каждое называет величину той же строки (${origOwn.length}): «текущими» собраны они, прочие — «на дату» (ИС-39, ADR-0242). Ряд судьбы стоит особняком по-прежнему: ключей ${fateKeys.length} (${fateKeys.join(', ')}), и не запись реестра ни один — это имена СОСЕДЕЙ (ИС-42, ADR-0208 §2). Сомовая величина вошла в строку колонкой внутри inds под именем записи реестра «${ST.IND(som3).name}» (${(u3.inds[som3] || {}).v} ${ST.IND(som3).unit}), а не полем формы: поле нельзя назвать в отчёте и прекратить датой, запись — можно (ИС-44, ADR-0214 §2). Форму держит каждая строка: из ${ST.state.rows.length} хранимых (строк событий ${evRows3.length}) и ${ans3.length} действующих ответов событий на 21.08 вне формы ${outside3.length}${outside3.length ? ' (' + outside3[0].obj + ' ' + outside3[0].ref + ': ' + Object.keys(outside3[0]).filter(k => shape.indexOf(k) < 0).join(', ') + ')' : ''}`);
 
   const edit = ST.tryEditRow();
```

`сторож #209` (~4558):

```diff
   ST.seed();
   const REC209  = id => ST.registry().find(r => r.id === id);
-  const row209  = ST.state.rows.find(r => r.obj === 'obj-collateral' && r.when);
-  const pl209   = Object.keys(row209.when).filter(id => (REC209(id) || {}).seam === 'calcPledge');
-  const now209  = pl209.filter(id => row209.when[id] === 'текущее').slice().sort();
-  const asof209 = pl209.filter(id => row209.when[id] === 'на дату');
+  /* Волна 23, З-21 (переписан на месте): признак читается из массива `now` (ADR-0242) —
+     величины двери берутся из значений строки, «текущие» — названные в массиве. */
+  const row209  = ST.state.rows.find(r => r.obj === 'obj-collateral' && Array.isArray(r.now));
+  const pl209   = Object.keys(row209.dims).concat(Object.keys(row209.inds))
+    .filter(id => (REC209(id) || {}).seam === 'calcPledge');
+  const now209  = pl209.filter(id => ST.datingOf(row209, id) === 'текущее').slice().sort();
+  const asof209 = pl209.filter(id => ST.datingOf(row209, id) === 'на дату');
   const kinds209 = [...new Set(now209.map(id => (REC209(id) || {}).kind))].sort();
   const alien209 = ST.state.rows
-    .reduce((a, r) => a.concat(Object.keys(r.when || {}).map(k => r.when[k])), [])
-    .filter(v => ST.DATING.indexOf(v) < 0);
+    .reduce((a, r) => a.concat((r.now || []).filter(k => !ST.REC(k) || ST.REC(k).obj !== r.obj)), []);
   const R209 = id => REC209(id) || {name:'—', seam:'—'};
   /* Волна 23 (переписан на месте): одна дверь отдаёт 11 записей, а не 15, «на дату» — 7,
```

`сторож #209` (~4573):

```diff
   ok(209, pl209.length === 11 && asof209.length === 7 && now209.length === 4 &&
         now209.join() === 'd-cctl,m-cnext,m-creval,m-csurv' &&
-        row209.when['m-cpledge'] === 'на дату' && row209.when['m-csurv'] === 'текущее' &&
+        ST.datingOf(row209, 'm-cpledge') === 'на дату' && ST.datingOf(row209, 'm-csurv') === 'текущее' &&
         REC209('m-cpledge').seam === 'calcPledge' && REC209('m-csurv').seam === 'calcPledge' &&
         kinds209.join() === 'показатель,разрез' &&
         ST.DATING.length === 2 && ST.DATING.join() === 'на дату,текущее' &&
-        alien209.length === 0 && ST.ROW_ORIGIN.join() === 'when',
-    `признак «на дату»/«текущее» принадлежит ВЕЛИЧИНЕ, а не шву (ИС-39, ADR-0205 §1). Одна дверь «calcPledge» отдаёт в строку «${row209.ref}» ${pl209.length} записей реестра — и они расходятся по признаку внутри одного вызова: ${asof209.length} собраны на дату, ${now209.length} текущие (${now209.join(' · ')}). Рядом стоят «${R209('m-cpledge').name}» (${String(row209.when['m-cpledge'])}) и «${R209('m-csurv').name}» (${String(row209.when['m-csurv'])}) — обе из «calcPledge», и вторая честно текущая: карточка предмета перезаписывает дату обследования, поэтому на майскую строку сегодня придёт августовский счёт дней. Пометь мы дверь целиком — половина её величин получила бы чужой признак, и паспорт соврал бы уверенно. Текущими при этом оказываются ОБЕ породы (${kinds209.join(' и ')}): разрез стареет ровно так же, как показатель. Словарь закрыт и проверяется счётом: в «ST.DATING» ровно ${ST.DATING.length} слова (${ST.DATING.join(' · ')}), и по всей витрине нет ни одного значения «when» за их пределами (${alien209.length})`);
+        alien209.length === 0 && ST.ROW_ORIGIN.join() === 'now',
+    `признак «на дату»/«текущее» принадлежит ВЕЛИЧИНЕ, а не шву (ИС-39, ADR-0205 §1). Одна дверь «calcPledge» отдаёт в строку «${row209.ref}» ${pl209.length} записей реестра — и они расходятся по признаку внутри одного вызова: ${asof209.length} собраны на дату, ${now209.length} текущие (${now209.join(' · ')}). Рядом стоят «${R209('m-cpledge').name}» (${ST.datingOf(row209, 'm-cpledge')}) и «${R209('m-csurv').name}» (${ST.datingOf(row209, 'm-csurv')}) — обе из «calcPledge», и вторая честно текущая: карточка предмета перезаписывает дату обследования, поэтому на майскую строку сегодня придёт августовский счёт дней. Пометь мы дверь целиком — половина её величин получила бы чужой признак, и паспорт соврал бы уверенно. Текущими при этом оказываются ОБЕ породы (${kinds209.join(' и ')}): разрез стареет ровно так же, как показатель. Словарь закрыт и проверяется счётом: в «ST.DATING» ровно ${ST.DATING.length} слова (${ST.DATING.join(' · ')}), и по всей витрине нет ни одного значения «when» за их пределами (${alien209.length})`);
 
   /* #210 — ПАСПОРТ НЕСЁТ ДАТИРОВКУ ЧЕТВЁРТЫМ ОБЯЗАТЕЛЬНЫМ РЕКВИЗИТОМ И БЕРЁТ ХУДШЕЕ.
```

`сторож #211` (~4637):

```diff
     .filter(p => ST.storageOf(p.obj) === 'state').reduce((n, p) => n + p.n, 0);
   const cred211 = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.date === J);
-  const held211 = cred211.filter(r => r.when['m-total'] === 'на дату');
+  /* Волна 23, З-21 (переписан на месте): признак читается из массива `now` (ADR-0242). */
+  const held211 = cred211.filter(r => r.inds['m-total'] != null && ST.datingOf(r, 'm-total') === 'на дату');
   CORE.DATING.calcDebt = keep211;
   /* Та же правка объявления, но у защёлки есть НАСТОЯЩАЯ причина переписать: курс на 31.07
```

`сторож #211` (~4655):

```diff
   /* Отчёт проверки читает СЛОМАННЫЙ мир тоже: пустой список переписанных — как раз то
      состояние, ради которого проверка написана, и падать на нём она не вправе. */
-  const mv211 = moved211[0] || {ref:'—', when:{}};
+  const mv211 = moved211[0] || {ref:'—', now:[]};
   /* Волна 23 (переписан на месте): защёлка дописывает 20 строк, а не 19 — МВ-2026/12
      больше не меняется каждую ночь («дней с направления» снят, схема §11), и 31.07 для неё
```

`сторож #211` (~4675):

```diff
         rew211.ok && rew211.refreshed === 2 &&
         moved211.length === 1 && moved211[0].ref === 'КД-2025/043' &&
-        moved211[0].when['m-total'] === 'текущее' &&
-        still211.length === 7 && still211.every(r => r.when['m-total'] === 'на дату') &&
+        ST.datingOf(moved211[0], 'm-total') === 'текущее' &&
+        still211.length === 7 && still211.every(r => r.inds['m-total'] != null && ST.datingOf(r, 'm-total') === 'на дату') &&
         CORE.DATING.calcDebt.length === keep211.length,
-    `датировка в сравнение строк НЕ входит, и это механизм, а не упущение (ADR-0205 §5). Объявление шва «calcDebt» правится — «total» перестаёт быть «на дату», — и защёлка после этого дописывает ${flat211.made} строк (строка первого числа у состояний уже есть, а у событий итога на дату нет, ИС-54) и не переписывает НИ ОДНОЙ (${flat211.refreshed}): все ${cred211.length} кредитных строк на 31.07 держат тот признак, с которым были собраны (${held211.length} из ${cred211.length} — «на дату»). Войди «when» в сравнение — правка ОДНОГО объявления переписала бы витрину целиком, и в журнале это выглядело бы как изменение состояния портфеля, которого не было: сосед сменил происхождение будущих величин, а вчерашний остаток от этого другим не стал. Обратное тоже держится: когда у защёлки появляется НАСТОЯЩАЯ причина переписать (курс на 31.07 уточнён задним числом), переписанная строка уносит ИСПРАВЛЕННЫЙ признак — «${mv211.ref}» вышла с «${String(mv211.when['m-total'])}», а ${still211.length} нетронутых остались с «на дату». Признак ведёт себя ровно как обещано: старые строки — свой, новые — исправленный, и никакая правка объявления не порождает записи`);
+    `датировка в сравнение строк НЕ входит, и это механизм, а не упущение (ADR-0205 §5). Объявление шва «calcDebt» правится — «total» перестаёт быть «на дату», — и защёлка после этого дописывает ${flat211.made} строк (строка первого числа у состояний уже есть, а у событий итога на дату нет, ИС-54) и не переписывает НИ ОДНОЙ (${flat211.refreshed}): все ${cred211.length} кредитных строк на 31.07 держат тот признак, с которым были собраны (${held211.length} из ${cred211.length} — «на дату»). Войди «when» в сравнение — правка ОДНОГО объявления переписала бы витрину целиком, и в журнале это выглядело бы как изменение состояния портфеля, которого не было: сосед сменил происхождение будущих величин, а вчерашний остаток от этого другим не стал. Обратное тоже держится: когда у защёлки появляется НАСТОЯЩАЯ причина переписать (курс на 31.07 уточнён задним числом), переписанная строка уносит ИСПРАВЛЕННЫЙ признак — «${mv211.ref}» вышла с «${ST.datingOf(mv211, 'm-total')}», а ${still211.length} нетронутых остались с «на дату». Признак ведёт себя ровно как обещано: старые строки — свой, новые — исправленный, и никакая правка объявления не порождает записи`);
 
   /* #212 — ДОСПРОС ПЕРЕПИСЫВАЕТ УСТАРЕВШЕЕ, И ДОПИСАННОЕ С ПЕРЕПИСАННЫМ СЧИТАЮТСЯ ПОРОЗНЬ.
```

`сторож #223 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5071):

```diff
   const lr = ST.rowsAsOf('obj-credit', '2026-01-01')[0] || {};
   const shape = JSON.stringify(Object.keys(lr)) === JSON.stringify(ST.ROW_SHAPE);
-  const whenVals = Array.from(new Set(Object.values(lr.when || {})));
+  /* Волна 23, З-21 (переписан на месте): «на дату» у легаси — пустой массив `now`, а не шесть
+     пометок (ADR-0242): не названная величина — «на дату». */
+  const nowLeg = Array.isArray(lr.now) ? lr.now : null;
+  const nLeg = Object.keys(lr.dims || {}).length + Object.keys(lr.inds || {}).length;
   const srcKeys = Object.keys(lr.srcs || {});
   const legCal = ST.calendar().filter(pr => pr.legacy);
```

`сторож #223 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5103):

```diff
         lr.fixed.by === 'миграция, вып. 1' &&
         srcKeys.length === 1 && lr.srcs['ядро'].ok === true && lr.srcs['ядро'].src === 'легаси' &&
-        whenVals.length === 1 && whenVals[0] === 'на дату' &&
-        Object.keys(lr.when).length === 6 &&
+        !!nowLeg && nowLeg.length === 0 && nLeg === 6 &&
         legRows.length === 34 && load.rows === 34 && load.launch === ST.LAUNCH() &&
         load.dates.length === 6 && load.dates.every(d => d < ST.LAUNCH()) &&
```

`сторож #223 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5112):

```diff
         sl223.passport.mode === 'запись фиксации, окончательно' &&
         sl223.passport.edition === 'легаси' && ST.FORMS().length === 2,
-    `легаси-итог входит СТРОКОЙ, и строка приходит уже в состоянии окончательной фиксации: ${legRows.length} строк на ${load.dates.length} дат (${load.dates[0]}…${load.dates[load.dates.length-1]}), все РАНЬШЕ запуска ${ST.LAUNCH()}, актор — «${String(lr.by)}», основание — «${String(load.act)}». Форма строки при этом НЕ ВЫРОСЛА: полей ${Object.keys(lr).length}, и это тот же список ИС-15 — десятое, адрес события «part», у легаси-строки пусто (${String(lr.part)}), а редакция формы лежит ВНУТРИ записи фиксации (${JSON.stringify(lr.fixed)}), потому что это обстоятельство фиксации, а не ещё одно измерение (ADR-0175 §1). Одиннадцатое поле было бы формой строки, растущей от каждого нового обстоятельства. Источник назван своим именем — «${String((lr.srcs['ядро']||{}).src)}», а не «шов»: шва за ту дату нет и не будет. Датировка всех ${Object.keys(lr.when).length} полей — «${String(whenVals[0])}», ВКЛЮЧАЯ РАЗРЕЗЫ: у легаси-разреза «текущего» значения не бывает вовсе, карточки, из которой его брать, больше нет, и умолчание «текущее» обещало бы поход туда, где никого нет (ИС-39). Ответ на легаси-дату ЧИТАЕТСЯ, а не считается: «${String(sl223.passport.mode)}». Легаси-месяцев ${legCal.length}, и в очереди закрытия периодов (${st.months.join(', ')}) их НЕТ ни одного — правило «периоды закрываются по порядку» осталось про то, что закрывает человек (ИС-41, ADR-0207 §1, §3)`);
+    `легаси-итог входит СТРОКОЙ, и строка приходит уже в состоянии окончательной фиксации: ${legRows.length} строк на ${load.dates.length} дат (${load.dates[0]}…${load.dates[load.dates.length-1]}), все РАНЬШЕ запуска ${ST.LAUNCH()}, актор — «${String(lr.by)}», основание — «${String(load.act)}». Форма строки при этом НЕ ВЫРОСЛА: полей ${Object.keys(lr).length}, и это тот же список ИС-15 — десятое, адрес события «part», у легаси-строки пусто (${String(lr.part)}), а редакция формы лежит ВНУТРИ записи фиксации (${JSON.stringify(lr.fixed)}), потому что это обстоятельство фиксации, а не ещё одно измерение (ADR-0175 §1). Одиннадцатое поле было бы формой строки, растущей от каждого нового обстоятельства. Источник назван своим именем — «${String((lr.srcs['ядро']||{}).src)}», а не «шов»: шва за ту дату нет и не будет. Датировка всех ${nLeg} полей — «на дату» (текущих в массиве ${nowLeg ? nowLeg.length : '—'}), ВКЛЮЧАЯ РАЗРЕЗЫ: у легаси-разреза «текущего» значения не бывает вовсе, карточки, из которой его брать, больше нет, и умолчание «текущее» обещало бы поход туда, где никого нет (ИС-39). Ответ на легаси-дату ЧИТАЕТСЯ, а не считается: «${String(sl223.passport.mode)}». Легаси-месяцев ${legCal.length}, и в очереди закрытия периодов (${st.months.join(', ')}) их НЕТ ни одного — правило «периоды закрываются по порядку» осталось про то, что закрывает человек (ИС-41, ADR-0207 §1, §3)`);
 
   /* Отказ обязан отбиваться ДО единой правки состояния, и это не педантизм: журнал зовёт
```

`сторож #256 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~5939):

```diff
   const zd = ST.rowsAt('obj-zdeal', TODAY), zy = ST.rowsAt('obj-zdeal', ASK);
   const copyEq = zd.length === 5 && zd.every(x => { const y = zy.find(z => z.ref === x.ref);
-    return y && JSON.stringify([x.dims, x.inds, x.when]) === JSON.stringify([y.dims, y.inds, y.when]) && !x.fixed; });
+    /* Волна 23, З-21 (переписан на месте): копия несёт массив `now` вчерашней строки (ADR-0242 §3). */
+    return y && JSON.stringify([x.dims, x.inds, x.now]) === JSON.stringify([y.dims, y.inds, y.now]) && !x.fixed; });
 /* Волна 23, З-20 (переписан на месте): объектов-состояний 8, копий 17, написано 47 — членство
      копируется каждую ночь, как всякое состояние, которое никто не назвал (ИС-54). */
```

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL, среди них `#3`, `#294`, `#295` — в строке карта `when`.

- [ ] **Step 4: Движок**

`const DATINGS = [DATING.ASOF, DATING.NOW];` (~1425):

```diff
 const DATING = {ASOF:'на дату', NOW:'текущее'};
 const DATINGS = [DATING.ASOF, DATING.NOW];
-/* Пометка КОПИТСЯ по записи реестра за весь обход строки, поэтому «текущее» не
-   перезаписывается обратно на «на дату»: у величины из двух частей худшая часть решает. */
+/* ПРИЗНАК ЛЕЖИТ В СТРОКЕ МАССИВОМ ИМЁН (ADR-0242, СС-201). Поле `now` (колонка `now_cols`) —
+   имена величин, собранных в этой строке «текущими»; величина, не названная в массиве, — «на
+   дату». Карта «величина → слово» волны 17 снята: второе слово в ней почти всегда одно и то
+   же, и вся карта — семьдесят пометок «на дату» ради пяти «текущее». Пометка КОПИТСЯ за весь
+   обход строки: имя, раз попавшее в массив, из него не уходит — у величины из двух частей
+   худшая часть решает (ADR-0205 §2). «На дату» пометки не требует вовсе. */
 function markDating(ask, id, mark){
-  if(!ask || !ask.when || !id) return;
-  if(ask.when[id] === DATING.NOW) return;
-  ask.when[id] = mark;
+  if(!ask || !ask.now || !id || mark !== DATING.NOW) return;
+  if(ask.now.indexOf(id) < 0) ask.now.push(id);
 }
+/* Признак величины в строке — одним чтением массива (ADR-0242 §4). */
+const datingOf = (row, id) => (row.now || []).indexOf(id) >= 0 ? DATING.NOW : DATING.ASOF;
 
 /* Кто вправе спрашивать. Классификация в списке есть и читать НЕ вправе — это ИС-5:
```

`function readInd(indId, item, dateISO, ask){` (~4463):

```diff
        снимается — иначе строка несла бы происхождение величины, которой в ней нет. */
     const O = IND(m.somOf);
-    const had = ask && ask.when ? ask.when[m.somOf] : undefined;
+    const had = !!(ask && ask.now) && ask.now.indexOf(m.somOf) >= 0;
     const src = O ? readIndRaw(O, m.somOf, item, dateISO, ask) : null;
-    const inner = ask && ask.when ? ask.when[m.somOf] : undefined;
-    if(ask && ask.when){ if(had === undefined) delete ask.when[m.somOf]; else ask.when[m.somOf] = had; }
+    const inner = !!(ask && ask.now) && ask.now.indexOf(m.somOf) >= 0;
+    if(ask && ask.now && inner && !had) ask.now.splice(ask.now.indexOf(m.somOf), 1);
     if(!src || src.v == null) return null;
-    markDating(ask, indId, inner || DATING.NOW);
     /* ПОТОК — обе колонки от ядра (ADR-0240 §3): сомовая сторона потока — сумма операций по
        их курсам, и курс строки к ней не применяется. ОСТАТОК — валютная колонка на курс строки
        по правилу округления записи (ADR-0214 §5, §6): курс в строке один (ADR-0240 §2). */
-    if(O.flow) return src.som == null ? null : {v: src.som};
-    const fx = ask && ask.fx ? ask.fx : fxOf(OBJ(m.obj), item, dateISO);
-    const s = fx ? CORE.toSom([{value: src.v, rate: fx.rate, rateDate: fx.rateDate}], roundOf(m)) : null;
-    return s ? {v: s.value} : null;
+    const fx = O.flow ? null : (ask && ask.fx ? ask.fx : fxOf(OBJ(m.obj), item, dateISO));
+    const s = O.flow || !fx ? null : CORE.toSom([{value: src.v, rate: fx.rate, rateDate: fx.rateDate}], roundOf(m));
+    const out = O.flow ? (src.som == null ? null : {v: src.som}) : (s ? {v: s.value} : null);
+    /* Имя ложится в массив ПОСЛЕ числа: сомовой стороны, которую не из чего посчитать, в строке
+       нет — нет и её имени (ADR-0242, «Границы»). */
+    if(out) markDating(ask, indId, inner ? DATING.NOW : DATING.ASOF);
+    return out;
   }
   /* ИТОГ В СОМАХ (`money_som`) — одна колонка `_som`, без валютной пары и без состава
```

`function buildRow(objId, item, dateISO, silent){` (~4522):

```diff
      чтения, а не досочиняется после по списку записей объекта. Досочини её — и она
      говорила бы о СОСТАВЕ объекта, а не о том, кого этой ночью правда спрашивали. */
-  const ask = {silent: silent || null, srcs: {}, when: {}, fx: fxOf(o, item, dateISO)};
+  const ask = {silent: silent || null, srcs: {}, now: [], fx: fxOf(o, item, dateISO)};
   o.dims.forEach(id => {
     const v = readDim(id, item, dateISO, ask);
```

`function buildRow(objId, item, dateISO, silent){` (~4531):

```diff
   });
   o.inds.forEach(id => { const c = readInd(id, item, dateISO, ask); if(c) inds[id] = c; });
-  return {obj: objId, ref: item.id, date: dateISO, part: null, dims, lbls, inds, fx: ask.fx, when: ask.when,
+  return {obj: objId, ref: item.id, date: dateISO, part: null, dims, lbls, inds, fx: ask.fx, now: ask.now,
           srcs: ask.srcs, fixed: null, by: 'прогон'};
 }
```

`ST.ROW_SHAPE = ['obj','ref','date','part','dims','lbls','inds','fx','when','srcs','fixed',` (~4621):

```diff
    колонок `_id`/`_lbl` схемы лежит в строке двумя полями, ключ отдельно от подписи, потому
    что группируют по ключу, а печатают подпись. У легаси подписей нет — `lbls` пуст. */
-ST.ROW_SHAPE = ['obj','ref','date','part','dims','lbls','inds','fx','when','srcs','fixed','by'];
+/* ВОЛНА 23 З-21 СМЕНИЛА ДЕВЯТОЕ ПОЛЕ: карта `when` «величина → слово» стала массивом `now` —
+   именами величин, собранных «текущими» (ADR-0242, СС-201). Ряд ПРОИСХОЖДЕНИЯ остался рядом:
+   значений в нём нет, но и слов теперь тоже — только имена записей реестра ЭТОГО объекта, и
+   каждое обязано назвать величину, лежащую в той же строке (ADR-0242 §5, «Границы»). */
+ST.ROW_SHAPE = ['obj','ref','date','part','dims','lbls','inds','fx','now','srcs','fixed','by'];
 /* Ряды формы названы порознь, чтобы «форма закрыта» осталось проверяемым числом, а не
    счётом полей: значений в строке ДВА места, и запрет ИС-15 стоит именно на них. Рядов
```

`ST.ROW_ORIGIN = ['when'];` (~4630):

```diff
 ST.ROW_KEY = ['obj','ref','date','part'];
 ST.ROW_VALUES = ['dims','lbls','inds','fx'];
-ST.ROW_ORIGIN = ['when'];
+ST.ROW_ORIGIN = ['now'];
 ST.ROW_FATE = ['srcs','fixed','by'];
 ST.DATING = DATINGS.slice();
+ST.datingOf = datingOf;
+/* Имена в колонке `now_cols` — имена ВЕЛИЧИН, а не колонок (ADR-0242 §1): `i_npay` закрывает
+   и `_v`, и `_som`, `d_industry` — и `_id`, и `_lbl`. Сомовая сторона валютной величины — та
+   же величина: её имя — имя валютной. */
+ST.nowCols = row => uniq([].concat.apply([], (row.now || []).map(id => {
+  const R = REC(id), B = R && R.somOf ? REC(R.somOf) : R;
+  if(!B) return [id];
+  /* Разрез с уровнями хранится колонкой на уровень, и «текущим» собран весь путь. */
+  return B.col ? [B.col] : (B.levels || []).filter(l => l.col).map(l => l.col);
+})));
 
 /* ========================= ПРОГОН И ФИКСАЦИЯ ======================== */
```

`function writeRow(st, row, opts){` (~5212):

```diff
   return null;
 }
+/* ИМЕНА `now` СВЕРЯЮТСЯ С РЕЕСТРОМ (ADR-0242 §5, СС-202). Каждое — запись реестра этого
+   объекта, и величина с этим именем в строке лежит: молчание соседа — отсутствие, а не
+   «текущее» (ADR-0242, «Границы»; ADR-0208 §1). Опечатка ловится дверью записи, а не отчётом. */
+function nowBad(row){
+  const o = OBJ(row.obj), list = row.now;
+  if(!Array.isArray(list)) return 'признак «текущее» — массив имён, а не «'+typeof list+'»';
+  for(const id of list){
+    if(!o || (o.dims.indexOf(id) < 0 && o.inds.indexOf(id) < 0)) return 'имя «'+id+'» — не величина объекта';
+    if(!((row.dims && row.dims[id] != null) || (row.inds && row.inds[id] != null))) return 'величины «'+id+'» в строке нет: молчание — не «текущее»';
+    if(list.indexOf(id) !== list.lastIndexOf(id)) return 'имя «'+id+'» названо дважды';
+  }
+  return null;
+}
 function writeRow(st, row, opts){
   const g = rowGate(st, row, opts);
   if(g.why) return {ok:false, why: g.why};
+  /* `now_cols NOT NULL DEFAULT '{}'` (ADR-0242): строка без массива — строка без «текущих». */
+  if(row.now === undefined) row.now = [];
+  const nb = nowBad(row);
+  if(nb) return {ok:false, why:'строка '+row.ref+' на '+fmt(row.date)+' не пишется: '+nb+' (ADR-0242 §5)'};
   const bad = checkRow(st, row);
   if(bad){
```

`function eventRow(o, item, D, silent){` (~5242):

```diff
   const at = eventSliceOf(o, item);
   const row = buildRow(o.id, item, at < FIRST_OWN ? FIRST_OWN : at, silent);
-  const ask = {silent: silent || null, srcs: row.srcs, when: row.when};
+  const ask = {silent: silent || null, srcs: row.srcs, now: row.now};
   Object.keys(o.evState || {}).forEach(id => {
     const x = readDim(id, item, D, ask);
     const l = x == null ? null : lblsOf(DIM(id), x, D);
-    if(x == null) delete row.dims[id]; else row.dims[id] = x;
+    /* Величины нет — нет и имени в массиве: молчание не «текущее» (ADR-0242, «Границы»). */
+    if(x == null){ delete row.dims[id]; if(row.now.indexOf(id) >= 0) row.now.splice(row.now.indexOf(id), 1); }
+    else row.dims[id] = x;
     if(l == null) delete row.lbls[id]; else row.lbls[id] = l;
   });
```

`function deltaNight(st, o, item, D, cand, silent, t){` (~5460):

```diff
     if(!voided(o, Object.assign({}, raw, {part: 'original'}))) fresh.push(Object.assign(clone(raw), {part: 'rebind', date: D}));
   } else uniq(ch.map(id => o.evState[id])).forEach(k => {
-    fresh.push(Object.assign(clone(raw), {part: k, date: D, inds: {}}));
+    /* Сумм в строке поправки нет — нет и их имён в `now` (ADR-0242, «Границы»). */
+    fresh.push(Object.assign(clone(raw), {part: k, date: D, inds: {}, now: raw.now.filter(id => id in raw.dims)}));
   });
   /* Поправки этой ночи, написанные прежним её прогоном, заменяются по адресу, а вид, которого
```

`function loadLegacy(st){` (~6348):

```diff
     LEGACY.totals[objId].forEach(t => {
       Object.keys(t.v).sort().forEach(d => {
-        const vals = t.v[d], inds = {}, when = {}, dims = {}, srcs = {};
+        const vals = t.v[d], inds = {}, now = [], dims = {}, srcs = {};
         form.inds.forEach((id, i) => {
           /* §2: НЕОТСУТСТВОВАВШЕЕ ПРИХОДИТ ОТСУТСТВУЮЩИМ. Ключа нет — и «не собирали» не
```

`function loadLegacy(st){` (~6357):

```diff
           /* Датировка легаси-величины — «на дату» ПО ПОСТРОЕНИЮ: итог собран на отчётную
              дату и с тех пор не пересчитывался. «Текущего» в легаси-строке не бывает вовсе
-             (ИС-39): карточки, из которой его можно было бы взять, к той дате уже нет. */
-          when[id] = DATING.ASOF;
+             (ИС-39): карточки, из которой его можно было бы взять, к той дате уже нет. Массив
+             `now` у легаси-строки пуст всегда (ADR-0242). */
         });
         /* Разрез датируется НАРАВНЕ с показателем и той же пометкой: на нём болезнь
```

`function loadLegacy(st){` (~6365):

```diff
            из которой можно было бы взять сегодняшние, к той дате уже нет. Не пометь их — и
            паспорт объявил бы «ТЕКУЩЕЕ 1» о величине, которой сегодня взяться неоткуда. */
-        form.dims.forEach(id => { if(t.dims[id] != null){ dims[id] = t.dims[id]; when[id] = DATING.ASOF; } });
+        form.dims.forEach(id => { if(t.dims[id] != null) dims[id] = t.dims[id]; });
         nbs.forEach(nb => { srcs[nb] = {ok:true, src: FORM.LEGACY}; });
         /* Пишет ТА ЖЕ функция записи, что у прогона (ИС-8, ADR-0239 §4): выпуск миграции
            проходит её признаком `legacy` — легаси-месяц приходит закрытым, и пишет его он один. */
-        const w = writeRow(st, {obj: objId, ref: t.ref, date: d, part: null, dims, lbls: {}, inds, fx: null, when, srcs,
+        const w = writeRow(st, {obj: objId, ref: t.ref, date: d, part: null, dims, lbls: {}, inds, fx: null, now, srcs,
           /* §3: строка приходит СРАЗУ ОКОНЧАТЕЛЬНОЙ. Незафиксированной её положить нельзя:
              открытая строка — обещание пересчитать, а пересчитывать нечем. */
```

`function datingNote(rows, dims, inds, asOf){` (~7649):

```diff
   want.forEach(id => rows.forEach(r => {
     if(!hasVal(r, id) || mark[id] === DATING.NOW) return;
-    mark[id] = (r.when || {})[id] || DATING.NOW;
+    mark[id] = datingOf(r, id);
   }));
   const named = id => { const R = REC(id); return '«'+(R ? R.name : id)+'»'; };
```

`ST.consumerAsk = q => {` (~8487):

```diff
     const cells = {};
     dims.forEach(id => { cells[id] = {v: row.dims[id], address: ADDRESS.STAT,
-      when: (row.when || {})[id] || DATING.NOW}; });
+      when: datingOf(row, id)}; });
     inds.forEach(id => { cells[id] = Object.assign({}, row.inds[id] || {v: null},
-      {address: ADDRESS.STAT, when: (row.when || {})[id] || DATING.NOW}); });
+      {address: ADDRESS.STAT, when: datingOf(row, id)}); });
     liveIds.forEach(id => { cells[id] = {v: lr ? lr.cells[id].v : null,
       address: ADDRESS.ROWS, when: DATING.NOW}; });
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 275/275 PASS` (проверено на копии).

- [ ] **Step 6: Мутация**

Копия обнуляет массив (`copyRow`: `{date: dateISO, fixed: null, by: 'прогон'}` →
`{…, now: []}`) → `#294` RED (274/275). Проверено.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-21 — признак «текущее» массивом имён, дверь записи сверяет имена"
```

| Переписан | Почему |
|---|---|
| `#3` | форма строки: `now` вместо `when`, ряд происхождения — `now` |
| `#209`, `#211` | признак читается `ST.datingOf`, «текущее» — только при значении |
| `#223` | у легаси массив пуст — всё «на дату» |
| `#256` | сравнение копии — по `x.now` |

### Task 10a: З-22a — колонка источника перечислением `stat_source_state` (`ADR-0245` §12)

Спецификация §4 З-22, первая четверть (`СС-185`). Решение — `СС-203`. Правки — разностью по
функциям, как в Task 6b; `~N` — по снимку после З-21.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - после `SILENCE_REASONS` — `SOURCE_STATES`, `SILENCE_STATE`, `srcOk`;
  - `askSeam` — `srcs[nb] = {state, detail?}`; `silentOf`, `splitDiff` — через `srcOk`;
    читатели печатают `detail || state`; `silentCell`; легаси — `{state:'legacy'}`;
  - `writeRow` — слово из списка, `legacy` тогда и только тогда, когда строка легаси, у `ok`
    нет `detail`; отказ со ссылкой `ADR-0245 §12`;
  - `ST.sourceStates`, `ST.silenceState`; `SEED_INPUTS` + `SOURCE_STATES`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#195`, `#197`, `#200`,
  `#205`, `#223`, `#260`, фикстура `#268`; блок З-22a (`#296`) перед отчётом.

**Interfaces:**
- Consumes: `SILENCE_REASONS`, `askSeam`, `silentOf`, `splitDiff`, `ST.isPartial`,
  `isLegacyRow`, `writeRow`, `SEED_INPUTS` (`#259`).
- Produces:
  - `srcs[nb] = {state, detail?}`, `state ∈ ok · unavailable · error · timeout · denied · legacy`;
    слово молчания → состояние: недоступен → `unavailable`, ответил ошибкой → `error`, не
    уложился в срок → `timeout`, отказал по правам → `denied`; `detail` — слово молчания;
  - `srcOk(s)` — `ok` или `legacy`; `is_partial` вычисляется (`ST.isPartial`);
  - дверь записи отбивает слово вне списка, `legacy` у своей строки, `ok` с `detail`
    (`СС-203`).

- [ ] **Step 1: Падающий сторож `#296`**

Перед `/* ---- отчёт ---- */`, после блока З-21:

```js
/* ===== Волна 23 · З-22a — колонка источника перечислением (ADR-0245 §12, СС-203) =====
   Ответ соседа в строке — одно слово закрытого списка `stat_source_state`; слова причины —
   `detail` (колонка `src_detail`); `is_partial` не хранится, а вычисляется из слов. */
(() => {
  /* #296 — перечисление закрыто, каждая причина молчания ложится своим словом, легаси —
     своим, и дверь записи другого слова не пропускает. Неполнота — функция слов: сменилось
     слово — сменилась неполнота, и третьего места, которое пришлось бы держать в согласии,
     нет. */
  ST.seed();
  const W296 = vm.runInContext('WORLD', sandbox);
  const it296 = W296['obj-credit'].find(w => w.id === 'КД-2025/043');
  const words296 = ST.silenceReasons().map(why => {
    const r = ST.buildRow('obj-credit', it296, ASK, {'ядро': why});
    return {why, s: r.srcs['ядро'] || {}, part: ST.isPartial(r), other: (r.srcs['классификация'] || {}).state};
  });
  const talk296 = ST.buildRow('obj-credit', it296, ASK);
  const leg296 = ST.state.rows.filter(r => ST.isLegacyRow(r));
  const legOk296 = leg296.length === 34 && leg296.every(r => Object.keys(r.srcs).every(k => r.srcs[k].state === 'legacy') && !ST.isPartial(r));
  const own296 = ST.state.rows.filter(r => !ST.isLegacyRow(r));
  const alien296 = ST.state.rows.filter(r => Object.keys(r.srcs || {}).some(k => ST.sourceStates().indexOf(r.srcs[k].state) < 0 ||
    'ok' in r.srcs[k] || 'reason' in r.srcs[k])).length;
  const ownLeg296 = own296.filter(r => Object.keys(r.srcs).some(k => r.srcs[k].state === 'legacy')).length;
  /* Неполнота вычисляется: та же строка со сменённым словом — полная, и больше ничего в ней
     не трогали. Поля «неполна» в строке нет (ИС-15). */
  const flip296 = JSON.parse(JSON.stringify(ST.buildRow('obj-credit', it296, ASK, {'ядро': 'недоступен'})));
  const before296 = ST.isPartial(flip296);
  flip296.srcs['ядро'] = {state: 'ok'};
  const after296 = ST.isPartial(flip296);
  const rel296 = vm.runInContext('RELEASE', sandbox).tables['obj-credit'].cols;
  /* Дверь записи — CHECK перечисления. */
  const wr296 = vm.runInContext('writeRow', sandbox);
  const n296 = ST.state.rows.length;
  const put296 = (ref, srcs) => wr296(ST.state, Object.assign(JSON.parse(JSON.stringify(talk296)), {ref, srcs}));
  const word296 = put296('проба-1', {'ядро': {state: 'не ответил'}, 'классификация': {state: 'ok'}});
  const legW296 = put296('проба-2', {'ядро': {state: 'legacy'}, 'классификация': {state: 'ok'}});
  const why296 = put296('проба-3', {'ядро': {state: 'ok', detail: 'недоступен'}, 'классификация': {state: 'ok'}});
  const okW296 = put296('проба-4', {'ядро': {state: 'timeout', detail: 'не уложился в срок'}, 'классификация': {state: 'ok'}});
  const grew296 = ST.state.rows.length - n296;
  ST.seed();
  ok(296, ST.sourceStates().join() === 'ok,unavailable,error,timeout,denied,legacy' &&
        words296.map(w => w.s.state).join() === 'unavailable,error,timeout,denied' &&
        words296.every(w => w.s.detail === w.why && w.part && w.other === 'ok') &&
        Object.keys(talk296.srcs).every(k => talk296.srcs[k].state === 'ok' && !('detail' in talk296.srcs[k])) &&
        !ST.isPartial(talk296) && legOk296 && alien296 === 0 && ownLeg296 === 0 &&
        before296 === true && after296 === false && ST.ROW_SHAPE.indexOf('is_partial') < 0 &&
        ['src_core', 'src_class', 'src_detail', 'is_partial'].every(c => rel296.indexOf(c) >= 0) &&
        !word296.ok && has(word296.why, 'не слово перечисления') && has(word296.why, 'ADR-0245 §12') &&
        !legW296.ok && has(legW296.why, 'у своей строки') &&
        !why296.ok && has(why296.why, 'причина молчания названа') &&
        okW296.ok && grew296 === 1,
    `колонка источника — перечисление (ADR-0245 §12): ${ST.sourceStates().join(' · ')}. Причины молчания ложатся словами ${words296.map(w => '«' + w.why + '» → ' + w.s.state).join(', ')}, слова причины — в detail, и строка в каждом случае неполна (${words296.every(w => w.part)}), а ответившая классификация — «ok». Легаси-строк ${leg296.length}, у всех источник «legacy» и ни одна не неполна (${legOk296}); своих строк со словом «legacy» ${ownLeg296}, строк вне перечисления или в прежней форме ok/reason ${alien296}. Неполнота вычисляется: та же строка до смены слова — ${before296}, после — ${after296}; поля «неполна» в форме строки нет, колонка is_partial — вычисляемая в релизе. Дверь записи отбила «не ответил» (${String(word296.why).slice(-80)}), «legacy» у своей строки и причину у ответившего; «timeout» с причиной прошёл — строк прибавилось ${grew296} (ИС-42, ADR-0208 §2, СС-203)`);
})();
```

- [ ] **Step 2: Шапка и переписанные сторожа**

`шапка` (~126):

```diff
 // `when`; копия переносит, пересчёт пишет заново; молчание в массив не попадает; имя сверяет
 // дверь записи.
+// блок волны 23 З-22a — колонка источника перечислением (ADR-0245 §12): ok · unavailable · error ·
+// timeout · denied · legacy; причина — `detail`; неполнота вычисляется, дверь сверяет слово.
 // Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
 // render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
```

`сторож #195` (~3979):

```diff
         !('m-debt' in now195.inds) && !('m-debt-som' in now195.inds) &&
         riskD && now195.dims[riskD] !== undefined && now195.dims[riskD] === was195.dims[riskD] &&
-        (now195.srcs['ядро'] || {}).ok === false && (now195.srcs['ядро'] || {}).reason === 'недоступен' &&
-        (now195.srcs['классификация'] || {}).ok === true && zeros195.length === 0,
+        /* Волна 23, З-22a (переписан на месте): колонка источника — слово перечисления,
+           причина — `detail` (ADR-0245 §12, СС-203). */
+        (now195.srcs['ядро'] || {}).state === 'unavailable' && (now195.srcs['ядро'] || {}).detail === 'недоступен' &&
+        (now195.srcs['классификация'] || {}).state === 'ok' && zeros195.length === 0,
     `отсутствующее осталось отсутствующим: у КД-2025/043 на 18.08 остаток был (${(was195.inds['m-debt'] || {}).v}) и сомовая сторона была (${(was195.inds['m-debt-som'] || {}).v}), в ночь молчания ядра не стало НИ ОДНОЙ — не ноль, не вчерашнее, а отсутствие ключа. Нулей в строке ${zeros195.length}: ноль сложился бы в своде и прошёл в отчёт, не оставив следа, а вчерашнее выдало бы строку за снимок на дату и завело второй путь к числам (E2E-09). Сомовая величина наследует молчание сама собой: она считается ИЗ основания, а не рядом с ним, и подставить ей нечего (ИС-44). Величины ОТВЕТИВШЕГО соседа при этом легли на место: категория «${String(now195.dims[riskD])}» пришла классификацией, чья колонка ok. Неполных строк за ночь — ${mute195.partial} (ИС-42, ADR-0208 §1)`);
 
```

`сторож #197` (~4020):

```diff
   ok(197, mute197.ok && mute197.partial > 0 && mute197.filled === 0 && mute197.rewrote > 0 &&
         fill197.ok && fill197.filled > 0 && fill197.rewrote === 0 && fill197.partial === 0 &&
-        (row197.srcs['ядро'] || {}).ok === true && (row197.srcs['ядро'] || {}).src === 'шов' &&
-        !('reason' in (row197.srcs['ядро'] || {})) && row197.inds['m-debt'] &&
+        /* Волна 23, З-22a (переписан на месте): ответивший источник — «ok» без `detail`. */
+        (row197.srcs['ядро'] || {}).state === 'ok' &&
+        !('detail' in (row197.srcs['ядро'] || {})) && row197.inds['m-debt'] &&
         row197.inds['m-debt-som'] && bl197 === 0,
-    `дозаполнение — НЕ перезапись: ночь молчания дала переписанных величин ${mute197.rewrote} и дозаполненных ${mute197.filled} (значения пропали), повторный прогон той же даты — дозаполненных ${fill197.filled} и переписанных ${fill197.rewrote} (было отсутствие, стало значение). Различие механическое, а не на слово: дозаполнено то, что раньше не пришло от МОЛЧАВШЕГО соседа и теперь пришло от ответившего. Колонка перевернулась и причину за собой не потащила («не ответил» → «${(row197.srcs['ядро'] || {}).src}», reason ${'reason' in (row197.srcs['ядро'] || {}) ? 'ОСТАЛСЯ' : 'снят'}), остаток и его сомовая сторона вернулись, неполных строк за период ${bl197}. Считай дозаполнение перезаписью — и разбор ночи утонул бы в перезаписях, которых не было (ИС-42, ADR-0208 §4)`);
+    `дозаполнение — НЕ перезапись: ночь молчания дала переписанных величин ${mute197.rewrote} и дозаполненных ${mute197.filled} (значения пропали), повторный прогон той же даты — дозаполненных ${fill197.filled} и переписанных ${fill197.rewrote} (было отсутствие, стало значение). Различие механическое, а не на слово: дозаполнено то, что раньше не пришло от МОЛЧАВШЕГО соседа и теперь пришло от ответившего. Колонка перевернулась и причину за собой не потащила («не ответил» → «${(row197.srcs['ядро'] || {}).state}», detail ${'detail' in (row197.srcs['ядро'] || {}) ? 'ОСТАЛСЯ' : 'снят'}), остаток и его сомовая сторона вернулись, неполных строк за период ${bl197}. Считай дозаполнение перезаписью — и разбор ночи утонул бы в перезаписях, которых не было (ИС-42, ADR-0208 §4)`);
 
   /* #198 — НЕПОЛНУЮ СТРОКУ НЕЛЬЗЯ ЗАЩЁЛКНУТЬ ОКОНЧАТЕЛЬНО. Это ОТКАЗ, а не
```

`сторож #200` (~4186):

```diff
   const a200 = rows200[0];
   const b200 = JSON.parse(JSON.stringify(a200));
-  b200.srcs = {'кураторство':{ok:false, why:'не ответил', reason:'недоступен'}};
+  /* Волна 23, З-22a (переписано на месте): колонка источника — слово перечисления (ADR-0245 §12). */
+  b200.srcs = {'кураторство':{state:'unavailable', detail:'недоступен'}};
   const editors200 = Object.keys(ST).filter(k => /^(drop|remove|delete)Row/.test(k));
   /* Счёт строк снимается ДО пересева: дальше начинается вторая половина проверки, и она
```

`сторож #205` (~4403):

```diff
   ok(205, shape205.length === 1 && shape205[0] === 'obj,ref,why' && nums205.length === 0 &&
         flat205.indexOf('"v"') < 0 && flat205.indexOf('"parts"') < 0 && flat205.indexOf('"rate"') < 0 &&
-        run205.ok && run205.partial > 0 && (row205.srcs['ядро'] || {}).ok === false &&
+        /* Волна 23, З-22a (переписан на месте): молчание — слово перечисления (ADR-0245 §12). */
+        run205.ok && run205.partial > 0 && (row205.srcs['ядро'] || {}).state === 'unavailable' &&
         row205.inds['m-debt'] === undefined,
     `ответ соседа — список КЛЮЧЕЙ, а не значений (ADR-0221 §6). В составе кандидатов у каждой позиции ровно три реквизита (${shape205[0]}) — объект, ссылка и повод; ни одной величины, ни одного значения в ответе нет — ни числового реквизита (${nums205.length}), ни клетки величины (поля «v», «parts», «rate» ${flat205.indexOf('"v"') < 0 && flat205.indexOf('"parts"') < 0 ? 'отсутствуют' : 'ЕСТЬ'}). Проверяется это не формой, а последствием: ядро назвало адреса и промолчало швом — строк неполных ${run205.partial}, у «КД-2025/043» задолженность не пришла вовсе (${String(row205.inds['m-debt'])}), а колонка источника называет молчавшего. Значения прогон берёт ШВАМИ, как и всегда, и второго пути к числам опрос не заводит: приди они списком изменившихся — молчание шва осталось бы незамеченным, а строка вышла бы «полной» из источника, которого в ADR-0152 §1 нет (E2E-09, ИС-42)`);
```

`сторож #223 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5115):

```diff
         lr.fixed.period === '2025-12' && lr.fixed.at === '2026-04-28' &&
         lr.fixed.by === 'миграция, вып. 1' &&
-        srcKeys.length === 1 && lr.srcs['ядро'].ok === true && lr.srcs['ядро'].src === 'легаси' &&
+        /* Волна 23, З-22a (переписан на месте): источник легаси-строки — слово «legacy»
+           перечисления (ADR-0245 §9, §12). */
+        srcKeys.length === 1 && lr.srcs['ядро'].state === 'legacy' && !ST.isPartial(lr) &&
         !!nowLeg && nowLeg.length === 0 && nLeg === 6 &&
         legRows.length === 34 && load.rows === 34 && load.launch === ST.LAUNCH() &&
```

`сторож #223 · блок «блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51»` (~5124):

```diff
         sl223.passport.mode === 'запись фиксации, окончательно' &&
         sl223.passport.edition === 'легаси' && ST.FORMS().length === 2,
-    `легаси-итог входит СТРОКОЙ, и строка приходит уже в состоянии окончательной фиксации: ${legRows.length} строк на ${load.dates.length} дат (${load.dates[0]}…${load.dates[load.dates.length-1]}), все РАНЬШЕ запуска ${ST.LAUNCH()}, актор — «${String(lr.by)}», основание — «${String(load.act)}». Форма строки при этом НЕ ВЫРОСЛА: полей ${Object.keys(lr).length}, и это тот же список ИС-15 — десятое, адрес события «part», у легаси-строки пусто (${String(lr.part)}), а редакция формы лежит ВНУТРИ записи фиксации (${JSON.stringify(lr.fixed)}), потому что это обстоятельство фиксации, а не ещё одно измерение (ADR-0175 §1). Одиннадцатое поле было бы формой строки, растущей от каждого нового обстоятельства. Источник назван своим именем — «${String((lr.srcs['ядро']||{}).src)}», а не «шов»: шва за ту дату нет и не будет. Датировка всех ${nLeg} полей — «на дату» (текущих в массиве ${nowLeg ? nowLeg.length : '—'}), ВКЛЮЧАЯ РАЗРЕЗЫ: у легаси-разреза «текущего» значения не бывает вовсе, карточки, из которой его брать, больше нет, и умолчание «текущее» обещало бы поход туда, где никого нет (ИС-39). Ответ на легаси-дату ЧИТАЕТСЯ, а не считается: «${String(sl223.passport.mode)}». Легаси-месяцев ${legCal.length}, и в очереди закрытия периодов (${st.months.join(', ')}) их НЕТ ни одного — правило «периоды закрываются по порядку» осталось про то, что закрывает человек (ИС-41, ADR-0207 §1, §3)`);
+    `легаси-итог входит СТРОКОЙ, и строка приходит уже в состоянии окончательной фиксации: ${legRows.length} строк на ${load.dates.length} дат (${load.dates[0]}…${load.dates[load.dates.length-1]}), все РАНЬШЕ запуска ${ST.LAUNCH()}, актор — «${String(lr.by)}», основание — «${String(load.act)}». Форма строки при этом НЕ ВЫРОСЛА: полей ${Object.keys(lr).length}, и это тот же список ИС-15 — десятое, адрес события «part», у легаси-строки пусто (${String(lr.part)}), а редакция формы лежит ВНУТРИ записи фиксации (${JSON.stringify(lr.fixed)}), потому что это обстоятельство фиксации, а не ещё одно измерение (ADR-0175 §1). Одиннадцатое поле было бы формой строки, растущей от каждого нового обстоятельства. Источник назван своим именем — «${String((lr.srcs['ядро']||{}).state)}», а не «ok»: шва за ту дату нет и не будет. Датировка всех ${nLeg} полей — «на дату» (текущих в массиве ${nowLeg ? nowLeg.length : '—'}), ВКЛЮЧАЯ РАЗРЕЗЫ: у легаси-разреза «текущего» значения не бывает вовсе, карточки, из которой его брать, больше нет, и умолчание «текущее» обещало бы поход туда, где никого нет (ИС-39). Ответ на легаси-дату ЧИТАЕТСЯ, а не считается: «${String(sl223.passport.mode)}». Легаси-месяцев ${legCal.length}, и в очереди закрытия периодов (${st.months.join(', ')}) их НЕТ ни одного — правило «периоды закрываются по порядку» осталось про то, что закрывает человек (ИС-41, ADR-0207 §1, §3)`);
 
   /* Отказ обязан отбиваться ДО единой правки состояния, и это не педантизм: журнал зовёт
```

`сторож #260 · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~6151):

```diff
   ST.run(S260, {silent: mute260});
   const silentAt260 = d => st260.rows.filter(r => r.date === d &&
-    Object.keys(r.srcs || {}).some(k => (r.srcs[k] || {}).reason)).length;
+    /* Волна 23, З-22a (переписано на месте): неполнота — вычисляемая (ADR-0245 §12). */
+    ST.isPartial(r)).length;
   const open260 = st260.queue.filter(q => !q.done && q.why === 'дозаполнение').length;
   const inc260 = silentAt260('2026-07-21');
```

`смоук · блок «Волна 23 З-14 — механизм релиза: колонку заводит релиз, реес»` (~6757):

```diff
     h: {branch: [['2026-06-10', 'Кредитный департамент']], curator: [['2026-06-10', 'Бекова Н.']]}};
   const mute268 = ST.state.rows.find(r => r.obj === 'obj-borrower' && r.ref === '22903197505433' && r.date === '2026-06-01');
-  if(mute268){ delete mute268.inds['m-bworst']; mute268.srcs['классификация'] = {ok: false, src: 'шов', why: 'недоступен'}; }
+  if(mute268){ delete mute268.inds['m-bworst']; mute268.srcs['классификация'] = {state: 'unavailable', detail: 'недоступен'}; }
   W['obj-borrower'].push(bor268); W['obj-repay'].push(pay268);
   let w268, j268;
```

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL, среди них `#197`, `#296` — в колонке `{ok, src, why}`.

- [ ] **Step 4: Движок**

`const NB = id => NEIGHBOURS.find(n => n.id === id) || null;` (~1404):

```diff
    больше, а повод модулю заданий (§7) собирается по причине, а не по фразе.            */
 const SILENCE_REASONS = ['недоступен','ответил ошибкой','не уложился в срок','отказал по правам'];
+/* КОЛОНКА ИСТОЧНИКА — ПЕРЕЧИСЛЕНИЕ `stat_source_state` (ADR-0245 §12, СС-203). Ответ соседа
+   в строке — одно слово закрытого списка; слова причины, которыми сосед промолчал, — в
+   `detail` (колонка `src_detail`). Четыре причины молчания ложатся на четыре состояния один к
+   одному, `legacy` ставит только выпуск миграции (ADR-0207, ADR-0245 §9). Новое состояние —
+   релиз, как у всякого CHECK (ADR-0245, «Границы»). */
+const SOURCE_STATES = ['ok','unavailable','error','timeout','denied','legacy'];
+const SILENCE_STATE = {'недоступен':'unavailable', 'ответил ошибкой':'error',
+                       'не уложился в срок':'timeout', 'отказал по правам':'denied'};
+/* Ответил ли сосед: `ok` у своей строки, `legacy` у легаси-строки — оба полные (ADR-0245 §12). */
+const srcOk = s => !!s && (s.state === 'ok' || s.state === 'legacy');
 const NB = id => NEIGHBOURS.find(n => n.id === id) || null;
 /* Шов без соседа — не «ничей», а НЕОБЪЯВЛЕННЫЙ: величина, которую никто не отдаёт,
```

`function askSeam(seam, item, dateISO, ask){` (~4349):

```diff
      сразу для всех своих швов. Поэтому колонка пишется одна и переспорить сама себя
      внутри одной строки не может. */
-  ask.srcs[nb] = why ? {ok:false, why:'не ответил', reason: why} : {ok:true, src:'шов'};
+  ask.srcs[nb] = why ? {state: SILENCE_STATE[why] || 'error', detail: why} : {state:'ok'};
   /* Отсутствующее остаётся отсутствующим: ни нуля, ни вчерашнего, ни интерполяции
      (ADR-0208 §1, ADR-0175). Ноль сложился бы в своде и не оставил следа, вчерашнее
```

`ST.nbOfSeam = nbOfSeam;` (~4544):

```diff
 ST.neighbours = () => clone(NEIGHBOURS);
 ST.silenceReasons = () => SILENCE_REASONS.slice();
+ST.sourceStates = () => SOURCE_STATES.slice();
+ST.silenceState = why => SILENCE_STATE[why] || null;
 ST.nbOfSeam = nbOfSeam;
 /* Неполнота НЕ ХРАНИТСЯ признаком: она читается из колонок источника той же строки
```

`function silentOf(row){` (~4549):

```diff
    ровно та болезнь, из-за которой в строке нет ни долей, ни дельт. */
 function silentOf(row){
-  return Object.keys(row.srcs || {}).filter(nb => !row.srcs[nb].ok);
+  /* `is_partial` — вычисляемая: хоть один источник не `ok` и не `legacy` (ADR-0245 §12). */
+  return Object.keys(row.srcs || {}).filter(nb => !srcOk(row.srcs[nb]));
 }
 ST.silentOf = row => silentOf(row);
```

`function splitDiff(was, now, ids){` (~4728):

```diff
     const k = (was.dims[id] !== undefined || now.dims[id] !== undefined) ? 'dims' : 'inds';
     const nb = nbOfRec(id);
-    const wasSilent = nb && was.srcs && was.srcs[nb] && !was.srcs[nb].ok;
-    const nowOk     = nb && now.srcs && now.srcs[nb] && now.srcs[nb].ok;
+    const wasSilent = nb && was.srcs && was.srcs[nb] && !srcOk(was.srcs[nb]);
+    const nowOk     = nb && now.srcs && srcOk(now.srcs[nb]);
     const appeared  = was[k][id] === undefined && now[k][id] !== undefined;
     (wasSilent && nowOk && appeared ? filled : rewrote).push(id);
```

`function writeRow(st, row, opts){` (~5251):

```diff
   /* `now_cols NOT NULL DEFAULT '{}'` (ADR-0242): строка без массива — строка без «текущих». */
   if(row.now === undefined) row.now = [];
+  /* Колонка источника — CHECK перечисления (ADR-0245 §12, СС-203): слово вне списка не
+     пишется, `legacy` — только у легаси-строки, причина — только у молчания. */
+  for(const k of Object.keys(row.srcs || {})){
+    const x = row.srcs[k] || {};
+    const bad = SOURCE_STATES.indexOf(x.state) < 0 ? 'источник «'+k+'» = «'+x.state+'» — не слово перечисления '+SOURCE_STATES.join(' · ')
+      : (x.state === 'legacy') !== isLegacyRow(row) ? 'источник «'+k+'» = «'+x.state+'» у '+(isLegacyRow(row) ? 'легаси-строки' : 'своей строки')
+      : srcOk(x) && x.detail ? 'источник «'+k+'» ответил, а причина молчания названа'
+      : null;
+    if(bad) return {ok:false, why:'строка '+row.ref+' на '+fmt(row.date)+' не пишется: '+bad+' (ADR-0245 §12)'};
+  }
   const nb = nowBad(row);
   if(nb) return {ok:false, why:'строка '+row.ref+' на '+fmt(row.date)+' не пишется: '+nb+' (ADR-0242 §5)'};
```

`function periodBlockers(st, month){` (~6136):

```diff
     k.objs[r.obj] = (k.objs[r.obj] || 0) + 1;
     if(k.dates.indexOf(r.date) < 0) k.dates.push(r.date);
-    const why = r.srcs[nb].reason;
+    const why = r.srcs[nb].detail || r.srcs[nb].state;
     if(k.reasons.indexOf(why) < 0) k.reasons.push(why);
   }));
```

`function loadLegacy(st){` (~6407):

```diff
            паспорт объявил бы «ТЕКУЩЕЕ 1» о величине, которой сегодня взяться неоткуда. */
         form.dims.forEach(id => { if(t.dims[id] != null) dims[id] = t.dims[id]; });
-        nbs.forEach(nb => { srcs[nb] = {ok:true, src: FORM.LEGACY}; });
+        nbs.forEach(nb => { srcs[nb] = {state:'legacy'}; });
         /* Пишет ТА ЖЕ функция записи, что у прогона (ИС-8, ADR-0239 §4): выпуск миграции
            проходит её признаком `legacy` — легаси-месяц приходит закрытым, и пишет его он один. */
```

`const SEED_INPUTS = () => ({WORLD, OBJECTS, REF, RATES, LEGACY, NEIGHBOURS, REGISTRY, RELE` (~6621):

```diff
   COLL_K, SURVEY_MATRIX, PAY_SPLIT, PAY_LAYER, ARTICLES, BANKRUPT_SUBGROUPS,
   'CORE.DATING': CORE.DATING, 'CORE.SOM_ROUNDING': CORE.SOM_ROUNDING,
-  KIND, DATING, FORM, LAYERS, MON, NIGHTLY, CAND_SRC, FLAT_TYPES, CUR_DIM});
+  KIND, DATING, FORM, LAYERS, MON, NIGHTLY, CAND_SRC, FLAT_TYPES, CUR_DIM, SOURCE_STATES});
 const seedPrint = () => JSON.stringify(SEED_INPUTS());
 ST.seedInputs = () => Object.keys(SEED_INPUTS());
```

`function partialNote(rows){` (~7635):

```diff
     const k = by[nb] || (by[nb] = {n:0, reasons:[]});
     k.n++;
-    if(k.reasons.indexOf(r.srcs[nb].reason) < 0) k.reasons.push(r.srcs[nb].reason);
+    const why = r.srcs[nb].detail || r.srcs[nb].state;
+    if(k.reasons.indexOf(why) < 0) k.reasons.push(why);
   }));
   const ids = Object.keys(by);
```

`function silentCell(row, id){` (~9586):

```diff
 function silentCell(row, id){
   const nb = nbOfRec(id), s = nb && row && row.srcs ? row.srcs[nb] : null;
-  return s && !s.ok ? '<span class="pill warn" title="'+esc('сосед «'+nb+'» '+s.why+': '+
-    s.reason+' — величина не подменена ни нулём, ни вчерашней (ИС-42)')+'">не ответил</span>' : null;
+  return s && !srcOk(s) ? '<span class="pill warn" title="'+esc('сосед «'+nb+'» не ответил: '+
+    (s.detail || s.state)+' — величина не подменена ни нулём, ни вчерашней (ИС-42)')+'">не ответил</span>' : null;
 }
 function indCellText(c, I, row){
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 276/276 PASS` (проверено на копии). Без `SOURCE_STATES` в `SEED_INPUTS`
падает `#259` — сборка читает список.

- [ ] **Step 6: Мутация**

Снять отказ двери (строку `if(bad) return {ok:false, why:'строка '+row.ref+… (ADR-0245 §12)'};`
в `writeRow` удалить) → `#296` RED (275/276). Проверено.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-22a — колонка источника перечислением, CHECK у двери записи"
```

| Переписан | Почему |
|---|---|
| `#195`, `#197`, `#205` | молчание читается `state`/`detail`, а не `ok`/`why` |
| `#200`, `#268` | фикстуры кладут `{state, detail}` |
| `#223` | у легаси `{state:'legacy'}`, строка не частичная |
| `#260` | частичность — `ST.isPartial` |

### Task 10b: З-22b — очередь: одна открытая задача на запись, неполные строки вместо дозаполнения, журнал перезаписи (`ADR-0245` §4)

Спецификация §4 З-22, вторая четверть (`СС-185`). Решения — `СС-204`…`СС-207`. Задача не
прототипирована: код ниже написан по снимку после З-22a, числа сторожей, зависящие от
прогона, — «по факту» (правило остановки 2: снять числом из первого зелёного прогона и
вписать в таблицу переписки с доводом). Номера строк — подсказки по снимку после З-22a.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `QUEUE_WHY` (~5144) — поводов два, новые `QUEUE_KINDS`, `QUEUE_KIND`;
  - `candidatesOf` (~5292) — неполная последняя строка записи зовёт её в ночь источником
    «очередь»;
  - `enq` (~5391) — одна открытая задача на запись, слияние; `deq` снимается;
  - `dequeueSeen` (~5700), `deltaNight` (`put`, ветка молчания ~5750), `fullNight` (ветка
    молчания ~5984, хвост ~6053), `doRun` (~6134) — без задач дозаполнения;
  - новые `RUN_REASON`, `REWRITE_REASONS`, `rewriteLog` — перед `ST.queue`;
    `ST.queueKinds`, `ST.rewriteLog`, `ST.rewriteReasons`; текст отказа `ST.enqueue`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; переписка `#206`, `#207`, `#198`,
  `#260` (и прочих, кого сдвинет слияние задач, — «по факту»); блок З-22b (`#297`, `#298`).

**Interfaces:**
- Consumes: `st.queue`, `ST.enqueue`, `candidatesOf`, `silentOf`, `isLegacyRow`,
  `st.runs[].parts[].rewrote/filled` (журнал прогона), `ST.isClosed`.
- Produces:
  - задача очереди `{obj, ref, kind, why, whys[], from, at, by, note, notes[], merged, done}`;
    `kind ∈ retro · manual · reopen` (`QUEUE_KINDS`); `досчёт` и `распоряжение` — ручные
    (`manual`), `retro` ставит ответ соседа (З-22c), `reopen` объявлен (`СС-204`);
  - у записи не больше одной открытой задачи: новая сливается — `from` более ранний, `at`
    более поздний, поводы копятся (`СС-205`); закрывает её ночь, дошедшая до `at`;
  - дозаполнения в очереди нет: неполная последняя строка — кандидат «очередь» (`СС-206`);
  - `ST.rewriteLog()` → `[{run, night, date, obj, ref, target, changed[], reason}]`, причина
    `retro · backfill · reopen · manual · closing · legacy`; дописанное — `backfill`; дни
    закрытого месяца в журнале не лежат, первые числа — лежат; журнал выводится из журнала
    прогона, второго писателя нет (`СС-207`).

- [ ] **Step 1: Падающие сторожа `#297`, `#298`**

В шапку смоука, после строк блока З-22a:

```js
// блок волны 23 З-22b — очередь и журнал перезаписи (ADR-0245 §4): у записи одна открытая
// задача, новая сливается с более ранней датой; дозаполнения в очереди нет — зовут неполные
// строки; журнал перезаписи — имена колонок и причина, дописанное — backfill.
```

Перед `/* ---- отчёт ---- */`, после блока З-22a:

```js
/* ===== Волна 23 · З-22b — очередь и журнал перезаписи (ADR-0245 §4, СС-204…СС-207) ===== */
(() => {
  /* #297 — у записи одна открытая задача; новая сливается, дата пересчёта — более ранняя,
     закрытие — после самой поздней. Дозаполнения в очереди нет: неполная строка сама
     зовёт запись в следующую ночь. */
  ST.seed();
  ST.setRole('Администратор статистики');
  const kinds297 = ST.queueKinds().join();
  const e1 = ST.enqueue('obj-program', 'БК-2021', 'досчёт', 'первая');
  ST.state.today = '2026-08-23';
  const e2 = ST.enqueue('obj-program', 'БК-2021', 'распоряжение', 'вторая');
  ST.state.today = TODAY;
  const open297 = ST.queue().filter(q => q.obj === 'obj-program' && q.ref === 'БК-2021');
  const t297 = open297[0] || {whys: []};
  ST.run(TODAY);
  const after22 = ST.queue().filter(q => q.ref === 'БК-2021').length;
  ST.state.today = '2026-08-23';
  ST.run('2026-08-23');
  const after23 = ST.queue().filter(q => q.ref === 'БК-2021').length;
  ST.seed();
  const mute297 = ST.run(TODAY, {silent: {'ядро': 'недоступен'}});
  const fillQ297 = ST.queue(true).filter(q => q.why === 'дозаполнение').length;
  const part297 = ST.state.rows.filter(r => r.date === TODAY && ST.isPartial(r)).map(r => r.obj + '|' + r.ref)
    .filter((k, i, a) => a.indexOf(k) === i);
  const c297 = ST.candidates('2026-08-23');
  const q297 = (c297.by['очередь'] || []).map(x => x.obj + '|' + x.ref);
  const covered297 = part297.every(k => q297.indexOf(k) >= 0);
  ST.seed();
  ok(297, kinds297 === 'retro,manual,reopen' && e1.ok && e2.ok && open297.length === 1 &&
        t297.kind === 'manual' && t297.from === TODAY && t297.at === '2026-08-23' &&
        t297.whys.join() === 'досчёт,распоряжение' && t297.merged === 1 &&
        after22 === 1 && after23 === 0 &&
        mute297.partial > 0 && fillQ297 === 0 && part297.length > 0 && covered297,
    `у записи одна открытая задача (ADR-0245 §4): «БК-2021» поставлена досчётом 22.08 и распоряжением 23.08 — открытых ${open297.length}, вид ${t297.kind}, пересчёт с ${t297.from}, закрыть не раньше ${t297.at}, поводы ${t297.whys.join(' + ')}; ночь 22.08 оставила её открытой (${after22}), ночь 23.08 закрыла (${after23}). Виды задач — ${kinds297}. Молчание ядра дало ${mute297.partial} неполных строк, задач дозаполнения ${fillQ297}: неполные записи (${part297.length}) зовёт в ночь 23.08 сама строка — все в источнике «очередь» (${covered297}) (ADR-0208 §5 уточнён)`);

  /* #298 — журнал перезаписи: имена колонок, не значения, и причина (ADR-0245 §4, ADR-0215 §6). */
  ST.seed();
  ST.run(TODAY, {silent: {'ядро': 'недоступен'}});
  const fill298 = ST.run(TODAY, {});
  const log298 = ST.rewriteLog();
  const lastRun298 = ST.state.runs.length - 1;
  const back298 = log298.filter(e => e.run === lastRun298 && e.reason === 'backfill');
  const W298 = vm.runInContext('WORLD', sandbox);
  const iP298 = W298['obj-program'].findIndex(p => p.id === 'БК-2021');
  const keep298 = JSON.stringify(W298['obj-program'][iP298]);
  let man298 = [];
  try {
    const p = W298['obj-program'][iP298];
    p.h.pstate = p.h.pstate.concat([['2026-08-21', 'закрыта']]);
    ST.run(TODAY, {manual: true, reason: 'проба журнала перезаписи'});
    const r = ST.state.runs.length - 1;
    man298 = ST.rewriteLog().filter(e => e.run === r && e.obj === 'obj-program' && e.ref === 'БК-2021');
  } finally { W298['obj-program'][iP298] = JSON.parse(keep298); }
  const names298 = log298.every(e => Array.isArray(e.changed) && e.changed.length > 0 &&
    e.changed.every(c => typeof c === 'string'));
  const closedDays298 = log298.filter(e => ST.isClosed(e.date) && e.date.slice(8) !== '01').length;
  ST.seed();
  ok(298, ST.rewriteReasons().join() === 'retro,backfill,reopen,manual,closing,legacy' &&
        fill298.ok && fill298.filled > 0 && back298.length === fill298.filled &&
        man298.length === 1 && man298[0].reason === 'manual' && man298[0].changed.indexOf('d-pstate') >= 0 &&
        names298 && closedDays298 === 0,
    `журнал перезаписи — имена колонок и причина, значений нет (ADR-0245 §4, ADR-0215 §6): повторная ночь после молчания ядра дописала ${fill298.filled} строк — записей «backfill» ${back298.length}; внеплановый пересчёт после смены состояния «БК-2021» — «${man298.map(e => e.reason + ': ' + e.changed.join(',')).join('; ')}». Записей о днях закрытого месяца ${closedDays298}: при закрытии они уходят, первые числа остаются`);
})();
```

- [ ] **Step 2: Переписать сторожей очереди**

`#206` — поводов два, задача одна:

```js
  ok(206, bad206.every(r => !r.ok) && has(bad206[0].why, 'поводов очереди три') &&
```
→
```js
  /* Волна 23, З-22b (переписан на месте): поводов очереди два — «дозаполнение» снято (СС-206),
     задачи трёх видов (ADR-0245 §4, СС-204). Распоряжение, поставленное дважды, — одна задача. */
  ok(206, bad206.every(r => !r.ok) && has(bad206[0].why, 'поводов очереди два') &&
```
и
```js
        add206.ok && twice206.ok && ST.queueWhy().length === 3 && c206.n === 31 &&
```
→
```js
        add206.ok && twice206.ok && ST.queueWhy().length === 2 && c206.n === 31 &&
```

(`c206.n` — «по факту»: если неполные строки вчерашней ночи добавили кандидатов «очередь»,
число вписать из прогона.)

`#207` — неполная строка зовёт запись сама, задачи нет. Заменить сторож целиком (номер тот же):

```js
  /* #207 — НЕПОЛНАЯ СТРОКА ЗОВЁТ ЗАПИСЬ САМА (ADR-0208 §5; волна 23, З-22b, переписан на месте:
     очередью неполных служат сами строки, задачи «дозаполнение» нет — ADR-0245 §4, СС-206). */
  ST.seed();
  const mute207 = ST.run(TODAY, {silent:{'ядро':'недоступен'}});
  const q207 = ST.queue();
  const c207 = ST.candidates('2026-08-23');
  ST.state.today = '2026-08-23';
  const fill207 = ST.run('2026-08-23', {});
  const left207 = ST.state.rows.filter(r => r.date === '2026-08-23' && ST.isPartial(r)).length;
  ok(207, mute207.partial > 0 && q207.length === 0 &&
        (c207.by['очередь'] || []).length > 0 &&
        (c207.by['очередь'] || []).every(x => has(x.why, 'неполна')) &&
        fill207.ok && left207 === 0,
    `неполная строка зовёт запись в следующую ночь сама, задачи в очереди нет (ADR-0208 §5, ADR-0245 §4): ночь молчания ядра — ${mute207.partial} неполных, задач ${q207.length}; кандидатов «очередь» на 23.08 — ${(c207.by['очередь'] || []).length}; после ночи 23.08 неполных ${left207}`);
```

`#198`, `#260` — выборки `q.why === 'дозаполнение'` заменить на неполные строки
(`ST.isPartial(r)`), утверждения — прежние по смыслу; числа «по факту». Прочие сторожа,
которых сдвинет слияние задач (`досчёт` и `распоряжение` одной записи в разные дни теперь
одна задача: `#245`, `#267`, `#272`, …), — переписать числами прогона с пометкой
«Волна 23, З-22b (переписан на месте): задачи слились (СС-205)».

- [ ] **Step 3: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: FAIL, среди них `#206`, `#207`, `#297`, `#298`.

- [ ] **Step 4: Виды задач и поводы**

```js
const QUEUE_WHY = ['дозаполнение','досчёт','распоряжение'];
```
→
```js
/* ЗАДАЧИ ОЧЕРЕДИ — ТРИ ВИДА (ADR-0245 §4, СС-204): `retro` — пересчёт с даты действия, её
   ставит ответ соседа (З-22c); `manual` — работа, поставленная человеком или ночью за него
   (досчёт, распоряжение); `reopen` — объявлен для повторного открытия, пишет его прогон
   своим видом. Дозаполнения в очереди нет: очередью неполных служат сами строки (СС-206). */
const QUEUE_KINDS = ['retro','manual','reopen'];
const QUEUE_WHY = ['досчёт','распоряжение'];
const QUEUE_KIND = {'досчёт':'manual', 'распоряжение':'manual', 'retro':'retro', 'reopen':'reopen'};
```

- [ ] **Step 5: Одна открытая задача на запись (`СС-205`)**

```js
function enq(st, objId, ref, why, atISO, by, note){
  const live = st.queue.find(q => !q.done && q.obj === objId && q.ref === ref && q.why === why);
  if(live) return live;                                   /* идемпотентно (ADR-0211 §3) */
  const rec = {obj: objId, ref, why, at: atISO, by: by || 'прогон', note: note || null, done: null};
  st.queue.push(rec);
  return rec;
}
function deq(st, objId, ref, why, atISO, how){
  st.queue.forEach(q => {
    if(!q.done && q.obj === objId && q.ref === ref && q.why === why) q.done = {at: atISO, how};
  });
}
```
→
```js
/* У ЗАПИСИ НЕ БОЛЬШЕ ОДНОЙ ОТКРЫТОЙ ЗАДАЧИ (ADR-0245 §4, СС-205). Новая сливается с открытой:
   пересчитывать — с более ранней даты (`from`), закрывать — не раньше самой поздней
   поставленной работы (`at`), поводы и заметки копятся. Вид — у первой: слитая задача одна,
   и её пересчёт покрывает все слитые. `from` у ручной задачи — день постановки; у `retro`
   его называет ответ соседа (З-22c). */
function enq(st, objId, ref, why, atISO, by, note, fromISO){
  const from = fromISO || atISO;
  const live = st.queue.find(q => !q.done && q.obj === objId && q.ref === ref);
  if(live){
    if(from < live.from) live.from = from;
    if(atISO > live.at) live.at = atISO;
    if(live.whys.indexOf(why) < 0) live.whys.push(why);
    if(note && live.notes.indexOf(note) < 0) live.notes.push(note);
    live.merged++;
    return live;
  }
  const rec = {obj: objId, ref, kind: QUEUE_KIND[why] || 'manual', why, whys: [why], from, at: atISO,
               by: by || 'прогон', note: note || null, notes: note ? [note] : [], merged: 0, done: null};
  st.queue.push(rec);
  return rec;
}
```

`dequeueSeen` — снимает любую открытую задачу, до `at` которой дошла ночь:

```js
    if(!q.done && q.obj === o.id && q.ref === item.id && (q.why === 'досчёт' || q.why === 'распоряжение') &&
       q.at <= D) q.done = {at: D, how: 'обойдён прогоном'};
```
→
```js
    if(!q.done && q.obj === o.id && q.ref === item.id && q.at <= D) q.done = {at: D, how: 'обойдён прогоном'};
```

Ветки молчания `deltaNight` и `fullNight` (два места, текст одинаков с точностью до отступа):

```js
    if(!st.queue.some(q => !q.done && q.obj === o.id && q.ref === item.id &&
                           (q.why === 'досчёт' || q.why === 'распоряжение')))
      enq(st, o.id, item.id, 'досчёт', D, 'прогон', 'молчали: '+mute.join(', '));
```
→
```js
    if(!st.queue.some(q => !q.done && q.obj === o.id && q.ref === item.id))
      enq(st, o.id, item.id, 'досчёт', D, 'прогон', 'молчали: '+mute.join(', '));
```

- [ ] **Step 6: Дозаполнение — не задача (`СС-206`)**

`deltaNight`, `put`:

```js
    if(mute.length){ t.partial++; enq(st, o.id, item.id, 'дозаполнение', D, 'прогон', 'молчали: '+mute.join(', ')); }
    else deq(st, o.id, item.id, 'дозаполнение', D, 'строка написана полной');
```
→
```js
    /* Неполная строка — сама очередь дозаполнения (ADR-0245 §4, СС-206): её зовёт `candidatesOf`. */
    if(mute.length) t.partial++;
```

`fullNight`, хвост — удалить две строки и комментарий над ними:

```js
  /* Неполная строка возвращается в очередь дозаполнения, полная её закрывает (ADR-0208 §5) —
     по мере целиком: очередь адресует меру, а не пару. */
  if(muted && muted.length) enq(st, o.id, item.id, 'дозаполнение', D, 'прогон', 'молчали: '+muted.join(', '));
  else if(muted) deq(st, o.id, item.id, 'дозаполнение', D, 'строка написана полной');
```

`doRun`, путь состояний — удалить:

```js
      if(part) enq(st, o.id, item.id, 'дозаполнение', dateISO, 'прогон',
                   'молчали: '+silentOf(row).join(', '));
      else deq(st, o.id, item.id, 'дозаполнение', dateISO, 'строка написана полной');
```

и в комментарии над ними заменить «неполная строка ВОЗВРАЩАЕТСЯ В ОЧЕРЕДЬ» на «неполная
строка САМА ЗОВЁТ запись в следующую ночь (`candidatesOf`, ADR-0245 §4)». Переменную `muted`
в `fullNight` не трогать — её по-прежнему копит цикл записи.

`candidatesOf` — после строки `st.queue.forEach(q => { if(!q.done) queued[q.obj+'|'+q.ref] = q.why; });`:

```js
  /* ОЧЕРЕДЬ НЕПОЛНЫХ — САМИ СТРОКИ (ADR-0245 §4, ADR-0208 §5, СС-206). Последняя строка записи
     с молчавшим соседом зовёт запись в ночь, пока сосед не ответит; задачи для этого нет. */
  const lastOf = {};
  st.rows.forEach(r => {
    if(r.date >= dateISO || isLegacyRow(r)) return;
    const k = r.obj+'|'+r.ref;
    if(!lastOf[k] || lastOf[k].date < r.date) lastOf[k] = r;
  });
```

и в цикле по записям:

```js
      if(queued[k]) add('очередь', o.id, item.id, queued[k]);
```
→
```js
      if(queued[k]) add('очередь', o.id, item.id, queued[k]);
      else if(lastOf[k] && silentOf(lastOf[k]).length)
        add('очередь', o.id, item.id, 'строка '+lastOf[k].date+' неполна: молчали '+silentOf(lastOf[k]).join(', '));
```

- [ ] **Step 7: Журнал перезаписи и двери**

Перед `ST.queue = all => …`:

```js
/* ЖУРНАЛ ПЕРЕЗАПИСИ (ADR-0245 §4, ADR-0215 §6, СС-207). Строка — «прогон + строка + имена изменившихся
   колонок + причина»; значений нет. Журнал выводится из журнала прогона — перезапись и
   дописанное каждая ночь уже называет поимённо (`rewrote`, `filled`), и второго писателя
   рядом не заводится. Причина — по виду прогона; дописанное — всегда `backfill`. Поправка
   события — не перезапись и сюда не попадает (ADR-0239): её строки лежат рядом с исходной.
   При закрытии месяца записи о его днях уходят, о первых числах — остаются; журнал прогона
   при этом не чистится (§2). `legacy` объявлена: правка легаси идёт флагом сессии, и
   двери к ней в макете нет. */
const REWRITE_REASONS = ['retro','backfill','reopen','manual','closing','legacy'];
const RUN_REASON = {'плановый':'retro', 'догон':'retro', 'retro':'retro', 'внеплановый':'manual',
                    'повторное открытие':'reopen', 'защёлка':'closing'};
function rewriteLog(st){
  const out = [];
  st.runs.forEach((r, i) => (r.parts || []).forEach(p => {
    const put = (x, reason) => out.push({run: i, night: r.at, date: r.date, obj: p.obj, ref: x.ref,
      target: x.target || null, changed: (x.fields || []).slice(), reason});
    (p.rewrote || []).forEach(x => put(x, RUN_REASON[r.kind] || 'manual'));
    (p.filled || []).forEach(x => put(x, 'backfill'));
  }));
  return out.filter(e => !ST.isClosed(e.date) || e.date.slice(8) === '01');
}
ST.rewriteLog = () => clone(rewriteLog(ST.state));
ST.rewriteReasons = () => REWRITE_REASONS.slice();
ST.queueKinds = () => QUEUE_KINDS.slice();
```

`ST.enqueue` — текст отказа:

```js
  if(QUEUE_WHY.indexOf(why) < 0) return {ok:false, why:'повод «'+String(why)+'» не объявлен: поводов очереди три — '+
    QUEUE_WHY.join(' · ')+' (ADR-0196, ADR-0221 §1)'};
```
→
```js
  if(QUEUE_WHY.indexOf(why) < 0) return {ok:false, why:'повод «'+String(why)+'» не объявлен: поводов очереди два — '+
    QUEUE_WHY.join(' · ')+'; задачи — '+QUEUE_KINDS.join(' · ')+', у записи одна открытая (ADR-0196, ADR-0245 §4)'};
```

Экран очереди (`q.why`, ~10862) печатает `q.whys.join(' + ')`.

- [ ] **Step 8: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 278/278 PASS` (276 + 2). Сторожа, сдвинутые слиянием задач, переписаны
числами прогона; каждый — строкой в таблицу переписки.

- [ ] **Step 9: Мутация**

`enq` не сливает — ищет открытую задачу того же повода
(`q.ref === ref);` → `q.ref === ref && q.why === why);`) → `#297` RED (две задачи у «БК-2021»).

- [ ] **Step 10: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-22b — одна задача на запись, неполные строки вместо дозаполнения, журнал перезаписи"
```

| Переписан | Почему |
|---|---|
| `#206` | поводов два, распоряжение дважды — одна задача |
| `#207` | неполная строка зовёт сама, задачи дозаполнения нет |
| `#198`, `#260` | выборка неполных — по строкам, а не по очереди |
| по факту (`#245`, `#267`, `#272`, …) | задачи одной записи слились — числа прогона |

### Task 10c: З-22c — сосед отвечает ключом и датой действия: `retro` с этой даты (`ADR-0245` §3, `ИС-49` сужен)

Спецификация §4 З-22, третья четверть (`СС-185`). Решение — `СС-208`. Не прототипирована:
числа — «по факту». Маркеры на первые числа закрытых месяцев — З-23a (здесь дата действия
в закрытом месяце только сдвигает `retro` на первый открытый день).

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - состояние (`seed`, ~6786) — `nbFeed: []` рядом с `polls: {}, queue: []`;
  - новые `takeFeed`, `onlyScan`, `retroPass` — после `enq`; дверь `ST.nbChanged`,
    `ST.nbFeed` — после `ST.enqueue`;
  - `doRun` (~6076) — выбор состава по `how.only`;
  - `ST.run` — после догона, перед ночью: `takeFeed`, `retroPass`; ответ — `fed`, `retro`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; блок З-22c (`#299`).

**Interfaces:**
- Consumes: `enq` (З-22b, `from`), `dequeueSeen`, `doRun`, `CAND_SRC`, `NB`, `NEIGHBOURS`,
  `dayShift`, `ST.isClosed`, `preLaunch`, `calendarRow`, `sliceOfMonth`, `periodOf`.
- Produces:
  - `ST.nbChanged(nb, obj, ref, from)` — ответ соседа «запись + самая ранняя дата действия»;
    в журнале `st.nbFeed[] = {nb, obj, ref, from, at, taken, closed}`;
  - ночной прогон забирает ответы ответивших соседей задачами `retro`: `from` задачи — день
    после даты действия (срез X+1 видит конец X, `ADR-0238` §2), а если он в закрытом
    месяце — первый открытый день; `closed = true` (для З-23a);
  - `retroPass(st, D)` пересчитывает открытые дни задач `retro` с `from` по канун `D`
    прогонами вида `retro` (`how.only` — только записи задач, `T` не двигается); задачу
    закрывает ночь `D`;
  - ответ молчавшего соседа ждёт ночи, в которую сосед ответит.

- [ ] **Step 1: Падающий сторож `#299`**

В шапку, после строк блока З-22b:

```js
// блок волны 23 З-22c — ответ соседа ключом и датой действия (ADR-0245 §3): дата в открытом
// месяце — retro с её следующего дня, в закрытом — с первого открытого; ответ молчавшего
// соседа ждёт; retro пишет журнал перезаписи с причиной «retro».
```

Перед отчётом, после блока З-22b:

```js
/* ===== Волна 23 · З-22c — ответ соседа ключом и датой действия (ADR-0245 §3, СС-208) ===== */
(() => {
  /* #299 — изменение задним числом приходит ключом И датой: строки с дня после даты действия
     переписываются retro-пересчётом, день действия — нет. Ответ молчавшего соседа ждёт. */
  ST.seed();
  const W299 = vm.runInContext('WORLD', sandbox);
  const iC299 = W299['obj-credit'].findIndex(c => c.id === 'КД-2024/117');
  const keep299 = JSON.stringify(W299['obj-credit'][iC299]);
  const cur299 = d => (ST.state.rows.find(r => r.obj === 'obj-credit' && r.ref === 'КД-2024/117' && r.date === d) ||
    {dims: {}}).dims['d-curator'];
  let r299 = {bad: [], retro: [], log: [], done: []};
  try {
    const c = W299['obj-credit'][iC299];
    c.h.curator = c.h.curator.concat([['2026-08-10', 'Касымов Т.']]);
    const before = {d10: cur299('2026-08-10'), d11: cur299('2026-08-11')};
    const bad = [ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117'),
                 ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117', '2026-09-30'),
                 ST.nbChanged('нет-соседа', 'obj-credit', 'КД-2024/117', '2026-08-10'),
                 ST.nbChanged('кураторство', 'obj-credit', 'нет-записи', '2026-08-10')];
    const fed = ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117', '2026-08-10');
    const closedFed = ST.nbChanged('кураторство', 'obj-credit', 'КД-2023/210', '2026-06-10');
    ST.run(TODAY, {silent: {'кураторство': 'недоступен'}});
    const waiting = ST.nbFeed().filter(f => !f.taken).length;
    const d11mute = cur299('2026-08-11');
    ST.state.today = '2026-08-23';
    const run = ST.run('2026-08-23');
    const retroRuns = ST.state.runs.filter(r => r.kind === 'retro');
    const early = retroRuns.filter(r => r.date < '2026-08-11' && has(r.reason, 'КД-2024/117')).length;
    r299 = {before, bad, fed, closedFed, waiting, d11mute, run, early,
      retro: retroRuns.map(r => r.date).filter((d, i, a) => a.indexOf(d) === i),
      after: {d10: cur299('2026-08-10'), d11: cur299('2026-08-11'), d22: cur299(TODAY)},
      log: ST.rewriteLog().filter(e => e.reason === 'retro' && e.obj === 'obj-credit' && e.ref === 'КД-2024/117'),
      open: ST.queue().filter(q => q.obj === 'obj-credit').length,
      done: ST.queue(true).filter(q => q.obj === 'obj-credit' && q.kind === 'retro'),
      feed: ST.nbFeed()};
  } finally { W299['obj-credit'][iC299] = JSON.parse(keep299); }
  const t117 = r299.done.find(q => q.ref === 'КД-2024/117') || {};
  const t210 = r299.done.find(q => q.ref === 'КД-2023/210') || {};
  const f210 = (r299.feed || []).find(f => f.ref === 'КД-2023/210') || {};
  ST.seed();
  ok(299, r299.bad.every(x => !x.ok) && has(r299.bad[0].why, 'дата действия') && r299.fed.ok && r299.closedFed.ok &&
        r299.waiting === 2 && r299.d11mute === 'Бекова Н.' && r299.run.ok &&
        r299.before.d11 === 'Бекова Н.' && r299.after.d11 === 'Касымов Т.' && r299.after.d22 === 'Касымов Т.' &&
        r299.after.d10 === r299.before.d10 && r299.early === 0 &&
        r299.retro.indexOf('2026-08-11') >= 0 && r299.retro.indexOf(TODAY) >= 0 &&
        r299.log.length > 0 && r299.log.every(e => e.changed.indexOf('d-curator') >= 0 && e.date >= '2026-08-11') &&
        r299.open === 0 && t117.from === '2026-08-11' && t210.from === '2026-07-02' && f210.closed === true,
    `ответ соседа — ключ и самая ранняя дата действия (ADR-0245 §3, ИС-49 сужен): смена куратора «КД-2024/117» с 10.08, названная 22.08, переписала строки с 11.08 (было «${r299.before.d11}», стало «${r299.after.d11}»), строка 10.08 прежняя («${r299.after.d10}»); retro-пересчётов по датам ${r299.retro.length}, записей журнала «retro» ${r299.log.length}. Ночь молчания «кураторства» ответов не забрала (ждут ${r299.waiting}). Дата в закрытом июне — retro с первого открытого дня ${t210.from}. Задач открыто ${r299.open}: ночь 23.08 закрыла обе`);
})();
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `#299` — исключение `ST.nbChanged is not a function`, смоук обрывается на блоке.

- [ ] **Step 3: Журнал ответов в состоянии**

```js
    polls: {}, queue: [],
```
→
```js
    /* `nbFeed` — ответы соседей «запись + дата действия» (ADR-0245 §3): забирает их ночь. */
    polls: {}, queue: [], nbFeed: [],
```

- [ ] **Step 4: Ответ соседа и retro-пересчёт (`СС-208`)**

После `enq`:

```js
/* ---------- ОТВЕТ СОСЕДА — КЛЮЧ И ДАТА ДЕЙСТВИЯ (ADR-0245 §3, ИС-49 сужен, СС-208) ----------
   Одного ключа мало: изменение задним числом ключом говорит «посмотри», но не говорит, с
   какой даты пересчитывать, — и строки между датой действия и ночью остались бы прежними.
   Журнала соседа в макете нет: ответ подаёт дверь `ST.nbChanged`, как подал бы его сосед.
   Сравнение значений на две даты (`fedChanged`) остаётся — оно зеркалит «кто изменился
   после T» внутри окна. Ответ забирает только ночь, в которую сосед ответил: у молчавшего
   он ждёт, как ждёт его `T` (ADR-0221 §2). */
function takeFeed(st, dateISO, silent){
  const out = {n: 0, marks: {}};
  st.nbFeed.forEach(f => {
    if(f.taken || f.at > dateISO || (silent || {})[f.nb]) return;
    f.taken = dateISO;
    /* Действие дня X видно срезу X+1 (ADR-0238 §2); день закрытого месяца не пишется (ИС-8) —
       retro начинается с первого открытого дня. */
    let from = dayShift(f.from, 1);
    f.closed = ST.isClosed(from);
    while(ST.isClosed(from) && from < dateISO) from = dayShift(from, 1);
    enq(st, f.obj, f.ref, 'retro', dateISO, 'прогон', 'сосед «'+f.nb+'»: действие с '+f.from, from);
    out.n++;
  });
  return out;
}
/* Состав retro-прогона — записи задач, и только они: кандидат — адрес работы (ADR-0221). */
function onlyScan(keys){
  const c = {full:false, why:null, from:null, set:{}, by:{}, polls:[], moved:[]};
  CAND_SRC.forEach(k => c.by[k] = []);
  keys.forEach(k => {
    const i = k.indexOf('|');
    c.set[k] = 'очередь';
    c.by['очередь'].push({obj: k.slice(0, i), ref: k.slice(i + 1), why: 'retro'});
  });
  return c;
}
/* ПЕРЕСЧЁТ С ДАТЫ ДЕЙСТВИЯ (ADR-0245 §3, §4). Открытые дни задач `retro` — от `from` до кануна
   ночи — пересчитываются по порядку прогоном вида `retro`: только записи задач, `T` не
   двигается (§2), дни закрытого месяца и удалённые дни не пишутся (ИС-8, ADR-0238 §5).
   Задачу закрывает ночь (`dequeueSeen`), дойдя до её `at`: все её даты пересчитаны. */
function retroPass(st, dateISO){
  const tasks = st.queue.filter(q => !q.done && q.kind === 'retro' && q.from < dateISO);
  const done = [];
  if(!tasks.length) return done;
  for(let d = tasks.reduce((m, q) => q.from < m ? q.from : m, dateISO); d < dateISO; d = dayShift(d, 1)){
    if(ST.isClosed(d) || preLaunch(d)) continue;
    const cal = calendarRow(st, periodOf(d));
    if(!cal || (cal.daysDropped && d !== sliceOfMonth(periodOf(d)))) continue;
    const keys = tasks.filter(q => q.from <= d).map(q => q.obj+'|'+q.ref);
    doRun(st, d, 'retro', 'планировщик', 'пересчёт с даты действия: '+keys.join(', '), null, {only: keys, keepT: true});
    done.push(d);
  }
  return done;
}
```

`doRun`:

```js
  const cand = how.full ? fullScan(how.why) : candidatesOf(st, dateISO, silent);
```
→
```js
  const cand = how.full ? fullScan(how.why) : how.only ? onlyScan(how.only) : candidatesOf(st, dateISO, silent);
```

`ST.run`, после `const cu = catchUp(st, dateISO, silent), caught = cu.dates;`:

```js
  /* Ответы соседей с датой действия забирает НОЧЬ (ADR-0245 §3, СС-208): задачи `retro` и их
     открытые дни — до своей ночи. Внеплановый пересчёт ответов не забирает: их, как и `T`,
     двигает только ночной прогон (§2). */
  const fed = opts.manual ? {n: 0, marks: {}} : takeFeed(st, dateISO, silent);
  const retro = opts.manual ? [] : retroPass(st, dateISO);
```

В ответ `ST.run` (объект `return {ok:true, …}` в конце двери) добавить `fed: fed.n, retro: retro.length`.

После `ST.enqueue`:

```js
/* Ответ соседа «запись + самая ранняя дата действия» (ADR-0245 §3). В макете его подаёт смоук —
   так, как подал бы сосед; требование к соседям — строкой в `docs/ochered-modulei.md`. */
ST.nbChanged = (nbId, objId, ref, fromISO) => {
  const st = ST.state, nb = NB(nbId), o = OBJ(objId);
  if(!nb) return {ok:false, why:'соседа «'+String(nbId)+'» нет: соседи объявлены списком — '+
    NEIGHBOURS.map(n => n.id).join(' · ')+' (ИС-42)'};
  if(!nb.asks) return {ok:false, why:'сосед «'+nb.id+'» не отвечает «кто изменился после T» — он обходится полностью (ADR-0221 §5)'};
  if(!o) return {ok:false, why:'объекта «'+String(objId)+'» нет в реестре объектов (ИС-18)'};
  if(!(WORLD[objId] || []).some(x => x.id === ref))
    return {ok:false, why:'записи «'+String(ref)+'» у объекта «'+o.name+'» нет: сосед называет существующую запись'};
  if(!fromISO || fromISO > st.today) return {ok:false, why:'дата действия обязательна и не позже сегодняшней: '+
    'без неё прогон не знает, с какой даты пересчитывать (ADR-0245 §3)'};
  const f = {nb: nb.id, obj: objId, ref, from: fromISO, at: st.today, taken: null, closed: null};
  st.nbFeed.push(f);
  return {ok:true, feed: clone(f)};
};
ST.nbFeed = () => clone(ST.state.nbFeed);
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 279/279 PASS` (278 + 1; по факту). Прочие сторожа не сдвигаются: без ответа
соседа `takeFeed` и `retroPass` пусты.

- [ ] **Step 6: Мутация**

`takeFeed` забирает ответ молчавшего соседа (`|| (silent || {})[f.nb]` снять) → `#299` RED
(`waiting` 0 вместо 2).

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-22c — ответ соседа ключом и датой действия, retro с этой даты"
```

### Task 10d: З-22d — счётчики прогона по способу хранения, сверка в конце, `failed` не публикуется (`ADR-0245` §2)

Спецификация §4 З-22, последняя четверть (`СС-185`). Решение — `СС-209`. Не прототипирована:
числа — «по факту».

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - `newTally` (~5093) — `corr`, `marks`; `partOf` (~5095) — `store`, `copied` только у
    состояний, `new_rows`/`corr_rows` только у событий, `markers` у всех;
  - `deltaNight` (набор поправок, ~5816) и `fullNight` (цикл записи, ~6045) — считают поправки
    и маркеры;
  - новые `reconcileRun`, `ST.reconcileRun` — перед `doRun`; `doRun` — сверка после записи в
    журнал; `ST.run` — `status` в ответе;
  - `dateGate` (~7548) — дата `failed`-прогона не публикуется.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; блок З-22d (`#300`); сторожа, читающие
  `copied` событий как `0`, — «по факту» (у событий теперь `null`).

**Interfaces:**
- Consumes: `newTally`, `partOf`, `storageOf`, `st.runs`, `st.rows`, `dateGate`, `markCorrected`.
- Produces:
  - часть прогона: `{…, store, copied: state ? n : null, new_rows: events ? n : null,
    corr_rows: events ? n : null, markers: n}`;
  - `reconcileRun(st, i)` → `'done' | 'failed'`, пишет `runs[i].status` и `runs[i].failed[]`:
    форма счётчиков по способу хранения; у событий `new_rows + corr_rows ≤ written`; у
    состояний строк на дату ровно `written`;
  - `dateGate` отказывает на дату, последний прогон которой `failed`; `ST.run` → `ok: false`,
    `status: 'failed'`; `ST.reconcileRun(i?)` — сверка прогона заново (по умолчанию последнего).

- [ ] **Step 1: Падающий сторож `#300`**

В шапку, после строк блока З-22c:

```js
// блок волны 23 З-22d — счётчики прогона (ADR-0245 §2): «скопировано» только у состояний,
// new_rows/corr_rows только у событий, markers у всех; не сошлось — failed, дата не публикуется.
```

Перед отчётом, после блока З-22c:

```js
/* ===== Волна 23 · З-22d — счётчики прогона и сверка (ADR-0245 §2, СС-209) ===== */
(() => {
  /* #300 — счётчики по способу хранения и сверка в конце прогона. Потерянная строка (её
     изображает удаление после прогона) ловится сверкой: прогон failed, дата не публикуется,
     повторный прогон возвращает её. */
  ST.seed();
  const run300 = ST.run(TODAY);
  const rec300 = ST.state.runs[ST.state.runs.length - 1];
  const ev300 = rec300.parts.filter(p => p.store === 'event_delta' || p.store === 'event_full');
  const st300 = rec300.parts.filter(p => p.store === 'state');
  const shape300 = ev300.every(p => p.copied === null && typeof p.new_rows === 'number' && typeof p.corr_rows === 'number') &&
    st300.every(p => p.new_rows === null && p.corr_rows === null && typeof p.copied === 'number') &&
    rec300.parts.every(p => typeof p.markers === 'number');
  const q300 = obj => ST.statSlice({obj, dims: [], inds: ['a-count'], date: TODAY});
  const before300 = q300('obj-credit');
  const i300 = ST.state.rows.findIndex(r => r.obj === 'obj-program' && r.date === TODAY);
  ST.state.rows.splice(i300, 1);
  const rc300 = ST.reconcileRun();
  const cut300 = q300('obj-credit');
  const again300 = ST.run(TODAY);
  const back300 = q300('obj-credit');
  ST.seed();
  ok(300, run300.ok && rec300.status === 'done' && shape300 && ev300.length > 0 && st300.length > 0 &&
        before300.ok && !rc300.ok && rc300.status === 'failed' && rc300.failed.some(x => has(x, 'obj-program')) &&
        !cut300.ok && has(cut300.why, 'не опубликован') && again300.ok && again300.status === 'done' && back300.ok,
    `счётчики прогона — по способу хранения (ADR-0245 §2): у ${ev300.length} событий «скопировано» не относится, new_rows/corr_rows названы; у ${st300.length} состояний — наоборот; markers у всех (${shape300}). Потерянная строка программы — сверка «${rc300.status}»: ${(rc300.failed || []).join('; ')}; срез на ${TODAY} — «${String(cut300.why || 'ответил').slice(0, 60)}…»; повторный прогон «${again300.status}», срез ${back300.ok ? 'отвечает' : 'отказ'}`);
})();
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `FAIL #300` (или исключение на `ST.reconcileRun`).

- [ ] **Step 3: Счётчики (`СС-209`)**

```js
function newTally(){ return {n:0, kept:0, unborn:0, noborn:0, same:0, born:0, have:0,
                             partial:0, skip:0, copied:0, written:0, rewrote:[], filled:[], created:[]}; }
function partOf(o, t){
  return {obj: o.id, name: o.name, n: t.n, kept: t.kept, unborn: t.unborn, noborn: t.noborn,
          same: t.same, born: t.born, have: t.have, partial: t.partial, skip: t.skip,
          copied: t.copied, written: t.written, rewrote: t.rewrote, filled: t.filled,
          created: t.created};
}
```
→
```js
function newTally(){ return {n:0, kept:0, unborn:0, noborn:0, same:0, born:0, have:0,
                             partial:0, skip:0, copied:0, written:0, corr:0, marks:0,
                             rewrote:[], filled:[], created:[]}; }
/* СЧЁТЧИКИ ПО СПОСОБУ ХРАНЕНИЯ (ADR-0245 §2, СС-209): «скопировано» — только у состояний,
   `new_rows` (рождённые строки событий) и `corr_rows` (поправки) — только у событий, `markers`
   — у всех. «Не относится» — `null`, а не ноль: ноль у события значил бы «копий не было», а
   копий у события не бывает вовсе. */
function partOf(o, t){
  const store = storageOf(o.id), ev = store === 'event_delta' || store === 'event_full';
  return {obj: o.id, name: o.name, store, n: t.n, kept: t.kept, unborn: t.unborn, noborn: t.noborn,
          same: t.same, born: t.born, have: t.have, partial: t.partial, skip: t.skip,
          copied: ev ? null : t.copied, written: t.written, rewrote: t.rewrote, filled: t.filled,
          new_rows: ev ? t.born : null, corr_rows: ev ? t.corr : null, markers: t.marks,
          created: t.created};
}
```

`deltaNight`, набор поправок:

```js
  fresh.forEach(r => { w += put(r); });
  if(fresh.length) markCorrected(st, o, item.id, null, orig.date, 'original', moved, D, D);
```
→
```js
  fresh.forEach(r => { const x = put(r); w += x; t.corr += x; });
  if(fresh.length){ markCorrected(st, o, item.id, null, orig.date, 'original', moved, D, D); t.marks++; }
```

`fullNight`, цикл записи:

```js
    if(x.mark) markCorrected(st, o, item.id, x.tgt, x.mark.slice, null, x.mark.changed, x.put.date, D);
```
→
```js
    if(x.mark){ markCorrected(st, o, item.id, x.tgt, x.mark.slice, null, x.mark.changed, x.put.date, D);
                t.marks++; t.corr++; }
```

- [ ] **Step 4: Сверка и публикация**

Перед `function doRun`:

```js
/* СВЕРКА В КОНЦЕ ПРОГОНА (ADR-0245 §2, СС-209). Счётчики — обещание, а не отчёт: форма — по
   способу хранения; у события рождённых и поправок не больше написанного; у состояния строк
   на дату ровно столько, сколько прогон назвал написанными (строка на каждую дату, ИС-54).
   Не сошлось — прогон `failed`, и дата не публикуется: читатель получает отказ с причиной, а
   не число, которое никто не удостоверил. Защёлка сюда не ходит: её доспрос пишет не все
   строки даты, и тождество у неё своё (#63). */
function reconcileRun(st, i){
  const r = st.runs[i];
  if(!r || !r.parts) return null;
  const bad = [];
  r.parts.forEach(p => {
    const ev = p.store === 'event_delta' || p.store === 'event_full';
    if(typeof p.markers !== 'number') bad.push(p.obj+': markers не назван');
    if(ev){
      if(p.copied !== null || p.new_rows == null || p.corr_rows == null)
        bad.push(p.obj+': у события «скопировано» не относится, new_rows и corr_rows обязательны');
      else if(p.new_rows + p.corr_rows > p.written)
        bad.push(p.obj+': рождённых и поправок '+(p.new_rows + p.corr_rows)+' при написанных '+p.written);
      return;
    }
    if(p.new_rows !== null || p.corr_rows !== null) bad.push(p.obj+': у состояния new_rows и corr_rows не относятся');
    if(p.store !== 'state') return;
    /* Тождество состояния (СС-164): написанное — пересчитанное, «без изменений» и копии. */
    if(p.written !== p.n + p.same + p.copied)
      bad.push(p.obj+': написано '+p.written+' ≠ '+p.n+' + '+p.same+' + '+p.copied);
    const on = st.rows.filter(x => x.obj === p.obj && x.date === r.date && !x.fixed).length;
    if(on !== p.written) bad.push(p.obj+': строк на '+r.date+' — '+on+', написано '+p.written);
  });
  r.status = bad.length ? 'failed' : 'done';
  r.failed = bad;
  return r.status;
}
ST.reconcileRun = i => {
  const k = i == null ? ST.state.runs.length - 1 : i;
  const s = reconcileRun(ST.state, k);
  return {ok: s === 'done', status: s, failed: clone((ST.state.runs[k] || {}).failed || [])};
};
```

`doRun`, в конце — после `st.runs.push({date: dateISO, kind, …, cand: candSummary(cand)});`:

```js
  reconcileRun(st, st.runs.length - 1);
```

`ST.run` — ответ: `ok:true` → `ok: rec.status !== 'failed'`, добавить `status: rec.status,
failed: clone(rec.failed || [])` (переменная `rec` — запись журнала этой ночи, она уже есть).

`dateGate`, первой строкой тела:

```js
  /* Дата, прогон которой разошёлся счётчиками, не публикуется (ADR-0245 §2, СС-209). */
  const fr = st.runs.filter(r => r.date === requested && r.status).slice(-1)[0];
  if(fr && fr.status === 'failed') return 'срез на '+fmt(requested)+' не опубликован: прогон «'+fr.kind+
    '» разошёлся счётчиками — '+fr.failed.join('; ')+'. Дата вернётся с прогоном, у которого счётчики сойдутся (ADR-0245 §2)';
```

- [ ] **Step 5: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 280/280 PASS` (по факту). Если сверка валит чистый прогон — сперва найти,
какое тождество не держится у этого способа хранения, и поправить формулу сверки, не
сторожа; сторожа, читавшие `copied` событий как `0`, переписать (`=== null`).

- [ ] **Step 6: Мутация**

Сверка всегда сходится (`r.status = bad.length ? 'failed' : 'done';` → `r.status = 'done';`) →
`#300` RED.

- [ ] **Step 7: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-22d — счётчики прогона по способу хранения, сверка, failed не публикуется"
```

### Task 11a: З-23a — маркер состояния только при настоящем отличии, закрытие `converged` · `reopen` (`ADR-0245` §5)

Спецификация §4 З-23, первая треть (`СС-185`). Решение — `СС-210`. Не прототипирована:
числа — «по факту».

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - новые `markStates`, `closeStateMarkers` — перед `ST.nbChanged` (З-22c);
  - `takeFeed` (З-22c) — ответ с датой в закрытом месяце ставит маркеры;
  - `ST.run` — маркеры ответа входят в счётчик `markers` части ночи;
  - `doRun` — `how.marks` прибавляется к частям до записи в журнал;
  - `ST.reopenPeriod` (~7160) — открытые маркеры месяца закрываются `reopen`.
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; блок З-23a (`#301`).

**Interfaces:**
- Consumes: `st.nbFeed` (`closed`), `takeFeed`, `rowDiff`, `buildRow`, `latchOf`, `MY_LAYER`,
  `st.periods`, `sliceOfMonth`, `periodOf`, `dayShift`, `st.markers`, `ST.reopenPeriod`,
  `partOf().markers` (З-22d).
- Produces:
  - `markStates(st, obj, ref, from, night)` → число новых маркеров: на каждое первое число
    закрытых месяцев после даты действия пересчёт сравнивается со строкой; отличие — маркер
    (или обновление открытого: `changed`, `found_run`); совпадение — открытый маркер
    закрывается `converged`; без отличия маркер не пишется (`СС-210`);
  - `closeStateMarkers(st, month, at)` — открытые маркеры итога месяца закрываются `reopen`;
  - маркер состояния: `{row_table, obj, ref, slice_date, target_id: null, corr_kind: null,
    changed, basis, found_run, closed_run, closed_how, corr_slice_date: null}`.

- [ ] **Step 1: Падающий сторож `#301`**

В шапку, после строк блока З-22d:

```js
// блок волны 23 З-23a — маркер состояния (ADR-0245 §5): пишется только при настоящем отличии
// пересчёта итога закрытого месяца; повторная находка обновляет запись; закрывается
// converged или reopen.
```

Перед отчётом, после блока З-22d:

```js
/* ===== Волна 23 · З-23a — маркер состояния только при отличии (ADR-0245 §5, СС-210) ===== */
(() => {
  /* #301 — дата действия в закрытом июне: маркер на итог июня (строка 01.07) — только если
     пересчёт действительно отличается; повторная находка обновляет, сошлось — converged,
     период открыт — reopen. Итог июля не закрыт — маркера на 01.08 нет. */
  const W301 = vm.runInContext('WORLD', sandbox);
  const mk301 = ref => ST.markers().filter(m => m.obj === 'obj-credit' && m.ref === ref && m.target_id == null && m.corr_kind == null);
  const junEdit = fn => {
    const i = W301['obj-credit'].findIndex(c => c.id === 'КД-2024/117');
    const keep = JSON.stringify(W301['obj-credit'][i]);
    try {
      W301['obj-credit'][i].h.curator = [['2025-01-01', 'Асанов А.'], ['2026-06-10', 'Касымов Т.'], ['2026-07-15', 'Бекова Н.']];
      return fn();
    } finally { W301['obj-credit'][i] = JSON.parse(keep); }
  };
  ST.seed();
  const a301 = junEdit(() => {
    ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117', '2026-06-10');
    ST.nbChanged('кураторство', 'obj-credit', 'КД-2023/210', '2026-06-10');
    const run = ST.run(TODAY);
    const rec = ST.state.runs.filter(r => r.date === TODAY).slice(-1)[0];
    const first = mk301('КД-2024/117');
    const same = mk301('КД-2023/210').length;
    const part = (rec.parts.find(p => p.obj === 'obj-credit') || {}).markers;
    ST.state.today = '2026-08-23';
    ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117', '2026-06-10');
    ST.run('2026-08-23');
    return {run: run.ok, first, same, part, again: mk301('КД-2024/117')};
  });
  ST.state.today = '2026-08-24';
  ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117', '2026-06-10');
  ST.run('2026-08-24');
  const conv301 = mk301('КД-2024/117');
  ST.seed();
  const b301 = junEdit(() => {
    ST.nbChanged('кураторство', 'obj-credit', 'КД-2024/117', '2026-06-10');
    ST.run(TODAY);
    const re = ST.reopenPeriod('2026-06', {no: 'РП-118 от 21.08.2026', basis: 'акт сверки № 41 от 14.07.2026'},
                               'Осмонова Г., главный бухгалтер');
    return {re: re.ok, m: mk301('КД-2024/117')};
  });
  ST.seed();
  const f301 = a301.first[0] || {changed: []};
  ok(301, a301.run && a301.first.length === 1 && f301.slice_date === '2026-07-01' &&
        f301.changed.indexOf('d-curator') >= 0 && !f301.closed_how && f301.found_run === TODAY &&
        a301.same === 0 && a301.part >= 1 &&
        a301.again.length === 1 && a301.again[0].found_run === '2026-08-23' && !a301.again[0].closed_how &&
        conv301.length === 1 && conv301[0].closed_how === 'converged' && conv301[0].closed_run === '2026-08-24' &&
        b301.re && b301.m.length === 1 && b301.m[0].closed_how === 'reopen',
    `маркер состояния — только при настоящем отличии (ADR-0245 §5): смена куратора «КД-2024/117» с 10.06 в закрытом июне — маркер на итог ${f301.slice_date} (${f301.changed.join(', ')}); у «КД-2023/210», чей итог пересчёт не меняет, маркеров ${a301.same}; счётчик ночи ${a301.part}. Повторная находка 23.08 обновила ту же запись (${a301.again.length}, найдена ${a301.again[0] ? a301.again[0].found_run : '—'}); мир вернулся — «${conv301[0] ? conv301[0].closed_how : '—'}» ${conv301[0] ? conv301[0].closed_run : ''}; июнь открыт распоряжением — «${b301.m[0] ? b301.m[0].closed_how : '—'}»`);
})();
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `FAIL #301` — маркеров состояния нет.

- [ ] **Step 3: Маркер состояния (`СС-210`)**

Перед `ST.nbChanged`:

```js
/* МАРКЕР СОСТОЯНИЯ — ТОЛЬКО ПРИ НАСТОЯЩЕМ ОТЛИЧИИ (ADR-0245 §5, ADR-0148 §5, СС-210). Дата
   действия в закрытом месяце: итог каждого закрытого месяца после неё (строка первого числа
   следующего) пересчитывается и сравнивается со строкой. Отличие — маркер: закрытое не
   переписывается (ИС-8), расхождение называется. Повторная находка обновляет ту же запись;
   пересчёт сошёлся — маркер закрывается `converged`; месяц открыт распоряжением — `reopen`.
   Без отличия маркер не пишется: «сосед назвал» — повод посмотреть, а не находка. */
function markStates(st, objId, ref, fromISO, night){
  const item = (WORLD[objId] || []).find(x => x.id === ref);
  if(!item || storageOf(objId) !== 'state') return 0;
  const since = periodOf(dayShift(fromISO, 1));
  let n = 0;
  st.periods.filter(p => p.month >= since && latchOf(st, p.month, MY_LAYER)).forEach(p => {
    const S = sliceOfMonth(p.month);
    const row = st.rows.find(r => r.obj === objId && r.ref === ref && r.date === S && r.part == null);
    if(!row || isLegacyRow(row)) return;
    const ch = rowDiff(row, buildRow(objId, item, S, null));
    const open = st.markers.find(m => m.obj === objId && m.ref === ref && m.slice_date === S &&
                                      m.target_id == null && m.corr_kind == null && !m.closed_how);
    if(ch.length && open){
      open.changed = ch; open.found_run = night; open.basis = 'повторная находка: действие с '+fmt(fromISO);
    } else if(ch.length){
      st.markers.push({row_table: (st.release.tables[objId] || {}).table, obj: objId, ref, slice_date: S,
        target_id: null, corr_kind: null, changed: ch, basis: 'ответ соседа: действие с '+fmt(fromISO),
        found_run: night, closed_run: null, closed_how: null, corr_slice_date: null});
      n++;
    } else if(open){ open.closed_run = night; open.closed_how = 'converged'; }
  });
  return n;
}
function closeStateMarkers(st, month, atISO){
  const S = sliceOfMonth(month);
  let n = 0;
  st.markers.forEach(m => {
    if(m.slice_date === S && m.corr_kind == null && m.target_id == null && !m.closed_how){
      m.closed_run = atISO; m.closed_how = 'reopen'; n++;
    }
  });
  return n;
}
```

`takeFeed` (З-22c), после `f.closed = ST.isClosed(from);`:

```js
    if(f.closed){
      const m = markStates(st, f.obj, f.ref, f.from, dateISO);
      out.marks[f.obj] = (out.marks[f.obj] || 0) + m;
    }
```

`ST.run` — ночь получает маркеры ответа в счётчик:

```js
  const written = doRun(st, dateISO, kind, opts.manual ? (opts.actor || st.role) : null,
                        opts.reason || null, silent);
```
→
```js
  const written = doRun(st, dateISO, kind, opts.manual ? (opts.actor || st.role) : null,
                        opts.reason || null, silent, {marks: fed.marks});
```

`doRun` — перед `st.runs.push({date: dateISO, kind, …`:

```js
  /* Маркеры, поставленные ответом соседа этой ночи, — её счётчик `markers` (ADR-0245 §2, §5). */
  if(how.marks) parts.forEach(p => { p.markers += how.marks[p.obj] || 0; });
```

`ST.reopenPeriod`, после `const unfixed = …;`:

```js
  /* Открытый месяц переписывается прогоном: его маркеры закрываются `reopen` (ADR-0245 §5). */
  const reopened = closeStateMarkers(st, month, at);
```

и в объект `row.reopens.push({…})` добавить `reopened`.

- [ ] **Step 4: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 281/281 PASS` (по факту).

- [ ] **Step 5: Мутация**

Маркер без отличия (`} else if(ch.length){` → `} else if(true){`) → `#301` RED (у «КД-2023/210»
маркер есть).

- [ ] **Step 6: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-23a — маркер состояния только при отличии, converged и reopen"
```

### Task 11b: З-23b — выгрузка: файл живёт N дней, задание — всегда, статус `expired` (`ADR-0245` §11)

Спецификация §4 З-23, вторая треть (`СС-185`). Решение — `СС-211`. Не прототипирована.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - новые `EXPORT_STATES`, `EXPORT_KEEP_DAYS`, `expireExports` — перед `ST.exportJob`
    (~8650); двери `ST.exportRun`, `ST.expireExports`, `ST.exportStates` — после него;
  - `ST.run` — ночной прогон просрочивает файлы (после проверки молчания, перед догоном).
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; блок З-23b (`#302`).

**Interfaces:**
- Consumes: `st.exports`, `ST.exportJob` (`state:'в очереди'`), `rowsFor`, `dayShift`.
- Produces:
  - `EXPORT_STATES = ['в очереди','готово','ошибка','expired']`, `EXPORT_KEEP_DAYS = 30`;
  - `ST.exportRun(id)` — выполнение: строки читаются одним снимком (`rowsFor`), `готово` с
    `ready_at`, либо `ошибка` с причиной (даты больше нет);
  - `expireExports(st, today)` — файл `готово`-задания старше N дней удаляется (`file: null`),
    задание остаётся со статусом `expired` и `expired_at` (`СС-211`); повтор ничего не меняет.

- [ ] **Step 1: Падающий сторож `#302`**

В шапку, после строк блока З-23a:

```js
// блок волны 23 З-23b — выгрузки (ADR-0245 §11): файл живёт N дней, задание — навсегда,
// статус expired; дату, которой больше нет, выгрузка называет ошибкой с причиной.
```

Перед отчётом, после блока З-23a:

```js
/* ===== Волна 23 · З-23b — выгрузка expired (ADR-0245 §11, СС-211) ===== */
(() => {
  /* #302 — файл удаляется через N дней, задание остаётся со статусом expired; строк на дату
     больше нет — выполнение отвечает ошибкой с причиной, а не пустым файлом. */
  ST.seed();
  const j302 = ST.exportJob({obj: 'obj-program', date: ASK}).job;
  const ran302 = ST.exportRun(j302.id);
  const ready302 = ST.exportsList().find(x => x.id === j302.id);
  ST.state.today = '2026-09-20';
  const e29 = ST.expireExports();
  ST.state.today = '2026-09-21';
  const e30 = ST.expireExports();
  const gone302 = ST.exportsList().find(x => x.id === j302.id);
  const e31 = ST.expireExports();
  ST.state.today = TODAY;
  const k302 = ST.exportJob({obj: 'obj-program', date: ASK}).job;
  ST.state.rows = ST.state.rows.filter(r => r.obj !== 'obj-program');
  const err302 = ST.exportRun(k302.id);
  const errJob302 = ST.exportsList().find(x => x.id === k302.id);
  ST.seed();
  ok(302, ST.exportStates().join() === 'в очереди,готово,ошибка,expired' &&
        j302.state === 'в очереди' && ran302.ok && ready302.state === 'готово' && ready302.ready_at === TODAY &&
        !!ready302.file && e29.length === 0 && e30.join() === j302.id &&
        gone302.state === 'expired' && gone302.file === null && gone302.expired_at === '2026-09-21' &&
        gone302.n === j302.n && !!gone302.passport && e31.length === 0 &&
        !err302.ok && errJob302.state === 'ошибка' && !!errJob302.why,
    `выгрузка: файл живёт 30 дней, задание — навсегда (ADR-0245 §11): «${j302.id}» готова ${ready302.ready_at}; 20.09 не просрочена (${e29.length}), 21.09 — «${gone302.state}», файл ${gone302.file}, вопрос и паспорт на месте; повтор — ${e31.length}. Строк на дату больше нет — «${errJob302.state}»: ${String(errJob302.why).slice(0, 70)}…`);
})();
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: исключение `ST.exportRun is not a function` на блоке З-23b.

- [ ] **Step 3: Статусы, выполнение, просрочка (`СС-211`)**

Перед `ST.exportJob = q => {`:

```js
/* ВЫГРУЗКА: ФАЙЛ ЖИВЁТ N ДНЕЙ, ЗАДАНИЕ — ВСЕГДА (ADR-0245 §11, СС-211). Задание — вопрос,
   заказчик, паспорт и история; файл — копия ответа в файловом хранилище, и его срок — параметр.
   Удалённый файл не стирает задания: «кто и что выгружал» — вопрос аудита, и ответ на него
   не должен кончаться вместе с файлом. */
const EXPORT_STATES = ['в очереди','готово','ошибка','expired'];
const EXPORT_KEEP_DAYS = 30;
function expireExports(st, todayISO){
  const out = [];
  st.exports.forEach(j => {
    if(j.state !== 'готово' || !j.ready_at || dayShift(j.ready_at, EXPORT_KEEP_DAYS) > todayISO) return;
    j.state = 'expired'; j.file = null; j.expired_at = todayISO;
    out.push(j.id);
  });
  return out;
}
```

После `ST.exportsList = …`:

```js
/* Выполнение читает строки одним снимком (ADR-0245 §11, REPEATABLE READ). Даты больше нет —
   ошибка с причиной: пустой файл читался бы как «строк не было». */
ST.exportRun = id => {
  const st = ST.state, j = st.exports.find(x => x.id === id);
  if(!j) return {ok:false, why:'выгрузки «'+String(id)+'» нет'};
  if(j.state !== 'в очереди') return {ok:false, why:'выгрузка «'+id+'» уже '+j.state};
  const r = rowsFor(st, {obj: j.obj, date: j.date, filter: j.filter});
  if(!r.ok){ j.state = 'ошибка'; j.why = r.why; j.done_at = st.today; return {ok:false, why: r.why, job: clone(j)}; }
  j.state = 'готово'; j.ready_at = st.today; j.n = r.rows.length;
  return {ok:true, job: clone(j)};
};
ST.expireExports = () => expireExports(ST.state, ST.state.today);
ST.exportStates = () => EXPORT_STATES.slice();
```

`ST.run`, после проверки молчания соседей (перед `calendarGap`):

```js
  /* Срок файлов выгрузок считает ночь: задания остаются, файлы уходят (ADR-0245 §11). */
  if(!opts.manual) expireExports(st, st.today);
```

- [ ] **Step 4: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 282/282 PASS` (по факту). Сторожа выгрузок (вызовы `ST.exportJob` в смоуке,
строки ~905 и ~1731) не сдвигаются: создание задания прежнее.

- [ ] **Step 5: Мутация**

Просрочка не удаляет файл (`j.state = 'expired'; j.file = null;` → `j.state = 'expired';`) →
`#302` RED (`file` не `null`).

- [ ] **Step 6: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-23b — выгрузка expired: файл уходит, задание остаётся"
```

### Task 11c: З-23c — десять слотов классификаторов администратора (`ADR-0241` §5, `ADR-0245` §1)

Спецификация §4 З-23, последняя треть (`СС-185`). Решение — `СС-212`. Не прототипирована.

**Files:**
- Modify: `mockups/statistics/statistics.html`:
  - состояние (`seed`) — `clsSlots: []` рядом с `nbFeed: []` (З-22c);
  - новые `CLS_OBJECTS`, `CLS_SLOTS`, `CLS_WARN`, `clsSlotCols` и двери `ST.clsSlotCols`,
    `ST.clsSlots`, `ST.takeSlot`, `ST.releaseSlot` — после `ST.exportStates` (З-23b).
- Modify: `scripts/inspect/statistics-check.mjs`: шапка; блок З-23c (`#303`).

**Interfaces:**
- Consumes: `ST.canAdmin`, `st.role`, `st.today`, `clone`.
- Produces:
  - `st.clsSlots[] = {object, slot, classifier_id, since, until, taken_by, taken_at}` —
    `stat_cls_slot`; `object ∈ credit · borrower · collateral`, `slot` 1…10, пара (`object`,
    `classifier_id`) уникальна;
  - `ST.takeSlot(obj, cls, since?)` → `{ok, object, slot, cols, warn}` | отказ; одиннадцатый —
    `{ok:false, waits:true}`; предупреждение при 8 занятых из 10;
  - `ST.releaseSlot(obj, cls, until?)` — слот остаётся занятым (`until`), не переиспользуется
    (`СС-212`);
  - `ST.clsSlotCols(n)` → `['d_clsN_code','d_clsN_lbl','d_clsN_ord']` — колонки слота
    объявлены семейством, в перечень `cols` релиза не входят.

- [ ] **Step 1: Падающий сторож `#303`**

В шапку, после строк блока З-23b:

```js
// блок волны 23 З-23c — слоты классификаторов (ADR-0241 §5, ADR-0245 §1): десять на объект,
// слот занимается навсегда и не переиспользуется; при восьми — предупреждение, одиннадцатый
// ждёт релиза.
```

Перед отчётом, после блока З-23b:

```js
/* ===== Волна 23 · З-23c — слоты классификаторов (ADR-0241 §5, ADR-0245 §1, СС-212) ===== */
(() => {
  /* #303 — слотов десять, слот занимается навсегда: освобождённый не отдаётся другому
     классификатору (в нём история), одиннадцатый ждёт релиза; при восьми занятых —
     предупреждение. Слоты есть у кредита, заёмщика и залога, и только у них. */
  ST.seed();
  ST.setRole('Аналитик');
  const role303 = ST.takeSlot('obj-credit', 'КЛ-01');
  ST.setRole('Администратор статистики');
  const alien303 = ST.takeSlot('obj-program', 'КЛ-01');
  const takes303 = [];
  for(let i = 1; i <= 10; i++) takes303.push(ST.takeSlot('obj-credit', 'КЛ-' + String(i).padStart(2, '0')));
  const dup303 = ST.takeSlot('obj-credit', 'КЛ-03');
  const rel303 = ST.releaseSlot('obj-credit', 'КЛ-03');
  const eleventh303 = ST.takeSlot('obj-credit', 'КЛ-11');
  const other303 = ST.takeSlot('obj-borrower', 'КЛ-11');
  const slots303 = ST.clsSlots('obj-credit');
  ST.seed();
  ok(303, !role303.ok && has(role303.why, 'администратор') && !alien303.ok &&
        takes303.every(t => t.ok) && takes303.map(t => t.slot).join() === '1,2,3,4,5,6,7,8,9,10' &&
        takes303.slice(0, 7).every(t => !t.warn) && takes303.slice(7).every(t => has(t.warn, 'из 10')) &&
        !dup303.ok && rel303.ok && rel303.until === TODAY &&
        !eleventh303.ok && eleventh303.waits === true && has(eleventh303.why, 'ждёт релиза') &&
        slots303.length === 10 && slots303.find(s => s.slot === 3).until === TODAY &&
        other303.ok && other303.slot === 1 &&
        ST.clsSlotCols(3).join() === 'd_cls3_code,d_cls3_lbl,d_cls3_ord',
    `слотов классификаторов десять на объект (ADR-0241 §5): заняты ${takes303.filter(t => t.ok).length}, предупреждение с восьмого — «${takes303[7] ? takes303[7].warn : '—'}»; слот 3 освобождён ${rel303.until}, но занят навсегда — одиннадцатый: «${String(eleventh303.why).slice(0, 80)}…»; у заёмщика свои слоты — первый (${other303.slot}); у программы слотов нет (${!alien303.ok}). Колонки слота 3 — ${ST.clsSlotCols(3).join(', ')}`);
})();
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: исключение `ST.takeSlot is not a function` на блоке З-23c.

- [ ] **Step 3: Слоты (`СС-212`)**

Состояние:

```js
    polls: {}, queue: [], nbFeed: [],
```
→
```js
    /* `clsSlots` — занятость слотов классификаторов (`stat_cls_slot`, ADR-0245 §1). */
    polls: {}, queue: [], nbFeed: [], clsSlots: [],
```

После `ST.exportStates = …`:

```js
/* СЛОТЫ КЛАССИФИКАТОРОВ АДМИНИСТРАТОРА (ADR-0241 §5, ADR-0245 §1, СС-212). У кредита, заёмщика
   и залога десять резервных слотов — колонки `d_clsN_code/_lbl/_ord`. Они объявлены релизом
   семейством, а не перечнем: стоят с первого релиза и ждут классификатора, поэтому в `cols`
   таблицы не перечисляются, и счёт колонок релиза прежний. Слот занимается НАВСЕГДА: в нём
   история, и освобождённый слот чужому классификатору не отдаётся — старые строки сменили бы
   смысл колонки задним числом. Слоты кончились — классификатор ждёт релиза, добавляющего
   слоты; при восьми занятых — предупреждение, чтобы релиз успел. */
const CLS_OBJECTS = {'obj-credit':'credit', 'obj-borrower':'borrower', 'obj-collateral':'collateral'};
const CLS_SLOTS = 10, CLS_WARN = 8;
const clsSlotCols = n => ['d_cls'+n+'_code', 'd_cls'+n+'_lbl', 'd_cls'+n+'_ord'];
ST.clsSlotCols = n => clsSlotCols(n);
ST.clsSlots = objId => clone(ST.state.clsSlots.filter(s => s.object === CLS_OBJECTS[objId]));
ST.takeSlot = (objId, clsId, sinceISO) => {
  const st = ST.state, object = CLS_OBJECTS[objId];
  if(!ST.canAdmin()) return {ok:false, why:'слот классификатора занимает администратор статистики'};
  if(!object) return {ok:false, why:'слоты классификаторов есть у кредита, заёмщика и залога; у «'+
    String(objId)+'» их нет (ADR-0241 §5)'};
  const mine = st.clsSlots.filter(s => s.object === object);
  const had = mine.find(s => s.classifier_id === clsId);
  if(had) return {ok:false, why:'классификатор «'+clsId+'» уже занимает слот '+had.slot+': один классификатор — один слот (ADR-0245 §1)'};
  if(mine.length >= CLS_SLOTS) return {ok:false, waits:true, why:'слоты объекта «'+object+'» кончились ('+
    mine.length+' из '+CLS_SLOTS+'): классификатор «'+clsId+'» ждёт релиза, добавляющего слоты (ADR-0241 §5)'};
  const slot = mine.length + 1;
  st.clsSlots.push({object, slot, classifier_id: clsId, since: sinceISO || st.today, until: null,
                    taken_by: st.role, taken_at: st.today});
  return {ok:true, object, slot, cols: clsSlotCols(slot),
          warn: slot >= CLS_WARN ? 'занято '+slot+' из '+CLS_SLOTS+' слотов: следующий релиз должен добавить слоты (ADR-0241 §5)' : null};
};
ST.releaseSlot = (objId, clsId, untilISO) => {
  const st = ST.state, object = CLS_OBJECTS[objId];
  if(!ST.canAdmin()) return {ok:false, why:'слот классификатора освобождает администратор статистики'};
  const s = st.clsSlots.find(x => x.object === object && x.classifier_id === clsId && !x.until);
  if(!s) return {ok:false, why:'классификатор «'+String(clsId)+'» слота у «'+String(objId)+'» не занимает'};
  s.until = untilISO || st.today;
  return {ok:true, object, slot: s.slot, until: s.until,
          note:'слот остаётся занятым: в нём история, и другому классификатору он не отдаётся (ADR-0241 §5)'};
};
```

- [ ] **Step 4: Прогнать — зелёный**

Run: `node scripts/inspect/statistics-check.mjs > /tmp/s.txt; grep -E "^SMOKE|FAIL" /tmp/s.txt`
Expected: `SMOKE … 283/283 PASS` (по факту).

- [ ] **Step 5: Мутация**

Освобождённый слот переиспользуется (`const mine = st.clsSlots.filter(s => s.object === object);` →
`… s.object === object && !s.until);`) → `#303` RED (одиннадцатый занял слот).

- [ ] **Step 6: Коммит**

```bash
git add mockups/statistics/statistics.html scripts/inspect/statistics-check.mjs
git commit -m "Статистика: волна 23 З-23c — десять слотов классификаторов, слот навсегда"
```

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
| З-15c — закрытый месяц хранит первые числа | «Статистика: волна 23 З-15c — закрытый месяц хранит первые числа, «не хранится» вместо подстановки» | смоук 248/248 PASS, exit 0 (было 244/244: +4 новых #260–#263, надгробий 0); подробности ниже |
| З-15c, правка ревью 1 | «Статистика: волна 23 З-15c — отказ закрытия называет строки событий и дорогу, поток не считает от рождения» | блокировки по частям (итог · события) с дорогой у каждой; поток: начало позже конца и база без строки — отказ, база под воротами даты; задания удалённых дней — на первый открытый день, задания первого числа не трогаются; дописаны `#145`, `#198`, `#262`; смоук 248/248 PASS, exit 0; подробности ниже |
| З-16b — мера × цель, событие на дату, поток событиями | «Статистика: волна 23 З-16b — мера × цель, событие на дату одной функцией, поток событием» | смоук 257/257 PASS, exit 0 (было 253/253: +4 новых #269–#272, надгробий 0); подробности ниже |
| З-16b, правка ревью 1 | «Статистика: волна 23 З-16b — у меры один представитель, поток событий отвечает только за прогнанные даты» | новая пара ставит меру на обход и рождается решением меры; снятая цель — сторно по цели; мера — в одном решении ночи; конец потока — дата прогона, начало — не раньше запуска; находка 5 — открытый вопрос владельцу ADR-0239 §3; конъюнкты #269, #272; смоук 257/257 PASS, exit 0; подробности ниже |
| З-16b, правка ревью 2 | «Статистика: волна 23 З-16b — смена представителя ложится одной датой, очередь снимается после ворот» | смена набора целей видна ночи сама и ложится одной датой — ночью, которая её увидела; ответ на отвеченную дату не меняется; работа из очереди снимается после двери; объект без `pairOff` не падает; конъюнкты #267, #269, #270; смоук 257/257 PASS, exit 0; подробности ниже |
| З-16b, правка ревью 3 | «Статистика: волна 23 З-16b — работу снимает ночь не раньше даты распоряжения, снятие сторно меры — не смена набора» | пересчёт ночи раньше распоряжения его не снимает — у меры, события-дельты и состояния (одно правило `q.at ≤ D`); сторно всей меры и его снятие — поправка состояния, мера о нескольких целях хранит его как мера об одной; конъюнкты #206, #267, #269, #270; смоук 257/257 PASS, exit 0; подробности ниже |

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

### З-15c — закрытый месяц хранит первые числа: закрытие в две фазы, «не хранится», повторное открытие (`ИС-54`, `ИС-12` сужен; `ADR-0238` §3, §5; `ADR-0245` §7)

**Движок.**

- Плотный слепок защёлки снят целиком. Раздел «ПЛОТНЫЙ СЛЕПОК НА ЗАЩЁЛКЕ» → «ДОСПРОС НА
  ЗАКРЫТИИ (ИС-46, ИС-54, ADR-0245 §7)»; прежний порядок «сперва неполнота, потом доспрос»
  (`ADR-0208` §4) назван снятым — решение контролёра: `ADR-0245` §7 как более поздний.
- `repoll` — тело брифа: события пропускаются (итога на дату у них нет, `ADR-0239`),
  `silent` идёт в сборщик, строка из молчания не пишется и уходит в `mute` `{obj, ref, nbs}`;
  запись журнала `защёлка` делается всегда, `repoll: {nbs, made, again, mute, done}`.
  Зафиксированная строка уходит в `kept` до сборки.
- `periodBlockers(st, month)` — функция вместо двери `ST.periodBlockers` (дверь осталась
  обёрткой): блокирует неполнота ИТОГА — строк состояний последней хранимой даты периода
  (`at`) и строк событий месяца; предупреждение о пропуске говорит «догнан перед ночью …»
  (`СС-168`). Вводный комментарий ИС-20 перенесён к ней.
- `dropDays` — удаление дней: строки состояний месяца кроме первого числа следующего,
  перезаписи/дозаполнения в частях журнала за удалённые дни, выполненные задания месяца;
  невыполненные переезжают на следующий за итогом день. `cal.daysDropped` ставится один раз.
- `closeMonth` — календарь · доспрос · итог · простановка + удаление дней + фиксация одним
  шагом. Им закрываются и май/июнь сида (сид бросает исключение, если закрытие отбито), и
  `ST.closePeriod` (лог и при отказе с молчанием).
- `storedOn` / `notStored` / `ST.notStored`, `datesOf` фильтрует нехранимые даты,
  `resolveAsOf` у состояния отвечает только ровно своей датой, `rowsAsOf` у состояния — строки
  ровно даты (перенос вперёд остался у событий до З-16a, комментарий «ГРАНИЦА» теперь про них).
- `dateGate`: «на … строки не хранится» с соседними хранимыми срезами и дорогой к живому
  расчёту владельца; `ST.flowBetween` — отказ `nsFrom` с полем `notStored`; `p.base` без
  `named`, `baseNote` без «вместо».
- Паспорт: `substituted`, `dense`, `carried`, `density`, `skipped` сняты у паспорта и точек
  ряда; `densityNote`, `skipNote` удалены (комментарий-надгробие брифа); экраны — по брифу
  (паспорт, таблица ряда, подпись строк, плитки, вариант базы потока 13.05 → 01.06 «итог мая»).
- `ST.reopenPeriod`: после `markExports` — прогон «повторное открытие» на первое число
  следующего (`full`, `keepT`, `statesOnly`, `REOPEN_SCAN`), `recount` в ответе, в записи
  `reopens` и в логе. `ST.run` отбивает дату удалённого дня (кроме первого числа);
  `gapsBefore` не считает дырой месяц с удалёнными днями.

**Отступления от брифа.**

1. **`dateGate`: условие `ns && ns.next && (ns.prev || !ns.legacy)` вместо `ns.prev && ns.next`.**
   Май демо-мира — первый свой месяц: у 15.05 предыдущего хранимого по эту сторону запуска
   нет, и по брифу он ушёл бы в ворота «разрыв между итогом и первым прогоном», тогда как
   таблица брифа для `#226` требует «не хранится». Строки на 15.05 были и удалены закрытием —
   отказ обязан назвать эту причину. Легаси-сторона без предыдущего итога отвечает прежними
   воротами (`ИС-12`, `ИС-41`).
2. **`nearStored(ns)`** — одно место для слов «ближайшие хранимые срезы — A и B» на воротах
   даты, потоке и пустой точке ряда. Код брифа печатал `fmt(prev)+' и '+fmt(next)` и при
   `prev = null` давал «— и 01.06.2026».
3. Сверх брифа, по тому же поводу: пустая точка ряда называет «не хранится» (`statSeries`);
   журнал печатает вид записи (`догон`, `повторное открытие`) вместо «плановый»; «слепок
   защёлки» → «доспрос защёлки» (журнал, строки, карточка ночи); комментарии `seriesDates`,
   текст «зачем у ряда своя фиксация», `ST.divergence` (сверка с итогом), `eachAlive`; отказ
   `ST.run` — «дни месяца май 2026» вместо «дни май 2026».
4. **Сторожа брифа усилены** (новых номеров нет, см. ниже): `#261` — паспорт всех дверей,
   `#260` — неполный итог, `#263` — отстающий `T`.

**Новые сторожа `#260`…`#263`** (код брифа; `#260`, `#261`, `#263` усилены):

| № | что держит |
|---|---|
| #260 | закрытие в две фазы: молчание на доспросе — отказ с перечнем 8 строк заёмщиков, дни не тронуты (1240); повтор проходит при неполных 21.07 (6) и неполном итоге 01.08 (6) — доспрос первым дозаполнил итог (6), неполноты после него 0; осталось 40 строк состояний июля, все на 01.08, удалено 1200; события 17 = 17; журнал 20.07 на месте, перезаписи сняты; невыполненные задания (8) переехали на 02.08 |
| #261 | 15.06 «не хранится» между 01.06 и 01.07; первое число отвечает своей строкой и зафиксировано; 15.07 — своей, возраст 0; 15.02 между легаси-итогами 01.01 и 01.04; событие отвечает на любую дату; полей подстановки и плотности нет ни у одной из 6 дверей (срез, строки, ряд, 3 точки) |
| #262 | поток за июнь от итога мая до итога июня — 379 980 сом, база без «вместо»; база 15.06 и конец 20.06 — отказ «не хранится» с полем; база в открытом июле своя |
| #263 | повторное открытие мая: дней не восстанавливает (39 строк, все на 01.06), итог пересчитан прогоном «повторное открытие» (полный, события не тронуты, курс 90 от 31.05 лёг в итог), `T` не сдвинут — и у соседа, молчащего с 20.05, остался 20.05; прогон за 15.05 отбит, 15.05 «не хранится» |

Усиления:

- `#261` — «паспорт один на все двери» (надгробие `#190`) держался в брифе только срезом;
  добавлены список строк, ряд и его точки (`doors261.length === 6`).
- `#260` — ночь 01.08 тоже с молчанием «кураторства»: `incS260 > 0`,
  `yes260.filled === incS260`, после закрытия неполных строк итога 0. Без этого порядок
  «доспрос первым» `#260` не держал: мутация 3 (прежний порядок) ловилась только `#198`,
  `#213`.
- `#263` — перед перезакрытием `T` «кураторства» поставлен на 20.05 (состояние «молчит каждую
  ночь с 20.05», поставленное прямо, как у `#226`). `T` двигается только вперёд, и у соседей,
  ответивших ночью 21.08, итог 01.06 его не сдвинул бы и без `keepT`: мутация 6b в брифовом
  `#263` проходила зелёной (248/248).

**TDD.**

- **RED** (движок HEAD `65a0c29` + блок `#260`…`#263` брифа дословно;
  `node scripts/inspect/statistics-check.mjs > smoke-red.txt`): `244/248 PASS`, `exit=1`, упали
  ровно четыре новых: `#260` («строк, собранных из молчания, 0», отказ «строки неполны —
  сосед «кураторство»…» — прежний рубеж), `#261` («соседними хранимыми срезами (undefined и
  undefined)», поля `substituted, dense, carried, density, skipped` на месте), `#262` («отказ с
  соседними срезами (—)»), `#263` («строк состояний мая 1202», «пересчитан … на —»).
- Движок без переписки старых: смоук падал крахом на `#129` (`was.asOf` у `null`), затем на
  `#226` (`inside.passport` нет); после их переписки — `239/248`, FAIL `#87`, `#130`, `#131`,
  `#144`, `#172`, `#198`, `#211`, `#212`, `#213`.
- **GREEN**: `248/248 PASS`, `exit=0` (244 + 4 новых, надгробий 0).

**Надгробия.** Новых нет. Ссылки вперёд надгробий З-15b теперь держатся: `#185` (два ответа
паспорта) и `#192` (плотности нет вовсе) — `#261`; `#186` (итог месяца — строка) — `#260`;
`#190` — `#256` и `#261` (паспорт один на все двери — после усиления).

**Переписано на месте — дата и счёт строк** (утверждение прежнее):

| № | было → стало | причина |
|---|---|---|
| #130 | дат 118 → 59, прогонных 112 → 53; добавлено: 15.06 нет среди дат, 01.06 и 01.07 есть | у закрытых мая и июня хранится только первое число следующего (`ADR-0238` §3) |
| #144 | `at144 > atSt144` → `at144 === atSt144` (42 → 39); «рассмотрено» и «без изменений» после `kept` — по частям состояний записи журнала (`stSum`); добавлено `re.recount.date === '2026-06-01'` | на 01.06 лежит только итог — строки состояний: строк событий на дате итога защёлка больше не пишет |
| #172 | строк 4535 → 2214, сомовых клеток 33 889 → 16 204, итогов 10 680 → 5075, дат 112 → 60 («на всех N датах строк» вместо «прогонов»); расхождений 0 | счёт строк; дат 60, а не 53: строки событий лежат и на днях закрытых месяцев |
| #212 | зафиксировано 1276 → 57 | дни июля удалены: итог 01.08 (40) + события месяца (17) |
| #226 | дат 118/112 → 59/53; срез до запуска на 01.04: 6 → 5 строк | счёт дат — как `#130`; 5 строк — чтение состояния ровно своей датой: КД-2019/017, погашенный в I квартале, больше не переносится с итога 01.01. Доказано мутацией: `rowsAsOf` без строки «состояние — ровно дата» снова даёт 6 (`КД-2019/017@2026-01-01`) |

**Переписано на месте — значение, доказанное следствие модели:**

| № | было → стало | почему | как проверено |
|---|---|---|---|
| #211 | дописано (`dense`) 19 → `made` 0 | плотного слепка нет; у событий итога на дату нет, доспрос их не спрашивает (`ADR-0239`) | мутация «доспрос снова спрашивает события» — дописано 19, переписано 0 (`#211` падает на `made === 0`) |
| #212 | дописано 19 → 0, переписано 4 → 2, всего 23 → 2 (= переписанному), частей с перезаписью 4 → 2 | две из четырёх перезаписей были строками СОБЫТИЙ на 01.08, которые доспрос больше не пересобирает; остались кредит КД-2025/043 и его заёмщик; сомовый итог кредита прежний: 12 920 251,35 → 13 390 613,18 | та же мутация: «дописал 19 строк и ПЕРЕПИСАЛ 4» — прежние числа |

**Переписано на месте — поле снято** (`СС-168`, бриф):

| № | было → стало |
|---|---|
| #87 | `substituted === false` → поля нет, `age === 0` |
| #129 | `was.asOf === '2026-08-21'` → `was === null`: резолвер у состояния на «сегодня» не отвечает ничем — подставлять нечего и под воротами |
| #131 | `substituted === false` → поля нет |
| #211, #212 | `dense` → `made` |

**Переписано на месте — порядок закрытия `ADR-0245` §7** (решение контролёра):

| № | было → стало |
|---|---|
| #198 | отказ по строкам вчерашней ночи ДО доспроса («строки неполны», `ADR-0208 §4`), починка — `ST.run('2026-08-01')` → отказ с доспроса: `closePeriod(…, {'классификация':'ответил ошибкой'})`, перечень `mute` (16 строк), «Кредит — 8», `ADR-0245 §7`; повтор без молчания дозаполняет итог сам (16) и закрывает (57) |
| #213 | «рубежа ДВА» → «рубеж ОДИН»: молчание вчерашней ночи закрытие не запирает — доспрос дозаполнил итог (23) и закрыл; молчание НА доспросе — отказ со строками `{obj, ref, nbs}` (23), строки 01.08 те же до байта, журнал +1 «доспрос перед закрытием периода июль 2026: не отвечено» |

**Переписано на месте — дописаны конъюнкты** (утверждение прежнее, новый факт модели):

| № | что добавлено |
|---|---|
| #15 | закрытие тем же шагом удалило строк дней — 1200 (`done.dropped.rows > 0`) |
| #17 | предупреждение о пропуске говорит «догнан перед ночью 21.08.2026»; блокировка считается по строкам последней хранимой даты (`bl2.at === '2026-08-21'`) |
| #201 | после закрытия строки состояний июля лежат только на 01.08 (40) |
| #20 | только комментарий: «их снимает З-15c» → «их сняла З-15c» |

Из названных брифом не падали и не тронуты: `#88`, `#132`, `#138`, `#139`, `#141`…`#143`,
`#145`…`#147`, `#193`, `#200`, `#214`…`#216`, `#218`, `#224`, `#227`, `#228`.

**Мутации** (копия дерева в scratchpad, одна копия на мутацию, смоук — копия репозиторного):

| № | мутация | упали |
|---|---|---|
| 1 | `closeMonth` не зовёт `dropDays` (нулевой ответ) | `237/248`: `#260` + `#15`, `#130`, `#144`, `#172`, `#201`, `#212`, `#226`, `#261`…`#263`. С `dropped = null` смоук падает крахом в `ST.closePeriod` (лог читает `dropped.rows`) на `#15` |
| 2 | `periodBlockers`: блокирует всякая неполная строка месяца (без `r.date === last`) | `247/248`: только `#260` |
| 3 | `closeMonth`: `periodBlockers` перед `repoll` | `245/248`: `#198`, `#213`, `#260` (до усиления `#260` — только `#198`, `#213`) |
| 4a | `storedOn` → `true`, `resolveAsOf` — прежняя подстановка с `substituted` | `242/248`: `#261` + `#129`, `#130`, `#226`, `#262`, `#263` |
| 4b | то же без поля `substituted` (подстановка молча) | `242/248`: те же |
| 5 | `ST.flowBetween` без отказа `nsFrom` | `247/248`: только `#262` |
| 6a | `ST.reopenPeriod` не зовёт `doRun` | `246/248`: `#263`, `#144` |
| 6b | прогон «повторное открытие» с `keepT: false` | `247/248`: только `#263` (до усиления `#263` — `248/248`, не ловил никто) |
| 7 | `ST.run` без отказа за удалённый день | `247/248`: только `#263` |
| 8 | доспрос снова спрашивает события (контроль причины `#211`/`#212`) | `242/248`: `#144`, `#172`, `#211`, `#212`, `#213`, `#260` — дописано 19, переписано 4 |

Хрупкий `#44` (второй `ST.go('journal')`) ни одной мутацией не задет.

**Время смоука.** 30,5 с (после правки ревью 1 З-15b) → 24,7 с: в мире вдвое меньше строк
(2248 против 4569 у копии `#259`), закрытие не материализует слепок.

**Находки.**

1. **Бриф: `ns.prev && ns.next` не покрывает первый свой месяц** — см. отступление 1.
   В реальном запуске то же ждёт первый месяц после выпуска миграции: предыдущего своего
   среза у его дней не будет никогда.
2. **`keepT` у «повторного открытия» наблюдаем только на отстающем соседе.** `T` двигается
   только вперёд, а дата итога всегда раньше `T` каждого соседа, ответившего хоть одну ночь
   после неё. Запрет держит только случай «сосед молчит с даты раньше итога» — его `#263`
   теперь и строит.
3. **Задания дозаполнения за удалённый день переезжают, но доспрос их не закрывает.** В `#260`
   итог 01.08 дозаполнен доспросом, а 8 заданий «дозаполнение» заёмщиков (поставлены за 21.07)
   остались открытыми на 02.08. Так велит бриф («работа не пропадает»), но работа эта уже
   сделана итогом; закрывать ли задание доспросом — вопрос к З-22/`ADR-0196`.
4. **Шапка `statistics.html` (ИС-45, ИС-46, раздел про запись) описывает разрежённое хранение и
   плотный слепок** как действующие (строки ~279–300, ~812–860). Код и экраны переписаны; шапка
   — бумага, её правит этап бумаги (спецификация §6).
5. Комментарий `ST.run` про «разрежённое хранение» (отложенный пункт З-15b) не тронут.

### З-15c, правка ревью 1

Ревью нашло один важный дефект (из текста брифа — решение контролёра: чинить), контролёр
добавил два несущих пункта. Исправлены новым коммитом поверх `fe2377c`; новых номеров нет —
дописаны конъюнкты `#145`, `#198`, `#262`.

1. **Отказ закрытия по строкам СОБЫТИЙ говорил неправду и не давал дороги** (важное). Ветка
   `periodBlockers` для событий (`: true` — запирает неполнота любого дня месяца) верна, но
   отказ `closeMonth` называл всё «итог неполон … промежуточные дни её не запирают, закрытие их
   удаляет». Проба рецензента: молчание «погашения» 20.07 → отказ «Платёж — 8 · Поступление — 7»
   (строки `obj-repay`, `obj-receipt` за 20.07) с текстом про итог; все утверждения ложны, дороги
   нет, а повторный прогон 20.07 чинит.
   - Движок: `periodBlockers` группирует по соседу И по части (`part: 'итог' | 'события'`), у
     группы событий — `dates` и текст «строки событий за DD.MM.YYYY: …». Отказ `closeMonth`
     говорит каждой части свою дорогу: молчание на доспросе — к соседу; неполный итог — «его
     дозаполнит доспрос, когда сосед ответит»; события — «дозаполняются повторным прогоном той
     ночи (DD.MM.YYYY): итога на дату у события нет, доспрос его не спрашивает, а закрытие его
     строк не удаляет (ADR-0208 §4, ADR-0239)». Фраза «промежуточные дни не запирают, закрытие
     их удаляет» говорится только при молчании на доспросе или неполном итоге.
   - `#198` дописан: молчание «погашения» 20.07 → закрытие отбито, блокировка событий одна с
     датой 20.07, отказ называет «строки событий за 20.07.2026», «Платёж — 8», «Поступление —
     7», «повторным прогоном», `ADR-0239` и не говорит «итог неполон» / «промежуточные дни»;
     повторный прогон 20.07 — и закрытие проходит.
2. **Поток молча считал «от рождения»** (решение контролёра). `resolveAsOf` у состояния без
   строки ровно на дату отвечает `null`, а ворота даты на начало периода не стояли: проба
   `from 22.08, to 21.08` — `ok`, 8 630 480 при 8 «рождённых» (верно ≈ 534 720); то же с дырой в
   открытом месяце.
   - Движок: `from > to` — отказ «начало … позже конца …» (`ИС-17`); база проходит `dateGate`
     (та же причина, что у среза) вместе с `notStored` (поле для `#262` осталось); база без
     строки — отказ «строки на эту дату нет — прогона за неё не было; ближайшие хранимые срезы —
     …». Ветка «строки на начало периода нет — период считается от рождения объекта» снята как
     недостижимая: `a` после отказа есть всегда. Записи, родившиеся внутри периода, считаются от
     нуля по-прежнему (`born`).
   - `#262` дописан: 19.08 → 16.07 — отказ «позже» (было −530 980); база 15.04 — отказ, в котором
     дословно стоит ответ `ST.dateGate('2026-04-15')`; база 10.08 без строки (ночь снята из
     журнала и строк прямо, как у `#226`) — отказ с соседями 09.08 и 11.08 (было 8 630 480).
3. **Очередь при удалении дней** (решение контролёра). Невыполненные задания переезжали на
   `S+1` и при повторном закрытии мая попадали на 02.06 — в закрытый июнь; задания первого
   числа (итог — хранимый день) удалялись/переезжали как задания удалённых дней, хотя записи
   перезаписей этого дня остаются.
   - Движок: `dropDays` ищет ПЕРВЫЙ ОТКРЫТЫЙ день — период не закрыт колонкой статистики и день
     не удалён закрытием (`ST.run` его примет); задания первого числа не трогаются ни
     выполненные, ни нет.
   - `#145` дописан: после перезакрытия мая в очередь поставлены (прямо, как поставил бы досчёт
     записи «с 20.05», `ADR-0215` §7) задание 20.05, открытое задание 01.06 и выполненное 01.06;
     после повторного закрытия первое — на 02.07 (02.06 закрыт, 02.07 открыт), оба 01.06 на
     месте и в очереди.

**TDD.** Конъюнкты дописаны до правки движка: `245/248`, `exit=1`, упали ровно `#145` («переехало
на 2026-06-02 … (2026-06-02, 2026-06-01), выполненное не удалено (false)»), `#198` («итог неполон —
сосед «погашения» … промежуточные дни её не запирают…»), `#262` («−530980», «база периода 15.04.2026
не хранится…», «8630480»). После правки: `248/248 PASS`, `exit=0`.

**Мутации** (копия дерева в scratchpad, смоук — копия репозиторного):

| мутация | упали |
|---|---|
| ветка событий `periodBlockers` → `false` (мутация рецензента) | `247/248`: только `#198` — закрытие прошло при молчании «погашения», повтор прогона 20.07 отбит закрытым периодом |
| все группы блокировок — `part: 'итог'` (прежний отказ одной фразой) | `247/248`: только `#198` |
| без отказа `from > to` | `247/248`: только `#262` — −530 980 |
| база без строки снова «от рождения» (прежние три строки) | `247/248`: только `#262` — 8 630 480 |
| база без `dateGate` (только `notStored`) | `247/248`: только `#262` — «не хранится — ближайший хранимый срез…» вместо ответа ворот |
| задание — на `S+1` без поиска открытого дня | `247/248`: только `#145` — 02.06 |
| задания первого числа — как задания удалённых дней | `247/248`: только `#145` — открытое 01.06 уехало на 02.07, выполненное удалено |

**Находка.** Срез на дату-дыру открытого месяца (ночь не состоялась и не догнана) отвечает
«строк на 10.08.2026 и ранее нет: подстановка запрещена (ИС-12)» — «и ранее нет» неверно, строки
раньше есть. Отказ верный, слова устарели с сужением ИС-12; поток теперь говорит «прогона за неё
не было» с соседями. Ворота среза не тронуты — вне трёх пунктов правки.

### З-16a — событие дельтой: адрес `part`, дата по привязке, поправка в месяце исправления, запрет записи (`ИС-55`; `ADR-0239` §1–§4; `СС-170`…`СС-172`, `СС-174`, `СС-176`…`СС-178`; `СС-179`)

**Движок.**

- Реестр: `d-pbdate` (дата привязки платежа, `d_bdate`) и `d-paystate` (состояние платежа,
  `d_pay_state`) рядом с `d-pdate` (`СС-176`); у `obj-repay` разрезов 8 → 10. Релиз
  `obj-repay`: `date:['d_rdate','d_bdate']`, `code:['d_pay_state']`. Мир: у 14 платежей
  `bdate` = `rdate` и `pstate:'подтверждён'` — числа мира не сдвинулись.
- Объекты: `obj-repay` — `evDay:['rdate','bdate']`, `evState` (`d-pcredit` → `rebind`,
  `d-paystate` → `reversal`), `corr`, `voidIf`; `obj-receipt` — `evDay:['rdate']`, `evState`
  (`d-rmatch` → `match`, `d-rfrz` → `freeze`), `corr`.
- Ядро: `CORE.payOn(p, d)` — привязка, состояние и день платежа (поздний из поступления и
  привязки); `repaidOf` и `receiptSplit` через него: сторнированный платёж погашением не
  является, платёж считается с дня, когда стал известен. `bornOn` у объекта с `evDay` — поздний
  из дней (`СС-177`).
- Строка: десятое поле `part` — адрес (`ST.ROW_SHAPE`, `ST.ROW_KEY = obj, ref, date, part`,
  `СС-170`); у состояния и легаси `null`, у события-дельты — вид поправки. Комментарий формы
  строки дописан: `part` завела волна, а не редакция.
- `writeRow` — единственные ворота записи: строка с тем же адресом переписывается, запись в
  закрытый период отбита у всех таблиц (`ИС-8`, `ADR-0239`), легаси — `{legacy: true}`. Через
  неё идут все записи `doRun` (копия, перезапись, строка состояния), `repoll` и `loadLegacy`.
- `FIRST_OWN` рядом с `LAUNCH` (`СС-174`): событие, известное до запуска, ложится на первый
  свой срез.
- Код брифа: `eventSliceOf`, `eventRow` (деньги на день события, `evState` — на ночь прогона,
  `СС-171`), `cents`, `scaleCell`, `addCell`, `negRow`, `voided`, `deltaAt`, `deltaNight`; в
  `doRun` — ветка событий-дельт; `rowsAsOf` у события-дельты — сумма строк не позже даты.
- `scanPlan`: критическая дата курса — только у состояний (`СС-171`: деньги события курс ночи
  не двигает).
- `seed()`: `markers: []`; дверь `ST.markers()`.
- Устаревшие комментарии поправлены: `newTally` (`skip`), нерассмотренная запись в `doRun`,
  `rowsAt`, `rowsAsOf`, `resolveAsOf`.

**Отступления от брифа.**

1. **`СС-179` — молчание соседа известное событие не переписывает и не поправляет.** В
   `deltaNight` после сборки `now`: `silentOf(now).length` → `same`, ничего не пишется, и
   задания «досчёт»/«распоряжение» не снимаются: снятие перенесено ПОСЛЕ проверки молчания,
   работа остаётся в очереди. По брифу молчание давало `rowDiff` по молчавшим полям: в открытом
   месяце известное событие переписывалось неполной строкой, в закрытом июне ложились ложные
   сторно и перепривязка. Проба: повторный прогон 20.07 с молчанием «погашений» — закрытие июля
   отбито и после повторного прогона без молчания (`#198` падал), а июньские платежи получали
   поправки. Основание — `ADR-0208` §1, §3 (молчание не значение) и `ADR-0239` §3, §4 (поправка
   — изменение события, а не ответа). Доказано мутацией 7.
2. **Неполная строка события возвращается в очередь дозаполнения** (часть `СС-179`): в `put` —
   `enq(…'дозаполнение'…)` при молчавших полях, `deq` при полной строке (тем же правилом, что
   у состояния, `ADR-0208` §5). Без этого строка события, рождённого в молчание, ждала бы, пока
   событие попадёт в кандидаты по другому поводу. Доказано мутацией 8 (после усиления `#198`).
3. `ST.markers = () => clone(ST.state.markers || [])` — со страховкой `|| []`: дверь не падает на
   состоянии без поля.
4. **Усилены сторожа брифа** (новых номеров нет): `#265` — мутации «`bornOn` без `evDay`» (бриф,
   мутация 2) и «без переноса на ночь» проходили зелёными; `#198` — очередь дозаполнения. См.
   ниже.

Имя `part` занято дважды, и это разные поля: у СТРОКИ `part` — вид поправки события (адрес,
`СС-170`); у БЛОКИРОВКИ `periodBlockers` (З-15c, правка ревью 1) `part: 'итог' | 'события'` —
ключ группировки отказа, в строку не пишется. Слились бы — отказ закрытия группировал бы по виду
поправки.

**Новые сторожа `#264`…`#268`** (код брифа; `#265` усилен):

| № | что держит |
|---|---|
| #264 | способ хранения — реквизит релиза: у 10 таблиц расхождений 0, у объектов своего способа нет; события — `obj-measure, obj-receipt, obj-repay`, копий у них 0; июньские платежи пережили закрытие (4 строки, по одной исходной, зафиксированы); `ROW_KEY` — четыре поля, `part` у состояния `null`, у события-дельты — вид из списка |
| #265 | ПГ-2026/1210 (поступил 25.07 в закрытом июле, привязан 21.08) — одна исходная строка на 22.08, на 01.08 его нет. Усиление: ПГ-2026/1211 (10.08 → 15.08, открытый август) — строка на 16.08, на 15.08 нет; ПГ-2026/1212 (поступил и привязан в закрытом июле, известен ночью 22.08) — строка на 22.08 |
| #266 | сторно в открытом августе переписывает строку ПГ-2026/1196 на месте (13.08, `сторнирован`), журнал перезаписей называет `d-paystate`; действующая сумма 0; прирост «погашено всего» КД-2022/065 за август 0 и равен потоку строк событий |
| #267 | перепривязка платежа закрытого июня: исходная 06.06 та же до байта; на 22.08 сторно (КД-2024/117, −28 000) и перепривязка (КД-2025/088, +28 000); сумма 28 000; маркер `corrected_later` (`stat_row_repay`, срез 06.06, поправка 22.08); отзыв сопоставления ПП-2026/0611 — строка `match` без сумм и свой маркер |
| #268 | запись в закрытое отбита у всех 10 таблиц одной функцией (15.06 и итог 01.07); в открытый август и легаси — проходит |

**TDD.**

- **RED** (движок HEAD `6c06150` + блок `#264`…`#268` брифа дословно): `248/253 PASS`, `exit=1`,
  упали ровно пять новых: `#264` (`ROW_KEY` из трёх полей, июньских строк платежей 8), `#265`
  (у строки нет `part`, «undefined сом»), `#266` (состояние «undefined»), `#267` (сумма NaN,
  маркера нет), `#268` (отбито у 0 таблиц из 10).
- Движок без переписки старых (смоук HEAD на новом движке): `238/248`, FAIL `#1`, `#3`, `#116`,
  `#119`, `#172`, `#181`, `#198`, `#202`, `#212`, `#223`.
- **GREEN**: `253/253 PASS`, `exit=0` (248 + 5 новых, надгробий 0).

**Надгробия.** Новых нет.

**Переписано на месте — счёт и форма** (утверждение прежнее):

| № | было → стало | причина |
|---|---|---|
| #1 | разрезов 79 → 81, записей реестра 308 → 310 | `d-pbdate`, `d-paystate` (`СС-176`) |
| #181 | записей 308 → 310, разрезов 79 → 81, с колонкой 191 → 193 | то же |
| #119 | разрезов платежа 8 → 10 | то же |
| #3 | полей 9 → 10, порядок `obj,ref,date,part,dims,…`; добавлено `ROW_KEY === 'obj,ref,date,part'` | `part` — адрес (`СС-170`) |
| #223 | полей легаси-строки 9 → 10, `lr.part === null` | то же |
| #172 | строк 2214 → 2194, сомовых клеток 16 204 → 16 108, дат 60 → 59; итогов 5075 — прежние, расхождений 0 | строк событий 49 → 29: у события одна строка, смена в открытом месяце переписывает её на месте (`ADR-0239` §3); ушла дата 23.06 (ночь отзыва ПП-2026/0620). Сверено с копией HEAD |
| #212 | зафиксировано 57 → 52 | строк событий июля 17 → 12 — по одной на событие; итог 01.08 — прежние 40. Сверено с копией HEAD |

**Переписано на месте — значение, доказанное следствие модели:**

| № | было → стало | почему | как проверено |
|---|---|---|---|
| #116 | цепочка «подтверждено → отозвано → восстановлено» по строке на смену → у ПП-2026/0620 одна исходная строка 11.06 с «восстановлено», движения — журнал перезаписей ночей 23.06 и 05.07 | в открытом месяце событие переписывается на месте (`ADR-0239` §3); путь событий «при изменении» (`СС-167`) снят | копия, где правка открытого месяца ложится строкой на дату ночи (`date: D` вместо `orig.date`): прежнее условие `#116` — `true` |
| #198, вторая половина | молчание «погашений» 20.07 → «Платёж — 8 · Поступление — 7» → строка ПГ-2026/1141 не тронута, поправок у платежей 0; неполны только события, родившиеся в молчание (в мир на время сторожа добавлены ПП-2026/0739 и ПГ-2026/1166 от 19.07): «Платёж — 1 · Поступление — 1», повторный прогон 20.07 дозаполнил 2 строки, закрытие прошло. Дописано (усиление): обе строки в очереди «дозаполнение», полная строка задание закрыла («строка написана полной») | `СС-179` + `ADR-0239`: известное событие молчанием не переписывается | копия с прежним путём событий (ветка `event_delta` в `doRun` снята): прежняя вторая половина `#198` — `true` («Платёж — 8 · Поступление — 7») |
| #202 | ключей критической даты 6 → 2, только ею 4 → 2 (КД-2025/043 и заёмщик 10510198203112); `run202.written === flat202.written + 4` → `=== flat202.written` (42); добавлено: курс 91,10 от 21.08 в строке USD-кредита, частей событий 3, переписанных строк в них 0 | события ушли из критической даты (`scanPlan`, `СС-171`); ответ соседей на время спроса кандидатов заморожен на 20.08 подменой `CORE.read` в `try/finally` (`СС-178`) | копия с прежним `scanPlan`: kd 6, only 4, но написано 42 = 42 — прежнее условие `false`; прежний `scanPlan` + прежний путь событий: 46 = 42 + 4 — `true`. «+4» — четыре валютных события, переписанных курсом |

Названные брифом и не упавшие (не тронуты): `#86`, `#87`, `#111`…`#114`, `#120`, `#136`, `#194`.
Составы те же — у всех платежей мира день привязки равен дню поступления. Тождества держатся, а
числа в тексте `#120` сдвинулись, как и предсказывал бриф: сомовое «разнесено» 1 711 880 →
1 702 800 (USD 600 440 → 596 190, EUR 202 440 → 197 610) — деньги события пересчитаны по курсу
дня события, а не ночи (`СС-171`).

Числа в текстах сдвинулись и у сторожей, чьи утверждения не менялись: `#15`, `#139` (зафиксировано
57 → 52), `#213` (строк мира 2248 → 2228; на 01.08 — 44 → 40: строк событий на дате итога больше
нет), `#259` (2248 → 2228), `#260` (события июля 17 → 12), `#173` (сомовых клеток 16 204 →
16 108), `#154` (пар «разрез + объект» 70 → 71); счёт реестра 308 → 310 / 79 → 81 / 191 → 193 —
`#127`, `#128`, `#148`, `#149`, `#155`, `#156`, `#158`…`#163`, `#165`, `#170`, `#180`, `#237`.

**Мутации** (копия дерева в scratchpad, одна копия на мутацию, смоук — копия репозиторного
после усилений):

| № | мутация | упали |
|---|---|---|
| 1 | `storageOf` → всегда `'state'` | `237/253`: `#264`…`#267` + `#116`, `#172`, `#198`, `#201`, `#202`, `#206`, `#211`, `#212`, `#228`, `#256`, `#258`, `#261` |
| 2 | `bornOn` без `evDay` (день поступления) | `252/253`: только `#265` (до усиления `#265` — `253/253`, не ловил никто) |
| 3 | в `deltaNight` снята ветка `!orig.fixed` (открытый месяц правится поправками) | `248/253`: `#266` + `#116`, `#172`, `#198`, `#212` |
| 4 | поправка пишется поверх исходной (`part:'original', date: orig.date`) | `252/253`: только `#267` |
| 5 | без `st.markers.push` | `252/253`: только `#267` |
| 6 | `writeRow` стережёт защёлку только у состояний | `252/253`: только `#268` |
| 7 | снят `СС-179` (молчание снова переписывает и поправляет) | `252/253`: только `#198` |
| 8 | неполная строка события не ставится в очередь | `252/253`: только `#198` (до усиления — `253/253`) |
| 9 | `voided` всегда `false` | `252/253`: только `#266` |
| 10 | `repaidOf` по-старому (без `payOn`: сторно не знает) | `252/253`: только `#266` |
| 11 | строка из закрытого месяца не переносится на ночь | `252/253`: только `#265` (до усиления — `253/253`) |
| 12 | порядок строк одной даты обращён (побеждает исходная) | `252/253`: только `#267` |

Хрупкий `#44` ни одной мутацией не задет; крахов нет.

**Время смоука.** 24,7 с (З-15c) → 26,3 с.

**Находки.**

1. **Повторное открытие месяца после поправки события ломает сумму.** Проба: перепривязка
   ПГ-2026/1102 закрытого июня (сторно и перепривязка на 22.08), затем `ST.reopenPeriod('2026-06')`
   и возврат привязки к КД-2024/117. Открытие снимает `fixed` с исходной, и `deltaNight` идёт
   веткой открытого месяца: переписывает исходную (журнал: «переписано d-pcredit»), а сторно и
   перепривязка на 22.08 остаются — действующий кредит по сумме строк КД-2025/088, в мире
   КД-2024/117. Код ветки — брифа; сторожа нет. Вопрос к контролёру: при живых поправках
   исправлять поправкой и в открытом месяце, или повторное открытие должно их снимать.
2. **Вторая поправка той же ночи затирает первую по адресу.** Перепривязка A → B ночью 22.08,
   затем повторный прогон 22.08 после смены B → C: сторно и перепривязка 22.08 переписаны по тому
   же адресу (`obj, ref, 22.08, reversal|rebind`): остались исходная A +28 000, сторно B −28 000,
   перепривязка C +28 000. Итог (C, 28 000) верен, разбивка по кредитам — нет: A +28 000, B −28 000
   вместо 0 и 0. Починка в пределах брифа — сторно считать от суммы строк НАКАНУНЕ ночи
   (`deltaAt(…, D−1)`), а не от суммы с уже написанными строками ночи. Не сделано: вне брифа.

### З-16a, правка ревью 1

Ревью нашло один критический и пять важных дефектов — все в коде `deltaNight` брифа;
контролёр велел чинить (спецификация §4 З-16: «сумма строк объекта — текущий итог» обязательна,
и З-16b строится на `deltaAt`/`writeRow`) и добавил пункт 7. Новым коммитом поверх `e827993`;
новых номеров нет (`#269`…`#272` — за З-16b): всё — конъюнкты `#198`, `#266`, `#267`, `#268`.

1. **Повтор ночи оживлял сторнированный платёж** (критическое). `was = deltaAt(…)` обнуляет
   суммы сторнированной исходной, а строка, собранная заново, — сырая, и `rowDiff(was, now)` у
   сторнированного события не пуст никогда. Закрытый июнь: сторно ПГ-2026/1102 ночью 22.08 —
   действующее 0; повтор 22.08 (досчёт или внеплановый пересчёт) писал `−0` по адресу
   `(22.08, reversal)` поверх −28 000 — действующее снова 28 000, строки событий КД-2024/117
   152 000 против потока «погашено» 124 000; каждая следующая ночь-кандидат клала нулевое
   сторно и ложный маркер. Открытый август: повтор ночи сторно писал в журнал перезаписей
   суммы, которые не менялись.
   - Движок: `effectiveOf(o, row)` — строка, собранная заново, с правилом сторно (суммы
     сторнированной исходной — нулём); сравнение `rowDiff(was, effectiveOf(raw))`. Список
     перезаписи открытого месяца — `rowDiff(orig, raw)`: что сменилось в самой строке.
   - Сторожа: `#267` — сторно закрытого июня + досчёт той же ночи + внеплановый пересчёт:
     действующее 0 · 0 · 0, строк 2, маркер 1; `#266` — повтор ночи сторно досчётом и
     пересчётом: перезаписей 0, действующее 0; журнал ночи сторно — ровно `d-paystate`.
2. **Повторное открытие после поправки** (важное; находка 1 З-16a). Открытие снимает `fixed`,
   и ветка открытого месяца переписывала исходную поверх живых поправок.
   - Движок: на месте переписывается только событие без поправок
     (`mine.every(r => r.part === 'original')`), иначе — ветка поправок.
   - Сторож `#267`: перепривязка A → B, `reopenPeriod('2026-06')`, возврат к A той же ночью —
     разбивка `КД-2024/117:28000`, действует КД-2024/117 (было: КД-2025/088, A 0 / B +28 000).
3. **Вторая поправка той же ночи** (важное; находка 2 З-16a). Сторно считалось от суммы с уже
   написанной перепривязкой.
   - Движок: основа поправки — `deltaAt(…, eveOf(D))`, состояние до ночи; поправки ночи,
     написанные её прежним прогоном, заменяются по адресу, вид, которого в новом наборе нет,
     снимается, перезапись идёт в журнал, маркер ночи ставится заново. Вернулось событие к
     состоянию до ночи — поправки ночи сняты целиком (этим же закрыт возврат в п. 2).
   - Сторож `#267`: A → B → C одной ночью — `КД-2023/210:28000`, строк 3, маркер 1 (было:
     A +28 000 · B −28 000 · C +28 000, маркеров 2).
4. **Ночь раньше после поздней** (важное). `deltaAt(…, D)` не видит строк после D: закрытый
   месяц — вторая пара поправок на 21.08 и второй маркер (A −28 000 / B +56 000); открытый —
   отзыв сопоставления ПП-2026/0837, переписанный ночью 22.08, пересчёт ночи 21.08 откатывал к
   «подтверждено».
   - Движок: `laterNightOf` — у события есть строка после D или запись журнала перезаписей
     ночи позже D; ночь D такое событие не трогает (`kept`) и работу из очереди не снимает.
     Перезапись на месте видна только журналу: строка одна, её дата — день события.
   - Сторожа: `#267` — A → B ночью 22.08, пересчёт 21.08: `КД-2025/088:28000`, строк 3,
     маркер 1; `#266` — отзыв ПП-2026/0837 ночью 22.08, пересчёт 21.08: строка «отозвано».
   - Граница (в комментарии): исходная, впервые написанная ночью позже D (событие внесено в
     мир задним числом), журналом не названа.
5. **Молчание теряло работу ночи** (важное, качество `СС-179`). Отзыв ПП-2026/0837 (21.08) в
   ночь 22.08 с молчанием «погашений» — `same`, в очереди ничего; ночь 23.08 своим фактом его
   уже не называет — отзыв терялся до полного обхода.
   - Движок: пропуск по молчанию ставит событие на досчёт с пометкой «молчали: …», если
     работы по нему (досчёт/распоряжение) в очереди нет.
   - Сторож `#198`: после ночи молчания — строка «подтверждено», в очереди досчёт «молчали:
     погашения» (1); ночь 23.08 берёт его очередью (1) — строка «отозвано».
6. **Сложение клетки по одной валюте** (важное). `addCell` сливал части по валюте: курс 18.06
   уточнён до 90, ПГ-2026/1127 перепривязан в закрытом июне — действующее 306 000 при
   основании `3400 × 87,45 = 297 330` (`ADR-0214` §4–§5).
   - Движок: часть — валюта + курс + дата курса (`partKey`); одновалютная клетка без частей,
     встретив слагаемое другого курса, получает части явно (`ownParts`, `mergeParts`).
   - Сторож `#267`: сомовая сумма действующего ответа 306 000, и сверка основания — мерка
     `#172`, но по ДЕЙСТВУЮЩИМ ответам (`rowsAsOf` платежей и поступлений на 22.08): расхождений 0
     (было 4: `m-ramount-som`, `m-palf-som`, `m-palp-som`, `m-pali-som` у ПГ-2026/1127).
7. **Отказ `writeRow` не считается записью** (решение контролёра). `doRun` (копия, перезапись,
   строка состояния, новая), `repoll` (дописал/переписал) и `loadLegacy` считали строку при
   отказе. Теперь счёт — только при `ok`; у прогона и доспроса отбитая строка уходит в `kept`
   («не тронуто», как зафиксированная), выпуск миграции её не считает. У `deltaNight` —
   тоже `kept`. Журнал перезаписи пишется после удачной записи.
   - Сторож `#268`: писатели зовутся прямо, мимо дверей — прогон за закрытое 15.06
     (`doRun`) написал 0 (не тронуто 40), доспрос закрытого июня без одной строки итога 01.07
     — 0 + 0, повторный выпуск миграции — 0 (было 39, 1 и 34).

**Имя счётчика.** «Поздняя ночь первее» и отбитая запись у события считаются в `kept`: у
состояния это «зафиксированная строка не тронута», у события — «строку держит поздняя ночь или
закрытый период». Новых полей журнала не заведено.

**TDD.**

- **RED** (движок `e827993` + конъюнкты): `249/253`, `exit=1`, упали ровно `#198` (досчёт
  «молчали» 0, строка «подтверждено»), `#266` (перезапись повтора — 8 денежных полей дважды;
  пересчёт 21.08 — «подтверждено»), `#267` (0 · 28000 · 28000, маркеров 2; A/B/C
  `КД-2023/210:28000,КД-2024/117:28000,КД-2025/088:-28000`; открытие — `КД-2025/088:28000`;
  21.08 — `КД-2024/117:-28000,КД-2025/088:56000`, строк 5; расхождений основания 4), `#268`
  (написал 39, доспрос 1, миграция 34).
- Промежуточный прогон после правки движка: `248/253` — `#197`, `#198`, `#207`, `#213`, `#260`:
  в `doRun` и `repoll` запись перенесена до `splitDiff(st.rows[i], …)`, и строка сравнивалась
  сама с собой (дозаполнение уходило в перезапись). Разбиение считается до записи, журнал —
  после удачной записи.
- **GREEN**: `253/253 PASS`, `exit=0`. Числа прежних сторожей не сдвинулись: в шапке
  изменились только тексты `#198`, `#266`, `#267`, `#268`.

**Мутации** (копия дерева в scratchpad, смоук — копия репозиторного):

| # | откат правки | смоук | упал — чем |
|---|---|---|---|
| 1a | `now = raw` — сравнение с сырой строкой | `251/253`, `exit=1` | `#266` (повтор ночи сторно пишет строк платежей 2), `#267` (записей и перезаписей повтора 4) |
| 1b | список перезаписи — по разнице с действующим | `252/253` | `#266` (журнал ночи сторно: `d-paystate` + 8 денежных полей) |
| 2 | на месте переписывается и событие с поправками | `252/253` | `#267` (открытие: `КД-2025/088:28000`, действует КД-2025/088) |
| 3a | основа поправки — `deltaAt(…, D)` | `252/253` | `#267` (A → B → C: `КД-2023/210:28000,КД-2024/117:28000,КД-2025/088:-28000`; открытие: `КД-2024/117:56000,КД-2025/088:-28000`) |
| 3b | поправка ночи вне нового набора не снимается | `252/253` | `#267` (открытие: `КД-2025/088:28000`) |
| 4a | без `laterNightOf` | `251/253` | `#266` (пересчёт 21.08 — «подтверждено»), `#267` (`КД-2024/117:-28000,КД-2025/088:56000`, строк 5, маркеров 2) |
| 4b | поздняя ночь — только по строкам после D, без журнала | `252/253` | `#266` (пересчёт 21.08 — «подтверждено») |
| 5 | молчание не ставит досчёт | `252/253` | `#198` (досчёт «молчали» 0, ночь 23.08 — «подтверждено») |
| 6 | прежний `addCell` (части по одной валюте) | `252/253` | `#267` (расхождений основания 4) |
| 7a | `doRun` считает отбитую запись | `252/253` | `#268` (прогон за закрытое 15.06 «написал» 28) |
| 7b | `repoll` считает отбитую запись | `252/253` | `#268` (доспрос 1 + 0) |
| 7c | `loadLegacy` считает отбитую запись | `252/253` | `#268` (выпуск миграции 34) |

Мутация 1a в первом прогоне мутаций ВЫЖИЛА (`253/253`): пункты 1b и 3 маскировали её в
сторожах по суммам — повтор ночи писал сторно и перепривязку заново, но основа «до ночи» и
замена по адресу давали те же числа. Сторожа усилены тем, что прямо следует из пункта 1:
повтор ночи сторно событие «без изменений» — ни строки, ни перезаписи (`#266`: строк платежей
повтора 0; `#267`: записей и перезаписей повтора 0). После усиления 1a падает на обоих.

**Пробы рецензента** (`probe.mjs` в scratchpad, сценарии по имени) — до → после:

| сценарий | до | после |
|---|---|---|
| double | A 28 000 · B −28 000 · C 28 000, маркеров 2 | A 0 · C 28 000, маркер 1 |
| reopen | действует КД-2025/088 (A 0 / B 28 000) | действует КД-2024/117 (A 28 000), поправки ночи сняты |
| rerun-earlier | строк 5, A −28 000 / B 56 000, маркеры 22.08 и 21.08 | строк 3, A 0 / B 28 000, маркер 22.08 |
| storno-closed | повтор: сторно −0, действующее 28 000, маркеров 2 | действующее 0, строк 2, маркер 1 |
| storno-closed-later | лишнее нулевое сторно 22.08 и маркер | сторно 21.08 одно, маркер один |
| storno-open-repeat | перезапись 8 денежных полей, n 1 | перезаписи нет, n 0 |
| storno-manual | действующее 28 000; события 152 000 против потока 124 000 | 0; 124 000 = 124 000 |
| rc-rerun | пересчёт 21.08 → «подтверждено» | «отозвано» |
| silent-drop | очередь пуста, ночь 23.08 — «подтверждено» | досчёт «молчали: погашения», ночь 23.08 — «отозвано» |
| usd-rate | 306 000 при основании 297 330 | 306 000, основание `3400 × 90` (+ нулевая часть 87,45) |

**Время смоука.** 26,3 с → 27,1 с (`253/253 PASS`, `exit=0`, FAIL 0).

**Граница, названная вслух.** У действующей клетки после сложения частей разных курсов поля
`rate`/`rateDate` верхнего уровня остаются от первой строки; состав — в `parts`/`from`, и
`partsOf` читает его. Экран, читающий курс клетки верхним полем, покажет курс исходной строки.

### З-16a, правка ревью 2

Повторное ревью приняло пункты 1, 2, 3, 5, 6, 7 правки 1. Открыты остаток пункта 4 (A) и
новое важное из самой правки (B); контролёр добавил два мелких из её диффа (C, D). Новым
коммитом поверх `41433bb`; новых номеров нет (`#269`…`#272` — за З-16b): всё — конъюнкты
`#266`, `#267`, `#268`.

A. **Событие, впервые записанное поздней ночью, откатывалось ночью раньше** (остаток п. 4;
   граница, названная в правке 1). `laterNightOf` видел строки после D и журнал перезаписей,
   а рождение строки журнал не называет. Поступление ПП-2026/0899 (день 12.08, отзыв 21.08),
   внесённое в мир после сида: ночь 22.08 рождает строку 13.08 сразу «отозвано», пересчёт
   21.08 переписывает её в «подтверждено», ночь 23.08 его не называет ни одним источником —
   отзыв потерян до полного обхода.
   - Движок: строку события помечает прогон, её записавший, — `run_id` схемы («прогон,
     последним записавший строку»); номер — место записи прогона в журнале. `laterNightOf`:
     строка после D или строка, последней записанная ночью позже D. Журнал перезаписей из
     проверки ушёл: перезапись на месте тоже перепомечает строку.
   - Сторож `#266`: ПП-2026/0899 — после ночи 22.08 и пересчёта 21.08 `2026-08-13:отозвано`.
B. **Сведённая клетка никогда не равнялась свежей** (новое важное; мои остатки (b) и (d)).
   После уточнения курса дня события сумма строк держала курс первой строки, нулевую часть и
   `parts`, а свежая строка — один курс; `JSON.stringify` находил «изменение» у каждой
   следующей ночи-кандидата: нулевая пара поправок и ложный маркер. У сторнированного
   платежа при уточнённом курсе — нулевое сторно и маркер на каждую ночь.
   - Движок: действующая клетка сводится к составу (`normCell` в `deltaAt`): нулевая часть
     снимается, пока рядом есть живая; осталась одна — клетка обычная с курсом этой части;
     несколько — курс верхнего уровня `null`, как у `portfolioCell`. Валютная клетка и
     основание сомовой сводятся одним правилом. Сравнение в `deltaNight` — по сути
     (`deltaDiff`/`cellSig`: число, валюта, ненулевой состав); курс нулевой клетки в подпись не
     входит — без этого сторнированный платёж при новом курсе всё равно давал бы разницу.
   - Сторож `#267`: курс 18.06 уточнён, ПГ-2026/1127 перепривязан — клетка ответа
     `90/2026-06-18` без частей, нулевых частей рядом с живыми 0; ночи 23.08 и 24.08 с
     досчётом — строк 3 → 3 → 3, маркеров 1 → 1 → 1, записано 0 · 0 (было 3 → 5 → 7,
     1 → 2 → 3, 2 · 2). Сторнированный ПГ-2026/1127 (сторно ночью 21.08), курс уточнён —
     пересчёт 22.08, ночи 23.08 и 24.08: строк 2 → 2 → 2 → 2, маркеров 1 (было 2 → 5, 1 → 4).
C. **Снятие поправок ночи шло мимо двери** (мелкое, решение контролёра). Удаление `gone`
   делало `splice` без проверки защёлки и фиксации: перепривязка ночью 20.07, июль закрыт,
   мир возвращён, прямой `doRun(20.07)` — обе зафиксированные строки поправки удалены,
   маркер снят, перезапись в журнале.
   - Движок: `rowGate` — одна дверь для `writeRow` и нового `dropRow`; набор ночи (снимаемые +
     записываемые) проходит дверь целиком или не проходит вовсе — иначе маркер снимался бы
     при отбитых записях. Отказ — `kept`.
   - Сторож `#268`: строки `06-06:original*, 07-20:reversal*, 07-20:rebind*` до и после,
     маркеров 1 → 1, в журнале перезаписей 0, прогон записал 0.
D. **Отбитая запись ещё считалась** (мелкое, решение контролёра). В `doRun` «не менялось»
   считалось до отказа (тождество `written = n + same + copied` рвалось: заёмщики same 2,
   сделки 5, программы 4 при written 0), `born` — до отказа (`doRun` и `deltaNight`),
   дозаполнение шло в журнал до отказа.
   - Движок: `same`, `born`, `filled` — после удачной записи; у события `same` по-прежнему без
     записи (строка события пишется при изменении).
   - Сторож `#268`: прогон за закрытое 15.06 встречает заёмщика и платёж, внесённых в мир
     задним числом (рождены 10.06), и строку итога мая, рождённую в молчание
     классификации, — рождено 0, дозаполнено 0, тождество у состояний держится (было:
     рождено 2, дозаполнено 1, тождество ложно).

Строку итога мая у заёмщика сторож делает «молчавшей» руками: снимает величину
`m-bworst` и помечает классификацию молчавшей. Июнь закрыт, и естественно такую строку в
сиде не получить. Правка — в памяти одного сценария, после него сид пересобирается.

**TDD.**

- **RED** (движок `41433bb` + конъюнкты): `250/253`, `exit=1`, упали ровно `#266`
  («подтверждено»), `#267` (клетка `87.45/2026-05-31+parts`; строки и маркеры растут каждую
  ночь), `#268` (рождено 2, дозаполнено 1, тождество ложно; снятие — строк 1, маркеров 1 → 0,
  перезапись 1).
- Первый зелёный прогон — `251/253`:
  - `#259`: список полей подписи был объявлен константой модуля `SIG_SKIP`. Сборка мира
    её читает, а в ключе кэша её нет, и сторож кэша назвал её поимённо. Список перенесён
    внутрь `cellSig`.
  - `#267`: помощник сторожа считал нулевые части и у целиком нулевых клеток (9). По
    правилу `normCell` у нулевой клетки одна нулевая часть и есть её состав. Помощник
    сужен до нулевых частей рядом с живыми — это поправка сторожа, модель не менялась.
- **GREEN**: `253/253 PASS`, `exit=0`. В шапке изменились только тексты `#266`, `#267`,
  `#268`.

**Мутации** (копия дерева в scratchpad, `mutr2.py`):

| # | откат правки | смоук | упал — чем |
|---|---|---|---|
| A1 | `laterNightOf` — только строки после D | `252/253`, `exit=1` | `#266` (ПП-2026/0899 и ПП-2026/0837 — «подтверждено») |
| A2 | строка не помечается прогоном (`run_id`) | `252/253` | `#266` (то же) |
| B1 | сравнение посимвольное (`rowDiff`) | `252/253` | `#267` (сторнированный при новом курсе: строк 2 → 5, маркеров 1 → 4) |
| B2 | без `normCell` в `deltaAt` | `252/253` | `#267` (клетка `87.45/2026-05-31+parts`, нулевых частей 30) |
| B3 | курс нулевой клетки входит в подпись | `252/253` | `#267` (сторнированный при новом курсе: строк 2 → 5) |
| C1 | снятие прежним `splice` мимо двери | `252/253` | `#268` (строк 1, маркеров 1 → 0, перезапись 1) |
| C2 | снятие через `dropRow`, но набор не целиком | `252/253` | `#268` (строки целы, но маркер 1 → 0, перезапись 1) |
| D1 | «не менялось» до отказа | `252/253` | `#268` (тождество ложно, заёмщики same 2) |
| D2 | `born` состояния до отказа | `252/253` | `#268` (рождено 1) |
| D3 | `born` события до отказа | `252/253` | `#268` (рождено 1) |
| D4 | дозаполнение в журнал до отказа | `252/253` | `#268` (дозаполнено 1) |

Все 11 убиты. B1 при нормализованном ответе ловится только на сторнированном платеже: у
перепривязанного сведённая клетка посимвольно равна свежей, и сравнение по сути нужно
ровно для нулевой клетки при новом курсе. Журнал открытой ветки `deltaNight` перенесён
после записи тоже, но мутации не имеет: исходная там не зафиксирована, её месяц открыт,
и запись не отбивается.

**Пробы рецензента** (`probe_rr.mjs` и `probe.mjs` скопированы в scratchpad; до — движок
`41433bb`, после — рабочее дерево):

| сценарий | до | после |
|---|---|---|
| late-born | сторнирован, действующее 0 | то же; пересчёт 21.08 — `kept 1` |
| late-born-rc | пересчёт 21.08 → «подтверждено» (журнал `d-rmatch`), 23.08 не назван | «отозвано» после пересчёта и ночи 23.08 |
| storno-rate | нулевое сторно и маркер 22.08, ещё раз 23.08 (маркеров 3) | строк 2, маркер 1 (21.08), 22.08 — `same 1` |
| usd-rate-next | 23.08: строк 3 → 5, КД-2025/101 −3400/+3400, маркеров 2 | разница пуста, строк 3, маркер 1, клетка `3400 @ 90 / 18.06` |
| gone-closed | строки поправки удалены, маркер снят, перезапись в журнале | строк 3 (все зафиксированы), маркер 1, журнал пуст, `kept 1` |
| tally268 | тождество ложно: заёмщики same 2, сделки 5, программы 4 | тождество у всех состояний, same 0 |
| 10 прежних (`probe.mjs`) | верны | верны; у usd-rate сомовая клетка сведена: `rateDate 2026-06-18`, без нулевой части |

**Время смоука.** 27,1 с → 27,7 с (`253/253 PASS`, `exit=0`, FAIL 0).

**Граница, названная вслух.** У сомовой клетки с несколькими живыми частями (два курса с
числом в одном событии) верхний `rate` тоже `null`, хотя у сомовой он всегда 1: `normCell` не
отличает сомовую сторону от валютной. Состав при этом верен, `partsOf` читает его. В сиде и
сторожах такой клетки нет: после перепривязки живая часть одна.

### З-16a, правка ревью 3

Повторное ревью приняло A–D правки 2, но нашло в ней два новых важных. Контролёр велел
закрыть оба одной переменой: ночь, создавшая строку, записывается в журнал прогона, а не в
строку. Сделано новым коммитом поверх `1622126`. Новых номеров нет: всё — конъюнкты `#3`,
`#266`, `#267`, `#268`.

1. **Поздняя ночь, только снявшая строки, перестала быть первее** (регрессия правки 2).
   Правка 2 заменила проверку журнала пометкой строки, а снятая строка пометки не оставляет.
   - Сценарий (ПП-2026/0611, июнь закрыт):
     - ночь 22.08 кладёт поправку `match` «отозвано»;
     - историю уточняют: отозвано лишь 19–20.08, с 21.08 снова «подтверждено»;
     - пересчёт 22.08 поправку снимает, в журнале `d-rmatch`;
     - пересчёт 20.08 пишет `match` «отозвано» на 20.08 (`kept 0 n 1`).
   - Итог: действующее на 22.08 и после ночи 23.08 — «отозвано», по миру «подтверждено»,
     очередь пуста.
2. **`run_id` — одиннадцатое поле вне закрытой формы строки** (контракт `ST.ROW_SHAPE`,
   СС-170, `#3`). Его несли все строки платежей и поступлений после сида и действующие
   ответы `rowsAsOf`. Пометка к тому же была местом в `st.runs`: сторожа, фильтрующие
   журнал, сдвигали ночь (ПГ-2026/1196: 13.08 → 14.08).
3. **`#268` печатал не проверенное число** (мелкое): выпуск миграции читался после
   пересборки мира под следующий сценарий — «34» при проверенных 0.

- Движок:
  - `run_id` и `nightOfRow` сняты.
  - В части журнала рядом с `rewrote`/`filled` — новый список `created`: строки событий,
    рождённые ночью, поимённо. Счёт у схемы есть (`stat_run_count.new_rows`), имён нет.
  - `laterNightOf` снова читает журнал: строка после D ИЛИ журнал прогона с датой позже D
    называет событие в `rewrote` (туда же идёт снятие поправок), `filled` или `created`.
    Ночь ищется по дате прогона, а не по месту в журнале.
  - У состояния `created` пуст: его ночь и есть дата строки.
- Сторожа:
  - `#3`: форму держит каждая строка — все 2228 хранимых (строк событий 29) и 29
    действующих ответов событий на 21.08; вне формы 0 (было 58: `run_id`).
  - `#267`: сценарий ревьюера на ПП-2026/0611 — пересчёт 20.08 `kept 1`, записано 0, строки
    `original`, действующее на 22.08 «подтверждено».
  - `#266`: конъюнкт late-born-rc правки 2 (ПП-2026/0899) держится теперь через `created`.
  - `#268`: печатает число, которое проверяет (0).

**TDD.** RED (движок `1622126` + конъюнкты): `251/253`, `exit=1`, упали ровно `#3` (вне формы
58, `run_id`) и `#267` (`kept 0`, записано 1, строки `original,match`, «отозвано»). GREEN:
`253/253 PASS`, `exit=0`; в шапке изменились тексты `#3`, `#267`, `#268` (у `#268` — только
«повторный выпуск миграции — 34» → «0»).

**Мутации** (копия дерева в scratchpad, `mutr3.py`):

| # | откат | смоук | упал — чем |
|---|---|---|---|
| J | журнальная часть `laterNightOf` снята | `251/253`, `exit=1` | `#266` (ПП-2026/0837 и ПП-2026/0899 — «подтверждено»), `#267` (`kept 0`, записано 1, «отозвано») |
| R | `run_id` снова пишется в `put` | `252/253` | `#3` (вне формы 58, `run_id`) |
| C | рождение не пишется в `created` | `252/253` | `#266` (ПП-2026/0899 — «подтверждено») |
| L | `laterNightOf` не читает `created` | `252/253` | `#266` (то же) |

**Пробы** (копии `probe.mjs`, `probe_rr.mjs`, `rv2/*.mjs` в scratchpad; до — движок
`1622126`, после — рабочее дерево):

| проба | до | после |
|---|---|---|
| gone-rc | пересчёт 20.08: `kept 0 n 1`, `match` «отозвано» на 20.08; действующее 22.08 и 23.08 — «отозвано» | `kept 1 n 0`, строка только исходная; «подтверждено» и 22.08, и 23.08 |
| gone-then-earlier (платёж) | пересчёт 20.08: `kept 0`, `same 14` — строки целы | `kept 1`, `same 13` — строки те же |
| keys | у строк платежей и поступлений и у ответа `rowsAsOf` — `run_id` (11 полей) | 10 полей у всех |
| leg | пометок 29; после фильтра журнала 5 указывают не на ту ночь | пометок нет |
| mixed | без изменений | без изменений |
| 10 сценариев `probe.mjs`, 6 `probe_rr.mjs` | верны | верны; в части журнала добавилось поле `created` |

**Время смоука.** 27,7 с → 27,8 с (`253/253 PASS`, `exit=0`, FAIL 0).

**Граница, названная вслух.** Список `created` — поле журнала, которого нет в физической
схеме: у `stat_run_count` есть только счёт `new_rows`. Имена рождённых строк схеме
понадобятся тем же правилом. Сама схема в этой задаче не правится.

### З-16b — мера × цель, событие на дату одной функцией, поток событиями (`ИС-55`; `ADR-0239` §5, §6; схема §11.2; `СС-175`, `СС-176`)

**Движок.**

- Реестр: `d-mprimary` (представитель меры, `d_primary`, `bool`, поле `primary`) рядом с
  `d-mstate` (`СС-176`); записей 310 → 311, разрезов 81 → 82, с колонкой 193 → 194. Релиз
  `obj-measure`: `bool:['d_primary']`.
- Объект `obj-measure`: `targets`, `primary`, `primaryBy` (`СС-175`), `evState`
  (`d-mstate`, `d-mresult` — на ночь прогона, `СС-171`), `corr:['original']`; разрезов 7 → 8.
  Мир: поле `targets` у пяти мер (у `МВ-2026/19` и `МВ-2026/31` — по две цели, заёмщик и
  поручитель). Все цели — требования того же кредита и дела, родились не позже меры.
- Код брифа: `pairsOf`, `fullAt`, `fullNight`, `eventAt` после `deltaNight`; двери
  `ST.eventAt`, `ST.repayAt`, `ST.receiptAt`, `ST.measureAt`, `ST.eventFlow` рядом с
  `ST.rowsAsOf`. Цель пары лежит в адресе `part` (`СС-170`), представитель — разрезом строки:
  форма строки прежняя, десять полей (`#3` держит все 2229 хранимых строк).
- `doRun`: `event_full` идёт в `fullNight` рядом с `event_delta` → `deltaNight`. Прежний путь
  событий «строка при изменении» (`СС-167`) снят: ветки `if(!state)` убраны, переменная
  `state` не нужна — ниже доходят только состояния. Комментарии, говорившие «мера до З-16b
  пишется при изменении», переписаны (`newTally`, `doRun`, `rowsAsOf`).
- `rowsAsOf`: событие отвечает `eventAt` своего способа; мера — строками представителей
  (`СС-175`), все пары — дверью `ST.measureAt`.

**Отступления от брифа** (бриф писался по исходному коду З-16a, до трёх правок ревью):

1. **Ночь меры — с уроками ревью ночи дельты.** `fullNight` брифа переписан под нынешний
   `deltaNight`:
   - рождение пары — «у пары нет ни одной строки», а не «нет строки не позже D»: иначе ночь
     раньше после поздней ночи, родившей меру закрытого месяца на свою дату, положила бы вторую
     исходную;
   - рождённая строка называется в журнале поимённо (`created`, с целью) — её читает
     `laterNightOf` (правка ревью 3 З-16a);
   - поздняя ночь первее (`laterNightOf`): мера, которую писала ночь позже D, ночью D не
     трогается, работа из очереди не снимается;
   - молчание соседа известную меру не переписывает (`СС-179`): досчёт «молчали», если работы
     в очереди нет. В демо-мире у меры соседей нет (`srcs` пуст), и ветка сторожем не
     проверяется — она тем же правилом, что у дельты;
   - сравнение по сути (`deltaDiff`), а не `rowDiff`; список перезаписи — по `rowDiff`, как у
     дельты;
   - набор ночи по мере (рождения, перезаписи, поправки, снятия) проходит `rowGate` целиком
     или уходит в `kept`;
   - счёт, журнал, маркер, очередь дозаполнения — после удачной записи; очередь — по мере
     целиком (она адресует меру, а не пару).
2. **Поправка, которая ничего не исправляет, снимается** вместе с маркером: мера вернулась к
   состоянию исправленной строки (той же ночью или позже, пока месяц поправки открыт) — строка
   полного состояния, равная исправленной, лишняя. Аналог снятия поправок ночи в `deltaNight`
   (правка ревью 1 З-16a, п. 3). Переписанная на месте поправка получает маркер заново.
3. **Счёт — строки парами, решения мерой.** Бриф считал `skip`/`same` на пару: `#201`, `#206`,
   `#256` падали на «не обойдено 34 → 36», а тождество `#201` «написано + не обойдено = живые
   записи» (76) ломалось — пар 78, записей 76. Решения ночи (`skip`, `kept`, `same`) — о
   ЗАПИСИ, которую ночь смотрела или нет, как у дельты событием; строки (`n`, `written`,
   `born`, `created`/`rewrote`/`filled` с `target`) — парами. Доказано мутацией 11.
4. **Маркер называет ночь датой прогона** (`found_run`/`closed_run` = дата ночи, а не
   `st.runs.length`). Отложенный пункт З-16a закрыт, потому что код маркера тронут: маркер
   ставится одной функцией `markCorrected`/`unmarkCorrected` у обоих способов (дельта — с
   `target_id: null`). Сторожей, читавших номер, нет; `#270` проверяет дату.
5. **`ST.eventFlow`**: сверх брифа — отказ, если величина не лежит в строке (агрегат) или
   разреза нет у объекта, отказ при `from > to` (как `flowBetween`, `#262`), и отказ по
   группе, в которой встретились две валюты (`ADR-0214` §1): без разреза поток платежей
   сложил бы KGS с USD. В ответе — `cur` по группам.
6. `rowsAsOf` у события — `eventAt(…) || []`: объект без способа хранения отвечает пусто, а не
   прежним путём «последняя строка записи». Проверка стороны запуска (`preLaunch`, `ADR-0207`
   §7) у событий снята вместе с прежним путём: легаси-строк событий нет (`СС-Д25`), событие до
   запуска ложится на `FIRST_OWN` (`СС-174`) — комментарий у ветки.
7. **Усилены сторожа брифа** (новых номеров нет): `#270` и `#272` — см. ниже; конъюнкт
   рождения в `#270` дописан после батареи мутаций (мутация 14 выжила).

**Новые сторожа `#269`…`#272`** (код брифа; `#270`, `#272` усилены):

| № | что держит |
|---|---|
| #269 | строк меры 7 у пар, мер 5, представителей 5 — все цели-заёмщики; `ST.measureAt` — 7, `rowsAsOf` — 5, `a-count` — 5 |
| #270 | поправка меры закрытого мая — 2 строки полного состояния на 22.08 (требование 2 870 000, новый исход), исходные 09.05 зафиксированы, маркеров 2 с целью. Усиление: сторно `МВ-2026/31` в открытом августе переписало обе строки пары от 10.08 на месте, журнал ночи 15.08 называет цели; маркер — `found_run`/`closed_run` = 22.08; повтор ночи — записано 0, строк 4, маркеров 2; ночь 21.08 после поправки — `kept 1`, строк на 21.08 нет; исход возвращён — поправки и маркеры сняты, журнал называет обе цели; прогон за закрытое 15.06 мимо дверей — записано 0, `kept 1` на меру, маркеров 0; ночь 22.08, родившая `МВ-2026/40` на срез 13.08, называет рождение в `created` с целью, и пересчёт 15.08 её не откатывает (`kept 1`, строка «сторнирована») |
| #271 | событие на дату: платёж — 22.08 побеждает перепривязка, сумма 28 000; сторнированный — 0; поступление «отозвано» при сумме 28 000; мера — последняя строка каждой пары, «сторнирована» |
| #272 | поток за (01.06, 01.07] и (01.08, 22.08] после перепривязки = прирост «погашено всего» по каждому кредиту (КД-2024/117 68 000, КД-2025/088 42 500). Усиление: без разреза — отказ «KGS и USD» (`ADR-0214` §1); по валюте — KGS 83 500 · USD 3 400, сом 380 830; у меры — отказ `event_full` |

**TDD.**

- **RED** (движок `d31b19a` + блок `#269`…`#272` брифа дословно): `253/257 PASS`, `exit=1`,
  упали ровно четыре новых: `#269` (пар 5, представителей 0, дверь 0), `#270` (1 строка на
  22.08, маркеров 0), `#271` (дверей нет — «—», `undefined`), `#272` (`ST.eventFlow` нет,
  расхождений 4).
- Движок по брифу без переписки старых: `250/257` — FAIL `#1`, `#126`, `#172`, `#181`, `#201`,
  `#206`, `#256`. Последние три — счёт `skip` на пару (отступление 3); после счёта мерой —
  `253/257`: `#1`, `#126`, `#172`, `#181`.
- **GREEN**: `257/257 PASS`, `exit=0` (253 + 4, надгробий 0).

**Надгробия.** Новых нет.

**Переписано на месте — счёт** (утверждение прежнее):

| № | было → стало | причина |
|---|---|---|
| #1 | разрезов 81 → 82, записей 310 → 311 | `d-mprimary` (`СС-176`) |
| #181 | записей 310 → 311, разрезов 81 → 82, с колонкой 193 → 194 | то же, колонка `d_primary` |
| #126 | разрезов меры 7 → 8 | то же |
| #172 | строк 2194 → 2195, сомовых клеток 16 108 → 16 109; дат 59, итогов 5075 — прежние, расхождений 0 | строк меры 6 → 7: пар 7, а строка сторно `МВ-2026/31` на 15.08 не ложится рядом — полная строка пары переписана на месте (`ADR-0239` §3) |

Значений, упавших без счёта строк, нет. Названные брифом `#86`, `#98`, `#121`, `#124`, `#127`,
`#182` не упали и не тронуты: срез меры читает представителей, и составы, суммы, дедуп по
кредиту те же. Числа в текстах сдвинулись у сторожей, чьи утверждения не менялись: счёт реестра
310 → 311 / 81 → 82 / 193 → 194 — `#127`, `#128`, `#148`, `#149`, `#155`, `#156`, `#158`
(«по справочнику» 46 → 47), `#159`…`#163`, `#165`, `#170`, `#180`, `#237`; пар «разрез + объект»
71 → 72 — `#154`; строк мира 2228 → 2229 — `#3`, `#213`, `#259`; сомовых клеток — `#173`;
зафиксировано в мае 42 → 43 — `#144`, `#145` (вторая пара `МВ-2026/19`).

**Мутации** (копия дерева в scratchpad, `t4b/mut.py`, одна копия на мутацию):

| # | откат | смоук | упал — чем |
|---|---|---|---|
| 1 | у меры одна пара — первая цель | `253/257` | `#172` (строк 2194), `#269` (пар 5), `#270`, `#271` (пар 1) |
| 2 | поправка меры закрытого — разностью, а не полным состоянием | `256/257` | `#270` (требование 0, а не 2 870 000; повтор ночи пишет 2) |
| 3 | на одну дату побеждает сторно, а не перепривязка (ранг обращён) | `255/257` | `#267`, `#271` |
| 4 | сторнированная исходная входит в сумму «на дату» | `255/257` | `#266`, `#271` (ПГ-2026/1196 — 52 000, а не 0) |
| 5 | поток за `[from, to)` вместо `(from, to]` | `256/257` | `#272` |
| 6 | маркер называет ночь местом в журнале (`st.runs.length`) | `256/257` | `#270` |
| 7 | ночь меры без `laterNightOf` | `256/257` | `#270` (ночь 21.08 откатила поправку; ночь 15.08 откатила рождённую 22.08 меру к «зарегистрирована») |
| 8 | поправка, которая ничего не исправляет, не снимается | `256/257` | `#270` (исход возвращён — строк 4, маркеров 2: поправки остались) |
| 9 | открытый месяц — поправкой, а не на месте | `255/257` | `#172`, `#270` |
| 10 | срез меры — все пары, а не представители | `253/257` | `#86`, `#124`, `#134`, `#269` |
| 11 | «не обойдено» — на пару | `254/257` | `#201`, `#206`, `#256` |
| 12 | набор меры проходит дверь поштучно, а не целиком | `256/257` | `#270` (не тронуто 2, а не 1 на меру) |
| 13 | представитель — последняя цель | `256/257` | `#269` |
| 14 | рождение пары не называется в журнале (`created`) | `256/257` | `#270` (пересчёт 15.08 откатил меру к «зарегистрирована») — **первым прогоном выжила** (`257/257`); сторож дописан конъюнктом, см. ниже |
| 15 | поток складывает разные валюты | `256/257` | `#272` (отказа без разреза нет) |

Мутация 14 выжила первой батареей: у меры рождение называлось в журнале, но ни один сторож
этого не читал. `#270` дописан конъюнктом (новых номеров нет): ночь 22.08 рождает
`МВ-2026/40` (мера 12.08, сторнирована 20.08) на срез 13.08 открытого августа — строка лежит
раньше ночи, и о поздней ночи говорит только журнал; пересчёт ночи 15.08 — не тронуто 1,
записано 0, строка «сторнирована». Мутации 14 и 7 перепрогнаны: обе падают на `#270`, строка
у обеих — «зарегистрирована» (откат). Запись мира `МВ-2026/40` живёт только внутри сторожа и
снимается в `finally`.

**Пробы З-16a** (копии `probe.mjs`, `probe_rr.mjs`, `rv2/gone-rc.mjs`, `rv3/samedate.mjs` в
`t4b/probes`; до — движок `d31b19a`, после — рабочее дерево):

| проба | до | после |
|---|---|---|
| 13 сценариев `probe.mjs` (double, inds, rc-rerun, reopen, rerun-earlier, silent-drop, silent-poll, storno-closed, storno-closed-later, storno-manual, storno-open-repeat, usd-rate, usd-sum) | верны | вывод тот же побайтно |
| 6 сценариев `probe_rr.mjs` (gone-closed, late-born, late-born-rc, storno-rate, tally268, usd-rate-next) | верны | вывод тот же побайтно |
| `gone-rc` | верна | вывод тот же побайтно |
| `samedate` C — прогонов, называющих `created` | 15 | 19: рождения мер теперь называются поимённо (было только у дельты). Остальные строки пробы (A, B, D, кэш) — те же |

**Время смоука.** 27,8 с → 28,3–28,4 с (два прогона; `257/257 PASS`, `exit=0`, FAIL 0).

**Находки и границы.**

1. **Требование меры по цели.** Схема §11.3: `i_claim_v` — «требуемое по цели». Мир держит
   одну сумму меры, и каждая пара несёт её целиком (у `МВ-2026/19` обе пары — 2 870 000).
   Итог верен — суммы идут по представителю, — но сумма по НЕпредставителю есть сумма меры, а
   не цели. Разнесение требования по целям в мире не моделируется.
2. **Представитель: «первая» против «старшей».** Схема §11.2 — «цель-заёмщик, иначе
   единственная цель по кредиту, иначе старшая»; `СС-175` и бриф — «иначе первая». Макет
   следует `СС-175`; у всех мер демо-мира есть цель-заёмщик, и разница не видна.
3. **Итоги меры и сторно.** Схема: «итоги сумм — по `d_primary` и `d_mstate = 'действует'`».
   Срез макета отбирает только представителя; сторно отсекает сужение вопроса (И-3, `#124`),
   как прежде. Словарь `d_mstate` — находка 5 этапа 2.
4. ~~**Цель, снятая с меры.** Пары, чьей цели в записи больше нет, остаются с последней строкой
   навсегда — выбытия цели в модели нет.~~ Снято правкой ревью 1: снятая цель — сторно по цели
   (схема §11.2), пара получает строку «сторнирована» без представительства.
5. **Поток событиями и открытый месяц — ОТКРЫТЫЙ ВОПРОС владельцу `ADR-0239` §3** (переписано
   правкой ревью 1: прежняя формулировка занижала последствие). Событие открытого месяца
   переписывается на месте, строки состояния на прошедшие даты — нет: они уже легли.
   - Воспроизведение (демо-мир, проба ревьюера `p4b4.mjs`): в конце сида июль ещё открыт.
     Сторно ПГ-2026/1141 (520 000, КД-2022/065) от 21.08, ночь 22.08 — июльская строка платежа
     07.03 переписана на месте («сторнирован»), маркера нет. Поток за июль (01.07, 01.08] по
     КД-2022/065 — 0, прирост «погашено всего» кредита 01.07 → 01.08 — 520 000.
   - Следствие: закроется июль — и закрытый отчёт о платежах июля навсегда разойдётся с
     закрытым отчётом о кредитах июля. Ровно этот случай `ADR-0239` и призван исключить. Дело не
     в «интервале внутри открытого месяца»: расходится любой прошедший месяц, пока он открыт.
   - Вопрос владельцу: «открытый месяц» судится по месяцу СТРОКИ события или по месяцу
     ИСПРАВЛЕНИЯ? Должно ли событие, чей месяц уже покрыт написанными строками состояния,
     получать поправку в месяце исправления вместо перезаписи на месте?
   - Модель в макете не меняется (решает владелец). Тождество `#272` держится для интервала,
     после конца которого ни одно его событие не переписано на месте; сообщение `#272` и
     комментарий двери `ST.eventFlow` называют это условие, а не тождество безусловно.
6. **Защита набора целиком у меры демо-миром не различима:** все пары меры ложатся одной
   датой, и запись отбивается у всех или ни у одной. Сторож `#270` ловит только счёт (`kept 1`
   на меру, мутация 12).

### З-16b, правка ревью 1

Ревью задачи подтвердило, что ночь меры идёт дисциплиной З-16a и что пробы З-16a не
изменились, но нашло два важных дефекта кода и одну находку модели. Исправлено новым
коммитом поверх `4398018`. Новых номеров нет: всё — конъюнкты `#269` и `#272`.

**1. У меры был не один представитель** (важное, частично по плану). Раньше новая пара
рождалась мимо решения меры (не обойдена, поздняя ночь, молчание), представитель считался
только по нынешним целям, а двери отдавали каждую пару, у которой когда-либо была строка.

- Воспроизведено ревьюером (`p4b.mjs`, `p4b2.mjs`, `p4b3.mjs`):
  - заёмщика добавили к `МВ-2026/31` без распоряжения — два представителя, `a-count` 6;
  - заёмщика сняли в открытом месяце — 6 на 22.08 и задним числом на 21.08;
  - заёмщика сняли у `МВ-2026/19` закрытого мая — поправка-представитель рядом с
    представителем 09.05, итого 6;
  - прогон закрытой ночи с новой целью — мера и в `same`, и в `kept`.
- Движок (`fullNight`):
  - Мера без строк рождается всеми парами, как прежде.
  - У известной меры пары решаются одним набором. Новая пара сама ставит меру на обход и
    рождается решением меры: не обойдена, поздняя ночь или молчание соседа — не рождается и
    пара.
  - Пара, родившаяся у известной меры, ложится на дату строки меры, если та в открытом
    месяце, иначе — на эту ночь. Иначе между датой строки меры и ночью у меры не было бы
    представителя.
  - Пара снятой цели — сторно по цели (схема §11.2: `d_mstate` — «признак сторно по
    цели»): строка полного состояния с `d_primary = false` и `d_mstate = 'сторнирована'`,
    тем же набором через ту же дверь. На месте в открытом месяце, поправкой с маркером в
    закрытом. Пара, уже снятая, больше не переписывается.
  - Каждая мера попадает ровно в одно решение ночи (`skip` | `kept` | `same` | запись).
    Набор с записью в `same` не идёт; отбитая запись — один `kept` на меру.
  - Настройка объекта: `pairOff: ['d-mstate', 'сторнирована']`.
- Прочтение, названное вслух. Контролёр просил, чтобы «`measureAt` не отвечал снятой
  целью после даты снятия». Макет отвечает ею иначе: строкой «сторнирована», без
  представительства. Так читает `stat_measure_at` по схеме §11 («последняя строка пары
  ≤ D»), а `d_mstate` — признак сторно по цели. Спрятать пару из двери можно было бы только
  по метке, которой в закрытой форме строки нет (десять полей, `ИС-15`, `СС-170`). До даты
  снятия цель отвечает прежним состоянием.
  - В `rm-nonprim-open` ревьюера ответ прежний, потому что `МВ-2026/31` сторнирована целиком
    и её пара `ТВ-2025/11-2` уже «сторнирована» без представительства: снимать нечего.
- Сторож `#269` (конъюнкт):
  - открытый август, мера `МВ-2026/41` живёт только внутри сторожа:
    - заёмщика добавили — пересчёт ночи 21.08 после ночи 22.08 пару не родил (`kept 1`,
      рождено 0);
    - плановая ночь 23.08 без распоряжения родила её на дату строки меры 13.08 (`skip 5`, у
      меры запись 2); поручитель снят с представительства на месте;
    - заёмщика сняли — пара `11-1` «сторнирована», не представитель;
  - закрытый май, `МВ-2026/19`:
    - заёмщика сняли — поправки обеих пар на 22.08, маркеров 2; на 21.08 заёмщик —
      «зарегистрирована, представитель», на 22.08 — «сторнирована»;
    - вернули — поправки и маркеры сняты;
  - прогон за закрытое 15.06 с новой целью на свежем сиде — `kept 1, same 2, unborn 2` (5
    мер, не 6);
  - мера закрытого мая `МВ-2026/42`, родившаяся ночью 22.08, получила заёмщика ночью 23.08 —
    пара легла на 22.08;
  - на каждой хранимой дате у каждой меры ровно один представитель; `a-count` = число
    различных мер на 21.08, 22.08, 23.08.

**2. Поток событиями не знал даты прогона и запуска** (важное, по плану).
`ST.eventFlow(repay, 01.08 → 31.08)` отвечал частичным августом на 22.08, а `2025-01-01 →
2025-12-31` — `ok` с пустым `by`. `flowBetween` и `statSlice` те же даты отбивают.

- Движок:
  - конец потока проходит `dateGate` — те же ворота, что у среза и потока итогов: даты без
    прогона отбиваются отказом с последним прогоном (`ИС-36`);
  - начало раньше запуска `01.05` отбивается, пока легаси-строк событий нет (`СС-Д25`):
    события до запуска легли на первую свою ночь (`СС-174`).
  - Прочтение: «раньше дня перед запуском» понято по срезу. Срез `01.05` видит мир на конец
    30.04, первое допустимое начало — `01.05`, первая строка интервала — `02.05`.
- Сторож `#272` (конъюнкт):
  - `(01.08, 31.08]` — отказ «прогона не было… (ИС-36)», как у `flowBetween`;
  - 2025 год — отказ;
  - начало 15.04 — отказ (`СС-Д25`);
  - с `01.05` — считается.

**3. Находка модели — открытый вопрос владельцу `ADR-0239` §3** (модель не менялась).
- Находка 5 З-16b переписана выше: июль ещё открыт, сторно ПГ-2026/1141 от 21.08 переписывает
  июльскую строку на месте. Поток за июль по КД-2022/065 — 0, прирост «погашено всего» —
  520 000, маркера нет. После закрытия июля оба закрытых отчёта расходятся навсегда.
- То же с воспроизведением и вопросом — в комментарии двери `ST.eventFlow`. Там же уточнено:
  поправка в месяце исправления — у событий ЗАКРЫТОГО месяца.
- Сообщение и комментарий `#272` называют условие тождества («для интервала, после конца
  которого ни одно его событие не переписано на месте»), а не тождество безусловно.
- Находка 4 З-16b («цель, снятая с меры») снята пунктом 1.

**TDD.**
- RED: сторожа правки на движке `4398018` (копия дерева в scratchpad) — `255/257`,
  `exit=1`, упали ровно `#269` и `#272`:
  - `#269`: дат с двумя представителями 11 и 1, `a-count` 7/6 и 6/5, закрытая ночь
    `kept 2, same 2`;
  - `#272`: 31.08, 2025 год и начало 15.04 — «считается».
- GREEN: `257/257 PASS`, `exit=0`, FAIL 0.

**Мутации** (копия дерева в scratchpad, `f1/mut.py`, одна копия на мутацию):

| # | откат | смоук | упал — чем |
|---|---|---|---|
| a | новая пара меру на обход не ставит | `256/257` | `#269` (ночь 23.08 — `skip 6`, пара не рождена) |
| b | пара снятой цели не пишется | `256/257` | `#269` (дат с двумя представителями 11 и 1, `a-count` 7/6, 6/5) |
| c | пара известной меры — на срез дня меры (закрытый — на ночь) | `256/257` | `#269` (`МВ-2026/42`: пара на 23.08, 22.08 без представителя, `a-count` 5/6) |
| d | рождение мимо поздней ночи | `256/257` | `#269` (пересчёт 21.08 — `kept 0`, рождено 1) |
| e | мера и в «без изменений», и в «не тронуто» | `256/257` | `#269` (закрытая ночь — `same 3`) — **первой батареей выжила**: сценарий шёл после поправок 22.08 и уходил в «поздняя ночь первее»; перенесён на свежий сид |
| f | снятая цель остаётся представителем | `256/257` | `#269` (две «+» на 22.08 и 23.08) |
| g | конец потока мимо ворот даты | `256/257` | `#272` (31.08 — «считается») |
| h | начало потока до запуска | `256/257` | `#272` (15.04 — «считается») |

**Пробы.**
- Пробы З-16a (копии `probe.mjs`, `probe_rr.mjs`, `rv2/gone-rc.mjs`, `rv3/samedate.mjs`;
  до — `4398018`, после — рабочее дерево): все 21 сценарий побайтно те же.
- Пробы ревьюера (копии `p4b*.mjs` в `f1/rv`):

| проба | до (`4398018`) | после |
|---|---|---|
| `rm-prim-open` | два представителя, `a-count` 6 на 22.08 и на 21.08 | представитель `11-2`, `11-1` не представитель; 5 и 5 |
| `rm-prim-closed` | поправка `03-2` представителем рядом с `03-1` 09.05 — 6 | поправки обеих пар на 22.08, `03-1` «сторнирована»; 5; маркеров 2 |
| `add-borrower-noenq` | `skip 5` и `born 1` у одной меры, два представителя, 6 | `skip 4`, мера обойдена рождением, `11-2` снят с представительства; 5 |
| `rm-nonprim-open` | дверь отдаёт `11-2` | то же — пара уже «сторнирована» без представительства (мера сторнирована целиком) |
| `later-born` | пересчёт 21.08: `kept 1` и `born 1` | `kept 1`, `born 0` |
| `p4b3` (закрытая ночь, новая цель) | `kept 1, same 3` | `kept 1, same 2` |
| `dates` | 2025 → `ok {}`; 31.08 и 31.12 → частичный август | все три — отказ «конец потока …», как у `flowBetween` и `statSlice` |
| `flow` | 01.08 → 22.08: числа при отсутствии строк кредита на 22.08 | отказ: на 22.08 прогона не было |
| `reopen-may` | перезапись на месте, маркеров 0 | то же |
| `p4b4` (июль) | поток 0 против прироста 520 000, маркеров 0 | то же — модель не менялась (пункт 3) |

**Время смоука.** 28,3–28,4 с → 28,6–28,7 с (два прогона; `257/257 PASS`, `exit=0`,
FAIL 0).

**Границы, названные вслух.**
1. Снятую цель дверь меры отдаёт строкой «сторнирована», а не прячет (см. прочтение в п. 1).
2. Возврат снятой цели меру на обход сам не ставит: пара у меры уже есть, и представитель
   остаётся единственным. Мера подхватывается, когда её назовёт очередь или опрос.
3. Двери «на дату» (`ST.eventAt`, `repayAt`, `receiptAt`, `measureAt`) остались без ворот
   даты, как `ST.rowsAsOf`: это аналоги функций `stat_*_at`, ворота — у вызывающего.
   Ворота добавлены только потоку, по пункту 2.
4. `eventFlow (01.05, 01.06]` считается, а `flowBetween` ту же базу отбивает: у итогов на
   01.05 базы нет — легаси хранит только начала кварталов, май закрыт. Поток событий базы не
   требует.

### З-16b, правка ревью 2

Повторное ревью закрыло пункты 2 и 3 правки 1 и все воспроизведённые случаи пункта 1. Но
представитель всё ещё двоился, когда последние строки пар меры лежат на разных датах; кроме
того, контролёр добавил два пункта. Исправлено новым коммитом поверх `0fe2480`. Новых номеров
нет: всё — конъюнкты `#267`, `#269`, `#270`.

**1. Смена представителя ложилась на разные даты** (важное).
- Воспроизведено ревьюером (`rv4b2/wide.mjs`, `tworep.mjs`):
  - `МВ-2026/19`: пары заёмщика и поручителя зафиксированы 09.05, пара залогодателя родилась
    22.08 в открытом августе. Ночью 26.08 сняли заёмщика. Поправки заёмщика и поручителя
    легли на 26.08, а залогодатель стал представителем НА МЕСТЕ 22.08. `a-count` на 22–25.08,
    уже отвеченные, стал 6 вместо 5.
  - `seq-add`, `rm-then-add` — два представителя на 22.08.
- Движок (`fullNight`):
  - Смена набора — родилась пара, снята цель, вернулась снятая, сменился представитель —
    ложится ОДНОЙ датой, ночью D, у каждой пары, которой касается:
    - строка пары на D переписывается на месте;
    - зафиксированная получает поправку с маркером;
    - строка открытого месяца раньше D получает новую строку на D без маркера, а прежняя
      отвечает за свои даты.
  - На строке раньше D смена набора на месте не пишется никогда: ночь не меняет ответ на
    дату раньше себя.
  - Пара, родившаяся у известной меры, ложится на D. Правка 1 клала её на дату строки меры в
    открытом месяце, чтобы у меры не было дня без представителя. Но именно это правило и
    меняло ответ на отвеченные даты; теперь дня без представителя нет, потому что прежний
    представитель теряет представительство той же ночью D.
  - Поправку, которая больше ничего не исправляет, ночь снимает по-прежнему. Строку смены
    набора — только в её же ночь: снятие позже поменяло бы ответ на прошедшие даты.
  - Изменение одних данных идёт по ADR-0239 §3, §4, как было. Представителя оно не трогает.
  - Комментарий движка говорит ровно то, что держит код. Запись меры называет
    представителя одного (`pairsOf`). Ночь, записавшая смену набора, кладёт её на D всем парам.
    На даты раньше D отвечают прежние строки. Смена, которую ночь не записала (молчание
    соседа, отбитый набор), ляжет целиком той ночью, что её запишет.
- Сторож `#269` (конъюнкт):
  - ожидания правки 1 переписаны:
    - `МВ-2026/41`: `08-13:11-2+ 08-23:11-1+ 08-23:11-2`, снятие — `08-13:11-2+ 08-23:11-1×`;
    - `МВ-2026/42`: `08-22:03-2+ 08-23:03-1+ 08-23:03-2`;
  - новый сценарий «пары на разных датах» — последовательность `wide.mjs` на свежем сиде,
    ночи плановые, без распоряжения:
    - строки `05-09:03-1+* 05-09:03-2* 08-22:03-3 08-26:03-1× 08-26:03-3+ 08-27:03-1+
      08-27:03-3`, маркеров 1;
    - представитель по датам `21:03-1 … 25:03-1 26:03-3 27:03-1`;
    - `a-count` = число различных мер (5/5) на каждую дату 21–25.08 до ночи 26.08, 21–26.08
      после неё и 21–27.08 после ночи 27.08;
    - дат с другим числом представителей, чем один, — 0 по всем хранимым датам всех мер.

**2. Работа из очереди снималась до двери** (решение контролёра; давний дефект того же
кода).
- Воспроизведено (`rv4b2/deqlost.mjs`):
  - распоряжение по `МВ-2026/19`;
  - прогон за закрытое 15.06 отбит (`kept 1`), а распоряжение уже снято «обойдён прогоном»;
  - ночь 22.08 — `skip 5`, изменение потеряно навсегда.
  
  У `deltaNight` было то же самое.
- Движок: одна функция `dequeueSeen` у обоих способов событий. Работа снимается только
  тогда, когда набор прошёл дверь или писать нечего:
  - `fullNight`: после записи набора (при отбитой записи — нет) и в «без изменений»;
  - `deltaNight`: в «без изменений», после легшей перезаписи на месте, при пустом наборе
    поправок, после двери набора поправок.

  Отбитый набор оставляет работу открытой. Поздняя ночь и молчание соседа её, как прежде,
  не снимают.
- Сторож `#270` (конъюнкт, мера): распоряжение ставится ДО прогона за закрытое 15.06.
  - После отбитого прогона оно открыто (1).
  - Ночь 22.08 без второго распоряжения кладёт поправку обеих пар и снимает его датой 22.08.
- Сторож `#267` (конъюнкт, дельта): `ПГ-2026/1102` перепривязан задним числом с 10.06,
  распоряжение поставлено.
  - Прогон за закрытое 15.06: `kept 1`, записано 0, распоряжение открыто (1).
  - Ночь 22.08 без второго распоряжения кладёт сторно и перепривязку на 22.08
    (`КД-2025/088:28000`) и снимает распоряжение датой 22.08.

**3. Смена набора ставит меру на обход сама** (решение контролёра на выбор; выбрано
расширение).
- Раньше сама меру на обход ставила только новая пара. Снятие цели и возврат снятой без
  распоряжения ночь не видела:
  - `rm-noenq`: `skip 5`, ничего не записано;
  - `readd-noenq`: три ночи `skip`.
- Теперь меру называет любая смена набора. Ночь сравнивает запись меры с последними
  строками пар на D; сравнение дешёвое, только по строкам самой меры:
  - рождение пары;
  - снятие живой цели;
  - возврат снятой: строка пары «сторнирована» без представительства, а по записи пара живая;
  - смена представителя.
- Сторож `#269` (конъюнкт): новый сценарий «каждая смена по отдельности», `МВ-2026/19`,
  плановые ночи без распоряжения:
  - 22.08 — снят поручитель: только снятие;
  - 23.08 — поручитель вернулся: только возврат;
  - 24.08 — цели «поручитель, залогодатель»;
  - 25.08 — цели переставлены: только смена представителя.

  Результат:
  - записано `1 · 1 · 3 · 2`, «не обойдено» каждую ночь 4;
  - строки `05-09:03-1+* 05-09:03-2* 08-22:03-2× 08-23:03-2 08-24:03-1× 08-24:03-2+
    08-24:03-3 08-25:03-2 08-25:03-3+`;
  - представитель `21:03-1 22:03-1 23:03-1 24:03-2 25:03-3`;
  - число мер 5/5 на каждую дату.
- Граница 2 правки 1 («возврат снятой цели меру на обход сам не ставит») снята.

**4. Объект без `pairOff`** (мелкое).
- Разбор `const [offDim, offVal] = o.pairOff` падал `TypeError` у объекта `event_full`
  без `pairOff`.
- Теперь `off = o.pairOff || null`. У такого объекта снятая цель только теряет
  представительство, если держала его (строка `primary = false` без признака сторно), —
  иначе на дату было бы два представителя.
- Такого объекта в реестре нет, и смоук его не видит. Проверено пробой `f2/nopairoff.mjs`:
  мера без `pairOff`, снят заёмщик.
  - До: `TypeError`.
  - После: `n 2`, на 22.08 `03-2` — представитель, `03-1` — без представительства.

**TDD.**
- RED: сторожа правки на движке `0fe2480` (копия дерева в scratchpad) — `254/257`,
  `exit=1`, упали ровно `#267`, `#269`, `#270`:
  - `#267`: распоряжение после прогона за 15.06 уже снято, открыто 0; ночь 22.08 ничего не
    положила;
  - `#269`:
    - `МВ-2026/41` и `МВ-2026/42` — прежние строки на месте;
    - «пары на разных датах» — ночи 26.08 и 27.08 `skip 5`;
    - «по отдельности» — записано `0 · 0 · 3 · 0`;
  - `#270`: распоряжение снято 15.06, открыто 0.
- Пункт 1 отдельно от пункта 3 показывает мутация 1a: смена набора снова пишется на месте,
  и `a-count` на 22–25.08 после ночи 26.08 становится 6/5 — ровно случай ревьюера.
- GREEN: `257/257 PASS`, `exit=0`, FAIL 0.

**Мутации** (копия дерева в scratchpad, `f2/mut.py`, одна копия на мутацию; все убиты):

| # | откат | смоук | упал — чем |
|---|---|---|---|
| 1a | смена набора на месте на строке раньше D | `256/257` | `#269`: после ночи 26.08 `a-count` 6/5 на 22–25.08; «по отдельности» — возврат 23.08 не записан |
| 1b | пара известной меры — на дату последней строки меры (закрытая — на ночь) | `256/257` | `#269`: залогодатель родился на 23.08 вместо 24.08 |
| 1c | строку смены набора снимает и поздняя ночь | `256/257` | `#269`: на 26.08 два представителя (`03-1+03-3`), `a-count` 6/5; 24.08 без представителя |
| 2a | `fullNight`: работа снимается до двери | `256/257` | `#270`: распоряжение снято 15.06, открыто 0 |
| 2b | `deltaNight`: работа снимается до двери | `256/257` | `#267`: распоряжение снято 15.06, ночь 22.08 ничего не положила |
| 3a | меру сама называет только новая пара | `256/257` | `#269`: ночи 26.08 и 27.08 `skip 5`; «по отдельности» — `0 · 0 · 3 · 0` |
| 3b | снятие цели меру не называет | `256/257` | `#269`: «по отдельности» — 22.08 `skip 5` |
| 3c | возврат снятой меру не называет | `256/257` | `#269`: «по отдельности» — 23.08 `skip 5` |
| 3d | смена представителя меру не называет | `256/257` | `#269`: «по отдельности» — 25.08 `skip 5`, представитель 25.08 `03-2` |

3b, 3c и 3d первой батареей выжили: в сценарии «пары на разных датах» каждая смена шла вместе
с другой (снятие заёмщика — со сменой представителя). Поэтому добавлен сценарий «по
отдельности», и второй батареей они убиты.

**Пробы.**
- Пробы З-16a (копии `probe.mjs`, `probe_rr.mjs`, `rv2/gone-rc.mjs`, `rv3/samedate.mjs`;
  до — `0fe2480`, после — рабочее дерево): все 21 сценарий побайтно те же.
- Пробы ревьюера (копии `rv4b/p4b*.mjs` и `rv4b2/*.mjs` в `f1/rv`, `f2/rv`):

| проба | до (`0fe2480`) | после |
|---|---|---|
| `wide`, `wide rm` | после ночи заёмщика `a-count` на 22–25.08 — 6 | 5 на каждую дату; смена представителя — строками 26.08 |
| `tworep seq-add` | на 22.08 два представителя, `a-count` 6 | один (`03-2`), 5; заёмщик и поручитель — строками 23.08 |
| `tworep rm-then-add` | на 22.08 два представителя, 6 | один (`03-1`), 5; новая цель — на 23.08 |
| `tworep rm-noenq` | `skip 5`, ничего не записано | `n 2`: `03-2` представитель, `03-1` «сторнирована» на 22.08 |
| `tworep readd-noenq` | три ночи `skip`, представитель `03-2` | ночь 23.08 `n 2`, представитель `03-1` с 23.08 |
| `deqlost measure` | распоряжение снято 15.06, ночь 22.08 `skip 5` | распоряжение открыто; ночь 22.08 `n 2` — «исполнено частично» у обеих пар |
| `rm-prim-open` | смена представителя на месте 10.08: на 21.08 отвечает `11-2` | строки 22.08; на 21.08 — `11-1`, на 22.08 — `11-2` |
| `add-borrower-noenq` | заёмщик рождён на 10.08, поручитель снят на месте | обе строки на 22.08 |
| `rm-nonprim-open`, `rm-prim-closed`, `flow`, `dates`, `later-born`, `reopen-may`, `p4b3`, `p4b4` | — | побайтно те же |

**Время смоука.** 28,6–28,7 с → 29,1–29,3 с (два прогона; `257/257 PASS`, `exit=0`,
FAIL 0).

**Границы, названные вслух.**
1. ~~Снятие сторно целой меры о нескольких целях ложится на D, а не на месте: сторнированная
   пара без представительства читается как снятая цель, и возврат её в живую — смена
   набора.~~ Снято правкой ревью 3 (п. B): сторно всей меры и его снятие — поправка
   состояния; мера о нескольких целях хранит его так же, как мера об одной.
2. ~~Пересчёт ночи раньше, который на свою дату изменения не видит (история датирована
   позже), работу из очереди снимает как «без изменений». Изменение подхватит ближайшая
   ночь, если его назовёт очередь или опрос.~~ Утверждение было неверно: снятую работу
   очередь больше не называет, а своим окном ближайшая ночь изменения задним числом не видит
   — изменение терялось навсегда (ревью 3, `rv4b3/rerun.mjs`, `rerun-rc.mjs`). Исправлено
   правкой ревью 3 (п. A): работу снимает ночь не раньше даты записи.
3. Прочтение правки 1 в силе: `measureAt` отвечает снятой целью строкой «сторнирована».
4. Двери «на дату» остались без ворот даты (граница 3 правки 1).
5. Находка 5 — открытый вопрос владельцу ADR-0239 §3 — в силе, модель не менялась.

### З-16b, правка ревью 3

Повторное ревью закрыло пункты 1, 3 и 4 правки 2; фазз из 146 прогонов нарушений не нашёл.
Открытыми остались половина пункта 2 (пересчёт) и новый мелкий пункт; кроме того, граница 2
правки 2 была неверна. Исправлено новым коммитом поверх `825ac5c`. Новых номеров нет — конъюнкты
`#206`, `#267`, `#269`, `#270`.

**A. Пересчёт ночи раньше распоряжения снимал его — изменение терялось** (важное).
- Воспроизведено ревьюером:
  - `rv4b3/rerun.mjs`, мера:
    - ночь 22.08 прошла; `МВ-2026/19` сторнирована задним числом с 20.08, распоряжение;
    - пересчёт ночи 15.08 — `same 5`, распоряжение закрыто «2026-08-15 обойдён прогоном»;
    - ночь 23.08 — `skip 5`, мера на 23.08 «зарегистрирована».
  - `rerun-rc.mjs` — то же у `ПП-2026/0611` («отозвано» с 20.08).
  - Без пересчёта ночь 23.08 изменение пишет.
- Путь состояний `doRun` уязвим так же. Проверено пробой `f3/rerun-prog.mjs`: программа
  `БК-2021` открыта вновь задним числом с 20.08, распоряжение, пересчёт 15.08. Ночь 23.08 дала
  программе копию вчерашней строки «закрыта»; без пересчёта — «действует». Там работа
  снималась даже до записи строки.
- Движок: одно правило во всех местах, где снимается работа, — `dequeueSeen`. Функция
  теперь общая для обоих способов событий и для состояний (путь состояний звал `deq` сам).
  - Условие 1, как в правке 2: ночь запись обошла, и набор лёг либо писать нечего.
  - Условие 2, новое: ночь не раньше даты записи, `q.at ≤ D`.
- Почему сравнение с `D`, а не с `worldAt(D)`.
  - `q.at` — первая ночь, которая отвечает на запись:
    - день постановки распоряжения (`ST.enqueue` ставит `st.today`);
    - начало записи реестра (`queueRegChange`);
    - ночь, в которую сосед молчал.
  - Очередь даты самого изменения не несёт. Изменение, датированное задним числом, — ради
    него очередь и заведена — в мир ночи `q.at` входит.
  - Изменение, датированное днём постановки, в этот мир ещё не входит. Но очередь ему не
    нужна: его находит следующая ночь своим окном.
    - Проверено пробой `f3/sameday.mjs` на мере, поступлении и программе: изменение от
      22.08, распоряжение 22.08, пересчёт ночи 22.08 работу снимает.
    - Ночь 23.08 пишет изменение сама: `n 2` / `n 1` / `n 1`.
  - Строгое `q.at ≤ worldAt(D)` ломает прежний договор. Пересчёт ночи того же дня, для
    которого распоряжение и ставят, писал бы изменение, а работу оставлял открытой.
    Справочная мутация S это показывает: смоук падает на `#206`, закрытая запись `null`.
- Сторожа:
  - `#270`, мера: сторно задним числом с 20.08, распоряжение 22.08, пересчёт ночи 15.08.
    - Пересчёт: `same 5`, распоряжение открыто.
    - Ночь 23.08: `n 2`, строки 23.08 обеих пар «сторнирована», распоряжение снято датой
      23.08.
  - `#267`, событие-дельта: отзыв сопоставления `ПП-2026/0611` с 20.08.
    - Пересчёт ночи 15.08: без изменений 14, распоряжение открыто.
    - Ночь 23.08: строка `08-23:match`, действующее «отозвано», распоряжение снято 23.08.
  - `#206`, состояние: `БК-2021` открыта вновь с 20.08.
    - Пересчёт ночи 15.08 распоряжение оставил открытым.
    - Строка 22.08 «закрыта», 23.08 «действует», снято 23.08.
    - Значения прежних конъюнктов `#206` (открытых записей 0, всех 1) сняты до нового
      сценария. Иначе `ok()` читал бы очередь нового сида.
  - Сторожа двери из правки 2 (`#267`, `#270`) переписаны: распоряжение датировано 10.06,
    пока июнь был открыт. Поставленное 22.08, прогон за 15.06 не снял бы его и по дате, и
    дверь осталась бы непроверенной. Мутации 2a/2b после этого снова убиты.
- Граница 2 правки 2 была неверна: снятую работу очередь больше не называет, а своим
  окном ночь изменения задним числом не видит. Она зачёркнута выше, с отсылкой сюда.

**B. Снятие сторно всей меры читалось сменой набора** (мелкое, новое).
- Сторнированная пара без представительства проходит `isOff` так же, как снятая цель.
  Поэтому снятие сторно у `МВ-2026/31` (две цели, открытый август) ложилось на D. Мера об
  одной цели с той же историей переписывалась на месте (ADR-0239 §3). Проба
  `rv4b3/unstorno.mjs`.
- Движок: возврат снятой пары (`back`) засчитывается, только если на дату строки пары
  представитель жив (`wholeOff`). Снятая цель — это пара «сторнирована» при живой мере. У
  сторнированной целиком сторнирован и представитель. Комментарий о смене набора дополнен:
  сторно всей меры и его снятие — поправка состояния, представителя они не трогают.
- Сторож `#269`, сценарий «снятие сторно»:
  - `МВ-2026/31` и её клон `МВ-2026/51` об одной цели. Клон рождается ночью 22.08 уже
    сторнированным на срез 10.08 — строка та же, что у меры из сида. Свой сид клону не
    нужен: с ним смоук шёл 36 с вместо 30.
  - До снятия: `08-10:11-1+ сторнирована | 08-10:11-1+ 08-10:11-2 сторнирована`.
  - После снятия с 22.08:
    - строки `08-10:11-1+ 08-10:11-2` и `08-10:11-1+`;
    - записано 3, из них на месте 3, все строки «зарегистрирована»;
    - ответ на 15.08, 22.08 и 23.08 у обеих — «зарегистрирована».

**TDD.**
- RED: сторожа правки на движке `825ac5c` (копия дерева) — `253/257`, `exit=1`, упали
  ровно `#206`, `#267`, `#269`, `#270`:
  - `#206`, `#267`, `#270`: после пересчёта 15.08 открыто 0, ночь 23.08 не записала ничего;
  - `#269`: у меры о двух целях строки на 23.08, на месте 1 из 3.
- GREEN: `257/257 PASS`, `exit=0`, FAIL 0.

**Мутации** (копия дерева, `f3/mut.py`; все убиты):

| # | откат | смоук | упал — чем |
|---|---|---|---|
| A1 | `dequeueSeen` без даты | `254/257` | `#206`, `#267`, `#270`: после пересчёта 15.08 открыто 0 |
| A2 | путь состояний снимает работу сам, без даты | `256/257` | `#206` |
| A3 | «без изменений» меры снимает работу без даты | `256/257` | `#270` |
| A4 | «без изменений» дельты снимает работу без даты | `256/257` | `#267` |
| 2a | `fullNight`: работа снимается до двери | `256/257` | `#270`: распоряжение 10.06 снято прогоном 15.06 |
| 2b | `deltaNight`: работа снимается до двери | `256/257` | `#267`: то же |
| B1 | снятие сторно всей меры — смена набора | `256/257` | `#269`: строки на 23.08, на месте 1 из 3 |
| S | справочно: строгое `q.at ≤ worldAt(D)` | падение | `#206`: распоряжение дня, пересчёт того же дня — закрытая запись `null` |

**Пробы.**
- Пробы З-16a (21 сценарий; до — `825ac5c`, после — рабочее дерево): побайтно те же.
- Пробы ревьюера `rv4b/*` и `rv4b2/*` (17 сценариев): побайтно те же.
- Пробы `rv4b3` и свои:

| проба | до (`825ac5c`) | после |
|---|---|---|
| `rerun measure` | пересчёт 15.08 снял распоряжение; ночь 23.08 `skip 5`, «зарегистрирована» | распоряжение открыто; ночь 23.08 `n 2`, «сторнирована», снято 23.08 |
| `rerun repay` | сторно на 15.08; распоряжение снято 15.08 | сторно на 15.08 то же; распоряжение снято ночью 23.08 |
| `rerun-rc` | снято 15.08; ночь 23.08 `skip 15`, «подтверждено» | открыто; ночь 23.08 `n 1`, «отозвано» |
| `unstorno` | мера о двух целях — строки на 23.08; на 15.08 и 22.08 «сторнирована» | на месте 10.08, как у клона; на 15.08, 22.08, 23.08 «зарегистрирована» |
| `f3/rerun-prog` (состояние) | строка 23.08 «закрыта» | «действует», снято 23.08 |
| `rerun measure-ctrl`, `rerun-rc ctrl`, `rerun-prog ctrl`, `sameday`, `rerun-set` | — | побайтно те же |

В `rerun repay` сторно на 15.08 и до, и после: состояние платежа — поле `f.pstate` без даты
(`d-paystate`, `src: 'поле'`), и его видит пересчёт любой ночи. Это тот же класс, что
отложенный `rerun-set`.

**Время смоука.** 29,1–29,3 с → 29,7–29,9 с (четыре прогона; `257/257 PASS`, `exit=0`,
FAIL 0).

**Отложено по решению контролёра, кода нет.**
- Цели меры — поле мира без даты. Пересчёт ночи раньше видит нынешние цели и кладёт смену
  набора на свою дату (`rv4b3/rerun-set.mjs`). То же у всех недатированных полей.
- Первое рождение записи не снимает поставленную на неё работу.

**Границы.**
1. Изменение, датированное днём постановки распоряжения, снимается пересчётом ночи того же
   дня, хотя тот его не видит. Его пишет следующая ночь своим окном (`f3/sameday.mjs`), не
   очередь.
2. Путь состояний снимает работу, как и прежде, при обходе, до записи строки: отбитая
   строка закрытого периода работу снимает. Ворота правки 2 касались только событий. Теперь
   это возможно лишь для записи, датированной не позже закрытой ночи, — например, записи
   реестра, заведённой задним числом в закрытый месяц (`queueRegChange`). Путь состояний на
   такую потерю не проверялся.
3. Прочтение `measureAt`, двери «на дату» без ворот, находка 5 — как в правке 2.

### З-22b — очередь: одна открытая задача на запись, неполные строки вместо дозаполнения, журнал перезаписи (`ADR-0245` §4; `СС-204`…`СС-207`)

**Коммит.** «Статистика: волна 23 З-22b — одна задача на запись, неполные строки вместо
дозаполнения, журнал перезаписи». Смоук `278/278 PASS`, `exit=0`, 109 с.

**Время смоука.** На этой машине смоук и на `01d335a` идёт 110 с (`276/276`), а не 30 с, как
записано в брифе: замер HEAD на копии дерева — 109,6 с. З-22b времени не прибавила (109,3 с).

**Переписаны на своём номере.**
- `#206` — поводов два; `c206.n` = 31 прежнее (неполных строк вчерашней ночи в сценарии нет).
- `#207` — целиком по брифу: неполная строка зовёт запись в ночь 23.08 сама, задач нет.
- `#198` — выборка «очереди дозаполнения» — по строкам (`ST.isPartial`); утверждения прежние.
- `#260` — молчание «кураторства» задач теперь не ставит вовсе, и выборка по `why` обнулилась.
  Смысл сохранён так: выполненное задание дня — досчёт 20.07, поставленный руками и снятый ночью
  20.07; невыполненное — распоряжение, поставленное 31.07 после последней ночи июля, закрытие
  переносит его на 02.08. Очередь неполных — по строкам: неполных строк состояний месяца 12,
  после закрытия 0.
- `#245`, `#267`, `#272` не сдвинулись: слияние задач их чисел не тронуло.

**Отклонения от брифа.**
- `#298`: брифовая проба ставила «БК-2021» в «закрыта» с 21.08, а программа к 22.08 уже
  «закрыта» (`#206`) — пересчёт ничего не менял, журнал пуст. Проба ставит «действует».
- Комментарий над `queueRegChange` о ключе очереди («объект + запись + повод») обновлён: ключ
  открытой задачи — «объект + запись».

**Мутация** (копия дерева). `enq` ищет открытую задачу того же повода — `277/278`, упал ровно
`#297`: открытых задач у «БК-2021» две.

### З-22c — сосед отвечает ключом и датой действия: `retro` с этой даты (`ADR-0245` §3; `СС-208`)

**Коммит.** «Статистика: волна 23 З-22c — ответ соседа ключом и датой действия, retro с этой
даты». Смоук `279/279 PASS`, `exit=0`, 110 с.

**Сделано по брифу, без отклонений.** `st.nbFeed`, `takeFeed`, `onlyScan`, `retroPass`, выбор
состава по `how.only` в `doRun`, двери `ST.nbChanged` и `ST.nbFeed`; `ST.run` отвечает `fed` и
`retro`. Сторож `#299` — как в брифе, числа совпали с первого прогона.

**Переписанных сторожей нет.** Без ответа соседа `takeFeed` и `retroPass` пусты.

**Время.** Риск 2 не сработал: ночь 23.08 в `#299` с 52 retro-прогонами (с 02.07 по 22.08) идёт
0,26 с на пробе, смоук — прежние 110 с.

**Мутация** (копия дерева). `takeFeed` забирает ответ молчавшего соседа — `278/279`, упал ровно
`#299`: ответы забрала ночь молчания, ждущих 0 вместо 2.

**Находки.**
- Журнал перезаписи называет перезапись ночного прогона причиной `retro` (`RUN_REASON`
  `плановый → retro`, как в брифе): у `ADR-0245` §4 своей причины для ночи нет. Причина
  «retro» поэтому не отличает retro-прогон от ночи. Кода не менял.
- Дозаполнение неполной строки retro-прогоном идёт в журнал как `backfill`, а не `retro`
  (строка 22.08 «КД-2024/117» после ночи молчания «кураторства»): так и задумано `СС-207`.

### З-22d — счётчики прогона по способу хранения, сверка в конце, `failed` не публикуется (`ADR-0245` §2; `СС-209`)

**Коммит.** «Статистика: волна 23 З-22d — счётчики прогона по способу хранения, сверка, failed
не публикуется». Смоук `280/280 PASS`, `exit=0`, 110 с.

**Сделано по брифу.** `newTally`/`partOf` — `store`, `copied` только у состояний, `new_rows` и
`corr_rows` только у событий, `markers` у всех; поправки и маркеры считают `deltaNight` и
`fullNight`; `reconcileRun` в конце `doRun`, дверь `ST.reconcileRun`; `ST.run` отвечает
`status` и `failed`, `ok` — «не failed»; `dateGate` не публикует дату `failed`-прогона.

**Риск 3 проверен.** `dateGate` стоит на пути `ST.statSlice` (`checkQuery` → `dateGate`).
Ложных `failed` нет: копия смоука с журналом каждой несошедшейся сверки за весь прогон
(все блоки, демо-мир сида) дала ровно одну — нарочную потерю строки в `#300`. Формулу сверки
не менял.

**Переписанных сторожей нет.** Сторожей, читавших `copied` событий как `0`, смоук не нашёл.

**Отклонение от брифа.** `#300` читал `rec300.status` после `ST.reconcileRun()`, а сверка заново
пишет статус в ту же запись журнала — сторож видел `failed` вместо `done` чистой ночи. Статус
снимается сразу после прогона (`recSt300`).

**Мутация** (копия дерева). Сверка всегда сходится — `279/280`, упал ровно `#300`: сверка
«done» при потерянной строке.

### З-23a — маркер состояния только при настоящем отличии, закрытие `converged` · `reopen` (`ADR-0245` §5; `СС-210`)

**Коммит.** «Статистика: волна 23 З-23a — маркер состояния только при отличии, converged и
reopen». Смоук `281/281 PASS`, `exit=0`, 112 с.

**Сделано по брифу, без отклонений.** `markStates`, `closeStateMarkers`; `takeFeed` ставит маркеры
ответу с датой в закрытом месяце; `ST.run` передаёт их ночи (`how.marks`), `doRun` прибавляет к
счётчику `markers` частей; `ST.reopenPeriod` закрывает открытые маркеры месяца `reopen` и пишет
их число (`reopened`) в строку перезакрытия. `#301` — как в брифе, числа совпали с первого
прогона: маркер на 01.07 (`d-curator`), у «КД-2023/210» маркеров 0, счётчик ночи 1; повторная
находка 23.08 обновила запись; 24.08 — `converged`; перезакрытие июня — `reopen`.

**Переписанных сторожей нет.**

**Мутация** (копия дерева). Маркер без отличия — `280/281`, упал ровно `#301`: у «КД-2023/210»
маркер есть, счётчик ночи 2.

**Находка.** Прогон «повторное открытие» после перезакрытия июня пересчитывает итог 01.07, но
маркер закрывается `reopen` сразу, дверью, а не по итогу пересчёта: сошёлся ли пересчёт с
соседом, маркер уже не скажет. Так велит `ADR-0245` §5 («период открыли»); кода не менял.

### З-23b — выгрузка: файл живёт N дней, задание — всегда, статус `expired` (`ADR-0245` §11; `СС-211`)

**Коммит.** «Статистика: волна 23 З-23b — выгрузка expired: файл уходит, задание остаётся».
Смоук `282/282 PASS`, `exit=0`, 111 с.

**Сделано по брифу.** `EXPORT_STATES`, `EXPORT_KEEP_DAYS = 30`, `expireExports`; двери
`ST.exportRun`, `ST.expireExports`, `ST.exportStates`; ночной прогон просрочивает файлы перед
`calendarGap`. Сторожа выгрузок (`ST.exportJob` в смоуке) не сдвинулись.

**Переписанных сторожей нет.**

**Отклонение от брифа.** Вторая половина `#302` удаляла строки программы прямо из
`st.rows` и ждала от `ST.exportRun` ошибки. Ошибки не было: даты выгрузки знает журнал
прогонов (`askDates`), и `dateGate` пропускает дату, у которой строк не осталось, — выгрузка
ответила пустым файлом. `ADR-0245` §11 называет другой случай: дату к выполнению удалило
закрытие месяца. Сторож моделирует его: задание на 15.07 оформлено, июль закрыт (учёт,
классификация, статистика), выполнение — «ошибка» с причиной «не хранится» от `dateGate`.
Движок не менял: строки иначе, чем закрытием, не пропадают.

**Мутация** (копия дерева). Просрочка не удаляет файл — `281/282`, упал ровно `#302`: у
просроченного задания файл остался.

### З-23c — десять слотов классификаторов администратора (`ADR-0241` §5, `ADR-0245` §1; `СС-212`)

**Коммит.** «Статистика: волна 23 З-23c — десять слотов классификаторов, слот навсегда».
Смоук `283/283 PASS`, `exit=0`, 112 с.

**Сделано по брифу, без отклонений.** `st.clsSlots`; `CLS_OBJECTS`, `CLS_SLOTS`, `CLS_WARN`,
`clsSlotCols`; двери `ST.clsSlotCols`, `ST.clsSlots`, `ST.takeSlot`, `ST.releaseSlot`. `#303` —
как в брифе, числа совпали с первого прогона. Бриф сверен с `ADR-0241` §5 и `ADR-0245` §1 —
расхождений нет.

**Переписанных сторожей нет.**

**Мутация** (копия дерева). Освобождённый слот переиспользуется — `282/283`, упал ровно `#303`:
одиннадцатый классификатор занял слот.

**Находка.** Номер слота — `mine.length + 1`. Это верно, пока слоты не освобождаются, и при
мутации одиннадцатый получил номер 10 второй раз. Уникальность (`object`, `slot`) из
`ADR-0245` §1 дверь отдельно не проверяет: её держит правило «слот навсегда».
