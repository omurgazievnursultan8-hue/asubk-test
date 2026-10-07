// Shared helpers for the Заявки (loan-applications) QA scripts.
import { chromium } from 'playwright-core';

export const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

export async function open({ headless = true } = {}) {
  const ctx = await chromium.launchPersistentContext('.auth/profile', {
    channel: 'chrome', headless, ignoreHTTPSErrors: true,
    viewport: { width: 1700, height: 1100 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await login(page);
  return { ctx, page };
}

export async function login(page) {
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
}

export async function go(page, route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  if (page.url().includes('/login')) { // session lost (stand redeploys) — log in again
    await login(page);
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  }
  await page.waitForTimeout(1500);
}

// Visible fields / grids / buttons / notifications of the current view.
export function dump(page, { text = false } = {}) {
  return page.evaluate((withText) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const fieldSel = 'vaadin-text-field,vaadin-text-area,vaadin-number-field,vaadin-integer-field,vaadin-big-decimal-field,vaadin-date-picker,vaadin-date-time-picker,vaadin-combo-box,vaadin-select,vaadin-checkbox,vaadin-radio-group,vaadin-multi-select-combo-box,jmix-value-picker,jmix-multi-value-picker,jmix-entity-combo-box';
    const fields = [...document.querySelectorAll(fieldSel)].filter(vis).map(f => {
      const inp = f.querySelector('input,textarea');
      return {
        tag: f.tagName.toLowerCase().replace('vaadin-', '').replace('jmix-', ''),
        label: (f.label || f.getAttribute('label') || f.querySelector(':scope > label')?.innerText
          || f.closest('vaadin-form-item')?.querySelector(':scope > [slot=label]')?.innerText || '').trim(),
        req: f.required || undefined,
        ro: f.readonly || undefined,
        dis: f.disabled || undefined,
        inv: f.invalid || undefined,
        err: f.invalid ? (f.errorMessage || '') : undefined,
        v: (f.tagName === 'VAADIN-CHECKBOX' ? String(f.checked) : (inp?.value ?? f.value ?? '')).toString().slice(0, 80),
      };
    });
    const grids = [...document.querySelectorAll('vaadin-grid')].filter(vis).map(g => ({
      size: g.size ?? g.items?.length,
      cols: [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c => c.header || c.path || '').filter(Boolean),
      cells: [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => c.innerText.trim()).filter(Boolean).slice(0, 80),
    }));
    const buttons = [...document.querySelectorAll('vaadin-button')].filter(vis)
      .map(b => (b.innerText.trim() || b.title || b.getAttribute('aria-label') || '') + (b.disabled ? ' [off]' : ''))
      .filter(b => b && !['Уведомления', 'Выйти'].includes(b));
    const notes = [...document.querySelectorAll('vaadin-notification-card')].map(n => n.innerText.trim()).filter(Boolean);
    const dialogs = [...document.querySelectorAll('vaadin-dialog-overlay')].map(d => d.innerText.trim().slice(0, 600));
    const out = { url: location.pathname + location.search, fields, grids, buttons, notes, dialogs };
    if (withText) {
      const m = document.querySelector('vaadin-app-layout');
      const content = m?.querySelector(':scope > :not([slot])') || document.body;
      out.text = content.innerText.replace(/\n{2,}/g, '\n').slice(0, 5000);
    }
    return out;
  }, text);
}

export async function shot(page, name) {
  await page.screenshot({ path: `.auth/qa-${name}.png`, fullPage: true });
  return `.auth/qa-${name}.png`;
}

export const btn = (page, text) => page.locator('vaadin-button:visible', { hasText: text });
// Vaadin field by its visible label (label is a slotted <label>, not an attribute).
// Labels live either inside the field or on an enclosing vaadin-form-item.
const FIELDS = ':is(vaadin-text-field,vaadin-text-area,vaadin-big-decimal-field,vaadin-integer-field,vaadin-number-field,vaadin-date-picker,vaadin-select,vaadin-combo-box,jmix-value-picker,vaadin-checkbox)';
export const field = (page, label) => {
  const lab = page.locator(`label:text-is("${label}")`);
  const inner = page.locator(`${FIELDS}:visible`, { has: lab });
  const item = page.locator('vaadin-form-item:visible', { has: page.locator(`:scope > label:text-is("${label}")`) })
    .locator(FIELDS);
  return inner.or(item).last();
};
export async function fill(page, label, value) {
  const inp = field(page, label).locator('input,textarea').first();
  await inp.fill(String(value));
  await inp.press('Tab');
  await page.waitForTimeout(700);
}

// All rows of the last visible vaadin-grid (scrolls the virtualised body).
export function gridAll(page) {
  return page.evaluate(async () => {
    const g = [...document.querySelectorAll('vaadin-grid')].filter(x => x.getBoundingClientRect().width > 0).at(-1);
    const rows = new Map();
    const read = () => {
      for (const tr of g.shadowRoot.querySelectorAll('#items tr')) {
        if (tr.hidden || tr.index === undefined || tr.index < 0) continue;
        const cells = [...tr.querySelectorAll('td')].map(td => {
          const slot = td.querySelector('slot')?.name;
          const c = slot && g.querySelector(`[slot="${slot}"]`);
          return c ? c.innerText.trim() : '';
        });
        rows.set(tr.index, cells);
      }
    };
    for (let i = 0; i < (g.size || 0); i += 8) {
      g.scrollToIndex(i);
      await new Promise(r => setTimeout(r, 250));
      read();
    }
    read();
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
  });
}

// Slot names of the cells in the grid row whose text contains `text`
// (last visible grid). Use: page.locator(`[slot="${slots[i]}"]`).
export function rowSlots(page, text) {
  return page.evaluate(async (text) => {
    const g = [...document.querySelectorAll('vaadin-grid')].filter(x => x.getBoundingClientRect().width > 0).at(-1);
    document.querySelectorAll('vaadin-grid[data-qa]').forEach(x => x.removeAttribute('data-qa'));
    g.dataset.qa = 'cur'; // callers scope slot lookups with vaadin-grid[data-qa=cur] > [slot=…]
    const find = () => {
      for (const tr of g.shadowRoot.querySelectorAll('#items tr')) {
        if (tr.hidden) continue;
        const slots = [...tr.querySelectorAll('td slot')].map(s => s.name);
        const txt = slots.map(s => g.querySelector(`[slot="${s}"]`)?.innerText || '').join(' | ');
        if (txt.includes(text)) return slots;
      }
    };
    for (let i = 0; i < (g.size || 0) + 8; i += 4) {
      const s = find(); if (s) return s;
      g.scrollToIndex(i); await new Promise(r => setTimeout(r, 300));
    }
    return find() || null;
  }, text);
}

// Texts of the cells of that row.
export async function rowText(page, text) {
  const slots = await rowSlots(page, text);
  return slots && page.evaluate(ss => ss.map(x =>
    document.querySelector(`vaadin-grid[data-qa=cur] > [slot="${x}"]`)?.innerText.replace(/\s+/g, ' ').trim() ?? ''), slots);
}

// Upload a file into the document row whose name contains `docName`.
export async function uploadDoc(page, docName, file) {
  const slots = await rowSlots(page, docName);
  if (!slots) throw new Error('row not found: ' + docName);
  for (const s of slots) {
    const inp = page.locator(`vaadin-grid[data-qa=cur] > [slot="${s}"] jmix-upload-button input[type=file]`);
    if (await inp.count()) {
      await inp.first().setInputFiles(file);
      await page.waitForTimeout(3000);
      return true;
    }
  }
  throw new Error('no upload in row: ' + docName);
}

// Documents tab, every section: open all vaadin-details, then for each docs grid row
// run `mode`: 'upload' (rows without a file get `file`), or click a row button
// whose text is `mode` (e.g. 'Принять', 'Подтвердить ГФ'). Returns a log.
export async function docsAll(page, mode, file) {
  // open closed sections by real clicks (content is created server-side on the open event);
  // repeat because nested sections appear only after their parent opens
  for (let pass = 0; pass < 3; pass++) {
    const closed = page.locator('vaadin-details:not([opened]) > vaadin-details-summary:visible', { hasText: /·\s*\d+ из \d+/ });
    const k = await closed.count();
    if (!k) break;
    for (let i = 0; i < k; i++) { await closed.first().click(); await page.waitForTimeout(1200); }
  }
  const log = [];
  const n = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('vaadin-grid')].filter(g => g.getBoundingClientRect().width > 0
      && [...g.querySelectorAll('vaadin-grid-cell-content')].some(c => c.innerText.trim() === 'Головной филиал'));
    gs.forEach((g, i) => g.dataset.docs = String(i));
    return gs.length;
  });
  for (let gi = 0; gi < n; gi++) {
    const size = await page.evaluate(gi => document.querySelector(`vaadin-grid[data-docs="${gi}"]`).size, gi);
    for (let ri = 0; ri < size; ri++) {
      const slots = await page.evaluate(async ({ gi, ri }) => {
        const g = document.querySelector(`vaadin-grid[data-docs="${gi}"]`);
        g.scrollToIndex(ri); await new Promise(r => setTimeout(r, 250));
        const tr = [...g.shadowRoot.querySelectorAll('#items tr')].find(t => t.index === ri && !t.hidden);
        return tr ? [...tr.querySelectorAll('td slot')].map(s => s.name) : null;
      }, { gi, ri });
      if (!slots) { log.push(`g${gi} r${ri}: not rendered`); continue; }
      const cell = (i) => page.locator(`vaadin-grid[data-docs="${gi}"] > [slot="${slots[i]}"]`);
      const name = [(await cell(0).innerText()).trim(), (await cell(1).innerText()).trim()].join(' / ').slice(0, 70);
      if (mode === 'upload') {
        // file column position differs between sections — find the cell with the upload button
        let fi = -1;
        for (let i = 0; i < slots.length; i++) if (await cell(i).locator('jmix-upload-button').count()) { fi = i; break; }
        if (fi < 0 || !/Файл не выбран/.test(await cell(fi).innerText())) continue;
        await cell(fi).locator('jmix-upload-button input[type=file]').setInputFiles(file);
        await page.waitForTimeout(2500);
        log.push(`${name}: uploaded`);
      } else {
        const b = cell(slots.length - 1).locator('vaadin-button', { hasText: mode });
        if (await b.count()) { await b.first().click(); await page.waitForTimeout(1200); log.push(`${name}: ${mode}`); }
      }
    }
  }
  // collateral section is a list of row layouts, not a grid
  const coll = page.locator('vaadin-details', { has: page.locator(':scope > vaadin-details-summary', { hasText: /^Залоговые документы/ }) });
  if (await coll.count()) {
    if (mode === 'upload') {
      const ups = coll.locator('jmix-upload-button input[type=file]');
      const k = await ups.count();
      for (let i = 0; i < k; i++) {
        const row = coll.locator('jmix-upload-button').nth(i).locator('xpath=ancestor::*[contains(., "Файл не выбран")][1]');
        if (!(await row.count())) continue;
        await ups.nth(i).setInputFiles(file); await page.waitForTimeout(2500);
        log.push(`залог #${i}: uploaded`);
      }
    } else {
      for (let guard = 0; guard < 20; guard++) {
        const b = coll.locator('vaadin-button:visible', { hasText: mode });
        if (!(await b.count())) break;
        await b.first().click(); await page.waitForTimeout(1200);
        log.push(`залог: ${mode}`);
      }
    }
  }
  return log;
}

