Type: implementation
Status: done
Blocked by: [Точки интеграции (01)](01-tochki-integracii.md)

## Question

Закодить пятнадцать пунктов тикета «Точки интеграции» в `mockups/collection/collection.html`.

## Answer

Код в `collection.html`:

- `AWARD_KINDS` (:1639) — добавлен «Дополнительное решение суда» (Q8). Новый
  набор `AWARD_DEATH_KINDS` (:1646) — «Определение об отмене судебного приказа».
- `repOf(proc, creditId)` — представитель кредита вынесен из `layerOf` в общую
  функцию (переиспользуется делёжом выручки).
- `effectiveAward(measures, m, reqId)` — сумма акта с учётом `relation.type
  ==='adds'` (склад с актом-основанием, один уровень по `relation.of`, пусто ≠
  ноль по статье сохраняется). Общий хелпер для `layerOf` и
  `claimsReconcileHtml` (Q13).
- `layerOf(proc, creditId)` — переписан: свёртка `acts` теперь берёт и
  AWARD_KINDS (по `m.awards`), и AWARD_DEATH_KINDS (по `m.targets`, без
  `m.awards`), тем же last-wins по дате события; если побеждает акт смерти —
  `null` (Q7); сумма живого акта — через `effectiveAward` (Q8).
- `claimsReconcileHtml` — `awards = effectiveAward(r._proc.measures, award,
  r.id)` вместо сырого `award.awards[r.id]` (Q13).
- `collCredits(c, proc)` — предмет с `credit:null` разворачивается в полный
  список кредитов дела (Q5).
- `creditRegDate(proc, creditId)` — дата регистрации кредита регексом из
  `credit.num` (Q2/Q3).
- `distributeProceeds(c, proc)` — делёж шага2: очередь по `creditRegDate`
  (ADR-0008), на каждом кредите забрать `claimOf(rep,'полный остаток')` из
  пота (расходы уже внутри, Q9/Q14/Q10), остаток — `giveBack`. Заменил старую
  `distributeRealization(proceeds, r)` (мерила один REQ, модель v2).
- `markRealized(ci)` — пишет `c.realization={proceeds, costs, date}` на
  ПРЕДМЕТЕ, не `curProc.realization` (Q1); `costs` — шаг1 P13, информационно
  (Q9); модалка не закрывается, переоткрывается на делёж (Q11).
- `saveDistribution(ci)` / `realizationDistributionHtml(ci)` — предпросчёт
  (`distributeProceeds`) с редактируемыми полями + «Документ-основание» +
  «Адресат возврата» (Q11/Q15); публикация пишет `c.realization.distribution`
  как есть, дальше не пересчитывается (Q6/Q12).
- `openRealizationModal` — «торги назначены» получил поле `realCosts`;
  «реализовано» ветвится на `realizationDistributionHtml` вместо голого pill.
- `panelZalog` — таблица делёжа под реализованным предметом, вне модалки
  (Q11).
- `panelDebt` — тайл «доля в реализации» рядом со «слой» (сумма всех
  опубликованных долей кредита по всем предметам дела); старый блок
  `p.realization`/`distributeRealization` убран целиком; `debtOf` публикацией
  НЕ трогается (Q12, лаг до платежей).
- `openAnnotationModal` («Присуждено») — третий вариант отношения `adds:NNN`
  рядом с `new`/`absorbs:NNN` (Q8).
- `saveAnnotation` — разбор `type:num` из `<select>` вместо голого номера
  (раньше кодировалось только `absorbs`, теперь два типа).
- `normalize(p)` — убрано мёртвое `p.realization ??= null` (поле переехало на
  предмет).
- `createOtherPropertyMeasure(uncovered)` — удалена: единственный вызов был в
  снесённом блоке `panelDebt`, осиротела; ADR-0043 не требует ручного действия
  — непокрытый остаток и так «живёт свободным слоем» без записи меры. Не
  обсуждалось в грилинге — решение принято при кодировании (осиротевшая
  функция), не отдельный вопрос к пользователю.

Проверено throwaway jsdom-смоуком (два прогона, не в репозитории, ноль
console/pageerror в обоих):
1. Полный цикл предмета на реальном SEED (один кредит на предмет) — порядок
   обращения → цена → торги → `markRealized` (выручка+расходы) → предпросчёт
   делёжа виден → `saveDistribution` → опубликовано, `panelZalog`/`panelDebt`/
   `claimsReconcileHtml` рендерятся без исключений. SEED делёжа между
   несколькими кредитами не заводился (все предметы SEED — один кредит на
   предмет) — резерв до пересева, как и решено в map.md.
2. Синтетика на `layerOf`: рост («Дополнительное решение суда», `adds`) —
   100000 + 5000 = 105000, тип/основание сохранены; смерть (отмена приказа) —
   `layerOf` вернул `null` после более позднего акта отмены; `claimChainsFor`/
   `claimsReconcileHtml` корректно показали смерженную сумму 105000 по цепочке
   иск→решение→доп.решение.

**Найдено при кодировании (не в грилинге):** старый существующий тест
`collection-check.mjs` (п.49, дело 326) был завязан на снесённый `p.realization`
— пришлось переписать под новую модель (`c.realization`/`.distribution`,
вкладка «Залог», не «Долг»); заодно найден и добавлен `distributionUncoveredNote`
— общий текст «непокрытый остаток — п. 33/ADR-0043» для `panelZalog` и модалки
(старый тест его ожидал, новый код изначально не показывал).

**Регрессия — полный трёхскриптовый прогон** (не резервирован до конца волны,
т.к. карта САМА — отдельная волна поверх закрытого наряда §30, тот же
прецедент, что МП-11): `collection-check.mjs` — **660 проверок, 32 провала**
(было 659/32 на HEAD до карты) — списки провалов **побитово идентичны**
(`diff` до/после через временный `git show HEAD:...`, 0 новых, 0 исчезнувших).
Три новых/переписанных теста (326) — все `ok`. `collection-data-audit.mjs` —
0 находок. `collection-seed-coverage.mjs` — без изменений (SEED не тронут).
`node --check` на извлечённом `<script>` — синтаксис чист.

Destination карты достигнут — карта закрыта.
