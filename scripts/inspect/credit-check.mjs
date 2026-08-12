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
/* 20. Порог переменный и приходит ЗЕРКАЛОМ залога (ADR-0011): ликвидный состав → 120,
   движимый неликвид в составе → 150. Кредит порог не выводит — только применяет. */
(() => { const db = CR.seedDb();
  const liq = byId(db,'K-3'); const dl = CR.derive(liq).coverage;   // земельный участок — недвижимость, ликвид
  const ill = byId(db,'K-2'); const di = CR.derive(ill).coverage;   // в составе оборудование — движимый неликвид
  ok(20, dl.req===120 && di.req===150 && !!dl.source && !!di.source
      && dl.mirror.reqBase===120 && di.mirror.reqBase===150, `liq=${dl.req} ill=${di.req}`);
})();
/* 20b. Порог по решению КМ ПЕРЕКРЫВАЕТ порог по составу (Прил.1 §2.6): coverPct — owned
   поле кредита, поэтому индекс на нём и пересчитывается. coverPct=0 — полное освобождение. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-5');
  const base = CR.derive(c).coverage;                                // 150 % по составу, индекс 0,56
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-9',date:'01.07.2026',scan:'km.pdf',coverPct:80});
  const km = CR.derive(c).coverage;
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-9',date:'01.07.2026',scan:'km.pdf',coverPct:0});
  const free = CR.derive(c).coverage;
  ok('20b', base.req===150 && base.ok===false && km.req===80 && km.reqFromKm===true && km.ok===true
      && free.req===0 && free.ok===true,
     `состав=${base.req}/${base.ok} КМ80=${km.req}/${km.ok} КМ0=${free.req}/${free.ok}`);
})();
/* 21. Поручительство в индекс не входит (ADR-0011, §10.2 закрыт «нет»); банковская
   гарантия входит — со СВОИМ порогом (см. 56). Гарантия приходит в ЗЕРКАЛЕ, поэтому
   и добавляется в него — кредит числитель не считает. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const base = CR.derive(c).coverage.index;
  c.mirror.guarantees.push({kind:'поручительство', party:'X', amount: c.contractAmount});
  const afterGuar = CR.derive(c).coverage.index;
  c.mirror.coverage.bankGuarantee = c.contractAmount*0.5;
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
  const before = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok; // обеспеченность 56% при пороге 150%
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-1',date:'01.06.2026',scan:'km.pdf',coverPct:80});
  const after = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  ok(10, before===false && after===true, `${before}→${after}`);
})();
/* 11. График: 1-е формирование → v1; повторное → v2, v1 остаётся в истории (Р-4).
   Переписан КВ-26: флаг active снят, действующая версия ВЫВОДИТСЯ по срезу (последняя
   с validFrom ≤ дата), как conditionsAt/subjectAt/derive (КВ-10). Инвариант тот же —
   на любую дату действующая ровно одна, — но держится по построению, а не поддержкой
   флага при каждой записи. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[0];
  CR.generateSchedule(c,1,{from:t.disbursements[0].date,freq:'Ежемесячно',method:'Аннуитетный'});
  const v1 = t.schedules.length;
  CR.generateSchedule(c,1,{from:t.disbursements[0].date,freq:'Ежемесячно',method:'Аннуитетный'});
  const at = CR.scheduleAt(t, '23.07.2026');
  ok(11, v1>=1 && t.schedules.length===v1+1 && at && at.ver===t.schedules.length
         && t.schedules.every(s => s.active === undefined),
     `n=${t.schedules.length} действует v${at && at.ver} флагов active=${t.schedules.filter(s=>s.active!==undefined).length}`);
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
/* 7. К-5: освоение заблокировано обеспеченностью → решение КМ со своим порогом → разрешено (Г-6,Р-8). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  const before = CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok;
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-77',date:'01.06.2026',scan:'km.pdf',coverPct:80});
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
  c.mirror.claims=[]; CR.zeroOutForTest(c);                           // снять требования, затем погасить платежом через зеркало
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
/* 30. Реестр параметров — ровно 16 ключей (шаг 18: +payDay/lastPaymentAnchor/payMonths/
   graceIntDistFrom/graceIntDistTo; шаг 20: +dayMethod, вернулся из «Расчётов» —
   решение пользователя). queue/penaltyMaxPct остаются вне реестра. */
