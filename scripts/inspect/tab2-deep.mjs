import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Сумма и срок/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);

// SELECT internals: options + rendered value text + lumo style
const sel=await page.evaluate(()=>{
  const s=document.querySelector('vaadin-select'); if(!s)return null;
  const valEl=s.shadowRoot?.querySelector('[part="input-field"]');
  const cs=valEl?getComputedStyle(valEl):null;
  // open to read items
  return {valueText:(s.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText||s.innerText||'').trim(),
    fieldBg:cs?.backgroundColor,radius:cs?.borderRadius,h:cs?.height};
});
console.log('SELECT:',JSON.stringify(sel,null,1));

// GRID deep: header text, column count, rows, is editable, button styles
const grid=await page.evaluate(()=>{
  const g=document.querySelector('vaadin-grid'); if(!g)return null;
  const cols=[...g.querySelectorAll('vaadin-grid-column,vaadin-grid-pro-edit-column')].map(c=>({header:c.header||c.getAttribute('header'),path:c.path,editable:c.tagName.toLowerCase()}));
  const headerCells=[...(g.shadowRoot?.querySelectorAll('th')||[])].map(th=>th.innerText.trim());
  const cs=getComputedStyle(g);
  // find Добавить/Удалить buttons near grid
  const btns=[...document.querySelectorAll('vaadin-button')].filter(b=>/Добавить|Удалить/i.test(b.innerText)&&b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect();const cs=getComputedStyle(b);return{t:b.innerText.trim(),x:Math.round(r.left),y:Math.round(r.top),theme:b.getAttribute('theme'),bg:cs.backgroundColor,color:cs.color};});
  return {tag:g.tagName.toLowerCase(),cols,headerCells,border:cs.border,rowCount:g.querySelectorAll('vaadin-grid-cell-content').length,btns};
});
console.log('GRID:',JSON.stringify(grid,null,1));

// click Добавить (first) to see how a row is added (inline row vs dialog)
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Добавить/i.test(b.innerText)&&b.getBoundingClientRect().width>0);b&&b.click();});
await page.waitForTimeout(1200);
const afterAdd=await page.evaluate(()=>{
  const dlg=document.querySelector('vaadin-dialog-overlay,vaadin-confirm-dialog-overlay');
  const editors=[...document.querySelectorAll('vaadin-grid input,vaadin-grid vaadin-text-field,vaadin-grid vaadin-number-field')].length;
  // any new text/number field inside grid editing
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,8);
  return {dialogOpen:!!dlg,dialogText:dlg?dlg.innerText.slice(0,200):null,inlineEditors:editors,cellTexts:cells};
});
console.log('AFTER_ADD:',JSON.stringify(afterAdd,null,1));
await page.screenshot({path:'.auth/live-tab2-add.png',fullPage:true});

// switch Тип суммы to Диапазон, observe
await page.evaluate(()=>{const s=document.querySelector('vaadin-select');if(s){s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));}});
await page.waitForTimeout(1500);
const rangeMode=await page.evaluate(()=>{
  const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-number-field,vaadin-big-decimal-field,vaadin-integer-field')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().top<900).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName.toLowerCase(),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),ro:e.readonly};});
  const gridVisible=[...document.querySelectorAll('vaadin-grid')].filter(g=>g.getBoundingClientRect().width>0&&g.getBoundingClientRect().top<900).length;
  const labels=[];document.querySelectorAll('span,label,div').forEach(e=>{if(e.childElementCount)return;const t=e.innerText?.trim();const r=e.getBoundingClientRect();if(t&&t.length<40&&r.top>200&&r.top<900&&r.left<700&&/мин|макс|сумм|от|до|значен/i.test(t))labels.push(t);});
  return {gridVisible,fieldCount:fields.length,fields:fields.slice(0,10),rangeLabels:[...new Set(labels)]};
});
console.log('RANGE_MODE(Диапазон):',JSON.stringify(rangeMode,null,1));
await page.screenshot({path:'.auth/live-tab2-range.png',fullPage:true});
await ctx.close();
