import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Процентные ставки/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);
await page.evaluate(()=>{const c=document.querySelector('vaadin-checkbox');if(c){const i=c.shadowRoot?.querySelector('input');(i||c).click();}});
await page.waitForTimeout(1800);
// precise pairing: for each new field, read the label element directly ABOVE it (closest top text) and its own tag
const pairs=await page.evaluate(()=>{
  const TAGS=['vaadin-big-decimal-field','jmix-value-picker','vaadin-number-field','vaadin-integer-field','vaadin-select','vaadin-combo-box'];
  const fields=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().top>460);
  // all candidate label texts on panel
  const texts=[...document.querySelectorAll('label,span,div')].filter(e=>!e.childElementCount&&e.innerText&&e.innerText.trim()&&e.innerText.trim().length<60).map(e=>{const r=e.getBoundingClientRect();return {t:e.innerText.trim(),x:r.left,y:r.top,bottom:r.bottom};});
  return fields.map(f=>{const r=f.getBoundingClientRect();
    // label = text whose bottom is just above field top, x roughly aligned
    const cand=texts.filter(t=>t.bottom<=r.top+6 && t.bottom>r.top-40 && Math.abs(t.x-r.left)<60).sort((a,b)=>b.bottom-a.bottom)[0];
    return {tag:f.tagName.toLowerCase(),y:Math.round(r.top),label:cand?cand.t:null};
  });
});
log('PAIRS:',JSON.stringify(pairs,null,1));
// open the jmix-value-picker (••• of the floating field) to see refbook
const pk=await page.evaluate(()=>{const p=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().top>460)[0];if(!p)return null;const r=p.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};});
log('PICKER GEOM:',JSON.stringify(pk));
if(pk){ await page.mouse.click(pk.x+pk.w-58, pk.y+Math.round(pk.h/2)); await page.waitForTimeout(1600);
  const dlg=await page.evaluate(()=>{const d=document.querySelector('vaadin-dialog-overlay');if(!d)return{open:false};const title=(d.querySelector('[slot=title]')?.innerText||d.innerText.split('\n')[0]||'').trim();const grid=d.querySelector('vaadin-grid');const cells=grid?[...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,30):[];const pager=(d.innerText.match(/\d+\s+строк[аи]?/)||[''])[0];const btns=[...d.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);const search=!!d.querySelector('input[type=text],vaadin-text-field');return {open:true,title,pager,cells,btns,search};});
  log('FLOAT PICKER MODAL:',JSON.stringify(dlg,null,1));
}
await page.screenshot({path:'.auth/t3-float2.png',fullPage:true});
await ctx.close();
