import { chromium } from 'playwright-core';
import path from 'path';

const ROOT = '/home/azamat/projects/asubk-credit-module';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
const ok = (n, c) => console.log(`${c ? '  ok  ' : 'FAIL  '}${n}`);

/* ---------- 1. МОКАП ЗАЯВКИ ---------- */
await p.goto('file://' + path.join(ROOT, 'mockups/loan-application/loan-application.html'), { waitUntil: 'load' });

const seed = await p.evaluate(() => ({
  total: APPLICATIONS.length,
  flowB: APPLICATIONS.filter(a => a.flow === 'B').length,
  waiting: APPLICATIONS.filter(a => a.status === 'Ожидает решения/программы').length,
  statuses: [...new Set(APPLICATIONS.map(a => a.status))],
}));
console.log('ЗАЯВКА — сиды:', JSON.stringify(seed, null, 0));
ok('в сидах есть заявка потока B', seed.flowB > 0);
ok('в сидах есть статус «Ожидает решения/программы»', seed.waiting > 0);

// прогоняем ветку вручную: делаем одобренную заявку "индивидуальной" и формируем кредит
const run = await p.evaluate(() => {
  window.confirm = () => true;
  const a = APPLICATIONS.find(x => x.status === 'Одобрено' || x.status === 'Одобрена');
  if (!a) return { err: 'нет одобренной заявки в сидах' };
  const before = a.status;
  a.status = 'Одобрена'; a.program = ''; a.flow = 'B';
  _role = 'spec';
  formCredit(a.num);
  const afterB = a.status;
  // теперь поток A
  const a2 = APPLICATIONS.find(x => x.num !== a.num && (x.status === 'Одобрено' || x.status === 'Одобрена'));
  a2.status = 'Одобрена'; a2.flow = 'A';
  formCredit(a2.num);
  return { before, afterB, afterA: a2.status };
});
console.log('ЗАЯВКА — прогон:', JSON.stringify(run));
ok('поток B: «Сформировать кредит» → «Ожидает решения/программы» (кредит НЕ создан)',
   run.afterB === 'Ожидает решения/программы');
ok('поток A: «Сформировать кредит» → «На оформлении» (кредит создан)',
   run.afterA === 'На оформлении');

/* ---------- 2. МОКАП КОМИССИИ ---------- */
await p.goto('file://' + path.join(ROOT, 'mockups/loan-application-commission/commission.html'), { waitUntil: 'load' });
const com = await p.evaluate(() => ({
  total: RECORDS.length,
  noProgram: RECORDS.filter(r => !r.prog).length,
  // поток не хранится полем — выводится из наличия программы (как в мокапе заявки)
  flows: RECORDS.map(r => flowOf(r)).reduce((a, f) => (a[f] = (a[f] || 0) + 1, a), {}),
}));
console.log('КОМИССИЯ:', JSON.stringify(com, null, 0));
ok('в комиссии есть записи обоих потоков', com.flows.A > 0 && com.flows.B > 0);
ok('поток выводится из программы, а не дублируется полем',
   await p.evaluate(() => flowOf({ prog:'X' }) === 'A' && flowOf({ prog:'' }) === 'B'));

// грид: заявка без программы — «Индивидуальная», а не пустая ячейка
ok('грид: поток B помечен «Индивидуальная»',
   (await p.locator('#row150 td:nth-child(4)').innerText()).trim() === 'Индивидуальная');

// фильтр «Без программы (поток B)» → только записи потока B
await p.click('.filter-toggle');
await p.selectOption('#f-prog', '__none__');
await p.click('.filterbar .btn-primary');
ok('фильтр «Без программы (поток B)» → 2 строки', (await p.locator('#rows tr').count()) === 2);
await p.click('.chip-clear');

// карточка 150 (поток B, гейт пройден): председатель ВИДИТ, что кредит не сформируется
await p.click('#row150');
await p.click('#btnOpen');
const warnB = await p.locator('#c-final .note-banner.warn').innerText();
ok('150: карточка предупреждает «кредит не сформируется»', /кредит не сформируется/i.test(warnB));
ok('150: сказано про «Ожидает решения/программы»', /Ожидает решения\/программы/.test(warnB));
ok('150: «Одобрить» активна (гейт пройден)', !(await p.locator('#c-final .btn-approve').isDisabled()));

// подтверждение одобрения тоже называет последствие
await p.click('#c-final .btn-approve');
const dlg = await p.locator('#confirmMsg').innerText();
ok('150: диалог подтверждения предупреждает про поток B', /кредит НE|кредит НЕ формируется/i.test(dlg));
await p.click('#confirmOk');
ok('150: после одобрения в истории есть запись про несформированный кредит',
   await p.evaluate(() => RECORDS.find(r => r.id === '150').hist
     .some(h => /кредит не сформирован/i.test(h.what))));
await p.click('#crumbBack');

// карточка 151 (поток B, уже одобрена): баннер о том, что кредита нет
await p.click('#row151');
await p.click('#btnOpen');
ok('151: одобренная заявка потока B — баннер «кредит не сформирован»',
   /кредит не сформирован/i.test(await p.locator('#c-final .note-banner.warn').innerText()));
await p.click('#crumbBack');

// контроль: поток A такого предупреждения не показывает
await p.click('#row145');
await p.click('#btnOpen');
const infoA = await p.locator('#c-final .note-banner').nth(1).innerText();
ok('145 (поток A): обещан кредит и «На оформлении»',
   /сформирован кредит/i.test(infoA) && /На оформлении/.test(infoA));

console.log('\nConsole/page errors:', errs.length ? errs : 'нет');
await b.close();
