import { chromium } from 'playwright-core';
const file = 'file:///home/azamat/projects/asubk-credit-module/mockups/decision/decisions.html';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
await p.goto(file);
await p.click('#btnCreate');
await p.waitForSelector('#createView', { state: 'visible' });

await p.click('#createOk');
console.log('CASE1 empty -> errShown=%s invalids=%d onForm=%s',
  await p.isVisible('#createErr.show'),
  await p.locator('#createView .invalid').count(),
  await p.isVisible('#createView'));
console.log('  text:', (await p.textContent('#createErrText')).trim());

await p.fill('#createView .create-form .field .control input', 'Тест решение');
await p.click('#createOk');
console.log('CASE2 name filled -> invalids=%d', await p.locator('#createView .invalid').count());
console.log('  text:', (await p.textContent('#createErrText')).trim());

// fill everything valid (name, short, num, date) + pick kind via lookup
const inputs = p.locator('#createView .create-form .field .control input');
await inputs.nth(3).fill('Кратко');   // short
await inputs.nth(4).fill('123');      // num
await p.fill('#decisionDate', '01.01.2020');
await p.dispatchEvent('#decisionDate', 'change');
// pick kind: open lookup
await p.click('#createView .lookup .pick');
await p.waitForTimeout(150);
const row = p.locator('#lkRows tr, #lookupRows tr').first();
if (await row.count()) { await row.click(); const sel = p.locator('#lkSelect, #lookupSelect').first(); await sel.click(); }
await p.waitForTimeout(100);
await p.click('#createOk');
console.log('CASE3 all valid -> onForm(createView visible)=%s listView visible=%s',
  await p.isVisible('#createView'), await p.isVisible('#listView'));

await b.close();
