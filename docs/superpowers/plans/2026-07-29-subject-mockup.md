# Макет модуля «Субъекты» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** собрать самодостаточный HTML-макет реестра и карточки субъекта (физлицо · ИП · организация · групповой заёмщик) по спеке `docs/superpowers/specs/2026-07-29-subject-mockup-design.md`, схлопнуть дублирующий вид субъекта в макете заёмщика и завести дефекты стенда в трекеры.

**Architecture:** один файл `mockups/subject/subject.html` — vanilla JS без сборки и сети: токены и шелл копируются из `mockups/borrower/borrower.html`, состояние живёт в массивах-фактах, всё выводимое (тип лица, роли, стоп-факторы, дубли) считается функциями и нигде не хранится (ADR-0001). Проверка — jsdom-смоук `scripts/inspect/subject-check.mjs` по образцу `scripts/inspect/borrower-check.mjs`: тесты пишутся до кода и накапливаются в одном файле от задачи к задаче.

**Tech Stack:** HTML + CSS custom properties (gen-2 токены ASUBK) + vanilla ES2020; тесты — Node 20+, `jsdom` (уже в devDependencies), запуск `node scripts/inspect/subject-check.mjs`.

## Global Constraints

- **Файл открывается с диска.** Ни сети, ни сборки, ни внешних ссылок: `mockups/subject/subject.html` работает по `file://`. Шрифты — системные, иконки — юникод/инлайн-SVG.
- **Язык интерфейса — русский.** Термины строго по `CONTEXT.md`: ключ субъекта · тип лица · регистрация ИП · групповой заёмщик · группа совместного риска (ГЗПМ) · связь лиц · слияние субъектов · псевдоним ключа.
- **Производное не хранится** (ADR-0001). Запрещённые поля в фактах: `personKind`, `roles`, `stopFactors`, `isIP`, `duplicates`.
- **Чужое не пишется** (ADR-0014). Массивы-зеркала `CREDITS` / `PLEDGE_OBJ` / `SURETIES` / `PROCS` — read-only; ни одна функция макета их не мутирует, слияние в том числе.
- **Дата демо зафиксирована:** `const TODAY = '13.07.2026';` — та же, что в `borrower.html`, потому что зеркала копируются оттуда и при другой дате разошлись бы.
- **Формат дат в данных и UI** — `ДД.ММ.ГГГГ`; в маршруте — `?on=ГГГГ-ММ-ДД`.
- **Токены** — только `--asubk-*` / `--action-*` / `--status-*` из `borrower.html`; своих цветов не заводить.
- **Каждое решение СБ-N, на которое опирается код, называется комментарием в коде** — по образцу `borrower.html` (`/* КЗ-4: … */`).
- **Смоук зелёный на каждом коммите:** `node scripts/inspect/subject-check.mjs` → 0 FAIL.
- **Нумерация в трекерах:** дефекты стенда — `P4-06…P4-12` (фаза 4 «Заёмщики», занято по `P4-05`); рекомендации — `P4-R26…P4-R28` (счётчик `P4-R*` общий, занято по `P4-R25`). Дефекты **макета** (если найдутся) — `Б-*` в `mockups/subject/ASUBK-status-razrabotki.md`, в `qa-findings.md` не идут.

## File Structure

| Файл | Ответственность |
|---|---|
| `mockups/subject/subject.html` | весь макет: токены, шелл, данные, производные функции, реестр, карточка, слияние |
| `scripts/inspect/subject-check.mjs` | jsdom-смоук макета; растёт по задачам |
| `mockups/subject/ASUBK-subekt-logika.md` | тонкая спека — только невосстановимое из кода знание (СП-21) |
| `mockups/subject/ASUBK-status-razrabotki.md` | журнал: статус СБ-1…СБ-14, дефекты макета, открытые вопросы |
| `mockups/borrower/borrower.html` | правка СБ-14: `view-subject` схлопывается до строки-зеркала |
| `scripts/inspect/borrower-check.mjs` | правка тестов под схлопнутый вид |
| `notes/qa-findings.md` | дефекты стенда `P4-06…P4-12` |
| `TODO.md` | рекомендации `P4-R26…P4-R28` (правка Claude Code → хук синка в Google Sheet срабатывает сам) |
| `package.json` | скрипт `test:subject` |

Внутри `subject.html` порядок блоков фиксирован и совпадает с `borrower.html`: `<style>` (токены → шелл → компоненты) → разметка шелла и трёх видов → `<script>`: константы дат → **факты** → **зеркала** → **производные функции** → рендер реестра → рендер карточки → рендер слияния → роутер и обвязка.

---

## Task 1: Каркас файла, шелл, роутер и смоук-харнесс

**Files:**
- Create: `mockups/subject/subject.html`
- Create: `scripts/inspect/subject-check.mjs`
- Modify: `package.json` (секция `scripts`)

**Interfaces:**
- Consumes: токены и разметка шелла из `mockups/borrower/borrower.html` (`<style>` с `--asubk-*`, сайдбар 279px, топбар, `.view`/`.view.active`).
- Produces: `TODAY`, `VIEW_DATE`, `subject(ref)`, `subjectRef(s)`, `dnum/toISO/fromISO/esc`, `hashParams(q)`, `route()`, `showList()`, `showCard(ref, onDate, tab)`, `showMerge(a, b)`, пустые массивы `SUBJECTS`, `IP_REG`, `SUBJECT_EVENTS`, `LINKS`, `UNITS`, `BANK_REQ`, `DOCS`.

- [ ] **Step 1: Написать падающий смоук**

Создать `scripts/inspect/subject-check.mjs` (харнесс — копия `scripts/inspect/borrower-check.mjs`, строки 1–22):

```js
// Смоук-проверка макета субъекта (mockups/subject/subject.html) на jsdom.
// Спецификация: docs/superpowers/specs/2026-07-29-subject-mockup-design.md.
// Запуск: node scripts/inspect/subject-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML = readFileSync(resolve('mockups/subject/subject.html'), 'utf8');

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

// ── Каркас (Task 1) ──
ok('0.1 страница загрузилась без ошибок jsdom', g.errs.length === 0);
ok('0.2 TODAY зафиксирован на 13.07.2026', g.ev("TODAY") === '13.07.2026');
ok('0.3 три вида в разметке', !!g.$('#view-list') && !!g.$('#view-card') && !!g.$('#view-merge'));
ok('0.4 пустой hash → активен реестр',
  (() => { g.ev("location.hash=''"); g.ev("route()"); return g.$('#view-list').classList.contains('active'); })());
ok('0.5 неизвестный ключ в маршруте не бросает и падает в реестр',
  (() => { g.ev("location.hash='#/s/00000000000000'"); g.ev("route()");
           return g.errs.length === 0 && g.$('#view-list').classList.contains('active'); })());
ok('0.6 даты: dnum сравнивает, toISO/fromISO обратимы',
  g.ev("dnum('01.01.2026') < dnum('02.01.2026')") &&
  g.ev("fromISO(toISO('14.05.2026'))") === '14.05.2026');
ok('0.7 esc экранирует разметку', g.ev("esc('<b>&\"')") === '&lt;b&gt;&amp;&quot;');

console.log(`\n${n - fails} / ${n} PASS`);
process.exit(fails ? 1 : 0);
```

- [ ] **Step 2: Убедиться, что смоук падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL — `ENOENT ... mockups/subject/subject.html`.

- [ ] **Step 3: Собрать каркас `subject.html`**

Создать `mockups/subject/subject.html`. Порядок работы:

1. Скопировать из `mockups/borrower/borrower.html` целиком блок `<style>` (токены `--asubk-*`, `--action-*`, `--status-*`, классы `.app`, `.sidebar`, `.topbar`, `.view`, `.content`, `.section`, `.grid`, `.btn`, `.badge`, `.chip`, `.muted`, `.lnk`, `.modal*`). Ничего не переименовывать.
2. Шапка файла — комментарий по образцу `borrower.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Субъекты — реестр лиц — АСУБК</title>
<!-- ASUBK · Субъекты — реестр лиц, к которым модули привязывают роли
     Спека: docs/superpowers/specs/2026-07-29-subject-mockup-design.md
            mockups/subject/ASUBK-subekt-logika.md — почему модель такая (СП-21)
     Решения: СБ-1…СБ-14 — mockups/subject/ASUBK-status-razrabotki.md
     ADR: 0001 производное не хранится · 0014 чужое зеркалим, не пишем ·
          0018 тип лица — правоспособность на дату · 0019 ключ субъекта и псевдоним
     Проверка: node scripts/inspect/subject-check.mjs
     Инварианты 1–10 — раздел 6 спеки, каждый закрыт тестом смоука. -->
```

3. Разметка: сайдбар и топбар — копия из `borrower.html` (пункт меню «Субъекты» активен), затем три вида:

```html
<div class="view active" id="view-list"><div class="content"><div id="listMount"></div></div></div>
<div class="view" id="view-card"><div class="content"><div id="cardMount"></div></div></div>
<div class="view" id="view-merge"><div class="content"><div id="mergeMount"></div></div></div>
```

4. Модалка — одна на все операции (создание, подтверждение), разметка копируется из `borrower.html` (`#mBack`, `#mTitle`, `#mBody`, `#mOk`, `#mCancel`, `#mClose`).
5. Скрипт — константы, помощники, пустые факты и роутер:

```js
const TODAY = '13.07.2026';        /* «сегодня» демо; совпадает с borrower.html — зеркала оттуда */
let VIEW_DATE = TODAY;             /* дата среза карточки (СБ-3, инвариант 4) */

const dnum   = d => { const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d || ''); return m ? +(m[3] + m[2] + m[1]) : 0; };
const toISO  = d => { const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
const fromISO= s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; };
const esc    = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scrollTop = () => { document.documentElement.scrollTop = document.body.scrollTop = 0; };

/* ── ФАКТЫ (наполняются в Task 2) ── */
const SUBJECTS = [], IP_REG = [], SUBJECT_EVENTS = [], LINKS = [], UNITS = [], BANK_REQ = [], DOCS = [];

/* Ссылка на запись: ключ, а у записи без ключа — внутренний id (СБ-10: дубли живут там,
   где ключа нет вовсе — наполовину прошедший импорт и legacy person-XXXXX). */
const subjectRef = s => s.key || s.id;
const subject = ref => SUBJECTS.find(s => s.key === ref || s.id === ref) || null;

function hashParams(q){
  const out = {};
  (q || '').split('&').filter(Boolean).forEach(pair => {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
  });
  return out;
}

const vList = document.getElementById('view-list');
const vCard = document.getElementById('view-card');
const vMerge = document.getElementById('view-merge');
function showOnly(v){ [vList, vCard, vMerge].forEach(x => x.classList.toggle('active', x === v)); }

function showList(){ VIEW_DATE = TODAY; renderList(); showOnly(vList); scrollTop(); }
function showCard(ref, onDate, tab){ VIEW_DATE = onDate && dnum(onDate) <= dnum(TODAY) ? onDate : TODAY;
  document.getElementById('cardMount').innerHTML = renderCard(ref, tab); wireCard(ref); showOnly(vCard); scrollTop(); }
function showMerge(a, b){ document.getElementById('mergeMount').innerHTML = renderMerge(a, b); showOnly(vMerge); scrollTop(); }

/* #/subjects — реестр · #/s/<ключ>[?on=ГГГГ-ММ-ДД&tab=<ключ вкладки>] — карточка ·
   #/merge/<a>/<b> — сравнение перед слиянием (СБ-11). */
function route(){
  let m;
  if ((m = /^#\/merge\/([^/]+)\/([^/]+)$/.exec(location.hash))) {
    const a = subject(decodeURIComponent(m[1])), b = subject(decodeURIComponent(m[2]));
    if (a && b) { showMerge(subjectRef(a), subjectRef(b)); return; }
  }
  if ((m = /^#\/s\/([^/?]+)(?:\?(.*))?$/.exec(location.hash))) {
    const s = subject(decodeURIComponent(m[1]));
    if (s) { const p = hashParams(m[2]);
      showCard(subjectRef(s), /^\d{4}-\d{2}-\d{2}$/.test(p.on || '') ? fromISO(p.on) : null, p.tab); return; }
  }
  showList();
}
window.addEventListener('hashchange', route);

/* заглушки рендера — наполняются в Tasks 3/5/9 */
function renderList(){ document.getElementById('listMount').innerHTML = ''; }
function renderCard(ref, tab){ return ''; }
function wireCard(ref){}
function renderMerge(a, b){ return ''; }

route();
```

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `7 / 7 PASS`.

- [ ] **Step 5: Завести npm-скрипт**

В `package.json`, секция `scripts`, после `"test:zalog"`:

```json
    "test:subject": "node scripts/inspect/subject-check.mjs"
```

Run: `npm run test:subject` → `7 / 7 PASS`.

