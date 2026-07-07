# Current State

> Last updated: 2026-07-07 (commission mockup — сверка с live: 2 строки, экран-редактор + диалоги голосования) — _(update this date every time you edit)_

## One-line summary
АСУБК — a large, mature back-office system for a Kyrgyz state Financial-Credit
Fund, managing the full lifecycle of state-backed lending and subsidies. In
active development (extending/maintaining an existing multi-module app).

## Overall status
- **Phase:** in development (extending an existing system)
- **Health:** 🟢 on track _(provisional — refine once current work is logged)_

## What's working / done
The app is live on the test env with ~150 screens across these domains
(see [requirements/overview.md](requirements/overview.md) for the full map):
- **Приложение** — users, departments, disbursements, reserves, payments, tranches, ledger
- **Система кредитования** — gov decisions, loan programs, applications, borrowers, loans, collateral monitoring
- **Поручительства** — guarantees / sureties
- **Корпоративное управление** — company registry, KPI, financial reports, shareholders
- **СУГС** — subsidies (projects, requests, payments, refunds, reconciliations, reports)
- **Взыскание задолженности** — debt collection (pre-trial → judicial → enforcement → asset alienation)
- **Справочники / Сервисы / Администрирование / Отчёты / Безопасность / Инструменты данных**

## In progress
| Item | Owner | Started | Notes |
|---|---|---|---|
| Credit module end-to-end check (QA + docs) | admin | 2026-06-17 | Phases 1–7 docs+QA done (Phase 7 = servicing: payments, reserves, LoanLedger, 2026-06-20). Next: Phase 8 — Мониторинг залога. See TODO.md |

## Blocked / waiting
| Item | Blocked by | Since | Notes |
|---|---|---|---|
| _none logged_ | | | |

## Known issues / risks
- Workspace knowledge is freshly reconstructed from the running app, not yet
  validated against real project docs — treat the module map as a working draft.

## Recent changes (changelog)
_Newest first._
- 2026-07-07 — **Мокап «Комиссии по заявкам»** (`mockups/loan-application-commission/commission.html`) —
  повторная сверка с live (`scripts/inspect/commission-sverka*.mjs`, скриншоты
  `.auth/commission-*-live.png`). Список приведён к текущему стенду: 2 строки
  (139 «Одобрено» + 138 «На рассмотрении»), плитка «Одобрено» 0→1, пейджер «2 строки».
  Добавлены 2 новых экрана + диалоги: **Просмотр** теперь data-driven по выбранной
  строке (138/139, разные Итоговое решение/История); **Создать·Изменить** открывает
  экран-редактор `/new`·`/{id}` (шапка + Состав комиссии с «Проголосовать» + Документы
  + Комментарии членов комиссии + Финальное решение с Одобрить/Отклонить/Запросить
  доп. информацию + Прогресс голосования + OK/Отмена). Кнопки голосования вызывают
  живые диалоги: «Ваш отзыв» (Решение/Риск/Комментарий/Файл) и «Подтверждение — Вы
  уверены? Да/Отмена». Решённую 139 «Изменить» не даёт (кнопка disabled, live-правило).
  Сверка mockup↔live `scripts/inspect/commission-mockshot.mjs`.
- 2026-07-06 — **Мокап «Кредиты»** (`mockups/loan-credit/loan-credit.html`) — точная
  копия раздела: список `/loansCredit` (11 колонок, 14 строк, «14 строк»-пейджер,
  Обновить/шестерёнка/Добавить условие поиска, Изменить/Просмотр) + деталь
  «Редактирование кредита» `/loan-credits/{id}` со всеми 11 вкладками (Общая информация,
  Оформление, Заемщик, Условия кредита с под-вкладками, График погашений, Транши,
  Резерв, Платеж, Код оплаты, Детальный расчет, Залог). Данные записи 18 («Номер рег. 56»,
  ОсОО «Бек Кабель»). Переключение вкладок, выбор строки, OK/Отмена работают как в
  оригинале. Инспекция `scripts/inspect/loan-credit-clone.mjs`, сверка скриншотами
  (`loan-credit-mockshot.mjs`) — ветка `mockup/loan-credit-page`.
  **Клики воспроизводят живые диалоги** (`loan-credit-clicks*.mjs`): каждый ••• открывает
  экран-браузер сущности (Фильтр/Обновить/Создать·Изменить·Удалить/«N строк»/грид/Выбрать)
  с реальными данными справочника (Вид кредита, Решение правительства, Кредитная линия,
  Счёт/Вид счёта погашения, Куратор→Субъекты); «Добавить» на Транши→«Создание транша»,
  на Платеж→«Платеж» (с живыми дефектами P7-02 Payment uuid/version + eager-required red);
  поля даты → календарь-попап. Сверка `loan-credit-mockshot2.mjs`.
