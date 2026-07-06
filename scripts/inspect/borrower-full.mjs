// Phase 4 — full scrape of the borrower (Заёмщик) detail page for an exact mockup.
// Login -> /loan-applicants list -> open a real record -> walk every tab, dump
// field labels/values, the «Результаты проверок» risk panel, header, toolbar.
// Writes .auth/borrower/*.png screenshots + .auth/borrower.json structural dump.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
mkdirSync('.auth/borrower', { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}

const out = { list: {}, header: null, toolbar: null, tabs: [], tabDumps: {} };

// ---------- LIST ----------
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '.auth/borrower/00-list.png', fullPage: true });
out.list.url = page.url();
out.list.toolbar = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].map(b => b.textContent.trim()).filter(Boolean));
out.list.columns = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-cell-content')].slice(0, 20).map(c => c.textContent.trim()));

// open first data row (double-click forces edit per P4-01)
const rowId = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  const c = cells.find(x => /^\d{6,}$/.test(x.textContent.trim())); // INN-looking cell
  if (c) c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  return c ? c.textContent.trim() : null;
});
out.list.openedInn = rowId;
await page.waitForTimeout(3000);
out.detailUrl = page.url();

// ---------- DETAIL: header + toolbar ----------
const grabText = sel => page.evaluate(s => {
  const el = document.querySelector(s);
  return el ? el.innerText.replace(/\n{3,}/g, '\n\n').trim() : null;
}, sel);

out.header = await page.evaluate(() => {
  // header region = everything above the tabsheet
  const tabsheet = document.querySelector('vaadin-tabsheet, vaadin-tabs');
  const body = document.body.innerText;
  return { firstLines: body.split('\n').filter(Boolean).slice(0, 25) };
});
out.toolbar = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].map(b => ({
    label: b.textContent.trim(),
    disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
  })).filter(b => b.label));

// tab labels
out.tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')].map(t => t.textContent.trim()).filter(Boolean));

await page.screenshot({ path: '.auth/borrower/01-detail-tab0.png', fullPage: true });

// dump all form fields (label + value + type) helper
const dumpFields = () => page.evaluate(() => {
  const fields = [];
  const seen = new Set();
  document.querySelectorAll('vaadin-text-field, vaadin-text-area, vaadin-combo-box, vaadin-select, vaadin-date-picker, vaadin-number-field, vaadin-integer-field, vaadin-checkbox, vaadin-big-decimal-field').forEach(el => {
    const label = el.getAttribute('label') || el.querySelector('label')?.textContent?.trim() || '';
    const inp = el.querySelector('input, textarea');
    const value = inp ? inp.value : (el.value ?? '');
    const key = label + '|' + value + '|' + el.tagName;
    if (seen.has(key)) return; seen.add(key);
    fields.push({ tag: el.tagName.toLowerCase(), label, value, readonly: el.hasAttribute('readonly'), required: el.hasAttribute('required') });
  });
  return fields;
});

// section headings + any risk-panel text
const dumpSections = () => page.evaluate(() => {
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*=title],[class*=header],[class*=caption],legend,vaadin-details summary')]
    .map(h => h.textContent.trim()).filter(t => t && t.length < 80);
  return [...new Set(heads)];
});

// ---------- walk each tab ----------
const tabEls = await page.$$('vaadin-tab');
for (let i = 0; i < tabEls.length; i++) {
  const label = (await tabEls[i].textContent()).trim();
  await tabEls[i].click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `.auth/borrower/tab${i}-${label.replace(/[^\wА-Яа-я]+/g, '_').slice(0, 20)}.png`, fullPage: true });
  out.tabDumps[label] = {
    fields: await dumpFields(),
    sections: await dumpSections(),
    text: (await page.evaluate(() => document.body.innerText)).replace(/\n{3,}/g, '\n\n').slice(0, 4000),
  };
}

// full outerHTML of the detail view container for exact-copy reference
out.detailHtml = await page.evaluate(() => {
  const root = document.querySelector('main') || document.querySelector('vaadin-app-layout') || document.body;
  return root.outerHTML.slice(0, 200000);
});

writeFileSync('.auth/borrower.json', JSON.stringify(out, null, 2));
console.log('LIST toolbar:', out.list.toolbar.join(' | '));
console.log('opened INN:', out.list.openedInn, ' detailUrl:', out.detailUrl);
console.log('TABS:', out.tabs.join(' | '));
console.log('toolbar:', out.toolbar.map(b => b.label + (b.disabled ? '(off)' : '')).join(' | '));
console.log('header first lines:\n', out.header.firstLines.join('\n'));
console.log('wrote .auth/borrower.json + .auth/borrower/*.png');
await ctx.close();
