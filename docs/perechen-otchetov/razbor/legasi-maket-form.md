# Легаси: макеты 16 отчётов и 5 распечаток (из дампа БД)

Источник: `/home/azamat/Desktop/DB/mfloan_2026_08_10.sql` (таблицы `report`, `report_content_parameter`, `content_parameter`, `report_group_type`, `group_type`, `report_template`, `printout`, `printout_template`). Новый дамп `frp_mfloan_2026_10_24.sql` не использовался: всё нужное нашлось в первом.

Условные обозначения ячейки: `поз` = `position`; `кол a–b` = `col_from–col_to`; `стр a–b` = `row_from–row_to` (номера строк на листе, счёт с 0; строки шапки и заголовка заданы абсолютно); значение `«…»` = константа (`CONSTANT`, текст как в базе); `ТИП.Поле` = `contentType.field_name` (источник данных); в скобках тип ячейки. В константах `(=onDate=)` — подстановка даты «на дату».

Названия ячеек (`name` в `content_parameter`) приведены в тех местах, где они поясняют, какую колонку заполняет ячейка; опечатки сохранены дословно.

Схема `content_parameter`: id, cellType, classificator_id, classificator_value_id, col_from, col_to, constantDate, constant_int, constant_text, constant_value, contentType, field_name, name, position, rowType, row_from, row_to. Связь с отчётом — только `report_content_parameter(report_id, content_parameter_id)`. Прочих полей (шрифт, формат числа, ширина) в этой таблице нет; ширины и шрифты — в `output_parameter` (раздел 3).

---

## 1. Отчёты (таблица `report`, 16 строк)

| id | name | reportType | ячеек содержания | разрезов в `report_group_type` |
|---|---|---|---|---|
| 1 | Отчет по оформлению | ENTITY_DOCUMENT | 71 | 12 |
| 2 | Отчет по взысканию | COLLECTION_PHASE | 66 | 10 |
| 3 | Отчет по задолженности | LOAN_SUMMARY | 109 | 21 |
| 4 | Отчет по погашениям | LOAN_PAYMENT | 67 | 12 |
| 5 | Отчет по графикам | LOAN_SCHEDULE | 77 | 12 |
| 6 | Отчет по залогу | COLLATERAL_ITEM | 95 | 11 |
| 7 | Отчет по актам обследования | COLLATERAL_INSPECTION | 43 | 9 |
| 8 | Отчет по снятию с ареста | COLLATERAL_ARREST_FREE | 31 | 7 |
| 9 | Отчет по плану | LOAN_PLAN | 164 | 7 |
| 10 | Отчет по списанию | LOAN_WRITE_OFF | 56 | 5 |
| 11 | Отчет по переводу долга | LOAN_DEBT_TRANSFER | 41 | 5 |
| 12 | Отчет по кадрам | STAFF | 27 | 7 |
| 13 | Отчет по документооброту | DOCUMENT | 29 | 4 |
| 14 | Отчет ОИП | COLLECTION_PHASE | 81 | 12 |
| 15 | Отчет по субсидиям | SUBSIDY_PAYMENT | 29 | 3 |
| 16 | Отчет ОИП копия  | COLLECTION_PHASE | 81 | 12 |

### Отчёт 1. Отчет по оформлению (`ENTITY_DOCUMENT`)

Ячеек: 71.

**Заголовок страницы** — 2 ячеек

- кол 1–7, стр 2–2, TEXT: «Информация по оформлению документации»
- кол 1–7, стр 3–3, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 15 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во пол.»
- кол 2–2, стр 5–6, TEXT: «Наименование»
- кол 3–3, стр 5–6, TEXT: «Кол-во док.»
- кол 4–7, стр 5–5, TEXT: «в том числе»
- кол 4–4, стр 6–6, TEXT: «укомлектовано»
- кол 5–5, стр 6–6, TEXT: «не укомпл.»
- кол 6–6, стр 6–6, TEXT: «проверено»
- кол 7–7, стр 6–6, TEXT: «не проверено»
- кол 8–8, стр 5–6, TEXT: «Статус»
- кол 9–9, стр 5–6, TEXT: «Укомплектовано»
- кол 10–10, стр 5–6, TEXT: «Дата комплектации»
- кол 11–11, стр 5–6, TEXT: «Примечание»
- кол 12–12, стр 5–6, TEXT: «Проверено»
- кол 13–13, стр 5–6, TEXT: «Дата проверки»
- кол 14–14, стр 5–6, TEXT: «Примечание»

**Уровень группировки 1 (TABLE_GROUP1)** — 9 ячеек

- поз 1, INTEGER, id 19: ENTITY_DOCUMENT.EntityCount — Оформление. Разрез 1. - кол-во получателей
- поз 2, TEXT, id 20: ENTITY_DOCUMENT.Name — Оформление. Разрез 1. Наименование
- поз 2, TEXT, id 27: ENTITY_DOCUMENT.Name — Оформление. Разрез 2. Наименование
- поз 3, INTEGER, id 21: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Разрез 2. Кол-во документов
- поз 3, INTEGER, id 36: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Разрез 1. Кол-во док.
- поз 4, INTEGER, id 32: ENTITY_DOCUMENT.EntityDocumentCompletedCount — Оформление. Разрез 1. Кол-во укомплектованных документов
- поз 5, INTEGER, id 34: ENTITY_DOCUMENT.EntityDocumentNotCompletedCount — Оформление. Разрез 1. Кол-во не укопмлетованных документов
- поз 6, INTEGER, id 33: ENTITY_DOCUMENT.EntityDocumentApprovedCount — Оформление. Разрез 1. Количество проверенных документов
- поз 7, INTEGER, id 35: ENTITY_DOCUMENT.EntityDocumentNotApprovedCount — Оформление. Разрез 1. Кол-во непроверенных документов

**Уровень группировки 2 (TABLE_GROUP2)** — 7 ячеек

- поз 1, INTEGER, id 22: ENTITY_DOCUMENT.EntityCount — Оформление. Разрез 2. кол-во получателей
- поз 2, TEXT, id 28: ENTITY_DOCUMENT.Name — Оформление. Разрез 2. Наименование
- поз 3, INTEGER, id 37: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Разрез 2. Кол-во док.
- поз 4, INTEGER, id 38: ENTITY_DOCUMENT.EntityDocumentCompletedCount — Оформление. Разрез 2. Кол-во укомплектованных документов
- поз 5, INTEGER, id 40: ENTITY_DOCUMENT.EntityDocumentNotCompletedCount — Оформление. Разрез 2. Кол-во не укопмлетованных документов
- поз 6, INTEGER, id 39: ENTITY_DOCUMENT.EntityDocumentApprovedCount — Оформление. Разрез 2. Количество проверенных документов
- поз 7, INTEGER, id 41: ENTITY_DOCUMENT.EntityDocumentNotApprovedCount — Оформление. Разрез 2. Кол-во непроверенных документов

**Уровень группировки 3 (TABLE_GROUP3)** — 8 ячеек

- поз 1, INTEGER, id 23: ENTITY_DOCUMENT.EntityCount — Оформление. Разрез 3. Кол-во получателей
- поз 2, TEXT, id 29: ENTITY_DOCUMENT.Name — Оформление. Разрез 3. Наименование
- поз 3, INTEGER, id 42: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Разрез 3. Кол-во док.
- поз 4, INTEGER, id 43: ENTITY_DOCUMENT.EntityDocumentCompletedCount — Оформление. Разрез 3. Кол-во укомплектованных документов
- поз 5, INTEGER, id 45: ENTITY_DOCUMENT.EntityDocumentNotCompletedCount — Оформление. Разрез 3. Кол-во не укопмлетованных документов
- поз 6, INTEGER, id 44: ENTITY_DOCUMENT.EntityDocumentApprovedCount — Оформление. Разрез 3. Количество проверенных документов
- поз 7, INTEGER, id 46: ENTITY_DOCUMENT.EntityDocumentNotApprovedCount — Оформление. Разрез 3. Кол-во непроверенных документов
- поз 8, TEXT, id 61: ENTITY_DOCUMENT.V_applied_entity_appliedEntityStateId — Оформление. Разрез 3. Статус

**Уровень группировки 4 (TABLE_GROUP4)** — 8 ячеек

- поз 1, TEXT, id 24: «» — Оформление. Разрез 4. Кол-во получателей
- поз 2, TEXT, id 30: ENTITY_DOCUMENT.Name — Оформление. Разрез 4. Наименование
- поз 3, INTEGER, id 47: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Разрез 4. Кол-во док.
- поз 4, INTEGER, id 48: ENTITY_DOCUMENT.EntityDocumentCompletedCount — Оформление. Разрез 4. Кол-во укомплектованных документов
- поз 5, INTEGER, id 50: ENTITY_DOCUMENT.EntityDocumentNotCompletedCount — Оформление. Разрез 4. Кол-во не укопмлетованных документов
- поз 6, INTEGER, id 49: ENTITY_DOCUMENT.EntityDocumentApprovedCount — Оформление. Разрез 4. Количество проверенных документов
- поз 7, INTEGER, id 51: ENTITY_DOCUMENT.EntityDocumentNotApprovedCount — Оформление. Разрез 4. Кол-во непроверенных документов
- поз 8, TEXT, id 62: ENTITY_DOCUMENT.v_document_package_documentPackageStateId — Оформление. Разрез 4. Статус

**Уровень группировки 5 (TABLE_GROUP5)** — 14 ячеек

- поз 1, TEXT, id 25: «» — Оформление. Разрез 5. Кол-во получателей
- поз 2, TEXT, id 31: ENTITY_DOCUMENT.Name — Оформление. Разрез 5. Наименование
- поз 3, INTEGER, id 52: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Разрез 5. Кол-во док.
- поз 4, INTEGER, id 53: ENTITY_DOCUMENT.EntityDocumentCompletedCount — Оформление. Разрез 5. Кол-во укомплектованных документов
- поз 5, INTEGER, id 55: ENTITY_DOCUMENT.EntityDocumentNotCompletedCount — Оформление. Разрез 5. Кол-во не укопмлетованных документов
- поз 6, INTEGER, id 54: ENTITY_DOCUMENT.EntityDocumentApprovedCount — Оформление. Разрез 5. Количество проверенных документов
- поз 7, INTEGER, id 56: ENTITY_DOCUMENT.EntityDocumentNotApprovedCount — Оформление. Разрез 5. Кол-во непроверенных документов
- поз 8, TEXT, id 63: ENTITY_DOCUMENT.V_entity_document_entityDocumentStateId — Оформление. Разрез 5. Статус
- поз 9, TEXT, id 75: ENTITY_DOCUMENT.v_entity_document_completedBy — Оформление. Разрез 5. Укомплектовано
- поз 10, TEXT, id 87: ENTITY_DOCUMENT.v_entity_document_completedDate — Оформление. Разрез 5. Дата комплектации
- поз 11, TEXT, id 99: ENTITY_DOCUMENT.v_entity_document_completedDescription — Оформление. Разрез 5. Примечание
- поз 12, TEXT, id 81: ENTITY_DOCUMENT.v_entity_document_approvedBy — Оформление. Разрез 5. Проверено
- поз 13, TEXT, id 93: ENTITY_DOCUMENT.v_entity_document_approvedDate — Оформление. Разрез 5. Дата проверки
- поз 14, TEXT, id 105: ENTITY_DOCUMENT.v_entity_document_approvedDescription — Оформление. Разрез 5. Примечание

**Уровень группировки 6 (TABLE_GROUP6)** — 1 ячеек

- поз 1, TEXT, id 26: «» — Оформление. Разрез 6. Кол-во получателей

**Итоговая строка (TABLE_SUM)** — 7 ячеек

- поз 1, INTEGER, id 8: ENTITY_DOCUMENT.EntityCount — Оформление. Итого. Кол-во получателей
- поз 2, TEXT, id 9: «ИТОГО» — Оформление. Итого. Итого
- поз 3, INTEGER, id 10: ENTITY_DOCUMENT.EntityDocumentCount — Оформление. Итого. Кол-во документов
- поз 4, INTEGER, id 15: ENTITY_DOCUMENT.EntityDocumentCompletedCount — Оформление. Итого. Кол-во укомплектованных документов
- поз 5, INTEGER, id 17: ENTITY_DOCUMENT.EntityDocumentNotCompletedCount — Оформление. Итого. Кол-во не укопмлетованных документов
- поз 6, INTEGER, id 16: ENTITY_DOCUMENT.EntityDocumentApprovedCount — Оформление. Итого. Кол-во проверенных документов
- поз 7, INTEGER, id 18: ENTITY_DOCUMENT.EntityDocumentNotApprovedCount — Оформление. Итого. Кол-во непроверенных документов

**Разрезы, предложенные отчёту (`report_group_type`)**: Постановление, Получатель, Список получателей, Пакет документации, Документ (оформление), Статус получателя, Статус документа(оформление), Статус пакета док., Укомплектовано, Проверено, Область (получатель), Район (получатель).

Шаблон отчёта 1 «Общий отчет по оформлению документации»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Постановление; 2:Область (получатель); 3:Район (получатель); 4:Получатель; 5:Документ (оформление); 6:— (скрыт).

### Отчёт 2. Отчет по взысканию (`COLLECTION_PHASE`)

Ячеек: 66.

**Заголовок страницы** — 2 ячеек

- кол 1–8, стр 1–1, TEXT: «Информация по взысканию»
- кол 1–8, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 15 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб.»
- кол 2–2, стр 5–6, TEXT: «Наименование»
- кол 3–6, стр 5–5, TEXT: «Стадия»
- кол 3–3, стр 6–6, TEXT: «Кол-во»
- кол 4–4, стр 6–6, TEXT: «Вид»
- кол 5–5, стр 6–6, TEXT: «Дата»
- кол 6–6, стр 6–6, TEXT: «Сумма.»
- кол 7–10, стр 5–5, TEXT: «Результат»
- кол 7–7, стр 6–6, TEXT: «Кол-во»
- кол 8–8, стр 6–6, TEXT: «Вид»
- кол 9–9, стр 6–6, TEXT: «Дата.»
- кол 10–10, стр 6–6, TEXT: «Сумма»
- кол 11–11, стр 5–6, TEXT: «Статус»
- кол 12–12, стр 5–6, TEXT: «Всего погашено»
- кол 13–13, стр 5–6, TEXT: «Всего остаток»

**Уровень группировки 1 (TABLE_GROUP1)** — 8 ячеек

- поз 1, INTEGER, id 121: COLLECTION_PHASE.count — Взыскание. Разрез 1. Кол-во субъектов
- поз 2, TEXT, id 122: COLLECTION_PHASE.name — Взыскание. Разрез 1. Наименование
- поз 3, TEXT, id 140: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 1. Кол-во стадии
- поз 6, DOUBLE, id 154: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 1. Сумма стадии.
- поз 7, TEXT, id 141: COLLECTION_PHASE.resultCount — Взыскание. Разрез 1. Кол-во результатов
- поз 10, DOUBLE, id 155: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 1. Сумма результата
- поз 12, DOUBLE, id 758: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 1. Всего погашено.
- поз 13, DOUBLE, id 754: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 1. Всего остаток по ИЛ

**Уровень группировки 2 (TABLE_GROUP2)** — 8 ячеек

- поз 1, INTEGER, id 123: COLLECTION_PHASE.count — Взыскание. Разрез 2. Кол-во субъектов
- поз 2, TEXT, id 124: COLLECTION_PHASE.name — Взыскание. Разрез 2. Наименование
- поз 3, TEXT, id 142: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 2. Кол-во стадии
- поз 6, DOUBLE, id 152: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 2. Сумма стадии.
- поз 7, TEXT, id 143: COLLECTION_PHASE.resultCount — Взыскание. Разрез 2. Кол-во результатов
- поз 10, DOUBLE, id 153: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 2. Сумма результата
- поз 12, DOUBLE, id 757: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 2. Всего погашено.
- поз 13, DOUBLE, id 753: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 2. Всего остаток по ИЛ

**Уровень группировки 3 (TABLE_GROUP3)** — 8 ячеек

- поз 1, INTEGER, id 125: COLLECTION_PHASE.count — Взыскание. Разрез 3. Кол-во субъектов
- поз 2, TEXT, id 126: COLLECTION_PHASE.name — Взыскание. Разрез 3. Наименование
- поз 3, TEXT, id 144: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 3. Кол-во стадии
- поз 6, DOUBLE, id 150: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 3. Сумма стадии.
- поз 7, TEXT, id 145: COLLECTION_PHASE.resultCount — Взыскание. Разрез 3. Кол-во результатов
- поз 10, DOUBLE, id 151: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 3. Сумма результата
- поз 12, DOUBLE, id 756: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 3. Всего погашено.
- поз 13, DOUBLE, id 752: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 3. Всего остаток по ИЛ

**Уровень группировки 4 (TABLE_GROUP4)** — 8 ячеек

- поз 1, INTEGER, id 127: COLLECTION_PHASE.count — Взыскание. Разрез 4. Кол-во субъектов.
- поз 2, TEXT, id 128: ENTITY_DOCUMENT.name — Взыскание. Разрез 4. Наименование.
- поз 3, TEXT, id 146: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 4. Кол-во стадии
- поз 6, DOUBLE, id 148: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 4. Сумма стадии.
- поз 7, TEXT, id 147: COLLECTION_PHASE.resultCount — Взыскание. Разрез 4. Кол-во результатов
- поз 10, DOUBLE, id 149: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 4. Сумма результата
- поз 12, DOUBLE, id 755: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 4. Всего погашено.
- поз 13, DOUBLE, id 751: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 4. Всего остаток по ИЛ

**Уровень группировки 5 (TABLE_GROUP5)** — 9 ячеек

- поз 4, TEXT, id 129: COLLECTION_PHASE.collection_phase_type_id — Взыскание. Разрез 5. Вид стадии
- поз 5, DATE, id 130: COLLECTION_PHASE.collection_phase_start_date — Взыскание. Разрез 5. Дата стадии
- поз 6, DOUBLE, id 131: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 5. Сумма стадии.
- поз 8, TEXT, id 132: COLLECTION_PHASE.collection_phase_status_id — Взыскание. Разрез 5. Вид результата.
- поз 9, DATE, id 133: COLLECTION_PHASE.collection_phase_close_date — Взыскание. Разрез 5. Дата результата.
- поз 10, DOUBLE, id 134: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 5. Сумма результата
- поз 11, TEXT, id 135: COLLECTION_PHASE.collection_procedure_status_id — Взыскание. Разрез 5. Статус
- поз 12, DOUBLE, id 747: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 5. Всего погашено.
- поз 13, DOUBLE, id 748: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 5. Всего остаток по ИЛ

**Итоговая строка (TABLE_SUM)** — 8 ячеек

- поз 1, INTEGER, id 119: COLLECTION_PHASE.count — Взыскание. Итого. Кол-во суб.
- поз 2, TEXT, id 120: «ИТОГО» — Взыскание. Итого. Итого.
- поз 3, TEXT, id 138: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 5. Кол-во стадии
- поз 6, DOUBLE, id 156: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Итого. Сумма стадии.
- поз 7, INTEGER, id 139: COLLECTION_PHASE.resultCount — Взыскание. Разрез 5. Кол-во результатов
- поз 10, DOUBLE, id 157: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Итого. Сумма результата
- поз 12, DOUBLE, id 759: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Итого. Всего погашено.
- поз 13, DOUBLE, id 760: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Итого. Всего остаток по ИЛ

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Заемщик, Процедура взыскания, Фаза взыскания, Вид стадии, Вид результата, Статус процедуры.