(() => {
  const expect = ['rate','reserveRate','penaltyMain','penaltyInt','term',
                  'payDay','lastPaymentAnchor','freq','payMonths','method',
                  'graceMain','graceInterest','graceIntDistFrom','graceIntDistTo','graceAccrual',
                  'dayMethod'];
  const same = CR.PARAM_KEYS.length===expect.length && expect.every(k => CR.PARAM_KEYS.includes(k));
  const noEngine = !CR.PARAM_KEYS.includes('queue') && !CR.PARAM_KEYS.includes('penaltyMaxPct');
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
  /* Запись «ПП снимает ставку резерва» переехала с К-2 на кредит, где снятие резерва
     и есть сюжет: у К-2 она обнуляла ставку, ради которой К-2 заведён (КР-18). */
  const k2 = db.credits.find(c => /Аламудун-Теплицы/.test(c.borrower.name));
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
  const act = CR.scheduleAt(t, CR.TODAY);                             // КВ-26: действующая — по срезу, не по флагу
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

/* ============================================================
   БЛОК 2 · СОГЛАСОВАННОСТЬ ДАННЫХ (волна 27.07.2026, КР-23).
   Все 39 тестов выше проверяют ФУНКЦИИ. Дефекты, найденные ревизией, жили не в
   функциях, а в данных и в слое рендера — и поэтому пережили 16 шагов слияния:
   К-1 показывал остаток 0 при освоении 100 000, восемь фоновых кредитов были
   засеяны в состоянии, которое их собственный гейт не пропустил бы, а вкладка
   «Проблемные» противоречила шапке. Ниже — проверки ровно на это.
   ============================================================ */

/* 40. Освоение больше нуля при нулевом остатке — противоречие (КР-7). Долг выводится
   из графика и зеркала платежей, поэтому освоенный и непогашенный кредит обязан
   показывать остаток. Исключение — закрытые: там ноль есть результат погашения. */
(() => { const db = CR.seedDb();
  const bad = db.credits.filter(c => { const d = CR.derive(c);
    return d.disbursed > 0 && d.debtBalance === 0 && c.lifecycle !== 'Закрыт'; });
  ok(40, bad.length === 0, `нарушителей=${bad.length} ${bad.map(c=>c.id).join(',')}`);
})();

/* 41. График есть, детального расчёта нет — противоречие (КР-8/КР-9): позиции,
   наступившие на дату среза, обязаны попасть в расчёт, иначе дни просрочки равны
   нулю по построению. */
(() => { const db = CR.seedDb();
  const bad = db.credits.filter(c => { const d = CR.derive(c);
    const rows = c.tranches.reduce((a,t) => a + CR.trancheScheduleRows(t).length, 0);
    const due  = c.tranches.reduce((a,t) => a + CR.trancheScheduleRows(t)
      .filter(r => CR.pd(r.date) <= CR.pd(CR.TODAY)).length, 0);
    return rows > 0 && due > 0 && d.ledger.rows.length === 0; });
  ok(41, bad.length === 0, `нарушителей=${bad.length} ${bad.map(c=>c.id).join(',')}`);
})();

/* 42. СИД ПРОХОДИТ СОБСТВЕННЫЕ ГЕЙТЫ (КР-19). Гейты проверяются только на новых
   действиях, поэтому демо-данные могли годами хранить состояние, недостижимое
   легальным путём: восемь фоновых кредитов «Действует» с освоением при нулевой
   обеспеченности. Освоенный кредит обязан удовлетворять Г-6 — или нести waiver. */
(() => { const db = CR.seedDb();
  const bad = db.credits.filter(c => { const d = CR.derive(c);
    /* волна 03.08.2026 (КР-57): waiver — owned-поле кредита, а не mirror.*. Читать его
       из зеркала теперь значит «waiver нет никогда» — инвариант стал бы строже правила
       и объявлял бы нарушителем законно разблокированный кредит. */
    return c.lifecycle !== 'Закрыт' && d.disbursed > 0 && !d.coverage.ok && !c.pledgeWaiver; });
  ok(42, bad.length === 0,
     `нарушителей=${bad.length} ${bad.map(c=>{const d=CR.derive(c);return c.id+':'+(d.coverage.index==null?'нет зеркала':Math.round(d.coverage.index*100)+'%');}).join(',')}`);
})();

/* 43. ЕДИНЫЙ ИСТОЧНИК КАТЕГОРИИ (КР-6). Категория в шапке и разбор на вкладке
   «Проблемные» обязаны совпадать: worst-of собирается один раз. Проверяем сам
   инвариант — итог равен худшему из двух своих входов, и послабление применено. */
(() => { const db = CR.seedDb();
  const ORDER = ['низкий','средний','высокий'];
  const bad = db.credits.filter(c => { const d = CR.derive(c); const b = d.riskBasis;
    const worst = ORDER[Math.max(ORDER.indexOf(b.byDays), ORDER.indexOf(b.byFactors))];
    /* вход категории = дни просрочки МИНУС спорный период (§4.4 спеки платежей), затем
       послабление. Спорные дни видны в просрочке, но заёмщику не вменяются. */
    const reliefApplied = b.relief ? b.eff <= 180 : b.eff === b.raw - b.disputed;
    return d.riskCategory !== worst || !reliefApplied; });
  /* и предметно: K-C16 (220 дн.) с послаблением — «средний», без него был бы «высокий» */
  const k = db.credits.find(c => /Иссык-Ата-Санаторий/.test(c.borrower.name));
  const dk = CR.derive(k);
  ok(43, bad.length === 0 && dk.riskBasis.raw >= 181 && dk.riskBasis.eff === 180 && dk.riskBasis.byDays === 'средний',
     `нарушителей=${bad.length} · K-C16 факт=${dk.riskBasis.raw} эфф=${dk.riskBasis.eff} → ${dk.riskCategory}`);
})();

/* 44. Зеркало платежей двигает остаток, а неподтверждённый платёж — нет (Р-5 + ADR-0010).
   Прежняя модель не умела ни того ни другого: платёж «Подтверждён ЦК» у К-1 не менял
   ничего, потому что долг читался из засеянного ledger. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const before = CR.derive(c).debt.principal.bal;
  c.mirror.payments.push({ num:99, date:CR.TODAY, amount:10000, tranche:1, reg:'Ручной ввод',
    match:'Ожидает ЦК', frozen:false, layers:{ principal:10000 } });
  const pending = CR.derive(c).debt.principal.bal;
  c.mirror.payments[c.mirror.payments.length-1].match = 'Подтверждён ЦК';
  const confirmed = CR.derive(c).debt.principal.bal;
  ok(44, pending === before && confirmed === Math.round((before - 10000)*100)/100,
     `было=${before} ожидает=${pending} подтверждён=${confirmed}`);
})();

/* 45. Периодичность работает (КР-13): «ежеквартально» даёт вчетверо меньше позиций,
   чем «ежемесячно», при том же сроке. Прежний движок всегда строил помесячно. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const monthly = CR.buildSchedule(t, t.disbursements[0].date).rows.length;
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-FREQ', date:CR.TODAY, ref:'ДС-FREQ', label:'ДС-FREQ' },
    records:[{ param:'freq', value:'ежеквартально', effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  const quarterly = CR.buildSchedule(t, t.disbursements[0].date).rows.length;
  ok(45, monthly === 24 && quarterly === 8, `мес=${monthly} кв=${quarterly}`);
})();

/* 46. День платежа НЕ зажимается к 28-му (КР-14): освоение 31.05 даёт 30.06 и 31.07,
   а не три платежа 28-го числа. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const rows = CR.buildSchedule(t, '31.05.2026').rows.slice(0,3).map(r => r.date);
  ok(46, rows[0]==='30.06.2026' && rows[1]==='31.07.2026' && rows[2]==='31.08.2026', rows.join(' · '));
})();

/* 47. graceAccrual и graceInterest — РАЗНЫЕ механизмы (КР-13). Отсрочка начисления
   обнуляет начисленное; льгота по процентам начисляет, но не включает в платёж. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const set = (param, value) => CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-'+param, date:CR.TODAY, ref:'ДС-'+param, label:'ДС-'+param },
    records:[{ param, value, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  set('graceAccrual', 3);
  const accr = CR.buildSchedule(t, t.disbursements[0].date).rows[0];
  set('graceAccrual', 0); set('graceInterest', 3);
  const intr = CR.buildSchedule(t, t.disbursements[0].date).rows[0];
  ok(47, accr.accrued === 0 && accr.interest === 0 && intr.accrued > 0 && intr.interest === 0,
     `отсрочка: начисл=${accr.accrued} платёж=${accr.interest} · льгота: начисл=${intr.accrued} платёж=${intr.interest}`);
})();

/* 48. Обязательный комплект документов реально проверяется (КР-11). Пустой массив
   документов больше НЕ проходит Г-7: `.every()` на пустом давал true, поэтому у 57
   кредитов из 59 гейт не мог сработать в принципе. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const empty = Object.assign(Object.create(Object.getPrototypeOf(c)), c, { docs: [] });
  const st = CR.docsStatusOf(empty);
  const req = CR.programDocs(c).req;
  const partial = CR.docsStatusOf(c);                       // финотчётность «на проверке» → не закрыт
  ok(48, req.length > 0 && st.complete === false && st.missing.length === req.length
      && partial.complete === false && partial.missing.includes('Финансовая отчётность'),
     `обязательных=${req.length} пусто→${st.complete} К-1→${partial.complete} (${partial.missing.join(',')})`);
})();

/* 49. Послабление опознаётся ЗАПИСЬЮ со сроком, а не регуляркой по тексту (КР-15).
   Приостановка начисления с основанием «Постановление 181-ФЗ» не должна включать
   подавление 181-го дня; истёкшее послабление перестаёт действовать. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  CR.holdAccrual(c, { from:'01.06.2026', to:null, reason:'Постановление 181-ФЗ о моратории',
                      doc:'pp-181.pdf', by:'Куратор' });
  const falsePositive = !!CR.relief181(c, CR.TODAY);
  const k4 = byId(db,'K-4');
  const active  = !!CR.relief181(k4, CR.TODAY);            // срок до 12.08.2026
  const expired = !!CR.relief181(k4, '01.10.2026');        // после дедлайна
  ok(49, falsePositive === false && active === true && expired === false,
     `ложное=${falsePositive} действует=${active} истекло=${expired}`);
})();

/* 50. Переход ЖЦ существует и работает (КР-1): Проект → Зарегистрирован → Действует.
   Гейт был написан, право стояло у двух ролей, а мутации и кнопки не существовало. */
(() => { const db = CR.seedDb();
  const proj = db.credits.find(c => c.lifecycle === 'Проект' && CR.gate(c,'register',{}).ok);
  if (!proj) return ok(50, false, 'в демо нет «Проекта», проходящего Г-7');
  const r1 = CR.registerCredit(proj, {});
  const lc1 = proj.lifecycle;
  const beforeAct = CR.gate(proj,'activate',{}).ok;                  // освоений нет → блок
  CR.addDisbursement(proj, { trancheNo: proj.tranches[0].no, amount: 1000, order:'ПП-т' });
  const r2 = CR.activateCredit(proj);
  ok(50, r1.ok && lc1 === 'Зарегистрирован' && beforeAct === false && r2.ok && proj.lifecycle === 'Действует',
     `${lc1} → ${proj.lifecycle} (до освоения activate=${beforeAct})`);
})();

/* 51. Подгруппа — зеркало заёмщика, а не вывод кредита (КР-12/КР-27). Списанный кредит
   с ненулевым остатком не может быть подписан «Погашен»: прежний payGroupOf возвращал
   '5 · Погашен' на любом «Закрыт». */
(() => { const db = CR.seedDb(); const c = byId(db,'K-6b'); const d = CR.derive(c);
  const noPayGroup = typeof CR.derive(c).payGroup === 'undefined';
  ok(51, d.debtBalance > 0 && d.subgroup === '4' && /безнадеж/i.test(d.subgroupLabel||'') && noPayGroup,
     `остаток=${d.debtBalance} подгруппа=${d.subgroup} «${d.subgroupLabel}»`);
})();

/* 52. Пятая статья не влияет на Г-14 (ADR-0004/0008): расходы по обращению взыскания
   принадлежат взысканию, и кредит не может зависеть от чужих расходов в вопросе,
   погашен ли он. Четыре собственные статьи — влияют. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  c.mirror.claims = []; CR.zeroOutForTest(c);
  c.mirror.collectionCosts = 15000;                                   // чужие расходы висят
  const g = CR.gate(c,'repay',{});
  const d = CR.derive(c);
  ok(52, g.ok === true && d.collectionCosts === 15000 && d.debtBalance === 0,
     `Г-14=${g.ok} расходы=${d.collectionCosts} остаток=${d.debtBalance}`);
})();

/* 56. КР-38: У БАНКОВСКОЙ ГАРАНТИИ СВОЙ ПОРОГ (ADR-0011, Прил.1 §2.3) — 100 % в валюте
   кредита, 120 % в иной. Индекс собирается как СУММА двух нормированных слагаемых, а не
   как одна дробь с залоговым порогом в знаменателе. Одна и та же гарантия в сомах даёт
   разный индекс у сомового и у валютного кредита. */
(() => { const db = CR.seedDb();
  const kgs = byId(db,'K-C6'),  a = CR.derive(kgs).coverage;    // кредит KGS, гарантия KGS → 100 %
  const rub = byId(db,'K-C44'), b = CR.derive(rub).coverage;    // кредит RUB, гарантия KGS → 120 %
  const exact = Math.abs(a.index - (kgs.mirror.coverage.bankGuarantee / (a.base * 1.0))) < 0.011;
  ok(56, a.gReq===100 && b.gReq===120 && a.index > b.index && exact
      && a.index === Math.round((a.idxPledge + a.idxGuar)*100)/100,
     `KGS: порог=${a.gReq} индекс=${a.index} · RUB: порог=${b.gReq} индекс=${b.index}`);
})();
/* 56b. Решение КМ перекрывает ЗАЛОГОВЫЙ порог и не трогает ГАРАНТИЙНЫЙ: §2.6 говорит о
   требовании к обеспечению кредита, норматив гарантии — о возвратности самой гарантии. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-C6');
  const before = CR.derive(c).coverage;
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-56',date:'01.07.2026',scan:'km.pdf',coverPct:200});
  const after = CR.derive(c).coverage;
  ok('56b', before.gReq===100 && after.gReq===100 && after.req===200
      && Math.abs(after.idxGuar - before.idxGuar) < 1e-9,
     `req=${before.req}→${after.req} gReq=${before.gReq}→${after.gReq} idxГ=${before.idxGuar}→${after.idxGuar}`);
})();
/* 56c. Истёкшая гарантия обеспечением не является и в индекс не входит. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-C6');
  const live = CR.derive(c).coverage.index;
  c.mirror.coverage.bankGuarantee = 0; c.mirror.coverage.guaranteeExpired = true;
  const dead = CR.derive(c).coverage;
  ok('56c', live > 0 && dead.index === 0 && dead.ok === false && dead.gReq === null,
     `действует=${live} истекла=${dead.index}/${dead.ok}`);
})();
/* 57. КР-39: ДОЛЯ ЛИКВИДА — ВТОРАЯ ПОДПРОВЕРКА ТОГО ЖЕ ГЕЙТА (Прил.1 §2.4). При пороге
   150 % ликвидная часть залога обязана покрывать ≥ 80 % суммы под риском. K-C28 —
   единственный в наборе случай, где индекс выполнен, а состав не тот: гейт Г-6 блокирует
   освоение по доле, а не по индексу. До волны кредит подпроверки не имел вовсе, хотя
   модуль-владелец её считал — два модуля выносили разный вердикт по одному кредиту. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-C28');
  const d = CR.derive(c), cov = d.coverage;
  const g = CR.gate(c,'addDisbursement',{tranche:1, amount:1000, date:'23.07.2026'});
  ok(57, cov.req===150 && cov.covOk===true && cov.index>=1 && cov.liqApplies===true
      && cov.liqShare===0 && cov.liqOk===false && cov.ok===false && g.ok===false,
     `индекс=${cov.index} доля=${cov.liqShare} liqOk=${cov.liqOk} гейт=${g.ok}`);
})();
/* 57b. База у обеих подпроверок одна — сумма под риском: доля ликвида растёт по мере
   погашения ровно так же, как индекс. Две подпроверки от разных величин рассинхронизированы
   по построению, поэтому проверяем именно совпадение базы. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c), cov = d.coverage;
  const expect = Math.round((c.mirror.coverage.liquidValue / cov.base) * 100) / 100;
  ok('57b', cov.liqApplies===true && cov.liqShare===expect && cov.base===d.atRisk && cov.liqOk===true,
     `доля=${cov.liqShare} ожидалось=${expect} база=${cov.base} atRisk=${d.atRisk}`);
})();
/* 57c. Порог по решению КМ подменяет состав целиком, поэтому подпроверка §2.4 вместе с
   ним отключается: КМ назначил своё требование взамен состава. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-C28');
  const before = CR.derive(c).coverage;
  CR.setKmDecision(c,{kind:'Решение КМ',num:'КМ-28',date:'01.07.2026',scan:'km.pdf',coverPct:80});
  const after = CR.derive(c).coverage;
  ok('57c', before.liqApplies===true && before.ok===false
      && after.liqApplies===false && after.liqOk===true && after.ok===true,
     `состав: liq=${before.liqApplies}/ok=${before.ok} → КМ80: liq=${after.liqApplies}/ok=${after.ok}`);
})();

/* ============================================================
   ЭТАП 4 · ШОВ ПЛАТЕЖЕЙ (КР-44…КР-52). Тот же класс проверок, что дал КР-38/КР-39:
   не «зеркало приехало и разложилось», а «поведение кредита совпало с правилом
   владельца». Правило зачёта, спорная пеня, слои решения суда, переплата, валюта.
   ============================================================ */

/* 58. ЗАЧЁТ ЧИТАЕТ ДВЕ ОСИ (КР-44). Ожидающий подтверждения платёж двигает остаток,
   если пришёл через ШЛЮЗ (деньги ушли, §4 спеки платежей), и не двигает, если введён
   вручную (основание ручному вводу — список ЦК, до сверки денег могло не быть). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const gw  = c.mirror.payments.find(p => p.reg==='Шлюз' && p.match==='Ожидает ЦК');
  const man = c.mirror.payments.find(p => p.reg==='Ручной ввод' && p.match==='Ожидает ЦК');
  const gwCounts = CR.paymentCounts(gw), manCounts = CR.paymentCounts(man);
  const withGw = CR.derive(c).debt.principal.bal;
  gw.reg = 'Ручной ввод';                                   // ТОТ ЖЕ статус, другой канал
  const asManual = CR.derive(c).debt.principal.bal;
  ok(58, gwCounts===true && manCounts===false
      && Math.abs((asManual - withGw) - gw.layers.principal) < 0.01,
     `шлюзом остаток=${withGw}, тем же статусом вручную=${asManual} (разница ${Math.round(asManual-withGw)} = ОД платежа ${gw.layers.principal})`);
})();
/* 58b. Восстановленный платёж (позднее подтверждение ЦК) двигает остаток, сторнированный
   не двигает, но ОСТАЁТСЯ ВИДЕН: сторно ≠ удаление. */
(() => { const db = CR.seedDb();
  const restored = db.credits.find(c => (c.mirror.payments||[]).some(p => p.match==='Восстановлен'));
  const storno   = db.credits.find(c => (c.mirror.payments||[]).some(p => p.match==='Сторно (таймаут)'));
  const pR = restored.mirror.payments.find(p => p.match==='Восстановлен');
  const pS = storno.mirror.payments.find(p => p.match==='Сторно (таймаут)');
  const paidR  = CR.derive(restored).debt.principal.paid;
  const before = CR.derive(storno).ledger.pool.principal;
  const shown  = storno.mirror.payments.length;             // сторно ≠ удаление
  pS.match = 'Подтверждён ЦК';                              // ЕСЛИ БЫ подтвердили
  const after = CR.derive(storno).ledger.pool.principal;
  ok('58b', CR.paymentCounts(pR)===true && CR.paymentCounts(pS)===true
      && paidR === pR.layers.principal
      && Math.abs((after - before) - pS.layers.principal) < 0.01
      && shown === storno.mirror.payments.length,
     `восстановлен: погашено ОД=${paidR} · сторно вне пула: ${before} → ${after} при подтверждении (+${pS.layers.principal}), из зеркала не исчез`);
})();
/* 59. СПОРНАЯ ПЕНЯ (КР-46). Пеня периода сторно ВЫЧИСЛЕНА, но в требование не входит и
   категорию не двигает: снятие статуса «ждёт комиссии» возвращает и то и другое. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d1 = CR.derive(c);
  const p = c.mirror.payments.find(x => x.dispute);
  p.dispute.status = 'Решение комиссии'; p.dispute.outcome = 'начислить';
  const d2 = CR.derive(c);
  ok(59, d1.debt.penalty.disputed > 0 && d1.debt.penalty.accrued === 0
      && d1.overdue.disputedDays === d1.overdue.days && d1.riskBasis.eff === 0
      && d2.debt.penalty.disputed === 0 && d2.debt.penalty.accrued > 0
      && d2.riskBasis.eff === d2.overdue.days,
     `спорно: пеня=${d1.debt.penalty.disputed} требуется=${d1.debt.penalty.accrued} дней=${d1.riskBasis.eff}` +
     ` → решено: требуется=${d2.debt.penalty.accrued} дней=${d2.riskBasis.eff}`);
})();
/* 59b. Спорная пеня не входит в ТРЕБОВАНИЕ (§4.4), а значит и в вход гейта «Погашен»:
   она посчитана в расчёте, но остаток статьи по ней нулевой, и Г-14 её не называет. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c);
  const rawPen = d.ledger.rows.reduce((a,r) => a + r.penaltyAccrued, 0);
  const g = CR.gate(c, 'repay', {});
  ok('59b', rawPen > 0 && d.debt.penalty.disputed > 0
      && d.debt.penalty.bal === 0 && d.debt.penalty.overdue === 0
      && !g.reasons.some(r => /Пеня/.test(r)),
     `пеня посчитана=${Math.round(rawPen*100)/100}, спорна=${d.debt.penalty.disputed}, в требовании=${d.debt.penalty.bal}; Г-14 её не называет`);
})();
/* 60. СЛОЙ РЕШЕНИЯ СУДА (КР-47). Решение с присуждённой суммой останавливает начисление
   НА СВОЮ ДОЛЮ; режим определяется датой решения и прилипает к нему. Решение без суммы
   (определение о банкротстве) слоя не образует. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const d = CR.derive(c);
  const L = d.courtLayers[0];
  const bankrot = db.credits.find(x => (x.mirror.court||[]).some(y => /банкрот/i.test(y.kind)));
  const db2 = CR.derive(bankrot);
  ok(60, d.courtLayers.length===1 && L.amount===18300 && L.mode.interest===false && L.mode.penalty===false
      && d.debt.interest.frozen > 0 && d.debt.penalty.frozen > 0
      && db2.courtLayers.length===0 && db2.debt.interest.frozen===0,
     `K-3: слой ${L.amount} → % приостановлено ${d.debt.interest.frozen}, пеня ${d.debt.penalty.frozen}` +
     ` · банкротство: слоёв=${db2.courtLayers.length}`);
})();
/* 60b. Режим — ТАБЛИЦА с датами вступления, а не константа: решение до 05.09.2025
   оставляет проценты идущими, с 05.09.2025 — останавливает оба начисления. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const late = CR.accrualModeOf('28.05.2026'), early = CR.accrualModeOf('01.03.2025');
  c.mirror.court[0].date = '01.03.2025';                    // то же решение по старой норме
  const d = CR.derive(c);
  ok('60b', late.interest===false && late.penalty===false
      && early.interest===true && early.penalty===false
      && d.courtLayers[0].mode.interest===true && d.debt.interest.frozen===0 && d.debt.penalty.frozen>0,
     `с 05.09.2025: %=${late.interest}/пеня=${late.penalty} · до: %=${early.interest}/пеня=${early.penalty}` +
     ` · по старой норме приостановлено %=${d.debt.interest.frozen}`);
})();
/* 61. ПЕРЕПЛАТА не съедается срезом (КР-48): излишек над начисленным виден статьёй.
   К-6 — единственный случай в наборе: разнесено 12 000 процентов при начисленных 10 254,61. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-6');
  const d = CR.derive(c);
  const over = db.credits.filter(x => CR.derive(x).overpay.total > 0.005).map(x => x.id);
  ok(61, d.overpay.interest > 0 && d.debt.interest.bal === 0
      && Math.abs(d.overpay.interest - (d.ledger.pool.interest - d.debt.interest.accrued)) < 0.01
      && over.length === 1,
     `К-6 переплата %=${d.overpay.interest} (пул ${d.ledger.pool.interest} − начислено ${d.debt.interest.accrued}) · всего кредитов с переплатой ${over.length}`);
})();
/* 62. ВАЛЮТА ПОСТУПЛЕНИЯ — реквизит платежа, разнесение всегда в валюте кредита (И-16):
   Σ layers = amount при совпадении валют и amount / rate при расхождении. */
(() => { const db = CR.seedDb();
  const bad = [];
  for (const c of db.credits) for (const p of (c.mirror.payments||[])){
    const alloc = CR.paymentAllocated(p); if (!alloc) continue;
    const cur = CR.paymentCurrency(p, c);
    const expect = (cur === (c.currency||'KGS')) ? (p.amount||0) : (p.amount||0) / (p.rate||1);
    if (Math.abs(alloc - expect) > 0.5) bad.push(c.id + '#' + p.num);
  }
  const fx = db.credits.find(c => (c.mirror.payments||[]).some(p => p.currency && p.currency !== c.currency));
  const pfx = fx && fx.mirror.payments.find(p => p.currency && p.currency !== fx.currency);
  ok(62, bad.length === 0 && !!pfx && pfx.rate > 0,
     `нарушителей=${bad.length} · валютный случай: ${fx&&fx.id} ${pfx&&pfx.amount} ${pfx&&pfx.currency} @ ${pfx&&pfx.rate} → ${pfx&&CR.paymentAllocated(pfx)} ${fx&&fx.currency}`);
})();
/* 63. РАСЧЁТ ДАЛЬШЕ СНИМКА подписан как предварительный (КР-51): начисленное кредит
   выводит на любую дату, погашенное знает только до снимка зеркала. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c);
  const noSnap = byId(db,'K-5');                            // зеркала платежей нет вовсе
  const dn = CR.derive(noSnap);
  ok(63, d.calcProvisional === true && d.paymentsAsOf === '22.07.2026'
      && d.ledger.until === CR.TODAY && dn.calcProvisional === false,
     `К-1: снимок ${d.paymentsAsOf}, расчёт до ${d.ledger.until} → предварительный=${d.calcProvisional}`);
})();

/* 64. payDay (Шаг 18, Q1): день платежа берётся из условия, а не из даты освоения. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-PAYDAY', date:CR.TODAY, ref:'ДС-PAYDAY', label:'ДС-PAYDAY' },
    records:[{ param:'payDay', value:15, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  const rows = CR.buildSchedule(t, t.disbursements[0].date).rows.slice(0,2).map(r => r.date);
  ok(64, rows.every(d => d.startsWith('15.')), `payDay=15 → ${rows.join(' · ')}`);
})();

/* 65. lastPaymentAnchor (Шаг 18, Q2): «по дате 1-го платежа» считает от даты 1-го
   платежа, а не от даты выдачи — формула программы (renderTab6, R19): «по 1-му
   платежу» → EDATE(1-й,(n−1)×f), «по дате выдачи» → EDATE(выдача,n×f). Освоение
   31.01.2026: 1-й платёж клэмпится в феврале на 28-е и оттуда СТЕКАЕТ (компаундится
   от уже урезанного дня); «по дате выдачи» день каждый раз берётся заново от 31. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const rows1 = CR.buildSchedule(t, '31.01.2026').rows.slice(0,2).map(r => r.date);
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-ANCHOR', date:CR.TODAY, ref:'ДС-ANCHOR', label:'ДС-ANCHOR' },
    records:[{ param:'lastPaymentAnchor', value:'по дате 1-го платежа', effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  const rows2 = CR.buildSchedule(t, '31.01.2026').rows.slice(0,2).map(r => r.date);
  ok(65, rows1[1] === '31.03.2026' && rows2[1] === '28.03.2026',
     `по дате выдачи: ${rows1.join(' · ')} · по дате 1-го платежа: ${rows2.join(' · ')}`);
})();

/* 66. graceIntDistFrom/To (Шаг 18, Q5): вне окна отложенные % копятся, не гасятся;
   внутри окна — распределяются. По умолчанию (0/0) поведение не меняется (проверено
   существующим #47 — там окно не задавалось). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const set = (param, value) => CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-'+param, date:CR.TODAY, ref:'ДС-'+param, label:'ДС-'+param },
    records:[{ param, value, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  set('graceInterest', 3); set('graceIntDistFrom', 10); set('graceIntDistTo', 12);
  const rows = CR.buildSchedule(t, t.disbursements[0].date).rows;
  const gap = rows[5], win = rows[9];                    // период 6 (вне окна) и период 10 (в окне)
  ok(66, gap.interest === gap.accrued && win.interest > win.accrued,
     `вне окна: начисл=${gap.accrued} платёж=${gap.interest} · в окне: начисл=${win.accrued} платёж=${win.interest}`);
})();

/* 67. Метод дней (Шаг 19/20, PARAMS.dayMethod): раньше хранился, но не читался —
   % графика считались чисто помесячно (rate/12), без единого дня. Теперь числитель
   'факт' берёт РЕАЛЬНЫЕ календарные дни периода (у соседних месяцев их разное число),
   а '30' — финансовый месяц (фикс. 30 дней), календарь игнорирует. graceMain на весь
   срок держит остаток (bal) постоянным по всем периодам кроме последнего — так
   разница в начислении видна именно от числителя, а не от убывающего тела долга.
   Шаг 20: dayMethod в PARAMS — меняется записью условия, как rate/term. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const set = (param, value) => CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-'+param, date:CR.TODAY, ref:'ДС-'+param, label:'ДС-'+param },
    records:[{ param, value, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  set('graceMain', 999);
  const from = t.disbursements[0].date;
  const rf = CR.buildSchedule(t, from).rows;                  // dayMethod дефолт факт/365 — числитель = дни
  set('dayMethod', '30/365');
  const rn = CR.buildSchedule(t, from).rows;                  // числитель = финансовый месяц (фикс. 30)
  ok(67, rf[0].accrued !== rf[1].accrued && rn[0].accrued === rn[1].accrued,
     `факт: п1=${rf[0].accrued} п2=${rf[1].accrued} (разные дни) · 30-числ: п1=${rn[0].accrued} п2=${rn[1].accrued} (равны)`);
})();

/* ============================================================
   БЛОК 3 · СЛОЙ РЕНДЕРА (КР-23). Смоук жил в песочнице без DOM и дёргал только
   чистые функции — поэтому ВСЕ дефекты групп A и B (мёртвые кнопки, экран,
   противоречащий сам себе, пустые гриды) пережили 16 шагов слияния. Здесь
   поднимается минимальный DOM, и каждая вкладка каждого кредита реально строится.
   ============================================================ */
(() => {
  const stub = () => ({ innerHTML:'', textContent:'', value:'', style:{}, checked:false, disabled:false,
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelectorAll:()=>[], appendChild(){}, remove(){}, scrollIntoView(){}, addEventListener(){} });
  const doc = { getElementById:()=>stub(), querySelectorAll:()=>[], querySelector:()=>stub(),
    createElement:()=>stub(), addEventListener(){}, body:stub() };
  /* Роутинг по location.hash (openFromHash, вызывается на верхнем уровне скрипта) —
     песочница раньше не давала ни location, ни history, и vm.runInContext падал
     ДО того, как sb2.window.CR успевал появиться: #53/#54/#55 не выполнялись вовсе. */
  const sb2 = { document: doc, console, setTimeout:()=>{}, clearTimeout:()=>{},
    location: { hash:'', pathname:'/', search:'' },
    history: { replaceState(){} } };
  vm.createContext(sb2);
  /* в браузере `window.CR = {...}` создаёт и глобальный CR; в vm — нет, зеркалим */
  sb2.window = new Proxy({ addEventListener(){} }, { set(t,k,v){ t[k]=v; sb2[k]=v; return true; },
                               get(t,k){ return t[k]; }, has(){ return true; } });
  let CR2;
  try { vm.runInContext(m[1], sb2, { filename:'credit.dom.js' }); CR2 = sb2.window.CR; }
  catch(e){ return ok(53, false, 'скрипт с DOM не исполнился: ' + e.message); }

  /* список дублирует DTABS макета вручную и уже разошёлся с ним один раз: девятую
     вкладку («План и исполнение») в волне 01.08.2026 сюда не добавили, и она не
     попадала под проверку рендера вовсе. Поэтому ниже — не только рендер, но и сверка
     состава: ожидаемый список против DTABS макета, чтобы расхождение падало тестом. */
  const TABS = ['Договор','Условия','Транши','График','Прогноз','Расчёты','Платежи','План','Обеспечение','Проблемные','Досье'];
  const dtabs = (()=>{ const mm = readFileSync(HTML,'utf8').match(/const DTABS\s*=\s*\[([^\]]*)\]/);
    return mm ? mm[1].split(',').map(s=>s.trim().replace(/^'|'$/g,'')) : null; })();
  ok('53a', dtabs && dtabs.join('|') === TABS.join('|'),
     dtabs ? `DTABS=${dtabs.length}: ${dtabs.join(' · ')}` : 'DTABS не найден в исходнике');
  const bad = [];
  for (const c of CR2.db.credits) for (const t of TABS){
    let html;
    try { html = CR2.renderTab(t, c); }
    catch(e){ bad.push(`${c.id}/${t}: ${e.message}`); continue; }
    if (typeof html !== 'string' || html.length < 50) bad.push(`${c.id}/${t}: пусто`);
    else if (/undefined|\[object Object\]|NaN/.test(html)) bad.push(`${c.id}/${t}: мусор в разметке`);
    /* ADR-0060 §4: очередь публикуется на «Платежах» и обязана быть на КАЖДОМ кредите —
       у кредита без графика она пуста, но секция с подписью «непогашенного нет» стоит */
    else if (t === 'Платежи' && !/Очередь погашения/.test(html))
      bad.push(`${c.id}/${t}: секции очереди нет`);
  }
  ok(53, bad.length === 0, `вкладок=${CR2.db.credits.length * TABS.length} проблем=${bad.length} ${bad.slice(0,3).join(' | ')}`);

  /* 111. ГРУППЫ КАРАНДАШЕЙ вкладки «Условия» (волна 11.08.2026, КВ-25). Ленты с общей
     кнопкой «Изменить условия» больше нет — единственный вход в модалку идёт через
     карандаш карточки, поэтому ключ, не попавший ни в одну группу, становится
     нередактируемым молча. Тест держит разбиение полным и непересекающимся. */
  const gR = CR2.COND_CARD_RATES, gP = CR2.COND_CARD_REPAY;
  const both = (gR||[]).filter(k => (gP||[]).includes(k));
  const union = [...(gR||[]), ...(gP||[])].sort().join('|');
  ok(111, Array.isArray(gR) && Array.isArray(gP) && both.length === 0
          && union === [...CR2.PARAM_KEYS].sort().join('|'),
     `RATES=${(gR||[]).length} REPAY=${(gP||[]).length} пересечение=${both.length}`
     + ` покрытие ${union === [...CR2.PARAM_KEYS].sort().join('|') ? 'полное' : 'НЕПОЛНОЕ'}`);

  /* 112. КАРАНДАШИ ВКЛАДКИ «УСЛОВИЯ» (КВ-25). Лента .gtoolbar с единственной кнопкой
     «Изменить условия» удалена, вход — карандаш в заголовке каждой из двух карточек.
     Проверяем три состояния: при «Действует» карандаша ровно два и они кликабельны;
     при «Проект» они на месте, но погашены и объясняют Г-22 (§0.3 — не молчаливый
     отказ, карандаш не имеет права исчезнуть); при «Закрыт» — то же с terminalReason. */
  const condHtml = (id) => CR2.renderTab('Условия', CR2.db.credits.find(c => c.id === id));
  const act = condHtml('K-1'), proj = condHtml('K-C26'), clos = condHtml('K-6');
  const nCalls = (h) => (h.match(/CR\.openCondModal\(/g) || []).length;
  ok(112, nCalls(act) === 2
          && /openCondModal\('rates'\)/.test(act) && /openCondModal\('repay'\)/.test(act)
          && !/>Изменить условия</.test(act)
          && nCalls(proj) === 0 && (proj.match(/Г-22/g) || []).length === 4
          && nCalls(clos) === 0 && (clos.match(/терминальном состоянии/g) || []).length >= 4,
     `Действует=${nCalls(act)} Проект=${nCalls(proj)}/Г-22×${(proj.match(/Г-22/g)||[]).length}`
     + ` Закрыт=${nCalls(clos)}`);

  /* 100. ГРУППИРОВКА ПО ГОДАМ на «Графике» (волна 10.08.2026, КВ-19). Строка года стоит
     перед первой позицией своего года, годы идут по возрастанию, итоги (ОД · проценты ·
     к погашению) равны суммам позиций ЭТОГО года и стоят ПОД СВОИМИ колонками — то есть
     строка года имеет ровно 6 ячеек, а не одну на всю ширину. Развёрнут по умолчанию
     ТОЛЬКО текущий год: позиций в разметке ровно столько, сколько их в этом году, а
     итоги свёрнутых лет всё равно посчитаны по ВСЕМ позициям года. Однолетний график
     строк года не получает вовсе и показывает все позиции.
     Сверяется РЕНДЕР против чистой функции: разойдись подсчёт года с trancheScheduleRows
     — годовая нагрузка врала бы молча, а вкладка выглядела бы исправной. */
  const gbad = [];
  const m2 = (x) => CR2.money(Math.round((x + Number.EPSILON) * 100) / 100);
  for (const c of CR2.db.credits){
    const sel = c.tranches.length === 1 ? c.tranches[0] : null;   // cardScope по умолчанию — «по кредиту»
    const rows = (sel ? [sel] : c.tranches).flatMap(t => CR2.trancheScheduleRows(t));
    const exp = new Map();
    for (const r of rows){ const y = CR2.pd(r.date).getFullYear();
      const g = exp.get(y) || { n:0, principal:0, interest:0, total:0 };
      g.n++; g.principal += r.principal||0; g.interest += r.interest||0; g.total += r.total||0; exp.set(y, g); }
    const ysAll = [...exp.keys()];
    const cur = CR2.pd(CR2.TODAY).getFullYear();
    const defY = exp.has(cur) ? cur : (ysAll.find(y => y > cur) ?? ysAll[ysAll.length-1]);
    const html = CR2.renderTab('График', c);
    const heads = [...html.matchAll(/<tr class="gyear(?: open)?"[\s\S]*?<span class="gy">(\d{4})<\/span>([\s\S]*?)<\/tr>/g)]
      .map(x => ({ y:+x[1], tds:(x[2].match(/<td/g)||[]).length + 1,
                   sums:[...x[2].matchAll(/<b>([^<]+)<\/b>/g)].map(v => v[1]) }));
    const posN = (html.match(/<tr><td>№/g) || []).length;
    if (ysAll.length < 2){
      if (heads.length) gbad.push(`${c.id}: лет ${ysAll.length}, а строк года ${heads.length}`);
      else if (posN !== rows.length) gbad.push(`${c.id}: позиций ${posN} vs ${rows.length}`);
      continue;
    }
    if (heads.length !== ysAll.length){ gbad.push(`${c.id}: строк года ${heads.length} vs лет ${ysAll.length}`); continue; }
    const ys = heads.map(h => h.y);
    if (ys.some((y,i) => i && y <= ys[i-1])) gbad.push(`${c.id}: годы не по возрастанию: ${ys.join(',')}`);
    if (posN !== exp.get(defY).n) gbad.push(`${c.id}: развёрнут ${defY}: позиций ${posN} vs ${exp.get(defY).n}`);
    for (const h of heads){
      const g = exp.get(h.y);
      if (h.tds !== 6) gbad.push(`${c.id}/${h.y}: ячеек в строке года ${h.tds}, а не 6 (итоги не под колонками)`);
      const want = [m2(g.principal), m2(g.interest), m2(g.total)];
      if (h.sums.join('|') !== want.join('|')) gbad.push(`${c.id}/${h.y}: итоги «${h.sums.join('|')}» vs «${want.join('|')}»`);
    }
  }
  ok(100, gbad.length === 0,
     `кредитов=${CR2.db.credits.length} расхождений=${gbad.length} ${gbad.slice(0,3).join(' | ')}`);

  /* 54. Каждая модалка открывается без исключения — включая оживлённые этой волной.
     Мёртвая кнопка (действие, которого нет в матрице ролей) здесь и ловится. */
  const MODALS = ['openTrancheModal','openDisbModal','openSchedModal','openCondModal','openPaymentModal',
    'openKmModal','openWaiverModal','openWriteOffModal','openRepayModal','openPledgePicker',
    'openContractAmountModal','openHoldModal','openRegisterModal','openActivateModal','openCloseDisbModal',
    'openCloseTrancheModal','openTransferModal','openNoteModal','openTargetUseModal','openTerminateModal',
    'openPlanModal'];
  const missing = MODALS.filter(f => typeof CR2[f] !== 'function');
  const errs = [];
  CR2.state = CR2.state || {};
  doc.getElementById = (id) => id === 'roleSel' ? Object.assign(stub(), { value:'Начальник отдела' }) : stub();
  CR2.onRoleChange();
  for (const id of ['K-1','K-3','K-5','K-6']){ CR2.openDetail(id);
    for (const f of MODALS){ if (missing.includes(f)) continue;
      try { CR2[f](); } catch(e){ errs.push(`${id}/${f}: ${e.message}`); } } }
  ok(54, missing.length === 0 && errs.length === 0,
     `нет функции=${missing.join(',')||'—'} исключений=${errs.length} ${errs.slice(0,2).join(' | ')}`);

  /* 55. Каждое действие, которое спрашивает кнопка, ЕСТЬ в матрице ролей. Кнопка
     «+ Примечание» вызывала roleBtn('addNote'), а действия addNote в ROLE_ACTIONS не
     было вовсе — она была мертва под всеми ролями, включая «Начальника отдела» (КР-2). */
  const src = readFileSync(HTML, 'utf8');
  const asked = [...src.matchAll(/(?:roleBtn|actBtn)\(\s*(?:c\s*,\s*)?'([a-zA-Z]+)'/g)].map(x => x[1]);
  const known = new Set(Object.values(CR2.ROLE_ACTIONS || {}).flatMap(s => [...s]));
  const orphans = [...new Set(asked)].filter(a => !known.has(a));
  ok(55, orphans.length === 0, `действий у кнопок=${new Set(asked).size} без роли=${orphans.join(',')||'—'}`);
})();

/* ---- ПЛАН · ПРОГНОЗ · ИСПОЛНЕНИЕ (ADR-0042) ---- */

/* 80. И-18: план не двигает НИ ОДНУ производную долга. Ключевая проверка изоляции —
   без неё план рано или поздно просочится в категорию риска. */
(() => { const a = CR.seedDb(), b = CR.seedDb();
  const c1 = byId(a,'K-1'), c2 = byId(b,'K-1');
  c2.plan = [];                                                     // тот же кредит, но без плана
  const d1 = CR.derive(c1), d2 = CR.derive(c2);
  const same = d1.debtBalance === d2.debtBalance && d1.riskCategory === d2.riskCategory
    && d1.overdueDays === d2.overdueDays && d1.coverage.index === d2.coverage.index
    && d1.overdueAmount === d2.overdueAmount;
  ok(80, same, `долг ${d1.debtBalance}/${d2.debtBalance} кат ${d1.riskCategory}/${d2.riskCategory}`);
})();

/* 81. Месяц без плана выпадает ЦЕЛИКОМ: из своей строки, из квартала, из года.
   Сид правился ПОСЛЕ брифа задачи (Г-30 не пускал план раньше месяца договора K-1) —
   «месяца без плана» у K-1 теперь 2026-09 (строки в c.plan нет вовсе), а не июнь
   (июнь — обычная строка с правкой в history, план стоит). 2026-08 — другой случай:
   план СНЯТ (строка есть, amount:null). Оба выпадают из расчёта (dropped=true), но
   различаются флагом removed — он true только там, где строка была и осталась. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const pe = CR.planExecOf(c, '23.07.2026', null, 2026);
  const sep = pe.rows.find(r => r.month === '2026-09');   // строки в c.plan нет вовсе
  const aug = pe.rows.find(r => r.month === '2026-08');   // строка есть, план снят
  const q3  = pe.quarters.find(q => q.q === 3);
  const sumQ3Plans = ['2026-07','2026-08','2026-09']
    .map(mk => CR.planAmountOf(c, mk) || 0).reduce((a,x) => a + x, 0);
  ok(81, sep.dropped === true && sep.plan === null && sep.removed === false
      && aug.removed === true && aug.dropped === true
      && q3.plan === sumQ3Plans && pe.total.monthsWithPlan === 5,
     `сен(нет строки)=${sep.dropped} авг(снят)=${aug.removed} Q3=${q3.plan} vs ${sumQ3Plans} мес=${pe.total.monthsWithPlan}`);
})();

/* Внести ЗАСЧИТЫВАЕМЫЙ платёж. CR.addPayment для этого не годится: он заводит платёж
   ручного ввода со статусом «Ожидает ЦК» и пустым layers — такой по двум осям (Р-27)
   остаток не двигает, то есть ни прогноза, ни факта исполнения не меняет. */
const seedPay = (c, date, principal) => { c.mirror.payments.push({
  num:(c.mirror.payments.length || 0) + 1, date, bindDate:date, amount:principal,
  currency:c.currency || 'KGS', rate:null, tranche:c.tranches[0].no,
  reg:'Импорт ЦК', match:'Подтверждён ЦК', frozen:false, dispute:null,
  method:'денежными средствами',
  layers:{ principal, interest:0, penalty:0, fees:0 } }); };

/* 82. КЛЮЧЕВАЯ ПРОВЕРКА ADR-0042: сохранённый план НЕ движется, когда движется прогноз.
   Месяц плана взят с РЕАЛЬНЫМ планом (2026-10, 28000) — иначе сравнение null===null
   (у 2026-09, где плана нет) ничего бы не доказывало.
   Месяц прогноза — ПОЗДНИЙ (2027-10): по ADR-0104 досрочка не трогает ближние взносы,
   она СОКРАЩАЕТ СРОК, и меняется хвост расписания, а не его начало. Прежняя редакция
   смотрела на 2026-10 и после смены модели перестала что-либо ловить: там прогноз
   обязан совпадать с графиком, и совпадение читалось как «прогноз мёртв». */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const mkPlan = '2026-10', mkLate = '2027-10';
  const planBefore = CR.planAmountOf(c, mkPlan);
  const fcBefore = CR.forecastByMonth(c, CR.derive(c).ledger.index, '23.07.2026').get(mkLate);
  seedPay(c, '20.07.2026', 40000);
  const fcAfter = CR.forecastByMonth(c, CR.derive(c).ledger.index, '23.07.2026').get(mkLate);
  const planAfter = CR.planAmountOf(c, mkPlan);
  ok(82, planBefore === planAfter && fcBefore > 0 && fcAfter === undefined,
     `план ${planBefore}→${planAfter} прогноз ${mkLate}: ${fcBefore}→${fcAfter}`);
})();

/* 83. ДОСРОЧКА СОКРАЩАЕТ СРОК И УДЕШЕВЛЯЕТ ОБСЛУЖИВАНИЕ, НО ГРАФИК НЕ ПЕРЕСОБИРАЕТ
   (ADR-0074 §1 + ADR-0108). Пересборка аннуитета — сделка «уменьшить взнос», её отдал
   заявлению заёмщика ADR-0074 §2, и отличается она ровно телом позиции: у пересборки оно
   другое, у прогноза — контрактное. Взнос при этом дешевеет сам, потому что процентов
   меньше на уменьшенной базе, а хвост позиций гаснет и закрытие уезжает раньше. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  seedPay(c, '20.07.2026', 40000);
  const t = c.tranches[0]; const idx = CR.derive(c).ledger.index;
  const fr  = CR.trancheForecastRows(c, t, idx, '23.07.2026');
  const sch = CR.trancheScheduleRows(t);
  const fut = fr.filter(r => !r.past);
  const live = fut.filter(r => r.forecast > 0.005);
  const sm  = CR.forecastSummary(c, [t], idx, '23.07.2026');
  const mid = live.slice(0, -1);
  const bodyHeld = mid.every(r => Math.abs(r.principal
    - ((sch.find(x => x.no === r.no) || {}).principal || 0)) < 0.05);        // тело контрактное
  const cheaper  = mid.every(r => r.delta < 0.05) && mid.some(r => r.delta < -0.05);
  const cutTail  = fut.length > live.length && fut.slice(live.length).every(r => r.forecast === 0);
  ok(83, fut.length > 0 && bodyHeld && cheaper && cutTail && pd(sm.payoff) < pd(sm.contractEnd),
     `будущих=${fut.length} с ожиданием=${live.length} тело контрактное=${bodyHeld}`
     + ` взнос дешевеет=${cheaper} закрытие ${sm.payoff} против договорного ${sm.contractEnd}`);
})();

/* 84. Σ прогноза по будущим позициям = амортизируемая база + будущие проценты, и НИЧЕГО
   сверх того. База = освоено − погашенное платежами тело − просроченное тело: последнее
   будущими взносами не гасится и в Σ входить не должно. Непокрытый хвост прошлого сюда
   тоже не входит — он остаётся в своих позициях (ADR-0104); прежняя редакция включала
   его в ожидаемое равенство, потому что прогноз сваливал хвост в первую будущую строку. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');            // есть и непокрытое прошлое, и будущее
  const d = CR.derive(c); const t = c.tranches[0];
  const fr = CR.trancheForecastRows(c, t, d.ledger.index, '23.07.2026');
  const fut = fr.filter(r => !r.past), past = fr.filter(r => r.past);
  const sumFut = fut.reduce((a,r) => a + r.forecast, 0);
  const sumInt = fut.reduce((a,r) => a + (r.interest || 0), 0);
  const tail   = past.reduce((a,r) => a + r.forecast, 0);
  const led    = [...d.ledger.index.values()].filter(e => e.trancheNo === t.no);
  const overdueP = led.reduce((a,e) => a + (e.principalOverdue || 0), 0);
  const disb  = (t.disbursements||[]).reduce((a,x)=>a+(x.amount||0),0);
  const base  = Math.max(0, disb - CR.paidPrincipalOfTranche(c, t, '23.07.2026') - overdueP);
  ok(84, fut.length > 0 && tail > 0.005 && Math.abs(sumFut - (base + sumInt)) < 0.05,
     `Σбудущего=${sumFut.toFixed(2)} vs база ${base.toFixed(2)} + %% ${sumInt.toFixed(2)}`
     + ` = ${(base+sumInt).toFixed(2)}; хвост ${tail.toFixed(2)} снаружи`);
})();

/* 85. Г-30: план не ставится на кредит в «Проекте» и на закрытый; отказ называет причину. */
(() => { const db = CR.seedDb();
  const proj = db.credits.find(c => c.lifecycle === 'Проект');
  const closed = db.credits.find(c => c.lifecycle === 'Закрыт' || c.closure);
  const g1 = proj ? CR.gate(proj, 'setPlan', { rows:[{ month:'2026-09', amount:1000 }] }) : { ok:false, reasons:['нет кредита в «Проекте»'] };
  const g2 = closed ? CR.gate(closed, 'setPlan', { rows:[{ month:'2026-09', amount:1000 }] }) : { ok:false, reasons:['нет закрытого кредита'] };
  const named = g1.reasons.some(r => /ЖЦ/.test(r));
  ok(85, g1.ok === false && g2.ok === false && named, `проект=${g1.ok} закрытый=${g2.ok} причина="${g1.reasons[0]||''}"`);
})();

/* 86. Г-30: ноль и месяц раньше договора отбиваются, снятие (amount:null) проходит. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const zero = CR.gate(c, 'setPlan', { rows:[{ month:'2026-09', amount:0 }] });
  const early = CR.gate(c, 'setPlan', { rows:[{ month:'2000-01', amount:1000 }] });
  const drop  = CR.gate(c, 'setPlan', { rows:[{ month:'2026-09', amount:null }] });
  ok(86, zero.ok === false && early.ok === false && drop.ok === true,
     `ноль=${zero.ok} рано=${early.ok} снятие=${drop.ok}`);
})();

/* 87. Правка кладёт прежнее значение в history, а seededFrom НЕ двигается: он — снимок
   прогноза на момент заведения, а не текущее его значение (ADR-0042 §2). Месяц с
   СУЩЕСТВУЮЩЕЙ строкой — 2026-10 (план несут 05/06/07/10/11; 08 снят, 09 без строки). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const mk = '2026-10';
  const before = CR.planRowOf(c, mk);
  const seed0 = before.seededFrom, amt0 = before.amount, hist0 = before.history.length;
  const r = CR.setPlan(c, { rows:[{ month:mk, amount:99000, seededFrom:12345 }], note:'тест' });
  const after = CR.planRowOf(c, mk);
  const h = after.history[after.history.length - 1];
  ok(87, r.ok && after.amount === 99000 && after.seededFrom === seed0
      && after.history.length === hist0 + 1 && h.prev === amt0,
     `сумма=${after.amount} seed=${after.seededFrom}/${seed0} правок=${after.history.length} prev=${h && h.prev}`);
})();

/* 88. Снятие плана — не удаление (И-14): строка остаётся, прежнее значение в history,
   месяц выпадает из расчёта исполнения. Тот же 2026-10, что и в #87 — у него есть
   строка, которую есть что снимать. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const mk = '2026-10'; const n0 = c.plan.length;
  CR.setPlan(c, { rows:[{ month:mk, amount:null }], note:'снят' });
  const row = CR.planRowOf(c, mk);
  const pe = CR.planExecOf(c, '23.07.2026', null, 2026);
  const sep = pe.rows.find(x => x.month === mk);
  ok(88, c.plan.length === n0 && !!row && row.amount === null
      && row.history[row.history.length - 1].prev != null && sep.dropped === true && sep.removed === true,
     `строк=${c.plan.length}/${n0} amount=${row && row.amount} dropped=${sep.dropped}`);
})();

/* 88b. Исполнение считается на ВСЕХ демо-кредитах без исключений — включая кредиты без
   плана, без графика и закрытые. Рендер вкладки опирается ровно на эту функцию. */
(() => { const db = CR.seedDb(); const errs = [];
  for (const c of db.credits){
    try { const pe = CR.planExecOf(c, '23.07.2026');
      if (!pe || pe.rows.length !== 12 || pe.quarters.length !== 4) errs.push(c.id + ': форма результата');
    } catch(e){ errs.push(c.id + ': ' + e.message); }
  }
  ok('88b', errs.length === 0, `кредитов=${db.credits.length} ошибок=${errs.length} ${errs.slice(0,2).join(' | ')}`);
})();

/* 89. monthAdd/monthRange — служебная арифметика месяцев без Date. Отрицательный шаг
   обязан корректно переносить год назад, а диапазон «конец раньше начала» — не крутить
   цикл до предохранителя (240), а сразу вернуть пусто. */
(() => { const back = CR.monthAdd('2026-01', -2);
  const empty = CR.monthRange('2026-05', '2026-01');
  ok(89, back === '2025-11' && Array.isArray(empty) && empty.length === 0,
     `2026-01 −2мес=${back} range(май→янв)=[${empty.join(',')}]`);
})();

/* 90. Г-30 обязан отбивать месяц, у которого формат ФОРМАЛЬНО верен ('YYYY-MM'), но
   значение бессмысленно — месяца 13 и 00 не существует. Проверка формы регуляркой
   '\d{4}-\d{2}' такое пропускает молча; гейт должен проверять диапазон 01–12. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const g13 = CR.gate(c, 'setPlan', { rows:[{ month:'2026-13', amount:1000 }] });
  const g00 = CR.gate(c, 'setPlan', { rows:[{ month:'2026-00', amount:1000 }] });
  ok(90, g13.ok === false && g00.ok === false,
     `13=${g13.ok} "${g13.reasons[0]||''}" · 00=${g00.ok} "${g00.reasons[0]||''}"`);
})();

/* 91. planExecOf не падает на кредите без единого транша (а значит и без единой позиции
   прогноза) — форма результата (12 строк, 4 квартала) держится и на пустом входе:
   именно этой функцией засеивается КАЖДАЯ строка модалки «Поставить план». */
(() => { const db = CR.seedDb();
  const c = JSON.parse(JSON.stringify(byId(db,'K-1')));
  c.tranches = []; c.plan = [];
  let pe, err = null;
  try { pe = CR.planExecOf(c, '23.07.2026'); } catch(e){ err = e.message; }
  ok(91, !err && pe && pe.rows.length === 12 && pe.quarters.length === 4 && pe.total.monthsWithPlan === 0,
     err ? `исключение: ${err}` : `строк=${pe.rows.length} кварталов=${pe.quarters.length} мес=${pe.total.monthsWithPlan}`);
})();

/* 92. Механическая версия бага, который правка поймала руками: ни у одного демо-кредита
   план не заведён на месяц РАНЬШЕ месяца его договора — Г-30 такую строку не пропустил
   бы через мутацию, а в сиде она была бы заведена в обход неё («мёртвая» несогласованность). */
(() => { const db = CR.seedDb(); const bad = [];
  for (const c of db.credits){
    const cm = c.date ? CR.monthKey(c.date) : null;
    for (const row of (c.plan || [])) if (cm && row.month < cm) bad.push(`${c.id} ${row.month}<${cm}`);
  }
  ok(92, bad.length === 0, `нарушений=${bad.length} ${bad.slice(0,3).join(' | ')}`);
})();

/* 93. Ненаступивший месяц не считается исполненным на ноль. Его нулевой факт означает
   «срок не подошёл», а не «ничего не собрали»: процента у него нет, в знаменатель
   квартала и года он не входит, но из ПЛАНА периода не исчезает — иначе «План за год»
   перестал бы быть годовым планом. У K-1 на срезе 23.07.2026 будущие месяцы с планом —
   октябрь и ноябрь (по 28 000), они и образуют planAhead. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const pe = CR.planExecOf(c, '23.07.2026', null, 2026);
  const oct = pe.rows.find(r => r.month === '2026-10');
  const jul = pe.rows.find(r => r.month === '2026-07');
  const q4  = pe.quarters.find(q => q.q === 4);
  ok(93, oct.future === true && oct.pct === null && oct.plan === 28000
      && jul.future === false && jul.pct !== null
      && q4.plan === 56000 && q4.planDone === 0 && q4.pct === null
      && pe.total.plan === 140000 && pe.total.planDone === 84000 && pe.total.planAhead === 56000
      && pe.total.pct === Math.round(pe.total.fact / 84000 * 100) && pe.total.monthsDone === 3,
     `окт: future=${oct.future} pct=${oct.pct} · Q4 план=${q4.plan} наступило=${q4.planDone} pct=${q4.pct}`
     + ` · год план=${pe.total.plan} наступило=${pe.total.planDone} впереди=${pe.total.planAhead} pct=${pe.total.pct}`);
})();

/* 94. Форма «Поставить план» в состоянии ПО УМОЛЧАНИЮ сохраняется на каждом кредите,
   где кнопка вообще доступна. Прогноз future-only и группируется по датам позиций
   графика, поэтому месяц без позиции предзаполнять нечем — такой строке галка не
   ставится. Раньше галка стояла безусловно, и дефолт формы был невалиден на 58
   кредитах из 59: один нулевой месяц отбивался Г-30 и валил всю пачку. */
(() => { const db = CR.seedDb(); const bad = [];
  for (const c of db.credits){
    if (!(c.lifecycle === 'Зарегистрирован' || c.lifecycle === 'Действует') || c.closure) continue;
    const idx = CR.buildLedger(c, '23.07.2026').index;
    const fc  = CR.forecastByMonth(c, idx, '23.07.2026');
    const from = CR.monthKey('23.07.2026');
    const rows = CR.monthRange(from, CR.monthAdd(from, 5)).map(mk => {
      const ex = CR.planRowOf(c, mk);
      const seed = ex && ex.amount != null ? ex.amount : (fc.has(mk) ? fc.get(mk) : 0);
      return seed > 0 ? { month:mk, amount:seed, seededFrom: fc.has(mk) ? fc.get(mk) : null } : null;
    }).filter(Boolean);                                  // ровно те строки, что придут с галкой
    if (!rows.length) continue;                          // ставить нечего — форма пуста, это не отказ
    const g = CR.gate(c, 'setPlan', { rows });
    if (!g.ok) bad.push(`${c.id}: ${g.reasons[0]}`);
  }
  ok(94, bad.length === 0, `кредитов с невалидным дефолтом=${bad.length} ${bad.slice(0,2).join(' | ')}`);
})();

/* 95. Снять план можно ИЗ ИНТЕРФЕЙСА, а не только из модели: кнопка есть в раскрытой
   строке месяца с планом, и её обработчик доводит снятие до мутации. Раньше и отказ
   гейта, и подпись модалки отсылали к снятию, которого в DOM-слое не существовало. */
(() => { const src = readFileSync(HTML, 'utf8');
  const hasBtn  = /'setPlan',\s*\{rows:\[\{month:prow\.month,\s*amount:null\}\]\},\s*'Снять план'/.test(src);
  const hasOpen = /CR\.openDropPlanModal\s*=/.test(src) && /CR\.submitDropPlan\s*=/.test(src);
  const wired   = /CR\.openDropPlanModal\('/.test(src) && /CR\.submitDropPlan\('/.test(src);
  ok(95, hasBtn && hasOpen && wired, `кнопка=${hasBtn} обработчики=${hasOpen} связаны=${wired}`);
})();

/* 96. WAIVER ВИДЕН, А НЕ ТОЛЬКО ДЕЙСТВУЕТ (КР-56/КР-57, волна 03.08.2026). Второй
   разблок Г-6/Г-7 писался в модель и читался ТОЛЬКО гейтом: ни одной точки вывода
   на 59 кредитов — освоение проходило при красной обеспеченности без объяснения.
   Проверяем обе половины дефекта: владение (поле на кредите, не в зеркале модуля
   залога, который его не отдаёт) и вывод (обе вкладки печатают его из этого поля). */
(() => { const src = readFileSync(HTML, 'utf8'); const db = CR.seedDb();
  const c = byId(db,'K-5');
  CR.saveWaiver(c, { reason:'комиссия по залогу, протокол №9' });
  const owned  = !!c.pledgeWaiver && !(c.mirror && c.mirror.pledgeWaiver);   // переехал, а не скопирован
  const seeded = db.credits.some(x => x.pledgeWaiver) && !db.credits.some(x => x.mirror && x.mirror.pledgeWaiver);
  const gated  = !/mirror\s*&&\s*\w+\.mirror\.pledgeWaiver/.test(src);       // гейты не читают зеркало
  /* оба места вывода: карточка «Договора» и раздел «Обеспечения» */
  const shownDogovor = /const km=c\.kmDecision,\s*wv=c\.pledgeWaiver/.test(src) && /Освобождение от порога обеспечения/.test(src);
  const shownObesp   = /Основания освобождения от порога/.test(src) && /гейт снят waiver/.test(src);
  ok(96, owned && seeded && gated && shownDogovor && shownObesp,
     `owned=${owned} сид=${seeded} гейты=${gated} «Договор»=${shownDogovor} «Обеспечение»=${shownObesp}`);
})();

/* 97…99 — ОЧЕРЕДЬ ПОГАШЕНИЯ (ADR-0060, задача P15-R24). */

/* 97. ОЧЕРЕДЬ ПУБЛИКУЕТ КРЕДИТ (ADR-0060 §4). Перечень непогашенного отдаётся из
   derive(), и его просроченная часть сходится со сводом по статьям копейка в копейку.
   Расхождение означало бы, что лестница и debtOf разошлись молча — ровно тот дефект,
   ради которого очередь и передана одному владельцу. Проверяется на всём демонаборе:
   инвариант обязан держаться и у закрытого кредита, и у кредита без графика. */
(() => { const db = CR.seedDb();
  let bad = null, withRows = 0;
  for (const c of db.credits){
    const d = CR.derive(c);
    if (!d.queue || !Array.isArray(d.queue.rows)){ bad = `${c.id}: очереди нет`; break; }
    if (d.queue.asOf !== d.calcUntil){
      bad = `${c.id}: очередь на ${d.queue.asOf}, расчёт доведён до ${d.calcUntil}`; break; }
    if (d.queue.rows.some(r => !(r.amount > 0))){ bad = `${c.id}: в очереди нулевая строка`; break; }
    if (d.queue.rows.length) withRows++;
    const over = Math.round(d.queue.rows.filter(r => r.urg === 'over')
                     .reduce((a, r) => a + r.amount, 0) * 100) / 100;
    if (Math.abs(over - d.overdueAmount) > 0.02){
      bad = `${c.id}: Σ просроченного в очереди ${over} ≠ своду ${d.overdueAmount}`; break; }
  }
  ok(97, !bad && withRows > 0,
     bad || `очередь непуста у ${withRows} кредитов из ${db.credits.length}, Σ просроченного сходится со сводом`);
})();

/* 98. СОСТАВ СЛОЯ ВЫВОДИТ ЛЕСТНИЦА, А НЕ ПРОПОРЦИЯ (ADR-0060 §3 — снятие допущения Д-8).
   K-3: судебный приказ от 28.05.2026 на 18 300 при взносах по 12 300. Присуждённое
   обязано накрыть ПЕРВЫЕ ДВЕ позиции целиком (12 300 + остаток 6 000 уходит во вторую)
   и не дотянуться до третьей. Пропорция к телу дала бы вместо этого по 9,15 % КАЖДОЙ
   позиции — «верный порядок величины при неверной копейке».
   K-C12: ВТОРОЙ акт (25.06.2026, ИЛ-C211/2, 35 000) поверх первого (20.05.2026, ИЛ-C211,
   62 400) — единственный многослойный случай в демонаборе. Первый акт клеймит T1#1/T1#2 и
   останавливается (62 400 не хватает на T1#3 целиком); второй ОБЯЗАН пропустить уже
   помеченные T1#1/T1#2 и начать с T1#3 — это ветка `if (map.has(p.key)) continue;` в
   layersByLadder, до сих пор ничем не покрытая. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const L   = CR.courtLayersOf(c, CR.TODAY)[0];
  const lad = CR.ladderAt(c, L.date).map(p => p.key);
  const map = CR.layersByLadder(c, CR.TODAY);
  const d   = CR.derive(c);

  const c12   = byId(db,'K-C12');
  const L12   = CR.courtLayersOf(c12, CR.TODAY);
  const map12 = CR.layersByLadder(c12, CR.TODAY);
  const d12   = CR.derive(c12);

  ok(98, L.id === 'L-1' && /28\.05\.2026/.test(L.label)
      && lad[0] === 'T1#1' && lad[1] === 'T1#2' && lad[2] === 'T1#3'
      && map.get('T1#1') === 'L-1' && map.get('T1#2') === 'L-1'
      && !map.has('T1#3') && !map.has('T1#4')
      /* Суммы приостановленного считаются от НАЧИСЛЕННОГО, а начисление идёт на
         фактическое тело (ADR-0105): у K-3 тело просрочено, поэтому проценты позиций
         под решением выше контрактных 7 900 — заморозка накрывает их целиком. */
      && Math.abs(d.debt.interest.frozen - 7981.86) < 0.05
      && Math.abs(d.debt.penalty.frozen - 446.98) < 0.05
      && d.ledger.index.get('T1#1').layerId === 'L-1'
      && d.ledger.index.get('T1#3').layerId === null
      && L12.length === 2 && L12[0].id === 'L-1' && L12[1].id === 'L-2'
      && map12.get('T1#1') === 'L-1' && map12.get('T1#2') === 'L-1'
      && map12.get('T1#3') === 'L-2' && !map12.has('T1#4') && !map12.has('T1#5')
      && Math.abs(d12.debt.interest.frozen - 19497.78) < 0.05
      && Math.abs(d12.debt.penalty.frozen - 6084.12) < 0.05
      && d12.ledger.index.get('T1#1').layerId === 'L-1'
      && d12.ledger.index.get('T1#3').layerId === 'L-2'
      && d12.ledger.index.get('T1#4').layerId === null,
     `K-3: слой ${L.id} на ${L.amount}: лестница ${lad.slice(0,3).join(' → ')};`
     + ` помечено ${[...map.keys()].join(', ') || '—'};`
     + ` приостановлено %=${d.debt.interest.frozen}, пеня=${d.debt.penalty.frozen}.`
     + ` K-C12: слоёв ${L12.length}, помечено ${[...map12.keys()].join(', ') || '—'};`
     + ` приостановлено %=${d12.debt.interest.frozen}, пеня=${d12.debt.penalty.frozen}`);
})();

