// Смоук макета «Имущество Фонда». Источник ожиданий — ASUBK-imushchestvo-logika.md §18 (матрица приёмки,
// 41 сценарий) и §14 (инварианты ИИ-1…ИИ-20). Запуск: node mockups/assets/tests/assets.smoke.mjs
import { group, ck, digits, report } from './harness.mjs';

const low = s => String(s || '').toLowerCase();
const has = (s, sub) => low(s).includes(low(sub));
// ввести факт и сразу опубликовать вторым ключом (если он ключевой)
function key(IM, target, t, data, role) {
  const r = IM.addFact(target, t, data, role);
  if (!r.ok) return r;
  if (r.pending) { const p = IM.publish(r.fact.id, 'head'); if (!p.ok) return p; }
  return r;
}
const sum = a => a.reduce((x, y) => x + y, 0);

/* ============================== §18 ============================== */

group('С-1: предложение ПССИ из трёх позиций: принять · отозвать до акта · отказать', ({ IM }) => {
  const c = IM.offerCounts('П-1');
  ck('три разных итога: поз.1 принята, поз.2 отозвана, поз.3 отказана',
    IM.posOutcome('П-1', 1).code === 'accepted' && IM.posOutcome('П-1', 2).code === 'withdrawn' && IM.posOutcome('П-1', 3).code === 'rejected',
    [1, 2, 3].map(n => IM.posOutcome('П-1', n).code));
  ck('объект один', IM.OBJECTS.filter(o => o.offer === 'П-1').length === 1);
  ck('отчёт: «отказано» = 1', c.rejected === 1, c);
  ck('отчёт: «отозвано» = 1', c.withdrawn === 1, c);
  ck('ИИ-14: решение принять/отказать вносит только секретарь органа', !IM.addFact('П-3', 'decision', { organ: 'К', doc: 'd', items: { 1: { v: 'accept' } } }, 'spec').ok);
  ck('ИИ-14: «отозвана» — только документом источника (без документа отказ)', !IM.addFact('П-3', 'withdraw', { pos: 1 }, 'spec').ok);
});

group('С-2: попытка отозвать позицию после акта', ({ IM }) => {
  const r = IM.addFact('П-1', 'withdraw', { pos: 1, doc: 'x' });
  ck('отказ', !r.ok, r);
  ck('текст «после акта отзыва нет: до перехода права — прекращение принятия, после — возврат»',
    has(r.why, 'после акта отзыва нет: до перехода права — прекращение принятия, после — возврат'), r.why);
  ck('ИИ-11: то же для позиции, акт которой ждёт второго ключа (П-7 поз.2)', !IM.addFact('П-7', 'withdraw', { pos: 2, doc: 'x' }).ok);
  ck('ИИ-11: терминировать принятие после перехода права нельзя (ИО-1) — только возврат', !IM.gate('ИО-1', 'terminate').ok && has(IM.gate('ИО-1', 'terminate').why, 'возврат'));
});

group('С-3: квартира: акт 12.03, регистрация 05.04', ({ IM }) => {
  const act = IM.obj('ИО-1').facts.find(f => f.t === 'act');
  ck('акт 12.03.2027', act && act.date === '2027-03-12', act && act.date);
  ck('между актом и регистрацией: «принят, ждёт регистрации»', IM.objState('ИО-1', '2027-03-20').code === 'wait');
  ck('дата перехода права = дата регистрации 05.04, не 12.03', IM.objState('ИО-1', '2027-04-06').transfer === '2027-04-05');
  ck('погашения 12.03 нет (в делёжке на 20.03 объекта нет)', !IM.allocation('o_x', '2027-03-20').rows.some(r => r.id === 'ИО-1'));
  const row = IM.allocation('o_x', '2027-04-06').rows.find(r => r.id === 'ИО-1');
  ck('погашение — на 05.04', row && row.date === '2027-04-05', row);
  ck('ИИ-3: ровно одно погашение на объект', IM.allocation('o_x', '2027-04-06').rows.filter(r => r.id === 'ИО-1').length === 1);
  ck('до 05.04 попытка продажи недоступна (на 20.03)', !IM.gate('ИО-1', 'attempt', '2027-03-20').ok);
  ck('ИИ-9: на 01.04 тоже недоступна', !IM.gate('ИО-1', 'attempt', '2027-04-01').ok);
});

group('С-4: трактор (регистрация не нужна): акт 12.03', ({ IM }) => {
  // в сиде трактор П-2: акт 15.03.2027 (сценарий 4 канона на другой дате; проверяется то же правило)
  const act = IM.obj('ИО-2').facts.find(f => f.t === 'act');
  ck('переход права = дата акта', IM.objState('ИО-2').transfer === act.date, [IM.objState('ИО-2').transfer, act.date]);
  ck('погашение на дату акта', IM.allocation('o_b', act.date).rows.some(r => r.id === 'ИО-2' && r.date === act.date));
  ck('регистрация права для вида не вводится (gate reg)', !IM.gate('ИО-2', 'reg').ok);
  ck('ИИ-3: погашение одно', IM.allocation('o_b').rows.filter(r => r.id === 'ИО-2').length === 1);
});

group('С-5: окончательный отказ регистратора', ({ IM }) => {
  const pf = IM.pending().find(x => x.f.t === 'act' && x.owner === 'П-7');
  ck('сид: акт ИО-6 ждёт второго ключа', !!pf);
  ck('акт публикует начальник', IM.publish(pf.f.id, 'head').ok);
  const r = IM.addFact('ИО-6', 'regRefusal', { doc: 'Уведомление', final: true });
  ck('отказ регистратора введён и ждёт второго ключа', r.ok && r.pending, r.why);
  ck('до публикации — по-прежнему «ждёт регистрации»', IM.objState('ИО-6').code === 'wait');
  IM.publish(r.fact.id, 'head');
  ck('«принятие не состоялось»', IM.objState('ИО-6').code === 'failed' && IM.objState('ИО-6').label === 'принятие не состоялось', IM.objState('ИО-6'));
  ck('позиция предложения: «принятие не состоялось»', IM.posOutcome('П-7', 2).code === 'failed');
  ck('ни одного погашения', !IM.allocation('o_s').rows.some(r => r.id === 'ИО-6'));
  const n = IM.neighbours('ИО-6').payments.join(' ');
  ck('Платежи: «погашения не было и сторно нет»', has(n, 'погашения не было') && has(n, 'сторно нет'), n);
});

group('С-6: стоимость 2 400 000 > долг 1 850 000', ({ IM }) => {
  const f = IM.flags('ИО-1', '2027-04-10');
  ck('доплата 550 000', f.incomplete && f.incomplete.amount === 550000, f.incomplete);
  ck('адресат доплаты указан (отчуждатель/депозит ПССИ)', f.incomplete && !!f.incomplete.to, f.incomplete);
  ck('⚑ «принятие не завершено» до исполнения Возврата', !!f.incomplete);
  ck('ИИ-9: продажа недоступна при ⚑', !IM.gate('ИО-1', 'attempt', '2027-04-10').ok && has(IM.gate('ИО-1', 'attempt', '2027-04-10').why, 'принятие не завершено'));
  ck('после исполнения (20.04) флаг снят', IM.flags('ИО-1', '2027-04-21').incomplete === null);
  ck('ИИ-6: исполнение доплаты вводит только бухгалтер Платежей', !IM.addFact('ИО-3', 'topup', { doc: 'd' }, 'spec').ok);
  const r = IM.addFact('ИО-3', 'topup', { doc: 'Возврат № 1' }, 'acc');
  ck('бухгалтер исполняет доплату — флаг снят', r.ok && IM.flags('ИО-3').incomplete === null, r.why);
});

group('С-7: гараж брата должника', ({ IM }) => {
  const of = IM.offer('П-3');
  ck('обязанное лицо — должник (Иманов К.Т.), отчуждатель — другой субъект (брат)', IM.OBL.find(o => o.id === of.obligor).name === 'Иманов К.Т.' && has(of.alien, 'Иманов Б.Т.'), [of.obligor, of.alien]);
  ck('ожидаемая доплата 750 000 − 600 000 = 150 000', IM.expectedTopups('П-3').rows[1].topup === 150000);
  const d = IM.addFact('П-3', 'decision', { organ: IM.ORGANS[0], doc: 'Реш. 5/2028', items: { 1: { v: 'accept' } } }, 'sec');
  ck('решение принять', d.ok, d.why);
  const a = key(IM, 'П-3', 'act', { pos: 1, doc: 'Акт 1/28' }, 'spec');
  ck('акт опубликован', a.ok, a.why);
  const id = IM.posOutcome('П-3', 1).obj;
  if (IM.objState(id).code === 'wait') key(IM, id, 'reg', { doc: 'Выписка' }, 'spec');
  const t = IM.topupOf(id);
  ck('доплата адресована отчуждателю (брату), не обязанному лицу', t && has(t.to, 'Иманов Б.Т.') && !has(t.to, 'Иманов К.Т.'), t);
  ck('сумма 150 000', t && t.amount === 150000, t && t.amount);
});

group('С-8: вещь поручителя Z', ({ IM }) => {
  const of = IM.offer('П-4');
  const o = IM.OBL.find(x => x.id === of.obligor);
  ck('обязанное лицо — поручитель Z', o.role === 'поручитель' && has(of.alien, 'Жумабаев'), [o, of.alien]);
  ck('отчуждатель Z', IM.obj('ИО-4').alien === o.name, IM.obj('ИО-4').alien);
  const col = IM.neighbours('ИО-4').collection.join(' ');
  ck('во Взыскании гасится линия поручителя Z', has(col, 'линия поручителя') && has(col, 'Жумабаев'), col);
});

group('С-9: состояние объекта на 01.01.2027 и на 01.10.2027', ({ IM, w, doc }) => {
  const a = IM.objState('ИО-1', '2027-01-01'), b = IM.objState('ИО-1', '2027-10-01');
  ck('разные состояния из одних фактов', a.code !== b.code && a.code === 'none' && b.code === 'sold_inst', [a.code, b.code]);
  ck('ИИ-2: на объекте нет хранимого поля состояния', !['state', 'status', 'code', 'stateCode'].some(k => k in IM.obj('ИО-1')), Object.keys(IM.obj('ИО-1')));
  ck('ИИ-2: нет API ручной смены статуса', !Object.keys(IM).some(k => /^set(State|Status)/i.test(k)));
  IM.openObject('ИО-1', 'char');
  IM.setAsOf('2027-03-20');
  ck('UI: obj-state на 20.03.2027 = wait', doc.querySelector('[data-testid=obj-state]').dataset.code === 'wait');
  IM.setAsOf('2027-10-01');
  ck('UI: obj-state на 01.10.2027 = sold_inst', doc.querySelector('[data-testid=obj-state]').dataset.code === 'sold_inst');
});

