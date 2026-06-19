// Capture jmix-value-picker lookup dialogs across ALL wizard tabs.
// Based on the working tab-1 approach in lookups.mjs (force-click div[slot=actions],
// re-navigate between pickers), generalized to tabs 1..N.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation().catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}

async function gotoTab(t) {
  await page.goto(BASE + 'loan-programs/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const tabEls = await page.$$('vaadin-tab');
  if (t > 0 && tabEls[t]) { await tabEls[t].click(); await page.waitForTimeout(900); }
}

async function visiblePickers() {
  const pickers = await page.$$('jmix-value-picker');
  const vis = [];
  for (const p of pickers) { if (await p.isVisible()) vis.push(p); }
  return vis;
}

async function readDialog() {
  return await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay, vaadin-combo-box-overlay, [class*="overlay"][opened]');
    if (!ov) return { empty: true };
    const title = ov.querySelector('h2,[part="title"],[slot="title"]')?.textContent?.trim() || null;
    const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,80);
    const cbItems = [...ov.querySelectorAll('vaadin-combo-box-item')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,80);
    return { title, cells, cbItems };
  });
}

const tabEls0 = await (async () => { await gotoTab(0); return await page.$$eval('vaadin-tab', els => els.map(e=>e.innerText.trim())); })();
console.log('tabs:', JSON.stringify(tabEls0));

const ONLY = process.env.TAB ? parseInt(process.env.TAB, 10) - 1 : null; // 1-based env -> 0-based
const out = [];
for (let t = 0; t < tabEls0.length; t++) {
  if (ONLY !== null && t !== ONLY) continue;   // one fresh process per tab avoids browser memory crash
  await gotoTab(t);                       // ONE navigation per tab
  const count = (await visiblePickers()).length;
  console.log(`tab ${t+1} (${tabEls0[t]}): ${count} visible pickers`);
  for (let i = 0; i < count; i++) {
    await gotoTab(t);                      // reload per picker — only ~17 pickers total, resets overlay state
    const vis = await visiblePickers();
    const pk = vis[i]; if (!pk) { out.push({ tab: t+1, tabName: tabEls0[t], index: i, error: 'not found' }); continue; }
    try {
      const actBtn = await pk.evaluateHandle(el => el.querySelector('div[slot="actions"]')?.querySelector('vaadin-button,button,[role="button"]') || el.querySelector('div[slot="actions"]')?.firstElementChild);
      const el = actBtn.asElement();
      if (el) await el.click({ timeout: 5000, force: true }).catch(e=>console.log('  clickerr', String(e).slice(0,40)));
      await page.waitForTimeout(1300);
      const dlg = await readDialog();
      out.push({ tab: t+1, tabName: tabEls0[t], index: i, ...dlg });
      const preview = (dlg.cells||dlg.cbItems||[]).slice(0,10).join(' | ') || dlg.title || 'EMPTY';
      console.log(`  [${t+1}.${i}] ${dlg.title||'?'} => ${preview}`);
      // close overlay: Escape, then force-remove any leftover so next picker opens clean
      await page.keyboard.press('Escape').catch(()=>{});
      await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelectorAll('vaadin-dialog-overlay,vaadin-combo-box-overlay').forEach(o=>o.remove())).catch(()=>{});
      await page.waitForTimeout(150);
    } catch (e) { out.push({ tab: t+1, tabName: tabEls0[t], index: i, error: String(e).slice(0,80) }); console.log(`  [${t+1}.${i}] ERR`, String(e).slice(0,60)); await page.keyboard.press('Escape').catch(()=>{}); }
  }
  writeFileSync((ONLY !== null ? `.auth/lookups-tab${ONLY+1}.json` : '.auth/lookups-all.json'), JSON.stringify(out, null, 1)); // checkpoint per tab
}
writeFileSync((ONLY !== null ? `.auth/lookups-tab${ONLY+1}.json` : '.auth/lookups-all.json'), JSON.stringify(out, null, 1));
console.log('captured', out.length, 'pickers across', tabEls0.length, 'tabs');
await ctx.close();
