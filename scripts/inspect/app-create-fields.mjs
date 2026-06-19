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

// click «Создать»
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /Создать/i.test(b.innerText));
  if (b) { b.click(); return true; } return false;
});
log('Создать clicked:', clicked);
await page.waitForTimeout(2500);

function dumpFields() {
  return page.evaluate(() => {
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker'];
    return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => ({
      tag: el.tagName.toLowerCase(),
      label: (el.label ?? el.getAttribute('label') ?? (el.querySelector('label')?.innerText) ?? '').trim() || null,
      required: el.required===true||el.hasAttribute('required'),
      readonly: el.readonly===true||el.hasAttribute('readonly'),
      disabled: el.disabled===true||el.hasAttribute('disabled'),
      hasError: el.invalid===true,
      errMsg: el.errorMessage ?? null,
      min: el.min ?? null, max: el.max ?? null, step: el.step ?? null,
      value: (el.value||'').toString().slice(0,40)
    }));
  });
}
function dialogButtons() {
  return page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay') || document;
    return [...dlg.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);
  });
}
function dialogTitle() {
  return page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay');
    return dlg ? (dlg.querySelector('h2,h3,[slot=title],.dialog-title')?.innerText || dlg.innerText.split('\n')[0]) : null;
  });
}

let step = 1;
for (; step <= 6; step++) {
  log(`\n===== STEP ${step} =====`);
  log('TITLE:', await dialogTitle());
  log('FIELDS:', JSON.stringify(await dumpFields(), null, 1));
  const btns = await dialogButtons();
  log('BUTTONS:', JSON.stringify(btns));
  await page.screenshot({ path: `.auth/app-create-step${step}.png`, fullPage: true });
  const hasNext = btns.some(b => /Далее|Next/i.test(b));
  if (!hasNext) { log('no Далее — last step'); break; }
  const adv = await page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay') || document;
    const b = [...dlg.querySelectorAll('vaadin-button')].find(b => /Далее|Next/i.test(b.innerText));
    if (b) { b.click(); return true; } return false;
  });
  if (!adv) break;
  await page.waitForTimeout(2000);
}
await ctx.close();