group('С-10: вторая попытка со сниженной ценой без основания', ({ IM }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  const a1 = IM.addFact('ИО-7', 'attempt', { start: 1900000, basis: ap.id, method: 'Аукцион', platform: 'п', encMark: 'с обременением' });
  ck('первая попытка по оценке проходит', a1.ok, a1.why);
  ck('итог «не состоялась»', IM.addFact('ИО-7', 'attemptResult', { v: 'failed' }).ok);
  const r = IM.addFact('ИО-7', 'attempt', { start: 1500000, basis: '', method: 'Аукцион', platform: 'п', encMark: 'с обременением' });
  ck('отказ без основания', !r.ok && has(r.why, 'основание стартовой цены обязательно'), r.why);
  const r2 = IM.addFact('ИО-7', 'attempt', { start: 1500000, basis: ap.id, method: 'Аукцион', platform: 'п', encMark: 'с обременением' });
  ck('снижение ниже оценки со ссылкой на оценку — тоже отказ (нужно решение органа)', !r2.ok, r2.why);
  const pd = IM.addFact('ИО-7', 'priceDecision', { amount: 1500000, doc: 'Реш.' }, 'sec');
  const r3 = IM.addFact('ИО-7', 'attempt', { start: 1500000, basis: pd.fact.id, method: 'Аукцион', platform: 'п', encMark: 'с обременением' });
  ck('с решением органа о снижении — проходит', pd.ok && r3.ok, r3.why);
});

group('С-11: открыть вторую попытку при идущей первой', ({ IM }) => {
  ck('сид: у ИО-4 идёт попытка', IM.objState('ИО-4').code === 'listed');
  ck('gate: отказ', !IM.gate('ИО-4', 'attempt').ok, IM.gate('ИО-4', 'attempt'));
  const ap = IM.obj('ИО-4').facts.find(f => f.t === 'appraisal');
  const r = IM.addFact('ИО-4', 'attempt', { start: 1250000, basis: ap.id, method: 'Аукцион', platform: 'п' });
  ck('addFact: отказ', !r.ok, r.why);
  ck('ИИ-10: второй действующий договор КП недопустим (ИО-1)', !IM.gate('ИО-1', 'contract').ok && has(IM.gate('ИО-1', 'contract').why, 'уже есть действующий договор'));
});

group('С-12: попытка при активном обременении без отметки', ({ IM }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  ck('сид: на ИО-7 активна аренда', !!IM.flags('ИО-7').encumbered);
  const r = IM.addFact('ИО-7', 'attempt', { start: 1900000, basis: ap.id, method: 'Аукцион', platform: 'п' });
  ck('отказ без отметки', !r.ok && has(r.why, 'обременение'), r.why);
  const r2 = IM.addFact('ИО-7', 'attempt', { start: 1900000, basis: ap.id, method: 'Аукцион', platform: 'п', encMark: 'после снятия' });
  ck('ИИ-17: с отметкой — проходит', r2.ok, r2.why);
  ck('отметка сохранена в факте', r2.fact && r2.fact.encMark === 'после снятия');
});

group('С-13: рассрочка: последний платёж', ({ IM }) => {
  const ci = IM.contractInfo('ИО-8');
  ck('сид: оплачено 640 000 из 960 000, объект «продан в рассрочку»', ci.paid === 640000 && IM.objState('ИО-8').code === 'sold_inst', [ci.paid, IM.objState('ИО-8').code]);
  ck('ИИ-10: пока не оплачено, право у Фонда, объект не снят', IM.objState('ИО-8').code !== 'removed');
  const r = IM.addFact('ИО-8', 'payment', { amount: 320000, date: '2028-03-10' }, 'acc');
  ck('последний платёж принят', r.ok, r.why);
  const st = IM.objState('ИО-8', '2028-03-10');
  ck('снят с учёта', st.code === 'removed', st);
  ck('на дату последнего платежа, не на дату договора (01.12.2027)', st.date === '2028-03-10' && st.date !== IM.contractInfo('ИО-8').c.date, st.date);
  ck('ИИ-7: путь — продажа в рассрочку', st.pathId === 'inst');
  ck('ИИ-7: ещё один путь на снятом объекте недоступен (gift, loss, ret)', ['gift', 'loss', 'ret'].every(t => !IM.gate('ИО-8', t, '2028-03-10').ok));
});

group('С-14: рассрочка: расторжение', ({ IM }) => {
  ck('сид: ИО-1 продан в рассрочку', IM.objState('ИО-1').code === 'sold_inst');
  const r = IM.addFact('ИО-1', 'cterm', { doc: 'Соглашение' }, 'lawyer');
  ck('расторжение — ключевой факт, ждёт второго ключа', r.ok && r.pending, r.why);
  IM.publish(r.fact.id, 'head');
  ck('объект «на учёте»', IM.objState('ИО-1').code === 'onbook', IM.objState('ИО-1'));
  ck('Возврат = уплаченное − неустойка', r.fact.refund === r.fact.paid - r.fact.penaltyAmt && r.fact.paid === 562500, r.fact);
  ck('неустойка не больше уплаченного, возврат ≥ 0', r.fact.penaltyAmt >= 0 && r.fact.refund >= 0);
  ck('Платежи: распоряжение на Возврат покупателю', has(IM.neighbours('ИО-1').payments.join(' '), 'Возврат покупателю'));
  ck('расторжение — выход из пути: продавать снова можно', IM.gate('ИО-1', 'attempt').ok, IM.gate('ИО-1', 'attempt'));
});

group('С-15: 120 т зерна → 50 + 65 + 5 т', ({ IM }) => {
  ck('квартиру разделить нельзя', !IM.gate('ИО-1', 'split').ok);
  const r = key(IM, 'ИО-410', 'split', { parts: [50, 65, 5], doc: 'Акт' }, 'spec');
  ck('разделение выполнено', r.ok, r.why);
  const v = ['ИО-410/1', 'ИО-410/2', 'ИО-410/3'].map(IM.objValue);
  ck('сумма частей = 1 440 000 до копейки', Math.round(sum(v) * 100) === 144000000, v);
  ck('исходный «разделён»', IM.objState('ИО-410').code === 'split');
  ck('части «на учёте»', ['ИО-410/1', 'ИО-410/2', 'ИО-410/3'].every(id => IM.objState(id).code === 'onbook'));
  ck('ИИ-7: исходный после разделения не берёт путь выбытия', ['gift', 'loss', 'ret', 'split'].every(t => !IM.gate('ИО-410', t).ok));
  const bad = IM.addFact('ИО-410/2', 'split', { parts: [30, 30], doc: 'd' });
  ck('части не по количеству объекта (30+30≠65) — отказ', !bad.ok, bad.why);
  const u = IM.splitValues(1000000.01, 3, [1, 1, 1]);
  ck('ИИ-8: неровное деление, копейки сходятся', Math.round(sum(u) * 100) === 100000001, u);
  const u2 = IM.splitValues(1440000, 120, [7, 7, 106]);
  ck('ИИ-8: ещё случай 7+7+106', Math.round(sum(u2) * 100) === 144000000, u2);
});

group('С-16: возврат по суду через 15 мес.', ({ IM }) => {
  const d = '2028-06-15'; // 15.03.2027 + 15 мес.
  const r = key(IM, 'ИО-2', 'ret', { doc: 'Решение суда', date: d }, 'spec');
  ck('возврат введён и опубликован', r.ok, r.why);
  const st = IM.objState('ИО-2', d);
  ck('объект снят с учёта путём «возврат»', st.code === 'removed' && st.path === 'возврат', st);
  const p = IM.neighbours('ИО-2', d).payments.join(' ');
  ck('сторно поступления', has(p, 'сторно поступления'), p);
  ck('пеня за разрыв спорная', has(p, 'спорн'), p);
});

group('С-17: возврат по суду проданного объекта', ({ IM }) => {
  const g = IM.gate('ИО-1', 'ret');
  ck('путь «возврат» недоступен', !g.ok);
  ck('текст: денежная компенсация', has(g.why, 'денежная компенсация') && g.why === IM.RETURN_SOLD, g.why);
  const r = IM.addFact('ИО-1', 'ret', { doc: 'Решение суда' });
  ck('addFact тоже отказывает', !r.ok);
});

group('С-18: опечатка в стоимости после публикации', ({ IM }) => {
  const before = JSON.stringify(IM.obj('ИО-2').facts);
  const r = IM.addFact('ИО-2', 'corr', { newValue: 540000, basis: 'Опечатка в акте' }, 'spec');
  ck('исправление требует основания', !IM.addFact('ИО-2', 'corr', { newValue: 540000 }, 'spec').ok);
  ck('исправление ждёт второго ключа', r.ok && r.pending, r.why);
  ck('до публикации стоимость прежняя', IM.objValue('ИО-2') === 500000);
  IM.publish(r.fact.id, 'head');
  ck('стоимость исправлена', IM.objValue('ИО-2') === 540000);
  const n = IM.neighbours('ИО-2').payments.join(' ');
  ck('Платежи: корректировка суммы, не сторно', has(n, 'корректировка суммы') && !has(n, 'сторно поступления'), n);
  ck('оба факта видны: исходный (oldValue) и исправление (newValue)', r.fact.oldValue === 500000 && r.fact.newValue === 540000 && IM.obj('ИО-2').facts.length === JSON.parse(before).length + 1);
  ck('ИИ-12: прежние факты не изменены', JSON.stringify(IM.obj('ИО-2').facts.slice(0, JSON.parse(before).length)) === before);
});

group('С-19: правка черновика позиции без решения', ({ IM }) => {
  ck('сид: по П-3 решения нет', !IM.offer('П-3').facts.some(f => f.t === 'decision'));
  ck('правка свободна', IM.editPosition('П-3', 1, { value: 800000 }).ok && IM.offer('П-3').positions[0].value === 800000);
  ck('после решения органа правка закрыта (П-1)', !IM.editPosition('П-1', 1, { value: 1 }).ok);
  ck('добавление позиции после решения закрыто (П-1)', !IM.addPosition('П-1', { name: 'x', value: 1 }).ok);
});

group('С-20: стоимость в KGS, кредит в USD', ({ IM }) => {
  ck('сид: кредит поручителя в USD', IM.OBL.find(o => o.id === 'o_z').credits[0].ccy === 'USD');
  ck('ИИ-18: учётная стоимость объекта в KGS', IM.obj('ИО-4').ccy === 'KGS');
  const p = IM.neighbours('ИО-4').payments[0];
  ck('в Платежи уходит KGS (сумма в сомах)', has(p, 'сом') && digits(p).includes(String(IM.objValue('ИО-4'))), p);
  ck('модуль курса не спрашивает: нет курса/конвертера в API и в тексте', !Object.keys(IM).some(k => /rate|kurs|convert/i.test(k)) && !has(p, 'курс по'), p);
});

group('С-21: продажа объекта ниже стоимости принятия', ({ IM }) => {
  const before = JSON.stringify(IM.allocation('o_x', '2027-04-06'));
  const debt = IM.OBL.find(o => o.id === 'o_x').debt;
  const r = IM.result('ИО-1');
  ck('результат по объекту отрицательный: −240 000', r.result === -240000 && r.result < 0, r);
  ck('долг должника не изменился', IM.OBL.find(o => o.id === 'o_x').debt === debt);
  IM.addFact('ИО-1', 'expense', { item: 'Охрана', amount: 10000, ccy: 'KGS', doc: 'д' });
  ck('ИИ-19: расход после перехода права не меняет делёж/долг', JSON.stringify(IM.allocation('o_x', '2027-04-06')) === before);
});

