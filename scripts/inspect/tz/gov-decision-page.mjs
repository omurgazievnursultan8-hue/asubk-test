// scripts/inspect/tz/gov-decision-page.mjs
// Что РЕАЛЬНО на странице «Решение правительства»: вкладки + picker/select-поля +
// под-гриды (документы/пакеты/получатели). Цель — увидеть, какие справочники
// потребляются именно тут, без опоры на 08-spravochniki.md.
// Вывод: .auth/gov-decision-page.json + скрины .auth/gov-page-*.png
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

// piercing querySelectorAll через shadow DOM
const PIERCE = () => {
  window.__qsa = (sel) => {
    const out = [];
    (function walk(root){
      root.querySelectorAll(sel).forEach(e=>out.push(e));
      root.querySelectorAll('*').forEach(e=>{ if(e.shadowRoot) walk(e.shadowRoot); });
    })(document);
    return out;
  };
};

// открыть форму создания решения напрямую — показывает структуру сущности (вкладки/подгриды)
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
log('URL:', page.url());
await page.screenshot({ path: '.auth/gov-page-detail.png', fullPage: true });

// перечислить вкладки
await page.evaluate(PIERCE);
const tabs = await page.evaluate(() => window.__qsa('vaadin-tab').map(t=>t.innerText.trim()).filter(Boolean));
log('TABS:', JSON.stringify(tabs));

function dumpFields(){
  return page.evaluate(() => {
    const TAGS = ['jmix-value-picker','vaadin-combo-box','vaadin-select','vaadin-multi-select-combo-box'];
    const fields = window.__qsa(TAGS.join(',')).filter(e=>e.getBoundingClientRect().width>0).map(el=>({
      tag: el.tagName.toLowerCase(),
      label: el.label ?? el.getAttribute('aria-label') ?? null,
    }));
    // под-гриды: заголовки колонок видимых грид
    const grids = window.__qsa('vaadin-grid').filter(g=>g.getBoundingClientRect().width>0).map(g=>{
      const cols = [];
      (function walk(root){ root.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column').forEach(c=>{
        const h = c.getAttribute('header') || c.path || ''; if(h) cols.push(h); });
        root.querySelectorAll('*').forEach(e=>{ if(e.shadowRoot) walk(e.shadowRoot); });
      })(g);
      return cols;
    });
    return { fields, grids };
  });
}

const perTab = {};
const tabEls = await page.$$('vaadin-tab');
if(tabEls.length){
  for(let i=0;i<tabEls.length;i++){
    try{ await tabEls[i].click({timeout:1500}); }catch{}
    await page.waitForTimeout(1500);
    await page.evaluate(PIERCE);
    perTab[tabs[i]||('tab'+i)] = await dumpFields();
    await page.screenshot({ path: `.auth/gov-page-tab-${i}.png`, fullPage: true });
  }
} else {
  perTab['(no tabs)'] = await dumpFields();
}

writeFileSync('.auth/gov-decision-page.json', JSON.stringify({ url: page.url(), tabs, perTab }, null, 1));
log('PER-TAB:', JSON.stringify(perTab, null, 1));
await ctx.close();
