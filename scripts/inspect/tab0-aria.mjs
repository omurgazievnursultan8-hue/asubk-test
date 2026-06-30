import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel:'chrome', headless:true, ignoreHTTPSErrors:true,
  viewport:{width:1700,height:1100},
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE + 'loan-applications/41', {waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

// Use accessibility tree to get labeled fields
const snap = await page.accessibility.snapshot({ interestingOnly: false });

function flatten(node, depth=0) {
  const results = [];
  if (!node) return results;
  const interesting = node.role && ['textbox','combobox','listbox','spinbutton','select'].includes(node.role);
  if (interesting && node.name) {
    results.push({ name: node.name, value: node.value, role: node.role, depth });
  }
  for (const child of (node.children || [])) {
    results.push(...flatten(child, depth+1));
  }
  return results;
}

const fields = flatten(snap);
// Filter to fields that are in the form area (we can't filter by position in a11y tree, so show all)
console.log('ACCESSIBLE_FIELDS:', JSON.stringify(fields.slice(0, 100), null, 2));
await ctx.close();