/* 99. ПОРЯДОК ОЧЕРЕДИ — один, по дате наступления (ADR-0060 §2: «независимо от того,
   чьи они»), ненаступившее хвостом. K-1: комиссия 1 000 от 18.05.2026 (не погашена),
   позиция 18.06.2026 погашена целиком и в перечень не попадает, 18.07.2026 просрочена,
   дальше 22 будущие позиции. Комиссия идёт первой строкой не по статье, а по дате —
   и несёт tranche:null (допущение Д-10: транша у комиссии в модели нет). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const rs = CR.derive(c).queue.rows;
  let mono = true, tail = true, seenFuture = false;
  for (let i = 0; i < rs.length; i++){
    if (i && pd(rs[i].due) < pd(rs[i-1].due)) mono = false;
    if (rs[i].future) seenFuture = true; else if (seenFuture) tail = false;
  }
  const fee = rs[0] || {};
  ok(99, rs.length > 0 && mono && tail
      && rs.every(r => r.urg === (r.future ? 'cur' : 'over'))
      && rs.every(r => r.layer === 'free' || /^L-\d+$/.test(r.layer))
      && fee.article === 'Сборы и комиссии' && fee.tranche === null && fee.due === '18.05.2026'
      && !rs.some(r => r.due === '18.06.2026'),
     `строк=${rs.length}, ненаступивших=${rs.filter(r=>r.future).length},`
     + ` первая — ${fee.article} на ${fee.due}, порядок дат ${mono?'не убывает':'СБИТ'},`
     + ` хвост ${tail?'в конце':'ПЕРЕМЕШАН'}`);
})();

/* 101…105 — ПРОГНОЗ ПОСЛЕ РАЗБОРА 10.08.2026 (ADR-0104). */

