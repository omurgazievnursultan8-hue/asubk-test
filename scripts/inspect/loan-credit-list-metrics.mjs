import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loansCredit',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

// column widths (rendered px + flex/width attrs)
const cols=await page.evaluate(()=>{
  const g=document.querySelector('vaadin-grid');
  const cs=[...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')];
  return cs.map(c=>({header:c.getAttribute('path')||c.getAttribute('header')||'',
    width:c.getAttribute('width')||'', flex:c.getAttribute('flex-grow'),
    resizable:c.hasAttribute('resizable')}));
});
console.log('COLS:',JSON.stringify(cols,null,1));

// header cell rendered widths
const hw=await page.evaluate(()=>{
  const cells=[...document.querySelectorAll('vaadin-grid thead th, vaadin-grid [part~=header-cell]')];
  return cells.map(c=>Math.round(c.getBoundingClientRect().width));
});
console.log('HEADER PX WIDTHS:',JSON.stringify(hw));

// filter summary header — text + aria-expanded + icon
const filt=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('*')].filter(e=>e.children.length<=3 && /Фильтр/.test(e.textContent) && e.textContent.trim().length<20);
  const e=els[0];
  if(!e) return 'no filter el';
  const details=e.closest('vaadin-details')||e.closest('details');
  return {text:e.textContent.trim(), tag:e.tagName,
    expanded:details?details.hasAttribute('opened')||details.open:null,
    detailsTag:details?details.tagName:null};
});
console.log('FILTER:',JSON.stringify(filt));

// grid theme attrs (row stripes, borders)
const gridTheme=await page.evaluate(()=>{
  const g=document.querySelector('vaadin-grid');
  return {theme:g.getAttribute('theme')||'', class:g.className};
});
console.log('GRID THEME:',JSON.stringify(gridTheme));

// row height
const rh=await page.evaluate(()=>{
  const r=document.querySelector('vaadin-grid tr[part~=row], vaadin-grid [part~=body-cell]');
  return r?Math.round(r.getBoundingClientRect().height):null;
});
console.log('ROW HEIGHT:',rh);
await ctx.close();
