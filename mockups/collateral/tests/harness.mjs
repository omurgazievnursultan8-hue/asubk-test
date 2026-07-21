import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'zalog.html'), 'utf8');

// Свежий DOM на каждый тест → изоляция (тесты мутируют CREDITS/ITEMS/CONTRACTS).
export function load() {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches:false, media:'', onchange:null,
        addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
      window.scrollTo = window.scrollTo || (()=>{});
    }
  });
  const win = dom.window;
  if (!win.__zt) throw new Error('window.__zt seam missing — скрипт не выполнился или шов отсутствует');
  return { dom, win, zt: win.__zt };
}

let passed = 0, failed = 0; const fails = [];
export function test(name, fn){ try { fn(); passed++; } catch(e){ failed++; fails.push(`  ✗ ${name}\n    ${e.message}`); } }
export function eq(a,b,msg){ if(a!==b) throw new Error(`${msg||'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
export function near(a,b,msg,eps=0.005){ if(Math.abs(a-b)>eps) throw new Error(`${msg||'near'}: expected ~${b}, got ${a}`); }
export function ok(v,msg){ if(!v) throw new Error(msg||'expected truthy'); }
export function no(v,msg){ if(v) throw new Error(msg||'expected falsy'); }
export function has(hay,needle,msg){ if(!String(hay).includes(needle)) throw new Error(`${msg||'has'}: "${needle}" not found`); }
export function hasNot(hay,needle,msg){ if(String(hay).includes(needle)) throw new Error(`${msg||'hasNot'}: "${needle}" unexpectedly present`); }
export function report(){ console.log(`\n${passed} passed, ${failed} failed`); fails.forEach(f=>console.log(f)); if(failed) process.exit(1); }
