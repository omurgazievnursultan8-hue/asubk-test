import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(1500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2500);
const props=['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderTopWidth','borderTopStyle','borderTopColor','borderBottomColor','borderTopLeftRadius','paddingTop','paddingLeft','height','boxShadow'];
const out=await page.evaluate((props)=>{
  const pick=(el)=>{if(!el)return null;const c=getComputedStyle(el);const o={};props.forEach(p=>o[p]=c[p]);return o;};
  const tf=document.querySelector('vaadin-text-field');
  const inputField=tf?.shadowRoot?.querySelector('[part="input-field"]');
  const lbl=tf?.shadowRoot?.querySelector('[part="label"]')||tf?.querySelector('label');
  const inp=tf?.querySelector('input')||tf?.shadowRoot?.querySelector('input');
  const sec=[...document.querySelectorAll('span,div,h1,h2,h3,h4')].find(e=>/Общая информац/i.test(e.textContent)&&e.childElementCount===0);
  const btn=[...document.querySelectorAll('vaadin-button')].find(b=>/Сохранить/i.test(b.innerText));
  const tab=document.querySelector('vaadin-tab');
  const picker=document.querySelector('jmix-value-picker')?.shadowRoot?.querySelector('[part="input-field"]')||document.querySelector('jmix-value-picker input');
  return {input_box:pick(inputField),input_el:pick(inp),label:pick(lbl),section:pick(sec),button_host:pick(btn),tab:pick(tab),picker_box:pick(picker)};
},props);
console.log(JSON.stringify(out,null,1));
await ctx.close();