/* 101. ХВОСТ ПРОШЛОГО НИКУДА НЕ ЕДЕТ. Раньше непокрытое сваливалось в первую будущую
   позицию (k===0), и она распухала на всю просрочку — срок по просроченному назначался
   молча, вдобавок просроченное тело считалось дважды: и хвостом, и внутри базы будущего.
   Теперь: Σ прошлых строк = непокрытое по расчёту, а первая будущая гасит КОНТРАКТНОЕ
   тело и расходится с графиком ровно на свои проценты (ADR-0108) — то есть на цену
   непогашенного тела, а не на сам хвост. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c); const t = c.tranches[0];
  const fr = CR.trancheForecastRows(c, t, d.ledger.index, '23.07.2026');
  const past = fr.filter(r => r.past), fut = fr.filter(r => !r.past);
  const tail = past.reduce((a,r) => a + r.forecast, 0);
  const led  = [...d.ledger.index.values()].filter(e => e.trancheNo === t.no);
  const want = led.reduce((a,e) => a + e.principalOverdue + e.interestOverdue + e.penaltyBal, 0);
  const first = fut[0] || {};
  const ctr   = CR.trancheScheduleRows(t).find(x => x.no === first.no) || {};
  const byInterest = Math.abs((first.delta || 0)
    - ((first.interest || 0) - (first.interestCtr || 0))) < 0.05;
  ok(101, tail > 0.005 && fut.length > 0 && Math.abs(tail - want) < 0.05
       && Math.abs(first.principal - (ctr.principal || 0)) < 0.05 && byInterest
       && Math.abs(first.delta || 0) < tail / 2,
     `хвост=${tail.toFixed(2)} vs непокрытое ${want.toFixed(2)};`
     + ` первая будущая ${first.date}: график ${first.scheduled} прогноз ${first.forecast}`
     + ` (Δ ${first.delta} — только проценты=${byInterest}, тело контрактное ${ctr.principal})`);
})();

/* 102. ПРОГНОЗ ЗНАЕТ ПАУЗУ НАЧИСЛЕНИЯ (Р-17) — общее ядро periodInterest с buildSchedule.
   Пока реализаций было две, прогноз считал плоским rate/12·mpp и обещал проценты, которых
   движок не начислит: на паузе он расходился с «Расчётами» ровно там, где на него смотрят. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const t = c.tranches[0]; const idx = CR.derive(c).ledger.index;
  const before = CR.trancheForecastRows(c, t, idx, '23.07.2026').filter(r => !r.past);
  const g = CR.holdAccrual(c, { from:'01.08.2026', to:'31.12.2026', reason:'Форс-мажор',
                                doc:'hold-56.pdf', by:'Смоук' });
  const after = CR.trancheForecastRows(c, t, idx, '23.07.2026').filter(r => !r.past);
  const inHold  = after.filter(r => pd(r.date) >= pd('01.08.2026') && pd(r.date) <= pd('31.12.2026'));
  const outHold = after.filter(r => pd(r.date) > pd('31.12.2026'));
  ok(102, g.ok && inHold.length > 0 && inHold.every(r => r.interest === 0)
       && outHold.some(r => r.interest > 0) && before.some(r => r.interest > 0),
     `гейт=${g.ok} в паузе позиций=${inHold.length} все с %%=0=${inHold.every(r=>r.interest===0)};`
     + ` после паузы %% снова начисляются=${outHold.some(r=>r.interest>0)}`);
})();

/* 103. У ЗАКРЫТОГО КРЕДИТА БУДУЩЕГО НЕТ. Расчёт замирает на дате закрытия (buildLedger),
   и прогноз обязан замереть там же: иначе списанный кредит показывал бы ожидаемые
   поступления на годы вперёд по расписанию, которое никто уже не исполняет. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-6b');            // «Списан» 15.05.2026
  const t = c.tranches[0]; const d = CR.derive(c);
  const fr = CR.trancheForecastRows(c, t, d.ledger.index, '23.07.2026');
  const sm = CR.forecastSummary(c, c.tranches, d.ledger.index, '23.07.2026');
  ok(103, d.calcStopped && fr.length > 0 && fr.every(r => r.past) && sm.payoff === null,
     `расчёт остановлен=${d.calcStopped} строк=${fr.length} будущих=${fr.filter(r=>!r.past).length}`
     + ` закрытие=${sm.payoff === null ? 'не выдаётся' : sm.payoff}`);
})();

/* 104. ПОМЕСЯЧНЫЙ ПРОГНОЗ ВИДИТ ПРОШЕДШИЕ МЕСЯЦЫ. Исключение прошлого стояло против
   двойного счёта хвоста; хвост больше не течёт вперёд, и исключение снято вместе с ним.
   Иначе колонка «Прогноз» во вкладке «План» показывала по всем прошедшим месяцам ноль —
   «в те месяцы ничего не ждали». Нулевых ключей при этом быть не должно: нулём нельзя
   предзаполнять форму плана, Г-30 его отбивает. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const fc = CR.forecastByMonth(c, CR.derive(c).ledger.index, '23.07.2026');
  const pastMonths = [...fc.keys()].filter(mk => mk < '2026-07');
  ok(104, pastMonths.length > 0 && pastMonths.every(mk => fc.get(mk) > 0)
       && [...fc.values()].every(v => v > 0.005),
     `прошедших месяцев с недобором=${pastMonths.length} (${pastMonths.join(', ')});`
     + ` нулевых ключей=${[...fc.values()].filter(v => v <= 0.005).length}`);
})();

/* 105. ПЕНЯ ВПЕРЁД МОЛЧИТ ТАМ, ГДЕ ЕЁ ПРИОСТАНОВИЛ СЛОЙ. Плитка «Пеня к ближайшей дате»
   складывает penaltyPerDayFwd просроченных строк; строка под решением суда, где режим
   гасит пеню, обязана давать ноль — иначе экран обещает рост, которого не будет. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const d = CR.derive(c);
  const over = d.ledger.rows.filter(r => r.overdueTotal > 0.005);
  const frozen = over.filter(r => r.penaltyFrozen > 0.005);
  const free   = over.filter(r => !r.layerId);
  ok(105, over.length > 0 && frozen.length > 0
       && frozen.every(r => r.penaltyPerDayFwd === 0)
       && free.every(r => r.penaltyPerDayFwd >= 0)
       && over.some(r => r.penaltyPerDayFwd > 0),
     `просроченных=${over.length} с приостановленной пенёй=${frozen.length} (все с 0/день=`
     + `${frozen.every(r=>r.penaltyPerDayFwd===0)}); строк с ненулевой ценой дня=`
     + `${over.filter(r=>r.penaltyPerDayFwd>0).length}`);
})();

/* 106. НЕОСВОЕННЫЙ ТРАНШ НЕ СНИМАЕТ ОТВЕТ ПО ОБЛАСТИ. За дату закрытия голосуют только
   транши С ГРАФИКОМ: у транша без единой позиции закрывать нечего, и вето он ставить не
   вправе — иначе кредит с одним живым и одним неосвоенным траншем молча показывал «—»,
   хотя дата по живому траншу известна. Вето остаётся ровно за тем случаем, ради которого
   его вводили: график исчерпан, а долг остался (K-3) — тогда сроки назначает только
   перестроение, и чужую дату выдавать нельзя. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c);
  const sm  = CR.forecastSummary(c, c.tranches, d.ledger.index, '23.07.2026');
  const un  = c.tranches.filter(t => CR.trancheScheduleRows(t).length === 0);
  const c3  = byId(db,'K-3'); const d3 = CR.derive(c3);
  const sm3 = CR.forecastSummary(c3, c3.tranches, d3.ledger.index, '23.07.2026');
  ok(106, c.tranches.length > 1 && un.length > 0 && sm.payoff !== null
       && sm.stuck.length === 0 && sm3.payoff === null && sm3.stuck.length > 0,
     `K-1: траншей=${c.tranches.length} без графика=${un.length} закрытие=${sm.payoff||'—'};`
     + ` K-3 (график исчерпан, долг ${sm3.tail}): закрытие=${sm3.payoff||'—'}`
     + ` вето траншей=${sm3.stuck.join(',')||'нет'}`);
})();

/* 107…110 — НАЧИСЛЕНИЕ НА ФАКТИЧЕСКОЕ ТЕЛО (ADR-0105). Проценты бегут на остаток
   основного долга, а не на тот, который график СЧИТАЕТ оставшимся: недобор тела
   удорожает кредит процентами, а не только пенёй. */

