// /loan-credits/39 (2026-10-15): lower part of «Договор» — «Параметры кредита» and the three sub-tabs
// (Предмет кредита / Освобождение от порога обеспечения / Перевод долга). Scrolls the tab content and
// screenshots each sub-tab; dumps visible labels/buttons inside the sub-tab area. Read-only.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin', PASS = process.env.OK_PASS || 'admin';
const ID = process.env.LOAN_ID || '39';
const OUT = `.auth/loan-credit-${ID}`; mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile',
  { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER); await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-credits/' + ID, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const out = {};
const subTabs = () => page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ts = [...document.querySelectorAll('vaadin-tabs')].slice(1).find(vis);
  return ts ? [...ts.querySelectorAll('vaadin-tab')].map(t => t.textContent.replace(/\s+/g, ' ').trim()) : [];
});
const names = await subTabs();
out.subTabs = names;
for (let j = 0; j < names.length; j++) {
  await page.evaluate(j => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const ts = [...document.querySelectorAll('vaadin-tabs')].slice(1).find(vis);
    const t = ts.querySelectorAll('vaadin-tab')[j]; t.click(); t.scrollIntoView({ block: 'start' });
  }, j);
  await page.waitForTimeout(1500);
  out[names[j]] = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0; };
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const ts = [...document.querySelectorAll('vaadin-tabs')].slice(1).find(vis);
    const top = ts ? ts.getBoundingClientRect().top : 0;
    const below = el => el.getBoundingClientRect().top > top;
    return {
      fields: [...document.querySelectorAll('[label]')].filter(vis).filter(below).map(f => clean(f.getAttribute('label')) + ' = ' + clean(f.value ?? '')).filter(s => !s.startsWith(' =')),
      buttons: [...document.querySelectorAll('vaadin-button')].filter(vis).filter(below).map(b => clean(b.textContent)).filter(Boolean),
      text: clean([...document.querySelectorAll('span,div,p')].filter(vis).filter(below).filter(e => e.children.length === 0).map(e => e.textContent).join(' | ')).slice(0, 600),
    };
  });
  await page.screenshot({ path: `${OUT}/d-dogovor-sub${j}.png` });
}
writeFileSync(`${OUT}/dogovor-sub.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await ctx.close();
