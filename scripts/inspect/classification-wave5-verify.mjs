// Проверка волны 5 макета классификации в НАСТОЯЩЕМ браузере: девять дефектов ручного
// прогона (КФ-Д9…КФ-Д17) закрыты. Смоук их не ловит — он без DOM, а половина дефектов
// живёт в событиях мыши и перерисовке панели.
//   node scripts/inspect/classification-wave5-verify.mjs
import { chromium } from 'playwright-core';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const URL = 'file://' + process.cwd() + '/mockups/classification/classification.html';
const out = [];
const say = (n, pass, note) => out.push({ n, pass, note });
const reset = async () => { await page.goto(URL, { waitUntil: 'load' }); await page.waitForTimeout(250); };
const nav = async v => { await page.evaluate(x => CL.go(x), v); await page.waitForTimeout(150); };
const vis = async sel => page.evaluate(s => {
  const el = document.querySelector(s); if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(10, r.height / 2));
  return { text: (el.textContent || '').trim().slice(0, 120), covered: !(el === top || el.contains(top)) };
}, sel);

/* --- КФ-Д9: первое нажатие кнопки после ввода в поле не пропадает --- */
await reset();
await page.evaluate(() => { CL.open('risk'); CL.newDraft('risk'); CL.render(); });
await page.waitForTimeout(200);
{
  const before = await page.locator('.rule').count();
  const field = page.locator('input[placeholder="пункт основания"]').first();
  await field.click();
  await field.type(' изм', { delay: 30 });               // фокус НЕ уводим
  await page.locator('button:has-text("+ правило (или)")').first().click();
  await page.waitForTimeout(200);
  const after = await page.locator('.rule').count();
  const kept = await page.evaluate(() => {
    const v = CL.draftVer('risk').values.find(x => (x.rules || []).length);
    return (v.rules[0].norm || '').includes(' изм');
  });
  say('КФ-Д9', after === before + 1 && kept,
    `правил ${before} → ${after} с первого нажатия, набранный пункт основания сохранён: ${kept}`);
}

/* --- КФ-Д10: причина отказа модального окна видна на экране --- */
await reset();
await page.locator('button:has-text("+ Классификатор")').click();
await page.waitForTimeout(150);
await page.locator('.modal-f button:has-text("Завести")').click();
await page.waitForTimeout(150);
{
  const err = await vis('#modalErr .banner');
  const open = await page.locator('.overlay.open').count();
  say('КФ-Д10', !!err && !err.covered && /идентификатор/.test(err.text) && open === 1,
    `окно осталось открытым, причина внутри окна: «${err && err.text}» (перекрыта: ${err && err.covered})`);
}

/* --- КФ-Д13: домен перечисления спрашивается, а не подставляется --- */
await reset();
await nav('ind');
await page.locator('button:has-text("+ Показатель")').click();
await page.waitForTimeout(150);
{
  const hiddenAtBool = await page.locator('#niDomWrap').isHidden();
  await page.selectOption('#niType', 'перечисление');
  await page.waitForTimeout(120);
  const shown = await page.locator('#niDomWrap').isVisible();
  await page.fill('#niId', 'pledgeLevel');
  await page.fill('#niName', 'Уровень покрытия залогом');
  await page.fill('#niOwner', 'Залог');
  await page.locator('.modal-f button:has-text("Завести")').click();   // домен пуст → отказ
  await page.waitForTimeout(150);
  const err = await vis('#modalErr .banner');
  await page.fill('#niDomain', 'полное, частичное, отсутствует');
  await page.locator('.modal-f button:has-text("Завести")').click();
  await page.waitForTimeout(200);
  const ind = await page.evaluate(() => CL.ind('pledgeLevel'));
  say('КФ-Д13', hiddenAtBool && shown && !!err && /домен/.test(err.text) &&
      ind && ind.domain.join('·') === 'полное·частичное·отсутствует',
    `поле домена показано только у перечисления; пустой домен отклонён («${err && err.text.slice(0, 60)}…»), заведён домен: ${ind && ind.domain.join(' · ')}`);
}

