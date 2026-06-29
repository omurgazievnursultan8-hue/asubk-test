// Render a self-contained HTML file to PDF via playwright-core + system Chrome.
// Usage: node scripts/render-pdf.mjs <input.html> <output.pdf>
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [, , inArg, outArg] = process.argv;
if (!inArg || !outArg) { console.error('usage: render-pdf.mjs <in.html> <out.pdf>'); process.exit(1); }

const inPath = resolve(inArg);
const outPath = resolve(outArg);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(inPath).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
});
await browser.close();
console.log('PDF →', outPath);
