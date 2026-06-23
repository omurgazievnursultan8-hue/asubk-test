// Probe what fields appear for «Диапазон» type on срок selector (tab 2, select[1])
// and check if any program has Диапазон for сумма set.
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

const extractFields = () => page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'vaadin-combo-box', 'vaadin-select', 'vaadin-checkbox', 'vaadin-date-picker',
    'vaadin-multi-select-combo-box',
  ];
  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
    return (l || '').replace(/\s+/g, ' ').trim() || null;
  };
  const valueOf = (el) => {
    if (el.tagName.toLowerCase() === 'vaadin-select') {
      const btn = el.shadowRoot?.querySelector('[part="value"]') || el.shadowRoot?.querySelector('slot[name="value"]');
      return el.value;
    }
    if (el.value !== undefined && el.value !== null && el.value !== '') return String(el.value);
    return null;
  };
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      label: labelOf(el),
      value: valueOf(el),
      y: Math.round(el.getBoundingClientRect().top),
      x: Math.round(el.getBoundingClientRect().left),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

// Open create wizard, go to tab 2
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /Создать/i.test(b.innerText));
  b && b.click();
});
await page.waitForTimeout(3000);

await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[1] && allTabs[1].click();
});
await page.waitForTimeout(2000);

// Click select[1] (Тип срока) to open it
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (selects[1]) selects[1].click();
});
await page.waitForTimeout(1000);

const srokOpts = await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-select-item')].filter(i => i.getBoundingClientRect().height > 0)
    .map(i => ({ text: i.innerText.trim(), value: i.value }));
});
console.log('Тип срока options:', JSON.stringify(srokOpts));

// Click Диапазон for срок
const clickedSrok = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item')];
  const d = items.find(i => /Диапазон/i.test(i.innerText) && i.getBoundingClientRect().height > 0);
  if (d) { d.click(); return { clicked: true, text: d.innerText }; }
  return { clicked: false };
});
console.log('Click Диапазон for срок:', JSON.stringify(clickedSrok));
await page.waitForTimeout(2000);

const tab2SrokDiapazon = await extractFields();
console.log('Tab 2 after Диапазон for СУММА=default, СРОК=Диапазон:');
tab2SrokDiapazon.forEach(f => console.log(`  ${f.tag} label="${f.label}" value="${f.value}" x=${f.x}`));
await page.screenshot({ path: '.auth/probe-srok-diapazon.png', fullPage: true });

// Now also select Диапазон for сумма
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (selects[0]) selects[0].click();
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item')];
  const d = items.find(i => /Диапазон/i.test(i.innerText) && i.getBoundingClientRect().height > 0);
  if (d) d.click();
});
await page.waitForTimeout(2000);

const tab2BothDiapazon = await extractFields();
console.log('Tab 2 with BOTH СУММА=Диапазон and СРОК=Диапазон:');
tab2BothDiapazon.forEach(f => console.log(`  ${f.tag} label="${f.label}" value="${f.value}" x=${f.x}`));
await page.screenshot({ path: '.auth/probe-both-diapazon-final.png', fullPage: true });

// Now open program 13 which already has Диапазон ставку — check tab 2 too
console.log('\n=== Program 13 (тест1): open edit directly ===');
await page.goto(BASE + 'loan-programs/13', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('URL:', page.url());

// Check tab 1 (name)
const t1 = await extractFields();
console.log('Tab1 fields with values:');
t1.filter(f => f.value).forEach(f => console.log(`  ${f.label}: ${f.value}`));

// Tab 2
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[1] && allTabs[1].click();
});
await page.waitForTimeout(2000);
const t2 = await extractFields();
console.log('Program 13 Tab 2:');
t2.forEach(f => console.log(`  ${f.tag} label="${f.label}" value="${f.value}"`));

// Tab 3
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[2] && allTabs[2].click();
});
await page.waitForTimeout(2000);
const t3 = await extractFields();
console.log('Program 13 Tab 3:');
t3.forEach(f => console.log(`  ${f.tag} label="${f.label}" value="${f.value}"`));

// Try multiple programs to find one with filled сумма range
console.log('\n=== Try other programs for values ===');
// From list: programs seen are /13 and others
// Try a few IDs directly
for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15]) {
  await page.goto(BASE + `loan-programs/${id}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  if (!page.url().includes(`loan-programs/${id}`)) continue;

  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0).map(t => t.innerText.trim())
  );
  if (tabs.length === 0) continue;

  // Get program name from tab 1
  const nameFields = await page.evaluate(() => {
    const fields = [...document.querySelectorAll('vaadin-text-field, vaadin-text-area')].filter(f => f.getBoundingClientRect().width > 0);
    return fields.map(f => ({ label: f.label || f.getAttribute('label') || '', value: f.value })).filter(f => f.value);
  });

  // Tab 2
  await page.evaluate(() => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[1] && allTabs[1].click();
  });
  await page.waitForTimeout(1500);

  const t2vals = await page.evaluate(() => {
    const TAGS = ['vaadin-big-decimal-field', 'vaadin-integer-field', 'vaadin-select'];
    return [...document.querySelectorAll(TAGS.join(','))].filter(e => e.getBoundingClientRect().width > 0)
      .map(e => {
        const labelOf = (el) => {
          let l = el.label || el.getAttribute('label');
          if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
          return (l || '').trim();
        };
        return { tag: e.tagName.toLowerCase(), label: labelOf(e), value: e.value };
      });
  });

  // Tab 3
  await page.evaluate(() => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[2] && allTabs[2].click();
  });
  await page.waitForTimeout(1500);

  const t3vals = await page.evaluate(() => {
    const TAGS = ['vaadin-big-decimal-field', 'vaadin-integer-field', 'vaadin-select', 'vaadin-multi-select-combo-box'];
    return [...document.querySelectorAll(TAGS.join(','))].filter(e => e.getBoundingClientRect().width > 0)
      .map(e => {
        const labelOf = (el) => {
          let l = el.label || el.getAttribute('label');
          if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
          return (l || '').trim();
        };
        return { tag: e.tagName.toLowerCase(), label: labelOf(e), value: e.value };
      });
  });

  const hasValues = t2vals.some(f => f.value && f.value !== '1') || t3vals.some(f => f.value && f.value !== '1');
  console.log(`ID ${id}: name=${nameFields[0]?.value || '?'}, tab2=${JSON.stringify(t2vals)}, tab3=${JSON.stringify(t3vals)}`);
}

await ctx.close();
console.log('\nDONE');