Шаблон отчёта 2 «Общий отчет по взысканию»: на дату 2019-02-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Процедура взыскания; 5:Фаза взыскания; 6:— (скрыт).

### Отчёт 3. Отчет по задолженности (`LOAN_SUMMARY`)

Ячеек: 109.

**Заголовок страницы** — 2 ячеек

- кол 1–7, стр 1–1, TEXT: «Информация по задолженности»
- кол 1–7, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 19 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во кред-тов»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–4, стр 5–6, TEXT: «Вид кредита»
- кол 5–5, стр 5–6, TEXT: «Сумма по договору»
- кол 6–6, стр 5–6, TEXT: «Всего получено»
- кол 7–7, стр 5–6, TEXT: «Срок возврата»
- кол 8–8, стр 5–6, TEXT: «Всего погашено»
- кол 9–9, стр 5–6, TEXT: «Всего остаток»
- кол 10–12, стр 5–5, TEXT: «в том числе»
- кол 10–10, стр 6–6, TEXT: «по основной сумме»
- кол 11–11, стр 6–6, TEXT: «по процентам»
- кол 12–12, стр 6–6, TEXT: «по штрафам»
- кол 13–13, стр 5–6, TEXT: «Просроченная задолженность»
- кол 14–16, стр 5–5, TEXT: «в том числе»
- кол 14–14, стр 6–6, TEXT: «по основной сумме»
- кол 15–15, стр 6–6, TEXT: «по процентам»
- кол 16–16, стр 6–6, TEXT: «по штрафам»
- кол 17–17, стр 5–6, TEXT: «Примечание»

**Уровень группировки 1 (TABLE_GROUP1)** — 14 ячеек

- поз 1, INTEGER, id 194: LOAN_SUMMARY.Count — Задолженность. Разрез1. Кол-во субъектов
- поз 2, INTEGER, id 195: LOAN_SUMMARY.DetailsCount — Задолженность. Разрез1. Кол-во кредитов
- поз 3, TEXT, id 196: LOAN_SUMMARY.Name — Задолженность. Разрез1. Наименование
- поз 5, DOUBLE, id 197: LOAN_SUMMARY.LoanAmount — Задолженность. Разрез1. Сумма по договору
- поз 6, DOUBLE, id 198: LOAN_SUMMARY.TotalDisbursment — Задолженность. Разрез1. Всего получено
- поз 8, DOUBLE, id 199: LOAN_SUMMARY.TotalPaid — Задолженность. Разрез1. Всего погашено
- поз 9, DOUBLE, id 200: LOAN_SUMMARY.RemainingSum — Задолженность. Разрез1. Остаток задолженности
- поз 10, DOUBLE, id 201: LOAN_SUMMARY.RemainingPrincipal — Задолженность. Разрез1. Остаток по основной сумме
- поз 11, DOUBLE, id 202: LOAN_SUMMARY.RemainingInterest — Задолженность. Разрез1. Остаток по процентам
- поз 12, DOUBLE, id 203: LOAN_SUMMARY.RemainingPenalty — Задолженность. Разрез1. Остаток по штрафам
- поз 13, DOUBLE, id 204: LOAN_SUMMARY.OverdueAll — Задолженность. Разрез1. Просроченная задолженность
- поз 14, DOUBLE, id 205: LOAN_SUMMARY.OverduePrincipal — Задолженность. Разрез1. Просрочка по основной сумме
- поз 15, DOUBLE, id 206: LOAN_SUMMARY.OverdueInterest — Задолженность. Разрез1. Просрочка по процентам
- поз 16, DOUBLE, id 207: LOAN_SUMMARY.OverduePenalty — Задолженность. Разрез1. Просрочка по штрафам

**Уровень группировки 2 (TABLE_GROUP2)** — 14 ячеек

- поз 1, INTEGER, id 208: LOAN_SUMMARY.Count — Задолженность. Разрез 2. Кол-во субъектов
- поз 2, INTEGER, id 209: LOAN_SUMMARY.DetailsCount — Задолженность. Разрез 2. Кол-во кредитов
- поз 3, TEXT, id 210: LOAN_SUMMARY.Name — Задолженность. Разрез 2. Наименование
- поз 5, DOUBLE, id 211: LOAN_SUMMARY.LoanAmount — Задолженность. Разрез 2. Сумма по договору
- поз 6, DOUBLE, id 212: LOAN_SUMMARY.TotalDisbursment — Задолженность. Разрез 2. Всего получено
- поз 8, DOUBLE, id 213: LOAN_SUMMARY.TotalPaid — Задолженность. Разрез 2. Всего погашено
- поз 9, DOUBLE, id 214: LOAN_SUMMARY.RemainingSum — Задолженность. Разрез 2. Остаток задолженности
- поз 10, DOUBLE, id 215: LOAN_SUMMARY.RemainingPrincipal — Задолженность. Разрез 2. Остаток по основной сумме
- поз 11, DOUBLE, id 216: LOAN_SUMMARY.RemainingInterest — Задолженность. Разрез 2. Остаток по процентам
- поз 12, DOUBLE, id 217: LOAN_SUMMARY.RemainingPenalty — Задолженность. Разрез 2. Остаток по штрафам
- поз 13, DOUBLE, id 218: LOAN_SUMMARY.OverdueAll — Задолженность. Разрез 2. Просроченная задолженность
- поз 14, DOUBLE, id 219: LOAN_SUMMARY.OverduePrincipal — Задолженность. Разрез 2. Просрочка по основной сумме
- поз 15, DOUBLE, id 220: LOAN_SUMMARY.OverdueInterest — Задолженность. Разрез 2. Просрочка по процентам
- поз 16, DOUBLE, id 221: LOAN_SUMMARY.OverduePenalty — Задолженность. Разрез 2. Просрочка по штрафам

**Уровень группировки 3 (TABLE_GROUP3)** — 14 ячеек

- поз 1, INTEGER, id 222: LOAN_SUMMARY.Count — Задолженность. Разрез 3. Кол-во субъектов
- поз 2, INTEGER, id 223: LOAN_SUMMARY.DetailsCount — Задолженность. Разрез 3. Кол-во кредитов
- поз 3, TEXT, id 224: LOAN_SUMMARY.Name — Задолженность. Разрез 3. Наименование
- поз 5, DOUBLE, id 225: LOAN_SUMMARY.LoanAmount — Задолженность. Разрез 3. Сумма по договору
- поз 6, DOUBLE, id 226: LOAN_SUMMARY.TotalDisbursment — Задолженность. Разрез 3. Всего получено
- поз 8, DOUBLE, id 227: LOAN_SUMMARY.TotalPaid — Задолженность. Разрез 3. Всего погашено
- поз 9, DOUBLE, id 228: LOAN_SUMMARY.RemainingSum — Задолженность. Разрез 3. Остаток задолженности
- поз 10, DOUBLE, id 229: LOAN_SUMMARY.RemainingPrincipal — Задолженность. Разрез 3. Остаток по основной сумме
- поз 11, DOUBLE, id 230: LOAN_SUMMARY.RemainingInterest — Задолженность. Разрез 3. Остаток по процентам
- поз 12, DOUBLE, id 231: LOAN_SUMMARY.RemainingPenalty — Задолженность. Разрез 3. Остаток по штрафам
- поз 13, DOUBLE, id 232: LOAN_SUMMARY.OverdueAll — Задолженность. Разрез 3. Просроченная задолженность
- поз 14, DOUBLE, id 233: LOAN_SUMMARY.OverduePrincipal — Задолженность. Разрез 3. Просрочка по основной сумме
- поз 15, DOUBLE, id 234: LOAN_SUMMARY.OverdueInterest — Задолженность. Разрез 3. Просрочка по процентам
- поз 16, DOUBLE, id 235: LOAN_SUMMARY.OverduePenalty — Задолженность. Разрез 3. Просрочка по штрафам

**Уровень группировки 4 (TABLE_GROUP4)** — 18 ячеек

- поз 1, INTEGER, id 236: LOAN_SUMMARY.Count — Задолженность. Разрез 4. Кол-во субъектов
- поз 2, INTEGER, id 237: LOAN_SUMMARY.DetailsCount — Задолженность. Разрез 4. Кол-во кредитов
- поз 3, TEXT, id 238: LOAN_SUMMARY.Name — Задолженность. Разрез 4. Наименование
- поз 4, TEXT, id 418: LOAN_SUMMARY.loanType — Задолженность. Разрез 4. Вид кредита
- поз 5, DOUBLE, id 239: LOAN_SUMMARY.LoanAmount — Задолженность. Разрез 4. Сумма по договору
- поз 6, DOUBLE, id 240: LOAN_SUMMARY.TotalDisbursment — Задолженность. Разрез 4. Всего получено
- поз 7, DATE, id 415: LOAN_SUMMARY.lastDate — Задолженность. Разрез 4. Срок возврата.
- поз 8, DOUBLE, id 241: LOAN_SUMMARY.TotalPaid — Задолженность. Разрез 4. Всего погашено
- поз 9, DOUBLE, id 242: LOAN_SUMMARY.RemainingSum — Задолженность. Разрез 4. Остаток задолженности
- поз 10, DOUBLE, id 243: LOAN_SUMMARY.RemainingPrincipal — Задолженность. Разрез 4. Остаток по основной сумме
- поз 11, DOUBLE, id 244: LOAN_SUMMARY.RemainingInterest — Задолженность. Разрез 4. Остаток по процентам
- поз 12, DOUBLE, id 245: LOAN_SUMMARY.RemainingPenalty — Задолженность. Разрез 4. Остаток по штрафам
- поз 13, DOUBLE, id 246: LOAN_SUMMARY.OverdueAll — Задолженность. Разрез 4. Просроченная задолженность
- поз 14, DOUBLE, id 247: LOAN_SUMMARY.OverduePrincipal — Задолженность. Разрез 4. Просрочка по основной сумме
- поз 15, DOUBLE, id 248: LOAN_SUMMARY.OverdueInterest — Задолженность. Разрез 4. Просрочка по процентам
- поз 16, DOUBLE, id 249: LOAN_SUMMARY.OverduePenalty — Задолженность. Разрез 4. Просрочка по штрафам
- поз 17, TEXT, id 923: LOAN_SUMMARY.details — Задолженность. Разрез4. Примечание
- поз 18, DOUBLE, id 419: LOAN_SUMMARY.RemainingDiff — Задолженность. Разрез 4. Курсовая разница

**Уровень группировки 5 (TABLE_GROUP5)** — 14 ячеек

- поз 1, INTEGER, id 250: LOAN_SUMMARY.Count — Задолженность. Разрез 5. Кол-во субъектов
- поз 2, INTEGER, id 251: LOAN_SUMMARY.DetailsCount — Задолженность. Разрез 5. Кол-во кредитов
- поз 3, TEXT, id 252: LOAN_SUMMARY.Name — Задолженность. Разрез 5. Наименование
- поз 5, DOUBLE, id 253: LOAN_SUMMARY.LoanAmount — Задолженность. Разрез 5. Сумма по договору
- поз 6, DOUBLE, id 254: LOAN_SUMMARY.TotalDisbursment — Задолженность. Разрез 5. Всего получено
- поз 8, DOUBLE, id 255: LOAN_SUMMARY.TotalPaid — Задолженность. Разрез 5. Всего погашено
- поз 9, DOUBLE, id 256: LOAN_SUMMARY.RemainingSum — Задолженность. Разрез 5. Остаток задолженности
- поз 10, DOUBLE, id 257: LOAN_SUMMARY.RemainingPrincipal — Задолженность. Разрез 5. Остаток по основной сумме
- поз 11, DOUBLE, id 258: LOAN_SUMMARY.RemainingInterest — Задолженность. Разрез 5. Остаток по процентам
- поз 12, DOUBLE, id 259: LOAN_SUMMARY.RemainingPenalty — Задолженность. Разрез 5. Остаток по штрафам
- поз 13, DOUBLE, id 260: LOAN_SUMMARY.OverdueAll — Задолженность. Разрез 5. Просроченная задолженность
- поз 14, DOUBLE, id 261: LOAN_SUMMARY.OverduePrincipal — Задолженность. Разрез 5. Просрочка по основной сумме
- поз 15, DOUBLE, id 262: LOAN_SUMMARY.OverdueInterest — Задолженность. Разрез 5. Просрочка по процентам
- поз 16, DOUBLE, id 263: LOAN_SUMMARY.OverduePenalty — Задолженность. Разрез 5. Просрочка по штрафам

**Итоговая строка (TABLE_SUM)** — 14 ячеек

- поз 1, INTEGER, id 179: LOAN_SUMMARY.Count — Звдолженность. Итого. Кол-во субъектов
- поз 2, INTEGER, id 180: LOAN_SUMMARY.DetailsCount — Звдолженность. Итого. Кол-во кредитов
- поз 3, TEXT, id 181: «ИТОГО» — Звдолженность. Итого. Итого
- поз 5, DOUBLE, id 183: LOAN_SUMMARY.LoanAmount — Звдолженность. Итого. Сумма по договору
- поз 6, DOUBLE, id 184: LOAN_SUMMARY.TotalDisbursment — Звдолженность. Итого. Всего получено
- поз 8, DOUBLE, id 185: LOAN_SUMMARY.TotalPaid — Звдолженность. Итого. Всего погашено
- поз 9, DOUBLE, id 186: LOAN_SUMMARY.RemainingSum — Задолженность. Итого. Остаток задолженности
- поз 10, DOUBLE, id 187: LOAN_SUMMARY.RemainingPrincipal — Задолженность. Итого. Остаток по основной сумме
- поз 11, DOUBLE, id 188: LOAN_SUMMARY.RemainingInterest — Задолженность. Итого. Остаток по процентам
- поз 12, DOUBLE, id 189: LOAN_SUMMARY.RemainingPenalty — Задолженность. Итого. Остаток по штрафам
- поз 13, DOUBLE, id 190: LOAN_SUMMARY.OverdueAll — Задолженность. Итого. Просроченная задолженность
- поз 14, DOUBLE, id 191: LOAN_SUMMARY.OverduePrincipal — Задолженность. Итого. Просрочка по основной сумме
- поз 15, DOUBLE, id 192: LOAN_SUMMARY.OverdueInterest — Задолженность. Итого. Просрочка по процентам
- поз 16, DOUBLE, id 193: LOAN_SUMMARY.OverduePenalty — Задолженность. Итого. Просрочка по штрафам

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Куратор, Отдел, Заемщик, Кредит, Расчет, Постановление, Группа платежеспособности, Кредитная линия, Группа заемщика, Подгруппа заемщика, Статус (акт сверки), Группа по освоению, Группа по залогу, Вид валюты, Аокмоту, Село, Высокогорье.

Шаблон отчёта 3 «Отчет по задолженности (Баткенская область)»: на дату 2019-01-01, доп. дата 2018-01-01, в тысячах 1000; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Расчет; 6:— (скрыт).

### Отчёт 4. Отчет по погашениям (`LOAN_PAYMENT`)

Ячеек: 67.

**Заголовок страницы** — 2 ячеек

- кол 1–7, стр 1–1, TEXT: «Информация по погашениям»
- кол 1–7, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 13 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во кред-тов»
- кол 3–3, стр 5–6, TEXT: «Кол-во погашений»
- кол 4–4, стр 5–6, TEXT: «Наименование»
- кол 5–5, стр 5–6, TEXT: «Всего погашено»
- кол 6–8, стр 5–5, TEXT: «в том числе»
- кол 6–6, стр 6–6, TEXT: «по основной сумме»
- кол 7–7, стр 6–6, TEXT: «по процентам»
- кол 8–8, стр 6–6, TEXT: «по штрафам»
- кол 9–9, стр 5–6, TEXT: «Номер плат. документа»
- кол 10–10, стр 5–6, TEXT: «Дата платежа»
- кол 11–11, стр 5–6, TEXT: «Курс на дату платежа»
- кол 12–12, стр 5–6, TEXT: «Вид погашения»

**Уровень группировки 1 (TABLE_GROUP1)** — 8 ячеек

- поз 1, INTEGER, id 291: LOAN_PAYMENT.Count — Погашения. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 292: LOAN_PAYMENT.DetailsCount — Погашения. Разрез1. Кол-во кредитов
- поз 3, INTEGER, id 293: LOAN_PAYMENT.PaymentCount — Погашения. Разрез1. Кол-во погашений
- поз 4, TEXT, id 294: LOAN_PAYMENT.Name — Погашения. Разрез1. Наименование
- поз 5, DOUBLE, id 287: LOAN_PAYMENT.PaymentTotalAmount — Погашения. Разрез1. Всего погашено
- поз 6, DOUBLE, id 288: LOAN_PAYMENT.PaymentPrincipal — Погашения. Разрез1. по осн.сумме
- поз 7, DOUBLE, id 289: LOAN_PAYMENT.PaymentInterest — Погашения. Разрез1. по процентам
- поз 8, DOUBLE, id 290: LOAN_PAYMENT.PaymentPenalty — Погашения. Разрез1. по штрафам

**Уровень группировки 2 (TABLE_GROUP2)** — 8 ячеек

- поз 1, INTEGER, id 299: LOAN_PAYMENT.Count — Погашения. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 300: LOAN_PAYMENT.DetailsCount — Погашения. Разрез2. Кол-во кредитов
- поз 3, INTEGER, id 301: LOAN_PAYMENT.PaymentCount — Погашения. Разрез2. Кол-во погашений
- поз 4, TEXT, id 302: LOAN_PAYMENT.Name — Погашения. Разрез2. Наименование
- поз 5, DOUBLE, id 295: LOAN_PAYMENT.PaymentTotalAmount — Погашения. Разрез2. Всего погашено
- поз 6, DOUBLE, id 296: LOAN_PAYMENT.PaymentPrincipal — Погашения. Разрез2. по осн.сумме
- поз 7, DOUBLE, id 297: LOAN_PAYMENT.PaymentInterest — Погашения. Разрез2. по процентам
- поз 8, DOUBLE, id 298: LOAN_PAYMENT.PaymentPenalty — Погашения. Разрез2. по штрафам

**Уровень группировки 3 (TABLE_GROUP3)** — 8 ячеек

- поз 1, INTEGER, id 307: LOAN_PAYMENT.Count — Погашения. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 308: LOAN_PAYMENT.DetailsCount — Погашения. Разрез3. Кол-во кредитов
- поз 3, INTEGER, id 309: LOAN_PAYMENT.PaymentCount — Погашения. Разрез3. Кол-во погашений
- поз 4, TEXT, id 310: LOAN_PAYMENT.Name — Погашения. Разрез3. Наименование
- поз 5, DOUBLE, id 303: LOAN_PAYMENT.PaymentTotalAmount — Погашения. Разрез3. Всего погашено
- поз 6, DOUBLE, id 304: LOAN_PAYMENT.PaymentPrincipal — Погашения. Разрез3. по осн.сумме
- поз 7, DOUBLE, id 305: LOAN_PAYMENT.PaymentInterest — Погашения. Разрез3. по процентам
- поз 8, DOUBLE, id 306: LOAN_PAYMENT.PaymentPenalty — Погашения. Разрез3. по штрафам

**Уровень группировки 4 (TABLE_GROUP4)** — 8 ячеек