/* --- КФ-Д11: отказ в форме факта не стирает набранное --- */
await reset();
await nav('facts');
{
  await page.selectOption('#fCredit', 'КД-2025/043');
  await page.selectOption('#fKind', 'f-noAct');
  await page.fill('#fDoc', 'протокол КАБК №11 от 10.08.2026');
  await page.fill('#fWhen', '2026-12-01');                 // дата в будущем → отказ
  await page.locator('button:has-text("Завести факт")').click();
  await page.waitForTimeout(250);
  const form = await page.evaluate(() => ({
    credit: document.querySelector('#fCredit').value,
    kind: document.querySelector('#fKind').value,
    doc: document.querySelector('#fDoc').value,
    when: document.querySelector('#fWhen').value,
  }));
  say('КФ-Д11', form.credit === 'КД-2025/043' && form.kind === 'f-noAct' &&
      form.doc === 'протокол КАБК №11 от 10.08.2026' && form.when === '2026-12-01',
    `после отказа форма цела: ${form.credit} · ${form.kind} · «${form.doc}» · ${form.when}`);

  await page.fill('#fWhen', '2026-08-12');
  await page.locator('button:has-text("Завести факт")').click();
  await page.waitForTimeout(250);
  const cleared = await page.evaluate(() => document.querySelector('#fDoc').value === '');
  say('КФ-Д11·успех', cleared, `после успешного заведения форма очищена: ${cleared}`);
}

/* --- КФ-Д16: наблюдателю не показывают форму и кнопки --- */
await page.evaluate(() => CL.setRole('Наблюдатель'));
await page.waitForTimeout(200);
{
  const form = await page.locator('#fCredit').count();
  const annul = await page.locator('button:has-text("аннулировать")').count();
  const banner = await page.locator('.banner:has-text("Только просмотр")').count();
  say('КФ-Д16', form === 0 && annul === 0 && banner === 1,
    `у наблюдателя формы нет (${form}), кнопок аннулирования нет (${annul}), причина названа баннером (${banner})`);
}

/* --- КФ-Д12 + КФ-Д14 + КФ-Д17: публикация задним числом, живой прогон, числительное --- */
await reset();
await page.evaluate(() => { CL.open('risk'); CL.newDraft('risk'); CL.tab('pub'); });
await page.waitForTimeout(200);
{
  await page.fill('#pubBasis', 'Порядок №41 от 06.07.2026, п. 11');
  await page.fill('#pubFrom', '2026-07-02');                // раньше действующей ред. 2
  await page.waitForTimeout(250);
  const refusals = await page.locator('#pubRefusals li').allTextContents();
  const dry = (await page.locator('#dryRun .banner.warn').textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
  await page.locator('button:has-text("Ввести в действие")').click();
  await page.waitForTimeout(200);
  const active = await page.evaluate(() => CL.activeVer('risk').no);
  say('КФ-Д12', refusals.some(t => /не позже начала действующей редакции 2/.test(t)) && active === 2,
    `отказ на экране: «${(refusals[0] || '').slice(0, 90)}…», действующей осталась редакция ${active}`);
  say('КФ-Д14+Д17', /держит 1 отказ выше/.test(dry),
    `прогон пересчитался вместе со списком и согласовал числительное: «${dry.slice(-70)}»`);
}

/* --- КФ-Д15: реестр фактов кредита виден и без значения --- */
await reset();
await page.evaluate(() => {
  CL.addFact({ creditId: 'КД-2026/012', kindId: 'f-nonTarget', occurred: CL.state.today,
    doc: 'протокол КАБК №12 от 14.08.2026' });
  CL.go('show');
});
await page.waitForTimeout(250);
{
  const row = await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll('tr')).find(t => t.textContent.includes('КД-2026/012'));
    return tr ? tr.textContent.replace(/\s+/g, ' ') : null;
  });
  say('КФ-Д15', !!row && /значения нет/.test(row) && /Реестр фактов кредита/.test(row) && /засчитан/.test(row),
    `строка КД-2026/012: «${(row || '').slice(0, 130)}…»`);
}

/* --- КФ-Д17: графа «Значений» у прекращённого классификатора --- */
await reset();
await page.evaluate(() => { CL.stopClassifier('risk', { reason: 'проверка волны 5' }); CL.go('clf'); });
await page.waitForTimeout(200);
{
  const cells = await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll('tbody tr')).find(t => t.textContent.includes('risk'));
    return tr ? Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()) : null;
  });
  say('КФ-Д17', !!cells && cells[4] === '3' && /прекращено/.test(cells[5]),
    `строка прекращённого: значений «${cells && cells[4]}», состояние «${(cells && cells[5] || '').slice(0, 40)}»`);
}

const pass = out.filter(r => r.pass).length;
console.log(`БРАУЗЕР 2026-08-21 · ${pass}/${out.length} PASS · ошибок страницы ${errs.length}`);
out.forEach(r => console.log(`   ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}  ${r.note}`));
if (errs.length) console.log(errs.slice(0, 6).join('\n'));
await ctx.close();
process.exit(pass === out.length && !errs.length ? 0 : 1);
