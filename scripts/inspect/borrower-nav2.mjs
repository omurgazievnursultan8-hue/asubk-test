import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const p = ctx.pages()[0]||await ctx.newPage();
await p.goto('https://fkftest.okmot.kg/loan-applicants',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2500);
const r = await p.evaluate(()=>{
  const wanted=['Приложение','Система кредитования','Поручительства','Корпоративное управление','СУГС','Взыскание задолженности','Справочники','Сервисы','Администрирование','Отчёты','Безопасность','Инструменты данных'];
  const all=[...document.querySelectorAll('*')].filter(e=>e.children.length===0||[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
  const res={};
  for(const w of wanted){
    const el=[...document.querySelectorAll('*')].find(e=>{const t=(e.textContent||'').trim();return t===w && e.getBoundingClientRect().x<280 && e.getBoundingClientRect().width>0;});
    if(el){const b=el.getBoundingClientRect();res[w]={x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width)};}
    else res[w]=null;
  }
  return res;
});
console.log(JSON.stringify(r,null,2));
await ctx.close();
