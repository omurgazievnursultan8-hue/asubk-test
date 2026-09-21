// Smoke the navigation mockup: JS errors, counts, autocollapse, role slicing.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
const FILE = pathToFileURL(process.cwd() + '/mockups/navigation/navigation.html').href;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(FILE, { waitUntil: 'load' });
await page.waitForTimeout(400);

const stat = async () => page.evaluate(() => ({
  sub: document.getElementById('brandSub').textContent,
  secs: [...document.querySelectorAll('.sec')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
  items: document.querySelectorAll('.itm').length,
  note: document.getElementById('roleNote').textContent.slice(0, 150),
  cards: [...document.querySelectorAll('.card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
}));

console.log('=== админ, «стало»');
let s = await stat();
console.log(' ', s.sub);
console.log('  разделы:', s.secs.join(' | '));
console.log('  карточки:', s.cards.join(' · '));

for (const [id, who] of [['cur_coll', 'куратор залога'], ['treasury', 'казначейство'],
                         ['sugs', 'специалист СУГС'], ['rep_auth', 'уполномоченный по отчётности']]) {
  await page.selectOption('#role', id);
  await page.waitForTimeout(250);
  s = await stat();
  console.log(`\n=== ${who}`);
  console.log(' ', s.sub);
  console.log('  разделы:', s.secs.join(' | '));
  console.log('  note:', s.note);
}

await page.selectOption('#role', 'admin');
await page.click('#view button[data-v=old]');
await page.waitForTimeout(250);
s = await stat();
console.log('\n=== админ, «было»');
console.log(' ', s.sub);
console.log('  разделы:', s.secs.join(' | '));

await page.click('#view button[data-v=new]');
await page.waitForTimeout(200);
await page.fill('#q', 'ставк');
await page.waitForTimeout(200);
console.log('\nпоиск «ставк»:', await page.textContent('#tblCount'));

await page.fill('#q', '');
await page.click('.chip[data-f=hidden]');
await page.waitForTimeout(200);
console.log('фильтр «скрыты»:', await page.textContent('#tblCount'));

await page.click('.chip[data-f=all]');
await page.waitForTimeout(300);
await page.screenshot({ path: '.auth/navigation-mock.png', fullPage: false });
await page.selectOption('#role', 'cur_coll');
await page.waitForTimeout(300);
await page.screenshot({ path: '.auth/navigation-mock-role.png', clip: { x: 0, y: 0, width: 760, height: 620 } });

console.log('\nОШИБКИ:', errs.length ? errs : 'нет');
await browser.close();
