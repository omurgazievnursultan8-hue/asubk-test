// render fixed mockup states @1600x1000 for sverka vs live
import { chromium } from 'playwright-core';
const FILE='file://'+process.cwd()+'/mockups/loan-application-commission/commission.html';
const ctx=await chromium.launchPersistentContext('.auth/profile-mock',{channel:'chrome',headless:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
const shot=(n,full)=>page.screenshot({path:'.auth/mockx-'+n+'.png',fullPage:!!full});
await page.goto(FILE,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
await shot('list');
// detail 138
await page.evaluate(()=>{selectRow('138');openDetail();}); await page.waitForTimeout(300); await shot('detail138'); await shot('detail138-full',true);
// edit 138
await page.evaluate(()=>{closeToList();selectRow('138');openEdit();}); await page.waitForTimeout(300); await shot('edit138'); await shot('edit138-full',true);
// vote dialog (on edit screen)
await page.evaluate(()=>openVote()); await page.waitForTimeout(300); await shot('votedlg');
await page.evaluate(()=>closeOverlay('ovVote'));
// confirm dialog
await page.evaluate(()=>confirmDecision('approve')); await page.waitForTimeout(300); await shot('confirm');
await page.evaluate(()=>closeOverlay('ovConfirm'));
// create
await page.evaluate(()=>{closeToList();openCreate();}); await page.waitForTimeout(300); await shot('create');
await ctx.close();
console.log('rendered mockx-*.png');
