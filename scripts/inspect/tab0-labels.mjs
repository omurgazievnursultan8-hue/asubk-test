import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel:'chrome', headless:true, ignoreHTTPSErrors:true,
  viewport:{width:1700,height:1100},
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE + 'loan-applications/41', {waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

// Use page.evaluate to pierce shadow DOM and get labels from vaadin field components
const result = await page.evaluate(() => {
  const TAGS = 'vaadin-text-field,vaadin-integer-field,vaadin-big-decimal-field,vaadin-select,jmix-value-picker,vaadin-combo-box,vaadin-text-area';
  const fields = [];
  for (const el of document.querySelectorAll(TAGS)) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.top < 580) continue; // skip header band
    
    // Try to get label from shadow DOM
    let label = el.getAttribute('label') || '';
    if (!label && el.shadowRoot) {
      const lbl = el.shadowRoot.querySelector('label') || el.shadowRoot.querySelector('[part="label"]');
      label = lbl?.textContent?.trim() || '';
    }
    
    // Try to get from slot
    if (!label) {
      const slot = el.querySelector('[slot="label"]');
      label = slot?.textContent?.trim() || '';
    }
    
    // Get the label from the closest parent with a label-like element
    if (!label) {
      // Try evaluating the label property
      label = el.label || '';
    }
    
    let value = el.value || '';
    if (!value) {
      const input = el.querySelector('input') || el.shadowRoot?.querySelector('input');
      value = input?.value || '';
    }
    
    fields.push({
      tag: el.tagName.toLowerCase(),
      label: String(label).trim(),
      value: String(value).slice(0, 80),
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      readonly: el.readonly === true || el.hasAttribute('readonly'),
    });
  }
  return fields;
});

// Use a different approach: get all shadow roots and find label elements
const shadowLabels = await page.evaluate(() => {
  function getAllShadowElements(root, selector) {
    const results = [];
    function search(node) {
      results.push(...(node.querySelectorAll ? Array.from(node.querySelectorAll(selector)) : []));
      const children = node.querySelectorAll ? Array.from(node.querySelectorAll('*')) : [];
      for (const child of children) {
        if (child.shadowRoot) search(child.shadowRoot);
      }
    }
    search(root);
    return results;
  }
  
  // Find all label elements in shadow roots
  const labels = getAllShadowElements(document, 'label[part="label"]');
  return labels.filter(l => {
    const r = l.getBoundingClientRect();
    return r.width > 0 && r.top > 580;
  }).map(l => ({
    text: l.textContent.trim(),
    y: Math.round(l.getBoundingClientRect().top),
    x: Math.round(l.getBoundingClientRect().left),
  }));
});

console.log('FIELDS:', JSON.stringify(result, null, 2));
console.log('SHADOW_LABELS:', JSON.stringify(shadowLabels, null, 2));
await ctx.close();
