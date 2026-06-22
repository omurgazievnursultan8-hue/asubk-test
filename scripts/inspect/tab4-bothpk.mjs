import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Штрафы/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);
await page.evaluate(()=>{document.querySelectorAll('vaadin-select').forEach(s=>{s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));});});
await page.waitForTimeout(1600);
async function openPk(idx){
  const ic=await page.evaluate((i)=>{const ps=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0);const p=ps[i];if(!p)return null;const icon=p.querySelector('vaadin-icon[slot=icon]')||p.querySelector('vaadin-icon');const r=icon.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};},idx);
  if(!ic)return {none:true};
  await page.mouse.click(ic.x,ic.y);await page.waitForTimeout(1700);
  const d=await page.evaluate(()=>{const dl=document.querySelector('vaadin-dialog-overlay');if(!dl)return{open:false};const title=(dl.querySelector('[slot=title]')?.innerText||dl.querySelector('h2,h3')?.innerText||'').trim();const grid=dl.querySelector('vaadin-grid');const cols=grid?[...grid.querySelectorAll('vaadin-grid-column')].map(c=>c.header||c.getAttribute('header')||c.path):[];const cells=grid?[...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,30):[];const pager=(dl.innerText.match(/\d+\s+строк[аи]?/)||[''])[0];const btns=[...dl.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);return {open:true,title,pager,cols,cells,btns};});
  // close
  await page.evaluate(()=>{const dl=document.querySelector('vaadin-dialog-overlay');const c=dl&&[...dl.querySelectorAll('vaadin-button')].find(b=>/отмен/i.test(b.innerText));if(c)c.click();});
  await page.keyboard.press('Escape').catch(()=>{});await page.waitForTimeout(800);
  return d;
}
log('PICKER #0 (по осн. сумме):',JSON.stringify(await openPk(0),null,1));
log('PICKER #1 (по процентам):',JSON.stringify(await openPk(1),null,1));
await ctx.close();
