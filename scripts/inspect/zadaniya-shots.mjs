// Визуальная проверка макета «Заданий» в браузере: реестры (род, рубильник, редакции правила), «решить по поводам»,
// блок «Откуда задание». Открывает mockups/zadaniya/zadaniya.html с диска, ловит ошибки консоли, снимки — в .auth/zadaniya/.
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
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(HTML);
const shot = async name => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const js = (fn, arg) => page.evaluate(fn, arg);

// ручной режим у надзора — прогон — «решить по поводам» у автора
await js(() => { ZD.editRule('rule-org-head-vacant', { mode: 'ручной' }, { by: 'E4', basis: 'приказ №12' }); ZD.runPoll(); ZD.setViewer('E16'); ZD.go('queue'); });
await shot('1-queue-decide');
const decideId = await js(() => ZD.state.tasks.find(t => t.decide).id);
await js(id => ZD.openCard(id), decideId);
await shot('2-card-decide');
await page.click('text=Поручить выбранные');
await js(() => ZD.closeCard());

// карточка задания по правилу — «Откуда задание»
const gdId = await js(() => ZD.state.tasks.find(t => t.originKind === 'gd-review').id);
await js(id => { ZD.setViewer('E4'); ZD.openCard(id); }, gdId);
await shot('3-card-origin');
await page.click('text=Открыть правило в реестре');
await shot('4-rules-history');

// новая редакция через форму, с будущей датой
await page.fill('#reDueN', '7');
await page.fill('#reFrom', '2026-09-10');
await page.fill('#reBasis', 'приказ №40 от 01.09.2026');
await page.click('text=Сохранить редакцией');
const pend = await js(() => ZD.pendingEdition(ZD.ruleForKind('gd-review'))?.n);
await shot('5-rules-pending');

// виды повода: род и рубильник; не администратор — только чтение
await js(() => ZD.setSettingsTab('kinds'));
await shot('6-kinds-admin');
await js(() => ZD.setViewer('E7'));
await shot('7-kinds-readonly');

await browser.close();
console.log(`ошибок консоли: ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
console.log(`ожидающая редакция после формы: ${pend ?? 'нет'}; снимки — ${OUT}`);
process.exit(errors.length || pend !== 2 ? 1 : 0);
