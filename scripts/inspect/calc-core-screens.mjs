/* ЭКРАНЫ СТЕНДА — ПРОВЕРКА РЕНДЕРА БЕЗ БРАУЗЕРА.
   `calc-core-check.mjs` сверяет ЧИСЛА ядра и до экранов не доходит: renderProj и
   renderPortfolio там не вызываются ни разу, и сломать их можно, не уронив ни одной
   проверки. Здесь поднят поддельный DOM — ровно тот кусок, которым пользуется стенд
   (createElement, querySelector по id, innerHTML, appendChild), — и экраны прогоняются
   по состояниям: проекция — открытие · повторный прогон · решение суда · перестроение ·
   остановка · сброс; портфель — свод, ведомость, разрезы, отказы, счётчик обращений;
   эпизоды просрочки — исходный стенд · К-7 погасил просрочку · решение суда по К-4 ·
   перестроение (кредит выпал с причиной).
   Проверяется не вёрстка, а что рендер доходит до конца и печатает то же, что отдало
   ядро: пустая таблица там, где ожидались строки, — это дефект.

   Зависимостей нет: node scripts/inspect/calc-core-screens.mjs */
import fs from 'node:fs';
import vm from 'node:vm';

const mkNode = (tag) => {
  const n = { tag, className:'', children:[], dataset:{}, style:{},
    disabled:false, onclick:null,
    appendChild(c){ n.children.push(c); return c; },
    classList:{ add(){}, remove(){}, contains(){ return false; } },
    querySelector(){ return mkNode('stub'); }, querySelectorAll(){ return []; } };
  /* Как в настоящем DOM: присвоение любого из двух СНОСИТ второе и детей. Без этого
     узел, которому сперва положили текст, а потом разметку, отдаёт старый текст —
     и проверка читает то, чего на экране уже нет. Ровно так и вышло: экран показывал
     разрез, а сторож видел «Разрез не выбран». */
  let h = '', t = '';
  Object.defineProperty(n, 'innerHTML',
    { get:() => h, set:(v) => { h = String(v); t = ''; n.children.length = 0; } });
  Object.defineProperty(n, 'textContent',
    { get:() => (t || h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
      set:(v) => { t = String(v); h = ''; n.children.length = 0; } });
  return n;
};
const byId = new Map();
const document = {
  createElement: mkNode,
  querySelector(sel){ if (!byId.has(sel)) byId.set(sel, mkNode('sel' + sel)); return byId.get(sel); },
  querySelectorAll(){ return []; },
  addEventListener(){},
};
const rowsOf = (id) => { const t = byId.get(id); if (!t) return []; const out = [];
  const walk = (n) => { if (n.tag === 'tr') out.push(n); for (const c of n.children) walk(c); };
  for (const c of t.children) walk(c); return out; };
const bodyRows = (id) => { const t = byId.get(id); if (!t) return [];
  const b = t.children.find(c => c.tag === 'tbody'); return b ? b.children : []; };
const text = (id) => { const n = byId.get(id); if (!n) return '';
  return String(n.textContent || '').replace(/<[^>]+>/g, ' ').trim()
      || String(n.innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };

const html = fs.readFileSync('mockups/calc-core/calc-core.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const ctx = { window:{}, console, Intl, document };
vm.createContext(ctx);
for (const b of blocks) vm.runInContext(b, ctx, { filename:'calc-core.html' });
const run = (js) => vm.runInContext(js, ctx);

let bad = 0;
const ok = (cond, what, got) => {
  if (!cond) bad++;
  console.log('   ' + (cond ? '✓' : '✗') + ' ' + what + (got === undefined ? '' : ' — ' + got));
};
const step = (title, js, checks) => {
  run(js); run('renderProj()');
  console.log('\n' + title);
  console.log('   · ' + (text('#proj-msg') || '(без сообщения)').slice(0, 150));
  checks();
};

/* Сначала — ЦЕЛИКОМ boot(): он не только рисует, но и развешивает обработчики и
   наполняет выпадающие списки. Опечатка в id разреза или в имени кнопки живёт именно
   здесь и на числах ядра никак не сказывается. */
console.log('ЗАГРУЗКА СТЕНДА — boot()');
run('boot()');
ok(byId.get('#pf-by').children.length === 6, 'разрезы в списке', byId.get('#pf-by').children.length);
ok(byId.get('#pf-cur').children.length >= 2, 'валюты отчёта в списке', byId.get('#pf-cur').children.length);
ok(byId.get('#pf-from').children.length === 3, 'начала периода в списке');
ok(typeof byId.get('#pf-measure').onclick === 'function', 'кнопка замера обработана');
ok(typeof byId.get('#pj-run').onclick === 'function', 'кнопка прогона обработана');
ok(byId.get('#sel-credit').children.length === 5, 'кредиты в списке');
ok(byId.get('#obj-kind').children.length === 5, 'виды объектов в списке — и те, у кого перечня нет',
   byId.get('#obj-kind').children.length);
ok(byId.get('#obj-viewer').children.length === 3, 'смотрящие в списке');
ok(typeof byId.get('#obj-drop').onclick === 'function', 'кнопка снятия поля обработана');
/* СПИСОК ШВОВ И ПРОГОН ПО НИМ. Заголовок «Восемь швов» и длина массива разъезжаются
   молча: пять карточек под словом «шесть» так и жили, потому что считать их некому. */
const seamCards = byId.get('#seam-cards').children.map(c => String(c.children[0].innerHTML)
  .replace(/<[^>]+>/g, ''));
ok(seamCards.length === 9 && /Девять швов — по вопросу/.test(html) && !/Восемь швов/.test(html), 'швов ровно девять — сколько названо в заголовке', seamCards.length);
ok(seamCards[6] === 'calcPortfolio(отбор, вопрос)' && seamCards[7] === 'objectRows(вид объекта, вопрос)'
   && seamCards[8] === 'overdueSpells(отбор, отрезок дат)',
   'подпись стоит рядом с именем и у каждого своя', seamCards.slice(6).join(' · '));
ok(bodyRows('#tb-seams').length === 9, 'прогон печатает все девять', bodyRows('#tb-seams').length);
ok(bodyRows('#tb-seams').every(r => !/undefined|NaN/.test(r.innerHTML)),
   'ни одна строка прогона не печатает undefined');

/* boot() уже прогнал проекцию — дальше состояния считаются от нуля, иначе первый же
   счёт прогонов сдвинут на один и проверять его нечем. */
run('projReset(); seedFixations()');
step('ОТКРЫТИЕ ЭКРАНА — прогон в boot()', 'projRun(FIXTURE, {})', () => {
  ok(bodyRows('#tb-runs').length === 1, 'прогон один', bodyRows('#tb-runs').length);
  ok(bodyRows('#tb-projq').length === 5, 'очередь показывает весь портфель');
  ok(text('#proj-q-lead').startsWith('В очереди 0 из 5'), 'после прогона очередь пуста', text('#proj-q-lead').slice(0, 20));
  ok(bodyRows('#tb-projrows').length > 20, 'строки кредита есть', bodyRows('#tb-projrows').length);
  ok(/Прочитано строк/.test(text('#proj-read-lead')), 'чтение отвечает');
  ok(bodyRows('#tb-projread').length === 7, 'шесть ячеек + итог', bodyRows('#tb-projread').length);
  ok(/сходится/.test(text('#proj-chk-lead')), 'сверка со швом 2 сходится', text('#proj-chk-lead').slice(0, 60));
  ok(bodyRows('#tb-projvol').length === 6, 'объём: пять кредитов и итог');
});
step('ПОВТОРНЫЙ ПРОГОН — идемпотентность', 'actProjRun()', () => {
  ok(/очередь пуста/.test(text('#proj-msg')), 'взят ноль кредитов');
  ok(bodyRows('#tb-runs').length === 2, 'поколение записано и пустое', bodyRows('#tb-runs').length);
  ok(/Строк 34 /.test(text('#proj-rows-lead')), 'строк не прибавилось', text('#proj-rows-lead').slice(0, 8));
});
step('РЕШЕНИЕ СУДА ПО К-4 — вход новее строк', 'actProjCourt()', () => {
  ok(text('#proj-q-lead').startsWith('В очереди 1 из 5'), 'антиджойн взял ОДИН кредит из пяти',
     text('#proj-q-lead').slice(0, 18));
  ok(/Прочитано строк/.test(text('#proj-read-lead')), 'до прогона свод отвечает прежними числами');
});
step('ПРОГОН ПОСЛЕ РЕШЕНИЯ — появился слой', 'actProjRun(); CUR = FIXTURE.find(c => c.id === "K-4")', () => {
  ok(/пересчитано кредитов 1 из 5/.test(text('#proj-msg')), 'переписан один кредит');
  ok(/на 9 ячеек/.test(text('#proj-rows-lead')), 'ячеек стало девять: слой добавил три',
     text('#proj-rows-lead').slice(0, 40));
  ok(/сходится/.test(text('#proj-chk-lead')), 'сверка со швом 2 сходится и под слоем',
     text('#proj-chk-lead').slice(0, 60));
  const cells = bodyRows('#tb-projread').map(r => r.innerHTML);
  ok(cells.some(h => /L-1/.test(h)), 'слой L-1 виден в ответе');
});
step('РАСПОРЯЖЕНИЕ О ПЕРЕСТРОЕНИИ — чтение отказывает', 'actProjRebuild()', () => {
  ok(/перестроение/.test(text('#proj-q-lead')) || bodyRows('#tb-projq').some(r => /перестроение/.test(r.innerHTML)),
     'кредит в очереди по распоряжению');
  ok(/отказ.*перестроение/.test(text('#proj-read-lead')), 'отказ назван, а не отдан ноль',
     text('#proj-read-lead').slice(0, 70));
  ok(/отказ/.test(text('#proj-chk-lead')), 'сверять нечего');
});
step('ПРОГОН С ОСТАНОВКОЙ — недостроенное не читается', 'actProjStage()', () => {
  ok(/НЕ объявлено/.test(text('#proj-msg')), 'поколение построено, но не объявлено');
  ok(bodyRows('#tb-runs').some(r => /не объявлено/.test(r.innerHTML)), 'состояние видно в таблице прогонов');
  ok(/отказ/.test(text('#proj-read-lead')), 'чтение по-прежнему отказывает');
});
step('ПУБЛИКАЦИЯ — одно переключение', 'actProjPublish()', () => {
  ok(/объявлено действующим/.test(text('#proj-msg')), 'поколение объявлено');
  ok(/Прочитано строк/.test(text('#proj-read-lead')), 'чтение вернулось', text('#proj-read-lead').slice(0, 30));
  ok(text('#proj-q-lead').startsWith('В очереди 0 из 5'), 'распоряжение снято публикацией');
});
step('ДАТА ЗА ГОРИЗОНТОМ ПРОГОНА', 'ON = "31.12.2026"', () => {
  ok(/позже горизонта/.test(text('#proj-read-lead')), 'будущее отвечает прогноз, а не проекция',
     text('#proj-read-lead').slice(0, 80));
});
step('СБРОС — производная строится с нуля', 'ON = "23.07.2026"; actProjReset()', () => {
  ok(bodyRows('#tb-runs').length === 1 && /Прогонов не было/.test(bodyRows('#tb-runs')[0].innerHTML),
     'прогонов нет');
  ok(text('#proj-q-lead').startsWith('В очереди 5 из 5'), 'в очередь встал весь портфель');
  ok(/проекции нет/.test(text('#proj-read-lead')), 'чтение отказывает названной причиной');
});
step('ПОВТОРНЫЙ ПРОГОН С НУЛЯ — те же числа', 'actProjRun()', () => {
  ok(/пересчитано кредитов 5 из 5/.test(text('#proj-msg')), 'пересчитан весь портфель');
  ok(/сходится/.test(text('#proj-chk-lead')), 'сверка со швом 2 сходится', text('#proj-chk-lead').slice(0, 60));
});

/* ─────────────────────────── ЭКРАН ПОРТФЕЛЯ ─────────────────────────── */
const cell = (id, row, col) => {
  const r = bodyRows(id)[row];
  if (!r) return '';
  const tds = String(r.innerHTML).split(/<\/td>/).map(x => x.replace(/<[^>]*>/g, '').trim());
  return tds[col] === undefined ? '' : tds[col];
};
const numOf = (s) => Number(String(s).replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.'));

const pstep = (title, js, checks) => {
  if (js) run(js);
  run('renderPortfolio()');
  console.log('\n' + title);
  checks();
};

run('ON = "23.07.2026"; PF_BY = "unit"; PF_CUR = "KGS"; PF_FROM = "01.05.2026"');
pstep('ПОРТФЕЛЬ · СВОД И ВЕДОМОСТЬ, разрез «подразделение»', null, () => {
  const forms = bodyRows('#tb-pfform').map(r => cell('#tb-pfform', bodyRows('#tb-pfform').indexOf(r), 1));
  /* С волны 7 к каждой форме прибавлено ОДНО обращение — реестр расходов взыскания:
     седьмая статья приходит отдельным множеством и присоединяется итогом в ядре.
     Норма ADR-0191 — «число обращений не растёт с размером отбора», а не «ровно одно»
     (ADR-0194 §4): две выборки на портфель любого размера — такая же константа. */
  ok(forms.join('/') === '2/3/4', 'обращений по форме вопроса: 2 · 3 · 4 (константа, не единица)',
     forms.join('/'));
  ok(/Обращений к хранилищу: 2/.test(text('#pf-at-lead')),
     'свод на дату — два обращения: проекция и реестр расходов',
     text('#pf-at-lead').slice(0, 80));
  ok(bodyRows('#tb-pfat').length === 8, 'семь статей и итог', bodyRows('#tb-pfat').length);
  ok(/сходится/.test(text('#pf-cut-lead')), 'сумма разрезов равна итогу',
     text('#pf-cut-lead').slice(0, 120));
  ok(/Обращений: 4/.test(text('#pf-sheet-lead')),
     'период с разрезом — четыре обращения: две границы, разрез и реестр',
     text('#pf-sheet-lead').slice(0, 60));
  ok(/ноль по всем статьям/.test(text('#pf-sheet-lead')), 'невязка ведомости нулевая');
  ok(/гасят друг друга/.test(text('#pf-cuts-lead')), 'передано равно принятому',
     text('#pf-cuts-lead').slice(0, 130));
  ok(!/≠ итога/.test(text('#pf-cuts-lead')), 'сальдо разрезов равно итогу');
  ok(bodyRows('#tb-pfcuts').length > 6, 'ведомость по разрезу не пуста', bodyRows('#tb-pfcuts').length);
  ok(/Не выпал ни один/.test(text('#pf-drop-lead')), 'отказов нет', text('#pf-drop-lead').slice(0, 40));
  ok(/Замер не запускался/.test(String(byId.get('#tb-pfmeasure').children
     .map(c => c.children.map(x => x.innerHTML).join('')).join(''))), 'замер по кнопке, а не на рендере');
});

/* КОНВЕРТ И СЕДЬМАЯ СТАТЬЯ. Ответ ядра — не число: дата, валюта с курсом и его снимком,
   учётный период, список проблем. Седьмая статья приходит чужим множеством и
   присоединяется итогом в ядре, на ту же дату, что и проекция (ADR-0194, ADR-0195; ИЯ-14). */
pstep('ПОРТФЕЛЬ · КОНВЕРТ ОТВЕТА И СЕДЬМАЯ СТАТЬЯ', 'ON = "23.07.2026"', () => {
  ok(bodyRows('#tb-pfenv').length === 8, 'восемь полей конверта', bodyRows('#tb-pfenv').length);
  ok(/Кодов проблем заведено 6/.test(text('#pf-env-lead')), 'список кодов закрыт шестью',
     text('#pf-env-lead').slice(0, 90));
  const env = String(byId.get('#tb-pfenv').children.map(c => c.children
    .map(x => x.innerHTML).join('')).join(''));
  ok(/снимок на дату/.test(env) && /не задан/.test(env), 'курс назван вместе с датой снимка');
  ok(/07\.2026/.test(env) && /открыт/.test(env), 'учётный период и его состояние в конверте');
  ok(/предварительный/.test(env), 'признак ответа выведен из проблем');
  ok(/noRate/.test(env), 'код проблемы напечатан машиночитаемо');
  ok(/владелец взыскание/.test(env), 'присоединённое названо чужим');

  /* Признак «предварительный» ВЫВОДИТСЯ из списка: заметка про закрытый период
     предварительным ответ не делает, а отказ и предупреждение — разные виды. */
  ok(run('envelope({ on:"30.06.2026", periods:PERIODS, body:{} }).problems.length') === 1
     && run('envelope({ on:"30.06.2026", periods:PERIODS, body:{} }).problems[0].code') === 'periodClosed',
     'закрытый период попадает в конверт сам, без просьбы');
  ok(run('envelope({ on:"30.06.2026", periods:PERIODS, body:{} }).preliminary') === false,
     'заметка не делает ответ предварительным');
  ok(run('envelope({ on:"23.07.2026", periods:PERIODS, body:{}, problems:[envProblem("noRate")] }).preliminary') === true,
     'нет курса — ответ предварительный');
  ok(run('(() => { try { envProblem("прочее"); return "не бросил"; } catch (e){ return "бросил"; } })()')
     === 'бросил', 'незнакомый код — ошибка, а не «прочее»');
  ok(run('envelope({ on:"23.07.2026" }).answered') === false
     && run('envelope({ on:"23.07.2026", body:{ total:{ balance:0 } } }).answered') === true,
     '«долга нет» и «долг не посчитан» различаются полем, а не значением');

  /* СЕДЬМАЯ СТАТЬЯ. */
  ok(bodyRows('#tb-pfrec').length === 6, 'реестр расходов показан целиком',
     bodyRows('#tb-pfrec').length);
  ok(bodyRows('#tb-pfrec').some(r => /отмена/.test(r.innerHTML))
     && bodyRows('#tb-pfrec').some(r => /возмещение/.test(r.innerHTML)),
     'в реестре есть и возмещение, и отмена — одометры те же');
  const art = bodyRows('#tb-pfat').find(r => /присоединена/.test(r.innerHTML));
  ok(!!art, 'седьмая статья в своде помечена присоединённой');
  ok(art && (art.innerHTML.match(/—/g) || []).length >= 2,
     'просроченной и срочной части у неё нет');
  ok(/на ту же дату, что и проекция/.test(text('#pf-rec-lead')), 'дата присоединения названа',
     text('#pf-rec-lead').slice(-90));
  ok(run('calcPortfolio(FIXTURE, { on:ON }).joined.on') === run('ON'),
     'ADR-0194 §5: итог присоединён на дату ответа');
  ok(run('(() => { try { pfEnvelope({ rate:[] }, { on:"23.07.2026", joinedOn:"28.08.2026" });'
     + ' return "не бросил"; } catch (e){ return "бросил"; } })()') === 'бросил',
     'расхождение дат ловится, а не подразумевается');
  const sheet = bodyRows('#tb-pfsheet');
  const rec = sheet.find(r => /Расходы по обращению/.test(r.innerHTML));
  ok(!!rec && !/alarm/.test(String(rec.className || '')),
     'седьмая статья в ведомости сходится тем же кодом, что шесть своих');
});

pstep('ПОРТФЕЛЬ · ПРИЗНАК БЕЗ ИСТОРИИ — сказано вслух', 'PF_BY = "region"', () => {
  ok(/истории нет/.test(text('#pf-cut-lead')), 'отсутствие истории названо в ответе',
     text('#pf-cut-lead').slice(0, 130));
  ok(/сходится/.test(text('#pf-cut-lead')), 'сумма разрезов всё равно равна итогу');
  ok(bodyRows('#tb-pfcuts').some(r => /без истории/.test(r.innerHTML)),
     'строка разреза помечена «без истории»');
  ok(!/≠ итога/.test(text('#pf-cuts-lead')), 'ведомость по региону сходится');
});

pstep('ПОРТФЕЛЬ · ВАЛЮТА ОТЧЁТА — курс назван', 'PF_BY = "currency"; PF_CUR = "USD"', () => {
  ok(/Курс: KGS/.test(text('#pf-at-lead')), 'курс сведения назван в ответе',
     text('#pf-at-lead').slice(-60));
  ok(/сходится/.test(text('#pf-cut-lead')), 'разрез по валюте сходится');
});

/* Кредит, выданный ВНУТРИ периода: до первой строки проекции остаток не «неизвестен»,
   а равен нулю. Пока шов равнял отсутствие с отказом, ведомость с начала года роняла три
   кредита из пяти и расходилась с ответом на дату на 23,7 млн — молча, с нулевой невязкой:
   уронены были обе границы разом, поэтому сходиться ей было не с чем. */
pstep('ПОРТФЕЛЬ · ВЫДАННЫЙ ВНУТРИ ПЕРИОДА — ноль на начало, а не отказ',
      'PF_CUR = "KGS"; PF_BY = "unit"; PF_FROM = "01.01.2026"', () => {
  const lead = text('#pf-sheet-lead');
  ok(/Вошло кредитов 5/.test(lead), 'в ведомость вошли все пять', lead.slice(0, 190));
  ok(/выпало 0/.test(lead), 'ни один не выпал');
  ok(/появилось внутри 3/.test(lead), 'три вошли появившимися внутри периода, а не отказом');
  ok(/ноль по всем статьям/.test(lead), 'невязка ведомости нулевая');
  const cols = bodyRows('#tb-pfsheet')[0].innerHTML.split(/<\/td>/).length - 1;
  const close = numOf(cell('#tb-pfsheet', bodyRows('#tb-pfsheet').length - 1, cols - 2));
  const at = numOf(cell('#tb-pfat', bodyRows('#tb-pfat').length - 1, 1));
  ok(Math.abs(close - at) < 0.005, 'ИЯ-17: сальдо на конец = ответу на дату',
     close + ' против ' + at);
  ok(!/≠ итога/.test(text('#pf-cuts-lead')), 'сумма разрезов равна итогу на обоих концах');
});

pstep('ПОРТФЕЛЬ · ДАТА ДО ВЫДАЧИ — «ещё не было» отдельным счётчиком', 'ON = "15.01.2026"', () => {
  ok(/Вошло кредитов 3/.test(text('#pf-at-lead')), 'в свод вошли три существовавших',
     text('#pf-at-lead').slice(0, 150));
  ok(/выпало 0, ещё не было 2/.test(text('#pf-at-lead')),
     'два не существовали — и это не «выпало»');
  ok(/ещё не было 2/.test(text('#pf-sheet-lead')), 'ведомость считает их тем же счётчиком',
     text('#pf-sheet-lead').slice(0, 190));
  const rows = bodyRows('#tb-pfdrop');
  ok(rows.length === 4 && rows.every(r => /кредита ещё не было/.test(r.innerHTML)),
     'четыре строки на двух формах, все — «ещё не было»', rows.length);
  ok(!rows.some(r => /alarm/.test(String(r.className || ''))),
     'ни одна не помечена тревогой: потери нет');
  ok(/известный ноль/.test(text('#pf-drop-lead')), 'отсутствие названо нулём, а не потерей',
     text('#pf-drop-lead').slice(-80));
});

pstep('ПОРТФЕЛЬ · ДАТА ЗА ГОРИЗОНТОМ — отказ по кредиту, а не ноль',
      'PF_FROM = "01.05.2026"; PF_CUR = "KGS"; PF_BY = "unit"; ON = "31.12.2026"', () => {
  ok(bodyRows('#tb-pfdrop').length === 10, 'выпали все пять на обеих формах',
     bodyRows('#tb-pfdrop').length);
  ok(bodyRows('#tb-pfdrop').every(r => /позже горизонта прогона/.test(r.innerHTML)),
     'причина названа у каждой строки');
  const sum = bodyRows('#tb-pfat');
  ok(sum.length === 1 && /Итого/.test(sum[0].innerHTML) && numOf(cell('#tb-pfat', 0, 1)) === 0,
     'ни одной статьи, итог ноль — и рядом стоит число выпавших', cell('#tb-pfat', 0, 1));
  ok(/выпало 5/.test(text('#pf-at-lead')), 'выпавшие посчитаны', text('#pf-at-lead').slice(0, 120));
});

pstep('ПОРТФЕЛЬ · ПЕРЕСТРОЕНИЕ — двухуровневый отказ',
      'ON = "23.07.2026"; projOrderRebuild("K-7", PERIOD_ACTOR, "РП-999")', () => {
  const rows = bodyRows('#tb-pfdrop');
  ok(rows.length === 2 && rows.every(r => /K-7/.test(r.innerHTML)), 'выпал ровно К-7',
     rows.length);
  ok(rows.every(r => /перестроение/.test(r.innerHTML) && /РП-999/.test(r.innerHTML)),
     'названы и причина, и распоряжение');
  ok(/выпало 1/.test(text('#pf-at-lead')), 'один выпавший посчитан');
  ok(/сходится/.test(text('#pf-cut-lead')), 'свод по остальным четырём сходится');
});

pstep('ПОРТФЕЛЬ · ЗАМЕР — обращений не растёт с отбором',
      'projRun(FIXTURE, {}); actPfMeasure()', () => {
  const rows = bodyRows('#tb-pfmeasure');
  ok(rows.length === 4, 'три размера отбора и вывод', rows.length);
  ok(rows.slice(0, 3).every(r => cell('#tb-pfmeasure', rows.indexOf(r), 1).trim() === '2'),
     'на дату — два: проекция и реестр расходов');
  const q = rows.slice(0, 3).map(r => [1, 2, 3].map(c => cell('#tb-pfmeasure', rows.indexOf(r), c)).join('/'));
  ok(new Set(q).size === 1 && q[0] === '2/3/4', 'на 10, 1 000 и 50 000 — те же 2 · 3 · 4', q.join(' | '));
  ok(/приёмка пройдена/.test(rows[3].innerHTML), 'вывод приёмки напечатан');
});

/* ────────────────────────────────────────────────────────────────────────────
   ВОСЬМОЙ ШОВ — ПЕРЕЧИСЛЕНИЕ «СЕЙЧАС». Проверяется не вёрстка, а ФОРМА ответа:
   что столбцы берутся из перечня, а не из кода экрана; что число скрытого стоит
   всегда и считается ДО фильтра; что отказ назван полем, а не отдан пустым
   списком; что порог приходит нормативом с датой, а не константой. */
const ostep = (title, js, checks) => {
  if (js) run(js);
  run('renderObjects()');
  console.log('\n' + title);
  checks();
};
const objAsk = (js) => run('JSON.stringify(objectRows(' + js + '))');

run('OBJ_KIND = "credit"; OBJ_VIEWER = "all"; OBJ_FILTER = "none"; OBJ_ORDER = "none"; OBJ_BIG = false');
ostep('ШОВ 8 · ПЕРЕЧИСЛЕНИЕ — форма ядра, поля владельца', null, () => {
  const rows = bodyRows('#tb-obj');
  /* Пять кредитов + строка «скрыто»: она стоит ВСЕГДА, в том числе с нулём. */
  ok(rows.length === 6, 'пять объектов и строка «скрыто»', rows.length);
  ok(/Скрыто областью видимости/.test(rows[5].innerHTML) && /видно всё/.test(rows[5].innerHTML),
     'при полном круге строка стоит с нулём, а не исчезает');
  const head = byId.get('#tb-obj').children[0].innerHTML;
  ok(/Дата выдачи/.test(head) && /Остаток/.test(head) && /Дней просрочки/.test(head),
     'столбцы — поля владельца и показатели ядра');
  ok(/строк в ответе 5/.test(text('#obj-lead')), 'строк посчитано', text('#obj-lead').slice(0, 90));

  const pass = bodyRows('#tb-objpass').map(r => r.innerHTML);
  ok(pass.some(h => /не зафиксировано/.test(h)),
     'состояние периода НАЗВАНО, а не оставлено пустым');
  ok(pass.some(h => /14:05/.test(h)), 'момент стоит отдельно от даты');
  ok(pass.some(h => /в валюте кредита/.test(h)),
     'валюта ответа не подменена сомом: суммы идут в валюте кредита');
});

ostep('ШОВ 8 · ОБЛАСТЬ ВИДИМОСТИ — считается внутри шва и ДО фильтра',
      'OBJ_VIEWER = "prob"', () => {
  const rows = bodyRows('#tb-obj');
  ok(rows.length === 2 && /K-4/.test(rows[0].innerHTML), 'куратору проблемных виден один К-4',
     rows.length);
  ok(/Скрыто областью видимости: <b>4<\/b>/.test(rows[1].innerHTML),
     'скрытые посчитаны числом', rows[1].innerHTML.replace(/<[^>]+>/g, '').slice(0, 60));
  ok(!/K-7|K-C1|K-C2|K-6b|Ош-Пласт|Кемин/.test(rows[1].innerHTML),
     'в числе скрытого нет НИ ОДНОГО признака скрытого объекта');
  const sc = bodyRows('#tb-objscope');
  ok(sc.length === 3, 'три смотрящих в разрезе', sc.length);
  const vis = sc.map((r, i) => cell('#tb-objscope', i, 1) + '/' + cell('#tb-objscope', i, 2));
  ok(vis.join(' ') === '5/0 3/2 1/4', 'видно+скрыто у каждого даёт весь портфель', vis.join(' '));

  /* Фильтр, точно попавший в СКРЫТЫЙ объект, не должен менять число скрытого: иначе
     по разнице «его нет» / «он есть, но скрыт» существование подтверждалось бы тому,
     кому объект видеть нельзя. */
  const a = JSON.parse(objAsk('"credit", { portfolio:FIXTURE, now:OBJ_NOW, viewer:VIEWERS[2],'
    + ' filter:{ field:"num", op:"=", value:"71" } }'));
  ok(a.body.hidden === 4, 'фильтр в скрытый объект число скрытого не двигает', a.body.hidden);
  ok(a.body.count === 0, 'и самого объекта в ответе нет', a.body.count);
});

ostep('ШОВ 8 · ДЕНЕЖНЫЙ ОТБОР — обязан назвать валюту',
      'OBJ_VIEWER = "all"; OBJ_FILTER = "nocur"', () => {
  const rows = bodyRows('#tb-obj');
  ok(rows.length === 1 && /noCurrency/.test(rows[0].innerHTML),
     'порог без валюты — отказ, а не молчаливый отбор', rows[0].innerHTML.slice(0, 80));
  ok(/сомы с долларами/.test(rows[0].innerHTML), 'причина названа спрашивающему');
  ok(bodyRows('#tb-objpass').some(h => /noCurrency/.test(h.innerHTML)),
     'отказ виден в паспорте отдельным полем');

  const a = JSON.parse(objAsk('"credit", { portfolio:FIXTURE, now:OBJ_NOW,'
    + ' filter:{ field:"balance", op:">", value:500000, currency:"KGS" } }'));
  ok(a.body.count === 3, 'с названной валютой отбор считается', a.body.count);
  ok(a.problems.some(p => p.code === 'noRate'),
     'пересчёт для сравнения назван проблемой «нет курса на дату»');
  const usd = a.body.rows.find(r => r.id === 'K-C2');
  ok(usd && usd.currency === 'USD' && usd.measures.balance < 300000,
     'строка валютного кредита НЕ пересчитана: пересчёт понадобился сравнению',
     usd && usd.measures.balance);
});

ostep('ШОВ 8 · ОТКАЗ ПО ОБЪЁМУ — двоичный, порог нормативом с датой',
      'OBJ_FILTER = "none"; actObjBig()', () => {
  const rows = bodyRows('#tb-obj');
  ok(rows.length === 2 && /volume/.test(rows[0].innerHTML), 'отказ, а не половина списка',
     rows.length);
  ok(/содержал бы 120000 строк/.test(rows[0].innerHTML) && /порог 5000/.test(rows[0].innerHTML),
     'названы и число строк, и порог', rows[0].innerHTML.replace(/<[^>]+>/g, '').slice(0, 90));
  ok(/Приказ ФКФ/.test(rows[1].innerHTML) && /01\.06\.2026/.test(rows[1].innerHTML),
     'порог — норматив справочника с датой введения и основанием (ADR-0099)');
  /* Отказ по объёму — ПОЛЕ ответа, а не седьмой код: список кодов закрыт шестью. */
  const a = JSON.parse(objAsk('"credit", { portfolio:objPortfolio(), now:OBJ_NOW,'
    + ' viewer:VIEWERS[0] }'));
  ok(a.refusal && a.refusal.reason === 'volume' && a.answered === false && a.body === null,
     'ответа нет и он назван отказом, а не пустым списком');
  ok(!a.problems.some(p => p.code === 'volume'),
     'в списке проблем «объёма» нет: список кодов закрыт шестью');
  const prev = run('JSON.stringify(objLimitOf("objectRowsLimit", "15.03.2026"))');
  ok(JSON.parse(prev).value === 2000, 'прежний порог отвечает на прежнюю дату', prev);
});

ostep('ШОВ 8 · ВИД БЕЗ ПЕРЕЧНЯ — отказ с адресатом, а не пустой список',
      'actObjBig(); OBJ_KIND = "borrower"', () => {
  const rows = bodyRows('#tb-obj');
  ok(rows.length === 1 && /noFieldSet/.test(rows[0].innerHTML), 'отказ назван',
     rows[0].innerHTML.slice(0, 70));
  ok(/модуль заёмщика/.test(rows[0].innerHTML), 'адресат назван: к кому идти за перечнем');
  ok(/не объявлен/.test(text('#obj-set-lead')), 'перечня нет — и это сказано');
  const pub = bodyRows('#tb-objpub');
  ok(pub.some(r => /ОТЧ-23/.test(r.innerHTML) && /отказ/.test(r.innerHTML)),
     'шаблон по этому виду не публикуется');
});

ostep('ШОВ 8 · ПЕРЕЧЕНЬ — контракт, ломающийся на ПУБЛИКАЦИИ',
      'OBJ_KIND = "credit"; actObjDrop()', () => {
  const head = byId.get('#tb-obj').children[0].innerHTML;
  ok(!/Дата выдачи/.test(head), 'снятое поле исчезло и из строк: столбцы — из перечня');
  ok(/редакция перечня <b>4<\/b>/.test(text('#obj-set-lead')) || /редакция перечня 4/.test(text('#obj-set-lead')),
     'редакция сдвинута снятием', text('#obj-set-lead').slice(0, 120));
  const pub = bodyRows('#tb-objpub');
  ok(pub.some(r => /ОТЧ-11/.test(r.innerHTML) && /отказ/.test(r.innerHTML)
       && /Дата выдачи/.test(r.innerHTML)),
     'публикация шаблона, назвавшего снятое поле, остановлена — с именем поля');
  ok(pub.filter(r => /ОТЧ-12|ОТЧ-19/.test(r.innerHTML)).every(r => /разрешена/.test(r.innerHTML)),
     'шаблоны, не назвавшие снятое поле, публикуются');
  ok(/ВЫП-0714/.test(text('#obj-pub-lead')) && /не ломается/.test(text('#obj-pub-lead')),
     'выпуск со снимком редакции читается прежним: проверка не на выпуске');
  /* ВОЗВРАТ СНЯТОГО ДВИГАЕТ РЕДАКЦИЮ ТАК ЖЕ. Шаблон, опубликованный между двумя
     правками, видел ДРУГОЙ перечень — «вернули как было» здесь неверно. */
  run('actObjDrop()');
  ok(/редакция перечня <b>5<\/b>/.test(text('#obj-set-lead')) || /редакция перечня 5/.test(text('#obj-set-lead')),
     'возврат поля сдвинул редакцию на 5, а не вернул 3', text('#obj-set-lead').slice(0, 120));
});

ostep('ШОВ 8 · ШОВ НИЧЕГО НЕ ХРАНИТ — «сейчас» ≠ «как посчитано»',
      'if (courtDemoOn()) courtDemoToggle(); projReset(); projRun(FIXTURE, {})', () => {
  ok(/совпадают/.test(text('#obj-live')), 'до правки входа оба ответа сходятся',
     text('#obj-live').replace(/<[^>]+>/g, '').slice(0, 110));
  run('actObjFact(); renderObjects()');
  ok(/расходятся/.test(text('#obj-live')),
     'факт проведён — «сейчас» изменилось сразу, проекция держит прежнее',
     text('#obj-live').replace(/<[^>]+>/g, '').slice(0, 140));
  run('projRun(FIXTURE, {}); renderObjects()');
  ok(/совпадают/.test(text('#obj-live')), 'прогон подобрал кредит — расхождение снято');
  run('if (courtDemoOn()) courtDemoToggle(); projRun(FIXTURE, {})');
});

ostep('ШОВ 8 · «СЕЙЧАС» — НЕ «НА ДАТУ»', 'OBJ_KIND = "credit"', () => {
  for (const [js, why] of [
    ['"credit", { portfolio:FIXTURE, now:OBJ_NOW, on:"23.07.2026" }', 'срез на дату'],
    ['"credit", { portfolio:FIXTURE, now:OBJ_NOW, from:"01.01.2026", to:"23.07.2026" }', 'обороты за период'],
    ['"credit", { portfolio:FIXTURE }', 'момент не назван']]){
    let thrown = null;
    try { objAsk(js); } catch (e){ thrown = e.message; }
    ok(!!thrown, 'шов отказался: ' + why, (thrown || 'НЕ БРОСИЛ').slice(0, 80));
  }
  const tr = JSON.parse(objAsk('"tranche", { portfolio:FIXTURE, now:OBJ_NOW }'));
  ok(tr.body.count === 7, 'второй вид объекта перечисляется тем же швом', tr.body.count);
  ok(tr.body.measures.map(m => m.name).join(',') === 'taken,left',
     'показатели у вида свои, а считает их то же ядро', tr.body.measures.map(m => m.name).join(','));
});

/* ────────────────────────────────────────────────────────────────────────────
   ШОВ 3 · ЭКРАН РАЗНЕСЕНИЯ (РЯ-Д5). Числа этого шва сверяет `calc-core-check.mjs`,
   но дефект был не в числах: свод по статьям сходился копейка в копейку и при этом
   не отвечал ни на один вопрос суда. Поэтому здесь проверяется, что КООРДИНАТЫ
   ДОШЛИ ДО ЭКРАНА — срок, слой, транш и статья у каждой строки, — и что три
   состояния платежа показаны врозь: живой выводится, снимок предъявлен как снимок,
   а расхождение снимка с сегодняшним выводом названо, а не замолчано (ADR-0055).
   Таблица строк одна на все три места показа, и это тоже проверяется: напечатать
   координаты в одном месте и потерять в другом — ровно тот дефект, от которого
   уходили.                                                                     */
const deep = (id) => { const out = []; const walk = (n) => {
    if (typeof n.innerHTML === 'string' && n.innerHTML) out.push(n.innerHTML);
    for (const c of n.children) walk(c); };
  const t = byId.get(id); if (t) walk(t); return out.join('\n'); };
const qstep = (title, id, checks) => {
  run('CUR = FIXTURE.find(c => c.id === "' + id + '"); renderQueue()');
  console.log('\n' + title);
  checks(deep('#alloc-pays'));
};

qstep('ШОВ 3 · ЖИВОЙ ПЛАТЁЖ — разнесение ВЫВОДИТСЯ, снимка нет', 'K-6b', (h) => {
  ok(/выводится/.test(h) && !/снимок от/.test(h), 'платёж помечен выводимым');
  const rows = rowsOf('#alloc-pays').filter(r => /<td>/.test(r.innerHTML));
  ok(rows.length === 13, 'строк разнесения на экране 13', rows.length);
  /* КООРДИНАТЫ У КАЖДОЙ СТРОКИ. Пустая ячейка срока или транша здесь и есть РЯ-Д5:
     свод сойдётся, а ответить «за какой срок ушли деньги» будет нечем. */
  ok(rows.every(r => /<td>\d{2}\.\d{2}\.\d{4}<\/td>/.test(r.innerHTML)), 'у каждой строки напечатан СРОК');
  ok(rows.every(r => /<td>[1-9]\d*<\/td>/.test(r.innerHTML)), 'у каждой строки напечатан ТРАНШ');
  ok(rows.every(r => /Вне решения суда|слой/.test(r.innerHTML)), 'у каждой строки напечатан СЛОЙ');
  ok(/копейка в копейку/.test(h) && !/НЕ СХОДИТСЯ/.test(h), 'разнесённое плюс хвост дают платёж');
  const ap = bodyRows('#tb-applied');
  ok(ap.length === 4 && /Итого зачтено/.test(ap[3].innerHTML) && /36\s?000,00/.test(ap[3].innerHTML),
     'свод зачтённого выведен ИЗ строк — три статьи и итог', ap.length);
  ok(/Строк разнесения на дату — 13 по 1 платежу/.test(text('#applied-note')),
     'подпись называет строки, а не только сумму', text('#applied-note').slice(0, 60));
});

qstep('ШОВ 3 · СНИМОК ГРУБЕЕ ВЫВОДА — и это показано, а не спрятано', 'K-7', (h) => {
  ok(/снимок от 15\.03\.2026/.test(h), 'снимок предъявлен снимком, с датой заморозки');
  ok(/расходятся/.test(h) && /Снимок: строк 2/.test(h) && /Вывод сейчас: строк 9/.test(h),
     'две строки снимка против девяти строк вывода — расхождение названо');
  /* ФЛАГМАНСКИЙ СЛУЧАЙ РЯ-Д5 ЦЕЛИКОМ. Снимок ЦК — пара сумм на ДАТУ ПЛАТЕЖА: срок
     позиции в нём подменён днём поступления, и по такой паре не ответить ничего.
     Ниже на том же экране стоит вывод ядра: девять строк, ДВА транша, ЧЕТЫРЕ срока
     и ТРИ статьи. Отличие снимка от вывода тут и есть предмет дефекта. */
  const rows = rowsOf('#alloc-pays').filter(r => /<td>/.test(r.innerHTML));
  ok(rows.length === 11, 'на экране обе таблицы: 2 строки снимка и 9 строк вывода', rows.length);
  /* Слой, сумма и признак печатаются с классом (`<td class="muted">`), срок, транш и
     статья — без него: три ячейки подряд, и по ним же читается разложение. */
  const live = rows.slice(2).map(r => (r.innerHTML.match(/<td>([^<]*)<\/td>/g) || []).map(x => x.slice(4, -5)));
  const dues = new Set(live.map(c => c[0])), tr = new Set(live.map(c => c[1]));
  const arts = new Set(live.map(c => c[2]));
  ok(dues.size === 5 && tr.size === 2 && arts.size === 3,
     'вывод разложен на 5 сроков, 2 транша и 3 статьи', [...dues].join(',') + ' | ' + [...tr].join(',') + ' | ' + [...arts].join(','));
  ok(live.every(c => c[0] !== '15.03.2026'), 'ни один срок вывода не равен дате платежа — в снимке равны оба');
  ok(/сверх графика/.test(h), 'досрочные строки помечены признаком, а не спрятаны в тело');
});

qstep('ШОВ 3 · СНИМОК, СОВПАДАЮЩИЙ С ВЫВОДОМ — тоже названный', 'K-C1', (h) => {
  ok(/вывод сегодня повторяет снимок/.test(h) && !/расходятся/.test(h),
     'совпадение названо словами: молчание читалось бы как «не сверяли»');
  ok(/Снимок: строк 15/.test(h) && /Вывод сейчас: строк 15/.test(h), 'сверены строки, а не только суммы');
  ok(rowsOf('#tb-queue').length > 1 && text('#cnt-alloc') === String(rowsOf('#tb-queue').length),
     'счётчик очереди равен числу её строк', text('#cnt-alloc') + ' / ' + rowsOf('#tb-queue').length);
});

/* ─────────────────────────────────────────────────────────────────────────────
   ШОВ 9 · ЭПИЗОДЫ ПРОСРОЧКИ. Экран печатает ответ шва, а не свой счёт: число в меню
   равно числу строк таблицы, строка «тянется» — у эпизода без закрытия, у вылеченного
   причина «погашением» стоит отдельной меткой. Сценарии стенда меняют факты, и после них
   на экране должно стоять новое склеивание: два эпизода К-7 после платежа 20.04.2026 и
   эпизод слоя решения суда у К-4. Блок сверки «дни ≠ длительность» обязан объяснить
   расхождение, а не просто показать два числа. */
const sstep = (title, js, checks) => {
  if (js) run(js);
  run('renderSpells()');
  console.log('\n' + title);
  console.log('   · ' + (text('#sp-msg') || '(без сообщения)').slice(0, 150));
  checks();
};
const spCells = (r) => (String(r.innerHTML).match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [])
  .map(x => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const spRowsOf = (id) => bodyRows('#tb-spells').map(spCells).filter(c => c[0] === id);

sstep('ШОВ 9 · ЭПИЗОДЫ — исходный стенд',
      'if (courtDemoOn()) courtDemoToggle(); if (cureDemoOn()) cureDemoToggle(); projReset(); projRun(FIXTURE, {})', () => {
  const rows = bodyRows('#tb-spells');
  ok(rows.length === 5 && text('#cnt-spells') === '5', 'пять эпизодов, счётчик меню равен строкам',
     text('#cnt-spells') + ' / ' + rows.length);
  ok(rows.every(r => !/undefined|NaN|null/.test(r.innerHTML)), 'ни одна строка не печатает undefined');
  const c1 = spRowsOf('K-C1')[0] || [];
  ok(c1[2] === '15.03.2026' && c1[3] === '23.07.2026' && c1[4] === 'погашением' && c1[5] === '130',
     'К-С1: 15.03 → 23.07.2026, погашением, 130 дней', c1.slice(2, 6).join(' · '));
  const k6 = spRowsOf('K-6b')[0] || [];
  ok(k6[3] === '15.05.2026' && k6[4] === 'списанием', 'К-6б закрыт датой закрытия кредита — списанием',
     k6.slice(2, 5).join(' · '));
  const k7 = spRowsOf('K-7')[0] || [];
  ok(k7[3] === 'тянется' && k7[4] === '—', 'К-7 тянется — закрытия и причины нет', k7.slice(2, 5).join(' · '));
  ok(bodyRows('#tb-spcredits').length === 5 && /проблем нет/.test(text('#sp-env')) && /ответ полный/.test(text('#sp-env')),
     'кредиты в ответе — все пять, конверт полный', text('#sp-env').slice(0, 80));
  const tie = bodyRows('#tb-sptie').map(spCells);
  ok(tie.length === 5 && tie.filter(c => /сходится/.test(c[5] || '')).length === 4
     && /кредит закрыт 15\.05\.2026/.test((tie.find(c => c[0] === 'K-6b') || [])[1] || ''),
     'сверка на дату среза: четыре кредита сходятся, закрытый назван закрытым',
     tie.map(c => c[0] + ':' + (c[5] || c[1]).slice(0, 12)).join(' '));
  const t4 = tie.find(c => c[0] === 'K-4') || [];
  ok(Number(t4[2]) !== Number(t4[4]) ? /частичное погашение/.test(t4[5]) : true,
     'если дни и длительность разошлись — причина названа', t4.join(' | ').slice(0, 160));
});

sstep('ШОВ 9 · К-7 ПОГАСИЛ ПРОСРОЧКУ — два эпизода', 'actSpellCure()', () => {
  ok(/погасил всю просрочку/.test(text('#sp-msg')) && /подобрал из очереди 1 кредит/.test(text('#sp-msg')),
     'сценарий провёл платёж и прогон подобрал один кредит');
  const k7 = spRowsOf('K-7');
  ok(k7.length === 2 && k7[0][2] === '12.02.2026' && k7[0][3] === '20.04.2026' && k7[0][4] === 'погашением'
     && k7[0][5] === '67', 'первый закрыт 20.04.2026 погашением, 67 дней', (k7[0] || []).slice(2, 6).join(' · '));
  ok(k7.length === 2 && k7[1][2] === '15.06.2026' && k7[1][3] === 'тянется',
     'следующий неоплаченный срок 15.06.2026 — новый эпизод', (k7[1] || []).slice(2, 4).join(' · '));
  ok(text('#cnt-spells') === '6' && /снять платёж/.test(text('#sp-cure')), 'счётчик 6, кнопка предлагает вернуть');
  run('actSpellCure()'); run('renderSpells()');
  ok(spRowsOf('K-7').length === 1 && text('#cnt-spells') === '5', 'снятие платежа вернуло один эпизод');
});

sstep('ШОВ 9 · РЕШЕНИЕ СУДА ПО К-4 — эпизод по слою', 'actSpellCourt()', () => {
  const k4 = spRowsOf('K-4');
  ok(k4.length === 2 && k4[0][1] === 'свободный' && k4[0][3] === '20.05.2026' && k4[0][4] === 'переводом в другой слой',
     'свободный закрыт 20.05.2026 переводом в другой слой', (k4[0] || []).slice(1, 5).join(' · '));
  ok(k4.length === 2 && k4[1][1] === 'по решению суда' && k4[1][2] === '20.05.2026' && k4[1][3] === 'тянется',
     'эпизод слоя решения открыт той же датой и тянется', (k4[1] || []).slice(1, 4).join(' · '));
  const t4 = bodyRows('#tb-sptie').map(spCells).find(c => c[0] === 'K-4') || [];
  ok(/сходится/.test(t4[5] || '') && /не по слою/.test(t4[5] || ''),
     'сверка сходится и называет, почему даты одна на кредит', (t4[5] || '').slice(0, 120));
  run('actSpellCourt()'); run('renderSpells()');
  ok(spRowsOf('K-4').length === 1, 'отмена решения вернула один свободный эпизод');
});

sstep('ШОВ 9 · ПЕРЕСТРОЕНИЕ — кредит выпал с причиной', 'projOrderRebuild("K-7", "Тестовый бухгалтер", "РП-301")', () => {
  const cr = bodyRows('#tb-spcredits').map(spCells);
  ok(cr.length === 5 && /не посчитан/.test((cr.find(c => c[0] === 'K-7') || [])[1] || '')
     && /перестроение/.test((cr.find(c => c[0] === 'K-7') || [])[1] || ''),
     'К-7 в списке кредитов — «не посчитан» с причиной, а не пропал', ((cr.find(c => c[0] === 'K-7') || [])[1] || '').slice(0, 80));
  ok(spRowsOf('K-7').length === 0 && bodyRows('#tb-sptie').map(spCells).every(c => c[0] !== 'K-7'),
     'эпизодов К-7 и строки сверки нет: считать не из чего');
  run('projReset(); projRun(FIXTURE, {})');
});

/* ─────────────────────────────────────────────────────────────────────────────
   ШОВ 2 · ПОТОКИ ОСТАТКА (ADR-0322). Таблица печатает `calcDebt(...).flows` как есть, и
   строка «Остаток задолженности» обязана равняться потокам со знаками — экран не держит
   своего счёта. У валютного кредита без курсов по датам сомовая колонка пуста с причиной,
   а не нулями; сценарий курсов даёт курсовую разницу, и примечание сверяет её с прямой
   переоценкой. */
const fstep = (title, js, checks) => {
  if (js) run(js);
  run('renderDebt()');
  console.log('\n' + title);
  console.log('   · ' + (text('#db-rates-msg') || '(без сообщения)').slice(0, 150));
  checks();
};
const flCells = () => bodyRows('#tb-flows').map(spCells);
const num = (s) => Number(String(s || '').replace(/[\s  ]/g, '').replace(',', '.').replace('−', '-'));
const flClosed = (col) => {
  const r = flCells(), last = r[r.length - 1];
  const sum = r.slice(0, -1).reduce((s, c) => s + (c[1] === '−' ? -1 : 1) * (c[col] === '—' ? 0 : num(c[col])), 0);
  return Math.abs(sum - num(last[col])) < 0.005;
};

fstep('ШОВ 2 · ПОТОКИ ОСТАТКА — кредит в сомах', 'CUR = FIXTURE.find(c => c.id === "K-7"); ON = "23.07.2026"', () => {
  const r = flCells();
  ok(r.length === 8 && r[7][0] === 'Остаток задолженности', 'семь потоков и строка остатка', r.length);
  ok(flClosed(2), 'остаток в таблице равен потокам со знаками — экран не держит своего счёта');
  ok(/сходится/.test(text('#flows-note')) && /посчитанный/.test(text('#flows-note')),
     'примечание: замкнут, курсовая разница — посчитанный ноль', text('#flows-note').slice(0, 120));
});

fstep('ШОВ 2 · ПОТОКИ ОСТАТКА — валютный кредит без курсов по датам', 'CUR = FIXTURE.find(c => c.id === "K-C2")', () => {
  const r = flCells();
  ok(r.length === 9 && r[7][0] === 'Курсовая разница' && r.every(c => c[3] === '—'),
     'сомовая колонка пуста у всех строк, строка курсовой разницы есть', r.map(c => c[3]).join(' '));
  ok(/нет курсов USD по датам/.test(text('#flows-note')) && /пусто, а не ноль/.test(text('#flows-note')),
     'причина названа, пустота — не ноль', text('#flows-note').slice(0, 140));
  ok(flClosed(2), 'в валюте договора остаток замкнут');
});

fstep('ШОВ 2 · КУРСЫ USD ПО ДАТАМ — курсовая разница', 'actRatesDemo()', () => {
  ok(/положены курсы USD по датам/.test(text('#db-rates-msg')) && /подобрал из очереди 1 кредит/.test(text('#db-rates-msg')),
     'сценарий положил курсы, прогон подобрал K-C2');
  const r = flCells(), fx = r.find(c => c[0] === 'Курсовая разница') || [];
  ok(num(fx[3]) === 42384.67, 'курсовая разница на 23.07.2026 — 42 384,67', fx[3]);
  ok(flClosed(3), 'в сомах остаток = потоки по курсу своего дня + курсовая разница');
  ok(/Смен курса за жизнь кредита: 6/.test(text('#flows-note')) && /совпадает/.test(text('#flows-note')),
     'примечание сверяет с прямой переоценкой по шести сменам', text('#flows-note').slice(-140));
  ok(/Убрать/.test(text('#db-rates')), 'кнопка предлагает снять сценарий');
  run('ON = "01.01.2026"; renderDebt()');
  ok(/Выдачи ещё не было/.test(text('#flows-note')) && flCells().length === 9,
     'дата до выдачи: вид не падает, пересчитывать нечего', text('#flows-note').slice(-60));
  run('ON = "23.07.2026"; renderDebt()');
  run('actRatesDemo(); renderDebt()');
  ok(/сняты/.test(text('#db-rates-msg')) && flCells().every(c => c[3] === '—'), 'снятие вернуло пустую сомовую колонку');
  run('CUR = FIXTURE[0]; projReset(); projRun(FIXTURE, {})');
});

console.log('\n' + (bad ? 'ЭКРАНЫ СТЕНДА · НЕ СОШЛОСЬ: ' + bad : 'ЭКРАНЫ СТЕНДА · все проверки сошлись'));
if (bad) process.exit(1);
