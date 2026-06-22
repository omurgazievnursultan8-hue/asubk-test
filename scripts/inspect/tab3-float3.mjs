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
const own=await page.evaluate(()=>{
  const TAGS=['vaadin-big-decimal-field','jmix-value-picker','vaadin-number-field','vaadin-integer-field'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().top>460&&e.getBoundingClientRect().width>0).map(el=>{
    const r=el.getBoundingClientRect();
    const shadowLab=el.shadowRoot?.querySelector('[part=label],label')?.innerText?.trim();
    const lightLab=el.querySelector('label,[slot=label]')?.innerText?.trim();
    const aria=el.getAttribute('aria-label');
    const firstLine=(el.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean)[0];
    return {tag:el.tagName.toLowerCase(),y:Math.round(r.top),shadowLab,lightLab,aria,firstLine};
  });
});
log('OWN LABELS:',JSON.stringify(own,null,1));
// fix picker click: input row top
const pk=await page.evaluate(()=>{const p=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().top>460)[0];const r=p.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)};});
await page.mouse.click(pk.x+pk.w-58, pk.y+22);
await page.waitForTimeout(1700);
const dlg=await page.evaluate(()=>{const d=document.querySelector('vaadin-dialog-overlay');if(!d)return{open:false};const title=(d.querySelector('[slot=title]')?.innerText||d.innerText.split('\n')[0]||'').trim();const grid=d.querySelector('vaadin-grid');const cells=grid?[...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,30):[];const pager=(d.innerText.match(/\d+\s+строк[аи]?/)||[''])[0];const btns=[...d.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);return {open:true,title,pager,cells,btns};});
log('FLOAT PICKER MODAL:',JSON.stringify(dlg,null,1));
await page.screenshot({path:'.auth/t3-float3.png',fullPage:true});
await ctx.close();