- 2026-07-04 — **Мокап «Заявка»** — повторная сверка формы «Новая заявка» с живой
  системой (`scripts/inspect/app-create-fields.mjs`, `app-detail-tabs.mjs`). Список,
  9 вкладок детали, наборы документов и диалоги «Выберите комиссию» совпадают.
  Исправлены расхождения формы создания: (1) добавлен отсутствовавший селект «Метод
  расчета дней» (по умолч. «календарный 365»); (2) блок «Ручные параметры льготного
  периода» приведён к живому виду — 3 жирных подзаголовка + чекбоксы, чекбокс №1
  переименован «…по основному долгу» (было «…по основной сумме»), блок раскрыт по
  умолчанию.
- 2026-06-29 — **Мокап «Заявка»** (`mockups/loan-application/loan-application.html`) завершён:
  as-is клон полного потока — список заявок (грид, 8 колонок, 5 плиток-статистики) +
  мастер «Новая заявка» (все поля step 1) + страница детали (все 9 вкладок: Общая
  информация, График, 3 набора документов, Кредитная/Залоговая комиссия, История) +
  диалоги «Выберите комиссию» (кредитная/залоговая) со статус-тостом. Переиспользует
  дизайн-систему loan-program. Воспроизводит живые дефекты (серые поля P3-01, eager
  валидация P3-06, нет «Просмотр» P3-02), без улучшений. Живые находки 2026-06-29
  (по `scripts/inspect/app-capture.mjs`): добавлены 5 цветовых stat-cards (Всего/На
  рассмотрении/Одобрено/Отклонено/Требуется доп. информация); новый статус «Новый»;
  степпер детали с зелёной галочкой + датой под завершёнными шагами; поле диапазона
  «Допустимо: от … до …» в блоке одобренных условий; поле «Кредитная программа» во
  второй колонке Общей информации.
- 2026-06-29 — Loan-program creation form: completed a component-by-component owner
  review of all 8 input tabs (2 Сумма/срок · 3 Ставки · 4 Штрафы · 5 Льготный
  период · 6 Платежи/расчёты · 7 Документы · 8 Залог). Logged defects **P2-12…P2-25**
  in `qa-findings.md` and recommendations **P2-R15…P2-R21** in `TODO.md` (commit
  `e382424`). Cross-cutting rules fixed: admin-curated reference-books + junk-checks
  (feed future reports/analytics), range validation `0<мин≤макс` + soft equal-warning,
  «Маржа = read-only mirror of base rate» (dev duplication defect), textarea 1000+counter,
  explicit units (мес./%/% годовых), cross-grid dedupe, collateral gating on the checkbox. (`mockups/dictionaries/dictionaries.html`) complete: 50 sections, toolbar/grid/modal/picker-demo (P2-R9 select-only dialog, no CRUD). Docs map updated in README.
- 2026-06-23 — Написано ТЗ as-is подсистемы кредитования (`requirements/tz/`): головной index + 7 разделов по этапам жизненного цикла, полная live-ре-инспекция.
- 2026-06-23 — Loan-program mockup (`mockups/loan-program/loan-program.html`): **applied P2-R1
  field visual semantics** — flipped every editable control (input/select/textarea/
  lookup/mscombo) from the live grey "filled" look (defect P2-01) to **white bg +
  full border**; read-only/computed fields (Предпросмотр tab, «Выбранные шаблоны»,
  «Валюта» …) to **grey, no border**; required fields keep the red `*` shown
  immediately on open. Verified across tabs 1/7/9 (`.auth/p2r1-tab{1,7,9}.png`).