- [ ] **Step 6: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs package.json
git commit -m "feat(subject): каркас макета субъекта — шелл, роутер, смоук-харнесс"
```

---

## Task 2: Данные и производные функции (СБ-1…СБ-4, СБ-6, инварианты 1/2/4)

**Files:**
- Modify: `mockups/subject/subject.html` (блоки «ФАКТЫ», «ЗЕРКАЛА», «ПРОИЗВОДНЫЕ»)
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `subject(ref)`, `subjectRef(s)`, `dnum`, `TODAY` (Task 1).
- Produces: массивы `SUBJECTS`, `IP_REG`, `SUBJECT_EVENTS`, `LINKS`, `UNITS`, `BANK_REQ`, `DOCS`; зеркала `CREDITS`, `PLEDGE_OBJ`, `SURETIES`, `PROCS`; функции `resolveKey(ref)`, `keysOf(ref)`, `keyKind(key)`, `ipRegAt(ref, date)`, `personKindAt(ref, date)`, `personKindLabel(k)`, `subjectRoles(ref)`, `subjectEvents(ref)`, `stopFactors(ref)`, `displayName(s)`.

- [ ] **Step 1: Написать падающие тесты модели**

Дописать в `scripts/inspect/subject-check.mjs` перед строкой `console.log(...)`:

```js
// ── Модель и производные (Task 2) ──
ok('1.1 три источника представлены в наборе',
  ['individuals','organizations','groups'].every(src => g.ev(`SUBJECTS.some(s=>s.source==='${src}')`)));
ok('1.2 инвариант 1: ключи уникальны',
  g.ev("(()=>{const k=SUBJECTS.map(s=>s.key).filter(Boolean);return new Set(k).size===k.length;})()"));
ok('1.3 инвариант 2: у группы ключ ГР-NNN и ИНН пуст, у прочих — 14 цифр либо ключа нет вовсе',
  g.ev("SUBJECTS.every(s => s.source==='groups' ? /^ГР-\\d{3}$/.test(s.key) && !s.inn : (s.key==='' || /^\\d{14}$/.test(s.key)))"));
ok('1.4 инвариант 4: хранимого типа лица нет ни у одной записи',
  g.ev("SUBJECTS.every(s=>!('personKind' in s) && !('isIP' in s) && !('roles' in s))"));
ok('1.5 keyKind различает ИНН и внутренний ключ группы',
  g.ev("keyKind('01204199910016')")==='ИНН' && g.ev("keyKind('ГР-001')")==='ГР');
// ADR-0018: физлицо бывает ИП период, потом перестаёт — тип считается на дату.
ok('1.6 personKindAt: в период регистрации ИП — «ИП», после прекращения — «физ»',
  g.ev("personKindAt('04401199940041','01.06.2020')")==='ИП' &&
  g.ev("personKindAt('04401199940041','01.06.2026')")==='физ');
ok('1.7 personKindAt: организация и группа от даты не зависят',
  g.ev("personKindAt('01204199910016','01.01.2011')")==='юр' &&
  g.ev("personKindAt('01204199910016',TODAY)")==='юр' &&
  g.ev("personKindAt('ГР-001',TODAY)")==='группа');
ok('1.8 у физлица без регистрации ИП тип «физ» на любую дату',
  g.ev("personKindAt('07701199970071','01.01.2015')")==='физ' &&
  g.ev("personKindAt('07701199970071',TODAY)")==='физ');
// ADR-0019: присоединённый ключ не исчезает — он разрешается в главного субъекта.
ok('1.9 resolveKey разрешает псевдоним, keysOf возвращает ключ и его псевдонимы',
  g.ev("resolveKey('S-DUP')")===g.ev("resolveKey(resolveKey('S-DUP'))") &&
  g.ev("keysOf('07701199970071').length") >= 1);
ok('1.10 инвариант 5: роли выводятся — функции создания/удаления роли нет',
  g.ev("typeof addRole")==='undefined' && g.ev("typeof removeRole")==='undefined');
ok('1.11 subjectRoles возвращает роль заёмщика при наличии кредитов',
  g.ev("subjectRoles('01204199910016').some(r=>r.role==='Заёмщик')"));
ok('1.12 subjectRoles: залогодатель по ЧУЖОМУ кредиту тоже роль',
  g.ev("subjectRoles('07701199970071').some(r=>r.role==='Залогодатель')"));
ok('1.13 зеркала не содержат собственных полей субъекта (ADR-0014)',
  g.ev("CREDITS.every(c=>!('name' in c) && !('district' in c))"));
ok('1.14 в наборе есть закрытая регистрация ИП, групповой заёмщик с составом и пара-дубль без ключа',
  g.ev("IP_REG.some(r=>r.to)") &&
  g.ev("LINKS.some(l=>l.kind==='член группы')") &&
  g.ev("SUBJECTS.filter(s=>s.key==='').length") >= 2);
```

- [ ] **Step 2: Прогнать — тесты падают**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 1.1–1.14 (`resolveKey is not defined` и пустые массивы).

- [ ] **Step 3: Наполнить факты**

Заменить строку `const SUBJECTS = [], IP_REG = [], ...` блоком данных. Реквизиты организаций и физлиц берутся из `borrower.html` (строки 1287–1360) — те же ИНН и наименования, чтобы два макета говорили об одних лицах.

```js
/* ── ФАКТЫ — владеет модуль субъектов ──
   key — ключ субъекта (ADR-0019): ИНН/ПИН у лица, ГР-NNN у группы, '' у записи,
         которой ключ не пришёл (наполовину прошедший импорт, legacy person-XXXXX).
   source — источник хранения (СБ-1): individuals | organizations | groups.
   Хранимого типа лица НЕТ (инвариант 4) — тип считает personKindAt на дату (ADR-0018).
   imported — импортный слой (СБ-5): снимок с датой и источником, у каждого поля одно из
   трёх состояний: 'реестр' (пришло, read-only) · 'наше' (не пришло, введено нами, подписано)
   · 'пусто' (не пришло и не введено). pending — пришедшее позже значение реестра, которое
   расходится с нашим: молча не затирает, показывает расхождение с выбором. */
const SUBJECTS = [
  { id:'S-001', key:'01204199910016', source:'organizations', name:'ОАО «АгроТехСервис»',
    district:'Ленинский (г. Бишкек)', region:'г. Бишкек', industry:'Агропромышленный комплекс',
    note:'реструктуризация 2025 г. — график пересмотрен',
    imported:{ asOf:'12.05.2026', src:'ГРС · Тундук', f:{
      nameFull:{st:'реестр', v:'Открытое акционерное общество «АгроТехСервис»'},
      nameShort:{st:'реестр', v:'ОАО «АгроТехСервис»'},
      regNo:{st:'реестр', v:'0012041'}, regDate:{st:'реестр', v:'14.02.2011'},
      okpo:{st:'пусто'},
      soate:{st:'реестр', v:'41703 000 000 000'},
      addr:{st:'реестр', v:'г. Бишкек, ул. Ибраимова 24'},
      director:{st:'наше', v:'Асанов Т.К.', by:'Асанова Ж.К.', at:'19.06.2026', doc:'Устав от 14.02.2011',
                pending:{v:'Асанов Талант Кубанычбекович', at:'12.05.2026'}},
      activity:{st:'пусто'} } } },
  { id:'S-002', key:'02201199920021', source:'organizations', name:'ОсОО «Иссык-Куль Агро»',
    district:'Ак-Суйский', region:'Иссык-Кульская', industry:'Пищевая и перерабатывающая', note:'—',
    imported:{ asOf:'12.05.2026', src:'ГРС · Тундук', f:{
      nameFull:{st:'реестр', v:'Общество с ограниченной ответственностью «Иссык-Куль Агро»'},
      nameShort:{st:'реестр', v:'ОсОО «Иссык-Куль Агро»'},
      regNo:{st:'реестр', v:'0022011'}, regDate:{st:'реестр', v:'03.05.2015'},
      okpo:{st:'реестр', v:'27458119'}, soate:{st:'пусто'},
      addr:{st:'реестр', v:'г. Каракол, ул. Токтогула 5'},
      director:{st:'пусто'}, activity:{st:'реестр', v:'Переработка сельхозпродукции'} } } },
  { id:'S-003', key:'04401199940041', source:'individuals', name:'Асанов Тимур Кубанычевич',
    district:'Кара-Сууйский', region:'Ошская', industry:'Частное предпринимательство',
    note:'снялся с регистрации ИП 31.12.2025',
    imported:{ asOf:'14.05.2026', src:'ГРС · Тундук', f:{
      fio:{st:'реестр', v:'Асанов Тимур Кубанычевич'},
      docKind:{st:'реестр', v:'Паспорт'}, docNo:{st:'реестр', v:'ID0440119'},
      nationality:{st:'реестр', v:'Кыргыз'},
      soate:{st:'реестр', v:'41716 000 000 000'},
      addr:{st:'реестр', v:'г. Ош, ул. Курманжан-Датка 8'} } } },
  { id:'S-004', key:'07701199970071', source:'individuals', name:'Мамбетов Кубаныч',
    district:'Сузакский', region:'Джалал-Абадская', industry:'—', note:'залогодатель по чужому кредиту',
    imported:{ asOf:'14.05.2026', src:'ГРС · Тундук', f:{
      fio:{st:'реестр', v:'Мамбетов Кубаныч'},
      docKind:{st:'реестр', v:'Паспорт'}, docNo:{st:'реестр', v:'ID0770117'},
      nationality:{st:'пусто'}, soate:{st:'пусто'},
      addr:{st:'наше', v:'г. Джалал-Абад, ул. Токтогула 90', by:'Токтосунов Э.Б.', at:'11.03.2026',
            doc:'Заявление от 11.03.2026'} } } },
  /* Групповой заёмщик (СБ-4): лицо без ИНН, ключ выдан системой, импортного слоя нет вовсе (СБ-5а). */
  { id:'S-005', key:'ГР-001', source:'groups', name:'Группа «Ак-Талаа» (совместное кредитование)',
    district:'Ак-Талинский', region:'Нарынская', industry:'Агропромышленный комплекс',
    note:'групповой кредит; транши несут члены группы' },
  /* Пара-дубль (СБ-10): ключа нет ни у одной — одна пришла из legacy без реквизитов,
     вторая — наполовину прошедший импорт (дефект стенда P4-09). */
  { id:'S-DUP', key:'', source:'individuals', name:'Мамбетов Кубаныч',
    district:'Сузакский', region:'Джалал-Абадская', industry:'—', note:'перенос legacy person-63545',
    imported:{ asOf:'—', src:'legacy', f:{
      fio:{st:'наше', v:'Мамбетов Кубаныч', by:'миграция', at:'02.02.2026', doc:'Выгрузка legacy'},
      docKind:{st:'наше', v:'Паспорт', by:'миграция', at:'02.02.2026', doc:'Выгрузка legacy'},
      docNo:{st:'наше', v:'ID0770117', by:'миграция', at:'02.02.2026', doc:'Выгрузка legacy'},
      nationality:{st:'пусто'}, soate:{st:'пусто'}, addr:{st:'пусто'} } } },
  { id:'S-DUP2', key:'', source:'individuals', name:'',
    district:'Сузакский', region:'Джалал-Абадская', industry:'—', note:'импорт прошёл наполовину',
    imported:{ asOf:'—', src:'ГРС · Тундук', f:{
      fio:{st:'пусто'}, docKind:{st:'реестр', v:'Паспорт'}, docNo:{st:'реестр', v:'ID0770117'},
      nationality:{st:'пусто'}, soate:{st:'пусто'}, addr:{st:'пусто'} } } },
];

/* IP_REG — регистрации ИП (СБ-3а, ADR-0018): период с датой начала и датой прекращения.
   Записей у одного лица может быть несколько: снялся, зарегистрировался снова. */
const IP_REG = [
  { key:'04401199940041', no:'ИП-0044011', from:'22.01.2019', to:'31.12.2025', doc:'Патент 0044011' },
];

/* SUBJECT_EVENTS — лента событий субъекта (СБ-9), append-only. Событие ничего не меняет
   в кредите, обеспечении и взыскании; единственное, что оно порождает, — выводимый
   стоп-фактор (СБ-13). Исключение по форме — «утрата статуса ИП»: она проставляет дату
   прекращения регистрации, а не переписывает тип (ADR-0018). */
const SUBJECT_EVENTS = [
  { key:'04401199940041', kind:'утрата статуса ИП', date:'31.12.2025',
    basis:'Заявление о прекращении деятельности', doc:'ЗП-118' },
  { key:'02201199920021', kind:'реорганизация', date:'12.03.2026',
    basis:'Решение общего собрания', doc:'РС-14', successorKey:'01204199910016' },
];

/* LINKS — связи лиц (СБ-7): одна запись, видимая с обоих концов, с периодом и основанием.
   kind: 'учредитель' | 'руководитель' | 'супруг' | 'член группы' | 'аффилированность'.
   a — лицо, b — вторая сторона (организация/группа/второй супруг). */
const LINKS = [
  { id:'L-1', kind:'учредитель', a:'04401199940041', b:'01204199910016', share:60,
    from:'14.02.2011', to:null, doc:'Устав от 14.02.2011' },
  { id:'L-2', kind:'руководитель', a:'04401199940041', b:'01204199910016',
    from:'14.02.2011', to:null, doc:'Приказ №1 от 14.02.2011' },
  { id:'L-3', kind:'супруг', a:'07701199970071', b:'04401199940041',
    from:'03.09.2009', to:null, doc:'Свид. о браке БР-2211' },
  { id:'L-4', kind:'член группы', a:'07701199970071', b:'ГР-001',
    from:'11.02.2026', to:null, doc:'Протокол собрания группы №1' },
  { id:'L-5', kind:'член группы', a:'04401199940041', b:'ГР-001',
    from:'11.02.2026', to:null, doc:'Протокол собрания группы №1' },
];

