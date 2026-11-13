// Смоук макета «Архив папок» — mockups/archive/archive.html.
// Источник ожиданий — mockups/archive/ASUBK-arhiv-plan.md: сценарии С-1…С-21 (§6) и правила движка 1–17 (§4);
// права — канон ASUBK-arhiv-logika.md §7. Плюс инварианты модели (в том числе после случайных действий)
// и проверки интерфейса: каждый раздел отрисован на 1920 px, без горизонтальной прокрутки, без ошибок консоли.
// Каждая группа — свежая загрузка страницы (свежее состояние), порядок групп не важен.
// Блок Р-1…Р-3 — автогриллинг страницы «Рамка модуля и Очередь архивариуса» (АХ-71…АХ-81): демо-стенд в шапке,
// цвет счётчиков, поле «Возврат» с клавиатуры, итог под полем, возврат пачкой из «Папок» окном, печать и Excel
// у «уволенных», ярлык после привязки, подсветка открытой папки.
// Блок ПК-1…ПК-4 — автогриллинг страницы «Папки» и карточки папки (АХ-82…АХ-95): поиск номера с клавиатуры и
// «Вне отбора», плашки состояний и «из них», отборы одной строкой, полоса пачки на месте «Показано» с числом на
// кнопках, отмечены только показанные, срок «Выдать» пачкой, список полки, карточка от первого лица, все тома,
// запрос архивариуса из «Ещё ▾», реквизиты без повторов шапки, сообщение с кнопкой одной строкой.
// Блок ОД-1…ОД-4 — автогриллинг «Окон действий» (АХ-96…АХ-108): одно устройство окна, клавиатура (курсор в первом
// поле, Enter, Esc, Tab в окне), поиск сотрудника и заёмщика с «Предложено», место одним списком, причина кнопками,
// даты с подсказкой и «+5 / +10 р.д.», запрет у поля до нажатия, строки пачки с исходом, сообщение «что сделано и что
// дальше», действия без окна, уволенному не продлевают, ввод подряд, причина-шаблон, своя строка очереди без кнопки.
// Блок МП-1…МП-4 — автогриллинг «Моих папок» и «Заёмщиков без КЗД» (АХ-109…АХ-122): «Найти папку» с клавиатуры (курсор,
// Enter — номер сразу карточкой), карточка из поиска держит курсор (Tab по кругу, Esc — в поиск), курсор после действия,
// пустой экран строкой, папки подразделения и «на руках у сотрудников» руководителя, «Вам передают» с «Кто ждёт», срок
// «через N р.д.», одна сетка колонок, бронь — помещение; «Заёмщики без КЗД» без счётчика, отборы по роли, «Привязать»;
// врезка «Где бумага» от первого лица, без колонки «Том», с «ждут N», выбывшая КЗД (АХ-Д23).
// Запуск: node scripts/inspect/archive-check.mjs [--shots <папка>]   (playwright-core + системный Chrome)
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = pathToFileURL(join(ROOT, 'mockups', 'archive', 'archive.html')).href;
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let passed = 0, failed = 0; const fails = [];
function ck(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); return; }
  failed++;
  const m = '  ✗ ' + name + (detail !== undefined ? '\n      факт: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '');
  console.log(m); fails.push(m);
}
const has = (s, sub) => String(s || '').toLowerCase().includes(String(sub).toLowerCase());
/* Поле выбора сотрудника или заёмщика: фокус открывает список, набор — поиск (фамилия, ИНН), выбор — щелчок по строке. */
async function pick(page, id, val) {
  const q = await page.evaluate(v => { const A = window.AX, e = A.EMP.find(x => x.id === v), b = A.BORROWERS.find(x => x.id === v); return e ? e.name.split(' ')[0] : b ? b.inn : ''; }, val);
  await page.click(`[data-testid=ff-${id}]`);
  if (q) await page.fill(`[data-testid=ff-${id}]`, q);
  await page.click(`[data-testid=pi-${id}-${val}]`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

/* Группа = сценарий или правило. Свежая страница; в конце — инварианты модели и ошибки консоли. */
async function group(label, fn, hash = '') {
  console.log('\n' + label);
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  try {
    await page.goto(FILE + hash); await page.waitForFunction(() => !!window.AX);
    const E = (f, a) => page.evaluate(f, a);
    await fn(page, E);
    const inv = await E(() => window.AX.invariants());
    ck('инварианты модели целы', inv.length === 0, inv);
  } catch (e) {
    failed++; const m = `  ✗ (исключение) ${label}\n      ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`; console.log(m); fails.push(m);
  }
  ck('без ошибок консоли', errs.length === 0, errs);
  await page.close();
}
/* Раскладка: нет горизонтальной прокрутки страницы и рабочей области, таблицы не шире своего контейнера. */
const layout = E => E(() => {
  const de = document.documentElement, c = document.querySelector('.content');
  const wide = [...document.querySelectorAll('#panel table, #cardpanel table')].filter(t => t.offsetParent && t.scrollWidth > t.parentElement.clientWidth + 1).length;
  const cp = document.querySelector('#cardpanel');
  return { page: de.scrollWidth <= de.clientWidth, content: c.scrollWidth <= c.clientWidth + 1, wide, card: !cp.classList.contains('open') || cp.querySelector('.cp-body').scrollWidth <= cp.querySelector('.cp-body').clientWidth + 1,
    filled: document.querySelector('#panel').innerText.trim().length > 20 };
});
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name + '.png') }); };

/* =========================== интерфейс =========================== */

await group('И-1 · раскладка на 1920: каждый раздел у каждой роли отрисован, без горизонтальной прокрутки', async (page, E) => {
  const users = await E(() => window.AX.USERS.map(u => u[0]));
  for (const u of users) {
    const views = await E(u => { window.AX.setUser(u); return [...document.querySelectorAll('.nav-item')].map(b => b.dataset.v); }, u);
    for (const v of views) {
      await E(v => window.AX.go(v), v);
      const L = await layout(E);
      ck(`${u} · ${v}: отрисован, без прокрутки вбок`, L.filled && L.page && L.content && !L.wide, L);
    }
  }
  await E(() => { window.AX.setUser('isaeva'); window.AX.go('borrower'); });
  const L = await layout(E); ck('образец врезки «Где бумага»: отрисован, без прокрутки вбок', L.filled && L.page && L.content && !L.wide, L);
});

await group('И-2 · стартовый экран и меню по ролям (АХ-35, канон §9.1)', async (page, E) => {
  const r = await E(() => { const A = window.AX, out = {};
    A.USERS.forEach(([u]) => { A.setUser(u); out[u] = { view: A.S.view, menu: [...document.querySelectorAll('.nav-item')].map(b => b.dataset.v), cnt: { q: document.querySelector('[data-testid=cnt-queue]')?.textContent || '', m: document.querySelector('[data-testid=cnt-mine]').textContent } }; });
    return out; });
  ck('архивариусу стартовый — «Очередь архивариуса»', r.arch1.view === 'queue' && r.arch2.view === 'queue', r.arch1);
  ck('остальным стартовый — «Мои папки»', ['asanov', 'isaeva', 'mambetov', 'jeen', 'sydykova'].every(u => r[u].view === 'mine'));
  ck('меню архивариуса: Очередь · Папки · Мои папки · Заёмщики без КЗД · Журнал · Справочники', r.arch1.menu.join() === 'queue,folders,mine,nokzd,journal,dicts', r.arch1.menu);
  ck('меню остальных: Мои папки · Папки · Заёмщики без КЗД · Журнал', r.jeen.menu.join() === 'mine,folders,nokzd,journal', r.jeen.menu);
  ck('счётчик очереди = строки, ждущие действия (1 к выдаче + 1 продление + 2 привязки + 1 у уволенного)', r.arch1.cnt.q === '5', r.arch1.cnt);
  ck('счётчик «Моих папок»: Асанов — 1 просрочка; Мамбетов — 1 «Вам передают»; Исаева — 1 бронь; бухгалтер — пусто',
    r.asanov.cnt.m === '1' && r.mambetov.cnt.m === '1' && r.isaeva.cnt.m === '1' && r.sydykova.cnt.m === '', [r.asanov.cnt, r.mambetov.cnt, r.isaeva.cnt, r.sydykova.cnt]);
  await shot(page, '00-start');
});

await group('И-3 · карточка — панель ~900 px поверх списка, свой адрес; кнопки по состоянию (АХ-50, АХ-51, АХ-58)', async (page, E) => {
  await E(() => window.AX.go('folders'));
  await page.click('[data-testid=row-205]');
  const r = await E(() => { const cp = document.querySelector('#cardpanel'), b = cp.getBoundingClientRect(), t = document.querySelector('[data-testid=tbl-folders]').getBoundingClientRect();
    return { open: cp.classList.contains('open'), w: Math.round(b.width), listVisible: t.left < b.left && document.querySelector('[data-testid=tbl-folders]').offsetParent !== null, hash: location.hash,
      order: [...cp.querySelectorAll('.cp-sec > h4')].map(h => h.firstChild.textContent.trim()), where: cp.querySelector('[data-testid=where]').innerText }; });
  ck('панель открыта, ширина ~900 px', r.open && Math.abs(r.w - 900) <= 10, r.w);
  ck('список остаётся видимым слева', r.listVisible);
  ck('свой адрес #/folder/205', r.hash === '#/folder/205', r.hash);
  ck('один столбец сверху вниз: реквизиты → просьба продлить → очередь → история', r.order.join('|') === 'Реквизиты|Просьба продлить|Очередь|История', r.order);
  ck('шапка «где сейчас»: НА РУКАХ у Жээнбековой Н. (ДПО) · вернуть до 16.11', has(r.where, 'НА РУКАХ у Жээнбековой Н. (ДПО) · вернуть до 16.11'), r.where);
  const L = await layout(E); ck('в панели нет прокрутки вбок', L.card && L.page, L);
  await shot(page, '03-card');
  await page.click('[data-testid=row-206] td:nth-child(2)');
  ck('клик по следующей строке — следующая папка в той же панели', await E(() => location.hash === '#/folder/206' && document.querySelector('[data-testid=cb-issue]').textContent === 'Выдать Исаевой А.'));
  await page.keyboard.press('Escape');
  ck('Esc закрывает панель, список на месте', await E(() => !document.querySelector('#cardpanel').classList.contains('open') && window.AX.S.view === 'folders'));
  const btns = await E(() => { const A = window.AX, out = {};
    const main = id => { A.openCard(id); const b = document.querySelector('#cardpanel .cp-btns .btn'); return { t: b.textContent, dis: b.disabled, why: b.dataset.why || '' }; };
    out.archive = main('f211'); out.reserved = main('f206'); out.out = main('f230'); out.transfer = main('f201'); out.lost = main('f209'); out.destroyed = main('f215');
    A.openCard('f205'); out.extendWhy = document.querySelector('[data-testid=cb-extend]').dataset.why;
    A.openCard('f211'); document.querySelector('[data-testid=cb-more]').click(); out.more = [...document.querySelectorAll('[data-testid=more-pop] .mi')].map(m => m.firstChild.textContent);
    out.rebindNom = document.querySelector('[data-testid=mi-rebind]').disabled;
    A.openCard('f206'); document.querySelector('[data-testid=cb-more]').click(); out.moreRes = [...document.querySelectorAll('[data-testid=more-pop] .mi')].map(m => m.firstChild.textContent);
    A.openCard('f230'); document.querySelector('[data-testid=cb-more]').click(); out.moreOut = [...document.querySelectorAll('[data-testid=more-pop] .mi')].map(m => m.firstChild.textContent); return out; });
  ck('в архиве — главная «Выдать», рядом «Переместить»', btns.archive.t === 'Выдать' && !btns.archive.dis, btns.archive);
  ck('забронирована — «Выдать <кому>»', btns.reserved.t === 'Выдать Исаевой А.', btns.reserved);
  ck('на руках и передаётся — «Принять возврат»', btns.out.t === 'Принять возврат' && btns.transfer.t === 'Принять возврат');
  ck('утрачена — «Восстановить»; уничтожена — «Восстановить» серая с причиной', btns.lost.t === 'Восстановить' && !btns.lost.dis && btns.destroyed.dis && has(btns.destroyed.why, 'только утраченную'), [btns.lost, btns.destroyed]);
  ck('«Продлить» при просьбе на решении — серая с причиной', has(btns.extendWhy, 'просьба держателя'), btns.extendWhy);
  ck('«Ещё ▾»: следующий том · привязка · ярлык · свой запрос (АХ-93) · списать', btns.more.join('|') === 'Принять следующий том|Изменить привязку|Печать ярлыка|Запросить|Списать', btns.more);
  ck('«Изменить привязку» у вида без привязки — серая', btns.rebindNom === true);
  ck('у забронированной и у папки на руках «Переместить» уходит в «Ещё ▾»', btns.moreRes.join('|') === 'Переместить|Принять следующий том|Изменить привязку|Печать ярлыка|Запросить|Списать' && btns.moreOut.join('|') === btns.moreRes.join('|'), [btns.moreRes, btns.moreOut]);
  const own = await E(() => { const A = window.AX; A.setUser('asanov'); A.openCard('f211'); const a = [...document.querySelectorAll('#cardpanel .cp-btns .btn')].map(b => b.textContent);
    A.openCard('f230'); const b = [...document.querySelectorAll('#cardpanel .cp-btns .btn')].map(b => b.textContent);
    A.openCard('f201'); const c = [...document.querySelectorAll('#cardpanel .cp-btns .btn')].map(b => b.textContent);
    A.setUser('mambetov'); A.openCard('f201'); const d = [...document.querySelectorAll('#cardpanel .cp-btns .btn')].map(b => b.textContent);
    A.setUser('jeen'); A.openCard('f209'); const g = document.querySelector('[data-testid=cb-request]'); return { a, b, c, d, gone: g.disabled && g.dataset.why }; });
  ck('сотруднику кнопок архивариуса нет — только «Запросить»', own.a.join() === 'Запросить', own.a);
  ck('держателю — «Передать» и «Попросить продление»', own.b.join() === 'Передать,Попросить продление', own.b);
  ck('передающему — «Отменить передачу»', own.c.includes('Отменить передачу'), own.c);
  ck('получателю — «Получил» / «Не получал»', own.d.join() === 'Получил,Не получал', own.d);
  ck('«Запросить» у выбывшей — серая с причиной', has(own.gone, 'выбыла'), own.gone);
});

await group('И-4 · прямая ссылка открывает панель поверх «Папок»', async (page, E) => {
  const r = await E(() => ({ view: window.AX.S.view, card: window.AX.S.card, open: document.querySelector('#cardpanel').classList.contains('open') }));
  ck('#/folder/230 → «Папки» и панель папки А-000230', r.view === 'folders' && r.card === 'f230' && r.open, r);
}, '#/folder/230');

await group('И-5 · реестр: восемь колонок, плашки, поиск, отборы (АХ-48, АХ-53, АХ-41)', async (page, E) => {
  await E(() => { window.AX.setUser('jeen'); window.AX.go('folders'); });
  const r = await E(() => ({ th: [...document.querySelectorAll('[data-testid=tbl-folders] thead th')].map(t => t.textContent.trim()), shown: +document.querySelector('[data-testid=shown]').textContent,
    chips: Object.fromEntries([...document.querySelectorAll('[data-testid=chips] .tile')].map(t => [t.dataset.testid.slice(5), +t.querySelector('.n').textContent])) }));
  ck('☐ + восемь колонок: № · Название · Подразделение · Место · Состояние · Держатель · Вернуть до · Ждут', r.th.slice(1).join('|') === '№|Название|Подразделение|Место|Состояние|Держатель|Вернуть до|Ждут', r.th);
  ck('выбывшие скрыты до плашки: показано 28 из 30', r.shown === 28, r.shown);
  ck('плашки: в архиве 17 · забронированы 1 · на руках 10 (вместе с передающейся) · выбыли 2; из них просрочены 2 · передаются 1 · с очередью 3',
    r.chips.archive === 17 && r.chips.reserved === 1 && r.chips.out === 10 && r.chips.over === 2 && r.chips.queue === 3 && r.chips.transfer === 1 && r.chips.gone === 2, r.chips);
  await page.click('[data-testid=chip-gone]');
  ck('плашка «выбыли» показывает выбывшие', await E(() => +document.querySelector('[data-testid=shown]').textContent === 2));
  await page.click('[data-testid=chip-gone]');
  const q = async s => { await page.fill('[data-testid=f-q]', s); return E(() => [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => t.dataset.testid)); };
  ck('поиск по номеру без ведущих нулей: «205» → А-000205', (await q('205')).join() === 'row-205');
  ck('поиск по ИНН заёмщика → его папки', (await q('11203197800456')).join() === 'row-204,row-205');
  ck('поиск по ИНН непривязанной КЗД', (await q('22003195600011')).join() === 'row-218');
  ck('поиск по «Содержанию»: «договор залога № 45» → А-000204', (await q('договор залога № 45')).join() === 'row-204');
  ck('две «Протоколы правления · 2025» различает подразделение в строке', (await q('Протоколы правления')).length === 2 && await E(() => [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => t.children[3].textContent).sort().join() === 'Бухгалтерия,ДПО'));
  await page.fill('[data-testid=f-q]', '');
  const f = await E(() => { const A = window.AX, n = o => A.registry(o).rows.map(f => f.no);
    return { hdept: n({ hdept: 'ДРР' }), dept: n({ dept: 'Бухгалтерия' }), shelf: n({ shelf: 'go3-4' }), holder: n({ holder: 'jeen' }), kind: n({ kind: 'vz' }), borrower: n({ q: 'Иманов' }), room: n({ room: 'dpo' }).length }; });
  ck('отбор «подразделение держателя» ДРР: у Асанова и Мамбетова', f.hdept.join() === '201,216,225,230', f.hdept);
  ck('отбор «подразделение»: папки бухгалтерии без выбывших', f.dept.join() === '213,221', f.dept);
  ck('отбор полки, держателя, вида, помещения; папки заёмщика — поиском (АХ-85)', f.shelf.join() === '219,220,221' && f.holder.join() === '205,214,227' && f.kind.join() === '205,226' && f.borrower.join() === '202,203' && f.room === 3, f);
  await shot(page, '02-folders');
});

await group('И-6 · формы: обязательное помечено, ошибка у поля, «Отмена» ничего не делает', async (page, E) => {
  await E(() => window.AX.uiIssue('f211'));
  ck('обязательные поля помечены', await E(() => document.querySelectorAll('#modal label.req').length === 3));
  await page.click('[data-testid=form-submit]');
  ck('пустое «Кому» — ошибка у поля', await E(() => document.querySelector('[data-testid=form-err]')?.dataset.field === 'to'));
  await pick(page, 'to', 'sydykova');
  await page.fill('[data-testid=ff-due]', '01.01.2026');
  await page.fill('[data-testid=ff-why]', 'сверка');
  ck('срок в прошлом — ошибка у поля «Вернуть до» сразу, кнопка серая с причиной', await E(() => document.querySelector('[data-testid=form-err]')?.dataset.field === 'due' && /позже сегодняшнего/.test(document.querySelector('[data-testid=form-err]').textContent)
    && document.querySelector('[data-testid=form-submit]').disabled));
  await page.click('[data-testid=form-cancel]');
  ck('«Отмена» — окно закрыто, папка по-прежнему в архиве', await E(() => !document.querySelector('#overlay').classList.contains('open') && window.AX.stateOf('f211') === 'archive'));
  await E(() => window.AX.uiAccept());
  await shot(page, '08-form-accept');
  const L = await E(() => { const m = document.querySelector('#modal'); return m.scrollWidth <= m.clientWidth + 1 && m.getBoundingClientRect().height < 1080; });
  ck('форма «Принять папку» помещается без прокрутки вбок', L);
});

/* ======================= сценарии по ролям (§6) ======================= */

await group('С-1 · утро архивариуса: стартовый экран — очередь; «К выдаче» по месту', async (page, E) => {
  const r = await E(() => { const A = window.AX;
    A.request('f210', { why: 'мониторинг' }, 'kadyrov'); A.request('f202', { why: 'сверка' }, 'sydykova'); A.render();
    return { view: A.S.view, rows: [...document.querySelectorAll('[data-testid=tbl-give] tbody tr')].map(t => t.children[0].textContent), blocks: [...document.querySelectorAll('.section-h[data-testid^=blk]')].map(b => b.dataset.testid) }; });
  ck('стартовый экран — «Очередь архивариуса»', r.view === 'queue');
  ck('«К выдаче» по месту: ГО·1·1 → ГО·1·2 → ГО·2·1', r.rows.join('|') === 'ГО · 1 · 1|ГО · 1 · 2|ГО · 2 · 1', r.rows);
  ck('четыре блока по срочности: к выдаче → продления → у уволенных → ждут привязки; «Просрочены» нет (АХ-56, АХ-78)', r.blocks.join() === 'blk-give,blk-ext,blk-fired,blk-bind', r.blocks);
  await shot(page, '01-queue');
  await page.click('[data-testid=print-round]');
  ck('«Печать обхода» — брони по месту', await E(() => [...document.querySelectorAll('[data-testid=round-list] tbody tr')].map(t => t.children[1].textContent).join() === 'А-000202,А-000206,А-000210'));
});

await group('С-2 · выдача по брони у окна: срок из «нужна до»; держателю уведомление', async (page, E) => {
  await E(() => window.AX.uiIssue('f206'));
  const pre = await E(() => ({ to: window.AX.S.form.vals.to, due: window.AX.S.form.vals.due, why: window.AX.S.form.vals.why }));
  ck('«Кому» подставлено из брони, «зачем» — из запроса', pre.to === 'isaeva' && pre.why === 'подготовка к комиссии по реструктуризации', pre);
  ck('срок подставлен из «нужна до» запроса — 26.11.2026 (по умолчанию было бы 27.11)', pre.due === '2026-11-26', pre.due);
  await page.click('[data-testid=form-submit]');
  const r = await E(() => { const A = window.AX, i = A.openIssue('f206'); return { st: A.stateOf('f206'), holder: i.holder, due: i.due, note: A.NOTES.filter(n => n.to === 'isaeva' && n.kind === 'issued' && n.folder === 'f206').map(n => n.text), next: A.activeReqs('f206').map(r => [r.who, r.st]) }; });
  ck('папка на руках у Исаевой до 26.11', r.st === 'out' && r.holder === 'isaeva' && r.due === '2026-11-26', r);
  ck('уведомление «Вам выдана папка …, вернуть до 26.11.2026»', r.note.length === 1 && has(r.note[0], 'вернуть до 26.11.2026'), r.note);
  ck('второй в очереди (Кадыров) остаётся в очереди', r.next.join() === 'kadyrov,queue', r.next);
});

await group('С-3 · выдача пришедшему без запроса; забронированную за другим — нельзя', async (page, E) => {
  const r = await E(() => { const A = window.AX;
    const a = A.issue('f206', { to: 'asanov', why: 'срочно', due: '2026-11-20' });
    A.uiIssue('f202'); A.fset('to', 'sydykova', true); const due = A.S.form.vals.due; const b = A.submitForm('main', { why: 'сверка остатков' });
    return { a, due, b, st: A.stateOf('f202'), holder: A.openIssue('f202').holder }; });
  ck('выдать забронированную за Исаевой Асанову — запрет с причиной', !r.a.ok && has(r.a.why, 'забронирована за Исаевой А. до 17.11.2026'), r.a);
  ck('пришедшему без запроса — срок по умолчанию 10 р.д. (27.11.2026)', r.due === '2026-11-27', r.due);
  ck('выдана сразу', r.b.ok && r.st === 'out' && r.holder === 'sydykova', r);
});

