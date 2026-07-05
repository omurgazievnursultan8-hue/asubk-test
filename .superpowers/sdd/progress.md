# Прогресс: паритет условий заявки с программой (2026-07-05)

Plan: docs/superpowers/plans/2026-07-05-loan-application-conditions-parity.md
Base: 023095e

Исполнено inline-батчем (пользователь выбрал Inline). Финальные версии функций
написаны сразу (без stub-then-replace). Верификация: scripts/inspect/verify-create-conditions.mjs
(playwright-core + system Chrome, headless) — ALL PASS, 0 console errors.

- Task 1: cdraft/CP/renderCond/saveCondInputs + CSS + HTML-хост #cf-cond-body — complete
- Task 2: condCombo + condSecParams — complete
- Task 3: condF + t2col-подсистема (inline-picker вместо openRefDialog) + envelope-валидация — complete
- Task 4: condMsCombo + condCheck + condSecRates (плавающая) — complete
- Task 5: condSecPenalty — complete
- Task 6: condGraceBlock + condSecGrace (3 блока + распределение) — complete
- Task 7: condSelPair + condSecPayments — complete
- Task 8: _condTouched/condTouch + applyProgramSnapshot + condDev — complete
- Task 9: PROGRAMS_MAP расширен condition-полями + programToCond — complete

Отклонения от плана (все обоснованы):
- renderCond НЕ делает leading saveCondInputs (harvest — в обработчиках), иначе
  затирал бы программно выставленные значения (сброс формы, предзаполнение). Баг
  найден верификацией, исправлен.
- applyProgramSnapshot предзаполняет НЕтронутые поля (не только пустые) — иначе
  non-empty дефолты давали ложные чипы отклонения.
- touched-трекинг через явный condTouch(), не авто-harvest.
- t2add: inline-picker (в заявке нет openRefDialog/toast).

Оставлено как cleanup-кандидат: dead renderProgramConditions + REF_VALUES/PROG_ATTRS/
roFieldHTML/selectFieldHTML/textFieldHTML (guarded, validateProgSelects()→true).
