// scripts/inspect/tz/probe-vote-options.mjs
// Opens commission record 29, clicks «Проголосовать» to see vote options
// Usage: node scripts/inspect/tz/probe-vote-options.mjs
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
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

// Use an "На рассмотрении" commission to see Проголосовать options
// Проверка комиссии - 29 (id=29) has status На рассмотрении from record 30
// Let's use record 30 which has На рассмотрении
await page.goto(BASE + 'loan-application-commissions/30', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('URL:', page.url());
await page.screenshot({ path: '.auth/tz-vote-before.png', fullPage: false });

// Capture the "Проголосовать" button and click it
const proBtn = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Проголосовать');
  if (btn) {
    const r = btn.getBoundingClientRect();
    return { found: true, disabled: btn.disabled, y: r.top, x: r.left };
  }
  return { found: false };
});
console.log('Проголосовать button:', JSON.stringify(proBtn));

if (proBtn.found) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Проголосовать');
    if (btn) btn.click();
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '.auth/tz-vote-dialog.png', fullPage: false });

  const overlay = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay');
    if (!ov) return { found: false };
    return { found: true, text: (ov.innerText || '').substring(0, 500) };
  });
  console.log('VOTE DIALOG OVERLAY:', JSON.stringify(overlay));

  // Look for vote option buttons / selects
  const voteButtons = await page.evaluate(() =>
    [...document.querySelectorAll('vaadin-button')]
      .filter(b => b.getBoundingClientRect().width > 0)
      .map(b => ({ t: (b.innerText||'').trim(), disabled: b.disabled }))
  );
  console.log('BUTTONS AFTER ПРОГОЛОСОВАТЬ:', JSON.stringify(voteButtons));

  // Check for select/radio options
  const voteFields = await page.evaluate(() => {
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
      'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
      'vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker',
      'vaadin-radio-group','vaadin-radio-button'];
    return [...document.querySelectorAll(TAGS.join(','))]
      .filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        const fi = el.closest('vaadin-form-item');
        const labelEl = fi ? fi.querySelector('[slot=label]') : null;
        return {
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute('label') || (labelEl ? (labelEl.innerText||'').trim() : '') || ''),
          value: String(el.value||'').substring(0, 100),
          y: Math.round(r.top), x: Math.round(r.left),
        };
      }).sort((a, b) => a.y - b.y || a.x - b.x);
  });
  console.log('VOTE FORM FIELDS:', JSON.stringify(voteFields));

  // Get vaadin-select options if any dialog select is open
  const selectOptions = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('vaadin-list-box vaadin-item, vaadin-combo-box-item').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) results.push((el.innerText||'').trim());
    });
    return results;
  });
  console.log('SELECT OPTIONS:', JSON.stringify(selectOptions));

  console.log('\nURL after vote click:', page.url());
}

// Now check the «Состав комиссии» grid more carefully for «Крайний срок»
await page.goto(BASE + 'loan-application-commissions/29', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Look at all grid column headers
const allGridHeaders = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const headers = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (r.width > 0 && r.height > 0 && t) {
        // headers are typically the first row (lowest y)
        headers.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
  }
  return headers.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 30);
});
console.log('\n=== GRID HEADERS/FIRST ROW FOR RECORD 29 ===');
allGridHeaders.forEach(h => console.log(JSON.stringify(h)));

await ctx.close();
