import { chromium } from 'playwright-core';

const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
p.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
p.on('pageerror', err => errors.push(err.message));

await p.goto('file:///home/azamat/projects/asubk-credit-module/mockups/dictionaries/dictionaries.html');
await p.waitForTimeout(500);

// Check 1: nav items rendered
const navItemCount = await p.evaluate(() =>
  document.querySelectorAll('.nav-item').length
);

// Check 2: filter «валют» — only order-term-currencies section should be visible
await p.fill('#nav-filter', 'валют');
await p.waitForTimeout(200);

const filterResult = await p.evaluate(() => {
  const sections = Array.from(document.querySelectorAll('.section'));
  const visible = sections.filter(s => s.style.display !== 'none');
  const visibleRoutes = visible.map(s => s.dataset.route);
  const navItems = Array.from(document.querySelectorAll('.nav-item'));
  const visibleNavItems = navItems.filter(a => a.style.display !== 'none');
  const visibleNavRoutes = visibleNavItems.map(a => a.dataset.route);
  return { visibleRoutes, visibleNavRoutes };
});

// Check 3: click a nav item scrolls
await p.fill('#nav-filter', '');
await p.waitForTimeout(200);
// Reset all sections visibility
await p.evaluate(() => {
  document.querySelectorAll('.section').forEach(s => s.style.display = '');
  document.querySelectorAll('.nav-item').forEach(a => a.style.display = '');
});

// Click a nav item deep in the list (e.g. organizations)
await p.click('.nav-item[data-route="organizations"]');
await p.waitForTimeout(600);

const scrollCheck = await p.evaluate(() => {
  const dictList = document.querySelector('.dict-list');
  // scrollTop should have changed from 0, confirming scroll happened
  return { scrollTop: dictList?.scrollTop };
});

await p.screenshot({ path: '/home/azamat/projects/asubk-credit-module/.auth/dict-mockup-t5.png', fullPage: false });
await b.close();

console.log('Console errors:', errors.length, errors);
console.log('Nav item count:', navItemCount);
console.log('Filter «валют» result:', JSON.stringify(filterResult, null, 2));
console.log('Scroll check (dict-list scrollTop after click):', scrollCheck);

const filterOk = filterResult.visibleRoutes.length === 1 &&
  filterResult.visibleRoutes[0] === 'order-term-currencies' &&
  filterResult.visibleNavRoutes.length === 1 &&
  filterResult.visibleNavRoutes[0] === 'order-term-currencies';

const scrollOk = scrollCheck.scrollTop > 0;

const allOk = errors.length === 0 && navItemCount > 0 && filterOk && scrollOk;
console.log('filter OK:', filterOk);
console.log('scroll OK:', scrollOk);
console.log('PASS:', allOk);
process.exit(allOk ? 0 : 1);