await group('С-4 · отказ в запросе → «Запрос закрыт: отказ» → бронь следующему', async (page, E) => {
  const rid = await E(() => window.AX.reservedReq('f206').id);
  await E(rid => window.AX.uiRefuse(rid), rid);
  await page.click('[data-testid=form-submit]');
  ck('без причины — ошибка у поля', await E(() => document.querySelector('[data-testid=form-err]')?.dataset.field === 'reason'));
  await page.fill('[data-testid=ff-reason]', 'дело нужно для проверки');
  await page.click('[data-testid=form-submit]');
  const r = await E(rid => { const A = window.AX, q = A.REQS.find(x => x.id === rid), n = A.reservedReq('f206');
    return { st: q.st, note: A.NOTES.filter(x => x.to === 'isaeva' && x.kind === 'closed').map(x => x.text), next: n && [n.who, n.until], free: A.NOTES.filter(x => x.to === 'kadyrov' && x.kind === 'free' && x.folder === 'f206').length }; }, rid);
  ck('запрос Исаевой — «отказан»', r.st === 'refused');
  ck('Исаевой уведомление «Запрос закрыт: отказ — причина»', r.note.some(t => has(t, 'Запрос закрыт: отказ — дело нужно для проверки')), r.note);
  ck('бронь перешла Кадырову до 17.11 + «папка свободна»', r.next && r.next[0] === 'kadyrov' && r.next[1] === '2026-11-17' && r.free === 1, r);
});

await group('С-5 · возврат стопкой через поле «Возврат»: подсказка «куда» до нажатия; бронь первому; примечание', async (page, E) => {
  await page.fill('[data-testid=ret-input]', '230 205 216 211 000203');
  const pre = await E(() => ({ ok: [...document.querySelectorAll('[data-testid^=ret-row-]')].map(t => t.dataset.testid), bad: [...document.querySelectorAll('[data-testid=ret-bad]')].map(t => t.innerText),
    h230: document.querySelector('[data-testid=ret-hint-230]').textContent, h205: document.querySelector('[data-testid=ret-hint-205]').textContent, btn: document.querySelector('[data-testid=ret-accept]').textContent,
    holders: [...document.querySelectorAll('[data-testid^=ret-row-]')].map(t => t.children[2].textContent) }));
  ck('строки папок: 230, 205, 216 и 203 (ведущие нули не мешают)', pre.ok.join() === 'ret-row-230,ret-row-205,ret-row-216,ret-row-203', pre.ok);
  ck('разные держатели в одной стопке', new Set(pre.holders).size === 4, pre.holders);
  ck('папка не на руках — строка с причиной «в архиве — возвращать нечего»', pre.bad.length === 1 && has(pre.bad[0], 'в архиве — возвращать нечего'), pre.bad);
  ck('подсказка «на полку: Архив ГО · шкаф 1 · полка 3»', pre.h230 === 'на полку: Архив ГО · шкаф 1 · полка 3', pre.h230);
  ck('при очереди — «отложить: бронь — Асанов Б. до 17.11»', pre.h205 === 'отложить: бронь — Асанов Б. до 17.11', pre.h205);
  ck('кнопка «Принять возврат (4)» не считает строку с причиной', pre.btn === 'Принять возврат (4)', pre.btn);
  await page.click('[data-testid=ret-addnote-216]');
  await page.fill('[data-testid=ret-note-216]', 'без письма Минфина № 14');
  await shot(page, '01b-queue-return');
  await page.click('[data-testid=ret-accept]');
  const r = await E(() => { const A = window.AX; return { st: ['f230', 'f205', 'f216', 'f211', 'f203'].map(A.stateOf), res: A.reservedReq('f205') && A.reservedReq('f205').who,
    content: A.folder('f216').content, h: A.history('f216')[0].result, ev211: A.EVENTS.filter(e => e.folder === 'f211' && e.kind === 'returned').length,
    modal: document.querySelector('#overlay').classList.contains('open'), done: [...document.querySelectorAll('[data-testid^=ret-done-]')].map(t => t.dataset.testid.slice(9) + ':' + t.children[2].textContent) }; });
  ck('230, 216, 203 — в архиве; 205 — забронирована за первым в очереди (Асановым)', r.st.join() === 'archive,reserved,archive,archive,archive' && r.res === 'asanov', r);
  ck('примечание — в «Содержание» и в итог выдачи', has(r.content, 'без письма Минфина № 14') && has(r.h, 'вернул с примечанием'), r);
  ck('строка с причиной не принята', r.ev211 === 0);
  ck('итог — под полем, без окна: четыре принятые папки с «куда» (АХ-76)', !r.modal && r.done.join('|') === '230:на полку: Архив ГО · шкаф 1 · полка 3|205:отложить: бронь — Асанов Б. до 17.11|216:на полку: Архив ГО · шкаф 2 · полка 3|203:на полку: Архив ГО · шкаф 1 · полка 1', r);
});

await group('С-6 · просьба продлить при очереди → отказ «папку ждут»', async (page, E) => {
  const xid = await E(() => window.AX.EXTS.find(x => x.st === 'pending').id);
  await E(xid => window.AX.uiDecide(xid, false), xid);
  const pre = await E(() => window.AX.S.form.vals.reason);
  ck('причина подставлена: «папку ждут: Асанов Б., Абдыкеримова Ж.»', pre === 'папку ждут: Асанов Б., Абдыкеримова Ж.', pre);
  await page.click('[data-testid=form-submit]');
  const r = await E(xid => { const A = window.AX, x = A.EXTS.find(e => e.id === xid); return { st: x.st, due: A.openIssue('f205').due, note: A.NOTES.filter(n => n.to === 'jeen' && n.kind === 'ext').map(n => n.text) }; }, xid);
  ck('просьба — отказ, срок прежний 16.11', r.st === 'refused' && r.due === '2026-11-16', r);
  ck('держателю «Решение по продлению: отказ — папку ждут…»', r.note.some(t => has(t, 'Решение по продлению: отказ — папку ждут')), r.note);
});

await group('С-7 · приём новой КЗД → ярлык → уведомление сдавшему; «Принять следующий том»', async (page, E) => {
  await E(() => { window.AX.go('folders'); window.AX.uiAccept(); });
  await pick(page, 'borrower', 'n1');
  const auto = await E(() => document.querySelector('[data-testid=auto-title]').textContent);
  ck('название собирается само: «КЗД · ОсОО «Кен-Сай» · том 1»', auto === 'КЗД · ОсОО «Кен-Сай» · том 1', auto);
  await page.selectOption('[data-testid=ff-shelf]', 'go3-3');
  await pick(page, 'from', 'asanov');
  await page.click('[data-testid=form-submit]');
  const r = await E(() => { const A = window.AX, f = A.byNo(231); return { no: f && A.noStr(f.no), title: f && A.titleOf(f), st: f && A.stateOf(f.id), note: A.NOTES.filter(n => n.to === 'asanov' && n.kind === 'accepted' && n.folder === 'f231').map(n => n.text) }; });
  ck('принята сквозным номером А-000231, сразу «в архиве»', r.no === 'А-000231' && r.st === 'archive', r);
  ck('сдавшему уведомление «Папка принята в архив, № А-000231»', r.note.length === 1 && has(r.note[0], 'Папка принята в архив, № А-000231'), r.note);
  await page.click('[data-testid=toast] button');
  const lab = await E(() => ({ txt: document.querySelector('[data-testid=labels]').innerText, n: document.querySelectorAll('[data-testid=labels] .label').length }));
  ck('ярлык из уведомления о приёме: номер и название, без места', lab.n === 1 && has(lab.txt, 'А-000231') && has(lab.txt, 'КЗД · ОсОО «Кен-Сай» · том 1') && !has(lab.txt, 'полка') && !has(lab.txt, 'ГО ·'), lab);
  await shot(page, '09-print-label');
  const nv = await E(() => { const A = window.AX; A.closeForm(); A.uiNextVol('f231'); const v = Object.assign({}, A.S.form.vals); const r = A.submitForm('main'); const f = A.byNo(232);
    A.openCard('f231'); return { v, r, title: f && A.titleOf(f), shelf: f && f.shelf, card: document.querySelector('#cardpanel .kv').innerText }; });
  ck('«Принять следующий том» подставляет вид, заёмщика, том 2 и полку рядом', nv.v.kind === 'kzd' && nv.v.borrower === 'n1' && +nv.v.vol === 2 && nv.v.shelf === 'go3-3', nv.v);
  ck('принят том 2: «КЗД · ОсОО «Кен-Сай» · том 2», на ту же полку', nv.r.ok && nv.title === 'КЗД · ОсОО «Кен-Сай» · том 2' && nv.shelf === 'go3-3', nv);
  ck('в карточке тома 1 — «1 из 2» со ссылкой на том 2', has(nv.card, '1 из 2') && has(nv.card, 'А-000232'), nv.card);
});

await group('С-8 · ввод при запуске: «Принять и ещё» ×3; КЗД без заёмщика → «Ждут привязки» → привязка', async (page, E) => {
  const r = await E(() => { const A = window.AX, kept = [];
    A.uiAccept();
    for (const t of ['Приказы по личному составу · 2023', 'Приказы по личному составу · 2024', 'Приказы по личному составу · 2025']) {
      A.submitForm('more', { kind: 'nom', title: t, dept: 'Общий отдел', shelf: 'go3-3' }); kept.push([A.S.form && A.S.form.vals.kind, A.S.form && A.S.form.vals.shelf, A.S.form && A.S.form.now]); }
    A.closeForm(); return { kept, nos: [231, 232, 233].map(n => A.byNo(n) && A.titleOf(A.byNo(n))) }; });
  ck('после «Принять и ещё» форма снова открыта с тем же видом и полкой', r.kept.every(k => k[0] === 'nom' && k[1] === 'go3-3'), r.kept);
  ck('в форме — «Принята А-… · подряд 3 · Печать ярлыков (3)»', has(r.kept[2][2], 'Принята <b>А-000233</b>') && has(r.kept[2][2], 'подряд 3') && has(r.kept[2][2], 'Печать ярлыков (3)'), r.kept[2][2]);
  ck('три папки приняты подряд: 231, 232, 233', r.nos.every(Boolean), r.nos);
  const u = await E(() => { const A = window.AX;
    const bad = A.accept({ kind: 'kzd', borrower: '_none', uname: 'ОсОО «Жаңы Жол»', uinn: '1234567890123', shelf: 'go3-1' });
    const ok = A.accept({ kind: 'kzd', borrower: '_none', uname: 'Турдубаев А.Ж.', uinn: '21801199000287', shelf: 'go3-1' });
    const inBind = A.archQueue().bind.map(x => [x.f.id, x.match && x.match.id]);
    const counted = A.noKzd({}, 'arch1').some(x => x.b.id === 'n2');
    const mark = (A.noKzd({}, 'arch1').find(x => x.b.id === 'n2') || {}).unlinked;
    const rb = A.rebind(ok.id, { borrower: 'n2', basis: 'заёмщик заведён в системе, ИНН совпал' });
    return { bad, ok, inBind, counted, mark: mark && mark.id, rb, after: A.archQueue().bind.map(x => x.f.id), still: A.noKzd({}, 'arch1').some(x => x.b.id === 'n2'), title: A.titleOf(A.folder(ok.id)) }; });
  ck('ИНН не из 14 цифр — ошибка у поля ИНН', !u.bad.ok && u.bad.field === 'uinn', u.bad);
  ck('КЗД без заёмщика принята → в «Ждут привязки» с подсказкой «найден по ИНН»', u.ok.ok && u.inBind.some(([id, m]) => id === u.ok.id && m === 'n2'), u.inBind);
  ck('до привязки в «Заёмщики без КЗД» не засчитывается; там пометка «есть непривязанная папка»', u.counted && u.mark === u.ok.id, u);
  ck('«Изменить привязку» → ушла из «Ждут привязки», заёмщик ушёл из «без КЗД», название пересобрано', u.rb.ok && !u.after.includes(u.ok.id) && !u.still && u.title === 'КЗД · Турдубаев А.Ж. · том 1', u);
});

await group('С-9 · печать полки; «Переместить» найденную на чужой полке', async (page, E) => {
  await E(() => { window.AX.go('dicts'); });
  await page.click('[data-testid=print-shelf-go1-5]');
  const pre = await E(() => [...document.querySelectorAll('[data-testid=shelf-list] tbody tr')].map(t => t.children[0].textContent));
  ck('список полки ГО·1·5: А-000228, А-000229', pre.join() === 'А-000228,А-000229', pre);
  await shot(page, '07b-print-shelf');
  const r = await E(() => { const A = window.AX; A.closeForm(); A.openCard('f229'); A.uiMove('f229'); A.fset('shelf', 'go1-4');
    const s = A.submitForm('main'); return { s, shelf: A.folder('f229').shelf, list: A.shelfList('go1-5').map(x => x.no), ev: A.EVENTS.filter(e => e.folder === 'f229' && e.kind === 'moved').map(e => [e.from, e.to]) }; });
  ck('перемещена на ГО·1·4; в списке ГО·1·5 её больше нет', r.s.ok && r.shelf === 'go1-4' && r.list.join() === 'А-000228', r);
  ck('перемещение — в истории (откуда → куда)', r.ev.length === 1 && r.ev[0].join() === 'go1-5,go1-4', r.ev);
});

await group('С-10 · папка у уволенного → «Списать: утрачена» → очередь закрыта; «Восстановить»', async (page, E) => {
  await page.click('[data-testid=fired-writeoff-208]');
  const note = await E(() => document.querySelector('[data-testid=form-now]').innerText + ' / ' + document.querySelector('[data-testid=form-will]').innerText);
  ck('в форме — «на руках у Орозова Т. (уволен)» и «очередь (1) закроется»', has(note, 'На руках у Орозова Т. (уволен)') && has(note, 'очередь (1) закроется'), note);
  await page.click('[data-testid=ff-reason] [data-v="утрачена"]');
  await page.fill('[data-testid=ff-basis]', 'Акт об утрате № 15 от 13.11.2026');
  await page.click('[data-testid=form-submit]');
  const r = await E(() => { const A = window.AX; return { st: A.stateOf('f208'), q: A.REQS.filter(x => x.folder === 'f208').map(x => x.st), note: A.NOTES.filter(n => n.to === 'kadyrov' && n.kind === 'closed' && n.folder === 'f208').map(n => n.text),
    task: A.tasks().some(t => t.folder === 'f208'), fired: A.archQueue().fired.length, top: A.history('f208')[0] }; });
  ck('выбыла; запрос Кадырова — «закрыт: папка выбыла» + уведомление', r.st === 'gone' && r.q.join() === 'closedGone' && r.note.some(t => has(t, 'папка выбыла')), r);
  ck('задание «Вернуть папку» закрыто; список «На руках у уволенных» пуст', !r.task && r.fired === 0, r);
  ck('первая строка истории — списание с последним держателем', r.top.type === 'event' && r.top.e.kind === 'writtenOff' && r.top.e.holder === 'orozov', r.top);
  const rs = await E(() => { const A = window.AX; A.openCard('f208'); A.uiRestore('f208'); const pre = A.S.form.vals.shelf; const s = A.submitForm('main', { basis: 'нашлась в кабинете ДАК, служебная записка № 31' }); return { pre, s, st: A.stateOf('f208') }; });
  ck('«Восстановить»: прежняя полка подставлена; папка снова в архиве', rs.pre === 'go1-4' && rs.s.ok && rs.st === 'archive', rs);
});

await group('С-20 · держатель у окна просит неделю → «Продлить» напрямую с причиной → уведомление', async (page, E) => {
  await E(() => { window.AX.request('f225', { why: 'сверка графика' }, 'kadyrov'); window.AX.go('folders'); window.AX.openCard('f225'); });
  await page.click('[data-testid=cb-extend]');
  ck('в форме видна очередь: «Ждут: 1. Кадыров Т. — сверка графика»', await E(() => document.querySelector('[data-testid=form-now]').innerText.includes('Ждут: 1. Кадыров Т. — сверка графика')));
  await page.fill('[data-testid=ff-date]', '27.11.2026');
  await page.click('[data-testid=form-submit]');
  ck('без причины — ошибка у поля', await E(() => document.querySelector('[data-testid=form-err]')?.dataset.field === 'reason'));
  await page.fill('[data-testid=ff-reason]', 'держатель у окна: выезд к залогодателю 25.11');
  await page.click('[data-testid=form-submit]');
  const r = await E(() => { const A = window.AX, i = A.openIssue('f225'); return { due: i.due, ext: i.exts.map(x => x.via), note: A.NOTES.filter(n => n.to === 'asanov' && n.kind === 'ext' && n.folder === 'f225').map(n => n.text) }; });
  ck('срок 27.11, продление «напрямую» в истории', r.due === '2026-11-27' && r.ext.join() === 'напрямую', r);
  ck('держателю «Решение по продлению: продлено до 27.11.2026»', r.note.some(t => has(t, 'продлено до 27.11.2026')), r.note);
});

await group('С-21 · акт уничтожения: отбор полки → отметить все → «Списать» пачкой; «Печать ярлыков» листом', async (page, E) => {
  await E(() => { window.AX.go('folders'); window.AX.setF('room', 'go'); window.AX.setF('cab', 'go3'); window.AX.setF('shelf', 'go3-4'); });
  await page.click('[data-testid=sel-all]');
  ck('отмечены все три папки полки', await E(() => document.querySelector('[data-testid=sel-count]').textContent === '3'));
  await page.click('[data-testid=b-writeoff]');
  ck('до списания — сколько на руках и с очередью', await E(() => document.querySelector('[data-testid=wo-preview]').textContent === 'Из отмеченных: на руках — 0, с очередью — 0.'));
  await page.click('[data-testid=ff-reason] [data-v="уничтожена"]');
  await page.fill('[data-testid=ff-basis]', 'Акт об уничтожении № 4 от 13.11.2026');
  await page.click('[data-testid=form-submit]');
  const r = await E(() => { const A = window.AX; return ['f219', 'f220', 'f221'].map(id => [A.stateOf(id), A.folder(id).gone.basis, A.EVENTS.filter(e => e.folder === id && e.kind === 'writtenOff').length]); });
  ck('все три выбыли с одним основанием, запись — у каждой', r.every(x => x[0] === 'gone' && x[1] === 'Акт об уничтожении № 4 от 13.11.2026' && x[2] === 1), r);
  const pv = await E(() => { const A = window.AX; A.issue('f211', { to: 'jeen', why: 'х', due: '2026-11-30' }); A.request('f212', { why: 'х' }, 'jeen'); return A.writeOffPreview(['f211', 'f212', 'f213', 'f219']); });
  ck('предупреждение пачки считает на руках, с очередью и уже выбывшие', pv.out === 1 && pv.queued === 1 && pv.gone === 1 && pv.total === 3, pv);
  await E(() => { const A = window.AX; A.closeForm(); A.setF('room', ''); A.uiAccept(); ['Акты · 2019', 'Акты · 2020', 'Акты · 2021'].forEach(t => A.submitForm('more', { kind: 'other', title: t, dept: 'Бухгалтерия', shelf: 'go3-3' })); A.closeForm();
    A.S.sel.clear(); [231, 232, 233].forEach(n => A.S.sel.add('f' + n)); A.render(); });
  await page.click('[data-testid=b-labels]');
  const lab = await E(() => ({ n: document.querySelectorAll('[data-testid=labels] .label').length, txt: document.querySelector('[data-testid=labels]').innerText }));
  ck('после ввода при запуске — лист ярлыков по отмеченным (3), без места', lab.n === 3 && !has(lab.txt, 'полка') && !has(lab.txt, 'ГО ·'), lab);
});

await group('С-11 · куратор из врезки «Где бумага» запрашивает все тома пачкой', async (page, E) => {
  await E(() => { window.AX.setUser('isaeva'); window.AX.openBorrower('b2'); });
  await shot(page, '10-paperbox');
  ck('врезка: два тома, кнопка «Запросить все тома (2)»', await E(() => document.querySelector('[data-testid=pb-all]').textContent === 'Запросить все тома (2)'));
  await page.click('[data-testid=pb-all]');
  await page.fill('[data-testid=ff-why]', 'подготовка к мониторингу');
  await page.click('[data-testid=form-submit]');
  const r = await E(() => { const A = window.AX; return ['f202', 'f203'].map(id => { const q = A.activeReqs(id).find(x => x.who === 'isaeva'); return q && [q.st, A.posOf(q)]; }); });
  ck('том 1 (в архиве) забронирован, том 2 (на руках) — № 1 в очереди', r[0] && r[0][0] === 'reserved' && r[1] && r[1][0] === 'queue' && r[1][1] === 1, r);
  const nk = await E(() => { const A = window.AX; A.openBorrower('n2'); return !!document.querySelector('[data-testid=pb-nokzd]') && document.querySelector('[data-testid=pb-nokzd]').textContent; });
  ck('у заёмщика без КЗД — «Кредитно-залоговое дело в архив не сдано»', nk === 'Кредитно-залоговое дело в архив не сдано', nk);
});

await group('С-12 · «Папка свободна» → получил у окна → «Мои папки»', async (page, E) => {
  const r = await E(() => { const A = window.AX;
    const q = A.request('f202', { why: 'мониторинг', needBy: '2026-11-25' }, 'isaeva');
    const n = A.NOTES.filter(x => x.to === 'isaeva' && x.kind === 'free' && x.folder === 'f202').map(x => x.text);
    A.setUser('isaeva'); const before = (A.mine('isaeva').requests.find(x => x.f.id === 'f202') || {}).r; const bst = before && before.st;
    const row = document.querySelector('[data-testid=req-202]').innerText;
    A.setUser('arch1'); A.uiIssue('f202'); const due = A.S.form.vals.due; const s = A.submitForm('main');
    A.setUser('isaeva'); const m = A.mine('isaeva');
    return { q, n, before: bst, row, due, s, hands: m.hands.map(x => x.f.id), reqs: m.requests.map(x => x.f.id), dom: !!document.querySelector('[data-testid=hand-202]') }; });
  ck('уведомление «Папка … свободна, заберите до 17.11.2026»', r.q.reserved && r.n.some(t => has(t, 'свободна, заберите до 17.11.2026')), r.n);
  ck('в «Моих запросах» — «ждёт вас в архиве до 17.11.2026»', r.before === 'reserved' && has(r.row, 'ждёт вас в архиве до 17.11.2026'), r.row);
  ck('выдача: срок из «нужна до» (25.11)', r.s.ok && r.due === '2026-11-25', r);
  ck('папка — в «На руках у меня», запрос ушёл', r.hands.includes('f202') && !r.reqs.includes('f202') && r.dom, r);
});

await group('С-13 · «Передать» заведующему → «Получил» → передача обратно', async (page, E) => {
  await E(() => window.AX.setUser('asanov'));
  await page.click('[data-testid=transfer-225]');
  await pick(page, 'to', 'mambetov');
  await page.click('[data-testid=form-submit]');
  const a = await E(() => { const A = window.AX, i = A.openIssue('f225'); return { st: A.stateOf('f225'), holder: i.holder, due: i.due, mark: document.querySelector('[data-testid=hand-225]').innerText, note: A.NOTES.filter(n => n.to === 'mambetov' && n.kind === 'transfer' && n.folder === 'f225').length }; });
  ck('«передаётся»; держатель пока — Асанов; срок не меняется', a.st === 'transfer' && a.holder === 'asanov' && a.due === '2026-11-20', a);
  ck('пометка в строке «передаётся → Мамбетов К., ждёт «Получил»»; получателю уведомление', has(a.mark, 'передаётся → Мамбетов К.') && a.note === 1, a);
  await E(() => window.AX.setUser('mambetov'));
  await shot(page, '04b-mine-head');
  ck('у заведующего «Вам передают» — первым блоком', await E(() => document.querySelector('.section-h[data-testid^=blk]').dataset.testid === 'blk-incoming'));
  await page.click('[data-testid=got-225]');
  const b = await E(() => { const A = window.AX; const r1 = A.transfer('f225', { to: 'asanov' }, 'mambetov'); const r2 = A.received('f225', 'asanov'); const h = A.history('f225').find(x => x.type === 'issue');
    return { r1, r2, holder: A.openIssue('f225').holder, holders: h.holders, res: h.result }; });
  ck('«Получил» → держатель Мамбетов; передача обратно → держатель снова Асанов', b.r1.ok && b.r2.ok && b.holder === 'asanov', b);
  ck('история по выдаче: Асанов → Мамбетов → Асанов, итог «передана»', b.holders.join() === 'asanov,mambetov,asanov' && has(b.res, 'передана'), b);
});

