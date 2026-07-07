// Screenshot + full button/text dump of «Залог» tab (live).
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const id=process.argv[2]||'18';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+`loan-credits/${id}`,{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>t.innerText.trim()==='Залог');if(t)t.click();});
await page.waitForTimeout(1800);
// ALL visible buttons on page with position
const all=await page.evaluate(()=>[...document.querySelectorAll('vaadin-button, button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0;}).map(b=>{const r=b.getBoundingClientRect();return {text:b.innerText.trim(),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width)};}));
console.log('ALL VISIBLE BUTTONS:',JSON.stringify(all,null,1));
await page.screenshot({path:'.auth/zalog-live.png',fullPage:false});
console.log('SHOT: .auth/zalog-live.png');
await ctx.close();
