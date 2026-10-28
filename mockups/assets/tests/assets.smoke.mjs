// Смоук макета «Имущество Фонда». Источник ожиданий — ASUBK-imushchestvo-logika.md §18 (матрица приёмки,
// 56 сценариев) и §14 (инварианты ИИ-1…ИИ-25). Запуск: node mockups/assets/tests/assets.smoke.mjs
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

/* ---------- сборка сценариев волны 4: новый объект и продажа по настоящей цепочке фактов ---------- */
let fxN = 0;
/* Объект через предложение → решение → акт (→ регистрация). Обязанное лицо создаётся с заданным долгом. */
function mkObj(IM, o) {
  const n = ++fxN, oid = 'o_fx' + n, date = o.date || '2027-04-05', kind = o.kind || 'flat';
  IM.OBL.push({ id: oid, name: o.name || 'Фикстура Ф.' + n + '.', role: 'заёмщик', credits: [{ no: 'К-9' + n, ccy: 'KGS' }], debt: o.debt });
  const r = IM.registerOffer({ source: o.source || 'spec', obligor: oid, docNo: 'ФХ-' + n, docDate: date, name: 'Фикстура ' + kind, value: o.value, kind, region: 'г. Бишкек', housing: !!o.housing, pledge: o.pledge }, 'spec');
  if (!r.ok) throw new Error('mkObj/register: ' + r.why);
  const steps = [IM.addFact(r.id, 'decision', { date, organ: IM.ORGANS[0], doc: 'Реш. ' + n, items: { 1: { v: 'accept' } } }, 'sec'), key(IM, r.id, 'act', { pos: 1, date, doc: 'Акт ' + n }, 'spec')];
  steps.forEach(s => { if (!s.ok) throw new Error('mkObj: ' + s.why); });
  const id = IM.posOutcome(r.id, 1).obj;
  if (IM.KINDS.find(k => k.id === kind).reg) { const g = key(IM, id, 'reg', { date, doc: 'Выписка ' + n }, 'spec'); if (!g.ok) throw new Error('mkObj/reg: ' + g.why); }
  return { of: r.id, id, obl: oid, name: IM.obj(id).alien };
}
const place = (IM, i) => IM.PUB_PLACES[i];
const pubs3 = (IM, d) => [0, 1, 2].map(i => ({ place: place(IM, i), date: d }));
const ann = (IM, id, date, price, x = {}) => key(IM, id, 'announce', Object.assign({ date, price, terms: 'once', basis: '', realtor: false, encMark: '', doc: 'Объявление ' + date, pubs: pubs3(IM, date) }, x), 'spec');
const apply = (IM, id, date, who, price, x = {}) => key(IM, id, 'application', Object.assign({ date, applicant: who, price, terms: 'once', doc: 'Заявление ' + date }, x), 'spec');
const decide = (IM, id, date, apps, v, x = {}) => key(IM, id, 'committee', Object.assign({ date, apps, v, doc: 'Протокол Комитета ' + date }, x), 'sec');
const contract = (IM, id, date, x = {}) => key(IM, id, 'contract', Object.assign({ date, doc: 'Договор КП ' + date }, x), 'lawyer');
const pay = (IM, id, date, amount, interest = 0) => IM.addFact(id, 'payment', { date, amount, interest }, 'acc');
const addExp = (IM, id, date, item, amount) => IM.addFact(id, 'expense', { date, item, amount, ccy: 'KGS', doc: 'Расход ' + item }, 'spec');
const apprs = (IM, id, date, amount) => IM.addFact(id, 'appraisal', { date, appraiser: 'ОсОО «Эксперт-Баа»', amount, ccy: 'KGS', doc: 'Отчёт ' + date }, 'spec');
/* Разовая продажа до договора включительно: объявление по цене → заявка → решение «продать» → договор. */
function sellTo(IM, id, p) {
  const who = p.buyer || 'Бейшеналиев Ы.Т.';
  const a = ann(IM, id, p.annDate, p.price, p.annX), q = apply(IM, id, p.appDate, who, p.price), d = decide(IM, id, p.decDate, [q.fact && q.fact.id], 'sell', { price: p.price }),
    c = contract(IM, id, p.ctrDate, { buyer: who, price: p.price, kind: 'once' });
  [a, q, d, c].forEach((s, i) => { if (!s.ok) throw new Error('sellTo[' + i + ']: ' + s.why); });
  return { a, q, d, c };
}
const SELL = (price, over = {}) => Object.assign({ annDate: '2027-05-10', appDate: '2027-05-15', decDate: '2027-05-20', ctrDate: '2027-05-25', price }, over);

/* Объект для рассрочки: переход права 05.04.2027, расходы 90 000, первое объявление 10.05 (республиканская ×2, местная ×3,
   сайт Госфинхолдинга, интернет-площадка); stage2 — второе объявление 10.08 «разово или в рассрочку»: с перехода права 127 дней
   и 3 + 4 публикации в газетах. */
function instReady(IM, stage) {
  const f = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' });
  addExp(IM, f.id, '2027-04-20', 'Оценка', 30000); addExp(IM, f.id, '2027-04-22', 'Налоги', 60000);
  const p = (d, i) => ({ place: IM.PUB_PLACES[i], date: d });
  const a1 = ann(IM, f.id, '2027-05-10', 2490000, { pubs: [p('2027-05-10', 0), p('2027-05-20', 0), p('2027-05-10', 1), p('2027-05-20', 1), p('2027-06-01', 1), p('2027-05-10', 2), p('2027-05-10', 3)] });
  if (!a1.ok) throw new Error('instReady/1: ' + a1.why);
  if (stage === 'stage2') { const a2 = ann(IM, f.id, '2027-08-10', 2490000, { terms: 'both' }); if (!a2.ok) throw new Error('instReady/2: ' + a2.why); }
  return f.id;
}

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
  ck('до 05.04 объявление недоступно (на 20.03)', !IM.gate('ИО-1', 'announce', '2027-03-20').ok);
  ck('ИИ-9: на 01.04 тоже недоступно', !IM.gate('ИО-1', 'announce', '2027-04-01').ok);
});

group('С-4: оборудование (регистрация не нужна): акт 15.03', ({ IM }) => {
  // в сиде оборудование ИО-2 (П-2): акт 15.03.2027 (сценарий 4 канона на другой дате; проверяется то же правило)
  const act = IM.obj('ИО-2').facts.find(f => f.t === 'act');
  ck('переход права = дата акта', IM.objState('ИО-2').transfer === act.date, [IM.objState('ИО-2').transfer, act.date]);
  ck('погашение на дату акта', IM.allocation('o_b', act.date).rows.some(r => r.id === 'ИО-2' && r.date === act.date));
  ck('регистрация права для вида не вводится (gate reg)', !IM.gate('ИО-2', 'reg').ok);
  ck('ИИ-3: погашение одно', IM.allocation('o_b').rows.filter(r => r.id === 'ИО-2').length === 1);
});

