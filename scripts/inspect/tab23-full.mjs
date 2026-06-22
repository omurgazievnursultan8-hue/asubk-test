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

const labelOf=`(el)=>{let lab=null,node=el;for(let up=0;up<4&&node;up++){node=node.parentElement;if(!node)break;for(const c of node.children){if(c===el||c.contains(el))continue;const t=(c.innerText||'').replace(/\\s+/g,' ').trim();if(t&&t.length<60&&!/^\\*$/.test(t)){lab=t;break;}}if(lab)break;}return lab;}`;

async function dump(tag){
  return page.evaluate((labelSrc)=>{
    const labelOf=eval('('+labelSrc+')');
    const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];
    const fields=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{
      const r=el.getBoundingClientRect();
      const fieldEl=el.shadowRoot?.querySelector('[part="input-field"]');
      const fcs=fieldEl?getComputedStyle(fieldEl):null;
      let val=null;
      if(el.tagName.toLowerCase()==='vaadin-select') val=el.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText?.trim()||el.value;
      return {tag:el.tagName.toLowerCase(),label:labelOf(el),ro:el.readonly||el.hasAttribute('readonly'),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),bg:fcs?.backgroundColor||null,radius:fcs?.borderRadius||null,val};
    }).sort((a,b)=>a.y-b.y||a.x-b.x);
    const headers=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.top<160)return;const fs=parseFloat(getComputedStyle(e).fontSize),fw=getComputedStyle(e).fontWeight;const t=(e.innerText||'').trim();if(t&&t.length<40&&fs>=16&&fw>=600)headers.push({t,x:Math.round(b.left),y:Math.round(b.top)});});
    const grids=[...document.querySelectorAll('vaadin-grid')].filter(g=>g.getBoundingClientRect().width>0).map(g=>{const r=g.getBoundingClientRect();const cols=[...g.querySelectorAll('vaadin-grid-column')].map(c=>c.header||c.getAttribute('header')||c.path);const hc=[...(g.shadowRoot?.querySelectorAll('th')||[])].map(t=>t.innerText.trim()).filter(Boolean);return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),cols,headerCells:hc,rows:g.querySelectorAll('vaadin-grid-cell-content').length};});
    const btns=[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect();return{t:b.innerText.trim(),x:Math.round(r.left),y:Math.round(r.top),theme:b.getAttribute('theme')};}).filter(b=>b.t);
    const checks=[...document.querySelectorAll('vaadin-checkbox')].filter(c=>c.getBoundingClientRect().width>0).map(c=>c.innerText.trim()||c.getAttribute('aria-label'));
    return {fields,headers,grids,btns,checks};
  },labelOf);
}

// ---- TAB 2 default (Фиксированная) ----
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Сумма и срок/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);
log('===TAB2 DEFAULT===');log(JSON.stringify(await dump('t2def')));
// select options: open first select
const selOpts=await page.evaluate(()=>{const s=document.querySelector('vaadin-select');if(!s)return null;s.opened=true;const items=[...document.querySelectorAll('vaadin-select-overlay vaadin-item, vaadin-select-item')].map(i=>i.innerText.trim());s.opened=false;return items;});
log('TAB2 SELECT OPTIONS:',JSON.stringify(selOpts));
await page.screenshot({path:'.auth/t2-default.png',fullPage:true});

// ---- TAB 2 Диапазон (both selects) ----
await page.evaluate(()=>{document.querySelectorAll('vaadin-select').forEach(s=>{s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));});});
await page.waitForTimeout(1500);
log('===TAB2 ДИАПАЗОН===');log(JSON.stringify(await dump('t2range')));
await page.screenshot({path:'.auth/t2-range.png',fullPage:true});

// ---- TAB 3 default ----
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Процентные ставки/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);
log('===TAB3 DEFAULT===');log(JSON.stringify(await dump('t3def')));
// multi-select combo options
const msOpts=await page.evaluate(()=>{const m=document.querySelector('vaadin-multi-select-combo-box');if(!m)return null;m.opened=true;const items=[...document.querySelectorAll('vaadin-multi-select-combo-box-overlay vaadin-multi-select-combo-box-item, vaadin-combo-box-item')].map(i=>i.innerText.trim());return {found:true,items};});
log('TAB3 RATE COMBO OPTIONS:',JSON.stringify(msOpts));
await page.screenshot({path:'.auth/t3-default.png',fullPage:true});

// ---- TAB 3 Диапазон ----
await page.evaluate(()=>{const s=document.querySelector('vaadin-select');if(s){s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));}});
await page.waitForTimeout(1500);
log('===TAB3 ДИАПАЗОН===');log(JSON.stringify(await dump('t3range')));
await page.screenshot({path:'.auth/t3-range.png',fullPage:true});
await ctx.close();
