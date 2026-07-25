// Headless smoke для mockups/loan-credit/credit.html (канон §9, Р-1…Р-20, Г-1…Г-17).
// Zero-dep: извлекает <script> из HTML и исполняет чистый логический слой в node:vm
// (без DOM — тесты дёргают только pure-функции window.CR). Результат печатает и
// вставляет в комментарий-шапку HTML (блок «SMOKE (node ...)»).
//   node scripts/inspect/credit-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/loan-credit/credit.html');
const src   = readFileSync(HTML, 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'credit.inline.js' });
const CR = win.CR;
if (!CR) { console.error('window.CR не инициализирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const byId = (db, id) => db.credits.find(c => c.id === id);
const pd = CR.pd;

/* 0a. seedDb даёт 6 демо-цепочек К-1…К-6 + фон. */
(() => { const db = CR.seedDb();
  const ids = db.credits.map(c => c.id);
  ok('0a', ['K-1','K-2','K-3','K-4','K-5','K-6'].every(x => ids.includes(x)) && db.credits.length >= 14,
     `credits=${db.credits.length}`);
})();
/* 0b. К-1 «Бек Кабель»: 2 транша, договор 150000, одобрено 150000. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  ok('0b', c && c.tranches.length===2 && c.contractAmount===150000 && c.approvedAmount===150000
       && c.borrower.inn==='01912201610212', `t=${c&&c.tranches.length}`);
})();

/* 19. Покрытие от залоговой, не оценочной: правка оценочной не двигает индекс. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const before = CR.derive(c).coverage.index;
  c.mirror.pledges[0].items[0].appraised *= 2;      // оценочная ×2, залоговая та же
  const after = CR.derive(c).coverage.index;
  ok(19, before === after, `${before} vs ${after}`);
})();
/* 20. Порог переменный: ликвид→120; движимое неликвидное при доле ликвида≥80→150; source сработавшего правила. */
(() => { const db = CR.seedDb();
  const liq = byId(db,'K-1'); const dl = CR.derive(liq).coverage;
  const ill = byId(db,'K-2'); const di = CR.derive(ill).coverage;   // К-2 сконфигурирован как движимое неликвидное
  ok(20, dl.req===120 && di.req===150 && !!dl.source && !!di.source, `liq=${dl.req} ill=${di.req}`);
})();
/* 21. Поручительство не влияет на индекс; банковская гарантия — влияет. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const base = CR.derive(c).coverage.index;
  c.mirror.guarantees.push({kind:'поручительство', party:'X', amount: c.contractAmount});
  const afterGuar = CR.derive(c).coverage.index;
  c.mirror.bankGuarantee = { bank:'Банк', amount: c.contractAmount*0.5, till:'01.01.2027' };
  const afterBank = CR.derive(c).coverage.index;
  ok(21, base===afterGuar && afterBank>afterGuar, `base=${base} guar=${afterGuar} bank=${afterBank}`);
})();
/* 25. Ось 2 производна: освоение на полную сумму → «Полностью освоен» без ручного действия. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const s0 = CR.derive(c).disbState;                                // «Частично освоен»
  c.tranches[1].disbursements.push({date:'01.09.2026', amount:50000, order:'ПП-9', purpose:'', doc:''});
  const s1 = CR.derive(c).disbState;
  ok(25, s0==='Частично освоен' && s1==='Полностью освоен', `${s0}→${s1}`);
})();

/* 1/2. Г-1: сумма договора > одобренной → блок; = → проходит. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.gate(c,'saveContractAmount',{value:c.approvedAmount+1}).ok;
  const good= CR.gate(c,'saveContractAmount',{value:c.approvedAmount}).ok;
  ok(1, bad===false); ok(2, good===true);
})();
/* 3. Г-2: создание из заявки без одобрения → блок. */
(() => { const db=CR.seedDb(); const app=db.applications.find(a=>a.approved===false);
  ok(3, CR.gate(null,'createCredit',{application:app}).ok===false);
})();
/* 4. Г-3: сумма транша сверх доступного остатка → блок; в пределах — проходит. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const d=CR.derive(c);
  ok(4, CR.gate(c,'addTranche',{amount:d.allocatable+1}).ok===false
      && CR.gate(c,'addTranche',{amount:d.allocatable}).ok===true);
})();
/* 6. Г-5: освоение при ЖЦ «Проект» → блок. Транш №2 (50000, не освоен) — чтобы
   Г-4 (Σ освоений > сумма транша) НЕ сработал и блокировал только Г-5;
   assert проверяет причину, а не только ok, — иначе тест не ловит сломанный Г-5. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); c.lifecycle='Проект';
  const g = CR.gate(c,'addDisbursement',{trancheNo:2, amount:1});
  ok(6, g.ok===false && g.reasons.some(x=>/освоение возможно только при жц/i.test(x)));
})();
/* 9. Г-7: регистрация без скана → блок. К-1 (покрытие 132%≥120%, комплект документов
   «принят», num/date есть) — чтобы гейт покрытия/комплекта НЕ сработал и блокировал
   только отсутствующий скан; assert проверяет причину, а не только ok. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); c.reg.scan=null;
  const g = CR.gate(c,'register',{});
  ok(9, g.ok===false && g.reasons.some(x=>/скан|номер, дату/i.test(x)));
})();
/* 12. Г-9: правка ставки прямым вводом после «Зарегистрирован» → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); // lifecycle≥Зарегистрирован
  ok(12, CR.gate(c,'editConditions',{field:'rate'}).ok===false);
})();
/* 17. Г-13: привязка залога с чужим ИНН → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const alien = db.pledgesRegistry.find(p=>p.pledgorInn!==c.borrower.inn);
  ok(17, CR.gate(c,'linkPledge',{pledge:alien}).ok===false);
})();
/* 23. Г-12: списание без реквизитов решения → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-3');
  ok(23, CR.gate(c,'writeOff',{doc:null}).ok===false
      && CR.gate(c,'writeOff',{doc:{kind:'Решение',num:'1',date:'01.07.2026'}}).ok===true);
})();
/* 26. Роль «Наблюдатель»: все действия заблокированы. */
(() => { ok(26, ['saveContractAmount','addTranche','savePayment','writeOff','register']
   .every(a => CR.canRole('Наблюдатель', a)===false)); })();

/* 8. Г-8: график до освоения → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[1]; // не освоен
  ok(8, CR.gate(c,'buildSchedule',{tranche:t}).ok===false);
})();
/* 10. Р-8/Г-6: покрытие блокирует освоение (84%) до ввода реквизитов решения КМ;
   после setKmDecision гейт реально переключается false→true (не только исходный блок). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  const before = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok; // покрытие 84%
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-1',date:'01.06.2026',scan:'km.pdf'});
  const after = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  ok(10, before===false && after===true, `${before}→${after}`);
})();
/* 11. График: 1-е формирование → v1; повторное → v2, v1 остаётся архивной. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[0];
  CR.generateSchedule(c,1,{from:t.disbursements[0].date,freq:'Ежемесячно',method:'Аннуитетный'});
  const v1 = t.schedules.length;
  CR.generateSchedule(c,1,{from:t.disbursements[0].date,freq:'Ежемесячно',method:'Аннуитетный'});
  const active = t.schedules.filter(s=>s.active).length;
  ok(11, v1>=1 && t.schedules.length===v1+1 && active===1, `n=${t.schedules.length} act=${active}`);
})();
/* 24. Г-15: пауза без основания → блок; с основанием → интервал без начисления процентов. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.holdAccrual(c,{from:'01.06.2026'}).ok;
  const good= CR.holdAccrual(c,{from:'01.06.2026',to:'01.08.2026',reason:'форс-мажор',doc:'прик.5',by:'Куратор'}).ok;
  const rows = CR.buildSchedule(c.tranches[0], pd(c.tranches[0].disbursements[0].date)).rows;
  const held = rows.some(r => pd(r.date)>=pd('01.06.2026') && pd(r.date)<pd('01.08.2026') && r.interest===0);
  ok(24, bad===false && good===true && held, `bad=${bad} good=${good} held=${held}`);
})();

/* 5. Г-4: освоение сверх суммы транша → блок. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  ok(5, CR.addDisbursement(c,{trancheNo:1, amount:1_000_000, order:'x'}).ok===false);
})();
/* 7. К-5: освоение заблокировано покрытием → ввод реквизитов КМ → освоение разрешено (Г-6,Р-8). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  const before = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-77',date:'01.06.2026',scan:'km.pdf'});
  const after = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  ok(7, before===false && after===true, `${before}→${after}`);
})();
/* 8b (в Task 5): второй разблок — waiver без обоснования не сохраняется. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  const bad = CR.saveWaiver(c,{reason:''}).ok;
  const good= CR.saveWaiver(c,{reason:'комиссия по залогу, протокол №9'}).ok;
  ok('8b', bad===false && good===true && CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok===true);
})();
/* 13. Г-10: ДС без номера/даты не проходит гейт; с реквизитами регистрируется
       документом в credit.agreements — без before/after/active (значения условий
       несут только записи, addAgreement — только реестр документов, Task 4). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.addAgreement(c,{num:'',date:''}).ok;
  const r   = CR.addAgreement(c,{num:'ДС-1',date:'01.07.2026',source:'кредит',scan:'ds-1.pdf'});
  const doc = c.agreements.find(a=>a.num==='ДС-1');
  ok(13, bad===false && r.ok===true && !!doc && doc.date==='01.07.2026' && doc.source==='кредит'
      && doc.before===undefined && doc.after===undefined && doc.active===undefined);
})();
/* 14. ДС из реструктуризации помечено источником и не редактируется из кредита. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-4');
  const a = c.agreements.find(x=>x.source==='реструктуризация');
  ok(14, !!a && CR.gate(c,'editConditions',{field:'rate'}).ok===false);
})();
/* 15. Ручной платёж: 0 → блок; корректный → оси «Ручной ввод»+«Ожидает ЦК». */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const bad = CR.addPayment(c,{amount:0,date:'01.07.2026',trancheNo:1}).ok;
  CR.addPayment(c,{amount:1000,date:'01.07.2026',trancheNo:1});
  const p = c.mirror.payments[c.mirror.payments.length-1];
  ok(15, bad===false && p.reg==='Ручной ввод' && p.match==='Ожидает ЦК');
})();
/* 16. Платёж «Подтверждён ЦК» → правка из кредита недоступна при любой роли. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const p = c.mirror.payments.find(x=>x.match==='Подтверждён ЦК') || (c.mirror.payments[0]||{});
  ok(16, CR.paymentEditable(c,p)===false);
})();
/* 22. К-3: «Погашен» блок при остатке+взыскании (Г-14); после обнуления и закрытия — разрешён. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-3');
  const before = CR.closeCredit(c,{reason:'Погашен'}).ok;
  CR.zeroOutForTest(c); c.mirror.collection=[];                       // тест-хелпер: обнулить ledger + снять взыскание
  const after = CR.closeCredit(c,{reason:'Погашен'}).ok;
  ok(22, before===false && after===true, `${before}→${after}`);
})();
/* 27. Аудит append-only: журнал нельзя менять; действия оставили записи. Заморозка
   и отсутствие delete-API — ДВА независимых assert (были слиты в один ||, из-за
   чего заморозка не проверялась ни разу — CR.deleteAudit всегда отсутствует). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const n0=c.audit.length;
  CR.setKmDecision(c,{kind:'x',num:'1',date:'01.06.2026',scan:'s.pdf'});
  CR.addPayment(c,{amount:500,date:'01.07.2026',trancheNo:1});
  const grew = c.audit.length>=n0+2;
  const frozen = Object.isFrozen(c.audit[0]);                          // журнал реально заморожен
  const noDeleteApi = !CR.deleteAudit;                                 // нет интерфейса удаления
  ok(27, grew && frozen && noDeleteApi);
})();
/* 27b. Заморозка сквозная: запись Task-4-происхождения (holdAccrual) тоже идёт через
   pushAudit — тоже заморожена и той же формы {when,who,what,...}. Ловит регрессию,
   если кто-то снова начнёт пушить «сырой» {ts,action,note} в credit.audit напрямую. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  CR.holdAccrual(c,{from:'01.06.2026',to:'01.08.2026',reason:'форс-мажор',doc:'прик.5',by:'Куратор'});
  const last = c.audit[c.audit.length-1];
  ok('27b', Object.isFrozen(last) && 'when' in last && 'who' in last && 'what' in last);
})();
/* 18. Р-7: вкладка «Обеспечение» никогда не предлагает «Создать залоговый договор» —
   залоговые договоры заводятся только в модуле залога; карточка кредита предлагает
   только «Привязать существующий». Структурная проверка src-строки (рендер вкладок
   живёт под `if (typeof document !== 'undefined')` — вне vm-песочницы не вызывается).
   Фраза легитимно встречается в ДВУХ комментариях (канон-шапка «РЕАЛИЗОВАННЫЕ РЕШЕНИЯ»,
   doc-comment над linkPledge()) и в тексте-предупреждении пикера привязки («...нельзя —
   только в модуле залога») — ни один из них не кнопка/ярлык, поэтому проверяем именно
   отсутствие кнопочной конструкции (roleBtn(...)/<button>...), а не голое substring-отсутствие. */
