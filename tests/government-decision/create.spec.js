// Phase 1 — Government decision · create form UI.
// Route: /gov-decisions/new. Mutating tests create records (markers AUTQA-*).
// See requirements/features/01-government-decision.md. DOM verified 2026-06-20.
const { test, expect } = require('@playwright/test');
const { createDecision, stamp } = require('../helpers');

const todayISO = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

test.describe('Gov decision — create form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gov-decisions/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // dialog + fields render
  });

  test('expected form controls render', async ({ page }) => {
    await expect.poll(() => page.locator('vaadin-text-field').count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('vaadin-date-picker')).toHaveCount(1);
    await expect(page.locator('jmix-value-picker')).toHaveCount(1); // Вид решения
    await expect(page.locator('vaadin-text-area')).toHaveCount(1);  // Примечание
  });

  test('status is auto-set to "На стадии рассмотрения" and read-only', async ({ page }) => {
    const status = page.locator('vaadin-text-field[readonly]').first();
    await expect(status).toBeVisible();
    expect(await status.evaluate((el) => el.value)).toContain('На стадии рассмотрения');
  });

  test('decision date defaults to today', async ({ page }) => {
    const value = await page.locator('vaadin-date-picker').first().evaluate((el) => el.value);
    expect(value).toBe(todayISO());
  });

  test('save / cancel buttons present', async ({ page }) => {
    await expect(page.locator('vaadin-button').filter({ hasText: 'OK' }).first()).toBeVisible();
    await expect(page.locator('vaadin-button').filter({ hasText: 'Отмена' }).first()).toBeVisible();
  });

  test('empty submit shows required-field validation toast', async ({ page }) => {
    await page.locator('vaadin-button').filter({ hasText: 'OK' }).first().click();
    await expect(
      page.getByText('Заполните все обязательные поля', { exact: false }).first()
    ).toBeVisible();
  });

  test('empty submit marks all required fields invalid', async ({ page }) => {
    await page.locator('vaadin-button').filter({ hasText: 'OK' }).first().click();
    await page.waitForTimeout(800);
    // 4 required text fields + Вид решения picker => >=5 controls in [invalid] state.
    await expect.poll(() => page.locator('[invalid]').count()).toBeGreaterThanOrEqual(5);
  });

  test('Вид решения lookup opens, lists values, and selection closes it', async ({ page }) => {
    await page.locator('#entityLookupAction, jmix-value-picker [role=button]').first().click();
    const overlay = page.locator('vaadin-dialog-overlay').last();
    await expect(overlay).toBeVisible();
    const option = overlay.locator('vaadin-grid-cell-content').filter({ hasText: 'Постановление' }).first();
    await expect(option).toBeVisible();
    await option.dblclick();
    await expect(overlay).toBeHidden();
  });

  test('happy path: filling required fields + lookup saves the record', async ({ page }) => {
    // Success is the "успешно сохранена" toast (asserted inside createDecision).
    // The created record is На рассмотрении and the default list shows only
    // Одобрен, so we can't assert its row here — see notes/qa-findings.md P1-06.
    await createDecision(page, `AUTQA-${stamp()}`);
  });
});
