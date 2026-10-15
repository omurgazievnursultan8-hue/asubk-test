// Где на новом стенде используются бланки: кредитная программа, заявка, кредит, заёмщик.
// Открывает первую запись каждого списка, проходит все вкладки и собирает строки и кнопки
// со словами «шаблон / печат / бланк / договор / сформир / pdf / docx».
//   node scripts/inspect/blanks-consumers.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { open, go, dump } from './app-lib.mjs';

const OUT = '.auth/blanks';
mkdirSync(OUT, { recursive: true });
const { ctx, page } = await open();
await page.setViewportSize({ width: 1920, height: 1080 });
const RX = /шаблон|печат|бланк|договор|сформир|pdf|docx|выгруз|скачать/i;

const grep = () => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const d = document.querySelector('[slot=drawer]');
  let t = document.body.innerText; if (d) t = t.replace(d.innerText, '');
  const lines = [...new Set(t.split('\n').map(s => s.trim()).filter(s => s && rx.test(s)))];
  const btns = [...document.querySelectorAll('vaadin-button, vaadin-menu-bar-item, vaadin-menu-bar-button, vaadin-context-menu-item')]
    .filter(b => (!d || !d.contains(b)) && b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText || b.title || '').trim() + (b.hasAttribute('disabled') ? ' [off]' : '')).filter(Boolean);
  return { lines, btns: [...new Set(btns)] };
}, RX.source);

const openFirst = async () => {
  const cell = page.locator('vaadin-grid:visible vaadin-grid-cell-content').filter({ hasText: /\S/ }).nth(0);
  // первая непустая ячейка данных (заголовки тоже cell-content — берём ячейку ниже них)
  const slot = await page.evaluate(() => {
    const g = [...document.querySelectorAll('vaadin-grid')].find(x => x.getBoundingClientRect().width > 0);
    const tr = [...g.shadowRoot.querySelectorAll('#items tr')].find(tr => !tr.hidden && tr.index >= 0);
    const slots = [...tr.querySelectorAll('td slot')].map(s => s.name);
    const s = slots.find(n => (g.querySelector(`[slot="${n}"]`)?.innerText || '').trim());
    document.querySelectorAll('vaadin-grid[data-qa]').forEach(x => x.removeAttribute('data-qa'));
    g.dataset.qa = 'cur';
    return s;
  });
  const c = page.locator(`vaadin-grid[data-qa=cur] > [slot="${slot}"]`);
  await c.dblclick(); await page.waitForTimeout(3000);
  if (!/\/\d|\/[0-9a-f-]{36}/.test(page.url())) {
    await c.click(); await page.waitForTimeout(600);
    for (const name of ['Просмотр', 'Открыть', 'Изменить']) {
      const b = page.getByRole('button', { name, exact: true });
      if (await b.count() && await b.first().isEnabled()) { await b.first().click(); await page.waitForTimeout(3000); break; }
    }
  }
};

const report = {};
for (const route of ['loan-programs', 'loan-applications', 'loansCredit', 'borrowers']) {
  console.log(`\n==================== ${route} ====================`);
  await go(page, route);
  const list = await grep();
  console.log('LIST:', JSON.stringify(list));
  await openFirst();
  console.log('CARD URL:', page.url());
  const rec = report[route] = { list, url: page.url(), tabs: {} };
  const tabs = await page.locator('vaadin-tab:visible').allInnerTexts();
  rec.tabNames = tabs;
  console.log('TABS:', JSON.stringify(tabs));
  rec.tabs['(шапка)'] = await grep();
  console.log('(шапка):', JSON.stringify(rec.tabs['(шапка)']));
  for (let i = 0; i < tabs.length; i++) {
    await page.locator('vaadin-tab:visible').nth(i).click().catch(() => {});
    await page.waitForTimeout(1500);
    // раскрыть секции
    await page.evaluate(() => document.querySelectorAll('vaadin-details:not([opened])').forEach(d => d.opened = true));
    await page.waitForTimeout(500);
    const g = await grep();
    rec.tabs[tabs[i]] = g;
    if (g.lines.length) console.log(`[${tabs[i]}] lines:`, JSON.stringify(g.lines));
    if (/документ|шаблон|печат/i.test(tabs[i])) {
      await page.screenshot({ path: `${OUT}/consumer-${route}-tab${i}.png`, fullPage: true });
      rec.tabs[tabs[i]].dump = await dump(page);
      console.log(`[${tabs[i]}] grids:`, JSON.stringify(rec.tabs[tabs[i]].dump.grids).slice(0, 2500));
    }
  }
  console.log('ALL BUTTONS:', JSON.stringify([...new Set(Object.values(rec.tabs).flatMap(t => t.btns))]));
  // меню-кнопки «···» / «Печать» в шапке
  for (const name of ['Печатные формы', 'Печать', 'Документы', 'Сформировать']) {
    const b = page.locator('vaadin-button:visible, vaadin-menu-bar-button:visible', { hasText: name });
    if (await b.count()) {
      await b.first().click().catch(() => {}); await page.waitForTimeout(1200);
      const items = await page.evaluate(() => [...document.querySelectorAll('vaadin-menu-bar-item, vaadin-context-menu-item, vaadin-item')]
        .filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim()));
      console.log(`MENU «${name}»:`, JSON.stringify(items));
      rec[`menu_${name}`] = items;
      await page.screenshot({ path: `${OUT}/consumer-${route}-menu.png` });
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    }
  }
}
writeFileSync(`${OUT}/blanks-consumers.json`, JSON.stringify(report, null, 1));
await ctx.close();