(() => {
  const stripComments = s => s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => /^\s*\/\//.test(l) ? '' : l).join('\n');
  const stripped = stripComments(src);
  const strippedHasCode = /function\s+gate\s*\(/.test(stripped);           // strip не съел код
  const phrase = 'Создать залоговый договор';
  const btnPattern = new RegExp(`roleBtn\\([^)]*${phrase}[^)]*\\)|<button[^>]*>[^<]*${phrase}`, 'i');
  const offeredAsAction = btnPattern.test(stripped);                       // кнопка/ярлык с этой фразой?
  const linkPresent = stripped.includes('Привязать существующий');
  ok(18, strippedHasCode && !offeredAsAction && linkPresent,
     `code=${strippedHasCode} offeredAsAction=${offeredAsAction} link=${linkPresent}`);
})();
/* 28. Г-17: физического удаления нет — карточка НИКОГДА не предлагает кнопку «Удалить»
   (реестр/гриды/траншы/платежи append-only, Р-20). Структурная проверка src-строки тем же
   способом, что и #18: снимаем комментарии (<!-- -->, /* *​/, строчные //) и убеждаемся, что в
   коде НЕТ кнопочной конструкции roleBtn(...)/actBtn(...)/<button>…, чей ярлык — «Удалить».
   Фраза «Удалить» легитимно встречается ровно один раз — в блок-комментарии над gate()
   («нет кнопок „Удалить“») — и снимается strip'ом, поэтому проверяем именно отсутствие
   КНОПКИ, а не голое substring-отсутствие. НЕ тавтология: синтетический
   <button>Удалить</button> либо roleBtn('x','Удалить',…) в НЕ-комментарном коде тест бы завалил. */
(() => {
  const stripComments = s => s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => /^\s*\/\//.test(l) ? '' : l).join('\n');
  const stripped = stripComments(src);
  const strippedHasCode = /function\s+gate\s*\(/.test(stripped);           // strip не съел код
  const phrase = 'Удалить';
  const btnPattern = new RegExp(
    `roleBtn\\([^)]*${phrase}[^)]*\\)|actBtn\\([^)]*${phrase}[^)]*\\)|<button[^>]*>[^<]*${phrase}`, 'i');
  const deleteBtn = btnPattern.test(stripped);                             // кнопка «Удалить» в коде?
  ok(28, strippedHasCode && !deleteBtn,
     `code=${strippedHasCode} deleteBtn=${deleteBtn}`);
})();

/* 29. Р-21/Д-3: t.conditions как хранимое поле удалено; conditionsAt даёт полный
       комплект из 10 параметров на каждом транше — и на сиде, и на транше, добавленном
       через addTranche (регрессия дыры: addTranche раньше сам писал t.conditions,
       минуя conditionRecords). */
(() => { const db = CR.seedDb();
  let stored = [], incomplete = [];
  for (const c of db.credits) for (const t of c.tranches){
    if (t.conditions !== undefined) stored.push(t.id);
    const at = CR.conditionsAt(t, CR.TODAY);
    if (CR.PARAM_KEYS.some(k => at[k] === undefined)) incomplete.push(t.id);
  }
  const c1 = db.credits.find(x => x.id === 'K-1'); const d1 = CR.derive(c1);
  const addRes = CR.addTranche(c1, { amount: d1.allocatable, plannedDate: '01.01.2027' });
  const t1 = c1.tranches[c1.tranches.length - 1];
  const newStored = t1.conditions !== undefined;
  const newAt = CR.conditionsAt(t1, CR.TODAY);
  const newIncomplete = CR.PARAM_KEYS.some(k => newAt[k] === undefined);
  ok(29, stored.length===0 && incomplete.length===0
      && addRes.ok && !newStored && !newIncomplete,
     `хранимое=${stored.slice(0,3)} неполные=${incomplete.slice(0,3)} addTranche.ok=${addRes.ok} новый.conditions=${newStored} новый.неполные=${newIncomplete}`);
})();
/* 30. Реестр параметров — ровно 10 ключей, без параметров расчётного движка. */
(() => {
  const expect = ['rate','reserveRate','penaltyMain','penaltyInt','term','freq','method',
                  'graceMain','graceInterest','graceAccrual'];
  const same = CR.PARAM_KEYS.length===expect.length && expect.every(k => CR.PARAM_KEYS.includes(k));
  const noEngine = !CR.PARAM_KEYS.includes('dayMethod') && !CR.PARAM_KEYS.includes('queue')
                && !CR.PARAM_KEYS.includes('penaltyMaxPct');
  ok(30, same && noEngine, `keys=${CR.PARAM_KEYS.join(',')}`);
})();
/* 31. conditionsAt на дату до первой записи — пустой объект, без исключения. */
(() => { const db = CR.seedDb(); const t = db.credits[0].tranches[0];
  let threw = false, empty = false;
  try { empty = Object.keys(CR.conditionsAt(t, '01.01.2000')).length === 0; } catch(e){ threw = true; }
  ok(31, !threw && empty, `threw=${threw}`);
})();
/* 32. Переезд не сдвинул цифры: агрегат срока (Р-13) и длина графика считаются
       из conditionsAt и совпадают с условиями транша. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-1');
  const terms = c.tranches.map(t => CR.conditionsAt(t, CR.TODAY).term);
  const d = CR.derive(c);
  const t1 = c.tranches[0];
  const from = (t1.disbursements[0] || {}).date;
  const rows = from ? CR.buildSchedule(t1, from).rows : [];
  ok(32, d.termAgg === Math.max(...terms) && rows.length === CR.conditionsAt(t1, CR.TODAY).term,
     `termAgg=${d.termAgg} terms=${terms} rows=${rows.length}`);
})();

/* 33. Д-7: агрегат по кредиту — одно значение при согласии траншей,
       divergent при расхождении; divergenceRows перечисляет только спорные
       параметры. В демо ровно один кредит с расхождением. */
(() => { const db = CR.seedDb();
  const k1 = db.credits.find(c => c.id === 'K-1');
  const agg1 = CR.creditConditionsAt(k1, CR.TODAY);
  const single = agg1.rate && agg1.rate.divergent !== true;
  const divergent = db.credits.filter(c => {
    const a = CR.creditConditionsAt(c, CR.TODAY);
    return CR.PARAM_KEYS.some(k => a[k] && a[k].divergent);
  });
  const dc = divergent[0];
  const rows = dc ? CR.divergenceRows(dc, CR.TODAY) : [];
  // rows должны перечислять ровно те PARAM_KEYS, что агрегат пометил divergent — не мусор.
  const aggD = dc ? CR.creditConditionsAt(dc, CR.TODAY) : {};
  const expectParams = CR.PARAM_KEYS.filter(k => aggD[k] && aggD[k].divergent);
  const paramsMatch = rows.length === expectParams.length
    && expectParams.every(p => rows.some(r => r.param === p));
  // каждая строка должна покрывать ровно активные транши кредита, значениями conditionsAt.
  const activeNos = dc ? dc.tranches.filter(CR.activeTranche).map(t => t.no).sort((a,b) => a-b) : [];
  const cellsOk = dc && rows.every(r => {
    const rowNos = r.cells.map(c => c.trancheNo).slice().sort((a,b) => a-b);
    const nosMatch = JSON.stringify(rowNos) === JSON.stringify(activeNos);
    const valuesMatch = r.cells.every(cell => {
      const t = dc.tranches.find(t => t.no === cell.trancheNo);
      return t && cell.value === CR.conditionsAt(t, CR.TODAY)[r.param];
    });
    return nosMatch && valuesMatch;
  });
  ok(33, single && divergent.length === 1 && rows.length >= 1 && rows.every(r => r.cells.length >= 2)
      && paramsMatch && cellsOk,
     `divergent=${divergent.map(c=>c.id)} rows=${rows.map(r=>r.param)} cells0=${JSON.stringify(rows[0] && rows[0].cells)}`);
})();

/* 34. Д-2: журнал строится группировкой записей по основанию; ДС-РС-1004
       кредита К-4 стал записями (ставка 9→7, срок 36→48, с 01.05.2026),
       а поля before/after у соглашений больше не хранятся. Дополнительно —
       группировка по multi-траншевому кредиту: одна запись basis на двух
       траншах должна схлопнуться в ОДНУ группу с trancheNos обоих траншей
       (а не потеряться/задвоиться), иначе журнал по многотраншевым кредитам врёт. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-4');
  const groups = CR.basisGroups(c);
  const ds = groups.find(g => g.ref === 'ДС-РС-1004');
  const prim = groups.find(g => g.kind === 'application');
  const rate = ds && ds.items.find(i => i.param === 'rate');
  const term = ds && ds.items.find(i => i.param === 'term');
  const noBeforeAfter = (c.agreements || []).every(a => a.before === undefined && a.after === undefined);
  const desc = groups.length < 2 || CR.pd(groups[0].effectiveFrom) >= CR.pd(groups[1].effectiveFrom);
  // multi-траншевый кредит с Task-3-демо расхождением (K-C40, 2 транша) — та же
  // первичная запись из mkPrimaryRecords лежит на обоих траншах под одним basis.ref.
  const multi = db.credits.find(x => /^K-C/.test(x.id) && x.tranches.length === 2);
  const multiPrim = multi && CR.basisGroups(multi).find(g => g.kind === 'application');
  const trancheNosOk = !!multiPrim && multiPrim.trancheNos.length === 2
    && multiPrim.trancheNos[0] < multiPrim.trancheNos[1];
  const bothTranchesInItems = !!multiPrim && CR.PARAM_KEYS.some(k => {
    const nos = multiPrim.items.filter(i => i.param === k).map(i => i.trancheNo);
    return multiPrim.trancheNos.every(no => nos.includes(no));
  });
  ok(34, !!ds && !!prim && rate && String(rate.from)==='9' && String(rate.to)==='7'
      && term && String(term.from)==='36' && String(term.to)==='48'
      && ds.effectiveFrom==='01.05.2026' && noBeforeAfter && desc
      && trancheNosOk && bothTranchesInItems,
     `groups=${groups.map(g=>g.ref).join('|')} rate=${rate&&rate.from+'->'+rate.to} multi=${multi&&multi.id} multiTrancheNos=${multiPrim&&multiPrim.trancheNos}`);
})();

/* 35. Д-4/Д-5: суд и ПП — источники изменения условий по ссылке на существующий
       документ; ретро-запись помечена флагом ровно на К-3. */
(() => { const db = CR.seedDb();
  const k3 = db.credits.find(c => c.id === 'K-3');
  const k2 = db.credits.find(c => c.id === 'K-2');
  const courtRec = k3.tranches.flatMap(t => t.conditionRecords).find(r => r.basis.kind === 'court');
  const govRec   = k2.tranches.flatMap(t => t.conditionRecords).find(r => r.basis.kind === 'govAct');
  const retroK3  = CR.retroFlags(k3);
  const retroOthers = db.credits.filter(c => c.id !== 'K-3' && CR.retroFlags(c).length);
  ok(35, courtRec && courtRec.param === 'penaltyMain' && Number(courtRec.value) === 0 && !!courtRec.basis.ref
      && govRec && govRec.param === 'reserveRate' && !!govRec.basis.ref
      && retroK3.length >= 1 && retroOthers.length === 0,
     `court=${!!courtRec} gov=${!!govRec} retroK3=${retroK3.length} прочие=${retroOthers.map(c=>c.id)}`);
})();

/* 36. Гейты Г-18…Г-21 вокруг записи условия. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-1');
  const t = c.tranches[0];
  const mk = (over) => Object.assign({
    basis:{ kind:'agreement', num:'ДС-2001', date:CR.TODAY, ref:'ДС-2001', label:'ДС-2001' },
    records:[{ param:'rate', value:5, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }]
  }, over || {});
  /* Г-18: раньше даты договора */
  const g18 = CR.addConditionRecords(c, mk({ records:[{ param:'rate', value:5,
    effectiveFrom:'01.01.2000', trancheNos:[t.no], note:'x' }] }));
  /* Г-19: ретро-ДС запрещено. Дата вступления — после даты договора К-1
     (12.05.2026), но раньше TODAY (23.07.2026): ретро именно по Г-19,
     не по Г-18 (иначе g20ok не смог бы пройти вовсе). */
  const g19bad = CR.addConditionRecords(c, mk({ records:[{ param:'rate', value:5,
    effectiveFrom:'01.06.2026', trancheNos:[t.no], note:'x' }] }));
  /* Г-19: ретро-суд разрешено, но Г-20 требует примечания */
  const courtBasis = { kind:'court', ref:'АД-999', label:'Решение суда АД-999', date:'01.02.2026' };
  const g20bad = CR.addConditionRecords(c, { basis:courtBasis,
    records:[{ param:'rate', value:5, effectiveFrom:'01.06.2026', trancheNos:[t.no], note:'' }] });
  const g20ok  = CR.addConditionRecords(c, { basis:courtBasis,
    records:[{ param:'rate', value:5, effectiveFrom:'01.06.2026', trancheNos:[t.no], note:'по решению суда' }] });
  /* Г-10: суд без ссылки на документ */
  const g10 = CR.addConditionRecords(c, { basis:{ kind:'court', ref:'', label:'' },
    records:[{ param:'rate', value:5, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'x' }] });
  /* несуществующий номер транша — гейт должен ловить, а не молча пропускать (added:0) */
  const gBadTranche = CR.addConditionRecords(c, mk({ records:[{ param:'rate', value:5,
    effectiveFrom:CR.TODAY, trancheNos:[999], note:'' }] }));
  /* Г-21: функции удаления записей в API нет */
  const noDelete = Object.keys(CR).every(k => !/^(remove|delete).*[Cc]ondition/.test(k));
  const reasonsOk = g18.reasons.some(s => /Г-18/.test(s))
    && g19bad.reasons.some(s => /Г-19/.test(s))
    && g20bad.reasons.some(s => /Г-20/.test(s))
    && g10.reasons.some(s => /Г-10/.test(s))
    && gBadTranche.reasons.some(s => /транш.*№?\s*999|999.*транш/i.test(s));
  ok(36, !g18.ok && !g19bad.ok && !g20bad.ok && g20ok.ok && !g10.ok && !gBadTranche.ok
      && noDelete && reasonsOk && CR.conditionsAt(t, CR.TODAY).rate === 5,
     `г18=${g18.ok} г19=${g19bad.ok} г20=${g20bad.ok}/${g20ok.ok} г10=${g10.ok} badTranche=${gBadTranche.ok} ` +
     `noDelete=${noDelete} reasonsOk=${reasonsOk} g18r=${JSON.stringify(g18.reasons)} badTr=${JSON.stringify(gBadTranche.reasons)}`);
})();