await group('С-14 · напоминание за 2 р.д. → «Попросить продление» → решение', async (page, E) => {
  const r = await E(() => { const A = window.AX;
    const pre = A.NOTES.filter(n => n.to === 'isaeva' && n.kind === 'remind' && n.folder === 'f223').map(n => [n.d, n.text]);
    A.setUser('isaeva'); A.uiAskExt('f223'); const s = A.submitForm('main', { date: '2026-11-24', reason: 'заключение по мониторингу не готово' });
    const row = document.querySelector('[data-testid=hand-223]').innerText;
    A.setUser('arch1'); const qx = document.querySelector('[data-testid=ext-223]') ? 1 : 0;
    const x = A.EXTS.find(e => e.folder === 'f223' && e.st === 'pending'); const d = A.decideExtend(x.id, { grant: true });
    return { pre, s, row, qx, d, due: A.openIssue('f223').due, note: A.NOTES.filter(n => n.to === 'isaeva' && n.kind === 'ext').map(n => n.text) }; });
  ck('напоминание «Скоро вернуть папку» пришло 13.11 — за 2 р.д. до срока 17.11', r.pre.length === 1 && r.pre[0][0] === '2026-11-13' && has(r.pre[0][1], 'до 17.11.2026'), r.pre);
  ck('просьба ушла; в строке — «просьба продлить до 24.11.2026 — на решении»', r.s.ok && has(r.row, 'просьба продлить до 24.11.2026 — на решении'), r.row);
  ck('у архивариуса — в блоке «Продления»', r.qx === 1);
  ck('продлено до 24.11; держателю «Решение по продлению: продлено»', r.d.ok && r.due === '2026-11-24' && r.note.some(t => has(t, 'продлено до 24.11.2026')), r);
});

await group('С-15 · куратор: «Заёмщики без КЗД» с «мои заёмщики»; сдал дело → уведомление о приёме', async (page, E) => {
  await E(() => { window.AX.setUser('asanov'); window.AX.go('nokzd'); });
  await shot(page, '05-nokzd');
  const a = await E(() => ({ on: document.querySelector('[data-testid=nk-mine]').checked, rows: [...document.querySelectorAll('[data-testid^=nk-]')].filter(t => t.tagName === 'TR').map(t => t.dataset.testid),
    mark: document.querySelector('[data-testid=nk-unlinked-n5]')?.textContent || '' }));
  ck('куратору отбор «мои заёмщики» включён по умолчанию', a.on);
  ck('в списке — свои: ОсОО «Достук Трейд», ОсОО «Кен-Сай» (больше дней — выше)', a.rows.join() === 'nk-n5,nk-n1', a.rows);
  ck('пометка «есть непривязанная папка А-000217»', has(a.mark, 'есть непривязанная папка А-000217'), a.mark);
  await page.click('[data-testid=nk-closed]');
  ck('«и закрытые» добавляет заёмщиков с закрытыми кредитами', await E(() => [...document.querySelectorAll('tr[data-testid^=nk-]')].map(t => t.dataset.testid).join() === 'nk-n4,nk-b6,nk-n5,nk-n1'));
  const b = await E(() => { const A = window.AX; A.setUser('arch1'); A.go('nokzd'); document.querySelector('[data-testid=nk-accept-n1]').click(); const pre = [A.S.form.vals.kind, A.S.form.vals.borrower];
    const s = A.submitForm('main', { shelf: 'go3-3', from: 'asanov' }); return { pre, s, gone: !A.noKzd({}, 'asanov').some(x => x.b.id === 'n1'), note: A.NOTES.filter(n => n.to === 'asanov' && n.kind === 'accepted').map(n => n.text) }; });
  ck('архивариусу в строке «Принять папку» с подставленным заёмщиком', b.pre.join() === 'kzd,n1', b.pre);
  ck('после приёма заёмщик ушёл из списка; куратору «Папка принята в архив, № А-000231»', b.s.ok && b.gone && b.note.some(t => has(t, '№ А-000231')), b);
  const c = await E(() => window.AX.noKzd({}, 'arch1').find(x => x.b.id === 'b9'));
  ck('заёмщик с выбывшей КЗД — в списке с пометкой «КЗД выбыла»', c && c.goneKzd && c.goneKzd.id === 'f209', c && c.b);
});

await group('С-16 · юрист: запрос занятой папки → место в очереди → куратор передаёт напрямую → запрос закрыт', async (page, E) => {
  const r = await E(() => { const A = window.AX;
    const pv = A.requestPreview('f225', 'jeen'); const q = A.request('f225', { why: 'подготовка иска', needBy: '2026-12-01' }, 'jeen');
    A.setUser('asanov'); A.openCard('f225'); const btnQ = !!document.querySelector('[data-testid=q-transfer-jeen]');
    A.uiTransfer('f225', 'jeen'); const info = document.querySelector('[data-testid=tr-closes]')?.textContent || ''; const t = A.submitForm('main');
    A.setUser('jeen'); const g = A.received('f225', 'jeen'); const rq = A.REQS.find(x => x.id === q.req);
    return { pv, q, btnQ, info, t, g, st: rq.st, holder: A.openIssue('f225').holder, h: A.history('f225').find(x => x.type === 'issue').events.map(e => e.kind) }; });
  ck('строка формы: «на руках у Асанова Б. до 20.11.2026, вы будете № 1»', r.pv === 'на руках у Асанова Б. до 20.11.2026, вы будете № 1', r.pv);
  ck('запрос встал № 1 в очередь', r.q.ok && r.q.pos === 1 && !r.q.reserved, r.q);
  ck('держатель видит в очереди «Передать» ждущему; форма — «передача закроет этот запрос»', r.btnQ && has(r.info, 'передача закроет этот запрос'), r);
  ck('«Получил» → держатель — юрист, запрос «закрыт передачей»', r.t.ok && r.g.ok && r.holder === 'jeen' && r.st === 'closedTransfer', r);
  ck('запрос виден в событиях выдачи', r.h.includes('requested') && r.h.includes('reqClosedTransfer'), r.h);
});

await group('С-17 · юрист: продление под суд; возврат «без оригинала» с примечанием', async (page, E) => {
  const r = await E(() => { const A = window.AX;
    const a = A.askExtend('f227', { date: '2026-12-15', reason: 'суд назначен на 10.12, нужен оригинал договора' }, 'jeen');
    const d = A.decideExtend(a.ext, { grant: true }, 'arch2');
    const ret = A.acceptReturn('f227', { note: 'без оригинала договора залога — приобщён к делу № 2-777/26' }, 'arch2');
    const h = A.history('f227').find(x => x.type === 'issue');
    return { a, d, ret, content: A.folder('f227').content, res: h.result, ev: h.events.map(e => e.kind) }; });
  ck('продлено по просьбе до 15.12', r.a.ok && r.d.ok, r);
  ck('возврат с примечанием: в «Содержании» и в итоге выдачи', r.ret.ok && has(r.content, 'без оригинала договора залога') && has(r.res, 'продлена 1 раз') && has(r.res, 'вернул с примечанием'), r);
});

await group('С-18 · бухгалтер: «Мои папки» пусты → «Найти папку» по содержанию → одноимённые различает подразделение → запрос', async (page, E) => {
  await E(() => window.AX.setUser('sydykova'));
  ck('стартовый экран «Мои папки» пуст: «У вас нет папок архива»', await E(() => window.AX.S.view === 'mine' && !!document.querySelector('[data-testid=mine-empty]')));
  await shot(page, '04-mine-empty');
  await page.fill('[data-testid=mine-search]', 'протоколы правления');
  await page.keyboard.press('Enter');
  const r = await E(() => ({ view: window.AX.S.view, q: window.AX.S.q, rows: [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => [t.dataset.testid, t.children[2].textContent.trim(), t.children[3].textContent]) }));
  ck('Enter ведёт в «Папки» с запросом', r.view === 'folders' && r.q === 'протоколы правления', r);
  ck('две «Протоколы правления · 2025» — Бухгалтерия и ДПО', r.rows.length === 2 && r.rows.map(x => x[2]).join() === 'Бухгалтерия,ДПО', r.rows);
  await page.click('[data-testid=sel-213]');
  await page.click('[data-testid=b-request]');
  await page.fill('[data-testid=ff-why]', 'сверка премирования за 2025');
  await page.fill('[data-testid=ff-needBy]', '30.11.2026');
  await page.click('[data-testid=form-submit]');
  const s = await E(() => { const A = window.AX, q = A.activeReqs('f213')[0]; A.setUser('arch1'); const due = A.dueDefault('f213', 'sydykova'); return { st: q && q.st, needBy: q && q.needBy, due }; });
  ck('запрос с «нужна до»: папка забронирована; при выдаче срок — 30.11 (не срок по умолчанию)', s.st === 'reserved' && s.needBy === '2026-11-30' && s.due === '2026-11-30', s);
});

await group('С-19 · руководитель: поднятое задание «Вернуть папку» → карточка → отбор «подразделение держателя»', async (page, E) => {
  await E(() => window.AX.setUser('mambetov'));
  const r = await E(() => ({ up: document.querySelector('[data-testid=task-up-230]')?.textContent || '', tasks: window.AX.tasksOf('mambetov').map(t => [t.folder, t.holder, t.up]) }));
  ck('у заведующего — задание по А-000230 Асанова, поднятое к нему', has(r.up, 'поднято к руководителю: Мамбетов К.') && r.tasks.some(t => t[0] === 'f230' && t[1] === 'asanov' && t[2]), r);
  await page.click('[data-testid=task-230]');
  ck('задание ведёт в карточку папки', await E(() => window.AX.S.card === 'f230' && document.querySelector('#cardpanel').classList.contains('open')));
  await E(() => { window.AX.closeCard(); window.AX.go('folders'); window.AX.setF('hdept', 'ДРР'); });
  ck('отбор «подразделение держателя» ДРР — папки на руках у его сотрудников', await E(() => [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => t.dataset.testid).join() === 'row-201,row-216,row-225,row-230'));
});

/* ======================= правила движка (§4) ======================= */

await group('П-1 · Принять: привязка, действующая полка, сквозной номер, название само', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.nonArch = A.accept({ kind: 'nom', title: 'х', shelf: 'go3-3' }, 'asanov');
    o.noBor = A.accept({ kind: 'kzd', shelf: 'go3-3' });
    o.retShelf = A.accept({ kind: 'nom', title: 'х', shelf: 'go2-5' });
    o.retKind = A.accept({ kind: 'cards', title: 'х', shelf: 'go3-3' });
    o.noTitle = A.accept({ kind: 'other', shelf: 'go3-3' });
    o.dup = A.accept({ kind: 'kzd', borrower: 'b2', vol: 2, shelf: 'go3-3' });
    o.a = A.accept({ kind: 'kzd', borrower: 'b1', vol: 2, shelf: 'go1-1' }); o.b = A.accept({ kind: 'other', title: 'Сметы · 2026', dept: 'Бухгалтерия', shelf: 'go2-2' });
    o.t = A.titleOf(A.folder(o.a.id)); o.ev = A.EVENTS.filter(e => e.folder === o.a.id).map(e => e.kind);
    o.opts = (() => { A.uiAccept(); const s = [...document.querySelectorAll('[data-testid=ff-shelf] option')].map(x => x.value); const k = [...document.querySelectorAll('[data-testid=ff-kind] option')].map(x => x.value); A.closeForm(); return { s, k }; })();
    return o; });
  ck('не архивариус — нельзя', !r.nonArch.ok && has(r.nonArch.why, 'архивариус'), r.nonArch);
  ck('вид с привязкой без заёмщика — нельзя', !r.noBor.ok && r.noBor.field === 'borrower', r.noBor);
  ck('выведенная полка — нельзя', !r.retShelf.ok && has(r.retShelf.why, 'выведена'), r.retShelf);
  ck('выведенный вид — нельзя', !r.retKind.ok && has(r.retKind.why, 'выведен'), r.retKind);
  ck('без привязки — название обязательно', !r.noTitle.ok && r.noTitle.field === 'title', r.noTitle);
  ck('тот же том того же заёмщика дважды — нельзя', !r.dup.ok && has(r.dup.why, 'том 2 уже в архиве — А-000203'), r.dup);
  ck('сквозной номер: А-000231, затем А-000232', r.a.no === 'А-000231' && r.b.no === 'А-000232', [r.a, r.b]);
  ck('название с привязкой собирается само', r.t === 'КЗД · ОсОО «Ак-Жол Агро» · том 2', r.t);
  ck('событие «принята»', r.ev.join() === 'accepted', r.ev);
  ck('в форме выведенная полка и выведенный вид не предлагаются', !r.opts.s.includes('go2-5') && !r.opts.k.includes('cards'), r.opts);
});

await group('П-2 · Выдать: архивариус; свободная или своя бронь; срок и «зачем» обязательны; действующий получатель; пачкой', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.nonArch = A.issue('f211', { to: 'jeen', why: 'х', due: '2026-11-30' }, 'asanov');
    o.gone = A.issue('f209', { to: 'jeen', why: 'х', due: '2026-11-30' });
    o.busy = A.issue('f203', { to: 'jeen', why: 'х', due: '2026-11-30' });
    o.noWhy = A.issue('f211', { to: 'jeen', why: ' ', due: '2026-11-30' });
    o.noDue = A.issue('f211', { to: 'jeen', why: 'х', due: '' });
    o.fired = A.issue('f211', { to: 'orozov', why: 'х', due: '2026-11-30' });
    o.ok = A.issue('f211', { to: 'jeen', why: 'сверка', due: '2026-11-30' });
    o.note = A.NOTES.filter(n => n.to === 'jeen' && n.kind === 'issued' && n.folder === 'f211').length;
    o.batch = A.issueBatch(['f212', 'f203', 'f209', 'f206', 'f213'], { to: 'jeen', why: 'проверка', due: '2026-11-30' });
    o.batchNoWhy = A.issueBatch(['f212'], { to: 'jeen', why: '', due: '2026-11-30' });
    o.each = o.batch.done.map(id => A.EVENTS.filter(e => e.folder === id && e.kind === 'issued').length);
    return o; });
  ck('не архивариус — нельзя', !r.nonArch.ok, r.nonArch);
  ck('выбывшую — нельзя', !r.gone.ok && has(r.gone.why, 'выбыла'), r.gone);
  ck('на руках — нельзя, «сначала принять возврат»', !r.busy.ok && has(r.busy.why, 'сначала принять возврат'), r.busy);
  ck('«зачем» и срок обязательны', !r.noWhy.ok && r.noWhy.field === 'why' && !r.noDue.ok && r.noDue.field === 'due', [r.noWhy, r.noDue]);
  ck('уволенному — нельзя', !r.fired.ok && has(r.fired.why, 'действующий'), r.fired);
  ck('выдача + уведомление держателю', r.ok.ok && r.note === 1, r);
  ck('пачкой: выданы свободные (212, 213), занятые нет — с причиной', r.batch.done.join() === 'f212,f213' && r.batch.skipped.map(s => s.id).join() === 'f203,f209,f206', r.batch);
  ck('пачкой: у каждой папки своя выдача', r.each.every(n => n === 1), r.each);
  ck('пачкой: «зачем» обязательно для всей пачки', !r.batchNoWhy.ok && r.batchNoWhy.field === 'why', r.batchNoWhy);
});

await group('П-3 · Запросить: «зачем» обязательно; второй свой и на выбывшую — нельзя; очередь по времени; пачкой', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.noWhy = A.request('f216', { why: '' }, 'kadyrov');
    o.past = A.request('f216', { why: 'х', needBy: '2026-11-13' }, 'kadyrov');
    o.a = A.request('f216', { why: 'первый' }, 'kadyrov'); o.b = A.request('f216', { why: 'второй' }, 'sydykova');
    o.again = A.request('f216', { why: 'ещё раз' }, 'kadyrov');
    o.gone = A.request('f209', { why: 'х' }, 'kadyrov');
    o.own = A.request('f216', { why: 'х' }, 'mambetov');
    o.order = A.activeReqs('f216').map(q => [q.who, A.posOf(q)]);
    o.batch = A.requestBatch(['f211', 'f212', 'f209'], { why: 'проверка' }, 'jeen');
    o.batchSt = ['f211', 'f212'].map(id => A.activeReqs(id)[0].st);
    return o; });
  ck('без «зачем» — нельзя; «нужна до» не в прошлом', !r.noWhy.ok && r.noWhy.field === 'why' && !r.past.ok && r.past.field === 'needBy', [r.noWhy, r.past]);
  ck('порядок очереди — по времени: № 1, № 2', r.order.join('|') === 'kadyrov,1|sydykova,2', r.order);
  ck('второй свой запрос — нельзя', !r.again.ok && has(r.again.why, 'уже есть запрос'), r.again);
  ck('на выбывшую — нельзя', !r.gone.ok && has(r.gone.why, 'выбыла'), r.gone);
  ck('держатель свою папку не запрашивает', !r.own.ok && has(r.own.why, 'у вас на руках'), r.own);
  ck('пачкой: запрос на каждую папку; свободные сразу забронированы; выбывшая — с причиной', r.batch.done.join() === 'f211,f212' && r.batch.skipped[0].id === 'f209' && r.batchSt.join() === 'reserved,reserved', r);
});

await group('П-4 · Бронь: ставит система; срок брони; другому не выдать; истекла → «не забран», бронь следующему', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.a = A.request('f211', { why: 'х' }, 'kadyrov'); o.b = A.request('f211', { why: 'у' }, 'sydykova');
    o.note = A.NOTES.filter(n => n.to === 'kadyrov' && n.kind === 'free' && n.folder === 'f211').map(n => n.text);
    o.other = A.issue('f211', { to: 'sydykova', why: 'х', due: '2026-11-30' });
    o.until = A.reservedReq('f211').until;
    A.setToday('2026-11-17'); o.still = A.reservedReq('f211').who;
    A.setToday('2026-11-18'); o.r1 = A.REQS.find(q => q.id === o.a.req).st; o.next = A.reservedReq('f211') && [A.reservedReq('f211').who, A.reservedReq('f211').until];
    o.closed = A.NOTES.filter(n => n.to === 'kadyrov' && n.kind === 'closed' && n.folder === 'f211').map(n => n.text);
    o.ev = A.EVENTS.filter(e => e.folder === 'f211' && e.kind === 'reqNotTaken').length;
    return o; });
  ck('свободная папка — бронь первому сразу, без одобрения', r.a.reserved && !r.b.reserved, r);
  ck('срок брони — 2 р.д. (до 17.11)', r.until === '2026-11-17', r.until);
  ck('«Папка … свободна, заберите до 17.11.2026»', r.note.length === 1 && has(r.note[0], 'заберите до 17.11.2026'), r.note);
  ck('другому выдать нельзя', !r.other.ok && has(r.other.why, 'забронирована за Кадыровым Т.'), r.other);
  ck('в последний день брони она ещё стоит', r.still === 'kadyrov');
  ck('срок прошёл → «не забран», бронь следующему (до 20.11)', r.r1 === 'notTaken' && r.next && r.next[0] === 'sydykova' && r.next[1] === '2026-11-20', r);
  ck('уведомление «Запрос закрыт: не забран»; событие в истории', r.closed.some(t => has(t, 'не забран')) && r.ev === 1, r);
});

await group('П-5 · Отказать в запросе: причина обязательна, в любой момент до выдачи', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    const q = A.activeReqs('f205'); o.noReason = A.refuse(q[1].id, '');
    o.nonArch = A.refuse(q[1].id, 'х', 'asanov');
    o.queued = A.refuse(q[1].id, 'не по профилю', 'arch2');
    o.note = A.NOTES.filter(n => n.to === 'abdyk' && n.kind === 'closed').map(n => n.text);
    const res = A.reservedReq('f206'); A.issue('f206', { to: res.who, why: 'х', due: '2026-11-27' }); o.issued = A.refuse(res.id, 'х');
    o.left = A.activeReqs('f205').map(x => x.who);
    return o; });
  ck('без причины — ошибка у поля', !r.noReason.ok && r.noReason.field === 'reason', r.noReason);
  ck('не архивариус — нельзя', !r.nonArch.ok, r.nonArch);
  ck('отказ в запросе из очереди (не только в брони)', r.queued.ok && r.left.join() === 'asanov', r);
  ck('запросившему «Запрос закрыт: отказ — причина»', r.note.some(t => has(t, 'отказ — не по профилю')), r.note);
  ck('после выдачи отказать нельзя', !r.issued.ok && has(r.issued.why, 'выдан'), r.issued);
});

await group('П-6 · Продление: просит только держатель, решает архивариус; напрямую — архивариус с причиной', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.notHolder2 = A.askExtend('f225', { date: '2026-12-01', reason: 'х' }, 'jeen');
    o.early = A.askExtend('f225', { date: '2026-11-20', reason: 'х' }, 'asanov');
    o.noReason = A.askExtend('f225', { date: '2026-12-01', reason: '' }, 'asanov');
    o.ok = A.askExtend('f225', { date: '2026-12-01', reason: 'выезд' }, 'asanov');
    o.twice = A.askExtend('f225', { date: '2026-12-02', reason: 'х' }, 'asanov');
    o.gateDirect = A.gate('extend', 'f225', 'arch1');
    o.refNoReason = A.decideExtend(o.ok.ext, { grant: false, reason: '' });
    o.nonArch = A.decideExtend(o.ok.ext, { grant: true }, 'mambetov');
    o.grant = A.decideExtend(o.ok.ext, { grant: true });
    o.due = A.openIssue('f225').due;
    o.dNonArch = A.extend('f216', { date: '2026-12-05', reason: 'х' }, 'asanov');
    o.dEarly = A.extend('f216', { date: '2026-11-20', reason: 'х' });
    o.dOk = A.extend('f216', { date: '2026-12-05', reason: 'по телефону' });
    o.dArch = A.extend('f211', { date: '2026-12-05', reason: 'х' });
    o.notes = A.NOTES.filter(n => n.kind === 'ext' && ['asanov', 'mambetov'].includes(n.to)).map(n => n.to);
    return o; });
  ck('просит только держатель', !r.notHolder2.ok && has(r.notHolder2.why, 'только держатель'), r.notHolder2);
  ck('дата не позже текущего срока — нельзя', !r.early.ok && r.early.field === 'date', r.early);
  ck('причина обязательна', !r.noReason.ok && r.noReason.field === 'reason', r.noReason);
  ck('вторая просьба, пока первая на решении, — нельзя', r.ok.ok && !r.twice.ok, r.twice);
  ck('пока просьба на решении, «Продлить» напрямую — серая с причиной', !r.gateDirect.ok && has(r.gateDirect.why, 'просьба держателя'), r.gateDirect);
  ck('отказ — с причиной; решает только архивариус', !r.refNoReason.ok && !r.nonArch.ok, [r.refNoReason, r.nonArch]);
  ck('продлено по просьбе: срок 01.12', r.grant.ok && r.due === '2026-12-01', r);
  ck('напрямую: не архивариус — нельзя (по праву); дата позже срока; на руках — можно; в архиве — нельзя', !r.dNonArch.ok && has(r.dNonArch.why, 'архивариус') && !r.dEarly.ok && r.dOk.ok && !r.dArch.ok, [r.dNonArch, r.dEarly, r.dOk, r.dArch]);
  ck('держателям — «Решение по продлению» (по просьбе и напрямую)', r.notes.includes('asanov') && r.notes.includes('mambetov'), r.notes);
});

