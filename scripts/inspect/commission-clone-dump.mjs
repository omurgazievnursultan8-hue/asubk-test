// commission-clone-dump — precise DOM/style sverka for cloning the mockup.
// Dumps: sidebar «Приложение» items, editor «Состав комиссии» grid headers,
// «Ваш отзыв» dialog (fields, geometry, dialog width), «Подтверждение» dialog
// (buttons + styles), members-grid heights, list column widths.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a); const J=o=>JSON.stringify(o,null,0);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}

await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2500);

// ---- SIDEBAR: «Приложение» expanded items ----
log('\n== SIDEBAR «Приложение» items ==');
log(J(await page.evaluate(()=>{
  // find the nav; Vaadin side-nav uses vaadin-side-nav-item / anchors
  const items=[...document.querySelectorAll('a,vaadin-side-nav-item,[role="listitem"]')]
    .map(e=>(e.innerText||'').trim()).filter(Boolean);
  return items.slice(0,40);
})));

// ---- LIST: grid column headers + rendered widths ----
log('\n== LIST grid columns (header text + px width) ==');
log(J(await page.evaluate(()=>{
  const cols=[...document.querySelectorAll('vaadin-grid-column')];
  const heads=[...document.querySelectorAll('vaadin-grid th, thead th')];
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].filter(c=>c.closest('thead')||c.getAttribute('slot')?.includes('header'));
  const gr=document.querySelector('vaadin-grid');
  return {
    gridWidth: gr?gr.getBoundingClientRect().width:null,
    headerTexts: [...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>(c.innerText||'').trim()).filter(Boolean).slice(0,12),
  };
})));

// ---- OPEN EDITOR 138 ----
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(700);
await page.getByRole('button',{name:'Изменить'}).click(); await page.waitForTimeout(3000);
log('\nEDIT URL:',page.url());

// ---- EDITOR: «Состав комиссии» grid headers + members grid height ----
log('\n== EDITOR grids: headers + geometry ==');
log(J(await page.evaluate(()=>{
  const out=[];
  for(const g of document.querySelectorAll('vaadin-grid')){
    const r=g.getBoundingClientRect();
    // header cell contents belonging to this grid
    const hdrs=[...g.querySelectorAll('vaadin-grid-cell-content')]
      .filter(c=>c.assignedSlot||true).map(c=>(c.innerText||'').trim());
    out.push({rect:{w:Math.round(r.width),h:Math.round(r.height)},
      headers:[...new Set(hdrs)].filter(Boolean).slice(0,8)});
  }
  return out;
})));

// ---- «Комментарии членов комиссии» card content ----
log('\n== «Комментарии членов комиссии» text ==');
log(J(await page.evaluate(()=>{
  const h=[...document.querySelectorAll('h1,h2,h3,h4,b,span,div')].find(e=>/^Комментарии членов комиссии/.test((e.textContent||'').trim())&&e.children.length<2);
  if(!h||!h.parentElement)return '(not found)';
  return (h.parentElement.innerText||'').replace(/\s+/g,' ').slice(0,160);
})));

// ---- VOTE dialog «Ваш отзыв» ----
await page.evaluate(()=>{const c=[...document.querySelectorAll('vaadin-grid-cell-content')].find(x=>/НУРМАНБЕТ/.test(x.innerText));c?.click();});
await page.waitForTimeout(400);
await page.getByRole('button',{name:'Проголосовать'}).click().catch(()=>{});
await page.waitForTimeout(1500);
log('\n== VOTE dialog «Ваш отзыв» geometry ==');
log(J(await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].find(d=>d.getBoundingClientRect().width>0);
  if(!ov)return '(no overlay)';
  const card=ov.shadowRoot?.querySelector('[part="overlay"]')||ov;
  const cr=card.getBoundingClientRect();
  const fields=[...ov.querySelectorAll('vaadin-select,vaadin-combo-box,vaadin-text-area,vaadin-text-field,vaadin-upload')].map(e=>{
    const l=e.querySelector('label')?.textContent||e.getAttribute('label')||'';
    const r=e.getBoundingClientRect();
    return {label:l.trim(),tag:e.tagName.toLowerCase(),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width)};
  });
  const btns=[...ov.querySelectorAll('vaadin-button')].map(b=>{
    const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
    return {t:b.innerText.trim(),x:Math.round(r.x),theme:b.getAttribute('theme')||'',bg:cs.backgroundColor,color:cs.color};
  });
  const title=(ov.querySelector('h2,[part="header"], .draggable')?.innerText||'').trim();
  return {dialogW:Math.round(cr.width),dialogX:Math.round(cr.x),title,fields,btns,
    hasClose: !!ov.querySelector('[aria-label*="Close"],[part="close"], vaadin-button[theme*="tertiary"][aria-label]')};
})));
await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(600);

// ---- CONFIRM dialog «Подтверждение» (Одобрить) ----
await page.getByRole('button',{name:'Одобрить'}).click().catch(()=>{});
await page.waitForTimeout(1500);
log('\n== CONFIRM dialog «Подтверждение» ==');
log(J(await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-confirm-dialog-overlay,vaadin-dialog-overlay')].find(d=>/уверены|Подтверждение/i.test(d.innerText||''));
  if(!ov)return '(no confirm overlay)';
  const cr=ov.getBoundingClientRect();
  const btns=[...ov.querySelectorAll('vaadin-button')].map(b=>{
    const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
    return {t:b.innerText.trim(),x:Math.round(r.x),theme:b.getAttribute('theme')||'',bg:cs.backgroundColor,color:cs.color,
      hasSvg:!!b.querySelector('svg,vaadin-icon,iron-icon')};
  });
  const footer=ov.querySelector('[slot="footer"],[part="footer"]');
  const fcs=footer?getComputedStyle(footer):null;
  return {w:Math.round(cr.width),msg:(ov.innerText||'').replace(/\s+/g,' ').trim().slice(0,80),
    btns, footerJustify:fcs?fcs.justifyContent:null};
})));

await ctx.close();
log('\nDONE');
