import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2500);
// click tab 2
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Сумма и срок/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);
const sections=await page.evaluate(()=>{const out=[];document.querySelectorAll('h1,h2,h3,h4,span,div,label').forEach(e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return;const t=(e.childElementCount===0?e.innerText:'').trim();if(t&&t.length<60&&/сумм|срок|валют|диапаз|тип/i.test(t))out.push({t,x:Math.round(r.left),y:Math.round(r.top),fw:getComputedStyle(e).fontWeight,fs:getComputedStyle(e).fontSize});});return out.sort((a,b)=>a.y-b.y||a.x-b.x);});
console.log('TEXTS:',JSON.stringify(sections,null,1));
const fields=await page.evaluate(()=>{const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();const inp=el.shadowRoot?.querySelector('input,textarea');return{tag:el.tagName.toLowerCase(),required:el.required===true||el.hasAttribute('required'),readonly:el.readonly===true||el.hasAttribute('readonly'),disabled:el.disabled===true||el.hasAttribute('disabled'),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),val:(el.value||'').toString().slice(0,30)};}).sort((a,b)=>a.y-b.y||a.x-b.x);});
console.log('FIELDS:',JSON.stringify(fields,null,1));
// grids (vaadin-grid) present on tab?
const grids=await page.evaluate(()=>[...document.querySelectorAll('vaadin-grid')].filter(g=>g.getBoundingClientRect().width>0).map(g=>{const r=g.getBoundingClientRect();const cols=[...g.querySelectorAll('vaadin-grid-column')].map(c=>c.getAttribute('header')||c.path||'');return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),cols};}));
console.log('GRIDS:',JSON.stringify(grids,null,1));
const btns=await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean));
console.log('BUTTONS:',JSON.stringify(btns));
await page.screenshot({path:'.auth/live-tab2.png',fullPage:true});
await ctx.close();
