// scripts/inspect/tz/dump-loan-program-tabs.mjs
// Walks the 9-tab create wizard of loan-programs, captures fields per tab.
// Usage: node scripts/inspect/tz/dump-loan-program-tabs.mjs
// Output: JSON { tabs, tabData[] } to stdout + screenshot per tab in .auth/
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();

// Login
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

// Navigate to loan-programs and click Создать
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /Создать/i.test(b.innerText));
  b && b.click();
});
await page.waitForTimeout(3000);

// Get tab names
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('TABS:', JSON.stringify(tabs));

// Field extractor (shadow-DOM aware)
const extractFields = async () => page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'jmix-multi-value-picker', 'vaadin-combo-box', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-date-picker', 'vaadin-multi-select-combo-box',
  ];

  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) {
      const id = el.getAttribute('aria-labelledby');
      if (id) { const t = id.split(' ').map(i => document.getElementById(i)?.innerText || '').join(' ').trim(); if (t) l = t; }
    }
    if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
    if (!l && el.shadowRoot) { const sr = el.shadowRoot.querySelector('[part=label]'); if (sr) l = sr.innerText; }
    return (l || '').replace(/\s+/g, ' ').trim() || null;
  };

  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: labelOf(el),
        required: el.required === true || el.hasAttribute('required'),
        readonly: el.readonly === true || el.hasAttribute('readonly'),
        y: Math.round(r.top),
        x: Math.round(r.left),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

// Section header extractor
const extractSections = async () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount) return;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.top < 150) return;
    const t = (e.innerText || '').trim();
    const fs = parseFloat(getComputedStyle(e).fontSize);
    const fw = parseInt(getComputedStyle(e).fontWeight);
    if (t && t.length < 80 && fs >= 14 && fw >= 600) out.push({ t, y: Math.round(r.top) });
  });
  return [...new Map(out.map(h => [h.t + h.y, h])).values()].sort((a, b) => a.y - b.y);
});

// Button extractor
const extractButtons = async () => page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim())
    .filter(t => t && t.length < 60)
);

const results = [];

for (let i = 0; i < tabs.length; i++) {
  // Click tab
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[idx] && allTabs[idx].click();
  }, i);
  await page.waitForTimeout(2000);

  // For tab 8 (Залоговое обеспечение): toggle the checkbox to reveal conditional fields
  if (i === 7) {
    await page.evaluate(() => {
      document.querySelectorAll('vaadin-checkbox').forEach(c => {
        if (!c.checked) {
          c.checked = true;
          c.dispatchEvent(new Event('change', { bubbles: true }));
          c.dispatchEvent(new Event('checked-changed', { bubbles: true }));
        }
      });
    });
    await page.waitForTimeout(1500);
  }

  const fields = await extractFields();
  const sections = await extractSections();
  const buttons = await extractButtons();
  await page.screenshot({ path: `.auth/tz-lp-tab${i + 1}.png`, fullPage: true });

  results.push({ tabIndex: i + 1, tabName: tabs[i], sections, fields, buttons });
  console.log(`--- TAB ${i + 1}: ${tabs[i]} ---`);
  console.log('sections:', JSON.stringify(sections));
  console.log('fields:', JSON.stringify(fields));
  console.log('buttons:', JSON.stringify(buttons.filter(b => /OK|Сохранить|Отмена|Подтверждени|Создать|Добавить|Удалить|Исключить|Выбра/i.test(b))));
}

console.log('\n=== FULL DUMP ===');
console.log(JSON.stringify(results, null, 2));

await ctx.close();
