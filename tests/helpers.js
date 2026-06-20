// Shared helpers for ASUBK UI tests. DOM patterns verified 2026-06-20 against the
// live stand (Jmix-on-Vaadin). Field labels live in shadow DOM, so we drive the
// create form by control order, not by visible label text.
const { expect } = require('@playwright/test');
const stamp = () => new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

// Fill the editable (non-readonly) text fields in DOM order.
// Gov-decision order: [0] Наименование, [1] Краткое, [2] Код, [3] Номер решения.
async function fillEditableText(page, values) {
  const inputs = page.locator('vaadin-text-field:not([readonly]) input');
  for (let i = 0; i < values.length; i++) await inputs.nth(i).fill(values[i]);
}

// Open a jmix-value-picker lookup screen and pick the row matching `label`.
async function pickLookup(page, label) {
  await page.locator('#entityLookupAction, jmix-value-picker [role=button]').first().click();
  const overlay = page.locator('vaadin-dialog-overlay').last();
  await overlay.waitFor({ state: 'visible', timeout: 10000 });
  await overlay.locator('vaadin-grid-cell-content').filter({ hasText: label }).first().dblclick();
  await overlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
}

// Create a gov decision end to end; returns the unique name marker.
// Verified via the success toast — the default list shows ONLY approved (Одобрен)
// records, so a freshly-created На-рассмотрении record is NOT visible there
// (see notes/qa-findings.md P1-06). Do not assert the row in the list.
async function createDecision(page, name) {
  await page.goto('/gov-decisions/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await fillEditableText(page, [name, 'QA кратк', `QA-код-${name}`, `№${name}`]);
  await pickLookup(page, 'Постановление');
  await page.locator('vaadin-button').filter({ hasText: 'OK' }).first().click();
  await expect(
    page.locator('vaadin-notification-card').filter({ hasText: 'успешно сохранена' })
  ).toBeVisible({ timeout: 15000 });
  return name;
}

async function gotoList(page) {
  await page.goto('/gov-decisions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

// Surface a row by name: AUTQA-* markers (Latin) sort to the top of the
// Наименование column ascending. Sorter cycles asc->desc->none, so retry.
async function ensureRowVisible(page, text) {
  const cell = page.locator('vaadin-grid-cell-content').filter({ hasText: text });
  for (let i = 0; i < 3; i++) {
    if (await cell.count()) return;
    await page.locator('vaadin-grid-sorter').first().click();
    await page.waitForTimeout(1200);
  }
}

// Select a grid row by clicking a cell that contains `text`.
async function selectRow(page, text) {
  await ensureRowVisible(page, text);
  const cell = page.locator('vaadin-grid-cell-content').filter({ hasText: text }).first();
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await page.waitForTimeout(500);
}

// Values of all read-only text fields on the current form/view.
async function readonlyValues(page) {
  return page.locator('vaadin-text-field[readonly] input').evaluateAll((els) => els.map((e) => e.value));
}

module.exports = { stamp, fillEditableText, pickLookup, createDecision, gotoList, ensureRowVisible, selectRow, readonlyValues };
