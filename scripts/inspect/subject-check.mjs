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

// ── Модель и производные (Task 2) ──
ok('1.1 три источника представлены в наборе',
  ['individuals','organizations','groups'].every(src => g.ev(`SUBJECTS.some(s=>s.source==='${src}')`)));
ok('1.2 инвариант 1: ключи уникальны',
  g.ev("(()=>{const k=SUBJECTS.map(s=>s.key).filter(Boolean);return new Set(k).size===k.length;})()"));
ok('1.3 инвариант 2: у группы ключ ГР-NNN и ИНН пуст, у прочих — 14 цифр либо ключа нет вовсе',
  g.ev("SUBJECTS.every(s => s.source==='groups' ? /^ГР-\\d{3}$/.test(s.key) && !s.inn : (s.key==='' || /^\\d{14}$/.test(s.key)))"));
ok('1.4 инвариант 4: хранимого типа лица нет ни у одной записи',
  g.ev("SUBJECTS.every(s=>!('personKind' in s) && !('isIP' in s) && !('roles' in s))"));
ok('1.5 keyKind различает ИНН и внутренний ключ группы',
  g.ev("keyKind('01204199910016')")==='ИНН' && g.ev("keyKind('ГР-001')")==='ГР');
// ADR-0018: физлицо бывает ИП период, потом перестаёт — тип считается на дату.
ok('1.6 personKindAt: в период регистрации ИП — «ИП», после прекращения — «физ»',
  g.ev("personKindAt('04401199940041','01.06.2020')")==='ИП' &&
  g.ev("personKindAt('04401199940041','01.06.2026')")==='физ');
ok('1.7 personKindAt: организация и группа от даты не зависят',
  g.ev("personKindAt('01204199910016','01.01.2011')")==='юр' &&
  g.ev("personKindAt('01204199910016',TODAY)")==='юр' &&
  g.ev("personKindAt('ГР-001',TODAY)")==='группа');
ok('1.8 у физлица без регистрации ИП тип «физ» на любую дату',
  g.ev("personKindAt('07701199970071','01.01.2015')")==='физ' &&
  g.ev("personKindAt('07701199970071',TODAY)")==='физ');
// ADR-0019: присоединённый ключ не исчезает — он разрешается в главного субъекта.
ok('1.9 resolveKey разрешает псевдоним, keysOf возвращает ключ и его псевдонимы',
  g.ev("resolveKey('S-DUP')")===g.ev("resolveKey(resolveKey('S-DUP'))") &&
  g.ev("keysOf('07701199970071').length") >= 1);
ok('1.10 инвариант 5: роли выводятся — функции создания/удаления роли нет',
  g.ev("typeof addRole")==='undefined' && g.ev("typeof removeRole")==='undefined');
ok('1.11 subjectRoles возвращает роль заёмщика при наличии кредитов',
  g.ev("subjectRoles('01204199910016').some(r=>r.role==='Заёмщик')"));
ok('1.12 subjectRoles: залогодатель по ЧУЖОМУ кредиту тоже роль',
  g.ev("subjectRoles('07701199970071').some(r=>r.role==='Залогодатель')"));
ok('1.13 зеркала не содержат собственных полей субъекта (ADR-0014)',
  g.ev("CREDITS.every(c=>!('name' in c) && !('district' in c))"));
ok('1.14 в наборе есть закрытая регистрация ИП, групповой заёмщик с составом и пара-дубль без ключа',
  g.ev("IP_REG.some(r=>r.to)") &&
  g.ev("LINKS.some(l=>l.kind==='член группы')") &&
  g.ev("SUBJECTS.filter(s=>s.key==='').length") >= 2);
// СБ-13: стоп-фактор — зеркало события, своей точки ввода у него нет.
ok('1.15 стоп-фактор выводится из события и несёт его дату и документ',
  g.ev("stopFactors('07701199970071').length")===1 &&
  g.ev("stopFactors('07701199970071')[0].text")==='Лицо умерло' &&
  g.ev("stopFactors('07701199970071')[0].date")==='20.01.2025' &&
  g.ev("stopFactors('07701199970071')[0].doc")==='СС-4471' &&
  g.ev("stopFactors('01204199910016').length")===0);

console.log(`\n${n - fails} / ${n} PASS`);
process.exit(fails ? 1 : 0);
