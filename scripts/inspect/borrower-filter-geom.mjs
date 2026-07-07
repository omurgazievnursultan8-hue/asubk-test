import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel:'chrome', headless:true, ignoreHTTPSErrors:true, viewport:{width:1600,height:1000}});
const p = ctx.pages()[0] || await ctx.newPage();
await p.goto('https://fkftest.okmot.kg/loan-applicants',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2500);
const g = await p.evaluate(()=>{
  const pick=el=>{const r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
  const sel=document.querySelector('vaadin-select');
  // entity picker for industry: a field with value/dots
  const pickers=[...document.querySelectorAll('vaadin-custom-field, vaadin-text-field, [class*=picker], vaadin-combo-box')];
  const out={select: sel?pick(sel):null};
  // find element whose label mentions Отрас
  const lab=[...document.querySelectorAll('*')].find(e=>/Субъект\.Отрас/.test(e.textContent||'')&&e.children.length<3);
  out.labelОтрасль = lab?pick(lab):null;
  // all form fields in filter card region (y<300)
  out.fields=[...document.querySelectorAll('vaadin-select,vaadin-text-field,vaadin-combo-box,input')].map(e=>{
    const r=e.getBoundingClientRect(); if(r.y>320||r.width<20)return null;
    return {tag:e.tagName.toLowerCase(),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};
  }).filter(Boolean);
  return out;
});
console.log(JSON.stringify(g,null,2));
await ctx.close();
