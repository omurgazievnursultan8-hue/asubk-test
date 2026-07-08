import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage(); const J=o=>JSON.stringify(o);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(700);
await page.getByRole('button',{name:'Изменить'}).click(); await page.waitForTimeout(3000);
await page.getByRole('button',{name:'Одобрить'}).click().catch(()=>{});
await page.waitForTimeout(1500);
console.log(J(await page.evaluate(()=>{
  const btns=[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0 && /^(Да|Отмена|Нет|Yes|No|Cancel)$/.test(b.innerText.trim()));
  const ov=[...document.querySelectorAll('*')].find(e=>e.tagName&&/CONFIRM-DIALOG-OVERLAY/i.test(e.tagName));
  const foot=ov?.shadowRoot?.querySelector('[part="footer"]');
  return {
    overlayTag: ov?ov.tagName:'(none)',
    footerJustify: foot?getComputedStyle(foot).justifyContent:'(no foot)',
    btns: btns.map(b=>{const cs=getComputedStyle(b);const r=b.getBoundingClientRect();return {t:b.innerText.trim(),theme:b.getAttribute('theme')||'',bg:cs.backgroundColor,color:cs.color,x:Math.round(r.x),hasIcon:!!b.querySelector('svg,vaadin-icon')};}),
  };
})));
await ctx.close();
