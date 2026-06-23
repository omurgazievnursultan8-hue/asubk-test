// scripts/inspect/tz/dump-borrower-detail.mjs
// Inspects a borrower (loan-applicant) detail page by navigating directly to a known ID.
// Usage: node scripts/inspect/tz/dump-borrower-detail.mjs [id]
// E.g.: node scripts/inspect/tz/dump-borrower-detail.mjs 11
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

// First get IDs from the list
console.log('\n=== STEP 1: Get borrower IDs from list ===');
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Extract borrower IDs from the grid data
const borrowerIds = await page.evaluate(() => {
  function findGrid(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) {
      if (n.tagName && n.tagName.toLowerCase() === 'vaadin-grid') return n;
      if (n.shadowRoot) { const g = findGrid(n.shadowRoot); if (g) return g; }
      n = w.nextNode();
    }
    return null;
  }
  const g = findGrid(document);
  if (!g) return [];
  const cache = g._dataProviderController?.rootCache;
  if (!cache) return [];
  const items = cache.items || [];
  return items.map(item => ({
    id: item.id,
    inn: item.party?.inn || item.inn,
    name: item.party?.name || item.name,
    type: item.party?.type || item.type,
    status: item.status,
    industry: item.party?.industryDirection?.name || item.industryDirection?.name,
  })).filter(i => i.id).slice(0, 15);
});
console.log('Borrower IDs from grid:', JSON.stringify(borrowerIds, null, 2));

// Try IDs: arg or from grid or try known IDs
const argId = process.argv[2];
const idsToTry = argId ? [argId] :
  (borrowerIds.length > 0 ? borrowerIds.slice(0, 3).map(b => b.id) : ['11', '1', '2', '3', '5']);

const fieldExtractor = async () => page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'jmix-multi-value-picker', 'vaadin-combo-box', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-date-picker', 'vaadin-multi-select-combo-box',
  ];

  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }

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
        value: (el.value !== undefined ? String(el.value) : '').substring(0, 150),
        y: Math.round(r.top),
        x: Math.round(r.left),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

const sectionExtractor = async () => page.evaluate(() => {
  const out = [];
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('h') && /^h[1-6]$/.test(tag)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 120) out.push({ tag, t, y: Math.round(r.top) });
      }
    }
    // Bold/large text sections
    const r = el.getBoundingClientRect();
    if (el.childElementCount === 0 && r.width > 0 && r.height > 0 && r.top > 50 && r.top < 900) {
      const t = (el.innerText || '').trim();
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const fw = parseInt(getComputedStyle(el).fontWeight);
      if (t && t.length > 2 && t.length < 100 && fs >= 13 && fw >= 600) {
        out.push({ tag: el.tagName.toLowerCase() + '(bold)', t, y: Math.round(r.top) });
      }
    }
  }
  return [...new Map(out.map(h => [h.t + h.y, h])).values()].sort((a, b) => a.y - b.y).slice(0, 40);
});

const buttonExtractor = async () => page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const btns = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-button') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 80) btns.push(t);
      }
    }
  }
  return [...new Set(btns)];
});

// Header text extractor (above tabs)
const headerExtractor = async () => page.evaluate(() => {
  const items = [];
  // Look for jmix-main-view-title or similar
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    const cls = (el.className || '').toString();
    const tag = el.tagName.toLowerCase();
    if (cls.includes('main-view') || cls.includes('header') || cls.includes('title') ||
        tag === 'jmix-main-view-title' || tag.includes('title')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top < 300) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 300 && t.length > 2) items.push({ tag, t: t.substring(0, 200), y: Math.round(r.top) });
      }
    }
  }
  return [...new Map(items.map(h => [h.t, h])).values()].sort((a, b) => a.y - b.y).slice(0, 10);
});

// Check for risk-panel specific elements
const riskPanelExtractor = async () => page.evaluate(() => {
  const items = [];
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const KEYWORDS = ['список', 'история', 'кредит', 'просрочк', 'скорин', 'лимит', 'проверк', 'Результат'];
  for (const el of walkAll(document)) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const t = (el.innerText || '').trim();
    if (t && t.length > 3 && t.length < 300 && KEYWORDS.some(k => t.toLowerCase().includes(k.toLowerCase()))) {
      // Avoid large containers — only leaf-ish nodes
      if (el.childElementCount < 3) {
        items.push({ t: t.substring(0, 200), y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
  }
  return [...new Map(items.map(h => [h.t, h])).values()].sort((a, b) => a.y - b.y).slice(0, 30);
});

console.log('\n=== STEP 2: Inspect detail pages ===');
for (const id of idsToTry) {
  const url = BASE + 'loan-applicants/' + id;
  console.log(`\n--- Trying ${url} ---`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const currentUrl = page.url();
  console.log('Actual URL:', currentUrl);

  if (currentUrl.includes('/login') || currentUrl === BASE || currentUrl === BASE + 'loan-applicants') {
    console.log('Redirected away — ID may not exist');
    continue;
  }

  // Screenshot
  await page.screenshot({ path: `.auth/tz-borrower-${id}.png`, fullPage: false });

  // Header
  const headerInfo = await headerExtractor();
  console.log('HEADER:', JSON.stringify(headerInfo));

  // Tabs
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('vaadin-tab')]
      .filter(t => t.getBoundingClientRect().width > 0)
      .map(t => (t.innerText || '').trim())
  );
  console.log('TABS:', JSON.stringify(tabs));

  if (tabs.length === 0) {
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('No tabs. Body text:', bodyText);
    continue;
  }

  // Buttons
  const btns = await buttonExtractor();
  console.log('BUTTONS:', JSON.stringify(btns.filter(b => b.length < 50).slice(0, 30)));

  // All tabs inspection
  for (let i = 0; i < tabs.length; i++) {
    await page.evaluate((idx) => {
      const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
      allTabs[idx] && allTabs[idx].click();
    }, i);
    await page.waitForTimeout(1800);

    const fields = await fieldExtractor();
    const sections = await sectionExtractor();
    await page.screenshot({ path: `.auth/tz-borrower-${id}-tab${i + 1}.png`, fullPage: true });

    console.log(`\n  TAB ${i + 1}: ${tabs[i]}`);
    console.log('  sections:', JSON.stringify(sections.slice(0, 15)));
    console.log('  fields:', JSON.stringify(fields.slice(0, 40)));

    // Extra: check for risk panel on tab 1
    if (i === 0) {
      const riskItems = await riskPanelExtractor();
      console.log('  RISK PANEL items:', JSON.stringify(riskItems));
    }
  }

  // Only process first valid record unless arg was given
  if (!argId && currentUrl.includes('/loan-applicants/')) break;
}

await ctx.close();
