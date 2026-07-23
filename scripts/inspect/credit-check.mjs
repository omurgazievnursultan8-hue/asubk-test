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
/* 10. Р-8/Г-6→освоение после ввода КМ (проверка перехода готовится тут, финализируется в Task 5). */
(() => { const db=CR.seedDb(); const c=byId(db,'K-5');
  ok(10, CR.gate(c,'addDisbursement',{trancheNo:1,amount:1}).ok===false); // покрытие 84%
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

// … далее Task 5+ дописывают ok(5,7,13…16,18,22,27,28) …

const pass = results.filter(r => r.pass).length;
const stamp = `SMOKE (node) ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS`;
results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`));
console.log(stamp);
// впечатать stamp + список в блок «SMOKE (node ...)» шапки HTML
const list = results.map(r => `   #${r.n} ${r.pass ? '✓' : '✗ ' + r.note}`).join('\n');
const block = `SMOKE (node)\n ${stamp}\n${list}`;
const out = src.replace(/SMOKE \(node\)[\s\S]*?(?=\n\s*-->)/, block + '\n');
writeFileSync(HTML, out, 'utf8');
if (pass !== results.length) process.exit(1);
