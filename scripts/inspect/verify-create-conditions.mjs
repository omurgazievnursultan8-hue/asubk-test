import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';

const FILE = pathToFileURL('mockups/loan-application/loan-application.html').href;
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1400, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(FILE, { waitUntil: 'load', timeout: 30000 });

const res = await page.evaluate(() => {
  const out = [];
  const A = (name, cond) => out.push((cond ? 'PASS' : 'FAIL') + '  ' + name);
  // open create page
  openCreateModal();
  const box = document.getElementById('cf-cond-body');
  A('cf-cond-body exists', !!box);
  A('renderCond is function', typeof renderCond === 'function');
  A('cdraft exists', !!cdraft);
  A('6 cond-sec sections', box.querySelectorAll('.cond-sec').length === 6);
  A('Параметры >=6 combos', document.querySelectorAll('#cf-cond-body .cond-sec:nth-child(1) .combo').length >= 6);

  // Task2: combo pick
  condPickCombo('currency', 'USD');
  A('currency pick -> cdraft.USD', cdraft.currency === 'USD');

  // Task3: amount type toggle + envelope validation
  cdraft.amountType = 'Диапазон'; renderCond();
  A('Диапазон -> t2-range shown', document.querySelectorAll('#cf-cond-body .t2-range').length >= 1);
  cdraft.amountType = 'Фиксированная'; renderCond();
  A('Фиксированная -> collgrid + Добавить', /Добавить/.test(box.innerHTML) && box.querySelector('.collgrid') !== null);
  cdraft.amountList = ['100000', '5000000']; cdraft.requestedAmount = '9999999';
  A('requestedAmount out of envelope -> false', validateReqAmount() === false);
  cdraft.requestedAmount = '200000';
  A('requestedAmount in envelope -> true', validateReqAmount() === true);

  // Task4: rates
  cdraft.rateType = 'Фиксированная'; renderCond();
  A('rate fixed -> mscombo', box.querySelector('.mscombo') !== null);
  condMsToggle({ stopPropagation(){}, target:{closest(){return null;}} }, 'rateValues', '6,00 %');
  condMsToggle({ stopPropagation(){}, target:{closest(){return null;}} }, 'rateValues', '8,00 %');
  A('rateValues has both chips', cdraft.rateValues.includes('6,00 %') && cdraft.rateValues.includes('8,00 %'));
  cdraft.floatRate = true; renderCond();
  A('floatRate -> тип плавающей + маржа', /Тип плавающей ставки/.test(box.innerHTML) && /Маржа к плавающей ставке/.test(box.innerHTML));

  // Task5: penalty defaults + toggle
  A('penaltyMaxPct default 20 rendered', box.querySelector('[data-k="penaltyMaxPct"]').value === '20');
  cdraft.penaltyMainType = 'Плавающая'; renderCond();
  A('penalty main Плавающая -> тип плавающей', /Тип плавающей штрафной ставки по основной сумме/.test(box.innerHTML));

  // Task6: grace
  cdraft.graceMain = true; renderCond();
  A('graceMain -> Тип + Условия', /Тип льготного периода/.test(box.innerHTML) && /Условия предоставления/.test(box.innerHTML));
  cdraft.graceInt = true; renderCond();
  A('graceInt -> распределение fields', /Распределять с периода/.test(box.innerHTML));
  cdraft.graceMainType = 'Диапазон'; renderCond();
  A('graceMainType Диапазон -> Продолжительность c/по', /Продолжительность c \(в мес\.\)/.test(box.innerHTML));

  // Task7: payments defaults + payMode
  A('dayCountBase default 365', cdraft.dayCountBase === '365');
  A('weekend default Не переносить', cdraft.weekend === 'Не переносить');
  A('lastPaymentAnchor default', cdraft.lastPaymentAnchor === 'По дате первого платежа');
  A('repayMethod default Аннуитетный', cdraft.repayMethod === 'Аннуитетный');
  cdraft.payMode = 'months'; renderCond();
  A('payMode months -> Конкретные месяцы', /Конкретные месяцы платежей/.test(box.innerHTML));
  A('payMode months -> repayMethod Индивидуальный', cdraft.repayMethod === 'Индивидуальный');
  cdraft.payMode = 'standard'; renderCond();

  // Task8/9: program = справка + diff
  openCreateModal();                       // fresh
  cdraft.rateValues = ['10,00 %']; _condTouched.add('rateValues'); renderCond();
  selectProgram('АгроИнвест КР');
  A('program snapshot >= 15 keys', Object.keys(programToCond(PROGRAMS_MAP['АгроИнвест КР'])).length >= 15);
  A('manual rateValues kept after program select', JSON.stringify(cdraft.rateValues) === JSON.stringify(['10,00 %']));
  A('untouched queue prefilled from program', cdraft.queue === 'Основная сумма → проценты → штрафы');
  A('untouched currency prefilled KGS', cdraft.currency === 'KGS');
  A('untouched amountType (native select) prefilled Диапазон', cdraft.amountType === 'Диапазон');
  A('untouched minDays (harvested input) prefilled 15', cdraft.minDays === '15');
  A('untouched amountMin prefilled 100000', cdraft.amountMin === '100000');
  // now diverge a prefilled field -> chip appears
  cdraft.queue = 'первочередный'; _condTouched.add('queue'); renderCond();
  A('after manual change -> deviation chip appears', box.querySelectorAll('.cond-dev').length >= 1);
  // clear program
  clearPicker('cf-program');
  A('clear program -> no chips', box.querySelectorAll('.cond-dev').length === 0);
  A('clear program -> entered value kept', cdraft.queue === 'первочередный');
  A('clear program -> snapshot null', _progSnapshot === null);

  // reopen last: fresh cdraft, no stale DOM harvest into the reset state
  cdraft.currency = 'EUR'; openCreateModal();
  A('reopen resets cdraft (no stale harvest)', cdraft.currency === '' && _progSnapshot === null);

  return out;
});

console.log(res.join('\n'));
console.log('\nCONSOLE ERRORS:', errors.length);
errors.forEach(e => console.log('  ' + e));
const fails = res.filter(r => r.startsWith('FAIL'));
console.log('\nRESULT:', fails.length === 0 && errors.length === 0 ? 'ALL PASS' : (fails.length + ' FAIL, ' + errors.length + ' console errors'));
await ctx.close();
process.exit(fails.length || errors.length ? 1 : 0);
