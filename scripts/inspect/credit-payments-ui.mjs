// Проверка ЭКРАННОГО слоя вкладки «Платежи» карточки кредита на jsdom.
// Зачем отдельно от credit-check.mjs: тот исполняет только логический слой в node:vm,
// без DOM, и о том, открывается ли карточка платежа и есть ли в ней формы, не знает
// ничего. Волна 23.09.2026 (ADR-0257/0258) перенесла на карточку именно экранную
// работу — значит и сторожить её надо на экране.
//   node scripts/inspect/credit-payments-ui.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = readFileSync(resolve(__dir, '../../mockups/loan-credit/credit.html'), 'utf8');

const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail?.message || e.message)));
vc.on('error', (...a) => errs.push('error: ' + a.join(' ')));

const dom = new JSDOM(HTML, { runScripts:'dangerously', virtualConsole:vc, url:'http://localhost/' });
const w = dom.window, doc = w.document;
await new Promise(r => setTimeout(r, 400));
const CR = w.CR;
const results = [];
const ok = (n, cond, note='') => results.push({ n, pass: !!cond, note });
const modal = () => (doc.getElementById('modalHost') || {}).innerHTML || '';
const settle = () => new Promise(r => setTimeout(r, 120));

ok('U0', !!CR && errs.length === 0, `ошибок загрузки: ${errs.length}${errs[0] ? ' — ' + errs[0] : ''}`);

/* Оболочка знает РАБОТНИКА, а не только роль: без него закрепление нечем показать. */
const emp = doc.getElementById('empSel');
ok('U1', !!emp && emp.options.length >= 2, `работников в шапке: ${emp ? emp.options.length : 0}`);

/* Вкладка «Платежи» кредита K-1: строки кликабельны, тулбар несёт ввод и переход. */
w.location.hash = '#K-1/Платежи';
w.dispatchEvent(new w.Event('hashchange'));
await settle();
const tab = doc.body.innerHTML;
const rows = doc.querySelectorAll('tr.payrow');
ok('U2', rows.length > 0 && /Очередь погашения/.test(tab), `кликабельных строк: ${rows.length}`);
ok('U3', /Внести платёж по списку ЦК/.test(tab) && /Открыть в модуле платежей/.test(tab),
   'ввод и переход в модуль на вкладке');

/* Строка открывает КАРТОЧКУ ПЛАТЕЖА — те же четыре вкладки, что у владельца. */
rows[0].dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
await settle();
const card = modal();
const tabs = ['Реквизиты','Разбивка','Спорная пеня','История'].filter(t => card.includes(t));
ok('U4', /Платёж № /.test(card) && tabs.length === 4, `вкладок карточки: ${tabs.length}/4`);
/* Перепривязка — ПЕРЕХОД, а не форма (ADR-0257 §4). */
ok('U5', /Перепривязать — в модуле/.test(card) && !/onclick="CR\.submitRebind/.test(card),
   'перепривязка подана кнопкой-переходом');
/* ШАПКА КОРОЧЕ (ADR-0257 §2): номер договора и подпись «Заёмщик» второй раз не
   печатаются — их несёт карточка кредита. Имя плательщика при этом на вкладке
   «Реквизиты» законно: плательщик — реквизит ПОСТУПЛЕНИЯ и часто третье лицо. */
const k1num = (CR.db.credits.find(c => c.id === 'K-1') || {}).num;
ok('U6', !!k1num && !card.includes(k1num) && !/>Заёмщик</.test(card),
   `номер договора ${k1num} в карточке платежа не повторяется`);

/* Формы действий трактовки — от закреплённого куратора. */
CR.setCurrentActor('Куратор', CR.assignedCuratorOf(CR.db.credits.find(c => c.id === 'K-1')));
CR.closeModal(); CR.openPaymentModal(); await settle();
const form = modal();
ok('U7', ['payCbkNum','payCbkDate','paySurplus','payMethod','payPayer','payNote'].every(id => form.includes(id)),
   'форма ввода несёт реквизиты документа ЦК и режим остатка');

CR.closeModal(); CR.openPaymentCard(2); CR.setPayCardTab('alloc'); await settle();
ok('U8', /Режим остатка/.test(modal()) && /Поправка к разбивке/.test(modal()), 'вкладка «Разбивка» с действиями');

CR.openSurplusModal(); await settle();
const sur = modal();
ok('U9', /spMode/.test(sur) && (sur.match(/class="spRow"/g) || []).length > 0,
   `строк очереди в форме резерва: ${(sur.match(/class="spRow"/g) || []).length}`);

CR.openAllocAdjust(); await settle();
ok('U10', /adjReason/.test(modal()), 'поправка требует основания на форме');
CR.openMatchModal(); await settle();
ok('U11', /mtRef/.test(modal()), 'сопоставление требует ссылки на строку реестра');

/* ФАКТА ДЕНЕГ НА ЭКРАНЕ КРЕДИТА НЕТ (ADR-0257 §5) — ни на вкладке, ни в карточке. */
CR.closeModal(); CR.openPaymentCard(2); await settle();
const all = doc.body.innerHTML + modal();
const money = ['Сторнировать','Разморозить','Заморозить платёж','Корректировка суммы'].filter(x => all.includes(x));
ok('U12', money.length === 0, `действий факта денег на экране: ${money.length}${money.length ? ' — ' + money.join(', ') : ''}`);

const pass = results.filter(r => r.pass).length;
results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`));
console.log(`UI SMOKE (jsdom) ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS`);
if (pass !== results.length) process.exit(1);