- поз 1, INTEGER, id 315: LOAN_PAYMENT.Count — Погашения. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 316: LOAN_PAYMENT.DetailsCount — Погашения. Разрез4. Кол-во кредитов
- поз 3, INTEGER, id 317: LOAN_PAYMENT.PaymentCount — Погашения. Разрез4. Кол-во погашений
- поз 4, TEXT, id 318: LOAN_PAYMENT.Name — Погашения. Разрез4. Наименование
- поз 5, DOUBLE, id 311: LOAN_PAYMENT.PaymentTotalAmount — Погашения. Разрез4. Всего погашено
- поз 6, DOUBLE, id 312: LOAN_PAYMENT.PaymentPrincipal — Погашения. Разрез4. по осн.сумме
- поз 7, DOUBLE, id 313: LOAN_PAYMENT.PaymentInterest — Погашения. Разрез4. по процентам
- поз 8, DOUBLE, id 314: LOAN_PAYMENT.PaymentPenalty — Погашения. Разрез4. по штрафам

**Уровень группировки 5 (TABLE_GROUP5)** — 12 ячеек

- поз 1, INTEGER, id 323: LOAN_PAYMENT.Count — Погашения. Разрез5. Кол-во заемщиков
- поз 2, INTEGER, id 324: LOAN_PAYMENT.DetailsCount — Погашения. Разрез5. Кол-во кредитов
- поз 3, INTEGER, id 325: LOAN_PAYMENT.PaymentCount — Погашения. Разрез5. Кол-во погашений
- поз 4, TEXT, id 326: LOAN_PAYMENT.Name — Погашения. Разрез5. Наименование
- поз 5, DOUBLE, id 319: LOAN_PAYMENT.PaymentTotalAmount — Погашения. Разрез5. Всего погашено
- поз 6, DOUBLE, id 320: LOAN_PAYMENT.PaymentPrincipal — Погашения. Разрез5. по осн.сумме
- поз 7, DOUBLE, id 321: LOAN_PAYMENT.PaymentInterest — Погашения. Разрез5. по процентам
- поз 8, DOUBLE, id 322: LOAN_PAYMENT.PaymentPenalty — Погашения. Разрез5. по штрафам
- поз 9, TEXT, id 334: LOAN_PAYMENT.PaymentNumber — Погашения. Разрез5. Номер платежного документа
- поз 10, DATE, id 335: LOAN_PAYMENT.PaymentDate — Погашения. Разрез 5. Дата погашения
- поз 11, DOUBLE, id 336: LOAN_PAYMENT.ExchangeRate — Погашения. Разрез 5. Курс на дату погашения
- поз 12, TEXT, id 337: LOAN_PAYMENT.paymentType — Погашения. Разрез 5. Вид погашения

**Итоговая строка (TABLE_SUM)** — 8 ячеек

- поз 1, INTEGER, id 283: LOAN_PAYMENT.Count — Погашения. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 284: LOAN_PAYMENT.DetailsCount — Погашения. Итого. Кол-во кредитов
- поз 3, INTEGER, id 285: LOAN_PAYMENT.PaymentCount — Погашения. Итого. Кол-во погашений
- поз 4, TEXT, id 286: «ИТОГО» — Погашения. Итого. Итого
- поз 5, DOUBLE, id 279: LOAN_PAYMENT.PaymentTotalAmount — Погашения. Итого. Всего погашено
- поз 6, DOUBLE, id 280: LOAN_PAYMENT.PaymentPrincipal — Погашения. Итого. по осн.сумме
- поз 7, DOUBLE, id 281: LOAN_PAYMENT.PaymentInterest — Погашения. Итого. по процентам
- поз 8, DOUBLE, id 282: LOAN_PAYMENT.PaymentPenalty — Погашения. Итого. по штрафам

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Куратор, Отдел, Заемщик, Кредит, Погашение, Группа платежеспособности, Группа заемщика, Аокмоту.

Шаблон отчёта 4 «Отчет по погашениям»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Погашение; 6:— (скрыт).

### Отчёт 5. Отчет по графикам (`LOAN_SCHEDULE`)

Ячеек: 77.

**Заголовок страницы** — 2 ячеек

- кол 1–7, стр 1–1, TEXT: «Информация по графикам»
- кол 1–7, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 13 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во кред-тов»
- кол 3–3, стр 5–6, TEXT: «Кол-во погашений»
- кол 4–4, стр 5–6, TEXT: «Наименование»
- кол 5–5, стр 5–6, TEXT: «Дата»
- кол 6–6, стр 5–6, TEXT: «Всего освоено»
- кол 7–7, стр 5–6, TEXT: «Всего по графику»
- кол 8–11, стр 5–5, TEXT: «в том числе»
- кол 8–8, стр 6–6, TEXT: «по основной сумме»
- кол 9–9, стр 6–6, TEXT: «по процентам»
- кол 10–10, стр 6–6, TEXT: «по нак. процентам»
- кол 11–11, стр 6–6, TEXT: «по нак. штрафам»
- кол 12–12, стр 5–6, TEXT: «Статус»

**Уровень группировки 1 (TABLE_GROUP1)** — 10 ячеек

- поз 1, INTEGER, id 363: LOAN_PAYMENT.Count — Графики. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 364: LOAN_PAYMENT.DetailsCount — Графики. Разрез1. Кол-во кредитов
- поз 3, INTEGER, id 365: LOAN_PAYMENT.PaymentCount — Графики. Разрез1. Кол-во графиков
- поз 4, TEXT, id 366: LOAN_PAYMENT.Name — Графики. Разрез1. Наименование
- поз 6, DOUBLE, id 367: LOAN_PAYMENT.Disbursement — Графики. Разрез1. Всего освоено
- поз 7, DOUBLE, id 368: LOAN_PAYMENT.TotalPayment — Графики. Разрез1. Всего по графику
- поз 8, DOUBLE, id 369: LOAN_PAYMENT.Principal_payment — Графики. Разрез1. по осн.суме
- поз 9, DOUBLE, id 370: LOAN_PAYMENT.Interest_payment — Графики. Разрез1. по процентам
- поз 10, DOUBLE, id 371: LOAN_PAYMENT.Collected_interest_payment — Графики. Разрез1. по нак. процентам
- поз 11, DOUBLE, id 372: LOAN_PAYMENT.Collected_penalty_payment — Графики. Разрез1. по нак. штрафам

**Уровень группировки 2 (TABLE_GROUP2)** — 10 ячеек

- поз 1, INTEGER, id 373: LOAN_PAYMENT.Count — Графики. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 374: LOAN_PAYMENT.DetailsCount — Графики. Разрез2. Кол-во кредитов
- поз 3, INTEGER, id 375: LOAN_PAYMENT.PaymentCount — Графики. Разрез2. Кол-во графиков
- поз 4, TEXT, id 376: LOAN_PAYMENT.Name — Графики. Разрез2. Наименование
- поз 6, DOUBLE, id 377: LOAN_PAYMENT.Disbursement — Графики. Разрез2. Всего освоено
- поз 7, DOUBLE, id 378: LOAN_PAYMENT.TotalPayment — Графики. Разрез2. Всего по графику
- поз 8, DOUBLE, id 379: LOAN_PAYMENT.Principal_payment — Графики. Разрез2. по осн.суме
- поз 9, DOUBLE, id 380: LOAN_PAYMENT.Interest_payment — Графики. Разрез2. по процентам
- поз 10, DOUBLE, id 381: LOAN_PAYMENT.Collected_interest_payment — Графики. Разрез2. по нак. процентам
- поз 11, DOUBLE, id 382: LOAN_PAYMENT.Collected_penalty_payment — Графики. Разрез2. по нак. штрафам

**Уровень группировки 3 (TABLE_GROUP3)** — 10 ячеек

- поз 1, INTEGER, id 383: LOAN_PAYMENT.Count — Графики. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 384: LOAN_PAYMENT.DetailsCount — Графики. Разрез3. Кол-во кредитов
- поз 3, INTEGER, id 385: LOAN_PAYMENT.PaymentCount — Графики. Разрез3. Кол-во графиков
- поз 4, TEXT, id 386: LOAN_PAYMENT.Name — Графики. Разрез3. Наименование
- поз 6, DOUBLE, id 387: LOAN_PAYMENT.Disbursement — Графики. Разрез3. Всего освоено
- поз 7, DOUBLE, id 388: LOAN_PAYMENT.TotalPayment — Графики. Разрез3. Всего по графику
- поз 8, DOUBLE, id 389: LOAN_PAYMENT.Principal_payment — Графики. Разрез3. по осн.суме
- поз 9, DOUBLE, id 390: LOAN_PAYMENT.Interest_payment — Графики. Разрез3. по процентам
- поз 10, DOUBLE, id 391: LOAN_PAYMENT.Collected_interest_payment — Графики. Разрез3. по нак. процентам
- поз 11, DOUBLE, id 392: LOAN_PAYMENT.Collected_penalty_payment — Графики. Разрез3. по нак. штрафам

**Уровень группировки 4 (TABLE_GROUP4)** — 10 ячеек

- поз 1, INTEGER, id 393: LOAN_PAYMENT.Count — Графики. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 394: LOAN_PAYMENT.DetailsCount — Графики. Разрез4. Кол-во кредитов
- поз 3, INTEGER, id 395: LOAN_PAYMENT.PaymentCount — Графики. Разрез4. Кол-во графиков
- поз 4, TEXT, id 396: LOAN_PAYMENT.Name — Графики. Разрез4. Наименование
- поз 6, DOUBLE, id 397: LOAN_PAYMENT.Disbursement — Графики. Разрез4. Всего освоено
- поз 7, DOUBLE, id 398: LOAN_PAYMENT.TotalPayment — Графики. Разрез4. Всего по графику
- поз 8, DOUBLE, id 399: LOAN_PAYMENT.Principal_payment — Графики. Разрез4. по осн.суме
- поз 9, DOUBLE, id 400: LOAN_PAYMENT.Interest_payment — Графики. Разрез4. по процентам
- поз 10, DOUBLE, id 401: LOAN_PAYMENT.Collected_interest_payment — Графики. Разрез4. по нак. процентам
- поз 11, DOUBLE, id 402: LOAN_PAYMENT.Collected_penalty_payment — Графики. Разрез4. по нак. штрафам

**Уровень группировки 5 (TABLE_GROUP5)** — 12 ячеек

- поз 1, INTEGER, id 403: LOAN_PAYMENT.Count — Графики. Разрез5. Кол-во заемщиков
- поз 2, INTEGER, id 404: LOAN_PAYMENT.DetailsCount — Графики. Разрез5. Кол-во кредитов
- поз 3, INTEGER, id 405: LOAN_PAYMENT.PaymentCount — Графики. Разрез5. Кол-во графиков
- поз 4, TEXT, id 406: LOAN_PAYMENT.Name — Графики. Разрез5. Наименование
- поз 5, DATE, id 413: LOAN_SCHEDULE.ExpectedDate — Графики. Разрез 5. Дата графика
- поз 6, DOUBLE, id 407: LOAN_PAYMENT.Disbursement — Графики. Разрез5. Всего освоено
- поз 7, DOUBLE, id 408: LOAN_PAYMENT.TotalPayment — Графики. Разрез5. Всего по графику
- поз 8, DOUBLE, id 409: LOAN_PAYMENT.Principal_payment — Графики. Разрез5. по осн.суме
- поз 9, DOUBLE, id 410: LOAN_PAYMENT.Interest_payment — Графики. Разрез5. по процентам
- поз 10, DOUBLE, id 411: LOAN_PAYMENT.Collected_interest_payment — Графики. Разрез5. по нак. процентам
- поз 11, DOUBLE, id 412: LOAN_PAYMENT.Collected_penalty_payment — Графики. Разрез5. по нак. штрафам
- поз 12, TEXT, id 414: LOAN_SCHEDULE.installment_state_id — Графики. Разрез 5. Статус

**Итоговая строка (TABLE_SUM)** — 10 ячеек

- поз 1, INTEGER, id 353: LOAN_PAYMENT.Count — Графики. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 354: LOAN_PAYMENT.DetailsCount — Графики. Итого. Кол-во кредитов
- поз 3, INTEGER, id 355: LOAN_PAYMENT.PaymentCount — Графики. Итого. Кол-во графиков
- поз 4, TEXT, id 356: «ИТОГО» — Графики. Итого. Итого
- поз 6, DOUBLE, id 357: LOAN_PAYMENT.Disbursement — Графики. Итого. Всего освоено
- поз 7, DOUBLE, id 358: LOAN_PAYMENT.TotalPayment — Графики. Итого. Всего по графику
- поз 8, DOUBLE, id 359: LOAN_PAYMENT.Principal_payment — Графики. Итого. по осн.суме
- поз 9, DOUBLE, id 360: LOAN_PAYMENT.Interest_payment — Графики. Итого. по процентам
- поз 10, DOUBLE, id 361: LOAN_PAYMENT.Collected_interest_payment — Графики. Итого. по нак. процентам
- поз 11, DOUBLE, id 362: LOAN_PAYMENT.Collected_penalty_payment — Графики. Итого. по нак. штрафам

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Куратор, Отдел, Заемщик, Кредит, График, Группа платежеспособности, Кредитная линия, Вид валюты.

Шаблон отчёта 5 «Отчет по графикам»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик (скрыт); 4:Кредит (скрыт); 5:График (скрыт); 6:— (скрыт).

### Отчёт 6. Отчет по залогу (`COLLATERAL_ITEM`)

Ячеек: 95.

**Заголовок страницы** — 2 ячеек

- кол 1–7, стр 1–1, TEXT: «Информация по залогу»
- кол 1–7, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 23 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во дог.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–6, стр 5–5, TEXT: «Договор залога»
- кол 4–4, стр 6–6, TEXT: «Дата»
- кол 5–5, стр 6–6, TEXT: «Номер»
- кол 6–6, стр 6–6, TEXT: «Арест / Залогодатель»
- кол 7–10, стр 5–5, TEXT: «Предмет залога»
- кол 7–7, стр 6–6, TEXT: «Наименование»
- кол 8–8, стр 6–6, TEXT: «Кол-во»
- кол 9–9, стр 6–6, TEXT: «Вид залога»
- кол 10–10, стр 6–6, TEXT: «Стоимость»
- кол 11–11, стр 5–6, TEXT: «Статус»
- кол 11–11, стр 6–6, TEXT: «Зал. стоимость»
- кол 12–12, стр 5–6, TEXT: «Состояние»
- кол 13–13, стр 5–6, TEXT: «Дата обследования»
- кол 14–14, стр 5–6, TEXT: «Детали»
- кол 15–15, стр 5–6, TEXT: «Примечание куратора»
- кол 16–16, стр 5–6, TEXT: «Получено»
- кол 17–17, стр 5–6, TEXT: «Погашено»
- кол 18–18, стр 5–6, TEXT: «Срок возврата»
- кол 19–19, стр 5–6, TEXT: «Остаток задолженности»
- кол 20–20, стр 5–6, TEXT: «Просрочка»

**Уровень группировки 1 (TABLE_GROUP1)** — 10 ячеек

- поз 1, INTEGER, id 437: COLLATERAL_ITEM.Count — Предмет залога. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 438: COLLATERAL_ITEM.DetailsCount — Предмет залога. Разрез1. Кол-во договоров
- поз 3, TEXT, id 439: COLLATERAL_ITEM.Name — Предмет залога. Разрез1. Наименование
- поз 8, DOUBLE, id 795: COLLATERAL_ITEM.CollateralItemQuantity — Предмет залога. Разрез1. Кол-во залога
- поз 10, DOUBLE, id 440: COLLATERAL_ITEM.CollateralItemCollateralValue — Предмет залога. Разрез1. Залоговая стоимость
- поз 11, DOUBLE, id 783: COLLATERAL_ITEM.CollateralItemEstimatedValue — Предмет залога. Разрез1. Оценочная  стоимость
- поз 16, DOUBLE, id 968: COLLATERAL_ITEM.totalDisbursment — Предмет залога. Разрез 1. Всего получено
- поз 17, DOUBLE, id 974: COLLATERAL_ITEM.totalPaidInCurrency — Предмет залога. Разрез 1. Погашено
- поз 19, DOUBLE, id 802: COLLATERAL_ITEM.RemainingSum — Предмет залога. Разрез1. Остаток задолженности
- поз 20, DOUBLE, id 960: COLLATERAL_ITEM.overdueAll — Предмет залога. Разрез 1. Просрочка

**Уровень группировки 2 (TABLE_GROUP2)** — 10 ячеек

- поз 1, INTEGER, id 441: COLLATERAL_ITEM.Count — Предмет залога. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 442: COLLATERAL_ITEM.DetailsCount — Предмет залога. Разрез2. Кол-во договоров
- поз 3, TEXT, id 443: COLLATERAL_ITEM.Name — Предмет залога. Разрез2. Наименование
- поз 8, DOUBLE, id 796: COLLATERAL_ITEM.CollateralItemQuantity — Предмет залога. Разрез2. Кол-во залога
- поз 10, DOUBLE, id 444: COLLATERAL_ITEM.CollateralItemCollateralValue — Предмет залога. Разрез2. Залоговая стоимость
- поз 11, DOUBLE, id 782: COLLATERAL_ITEM.CollateralItemEstimatedValue — Предмет залога. Разрез2. Оценочная  стоимость
- поз 16, DOUBLE, id 967: COLLATERAL_ITEM.totalDisbursment — Предмет залога. Разрез 2. Всего получено
- поз 17, DOUBLE, id 973: COLLATERAL_ITEM.totalPaidInCurrency — Предмет залога. Разрез 2. погашено
- поз 19, DOUBLE, id 801: COLLATERAL_ITEM.RemainingSum — Предмет залога. Разрез2. Остаток задолженности
- поз 20, DOUBLE, id 959: COLLATERAL_ITEM.overdueAll — Предмет залога. Разрез 2. Просрочка

**Уровень группировки 3 (TABLE_GROUP3)** — 10 ячеек

- поз 1, INTEGER, id 445: COLLATERAL_ITEM.Count — Предмет залога. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 446: COLLATERAL_ITEM.DetailsCount — Предмет залога. Разрез3. Кол-во договоров
- поз 3, TEXT, id 447: COLLATERAL_ITEM.Name — Предмет залога. Разрез3. Наименование
- поз 8, DOUBLE, id 797: COLLATERAL_ITEM.CollateralItemQuantity — Предмет залога. Разрез3. Кол-во залога
- поз 10, DOUBLE, id 448: COLLATERAL_ITEM.CollateralItemCollateralValue — Предмет залога. Разрез3. Залоговая стоимость
- поз 11, DOUBLE, id 781: COLLATERAL_ITEM.CollateralItemEstimatedValue — Предмет залога. Разрез3. Оценочная  стоимость
- поз 16, DOUBLE, id 966: COLLATERAL_ITEM.totalDisbursment — Предмет залога. Разрез 3. Всего получено
- поз 17, DOUBLE, id 972: COLLATERAL_ITEM.totalPaidInCurrency — Предмет залога. Разрез 3. погашено
- поз 19, DOUBLE, id 800: COLLATERAL_ITEM.RemainingSum — Предмет залога. Разрез3. Остаток задолженности
- поз 20, DOUBLE, id 958: COLLATERAL_ITEM.overdueAll — Предмет залога. Разрез 3. Просрочка

**Уровень группировки 4 (TABLE_GROUP4)** — 13 ячеек