/* 107. ВЗНОС ПО ПРОГНОЗУ ВЫШЕ КОНТРАКТНОГО, КОГДА ТЕЛО ПРОСРОЧЕНО (ADR-0108).
   Амортизируется контрактное ТЕЛО позиции, проценты идут на фактическое непогашенное —
   значит просрочка поднимает сам ожидаемый платёж, а не только его состав. Тело в
   позиции остаётся контрактным: график гасится в свой срок, дорожает обслуживание. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-4');
  const t = c.tranches[0]; const d = CR.derive(c);
  const fr = CR.trancheForecastRows(c, t, d.ledger.index, '23.07.2026');
  const fut = fr.filter(r => !r.past);
  const first = fut[0] || {};
  const ctr = CR.trancheScheduleRows(t).find(x => x.no === first.no) || {};
  const over = [...d.ledger.index.values()].filter(e => e.trancheNo === t.no)
    .reduce((a, e) => a + (e.principalOverdue || 0), 0);
  ok(107, over > 0.005 && fut.length > 0
       && first.interest > (ctr.interest || 0) + 0.005
       && Math.abs(first.principal - (ctr.principal || 0)) < 0.05
       && (first.delta || 0) > 0.05
       && Math.abs((first.delta || 0) - (first.interest - (ctr.interest || 0))) < 0.05,
     `просроченное тело=${over.toFixed(2)}; первая будущая ${first.date}:`
     + ` %% ${ctr.interest} → ${first.interest}, тело ${ctr.principal} → ${first.principal},`
     + ` взнос ${first.scheduled} → ${first.forecast} (Δ ${first.delta})`);
})();

/* 108. РАСХОЖДЕНИЕ РАЗЛОЖЕНО ПО ПОЗИЦИЯМ, А НЕ СВАЛЕНО БАЛЛОНОМ (ADR-0108). Каждая
   будущая строка расходится ровно на свои проценты сверх контракта, и Σ расхождения
   равна цене недобора. Прежнее правило держало взнос контрактным, и весь недобор тела
   копился в последнюю позицию графика: сорок строк молчали, одна отвечала за всё. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-4');
  const d = CR.derive(c);
  const sm = CR.forecastSummary(c, c.tranches, d.ledger.index, '23.07.2026');
  const last  = sm.fut[sm.fut.length - 1] || {};
  const first = sm.fut[0] || {};
  const byRow = sm.fut.every(r => Math.abs((r.delta || 0)
    - ((r.interest || 0) - (r.interestCtr || 0))) < 0.05);
  ok(108, sm.futSum > sm.futSched + 0.05 && byRow
       && Math.abs(sm.delta - sm.extraInterest) < 0.05
       && Math.abs(last.delta || 0) < Math.abs(first.delta || 0) * 2 + 0.05,
     `Σ впереди: график ${sm.futSched} → прогноз ${sm.futSum} (Δ ${sm.delta},`
     + ` проценты сверх контракта ${sm.extraInterest}); Δ по строкам: первая ${first.delta},`
     + ` последняя ${last.delta}; строк вне правила=${sm.fut.filter(r => Math.abs((r.delta || 0)
         - ((r.interest || 0) - (r.interestCtr || 0))) >= 0.05).length}`);
})();

/* 109. «РАСЧЁТЫ» НАЧИСЛЯЮТ ПО ТОМУ ЖЕ ПРАВИЛУ. Правка одного прогноза развела бы его с
   движком — тем самым дефектом, ради которого periodInterest сведён в одну реализацию
   (ADR-0104 §4). Первая позиция отклонения не знает (до неё платить было нечего) и
   обязана совпасть с контрактом; дальше начисленное растёт над контрактным. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-4');
  const t = c.tranches[0]; const d = CR.derive(c);
  const led = d.ledger.rows.filter(r => r.trancheNo === t.no);
  const srows = CR.trancheScheduleRows(t);
  const ctrOf = no => srows.find(x => x.no === no) || {};
  const ctrSum = led.reduce((a, r) => a + ((ctrOf(r.no).accrued == null
    ? ctrOf(r.no).interest : ctrOf(r.no).accrued) || 0), 0);
  const accSum = led.reduce((a, r) => a + (r.interestAccrued || 0), 0);
  const extra  = led.filter(r => (r.interestExtra || 0) > 0.005);
  ok(109, led.length > 1 && Math.abs(led[0].interestExtra || 0) < 0.005
       && extra.length > 0 && accSum > ctrSum + 0.05,
     `наступивших=${led.length}; начислено ${accSum.toFixed(2)} против контрактных`
     + ` ${ctrSum.toFixed(2)}; строк с начислением на недобор=${extra.length};`
     + ` первая позиция без отклонения=${Math.abs(led[0].interestExtra || 0) < 0.005}`);
})();

/* 110. ПРАВИЛО СИММЕТРИЧНО: досрочно внесённое тело УДЕШЕВЛЯЕТ кредит. Иначе это не
   начисление на факт, а штраф за просрочку под видом процентов — и досрочка, ради
   которой вкладка заведена, снова осталась бы без денежного следа (ADR-0074 §1). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const t = c.tranches[0];
  const sum = () => CR.buildLedger(c, '23.07.2026').rows
    .filter(r => r.trancheNo === t.no).reduce((a, r) => a + (r.interestAccrued || 0), 0);
  const before = sum();
  /* платёж датируется РАНЬШЕ наступивших позиций: отклонение читается на начало периода,
     и деньги, пришедшие после последней наступившей даты, начисление не удешевляют */
  c.mirror.payments.push({ num:900, date:'20.05.2026', amount:60000, tranche:t.no,
    currency:c.currency||'KGS', reg:'Шлюз', match:'Подтверждён ЦК', frozen:true,
    method:'денежными средствами', layers:{ principal:60000 } });
  const after = sum();
  ok(110, before > 0 && after < before - 0.05,
     `начислено до досрочки ${before.toFixed(2)} → после ${after.toFixed(2)}`
     + ` (разница ${(before - after).toFixed(2)})`);
})();

