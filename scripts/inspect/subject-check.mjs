// Смоук-проверка макета субъекта (mockups/subject/subject.html) на jsdom.
// Спецификация: docs/superpowers/specs/2026-07-29-subject-mockup-design.md.
// Запуск: node scripts/inspect/subject-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML = readFileSync(resolve('mockups/subject/subject.html'), 'utf8');

function mk(){
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail?.message || e.message)));
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost/' });
  const w = dom.window, doc = w.document;
  const ev = s => w.eval(s);
  const $  = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  return { dom, w, doc, ev, $, $$, errs };
}

let fails = 0, n = 0;
const ok = (name, cond) => { n++; if (!cond) fails++; console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); };

const g = mk();

// ── Каркас (Task 1) ──
ok('0.1 страница загрузилась без ошибок jsdom', g.errs.length === 0);
ok('0.2 TODAY зафиксирован на 13.07.2026', g.ev("TODAY") === '13.07.2026');
ok('0.3 три вида в разметке', !!g.$('#view-list') && !!g.$('#view-card') && !!g.$('#view-merge'));
ok('0.4 пустой hash → активен реестр',
  (() => { g.ev("location.hash=''"); g.ev("route()"); return g.$('#view-list').classList.contains('active'); })());
ok('0.5 неизвестный ключ в маршруте не бросает и падает в реестр',
  (() => { g.ev("location.hash='#/s/00000000000000'"); g.ev("route()");
           return g.errs.length === 0 && g.$('#view-list').classList.contains('active'); })());
ok('0.6 даты: dnum сравнивает, toISO/fromISO обратимы',
  g.ev("dnum('01.01.2026') < dnum('02.01.2026')") &&
  g.ev("fromISO(toISO('14.05.2026'))") === '14.05.2026');
ok('0.7 esc экранирует разметку', g.ev("esc('<b>&\"')") === '&lt;b&gt;&amp;&quot;');

console.log(`\n${n - fails} / ${n} PASS`);
process.exit(fails ? 1 : 0);
