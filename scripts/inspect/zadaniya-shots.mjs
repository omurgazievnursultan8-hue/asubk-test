// Визуальная проверка макета «Заданий» в браузере на 1920×1080: очередь, карточка, настройка (таблица заданий, панель правила,
// окна правки и выключения, подсветка, уведомления), журнал прогонов (опрос, поводы, доставка), панель правила на чтение.
// Открывает mockups/zadaniya/zadaniya.html с диска, ловит ошибки консоли и горизонтальную прокрутку, снимки — в .auth/zadaniya/.
//   node scripts/inspect/zadaniya-shots.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML = pathToFileURL(resolve(__dir, '../../mockups/zadaniya/zadaniya.html')).href;
const OUT = resolve(__dir, '../../.auth/zadaniya');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(HTML);
await page.waitForFunction(() => window.ZD && ZD.state.today === '2026-10-01');

const wide = [];
const shot = async name => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const over = await page.evaluate(() => { const c = document.querySelector('.content'); return c.scrollWidth > c.clientWidth; });
  if (over) wide.push(name);
};
const js = (fn, arg) => page.evaluate(fn, arg);
const toDate = async d => { await js(x => ZD.goToDate(x), d); await page.waitForFunction(x => ZD.state.today === x, d); };

// очередь и карточка задания по правилу
await js(() => { ZD.setViewer('E1'); ZD.go('queue'); });
await shot('01-queue');
const taskId = await js(() => ZD.state.tasks.find(t => t.originKind && t.assignee === 'E1' && !ZD.isTerminal(t) && ZD.ruleForKind(t.originKind)).id);
await js(id => ZD.openCard(id), taskId);
await shot('02-card');

// правило из карточки: панель на чтение поверх очереди
await js(() => document.querySelector('.drawer button[onclick*="showRule"]').click()); // ссылка в свёрнутых подробностях карточки
await page.waitForSelector('.drawer[data-rule]');
await shot('03-rule-reader');
const reader = await js(() => ({ view: ZD.state.view, edit: !!document.querySelector('.drawer [data-edit]') }));
await js(() => ZD.closeCard());

// настройка: таблица заданий, панель, окна; новая редакция с будущей датой через окно
await js(() => { ZD.setViewer('E4'); ZD.go('settings'); ZD.setSettingsTab('tasks'); });
await shot('04-settings-tasks');
await page.click('tr[data-r="rule-ap-stuck-new"]');
await page.waitForSelector('.drawer[data-rule]');
await shot('05-rule-panel');
await page.click('.drawer [data-edit] >> text=Изменить');
await page.fill('input[type="number"]', '7');
await page.fill('input[type="date"]', '2026-10-10');
await page.fill('.dlg textarea, .dlg-mask textarea', 'приказ №40 от 01.09.2026');
await shot('06-rule-edit');
await page.click('text=Сохранить редакцией');
const pend = await js(() => ZD.pendingEdition(ZD.ruleForKind('ap-stuck-new'))?.n);
await shot('07-rule-pending');
await js(() => ZD.closeCard());

// выключение надзора: окно с основанием
await js(() => ZD.showRule(ZD.ruleRows().find(x => x.st === 'в действии' && x.k.genus === 'надзор').r.id));
await page.waitForSelector('.drawer[data-rule]');
await page.click('.drawer [data-edit] >> text=Выключить');
await shot('08-kind-off');
await js(() => { ZD.dialogCancel(); ZD.closeCard(); });

// подсветка: строка раскрыта, карточка объекта
await js(() => ZD.setSettingsTab('highlight'));
await shot('09-highlight');
const hl = await js(() => ZD.highlightsOn(ZD.state.today).filter(x => x.count).sort((a, b) => b.count - a.count)[0].kind);
await page.click(`tr[data-hl="${hl}"]`);
await shot('10-highlight-open');
await page.click('tr[data-hl-obj] button');
await shot('11-highlight-card');
await js(() => { ZD.closeCard(); ZD.toggleHl(ZD.state.hlOpen); });

// уведомления и окно сигнала
await js(() => ZD.setSettingsTab('notifs'));
await shot('12-notifs');
await page.click('tr[data-sig] >> text=Изменить');
await shot('13-signal');
await js(() => ZD.dialogCancel());

// журнал на 02.11: опрос, раскрытая ночь, поводы, доставка
await toDate('2026-11-02');
await js(() => { ZD.go('runs'); ZD.setRunsTab('poll'); });
await shot('14-runs-poll');
await page.click('tr[data-run] >> nth=0');
await shot('15-runs-night');
await page.click('tr[data-run] >> nth=0');
await js(() => document.querySelector('[data-delivery-empty]').scrollIntoView());
await shot('16-delivery-empty');
await js(() => ZD.setRunsTab('povods'));
await shot('17-povods');
await page.fill('#povQ', 'нарын');
await shot('18-povods-search');
await page.click('tr[data-p] >> nth=0');
await shot('19-povod-open');

await browser.close();
console.log(`ошибок консоли: ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
console.log(`горизонтальная прокрутка: ${wide.length ? wide.join(', ') : 'нет'}`);
console.log(`панель у исполнителя: вид ${reader.view}, кнопки правки ${reader.edit ? 'есть' : 'нет'}; ожидающая редакция после окна: ${pend ?? 'нет'}; снимки — ${OUT}`);
process.exit(errors.length || wide.length || reader.edit || reader.view !== 'queue' || pend !== 2 ? 1 : 0);
