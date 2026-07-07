// commission-sverka2 — stat colors + /new edit layout + voting dialog + row138 readonly
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1200}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2500);

// ---- stat card computed colors ----
log('== STAT CARD STYLES ==');
log(JSON.stringify(await page.evaluate(()=>{
  const labels=['Всего поручительств','На рассмотрении','Одобрено','Отклонено','Требуется доп. информация'];
  return labels.map(lbl=>{
    let node=[...document.querySelectorAll('*')].find(e=>!e.childElementCount&&e.innerText&&e.innerText.trim()===lbl&&e.getBoundingClientRect().top<320);
    // climb to card container
    let card=node; for(let i=0;i<5&&card;i++){const cs=getComputedStyle(card); if(cs.borderTopWidth!=='0px'&&cs.borderTopStyle!=='none'){break;} card=card.parentElement;}
    const cs=card?getComputedStyle(card):{};
    return {lbl, border:cs.border, borderColor:cs.borderColor, bg:cs.backgroundColor, color:node?getComputedStyle(node).color:''};
  });
})));

// ================= CLICK Создать → /new =================
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(x=>/Создать/i.test(x.innerText));b?.click();});
await page.waitForTimeout(2500);
log('\n== /new URL:', page.url());
log('\n== /new HEADINGS ==');
log(JSON.stringify(await page.evaluate(()=>{const out=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const r=e.getBoundingClientRect();if(r.width<1||r.height<1||r.left<300)return;const t=(e.innerText||'').replace(/\s+/g,' ').trim();if(!t||t.length>70)return;const cs=getComputedStyle(e);const fw=parseInt(cs.fontWeight,10)||400;const fs=parseFloat(cs.fontSize)||0;if(fw<600&&fs<16)return;out.push({t,x:Math.round(r.left),y:Math.round(r.top),fw,fs:cs.fontSize});});return out;})));
log('\n== /new FIELD label/value (Vaadin) ==');
log(JSON.stringify(await page.evaluate(()=>{
  return [...document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-text-area,vaadin-integer-field,vaadin-number-field')]
   .filter(e=>e.getBoundingClientRect().width>0).map(e=>{
     const r=e.getBoundingClientRect();
     const lblEl=e.querySelector('label')||e.shadowRoot&&e.shadowRoot.querySelector('[part="label"]');
     return {tag:e.tagName.toLowerCase(),label:(lblEl&&lblEl.textContent||e.getAttribute('label')||'').trim(),value:(e.value||e.getAttribute('value')||'').slice(0,60),x:Math.round(r.left),y:Math.round(r.top),ro:e.hasAttribute('readonly')};
   });
})));
log('\n== /new BUTTONS (with x,y) ==');
log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect();return {t:b.innerText.trim(),x:Math.round(r.left),y:Math.round(r.top)};}).filter(b=>b.t))));
log('\n== /new GRID cells ==');
log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-grid-cell-content')].filter(c=>c.getBoundingClientRect().width>0).map(c=>c.innerText.trim()).slice(0,30))));
log('\n== /new TABS ==');
log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-tab')].filter(t=>t.getBoundingClientRect().width>0).map(t=>t.innerText.trim()))));
await page.screenshot({path:'.auth/commission-new-live.png'});

// ---- click Проголосовать to see dialog ----
log('\n== CLICK Проголосовать ==');
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(x=>/Проголосовать/i.test(x.innerText));b?.click();});
await page.waitForTimeout(1500);
log('dialog text:', JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-confirm-dialog-overlay')].map(d=>(d.innerText||'').replace(/\s+/g,' ').slice(0,240)))));
log('dialog buttons:', JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay vaadin-button,vaadin-confirm-dialog-overlay vaadin-button')].map(b=>b.innerText.trim()).filter(Boolean))));
await page.screenshot({path:'.auth/commission-vote-live.png'});
// close dialog
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-dialog-overlay vaadin-button,vaadin-confirm-dialog-overlay vaadin-button')].find(x=>/Отмена|Закрыть|Cancel/i.test(x.innerText));b?.click();});
await page.waitForTimeout(600);

// ================= row 138 readonly =================
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2000);
// dismiss any leave-confirm
await page.keyboard.press('Enter').catch(()=>{});
await page.waitForTimeout(800);
await page.evaluate(()=>{const c=[...document.querySelectorAll('vaadin-grid-cell-content')].find(x=>/Проверка комиссии - 138/.test(x.innerText));c?.click();});
await page.waitForTimeout(700);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(x=>/Просмотр$/.test(x.innerText.trim())||x.innerText.trim()==='Просмотр');b?.click();});
await page.waitForTimeout(2500);
log('\n== ROW138 readonly URL:',page.url());
log('ROW138 LABELVALUE:',JSON.stringify(await page.evaluate(()=>{
  const out=[];const labels=[...document.querySelectorAll('label,[part="label"]')];
  document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-text-area').forEach(e=>{
    if(e.getBoundingClientRect().width<1)return;const l=e.querySelector('label');out.push({label:(l&&l.textContent||e.getAttribute('label')||'').trim(),value:(e.value||'').slice(0,60)});});
  return out;})));
log('ROW138 TABS:',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-tab')].filter(t=>t.getBoundingClientRect().width>0).map(t=>t.innerText.replace(/\s+/g,' ').trim()))));
log('ROW138 vote title:',JSON.stringify(await page.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>!x.childElementCount&&/Прогресс голосования/.test(x.innerText||''));return e?e.innerText.trim():'';})));
log('ROW138 members:',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-grid-cell-content')].filter(c=>c.getBoundingClientRect().width>0).map(c=>c.innerText.trim()).slice(0,20))));
await page.screenshot({path:'.auth/commission-row138-live.png'});
await ctx.close();
