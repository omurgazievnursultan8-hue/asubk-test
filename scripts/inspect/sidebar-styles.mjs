// Dump the live app's left navigation: structure, computed styles, screenshot.
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
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(2000);

const out = await page.evaluate(() => {
  const cs = el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.getAttribute('class') || '',
      text: (el.innerText || '').trim().split('\n')[0].slice(0, 40),
      w: Math.round(r.width), h: Math.round(r.height),
      font: s.font, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
      color: s.color, background: s.backgroundColor, border: s.border,
      borderRadius: s.borderRadius, padding: s.padding, margin: s.margin, gap: s.gap,
      display: s.display, textTransform: s.textTransform, letterSpacing: s.letterSpacing,
    };
  };
  const res = {};
  // Jmix/Vaadin app layout drawer
  const drawer = document.querySelector('vaadin-app-layout [slot=drawer]')
    || document.querySelector('[slot=drawer]')
    || document.querySelector('vaadin-side-nav')?.parentElement;
  res.drawer = drawer ? cs(drawer) : null;
  res.drawerHTML = drawer ? drawer.outerHTML.slice(0, 6000) : null;

  const sideNav = document.querySelector('vaadin-side-nav');
  res.sideNav = sideNav ? cs(sideNav) : null;

  res.items = [...document.querySelectorAll('vaadin-side-nav-item')].map(i => {
    const anchor = i.shadowRoot?.querySelector('a') || i.querySelector('a');
    const o = cs(i);
    o.path = i.getAttribute('path');
    o.expanded = i.hasAttribute('expanded');
    o.level = (() => { let n = 0, p = i.parentElement; while (p) { if (p.tagName === 'VAADIN-SIDE-NAV-ITEM') n++; p = p.parentElement; } return n; })();
    if (anchor) o.anchor = cs(anchor);
    return o;
  });

  // hierarchy text
  const walk = (el, d = 0, acc = []) => {
    [...el.children].forEach(c => {
      if (c.tagName === 'VAADIN-SIDE-NAV-ITEM' || c.tagName === 'VAADIN-SIDE-NAV') {
        acc.push('  '.repeat(d) + (c.innerText || '').trim().split('\n')[0]);
        walk(c, d + 1, acc);
      } else walk(c, d, acc);
    });
    return acc;
  };
  res.tree = drawer ? walk(drawer) : [];

  // theme tokens actually in use
  const rs = getComputedStyle(document.documentElement);
  const toks = {};
  ['--lumo-primary-color', '--lumo-primary-text-color', '--lumo-body-text-color', '--lumo-secondary-text-color',
   '--lumo-contrast-5pct', '--lumo-contrast-10pct', '--lumo-contrast-20pct', '--lumo-base-color',
   '--lumo-font-family', '--lumo-font-size-m', '--lumo-font-size-s', '--lumo-border-radius-m',
   '--lumo-space-m', '--lumo-size-m', '--lumo-primary-color-10pct'].forEach(t => toks[t] = rs.getPropertyValue(t).trim());
  res.tokens = toks;
  return res;
});

writeFileSync('.auth/sidebar-styles.json', JSON.stringify(out, null, 2));
await page.screenshot({ path: '.auth/sidebar.png', clip: { x: 0, y: 0, width: 340, height: 1000 } });
console.log('TREE:\n' + out.tree.join('\n'));
console.log('\nDRAWER:', JSON.stringify(out.drawer, null, 1));
console.log('\nITEMS (first 6):', JSON.stringify(out.items.slice(0, 6), null, 1));
console.log('\nTOKENS:', JSON.stringify(out.tokens, null, 1));
await ctx.close();
