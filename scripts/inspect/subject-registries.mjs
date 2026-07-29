/* Съём реальных экранов «Физ лица» (individuals) и «Организации» (organizations)
   на стенде fkftest — для макета субъекта. Снимаем: тулбар списка, колонки, первую строку,
   форму карточки (вкладки, поля, что readonly), скриншоты. */
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const OUT = '.auth/subject';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2000);
}
console.log('LOGIN URL:', page.url());

/* Дамп экрана-списка: заголовок, кнопки тулбара, колонки грида, первая строка. */
async function dumpList(route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const txt = el => (el?.innerText || '').trim().replace(/\s+/g, ' ');
    const btns = [...document.querySelectorAll('vaadin-button, button')]
      .map(b => txt(b)).filter(Boolean);
    const cols = [...document.querySelectorAll('vaadin-grid-cell-content')]
      .map(c => txt(c)).filter(Boolean).slice(0, 40);
    const fields = [...document.querySelectorAll('vaadin-text-field, vaadin-combo-box, vaadin-select, vaadin-date-picker')]
      .map(f => f.getAttribute('label') || f.getAttribute('placeholder') || '').filter(Boolean);
    return { title: document.title, h: txt(document.querySelector('h1,h2,.jmix-title')), btns, cols, fields };
  });
  console.log(`\n===== LIST ${route} =====`);
  console.log('title:', info.title, '| h:', info.h);
  console.log('toolbar:', JSON.stringify(info.btns));
  console.log('filter fields:', JSON.stringify(info.fields));
  console.log('grid cells (первые 40):', JSON.stringify(info.cols));
  await page.screenshot({ path: `${OUT}-${route}-list.png`, fullPage: false });
  return info;
}

/* Открыть первую запись: выделяем строку кликом по первой ячейке данных,
   затем жмём «Просмотр» в тулбаре (двойной клик по vaadin-grid-cell-content не проходит). */
async function dumpDetail(route, firstCellText) {
  const before = page.url();
  try {
    await page.locator('vaadin-grid').first().waitFor({ timeout: 10000 });
    await page.getByText(firstCellText, { exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Просмотр' }).first().click({ timeout: 10000 });
  } catch (e) {
    console.log('open fail:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const txt = el => (el?.innerText || '').trim().replace(/\s+/g, ' ');
    /* Метка поля в Jmix-Vaadin приходит и атрибутом label, и слотом <label slot="label">,
       и через aria-labelledby — берём первое, что нашлось. */
    const labelOf = f => {
      const a = f.getAttribute('label');
      if (a) return a;
      const slotted = f.querySelector('label, [slot="label"]');
      if (slotted) return txt(slotted);
      const id = f.getAttribute('aria-labelledby');
      if (id) return txt(document.getElementById(id.split(' ')[0]));
      return '';
    };
    const SEL = 'vaadin-text-field, vaadin-text-area, vaadin-combo-box, vaadin-select,'
      + ' vaadin-date-picker, vaadin-checkbox, vaadin-number-field, vaadin-integer-field,'
      + ' vaadin-big-decimal-field, jmix-entity-picker, jmix-value-picker, jmix-multi-value-picker';
    const flds = [...document.querySelectorAll(SEL)].map(f => ({
      label: labelOf(f),
      tag: f.tagName.toLowerCase().replace(/^(vaadin|jmix)-/, ''),
      ro: f.hasAttribute('readonly') || f.hasAttribute('disabled'),
      req: f.hasAttribute('required'),
      val: (f.value ?? '').toString().slice(0, 40),
    }));
    const tabs = [...document.querySelectorAll('vaadin-tab')].map(t => txt(t)).filter(Boolean);
    const btns = [...document.querySelectorAll('vaadin-button, button')].map(b => txt(b)).filter(Boolean);
    /* Сырой текст формы — страховка, когда метки не достаются структурно. */
    const form = document.querySelector('vaadin-form-layout, .jmix-form-layout, main, vaadin-vertical-layout');
    return { url: location.href, title: document.title, tabs, btns, flds, raw: txt(form).slice(0, 3000) };
  });
  console.log(`\n===== DETAIL ${route} =====`);
  console.log('url:', info.url, '(было', before + ')');
  console.log('title:', info.title);
  console.log('tabs:', JSON.stringify(info.tabs));
  console.log('buttons:', JSON.stringify(info.btns));
  console.log('fields:');
  for (const f of info.flds) {
    console.log(`  · ${f.label || '(без метки)'} [${f.tag}]${f.req ? ' *' : ''}${f.ro ? ' RO' : ''}${f.val ? ' = ' + f.val : ''}`);
  }
  console.log('raw form text:\n' + info.raw);
  await page.screenshot({ path: `${OUT}-${route}-detail.png`, fullPage: true });
  return info;
}

/* Что даёт форма в режиме правки и в режиме создания — RO выше объясняется mode=readonly,
   а вопрос макета в другом: какие поля вообще редактируемы руками, а какие приходят импортом. */
async function dumpEditable(route, id, label) {
  const url = id ? `${BASE}${route}/${id}` : `${BASE}${route}/new`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const txt = el => (el?.innerText || '').trim().replace(/\s+/g, ' ');
    const SEL = 'vaadin-text-field, vaadin-text-area, vaadin-combo-box, vaadin-select,'
      + ' vaadin-date-picker, vaadin-checkbox, vaadin-number-field, jmix-entity-picker, jmix-value-picker';
    const flds = [...document.querySelectorAll(SEL)].map(f => ({
      label: f.getAttribute('label') || '',
      ro: f.hasAttribute('readonly') || f.hasAttribute('disabled'),
      req: f.hasAttribute('required'),
    }));
    return { url: location.href, tabs: [...document.querySelectorAll('vaadin-tab')].map(t => txt(t)),
             btns: [...document.querySelectorAll('vaadin-button, button')].map(b => txt(b)).filter(Boolean), flds };
  });
  console.log(`\n===== ${label} ${route} =====`);
  console.log('url:', info.url, '| tabs:', JSON.stringify(info.tabs), '| btns:', JSON.stringify(info.btns));
  for (const f of info.flds) {
    console.log(`  · ${f.label || '(без метки)'}${f.req ? ' *' : ''}${f.ro ? ' RO' : ' [правится]'}`);
  }
  await page.screenshot({ path: `${OUT}-${route}-${label}.png`, fullPage: true });
}

