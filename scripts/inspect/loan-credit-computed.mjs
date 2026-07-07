import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loansCredit',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

const pick=(el,props)=>{const cs=getComputedStyle(el);const o={};props.forEach(p=>o[p]=cs.getPropertyValue(p));return o;};
const FONT=['font-family','font-size','font-weight','line-height','color','letter-spacing'];
const BOX=['padding-top','padding-right','padding-bottom','padding-left','background-color','border-top-width','border-top-style','border-top-color','border-bottom-width','border-bottom-color','border-right-width','border-right-color','height'];

const r=await page.evaluate(({FONT,BOX})=>{
  const pick=(el,props)=>{if(!el)return null;const cs=getComputedStyle(el);const o={};props.forEach(p=>o[p]=cs.getPropertyValue(p));return o;};
  const out={};
  // grid host
  const grid=document.querySelector('vaadin-grid');
  out.gridHost=pick(grid,[...BOX]);
  // header cell (shadow) — vaadin uses [part~=header-cell]
  const shadow=grid.shadowRoot;
  const hcell=shadow&&shadow.querySelector('[part~="header-cell"]');
  out.headerCellPart=pick(hcell,[...BOX]);
  // header cell content (light dom slotted)
  const hc=document.querySelector('vaadin-grid-cell-content');
  out.headerContent=pick(hc,[...FONT,...BOX]);
  // body cell part (shadow)
  const bcell=shadow&&shadow.querySelector('[part~="body-cell"]');
  out.bodyCellPart=pick(bcell,[...BOX]);
  // a body content cell (12th cell-content = first data cell)
  const contents=[...document.querySelectorAll('vaadin-grid-cell-content')];
  out.bodyContent=pick(contents[11],[...FONT]);
  // row height
  const brow=shadow&&shadow.querySelector('[part~="row"]:not([part~="header-cell"])');
  out.rowHeight = brow?Math.round(brow.getBoundingClientRect().height):null;
  const hrow=shadow&&shadow.querySelector('thead tr, [part~="header-cell"]');
  out.headerRowHeight = hcell?Math.round(hcell.getBoundingClientRect().height):null;
  out.bodyRowHeight = bcell?Math.round(bcell.getBoundingClientRect().height):null;
  // css custom props on grid affecting look
  const gcs=getComputedStyle(grid);
  out.vars={
    '--lumo-font-family':gcs.getPropertyValue('--lumo-font-family'),
    '--lumo-font-size-m':gcs.getPropertyValue('--lumo-font-size-m'),
    '--lumo-font-size-s':gcs.getPropertyValue('--lumo-font-size-s'),
    '--lumo-body-text-color':gcs.getPropertyValue('--lumo-body-text-color'),
    '--lumo-header-text-color':gcs.getPropertyValue('--lumo-header-text-color'),
    '--lumo-contrast-10pct':gcs.getPropertyValue('--lumo-contrast-10pct'),
    '--lumo-contrast-20pct':gcs.getPropertyValue('--lumo-contrast-20pct'),
    '--lumo-base-color':gcs.getPropertyValue('--lumo-base-color'),
    '--lumo-primary-color':gcs.getPropertyValue('--lumo-primary-color'),
  };
  // filter summary
  const fs=document.querySelector('vaadin-details-summary');
  out.filterSummary=pick(fs,[...FONT]);
  // toolbar green button
  const gb=[...document.querySelectorAll('vaadin-button')].find(b=>b.textContent.trim()==='Обновить');
  out.greenBtn=pick(gb,[...FONT,'background-color','border-radius','height','padding-left','padding-right']);
  // "Добавить условие поиска" link
  const link=[...document.querySelectorAll('vaadin-button')].find(b=>/Добавить условие/.test(b.textContent));
  out.link=pick(link,[...FONT]);
  // sidebar item
  const nav=[...document.querySelectorAll('a,span,div')].find(e=>e.textContent.trim()==='Users');
  out.navItem=pick(nav,[...FONT]);
  return out;
},{FONT,BOX});
console.log(JSON.stringify(r,null,1));
await ctx.close();