// «Заключения» tab: open the department row, set verdict + text, press «Внести».
// verdict 'С условиями' also adds one condition. Returns notes shown after submit.
export async function conclusion(page, dept, verdict, text, condition) {
  const slots = await rowSlots(page, dept);
  const edit = page.locator('#editConclusionButton');
  const row = page.locator(`vaadin-grid[data-qa=cur] > [slot="${slots[0]}"]`);
  await row.click(); await page.waitForTimeout(700);
  if (!(await edit.isEnabled())) { await row.click(); await page.waitForTimeout(700); } // it was selected → toggled off
  await edit.click();
  await page.waitForTimeout(2000);
  await choose(page, 'Вердикт', verdict);
  await field(page, 'Текст заключения').locator('textarea').fill(text);
  if (condition) {
    const creates = page.getByRole('button', { name: 'Создать', exact: true });
    await creates.nth((await creates.count()) - 2).click(); await page.waitForTimeout(1500);
    await page.locator('vaadin-text-area:visible textarea').last().fill(condition);
    await page.getByRole('button', { name: 'OK', exact: true }).last().click(); await page.waitForTimeout(1200);
  }
  await page.getByRole('button', { name: 'Внести', exact: true }).click();
  await page.waitForTimeout(2500);
  const notes = [...await page.locator('vaadin-notification-card').allInnerTexts()];
  if (await page.getByRole('button', { name: 'Внести', exact: true }).count()) {
    await page.getByRole('button', { name: 'Отмена', exact: true }).last().click(); // leave the form on failure
    await page.waitForTimeout(800);
    notes.push('FORM STILL OPEN');
  }
  return notes;
}

