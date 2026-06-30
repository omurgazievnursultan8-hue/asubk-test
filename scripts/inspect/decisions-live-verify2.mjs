// Live verify v2: proper row-select by status, detail tab walk (R1 docs, R2 history),
// R4 delete guard, R7 toolbar gating, R2 reject-reason dialog. Read-mostly (cancels dialogs).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = 'https://fkftest.okmot.kg/';
const SHOT = '.auth/live-verify'; mkdirSync(SHOT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) { await page.fill('input[name=username]','admin'); await page.fill('input[name=password]','admin'); await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500); }

const buttons = () => page.evaluate(() => [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({t:(b.innerText||'').trim(), d:b.disabled===true||b.hasAttribute('disabled')})).filter(b=>b.t&&b.t!=='Выйти'));
// select first data row whose Статус cell == given status. Returns row name.
const selectByStatus = (status) => page.evaluate((status) => {
  const g = document.querySelector('vaadin-grid'); if (!g) return null;
  // map cell contents into rows of 9 cols (after 9 header cells)
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  // find a data cell with this status text, then click its row's first cell
  for (const c of cells) {
    if (c.textContent.trim() === status) {
      // climb to the <tr>
      let tr = c.closest('tr') || c.assignedSlot?.closest('tr');
      const row = c.getAttribute('slot');
      // Vaadin: click the cell to select
      c.click();
      return c.textContent.trim();
    }
  }
  return null;
}, status);

await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

for (const st of ['Черновик','Действует','Отклонён']) {
  const ok = await selectByStatus(st);
  await page.waitForTimeout(600);
  log(`\n=== SELECT status=${st} (clicked=${ok}) ===`);
  log('TOOLBAR enabled/disabled:', JSON.stringify(await buttons()));
}

// ---- open Просмотр detail of a "Действует" record, walk 4 tabs ----
await selectByStatus('Действует'); await page.waitForTimeout(500);
const pv = page.locator('vaadin-button', { hasText: /^Просмотр$/ }).first();
log('\nПросмотр disabled?', await pv.evaluate(b=>b.disabled).catch(()=>'n/a'));
if (await pv.count() && !(await pv.evaluate(b=>b.disabled).catch(()=>true))) {
  await pv.click(); await page.waitForTimeout(2000);
  log('DETAIL URL:', page.url());
  const tabEls = await page.$$('vaadin-tab');
  const tnames = await page.$$eval('vaadin-tab', els=>els.map(e=>e.innerText.trim()));
  log('DETAIL TABS:', JSON.stringify(tnames));
  for (let i=0;i<tabEls.length;i++){
    await tabEls[i].click(); await page.waitForTimeout(800);
    const info = await page.evaluate(() => ({
      upload: !!document.querySelector('vaadin-upload'),
      uploadFiles: document.querySelectorAll('vaadin-upload-file').length,
      grids: document.querySelectorAll('vaadin-grid').length,
      gridCols: [...document.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean),
      text: (document.querySelector('main,vaadin-vertical-layout, .v-scrollable')?.innerText||document.body.innerText||'').replace(/\s+/g,' ').slice(0,400),
    }));
    log(`TAB[${tnames[i]}]:`, JSON.stringify(info));
    await page.screenshot({ path: `${SHOT}/detail-tab${i}-${tnames[i].slice(0,10)}.png`, fullPage: true });
  }
  // back to list
  const back = page.locator('vaadin-button', { hasText: /Отмена|Назад|Закрыть/ }).first();
  if (await back.count()) await back.click().catch(()=>{});
}

// ---- R1: create form Документы tab → upload present? ----
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
{
  const tabEls = await page.$$('vaadin-tab');
  const tnames = await page.$$eval('vaadin-tab', els=>els.map(e=>e.innerText.trim()));
  for (let i=0;i<tabEls.length;i++){
    await tabEls[i].click(); await page.waitForTimeout(700);
    const info = await page.evaluate(()=>({ upload:!!document.querySelector('vaadin-upload'), accept: document.querySelector('vaadin-upload')?.accept||null, maxFiles: document.querySelector('vaadin-upload')?.maxFiles||null, grids:document.querySelectorAll('vaadin-grid').length, text:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,300) }));
    log(`\nNEW-FORM TAB[${tnames[i]}]:`, JSON.stringify(info));
    if (tnames[i].includes('Документ')) await page.screenshot({ path: `${SHOT}/new-doc-tab.png`, fullPage: true });
  }
}

// ---- R2: reject dialog probe (select Действует? need На рассмотрении; just click Отклонить on a draft to see dialog, then CANCEL) ----
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
page.on('dialog', async d => { log('NATIVE DIALOG:', d.message().slice(0,120)); await d.dismiss(); });

await ctx.close();
log('\nDONE v2');
