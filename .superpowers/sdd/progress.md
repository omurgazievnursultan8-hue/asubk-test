# Прогресс: конструктор реструктуризации (2026-07-23)

Plan: docs/superpowers/plans/2026-07-23-restructuring-calculator.md
Spec: /home/azamat/Downloads/prompt-restructuring-calculator.md
Branch: main (docs-workspace, линейная история)
Base: af21afe
Smoke: node scripts/inspect/restructuring-check.mjs (node:vm, НЕ jsdom)
Финальная цель: 41/41 PASS (11 регресс #1–11 + 30 новых #12–41)

Задачи:
- Task 1: модель snapshot/paid/remTerm + versionFrom (#12–13)
- Task 2: движок amortize (#14–18)
- Task 3: льготы grace (#19–21)
- Task 4: гейты termCap/rateFloor (#22–23)
- Task 5: конвейер calcRestructure (#24–33, #37–41)
- Task 6: applyEntryOps из плана + a1 (#34–36)
- Task 7: UI 4 панели (браузер-проверка)
- Task 8: канон Р-20…28, статус-файл, штамп

## Журнал
Task 1: complete (commit af21afe..d283d0c, 13/13 PASS, review clean)
Task 2: complete (commit d283d0c..280dafb, 18/18 PASS, approved)
  Minor (в финальное ревью): (1) дубль циклов аннуитет/дифф в amortize — можно вынести шаг периода;
  (2) i=rate/100×p/12 — номинальное масштабирование (не компаунд) для p>1, по контракту, заметка продукту;
  (3) нет гварда principal<0 при экстремальных rate/term — вне охвата, для стресс-тестов движка.
Task 3: complete (commit 280dafb..fe8acfe, 21/21 PASS, approved)
  Minor (в финальное ревью): устаревший комментарий amortize ~стр.447 «Task 3 добавит строки» — теперь мёртвый, убрать.
Task 4: complete (commit fe8acfe..18df941, 23/23 PASS, approved, чисто)
Task 5: complete (commit 18df941..56f3cfc, 38/38 PASS, approved)
  Контроллерское решение (не в брифе): (1) +5 тестов #37–41 после #33 → 15 новых в Task 5, итог 38/38 (нумерация пропускает #34–36 = Task 6);
  (2) гвард в toast(): `if(typeof document==='undefined') return;` первой строкой — иначе calcRestructure валидация бросает под node:vm (тест #26).
  Minor (в финальное ревью): (1) newRate/newTerm = Number(v.params.x)||cr.terms.x — при вводе 0 (ставка 0% льготная) молча откатывает к исходной; унаследовано из старого calcGraph, тикет на будущее;
  (2) тест #39 слабый ассерт (maturity.length===10), не точная дата;
  (3) totals.old.regularPay = первая строка, new.regularPay = последняя (асимметрия, verbatim бриф, вероятно намеренно — платёж после льготы).
Task 6: complete (commit 19846c6..f890da2, 41/41 PASS, approved)
  ВНИМАНИЕ ветка: между T5 (56f3cfc) и T6 вклинился ЧУЖОЙ коммит 19846c6 (docs borrower-rework, другая фича/сессия); ветка теперь feat/borrower-rework, НЕ main. Коммит только добавил spec-файл — ноль пересечений с restructuring. База ревью T6 = 19846c6 (родитель f890da2), не 56f3cfc. Спросить юзера про ветку в конце.
  Minor (в финальное ревью): (1) `const s=plan.base;` в блоке forgivePenalty (~1238) — мёртвая переменная, verbatim из брифа, убрать;
  (2) статический a1.ops «Прощение санкций» before/after=12000→0 (~706) расходится с новой snapshot-конвенцией applyEntryOps (73000→61000) — pre-existing, вне охвата брифа, но demo-журнал внутренне несогласован;
  (3) `try{}catch(e){}` в reconcile-цикле (~786) глушит молча, verbatim бриф — добавить console.error.
Task 7: complete (commit UI 1577332 + фикс Р-3 9295ea6, 41/41 PASS, approved после фикса; браузер-проверка обоих путей рендера + обеих сторон гейта)
  ВНИМАНИЕ ветка: снова вклинились ЧУЖИЕ коммиты параллельных сессий (borrower/credit/zalog: 51bd4eb, 22b58bf, a4c81d7, afc5c04, fca1c84) — трогают borrower.html/credit.html/zalog.html, НЕ restructuring. Базы ревью изолированы вручную (T7=51bd4eb..1577332, фикс=22b58bf..9295ea6). progress.md теперь ОБЩИЙ для 4 фич (см. низ файла — borrower-план).
  Контроллерское решение (одобрено юзером): Р-3 finding из ревью УПРАВЛЯЕТ над verbatim-планом — гейт ops-editor cap/forgive/grace по allowedParams + удаление decoy-полей из сетки «Параметры версии» (НЕ из PARAM_KEYS — там нужны для лейблов видов/авторинга). Отклонение от плана зафиксировано.
  Minor (в финальное ревью): (1) inp.forgivePenalty/capInterest/capPenalty в value="${...}" без esc() (~1057) — не эксплойт (setInput коэрсит в Number), стиль-нестыковка; (2) matOld/matNew в Panel A без esc() (~1069) — вычисляемая дата, низкий риск; (3) addGrace всегда пушит хардкод {months:3,type:'interest-only'}, нет UI редактирования блока — verbatim бриф, функц. ограничение макета.
Task 8: complete (commit c26d03e..c2da7f3, docs-only, 41/41 PASS, approved — обе оценки чисто, 0 находок). Канон Р-20…Р-28 (§19 logika.md), ОВ-1/ОВ-2 (§17), матрица §18 → 41/41 (2026-07-23) + строка #37–41, приложение Р-20…28 + журнал, создан ASUBK-status-razrabotki.md. Контроллер-оверрайд: брифовые «36»→«41» везде (бриф Self-Review сам это предписал). Коммит чист: 2 файла, оба mockups/restructuring/, без вклинивания (c26d03e — прямой родитель); restructuring.html не в коммите (штамп 41/41 уже байт-идентичен). ВСЕ 8 ЗАДАЧ ГОТОВЫ.

ФИНАЛЬНОЕ РЕВЬЮ (opus, диапазон af21afe..c2da7f3, scoped на restructuring-файлы): вердикт MERGE AFTER FIXES. Ядро подтверждено верным — конвейер Р-21/23, база Р-22, границы гейтов Р-25 (ровно 1M/10M/20M/50M — без off-by-one), rateFloor, дисциплина Р-19. 2 Important дефекта → пофикшены (commit 8bc3351, 41/41):
  F2 (обход регуляторного гейта): newRate/newTerm = `Number(x)||orig` — ввод 0 (0% ставка) молча откатывал к исходной, обходя rateFloor (жёсткий гейт без waiver) + рассинхрон Панель A vs график. Фикс: numOr() сохраняет литеральный 0 → rateOk=false → блок графика. Это апгрейд бывшего Minor #5 (T5) до MUST-FIX.
  F1 (дата погашения ≠ график при grace): totals.new.maturity = cutoff+(newTerm+gsum)×30, но amortize вмещает grace ВНУТРИ срока (m=nTotal−gMor−gIo) → последняя строка на newTerm мес. Фикс: убран +gsum (и мёртвый const gsum); #39 усилен на точную дату (было mat=2031-09-21 63мес → стало 2031-06-23=exp 60мес, доказывает баг и фикс). addCalDays экспортирован в RS.
  Git-race при фиксе: беспатхспековый commit подмёл 4 чужих staged-файла (borrower/credit), пойман через git show, откат reset --soft HEAD~1 + selective reset, чистый рекоммит 8bc3351 (2 файла). Урок: на общей ветке всегда `git add <pathspec>`, никогда голый `git commit`. Проверено контроллером: reflog cf4d669→reset→8bc3351, рабочее дерево чужих сессий не тронуто.
  Отложено на будущее (opus триаж — DEFER для макета): F3 (мораторийная база не отражена в base.total — только при moratorium-grace, нет в демо) + 10 из 12 Minor (стиль/дубли/номинальная ставка по контракту/esc() на числовых полях/хардкод grace-блока). Список Minor — в строках Task 2/3/5/6/7 выше.
  ГОТОВО К ЗАВЕРШЕНИЮ ВЕТКИ. Блокер: ветка feat/borrower-rework общая на 4 фичи — спросить юзера про стратегию завершения (см. ниже).

---

# Прогресс: переработка borrower.html в исполнимый MVP (2026-07-23)

Plan: docs/superpowers/plans/2026-07-23-borrower-rework.md
Spec: docs/superpowers/specs/2026-07-23-borrower-rework-design.md
Branch: feat/borrower-rework
Base: 51bd4eb (коммит плана)
Smoke: node scripts/inspect/borrower-check.mjs (jsdom)
Финальная цель: 26/26 PASS + штамп в шапке borrower.html

Задачи (11):
- T1 каркас: ретокен gen-1→gen-2, секции скрипта, jsdom-харнесс
- T2 модель состояния: факт/зеркальные массивы, реестр из SUBJECTS
- T3 категория: catByDays/isSuppressed181/catOfCredit/catOfBorrower (#1–7)
- T4 группа: groupOf лестница-доминирование (#8–11)
- T5 долг: totalDebt/overdueDebt/coverageOf (#D1–D3)
- T6 обязательства: addWorkdays/obligations О-1/О-2/О-4 (#12–17)
- T7 очередь: committeeQueue (#18–20)
- T8 конфликт: conflictState/suspendedEmployees (#21–24)
- T9 субъект/кураторство: subjectState/isReadOnly/curatorMatrix (#25)
- T10 рендер: 4 плитки, 11 вкладок, зеркала read-only (#26)
- T11 интеграция: 26/26 PASS, штамп, DoD

## Журнал
Task 1: complete (commit afc5c04..a4c81d7, 2/2 PASS, review Approved)
  Ветка feat/borrower-rework делится 4 сессиями (borrower/credit/zalog/restructuring), файлы непересекающиеся. База ревью = родитель МОЕГО коммита (чужие вклиниваются), НЕ branch-HEAD. Brief/report снапшочу в *-borrower-*.md.
  Important (плечо T2): T1 удалил DATA, но route() ещё звал DATA.find → ReferenceError, замаскирован пустым хэшем. Резолюция: план Task 2 усилен Step 4b + тест S7.
  Minor (финальное ревью): .b-ok бейдж держит border, gen-2 конвенция убирает border у success-пилюль — визуальный проход.
Task 2: complete (commit c2da7f3..ab4e7e5, 9/9 PASS, review Approved, чисто)
  База ревью = c2da7f3 (родитель ab4e7e5 = чужой restructuring-коммит c2da7f3 вклинился между c26d03e и моим).
  Известный баг (плечо T9/T10 рендер субъекта): showSubject() ~стр.820 читает b.subj.kind==='person', но SUBJECTS-записи держат personKind напрямую (нет вложенного .subj) — pre-existing из T1, путь #/s/<inn>, НЕ покрыт S7 (#/b/ only). Флаг для задачи, что строит страницу субъекта.
  Minor (не дефект): S3 (CREDITS пуст) вакуумно-истинный — зеркала наполняются позже, присуще брифу T2, не вина имплементера.
Task 3: complete (commit f496fd5..c12628a, 16/16 PASS, review Approved, чисто)
  База ревью = f496fd5 (родитель = чужой credit-коммит). Ревьюер вручную протрассировал тесты 2/3/5/6 — категорная математика верна (подавление 181 до worst-of, И-1 committeeRef, И-3 null).
  Поправка брифа (контроллер): Step 5 «15/15 (8 prior)» устарел после S7-поправки T2 → реально 16/16 (9 prior+7). Имплементер попал точно.
  Minor (финальное ревью, унаследовано из брифа, НЕ вина имплементера): catOfCredit делает CREDITS.find(id) без гварда «не найдено» — неизвестный id бросит на cr.overdueDays. Тесты плохой id не подают. Робастность-тикет.
Task 4: complete (commit 8bc3351..31153ba, 20/20 PASS, review Approved, чисто; контроллер сам проверил смоук 20/20)
  База ревью = 8bc3351 (родитель = чужой restructuring-коммит). Первый диспатч имплементера успел закоммитить ДО того, как долетел interrupt юзера — второй диспатч нашёл готовое и верифицировал; контроллер подтвердил git+смоук лично.
  Поправка брифа (контроллер): Step 5 «19/19» устарел → реально 20/20 (16 prior+4). Плюс branch-11 проза в Step 3 — не реализуется (не покрыта тестами 8–11), реализован только код-сниппет.
  Minor/design-notes (финальное ревью): (1) дублирован терминальный предикат (g==='5'||g==='4'||g[0]==='3') дважды ~стр.839/841 — helper isTerminal() убрал бы; (2) ⚠️ нет старшинства среди Block1-исходов (3.1/3.2/4/5): block1||g берёт первый по порядку итерации — не покрыто демо, бриф не задаёт правило; (3) ⚠️ myCredits в groupOf НЕ фильтрует closedAt (в отличие от catOfBorrower T3) — по брифу так и надо (тест 11 держит группу после закрытия кредита через GROUP_LOG), но несогласовано с паттерном T3 — сюрфейс для задач, что строят на groupOf.
Task 5: complete (commit a0d3db0..ebfe701, 23/23 PASS, review Approved — 0 находок обеих оценок)
  База ревью = a0d3db0 (родитель = чужой zalog-коммит). D1=16348000, D2=9898000 протрассированы ревьюером. coverageOf — истинное зеркало индекса (min/взвеш-средн), не сумма залогов; guard {null,null,1.20} до Math.min (нет Infinity-утечки); C-B14-1 orphan row засеян для T9, не течёт в ветку 1. Поправка брифа: «22/22»→23/23 (20 prior+3).
Task 6: complete (commit 9174f0a..6fbbf75, 29/29 PASS, review Approved, чисто)
  База ревью = 9174f0a (родитель = чужой credit-коммит). Самая логико-плотная задача. Контроллер вручную протрассировал рабочие дни: тест 15 требовал 09.03.2026 (Женский день перенесён с вс 08.03) в WORKDAYS — без него addWorkdays='11.03', с ним ='12.03'. Дал имплементеру точный фикс данных. Ревьюер перепроверил Zeller через Python — совпало. Поправка брифа: «28/28»→29/29 (23 prior+6). НЕТ Date() нигде (только в комменте).
  Minor/design-notes (финальное ревью): (1) косметика — имплементер слил 2 деструктуризации в const [,mm,y] (эквивалентно); (2) ⚠️ pre-existing: totalDebt/overdueDebt хардкодят TODAY, не берут d из obligations(inn,d) — не сквозная параметризация датой, латентно для историч. запросов, вне охвата T6; (3) ⚠️ унаследовано из брифа: trig берёт РАННИЙ mid/high из CATEGORY_LOG (.sort()[0]), не последний переход — устареет при мульти-переходах, латентная неоднозначность спеки для будущей задачи.
Task 7: complete (commit cfda0d6..b76afec, 33/33 PASS, review Approved — 0 находок)
  База ревью = cfda0d6 (родитель = чужой zalog-коммит). Поправки брифа (контроллер): (1) тест 18 — только упрощённая версия (сложный ternary-черновик отброшен) → 4 новых теста 18/18b/19/20; (2) «31/31»→33/33 (29 prior+4); (3) waitingDays: calDays(...) вместо сломанного Math.floor()&&-хака (сам бриф в Note советовал); (4) Date.UTC(y,m-1,d) с полным набором арг — чистый детерминир. статик, РАЗРЕШЁН (не clock-read), в отличие от new Date()/Date.now(). Регрессия проверена: FACTORS-строка C-CHE-3 не двигает уровень (уже high по 220 дн) и group test 8 читает PROCESSES.
Task 8: complete (commit 63c17eb..c631a68, 37/37 PASS, review Approved)
  База ревью = 63c17eb (родитель = чужой credit-коммит). Поправка брифа: «35/35»→37/37 (33 prior+4). Все 4 теста протрассированы (фаза-лестница монотонный override, noticeOverdue строгий >3 к.д. + отсутствие boardNoticeAt, suspendedTo передача-дела/closedAt, И-4 по всему ИНН).
  Minor (финальное ревью, brief-артефакт, НЕ вина имплементера): CF-01 коммент/тайтл теста-21 говорит фаза «заявлен», но по датам (svbAt/boardNoticeAt ≤ TODAY) computed = «на рассмотрении». .phase не проверяется тестом → не влияет. Наименовательная неоднозначность брифа.
Task 9: complete (commit c631a68..98669fa, 40/40 PASS, review Approved)
  База ревью = c631a68 (родитель = МОЙ T8-коммит, без чужого вклинивания). Поправка брифа: «38/38»→40/40 (37 prior+3: 25a/25b/25c). C-B14-1 PLEDGE_IX-orphan из T5 теперь резолвится. Механизм 25c подтверждён: emp-09 выброшен ПРАВИЛОМ latest-wins per (objectId,role) (emp-30 21.06 > emp-09 01.03), НЕ отстранением (CF-13 снят передачей дела 20.06, suspendedEmployees уже не листит emp-09) — не проходит по неверной причине. Suspension-фильтр применён ПОСЛЕ latest-wins дедупа (порядок верен).
  Minor (финальное ревью): (1) objIds билд O(pledges×credits) на вызов — стиль/эффективность, не дефект; (2) ветка !a.to||!dateLE(a.to,d) — мёртвая (нет .to в сиде), защитный future-proof консистентно с catOfCredit.
Task 10: complete (commit 9bec744..9602b4d, 45/45 PASS, review Approved). Самый большой диф (~38KB).
  База ревью = 9bec744 (родитель = чужой credit-коммит). Поправка брифа: «44/44»→45/45 (40 prior+5: R1/R2/R3/26/R4). 4 плитки + 11 вкладок, И-5 data-mirror без контролов (тест 26), no-derived-in-markup (категория из CAT_LABEL[catOfBorrower]). ВСЕ 11 *Tab-хелперов определены (нет ReferenceError). ИЗВЕСТНЫЙ БАГ T2 ЗАКРЫТ: showSubject b.subj.kind → s.personKind==='физ', renderSubject читает SUBJECTS напрямую, ноль .subj в файле. Сигнатуры renderCard/renderSubject (b)→(inn) сверены во всех call-sites.
  Minor (финальное ревью): (1) historyTab CSS-мисматч — .tl-item получает k-risk/k-grp/k-conf, но ::before красит по .risk/.kur/.conf → точки таймлайна всегда синие (косметика, тест не покрывает); (2) checksTab зовёт catOfBorrower дважды в одном выражении (лишний пересчёт); (3) st.successorInn в плитке/баннере без esc() (verbatim бриф, числовой ИНН, низкий риск); (4) historyTab GROUP_LOG и SUBJECT_EVENTS под одним бейджем k-grp (дизайн-шорткат, 4 цвета).
Task 11: complete (commit 9602b4d..c47f7e9, 47/47 PASS, review inline — тривиальный 12-строчный диф: 2 теста B/B2 + штамп шапки, проверено контроллером лично).
  КОНТРОЛЛЕР-ОВЕРРАЙД (как в restructuring T8): брифовые «26/26» = устаревший номинал спеки. Реальный harness-тотал = 47 (по ok()-вызовам). НЕ схлопывал/не удалял ассерты ради косметического «26» — сохранены все, штамп = фактические 47/47. Тесты B (≥10 строк) + B2 (GROUP_LABEL 3.2). DoD: gen-1 токены чисто, derived-text grep = 3 статических <option> лейбла фильтра (не значения карточки), wc=1434 (≥1200). Коммит = 2 borrower-файла (explicit pathspec, чужие working-tree правки не тронуты).

=== ВСЕ 11 ЗАДАЧ ГОТОВЫ (2026-07-23). Финальный смоук на HEAD c47f7e9 = 47/47 PASS. Штамп в шапке borrower.html = 47/47. ===
  Драйф счётчика (накопительно +целевой номинал): план считал 26 логич. сценариев; реальные ok()-тоталы по задачам 2/9/16/20/23/29/33/37/40/45/47. Каждая задача — контроллер-поправка «brief N/N → реальный N/N» (S7-поправка T2 сдвинула всё на +1, плюс под-буквенные тесты 18b/25a-c/R*).
  Скоуп-файлы (непересекающиеся с 3 др. сессиями): mockups/borrower/borrower.html + scripts/inspect/borrower-check.mjs. Финальное ревью-дифф = afc5c04..c47f7e9 -- <эти 2 файла> = .superpowers/sdd/review-borrower-FINAL.diff (2482 стр).
  ОСТАЁТСЯ: (1) ~~широкое финальное ревью~~ СДЕЛАНО; (2) вопрос юзеру про стратегию завершения ОБЩЕЙ ветки feat/borrower-rework (4 фичи: borrower/credit/zalog/restructuring; restructuring уже ГОТОВ к завершению — см. верх файла).

ФИНАЛЬНОЕ РЕВЬЮ (opus, scoped afc5c04..c47f7e9 на 2 borrower-файла): вердикт MERGE AFTER FIXES. Все 5 инвариантов И-1…И-5 держатся по всему файлу, детерминизм (единств. Date = Date.UTC в calDays, чистый), facts-only, gen-2 токены — чисто. Общие хелперы определены по одному разу, семантика консистентна. Триаж ledger подтверждён (все ~14 Minor верно классифицированы, ни один не Important).
  1 IMPORTANT (НЕ было в ledger, пропущено потасковыми ревью): переключатель «Таблица↔Карточки» — мёртвый контрол. #cardsWrap shipped hidden и НИКОГДА не наполнялся, renderCards отсутствовал, setListView только красил кнопку+persist localStorage → клик «Карточки» сохранял сломанное состояние, но карточки не рендерились. Спека §1/§4 требует рабочий тумблер. → ПОФИКШЕНО (commit 58efe01): renderCards() из SUBJECTS теми же guarded-хелперами (без контролов, клик-открытие, значения из функций), setListView рулит видимостью gridWrap/cardsWrap + рендерит по активному виду, стартовый вид по persisted listView. +3 теста V1/V2/V3 → 50/50 PASS. Штамп шапки → 50/50. Коммит = 2 borrower-файла (git show --stat чист).
  Minor-бэклог (DEFER, follow-up тикет — НЕ блокеры мёржа): (1) NEW: statusOf эмитит только 'в срок'/'просрочено', контракт §3 обещает ещё 'не наступило'/'исполнено' (нет факта завершения в модели, MVP-ок); (2) NEW: data-mirror не размечен на actsTab/curatorTab/monitoring-очереди (И-5 держится т.к. контролов нет нигде, но тест 26 не поймает будущий <input> в неразмеченном зеркале — робастность теста); (3) NEW: 5 мёртвых typeof-guard в renderList (все функции теперь есть); (4) esc() экранирует только &/< (не кавычки/>) в ~50 атрибут-контекстах, successorInn без esc (числовой ИНН, низкий риск); (5) historyTab CSS k-risk/k-grp/k-conf vs ::before .risk/.kur/.conf → точки таймлайна синие; (6) groupOf all-credits vs catOfBorrower active-only — НЕ баг (группа переживает закрытие через GROUP_LOG, test 11); (7) obligations/totalDebt хардкод TODAY (латентно для историч. дат); (8) groupOf Block1 без старшинства 3.1/3.2/4/5; (9) O-1 trig = ранний mid/high не последний; (10) checksTab double catOfBorrower.

=== ФИЧА BORROWER ЗАВЕРШЕНА: 11 задач + 1 фикс финального ревью, все отревьюены, HEAD 58efe01, 50/50 PASS, штамп 50/50. Готово к завершению ветки — ЖДЁТ РЕШЕНИЯ ЮЗЕРА по общей 4-фичной ветке. ===

---

# Прогресс: мокап модуля «Кредиты» (credit.html) (2026-07-23)

Plan: docs/superpowers/plans/2026-07-23-credit-module-mockup.md
Spec: /home/azamat/Downloads/prompt-kredit-mockup.md (канон, решения Р-1…Р-20, гейты Г-1…Г-17)
Branch: main (docs-workspace)
Base: f890da2
Smoke: node scripts/inspect/credit-check.mjs (node:vm, НЕ jsdom)
Финальная цель: 28+ сценариев (§9) + штамп «SMOKE (node) <дата> · N/N PASS» в шапке credit.html

Задачи (9):
- Task 1: скелет + токены + модель/seed + smoke-харнесс (#0a, #0b)
- Task 2: derive (§4) — производные, ничего не хранится
- Task 3: gate (§6, Г-1…Г-17) + canRole (§7)
- Task 4: buildSchedule (§4 график)
- Task 5+: мутации, UI-вкладки, реестр, интеграция

## Журнал
Task 1: complete (commit f890da2..fca1c84, 2/2 PASS #0a/#0b; фикс полей seed — доп. коммит ниже)
  Ревью-фикс (Important ×2): (1) applications.status→approved(bool), hasCredit→creditId — Task 3 gate('createCredit')/тест#3 читают a.approved/a.creditId; ЗАЯ-1042.creditId='K-1' (обе половины Г-2);
  (2) pledgesRegistry.inn→pledgorInn — Task 3 gate('linkPledge')/тест#17 читают p.pledgorInn; сохранены совпадающий ИНН K-1 и иностранный ЗД-99.
  Minor (в Task 9): двойная строка «SMOKE (node)» в шапке — verbatim из harness-кода плана, косметика.
Task 2: complete (commit 22b58bf..c26d03e, path-filtered credit-only diff; 6/6 PASS #0a/0b/19/20/21/25, review Approved)
  Seed-правка: K-2 → движимое неликвидное (ЗД-91 illiquid рядом с ЗД-90 liquid), liquidShare 84.8%≥80% → req=150 (тест #20 честный); K-1 остаётся all-liquid→120; count=15.
  Minor (в финальное ревью): (1) порог ≥80% ветвит только label — обе ветки req=150; свериться с каноном П1§2.4 (нужно ли отдельное правило для <80%);
  (2) debt.principal.accrued=principalPaid+bal и penalty.overdue=penaltyBal — эвристики без реальных ledger-колонок; Task 5 (Платежи) должен дать настоящие колонки, добавить // TODO Task 5 в обоих местах (сейчас размечено одно);
  (3) строка графика в hold-период проседает под annuity (interest=0, principal=annuity−bal*i) — косметика модели, правило «нет процентов в hold» соблюдено.
Task 3: complete (commit c26d03e..f496fd5 + фикс-тестов af82d6a, 16/16 PASS #1/2/3/4/6/9/12/17/23/26, review Approved после фикса)
  gate() Г-1…Г-16 + canRole() 5 ролей; логика верна с первого раза (0 seed-правок), поля сверены с реальной моделью.
  Ревью-фикс (Important ×2, тест-гигиена): (1) тест#6 (Г-5) использовал K-1 транш №1 (полностью освоен) → маскировался Г-4; → K-1 транш №2 + ассерт reason /освоение возможно только при жц/; (2) тест#9 (Г-7) на K-5 (покрытие 84%) → маскировался coverage-гейтом; → K-1 (132%) + only reg.scan=null + ассерт reason скан/номер-дата. Изоляция подтверждена: удаление целевой строки гейта роняет соответствующий тест.
  Concerns форвардные: (1) mirror.pledgeWaiver ещё не в seed — нужен для Г-6/Г-7 exception, добавит Task 5 (waiver-мутация); (2) requiredDocsComplete (docState∈{принят,не требуется}) — трактовка §5.3, свериться при постройке вкладки Договор/register (Task 7).
  ИНЦИДЕНТ общего бранча: первый коммит имплементера подхватил чужие staged-файлы параллельной сессии; пойман, reset --soft, перекоммичен чисто. ВПРЕДЬ: имплементерам — только `git add <явные пути>`, никогда `git add -A`/`git commit -a`.
Task 4: complete (commit af82d6a..9174f0a, 20/20 PASS #8/10/11/24, review Approved, чисто)
  generateSchedule (демоут active→archive, ver+1, ровно 1 active — структурный инвариант) + holdAccrual (Г-15) + threading accrualHold в buildSchedule (interest=0 в hold, penalty нетронут).
  Реконсиляция accrualHold: holdAccrual пишет в credit.accrualHold (читают derive/overlays/Г-15) И зеркалит в каждый tranche.accrualHold (buildSchedule(tranche,..) видит через транш — сигнатура 2 арг). Оба независимых push, credit-level reads целы.
  Побочные фиксы (TDD): (1) pd() идемпотентна — `if(s instanceof Date) return s` (тест двой-оборачивал дату → Invalid Date); (2) тест#24 → buildSchedule(...).rows (возвращает {rows}, контракт Task 2).
  Minor (в финальное ревью): (1) pd() возвращает тот же Date ref, не клон — латентный aliasing, `new Date(s)` безопаснее (нет живого бага); (2) тест#24 `some()` слабый (из брифа) — не проверяет ВСЕ hold-строки/границы; (3) hold-зеркало не ретроактивно к траншам, добавленным позже (заметка для addTranche UI).
Task 5: complete (commit 9174f0a..63c17eb + ревью-фикс 9bec744, 31/31 PASS #5/7/8b/13/14/15/16/22/27/27b/28, review Approved после фикса)
  10 мутаций (saveContractAmount/addTranche/addDisbursement/setKmDecision/saveWaiver/addPayment/addAgreement/closeCredit/linkPledge/paymentEditable) + zeroOutForTest. Все: gate→ранний return без мутации→snapshot before→pushAudit(frozen)→{ok,reasons}.
  РЕШЕНИЕ payment→debt: manual addPayment пишет ТОЛЬКО mirror.payments {reg:'Ручной ввод',match:'Ожидает ЦК'}, ledger/debt НЕ трогает — канон Р-5 «ожидает ЦК» (простейший, не десинхронит). debtFromLedger accrued/penalty.overdue остаются эвристикой + // TODO Task 5/later в обоих местах.
  saveWaiver ставит mirror.pledgeWaiver (2-й путь разблока Г-6); K-5 стартует BLOCKED (waiver falsy) → unblock. setKmDecision — 1-й путь (Р-8).
  Ревью-фикс (Important): все audit-push унифицированы через единый pushAudit chokepoint + Object.freeze — Task 4 generateSchedule/holdAccrual писали {ts,action,note} НЕзамороженными в обход; теперь {when,who,what,before,after} frozen везде. Тест #27 разбит (freeze | no-delete-API раздельно), +#27b (Task-4-origin frozen). +crash-guard gate addDisbursement (неизвестный trancheNo → 'Транш не найден', не TypeError).
  Minor (в финальное ревью): (1) linkPledge audit before=count, не snapshot (косметика); (2) 'repay' добавлен в ROLE_ACTIONS['Начальник отдела'] — согласуется с §7 (line 340 «всё + списание»), инертно (gate роль не проверяет); (3) setKmDecision/linkPledge без field-level валидации ctx — отложено на формы Task 6.
  === ЛОГИЧЕСКИЙ СЛОЙ ГОТОВ: Tasks 1–5, 31/31 PASS. Осталось: Task 6–8 (UI, браузер-проверка) + Task 9 (финал smoke/штамп/канон). ===
Task 6 (credit): complete (commit 9bec744..78740a0, реестр /credits + вид + роль, review Approved, smoke 31/31)
  UI-слой добавлен внутри существующего DOM-guard (typeof document!==undefined): renderList/renderRows/rowHtml/renderRole/selectRow/openDetail/backToList/resetDemo/openCreatePicker/pickApplication. Все ячейки из derive() на рендере, ничего не кэшируется на модель.
  Браузер-проверка (контроллер, http://localhost:8899 — file:// блокирован расширением): 15/15 строк, 12 колонок Р-19 в точном порядке; тинты 3 overdue(amber)+3 collection(red); фильтр ПРГ-2→2 строки, сброс→15; роль «Наблюдатель»→btnCreate.disabled + tooltip «не имеет права создавать кредит», спец→enabled; Г-2 picker ровно [ЗАЯ-1050] (исключает ЗАЯ-1042 linked→K-1 и ЗАЯ-1051 !approved); double-click→карточка с #cr-card-body плейсхолдер + «← Реестр».
  Minor (в финальное ревью): (1) дубль .sel CSS (стр.302 vs 574, идентичны, мёртвый код); (2) заголовок колонки «Заёмщик» vs канон «Заёмщик(ИНН+наим)» — контент верный (наим+ИНН), косметика; (3) «Остаток долга» = principal.bal+interest.bal+penalty.bal — judgment call, подтвердить с product owner (vs principal-only).
Task 7 (credit): complete (commit 78740a0..26a6418, шапка §5.2 + 8 вкладок, review Approved opus, smoke 31/31)
  renderDetail/renderTab/openTab: §5.2 non-collapsing header (всё из derive) + 8 вкладок в точном порядке (Договор·Условия·Транши·Расчёты·Платежи·Обеспечение·Проблемные·Досье), ни одной пустой. Хелперы fld/cgrid/actBtn/roleBtn/lockHtml — DRY по 8 вкладкам. Каждая мутация → rerenderDetail → derive заново (без кэша). Gate-disabled кнопки = visual-disable (не attribute) + title + toast-on-click (attribute disabled не даёт toast) — заблокированная кнопка НЕ достаёт до мутации (проверено ревью).
  Задача 7/8 граница: 3 действия рабочие сейчас (addDisbursement/generateSchedule/addAgreement), остальные — role-gated заглушки toast «форма в Task 8» → Task 8 модалки.
  Браузер-проверка (контроллер, K-1 «Бек Кабель» через http://localhost:8899): шапка — оба pill (Действует/Частично освоен), Освоено 100000(67%), Покрытие ●132%/порог 120% зелёный светофор, Категория/Покрытие/Куратор все 🔒зеркало+источник(Р-10/П1§2.3/Р-9). Договор: Р-18 4 up-link (ЗАЯ-1042→КОМ-311→программа→решение) read-only. Обеспечение: grid ЗД-88 (оценочная 240k/залоговая 198k/доля100%/ликвид/запрет), покрытие-блок, 🔒зеркало+«Источник: модуль залога Р-7 read-only», НЕТ «Создать залоговый договор» (Р-7✓). Axis-2 флип: full освоение транша №2 → disbState «Частично освоен»→«Полностью освоен», gate ok, audit frozen what=addDisbursement.
  Minor (в финальное ревью): двойной derive в renderDetail (header + renderTab повторно) — pure/дёшево, можно прокинуть d одним вызовом.
Task 8 (credit): complete (commit 26a6418..6cc8220, модалки + 6 цепочек, review Approved opus, smoke 31/31)
  openModal/closeModal/modalErr (modal-h/-b/-f, один overlay) + modalGuard(action) гейтит ОТКРЫТИЕ по роли+terminal. 9 модалок: tranche/disbursement/schedule-params/agreement-ДС/manual-payment/KM-decision/waiver/write-off/link-pledge(Г-13 same-ИНН+active) + repay. Каждый submit re-check gate → на провале modalErr(reasons)+toast, без мутации (§0.3). manual-payment пишет mirror reg:'Ручной ввод'/match:'Ожидает ЦК', НЕ двигает ledger. 3 действия Task 7 (disb/sched/agr) апгрейд inline→modal, старые формы удалены чисто.
  Браузер-проверка цепочек (контроллер, http://localhost:8899): К-1 «Сформировать график» enabled(пустой title); К-2 reserve applies=true rate2% amount1819.18 vs К-1 applies=false; К-3 repay gate false, reasons=[«нулевой остаток по всем слоям», «активный процесс взыскания»] (Г-14 dual); К-5 disb blocked cov 84% red-светофор, tooltip «Провал покрытия: КМ (Р-8) или waiver», клик по blocked→toast без модалки (§0.3✓), роль→«Начальник отдела»→модалка «Решение КМ об освобождении от залога (Р-8)» owned-поле, setKmDecision→disbGate false→true live; Наблюдатель ROLE_ACTIONS пуст→modalGuard блок открытия.
  РОЛЕВАЯ МАТРИЦА (ключи ≠ имена мутаций): key 'waiver'(не saveWaiver) в «Начальник отдела»; setKmDecision/linkPledge/holdAccrual/writeOff/repay только «Начальник отдела»; addTranche/addDisbursement/addAgreement/saveContractAmount в «Кредитный специалист»+«Начальник отдела». gate() сам не проверяет terminal — защита закрытых кредитов ТОЛЬКО на UI (isTerminal в actBtn/roleBtn+modalGuard). K-6/K-6b addTranche gate=true (UI блокирует).
  Minor (в финальное ревью): (1) мёртвые disbFormOpen/schedFormOpen/agrFormOpen; (2) gate addTranche/addDisbursement не режет amount=0 (req визуальный); (3) schedule-modal onchange транша → full rerenderDetail за модалкой.
  ПРОВЕРКА «ДВУХ ПРОБЕЛОВ» — ОБА СНЯТЫ (проверял неверные имена полей):
   (B) K-6/K-6b различаются через closure.reason: K-6=«Погашен» (акт сверки АС-30), K-6b=«Списан» (решение правления РП-77); оба lifecycle=«Закрыт» — ВЕРНО (Закрыт=терминал оси-1, closure.reason=под-состояние). §8 два терминала выполнены. НЕ пробел.
   (A) K-4 пауза живёт в mirror.restructuring.active.pause.days=70 + overlay181=true (не в credit.accrualHold, который для ручного Р-17). Оверлеи derive = [overdue, restructuring, suppress181]. Мораторийная пауза приходит из реструктуризации, не из ручного hold — это дизайн, не пробел. Максимум Minor: текст restructuring-оверлея не упоминает «70 к.д.» явно (можно добавить «мораторий 70 к.д.»). НЕ seed-фикс.
  ⇒ Task 9 = чистая финализация без seed-правок. Единственный тест-пробел: #18 отсутствует (из 1–28 есть все кроме 18). Minor в финал: текст restructuring-оверлея К-4 без «70 к.д.».
Task 9 (credit): complete (commit 6cc8220..e04f9f1, финализация, review Approved sonnet, smoke 32/32)
  Добавлен тест #18 (структурный src-string, Р-7): comment-strip источника → нет button/roleBtn с «Создать залоговый договор» (терпит 2 коммента + дисклеймер picker'а, где фраза = «нельзя») + есть «Привязать существующий». Реализатор поймал: фраза в 3-х местах (не 2 как в брифе), ассерт уточнён на button-конструкт, не naive-absence. #10 усилен: было presence-only → теперь assert disbGate false→true после setKmDecision (Р-8 unlock §7). Шапка Р-1…Р-20+§10 уже была полной; раннер перештамповал SMOKE 32/32.
=== ВСЕ 9 ТАСКОВ ГОТОВЫ. Финальное ревью ветки (credit-scoped) + фикс-волна ниже. ===
Финальное ревью (opus, весь credit-фичер 56f3cfc..e04f9f1 path-filtered): вердикт «Needs fixes before merge» — все 6 инвариантов держатся (derive-чистота/audit-freeze/mirror/Р-7/§0.3/DOM-guard ✓), но 2 Important. 9 логированных Minor: 8 «ship», #9 (К-4 «70 к.д.») «ship». Новые Important: (1) тест #28 Г-17 тавтологичен — CR.hasDeleteButtons нигде не определён → тернар всегда true, «нет кнопок Удалить» не проверялось; (2) «Изменить сумму договора» (saveContractAmount) и «Приостановить начисление» (holdAccrual) заглушены stubAction с неверным «в модуле-владельце», хотя это OWNED+протестированные мутации, §0.1 запрещает заглушки, §5.3 таб-4 требует интерактив. Плюс новые Minor (ship/fast-follow): termAgg/fullRepayDate мёртвые выходы derive (Р-13 не показан); debtTransfer render читает не-модельные поля (мёртвая ветка); disbState 'Освоение закрыто' недостижим (closure.disbClosed нигде не ставится); zeroOutForTest экспортится в CR.
Фикс-волна (opus, ОДИН субагент, commit eecb0a7 «реальный тест Г-17 #28 + модалки суммы/паузы + Р-13 срок + чистка»): (1) #28 переписан как src-string как #18 — ПРОВЕРЕНО эмпирически контроллером: инъекция <button>Удалить</button> → #28 FAIL deleteBtn=true, suite 31/32; чисто → 32/32 (не тавтология). (2) openContractAmountModal (Г-1·Р-12) + openHoldModal (Р-17·Г-15) через openModal/modalGuard, gate re-check на submit — ПРОВЕРЕНО в браузере: сумма > одобренной → модалка открыта + reason Г-1 + без мутации (§0.3); в пределах → закрывается + contract 150000→140000; hold-модалка поля from/to/reason/doc. (3) мёртвые disbFormOpen/schedFormOpen/agrFormOpen удалены. (4) termAgg/fullRepayDate СУРФЕЙСнуты (Р-13 инфо-плита в «Условия», termAgg=24мес fullRepay 18.05.2028), derive-логика не тронута. smoke 32/32, шапка перештампована. Все 4 фикса верифицированы контроллером напрямую (сильнее чем diff-re-read) — отдельный re-review субагент не нужен.

################################################################################
# CREDIT-МОДУЛЬ (mockups/loan-credit/credit.html) — ИТОГ SDD-ПРОГОНА
################################################################################
План:  docs/superpowers/plans/2026-07-23-credit-module-mockup.md (9 тасков)
Канон: /home/azamat/Downloads/prompt-kredit-mockup.md (Р-1…Р-20, Г-1…Г-17, §4 derive, §8 цепочки, §9 smoke)
Ветка: feat/borrower-rework (ОБЩАЯ на 4 сессии; credit-файлы не пересекаются с borrower/zalog/restructuring)
База (merge-base): 56f3cfc → HEAD credit-фичера: eecb0a7
Файлы: mockups/loan-credit/credit.html (~2600 стр, TO-BE, создан с нуля) + scripts/inspect/credit-check.mjs (node:vm smoke, 32/32)
Проверка: node scripts/inspect/credit-check.mjs   (перештамповывает SMOKE-блок в шапке html)
loan-credit.html (as-is инвентаризация) — НЕ ТРОНУТ.
Коммиты credit: fca1c84(T1) 22b58bf c26d03e(T2) f496fd5 af82d6a(T3) 9174f0a(T4) 63c17eb 9bec744(T5) 78740a0(T6) 26a6418(T7) 6cc8220(T8) e04f9f1(T9) eecb0a7(финал-фикс)
Журнал тасков: T1 скелет/seed/harness · T2 derive §4 · T3 gate Г-1…16+роли · T4 график+пауза · T5 мутации+append-only аудит · T6 реестр/фильтры/роль · T7 шапка+8 вкладок · T8 9 модалок+6 цепочек · T9 финализация #18 · финал-фикс #28+2 модалки+Р-13.
Браузер-проверка (контроллер, http://localhost:8899 — file:// блокирован расширением): все 6 цепочек К-1…К-6 + Наблюдатель проиграны; §0.3 (блок→toast без модалки), gate-on-submit, mirror-замки, Р-7 (нет «Создать залоговый договор»), axis-2 флип, покрытие-светофор — подтверждены.
Инварианты (финальное ревью): derive-чистота · audit-freeze(pushAudit) · mirror read-only · Р-7 · §0.3 · DOM-guard — все ✓.
СТАТУС: готов к финишу ветки. ОТКРЫТО ДЛЯ ЮЗЕРА: стратегия ОБЩЕЙ ветки feat/borrower-rework (4 фичи на одной) — влить в main / выделить credit в свою ветку / оставить. Fast-follow Minor'ы (ship): дубль .sel CSS, header «Заёмщик», «Остаток долга»=сумма слоёв (подтвердить с PO), двойной derive, gate amount=0, sched-modal rerender, #18/#28 regex-допущение, К-4 «70 к.д.» текст, debtTransfer/disbClosed мёртвые ветки, zeroOutForTest экспорт.
Task 1: complete (commit afc5c04..a4c81d7, 2/2 PASS, review Approved)
  Ветка feat/borrower-rework делится 4 сессиями (borrower/credit/zalog/restructuring), файлы непересекающиеся. Моя база ревью = родитель моего коммита (afc5c04), НЕ branch-HEAD (устаревает от чужих коммитов). Brief/report снапшочу в *-borrower-*.md (credit-сессия использует те же имена).
  Important (плечо T2): T1 удалил DATA, но route() ещё звал DATA.find (стр.745,748) → ReferenceError на реальной навигации, замаскирован пустым хэшем. Резолюция: план Task 2 усилен Step 4b (route DATA→SUBJECTS) + тест S7.
  Minor (в финальное ревью): .b-ok бейдж держит border, тогда как gen-2 конвенция (restructuring/collection) для success-пилюль border убирает — визуальный проход.
