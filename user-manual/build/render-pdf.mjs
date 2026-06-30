// Render manual.html -> PDF via headless Chromium.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const HTML = resolve('user-manual/build/manual.html');
const OUT = 'user-manual/Руководство-пользователя-01-Авторизация.pdf';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '14mm', left: '0', right: '0' },
});
await browser.close();
console.log('wrote', OUT);
