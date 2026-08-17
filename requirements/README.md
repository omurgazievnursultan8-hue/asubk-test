# Requirements & Specs

What the ASUBK Credit Module must do. One file per feature/area keeps things
findable. Start with the overview below, then split out as detail grows.

## Suggested structure
- `overview.md` — the big picture: purpose, users, scope boundaries
- `features/<feature>.md` — one file per feature or business rule set
- `glossary.md` — domain terms (credit-specific vocabulary)
- `tz/` — техническое задание (функц. спецификация as-is) подсистемы кредитования.
- `legacy/` — обследование старой системы (FKF/ASUBK, `85.113.29.29:8080`): «было → стало»
  по модулям `P1`…`P13`, нав-карта и план — `legacy/00-plan.md`, сквозной прогон цикла —
  `legacy/20-e2e-cycle-plan.md` (`E2E-01`…`E2E-14`).

**ТЗ есть не у каждого модуля, и это осознанно.** Административные модули связки
«Сотрудники · Задания · Кураторство» отдаются разработчику постановкой, а не разделом ТЗ:
у кураторства источник истины — `docs/tasks/p18-kuratorstvo-tasks.html` (редакция 2 от 17.08.2026, 3 этапа,
14 карточек) плюс словарь `CONTEXT.md` и `docs/adr/0116`, `0117` (правка 17.08.2026), `0131`
поверх `0023`; **`docs/adr/0118` отменён целиком** волной 6. Прототип
`mockups/kuratorstvo/kuratorstvo.html` переписан 16.08.2026 и с тех пор **исполняет модель**
(смоук `scripts/inspect/kuratorstvo-check.mjs`, 105/105) — постановка остаётся источником истины,
но расхождение с прототипом означает ошибку в одном из двух и разбирается, а не обходится
догадкой. Записка о **прежнем** прототипе от 12.07.2026 —
археология (`mockups/kuratorstvo/ЗАПИСКА.md`), живое состояние —
`mockups/kuratorstvo/ASUBK-status-razrabotki.md`. **В официальном ТЗ кураторство всё же
есть — семь предложений** («Модуль распределения кураторства» подсистемы администрирования);
свод цитат и сверка «требование ТЗ → карточка постановки» — `tz/16-kuratorstvo.md`
(17.08.2026). Спецификацией этот файл не является и постановку не заменяет.

## Module overview
_Fill this in._

- **Purpose:** What problem does the credit module solve?
- **Primary users:** Who uses it?
- **Core capabilities:** What are the main things it does?
- **Out of scope:** What it deliberately does NOT do.

## Open questions about scope
- TBD