/* UNITS — организационная структура юрлица (стенд: наименование · примечание · орг. отдел · ФИО). */
const UNITS = [
  { key:'01204199910016', id:5550, name:'Руководство',          note:'г. Бишкек',         dept:'—',            fio:'Асанов Т.К.' },
  { key:'01204199910016', id:5551, name:'Производственный цех', note:'с. Селекционное',   dept:'Производство', fio:'—' },
];

/* BANK_REQ — банковские реквизиты; вкладка доступна организации и физлицу в период
   действующей регистрации ИП (раздел 4 спеки). */
const BANK_REQ = [
  { key:'01204199910016', bank:'ОАО «РСК Банк»', bik:'129001', account:'1234567890123456',
    from:'14.02.2011', to:null, main:true },
  { key:'04401199940041', bank:'ОАО «Айыл Банк»', bik:'135001', account:'9876543210987654',
    from:'22.01.2019', to:'31.12.2025', main:true },
];

/* DOCS — вложения субъекта: вид · относительно · дата · файл. */
const DOCS = [
  { key:'01204199910016', kind:'Устав', about:'Организация', date:'14.02.2011', file:'ustav-2011.pdf' },
  { key:'04401199940041', kind:'Свид. о прекращении ИП', about:'Регистрация ИП', date:'31.12.2025', file:'zp-118.pdf' },
  { key:'ГР-001', kind:'Протокол собрания группы', about:'Состав', date:'11.02.2026', file:'protokol-1.pdf' },
];
```

- [ ] **Step 4: Добавить зеркала**

Сразу после фактов:

```js
/* ── ЗЕРКАЛА — read-only (ADR-0014). Правка = переход в модуль-источник; макет субъекта
   их не мутирует нигде, слияние в том числе (инвариант 9). ── */
const CREDITS = [
  { id:'C-ATS-1', no:'КР-60540', key:'01204199910016', date:'02.03.2024', active:true },
  { id:'C-ATS-2', no:'КР-60541', key:'01204199910016', date:'14.06.2025', active:true },
  { id:'C-GR-1',  no:'КР-60712', key:'ГР-001',         date:'11.02.2026', active:true },
  { id:'C-IKA-1', no:'КР-60333', key:'02201199920021', date:'05.05.2023', active:false },
];
const PLEDGE_OBJ = [
  { id:'П-101', name:'Здание цеха', pledgerKey:'07701199970071', creditId:'C-ATS-1', released:false },
];
const SURETIES = [
  { id:'ДП-77', guarantorKey:'04401199940041', creditId:'C-ATS-2', date:'14.06.2025', active:true },
];
const PROCS = [
  { id:'ПР-31', no:'ВЗ-2026-31', debtorKey:'02201199920021', date:'20.05.2026', active:true },
];
```

- [ ] **Step 5: Написать производные функции**

Блок «ПРОИЗВОДНЫЕ» после зеркал:

```js
/* ── ПРОИЗВОДНЫЕ — не хранятся никогда (ADR-0001) ── */

/* Разрешение псевдонима (СБ-11, ADR-0019): присоединённый при слиянии ключ из маршрутов
   не исчезает и при чтении ведёт на главную запись. Глубина ограничена: цепочку
   псевдонимов слияние не создаёт, а зациклиться на данных нельзя. */
function resolveKey(ref){
  let s = subject(ref);
  for (let i = 0; s && s.aliasOf && i < 8; i++) s = subject(s.aliasOf);
  return s ? subjectRef(s) : ref;
}
/* Все ключи, по которым считается лицо: свой и все присоединённые к нему. */
function keysOf(ref){
  const main = resolveKey(ref);
  return [main, ...SUBJECTS.filter(s => s.aliasOf && resolveKey(subjectRef(s)) === main).map(subjectRef)];
}
const keyKind = key => /^ГР-\d{3}$/.test(key || '') ? 'ГР' : (/^\d{14}$/.test(key || '') ? 'ИНН' : '—');

/* Регистрация ИП, действующая на дату (СБ-3а). to === null — открытая. */
function ipRegAt(ref, date){
  const ks = keysOf(ref), d = dnum(date || TODAY);
  return IP_REG.find(r => ks.includes(r.key) && dnum(r.from) <= d && (!r.to || dnum(r.to) >= d)) || null;
}
/* Тип лица — правоспособность на дату (СБ-3, ADR-0018), а не хранимый признак.
   Организация и групповой заёмщик от даты не зависят; у физлица тип даёт регистрация ИП. */
function personKindAt(ref, date){
  const s = subject(resolveKey(ref));
  if (!s) return null;
  if (s.source === 'groups') return 'группа';
  if (s.source === 'organizations') return 'юр';
  return ipRegAt(ref, date) ? 'ИП' : 'физ';
}
const PERSON_KIND_LABEL = { 'юр':'Юр. лицо', 'ИП':'ИП', 'физ':'Физ. лицо', 'группа':'Групповой заёмщик' };
const personKindLabel = k => PERSON_KIND_LABEL[k] || k;

const displayName = s => s.name || '(ФИО не пришло из реестра)';

/* События субъекта по ключу и его псевдонимам, свежие сверху. */
function subjectEvents(ref){
  const ks = keysOf(ref);
  return SUBJECT_EVENTS.filter(e => ks.includes(e.key)).slice().sort((a,b) => dnum(b.date) - dnum(a.date));
}
/* Стоп-фактор выводится из события и заводится только им (СБ-13): одно обстоятельство
   не должно жить в системе дважды. «Утрата статуса ИП» стоп-фактором не является —
   она меняет правоспособность, а не запрещает работу. */
const STOP_KINDS = { 'ликвидация':'Лицо ликвидировано', 'смерть':'Лицо умерло',
  'перевод долга':'Долг переведён правопреемнику', 'роспуск группы':'Группа распущена' };
function stopFactors(ref){
  return subjectEvents(ref).filter(e => STOP_KINDS[e.kind])
    .map(e => ({ text:STOP_KINDS[e.kind], date:e.date, doc:e.doc, kind:e.kind, successorKey:e.successorKey }));
}

/* Роли субъекта (СБ-6) — выводятся из участия в кредитных отношениях, руками не задаются
   и не удаляются (инвариант 5). Считаются по ключу и всем его псевдонимам (инвариант 8). */
function subjectRoles(ref){
  const ks = keysOf(ref), out = [];
  const my = CREDITS.filter(c => ks.includes(c.key));
  if (my.length) out.push({ role:'Заёмщик',
    basis: my.filter(c => c.active).length + ' действующих из ' + my.length,
    since: my.map(c => c.date).sort((a,b) => dnum(a) - dnum(b))[0],
    link:'модуль кредитов' });
  const pl = PLEDGE_OBJ.filter(o => ks.includes(o.pledgerKey) && !o.released);
  if (pl.length) out.push({ role:'Залогодатель', basis: pl.length + ' предметов в залоге',
    since:'—', link:'модуль залога' });
  const su = SURETIES.filter(x => ks.includes(x.guarantorKey) && x.active);
  if (su.length) out.push({ role:'Поручитель', basis: su.length + ' договоров поручительства',
    since: su.map(x => x.date).sort((a,b) => dnum(a) - dnum(b))[0], link:'модуль обеспечения' });
  const pr = PROCS.filter(p => ks.includes(p.debtorKey) && p.active);
  if (pr.length) out.push({ role:'Обязанное лицо', basis: pr.length + ' дел взыскания',
    since: pr.map(p => p.date).sort((a,b) => dnum(a) - dnum(b))[0], link:'модуль взыскания' });
  return out;
}
```

- [ ] **Step 6: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `21 / 21 PASS`.

- [ ] **Step 7: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): факты, зеркала и производные — тип лица на дату, роли, псевдонимы"
```

---

## Task 3: Экран-реестр — колонки, панель фильтров, поиск, пагинация (раздел 3, СБ-1/СБ-3/СБ-6/СБ-10)

**Files:**
- Modify: `mockups/subject/subject.html` (`renderList` и обвязка)
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `personKindAt`, `subjectRoles`, `stopFactors`, `keyKind`, `displayName`, `subjectRef`.
- Produces: `FILTER` (объект состояния фильтров), `listRows()`, `renderList()`, `applyFilters()`, `similarPairs()`, `pgSize`, `pgNo`, DOM-узлы `#listTable`, `#rowCount`, `#f-kind`, `#f-region`, `#f-district`, `#f-role`, `#f-event`, `#f-similar`, `#q`, `#emptyState`, `#clearFilters`, `#pgPrev`, `#pgNext`.

- [ ] **Step 1: Написать падающие тесты реестра**

```js
// ── Реестр (Task 3) ──
ok('2.1 реестр рисует таблицу и счётчик «1–N из K»',
  (() => { g.ev("location.hash=''"); g.ev("route()");
    return !!g.$('#listTable') && new RegExp('^1–\\d+ из ' + g.ev("listRows().length") + '$').test(g.$('#rowCount').textContent); })());
ok('2.2 строк на странице не больше размера страницы (СП-11)',
  g.$$('#listTable tbody tr').length <= g.ev("pgSize"));
ok('2.3 колонка типа лица подписана датой среза (инвариант 4)',
  g.$('#listTable').textContent.includes('на ' + g.ev("TODAY")) ||
  g.$('#listHead').textContent.includes('на ' + g.ev("TODAY")));
ok('2.4 у группового заёмщика в реестре виден ключ ГР-, а не ИНН',
  g.$('#listTable').textContent.includes('ГР-001'));
ok('2.5 фильтр по типу лица считает тип на дату, а не читает поле',
  (() => { g.ev("FILTER.kind='ИП'"); g.ev("applyFilters()");
    const rows = g.ev("listRows().map(s=>s.key)");
    return rows.length === 0; })());   // на 13.07.2026 действующих ИП нет: регистрация закрыта 31.12.2025
ok('2.6 фильтр по роли отбирает по выводимым ролям',
  (() => { g.ev("FILTER.kind=''"); g.ev("FILTER.role='Поручитель'"); g.ev("applyFilters()");
    return g.ev("listRows().every(s=>subjectRoles(subjectRef(s)).some(r=>r.role==='Поручитель'))") &&
           g.ev("listRows().length") > 0; })());
ok('2.7 фильтр «есть событие» отбирает по ленте событий',
  (() => { g.ev("FILTER.role=''"); g.ev("FILTER.event=true"); g.ev("applyFilters()");
    return g.ev("listRows().every(s=>subjectEvents(subjectRef(s)).length>0)") && g.ev("listRows().length") > 0; })());
ok('2.8 разрез «похожие записи» показывает только записи без ключа либо псевдонимы (СБ-10)',
  (() => { g.ev("FILTER.event=false"); g.ev("FILTER.similar=true"); g.ev("applyFilters()");
    return g.ev("listRows().every(s=>s.key==='' || !!s.aliasOf)") && g.ev("listRows().length") >= 2; })());
ok('2.9 признак дубля печатается в паре и не использует дату рождения (её в системе нет)',
  (() => { const t = g.$('#listTable').textContent;
    return /документ|ФИО|наименование/i.test(t) && !/дата рождения/i.test(t); })());
ok('2.10 пустое состояние называет условия и чистит их одной кнопкой (СП-16)',
  (() => { g.ev("FILTER.similar=false"); g.ev("FILTER.q='несуществующее-лицо-zzz'"); g.ev("applyFilters()");
    const has = !!g.$('#emptyState') && !!g.$('#clearFilters');
    g.ev("document.getElementById('clearFilters').click()");
    return has && g.ev("FILTER.q")==='' && g.ev("listRows().length") === g.ev("SUBJECTS.filter(s=>!s.aliasOf).length"); })());
ok('2.11 поиск идёт по ключу И по наименованию',
  (() => { g.ev("FILTER.q='АгроТех'"); g.ev("applyFilters()");
    const byName = g.ev("listRows().length")===1;
    g.ev("FILTER.q='07701199970071'"); g.ev("applyFilters()");
    const byKey = g.ev("listRows().some(s=>s.key==='07701199970071')");
    g.ev("FILTER.q=''"); g.ev("applyFilters()");
    return byName && byKey; })());
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 2.1–2.11 (`listRows is not defined`).

- [ ] **Step 3: Реализовать реестр**

Заменить заглушку `renderList`:

```js
/* ── РЕЕСТР ──
   Панель фильтров, а не Jmix-конструктор «Добавить условие поиска»: на стенде своих
   фильтров нет вовсе (дефект P4-10), и отобрать лица по типу или району нечем. */
const pgSize = 20;
let pgNo = 1;
const FILTER = { q:'', kind:'', region:'', district:'', role:'', event:false, similar:false };

/* Признак похожести (СБ-10): дата рождения системой не хранится (§1.1 спеки, дефект P4-12),
   поэтому ищем по документу и по нормализованному имени в одном районе. */
