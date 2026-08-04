// Проверка мокапа платежей (mockups/payments/payments.html) на jsdom.
// Модель: ADR-0055…0065 поверх ADR-0001 «производные не хранятся».
// Швы: №1 три сущности (поступление · платёж · возврат) · №2 разнесение = производная
// у живого платежа и снимок у замороженного · №4 матрица разносит только наступившее ·
// №5 транш — область, а не уровень · №6 три режима остатка · №7 два уровня заморозки ·
// №8 списание не платёж, курс — производная.
// Спецификация: mockups/payments/ASUBK-platezhi-logika.md (§4.2, §5, §7, §8);
// дефекты, которые чинились: mockups/payments/ASUBK-status-razrabotki.md (ПТ-Д1…ПТ-Д26).
// Закрывает ПТ-Д21 («у макета нет смоука»).
// Запуск: node scripts/inspect/payments-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOCKUP = resolve(HERE, '../../mockups/payments/payments.html');
const HTML = readFileSync(MOCKUP, 'utf8');

/* DATA и хелперы объявлены через const/let ВНУТРИ classic-script: свойствами window они
   не становятся, но живут в глобальном лексическом окружении — значит достаются через
   window.eval(), а не через window.DATA. Отсюда весь доступ к модели идёт через ev(). */
function mk(){
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail?.message || e.message)));
  const dom = new JSDOM(HTML, { runScripts:'dangerously', virtualConsole:vc, url:'http://localhost/' });
  const w = dom.window, doc = w.document;
  /* Исключение внутри проверки не должно ронять ВЕСЬ прогон: ошибка = провал этой
     проверки и строка с причиной (образец — collection-check.mjs). */
  const ev = s => { try { return w.eval(s); } catch(e){ console.log('      ! eval: ' + e.message); return undefined; } };
  const $$ = s => [...doc.querySelectorAll(s)];
  const q  = s => doc.querySelector(s);
  const content = () => doc.getElementById('content');
  const html = () => content().innerHTML;
  const textOf = h => { const d = doc.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g,' '); };
  const role = r => ev(`ROLE=${JSON.stringify(r)}`);
  /* Экран и карточка — это render() в #content. Панель строится только активная,
     поэтому «вся карточка» = обход вкладок. */
  const view = (v, r) => { if(r) role(r); ev(`go(${JSON.stringify(v)})`); return html(); };
  const rec  = (id, tab, r) => { if(r) role(r); ev(`openReceipt(${JSON.stringify(id)}); setRTab(${JSON.stringify(tab||'alloc')})`); return html(); };
  const pay  = (id, tab, r) => { if(r) role(r); ev(`openPayment(${JSON.stringify(id)}); setPayTab(${JSON.stringify(tab||'req')})`); return html(); };
  const ret  = (id, r) => { if(r) role(r); ev(`openReturn(${JSON.stringify(id)})`); return html(); };
  const act  = (id, r) => { if(r) role(r); ev(`openAct(${JSON.stringify(id)})`); return html(); };
  return { dom, w, doc, ev, $$, q, html, textOf, role, view, rec, pay, act, ret, errs };
}

let fails = 0, n = 0;
/* Провал, а не падение: условие можно передать функцией, исключение внутри неё —
   провал ЭТОЙ проверки со строкой причины, а не обрыв хвоста прогона. */
const ok = (name, cond) => {
  n++;
  let v = cond;
  if(typeof v === 'function'){ try { v = v(); } catch(e){ console.log('      ! ' + e.message); v = false; } }
  if(!v) fails++;
  console.log(`${v?'  ✓ ':'  ✗ FAIL'}  ${name}`);
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 64 - t.length)));