// Create an application through the «Новая заявка» dialog and save it.
// Without a program the conditions the editor requires are filled in too.
// Returns { id, number }.
export async function createApp(page, { subject = '21104198900780', search = 'МАРАИМОВ', program = null,
  sum = '1000000', term = '12', comment = 'QA' } = {}) {
  await go(page, 'loan-applications');
  await page.locator('#createButton').click(); await page.waitForTimeout(2000);
  await lookup(page, 'Субъект');
  const f = field(page, 'Субьект содержит').locator('input');
  await f.fill(search); await f.press('Enter'); await page.waitForTimeout(2000);
  await pick(page, subject);
  const ph = field(page, 'Номер телефона').locator('input');
  await ph.click(); await page.keyboard.press('End');
  for (let i = 0; i < 20; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('700123456', { delay: 40 });
  if (program) { await lookup(page, 'Кредитная программа'); await pick(page, program); }
  await fill(page, 'Запрашиваемая сумма', sum);
  await fill(page, 'Запрашиваемый срок', term);
  await field(page, 'Комментарий к заявке').locator('textarea').fill(comment);
  await page.locator('#nextBtn').click(); await page.waitForTimeout(4000);
  if (!program) {
    await page.getByRole('tab', { name: 'Условия кредита', exact: true }).click(); await page.waitForTimeout(1000);
    await choose(page, 'Привязка последнего платежа', 'По дате первого платежа');
    await choose(page, 'Периодичность платежей', 'Ежемесячно');
    await fill(page, 'Годовая ставка, %', '5');
    await fill(page, 'День платежа', '15');
    await lookup(page, 'Валюта'); await pick(page, 'KGS');
    await lookup(page, 'Очередность статей погашения'); await pick(page, 'первочередный');
  }
  await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click();
  await page.waitForTimeout(3500);
  const id = +(page.url().match(/loan-applications\/(\d+)/) || [])[1];
  const number = await field(page, 'Номер документа').locator('input').inputValue().catch(() => '');
  return { id, number };
}

// Pick an option of a vaadin-select by visible text.
export async function choose(page, label, option) {
  const cur = await field(page, label).evaluate(s => s.querySelector('vaadin-select-value-button')?.innerText.trim() || '');
  if (cur === option) return;
  const item = page.locator('vaadin-select-item:visible', { hasText: option }).first();
  for (let i = 0; i < 3 && !(await item.count()); i++) { // overlay of the previous select may still be closing
    await field(page, label).click();
    await page.waitForTimeout(600);
  }
  await item.click();
  await page.waitForTimeout(600);
}

// Open the «…» lookup of a jmix-value-picker by its label.
export async function lookup(page, label) {
  await field(page, label).locator('#entityLookupAction').first().click();
  await page.waitForTimeout(2500);
}

// In an open lookup dialog: filter the grid by text (if a search field exists),
// select the row containing `text`, press «Выбрать».
export async function pick(page, text) {
  // the lookup grid is the last one in DOM; earlier grids sit behind the overlay.
  // rowSlots scrolls the virtualised grid until the row is rendered.
  const slots = await rowSlots(page, text);
  if (!slots) throw new Error('lookup row not found: ' + text);
  const cell = page.locator(`vaadin-grid[data-qa=cur] > [slot="${slots[0]}"]`);
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await page.waitForTimeout(500);
  const sel = page.locator('vaadin-button:visible', { hasText: 'Выбрать' }).last();
  if (await sel.isEnabled()) await sel.click();
  else await cell.dblclick(); // Jmix lookup: double click selects and closes
  await page.waitForTimeout(2000);
}
