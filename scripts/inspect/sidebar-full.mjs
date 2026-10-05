// Full dump of the live app's left navigation.
// The drawer is a nest of <vaadin-details> accordions; leaves are <a href>.
// Opens every accordion, then walks the drawer recording depth, label and route.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', process.env.OK_USER || 'admin');
  await page.fill('input[name=password]', process.env.OK_PASS || 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(4000);
}
await page.waitForTimeout(2500);
console.log('URL:', page.url());

// open every accordion (repeat: nested ones only render once the parent opens)
for (let pass = 0; pass < 6; pass++) {
  const n = await page.evaluate(() => {
    let opened = 0;
    document.querySelectorAll('vaadin-details').forEach(d => {
      if (!d.hasAttribute('opened')) { d.setAttribute('opened', ''); d.opened = true; opened++; }
    });
    return opened;
  });
  await page.waitForTimeout(900);
  console.log(`pass ${pass}: opened ${n}`);
  if (n === 0) break;
}

const out = await page.evaluate(() => {
  const drawer = document.querySelector('vaadin-app-layout [slot=drawer]') || document.querySelector('[slot=drawer]');
  const res = [];
  const walk = (el, d) => {
    [...el.children].forEach(c => {
      const tag = c.tagName.toLowerCase();
      if (tag === 'vaadin-details') {
        const sum = [...c.children].find(x => x.tagName === 'VAADIN-DETAILS-SUMMARY')
          || c.querySelector('[slot=summary]');
        res.push({ d, kind: 'group', label: (sum?.innerText || '').trim().replace(/\s+/g, ' ') });
        walk(c, d + 1);
      } else if (tag === 'a') {
        res.push({ d, kind: 'link', label: (c.innerText || '').trim().replace(/\s+/g, ' '),
                   href: c.getAttribute('href') });
      } else if (tag !== 'vaadin-details-summary') {
        walk(c, d);
      }
    });
  };
  if (drawer) walk(drawer, 0);
  return { res, details: document.querySelectorAll('vaadin-details').length,
           anchors: drawer ? drawer.querySelectorAll('a').length : 0 };
});

const lines = out.res.map(i => `${'  '.repeat(i.d)}${i.kind === 'group' ? '▸ ' : '· '}${i.label}${i.href ? '   [' + i.href + ']' : ''}`);
writeFileSync('.auth/sidebar-full.json', JSON.stringify(out, null, 2));
writeFileSync('.auth/sidebar-full.txt', lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nGROUPS: ${out.details}  LINKS: ${out.anchors}`);
await ctx.close();