- 2026-06-23 — Loan-program mockup (`mockups/loan-program/loan-program.html`): finished the
  add-form wizard clone — tabs 6 «Платежи и расчеты», 7 «Документы», 8
  «Залоговое обеспечение», 9 «Предпросмотр» now match live Jmix 1:1 (inspect
  scripts `scripts/inspect/tab6-9*.mjs`, screenshots in `.auth/`). All 9 tabs
  cloned. Fixes vs prior placeholders: tab 8 fields are NOT conditional on the
  checkbox (live always shows them); tab 7 gained the missing залоговые
  doc-grids; dropped wrong `req:true` flags on tabs 6/8; wired REFBOOKS for the
  `dayCount/queue/interestCalc/checkLevel/templates` ••• pickers (latent break);
  removed orphaned `miniGrid()`.
- 2026-06-20 — Security/access config: inspected Безопасность → Ресурсные роли (`/sec/resourcerolemodels`, 15 roles) + Роли уровня строк (`/sec/rowlevelrolemodels`, 1 role) + Users via Playwright (MCP). Wrote how-to [guides/access-control.md](guides/access-control.md) (control sidebar menu/pages/buttons/fields/rows). Observations to log: `банки` role = complete CRUD template; `СУГС` & `Специалист кредитного отдела` roles have **no policies** (grant nothing); junk roles `123` (resource) + `test` row-level (empty Where) = test pollution; Users list ships a saved filter `test` hiding all rows.
- 2026-06-20 — Phase 7 (Servicing): documented `/payments` (Платеж), `/loan-reserves` (Резерв), `/loan-ledgers` (LoanLedger) via Playwright (`scripts/inspect/p7.mjs`). Logged 5 findings (P7-01 🟠 i18n leak across all 3 grids incl. `EventType.*` enum; P7-02 🟠 `Payment uuid`/`version` columns exposed; P7-03 🟡 duplicate raw «Статус»; P7-04 🟡 reserves have no detail view; P7-05 🟡 ledger «Удалить» on append-only log) and 5 proposals (P7-R1…R5). Cross-check: payment split (ОД+проценты) and reserve math (unused×rate) correct.
- 2026-06-20 — Phase 6 (Disbursement & tranches): documented `/sub-loans` (tranches, 4-tab detail) + `/disbursements` (Освоение) via Playwright (`scripts/inspect/p6-probe.mjs`, `p6.mjs`); model Кредит→Транш→Освоение. Logged 3 findings (P6-01 🟠 raw entity labels `SubLoan.amount`/`Disbursement.subLoan`; P6-02 🟡 empty tranche schedule; P6-03 🔵 «шрафы» typo) and 3 proposals (P6-R1…R3). Cross-check: disbursement-level annuity schedule computes interest correctly (50 000 @10%/24mo → 2 307,25).
- 2026-06-20 — Phase 5 (Loan issuance): documented `/loansCredit` + 11-tab loan detail (`/loan-credits/{id}`) via Playwright (`scripts/inspect/loans*.mjs`); logged 8 findings (P5-01…08, incl. **🔴 P5-01** data-dependent detail crash on rec 20/22) and 5 proposals (P5-R1…R5). Cross-check: loan-level schedule computes interest correctly (contra app-level P3-R11).
- 2026-06-17 — Phase 2 (Loan program): documented `/loan-programs` + 9-tab create wizard via Playwright; logged 6 findings (P2-01…06) and 6 proposals (R8–R13). QA pass (required-field validation). Stack refined to **Jmix on Vaadin**. New Sheet tab «Кред. программы».
- 2026-06-17 — Phase 1 (Gov decision): verified R2/R4/R6 in-app; all 6 proposals confirmed (see findings P1-03/04/05). Stack = Vaadin.
- 2026-06-17 — Phase 1 (Gov decision): documented + logged 6 improvement proposals (R1–R6).
- 2026-06-17 — Logged into test env; reconstructed and documented the full module map.
- 2026-06-17 — Workspace set up.
