// Харнесс смоука «Имущество Фонда»: свежий JSDOM на каждую группу, проверки с печатью ✓/✗.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'assets.html'), 'utf8');

// jsdom лежит в node_modules корня репозитория; из git-worktree поднимаемся до основного чекаута.
function findJsdom() {
  const roots = [];
  let d = HERE; for (let i = 0; i < 8; i++) { roots.push(d); d = dirname(d); }
  const cut = HERE.indexOf(`${sep}.claude${sep}worktrees${sep}`);
  if (cut > 0) roots.push(HERE.slice(0, cut));
  for (const r of roots) if (existsSync(join(r, 'node_modules', 'jsdom'))) return createRequire(join(r, 'package.json'))('jsdom');
  throw new Error('jsdom не найден: выполните npm i в корне репозитория');
}
const { JSDOM, VirtualConsole } = findJsdom();

// Свежий DOM = свежее состояние (макет мутирует OFFERS/OBJECTS) → порядок групп не важен.
export function load() {
  const errs = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(String((e && e.message) || e)));
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })); w.scrollTo = w.scrollTo || (() => {}); } });
  const w = dom.window;
  if (!w.IM) throw new Error('window.IM отсутствует — скрипт не выполнился или шов убран');
  return { dom, w, IM: w.IM, errs, doc: w.document };
}

let passed = 0, failed = 0; const fails = [];
export function ck(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else {
    failed++;
    const m = '  ✗ ' + name + (detail !== undefined ? '\n      факт: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '');
    console.log(m); fails.push(m);
  }
}
// Группа = сценарий/инвариант; исключение внутри группы — тоже провал, остальные группы идут дальше.
export function group(label, fn) {
  console.log('\n' + label);
  try { fn(load()); } catch (e) {
    failed++;
    const m = `  ✗ (исключение) ${label}\n      ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`;
    console.log(m); fails.push(m);
  }
}
export const digits = s => String(s).replace(/\D/g, '');
export function report() {
  console.log(`\n${passed + failed} проверок: ${passed} пройдено, ${failed} провалено`);
  if (failed) { console.log('\nПровалы:'); fails.forEach(f => console.log(f)); process.exit(1); }
}