group('С-22: вводный остаток', ({ IM }) => {
  const m0 = IM.migrationControl();
  const r = IM.addIntro({ name: 'Склад', kind: 'store', value: 100000, transfer: '2024-01-10', obligor: 'o_t', doc: 'Ведомость' });
  ck('вводный остаток заведён', r.ok, r.why);
  ck('объект «на учёте»', IM.objState(r.id).code === 'onbook');
  ck('погашение не порождается (нет в делёжке)', !IM.allocation('o_t').rows.some(x => x.id === r.id));
  ck('Платежи: «погашения не порождает»', has(IM.neighbours(r.id).payments.join(' '), 'погашения не порождает'));
  ck('ИИ-3: доплаты по вводному нет', IM.topupOf(r.id) === null && !IM.flags(r.id).incomplete);
  ck('контроль миграции до ввода: «Токмок-Строй» и Бакиров сходятся', m0.filter(x => x.obl !== 'o_kd').every(x => x.ok), m0);
  // в сиде Кадыров расходится намеренно (демо блокирующего отчёта: ИО-9 650 000 против 600 000)
  ck('контроль ловит расхождение (Кадыров, демо-сид)', m0.find(x => x.obl === 'o_kd').ok === false, m0.find(x => x.obl === 'o_kd'));
  const m1 = IM.migrationControl();
  ck('вводный остаток, не подтверждённый миграцией (+100 000), ломает сходимость «Токмок-Строй»', m1.find(x => x.obl === 'o_t').ok === false);
});

group('С-23: акт без второго ключа', ({ IM, doc }) => {
  const pf = IM.pending().find(x => x.f.t === 'act' && x.owner === 'П-7');
  ck('акт ждёт второго ключа', !!pf && !pf.f.pub);
  ck('объекта ИО-6 нет', !IM.obj('ИО-6'));
  ck('позиция: «акт ждёт второго ключа»', IM.posOutcome('П-7', 2).sub === 'акт ждёт второго ключа');
  ck('соседи: во Взыскании нет акта и перехода права ИО-6', !IM.caseJournal('o_s').some(r => has(r.text, 'ИО-6')) && !IM.allocation('o_s').rows.some(r => r.id === 'ИО-6'));
  ck('не-начальник не публикует', ['spec', 'sec', 'lawyer', 'acc'].every(role => !IM.publish(pf.f.id, role).ok));
  IM.setRole('spec'); IM.go('offers');
  ck('UI (spec): кнопки публикации нет', !doc.querySelector(`[data-testid=publish-${pf.f.id}]`));
  IM.setRole('head'); IM.go('offers');
  ck('UI (head): кнопка публикации есть', !!doc.querySelector(`[data-testid=publish-${pf.f.id}]`));
  IM.publish(pf.f.id, 'head');
  ck('после публикации объект ИО-6 возникает', IM.objState('ИО-6').code === 'wait');
});

group('С-24: срок ответа истёк', ({ IM }) => {
  const t = IM.triggers().find(x => x.kind === 'pk-im-offer-overdue' && x.id === 'П-3');
  ck('повод pk-im-offer-overdue по П-3', !!t);
  ck('адресован куратору', t && t.to === IM.curatorOf('П-3').emp, t);
  const r = IM.addFact('П-3', 'decision', { organ: IM.ORGANS[0], doc: 'Реш. 9/2028', items: { 1: { v: 'accept' } } }, 'sec');
  ck('решение после срока вносится', r.ok, r.why);
  ck('с пометкой «после срока»', r.fact && r.fact.late === true, r.fact);
  ck('повод после ответа гаснет', !IM.triggers().some(x => x.kind === 'pk-im-offer-overdue' && x.id === 'П-3'));
});

group('С-25: куратор объекта на дату', ({ IM }) => {
  ck('на 01.10.2027 — Абдраимова Н.К. (закрепление)', IM.curatorOf('ИО-1', '2027-10-01').emp === 'Абдраимова Н.К.', IM.curatorOf('ИО-1', '2027-10-01'));
  ck('сегодня — Токтосунов Б.Э. (другое закрепление)', IM.curatorOf('ИО-1').emp === 'Токтосунов Б.Э.', IM.curatorOf('ИО-1'));
  ck('ответ несёт основание закрепления', !!IM.curatorOf('ИО-1').why);
  ck('ИИ-16: у объекта и предложения нет поля «ответственный»', ![...Object.keys(IM.obj('ИО-1')), ...Object.keys(IM.offer('П-1'))].some(k => /respons|curator|owner|ответств|куратор/i.test(k)));
});

group('С-26: журнал дела взыскания', ({ IM }) => {
  const j = IM.caseJournal('o_x');
  ck('меры-проекции модуля видны (предложение, решение, акт, переход права)', ['зарегистрировано', 'Решение органа', 'Акт приёма-передачи ИО-1', 'Переход права ИО-1'].every(s => j.some(r => has(r.text, s) && r.own)), j.map(r => r.text));
  ck('собственные меры Взыскания тоже видны', j.some(r => !r.own));
  ck('продажи объекта Фондом в деле нет', !j.some(r => /продаж|купли|попытк|рассрочк|Бейшеналиев|КП-/i.test(r.text)), j.map(r => r.text));
  j[0].text = 'ИСПОРЧЕНО';
  ck('не правятся: правка копии не меняет журнал', IM.caseJournal('o_x')[0].text !== 'ИСПОРЧЕНО');
  ck('API правки журнала отсутствует', !Object.keys(IM).some(k => /editJournal|setJournal|caseEdit/i.test(k)));
});

group('С-27: акт на квартиру 12.03, отчуждатель уклоняется, решение органа 15.05', ({ IM }) => {
  const d = '2028-05-15';
  ck('сид: ИО-5 — квартира, ждёт регистрации', IM.obj('ИО-5').kind === 'flat' && IM.objState('ИО-5').code === 'wait');
  ck('причина обязательна', !IM.addFact('ИО-5', 'terminate', { doc: 'Реш.', date: d }).ok);
  const r = IM.addFact('ИО-5', 'terminate', { doc: 'Решение органа', reason: IM.TERM_REASONS[0], date: d });
  ck('введено, но ждёт второго ключа', r.ok && r.pending, r.why);
  ck('без второго ключа не опубликовано: состояние прежнее', IM.objState('ИО-5', d).code === 'wait');
  ck('вторым ключом может только начальник', !IM.publish(r.fact.id, 'spec').ok);
  IM.publish(r.fact.id, 'head');
  const st = IM.objState('ИО-5', d);
  ck('«принятие не состоялось», причина сохранена', st.code === 'failed' && st.label === 'принятие не состоялось' && has(st.reason, 'уклоняется'), st);
  ck('погашения нет', !IM.allocation('o_s', d).rows.some(x => x.id === 'ИО-5'));
  const p = IM.neighbours('ИО-5', d).payments.join(' ');
  ck('сторно нет', has(p, 'сторно нет') && !has(p, 'сторно поступления'), p);
  ck('ИИ-20: «выбытие», «возврат» и «безвозмездная передача» недоступны', ['loss', 'ret', 'gift'].every(t => !IM.gate('ИО-5', t, d).ok));
  ck('ИИ-20: причина «иное» без пояснения — отказ', !IM.addFact('ИО-5', 'terminate', { doc: 'д', reason: IM.TERM_REASONS[3] }).ok);
});

group('С-28: вещь погибла до регистрации', ({ IM }) => {
  const g = IM.gate('ИО-5', 'loss');
  ck('путь «выбытие» недоступен до перехода права', !g.ok, g);
  ck('текст отсылает к прекращению принятия', has(g.why, 'прекращени'), g.why);
  const r = key(IM, 'ИО-5', 'terminate', { doc: 'Решение органа', reason: IM.TERM_REASONS[1] }, 'spec');
  ck('прекращение с причиной «погибла» принято', r.ok, r.why);
  const st = IM.objState('ИО-5');
  ck('«принятие не состоялось» с причиной «погибла»', st.code === 'failed' && has(st.reason, 'погибла'), st);
  ck('«выбытие» остаётся недоступным', !IM.gate('ИО-5', 'loss').ok);
});

group('С-29: решение «принять» 20.02, на 31-й день акта нет', ({ IM }) => {
  // в сиде П-5: решение 10.02.2028, акта нет
  ck('день 30 (11.03): повода нет', !IM.triggers('2028-03-11').some(x => x.kind === 'pk-im-act-pending' && x.id.startsWith('П-5')));
  const t = IM.triggers('2028-03-12').filter(x => x.kind === 'pk-im-act-pending' && x.id.startsWith('П-5'));
  ck('день 31 (12.03): повод по обеим позициям П-5', t.length === 2, t);
  ck('адресован куратору предложения', t.every(x => x.to === IM.curatorOf('П-5', '2028-03-12').emp), t.map(x => x.to));
  const w = IM.addFact('П-5', 'withdraw', { pos: 1, doc: 'Письмо источника' });
  ck('выход 1: отзыв (акта нет)', w.ok, w.why);
  const tm = IM.addFact('П-5', 'terminate', { pos: 2, doc: 'Решение органа', reason: IM.TERM_REASONS[0] });
  ck('выход 2: прекращение принятия', tm.ok, tm.why);
});
group('С-29б: выход «акт» гасит повод', ({ IM }) => {
  const a = key(IM, 'П-5', 'act', { pos: 1, doc: 'Акт 1/28' }, 'spec');
  ck('акт введён и опубликован', a.ok, a.why);
  ck('повод по поз. 1 погас', !IM.triggers().some(x => x.kind === 'pk-im-act-pending' && x.id === 'П-5 · поз. 1'));
});

group('С-30: долг 1 000 000, трактор 500 000 (акт 15.03), квартира 700 000 (переход права 01.06)', ({ IM, doc }) => {
  const e = IM.expectedTopups('П-2');
  ck('ожидаемая доплата: трактор 0', e.rows[1].topup === 0, e.rows);
  ck('ожидаемая доплата: квартира 200 000', e.rows[2].topup === 200000, e.rows);
  ck('на 15.03 не вошло 0', sum(IM.allocation('o_b', '2027-03-15').rows.map(r => r.notIncluded)) === 0);
  ck('на 01.06 не вошло 200 000', sum(IM.allocation('o_b', '2027-06-01').rows.map(r => r.notIncluded)) === 200000);
  ck('⚑ только на квартире (ИО-3), не на тракторе (ИО-2)', IM.flags('ИО-3').incomplete && IM.flags('ИО-3').incomplete.amount === 200000 && IM.flags('ИО-2').incomplete === null);
  ck('ИМ-43: на 15.03 ⚑ на тракторе нет', IM.flags('ИО-2', '2027-03-15').incomplete === null);
  IM.openOffer('П-2');
  ck('UI: exp-topup-1 = 0', digits(doc.querySelector('[data-testid=exp-topup-1]').textContent) === '0', doc.querySelector('[data-testid=exp-topup-1]').textContent);
  ck('UI: exp-topup-2 = 200 000', digits(doc.querySelector('[data-testid=exp-topup-2]').textContent) === '200000', doc.querySelector('[data-testid=exp-topup-2]').textContent);
});

