import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
const result = { selects: [], multicombos: [], lookups: [] };
const tabEls = await page.$$('vaadin-tab');

for (let t = 0; t < tabEls.length; t++) {
  await tabEls[t].click();
  await page.waitForTimeout(700);

  // ---- vaadin-select: open, read overlay items ----
  const selects = await page.$$('vaadin-select');
  const visSel = [];
  for (const s of selects) { if (await s.isVisible()) visSel.push(s); }
  for (let i = 0; i < visSel.length; i++) {
    try {
      await visSel[i].click();
      await page.waitForTimeout(400);
      const items = await page.evaluate(() => {
        const ov = document.querySelector('vaadin-select-overlay');
        if (!ov) return [];
        return [...ov.querySelectorAll('vaadin-item, vaadin-select-item')].map(x => x.textContent.trim());
      });
      const selected = await visSel[i].evaluate(el => el.shadowRoot?.querySelector('[part="value"]')?.textContent?.trim() || null);
      result.selects.push({ tab: t + 1, tabName: tabs[t], index: i, selected, items });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (e) { result.selects.push({ tab: t + 1, index: i, error: String(e).slice(0,80) }); }
  }

  // ---- multi-select-combo-box: read items ----
  const combos = await page.$$('vaadin-multi-select-combo-box');
  for (let i = 0; i < combos.length; i++) {
    if (!(await combos[i].isVisible())) continue;
    try {
      const items = await combos[i].evaluate(el => (el.items || el.filteredItems || []).map(x => typeof x==='string'?x:(x.label??x.value??JSON.stringify(x))).slice(0,30));
      result.multicombos.push({ tab: t + 1, index: i, items });
    } catch (e) {}
  }

  // ---- jmix-value-picker: open lookup dialog, read title+columns+rows ----
  const pickers = await page.$$('jmix-value-picker');
  const visPk = [];
  for (const p of pickers) { if (await p.isVisible()) visPk.push(p); }
  for (let i = 0; i < visPk.length; i++) {
    try {
      // click the ••• open button inside the picker
      const btn = await visPk[i].$('vaadin-button, [slot="suffix"] vaadin-button, button');
      if (btn) await btn.click(); else await visPk[i].click();
      await page.waitForTimeout(900);
      const dlg = await page.evaluate(() => {
        const ov = document.querySelector('vaadin-dialog-overlay');
        if (!ov) return null;
        const title = ov.querySelector('[slot="title"], h2, [part="title"]')?.textContent?.trim() || null;
        const cols = [...ov.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')].map(c => c.header || c.path || '').filter(Boolean);
        const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim()).filter(Boolean).slice(0, 24);
        return { title, cols, cells };
      });
      result.lookups.push({ tab: t + 1, tabName: tabs[t], index: i, ...(dlg || { empty: true }) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      // ensure any leftover overlay closed
      await page.evaluate(() => document.querySelector('vaadin-dialog-overlay')?.remove());
    } catch (e) { result.lookups.push({ tab: t + 1, index: i, error: String(e).slice(0,100) }); await page.keyboard.press('Escape').catch(()=>{}); }
  }
  console.log(`Tab ${t+1}: selects=${visSel.length} combos done lookups=${visPk.length}`);
}

writeFileSync('.auth/deep.json', JSON.stringify(result, null, 1));
console.log('done; selects=%d combos=%d lookups=%d', result.selects.length, result.multicombos.length, result.lookups.length);
await ctx.close();
