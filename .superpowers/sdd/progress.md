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

---

# Прогресс: взыскание — дозагрузка legacy-фич (2026-07-20)

Plan: docs/superpowers/plans/2026-07-20-collection-mockup-legacy-additions.md
Spec: docs/superpowers/specs/2026-07-20-collection-mockup-legacy-additions-design.md
Branch: feat/collection-legacy-additions
Base: 99681b5
Проверка: node scripts/inspect/collection-check.mjs (baseline 186 ассертов PASS)

- Task 1: харденинг check-скрипта — complete (commit 686b9ed, 186/186 PASS, review clean)
  Minor (только в самоотчёте, не в коде): счётчики вхождений nth в report неточны.

- Task 2: вкладка «Расчёт долга» — complete (commit 8ed89bb, все PASS +8 ассертов, review clean)
  Инвариант сумм проверен вручную для всех 6 процессов (в т.ч. 104: ИЛ-288=310000, не КИ-06=295000).

- Task 3: вкладка «Заседания» — complete (commit 9c0f9c5, 212 PASS, review clean)
  Правка: устаревший Task-2 ассерт «вкладок 8»→9 (TABS — общий массив, легитимно).

- Task 4: ответственный (ФИО) в журнале мер — complete (commit bce907b, все PASS, review clean)
  ПРИМЕЧАНИЕ: рабочее дерево содержит НЕ мои правки mockups/collateral/zalog.html (WIP
  параллельной сессии). Мои коммиты его не трогают. Не откатывать.

- Task 5: вложения-сканы на мере — complete (commit 4e318c5, все PASS, review clean)
  Параллельная сессия влезла коммитом 28d1a82 (zalog.html) между Task 4 и 5 — на МОЮ ветку.
  Minor (в финальное ревью): openDocsModal не использует escAttr (данные статичны, как и в panelMery).

- Task 6: черновик/зарегистр. + аннулирование меры-вехи — complete (commit fc2efc2, 222 PASS, review clean)
  Отступление (проверено ревью, принято): +`&& m.regState !== 'черновик'` во флаг «не исполнена» —
  черновик «Не направлялась» не является проваленной доставкой (семантически верно, не маскировка теста).

- Task 7: реестры заседаний/претензий + фильтры стадии — complete (commit c8c3fc0, все PASS +8, review clean)

- Task 8: доки (шапка макета + TODO P9-R9) — complete (commit 46475d5, все PASS, review clean)
  TODO auto-sync hook не срабатывал (ветка не влита). zalog.html чужой — не в коммите.

## Все 8 задач complete. Финальное whole-branch ревью — далее.

## ФИНАЛ
- Whole-branch review (opus): READY TO MERGE. Ни Critical/Important.
  Инвариант сумм подтверждён для всех 6 процессов (104 не совпадает с КИ-06 — верно).
  panelMery 11/11 столбцов согласованы после накопления Task 4/5/6. TABS/builders 9/9.
- Minor'ы (все приемлемы для демо): phaseMeasureSum — app-dead (только тест-инвариант);
  registry-строка openDetail→вкладка 0, а спек §3 хотел вкладку «Заседания» (мелкое отступление);
  .rowlink на <tr> красит всю строку; «Применить» дат — только тост; waterfall — заметка без схемы стрелок;
  openDocsModal без escAttr / aria — унаследованный стиль файла.
- Верификация: node scripts/inspect/collection-check.mjs → все ассерты PASS, 0 ошибок консоли.
- ВНИМАНИЕ: ветка feat/collection-legacy-additions содержит ЧУЖОЙ коммит 28d1a82 (zalog.html,
  параллельная сессия) + незакоммиченные правки zalog.html в рабочем дереве. Не мои.

---

# Прогресс: доработка zalog.html (Д-1…Д-3, Р-11…Р-23) (2026-07-21)

Plan: docs/superpowers/plans/2026-07-21-zalog-fix.md
Spec: docs/superpowers/specs/2026-07-21-zalog-fix-design.md
Worktree: .claude/worktrees/feat-zalog-collateral-fix (ветка worktree-feat-zalog-collateral-fix)
Base: 3513d3f
Проверка: npm run test:zalog (jsdom-харнесс, создаётся Task 0)
Режим: субагент на задачу, СТОП после каждой задачи (ждать команды пользователя).
Pre-flight решение: вакуумные ok(true)-тесты выкинуть (T1 D1-2 / T3 D3-1 / T7 R11-8 / T22 R11-11);
  реальный ассерт только там, где доступен хелпер (D1-4/T5/T22).

