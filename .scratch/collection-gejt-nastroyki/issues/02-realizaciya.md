Type: task
Status: in progress
Blocked by: —

## Plan

1. **Шапка файла** (:32-35) — поправить строку про «Таймлайн рисует контур текущей фазы»
   (уже неверно с 5б-i).
2. **Переместить `ESCALATION_LEVEL`/`PRECONDITIONS`** — литералы данных наверх, перед блоком
   `RULES_DEFAULTS` (сегодня они позже него, `RULES_DEFAULTS.preconditions` не может
   ссылаться вперёд на ещё не объявленный `const`). Функции (`preconditionReason`,
   `basisLiveFor`) остаются на месте, разница только в порядке двух литералов данных.
3. **`RULES_DEFAULTS`/`RULES`** — убрать `sectionClevel`/`contourPhases`, добавить
   `preconditions: deepClone(PRECONDITIONS)`.
4. **`phasesOf`** — упростить до `c => (CONTOURS[c] ? CONTOURS[c].phases : [])`, без чтения
   `RULES.contourPhases`. Комментарий у `contourOf`/`CONTOUR_LEVEL` поправить — не «гейт
   последовательности», а «legacy-данные, физически оставлены под будущее».
5. **`preconditionReason`** — `PRECONDITIONS[kind]` → `RULES.preconditions[kind]`.
6. **`mergeRules`/`restoreRules`** — снять слияние `sectionClevel`/`contourPhases`, завести
   слияние `preconditions` (валидатор на четыре поля отдельно, невалидные — отбрасываются
   молча, а не рушат всю запись вида). `RULES_SCHEMA` 2 → 3.
7. **Экран `#settings`** — снять вкладку «Стадии» целиком (`renderSettingsStage`,
   `CLEVEL_STEPS`, `clevelLabel`, `setSectionClevel`, `openAtLevel`, ключ `stage` из
   `SETTINGS_TABS`/`SETTINGS_TAB_SECTIONS`/`RULES_SECTION_LABEL`). Снять
   `renderSettingsPhases`/`movePhase`-как-перестановку, ключ `phases` → переименовать в
   `preconditions` и отдать новому рендеру. `reqsInContour` уходит вместе (последний
   потребитель).
8. **Новый `renderSettingsPreconditions`** — таблица по всем 59 видам:
   - вид с записью (`RULES.preconditions[k]`) — контролы по форме (`requiredPhase`: select
     среди `Object.keys(ESCALATION_LEVEL)`; `minLevel`: select 0…4 с метками-ступенями;
     `basis`: чекбокс; `blockIfPhaseIn`: чекбоксы среди тех же 16 фаз) плюс радиус
     (`allReqs().filter(r=>preconditionReason(r,k)).length`);
   - вид без записи, не «внешний акт» (4 шт.) — строка «без предусловия»;
   - вид «внешний акт» (25 шт.) — строка «входящий документ — предусловия не применяются
     (§3.4)», без контролов.
   Кнопки правки — `editPrecondition*`, каждая пишет через `editRule('preconditions', kind,
   next, what)`; сброс построчный — существующий `resetRuleKey('preconditions', kind, …)`.
9. **Регрессия** — throwaway jsdom-смоук: `preconditionReason` на всей затравке ДО и ПОСЛЕ
   правки (миграция данных не должна менять ни одного исхода по умолчанию); restoreRules
   круглый рейс (persist → restore на новом RULES_SCHEMA); пара живых правок через новые
   функции меняют `preconditionReason` предсказуемо; экран рендерится, 0 ошибок консоли.

## Answer

Реализовано по плану, один пункт скорректирован по ходу и один реальный дефект найден
регрессионным смоуком (тот же приём, что в 5а/5б-i — throwaway jsdom, реальная затравка).

**Данные.** `ESCALATION_LEVEL`/`PRECONDITIONS` переехали наверх, перед `RULES_DEFAULTS`
(были после — `RULES_DEFAULTS.preconditions` не мог ссылаться вперёд на необъявленный
`const`). `RULES_DEFAULTS`/`RULES` лишились `sectionClevel`/`contourPhases`, получили
`preconditions: deepClone(PRECONDITIONS)`. `phasesOf` упрощён до прямого чтения
`CONTOURS[c].phases` (без слоя `RULES.contourPhases`); `CONTOURS`/`CONTOUR_LEVEL`/
`contourOf`/`contourOfPhase` оставлены физически (декision 2), но полностью без
потребителей нигде в коде — три места с устаревшими комментариями поправлены (шапка
файла :32-35, орфанный блок «ГЕЙТ ПОСЛЕДОВАТЕЛЬНОСТИ» над `CONTOUR_LEVEL`, комментарий у
`phasesOf`/`contourOf`). `preconditionReason` переключён на `RULES.preconditions[kind]`.
`RULES_SCHEMA` 2 → 3 (снятие двух ключей, добавление одного — старые сохранённые правила
обязаны сброситься, не догадываться, тот же принцип, что уже был в файле).

**mergeRules.** Новый валидатор `preconditions` — в отличие от `gates` (правится только
поле-выключатель), здесь все четыре поля независимы (decision 4): каждое валидируется
само по себе, негодное отбрасывается молча, годные остаются. Пустая запись `{}` —
легитимный результат (администратор снял все требования вида) и `preconditionReason` уже
воспринимает её как «требуемого нет», без отдельной ветки.

