// Verify «Статус кредита» combo options on loan-credits/25 (tab «Общая информация»).
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const USER=process.env.OK_USER||'admin';
const PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/25',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(4000);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>t.textContent.trim()==='Общая информация');if(t)t.click();});
await page.waitForTimeout(1500);

const clean=s=>(s||'').replace(/\s+/g,' ').trim();

// DIAGNOSTIC: dump all field-like elements whose label/text mentions "Статус"
const diag=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const tags=['vaadin-combo-box','vaadin-select','jmix-value-picker','vaadin-text-field','jmix-combo-box'];
  const out=[];
  for(const t of tags){
    for(const e of document.querySelectorAll(t)){
      if(e.getBoundingClientRect().width===0)continue;
      const lbl=clean(e.getAttribute('label')||e.querySelector('label')?.textContent);
      out.push({tag:t,label:lbl,value:e.getAttribute('value')||(e.inputElement&&e.inputElement.value)||''});
    }
  }
  return out;
});
console.log('FIELDS:',JSON.stringify(diag,null,0));

// find element whose label === 'Статус кредита'
const target=diag.find(d=>d.label==='Статус кредита');
console.log('TARGET FIELD:',JSON.stringify(target));

// Try to open whichever element has that label, regardless of tag
const info=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const tags=['vaadin-combo-box','vaadin-select','jmix-value-picker','jmix-combo-box'];
  for(const t of tags){
    for(const e of document.querySelectorAll(t)){
      const lbl=clean(e.getAttribute('label')||e.querySelector('label')?.textContent);
      if(lbl==='Статус кредита'){
        e.scrollIntoView({block:'center'});
        const r=e.getBoundingClientRect();
        return {tag:t,x:Math.round(r.left+r.width-16),y:Math.round(r.top+r.height/2),display:e.inputElement?e.inputElement.value:''};
      }
    }
  }
  return null;
});
console.log('OPEN INFO:',JSON.stringify(info));
if(!info){console.log('ERROR: target label not found');await page.screenshot({path:'.auth/field-status.png',fullPage:true});await ctx.close();process.exit(1);}
await page.waitForTimeout(500);
await page.mouse.click(info.x,info.y);
await page.waitForTimeout(1500);
const items=await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-combo-box-overlay,vaadin-select-overlay')].pop();
  if(!ov)return null;
  return [...ov.querySelectorAll('vaadin-combo-box-item,vaadin-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim());
});
console.log('OPTIONS in order =>',JSON.stringify(items));
console.log('SELECTED display text:', JSON.stringify(info.display));
await page.screenshot({path:'.auth/field-status.png',fullPage:true});
await ctx.close();
