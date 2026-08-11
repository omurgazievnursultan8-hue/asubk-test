// Модалка «Поставить план»: селектор года НАД полями месяцев (КВ-24). Год — ускоритель:
// выбор года ставит «с» = max(январь, месяц договора) и «по» = декабрь, поля месяцев при
// этом остаются рабочими. Проверяем умолчание (год даты среза целиком, нижняя обрезка
// месяцем договора), набор годов = селектор вкладки, смену года, обратную связь «ручная
// правка месяца → Произвольный период», сохранение пачки за год и чистоту консоли.
//   node scripts/inspect/credit-plan-modal-year-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/plan-modal-year';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1400 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

// «Кредитный специалист» (роль по умолчанию) права setPlan не имеет — Г-30/матрица §7
// отобьют модалку тостом. План ставит Куратор.
await page.evaluate(() => { document.getElementById('roleSel').value = 'Куратор'; CR.onRoleChange(); });
await page.waitForTimeout(200);

const openModal = async (id) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^План$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => CR.openPlanModal());
  await page.waitForTimeout(250);
};
// состояние формы: положение селектора и его набор, оба поля месяцев, строки и галки
const snap = () => page.evaluate(() => {
  const sel = document.getElementById('planYearSel');
  const rows = [...document.querySelectorAll('.modal-b .plan-on')];
  return {
    year: sel ? sel.value : null,
    yearLabel: sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : null,
    years: sel ? [...sel.options].filter(o => !o.disabled).map(o => +o.value) : null,
    hasFree: sel ? [...sel.options].some(o => o.disabled) : null,
    from: (document.getElementById('planFrom')||{}).value,
    to: (document.getElementById('planTo')||{}).value,
    rows: rows.length,
    checked: rows.filter(x => x.checked).length,
    first: rows.length ? rows[0].parentElement.textContent.trim() : null,
    last: rows.length ? rows[rows.length-1].parentElement.textContent.trim() : null,
  };
});
const setYear = (y) => page.evaluate(v => CR.setPlanFormYear(String(v)), y);
const setMonth = (which, v) => page.evaluate(([w, val]) => {
  const el = document.getElementById(w); el.value = val; CR.reloadPlanForm();
}, [which, v]);

// K-1 · выдан 12.05.2026 на 24 мес. Умолчание — весь 2026, но снизу обрезано маем:
// январь–апрель раньше месяца договора, Г-30 их не пустит.
await openModal('K-1');
const s1 = await snap();
console.log('K-1 умолчание модалки:', JSON.stringify(s1, null, 1));
console.log('K-1 нижняя обрезка месяцем договора (12.05.2026):',
  JSON.stringify({ from: s1.from, ожидалось: '2026-05', to: s1.to, строк: s1.rows, ожидалось_строк: 8 }));
await page.screenshot({ path: `${OUT}/K-1-modal-default.png`, fullPage: true });

// набор годов модалки обязан совпасть с набором селектора вкладки — обе зовут planYearsList
const tabYears = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')]
    .find(s => s.id !== 'planYearSel' && /^\d{4}$/.test(s.value));
  return sel ? [...sel.options].map(o => +o.value) : null;
});
console.log('K-1 набор годов: модалка', JSON.stringify(s1.years), '· вкладка', JSON.stringify(tabYears),
  '· совпал:', JSON.stringify(s1.years) === JSON.stringify(tabYears));

// смена года: 2027 целиком, обрезки нет — договор в прошлом году
await setYear(2027); await page.waitForTimeout(200);
console.log('K-1 год 2027:', JSON.stringify(await snap(), null, 1));
await page.screenshot({ path: `${OUT}/K-1-modal-2027.png`, fullPage: true });

// 2028 — год конца срока (май 2028). Верхней обрезки НЕТ: декабрь остаётся декабрём,
// план графиком не ограничен.
await setYear(2028); await page.waitForTimeout(200);
const s28 = await snap();
console.log('K-1 год 2028 (верхней обрезки нет):',
  JSON.stringify({ from: s28.from, to: s28.to, строк: s28.rows, отмечено: s28.checked }));

// ручная правка месяца → селектор честно говорит «Произвольный период»
await setYear(2027); await page.waitForTimeout(150);
await setMonth('planTo', '2027-05'); await page.waitForTimeout(200);
const sFree = await snap();
console.log('K-1 после ручной правки «по месяц»:',
  JSON.stringify({ year: sFree.year, label: sFree.yearLabel, from: sFree.from, to: sFree.to, строк: sFree.rows }));
await page.screenshot({ path: `${OUT}/K-1-modal-free.png`, fullPage: true });

// возврат к году восстанавливает полный диапазон
await setYear(2027); await page.waitForTimeout(200);
console.log('K-1 возврат к 2027:', JSON.stringify({ ...(await snap()) }, null, 1));

// сохранение пачки за год: месяцы с прогнозом отмечены, план ставится, тост не ругается
const saved = await page.evaluate(() => {
  const n = [...document.querySelectorAll('.modal-b .plan-on')].filter(x => x.checked).length;
  CR.submitPlan();
  return { отмечено: n, модалка_закрылась: !document.querySelector('.modal-b'),
           err: (document.getElementById('modalErr') || {}).innerText || '',
           тост: ([...document.querySelectorAll('.toast')].pop() || {}).innerText || '' };
});
console.log('K-1 сохранение пачки за 2027:', JSON.stringify(saved));

// K-6 · выдан 15.01.2024, закрыт «Погашен» — Г-30 не пустит модалку вовсе; проверяем,
// что кнопка отбита, а не что форма открылась с годом
await page.evaluate(i => CR.openDetail(i), 'K-6');
await page.waitForTimeout(200);
const k6 = await page.evaluate(() => {
  CR.openPlanModal();
  return { modal: !!document.querySelector('.modal-b'), sel: !!document.getElementById('planYearSel') };
});
console.log('K-6 (закрыт, Г-30):', JSON.stringify(k6));

// K-3 · один год в наборе — селектор с единственным вариантом, форма не вырождается
await page.evaluate(() => CR.closeModal());
await openModal('K-3');
console.log('K-3 модалка:', JSON.stringify(await snap(), null, 1));
await page.screenshot({ path: `${OUT}/K-3-modal.png`, fullPage: true });

console.log('errors:', errs.length ? errs.slice(0, 3) : 'нет');
await ctx.close();
