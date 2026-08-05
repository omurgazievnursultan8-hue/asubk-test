import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'credit.html'), 'utf8');

/* Свежий DOM на каждый тест → изоляция: тесты мутируют CR.db (освоения, графики).
   url обязателен — без него openDetail падает с DOMException на history.replaceState. */
export function load() {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://mockup.test/credit.html',
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches:false, media:'', onchange:null,
        addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
      window.scrollTo = window.scrollTo || (()=>{});
    }
  });
  const win = dom.window;
  if (!win.CR) throw new Error('window.CR seam missing — скрипт не выполнился или шов отсутствует');
  if (!win.CR.db) throw new Error('CR.db пуст — сид не отработал');
  return { dom, win, CR: win.CR };
}

/* Единственная фикстура с ДВУМЯ построенными графиками. В сиде многотраншевых
   кредитов три (K-1, K-C40, K-C41) и ни у одного нет графика ни на одном транше;
   у K-C40 вдобавок расходится метод погашения (аннуитет | равными долями) —
   ровно случай «несколько методов погашения» из спеки. */
export function multiCredit(CR) {
  const c = CR.db.credits.find(x => x.id === 'K-C40');
  if (!c) throw new Error('фикстура K-C40 исчезла из сида');
  CR.addDisbursement(c, { trancheNo: 2, amount: c.tranches[1].amount, date: '01.03.2026' });
  CR.generateSchedule(c, 1, { from: '15.02.2026' });
  CR.generateSchedule(c, 2, { from: '01.03.2026' });
  return c;
}

/* Второй многотраншевый фикстур с построенными графиками — в отличие от multiCredit
   (K-C40, методы расходятся нарочно), у K-1 оба транша «аннуитет»: общий случай
   addTranche (новый транш сеет условия от того же credit-level baseConditions, что
   и первый), а не исключение. Нужен T3-7 — случаю «метод общий, платёж свой у
   каждого» ничто больше не соответствует. Транш №1 уже освоен в сиде (18.05.2026);
   транш №2 досеиваем освоением здесь же, как multiCredit делает для K-C40. */
export function sameMethodCredit(CR) {
  const c = CR.db.credits.find(x => x.id === 'K-1');
  if (!c) throw new Error('фикстура K-1 исчезла из сида');
  CR.addDisbursement(c, { trancheNo: 2, amount: c.tranches[1].amount, date: '01.09.2026' });
  CR.generateSchedule(c, 1, { from: '18.05.2026' });
  CR.generateSchedule(c, 2, { from: '01.09.2026' });
  return c;
}

let passed = 0, failed = 0; const fails = [];
export function test(name, fn){ try { fn(); passed++; } catch(e){ failed++; fails.push(`  ✗ ${name}\n    ${e.message}`); } }
export function eq(a,b,msg){ if(a!==b) throw new Error(`${msg||'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
export function ok(v,msg){ if(!v) throw new Error(msg||'expected truthy'); }
export function no(v,msg){ if(v) throw new Error(msg||'expected falsy'); }
export function has(hay,needle,msg){ if(!String(hay).includes(needle)) throw new Error(`${msg||'has'}: "${needle}" not found`); }
export function hasNot(hay,needle,msg){ if(String(hay).includes(needle)) throw new Error(`${msg||'hasNot'}: "${needle}" unexpectedly present`); }
export function report(){ console.log(`\n${passed} passed, ${failed} failed`); fails.forEach(f=>console.log(f)); if(failed) process.exit(1); }
