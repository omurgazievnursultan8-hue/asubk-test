// Phase 1 — Government decision (Решение правительства) · list view UI.
// Route: /gov-decisions. See requirements/features/01-government-decision.md.
// DOM verified 2026-06-20: Vaadin grid; headers are slotted
// <vaadin-grid-cell-content>; row actions disabled until a row is selected.
const { test, expect } = require('@playwright/test');

const COLUMNS = ['Наименование', 'Краткое наименование', 'Статус', 'Код', 'Номер решения', 'Вид решения', 'Дата решения'];
const ROW_ACTIONS = ['Создать', 'Изменить', 'Просмотр', 'Удалить', 'Одобрить', 'Отклонить'];
const SELECTION_ACTIONS = ['Изменить', 'Просмотр', 'Удалить', 'Одобрить', 'Отклонить'];

test.describe('Gov decision — list view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gov-decisions', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // Vaadin lazy render
  });

  test('grid renders', async ({ page }) => {
    await expect(page.locator('vaadin-grid')).toBeVisible();
  });

  test('all documented columns present', async ({ page }) => {
    for (const col of COLUMNS) {
      const cell = page.locator('vaadin-grid-cell-content').filter({ hasText: col });
      await expect.poll(() => cell.count(), `column "${col}"`).toBeGreaterThan(0);
    }
  });

  test('row-action toolbar present', async ({ page }) => {
    for (const label of ROW_ACTIONS) {
      await expect(page.locator('vaadin-button').filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test('has at least one record row', async ({ page }) => {
    const cells = page.locator('vaadin-grid-cell-content');
    await expect.poll(() => cells.count()).toBeGreaterThan(7);
  });

  test('columns are sortable', async ({ page }) => {
    await expect.poll(() => page.locator('vaadin-grid-sorter').count()).toBeGreaterThanOrEqual(7);
    const sorter = page.locator('vaadin-grid-sorter').first();
    await sorter.click(); // should not throw; grid reorders
    await page.waitForTimeout(500);
  });

  test('selection actions disabled until a row is selected', async ({ page }) => {
    for (const label of SELECTION_ACTIONS) {
      await expect(page.locator('vaadin-button').filter({ hasText: label }).first()).toBeDisabled();
    }
  });

  test('selecting a row enables Просмотр', async ({ page }) => {
    // 7 headers are non-empty; nth(7) is the first data cell. Изменить may stay
    // disabled if that row is approved/closed, but Просмотр is always available.
    await page.locator('vaadin-grid-cell-content').filter({ hasText: /\S/ }).nth(7).click();
    await page.waitForTimeout(500);
    await expect(page.locator('vaadin-button').filter({ hasText: 'Просмотр' }).first()).toBeEnabled();
  });

  test('filter builder opens with attribute list', async ({ page }) => {
    await page.locator('vaadin-button').filter({ hasText: 'Добавить условие поиска' }).first().click();
    const overlay = page.locator('vaadin-dialog-overlay').last();
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('Вид решения', { exact: false }).first()).toBeVisible();
  });
});
