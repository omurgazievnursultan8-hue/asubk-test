// Full per-tab capture of live «Редактирование кредита» (record 18) for mockup diff.
// Walks all 11 tabs, dumps every field label+value, every grid (headers+rows),
// and a screenshot per tab. One JSON per tab under .auth/loan-credit/verify/.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE='https://fkftest.okmot.kg/';
const USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const OUT='.auth/loan-credit/verify'; mkdirSync(OUT,{recursive:true});
const log=(...a)=>console.log(...a);

const ctx=await chromium.launchPersistentContext('.auth/profile',
  {channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){
  await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

const TABS=['Общая информация','Оформление','Заемщик','Условия кредита','График погашений',
  'Транши','Резерв','Платеж','Код оплаты','Детальный расчет','Залог'];

const clickTab=async n=>{
  const ts=await page.$$('vaadin-tab');
  for(const t of ts){ if((await t.textContent()).trim()===n){ await t.click({force:true}); await page.waitForTimeout(1200); return true; } }
  return false;
};

// dump all form fields + grids visible in the active detail area
const dumpActive=()=>page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const vis=el=>{ const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
  // fields
  const fsel='vaadin-text-field,vaadin-text-area,vaadin-combo-box,vaadin-date-picker,vaadin-date-time-picker,'+
    'vaadin-time-picker,vaadin-big-decimal-field,vaadin-number-field,vaadin-integer-field,vaadin-select,jmix-value-picker';
  const fields=[...document.querySelectorAll(fsel)].filter(vis).map(f=>({
    tag:f.tagName.toLowerCase(),
    label:clean(f.getAttribute('label')),
    value:clean(f.value||f.querySelector('input')?.value||f.textContent),
    readonly:f.hasAttribute('readonly'),
    required:f.hasAttribute('required'),
    invalid:f.hasAttribute('invalid'),
  }));
  // checkboxes
  const checks=[...document.querySelectorAll('vaadin-checkbox')].filter(vis).map(c=>({
    label:clean(c.getAttribute('label')||c.textContent), checked:c.hasAttribute('checked') }));
  // inner tabs (sub-tabs)
  const subtabs=[...document.querySelectorAll('vaadin-tab')].filter(vis).map(t=>clean(t.textContent));
  // grids
  const grids=[...document.querySelectorAll('vaadin-grid')].filter(vis).map(g=>{
    const heads=[...g.querySelectorAll('vaadin-grid-cell-content')]
      .filter(c=>c.closest('thead,[part~="header-cell"]')||c.assignedSlot?.name?.includes('header'));
    // fallback: header columns via vaadin-grid-column headers is unreliable in DOM; collect all cell-contents
    const allCells=[...g.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.textContent));
    return { cells: allCells.filter(Boolean) };
  });
  // toolbar buttons
  const buttons=[...document.querySelectorAll('vaadin-button')].filter(vis)
    .map(b=>clean(b.textContent)).filter(Boolean);
  return {fields,checks,subtabs,grids,buttons};
});

const result={};
for(let i=0;i<TABS.length;i++){
  const name=TABS[i];
  const ok=await clickTab(name);
  await page.waitForTimeout(600);
  const data=await dumpActive();
  result[name]={index:i,found:ok,...data};
  await page.screenshot({path:`${OUT}/tab-${String(i).padStart(2,'0')}.png`,fullPage:true});
  log(`TAB ${i} [${name}] found=${ok} fields=${data.fields.length} checks=${data.checks.length} grids=${data.grids.length} subtabs=${data.subtabs.join('/')||'-'}`);
  // Условия кредита: capture the second sub-tab too
  if(name==='Условия кредита'){
    // click a sub-tab labelled about траншей if present
    const sub=await page.evaluate(()=>{
      const clean=s=>(s||'').replace(/\s+/g,' ').trim();
      const t=[...document.querySelectorAll('vaadin-tab')].find(x=>/транш/i.test(clean(x.textContent)));
      if(t){t.click();return clean(t.textContent);} return null;
    });
    if(sub){ await page.waitForTimeout(1200); const d2=await dumpActive();
      result[name+' :: '+sub]={index:i,sub:true,...d2};
      await page.screenshot({path:`${OUT}/tab-03-sub.png`,fullPage:true});
      log(`  SUBTAB [${sub}] fields=${d2.fields.length} grids=${d2.grids.length}`);
    }
  }
}
writeFileSync(`${OUT}/all-tabs.json`,JSON.stringify(result,null,2));
log('\nSaved',`${OUT}/all-tabs.json`);
await ctx.close();
