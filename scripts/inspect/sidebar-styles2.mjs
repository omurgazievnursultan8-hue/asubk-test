// Computed styles of the live Jmix list-menu (drawer): groups, links, active state, footer.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(3000);
}
// open the "Система кредитования" group and land on Заемщики so the active style shows
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  document.querySelectorAll('vaadin-details').forEach(d => d.setAttribute('opened', ''));
});
await page.waitForTimeout(800);

const dump = await page.evaluate(() => {
  const cs = (el, keys) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = { text: (el.innerText || '').trim().split('\n')[0].slice(0, 32), w: Math.round(r.width), h: Math.round(r.height) };
    (keys || ['fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'padding', 'margin', 'borderRadius',
      'border', 'textTransform', 'letterSpacing', 'display', 'alignItems', 'gap', 'height', 'minHeight']).forEach(k => o[k] = s[k]);
    return o;
  };
  const res = {};
  res.section = cs(document.querySelector('.jmix-main-view-section'));
  res.title = cs(document.querySelector('.jmix-main-view-application-title'));
  res.titleLink = cs(document.querySelector('.jmix-main-view-application-title-base-link'));
  res.nav = cs(document.querySelector('.jmix-main-view-navigation'));
  res.menuUl = cs(document.querySelector('ul.jmix-list-menu'));
  res.details = cs(document.querySelector('vaadin-details.jmix-menubar-item'));
  const sum = document.querySelector('vaadin-details-summary');
  res.summary = cs(sum);
  res.summaryInner = cs(sum && sum.querySelector('.menubar-summary'));
  res.summaryShadow = sum && sum.shadowRoot ? [...sum.shadowRoot.querySelectorAll('*')].map(e => ({
    part: e.getAttribute('part'), tag: e.tagName.toLowerCase(), ...cs(e, ['padding', 'color', 'fontSize', 'backgroundColor']) })) : null;

  const links = [...document.querySelectorAll('a.jmix-menu-item-link')];
  const active = links.find(a => a.classList.contains('jmix-menu-item-link-highlighted') || a.getAttribute('highlight') !== null
    || location.href.includes(a.getAttribute('href')));
  res.link = cs(links[0]);
  res.linkClasses = links[0] && links[0].getAttribute('class');
  res.linkText = cs(links[0] && links[0].querySelector('.link-text'));
  res.activeLink = cs(active);
  res.activeClasses = active && active.getAttribute('class');
  res.nested = cs(document.querySelector('vaadin-details vaadin-details'));

  // stylesheet rules that touch the menu
  const rules = [];
  for (const ss of document.styleSheets) {
    let rs; try { rs = ss.cssRules; } catch { continue; }
    for (const r of rs) {
      const t = r.cssText || '';
      if (/jmix-list-menu|jmix-menu-item|menubar-summary|menubar-list|jmix-menubar-item|jmix-main-view-section|link-text/.test(t)) rules.push(t);
    }
  }
  res.rules = rules;

  res.tree = [...document.querySelectorAll('ul.jmix-list-menu > li')].map(li => {
    const name = li.querySelector('.menubar-summary')?.textContent?.trim();
    const kids = [...li.querySelectorAll(':scope vaadin-details > div > ul > li')].map(k => ({
      label: k.querySelector(':scope > a .link-text')?.textContent?.trim()
             || k.querySelector(':scope > vaadin-details .menubar-summary')?.textContent?.trim(),
      href: k.querySelector(':scope > a')?.getAttribute('href') || null,
      group: !!k.querySelector(':scope > vaadin-details'),
      sub: [...k.querySelectorAll(':scope > vaadin-details > div > ul > li > a')].map(a => ({
        label: a.querySelector('.link-text')?.textContent?.trim(), href: a.getAttribute('href') })),
    }));
    return { group: name, items: kids };
  });
  return res;
});

writeFileSync('.auth/sidebar-styles2.json', JSON.stringify(dump, null, 2));
await page.screenshot({ path: '.auth/sidebar2.png', clip: { x: 0, y: 0, width: 300, height: 1000 } });
console.log(JSON.stringify(dump.tree, null, 1));
console.log('\nSTYLES:', JSON.stringify({ section: dump.section, title: dump.title, summary: dump.summary,
  summaryInner: dump.summaryInner, link: dump.link, linkText: dump.linkText, activeLink: dump.activeLink,
  activeClasses: dump.activeClasses, nested: dump.nested, menuUl: dump.menuUl }, null, 1));
console.log('\nRULES:\n' + dump.rules.join('\n'));
await ctx.close();