- Task 0: харнесс + шов __zt — complete (commit 4af4f0d, 1/1 PASS, review clean)
  jsdom@29.1.1 в devDeps; package-lock git-ignored (не коммитим). Шов: 19 существующих символов
  (grep-проверены), исключены guaranteeReq/effectiveInterval/riskFactorCandidates (появятся в задачах).
  Minor (в финал): отчёт сказал «шов 13 строк», факт 10 — косметика, кода не касается.

- Task 1: Д-1 удалён COVER_MIN — complete (commit d4ec5a5, 2/2 PASS, review чист: Spec ✅ / Quality Approved)
  D1-1 тест переписан на win.eval('typeof COVER_MIN') — classic-script const не window-проперти (реальный ассерт,
  проверено вручную: реинтродукция COVER_MIN → FAIL). D1-2 заглушка выкинута (pre-flight). ncCredits показывает обе
  величины 120%/150% с цитатой П1 §2.3–2.4; openAlloc метка+дефолт доли через requiredCover(id, ctx(c)).
  Хвосты (в финал/след.задачи): openAlloc дефолт доли теперь 150%-aware для движ.неликвида — полный редизайн в Task 3;
  COVER_GUARANTEE/_FX пока только в шве — оживут в Task 7 (Р-11 гарантия).

- Task 2: Д-2 хардкод 120%→pct(req) — complete (commit d9c8f7d, 3/3 PASS, review чист: Spec ✅ / Quality Approved)
  Все user-facing 120%/«Гейт 120» убраны (остались только dev-комменты). D2-1 реальный ассерт (hasNot,
  проверено вручную реверсом тоста → FAIL). +2 сайта сверх брифа (ncCredits ~2761, credOpts renderDs ~3068) — тот же класс.
  «комитетом»→«комиссией» (в файле 0 упоминаний комитета). Stored req в c.undercovered/c.addenda[] — ЛЕГИТИМНЫЙ
  event-time снапшот (как существующий ratio; ре-деривация переинтерпретировала бы прошлые решения под чужой порог).
  Minor (в финал): gate.rows.reduce tie-break при равных ratio берёт первый — безвредно (= старый Math.min).

- Task 3: Д-3 дефолт доли openAlloc = недостающая до порога — complete (commit 57eaab4, 3/3 PASS regression, review: Spec ✅ / Quality Approved)
  Формула Math.min(av, Math.max(0, cr.amount*req − alreadyByCredit)); live-пересчёт порога 120↔150 через sync()/draftWithItem
  (existing change-listeners, нового не добавляли). alInfo подсказка verbatim с П1 §2.3/§2.4. D3-1 заглушка выкинута (pre-flight);
  реальный инвариант — в Task 5. Тула-1 хвост (редизайн дефолта) закрыт здесь.
  *** CARRY-FORWARD в Task 5 (Р-11): alreadyByCredit сейчас draft-only (буква брифа «в черновике»), но req считается
  cross-contract (ctxWithDraft). Несогласованность → дефолт завышает недостачу если кредит уже покрыт ДРУГИМ активным
  договором. Сделать дефолт coverage-wide на канон-coverage из Р-11. USER-РЕШЕНИЕ: спросить defer-to-T5 vs сейчас.