**Экран.** `SETTINGS_TABS` — три вкладки (В-9 «Кому» / Гейты / Предусловия), «Стадии»
снята целиком (`renderSettingsStage`, `CLEVEL_STEPS`, `clevelLabel`, `setSectionClevel`,
`openAtLevel`). Старая «Предусловия»-как-перестановка (`renderSettingsPhases`,
`movePhase`, `reqsInContour`) тоже снята. Фильтр по разделу, раньше отключавшийся на
вкладке фаз (`setToolbarFor`), теперь просто всегда включён — фильтровать по разделу
осмысленно и для гейтов, и для предусловий, отдельная функция стала не нужна.

Новая `renderSettingsPreconditions` показывает все 59 видов (decision 5): 25 «внешний
акт» — информационная строка «предусловия не применяются, §3.4»; 4 внутренних без записи
— «без предусловия»; 30 с записью — контролы. Механизм-тип (фаза/порог/факт) берётся из
`RULES_DEFAULTS`, не из текущего значения — он не плавает от правки, значение внутри него
правится. `blockIfPhaseIn` — чекбоксы по всем 16 фазам `PHASE_UNIVERSE`, не
`<select multiple>`: мульти-select без Ctrl/Cmd снимает остальные выделения при клике —
неверная модель для независимого вкл/выкл одной фазы, поймано ДО реализации, не после
(в отличие от находки ниже).

**Радиус.** `preconditionHolds(kind)` — прямой счёт `allReqs().filter(r=>
preconditionReason(r,kind)).length`, без снятия/возврата флага, которым пользуется
`gateWouldHold`: у предусловия нет выключателя целиком (decision 6), контрфактика нужна
только на уровне ОДНОГО правки поля — `withPrecondition` временно подставляет НОВОЕ
значение, считает, возвращает старое, и в этом виде используется всеми четырьмя
`editPrecondition*`-функциями для «держит N → M» в тосте и журнале.

**Реальный дефект, найден смоуком (не в исходном плане тикета).** Валидатор
`blockIfPhaseIn` в `mergeRules` изначально нормализовал массив через `uniq()` — общий
хелпер, которым файл дедуплицирует много где ещё. Оказалось, `uniq` не просто убирает
дубли — она ЕЩЁ И СОРТИРУЕТ по алфавиту (`русская локаль`, см. её определение).
Функционально `preconditionReason` от этого не пострадал бы (`.includes(cur)` порядка не
видит), но `isChanged`/`sameRule` сравнивают JSON.stringify — переставленный местами
массив после ЛЮБОГО `restoreRules()` (то есть после любой перезагрузки страницы) стал бы
самопроизвольно считаться «изменённым» против дефолта у всех 4 кindов бакета B, даже без
единой правки администратора: ложный бейдж «изменено», ложная кнопка «вернуть дефолт» на
чистой установке. Регрессионный тест поймал это на прямом сравнении RULES.preconditions
до/после persistRules→restoreRules цикла. Исправлено: валидатор нормализует через
`PHASE_UNIVERSE.filter(...)` (канонический порядок, совпадающий и с исходным литералом
`PRECONDITIONS`, и с тем, что производит `togglePreconditionBlock`), не через `uniq`.

**Смоук (throwaway, `.mjs`, удалён после прогона)** — 22 проверки, все зелёные:
59 видов в справочнике · `RULES.preconditions` дефолтно deep-equal сеятелю `PRECONDITIONS`
· `ESCALATION_LEVEL` 16 фаз · `preconditionReason` совпадает со старым алгоритмом (читает
`PRECONDITIONS`/`ESCALATION_LEVEL` напрямую) на ВСЕЙ реальной затравке × всех 59 видах, 0
расхождений · restoreRules-роундтрип дефолтов (после починки бага выше) · admin-роль
распознаётся · все четыре `editPrecondition*` реально меняют значение и корректно
откатываются `resetRuleKey` (для requiredPhase/minLevel) или ролбэком (для basis/
blockIfPhaseIn, протестировано двойным вызовом) · все три вкладки `#settings` рендерятся
без исключений · `phasesOf('К1')` по-прежнему возвращает три фазы контура (гейт `gateBlocked`
цел) · `gateBlocked` вызывается на выборке без ошибок · старый `RULES_SCHEMA=2` блок
запускает путь полного сброса, не падение · `renderList()` рендерится после всех правок и
откатов · 0 ошибок консоли · 0 page-ошибок jsdom. Полный `collection-check.mjs`/
`collection-data-audit.mjs`/`collection-seed-coverage.mjs` — в резерве на конец волны
(наряд §30), не гонялся здесь, как и в 5а/5б-i.

**Готово, когда:** ✅ три вкладки на #settings, «Стадии» снята, «Предусловия» — настоящий
редактор записи вида · ✅ `PRECONDITIONS` живёт в `RULES.preconditions`, правится с журналом
и построчным/вкладочным сбросом · ✅ `CONTOURS`/`CONTOUR_LEVEL`/`contourOf`/`phasesOf`
упрощены и не читают более несуществующий `RULES.contourPhases` · ✅ регрессия на реальной
затравке — 0 расхождений с поведением до миграции · ✅ найденный по ходу баг с сортировкой
`blockIfPhaseIn` исправлен и задокументирован, не просто обойдён.
