// Смоук макета «Имущество Фонда». Источник ожиданий — ASUBK-imushchestvo-logika.md §18 (матрица приёмки,
// 31 сценарий) и §14 (инварианты ИИ-1…ИИ-20). Запуск: node mockups/assets/tests/assets.smoke.mjs
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
  ck('фильтр по куратору на дату', [...doc.querySelectorAll('[data-testid^=object-row-]')].length === 1 && !!doc.querySelector('[data-testid="object-row-ИО-410"]'));
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

report();
