# Module Overview

> Captured 2026-06-17 from the live test environment (https://fkftest.okmot.kg/),
> logged in as `admin`. This is a map of what the system *is*, recovered from the
> running app's navigation. Refine with real domain knowledge as it's confirmed.

## Purpose
АСУБК is the back-office operational system for a **Kyrgyz state Financial-Credit
Fund** (domain `fkf…okmot.kg`). It manages the **full lifecycle of state-backed
lending and subsidies** — from a government decision authorizing a loan program,
through application, disbursement, servicing, guarantees, and subsidies, all the
way to debt collection.

**One line:** issue, service, subsidize, and recover government-program loans —
applications, disbursement, repayments, guarantees, subsidies, and collections,
in one place.

## Primary users
Internal Fund staff (the app is an admin/back-office tool, not a borrower-facing
portal). Access is role-based — there's a Security domain and per-user accounts.

## Core capabilities (functional domains)

The left navigation groups ~150 screens into these domains:

| Domain (sidebar group) | What it covers |
|---|---|
| **Приложение** — operations | Users, Подразделения (departments), Сотрудники подразделения (dept employees), Освоение (disbursements), Резерв (reserves), Платеж (payments), Список Траншей (tranches), LoanLedger |
| **Система кредитования** — lending | Решение правительства (gov decisions) → Кредитные программы (loan programs) → Заявки (applications) + Комиссии по заявкам → Заемщики (borrowers) → **Кредиты (loans)** → Мониторинг залога (collateral monitoring) → Комиссии. Plus lending reference data: positions, departments, authorities, lenders, interest rates, grace periods, fixed rates, repayment-account types, payment-capacity groups, credit lines, redemption accounts, borrower groups, agreement template codes & templates, payment requisites |
| **Поручительства** — guarantees | Surety questionnaires (Анкеты поручительств), sureties, credit repayments, authorised capital, guarantee terms, guarantee decisions |
| **Корпоративное управление** — corporate | Company registry, KPI analytics, documents, financial reports, industries, joint-stock companies, shareholders |
| **СУГС** — subsidies | Government programs → subsidy projects → subsidy terms; banks & signatories; agreements; industry directions; subsidy logs; subsidies; subsidy requests; subsidy payments; payment refunds; reconciliations; report imports; ~7 subsidy reports; subsidy/payment registries |
| **Взыскание задолженности** — debt collection | Collection processes → pre-trial (досудебный) → judicial (судебный) → enforcement (исполнительное производство) → asset alienation; process events; inter-department material transfers; collection audit log |
| **Справочники** | Reference data / dictionaries |
| **Сервисы** | Services |
| **Администрирование** | Administration |
| **Отчёты** | Reports |
| **Безопасность** | Security (roles/access) |
| **Инструменты данных** | Data tools (import/export) |

## Process flow (as implied by the lending domain)
Government decision → loan program → application (+ commission review) →
borrower → loan issued → disbursement (Освоение) in tranches → servicing
(payments, ledger, reserves) → collateral monitoring → (if needed) debt
collection. Guarantees and subsidies attach alongside loans.

## Out of scope / unknowns (to confirm)
- Exact legal name behind "АСУБК" and the operating Fund — TBD
- Which screens are borrower-facing vs. internal-only — appears all internal
- Integrations (banks, treasury, court/enforcement systems) — TBD
- Tech stack confirmed only as a JavaScript SPA (Angular-style routing) on a
  Russian-language UI

## Open questions about scope
- What is currently under active development? (drives the real backlog)
- Which domains are complete vs. in-progress vs. planned?
