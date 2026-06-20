// Render the gov-decision mockups (mockups/*.html) to PNG for embedding in the
// decision-tasks documents. No login needed — local file:// pages.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const OUT = 'guides/decision-tasks/img';
const SHOTS = [
  { file: 'mockups/decision-detail.html',   out: 'mockup-detail.png' },
  { file: 'mockups/decision-reject.html',   out: 'mockup-reject.png' },
  { file: 'mockups/decision-create.html',   out: 'mockup-create.png' },
  { file: 'mockups/decision-workflow.html', out: 'mockup-workflow.png' },
  { file: 'mockups/decision-delete.html',   out: 'mockup-delete.png' },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
for (const s of SHOTS) {
  const url = pathToFileURL(resolve(s.file)).href;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${s.out}`, fullPage: true });
  console.log('rendered', s.out);
}

// Detail mockup: activate the «Документы» tab (data-tab="2") and capture both the
// full page (tab active) and a tight crop of just the documents panel.
const detailUrl = pathToFileURL(resolve('mockups/decision-detail.html')).href;
await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
await page.click('.tab[data-tab="2"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/mockup-detail-documents.png`, fullPage: true });
console.log('rendered mockup-detail-documents.png');
await page.locator('[data-panel="2"]').screenshot({ path: `${OUT}/mockup-documents-panel.png` });
console.log('rendered mockup-documents-panel.png');

await browser.close();