/* 113. ПРОИСХОЖДЕНИЕ ТРАНША и Г-3 (КВ-26, ADR-0115). У обычного кредита производных нет,
   значит распределение суммы договора обязано считаться ровно как прежде — этот кейс
   держит регресс: фильтр по происхождению не имеет права поменять цифры там, где
   реструктуризации не было. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c, '23.07.2026');
  const sumAll = c.tranches.reduce((a,t) => a + (t.amount||0), 0);
  ok(113, c.tranches.every(t => CR.trancheOrigin(t) === 'освоение')
          && Math.abs(d.allocated - sumAll) < 0.005
          && Math.abs(d.allocatable - (c.contractAmount - sumAll)) < 0.005
          && d.derivedCount === 0,
     `траншей ${c.tranches.length}, все «освоение»; allocated=${d.allocated}`
     + ` allocatable=${d.allocatable}`);
})();

/* 114. ИР-3 — ОСТАТОК ТЕЛА ЧЕТЫРЬМЯ СЛАГАЕМЫМИ (ADR-0092 §2):
   освоено − погашено − перенесено + принято. Проверяем на синтетическом транше, а не на
   сеяном: формула обязана держаться в ОБЕ стороны, а сеять транш, который и отдал, и
   принял, значило бы придумывать демо ради теста. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const t = { no:99, amount:100000, disbursements:[{ date:'01.02.2026', amount:100000 }],
    transfers:[{ date:'01.05.2026', dir:'out', amount:40000, counterTranche:100 },
               { date:'01.06.2026', dir:'in',  amount:5000,  counterTranche:100 }] };
  const b0 = CR.trancheBalanceAt(c, t, '01.04.2026');   // до переносов
  const b1 = CR.trancheBalanceAt(c, t, '15.05.2026');   // после out
  const b2 = CR.trancheBalanceAt(c, t, '15.06.2026');   // после out и in
  ok(114, Math.abs(b0 - 100000) < 0.005 && Math.abs(b1 - 60000) < 0.005
          && Math.abs(b2 - 65000) < 0.005 && CR.trancheOrigin(t) === 'разделение',
     `${b0} → ${b1} → ${b2}`);
})();

/* 115. ПЕРИОД ДЕЙСТВИЯ И ОСНОВАНИЕ ВЕРСИИ ГРАФИКА (КВ-26, РС-5 п. 3, ADR-0096 §3).
   validFrom («с какой даты версия действует») и generatedFrom («от какой даты построена»)
   — разные величины: версия по ДС с отложенной датой вступления уже записана, но
   действовать ещё не должна. Флаг active этого различить не мог и разъезжался бы с ДС. */
