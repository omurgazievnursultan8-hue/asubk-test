// commission-verify — full structured dump of live «Комиссии по заявкам» for mockup сверка.
// Captures: list (filter labels, stat cards, toolbar btn states per selection, grid cols/rows, pager),
// detail/Просмотр (header, vote, tabs+counts, members, итоговое решение) for 138 & 139,
// editor/Изменить (header, состав, документы, комментарии, финал btns, прогресс).
// Read-only: cancels every dialog, never saves.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1300}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
const J=o=>JSON.stringify(o,null,1);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2800);

// ---------- LIST ----------
const list=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  // filter fields (labels) — vaadin fields in the top filter form
  const filters=[...document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-entity-picker,vaadin-value-picker')]
    .map(e=>{const l=e.querySelector('label');return clean(l&&l.textContent||e.getAttribute('label'));}).filter(Boolean);
  // stat cards
  const cards=[...document.querySelectorAll('div')].filter(d=>{const s=getComputedStyle(d);return s.borderStyle==='solid'&&parseFloat(s.borderTopWidth)>=2&&/^\d+$/.test(clean(d.innerText).split(' ').pop());});
  // toolbar buttons
  const btns=[...document.querySelectorAll('vaadin-button')].map(b=>({t:clean(b.innerText),dis:b.disabled||b.hasAttribute('disabled')})).filter(b=>b.t);
  // grid columns
  const cols=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.innerText));
  const heads=[...document.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.getAttribute('header')||c.getAttribute('path'));
  return {filters, btns, cards: cards.map(c=>clean(c.innerText)).slice(0,8), heads, cells:cols.slice(0,60)};
});
log('===== LIST =====');
log('FILTERS:',J(list.filters));
log('TOOLBAR BTNS (no selection):',J(list.btns));
log('STAT CARDS:',J(list.cards));
log('GRID HEADS:',J(list.heads));
log('GRID CELLS(first rows):',J(list.cells));

// toolbar state after selecting each row
for(const rid of ['139','138']){
  await page.getByText('Проверка комиссии - '+rid,{exact:true}).first().click().catch(()=>{});
  await page.waitForTimeout(700);
  const st=await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].map(b=>({t:(b.innerText||'').replace(/\s+/g,' ').trim(),dis:b.disabled||b.hasAttribute('disabled')})).filter(b=>b.t));
  log(`TOOLBAR after select ${rid}:`,J(st));
}

// ---------- DETAIL (Просмотр) for 138 & 139 ----------
async function dumpDetail(rid){
  await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2000);
  await page.getByText('Проверка комиссии - '+rid,{exact:true}).first().click().catch(()=>{});
  await page.waitForTimeout(600);
  await page.getByRole('button',{name:'Просмотр'}).click().catch(()=>{});
  await page.waitForTimeout(2500);
  const d=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-text-area,vaadin-entity-picker,vaadin-value-picker')]
      .map(e=>{const l=e.querySelector('label');const inp=e.querySelector('input,textarea');return {lbl:clean(l&&l.textContent||e.getAttribute('label')),val:clean((inp&&inp.value)||e.getAttribute('value')||e.value)};}).filter(f=>f.lbl);
    const tabs=[...document.querySelectorAll('vaadin-tab')].map(t=>clean(t.innerText));
    const btns=[...document.querySelectorAll('vaadin-button')].map(b=>clean(b.innerText)).filter(Boolean);
    const vote=clean([...document.querySelectorAll('*')].map(e=>e.childElementCount===0?e.innerText:'').filter(t=>/Прогресс голосования|Одобрили|Отклонили|Воздерж|проголосов/i.test(t)).join(' | '));
    const grids=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.innerText)).filter(Boolean);
    return {url:location.href, fields, tabs, btns, vote, grids:grids.slice(0,40)};
  });
  log(`\n===== DETAIL ${rid} =====`);
  log('URL:',d.url);
  log('FIELDS:',J(d.fields));
  log('TABS:',J(d.tabs));
  log('BTNS:',J(d.btns));
  log('VOTE:',d.vote);
  log('GRID CELLS:',J(d.grids));
  await page.screenshot({path:`.auth/commission-verify-detail-${rid}.png`,fullPage:true});
  // click through each tab
  const tabEls=await page.$$('vaadin-tab');
  for(let i=0;i<tabEls.length;i++){
    await tabEls[i].click().catch(()=>{}); await page.waitForTimeout(700);
    const t=await page.evaluate(()=>{const clean=s=>(s||'').replace(/\s+/g,' ').trim();
      const panel=[...document.querySelectorAll('vaadin-tabsheet, [role=tabpanel], vaadin-vertical-layout')].map(p=>clean(p.innerText)).filter(Boolean);
      return clean(document.querySelector('vaadin-tab[selected]')?.innerText)+' => '+ (document.body.innerText.match(/отсутствуют|не сформирован|нет данных|No data/gi)||[]).join(',');
    });
    log(`  TAB[${i}]:`,t);
  }
}
await dumpDetail('138');
await dumpDetail('139');

// ---------- EDITOR (Изменить 138) ----------
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2000);
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click().catch(()=>{});
await page.waitForTimeout(600);
await page.getByRole('button',{name:'Изменить'}).click().catch(()=>{});
await page.waitForTimeout(2800);
const ed=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-text-area,vaadin-entity-picker,vaadin-value-picker')]
    .map(e=>{const l=e.querySelector('label');const inp=e.querySelector('input,textarea');return {lbl:clean(l&&l.textContent||e.getAttribute('label')),val:clean((inp&&inp.value)||'')};}).filter(f=>f.lbl);
  const btns=[...document.querySelectorAll('vaadin-button')].map(b=>clean(b.innerText)).filter(Boolean);
  const heads=[...document.querySelectorAll('h1,h2,h3,h4,b,strong,vaadin-details summary')].map(h=>clean(h.innerText)).filter(t=>t&&t.length<60);
  const grids=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.innerText)).filter(Boolean);
  const sections=(document.body.innerText.match(/Состав комиссии|Документы|Комментарии членов комиссии|Финальное решение[^\n]*|Прогресс голосования|Председатель/gi)||[]);
  return {url:location.href, fields, btns, heads:[...new Set(heads)], grids:grids.slice(0,40), sections:[...new Set(sections)]};
});
log('\n===== EDITOR 138 =====');
log('URL:',ed.url);
log('FIELDS:',J(ed.fields));
log('BTNS:',J(ed.btns));
log('SECTION HEADS:',J(ed.sections));
log('GRID CELLS:',J(ed.grids));
await page.screenshot({path:'.auth/commission-verify-edit-138.png',fullPage:true});

await ctx.close();
log('\nDONE');
