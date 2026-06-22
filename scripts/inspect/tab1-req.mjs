import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
// Try saving empty to trigger validation, capture any error markers
const out=await page.evaluate(()=>{
  const TAGS=['vaadin-text-field','vaadin-text-area','jmix-value-picker','vaadin-date-picker'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{
    const inp=el.shadowRoot?.querySelector('input,textarea');
    const ri=el.shadowRoot?.querySelector('[part=required-indicator]');
    const riVis=ri?getComputedStyle(ri,'::before').content+'|'+getComputedStyle(ri,'::after').content:null;
    return {tag:el.tagName.toLowerCase(), req:el.required||el.hasAttribute('required')||inp?.required||false, invalid:el.invalid||el.hasAttribute('invalid')||false, errMsg:el.errorMessage||null, riVis};
  });
});
console.log('BEFORE_SAVE:',JSON.stringify(out));
// click Сохранить
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Сохранить/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2000);
const after=await page.evaluate(()=>{
  const TAGS=['vaadin-text-field','vaadin-text-area','jmix-value-picker','vaadin-date-picker'];
  const fld=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>({tag:el.tagName.toLowerCase(),invalid:el.invalid||el.hasAttribute('invalid')||false,err:el.errorMessage||el.shadowRoot?.querySelector('[part=error-message]')?.innerText||null}));
  const notif=[...document.querySelectorAll('vaadin-notification-card')].map(n=>n.innerText.trim());
  const tabs=[...document.querySelectorAll('vaadin-tab')].map(t=>t.innerText.trim());
  return {invalidCount:fld.filter(f=>f.invalid).length, fld:fld.filter(f=>f.invalid), notif, tabs};
});
console.log('AFTER_SAVE:',JSON.stringify(after,null,1));
await page.screenshot({path:'.auth/tab1-aftersave.png',fullPage:true});
await ctx.close();
