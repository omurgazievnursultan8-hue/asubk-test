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