await group('П-7 · Передать: только держатель; до «Получил» — «передаётся», отвечает передающий; «Отменить» и «Не получал»', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.notHolder = A.transfer('f225', { to: 'jeen' }, 'jeen');
    o.self = A.transfer('f225', { to: 'asanov' }, 'asanov');
    o.fired = A.transfer('f225', { to: 'orozov' }, 'asanov');
    o.ok = A.transfer('f230', { to: 'mambetov' }, 'asanov');
    o.st = A.stateOf('f230'); o.due = A.openIssue('f230').due; o.task = A.tasks().find(t => t.folder === 'f230').holder;
    o.again = A.transfer('f230', { to: 'jeen' }, 'asanov');
    o.cancelOther = A.cancelTransfer('f230', 'mambetov');
    o.notGot = A.notReceived('f201', 'mambetov'); o.after = [A.stateOf('f201'), A.openIssue('f201').holder];
    o.noteSender = A.NOTES.filter(n => n.to === 'asanov' && n.kind === 'transfer' && n.folder === 'f201').map(n => n.text);
    o.cancel = A.cancelTransfer('f230', 'asanov'); o.after2 = [A.stateOf('f230'), A.openIssue('f230').holder];
    o.ev = A.EVENTS.filter(e => ['transferNotGot', 'transferCancel'].includes(e.kind) && ['f201', 'f230'].includes(e.folder)).length;
    return o; });
  ck('не держатель — нельзя; самому себе — нельзя; уволенному — нельзя', !r.notHolder.ok && !r.self.ok && !r.fired.ok, [r.notHolder, r.self, r.fired]);
  ck('«передаётся», срок не меняется', r.ok.ok && r.st === 'transfer' && r.due === '2026-11-10', r);
  ck('просрочка при незавершённой передаче — задание передающему', r.task === 'asanov', r.task);
  ck('вторая передача, пока первая ждёт, — нельзя; отменяет только передающий', !r.again.ok && !r.cancelOther.ok, [r.again, r.cancelOther]);
  ck('«Не получал» → папка снова у передающего + ему уведомление', r.notGot.ok && r.after.join() === 'out,asanov' && r.noteSender.some(t => has(t, 'не получал')), r);
  ck('«Отменить передачу» → папка у передающего', r.cancel.ok && r.after2.join() === 'out,asanov', r.after2);
  ck('и «не получал», и отмена — в истории', r.ev === 2, r.ev);
});

await group('П-8 · Принять возврат: на постоянное место; очередь → бронь первому; подсказка; примечание; поле «Возврат»', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.nonArch = A.acceptReturn('f203', {}, 'kadyrov');
    o.archive = A.acceptReturn('f211', {});
    o.hint = A.returnHint('f203').text;
    o.r = A.acceptReturn('f203', {}); o.st = A.stateOf('f203'); o.shelf = A.folder('f203').shelf;
    o.lk = A.returnLookup('А-000205 0205 205 9999 abc').map(x => [x.input, x.ok, x.why || '']);
    o.hold = A.acceptReturn('f205', {}); o.held = A.reservedReq('f205').who;
    o.extClosed = A.EXTS.find(x => x.folder === 'f205').st;
    o.tr = A.acceptReturn('f201', {}); o.trSt = A.openIssue('f201') ? 'open' : A.ISSUES.filter(i => i.folder === 'f201').pop().transfers.map(t => t.st).join();
    return o; });
  ck('не архивариус — нельзя', !r.nonArch.ok, r.nonArch);
  ck('папка в архиве — «возвращать нечего»', !r.archive.ok && has(r.archive.why, 'возвращать нечего'), r.archive);
  ck('подсказка «на полку: Архив ГО · шкаф 1 · полка 1»; встала на постоянное место', r.hint === 'на полку: Архив ГО · шкаф 1 · полка 1' && r.st === 'archive' && r.shelf === 'go1-1', r);
  ck('поле «Возврат»: номер находится с буквой, с нулями и без; повтор схлопывается; неизвестный — с причиной', r.lk.length === 3 && r.lk[0][1] && r.lk[1][2] === 'папка не найдена' && r.lk[2][2] === 'не номер папки', r.lk);
  ck('есть очередь — бронь первому', r.hold.ok && r.held === 'asanov', r);
  ck('просьба продлить у вернувшейся папки закрыта', r.extClosed === 'closed', r.extClosed);
  ck('возврат при незавершённой передаче — передача отменена', r.tr.ok && r.trSt === 'cancelled', r.trSt);
});

await group('П-9 · Просрочка: напоминание за N р.д.; задание держателю; подъём; закрывается возвратом, передачей, продлением, списанием', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.i = A.issue('f211', { to: 'jeen', why: 'х', due: '2026-11-19' }, 'arch1');
    o.n0 = A.NOTES.filter(n => n.folder === 'f211' && n.kind === 'remind').length;
    A.setToday('2026-11-17'); o.n1 = A.NOTES.filter(n => n.folder === 'f211' && n.kind === 'remind').map(n => n.d);
    A.setToday('2026-11-19'); o.t0 = A.tasks().some(t => t.folder === 'f211');
    A.setToday('2026-11-20'); o.t1 = A.tasks().find(t => t.folder === 'f211');
    A.setToday('2026-11-25'); o.t2 = A.tasks().find(t => t.folder === 'f211');
    o.byExt = (A.extend('f211', { date: '2026-12-10', reason: 'х' }), !A.tasks().some(t => t.folder === 'f211'));
    o.byRet = (A.acceptReturn('f230', {}), !A.tasks().some(t => t.folder === 'f230'));
    A.transfer('f203', { to: 'isaeva' }, 'kadyrov'); A.received('f203', 'isaeva'); o.byTr = A.tasks().filter(t => t.folder === 'f203').map(t => t.holder);
    o.byWo = (A.writeOff('f208', { reason: 'утрачена', basis: 'акт' }), !A.tasks().some(t => t.folder === 'f208'));
    return o; });
  ck('при выдаче за 4 р.д. до срока напоминания нет', r.n0 === 0, r.n0);
  ck('напоминание — за 2 р.д. (17.11 при сроке 19.11)', r.n1.join() === '2026-11-17', r.n1);
  ck('в день срока задания нет; на следующий — держателю', !r.t0 && r.t1 && r.t1.holder === 'jeen' && !r.t1.up, r);
  ck('не исполнено — поднято к руководителю держателя', r.t2 && r.t2.up && r.t2.head === 'osmonov', r.t2);
  ck('закрывается продлением, возвратом, передачей (у нового держателя — своё), списанием', r.byExt && r.byRet && r.byTr.join() === 'isaeva' && r.byWo, r);
});

await group('П-10 · Переместить: кроме «выбыла»; полка действующая; пачкой — на одну полку', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.gone = A.move('f209', 'go1-1'); o.ret = A.move('f211', 'go2-5'); o.same = A.move('f211', 'go2-1');
    o.out = A.move('f230', 'go1-2'); o.hint = A.returnHint('f230').text;
    o.b = A.moveBatch(['f211', 'f212', 'f209'], 'go3-5'); o.shelves = ['f211', 'f212'].map(id => A.folder(id).shelf);
    o.nonArch = A.move('f213', 'go3-5', 'jeen');
    return o; });
  ck('выбывшую — нельзя; на выведенную полку — нельзя; на ту же — нельзя', !r.gone.ok && !r.ret.ok && !r.same.ok, [r.gone, r.ret, r.same]);
  ck('папка на руках — меняется полка, куда она вернётся', r.out.ok && r.hint === 'на полку: Архив ГО · шкаф 1 · полка 2', r);
  ck('пачкой — все на одну полку, выбывшая с причиной', r.b.done.length === 2 && r.b.skipped.length === 1 && r.shelves.join() === 'go3-5,go3-5', r.b);
  ck('не архивариус — нельзя', !r.nonArch.ok);
});

await group('П-11 · Изменить привязку: архивариус, основание обязательно, название пересобирается', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.nonArch = A.rebind('f218', { borrower: 'n3', basis: 'х' }, 'asanov');
    o.noBasis = A.rebind('f218', { borrower: 'n3', basis: '' });
    o.nom = A.rebind('f211', { borrower: 'n3', basis: 'х' });
    o.ok = A.rebind('f218', { borrower: 'n3', basis: 'ошибка при приёме' });
    o.e = A.EVENTS.filter(e => e.folder === 'f218' && e.kind === 'rebound').map(e => [e.wasTitle, e.title, e.basis]);
    o.h = A.history('f207').some(x => x.type === 'event' && x.e.kind === 'rebound' && x.e.wasTitle === 'КЗД · ОсОО «Нур-Сервис» · том 1');
    return o; });
  ck('не архивариус — нельзя; без основания — нельзя; у вида без привязки — нельзя', !r.nonArch.ok && !r.noBasis.ok && r.noBasis.field === 'basis' && !r.nom.ok, [r.nonArch, r.noBasis, r.nom]);
  ck('название пересобрано; было и стало — в истории', r.ok.ok && r.e[0][0] === 'КЗД · Абдылдаев Н. · том 1' && r.e[0][1] === 'КЗД · ОсОО «Ала-Тоо Сут» · том 1', r.e);
  ck('демо: смена привязки «Нур-Сервис» → «Жумабаев» в истории', r.h);
});

await group('П-12 · Списать: причина и основание; закрывает выдачу, бронь, задание, очередь; «Восстановить» — только утраченную', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.noReason = A.writeOff('f206', { reason: '', basis: 'х' }); o.noBasis = A.writeOff('f206', { reason: 'уничтожена', basis: '' });
    o.res = A.writeOff('f206', { reason: 'передана другой организации', basis: 'Акт передачи № 2 от 13.11.2026' });
    o.q = A.REQS.filter(x => x.folder === 'f206').map(x => x.st);
    o.out = A.writeOff('f205', { reason: 'передана в госархив', basis: 'Акт № 7' });
    o.iss = A.ISSUES.filter(i => i.folder === 'f205').pop(); o.issEnd = [o.iss.end, o.iss.closedBy];
    o.ext = A.EXTS.find(x => x.folder === 'f205').st;
    o.again = A.writeOff('f205', { reason: 'утрачена', basis: 'х' });
    o.rDestroyed = A.restore('f215', { basis: 'х' }); o.rNoBasis = A.restore('f209', { basis: '' }); o.rOk = A.restore('f209', { basis: 'нашлась' });
    o.h = A.history('f205').filter(x => x.type === 'issue')[0].result;
    return o; });
  ck('причина и основание обязательны', !r.noReason.ok && r.noReason.field === 'reason' && !r.noBasis.ok && r.noBasis.field === 'basis', [r.noReason, r.noBasis]);
  ck('у забронированной: бронь и очередь — «закрыт: папка выбыла»', r.res.ok && r.q.every(s => s === 'closedGone'), r.q);
  ck('у папки на руках: выдача закрыта списанием; просьба продлить закрыта', r.out.ok && r.issEnd[0] === '2026-11-13' && r.issEnd[1] === 'writeoff' && r.ext === 'closed', r);
  ck('итог выдачи — «списана: передана в госархив»', has(r.h, 'списана: передана в госархив'), r.h);
  ck('повторно списать — нельзя', !r.again.ok);
  ck('«Восстановить» уничтоженную — нельзя; утраченную — с основанием', !r.rDestroyed.ok && !r.rNoBasis.ok && r.rOk.ok, [r.rDestroyed, r.rNoBasis, r.rOk]);
});

await group('П-13 · Справочники: на что ссылается папка — не удаляется, только выводится', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.shelf = A.deletePlace('shelf', 'go1-4');
    const hs = A.addPlace('shelf', 'go3', 'полка 7'), hf = A.accept({ kind: 'nom', title: 'Проверка ссылки', dept: 'ДРР', shelf: hs.id }); A.move(hf.id, 'go3-1');
    o.hist = A.placeRefs('shelf', hs.id); o.histDel = A.deletePlace('shelf', hs.id); o.histNow = A.FOLDERS.filter(f => f.shelf === hs.id).length;
    o.cab = A.deletePlace('cab', 'go1'); o.room = A.deletePlace('room', 'dpo');
    o.free = A.deletePlace('shelf', 'go2-5');
    o.newS = A.addPlace('shelf', 'go3', 'полка 6'); o.delNew = A.deletePlace('shelf', o.newS.id);
    o.retire = A.retirePlace('shelf', 'go3-3'); o.acc = A.accept({ kind: 'nom', title: 'х', shelf: 'go3-3' }); o.mv = A.move('f211', 'go3-3');
    o.kind = A.deleteKind('cards'); o.newK = A.addKind({ name: 'Акты ревизии', bind: 'no' }); o.delK = A.deleteKind(o.newK.id);
    o.retK = A.retireKind('nom'); o.accK = A.accept({ kind: 'nom', title: 'х', shelf: 'go3-2' });
    o.cabRetired = (A.retirePlace('cab', 'dpo1'), A.shelfActive('dpo1-3'));
    o.nonArch = A.retirePlace('shelf', 'go3-2', 'jeen');
    return o; });
  ck('полку с папками удалить нельзя — только вывести', !r.shelf.ok && has(r.shelf.why, 'только вывести из употребления'), r.shelf);
  ck('ссылка только через историю (папка переехала, полка пуста) тоже держит полку', r.histNow === 0 && r.hist >= 1 && !r.histDel.ok, r);
  ck('шкаф и помещение с папками — тоже нельзя', !r.cab.ok && !r.room.ok);
  ck('пустую полку удалить можно', r.free.ok && r.newS.ok && r.delNew.ok, [r.free, r.delNew]);
  ck('выведенная полка не принимает и не перемещает', r.retire.ok && !r.acc.ok && !r.mv.ok, [r.acc, r.mv]);
  ck('вид с папками удалить нельзя; пустой — можно', !r.kind.ok && r.delK.ok, [r.kind, r.delK]);
  ck('выведенный вид в приёме не принимается', r.retK.ok && !r.accK.ok, r.accK);
  ck('выведенный шкаф выводит и свои полки', r.cabRetired === false);
  ck('не архивариус — нельзя', !r.nonArch.ok);
});

await group('П-14 · Приём без заёмщика → «Ждут привязки»; «Кто сдал» необязательно, указан — уведомление', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.a = A.accept({ kind: 'kzd', borrower: '_none', uname: 'ОсОО «Ак-Тилек»', uinn: '01507200810044', shelf: 'go3-1' });
    o.inBind = A.archQueue().bind.some(x => x.f.id === o.a.id);
    o.noFromNotes = A.NOTES.filter(n => n.folder === o.a.id).length;
    o.b = A.accept({ kind: 'kzd', borrower: 'n3', shelf: 'go3-1', from: 'abdyk' });
    o.note = A.NOTES.filter(n => n.folder === o.b.id && n.to === 'abdyk' && n.kind === 'accepted').length;
    o.firedFrom = A.accept({ kind: 'kzd', borrower: 'n2', shelf: 'go3-1', from: 'orozov' });
    o.vz = A.accept({ kind: 'vz', borrower: 'n2', shelf: 'dpo1-3' }); o.n2 = A.noKzd({}, 'arch1').some(x => x.b.id === 'n2');
    return o; });
  ck('КЗД без привязки — в «Ждут привязки»; без сдавшего — без уведомления', r.a.ok && r.inBind && r.noFromNotes === 0, r);
  ck('сдавший указан — ему «Папка принята в архив»', r.b.ok && r.note === 1, r);
  ck('сдавший — только действующий сотрудник', !r.firedFrom.ok && r.firedFrom.field === 'from', r.firedFrom);
  ck('«Дело взыскания» не закрывает «без КЗД»', r.vz.ok && r.n2, r);
});

await group('П-15 · Права по канону §7: запрет — в движке, не только скрытая кнопка', async (page, E) => {
  const r = await E(() => { const A = window.AX, u = 'asanov', ext = A.EXTS.find(x => x.st === 'pending').id, rid = A.reservedReq('f206').id;
    const calls = {
      'принять': () => A.accept({ kind: 'nom', title: 'х', shelf: 'go3-3' }, u), 'выдать': () => A.issue('f211', { to: u, why: 'х', due: '2026-11-30' }, u),
      'отказать': () => A.refuse(rid, 'х', u), 'продлить': () => A.extend('f216', { date: '2026-12-30', reason: 'х' }, u), 'решить просьбу': () => A.decideExtend(ext, { grant: true }, u),
      'принять возврат': () => A.acceptReturn('f203', {}, u), 'переместить': () => A.move('f211', 'go3-3', u), 'изменить привязку': () => A.rebind('f217', { borrower: 'n5', basis: 'х' }, u),
      'списать': () => A.writeOff('f211', { reason: 'утрачена', basis: 'х' }, u), 'восстановить': () => A.restore('f209', { basis: 'х' }, u),
      'настройки': () => A.setSetting('issueDays', 5, u), 'справочник мест': () => A.addPlace('room', null, 'Архив ДРР', u), 'справочник видов': () => A.addKind({ name: 'х', bind: 'no' }, u),
      'выдать пачкой': () => A.issueBatch(['f211'], { to: 'jeen', why: 'х', due: '2026-11-30' }, u), 'списать пачкой': () => A.writeOffBatch(['f211'], { reason: 'утрачена', basis: 'х' }, u),
      'переместить пачкой': () => A.moveBatch(['f211'], 'go3-3', u), 'возврат пачкой': () => A.acceptReturnBatch(['f203'], {}, u) };
    const out = {}, whys = {}; Object.entries(calls).forEach(([k, f]) => { const r = f(); out[k] = r.ok; whys[k] = r.why || (r.skipped && r.skipped[0] && r.skipped[0].why) || ''; });
    const any = { 'запросить': A.request('f211', { why: 'х' }, 'sydykova').ok, 'отозвать чужой': A.withdraw(A.activeReqs('f211')[0].id, 'jeen').ok, 'отозвать свой': A.withdraw(A.activeReqs('f211')[0].id, 'sydykova').ok };
    A.setUser('jeen'); A.openCard('f211'); const ui = { arch: !!document.querySelector('[data-testid=cb-issue]'), more: !!document.querySelector('[data-testid=cb-more]') };
    A.setUser('jeen'); A.go('dicts'); const dicts = { view: A.S.view, nav: !!document.querySelector('[data-testid=nav-dicts]') };
    return { out, whys, any, ui, dicts, store: A.FOLDERS.length }; });
  const allowed = Object.entries(r.out).filter(([, ok]) => ok).map(([k]) => k);
  ck('все действия архивариуса (17) отклонены движком для куратора', allowed.length === 0, allowed);
  const notByRight = Object.entries(r.whys).filter(([, w]) => !has(w, 'архивариус')).map(([k, w]) => k + ': ' + w);
  ck('каждый отказ — по праву («…архивариус»), а не по состоянию папки', notByRight.length === 0, notByRight);
  ck('запросить и отозвать свой — любой; чужой отозвать нельзя', r.any['запросить'] && !r.any['отозвать чужой'] && r.any['отозвать свой'], r.any);
  ck('у сотрудника кнопок архивариуса в карточке нет', !r.ui.arch && !r.ui.more, r.ui);
  ck('справочники не архивариусу — нет в меню, переход возвращает в «Мои папки»', r.dicts.view === 'mine' && !r.dicts.nav, r.dicts);
});

await group('П-16 · Настройки: меняет только архивариус; новое значение — на новые выдачи и брони', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    o.bad = A.setSetting('issueDays', 0); o.badStr = A.setSetting('holdDays', 'два');
    o.oldDue = A.openIssue('f225').due; o.oldUntil = A.reservedReq('f206').until;
    o.s1 = A.setSetting('issueDays', 5); o.s2 = A.setSetting('holdDays', 3);
    o.defDue = A.dueDefault('f211', 'jeen');
    o.q = A.request('f212', { why: 'х' }, 'jeen'); o.until = o.q.until;
    o.keep = [A.openIssue('f225').due, A.reservedReq('f206').until];
    o.hist = A.SETTINGS.issueDays.hist.map(h => [h.v, h.by, h.d]);
    A.go('dicts'); A.setTab('settings'); o.row = document.querySelector('[data-testid=set-issueDays]').innerText;
    return o; });
  ck('неверное значение — ошибка', !r.bad.ok && !r.badStr.ok);
  ck('новый срок выдачи по умолчанию — 5 р.д. (20.11)', r.s1.ok && r.defDue === '2026-11-20', r.defDue);
  ck('новая бронь — 3 р.д. (до 18.11)', r.s2.ok && r.until === '2026-11-18', r.until);
  ck('уже назначенные срок и бронь не сдвинулись', r.keep[0] === r.oldDue && r.keep[1] === r.oldUntil, r);
  ck('видно, кто и когда изменил', r.hist.length === 2 && r.hist[1].join() === '5,arch1,2026-11-13' && has(r.row, 'Токтосунова Г., 13.11.2026') && has(r.row, 'было: 10'), r);
  await shot(page, '07-dicts-settings');
  await E(() => window.AX.setTab('places'));
  await shot(page, '07-dicts-places');
});

await group('П-17 · Ярлык: номер и название, без места; лист — по отмеченным', async (page, E) => {
  const r = await E(() => { const A = window.AX; return A.labelSheet(['f205', 'f213', 'f209']); });
  ck('ярлык — только номер и название', r.length === 2 && r.every(l => Object.keys(l).join() === 'no,title'), r);
  ck('выбывшей ярлык не нужен', !r.some(l => l.no === 'А-000209'));
  await E(() => { window.AX.go('folders'); });
  await page.click('[data-testid=sel-205]'); await page.click('[data-testid=sel-213]');
  await page.click('[data-testid=b-labels]');
  const s = await E(() => ({ n: document.querySelectorAll('[data-testid=labels] .label').length, txt: document.querySelector('[data-testid=labels]').innerText }));
  ck('лист ярлыков по двум отмеченным, без места', s.n === 2 && !has(s.txt, 'ДПО · 1') && !has(s.txt, 'полка'), s);
});

/* ============================ инварианты ============================ */

