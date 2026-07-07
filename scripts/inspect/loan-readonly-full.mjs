import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const p = ctx.pages()[0]||await ctx.newPage();
await p.goto('https://fkftest.okmot.kg/loans-processing/24?mode=readonly',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(3500);
const out={url:p.url(),tabs:[],dumps:{}};
out.tabs = await p.evaluate(()=>[...document.querySelectorAll('vaadin-tab')].map(t=>t.textContent.trim()).filter(Boolean));

const dumpFields=()=>p.evaluate(()=>{
  const seen=new Set(),f=[];
  document.querySelectorAll('vaadin-text-field,vaadin-text-area,vaadin-combo-box,vaadin-select,vaadin-date-picker,vaadin-date-time-picker,vaadin-number-field,vaadin-integer-field,vaadin-big-decimal-field,vaadin-checkbox').forEach(el=>{
    const label=el.getAttribute('label')||'';
    const inp=el.querySelector('input,textarea');
    const value=inp?inp.value:(el.value??'');
    const k=label+'|'+value+'|'+el.tagName; if(seen.has(k))return; seen.add(k);
    f.push({tag:el.tagName.toLowerCase(),label,value,ro:el.hasAttribute('readonly'),req:el.hasAttribute('required')});
  }); return f;
});
const dumpGrid=()=>p.evaluate(()=>{
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim());
  return cells;
});
const dumpBtns=()=>p.evaluate(()=>[...document.querySelectorAll('vaadin-button')].map(b=>b.textContent.trim()).filter(Boolean));
const dumpText=()=>p.evaluate(()=>document.body.innerText.replace(/\n{3,}/g,'\n\n'));

const tabEls=await p.$$('vaadin-tab');
for(let i=0;i<tabEls.length;i++){
  const label=(await tabEls[i].textContent()).trim();
  await tabEls[i].click(); await p.waitForTimeout(1800);
  await p.screenshot({path:`.auth/borrower/lp-tab${i}-${label.replace(/[^\wА-Яа-я]+/g,'_').slice(0,18)}.png`,fullPage:true});
  out.dumps[label]={fields:await dumpFields(),grid:await dumpGrid(),btns:await dumpBtns(),text:(await dumpText()).slice(0,3500)};
}
writeFileSync('.auth/loan-readonly.json',JSON.stringify(out,null,2));
console.log('TABS:',out.tabs.join(' | '));
for(const [t,d] of Object.entries(out.dumps)){ console.log('\n#### '+t); console.log('fields:',d.fields.map(x=>x.label+'='+x.value).filter(Boolean).join(' ; ')); console.log('grid cells:',d.grid.length); console.log('btns:',d.btns.join(', ')); }
await ctx.close();
