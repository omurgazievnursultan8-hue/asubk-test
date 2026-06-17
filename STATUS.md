# Current State

> Last updated: 2026-06-17 — _(update this date every time you edit)_

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
| Credit module end-to-end check (QA + docs) | admin | 2026-06-17 | Phase 1/9 done. Next: Phase 2 — Loan program. See TODO.md |

## Blocked / waiting
| Item | Blocked by | Since | Notes |
|---|---|---|---|
| _none logged_ | | | |

## Known issues / risks
- Workspace knowledge is freshly reconstructed from the running app, not yet
  validated against real project docs — treat the module map as a working draft.

## Recent changes (changelog)
_Newest first._
- 2026-06-17 — Phase 1 (Gov decision): verified R2/R4/R6 in-app; all 6 proposals confirmed (see findings P1-03/04/05). Stack = Vaadin.
- 2026-06-17 — Phase 1 (Gov decision): documented + logged 6 improvement proposals (R1–R6).
- 2026-06-17 — Logged into test env; reconstructed and documented the full module map.
- 2026-06-17 — Workspace set up.
