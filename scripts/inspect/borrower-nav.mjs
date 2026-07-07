import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const p = ctx.pages()[0]||await ctx.newPage();
await p.goto('https://fkftest.okmot.kg/loan-applicants',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2500);
const nav = await p.evaluate(()=>{
  // sidebar nav items visible
  const side=[...document.querySelectorAll('nav a, nav [role=menuitem], vaadin-side-nav-item, [class*=nav] a, [class*=menu] a')];
  const texts=side.map(e=>e.textContent.trim()).filter(Boolean);
  // fallback: collect leftcolumn text
  return {texts:[...new Set(texts)]};
});
console.log(JSON.stringify(nav,null,2));
await ctx.close();