const normName = s => (s || '').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim();
const docOf = s => ((s.imported && s.imported.f && s.imported.f.docNo && s.imported.f.docNo.v) || '');
function similarPairs(){
  /* Ищем ТОЛЬКО среди записей без ключа и псевдонимов — дубль по ключу невозможен (СБ-2).
     Вторая сторона пары может быть любой: сравниваем такую запись со всем реестром. */
  const pool = SUBJECTS.filter(s => s.key === '' || s.aliasOf);
  const out = [], seen = new Set();
  pool.forEach(a => SUBJECTS.forEach(b => {
    if (a === b) return;
    const pair = [subjectRef(a), subjectRef(b)].sort().join('|');
    if (seen.has(pair)) return;
    const byDoc  = docOf(a) && docOf(a) === docOf(b);
    const byName = normName(a.name) && normName(a.name) === normName(b.name) && a.district === b.district;
    if (!byDoc && !byName) return;
    seen.add(pair);
    out.push({ a:subjectRef(a), b:subjectRef(b),
      why: byDoc ? 'совпал документ ' + docOf(a) : 'совпало имя в одном районе' });
  }));
  return out;
}

function listRows(){
  const pairs = similarPairs();
  return SUBJECTS.filter(s => {
    if (s.aliasOf && !FILTER.similar) return false;    /* псевдоним живёт в разрезе дублей */
    const ref = subjectRef(s);
    if (FILTER.q){
      const q = FILTER.q.toLowerCase();
      if (!((s.key || '').toLowerCase().includes(q) || normName(s.name).includes(normName(q)))) return false;
    }
    if (FILTER.kind && personKindAt(ref, VIEW_DATE) !== FILTER.kind) return false;
    if (FILTER.region && s.region !== FILTER.region) return false;
    if (FILTER.district && s.district !== FILTER.district) return false;
    if (FILTER.role && !subjectRoles(ref).some(r => r.role === FILTER.role)) return false;
    if (FILTER.event && !subjectEvents(ref).length) return false;
    /* Разрез дублей показывает СТОРОНУ-КАНДИДАТА, а не обе стороны пары: искать нечего
       у записи, ключ которой есть — она уже опознана (СБ-10). */
    if (FILTER.similar && !(s.key === '' || s.aliasOf)) return false;
    if (FILTER.similar && !pairs.some(p => p.a === ref || p.b === ref)) return false;
    return true;
  });
}
function applyFilters(){ pgNo = 1; renderList(); }
```

Разметка реестра — `renderList` собирает: тулбар (`#q` с дребезгом 250 мс, кнопки `+ Субъект` / `+ Группа`), панель фильтров (`#f-kind` — четыре типа, `#f-region` → каскад `#f-district` из данных, `#f-role` — четыре роли, чекбоксы `#f-event`, `#f-similar`, кнопка `#clearFilters`), таблицу `#listTable` с шапкой `#listHead` и строками:

```js
function renderList(){
  const rows = listRows();
  const from = (pgNo - 1) * pgSize, page = rows.slice(from, from + pgSize);
  const pairs = similarPairs();
  const tr = s => {
    const ref = subjectRef(s), kind = personKindAt(ref, VIEW_DATE);
    const roles = subjectRoles(ref).map(r => '<span class="chip">' + esc(r.role) + '</span>').join('');
    const st = stopFactors(ref)[0];
    const sim = pairs.find(p => p.a === ref || p.b === ref);
    return '<tr><td><a class="lnk" href="#/s/' + esc(ref) + '">' + esc(displayName(s)) + '</a>'
      + '<div class="muted">' + (s.key ? esc(keyKind(s.key)) + ' ' + esc(s.key) : 'ключ не пришёл · ' + esc(s.id)) + '</div></td>'
      + '<td>' + esc(personKindLabel(kind)) + '</td>'
      + '<td>' + esc(s.district) + '<div class="muted">' + esc(s.region) + '</div></td>'
      + '<td>' + (roles || '<span class="muted">—</span>') + '</td>'
      + '<td>' + (st ? esc(st.text) + ' ' + esc(st.date) : '<span class="muted">—</span>')
      + (sim ? '<div class="muted">похожа на ' + esc(sim.b === ref ? sim.a : sim.b) + ' · ' + esc(sim.why)
          + ' · <a class="lnk" href="#/merge/' + esc(sim.a) + '/' + esc(sim.b) + '">сравнить</a></div>' : '')
      + '</td></tr>';
  };
  document.getElementById('listMount').innerHTML =
    toolbarHtml() + filterPanelHtml()
    + '<table class="grid" id="listTable"><thead id="listHead"><tr><th>Наименование / ФИО</th>'
    + '<th>Тип лица <span class="hint">на ' + esc(VIEW_DATE) + '</span></th><th>Район</th><th>Роли</th><th>Событие</th></tr></thead>'
    + '<tbody>' + page.map(tr).join('') + '</tbody></table>'
    + (rows.length ? '' : emptyStateHtml())
    + '<div class="pager"><span id="rowCount">' + (rows.length ? (from + 1) + '–' + (from + page.length) + ' из ' + rows.length : '0 из 0')
    + '</span><button class="btn btn-secondary btn-sm" id="pgPrev">←</button>'
    + '<button class="btn btn-secondary btn-sm" id="pgNext">→</button></div>';
  wireList();
}
```

`emptyStateHtml()` перечисляет действующие условия словами и даёт `<button id="clearFilters">Очистить условия</button>`; `wireList()` вешает обработчики (кнопки страниц меняют `pgNo`, `#clearFilters` сбрасывает `FILTER` в исходный объект и вызывает `applyFilters()`, поля фильтров пишут в `FILTER` и вызывают `applyFilters()`, `#q` — через `setTimeout` 250 мс).

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `32 / 32 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): реестр — панель фильтров, разрез похожих записей, пагинация"
```

---

## Task 4: Создание — вход через ключ и «+ Группа» (раздел 3, СБ-2/СБ-3а/СБ-4, инварианты 1/2)

**Files:**
- Modify: `mockups/subject/subject.html`
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `subject`, `keyKind`, `SUBJECTS`, `applyFilters`, модалка `#mBack`/`#mTitle`/`#mBody`/`#mOk`.
- Produces: `openCreate()`, `lookupKey(key)`, `createSubject({key, source, name, district, region})`, `nextGroupKey()`, `openCreateGroup()`, `createGroup({name, district, region})`.

- [ ] **Step 1: Написать падающие тесты создания**

```js
// ── Создание (Task 4) ──
ok('3.1 существующий ключ до формы не пускает, а предлагает открыть карточку (инвариант 1)',
  g.ev("lookupKey('01204199910016').found")===true &&
  g.ev("lookupKey('01204199910016').ref")==='01204199910016');
ok('3.2 неизвестный ключ ведёт в форму с предзаполненным ключом',
  g.ev("lookupKey('12345678901234').found")===false);
ok('3.3 форма создания предлагает ровно два типа — физлицо и организация (СБ-3а: ИП не заводится)',
  (() => { g.ev("openCreate('12345678901234')");
    const t = g.$('#mBody').textContent;
    return /Физ/i.test(t) && /Организац/i.test(t) && !/(^|\W)ИП(\W|$)/.test(t); })());
ok('3.4 createSubject отвергает дубль ключа',
  g.ev("(()=>{try{createSubject({key:'01204199910016',source:'individuals',name:'Дубль'});return false;}catch(e){return true;}})()"));
ok('3.5 createSubject отвергает ключ не из 14 цифр (инвариант 2)',
  g.ev("(()=>{try{createSubject({key:'123',source:'individuals',name:'Кривой ключ'});return false;}catch(e){return true;}})()"));
ok('3.6 «+ Группа» выдаёт ключ ГР-NNN сама и ИНН не спрашивает',
  (() => { const before = g.ev("SUBJECTS.length");
    g.ev("createGroup({name:'Группа «Тест»',district:'Ак-Талинский',region:'Нарынская'})");
    return g.ev("SUBJECTS.length") === before + 1 &&
           /^ГР-\d{3}$/.test(g.ev("SUBJECTS[SUBJECTS.length-1].key")) &&
           g.ev("!('inn' in SUBJECTS[SUBJECTS.length-1])") &&
           g.ev("SUBJECTS[SUBJECTS.length-1].source")==='groups'; })());
ok('3.7 у созданной группы импортного слоя нет вовсе (СБ-5а)',
  g.ev("!('imported' in SUBJECTS[SUBJECTS.length-1])"));
ok('3.8 новый ключ группы не повторяет выданный ранее',
  (() => { const k1 = g.ev("SUBJECTS[SUBJECTS.length-1].key");
    g.ev("createGroup({name:'Группа «Тест-2»',district:'Ак-Талинский',region:'Нарынская'})");
    return g.ev("SUBJECTS[SUBJECTS.length-1].key") !== k1; })());
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 3.1–3.8 (`lookupKey is not defined`).

- [ ] **Step 3: Реализовать создание**

```js
/* ── СОЗДАНИЕ ──
   Вход только через ключ (СБ-2 и поведение стенда: одно живое поле ИНН + «Заполнить поля»).
   Дубль по ключу невозможен по построению — проверка стоит ДО формы, а не после ввода. */
function lookupKey(key){
  const s = subject(String(key || '').trim());
  return s ? { found:true, ref:subjectRef(s), name:displayName(s) } : { found:false, key:String(key || '').trim() };
}
function createSubject({ key, source, name, district, region, industry }){
  const k = String(key || '').trim();
  if (!/^\d{14}$/.test(k)) throw new Error('Ключ субъекта — 14 цифр (ИНН/ПИН). Групповой заёмщик заводится кнопкой «+ Группа».');
  if (subject(k)) throw new Error('Такой ключ уже есть в реестре: ' + k);
  if (source !== 'individuals' && source !== 'organizations') throw new Error('Тип: физлицо или организация');
  /* Тип ИП в форме не предлагается (СБ-3а): ИП появляется регистрацией у заведённого физлица. */
  const s = { id:'S-' + (SUBJECTS.length + 1), key:k, source, name:name || '',
    district:district || '—', region:region || '—', industry:industry || '—', note:'заведён вручную',
    imported:{ asOf:'—', src:'ГРС · Тундук', f:{} } };
  SUBJECTS.push(s);
  return subjectRef(s);
}
/* Групповой заёмщик (СБ-4): ИНН не присваивается — ключ выдаёт система; импортного слоя нет (СБ-5а). */
function nextGroupKey(){
  const used = SUBJECTS.filter(s => s.source === 'groups').map(s => +String(s.key).slice(3));
  return 'ГР-' + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0');
}
function createGroup({ name, district, region, industry }){
  const s = { id:'S-' + (SUBJECTS.length + 1), key:nextGroupKey(), source:'groups', name:name || '',
    district:district || '—', region:region || '—', industry:industry || '—', note:'заведён вручную' };
  SUBJECTS.push(s);
  return subjectRef(s);
}
```

`openCreate(prefill)` — модалка в два шага: шаг 1 — поле ключа и кнопка «Проверить»; при `found` тело меняется на строку «Такой субъект уже есть: <имя>» и кнопку-ссылку в карточку; при `!found` — форма с предзаполненным ключом, радиогруппой из **двух** значений («Физическое лицо» / «Организация»), полями наименования, области и района. `openCreateGroup()` — форма без поля ключа, с подписью «Ключ выдаст система при сохранении»; после `createGroup` — переход в карточку через `location.hash`. Обе кнопки живут в тулбаре реестра (`#btnCreate`, `#btnCreateGroup`).

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `40 / 40 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): создание через ключ и «+ Группа» с системным ключом ГР-NNN"
```

---

## Task 5: Карточка — шапка, каркас вкладок, «Основное» и «Адреса» с трёхсостоянным импортным слоем (раздел 4, СБ-5/СБ-5а, инварианты 3/4)

**Files:**
- Modify: `mockups/subject/subject.html`
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `personKindAt`, `stopFactors`, `subjectRoles`, `resolveKey`, `keysOf`, `SUBJECTS[].imported`.
- Produces: `TAB_DEFS`, `tabsFor(ref, date)`, `renderCard(ref, tab)`, `wireCard(ref)`, `switchTab(key)`, `activeTabKey()` (ключ активной вкладки, `''` если карточка не открыта), `renderCardInPlace(ref)`, `fieldRow(ref, name, label)`, `fillOwn(ref, name, value)`, `resolveConflict(ref, name, choice)`, `importBarHtml(s)`, `CURRENT_USER`.

- [ ] **Step 1: Написать падающие тесты карточки**