/* 37. Г-22: изменение условий при ЖЦ «Проект» → блок (в «Проекте» условия
   правятся напрямую — editConditions, Г-9). К-1 (ЖЦ ≥ «Зарегистрирован» по
   умолчанию) — переключаем на «Проект», чтобы проверить именно этот гейт.
   Формулировка пинится целиком (белый список ЖЦ + отсылка к прямой правке),
   а не одним инвариантным куском: иначе тест прошёл бы и на старом тексте. */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-1'); c.lifecycle = 'Проект';
  const t = c.tranches[0];
  const mk = () => CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-3001', date:CR.TODAY, ref:'ДС-3001', label:'ДС-3001' },
    records:[{ param:'rate', value:5, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  const g = mk();
  const full = /Г-22/.test(g.reasons.join(' ')) && /ЖЦ «Зарегистрирован» или «Действует»/.test(g.reasons.join(' '))
            && /в «Проекте» условия правятся напрямую/.test(g.reasons.join(' '));
  ok(37, g.ok===false && full, `ok=${g.ok} reasons=${JSON.stringify(g.reasons)}`);
})();
/* 39. Г-22, второй перекрытый ЖЦ — «Закрыт»: белый список ЖЦ отсекает и терминал,
   с той же формулировкой (в UI кнопку раньше перехватывает терминальная проверка). */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-1');
  c.lifecycle = 'Закрыт'; c.closure = { reason:'Погашен', date:CR.TODAY, doc:null };
  const t = c.tranches[0];
  const g = CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-3002', date:CR.TODAY, ref:'ДС-3002', label:'ДС-3002' },
    records:[{ param:'rate', value:5, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  const noRecord = !(t.conditionRecords||[]).some(r => r.basis && r.basis.ref === 'ДС-3002');
  ok(39, g.ok===false && /Г-22/.test(g.reasons.join(' '))
      && /ЖЦ «Зарегистрирован» или «Действует»/.test(g.reasons.join(' ')) && noRecord,
     `ok=${g.ok} noRecord=${noRecord} reasons=${JSON.stringify(g.reasons)}`);
})();

