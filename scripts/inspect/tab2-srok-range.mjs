import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Сумма и срок/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);

// ---- 1. click СРОК column Добавить (the one at x>1000) ----
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].filter(b=>/Добавить/i.test(b.innerText)&&b.getBoundingClientRect().left>1000)[0];b&&b.click();});
await page.waitForTimeout(1500);
const srokDlg=await page.evaluate(()=>{
  const ov=document.querySelector('vaadin-dialog-overlay');
  if(!ov)return{none:true};
  // dialog title
  const title=(ov.querySelector('h2,[class*=title],vaadin-dialog-header')?.innerText||'').trim();
  // grid columns + rows inside dialog
  const g=ov.querySelector('vaadin-grid');
  const cols=g?[...g.querySelectorAll('vaadin-grid-column')].map(c=>c.header||c.path):[];
  const cells=[...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean);
  const btns=[...ov.querySelectorAll('vaadin-button')].map(b=>b.innerText.trim()).filter(Boolean);
  return {title,cols,cells,btns,fullText:ov.innerText.slice(0,400)};
});
log('SROK_DIALOG:',JSON.stringify(srokDlg,null,1));
await page.screenshot({path:'.auth/live-tab2-srok-dlg.png',fullPage:true});
// close dialog (Отмена)
await page.evaluate(()=>{const ov=document.querySelector('vaadin-dialog-overlay');const b=[...(ov?.querySelectorAll('vaadin-button')||[])].find(b=>/Отмена/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(1000);

// ---- 2. toggle Тип суммы → Диапазон via real overlay click ----
const selBox=await page.evaluate(()=>{const s=document.querySelector('vaadin-select');const r=s.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
await page.mouse.click(selBox.x,selBox.y);
await page.waitForTimeout(900);
// click item «Диапазон» in the opened overlay
const picked=await page.evaluate(()=>{const it=[...document.querySelectorAll('vaadin-item,vaadin-select-item')].find(i=>/Диапазон/i.test(i.innerText)&&i.getBoundingClientRect().width>0);if(it){it.click();return it.innerText.trim();}return null;});
log('PICKED:',picked);
await page.waitForTimeout(1500);
const rangeMode=await page.evaluate(()=>{
  // left column region (x<700, y 200-900)
  const inReg=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left<760&&r.top>200&&r.top<900;};
  const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-number-field,vaadin-big-decimal-field,vaadin-integer-field')].filter(inReg).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName.toLowerCase(),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),ro:e.readonly};});
  const grids=[...document.querySelectorAll('vaadin-grid')].filter(inReg).length;
  // labels in left region
  const labs=[];document.querySelectorAll('label,[slot=label],vaadin-form-item').forEach(e=>{if(!inReg(e))return;const t=e.innerText?.trim();if(t&&t.length<40)labs.push(t);});
  return {leftGrids:grids,leftFieldCount:fields.length,fields,labels:[...new Set(labs)]};
});
log('RANGE_MODE_LEFT:',JSON.stringify(rangeMode,null,1));
await page.screenshot({path:'.auth/live-tab2-range2.png',fullPage:true});
await ctx.close();
