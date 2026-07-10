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
