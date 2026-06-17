# Backlog / TODO

> Group by priority. Move items to STATUS.md "In progress" when started,
> and check them off (or delete) when done.

## 🔴 Now — Credit module end-to-end check (QA + documentation)
Scope: core lending chain only. Per phase → doc in `requirements/features/`
+ bugs in `notes/qa-findings.md`. Working phase-by-phase, review each.

- [x] Phase 1 — Government decision (Решение правительства) — doc + QA done 2026-06-17
- [ ] Phase 2 — Loan program (Кредитные программы)
- [ ] Phase 3 — Application + commission (Заявки, Комиссии по заявкам)
- [ ] Phase 4 — Borrower (Заемщики)
- [ ] Phase 5 — Loan issuance (Кредиты)
- [ ] Phase 6 — Disbursement / tranches (Освоение, Список Траншей)
- [ ] Phase 7 — Servicing: payments, ledger, reserves (Платеж, LoanLedger, Резерв)
- [ ] Phase 8 — Collateral monitoring (Мониторинг залога)
- [ ] Phase 9 — Debt collection (Взыскание задолженности)
- [ ] Phase 0 — Reference data underpinning the above (documented as encountered)

## 🟡 Next (soon)
### Phase 1 — Government decision: improvement proposals (for dev team)
_Full rationale in `requirements/features/01-government-decision.md` → Recommendations._
- [ ] R1 🔴 Attach signed decision document (file upload), not just a text note
- [ ] R2 🔴 Reject: add confirmation + mandatory reason + audit trail (currently immediate/silent/irreversible)
- [ ] R3 🔴 Settle Код: system-assign or enforce uniqueness; reconcile blank existing codes
- [ ] R4 🟠 Guard delete of referenced decisions (edit already guarded) — confirm server-side ref check
- [ ] R5 🟡 Fix Код field styling (looks disabled but is editable/required)
- [ ] R6 🟠 Validate Дата решения (disallow future dates — picker currently allows them)
- [ ] Restore test record РКМ 508-р if needed (accidentally closed during verification; no UI undo)

## 🟢 Later / ideas
- [ ] Out of scope for now: Поручительства (guarantees), СУГС (subsidies)

## ✅ Recently done
- [x] 2026-06-17 — Logged into test env, documented full module map.
- [x] 2026-06-17 — Set up project workspace.
