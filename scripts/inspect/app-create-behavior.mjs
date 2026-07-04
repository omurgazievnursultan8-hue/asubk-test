import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(() => { const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText)); if(b)b.click(); });
await page.waitForTimeout(2500);

const openPicker = (reSrc) => page.evaluate((s) => {
  const re = new RegExp(s,'i');
  const dlg = document.querySelector('vaadin-dialog-overlay');
  const vp = [...dlg.querySelectorAll('jmix-value-picker')].find(v => re.test(v.label||v.getAttribute('label')||''));
  if(!vp) return 'no-picker';
  const btn = vp.querySelector('jmix-value-picker-button, vaadin-button, button');
  if(btn){ btn.click(); return 'ok'; } return 'no-btn';
}, reSrc);

const topLookup = () => page.evaluate(() => {
  const ov = [...document.querySelectorAll('vaadin-dialog-overlay')];
  const lk = ov[ov.length-1];
  const title = lk.querySelector('h2,h3')?.innerText || (lk.innerText||'').split('\n')[0];
  const cells = [...lk.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,16);
  const btns = [...lk.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);
  return {title, btns, cells, overlays: ov.length};
});

const formSnap = () => page.evaluate(() => {
  const dlg = document.querySelector('vaadin-dialog-overlay');
  return [...dlg.querySelectorAll('vaadin-text-field,jmix-value-picker,vaadin-text-area')]
    .filter(e=>e.getBoundingClientRect().width>0)
    .map(el=>({label:(el.label||'').trim()||null, value:(el.value||'').toString().slice(0,60)}));
});

const closeTop = async () => { await page.evaluate(() => {
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')]; const lk=ov[ov.length-1];
  const c=[...lk.querySelectorAll('vaadin-button')].find(b=>/Отмена|Cancel|Закрыть/i.test(b.innerText)); if(c)c.click();
}); await page.waitForTimeout(1200); };

// ---- A. СУБЪЕКТ: open, select a real data row (INN - Name), click Выбрать, read autofill ----
log('### СУБЪЕКТ ###');
log('open:', await openPicker('Субъект')); await page.waitForTimeout(2500);
log('lookup:', JSON.stringify(await topLookup(), null, 1));
const rowClick = await page.evaluate(() => {
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')]; const lk=ov[ov.length-1];
  const cell=[...lk.querySelectorAll('vaadin-grid-cell-content')].find(c=>/\d{8,}\s*-\s*\S/.test(c.innerText));
  if(!cell) return 'no-data-row';
  cell.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  return 'clicked:'+cell.innerText.trim().slice(0,40);
});
log('row click:', rowClick); await page.waitForTimeout(800);
const chose = await page.evaluate(() => {
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')]; const lk=ov[ov.length-1];
  const b=[...lk.querySelectorAll('vaadin-button')].find(b=>/^Выбрать$/i.test(b.innerText.trim()));
  if(b){ b.click(); return 'Выбрать clicked'; } return 'no-Выбрать';
});
log('choose:', chose); await page.waitForTimeout(2500);
log('FORM AFTER SUBJECT:', JSON.stringify(await formSnap(), null, 1));
await page.screenshot({ path: '.auth/behave-after-subject.png', fullPage: true });

// ---- B. КРЕДИТНАЯ ПРОГРАММА lookup (clean) ----
log('\n### КРЕДИТНАЯ ПРОГРАММА ###');
log('open:', await openPicker('Кредитная программа')); await page.waitForTimeout(2500);
log('lookup:', JSON.stringify(await topLookup(), null, 1));
await page.screenshot({ path: '.auth/behave-lookup-program.png', fullPage: true });
await closeTop();

await ctx.close();
