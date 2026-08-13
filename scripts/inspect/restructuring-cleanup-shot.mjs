// Чистка шума в карточке заявки на реструктуризацию (волна 11.08.2026).
// Обходит вкладки карточки на четырёх заявках, снимает оставшиеся подсказки,
// плашки и служебные ярлыки, считает их объём и пишет PNG.
//   node scripts/inspect/restructuring-cleanup-shot.mjs [путь-к-html]
// Второй аргумент-путь позволяет прогнать ту же мерку по версии ДО волны
// (git show HEAD:mockups/restructuring/restructuring.html > /tmp/before.html).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const HTML = process.argv[2] || 'mockups/restructuring/restructuring.html';
const SHOTS = !process.argv[2];
const OUT = '.auth/rs-cleanup';
if (SHOTS) mkdirSync(OUT, { recursive: true });

// Вкладки «Охват» нет с 13.08.2026 — охват предъявляется полосой расчётов над панелью.
const TABS = ['Пакет документов','Заключения','База и распоряжения','График и дифф','Комитет и решение','Оформление','История'];
const IDS = ['RS-1001','RS-1004','RS-1017','RS-1020'];   // ДС зарегистрировано · анализ · комитет · проект решения КМ

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1400 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve(HTML)).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

const open = async (id, tab) => {
  await page.evaluate(i => RS.openApp(i), id);
  await page.evaluate(t => { const b=[...document.querySelectorAll('.dtab')].find(x=>x.textContent.trim()===t); b&&b.click(); }, tab);
  await page.waitForTimeout(150);
};
const snap = () => page.evaluate(() => {
  const host = document.querySelector('#view-card') || document.body;
  const txt = el => el.innerText.replace(/\s+/g,' ').trim();
  return {
    notes:  [...host.querySelectorAll('.section-note')].map(txt),
    infos:  [...host.querySelectorAll('.infoline')].map(txt),
    tags:   [...host.querySelectorAll('.mode-tag, .ro-tag')].map(txt),
    ok:     [...host.querySelectorAll('.okline')].map(txt),
  };
});

let notes = 0, chars = 0;
for (const id of IDS) {
  for (const tab of TABS) {
    await open(id, tab);
    const s = await snap();
    notes += s.notes.length + s.infos.length;
    chars += [...s.notes, ...s.infos, ...s.ok].join(' ').length;
    console.log(`\n=== ${id} · ${tab} · подсказок ${s.notes.length + s.infos.length} · позитивных плашек ${s.ok.length} · ярлыков ${s.tags.length}`);
    s.notes.forEach(n => console.log('  note: ' + n));
    s.infos.forEach(n => console.log('  info: ' + n));
    if (SHOTS && id === 'RS-1001') await page.screenshot({ path: `${OUT}/${id}-${tab}.png`, fullPage: true });
  }
}

console.log(`\nИТОГО (${HTML}) подсказок ${notes} · знаков подсказок и плашек ${chars}`);
console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
