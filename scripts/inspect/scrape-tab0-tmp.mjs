import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel:'chrome', headless:true, ignoreHTTPSErrors:true,
  viewport:{width:1700,height:1100},
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE + 'loan-applications/41', {waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

// Scrape form-item labels and their field values
const data = await page.evaluate(() => {
  // Try vaadin-form-item approach
  const items = [...document.querySelectorAll('vaadin-form-item,vaadin-vertical-layout vaadin-text-field,vaadin-vertical-layout vaadin-integer-field,vaadin-vertical-layout vaadin-big-decimal-field,vaadin-vertical-layout vaadin-select')];
  
  // Better: scrape all text nodes with labels via shadow DOM
  const fields = [];
  
  // Try inner text of the whole form to see what labels exist
  const allText = document.querySelector('vaadin-vertical-layout[class]')?.innerText || 
                  document.body.innerText;
  
  // Get all vaadin-text-field elements with their label attributes
  const tfList = document.querySelectorAll('vaadin-text-field, vaadin-integer-field, vaadin-big-decimal-field, vaadin-select, vaadin-combo-box, jmix-value-picker');
  
  for (const tf of tfList) {
    const rect = tf.getBoundingClientRect();
    if (rect.width < 1) continue;
    const labelAttr = tf.getAttribute('label') || '';
    const labelEl = tf.querySelector('[slot=label]') || tf.shadowRoot?.querySelector('label');
    const labelText = labelEl?.textContent?.trim() || labelAttr;
    let value = tf.getAttribute('value') || tf.value || '';
    if (!value) {
      const input = tf.querySelector('input') || tf.shadowRoot?.querySelector('input');
      value = input?.value || '';
    }
    fields.push({
      tag: tf.tagName.toLowerCase(),
      label: labelText,
      value: String(value).slice(0, 80),
      x: Math.round(rect.left),
      y: Math.round(rect.top),
    });
  }
  return fields;
});

// Also try to get vaadin-form-item labels
const formItems = await page.evaluate(() => {
  const result = [];
  const items = document.querySelectorAll('vaadin-form-item');
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (rect.width < 1) continue;
    const labelSlot = item.querySelector('[slot=label]');
    const label = labelSlot?.textContent?.trim() || '';
    const field = item.querySelector('vaadin-text-field, vaadin-integer-field, vaadin-big-decimal-field, vaadin-select, jmix-value-picker');
    const value = field?.value || field?.getAttribute('value') || '';
    if (label) result.push({ label, value: String(value).slice(0, 80), y: Math.round(rect.top) });
  }
  return result;
});

console.log('FORM_ITEMS:', JSON.stringify(formItems, null, 2));
console.log('FIELDS:', JSON.stringify(data, null, 2));

// Also get all visible text for section headers  
const sections = await page.evaluate(() => {
  const result = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let node;
  while (node = walker.nextNode()) {
    const txt = node.textContent?.trim();
    if (!txt || txt.length > 80 || seen.has(txt)) continue;
    const el = node.parentElement;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.y < 550 || rect.y > 1300) continue;
    const cs = getComputedStyle(el);
    const fw = parseInt(cs.fontWeight) || 400;
    if (fw >= 500) { seen.add(txt); result.push({ txt, y: Math.round(rect.top), fw }); }
  }
  return result;
});
console.log('VISIBLE_TEXT:', JSON.stringify(sections, null, 2));

await ctx.close();
