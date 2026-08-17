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
   решение пользователя). queue/penaltyMaxPct остаются вне реестра — с волны 14.08.2026
   (третий заход) queue снят и из модели вовсе, см. #161. */
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
       параметры. В демо расхождений ДВА, и оба содержательные: К-7 —
       реструктурированный (ADR-0092 §4: производный транш и появляется тогда, когда
       по кредиту одновременно действуют РАЗНЫЕ комплекты условий, то есть расхождение
       для него — не аномалия, а признак), К-C40 — мультитраншевый фон. */
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
  ok(33, single && divergent.length === 2 && divergent.some(c => c.id === 'K-7') && rows.length >= 1 && rows.every(r => r.cells.length >= 2)
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
   чем «ежемесячно», при том же сроке. Прежний движок всегда строил помесячно.
   Версия графика строится ОТ ДАТЫ ВСТУПЛЕНИЯ записи (ADR-0130 §1): доп. соглашение
   не действует раньше, чем заключено (Г-19), — прежний вариант строил от даты
   освоения и требовал ретро-применения, которое гейт запрещает. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const monthly = CR.buildSchedule(t, CR.TODAY).rows.length;
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-FREQ', date:CR.TODAY, ref:'ДС-FREQ', label:'ДС-FREQ' },
    records:[{ param:'freq', value:'ежеквартально', effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  const quarterly = CR.buildSchedule(t, CR.TODAY).rows.length;
  ok(45, monthly === 24 && quarterly === 8, `мес=${monthly} кв=${quarterly}`);
})();

/* 46. День платежа НЕ зажимается к 28-му (КР-14): освоение 31.05 даёт 30.06 и 31.07,
   а не три платежа 28-го числа. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const rows = CR.buildSchedule(t, '31.05.2026').rows.slice(0,3).map(r => r.date);
  ok(46, rows[0]==='30.06.2026' && rows[1]==='31.07.2026' && rows[2]==='31.08.2026', rows.join(' · '));
})();

/* 47. graceAccrual и graceInterest — РАЗНЫЕ механизмы (КР-13). Отсрочка начисления
   обнуляет начисленное; льгота по процентам начисляет, но не включает в платёж.
   Версия строится от даты вступления записи (ADR-0130 §1, Г-19). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const set = (param, value) => CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-'+param, date:CR.TODAY, ref:'ДС-'+param, label:'ДС-'+param },
    records:[{ param, value, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  set('graceAccrual', 3);
  const accr = CR.buildSchedule(t, CR.TODAY).rows[0];
  set('graceAccrual', 0); set('graceInterest', 3);
  const intr = CR.buildSchedule(t, CR.TODAY).rows[0];
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
   не может быть подписан «Погашен»: прежний payGroupOf возвращал '5 · Погашен' на любом
   «Закрыт». С КВ-63 отпал и последний довод в пользу вывода из чисел — решение списывает
   ВЕСЬ долг, и остаток кредита ноль по всем шести статьям. Именно поэтому проверка
   ужесточена: подгруппа обязана остаться «4 · безнадёжные» при НУЛЕВОМ долге — за баланс
   долг ушёл с баланса кредита, но не с учёта заёмщика, и вывести её из d.debtBalance
   теперь нельзя ни при каком желании. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-6b'); const d = CR.derive(c);
  const noPayGroup = typeof CR.derive(c).payGroup === 'undefined';
  const W = d.debt.written || {};
  ok(51, d.debt.principal.bal === 0 && d.debt.interest.bal === 0 && d.debt.penalty.bal === 0
         && d.debtBalance === 0 && W.total > 0.005
         && W.principal > 0.005 && W.interest > 0.005 && W.penalty > 0.005
         && d.subgroup === '4' && /безнадеж/i.test(d.subgroupLabel||'') && noPayGroup,
     `остатки тело=${d.debt.principal.bal} %=${d.debt.interest.bal} пеня=${d.debt.penalty.bal}`
     + ` долг всего=${d.debtBalance} · списано ${W.total}`
     + ` (тело ${W.principal} % ${W.interest} пеня ${W.penalty})`
     + ` подгруппа=${d.subgroup} «${d.subgroupLabel}»`);
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
  /* ADR-0129 §2 изменил ФАКТ, а не правило: у K-1 платёж 20.06 закрыл позицию от 18.06 с
     опозданием на два дня, и пеня за них (9,71) теперь начислена — она не спорная, спор
     начинается 18.07. Поэтому «вся пеня спорна» больше не выполняется, и проверяется то,
     что и проверялось по смыслу: спорная часть в требование не входит, а снятие статуса
     переносит её туда целиком, ничего не потеряв и не удвоив. */
  ok(59, d1.debt.penalty.disputed > 0 && d1.debt.penalty.accrued > 0
      && d1.overdue.disputedDays > 0 && d1.riskBasis.eff < d1.overdue.days
      && d2.debt.penalty.disputed === 0
      && Math.abs(d2.debt.penalty.accrued
                  - (d1.debt.penalty.accrued + d1.debt.penalty.disputed)) < 0.05
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
  /* Правило прежнее: спорная пеня в требование НЕ входит. Изменилось слагаемое рядом с
     ней — пеня за двухдневное опоздание платежа 20.06 (ADR-0129 §2), и она в требование
     входит, поэтому Г-14 теперь её называет. Сторожим само вычитание: требование = всё
     начисленное минус спорное, и спорная копейка в гейт не попадает. */
  ok('59b', rawPen > 0 && d.debt.penalty.disputed > 0
      && Math.abs(d.debt.penalty.bal - (Math.round(rawPen*100)/100 - d.debt.penalty.disputed)) < 0.05
      && d.debt.penalty.bal > 0 && g.reasons.some(r => /Пеня/.test(r)),
     `пеня посчитана=${Math.round(rawPen*100)/100}, спорна=${d.debt.penalty.disputed}, в требовании=${d.debt.penalty.bal}; Г-14 называет только неспорную`);
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

/* 64. payDay (Шаг 18, Q1): день платежа берётся из условия, а не из дня старта версии.
   Версия строится от даты вступления записи (ADR-0130 §1, Г-19), поэтому старт и дата
   вступления здесь одна дата — 31.12.2026. Без записи день наследуется от старта и
   зажимается коротким месяцем (28.02), с payDay=15 все позиции садятся на 15-е. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const FROM = '31.12.2026';
  const before = CR.buildSchedule(t, FROM).rows.slice(0,3).map(r => r.date);
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-PAYDAY', date:CR.TODAY, ref:'ДС-PAYDAY', label:'ДС-PAYDAY' },
    records:[{ param:'payDay', value:15, effectiveFrom:FROM, trancheNos:[t.no], note:'' }] });
  const after = CR.buildSchedule(t, FROM).rows.slice(0,3).map(r => r.date);
  ok(64, before[1] === '28.02.2027' && after.every(d => d.startsWith('15.')),
     `без записи: ${before.join(' · ')} · payDay=15: ${after.join(' · ')}`);
})();

/* 65. lastPaymentAnchor (Шаг 18, Q2): «по дате 1-го платежа» считает от даты 1-го
   платежа, а не от даты выдачи — формула программы (renderTab6, R19): «по 1-му
   платежу» → EDATE(1-й,(n−1)×f), «по дате выдачи» → EDATE(выдача,n×f).
   Дата вступления записи ОТЛОЖЕНА в будущее (31.10.2026, КВ-27) и от неё же строится
   версия — доп. соглашение действует вперёд, а не назад (ADR-0130 §1, Г-19). Старт 31-го:
   1-й платёж клэмпится ноябрём на 30-е и оттуда СТЕКАЕТ (компаундится от уже урезанного
   дня); «по дате выдачи» день каждый раз берётся заново от 31. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const FROM = '31.10.2026';
  const rows1 = CR.buildSchedule(t, FROM).rows.slice(0,2).map(r => r.date);
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-ANCHOR', date:CR.TODAY, ref:'ДС-ANCHOR', label:'ДС-ANCHOR' },
    records:[{ param:'lastPaymentAnchor', value:'по дате 1-го платежа', effectiveFrom:FROM, trancheNos:[t.no], note:'' }] });
  const rows2 = CR.buildSchedule(t, FROM).rows.slice(0,2).map(r => r.date);
  ok(65, rows1[1] === '31.12.2026' && rows2[1] === '30.12.2026',
     `по дате выдачи: ${rows1.join(' · ')} · по дате 1-го платежа: ${rows2.join(' · ')}`);
})();

/* 66. graceIntDistFrom/To (Шаг 18, Q5): вне окна отложенные % копятся, не гасятся;
   внутри окна — распределяются. По умолчанию (0/0) поведение не меняется (проверено
   существующим #47 — там окно не задавалось). Версия строится от даты вступления
   записи (ADR-0130 §1, Г-19). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const set = (param, value) => CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-'+param, date:CR.TODAY, ref:'ДС-'+param, label:'ДС-'+param },
    records:[{ param, value, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  set('graceInterest', 3); set('graceIntDistFrom', 10); set('graceIntDistTo', 12);
  const rows = CR.buildSchedule(t, CR.TODAY).rows;
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
   Шаг 20: dayMethod в PARAMS — меняется записью условия, как rate/term.
   Версия строится ПОЗЖЕ даты вступления записей (ADR-0130 §1, Г-19) и с 31.01.2027 —
   тогда первые два периода это февраль (28 дней) и март (31), и числитель различим;
   от даты освоения оба периода вышли бы по 31 дню и проверка ничего не ловила бы. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const set = (param, value) => CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-'+param, date:CR.TODAY, ref:'ДС-'+param, label:'ДС-'+param },
    records:[{ param, value, effectiveFrom:CR.TODAY, trancheNos:[t.no], note:'' }] });
  set('graceMain', 999);
  const from = '31.01.2027';
  const rf = CR.buildSchedule(t, from).rows;                  // dayMethod дефолт факт/365 — числитель = дни
  set('dayMethod', '30/365');
  const rn = CR.buildSchedule(t, from).rows;                  // числитель = финансовый месяц (фикс. 30)
  ok(67, rf[0].accrued !== rf[1].accrued && rn[0].accrued === rn[1].accrued,
     `факт: п1=${rf[0].accrued} п2=${rf[1].accrued} (разные дни) · 30-числ: п1=${rn[0].accrued} п2=${rn[1].accrued} (равны)`);
})();

/* 166. СИЛА ОСНОВАНИЯ (ADR-0130 §1). Ретроспективность — свойство ОСНОВАНИЯ, а не
   механизма условий: доп. соглашение не может действовать раньше, чем заключено
   (Г-19 отбивает такую запись целиком), а решение суда и постановление правительства
   — могут, и тогда прошлые позиции графика ПЕРЕСЧИТЫВАЮТСЯ по новому комплекту
   (носитель — версия графика, КВ-26). Три стороны в одной проверке: гейт молчит там,
   где должен ругаться; отбитая запись не оставляет следа в графике; принятая — меняет
   его на той же дате. Ставка 20 против сеяных 10 даёт ровно двойное начисление. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const RETRO = '01.06.2026';                                  // позже договора (12.05.2026, Г-18), раньше TODAY
  const before = CR.buildSchedule(t, RETRO).rows[0].accrued;
  const ds = CR.addConditionRecords(c, {
    basis:{ kind:'agreement', num:'ДС-RETRO', date:CR.TODAY, ref:'ДС-RETRO', label:'ДС-RETRO' },
    records:[{ param:'rate', value:20, effectiveFrom:RETRO, trancheNos:[t.no], note:'пересчёт процентов' }] });
  const afterDs = CR.buildSchedule(t, RETRO).rows[0].accrued;
  const court = CR.addConditionRecords(c, {
    basis:{ kind:'court', num:'ГД-77', date:CR.TODAY, ref:'ГД-77', label:'Решение суда ГД-77' },
    records:[{ param:'rate', value:20, effectiveFrom:RETRO, trancheNos:[t.no], note:'пересчёт процентов с ' + RETRO }] });
  const afterCourt = CR.buildSchedule(t, RETRO).rows[0].accrued;
  ok(166, ds.ok === false && (ds.reasons || []).some(x => /Г-19/.test(x))
       && afterDs === before && court.ok === true
       && Math.abs(afterCourt - before * 2) < 0.02,
     `ДС отбито=${ds.ok === false} график после ДС ${before}→${afterDs} · суд принят=${court.ok}, после суда ${afterCourt}`);
})();

/* 167. НАЧИСЛЕНИЕ ИДЁТ ОТ СТАРТА ВЕРСИИ, А НЕ «ОДНИМ ПЕРИОДОМ» (ADR-0130 §4, КР-63).
   Первая позиция считает ФАКТИЧЕСКИЕ дни от даты, с которой версия действует, — иначе
   деньги у заёмщика есть, а процентов нет (против ADR-0105). Ловушка ставится днём
   платежа: старт 31.12.2026 и payDay=15 дают первую позицию 15.01.2027 — 15 дней, ПОЛОВИНУ
   периода. Движок «один период = один месяц» напечатал бы здесь месячную сумму.
   Ожидание считается из живых условий (`conditionsAt`), чтобы правка ставки в сиде
   роняла проверку по существу, а не по зашитому числу. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1'); const t = c.tranches[0];
  const FROM = '31.12.2026';
  CR.addConditionRecords(c, { basis:{ kind:'agreement', num:'ДС-PD15', date:CR.TODAY, ref:'ДС-PD15', label:'ДС-PD15' },
    records:[{ param:'payDay', value:15, effectiveFrom:FROM, trancheNos:[t.no], note:'' }] });
  const rows = CR.buildSchedule(t, FROM).rows;
  const bal  = CR.disbursedSum(t);
  const rate = Number(CR.conditionsAt(t, FROM).rate);
  const days = Math.round((pd(rows[0].date) - pd(FROM)) / 86400000);
  const want = Math.round(bal * rate / 100 * days / 365 * 100) / 100;
  const month = Math.round(bal * rate / 100 * 30 / 365 * 100) / 100;
  ok(167, rows[0].date === '15.01.2027' && days === 15
       && Math.abs(rows[0].accrued - want) < 0.02 && Math.abs(rows[0].accrued - month) > 1,
     `п1=${rows[0].date} (${days} дн.) начислено ${rows[0].accrued} · по дням ${want} · «один месяц» дал бы ${month}`);
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
  const TABS = ['Договор','Условия','Состав','График','Прогноз','Расчёты','Платежи','План','Обеспечение','Проблемные','Досье'];
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

  /* 168. РЕЕСТР ПОКАЗЫВАЕТ ВЕСЬ СИД, ПЕРЕКЛЮЧАТЕЛЯ НАБОРА НЕТ (КВ-52, откат КВ-44).
     Сужение показа до восьми опорных снято вместе со всей машинерией: смена набора
     пересобирала оболочку реестра со списками фильтров, а промах выборки делал второй
     проход по сиду с derive() — страница тормозила. Чек стережёт три вещи разом: API
     набора снят с CR, разметка не держит ни селектора, ни подсказки промаха, а строки
     реестра берутся из `CR.db.credits`. Сид при этом не тронут — 60 кредитов на месте,
     их ветки нужны остальным проверкам. Живёт в DOM-песочнице: реестр — слой рендера. */
  const seedN = CR2.db.credits.length;
  const html168 = readFileSync(HTML, 'utf8');       // не `src`: ниже в этом блоке своё объявление
  const apiLeft = ['setDemoScope','demoCredits','DEMO_CORE'].filter(k => CR2[k] !== undefined);
  const markLeft = ['id="demoSel"', 'class="demo-miss"', 'onclick="CR.setDemoScope']
    .filter(mk => html168.includes(mk));
  const rowsFromSeed = /function renderRows\(\)[\s\S]{0,600}for \(const c of CR\.db\.credits\)/.test(html168);
  ok(168, apiLeft.length === 0 && markLeft.length === 0 && rowsFromSeed
          && seedN >= 59 && html168.includes('openDemoSheet'),
     `сид ${seedN}, строки реестра из сида: ${rowsFromSeed}`
     + `${apiLeft.length ? ', осталось на CR: ' + apiLeft.join(',') : ''}`
     + `${markLeft.length ? ', осталось в разметке: ' + markLeft.join(' | ') : ''}`);

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

  /* 129. «СОСТАВ» ПОД РАЗДЕЛЕНИЕ ПО ДС (КВ-26, пересмотрено КВ-33 и КВ-36). Колонка
     «Происхождение» стоит ВСЕГДА: её отсутствие читалось бы как «происхождение у всех
     траншей одинаковое по определению». Секция журнала — тоже всегда, по тому же доводу:
     до КВ-33 она рисовалась, только когда есть переносы, и у обычного кредита её не было
     вовсе. С КВ-36 журнал зовётся «Освоение и переносы по …» и держит только свои факты
     кредита. У К-1 он состоит из одних освоений (переносов нет) и потому не поминает
     производных; у К-7 производный назван и сослан на своё ДС, «Освоено» у него — прочерк
     с объяснением, а не 0: ноль читается как «деньги не выдавали», а они выданы на родителе. */
  const trh = id => CR2.renderTab('Состав', CR2.db.credits.find(c => c.id === id));
  const trh1 = trh('K-1'), trh7 = trh('K-7');
  ok(129, /Происхождение/.test(trh1) && /Не освоено/.test(trh1)
          && /Освоение и переносы по кредиту/.test(trh1) && />Освоение</.test(trh1) && !/производн/i.test(trh1)
          && /Освоение и переносы по кредиту/.test(trh7) && /разделение по ДС/.test(trh7)
          && /ДС-РС-2001/.test(trh7) && /ДС-РС-2002/.test(trh7)
          && /производных на/.test(trh7)
          && /Перенос по ДС/.test(trh7) && /Принято по ДС/.test(trh7)
          && /Производный транш не осваивается/.test(trh7),
     `К-1: журнал ${/Освоение и переносы по кредиту/.test(trh1)} · К-7: разделение`
     + ` ${/разделение по ДС/.test(trh7)}, подпись ${/производных на/.test(trh7)}`);

  /* 145. ВКЛАДКА «СОСТАВ» ПОСЛЕ ЧИСТКИ (КВ-33, дополнено КВ-36). Что снято — снято во ВСЕХ
     областях и на всех кредитах: колонки «Состояние» и «Курс», четыре плитки (phead-dims),
     отдельная секция «Освоение», плашка ИР-3 и тулбар из четырёх кнопок. Реквизиты освоения
     не потеряны — они в «Основании» одной фразой (ПП · назначение · документ).
     КВ-36 добавила к списку снятого ЗАМОК: чужих величин на вкладке больше нет, а значит
     не должно быть и метки зеркала — ни на строке, ни в подписи. Проверяем на К-1 (простой),
     К-7 (с ДС) и К-C4 (закрытый неосвоенный остаток). */
  {
    const trh4 = trh('K-C4');
    const clean = h => !/>Состояние</.test(h) && !/>Курс</.test(h) && !/phead-dims/.test(h)
                       && !/Освоение (?:транша|\(по кредиту\))/.test(h)
                       && !/gtoolbar/.test(h) && !/Остаток тела = освоено/.test(h)
                       && !/🔒/.test(h) && !/модуль платежей/.test(h);
    ok(145, clean(trh1) && clean(trh7) && clean(trh4)
            && /ПП [^<]*·/.test(trh1)
            && !/Плат\. поручение/.test(trh1),
       `чисто: К-1 ${clean(trh1)} К-7 ${clean(trh7)} К-C4 ${clean(trh4)};`
       + ` замков нет ${!/🔒/.test(trh1 + trh7 + trh4)}`);

    /* 146. СТРОКА-КОНТЕКСТ ВМЕСТО ПЛИТОК (КВ-33). Несёт распределение и «доступно» — то
       единственное число прежней сетки, которого нет ни в шапке карточки, ни в итог-строке
       таблицы. В демо-базе нераспределённого остатка нет НИ У ОДНОГО кредита (договор всюду
       разобран траншами), поэтому положительная ветка меряется на клоне с поднятой суммой
       договора, а на живых кредитах строка обязана говорить «распределён полностью» —
       молчать нельзя, молчание неотличимо от «мы это не считаем». У К-C4 «доступно» не
       называется вовсе: неосвоенный остаток закрыт (Г-32), и число обещало бы дверь,
       которой больше нет, — вместо него фраза о закрытии, поглотившая прежнюю отдельную
       плашку (info-plate). Итог-строка перестала врать именем. */
    const trhC4 = trh('K-C4');
    const free = JSON.parse(JSON.stringify(CR2.db.credits.find(c => c.id === 'K-1')));
    free.contractAmount = free.contractAmount + 50000;
    const freeHtml = CR2.renderTab('Состав', free);
    ok(146, /Распределено/.test(trh1) && /договор распределён полностью/.test(trh1)
            && /доступно/.test(freeHtml) && /50[\s ]000,00/.test(freeHtml)   /* money() ставит неразрывный пробел */
            && !/доступно/.test(trhC4) && /Неосвоенный остаток/.test(trhC4)
            && !/info-plate/.test(trhC4)
            && />Итого</.test(trh1) && !/Итого освоено/.test(trh1)
            /* КВ-36: все три величины итога считаются по одному правилу — по траншам
               происхождением «освоение», — и оговорка «(остаток тела — по всем)» ушла
               вместе с колонкой. Сторожим её отсутствие: вернётся подпись без колонки —
               итог будет обещать величину, которой на вкладке нет. */
            && /по траншам происхождением «освоение»<\/span>/.test(trh1)
            && !/остаток тела/i.test(trh1),
       `К-1: полностью ${/договор распределён полностью/.test(trh1)} · клон: доступно`
       + ` ${/доступно/.test(freeHtml)} · К-C4: закрытие ${/Неосвоенный остаток/.test(trhC4)}`
       + ` доступно ${/доступно/.test(trhC4)}`);

    /* 147. КОЛОНКА «СУБЪЕКТ» — УСЛОВНАЯ (КВ-33). В демо-базе группового кредита нет, и
       колонка не должна стоять НИ У ОДНОГО кредита. Положительную ветку проверяем на
       синтетическом клоне: развели ИНН субъектов двух траншей — колонка появилась.
       Клон, а не правка базы: остальные кейсы читают ту же db. */
    const anySubj = CR2.db.credits.some(c => /<th[^>]*>Субъект</.test(CR2.renderTab('Состав', c)));
    const grp = JSON.parse(JSON.stringify(CR2.db.credits.find(c => c.id === 'K-1')));
    grp.tranches[1].subject = { name: 'ИП Осмонов Т.', inn: '22212201610299' };
    const grpHtml = CR2.renderTab('Состав', grp);
    ok(147, !anySubj && /<th[^>]*>Субъект</.test(grpHtml) && /22212201610299/.test(grpHtml),
       `в базе субъектная колонка ${anySubj} · на клоне ${/<th[^>]*>Субъект</.test(grpHtml)}`);

    /* 148. ЗАКРЫТИЕ ТРАНША — ИКОНКА В СТРОКЕ (КВ-33, Г-33). Кнопки тулбара нет; вместо неё
       крестик в каждой строке, зовущий модалку С НОМЕРОМ своего транша. У К-1 траншей два,
       но активный один (второй закрыт) — Г-33 запрещает закрыть последний активный, и
       отказ обязан стоять тултипом иконки, а не молчать. Клик по иконке не должен менять
       область карточки: строка кликабельна, потому stopPropagation. */
    const icons = (trh1.match(/CR\.openCloseTrancheModal\(\d+\)/g) || []);
    const active = CR2.db.credits.find(c => c.id === 'K-1').tranches.filter(t => !t.closed).length;
    ok(148, icons.length === active
            && /openCloseTrancheModal\(1\)/.test(trh1 + trh7)
            && !/openCloseTrancheModal\(\)/.test(trh1)
            && /event\.stopPropagation\(\);CR\.(openCloseTrancheModal|toast)/.test(trh1)
            && (active > 1 || /последний активный транш/.test(trh1)),
       `иконок ${icons.length} активных траншей ${active}`);

    /* 154. ЯРЛЫК ≠ ТИП СТРОКИ (КВ-35). Вкладка переименована «Транши» → «Состав»: имя
       называет предмет (из чего состоит кредит), а не род её строк — транш рождается
       освоением ЛИБО разделением по ДС (ADR-0092 §1), и «Транши» обещало реестр выдач.
       Тест сторожит ОБА конца правки разом: слова «Транши» нет в ярлыках вкладок, но
       секция «Транши» внутри вкладки на месте. Лобовая замена по файлу съела бы и её —
       и экран остался бы без имени типа строки, зато с двумя «Составами» подряд. */
    ok(154, /section-h[^>]*>Транши \(клик — выбор\)/.test(trh1)
            && /Добавить транш/.test(trh1)
            && !TABS.includes('Транши') && TABS.includes('Состав')
            && /Освоение и переносы по кредиту/.test(trh1),
       `секция «Транши» ${/Транши \(клик — выбор\)/.test(trh1)} · ярлык «Состав»`
       + ` ${TABS.includes('Состав')} · ярлыка «Транши» нет ${!TABS.includes('Транши')}`);

    /* 155. ТЕЛО ПО ТРАНШАМ НЕ ПОКАЗЫВАЕТ НИКТО (КВ-36 → снято волной 14.08.2026, п. 8).
       Прежде кейс сторожил ПЕРЕЕЗД таблицы тела с «Состава» на «Расчёты» — оба берега в
       одном условии, чтобы половина переезда не выглядела переездом. Таблицу сняли: у 49
       кредитов из 60 она вырождалась в строку из трёх чисел, два из которых печатал свод.
       Что сторожим теперь:
       (1) «СОСТАВ» ЧИСТ ОТ ВЕЛИЧИН ДОЛГА — это половина КВ-36 уцелела и остаётся
           инвариантом: вкладка отвечает за освоение («Не освоено»), а не за остаток.
       (2) «РАСЧЁТЫ» БЕЗ ТАБЛИЦЫ ТЕЛА. Отсутствие сторожим не ради раскладки (это волна
           запрещает), а ради СЛОВА, тем же доводом, что #160: колонка «Погашено» таблицы
           считалась разнесением по позициям, а «Погашено» свода строкой выше — пулом
           платежей; у 7 кредитов из 60 одно слово несло два числа (макс 667 500,02, K-C35).
           Вернуть блок, не разведя эти два числа, значит вернуть изъян.
       (3) ПЕРЕНОСЫ ПО ДС НЕ ПОТЕРЯНЫ — они видны журналом «Состава» у К-7 («Перенос по ДС»
           / «Принято по ДС», отдельно закреплено кейсом #129), а модель ИР-3 цела: её
           сторожит #114. Пункт стоит здесь, чтобы снятие показа нельзя было прочитать как
           снятие величины. */
    const rasch = id => CR2.renderTab('Расчёты', CR2.db.credits.find(c => c.id === id));
    const r1 = rasch('K-1'), r7 = rasch('K-7');
    const gone     = h => !/ИР-3/.test(h) && !/Остаток тела/.test(h) && !/Погашение тела/.test(h);
    const noBody   = h => gone(h) && !/Тело по траншам/.test(h) && !/Тело транша/.test(h)
                          && !/Итого тело по кредиту/.test(h);
    const dsInTrh7 = /Перенос по ДС/.test(trh7) && /Принято по ДС/.test(trh7);
    ok(155, gone(trh1) && gone(trh7) && /Не освоено/.test(trh1)
            && noBody(r1) && noBody(r7)
            && /Свод по кредиту на/.test(r1)
            && dsInTrh7 && typeof CR2.trancheBalanceAt === 'function',
       `«Состав» чист ${gone(trh1) && gone(trh7)} · «Расчёты» без таблицы тела`
       + ` ${noBody(r1) && noBody(r7)} · переносы по ДС в журнале «Состава» ${dsInTrh7}`
       + ` · модель ИР-3 цела ${typeof CR2.trancheBalanceAt === 'function'}`);

    /* 160. ОДНО ЧИСЛО — ОДНО ИМЯ НА «РАСЧЁТАХ» (волна 14.08.2026, третий заход). Слово
       «Начислено» носило на вкладке ДВА разных числа: свод берёт требуемое
       (interestCharged/penaltyClaimable — без приостановленного судом и спорного), леджер
       печатает начисленное (interestAccrued/penaltyAccrued). На сиде расходятся у трёх
       кредитов по процентам (макс 19 497,78) и у пяти по пене. Свод переименован в
       «К погашению» — имя верно всем четырём статьям сразу, включая тело, которое не
       начисляется вовсе; «Начислено» осталось за леджером, где оно и есть начисление.
       Обратная сторона той же правки: «Оплачено» и «К оплате» леджера ушли — одно действие
       перестало иметь два глагола. Сторожим ПОРЯДОК, а не только состав: «К погашению →
       Погашено → Остаток» — история одной статьи (потребовали → закрыли → осталось), и
       чужая колонка внутри неё стоять не должна; «Просроченная часть» идёт последней, за
       величиной, срезом которой она является. Тултипы — часть решения: без них строка
       «Основной долг» не сходится по вычитанию у 48 кредитов из 60 (остаток тела считается
       от освоения, «К погашению» — от наступивших позиций). */
    const thAll  = h => (h.match(/<thead>[\s\S]*?<\/thead>/g) || []);
    const svodTh = thAll(r1).find(t => /Статья/.test(t)) || '';
    /* Шапка расчёта снова ОДНА (КВ-64): второй вид «По позициям» и переключатель сняты,
       у вкладки остался лист по критическим датам. Правило прежнее: одно действие — один
       глагол, «Оплачено» и «К оплате» не возвращаются, «Начислено» осталось за расчётом.
       Лист ищем по «Дата и событие»: прежний признак «Изм. базы» умер вместе с колонкой
       оси (КВ-42), и половина сторожа молча не работала. */
    const ledTh  = thAll(r1).find(t => /Дата и событие/.test(t)) || '';
    const iS = s => svodTh.indexOf(s);
    const svodOrder = iS('Статья') >= 0 && iS('К погашению') > iS('Статья')
      && iS('Погашено') > iS('К погашению') && iS('Остаток') > iS('Погашено')
      && iS('Просроченная часть') > iS('Остаток');
    /* «Погашено всего» жило в снятом реестре (КВ-64); на листе глагол тот же, но без
       хвоста — колонок «Погашено» три, и различает их этаж статьи над ними. */
    const oneVerb = !/>Оплачено</.test(ledTh) && !/>К оплате</.test(ledTh) && !/>Оплата</.test(ledTh)
                    && /Начислено/.test(ledTh) && />Погашено</.test(ledTh);
    ok(160, svodOrder && !/>Начислено</.test(svodTh) && oneVerb
            && /кредит требует на дату среза/.test(r1) && /тело кредита: освоено/.test(r1),
       `свод: порядок Статья→К погашению→Погашено→Остаток→Просроченная часть ${svodOrder}`
       + ` · «Начислено» из свода ушло ${!/>Начислено</.test(svodTh)}`
       + ` · леджер одним глаголом ${oneVerb} · тултипы ${/кредит требует на дату среза/.test(r1)}`);

    /* 161. УСЛОВИЯ ДОГОВОРА НЕ ЖИВУТ НА «РАСЧЁТАХ» (волна 14.08.2026, третий заход).
       Над детальным расчётом стоял блок из четырёх полей — «Метод дней» · «Очерёдность» ·
       «Пеня по ОД, %/дн» · «Пеня по %, %/дн». Три из них печатали второй раз то, что уже
       стоит на «Условиях» (dayMethod — карточка «Погашение», обе пени — карточка «Ставки»):
       шаг 14 вынес их сюда как «параметры движка», шаг 20 вернул dayMethod в PARAMS, а показ
       остался. Четвёртое, «Очерёдность», не объясняло НИЧЕГО: bc.queue не читал никто, кроме
       собственного рендера, и значение 'по договору' противоречило ADR-0087 (порядок статей
       задаёт программа, снимок берётся решением по заявке, договор переопределять не может).
       Ключ снят и из модели — иначе он вернётся на экран следующей волной.
       Сторожим ТРИ стороны, чтобы снятие показа не превратилось в потерю величины:
       (1) на «Расчётах» полей нет ни у одного кредита — ищем ярлык поля (flabel), а не
           слово: подпись под заголовком «Метод дней» упоминает законно, отсылая в «Условия»;
       (2) значения целы на «Условиях» и ссылка на месте — без неё снятие оставляет читателя
           без адреса;
       (3) queue отсутствует в baseConditions — проверка модели, а не разметки. */
    const FLD = /flabel">(Метод дней|Очерёдность|Пеня по ОД|Пеня по %)/;
    const leaked = CR2.db.credits.filter(c => FLD.test(CR2.renderTab('Расчёты', c))).map(c => c.id);
    const condK1 = CR2.renderTab('Условия', CR2.db.credits.find(c => c.id === 'K-1'));
    const kept = /Метод дней/.test(condK1) && /Пеня по ОД/.test(condK1) && /Пеня по %/.test(condK1);
    const linked = /CR\.openTab\('Условия'\)/.test(r1);
    const noQueue = !CR2.db.credits.some(c => 'queue' in (c.baseConditions || {}));
    ok(161, leaked.length === 0 && kept && linked && noQueue,
       `утечек полей на «Расчётах» ${leaked.length}${leaked.length ? ' ('+leaked.slice(0,3).join(', ')+')' : ''}`
       + ` · значения целы на «Условиях» ${kept} · ссылка туда ${linked}`
       + ` · queue вне модели ${noQueue}`);
  }

  /* 162. ОТРЕЗКИ НАЧИСЛЕНИЯ (КВ-41 заход 1, ADR-0128 §1). Период позиции режется на
     отрезки по датам, где меняется база или ставка; условия берутся НА НАЧАЛО ОТРЕЗКА, а
     не на дату позиции. Сторожим четыре тождества, каждое из которых ловит свой класс
     поломки — арифметику отрезков проверить глазами на 273 строках нельзя:
     (1) отрезки СТЫКУЮТСЯ и покрывают период целиком — `to` предыдущего есть `from`
         следующего, первый начинается на начале периода, последний кончается на позиции;
     (2) Σ дней отрезков = дням периода — иначе склейка или numFin-развёртка потеряла день;
     (3) Σ надбавок отрезков = надбавке позиции — аддитивность %(факт)=%(контракт)+Σ%(dev),
         на которой держится вся правка;
     (4) отрезков БОЛЬШЕ ОДНОГО там, где внутри периода прошёл платёж в тело или сменились
         условия, и ровно один там, где ничего не менялось: обратное значило бы, что
         склейка либо съела границу, либо наплодила пустых. */
  {
    let bad = [], multi = 0, single = 0, maxSeg = 1;
    for (const c of CR2.db.credits){
      const led = CR2.buildLedger(c, CR2.TODAY);
      for (const r of led.rows){
        const segs = r.interestSegments; if (!segs || !segs.length) continue;
        maxSeg = Math.max(maxSeg, segs.length);
        (segs.length > 1 ? multi++ : single++);
        for (let i = 1; i < segs.length; i++)
          if (segs[i - 1].to !== segs[i].from) bad.push(`${c.id}#${r.key}: разрыв ${segs[i-1].to}→${segs[i].from}`);
        if (segs[segs.length - 1].to !== r.date) bad.push(`${c.id}#${r.key}: хвост ${segs[segs.length-1].to} ≠ ${r.date}`);
        const sumE = Math.round(segs.reduce((a, s) => a + s.extra, 0) * 100) / 100;
        if (Math.abs(sumE - (r.interestExtra || 0)) > 0.02)
          bad.push(`${c.id}#${r.key}: Σ надбавок ${sumE} ≠ ${r.interestExtra}`);
      }
    }
    ok(162, bad.length === 0 && multi > 0,
       `строк с отрезками ${multi + single} (из них дроблёных ${multi}, максимум отрезков ${maxSeg})`
       + ` · нарушений стыковки и аддитивности ${bad.length}${bad.length ? ' — ' + bad.slice(0,2).join(' | ') : ''}`);
  }

  /* 163. ШЕСТЬ СТАТЕЙ ДОЛГА (КВ-41 заход 1, ADR-0093 §1) И ПРАВИЛО ПОКАЗА (КВ-66).
     Накопленные проценты и накопленная пеня стали СТАТЬЯМИ, а не значением срочности
     внутри процентов. Необязательных статей теперь три — две накопленные и сборы: экран
     рисует их только при ненулевой строке, обязательные (тело, проценты, пеня) стоят
     всегда. Пять сторон: (1) свод сходится с очередью по просроченному — очередь
     публикует кредит (ADR-0060 §4), и разъезд здесь означал бы, что статья попала в один
     список и не попала в другой; (2) у кредита без накопленных и без сборов рисуются
     ровно три строки; (3) у K-7 накопленные есть и в свод входят, а сборов нет — пять;
     (4) у K-1 сборы есть и печатаются, накопленных нет — четыре; (5) состав показанных
     статей — подмножество шести, и обязательные три не выпадают ни у одного кредита
     сида (иначе правило показа съело бы то, что обязано стоять при нуле). */
  {
    let mismatch = [], dropped = [], feeShownZero = [], feeHiddenNonzero = [];
    const shownKeys = d => CR2.debtArticlesOf(d.debt).map(a => a.key);
    for (const c of CR2.db.credits){
      const d = CR2.derive(c, CR2.TODAY);
      const q = Math.round((d.queue.rows.filter(r => r.urg === 'over')
        .reduce((a, r) => a + r.amount, 0)) * 100) / 100;
      if (Math.abs(q - d.overdueAmount) > 0.02) mismatch.push(`${c.id}: ${q} ≠ ${d.overdueAmount}`);
      const keys = shownKeys(d);
      for (const k of ['principal','interest','penalty'])
        if (!keys.includes(k)) dropped.push(`${c.id}: нет ${k}`);
      const f = d.debt.fees;
      const feeAny = ['accrued','paid','bal','written'].reduce((a,v) => a + (f[v] || 0), 0);
      if (keys.includes('fees') && feeAny <= 0.005) feeShownZero.push(c.id);
      if (!keys.includes('fees') && feeAny > 0.005)  feeHiddenNonzero.push(c.id);
    }
    const d1 = CR2.derive(CR2.db.credits.find(c => c.id === 'K-1'), CR2.TODAY);
    const d7 = CR2.derive(CR2.db.credits.find(c => c.id === 'K-7'), CR2.TODAY);
    const bare = CR2.derive(CR2.db.credits.find(c => c.id === 'K-2'), CR2.TODAY);
    const withFees = shownKeys(d1).length === 4 && shownKeys(d1).includes('fees');
    const withAcc  = shownKeys(d7).length === 5 && !shownKeys(d7).includes('fees');
    const plain    = shownKeys(bare).join('|') === 'principal|interest|penalty';
    const acc7     = Math.round((d7.debt.accInterest.bal + d7.debt.accPenalty.bal) * 100) / 100;
    const feesShown = CR2.db.credits.filter(c => shownKeys(CR2.derive(c, CR2.TODAY)).includes('fees')).length;
    ok(163, mismatch.length === 0 && withFees && withAcc && plain && acc7 > 0.005
         && dropped.length === 0 && feeShownZero.length === 0 && feeHiddenNonzero.length === 0
         && CR2.DEBT_ARTICLES.length === 6,
       `статей ${CR2.DEBT_ARTICLES.length} · свод против очереди: расхождений ${mismatch.length}`
       + `${mismatch.length ? ' — ' + mismatch.slice(0,2).join(' | ') : ''}`
       + ` · K-1 показывает ${shownKeys(d1).length} (со сборами), K-7 — ${shownKeys(d7).length} (с накопленными, без сборов),`
       + ` K-2 — ${shownKeys(bare).join(' · ')}`
       + ` · накопленное у K-7 ${acc7} · «Сборы и комиссии» печатают ${feesShown} кредитов из ${CR2.db.credits.length}`
       + ` · обязательных потеряно ${dropped.length}${dropped.length ? ' — ' + dropped.slice(0,2).join(' | ') : ''}`
       + ` · сборы при нуле показаны у ${feeShownZero.length}, при ненуле спрятаны у ${feeHiddenNonzero.length}`);
  }

  /* 164. ДЕТАЛЬНЫЙ РАСЧЁТ — ОДИН ЛИСТ ПО КРИТИЧЕСКИМ ДАТАМ (КВ-42/ADR-0129, вид один с
     КВ-64). Экран переехал с оси позиции на ось критической даты, и ломается он не
     значением, а АРНОСТЬЮ: строка-группа года и итог раздела собираются из colspan'ов,
     считанных отдельно от шапки, — разъезд даёт съехавшую на колонку таблицу, которую
     тест значений не поймает. С разбора 16.08.2026 ширина зависит от ДВУХ вещей разом:
     состава данных (четыре колонки живут по составу) и состояния двух переключателей
     нарастающих, — поэтому арность стережётся в обоих состояниях, а состав — обоими
     концами. Четыре стороны:
     (1) арность каждой строки равна шапке — и при свёрнутых, и при развёрнутых
         нарастающих (развёрнутые — максимум ширины);
     (2) стоят колонки оси — «Дата · Событие · Изм. базы · База · Ставка · Дней ·
         Начислено % · Пеня», и НЕТ «Остатка тела»: он есть «База» той же строки
         (ADR-0129 §3), и возвращение колонки означало бы возврат дубля;
     (3) ВТОРОГО ВИДА НЕТ (КВ-64): ни переключателя CR.setCalcView, ни реестра «По
         позициям» с колонкой «Тело по графику». Сторож двусторонний намеренно — вернуть
         реестр значит вернуть второй экран тех же позиций, дублирующий «График»;
     (4) строки листа реально рисуются (иначе (1) выполняется тривиально). */
  {
    const arity = tr => {
      let n = 0, re = /<t[dh]\b([^>]*)>/g, mm;
      while ((mm = re.exec(tr))) n += Math.max(1, parseInt((/colspan="(\d+)"/.exec(mm[1]) || [])[1] || '1', 10));
      return n;
    };
    const tables = html => (html.match(/<table class="cgrid[^"]*">[\s\S]*?<\/table>/g) || []);
    const checkArity = (tbl, tag, bad, id) => {
      const head = (tbl.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0];
      const body = (tbl.match(/<tbody>[\s\S]*?<\/tbody>/) || [''])[0];
      const want = Math.max(...(head.match(/<tr[\s\S]*?<\/tr>/g) || ['']).map(arity));
      let n = 0;
      for (const tr of (body.match(/<tr[\s\S]*?<\/tr>/g) || [])){
        n++;
        if (arity(tr) !== want && !/cgrid-empty/.test(tr))
          bad.push(`${id}/${tag}: строка ${arity(tr)} против шапки ${want}`);
      }
      return n;
    };
    let bad = [], rowsDates = 0;
    /* Шапка листа двухуровневая (КВ-47): верхний этаж — СТАТЬЯ, нижний — состояние внутри
       неё, поэтому «Погашено» законно повторяется трижды. Ловушка та же, что была у чипов:
       забытый colspan у года и итога. Считается она теперь на каждом кредите, а не в
       «широком проходе», — прятать колонки больше нечем. */
    for (const c of CR2.db.credits){
      CR2.openDetail(c.id);
      {
        const html = CR2.renderTab('Расчёты', c);
        const tbl = tables(html).find(t => /class="cgrid tiered"/.test(t));
        /* кредит без наступивших позиций (K-2 — графика нет вовсе) листа не имеет, и это
           не поломка: вместо таблицы стоит подпись «считать нечего». Требовать от него
           колонок значило бы требовать таблицу пустоты. */
        if (!tbl){
          if (!/считать нечего/.test(html)) bad.push(`${c.id}: ни листа, ни подписи «считать нечего»`);
        } else {
        rowsDates += checkArity(tbl, 'даты', bad, c.id);
        const hrows = ((tbl.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0].match(/<tr[\s\S]*?<\/tr>/g) || []);
        if (hrows.length !== 2) bad.push(`${c.id}: шапка в ${hrows.length} строк(и), а обязана быть двухуровневой`);
        /* нижний этаж на ячейку короче: «Дата и событие» стоит rowspan=2 и во втором ряду
           не повторяется — именно так уезжает вся сетка, если этаж собран не по составу */
        else if (arity(hrows[1]) !== arity(hrows[0]) - 1)
          bad.push(`${c.id}: второй этаж ${arity(hrows[1])} против ${arity(hrows[0]) - 1}`);
        for (const re of [/>Основной долг</, />Проценты</, />Пеня</, />Дата и событие</,
                          />По графику</, />Остаток</, />Просрочено</, />Начислено</])
          if (!re.test(tbl)) bad.push(`${c.id}: нет колонки ${re.source}`);
        /* КОЛОНКИ ПО СОСТАВУ — В ОБЕ СТОРОНЫ (разбор 16.08.2026). Четыре колонки живут
           там, где им есть что показать, и правило проверяется обоими концами: у кредита
           с освоением/списанием/переносом колонка ОБЯЗАНА быть, у кредита без — обязана
           отсутствовать. Одной стороны мало: «всегда показывать» и «никогда» проходят
           каждая свою половину. Источник истины — модель, а не разметка. */
        const mrows = (CR2.derive(c).ledger.dateSheet || []).flatMap(s => s.rows);
        for (const [re, want, name] of [
          [/>Освоено</,    mrows.some(r => (r.disb||0)     > 0.005), 'Освоено'],
          [/>Списано</,    mrows.some(r => (r.offAmt||0)   > 0.005), 'Списано'],
          [/>Перенесено</, mrows.some(r => (r.movedOut||0) > 0.005), 'Перенесено'],
          [/>Принято</,    mrows.some(r => (r.movedIn||0)  > 0.005), 'Принято']])
          if (re.test(tbl) !== want)
            bad.push(`${c.id}: колонка «${name}» ${re.test(tbl) ? 'есть, а показывать нечего' : 'нужна, а её нет'}`);
        /* ДЕТАЛИ — ПО КНОПКЕ, СВОЕЙ НА БЛОК (разбор 16.08.2026; параметры отрезка добавлены
           КВ-67, разбор одной статьи за раз — КВ-68). По умолчанию детали свёрнуты, поэтому
           в шапке их ноль. Кнопок ТРИ — у каждого блока своя: у пени нарастающих нет, но
           «Ставка» и «За день» прячутся её кнопкой.
           РАЗБОР ОДНОЙ СТАТЬИ стережётся с ТРЁХ сторон, и каждая ловит свой класс поломки:
             (1) у разобранной статьи детали ПРИШЛИ — иначе кнопка не работает вовсе;
             (2) у соседних не осталось НИЧЕГО, кроме колонок-ответов, — иначе сворачивания
                 нет и лист по-прежнему растёт в ширину;
             (3) колонки-ответы соседей ЦЕЛЫ — «Остаток» есть у всех трёх блоков, «Просрочено»
                 у тела и процентов. Это главная сторона: ради неё блок и не прячется целиком
                 (база отрезка живёт в соседнем блоке), и односторонняя проба «соседи ужались»
                 прошла бы одинаково при сворачивании до пары и при сворачивании до нуля.
           ПАРАМЕТРЫ ОТРЕЗКА стерегутся обоими концами: в умолчании их нет ни одного, а при
           разборе своей статьи «Ставка» приходит ровно один раз (второй экземпляр — у соседа,
           и он сейчас свёрнут). До КВ-68 обе «Ставки» стояли разом; проба переписана вместе с
           правилом. */
        if ((tbl.match(/>Нарастающим</g) || []).length !== 0)
          bad.push(`${c.id}: нарастающие показаны по умолчанию — они сворачиваются кнопкой блока`);
        const sw = (html.match(/CR\.toggleCalcDetail\('(od|int|pen)'\)/g) || []);
        if (new Set(sw).size !== 3)
          bad.push(`${c.id}: переключателей деталей ${new Set(sw).size} вместо трёх (КВ-67)`);
        if (/toggleCalcRun/.test(html))
          bad.push(`${c.id}: вернулся toggleCalcRun — разбор идёт по одной статье (КВ-68)`);
        /* Шапки второго яруса разобранного листа: сначала блок, потом его колонки. Границу
           блока даёт class="grp" на первой ячейке блока — та же разметка, что рисует линию. */
        const heads = (t) => {
          const tr = ((t.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0].match(/<tr[\s\S]*?<\/tr>/g) || ['',''])[1] || '';
          const cells = tr.match(/<th\b[^>]*>[\s\S]*?<\/th>/g) || [];
          const out = [[], [], []]; let b = -1;
          for (const th of cells){ if (/class="grp"/.test(th)) b++; if (b >= 0 && b < 3) out[b].push(th.replace(/<[^>]*>/g,'').trim()); }
          return out;
        };
        const openBlock = (block) => { CR2.toggleCalcDetail(block);
          const h = CR2.renderTab('Расчёты', c);
          CR2.toggleCalcDetail(block);
          return { h, t: tables(h).find(x => /class="cgrid tiered"/.test(x)) || '' }; };
        /* КНОПКА НЕ МЕНЯЕТ СТОРОНУ (КВ-68.1, жалоба владельца 17.08.2026: «кнопки показать
           скрыть детали прыгают, то справа то слева появляются»). Класс у всех трёх кнопок
           обязан быть ОДИН И ТОТ ЖЕ во всех состояниях: сторону задаёт CSS по классу, и
           модификатор вроде `runsw open` — единственный способ, каким она может разъехаться.
           Проба смотрит на разметку, а не на вычисленный float: скрипт рендерит строку. */
        const CHIP = { od: 'Основной долг', int: 'Проценты', pen: 'Пеня' };
        if (/class="detoff"/.test(html))
          bad.push(`${c.id}: чип разбора показан в умолчании — разбора нет, снимать нечего (КВ-68.1)`);
        const ANS = { od: ['Остаток','Просрочено'], int: ['Остаток','Просрочено'], pen: ['Остаток'] };
        const BI  = { od: 0, int: 1, pen: 2 };
        let opened = '', nRun = 0;
        for (const block of ['od','int','pen']){
          const { h, t } = openBlock(block); if (block === 'int') opened = t;
          const cls = [...t.matchAll(/<button class="(runsw[^"]*)"/g)].map(m => m[1]);
          if (cls.length !== 3 || new Set(cls).size !== 1)
            bad.push(`${c.id}: при разборе «${block}» классы кнопок деталей [${cls.join('|')}] — сторона обязана быть одна на все состояния (КВ-68.1)`);
          /* Чип разбора: ровно один, называет разбираемую статью словом и снимает ЕЁ. */
          const chip = [...h.matchAll(/<button class="detoff" onclick="CR\.toggleCalcDetail\('(od|int|pen)'\)"[\s\S]*?>разбор: ([^<]*)</g)];
          if (chip.length !== 1 || chip[0][1] !== block || chip[0][2] !== CHIP[block])
            bad.push(`${c.id}: при разборе «${block}» чип у имени листа ${chip.length !== 1 ? `встретился ${chip.length} раз(а)` : `снимает «${chip[0][1]}» и зовётся «${chip[0][2]}»`} (КВ-68.1)`);
          nRun += (t.match(/>Нарастающим</g) || []).length;
          const hs = heads(t);
          for (const other of ['od','int','pen']){
            if (other === block) continue;
            const got = hs[BI[other]], want = ANS[other];
            if (got.join('·') !== want.join('·'))
              bad.push(`${c.id}: при разборе «${block}» блок «${other}» свёрнут в [${got.join('·')}] вместо колонок-ответов [${want.join('·')}] (КВ-68)`);
          }
          const mine = hs[BI[block]];
          for (const need of (block === 'od' ? ['Нарастающим'] : block === 'int' ? ['Ставка','Дней','Нарастающим'] : ['Ставка','За день']))
            if (!mine.includes(need))
              bad.push(`${c.id}: при разборе «${block}» своя деталь «${need}» не пришла (КВ-67/КВ-68)`);
          checkArity(t, 'даты·разбор ' + block, bad, c.id);
        }
        /* Шесть нарастающих собираются ТРЕМЯ разборами, а не одним: разом их больше не
           показать. Два по телу (потребовано графиком · погашено) + три по процентам
           (начислено · потребовано графиком · погашено, КВ-65), освоение, перенос, списание
           и накопленные добавляют свои; у пени нарастающих нет и слагаемое нулевое. */
        if (nRun < 6) bad.push(`${c.id}: нарастающих по всем разборам ${nRun}, а обязано быть не меньше шести (КВ-51, КВ-65)`);
        for (const [re, want] of [[/>Ставка</g, 1], [/>Дней</g, 1], [/>За день</g, 0]]){
          if ((tbl.match(re) || []).length !== 0)
            bad.push(`${c.id}: параметр отрезка ${re.source} показан по умолчанию — он уходит под «детали» (КВ-67)`);
          const got = (opened.match(re) || []).length;
          if (got !== want)
            bad.push(`${c.id}: при разборе процентов ${re.source} встретилась ${got} раз(а) вместо ${want} (КВ-68: чужая «Ставка» свёрнута)`);
        }
        if (/>Событие</.test(tbl)) bad.push(`${c.id}: «Событие» снова отдельной колонкой — его место под датой (КВ-47)`);
        if (/>Наступило</.test(tbl)) bad.push(`${c.id}: вернулось «Наступило» — колонка зовётся «По графику» (КВ-49)`);
        if (/>Изменение</.test(tbl)) bad.push(`${c.id}: вернулось «Изменение» — освоение и погашение стоят порознь (КВ-48)`);
        if (/>Остаток тела</.test(tbl)) bad.push(`${c.id}: вернулся «Остаток тела» — это «Остаток» той же строки`);
        if (/toggleCalcCol/.test(html)) bad.push(`${c.id}: вернулись чипы групп колонок — шапка называет колонки сама (КВ-47)`);
        }
        /* ВТОРОГО ВИДА НЕТ (КВ-64) — проверяется по ВСЕЙ вкладке, а не по таблице листа:
           переключатель стоял отдельной панелью над ней, и её пропажу проба внутри
           таблицы не заметила бы. Кредит без листа («считать нечего») сторожа проходит
           наравне с прочими — панель не должна возвращаться и там. */
        if (/setCalcView/.test(html))
          bad.push(`${c.id}: вернулся переключатель видов детального расчёта (КВ-64)`);
        if (/Тело по графику/.test(html))
          bad.push(`${c.id}: вернулся реестр «По позициям» — позиции живут на «Графике» (КВ-64)`);
      }
    }
    ok(164, bad.length === 0 && rowsDates > 0,
       `строк листа «По датам» ${rowsDates}`
       + ` · нарушений арности и состава колонок ${bad.length}`
       + `${bad.length ? ' — ' + bad.slice(0,2).join(' | ') : ''}`);
  }

  /* 165. ПЕНЯ ИНТЕГРИРУЕТСЯ ПО ОТРЕЗКАМ (КВ-42, ADR-0129 §2). Было одно произведение —
     «остаток НА ДАТУ СРЕЗА × ставка × все дни просрочки», — и платёж середины просрочки
     задним числом удешевлял дни до себя. Стало: база на начало каждого отрезка. Четыре
     стороны, каждая ловит свой класс поломки:
     (1) лист и свод — ОДНА величина: Σ пени строк листа транша = Σ penaltyAccrued его
         позиций, иначе экран печатал бы два числа одной величины;
     (2) в каждой строке листа «пеня за день × дней = пеня» — ровно та арифметика, ради
         проверяемости которой лист и заведён;
     (3) новая пеня НЕ МЕНЬШЕ старой формулы нигде: база на начало отрезка ≥ базы на срезе,
         потому что платежи её только уменьшают;
     (4) хотя бы на одном кредите она СТРОГО больше — доказательство, что изъян был не
         теоретическим; молча совпавшие числа означали бы, что интеграл не работает. */
  {
    let bad = [], grew = [], rows = 0;
    for (const c of CR2.db.credits){
      const led = CR2.buildLedger(c, CR2.TODAY);
      for (const s of (led.dateSheet || [])){
        const sheetPen = Math.round(s.rows.reduce((a, r) => a + (r.penalty || 0), 0) * 100) / 100;
        const ledgerPen = Math.round(led.rows.filter(r => r.trancheNo === s.trancheNo)
          .reduce((a, r) => a + (r.penaltyAccrued || 0), 0) * 100) / 100;
        if (Math.abs(sheetPen - ledgerPen) > 0.05)
          bad.push(`${c.id}/т${s.trancheNo}: лист ${sheetPen} ≠ свод ${ledgerPen}`);
        for (const r of s.rows){
          rows++;
          const byDay = Math.round((r.penPerDay || 0) * r.days * 100) / 100;
          if (Math.abs(byDay - (r.penalty || 0)) > 0.05)
            bad.push(`${c.id}/${r.date}: ${r.penPerDay}×${r.days} = ${byDay} ≠ ${r.penalty}`);
        }
      }
      /* старая формула — на базе даты среза; penaltyPerDayFwd её и несёт (за вычетом
         приостановленного судом, поэтому строки со слоем из сравнения выпадают) */
      for (const r of led.rows){
        if (r.penaltyFrozen > 0.005 || !(r.penaltyMain || r.penaltyInt)) continue;
        const old = Math.round((r.penaltyPerDayFwd || 0) * r.days * 100) / 100;
        /* допуск растёт с числом дней: старая формула умножает ОКРУГЛЁННУЮ до копейки цену
           дня на все дни, и одна копейка разницы превращается в r.days копеек */
        if ((r.penaltyAccrued || 0) < old - (0.005 * r.days + 0.05))
          bad.push(`${c.id}/${r.key}: новая пеня ${r.penaltyAccrued} < старой ${old}`);
        if ((r.penaltyAccrued || 0) > old + 0.05) grew.push(c.id);
      }
    }
    ok(165, bad.length === 0 && grew.length > 0,
       `строк листа с пенёй ${rows} · кредитов, где интеграл дал больше плоской формулы ${new Set(grew).size}`
       + ` · нарушений ${bad.length}${bad.length ? ' — ' + bad.slice(0,2).join(' | ') : ''}`);
  }

  /* 169. ГРАНИЦА ГОДА (КВ-45). 1 января — критическая дата: ни один отрезок листа не
     перешагивает Новый год, иначе делитель года (365/366 берётся по КОНЦУ отрезка) и
     годовой итог считаются по чужому году. Обратное тоже проверяется: строка 01.01 обязана
     нести событие kind:'year' — разрыв без названной причины читается как потерянное
     движение. Даты в листе — 'дд.мм.гггг'. */
  {
    const yearBad = [], janNoEvent = [];
    let yRows = 0, yJan = 0;
    const parseD = (s) => { const [d, mo, y] = String(s).split('.').map(Number); return new Date(y, mo - 1, d); };
    for (const c of CR2.db.credits){
      for (const s of (CR2.buildLedger(c, CR2.TODAY).dateSheet || [])){
        for (const r of s.rows){
          yRows++;
          const a = parseD(r.date), b = parseD(r.to);
          for (let y = a.getFullYear() + 1; y <= b.getFullYear(); y++){
            const nj = new Date(y, 0, 1);
            if (nj > a && nj < b) yearBad.push(`${c.id}/т${s.trancheNo}: ${r.date}→${r.to}`);
          }
          if (r.date.slice(0, 6) === '01.01.'){
            yJan++;
            if (!(r.events || []).some(e => e.kind === 'year')) janNoEvent.push(`${c.id}/${r.date}`);
          }
        }
      }
    }
    ok(169, yearBad.length === 0 && janNoEvent.length === 0 && yJan > 0,
       `строк листа ${yRows}, из них на 1 января ${yJan}`
       + ` · перешагнувших год ${yearBad.length}${yearBad.length ? ' — ' + yearBad.slice(0,2).join(' | ') : ''}`
       + ` · без события «граница года» ${janNoEvent.length}${janNoEvent.length ? ' — ' + janNoEvent.slice(0,2).join(' | ') : ''}`);
  }

  /* 170. «НАКОПЛЕННЫЕ» — ПО СОСТАВУ, НЕ ПО КНОПКЕ (КВ-47, идиома ADR-0109). Пара колонок
     («Накопленные» + «Нарастающим») появляется только там, где реструктуризация перенесла
     в график ранее начисленные проценты (SCHED_ARTICLES.accInterest, ADR-0093 §1), — иначе
     она пуста у всех кредитов страны ради нескольких. С разбора 16.08.2026 так живут ещё
     четыре колонки («Освоено», «Принято», «Списано», «Перенесено»), а нарастающие итоги
     каждой статьи гасятся своим переключателем в шапке БЛОКА и по умолчанию свёрнуты.
     Значит ширина листа зависит уже от двух вещей, и стеречь надо обе:
       · СОСТАВ — срез 23.07.2026 (позиции ДС-РС-2002 15.08–15.10.2026 ещё не наступили)
         против среза 20.11.2026, где «Накопленные» появляются: 16 → 17 колонок;
       · СОСТОЯНИЕ — те же срезы с разобранной статьёй.
     КВ-68 ПЕРЕВЕРНУЛА ЗНАК ЭТОЙ ПРОВЕРКИ. До неё разворот РАСШИРЯЛ лист (16 → 28, 21 → 30):
     три кнопки жались разом и складывали детали трёх блоков. Теперь разбор идёт по одной
     статье, а соседние сворачиваются до колонок-ответов, и лист от разбора СУЖАЕТСЯ. Отсюда
     новая форма пробы — не «развёрнутое больше свёрнутого», а «ни один разбор не шире
     умолчания»: ровно это обещание волна и даёт, и стеречь надо его, а не набор чисел,
     который сдвинет первая же колонка «по составу». Числа при этом тоже названы поимённо
     (широкий разбор — блок ОД: у него деталей больше всех), иначе проба пропустила бы
     сворачивание соседей до нуля — оно тоже «не шире умолчания».
     Разбор процентов у K-7 — 14 колонок: дата + 2 ответа тела + 10 процентов + 1 пени.
     «Списано» у K-7 нет НИ В ОДНОМ состоянии: у него нет списаний, и по новому правилу
     колонки быть не должно (обратную сторону — что у списанного кредита она есть — стережёт
     №173). У K-1 умолчание 14.
     Срез возвращается на TODAY: следующие проверки читают карточку. */
  {
    const arity2 = tr => { let n = 0, re = /<t[dh]\b([^>]*)>/g, mm;
      while ((mm = re.exec(tr))) n += Math.max(1, parseInt((/colspan="(\d+)"/.exec(mm[1]) || [])[1] || '1', 10));
      return n; };
    const widths = (html) => (html.match(/<table class="cgrid tiered">[\s\S]*?<\/table>/g) || []).map(tbl => {
      const trs = tbl.match(/<tr[\s\S]*?<\/tr>/g) || [];
      const w = arity2(trs[0]);
      const bad = trs.slice(2).filter(tr => arity2(tr) !== w).length;
      return { w, bad };
    });
    const c7 = CR2.db.credits.find(x => x.id === 'K-7');
    CR2.openDetail('K-7');
    const one = (c, block) => { CR2.toggleCalcDetail(block);
      const w = widths(CR2.renderTab('Расчёты', c)); CR2.toggleCalcDetail(block); return w; };
    CR2.setCardAsOf('23.07.2026');
    const narrow  = widths(CR2.renderTab('Расчёты', c7));
    const narrowD = ['od','int','pen'].map(b => one(c7, b));
    CR2.setCardAsOf('20.11.2026');
    const wideHtml = CR2.renderTab('Расчёты', c7);
    const wide  = widths(wideHtml);
    const wideD = ['od','int','pen'].map(b => one(c7, b));
    CR2.setCardAsOf(CR2.TODAY);
    const accHead = /<th[^>]*>Накопленные<\/th>/.test(wideHtml);
    const offHead = /<th[^>]*>Списано<\/th>/.test(wideHtml);
    const c1 = CR2.db.credits.find(x => x.id === 'K-1');
    CR2.openDetail('K-1');
    const plain  = widths(CR2.renderTab('Расчёты', c1));
    const plainD = ['od','int','pen'].map(b => one(c1, b));
    const all = [narrow, wide, plain].concat(narrowD, wideD, plainD).flat();
    /* «Ни один разбор не шире умолчания» — обещание волны, проверяется на всех трёх срезах
       сразу. Пары «умолчание → его разборы» держатся вместе, иначе сравнение поехало бы
       между составами. */
    const fits = [[narrow, narrowD], [wide, wideD], [plain, plainD]].every(([base, ds]) =>
      ds.every(d => d.every((x, i) => x.w <= base[i].w)));
    const w = (ws) => ws.map(x => x.w).join(',');
    ok(170, all.length > 0 && all.every(x => x.bad === 0) && fits
         && narrow.every(x => x.w === 16) && wide.every(x => x.w === 17)
         && plain.every(x => x.w === 14)
         && narrowD[0].every(x => x.w === 16) && narrowD[1].every(x => x.w === 14)
         && narrowD[2].every(x => x.w === 10)
         && wideD[1].every(x => x.w === 16)
         && accHead && !offHead,
       `K-7 до наступления накопленных ${w(narrow)} → разбор ${narrowD.map(w).join('/')} (тело/проценты/пеня)`
       + ` · после ${w(wide)} → ${wideD.map(w).join('/')}`
       + ` · K-1 ${w(plain)} → ${plainD.map(w).join('/')}`
       + ` · разбор не шире умолчания ${fits} · «Накопленные» ${accHead} · «Списано» у K-7 ${offHead}`
       + ` · строк не по шапке ${all.reduce((a,x)=>a+x.bad,0)}`);
  }

  /* 171. ПЕРЕПЛАТА К ГРАФИКУ — МИНУСОМ (КВ-50). Колонка «Просрочено» в блоке основного
     долга есть разность нарастающих («По графику» − «Погашено»), и до КВ-50 показывалась
     только её положительная сторона: у K-7 три отрезка подряд (15.03–12.05.2026) стояли
     с прочерком, хотя заёмщик шёл с опережением на 20 487,32 — из листа не читалось,
     почему при нуле платежей нет просрочки. Проверяется по модели и по разметке разом:
     сколько строк идёт с опережением, столько минусов и обязано быть в таблицах, и ни
     одна строка не имеет просрочки и опережения сразу (иначе колонка врала бы знаком). */
  {
    const tbls = html => (html.match(/<table class="cgrid[^"]*">[\s\S]*?<\/table>/g) || []);
    const r2 = v => Math.round(v * 100) / 100;
    let ahead = 0, both = 0;
    for (const c of CR2.db.credits){
      const d = CR2.derive(c);
      for (const s of (d.ledger.dateSheet || [])) for (const r of s.rows){
        const dev = r2(r.runPaidP - r.runDue);
        if (dev > 0.005 && r.penBaseP <= 0.005) ahead++;
        if (dev > 0.005 && r.penBaseP > 0.005) both++;
      }
    }
    /* МИНУС В ЛИСТЕ БЫВАЕТ ТРЁХ РОДОВ (КВ-60, КВ-65): опережение графика в «Просрочено»
       (по телу — КВ-50, по процентам — КВ-65), переплата процентов в «Остатке» процентов
       (погашено больше начисленного) и отрицательное требование позиции в «По графику»
       процентов (контракт + двузнаковое отклонение, ADR-0105).
       Считать минусы штукой против модели больше нельзя: с КВ-60 ноль печатается нулём, а
       не прочерком, и сколько минусов попало в РАЗМЕТКУ, зависит от того, какие годы
       развёрнуты. Поэтому проверяется не число, а МЕСТО: каждый минус обязан стоять в
       колонке, где он что-то значит, — и хотя бы один в листе быть обязан.
       МЕСТО СЧИТАЕТСЯ ПО БЛОКУ, а не по имени колонки (КВ-65): имена в блоках повторяются,
       и набор «Просрочено · Остаток · По графику» одним списком разрешил бы минус в «По
       графику» ПО ТЕЛУ, где он означал бы отрицательный взнос графика — сбой, а не
       состояние. Блоки режутся по классу grp, как в №175. */
    const txt = t => t.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const blocks = ths => { const out = [], starts = [];
      ths.forEach((th, i) => { if (/class="[^"]*grp/.test(th)) starts.push(i); });
      starts.forEach((st, k) => out.push([st, k + 1 < starts.length ? starts[k + 1] : ths.length]));
      return out; };
    const allowedBy = [new Set(['Просрочено']),                          // основной долг
                       new Set(['Просрочено', 'Остаток', 'По графику']), // проценты
                       new Set()];                                       // пеня — минусу взяться неоткуда
    let minus = 0, misplaced = [];
    for (const c of CR2.db.credits){
      CR2.openDetail(c.id);
      const tbl = tbls(CR2.renderTab('Расчёты', c)).find(t => /class="cgrid tiered"/.test(t));
      if (!tbl) continue;
      const hrows = (tbl.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
      const ths = ((hrows[1] || '').match(/<th[^>]*>[\s\S]*?<\/th>/g) || []);
      const lab = ths.map(txt);
      const blk = blocks(ths);
      if (blk.length !== 3){ misplaced.push(`${c.id}: блоков ${blk.length} вместо трёх`); continue; }
      const blockOf = i => blk.findIndex(([a, b]) => i >= a && i < b);
      const body = (tbl.match(/<tbody>[\s\S]*?<\/tbody>/) || [''])[0];
      for (const tr of (body.match(/<tr[\s\S]*?<\/tr>/g) || [])){
        const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).slice(1);
        if (cells.length !== lab.length) continue;          // строка-заглушка «нет данных»
        cells.forEach((td, i) => { if (!/−/.test(txt(td))) return;
          minus++;
          const b = blockOf(i);
          if (b < 0 || !allowedBy[b].has(lab[i]))
            misplaced.push(`${c.id}/${['тело','проценты','пеня'][b] || '?'}·${lab[i]}`); });
      }
    }
    ok(171, ahead > 0 && both === 0 && minus > 0 && !misplaced.length,
       `строк с опережением графика ${ahead} · минусов в разметке ${minus}`
       + ` · не в своей колонке ${misplaced.length}${misplaced.length ? ' (' + misplaced.slice(0,3).join(', ') + ')' : ''}`
       + ` · строк с просрочкой и опережением сразу ${both}`);
  }

  /* 172. КЭШИ РАСЧЁТА НЕ ВРУТ (КВ-52). Ради скорости реестра появились две памяти:
     разбор дд.мм.гггг (`_pdMemo`) и порядок записей условий (`condSorted`). Обе —
     память ВЫЧИСЛЕНИЯ, а не производного состояния: запрет кэшировать derive (Р-11)
     они не нарушают. Две вещи могут сломаться незаметно, поэтому стерегутся здесь:
       · добавленная запись обязана менять комплект — иначе устаревание по длине
         массива не работает и «Изменить условия» перестанет доходить до расчёта;
       · pd() отдаёт ОБЩИЙ Date, и мутация его на месте испортила бы все даты разом —
         в исходнике не должно быть ни одного `pd(...).setXxx(`, сдвиг делается копией. */
  {
    const c = CR2.db.credits.find(x => ((x.tranches || [])[0] || {}).conditionRecords);
    const t = c.tranches[0];
    const p = t.conditionRecords[0].param;                   // параметр берём у самой записи
    const was = CR2.conditionsAt(t, '31.12.2030')[p];
    t.conditionRecords.push(CR2.mkConditionRecord({
      param:p, value:'__проверка-172', effectiveFrom:'01.01.2030',
      basis:{ kind:'agreement', ref:'ПРОВЕРКА-172', label:'', date:'01.01.2030' } }));
    const after = CR2.conditionsAt(t, '31.12.2030')[p];
    t.conditionRecords.pop();
    const back = CR2.conditionsAt(t, '31.12.2030')[p];
    const mutates = (readFileSync(HTML, 'utf8').match(/pd\([^()]*\)\.set[A-Z]/g) || []);
    ok(172, after === '__проверка-172' && String(back) === String(was) && mutates.length === 0,
       `${c.id}/${p}: ${was} → после записи ${after} → после отката ${back}`
       + `${mutates.length ? ', мутация общего Date: ' + mutates.join(' | ') : ''}`);
  }

  /* 173. СПИСАНО — ФАКТ РАСЧЁТА, А НЕ ПОДПИСЬ НА КРЕДИТЕ (КВ-53). Списание жило одним
     полем `closure.reason='Списан'`: ни даты в расчёте, ни суммы, ни транша, и лист о нём
     молчал. Теперь у транша есть `writeOffs[]`, у листа — пара колонок. Стережём три вещи,
     каждая из которых ломается молча:
       · у каждого «Списан» записи есть, их суммы равны статьям свода, и ДОЛГ ПОСЛЕ НИХ
         НОЛЬ — с КВ-62 («да гасит») списание снимает тело с баланса, а с КВ-63 («решение
         списывает весь долг», владелец 16.08.2026) — и остальные пять статей: остаток,
         просрочка и d.debtBalance обязаны упасть, а не остаться прежними. Сторожим обе
         половины: величина названа отдельной строкой свода И вычтена из остатка. Одной
         первой мало — правило КР-12 её тоже давало, не гася ничего;
       · строка в дату решения в листе ЕСТЬ — а она приходится ровно на срез (срез
         закрытого кредита — дата закрытия), и до правки такие строки пропадали;
       · перенос по ДС в «Списано» НЕ попадает: у K-7 тело ушло из транша №1 и пришло в
         №2 и №3, списано при этом ноль, а разметка обязана назвать оба конца — с КВ-55
         своей парой колонок «Перенесено · Принято», а не второй строкой чужой ячейки.
     С разбора 16.08.2026 колонка «Списано» живёт ПО СОСТАВУ, и это проверяется в обе
     стороны: у трёх списанных кредитов шапка её называет, у K-7 (списано ноль) её быть
     не должно — иначе правило работает только на словах. */
  {
    const r2 = v => Math.round(v * 100) / 100;
    const woBad = [], off = CR2.db.credits.filter(c => (c.closure || {}).reason === 'Списан');
    for (const c of off){
      const d = CR2.derive(c);
      const recs = (c.tranches || []).flatMap(t => t.writeOffs || []);
      const sum  = r2(recs.reduce((a, w) => a + (w.amount || 0), 0));
      if (!recs.length){ woBad.push(`${c.id}: записей о списании нет`); continue; }
      if (Math.abs(sum - d.debt.principal.written) > 0.02)
        woBad.push(`${c.id}: списано ${sum} против статьи свода ${d.debt.principal.written}`);
      if (d.debt.principal.bal > 0.005)
        woBad.push(`${c.id}: тело ${d.debt.principal.bal} после полного списания ${sum}`);
      if (d.debt.principal.overdue > 0.005)
        woBad.push(`${c.id}: просрочка тела ${d.debt.principal.overdue} после списания`);
      /* КВ-63: решение списывает ВЕСЬ долг. Сторожим то же самое по каждой статье и
         вдобавок ИТОГ — d.debtBalance, число, которое кредит предъявляет наружу: пока
         оно ненулевое, «безнадёжный» кредит продолжает чего-то требовать. */
      for (const [k, name] of [['interest','проценты'],['penalty','пеня'],['fees','сборы'],
                                ['accInterest','накопл.%'],['accPenalty','накопл.пеня']]){
        const a = d.debt[k];
        if (a.bal > 0.005)     woBad.push(`${c.id}: ${name} остаток ${a.bal} после списания`);
        if (a.overdue > 0.005) woBad.push(`${c.id}: ${name} просрочка ${a.overdue} после списания`);
        const recSum = r2(recs.reduce((s, w) => s + (((w.articles||{})[k])||0), 0));
        if (Math.abs(recSum - (a.written || 0)) > 0.02)
          woBad.push(`${c.id}: ${name} списано по записям ${recSum} против свода ${a.written}`);
      }
      if (d.debtBalance > 0.005)
        woBad.push(`${c.id}: долг всего ${d.debtBalance} после списания всего долга`);
      const wTot = r2(sum + ['interest','penalty','fees','accInterest','accPenalty']
        .reduce((a2, k) => a2 + (d.debt[k].written || 0), 0));
      if (Math.abs(wTot - ((d.debt.written || {}).total || 0)) > 0.02)
        woBad.push(`${c.id}: итог списания ${(d.debt.written||{}).total} против ${wTot} по статьям`);
      /* лист обязан согласиться со сводом: последняя строка каждого раздела несёт
         освоено + принято − перенесено − погашено − СПИСАНО, и сумма по траншам — тело */
      const balSheet = (d.ledger.dateSheet || []).reduce((a2, s2) => { const e = s2.rows[s2.rows.length - 1];
        return r2(a2 + Math.max(0, r2(e.runDisb + e.runIn - e.runOut - e.runPaidP - e.runOff))); }, 0);
      if (Math.abs(balSheet - d.debt.principal.bal) > 0.02)
        woBad.push(`${c.id}: лист даёт остаток ${balSheet} против свода ${d.debt.principal.bal}`);
      const rows = (d.ledger.dateSheet || []).flatMap(s => s.rows);
      const hit  = rows.filter(r => r.offAmt > 0.005);
      if (!hit.length) woBad.push(`${c.id}: в листе нет строки со списанием (дата ${c.closure.date})`);
      else if (hit.some(r => r.date !== c.closure.date))
        woBad.push(`${c.id}: списание в листе не в дату решения — ${hit.map(r => r.date).join(',')}`);
      for (const s of (d.ledger.dateSheet || [])){
        let run = 0;
        for (const r of s.rows){ run = r2(run + (r.offAmt || 0));
          if (Math.abs(run - r.runOff) > 0.02) woBad.push(`${c.id}/т${s.trancheNo} ${r.date}: нарастающее ${r.runOff} против ${run}`); }
      }
    }
    const c7 = CR2.db.credits.find(x => x.id === 'K-7');
    const d7 = CR2.derive(c7);
    const rows7 = (d7.ledger.dateSheet || []).flatMap(s => s.rows);
    const moved7 = r2(rows7.reduce((a, r) => a + (r.movedOut || 0), 0));
    const got7   = r2(rows7.reduce((a, r) => a + (r.movedIn  || 0), 0));
    const off7   = r2(rows7.reduce((a, r) => a + (r.offAmt   || 0), 0));
    CR2.openDetail('K-7');
    const h7 = CR2.renderTab('Расчёты', c7);
    const heads = (h7.match(/<th[^>]*>Списано<\/th>/g) || []).length;   // у K-7 обязан быть ноль
    const mvH   = /<th[^>]*>Перенесено<\/th>/.test(h7) && /<th[^>]*>Принято<\/th>/.test(h7);
    let offHeads = 0, offRows = 0;
    for (const c of off){
      CR2.openDetail(c.id);
      const h = CR2.renderTab('Расчёты', c);
      /* ТРИ КОЛОНКИ «СПИСАНО», А НЕ ОДНА (КВ-63): решение снимает весь долг, и каждая
         статья обязана назвать своё списание В СВОЁМ блоке — иначе «Остаток» процентов
         падает до нуля молча, и арифметика блока не сходится ни глазом, ни на бумаге. */
      const nOff = (h.match(/<th[^>]*>Списано<\/th>/g) || []).length;
      if (nOff === 3) offHeads++;
      else woBad.push(`${c.id}: колонок «Списано» в шапке ${nOff}, а статей списано 3`);
      /* СТРОКА СВОДА «Списано за баланс» (КВ-62/КВ-63). Раз остаток списание гасит, число
         обязано остаться названным — иначе долг уходит из свода бесследно и сойтись с
         решением Правления нечем. Строка-исключение того же рода, что «Спорная пеня».
         Печатает она ИТОГ по шести статьям, и подпись обязана его разложить. */
      if (/Списано за баланс/.test(h) && /основной долг/.test(h) && /проценты \d/.test(h)) offRows++;
      else woBad.push(`${c.id}: долг списан, а строки свода «Списано за баланс» с разбором по статьям нет`);
    }
    /* Нарастающие переноса (КВ-56) сверяются с моделью, а не сами с собой: последняя строка
       раздела обязана показать ровно transferredOut/transferredIn транша на её дату —
       иначе колонка живёт своей арифметикой, и разность нарастающих перестаёт быть вкладом
       переноса в «Остаток». Считаются они ВРОЗЬ: нетто спрятало бы возврат тела обратно. */
    for (const s of (d7.ledger.dateSheet || [])){
      const t = c7.tranches.find(x => x.no === s.trancheNo), lr = s.rows[s.rows.length - 1];
      if (!t || !lr) continue;
      const wantOut = CR2.transferredOut(t, lr.date), wantIn = CR2.transferredIn(t, lr.date);
      if (Math.abs((lr.runOut || 0) - wantOut) > 0.02 || Math.abs((lr.runIn || 0) - wantIn) > 0.02)
        woBad.push(`K-7/т${s.trancheNo}: нарастающий перенос ${lr.runOut}/${lr.runIn}`
                   + ` против ${wantOut}/${wantIn}`);
    }
    ok(173, woBad.length === 0 && off.length === 3 && offHeads === off.length
            && offRows === off.length && heads === 0
            && moved7 === 360000 && got7 === 360000 && off7 === 0 && mvH,
       `списанных кредитов ${off.length}, расхождений ${woBad.length}`
       + `${woBad.length ? ' — ' + woBad.slice(0, 3).join(' | ') : ''}`
       + ` · K-7: перенесено ${moved7}, принято ${got7}, списано ${off7}`
       + ` · «Списано» в шапке у ${offHeads} из ${off.length} списанных и ${heads} раз(а) у K-7`
       + ` · строка свода «Списано за баланс» у ${offRows} из ${off.length}`
       + ` · пара переноса в шапке ${mvH}`);
  }

  /* 174. БАЗА ОТРЕЗКА ЗНАЕТ ПРО ПЕРЕНОС, ГРАФИК ДОНОРА ПЕРЕСОБИРАЕТСЯ (КВ-54). Перенос по
     ДС двигает тело между траншами, но начисление про это не знало: у K-7 транш №1 после
     01.05.2026 продолжал капать 9 % на все 360 000, транш №2 капал 5 % на те же ушедшие
     200 000 с 15.06.2026 — тело начислялось ДВАЖДЫ, а между 01.05 и 15.06 не начислялось
     ни у кого. Причина одна на оба конца: база бралась у графика, а график донора после ДС
     не трогали вовсе. Стережём четыре следствия правки:
       · БАЗА КАЖДОГО ОТРЕЗКА РАВНА ИР-3 на его дату — по всему сиду, а не на демо-кредите.
         Это то самое тождество, ради которого лист вообще существует: карточка и расчёт
         обязаны говорить одно. Порог 0,02 — копеечное округление отрезков;
       · НУМЕРАЦИЯ ПОЗИЦИЙ СПЛОШНАЯ во всех версиях всех траншей. Ключ строки леджера —
         транш + номер, и пересборка, начавшая счёт с единицы, молча перевесила бы
         разнесённые платежи на чужие позиции (сшивка stitchSchedule);
       · У ДОНОРА ЕСТЬ ДС-ВЕРСИЯ и хвост её кончается вместе с остатком: до правки график
         транша №1 тянулся до 12.01.2029 и требовал тело, которого на транше нет;
       · КНОПКА «СФОРМИРОВАТЬ ГРАФИК» СЕРЕДИНЫ СРОКА НЕ СТИРАЕТ НАСТУПИВШЕЕ — та же сшивка
         на второй двери, иначе дефект переезжает из ДС в кнопку. */
  {
    const db = CR.seedDb(), bad = [];
    let nb = 0;
    for (const c of db.credits){
      const d = CR.derive(c);
      for (const s of (d.ledger.dateSheet || [])){
        const t = (c.tranches || []).find(x => x.no === s.trancheNo);
        for (const r of s.rows){
          if (r.base == null) continue;
          nb++;
          const b = CR.trancheBalanceAt(c, t, r.date);
          if (Math.abs(r.base - b) > 0.02)
            bad.push(`${c.id}/т${s.trancheNo} ${r.date}: база ${r.base} против ИР-3 ${b}`);
        }
      }
      for (const t of (c.tranches || [])) for (const s of (t.schedules || [])){
        const nos = (s.rows || []).map(x => x.no);
        if (nos.some((n, i) => n !== i + 1))
          bad.push(`${c.id}/т${t.no} v${s.ver}: нумерация ${nos.slice(0, 8).join(',')}`);
      }
    }
    const k7 = db.credits.find(x => x.id === 'K-7'), src7 = k7.tranches[0];
    const dsVer = (src7.schedules || []).filter(s => (s.by || {}).kind === 'ДС');
    const rows7 = CR.trancheScheduleRows(src7);
    const last7 = rows7.length ? rows7[rows7.length - 1].date : '';
    const sheet = CR.derive(k7).ledger.dateSheet || [];
    const segOf = no => (sheet.find(s => s.trancheNo === no) || { rows: [] }).rows;
    const baseAt = (no, date) => (segOf(no).find(r => r.date === date) || {}).base;
    const was9 = baseAt(src7.no, '12.04.2026'), now9 = baseAt(src7.no, '01.05.2026');
    const gotIn = (segOf(k7.tranches[1].no).filter(r => r.base != null)[0] || {}).date;
    const k1 = db.credits.find(x => x.id === 'K-1'), t1 = k1.tranches[0];
    const was = CR.trancheScheduleRows(t1), FROM = was[3].date;
    const past = was.filter(r => CR.pd(r.date) < CR.pd(FROM));
    const nv = CR.generateSchedule(k1, t1.no, { from: FROM, basis:{ kind:'заявление', ref:'проба-174' } });
    const kept = JSON.stringify((nv.rows || []).slice(0, past.length).map(r => r.no + ':' + r.date))
               === JSON.stringify(past.map(r => r.no + ':' + r.date));
    ok(174, bad.length === 0 && nb > 200
            && dsVer.length > 0 && rows7.length > 0 && CR.pd(last7) < CR.pd('01.01.2027')
            && Math.abs(CR.trancheBalanceAt(k7, src7, CR.TODAY)) < 0.005
            && Math.abs(was9 - 360000) < 0.02 && Math.abs(now9 - 160000) < 0.02
            && gotIn === '01.05.2026'
            && past.length >= 3 && kept && (nv.rows || []).length > past.length,
       `отрезков с базой ${nb}, расхождений ${bad.length}`
       + `${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`
       + ` · K-7 т1: база 12.04 ${was9} → 01.05 ${now9}, ДС-версий ${dsVer.length},`
       + ` хвост до ${last7} · приёмник начислил с ${gotIn}`
       + ` · кнопка от ${FROM}: сохранено ${past.length}, стало ${(nv.rows || []).length}, совпало ${kept}`);
  }

  /* 175. ИТОГОВЫЕ СТРОКИ ЛИСТА «ПО ДАТАМ» — ПО КОЛОНКАМ, ДВУМЯ ПРАВИЛАМИ (КВ-58).
     Год и «Итого по траншу» печатали два числа из тринадцати, остальное закрывал colspan.
     Теперь у каждой колонки свой итог, и правил ровно два — их и стережём ПО МОДЕЛИ, а не
     по разметке:
       ПОТОК складывается за период — «По графику», «Погашено», «Начислено», «Пеня»;
       СОСТОЯНИЕ берётся на конец — у ПОСЛЕДНЕЙ строки года, без оговорок (КВ-59): остаток
       тела = освоено + принято − перенесено − погашено − списано нарастающим (пятое
       слагаемое пришло с КВ-62), просрочка тела =
       потребовано − погашено, нарастающие — значением последней строки. Прежде состояние
       брали у последнего ОТРЕЗКА, и строка среза (КВ-53) с её платежом в итог не попадала —
       год закрытого кредита показывал долг ДО последнего платежа. Здесь же стережётся
       тождество, на котором вывод держится: у строк с отрезком база отрезка обязана
       совпадать с остатком из нарастающих (иначе колонка перестала быть базой начисления).
     Плюс две границы: colspan в итоговых строках не возвращается (иначе едет вся сетка —
     класс ошибки, который №164 ловил арностью, но не ловил «число не под своей шапкой»),
     а «Ставка» и «За день» молчат: это параметр отрезка, а не итог. Блоки статей режутся
     по классу grp — тем же способом, каким их рисует шапка, поэтому «Погашено» в трёх
     статьях не путается. Подпись кнопки деталей проверяется здесь же. */
  {
    const r2 = v => Math.round(v * 100) / 100;
    /* U+2212 → минус машинный (КВ-65). Лист печатает типографский знак, и parseFloat отдавал
       на нём NaN: сравнение с NaN всегда ложно, значит отрицательный итог проходил молча —
       ровно тот случай, ради которого «По графику» по процентам и заведена (у транша с
       переносом требование позиции уходит в минус). */
    const numOf = s => { const t = s.replace(/<[^>]*>/g, '').replace(/[\s  ]/g, '').replace(',', '.').replace(/−/g, '-');
      return t === '—' || t === '' ? null : parseFloat(t); };
    const cellsOf = tr => (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [])
      .map(t => t.replace(/^<td[^>]*>/, '').replace(/<\/td>$/, ''));
    const blocks = ths => { const out = [], starts = [];
      ths.forEach((th, i) => { if (/class="[^"]*grp/.test(th)) starts.push(i); });
      starts.forEach((st, k) => out.push([st, k + 1 < starts.length ? starts[k + 1] : ths.length]));
      return out; };
    let bad = [], nYears = 0, nSheets = 0;
    for (const c of CR2.db.credits){
      CR2.openDetail(c.id);
      const html = CR2.renderTab('Расчёты', c);
      const tbl = (html.match(/<table class="cgrid tiered">[\s\S]*?<\/table>/g) || [])[0];
      const dv = CR2.derive(c);
      const sheets = (dv.ledger.dateSheet || []);
      if (!tbl || !sheets.length) continue;
      /* КОНЕЦ ЛИСТА = СВОД ДОЛГА КАРТОЧКИ (КВ-59) — независимый источник, а не пересказ той
         же формулы: состояние последней строки каждого транша, сложенное по кредиту, обязано
         совпасть с debt.principal (остаток и просрочка). Это и есть смысл правила «состояние
         на конец»; разойдясь, лист начинает спорить с карточкой. */
      let balAll = 0, ovdAll = 0;
      for (const sh of sheets){ const e = sh.rows[sh.rows.length - 1];
        balAll = r2(balAll + Math.max(0, r2(e.runDisb + e.runIn - e.runOut - e.runPaidP - e.runOff)));
        ovdAll = r2(ovdAll + (e.endOvdP != null ? e.endOvdP : e.penBaseP)); }
      if (Math.abs(balAll - dv.debt.principal.bal) > 0.02)
        bad.push(`${c.id}: остаток конца листа ${balAll} против свода ${dv.debt.principal.bal}`);
      if (Math.abs(ovdAll - dv.debt.principal.overdue) > 0.02)
        bad.push(`${c.id}: просрочка конца листа ${ovdAll} против свода ${dv.debt.principal.overdue}`);
      if (!/детали<\/button>/.test(tbl)) bad.push(`${c.id}: кнопка деталей не зовётся «детали»`);
      if (/нарастающим<\/button>/.test(tbl)) bad.push(`${c.id}: на кнопке вернулось «нарастающим»`);
      const hrows = (tbl.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
      const ths = (hrows[1] || '').match(/<th[^>]*>[\s\S]*?<\/th>/g) || [];
      const lab = ths.map(t => t.replace(/<[^>]*>/g, '').trim());
      const [od, int, pen] = blocks(ths);
      if (!od || !int || !pen){ bad.push(`${c.id}: блоки статей не режутся по grp`); continue; }
      const idx = (blk, name) => { const i = lab.slice(blk[0], blk[1]).indexOf(name);
        return i < 0 ? -1 : blk[0] + i; };
      const s = sheets[0];                     // лист первого транша: годы, затем его итог
      nSheets++;
      const yrows = tbl.match(/<tr class="gyear[\s\S]*?<\/tr>/g) || [];
      const years = [...new Set(s.rows.map(r => +r.date.slice(6, 10)))].sort((a, b) => a - b);
      for (let k = 0; k < Math.min(yrows.length, years.length); k++){
        const rs = s.rows.filter(r => +r.date.slice(6, 10) === years[k]);
        const cs = cellsOf(yrows[k]).slice(1);
        if (/colspan=/.test(yrows[k])) bad.push(`${c.id}: в строке года вернулся colspan`);
        if (cs.length !== lab.length){ bad.push(`${c.id}/${years[k]}: ячеек ${cs.length} против ${lab.length}`); continue; }
        nYears++;
        const at = i => i < 0 ? null : numOf(cs[i]);
        /* СТРАЖ ПО МОДУЛЮ, А НЕ ПО ЗНАКУ (КВ-65). `want > 0.005` пропускал год, чья сумма
           вышла отрицательной, — а с колонкой «По графику» по процентам такой год возможен:
           требование позиции есть контракт + отклонение, и второе слагаемое двузнаково. */
        const flow = (i, want, name) => { if (Math.abs(want) > 0.005 && Math.abs((at(i) || 0) - want) > 0.02)
          bad.push(`${c.id}/${years[k]}: ${name} ${at(i)} против ${want}`); };
        flow(idx(od, 'По графику'), r2(rs.reduce((a, r) => a + (r.dueP || 0), 0)), '«По графику»');
        flow(idx(od, 'Погашено'),   r2(rs.reduce((a, r) => a + (r.paid.principal || 0), 0)), '«Погашено» тела');
        flow(idx(int, 'По графику'), r2(rs.reduce((a, r) => a + (r.dueI || 0), 0)), '«По графику» процентов');
        flow(idx(int, 'Погашено'),  r2(rs.reduce((a, r) => a + (r.paid.interest || 0), 0)), '«Погашено» процентов');
        flow(idx(int, 'Начислено'), r2(rs.reduce((a, r) => a + (r.accrued || 0), 0)), '«Начислено»');
        flow(idx(pen, 'Начислено'), r2(rs.reduce((a, r) => a + (r.penalty || 0), 0)), '«Пеня начислено»');
        /* СПИСАНО — ПОТОК В КАЖДОМ БЛОКЕ (КВ-63). Итог года складывает его как всякий поток,
           и складывать он обязан ровно строки своего года: решений о списании бывает больше
           одного, и просмотренное второе видно только по разъехавшемуся итогу. */
        flow(idx(od,  'Списано'), r2(rs.reduce((a, r) => a + (r.offAmt || 0), 0)), '«Списано» тела');
        flow(idx(int, 'Списано'), r2(rs.reduce((a, r) => a + (r.offInt || 0), 0)), '«Списано» процентов');
        flow(idx(pen, 'Списано'), r2(rs.reduce((a, r) => a + (r.offPen || 0), 0)), '«Списано» пени');
        const end  = rs[rs.length - 1];
        const bal  = r2(Math.max(0, end.runDisb + end.runIn - end.runOut - end.runPaidP - end.runOff));
        if (Math.abs((at(idx(od, 'Остаток')) || 0) - bal) > 0.02)
          bad.push(`${c.id}/${years[k]}: «Остаток» ${at(idx(od, 'Остаток'))} против ${bal} на конец года`);
        const ovd = end.endOvdP != null ? end.endOvdP : end.penBaseP;
        if (ovd > 0.005 && Math.abs((at(idx(od, 'Просрочено')) || 0) - ovd) > 0.02)
          bad.push(`${c.id}/${years[k]}: «Просрочено» ${at(idx(od, 'Просрочено'))} против ${ovd} на конец года`);
        for (const r of rs)                       // тождество: база отрезка = остаток из нарастающих
          if (r.base != null && Math.abs(r.base - r2(Math.max(0, r.runDisb + r.runIn - r.runOut - r.runPaidP - r.runOff))) > 0.02)
            bad.push(`${c.id}/${r.date}: база отрезка ${r.base} разошлась с остатком из нарастающих`);
        const iRate = idx(int, 'Ставка'), iDay = idx(pen, 'За день');
        if (iRate >= 0 && cs[iRate].replace(/<[^>]*>/g, '').trim() !== '')
          bad.push(`${c.id}/${years[k]}: «Ставка» печатает итог, а это параметр отрезка`);
        if (iDay >= 0 && cs[iDay].replace(/<[^>]*>/g, '').trim() !== '')
          bad.push(`${c.id}/${years[k]}: «За день» печатает итог, а это параметр отрезка`);
      }
      const trow = (tbl.match(/<tr class="gtot"[\s\S]*?<\/tr>/) || [''])[0];
      const tc = cellsOf(trow).slice(1);
      if (!trow) bad.push(`${c.id}: строки «Итого по траншу» нет`);
      else if (/colspan=/.test(trow)) bad.push(`${c.id}: в «Итого по траншу» вернулся colspan`);
      else if (tc.length !== lab.length) bad.push(`${c.id}: в «Итого по траншу» ячеек ${tc.length} против ${lab.length}`);
      else {
        const gi = numOf(tc[idx(int, 'Начислено')]) || 0, gp = numOf(tc[idx(pen, 'Начислено')]) || 0;
        if (Math.abs(gi - s.sumInterest) > 0.02)
          bad.push(`${c.id}: итог транша начислено ${gi} против ${s.sumInterest}`);
        if (s.sumPenalty > 0.005 && Math.abs(gp - s.sumPenalty) > 0.02)
          bad.push(`${c.id}: итог транша пеня ${gp} против ${s.sumPenalty}`);
      }
    }
    /* Нарастающее в итоге — состояние на конец, а не сумма. Проверяется на РАЗОБРАННОМ теле:
       по умолчанию колонки нет вовсе (КВ-57). У K-1 первая «Нарастающим» блока тела — пара
       «По графику», освоения в его листе нет. Разбор тела сворачивает проценты и пеню до
       колонок-ответов (КВ-68) — на эту пробу это не влияет: она ищет ПЕРВУЮ «Нарастающим», а
       она в блоке тела, и сверяет её позицию с ячейкой годовой строки, которая собирается тем
       же массивом описателей. */
    const kd = CR2.db.credits.find(x => x.id === 'K-1');
    CR2.openDetail('K-1');
    CR2.toggleCalcDetail('od');
    const opened = (CR2.renderTab('Расчёты', kd).match(/<table class="cgrid tiered">[\s\S]*?<\/table>/g) || [''])[0];
    CR2.toggleCalcDetail('od');
    const oths = ((opened.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0].match(/<tr[\s\S]*?<\/tr>/g) || ['', ''])[1] || '';
    const olab = (oths.match(/<th[^>]*>[\s\S]*?<\/th>/g) || []).map(t => t.replace(/<[^>]*>/g, '').trim());
    const iRun = olab.indexOf('Нарастающим');
    const ycs = ((opened.match(/<tr class="gyear[\s\S]*?<\/tr>/) || [''])[0].match(/<td[^>]*>[\s\S]*?<\/td>/g) || [])
      .slice(1).map(t => t.replace(/^<td[^>]*>/, '').replace(/<\/td>$/, ''));
    const sh1 = (CR2.derive(kd).ledger.dateSheet || [])[0] || { rows: [] };
    const y1 = sh1.rows.length ? +sh1.rows[0].date.slice(6, 10) : 0;
    const lastY = [...sh1.rows.filter(r => +r.date.slice(6, 10) === y1)].pop() || {};
    const runGot = (iRun >= 0 && ycs.length === olab.length) ? numOf(ycs[iRun]) : null;
    const runWant = lastY.runDue != null ? lastY.runDue : null;
    if (runGot != null && runWant != null && Math.abs(runGot - runWant) > 0.02)
      bad.push(`K-1: нарастающее в итоге года ${runGot} против ${runWant} последней строки`);
    ok(175, bad.length === 0 && nYears > 40 && nSheets > 40 && runGot != null,
       `итоговых строк года сверено ${nYears} на ${nSheets} листах · нарастающее года ${runGot}`
       + ` · нарушений ${bad.length}${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`);
  }

  /* 176. «ПО ГРАФИКУ» ПО ПРОЦЕНТАМ — ТРЕБОВАНИЕ ГРАФИКА, А НЕ ПЕРЕСКАЗ НАЧИСЛЕНИЯ (КВ-65).
     До этой волны блок процентов показывал одно «Начислено» (сумму отрезков), и «Просрочено»
     справа было числом ниоткуда — сверить его на экране было не с чем. Колонка берёт
     `interestDue` позиций, наступивших к дате: ровно от неё считается база пени и ровно она
     стоит в акте сверки. Стережётся четырьмя сторонами, каждая ловит свой класс поломки:
       (1) сумма колонки по разделу равна сумме `interestDue` наступивших позиций транша —
           ловит потерю позиции при сборке dueIByDate (первым кандидатом был фильтр по знаку:
           у K-7 т1 позиция 01.06.2026 несёт −436,70 = контракт 1 223,01 + отклонение
           −1 659,71 после переноса тела, и `> 0.005` терял её молча);
       (2) `runDueI` последней строки равен той же сумме — ловит разъезд нарастающего с
           разовым (строка среза копит своим кодом, ADR-0121);
       (3) по кредиту Σ`dueI` − Σ`interestCharged` == Σ`interestFrozen` — единственное
           расхождение колонки со сводом «К погашению» законно и названо на экране строкой
           «Приостановлено решением суда» (K-3, K-C12, K-C13); всякое другое — поломка;
       (4) отрицательная клетка К-7 доходит до РАЗМЕТКИ минусом, а не прочерком: `num()`
           отдал бы «—» всему, что ≤ 0,005, и год перестал бы складываться глазом.
     Пятой стороной идёт равенство Σ`dueI` == `ledgerInterest`, и оно СВОЙСТВО СИДА, а не
     тождество: ledInt складывает `interestAccrued` (база + отклонение), колонка —
     `interestDue` (контракт + отклонение), а база расходится с контрактом на графиках с
     льготным периодом и распределением отложенных процентов. Таких графиков в сиде сегодня
     нет, поэтому расхождение считается регрессом и валит проверку. Когда такой график в сиде
     появится, счётчик `drift` назовёт разделы поимённо — и правкой будет вынести их из-под
     равенства, а не ослабить остальные четыре стороны. */
  {
    const r2 = v => Math.round(v * 100) / 100;
    let bad = [], nSh = 0, nCred = 0, drift = [];
    for (const c of CR2.db.credits){
      const d = CR2.derive(c);
      const sheets = (d.ledger.dateSheet || []);
      if (!sheets.length) continue;
      nCred++;
      let dueAll = 0, chargedAll = 0, frozenAll = 0;
      for (const s of sheets){
        nSh++;
        const sumCells = r2(s.rows.reduce((a, r) => a + (r.dueI || 0), 0));
        const led = r2(d.ledger.rows.filter(r => r.trancheNo === s.trancheNo)
                        .reduce((a, r) => a + (r.interestDue || 0), 0));
        if (Math.abs(sumCells - led) > 0.02)
          bad.push(`${c.id}/т${s.trancheNo}: сумма колонки ${sumCells} против ${led} по позициям`);
        if (Math.abs(r2(s.sumDueI) - sumCells) > 0.02)
          bad.push(`${c.id}/т${s.trancheNo}: свод раздела ${s.sumDueI} против ${sumCells} по строкам`);
        const last = s.rows[s.rows.length - 1];
        if (Math.abs((last.runDueI || 0) - sumCells) > 0.02)
          bad.push(`${c.id}/т${s.trancheNo}: нарастающее конца ${last.runDueI} против ${sumCells}`);
        if (Math.abs(sumCells - s.ledgerInterest) > 0.02)
          drift.push(`${c.id}/т${s.trancheNo}: ${sumCells} против ${s.ledgerInterest}`);
        dueAll = r2(dueAll + sumCells);
      }
      for (const r of d.ledger.rows){
        chargedAll = r2(chargedAll + (r.interestCharged || 0));
        frozenAll  = r2(frozenAll  + (r.interestFrozen  || 0));
      }
      if (Math.abs(r2(dueAll - chargedAll) - frozenAll) > 0.02)
        bad.push(`${c.id}: требование ${dueAll} − к погашению ${chargedAll} ≠ приостановлено ${frozenAll}`);
    }
    /* Отрицательная клетка — по разметке, а не по модели: минус живёт в ячейке `dueICell`,
       и молча вернуть его к `num()` модель не заметит. Год K-7 развёрнут принудительно —
       по умолчанию открыт текущий, а спорная позиция стоит в 2026-м. */
    const c7 = CR2.db.credits.find(x => x.id === 'K-7');
    CR2.openDetail('K-7');
    const negRow = ((CR2.derive(c7).ledger.dateSheet || [])[0] || { rows: [] })
      .rows.find(r => (r.dueI || 0) < -0.005);
    /* Первый рендер прогревает ключ развёрнутых годов (calcYearsKey): выставить набор до
       него нельзя — следующий же рендер сбросит его на умолчание своего кредита. */
    CR2.renderTab('Расчёты', c7);
    try { CR2.setCalcYears([2026]); } catch(e){}
    const tbl7 = (CR2.renderTab('Расчёты', c7).match(/<table class="cgrid tiered">[\s\S]*?<\/table>/g) || [''])[0];
    const rowHtml = negRow
      ? (tbl7.match(new RegExp(`<tr[^>]*>(?:(?!</tr>)[\\s\\S])*?${negRow.date.replace(/\./g, '\\.')}[\\s\\S]*?</tr>`)) || [''])[0]
      : '';
    const negShown = !!negRow && /−/.test(rowHtml.replace(/<[^>]*>/g, ' '));
    if (negRow && !negShown)
      bad.push(`K-7/${negRow.date}: требование ${negRow.dueI} напечатано без минуса`);
    ok(176, bad.length === 0 && drift.length === 0 && nSh > 40 && nCred > 20 && !!negRow && negShown,
       `разделов с «По графику» ${nSh} на ${nCred} кредитах`
       + ` · отрицательная позиция ${negRow ? negRow.date + ' ' + negRow.dueI + (negShown ? ' минусом' : ' БЕЗ минуса') : 'не найдена'}`
       + ` · расхождений с начисленным по позициям ${drift.length}${drift.length ? ' — ' + drift.slice(0, 2).join(' | ') : ''}`
       + ` · нарушений ${bad.length}${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`);
  }

  /* 177. НОМЕР ТРАНША — ТОЛЬКО ТАМ, ГДЕ ЕСТЬ ВЫБОР (КВ-70, решение владельца 17.08.2026).
     У 56 кредитов сида транш ровно один, и экран печатал «транш №1» на каждой вкладке:
     номер, который ничего не различает, читается как признак и заставляет искать транш
     №2. Гейт один — `multiTr(c)`, а не смена семантики `scopeTranche` (тот и дальше
     отдаёт единственный транш, иначе одиночные кредиты уехали бы в агрегатную ветку).
     Стережётся с четырёх сторон, каждая ловит свой класс поломки:
       (1) у одиночного кредита номер не доходит до РАЗМЕТКИ — проверяется по сырому
           html, а не по тексту: подпись у иконки закрытия транша и заголовки секций
           живут в атрибутах, и очистка тегов спрятала бы их возврат;
       (2) колонки-ключа «Транш» у одиночного нет ни на одной вкладке — она снята
           (решение владельца), а не оставлена с одним значением; вместе с ней правились
           colspan итогов и строк-раскрытий, и лишний `<th>` тут же разъедет их;
       (3) положительный контроль: у K-1/K-7/K-C40/K-C41 (2–3 транша) и номер, и колонка
           на месте — без него гейт, всегда возвращающий false, прошёл бы проверку;
       (4) модалки: при одном транше поле-селект спрятано, но `id` жив скрытым input'ом
           с настоящим номером — submit-обработчики читают его как читали. Проверяются
           обе стороны: у одиночного hidden без подписи «Транш», у многотраншевого select.
     ЖУРНАЛ («Досье») из-под правила выведен намеренно: запись сделана и датирована тогда,
     когда траншей могло быть иначе, — «addDisbursement: транш №1» это факт прошлого, а не
     подпись текущего экрана. Проверка требует, чтобы номер там ОСТАЛСЯ: молчаливое
     распространение гейта на журнал — тоже регресс.
     Проверено с обратной стороны: подмена `multiTr` на `() => true` в песочнице даёт 31
     нарушение уже на пяти первых одиночных кредитах, модалка возвращает селект — значит
     ловится именно гейт, а не совпадение разметки. */
  {
    const TRN = /[Тт]ранш[аеуы]?\s*№\s*\d/;                  // «транш №1», «траншу №2», «Транша №3»
    const THT = /<th[^>]*>Транш</;                            // колонка-ключ реестра/сводов
    const SCOPED = ['Договор','Условия','Состав','График','Прогноз','Расчёты','Платежи','План','Обеспечение','Проблемные'];
    const singles = CR2.db.credits.filter(c => (c.tranches || []).length === 1);
    const multis  = CR2.db.credits.filter(c => (c.tranches || []).length > 1);
    let bad = [], nS = 0, nM = 0, jrn = 0;
    for (const c of singles){ CR2.openDetail(c.id); nS++;
      for (const t of SCOPED){ let h;
        try { h = CR2.renderTab(t, c); } catch(e){ bad.push(`${c.id}/${t}: ${e.message}`); continue; }
        const num = (h.match(TRN) || [''])[0];
        if (num) bad.push(`${c.id}/${t}: печатает «${num}» при одном транше`);
        if (THT.test(h)) bad.push(`${c.id}/${t}: колонка «Транш» при одном транше`);
      }
      if (TRN.test(CR2.renderTab('Досье', c))) jrn++;         // журнал — исключение, см. шапку
    }
    /* Положительный контроль: гейт обязан ПРОПУСКАТЬ многотраншевые. Номер ищется по всем
       вкладкам разом (у K-1 он выпадает только на «Расчётах» — там свод по траншам),
       колонка — на четырёх сводных, где она и есть ключом строки. */
    for (const c of multis){ CR2.openDetail(c.id); nM++;
      const all = SCOPED.map(t => { try { return CR2.renderTab(t, c); } catch(e){ return ''; } });
      if (!all.some(h => TRN.test(h))) bad.push(`${c.id}: ${c.tranches.length} транша, а номера нет нигде`);
      for (const t of ['Состав','График','Прогноз','Платежи'])
        if (!THT.test(all[SCOPED.indexOf(t)])) bad.push(`${c.id}/${t}: ${c.tranches.length} транша, а колонки «Транш» нет`);
    }
    /* Модалки: openModal перехватывается — тело диалога иначе уходит в DOM-заглушку. Роль
       поднимается до начальника отдела и возвращается назад: modalGuard молча закрывает
       действие не по роли, и пустое тело читалось бы как «поле исчезло». Терминальный
       кредит guard закрывает тоже — такие пропускаются, а не считаются нарушением. */
    const MOD = [['openDisbModal','disbTranche'], ['openSchedModal','schedTranche'],
                 ['openPaymentModal','payTranche'], ['openCloseTrancheModal','ctNo']];
    const realOpen = CR2.openModal, realGet = doc.getElementById, wasRole = CR2.state && CR2.state.role;
    let body = '', shown = 0;
    CR2.openModal = (title, b) => { body = b || ''; };
    const setRole = (r) => { doc.getElementById = (id) => id === 'roleSel'
      ? Object.assign(stub(), { value:r }) : realGet(id); CR2.onRoleChange(); };
    setRole('Начальник отдела');
    const probeMod = (c, wantSelect) => { CR2.openDetail(c.id); let got = 0;
      for (const [fn, fid] of MOD){ body = '';
        try { CR2[fn](); } catch(e){ bad.push(`${c.id}/${fn}: ${e.message}`); continue; }
        if (!body) continue;                                  // guard не пустил — не наш случай
        got++;
        const sel = new RegExp(`<select id="${fid}"`).test(body);
        const hid = new RegExp(`<input type="hidden" id="${fid}" value="(\\d+)"`).exec(body);
        if (wantSelect && !sel) bad.push(`${c.id}/${fn}: ${c.tranches.length} транша, а выбора нет`);
        if (!wantSelect){
          if (sel) bad.push(`${c.id}/${fn}: селект «Транш» при одном транше`);
          if (!hid) bad.push(`${c.id}/${fn}: поле ${fid} исчезло вместе с подписью`);
          else if (+hid[1] !== c.tranches[0].no) bad.push(`${c.id}/${fn}: скрытое поле несёт №${hid[1]}, а транш №${c.tranches[0].no}`);
          if (/flabel">Транш</.test(body)) bad.push(`${c.id}/${fn}: подпись «Транш» осталась`);
        }
      } return got; };
    for (const c of singles){ if (shown >= 24) break; shown += probeMod(c, false); }
    let shownM = 0;
    for (const c of multis) shownM += probeMod(c, true);
    CR2.openModal = realOpen; setRole(wasRole || 'Кредитный специалист'); doc.getElementById = realGet;
    ok(177, bad.length === 0 && nS > 40 && nM >= 4 && jrn > 0 && shown >= 12 && shownM >= 8,
       `одиночных ${nS} · многотраншевых ${nM} · журнал сохранил номер у ${jrn}`
       + ` · модалок с полем транша ${shown} одиночных / ${shownM} многотраншевых`
       + ` · нарушений ${bad.length}${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`);
  }

  /* 130. «ГРАФИК» СО СТАТЬЯМИ (КВ-26, ADR-0109). Колонки статей рисуются ПО СОСТАВУ:
     у К-1 их нет вовсе (иначе вкладка обрастает пустыми колонками у всех кредитов
     страны ради двух реструктурированных), у производного транша К-7 — есть, и
     ровно те, по которым что-то распределено. «Основной долг» несёт подпись о том, что
     он единственная ставочная колонка: без неё читатель решит, что процент капает и на пеню.
     Плашка ИР-2′ показывает арифметику приёма строк — Σ колонок = сумме переноса —
     и стоит только под ДС-версией: у обычного графика переноса не было. */
  const grf = (id, scope) => { const c = CR2.db.credits.find(x => x.id === id);
    CR2.openDetail(id); try { CR2.setCardScope(scope); } catch(e){}
    const h = CR2.renderTab('График', c); try { CR2.setCardScope('credit'); } catch(e){} return h; };
  const grf1 = grf('K-1', 'credit'), grf7d = grf('K-7', 2), grf7c = grf('K-7', 'credit');
  const SCHED_ART_H = ['Накопленные проценты','Накопленная пеня','Прочее'];
  const artH = new RegExp(SCHED_ART_H.join('|'));
  ok(130, !artH.test(grf1) && !/ИР-2′/.test(grf1)
          && artH.test(grf7d) && /ADR-0109/.test(grf7d)
          && /ИР-2′/.test(grf7d) && /ДС-РС-2001/.test(grf7d)
          && artH.test(grf7c) && /ДС-РС-2002/.test(grf7c),
     `К-1: статьи ${artH.test(grf1)} · производный: статьи ${artH.test(grf7d)},`
     + ` ИР-2′ ${/ИР-2′/.test(grf7d)} · по кредиту: статьи ${artH.test(grf7c)}`);

  /* 156. ЯЗЫК ШАПКИ «ГРАФИК — ПОЗИЦИИ» (волна 13.08.2026). Имена колонок вернулись к
     языку живого приложения (`requirements/tz/05-kredit.md:183` — «Основной долг ·
     Проценты · Итого»): макетные сокращения «Осн. сумма», «Проценты в платеже»,
     «Начислено %», «Платёж» ушли. ПОРЯДОК — часть решения, поэтому проверяется он, а не
     только состав: справочное «Начислено за период» стоит ПОСЛЕ «Итого», иначе величина,
     которую не платят, разрывает пару «из чего платёж → сколько платим». Проверяется
     только THEAD таблицы позиций: слово «Итого» встречается на вкладке и в плитках.
     ПАРА «Основной долг · Проценты» НЕРАЗРЫВНА (КВ-38): статьи ADR-0109 стоят ПОСЛЕ
     процентов, иначе на реструктурированном кредите та же таблица читается в другом
     порядке, чем на обычном. Проверяется на К-7, где статьи есть: на К-1 их нет вовсе
     и вклинивание нечем поймать.
     «НАЧИСЛЕНО ЗА ПЕРИОД» — ПО СОСТАВУ (КВ-69), и потому проверяется ДВУМЯ ветками.
     Отрицательная — на живой базе: расхождения нет ни у одного демо-кредита (сид
     начисление вовсе не пишет), колонки не должно быть НИГДЕ, а факт совпадения обязан
     проговорить тултип «Процентов» — молчание неотличимо от «мы этого не считаем».
     Положительная — на клоне с поднятым начислением, и расхождение ставится в позицию
     СВЁРНУТОГО года: состав шапки считается по ВСЕМ позициям области, а не по видимым,
     иначе колонка мигала бы от разворота года. Порядок ОД→Итого→Начислено сторожится
     на этой же ветке — на скрытой колонке его ловить нечем. */
  const thOf = h => (h.match(/<thead><tr>(?:(?!<\/thead>)[\s\S])*?Основной долг[\s\S]*?<\/thead>/) || [''])[0];
  const thPos = thOf(grf1), thArt = thOf(grf7d);
  const iOf = s => thPos.indexOf(s), iArt = s => thArt.indexOf(s);
  const artAfter = iArt('Проценты') > iArt('Основной долг')
    && SCHED_ART_H.every(a => thArt.indexOf(a) < 0 || thArt.indexOf(a) > iArt('Проценты'));
  const accHidden = CR2.db.credits.every(c => !/Начислено за период/.test(thOf(CR2.renderTab('График', c))));
  const accClone = JSON.parse(JSON.stringify(CR2.db.credits.find(c => c.id === 'K-1')));
  const curY = CR2.pd(CR2.TODAY).getFullYear();
  let accHit = null;
  for (const t of accClone.tranches){
    if (accHit) break;
    /* У К-1 хранимых версий нет — позиции выводит trancheScheduleRows. Кладём их
       клону версией и поднимаем начисление одной строки: расхождение как в льготе по %
       (что льгота его даёт — стережёт №47, здесь речь только про шапку). */
    const rows = JSON.parse(JSON.stringify(CR2.trancheScheduleRows(t)));
    const hit = rows.find(r => +String(r.date).slice(6, 10) !== curY);
    if (!hit) continue;
    hit.accrued = (hit.interest || 0) + 100; accHit = hit;
    t.schedules = [{ ver:1, validFrom:rows[0].date, by:{ kind:'engine', label:'Первичный график' },
                     generatedFrom:rows[0].date, generatedAt:rows[0].date, generatedSeq:0, rows }];
  }
  CR2.openDetail('K-1'); try { CR2.setCardScope('credit'); } catch(e){}
  const thAcc = thOf(CR2.renderTab('График', accClone));
  const iAcc = s => thAcc.indexOf(s);
  const accOrder = iAcc('Начислено за период') > iAcc('Итого') && iAcc('Итого') > iAcc('Основной долг');
  ok(156, !/Осн\. сумма|Проценты в платеже|Начислено %/.test(grf1)
          && iOf('Основной долг') > 0 && iOf('Итого') > iOf('Основной долг')
          && accHidden && /совпали с начисленным за период/.test(thPos)
          && accHit && accOrder && artAfter,
     `старых имён нет ${!/Осн\. сумма|Проценты в платеже|Начислено %/.test(grf1)}`
     + ` · колонки нет ни у одного кредита ${accHidden} · оговорка в тултипе «Процентов»`
     + ` ${/совпали с начисленным за период/.test(thPos)}`
     + ` · на клоне (свёрнутый год) порядок ОД→Итого→Начислено ${!!accHit && accOrder}`
     + ` · статьи после «Процентов» ${artAfter}`);

  /* 132. ВЕРСИИ НЕ ЗАНИМАЮТ ЭКРАН У ОБЫЧНОГО КРЕДИТА (КВ-27). Грид версий стоял на
     «Графике» безусловно и у К-1 нёс одну строку — «v1, построена в день освоения,
     основание „перестроение“», то есть повторял дату первой позиции таблицы под собой.
     Правило волны: элемент появляется, когда несёт факт. У К-1 фактов нет ни одного
     (версия одна, движковая, построена в день начала действия, будущей нет) — значит
     на вкладке нет ни строки-контекста, ни заголовка раскрытия. */
  const grf1v = grf('K-1', 1);
  ok(132, !/Версии графика/.test(grf1v) && !/Действует v/.test(grf1v)
          && /График — позиции/.test(grf1v),
     `К-1: заголовок версий ${/Версии графика/.test(grf1v)}, строка-контекст`
     + ` ${/Действует v/.test(grf1v)}, позиции ${/График — позиции/.test(grf1v)}`);

  /* 133. У ДС-ВЕРСИИ ЕСТЬ ЧТО СКАЗАТЬ (КВ-27). Транш 2 К-7 рождён разделением, его строки
     ПРИШЛИ из приложения к ДС — значит строка-контекст обязана назвать основание, а
     счётчик в заголовке обязан совпасть с числом версий транша (слово «прежние» было бы
     враньём: будущая версия не прежняя). Грид по умолчанию свёрнут — таблицы в разметке
     нет, пока не нажали; после toggle она появляется. */
  const k7t2 = CR2.db.credits.find(x => x.id === 'K-7').tranches.find(t => t.no === 2);
  const nVer = ((k7t2 || {}).schedules || []).length;
  const verHead = new RegExp('Версии графика \\(' + nVer + '\\)');
  const grf7closed = grf('K-7', 2);
  CR2.toggleGrafikVers();
  const grf7open = grf('K-7', 2);
  CR2.toggleGrafikVers();
  ok(133, /Действует v/.test(grf7closed) && /ДС-РС-200/.test(grf7closed) && verHead.test(grf7closed)
          && !/Действует с<\/th>/.test(grf7closed) && /Действует с<\/th>/.test(grf7open),
     `К-7 Т2: строка-контекст ${/Действует v/.test(grf7closed)}, счётчик (${nVer})`
     + ` ${verHead.test(grf7closed)}, грид свёрнут ${!/Действует с<\/th>/.test(grf7closed)}`
     + ` → развёрнут ${/Действует с<\/th>/.test(grf7open)}`);

  /* 134. БУДУЩАЯ ВЕРСИЯ НАЗЫВАЕТСЯ В СТРОКЕ (КВ-27). ДС подписан с отложенной датой
     вступления: версия записана, но действует прежняя, и таблица позиций показывает НЕ
     то, что в соглашении. Это единственный факт, меняющий чтение вкладки, — поэтому он
     стоит хвостом той же строки, а не отдельной плашкой (плашка конкурировала бы с Д-5).
     Сид будущей версии не держит: ставим её здесь, на К-3 — единственный кредит с сеяной
     версией графика и одним траншем (у К-1 версий нет вовсе, см. #132). */
  const k3t = CR2.db.credits.find(x => x.id === 'K-3').tranches[0];
  const futDate = CR2.TODAY.slice(0, 6) + (Number(CR2.TODAY.slice(6)) + 1);   // тот же день через год
  const maxVer = (k3t.schedules || []).reduce((m, s) => Math.max(m, s.ver || 0), 0);
  k3t.schedules.push({ ver: maxVer + 1, rows: (k3t.schedules[0].rows || []).slice(),
    validFrom: futDate, generatedFrom: futDate, generatedAt: CR2.TODAY,
    by: { kind: 'ДС', ref: 'ДС-БУД-1' } });
  const grf3fut = grf('K-3', 1);
  ok(134, /вступает v/.test(grf3fut) && /ДС-БУД-1/.test(grf3fut)
          && new RegExp('вступает v' + (maxVer + 1)).test(grf3fut)
          && /Действует v/.test(grf3fut),
     `К-3 с будущей: хвост ${/вступает v/.test(grf3fut)}, номер ДС ${/ДС-БУД-1/.test(grf3fut)},`
     + ` действующая всё ещё названа ${/Действует v/.test(grf3fut)}`);

  /* 135. ПЕРЕКЛЮЧЕНИЕ ВЕРСИИ ВЕДЁТ И ПЛИТКИ (КВ-28). Плитки — свод таблицы под ними;
     если позиции поехали на показанную версию, а плитки остались на действующей, экран
     говорит «60 позиций» над таблицей из 48 строк. Проверяем на будущей версии К-1,
     поставленной в #134: у неё СВОЙ набор строк, обрезанный вдвое, — значит плитка
     «Платежей в графике» обязана показать именно его длину, а не длину действующей. */
  const futVerNo = maxVer + 1;
  const futSched = k3t.schedules.find(s => s.ver === futVerNo);
  futSched.rows = (futSched.rows || []).slice(0, Math.max(1, Math.floor((futSched.rows || []).length / 2)));
  const actVerNo = k3t.schedules[0].ver;                       // сеяная — она же действующая
  const nAct = (k3t.schedules[0].rows || []).length;
  CR2.setGrafikVer(k3t.no, futVerNo);
  const grf3view = CR2.renderTab('График', CR2.db.credits.find(x => x.id === 'K-3'));
  const tileN = (grf3view.match(/Платежей в графике<\/div><div class="dv">(\d+)</) || [])[1];
  ok(135, Number(tileN) === futSched.rows.length && futSched.rows.length !== nAct,
     `плитка «Платежей в графике» ${tileN} · строк показанной версии ${futSched.rows.length}`
     + ` · строк действующей ${nAct}`);

  /* 136. В РЕЖИМЕ ПРОСМОТРА НЕТ КОЛОНКИ «СТАТУС» (КВ-28). Леджер построен по ДЕЙСТВУЮЩЕЙ
     версии, ledgerKey совпадёт номером позиции, а суммы и даты у показанной другие —
     статус был бы не «неизвестен», а ложен. Колонка убирается целиком: прочерк на всю
     таблицу читался бы как «ничего не погашено». Вместе с ней уходит хвост статусов из
     строки года (gyear-s). И стоит плашка режима с возвратом. */
  ok(136, !/>Статус</.test(grf3view) && !/gyear-s/.test(grf3view)
          && /ещё не действует, вступает/.test(grf3view)
          && /Вернуться к действующей/.test(grf3view),
     `колонка «Статус» ${/>Статус</.test(grf3view)} · хвост года ${/gyear-s/.test(grf3view)}`
     + ` · плашка ${/ещё не действует, вступает/.test(grf3view)}`
     + ` · возврат ${/Вернуться к действующей/.test(grf3view)}`);

  /* 137. В РЕЖИМЕ ПРОСМОТРА НЕЛЬЗЯ СТРОИТЬ (КВ-28, §0.3). Строить новую версию, глядя на
     архив, двусмысленно: неясно, от чего строим. Кнопка не исчезает — гаснет и называет
     причину (не молчаливый отказ). Клик по ДЕЙСТВУЮЩЕЙ версии возвращает режим в норму:
     кнопка снова жива, колонка «Статус» на месте. */
  const gated = /вернитесь к действующей/.test(grf3view) && /cursor:not-allowed/.test(grf3view);
  CR2.setGrafikVer(k3t.no, actVerNo);                // клик по действующей = возврат
  const grf3back = CR2.renderTab('График', CR2.db.credits.find(x => x.id === 'K-3'));
  ok(137, gated && />Статус</.test(grf3back) && !/Вернуться к действующей/.test(grf3back)
          && !/вернитесь к действующей/.test(grf3back),
     `кнопка погашена с причиной ${gated} · после возврата: статус ${/>Статус</.test(grf3back)},`
     + ` плашки нет ${!/Вернуться к действующей/.test(grf3back)},`
     + ` гейт снят ${!/вернитесь к действующей/.test(grf3back)}`);

  /* 138. КНОПКА «СФОРМИРОВАТЬ ГРАФИК» НЕ ЗАНИМАЕТ СВОЮ СТРОКУ (КВ-29). Была отдельной
     gtoolbar под заголовком — две строки хрома до плиток ради действия, которое жмут
     1–3 раза за жизнь кредита. Теперь она хвост заголовка «График погашения» (идиома
     карточек «Ставки» и «Погашение»), и вес у неё secondary: primary в макете носят
     частые действия вроде «Внести платёж». Выводов три, функция одна — ярлык и гейт
     обязаны совпасть во всех трёх (иначе кнопка в плашке пережила бы гейт заголовка).
     Второй вывод — ПУСТОЕ состояние таблицы: у транша без графика построить его и есть
     работа экрана, и только там кнопка остаётся primary. Третий — плашка Д-5: она прямо
     просит сформировать заново, значит кнопка стоит в ней, а не ищется глазами. */
  const hdrBtn = /График погашения\s*<button[^>]*>Сформировать график<\/button>\s*<\/div>/;
  const loneRow = /<span class="spacer"><\/span>\s*<button[^>]*>Сформировать график/;
  /* Инвариант волны: кнопка на экране РОВНО ОДНА. Первый снимок дал плашку Д-5 и заголовок
     в 42 px друг от друга — одна кнопка дважды читается как два разных действия. */
  const nBtn = (h) => (h.match(/<button[^>]*>Сформировать график<\/button>/g) || []).length;
  /* Транш без ПОЗИЦИЙ, а не без версий: пустой schedules ещё не пустая таблица — у К-1 Т1
     версий нет, а строки есть (сеяные, trancheScheduleRows). Пустое состояние показывает
     именно тот транш, у которого рисовать нечего. */
  const k1noSched = (CR2.db.credits.find(x => x.id === 'K-1').tranches
                     .find(t => !CR2.trancheScheduleRows(t).length) || {}).no;
  const grf1empty = k1noSched ? grf('K-1', k1noSched) : '';
  const emptyBtn = /cgrid-empty" style="flex-direction:column">[^<]*<div style="margin-top:10px"><button class="[^"]*btn-primary/;
  /* Кредит с горящей Д-5 ищется, а не назначается: #134 приписала К-3 версию с сегодняшним
     generatedAt, и его плашка после этого могла погаснуть по правилу самой Д-5. */
  const d5c = CR2.db.credits.find(x => CR2.retroPendingFlags(x).length);
  const grfD5 = d5c ? grf(d5c.id, d5c.tranches[0].no) : '';
  const d5Btn = /\(Д-5\)\.\s*<div style="margin-top:8px"><button[^>]*>Сформировать график/;
  /* Заголовок проверяется на транше С позициями и БЕЗ горящей Д-5 — у К-3 флаг горит, и
     кнопку по приоритету забирает плашка (сам кейс это и требует ниже). */
  const grfHead = grf('K-1', 1);
  ok(138, hdrBtn.test(grfHead) && !loneRow.test(grfHead)
          && !/<button class="[^"]*btn-primary[^"]*"[^>]*>Сформировать график/.test(grfHead)
          && !!k1noSched && emptyBtn.test(grf1empty) && !hdrBtn.test(grf1empty)
          && !!d5c && d5Btn.test(grfD5) && !hdrBtn.test(grfD5)
          && nBtn(grfHead) === 1 && nBtn(grf1empty) === 1 && nBtn(grfD5) === 1,
     `заголовок ${hdrBtn.test(grfHead)} · своей строки нет ${!loneRow.test(grfHead)}`
     + ` · пустое состояние (транш №${k1noSched}) ${emptyBtn.test(grf1empty)}`
     + ` · плашка Д-5 (${d5c ? d5c.id : 'кредита с флагом нет'}) ${d5c ? d5Btn.test(grfD5) : false}`
     + ` · кнопок на экране ${nBtn(grfHead)}/${nBtn(grf1empty)}/${nBtn(grfD5)} (норма 1/1/1)`);

  /* 100. ГРУППИРОВКА ПО ГОДАМ на «Графике» (волна 10.08.2026, КВ-19). Строка года стоит
     перед первой позицией своего года, годы идут по возрастанию, итоги (ОД · проценты ·
     к погашению) равны суммам позиций ЭТОГО года и стоят ПОД СВОИМИ колонками — то есть
     строка года имеет ровно 6 ячеек (5, когда справочной колонки начисления нет —
     КВ-69), а не одну на всю ширину. Развёрнут по умолчанию
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
    /* Статейные колонки (КВ-26) раздвигают строку года: их итоги стоят под своими
       колонками ровно так же, как ОД и проценты, — иначе год врал бы на сумму
       перенесённой пени. Сколько их, столько лишних ячеек в строке. Место — ЗА
       «Процентами» (КВ-38), см. want ниже. */
    const arts = CR2.scheduleArticleCols(rows);
    /* «Начислено за период» — тоже по составу (КВ-69): колонки нет, когда начисление
       ни в одной позиции не разошлось с «Процентами», и строка года на эту ячейку
       короче. Порог тот же 0,005, что в ячейке и в шапке. */
    const accCol = rows.some(r => r.accrued != null && Math.abs(r.accrued - r.interest) > 0.005) ? 1 : 0;
    const exp = new Map();
    for (const r of rows){ const y = CR2.pd(r.date).getFullYear();
      const g = exp.get(y) || { n:0, principal:0, interest:0, total:0, art:{} };
      g.n++; g.principal += r.principal||0; g.interest += r.interest||0; g.total += r.total||0;
      for (const a of arts) g.art[a.key] = (g.art[a.key]||0) + ((r.articles&&r.articles[a.key])||0);
      exp.set(y, g); }
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
      if (h.tds !== 5 + accCol + arts.length) gbad.push(`${c.id}/${h.y}: ячеек в строке года ${h.tds}, а не ${5+accCol+arts.length} (итоги не под колонками)`);
      /* Порядок ожидания повторяет шапку: тело → проценты → статьи → итого (КВ-38).
         Пара «Основной долг · Проценты» неразрывна, статьи идут за ней. */
      const want = [m2(g.principal), m2(g.interest), ...arts.map(a => g.art[a.key] ? m2(g.art[a.key]) : '—'), m2(g.total)];
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

  /* ---- КВ-34 · «ПРОГНОЗ»: СТРОКА ВМЕСТО ВИТРИНЫ (13.08.2026)
          КВ-39 · ГЛАВНЫЙ ОТВЕТ ЛЕСТНИЦЕЙ, ОКНО ВМЕСТО ФИЛЬТРА (14.08.2026, ADR-0119) ---- */

  /* 151. СНЯТОЕ СНЯТО, И ПРАВИЛА НЕ ПОТЕРЯНЫ. Пять плиток, четыре плашки и тулбар ушли
     с вкладки волной КВ-34; КВ-39 снял оттуда же ФИЛЬТР РАСХОЖДЕНИЙ (при контрактном теле
     расходятся все будущие позиции — отбирать нечего), колонку «Остаток ОД после», а вместе
     с прошлым из таблицы — обе группы и колонку «в т.ч. пеня»: пеня в ожидаемом взносе не
     бывает никогда (ADR-0087), и колонка существовала только ради наступивших строк.
     Отсылки в «Расчёты» (.fs .go → CR.openTab) здесь тоже нет: она заводилась ради недобора,
     а вместе с ним снята — ссылка на разбивку прошлого есть тот же разговор о прошлом,
     только навигацией (ADR-0119 §5). Проза живёт в тултипах колонок. Сметается по ВСЕМ
     кредитам: вкладка строится из условных веток, и хватило бы одного состояния, где старый
     носитель уцелел. */
  (() => { const bad = [], noTip = [], noHero = [];
    for (const c of CR2.db.credits){ CR2.openDetail(c.id);
      const h = CR2.renderTab('Прогноз', c);
      for (const s of ['phead-dims','info-plate','gtoolbar','Расхождения с графиком','Остаток ОД после',
                       'в т.ч. пеня','Не покрыто','Ожидаем впереди','fs .go','openTab('])
        if (h.includes(s)) bad.push(`${c.id}/${s}`);
      /* Главный ответ — НЕ БОЛЬШЕ ОДНОГО, и отсутствует он ровно в одном состоянии: позиции
         впереди есть, прошлое не покрыто — там отвечает таблица, а шапка была бы её
         пересказом (ADR-0119 §1). Во всех прочих состояниях шапка обязана быть: без неё
         вкладка молчала бы там, где таблицы нет или она не отвечает. */
      const sm = CR2.forecastSummary(c, c.tranches, CR2.derive(c, CR2.TODAY).ledger.index, CR2.TODAY);
      const tableAnswers = sm.fut.length > 0 && sm.payoff && sm.tail > 0.005 && !(c.mirror && c.mirror.settlement);
      const heroes = (h.match(/class="fc-hero"/g) || []).length;
      if (heroes !== (tableAnswers ? 0 : 1)) noHero.push(`${c.id}/${heroes}`);
      if (tableAnswers && !h.includes('class="cgrid"')) noHero.push(`${c.id}/без таблицы`);
      /* правило колонки живёт на её заголовке (cgrid, :6632) — но только там, где таблица
         вообще есть: при свёрнутом МС цифр нет вовсе, и спрашивать не с чего */
      if (h.includes('class="cgrid"')
          && !(h.includes('ADR-0087') && h.includes('ADR-0074 §1') && h.includes('ADR-0108')))
        noTip.push(c.id);
    }
    ok(151, bad.length === 0 && noTip.length === 0 && noHero.length === 0,
       `старый носитель у ${bad.length} (${bad.slice(0,3).join(' ')||'—'}),`
       + ` без тултипов правил ${noTip.length} (${noTip.slice(0,3).join(' ')||'—'}),`
       + ` с неверным числом главных ответов ${noHero.length} (${noHero.slice(0,3).join(' ')||'—'})`);
  })();

  /* 152. ЛЕСТНИЦА СОСТОЯНИЙ: КАЖДАЯ СТУПЕНЬ ОБЕЩАЕТ РОВНО ТО, ЧТО В ЭТОМ СОСТОЯНИИ МОЖНО
     (ADR-0119 §1). Ключевая пара — K-1 и K-B1: дату закрытия называет ТОЛЬКО тот, у кого
     прошлое покрыто. На K-1 нуля на этой дате не будет (тело контрактно, график тела не
     растягивается, ADR-0108 §1), и сама дата там всегда равна договорной — прогноза в ней
     нет. Шапки у K-1 нет ВОВСЕ: любое её содержимое было бы пересказом таблицы, которая
     стоит ниже и отвечает сама (ADR-0119 §1/§3). */
  (() => { const tab = id => { CR2.openDetail(id);
      return CR2.renderTab('Прогноз', CR2.db.credits.find(x => x.id === id)); };
    const k6b = tab('K-6b'), k1 = tab('K-1'), k2 = tab('K-2'), kb1 = tab('K-B1');
    const sm = id => { const c = CR2.db.credits.find(x => x.id === id);
      return CR2.forecastSummary(c, c.tranches, CR2.derive(c, CR2.TODAY).ledger.index, CR2.TODAY); };
    const s1 = sm('K-1'), sb1 = sm('K-B1');
    /* Ближайшая дата и её ожидаемый взнос — они обязаны стоять В ТАБЛИЦЕ и больше нигде:
       ответ у этого состояния один, и он строчный. */
    const nd = s1.fut[0].date, nsum = CR2.money(s1.fut.filter(r => r.date === nd).reduce((a,r) => a + r.forecast, 0));
    const k1NoHero = !k1.includes('class="fc-hero"');
    ok(152, /кредит закрыт:/.test(k6b) && /Расчёт замер на дате закрытия/.test(k6b)
            && s1.tail > 0.005 && k1NoHero && k1.includes(`<td>${nd}</td>`) && k1.includes(`<b>${nsum}</b>`)
            && !/ожидаемое закрытие/.test(k1) && !k1.includes(s1.payoff)
            && sb1.tail <= 0.005 && kb1.includes(`${sb1.payoff}<span class="fl">ожидаемое закрытие`)
            && /Графика нет<span class="fl">прогнозировать нечего/.test(k2),
       `K-6b закрыт (${/кредит закрыт:/.test(k6b)}) · K-1 (непокрыто ${CR2.money(s1.tail)}) → шапки нет ${k1NoHero},`
       + ` ближайшая ${nd} и взнос ${nsum} только в таблице ${k1.includes(`<td>${nd}</td>`) && k1.includes(`<b>${nsum}</b>`)},`
       + ` дата закрытия ${s1.payoff} не названа ${!k1.includes(s1.payoff)}`
       + ` · K-B1 (покрыто) → «${sb1.payoff} — ожидаемое закрытие» ${/ожидаемое закрытие/.test(kb1)}`
       + ` · K-2 графика нет ${/Графика нет/.test(k2)}`);
  })();

  /* 153. МС — ВЕРХНЯЯ СТУПЕНЬ, И ОНА НЕ СЪЕДАЕТ НИЖНЮЮ. У K-3 состояний два сразу —
     мировое соглашение и исчерпанный график с долгом. Шапку занимает МС: живой график у
     слоя МС, ведёт его взыскание (ADR-0047), и договорные цифры кредита под этой шапкой не
     исполняются — по умолчанию они СВЁРНУТЫ, таблицы на вкладке нет вовсе. По кнопке они
     раскрываются и подписываются как договорные, а вместе с ними приходит вторая ступень
     («срок кончился, непокрыто»): молчать о ней из-за МС вкладка не вправе. */
  (() => { CR2.openDetail('K-3');
    const c = CR2.db.credits.find(x => x.id === 'K-3');
    const idx = CR2.derive(c, CR2.TODAY).ledger.index;
    const sm = CR2.forecastSummary(c, c.tranches, idx, CR2.TODAY);
    const shut = CR2.renderTab('Прогноз', c);
    CR2.setPrognozMs(true);
    const open = CR2.renderTab('Прогноз', c);
    CR2.setPrognozMs(false);
    ok(153, /Ожидание ведёт взыскание/.test(shut) && /мировое соглашение/.test(shut)
            && /ADR-0047/.test(shut) && !shut.includes('class="cgrid"')
            && shut.includes('CR.setPrognozMs(true)')
            && open.includes('class="cgrid"')
            && /Ниже — <b>договорный график кредита<\/b>/.test(open)
            && sm.tail > 0.005 && !open.includes(CR2.money(sm.tail))
            && /<b>Ожидания нет<\/b> — график исчерпан, срок кончился/.test(open),
       `свёрнуто: цифр ${shut.includes('class="cgrid"')?'ПОКАЗАНЫ':'нет'}, кнопка ${shut.includes('CR.setPrognozMs(true)')}`
       + ` · раскрыто: договорная подпись ${/договорный график кредита/.test(open)},`
       + ` вторая ступень «Ожидания нет — ${(open.match(/Ожидания нет<\/b> — ([^·<]+)/)||['','—'])[1].trim()}»,`
       + ` непокрытых ${CR2.money(sm.tail)} на экране ${open.includes(CR2.money(sm.tail))?'ПОКАЗАНО':'нет'}`);
  })();

  /* 157. ОКНО — ТРИ БЛИЖАЙШИЕ ДАТЫ ВПЕРЁД, ИТОГ — ПО ВСЕМ (ADR-0119 §4). Окно режется по
     ДАТЕ, а не по числу строк: при слиянии траншей (КВ-17) одна и та же дата попала бы в
     таблицу наполовину. Итог при этом считается по ВСЕМ будущим позициям — окно решает, что
     видно, а не что посчитано, иначе Σ впереди менялась бы от нажатия кнопки, а «План» брал
     бы снимок другой величины (ADR-0042 §2). */
  (() => { CR2.openDetail('K-4'); CR2.setCardScope('credit'); CR2.setPrognozAll(false);
    const c = CR2.db.credits.find(x => x.id === 'K-4');
    const sm = CR2.forecastSummary(c, c.tranches, CR2.derive(c, CR2.TODAY).ledger.index, CR2.TODAY);
    const dates = [...new Set(sm.fut.map(r => r.date))];
    const win = sm.fut.filter(r => dates.slice(0, 3).includes(r.date));
    /* Строки считаем по ячейке ДАТЫ: колонки «№» в таблице нет — номер позиции принадлежит
       договорному графику, а таблица «только будущее» начиналась бы им с середины ряда
       (ADR-0119 §4). */
    const cnt = h => (h.match(/<td>\d\d\.\d\d\.\d{4}<\/td>/g) || []).length;
    const h1 = CR2.renderTab('Прогноз', c);
    CR2.setPrognozAll(true);
    const h2 = CR2.renderTab('Прогноз', c);
    CR2.setPrognozAll(false);
    const tot = h => h.includes(`<b>${CR2.money(sm.futSum)}</b>`) && h.includes(`<b>${CR2.money(sm.futSched)}</b>`);
    ok(157, sm.fut.length > win.length && cnt(h1) === win.length && cnt(h2) === sm.fut.length
            && !/<th[^>]*>№</.test(h1) && !h1.includes('<td>№'+sm.fut[0].no+'</td>')
            && tot(h1) && tot(h2) && h1.includes(`итог по всем ${sm.fut.length}`)
            && h1.includes(`Все позиции (${sm.fut.length})`),
       `в окне строк ${cnt(h1)} (ближайшие ${win.length} из ${sm.fut.length}),`
       + ` все позиции ${cnt(h2)}/${sm.fut.length}; Σ впереди ${CR2.money(sm.futSum)} не зависит от окна ${tot(h1) && tot(h2)}`);
  })();

  /* 158. НА ВКЛАДКЕ ТОЛЬКО ПРОГНОЗНЫЕ ДАННЫЕ (ADR-0119 §4/§5) — ни строкой, ни числом,
     ни словом о прошлом. Три величины тянули его сюда и сняты все три: НЕДОБОР по
     наступившим позициям (факт, разложенный «Расчётами» построчно и названный числом в
     плитках шапки карточки), ЦЕНА ДНЯ ПРОСРОЧКИ (её база — уже наступившее прошлое, а во
     взнос пеня не входит никогда, ADR-0087) и «ПРОЦЕНТЫ СВЕРХ КОНТРАКТА» (Σ колонки Δ,
     стоящая итоговой строкой прямо под своими слагаемыми — та же величина, названная на
     одном экране дважды, читается как две).
     Сметается по ВСЕМ кредитам и обоим состояниям окна: вкладка строится из условных веток,
     и хватило бы одного состояния, где прошлое уцелело. Отдельно — сама сумма недобора:
     формулировку можно переписать, число же ищется как число. */
  (() => { const dnum = s => { const p = s.split('.'); return +p[2]*10000 + +p[1]*100 + +p[0]; };
    const lim = dnum(CR2.TODAY), leak = [], said = [], nums = [];
    const WORDS = [/\/день/, /недобрано/, /непокрыто/, /проценты сверх контракта/, /пеня/i];
    let checked = 0;
    for (const c of CR2.db.credits){ CR2.openDetail(c.id); CR2.setCardScope('credit');
      const sm = CR2.forecastSummary(c, c.tranches, CR2.derive(c, CR2.TODAY).ledger.index, CR2.TODAY);
      for (const all of [false, true]){ CR2.setPrognozAll(all);
        const h = CR2.renderTab('Прогноз', c);
        /* СМОТРИМ НА ВИДИМЫЙ ТЕКСТ, БЕЗ ТУЛТИПОВ: в них живут ПРАВИЛА («пени здесь нет: во
           взнос она не входит никогда»), и запрещать в правиле слово «пеня» — значит
           запрещать объяснять, почему её тут нет. Запрет на величины к тексту тултипа не
           относится: величина — то, что напечатано на экране. */
        const vis = h.replace(/title="[^"]*"/g, '');
        for (const m of h.matchAll(/<td>(\d{2}\.\d{2}\.\d{4})<\/td>/g))
          if (dnum(m[1]) <= lim) leak.push(`${c.id}/${m[1]}${all?'/все':''}`);
        for (const w of WORDS) if (w.test(vis)) said.push(`${c.id}/${w.source}`);
        if (sm.tail > 0.005){ checked++;
          if (vis.includes(CR2.money(sm.tail))) nums.push(`${c.id}/${CR2.money(sm.tail)}`); }
      }
      CR2.setPrognozAll(false);
    }
    ok(158, leak.length === 0 && said.length === 0 && nums.length === 0 && checked > 0,
       `строк с датой ≤ ${CR2.TODAY}: ${leak.length} (${leak.slice(0,3).join(' ')||'—'});`
       + ` слов о прошлом: ${said.length} (${said.slice(0,3).join(' ')||'—'});`
       + ` сумма недобора на экране у ${nums.length} из ${checked/2} кредитов с непокрытым прошлым (${nums.slice(0,3).join(' ')||'—'})`);
  })();

  /* 159. СОСТАВ ОЖИДАНИЯ — ДВЕ СТАТЬИ, И ОНИ СХОДЯТСЯ (ADR-0119 §4). Платёж печатается
     слагаемыми: осн. долг + проценты = платёж, построчно и в итоге. Третьей статьи нет и
     быть не может — пеня во взнос не входит НИКОГДА (ADR-0087), а её база уже наступила.
     Проверяем равенство (иначе колонки складываются на глаз и не сходятся), присутствие
     обоих слагаемых в итоге и отсутствие колонки штрафов в шапке таблицы. */
  (() => { const bad = [], head = [];
    for (const c of CR2.db.credits){ CR2.openDetail(c.id); CR2.setCardScope('credit'); CR2.setPrognozAll(true);
      const sm = CR2.forecastSummary(c, c.tranches, CR2.derive(c, CR2.TODAY).ledger.index, CR2.TODAY);
      if (!sm.fut.length) continue;
      const h = CR2.renderTab('Прогноз', c);
      if (CR2.money(sm.futPrincipal + sm.futInterest) !== CR2.money(sm.futSum)) bad.push(`${c.id}/итог`);
      for (const r of sm.fut)
        if (CR2.money((r.principal||0) + (r.interest||0)) !== CR2.money(r.forecast)) bad.push(`${c.id}/${r.date}`);
      if (!h.includes(`<b>${CR2.money(sm.futPrincipal)}</b>`) || !h.includes(`<b>${CR2.money(sm.futInterest)}</b>`))
        bad.push(`${c.id}/итог не разложен`);
      const heads = [...h.matchAll(/<th[^>]*>([^<]*)</g)].map(m => m[1].trim());
      if (!heads.includes('Основной долг') || !heads.includes('Проценты') || !heads.includes('Итого по прогнозу')) head.push(`${c.id}/нет статей`);
      if (heads.some(x => /пеня|штраф/i.test(x))) head.push(`${c.id}/третья статья`);
    }
    CR2.setPrognozAll(false);
    ok(159, bad.length === 0 && head.length === 0,
       `осн. долг + проценты = платёж: расхождений ${bad.length} (${bad.slice(0,3).join(' ')||'—'});`
       + ` шапка со статьями и без пени: нарушений ${head.length} (${head.slice(0,3).join(' ')||'—'})`);
  })();

  /* 131. КНОПКА «ПРИМЕНИТЬ ДС» (КВ-26, ADR-0096). Дверь одна, но нажимает её человек:
     применение — собственное действие кредита, а не побочный эффект появления ДС в
     зеркале (Р-16 цел — ДС пришло зеркалом, кредит его ПРИМЕНЯЕТ). Кнопка стоит в хвосте
     «Документы без изменения условий» — там, где ДС уже лежит зарегистрированным, но ни
     одна запись условий на него не ссылается. Применение выносит ДС из хвоста в основной
     журнал: шаг виден глазом, а не только в аудите.
     Мутация стоит ПОСЛЕДНЕЙ в блоке рендера — дальше по файлу песочница CR2 не нужна. */
  const uslHtml = () => { CR2.openDetail('K-7');
    return CR2.renderTab('Условия', CR2.db.credits.find(x => x.id === 'K-7')); };
  const before = uslHtml();
  const k7b = CR2.db.credits.find(x => x.id === 'K-7');
  const nTr = k7b.tranches.length;
  const res = CR2.applyDsByNum ? CR2.applyDsByNum('ДС-РС-2003') : { ok:false, reasons:['нет CR.applyDsByNum'] };
  const after = uslHtml();
  ok(131, /ДС-РС-2003/.test(before) && /Применить ДС/.test(before)
          && !/ДС-РС-2001/.test(before.split('Документы без изменения условий')[1] || '')
          && res.ok === true && k7b.tranches.length === nTr + 1
          && !/ДС-РС-2003/.test(after.split('Документы без изменения условий')[1] || '')
          && (k7b.appliedDs || []).length === 3,
     `в хвосте до: ДС-РС-2003 ${/ДС-РС-2003/.test(before)}, кнопка ${/Применить ДС/.test(before)};`
     + ` применено ${res.ok} (${(res.reasons||[]).join(' | ')}), траншей ${nTr}→${k7b.tranches.length},`
     + ` применённых ДС ${(k7b.appliedDs||[]).length}`);
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
         под решением выше контрактных 6 034,61 (4 142,47 + 1 892,14) — заморозка
         накрывает их целиком. Числа пересняты 15.08.2026 (КВ-43): график K-3 считался
         вручную под ≈24 % годовых при ставке 12 и завышал свод вдвое; после пересчёта
         по календарю от даты освоения заморозка равна сумме отрезков листа за позиции
         1–2 (4 142,47 + 1 972,60), было 7 981,86. */
      && Math.abs(d.debt.interest.frozen - 6115.06) < 0.05
      && Math.abs(d.debt.penalty.frozen - 342.44) < 0.05
      && d.ledger.index.get('T1#1').layerId === 'L-1'
      && d.ledger.index.get('T1#3').layerId === null
      && L12.length === 2 && L12[0].id === 'L-1' && L12[1].id === 'L-2'
      && map12.get('T1#1') === 'L-1' && map12.get('T1#2') === 'L-1'
      && map12.get('T1#3') === 'L-2' && !map12.has('T1#4') && !map12.has('T1#5')
      /* K-C12 пересчитан той же волной: `seedSchedule` начисляет от даты освоения по
         календарю, а не плоской помесячной формулой (было 19 497,78 / 6 084,12). */
      && Math.abs(d12.debt.interest.frozen - 19019.18) < 0.05
      && Math.abs(d12.debt.penalty.frozen - 6056.44) < 0.05
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
      /* Позиция 18.06.2026 закрыта платежом 20.06 — на два дня позже срока, и с ADR-0129 §2
         эти два дня начислены пенёй. В очереди она поэтому стоит, но ТОЛЬКО пенёй: тела и
         процентов по ней не осталось. Прежде её не было вовсе — пеня считалась на базе даты
         среза, то есть на нуле. */
      && rs.filter(r => r.due === '18.06.2026').every(r => r.article === 'Пеня')
      && rs.some(r => r.due === '18.06.2026' && r.article === 'Пеня'),
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

/* 105. ПЕНЯ ВПЕРЁД МОЛЧИТ ТАМ, ГДЕ ЕЁ ПРИОСТАНОВИЛ СЛОЙ. Цена дня в строке-контексте
   «Прогноза» складывает penaltyPerDayFwd просроченных строк (до КВ-34 то же слагаемое
   держала плитка «Пеня к ближайшей дате»); строка под решением суда, где режим гасит
   пеню, обязана давать ноль — иначе экран обещает рост, которого не будет. */
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

/* 128. ДЕМО РАЗДЕЛЕНИЯ ПО ДС (КВ-26). К-7 несёт то, чего не несёт ни один другой кредит:
   два ПРИМЕНЁННЫХ ДС, три транша, закрытый переносом источник и статейные колонки в
   графике. Сеется он самой дверью, а не выписан руками, — иначе демо разошлось бы с
   дверью при первой её правке. Г-3 при этом не в минусе: производные сумму договора
   не расходуют (ADR-0115). */
(() => { const db=CR.seedDb(); const k7=byId(db,'K-7');
  const der7 = (k7.tranches||[]).filter(t => CR.trancheOrigin(t) === 'разделение');
  const d7 = CR.derive(k7, CR.TODAY);
  const artCols = CR.scheduleArticleCols(CR.trancheScheduleRows(der7[0] || {}));
  ok(128, k7 && k7.tranches.length === 3 && der7.length === 2
          && (k7.appliedDs||[]).length === 2 && k7.mirror.restructuring.count === 2
          && d7.allocatable >= -0.005 && d7.derivedCount === 2
          && artCols.length >= 2
          && k7.tranches[0].closed && k7.tranches[0].closed.reason === 'перенос',
     `траншей ${k7 && k7.tranches.length} производных ${der7.length} ДС ${(k7&&k7.appliedDs||[]).length}`
     + ` доступно ${d7 && d7.allocatable} статейных колонок ${artCols.length}`);
})();

/* ---- Классификация кредита (Г-34, КР-59; КВ-30 · упрощена КВ-32) ---- */

/* 139. Правка НАПРЯМУЮ доступна после регистрации — волна КВ-32 сняла второй режим
   («изменение по документу» и «корректировку»): у паспортного разряда договора нет
   ни договорённости сторон, ни среза по дате, значит и двух дверей быть не должно. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  c.lifecycle='Действует';
  const set=CR.programClassification(c);
  const nextLine=set.line.find(v => v!==c.line) || set.line[0];
  const values={ kind:c.kind, line:nextLine, purpose:'Пополнение оборотных средств', fundingSource:c.fundingSource };
  const r=CR.editClassification(c,{values});
  ok(139, r.ok===true && c.line===nextLine && c.classificationRecords===undefined,
     `${c.lifecycle}: линия → ${c.line}, слоя записей нет`);
})();

/* 140. Тот же гейт правит и «Проект» — критерия по ЖЦ у Г-34 больше нет вовсе. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  c.lifecycle='Проект';
  const set=CR.programClassification(c);
  const r=CR.editClassification(c,{ values:{ kind:set.kind[0], line:set.line[0],
    purpose:'Инвестиции в осн. средства', fundingSource:set.fundingSource[0] } });
  ok(140, r.ok===true && c.purpose==='Инвестиции в осн. средства' && c.kind===set.kind[0],
     `${c.kind} · ${c.line} · ${c.purpose}`);
})();

/* 141. Г-34: значение вне набора программы отбито, и отказ называет сам набор — иначе
   пользователь не знает, из чего выбирать (набор — зеркало программы, И-11). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const set=CR.programClassification(c);
  c.lifecycle='Действует';
  const g=CR.gate(c,'editClassification',{ values:{ kind:'Ипотека', line:set.line[0],
    purpose:'Цель', fundingSource:set.fundingSource[0] } });
  const r=CR.editClassification(c,{ values:{ kind:'Ипотека', line:set.line[0],
    purpose:'Цель', fundingSource:set.fundingSource[0] } });
  ok(141, g.ok===false && r.ok===false && g.reasons.join(' ').includes(set.kind[0]) && c.kind!=='Ипотека',
     g.reasons.join(' | ').slice(0,90));
})();

/* 142. Пустое справочное значение обязательно, «Цель» — нет: классификатора целей у
   модуля не существует, а вид/линия/источник берутся из справочника. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  const set=CR.programClassification(c);
  const gEmptyKind=CR.gate(c,'editClassification',{ values:{ kind:'', line:set.line[0],
    purpose:'', fundingSource:set.fundingSource[0] } });
  const gEmptyPurpose=CR.gate(c,'editClassification',{ values:{ kind:set.kind[0], line:set.line[0],
    purpose:'', fundingSource:set.fundingSource[0] } });
  ok(142, gEmptyKind.ok===false && /Вид кредита обязателен/.test(gEmptyKind.reasons.join(' ')) && gEmptyPurpose.ok===true,
     gEmptyKind.reasons.join(' | ').slice(0,60) + ' // цель пустой быть вправе');
})();

/* 143. История правки живёт в журнале — одна запись на действие с before/after, как у
   реквизитов договора. Другого следа у классификации теперь нет, и он обязан быть полным. */
(() => { const db=CR.seedDb(); const c=byId(db,'K-1');
  c.lifecycle='Действует';
  const set=CR.programClassification(c);
  const wasLine=c.line, nextLine=set.line.find(v => v!==wasLine) || set.line[0];
  const before=c.audit.length;
  CR.editClassification(c,{ values:{ kind:c.kind, line:nextLine, purpose:c.purpose, fundingSource:c.fundingSource } });
  const last=c.audit[c.audit.length-1];
  ok(143, c.audit.length===before+1 && last.what==='editClassification'
          && last.before.line===wasLine && last.after.line===nextLine,
     `${last.what}: ${last.before.line} → ${last.after.line}`);
})();

/* 144. КР-59: затравка выровнена по справочникам — вид/линия/источник КАЖДОГО кредита
   лежат в наборе своей программы. Без этого собственный гейт отбил бы все 59 кредитов:
   в «Источнике финансирования» лежало значение справочника «Вид кредита». */
(() => { const db=CR.seedDb();
  const bad=db.credits.filter(c => {
    const set=CR.programClassification(c);
    return !set.kind.includes(c.kind) || !set.line.includes(c.line) || !set.fundingSource.includes(c.fundingSource);
  });
  ok(144, db.credits.length>=59 && bad.length===0,
     `кредитов ${db.credits.length}, вне набора ${bad.length}${bad.length?': '+bad.slice(0,3).map(c=>c.id+'/'+c.kind+'/'+c.fundingSource).join(', '):''}`);
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
