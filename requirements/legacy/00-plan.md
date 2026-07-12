# Обзор СТАРОЙ системы (legacy) — план и карта навигации

> **Что это.** Детальный разбор действующей **старой** системы ФКФ/АСУБК по адресу
> `http://85.113.29.29:8080/`. Цель — зафиксировать каждый экран, каждое поле,
> каждую кнопку и каждую ссылку, чтобы при генерации мокапов **новой** системы
> ничего не потерять и иметь базу для сравнения «было → стало».
>
> **Это НЕ та система, что в `CLAUDE.md`.** `CLAUDE.md` описывает целевое
> Jmix/Vaadin-приложение на `fkftest.okmot.kg`. Здесь — предшественник (legacy),
> другой стек, другой хост.
>
> **Доступ.** Браузер уже авторизован (пользователь: Сламкулов Азамат
> Омургазиевич, `/user/1/details`). Хост: `85.113.29.29:8080`.
>
> **Метод.** Для каждого экрана фиксируем: назначение · отображаемые поля/колонки ·
> каждую кнопку (что делает, что появляется при нажатии) · каждую ссылку (куда ведёт).
> Скрины по возможности в `screenshots/legacy/<phase>/`.

---

## Статус фаз

**Скоуп согласован с заказчиком 2026-07-12.** Смотрим только бизнес-ядро +
выбранные словари/показатели. Технику и часть модулей — пропускаем.

| Фаза | Модуль | Статус | Документ |
|------|--------|--------|----------|
| P0 | Карта навигации (шапка, 2 меню, футер) | ✅ | этот файл |
| P1 | Заёмщики — список + карточка (5 вкладок) | ✅ | `01-debtor.md` |
| P2 | Кредиты — список, карточка (10 вкладок) | ✅ | `02-loans.md` |
| P3 | Погашения + графики + карточка платежа | ✅ | `03-payments.md` |
| P4 | Залог — предметы, обследование, снятие с ареста, поручители, договор | ✅ | `04-collateral.md` |
| P5 | Взыскание — стадии(1/2), события, процедуры, фазы, претензии | ✅ | `05-collection.md` |
| P6 | ~~Оформление/Решения~~ | ❌ пропуск | — |
| P7 | ~~Субсидии~~ | ❌ пропуск | — |
| P8 | Физлица / Организации — списки + карточки | ✅ | `08-persons-orgs.md` |
| P9 | ~~Документооборот~~ | ❌ пропуск | — |
| P10 | ~~Отчёты + Распечатки~~ | ❌ пропуск | — |
| P11 | Прочее — **только** курсы валют, плавающие ставки, плановые показатели | ✅ (частичный скоуп) | `11-misc.md` |
| P12 | Справочники — **только** по оставленным модулям (см. ниже) | ✅ (частичный скоуп) | `12-dictionaries.md` |
| P13 | ~~Система~~ | ❌ пропуск | — |
| **E2E** | **Сквозной прогон полного цикла** (заёмщик→кредит→залог→взыскание→полное погашение) | ✅ пройден (0→20) | `20-e2e-cycle-plan.md` |

Легенда: ⬜ не начато · 🟡 в работе/частично · ✅ готово · ❌ вне скоупа

### P11 — что берём (остальное вне скоупа)
- Курсы валют `/currencyRate/list`
- Плавающие ставки `/floatingRate/list`
- Плановые показатели `/supervisorPlanView`
- ❌ вне: кредитные списки, Тундук, АССЕТ `/asset/list`, `/creditorLine/list`, НПА