(() => {
  const t = { no:1, amount:0, disbursements:[], schedules:[
    { ver:1, validFrom:'01.01.2026', by:{ kind:'engine' },              generatedFrom:'01.01.2026', rows:[] },
    { ver:2, validFrom:'01.09.2026', by:{ kind:'ДС', ref:'ДС-РС-2001' }, generatedFrom:'01.09.2026', rows:[] } ] };
  const a = CR.scheduleAt(t,'01.06.2026'), b = CR.scheduleAt(t,'01.10.2026');
  ok(115, a && a.ver===1 && b && b.ver===2
          && CR.validTo(t, t.schedules[0])==='31.08.2026'
          && CR.validTo(t, t.schedules[1])===null
          && CR.scheduleAt(t,'01.01.2026').ver===1,       // граница включительна
     `срез 01.06→v${a&&a.ver} 01.10→v${b&&b.ver}; v1 по ${CR.validTo(t,t.schedules[0])},`
     + ` v2 по ${CR.validTo(t,t.schedules[1])}`);
})();

/* 116. ПЕРЕСТРОЕНИЕ ДС-ВЕРСИИ ТРЕБУЕТ ОСНОВАНИЯ (КВ-26). Строки версии by.kind==='ДС'
   пришли приложением к ПОДПИСАННОМУ соглашению; движок, перестроив её молча, затёр бы
   документ своей арифметикой. Основание — ретро-запись условия (суд · ПП) либо заявление
   на досрочку — передаётся params.basis и наследуется новой версией. Граница узкая:
   поверх версии движка перестроение свободно, как было. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[0];
  const p = { from:t.disbursements[0].date, freq:'Ежемесячно', method:'Аннуитетный' };
  const free = CR.generateSchedule(c, 1, p);                       // поверх версии движка — свободно
  t.schedules.push({ ver:99, validFrom:'01.07.2026', by:{ kind:'ДС', ref:'ДС-РС-9001' },
                     generatedFrom:'01.07.2026', generatedAt:'01.07.2026', rows:[] });
  const blocked = CR.generateSchedule(c, 1, p);
  const withBasis = CR.generateSchedule(c, 1, { ...p, basis:{ kind:'Решение суда', ref:'СД-77' } });
  ok(116, free && free.ver && blocked.ok === false
          && /основани/i.test((blocked.reasons||[]).join(' '))
          && withBasis && withBasis.by && withBasis.by.kind === 'engine'
          && withBasis.by.basis && withBasis.by.basis.ref === 'СД-77',
     `свободно v${free&&free.ver}; без основания ${blocked.ok}; с основанием v${withBasis&&withBasis.ver}`
     + ` (${withBasis&&withBasis.by&&withBasis.by.basis&&withBasis.by.basis.ref})`);
})();

/* 117. СТАТЬИ СТРОКИ ГРАФИКА (КВ-26, ADR-0109). Только БЕЗСТАВОЧНЫЕ: основной долг
   (тело + капитализированные проценты) остаётся в r.principal — по ADR-0109 это
   единственная ставочная колонка, и она уже авторитетна для леджера и прогноза.
   Пустая колонка не рисуется — состав считается по строкам, а не по справочнику. */
