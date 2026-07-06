// Grab option lists for the 3 vaadin-select + Статус кредита combo. Robust: open, read any vaadin-item.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(3000);
const tab=async n=>{const ts=await page.$$('vaadin-tab');for(const t of ts){if((await t.textContent()).trim()===n){await t.click({force:true});await page.waitForTimeout(1000);return;}}};
const readItems=async()=>page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-select-overlay,vaadin-combo-box-overlay')].pop();if(!ov)return null;return [...ov.querySelectorAll('vaadin-item,vaadin-combo-box-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim());});
const esc=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(400);};

await tab('Условия кредита');
for(const label of ['Метод погашения кредита','Вид штрафа за просрочку по осн.с.','Вид штрафа за просрочку по процентам']){
  const box=await page.$(`vaadin-select[label="${label}"]`);
  if(box){const b=await box.boundingBox();if(b){await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(700);}}
  console.log('SELECT',label,'=>',JSON.stringify(await readItems()));await esc();
}
await tab('Общая информация');
{const box=await page.$('vaadin-combo-box[label="Статус кредита"]');
 if(box){const b=await box.boundingBox();if(b){await page.mouse.click(b.x+b.width-20,b.y+b.height/2);await page.waitForTimeout(700);}}
 console.log('COMBO Статус кредита =>',JSON.stringify(await readItems()));await esc();}
// payment dialog selects
await tab('Платеж');
{const add=await page.$$('vaadin-button');for(const a of add){if((await a.textContent()).trim()==='Добавить'){await a.click();await page.waitForTimeout(1500);break;}}}
for(const label of ['Статус платежа','Транш/Субкредит']){
  const box=await page.$(`vaadin-select[label="${label}"], vaadin-combo-box[label="${label}"]`);
  if(box){const b=await box.boundingBox();if(b){await page.mouse.click(b.x+b.width-20,b.y+b.height/2);await page.waitForTimeout(700);}}
  console.log('PAYSEL',label,'=>',JSON.stringify(await readItems()));await esc();
}
await ctx.close();