- поз 1, INTEGER, id 453: COLLATERAL_ITEM.Count — Предмет залога. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 454: COLLATERAL_ITEM.DetailsCount — Предмет залога. Разрез4. Кол-во договоров
- поз 3, TEXT, id 455: COLLATERAL_ITEM.Name — Предмет залога. Разрез4. Наименование
- поз 4, DATE, id 457: COLLATERAL_ITEM.CollateralAgreementDate — Предмет залога. Разрез4. Дата договора
- поз 5, TEXT, id 458: COLLATERAL_ITEM.CollateralAgreementNumber — Предмет залога. Разрез4. Номер договора
- поз 6, TEXT, id 776: COLLATERAL_ITEM.CollateralItemArrestPlace — Предмет залога. Разрез4. Место ареста
- поз 8, DOUBLE, id 798: COLLATERAL_ITEM.CollateralItemQuantity — Предмет залога. Разрез4. Кол-во залога
- поз 10, DOUBLE, id 456: COLLATERAL_ITEM.CollateralItemCollateralValue — Предмет залога. Разрез4. Залоговая стоимость
- поз 11, DOUBLE, id 780: COLLATERAL_ITEM.CollateralItemEstimatedValue — Предмет залога. Разрез4. Оценочная  стоимость
- поз 16, DOUBLE, id 965: COLLATERAL_ITEM.totalDisbursment — Предмет залога. Разрез 4. Всего получено
- поз 17, DOUBLE, id 971: COLLATERAL_ITEM.totalPaidInCurrency — Предмет залога. Разрез 4. Погашено
- поз 19, DOUBLE, id 799: COLLATERAL_ITEM.RemainingSum — Предмет залога. Разрез4. Остаток задолженности
- поз 20, DOUBLE, id 957: COLLATERAL_ITEM.overdueAll — Предмет залога. Разрез 4. просрочка

**Уровень группировки 5 (TABLE_GROUP5)** — 6 ячеек

- поз 3, TEXT, id 737: COLLATERAL_ITEM.Name — Предмет залога. Разрез5. Наименование кредита
- поз 16, DOUBLE, id 964: COLLATERAL_ITEM.totalDisbursment — Предмет залога. Разрез 5. всего получено
- поз 17, DOUBLE, id 970: COLLATERAL_ITEM.totalPaidInCurrency — Предмет залога. Разрез 5. Погашено
- поз 18, DATE, id 954: COLLATERAL_ITEM.loanLastDate — Предмет залога. Разрез 5. Срок возврата
- поз 19, DOUBLE, id 739: COLLATERAL_ITEM.RemainingSum — Предмет залога. Разрез5. Остаток задолженности
- поз 20, DOUBLE, id 953: COLLATERAL_ITEM.overdueAll — Предмет залога. Разрез 5. Просрочка

**Уровень группировки 6 (TABLE_GROUP6)** — 11 ячеек

- поз 6, TEXT, id 777: COLLATERAL_ITEM.CollateralItemOwner — Предмет залога. Разрез6. Залогодатель
- поз 7, TEXT, id 460: COLLATERAL_ITEM.CollateralItemName — Предмет залога. Разрез6. Наименование залога
- поз 8, DOUBLE, id 461: COLLATERAL_ITEM.CollateralItemQuantity — Предмет залога. Разрез6. Количество залога
- поз 9, TEXT, id 462: COLLATERAL_ITEM.CollateralItemTypeId — Предмет залога. Разрез6. Вид залога
- поз 10, DOUBLE, id 459: COLLATERAL_ITEM.CollateralItemCollateralValue — Предмет залога. Разрез6. Залоговая стоимость
- поз 11, DOUBLE, id 779: COLLATERAL_ITEM.CollateralItemEstimatedValue — Предмет залога. Разрез6. Оценочная  стоимость
- поз 11, TEXT, id 785: COLLATERAL_ITEM.collateralItemArrestFreeStatusId — Предмет залога. Разрез6. Статус ареста
- поз 12, TEXT, id 790: COLLATERAL_ITEM.collateralItemLastCondition — Предмет залога. Разрез6. Состояние залога
- поз 13, TEXT, id 791: COLLATERAL_ITEM.collateralItemInspectionDate — Предмет залога. Разрез6. Дата обследования
- поз 14, TEXT, id 792: COLLATERAL_ITEM.collateralItemDetails — Предмет залога. Разрез6. Детальные данные
- поз 15, TEXT, id 793: COLLATERAL_ITEM.collateralItemCollateralDescription — Предмет залога. Разрез6. Примечание куратора

**Итоговая строка (TABLE_SUM)** — 10 ячеек

- поз 1, INTEGER, id 433: COLLATERAL_ITEM.Count — Предмет залога. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 434: COLLATERAL_ITEM.DetailsCount — Предмет залога. Итого. Кол-во договоров
- поз 3, TEXT, id 435: «ИТОГО» — Предмет залога. Итого. Итого
- поз 8, DOUBLE, id 794: COLLATERAL_ITEM.CollateralItemQuantity — Предмет залога. Итого. Кол-во залога
- поз 10, DOUBLE, id 436: COLLATERAL_ITEM.CollateralItemCollateralValue — Предмет залога. Итого. Залоговая стоимость
- поз 11, DOUBLE, id 784: COLLATERAL_ITEM.CollateralItemEstimatedValue — Предмет залога. ИТОГО. Оценочная  стоимость
- поз 16, DOUBLE, id 969: COLLATERAL_ITEM.totalDisbursment — Предмет залога. Итого. Всего получено
- поз 17, DOUBLE, id 975: COLLATERAL_ITEM.totalPaidInCurrency — Предмет залога. Итого. Погашено
- поз 19, DOUBLE, id 803: COLLATERAL_ITEM.RemainingSum — Предмет залога. ИТОГО. Остаток задолженности
- поз 20, DOUBLE, id 961: COLLATERAL_ITEM.overdueAll — Предмет залога. Итого. Просрочка

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Заемщик, Кредит, Договор залога, Предмет залога, Вид залога, Группа платежеспособности, Состояние обследования, Группа залога.

Шаблон отчёта 6 «Отчет по залогу»: на дату 2019-01-01, доп. дата None, в тысячах 1000; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Договор залога; 5:Кредит; 6:Предмет залога.

### Отчёт 7. Отчет по актам обследования (`COLLATERAL_INSPECTION`)

Ячеек: 43.

**Заголовок страницы** — 2 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по актам обследования»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 9 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во пр. зал.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–4, стр 5–6, TEXT: «Оц. стоимость»
- кол 5–8, стр 5–5, TEXT: «Акт обследования»
- кол 5–5, стр 6–6, TEXT: «Кол-во а.об.»
- кол 6–6, стр 6–6, TEXT: «Дата»
- кол 7–7, стр 6–6, TEXT: «Результат»
- кол 8–8, стр 6–6, TEXT: «Примечание»

**Уровень группировки 1 (TABLE_GROUP1)** — 5 ячеек

- поз 1, INTEGER, id 475: COLLATERAL_INSPECTION.Count — Акт обследования. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 807: COLLATERAL_INSPECTION.PaymentCount — Акт обследования. Разрез1. Кол-во предметов залога
- поз 3, TEXT, id 477: COLLATERAL_INSPECTION.Name — Акт обследования. Разрез1. Наименование
- поз 4, DOUBLE, id 812: COLLATERAL_INSPECTION.CollateralItemEstimatedValue — Акт обследования. Разрез1. Оценочная стоимость
- поз 5, INTEGER, id 476: COLLATERAL_INSPECTION.InspectionCount — Акт обследования. Разрез1. Кол-во актов обследования

**Уровень группировки 2 (TABLE_GROUP2)** — 5 ячеек

- поз 1, INTEGER, id 478: COLLATERAL_INSPECTION.Count — Акт обследования. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 808: COLLATERAL_INSPECTION.PaymentCount — Акт обследования. Разрез2. Кол-во предметов залога
- поз 3, TEXT, id 480: COLLATERAL_INSPECTION.Name — Акт обследования. Разрез2. Наименование
- поз 4, DOUBLE, id 813: COLLATERAL_INSPECTION.CollateralItemEstimatedValue — Акт обследования. Разрез2. Оценочная стоимость
- поз 5, INTEGER, id 479: COLLATERAL_INSPECTION.InspectionCount — Акт обследования. Разрез2. Кол-во актов обследования

**Уровень группировки 3 (TABLE_GROUP3)** — 5 ячеек

- поз 1, INTEGER, id 481: COLLATERAL_INSPECTION.Count — Акт обследования. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 809: COLLATERAL_INSPECTION.PaymentCount — Акт обследования. Разрез3. Кол-во предметов залога
- поз 3, TEXT, id 483: COLLATERAL_INSPECTION.Name — Акт обследования. Разрез3. Наименование
- поз 4, DOUBLE, id 814: COLLATERAL_INSPECTION.CollateralItemEstimatedValue — Акт обследования. Разрез3. Оценочная стоимость
- поз 5, INTEGER, id 482: COLLATERAL_INSPECTION.InspectionCount — Акт обследования. Разрез3. Кол-во актов обследования

**Уровень группировки 4 (TABLE_GROUP4)** — 5 ячеек

- поз 1, INTEGER, id 484: COLLATERAL_INSPECTION.Count — Акт обследования. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 810: COLLATERAL_INSPECTION.PaymentCount — Акт обследования. Разрез4. Кол-во предметов залога
- поз 3, TEXT, id 486: COLLATERAL_INSPECTION.Name — Акт обследования. Разрез4. Наименование
- поз 4, DOUBLE, id 815: COLLATERAL_ITEM.CollateralItemEstimatedValue — Акт обследования. Разрез4. Оценочная стоимость
- поз 5, INTEGER, id 485: COLLATERAL_INSPECTION.InspectionCount — Акт обследования. Разрез4. Кол-во актов обследования

**Уровень группировки 5 (TABLE_GROUP5)** — 4 ячеек

- поз 1, INTEGER, id 487: COLLATERAL_INSPECTION.Count — Акт обследования. Разрез5. Кол-во заемщиков
- поз 3, TEXT, id 489: COLLATERAL_INSPECTION.Name — Акт обследования. Разрез5. Наименование
- поз 4, DOUBLE, id 816: COLLATERAL_INSPECTION.CollateralItemEstimatedValue — Акт обследования. Разрез5. Оценочная стоимость
- поз 5, INTEGER, id 488: COLLATERAL_INSPECTION.InspectionCount — Акт обследования. Разрез5. Кол-во актов обследования

**Уровень группировки 6 (TABLE_GROUP6)** — 3 ячеек

- поз 6, DATE, id 490: COLLATERAL_INSPECTION.CollateralInspectionOnDate — Акт обследования. Разрез6. Дата обследования
- поз 7, TEXT, id 491: COLLATERAL_INSPECTION.CollateralInspectionResultTypeId — Акт обследования. Разрез6. Результат обследования
- поз 8, TEXT, id 492: COLLATERAL_INSPECTION.CollateralInspectionDetails — Акт обследования. Разрез6. Примечание

**Итоговая строка (TABLE_SUM)** — 5 ячеек

- поз 1, INTEGER, id 472: COLLATERAL_INSPECTION.Count — Акт обследования. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 806: COLLATERAL_INSPECTION.PaymentCount — Акт обследования. Итого. Кол-во предметов залога
- поз 3, TEXT, id 474: «ИТОГО» — Акт обследования. Итого. Итого
- поз 4, DOUBLE, id 811: COLLATERAL_INSPECTION.CollateralItemEstimatedValue — Акт обследования. итого. Оценочная стоимость
- поз 5, INTEGER, id 473: COLLATERAL_INSPECTION.InspectionCount — Акт обследования. Итого. Кол-во актов обследования

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Заемщик, Договор залога, Предмет залога, Вид залога, Акт обследования, Результат обследования.

Шаблон отчёта 7 «Отчет по актам обследования»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Договор залога; 5:Предмет залога; 6:Акт обследования.

### Отчёт 8. Отчет по снятию с ареста (`COLLATERAL_ARREST_FREE`)

Ячеек: 31.

**Заголовок страницы** — 3 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по снятию с ареста»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 7 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во сн.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–6, стр 5–5, TEXT: «Снятие с ареста»
- кол 4–4, стр 6–6, TEXT: «Дата»
- кол 5–5, стр 6–6, TEXT: «Снято»
- кол 6–6, стр 6–6, TEXT: «Примечание»

**Уровень группировки 1 (TABLE_GROUP1)** — 3 ячеек

- поз 1, INTEGER, id 507: COLLATERAL_ARREST_FREE.Count — Снятие с ареста. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 508: COLLATERAL_ARREST_FREE.ArrestFreeCount — Снятие с ареста. Разрез1. Кол-во снятий с ареста
- поз 3, TEXT, id 509: COLLATERAL_ARREST_FREE.Name — Снятие с ареста. Разрез1. Наименование

**Уровень группировки 2 (TABLE_GROUP2)** — 3 ячеек

- поз 1, INTEGER, id 510: COLLATERAL_ARREST_FREE.Count — Снятие с ареста. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 511: COLLATERAL_ARREST_FREE.ArrestFreeCount — Снятие с ареста. Разрез2. Кол-во снятий с ареста
- поз 3, TEXT, id 512: COLLATERAL_ARREST_FREE.Name — Снятие с ареста. Разрез2. Наименование

**Уровень группировки 3 (TABLE_GROUP3)** — 3 ячеек

- поз 1, INTEGER, id 513: COLLATERAL_ARREST_FREE.Count — Снятие с ареста. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 514: COLLATERAL_ARREST_FREE.ArrestFreeCount — Снятие с ареста. Разрез3. Кол-во снятий с ареста
- поз 3, TEXT, id 515: COLLATERAL_ARREST_FREE.Name — Снятие с ареста. Разрез3. Наименование

**Уровень группировки 4 (TABLE_GROUP4)** — 3 ячеек

- поз 1, INTEGER, id 516: COLLATERAL_ARREST_FREE.Count — Снятие с ареста. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 517: COLLATERAL_ARREST_FREE.ArrestFreeCount — Снятие с ареста. Разрез4. Кол-во снятий с ареста
- поз 3, TEXT, id 518: COLLATERAL_ARREST_FREE.Name — Снятие с ареста. Разрез4. Наименование

**Уровень группировки 5 (TABLE_GROUP5)** — 3 ячеек

- поз 1, INTEGER, id 519: COLLATERAL_ARREST_FREE.Count — Снятие с ареста. Разрез5. Кол-во заемщиков
- поз 2, INTEGER, id 520: COLLATERAL_ARREST_FREE.ArrestFreeCount — Снятие с ареста. Разрез5. Кол-во снятий с ареста
- поз 3, TEXT, id 521: COLLATERAL_ARREST_FREE.Name — Снятие с ареста. Разрез5. Наименование

**Уровень группировки 6 (TABLE_GROUP6)** — 3 ячеек

- поз 4, DATE, id 522: COLLATERAL_ARREST_FREE.CollateralArrestFreeOnDate — Снятие с ареста. Разрез6. Дата снятия
- поз 5, TEXT, id 523: COLLATERAL_ARREST_FREE.CollateralArrestFreeBy — Снятие с ареста. Разрез6. Снято
- поз 6, TEXT, id 524: COLLATERAL_ARREST_FREE.CollateralArrestFreeDetails — Снятие с ареста. Разрез6. Примечание

**Итоговая строка (TABLE_SUM)** — 3 ячеек

- поз 1, INTEGER, id 504: COLLATERAL_ARREST_FREE.Count — Снятие с ареста. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 505: COLLATERAL_ARREST_FREE.ArrestFreeCount — Снятие с ареста. Итого. Кол-во снятий с ареста
- поз 3, TEXT, id 506: «ИТОГО» — Снятие с ареста. Итого. Итого

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Заемщик, Договор залога, Предмет залога, Снятие с ареста.

Шаблон отчёта 8 «Отчет по снятию с ареста»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Договор залога; 5:Предмет залога; 6:Снятие с ареста.

### Отчёт 9. Отчет по плану (`LOAN_PLAN`)

Ячеек: 164.

**Заголовок страницы** — 2 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по планоым показателям»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 31 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во пл.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–9, стр 5–5, TEXT: «План»
- кол 4–4, стр 6–6, TEXT: «Дата»
- кол 5–5, стр 6–6, TEXT: «Всего»
- кол 6–6, стр 6–6, TEXT: «Осн.с.»
- кол 7–7, стр 6–6, TEXT: «Проценты»
- кол 8–8, стр 6–6, TEXT: «Штрафы»
- кол 9–9, стр 6–6, TEXT: «Примечание»
- кол 10–10, стр 5–6, TEXT: «Всего за год»
- кол 11–11, стр 5–6, TEXT: «1. квартал»
- кол 12–14, стр 5–5, TEXT: «в том числе»
- кол 12–12, стр 6–6, TEXT: «Январь»
- кол 13–13, стр 6–6, TEXT: «Февраль»
- кол 14–14, стр 6–6, TEXT: «Март»
- кол 15–15, стр 5–6, TEXT: «2. квартал»
- кол 16–18, стр 5–5, TEXT: «в том числе»
- кол 16–16, стр 6–6, TEXT: «Апрель»
- кол 17–17, стр 6–6, TEXT: «Май»
- кол 18–18, стр 6–6, TEXT: «Июнь»
- кол 19–19, стр 5–6, TEXT: «3. квартал»
- кол 20–22, стр 5–5, TEXT: «в том числе»
- кол 20–20, стр 6–6, TEXT: «Июль»
- кол 21–21, стр 6–6, TEXT: «Август»
- кол 22–22, стр 6–6, TEXT: «Сентябрь»
- кол 23–23, стр 5–6, TEXT: «4. квартал»
- кол 24–26, стр 5–5, TEXT: «в том числе»
- кол 24–24, стр 6–6, TEXT: «Октябрь»
- кол 25–25, стр 6–6, TEXT: «Ноябрь»
- кол 26–26, стр 6–6, TEXT: «Декабрь»

**Уровень группировки 1 (TABLE_GROUP1)** — 24 ячеек

- поз 1, INTEGER, id 546: LOAN_PLAN.Count — План. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 547: LOAN_PLAN.sp_Count — План. Разрез1. Кол-во снятий с ареста
- поз 3, TEXT, id 548: LOAN_PLAN.name — План. Разрез1. Наименование
- поз 5, DOUBLE, id 549: LOAN_PLAN.sp_amount — План. Разрез1. Всего план
- поз 6, DOUBLE, id 550: LOAN_PLAN.sp_principal — План. Разрез1. По осн.с.
- поз 7, DOUBLE, id 551: LOAN_PLAN.sp_interest — План. Разрез1. По процентам
- поз 8, DOUBLE, id 552: LOAN_PLAN.sp_penalty — План. Разрез1. по штрафам
- поз 10, DOUBLE, id 834: LOAN_PLAN.sp_year — План. Разрез1. Всего за год
- поз 11, DOUBLE, id 835: LOAN_PLAN.sp_quarter1 — План. Разрез1. Всего за 1.квартал
- поз 12, DOUBLE, id 839: LOAN_PLAN.sp_month1 — План. Разрез1. Всего за 1.месяц
- поз 13, DOUBLE, id 840: LOAN_PLAN.sp_month2 — План. Разрез1. Всего за 2.месяц
- поз 14, DOUBLE, id 841: LOAN_PLAN.sp_month3 — План. Разрез1. Всего за 3.месяц
- поз 15, DOUBLE, id 836: LOAN_PLAN.sp_quarter2 — План. Разрез1. Всего за 2.квартал
- поз 16, DOUBLE, id 842: LOAN_PLAN.sp_month4 — План. Разрез1. Всего за 4.месяц
- поз 17, DOUBLE, id 843: LOAN_PLAN.sp_month5 — План. Разрез1. Всего за 5.месяц
- поз 18, DOUBLE, id 844: LOAN_PLAN.sp_month6 — План. Разрез1. Всего за 6.месяц
- поз 19, DOUBLE, id 837: LOAN_PLAN.sp_quarter3 — План. Разрез1. Всего за 3.квартал
- поз 20, DOUBLE, id 845: LOAN_PLAN.sp_month7 — План. Разрез1. Всего за 7.месяц
- поз 21, DOUBLE, id 846: LOAN_PLAN.sp_month8 — План. Разрез1. Всего за 8.месяц
- поз 22, DOUBLE, id 847: LOAN_PLAN.sp_month9 — План. Разрез1. Всего за 91.месяц
- поз 23, DOUBLE, id 838: LOAN_PLAN.sp_quarter4 — План. Разрез1. Всего за 4.квартал
- поз 24, DOUBLE, id 848: LOAN_PLAN.sp_month10 — План. Разрез1. Всего за 10.месяц
- поз 25, DOUBLE, id 849: LOAN_PLAN.sp_month11 — План. Разрез1. Всего за 11.месяц
- поз 26, DOUBLE, id 850: LOAN_PLAN.sp_month12 — План. Разрез1. Всего за 12.месяц

