// Capture (1) select/combo option lists (robust), (2) «Условия кредита» → sub-tab «Условия траншей» content.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
const BASE='https://fkftest.okmot.kg/';
const OUT='.auth/loan-credit'; mkdirSync(OUT,{recursive:true});
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(3000);
const tab=async n=>{const ts=await page.$$('vaadin-tab');for(const t of ts){if((await t.textContent()).trim()===n){await t.click({force:true});await page.waitForTimeout(1100);return;}}};
const esc=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(400);};
const out={selects:{},tranchTab:null};

// ---- (1) SELECTS: click, then dump ALL overlays' item text ----
async function grabSelect(label,isCombo){
  // click the field to open
  const box=await page.$(`${isCombo?'vaadin-combo-box':'vaadin-select'}[label="${label}"]`);
  if(!box){log('no field',label);return null;}
  const b=await box.boundingBox();
  if(b){await page.mouse.click(b.x+b.width-18,b.y+b.height/2);await page.waitForTimeout(800);}
  const items=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    // scan every overlay-ish element for vaadin-item / list-box options
    const ovs=[...document.querySelectorAll('vaadin-select-overlay,vaadin-combo-box-overlay,[id=overlay]')];
    for(const ov of ovs.reverse()){
      const its=[...ov.querySelectorAll('vaadin-item,vaadin-combo-box-item')].map(i=>clean(i.textContent)).filter(Boolean);
      if(its.length) return its;
    }
    // fallback: any vaadin-item in doc
    return [...document.querySelectorAll('vaadin-item,vaadin-combo-box-item')].map(i=>clean(i.textContent)).filter(Boolean);
  });
  await esc();
  return items;
}
await tab('Условия кредита');
for(const l of ['Метод погашения кредита','Вид штрафа за просрочку по осн.с.','Вид штрафа за просрочку по процентам']){
  out.selects[l]=await grabSelect(l,false); log('SELECT',l,'=>',JSON.stringify(out.selects[l]));
}
await tab('Общая информация');
out.selects['Статус кредита']=await grabSelect('Статус кредита',true); log('COMBO Статус кредита =>',JSON.stringify(out.selects['Статус кредита']));

// ---- (2) «Условия траншей» sub-tab ----
await tab('Условия кредита');
// find nested tab with text «Условия траншей»
const subClicked=await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(x=>x.textContent.trim()==='Условия траншей');if(t){t.click();return true;}return false;});
await page.waitForTimeout(1200);
out.tranchTab=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const vis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-date-picker,vaadin-date-time-picker,vaadin-select,vaadin-big-decimal-field,vaadin-number-field,jmix-value-picker,vaadin-checkbox,vaadin-text-area')]
    .filter(vis).map(f=>({tag:f.tagName.toLowerCase(),label:clean(f.getAttribute('label')),val:clean(f.value||f.querySelector('input')?.value)}));
  const grids=[...document.querySelectorAll('vaadin-grid')].filter(vis).map(g=>[...g.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.textContent)).filter(Boolean).slice(0,30));
  const btns=[...document.querySelectorAll('vaadin-button')].filter(vis).map(b=>clean(b.textContent)).filter(Boolean);
  return {clicked:true,fields,grids,btns};
});
await page.screenshot({path:`${OUT}/tranch-conditions.png`});
log('\nУСЛОВИЯ ТРАНШЕЙ:');
out.tranchTab.fields.forEach(f=>log(`  [${f.tag}] "${f.label}" = "${f.val}"`));
out.tranchTab.grids.forEach((g,i)=>log(`  GRID${i}:`,g.join(' | ')));
log('  BTNS:',out.tranchTab.btns.join(' · '));

writeFileSync(`${OUT}/final2.json`,JSON.stringify(out,null,2));
log('\nSaved',`${OUT}/final2.json`);
await ctx.close();