group('С-31: две принятые позиции с одной датой перехода права', ({ IM }) => {
  const e = IM.expectedTopups('П-5');
  ck('ожидаемая доплата по номеру: поз.1 — 0, поз.2 — 200 000', e.rows[1].topup === 0 && e.rows[2].topup === 200000, e.rows);
  // акты в обратном порядке (поз.2 раньше), чтобы порядок не совпал с порядком объектов
  const a2 = key(IM, 'П-5', 'act', { pos: 2, doc: 'Акт 2/28' }, 'spec');
  const a1 = key(IM, 'П-5', 'act', { pos: 1, doc: 'Акт 1/28' }, 'spec');
  ck('оба акта опубликованы', a1.ok && a2.ok, [a1.why, a2.why]);
  const o1 = IM.posOutcome('П-5', 1).obj, o2 = IM.posOutcome('П-5', 2).obj;
  ck('объекты возникли: поз.2 раньше поз.1 по номеру ИО', o1 && o2 && o2 < o1, [o1, o2]);
  [o2, o1].forEach(id => { if (IM.objState(id).code === 'wait') key(IM, id, 'reg', { doc: 'Выписка', date: '2028-03-20' }, 'spec'); });
  const d = '2028-03-20';
  const rows = IM.allocation('o_m', d).rows;
  ck('одна дата перехода права у обоих', rows.length === 2 && rows[0].date === rows[1].date, rows);
  ck('порядок деления — по номеру позиции (поз.1 раньше)', rows[0].id === o1 && rows[1].id === o2, rows.map(r => r.id));
  ck('доплата на поз.2: 200 000, на поз.1: 0', rows[0].notIncluded === 0 && rows[1].notIncluded === 200000, rows);
});

/* ============================== §14 ============================== */

group('ИИ-1: объект — только из принятой позиции актом или вводом остатка', ({ IM }) => {
  ck('каждый объект: опубликованный акт, вводный остаток или часть разделения', IM.OBJECTS.every(o => o.parent || o.facts.some(f => f.t === 'intro') || IM.offer(o.offer).facts.some(f => f.t === 'act' && f.pos === o.pos && f.pub)), IM.OBJECTS.map(o => o.id));
  ck('у отозванной/отказанной позиции объекта нет', !IM.OBJECTS.some(o => o.offer === 'П-1' && o.pos !== 1));
  ck('акт по непринятой позиции — отказ', !IM.addFact('П-1', 'act', { pos: 3, doc: 'x' }).ok && !IM.addFact('П-1', 'act', { pos: 2, doc: 'x' }).ok);
  ck('акт по позиции без решения — отказ', !IM.addFact('П-3', 'act', { pos: 1, doc: 'x' }).ok);
});

group('ИИ-4: учётная стоимость не меняется ни оценкой, ни расходом', ({ IM }) => {
  const v0 = IM.objValue('ИО-1');
  IM.addFact('ИО-1', 'appraisal', { appraiser: 'А', amount: 3000000, ccy: 'KGS', doc: 'Отчёт' });
  IM.addFact('ИО-1', 'expense', { item: 'Налог', amount: 5000, ccy: 'KGS', doc: 'д' });
  ck('стоимость = стоимости принятия 2 400 000', v0 === 2400000 && IM.objValue('ИО-1') === 2400000);
});

group('ИИ-5: модуль не делит суммы между кредитами', ({ IM }) => {
  const rows = IM.allocation('o_x', '2027-04-06').rows;
  ck('в ответе делёжки нет разбивки по кредитам', rows.every(r => !('credits' in r) && !('byCredit' in r)), Object.keys(rows[0]));
  ck('делёжка — «ответ Взыскания» (текст у соседей)', has(IM.neighbours('ИО-1', '2027-04-06').collection.join(' '), 'Распределено между кредитами'));
});

group('ИИ-6: деньги проходят только через Платежи', ({ IM }) => {
  ck('поступление по договору вводит только бухгалтер (Платежи)', ['spec', 'sec', 'lawyer', 'head'].every(r => !IM.addFact('ИО-8', 'payment', { amount: 1 }, r).ok));
  ck('Возврат доплаты и покупателю — распоряжения в Платежи', has(IM.neighbours('ИО-1', '2027-04-10').payments.join(' '), 'Распоряжение на Возврат'));
});

group('ИИ-7: путь выбытия берёт объект целиком; не больше одного пути', ({ IM }) => {
  const r = key(IM, 'ИО-2', 'gift', { doc: 'Решение органа и акт' }, 'spec');
  ck('безвозмездная передача проходит', r.ok, r.why);
  ck('объект снят с учёта путём «безвозмездная передача»', IM.objState('ИО-2').code === 'removed' && IM.objState('ИО-2').pathId === 'gift', IM.objState('ИО-2'));
  ck('второй путь (loss, ret, gift, split) закрыт', ['loss', 'ret', 'gift', 'split'].every(t => !IM.gate('ИО-2', t).ok));
  ck('снятия с учёта вручную нет в API', !Object.keys(IM).some(k => /^(remove|unregister|writeOff)/i.test(k)));
});

group('ИИ-9: продажа невозможна до перехода права и при ⚑', ({ IM }) => {
  ck('ждёт регистрации (ИО-5): попытка недоступна', !IM.gate('ИО-5', 'attempt').ok);
  ck('⚑ «не завершено» (ИО-3): попытка недоступна', !IM.gate('ИО-3', 'attempt').ok && has(IM.gate('ИО-3', 'attempt').why, 'принятие не завершено'));
  ck('чистый объект на учёте (ИО-2): попытка доступна', IM.gate('ИО-2', 'attempt').ok);
});

group('ИИ-13: обязанное лицо и отчуждатель — разные реквизиты', ({ IM }) => {
  const f = IM.offer('П-7');
  ck('залогодатель: обязанное лицо ≠ отчуждатель', IM.OBL.find(o => o.id === f.obligor).name !== f.alien);
  ck('у предложения оба реквизита', f.obligor && f.alien && f.alienKind);
  const r = IM.registerOffer({ source: 'third', obligor: 'o_i', alien: 'Иманов Ж.', docNo: '1', docDate: '2028-03-01', name: 'Дом', value: 100 }, 'spec');
  ck('регистрация предложения хранит отчуждателя отдельно', r.ok && IM.offer(r.id).alien === 'Иманов Ж.' && IM.offer(r.id).obligor === 'o_i');
});

group('ИИ-14: итоги выносят строго определённые субъекты', ({ IM }) => {
  ck('решение — только секретарь органа', ['spec', 'head', 'lawyer', 'acc'].every(r => !IM.addFact('П-3', 'decision', { organ: 'К', doc: 'd', items: { 1: { v: 'reject', reason: 'x' } } }, r).ok));
  ck('«отказана» требует основания', !IM.addFact('П-3', 'decision', { organ: 'К', doc: 'd', items: { 1: { v: 'reject' } } }, 'sec').ok);
  ck('решение одно на предложение', !IM.addFact('П-1', 'decision', { organ: 'К', doc: 'd', items: { 1: { v: 'accept' } } }, 'sec').ok);
  ck('«принятие не состоялось» — только прекращение с причиной (без причины отказ)', !IM.addFact('П-5', 'terminate', { pos: 1, doc: 'd' }).ok);
});

group('ИИ-15: ключевые факты публикуются вторым ключом', ({ IM, doc }) => {
  const ins = IM.addFact('ИО-2', 'inspection', { who: 'А', cond: 'ok', doc: 'д' });
  ck('осмотр (денег не движет) публикуется сразу', ins.ok && ins.fact.pub === true && !ins.pending);
  ['split', 'gift', 'loss', 'corr'].forEach(t => {
    const target = t === 'split' ? 'ИО-410' : 'ИО-2';
    const data = { doc: 'д', parts: [60, 60], newValue: 510000, basis: 'б' };
    const r = IM.addFact(target, t, data, 'spec');
    ck(`${t}: готовится специалистом → не опубликован`, r.ok && r.pending && !r.fact.pub, r.why);
    if (r.ok) IM.rejectPending(r.fact.id, 'head');
  });
  const c = IM.addFact('ИО-2', 'corr', { newValue: 510000, basis: 'б' }, 'head');
  ck('сам подготовивший не ставит второй ключ', c.ok && !IM.publish(c.fact.id, 'head').ok, c.why);
  ck('payment/topup (контур Платежей) без второго ключа', IM.addFact('ИО-8', 'payment', { amount: 1 }, 'acc').fact.pub === true);
  IM.setRole('spec'); IM.go('objects'); IM.openObject('ИО-2', 'char');
  const bt = doc.querySelector('[data-testid=act-ret]');
  ck('UI (spec): кнопка «Возврат по суду» помечена 🔑', bt && bt.textContent.includes('🔑'), bt && bt.textContent);
});

group('ИИ-12: опубликованный факт не правится — только замещающий', ({ IM }) => {
  const acts = IM.obj('ИО-1').facts.filter(f => f.pub).map(f => JSON.stringify(f));
  IM.addFact('ИО-1', 'corr', { newValue: 2300000, basis: 'б' }, 'spec');
  ck('в API нет правки/удаления опубликованных фактов', !Object.keys(IM).some(k => /^(editFact|updateFact|deleteFact|removeFact)/i.test(k)));
  ck('rejectPending не удаляет опубликованное', !IM.rejectPending(IM.obj('ИО-1').facts.find(f => f.pub).id, 'head').ok);
  ck('опубликованные факты на месте', JSON.stringify(IM.obj('ИО-1').facts.filter(f => f.pub)) === '[' + acts.join(',') + ']');
});

group('ИИ-20: до перехода права выход только «принятие не состоялось»', ({ IM }) => {
  const n0 = IM.allocation('o_s').rows.length;
  ck('после акта до регистрации (ИО-5): terminate доступен, прочие пути закрыты', IM.gate('ИО-5', 'terminate').ok && ['loss', 'ret', 'gift', 'split'].every(t => !IM.gate('ИО-5', t).ok));
  ck('для принятой позиции без акта (П-5) — тоже terminate, не withdraw после акта', IM.addFact('П-5', 'terminate', { pos: 1, doc: 'д', reason: IM.TERM_REASONS[2] }).ok);
  ck('деньги/сторно не порождаются', IM.allocation('o_s').rows.length === n0);
});

group('UI: гейтинг кнопок и ошибки форм', ({ IM, doc }) => {
  IM.setRole('spec'); IM.openObject('ИО-1', 'char');
  const ret = doc.querySelector('[data-testid=act-ret]');
  ck('act-ret отключена, data-why = «Объект продан…»', ret && ret.disabled && ret.dataset.why === IM.RETURN_SOLD, ret && ret.dataset.why);
  const att = doc.querySelector('[data-testid=act-attempt]');
  ck('act-attempt отключена с причиной', att && att.disabled && !!att.dataset.why);
  const pay = doc.querySelector('[data-testid=act-payment]');
  ck('act-payment для специалиста отключена: «роль: …»', pay && pay.disabled && has(pay.dataset.why, 'роль'), pay && pay.dataset.why);
  IM.setRole('acc'); IM.openObject('ИО-1', 'char');
  ck('роль бухгалтер: act-payment активна', !doc.querySelector('[data-testid=act-payment]').disabled);
  IM.setRole('spec'); IM.openObject('ИО-2', 'char');
  ck('ИО-2 на учёте: act-attempt активна', !doc.querySelector('[data-testid=act-attempt]').disabled);
  IM.setRole('sec'); IM.uiDecision('П-3');
  const r = IM.submitForm({});
  ck('форма без обязательных полей — ошибка form-err', !r.ok && !!doc.querySelector('[data-testid=form-err]'));
  IM.closeForm();
  IM.openObject('ИО-1', 'char'); IM.setAsOf('2027-04-10');
  ck('UI: флаг flag-incomplete на ИО-1 на 10.04.2027', !!doc.querySelector('[data-testid=flag-incomplete]'));
  IM.openObject('ИО-7', 'char'); IM.setAsOf('2028-03-15');
  ck('UI: флаг flag-encumbered на ИО-7 (аренда)', !!doc.querySelector('[data-testid=flag-encumbered]'));
  IM.go('settings');
  ck('UI: настройки показывают повод trig-pk-im-offer-overdue', !!doc.querySelector('[data-testid=trig-pk-im-offer-overdue]'));
});