**Уровень группировки 2 (TABLE_GROUP2)** — 24 ячеек

- поз 1, INTEGER, id 553: LOAN_PLAN.Count — План. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 554: LOAN_PLAN.sp_Count — План. Разрез2. Кол-во снятий с ареста
- поз 3, TEXT, id 555: LOAN_PLAN.name — План. Разрез2. Наименование
- поз 5, DOUBLE, id 556: LOAN_PLAN.sp_amount — План. Разрез2. Всего план
- поз 6, DOUBLE, id 557: LOAN_PLAN.sp_principal — План. Разрез2. По осн.с.
- поз 7, DOUBLE, id 558: LOAN_PLAN.sp_interest — План. Разрез2. По процентам
- поз 8, DOUBLE, id 559: LOAN_PLAN.sp_penalty — План. Разрез2. по штрафам
- поз 10, DOUBLE, id 851: LOAN_PLAN.sp_year — План. Разрез2. Всего за год
- поз 11, DOUBLE, id 852: LOAN_PLAN.sp_quarter1 — План. Разрез2. Всего за 1.квартал
- поз 12, DOUBLE, id 856: LOAN_PLAN.sp_month1 — План. Разрез2. Всего за 1.месяц
- поз 13, DOUBLE, id 857: LOAN_PLAN.sp_month2 — План. Разрез2. Всего за 2.месяц
- поз 14, DOUBLE, id 858: LOAN_PLAN.sp_month3 — План. Разрез2. Всего за 3.месяц
- поз 15, DOUBLE, id 853: LOAN_PLAN.sp_quarter2 — План. Разрез2. Всего за 2.квартал
- поз 16, DOUBLE, id 859: LOAN_PLAN.sp_month4 — План. Разрез2. Всего за 4.месяц
- поз 17, DOUBLE, id 860: LOAN_PLAN.sp_month5 — План. Разрез2. Всего за 5.месяц
- поз 18, DOUBLE, id 861: LOAN_PLAN.sp_month6 — План. Разрез2. Всего за 6.месяц
- поз 19, DOUBLE, id 854: LOAN_PLAN.sp_quarter3 — План. Разрез2. Всего за 3.квартал
- поз 20, DOUBLE, id 862: LOAN_PLAN.sp_month7 — План. Разрез2. Всего за 7.месяц
- поз 21, DOUBLE, id 863: LOAN_PLAN.sp_month8 — План. Разрез2. Всего за 8.месяц
- поз 22, DOUBLE, id 864: LOAN_PLAN.sp_month9 — План. Разрез2. Всего за 9.месяц
- поз 23, DOUBLE, id 855: LOAN_PLAN.sp_quarter4 — План. Разрез2. Всего за 4.квартал
- поз 24, DOUBLE, id 865: LOAN_PLAN.sp_month10 — План. Разрез2. Всего за 10.месяц
- поз 25, DOUBLE, id 866: LOAN_PLAN.sp_month11 — План. Разрез2. Всего за 11.месяц
- поз 26, DOUBLE, id 867: LOAN_PLAN.sp_month12 — План. Разрез2. Всего за 12.месяц

**Уровень группировки 3 (TABLE_GROUP3)** — 24 ячеек

- поз 1, INTEGER, id 560: LOAN_PLAN.Count — План. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 561: LOAN_PLAN.sp_Count — План. Разрез3. Кол-во снятий с ареста
- поз 3, TEXT, id 562: LOAN_PLAN.name — План. Разрез3. Наименование
- поз 5, DOUBLE, id 563: LOAN_PLAN.sp_amount — План. Разрез3. Всего план
- поз 6, DOUBLE, id 564: LOAN_PLAN.sp_principal — План. Разрез3. По осн.с.
- поз 7, DOUBLE, id 565: LOAN_PLAN.sp_interest — План. Разрез3. По процентам
- поз 8, DOUBLE, id 566: LOAN_PLAN.sp_penalty — План. Разрез3. по штрафам
- поз 10, DOUBLE, id 868: LOAN_PLAN.sp_year — План. Разрез3. Всего за год
- поз 11, DOUBLE, id 869: LOAN_PLAN.sp_quarter1 — План. Разрез3. Всего за 1.квартал
- поз 12, DOUBLE, id 873: LOAN_PLAN.sp_month1 — План. Разрез3. Всего за 1.месяц
- поз 13, DOUBLE, id 874: LOAN_PLAN.sp_month2 — План. Разрез3. Всего за 2.месяц
- поз 14, DOUBLE, id 875: LOAN_PLAN.sp_month3 — План. Разрез3. Всего за 3.месяц
- поз 15, DOUBLE, id 870: LOAN_PLAN.sp_quarter2 — План. Разрез3. Всего за 2.квартал
- поз 16, DOUBLE, id 876: LOAN_PLAN.sp_month4 — План. Разрез3. Всего за 4.месяц
- поз 17, DOUBLE, id 877: LOAN_PLAN.sp_month5 — План. Разрез3. Всего за 5.месяц
- поз 18, DOUBLE, id 878: LOAN_PLAN.sp_month6 — План. Разрез3. Всего за 6.месяц
- поз 19, DOUBLE, id 871: LOAN_PLAN.sp_quarter3 — План. Разрез3. Всего за 3.квартал
- поз 20, DOUBLE, id 879: LOAN_PLAN.sp_month7 — План. Разрез3. Всего за 7.месяц
- поз 21, DOUBLE, id 880: LOAN_PLAN.sp_month8 — План. Разрез3. Всего за 8.месяц
- поз 22, DOUBLE, id 881: LOAN_PLAN.sp_month9 — План. Разрез3. Всего за 9.месяц
- поз 23, DOUBLE, id 872: LOAN_PLAN.sp_quarter4 — План. Разрез3. Всего за 4.квартал
- поз 24, DOUBLE, id 882: LOAN_PLAN.sp_month10 — План. Разрез3. Всего за 10.месяц
- поз 25, DOUBLE, id 883: LOAN_PLAN.sp_month11 — План. Разрез3. Всего за 11.месяц
- поз 26, DOUBLE, id 884: LOAN_PLAN.sp_month12 — План. Разрез3. Всего за 12.месяц

**Уровень группировки 4 (TABLE_GROUP4)** — 24 ячеек

- поз 1, INTEGER, id 567: LOAN_PLAN.Count — План. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 568: LOAN_PLAN.sp_Count — План. Разрез4. Кол-во снятий с ареста
- поз 3, TEXT, id 569: LOAN_PLAN.name — План. Разрез4. Наименование
- поз 5, DOUBLE, id 570: LOAN_PLAN.sp_amount — План. Разрез4. Всего план
- поз 6, DOUBLE, id 571: LOAN_PLAN.sp_principal — План. Разрез4. По осн.с.
- поз 7, DOUBLE, id 572: LOAN_PLAN.sp_interest — План. Разрез4. По процентам
- поз 8, DOUBLE, id 573: LOAN_PLAN.sp_penalty — План. Разрез4. по штрафам
- поз 10, DOUBLE, id 885: LOAN_PLAN.sp_year — План. Разрез4. Всего за год
- поз 11, DOUBLE, id 886: LOAN_PLAN.sp_quarter1 — План. Разрез4. Всего за 1.квартал
- поз 12, DOUBLE, id 890: LOAN_PLAN.sp_month1 — План. Разрез4. Всего за 1.месяц
- поз 13, DOUBLE, id 891: LOAN_PLAN.sp_month2 — План. Разрез4. Всего за 2.месяц
- поз 14, DOUBLE, id 892: LOAN_PLAN.sp_month3 — План. Разрез4. Всего за 3.месяц
- поз 15, DOUBLE, id 887: LOAN_PLAN.sp_quarter2 — План. Разрез4. Всего за 2.квартал
- поз 16, DOUBLE, id 893: LOAN_PLAN.sp_month4 — План. Разрез4. Всего за 4.месяц
- поз 17, DOUBLE, id 894: LOAN_PLAN.sp_month5 — План. Разрез4. Всего за 5.месяц
- поз 18, DOUBLE, id 895: LOAN_PLAN.sp_month6 — План. Разрез4. Всего за 6.месяц
- поз 19, DOUBLE, id 888: LOAN_PLAN.sp_quarter3 — План. Разрез4. Всего за 3.квартал
- поз 20, DOUBLE, id 896: LOAN_PLAN.sp_month7 — План. Разрез4. Всего за 7.месяц
- поз 21, DOUBLE, id 897: LOAN_PLAN.sp_month8 — План. Разрез4. Всего за 8.месяц
- поз 22, DOUBLE, id 898: LOAN_PLAN.sp_month9 — План. Разрез4. Всего за 9.месяц
- поз 23, DOUBLE, id 889: LOAN_PLAN.sp_quarter4 — План. Разрез4. Всего за 4.квартал
- поз 24, DOUBLE, id 899: LOAN_PLAN.sp_month10 — План. Разрез4. Всего за 10.месяц
- поз 25, DOUBLE, id 900: LOAN_PLAN.sp_month11 — План. Разрез4. Всего за 11.месяц
- поз 26, DOUBLE, id 901: LOAN_PLAN.sp_month12 — План. Разрез4. Всего за 12.месяц

**Уровень группировки 5 (TABLE_GROUP5)** — 9 ячеек

- поз 1, INTEGER, id 574: LOAN_PLAN.Count — План. Разрез5. Кол-во заемщиков
- поз 2, INTEGER, id 575: LOAN_PLAN.sp_Count — План. Разрез5. Кол-во снятий с ареста
- поз 3, TEXT, id 576: LOAN_PLAN.name — План. Разрез5. Наименование
- поз 4, DATE, id 581: LOAN_PLAN.sp_date — План. Разрез5. Дата
- поз 5, DOUBLE, id 577: LOAN_PLAN.sp_amount — План. Разрез5. Всего план
- поз 6, DOUBLE, id 578: LOAN_PLAN.sp_principal — План. Разрез5. По осн.с.
- поз 7, DOUBLE, id 579: LOAN_PLAN.sp_interest — План. Разрез5. По процентам
- поз 8, DOUBLE, id 580: LOAN_PLAN.sp_penalty — План. Разрез5. по штрафам
- поз 9, TEXT, id 582: LOAN_PLAN.sp_description — План. Разрез5. Примечание

**Итоговая строка (TABLE_SUM)** — 26 ячеек

- поз 1, INTEGER, id 537: LOAN_PLAN.Count — План. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 538: LOAN_PLAN.sp_Count — План. Итого. Кол-во снятий с ареста
- поз 3, TEXT, id 539: «ИТОГО» — План. Итого. Итого
- поз 4, DATE, id 540: LOAN_PLAN.sp_date — План. Итого. Дата
- поз 5, DOUBLE, id 541: LOAN_PLAN.sp_amount — План. Итого. Всего план
- поз 6, DOUBLE, id 542: LOAN_PLAN.sp_principal — План. Итого. По осн.с.
- поз 7, DOUBLE, id 543: LOAN_PLAN.sp_interest — План. Итого. По процентам
- поз 8, DOUBLE, id 544: LOAN_PLAN.sp_penalty — План. Итого. по штрафам
- поз 9, TEXT, id 545: LOAN_PLAN.sp_description — План. Итого. Примечание
- поз 10, DOUBLE, id 817: LOAN_PLAN.sp_year — План. Итого. Всего за год
- поз 11, DOUBLE, id 818: LOAN_PLAN.sp_quarter1 — План. Итого. Всего за 1.квартал
- поз 12, DOUBLE, id 822: LOAN_PLAN.sp_month1 — План. Итого. Всего за 1.месяц
- поз 13, DOUBLE, id 823: LOAN_PLAN.sp_month2 — План. Итого. Всего за 2.месяц
- поз 14, DOUBLE, id 824: LOAN_PLAN.sp_month3 — План. Итого. Всего за 3.месяц
- поз 15, DOUBLE, id 819: LOAN_PLAN.sp_quarter2 — План. Итого. Всего за 2.квартал
- поз 16, DOUBLE, id 825: LOAN_PLAN.sp_month4 — План. Итого. Всего за 4.месяц
- поз 17, DOUBLE, id 826: LOAN_PLAN.sp_month5 — План. Итого. Всего за 5.месяц
- поз 18, DOUBLE, id 827: LOAN_PLAN.sp_month6 — План. Итого. Всего за 6.месяц
- поз 19, DOUBLE, id 820: LOAN_PLAN.sp_quarter3 — План. Итого. Всего за 3.квартал
- поз 20, DOUBLE, id 828: LOAN_PLAN.sp_month7 — План. Итого. Всего за 7.месяц
- поз 21, DOUBLE, id 829: LOAN_PLAN.sp_month8 — План. Итого. Всего за 8.месяц
- поз 22, DOUBLE, id 830: LOAN_PLAN.sp_month9 — План. Итого. Всего за 9.месяц
- поз 23, DOUBLE, id 821: LOAN_PLAN.sp_quarter4 — План. Итого. Всего за 4.квартал
- поз 24, DOUBLE, id 831: LOAN_PLAN.sp_month10 — План. Итого. Всего за 10.месяц
- поз 25, DOUBLE, id 832: LOAN_PLAN.sp_month11 — План. Итого. Всего за 11.месяц
- поз 26, DOUBLE, id 833: LOAN_PLAN.sp_month12 — План. Итого. Всего за 12.месяц

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Заемщик, Кредит, План.

Шаблон отчёта 9 «Отчет по плану (шаблон)»: на дату 2019-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:План (скрыт); 6:— (скрыт).

Шаблон отчёта 14 «Отчет по плану за 2019 год»: на дату 2019-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:План; 6:—.

### Отчёт 10. Отчет по списанию (`LOAN_WRITE_OFF`)

Ячеек: 56.

**Заголовок страницы** — 2 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по списанию»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 10 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во сп.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–9, стр 5–5, TEXT: «Списание»
- кол 4–4, стр 6–6, TEXT: «Дата»
- кол 5–5, стр 6–6, TEXT: «Всего»
- кол 6–6, стр 6–6, TEXT: «Осн.с.»
- кол 7–7, стр 6–6, TEXT: «Проценты»
- кол 8–8, стр 6–6, TEXT: «Штрафы»
- кол 9–9, стр 6–6, TEXT: «Примечание»

**Уровень группировки 1 (TABLE_GROUP1)** — 7 ячеек

- поз 1, INTEGER, id 604: LOAN_WRITE_OFF.Count — Списание. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 605: LOAN_WRITE_OFF.writeOffCount — Списание. Разрез1. Кол-во списаний
- поз 3, TEXT, id 606: LOAN_WRITE_OFF.name — Списание. Разрез1. Наименование
- поз 5, DOUBLE, id 607: LOAN_WRITE_OFF.wo_totalAmount — Списание. Разрез1. Всего списано
- поз 6, DOUBLE, id 608: LOAN_WRITE_OFF.wo_principal — Списание. Разрез1. По осн.с.
- поз 7, DOUBLE, id 609: LOAN_WRITE_OFF.wo_interest — Списание. Разрез1. По процентам
- поз 8, DOUBLE, id 610: LOAN_WRITE_OFF.wo_penalty — Списание. Разрез1. по штрафам

**Уровень группировки 2 (TABLE_GROUP2)** — 7 ячеек

- поз 1, INTEGER, id 611: LOAN_WRITE_OFF.Count — Списание. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 612: LOAN_WRITE_OFF.writeOffCount — Списание. Разрез2. Кол-во списаний
- поз 3, TEXT, id 613: LOAN_WRITE_OFF.name — Списание. Разрез2. Наименование
- поз 5, DOUBLE, id 614: LOAN_WRITE_OFF.wo_totalAmount — Списание. Разрез2. Всего списано
- поз 6, DOUBLE, id 615: LOAN_WRITE_OFF.wo_principal — Списание. Разрез2. По осн.с.
- поз 7, DOUBLE, id 616: LOAN_WRITE_OFF.wo_interest — Списание. Разрез2. По процентам
- поз 8, DOUBLE, id 617: LOAN_WRITE_OFF.wo_penalty — Списание. Разрез2. по штрафам

**Уровень группировки 3 (TABLE_GROUP3)** — 7 ячеек

- поз 1, INTEGER, id 618: LOAN_WRITE_OFF.Count — Списание. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 619: LOAN_WRITE_OFF.writeOffCount — Списание. Разрез3. Кол-во списаний
- поз 3, TEXT, id 620: LOAN_WRITE_OFF.name — Списание. Разрез3. Наименование
- поз 5, DOUBLE, id 621: LOAN_WRITE_OFF.wo_totalAmount — Списание. Разрез3. Всего списано
- поз 6, DOUBLE, id 622: LOAN_WRITE_OFF.wo_principal — Списание. Разрез3. По осн.с.
- поз 7, DOUBLE, id 623: LOAN_WRITE_OFF.wo_interest — Списание. Разрез3. По процентам
- поз 8, DOUBLE, id 624: LOAN_WRITE_OFF.wo_penalty — Списание. Разрез3. по штрафам

**Уровень группировки 4 (TABLE_GROUP4)** — 7 ячеек

- поз 1, INTEGER, id 625: LOAN_WRITE_OFF.Count — Списание. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 626: LOAN_WRITE_OFF.writeOffCount — Списание. Разрез4. Кол-во списаний
- поз 3, TEXT, id 627: LOAN_WRITE_OFF.name — Списание. Разрез4. Наименование
- поз 5, DOUBLE, id 628: LOAN_WRITE_OFF.wo_totalAmount — Списание. Разрез4. Всего списано
- поз 6, DOUBLE, id 629: LOAN_WRITE_OFF.wo_principal — Списание. Разрез4. По осн.с.
- поз 7, DOUBLE, id 630: LOAN_WRITE_OFF.wo_interest — Списание. Разрез4. По процентам
- поз 8, DOUBLE, id 631: LOAN_WRITE_OFF.wo_penalty — Списание. Разрез4. по штрафам

**Уровень группировки 5 (TABLE_GROUP5)** — 9 ячеек

- поз 1, INTEGER, id 632: LOAN_WRITE_OFF.Count — Списание. Разрез5. Кол-во заемщиков
- поз 2, INTEGER, id 633: LOAN_WRITE_OFF.writeOffCount — Списание. Разрез5. Кол-во списаний
- поз 3, TEXT, id 634: LOAN_WRITE_OFF.name — Списание. Разрез5. Наименование
- поз 4, DATE, id 639: LOAN_WRITE_OFF.wo_date — Списание. Разрез5. Дата
- поз 5, DOUBLE, id 635: LOAN_WRITE_OFF.wo_totalAmount — Списание. Разрез5. Всего списано
- поз 6, DOUBLE, id 636: LOAN_WRITE_OFF.wo_principal — Списание. Разрез5. По осн.с.
- поз 7, DOUBLE, id 637: LOAN_WRITE_OFF.wo_interest — Списание. Разрез5. По процентам
- поз 8, DOUBLE, id 638: LOAN_WRITE_OFF.wo_penalty — Списание. Разрез5. по штрафам
- поз 9, TEXT, id 640: LOAN_WRITE_OFF.wo_description — Списание. Разрез5. Примечание