- Task 4: Р-13 requiredCover→{req,source} — complete (commits e7ff9fd..4d8286b, 6/6 PASS, review чист после фикса)
  Call-site миграция ЧИСТА: 6 сайтов, все читают .req, ноль NaN/[object Object]. requiredCover body verbatim
  (ветвь kmDecision дормантна — норма). coverage() тоже несёт .source. R13-2 К-56 (ликвид→1.2/§2.3), R13-3 К-40
  (движ.неликвид ТС→1.5/§2.4) — реальные ассерты.
  ФИКС (Important, commit 4d8286b): строки-пороги 1595/2182 печатали список порогов + ОДИН хардкод «П1 §2.3» —
  неверно для §2.4-кредитов в списке. Заменено на per-credit r.source внутри .map, хардкод убран. Тем самым
  coverage().source стал consumed (снял YAGNI-вопрос). Имплементер соврал про «optional» в брифе (фразы нет) — учтено.
  Minor (в финал, триаж): ~8 сайтов (2259/2269/2887/2899/2952/2970/3074-75/3124) печатают pct(r.req) БЕЗ цитаты вообще
  (не мис-цитата). Бриф «где показан порог — рядом печатать source» строго требует; но добавление в 8 инлайн-мест —
  полиш, не корректность. Решить в финале: нужен ли source везде или только там где раньше был неверный.

- ПОПРАВКА к carry-forward T3: канон-coverage/index = Task 7 (Р-11), НЕ Task 5. Task 5 = только invariant-тесты.
  Cross-contract netting дефолта openAlloc (alreadyByCredit coverage-wide) переносится в Task 7. USER выбрал A (defer).

- Task 5: coverage-инварианты Д-1/Д-3/Р-13 (test-only) — complete (commit e929fa2, 8/8 PASS, review чист: Spec ✅ / Quality Approved)
  3 поправки контроллера применены: (1) R13-3→R13-4 (коллизия с тестом Task 4); (2) win.COVER_LIQUID=1.5 сломан
  (classic-script let ≠ window-проп) → win.eval('COVER_LIQUID = 1.5'), строгие eq(after,1.5)/near(before,1.2) без escape;
  (3) D1-4 оба полюса: К-56 ликвид→1.2/§2.3, К-40 движ.неликвид→1.5/§2.4. Изоляция: свежий JSDOM на load(), мутация не течёт.
  zalog.html не тронут. Ни один тест не вакуумен.

- Task 6: Р-19 матрица ролей (ПОЛ §9.1) — complete (commit d7c76dc, 10/10 PASS, review чист: Spec ✅ / Quality Approved, ноль findings)
  canEdit→canCurate (21 сайт), canCommission→canCommittee (7), +canHeadOfDept/canHeadOfUnit (forward-decl, оживут T15/17,
  в шве). 5 ролей ПОЛ §9.1 в <option>, дефолт role='Куратор…' (валиден). 19 copy-сайтов «комиссия по залогу»→«комитет по
  администрированию бюджетных кредитов» (падежи ок), denyComm-текст. grep-zero старых имён. R19-1/R19-2 реальны (шов zt.* +
  win.eval для удаления старых имён). Все 4 гварда в __zt.
  Minor (в финал, триаж): enum-статус 'На рассмотрении комиссии' оставлен (strict-eq токен, 8 сравнений) — косметич.
  рассинхрон с «направлено в комитет…». Переименование enum = coordinated data-change; решить в финале (rename+все сравнения
  ИЛИ display-label мэппинг).

- Task 7: Р-11 индекс обеспеченности + банковская гарантия (П1 §2.3) — complete (commits d7c76dc..f7c3d8d, 19/19 PASS, review чист: Spec ✅ / Quality Approved)
  coverage(cs,creditId) сигнатура СОХРАНЕНА (бриф ошибочно swap — R1). ok=(index>=1)&&liqOk (liqOk-гейт НЕ потерян — R2).
  Новые поля: secPledge/idxPledge/idxGuar/gReq/index. guaranteeReq(cr)→1.0 same-cur/1.2 FX/null; guaranteeExpired(g) через
  d2n/TODAY; GUAR_WARN_DAYS=60; оба в шве. Мираж-хак other?true УБРАН — К-95 обогащён в живую гарантию (currency KGS,
  amount 130000, till 01.06.2027) → idxGuar≈1.08, ok=true реально (R3). Триггеры: гарантия истекла (high)/истекает ≤60д (mid).
  Гейт-таблица +колонка «Индекс обеспеченности». COVER_GUARANTEE/_FX TODO сняты.
  T3 carry-forward ЗАКРЫТ (R6): openAlloc дефолт доли alreadyByCredit = coverage(ctxWithDraft,crId).secPledge — нетто по всем
  активным договорам, не только черновик. Тест T3-1 подтверждает (120000→70000).
  Тесты реальны (R10): R11-8 stub заменён на fixture-тест index 1.0→0.75; +К-95 idxGuar>=1; R11-6/7 fixture с type добавлен.
  Reviewer перепроверил алгебру ok независимо: idxPledge=ratio/req ⟹ covOk⟺idxPledge≥1, idxGuar≥0 ⟹ гарантия только поднимает
  ok, никогда не маскирует недобор → 7+ потребителей coverage() без регрессии.
  Minor исправлен сразу (commit f7c3d8d): Д-008 seed-история описывала снятый мираж-гейт + старую роль «Залоговый специалист».

