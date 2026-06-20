// Phase 1 — Government decision · known-defect regression tests.
// Each asserts the DESIRED (fixed) behavior and is marked test.fail() — i.e.
// EXPECTED to fail today. When the dev team fixes the defect, the test will
// start passing unexpectedly and turn the suite red, signaling "remove the
// test.fail()". Defect IDs map to notes/qa-findings.md (P1-01..05) and the
// recommendations in requirements/features/01-government-decision.md (R1..R5).
const { test, expect } = require('@playwright/test');
const { gotoList, selectRow, createDecision, stamp } = require('../helpers');

test.describe('Gov decision — known defects (xfail = desired behavior)', () => {
  // P1-01 / R3: Код should be system-generated (auto-filled, read-only), not blank+manual.
  test('P1-01: Код is system-generated on create', async ({ page }) => {
    test.fail();
    await page.goto('/gov-decisions/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // 3rd editable text field = Код (after Наименование, Краткое).
    const codeVal = await page.locator('vaadin-text-field:not([readonly]) input').nth(2).inputValue();
    expect(codeVal.trim().length, 'Код should be auto-populated').toBeGreaterThan(0);
  });

  // P1-04 / R5: Дата решения should not allow future dates (expect a max bound).
  test('P1-04: Дата решения has an upper bound (no future dates)', async ({ page }) => {
    test.fail();
    await page.goto('/gov-decisions/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const max = await page.locator('vaadin-date-picker').first().evaluate((el) => el.max || '');
    expect(max, 'date picker should cap at today').not.toBe('');
  });

  // P1-05 / R4: Удалить should be disabled for approved/closed records.
  test('P1-05: Удалить disabled for an approved record', async ({ page }) => {
    test.fail();
    await gotoList(page);
    await selectRow(page, 'Одобрен'); // selects a row whose status cell reads Одобрен
    await expect(page.locator('vaadin-button').filter({ hasText: 'Удалить' }).first()).toBeDisabled();
  });

  // P1-03 / R2: Отклонить should require confirmation + a mandatory reason (MUTATING).
  test('P1-03: Отклонить asks for confirmation / reason', async ({ page }) => {
    test.fail();
    const name = `AUTQA-RC-${stamp()}`;
    await createDecision(page, name);
    await selectRow(page, name);
    await page.locator('vaadin-button').filter({ hasText: 'Отклонить' }).first().click();
    await page.waitForTimeout(1000);
    // desired: a confirm dialog / reason field appears before the state changes.
    await expect(
      page.locator('vaadin-confirm-dialog-overlay, vaadin-dialog-overlay').last()
    ).toBeVisible({ timeout: 3000 });
  });
});