### P12 — какие справочники берём (привязанные к оставленным модулям)
- **Заёмщик:** `/manage/debtor/type/list`, `/orgform/list`, `/worksector/list`, `/debtorGroup/list`, `/debtorSubGroup/list`
- **Условия кредитования:** fund, currency, freqtype, rateperiod, daysmethod, accrmethod, transactionorder, ratetype (`/manage/order/orderterm/*`)
- **Кредит:** loan state/type, installmentstate, payment type, `/goodType/list`, `/destinationAccount/list`
- **Залог:** itemtype, quantitytype, conditiontype, `/conditionsubtype/list`, insresult/resulttype, `/inspectionStatus/list`, `/arrestFreeStatus/list`
- **Взыскание:** procedure status/type, phase status/type, event status/type
- **Гео/Организация:** region, district, aokmotu, village, `/orgForm/list`, identityDocGivenBy, identityDocType, employmentHistoryEventType
- ❌ вне: Система (cSystem, objectType/Field, role, permission, messageResource), Оформление (order states/types/packages), subsidyProject
- _Если конкретный словарь не нужен — вычеркнуть при обзоре фазы._

---

## P0. Глобальная навигация (снято `read_page`, 2026-07-12)

Две горизонтальные полосы меню + шапка + футер. Все URL относительны хоста
`http://85.113.29.29:8080`.

### Шапка / профиль
- Логотип → `/`
- Переключатель языка: `?language=kg` (Кыргызча), `?language=en` (English)
- Профиль: «Сламкулов Азамат Омургазиевич» → `/user/1/details`
- `Logout` → `/logout`
- `Start Migration` → `/startMigration`

### Меню №1 — функциональное (верхнее)

**Кредитование**
| Пункт | URL |
|-------|-----|
| Список кредитов | `/loanView/list` |
| Список погашений | `/paymentView/list` |
| Список графиков | `/paymentScheduleView` |
| Плановые показатели | `/supervisorPlanView` |
| Кредитные списки | `/list/users/objectLists` |
| Список решений | `/orderterm/list` |
| Список субсидий | `/manage/subsidyRecipient/list` |
| Тундук | `/tunduk/view` |

**Залог**
| Пункт | URL |
|-------|-----|
| Список предметов залога | `/manage/collateralItemViews/list` |
| Список актов обследования | `/collateralInspectionView` |
| Список снятий с ареста | `/collateralArrestFreeView` |
| Список поручителей | `/manage/guarantoragreement/list` |

**Взыскание**
| Пункт | URL |
|-------|-----|
| Список стадий взыскания | `/collectionPhaseViews` |
| Список стадий взыскания(2) | `/collectionPhaseViews/second` |
| Список событий | `/collectionEventViews` |

**Список**
| Пункт | URL |
|-------|-----|
| Список физ.лиц. | `/person/list` |
| Список организаций | `/organization/list` |
| Заемщики | `/manage/debtor/list1` |
| Список решений | `/manage/order/list` |

**Отчет** → Отчеты `/report/list/`

**Документы**
| Пункт | URL |
|-------|-----|
| Внутренний | `/doc?type=internal` |
| Входящий | `/doc?type=incoming` |
| Исходящий | `/doc?type=outgoing` |
| Контроль исполнения | `/doc/report` |
| Список претензий | `/collectionPhaseViews/claim` |
| Список актов сверок | `/loanSummaryAct/list` |

### Меню №2 — административное (нижнее)

- Главная → `/`
- НПА → `/organization/1/information/view`
- АССЕТ → `/asset/list`
- АССЕТ (2) → `/creditorLine/list`

**Управление кредитами**
- Оформление → Список решений `/manage/order/list` · Список документов `/manage/order/entitydocument/list`
- Кредитование → Список заемщиков `/manage/debtor/list1` · `label.loanSummaryActState` `/loansummaryactstate/list`
- Залоговое обеспечение → Список предметов залога `/manage/collateralItemViews/list` · Акты обследования `/collateralInspectionView` · Снятия с ареста `/collateralArrestFreeView` · `conditiontype/list` `/manage/debtor/collateralagreement/collateralitem/conditiontype/list` · `conditionSubType.list` `/conditionsubtype/list`
- Взыскание → Список стадий взыскания `/collectionPhaseViews`