- Task 8: Р-12 виды залога П1 §2.2 + KIND_FIELDS + миграция — complete (commit aa978ab, 23/23 PASS, review чист: Spec ✅ / Quality Approved, ноль findings)
  +5 видов в KINDS (Кредитный портфель liquid, Имущ.комплекс, Незавершёнка, Ценные бумаги, Право аренды). KIND_FIELDS/
  KIND_MIGRATION/PRIMARY_DETAIL уже существовали → РАСШИРЕНЫ (не пересозданы). Валидация generic (saveNewItem req-loop) —
  новый код не добавлялся.
  R3 correctness-фикс (бриф упустил): 3 из 5 новых видов movable:true, но НЕ физтехника. Введён явный флаг tech:true только на
  ТС/Оборудование/Сельхозтехнику; isTech + tech-локали в niKindChange/saveNewItem читают KINDS[kind].tech вместо
  movable&&!=товары. Reviewer независимо доказал truth-table isTech тождественна для всех 5 старых видов; 3 новых movable-вида
  корректно вне физ-гейта (нет ложного «год выпуска/полис», нет ложных Р-7 триггеров). requiredCover: Кред.портфель→1.2,
  Ценные бумаги→1.5 (тесты R12-14a/b реальны).
  Контрадикции сняты: коммент «Кред.портфель не добавляем» переписан; KIND_MIGRATION-строка Кред.портфель→сам себя
  (переносится как есть, П1 §2.3); «Скот §3.5» не тронут. ORG_REGISTRY +орган портфеля; шов +KIND_FIELDS (тест zt.*, не win.*).
  Наблюдение (не дефект): Ценные бумаги PRIMARY_DETAIL→'isin' (необяз.) — как существующий ТС→'vin'.

- Task 9: Р-22 слой ужесточения интервала по категории риска (ПОР п.10) — complete (commit 073cf55, 27/27 PASS, review чист: Spec ✅ / Quality Approved)
  Калькслой: RISK_TIGHTENING {Низкий1.0/Средний0.5/Высокий0.25}, SURVEY_MIN_MONTHS=3, RISK_TIGHTENING_APPROVAL{approved:true+основание},
  effectiveInterval(group,movable,riskCat,approval)=max(min, round(base*k)). Бриф-дефекты сняты (R1/R2): guard base==null (не ===undefined —
  банкрот отдаёт null не undefined→иначе=3); тест R22-42 real-ключ 'Предприятия-банкроты' (бриф 'Банкрот' не существует). approval был
  present:false (мёртвый) → approved:true живой.
  Живая интеграция (R4/R5): +riskCategory зеркало на CREDITS (К-40 Высокий/К-90 Средний на активных договорах — тайтенинг виден);
  itemRiskCategory(it) worst-of = наименьший коэф (Высокий тайтест); nextSurvey перевязан на effectiveInterval. Reviewer независимо
  пересчитал: П-005 24×0.25→6, П-002 12×0.5→6; поведение тождественно для Низкий/approval-off (все матрич.значения ≥3, без клампа).
  Dual-display норматив+действующий (карта+триггер, только при расхождении). Рефбук: read-only норм-блок (коэф/min/основание, ПОР п.10),
  НЕ в saveRefbook. Шов +5 символов (+itemRiskCategory/borrowerSolvency/nextSurvey/surveyInterval для теста).
  Minor (в финал): itemRiskCategory/borrowerSolvency пересчитываются в nextSurvey/itemPanels/triggers дублем — будущая экстракция
  surveyStatus(it). Не баг (тот же паттерн, малый объём данных).
