import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel:'chrome', headless:true });
const p = await b.newPage({ viewport:{width:1600,height:1000} });
await p.goto('file://'+process.cwd()+'/mockups/borrower/borrower.html',{waitUntil:'networkidle'});
// open card
await p.evaluate(()=>{document.querySelector('#rows tr').click();document.getElementById('btnEdit').click();});
// credits tab
await p.evaluate(()=>document.querySelector('.tab[data-tab=credits]').click());
await p.waitForTimeout(150);
// select credit row + Посмотр
await p.evaluate(()=>document.querySelector('.credit-row').click());
await p.waitForTimeout(100);
await p.evaluate(()=>document.getElementById('btnCreditView').click());
await p.waitForTimeout(200);
const tabs=['schedule','contract','terms','reg'];
for(const t of tabs){
  await p.evaluate(k=>document.querySelector('.tab[data-ltab="'+k+'"]').click(),t);
  await p.waitForTimeout(150);
  await p.screenshot({path:'.auth/borrower/lm-'+t+'.png',fullPage:true});
}
await b.close(); console.log('done');
