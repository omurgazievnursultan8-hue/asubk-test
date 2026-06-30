// Capture login/auth screenshots for the user manual.
// Uses a throwaway profile so the login page is always shown.
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const OUT = 'user-manual/images';
const VP = { width: 1440, height: 900 };

const profile = mkdtempSync(join(tmpdir(), 'um-auth-'));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: VP, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
console.log('login url:', page.url());

// 1) empty login form
await page.screenshot({ path: `${OUT}/01-login-empty.png` });

// dump element boxes for precise annotation (CSS px, origin top-left)
const sel = {
  username: 'input[name=username]',
  password: 'input[name=password]',
};
const boxes = {};
for (const [k, s] of Object.entries(sel)) {
  const el = await page.$(s);
  boxes[k] = el ? await el.boundingBox() : null;
}
// submit button
const btn = await page.$('vaadin-button, button[type=submit], button');
boxes.submit = btn ? await btn.boundingBox() : null;
console.log('BOXES', JSON.stringify(boxes));

// 2) filled login form
await page.fill(sel.username, USER);
await page.fill(sel.password, PASS);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02-login-filled.png` });

// 3) submit -> landing page
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
  page.keyboard.press('Enter'),
]);
await page.waitForTimeout(2500);
console.log('after login url:', page.url());
await page.screenshot({ path: `${OUT}/03-home.png` });

await ctx.close();
console.log('done');
