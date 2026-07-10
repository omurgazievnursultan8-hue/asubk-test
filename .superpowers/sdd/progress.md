# Прогресс: вкладка «Заключения» заявки (2026-07-10)

Plan: docs/superpowers/plans/2026-07-10-loan-app-conclusions-tab.md
Spec: docs/superpowers/specs/2026-07-10-loan-app-conclusions-tab-design.md
Worktree: /home/azamat/projects/asubk-conclusions  (ветка feat/conclusions-tab)
Base: 1317903
ВАЖНО: основной каталог /home/azamat/projects/asubk-credit-module занят второй сессией
(ветка wip/collection-spec). Не работать там. Все команды — из worktree.

- Task 1: модель — complete (commit c53cb16, 14/14 PASS, review clean)
  Minor (в финальное ревью): (1) поле `assigned[].locked` нигде не читается — истина в `_conclLocked()`;
  (2) устаревший комментарий у `can().editConcl` (перепишет Task 2);
  (3) ветка `!cc.total` в sendGateReason недостижима (risk/credit всегда назначены).
- Task 2: роль «Отдел» + права — complete (commit 5709b62, все PASS, review clean)
  Отступление от плана (принято): can(app) снимает _role/_deptKey в curRole/curDept — консистентно с phase.
  Minor: _docStats/status внутри editConcl читаются «живьём»; can(app) не кэшировать через смену роли.
- Task 3: панель назначения — complete (commits 04e51f0 + фикс 5602996, 34/34 PASS, review clean после фикса)
  Important (исправлено): _conclPendingUnassign не обнулялся при отмене → conclUnassignCancel().
  ВНИМАНИЕ Task 5: та же дыра возможна с _conclPendingWithdraw — сразу делать conclWithdrawCancel().
  Minor (в финальное ревью): T3c восстанавливает статусы, но не журнал log у legal/analytics.
- Task 4: баннер, чипы, карточки — complete (commits 7de5522 + фикс 5b33dcb, 46/46 PASS, review clean после фикса)
  Important (исправлено): _conclOpen/_conclLogOpen/_conclOpenAll текли между заявками → _conclResetOpen() в ветке !sameApp у gotoDetail.
  Minor (исправлено): вакуумный ассерт T4e; двойной _conclOf в reduce.
  Minor (в финальное ревью): conclToggleAll('Свернуть') гасит и свою карточку — авто-режим «свой отдел раскрыт» после этого не действует.
- Task 5: редактор заключения — complete (commits 905bf24 + фикс 4bb5db6, 62/62 PASS, review clean после фикса)
  Отступление (принято): из теста убран лишний conclToggle('analytics') — setDept уже раскрывает свою карточку.
  Сверх плана: conclWithdrawCancel() по образцу conclUnassignCancel() (дыра _conclPendingWithdraw).
  Important (исправлено): conclToggle/ToggleAll/LogToggle/ScrollTo теряли набранный текст → _conclSnapEditable().
  Minor (исправлено): слабый под-ассерт `other` в T5.
- Task 6: стыки — complete (commits 8682a3e + фикс d11894e, 72/72 PASS, review clean после фикса)
  Отступление (проверено ревью, принято): регекс T6b расширен до /документ/i — DOC_SECTIONS всегда
  содержит перманентный блокер (egr/expired, inc/rejected), поэтому гейт печатает «отклонённые/просроченные».
  Step 4 не потребовал правок — хвост sendGateReason уже стоял с Task 1.
  Important (исправлено): свод в комиссии не раскрывался (клик перерисовывал скрытую tab-concl),
  id карточек дублировались между панелями → введён ctx + _conclCardId.
  Minor (исправлено): авто-раскрытие «своего отдела» текло в свод; вакуумный ассерт T6e.
- Task 7: скриншот, TODO, STATUS — complete (commits b91d565, 6dd8224, 7b8fa10; 74/74 PASS)
  ВАЖНО: план говорил «P3-R39», но этот номер занят параллельной сессией (коммит ef87803).
  Фактический номер фичи — P3-R41. Запись переставлена после P3-R40 (порядок номеров).
  По скриншоту найден унаследованный дефект: setRole() не синхронизировал #roleSel.value
  → шапка врала про роль на всех скриншотах. Исправлено (6dd8224) + ассерт T6f.
  Живой sync_todos.py в Sheet НЕ запускался (ветка не влита) — только --dry-run.

## Финал
- Whole-branch review (opus): READY TO MERGE, критики нет.
- Финальные фиксы (1b87106): мёртвое поле `locked` убрано; успех-баннер не зовёт «отправить»
  на заявках, уже ушедших в комиссию; счётчик условий считает только submitted+cond;
  редактор структурно недоступен в своде комиссии (ctx-гейт).
- Скриншот-регресс (6dd8224): setRole() синхронизирует #roleSel — шапка больше не врёт про роль.
- Спек и TODO приведены в соответствие с реализацией (9c93995): порядок причин гейта, stage-err
  только у нерешённых заявок, модель без `locked`, инварианты _conclSnapEditable/ctx.
- Верификация: node scripts/inspect/conclusions-check.mjs → 87/87 PASS, 0 JS errors;
  скриншот .auth/conclusions.png просмотрен, дефектов нет.
- Живой sync_todos.py НЕ запускался: ветка не влита, Sheet общий.
