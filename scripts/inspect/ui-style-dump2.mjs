// Second pass: exact styles of menu group header, selected menu item, filter card,
// green "Обновить" button, KPI tiles, grid header cell + sorter, pagination.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const P = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color',
  'border', 'border-radius', 'padding', 'margin', 'height', 'min-height', 'box-shadow', 'gap', 'width'];

const out = await page.evaluate((P) => {
  const cs = (el) => { if (!el) return null; const c = getComputedStyle(el); const o = {}; P.forEach(k => o[k] = c.getPropertyValue(k)); return o; };
  const sh = (host, part) => host?.shadowRoot?.querySelector(part) || null;
  const byText = (sel, re) => [...document.querySelectorAll(sel)].find(e => re.test(e.innerText || ''));

  const appTitle = document.querySelector('.jmix-main-view-application-title');
  const groupDetails = document.querySelector('vaadin-details.jmix-menubar-item');
  const groupSummary = sh(groupDetails, '[part="summary"]') || groupDetails?.querySelector('summary,[slot="summary"]');
  const sel = document.querySelector('a[highlight], .jmix-menu-item-link[highlight], li a[highlight]');
  const selLink = document.querySelector('.jmix-menu-item-link');
  const linkSpan = document.querySelector('.jmix-menu-item-link .link-text');

  // menu item paddings: read the rule from stylesheets too
  const cssRules = [];
  for (const s of document.styleSheets) {
    let r; try { r = s.cssRules; } catch { continue; }
    for (const rule of r || []) {
      const t = rule.cssText || '';
      if (/jmix-menu-item-link|jmix-list-menu|jmix-menubar-item|jmix-main-view-application-title|highlight/.test(t)) cssRules.push(t.slice(0, 400));
    }
  }

  const details = [...document.querySelectorAll('vaadin-details')].find(d => /Фильтр/i.test(d.innerText));
  const filterCard = details?.querySelector('vaadin-vertical-layout, [class*=filter]') || details?.children[1];
  const refresh = byText('vaadin-button', /Обновить/);
  const create = byText('vaadin-button', /Создать/);
  const disabledBtn = byText('vaadin-button', /Изменить/);
  const tile = byText('div,span', /Всего заявок/)?.closest('div');
  const tiles = [...document.querySelectorAll('div')].filter(d => /Всего заявок|На рассмотрении|Одобрено|Отклонено/.test(d.innerText) && d.children.length <= 3 && d.innerText.length < 40);
  const grid = document.querySelector('vaadin-grid');
  const th = sh(grid, 'th');
  const td = sh(grid, 'td');
  const hcontent = grid?.querySelector('vaadin-grid-cell-content');
  const sorter = grid?.querySelector('vaadin-grid-sorter');
  const pag = document.querySelector('jmix-simple-pagination') || byText('div', /строки|строк/);
  const hamb = sh(document.querySelector('vaadin-drawer-toggle'), '[part]') || document.querySelector('vaadin-drawer-toggle');
  const viewTitle = document.querySelector('h1,h2,.jmix-view-title,[class*=view-title]');

  return {
    appTitle: cs(appTitle), appTitleText: appTitle?.innerText,
    groupSummary: cs(groupSummary), groupSummaryText: groupSummary?.innerText,
    selectedLink: cs(sel), selectedText: sel?.innerText,
    link: cs(selLink), linkSpan: cs(linkSpan),
    cssRules: [...new Set(cssRules)],
    detailsHost: cs(details), filterCard: cs(filterCard),
    filterCardHTML: filterCard?.outerHTML.slice(0, 600),
    refresh: cs(refresh), create: cs(create), disabledBtn: cs(disabledBtn),
    tile: cs(tile), tileHTML: tile?.outerHTML.slice(0, 500),
    tilesFound: tiles.map(t => ({ txt: t.innerText.replace(/\n/g, '|'), st: cs(t) })).slice(0, 6),
    th: cs(th), td: cs(td), headerContent: cs(hcontent), sorter: cs(sorter),
    pagination: cs(pag), paginationText: pag?.innerText,
    hamburger: cs(hamb), viewTitle: cs(viewTitle), viewTitleText: viewTitle?.innerText,
  };
}, P);

writeFileSync('.auth/ui-style2.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.cssRules, null, 1));

// loansCredit list page
await page.goto(BASE + 'loansCredit', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: '.auth/ui-loans.png' });
const loans = await page.evaluate(() => {
  const g = document.querySelector('vaadin-grid');
  return {
    headers: [...(g?.querySelectorAll('vaadin-grid-cell-content') || [])].slice(0, 16).map(e => e.innerText.trim()),
    buttons: [...document.querySelectorAll('vaadin-button')].map(b => b.innerText.trim()).filter(Boolean),
    title: document.querySelector('h1,h2,[class*=title]')?.innerText,
  };
});
console.log('LOANS', JSON.stringify(loans, null, 1));
await ctx.close();