**Справочники** (полный каталог — см. фаза P12)
- Организация: `/orgForm/list/` · `/region/list/` · `/district/list` · `/aokmotu/list` · `/village/list` · `/identityDocGivenBy/list/` · `/identityDocType/list/` · `/employmentHistoryEventType/list/`
- Система: `/cSystem/list/` · `/objectType/list/` · `/objectField/list/` · `/role/list/` · `/permission/list/` · `/messageResource/list/`
- Оформление: `/manage/order/state/list` · `/manage/order/type/list` · `/manage/order/entitylist/state/list` · `/manage/order/entitylist/type/list` · `/manage/order/entitylist/entity/state/list` · `/manage/order/entitylist/entity/documentpackage/state/list` · `.../documentpackage/type/list` · `.../entitydocument/state/list` · `.../entitydocument/registeredby/list` · `/manage/order/orderdocumentpackage/orderdocument/type/list`
- Условия кредитования: `/manage/order/orderterm/fund/list` · `.../currency/list` · `.../freqtype/list` · `.../rateperiod/list` · `.../daysmethod/list` · `.../accrmethod/list` · `.../transactionorder/list` · `.../ratetype/list`
- Заемщик: `/manage/debtor/type/list` · `/manage/debtor/orgform/list` · `/manage/debtor/worksector/list` · `/debtorGroup/list` · `/debtorSubGroup/list`
- Кредит: `/manage/debtor/loan/state/list` · `.../loan/type/list` · `.../loan/paymentschedule/installmentstate/list` · `.../loan/payment/type/list` · `/goodType/list` · `/destinationAccount/list` · `/manage/subsidyProject/list`
- Залог: `.../collateralitem/itemtype/list` · `.../quantitytype/list` · `.../conditiontype/list` · `.../insresult/resulttype/list` · `/inspectionStatus/list` · `/arrestFreeStatus/list`
- Взыскание: `.../collectionprocedure/status/list` · `.../type/list` · `.../collectionphase/status/list` · `.../collectionphase/type/list` · `.../collectionevent/status/list` · `.../collectionevent/type/list`

**Система** → Информация `/information/list/` · Пользователь `/user/list/` · Неактивные пользователи `/user/list/disabled` · Условие кураторства `/supervisorTerm/list/`

**Отчет** → Отчеты `/report/list/` · Шаблоны `/reportTemplate/list/` · Параметры формирования `/generationParameter/list/` · Тип параметра формирования `/generationParameterType/list/` · Параметры фильтрации `/filterParameter/list/` · Список объектов `/objectList/list/` · Параметры содержания `/contentParameter/list/` · Параметры страницы `/outputParameter/list/` · Виды групп `/groupType/list/`

**Распечатка** → Распечатки `/printout/list/` · Шаблоны `/printoutTemplate/list/`

**Организация** → Организация `/organization/list/` · Физ. лицо `/person/list/` · Плавающие ставки `/floatingRate/list` · Курсы валют `/currencyRate/list`

**Документы** → Виды документов `/doc/documentType` · Типы документов `/doc/documentSubType`

**Scheduler** → List jobs `/job/list`

**Классификация** → Таблицы `/classify/table/list` · Настройка таблиц `/classify/join/list` · Классификаторы `/classificator/list`

---

## Как идём

1. Пофазно. Одна фаза ≈ одна сессия. Не всё за раз.
2. В каждой фазе: открыть экран → `read_page`/`get_page_text` → описать поля/колонки
   → нажать каждую кнопку, записать результат → пройти по ссылкам → скрин.
3. Осторожно с необратимыми кнопками (Сохранить/Удалить/Зарегистрировать) — сначала
   смотрим что появляется (диалог), реальные записи по возможности не портим, но
   тестовые данные не жалко (сервер всё равно ждёт сброса — см. `CLAUDE.md`).
4. Обновлять таблицу статусов фаз в этом файле после каждой фазы.