/* 38. Д-5, погашение предупреждения: ретро-запись зажигает retroPendingFlags,
   перегенерация активного графика транша её гасит (generatedAt новее createdAt),
   следующая ретро-запись зажигает снова. retroFlags при этом не гаснет никогда —
   это факт истории, а не индикатор «нужно пересчитать». */
(() => { const db = CR.seedDb(); const c = db.credits.find(x => x.id === 'K-3');
  const before = CR.retroPendingFlags(c).length;                      // сид: запись суда от 12.07.2026
  const t = c.tranches[0];
  const r = CR.generateSchedule(c, t.no, { from: t.disbursements[0].date });
  const act = (t.schedules||[]).find(s => s.active);
  const after = CR.retroPendingFlags(c).length;
  // новая ретро-запись после перегенерации → плашка обязана зажечься снова
  CR.addConditionRecords(c, { basis:{ kind:'court', ref:'ЗАНОВО', label:'Решение суда · ЗАНОВО', date:'' },
    records:[{ param:'penaltyInt', value:0, effectiveFrom:'01.06.2026', trancheNos:c.tranches.map(x=>x.no),
               note:'повторное ретро — проверка возврата предупреждения' }] });
  const again = CR.retroPendingFlags(c).length;
  ok(38, before>0 && r.ok!==false && !!act && !!act.generatedAt && after===0 && again>0
      && CR.retroFlags(c).length>0,
     `before=${before} after=${after} again=${again} generatedAt=${act&&act.generatedAt}`);
})();

const pass = results.filter(r => r.pass).length;
const stamp = `SMOKE (node) ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS`;
results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`));
console.log(stamp);
// впечатать stamp + список в блок «SMOKE (node ...)» шапки HTML
const list = results.map(r => `   #${r.n} ${r.pass ? '✓' : '✗ ' + r.note}`).join('\n');
const block = `SMOKE (node)\n ${stamp}\n${list}`;
// \s* до lookahead съедает НАКОПИВШИЕСЯ пустые строки перед «-->» (иначе стамп
// рос бы на одну пустую строку с каждым запуском — предыдущий вид оставлял их
// нетронутыми, а сам всегда добавлял свой '\n').
const out = src.replace(/SMOKE \(node\)[\s\S]*?\s*(?=-->)/, block + '\n');
writeFileSync(HTML, out, 'utf8');
if (pass !== results.length) process.exit(1);
