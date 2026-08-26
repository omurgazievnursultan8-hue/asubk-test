# ASUBK Credit Module — Project Workspace

This folder is the **coordination & tracking workspace** for the ASUBK Credit Module.
The actual application source code lives in a separate repository (see
[references.md](references.md)). This space is for understanding **where the
project stands, what's left to do, and what it must do.**

## How this folder is organized

| File / folder | Purpose | Update when |
|---|---|---|
| [STATUS.md](STATUS.md) | Snapshot of the current state — what's built, working, in progress, blocked | Anything ships, breaks, or changes status |
| [TODO.md](TODO.md) | Prioritized backlog of work to be done | New work appears or priorities shift |
| [requirements/](requirements/) | What the module must do — features, business rules, specs; `tz/` — ТЗ по подсистемам, `legacy/` — обследование старой системы | Scope is defined or changes |
| [CONTEXT.md](CONTEXT.md) | Словарь проекта: термины по модулям, у каждого — `_Avoid_` со словами, которые не употребляем | Термин заведён, переименован или уточнён |
| [docs/adr/](docs/adr/) | Необратимые решения по одному файлу, сквозная нумерация; правила нумерации и карта занятых диапазонов — [docs/adr/README.md](docs/adr/README.md) | Принята развилка, которую дорого переигрывать |
| [docs/ochered-modulei.md](docs/ochered-modulei.md) | Очередь модулей: порядок проработки и порядок выдачи постановок — две встречные оси, критерий закрытия волны, что чем заблокировано | Меняется состав очереди или закрывается её пункт |
| [docs/tasks/](docs/tasks/) | Постановки разработчикам: HTML с JSON-островом по [FORMAT.md](docs/tasks/FORMAT.md), проверяются `scripts/check_tasks.py`. Для этих файлов **HTML — источник истины**, `TODO.md` держит только реестровую строку | Модуль готов к передаче или переиздаётся |
| [mockups/](mockups/) | Самодостаточные HTML-прототипы по модулям (дизайн-система ASUBK gov-blue). У живых макетов рядом лежит `ASUBK-status-razrabotki.md` — задачи по макету, не бэклог разработки | Прототип заведён или переписан |
| [guides/](guides/) | How-to guides for using/administering the app (e.g. [access-control.md](guides/access-control.md)) | A reusable how-to is worth writing down |
| [notes/](notes/) | Meeting notes, open questions, scratch | After meetings / as questions arise |
| [references.md](references.md) | Links to the repo, environments, dashboards, docs, people | A new external resource matters |
| [mockups/loan-program/loan-program.html](mockups/loan-program/loan-program.html) | UI mockup: форма создания кредитной программы (9 вкладок, дизайн-система АСУБК) | Обновляется под рекомендации P2-R* |
| [mockups/dictionaries/dictionaries.html](mockups/dictionaries/dictionaries.html) | UI mockup: витрина справочников (50 разделов, тулбар/грид/модал/picker-демо, P2-R9) | Обновляется под рекомендации P2-R* |
| [mockups/loan-application/loan-application.html](mockups/loan-application/loan-application.html) | UI mockup: «Заявка» as-is поток — список + мастер «Новая заявка» + детальная страница (9 вкладок) + диалоги «Выберите комиссию» | As-is клон живого приложения (Tasks 3–11) |

## Quick start each session

1. Skim **STATUS.md** — where are we right now?
2. Check **TODO.md** — what's next / what's blocked?
3. Log anything new into the right file before you forget it.

---
*Workspace created 2026-06-17.*
