import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(2500);
await page.evaluate(()=>document.querySelector('.jmix-property-filter jmix-value-picker #entity_lookup').click());
await page.waitForTimeout(2000);

// hierarchical skeleton of dialog (structural elements only)
const tree=await page.evaluate(()=>{
  const o=[...document.querySelectorAll('vaadin-dialog-overlay')].filter(x=>x.getBoundingClientRect().width>0).pop();
  const KEEP=/^(vaadin-dialog-overlay|h2|header|vaadin-horizontal-layout|vaadin-vertical-layout|vaadin-button|vaadin-menu-bar|jmix-simple-pagination|vaadin-grid|vaadin-grid-column|vaadin-grid-sort-column|vaadin-text-field|vaadin-details|vaadin-form-layout|jmix-property-filter|vaadin-icon|div)$/;
  const out=[];
  const walk=(el,d)=>{
    if(d>9) return;
    const tag=el.tagName?.toLowerCase(); if(!tag) return;
    const r=el.getBoundingClientRect?.();
    const vis=r&&r.width>0&&r.height>0;
    if(KEEP.test(tag) && vis){
      const role=el.getAttribute('jmix-role')||el.getAttribute('theme')||'';
      const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').slice(0,40);
      const icon=el.querySelector(':scope > vaadin-icon,:scope vaadin-icon')?.getAttribute?.('icon')||'';
      // only print containers + leaf controls, skip generic div unless it has class
      const cls=(el.className||'').toString();
      if(tag==='div' && !/jmix|filter|pagination|toolbar|button/i.test(cls)) {/*skip plain div but recurse*/}
      else out.push('  '.repeat(d)+tag+(role?`[${role}]`:'')+(icon?` {${icon}}`:'')+(own?` "${own}"`:'')+(cls&&tag==='div'?` .${cls.slice(0,30)}`:''));
    }
    [...el.children].forEach(c=>walk(c,d+1));
  };
  walk(o,0);
  return out.join('\n');
});
log(tree);
await ctx.close();