group('Прогон без ошибок скрипта: все экраны и формы', ({ IM, errs }) => {
  ck('загрузка без ошибок', errs.length === 0, errs);
  ['offers', 'objects', 'contracts', 'settings'].forEach(v => IM.go(v));
  IM.OFFERS.forEach(o => IM.openOffer(o.id));
  IM.OBJECTS.forEach(o => ['char', 'transfer', 'insp', 'appr', 'exp', 'enc', 'att', 'ctr', 'out', 'log'].forEach(tb => IM.openObject(o.id, tb)));
  ['reg', 'attempt', 'contract', 'cterm', 'payment', 'topup', 'split', 'gift', 'loss', 'ret', 'corr', 'inspection', 'appraisal', 'expense', 'encumbrance', 'priceDecision', 'attemptResult', 'claim', 'regRefusal', 'terminate']
    .forEach(t => { IM.uiFact('ИО-1', t); IM.closeForm(); });
  IM.uiDecision('П-3'); IM.closeForm(); IM.uiNewOffer(); IM.closeForm(); IM.uiIntro(); IM.closeForm();
  ck('рендер экранов/форм без ошибок', errs.length === 0, errs);
});

/* ====================== правки после ревью ====================== */

group('Гейты: выбытие и возврат при идущей попытке; передача и разделение — нет', ({ IM, doc }) => {
  ck('ИО-4 выставлен на продажу', IM.objState('ИО-4').code === 'listed', IM.objState('ИО-4'));
  const gl = IM.gate('ИО-4', 'loss'), gr = IM.gate('ИО-4', 'ret');
  ck('loss при «выставлен на продажу» разрешён', gl.ok, gl.why);
  ck('ret при «выставлен на продажу» разрешён', gr.ok, gr.why);
  ck('объяснение: попытка закроется итогом «не состоялась»', has(gl.why, 'не состоялась') && has(gr.why, 'не состоялась'), gl.why);
  const gg = IM.gate('ИО-4', 'gift');
  ck('gift при идущей попытке запрещён с причиной', !gg.ok && has(gg.why, 'попытка'), gg.why);
  IM.setRole('spec'); IM.openObject('ИО-4', 'char');
  const b = doc.querySelector('[data-testid=act-loss]');
  ck('UI: act-loss активна и data-why объясняет закрытие попытки', b && !b.disabled && has(b.dataset.why, 'не состоялась'), b && b.dataset.why);
  const bg = doc.querySelector('[data-testid=act-gift]');
  ck('UI: act-gift отключена', bg && bg.disabled && has(bg.dataset.why, 'попытка'), bg && bg.dataset.why);
  const r = key(IM, 'ИО-4', 'loss', { doc: 'Акт о гибели', cause: 'Гибель' }, 'spec');
  ck('выбытие опубликовано вторым ключом', r.ok, r.why);
  const st = IM.objState('ИО-4');
  ck('объект снят с учёта путём «выбытие»', st.code === 'removed' && st.pathId === 'loss', st);
  const at = IM.attempts('ИО-4');
  ck('идущая попытка закрыта итогом «не состоялась»', at.length === 1 && at[0].res && at[0].res.v === 'failed' && !at[0].open, at.map(x => x.res));
  ck('второй путь после выбытия закрыт', ['ret', 'gift', 'loss'].every(t => !IM.gate('ИО-4', t).ok));
});

group('Гейты: разделение при идущей попытке запрещено, возврат — разрешён', ({ IM }) => {
  const ap = IM.obj('ИО-410').facts.find(f => f.t === 'appraisal');
  const a = IM.addFact('ИО-410', 'attempt', { start: 1440000, basis: ap.id, method: 'Аукцион', platform: 'п', encMark: 'продаётся с обременением' }, 'spec');
  ck('попытка по зерну открыта', a.ok && IM.objState('ИО-410').code === 'listed', a.why);
  const gs = IM.gate('ИО-410', 'split');
  ck('split при идущей попытке запрещён с причиной', !gs.ok && has(gs.why, 'попытка'), gs.why);
  ck('ret при идущей попытке разрешён', IM.gate('ИО-410', 'ret').ok);
  const r = key(IM, 'ИО-410', 'ret', { doc: 'Решение суда' }, 'spec');
  ck('возврат опубликован; путь «возврат»; попытка закрыта', r.ok && IM.objState('ИО-410').pathId === 'ret' && IM.attempts('ИО-410').every(x => !x.open), r.why);
});

group('Даты ДД.ММ.ГГГГ, субъекты из списка, валюта документа, тексты', ({ IM, doc }) => {
  ck('нет полей type=date', !doc.querySelector('input[type=date]'));
  ck('дата среза в шапке — ДД.ММ.ГГГГ', doc.querySelector('[data-testid=as-of]').value === '15.03.2028', doc.querySelector('[data-testid=as-of]').value);
  IM.setAsOf('01.10.2027');
  ck('setAsOf принимает ДД.ММ.ГГГГ', IM.S.asOf === '2027-10-01', IM.S.asOf);
  ck('неверная дата не меняет срез', !IM.setAsOf('31.02.2027').ok && IM.S.asOf === '2027-10-01');
  IM.setAsOf('15.03.2028');
  IM.setRole('spec'); IM.openObject('ИО-2', 'char'); IM.uiFact('ИО-2', 'inspection');
  const bad = IM.submitForm({ date: '2028/03/15', who: 'А', cond: 'хорошее', doc: 'Акт' });
  ck('дата не в формате ДД.ММ.ГГГГ — ошибка в form-err', !bad.ok && has(bad.why, 'ДД.ММ.ГГГГ') && !!doc.querySelector('[data-testid=form-err]'), bad.why);
  const good = IM.submitForm({ date: '10.03.2028', who: 'А', cond: 'хорошее', doc: 'Акт' });
  ck('дата ДД.ММ.ГГГГ принята и сохранена в ISO', good.ok && good.fact.date === '2028-03-10', good.why || good.fact);
  IM.uiNewOffer();
  ck('отчуждатель — выбор из списка субъектов', doc.getElementById('ff_alien').tagName === 'SELECT');
  ck('у позиции есть валюта документа (KGS/USD/EUR)', ['KGS', 'USD', 'EUR'].every(c => !!doc.querySelector(`#ff_ccy option[value=${c}]`)));
  IM.closeForm();
  IM.uiFact('ИО-2', 'appraisal');
  ck('у оценки есть поле валюты', !!doc.getElementById('ff_ccy')); IM.closeForm();
  IM.uiFact('ИО-2', 'expense');
  ck('у расхода есть поле валюты', !!doc.getElementById('ff_ccy')); IM.closeForm();
  const e = IM.addFact('ИО-2', 'expense', { item: 'Охрана', amount: 100, ccy: 'USD', doc: 'п/п' });
  ck('расход в USD хранится в валюте документа', e.ok && e.fact.ccy === 'USD' && has(IM.money(e.fact.amount, e.fact.ccy), 'USD'), e.fact);
  ck('расход в другой валюте не складывается в результат', IM.result('ИО-2').expenses === 0 && IM.result('ИО-2').expOther.length === 1, IM.result('ИО-2'));
  ck('П-1: срок ответа 15.01.2027 (5 р.д. от 10.01)', IM.offer('П-1').deadline === '2027-01-15');
  ck('пороги поводов — источник «внутренний акт»', IM.SETTINGS.thr.every(t => t.src === 'внутренний акт'));
  IM.go('settings');
  const txt = doc.getElementById('panel').textContent;
  ck('в интерфейсе нет технических id поводов (только в подсказке)', !/pk-im-/.test(txt));
  ck('в интерфейсе нет ISO-дат', !/\d{4}-\d{2}-\d{2}/.test(txt));
  IM.openOffer('П-1');
  const t2 = doc.getElementById('panel').textContent;
  ck('кредиты подписаны в сомах', has(t2, 'К-1 (сом)') && !has(t2, '(KGS)'));
  ck('нет «проекция модуля по имуществам»', !has(t2, 'проекция модуля'));
  IM.openObject('ИО-1', 'att');
  const t3 = doc.getElementById('panel').textContent;
  ck('блок «Что видят Платежи, Взыскание, Залог»', has(t3, 'Что видят Платежи, Взыскание, Залог') && !has(t3, 'соседи'));
  ck('«Разделение» — отдельная группа, не в «Выбытии»', [...doc.querySelectorAll('.fgroup')].some(g => g.querySelector('.gname').textContent === 'Разделение' && !!g.querySelector('[data-testid=act-split]'))
    && ![...doc.querySelectorAll('.fgroup')].some(g => g.querySelector('.gname').textContent === 'Выбытие' && !!g.querySelector('[data-testid=act-split]')));
  ck('нет дубля «Отчёт оценщика Отчёт»', !has(doc.body.innerHTML, 'Отчёт оценщика Отчёт') && !has(doc.body.innerHTML, 'отчёт оценщика Отчёт'));
  IM.go('objects');
  ck('фильтры реестра объектов: дней на учёте, куратор на дату', !!doc.querySelector('[data-testid=f-bDays]') && !!doc.querySelector('[data-testid=f-bCur]'));
  IM.setF('bDays', '730');
  ck('фильтр «больше 730 дней» оставляет только давние объекты', [...doc.querySelectorAll('[data-testid^=object-row-]')].map(r => r.dataset.testid).every(id => ['object-row-ИО-7', 'object-row-ИО-8', 'object-row-ИО-9'].includes(id)));
  IM.setF('bDays', ''); IM.setF('bCur', 'Кадыров Т.Ы.');
  ck('фильтр по куратору на дату (Ошская обл.: ИО-410 и ИО-12)', [...doc.querySelectorAll('[data-testid^=object-row-]')].map(r => r.dataset.testid).sort().join() === ['object-row-ИО-12', 'object-row-ИО-410'].sort().join(),
    [...doc.querySelectorAll('[data-testid^=object-row-]')].map(r => r.dataset.testid));
  IM.setF('bCur', '');
  ck('контроль миграции: расхождение подписано как учебный пример', has(doc.querySelector('[data-testid=migration-control]').textContent, 'учебный пример'));
  IM.go('offers');
  ck('фильтры реестра предложений: обязанное лицо, орган', !!doc.querySelector('[data-testid=f-oObl]') && !!doc.querySelector('[data-testid=f-oOrgan]'));
  IM.setF('oObl', 'o_x');
  ck('фильтр по обязанному лицу', [...doc.querySelectorAll('[data-testid^=offer-row-]')].length === 1 && !!doc.querySelector('[data-testid="offer-row-П-1"]'));
  IM.setF('oObl', ''); IM.setF('oOrgan', 'Правление');
  ck('фильтр по органу: решений Правления нет', [...doc.querySelectorAll('[data-testid^=offer-row-]')].length === 0);
});