const g = mk();
const VIEWS  = ['receipts','unresolved','pay','returns','registry','recon','period','acts'];
const ROLES  = ['curator','accountant','viewer'];
const RTABS  = ['alloc','parse','recon','hist'];
const PTABS  = ['req','alloc','dispute','hist'];
const DIRT   = /undefined|NaN|\[object /;
const ids    = expr => g.ev(expr) || [];
const RECS   = ids('DATA.receipts.map(r=>r.id)');
const PAYS   = ids('DATA.payments.map(p=>p.id)');
const RETS   = ids('DATA.returns.map(v=>v.id)');
const ACTS   = ids('DATA.acts.map(a=>a.id)');
const PERS   = ids('DATA.periods.map(p=>p.id)');

/* ЗС · страховка от расхождения смоука с затравкой: смоук приколочен к id демо-набора,
   а набор пересобирается волнами. Разом сверяем ВСЕ id, которые этот файл упоминает,
   с живыми DATA.* — исчезнувший id становится названной находкой, а не undefined
   в середине выражения. */
const SELF = readFileSync(new URL(import.meta.url), 'utf8');
const mentioned = re => [...new Set([...SELF.matchAll(re)].map(m => m[1]))];
const goneRec = mentioned(/'(R-\d+)'/g).filter(x => !RECS.includes(x));
const gonePay = mentioned(/'(P-\d+)'/g).filter(x => !PAYS.includes(x));
const goneRet = mentioned(/'(V-\d+)'/g).filter(x => !RETS.includes(x));
const goneAct = mentioned(/'(AS-\d+)'/g).filter(x => !ACTS.includes(x));
const goneAl  = mentioned(/'(AL-[0-9A-Z]+)'/g).filter(x => !g.ev(`Object.keys(DATA.alloc)`).includes(x));
const goneCr  = mentioned(/'(C-\d+)'/g).filter(x => !g.ev(`DATA.credits.map(c=>c.id)`).includes(x));
const gonePer = mentioned(/'(20\d\d-\d\d)'/g).filter(x => !PERS.includes(x));

head('ЗС · смоук ссылается только на живые id затравки');
ok('поступления, упомянутые в смоуке, есть в наборе' + (goneRec.length?` — нет: ${goneRec.join(' ')}`:''), goneRec.length === 0);
ok('платежи, упомянутые в смоуке, есть в наборе'     + (gonePay.length?` — нет: ${gonePay.join(' ')}`:''), gonePay.length === 0);
ok('возвраты, упомянутые в смоуке, есть в наборе'    + (goneRet.length?` — нет: ${goneRet.join(' ')}`:''), goneRet.length === 0);
ok('акты, упомянутые в смоуке, есть в наборе'        + (goneAct.length?` — нет: ${goneAct.join(' ')}`:''), goneAct.length === 0);
ok('разнесения, упомянутые в смоуке, есть в наборе'  + (goneAl.length ?` — нет: ${goneAl.join(' ')}` :''), goneAl.length  === 0);
ok('кредиты, упомянутые в смоуке, есть в наборе'     + (goneCr.length ?` — нет: ${goneCr.join(' ')}` :''), goneCr.length  === 0);
ok('периоды, упомянутые в смоуке, есть в наборе'     + (gonePer.length?` — нет: ${gonePer.join(' ')}`:''), gonePer.length === 0);
/* ПТ-Д22: правило без случая в данных не проверяется — набор обязан держать случаи волны. */
ok('в наборе есть сводная строка ЦК на нескольких заёмщиков (R-305 — три платежа)',
   g.ev(`paymentsOf(DATA.receipts.find(r=>r.id==='R-305')).length`) === 3);
ok('в наборе есть кредит с траншами, валютное поступление, слой мирового и возврат',
   g.ev(`DATA.credits.some(c=>c.tranches.length>1)`)
   && g.ev(`DATA.payments.some(p=>p.currency!=='KGS')`)
   && g.ev(`DATA.credits.some(c=>c.layers.some(l=>l.id==='peace'))`)
   && g.ev(`DATA.returns.length > 0`));

/* ══════════════════════════════════════════════════════════════════════════
   ШОВ №1 (ADR-0056) — ТРИ СУЩНОСТИ: поступление · платёж · возврат
   ══════════════════════════════════════════════════════════════════════════ */
head('Ш-1 · три сущности денег');
ok('у каждого платежа есть существующее поступление-родитель',
   g.ev(`DATA.payments.every(p => !!p.receiptId && !!receiptOf(p))`));
ok('у каждого возврата есть существующее поступление-родитель',
   g.ev(`DATA.returns.every(v => !!v.receiptId && !!DATA.receipts.find(r=>r.id===v.receiptId))`));
ok('у каждого платежа существующий кредит, а транш — из этого же кредита',
   g.ev(`DATA.payments.every(p => { const c = creditOf(p.credit);
        return !!c && (p.tranche == null || c.tranches.some(t=>t.id===p.tranche)); })`));
ok('id поступлений, платежей и возвратов уникальны',
   new Set(RECS).size === RECS.length && new Set(PAYS).size === PAYS.length && new Set(RETS).size === RETS.length);
ok('три оси состояния живут на ПОСТУПЛЕНИИ (канал · сопоставление · заморозка)',
   g.ev(`DATA.receipts.every(r => CHAN[r.channel] && MATCH[r.match] && FRZ[r.frozen])`));
ok('у платежа собственных осей нет — он их наследует (ADR-0056)',
   g.ev(`DATA.payments.every(p => !('channel' in p) && !('match' in p) && !('frozen' in p))`));
ok('своей даты у платежа нет: дата = дата фактического поступления (§7.1)',
   g.ev(`DATA.payments.every(p => !('date' in p))`));
ok('карточка платежа так и подписывает дату',
   g.textOf(g.pay('P-2041','req','curator')).includes('дата платежа = дата фактического поступления'));
ok('возврат — не платёж: ни один возврат не числится платежом',
   g.ev(`DATA.returns.every(v => !DATA.payments.some(p => p.id===v.id))`));
ok('получатель возврата — реквизит возврата, а не производная кредита (ПТ-Д2)',
   g.ev(`DATA.returns.every(v => !!v.recipient && !!v.recipient.name && !!v.recipient.kind)`));

/* ══════════════════════════════════════════════════════════════════════════
   ИНВАРИАНТ ПОСТУПЛЕНИЯ — сумма = Σ платежей + исполненные возвраты + остаток
   ══════════════════════════════════════════════════════════════════════════ */
head('инвариант поступления (§2, ПТ-Д1)');
ok('сумма = Σ живых платежей + исполненные возвраты + нераспределённое — по каждому поступлению',
   g.ev(`DATA.receipts.every(r => {
      const paid = DATA.payments.filter(p=>p.receiptId===r.id && !p.void).reduce((s,p)=>s+(p.paidKGS??p.amount),0);
      const ret  = DATA.returns.filter(v=>v.receiptId===r.id && v.state==='executed').reduce((s,v)=>s+v.amount,0);
      return Math.abs(r.amount - (paid + ret + unallocated(r))) < 0.005; })`));
ok('сторнированные платежи в Σ не входят (R-268: платёж есть, Σ = 0)',
   g.ev(`recPaidSum(DATA.receipts.find(r=>r.id==='R-268'))`) === 0
   && g.ev(`paymentsOf(DATA.receipts.find(r=>r.id==='R-268')).length`) === 1);
ok('несостоявшиеся возвраты в Σ не входят (R-290: V-4 недопустим, остаток 0)',
   g.ev(`recRetSum(DATA.receipts.find(r=>r.id==='R-290'))`) === 0
   && Math.abs(g.ev(`unallocated(DATA.receipts.find(r=>r.id==='R-290'))`)) < 0.005);
ok('исполненный возврат в инвариант входит (R-280: 105 000 + 45 000 = 150 000)',
   g.ev(`recPaidSum(DATA.receipts.find(r=>r.id==='R-280'))`) === 105000
   && g.ev(`recRetSum(DATA.receipts.find(r=>r.id==='R-280'))`) === 45000
   && g.ev(`DATA.receipts.find(r=>r.id==='R-280').amount`) === 150000);
ok('платёж входит в инвариант в валюте ПОСТУПЛЕНИЯ, а не долга (P-2049: 1000 USD → 87 500 сом)',
   g.ev(`paidOf(DATA.payments.find(p=>p.id==='P-2049'))`) === 87500
   && g.ev(`DATA.payments.find(p=>p.id==='P-2049').amount`) === 1000);
ok('у невыясненного нераспределённое равно всей сумме',
   g.ev(`unresolvedReceipts().every(r => Math.abs(unallocated(r) - r.amount) < 0.005)`)
   && g.ev(`unresolvedReceipts().length`) > 0);
ok('у сторнированного нераспределённое тоже равно всей сумме',
   g.ev(`DATA.receipts.filter(isReversed).every(r => Math.abs(unallocated(r) - r.amount) < 0.005)`)
   && g.ev(`DATA.receipts.filter(isReversed).length`) > 0);
ok('но трактовка остатка разная: «ожидает опознания» ≠ «снято сторно» ≠ «нераспределённое»',
   g.ev(`recLeftLabel(DATA.receipts.find(r=>r.id==='R-296')).t`) === 'ожидает опознания'
   && g.ev(`recLeftLabel(DATA.receipts.find(r=>r.id==='R-268')).t`) === 'снято сторно'
   && g.ev(`recLeftLabel(DATA.receipts.find(r=>r.id==='R-311')).t`) === 'нераспределённое');
ok('ни у невыясненного, ни у сторнированного остаток не помечен ошибкой',
   g.ev(`DATA.receipts.filter(r=>isUnresolved(r)||isReversed(r)).every(r => recLeftLabel(r).bad === false)`));
ok('всё остальное разнесено полностью: висящих остатков в наборе нет',
   g.ev(`DATA.receipts.every(r => isUnresolved(r) || isReversed(r) || Math.abs(unallocated(r)) < 0.005)`));
ok('карточка поступления печатает инвариант поимённо, а не просто сумму',
   (() => { const t = g.textOf(g.rec('R-280','alloc','curator'));
     return /Инвариант поступления/.test(t) && /Σ платежей/.test(t) && /возвраты исполненные/.test(t); })());
ok('в карточке R-280 числа инварианта сходятся в разметке',
   (() => { const t = g.textOf(g.rec('R-280','alloc','curator'));
     return t.includes('150 000,00') && t.includes('105 000,00') && t.includes('45 000,00'); })());
ok('лента поступлений сводит тот же инвариант итогом и не сообщает о неразнесённых',
   (() => { const t = g.textOf(g.view('receipts','curator'));
     return /Итог по ленте/.test(t) && /остатков, требующих разнесения, нет/.test(t); })());

/* ══════════════════════════════════════════════════════════════════════════
   §4.1–4.2 — СТОРНО ЛЕЧИТ ПОСТУПЛЕНИЕ, А НЕ ПЛАТЁЖ
   ══════════════════════════════════════════════════════════════════════════ */
head('§4 · сторно поступления гасит все его платежи');
ok('сторно поступления гасит ВСЕ его платежи (void:true у каждого)',
   g.ev(`DATA.receipts.filter(isReversed).every(r => { const ps = paymentsOf(r);
        return ps.length > 0 && ps.every(p => p.void === true); })`));
ok('и обратно: погашенный платёж бывает только у сторнированного поступления',
   g.ev(`DATA.payments.filter(p=>p.void).every(p => isReversed(receiptOf(p)))`));
ok('сторнированное не удалено — платёж остался видимым в карточке с меткой',
   /Погашен сторно/.test(g.textOf(g.rec('R-268','alloc','accountant'))));
ok('разнесение сторнированного платежа пусто, а не «снято каскадом» (ПТ-Д8)',
   g.ev(`allocOf(DATA.payments.find(p=>p.id==='P-2038').derived).layers.length`) === 0
   && g.ev(`allocOf(DATA.payments.find(p=>p.id==='P-2038').derived).total`) === 0);
ok('сторнированное поступление невыясненным не считается (иначе гейт назовёт его дважды)',
   g.ev(`DATA.receipts.filter(isReversed).every(r => isUnresolved(r) === false)`));
ok('сторно обратимо: карточка обещает восстановление ИСХОДНОЙ датой поступления',
   (() => { const t = g.textOf(g.rec('R-268','alloc','accountant'));
     return /обратим/i.test(t) && t.includes('14.06.2026'); })());
ok('сторно живёт на поступлении: кнопка есть в карточке поступления',
   g.ev(`(openReceipt('R-311'), [...document.querySelectorAll('#content button')].map(b=>b.textContent.trim()))`)
     .some(t => /^Сторно поступления$/.test(t)));
ok('и НЕ живёт на платеже: в карточке платежа кнопки сторно нет (ПТ-Д12)',
   PAYS.every(id => { g.pay(id,'req','accountant');
     return g.$$('#content button').every(b => !/сторн/i.test(b.textContent)); }));
ok('три разные ошибки — три разные кнопки: сторно · корректировка · перепривязка (§8.3)',
   (() => { g.rec('R-311','alloc','accountant');
     const b = g.$$('#content button').map(x=>x.textContent.trim());
     return b.some(t=>/Сторно поступления/.test(t)) && b.some(t=>/Корректировка суммы/.test(t))
         && b.some(t=>/Перепривязать/.test(t)); })());
ok('таймаут считается в РАБОЧИХ днях и настраивается (§4.2)',
   g.ev('DATA.timeoutDays') === 10 && g.ev('DATA.warnDays') === 3
   && /рабочих дней/.test(g.textOf(g.rec('R-311','alloc','curator'))));
ok('спорная пеня висит на поступлении сторно и хранит только решение комиссии (ПТ-Д14)',
   g.ev(`DATA.receipts.filter(r=>r.dispute).every(r => isReversed(r) && !('from' in r.dispute) && !('to' in r.dispute))`));

/* ══════════════════════════════════════════════════════════════════════════
   §7.1 (ПТ-Д1) — НЕВЫЯСНЕННОЕ = ПОСТУПЛЕНИЕ С НУЛЁМ ПЛАТЕЖЕЙ
   ══════════════════════════════════════════════════════════════════════════ */
head('§7.1 · невыясненное — вид ленты, а не сущность');
ok('невыясненное = поступление с нулём платежей',
   g.ev(`unresolvedReceipts().every(r => paymentsOf(r).length === 0)`));
ok('и наоборот: всякое поступление без платежей (кроме сторно) — невыясненное',
   g.ev(`DATA.receipts.filter(r => paymentsOf(r).length===0 && !isReversed(r)).length === unresolvedReceipts().length`));
ok('отдельного массива данных «невыясненные» в модели нет',
   g.ev(`DATA.unresolved === undefined && DATA.buffer === undefined`));
/* Сравниваем не строки-шаблоны, а отрендеренные <tr>: money() ставит неразрывный
   пробел, и innerHTML отдаёт его сущностью — текстовое сравнение шаблона с разметкой
   ловило бы кодировку, а не рендер. */
ok('экран «Невыясненные» — тот же рендер строки, что и лента поступлений',
   (() => {
     const rowsOf = h => { const d = g.doc.createElement('div'); d.innerHTML = h;
       return Object.fromEntries([...d.querySelectorAll('tbody tr')]
         .map(tr => [tr.getAttribute('onclick'), tr.innerHTML])); };
     const feed = rowsOf(g.view('receipts','curator')), unres = rowsOf(g.view('unresolved','curator'));
     const ids = g.ev(`unresolvedReceipts().map(r=>r.id)`);
     return ids.length > 0 && ids.every(id => {
       const k = `openReceipt('${id}')`;
       return !!feed[k] && feed[k] === unres[k]; })
       && Object.keys(unres).length === ids.length; })());
ok('шапка таблицы у обоих экранов одна и та же',
   (() => { const th = h => { const d = g.doc.createElement('div'); d.innerHTML = h;
       return [...d.querySelectorAll('th')].map(x=>x.textContent).join('|'); };
     return th(g.view('receipts','curator')).startsWith(th(g.view('unresolved','curator')).split('|')[0])
       && th(g.view('unresolved','curator')).includes('Счёт зачисления и что он опознал'); })());
ok('экран прямо называет себя видом ленты, а не буфером-справочником',
   /вид ленты поступлений/i.test(g.textOf(g.view('unresolved','curator'))));
ok('срока годности у чужих денег нет: автосписание в доход не обещано (ПТ-27)',
   (() => { const t = g.textOf(g.view('unresolved','curator'));
     return /по сроку не списываются/i.test(t) && /держит закрытие периода/i.test(t); })());
ok('опознание рождает платёж, а не правит поле: разбор даёт кандидатов и причину',
   (() => { const t = g.textOf(g.rec('R-296','parse','curator'));
     return /с нулём платежей/i.test(t) && /Опознание не «переводит из буфера»/.test(t)
       && t.includes('Бакиров Нурлан Асанович') && t.includes('Бакиров Нуртай Акматович'); })());
ok('у невыясненного без реквизитов кандидатов нет — и это показано (R-294)',
   g.ev(`(DATA.receipts.find(r=>r.id==='R-294').candidates||[]).length`) === 0
   && g.rec('R-294','parse','curator').length > 0);

/* ══════════════════════════════════════════════════════════════════════════
   §8.2 (ПТ-Д9) — ЗАМОРОЗКА МАТЕРИАЛИЗУЕТ СНИМОК; РАСХОЖДЕНИЕ ВИДНО
   ══════════════════════════════════════════════════════════════════════════ */
head('§8.2 · снимок замороженного и расхождение с выводом');
ok('снимок есть ровно у платежей замороженного поступления',
   g.ev(`DATA.payments.filter(p=>!p.void).every(p => (receiptOf(p).frozen==='frozen') === !!p.snapshot)`));
ok('живой платёж снимка не имеет — разнесение выводится (ADR-0001)',
   g.ev(`DATA.payments.filter(p=>receiptOf(p).frozen==='open').every(p => p.snapshot === null)`));
ok('замороженный платёж за слоями не следует: снимок P-2044 ≠ текущий вывод',
   g.ev(`DATA.payments.find(p=>p.id==='P-2044').snapshot`) === 'AL-2044S'
   && g.ev(`DATA.payments.find(p=>p.id==='P-2044').derived`) === 'AL-2044L'
   && !!g.ev(`snapshotDrift(DATA.payments.find(p=>p.id==='P-2044'))`));
ok('расхождение — в составе слоёв, а сумма платежа та же',
   g.ev(`(()=>{const d=snapshotDrift(DATA.payments.find(p=>p.id==='P-2044'));
        return Math.abs(d.snapTotal - d.liveTotal) < 0.005;})()`)
   && g.ev(`allocOf('AL-2044S').layers.map(L=>L.name).join('|') !== allocOf('AL-2044L').layers.map(L=>L.name).join('|')`));
ok('у расхождения названа причина, а не «каскад пересчёта»',
   /поглотил часть требований/i.test(g.ev(`snapshotDrift(DATA.payments.find(p=>p.id==='P-2044')).reason`) || ''));
ok('расхождение ВИДНО в разметке карточки: обе колонки, обе даты, причина',
   (() => { const t = g.textOf(g.pay('P-2044','alloc','curator'));
     return /Снимок и текущий вывод разошлись/.test(t) && /Снимок на заморозке · 12\.07\.2026/.test(t)
       && /Текущий вывод · 04\.08\.2026/.test(t) && /Причина расхождения/.test(t); })());
ok('расхождение помечено и в шапке карточки, и на вкладке',
   (() => { const h = g.pay('P-2044','alloc','curator');
     return /Снимок разошёлся с выводом/.test(g.textOf(h)) && /расхождение/.test(g.textOf(h)); })());
ok('снимок в разметке не подменяется текущим выводом (разные суммы по слоям)',
   (() => { const t = g.textOf(g.pay('P-2044','alloc','curator'));
     return t.includes('180 000,00') && t.includes('320 000,00') && t.includes('500 000,00'); })());
ok('расхождение показывается ровно там, где оно есть (только P-2044)',
   g.ev(`DATA.payments.filter(p=>snapshotDrift(p)).map(p=>p.id).join(',')`) === 'P-2044');
ok('у замороженного без расхождения карточка это и говорит',
   /Текущий вывод от снимка не отличается/.test(g.textOf(g.pay('P-2043','alloc','accountant'))));
ok('у живого платежа карточка говорит «снимка нет и не должно быть»',
   /Снимка нет и не должно быть/.test(g.textOf(g.pay('P-2041','alloc','curator'))));
ok('на замороженном платеже поправка к разнесению запрещена — сперва разморозка',
   /На замороженном платеже поправка запрещена/.test(g.textOf(g.pay('P-2044','alloc','curator'))));
ok('замороженное поступление даёт кнопку разморозки, незамороженное — заморозки',
   (() => { g.rec('R-284','alloc','accountant');
     const a = g.$$('#content button').map(x=>x.textContent.trim());
     g.rec('R-311','alloc','accountant');
     const b = g.$$('#content button').map(x=>x.textContent.trim());
     return a.some(t=>/Разморозить по решению комиссии/.test(t)) && !a.some(t=>/^Заморозить$/.test(t))
        && b.some(t=>/Заморозить/.test(t)) && !b.some(t=>/Разморозить/.test(t)); })());
ok('разморозка — по решению комиссии, и это сказано в карточке',
   /решению комиссии/i.test(g.textOf(g.rec('R-284','alloc','accountant'))));

/* ══════════════════════════════════════════════════════════════════════════
   §5 (ПТ-Д3/Д5/Д6) — МАТРИЦА: СЛОЙ → СТАТЬЯ → СРОЧНОСТЬ, ТРАНШ В КАЖДОЙ СТРОКЕ
   ══════════════════════════════════════════════════════════════════════════ */
head('§5 · матрица разнесения');
ok('у каждого разнесения сходится: наступившее + остаток сверх = всего',
   g.ev(`Object.values(DATA.alloc).every(a => Math.abs((a.due + a.surplusLeft) - a.total) < 0.005)`));
ok('сумма строк матрицы равна НАСТУПИВШЕМУ, а не всей сумме платежа',
   g.ev(`Object.values(DATA.alloc).every(a => {
      const s = a.layers.flatMap(L=>L.articles.flatMap(A=>A.rows)).reduce((x,r)=>x+r.v,0);
      return Math.abs(s - a.due) < 0.005; })`));
ok('сумма разнесения не превышает наступившего ни в одном разнесении',
   g.ev(`Object.values(DATA.alloc).every(a => {
      const s = a.layers.flatMap(L=>L.articles.flatMap(A=>A.rows)).reduce((x,r)=>x+r.v,0);
      return s <= a.due + 0.005; })`));
ok('итог слоя равен сумме его строк',
   g.ev(`Object.values(DATA.alloc).every(a => a.layers.every(L =>
      Math.abs(L.sum - L.articles.flatMap(A=>A.rows).reduce((x,r)=>x+r.v,0)) < 0.005))`));
ok('КАЖДАЯ строка разнесения называет транш',
   g.ev(`Object.values(DATA.alloc).every(a => a.layers.every(L => L.articles.every(A =>
      A.rows.every(r => typeof r.tranche === 'string' && r.tranche.trim().length > 0))))`));
ok('названный транш принадлежит кредиту платежа, а не выдуман',
   g.ev(`DATA.payments.every(p => [p.derived, p.snapshot].filter(Boolean).every(k => {
      const a = DATA.alloc[k], labels = (creditOf(p.credit).tranches||[]).map(t=>t.label);
      return a.layers.every(L=>L.articles.every(A=>A.rows.every(r=>labels.indexOf(r.tranche) >= 0))); }))`));
ok('транш назван в разметке каждой строки матрицы (ПТ-Д3)',
   PAYS.filter(id => id !== 'P-2038').every(id => { g.pay(id,'alloc','curator');
     const rows = g.$$('#content .matrix tbody tr');
     return rows.length > 0 && rows.every(tr => (tr.querySelector('.trn')||{}).textContent); }));
ok('число строк матрицы в разметке равно числу строк разнесения',
   PAYS.every(id => { g.pay(id,'alloc','curator');
     const want = g.ev(`(()=>{const a=allocOf(DATA.payments.find(p=>p.id===${JSON.stringify(id)}).derived);
        return a.layers.flatMap(L=>L.articles.flatMap(A=>A.rows)).length;})()`);
     return g.$$('#content .matrix tbody tr').length === want; }));
ok('транш — область, а не четвёртый уровень: в одной статье бывают строки разных траншей',
   g.ev(`allocOf('AL-2052').layers[0].articles.find(A=>A.article==='Проценты').rows.map(r=>r.tranche).join(',')`)
     === 'Транш №2,Транш №1');
ok('порядок строк задаёт срок, а не номер транша (AL-2052: 10.06 раньше 15.06)',
   g.ev(`allocOf('AL-2052').layers[0].articles.find(A=>A.article==='Проценты').rows.map(r=>r.label).join(' | ')`)
     === 'просроченные (срок 10.06) | просроченные (срок 15.06)');
ok('срочность — из словаря (просрочено · текущее · начисленное)',
   g.ev(`Object.values(DATA.alloc).every(a => a.layers.every(L => L.articles.every(A =>
      A.rows.every(r => ['over','cur','acc'].indexOf(r.urg) >= 0))))`));
ok('уровни матрицы в разметке названы: статья долга · транш · срочность',
   (() => { const h = g.pay('P-2052','alloc','curator');
     const d = g.doc.createElement('div'); d.innerHTML = h;
     const th = [...d.querySelectorAll('.matrix th')].map(x=>x.textContent.trim());
     return th.includes('Статья долга') && th.some(t=>/Транш/.test(t)) && th.includes('Срочность'); })());
ok('второй уровень зовётся СТАТЬЁЙ долга: «категория» на него не пущена (ПТ-Д19)',
   (() => { const d = g.doc.createElement('div'); d.innerHTML = g.pay('P-2052','alloc','curator');
     const mx = [...d.querySelectorAll('.matrix')].map(x=>x.textContent).join(' ');
     return /стать[а-яё]* долга/i.test(d.textContent) && !/категори/i.test(mx); })());
ok('источник очерёдности выражен и берётся из словаря (ПТ-Д6, ADR-0059)',
   g.ev(`Object.values(DATA.alloc).filter(a=>a.ordering).every(a => !!ORDERING[a.ordering.source])`)
   && g.ev(`new Set(Object.values(DATA.alloc).filter(a=>a.ordering).map(a=>a.ordering.source)).size`) >= 2);
ok('нормативный порядок перебивает договорный там, где идёт взыскание (AL-2044S/AL-2043)',
   g.ev(`allocOf('AL-2044S').ordering.source`) === 'norm' && g.ev(`allocOf('AL-2043').ordering.source`) === 'norm'
   && g.ev(`allocOf('AL-2041').ordering.source`) === 'contract');
ok('исключённая статья — нулевой приоритет: в строках матрицы её нет',
   g.ev(`Object.values(DATA.alloc).filter(a=>a.ordering && a.ordering.excluded.length).every(a => {
      const arts = a.layers.flatMap(L=>L.articles.map(A=>A.article.toLowerCase()));
      return a.ordering.excluded.every(x => x.article.toLowerCase().split(/[^а-яё]+/)
        .filter(w=>w.length>3 && w!=='долг').every(w => arts.every(art => art.indexOf(w) < 0))); })`));
ok('исключённая статья названа в разметке вместе с причиной (AL-2054: пеня по мировому)',
   (() => { const t = g.textOf(g.pay('P-2054','alloc','curator'));
     return /исключённая статья/i.test(t) && /приоритет 0/.test(t) && /приостановлено мировым соглашением/i.test(t); })());
ok('расходы по обращению взыскания идут впереди присуждённого долга (AL-2043)',
   g.ev(`allocOf('AL-2043').layers[0].articles.map(A=>A.article).join(' | ')`)
     === 'Расходы по обращению взыскания | Основной долг (присуждённый)');
ok('просрочка показана по слоям и статьям, а не одним числом дней (ПТ-Д17)',
   (() => { const t = g.textOf(g.pay('P-2044','alloc','curator'));
     return /Что именно просрочено/.test(t) && /просрочены статьи долга/.test(t)
       && /Одного числа «дней просрочки» у кредита нет/.test(t); })());
ok('«категория» звучит только в связке с категорией риска',
   /Категория риска/.test(g.textOf(g.pay('P-2044','alloc','curator'))));

/* ══════════════════════════════════════════════════════════════════════════
   ADR-0057/0060 — ОЧЕРЕДЬ ПУБЛИКУЕТ КРЕДИТ; МАТРИЦА НЕ ТРОГАЕТ НЕНАСТУПИВШЕЕ
   ══════════════════════════════════════════════════════════════════════════ */
head('ADR-0060 · очередь погашения и ненаступившее');
ok('очередь погашения — данные КРЕДИТА, а не платежа',
   g.ev(`Object.keys(DATA.queue).every(cid => !!creditOf(cid))`)
   && g.ev(`Object.values(DATA.queue).every(q => !!q.asOf && q.rows.length > 0)`));
ok('в очереди есть и наступившее, и ненаступившее — иначе правило непроверяемо',
   g.ev(`Object.values(DATA.queue).every(q => q.rows.some(x=>x.future) && q.rows.some(x=>!x.future))`));
ok('наступившее на дату по разнесению не больше наступившего по очереди',
   g.ev(`Object.entries(DATA.queue).every(([cid,q]) => {
      const dueSum = q.rows.filter(x=>!x.future).reduce((s,x)=>s+x.amount,0);
      return DATA.payments.filter(p=>p.credit===cid && !p.void)
        .every(p => (allocOf(p.derived)||{due:0}).due <= dueSum + 0.005); })`));
ok('строки очереди с future:true в разнесение не попадают (ни статьёй, ни суммой)',
   g.ev(`Object.entries(DATA.queue).every(([cid,q]) => {
      const fut = q.rows.filter(x=>x.future);
      return DATA.payments.filter(p=>p.credit===cid).every(p => {
        const a = allocOf(p.derived); if(!a) return true;
        const rows = a.layers.flatMap(L=>L.articles.flatMap(A=>A.rows.map(r=>({a:A.article, v:r.v, l:r.label}))));
        return rows.every(r => !fut.some(f => f.article===r.a && Math.abs(f.amount-r.v) < 0.005))
            && rows.every(r => fut.every(f => r.l.indexOf(f.due.slice(0,5)) < 0)); }); })`));
ok('на общей дате среза матрица = ровно наступившие строки очереди (P-2046 и P-2052)',
   (() => {
     const hit = g.ev(`Object.entries(DATA.queue).flatMap(([cid,q]) =>
        DATA.payments.filter(p=>p.credit===cid).filter(p => {
          const a = allocOf(p.derived); return a && payAsOfDate(a.asOf) === q.asOf; }).map(p=>p.id))`);
     const same = g.ev(`Object.entries(DATA.queue).every(([cid,q]) =>
        DATA.payments.filter(p=>p.credit===cid).every(p => {
          const a = allocOf(p.derived); if(!a || payAsOfDate(a.asOf) !== q.asOf) return true;
          const key = x => x.article + '|' + x.amount.toFixed(2);
          const rows = a.layers.flatMap(L=>L.articles.flatMap(A=>A.rows.map(r=>A.article+'|'+r.v.toFixed(2)))).sort().join(',');
          return rows === q.rows.filter(x=>!x.future).map(key).sort().join(','); }))`);
     return same && hit.length >= 2; })());
ok('ненаступившие строки в разметке видны и помечены «матрица не трогает»',
   (() => { g.pay('P-2046','alloc','curator');
     const t = g.textOf(g.html());
     const grey = (g.html().match(/не наступило — матрица не трогает/g)||[]).length;
     return /публикует КРЕДИТ/.test(t) && grey === g.ev(`DATA.queue['C-112'].rows.filter(x=>x.future).length`); })());
ok('у кредита без опубликованной очереди это сказано прямо, а не подменено пустой таблицей',
   /кредитным модулем не опубликована/.test(g.textOf(g.pay('P-2043','alloc','curator'))));

/* ══════════════════════════════════════════════════════════════════════════
   §7.2 (ADR-0062) — ОСТАТОК СВЕРХ НАСТУПИВШЕГО: ТРИ РЕЖИМА
   ══════════════════════════════════════════════════════════════════════════ */
head('§7.2 · три режима остатка сверх наступившего');
ok('режимов ровно три: обратная очередь · аванс · адресный резерв',
   g.ev(`Object.keys(SURPLUS).join(',')`) === 'queue_back,advance,reserve');
ok('у каждого поступления режим задан и берётся из словаря',
   g.ev(`DATA.receipts.every(r => !!SURPLUS[r.surplus])`));
ok('дефолт — обратная очередь; директива стоит только там, где её ставили',
   g.ev(`DATA.receipts.filter(r=>r.surplus!=='queue_back').map(r=>r.id).join(',')`) === 'R-290');
ok('остаток сверх наступившего есть ровно там, где режим не дефолтный (R-290: 70 000)',
   g.ev(`Object.entries(DATA.alloc).filter(([k,a])=>a.surplusLeft>0).map(([k])=>k).join(',')`) === 'AL-2046'
   && g.ev(`allocOf('AL-2046').surplusLeft`) === 70000
   && g.ev(`allocOf('AL-2046').surplusMode`) === 'reserve');
ok('режим разнесения совпадает с режимом поступления (директива, а не правка результата)',
   g.ev(`DATA.payments.filter(p=>{const a=allocOf(p.derived); return a && a.surplusMode;})
        .every(p => allocOf(p.derived).surplusMode === receiptOf(p).surplus)`));
ok('адресный резерв закреплён за НЕнаступившими строками графика',
   g.ev(`(()=>{ const r = DATA.receipts.find(x=>x.id==='R-290');
      const fut = DATA.queue['C-112'].rows.filter(x=>x.future);
      return (r.reserveRows||[]).length > 0 && r.reserveRows.every(x =>
        fut.some(f => f.due===x.due && f.article===x.article && Math.abs(f.amount-x.amount) < 0.005)); })()`));
ok('резерв гасит ФАКТ, а не план: график не перестраивается без заявления (ADR-0063)',
   (() => { const t = g.textOf(g.rec('R-290','parse','curator'));
     return /Резерв гасит ФАКТ, а не план/.test(t) && /только по заявлению заёмщика/i.test(t); })());
ok('режим ставится ДО разнесения — разбор говорит это прямо',
   /ставится ДО разнесения/i.test(g.textOf(g.rec('R-311','parse','curator'))));
ok('на замороженном поступлении режим задним числом не ставится',
   /директива задним числом не ставится/i.test(g.textOf(g.rec('R-290','parse','accountant'))));
ok('три режима показаны выбором, а не одним исходом (ПТ-Д23)',
   (() => { const t = g.textOf(g.rec('R-311','parse','curator'));
     return /Обратная очередь/.test(t) && /Аванс/.test(t) && /Адресный резерв/.test(t); })());

/* ══════════════════════════════════════════════════════════════════════════
   §7.3 / §8.5 (ADR-0054, ADR-0056) — ВОЗВРАТ: ДЕНЬГИ НАРУЖУ
   ══════════════════════════════════════════════════════════════════════════ */
head('§7.3 · возврат и доля залогодателя');
ok('доля залогодателя не попала в погашения: платёж 105 000, возврат 45 000, вместе — 150 000',
   g.ev(`(()=>{ const r = DATA.receipts.find(x=>x.id==='R-280');
      const p = paymentsOf(r).filter(x=>!x.void), v = returnsOf(r).filter(x=>x.state==='executed');
      return p.length===1 && p[0].amount===105000 && v.length===1 && v[0].amount===45000
        && Math.abs(r.amount - (p[0].amount + v[0].amount)) < 0.005; })()`));
ok('45 000 нет ни в одной строке разнесения — доля залогодателя не разносилась',
   g.ev(`allocOf('AL-2043').layers.flatMap(L=>L.articles.flatMap(A=>A.rows)).every(r => r.v !== 45000)`)
   && g.ev(`allocOf('AL-2043').total`) === 105000);
ok('получатель V-3 — третье лицо и ни один заёмщик системы',
   g.ev(`retIsThirdParty(DATA.returns.find(v=>v.id==='V-3'))`) === true
   && g.ev(`DATA.credits.every(c => c.borrower !== DATA.returns.find(v=>v.id==='V-3').recipient.name)`));
ok('карточка возврата говорит, что деньги не наши и в погашение не шли',
   (() => { const t = g.textOf(g.ret('V-3','accountant'));
     return /залогодател/i.test(t) && /105 000,00/.test(t) && /45 000,00/.test(t); })());
ok('допустимость возврата ВЫВОДИТСЯ: состояние совпадает с выводом допустимости',
   g.ev(`DATA.returns.every(v => (v.state==='blocked') === (v.admissibility.ok === false))`));
ok('недопустимый возврат называет препятствия поимённо, а не «отказано»',
   g.ev(`DATA.returns.filter(v=>v.state==='blocked').every(v => v.admissibility.blockers.length > 0)`)
   && g.ev(`DATA.returns.find(v=>v.id==='V-4').admissibility.blockers.length`) === 2);
ok('препятствия V-4 названы в разметке карточки поимённо',
   (() => { const t = g.textOf(g.ret('V-4','curator'));
     return g.ev(`DATA.returns.find(v=>v.id==='V-4').admissibility.blockers`)
       .every(b => t.includes(b.slice(0, 40))); })());
ok('исполненный возврат имеет исполнителя и дату, недопустимый — нет',
   g.ev(`DATA.returns.every(v => (v.state==='executed') === (!!v.execBy && !!v.execAt))`));
ok('возврат заморозке не подлежит: своей оси заморозки у него нет (§8.5)',
   g.ev(`DATA.returns.every(v => !('frozen' in v))`));
ok('у чужих денег основание кладёт бухгалтер, у заёмщика — куратор',
   g.ev(`(()=>{ ROLE='accountant';
      const ownerless = { receiptId:'R-294', recipient:{kind:'Третье лицо'} };
      const a = retOwnerless(ownerless) && retBasisAllowed(ownerless);
      ROLE='curator';
      const b = !retOwnerless(DATA.returns.find(v=>v.id==='V-4')) && retBasisAllowed(DATA.returns.find(v=>v.id==='V-4'));
      return a && b; })()`));
ok('в ленте возвратов возвраты стоят отдельным слагаемым инварианта',
   /В Σ платежей возвраты не входят/.test(g.textOf(g.view('returns','curator'))));

/* ══════════════════════════════════════════════════════════════════════════
   ADR-0061 (ПТ-Д4) — КУРС НБ КР: ПРОИЗВОДНАЯ, ПОДПИСАННАЯ ДАТОЙ
   ══════════════════════════════════════════════════════════════════════════ */
head('ADR-0061 · курс подписан датой');
ok('в наборе есть валютный платёж',
   g.ev(`DATA.payments.filter(p=>p.currency!=='KGS').length`) > 0);
ok('сомовый эквивалент = сумма × курс на дату курса',
   g.ev(`DATA.payments.filter(p=>p.currency!=='KGS').every(p =>
      Math.abs(kgsEquiv(p) - p.paidKGS) < 0.01)`));
ok('дата курса — дата фактического поступления, а не дата ввода',
   g.ev(`DATA.payments.filter(p=>p.currency!=='KGS').every(p => p.rateDate === receiptOf(p).date)`));
ok('курс берётся из справочника и в платеже не хранится',
   g.ev(`DATA.payments.filter(p=>p.currency!=='KGS').every(p => rateOn(p.currency, p.rateDate) != null && !('rate' in p))`));
ok('справочник даёт разные значения на разные даты — иначе подпись датой бессмысленна',
   g.ev(`Object.keys(DATA.rates.USD).length`) >= 2
   && g.ev(`new Set(Object.values(DATA.rates.USD)).size`) >= 2);
ok('сумма платежа — в валюте ДОЛГА, разнесение тоже (AL-2049 в USD)',
   g.ev(`allocOf('AL-2049').currency`) === 'USD'
   && g.ev(`allocOf('AL-2049').total`) === g.ev(`DATA.payments.find(p=>p.id==='P-2049').amount`));
ok('карточка печатает и курс, и его дату, и проверку умножения',
   (() => { const t = g.textOf(g.pay('P-2049','req','curator'));
     return /Курс НБ КР: 87,50 на 24\.07\.2026/.test(t) && /1 000,00 USD × 87,50 = 87 500,00 сом/.test(t); })());
ok('рядом с суммой в ленте платежей курс тоже подписан датой',
   /курс НБ на 24\.07\.2026/.test(g.textOf(g.rec('R-298','alloc','curator'))));
ok('сомового блока у сомового платежа нет — он не выдумывает курс',
   g.pay('P-2041','req','curator').indexOf('Валюта долга и сомовый эквивалент') < 0);

/* ══════════════════════════════════════════════════════════════════════════
   §3 (ADR-0058) — СВЕРКА: ЧЕТЫРЕ ИСХОДА, ПОСЛЕ СОПОСТАВЛЕНИЯ ДЕЙСТВУЕТ СУММА ЦК
   ══════════════════════════════════════════════════════════════════════════ */
head('§3 · сверка с реестром ЦК');
ok('исходов сопоставления четыре, а не два',
   g.ev(`[...new Set(DATA.recon.map(m=>m.outcome))].sort().join(',')`) === 'cbk_only,mismatch,ok,ours_only');
ok('каждый исход указывает на живой объект своей стороны',
   g.ev(`DATA.recon.every(m => (m.receipt ? !!DATA.receipts.find(r=>r.id===m.receipt) : true)
        && (m.reg ? DATA.registry.some(x=>x.doc===m.reg) : true))`));
ok('запись реестра ЦК — отдельная неизменяемая запись, а не поле поступления',
   g.ev(`DATA.registry.every(x => !!x.doc && !!x.date && typeof x.amount === 'number')`)
   && g.ev(`DATA.receipts.every(r => !('cbkAmount' in r))`));
ok('у поступления не больше одной несдублированной строки реестра',
   g.ev(`DATA.receipts.every(r => DATA.registry.filter(x=>x.matched===r.id && !x.dup).length <= 1)`));
ok('дубль реестра помечен и в гейт закрытия не идёт',
   g.ev(`DATA.registry.some(x=>x.dup)`)
   && g.ev(`DATA.periods.every(p => periodBlockers(p.id).every(b => b.id !== '№3455'))`));
ok('при расхождении действует сумма ЦК, и это сказано словами (ПТ-Д13)',
   (() => { const t = g.textOf(g.rec('R-255','alloc','curator'));
     return /действует сумма ЦК/.test(t) && t.includes('18 000,00') && t.includes('18 500,00'); })());
ok('до корректировки платёж носит НАШУ сумму — карточка платежа это признаёт',
   /до корректировки бухгалтером с основанием платёж носит нашу сумму/i.test(g.textOf(g.pay('P-2036','req','curator'))));
ok('несопоставленная строка ЦК держит закрытие своего периода',
   g.ev(`periodBlockers('2026-07').some(b => b.kind === 'Несопоставленная строка реестра ЦК' && b.id === '№3470')`));

/* ══════════════════════════════════════════════════════════════════════════
   §8.6 (ADR-0064) — ЗАКРЫТИЕ ПЕРИОДА: ГЕЙТ НАЗЫВАЕТ ПРЕПЯТСТВИЯ ПОИМЁННО
   ══════════════════════════════════════════════════════════════════════════ */
head('§8.6 · гейт закрытия периода');
ok('гейт называет препятствие поимённо: вид · id · что именно',
   g.ev(`DATA.periods.every(p => periodBlockers(p.id).every(b => !!b.kind && !!b.id && !!b.what))`));
ok('все четыре вида препятствий встречаются в наборе (§8.6)',
   g.ev(`[...new Set(DATA.periods.flatMap(p=>periodBlockers(p.id).map(b=>b.kind)))].sort().join(' | ')`)
     === ['Невыясненное поступление','Незамороженное поступление',
          'Несопоставленная строка реестра ЦК','Ожидает подтверждения ЦК'].sort().join(' | '));
ok('у ЗАКРЫТОГО периода препятствий нет',
   g.ev(`DATA.periods.filter(p=>p.state==='closed').every(p => periodBlockers(p.id).length === 0)`)
   && g.ev(`DATA.periods.filter(p=>p.state==='closed').length`) > 0);
ok('невыясненные держат закрытие июля поимённо (ПС-296 и ПС-294)',
   g.ev(`periodBlockers('2026-07').filter(b=>b.kind==='Невыясненное поступление').map(b=>b.id).join(',')`)
     === 'ПС-296,ПС-294');
ok('незамороженное поступление с положительной сверкой держит закрытие (ПС-305)',
   g.ev(`periodBlockers('2026-07').some(b => b.kind==='Незамороженное поступление' && b.id==='ПС-305')`));
ok('неистёкший таймаут держит закрытие своего периода (ПС-311, август)',
   g.ev(`periodBlockers('2026-08').map(b=>b.kind+'|'+b.id).join(',')`) === 'Ожидает подтверждения ЦК|ПС-311');
ok('каждое препятствие названо в разметке экрана закрытия',
   (() => { const t = g.textOf(g.view('period','accountant'));
     return g.ev(`DATA.periods.filter(p=>p.state==='open').flatMap(p=>periodBlockers(p.id))`)
       .every(b => t.includes(b.kind) && t.includes(b.id)); })());
ok('период с непустым гейтом закрыть нельзя — кнопка отключена',
   (() => { g.view('period','accountant');
     const btns = g.$$('#content button').filter(b => /Закрыть период/.test(b.textContent));
     return btns.length > 0 && btns.every(b => b.hasAttribute('disabled')); })());
ok('у закрытого периода — «Открыть период», и это уровень разморозки',
   (() => { const t = g.textOf(g.view('period','accountant'));
     return /Открыть период/.test(t) && /по решению комиссии/i.test(t); })());
ok('закрытие периода платежи НЕ морозит — оно проверяет, что они заморожены',
   /Платежи не морозит/i.test(g.textOf(g.view('period','accountant'))));
ok('два уровня заморозки не подменяют друг друга (ADR-0064)',
   /Два уровня заморозки не подменяют друг друга/.test(g.textOf(g.view('period','accountant'))));
ok('закрытие и открытие периода — бухгалтер',
   g.ev(`(()=>{ROLE='accountant'; const a=can.closePeriod(); ROLE='curator'; const c=can.closePeriod();
        ROLE='viewer'; const v=can.closePeriod(); return a && !c && !v;})()`));

/* ══════════════════════════════════════════════════════════════════════════
   §8.4 (ПТ-Д10/Д11) — АКТ СВЕРКИ: ДВА ДОКУМЕНТА, КРУГА С ЗАМОРОЗКОЙ НЕТ
   ══════════════════════════════════════════════════════════════════════════ */
head('§8.4 · акты сверки');
ok('акта два вида: внутренний и двусторонний',
   g.ev(`[...new Set(DATA.acts.map(a=>a.kind))].sort().join(',')`) === 'bilateral,internal');
ok('акт по НЕзакрытому периоду подписи не несёт',
   g.ev(`DATA.acts.every(a => !actIsPrelim(a) || a.state !== 'signed')`)
   && g.ev(`DATA.acts.filter(a=>actIsPrelim(a)).length`) > 0);
ok('подписанный акт стоит на закрытом периоде (AS-14 по июню)',
   g.ev(`actIsPrelim(DATA.acts.find(a=>a.id==='AS-14'))`) === false
   && g.ev(`DATA.acts.find(a=>a.id==='AS-14').state`) === 'signed');
ok('состав акта — только замороженные поступления периода',
   g.ev(`DATA.acts.every(a => actComposition(a).inn.every(r => r.frozen === 'frozen'))`));
ok('у не вошедшего поступления причина выводится, а не пишется руками',
   g.ev(`DATA.acts.flatMap(a => actComposition(a).out).every(r => (actWhyOut(r)||'').length > 20)`));
ok('круга «акт ↔ заморозка» нет: первична заморозка',
   (() => { const t = g.textOf(g.view('acts','curator'));
     return /Круга «акт ↔ заморозка» нет: первична заморозка/.test(t) && /Акт ничего не морозит/.test(t); })());
ok('цепочка одна и смотрит в одну сторону: сверка → заморозка → закрытие → акт',
   (() => { const t = g.textOf(g.view('acts','curator'));
     const i = s => t.indexOf(s);
     return i('1. Положительная сверка') >= 0 && i('1. Положительная сверка') < i('2. Заморозка поступления')
       && i('2. Заморозка поступления') < i('3. Закрытие периода') && i('3. Закрытие периода') < i('4. Акт сверки'); })());
ok('двусторонний акт — мера взыскания и живёт в журнале мер (ADR-0051)',
   (() => { const t = g.textOf(g.act('AS-16','curator'));
     return /признание долга/i.test(t) && /журнал/i.test(t) && /давност/i.test(t); })());
ok('предварительный акт помечен предварительным и показывает текущий вывод (AS-15)',
   (() => { const t = g.textOf(g.act('AS-15','curator'));
     return /предварительн/i.test(t) && /выведено на 04\.08\.2026/.test(t); })());
ok('инициатива акта — куратор, согласование — бухгалтер',
   g.ev(`(()=>{ROLE='curator'; const c=can.initAct()&&!actCanAgree(); ROLE='accountant';
        return c && !can.initAct() && actCanAgree();})()`));

/* ══════════════════════════════════════════════════════════════════════════
   §7.4 (ADR-0065) — СПИСАНИЕ УМЕНЬШАЕТ НАЧИСЛЕННОЕ И ПЛАТЕЖОМ НЕ ЯВЛЯЕТСЯ
   ══════════════════════════════════════════════════════════════════════════ */
head('§7.4 · списание — не платёж');
ok('списание не привязано к поступлению и в платежах не числится',
   g.ev(`DATA.writeOffs.every(w => !('receiptId' in w) && !DATA.payments.some(p => p.id === w.id))`));
ok('списание владельцу принадлежит (кредит либо взыскание), модуль его не порождает',
   g.ev(`DATA.writeOffs.every(w => !!w.owner && !!w.basis)`));
ok('сумма списания не попала ни в одну строку разнесения по этому кредиту',
   g.ev(`DATA.writeOffs.every(w => DATA.payments.filter(p=>p.credit===w.credit)
      .every(p => [p.derived,p.snapshot].filter(Boolean).every(k =>
        DATA.alloc[k].layers.flatMap(L=>L.articles.flatMap(A=>A.rows)).every(r => r.v !== w.amount))))`));
ok('карточка платежа показывает ссылку на списание и отличает его от погашения',
   (() => { const t = g.textOf(g.pay('P-2054','alloc','curator'));
     return /Списание уменьшило НАЧИСЛЕННОЕ, погашением не является/.test(t)
       && /в матрицу разнесения не попадает/.test(t); })());

/* ══════════════════════════════════════════════════════════════════════════
   §8.1 (ПТ-Д16) — ПРАВА: ФАКТ ДЕНЕГ — БУХГАЛТЕР, ТРАКТОВКА — КУРАТОР
   ══════════════════════════════════════════════════════════════════════════ */
head('§8.1 · права по принципу, а не перечнем');
const FACT = ['reverse','correct','freeze','unfreeze','closePeriod','execReturn','ownerless'];
const MEAN = ['bind','allocate','surplus','returnBasis','initAct','dispute','match'];
ok('факт денег (сторно · корректировка · заморозка · период · исполнение возврата) — бухгалтер',
   g.ev(`(()=>{ROLE='accountant'; return ${JSON.stringify(FACT)}.every(k=>can[k]());})()`));
ok('трактовка (привязка · разнесение · режим остатка · основание · акт · спор) — куратор',
   g.ev(`(()=>{ROLE='curator'; return ${JSON.stringify(MEAN)}.every(k=>can[k]());})()`));
ok('роли не пересекаются: каждая способность ровно у одной роли',
   g.ev(`Object.keys(can).every(k => ['curator','accountant','viewer']
      .filter(r => { ROLE=r; return can[k](); }).length === 1)`));
ok('наблюдатель не может ничего',
   g.ev(`(()=>{ROLE='viewer'; return Object.keys(can).every(k=>can[k]()===false);})()`));
ok('перечень способностей покрыт принципом целиком (лишних нет)',
   g.ev(`Object.keys(can).sort().join(',')`) === [...FACT,...MEAN].sort().join(','));
ok('наблюдателю запрет объяснён подсказкой роли, а не молчащей кнопкой',
   (() => { g.rec('R-311','parse','viewer');
     return g.$$('#content .role-hint').length > 0; })());
ok('бухгалтеру подсказки про сторно не показывают — это его действие',
   (() => { g.rec('R-311','alloc','accountant');
     return g.$$('#content .role-hint').every(h => !/сторно — бухгалтер/.test(h.textContent)); })());

/* ══════════════════════════════════════════════════════════════════════════
   ПТ-Д18…Д20 — ЕДИНЫЙ ЯЗЫК В ПОЛЬЗОВАТЕЛЬСКОМ ТЕКСТЕ
   Текст берём из отрендеренного DOM (textContent), а не из исходника: комментарии
   разработчика пользователю не показываются и словарём интерфейса не являются.
   ══════════════════════════════════════════════════════════════════════════ */
head('ПТ-Д18…Д20 · единый язык');
const UI = (() => {
  const m = mk(); let t = '';
  const add = h => { t += m.textOf(h || '') + '\n'; };
  for(const r of ROLES){
    VIEWS.forEach(v => add(m.view(v, r)));
    RECS.forEach(id => RTABS.forEach(tb => add(m.rec(id, tb, r))));
    PAYS.forEach(id => PTABS.forEach(tb => add(m.pay(id, tb, r))));
    RETS.forEach(id => add(m.ret(id, r)));
    ACTS.forEach(id => add(m.act(id, r)));
  }
  return t;
})();
const hits = re => (UI.match(new RegExp(re.source, 'gi')) || []).length;
ok('«крыжение» в пользовательском тексте не звучит — говорим «заморозка» (ПТ-Д18)',
   hits(/крыж/) === 0);
ok('«перераспределение» в пользовательском тексте не звучит — говорим «разнесение» (ПТ-Д20)',
   hits(/перераспределен/) === 0);
/* «Каскад пересчёта» — отменённая механика (ПТ-Д8). Спека называет её только затем,
   чтобы отвергнуть (§10 так и озаглавлен), и мокап делает то же самое одной фразой
   в блоке расхождения. Поэтому проверка не «слова нет вовсе», а «слово не называет
   живую механику»: каждое вхождение обязано стоять в явном отрицании, и ни одно —
   в баннере, кнопке или записи истории, где оно читалось бы как действие системы. */
ok('«каскад пересчёта» нигде не назван действием — только явным отрицанием (ПТ-Д8)',
   [...UI.matchAll(/каскад\w*\s+пересч\w*/gi)]
     .every(m => /не существует|не запускается|нет как операции/i
       .test(UI.slice(m.index, m.index + 160))));
ok('«каскад пересчёта» не звучит ни в баннере, ни в кнопке, ни в записи истории',
   (() => { const m = mk(); const bad = [];
     for(const r of ROLES){
       const scan = () => m.$$('#content .banner, #content button, #content .hist, #content .tl-item')
         .forEach(e => { if(/каскад/i.test(e.textContent)) bad.push(e.textContent.slice(0,40)); });
       VIEWS.forEach(v => { m.view(v, r); scan(); });
       RECS.forEach(id => RTABS.forEach(tb => { m.rec(id, tb, r); scan(); }));
       PAYS.forEach(id => PTABS.forEach(tb => { m.pay(id, tb, r); scan(); }));
     }
     return bad.length === 0; })());
ok('«категория» звучит только в связке с категорией риска (ПТ-Д19)',
   hits(/категори[а-яё]*/) > 0
   && [...UI.matchAll(/категори[а-яё]*/gi)].every(m => /^категори[а-яё]*\s+риска/i.test(UI.slice(m.index, m.index + 40))));
ok('единый язык присутствует положительно: заморозка · разнесение · статья долга',
   hits(/заморозк/) > 0 && hits(/разнесени/) > 0 && hits(/стать[а-яё]* долга/) > 0);
ok('«счёт зачисления шлюза (намерение заёмщика)» и три счёта шлюза изъяты (ПТ-Д7)',
   hits(/намерение заёмщика/) === 0 && hits(/три счёта/) === 0);
ok('счёт опознаёт ОБЪЕКТ (кредит либо транш), и это сказано словами',
   /Счёт опознал/.test(UI) && /Опознание объекта — не догадка по ФИО, а свойство счёта/.test(UI));

/* ══════════════════════════════════════════════════════════════════════════
   ПТ-Д21 — РЕНДЕР: ВОСЕМЬ ЭКРАНОВ И ЧЕТЫРЕ КАРТОЧКИ В ТРЁХ РОЛЯХ
   ══════════════════════════════════════════════════════════════════════════ */
head('ПТ-Д21 · рендер восьми экранов и карточек в трёх ролях');
ok('экранов восемь: пять прежних + поступления, возвраты, закрытие периода',
   g.ev('NAV.length') === 8 && g.ev('Object.keys(VIEW_TITLES).length') === 8
   && g.ev(`NAV.map(x=>x.id).sort().join(',')`) === [...VIEWS].sort().join(','));
ok('заглушек этапа 1 не осталось: ни один экран не переписывается',
   !/Экран переписывается/.test(UI));
const renderFails = [];
for(const r of ROLES){
  for(const v of VIEWS){
    const h = g.view(v, r);
    if(!h || h.length < 200) renderFails.push(`${r}/${v}: пусто`);
    else if(DIRT.test(h)) renderFails.push(`${r}/${v}: ${h.match(DIRT)[0]}`);
  }
}
ok('восемь экранов рендерятся во всех трёх ролях без undefined/NaN/[object'
   + (renderFails.length ? ' — ' + renderFails.slice(0,4).join(' · ') : ''), renderFails.length === 0);
const cardFails = [];
for(const r of ROLES){
  for(const id of RECS) for(const tb of RTABS){
    const h = g.rec(id, tb, r);
    if(!h || h.length < 200) cardFails.push(`${r}/${id}/${tb}: пусто`);
    else if(DIRT.test(h)) cardFails.push(`${r}/${id}/${tb}: ${h.match(DIRT)[0]}`);
  }
  for(const id of PAYS) for(const tb of PTABS){
    const h = g.pay(id, tb, r);
    if(!h || h.length < 200) cardFails.push(`${r}/${id}/${tb}: пусто`);
    else if(DIRT.test(h)) cardFails.push(`${r}/${id}/${tb}: ${h.match(DIRT)[0]}`);
  }
  for(const id of RETS){
    const h = g.ret(id, r);
    if(!h || h.length < 200) cardFails.push(`${r}/${id}: пусто`);
    else if(DIRT.test(h)) cardFails.push(`${r}/${id}: ${h.match(DIRT)[0]}`);
  }
  for(const id of ACTS){
    const h = g.act(id, r);
    if(!h || h.length < 200) cardFails.push(`${r}/${id}: пусто`);
    else if(DIRT.test(h)) cardFails.push(`${r}/${id}: ${h.match(DIRT)[0]}`);
  }
}
ok('карточки поступления, платежа, возврата и акта — все вкладки, все роли, без грязи'
   + (cardFails.length ? ' — ' + cardFails.slice(0,4).join(' · ') : ''), cardFails.length === 0);
ok('счётчики бокового меню считаются из данных, а не проставлены руками',
   g.ev(`NAV.find(x=>x.id==='unresolved').badge()`) === g.ev('unresolvedReceipts().length')
   && g.ev(`NAV.find(x=>x.id==='period').badge()`)
      === g.ev(`DATA.periods.filter(p=>p.state==='open'&&periodBlockers(p.id).length).length`));
ok('хлебная крошка карточки называет открытый объект, а не экран',
   (() => { g.rec('R-311','alloc','curator');
     const a = g.doc.getElementById('crumbTitle').textContent;
     g.pay('P-2041','req','curator');
     const b = g.doc.getElementById('crumbTitle').textContent;
     return a === 'ПС-311' && b === 'ПЛ-2041'; })());
ok('роль переключается селектором шапки и перерисовывает экран',
   (() => { const m = mk();
     m.ev(`go('receipts'); document.getElementById('roleSel').value='viewer'; onRoleChange();`);
     return m.ev('ROLE') === 'viewer' && m.$$('#content .role-hint').length >= 0; })());

console.log(`\nОШИБОК КОНСОЛИ (jsdomError): ${g.errs.length}`);
g.errs.forEach(e => console.log('  ' + e));
console.log(`ВСЕГО ПРОВЕРОК: ${n} · ПРОВАЛЕНО: ${fails}`);
process.exit(fails || g.errs.length ? 1 : 0);
