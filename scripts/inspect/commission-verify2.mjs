// commission-verify2 — robust editor + filter + statcard capture.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1300}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a); const J=o=>JSON.stringify(o,null,1);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(3000);

// --- filters + stat cards (broad text scan of the toolbar/filter region) ---
const top=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const labels=[...document.querySelectorAll('label')].map(l=>clean(l.textContent)).filter(Boolean);
  // stat cards: elements whose text is "<words> <number>" with colored border
  const cards=[...document.querySelectorAll('*')].filter(d=>{
    if(d.children.length>3)return false;const t=clean(d.innerText);const s=getComputedStyle(d);
    return parseFloat(s.borderTopWidth)>=2 && /\d/.test(t) && t.length<40 && d.querySelector('*');
  }).map(d=>({t:clean(d.innerText),bord:getComputedStyle(d).borderTopColor,bg:getComputedStyle(d).backgroundColor}));
  return {labels:[...new Set(labels)], cards};
});
log('===== FILTER LABELS =====',J(top.labels));
log('===== STAT CARDS =====',J(top.cards));

// --- editor for 138 ---
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click();
await page.waitForTimeout(1000);
await page.getByRole('button',{name:'Изменить'}).click();
await page.waitForTimeout(3500);
log('\nEDIT URL:',page.url());
const ed=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-text-area,vaadin-entity-picker,vaadin-value-picker')]
    .map(e=>{const l=e.querySelector('label');const inp=e.querySelector('input,textarea');return {tag:e.tagName.toLowerCase(),lbl:clean(l&&l.textContent||e.getAttribute('label')),val:clean((inp&&inp.value)||'')};}).filter(f=>f.lbl);
  const btns=[...document.querySelectorAll('vaadin-button')].map(b=>clean(b.innerText)).filter(Boolean);
  const sections=(document.body.innerText.match(/Состав комиссии|Документы|Комментарии членов комиссии|Финальное решение[^\n]*Председатель[^\n)]*\)|Финальное решение|Прогресс голосования/gi)||[]);
  const grids=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.innerText)).filter(Boolean).slice(0,30);
  const vote=[...document.querySelectorAll('*')].map(e=>e.children.length===0?clean(e.innerText):'').filter(t=>/Одобрили|Отклонили|Воздерж|проголосов|Прогресс голос/i.test(t));
  return {fields,btns,sections:[...new Set(sections)],grids,vote};
});
log('FIELDS:',J(ed.fields));
log('BTNS:',J(ed.btns));
log('SECTIONS:',J(ed.sections));
log('GRID CELLS:',J(ed.grids));
log('VOTE TEXT:',J(ed.vote));
await page.screenshot({path:'.auth/commission-verify2-edit-138.png',fullPage:true});
await ctx.close(); log('\nDONE');