await group('П-18 · края: просьба продлить при передаче; передача при возврате и списании; бронь снята, отозвана; напоминание; новый том', async (page, E) => {
  const a = await E(() => { const A = window.AX, o = {};
    o.t = A.transfer('f205', { to: 'asanov' }, 'jeen'); o.g = A.received('f205', 'asanov');
    o.x = A.EXTS.find(x => x.folder === 'f205').st; o.due = A.openIssue('f205').due;
    o.note = A.NOTES.filter(n => n.to === 'jeen' && n.kind === 'ext' && n.folder === 'f205').map(n => n.text);
    o.gExt = A.gate('extend', 'f205', 'arch1'); o.ask = A.askExtend('f205', { date: '2026-11-30', reason: 'нужна до решения суда' }, 'asanov');
    o.h = A.history('f205').find(x => x.type === 'issue').events.map(e => e.kind);
    return o; });
  ck('«Получил» закрывает просьбу продлить прежнего держателя; срок прежний', a.t.ok && a.g.ok && a.x === 'closed' && a.due === '2026-11-16', a);
  ck('прежнему держателю — «Решение по продлению: просьба закрыта — папка передана Асанову Б.»', a.note.some(t => has(t, 'просьба закрыта — папка передана Асанову Б.')), a.note);
  ck('новый держатель просит сам; «Продлить» напрямую снова доступно до его просьбы', a.gExt.ok && a.ask.ok, [a.gExt, a.ask]);
  ck('закрытие просьбы — в событиях выдачи', a.h.includes('extClosed'), a.h);
  const b = await E(() => { const A = window.AX, o = {};
    o.r = A.acceptReturn('f201', {}, 'arch1');
    o.ev = A.EVENTS.filter(e => e.folder === 'f201' && e.kind === 'transferCancel').map(e => e.why);
    o.note = A.NOTES.filter(n => n.to === 'mambetov' && n.kind === 'transfer' && n.folder === 'f201').map(n => n.text);
    o.inc = A.mine('mambetov').incoming.map(x => x.f.id);
    A.transfer('f203', { to: 'isaeva' }, 'kadyrov'); A.writeOff('f203', { reason: 'утрачена', basis: 'Акт № 16' }, 'arch1');
    o.wo = A.NOTES.filter(n => n.to === 'isaeva' && n.kind === 'transfer' && n.folder === 'f203').map(n => n.text);
    A.transfer('f214', { to: 'sydykova' }, 'jeen'); A.cancelTransfer('f214', 'jeen');
    o.cancel = A.NOTES.filter(n => n.to === 'sydykova' && n.kind === 'transfer' && n.folder === 'f214').map(n => n.text);
    return o; });
  ck('возврат во время передачи: передача закрыта событием «отменена: папку вернули в архив»', b.r.ok && b.ev.join() === 'папку вернули в архив', b);
  ck('получателю — «Передача папки … отменена», из «Вам передают» папка ушла', b.note.some(t => has(t, 'отменена: папку вернули в архив')) && !b.inc.includes('f201'), b);
  ck('списание во время передачи и «Отменить передачу» — получателю тоже уведомление', b.wo.some(t => has(t, 'отменена: папка выбыла')) && b.cancel.some(t => has(t, 'отменена')), [b.wo, b.cancel]);
  const c = await E(() => { const A = window.AX, o = {};
    A.uiUnreserve('f206'); o.title = A.S.form.title; o.empty = A.submitForm('main', {}); o.s = A.submitForm('main', { reason: 'дело уходит на проверку' });
    o.isa = A.REQS.filter(r => r.folder === 'f206' && r.who === 'isaeva').map(r => r.st); o.next = A.reservedReq('f206') && A.reservedReq('f206').who;
    o.w = A.withdraw(A.reservedReq('f206').id, 'kadyrov'); o.after = A.stateOf('f206');
    A.request('f204', { why: 'а' }, 'jeen'); A.request('f204', { why: 'б' }, 'abdyk');
    o.w2 = A.withdraw(A.reservedReq('f204').id, 'jeen'); o.next2 = A.reservedReq('f204') && A.reservedReq('f204').who;
    return o; });
  ck('«Снять бронь» — отказ с обязательной причиной; бронь — следующему', c.title === 'Снять бронь · А-000206' && !c.empty.ok && c.s.ok && c.isa.join() === 'refused' && c.next === 'kadyrov', c);
  ck('отозвал бронь последний — папка свободна; при очереди — бронь следующему', c.w.ok && c.after === 'archive' && c.w2.ok && c.next2 === 'abdyk', c);
  const d = await E(() => { const A = window.AX, o = {};
    A.issue('f211', { to: 'jeen', why: 'х', due: '2026-11-24' }, 'arch1');
    A.setSetting('remindDays', 10, 'arch1');
    A.issue('f212', { to: 'jeen', why: 'х', due: '2026-12-11' }, 'arch1');
    const rem = id => A.NOTES.filter(n => n.folder === id && n.kind === 'remind').map(n => n.d);
    o.at13 = [rem('f211'), rem('f212')];
    A.setToday('2026-11-19'); o.at19 = [rem('f211'), rem('f212')];
    A.setToday('2026-11-23'); o.at23 = [rem('f211'), rem('f212')];
    A.setToday('2026-11-27'); o.at27 = [rem('f211'), rem('f212')];
    o.weekend = A.NOTES.filter(n => n.kind === 'remind' && !A.isWork(n.d)).map(n => n.d);
    return o; });
  ck('новое значение напоминания не трогает выданную раньше: f211 — 20.11 (2 р.д.), не сразу', d.at13[0].length === 0 && d.at19[0].length === 0 && d.at23[0].join() === '2026-11-20', d);
  ck('выданная после смены — за 10 р.д. (27.11 при сроке 11.12)', d.at23[1].length === 0 && d.at27[1].join() === '2026-11-27', d);
  ck('напоминание не приходит в выходной', d.weekend.length === 0, d.weekend);
  const e = await E(() => { const A = window.AX, o = {};
    o.past = A.extend('f230', { date: '2026-11-12', reason: 'х' }, 'arch1');
    A.retireKind('vz', 'arch1'); o.nv = A.gate('nextVol', 'f205', 'arch1');
    A.openCard('f205'); document.querySelector('[data-testid=cb-more]').click(); const mi = document.querySelector('[data-testid=mi-nextVol]'); o.mi = { dis: mi.disabled, why: mi.innerText };
    return o; });
  ck('продлить на дату в прошлом — нельзя', !e.past.ok && e.past.field === 'date' && has(e.past.why, 'позже сегодняшнего'), e.past);
  ck('«Принять следующий том» у выведенного вида — серая с причиной', !e.nv.ok && e.mi.dis && has(e.mi.why, 'выведен из употребления'), e);
});

await group('Н-1 · демо-набор собран действиями движка и покрывает план §5', async (page, E) => {
  const r = await E(() => { const A = window.AX, st = {}; A.FOLDERS.forEach(f => { const s = A.stateOf(f.id); st[s] = (st[s] || 0) + 1; });
    const nos = A.FOLDERS.map(f => f.no);
    return { st, n: A.FOLDERS.length, today: A.S.today, seq: nos.every((x, i) => x === 201 + i),
      rooms: A.ROOMS.length, cabs: A.CABS.length, shelves: A.SHELVES.length, retShelf: A.SHELVES.filter(s => s.retired).length,
      over: A.FOLDERS.filter(f => A.isOver(f.id)).length, up: A.tasks().filter(t => t.up).length, fired: A.archQueue().fired.length,
      transfer: st.transfer, cancelled: A.ISSUES.some(i => i.transfers.some(t => t.st === 'cancelled')), q2: A.FOLDERS.some(f => A.activeReqs(f.id).length >= 2 && A.stateOf(f.id) === 'out'),
      ext: A.EXTS.filter(x => x.st === 'pending').length, refused: A.REQS.some(r => r.st === 'refused'), notTaken: A.REQS.some(r => r.st === 'notTaken'),
      lost: A.FOLDERS.filter(f => f.gone && f.gone.reason === 'утрачена').length, destroyed: A.FOLDERS.filter(f => f.gone && f.gone.reason === 'уничтожена').length,
      restored: A.EVENTS.filter(e => e.kind === 'restored').length, rebound: A.EVENTS.filter(e => e.kind === 'rebound').length, unlinked: A.FOLDERS.filter(f => f.unlinked).length,
      prot: A.FOLDERS.filter(f => f.title === 'Протоколы правления · 2025').map(f => f.dept).sort().join(), note: A.ISSUES.some(i => i.ret && i.ret.note), vz: A.FOLDERS.some(f => f.kind === 'vz'),
      twoVol: A.FOLDERS.some(f => f.borrower && (f.vol || 1) === 2), nokzd: A.noKzd({ closed: true }, 'arch1').length, closed: A.noKzd({ closed: true }, 'arch1').filter(x => x.closed).length,
      days: new Set(A.noKzd({}, 'arch1').map(x => x.days)).size, retKind: A.KINDS.filter(k => k.retired).length, accepted: A.EVENTS.filter(e => e.kind === 'accepted').length,
      moved: A.EVENTS.filter(e => e.kind === 'moved').length, notes: new Set(A.NOTES.map(n => n.kind)).size }; });
  ck('сегодня — заморожено 13.11.2026', r.today === '2026-11-13');
  ck('30 папок, номера сквозные 201…230, каждая — событием «принята»', r.n === 30 && r.seq && r.accepted === 30, r);
  ck('2 помещения, 4 шкафа, 20 полок, одна выведенная', r.rooms === 2 && r.cabs === 4 && r.shelves === 20 && r.retShelf === 1, r);
  ck('все пять состояний: в архиве · забронирована · на руках · передаётся · выбыла', ['archive', 'reserved', 'out', 'transfer', 'gone'].every(s => r.st[s] > 0), r.st);
  ck('просрочка с заданием, поднятым к руководителю; держатель уволен', r.over === 2 && r.up === 2 && r.fired === 1, r);
  ck('передаётся; отменённая передача в истории; очередь из двух; просьба продлить на решении', r.transfer === 1 && r.cancelled && r.q2 && r.ext === 1, r);
  ck('отказ в запросе; «не забран»', r.refused && r.notTaken);
  ck('выбывшие: утрачена и уничтожена; восстановленная; смена привязки', r.lost === 1 && r.destroyed === 1 && r.restored === 1 && r.rebound === 1, r);
  ck('КЗД без привязки (2); две «Протоколы правления · 2025» разных подразделений', r.unlinked === 2 && r.prot === 'Бухгалтерия,ДПО', r);
  ck('возврат с примечанием; «Дело взыскания»; двухтомное дело; выведенный вид; перемещение', r.note && r.vz && r.twoVol && r.retKind === 1 && r.moved === 1, r);
  ck('«Заёмщики без КЗД»: разные дни, есть закрытый', r.nokzd >= 4 && r.closed >= 1 && r.days >= 4, r);
  ck('уведомления всех семи видов уже случились в демо-наборе', r.notes === 7, r.notes);
});

await group('Н-2 · инварианты после 400 случайных действий движка', async (page, E) => {
  const r = await E(() => { const A = window.AX; let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const pick = a => a[rnd(a.length)], emps = A.EMP.filter(e => !A.isFired(e.id)).map(e => e.id), shelves = A.SHELVES.map(s => s.id);
    const bad = [], tally = { ok: 0, no: 0 };
    for (let k = 0; k < 400; k++) {
      const f = pick(A.FOLDERS).id, u = pick(emps), i = A.openIssue(f), q = A.activeReqs(f);
      const acts = [
        () => A.request(f, { why: 'случайно' }, u), () => A.issue(f, { to: q[0] ? q[0].who : u, why: 'случайно', due: A.addWork(A.S.today, 1 + rnd(8)) }, 'arch1'),
        () => i ? A.acceptReturn(f, {}, 'arch2') : A.move(f, pick(shelves), 'arch1'), () => i ? A.transfer(f, { to: u }, i.holder) : A.writeOff(f, { reason: pick(A.GONE_REASONS), basis: 'акт' }, 'arch1'),
        () => i && A.pendingTr(i) ? (rnd(2) ? A.received(f, A.pendingTr(i).to) : A.notReceived(f, A.pendingTr(i).to)) : A.restore(f, { basis: 'нашлась' }, 'arch1'),
        () => q.length ? (rnd(2) ? A.refuse(q[rnd(q.length)].id, 'нет', 'arch1') : A.withdraw(q[0].id, q[0].who)) : A.askExtend(f, { date: '2027-01-15', reason: 'х' }, i ? i.holder : u),
        () => { const x = A.EXTS.find(e => e.st === 'pending'); return x ? A.decideExtend(x.id, { grant: !!rnd(2), reason: 'нет' }, 'arch1') : A.extend(f, { date: '2027-02-01', reason: 'х' }, 'arch1'); },
        () => rnd(5) ? A.cancelTransfer(f, i ? i.holder : u) : A.setToday(A.addWork(A.S.today, 1)),
      ];
      const res = pick(acts)(); res && res.ok ? tally.ok++ : tally.no++;
      const inv = A.invariants(); if (inv.length) { bad.push([k, inv]); break; }
    }
    return { bad, tally, today: A.S.today }; });
  ck('после каждого из 400 действий инварианты целы', r.bad.length === 0, r.bad);
  ck('случайный проход реально двигал модель (есть и успехи, и запреты)', r.tally.ok > 50 && r.tally.no > 20, r.tally);
});

await group('Н-3 · «Мои папки»: три блока по срочности, пустые скрыты; журнал движения', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    A.setUser('asanov'); o.asanov = [...document.querySelectorAll('.section-h[data-testid^=blk]')].map(b => b.dataset.testid);
    A.setUser('mambetov'); o.mambetov = [...document.querySelectorAll('.section-h[data-testid^=blk]')].map(b => b.dataset.testid);
    A.setUser('jeen'); o.jeen = [...document.querySelectorAll('.section-h[data-testid^=blk]')].map(b => b.dataset.testid);
    A.transfer('f227', { to: 'kadyrov' }, 'jeen'); A.received('f227', 'kadyrov');
    A.setUser('arch1'); A.go('journal'); o.kinds = [...new Set([...document.querySelectorAll('[data-testid=tbl-journal] tbody tr')].map(t => t.children[1].textContent))].sort(); const jr = [...document.querySelectorAll('[data-testid=tbl-journal] tbody tr')].map(t => t.children[0].textContent); o.first = jr[0]; o.last = jr[jr.length - 1].split('.').reverse().join('-');
    o.all = new Set(A.journal({}).map(e => e.kind)).size;
    A.setJ('kind', 'returned'); o.ret = [...document.querySelectorAll('[data-testid=tbl-journal] tbody tr')].length;
    A.setJ('kind', ''); A.setJ('emp', 'orozov'); o.oroz = A.journal({ emp: 'orozov', from: '2026-09-01' }).map(e => e.kind);
    A.setJ('emp', ''); A.setJ('from', '01.09.2026'); o.fromSept = [...document.querySelectorAll('[data-testid=tbl-journal] tbody tr')].length;
    return o; });
  ck('куратор: «На руках у меня» → «Мои запросы»; «Вам передают» пуст — скрыт', r.asanov.join() === 'blk-hands,blk-req', r.asanov);
  ck('заведующий: «Вам передают» → «На руках у меня»', r.mambetov.join() === 'blk-incoming,blk-hands', r.mambetov);
  ck('юрист: только «На руках у меня»', r.jeen.join() === 'blk-hands', r.jeen);
  ck('журнал по умолчанию — за 30 дней (с 14.10): возвраты, выдачи, сегодняшняя передача, списание', r.kinds.join() === 'возвращена,выдана,передана,списана' && r.first === '13.11.2026' && r.last >= '14.10.2026'.split('.').reverse().join('-'), r);
  ck('за всё время — все восемь видов событий движения', r.all === 8, r.all);
  ck('отбор по событию и сотруднику', r.ret === 2 && r.oroz.join() === 'issued', r);
  ck('период меняется', r.fromSept > 40, r.fromSept);
  await shot(page, '06-journal');
});

/* ============ рамка и «Очередь архивариуса» — автогриллинг страницы (АХ-71…АХ-81) ============ */

const toasts = E => E(() => [...document.querySelectorAll('[data-testid=toast]')].map(t => ({ text: t.textContent, btn: (t.querySelector('button') || {}).textContent || '' })));

await group('Р-1 · рамка: демо-стенд одной полосой в шапке; счётчики красные только при своей просрочке; поиск и «Принять папку» в рамку не вынесены (АХ-71, АХ-72, АХ-73)', async (page, E) => {
  const st = await E(() => { const s = document.querySelector('[data-testid=stand]'), foot = document.querySelector('.sidebar-foot');
    return { inTop: !!s.closest('.topbar'), today: s.querySelector('[data-testid=stand-today]').textContent, user: !!s.querySelector('[data-testid=user]'), link: !!s.querySelector('[data-testid=demo-paperbox]'),
      foot: foot.innerText.replace(/\s+/g, ' ').trim(), footDemo: !!foot.querySelector('.demo-tag') }; });
  ck('АХ-71 · в шапке одна полоса стенда: сегодня 13.11.2026 · пользователь · образец врезки', st.inTop && st.today === '13.11.2026' && st.user && st.link, st);
  ck('АХ-71 · низ меню — только кто вошёл: имя, роль · подразделение', !st.footDemo && st.foot === 'Токтосунова Г. архивариус · Общий отдел', st.foot);
  await page.click('[data-testid=demo-paperbox]');
  ck('АХ-71 · ссылка стенда открывает образец врезки «Где бумага»', await E(() => window.AX.S.view === 'borrower'));
  const cnt = await E(() => { const A = window.AX, out = {}, c = v => { const e = document.querySelector(`[data-testid=cnt-${v}]`); return e ? e.textContent + (e.classList.contains('hot') ? '!' : '') : null; };
    A.setUser('arch1'); out.arch = c('queue'); A.setUser('asanov'); out.asanov = c('mine'); A.setUser('mambetov'); out.mambetov = c('mine'); A.setUser('isaeva'); out.isaeva = c('mine');
    A.acceptReturn('f230', {}, 'arch1'); A.setUser('asanov'); out.asanovAfter = c('mine');
    A.setToday('2026-11-18'); A.setUser('isaeva'); out.isaevaLate = c('mine'); out.isaevaOver = A.mine('isaeva').hands.filter(x => x.over).map(x => x.f.no).join();
    out.today = document.querySelector('[data-testid=stand-today]').textContent; return out; });
  ck('АХ-72 · счётчик очереди «5» — серый (рабочий список, не тревога)', cnt.arch === '5', cnt.arch);
  ck('АХ-72 · «Мои папки»: у Асанова «1» красный — своя просрочка; у Мамбетова («вам передают») и Исаевой (бронь) «1» серый',
    cnt.asanov === '1!' && cnt.mambetov === '1' && cnt.isaeva === '1', cnt);
  ck('АХ-72 · просрочка вернулась в архив — счётчик Асанова гаснет', cnt.asanovAfter === '', cnt.asanovAfter);
  ck('АХ-72 · 18.11: бронь Исаевой истекла, папка А-000223 просрочена — её «1» становится красным', cnt.isaevaLate === '1!' && cnt.isaevaOver === '223', cnt);
  ck('АХ-71 · дата стенда идёт вместе с часами', cnt.today === '18.11.2026', cnt.today);
  const fr = await E(() => { window.AX.setUser('arch1');
    return { topInputs: [...document.querySelectorAll('.topbar input, .topbar select')].map(e => e.id), acceptOnQueue: !!document.querySelector('#panel [data-testid=accept]') }; });
  ck('АХ-73 · в шапке нет поля поиска (только переключатель стенда); в очереди нет «Принять папку»', fr.topInputs.join() === 'user' && !fr.acceptOnQueue, fr);
});

await group('Р-2 · поле «Возврат» с клавиатуры: курсор в поле, кнопка рядом, Enter; строки — № ссылкой, просрочка пометкой; итог под полем (АХ-74, АХ-75, АХ-76)', async (page, E) => {
  const g = await E(() => { const i = document.querySelector('[data-testid=ret-input]').getBoundingClientRect(), b = document.querySelector('[data-testid=ret-accept]').getBoundingClientRect();
    return { focus: document.activeElement && document.activeElement.dataset.testid, w: Math.round(i.width), gap: Math.round(b.left - i.right), h: document.querySelector('.retbox .ret-h').textContent }; });
  ck('АХ-74 · при входе архивариуса курсор уже в поле «Возврат»', g.focus === 'ret-input', g.focus);
  ck('АХ-74 · заголовок «Возврат»; поле под стопку (≤ 600 px), кнопка сразу за ним', g.h === 'Возврат' && g.w <= 600 && g.gap >= 0 && g.gap <= 20, g);
  await E(() => { window.AX.go('folders'); window.AX.go('queue'); });
  ck('АХ-74 · вернулся в очередь из меню — курсор снова в поле', await E(() => document.activeElement && document.activeElement.dataset.testid === 'ret-input'));
  await page.keyboard.type('230 205 211');
  const rows = await E(() => ({ th: [...document.querySelectorAll('[data-testid=ret-rows] thead th')].map(t => t.textContent).join('|'),
    over230: document.querySelector('[data-testid=ret-over-230]')?.textContent || '', over205: !!document.querySelector('[data-testid=ret-over-205]'),
    link205: !!document.querySelector('[data-testid=ret-row-205] td:first-child button.linky'), link211: !!document.querySelector('[data-testid=ret-bad] td:first-child button.linky') }));
  ck('АХ-75 · колонки: № · Название · Держатель · Куда · Примечание — без «Вернуть до»', rows.th === '№|Название|Держатель|Куда|Примечание', rows.th);
  ck('АХ-75 · просрочка — пометкой под держателем: у А-000230 «просрочена 3 р.д.», у А-000205 (в срок) — нет', rows.over230 === 'просрочена 3 р.д.' && !rows.over205, rows);
  ck('АХ-75 · № — ссылка и у строки с причиной', rows.link205 && rows.link211, rows);
  await page.click('[data-testid=ret-bad] td:first-child button.linky');
  const c211 = await E(() => ({ hash: location.hash, main: document.querySelector('#cardpanel .cp-btns .btn').textContent, text: window.AX.S.ret.text }));
  ck('АХ-75 · номер папки «в архиве» → карточка, где главная кнопка «Выдать»; набранное в поле не теряется', c211.hash === '#/folder/211' && c211.main === 'Выдать' && c211.text === '230 205 211', c211);
  await page.keyboard.press('Escape');
  await page.fill('[data-testid=ret-input]', '211');
  await page.press('[data-testid=ret-input]', 'Enter');
  const z = await E(() => ({ ev: window.AX.EVENTS.filter(e => e.kind === 'returned' && e.folder === 'f211').length, text: document.querySelector('[data-testid=ret-input]').value, focus: document.activeElement && document.activeElement.dataset.testid }));
  ck('АХ-74 · Enter без папок на руках ничего не принимает; набранное и курсор на месте', z.ev === 0 && z.text === '211' && z.focus === 'ret-input', z);
  await page.fill('[data-testid=ret-input]', '');
  await page.keyboard.type('230 A-214');
  const pre = await E(() => [...document.querySelectorAll('[data-testid^=ret-hint-]')].map(t => t.dataset.testid.slice(9) + ':' + t.textContent));
  ck('АХ-74 · латинская «A-214» находит А-000214', pre.length === 2 && pre[1].startsWith('214:'), pre);
  await page.keyboard.press('Enter');
  const after = await E(() => ({ st: ['f230', 'f214'].map(window.AX.stateOf).join(), modal: document.querySelector('#overlay').classList.contains('open'), focus: document.activeElement && document.activeElement.dataset.testid,
    text: document.querySelector('[data-testid=ret-input]').value, done: [...document.querySelectorAll('[data-testid^=ret-done-]')].map(t => t.dataset.testid.slice(9) + ':' + t.children[2].textContent),
    head: document.querySelector('[data-testid=ret-done] .ret-done-h')?.textContent || '' }));
  ck('АХ-74 · Enter = «Принять возврат (2)»: обе папки в архиве', after.st === 'archive,archive', after.st);
  ck('АХ-76 · окна итога нет; поле очищено, курсор в нём — можно набирать следующую стопку', !after.modal && after.text === '' && after.focus === 'ret-input', after);
  ck('АХ-76 · под полем «Принято только что: 2» с «куда» — те же подсказки, что до нажатия', has(after.head, 'Принято только что: 2') && after.done.join('|') === pre.join('|'), [after.done, pre]);
  await E(() => { window.AX.go('folders'); window.AX.go('queue'); });
  ck('АХ-76 · ушёл из очереди и вернулся — итога прошлой стопки нет', await E(() => !document.querySelector('[data-testid=ret-done]')));
  await page.fill('[data-testid=ret-input]', '225');
  await page.keyboard.press('Enter');
  ck('АХ-76 · итог новой стопки на месте', await E(() => [...document.querySelectorAll('[data-testid^=ret-done-]')].map(t => t.dataset.testid).join() === 'ret-done-225'));
  await page.keyboard.type('2');
  ck('АХ-76 · новый ввод убирает итог прошлой стопки', await E(() => !document.querySelector('[data-testid=ret-done]')));
});