(() => {
  const rowsA = [ { no:1, date:'01.03.2026', principal:1000, interest:50, total:1050 },
                  { no:2, date:'01.04.2026', principal:1000, interest:40, total:1290,
                    articles:{ accPenalty:200 } } ];
  const cols = CR.scheduleArticleCols(rowsA);
  ok(117, CR.rowArticlesSum(rowsA[0])===0 && Math.abs(CR.rowArticlesSum(rowsA[1])-200)<0.005
          && cols.length===1 && cols[0].key==='accPenalty'
          && CR.scheduleArticleCols([rowsA[0]]).length===0,
     `колонок ${cols.length} (${cols.map(x=>x.key).join(',')})`);
})();

/* 118. РАСКЛАДКА БЕЗСТАВОЧНЫХ (ИР-2′). Части раскладываются равными долями по позициям
   своего интервала, остаток от округления падает в ПОСЛЕДНЮЮ позицию интервала: иначе
   Σ колонок разъезжается с суммой переноса на копейки, и плашка ИР-2′ врёт. */
(() => {
  const rowsB = [1,2,3].map(k => ({ no:k, date:`0${k}.03.2026`, principal:1000, interest:0, total:1000 }));
  CR.spreadArticles(rowsB, [{ key:'accInterest', amount:100.00, from:1, to:3 }]);
  const sB = rowsB.reduce((a,r) => a + CR.rowArticlesSum(r), 0);
  ok(118, Math.abs(sB - 100) < 0.005 && rowsB.every(r => r.articles && r.articles.accInterest > 0)
          && rowsB.every(r => Math.abs(r.total - 1000 - r.articles.accInterest) < 0.005),
     `Σ=${sB} по строкам ${rowsB.map(r=>r.articles.accInterest).join('/')}`);
})();

/* 119. Г-8 ЗНАЕТ ДВЕ ВЕТКИ (КВ-26, ADR-0092 §1). Транш происхождением «освоение» строит
   график от фактической даты освоения (как было); производный — от даты вступления ДС,
   потому что освоения у него нет и не будет. Прежняя формулировка отказывала второму
   навсегда. */
(() => { const db=CR.seedDb(); const kOrd=byId(db,'K-1');
  const tDer = { no:2, amount:50000, disbursements:[],
                 transfers:[{ date:'01.05.2026', dir:'in', amount:50000, counterTranche:1,
                              basis:{ ds:'ДС-РС-2001', date:'01.05.2026' } }] };
  const tEmpty = { no:3, amount:50000, disbursements:[], transfers:[] };
  const gDer = CR.gate(kOrd, 'buildSchedule', { tranche: tDer });
  const gEmp = CR.gate(kOrd, 'buildSchedule', { tranche: tEmpty });
  ok(119, gDer.ok === true && gEmp.ok === false
          && /освоен/i.test(gEmp.reasons.join(' ')),
     `производный ${gDer.ok} пустой ${gEmp.ok}`);
})();

/* 120. Г-4 ОТКАЗЫВАЕТ ПРОИЗВОДНОМУ (ADR-0092 «Последствия»). Сумма пришла переносом,
   а не выдачей: освоить её ещё раз значило бы выдать деньги дважды. Причина обязана
   называть ДС — иначе куратор увидит немой отказ (§0.3). */
(() => { const db=CR.seedDb(); const kD=byId(db,'K-1');
  const tDer = { no:99, amount:50000, disbursements:[],
                 transfers:[{ date:'01.05.2026', dir:'in', amount:50000, counterTranche:1,
                              basis:{ ds:'ДС-РС-2001', date:'01.05.2026' } }] };
  kD.tranches = kD.tranches.concat([tDer]);
  const g4 = CR.gate(kD, 'addDisbursement', { trancheNo:99, amount:1000 });
  ok(120, g4.ok === false && /ДС-РС-2001/.test(g4.reasons.join(' ')),
     g4.reasons.join(' | ').slice(0,90));
})();

/* 121. СТАТЬИ ПЕРЕЖИВАЮТ ПЕРЕСТРОЕНИЕ (КВ-26, ADR-0109). Движок амортизирует только тело;
   безставочные статьи держатся базой транша (articleBase) и раскладываются заново при
   каждом построении. Без этого «Сформировать график» стирал бы то, что пришло приложением
   к ДС, — и плашка ИР-2′ переставала сходиться после первой же кнопки. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const t=c.tranches[0];
  t.articleBase = [{ key:'accPenalty', amount:1200, from:1, to:4 }];
  const rows = CR.buildSchedule(t, t.disbursements[0].date).rows;
  const s = rows.reduce((a,r) => a + CR.rowArticlesSum(r), 0);
  const cols = CR.scheduleArticleCols(rows);
  ok(121, Math.abs(s - 1200) < 0.005 && cols.length === 1 && cols[0].key === 'accPenalty'
          && rows.slice(4).every(r => CR.rowArticlesSum(r) === 0),
     `Σ статей ${s}, колонок ${cols.length}, позиций ${rows.length}`);
})();

/* 122. Г-25 ПОКАЗЫВАЕТ ВСЕ ПРИЧИНЫ РАЗОМ, ДВЕРЬ АТОМАРНА (КВ-26, ADR-0096 §3). Кредит
   не строит первичную ДС-версию сам — строки ПРИХОДЯТ приложением, и он проверяет их
   форму: ИР-2′, строгий рост дат, интервалы распоряжений внутри длины графика. Причины
   собираются вместе, как у Г-6/Г-7: чинить по одной — четыре круга согласования.
   Полуприменённого ДС не бывает: при отказе кредит обязан остаться нетронутым. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const src=c.tranches[0];
  const bad = { num:'ДС-РС-7000', date:'01.05.2026', effectiveFrom:'01.06.2026', sourceTranche:src.no,
    parts:[{ key:'principal', amount:100000, from:1, to:9 }],
    rows:[{ no:1, date:'01.08.2026', principal:40000, interest:0, total:40000 },
          { no:2, date:'01.07.2026', principal:40000, interest:0, total:40000 }] };
  const g = CR.gate(c, 'applyDs', { ds: bad });
  const before = c.tranches.length;
  const res = CR.restructureApplied(c, bad);
  ok(122, g.ok === false && g.reasons.length >= 3 && res.ok === false
          && c.tranches.length === before && (src.transfers || []).length === 0,
     `причин ${g.reasons.length}: ${g.reasons.join(' | ').slice(0,110)}`);
})();

/* 123. ДВЕРЬ РОЖДАЕТ ТРАНШ И ПАРУ ПЕРЕНОСОВ (ADR-0092 §1–2, ADR-0096). Перенос двусторонний
   и датированный: у источника — out, у производного — in, у обоих одно основание. Остаток
   тела считается по ИР-3 с обеих сторон сразу — иначе деньги «удваиваются» ровно на
   величину переноса. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const src=c.tranches[0];
  const r2 = x => Math.round(x * 100) / 100;
  const bal = CR.trancheBalanceAt(c, src, '01.06.2026');
  const moved = r2(bal / 2), art = 1000, p1 = r2((moved - art) / 2), p2 = r2(moved - art - p1);
  const ds = { num:'ДС-РС-7001', date:'01.05.2026', effectiveFrom:'01.06.2026', sourceTranche:src.no,
    parts:[{ key:'principal', amount:r2(moved - art), from:1, to:2 },
           { key:'accPenalty', amount:art, from:2, to:2 }],
    rows:[{ no:1, date:'01.07.2026', principal:p1, interest:0, total:p1 },
          { no:2, date:'01.08.2026', principal:p2, interest:0, total:p2, articles:{ accPenalty:art } }],
    conditions:[{ param:'rate', value:4 }, { param:'method', value:'аннуитет' }] };
  const res = CR.restructureApplied(c, ds);
  const der = res.tranche;
  ok(123, res.ok === true && c.tranches.length === 3
          && CR.trancheOrigin(der) === 'разделение' && CR.originDs(der) === 'ДС-РС-7001'
          && Math.abs(der.amount - moved) < 0.005
          && CR.transferredOut(src) === moved && CR.transferredIn(der) === moved
          && Math.abs(CR.trancheBalanceAt(c, src, '01.06.2026') - (bal - moved)) < 0.005
          && Math.abs(CR.trancheBalanceAt(c, der, '01.06.2026') - moved) < 0.005
          && der.schedules[0].by.kind === 'ДС' && der.schedules[0].validFrom === '01.06.2026',
     `перенесено ${moved}: остаток источника ${CR.trancheBalanceAt(c, src, '01.06.2026')},`
     + ` производного ${CR.trancheBalanceAt(c, der, '01.06.2026')}`);
})();

/* 124/125. ИР-5 — ОПУСТОШЁННЫЙ ТРАНШ ЗАКРЫВАЕТСЯ ПЕРЕНОСОМ, И СЧЁТЧИК СЧИТАЕТ ДС.
   Второе ДС забирает у источника весь остаток: денег не приходило, поэтому закрывать его
   погашением значило бы соврать денежными показателями (ADR-0092 §3). Причина «перенос»
   ВЫВОДИТСЯ обнулившей операцией — руками её ввести нельзя. Счётчик растёт на ДС, а не на
   транш: одно соглашение, поделившее три транша, — одна реструктуризация. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1'); const src=c.tranches[0];
  const r2 = x => Math.round(x * 100) / 100;
  const mk = (num, eff, amount) => ({ num, date:'01.05.2026', effectiveFrom:eff, sourceTranche:src.no,
    parts:[{ key:'principal', amount, from:1, to:1 }],
    rows:[{ no:1, date:'01.12.2026', principal:amount, interest:0, total:amount }],
    conditions:[{ param:'rate', value:4 }] });
  const bal = CR.trancheBalanceAt(c, src, '01.06.2026');
  CR.restructureApplied(c, mk('ДС-РС-7001', '01.06.2026', r2(bal / 2)));
  const rest = CR.trancheBalanceAt(c, src, '01.07.2026');
  const two = CR.restructureApplied(c, mk('ДС-РС-7002', '01.07.2026', rest));
  ok(124, two.ok === true && src.closed && src.closed.reason === 'перенос'
          && src.closed.date === '01.07.2026' && src.closed.by.ref === 'ДС-РС-7002'
          && Math.abs(CR.trancheBalanceAt(c, src, '01.07.2026')) < 0.005
          && CR.gate(c, 'closeTranche', { trancheNo:c.tranches[1].no, reason:'перенос' }).ok === false,
     `источник закрыт ${src.closed && src.closed.date} по причине «${src.closed && src.closed.reason}»`);
  ok(125, (c.appliedDs || []).length === 2 && c.tranches.length === 4
          && c.appliedDs[1].num === 'ДС-РС-7002',
     `ДС ${(c.appliedDs||[]).length}, траншей ${c.tranches.length}`);
})();

/* 126. ГРАНИЦА ДВЕРИ (ADR-0096). t.transfers.push вне restructureApplied означает второй
   вход в модель переноса — ровно то, от чего одна дверь и защищает. Тот же приём, что
   в смоуке реструктуризации: проверяем ИСХОДНИК, а не поведение. */
(() => {
  const pushes = (src.match(/\.transfers\.push\(/g) || []).length;
  const at = src.indexOf('function restructureApplied');
  const inDoor = src.slice(at, at + 4000);
  const inside = (inDoor.match(/\.transfers\.push\(/g) || []).length;
  ok(126, at > 0 && pushes === inside, `всего ${pushes}, внутри двери ${inside}`);
})();

/* 127. ДЕЛИМ ТОЛЬКО ПРИ РАСХОЖДЕНИИ УСЛОВИЙ (ADR-0092 §4). Если весь остаток единственного
   транша идёт на новые условия, по кредиту после ДС действует ОДИН комплект — деления не
   возникает, и производный транш был бы пустой сущностью: такое ДС оформляется записями
   условий и новой версией графика на существующем транше (случай К-4 · ДС-РС-1004).
   Перенос больше остатка тела отклоняется там же — вторая проверка той же суммы. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-3'); const src=c.tranches[0];
  const bal = CR.trancheBalanceAt(c, src, '01.06.2026');
  const mk = amount => ({ num:'ДС-РС-7003', date:'01.05.2026', effectiveFrom:'01.06.2026',
    sourceTranche:src.no, parts:[{ key:'principal', amount, from:1, to:1 }],
    rows:[{ no:1, date:'01.12.2026', principal:amount, interest:0, total:amount }] });
  const whole = CR.gate(c, 'applyDs', { ds: mk(bal) });
  const over  = CR.gate(c, 'applyDs', { ds: mk(Math.round((bal + 1000) * 100) / 100) });
  ok(127, c.tranches.length === 1 && whole.ok === false && /§ *4/.test(whole.reasons.join(' '))
          && over.ok === false && /остатк/i.test(over.reasons.join(' ')),
     `весь остаток: ${whole.reasons.join(' | ').slice(0,80)}`);
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
