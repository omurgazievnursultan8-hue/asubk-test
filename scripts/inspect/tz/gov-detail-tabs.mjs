// Открыть СОХРАНЁННОЕ решение и снять реальные вкладки detail + подгриды.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel:'chrome', headless:true, ignoreHTTPSErrors:true, viewport:{width:1700,height:1100} });
const page = ctx.pages()[0] || await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){ await page.fill('input[name=username]','admin'); await page.fill('input[name=password]','admin'); await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]); await page.waitForTimeout(2500); }
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(2500);

const PIERCE=()=>{ window.__qsa=(sel)=>{const out=[];(function w(r){r.querySelectorAll(sel).forEach(e=>out.push(e));r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot);});})(document);return out;}; };
await page.evaluate(PIERCE);
// напечатать тексты ячеек грида с координатами, чтобы выбрать строку данных
const cells = await page.evaluate(()=>window.__qsa('vaadin-grid-cell-content').map(e=>{const r=e.getBoundingClientRect();return {t:e.innerText.trim().slice(0,30),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width)};}).filter(c=>c.w>0));
log('CELLS:',JSON.stringify(cells.slice(0,40),null,0));
// найти ячейку с датой dd.mm.yyyy — это строка данных
const dataCell = cells.find(c=>/\d{2}\.\d{2}\.\d{4}/.test(c.t)) || cells.find(c=>c.y>250 && c.t);
log('dataCell:',JSON.stringify(dataCell));
if(dataCell){ await page.mouse.click(dataCell.x+8, dataCell.y+6); await page.waitForTimeout(800); }
await page.evaluate(PIERCE);
const btns = await page.evaluate(()=>window.__qsa('vaadin-button').filter(b=>b.getBoundingClientRect().width>0).map(b=>({t:b.innerText.trim(),dis:b.disabled})));
log('TOOLBAR BTNS:',JSON.stringify(btns));
const clicked = await page.evaluate(()=>{ const b=window.__qsa('vaadin-button').find(x=>/Просмотр|Изменить/.test(x.innerText)&&x.getBoundingClientRect().width>0&&!x.disabled); if(b){b.click();return b.innerText.trim();} return null; });
log('clicked:',clicked);
await page.waitForTimeout(3500);
log('URL after open:',page.url());
await page.screenshot({path:'.auth/gov-detail-full.png',fullPage:true});

await page.evaluate(PIERCE);
const tabs = await page.evaluate(()=>window.__qsa('vaadin-tab,[role=tab]').map(t=>t.innerText.trim()).filter(Boolean));
log('TABS:',JSON.stringify(tabs));

// по каждой вкладке: подгриды (заголовки колонок) + picker/select-поля
const tabEls = await page.evaluate(()=>window.__qsa('vaadin-tab,[role=tab]').length);
const perTab={};
for(let i=0;i<Math.max(tabEls,1);i++){
  await page.evaluate((idx)=>{ const t=window.__qsa('vaadin-tab,[role=tab]')[idx]; if(t) t.click(); }, i);
  await page.waitForTimeout(1400);
  await page.evaluate(PIERCE);
  const data = await page.evaluate(()=>{
    const fields=window.__qsa('jmix-value-picker,vaadin-combo-box,vaadin-select,vaadin-multi-select-combo-box').filter(e=>e.getBoundingClientRect().width>0).map(el=>({tag:el.tagName.toLowerCase(),label:el.label||el.getAttribute('aria-label')||null}));
    const grids=window.__qsa('vaadin-grid').filter(g=>g.getBoundingClientRect().width>0).map(g=>{const cols=[];(function w(r){r.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column,vaadin-grid-filter-column').forEach(c=>{const h=c.getAttribute('header')||c.path||'';if(h)cols.push(h);});r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot);});})(g);return cols;});
    return {fields,grids};
  });
  perTab[tabs[i]||('tab'+i)]=data;
  await page.screenshot({path:`.auth/gov-detail-tab-${i}.png`,fullPage:true});
}
writeFileSync('.auth/gov-detail-tabs.json',JSON.stringify({url:page.url(),tabs,perTab},null,1));
log('PER-TAB:',JSON.stringify(perTab,null,1));
await ctx.close();
