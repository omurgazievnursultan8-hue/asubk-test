// commission-mockshot — render local mockup, exercise buttons, screenshot each screen
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
const FILE = pathToFileURL(process.cwd()+'/mockups/loan-application-commission/commission.html').href;
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1200}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
page.on('console',m=>{ if(m.type()==='error') log('PAGE ERR:',m.text()); });
page.on('pageerror',e=>log('PAGEERROR:',e.message));
await page.goto(FILE,{waitUntil:'load'}); await page.waitForTimeout(400);
log('LIST crumb:', await page.textContent('#crumbTitle'));
log('rows:', await page.$$eval('#view-list tbody tr', rs=>rs.map(r=>r.querySelector('td').textContent.trim())));
log('pager:', await page.textContent('.pager span'));
log('Одобрено num:', await page.$$eval('.statcard', cs=>cs.map(c=>c.querySelector('.sc-lbl').textContent+'='+c.querySelector('.sc-num').textContent)));
await page.screenshot({path:'.auth/mock-commission-list.png'});

// select row 139 → Изменить should be disabled
await page.click('#row139'); await page.waitForTimeout(200);
log('after sel 139 → btnEdit disabled?', await page.getAttribute('#btnEdit','disabled')!==null,
    '| btnView disabled?', await page.getAttribute('#btnView','disabled')!==null);
// Просмотр 139
await page.click('#btnView'); await page.waitForTimeout(300);
log('DETAIL 139 crumb:', await page.textContent('#crumbTitle'),
    '| tipResh:', await page.textContent('#d-tipresh'),
    '| final:', await page.textContent('#d-final'),
    '| prot:', JSON.stringify(await page.textContent('#d-prot')),
    '| datez:', await page.textContent('#d-datez'),
    '| histCnt:', await page.textContent('#cnt-hist'));
await page.screenshot({path:'.auth/mock-commission-detail139.png'});
await page.click('.btn-close'); await page.waitForTimeout(200); // Закрыть

// select row 138 → Изменить enabled
await page.click('#row138'); await page.waitForTimeout(200);
log('after sel 138 → btnEdit disabled?', await page.getAttribute('#btnEdit','disabled')!==null);
// Просмотр 138
await page.click('#btnView'); await page.waitForTimeout(300);
log('DETAIL 138 tipResh:', await page.textContent('#d-tipresh'),'| final:', await page.textContent('#d-final'),'| histCnt:', await page.textContent('#cnt-hist'));
await page.screenshot({path:'.auth/mock-commission-detail138.png'});
await page.click('.btn-close'); await page.waitForTimeout(200);

// Изменить 138 → editor
await page.click('#row138'); await page.waitForTimeout(150);
await page.click('#btnEdit'); await page.waitForTimeout(300);
log('EDITOR crumb:', await page.textContent('#crumbTitle'),
    '| e-num:', await page.textContent('#e-num'),
    '| e-members rows:', await page.$$eval('#e-members tr', rs=>rs.length),
    '| buttons:', await page.$$eval('#view-edit .decision-btns .btn', bs=>bs.map(b=>b.textContent.trim())));
await page.screenshot({path:'.auth/mock-commission-edit138.png', fullPage:true});
// Проголосовать dialog
await page.click('#view-edit .link-btn'); await page.waitForTimeout(300);
log('VOTE dialog open?', await page.getAttribute('#ovVote','class'),
    '| head:', await page.textContent('#ovVote .dlg-head'),
    '| fields:', await page.$$eval('#ovVote .dlg-body .flabel', ls=>ls.map(l=>l.textContent)));
await page.screenshot({path:'.auth/mock-commission-votedlg.png'});
await page.click('#ovVote .btn-close'); await page.waitForTimeout(200);
// Одобрить confirm
await page.click('.btn-approve'); await page.waitForTimeout(300);
log('CONFIRM open?', await page.getAttribute('#ovConfirm','class'),'| msg:', await page.textContent('#confirmMsg'));
await page.screenshot({path:'.auth/mock-commission-confirm.png'});
await page.click('#ovConfirm .btn-primary'); await page.waitForTimeout(200); // Да
log('after Да crumb:', await page.textContent('#crumbTitle'));

// back to list, then Создать → editor new
await page.evaluate(()=>closeToList()); await page.waitForTimeout(200);
await page.click('.toolbar .btn-primary'); await page.waitForTimeout(300);
log('CREATE e-num:', await page.textContent('#e-num'),'| e-members rows:', await page.$$eval('#e-members tr', rs=>rs.length));
await page.screenshot({path:'.auth/mock-commission-create.png', fullPage:true});
await ctx.close();
log('\nDONE');
