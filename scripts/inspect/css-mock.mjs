import { chromium } from 'playwright-core';
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:1400,height:1100}});
await p.goto('file://'+process.cwd()+'/mockups/loan-program/loan-program.html');
await p.waitForTimeout(300);
await p.evaluate(()=>openCreate());
await p.waitForTimeout(300);
const props=['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderTopWidth','borderTopStyle','borderTopColor','borderTopLeftRadius','paddingLeft','height','boxShadow'];
const out=await p.evaluate((props)=>{
  const pick=(el)=>{if(!el)return null;const c=getComputedStyle(el);const o={};props.forEach(k=>o[k]=c[k]);return o;};
  return {
    input_el:pick(document.querySelector('#wizBody .control input')),
    label:pick(document.querySelector('#wizBody .flabel')),
    section:pick(document.querySelector('#wizBody .section-h')),
    lookup:pick(document.querySelector('#wizBody .lookup')),
    tab:pick(document.querySelector('.tab')),
    btnPrimary:pick(document.querySelector('.footer .btn-primary')),
  };
},props);
console.log(JSON.stringify(out,null,1));
await b.close();
