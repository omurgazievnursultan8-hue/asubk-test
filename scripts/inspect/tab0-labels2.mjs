import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel:'chrome', headless:true, ignoreHTTPSErrors:true,
  viewport:{width:1700,height:1100},
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE + 'loan-applications/41', {waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);

// Use CDP to get the full accessibility tree
const client = await page.context().newCDPSession(page);
const { nodes } = await client.send('Accessibility.getFullAXTree');

// Filter to textbox/input-like nodes with names
const inputs = nodes.filter(n => 
  ['textbox', 'combobox', 'spinbutton', 'listbox'].includes(n.role?.value) &&
  n.name?.value
);
console.log('AX_INPUTS:', JSON.stringify(inputs.slice(0, 60).map(n => ({
  role: n.role?.value,
  name: n.name?.value,
  value: n.value?.value,
  description: n.description?.value,
  readonly: n.readonly?.value,
})), null, 2));
await ctx.close();
