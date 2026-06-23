// scripts/inspect/tz/dump-form-alllabels.mjs
// Finds ALL label-like elements on the gov-decisions/new page.
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

await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  const labels = [];
  const inputs = [];

  function walk(root, depth) {
    if (depth > 30) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const tag = node.tagName.toLowerCase();

      // Collect label elements
      if (tag === 'label') {
        const t = (node.textContent || '').trim();
        const forAttr = node.getAttribute('for') || '';
        if (t) labels.push({ text: t, for: forAttr, depth });
      }

      // Collect input-like elements
      if (['input', 'textarea', 'select'].includes(tag)) {
        inputs.push({
          tag,
          id: node.id || '',
          name: node.getAttribute('name') || '',
          type: node.getAttribute('type') || '',
          placeholder: node.getAttribute('placeholder') || '',
          required: node.hasAttribute('required'),
          readonly: node.hasAttribute('readonly'),
          value: (node.value || '').slice(0, 50),
        });
      }

      if (node.shadowRoot) walk(node.shadowRoot, depth + 1);
      node = walker.nextNode();
    }
  }

  walk(document, 0);

  return { labels: labels.slice(0, 200), inputs: inputs.slice(0, 50), url: location.href };
});

console.log(JSON.stringify(result, null, 2));
await ctx.close();
