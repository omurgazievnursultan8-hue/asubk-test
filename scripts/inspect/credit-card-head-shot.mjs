// Визуальная проверка шапки карточки credit.html (шаг 2 слияния: шапка + плитки состояния).
// Открывает 4 показательных кредита: обычный, с оверлеем 181, валютный, неосвоенный/закрытый.
//   node scripts/inspect/credit-card-head-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/credit-merge';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1050 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

// выбрать показательные кредиты прямо из модели
const picks = await page.evaluate(() => {
  const d = CR.db.credits, D = CR.derive;
  const by = f => (d.find(f) || {}).id;
  return {
    ov:     by(c => c.mirror && c.mirror.restructuring && c.mirror.restructuring.active),
    fx:     by(c => c.currency !== 'KGS'),
    coll:   by(c => (c.mirror && c.mirror.collection || []).length),
    nodisb: by(c => D(c).disbursed === 0),
    closed: by(c => c.lifecycle === 'Закрыт'),
  };
});

const dump = async (id, tag) => {
  if (!id) return console.log(tag, '— нет подходящего кредита');
  await page.evaluate(i => CR.openDetail(i), id);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/head-${tag}.png`, clip: { x: 250, y: 90, width: 1420, height: 400 } });
  const name = await page.$eval('.phead-name', el => el.innerText.replace(/\s+/g, ' '));
  const sub  = await page.$eval('.phead-sub', el => el.innerText.replace(/\s+/g, ' '));
  const dims = await page.$$eval('.phead-dims .dim', ds => ds.map(x => x.innerText.replace(/\n/g, ' ⟩ ')));
  console.log(`\n── ${tag} (${id})`);
  console.log('  имя :', name);
  console.log('  под :', sub);
  dims.forEach(t => console.log('  •', t));
};

await dump(picks.ov, 'overlay181');
await dump(picks.fx, 'valuta');
await dump(picks.coll, 'vzyskanie');
await dump(picks.nodisb || picks.closed, 'neosvoen');

// меню печатных форм
const printOpened = await page.evaluate(() => {
  const b = document.querySelector('.phead-acts .split button'); if (!b) return null;
  b.click();
  const items = [...document.querySelectorAll('.phead-acts .split-menu button')].map(x => x.innerText.replace(/\s+/g, ' '));
  return { open: document.querySelector('.phead-acts .split').classList.contains('open'), items };
});
await page.screenshot({ path: `${OUT}/head-print.png`, clip: { x: 250, y: 90, width: 1420, height: 400 } });
console.log('\nПЕЧАТЬ :', JSON.stringify(printOpened, null, 0));

// клик мимо — меню должно закрыться
await page.click('.phead-name');
await page.waitForTimeout(120);
console.log('после клика мимо open =', await page.$eval('.phead-acts .split', el => el.classList.contains('open')));

console.log('\nERRORS :', errs.length ? errs : 'нет');
await ctx.close();
