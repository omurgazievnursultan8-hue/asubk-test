import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}

// scroll a grid fully and return its true row objects via the data provider size
async function gridDump(scopeSel) {
  return await page.evaluate(async (scopeSel) => {
    const root = scopeSel ? [...document.querySelectorAll(scopeSel)].pop() : document;
    const grid = (root || document).querySelector('vaadin-grid');
    if (!grid) return { err: 'no grid' };
    const size = grid._effectiveSize ?? grid.size ?? null;
    const colCount = [...grid.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].length;
    const seen = new Map();
    const collect = () => { for (const c of grid.querySelectorAll('vaadin-grid-cell-content')) { const t = c.textContent.trim(); const k = c.getAttribute('slot'); if (k) seen.set(k, t); } };
    collect();
    for (let i = 0; i < (size || 0); i++) { grid.scrollToIndex(i); await new Promise(r=>setTimeout(r,40)); collect(); }
    grid.scrollToIndex(0);
    const cells = [...seen.values()].filter(Boolean);
    return { size, colCount, cells };
  }, scopeSel);
}

// ---- gov-decisions list ----
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const list = await gridDump(null);
log('LIST size(rows):', list.size, 'cols:', list.colCount);
log('LIST has ZZZ test row?', list.cells.some(c=>c.includes('ZZZ ТЕСТ')));
log('LIST statuses present:', JSON.stringify([...new Set(list.cells.filter(r=>/рассмотр|одобр|закры|действ|отклон|чернов|доработ/i.test(r)))]));
const zi = list.cells.findIndex(c=>c.includes('ZZZ ТЕСТ'));
if (zi>=0) log('LIST ZZZ row context:', JSON.stringify(list.cells.slice(zi, zi+9)));

// ---- loan-program picker ----
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('#govDecisionField #entityLookupAction').click({ timeout: 5000 });
await page.waitForTimeout(2500);
const pick = await gridDump('vaadin-dialog-overlay');
log('\nPICKER size(rows):', pick.size, 'cols:', pick.colCount);
log('PICKER has ZZZ test row?', pick.cells.some(c=>c.includes('ZZZ ТЕСТ')));
log('PICKER statuses present:', JSON.stringify([...new Set(pick.cells.filter(r=>/рассмотр|одобр|закры|действ|отклон|чернов|доработ/i.test(r)))]));
log('PICKER all cells:', JSON.stringify(pick.cells));
await ctx.close();