```js
// ── Карточка: шапка и импортный слой (Task 5) ──
ok('4.1 карточка открывается по ключу и печатает тип лица с датой среза (инвариант 4)',
  (() => { g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    const t = g.$('#cardMount').textContent;
    return g.$('#view-card').classList.contains('active') && t.includes('Юр. лицо') && t.includes(g.ev("TODAY")); })());
ok('4.2 срез из маршрута меняет тип лица у бывшего ИП (ADR-0018)',
  (() => { g.ev("location.hash='#/s/04401199940041?on=2020-06-01'"); g.ev("route()");
    const was = g.$('#cardMount').textContent.includes('ИП');
    g.ev("location.hash='#/s/04401199940041'"); g.ev("route()");
    return was && g.$('#cardMount').textContent.includes('Физ. лицо'); })());
ok('4.3 шапка показывает дату и источник импортного снимка',
  (() => { g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    const t = g.$('#cardMount').textContent; return t.includes('12.05.2026') && t.includes('Тундук'); })());
ok('4.4 у группового заёмщика импортной строки и кнопки «Обновить из реестра» нет (СБ-5а)',
  (() => { g.ev("location.hash='#/s/ГР-001'"); g.ev("route()");
    return !g.$('#importBar') && !g.$('#btnRefreshImport'); })());
ok('4.5 инвариант 3: поле в состоянии «реестр» read-only, редактора у него нет',
  (() => { g.ev("location.hash='#/s/01204199910016'"); g.ev("route()");
    return !!g.$('[data-field="nameFull"][data-state="реестр"]') &&
           !g.$('[data-field="nameFull"] input') && !g.$('[data-field="nameFull"] .btn-fill'); })());
ok('4.6 пустое импортное поле заполняется руками, значение подписывается автором и датой',
  (() => { const has = !!g.$('[data-field="okpo"][data-state="пусто"] .btn-fill');
    g.ev("fillOwn('01204199910016','okpo','27458119')");
    return has && g.ev("subject('01204199910016').imported.f.okpo.st")==='наше' &&
           !!g.ev("subject('01204199910016').imported.f.okpo.by") &&
           !!g.ev("subject('01204199910016').imported.f.okpo.at"); })());
ok('4.7 наше значение видно как «введено нами» с подписью',
  (() => { g.ev("route()"); const el = g.$('[data-field="director"][data-state="наше"]');
    return !!el && /введено нами/i.test(el.textContent) && /Асанова/.test(el.textContent); })());
ok('4.8 пришедшее позже значение реестра не затирает наше молча — показывается расхождение с выбором',
  (() => { const el = g.$('[data-field="director"]');
    return /расхожден/i.test(el.textContent) && el.querySelectorAll('[data-choice]').length === 2; })());
ok('4.9 выбор в пользу реестра переводит поле в состояние «реестр»',
  (() => { g.ev("resolveConflict('01204199910016','director','реестр')");
    return g.ev("subject('01204199910016').imported.f.director.st")==='реестр' &&
           g.ev("subject('01204199910016').imported.f.director.v")==='Асанов Талант Кубанычбекович' &&
           g.ev("!subject('01204199910016').imported.f.director.pending"); })());
ok('4.10 состав вкладок зависит от типа лица на дату',
  (() => { const org = g.ev("tabsFor('01204199910016',TODAY).map(t=>t.k).join(',')");
    const grp = g.ev("tabsFor('ГР-001',TODAY).map(t=>t.k).join(',')");
    const ipNow = g.ev("tabsFor('04401199940041',TODAY).map(t=>t.k).join(',')");
    const ipThen = g.ev("tabsFor('04401199940041','01.06.2020').map(t=>t.k).join(',')");
    return org.includes('units') && !org.includes('ipreg') &&
           grp.includes('members') && !grp.includes('units') &&
           ipNow.includes('ipreg') && !ipNow.includes('bank') && ipThen.includes('bank'); })());
ok('4.11 карточка по псевдониму называет присоединение прямо (СБ-11)',
  (() => { g.ev("subject('S-DUP').aliasOf='07701199970071'");
    g.ev("location.hash='#/s/S-DUP'"); g.ev("route()");
    const t = g.$('#cardMount').textContent;
    g.ev("delete subject('S-DUP').aliasOf");
    return /присоединён/i.test(t) && t.includes('07701199970071'); })());
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 4.1–4.11 (`renderCard` пустой).

- [ ] **Step 3: Реализовать шапку и вкладки**

```js
/* ── КАРТОЧКА ── */
const TAB_DEFS = [
  { k:'main',    t:'Основное' },
  { k:'addr',    t:'Адреса' },
  { k:'ipreg',   t:'Регистрация ИП' },   /* только физлицо (СБ-3а) */
  { k:'bank',    t:'Банковские реквизиты' }, /* организация и физлицо в период ИП */
  { k:'units',   t:'Организационная структура' }, /* только организация */
  { k:'members', t:'Состав' },           /* только групповой заёмщик */
  { k:'docs',    t:'Документы' },
  { k:'links',   t:'Связи' },
  { k:'events',  t:'События' },
  { k:'roles',   t:'Роли' },
];
/* Состав вкладок — следствие типа лица НА ДАТУ (СБ-3): у бывшего ИП вкладка банковских
   реквизитов на сегодняшнюю дату не показывается, а на дату действия регистрации — да. */
function tabsFor(ref, date){
  const kind = personKindAt(ref, date);
  return TAB_DEFS.filter(t => {
    if (t.k === 'ipreg')   return kind === 'физ' || kind === 'ИП';
    if (t.k === 'bank')    return kind === 'юр' || kind === 'ИП';
    if (t.k === 'units')   return kind === 'юр';
    if (t.k === 'members') return kind === 'группа';
    return true;
  });
}
```

`renderCard(ref, tab)` собирает:

1. **Шапка** — наименование/ФИО, ключ с видом (`keyKind`), тип лица `personKindLabel(personKindAt(ref, VIEW_DATE))` с подписью «на <VIEW_DATE>», чипы ролей, строка стоп-фактора (если есть), строка импорта `#importBar` («Снимок ГРС · Тундук от 12.05.2026» + кнопка `#btnRefreshImport`) — **только если у записи есть `imported`** (у группы блока нет, СБ-5а). Если `s.aliasOf` — строка «Ключ <ключ> присоединён к <главный> <дата>» со ссылкой на главного.
2. **Полоса вкладок** из `tabsFor(ref, VIEW_DATE)`, активная — из `tab` или первая; переключение через `switchTab(key)` пишет `?tab=` в hash. Ключ активной вкладки читается из DOM, а не хранится:

```js
const activeTabKey = () => (document.querySelector('.tabbar .tab.active') || {dataset:{}}).dataset.tab || '';
```

3. **Панели** — в этой задаче наполняются `main` и `addr`, прочие рисуют `<div class="tabpanel" data-panel="<k>">` с заглушкой «— наполняется в следующей задаче» (снимается в Tasks 6–8).

Импортное поле — один общий рендер:

```js
/* Трёхсостоянное импортное поле (СБ-5). Инвариант 3: 'реестр' не редактируется нигде;
   руками заполняется только 'пусто'; наше значение всегда подписано автором и датой.
   Расхождение (pending) показывается выбором, а не молчаливой перезаписью — иначе
   дефект стенда P4-11 («форма не отличает „нет данных“ от „не пришло из реестра“»)
   переезжает в новую систему. */
const CURRENT_USER = 'Сламкулов А.О.';
function fieldRow(ref, name, label){
  const s = subject(resolveKey(ref)), f = (s.imported && s.imported.f && s.imported.f[name]) || { st:'пусто' };
  const head = '<div class="fld" data-field="' + esc(name) + '" data-state="' + esc(f.st) + '"><div class="fld-l">' + esc(label) + '</div><div class="fld-v">';
  if (f.st === 'реестр' && !f.pending)
    return head + esc(f.v) + ' <span class="hint">из реестра</span></div></div>';
  if (f.st === 'наше' && !f.pending)
    return head + esc(f.v) + ' <span class="hint">введено нами · ' + esc(f.by) + ' · ' + esc(f.at)
      + (f.doc ? ' · ' + esc(f.doc) : '') + '</span></div></div>';
  if (f.pending)
    return head + esc(f.v) + ' <span class="hint">введено нами · ' + esc(f.by) + ' · ' + esc(f.at) + '</span>'
      + '<div class="warn">Расхождение с реестром от ' + esc(f.pending.at) + ': «' + esc(f.pending.v) + '»'
      + ' <button class="btn btn-sm" data-choice="реестр" data-fname="' + esc(name) + '">взять из реестра</button>'
      + ' <button class="btn btn-secondary btn-sm" data-choice="наше" data-fname="' + esc(name) + '">оставить наше</button></div></div></div>';
  return head + '<span class="muted">не пришло из реестра</span> '
    + '<button class="btn btn-secondary btn-sm btn-fill" data-fname="' + esc(name) + '">Заполнить</button></div></div>';
}
function fillOwn(ref, name, value){
  const s = subject(resolveKey(ref));
  const f = s.imported.f[name] || (s.imported.f[name] = { st:'пусто' });
  if (f.st !== 'пусто') throw new Error('Заполнять руками можно только пустое поле (СБ-5, инвариант 3)');
  Object.assign(f, { st:'наше', v:value, by:CURRENT_USER, at:TODAY });
  renderCardInPlace(ref);
}
function resolveConflict(ref, name, choice){
  const f = subject(resolveKey(ref)).imported.f[name];
  if (!f || !f.pending) return;
  if (choice === 'реестр') Object.assign(f, { st:'реестр', v:f.pending.v, by:undefined, at:undefined });
  delete f.pending;
  renderCardInPlace(ref);
}
function renderCardInPlace(ref){
  document.getElementById('cardMount').innerHTML = renderCard(ref, activeTabKey());
  wireCard(ref);
}
```

Вкладка **«Основное»**: для организации — `fieldRow` по `nameFull`, `nameShort`, `regNo`, `regDate`, `okpo`, `activity`, `director`; для физлица — `fio`, `docKind`, `docNo`, `nationality`; далее «своё» (отрасль, район, примечание — обычные строки без импортного статуса). У группы вкладка целиком своя: наименование, область, район, примечание (СБ-5а).
Вкладка **«Адреса»**: `fieldRow` по `addr` и `soate` (у группы — свои поля), затем свои строки «Фактический адрес» и «Адрес переписки».
`wireCard(ref)` вешает делегированные обработчики на `.btn-fill` (открывает модалку ввода → `fillOwn`) и на `[data-choice]` (→ `resolveConflict`).

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `51 / 51 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): карточка — шапка, вкладки по типу на дату, трёхсостоянный импортный слой"
```

---

## Task 6: Вкладки «Связи», «Состав» и «Организационная структура» (СБ-7/СБ-8, инвариант 6)

**Files:**
- Modify: `mockups/subject/subject.html`
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `LINKS`, `UNITS`, `personKindAt`, `keysOf`, `subject`.
- Produces: `LINK_KINDS`, `linksOf(ref)`, `linkAllowed(kind, aRef, bRef)`, `addLink({kind,a,b,from,to,share,doc})`, `membersOf(groupRef)`, `renderLinksTab(ref)`, `renderMembersTab(ref)`, `renderUnitsTab(ref)`.

- [ ] **Step 1: Написать падающие тесты связей**

```js
// ── Связи и состав (Task 6) ──
ok('5.1 связь видна с обоих концов одной записью (инвариант 6)',
  (() => { const a = g.ev("linksOf('04401199940041').filter(l=>l.kind==='учредитель').length");
    const b = g.ev("linksOf('01204199910016').filter(l=>l.kind==='учредитель').length");
    return a === 1 && b === 1 && g.ev("LINKS.filter(l=>l.kind==='учредитель').length")===1; })());
ok('5.2 вкладка «Учредители» из онлайна поглощена связями (СБ-8) — отдельной вкладки нет',
  g.ev("TAB_DEFS.every(t=>!/учредител/i.test(t.t))"));
ok('5.3 повторная связь той же пары и вида отвергается (инвариант 6)',
  g.ev("(()=>{try{addLink({kind:'учредитель',a:'04401199940041',b:'01204199910016',from:'01.01.2026',doc:'X'});return false;}catch(e){return true;}})()"));
ok('5.4 ограничение по типу: учредитель — только к организации',
  g.ev("linkAllowed('учредитель','04401199940041','07701199970071')")===false &&
  g.ev("linkAllowed('учредитель','04401199940041','01204199910016')")===true);
ok('5.5 ограничение по типу: супруг — физлицо↔физлицо, член группы — физлицо↔группа',
  g.ev("linkAllowed('супруг','07701199970071','01204199910016')")===false &&
  g.ev("linkAllowed('член группы','07701199970071','ГР-001')")===true &&
  g.ev("linkAllowed('член группы','01204199910016','ГР-001')")===false);
ok('5.6 «Состав» группы — та же связь «член группы» с другого конца (СБ-7)',
  (() => { g.ev("location.hash='#/s/ГР-001?tab=members'"); g.ev("route()");
    const t = g.$('[data-panel="members"]').textContent;
    return g.ev("membersOf('ГР-001').length")===2 && /Мамбетов/.test(t) && /Асанов/.test(t); })());
ok('5.7 у связи обязательны период и документ-основание',
  g.ev("(()=>{try{addLink({kind:'аффилированность',a:'07701199970071',b:'01204199910016',from:'',doc:''});return false;}catch(e){return true;}})()"));
ok('5.8 «связанное лицо» ролью не является (СБ-7)',
  g.ev("subjectRoles('04401199940041').every(r=>r.role!=='Связанное лицо')"));
ok('5.9 оргструктура — своя вкладка только у организации (СБ-8)',
  (() => { g.ev("location.hash='#/s/01204199910016?tab=units'"); g.ev("route()");
    return /Производственный цех/.test(g.$('[data-panel="units"]').textContent); })());
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 5.1–5.9 (`linksOf is not defined`).

- [ ] **Step 3: Реализовать связи, состав и оргструктуру**

```js
/* ── СВЯЗИ ЛИЦ (СБ-7) ──
   Единственное, что заводится в модуле руками: источника снаружи у связей нет.
   Связь двусторонняя — ОДНА запись, видимая с обоих концов (инвариант 6). */
