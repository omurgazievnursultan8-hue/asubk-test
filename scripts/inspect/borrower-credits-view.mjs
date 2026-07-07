import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const p = ctx.pages()[0]||await ctx.newPage();
await p.goto('https://fkftest.okmot.kg/loan-applicants/18',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(3000);
// click Кредиты tab
const tabs = await p.$$('vaadin-tab');
for (const t of tabs){ if((await t.textContent()).trim().startsWith('Кредит')){ await t.click(); break; } }
await p.waitForTimeout(1500);
await p.screenshot({path:'.auth/borrower/cv-1-tab.png',fullPage:true});

// dump credits-tab toolbar buttons + grid rows
const info = await p.evaluate(()=>{
  const btns=[...document.querySelectorAll('vaadin-button')].map(b=>({t:b.textContent.trim(),dis:b.hasAttribute('disabled')})).filter(b=>b.t);
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean);
  return {btns,cells};
});
console.log('BTNS(before select):',JSON.stringify(info.btns));
console.log('CELLS:',JSON.stringify(info.cells));

// select first credit row (click a data cell)
await p.evaluate(()=>{
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')];
  const c=cells.find(x=>/О!Банк|\d{6,}/.test(x.textContent));
  if(c) c.click();
});
await p.waitForTimeout(800);
await p.screenshot({path:'.auth/borrower/cv-2-selected.png',fullPage:true});
const after=await p.evaluate(()=>[...document.querySelectorAll('vaadin-button')].map(b=>({t:b.textContent.trim(),dis:b.hasAttribute('disabled')})).filter(b=>b.t));
console.log('BTNS(after select):',JSON.stringify(after));

// click Просмотр (or Посмотр)
const urlBefore=p.url();
await p.evaluate(()=>{
  const b=[...document.querySelectorAll('vaadin-button')].find(x=>/Просмотр|Посмотр/i.test(x.textContent));
  if(b) b.click();
});
await p.waitForTimeout(2500);
await p.screenshot({path:'.auth/borrower/cv-3-view.png',fullPage:true});
console.log('urlBefore:',urlBefore,' urlAfter:',p.url());
const view=await p.evaluate(()=>{
  return {
    title: document.querySelector('.title, [class*=title]')?.textContent?.trim(),
    tabs:[...document.querySelectorAll('vaadin-tab')].map(t=>t.textContent.trim()).filter(Boolean),
    btns:[...document.querySelectorAll('vaadin-button')].map(b=>b.textContent.trim()).filter(Boolean),
    dialog: document.querySelector('vaadin-dialog-overlay')? true:false,
    firstText: document.body.innerText.split('\n').filter(Boolean).slice(0,30)
  };
});
console.log('VIEW:',JSON.stringify(view,null,2));
await ctx.close();