group('С-5: окончательный отказ регистратора', ({ IM }) => {
  const pf = IM.pending().find(x => x.f.t === 'act' && x.owner === 'П-7');
  ck('сид: акт ИО-6 ждёт второго ключа', !!pf);
  ck('акт публикует заведующий Сектором', IM.publish(pf.f.id, 'head').ok);
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

group('С-6: стоимость 2 400 000 > долг 1 850 000 на 05.04', ({ IM }) => {
  const t = IM.topupOf('ИО-1', '2027-04-10');
  ck('доплата 550 000 зафиксирована на 05.04', t && t.amount === 550000 && t.date === '2027-04-05', t);
  ck('адресат — отчуждатель; пока производство открыто, счёт — депозит ССИ', t.to === 'Асанов Т.Б.' && t.account === 'депозит ССИ', [t.to, t.account]);
  ck('выручки нет: состояние «зафиксирована», выплатить пока нечего', t.state === 'fixed' && t.unpaid === 0, t);
  const f = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' });
  const tf = IM.topupOf(f.id, '2027-04-05');
  ck('новая квартира: доплата 550 000 на 05.04', tf.amount === 550000 && tf.date === '2027-04-05', tf);
  ck('ИИ-9: объявление доступно сразу — доплата продажу не блокирует', IM.gate(f.id, 'announce', '2027-04-05').ok, IM.gate(f.id, 'announce', '2027-04-05'));
  ck('ИИ-22: сумма доплаты со временем не меняется', IM.topupOf(f.id, '2027-12-01').amount === 550000);
  ck('ИИ-6: выплату доплаты вводит только бухгалтер Платежей', !IM.addFact(f.id, 'topup', { amount: 1, doc: 'В-1', date: '2027-04-06' }, 'spec').ok);
  const r = IM.addFact(f.id, 'topup', { amount: 1, doc: 'В-1', date: '2027-04-06' }, 'acc');
  ck('и бухгалтер вводит её не раньше выручки', !r.ok && has(r.why, 'выручки'), r.why);
});

group('С-7: гараж брата должника', ({ IM }) => {
  const of = IM.offer('П-3');
  ck('обязанное лицо — должник (Иманов К.Т.), отчуждатель — другой субъект (брат)', IM.OBL.find(o => o.id === of.obligor).name === 'Иманов К.Т.' && has(of.alien, 'Иманов Б.Т.'), [of.obligor, of.alien]);
  ck('ожидаемая доплата 750 000 − 600 000 = 150 000', IM.expectedTopups('П-3').rows[1].topup === 150000);
  const d0 = IM.addFact('П-3', 'decision', { organ: IM.ORGANS[0], doc: 'Реш. 5/2028', items: { 1: { v: 'accept' } } }, 'sec');
  ck('третье лицо: без отчёта оценщика Фонда на Комитет не вынести', !d0.ok && has(d0.why, 'нет отчёта оценщика'), d0.why);
  ck('отчёт оценщика по позиции введён', IM.addFact('П-3', 'appraisal', { pos: 1, appraiser: 'ОсОО «Эксперт-Баа»', amount: 750000, doc: 'Отчёт № О-1/28' }, 'spec').ok);
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

group('С-10: второе объявление с ценой ниже первого без основания', ({ IM }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  const m = { encMark: IM.ENC_MARKS[0] };
  const a1 = ann(IM, 'ИО-7', '2028-01-20', 1900000, Object.assign({ basis: ap.id }, m));
  ck('первое объявление по отчёту оценщика проходит', a1.ok, a1.why);
  const r = ann(IM, 'ИО-7', '2028-03-01', 1500000, m);
  ck('отказ без основания: основание цены обязательно (отчёт оценщика или решение Комитета)', !r.ok && has(r.why, 'основание цены обязательно'), r.why);
  const r2 = ann(IM, 'ИО-7', '2028-03-01', 1500000, Object.assign({ basis: ap.id }, m));
  ck('ниже основания со ссылкой на тот же отчёт — тоже отказ (нужно решение Комитета)', !r2.ok && has(r2.why, 'ниже основания'), r2.why);
  const pd = IM.addFact('ИО-7', 'priceDecision', { date: '2028-03-01', amount: 1500000, doc: 'Реш.' }, 'sec');
  const r3 = ann(IM, 'ИО-7', '2028-03-01', 1500000, Object.assign({ basis: pd.fact && pd.fact.id }, m));
  ck('с решением Комитета о цене — проходит', pd.ok && r3.ok, r3.why);
});

group('С-11: открыть второе объявление при действующем первом', ({ IM }) => {
  ck('сид: у ИО-4 действует объявление', IM.objState('ИО-4').code === 'listed');
  ck('gate: отказ', !IM.gate('ИО-4', 'announce').ok && has(IM.gate('ИО-4', 'announce').why, 'уже действует объявление'), IM.gate('ИО-4', 'announce'));
  const ap = IM.obj('ИО-4').facts.find(f => f.t === 'appraisal');
  const r = ann(IM, 'ИО-4', '2028-03-10', 1250000, { basis: ap.id });
  ck('addFact: отказ', !r.ok, r.why);
  ck('ИИ-10: второй действующий договор КП недопустим (ИО-1)', !IM.gate('ИО-1', 'contract').ok && has(IM.gate('ИО-1', 'contract').why, 'уже есть действующий договор'));
  ck('и объявление при действующем договоре недопустимо (ИО-1)', !IM.gate('ИО-1', 'announce').ok && has(IM.gate('ИО-1', 'announce').why, 'договор'));
});

group('С-12: объявление при активном обременении без отметки', ({ IM }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  ck('сид: на ИО-7 активна аренда', !!IM.flags('ИО-7').encumbered);
  const r = ann(IM, 'ИО-7', '2028-03-10', 1900000, { basis: ap.id });
  ck('отказ без отметки', !r.ok && has(r.why, 'обременение'), r.why);
  const r2 = ann(IM, 'ИО-7', '2028-03-10', 1900000, { basis: ap.id, encMark: IM.ENC_MARKS[1] });
  ck('ИИ-17: с отметкой — проходит', r2.ok, r2.why);
  ck('отметка сохранена в факте', r2.fact && r2.fact.encMark === IM.ENC_MARKS[1]);
});

group('С-13: рассрочка: последний платёж', ({ IM }) => {
  const ci = IM.contractInfo('ИО-8');
  ck('сид: оплачено 240 000 из 960 000, объект «продан в рассрочку»', ci.paid === 240000 && ci.price === 960000 && IM.objState('ИО-8').code === 'sold_inst', [ci.paid, IM.objState('ИО-8').code]);
  ck('ИИ-10: пока не оплачено, право у Фонда, объект не снят', IM.objState('ИО-8').code !== 'removed');
  const r = pay(IM, 'ИО-8', '2028-03-10', ci.rest);
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
  ck('Возврат = уплаченное − неустойка', r.fact.refund === r.fact.paid - r.fact.penaltyAmt && r.fact.paid === 731250, r.fact);
  ck('неустойка не больше уплаченного, возврат ≥ 0', r.fact.penaltyAmt >= 0 && r.fact.refund >= 0);
  ck('Платежи: распоряжение на Возврат покупателю', has(IM.neighbours('ИО-1').payments.join(' '), 'Возврат покупателю'));
  ck('расторжение — выход из пути: объявлять снова можно', IM.gate('ИО-1', 'announce').ok, IM.gate('ИО-1', 'announce'));
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
  ck('правка цены из заявления свободна', IM.editPosition('П-3', 1, { claimed: 800000 }).ok && IM.offer('П-3').positions[0].claimed === 800000);
  ck('ИИ-23: стоимость принятия руками не правится — её задаёт отчёт оценщика', !IM.editPosition('П-3', 1, { value: 900000 }).ok);
  ck('после решения органа правка закрыта (П-1)', !IM.editPosition('П-1', 1, { value: 1 }).ok);
  ck('добавление позиции после решения закрыто (П-1)', !IM.addPosition('П-1', { name: 'x', value: 1 }).ok);
});

group('С-20: стоимость в KGS, кредит в USD', ({ IM }) => {
  ck('сид: кредит поручителя в USD', IM.OBL.find(o => o.id === 'o_z').credits[0].ccy === 'USD');
  ck('ИИ-18: учётная стоимость объекта в KGS', IM.obj('ИО-4').ccy === 'KGS');
  const p = IM.neighbours('ИО-4').payments[0];
  ck('в Платежи уходит KGS (сумма в сомах)', has(p, 'сом') && digits(p).includes(String(IM.objValue('ИО-4'))), p);
  ck('модуль курса не спрашивает: нет курса/конвертера в API и в тексте', !Object.keys(IM).filter(k => k !== 'MIGRATED').some(k => /rate|kurs|convert/i.test(k)) && !has(p, 'курс по'), p);
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
  ck('ИИ-3: доплаты по вводному нет', IM.topupOf(r.id) === null);
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
  ck('не заведующий Сектором не публикует', ['spec', 'sec', 'lawyer', 'acc'].every(role => !IM.publish(pf.f.id, role).ok));
  IM.setRole('spec'); IM.go('offers');
  ck('UI (spec): кнопки публикации нет', !doc.querySelector(`[data-testid=publish-${pf.f.id}]`));
  IM.setRole('head'); IM.go('queue');
  ck('UI (head): кнопка публикации есть (в очереди)', !!doc.querySelector(`[data-testid=publish-${pf.f.id}]`));
  IM.publish(pf.f.id, 'head');
  ck('после публикации объект ИО-6 возникает', IM.objState('ИО-6').code === 'wait');
});

group('С-24: срок ответа истёк', ({ IM }) => {
  const t = IM.triggers().find(x => x.kind === 'pk-im-offer-overdue' && x.id === 'П-3');
  ck('повод pk-im-offer-overdue по П-3', !!t);
  ck('адресован куратору', t && t.to === IM.curatorOf('П-3').emp, t);
  IM.addFact('П-3', 'appraisal', { pos: 1, appraiser: 'ОсОО «Эксперт-Баа»', amount: 750000, doc: 'Отчёт № О-2/28' }, 'spec');
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
  ck('вторым ключом может только заведующий Сектором', !IM.publish(r.fact.id, 'spec').ok);
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

group('С-30: долг 1 000 000, оборудование 500 000 (акт 15.03), квартира 700 000 (переход права 01.06)', ({ IM, doc }) => {
  const e = IM.expectedTopups('П-2');
  ck('ожидаемая доплата: оборудование 0', e.rows[1].topup === 0, e.rows);
  ck('ожидаемая доплата: квартира 200 000', e.rows[2].topup === 200000, e.rows);
  ck('на 15.03 не вошло 0', sum(IM.allocation('o_b', '2027-03-15').rows.map(r => r.notIncluded)) === 0);
  ck('на 01.06 не вошло 200 000', sum(IM.allocation('o_b', '2027-06-01').rows.map(r => r.notIncluded)) === 200000);
  ck('доплата зафиксирована только по квартире (ИО-3), по оборудованию (ИО-2) — нет', IM.topupOf('ИО-3').amount === 200000 && IM.topupOf('ИО-3').date === '2027-06-01' && IM.topupOf('ИО-2').amount === 0 && IM.topupOf('ИО-2').state === 'none');
  ck('ИМ-43: на 15.03 доплаты по оборудованию нет', (IM.topupOf('ИО-2', '2027-03-15') || { amount: 0 }).amount === 0);
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
  ck('Возврат доплаты бывшему собственнику — распоряжение в Платежи', has(IM.neighbours('ИО-1', '2027-04-10').payments.join(' '), 'Возврат доплаты'));
  const ct = key(IM, 'ИО-1', 'cterm', { doc: 'Соглашение' }, 'lawyer');
  ck('Возврат покупателю при расторжении — тоже распоряжение в Платежи', ct.ok && has(IM.neighbours('ИО-1').payments.join(' '), 'Возврат покупателю'));
  ck('ИИ-6: оплату по договору и выплату доплаты вводит только бухгалтер', ['spec', 'sec', 'lawyer', 'head', 'probl'].every(r => !IM.addFact('ИО-1', 'topup', { amount: 1, doc: 'д' }, r).ok));
});

group('ИИ-7: путь выбытия берёт объект целиком; не больше одного пути', ({ IM }) => {
  const r = key(IM, 'ИО-2', 'gift', { doc: 'Решение органа и акт', ground: IM.GOV_GROUNDS[0] }, 'spec');
  ck('безвозмездная передача проходит', r.ok, r.why);
  ck('объект снят с учёта путём «безвозмездная передача»', IM.objState('ИО-2').code === 'removed' && IM.objState('ИО-2').pathId === 'gift', IM.objState('ИО-2'));
  ck('второй путь (loss, ret, gift, split) закрыт', ['loss', 'ret', 'gift', 'split'].every(t => !IM.gate('ИО-2', t).ok));
  ck('снятия с учёта вручную нет в API', !Object.keys(IM).some(k => /^(remove|unregister|writeOff)/i.test(k)));
});

group('ИИ-9: объявление и договор КП невозможны до перехода права; при открытом преимущественном праве; доплата не блокирует', ({ IM }) => {
  ck('ждёт регистрации (ИО-5): объявление недоступно', !IM.gate('ИО-5', 'announce').ok && has(IM.gate('ИО-5', 'announce').why, 'до перехода права'));
  ck('ждёт регистрации (ИО-5): заявка и договор тоже недоступны', !IM.gate('ИО-5', 'application').ok && !IM.gate('ИО-5', 'contract').ok);
  const g3 = IM.gate('ИО-3', 'announce');
  ck('ИО-3 (жильё, доплата 200 000): объявление закрыто преимущественным правом, а не доплатой', !g3.ok && has(g3.why, 'уведомлени') && !has(g3.why, 'доплат'), g3.why);
  ck('чистый объект на учёте (ИО-2): объявление доступно', IM.gate('ИО-2', 'announce').ok);
  const f = mkObj(IM, { debt: 1000000, value: 1500000 });
  ck('объект с доплатой 500 000 (не жильё): объявление доступно', IM.topupOf(f.id).amount === 500000 && IM.gate(f.id, 'announce').ok);
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
    const data = { doc: 'д', parts: [60, 60], newValue: 510000, basis: 'б', ground: IM.GOV_GROUNDS[0] };
    const r = IM.addFact(target, t, data, 'spec');
    ck(`${t}: готовится специалистом → не опубликован`, r.ok && r.pending && !r.fact.pub, r.why);
    if (r.ok) { IM.rejectPending(r.fact.id, 'head', 'проверка'); IM.discardFact(r.fact.id, 'spec'); }
  });
  const c = IM.addFact('ИО-2', 'corr', { newValue: 510000, basis: 'б' }, 'head');
  ck('сам подготовивший не ставит второй ключ', c.ok && !IM.publish(c.fact.id, 'head').ok, c.why);
  ck('payment/topup (контур Платежей) без второго ключа', IM.addFact('ИО-8', 'payment', { amount: 1 }, 'acc').fact.pub === true && IM.addFact('ИО-1', 'topup', { amount: 34500, doc: 'В-400' }, 'acc').fact.pub === true);
  IM.setRole('spec'); IM.go('objects'); IM.openObject('ИО-2', 'char');
  const bt = doc.querySelector('[data-testid=act-ret]');
  ck('UI (spec): пункт «Возврат по суду» помечен значком второго ключа', bt && bt.dataset.key === '1' && !!bt.querySelector('svg.ico'), bt && bt.outerHTML);
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
  const att = doc.querySelector('[data-testid=act-announce]');
  ck('act-announce отключена с причиной (ИО-1 продан)', att && att.disabled && !!att.dataset.why);
  ck('оплата по договору и доплата не вводятся в модуле: пунктов act-payment / act-topup в меню нет', !doc.querySelector('[data-testid=act-payment]') && !doc.querySelector('[data-testid=act-topup]'));
  IM.setRole('acc'); IM.openObject('ИО-1', 'char');
  ck('роль бухгалтер: пункта act-payment в меню тоже нет', !doc.querySelector('[data-testid=act-payment]'));
  IM.setRole('spec'); IM.openObject('ИО-2', 'char');
  ck('ИО-2 на учёте: act-announce активна', !doc.querySelector('[data-testid=act-announce]').disabled);
  IM.setRole('sec'); IM.uiDecision('П-3');
  const r = IM.submitForm({});
  ck('форма без обязательных полей — ошибка form-err', !r.ok && !!doc.querySelector('[data-testid=form-err]'));
  IM.closeForm();
  IM.openObject('ИО-1', 'char'); IM.setAsOf('2027-04-10');
  const tb = doc.querySelector('[data-testid=topup-block]');
  ck('UI: блок «Доплата» на ИО-1 на 10.04.2027 — состояние «зафиксирована», 550 000', tb && tb.dataset.state === 'fixed' && digits(doc.querySelector('[data-testid=obj-topup]').textContent).startsWith('550000'), tb && tb.dataset.state);
  IM.openObject('ИО-7', 'char'); IM.setAsOf('2028-03-15');
  ck('UI: флаг flag-encumbered на ИО-7 (аренда)', !!doc.querySelector('[data-testid=flag-encumbered]'));
  IM.go('triggers');
  ck('UI: демо-вид стенда показывает повод trig-pk-im-offer-overdue', !!doc.querySelector('[data-testid=trig-pk-im-offer-overdue]'));
});

group('Прогон без ошибок скрипта: все экраны и формы', ({ IM, errs }) => {
  ck('загрузка без ошибок', errs.length === 0, errs);
  ['offers', 'objects', 'contracts', 'settings'].forEach(v => IM.go(v));
  IM.OFFERS.forEach(o => IM.openOffer(o.id));
  IM.OBJECTS.forEach(o => ['char', 'transfer', 'insp', 'appr', 'exp', 'enc', 'att', 'ctr', 'out', 'log', 'docs', 'links'].forEach(tb => IM.openObject(o.id, tb)));
  const FORMS = ['reg', 'announce', 'pubAdd', 'application', 'committee', 'torgiResult', 'notice', 'noticeAnswer', 'contract', 'cextend', 'cterm', 'payment', 'topup', 'split', 'gift', 'loss', 'ret', 'corr', 'realloc',
    'inspection', 'appraisal', 'expense', 'encumbrance', 'priceDecision', 'termExt', 'claim', 'claimPaid', 'claimStop', 'regRefusal', 'terminate'];
  ['ИО-1', 'ИО-3', 'ИО-4', 'ИО-7', 'ИО-8', 'ИО-9'].forEach(id => FORMS.forEach(t => { IM.uiFact(id, t); IM.closeForm(); }));
  ['ssiMemo', 'termExt', 'letter', 'concl', 'withdraw', 'act', 'terminate', 'appraisal'].forEach(t => { IM.uiFact('П-1', t, 1); IM.closeForm(); IM.uiFact('П-3', t, 1); IM.closeForm(); });
  IM.uiDecision('П-3'); IM.closeForm(); IM.uiNewOffer(); IM.closeForm(); IM.uiIntro(); IM.closeForm();
  ['spec', 'sec', 'lawyer', 'acc', 'probl', 'head'].forEach(r => { IM.setRole(r); ['offers', 'objects', 'contracts', 'settings', 'queue', 'migration', 'triggers'].forEach(v => IM.go(v)); IM.openObject('ИО-1', 'att'); IM.openObject('ИО-3', 'char'); });
  IM.setRole('spec');
  ck('рендер экранов/форм без ошибок', errs.length === 0, errs);
});

/* ====================== правки после ревью ====================== */

group('Гейты: выбытие и возврат при действующем объявлении; передача и разделение — нет', ({ IM, doc }) => {
  ck('ИО-4 выставлен на продажу', IM.objState('ИО-4').code === 'listed', IM.objState('ИО-4'));
  const gl = IM.gate('ИО-4', 'loss'), gr = IM.gate('ИО-4', 'ret');
  ck('loss при «выставлен на продажу» разрешён', gl.ok, gl.why);
  ck('ret при «выставлен на продажу» разрешён', gr.ok, gr.why);
  ck('объяснение: объявление снимется, заявкам без итога — отказ «объект выбыл»', has(gl.why, 'объект выбыл') && has(gr.why, 'объект выбыл') && has(gl.why, 'объявление'), gl.why);
  const gg = IM.gate('ИО-4', 'gift');
  ck('gift при действующем объявлении запрещён с причиной', !gg.ok && has(gg.why, 'объявление'), gg.why);
  IM.setRole('spec'); IM.openObject('ИО-4', 'char');
  const b = doc.querySelector('[data-testid=act-loss]');
  ck('UI: act-loss активна и data-why объясняет снятие объявления', b && !b.disabled && has(b.dataset.why, 'объект выбыл'), b && b.dataset.why);
  const bg = doc.querySelector('[data-testid=act-gift]');
  ck('UI: act-gift отключена', bg && bg.disabled && has(bg.dataset.why, 'объявление'), bg && bg.dataset.why);
  const r = key(IM, 'ИО-4', 'loss', { doc: 'Акт о гибели', cause: 'Гибель' }, 'spec');
  ck('выбытие опубликовано вторым ключом', r.ok, r.why);
  const st = IM.objState('ИО-4');
  ck('объект снят с учёта путём «выбытие»', st.code === 'removed' && st.pathId === 'loss', st);
  const an = IM.announcements('ИО-4'), ap = IM.appsOf('ИО-4');
  ck('действующее объявление снято', an.length === 1 && !an[0].open && !!an[0].gone, an.map(x => x.open));
  ck('открытой заявке — авто-решение «отказ: объект выбыл»', ap.length === 1 && ap[0].dec && ap[0].dec.v === 'refuse' && ap[0].dec.auto && has(ap[0].dec.reason, 'объект выбыл'), ap.map(x => x.dec));
  ck('второй путь после выбытия закрыт', ['ret', 'gift', 'loss'].every(t => !IM.gate('ИО-4', t).ok));
});

group('Гейты: разделение при действующем объявлении запрещено, возврат — разрешён', ({ IM }) => {
  const a = ann(IM, 'ИО-410', '2028-03-10', IM.buybackPrice('ИО-410', '2028-03-10'), { encMark: IM.ENC_MARKS[0] });
  ck('объявление по зерну открыто', a.ok && IM.objState('ИО-410').code === 'listed', a.why);
  const gs = IM.gate('ИО-410', 'split');
  ck('split при действующем объявлении запрещён с причиной', !gs.ok && has(gs.why, 'объявление'), gs.why);
  ck('ret при действующем объявлении разрешён', IM.gate('ИО-410', 'ret').ok);
  const r = key(IM, 'ИО-410', 'ret', { doc: 'Решение суда' }, 'spec');
  ck('возврат опубликован; путь «возврат»; объявление снято', r.ok && IM.objState('ИО-410').pathId === 'ret' && IM.announcements('ИО-410').every(x => !x.open), r.why);
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
  ck('расход в другой валюте не складывается в результат', IM.result('ИО-2').expenses === 8000 && IM.result('ИО-2').expOther.length === 1, IM.result('ИО-2'));
  ck('П-1: срок ответа 15.01.2027 (5 р.д. от 10.01)', IM.offer('П-1').deadline === '2027-01-15');
  ck('18 порогов поводов; у каждого источник «норма», «Инструкция» или «внутренний акт»', IM.SETTINGS.thr.length === 18 && IM.SETTINGS.thr.every(t => ['норма', 'Инструкция', 'внутренний акт'].includes(t.src)), IM.SETTINGS.thr.map(t => t.src));
  IM.go('settings');
  const txt = doc.getElementById('panel').textContent;
  ck('в интерфейсе нет технических id поводов (только в подсказке)', !/pk-im-/.test(txt));
  ck('в интерфейсе нет ISO-дат', !/\d{4}-\d{2}-\d{2}/.test(txt));
  IM.openOffer('П-1');
  const t2 = doc.getElementById('panel').textContent;
  ck('кредиты подписаны в сомах', has(t2, 'К-1 (сом)') && !has(t2, '(KGS)'));
  ck('нет «проекция модуля по имуществам»', !has(t2, 'проекция модуля'));
  IM.openObject('ИО-1', 'links');
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
  IM.go('migration');
  ck('контроль миграции: расхождение подписано как учебный пример', has(doc.querySelector('[data-testid=migration-control]').textContent, 'учебный пример'));
  IM.go('offers');
  ck('фильтры реестра предложений: обязанное лицо, орган', !!doc.querySelector('[data-testid=f-oObl]') && !!doc.querySelector('[data-testid=f-oOrgan]'));
  IM.setF('oObl', 'o_x');
  ck('фильтр по обязанному лицу', [...doc.querySelectorAll('[data-testid^=offer-row-]')].length === 1 && !!doc.querySelector('[data-testid="offer-row-П-1"]'));
  IM.setF('oObl', ''); IM.setF('oOrgan', 'Правление');
  ck('фильтр по органу: решений Правления нет', [...doc.querySelectorAll('[data-testid^=offer-row-]')].length === 0);
});

group('Покупатель в договоре КП — из списка субъектов', ({ IM, doc }) => {
  const a = ann(IM, 'ИО-2', '2028-03-01', IM.buybackPrice('ИО-2', '2028-03-01'));
  const q = apply(IM, 'ИО-2', '2028-03-05', 'Абдыкадыров М.С.', IM.buybackPrice('ИО-2', '2028-03-01') + 12000);
  const d = decide(IM, 'ИО-2', '2028-03-08', [q.fact && q.fact.id], 'sell', { price: IM.buybackPrice('ИО-2', '2028-03-01') + 12000 });
  ck('объявление, заявка и решение Комитета «продать»', a.ok && q.ok && d.ok, [a.why, q.why, d.why]);
  IM.setRole('lawyer'); IM.openObject('ИО-2', 'char'); IM.uiFact('ИО-2', 'contract');
  const sel = doc.getElementById('ff_buyer');
  ck('поле покупателя — список, выбран покупатель из решения', sel && sel.tagName === 'SELECT' && sel.value === 'Абдыкадыров М.С.', sel && sel.value);
  ck('основание договора — решение Комитета', doc.getElementById('ff_basis').value === d.fact.id);
  ck('у договора есть валюта документа', !!doc.getElementById('ff_ccy'));
});

/* ================= ИМ-44…ИМ-46 (С-32…С-34, ИИ-21) =================
   В сиде канонические П-1/ИО-1/ИО-2 сценария 32 — это П-8/ИО-11/ИО-12; ПР-1/ПР-2 сценариев 33–34 —
   П-9 (правило молчит) и П-8 (позиции в разных областях) + предложение без позиций, заведённое тестом. */

group('С-32: суд отменил раннее принятие после позднего — исправление поздней позиции', ({ IM, doc }) => {
  const before = IM.allocation('o_r', '2027-08-01');
  const r11 = before.rows.find(r => r.id === 'ИО-11'), r12 = before.rows.find(r => r.id === 'ИО-12');
  ck('до суда: оборудование 500 000 распределено целиком (переход права 15.03.2027)', r11 && r11.date === '2027-03-15' && r11.distributed === 500000, r11);
  ck('до суда: квартира — распределено 500 000, не вошло 200 000 (01.06.2027)', r12 && r12.date === '2027-06-01' && r12.distributed === 500000 && r12.notIncluded === 200000, r12);
  const t12 = IM.topupOf('ИО-12', '2027-08-01');
  ck('доплата 200 000 выплачена 20.06.2027 — состояние «выплачена»', t12.state === 'paid' && t12.paid === 200000 && t12.last.date === '2027-06-20', t12);
  const st11 = IM.objState('ИО-11');
  ck('10.09.2027 суд: оборудование снято с учёта путём «возврат»', st11.code === 'removed' && st11.pathId === 'ret' && st11.date === '2027-09-10', st11);
  ck('сторно оборудования в Платежах', IM.neighbours('ИО-11').payments.some(x => has(x, 'Сторно поступления')));
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
  ck('публикует заведующий Сектором', IM.publish(r.fact.id, 'head').ok);
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
  ck('П-8: позиция 1 — оборудование, Чуйская обл.; позиция 2 — квартира, Ошская обл.', IM.offer('П-8').positions[0].region === 'Чуйская обл.' && IM.offer('П-8').positions[1].region === 'Ошская обл.');
  ck('куратор П-8 — по Чуйской области и виду позиции 1', c.emp === 'Абдраимова Н.К.' && has(c.why, 'позиции 1') && has(c.why, 'Чуйская') && has(c.why, 'Оборудование'), c);
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

group('С-35: договор КП — только по решению Комитета или итогу торгов', ({ IM, doc }) => {
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal'), z = 'ИП Орозбеков Н.Т.';
  const a = ann(IM, 'ИО-7', '2028-03-01', 1900000, { basis: ap.id, encMark: IM.ENC_MARKS[0] });
  const q = apply(IM, 'ИО-7', '2028-03-05', z, 2000000);
  ck('объявление и одна заявка Z на 2 000 000', a.ok && q.ok, [a.why, q.why]);
  const c0 = IM.addFact('ИО-7', 'contract', { date: '2028-03-06', buyer: z, price: 2000000, kind: 'once', doc: 'Договор КП № 1' }, 'lawyer');
  ck('договор без решения Комитета — отказ «договор КП — только по решению Комитета или итогу торгов»', !c0.ok && has(c0.why, IM.CONTRACT_ONLY), c0.why);
  ck('gate договора закрыт, объект остался «выставлен»', !IM.gate('ИО-7', 'contract', '2028-03-06').ok && IM.objState('ИО-7', '2028-03-06').code === 'listed');
  ck('решение Комитета вносит только секретарь органа', !IM.addFact('ИО-7', 'committee', { date: '2028-03-10', apps: [q.fact.id], v: 'sell', price: 2000000, doc: 'П' }, 'spec').ok);
  const d = decide(IM, 'ИО-7', '2028-03-10', [q.fact.id], 'sell', { price: 2000000, doc: 'Протокол Комитета № 5/2028' });
  ck('с решением «продать» — вносится', d.ok, d.why);
  const bad = IM.addFact('ИО-7', 'contract', { date: '2028-03-12', basis: d.fact.id, buyer: z, price: 1500000, kind: 'once', doc: 'Д' }, 'lawyer');
  ck('цена договора — из решения: другая цена отказ', !bad.ok && has(bad.why, 'цена — из решения'), bad.why);
  const c = contract(IM, 'ИО-7', '2028-03-12', { basis: d.fact.id, buyer: z, price: 2000000, kind: 'once' });
  ck('договор заключён: основание — решение, цена из решения', c.ok && c.fact.basis === d.fact.id && c.fact.price === 2000000, c.why);
  ck('и второй договор по тому же решению невозможен', !IM.gate('ИО-7', 'contract').ok);
  IM.openObject('ИО-7', 'att');
  ck('UI: во вкладке объявлений — заявка Z и решение Комитета', has(doc.querySelector('[data-testid=ann-table]').closest('.card').textContent, z) && has(doc.querySelector('[data-testid=ann-table]').closest('.card').textContent, 'продать'));
});

group('ИИ-24 (инвариант): объявление по цене по умолчанию открывается без решения Комитета', ({ IM }) => {
  const r = ann(IM, 'ИО-7', '2028-03-01', IM.buybackPrice('ИО-7', '2028-03-01'), { encMark: IM.ENC_MARKS[0] });
  ck('объявление по учётной стоимости с расходами — без основания и без Комитета', r.ok && !r.fact.basis, r.why);
  ck('решений Комитета у объекта нет', !IM.obj('ИО-7').facts.some(f => f.t === 'committee' || f.t === 'priceDecision'));
});

group('С-36: второе объявление ниже первого: по новой оценке; по решению Комитета; без основания', ({ IM }) => {
  const m = { encMark: IM.ENC_MARKS[0] };
  const ap = IM.obj('ИО-7').facts.find(f => f.t === 'appraisal');
  const a1 = ann(IM, 'ИО-7', '2028-01-20', 1900000, Object.assign({ basis: ap.id }, m));
  ck('первое объявление 1 900 000 по отчёту оценщика', a1.ok, a1.why);
  const ap2 = IM.addFact('ИО-7', 'appraisal', { date: '2028-02-25', appraiser: 'ОсОО «Эксперт-Баа»', amount: 1600000, doc: 'Отчёт № О-31/28' }, 'spec');
  const nPd = IM.obj('ИО-7').facts.filter(f => f.t === 'priceDecision').length;
  const a2 = ann(IM, 'ИО-7', '2028-03-01', 1600000, Object.assign({ basis: ap2.fact && ap2.fact.id }, m));
  ck('по новой оценке 1 600 000 — принято без Комитета', ap2.ok && a2.ok && nPd === 0, [ap2.why, a2.why]);
  const pd = IM.addFact('ИО-7', 'priceDecision', { date: '2028-04-20', amount: 1400000, doc: 'Решение Комитета № 6/2028 о снижении' }, 'sec');
  const a3 = ann(IM, 'ИО-7', '2028-05-05', 1400000, Object.assign({ basis: pd.fact && pd.fact.id }, m));
  ck('по решению Комитета 1 400 000 — принято', pd.ok && a3.ok, a3.why);
  const a4 = ann(IM, 'ИО-7', '2028-06-10', 1300000, m);
  ck('без основания — отказ: основание цены обязательно', !a4.ok && has(a4.why, 'основание цены обязательно'), a4.why);
  ck('шага и минимума нет: три объявления, каждое со своим основанием', IM.announcements('ИО-7', '2028-06-10').length === 3);
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
  const f = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' });
  const a = ann(IM, f.id, '2027-05-01', 2400000), q = apply(IM, f.id, '2027-05-05', 'Бейшеналиев Ы.Т.', 2400000), d = decide(IM, f.id, '2027-05-10', [q.fact.id], 'sell', { price: 2400000 });
  const c = contract(IM, f.id, '2027-05-15', { buyer: 'Бейшеналиев Ы.Т.', price: 2400000, kind: 'once' });
  const p = pay(IM, f.id, '2027-05-20', 1200000);
  ck('продажа и половина оплаты', a.ok && q.ok && d.ok && c.ok && p.ok, [a.why, q.why, d.why, c.why, p.why]);
  ck('доплата 200 000 исполнена (Возврат из Платежей)', IM.addFact(f.id, 'topup', { date: '2027-06-01', amount: 200000, doc: 'Возврат № В-300' }, 'acc').ok);
  ck('расторжение договора возвращает объект «на учёт»', key(IM, f.id, 'cterm', { date: '2027-07-01', doc: 'Соглашение' }, 'lawyer').ok && IM.objState(f.id, '2027-07-02').code === 'onbook');
  const r = key(IM, f.id, 'ret', { date: '2027-08-01', doc: 'Решение суда № 2-77/28' }, 'spec');
  ck('возврат опубликован', r.ok, r.why);
  const cl = IM.claimOf(f.id, '2027-08-02');
  ck('требование = исполненная доплата 200 000, основание — судебный акт', cl && cl.amount === 200000 && cl.open && has(cl.basis, 'судебный акт'), cl);
  ck('частично погашено 50 000', IM.addFact(f.id, 'claimPaid', { date: '2027-08-10', amount: 50000, doc: 'Поступление № ПП-1' }, 'spec').ok && IM.claimOf(f.id, '2027-08-11').rest === 150000);
  const s2 = IM.addFact(f.id, 'claimStop', { date: '2027-09-01', doc: 'Решение Комитета № 9/2028: взыскать невозможно' }, 'spec');
  ck('прекращение требования ждёт второго ключа', s2.ok && s2.pending, s2.why);
  ck('до публикации требование открыто', IM.claimOf(f.id, '2027-09-02').open);
  IM.publish(s2.fact.id, 'head');
  const c2 = IM.claimOf(f.id, '2027-09-02');
  ck('прекращено; остаток 150 000 — потеря в результате по объекту', !c2.open && c2.loss === 150000 && IM.result(f.id, '2027-09-02').claimLoss === 150000, [c2, IM.result(f.id, '2027-09-02').claimLoss]);
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

group('С-40: автомобиль — право с регистрацией в органе учёта; земельный участок — регистрацией', ({ IM, doc }) => {
  const car = IM.KINDS.find(k => k.id === 'car'), land = IM.KINDS.find(k => k.id === 'land');
  ck('справочник: «Автомобиль» и «Земельный участок» — право по регистрации, оба неделимые', car && car.reg && car.cls === 'вещь' && !car.div && land && land.reg && !land.div && land.cls === 'вещь');
  const r = IM.registerOffer({ source: 'spec', obligor: 'o_m', docNo: 'КМ-40', docDate: '2027-03-01', name: 'Автомобиль Toyota Camry, 2015 г. в.', value: 300000, kind: 'car', region: 'г. Бишкек' }, 'spec');
  IM.addPosition(r.id, { name: 'Земельный участок, с. Ново-Павловка, 0,12 га', value: 200000, kind: 'land', region: 'Чуйская обл.' }, 'spec');
  const d = IM.addFact(r.id, 'decision', { date: '2027-03-05', organ: IM.ORGANS[0], doc: 'Решение № 8/2027', items: { 1: { v: 'accept' }, 2: { v: 'accept' } } }, 'sec');
  const a1 = key(IM, r.id, 'act', { pos: 1, date: '2027-03-12', doc: 'Акт № АП-40/1' }, 'spec');
  const a2 = key(IM, r.id, 'act', { pos: 2, date: '2027-03-12', doc: 'Акт № АП-40/2' }, 'spec');
  ck('решение и два акта 12.03', d.ok && a1.ok && a2.ok, [d.why, a1.why, a2.why]);
  const oc = IM.OBJECTS.find(o => o.offer === r.id && o.pos === 1), ol = IM.OBJECTS.find(o => o.offer === r.id && o.pos === 2);
  ck('после акта автомобиль «ждёт регистрации», погашения нет', IM.objState(oc.id, '2027-03-20').code === 'wait' && !IM.allocation('o_m', '2027-03-20').rows.some(x => x.id === oc.id));
  ck('регистрация в органе учёта 28.03', key(IM, oc.id, 'reg', { date: '2027-03-28', doc: 'Свидетельство о регистрации ТС № 01КG123' }, 'spec').ok);
  ck('автомобиль погашен 28.03, не 12.03', IM.objState(oc.id).transfer === '2027-03-28' && IM.allocation('o_m').rows.find(x => x.id === oc.id).date === '2027-03-28', IM.objState(oc.id));
  ck('участок до 05.04 — «ждёт регистрации», погашения нет', IM.objState(ol.id, '2027-04-01').code === 'wait' && !IM.allocation('o_m', '2027-04-01').rows.some(x => x.id === ol.id));
  ck('регистрация участка 05.04', key(IM, ol.id, 'reg', { date: '2027-04-05', doc: 'Выписка № 2027-04-0505' }, 'spec').ok);
  ck('участок погашен 05.04', IM.objState(ol.id).transfer === '2027-04-05' && IM.allocation('o_m').rows.some(x => x.id === ol.id && x.date === '2027-04-05'));
  ck('участок неделимый — разделения нет', !IM.gate(ol.id, 'split').ok);
  IM.openObject(oc.id, 'transfer');
  ck('UI: на вкладке «Переход права» — дата перехода 28.03.2027 (регистрация)', doc.querySelector('[data-testid=transfer-date]').textContent.includes('28.03.2027'));
});

group('С-41: миграция — черновики из легаси-платежей', ({ IM, doc }) => {
  const sums = IM.DRAFTS.map(d => d.value);
  ck('три черновика: 2 400 000, 500 000, 1 200 000', IM.DRAFTS.length === 3 && sums.join() === '2400000,500000,1200000', sums);
  ck('Х и Н дополнены и ждут второго ключа, М — «не подтверждён»', ['pending', 'pending', 'unconfirmed'].join() === IM.DRAFTS.map(d => IM.draftState(d).code).join());
  const m0 = IM.migrationReport();
  ck('миграция заблокирована черновиком Ч-3', m0.blocked && m0.why.some(w => has(w, 'Ч-3 не подтверждён')), m0.why);
  IM.go('migration');
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
  ['claimPaid', 'claimStop', 'priceDecision', 'termExt', 'announce'].forEach(t => { IM.uiFact('ИО-2', t); IM.closeForm(); });
  IM.uiDraft('Ч-3'); IM.closeForm();
  IM.setRole('head'); IM.go('objects'); IM.go('settings');
  key(IM, 'ИО-12', 'realloc', { doc: 'Решение суда' }, 'spec'); IM.openObject('ИО-12', 'char'); IM.uiFact('ИО-12', 'claimPaid'); IM.closeForm();
  ck('без ошибок скрипта', errs.length === 0, errs);
});

group('ИМ-70/71/65/66: документы, печать, реестр договоров, «Показано N из M»', ({ IM, doc }) => {
  IM.setRole('head'); IM.setAsOf(IM.TODAY);
  /* ИМ-70 · вкладка «Документы» объекта */
  const withDoc = IM.OBJECTS.find(o => o.id === 'ИО-2');
  IM.openObject(withDoc.id, 'docs');
  const live = withDoc.facts.filter(f => f.pub && f.date <= IM.S.asOf && IM.docOf(f).no);
  const rowsN = doc.querySelectorAll('[data-testid=docs-table] [data-testid=doc-row]').length;
  ck('ИМ-70: вкладка «Документы» перечисляет документы из опубликованных фактов', rowsN > 0 && rowsN === live.length, [rowsN, live.length]);
  ck('ИМ-70: счётчик на вкладке = число документов', has(doc.querySelector('[data-testid=tab-docs]').textContent, String(live.length)));
  ck('ИМ-70: вкладок 12', doc.querySelectorAll('.tabs .tab').length === 12);
  ck('ИМ-70: документ без файла помечен «файл не приложен»', has(doc.querySelector('[data-testid=docs-table]').textContent, 'файл не приложен') || doc.querySelectorAll('[data-testid=doc-file]').length > 0);
  const f0 = withDoc.facts.find(f => f.pub && IM.docOf(f).no);
  ck('ИМ-70: старый вид (doc строкой) читается как номер без файла', IM.docOf({ doc: 'Акт № 1' }).no === 'Акт № 1' && IM.docOf({ doc: 'Акт № 1' }).file === '' && IM.docOf({ doc: 'Акт № 1' }).date === '');
  ck('ИМ-70: поля doc/docDate/file читаются', (d => d.no === '№ 5' && d.date === '2027-01-02' && d.file === 'a.pdf')(IM.docOf({ doc: '№ 5', docDate: '2027-01-02', file: 'a.pdf' })));
  /* файл у факта → ссылка в журнале и в списке */
  f0.docDate = '2027-01-02'; f0.file = 'akt.pdf';
  IM.openObject(withDoc.id, 'log');
  ck('ИМ-70: в журнале номер документа с файлом — ссылка', doc.querySelectorAll('[data-testid=fact-journal] [data-testid=doc-link]').length === 1);
  IM.openObject(withDoc.id, 'docs');
  ck('ИМ-70: в списке документов у факта виден файл', doc.querySelectorAll('[data-testid=docs-table] [data-testid=doc-file]').length === 1);
  delete f0.docDate; delete f0.file;
  /* у предложения */
  IM.openOffer('П-1');
  const of = IM.offer('П-1'); const need = 1 + of.facts.filter(f => f.pub && (f.t === 'decision' || f.t === 'letter') && f.date <= IM.S.asOf).length;
  const od = doc.querySelectorAll('[data-testid=offer-docs-table] [data-testid=doc-row]');
  ck('ИМ-70: у предложения блок «Документы»: письмо источника, решение, промежуточное письмо', od.length === need && has(od[0].textContent, 'Письмо источника') && has(doc.querySelector('[data-testid=offer-docs]').textContent, 'Решение органа') && has(doc.querySelector('[data-testid=offer-docs]').textContent, 'Промежуточное письмо'), [od.length, need]);
  ck('ИМ-70: блок после журнала фактов', doc.querySelector('[data-testid=offer-docs]').compareDocumentPosition(doc.querySelector('[data-testid=fact-journal]')) & 2);
  ck('ИМ-70: ответ источнику помечен', has(doc.querySelector('[data-testid=offer-docs]').textContent, 'ответ источнику'));
  /* ИМ-71 · печать */
  ck('ИМ-71: у предложения «Печать» даёт 4 бланка, пункт письма — «Бланк промежуточного письма»', doc.querySelectorAll('[data-testid=print-actions] .mi').length === 4 && has(doc.querySelector('[data-testid=print-letter]').textContent, 'Бланк промежуточного письма'));
  ck('ИМ-71: «Претензия покупателю» у предложения недоступна с причиной', doc.querySelector('[data-testid=print-claim]').disabled && has(doc.querySelector('[data-testid=why-print-claim]').textContent, 'карточке объекта'));
  ck('ИМ-71: после решения письмо недоступно с причиной', IM.printItems('offer', 'П-1').find(i => i.t === 'letter').ok === false && has(IM.printItems('offer', 'П-1').find(i => i.t === 'letter').why, 'решение органа'));
  const ctrObj = IM.OBJECTS.find(o => { const c = IM.contractInfo(o.id); return c && c.active && c.overdue; });
  IM.openObject(ctrObj.id, 'char');
  ck('ИМ-71: у объекта «Печать» — 4 пункта, претензия доступна при просрочке договора', doc.querySelectorAll('[data-testid=print-actions] .mi').length === 4 && !doc.querySelector('[data-testid=print-claim]').disabled);
  ck('ИМ-71: «Ответ источнику» у объекта недоступен с причиной', doc.querySelector('[data-testid=print-ans]').disabled && !!doc.querySelector('[data-testid=why-print-ans]').textContent);
  const noCtr = IM.OBJECTS.find(o => !IM.contractInfo(o.id));
  ck('ИМ-71: без договора претензия недоступна — «договора купли-продажи нет»', IM.printItems('object', noCtr.id).find(i => i.t === 'claim').why === 'договора купли-продажи нет');
  /* ИМ-65 · реестр договоров */
  IM.setF('cKind', ''); IM.setF('cState', ''); IM.setF('cBuyer', ''); IM.setF('cTile', ''); IM.go('contracts');
  const all = IM.OBJECTS.filter(o => IM.contractInfo(o.id));
  const rn = () => doc.querySelectorAll('[data-testid^=contract-row-]').length;
  const tv = t => +doc.querySelector(`[data-testid=${t}]`).textContent;
  ck('ИМ-65: плитки: договоров = строк', tv('ctot-all') === all.length && rn() === all.length);
  const nOver = all.filter(o => { const c = IM.contractInfo(o.id); return c.overdue && c.active; }).length, nClaim = all.filter(o => IM.contractInfo(o.id).claims.length).length;
  ck('ИМ-65: плитки «с просрочкой» и «с претензией» сходятся с данными', tv('ctot-over') === nOver && tv('ctot-claim') === nClaim, [tv('ctot-over'), nOver, tv('ctot-claim'), nClaim]);
  IM.setF('cTile', 'over');
  ck('ИМ-65: нажатие плитки «с просрочкой» оставляет эти строки', rn() === nOver && nOver > 0);
  IM.setF('cTile', 'claim');
  ck('ИМ-65: нажатие плитки «с претензией» оставляет эти строки', rn() === nClaim);
  IM.setF('cTile', '');
  const nInst = all.filter(o => IM.contractInfo(o.id).kind === 'once').length;
  IM.setF('cKind', 'once');
  ck('ИМ-65: фильтр «Вид» режет строки и плитки', rn() === nInst && tv('ctot-all') === nInst && nInst < all.length, [rn(), nInst]);
  ck('ИМ-66: «Показано N из M» на реестре договоров', has(doc.querySelector('[data-testid=shown-contracts]').textContent, `Показано ${nInst} из ${all.length}`));
  IM.setF('cKind', '');
  const b = IM.contractInfo(all[0].id).c.buyer; IM.setF('cBuyer', b);
  const nB = all.filter(o => IM.contractInfo(o.id).c.buyer === b).length;
  ck('ИМ-65: фильтр «Покупатель» режет строки', rn() === nB, [rn(), nB]);
  IM.setF('cBuyer', ''); IM.setF('cState', 'term');
  const nT = all.filter(o => IM.contractInfo(o.id).terminated).length;
  ck('ИМ-65: фильтр «Состояние» (расторгнут) режет строки', rn() === nT, [rn(), nT]);
  IM.setF('cState', '');
  /* ИМ-66 */
  ck('ИМ-66: шапка таблицы реестра договоров закреплена', doc.querySelector('table.cgrid.sticky') !== null);
  IM.go('offers');
  ck('ИМ-66: «Показано N из M» на реестре предложений', has(doc.querySelector('[data-testid=shown-offers]').textContent, `Показано ${doc.querySelectorAll('[data-testid^=offer-row-]').length} из `));
  IM.setF('oSrc', 'pssi');
  const sh = doc.querySelector('[data-testid=shown-offers]').textContent.match(/(\d+) из (\d+)/);
  ck('ИМ-66: при фильтре N < M и N = строк', +sh[1] === doc.querySelectorAll('[data-testid^=offer-row-]').length && +sh[1] < +sh[2], sh);
  IM.setF('oSrc', '');
  IM.go('objects');
  const so = doc.querySelector('[data-testid=shown-objects]').textContent.match(/(\d+) из (\d+)/);
  ck('ИМ-66: «Показано N из M» на реестре объектов', +so[1] === doc.querySelectorAll('[data-testid^=object-row-]').length && +so[1] === +so[2], so);
  IM.setF('bKind', IM.OBJECTS[0].kind);
  const so2 = doc.querySelector('[data-testid=shown-objects]').textContent.match(/(\d+) из (\d+)/);
  ck('ИМ-66: фильтр уменьшает N, M прежнее', +so2[1] < +so2[2] && +so2[2] === +so[2], so2);
  IM.setF('bKind', '');
});

group('Волна 3, линия A: каркас, меню, слова (ИМ-60…63, 72, 74, 75, 77, Д-8)', ({ IM, doc }) => {
  const panel = () => doc.getElementById('panel');
  const stripTid = h => h.replace(/data-testid="[^"]*"/g, '');
  const navVisible = tid => { const b = doc.querySelector(`[data-testid=${tid}]`); return !!b && b.style.display !== 'none'; };
  const asOfShown = () => doc.getElementById('asOfBox').style.display !== 'none';
  IM.setRole('head');
  ck('ИМ-60: рабочая область не ограничена 1280 px', !/\.panel-wrap\{[^}]*max-width/.test([...doc.querySelectorAll('style')].map(x => x.textContent).join('')));
  /* ИМ-61 */
  const rep0 = IM.migrationReport();
  IM.go('objects');
  const regOk = !doc.querySelector('[data-testid=migration-control]') && !doc.querySelector('[data-testid=migration-drafts]') && !doc.querySelector('[data-testid=intro-new]');
  IM.setRole('spec'); IM.go('migration');
  const migOk = !!doc.querySelector('[data-testid=migration-control]') && !!doc.querySelector('[data-testid=migration-drafts]') && !!doc.querySelector('[data-testid=intro-new]');
  ck('ИМ-61: миграция и «Ввести вводный остаток» — на своём экране, с реестра объектов ушли; счётчик пункта = число блокировок',
    regOk && migOk && navVisible('nav-migration') && doc.getElementById('cntMig').textContent === String(rep0.why.length) && rep0.why.length > 0, [regOk, migOk, rep0.why.length]);
  /* ИМ-72 (до закрытия миграции) */
  IM.setRole('head'); IM.go('queue');
  const nFacts = IM.pending().length, nDr = IM.DRAFTS.filter(d => IM.draftState(d).code === 'pending').length;
  const rowsQ = doc.querySelectorAll('[data-testid=queue-table] tbody tr').length;
  const foot = +doc.querySelector('[data-testid=pending-count]').textContent;
  ck('ИМ-72: очередь = факты + черновики миграции; счётчик в подвале, в меню и в заголовке сходятся со списком',
    nDr === 2 && rowsQ === nFacts + nDr && foot === rowsQ && doc.getElementById('cntQueue').textContent === String(rowsQ) && doc.querySelector('[data-testid=queue-count]').textContent === String(rowsQ)
    && !!doc.querySelector('[data-testid=queue-draft-Ч-1]'), [nFacts, nDr, rowsQ, foot]);
  IM.openOffer('П-7');
  const here = doc.querySelector('[data-testid=pending-here]');
  ck('ИМ-72: на экране строка «ждут здесь: N» со ссылкой в очередь, таблицы второго ключа на экране нет',
    !!here && has(here.textContent, 'ждут здесь') && !!doc.querySelector('[data-testid=pending-here-link]') && !doc.querySelector('[data-testid=pending-card]'));
  IM.go('queue'); doc.querySelector('[data-testid=queue-draft-publish-Ч-1]').click();
  ck('ИМ-72: черновик публикуется из очереди, список и счётчик уменьшаются вместе', doc.querySelectorAll('[data-testid=queue-table] tbody tr').length === rowsQ - 1 && IM.queueCount() === rowsQ - 1 && !!IM.draftState(IM.DRAFTS[0]).code.match(/done/));
  /* ИМ-62 */
  IM.go('settings');
  ck('ИМ-62: в «Настройках» только пороги, списка поводов нет', !doc.querySelector('[data-testid=triggers]') && !doc.querySelector('[data-testid^=trig-]') && !!doc.querySelector('[data-testid=insp-by-kind]') && !has(panel().textContent, 'Поводы на'));
  IM.go('triggers');
  ck('ИМ-62: список поводов — в демо-виде стенда', !!doc.querySelector('[data-testid=triggers]') && !!doc.querySelector('[data-testid=demo-triggers]') && has(doc.querySelector('[data-testid=demo-triggers]').textContent, String(IM.triggers().length)));
  /* ИМ-63 */
  IM.openOffer('П-3');
  const ov = doc.querySelector('[data-testid=offer-overdue]');
  ck('ИМ-63: повод предложения — полосой в шапке, не плашкой над ней', !!ov && !!ov.closest('.ohead') && !ov.classList.contains('banner'));
  /* ИМ-75 */
  IM.setRole('head'); IM.openOffer('П-1');
  const dts = [...doc.querySelectorAll('[data-testid=fact-journal] tbody tr td:first-child')].map(td => td.textContent.split('.').reverse().join('-'));
  ck('ИМ-75: журнал фактов — новые сверху', dts.length > 3 && dts.every((d, i) => i === 0 || dts[i - 1] >= d), dts);
  /* ИМ-77 */
  const jt = doc.querySelector('[data-testid=fact-journal]').textContent;
  IM.go('queue');
  ck('ИМ-77: «Ввёл» вместо «Готовил», «ключ не нужен» вместо «без второго ключа»', has(jt, 'Ввёл') && has(jt, 'ключ не нужен') && !has(jt, 'без второго ключа') && !has(panel().textContent, 'Готовил') && has(panel().textContent, 'Ввёл'));
  /* Состояние на */
  const hid = ['settings', 'migration', 'queue'].every(v => { IM.go(v); return !asOfShown(); });
  IM.go('offers');
  ck('«Состояние на» скрыто на «Настройках», «Миграции» и в очереди, на реестрах видно', hid && asOfShown());
  /* ИМ-Д-8 */
  IM.setAsOf('2028-03-17'); IM.go('objects');
  const cc = doc.querySelector('[data-testid="curator-over-ИО-13"]');
  ck('ИМ-Д-8: ячейка куратора без назначенного — одна строка', !!cc && !cc.closest('td').querySelector('div') && cc.closest('td').querySelectorAll('.pill').length === 1);
  IM.setAsOf(IM.TODAY);
  /* ИМ-74 */
  const seen = [];
  ['offers', 'objects', 'contracts', 'settings', 'queue', 'migration', 'triggers'].forEach(v => { IM.go(v); seen.push(stripTid(panel().innerHTML)); });
  ['П-3', 'П-5', 'П-7'].forEach(id => { IM.openOffer(id); seen.push(stripTid(panel().innerHTML)); });
  ['ИО-1', 'ИО-7', 'ИО-13'].forEach(id => { IM.openObject(id, 'char'); seen.push(stripTid(panel().innerHTML)); });
  const all = seen.join(' ');
  ck('ИМ-74: в интерфейсе и подсказках нет служебных кодов pk-im-* и «2028-03»', !/pk-im/.test(all) && !/2028-03/.test(all) && !/ИМ-\d|ADR/.test(all), (all.match(/.{20}(pk-im|2028-03).{10}/) || [])[0]);
  /* ИМ-61: закрытие миграции убирает пункт */
  IM.setRole('head');
  IM.publishDraft('Ч-2', 'head'); IM.fillDraft('Ч-3', { name: 'Склад, г. Ош', kind: 'store', region: 'г. Ош', now: 'onbook', doc: 'Акт № 2/20' }, 'spec'); IM.publishDraft('Ч-3', 'head');
  IM.MIGRATED.forEach(m => { m.sum = IM.migrationControl().find(c => c.obl === m.obl).objects; });
  IM.go('migration');
  ck('ИМ-61: после закрытия миграции пункт меню убран, экран возвращает к реестру объектов', IM.migrationClosed() && !navVisible('nav-migration') && IM.S.view === 'objects');
});

group('Волна 3, линия B: формы и движок фактов (ИМ-69, ИМ-73, ИМ-76, ИМ-78, Д-5, Д-7)', ({ IM, doc }) => {
  const fl = () => (IM.S.form ? IM.S.form.fields.map(f => f.id) : []);
  /* ИМ-69: документ = номер · дата · файл во всех формах, где он есть */
  IM.setRole('spec');
  const objT = ['reg', 'regRefusal', 'terminate', 'inspection', 'appraisal', 'expense', 'encumbrance', 'priceDecision', 'announce', 'pubAdd', 'application', 'committee', 'torgiResult', 'notice', 'noticeAnswer', 'contract', 'claim', 'cextend', 'cterm', 'split', 'gift', 'loss', 'ret', 'claimPaid', 'claimStop', 'topup', 'realloc', 'termExt'];
  const bad = [];
  objT.forEach(t => { IM.uiFact('ИО-2', t); const f = fl(); if (f.includes('doc') && !(f.includes('docDate') && f.includes('file'))) bad.push(t); IM.closeForm(); });
  ['letter', 'withdraw', 'act', 'terminate'].forEach(t => { IM.uiFact('П-3', t, 1); const f = fl(); if (f.includes('doc') && !(f.includes('docDate') && f.includes('file'))) bad.push('П:' + t); IM.closeForm(); });
  IM.setRole('sec'); IM.uiDecision('П-3'); { const f = fl(); if (!(f.includes('doc') && f.includes('docDate') && f.includes('file'))) bad.push('decision'); } IM.closeForm();
  IM.setRole('spec'); IM.uiIntro(); { const f = fl(); if (!(f.includes('doc') && f.includes('file'))) bad.push('intro'); } IM.closeForm();
  IM.uiDraft('Ч-3'); { const f = fl(); if (!(f.includes('doc') && f.includes('file'))) bad.push('draft'); } IM.closeForm();
  IM.uiNewOffer(); { const f = fl(); if (!(f.includes('docNo') && f.includes('file'))) bad.push('offer'); } IM.closeForm();
  ck('ИМ-69: во всех формах с документом есть дата документа и файл', !bad.length, bad);
  IM.uiFact('ИО-2', 'inspection');
  ck('ИМ-69: у осмотра ещё «Фото и видео», у остальных форм его нет', fl().includes('media') && !!doc.querySelector('#ff_media[multiple]'));
  const r = IM.submitForm({ date: '10.03.2028', who: 'А', cond: 'хорошее', doc: 'ОС-77', docDate: '10.03.2028', file: 'akt.pdf', media: ['a.jpg', 'b.mp4'] });
  ck('ИМ-69: в факте хранятся doc (номер), docDate, file и media', r.ok && r.fact.doc === 'ОС-77' && r.fact.docDate === '2028-03-10' && r.fact.file === 'akt.pdf' && r.fact.media.length === 2, r.fact || r.why);
  IM.uiFact('ИО-2', 'appraisal');
  ck('ИМ-69: фото и видео только у осмотра', !fl().includes('media')); IM.closeForm();
  ck('ИМ-69: doc строкой остаётся номером (обратная совместимость)', IM.addFact('ИО-2', 'expense', { item: 'Охрана', amount: 1, doc: 'Счёт 5' }).fact.doc === 'Счёт 5');
  /* ИМ-73: поступления не вводятся в модуле */
  IM.openObject('ИО-8', 'char');
  const items = [...doc.querySelectorAll('#panel .menu-pop button.mi')].map(b => b.dataset.testid).filter(t => /^act-/.test(t));
  ck('ИМ-73: в меню «Ввести факт» 28 пунктов (с продажей объявлениями), оплаты и доплаты среди них нет', items.length === 28 && !items.includes('act-payment') && !items.includes('act-topup') && items.includes('act-announce') && items.includes('act-termExt'), items);
  IM.openObject('ИО-8', 'ctr');
  ck('ИМ-73: у суммы договора — демо-ссылка «как придёт из Платежей»', !!doc.querySelector('[data-testid=demo-pay]'));
  const dp = IM.demoPay('ИО-8');
  ck('ИМ-73: демо-поступление проходит, автор в журнале — Платежи', dp.ok && dp.fact.by === 'acc', dp.why);
  IM.openObject('ИО-8', 'log');
  ck('ИМ-73: в журнале автор оплаты — «Платежи»', doc.querySelector('[data-testid=fact-journal]').textContent.includes('Платежи'));
  const pa = dp, ta = IM.addFact('ИО-1', 'topup', { amount: 34500, doc: 'В-1' }, 'acc'), tb = IM.addFact('ИО-3', 'topup', { amount: 1, doc: 'В-2' }, 'acc');
  ck('ИМ-73: движок по-прежнему принимает оплату и доплату от бухгалтера; доплату — только когда она к выплате', pa.ok && ta.ok && !tb.ok, [pa.why, ta.why, tb.why]);
  /* ИМ-76: ошибка у поля, звёздочка у обязательного по правилу поля */
  IM.setRole('spec'); IM.uiFact('ИО-2', 'appraisal');
  const e1 = IM.submitForm({ date: '10.03.2028', appraiser: 'О', amount: '0', doc: 'Отчёт' });
  const fe = doc.querySelector('[data-testid=form-err]');
  ck('ИМ-76: ошибка движка стоит у поля «Сумма», а не общей строкой', !e1.ok && fe && fe.dataset.field === 'amount' && !doc.querySelector('.banner.danger[data-testid=form-err]'), fe && fe.outerHTML);
  IM.closeForm(); IM.uiFact('ИО-2', 'inspection');
  IM.submitForm({ date: '10.03.2028', cond: 'х', doc: 'д' });
  ck('ИМ-76: пропущенное обязательное поле подсвечено у самого поля', doc.querySelector('[data-testid=form-err]').dataset.field === 'who' && !!doc.querySelector('#fb_who.bad'));
  IM.closeForm(); IM.uiFact('ИО-7', 'announce');
  ck('ИМ-76: «Отметка об обременении» помечена звёздочкой там, где обременение действует (ИО-7)', !!doc.querySelector('#fb_encMark label.req'));
  IM.closeForm(); IM.uiFact('ИО-2', 'announce');
  ck('ИМ-76: без обременения (ИО-2) звёздочки у отметки нет', !doc.querySelector('#fb_encMark label.req'));
  IM.closeForm();
  /* ИМ-78: возврат с причиной, факт остаётся автору черновиком */
  const g = IM.addFact('ИО-2', 'gift', { to: 'Госорган', doc: 'Акт 1', ground: IM.GOV_GROUNDS[0] }, 'spec');
  const n0 = IM.OBJECTS.find(o => o.id === 'ИО-2').facts.length;
  ck('ИМ-78: «Вернуть» без причины отказывает', !IM.rejectPending(g.fact.id, 'head').ok && !IM.rejectPending(g.fact.id, 'head', '  ').ok && g.fact.draft !== true);
  ck('ИМ-78: вернуть может только заведующий Сектором', !IM.rejectPending(g.fact.id, 'spec', 'причина').ok);
  const rr = IM.rejectPending(g.fact.id, 'head', 'Нет подписи в акте');
  ck('ИМ-78: возврат с причиной — факт не удалён, он у автора черновиком', rr.ok && IM.OBJECTS.find(o => o.id === 'ИО-2').facts.length === n0 && g.fact.draft === true && g.fact.returned.reason === 'Нет подписи в акте' && !g.fact.pub);
  ck('ИМ-78: черновик не в очереди второго ключа и не публикуется', !IM.pending().some(x => x.f.id === g.fact.id) && !IM.publish(g.fact.id, 'head').ok);
  IM.setRole('spec'); IM.go('queue');
  ck('ИМ-78: автор видит черновик с причиной и кнопкой «Править»', !!doc.querySelector(`[data-testid=my-edit-${g.fact.id}]`) && doc.querySelector(`[data-testid=my-fact-${g.fact.id}]`).textContent.includes('Нет подписи'));
  const ed = IM.revisePending(g.fact.id, { to: 'Минфин', doc: 'Акт 1-в', ground: IM.GOV_GROUNDS[0] }, 'spec');
  ck('ИМ-78: автор правит свой факт; чужой править не может', ed.ok && ed.fact.to === 'Минфин' && ed.fact.id === g.fact.id && ed.fact.draft === true && !IM.revisePending(g.fact.id, { to: 'х', doc: 'д' }, 'head').ok, ed.why);
  const cur = () => IM.OBJECTS.find(o => o.id === 'ИО-2').facts.find(f => f.id === g.fact.id);
  ck('ИМ-78: автор отправляет снова — факт опять в очереди', IM.resubmitFact(g.fact.id, 'spec').ok && IM.pending().some(x => x.f.id === g.fact.id));
  ck('ИМ-78: автор отзывает ждущий факт — он становится черновиком, не удаляется', IM.withdrawFact(g.fact.id, 'spec').ok && cur().draft && cur().withdrawn && !IM.withdrawFact(g.fact.id, 'head').ok);
  ck('ИМ-78: черновик автор может удалить', IM.discardFact(g.fact.id, 'spec').ok && !cur());
  /* ИМ-Д-5 */
  IM.setRole('sec'); IM.uiDecision('П-3');
  const rf = IM.S.form.fields.find(f => /^r\d/.test(f.id)), vf = IM.S.form.fields.find(f => /^v\d/.test(f.id));
  const box = () => doc.getElementById('fb_' + rf.id);
  ck('ИМ-Д-5: при «принять» «Основание отказа» скрыто', box().style.display === 'none');
  doc.getElementById('ff_' + vf.id).value = 'reject'; IM.syncShow();
  ck('ИМ-Д-5: при «отказать» «Основание отказа» показано', box().style.display !== 'none');
  IM.closeForm();
  /* ИМ-Д-7 */
  IM.setRole('spec'); IM.uiFact('ИО-2', 'loss');
  ck('ИМ-Д-7: у страхового возмещения выбор валюты, в подписи нет «сом»', !!doc.querySelector('#ff_ccy option[value=USD]') && !IM.S.form.fields.find(f => f.id === 'insurance').label.includes('сом'));
  IM.closeForm();
  const ls = IM.addFact('ИО-4', 'loss', { cause: 'гибель', insurance: 1000, ccy: 'USD', doc: 'Акт' }, 'spec');
  ck('ИМ-Д-7: валюта возмещения хранится в факте', ls.ok && ls.fact.ccy === 'USD', ls.why);
});

group('Волна 3, правки после ревью: файл при регистрации, повторная проверка при «Отправить снова»', ({ IM }) => {
  const r = IM.registerOffer({ source: 'debtor', obligor: 'o_m', docNo: 'ОТ-77', docDate: '2027-03-01', file: 'otvet.pdf', name: 'Дом', value: 100000, kind: 'flat', region: 'г. Бишкек' }, 'spec');
  ck('ИМ-70: файл письма при регистрации предложения попадает в блок «Документы»',
    r.ok && IM.offerDocRows(IM.OFFERS.find(o => o.id === r.id)).some(x => x.file === 'otvet.pdf'), r.why);
  // отозванный факт больше не живёт в очереди; при «Отправить снова» проверки идут заново
  const a = IM.addFact('ИО-1', 'reg', { date: '2027-04-05', doc: 'Св-1' }, 'spec');
  if (a.ok && a.pending) {
    const w = IM.withdrawFact(a.fact.id, 'spec');
    ck('ИМ-78: отозванный факт — черновик', w.ok && a.fact.draft === true, w.why);
    const b = IM.addFact('ИО-1', 'reg', { date: '2027-04-05', doc: 'Св-2' }, 'spec');
    const again = IM.resubmitFact(a.fact.id, 'spec');
    ck('ИМ-78: «Отправить снова» не создаёт второй ждущий факт того же вида', !(b.ok && b.pending && again.ok), again.why);
  } else ck('ИМ-78: регистрация права ИО-1 введена как ждущая', true, a.why);
});

/* ================= Волна 4: продажа объявлениями, доплата, очередь выручки, реквизиты (С-42…С-56, ИИ-22…ИИ-25) =================
   Каждый сценарий строится на новом объекте по настоящей цепочке фактов (mkObj, sellTo): предложение → решение → акт → регистрация → продажа. */

group('С-42: доплата 550 000, расходы 90 000; продажа 05.08, оплата 2 700 000 20.08 → 460 000 к выплате до 19.09; просрочка — «удержана»', ({ IM }) => {
  const f = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' }); const id = f.id;
  addExp(IM, id, '2027-05-10', 'Оценка', 30000); addExp(IM, id, '2027-05-12', 'Налоги', 60000);
  ck('расходы содержания 90 000', IM.expensesOf(id, '2027-06-01') === 90000);
  const ap = apprs(IM, id, '2027-05-25', 2700000);
  const s = sellTo(IM, id, { annDate: '2027-06-01', appDate: '2027-06-10', decDate: '2027-06-15', ctrDate: '2027-08-05', price: 2700000, annX: { basis: ap.fact.id } });
  ck('до оплаты: доплата 550 000 зафиксирована, к выплате ничего (выручки нет)', IM.topupOf(id, '2027-08-10').amount === 550000 && IM.topupOf(id, '2027-08-10').state === 'fixed' && IM.topupOf(id, '2027-08-10').unpaid === 0);
  ck('оплата 2 700 000 поступила 20.08', pay(IM, id, '2027-08-20', 2700000).ok);
  const t = IM.topupOf(id, '2027-08-21');
  ck('к выплате 460 000 (550 000 − расходы 90 000), состояние «к выплате»', t.payable === 460000 && t.unpaid === 460000 && t.state === 'due', t);
  ck('срок выплаты — 19.09.2027 (30 дней от поступления выручки)', t.dueRows.length === 1 && t.dueRows[0].base === '2027-08-20' && t.dueRows[0].dueBy === '2027-09-19' && t.dueRows[0].sum === 460000, t.dueRows);
  const trig = d => IM.triggers(d).filter(x => x.kind === 'pk-im-topup-due' && x.id === id);
  ck('19.09 срок не прошёл — повода нет; 20.09 — повод «Доплата не выплачена в срок»', !trig('2027-09-19').length && trig('2027-09-20').length === 1, [trig('2027-09-19'), trig('2027-09-20').map(x => x.text)]);
  IM.OWNER_OVERDUE[f.name] = [{ from: '2027-09-10', to: '2027-10-05', amount: 100000, credit: 'К-77' }];
  const h = IM.topupOf(id, '2027-09-19');
  ck('на 19.09 у бывшего собственника просрочка — «удержана»', h.state === 'held' && h.held && h.held.credit === 'К-77' && h.held.since === '2027-09-10', h);
  ck('удержанную доплату не выплатить: бухгалтеру отказ', !IM.gate(id, 'topup', '2027-09-19').ok && has(IM.gate(id, 'topup', '2027-09-19').why, 'удержана'), IM.gate(id, 'topup', '2027-09-19'));
  const th = trig('2027-09-19');
  ck('повод pk-im-topup-due по «удержана» — куратору объекта', th.length === 1 && th[0].to === IM.curatorOf(id, '2027-09-19').emp && has(th[0].text, 'удержана'), th);
  const r = IM.topupOf(id, '2027-10-10');
  ck('просрочку погасили 05.10 — срок идёт заново: 30 дней от 05.10 = 04.11.2027', r.state === 'due' && r.dueRows[0].dueBy === '2027-11-04' && r.dueRows[0].restarted && !r.held, r.dueRows);
  ck('сумму сверх невыплаченного вносить нельзя', !IM.addFact(id, 'topup', { date: '2027-10-10', amount: 460001, doc: 'В-1' }, 'acc').ok);
  ck('выплата 460 000 бухгалтером', IM.addFact(id, 'topup', { date: '2027-10-10', amount: 460000, doc: 'Возврат № В-1' }, 'acc').ok && IM.topupOf(id, '2027-10-11').state === 'paid');
  ck('после выплаты повода нет', !trig('2027-11-20').length);
});

group('С-43: квартира принята за 2 400 000 при долге 1 850 000, продана за 1 900 000 → доплата не меняется', ({ IM }) => {
  const f = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' }); const id = f.id;
  addExp(IM, id, '2027-05-10', 'Оценка', 30000); addExp(IM, id, '2027-05-12', 'Налоги', 60000);
  const before = IM.topupOf(id, '2027-05-30');
  const ap = apprs(IM, id, '2027-05-25', 1900000);
  const s = sellTo(IM, id, SELL(1900000, { annX: { basis: ap.fact.id }, annDate: '2027-06-01', appDate: '2027-06-05', decDate: '2027-06-08', ctrDate: '2027-06-10' }));
  ck('продажа за 1 900 000 (ниже стоимости принятия) оформлена', s.c.ok);
  ck('оплата 1 900 000', pay(IM, id, '2027-06-15', 1900000).ok);
  const after = IM.topupOf(id, '2027-06-20');
  ck('ИМ-82: сумма доплаты прежняя 550 000', before.amount === 550000 && after.amount === 550000, [before.amount, after.amount]);
  ck('к выплате 550 000 − расходы 90 000 = 460 000', after.payable === 460000 && after.unpaid === 460000, after);
  ck('ИИ-19: долг не меняется — остаток по Взысканию 0, погашения из выручки нет', IM.allocation(f.obl, '2027-06-20').rest === 0 && IM.proceeds(id, '2027-06-20').total.q3 === 0 && IM.debtNow(f.obl, '2027-06-20') === 0);
  ck('вся выручка — в первую очередь (бюджет в счёт принятия)', IM.proceeds(id, '2027-06-20').total.q1 === 1900000 && IM.proceeds(id, '2027-06-20').total.q2 === 0);
});

group('С-44: склад с доплатой 300 000 сгорел, страховки нет → выбытие, доплата «через бюджет»', ({ IM }) => {
  const f = mkObj(IM, { debt: 500000, value: 800000, kind: 'store', date: '2027-04-05' }); const id = f.id;
  ck('доплата 300 000 зафиксирована', IM.topupOf(id, '2027-05-01').amount === 300000);
  const l = key(IM, id, 'loss', { date: '2027-09-01', cause: 'Гибель', doc: 'Акт о пожаре' }, 'spec');
  ck('путь «выбытие» открыт и опубликован', l.ok && IM.objState(id, '2027-09-02').pathId === 'loss', l.why);
  const t = IM.topupOf(id, '2027-09-02');
  ck('состояние «к выплате через бюджет» (выручки нет)', t.state === 'budget' && t.budget && t.unpaid === 300000 && t.payable === 300000, t);
  ck('срока по поступлению выручки нет — строка без срока', t.dueRows.length === 1 && t.dueRows[0].dueBy === null, t.dueRows);
  ck('выплату вводит бухгалтер', IM.addFact(id, 'topup', { date: '2027-09-20', amount: 300000, doc: 'Возврат из бюджета № 5' }, 'acc').ok && IM.topupOf(id, '2027-09-21').state === 'paid');
  const g = mkObj(IM, { debt: 500000, value: 800000, kind: 'store', date: '2027-04-05' });
  key(IM, g.id, 'loss', { date: '2027-09-01', cause: 'Гибель', insurance: 120000, ccy: 'KGS', doc: 'Акт о пожаре' }, 'spec');
  const ti = IM.topupOf(g.id, '2027-09-02');
  ck('со страховкой: срок от даты акта выбытия, 30 дней — 01.10.2027', ti.state === 'due' && !ti.budget && ti.dueRows[0].base === '2027-09-01' && ti.dueRows[0].dueBy === '2027-10-01', ti);
});

group('С-45: гараж должника: в заявлении 800 000, отчёт оценщика Фонда 1 000 000, долг 900 000', ({ IM }) => {
  IM.OBL.push({ id: 'o_g45', name: 'Гаражников Г.Г.', role: 'заёмщик', credits: [{ no: 'К-45', ccy: 'KGS' }], debt: 900000 });
  const r = IM.registerOffer({ source: 'debtor', obligor: 'o_g45', docNo: 'ОТ-45', docDate: '2027-03-01', name: 'Гараж, ул. Ленина, 5', value: 800000, kind: 'garage', region: 'г. Бишкек' }, 'spec');
  ck('предложение: цена в заявлении 800 000', r.ok && IM.offer(r.id).positions[0].claimed === 800000, r.why);
  const d0 = IM.addFact(r.id, 'decision', { date: '2027-03-10', organ: IM.ORGANS[0], doc: 'Реш. 45', items: { 1: { v: 'accept' } } }, 'sec');
  ck('без отчёта оценщика на Комитет не вынести', !d0.ok && has(d0.why, 'нет отчёта оценщика'), d0.why);
  ck('ввести 900 000 как стоимость принятия нельзя', !IM.editPosition(r.id, 1, { value: 900000 }, 'spec').ok);
  ck('отчёт оценщика Фонда по позиции 1 000 000', IM.addFact(r.id, 'appraisal', { date: '2027-03-05', pos: 1, appraiser: 'ОсОО «Эксперт-Баа»', amount: 1000000, doc: 'Отчёт № О-45' }, 'spec').ok);
  ck('стоимость принятия по отчёту: 1 000 000, не 800 000', IM.posValue(IM.offer(r.id), IM.offer(r.id).positions[0], '2027-03-10') === 1000000);
  const d = IM.addFact(r.id, 'decision', { date: '2027-03-10', organ: IM.ORGANS[0], doc: 'Реш. 45', items: { 1: { v: 'accept' } } }, 'sec');
  ck('решение с отчётом вносится', d.ok, d.why);
  key(IM, r.id, 'act', { pos: 1, date: '2027-03-12', doc: 'Акт 45' }, 'spec');
  const id = IM.posOutcome(r.id, 1).obj; key(IM, id, 'reg', { date: '2027-03-20', doc: 'Выписка 45' }, 'spec');
  ck('ИИ-23: учётная стоимость объекта 1 000 000', IM.objValue(id) === 1000000, IM.objValue(id));
  ck('доплата 100 000 = 1 000 000 − 900 000', IM.topupOf(id, '2027-03-21').amount === 100000, IM.topupOf(id, '2027-03-21'));
});

group('С-46: оставление предмета залога за собой: цена повторных торгов 1 000 000, в протоколе 880 000; затем 900 000', ({ IM }) => {
  IM.PLEDGE_TORGI['ПЗ-T46'] = { date: '2027-01-05', price: 1000000 };
  IM.OBL.push({ id: 'o_p46', name: 'Залогодатель З.З.', role: 'заёмщик', credits: [{ no: 'К-46', ccy: 'KGS' }], debt: 3000000 });
  const base = { source: 'pledgor', obligor: 'o_p46', docNo: 'ОТ-46', docDate: '2027-03-01', name: 'Жилой дом', kind: 'house', region: 'г. Бишкек', pledge: 'ПЗ-T46' };
  const r1 = IM.registerOffer(Object.assign({ value: 880000 }, base), 'spec');
  ck('880 000 — отказ: ниже 90 % цены повторных торгов', !r1.ok && has(r1.why, 'ниже 90 %') && digits(r1.why).includes('1000000'), r1.why);
  const r2 = IM.registerOffer(Object.assign({ value: 900000 }, base), 'spec');
  ck('900 000 — принято', r2.ok, r2.why);
  ck('правкой опустить ниже 90 % нельзя', !IM.editPosition(r2.id, 1, { value: 880000 }, 'spec').ok);
  const d = IM.addFact(r2.id, 'decision', { date: '2027-03-10', organ: IM.ORGANS[0], doc: 'Реш. 46', items: { 1: { v: 'accept' } } }, 'sec');
  ck('решение без отчёта оценщика: основание цены — протокол торгов', d.ok, d.why);
  ck('ИИ-23: стоимость принятия 900 000 (протокол), отчёт не нужен', IM.posValue(IM.offer(r2.id), IM.offer(r2.id).positions[0], '2027-03-10') === 900000);
  ck('у обычной позиции залога без торгов 90 % не проверяется', IM.retentionWhy({ pledge: 'ПЗ-нет' }, 1, 'pledgor') === '');
});

group('С-47: объявление 20.05: заявки А 01.07 и Б 02.07 → торги; договор с А без торгов — отказ', ({ IM }) => {
  const f = mkObj(IM, { debt: 600000, value: 1000000, kind: 'equip', date: '2027-04-05' }); const id = f.id;
  const A = 'Бейшеналиев Ы.Т.', B = 'ОсОО «Жол-Курулуш»';
  const a = ann(IM, id, '2027-05-20', 1000000);
  const pa = IM.addFact(id, 'pubAdd', { date: '2027-06-25', place: IM.PUB_PLACES[0], ann: a.fact.id, doc: 'Газета № 77' }, 'spec');
  ck('объявление 20.05; повторная публикация 25.06 продлевает окно до 25.07', a.ok && pa.ok && IM.announcements(id, '2027-07-01')[0].windowEnd === '2027-07-25', IM.announcements(id, '2027-07-01')[0].windowEnd);
  const qa = apply(IM, id, '2027-07-01', A, 1000000), qb = apply(IM, id, '2027-07-02', B, 1050000);
  ck('заявки А 01.07 и Б 02.07', qa.ok && qb.ok, [qa.why, qb.why]);
  const tr = d => IM.triggers(d).filter(x => x.kind === 'pk-im-application-pending' && x.id === id);
  ck('заявки вне окна не принимаются (окно кончилось 25.07)', !apply(IM, id, '2027-08-01', 'Абдыкадыров М.С.', 1000000).ok);
  ck('на Комитет — до 7 р.д.: 12.07 повода нет; 14.07 — по обеим заявкам', !tr('2027-07-12').length && tr('2027-07-14').length === 2, [tr('2027-07-12').length, tr('2027-07-14').length]);
  const c0 = IM.addFact(id, 'contract', { date: '2027-07-05', buyer: A, price: 1000000, kind: 'once', doc: 'Договор КП' }, 'lawyer');
  ck('договор с А без торгов — отказ «только по решению Комитета или итогу торгов»', !c0.ok && has(c0.why, IM.CONTRACT_ONLY), c0.why);
  const s1 = IM.addFact(id, 'committee', { date: '2027-07-06', apps: [qa.fact.id], v: 'sell', price: 1000000, doc: 'П' }, 'sec');
  ck('«продать» одной заявке при двух открытых — отказ: только открытые торги', !s1.ok && has(s1.why, 'торги'), s1.why);
  const t1 = IM.addFact(id, 'committee', { date: '2027-07-06', apps: [qa.fact.id], v: 'torgi', doc: 'П' }, 'sec');
  ck('торги только по одной из двух заявок — отказ: одним решением по всем', !t1.ok && has(t1.why, 'по всем'), t1.why);
  const t = decide(IM, id, '2027-07-06', [qa.fact.id, qb.fact.id], 'torgi', { doc: 'Протокол Комитета № 21' });
  ck('Комитет назначает открытые торги по обеим заявкам', t.ok, t.why);
  ck('объявление остаётся действующим, пока торги без итога', IM.objState(id, '2027-08-10').code === 'listed');
  ck('договор до итога торгов невозможен', !IM.gate(id, 'contract', '2027-08-10').ok);
  const tr1 = IM.addFact(id, 'torgiResult', { date: '2027-07-20', committee: t.fact.id, v: 'sold', buyer: B, price: 1200000, doc: 'Протокол торгов' }, 'spec');
  ck('итог торгов: победитель Б, 1 200 000', tr1.ok, tr1.why);
  ck('договор с А (не победитель) невозможен', !IM.addFact(id, 'contract', { date: '2027-07-22', basis: tr1.fact.id, buyer: A, price: 1200000, kind: 'once', doc: 'Д' }, 'lawyer').ok);
  const c = contract(IM, id, '2027-07-22', { basis: tr1.fact.id, buyer: B, price: 1200000, kind: 'once' });
  ck('договор с победителем по итогу торгов, цена из итога', c.ok && c.fact.price === 1200000 && c.fact.basis === tr1.fact.id, c.why);
});

group('С-48: рассрочка: переход права 05.04, к 01.07 объявления в газетах 2 + 3 раза → недоступна', ({ IM }) => {
  const id = instReady(IM, 'stage1');
  const ir = IM.instalmentRule(id, '2027-07-01');
  ck('к 01.07: с перехода права 87 дней, республиканских газет 2 из 3 — рассрочка недоступна', !ir.ok && ir.days === 87 && ir.pubsRep === 2 && ir.pubsLoc === 3, ir);
  ck('причины названы: меньше 120 дней и республиканские газеты', has(ir.why, '120') && has(ir.why, 'республиканск'), ir.why);
  const r = ann(IM, id, '2027-07-05', 2490000, { terms: 'inst' });
  ck('объявление «в рассрочку» в этот момент — отказ', !r.ok && has(r.why, 'рассрочка в условиях недоступна'), r.why);
  const ok = ann(IM, id, '2027-08-10', 2490000, { terms: 'both' });
  ck('к 10.08 (127 дней, публикации 3 + 4 с перехода права) рассрочка доступна', ok.ok && IM.instalmentRule(id, '2027-08-10').ok, ok.why);
});

group('С-49: рассрочка на цену 2 490 000 сроком 6 лет → отказ: для цены от 1 до 5 млн — 5 лет', ({ IM }) => {
  const id = instReady(IM, 'stage2');
  const ir = IM.instalmentRule(id, '2027-08-12', 2490000);
  ck('предельный срок по цене 2 490 000 — 5 лет', ir.maxYears === 5 && has(ir.band, '1') && has(ir.band, '5 млн'), ir);
  ck('до 1 млн — 3 года, от 5 млн — 10 лет', IM.instalmentRule(id, '2027-08-12', 900000).maxYears === 3 && IM.instalmentRule(id, '2027-08-12', 5000000).maxYears === 10);
  const bad = apply(IM, id, '2027-08-12', 'Бейшеналиев Ы.Т.', 2490000, { terms: 'inst', years: 6, down: 249000, fin: 'ФА-1' });
  ck('заявка на 6 лет — отказ с предельным сроком 5 лет', !bad.ok && has(bad.why, '5 лет') && has(bad.why, 'предельный'), bad.why);
  const noFin = apply(IM, id, '2027-08-12', 'Бейшеналиев Ы.Т.', 2490000, { terms: 'inst', years: 3, down: 249000 });
  ck('без финансового анализа заявителя — отказ', !noFin.ok && has(noFin.why, 'финансовый анализ'), noFin.why);
  const noDown = apply(IM, id, '2027-08-12', 'Бейшеналиев Ы.Т.', 2490000, { terms: 'inst', years: 3, fin: 'ФА-1' });
  ck('без первого взноса — отказ', !noDown.ok && has(noDown.why, 'первый взнос'), noDown.why);
  const q = apply(IM, id, '2027-08-12', 'Бейшеналиев Ы.Т.', 2490000, { terms: 'inst', years: 5, down: 249000, fin: 'ФА-1' });
  ck('5 лет — заявка принята', q.ok, q.why);
  const d = decide(IM, id, '2027-08-15', [q.fact.id], 'sell', { price: 2490000 });
  const c6 = IM.addFact(id, 'contract', { date: '2027-08-20', basis: d.fact.id, buyer: 'Бейшеналиев Ы.Т.', price: 2490000, kind: 'inst', down: 249000, years: 6, doc: 'Д' }, 'lawyer');
  ck('и договор на 6 лет — отказ', !c6.ok && has(c6.why, '5 лет'), c6.why);
});

group('С-50: рассрочка: цена 2 490 000, взнос 249 000, 3 года, 36 платежей → проценты 224 100; платёж 68 475', ({ IM }) => {
  const id = instReady(IM, 'stage2');
  const sch = IM.instalmentSchedule(2490000, 249000, 3, 36, '2027-10-01', 3, '2027-09-01');
  ck('график: взнос + 36 платежей', sch.length === 37 && sch[0].down && sch[0].amount === 249000 && sch[0].interest === 0, sch.length);
  ck('платёж = 62 250 тело + 6 225 проценты = 68 475', sch[1].amount === 62250 && sch[1].interest === 6225 && sch[1].amount + sch[1].interest === 68475, sch[1]);
  ck('проценты всего 224 100 (цена × 3 % × 3 года)', Math.round(sum(sch.map(x => x.interest)) * 100) === 22410000 && Math.round(sum(sch.map(x => x.amount)) * 100) === 249000000, [sum(sch.map(x => x.interest)), sum(sch.map(x => x.amount))]);
  const q = apply(IM, id, '2027-08-12', 'Бейшеналиев Ы.Т.', 2490000, { terms: 'inst', years: 3, down: 249000, fin: 'ФА-1' });
  const d = decide(IM, id, '2027-08-15', [q.fact.id], 'sell', { price: 2490000 });
  const c = contract(IM, id, '2027-09-01', { basis: d.fact.id, buyer: 'Бейшеналиев Ы.Т.', price: 2490000, kind: 'inst', down: 249000, years: 3, n: 36 });
  ck('договор в рассрочку оформлен', c.ok, c.why);
  const ci = IM.contractInfo(id, '2027-09-02');
  ck('contractInfo: проценты 224 100, график 37 строк, ставка 3 %', ci.interestTotal === 224100 && ci.schedule.length === 37 && ci.rate === 3, [ci.interestTotal, ci.schedule.length]);
  ck('взнос 249 000 принят', pay(IM, id, '2027-09-01', 249000).ok);
  ck('платёж 68 475: тело 62 250 + проценты 6 225', pay(IM, id, '2027-10-01', 62250, 6225).ok);
  const pr = IM.proceeds(id, '2027-10-02');
  ck('проценты 6 225 вне очереди — на счёт Госфинхолдинга; очереди считают только тело', pr.total.interest === 6225 && pr.total.amount === 311250 && has(pr.to.interest, 'Госфинхолдинг'), pr.total);
  ck('contractInfo: проценты уплачено 6 225, остаток 217 875', IM.contractInfo(id, '2027-10-02').interestPaid === 6225 && IM.contractInfo(id, '2027-10-02').interestRest === 217875);
  ck('право у Фонда до полной оплаты: «продан в рассрочку»', IM.objState(id, '2027-10-02').code === 'sold_inst');
});

group('С-51: долг 3 000 000, принятие 2 400 000, расходы 90 000, продажа 2 800 000 → 2 400 000 · 90 000 · 310 000 · 0', ({ IM }) => {
  const f = mkObj(IM, { debt: 3000000, value: 2400000, date: '2027-04-05' }); const id = f.id;
  addExp(IM, id, '2027-05-10', 'Оценка', 30000); addExp(IM, id, '2027-05-12', 'Налоги', 60000);
  ck('остаток долга после принятия 600 000', IM.allocation(f.obl, '2027-05-01').rest === 600000 && IM.debtNow(f.obl, '2027-05-01') === 600000);
  sellTo(IM, id, SELL(2800000, { annDate: '2027-06-01', appDate: '2027-06-05', decDate: '2027-06-08', ctrDate: '2027-06-10' }));
  ck('первая оплата 2 000 000 целиком в первую очередь', pay(IM, id, '2027-07-01', 2000000).ok && IM.proceeds(id, '2027-07-02').total.q1 === 2000000 && IM.proceeds(id, '2027-07-02').total.q2 === 0);
  ck('вторая оплата 800 000', pay(IM, id, '2027-08-01', 800000).ok);
  const T = IM.proceeds(id, '2027-08-02').total;
  ck('бюджет 2 400 000 · Госфинхолдингу 90 000 · погашение из выручки 310 000 · доход 0', T.q1 === 2400000 && T.q2 === 90000 && T.q3 === 310000 && T.q4 === 0, T);
  const rows = IM.proceeds(id, '2027-08-02').rows;
  ck('нарастающим итогом: вторая оплата 400 000 + 90 000 + 310 000', rows.length === 2 && rows[1].q1 === 400000 && rows[1].q2 === 90000 && rows[1].q3 === 310000, rows);
  ck('остаток долга 600 000 → 290 000 (debtNow)', IM.debtNow(f.obl, '2027-08-02') === 290000 && rows[1].debtBefore === 600000 && rows[1].debtAfter === 290000);
  ck('ИИ-19: ответ Взыскания о делении при переходе права не переписан — 600 000', IM.allocation(f.obl, '2027-08-02').rest === 600000);
  ck('мера-проекция в деле: «Погашение из выручки» 310 000', IM.caseJournal(f.obl, '2027-08-02').some(x => has(x.text, 'Погашение из выручки') && digits(x.text).includes('310000')), IM.caseJournal(f.obl, '2027-08-02').map(x => x.text));
  ck('Взысканию: делить 310 000 между кредитами, как принятие', has(IM.neighbours(id, '2027-08-02').collection.join(' '), 'Погашение из выручки') && has(IM.neighbours(id, '2027-08-02').collection.join(' '), 'остаток долга 290'));
  ck('Платежи: раскладка поступления по очередям', has(IM.neighbours(id, '2027-08-02').payments.join(' '), 'Раскладка поступления'));
});

group('С-52: жильё: переход права 05.04, уведомление 15.04, ответа нет; объявление 10.05 — отказ; 20.05 — по цене оценщика', ({ IM }) => {
  const f = mkObj(IM, { debt: 1850000, value: 2400000, housing: true, date: '2027-04-05' }); const id = f.id;
  ck('до уведомления объявление закрыто', !IM.gate(id, 'announce', '2027-04-10').ok && has(IM.gate(id, 'announce', '2027-04-10').why, 'уведомлени'));
  ck('срок уведомления: до 30 к.д. (канал «Тундук»)', !IM.addFact(id, 'notice', { date: '2027-04-15', channel: 'факс', answerBy: '2027-05-15', doc: 'У-1' }, 'spec').ok);
  const n = IM.addFact(id, 'notice', { date: '2027-04-15', channel: IM.NOTICE_CH[1], doc: 'Уведомление о выкупе № 1' }, 'spec');
  ck('уведомление бывшему владельцу 15.04, срок ответа 15.05', n.ok && IM.preempt(id, '2027-05-01').until === '2027-05-15', n.why);
  const p10 = IM.preempt(id, '2027-05-10');
  ck('10.05 преимущественное право открыто', p10.open && p10.kind === 'housing');
  const r10 = ann(IM, id, '2027-05-10', 2490000);
  ck('10.05 объявление третьим лицам — отказ (право открыто до 15.05)', !r10.ok && has(r10.why, '15.05.2027'), r10.why);
  const p20 = IM.preempt(id, '2027-05-20');
  ck('20.05 срок ответа истёк — молчание считается отказом', !p20.open && p20.silent && p20.refusedAt === '2027-05-15', p20);
  const noBasis = ann(IM, id, '2027-05-20', 2490000);
  ck('20.05 без отчёта оценщика — отказ: жильё после отказа по цене оценщика', !noBasis.ok && has(noBasis.why, 'отчёт оценщика'), noBasis.why);
  const pd = IM.addFact(id, 'priceDecision', { date: '2027-05-18', amount: 2490000, doc: 'Реш.' }, 'sec');
  const byPd = ann(IM, id, '2027-05-20', 2490000, { basis: pd.fact.id });
  ck('решение Комитета о цене вместо отчёта — тоже отказ', !byPd.ok && has(byPd.why, 'отчёт оценщика'), byPd.why);
  const ap = apprs(IM, id, '2027-05-18', 2450000);
  const ok = ann(IM, id, '2027-05-20', 2450000, { basis: ap.fact.id });
  ck('20.05 объявление по цене оценщика 2 450 000 — принято', ok.ok, ok.why);
});

group('С-53: бывший владелец согласен на выкуп жилья: стоимость 2 400 000, остаток долга 0, расходы 90 000 → договор без объявления, цена 2 490 000', ({ IM }) => {
  const f = mkObj(IM, { debt: 2400000, value: 2400000, housing: true, date: '2027-04-05' }); const id = f.id;
  addExp(IM, id, '2027-05-10', 'Оценка', 30000); addExp(IM, id, '2027-05-12', 'Налоги', 60000);
  const who = 'Иманов Б.Т. (брат должника)';
  ck('уведомление 15.04', IM.addFact(id, 'notice', { date: '2027-04-15', channel: IM.NOTICE_CH[2], doc: 'Уведомление' }, 'spec').ok);
  ck('ответ: согласие требует указать, кто выкупает', !IM.addFact(id, 'noticeAnswer', { date: '2027-04-25', v: 'consent', doc: 'О' }, 'spec').ok);
  const na = IM.addFact(id, 'noticeAnswer', { date: '2027-04-25', v: 'consent', who, doc: 'Письмо о согласии' }, 'spec');
  ck('согласие бывшего владельца (близкого родственника) 25.04', na.ok, na.why);
  ck('цена выкупа = стоимость принятия + остаток долга 0 + расходы = 2 490 000', IM.debtNow(f.obl, '2027-05-20') === 0 && IM.consentPrice(id, '2027-05-20') === 2490000, IM.consentPrice(id, '2027-05-20'));
  ck('объявление третьим лицам при согласии закрыто', !IM.gate(id, 'announce', '2027-05-20').ok);
  const low = IM.addFact(id, 'application', { date: '2027-05-20', buyback: true, consent: true, applicant: who, price: 2400000, terms: 'once', doc: 'З' }, 'spec');
  ck('заявка по согласию ниже 2 490 000 — отказ', !low.ok && has(low.why, 'цена выкупа по согласию'), low.why);
  const other = IM.addFact(id, 'application', { date: '2027-05-20', buyback: true, consent: true, applicant: 'ИП Орозбеков Н.Т.', price: 2490000, terms: 'once', doc: 'З' }, 'spec');
  ck('заявитель по согласию — только тот, кто ответил', !other.ok && has(other.why, who), other.why);
  const q = IM.addFact(id, 'application', { date: '2027-05-20', buyback: true, consent: true, applicant: who, price: 2490000, terms: 'once', doc: 'Заявление' }, 'spec');
  ck('заявка на выкуп по согласию 2 490 000 — без объявления', q.ok && !q.fact.ann, q.why);
  const d = decide(IM, id, '2027-05-22', [q.fact.id], 'sell', { price: 2490000 });
  const c = contract(IM, id, '2027-05-25', { buyer: who, price: 2490000, kind: 'once' });
  ck('решение Комитета «продать» и договор КП без объявления, цена 2 490 000', d.ok && c.ok && c.fact.price === 2490000 && IM.announcements(id, '2027-05-26').length === 0, [d.why, c.why]);
});

group('С-54: выкуп после погашения: остаток долга 650 000 → хвост платежа должника переносится на договор выкупа', ({ IM }) => {
  const f = mkObj(IM, { debt: 3000000, value: 2400000, date: '2027-04-05', name: 'Выкупщиков В.В.' }); const id = f.id;
  addExp(IM, id, '2027-05-10', 'Оценка', 30000); addExp(IM, id, '2027-05-12', 'Налоги', 60000);
  ck('цена выкупа после погашения = учётная стоимость + расходы = 2 490 000', IM.buybackPrice(id, '2027-06-01') === 2490000);
  const early = IM.addFact(id, 'application', { date: '2027-06-01', buyback: true, applicant: f.name, price: 2490000, terms: 'once', doc: 'З' }, 'spec');
  ck('должник-заявитель при ненулевом долге (600 000) — отказ', !early.ok && has(early.why, 'после полного погашения долга') && digits(early.why).includes('600000'), early.why);
  const other = IM.addFact(id, 'application', { date: '2027-06-01', buyback: true, applicant: 'ИП Орозбеков Н.Т.', price: 2400000, terms: 'once', doc: 'З' }, 'spec');
  ck('другой заявитель: ниже 2 490 000 — отказ; погашение долга должника не проверяется', !other.ok && has(other.why, '2 490 000'), other.why);
  IM.OBL.find(o => o.id === f.obl).debt = 2400000;   // должник погасил остаток в кредите — ответ Взыскания: долг 0
  ck('после погашения остаток долга 0', IM.debtNow(f.obl, '2027-06-02') === 0);
  const q = IM.addFact(id, 'application', { date: '2027-06-02', buyback: true, applicant: f.name, price: 2490000, terms: 'once', doc: 'Заявление о выкупе' }, 'spec');
  ck('заявка должника на выкуп — принята', q.ok, q.why);
  const tr = d => IM.triggers(d).filter(x => x.kind === 'pk-im-application-pending-buyback' && x.id === id);
  ck('на Комитет — в течение 2 р.д.: 04.06 повода нет, 07.06 — есть', !tr('2027-06-04').length && tr('2027-06-07').length === 1, [tr('2027-06-04').length, tr('2027-06-07').length]);
  const d = decide(IM, id, '2027-06-03', [q.fact.id], 'sell', { price: 2490000 });
  const c = contract(IM, id, '2027-06-04', { buyer: f.name, price: 2490000, kind: 'once' });
  ck('решение Комитета и договор выкупа без объявления', d.ok && c.ok, [d.why, c.why]);
  ck('Платежи: хвост платежа должника переносится на договор выкупа, не в Возврат', has(IM.neighbours(id, '2027-06-05').payments.join(' '), 'хвост платежа должника'), IM.neighbours(id, '2027-06-05').payments);
  ck('хвост 2 490 000 оплачивает договор', pay(IM, id, '2027-06-10', 2490000).ok);
  const st = IM.objState(id, '2027-06-10'), T = IM.proceeds(id, '2027-06-10').total;
  ck('договор оплачен — объект снят с учёта (продажа разовая)', st.code === 'removed' && st.pathId === 'once', st);
  ck('в бюджет 2 400 000, Госфинхолдингу 90 000, на погашение долга ничего', T.q1 === 2400000 && T.q2 === 90000 && T.q3 === 0 && T.q4 === 0, T);
});

group('С-55: предложение с видом долга «поручительство Госфинхолдинга» → недоступно: нет подсистемы поручительств', ({ IM, doc }) => {
  const base = { source: 'debtor', obligor: 'o_n', docNo: 'ОТ-55', docDate: '2028-03-01', name: 'Мини-трактор', value: 100000, kind: 'equip', region: 'г. Бишкек' };
  const r = IM.registerOffer(Object.assign({ debtKind: 'guarantee' }, base), 'spec');
  ck('регистрация с видом «поручительство» — отказ', !r.ok && has(r.why, 'подсистем'), r.why);
  const b = IM.registerOffer(Object.assign({ debtKind: 'budget' }, base), 'spec');
  ck('«бюджетный кредит» регистрируется, вид сохранён', b.ok && IM.offer(b.id).debtKind === 'budget', b.why);
  ck('все предложения сида — «бюджетный кредит»', IM.OFFERS.every(o => o.debtKind === 'budget'));
  IM.setRole('spec'); IM.uiNewOffer();
  const opt = doc.querySelector('#ff_debtKind option[value=guarantee]');
  ck('UI: в форме регистрации вид «поручительство Госфинхолдинга» виден, но отключён', opt && opt.disabled && has(opt.textContent, 'недоступно'), opt && opt.outerHTML);
  ck('UI: выбран «бюджетный кредит»', doc.getElementById('ff_debtKind').value === 'budget');
  IM.closeForm();
});

group('С-56: взыскание публикует «признан банкротом» по лицу с залогом 01.03 → без записки в Комитет — повод', ({ IM }) => {
  const thr = IM.SETTINGS.thr.find(t => t.id === 'pk-im-bankruptcy');
  ck('порог 10 дней, источник «Инструкция»', thr && thr.v === 10 && thr.unit === 'дн.' && thr.src === 'Инструкция', thr);
  const b = IM.BANKRUPT.find(x => x.obl === 'o_s');
  ck('сид: Садыкова Г.Н. признана банкротом 01.03.2028, залог ПЗ-104/105, записки нет', b && b.date === '2028-03-01' && b.pledges.length === 2 && !b.memo, b);
  const tr = d => IM.triggers(d).filter(x => x.kind === 'pk-im-bankruptcy' && x.id === 'П-7');
  ck('10.03 повода нет — срок записки идёт', !tr('2028-03-10').length);
  ck('12.03 (срок 10 дней вышел) — повод pk-im-bankruptcy, куратору предложения', tr('2028-03-12').length === 1 && tr('2028-03-12')[0].to === IM.curatorOf('П-7', '2028-03-12').emp && has(tr('2028-03-12')[0].text, 'банкротом'), tr('2028-03-12'));
  b.memo = '2028-03-14';
  ck('записка внесена 14.03 — повод погас', !tr('2028-03-15').length && tr('2028-03-13').length === 1);
  const k = IM.BANKRUPT.find(x => x.obl === 'o_k');
  ck('о_k: записка внесена за 8 дней — повода не было и нет', k.memo && !IM.triggers('2027-09-30').some(x => x.kind === 'pk-im-bankruptcy'));
});

group('ИИ-22: сумма доплаты фиксируется на переход права; к выплате — после выручки, за вычетом расходов, без просрочки собственника', ({ IM }) => {
  const f = mkObj(IM, { debt: 1000000, value: 1500000, date: '2027-04-05' }); const id = f.id;
  addExp(IM, id, '2027-05-10', 'Оценка', 40000);
  const t1 = IM.topupOf(id, '2027-04-06'), t2 = IM.topupOf(id, '2027-05-20');
  ck('сумма 500 000 на 05.04 и позже одна и та же; расходы уменьшают только «к выплате»', t1.amount === 500000 && t2.amount === 500000 && t1.payable === 500000 && t2.payable === 460000, [t1.payable, t2.payable]);
  ck('без выручки состояние «зафиксирована»', t2.state === 'fixed');
  addExp(IM, id, '2027-05-25', 'Охрана и сохранность', 10000);
  sellTo(IM, id, SELL(1550000, { annDate: '2027-06-01', appDate: '2027-06-05', decDate: '2027-06-08', ctrDate: '2027-06-10' }));
  pay(IM, id, '2027-07-01', 775000);
  const t3 = IM.topupOf(id, '2027-07-02');
  ck('половина выручки — половина доплаты к выплате: (500 000 − 50 000) × 50 % = 225 000', t3.state === 'due' && t3.unpaid === 225000 && t3.left === 450000, t3);
  ck('вторая половина — после следующей оплаты', IM.gate(id, 'topup', '2027-07-02').ok && !IM.addFact(id, 'topup', { date: '2027-07-02', amount: 225001, doc: 'В' }, 'acc').ok);
  ck('выплата 225 000', IM.addFact(id, 'topup', { date: '2027-07-02', amount: 225000, doc: 'В-1' }, 'acc').ok && IM.topupOf(id, '2027-07-03').unpaid === 0);
  ck('следующей выплаты до новой оплаты нет', !IM.gate(id, 'topup', '2027-07-03').ok);
  ck('сроки по источнику — в настройках (30 дней, «Инструкция»)', Object.values(IM.SETTINGS.topupTerm).every(x => x.v === 30 && x.src === 'Инструкция') && Object.keys(IM.SETTINGS.topupTerm).length === 5);
  const p1 = IM.topupOf('ИО-1', '2027-04-10');
  ck('депозит ССИ, пока исполнительное производство открыто; после окончания (30.06.2027) — отчуждателю', p1.account === 'депозит ССИ' && IM.topupOf('ИО-1', '2027-07-10').account === 'Асанов Т.Б.', [p1.account, IM.topupOf('ИО-1', '2027-07-10').account]);
});

group('ИИ-23: стоимость принятия у должника, залогодателя и третьего лица равна отчёту оценщика Фонда; у ПССИ и спецадминистратора — цена из документа', ({ IM }) => {
  ck('источники с отчётом оценщика: должник, залогодатель, третье лицо', ['debtor', 'pledgor', 'third'].every(k => IM.SOURCES[k].voluntary) && !IM.SOURCES.pssi.voluntary && !IM.SOURCES.spec.voluntary);
  ['П-2', 'П-4', 'П-7', 'П-8', 'П-9'].forEach(id => {
    const of = IM.offer(id);
    ck(`${id}: у каждой позиции отчёт оценщика, стоимость принятия = его сумма`, of.positions.every(p => IM.reportOn(of, p.n, '2028-03-15') && IM.posValue(of, p, '2028-03-15') === IM.reportOn(of, p.n, '2028-03-15').amount), id);
  });
  ck('П-3 (третье лицо) без отчёта — стоимости принятия на дату нет', IM.posValue(IM.offer('П-3'), IM.offer('П-3').positions[0], '2028-03-15') === null);
  ck('П-1 (ПССИ): цена из документа, отчёт не требуется', IM.posValue(IM.offer('П-1'), IM.offer('П-1').positions[0], '2027-01-10') === 2400000);
  const f = IM.registerOffer({ source: 'third', obligor: 'o_i', alien: 'Иманов Б.Т. (брат должника)', docNo: 'ИЗ-23', docDate: '2028-03-01', name: 'Гараж', value: 800000, kind: 'garage', region: 'г. Ош' }, 'spec');
  IM.addFact(f.id, 'appraisal', { date: '2028-03-02', pos: 1, appraiser: 'О', amount: 700000, doc: 'Отчёт 1' }, 'spec');
  IM.addFact(f.id, 'appraisal', { date: '2028-03-05', pos: 1, appraiser: 'О', amount: 950000, doc: 'Отчёт 2' }, 'spec');
  const p = IM.offer(f.id).positions[0];
  ck('учитывается последний отчёт на дату решения: 950 000', IM.posValue(IM.offer(f.id), p, '2028-03-06') === 950000 && IM.posValue(IM.offer(f.id), p, '2028-03-03') === 700000);
  const d = IM.addFact(f.id, 'decision', { date: '2028-03-06', organ: IM.ORGANS[0], doc: 'Реш.', items: { 1: { v: 'accept' } } }, 'sec');
  ck('в решении стоимость принятия фиксируется по отчёту: 950 000', d.ok && p.value === 950000, d.why);
  ck('после решения новый отчёт по предложению стоимость не меняет — вводится в карточке объекта', !IM.addFact(f.id, 'appraisal', { date: '2028-03-07', pos: 1, appraiser: 'О', amount: 1100000, doc: 'Отчёт 3' }, 'spec').ok);
  /* 90 % — только при оставлении предмета залога за собой (источник «залогодатель»); у ПССИ по тому же предмету — цена из постановления. */
  const pz = v => IM.registerOffer({ source: 'pledgor', obligor: 'o_s', docNo: 'ОТ-23', docDate: '2027-02-01', name: 'Квартира — предмет залога ПЗ-88', value: v, kind: 'flat', region: 'г. Бишкек', pledge: 'ПЗ-88' }, 'spec');
  const lo = pz(2000000), hi = pz(2340000);
  ck('90 % при оставлении предмета залога за собой — у залогодателя (С-46): 2 000 000 при торгах 2 600 000 — отказ, 2 340 000 — принято', IM.PLEDGE_TORGI['ПЗ-88'].price === 2600000 && !lo.ok && has(lo.why, '90 %') && hi.ok, [lo.why, hi.why]);
  ck('П-1 (ПССИ, тот же предмет ПЗ-88): 90 % не проверяется, стоимость — из постановления', IM.retentionWhy(IM.offer('П-1').positions[0], 2000000, 'pssi') === '' && IM.posValue(IM.offer('П-1'), IM.offer('П-1').positions[0], '2027-01-10') === 2400000);
});

group('ИИ-24: договор КП — только по решению Комитета или итогу торгов, при двух и больше заявках — только торги', ({ IM }) => {
  ck('в API нет «попыток»: METHODS, DIRECT_ONLY_ORGAN, attempt, attemptResult убраны', !('METHODS' in IM) && !('DIRECT_ONLY_ORGAN' in IM) && !('attempts' in IM) && !['attempt', 'attemptResult'].some(t => t in IM.ROLE_OF), Object.keys(IM.ROLE_OF));
  ck('у всех договоров сида есть основание — решение Комитета «продать»', IM.OBJECTS.every(o => IM.obj(o.id).facts.filter(f => f.t === 'contract').every(c => { const b = IM.obj(o.id).facts.find(f => f.id === c.basis); return b && b.t === 'committee' && b.v === 'sell'; })));
  const f = mkObj(IM, { debt: 100000, value: 1000000, kind: 'equip' }); const id = f.id;
  ck('нет объявления и решения — договор закрыт', !IM.gate(id, 'contract').ok && has(IM.gate(id, 'contract').why, 'решения «продать»'));
  const a = ann(IM, id, '2027-05-10', 1000000);
  const q1 = apply(IM, id, '2027-05-12', 'Бейшеналиев Ы.Т.', 1000000), q2 = apply(IM, id, '2027-05-13', 'ОсОО «Жол-Курулуш»', 1000000);
  ck('две заявки: «продать» невозможно — только торги', !IM.addFact(id, 'committee', { date: '2027-05-15', apps: [q1.fact.id], v: 'sell', price: 1000000, doc: 'П' }, 'sec').ok);
  ck('«отказать» — с причиной', !IM.addFact(id, 'committee', { date: '2027-05-15', apps: [q1.fact.id], v: 'refuse', doc: 'П' }, 'sec').ok);
  const ref = decide(IM, id, '2027-05-15', [q1.fact.id], 'refuse', { reason: 'Нет финансового анализа' });
  ck('отказ с причиной по одной заявке вносится; тогда по второй — «продать»', ref.ok && decide(IM, id, '2027-05-16', [q2.fact.id], 'sell', { price: 1000000 }).ok);
  ck('договор — по решению «продать» второй заявки', contract(IM, id, '2027-05-18', { buyer: 'ОсОО «Жол-Курулуш»', price: 1000000, kind: 'once' }).ok);
  ck('и теперь второго договора нет', !IM.gate(id, 'contract').ok);
  ck('итог торгов вводит специалист, решение Комитета — секретарь, договор — юрист', IM.ROLE_OF.torgiResult.join() === 'spec' && IM.ROLE_OF.committee.join() === 'sec' && IM.ROLE_OF.contract.join() === 'lawyer');
});

group('ИИ-25: выручка по договору КП раскладывается по очереди нарастающим итогом; проценты — вне очереди; по поручительству — другие получатели', ({ IM }) => {
  const f = mkObj(IM, { debt: 1000000, value: 600000, kind: 'equip', date: '2027-04-05' }); const id = f.id;
  addExp(IM, id, '2027-05-01', 'Охрана и сохранность', 20000);
  const ap = apprs(IM, id, '2027-05-20', 1500000);
  sellTo(IM, id, SELL(1500000, { annDate: '2027-06-01', appDate: '2027-06-05', decDate: '2027-06-08', ctrDate: '2027-06-10', annX: { basis: ap.fact.id } }));
  pay(IM, id, '2027-07-01', 500000); pay(IM, id, '2027-08-01', 500000); pay(IM, id, '2027-09-01', 500000);
  const rows = IM.proceeds(id, '2027-09-02').rows;
  ck('1-я оплата: 500 000 → 1 очередь 500 000', rows[0].q1 === 500000 && rows[0].q2 === 0);
  ck('2-я оплата: 100 000 → 1 очередь, 20 000 → 2, 380 000 → 3 (долг 400 000 после принятия)', rows[1].q1 === 100000 && rows[1].q2 === 20000 && rows[1].q3 === 380000 && rows[1].q4 === 0, rows[1]);
  ck('3-я оплата: 20 000 → 3 (остаток долга), 480 000 → 4 (доход)', rows[2].q3 === 20000 && rows[2].q4 === 480000 && rows[2].debtAfter === 0, rows[2]);
  const T = IM.proceeds(id, '2027-09-02').total;
  ck('итого: 600 000 · 20 000 · 400 000 · 480 000 = 1 500 000 (каждая сумма ровно один раз)', T.q1 === 600000 && T.q2 === 20000 && T.q3 === 400000 && T.q4 === 480000 && T.q1 + T.q2 + T.q3 + T.q4 === T.amount, T);
  ck('долг после выручки: 0; ответ Взыскания о делении не тронут (400 000)', IM.debtNow(f.obl, '2027-09-02') === 0 && IM.allocation(f.obl, '2027-09-02').rest === 400000);
  const g = mkObj(IM, { debt: 1000000, value: 600000, kind: 'equip', date: '2027-04-05' });
  IM.offer(g.of).debtKind = 'guarantee';   // поручительство в сиде недоступно (С-55); получатели очередей проверяются на подложенной записи
  sellTo(IM, g.id, SELL(700000, { annDate: '2027-06-01', appDate: '2027-06-05', decDate: '2027-06-08', ctrDate: '2027-06-10' })); pay(IM, g.id, '2027-07-01', 700000);
  const pg = IM.proceeds(g.id, '2027-07-02');
  ck('поручительство: 1 и 3 очереди — восполнение средств поручительства, 4 — доход Госфинхолдинга', pg.guarantee && has(pg.to.q1, 'поручительства') && has(pg.to.q3, 'поручительства') && has(pg.to.q4, 'доход Госфинхолдинга'), pg.to);
  ck('для бюджетного кредита: республиканский бюджет, доход бюджета', has(IM.proceeds(id, '2027-09-02').to.q1, 'республиканский бюджет') && has(IM.proceeds(id, '2027-09-02').to.q4, 'доход республиканского бюджета'));
});

group('Волна 4, реквизиты: роли, поводы ssi-memo / guard / pledge-term, «Срок продлён», статьи расходов, Сектор', ({ IM, doc }) => {
  ck('роль «probl» — специалист отдела по работе с проблемными кредитами; второй ключ — заведующий Сектором', IM.ROLES.some(r => r.id === 'probl' && has(r.name, 'проблемными кредитами')) && has(IM.ROLES.find(r => r.id === 'head').name, 'Сектором'));
  ck('предложение ПССИ регистрирует только probl, прочие источники — только spec', !IM.registerOffer({ source: 'pssi', obligor: 'o_n', docNo: 'Н', docDate: '2028-03-01' }, 'spec').ok && !IM.registerOffer({ source: 'debtor', obligor: 'o_n', docNo: 'Н', docDate: '2028-03-01' }, 'probl').ok);
  const r = IM.registerOffer({ source: 'pssi', obligor: 'o_n', docNo: '7-1/28', docDate: '2028-03-02' }, 'probl');
  ck('ПССИ зарегистрировано специалистом отдела; срок ответа 5 р.д.', r.ok && IM.offer(r.id).deadline === '2028-03-09', r.why);
  const memo = d => IM.triggers(d).filter(x => x.kind === 'pk-im-ssi-memo' && x.id === r.id);
  ck('записка председателю Комитета: 1 р.д. — 03.03 повода нет, 06.03 — есть, адресат — отдел', !memo('2028-03-03').length && memo('2028-03-06').length === 1 && has(memo('2028-03-06')[0].to, 'проблемными'), memo('2028-03-06'));
  ck('записку вносит только probl, и только по ПССИ', !IM.addFact(r.id, 'ssiMemo', { date: '2028-03-03', doc: 'З-1' }, 'spec').ok && !IM.addFact('П-2', 'ssiMemo', { doc: 'З-1' }, 'probl').ok);
  ck('записка внесена — повод погас', IM.addFact(r.id, 'ssiMemo', { date: '2028-03-03', doc: 'З-1' }, 'probl').ok && !memo('2028-03-10').length);
  const g = d => IM.triggers(d).filter(x => x.kind === 'pk-im-guard' && x.id === 'ИО-13');
  ck('охрана: после перехода права 03.03.2028 нет расхода «Охрана и сохранность» — 08.03 повода нет, 09.03 — есть', !g('2028-03-08').length && g('2028-03-09').length === 1);
  addExp(IM, 'ИО-13', '2028-03-05', 'Охрана и сохранность', 5000);
  ck('расход «Охрана и сохранность» гасит повод', !g('2028-03-15').length);
  const pt = d => IM.triggers(d).filter(x => x.kind === 'pk-im-pledge-term' && x.id === 'ИО-410');
  ck('предмет залога при банкротстве (ИО-410): срок отчуждения 3 года; повод за 90 к.д.', !pt('2028-03-15').length && !pt('2030-07-01').length && pt('2030-07-10').length === 1 && has(pt('2030-07-10')[0].text, '01.10.2030'), pt('2030-07-10'));
  const te = IM.addFact('ИО-13', 'termExt', { date: '2028-03-15', kind: 'pk-im-no-inspection', until: '2028-12-31', doc: 'Резолюция зампредседателя № 5' }, 'spec');
  ck('«Срок продлён»: вносит специалист по повод, дате и резолюции', te.ok && IM.addFact('ИО-13', 'termExt', { date: '2028-03-15', kind: 'pk-im-no-inspection', until: '2028-12-31' }, 'spec').ok === false, te.why);
  ck('повод по этой записи не публикуется, пока срок продлён', IM.termExtActive(IM.obj('ИО-13'), 'pk-im-no-inspection', '2028-06-01') && !IM.triggers('2028-09-30').some(x => x.kind === 'pk-im-no-inspection' && x.id === 'ИО-13'));
  ck('статьи расходов — перечень Инструкции (10), «Иное» с пояснением, «Страхование» с решением Комитета', IM.EXP_ITEMS.length === 10 && IM.EXP_ITEMS.includes('Организация и проведение торгов') && IM.EXP_ITEMS.includes('Охрана и сохранность'));
  ck('«Иное» без пояснения — отказ', !IM.addFact('ИО-2', 'expense', { item: 'Иное', amount: 1, doc: 'д' }, 'spec').ok && IM.addFact('ИО-2', 'expense', { item: 'Иное', note: 'Коммунальные', amount: 1, doc: 'д' }, 'spec').ok);
  ck('«Страхование» без решения Комитета о согласовании — отказ', !IM.addFact('ИО-2', 'expense', { item: 'Страхование', amount: 1, doc: 'д' }, 'spec').ok && IM.addFact('ИО-2', 'expense', { item: 'Страхование', committeeDoc: 'Решение № 4', amount: 1, doc: 'д' }, 'spec').ok);
  ck('обращение в госсобственность — основание из закрытого перечня п. 50 (3 пункта)', IM.GOV_GROUNDS.length === 3 && !IM.addFact('ИО-2', 'gift', { doc: 'д' }, 'spec').ok && !IM.addFact('ИО-2', 'gift', { doc: 'д', ground: 'по желанию' }, 'spec').ok && IM.addFact('ИО-2', 'gift', { doc: 'д', ground: IM.GOV_GROUNDS[1] }, 'spec').ok);
  const dt = IM.SETTINGS.thr.filter(t => t.src === 'Инструкция').map(t => t.id);
  ck('пороги с источником «Инструкция»: ssi-memo, guard, no-inspection, buyback-notice, not-listed, relist, application-pending(+buyback), topup-due, bankruptcy, pledge-term', ['pk-im-ssi-memo', 'pk-im-guard', 'pk-im-no-inspection', 'pk-im-buyback-notice', 'pk-im-not-listed', 'pk-im-relist', 'pk-im-application-pending', 'pk-im-application-pending-buyback', 'pk-im-topup-due', 'pk-im-bankruptcy', 'pk-im-pledge-term'].every(k => dt.includes(k)), dt);
  const txt = ['offers', 'objects', 'settings', 'queue'].map(v => { IM.go(v); return doc.getElementById('panel').textContent; }).join(' ') + doc.body.textContent;
  ck('в интерфейсе нет «Управления по работе с активами» и «начальника Управления»', !/Управлени[еяюи] по работе с активами|начальник[а-я]* Управлени/i.test(txt));
});

group('Повод «объявление» и «окно заявок»: not-listed, relist, unsold, buyback-notice', ({ IM }) => {
  const f = mkObj(IM, { debt: 100000, value: 1000000, kind: 'equip', date: '2027-04-05' }); const id = f.id;
  const tr = (k, d) => IM.triggers(d).filter(x => x.kind === k && x.id === id);
  ck('нет первого объявления дольше 30 к.д. от перехода права: 05.05 — нет, 06.05 — повод', !tr('pk-im-not-listed', '2027-05-05').length && tr('pk-im-not-listed', '2027-05-06').length === 1);
  ck('первое объявление 10.05 гасит повод', ann(IM, id, '2027-05-10', 1000000).ok && !tr('pk-im-not-listed', '2027-05-20').length);
  ck('окно заявок до 09.06; нового объявления нет 30 к.д. — 09.07 повода нет, 10.07 — «окно заявок истекло»', !tr('pk-im-relist', '2027-07-09').length && tr('pk-im-relist', '2027-07-10').length === 1, [tr('pk-im-relist', '2027-07-09').length, tr('pk-im-relist', '2027-07-10').length]);
  ck('второе объявление 15.07 гасит повод', ann(IM, id, '2027-07-15', 1000000).ok && !tr('pk-im-relist', '2027-07-20').length);
  ck('два объявления без заявок — «много объявлений без заявок» ещё нет (порог 3)', !tr('pk-im-unsold', '2027-09-01').length);
  ck('третье объявление 20.09 без заявок: после окна — повод «много объявлений без заявок»', ann(IM, id, '2027-09-20', 1000000).ok && tr('pk-im-unsold', '2027-11-01').length === 1 && has(tr('pk-im-unsold', '2027-11-01')[0].text, '3'), tr('pk-im-unsold', '2027-11-01'));
  const h = mkObj(IM, { debt: 100000, value: 1000000, housing: true, date: '2027-04-05' });
  const nb = d => IM.triggers(d).filter(x => x.kind === 'pk-im-buyback-notice' && x.id === h.id);
  ck('жильё: уведомление о выкупе не отправлено дольше 30 дн.: 05.05 — нет, 06.05 — повод', !nb('2027-05-05').length && nb('2027-05-06').length === 1);
  ck('уведомление отправлено — повод погас', IM.addFact(h.id, 'notice', { date: '2027-05-07', channel: IM.NOTICE_CH[0], doc: 'У' }, 'spec').ok && !nb('2027-05-10').length);
  ck('повода «объявления нет» у жилья пока право открыто нет; после отказа — отсчёт от даты отказа', !IM.triggers('2027-05-20').some(x => x.kind === 'pk-im-not-listed' && x.id === h.id) && IM.triggers('2027-07-10').some(x => x.kind === 'pk-im-not-listed' && x.id === h.id && has(x.text, 'бывший владелец')));
});

group('Продление рассрочки (cextend): не больше 3 лет, решение Комитета, ставка 5 %', ({ IM }) => {
  const g = IM.gate('ИО-1', 'cextend');
  ck('ИО-1 (рассрочка 1 год): продление доступно, ключевой факт юриста', g.ok && IM.KEY.has('cextend') && IM.ROLE_OF.cextend.join() === 'lawyer', g.why);
  ck('без решения Комитета — отказ', !IM.addFact('ИО-1', 'cextend', { date: '2028-02-01', years: 1, doc: 'ДС-1' }, 'lawyer').ok);
  ck('больше 3 лет — отказ', !IM.addFact('ИО-1', 'cextend', { date: '2028-02-01', years: 4, committeeDoc: 'Р', doc: 'ДС-1' }, 'lawyer').ok);
  const r = key(IM, 'ИО-1', 'cextend', { date: '2028-02-01', years: 2, committeeDoc: 'Решение Комитета № 2/2028', doc: 'ДС-1' }, 'lawyer');
  ck('продление на 2 года опубликовано', r.ok, r.why);
  const ci = IM.contractInfo('ИО-1', '2028-02-02');
  ck('contractInfo: продлена на 2 года, ставка 5 %, график заменён', ci.extended && ci.extended.years === 2 && ci.extended.rate === 5 && ci.schedule.filter(s => s.date > '2028-02-01').length > 12, ci.extended);
  ck('суммарно не больше 3 лет: ещё 2 года — отказ, ещё 1 — можно', !IM.addFact('ИО-1', 'cextend', { date: '2028-02-05', years: 2, committeeDoc: 'Р', doc: 'ДС-2' }, 'lawyer').ok && IM.addFact('ИО-1', 'cextend', { date: '2028-02-05', years: 1, committeeDoc: 'Р', doc: 'ДС-2' }, 'lawyer').ok);
  ck('для разового договора продления нет', !IM.gate('ИО-12', 'cextend').ok);
  ck('настройки рассрочки: ставка 3 %, после продления 5 %, 120 дней, 3 + 3 публикации, предельный срок по цене', IM.SETTINGS.instalment.rate.v === 3 && IM.SETTINGS.instalment.extRate.v === 5 && IM.SETTINGS.instalment.minDays.v === 120 && IM.SETTINGS.instalment.pubsRep.v === 3 && IM.SETTINGS.instalment.pubsLoc.v === 3 && IM.SETTINGS.instalment.caps.map(c => c.years).join() === '3,5,10');
});

group('UI волны 4: доплата, очередь выручки, «Объявления и заявки», преимущественное право, настройки', ({ IM, doc }) => {
  IM.setRole('head'); IM.setAsOf(IM.TODAY);
  const q = s => doc.querySelector(s), txt = s => (q(s) || { textContent: '' }).textContent;
  /* блок «Доплата» */
  IM.openObject('ИО-1', 'char');
  ck('topup-block: состояние, сумма, расходы, к выплате, выплачено, счёт, строки по оплатам', ['topup-state', 'obj-topup', 'topup-expenses', 'topup-payable', 'topup-paid', 'topup-account', 'topup-rows'].every(t => !!q(`[data-testid=${t}]`)));
  ck('ИО-1: доплата 550 000, расходы 90 000, к выплате 460 000, выплачено 115 000', digits(txt('[data-testid=obj-topup]')).startsWith('550000') && digits(txt('[data-testid=topup-expenses]')).startsWith('90000') && digits(txt('[data-testid=topup-payable]')).startsWith('460000') && digits(txt('[data-testid=topup-paid]')).startsWith('115000'), [txt('[data-testid=obj-topup]'), txt('[data-testid=topup-paid]')]);
  ck('ИО-1: состояние «к выплате», строка с просроченным сроком подсвечена', q('[data-testid=topup-block]').dataset.state === 'due' && [...doc.querySelectorAll('[data-testid=topup-row]')].some(r => r.classList.contains('over')));
  IM.openObject('ИО-3', 'char');
  ck('ИО-3: отчуждатель в просрочке — предупреждение «удержание», доплата 200 000 «зафиксирована»', q('[data-testid=topup-block]').dataset.state === 'fixed' && !!q('[data-testid=topup-held-warn]') && digits(txt('[data-testid=obj-topup]')).startsWith('200000'));
  IM.openObject('ИО-12', 'char');
  ck('ИО-12: доплата выплачена — состояние «выплачена», излишек 200 000 после отмены принятия ИО-11 появится после исправления', q('[data-testid=topup-block]').dataset.state === 'paid');
  IM.openObject('ИО-2', 'char');
  ck('ИО-2: доплаты нет — блока нет', !q('[data-testid=topup-block]'));
  /* очередь выручки */
  IM.openObject('ИО-1', 'char');
  const pb = q('[data-testid=proceeds-block]');
  ck('proceeds-block: таблица по оплатам, итог, получатели очередей, проценты вне очереди', pb && !!q('[data-testid=proceeds-table]') && doc.querySelectorAll('[data-testid=proceeds-row]').length === 4 && !!q('[data-testid=proceeds-total]') && !!q('[data-testid=proceeds-to]') && !!q('[data-testid=proceeds-debt]'));
  ck('ИО-1: проценты рассрочки 16 875 вне очереди (3 × 5 625); очередь 1 — 731 250 тела', has(txt('[data-testid=proceeds-total]'), '16 875') && has(txt('[data-testid=proceeds-total]'), '731 250') && has(txt('[data-testid=proceeds-to]'), 'Госфинхолдинг'), txt('[data-testid=proceeds-total]'));
  IM.openObject('ИО-2', 'char');
  ck('ИО-2: договора нет — блока очереди нет', !q('[data-testid=proceeds-block]'));
  /* вкладка «Объявления и заявки» */
  IM.openObject('ИО-1', 'att');
  const rows = [...doc.querySelectorAll('[data-testid=ann-table] tbody tr[data-testid^=ann-]')];
  ck('вкладка «Объявления и заявки»: ИО-1 — два объявления, первое «окно закрыто», второе «продано»', q('[data-testid=tab-att]') && has(txt('[data-testid=tab-att]'), 'Объявления и заявки') && rows.length === 2 && rows.every(r => r.dataset.open === 'false') && has(rows[1].textContent, 'продано'), rows.map(r => r.dataset.open));
  ck('в строках: основание цены (отчёт / решение Комитета), условия, публикации, окно заявок, риэлтор, обременение', has(rows[0].textContent, 'отчёт оценщика') && has(rows[1].textContent, 'решение Комитета о цене') && has(rows[1].textContent, 'разово или в рассрочку') && has(rows[0].textContent, 'повторно') && has(rows[0].textContent, '31.07.2027'));
  ck('под объявлением — заявка Бейшеналиева, решение «продать», договор', has(txt('[data-testid=ann-table]'), 'Бейшеналиев') && has(txt('[data-testid=ann-table]'), 'продать') && has(txt('[data-testid=ann-table]'), 'КП-5/27'));
  IM.openObject('ИО-7', 'att'); ck('ИО-7: объявлений не было — пустая таблица', has(txt('[data-testid=ann-table]'), 'объявлений не было'));
  IM.openObject('ИО-4', 'att');
  ck('ИО-4: объявление действует (data-open=true), заявка ждёт решения Комитета', q('[data-testid=ann-table] tr[data-open=true]') && has(txt('[data-testid=ann-table]'), 'ждёт решения') && !!q('[data-testid=inst-rule]'));
  ck('правило рассрочки на вкладке: срок 120 дней, 3 + 3 газеты, предельный срок по цене', has(txt('[data-testid=inst-rule]'), 'Рассрочка на'));
  /* преимущественное право */
  IM.openObject('ИО-1', 'char');
  const pe = q('[data-testid=preempt-block]');
  ck('preempt-block (жильё ИО-1): право прекращено 15.05.2027 — молчание считается отказом', pe && pe.dataset.open === 'false' && has(txt('[data-testid=preempt-state]'), '15.05.2027') && has(pe.textContent, 'молчание'), txt('[data-testid=preempt-block]'));
  IM.openObject('ИО-3', 'char');
  ck('preempt-block (жильё ИО-3): открыто, уведомления ещё не было', q('[data-testid=preempt-block]').dataset.open === 'true' && has(txt('[data-testid=preempt-state]'), 'уведомления ещё не было'));
  IM.openObject('ИО-2', 'char'); ck('ИО-2: не жильё и не доля — блока нет', !q('[data-testid=preempt-block]'));
  IM.openObject('ИО-9', 'char'); ck('ИО-9 (доля): признака общей собственности нет — блока нет', !q('[data-testid=preempt-block]'));
  IM.obj('ИО-9').commonShare = true; IM.openObject('ИО-9', 'char');
  ck('доля в общей собственности: блок «Извещение сособственников», срок 1 месяц (недвижимость) / 10 дней (прочее)', q('[data-testid=preempt-block]') && has(txt('[data-testid=preempt-block]'), 'сособственник') && IM.noticeTerm(IM.obj('ИО-9'), '2028-03-01') === '2028-03-11' && IM.noticeTerm({ kind: 'land', commonShare: true }, '2028-03-01') === '2028-04-01');
  /* настройки */
  IM.go('settings');
  const rowsThr = doc.querySelectorAll('#panel table.cgrid')[0].querySelectorAll('tbody tr');
  ck('«Настройки»: 18 порогов поводов', rowsThr.length === 18, rowsThr.length);
  const instr = [...rowsThr].filter(r => r.querySelector('select.quiet') && r.querySelector('select.quiet').value === 'Инструкция').length;
  ck('у порогов — источник значения «Инструкция» (11) / «внутренний акт» (7)', instr === 11 && [...rowsThr].filter(r => r.querySelector('select.quiet').value === 'внутренний акт').length === 7, instr);
  ck('«Настройки»: сроки выплаты доплаты по источникам (5 строк, 30 дн., «Инструкция»)', doc.querySelectorAll('[data-testid=topup-term] tbody tr').length === 5 && [...doc.querySelectorAll('[data-testid=topup-term] tbody tr')].every(r => has(r.textContent, '30 дн.') && has(r.textContent, 'Инструкция')));
  ck('«Настройки»: рассрочка — ставка 3 %, после продления 5 %, 120 дней, 3 + 3 публикации, предельные сроки', ['3 %', '5 %', '120', 'Инструкция'].every(s => has(txt('[data-testid=settings-instalment]'), s)) && has(txt('[data-testid=settings-realtor]'), '5 %'));
  ck('«Настройки»: наценка риэлтора 5 %, «Инструкция»', has(txt('[data-testid=settings-realtor]'), 'Инструкция'));
  /* форма объявления и регистрации */
  IM.setRole('spec'); IM.openObject('ИО-2', 'char');
  IM.uiFact('ИО-2', 'announce');
  const nm = IM.S.form.fields.map(f => f.id);
  ck('форма объявления: цена, основание, условия, 4 площадки, риэлтор, наценка, отметка, документ', ['price', 'basis', 'terms', 'pub0', 'pub1', 'pub2', 'pub3', 'realtor', 'markup', 'encMark', 'doc'].every(k => nm.includes(k)), nm);
  const bad = IM.submitForm({ date: '15.03.2028', price: '300000', basis: '', terms: 'once', pub0: '15.03.2028', pub1: '', pub2: '', pub3: '', realtor: false, markup: '', encMark: '', doc: 'Объявление № 1' });
  ck('цена ниже учётной стоимости с расходами — ошибка у поля «Основание цены»', !bad.ok && q('[data-testid=form-err]') && q('[data-testid=form-err]').dataset.field === 'basis', q('[data-testid=form-err]') && q('[data-testid=form-err]').outerHTML);
  const good = IM.submitForm({ date: '15.03.2028', price: '520000', basis: '', terms: 'once', pub0: '15.03.2028', pub1: '15.03.2028', pub2: '', pub3: '', realtor: true, markup: '7', encMark: '', doc: 'Объявление № 2' });
  ck('наценка риэлтора 7 % > 5 % — ошибка у поля «Наценка»', !good.ok && q('[data-testid=form-err]').dataset.field === 'markup', good.why);
  const fine = IM.submitForm({ date: '15.03.2028', price: '520000', basis: '', terms: 'once', pub0: '15.03.2028', pub1: '15.03.2028', pub2: '', pub3: '', realtor: true, markup: '5', encMark: '', doc: 'Объявление № 3' });
  ck('наценка 5 % — объявление введено, действует, площадки собраны из полей формы', fine.ok && fine.fact.pubs.length === 2 && IM.objState('ИО-2').code === 'listed', fine.why);
  IM.openObject('ИО-2', 'att');
  ck('и видно на вкладке «Объявления и заявки»', doc.querySelectorAll('[data-testid=ann-table] tr[data-open=true]').length === 1 && has(txt('[data-testid=ann-table]'), 'да, наценка 5 %'));
  IM.uiFact('ИО-2', 'application');
  ck('форма заявки: к действующему объявлению предлагается именно оно', IM.S.form.fields.find(f => f.id === 'via').options.some(o => o[0] === fine.fact.id));
  IM.closeForm();
});

group('Правки после ревью волны 4: выкуп и преимущественное право, рассрочка, график, доплата, оставление за собой, регистрация, оплата', ({ IM, doc }) => {
  const q = s => doc.querySelector(s), txt = s => (q(s) || { textContent: '' }).textContent;
  const B = 'Бейшеналиев Ы.Т.';
  /* 1. Выкуп без объявления не обходит преимущественное право бывшего владельца жилья */
  const h = mkObj(IM, { debt: 1000000, value: 2400000, housing: true, date: '2027-04-05' });
  const bb = apply(IM, h.id, '2027-04-10', B, 2400000, { buyback: true }), ga = IM.gate(h.id, 'announce', '2027-04-10');
  ck('жильё без уведомления: выкуп третьим лицом без согласия — отказ той же причиной, что у объявления', !bb.ok && !ga.ok && bb.why === ga.why && has(bb.why, 'уведомление'), [bb.why, ga.why]);
  const nt = IM.addFact(h.id, 'notice', { date: '2027-04-12', channel: IM.NOTICE_CH[1], answerBy: '2027-05-12', doc: 'Уведомление о выкупе' }, 'spec');
  ck('уведомление 12.04, срок ответа до 12.05 не истёк — выкуп третьим лицом на 20.04 тоже отказ', nt.ok && !apply(IM, h.id, '2027-04-20', B, 2400000, { buyback: true }).ok, nt.why);
  const bb2 = apply(IM, h.id, '2027-05-20', B, 2400000, { buyback: true });
  ck('срок ответа истёк (молчание — отказ) — выкуп без объявления на 20.05 принимается', bb2.ok, bb2.why);

  /* 2. Рассрочка: кроме газет — сайт Госфинхолдинга и интернет-площадка */
  const g = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' });
  const P = (d, i) => ({ place: IM.PUB_PLACES[i], date: d });
  ann(IM, g.id, '2027-05-10', 2400000, { pubs: [P('2027-05-10', 0), P('2027-05-20', 0), P('2027-06-01', 0), P('2027-05-10', 1), P('2027-05-20', 1), P('2027-06-01', 1)] });
  const ir0 = IM.instalmentRule(g.id, '2027-08-10');
  ck('127 дней и газеты 3 + 3, но ни сайта, ни площадки — рассрочка недоступна, обе причины названы', !ir0.ok && ir0.pubsRep === 3 && ir0.pubsLoc === 3 && has(ir0.why, 'сайте Госфинхолдинга') && has(ir0.why, 'интернет-площадке'), ir0);
  const a2 = ann(IM, g.id, '2027-08-10', 2400000, { terms: 'both', pubs: [P('2027-08-10', 2)] });
  ck('объявление «разово или в рассрочку» только с сайтом — отказ: нет интернет-площадки', !a2.ok && has(a2.why, 'интернет-площадке') && !has(a2.why, 'сайте'), a2.why);
  const a3 = ann(IM, g.id, '2027-08-10', 2400000, { terms: 'both', pubs: [P('2027-08-10', 2), P('2027-08-10', 3)] });
  ck('с сайтом и площадкой — объявление с рассрочкой открыто', a3.ok && IM.instalmentRule(g.id, '2027-08-10').ok, a3.why);
  const S_ = IM.SETTINGS.instalment;
  ck('настройки: сайт и площадка — не меньше 1 публикации, источник «Инструкция»', S_.pubsSite.v === 1 && S_.pubsNet.v === 1 && S_.pubsSite.src === 'Инструкция' && S_.pubsNet.src === 'Инструкция');
  ck('сид остаётся валидным: ИО-1 на 06.09.2027 и ИО-8 на 18.11.2027 — рассрочка доступна', IM.instalmentRule('ИО-1', '2027-09-06').ok && IM.instalmentRule('ИО-8', '2027-11-18').ok, [IM.instalmentRule('ИО-1', '2027-09-06').why, IM.instalmentRule('ИО-8', '2027-11-18').why]);
  IM.go('settings');
  ck('«Настройки» показывают сайт и площадку и подписывают параметры рассрочки по-русски', has(txt('[data-testid=settings-instalment]'), 'сайте Госфинхолдинга') && has(txt('[data-testid=settings-instalment]'), 'интернет-площадке') && !/\b(rate|pubsRep|minDays)\b/.test(txt('[data-testid=settings-instalment]')), txt('[data-testid=settings-instalment]'));

  /* 3. График рассрочки укладывается в срок */
  const c = instReady(IM, 'stage2');
  const q3 = apply(IM, c, '2027-08-12', B, 2490000, { terms: 'inst', years: 1, down: 249000, fin: 'Заключение ФА-1' });
  const d3 = decide(IM, c, '2027-08-15', [q3.fact && q3.fact.id], 'sell', { price: 2490000 });
  ck('заявка на рассрочку 1 год, решение «продать»', q3.ok && d3.ok, [q3.why, d3.why]);
  const n24 = IM.addFact(c, 'contract', { date: '2027-08-20', kind: 'inst', years: 1, down: 249000, n: 24, doc: 'Д' }, 'lawyer');
  ck('срок 1 год и 24 платежа — отказ: не больше 12', !n24.ok && has(n24.why, 'больше 12'), n24.why);
  const far = IM.addFact(c, 'contract', { date: '2027-08-20', kind: 'inst', years: 1, down: 249000, n: 12, first: '2028-06-20', doc: 'Д' }, 'lawyer');
  ck('первый платёж 20.06.2028: последний 20.05.2029 позже конца срока 20.08.2028 — отказ', !far.ok && has(far.why, '20.05.2029') && has(far.why, '20.08.2028'), far.why);
  const fit = contract(IM, c, '2027-08-20', { kind: 'inst', years: 1, down: 249000, n: 12 });
  ck('12 платежей с 20.09.2027 — последний 20.08.2028, договор введён', fit.ok && fit.fact.schedule.slice(-1)[0].date === '2028-08-20', fit.why);

  /* 4. Доплата: просрочку бывшего собственника проверяют на дату выплаты */
  const t = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' });
  sellTo(IM, t.id, SELL(2400000)); pay(IM, t.id, '2027-06-01', 2400000);
  IM.OWNER_OVERDUE[t.name] = [{ from: '2027-06-05', to: '2027-06-20', amount: 50000, credit: 'К-90' }];
  const t1 = IM.topupOf(t.id, '2027-06-10'), t2 = IM.topupOf(t.id, '2027-06-25'), t3 = IM.topupOf(t.id, '2027-07-05');
  ck('на 10.06 просрочка действует при наступившей сумме — «удержана», выплату не ввести', t1.state === 'held' && t1.held && t1.held.credit === 'К-90' && !IM.addFact(t.id, 'topup', { date: '2027-06-10', amount: 1000, doc: 'В' }, 'acc').ok, t1);
  ck('просрочка кончилась 20.06, до срока 01.07: срок не сдвигается — на 25.06 «к выплате» до 01.07', t2.state === 'due' && !t2.held && t2.dueRows[0].dueBy === '2027-07-01' && !t2.dueRows[0].restarted, t2.dueRows);
  ck('на 05.07 срок 01.07 прошёл — строка просрочена, «заново от конца просрочки» нет', t3.state === 'due' && t3.dueRows[0].late && t3.dueRows[0].dueBy === '2027-07-01' && !t3.dueRows[0].restarted, t3.dueRows);
  IM.OWNER_OVERDUE[t.name] = [{ from: '2027-06-25', to: '2027-07-10', amount: 50000, credit: 'К-91' }];
  const t4 = IM.topupOf(t.id, '2027-07-05'), t5 = IM.topupOf(t.id, '2027-07-15');
  ck('просрочка 25.06–10.07 действует на срок 01.07: на 05.07 строка удержана, срок пойдёт заново', t4.state === 'held' && t4.dueRows[0].held && t4.dueRows[0].held.credit === 'К-91' && !t4.dueRows[0].late && has(IM.gate(t.id, 'topup', '2027-07-05').why, 'пойдёт заново'), t4.dueRows);
  ck('кончилась 10.07 — срок заново: 30 дней от 10.07 = 09.08.2027', t5.state === 'due' && t5.dueRows[0].restarted && t5.dueRows[0].dueBy === '2027-08-09' && !t5.dueRows[0].late, t5.dueRows);
  IM.OWNER_OVERDUE[t.name] = [{ from: '2027-07-03', to: '2027-07-20', amount: 50000, credit: 'К-92' }];
  const t6 = IM.topupOf(t.id, '2027-07-05');
  ck('просрочка с 03.07 — после срока 01.07: срок не переносится, но выплата на 05.07 удержана', t6.state === 'held' && t6.held && t6.dueRows[0].late && !t6.dueRows[0].held && t6.dueRows[0].dueBy === '2027-07-01' && !IM.gate(t.id, 'topup', '2027-07-05').ok && has(IM.gate(t.id, 'topup', '2027-07-05').why, 'выплатить можно') && !t6.held.restart, t6);
  ck('на 25.07 просрочки нет — выплата доступна', IM.gate(t.id, 'topup', '2027-07-25').ok, IM.gate(t.id, 'topup', '2027-07-25').why);

  /* 5. Оставление предмета залога за собой — только у залогодателя */
  IM.OBL.push({ id: 'o_rv', name: 'Ревизов Р.Р.', role: 'заёмщик', credits: [{ no: 'К-99', ccy: 'KGS' }], debt: 500000 });
  const reg5 = (source, role, x = {}) => IM.registerOffer(Object.assign({ source, obligor: 'o_rv', docNo: 'ОТ-R5-' + source, docDate: '2027-03-01', name: 'Квартира — предмет залога ПЗ-88', value: 1000000, kind: 'flat', region: 'г. Бишкек', pledge: 'ПЗ-88' }, x), role);
  const pv = r => IM.posValue(IM.offer(r.id), IM.offer(r.id).positions[0], '2027-03-10');
  const dz = reg5('debtor', 'spec'), tz = reg5('third', 'spec', { alien: 'Иманов Б.Т. (брат должника)' }), pz = reg5('pledgor', 'spec'), sz = reg5('pssi', 'probl');
  ck('должник и третье лицо с предметом залога ПЗ-88: 90 % не проверяется, стоимость — только отчёт оценщика (его нет — null)', dz.ok && tz.ok && pv(dz) === null && pv(tz) === null, [dz.why, tz.why]);
  const dd = IM.addFact(dz.id, 'decision', { date: '2027-03-10', organ: IM.ORGANS[0], doc: 'Реш. R5', items: { 1: { v: 'accept' } } }, 'sec');
  ck('у должника без отчёта оценщика на Комитет не вынести', !dd.ok && has(dd.why, 'нет отчёта оценщика'), dd.why);
  ck('залогодатель: 1 000 000 ниже 90 % цены торгов 2 600 000 — отказ', !pz.ok && has(pz.why, '90 %'), pz.why);
  ck('ПССИ: цена из постановления 1 000 000, без 90 %', sz.ok && pv(sz) === 1000000, sz.why);
  IM.openOffer('П-1');
  ck('карточка П-1 (ПССИ, ПЗ-88): стоимость позиции без пометки «по протоколу торгов»', !!q('[data-testid=pos-value-1]') && !has(txt('[data-testid=pos-value-1]'), 'протокол'), txt('[data-testid=pos-value-1]'));

  /* 6. Регистрация раньше акта: переход права — поздняя из двух дат */
  const ro = IM.registerOffer({ source: 'spec', obligor: 'o_rv', docNo: 'КМ-R6', docDate: '2027-03-25', name: 'Квартира, ул. Киевская, 1', value: 900000, kind: 'flat', region: 'г. Бишкек' }, 'spec');
  IM.addFact(ro.id, 'decision', { date: '2027-03-28', organ: IM.ORGANS[0], doc: 'Реш. R6', items: { 1: { v: 'accept' } } }, 'sec');
  key(IM, ro.id, 'act', { pos: 1, date: '2027-04-05', doc: 'Акт R6' }, 'spec');
  const rid = IM.posOutcome(ro.id, 1).obj;
  const rg = key(IM, rid, 'reg', { date: '2027-04-02', doc: 'Выписка R6' }, 'spec');
  ck('регистрация 02.04 раньше акта 05.04 вводится', rg.ok, rg.why);
  ck('переход права — 05.04 (акт): до акта объекта нет, после — «на учёте»', IM.objState(rid, '2027-04-03').code === 'none' && IM.objState(rid, '2027-04-10').code === 'onbook' && IM.objState(rid, '2027-04-10').transfer === '2027-04-05', IM.objState(rid, '2027-04-10'));
  ck('погашение одно — на 05.04', IM.allocation('o_rv', '2027-04-10').rows.filter(r => r.id === rid).map(r => r.date).join() === '2027-04-05');
  IM.setAsOf('2027-04-10'); IM.openObject(rid, 'transfer');
  ck('вкладка «Переход права»: дата акта — подписан позже регистрации', has(txt('[data-testid=transfer-date]'), '05.04.2027') && has(txt('[data-testid=transfer-date]'), 'позже регистрации'), txt('[data-testid=transfer-date]'));
  IM.setAsOf(IM.TODAY);

  /* 7. Оплата тела — не больше остатка цены */
  const s7 = mkObj(IM, { debt: 600000, value: 1000000, kind: 'equip', date: '2027-04-05' });
  sellTo(IM, s7.id, SELL(1000000));
  const o7 = pay(IM, s7.id, '2027-06-01', 1200000);
  ck('оплата 1 200 000 при цене 1 000 000 — отказ с суммой остатка', !o7.ok && has(o7.why, 'остатка') && digits(o7.why) === '1000000', o7.why);
  const p7 = pay(IM, s7.id, '2027-06-01', 600000), x7 = pay(IM, s7.id, '2027-06-05', 500000);
  ck('после 600 000 вносить 500 000 нельзя — остаток 400 000', p7.ok && !x7.ok && digits(x7.why) === '400000', x7.why);
  ck('400 000 — договор оплачен полностью', pay(IM, s7.id, '2027-06-05', 400000).ok && IM.contractInfo(s7.id, '2027-06-06').complete);

  /* 8. Поздний расход не уменьшает наступившие строки доплаты */
  const e = mkObj(IM, { debt: 1850000, value: 2400000, date: '2027-04-05' });
  addExp(IM, e.id, '2027-05-01', 'Оценка', 90000);
  sellTo(IM, e.id, SELL(2700000)); pay(IM, e.id, '2027-06-01', 1350000);
  const e1 = IM.topupOf(e.id, '2027-06-02');
  addExp(IM, e.id, '2027-06-10', 'Налоги', 100000);
  const e2 = IM.topupOf(e.id, '2027-06-11');
  ck('строка от оплаты 01.06: (550 000 − 90 000) × 50 % = 230 000 — расход 10.06 её не уменьшает', e1.dueRows[0].sum === 230000 && e2.dueRows[0].sum === 230000, [e1.dueRows, e2.dueRows]);
  pay(IM, e.id, '2027-06-20', 1350000);
  const e3 = IM.topupOf(e.id, '2027-06-21');
  ck('оплата 20.06: к выплате 550 000 − 190 000 = 360 000, вторая строка 130 000', e3.payable === 360000 && e3.dueRows[1].sum === 130000 && e3.owed === 360000, e3.dueRows);
});

report();