**Итоговая строка (TABLE_SUM)** — 7 ячеек

- поз 1, INTEGER, id 595: LOAN_WRITE_OFF.Count — Списание. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 596: LOAN_WRITE_OFF.writeOffCount — Списание. Итого. Кол-во списаний
- поз 3, TEXT, id 597: «ИТОГО» — Списание. Итого. Итого
- поз 5, DOUBLE, id 599: LOAN_WRITE_OFF.wo_totalAmount — Списание. Итого. Всего списано
- поз 6, DOUBLE, id 600: LOAN_WRITE_OFF.wo_principal — Списание. Итого. По осн.с.
- поз 7, DOUBLE, id 601: LOAN_WRITE_OFF.wo_interest — Списание. Итого. По процентам
- поз 8, DOUBLE, id 602: LOAN_WRITE_OFF.wo_penalty — Списание. Итого. по штрафам

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Заемщик, Кредит, Списание.

Шаблон отчёта 10 «Отчет по списанию»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Списание; 6:— (скрыт).

### Отчёт 11. Отчет по переводу долга (`LOAN_DEBT_TRANSFER`)

Ячеек: 41.

**Заголовок страницы** — 2 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по переводу долга»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 10 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб-тов.»
- кол 2–2, стр 5–6, TEXT: «Кол-во п.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–8, стр 5–5, TEXT: «Перевод долга»
- кол 4–4, стр 6–6, TEXT: «Дата»
- кол 5–5, стр 6–6, TEXT: «Номер»
- кол 6–6, стр 6–6, TEXT: «Сумма»
- кол 7–7, стр 6–6, TEXT: «Цена»
- кол 8–8, стр 6–6, TEXT: «Кол-во»
- кол 9–9, стр 6–6, TEXT: «Вид товара»

**Уровень группировки 1 (TABLE_GROUP1)** — 4 ячеек

- поз 1, INTEGER, id 657: LOAN_DEBT_TRANSFER.Count — Перевод долга. Разрез1. Кол-во заемщиков
- поз 2, INTEGER, id 658: LOAN_DEBT_TRANSFER.dt_Count — Перевод долга. Разрез1. Кол-во списаний
- поз 3, TEXT, id 659: LOAN_DEBT_TRANSFER.name — Перевод долга. Разрез1. Наименование
- поз 6, DOUBLE, id 660: LOAN_DEBT_TRANSFER.dt_totalCost — Перевод долга. Разрез1. Сумма перевода долга

**Уровень группировки 2 (TABLE_GROUP2)** — 4 ячеек

- поз 1, INTEGER, id 661: LOAN_DEBT_TRANSFER.Count — Перевод долга. Разрез2. Кол-во заемщиков
- поз 2, INTEGER, id 662: LOAN_DEBT_TRANSFER.dt_Count — Перевод долга. Разрез2. Кол-во списаний
- поз 3, TEXT, id 663: LOAN_DEBT_TRANSFER.name — Перевод долга. Разрез2. Наименование
- поз 6, DOUBLE, id 664: LOAN_DEBT_TRANSFER.dt_totalCost — Перевод долга. Разрез2. Сумма перевода долга

**Уровень группировки 3 (TABLE_GROUP3)** — 4 ячеек

- поз 1, INTEGER, id 665: LOAN_DEBT_TRANSFER.Count — Перевод долга. Разрез3. Кол-во заемщиков
- поз 2, INTEGER, id 666: LOAN_DEBT_TRANSFER.dt_Count — Перевод долга. Разрез3. Кол-во списаний
- поз 3, TEXT, id 667: LOAN_DEBT_TRANSFER.name — Перевод долга. Разрез3. Наименование
- поз 6, DOUBLE, id 668: LOAN_DEBT_TRANSFER.dt_totalCost — Перевод долга. Разрез3. Сумма перевода долга

**Уровень группировки 4 (TABLE_GROUP4)** — 4 ячеек

- поз 1, INTEGER, id 669: LOAN_DEBT_TRANSFER.Count — Перевод долга. Разрез4. Кол-во заемщиков
- поз 2, INTEGER, id 670: LOAN_DEBT_TRANSFER.dt_Count — Перевод долга. Разрез4. Кол-во списаний
- поз 3, TEXT, id 671: LOAN_DEBT_TRANSFER.name — Перевод долга. Разрез4. Наименование
- поз 6, DOUBLE, id 672: LOAN_DEBT_TRANSFER.dt_totalCost — Перевод долга. Разрез4. Сумма перевода долга

**Уровень группировки 5 (TABLE_GROUP5)** — 9 ячеек

- поз 1, INTEGER, id 673: LOAN_DEBT_TRANSFER.Count — Перевод долга. Разрез5. Кол-во заемщиков
- поз 2, INTEGER, id 674: LOAN_DEBT_TRANSFER.dt_Count — Перевод долга. Разрез5. Кол-во списаний
- поз 3, TEXT, id 675: LOAN_DEBT_TRANSFER.name — Перевод долга. Разрез5. Наименование
- поз 4, DATE, id 676: LOAN_DEBT_TRANSFER.dt_date — Перевод долга. Разрез5. Дата
- поз 5, TEXT, id 677: LOAN_DEBT_TRANSFER.dt_number — Перевод долга. Разрез5. Номер
- поз 6, DOUBLE, id 678: LOAN_DEBT_TRANSFER.dt_totalCost — Перевод долга. Разрез5. Сумма перевода долга
- поз 7, DOUBLE, id 679: LOAN_DEBT_TRANSFER.dt_pricePerUnit — Перевод долга. Разрез5. Сумма перевода долга
- поз 8, DOUBLE, id 680: LOAN_DEBT_TRANSFER.dt_quantity — Перевод долга. Разрез5. Сумма перевода долга
- поз 9, TEXT, id 681: LOAN_DEBT_TRANSFER.dt_goodsTypeId — Перевод долга. Разрез5. Вид товара

**Итоговая строка (TABLE_SUM)** — 4 ячеек

- поз 1, INTEGER, id 653: LOAN_DEBT_TRANSFER.Count — Перевод долга. Итого. Кол-во заемщиков
- поз 2, INTEGER, id 654: LOAN_DEBT_TRANSFER.dt_Count — Перевод долга. Итого. Кол-во списаний
- поз 3, TEXT, id 655: «ИТОГО» — Перевод долга. Итого. Итого
- поз 6, DOUBLE, id 656: LOAN_DEBT_TRANSFER.dt_totalCost — Перевод долга. Итого. Сумма перевода долга

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Заемщик, Кредит, Перевод долга.

Шаблон отчёта 11 «Отчет по переводу долга»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Перевод долга; 6:— (скрыт).

### Отчёт 12. Отчет по кадрам (`STAFF`)

Ячеек: 27.

**Заголовок страницы** — 2 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по сотрудникам»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 7 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во сот.»
- кол 2–2, стр 5–6, TEXT: «Кол-во соб.»
- кол 3–3, стр 5–6, TEXT: «Наименование»
- кол 4–6, стр 5–5, TEXT: «Событие сотрудника»
- кол 4–4, стр 6–6, TEXT: «Дата»
- кол 5–5, стр 6–6, TEXT: «Наименование»
- кол 6–6, стр 6–6, TEXT: «Вид»

**Уровень группировки 1 (TABLE_GROUP1)** — 3 ячеек

- поз 1, INTEGER, id 694: STAFF.Count — Событие сотрудника. Разрез1. Кол-во сотрудников
- поз 2, INTEGER, id 695: STAFF.staffEventCount — Событие сотрудника. Разрез1. Кол-во событий
- поз 3, TEXT, id 696: STAFF.name — Событие сотрудника. Разрез1. Наименование

**Уровень группировки 2 (TABLE_GROUP2)** — 3 ячеек

- поз 1, INTEGER, id 697: STAFF.Count — Событие сотрудника. Разрез2. Кол-во сотрудников
- поз 2, INTEGER, id 698: STAFF.staffEventCount — Событие сотрудника. Разрез2. Кол-во событий
- поз 3, TEXT, id 699: STAFF.name — Событие сотрудника. Разрез2. Наименование

**Уровень группировки 3 (TABLE_GROUP3)** — 3 ячеек

- поз 1, INTEGER, id 700: STAFF.Count — Событие сотрудника. Разрез3. Кол-во сотрудников
- поз 2, INTEGER, id 701: STAFF.staffEventCount — Событие сотрудника. Разрез3. Кол-во событий
- поз 3, TEXT, id 702: STAFF.name — Событие сотрудника. Разрез3. Наименование

**Уровень группировки 4 (TABLE_GROUP4)** — 6 ячеек

- поз 1, INTEGER, id 703: STAFF.Count — Событие сотрудника. Разрез4. Кол-во сотрудников
- поз 2, INTEGER, id 704: STAFF.staffEventCount — Событие сотрудника. Разрез4. Кол-во событий
- поз 3, TEXT, id 705: STAFF.name — Событие сотрудника. Разрез4. Наименование
- поз 4, DATE, id 706: STAFF.staffEventDate — Событие сотрудника. Разрез4. Дата
- поз 5, TEXT, id 707: STAFF.staffEventName — Событие сотрудника. Разрез4. Наименование
- поз 6, TEXT, id 708: STAFF.staffEventTypeID — Событие сотрудника. Разрез4. Вид события

**Итоговая строка (TABLE_SUM)** — 3 ячеек

- поз 1, INTEGER, id 691: STAFF.Count — Событие сотрудника. Итого. Кол-во сотрудников
- поз 2, INTEGER, id 692: STAFF.staffEventCount — Событие сотрудника. Итого. Кол-во событий
- поз 3, TEXT, id 693: «ИТОГО» — Событие сотрудника. Итого. Итого

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Сотрудник, Событие сотрудника, Вид события сотрудника, Должность сотрудника, Отдел сотрудника.

Шаблон отчёта 12 «Отчет по кадрам»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Отдел сотрудника; 2:Должность сотрудника; 3:Сотрудник; 4:Событие сотрудника; 5:— (скрыт); 6:— (скрыт).

### Отчёт 13. Отчет по документооброту (`DOCUMENT`)

Ячеек: 29.

**Заголовок страницы** — 2 ячеек

- кол 1–6, стр 1–1, TEXT: «Информация по документообороту»
- кол 1–6, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 10 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во док.»
- кол 2–2, стр 5–6, TEXT: «Наименование»
- кол 3–3, стр 5–6, TEXT: «От кого»
- кол 4–4, стр 5–6, TEXT: «Кому»
- кол 5–5, стр 5–6, TEXT: «Вх.№»
- кол 6–6, стр 5–6, TEXT: «Вх. дата»
- кол 7–7, стр 5–6, TEXT: «Исх.№»
- кол 8–8, стр 5–6, TEXT: «Исх. дата»
- кол 9–9, стр 5–6, TEXT: «Статус»
- кол 10–10, стр 5–6, TEXT: «Срок»

**Уровень группировки 1 (TABLE_GROUP1)** — 2 ячеек

- поз 1, INTEGER, id 720: DOCUMENT.DocumentCount — Документооборот. Разрез1. Кол-во документов
- поз 2, TEXT, id 721: DOCUMENT.name — Документооборот. Разрез1. Наименование

**Уровень группировки 2 (TABLE_GROUP2)** — 2 ячеек

- поз 1, INTEGER, id 722: DOCUMENT.DocumentCount — Документооборот. Разрез2. Кол-во документов
- поз 2, TEXT, id 723: DOCUMENT.name — Документооборот. Разрез2. Наименование

**Уровень группировки 3 (TABLE_GROUP3)** — 11 ячеек

- поз 1, INTEGER, id 729: DOCUMENT.DocumentCount — Документооборот. Разрез3. Кол-во документов
- поз 2, TEXT, id 730: DOCUMENT.name — Документооборот. Разрез3. Наименование
- поз 3, TEXT, id 731: DOCUMENT.DocumentSenderResponsibleName — Документооборот. Разрез3. От кого
- поз 4, TEXT, id 732: DOCUMENT.DocumentReceiverResponsibleName — Документооборот. Разрез3. Кому
- поз 5, TEXT, id 733: DOCUMENT.DocumentReceiverRegisteredNumber — Документооборот. Разрез3. Тема
- поз 5, TEXT, id 745: DOCUMENT.DocumentReceiverRegisteredNumber — Документооборот. Разрез3. Вх. номер
- поз 6, DATE, id 743: DOCUMENT.DocumentReceiverRegisteredDate — Документооборот. Разрез3. Вх. дата
- поз 7, TEXT, id 746: DOCUMENT.DocumentSenderRegisteredNumber — Документооборот. Разрез3. Исх. номер
- поз 8, DATE, id 744: DOCUMENT.DocumentSenderRegisteredDate — Документооборот. Разрез3. Исх. дата
- поз 9, TEXT, id 734: DOCUMENT.DocumentStateID — Документооборот. Разрез3. Статус документа
- поз 10, DATE, id 735: DOCUMENT.DocumentDueDate — Документооборот. Разрез3. Срок

**Итоговая строка (TABLE_SUM)** — 2 ячеек

- поз 1, INTEGER, id 718: DOCUMENT.DocumentCount — Документооборот. Итого. Кол-во документов
- поз 2, TEXT, id 719: «ИТОГО» — Документооборот. Итого. Итого

**Разрезы, предложенные отчёту (`report_group_type`)**: Вид документа, Тип документа, Статус документа, Документ.

Шаблон отчёта 13 «Отчет по документообороту»: на дату 2018-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Вид документа; 2:Тип документа; 3:Документ; 4:Статус документа (скрыт); 5:— (скрыт); 6:— (скрыт).

### Отчёт 14. Отчет ОИП (`COLLECTION_PHASE`)

Ячеек: 81.

**Заголовок страницы** — 2 ячеек

- кол 1–8, стр 1–1, TEXT: «Информация по взысканию»
- кол 1–8, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 20 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб.»
- кол 2–2, стр 5–6, TEXT: «Наименование»
- кол 3–6, стр 5–5, TEXT: «Стадия»
- кол 3–3, стр 6–6, TEXT: «Кол-во»
- кол 4–4, стр 6–6, TEXT: «Вид»
- кол 5–5, стр 6–6, TEXT: «Дата»
- кол 6–6, стр 6–6, TEXT: «Сумма.»
- кол 7–10, стр 5–5, TEXT: «Результат»
- кол 7–7, стр 6–6, TEXT: «Кол-во»
- кол 8–8, стр 6–6, TEXT: «Вид»
- кол 9–9, стр 6–6, TEXT: «Дата.»
- кол 10–10, стр 6–6, TEXT: «Сумма»
- кол 11–11, стр 5–6, TEXT: «Статус»
- кол 12–12, стр 5–6, TEXT: «Всего погашено»
- кол 13–13, стр 5–6, TEXT: «Всего остаток»
- кол 14–14, стр 5–6, TEXT: «Примечание»
- кол 15–15, стр 5–6, TEXT: «Вид ИЛ»
- кол 16–16, стр 5–6, TEXT: «Индекс ИЛ»
- кол 17–17, стр 5–6, TEXT: «Индекс2 ИЛ»
- кол 18–18, стр 5–6, TEXT: «dynamic»

**Уровень группировки 1 (TABLE_GROUP1)** — 9 ячеек

- поз 1, INTEGER, id 121: COLLECTION_PHASE.count — Взыскание. Разрез 1. Кол-во субъектов
- поз 2, TEXT, id 122: COLLECTION_PHASE.name — Взыскание. Разрез 1. Наименование
- поз 3, TEXT, id 140: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 1. Кол-во стадии
- поз 6, DOUBLE, id 154: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 1. Сумма стадии.
- поз 7, TEXT, id 141: COLLECTION_PHASE.resultCount — Взыскание. Разрез 1. Кол-во результатов
- поз 10, DOUBLE, id 155: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 1. Сумма результата
- поз 12, DOUBLE, id 758: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 1. Всего погашено.
- поз 13, DOUBLE, id 754: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 1. Всего остаток по ИЛ
- поз 18, DOUBLE, id 774: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 1. Погашение в период.

**Уровень группировки 2 (TABLE_GROUP2)** — 9 ячеек

- поз 1, INTEGER, id 123: COLLECTION_PHASE.count — Взыскание. Разрез 2. Кол-во субъектов
- поз 2, TEXT, id 124: COLLECTION_PHASE.name — Взыскание. Разрез 2. Наименование
- поз 3, TEXT, id 142: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 2. Кол-во стадии
- поз 6, DOUBLE, id 152: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 2. Сумма стадии.
- поз 7, TEXT, id 143: COLLECTION_PHASE.resultCount — Взыскание. Разрез 2. Кол-во результатов
- поз 10, DOUBLE, id 153: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 2. Сумма результата
- поз 12, DOUBLE, id 757: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 2. Всего погашено.
- поз 13, DOUBLE, id 753: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 2. Всего остаток по ИЛ
- поз 18, DOUBLE, id 773: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 2. Погашение в период.

**Уровень группировки 3 (TABLE_GROUP3)** — 9 ячеек

- поз 1, INTEGER, id 125: COLLECTION_PHASE.count — Взыскание. Разрез 3. Кол-во субъектов
- поз 2, TEXT, id 126: COLLECTION_PHASE.name — Взыскание. Разрез 3. Наименование
- поз 3, TEXT, id 144: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 3. Кол-во стадии
- поз 6, DOUBLE, id 150: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 3. Сумма стадии.
- поз 7, TEXT, id 145: COLLECTION_PHASE.resultCount — Взыскание. Разрез 3. Кол-во результатов
- поз 10, DOUBLE, id 151: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 3. Сумма результата
- поз 12, DOUBLE, id 756: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 3. Всего погашено.
- поз 13, DOUBLE, id 752: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 3. Всего остаток по ИЛ
- поз 18, DOUBLE, id 772: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 3. Погашение в период.

**Уровень группировки 4 (TABLE_GROUP4)** — 9 ячеек

- поз 1, INTEGER, id 127: COLLECTION_PHASE.count — Взыскание. Разрез 4. Кол-во субъектов.
- поз 2, TEXT, id 128: ENTITY_DOCUMENT.name — Взыскание. Разрез 4. Наименование.
- поз 3, TEXT, id 146: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 4. Кол-во стадии
- поз 6, DOUBLE, id 148: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 4. Сумма стадии.
- поз 7, TEXT, id 147: COLLECTION_PHASE.resultCount — Взыскание. Разрез 4. Кол-во результатов
- поз 10, DOUBLE, id 149: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 4. Сумма результата
- поз 12, DOUBLE, id 755: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 4. Всего погашено.
- поз 13, DOUBLE, id 751: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 4. Всего остаток по ИЛ
- поз 18, DOUBLE, id 771: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 4. Погашение в период.

**Уровень группировки 5 (TABLE_GROUP5)** — 14 ячеек

