// Screenshot the quick-login mockup card.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const html = resolve('user-manual/build/quicklogin-mock.html');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 560, height: 760 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
const card = await page.$('.card');
await card.screenshot({ path: 'user-manual/images/05-quicklogin.png' });
await browser.close();
console.log('wrote 05-quicklogin.png');
