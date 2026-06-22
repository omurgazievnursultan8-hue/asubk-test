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
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Процентные ставки/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);

const texts=await page.evaluate(()=>{const out=[];document.querySelectorAll('span,div,label,h1,h2,h3,h4').forEach(e=>{if(e.childElementCount)return;const t=(e.innerText||'').trim();const r=e.getBoundingClientRect();if(t&&t.length<60&&r.width>0&&r.top>110&&r.top<950&&/ставк|процент|плаваю|фиксир|диапаз|значен|тип|маржа|база|пересмотр|мин|макс/i.test(t))out.push({t,x:Math.round(r.left),y:Math.round(r.top),fw:getComputedStyle(e).fontWeight,fs:getComputedStyle(e).fontSize});});return out.sort((a,b)=>a.y-b.y||a.x-b.x);});
log('TEXTS:',JSON.stringify(texts,null,1));
const fields=await page.evaluate(()=>{const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName.toLowerCase(),required:el.required===true||el.hasAttribute('required'),readonly:el.readonly===true||el.hasAttribute('readonly'),checked:el.checked===true,x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),val:(el.value||'').toString().slice(0,30),label:(el.label||'').trim()||null};}).sort((a,b)=>a.y-b.y||a.x-b.x);});
log('FIELDS:',JSON.stringify(fields,null,1));
// checkbox label text
const checks=await page.evaluate(()=>[...document.querySelectorAll('vaadin-checkbox')].filter(c=>c.getBoundingClientRect().width>0).map(c=>({label:c.innerText.trim()||c.getAttribute('label')||c.label,checked:c.checked})));
log('CHECKBOXES:',JSON.stringify(checks));

// «Значение фиксированной ставки» control: is it select/combo/picker? open it.
// try vaadin-select first
const rateCtl=await page.evaluate(()=>{
  // find the 2nd select or a combo or a value-picker in tab region
  const sels=[...document.querySelectorAll('vaadin-select')].filter(e=>e.getBoundingClientRect().width>0);
  const combos=[...document.querySelectorAll('vaadin-combo-box')].filter(e=>e.getBoundingClientRect().width>0);
  const pickers=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0);
  return {selects:sels.length,combos:combos.length,pickers:pickers.length};
});
log('RATE_CTL_COUNTS:',JSON.stringify(rateCtl));

// if there's a 2nd select (rate value), open it via mouse
const sboxes=await page.evaluate(()=>[...document.querySelectorAll('vaadin-select')].filter(e=>e.getBoundingClientRect().width>0).map(s=>{const r=s.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}));
log('SELECT_COUNT:',sboxes.length);
if(sboxes.length>=2){
  await page.mouse.click(sboxes[1].x,sboxes[1].y); await page.waitForTimeout(800);
  const items=await page.evaluate(()=>[...document.querySelectorAll('vaadin-select-item,vaadin-item')].filter(i=>i.getBoundingClientRect().width>0).map(i=>i.innerText.trim()));
  log('RATE_VALUE_ITEMS:',JSON.stringify(items));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
}
// if combo present, open it
if(rateCtl.combos>0){
  const cbox=await page.evaluate(()=>{const c=[...document.querySelectorAll('vaadin-combo-box')].filter(e=>e.getBoundingClientRect().width>0)[0];const r=c.getBoundingClientRect();return{x:r.left+r.width-20,y:r.top+r.height/2};});
  await page.mouse.click(cbox.x,cbox.y); await page.waitForTimeout(800);
  const items=await page.evaluate(()=>[...document.querySelectorAll('vaadin-combo-box-item')].map(i=>i.innerText.trim()));
  log('COMBO_ITEMS:',JSON.stringify(items));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
}
await page.screenshot({path:'.auth/live-tab3.png',fullPage:true});

// toggle «Тип основной ставки» → Диапазон
await page.mouse.click(sboxes[0].x,sboxes[0].y); await page.waitForTimeout(800);
const picked=await page.evaluate(()=>{const it=[...document.querySelectorAll('vaadin-select-item,vaadin-item')].find(i=>/Диапазон/i.test(i.innerText)&&i.getBoundingClientRect().width>0);if(it){it.click();return it.innerText.trim();}return null;});
log('PICKED_TYPE:',picked);
await page.waitForTimeout(1500);
const rangeFields=await page.evaluate(()=>{const TAGS=['vaadin-text-field','vaadin-big-decimal-field','vaadin-number-field','vaadin-combo-box','vaadin-select','jmix-value-picker'];const out=[...document.querySelectorAll(TAGS.join(','))].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.top>110&&r.top<950;}).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName.toLowerCase(),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)};});const labs=[];document.querySelectorAll('label,[slot=label]').forEach(e=>{const r=e.getBoundingClientRect();const t=e.innerText?.trim();if(t&&r.width>0&&r.top>110&&r.top<950&&t.length<50)labs.push(t);});return{fields:out,labels:[...new Set(labs)]};});
log('RANGE_MODE:',JSON.stringify(rangeFields,null,1));
await page.screenshot({path:'.auth/live-tab3-range.png',fullPage:true});
await ctx.close();