- поз 4, TEXT, id 129: COLLECTION_PHASE.collection_phase_type_id — Взыскание. Разрез 5. Вид стадии
- поз 5, DATE, id 130: COLLECTION_PHASE.collection_phase_start_date — Взыскание. Разрез 5. Дата стадии
- поз 6, DOUBLE, id 131: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 5. Сумма стадии.
- поз 8, TEXT, id 132: COLLECTION_PHASE.collection_phase_status_id — Взыскание. Разрез 5. Вид результата.
- поз 9, DATE, id 133: COLLECTION_PHASE.collection_phase_close_date — Взыскание. Разрез 5. Дата результата.
- поз 10, DOUBLE, id 134: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 5. Сумма результата
- поз 11, TEXT, id 135: COLLECTION_PHASE.collection_procedure_status_id — Взыскание. Разрез 5. Статус
- поз 12, DOUBLE, id 747: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 5. Всего погашено.
- поз 13, DOUBLE, id 748: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 5. Всего остаток по ИЛ
- поз 14, TEXT, id 761: COLLECTION_PHASE.collection_phase_description — Отчет ОИП. Разрез 5. Примечание
- поз 15, TEXT, id 763: COLLECTION_PHASE.collection_phase_group_id — Отчет ОИП. Разрез 5. Вид ИЛ.
- поз 16, TEXT, id 764: COLLECTION_PHASE.collection_phase_index_id — Отчет ОИП. Разрез 5. Индекс ИЛ.
- поз 17, TEXT, id 765: COLLECTION_PHASE.collection_phase_sub_index_id — Отчет ОИП. Разрез 5. Индекс2 ИЛ.
- поз 18, DOUBLE, id 770: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 5. Погашение в период.

**Итоговая строка (TABLE_SUM)** — 9 ячеек

- поз 1, INTEGER, id 119: COLLECTION_PHASE.count — Взыскание. Итого. Кол-во суб.
- поз 2, TEXT, id 120: «ИТОГО» — Взыскание. Итого. Итого.
- поз 3, TEXT, id 138: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 5. Кол-во стадии
- поз 6, DOUBLE, id 156: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Итого. Сумма стадии.
- поз 7, INTEGER, id 139: COLLECTION_PHASE.resultCount — Взыскание. Разрез 5. Кол-во результатов
- поз 10, DOUBLE, id 157: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Итого. Сумма результата
- поз 12, DOUBLE, id 759: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Итого. Всего погашено.
- поз 13, DOUBLE, id 760: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Итого. Всего остаток по ИЛ
- поз 18, DOUBLE, id 775: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. ИТОГО. Погашение в период.

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Заемщик, Процедура взыскания, Фаза взыскания, Вид стадии, Вид результата, Статус процедуры, Группа заемщика, Подгруппа заемщика.

Шаблон отчёта 15 «Общий отчет ОИП»: на дату 2019-01-01, доп. дата None, в тысячах None; разрезы по умолчанию — 1:Область; 2:Район; 3:Заемщик; 4:Процедура взыскания (скрыт); 5:Фаза взыскания; 6:— (скрыт).

### Отчёт 15. Отчет по субсидиям (`SUBSIDY_PAYMENT`)

Ячеек: 29.

**Заголовок страницы** — 1 ячеек

- кол 1–8, стр 1–1, TEXT: «Информация по перечисленным субсидиям»

**Шапка таблицы** — 8 ячеек

- кол 1–1, стр 3–4, TEXT: «Кол-во пол.»
- кол 2–2, стр 3–4, TEXT: «Наименование»
- кол 3–3, стр 3–4, TEXT: «Дата выплаты»
- кол 4–4, стр 3–4, TEXT: «Номер плат.док.»
- кол 5–5, стр 3–4, TEXT: «Сумма субсидий»
- кол 6–6, стр 3–4, TEXT: «Примечание»
- кол 7–7, стр 3–4, TEXT: «Рег.номер акта сверки на 01.07.2022г.»
- кол 8–8, стр 3–4, TEXT: «Рег.номер акта сверки на 01.10.2022г.»

**Уровень группировки 1 (TABLE_GROUP1)** — 3 ячеек

- поз 1, INTEGER, id 936: SUBSIDY_PAYMENT.Count — Субсидия. Разрез1. Кол-во субъектов
- поз 2, TEXT, id 938: SUBSIDY_PAYMENT.Name — Субсидия. Разрез1. Наименование
- поз 5, DOUBLE, id 941: SUBSIDY_PAYMENT.SubsidyAmount — Субсидия. Разрез1. Сумма субсидии

**Уровень группировки 2 (TABLE_GROUP2)** — 3 ячеек

- поз 1, INTEGER, id 937: SUBSIDY_PAYMENT.Count — Субсидия. Разрез2. Кол-во субъектов
- поз 2, TEXT, id 939: SUBSIDY_PAYMENT.Name — Субсидия. Разрез2. Наименование
- поз 5, DOUBLE, id 942: SUBSIDY_PAYMENT.SubsidyAmount — Субсидия. Разрез2. Сумма субсидии

**Уровень группировки 3 (TABLE_GROUP3)** — 2 ячеек

- поз 2, TEXT, id 940: SUBSIDY_PAYMENT.Name — Субсидия. Разрез3. Наименование
- поз 5, DOUBLE, id 943: SUBSIDY_PAYMENT.SubsidyAmount — Субсидия. Разрез3. Сумма субсидии

**Уровень группировки 4 (TABLE_GROUP4)** — 7 ячеек

- поз 2, TEXT, id 952: SUBSIDY_PAYMENT.Name — Субсидия. Разрез4. Наименование
- поз 3, DATE, id 946: SUBSIDY_PAYMENT.SubsidyDate — Субсидия. Разрез4. Дата выплаты
- поз 4, TEXT, id 947: SUBSIDY_PAYMENT.SubsidyNumber — Субсидия. Разрез4. Номер выплаты
- поз 5, DOUBLE, id 944: SUBSIDY_PAYMENT.SubsidyAmount — Субсидия. Разрез4. Сумма субсидии
- поз 6, TEXT, id 948: SUBSIDY_PAYMENT.SubsidyDescription — Субсидия. Разрез4. Примечание субсидии
- поз 7, TEXT, id 949: SUBSIDY_PAYMENT.RecipientDescription — Субсидия. Разрез4. Акт сверки
- поз 8, TEXT, id 950: SUBSIDY_PAYMENT.RecipientDescriptionLast — Субсидия. Разрез4. Акт сверки - последний

**Уровень группировки 5 (TABLE_GROUP5)** — 2 ячеек

- поз 5, DOUBLE, id 945: SUBSIDY_PAYMENT.PaymentAmount — Субсидия. Разрез5. Сумма субсидии
- поз 6, TEXT, id 951: SUBSIDY_PAYMENT.PaymentDescription — Субсидия. Разрез5. Примечание транша

**Итоговая строка (TABLE_SUM)** — 3 ячеек

- поз 1, INTEGER, id 933: SUBSIDY_PAYMENT.Count — Субсидия. Итого. Кол-во получателей
- поз 2, TEXT, id 934: «ИТОГО» — Субсидия. Итого. Итого
- поз 5, DOUBLE, id 935: SUBSIDY_PAYMENT.SubsidyAmount — Субсидия. Итого. Сумма субсидии

**Разрезы, предложенные отчёту (`report_group_type`)**: Субсидиар, Субсидия, Субсидия-платеж.

Шаблон отчёта 16 «Отчет по субсидиям»: на дату None, доп. дата None, в тысячах 1000; разрезы по умолчанию — 1:Субсидиар (скрыт); 2:Субсидиар (скрыт); 3:Субсидиар; 4:Субсидия; 5:Субсидия-платеж (скрыт); 6:— (скрыт).

### Отчёт 16. Отчет ОИП копия  (`COLLECTION_PHASE`)

Ячеек: 81.

**Заголовок страницы** — 2 ячеек

- кол 1–8, стр 1–1, TEXT: «Информация по взысканию»
- кол 1–8, стр 2–2, TEXT: «по состоянию на (=onDate=)»

**Шапка таблицы** — 20 ячеек

- кол 1–1, стр 5–6, TEXT: «Кол-во суб.»
- кол 2–2, стр 5–6, TEXT: «Наименование»
- кол 3–6, стр 5–5, TEXT: «Стадия»
- кол 3–3, стр 6–6, TEXT: «Кол-во»
- кол 4–4, стр 6–6, TEXT: «Вид»
- кол 5–5, стр 6–6, TEXT: «Дата»
- кол 6–6, стр 6–6, TEXT: «Сумма.»
- кол 7–10, стр 5–5, TEXT: «Результат»
- кол 7–7, стр 6–6, TEXT: «Кол-во»
- кол 8–8, стр 6–6, TEXT: «Вид»
- кол 9–9, стр 6–6, TEXT: «Дата.»
- кол 10–10, стр 6–6, TEXT: «Сумма»
- кол 11–11, стр 5–6, TEXT: «Статус»
- кол 12–12, стр 5–6, TEXT: «Всего погашено»
- кол 13–13, стр 5–6, TEXT: «Всего остаток»
- кол 14–14, стр 5–6, TEXT: «Примечание»
- кол 15–15, стр 5–6, TEXT: «Вид ИЛ»
- кол 16–16, стр 5–6, TEXT: «Индекс ИЛ»
- кол 17–17, стр 5–6, TEXT: «Индекс2 ИЛ»
- кол 18–18, стр 5–6, TEXT: «dynamic»

**Уровень группировки 1 (TABLE_GROUP1)** — 9 ячеек

- поз 1, INTEGER, id 121: COLLECTION_PHASE.count — Взыскание. Разрез 1. Кол-во субъектов
- поз 2, TEXT, id 122: COLLECTION_PHASE.name — Взыскание. Разрез 1. Наименование
- поз 3, TEXT, id 140: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 1. Кол-во стадии
- поз 6, DOUBLE, id 154: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 1. Сумма стадии.
- поз 7, TEXT, id 141: COLLECTION_PHASE.resultCount — Взыскание. Разрез 1. Кол-во результатов
- поз 10, DOUBLE, id 155: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 1. Сумма результата
- поз 12, DOUBLE, id 758: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 1. Всего погашено.
- поз 13, DOUBLE, id 754: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 1. Всего остаток по ИЛ
- поз 18, DOUBLE, id 774: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 1. Погашение в период.

**Уровень группировки 2 (TABLE_GROUP2)** — 9 ячеек

- поз 1, INTEGER, id 123: COLLECTION_PHASE.count — Взыскание. Разрез 2. Кол-во субъектов
- поз 2, TEXT, id 124: COLLECTION_PHASE.name — Взыскание. Разрез 2. Наименование
- поз 3, TEXT, id 142: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 2. Кол-во стадии
- поз 6, DOUBLE, id 152: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 2. Сумма стадии.
- поз 7, TEXT, id 143: COLLECTION_PHASE.resultCount — Взыскание. Разрез 2. Кол-во результатов
- поз 10, DOUBLE, id 153: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 2. Сумма результата
- поз 12, DOUBLE, id 757: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 2. Всего погашено.
- поз 13, DOUBLE, id 753: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 2. Всего остаток по ИЛ
- поз 18, DOUBLE, id 773: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 2. Погашение в период.

**Уровень группировки 3 (TABLE_GROUP3)** — 9 ячеек

- поз 1, INTEGER, id 125: COLLECTION_PHASE.count — Взыскание. Разрез 3. Кол-во субъектов
- поз 2, TEXT, id 126: COLLECTION_PHASE.name — Взыскание. Разрез 3. Наименование
- поз 3, TEXT, id 144: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 3. Кол-во стадии
- поз 6, DOUBLE, id 150: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 3. Сумма стадии.
- поз 7, TEXT, id 145: COLLECTION_PHASE.resultCount — Взыскание. Разрез 3. Кол-во результатов
- поз 10, DOUBLE, id 151: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 3. Сумма результата
- поз 12, DOUBLE, id 756: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 3. Всего погашено.
- поз 13, DOUBLE, id 752: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 3. Всего остаток по ИЛ
- поз 18, DOUBLE, id 772: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 3. Погашение в период.

**Уровень группировки 4 (TABLE_GROUP4)** — 9 ячеек

- поз 1, INTEGER, id 127: COLLECTION_PHASE.count — Взыскание. Разрез 4. Кол-во субъектов.
- поз 2, TEXT, id 128: ENTITY_DOCUMENT.name — Взыскание. Разрез 4. Наименование.
- поз 3, TEXT, id 146: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 4. Кол-во стадии
- поз 6, DOUBLE, id 148: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 4. Сумма стадии.
- поз 7, TEXT, id 147: COLLECTION_PHASE.resultCount — Взыскание. Разрез 4. Кол-во результатов
- поз 10, DOUBLE, id 149: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 4. Сумма результата
- поз 12, DOUBLE, id 755: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 4. Всего погашено.
- поз 13, DOUBLE, id 751: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 4. Всего остаток по ИЛ
- поз 18, DOUBLE, id 771: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 4. Погашение в период.

**Уровень группировки 5 (TABLE_GROUP5)** — 14 ячеек

- поз 4, TEXT, id 129: COLLECTION_PHASE.collection_phase_type_id — Взыскание. Разрез 5. Вид стадии
- поз 5, DATE, id 130: COLLECTION_PHASE.collection_phase_start_date — Взыскание. Разрез 5. Дата стадии
- поз 6, DOUBLE, id 131: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Разрез 5. Сумма стадии.
- поз 8, TEXT, id 132: COLLECTION_PHASE.collection_phase_status_id — Взыскание. Разрез 5. Вид результата.
- поз 9, DATE, id 133: COLLECTION_PHASE.collection_phase_close_date — Взыскание. Разрез 5. Дата результата.
- поз 10, DOUBLE, id 134: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Разрез 5. Сумма результата
- поз 11, TEXT, id 135: COLLECTION_PHASE.collection_procedure_status_id — Взыскание. Разрез 5. Статус
- поз 12, DOUBLE, id 747: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Разрез 5. Всего погашено.
- поз 13, DOUBLE, id 748: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Разрез 5. Всего остаток по ИЛ
- поз 14, TEXT, id 761: COLLECTION_PHASE.collection_phase_description — Отчет ОИП. Разрез 5. Примечание
- поз 15, TEXT, id 763: COLLECTION_PHASE.collection_phase_group_id — Отчет ОИП. Разрез 5. Вид ИЛ.
- поз 16, TEXT, id 764: COLLECTION_PHASE.collection_phase_index_id — Отчет ОИП. Разрез 5. Индекс ИЛ.
- поз 17, TEXT, id 765: COLLECTION_PHASE.collection_phase_sub_index_id — Отчет ОИП. Разрез 5. Индекс2 ИЛ.
- поз 18, DOUBLE, id 770: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. Разрез 5. Погашение в период.

**Итоговая строка (TABLE_SUM)** — 9 ячеек

- поз 1, INTEGER, id 119: COLLECTION_PHASE.count — Взыскание. Итого. Кол-во суб.
- поз 2, TEXT, id 120: «ИТОГО» — Взыскание. Итого. Итого.
- поз 3, TEXT, id 138: COLLECTION_PHASE.phaseCount — Взыскание. Разрез 5. Кол-во стадии
- поз 6, DOUBLE, id 156: COLLECTION_PHASE.collection_phase_start_total_amount — Взыскание. Итого. Сумма стадии.
- поз 7, INTEGER, id 139: COLLECTION_PHASE.resultCount — Взыскание. Разрез 5. Кол-во результатов
- поз 10, DOUBLE, id 157: COLLECTION_PHASE.collection_phase_close_total_amount — Взыскание. Итого. Сумма результата
- поз 12, DOUBLE, id 759: COLLECTION_PHASE.collection_phase_paid_total_amount — Взыскание. Итого. Всего погашено.
- поз 13, DOUBLE, id 760: COLLECTION_PHASE.collection_phase_outstanding_total_amount — Взыскание. Итого. Всего остаток по ИЛ
- поз 18, DOUBLE, id 775: COLLECTION_PHASE.PhasePaymentsByPeriod — Отчет ОИП. ИТОГО. Погашение в период.

**Разрезы, предложенные отчёту (`report_group_type`)**: Область, Район, Отрасль, Вид кредита, Заемщик, Процедура взыскания, Фаза взыскания, Вид стадии, Вид результата, Статус процедуры, Группа заемщика, Подгруппа заемщика.

---

## 2. Разрезы (группы), предложенные каждому отчёту

Таблица `report_group_type`; названия — `group_type.name`; в скобках `group_type.field_name`.

- **Отчёт 1 «Отчет по оформлению»** (12): Постановление (v_loan_credit_order_id); Получатель (v_applied_entity_id); Список получателей (v_ael_id); Пакет документации (v_document_package_id); Документ (оформление) (v_entity_document_id); Статус получателя (v_applied_entity_appliedEntityStateId); Статус документа(оформление) (v_entity_document_entityDocumentStateId); Статус пакета док. (v_document_package_documentPackageStateId); Укомплектовано (v_entity_document_completedBy); Проверено (v_entity_document_approvedBy); Область (получатель) (v_owner_region_id); Район (получатель) (v_owner_district_id)
- **Отчёт 2 «Отчет по взысканию»** (10): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Заемщик (v_debtor_id); Процедура взыскания (v_cp_id); Фаза взыскания (v_cph_id); Вид стадии (v_cph_phaseTypeId); Вид результата (v_cph_phaseStatusId); Статус процедуры (v_cp_procedureStatusId)
- **Отчёт 3 «Отчет по задолженности»** (21): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Куратор (v_loan_supervisor_id); Отдел (v_loan_department_id); Заемщик (v_debtor_id); Кредит (v_loan_id); Расчет (v_ls_id); Постановление (v_loan_credit_order_id); Группа платежеспособности (v_loan_fin_group_id); Кредитная линия (v_loan_fund_id); Группа заемщика (v_debtor_group_id); Подгруппа заемщика (v_debtor_subGroup_id); Статус (акт сверки) (v_debtor_act_status_id); Группа по освоению (v_loan_group_by_disbursement_id); Группа по залогу (v_loan_group_by_collateral_existense_id); Вид валюты (v_loan_currency_id); Аокмоту (v_debtor_aokmotu_id); Село (v_debtor_village_id); Высокогорье (v_loan_group_by_loan_period_id)
- **Отчёт 4 «Отчет по погашениям»** (12): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Куратор (v_loan_supervisor_id); Отдел (v_loan_department_id); Заемщик (v_debtor_id); Кредит (v_loan_id); Погашение (v_payment_id); Группа платежеспособности (v_loan_fin_group_id); Группа заемщика (v_debtor_group_id); Аокмоту (v_debtor_aokmotu_id)
- **Отчёт 5 «Отчет по графикам»** (12): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Куратор (v_loan_supervisor_id); Отдел (v_loan_department_id); Заемщик (v_debtor_id); Кредит (v_loan_id); График (v_ps_id); Группа платежеспособности (v_loan_fin_group_id); Кредитная линия (v_loan_fund_id); Вид валюты (v_loan_currency_id)
- **Отчёт 6 «Отчет по залогу»** (11): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Заемщик (v_debtor_id); Кредит (v_loan_id); Договор залога (v_ca_id); Предмет залога (v_ci_id); Вид залога (v_ci_itemTypeId); Группа платежеспособности (v_loan_fin_group_id); Состояние обследования (v_ci_inspection_status); Группа залога (v_ci_condition_type)
- **Отчёт 7 «Отчет по актам обследования»** (9): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Заемщик (v_debtor_id); Договор залога (v_ca_id); Предмет залога (v_ci_id); Вид залога (v_ci_itemTypeId); Акт обследования (v_cir_id); Результат обследования (v_cir_inspectionResultTypeId)
- **Отчёт 8 «Отчет по снятию с ареста»** (7): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Заемщик (v_debtor_id); Договор залога (v_ca_id); Предмет залога (v_ci_id); Снятие с ареста (v_ciaf_id)
- **Отчёт 9 «Отчет по плану»** (7): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Заемщик (v_debtor_id); Кредит (v_loan_id); План (v_sp_id)
- **Отчёт 10 «Отчет по списанию»** (5): Область (v_debtor_region_id); Район (v_debtor_district_id); Заемщик (v_debtor_id); Кредит (v_loan_id); Списание (v_wo_id)
- **Отчёт 11 «Отчет по переводу долга»** (5): Область (v_debtor_region_id); Район (v_debtor_district_id); Заемщик (v_debtor_id); Кредит (v_loan_id); Перевод долга (v_dt_id)
- **Отчёт 12 «Отчет по кадрам»** (7): Область (v_debtor_region_id); Район (v_debtor_district_id); Сотрудник (v_s_id); Событие сотрудника (v_se_id); Вид события сотрудника (v_se_type); Должность сотрудника (v_s_position_id); Отдел сотрудника (v_s_department_id)
- **Отчёт 13 «Отчет по документооброту»** (4): Вид документа (v_doc_documentType); Тип документа (v_doc_documentSubType); Статус документа (v_doc_documentState); Документ (v_doc_id)
- **Отчёт 14 «Отчет ОИП»** (12): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Заемщик (v_debtor_id); Процедура взыскания (v_cp_id); Фаза взыскания (v_cph_id); Вид стадии (v_cph_phaseTypeId); Вид результата (v_cph_phaseStatusId); Статус процедуры (v_cp_procedureStatusId); Группа заемщика (v_debtor_group_id); Подгруппа заемщика (v_debtor_subGroup_id)
- **Отчёт 15 «Отчет по субсидиям»** (3): Субсидиар (v_subsidy_recipient_id); Субсидия (v_subsidy_id); Субсидия-платеж (v_subsidy_payment_id)
- **Отчёт 16 «Отчет ОИП копия»** (12): Область (v_debtor_region_id); Район (v_debtor_district_id); Отрасль (v_debtor_work_sector_id); Вид кредита (v_loan_type_id); Заемщик (v_debtor_id); Процедура взыскания (v_cp_id); Фаза взыскания (v_cph_id); Вид стадии (v_cph_phaseTypeId); Вид результата (v_cph_phaseStatusId); Статус процедуры (v_cp_procedureStatusId); Группа заемщика (v_debtor_group_id); Подгруппа заемщика (v_debtor_subGroup_id)