const LINK_KINDS = [
  { k:'учредитель',      a:['физ','ИП','юр'], b:['юр'],     share:true },
  { k:'руководитель',    a:['физ','ИП'],      b:['юр'],     share:false },
  { k:'супруг',          a:['физ','ИП'],      b:['физ','ИП'], share:false },
  { k:'член группы',     a:['физ','ИП'],      b:['группа'], share:false },
  { k:'аффилированность',a:['физ','ИП','юр'], b:['физ','ИП','юр'], share:false },
];
function linkAllowed(kind, aRef, bRef){
  const d = LINK_KINDS.find(x => x.k === kind);
  if (!d) return false;
  return d.a.includes(personKindAt(aRef, VIEW_DATE)) && d.b.includes(personKindAt(bRef, VIEW_DATE));
}
function linksOf(ref){
  const ks = keysOf(ref);
  return LINKS.filter(l => ks.includes(l.a) || ks.includes(l.b));
}
function addLink({ kind, a, b, from, to, share, doc }){
  if (!linkAllowed(kind, a, b)) throw new Error('Связь «' + kind + '» между этими типами лиц невозможна');
  if (!from || !doc) throw new Error('У связи обязательны период и документ-основание (СБ-7)');
  if (LINKS.some(l => l.kind === kind && ((l.a === a && l.b === b) || (l.a === b && l.b === a))))
    throw new Error('Такая связь уже есть — она одна на пару лиц и вид (инвариант 6)');
  const l = { id:'L-' + (LINKS.length + 1), kind, a, b, from, to:to || null, share:share || undefined, doc };
  LINKS.push(l);
  return l.id;
}
/* Состав группы — та же связь «член группы», показанная с другого конца (СБ-7):
   отдельного хранилища состава нет, иначе один факт жил бы в двух местах. */
function membersOf(groupRef){
  const ks = keysOf(groupRef);
  return LINKS.filter(l => l.kind === 'член группы' && ks.includes(l.b))
    .map(l => ({ link:l, s:subject(l.a) })).filter(x => x.s);
}
```

`renderLinksTab(ref)` — таблица «Вид · Вторая сторона (ссылка) · Период · Доля · Документ» с кнопкой «+ Связь» (форма в модалке: вид из `LINK_KINDS`, вторая сторона поиском по ключу, период, доля только для `share:true`, документ); в строке — сторона, противоположная открытому субъекту.
`renderMembersTab(ref)` — та же таблица по `membersOf`, шапка «Состав группы», кнопка «+ Член группы» вызывает `addLink({kind:'член группы', a:<ключ физлица>, b:<ключ группы>, …})`.
`renderUnitsTab(ref)` — таблица «Наименование · Примечание · Орг. отдел · ФИО сотрудника» по `UNITS`.

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `60 / 60 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): связи лиц, состав группы и оргструктура — учредители поглощены связями"
```

---

## Task 7: Вкладки «События» и «Регистрация ИП» — стоп-фактор и дата прекращения (СБ-3а/СБ-9/СБ-13, инвариант 7)

**Files:**
- Modify: `mockups/subject/subject.html`
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `SUBJECT_EVENTS`, `IP_REG`, `subjectEvents`, `stopFactors`, `personKindAt`, `CREDITS`/`PLEDGE_OBJ`/`SURETIES`/`PROCS` (только чтение).
- Produces: `EVENT_KINDS`, `addEvent({key,kind,date,basis,doc,successorKey})`, `addIpReg({key,no,from,doc})`, `renderEventsTab(ref)`, `renderIpRegTab(ref)`.

- [ ] **Step 1: Написать падающие тесты событий**

```js
// ── События, ИП, стоп-фактор (Task 7) ──
ok('6.1 событие «утрата статуса ИП» проставляет дату прекращения регистрации, а не тип (ADR-0018)',
  (() => { const reg = g.ev("IP_REG.find(r=>r.key==='04401199940041')");
    return g.ev("IP_REG.find(r=>r.key==='04401199940041').to")==='31.12.2025' &&
           g.ev("SUBJECTS.every(s=>!('personKind' in s))"); })());
ok('6.2 новая регистрация ИП после закрытой возвращает тип «ИП» на новые даты',
  (() => { g.ev("addIpReg({key:'04401199940041',no:'ИП-0044012',from:'01.02.2026',doc:'Патент 0044012'})");
    return g.ev("personKindAt('04401199940041','01.03.2026')")==='ИП' &&
           g.ev("personKindAt('04401199940041','01.06.2025')")==='физ' &&
           g.ev("IP_REG.filter(r=>r.key==='04401199940041').length")===2; })());
ok('6.3 событие «утрата статуса ИП» закрывает действующую регистрацию датой события',
  (() => { g.ev("addEvent({key:'04401199940041',kind:'утрата статуса ИП',date:'01.07.2026',basis:'Заявление',doc:'ЗП-119'})");
    return g.ev("IP_REG.find(r=>r.no==='ИП-0044012').to")==='01.07.2026' &&
           g.ev("personKindAt('04401199940041',TODAY)")==='физ'; })());
ok('6.4 инвариант 7: событие не трогает кредиты, обеспечение и взыскание',
  (() => { const snap = g.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])");
    g.ev("addEvent({key:'02201199920021',kind:'ликвидация',date:'01.07.2026',basis:'Решение суда',doc:'РС-88'})");
    return g.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])") === snap; })());
ok('6.5 СБ-13: стоп-фактор — зеркало события, отдельной точки ввода нет',
  g.ev("stopFactors('02201199920021').some(f=>/ликвидирован/i.test(f.text))") &&
  g.ev("typeof addStopFactor")==='undefined' && g.ev("typeof STOP_FACTORS")==='undefined');
ok('6.6 «утрата статуса ИП» стоп-фактором не является',
  g.ev("stopFactors('04401199940041').length")===0);
ok('6.7 стоп-фактор виден в шапке карточки и в реестре',
  (() => { g.ev("location.hash='#/s/02201199920021'"); g.ev("route()");
    const card = /ликвидирован/i.test(g.$('#cardMount').textContent);
    g.ev("location.hash=''"); g.ev("route()");
    return card && /ликвидирован/i.test(g.$('#listTable').textContent); })());
ok('6.8 реорганизация требует правопреемника, ликвидация — нет',
  g.ev("(()=>{try{addEvent({key:'01204199910016',kind:'реорганизация',date:'01.06.2026',basis:'Решение',doc:'Р-1'});return false;}catch(e){return true;}})()"));
ok('6.9 лента событий не удаляется — функции удаления нет (СБ-9)',
  g.ev("typeof removeEvent")==='undefined' && g.ev("typeof deleteEvent")==='undefined');
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 6.2–6.9 (`addIpReg is not defined`).

- [ ] **Step 3: Реализовать события и регистрацию ИП**

```js
/* ── СОБЫТИЯ СУБЪЕКТА (СБ-9) ──
   Событие — ЗАПИСЬ, а не статус: оно не гасит кредит и не прекращает поручительство —
   эти последствия принадлежат своим модулям (инвариант 7, ADR-0014). Единственное,
   что оно порождает здесь, — выводимый стоп-фактор (СБ-13). Лента append-only. */
const EVENT_KINDS = [
  { k:'реорганизация',      successor:true  },
  { k:'ликвидация',         successor:false },
  { k:'смерть',             successor:false },
  { k:'перевод долга',      successor:true  },
  { k:'утрата статуса ИП',  successor:false },
  { k:'роспуск группы',     successor:false },
];
function addEvent({ key, kind, date, basis, doc, successorKey }){
  const d = EVENT_KINDS.find(x => x.k === kind);
  if (!d) throw new Error('Неизвестное событие: ' + kind);
  if (!date || !basis || !doc) throw new Error('У события обязательны дата, основание и документ (СБ-9)');
  if (d.successor && !subject(successorKey)) throw new Error('Событие «' + kind + '» требует правопреемника');
  SUBJECT_EVENTS.push({ key, kind, date, basis, doc, successorKey: d.successor ? successorKey : undefined });
  /* Единственное исключение по форме (ADR-0018): утрата статуса ИП проставляет дату
     прекращения действующей регистрации. Тип лица при этом не переписывается — его
     по-прежнему считает personKindAt. */
  if (kind === 'утрата статуса ИП'){
    const reg = ipRegAt(key, date);
    if (reg) reg.to = date;
  }
}
/* Регистрация ИП (СБ-3а): у лица их может быть несколько — снялся, зарегистрировался снова.
   Пересекаться периоды не могут: два одновременных ИП у одного ПИНа не бывает. */
function addIpReg({ key, no, from, doc }){
  const s = subject(resolveKey(key));
  if (!s || s.source !== 'individuals') throw new Error('Регистрация ИП бывает только у физического лица');
  if (!no || !from || !doc) throw new Error('Обязательны рег. номер, дата начала и документ');
  if (ipRegAt(key, from)) throw new Error('На эту дату уже действует регистрация ИП');
  IP_REG.push({ key:resolveKey(key), no, from, to:null, doc });
}
```

`renderEventsTab(ref)` — лента «Дата · Событие · Основание · Документ · Правопреемник (ссылка)», сверху предупреждение «Событие ничего не меняет в кредите, обеспечении и взыскании — оно их не касается (СБ-9)», кнопка «+ Событие» (модалка: вид из `EVENT_KINDS`, дата, основание, документ, поле правопреемника показывается только при `successor:true`). Строки не удаляются — кнопки удаления нет.
`renderIpRegTab(ref)` — таблица «Рег. номер · С · По · Документ · Статус (действует/прекращена)», кнопка «+ Регистрация»; под таблицей — подпись «Тип лица на <VIEW_DATE>: <personKindLabel>» со ссылкой на ADR-0018 в тексте («правоспособность считается на дату»).
Шапка карточки и колонка «Событие» реестра уже читают `stopFactors` (Tasks 3/5) — отдельной точки ввода стоп-фактора нет нигде.

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `69 / 69 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): события субъекта, регистрация ИП и выводимый стоп-фактор"
```

---

## Task 8: Вкладки «Роли», «Документы», «Банковские реквизиты» (СБ-6, раздел 4, инварианты 5/8)

**Files:**
- Modify: `mockups/subject/subject.html`
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `subjectRoles`, `keysOf`, `DOCS`, `BANK_REQ`, `personKindAt`.
- Produces: `renderRolesTab(ref)`, `renderDocsTab(ref)`, `renderBankTab(ref)`, `addDoc({key,kind,about,date,file})`, `addBankReq({key,bank,bik,account,from})`.

- [ ] **Step 1: Написать падающие тесты**

```js
// ── Роли, документы, реквизиты (Task 8) ──
ok('7.1 вкладка ролей — таблица без создания и удаления (инвариант 5)',
  (() => { g.ev("location.hash='#/s/04401199940041?tab=roles'"); g.ev("route()");
    const p = g.$('[data-panel="roles"]');
    return /Поручитель/.test(p.textContent) && p.querySelectorAll('button').length === 0; })());
ok('7.2 у каждой роли назван объём и адрес продолжения в модуль (СБ-6)',
  (() => { const p = g.$('[data-panel="roles"]').textContent;
    return /договор/.test(p) && /модул/i.test(p); })());
ok('7.3 роли считаются по ключу и его псевдонимам (инвариант 8)',
  (() => { g.ev("subject('S-DUP').aliasOf='07701199970071'");
    const viaAlias = g.ev("subjectRoles('S-DUP').map(r=>r.role).join(',')");
    const viaMain  = g.ev("subjectRoles('07701199970071').map(r=>r.role).join(',')");
    g.ev("delete subject('S-DUP').aliasOf");
    return viaAlias === viaMain && viaAlias.length > 0; })());
ok('7.4 документы: вид · относительно · дата · файл',
  (() => { g.ev("location.hash='#/s/01204199910016?tab=docs'"); g.ev("route()");
    return /Устав/.test(g.$('[data-panel="docs"]').textContent); })());
ok('7.5 банковские реквизиты доступны организации и не показываются группе',
  g.ev("tabsFor('01204199910016',TODAY).some(t=>t.k==='bank')") &&
  g.ev("tabsFor('ГР-001',TODAY).every(t=>t.k!=='bank')"));
ok('7.6 у реквизита виден период действия',
  (() => { g.ev("location.hash='#/s/01204199910016?tab=bank'"); g.ev("route()");
    return /14\.02\.2011/.test(g.$('[data-panel="bank"]').textContent); })());
ok('7.7 денег карточка не показывает (раздел 8 спеки — задолженность у заёмщика)',
  !/задолженност|остаток долга|сом\b/i.test(g.$('#cardMount').textContent));
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 7.1–7.7 (панели-заглушки).

- [ ] **Step 3: Реализовать три вкладки**

```js
/* ── РОЛИ (СБ-6) ── выводятся, руками не задаются: ни «+», ни удаления на вкладке нет
   (инвариант 5). Считаются по ключу и всем псевдонимам (инвариант 8). */