await group('Р-3 · очередь: печать и Excel у «уволенных»; открытая папка подсвечена; ярлык после привязки; возврат пачкой из «Папок» окном (АХ-77, АХ-79, АХ-80, АХ-81)', async (page, E) => {
  const pr = await E(() => { const blk = id => document.querySelector(`[data-testid=${id}]`);
    return { fired: [...blk('blk-fired').querySelectorAll('button')].map(b => b.dataset.testid).join(), give: [...blk('blk-give').querySelectorAll('button')].map(b => b.dataset.testid).join(),
      ext: blk('blk-ext').querySelectorAll('button').length, bind: blk('blk-bind').querySelectorAll('button').length }; });
  ck('АХ-79 · «На руках у уволенных» — «Печать» и «Excel»; «К выдаче» — «Печать обхода»; у «Продлений» и «Ждут привязки» — нет', pr.fired === 'print-list,excel' && pr.give === 'print-round' && pr.ext === 0 && pr.bind === 0, pr);
  await page.click('[data-testid=blk-fired] [data-testid=excel]');
  ck('АХ-79 · Excel выгружает список уволенных — 1 строка', (await toasts(E)).some(t => t.text === '«На руках у уволенных» — выгрузка в Excel: 1 строка'), await toasts(E));
  await page.click('[data-testid=give-206] td:nth-child(3)');
  const c1 = await E(() => ({ open: document.querySelector('#cardpanel').classList.contains('open'), cur: [...document.querySelectorAll('#panel tr.cur')].map(t => t.dataset.testid) }));
  ck('АХ-81 · клик по строке «К выдаче» — панель карточки, строка подсвечена', c1.open && c1.cur.join() === 'give-206', c1);
  await page.click('[data-testid=ext-205] td:nth-child(3)');
  ck('АХ-81 · следующая строка — подсветка переходит на неё', await E(() => [...document.querySelectorAll('#panel tr.cur')].map(t => t.dataset.testid).join() === 'ext-205'));
  await page.keyboard.press('Escape');
  ck('АХ-81 · панель закрыта — подсветки нет', await E(() => !document.querySelector('#panel tr.cur')));
  await page.click('[data-testid=bind-go-217]');
  await page.fill('[data-testid=ff-basis]', 'Заёмщик заведён в системе 12.11.2026');
  await page.click('[data-testid=form-submit]');
  const t217 = (await toasts(E)).find(t => has(t.text, 'Привязка изменена'));
  ck('АХ-80 · название не изменилось (А-000217) — сообщение без «Печать ярлыка»', t217 && !has(t217.text, 'перепечатайте') && t217.btn === '', t217);
  await E(() => window.AX.uiRebind('f218'));
  await pick(page, 'borrower', 'n1');
  await page.fill('[data-testid=ff-basis]', 'Ошибка при приёме: дело ОсОО «Кен-Сай»');
  await page.click('[data-testid=form-submit]');
  const t218 = (await toasts(E)).find(t => has(t.text, 'перепечатайте ярлык'));
  ck('АХ-80 · название изменилось (А-000218) — «перепечатайте ярлык» и кнопка «Печать ярлыка»', t218 && t218.btn === 'Печать ярлыка' && has(t218.text, 'КЗД · ОсОО «Кен-Сай» · том 1'), t218);
  await page.click('[data-testid=toast] button');
  const lab = await E(() => [...document.querySelectorAll('[data-testid=labels] .label')].map(l => l.innerText.replace(/\s+/g, ' ')));
  ck('АХ-80 · кнопка печатает ярлык с новым названием', lab.length === 1 && lab[0] === 'А-000218 КЗД · ОсОО «Кен-Сай» · том 1', lab);
  await E(() => { window.AX.closeForm(); window.AX.go('folders'); });
  for (const n of [230, 205, 211]) await page.click(`[data-testid=sel-${n}]`);
  await page.click('[data-testid=b-return]');
  const w = await E(() => ({ title: document.querySelector('[data-testid=form-title]').textContent, submit: document.querySelector('[data-testid=form-submit]').textContent,
    rows: [...document.querySelectorAll('#modal [data-testid^=ret-row-]')].map(t => t.dataset.testid.slice(8)), hints: [...document.querySelectorAll('#modal [data-testid^=ret-hint-]')].map(t => t.textContent),
    bad: [...document.querySelectorAll('#modal [data-testid=ret-bad]')].map(t => t.innerText), st: window.AX.stateOf('f230') }));
  ck('АХ-77 · «Принять возврат» пачкой — окно, ничего ещё не принято', w.title === 'Принять возврат · 3 папки' && w.st === 'out', w);
  ck('АХ-77 · в окне те же строки, что в поле «Возврат»: «куда» до нажатия, не на руках — с причиной', w.rows.join() === '205,230' && w.hints.join('|') === 'отложить: бронь — Асанов Б. до 17.11|на полку: Архив ГО · шкаф 1 · полка 3' && w.bad.length === 1 && has(w.bad[0], 'в архиве — возвращать нечего'), w);
  ck('АХ-77 · кнопка «Принять возврат (2)» не считает строку с причиной', w.submit === 'Принять возврат (2)', w.submit);
  await page.click('#modal [data-testid=ret-addnote-230]');
  await page.fill('#modal [data-testid=ret-note-230]', 'без графика погашения');
  await page.click('[data-testid=form-submit]');
  const res = await E(() => { const A = window.AX; return { st: ['f230', 'f205', 'f211'].map(A.stateOf).join(), res: (A.reservedReq('f205') || {}).who, content: A.folder('f230').content,
    ev211: A.EVENTS.filter(e => e.kind === 'returned' && e.folder === 'f211').length, result: !!document.querySelector('[data-testid=batch-result]') }; });
  ck('АХ-77 · приняты 230 и 205 (бронь первому — Асанову), 211 не тронута', res.st === 'archive,reserved,archive' && res.res === 'asanov' && res.ev211 === 0, res);
  ck('АХ-77 · примечание из окна — в «Содержание»; итог пачкой показан', has(res.content, 'без графика погашения') && res.result, res);
  await shot(page, '09-batch-return');
});

/* ============ «Папки» и карточка папки — автогриллинг страницы (АХ-82…АХ-95) ============ */