### Разрезы по умолчанию в шаблонах отчётов (`report_template`, 16 строк)

Поля: onDate, additionalDate, inThousands, showGroup1…6, group_type1…6, report_id.

- шаблон 1 «Общий отчет по оформлению документации», report_id=1, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Постановление; 2:Область (получатель); 3:Район (получатель); 4:Получатель; 5:Документ (оформление); 6:—(выкл)
- шаблон 2 «Общий отчет по взысканию», report_id=2, onDate=2019-02-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Процедура взыскания; 5:Фаза взыскания; 6:—(выкл)
- шаблон 3 «Отчет по задолженности (Баткенская область)», report_id=3, onDate=2019-01-01, additionalDate=2018-01-01, inThousands=1000; 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Расчет; 6:—(выкл)
- шаблон 4 «Отчет по погашениям», report_id=4, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Погашение; 6:—(выкл)
- шаблон 5 «Отчет по графикам», report_id=5, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик(выкл); 4:Кредит(выкл); 5:График(выкл); 6:—(выкл)
- шаблон 6 «Отчет по залогу», report_id=6, onDate=2019-01-01, additionalDate=None, inThousands=1000; 1:Область; 2:Район; 3:Заемщик; 4:Договор залога; 5:Кредит; 6:Предмет залога
- шаблон 7 «Отчет по актам обследования», report_id=7, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Договор залога; 5:Предмет залога; 6:Акт обследования
- шаблон 8 «Отчет по снятию с ареста», report_id=8, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Договор залога; 5:Предмет залога; 6:Снятие с ареста
- шаблон 9 «Отчет по плану (шаблон)», report_id=9, onDate=2019-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:План(выкл); 6:—(выкл)
- шаблон 10 «Отчет по списанию», report_id=10, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Списание; 6:—(выкл)
- шаблон 11 «Отчет по переводу долга», report_id=11, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:Перевод долга; 6:—(выкл)
- шаблон 12 «Отчет по кадрам», report_id=12, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Отдел сотрудника; 2:Должность сотрудника; 3:Сотрудник; 4:Событие сотрудника; 5:—(выкл); 6:—(выкл)
- шаблон 13 «Отчет по документообороту», report_id=13, onDate=2018-01-01, additionalDate=None, inThousands=None; 1:Вид документа; 2:Тип документа; 3:Документ; 4:Статус документа(выкл); 5:—(выкл); 6:—(выкл)
- шаблон 14 «Отчет по плану за 2019 год», report_id=9, onDate=2019-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Кредит; 5:План; 6:—
- шаблон 15 «Общий отчет ОИП», report_id=14, onDate=2019-01-01, additionalDate=None, inThousands=None; 1:Область; 2:Район; 3:Заемщик; 4:Процедура взыскания(выкл); 5:Фаза взыскания; 6:—(выкл)
- шаблон 16 «Отчет по субсидиям», report_id=15, onDate=None, additionalDate=None, inThousands=1000; 1:Субсидиар(выкл); 2:Субсидиар(выкл); 3:Субсидиар; 4:Субсидия; 5:Субсидия-платеж(выкл); 6:—(выкл)

### Параметры вывода отчётов (`report_output_parameter` → `output_parameter`)

`output_parameter`: id, name, outputParameterType, position, text, value.

- **Отчёт 1 «Отчет по оформлению»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Нижний колонтитул (кол-во страниц) [SHEET_FOOTER_TEXT, поз 0] text=«Страница page() из numPages()» value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40; Высота строки ( Заголовок таблицы) [ROW_HEIGHT, поз 6] value=30
- **Отчёт 2 «Отчет по взысканию»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40; Заголовок (текстк). перенос текста [CELL_WRAP_TEXT, поз 10] text=«string» value=1; Высота строки ( Заголовок таблицы) [ROW_HEIGHT, поз 6] value=30
- **Отчёт 3 «Отчет по задолженности»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Нижний колонтитул (кол-во страниц) [SHEET_FOOTER_TEXT, поз 0] text=«Страница page() из numPages()» value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 4 «Отчет по погашениям»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40; ширина 2. столбца (кол-во) [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца (кол-во) [COLUMN_WIDTH, поз 3] value=6; ширина 4. столбца (наименование) [COLUMN_WIDTH, поз 4] value=40
- **Отчёт 5 «Отчет по графикам»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца (кол-во) [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца (кол-во) [COLUMN_WIDTH, поз 3] value=6; ширина 4. столбца (наименование) [COLUMN_WIDTH, поз 4] value=40
- **Отчёт 6 «Отчет по залогу»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Книжный вид [PAGE_ORIENTATION, поз 0] value=0; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40; ширина 2. столбца (кол-во) [COLUMN_WIDTH, поз 2] value=6; ширина 7. столбца (наименование залога) [COLUMN_WIDTH, поз 7] value=40
- **Отчёт 7 «Отчет по актам обследования»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Разместить на кол-во стр. в высоту [SHEET_FIT_HEIGHT, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 8 «Отчет по снятию с ареста»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Книжный вид [PAGE_ORIENTATION, поз 0] value=0; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Разместить на кол-во стр. в высоту [SHEET_FIT_HEIGHT, поз 0] value=0; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 9 «Отчет по плану»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Книжный вид [PAGE_ORIENTATION, поз 0] value=0; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 10 «Отчет по списанию»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 11 «Отчет по переводу долга»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 12 «Отчет по кадрам»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=6; ширина 3. столбца [COLUMN_WIDTH, поз 3] value=40
- **Отчёт 13 «Отчет по документооброту»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Книжный вид [PAGE_ORIENTATION, поз 0] value=0; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40
- **Отчёт 14 «Отчет ОИП»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40; Заголовок (текстк). перенос текста [CELL_WRAP_TEXT, поз 10] text=«string» value=1; Высота строки ( Заголовок таблицы) [ROW_HEIGHT, поз 6] value=30; ширина 14. столбца [COLUMN_WIDTH, поз 14] value=70
- **Отчёт 15 «Отчет по субсидиям»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40; ширина 6. столбца ( примечание субсидии ) [COLUMN_WIDTH, поз 6] value=30; ширина 7. столбца ( акт сверки ) [COLUMN_WIDTH, поз 7] value=20; ширина 8. столбца ( акт сверки - последний ) [COLUMN_WIDTH, поз 8] value=20
- **Отчёт 16 «Отчет ОИП копия»**: Альбомный вид [PAGE_ORIENTATION, поз 0] value=1; Высота нижнего поля [SHEET_BOTTOM_MARGIN, поз 0] value=0; Высота верхнего поля [SHEET_TOP_MARGIN, поз 0] value=0.1; Ширина правого поля [SHEET_RIGHT_MARGIN, поз 0] value=0.1; Ширина левого поля [SHEET_LEFT_MARGIN, поз 0] value=0.1; Показывать разрыв страниц [SHEET_AUTOBREAKS, поз 0] value=1; Разместить на кол-во стр. в ширину [SHEET_FIT_WIDTH, поз 0] value=1; Поле верхнего колонтитула [SHEET_HEADER_MARGIN, поз 0] value=0; Поле нижнего колонтитула [SHEET_FOOTER_MARGIN, поз 0] value=0; Ширина всех столбцов [DEFAULT_COLUMN_WIDTH, поз 0] value=12; ширина 1. столбца [COLUMN_WIDTH, поз 1] value=6; ширина 2. столбца [COLUMN_WIDTH, поз 2] value=40; Заголовок (текстк). перенос текста [CELL_WRAP_TEXT, поз 10] text=«string» value=1; Высота строки ( Заголовок таблицы) [ROW_HEIGHT, поз 6] value=30; ширина 14. столбца [COLUMN_WIDTH, поз 14] value=70

---

## 3. Подвал (footer) отчётов

Строк типа `TABLE_FOOTER` в `content_parameter` нет ни одной (распределение rowType по всей таблице: TABLE_HEADER 195, TABLE_GROUP4 127, TABLE_GROUP3 118, TABLE_SUM 113, TABLE_GROUP1 111, TABLE_GROUP2 109, TABLE_GROUP5 108, PAGE_TITLE 29, TABLE_GROUP6 18; TABLE_FOOTER — 0). Значение `TABLE_FOOTER` существует только в перечне типов строк интерфейса. Единственный «подвал» в данных — параметр вывода `SHEET_FOOTER_TEXT` (колонтитул страницы листа), он привязан только к отчётам 1 и 3: текст `Страница page() из numPages()`.

Отчёты 1 и 3 — единственные, у кого в `report_output_parameter` есть колонтитул; остальные 14 колонтитула не имеют. Размеры полей, ориентация и ширины колонок по каждому отчёту — в конце раздела 2.

---

## 4. Распечатки (`printout`, `printout_template`)

Схема `printout`: `id`, `name`, `printoutType`. Схема `printout_template`: `id`, `name`, `printout_id`. **Больше колонок нет**: ни тела шаблона, ни текста, ни BLOB, ни пути к файлу, ни ссылки на `content_parameter`/`output_parameter`/`filter_parameter` (связующих таблиц `printout_*` в схеме нет — таблиц с именем, содержащим `printout`, ровно две). Весь сохранённый состав:

| printout.id | printout.name | printoutType | printout_template.id | printout_template.name |
|---|---|---|---|---|
| 1 | Реестр погашений | PAYMENT_SUMMARY | 1 | Реестр погашений |
| 2 | Детальный расчет | LOAN_DETAILED_SUMMARY | 2 | Детальный расчет |
| 3 | Расчет | LOAN_SUMMARY | 3 | На исковое заявление |
| 4 | Акт сверки | LOAN_SUMMARY | 4 | Акт сверки Пром |
| 5 | Претензия | COLLECTION_SUMMARY | 5 | Претензия Пром |

Тело, колонки, текст и заголовки этих 5 форм в базе не хранятся: форма формируется кодом приложения (по `printoutType`), а в БД лежат только имя и тип. В новом дампе (`frp_mfloan_2026_10_24.sql`) строки `printout` и `printout_template` идентичны.

---

## 5. Хранение шаблонов печатных форм и документов — поиск по схеме

Просмотрены имена всех таблиц (`CREATE TABLE`, 352 таблицы) и колонки с типами text/blob. Таблицы, чьё имя связано с шаблонами/печатью/документами, и что в них лежит:

| таблица | колонки | строк в дампе | тело шаблона |
|---|---|---|---|
| `report_template` (+ `report_template_content_parameter`, `_filter_parameter`, `_output_parameter`, `_generation_parameter`, `_user`) | отбор по умолчанию: onDate, additionalDate, inThousands, showGroup1–6, group_type1–6, report_id | 16 (связки с ячейками: см. ниже) | нет; это пресет разрезов/даты отчёта, не бланк |
| `printout`, `printout_template` | см. раздел 4 | 5 и 5 | нет |
| `agreementTemplate` | id, record_status, uuid, version, approvedBy/Date/Description, createdBy/Date/Description, name (varchar 50), orderTermId, au_* | 0 | колонки тела нет; таблица пуста |
| `AgreementTemplateModel` | то же без служебных | 0 | нет; пуста |
| `cat_document_template` | id, internalName, name, information (bigint), au_* | 0 | колонки тела нет; пуста |
| `cat_dispatch_template` | id, internalName, name, description, au_* | 0 | нет; пуста |
| `cat_task_template`, `TaskTemplate_properties` | object/taskType; пары ключ-значение | 0 | нет; пусты |
| `cat_content_parameter` | internalName, name, classificator, constantText, constantValue, fieldName, fieldPosition, fieldTypeId, format, position, systemObjectTypeId | 0 | нет; пуста |
| `region_report`, `region_sub_report_*` (11), `grouped_data_*` (12) | заготовки региональных сводок (name, from_date/to_date, region_id, supervisor_id; в подтаблицах — measurement_string, name; в `grouped_data_*` — code, debtor_count, total_debt, total_overdue, total_paid, total_profit, description) | 0 | нет; пусты |
| `system_file` / `SystemFileModel` | name, path, attachment_id (+au_*) | 53 530 / 0 | только имя файла и путь в `/opt/uploads/...`; содержимого файлов в дампе нет |
| `attachment`, `cat_attachments` | имя и метаданные вложений (имя файла, mime) | много | содержимого нет (файлы с расширением `.atach` лежат вне БД) |
| `message_resource` | en / ky / key / ru | более 1 400 | только подписи интерфейса |

Колонки типа text/longtext/blob в схеме есть только в бизнес-таблицах (`asset_expense.details`, `asset_item_details.document`, `collateralItemArrestFree.based`, `collectionEvent.description`, `collectionPhase.description`, `debtor.description`, `df_document.description`, `df_document.documentLinks` tinyblob, `description.text`, `loan.*Description`, `subsidy*.description` и т. п.). Ни одна из них не содержит макета печатной формы.

Поиск по искомым формам (по именам таблиц — выше; по значениям — прямой grep по дампу, только для уточнения наличия):

| форма | где найдена в данных | что именно |
|---|---|---|
| «Доо талап» (исковое заявление) | `df_document` (документооборот): запись с темой «Доо талап (Претензия)»; `system_file`: десятки вложений «Доо арыз…pdf», «исковое заявление….pdf» | это загруженные сканы/входящие документы по делам (папки `procedures/...`), не шаблон. Шаблона в БД нет |
| «Извещение» | `system_file`: вложения «извещение 1 …jpeg», «извещение о начале.pdf» в папках процедур взыскания | сканы, не шаблон |
| «Сведения о заёмщике» | в дампе строки с таким текстом нет (в `system_file` одно вложение «Регистрационные сведения о налогоплательщике …pdf», не шаблон) | — |
| «Уведомление» | ни таблицы, ни строки данных, ни имени вложения с таким словом не найдено | — |
| «Претензия» | `printout` id 5 / `printout_template` id 5 «Претензия Пром» (только имя); `system_file` «Претензия ККСК.pdf» (скан) | тело не хранится |
| «Шаблон договора (200 т.с.)», «Шаблон договора ( 50 т.с.)» | только `message_resource`: id 1403 (`en`='Printout', `ky`/`ru`='Шаблон договора (200 т.с.)', key `label.table.print`) и id 1404 (`en`='Printout 2', `ru`='Шаблон договора ( 50 т.с.)', key `label.table.print1`) | это подписи двух кнопок интерфейса; тело договора не хранится. В `agreementTemplate`, куда по смыслу мог бы относиться шаблон договора, строк нет |
| «шаблон.xls» | `system_file`: 5 вложений с именем «шаблон.xls» (ids 3474, 3900, 3985, 45507, 49180) в папках `/opt/uploads/...` | загруженные пользователями файлы; самих файлов в дампе нет |

Вывод по разделу: тел печатных форм/шаблонов договоров в БД нет. Формы «Доо талап», «Извещение», «Сведения о заёмщике», «Уведомление», «Шаблон договора» в таблицах как шаблоны не представлены; они, видимо, зашиты в код приложения или лежат в файлах вне дампа (последнее по данным БД не проверяется).

---

## 6. Что восстанавливается и что нет

**Отчёты (макет листа восстанавливается по `content_parameter`)**

| отчёт | ячеек | заголовок | шапка | группы 1–6 | итоги | подвал | порядок/ширины |
|---|---|---|---|---|---|---|---|
| 1 Отчет по оформлению | 71 | да | да (двухъярусная) | 1–6 | да | колонтитул есть | да |
| 2 Отчет по взысканию | 66 | да | да | 1–5 | да | нет | да |
| 3 Отчет по задолженности | 109 | да | да (двухъярусная) | 1–5 | да | колонтитул есть | да |
| 4 Отчет по погашениям | 67 | да | да | 1–5 | да | нет | да |
| 5 Отчет по графикам | 77 | да | да | 1–5 | да | нет | да |
| 6 Отчет по залогу | 95 | да | да | 1–6 | да | нет | да |
| 7 Отчет по актам обследования | 43 | да | да | 1–6 | да | нет | да |
| 8 Отчет по снятию с ареста | 31 | да (3 ячейки) | да | 1–6 | да | нет | да |
| 9 Отчет по плану | 164 | да | да | 1–5 | да | нет | да |
| 10 Отчет по списанию | 56 | да | да | 1–5 | да | нет | да |
| 11 Отчет по переводу долга | 41 | да | да | 1–5 | да | нет | да |
| 12 Отчет по кадрам | 27 | да | да | 1–4 | да | нет | да |
| 13 Отчет по документообороту | 29 | да | да | 1–3 | да | нет | да |
| 14 Отчет ОИП | 81 | да | да | 1–5 | да | нет | да |
| 15 Отчет по субсидиям | 29 | да (1 ячейка) | да | 1–5 | да | нет | да |
| 16 Отчет ОИП копия | 81 | да | да | 1–5 | да | нет | да |

Отчётов с нулём параметров содержания нет. Не восстанавливается из БД: шрифты, заливка, форматы чисел (полей для них в `content_parameter` нет); у ячеек групп и итогов `col_from/col_to/row_from/row_to` равны 0, порядок колонок задаёт только `position`, номера строк определяет движок при выводе. В пуле встречаются ячейки уровня N с именем другого уровня (например, id 27 «Разрез 2. Наименование» в TABLE_GROUP1 отчёта 1) — в базе не видно, выводятся ли они.

**Распечатки (5)** — макет не восстанавливается ни у одной: в БД только имя и тип, тела/колонок/текста нет. Дополнительные источники — живые прогоны на легаси-стенде (`requirements/legacy/10-reports.md` §15) и сами выгруженные формы, которых в дампе нет.

**Прочие формы (Доо талап, Извещение, Сведения о заёмщике, Уведомление, Шаблон договора 200/50 т.с.)** — тел в БД нет (раздел 5); для «Шаблон договора» сохранились лишь две подписи кнопок.
