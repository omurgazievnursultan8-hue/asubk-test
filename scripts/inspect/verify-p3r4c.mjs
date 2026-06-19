import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE + 'loan-application-commissions/20', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);
await page.screenshot({ path: '.auth/p3r4-final-section.png', fullPage: true });
// pierce shadow: walk all nodes incl shadow roots, collect form controls near "Финальное решение"
const r = await page.evaluate(() => {
  const out = [];
  const walk = (root) => {
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) walk(el.shadowRoot);
      const tag = el.tagName.toLowerCase();
      if (/vaadin-(select|combo-box|text-field|big-decimal|date-picker)/.test(tag)) {
        out.push({ tag, label: (el.getAttribute('label')||'').trim(),
          disabled: el.hasAttribute('disabled'), readonly: el.hasAttribute('readonly') });
      }
    });
  };
  walk(document);
  return out;
});
console.log(JSON.stringify(r, null, 2));
await ctx.close();
