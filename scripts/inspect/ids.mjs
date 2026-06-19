import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'domcontentloaded'});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation().catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs/new',{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
const info=await page.evaluate(()=>{
  const res=[];
  for(const el of document.querySelectorAll('jmix-value-picker')){
    const r=el.getBoundingClientRect(); if(!(r.width>0&&r.height>0))continue;
    res.push({id:el.id||null, name:el.getAttribute('name'), top:Math.round(r.top), left:Math.round(r.left),
      attrs:[...el.attributes].map(a=>a.name+'='+a.value).filter(a=>!/^style|^class/.test(a)).slice(0,8)});
  }
  return res;
});
console.log(JSON.stringify(info,null,1));
await ctx.close();
