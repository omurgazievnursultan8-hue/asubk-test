// Probe exact picker component tags + how to open their dialogs.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page = ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

// list all distinct custom element tag names containing 'picker' or 'jmix'
const tags = await page.evaluate(()=>{
  const s=new Set();
  document.querySelectorAll('*').forEach(e=>{const t=e.tagName.toLowerCase();if(t.includes('-'))s.add(t);});
  return [...s].sort();
});
console.log('CUSTOM TAGS:', tags.filter(t=>/jmix|picker|field|combo|select|value/.test(t)).join(', '));

// For the field labelled «Вид кредита», dump its container HTML (trimmed)
const html = await page.evaluate(()=>{
  const labels=[...document.querySelectorAll('label,[class*=label]')];
  // find any element whose text is exactly a known picker label
  let node=null;
  document.querySelectorAll('*').forEach(e=>{
    if(node)return;
    if(e.children.length===0 && e.textContent.trim()==='Вид кредита'){ node=e; }
  });
  if(!node) return 'label not found';
  // climb to the field wrapper
  let w=node; for(let i=0;i<5 && w.parentElement;i++){ w=w.parentElement; if(/picker|field/i.test(w.tagName)) break; }
  return w.outerHTML.slice(0,1200);
});
console.log('\nВид кредита WRAPPER:\n', html);

// count value-pickers and try clicking the first one's open action
const pickerTag = await page.evaluate(()=>{
  const cand=['jmix-value-picker','jmix-entity-picker','vaadin-custom-field','jmix-multi-value-picker'];
  for(const c of cand){ if(document.querySelector(c)) return c+':'+document.querySelectorAll(c).length; }
  return 'none';
});
console.log('PICKER TAG:', pickerTag);
await ctx.close();