group('Покупатель в договоре КП — из списка субъектов', ({ IM, doc }) => {
  const ap = IM.obj('ИО-2').facts.find(f => f.t === 'inspection');
  const a = IM.addFact('ИО-2', 'appraisal', { appraiser: 'О', amount: 500000, doc: 'Отчёт № Т-1' }, 'spec');
  const at = IM.addFact('ИО-2', 'attempt', { start: 500000, basis: a.fact.id, method: 'Аукцион', platform: 'п' }, 'spec');
  const res = IM.addFact('ИО-2', 'attemptResult', { v: 'sold', buyer: 'Абдыкадыров М.С.', price: 520000 }, 'spec');
  ck('попытка состоялась', at.ok && res.ok, [at.why, res.why]);
  IM.setRole('lawyer'); IM.openObject('ИО-2', 'char'); IM.uiFact('ИО-2', 'contract');
  const sel = doc.getElementById('ff_buyer');
  ck('поле покупателя — список, выбран покупатель из итога', sel && sel.tagName === 'SELECT' && sel.value === 'Абдыкадыров М.С.', sel && sel.value);
  ck('у договора есть валюта документа', !!doc.getElementById('ff_ccy'));
});

/* ================= ИМ-44…ИМ-46 (С-32…С-34, ИИ-21) =================
   В сиде канонические П-1/ИО-1/ИО-2 сценария 32 — это П-8/ИО-11/ИО-12; ПР-1/ПР-2 сценариев 33–34 —
   П-9 (правило молчит) и П-8 (позиции в разных областях) + предложение без позиций, заведённое тестом. */

group('С-32: суд отменил раннее принятие после позднего — исправление поздней позиции', ({ IM, doc }) => {
  const before = IM.allocation('o_r', '2027-08-01');
  const r11 = before.rows.find(r => r.id === 'ИО-11'), r12 = before.rows.find(r => r.id === 'ИО-12');
  ck('до суда: трактор 500 000 распределён целиком (переход права 15.03.2027)', r11 && r11.date === '2027-03-15' && r11.distributed === 500000, r11);
  ck('до суда: квартира — распределено 500 000, не вошло 200 000 (01.06.2027)', r12 && r12.date === '2027-06-01' && r12.distributed === 500000 && r12.notIncluded === 200000, r12);
  ck('доплата 200 000 исполнена 20.06.2027 — ⚑ на квартире нет', !IM.flags('ИО-12', '2027-08-01').incomplete && IM.topupOf('ИО-12', '2027-08-01').done.date === '2027-06-20');
  const st11 = IM.objState('ИО-11');
  ck('10.09.2027 суд: трактор снят с учёта путём «возврат»', st11.code === 'removed' && st11.pathId === 'ret' && st11.date === '2027-09-10', st11);
  ck('сторно трактора в Платежах', IM.neighbours('ИО-11').payments.some(x => has(x, 'Сторно поступления')));
  const n = IM.reallocNeeded('ИО-12');
  ck('квартира ждёт исправления: распределено 500 000 → 700 000, не вошло 200 000 → 0, требование 200 000',
    n && n.oldDistributed === 500000 && n.distributed === 700000 && n.oldNotIncluded === 200000 && n.notIncluded === 0 && n.claim === 200000 && n.cause.includes('ИО-11'), n);
  IM.setRole('spec'); IM.openObject('ИО-12', 'char');
  ck('UI: подсказка «нужно пересчитать деление» на карточке', !!doc.querySelector('[data-testid=realloc-needed]'));
  const b = doc.querySelector('[data-testid=act-realloc]');
  ck('UI: кнопка пересчёта активна для специалиста', b && !b.disabled, b && b.dataset.why);
  ck('без основания исправление не вводится', !IM.addFact('ИО-12', 'realloc', {}, 'spec').ok);
  const r = IM.addFact('ИО-12', 'realloc', { doc: 'Решение суда № 2-418/27' }, 'spec');
  ck('исправление ждёт второго ключа', r.ok && r.pending, r.why);
  ck('до публикации деление не меняется', IM.allocation('o_r').rows.find(x => x.id === 'ИО-12').distributed === 500000);
  ck('публикует начальник Управления', IM.publish(r.fact.id, 'head').ok);
  const a = IM.allocation('o_r'); const q = a.rows.find(x => x.id === 'ИО-12');
  ck('ИО-12 исправлен: распределено 700 000, не вошло 0', q.distributed === 700000 && q.notIncluded === 0, q);
  ck('требование к отчуждателю 200 000', IM.topupOf('ИО-12').excess === 200000 && IM.neighbours('ИО-12').payments.some(x => has(x, 'Требование к отчуждателю') && digits(x).includes('200000')));
  ck('долг по обязанному лицу 300 000', a.rest === 300000, a.rest);
  ck('после исправления пересчитывать нечего', !IM.reallocNeeded('ИО-12') && !IM.gate('ИО-12', 'realloc').ok);
  IM.openOffer('П-8');
  ck('UI: в карточке предложения остаток долга 300 000', digits(doc.querySelector('[data-testid=offer-debt-rest]').textContent).startsWith('300000'));
  IM.openObject('ИО-12', 'char');
  ck('UI: требование к отчуждателю на карточке объекта', !!doc.querySelector('[data-testid=obj-claim]'));
});

group('ИИ-21: отмена принятия не правит опубликованное и не создаёт второго погашения', ({ IM }) => {
  ck('исправление вводит только специалист', !IM.addFact('ИО-12', 'realloc', { doc: 'd' }, 'lawyer').ok);
  ck('без отменённого раннего принятия исправление недоступно', !IM.gate('ИО-3', 'realloc').ok && !IM.gate('ИО-1', 'realloc').ok);
  const n0 = IM.obj('ИО-12').facts.length;
  const r = IM.addFact('ИО-12', 'realloc', { doc: 'Решение суда' }, 'spec');
  ck('публиковать специалисту нельзя', !IM.publish(r.fact.id, 'spec').ok);
  IM.publish(r.fact.id, 'head');
  const f = IM.obj('ИО-12').facts.slice(n0);
  ck('добавлен ровно один факт — исправление', f.length === 1 && f[0].t === 'realloc', f.map(x => x.t));
  ck('исправление датировано переходом права поздней вещи (01.06.2027)', f[0].date === '2027-06-01', f[0].date);
  ck('исходное деление видно в факте (500 000 / 200 000)', f[0].oldDistributed === 500000 && f[0].oldNotIncluded === 200000);
  ck('погашение у ИО-12 одно, дата перехода права прежняя', IM.allocation('o_r').rows.filter(x => x.id === 'ИО-12').length === 1 && IM.objState('ИО-12').transfer === '2027-06-01');
  const p12 = IM.neighbours('ИО-12').payments;
  ck('у поздней вещи — корректировка суммы поступления, не сторно', p12.some(x => has(x, 'Корректировка суммы поступления')) && !p12.some(x => /^Сторно/.test(x)), p12);
  ck('сторно — только у отменяемой вещи', IM.neighbours('ИО-11').payments.some(x => /^Сторно/.test(x)));
  ck('исправление видно во Взыскании', IM.caseJournal('o_r').some(x => has(x.text, 'Исправлено распределение ИО-12')));
});

group('С-33: куратора в ячейке нет — держит заведующий отделом до порога', ({ IM, doc }) => {
  ck('пороги в настройках: предложение 2 р.д., объект 10 р.д., «внутренний акт»',
    IM.SETTINGS.fallback.offer.v === 2 && IM.SETTINGS.fallback.object.v === 10 && IM.SETTINGS.fallback.offer.src === 'внутренний акт' && IM.SETTINGS.fallback.object.src === 'внутренний акт');
  const r = IM.registerOffer({ source: 'debtor', obligor: 'o_n', docNo: 'ПР-1', docDate: '2027-03-03', name: 'Мини-трактор', value: 100000, kind: 'equip', region: 'Баткенская обл.' }, 'spec');
  ck('предложение зарегистрировано 03.03.2027', r.ok, r.why);
  const c4 = IM.curatorOf(r.id, '2027-03-04'), c5 = IM.curatorOf(r.id, '2027-03-05');
  ck('держит заведующий отделом', c4.fallback && has(c4.emp, 'заведующий отделом'), c4);
  ck('04.03.2027 — порог не превышен', !c4.over, c4);
  ck('к 05.03.2027 (2 р.д.) порог превышен', c5.over && c5.deadline === '2027-03-05', c5);
  const o4 = IM.curatorOf('ИО-13', '2028-03-15'), o7 = IM.curatorOf('ИО-13', '2028-03-17');
  ck('объект по акту 03.03.2028: порог 10 р.д. — 17.03.2028', o4.deadline === '2028-03-17' && !o4.over && o7.over, [o4, o7]);
  IM.go('offers');
  ck('UI: реестр предложений подсвечивает П-9', !!doc.querySelector('[data-testid="curator-over-П-9"]'));
  IM.go('objects');
  ck('UI: ИО-13 сегодня не подсвечен', !doc.querySelector('[data-testid="curator-over-ИО-13"]'));
  IM.setAsOf('17.03.2028');
  ck('UI: 17.03.2028 ИО-13 подсвечен', !!doc.querySelector('[data-testid="curator-over-ИО-13"]'));
  IM.setAsOf('15.03.2028'); IM.go('settings');
  ck('UI: таблица порогов кураторства в настройках', !!doc.querySelector('[data-testid=fallback-limits]'));
  IM.setFb('offer', 30);
  ck('порог правится: при 30 р.д. П-9 больше не подсвечен', !IM.curatorOf('П-9').over);
});

group('С-34: куратор предложения — по позиции с наименьшим номером', ({ IM, doc }) => {
  const c = IM.curatorOf('П-8');
  ck('П-8: позиция 1 — трактор, Чуйская обл.; позиция 2 — квартира, Ошская обл.', IM.offer('П-8').positions[0].region === 'Чуйская обл.' && IM.offer('П-8').positions[1].region === 'Ошская обл.');
  ck('куратор П-8 — по Чуйской области и виду позиции 1', c.emp === 'Абдраимова Н.К.' && has(c.why, 'позиции 1') && has(c.why, 'Чуйская') && has(c.why, 'Трактор'), c);
  ck('объект из позиции 2 получает куратора по Ошской области', IM.curatorOf('ИО-12').emp === 'Кадыров Т.Ы.', IM.curatorOf('ИО-12'));
  const r = IM.registerOffer({ source: 'debtor', obligor: 'o_n', docNo: 'ПР-2', docDate: '2028-03-15' }, 'spec');
  ck('предложение без позиций регистрируется', r.ok && IM.offer(r.id).positions.length === 0, r.why);
  const c2 = IM.curatorOf(r.id);
  ck('без позиций — держит заведующий отделом', c2.fallback && has(c2.why, 'нет позиций'), c2);
  IM.openOffer('П-8');
  const w = IM.registerOffer({ source: 'debtor', obligor: 'o_n', docNo: 'ПР-3', docDate: '2028-03-15', name: 'Трактор', value: 100000, kind: 'tractor', region: 'Чуйская обл.' }, 'spec', true);
  ck('ИМ-46: предложение с позицией 1 зарегистрировано', w.ok && IM.offer(w.id).positions.length === 1, w.why);
  const a2 = IM.addPosition(w.id, { name: 'Квартира', value: 200000, kind: 'flat', region: 'Ошская обл.' });
  ck('ИМ-46: позиция 2 добавлена', a2.ok && IM.curatorOf(w.id).emp === 'Абдраимова Н.К.', a2.why);
  const wd1 = IM.addFact(w.id, 'withdraw', { pos: 1, doc: 'Письмо источника' });
  const c3 = IM.curatorOf(w.id);
  ck('ИМ-46: позиция 1 отозвана — куратор по позиции 2 (Ошская обл.)', wd1.ok && c3.emp === 'Кадыров Т.Ы.' && has(c3.why, 'позиции 2') && has(c3.why, 'Ошская'), [wd1, c3]);
  const wd2 = IM.addFact(w.id, 'withdraw', { pos: 2, doc: 'Письмо источника 2' });
  const c4 = IM.curatorOf(w.id);
  ck('ИМ-46: все позиции отозваны — фолбэк, заведующий отделом', wd2.ok && c4.fallback && has(c4.why, 'отозваны'), [wd2, c4]);
  ck('UI: у куратора предложения пояснение «по позиции 1»', has(doc.querySelector('[data-testid=offer-curator]').textContent, 'Абдраимова')
    && has(doc.getElementById('panel').textContent, 'по позиции 1'));
});