/* Вкладки карточки организации: «Учредители» и «Организационная структура» — свои гриды. */
async function dumpOrgTabs(id) {
  await page.goto(`${BASE}organizations/${id}?mode=readonly`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  for (const tab of ['Учредители', 'Организационная структура']) {
    try {
      await page.getByRole('tab', { name: tab }).first().click({ timeout: 8000 });
    } catch (e) { console.log(`tab ${tab} fail:`, e.message.split('\n')[0]); continue; }
    await page.waitForTimeout(1500);
    const cells = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-cell-content')]
      .map(c => (c.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 24));
    console.log(`\n----- ORG TAB «${tab}» -----`);
    console.log(JSON.stringify(cells));
    await page.screenshot({ path: `${OUT}-org-tab-${tab}.png`, fullPage: true });
  }
}

const FIRST_CELL = {
  individuals: '20907199400957',
  organizations: '"Кыргыз Республикасынын Финансы министрлигине караштуу Финансы-кредиттик фонд" мекемеси',
};
for (const route of ['individuals', 'organizations']) {
  await dumpList(route);
  await dumpDetail(route, FIRST_CELL[route]);
}
await dumpEditable('individuals', 7, 'EDIT-URL');
await dumpEditable('individuals', null, 'NEW-URL');
await dumpEditable('organizations', 3, 'EDIT-URL');
await dumpEditable('organizations', null, 'NEW-URL');
await dumpOrgTabs(3);

/* Правка через кнопку «Изменить» списка (прямой URL всегда уходит в mode=readonly). */
async function dumpEditViaButton(route, firstCellText) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  try {
    await page.getByText(firstCellText, { exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Изменить' }).first().click({ timeout: 10000 });
  } catch (e) { console.log('edit fail:', e.message.split('\n')[0]); }
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const SEL = 'vaadin-text-field, vaadin-combo-box, vaadin-date-picker, jmix-value-picker';
    return { url: location.href, flds: [...document.querySelectorAll(SEL)]
      .map(f => ({ label: f.getAttribute('label') || '(без метки)',
                   ro: f.hasAttribute('readonly') || f.hasAttribute('disabled') })) };
  });
  console.log(`\n===== EDIT-BUTTON ${route} =====\nurl: ${info.url}`);
  for (const f of info.flds) console.log(`  · ${f.label}${f.ro ? ' RO' : ' [правится]'}`);
  await page.screenshot({ path: `${OUT}-${route}-edit-button.png`, fullPage: true });
}
await dumpEditViaButton('individuals', FIRST_CELL.individuals);
await dumpEditViaButton('organizations', FIRST_CELL.organizations);

/* Что делает «Заполнить поля»: вводим ИНН существующего лица и смотрим, подтянутся ли поля.
   Ничего не сохраняем — выходим по «Отмена». */
async function probeFill(route, inn) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  try {
    await page.getByRole('button', { name: 'Создать' }).first().click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const first = page.locator('vaadin-text-field:not([readonly])').first();
    await first.click({ timeout: 8000 });
    await page.keyboard.type(inn, { delay: 30 });
    await page.getByRole('button', { name: 'Заполнить поля' }).first().click({ timeout: 10000 });
    await page.waitForTimeout(3500);
  } catch (e) { console.log('fill probe fail:', e.message.split('\n')[0]); }
  const after = await page.evaluate(() => {
    const SEL = 'vaadin-text-field, jmix-value-picker';
    const vals = [...document.querySelectorAll(SEL)].map(f => (f.value ?? '').toString().slice(0, 40));
    const notif = [...document.querySelectorAll('vaadin-notification-card, .v-notification')]
      .map(n => (n.innerText || '').trim()).filter(Boolean);
    return { vals, notif, url: location.href };
  });
  console.log(`\n===== FILL PROBE ${route} (ИНН ${inn}) =====`);
  console.log('url:', after.url, '| notif:', JSON.stringify(after.notif));
  console.log('values:', JSON.stringify(after.vals));
  await page.screenshot({ path: `${OUT}-${route}-fill.png`, fullPage: true });
  await page.getByRole('button', { name: 'Отмена' }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
await probeFill('individuals', '21812199600888');   /* Бектурганов Эрнис — есть в реестре */

await ctx.close();
