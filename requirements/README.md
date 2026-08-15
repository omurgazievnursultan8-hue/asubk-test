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
«Сотрудники · Задания · Кураторство» отдаются разработчику постановкой без ТЗ: у кураторства
источник истины — `docs/tasks/p18-kuratorstvo-tasks.html` плюс словарь `CONTEXT.md` и
`docs/adr/0116`…`0118`; прототип `mockups/kuratorstvo/` входит в пакет иллюстрацией экранов
и логикой не является (`mockups/kuratorstvo/ЗАПИСКА.md`).

## Module overview
_Fill this in._

- **Purpose:** What problem does the credit module solve?
- **Primary users:** Who uses it?
- **Core capabilities:** What are the main things it does?
- **Out of scope:** What it deliberately does NOT do.

## Open questions about scope
- TBD