function renderRolesTab(ref){
  const rows = subjectRoles(ref);
  if (!rows.length) return '<div class="empty">Ролей нет: лицо не участвует ни в одних кредитных отношениях.</div>';
  return '<table class="grid"><thead><tr><th>Роль</th><th>Основание</th><th>С даты</th><th>Где ведётся</th></tr></thead><tbody>'
    + rows.map(r => '<tr><td class="who">' + esc(r.role) + '</td><td>' + esc(r.basis) + '</td>'
        + '<td class="muted">' + esc(r.since) + '</td><td class="muted">' + esc(r.link) + '</td></tr>').join('')
    + '</tbody></table><div class="hint">Роль не заводится и не снимается — она есть ровно там, где лицо участвует.</div>';
}
function addDoc({ key, kind, about, date, file }){
  if (!kind || !date || !file) throw new Error('Обязательны вид документа, дата и файл');
  DOCS.push({ key:resolveKey(key), kind, about:about || '—', date, file });
}
function addBankReq({ key, bank, bik, account, from }){
  if (!bank || !bik || !account || !from) throw new Error('Обязательны банк, БИК, счёт и дата начала');
  BANK_REQ.push({ key:resolveKey(key), bank, bik, account, from, to:null, main:false });
}
```

`renderDocsTab(ref)` — таблица «Вид документа · Относительно · Дата · Файл» по `DOCS` для `keysOf(ref)`, кнопка «+ Документ».
`renderBankTab(ref)` — таблица «Банк · БИК · Расчётный счёт · Период · Основной» по `BANK_REQ`, кнопка «+ Реквизиты»; закрытый период подписывается «прекращены <дата>».

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `76 / 76 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): вкладки ролей, документов и банковских реквизитов"
```

---

## Task 9: Похожие записи, слияние с псевдонимом и отличие от реорганизации (СБ-10/11/12, инварианты 8/9/10)

**Files:**
- Modify: `mockups/subject/subject.html`
- Modify: `scripts/inspect/subject-check.mjs`

**Interfaces:**
- Consumes: `similarPairs`, `resolveKey`, `keysOf`, `subjectRoles`, `LINKS`/`DOCS`/`SUBJECT_EVENTS`/`BANK_REQ`/`IP_REG`/`UNITS`, зеркала (только чтение).
- Produces: `mergeDiff(aRef, bRef)`, `renderMerge(aRef, bRef)`, `doMerge(mainRef, joinRef, choices)`, `canDelete(ref)`, `deleteSubject(ref)`.

- [ ] **Step 1: Написать падающие тесты слияния**

```js
// ── Слияние (Task 9) ──
const m = mk();   // свежий DOM: слияние необратимо и мутирует набор
ok('8.1 экран сравнения открывается маршрутом и показывает расхождения поле-в-поле',
  (() => { m.ev("location.hash='#/merge/07701199970071/S-DUP'"); m.ev("route()");
    return m.$('#view-merge').classList.contains('active') &&
           m.ev("mergeDiff('07701199970071','S-DUP').length") > 0 &&
           m.$$('#mergeTable [data-pick]').length > 0; })());
ok('8.2 слияние требует подтверждения вводом ключа главной записи (СП-19)',
  m.ev("(()=>{try{doMerge('07701199970071','S-DUP',{confirm:'не тот ключ'});return false;}catch(e){return true;}})()"));
ok('8.3 после слияния присоединённый ключ становится псевдонимом и ведёт на главную (инвариант 8)',
  (() => { const before = m.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])");
    m.ev("doMerge('07701199970071','S-DUP',{confirm:'07701199970071'})");
    const after = m.ev("JSON.stringify([CREDITS,PLEDGE_OBJ,SURETIES,PROCS])");
    return m.ev("subject('S-DUP').aliasOf")==='07701199970071' &&
           m.ev("resolveKey('S-DUP')")==='07701199970071' &&
           before === after; })());   /* инвариант 9: чужое не переписано */
ok('8.4 маршрут по присоединённой записи не пропадает — открывается главная с оговоркой',
  (() => { m.ev("location.hash='#/s/S-DUP'"); m.ev("route()");
    return m.$('#view-card').classList.contains('active') && /присоединён/i.test(m.$('#cardMount').textContent); })());
ok('8.5 своё перенесено: документы, связи, события, реквизиты — на главном ключе',
  m.ev("DOCS.every(d=>d.key!=='S-DUP')") && m.ev("LINKS.every(l=>l.a!=='S-DUP'&&l.b!=='S-DUP')") &&
  m.ev("SUBJECT_EVENTS.every(e=>e.key!=='S-DUP')"));
ok('8.6 роли считаются по обоим ключам и не переносятся (они производные, СБ-6)',
  m.ev("subjectRoles('S-DUP').map(r=>r.role).join(',')") === m.ev("subjectRoles('07701199970071').map(r=>r.role).join(',')"));
ok('8.7 слияние необратимо — функции разделения нет',
  m.ev("typeof unmerge")==='undefined' && m.ev("typeof splitSubject")==='undefined');
ok('8.8 инвариант 10: слитая запись не удаляется никогда',
  m.ev("canDelete('S-DUP')")===false &&
  m.ev("(()=>{try{deleteSubject('S-DUP');return false;}catch(e){return true;}})()"));
ok('8.9 инвариант 10: удаление возможно только при нуле ссылок',
  m.ev("canDelete('01204199910016')")===false);
ok('8.10 СБ-12: реорганизация — событие, а не слияние; обе записи остаются живыми',
  (() => { const n0 = m.ev("SUBJECTS.filter(s=>!s.aliasOf).length");
    m.ev("addEvent({key:'01204199910016',kind:'реорганизация',date:'01.06.2026',basis:'Решение собрания',doc:'РС-90',successorKey:'02201199920021'})");
    return m.ev("SUBJECTS.filter(s=>!s.aliasOf).length") === n0 &&
           !m.ev("subject('01204199910016').aliasOf"); })());
ok('8.11 экран слияния называет отличие от реорганизации словами (СБ-12)',
  (() => { m.ev("location.hash='#/merge/01204199910016/02201199920021'"); m.ev("route()");
    return /реорганизац/i.test(m.$('#mergeMount').textContent); })());
ok('8.12 разрез «похожие записи» в реестре даёт ссылку на сравнение',
  (() => { m.ev("location.hash=''"); m.ev("FILTER.similar=true"); m.ev("applyFilters()");
    return m.$$('#listTable a[href^="#/merge/"]').length > 0; })());
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/subject-check.mjs`
Expected: FAIL на 8.1–8.12 (`mergeDiff is not defined`).

- [ ] **Step 3: Реализовать слияние**

```js
/* ── СЛИЯНИЕ (СБ-11, ADR-0019) ──
   Переносится ТОЛЬКО СВОЁ: документы, связи, события, адреса, реквизиты, регистрации ИП.
   Чужие ссылки (кредиты, залог, поручительство, дела) не переписываются — модуль субъектов
   не пишет ни в один чужой модуль (инвариант 9, ADR-0014). Присоединённый ключ становится
   псевдонимом: из маршрутов не исчезает и при чтении разрешается в главного (инвариант 8).
   Роли не переносятся и не пересчитываются — они производные (СБ-6) и считаются по обоим ключам.
   Слияние ≠ реорганизация (СБ-12): здесь ДВЕ записи об ОДНОМ лице, там ДВА живых лица. */
const MERGE_FIELDS = [
  ['fio','ФИО'], ['nameFull','Полное наименование'], ['nameShort','Краткое наименование'],
  ['docKind','Вид документа'], ['docNo','Номер документа'], ['nationality','Национальность'],
  ['regNo','Рег. номер'], ['regDate','Дата регистрации'], ['okpo','ОКПО'],
  ['soate','СОАТЕ'], ['addr','Адрес'], ['director','Директор'], ['activity','Вид деятельности'],
];
const fval = (s, n) => ((s.imported && s.imported.f && s.imported.f[n] && s.imported.f[n].v) || '');
function mergeDiff(aRef, bRef){
  const a = subject(aRef), b = subject(bRef);
  return MERGE_FIELDS.map(([n, label]) => ({ name:n, label, a:fval(a, n), b:fval(b, n) }))
    .filter(r => r.a || r.b)
    .map(r => ({ ...r, differs: r.a !== r.b }));
}
const OWN_ARRAYS = [
  [() => DOCS, 'key'], [() => SUBJECT_EVENTS, 'key'], [() => BANK_REQ, 'key'],
  [() => IP_REG, 'key'], [() => UNITS, 'key'],
];
function doMerge(mainRef, joinRef, choices){
  const main = subject(mainRef), join = subject(joinRef);
  if (!main || !join || main === join) throw new Error('Нужны две разные записи');
  if (!choices || choices.confirm !== subjectRef(main))
    throw new Error('Подтвердите слияние вводом ключа главной записи: ' + subjectRef(main));
  /* выбранные значения по расхождениям — только в СВОЙ импортный слой главной записи */
  mergeDiff(mainRef, joinRef).forEach(r => {
    if (choices[r.name] === 'b' && main.imported)
      main.imported.f[r.name] = Object.assign({}, join.imported.f[r.name]);
  });
  OWN_ARRAYS.forEach(([get, f]) => get().forEach(x => { if (x[f] === subjectRef(join)) x[f] = subjectRef(main); }));
  LINKS.forEach(l => { if (l.a === subjectRef(join)) l.a = subjectRef(main);
                       if (l.b === subjectRef(join)) l.b = subjectRef(main); });
  join.aliasOf = subjectRef(main);
  join.mergedAt = TODAY;
  /* CREDITS/PLEDGE_OBJ/SURETIES/PROCS не трогаются намеренно — см. шапку блока. */
}
/* Удаление (инвариант 10): только при нуле ссылок; слитая запись не удаляется никогда. */
function canDelete(ref){
  const s = subject(ref);
  if (!s || s.aliasOf) return false;
  const ks = keysOf(ref);
  const used = CREDITS.some(c => ks.includes(c.key)) || PLEDGE_OBJ.some(o => ks.includes(o.pledgerKey))
    || SURETIES.some(x => ks.includes(x.guarantorKey)) || PROCS.some(p => ks.includes(p.debtorKey))
    || LINKS.some(l => ks.includes(l.a) || ks.includes(l.b)) || SUBJECT_EVENTS.some(e => ks.includes(e.key));
  return !used;
}
function deleteSubject(ref){
  if (!canDelete(ref)) throw new Error('Удалить нельзя: на запись есть ссылки либо она присоединена слиянием');
  SUBJECTS.splice(SUBJECTS.findIndex(s => subjectRef(s) === ref), 1);
}
```

`renderMerge(aRef, bRef)` рисует: заголовок «Сравнение перед слиянием», предупреждение-врезку «Слияние — учётное действие: две записи об одном лице. Если лиц действительно два и между ними правопреемство — это **реорганизация**, событие на вкладке «События» (СБ-12)», выбор главной записи (радио), таблицу `#mergeTable` «Поле · Запись A · Запись B» с кнопками `[data-pick]` на расхождениях, блок «Что переносится / что остаётся» (своё переносится, ссылки кредитов/залога/поручительства/дел остаются, ключ становится псевдонимом), поле подтверждения ключом и кнопку «Слить». В реестре в разрезе «похожие записи» строка получает ссылку `#/merge/<a>/<b>`.

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/subject-check.mjs`
Expected: `88 / 88 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/subject/subject.html scripts/inspect/subject-check.mjs
git commit -m "feat(subject): слияние с псевдонимом ключа, разрез дублей и граница с реорганизацией"
```

---

## Task 10: Схлопывание `view-subject` в макете заёмщика (СБ-14, раздел 7)

**Files:**
- Modify: `mockups/borrower/borrower.html:1201-1205` (разметка вида), `:7150-7260` (`renderSubject`), `:7317-7322` (`showSubject`), `:7363` (`writeHash`), `:7385-7390` (`route`), плюс ссылки `#/s/…` на строках 5174, 5360, 5409, 5906, 5964, 7022
- Modify: `scripts/inspect/borrower-check.mjs`
- Modify: `mockups/borrower/ASUBK-status-razrabotki.md`

**Interfaces:**
- Consumes: `SUBJECTS` (остаётся зеркалом), `personKindLabel`, `esc`.
- Produces: `subjectMirrorRow(inn)` — строка-зеркало в карточке заёмщика; вид `view-subject`, функции `renderSubject`, `showSubject` и переменная `currentSubj` удаляются.

- [ ] **Step 1: Написать падающие тесты правки заёмщика**

Дописать в `scripts/inspect/borrower-check.mjs` перед итоговой печатью:

```js
// ── СБ-14: вид субъекта схлопнут, владелец — mockups/subject/subject.html ──
ok('СБ-14.1 вида view-subject и renderSubject в макете заёмщика больше нет',
  !g.$('#view-subject') && g.ev("typeof renderSubject")==='undefined' && g.ev("typeof showSubject")==='undefined');
ok('СБ-14.2 карточка заёмщика показывает строку-зеркало субъекта: ключ, тип лица, наименование',
  (() => { g.ev("location.hash='#/b/01204199910016'"); g.ev("route()");
    const t = g.$('#cardMount').textContent;
    return t.includes('01204199910016') && t.includes('Юр. лицо') && /АгроТехСервис/.test(t); })());
ok('СБ-14.3 из карточки есть внешняя ссылка «Открыть субъекта» в макет субъекта',
  !!g.$('a[href*="../subject/subject.html"]'));
ok('СБ-14.4 маршрут #/s/ в макете заёмщика больше не заявлен',
  g.ev("(()=>{location.hash='#/s/01204199910016';route();return document.getElementById('view-list').classList.contains('active')||document.getElementById('view-detail').classList.contains('active');})()"));
ok('СБ-14.5 ГЗПМ (группа совместного риска, КЗ-39) не тронут — это не лицо (СБ-4)',
  g.ev("Array.isArray(GROUPS) && GROUPS.length > 0"));
ok('СБ-14.6 SUBJECTS остаётся зеркалом и данные не потеряны (ADR-0014)',
  g.ev("SUBJECTS.length") >= 30);
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/borrower-check.mjs`
Expected: FAIL на СБ-14.1–СБ-14.4 (вид и функции ещё на месте).

- [ ] **Step 3: Схлопнуть вид**

1. Удалить разметку `<div class="view" id="view-subject">…</div>` (строки 1201–1205).
2. Удалить функцию `renderSubject` целиком (от комментария `/* ---------- Субъект (#/s/<ИНН>) … */` до её закрывающей скобки), функцию `showSubject`, переменные `vSubject`, `currentSubj`; из `showOnly` убрать `vSubject`; из `showList`/`showDetail` — присваивания `currentSubj`; из `writeHash` — ветку `if (currentSubj)`; из `route` — ветку `#/s/`; обработчик `#backLink` упростить до `location.hash = ''`.
3. Функции, которые останутся без вызывающих (`subjectRoles`, `requisitesTab(inn,{owner:true})` в режиме владельца) — удалить, если они больше нигде не используются; проверить `grep -n "subjectRoles\|requisitesTab" mockups/borrower/borrower.html` перед удалением.
4. Все ссылки `href="#/s/<ИНН>"` (строки 5174, 5360, 5409, 5906, 5964, 7022) заменить на внешнюю ссылку в новый макет:

```js
/* СБ-14: владелец страницы субъекта — mockups/subject/subject.html. Два макета,
   по-разному описывающих одно лицо, читаются как две модели, и неизвестно, какая главная.
   Здесь остаётся зеркало (ADR-0014): ключ, тип лица, наименование — и выход наружу. */
const subjectLink = (inn, text) =>
  '<a class="lnk" href="../subject/subject.html#/s/' + esc(inn) + '" target="_blank" rel="noopener">'
  + esc(text || inn) + ' ↗</a>';
function subjectMirrorRow(inn){
  const s = SUBJECTS.find(x => x.inn === inn);
  if (!s) return '';
  return '<div class="id-bar"><div class="id-main">'
    + '<span class="who">' + esc(s.name) + '</span> · '
    + '<span class="muted">' + esc(inn) + ' · ' + esc(personKindLabel(s.personKind))
    + ' <span class="hint">на ' + esc(asOf()) + '</span></span> · '
    + subjectLink(inn, 'Открыть субъекта') + '</div></div>';
}
```

Вставить `subjectMirrorRow(inn)` в шапку карточки заёмщика (в `renderCard`, рядом с существующим `idBar`), а прежнюю ссылку «править у субъекта» (строка 5964) заменить на `subjectLink(inn, 'править у субъекта')`.

- [ ] **Step 4: Прогнать оба смоука**

Run: `node scripts/inspect/borrower-check.mjs` → все прежние тесты + СБ-14.1–6 PASS (число тестов ≥ 309 + 6; ожидаемо отвалятся тесты, проверявшие страницу субъекта, — их удалить, а не ослабить: экрана больше нет).
Run: `node scripts/inspect/subject-check.mjs` → без изменений PASS.

- [ ] **Step 5: Записать правку в журнал заёмщика**

В `mockups/borrower/ASUBK-status-razrabotki.md`, в таблицу решений карточки, дописать строку:

```markdown
| СБ-14 | Страница субъекта схлопнута до строки-зеркала: владелец — `mockups/subject/subject.html`, отсюда только ключ, тип лица, наименование и ссылка «Открыть субъекта ↗» | ✅ 29.07.2026 |
```

- [ ] **Step 6: Коммит**

```bash
git add mockups/borrower/borrower.html scripts/inspect/borrower-check.mjs mockups/borrower/ASUBK-status-razrabotki.md
git commit -m "refactor(borrower): страница субъекта схлопнута до зеркала — владелец теперь макет субъекта"
```

---

## Task 11: Тонкая спека и журнал разработки макета (DoD 2, 3)

**Files:**
- Create: `mockups/subject/ASUBK-subekt-logika.md`
- Create: `mockups/subject/ASUBK-status-razrabotki.md`

**Interfaces:**
- Consumes: код `subject.html` (имена функций и инварианты), решения СБ-1…СБ-14, ADR-0018/0019.
- Produces: два документа; на них ссылается шапка `subject.html` (уже вписана в Task 1).

- [ ] **Step 1: Написать `ASUBK-subekt-logika.md`**

Только невосстановимое из кода знание (СП-21) — четыре раздела, каждый отвечает «почему», а не «как»:

1. **Ключ субъекта и псевдоним** — почему идентификатор один и почему он не называется ИНН (групповой заёмщик), что происходит с ключом при слиянии и почему чужие ссылки не переписываются. Ссылка: ADR-0019.
2. **Тип лица считается на дату** — ИП есть период регистрации; почему хранимый тип врёт задним числом и ломает контур банкротства. Ссылка: ADR-0018, ADR-0017.
3. **Импортный слой трёхсостоянный** — владелец данных снаружи, но директор из устава нужен уже сегодня; почему «нет данных» и «не пришло из реестра» — разные состояния (дефект стенда P4-11).
4. **Слияние ≠ реорганизация** — учётное действие против юридического факта; что теряется при смешении.

Плюс короткий раздел «Границы» — перенести из §8 спеки (интеграция, контрольный разряд ИНН, скоринг, деньги, права доступа, остаток ОВ-20).

- [ ] **Step 2: Написать `ASUBK-status-razrabotki.md`**

По образцу `mockups/borrower/ASUBK-status-razrabotki.md`:

- шапка: что за файл, чем проверяется (`node scripts/inspect/subject-check.mjs`), где язык (`CONTEXT.md`), где правило значений (ADR-0001);
- раздел «Нумерация»: `СБ-*` — решения этой волны; `Б-*` — дефекты **макета** (в `qa-findings.md` не идут); дефекты **стенда** — `P4-06…P4-12` в `notes/qa-findings.md`;
- таблица «Решения» со всеми СБ-1…СБ-14 и статусом ✅ + одной строкой, где именно решение живёт в коде (функция или блок);
- таблица «Инварианты 1–10 → тест смоука» (номер инварианта → номер теста, например «инвариант 4 → 1.4, 1.6, 2.3, 4.2»);
- раздел «Что макет не делает» — ссылкой на §8 спеки, без пересказа;
- раздел «Открытые вопросы»: остаток ОВ-20; как показывать похожие записи, когда их сотни (в макете разрез плоский).

- [ ] **Step 3: Проверить ссылки**

Run: `grep -o 'docs/[a-z0-9/-]*\.md\|mockups/[a-z0-9/-]*\.\(md\|html\)\|scripts/[a-z0-9/.-]*' mockups/subject/*.md | sort -u | cut -d: -f2 | xargs -I{} sh -c 'test -e {} || echo MISSING {}'`
Expected: пусто.

- [ ] **Step 4: Коммит**

```bash
git add mockups/subject/ASUBK-subekt-logika.md mockups/subject/ASUBK-status-razrabotki.md
git commit -m "docs(subject): тонкая спека модуля и журнал разработки макета"
```

---

## Task 12: Дефекты стенда и рекомендации в трекеры (DoD 5)

**Files:**
- Modify: `notes/qa-findings.md` (секция `## Phase 4 — Borrower (Заёмщик)`, после `P4-05`)
- Modify: `TODO.md` (секция `### Заёмщик (целевая модель)`, после `P4-R25`)

**Interfaces:**
- Consumes: §1.4 спеки (семь дефектов), §1.1–1.2 (наблюдения стенда), `scripts/inspect/subject-registries.mjs` (доказательство).
- Produces: `P4-06…P4-12` в `qa-findings.md`; `P4-R26…P4-R28` в `TODO.md`.

- [ ] **Step 1: Занести семь дефектов**

В `notes/qa-findings.md` после `P4-05`, формат — как у соседей (**ID** — маршрут — severity — дата проверки; Issue / Expected / Actual):

| ID | Экран | Severity | Суть (§1.4) |
|---|---|---|---|
| P4-06 | `/organizations` редактор | 🟠 major | две колонки/поля «Краткое наименование», одно держит полное — метка потеряна при вёрстке |
| P4-07 | `/individuals`, `/organizations` | 🟡 minor | у поля «Адрес» нет `label` — поле не опознаётся скринридером |
| P4-08 | `/individuals`, `/organizations` | 🟠 major | «Изменить» открывает форму с `?mode=readonly` — кнопка есть, правки нет |
| P4-09 | `/individuals` | 🟠 major | строки с ИНН и пустым ФИО — импорт прошёл наполовину, запись осталась |
| P4-10 | `/individuals`, `/organizations` | 🟠 major | своих фильтров нет, только Jmix-конструктор «Добавить условие поиска» |
| P4-11 | `/organizations` редактор | 🟡 minor | СОАТЕ, директор, вид деятельности и обе даты пусты; форма не отличает «нет данных» от «не пришло из реестра» |
| P4-12 | `/individuals` | 🟡 minor | даты рождения нет ни в реестре, ни в карточке — тёзок с пустым ИНН различить нечем |

Каждый заканчивается строкой доказательства: `_verified 2026-07-29, `scripts/inspect/subject-registries.mjs`, скриншоты `.auth/subject-*.png`_`.

- [ ] **Step 2: Занести три рекомендации**

В `TODO.md`, в конец секции `### Заёмщик (целевая модель)` (после `P4-R25`), в стиле соседних задач (чекбокс, ID, приоритет-чип, вложенные пункты «сейчас / надо / почему»):

- `P4-R26` 🟠 **Панель фильтров в реестрах лиц** — закрывает `P4-10`: тип лица (считанный на дату), область → район каскадом, роль, «есть событие», разрез «похожие записи»; Jmix-конструктор остаётся как продвинутый режим, а не единственный. Эталон — `mockups/subject/subject.html` (реестр).
- `P4-R27` 🟡 **Дата рождения физического лица** — закрывает `P4-12`: поле в карточке и колонка в реестре; без неё дубли без ИНН неразличимы, а поиск тёзок даёт ложные пары (СБ-10).
- `P4-R28` 🟠 **Различать «нет данных» и «не пришло из реестра»** — закрывает `P4-11` и `P4-08`: три состояния импортного поля (пришло / введено нами с подписью автора и даты / пусто), правка разрешена только пустому, расхождение с пришедшим позже значением показывается выбором, а не молчаливой перезаписью. Эталон — `fieldRow`/`fillOwn`/`resolveConflict` в `mockups/subject/subject.html`.

- [ ] **Step 3: Проверить синк**

Правка `TODO.md` через Claude Code запускает `PostToolUse`-хук `scripts/todo_hook.py` — синк в Google Sheet произойдёт сам. Если файл правился внешним редактором, выполнить вручную:

Run: `python3 scripts/sync_todos.py --dry-run`
Expected: в предпросмотре видны строки `P4-R26`, `P4-R27`, `P4-R28`; ошибок нет.

- [ ] **Step 4: Коммит**

```bash
git add notes/qa-findings.md TODO.md
git commit -m "docs(qa): дефекты реестров лиц P4-06…P4-12 и рекомендации P4-R26…P4-R28"
```

---

## Готовность плана к сдаче

После Task 12 проверить DoD спеки целиком:

- [ ] `node scripts/inspect/subject-check.mjs` → 88+ PASS, 0 FAIL (DoD 1)
- [ ] `node scripts/inspect/borrower-check.mjs` → 0 FAIL (DoD 4)
- [ ] Каждое СБ-1…СБ-14 имеет строку в `mockups/subject/ASUBK-status-razrabotki.md` со статусом (DoD 2)
- [ ] `mockups/subject/ASUBK-subekt-logika.md` не пересказывает код — только «почему» (DoD 3)
- [ ] Семь дефектов в `notes/qa-findings.md`, три рекомендации в `TODO.md` (DoD 5)
- [ ] `CONTEXT.md` содержит восемь терминов — внесено 29.07.2026 при разборе спеки (DoD 6, уже выполнено)
- [ ] Открыть `mockups/subject/subject.html` в браузере и пройти руками: реестр → фильтр по типу → карточка организации → вкладка «Связи» → карточка группы → «Состав» → карточка бывшего ИП со срезом `?on=2020-06-01` → разрез «похожие записи» → сравнение → слияние → маршрут по псевдониму
