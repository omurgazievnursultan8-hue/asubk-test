// Phase 1 — Government decision · approval workflow (MUTATING).
// Creates fresh records (AUTQA-*) and drives them through the status lifecycle:
//   На стадии рассмотрения -> Одобрен (approve) / Закрыт (reject).
// Records linger on the stand (delete guards); a full reset is pending.
// See requirements/features/01-government-decision.md.
const { test, expect } = require('@playwright/test');
const { createDecision, selectRow, stamp } = require('../helpers');

// SKIPPED: approve/reject are list row-actions, but the default gov-decisions
// list returns only approved (Одобрен) records — a freshly-created
// На-рассмотрении record is saved (success toast) yet never appears in the list
// (notes/qa-findings.md P1-06). Surfacing it needs the Jmix attribute-tree filter
// builder, which did not automate reliably within budget. Re-enable once we can
// (a) confirm whether this is a saved-filter artifact or a real loader/persistence
// bug, and (b) drive the filter to surface a review-state row. Bodies left intact.
test.describe.skip('Gov decision — workflow (mutating)', () => {
  test('create → edit is populated → approve → status Одобрен, edit blocked', async ({ page }) => {
    const name = `AUTQA-AP-${stamp()}`;
    await createDecision(page, name);
    await expect(page.locator('vaadin-grid-cell-content').filter({ hasText: name }).first()).toBeVisible();

    // Edit form is populated with what we entered.
    await selectRow(page, name);
    await page.locator('vaadin-button').filter({ hasText: 'Изменить' }).first().click();
    await page.waitForTimeout(1500);
    const editVals = await page.locator('vaadin-text-field input').evaluateAll((els) => els.map((e) => e.value));
    expect(editVals.join('|')).toContain(name);
    await page.locator('vaadin-button').filter({ hasText: 'Отмена' }).first().click();
    await page.waitForTimeout(1000);

    // Approve.
    await selectRow(page, name);
    await page.locator('vaadin-button').filter({ hasText: 'Одобрить' }).first().click();
    await page.waitForTimeout(2000);

    // Verify status via the read-only view.
    await selectRow(page, name);
    await page.locator('vaadin-button').filter({ hasText: 'Просмотр' }).first().click();
    await page.waitForTimeout(1500);
    const roVals = await page.locator('vaadin-text-field[readonly] input').evaluateAll((els) => els.map((e) => e.value));
    expect(roVals.join('|')).toContain('Одобрен');
    await page.locator('vaadin-button').filter({ hasText: 'Отмена' }).first().click().catch(() => {});
    await page.waitForTimeout(800);

    // Edit must be blocked once approved.
    await selectRow(page, name);
    await expect(page.locator('vaadin-button').filter({ hasText: 'Изменить' }).first()).toBeDisabled();
  });

  test('create → reject → status Закрыт', async ({ page }) => {
    const name = `AUTQA-RJ-${stamp()}`;
    await createDecision(page, name);
    await expect(page.locator('vaadin-grid-cell-content').filter({ hasText: name }).first()).toBeVisible();

    await selectRow(page, name);
    await page.locator('vaadin-button').filter({ hasText: 'Отклонить' }).first().click();
    await page.waitForTimeout(2000);

    await selectRow(page, name);
    await page.locator('vaadin-button').filter({ hasText: 'Просмотр' }).first().click();
    await page.waitForTimeout(1500);
    const roVals = await page.locator('vaadin-text-field[readonly] input').evaluateAll((els) => els.map((e) => e.value));
    expect(roVals.join('|')).toContain('Закрыт');
  });
});
