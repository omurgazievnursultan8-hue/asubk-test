import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'zalog-v2.html'), 'utf8');

// Свежий DOM на каждый тест — тесты мутируют состояние прототипа.
export function load() {
  const errs = [];
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches:false, media:'', onchange:null,
        addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
      window.scrollTo = window.scrollTo || (()=>{});
      window.addEventListener('error', e => errs.push(e.error || e.message));
    }
  });
  const win = dom.window;
  if (errs.length) throw new Error('ошибка исполнения скрипта: ' + errs[0]);
  if (!win.__zt) throw new Error('window.__zt отсутствует — скрипт не выполнился');
  return { dom, win, zt: win.__zt, html: () => win.document.getElementById('root').innerHTML };
}

let passed = 0, failed = 0; const fails = [];
export function test(name, fn){ try { fn(); passed++; } catch(e){ failed++; fails.push(`  ✗ ${name}\n    ${e.message}`); } }
export function eq(a,b,msg){ if(a!==b) throw new Error(`${msg||'eq'}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }
export function near(a,b,msg,eps=0.005){ if(Math.abs(a-b)>eps) throw new Error(`${msg||'near'}: ожидалось ~${b}, получено ${a}`); }
export function ok(v,msg){ if(!v) throw new Error(msg||'ожидалось истинное'); }
export function no(v,msg){ if(v) throw new Error(msg||'ожидалось ложное'); }
export function has(hay,needle,msg){ if(!String(hay).includes(needle)) throw new Error(`${msg||'has'}: «${needle}» не найдено`); }
export function hasNot(hay,needle,msg){ if(String(hay).includes(needle)) throw new Error(`${msg||'hasNot'}: «${needle}» неожиданно присутствует`); }
export function report(){ console.log(`\n${passed} passed, ${failed} failed`); fails.forEach(f=>console.log(f)); if(failed) process.exit(1); }