/* ================= ИМ-47…ИМ-59 (С-35…С-41) =================
   Склад ИО-7 сценариев 35–36 — в сиде магазин ИО-7 (нежилое, с арендой: попытке нужна отметка об обременении).
   П-1/ИО-1/ИО-2 сценария 37 — П-8/ИО-11/ИО-12 (как в С-32). Договор сценария 38 — рассрочка ИО-8 (платёж 10.03.2028). */

group('С-35: прямая продажа — только по решению органа', ({ IM, doc }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  const base = { method: 'Прямая продажа', start: 2000000, platform: 'Внутренняя процедура', encMark: 'продаётся с обременением' };
  const r1 = IM.addFact('ИО-7', 'attempt', Object.assign({ basis: ap.id }, base), 'spec');
  ck('по отчёту оценщика — отказ «прямая продажа — только по решению органа»', !r1.ok && has(r1.why, 'прямая продажа — только по решению органа'), r1.why);
  const r0 = IM.addFact('ИО-7', 'attempt', Object.assign({ basis: '' }, base), 'spec');
  ck('без основания — тот же отказ', !r0.ok && has(r0.why, 'прямая продажа — только по решению органа'), r0.why);
  ck('объект остался «на учёте»', IM.objState('ИО-7').code === 'onbook');
  const pd = IM.addFact('ИО-7', 'priceDecision', { amount: 2000000, buyer: 'ИП Орозбеков Н.Т.', doc: 'Решение Комитета № 5/2028 о прямой продаже' }, 'sec');
  ck('решение Комитета вносит секретарь органа (покупатель Z, 2 000 000)', pd.ok && pd.fact.buyer === 'ИП Орозбеков Н.Т.', pd.why);
  const r2 = IM.addFact('ИО-7', 'attempt', Object.assign({ basis: pd.fact.id }, base), 'spec');
  ck('с решением органа — попытка открыта', r2.ok && IM.objState('ИО-7').code === 'listed', r2.why);
  const at = IM.attempts('ИО-7')[0];
  ck('основание цены — решение органа', at && IM.obj('ИО-7').facts.find(f => f.id === at.a.basis).t === 'priceDecision');
  ck('сид: прямая продажа ИО-8 опирается на решение Комитета', (() => { const a = IM.obj('ИО-8').facts.find(f => f.t === 'attempt'); return IM.obj('ИО-8').facts.find(f => f.id === a.basis).t === 'priceDecision'; })());
  IM.openObject('ИО-7', 'log');
  ck('UI: в журнале — решение органа с покупателем прямой продажи', has(doc.getElementById('panel').textContent, 'прямая продажа: ИП Орозбеков Н.Т.'));
});

group('С-35 (инвариант): аукцион и конкурс открываются без решения органа', ({ IM }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  const r = IM.addFact('ИО-7', 'attempt', { method: 'Конкурс', start: 1900000, basis: ap.id, platform: 'п', encMark: 'продаётся с обременением' }, 'spec');
  ck('конкурс по отчёту оценщика открыт', r.ok, r.why);
});

group('С-36: снижение стартовой цены — по новой оценке, по решению Комитета; без основания — отказ', ({ IM }) => {
  const enc = { platform: 'п', encMark: 'продаётся с обременением', method: 'Аукцион' };
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  const a1 = IM.addFact('ИО-7', 'attempt', Object.assign({ start: 1900000, basis: ap.id }, enc), 'spec');
  ck('первая попытка 1 900 000 по оценке', a1.ok && IM.addFact('ИО-7', 'attemptResult', { v: 'failed' }, 'spec').ok, a1.why);
  const ap2 = IM.addFact('ИО-7', 'appraisal', { appraiser: 'ОсОО «Эксперт-Баа»', amount: 1600000, doc: 'Отчёт № О-31/28' }, 'spec');
  const nPd = IM.obj('ИО-7').facts.filter(f => f.t === 'priceDecision').length;
  const a2 = IM.addFact('ИО-7', 'attempt', Object.assign({ start: 1600000, basis: ap2.fact.id }, enc), 'spec');
  ck('по новой оценке 1 600 000 — принято без Комитета', ap2.ok && a2.ok && nPd === 0, [ap2.why, a2.why]);
  IM.addFact('ИО-7', 'attemptResult', { v: 'failed' }, 'spec');
  const pd = IM.addFact('ИО-7', 'priceDecision', { amount: 1400000, doc: 'Решение Комитета № 6/2028 о снижении' }, 'sec');
  const a3 = IM.addFact('ИО-7', 'attempt', Object.assign({ start: 1400000, basis: pd.fact.id }, enc), 'spec');
  ck('по решению Комитета 1 400 000 — принято', pd.ok && a3.ok, a3.why);
  IM.addFact('ИО-7', 'attemptResult', { v: 'failed' }, 'spec');
  const a4 = IM.addFact('ИО-7', 'attempt', Object.assign({ start: 1300000, basis: '' }, enc), 'spec');
  ck('без основания — отказ', !a4.ok && has(a4.why, 'основание стартовой цены обязательно'), a4.why);
  ck('шага и минимума нет: три попытки, каждая со своим основанием', IM.attempts('ИО-7').length === 3);
});

group('С-37: требование к отчуждателю после отмены раннего принятия', ({ IM, doc }) => {
  ck('до исправления требования нет', IM.claimOf('ИО-12') === null);
  const r = key(IM, 'ИО-12', 'realloc', { doc: 'Решение суда № 2-418/27' }, 'spec');
  ck('исправление ИО-12 опубликовано', r.ok, r.why);
  const c = IM.claimOf('ИО-12');
  ck('требование 200 000 к отчуждателю, возникло 10.09.2027', c && c.amount === 200000 && c.date === '2027-09-10' && c.open && c.debtor === IM.obj('ИО-12').alien, c);
  ck('до 10.09.2027 требования нет', IM.claimOf('ИО-12', '2027-09-09') === null);
  IM.openObject('ИО-12', 'char');
  const b = doc.querySelector('[data-testid=claim-block]');
  ck('UI: блок «Требование к отчуждателю · 200 000 · не погашено» в карточке ИО-2/ИО-12', b && b.dataset.open === 'true' && has(b.textContent, 'Требование к отчуждателю') && has(b.textContent, 'не погашено') && digits(b.textContent).includes('200000'), b && b.textContent);
  IM.go('objects'); IM.setF('bClaim', true);
  const rows = [...doc.querySelectorAll('[data-testid^=object-row-]')].map(x => x.dataset.testid);
  ck('фильтр реестра «требование открыто» — только ИО-12', rows.join() === 'object-row-ИО-12', rows);
  IM.setF('bClaim', false);
  const t8 = IM.triggers('2027-11-08').find(t => t.kind === 'pk-im-claim-open' && t.id === 'ИО-12');
  const t9 = IM.triggers('2027-11-09').find(t => t.kind === 'pk-im-claim-open' && t.id === 'ИО-12');
  ck('08.11.2027 (59 к.д.) повода нет', !t8);
  ck('09.11.2027 (60 к.д.) — повод pk-im-claim-open', !!t9, t9);
  ck('адресат — куратор ИО-12', t9 && t9.to === IM.curatorOf('ИО-12', '2027-11-09').emp, t9 && t9.to);
  ck('порог 60 к.д., источник «внутренний акт»', (() => { const s = IM.SETTINGS.thr.find(t => t.id === 'pk-im-claim-open'); return s && s.v === 60 && s.unit === 'к.д.' && s.src === 'внутренний акт'; })());
  ck('погашение больше остатка — отказ', !IM.addFact('ИО-12', 'claimPaid', { date: '2027-12-01', amount: 250000, doc: 'Поступление' }, 'spec').ok);
  ck('погашение без ссылки на поступление — отказ', !IM.addFact('ИО-12', 'claimPaid', { date: '2027-12-01', amount: 200000 }, 'spec').ok);
  ck('погашение вводит специалист (юрист — нет)', !IM.addFact('ИО-12', 'claimPaid', { date: '2027-12-01', amount: 200000, doc: 'П' }, 'lawyer').ok);
  const p = IM.addFact('ИО-12', 'claimPaid', { date: '2027-12-01', amount: 200000, doc: 'Поступление № ПП-2207 от 01.12.2027' }, 'spec');
  ck('01.12.2027 «требование погашено» — без второго ключа', p.ok && !p.pending, p.why);
  const c2 = IM.claimOf('ИО-12');
  ck('остаток 0, требование закрыто 01.12.2027', c2.rest === 0 && !c2.open && c2.closedAt === '2027-12-01', c2);
  ck('на 30.11.2027 требование ещё открыто', IM.claimOf('ИО-12', '2027-11-30').open);
  ck('после погашения повода нет', !IM.triggers('2027-12-15').some(t => t.kind === 'pk-im-claim-open'));
  ck('повторное погашение недоступно', !IM.gate('ИО-12', 'claimPaid').ok);
  IM.openObject('ИО-12', 'char');
  const b2 = doc.querySelector('[data-testid=claim-block]');
  ck('UI: блок закрыт — «погашено»', b2 && b2.dataset.open === 'false' && has(b2.textContent, 'погашено 01.12.2027'), b2 && b2.textContent);
});

group('С-37 (§8.1): возврат по суду с исполненной доплатой; частичное погашение и прекращение', ({ IM }) => {
  ck('у ИО-3 требования нет', IM.claimOf('ИО-3') === null && !IM.gate('ИО-3', 'claimPaid').ok);
  ck('доплата 200 000 исполнена', IM.addFact('ИО-3', 'topup', { amount: 200000, doc: 'Возврат № В-300' }, 'acc').ok);
  const r = key(IM, 'ИО-3', 'ret', { doc: 'Решение суда № 2-77/28' }, 'spec');
  ck('возврат опубликован', r.ok, r.why);
  const c = IM.claimOf('ИО-3');
  ck('требование = исполненная доплата 200 000, основание — судебный акт', c && c.amount === 200000 && c.open && has(c.basis, 'судебный акт'), c);
  ck('частично погашено 50 000', IM.addFact('ИО-3', 'claimPaid', { amount: 50000, doc: 'Поступление № ПП-1' }, 'spec').ok && IM.claimOf('ИО-3').rest === 150000);
  const s = IM.addFact('ИО-3', 'claimStop', { doc: 'Решение Комитета № 9/2028: взыскать невозможно' }, 'spec');
  ck('прекращение требования ждёт второго ключа', s.ok && s.pending, s.why);
  ck('до публикации требование открыто', IM.claimOf('ИО-3').open);
  IM.publish(s.fact.id, 'head');
  const c2 = IM.claimOf('ИО-3');
  ck('прекращено; остаток 150 000 — потеря в результате по объекту', !c2.open && c2.loss === 150000 && IM.result('ИО-3').claimLoss === 150000, [c2, IM.result('ИО-3').claimLoss]);
});