- Task 10: Р-13 гейт §2.6 обеспеченность по решению КМ (kmGateBlocked, третий гейт регистрации, форма kmDecision) — complete (commits 9501a3a..b8e41f6, 28/28 PASS, review чист: Spec ✅ / Quality Approved; Minor стального комментария «два→три гейта» исправлен b8e41f6)
- Task 11: Р-17 securityRole + лимит возраста техники П1 §2.5 (techAgeCheck: дополнительный→жёсткий блок, основной→допуск комитетом; §3.3 чек-бокс+акт осмотра; card honesty; убран мёртвый techAgeOk) — complete (commit 3532113, 30/30 PASS, review чист: Spec ✅ / Quality Approved; TECH_AGE_LIMIT переиспользован, 1 декларация; techAgeOk 0 ссылок)
  - Minor (в финал T23): нет отдельных тестов на §3.3-блок / committeeReq-путь / persistence securityRole на не-tech movable — кандидаты на добор §18 (цель ≥45; сейчас 30). Behavior-shift: over-limit основной техника hard-block→committee-route (ни один seed не сверх лимита → без видимого эффекта).
- Task 12: Р-18 стоп-лист §3.5 как валидация приёма+гейта (stopListCheck: 7 блок-условий — с/х-земля hard/Закон КР, износ≥WEAR_LIMIT 70 hard, морально устар., необоротоспособ., 3 флага ТМЦ; stopFieldsOf общий маппер; 3 чек-бокса ТМЦ+circulable+landPurpose+wearPct; гейт openRegister+doRegister defense-in-depth) — complete (commit 5c0ff7a, 33/33 PASS, review чист: Spec ✅ / Quality Approved)
  - Seeded П-003/П-007 не блокируются (все поля undefined → guards fail closed, подтверждено трассировкой). WEAR_LIMIT 1 деклар., niNotProhibited 0 code-ссылок (только объясняющий комментарий). Minor (комментарий с niNotProhibited) — оставлен как корректный контекст миграции.
- Task 13: Р-15 акт обследования П2 §2.4 (surveyValidate: заключение+фото обязательны, односторонний→presenceConfirmed, двусторонний→signers⊇{ГФХ,залогодатель}; жёсткий гейт в saveSurvey перед push; модалка +заключение/фото/односторонний/подтверждение/signers; пилюля «односторонний» в колонке Акт) — complete (commit 82d8a83, 35/35 PASS, review чист: Spec ✅ / Quality Approved)
  - Порядок проверок и цитаты (П2 §2.4/§2.3) verbatim из брифа, трассированы все 4 кейса; эффект-ветвление ok/reval/lost цело; seam +surveyValidate; scope чист.
  - Minor (в финал T23): svGfhName/svGfhPost поля в модалке рендерятся, но нигде не читаются — молча теряют ввод ГФХ ФИО+должность (бриф хотел их захват). Либо вписать в survey-record, либо убрать.
- Task 14: Р-16 custody + право аренды (custodyValid: только 'у залогодателя'/'у залогодержателя'; leaseCoversCredit через d2n с guard пропущенных дат ПОЛ §6.4 п.6; custody-селект в openRegister ПОЛ §6.4 п.7 + Место хранения при 'у залогодержателя', персист в doRegister; KIND_FIELDS['Право аренды'] leaseTill req + lessorConsent) — complete (commit 44c709b, 39/39 PASS, review чист: Spec ✅ / Quality Approved)
  - РЕЗОЛЮЦИИ: parseDate из брифа НЕ существует → d2n (стр.758), parseDate не создан; leaseCoversCredit guard'ит пропущенные даты→warn:false; CREDITS без creditTill — данные не фабриковались, живого warning-баннера нет (guard молчит). Все 4 кейса трассированы, npm run test:zalog = 39 passed. Др. валидаторы (kmGateBlocked/stopListCheck/techAgeCheck/surveyValidate) не тронуты.
  - Minor (в финал T23): rgCustody (fsel) и rgCustodyPlace (fin,false) без визуального маркера обязательности — предсуществующее ограничение хелперов fin/fsel, логика гейта в doRegister цела (toast ловит). Низкий импакт.
