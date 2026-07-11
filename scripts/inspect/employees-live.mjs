// Inspect live "Сотрудники подразделения" screen (group Приложение) — dump list + detail.
// Usage: node scripts/inspect/employees-live.mjs   (creds via OK_USER/OK_PASS, default admin/admin)
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const OUT = '.auth';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}
log('URL after login:', page.url());

// ---- open the menu item by visible text (route-agnostic) ----
async function clickText(txt) {
  const el = page.getByText(txt, { exact: true }).first();
  if (await el.count()) { await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
  return false;
}
// Jmix side menu: expand ONLY parent group "Приложение", then click the leaf link.
await clickText('Приложение');
await page.waitForTimeout(600);
// leaf is an <a>/menu link; use role=link to avoid matching collapsed dupes
async function clickLink(txt) {
  for (const loc of [page.getByRole('link', { name: txt, exact: true }),
                     page.getByText(txt, { exact: true })]) {
    const el = loc.first();
    if (await el.count() && await el.isVisible().catch(()=>false)) {
      await el.click().catch(()=>{}); return true;
    }
  }
  return false;
}
// Proven-working path: getByText clicks (pierce shadow) + body.innerText (renders shadow text).
async function click(t) {
  const el = page.getByText(t, { exact: true }).first();
  if (await el.count()) { await el.click({ force: true }).catch(()=>{}); return true; }
  return false;
}
// direct route (user-specified): /employees
await page.goto(BASE + 'employees', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
log('leaf clicked: DIRECT /employees');
await page.waitForLoadState('networkidle').catch(()=>{});
await page.waitForTimeout(3000);
log('URL list:', page.url());
await page.screenshot({ path: `${OUT}/emp-live-list.png`, fullPage: true });
const listText = await page.locator('body').innerText();
log('\n===== LIST innerText =====\n' + listText.slice(0, 2500));

// open EDIT of first employee (populated) to enumerate fields per tab
await click('БЕКТУРГАНОВ ЭРНИС НУРДИНОВИЧ');  // select row
await page.waitForTimeout(600);
await click('Изменить');
await page.waitForTimeout(2800);
await page.waitForLoadState('networkidle').catch(()=>{});

const TABS = ['Основная информация','Паспортные данные','Образование','Состав семьи',
  'Награды, чин, взыскания','Стаж работы','Командировки и отпуска','Контактные данные'];
// menu/noise lines to strip
const NOISE = new Set(['Сотрудник','Сотрудники','Сотрудники подразделения','АСУБК','[admin]','Online',
  'Подразделения','Освоение','Резерв','Платеж','Список Траншей','LoanLedger','Решение суда',
  'Приложение','Система кредитования','Поручительства','Корпоративное управление','СУГС',
  'Взыскание задолженности','Справочники','Сервисы','Администрирование','Отчеты','Безопасность',
  'Инструменты данных','OK','Отмена', ...TABS]);
for (const tab of TABS) {
  await click(tab);
  await page.waitForTimeout(900);
  const t = await page.locator('body').innerText();
  const lines = [...new Set(t.split('\n').map(s=>s.trim()).filter(s=>s && !NOISE.has(s)))];
  log(`\n===== TAB: ${tab} =====`);
  log(lines.join(' | '));
  await page.screenshot({ path: `${OUT}/emp-tab-${TABS.indexOf(tab)}.png` });
}

await ctx.close();
log('\nscreens: .auth/emp-tab-0..7.png');