group('С-38: просрочка рассрочки — порог 5 к.д.', ({ IM }) => {
  const s = IM.SETTINGS.thr.find(t => t.id === 'pk-im-instalment-overdue');
  ck('порог 5 к.д.', s.v === 5 && s.unit === 'к.д.', s);
  ck('сид: платёж по графику ИО-8 10.03.2028 не поступил', IM.contractInfo('ИО-8', '2028-03-14').firstUnpaid === '2028-03-10');
  ck('14.03 (4 к.д.) — повода нет', !IM.triggers('2028-03-14').some(t => t.kind === 'pk-im-instalment-overdue' && t.id === 'ИО-8'));
  ck('16.03 (6 к.д.) — повод pk-im-instalment-overdue', IM.triggers('2028-03-16').some(t => t.kind === 'pk-im-instalment-overdue' && t.id === 'ИО-8'));
  ck('неустойка считается от даты графика (на 14.03 уже начислена)', IM.contractInfo('ИО-8', '2028-03-14').penalty > 0);
});

group('С-39: порог осмотра по виду — скот 1 мес., офис по умолчанию 6 мес.', ({ IM, doc }) => {
  ck('вид «Скот» есть в справочнике (вещь, без госрегистрации)', (() => { const k = IM.KINDS.find(x => x.id === 'cattle'); return k && k.name === 'Скот' && k.cls === 'вещь' && !k.reg; })());
  ck('порог вида: скот 1 мес., нежилое — умолчание 6 мес.', IM.inspThr('cattle') === 1 && IM.inspThr('nonres') === 6);
  const c = IM.addIntro({ name: 'КРС, 40 голов', kind: 'cattle', value: 400000, transfer: '2027-06-01', obligor: 'o_lx', doc: 'Ведомость' });
  const f = IM.addIntro({ name: 'Офис, ул. Киевская, 5', kind: 'nonres', value: 900000, transfer: '2027-06-01', obligor: 'o_lx', doc: 'Ведомость' });
  [c.id, f.id].forEach(id => IM.addFact(id, 'inspection', { date: '2028-01-01', who: 'А', cond: 'норма', doc: 'Акт' }, 'spec'));
  const tr = IM.triggers('2028-02-05').filter(t => t.kind === 'pk-im-no-inspection');
  ck('05.02: повод по скоту есть', tr.some(t => t.id === c.id), tr.map(t => t.id));
  ck('05.02: по офису нет', !tr.some(t => t.id === f.id));
  IM.go('settings');
  const inp = doc.querySelector('[data-testid=insp-cattle] input');
  ck('UI: в настройках таблица «вид → порог», у скота 1', !!doc.querySelector('[data-testid=insp-by-kind]') && inp && inp.value === '1');
  ck('UI: пустая строка — умолчание', doc.querySelector('[data-testid=insp-flat] input').value === '' && has(doc.querySelector('[data-testid=insp-flat]').textContent, 'умолчание'));
  IM.setInspThr('cattle', '');
  ck('очистили исключение — скот по умолчанию, повода 05.02 нет', IM.inspThr('cattle') === 6 && !IM.triggers('2028-02-05').some(t => t.kind === 'pk-im-no-inspection' && t.id === c.id));
});

group('С-40: автомобиль — право актом, ГАИ — учётная запись; земельный участок — регистрацией', ({ IM, doc }) => {
  const car = IM.KINDS.find(k => k.id === 'car'), land = IM.KINDS.find(k => k.id === 'land');
  ck('справочник: «Автомобиль» без госрегистрации, «Земельный участок» с ней, неделимый', car && !car.reg && car.cls === 'вещь' && land && land.reg && !land.div && land.cls === 'вещь');
  const r = IM.registerOffer({ source: 'debtor', obligor: 'o_m', docNo: 'ОТ-40', docDate: '2027-03-01', name: 'Автомобиль Toyota Camry, 2015 г. в.', value: 300000, kind: 'car', region: 'г. Бишкек' }, 'spec');
  IM.addPosition(r.id, { name: 'Земельный участок, с. Ново-Павловка, 0,12 га', value: 200000, kind: 'land', region: 'Чуйская обл.' }, 'spec');
  const d = IM.addFact(r.id, 'decision', { date: '2027-03-05', organ: IM.ORGANS[0], doc: 'Решение № 8/2027', items: { 1: { v: 'accept' }, 2: { v: 'accept' } } }, 'sec');
  const a1 = key(IM, r.id, 'act', { pos: 1, date: '2027-03-12', doc: 'Акт № АП-40/1' }, 'spec');
  const a2 = key(IM, r.id, 'act', { pos: 2, date: '2027-03-12', doc: 'Акт № АП-40/2' }, 'spec');
  ck('решение и два акта 12.03', d.ok && a1.ok && a2.ok, [d.why, a1.why, a2.why]);
  const oc = IM.OBJECTS.find(o => o.offer === r.id && o.pos === 1), ol = IM.OBJECTS.find(o => o.offer === r.id && o.pos === 2);
  ck('автомобиль: переход права и погашение 12.03', IM.objState(oc.id).transfer === '2027-03-12' && IM.allocation('o_m').rows.some(x => x.id === oc.id && x.date === '2027-03-12'));
  ck('регистрация права для автомобиля не вводится', !IM.gate(oc.id, 'reg').ok);
  const v = IM.addFact(oc.id, 'vehReg', { date: '2027-03-28', doc: 'Свидетельство о регистрации ТС № 01КG123' }, 'spec');
  ck('28.03 учёт в ГАИ — обычный факт без второго ключа', v.ok && !v.pending, v.why);
  ck('дата погашения не изменилась (12.03)', IM.objState(oc.id).transfer === '2027-03-12' && IM.allocation('o_m').rows.find(x => x.id === oc.id).date === '2027-03-12');
  ck('второй раз учёт не вводится', !IM.gate(oc.id, 'vehReg').ok);
  ck('для участка учёт в ГАИ недоступен', !IM.gate(ol.id, 'vehReg').ok && has(IM.gate(ol.id, 'vehReg').why, 'регистрация права'));
  ck('участок до 05.04 — «ждёт регистрации», погашения нет', IM.objState(ol.id, '2027-04-01').code === 'wait' && !IM.allocation('o_m', '2027-04-01').rows.some(x => x.id === ol.id));
  ck('регистрация участка 05.04', key(IM, ol.id, 'reg', { date: '2027-04-05', doc: 'Выписка № 2027-04-0505' }, 'spec').ok);
  ck('участок погашен 05.04', IM.objState(ol.id).transfer === '2027-04-05' && IM.allocation('o_m').rows.some(x => x.id === ol.id && x.date === '2027-04-05'));
  ck('участок неделимый — разделения нет', !IM.gate(ol.id, 'split').ok);
  IM.openObject(oc.id, 'transfer');
  ck('UI: на вкладке «Переход права» — учёт за Фондом и дата акта', !!doc.querySelector('[data-testid=veh-reg]') && doc.querySelector('[data-testid=transfer-date]').textContent.includes('12.03.2027'));
});

group('С-41: миграция — черновики из легаси-платежей', ({ IM, doc }) => {
  const sums = IM.DRAFTS.map(d => d.value);
  ck('три черновика: 2 400 000, 500 000, 1 200 000', IM.DRAFTS.length === 3 && sums.join() === '2400000,500000,1200000', sums);
  ck('Х и Н дополнены и ждут второго ключа, М — «не подтверждён»', ['pending', 'pending', 'unconfirmed'].join() === IM.DRAFTS.map(d => IM.draftState(d).code).join());
  const m0 = IM.migrationReport();
  ck('миграция заблокирована черновиком Ч-3', m0.blocked && m0.why.some(w => has(w, 'Ч-3 не подтверждён')), m0.why);
  IM.go('objects');
  ck('UI: отчёт миграции с блокировкой и строкой «не подтверждён»', has(doc.querySelector('[data-testid=migration-blocked]').textContent, 'Ч-3') && doc.querySelector('[data-testid="draft-Ч-3"]').dataset.code === 'unconfirmed');
  ck('второй ключ не ставит специалист', !IM.publishDraft('Ч-1', 'spec').ok);
  const x = IM.publishDraft('Ч-1', 'head'), n = IM.publishDraft('Ч-2', 'head');
  ck('Х и Н опубликованы вводными объектами', x.ok && n.ok, [x.why, n.why]);
  const sx = IM.objState(x.id), sn = IM.objState(n.id);
  ck('Х — «снят с учёта» с фактом выбытия (продан 15.04.2023)', sx.code === 'removed' && sx.pathId === 'once' && sx.date === '2023-04-15' && IM.obj(x.id).facts.some(f => f.t === 'introOut'), sx);
  ck('Н — «на учёте»', sn.code === 'onbook', sn);
  ck('ИИ-3: вводные объекты погашения не порождают', !IM.allocation('o_lx').rows.length && !IM.allocation('o_ln').rows.length && has(IM.neighbours(x.id).payments.join(' '), 'погашения не порождает'));
  ck('стоимость = сумма платежа легаси', IM.objValue(x.id) === 2400000 && IM.objValue(n.id) === 500000);
  ck('результат по Х: 2 600 000 − 2 400 000 = 200 000', IM.result(x.id).result === 200000, IM.result(x.id));
  ck('М без документов не публикуется', !IM.publishDraft('Ч-3', 'head').ok);
  ck('М не дополняется без документов', !IM.fillDraft('Ч-3', { name: 'Склад', kind: 'store', region: 'г. Ош', now: 'onbook' }, 'spec').ok);
  ck('по-прежнему заблокировано', IM.migrationReport().blocked && IM.migrationReport().why.some(w => has(w, 'Ч-3')));
  ck('М дополнен по документам', IM.fillDraft('Ч-3', { name: 'Склад, г. Ош', kind: 'store', region: 'г. Ош', now: 'onbook', doc: 'Акт № 2/20' }, 'spec').ok);
  ck('после дополнения Ч-3 не блокирует', !IM.migrationReport().why.some(w => has(w, 'Ч-3')), IM.migrationReport().why);
});

group('Формы ИМ-47…59: рендер без ошибок', ({ IM, errs }) => {
  IM.setRole('spec');
  ['vehReg', 'claimPaid', 'claimStop', 'priceDecision'].forEach(t => { IM.uiFact('ИО-2', t); IM.closeForm(); });
  IM.uiDraft('Ч-3'); IM.closeForm();
  IM.setRole('head'); IM.go('objects'); IM.go('settings');
  key(IM, 'ИО-12', 'realloc', { doc: 'Решение суда' }, 'spec'); IM.openObject('ИО-12', 'char'); IM.uiFact('ИО-12', 'claimPaid'); IM.closeForm();
  ck('без ошибок скрипта', errs.length === 0, errs);
});

report();
