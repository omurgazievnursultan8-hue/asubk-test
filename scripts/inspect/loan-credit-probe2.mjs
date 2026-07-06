// Probe: how to open selects + pickers. Dump overlays after clicking.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page = ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
const tab=async n=>{const ts=await page.$$('vaadin-tab');for(const t of ts){if((await t.textContent()).trim()===n){await t.click({force:true});await page.waitForTimeout(900);return;}}};

// --- SELECT options: click to open vaadin-select-overlay ---
await tab('Условия кредита');
async function selOpts(label){
  const el=await page.evaluateHandle(l=>[...document.querySelectorAll('vaadin-select')].find(e=>(e.getAttribute('label')||'').trim()===l),label);
  if(!el){return null;}
  await el.asElement()?.click().catch(()=>{});
  await page.waitForTimeout(700);
  const opts=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-select-overlay')].pop();if(!ov)return null;return [...ov.querySelectorAll('vaadin-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim());});
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  return opts;
}
for(const l of ['Метод погашения кредита','Вид штрафа за просрочку по осн.с.','Вид штрафа за просрочку по процентам']){
  console.log('SELECT',l,'=>',JSON.stringify(await selOpts(l)));
}
await tab('Общая информация');
// Статус кредита is a combo-box
const stEl=await page.$('vaadin-combo-box[label="Статус кредита"]');
if(stEl){await stEl.click();await page.waitForTimeout(700);
  const o=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-combo-box-overlay')].pop();if(!ov)return null;return [...ov.querySelectorAll('vaadin-combo-box-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim());});
  console.log('COMBO Статус кредита =>',JSON.stringify(o));await page.keyboard.press('Escape');await page.waitForTimeout(300);}

// --- PICKER structure: find lookup fields + their buttons/glyphs ---
const pk=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  // Jmix entity picker = vaadin-custom-field / a wrapper with buttons. Log all buttons w/ small text near labels.
  const res=[];
  document.querySelectorAll('vaadin-button').forEach(b=>{
    const t=clean(b.textContent); const aria=b.getAttribute('aria-label')||''; const th=b.getAttribute('title')||'';
    if(t.length<=3 || /clear|open|search|lookup|выбрать|очист/i.test(aria+th)){
      res.push({t, aria, th, cls:b.className, slot:b.getAttribute('slot')||''});
    }
  });
  return res.slice(0,30);
});
console.log('PICKER BUTTONS:',JSON.stringify(pk,null,1));
await ctx.close();
