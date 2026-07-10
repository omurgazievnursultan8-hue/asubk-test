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
