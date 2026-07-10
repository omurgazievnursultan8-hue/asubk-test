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

---

# Прогресс: запрос документов через интеграцию (2026-07-09)

Plan: docs/superpowers/plans/2026-07-09-loan-app-docs-integration-request.md
Branch: feat/docs-integration-request
Base: 3c75e79

- Task 1: модель — complete (commits 3f8dfa6, WIP-снапшот ed302f1, review clean)
- Task 2: docRow кнопки + мета — complete (commit b97a8f5, review clean)
- Task 3: обработчики + гейт — complete (commit 55d7bb0, review clean; Minor: T3b не ассертит формулировку гейта → фикс в Task 4)
- Task 4: скриншот-верификация + TODO — complete (T3b gate-wording assertion added and PASS; screenshot visually confirmed; CHECKPOINT-comment + TODO.md P3-R36 added; попутно исправлен рендер-баг: мета-строки `.doc-meta` конкатенировались без разделителя из-за `meta.join('')` на голых строках — обёрнуты в `<span>`)

## Финал
- Whole-branch review (opus): READY TO MERGE. 1 Important (stale d.via badge) — исправлен коммитом 955762e + регресс-тест. Minor'ы (вложенные кавычки — по спеку; мёртвый '—' fallback) оставлены.
- Верификация: node scripts/inspect/doc-integration-request.mjs → 15/15 PASS, 0 JS errors, скриншот .auth/doc-integration.png ок.
- Feature-коммиты: 3f8dfa6, b97a8f5, 55d7bb0, 102b208, 955762e (+ pre-existing WIP снапшот ed302f1).
- Task 8: пустые состояния, отклонённая передача, причина запрета — complete (commits 23251bd..64847d8, review clean)
  - Minor от ревью: не покрыт рендер запрета у 151/120 и метка «соглашение» у 120 → фикс 64847d8, +5 ассертов, проверены на сломанном рендере.
- Task 9: роль, сортировка, приёмка — complete (commits 2f5f706..7446ad7, review clean после фикса)
  - Important от ревью: метка оверлея «соглашение» у 120 обрезалась (clientWidth 173 < scrollWidth 220), ячейки без title → фикс 7446ad7: colgroup 10.5/15.5/14.5/19/9/7.5/24, escAttr()+phaseFullText(), +30 ассертов (boundingBox, scrollWidth, title).
  - Фиксер поймал вторую регрессию (обрезанные ЗАГОЛОВКИ колонок) только скриншотом — ассерты по td её не видели.
- Task 10: TODO «Фаза 9» + STATUS — complete (commit c3ee5ce, review clean)
  - Разметка пунктов приведена к реальной конвенции TODO.md (плоский формат из плана в файле не встречается нигде).
  - Побочно: sync_todos.py не знал про взыскание → «Фаза 9» падала в generic-вкладку «Прочее». Фикс facfd09 (+ключ SECTION_TABS), Sheet пересинкан: 11 вкладок, «Взыскание» (9), «Прочее» исчезла.

## Финальное ревью
- Whole-branch review (opus): READY TO MERGE. 4 Minor.
  - Minor 1 (событие не показано данными) + Minor 2 (3 вида меры из данных отсутствовали в MEASURE_KINDS) — оба спорили с планом, решение человека: чинить. Коммит b5f3e9d.
  - Minor 3 (мёртвый хелпер esc) — удалён там же.
  - Minor 4 (обёртка над page.evaluate) — оставлен намеренно, dev-only харнесс.
  - Регрессия от b5f3e9d: «Повторная претензия» + метка «событие» не влезали (scrollWidth 241 > clientWidth 235), фиксер закоммитил с красным ассертом. Исправлено 2ce9de1: colgroup 10.5/14.5/14.3/21.5/9/7.5/22.7, ассерты усилены (запас метки ≥4px, покрытие всех th и td).
  - Итог: 186 ассертов ok, 0 ошибок консоли, exit 0.
