// Dump the live app's visual language: sidebar, filter bar, grid, buttons, Lumo tokens.
// Output: .auth/ui-style.json + screenshots .auth/ui-*.png
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

const PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color',
  'background-color', 'border', 'border-bottom', 'border-radius', 'padding', 'margin', 'height',
  'min-height', 'width', 'box-shadow', 'text-transform'];

const probe = (label, fn) => page.evaluate(([props, src]) => {
  const P = props;
  const cs = (el) => { if (!el) return null; const c = getComputedStyle(el); const o = {}; P.forEach(k => o[k] = c.getPropertyValue(k)); return o; };
  const deep = (host, part) => host?.shadowRoot?.querySelector(part) || null;
  // eslint-disable-next-line no-eval
  return eval('(' + src + ')')({ cs, deep });
}, [PROPS, fn.toString()]);

const out = {};

// ---------- Lumo design tokens ----------
out.tokens = await page.evaluate(() => {
  const c = getComputedStyle(document.documentElement);
  const names = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules || []) {
      if (r.style) for (const p of r.style) if (p.startsWith('--lumo') || p.startsWith('--jmix')) names.push(p);
    }
  }
  const o = {};
  [...new Set(names)].sort().forEach(n => { const v = c.getPropertyValue(n).trim(); if (v) o[n] = v; });
  return o;
});

out.body = await probe('body', ({ cs }) => cs(document.body));
out.html = await probe('html', ({ cs }) => cs(document.documentElement));

// ---------- Sidebar / menu ----------
out.sidebar = await probe('sidebar', ({ cs, deep }) => {
  const layout = document.querySelector('vaadin-app-layout');
  const drawer = deep(layout, '[part="drawer"]');
  const navbar = deep(layout, '[part="navbar"]');
  const menu = document.querySelector('jmix-list-menu, vaadin-side-nav, [slot="drawer"]');
  const item = document.querySelector('jmix-list-menu li, vaadin-side-nav-item, [slot="drawer"] a');
  const anchor = document.querySelector('jmix-list-menu a, [slot="drawer"] a');
  return {
    layoutTag: layout?.tagName,
    drawer: cs(drawer), navbar: cs(navbar), menuRoot: cs(menu),
    item: cs(item), anchor: cs(anchor),
    drawerWidth: drawer ? getComputedStyle(drawer).width : null,
    menuHTML: menu ? menu.outerHTML.slice(0, 3000) : null,
    menuText: menu ? menu.innerText.split('\n').filter(Boolean) : null,
    links: [...document.querySelectorAll('[slot="drawer"] a, jmix-list-menu a')].map(a => ({ t: a.innerText.trim(), h: a.getAttribute('href') })),
  };
});

await page.screenshot({ path: '.auth/ui-home.png', fullPage: false });

// ---------- A list view with filters + grid ----------
for (const route of ['loan-applications', 'loan-applicants']) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const key = route.replace(/[^a-z]/g, '');
  out[key] = await probe(route, ({ cs, deep }) => {
    const grid = document.querySelector('vaadin-grid');
    const hcell = document.querySelector('vaadin-grid-cell-content')?.parentElement;
    const headerCell = grid?.shadowRoot?.querySelector('th');
    const bodyCell = grid?.shadowRoot?.querySelector('td');
    const row = grid?.shadowRoot?.querySelector('tbody tr');
    const tf = document.querySelector('vaadin-text-field');
    const tfBox = deep(tf, '[part="input-field"]');
    const tfLabel = deep(tf, '[part="label"]');
    const cb = document.querySelector('vaadin-combo-box, jmix-value-picker');
    const cbBox = deep(cb, '[part="input-field"]');
    const btn = document.querySelector('vaadin-button');
    const btnPrimary = document.querySelector('vaadin-button[theme~="primary"]');
    const title = [...document.querySelectorAll('h1,h2,h3,.v-view-title,[class*=title]')][0];
    const toolbar = document.querySelector('vaadin-horizontal-layout');
    return {
      title: cs(title), titleText: title?.innerText,
      grid: cs(grid), headerCell: cs(headerCell), bodyCell: cs(bodyCell), row: cs(row),
      textField: cs(tf), textFieldBox: cs(tfBox), textFieldLabel: cs(tfLabel),
      comboBox: cs(cb), comboBoxBox: cs(cbBox),
      button: cs(btn), buttonText: btn?.innerText,
      buttonPrimary: cs(btnPrimary), buttonPrimaryText: btnPrimary?.innerText,
      toolbar: cs(toolbar),
      columns: [...document.querySelectorAll('vaadin-grid-column')].map(c => c.getAttribute('header') || c.getAttribute('path')),
      headerTexts: [...(grid?.querySelectorAll('vaadin-grid-cell-content') || [])].slice(0, 14).map(e => e.innerText.trim()),
    };
  });
  await page.screenshot({ path: `.auth/ui-${key}.png`, fullPage: false });
}

writeFileSync('.auth/ui-style.json', JSON.stringify(out, null, 2));
console.log('tokens:', Object.keys(out.tokens).length);
console.log(JSON.stringify({ body: out.body, sidebar: { drawer: out.sidebar.drawer, anchor: out.sidebar.anchor, links: out.sidebar.links?.slice(0, 20) } }, null, 2));
await ctx.close();
