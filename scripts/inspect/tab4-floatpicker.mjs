import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Штраф/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);

// flip основная-сумма type → Диапазон
const s0=await page.evaluate(()=>{const s=[...document.querySelectorAll('vaadin-select')].filter(e=>e.getBoundingClientRect().width>0)[0];const r=s.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
await page.mouse.click(s0.x,s0.y); await page.waitForTimeout(700);
await page.evaluate(()=>{const it=[...document.querySelectorAll('vaadin-select-item,vaadin-item')].find(i=>/Диапазон/i.test(i.innerText)&&i.getBoundingClientRect().width>0);it&&it.click();});
await page.waitForTimeout(1200);

// locate the «Тип плавающей штрафной ставки» picker, find its ••• action button rect
const act=await page.evaluate(()=>{const p=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0)[0];if(!p)return null;
  const actions=p.querySelector('[slot=actions]');const btns=actions?[...actions.children]:[];const open=btns[0];const r=(open||p).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,n:btns.length};});
log('ACTION_BTN:',JSON.stringify(act));
if(act){ await page.mouse.click(act.x,act.y); await page.waitForTimeout(1800); }
const dlg=await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-overlay')].filter(o=>o.getBoundingClientRect().width>200).pop();
  if(!ov)return null;
  const txt=ov.innerText.split('\n').map(s=>s.trim()).filter(Boolean);
  const grid=ov.querySelector('vaadin-grid');
  const cells=grid?[...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(t=>t&&t.length<80):[];
  return {topText:txt.slice(0,8),cells:cells.slice(0,80)};
});
log('PICKER_DIALOG:',JSON.stringify(dlg,null,1));
await page.screenshot({path:'.auth/live-tab4-picker-dialog.png',fullPage:true});
// close dialog
await page.keyboard.press('Escape'); await page.waitForTimeout(600);

// now flip проценты type → Диапазон, confirm its float fields (symmetry check)
const s1=await page.evaluate(()=>{const arr=[...document.querySelectorAll('vaadin-select')].filter(e=>e.getBoundingClientRect().width>0);const s=arr[arr.length-1];const r=s.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
await page.mouse.click(s1.x,s1.y); await page.waitForTimeout(700);
await page.evaluate(()=>{const it=[...document.querySelectorAll('vaadin-select-item,vaadin-item')].find(i=>/Диапазон/i.test(i.innerText)&&i.getBoundingClientRect().width>0);it&&it.click();});
await page.waitForTimeout(1200);
const intRange=await page.evaluate(()=>[...document.querySelectorAll('jmix-value-picker,vaadin-big-decimal-field')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName.toLowerCase(),label:(e.label||'').trim()||null,y:Math.round(r.top)};}).sort((a,b)=>a.y-b.y));
log('INTEREST_RANGE_FIELDS:',JSON.stringify(intRange,null,1));
await page.screenshot({path:'.auth/live-tab4-interest-range.png',fullPage:true});
await ctx.close();