- Task 15: Р-14 гейт замены П3 §3.5 (replacementGate: equivalenceOk=inValue>=outValue, consentOk/dakOk из непустых строк, rankOk=!drop, blocked=!(все 4); байт-в-байт бриф + seam; replacementValues хелпер out/in; панель условий в renderDs; dsDeptConsent+dsDakConclusion — два НОВЫХ жёстких поля, button disabled при пустых; «Отказать в замене» → hist(c)) — complete (commit d819ea5, 43/43 PASS, review чист: Spec ✅ / Quality Approved)
  - CRITICAL проверка Р-6 ПРОЙДЕНА: overdue hard-block цел (repOverdue→toast до новых проверок), rank drop остался committee-override (repDrop||repEquivShort OR'd в существующую obosn-ветвь, НЕ новый жёсткий блок), demo Д-006/К-90 overdue:true всё ещё блокирует. Button disabled сохранил все 4 исходных терма + repDeptDakMissing добавлен. Порядок гейтов dsRegister аддитивен. Др. валидаторы не тронуты.
  - Minor (в финал T23): UI-чек-бокс deptChk поверх текстового consentOk (не влияет на pure fn); live input/change листенеры новых полей — оба аддитивны, гейты не ослаблены.

── ПЛАН: Страница настройки правил доступности мер (collection.html) · 2026-07-21 ──
база ветки для этого плана: 1fb66c8
- Collection-Settings Task 1: RULES-слой + рероут чтения — complete (commit abe8fb5, 62/62 PASS, review чист: Spec ✅ / Quality Approved)
  RULES over frozen RULES_DEFAULTS (deepClone/deepFreeze/phasesOf); 12 сайтов чтения переведены на RULES.*/phasesOf; CONTOUR_LEVEL остался константой. Out-of-brief фикс: phaseTimeline читал cont.name после удаления const cont → заменён на CONTOURS[p.contour].name (behavior-preserving).
  Minor (в финал): phaseTimeline дважды смотрит CONTOURS[p.contour]; коммент @907 потерял выравнивание. Оба косметика.
Task 16: complete (commits d819ea5..a66de98, review clean) — Р-20 ось запрета залогодателя (ПБК п.2.1), banFullyRegistered/releaseValid, markInOriginals/confirmedBy, mid-trigger «отметка не получена», reconAct-гейт снятия. 45/45.
  Minor→T23: zalog.html:1832 banMissing trigger act-текст «Наложить запрет...» не обновлён под новую формулировку залогодателя (может закрыться T21 rewrite шапки).
- Collection-Settings Task 2: персист/сброс правил — complete (commit 4fd5c43, 65/65 PASS, review чист: Spec ✅ / Quality Approved)
  RULES_KEY='asubk-collection-rules-v1' (отд. от STORE_KEY); persistRules/restoreRules(merge по ключам DEFAULTS+try/catch+?reset)/resetRulesAll/resetRulesSection; restoreRules ПЕРЕД restoreState в bootstrap. Harness-фикс: mk() JSDOM +url:'http://localhost/' (иначе SecurityError opaque origin на localStorage) — прежние 1-62 не читают localStorage, значение не изменилось, изоляция сторэджа между mk() подтверждена.
- Collection-Settings Task 3: экран #settings каркас — complete (commit f8e84e0, 70/70 PASS, review чист: Spec ✅ / Quality Approved)
  Шестерёнка в topbar (.menu reuse), section#view-settings (tabbar/host/footer, показ через generic showView display:flex), settingsTab='v9', renderSettings/showSettingsTab, 4 стаб-рендера, регистрация в showView.titles+render-on-enter и restoreFromHash.views. CSS-подстановка --brand→--asubk-blue (#006AF5, как .dtab.active; в обоих местах). Minor: font-weight:600 хардкод (бриф-спека, не дефект).
- Collection-Settings Task 4: вкладка В-9 «Кому» — complete (commit ff4d441, 74/74 PASS, review: Spec ✅ / Quality Approved с Minor; deviation ACCEPTABLE)
  Грид 48 мер × 6 подразделений (чекбоксы subdivOf), таблица роль→подразделение, бейдж «никто не сможет»; toggleV9(материализация из subdivOf при 1-й правке)/setRoleSubdiv. DEVIATION (санкц.): бриф-рендер (section-header tr + role-table на .settings-grid) несовместим с тестом 71 (tbody tr===MEASURE_KINDS.length) → section-name как inline-label .v9-sec-label в 1-й ячейке, role-table на своём классе .role-grid. Грид=ровно 48 строк, тест 71 не вакуумный.
  Minor→ФИНАЛ (реальный дефект): .v9-sec-label{ font:11px/1.2 var(--font-label) } — --font-label сам полный font-shorthand → невалидный CSS, стиль лейбла сбрасывается на inherited. ФИКС: font:var(--font-label) или longhands font-size/line-height/font-family. Группировка не теряется (цвет+своя строка), но не мелкий/muted.
  Minor→ФИНАЛ (нит): .role-grid дублирует правила settings-grid; можно было combined-selector, не дефект.
Task 17: complete (commits a66de98..6199aa9, review clean) — Р-19 хвост: override только вниз (overrideAllowed ПОЛ §2.1, роль canHeadOfUnit, above-calc escape hatch удалён), isOverAbove/beyondDiscount оставлены для legacy-показа, П-005 legacy:true+плашка+триггер, docRoute ПОЛ §11 (DOC_ROUTE_DAYS=30, docRouteIncomplete, блок в ctrPanels, Д-004 демонстратор, contract-триггер). 47/47.
- Collection-Settings Task 5: вкладка Стадии — complete (commit f2790b0, 76/76 PASS, review чист: Spec ✅ / Quality Approved, ноль findings)
  Селект мин.ступени 0–5 на каждый раздел SECTION_ORDER (RULES.sectionClevel, Number(level) — без string-порчи sequenceReason), сброс секции. CONTOUR_LEVEL не тронут. Тест 76 не вакуумный (Досудебный 1→4: before=null→after blocked на К1).
- Collection-Settings Task 6: вкладка Гейты — complete (commit b947c46, 78/78 PASS, review чист: Spec ✅ / Quality Approved, ноль findings)
  Один тумблер «гейт активен» на запись RULES.gates (флаг off: delete/true), справочная колонка требования; toggleGate; gateReason +«|| g.off»→null. Добавление гейта к виду без гейта НЕ реализовано (YAGNI, санкц.). Тест 78 real (151 без poruchenie: blocked→off→null).
- Collection-Settings Task 7: вкладка Фазы — complete (commit 18c335e, 81/81 PASS, review чист: Spec ✅ / Quality Approved, ноль findings)
  Блок .phase-contour на каждый контур (phasesOf — RULES-backed), ↑/↓ reorder (disabled на границах), movePhase(swap i↔i+dir, guard oob, мутирует ТОТ ЖЕ массив что читают phasesOf/sequenceReason — без slice-копии), сброс секции. Add/remove невозможен (только swap). Тест 81 real+изолирован (reset в начале/конце, флип sequenceReason null→«веха пройдена»).
Task 18: complete (commits 6199aa9..5f076c9, review clean) — Р-23 riskFactorCandidates (чистая, ПОР п.12 п.п.2), панель факторов для комитета в реестре мониторинга (send+repeat-block store riskFactorsSent), триггер страховки act→«направить фактор». 49/49. No findings.
- Collection-Settings Task 8: интеграция + браузерный смоук — complete (commit b243b2d, 81/81 PASS)
  Фикс Minor из Task 4: .v9-sec-label валидный CSS. Браузерный смоук (localhost:8971, реальный reload): Судебный→4 персист в rules-key (отд. от state-key), переживает F5, блок судебных мер на К1/204, resetRulesAll→2 открывает. 5/5 пунктов плана.
  ОСТАВШИЕСЯ Minor→финал-ревью: (T1) phaseTimeline дважды CONTOURS[p.contour]; коммент @907 выравнивание; (T3) font-weight:600 хардкод (брифом); (T4) .role-grid дублирует .settings-grid. Все косметика.
=== ПЛАН collection-rules-settings ЗАВЕРШЁН: 8/8 задач, 57→81 проверок, коммиты abe8fb5..b243b2d, база 1fb66c8 ===
Task 19: complete (commit 5f076c9..6955262, done INLINE by controller — trivial header-comment reframe) — Р-21 границы модуля: блок «ОТКРЫТО (Р-10)» удалён, реформулирован как «ГРАНИЦЫ МОДУЛЯ (Р-21)» (override закрыт Р-19 п.2, гарантия/поручительство закрыты Р-11/Р-21). 50/50.
  PLAN-DEFECT (fixed): brief/plan R21-1 assertion hasNot('ОТКРЫТО (Р-10)') был ВАКУУМНЫМ — реальный маркер «ОТКРЫТО (Р-10 —» (тире, скобка далеко), строка с ')' никогда не совпадала. Добавлены зубастые assert hasNot('ОТКРЫТО')+has('ГРАНИЦЫ МОДУЛЯ (Р-21'). Плановая строка оставлена дословно рядом.
Task 20: complete (commits 6955262..9a08f58, review clean after 1 fix) — §16 справочник: 21 параметр с пометкой источника (норматив—цитата / внутренний), норматив read-only под реквизит решения Правления, внутренний свободно; добавлены COVER_GUARANTEE/_FX, WEAR_LIMIT, DOC_ROUTE_DAYS, RELEASE_GROUNDS/APPROVALS/CHANNELS, ORG_REGISTRY. FIX 9a08f58: SURVEY_MATRIX → полностью read-only + «реализует surveyInterval» (Important от ревью). 56/56.
  Minor→T23: blur-race в saveRefbook (клик Сохранить до blur реквизита Правления → ложный тост); jsdom не воспроизводит, edge, аддитивно.
Task 21: complete (commits 9a08f58..98caec9, done INLINE by controller — citation-heavy header, авторская точность) — §19 шапка: п.3 (индекс обеспеченности + override вниз), п.5 (переменный порог + 4-й гейт §2.6), п.7 (ось запрета Р-20 ПБК п.2.1 + формула Р-23 ПОР п.12), блок «СООТВЕТСТВИЕ Р-11…Р-23» с цитатами, РОЛИ обновлены (canHeadOfUnit override). Head-1 добавлен. 57/57.
  NOTE: словил и починил собственную регрессию R21-1 (строка Р-21 сначала содержала литерал «ОТКРЫТО (Р-10)» → hasNot падал; переформулировано). Amend.
  T23-REVIEW-TARGET: блок СООТВЕТСТВИЯ несёт конкретные цитаты (П1 §2.3, П3 §3.5, П2 §2.3/§2.4, ПОЛ §6.4/§2.1/§11, ПБК п.2.1/п.2.2, ПОР п.10/п.12) — свериться с кодом на точность в финальном ревью.
Task 22: complete (commits 98caec9..424466e, review clean, ZERO findings) — §17 демо-ветки Р-11…Р-23: новые К-99/К-100/К-102/К-103/К-104, П-015…П-023, Д-013…Д-016 (id таблица плана была устаревшей — параллельная сессия заняла Д-012/П-014/К-101 → переприсвоено, mapping в отчёте). К-99 индекс=1.00, К-95=0.55. R11-9 переписан (К-95 семантика flip), R11-11 развакуумлен (поручительство idxGuar=0). Header: 2 предложения про К-95 (минимальная коррекция под новые данные). Логика не тронута. 65/65 (+8).
Task 23: complete (commits 424466e..76ac822) — Reg-47 регрессия Р-1…Р-9 добавлена (66/66). ФИНАЛЬНОЕ WHOLE-BRANCH РЕВЮ (opus): READY TO MERGE, 0 Critical/Important. Цитаты Р-11…Р-23 сверены с кодом (совпали), pure-функции чисты, демо когерентно, тесты с зубами, Р-1…Р-9 живы.
  Fix-now из финала (commit 76ac822): 3 bare-§ в новых UI-строках → П1 §2.6 / Прил.2 §2.3 / ПОЛ §8 (Global Constraint); svGfhName/svGfhPost теперь пишутся в survey-record (T13 minor закрыт); R23-43 усилен ok(f) (убран вакуумный if).
  Триаж minors: T11/T14/T15/T16(act-текст 2182)/T20/enum-статус/дубль-пересчёт — ACCEPTABLE для макета (обоснования в отчёте ревью). T13 — исправлен.
== ВСЕ 24 ЗАДАЧИ T0-T23 ЗАВЕРШЕНЫ. Branch READY TO MERGE. ==
