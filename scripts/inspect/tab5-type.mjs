import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Льготн/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1200);
await page.evaluate(()=>{const c=[...document.querySelectorAll('vaadin-checkbox')].filter(e=>e.getBoundingClientRect().width>0)[0];if(c&&!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));c.dispatchEvent(new Event('checked-changed',{bubbles:true}));}});
await page.waitForTimeout(1200);

const txt=()=>page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const t=(e.textContent||'').trim();if(!t||t.length>80)return;const r=e.getBoundingClientRect();if(r.width<1||r.top<130||r.left<320)return;out.push({t,x:Math.round(r.left),y:Math.round(r.top),fs:Math.round(parseFloat(getComputedStyle(e).fontSize))});});
  return [...new Map(out.map(o=>[o.t+o.x+o.y,o])).values()].sort((a,b)=>a.y-b.y||a.x-b.x);
});
const flds=()=>page.evaluate(()=>{
  const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-select','vaadin-checkbox','vaadin-combo-box','vaadin-date-picker','vaadin-multi-select-combo-box'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>320;}).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName.toLowerCase(),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)};}).sort((a,b)=>a.y-b.y||a.x-b.x);
});
async function pickType(name){
  // open the first visible vaadin-select (block 1 — осн. сумма)
  const sel=page.locator('vaadin-select').first();
  await sel.click();
  await page.waitForTimeout(500);
  await page.locator(`vaadin-item:has-text("${name}"), vaadin-select-item:has-text("${name}")`).first().click();
  await page.waitForTimeout(1200);
  const v=await page.evaluate(()=>{const s=[...document.querySelectorAll('vaadin-select')].filter(e=>e.getBoundingClientRect().width>0)[0];return s?.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText?.trim();});
  log('selected value now =', v);
}

log('=== ТИП = Фиксированный ===');
await pickType('Фиксированный');
log('TXT',JSON.stringify(await txt()));log('FLDS',JSON.stringify(await flds()));
await page.screenshot({path:'.auth/t5-fixed.png',fullPage:true});

log('=== ТИП = Диапазон ===');
await pickType('Диапазон');
log('TXT',JSON.stringify(await txt()));log('FLDS',JSON.stringify(await flds()));
await page.screenshot({path:'.auth/t5-range.png',fullPage:true});
await ctx.close();
