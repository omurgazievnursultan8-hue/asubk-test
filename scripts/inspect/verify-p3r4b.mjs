// P3-R4 follow-up: open a commission in EDIT mode, inspect «Финальное решение»
// control (manual select vs computed) + any quorum-gated save. Read-only probe
// — opens edit form but does NOT save.
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const PROFILE = '.auth/profile';
const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
// reuse persisted session; open commission #20 in edit mode (no ?mode=readonly)
await page.goto(BASE + 'loan-application-commissions/20', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('edit url:', page.url());
await page.screenshot({ path: '.auth/p3r4-commission-edit.png', fullPage: true });

const res = await page.evaluate(() => {
  // find the «Финальное решение» field + its control
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  let final = null;
  for (const el of document.querySelectorAll('vaadin-select, vaadin-combo-box, vaadin-text-field, vaadin-form-item, label')) {
    if (/Финальное решение/i.test(norm(el.textContent))) {
      const ctrl = el.matches('vaadin-select,vaadin-combo-box,vaadin-text-field') ? el
        : el.querySelector('vaadin-select, vaadin-combo-box, vaadin-text-field, input');
      if (ctrl) {
        final = {
          tag: ctrl.tagName.toLowerCase(),
          disabled: ctrl.hasAttribute('disabled') || ctrl.getAttribute('aria-disabled') === 'true',
          readonly: ctrl.hasAttribute('readonly'),
          value: norm(ctrl.value || ctrl.getAttribute('value') || ctrl.textContent).slice(0, 60),
        };
        break;
      }
    }
  }
  // any editable select on page = manual control present
  const editableSelects = [...document.querySelectorAll('vaadin-select, vaadin-combo-box')]
    .filter(s => !s.hasAttribute('disabled') && !s.hasAttribute('readonly')).length;
  // text hints about quorum / vote-gated closing
  const visText = re => [...document.querySelectorAll('body *')]
    .filter(e => e.childElementCount === 0 && !['STYLE','SCRIPT'].includes(e.tagName))
    .map(e => norm(e.textContent)).filter(t => t && re.test(t));
  return {
    final,
    editableSelectsCount: editableSelects,
    quorumText: visText(/кворум|порог|минимум голос|закрыть голосован|недостаточно голос/i).slice(0, 6),
    saveButtons: [...document.querySelectorAll('vaadin-button, button')]
      .map(b => ({ label: norm(b.textContent),
        disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' }))
      .filter(b => /Сохранить|Утвердить|Закрыть|Финал/i.test(b.label)),
  };
});
console.log(JSON.stringify(res, null, 2));
await ctx.close();
