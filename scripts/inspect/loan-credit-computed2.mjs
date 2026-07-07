import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loansCredit',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
const r=await page.evaluate(()=>{
  const pick=(el,props)=>{if(!el)return null;const cs=getComputedStyle(el);const o={};props.forEach(p=>o[p]=cs.getPropertyValue(p));return o;};
  const out={};
  const grid=document.querySelector('vaadin-grid');const sh=grid.shadowRoot;
  // body cell content padding + box
  const contents=[...document.querySelectorAll('vaadin-grid-cell-content')];
  out.bodyContentBox=pick(contents[11],['padding-top','padding-right','padding-bottom','padding-left']);
  out.headerContentBox=pick(contents[0],['padding-top','padding-right','padding-bottom','padding-left','font-weight','font-size']);
  // body row + cell heights via bounding rect
  const bcells=[...sh.querySelectorAll('[part~="body-cell"]')];
  out.bodyCellRects=bcells.slice(0,3).map(c=>({h:Math.round(c.getBoundingClientRect().height)}));
  const bc=bcells[0];
  out.bodyCellBox=pick(bc,['border-bottom-width','border-bottom-color','border-right-width','border-right-color','padding-top','padding-bottom','background-color']);
  const rowpart=sh.querySelector('#items > tr, tbody tr');
  out.rowBox=pick(rowpart,['height','border-bottom-width','border-bottom-color']);
  out.rowRectH = rowpart?Math.round(rowpart.getBoundingClientRect().height):null;
  // header cell part box detail
  const hp=sh.querySelector('[part~="header-cell"]');
  out.headerCellBox=pick(hp,['height','border-bottom-width','border-bottom-color','background-color']);
  out.headerCellRectH=hp?Math.round(hp.getBoundingClientRect().height):null;
  // green refresh button: menu-bar button
  const mb=document.querySelector('vaadin-menu-bar-button, vaadin-menu-bar');
  const anyGreen=[...document.querySelectorAll('vaadin-button,vaadin-menu-bar-button')].find(b=>getComputedStyle(b).backgroundColor.match(/(46|76|175|0),\s*(1|2)/));
  const green=[...document.querySelectorAll('vaadin-button,vaadin-menu-bar-button')].map(b=>({t:b.textContent.trim().slice(0,12),bg:getComputedStyle(b).backgroundColor,color:getComputedStyle(b).color,h:Math.round(b.getBoundingClientRect().height),fs:getComputedStyle(b).fontSize,fw:getComputedStyle(b).fontWeight,br:getComputedStyle(b).borderRadius})).filter(x=>x.t);
  out.buttons=green;
  // app base font
  out.htmlFont=pick(document.documentElement,['font-size','font-family']);
  out.bodyFont=pick(document.body,['font-size']);
  // page title "Кредиты"
  const title=[...document.querySelectorAll('h1,h2,h3,span,div')].find(e=>e.textContent.trim()==='Кредиты'&&e.children.length===0);
  out.title=pick(title,['font-size','font-weight','color']);
  return out;
});
console.log(JSON.stringify(r,null,1));
await ctx.close();