const rowsOf = E => E(() => [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr[data-testid]')].map(t => t.dataset.testid.slice(4)).join());

await group('ПК-1 · поиск с клавиатуры: номер любой «А-», только точно; Enter — карточка; курсор в поиске; найдено вне отбора (АХ-82, АХ-83, АХ-Д18)', async (page, E) => {
  await E(() => window.AX.go('folders'));
  ck('АХ-82 · при входе в «Папки» курсор в поиске', await E(() => !!document.activeElement && document.activeElement.id === 'fq'));
  const q = async s => { await page.fill('[data-testid=f-q]', s); return rowsOf(E); };
  const lat = [await q('A-205'), await q('a205'), await q('A 205'), await q('А-000205'), await q('000205')];
  ck('АХ-Д18 · «A-205», «a205», «A 205» латиницей, «А-000205», «000205» → А-000205', lat.every(x => x === '205'), lat);
  ck('АХ-82 · «230» — только А-000230 (не А-000201 по ИНН 0230…)', (await q('230')) === '230');
  ck('АХ-82 · «120» — ничего: номера 120 нет, цифры внутри ИНН не ищутся', (await q('120')) === '');
  ck('АХ-82 · ИНН — с начала: «0230120» → А-000201', (await q('0230120')) === '201');
  ck('АХ-82 · год в названии ищется по вхождению: «2025» → 211, 213, 214', (await q('2025')) === '211,213,214');
  await page.fill('[data-testid=f-q]', '230'); await page.press('[data-testid=f-q]', 'Enter');
  ck('АХ-82 · Enter — карточка папки с этим номером (С-3: «Папки» → номер + Enter → «Выдать» → «Выдать» = 3 клика)', await E(() => window.AX.S.card === 'f230' && location.hash === '#/folder/230'));
  await page.keyboard.press('Escape');
  const foc = await E(() => { const el = document.activeElement; return { id: el && el.id, sel: el && [el.selectionStart, el.selectionEnd].join(), card: window.AX.S.card }; });
  ck('АХ-82 · закрыл карточку — курсор снова в поиске, номер выделен: следующий набирается поверх', foc.id === 'fq' && foc.sel === '0,3' && foc.card === null, foc);
  await page.fill('[data-testid=f-q]', 'Протоколы правления'); await page.press('[data-testid=f-q]', 'Enter');
  const many = await E(() => ({ card: window.AX.S.card, t: [...document.querySelectorAll('[data-testid=toast]')].map(t => t.textContent).join('|') }));
  ck('АХ-82 · найдены две — Enter карточку не открывает, подсказывает выбрать строку', many.card === null && has(many.t, 'найдено 2'), many);
  await page.fill('[data-testid=f-q]', 'Ак-Жол'); await page.press('[data-testid=f-q]', 'Enter');
  ck('АХ-82 · найдена одна — Enter открывает её', await E(() => window.AX.S.card === 'f201'));
  await E(() => window.AX.closeCard());
  await page.selectOption('[data-testid=f-place]', 's:go1-1');
  const o1 = { rows: await q('230'), out: await E(() => (document.querySelector('[data-testid=outside]') || {}).innerText || '') };
  ck('АХ-83 · отбор полки ГО · 1 · 1 + номер с другой полки: строки нет, «Вне отбора найдено ещё 1: А-000230 (ГО · 1 · 3, на руках)»',
    o1.rows === '' && has(o1.out, 'Вне отбора найдено ещё 1') && has(o1.out, 'А-000230') && has(o1.out, 'ГО · 1 · 3'), o1);
  await page.click('[data-testid=out-230]');
  ck('АХ-83 · номер — ссылка в карточку; отбор полки остаётся (С-9: «Переместить» чужую без сброса отбора)',
    await E(() => window.AX.S.card === 'f230' && window.AX.S.f.shelf === 'go1-1' && !!document.querySelector('[data-testid=mi-move]')));
  await E(() => window.AX.closeCard());
  const o2 = { rows: await q('209'), out: await E(() => (document.querySelector('[data-testid=outside]') || {}).innerText || '') };
  ck('АХ-83 · номер выбывшей — в строке «Вне отбора» (выбыла), а не «Ничего не найдено»', o2.rows === '' && has(o2.out, 'А-000209') && has(o2.out, 'выбыла'), o2);
  await page.click('[data-testid=reset-f]');
  ck('АХ-83 · «сбросить отборы» снимает отбор места', await E(() => !window.AX.S.f.shelf && !window.AX.S.chip && document.querySelector('[data-testid=f-place]').value === ''));
  await page.click('[data-testid=chip-gone]');
  ck('АХ-83 · плашка «выбыли» — А-000209 в таблице, строки «Вне отбора» нет', (await rowsOf(E)) === '209' && await E(() => !document.querySelector('[data-testid=outside]')));
});

await group('ПК-2 · плашки: состояния и «из них»; поиск и отборы одной строкой, место одним списком; держатель в одну строку (АХ-84, АХ-85, АХ-95)', async (page, E) => {
  await E(() => window.AX.go('folders'));
  const c = await E(() => { const ch = document.querySelector('[data-testid=chips]'), n = id => +ch.querySelector(`[data-testid=chip-${id}] .n`).textContent;
    return { order: [...ch.children].map(k => k.dataset.testid), sep: ch.querySelector('[data-testid=chips-sep]').textContent, sum: ['archive', 'reserved', 'out', 'gone'].reduce((s, id) => s + n(id), 0),
      total: window.AX.FOLDERS.length, queueLabel: ch.querySelector('[data-testid=chip-queue] .l').textContent }; });
  ck('АХ-84 · сначала состояния (в архиве · забронированы · на руках · выбыли), за чертой «из них» — просрочены · передаются · с очередью',
    c.order.join() === 'chip-archive,chip-reserved,chip-out,chip-gone,chips-sep,chip-over,chip-transfer,chip-queue' && c.sep === 'из них' && c.queueLabel === 'с очередью', c);
  ck('АХ-84 · состояния в сумме — все папки: 17 + 1 + 10 + 2 = 30', c.sum === 30 && c.total === 30, c);
  const L = await E(() => { const P = document.querySelector('#panel'), F = P.querySelectorAll('.filters'), b = [...F[0].children].map(e => Math.round(e.getBoundingClientRect().bottom));
    return { rows: F.length, spread: Math.max(...b) - Math.min(...b), selects: [...P.querySelectorAll('.filters select')].map(s => s.dataset.testid), accept: !!F[0].querySelector('[data-testid=accept]'),
      fit: F[0].scrollWidth <= F[0].clientWidth, tableTop: Math.round(P.querySelector('[data-testid=tbl-folders]').getBoundingClientRect().top) }; });
  ck('АХ-85 · поиск, пять отборов и «Принять папку» — одна строка', L.rows === 1 && L.spread <= 2 && L.accept && L.fit, L);
  ck('АХ-85 · отборы: вид · место · держатель · подразделение · подразделение держателя; отбора «Заёмщик» нет', L.selects.join() === 'f-kind,f-place,f-holder,f-dept,f-hdept', L.selects);
  ck('АХ-85 · таблица начинается выше 250 px (было 291)', L.tableTop < 250, L.tableTop);
  const pl = {};
  for (const v of ['r:dpo', 'c:go3', 's:go3-4']) { await page.selectOption('[data-testid=f-place]', v); pl[v] = await rowsOf(E); }
  ck('АХ-85 · «Место» одним списком: помещение ДПО — 3 папки; шкаф ГО · 3 — 217…225; полка ГО · 3 · 4 — 219, 220, 221',
    pl['r:dpo'].split(',').length === 3 && pl['c:go3'] === '217,218,219,220,221,222,223,224,225' && pl['s:go3-4'] === '219,220,221', pl);
  await page.selectOption('[data-testid=f-place]', '');
  const h = await E(() => { const tr = document.querySelector('[data-testid=row-203]'); return { txt: tr.children[6].innerText.replace(/\s+/g, ' ').trim(), h: Math.round(tr.getBoundingClientRect().height) }; });
  ck('АХ-95 · держатель с подразделением в одной строке: «Кадыров Т. · ДАК», строка ≤ 42 px (было 54)', h.txt === 'Кадыров Т. · ДАК' && h.h <= 42, h);
  await shot(page, '11-folders');
});

await group('ПК-3 · полоса пачки на месте «Показано», прилипает; число на кнопках; отмечены только показанные; «Выдать» пачкой — срок у каждой свой; печать списка полки (АХ-86…АХ-90, АХ-Д19)', async (page, E) => {
  await E(() => window.AX.go('folders'));
  const top = () => E(() => Math.round(document.querySelector('[data-testid=row-205]').getBoundingClientRect().top));
  const lb = () => E(() => Math.round(document.querySelector('[data-testid=listbar]').getBoundingClientRect().height));
  const t0 = await top(), h0 = await lb();
  await page.click('[data-testid=sel-202]');
  const t1 = await top(), h1 = await lb();
  ck('АХ-86 · первая отметка не сдвигает таблицу: полоса встала на место строки «Показано», та же высота',
    t0 === t1 && h0 === h1 && await E(() => !!document.querySelector('[data-testid=batch]') && !document.querySelector('[data-testid=shown]')), { t0, t1, h0, h1 });
  await page.click('[data-testid=sel-206]');
  await page.locator('[data-testid=sel-230]').scrollIntoViewIfNeeded();
  await page.click('[data-testid=sel-230]');
  const st = await E(() => { const C = document.querySelector('.content'), c = C.getBoundingClientRect(), b = document.querySelector('[data-testid=batch]').getBoundingClientRect(), th = document.querySelector('[data-testid=tbl-folders] thead th:nth-child(2)').getBoundingClientRect();
    return { scrolled: Math.round(C.scrollTop), batchTop: Math.round(b.top - c.top), thTop: Math.round(th.top - c.top), thBelow: th.top >= b.bottom - 1 }; });
  ck('АХ-86 · прокручено к 30-й строке — полоса и шапка таблицы у верха экрана', st.scrolled > 200 && st.batchTop >= 0 && st.batchTop < 12 && st.thTop < 70 && st.thBelow, st);
  await shot(page, '12-batch-sticky');
  const bn = await E(() => Object.fromEntries([...document.querySelectorAll('[data-testid=batch] .btn')].map(b => [b.dataset.testid, (b.disabled ? '-' : '') + b.querySelector('.bn').textContent])));
  ck('АХ-87 · на кнопках — сколько возьмёт: 202 в архиве, 206 забронирована, 230 на руках → Запросить (3) · Выдать (2) · Принять возврат (1) · Переместить (3) · Печать ярлыков (3) · Списать (3)',
    bn['b-request'] === '(3)' && bn['b-issue'] === '(2)' && bn['b-return'] === '(1)' && bn['b-move'] === '(3)' && bn['b-labels'] === '(3)' && bn['b-writeoff'] === '(3)', bn);
  await E(() => window.AX.clearSel());
  await page.click('[data-testid=sel-202]');
  const z = await E(() => { const b = document.querySelector('[data-testid=b-return]'); return { dis: b.disabled, why: b.dataset.why, t: b.textContent }; });
  ck('АХ-87 · ноль — серая с причиной: «Принять возврат (0)» — «среди отмеченных нет папок на руках»', z.dis && has(z.t, '(0)') && has(z.why, 'нет папок на руках'), z);
  await page.click('[data-testid=sel-206]');
  await page.selectOption('[data-testid=f-place]', 's:go3-4');
  const s0 = await E(() => window.AX.S.sel.size);
  await page.click('[data-testid=sel-all]');
  await page.click('[data-testid=b-writeoff]');
  const w = await E(() => ({ sel: window.AX.S.sel.size, title: document.querySelector('[data-testid=form-title]').textContent }));
  ck('АХ-88 · смена отбора снимает отметки со скрытых строк (АХ-Д19): «Списать · 3 папки» — только полка ГО · 3 · 4', s0 === 0 && w.sel === 3 && w.title === 'Списать · 3 папки', { s0, ...w });
  await page.keyboard.press('Escape');
  const iss = await E(() => { const A = window.AX; A.setF('place', ''); A.request('f213', { why: 'сверка премирования', needBy: '2026-11-30' }, 'sydykova'); A.clearSel(); return (A.reservedReq('f213') || {}).who; });
  await page.click('[data-testid=sel-212]'); await page.click('[data-testid=sel-213]');
  await page.click('[data-testid=b-issue]');
  const f0 = await E(() => { const d = document.querySelector('[data-testid=ff-due]'); return { to: document.querySelector('[data-testid=ff-to]').value, due: d.value, req: d.closest('.fld').querySelector('label').classList.contains('req') }; });
  ck('АХ-89 · «Вернуть до» пусто и не обязательно; «Кому» пусто — в пачке свободная и бронь', iss === 'sydykova' && f0.to === '' && f0.due === '' && !f0.req, { iss, ...f0 });
  await pick(page, 'to', 'sydykova'); await page.fill('[data-testid=ff-why]', 'сверка премирования');
  await page.click('[data-testid=form-submit]');
  const d = await E(() => { const A = window.AX; return { d212: (A.openIssue('f212') || {}).due, d213: (A.openIssue('f213') || {}).due, def: A.addWork(A.S.today, A.SETTINGS.issueDays.v) }; });
  ck('АХ-89 · срок у каждой свой: 213 — 30.11 из «нужна до» брони, 212 — срок по умолчанию', d.d213 === '2026-11-30' && d.d212 === d.def && d.d212 !== d.d213, d);
  await page.keyboard.press('Escape');
  await page.click('[data-testid=sel-206]');
  await page.click('[data-testid=b-issue]');
  ck('АХ-89 · все отмеченные забронированы за одним — «Кому» подставлено (Исаева А.)', await E(() => window.AX.S.form.vals.to === 'isaeva' && document.querySelector('[data-testid=ff-to]').value.startsWith('Исаева А.')));
  await page.keyboard.press('Escape');
  await E(() => { window.AX.setUser('jeen'); window.AX.go('folders'); });
  await page.click('[data-testid=sel-205]'); await page.click('[data-testid=sel-211]');
  const j = await E(() => [...document.querySelectorAll('[data-testid=batch] .btn')].map(b => b.textContent.trim()).join());
  ck('АХ-87 · у сотрудника одна кнопка — «Запросить (1)»: своя папка на руках (205) не считается', j === 'Запросить (1)', j);
  const p = await E(() => { const A = window.AX, o = {}; A.setF('place', 's:go1-1'); o.jeen = !!document.querySelector('[data-testid=print-shelf]');
    A.setUser('arch1'); A.go('folders'); A.setF('place', 'c:go1'); o.cab = !!document.querySelector('[data-testid=print-shelf]'); A.setF('place', 's:go1-1'); o.arch = !!document.querySelector('[data-testid=print-shelf]'); return o; });
  ck('АХ-90 · «Печать списка полки» — у архивариуса и только при отборе одной полки', p.arch && !p.cab && !p.jeen, p);
  await page.click('[data-testid=print-shelf]');
  const sh = await E(() => ({ sub: document.querySelector('[data-testid=print-sheet] .sub').textContent, th: [...document.querySelectorAll('[data-testid=shelf-list] th')].map(t => t.textContent).join('|'),
    n: document.querySelectorAll('[data-testid=shelf-list] tbody tr').length }));
  ck('АХ-90 · лист сверки полки ГО · 1 · 1 — три папки и «На месте» (С-9: отбор → «Печать списка полки» → «Печать» = 3 клика)', has(sh.sub, 'Архив ГО · шкаф 1 · полка 1') && sh.th.endsWith('На месте') && sh.n === 3, sh);
});

await group('ПК-4 · карточка: своя папка от первого лица; «Запросить все тома»; архивариус запрашивает из «Ещё ▾»; реквизиты без повторов шапки; сообщение с кнопкой в одну строку (АХ-91…АХ-94, АХ-Д20)', async (page, E) => {
  const w = await E(() => { const A = window.AX, o = {}, where = () => document.querySelector('[data-testid=where] .w1').textContent, flag = () => (document.querySelector('[data-testid=flag-mypos]') || {}).textContent || '';
    A.setUser('isaeva'); A.openCard('f206'); o.isaeva = where();
    A.setUser('asanov'); A.openCard('f230'); o.asanov = where(); A.openCard('f201'); o.asanovTr = where(); A.openCard('f205'); o.asanovPos = flag();
    A.setUser('mambetov'); A.openCard('f201'); o.mambetov = where();
    A.setUser('arch1'); A.openCard('f206'); o.arch = where(); A.openCard('f205'); o.archPos = flag(); return o; });
  ck('АХ-91 · бронь за собой: «ЗАБРОНИРОВАНА за вами до 17.11 — заберите в архиве»', w.isaeva === 'ЗАБРОНИРОВАНА за вами до 17.11 — заберите в архиве', w.isaeva);
  ck('АХ-91 · своя на руках: «НА РУКАХ у вас · вернуть до 10.11 — просрочена 3 р.д.»', w.asanov === 'НА РУКАХ у вас · вернуть до 10.11 — просрочена 3 р.д.', w.asanov);
  ck('АХ-91 · передача: получателю «ПЕРЕДАЁТСЯ вам от Асанова Б. — подтвердите «Получил»», передающему «ПЕРЕДАЁТСЯ: вы → Мамбетов К.»',
    w.mambetov === 'ПЕРЕДАЁТСЯ вам от Асанова Б. — подтвердите «Получил»' && w.asanovTr === 'ПЕРЕДАЁТСЯ: вы → Мамбетов К., ждёт «Получил»', w);
  ck('АХ-91 · своё место в очереди — пометкой в шапке «вы № 1 в очереди»; архивариусу — третье лицо, без пометки',
    w.asanovPos === 'вы № 1 в очереди' && w.arch === 'ЗАБРОНИРОВАНА за Исаевой А. до 17.11' && w.archPos === '', w);
  await E(() => { window.AX.setUser('jeen'); window.AX.go('folders'); window.AX.openCard('f225'); });
  await page.click('[data-testid=cb-request]');
  await page.fill('[data-testid=ff-why]', 'подготовка иска');
  await page.click('[data-testid=form-submit]');
  ck('АХ-91 · С-16: юрист запросил занятую — в шапке сразу «вы № 1 в очереди»', await E(() => (document.querySelector('[data-testid=flag-mypos]') || {}).textContent === 'вы № 1 в очереди'));
  await E(() => { window.AX.setUser('isaeva'); window.AX.go('folders'); window.AX.openCard('f202'); });
  const av = await E(() => (document.querySelector('[data-testid=cb-allvols]') || {}).textContent || '');
  ck('АХ-92 · том 1 из 2: рядом с «Запросить» — «Запросить все тома (2)»', av === 'Запросить все тома (2)', av);
  await page.click('[data-testid=cb-allvols]');
  ck('АХ-92 · одна форма на оба тома', await E(() => document.querySelector('[data-testid=form-title]').textContent === 'Запросить · 2 папки'));
  await page.fill('[data-testid=ff-why]', 'подготовка заключения');
  await page.click('[data-testid=form-submit]');
  const r2 = await E(() => { const A = window.AX, s = id => (A.activeReqs(id).find(r => r.who === 'isaeva') || {}).st; return [s('f202'), s('f203')]; });
  ck('АХ-92 · С-11 из карточки — 2 клика: том 1 забронирован, том 2 — в очереди', r2.join() === 'reserved,queue', r2);
  ck('АХ-92 · у одиночной папки кнопки нет', await E(() => { window.AX.setUser('sydykova'); window.AX.openCard('f213'); return !document.querySelector('[data-testid=cb-allvols]'); }));
  await E(() => { window.AX.setUser('arch1'); window.AX.go('folders'); window.AX.openCard('f213'); });
  await page.click('[data-testid=cb-more]');
  const mi = await E(() => { const m = document.querySelector('[data-testid=mi-request]'); return m ? { dis: m.disabled, main: !!document.querySelector('#cardpanel .cp-btns > [data-testid=cb-request]') } : null; });
  ck('АХ-93 · архивариусу «Запросить» — в «Ещё ▾», не в главном ряду (АХ-Д16)', mi && !mi.dis && !mi.main, mi);
  await page.click('[data-testid=mi-request]');
  await page.fill('[data-testid=ff-why]', 'проверка Счётной палаты');
  await page.click('[data-testid=form-submit]');
  const a3 = await E(() => { const A = window.AX, o = { res: (A.reservedReq('f213') || {}).who, mi: !!document.querySelector('[data-testid=mi-withdraw]') }; A.openCard('f209'); o.goneMore = !!document.querySelector('[data-testid=cb-more]'); return o; });
  ck('АХ-93 · запрос встал (бронь за архивариусом), в «Ещё ▾» — «Отозвать запрос»; у выбывшей «Ещё ▾» нет', a3.res === 'arch1' && a3.mi && !a3.goneMore, a3);
  const kv = await E(() => { const A = window.AX, ks = () => [...document.querySelectorAll('#cardpanel .kv .k')], val = k => { const e = ks().find(x => x.textContent === k); return e ? e.nextElementSibling.textContent.replace(/\s+/g, ' ').trim() : ''; },
    sub = () => (document.querySelector('[data-testid=where] .w2') || {}).textContent || '', o = {};
    A.openCard('f230'); o.k230 = ks().map(k => k.textContent).join('|'); o.acc230 = val('Принята'); o.sub230 = sub();
    A.openCard('f202'); o.vol202 = val('Том'); A.openCard('f211'); o.sub211 = sub(); o.w211 = document.querySelector('[data-testid=where] .w1').textContent; A.openCard('f209'); o.sub209 = sub();
    A.openCard('f205'); o.extTop = Math.round(document.querySelector('[data-testid=ext-box]').getBoundingClientRect().top); return o; });
  ck('АХ-94 · реквизиты одиночной КЗД — 4 строки: заёмщик · подразделение · содержание · принята (без места, «Том 1 из 1», «Сдал —»)', kv.k230 === 'Заёмщик|Подразделение|Содержание|Принята', kv.k230);
  ck('АХ-94 · «сдал» — в строке «Принята», если известен', kv.acc230 === '21.09.2026, Бекова С. · сдал Асанов Б.', kv.acc230);
  ck('АХ-94 · «Том 1 из 2» — у тома из двух', kv.vol202.startsWith('1 из 2'), kv.vol202);
  ck('АХ-94 · место — только в шапке: «В АРХИВЕ · …», на руках «вернётся на: …», выбыла «стояла: …»',
    kv.w211 === 'В АРХИВЕ · Архив ГО · шкаф 2 · полка 1' && kv.sub211 === '' && kv.sub230 === 'вернётся на: Архив ГО · шкаф 1 · полка 3' && kv.sub209 === 'стояла: Архив ГО · шкаф 1 · полка 4', kv);
  ck('АХ-94 · блок «Просьба продлить» поднялся (был на 553 px) и виден без прокрутки', kv.extTop < 500, kv.extTop);
  await shot(page, '13-card-ext');
  await E(() => { window.AX.closeCard(); window.AX.uiRebind('f218'); });
  await pick(page, 'borrower', 'n1');
  await page.fill('[data-testid=ff-basis]', 'ошибка при приёме');
  await page.click('[data-testid=form-submit]');
  const t = await E(() => { const d = [...document.querySelectorAll('[data-testid=toast]')].find(x => x.querySelector('button')), b = d.getBoundingClientRect(), bb = d.querySelector('button').getBoundingClientRect();
    return { h: Math.round(b.height), w: Math.round(b.width), dy: Math.round(bb.top - b.top) }; });
  ck('АХ-Д20 · сообщение «… перепечатайте ярлык» с кнопкой — одной строкой (было 640 × 68, кнопка второй строкой)', t.h <= 50 && t.dy < 14, t);
});

/* ================= окна действий (АХ-96…АХ-108) ================= */

await group('ОД-1 · устройство окна и клавиатура: «что сейчас» / «что будет», главная — глагол заголовка; курсор в первом поле, Enter, Esc, Tab не уходит под окно (АХ-96, АХ-97, АХ-Д21)', async (page, E) => {
  await page.click('[data-testid=give-refuse-206]');
  const w = await E(() => { const m = document.querySelector('#modal'), q = s => (m.querySelector(s) || {}).innerText || '';
    return { title: q('[data-testid=form-title]'), sub: q('[data-testid=form-sub]'), now: q('[data-testid=form-now]'), will: q('[data-testid=form-will]'), banner: !!m.querySelector('.banner'),
      prim: m.querySelector('[data-primary]').textContent, focus: document.activeElement.dataset.testid, clean: !/АХ-|ADR/.test(m.innerText) }; });
  ck('АХ-96 · заголовок «Отказать в запросе · А-000206», серой строкой название, без синей плашки',
    w.title === 'Отказать в запросе · А-000206' && w.sub === 'КЗД · ОсОО «Токмок-Строй» · том 1' && !w.banner && w.clean, w);
  ck('АХ-96 · «что сейчас» — запрос и бронь; «что будет» — уведомление и кому перейдёт бронь; главная — «Отказать»',
    has(w.now, 'Запрос Исаевой А. от') && has(w.now, 'бронь до 17.11.2026') && has(w.will, 'бронь перейдёт Кадырову Т.') && w.prim === 'Отказать', w);
  ck('АХ-97 · окно открыто мышью — курсор в «Причина» (было: нигде)', w.focus === 'ff-reason', w.focus);
  const tabs = [];
  for (let k = 0; k < 6; k++) { await page.keyboard.press('Tab'); tabs.push(await E(() => document.querySelector('#modal').contains(document.activeElement))); }
  ck('АХ-97 · Tab ×6 — курсор не уходит под окно (было: на «Продлить» чужой просьбы)', tabs.every(Boolean), tabs);
  await page.keyboard.press('Escape');
  const esc = await E(() => ({ open: document.querySelector('#overlay').classList.contains('open'), focus: document.activeElement.id, q: window.AX.activeReqs('f206').length }));
  ck('АХ-97 · Esc — «Отмена»: окно закрыто, ничего не сделано, курсор — в поле «Возврат»', !esc.open && esc.q === 2 && esc.focus === 'retInput', esc);
  await page.click('[data-testid=give-refuse-206]');
  await page.keyboard.type('нужна для проверки Счётной палаты');
  await page.keyboard.press('Enter');
  const done = await E(() => ({ open: document.querySelector('#overlay').classList.contains('open'), res: (window.AX.reservedReq('f206') || {}).who, focus: document.activeElement.id }));
  ck('АХ-97 · набрал причину, Enter — отказ сделан, бронь перешла Кадырову, курсор снова в «Возврат»', !done.open && done.res === 'kadyrov' && done.focus === 'retInput', done);
  ck('АХ-103 · сообщение: что сделано и что дальше — «бронь перешла Кадырову Т. до 17.11.2026»',
    (await toasts(E)).some(t => t.text === 'Отказано: запрос Исаевой А. на А-000206 закрыт — бронь перешла Кадырову Т. до 17.11.2026'), await toasts(E));
  const un = await E(() => { const A = window.AX; A.openCard('f206'); A.uiUnreserve('f206'); const p = document.querySelector('[data-primary]'); const o = { t: document.querySelector('[data-testid=form-title]').textContent, p: p.textContent };
    A.closeForm(); A.uiWriteoff('f211'); o.wo = document.querySelector('[data-primary]').className; A.closeForm(); return o; });
  ck('АХ-96 · «Снять бронь» — главная «Снять бронь», не «Отказать»; «Списать» — красная', un.t === 'Снять бронь · А-000206' && un.p === 'Снять бронь' && has(un.wo, 'btn-danger-solid'), un);
  await E(() => { const A = window.AX; A.closeCard(); A.go('folders'); A.uiAccept({ kind: 'nom', title: 'Протоколы правления · 2024', shelf: 'go3-3' }); });
  await page.click('[data-testid=ff-content]');
  await page.keyboard.type('протоколы'); await page.keyboard.press('Enter'); await page.keyboard.type('выписки');
  const ta = await E(() => ({ open: !!window.AX.S.form, v: window.AX.S.form && window.AX.S.form.vals.content }));
  await page.keyboard.press('Control+Enter');
  const ce = await E(() => { const f = window.AX.byNo(231); return { f: !!f, content: f && f.content }; });
  ck('АХ-97 · в «Содержании» Enter — новая строка, Ctrl+Enter — «Принять»', ta.open && ta.v === 'протоколы\nвыписки' && ce.f && ce.content === 'протоколы\nвыписки', { ta, ce });
});

await group('ОД-2 · выбор сотрудника и заёмщика поиском с «Предложено»; место — один список; причина — кнопками (АХ-98, АХ-99)', async (page, E) => {
  await E(() => { const A = window.AX; A.request('f225', { why: 'сверка графика' }, 'kadyrov'); A.setUser('asanov'); A.uiTransfer('f225'); });
  const sug = await E(() => ({ focus: document.activeElement.dataset.testid, ph: !!document.querySelector('[data-testid=pick-to] .ph'), items: [...document.querySelectorAll('[data-testid=pick-to] .pi')].map(x => x.textContent) }));
  ck('АХ-98 · «Передать»: курсор в «Кому», «Предложено» — ждущий в очереди и руководитель',
    sug.focus === 'ff-to' && sug.ph && sug.items.join('|') === 'Кадыров Т. · ДАК ждёт, № 1|Мамбетов К. · ДРР ваш руководитель', sug);
  await page.keyboard.type('ДРР');
  const s2 = await E(() => [...document.querySelectorAll('[data-testid=pick-to] .pi')].map(x => x.textContent));
  ck('АХ-98 · поиск по подразделению: «ДРР» — сотрудники ДРР, себя нет', s2.length >= 2 && s2.every(t => t.endsWith('· ДРР')) && !s2.some(t => t.startsWith('Асанов')), s2);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const p = await E(() => ({ to: window.AX.S.form.vals.to, focus: document.activeElement.dataset.testid, list: !!document.querySelector('[data-testid=pick-to]') }));
  ck('АХ-98 · стрелка и Enter выбирают; список закрыт, курсор — на «Передать»', p.to === 'jusup' && !p.list && p.focus === 'form-submit', p);
  await page.keyboard.press('Escape');
  const r = await E(() => { const A = window.AX, o = {}, items = id => [...document.querySelectorAll(`[data-testid=pick-${id}] .pi`)].map(x => x.dataset.testid.split('-').pop());
    A.setUser('arch1'); A.uiIssue('f206'); A.pkFocus('to'); o.issue = items('to'); A.closeForm();
    A.uiRebind('f217'); o.rebind = items('borrower'); A.closeForm();
    A.uiAccept(); A.fpick('borrower', 'b1'); A.pkFocus('from'); o.from = items('from'); o.fromNote = (document.querySelector('[data-testid=pick-from] .pn') || {}).textContent; A.closeForm();
    A.uiMove('f211'); const sel = document.querySelector('#modal select'); o.selects = document.querySelectorAll('#modal select').length;
    o.groups = sel.querySelectorAll('optgroup').length; const cur = sel.querySelector('option[value=go2-1]'); o.cur = cur && [cur.disabled, cur.textContent]; A.closeForm();
    A.uiWriteoff('f211'); o.seg = [...document.querySelectorAll('[data-testid=ff-reason] button')].map(b => b.textContent); A.closeForm(); return o; });
  ck('АХ-98 · «Выдать»: предложены запросившие — бронь и очередь', r.issue.join() === 'isaeva,kadyrov', r.issue);
  ck('АХ-98 · «Изменить привязку» непривязанной — предложен заёмщик с тем же ИНН', r.rebind.join() === 'n5', r.rebind);
  ck('АХ-98 · «Принять папку»: «Сдал» — предложен куратор заёмщика', r.from.join() === 'asanov' && r.fromNote === 'куратор заёмщика', r);
  ck('АХ-99 · место — один список полок по помещениям и шкафам; текущая «сейчас здесь» не выбирается',
    r.selects === 1 && r.groups >= 4 && r.cur && r.cur[0] && r.cur[1] === 'ГО · шкаф 2 · полка 1 — сейчас здесь', r);
  ck('АХ-99 · причина списания — четыре кнопки', r.seg.join('|') === 'утрачена|уничтожена|передана в госархив|передана другой организации', r.seg);
});

await group('ОД-3 · даты с подсказкой и «+5 / +10 р.д.»; запрет виден у поля сразу, кнопка серая с причиной (АХ-100, АХ-101)', async (page, E) => {
  await E(() => { window.AX.go('folders'); window.AX.openCard('f225'); });
  await page.click('[data-testid=cb-extend]');
  const q = await E(() => [...document.querySelectorAll('#modal .qb')].map(b => b.textContent));
  ck('АХ-100 · «Продлить»: быстрый срок от текущего (20.11) — «+5 р.д. · 27.11», «+10 р.д. · 04.12»', q.join('|') === '+5 р.д. · 27.11|+10 р.д. · 04.12', q);
  await page.click('[data-testid=q-date-5]');
  const qd = await E(() => ({ v: window.AX.S.form.vals.date, hint: (document.querySelector('#fh_date') || {}).textContent, focus: document.activeElement.dataset.testid }));
  ck('АХ-100 · «+5 р.д.» — дата 27.11.2026, под полем «пт · через 10 р.д.», курсор — в «Причина»', qd.v === '27.11.2026' && qd.hint === 'пт · через 10 р.д.' && qd.focus === 'ff-reason', qd);
  await page.fill('[data-testid=ff-date]', '19.11.2026');
  const bad = await E(() => ({ err: (document.querySelector('[data-testid=form-err]') || {}).textContent, field: (document.querySelector('[data-testid=form-err]') || {}).dataset?.field,
    dis: document.querySelector('[data-testid=form-submit]').disabled, why: document.querySelector('[data-testid=form-submit]').dataset.why }));
  ck('АХ-101 · срок раньше текущего — красным у поля сразу, «Продлить» серая с той же причиной',
    bad.field === 'date' && bad.err === 'новый срок — позже текущего (20.11.2026)' && bad.dis && bad.why === bad.err, bad);
  await page.fill('[data-testid=ff-date]', '27.11.20');
  ck('АХ-100 · дата набирается — ошибки нет, пока не набрана целиком', await E(() => !document.querySelector('[data-testid=form-err]') && !document.querySelector('[data-testid=form-submit]').disabled));
  await page.keyboard.press('Escape');
  await E(() => { window.AX.closeCard(); window.AX.uiIssue('f206'); });
  await pick(page, 'to', 'kadyrov');
  const iss = await E(() => ({ err: (document.querySelector('[data-testid=form-err]') || {}).textContent, dis: document.querySelector('[data-testid=form-submit]').disabled }));
  ck('АХ-101 · «Выдать» забронированную другому — у поля «Кому» сразу, кнопка серая', iss.err === 'забронирована за Исаевой А. до 17.11.2026 — выдать другому нельзя' && iss.dis, iss);
  const r = await E(() => { const A = window.AX, o = {}, err = () => (document.querySelector('[data-testid=form-err]') || {}).textContent || '', dis = () => document.querySelector('[data-testid=form-submit]').disabled;
    A.closeForm(); A.uiAccept(); A.fpick('borrower', 'b2'); o.vol = A.S.form.vals.vol; A.fset('vol', '2'); o.dup = [err(), dis()];
    A.closeForm(); A.uiRebind('f218'); A.fpick('borrower', 'b1'); o.rb = [err(), dis()];
    A.closeForm(); A.setUser('sydykova'); A.uiRequest('f214'); A.fset('needBy', '20.11.2026'); o.need = (document.querySelector('#fh_needBy') || {}).textContent; A.closeForm(); return o; });
  ck('АХ-101 · «Принять папку»: том подставлен следующий (3); набран том 2 — «том 2 уже в архиве — А-000203» сразу', r.vol === 3 && r.dup[0] === 'том 2 уже в архиве — А-000203' && r.dup[1], r);
  ck('АХ-101 · «Изменить привязку» к заёмщику, у которого уже есть том 1, — сразу у поля', r.rb[0] === 'у заёмщика уже есть том 1 — А-000201' && r.rb[1], r.rb);
  ck('АХ-100 · «нужна до» раньше срока держателя — «держатель может передать вам напрямую»', has(r.need, 'на руках до 25.11 — позже, чем нужно; держатель может передать вам напрямую'), r.need);
});

await group('ОД-4 · пачкой — строки с исходом до нажатия, итог сообщением; без окна; уволенному не продлевают; ввод подряд; причина-шаблон; своя строка очереди (АХ-102…АХ-108, АХ-Д22)', async (page, E) => {
  await E(() => { const A = window.AX; A.go('folders'); A.uiIssueBatch(['f206', 'f211', 'f212']); });
  await pick(page, 'to', 'kadyrov');
  const b = await E(() => ({ rows: [...document.querySelectorAll('[data-testid=batch-rows] tbody tr')].map(t => t.children[2].textContent), btn: document.querySelector('[data-testid=form-submit]').textContent }));
  ck('АХ-102 · «Выдать · 3 папки»: строка на папку до нажатия — чужая бронь видна сразу, «Выдать (2)»',
    b.rows[0] === 'не выдаётся: забронирована за Исаевой А. до 17.11' && b.rows[1] === 'выдаётся до 27.11 — 10 р.д.' && b.btn === 'Выдать (2)', b);
  await page.fill('[data-testid=ff-why]', 'сверка');
  await page.keyboard.press('Enter');
  const bt = await E(() => ({ open: document.querySelector('#overlay').classList.contains('open'), res: !!document.querySelector('[data-testid=batch-result]'), t: [...document.querySelectorAll('[data-testid=toast]')].map(x => x.textContent) }));
  ck('АХ-102 · итог — сообщением, второго окна нет: «Выдано 2 из 3 — Кадырову Т. …; не выдано: А-000206 — …»',
    !bt.open && !bt.res && bt.t.some(t => t.startsWith('Выдано 2 из 3 — Кадырову Т., получателю уведомление; не выдано: А-000206 — забронирована за Исаевой А.')), bt);
  const z = await E(() => { const A = window.AX; A.uiWriteoffBatch(['f209']); const p = document.querySelector('[data-testid=form-submit]'); const o = { t: p.textContent, dis: p.disabled, why: p.dataset.why }; A.closeForm(); return o; });
  ck('АХ-102 · ноль к действию — кнопка «Списать (0)» серая с причиной', z.t === 'Списать (0)' && z.dis && has(z.why, 'уже выбыли'), z);
  const t = await E(() => { const A = window.AX, last = () => [...document.querySelectorAll('[data-testid=toast]')].pop().textContent, o = {};
    A.setUser('isaeva'); A.openCard('f223'); A.uiAskExt('f223'); A.submitForm('main', { date: '24.11.2026', reason: 'мониторинг перенесён' }); o.ask = last();
    A.setUser('sydykova'); A.uiRequest('f214'); A.submitForm('main', { why: 'сверка' }); o.req = last();
    A.setUser('asanov'); A.openCard('f205'); o.ownRow = !!document.querySelector('[data-testid=cp-queue] [data-testid=q-withdraw]'); o.cbW = !!document.querySelector('[data-testid=cb-withdraw]');
    o.rows = [...document.querySelectorAll('[data-testid=cp-queue] tbody tr')].map(r => r.children[6].textContent);
    A.uiWithdraw('f205'); o.wOpen = document.querySelector('#overlay').classList.contains('open'); o.w = last(); return o; });
  ck('АХ-103 · занятая: «Вы № 1 в очереди на А-000214 — на руках у Жээнбековой Н. до 25.11.2026; дойдёт очередь — придёт уведомление»',
    t.req === 'Вы № 1 в очереди на А-000214 — на руках у Жээнбековой Н. до 25.11.2026; дойдёт очередь — придёт уведомление', t.req);
  ck('АХ-103 · просьба продлить — что дальше: «решение придёт уведомлением»', t.ask === 'Просьба продлить А-000223 до 24.11.2026 отправлена архивариусу — решение придёт уведомлением', t.ask);
  ck('АХ-108 · в очереди карточки своя строка без кнопки; «Отозвать запрос» — в кнопках над реквизитами', !t.ownRow && t.cbW && t.rows[0] === '', t);
  ck('АХ-104 · «Отозвать запрос» — без окна, одним нажатием, сообщение «Запрос на А-000205 отозван»', !t.wOpen && t.w === 'Запрос на А-000205 отозван', t);
  const f = await E(() => { const A = window.AX, o = {}; A.setUser('arch1'); A.openCard('f208'); const b = document.querySelector('[data-testid=cb-extend]'); o.btn = b && [b.disabled, b.dataset.why];
    o.ext = A.extend('f208', { date: '2026-11-30', reason: 'х' }); o.gate = A.gate('extend', 'f208'); return o; });
  ck('АХ-105 · уволенному не продлевают: «Продлить» серая, движок — «держатель уволен — продлевать некому: примите возврат или спишите»',
    f.btn && f.btn[0] && f.btn[1] === 'держатель уволен — продлевать некому: примите возврат или спишите' && !f.ext.ok && f.ext.why === f.btn[1] && !f.gate.ok, f);
  await E(() => { const A = window.AX; A.closeCard(); A.uiAccept(); });
  await page.keyboard.type('Иманов'); await page.keyboard.press('Enter');
  await page.selectOption('[data-testid=ff-shelf]', 'go1-2');
  await page.click('[data-testid=form-more]');
  const s1 = await E(() => ({ prim: document.querySelector('[data-primary]').dataset.testid, primT: document.querySelector('[data-primary]').textContent, focus: document.activeElement.dataset.testid, now: document.querySelector('[data-testid=form-now]').innerText }));
  ck('АХ-106 · после «Принять и ещё» главная (Enter) — «Принять и ещё», курсор в «Заёмщик», сверху «Принята А-000231 · подряд 1»',
    s1.prim === 'form-more' && s1.primT === 'Принять и ещё' && s1.focus === 'ff-borrower' && s1.now.startsWith('Принята А-000231 · подряд 1'), s1);
  await page.keyboard.type('Иманов'); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const s2 = await E(() => ({ now: document.querySelector('[data-testid=form-now]').innerText, nos: [231, 232].map(n => window.AX.byNo(n) && window.AX.titleOf(window.AX.byNo(n))) }));
  ck('АХ-106 · второй том — без мыши: заёмщик, Enter, Enter; «подряд 2 · Печать ярлыков (2)»',
    s2.nos.join('|') === 'КЗД · Иманов К.Т. · том 3|КЗД · Иманов К.Т. · том 4' && s2.now === 'Принята А-000232 · подряд 2 · Печать ярлыков (2)', s2);
  await page.click('[data-testid=series-labels]');
  ck('АХ-106 · «Печать ярлыков (2)» — лист всей серии', await E(() => document.querySelectorAll('[data-testid=labels] .label').length === 2));
  const p = await E(() => { const A = window.AX, o = {}; A.closeForm();
    A.uiRebind('f217', 'n5'); o.inn = A.S.form.vals.basis; A.closeForm(); A.uiRebind('f218'); o.none = A.S.form.vals.basis; A.closeForm();
    const x = A.EXTS.find(e => e.st === 'pending'); A.uiDecide(x.id, false); o.ext = A.S.form.vals.reason; A.closeForm(); return o; });
  ck('АХ-107 · причина подставлена, только где система знает: «совпал ИНН», «папку ждут: …»; иначе пусто',
    p.inn === 'заёмщик заведён в системе — совпал ИНН' && p.none === '' && p.ext === 'папку ждут: Абдыкеримова Ж.', p);
});

/* ============ «Мои папки» и «Заёмщики без КЗД» — автогриллинг страницы (АХ-109…АХ-122) ============ */
const focusId = E => E(() => { const a = document.activeElement; return a.id || a.dataset.testid || a.tagName; });
const inCard = E => E(() => document.querySelector('#cardpanel').contains(document.activeElement));

await group('МП-1 · «Найти папку» с клавиатуры: курсор при входе, Enter — номер сразу карточкой; карточка держит курсор; курсор после действия (АХ-109, АХ-112, АХ-122)', async (page, E) => {
  await E(() => window.AX.setUser('sydykova'));
  const g = await E(() => { const i = document.querySelector('#mineQ').getBoundingClientRect(), b = document.querySelector('[data-testid=mine-find-go]').getBoundingClientRect();
    return { focus: document.activeElement.id, w: Math.round(i.width), gap: Math.round(b.left - i.right), btn: document.querySelector('[data-testid=mine-find-go]').textContent }; });
  ck('АХ-109 · стартовый экран: курсор в «Найти папку» (было: нигде); поле 520 px, «Найти» сразу за полем', g.focus === 'mineQ' && g.w === 520 && g.gap <= 16 && g.btn === 'Найти', g);
  await page.click('[data-testid=nav-folders]'); await page.click('[data-testid=nav-mine]');
  ck('АХ-109 · вернулся на «Мои папки» из меню — курсор снова в поле', await focusId(E) === 'mineQ');
  await page.keyboard.type('A-230'); await page.keyboard.press('Enter');
  const a = await E(() => ({ view: window.AX.S.view, q: window.AX.S.q, card: window.AX.S.card, focus: document.activeElement.dataset.testid }));
  ck('АХ-109 · «A-230» + Enter — «Папки» с запросом и сразу карточка А-000230 (было: список из одной строки)', a.view === 'folders' && a.q === 'A-230' && a.card === 'f230' && a.focus === 'cp-title', a);
  await page.keyboard.press('Tab');
  const t1 = await E(() => document.activeElement.dataset.testid);
  const tabs = [];
  for (let k = 0; k < 8; k++) { await page.keyboard.press('Tab'); tabs.push(await inCard(E)); }
  await page.keyboard.press('Shift+Tab');
  ck('АХ-122 · Tab из заголовка — на первую кнопку карточки («Запросить»), Tab ×8 не уходит под карточку (было: по отборам «Папок»)', t1 === 'cb-request' && tabs.every(Boolean) && await inCard(E), { t1, tabs });
  await page.keyboard.press('Escape');
  const esc = await E(() => { const el = document.activeElement; return { card: window.AX.S.card, focus: el.id, sel: !!el.value && el.selectionStart === 0 && el.selectionEnd === el.value.length }; });
  ck('АХ-122 · Esc — карточка закрыта, курсор в поиске «Папок», набранное выделено', !esc.card && esc.focus === 'fq' && esc.sel, esc);
  await E(() => window.AX.go('mine'));
  await page.keyboard.type('протоколы правления'); await page.click('[data-testid=mine-find-go]');
  const b = await E(() => ({ view: window.AX.S.view, card: window.AX.S.card, rows: [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].length, focus: document.activeElement.id }));
  ck('АХ-109 · «протоколы правления» + «Найти» — две папки списком, без карточки, курсор в поиске «Папок»', b.view === 'folders' && !b.card && b.rows === 2 && b.focus === 'fq', b);
  await E(() => window.AX.go('mine'));
  await page.keyboard.type('сверки'); await page.keyboard.press('Enter');
  ck('АХ-109 · найдена одна («сверки» → А-000221) — сразу её карточка', await E(() => window.AX.S.card === 'f221'));
  /* Карточка из поиска «Папок» держит курсор и после окна действия; открытая мышью — курсор не перехватывает. */
  await E(() => { window.AX.setUser('asanov'); window.AX.go('folders'); });
  await page.keyboard.type('225'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  const t2 = await E(() => document.activeElement.dataset.testid);
  await page.keyboard.press('Enter'); const formOpen = await E(() => !!window.AX.S.form);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  ck('АХ-122 · «225» Enter → Tab → «Передать» Enter — окно; Esc (список сотрудников, затем окно) — курсор снова в карточке', t2 === 'cb-transfer' && formOpen && await E(() => !window.AX.S.form && document.activeElement.dataset.testid === 'cp-title'), t2);
  await E(() => { window.AX.closeCard(); window.AX.setQ(''); window.AX.go('folders'); });
  await page.click('[data-testid=row-214]');
  ck('АХ-122 · карточка, открытая мышью, курсор не перехватывает (как было)', await E(() => window.AX.S.card === 'f214') && !(await inCard(E)));
  await E(() => window.AX.closeCard());
  /* Курсор после действия на «Моих папках». */
  await E(() => window.AX.setUser('mambetov'));
  await page.click('[data-testid=got-201]');
  const c1 = await focusId(E);
  await E(() => window.AX.setUser('asanov'));
  await page.click('[data-testid=transfer-225]'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const c3 = await focusId(E);
  await page.click('[data-testid=hand-225]'); await page.keyboard.press('Escape');
  const c4 = await focusId(E);
  await E(() => { const A = window.AX; A.transfer('f225', { to: 'mambetov' }, 'asanov'); A.render(); });
  await page.click('[data-testid=cancel-225]');
  const c2 = await focusId(E);
  ck('АХ-112 · после «Получил», «Отменить передачу», окна «Передать» и карточки — курсор в «Найти папку» (было: нигде)', [c1, c2, c3, c4].every(x => x === 'mineQ'), [c1, c2, c3, c4]);
});

await group('МП-2 · пустой экран — строка, а не плашка; папки подразделения; руководителю — на руках у сотрудников (АХ-110, АХ-111)', async (page, E) => {
  await E(() => window.AX.setUser('sydykova'));
  const e = await E(() => { const n = document.querySelector('[data-testid=mine-empty]'), r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return { text: n.textContent, h: Math.round(r.height), border: cs.borderTopStyle, link: document.querySelector('[data-testid=mine-dept]').textContent, staff: !!document.querySelector('[data-testid=mine-staff]') }; });
  ck('АХ-110 · пусто всё — одна строка «У вас нет папок архива — ни на руках, ни в запросах.» (было: плашка 1602 × 78 px)',
    e.text === 'У вас нет папок архива — ни на руках, ни в запросах.' && e.h <= 24 && e.border === 'none', e);
  ck('АХ-110 · ссылка «Папки подразделения «Бухгалтерия»: 2»; руководителю-ссылки у бухгалтера нет', e.link === 'Папки подразделения «Бухгалтерия»: 2' && !e.staff, e);
  await page.click('[data-testid=mine-dept]');
  const d = await E(() => ({ view: window.AX.S.view, dept: window.AX.S.f.dept, rows: [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => t.dataset.testid), focus: document.activeElement.id }));
  ck('АХ-110 · С-18 одним кликом: «Папки» с отбором «Бухгалтерия» — А-000213 «Протоколы правления · 2025» и А-000221, число = строкам', d.view === 'folders' && d.dept === 'Бухгалтерия' && d.rows.join() === 'row-213,row-221' && d.focus === 'fq', d);
  const r = await E(() => { const A = window.AX, o = {}; ['asanov', 'isaeva', 'jeen'].forEach(u => { A.setUser(u); o[u] = [document.querySelector('[data-testid=mine-dept]').textContent, !!document.querySelector('[data-testid=mine-staff]')]; });
    A.setUser('mambetov'); o.staff = document.querySelector('[data-testid=mine-staff]').textContent; return o; });
  ck('АХ-110 · у каждого своё подразделение: ДРР 9, ДАК 10, ДПО 1; у кураторов и юриста ссылки «на руках у сотрудников» нет',
    r.asanov.join() === 'Папки подразделения «ДРР»: 9,false' && r.isaeva.join() === 'Папки подразделения «ДАК»: 10,false' && r.jeen.join() === 'Папки подразделения «ДПО»: 1,false', r);
  ck('АХ-111 · руководителю (Мамбетов): «На руках у сотрудников ДРР: 4 · просрочена 1»', r.staff === 'На руках у сотрудников ДРР: 4 · просрочена 1', r.staff);
  await page.click('[data-testid=mine-staff-all]');
  const s1 = await E(() => ({ hdept: window.AX.S.f.hdept, chip: window.AX.S.chip, rows: [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => t.dataset.testid).join() }));
  await E(() => window.AX.go('mine')); await page.click('[data-testid=mine-staff-over]');
  const s2 = await E(() => ({ hdept: window.AX.S.f.hdept, chip: window.AX.S.chip, rows: [...document.querySelectorAll('[data-testid=tbl-folders] tbody tr')].map(t => t.dataset.testid).join() }));
  ck('АХ-111 · С-19 одним кликом (было 5): «4» — отбор «Подразделение держателя» ДРР, четыре папки; «просрочена 1» — с плашкой «просрочены», А-000230',
    s1.hdept === 'ДРР' && !s1.chip && s1.rows === 'row-201,row-216,row-225,row-230' && s2.hdept === 'ДРР' && s2.chip === 'over' && s2.rows === 'row-230', { s1, s2 });
});

await group('МП-3 · блоки: «Вам передают» с «Кто ждёт», срок «через N р.д.», одна сетка колонок, бронь — помещение (АХ-113…АХ-116)', async (page, E) => {
  const r = await E(() => { const A = window.AX, o = {};
    A.request('f201', { why: 'подготовка иска' }, 'jeen');
    A.setUser('mambetov');
    const th = id => [...document.querySelectorAll(`[data-testid=${id}] thead th`)].map(t => t.textContent).join('|');
    const xs = id => [...document.querySelectorAll(`[data-testid=${id}] thead th`)].map(t => Math.round(t.getBoundingClientRect().left)).join();
    o.inTh = th('tbl-incoming'); o.handTh = th('tbl-hands'); o.inX = xs('tbl-incoming'); o.handX = xs('tbl-hands');
    o.inRow = document.querySelector('[data-testid=in-201]').innerText;
    A.setUser('asanov'); o.reqX = xs('tbl-req'); o.handX2 = xs('tbl-hands'); o.reqTh = th('tbl-req');
    return o; });
  ck('АХ-113 · «Вам передают» — те же колонки, что «На руках у меня»: № · Название · Вернуть до · Кто ждёт · Отметки', r.inTh === r.handTh && r.inTh === '№|Название|Вернуть до|Кто ждёт|Отметки|', r);
  ck('АХ-113 · получатель видит очередь до «Получил»: «ждёт Жээнбекова Н. с 13.11», «передаёт Асанов Б.»', has(r.inRow, 'ждёт Жээнбекова Н. с 13.11') && has(r.inRow, 'передаёт Асанов Б.'), r.inRow);
  ck('АХ-115 · три таблицы — одна сетка: колонки «Вам передают», «На руках у меня» и «Мои запросы» начинаются на тех же x',
    r.inX === r.handX && r.reqX === r.handX2 && r.inX === r.handX2 && r.reqTh === '№|Название|Нужна до|Зачем|Состояние|', r);
  const t = await E(() => { const A = window.AX, o = {};
    A.request('f225', { why: 'подготовка иска', needBy: '2026-12-01' }, 'jeen'); A.transfer('f225', { to: 'jeen' }, 'asanov');
    A.setUser('jeen'); o.inRow = (document.querySelector('[data-testid=in-225]') || {}).innerText || ''; o.reqRow = !!document.querySelector('[data-testid=req-225]');
    o.blocks = [...document.querySelectorAll('.section-h[data-testid^=blk]')].map(b => b.dataset.testid).join();
    return o; });
  ck('АХ-113 · передают по вашему же запросу: в «Вам передают» — «ваш запрос закроется передачей», в «Моих запросах» второй строки нет',
    has(t.inRow, 'ваш запрос закроется передачей') && !t.reqRow && t.blocks === 'blk-incoming,blk-hands,blk-req', t);
  const d = await E(() => { const A = window.AX, o = {}, due = no => { const c = document.querySelector(`[data-testid=due-${no}]`); const s = c.querySelector('.due-s'); return [c.innerText.replace(/\n/g, ' '), s.className]; };
    A.setUser('isaeva'); o.i223 = due(223); o.req = document.querySelector('[data-testid=req-206]').innerText.replace(/\n/g, ' ');
    A.setUser('asanov'); o.a230 = due(230);
    A.setUser('mambetov'); o.m216 = due(216);
    A.setToday('2026-11-17'); A.setUser('isaeva'); o.today = due(223);
    return o; });
  ck('АХ-114 · срок «через N р.д.»: А-000223 у Исаевой — «через 2 р.д.» жёлтым (день напоминания), А-000216 у Мамбетова — «через 7 р.д.» серым',
    d.i223[0] === '17.11.2026 через 2 р.д.' && d.i223[1] === 'due-s soon' && d.m216[0] === '24.11.2026 через 7 р.д.' && d.m216[1] === 'due-s', d);
  ck('АХ-114 · после срока — «просрочена 3 р.д.» красным; в день срока — «срок сегодня»', d.a230[0] === '10.11.2026 просрочена 3 р.д.' && d.a230[1] === 'due-s over' && d.today[0] === '17.11.2026 срок сегодня', d);
  ck('АХ-116 · бронь в «Моих запросах»: «ждёт вас в архиве до 17.11.2026» и помещение «Архив ГО», без шкафа и полки',
    has(d.req, 'ждёт вас в архиве до 17.11.2026') && has(d.req, 'Архив ГО') && !has(d.req, 'шкаф'), d.req);
});

await group('МП-4 · «Заёмщики без КЗД»: без счётчика в меню, отборы по роли, «Привязать» вместо «Принять папку»; врезка «Где бумага» (АХ-117…АХ-121, АХ-Д23)', async (page, E) => {
  const m = await E(() => { const A = window.AX, o = {};
    A.USERS.forEach(([u]) => { A.setUser(u); A.go('nokzd'); o[u] = { cnt: document.querySelector('[data-testid=cnt-nokzd]').textContent, mine: !!document.querySelector('[data-testid=nk-mine]'), dept: document.querySelector('[data-testid=nk-dept]').value,
      rows: [...document.querySelectorAll('tr[data-testid^=nk-]')].map(t => t.dataset.testid).join(), shown: document.querySelector('[data-testid=nk-count]').textContent }; });
    return o; });
  ck('АХ-117 · у «Заёмщиков без КЗД» счётчика в меню нет ни у кого; число — на странице («Показано: 5» у архивариуса, «2» у куратора)',
    Object.values(m).every(x => x.cnt === '') && m.arch1.shown === 'Показано: 5' && m.asanov.shown === 'Показано: 2', m.arch1);
  ck('АХ-118 · «мои заёмщики» — только у кураторов (Асанов, Исаева); у архивариуса, заведующего, юриста, бухгалтера флажка нет',
    m.asanov.mine && m.isaeva.mine && !m.arch1.mine && !m.mambetov.mine && !m.jeen.mine && !m.sydykova.mine, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.mine])));
  ck('АХ-118 · заведующему ДРР по умолчанию свой департамент — 3 строки из 5; остальным — все', m.mambetov.dept === 'ДРР' && m.mambetov.rows === 'nk-n3,nk-n5,nk-n1' && m.arch1.dept === '' && m.arch1.rows === 'nk-b9,nk-n3,nk-n2,nk-n5,nk-n1', m.mambetov);
  await E(() => { window.AX.setUser('arch1'); window.AX.go('nokzd'); });
  await page.selectOption('[data-testid=nk-dept]', 'ДАК');
  ck('АХ-118 · отбор «Департамент» ДАК — Хасанов Р.М. и Турдубаев А.Ж.', await E(() => [...document.querySelectorAll('tr[data-testid^=nk-]')].map(t => t.dataset.testid).join() === 'nk-b9,nk-n2'));
  await page.selectOption('[data-testid=nk-dept]', '');
  const b = await E(() => ({ bind: (document.querySelector('[data-testid=nk-bind-n5]') || {}).textContent, acc: !!document.querySelector('[data-testid=nk-accept-n5]'), others: ['b9', 'n3', 'n2', 'n1'].every(id => !!document.querySelector(`[data-testid=nk-accept-${id}]`)),
    gone: document.querySelector('[data-testid=nk-gone-b9]').textContent, head: [...document.querySelectorAll('[data-testid=tbl-nokzd] thead th')].map(t => t.textContent)[5] }));
  ck('АХ-119 · строка с непривязанной КЗД того же ИНН — «Привязать А-000217», «Принять папку» нет; у остальных — «Принять папку»', b.bind === 'Привязать А-000217' && !b.acc && b.others, b);
  ck('АХ-119, АХ-120 · «КЗД выбыла: утрачена 01.10.2026 (А-000209)»; колонка «Дней с регистрации»', b.gone === 'КЗД выбыла: утрачена 01.10.2026 (А-000209)' && b.head === 'Дней с регистрации', b);
  await page.click('[data-testid=nk-gone-b9] button');
  ck('АХ-119 · номер выбывшей — ссылка в карточку (там «Восстановить»)', await E(() => window.AX.S.card === 'f209' && !!document.querySelector('[data-testid=cb-restore]')));
  await E(() => window.AX.closeCard());
  await page.click('[data-testid=nk-bind-n5]');
  const f = await E(() => ({ t: document.querySelector('[data-testid=form-title]').textContent, bor: window.AX.S.form.vals.borrower }));
  await page.keyboard.press('Enter');
  const after = await E(() => ({ form: !!window.AX.S.form, rows: [...document.querySelectorAll('tr[data-testid^=nk-]')].map(t => t.dataset.testid).join(), dup: window.AX.FOLDERS.filter(x => x.kind === 'kzd' && x.borrower === 'n5').length }));
  ck('АХ-119 · «Привязать А-000217» — окно с подставленным заёмщиком, Enter — заёмщик ушёл из списка, КЗД одна', f.t === 'Изменить привязку · А-000217' && f.bor === 'n5' && !after.form && after.rows === 'nk-b9,nk-n3,nk-n2,nk-n1' && after.dup === 1, { f, after });
  const p = await E(() => { const A = window.AX, o = {}, w = no => (document.querySelector(`[data-testid=pb-where-${no}]`) || {}).innerText || '', act = no => document.querySelector(`[data-testid=pb-row-${no}]`).lastElementChild.innerText.trim();
    A.setUser('isaeva'); A.openBorrower('b2'); o.th = [...document.querySelectorAll('[data-testid=paperbox] thead th')].map(t => t.textContent).join('|');
    A.openBorrower('b1'); o.other = w(201);
    A.setUser('asanov'); A.openBorrower('b1'); o.sender = [w(201), act(201)]; A.openBorrower('b3'); o.q = [w(205), act(205)];
    A.setUser('mambetov'); A.openBorrower('b1'); o.recv = [w(201), act(201)];
    A.setUser('jeen'); A.openBorrower('b3'); o.hold = [w(205), act(205)];
    A.openBorrower('b9'); o.gone = [document.querySelector('[data-testid=pb-nokzd]').textContent, w(209)];
    A.openBorrower('n2'); o.none = document.querySelector('[data-testid=pb-nokzd]').textContent;
    return o; });
  ck('АХ-121 · колонки врезки — «Папка · Где сейчас»: том — в названии, отдельной колонки нет', p.th === 'Папка|Где сейчас|', p.th);
  ck('АХ-121 · своя папка от первого лица и без «Запросить»: держателю «у вас до 16.11.2026», передающему «вы → Мамбетов К.», получателю «вам от Асанова Б. — подтвердите «Получил»»',
    has(p.hold[0], 'на руках у вас до 16.11.2026') && p.hold[1] === '' && has(p.sender[0], 'вы → Мамбетов К.') && p.sender[1] === '' && has(p.recv[0], 'вам от Асанова Б. — подтвердите «Получил»') && p.recv[1] === '', p);
  ck('АХ-121 · при очереди — «ждут N» (кроме вас): у юриста-держателя «ждут 2», у Асанова в очереди — «ждут 1» и «№ 1 в очереди»',
    has(p.hold[0], 'ждут 2') && has(p.q[0], 'ждут 1') && has(p.q[1], '№ 1 в очереди'), p);
  ck('АХ-Д23 · передача у чужой папки — «Асанов Б. → Мамбетов К., вернуть до 20.11.2026» (было: «передаётся у Асанова Б.»)', has(p.other, 'Асанов Б. → Мамбетов К., вернуть до 20.11.2026'), p.other);
  ck('АХ-Д23 · КЗД выбыла — «Кредитно-залоговое дело выбыло: утрачена 01.10.2026 (А-000209) — в архиве его нет», «выбыла» один раз; не сдано — как было',
    p.gone[0] === 'Кредитно-залоговое дело выбыло: утрачена 01.10.2026 (А-000209) — в архиве его нет' && p.gone[1].split('выбыла').length === 2 && p.none === 'Кредитно-залоговое дело в архив не сдано', p);
});

await browser.close();
console.log(`\n${passed + failed} проверок: ${passed} пройдено, ${failed} провалено`);
if (failed) { console.log('\nПровалы:'); fails.forEach(f => console.log(f)); process.exit(1); }
