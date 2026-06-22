import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Сохранить/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2000);
const out=await page.evaluate(()=>{
  const TAGS=['vaadin-text-field','vaadin-text-area','jmix-value-picker','vaadin-date-picker'];
  const labelOf=(el)=>{let lab=null,node=el;for(let up=0;up<4&&node;up++){node=node.parentElement;if(!node)break;for(const c of node.children){if(c===el||c.contains(el))continue;const t=(c.innerText||'').replace(/\s+/g,' ').trim();if(t&&t.length<60&&!/^\*$/.test(t)){lab=t;break;}}if(lab)break;}return lab;};
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0&&(e.invalid||e.hasAttribute('invalid'))).map(el=>labelOf(el));
});
console.log('REQUIRED(invalid on empty save):',JSON.stringify(out));
await ctx.close();
