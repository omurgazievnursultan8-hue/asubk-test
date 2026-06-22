import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
// open Отрасль picker (#3)
const ic=await page.evaluate(()=>{const ps=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0);const p=ps[3];const icon=p.querySelector('vaadin-icon[slot=icon]')||p.querySelector('vaadin-icon');const r=icon.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
await page.mouse.click(ic.x,ic.y);await page.waitForTimeout(1500);
const seen=new Map();
for(let s=0;s<120;s++){
  const r=await page.evaluate(()=>{const g=document.querySelector('vaadin-dialog-overlay vaadin-grid');const rows=[...g.shadowRoot.querySelectorAll('tr')];const out=[];rows.forEach(tr=>{const idx=tr.querySelector('td')?.getAttribute('part')?'':'';});
    // map cell-content by row via their assigned slot row index
    const cc=[...g.querySelectorAll('vaadin-grid-cell-content')].filter(c=>c.getBoundingClientRect().height>0).map(c=>{const b=c.getBoundingClientRect();return {y:Math.round(b.top),x:Math.round(b.left),t:c.innerText.trim()};});
    const sc=g.shadowRoot.querySelector('#table');const before=sc.scrollTop;sc.scrollTop=before+220;return {cc,before,after:sc.scrollTop};});
  r.cc.forEach(c=>{const k=c.y+'|'+c.x;if(!seen.has(k))seen.set(k,c);});
  await page.waitForTimeout(200);
  if(r.after===r.before) break;
}
const byRow=new Map();for(const c of seen.values()){if(!byRow.has(c.y))byRow.set(c.y,[]);byRow.get(c.y).push(c);}
let rows=[...byRow.entries()].sort((a,b)=>a[0]-b[0]).map(([y,cs])=>cs.sort((a,b)=>a.x-b.x).map(c=>c.t));
// dedupe by code (col index 1), drop header
const uniq=new Map();
for(const r of rows){ if(!r||r.length<2) continue; if(r[0]==='Наименование') continue; const code=r[1]; if(!uniq.has(code)) uniq.set(code,r); }
console.log('UNIQUE COUNT:',uniq.size);
console.log(JSON.stringify([...uniq.values()]));
await ctx.close();
