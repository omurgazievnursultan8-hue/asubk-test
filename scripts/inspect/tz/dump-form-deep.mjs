// scripts/inspect/tz/dump-form-deep.mjs
// Deep form field extractor for gov-decisions/new — tries multiple strategies.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
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
  await page.waitForTimeout(2000);
}

// Go directly to the create URL
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

await page.screenshot({ path: '.auth/tz-form-deep.png', fullPage: true });

const result = await page.evaluate(() => {
  // Strategy 1: querySelectorAll with deep pierce via >>> (not supported everywhere)
  // Strategy 2: Recursive shadow DOM walk collecting ALL elements with labels

  const allElements = [];

  function collectAll(root, depth) {
    if (depth > 20) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const tag = node.tagName.toLowerCase();
      const label = node.getAttribute?.('label') || node.getAttribute?.('aria-label') || '';
      const placeholder = node.getAttribute?.('placeholder') || '';
      const type = node.getAttribute?.('type') || '';
      const required = node.hasAttribute?.('required');
      const readonly = node.hasAttribute?.('readonly');
      const disabled = node.hasAttribute?.('disabled');

      // Collect anything that looks like a form field
      if (
        label ||
        (node.tagName.match(/^VAADIN-|^JMIX-/i))
      ) {
        allElements.push({
          tag,
          label,
          placeholder,
          type,
          required,
          readonly,
          disabled,
          id: node.id || '',
          class: (node.className || '').toString().slice(0, 60),
        });
      }

      if (node.shadowRoot) collectAll(node.shadowRoot, depth + 1);
      node = walker.nextNode();
    }
  }

  collectAll(document, 0);

  // Also grab all label elements
  function collectLabels(root) {
    const labels = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'label' || tag === 'span') {
        const t = (node.textContent || '').trim();
        if (t && t.length < 80 && t.length > 1) labels.push({ tag, text: t });
      }
      if (node.shadowRoot) labels.push(...collectLabels(node.shadowRoot));
      node = walker.nextNode();
    }
    return labels;
  }

  const labels = collectLabels(document);

  return { url: location.href, title: document.title, elements: allElements, labels: labels.slice(0, 100) };
});

console.log(JSON.stringify(result, null, 2));
await ctx.close();
