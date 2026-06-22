import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);

// scroll-collect all rows in the open dialog grid
async function collectGrid(){
  // column headers
  const meta=await page.evaluate(()=>{
    const d=document.querySelector('vaadin-dialog-overlay');const g=d?.querySelector('vaadin-grid');
    const title=(d.querySelector('[slot=title]')?.innerText||d.querySelector('h2,h3')?.innerText||'').trim();
    const headers=g?[...g.querySelectorAll('vaadin-grid-column')].map(c=>c.header||c.getAttribute('header')||c.path||''):[];
    const pager=(d.innerText.match(/\d+\s+строк[аи]?/)||[''])[0];
    return {title,headers,pager,hasGrid:!!g};
  });
  if(!meta.hasGrid) return meta;
  const seen=new Map();
  for(let step=0; step<40; step++){
    const done=await page.evaluate(()=>{
      const g=document.querySelector('vaadin-dialog-overlay vaadin-grid');
      const cells=[...g.querySelectorAll('vaadin-grid-cell-content')].filter(c=>c.getBoundingClientRect().height>0).map(c=>{const r=c.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),t:c.innerText.trim()};});
      window.__cells=cells;
      const sc=g.$?.table||g.shadowRoot?.querySelector('#table')||g.shadowRoot?.querySelector('[part=row]')?.parentElement;
      const before=sc?sc.scrollTop:0;
      if(sc) sc.scrollTop=before+600;
      const after=sc?sc.scrollTop:0;
      return {atEnd: after===before, scrollTop:after};
    });
    const cells=await page.evaluate(()=>window.__cells);
    cells.forEach(c=>{ const key=c.y+'|'+c.x; if(!seen.has(key)) seen.set(key,c); });
    await page.waitForTimeout(250);
    if(done.atEnd) break;
  }
  // group by y → rows, sort cols by x
  const byRow=new Map();
  for(const c of seen.values()){ if(!byRow.has(c.y)) byRow.set(c.y,[]); byRow.get(c.y).push(c); }
  const rows=[...byRow.entries()].sort((a,b)=>a[0]-b[0]).map(([y,cs])=>cs.sort((a,b)=>a.x-b.x).map(c=>c.t));
  return {...meta, rows};
}

async function openIcon(i){
  const ic=await page.evaluate((idx)=>{const ps=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0);const p=ps[idx];if(!p)return null;const icon=p.querySelector('vaadin-icon[slot=icon]')||p.querySelector('vaadin-icon');if(!icon)return null;const r=icon.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),label:(p.querySelector('label')?.innerText||'').trim()};},i);
  if(!ic) return null;
  await page.mouse.click(ic.x,ic.y); await page.waitForTimeout(1500);
  return ic;
}
async function closeDlg(){ await page.evaluate(()=>{const d=document.querySelector('vaadin-dialog-overlay');const c=d&&[...d.querySelectorAll('vaadin-button')].find(b=>/отмен/i.test(b.innerText));if(c)c.click();}); await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(700); }

const n=await page.evaluate(()=>[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0).length);
log('TAB1 PICKER COUNT:',n);
for(let i=0;i<n;i++){
  const ic=await openIcon(i);
  const data=await collectGrid();
  log(`\n### PICKER #${i} field="${ic?.label}"`);
  log(JSON.stringify(data));
  await closeDlg();
}
await ctx.close();
