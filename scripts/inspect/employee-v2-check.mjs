import { chromium } from 'playwright-core';

const URL = 'file:///home/azamat/projects/asubk-credit-module/mockups/employee/employee.html';
const SHOT = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/07f081d2-bc47-4310-b2ec-16a646d67b34/scratchpad';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

await p.goto(URL);
await p.waitForTimeout(400);

const say = (k, v) => console.log(`${k.padEnd(38)} ${v}`);

// --- 1. Обзор: проблемы считаются
const probs = await p.locator('.prob-row').count();
say('обзор: проблем на 14.07.2026', probs);
say('обзор: KPI строк', await p.locator('.kpi').count());
await p.screenshot({ path: `${SHOT}/1-overview.png` });

// --- 2. resolveActor
const ra0 = await p.locator('#raOut').innerText();
say('resolveActor(Сламкулов, сегодня)', JSON.stringify(ra0.split('\n')[0].slice(0, 60)));

// --- 3. Список + фильтр
await p.click('.vtab[data-view="list"]');
await p.waitForTimeout(200);
say('список: строк', await p.locator('#rows tr').count());
say('rowCount', await p.locator('#rowCount').innerText());
say('Матраимов (строка)', (await p.locator('#rows tr[data-id="e125"]').innerText()).replace(/\n/g, ' | '));
await p.fill('#fQ', 'иванов');
await p.waitForTimeout(150);
say('поиск "иванов"', await p.locator('#rows tr[data-id]').count() + ' стр.');
await p.fill('#fQ', '');
await p.selectOption('#fAvail', 'away');
await p.waitForTimeout(150);
say('фильтр «Отсутствует»', await p.locator('#rows tr[data-id]').count() + ' стр.');
await p.click('#fReset');
await p.waitForTimeout(150);

// --- 4. ДАТА СРЕЗА: тот же Сламкулов в 2021 -> другое подразделение
const rowText = async () => (await p.locator('#rows tr[data-id="e142"]').innerText()).replace(/\n/g, ' | ');
say('Сламкулов на 14.07.2026', await rowText());
await p.click('.date-chip[data-d="2021-12-31"]');
await p.waitForTimeout(250);
say('Сламкулов на 31.12.2021', await rowText());
await p.click('.date-chip[data-d="2026-08-12"]');
await p.waitForTimeout(250);
say('Сламкулов на 12.08.2026 (отпуск)', await rowText());
await p.screenshot({ path: `${SHOT}/2-list-vacation.png` });
await p.click('.date-chip[data-d="2026-07-14"]');
await p.waitForTimeout(200);

// --- 5. Карточка + ГРИФ
await p.locator('#rows tr[data-id="e142"]').dblclick();
await p.waitForTimeout(300);
const tabsHR = await p.locator('#tabs .tab').count();
say('карточка (роль HR): вкладок', tabsHR);
say('шапка: три оси', await p.locator('.axis').count());
await p.screenshot({ path: `${SHOT}/3-card-hr.png` });

await p.selectOption('#roleSel', 'cred');
await p.waitForTimeout(300);
const tabsCred = await p.locator('#tabs .tab').count();
say('карточка (роль КРЕД): вкладок', tabsCred + '  (B/C должны исчезнуть)');
say('кнопки действий у cred', await p.locator('#btnTransfer').count());
const pinCred = await p.locator('#panel .kv-grid').first().innerText();
say('ПИН у cred замаскирован', /нет доступа/.test(pinCred) ? 'да ✔' : 'НЕТ ❌');
// документы под грифом
await p.click('#tabs .tab:has-text("Документы")');
await p.waitForTimeout(200);
say('cred: док-групп видно', await p.locator('.doc-acc').count());
say('cred: баннер «Скрыто по уровню доступа»', await p.locator('.banner:has-text("Скрыто по уровню доступа")').count());
await p.screenshot({ path: `${SHOT}/4-card-cred-docs.png` });

await p.selectOption('#roleSel', 'hr');
await p.waitForTimeout(300);
await p.click('#tabs .tab:has-text("Документы")');
await p.waitForTimeout(200);
say('hr: док-групп видно', await p.locator('.doc-acc').count());

// --- 6. ГЕЙТ ПЕРЕВОДА
await p.click('#tabs .tab:has-text("Назначения")');
await p.waitForTimeout(150);
say('назначений в таблице', await p.locator('.dtable tbody tr').count());
await p.click('#btnTransfer');
await p.waitForTimeout(300);
say('перевод: кнопка заблокирована', await p.locator('#trConfirm').isDisabled());
await p.screenshot({ path: `${SHOT}/5-gate-transfer.png` });
await p.click('.radio-row[data-dec="reassign"]');
await p.waitForTimeout(150);
say('перевод: после решения (а)', await p.locator('#trConfirm').isDisabled() ? 'ВСЁ ЕЩЁ ЗАБЛОКИРОВАНА ❌' : 'разблокирована ✔');
await p.selectOption('#trUnit', 'buh');
await p.click('#trConfirm');
await p.waitForTimeout(400);
say('после перевода: тост', (await p.locator('#toast').innerText()).slice(0, 50));
say('после перевода: шапка на 14.07', (await p.locator('.emp-sub').innerText()).replace(/\n/g, ' '));
await p.click('.date-chip[data-d="2026-08-12"]'); await p.waitForTimeout(300);
say('после перевода: шапка на 12.08', (await p.locator('.emp-sub').innerText()).replace(/\n/g, ' '));
await p.click('.date-chip[data-d="2026-07-14"]'); await p.waitForTimeout(300);
const uzTab = await p.locator('#tabs .tab:has-text("Учётная запись")');
await uzTab.click();
await p.waitForTimeout(200);
say('после перевода: заёмщиков', (await p.locator('.proj-card:has-text("Закреплённые заёмщики") .proj-row').first().innerText()).replace(/\n/g, ' '));
say('после перевода: флаг ролей', await p.locator('#panel .banner.warn:has-text("роли не пересмотрены")').count() ? 'поднят ✔' : 'НЕТ ❌');
await p.screenshot({ path: `${SHOT}/6-after-transfer.png` });

// --- 7. ГЕЙТ УВОЛЬНЕНИЯ
await p.click('#btnDismiss');
await p.waitForTimeout(300);
say('увольнение: кнопка заблок.', await p.locator('#dsConfirm').isDisabled());
say('увольнение: строк обязательств', await p.locator('.oblig li').count());
say('увольнение: hint', await p.locator('#dsHint').innerText());
await p.screenshot({ path: `${SHOT}/7-gate-dismiss.png` });
let guard = 0;
while ((await p.locator('.oblig [data-ob]').count()) > 0 && guard++ < 6) {
  await p.locator('.oblig [data-ob]').first().click();
  await p.waitForTimeout(250);
}
say('увольнение: после разбора кнопка', await p.locator('#dsConfirm').isDisabled() ? 'ЗАБЛОКИРОВАНА ❌' : 'разблокирована ✔');
say('увольнение: hint', await p.locator('#dsHint').innerText());
await p.click('#dsConfirm');
await p.waitForTimeout(400);
say('после увольнения: read-only', await p.locator('.ro-note').count() ? 'да ✔' : 'НЕТ ❌');
say('после увольнения: оси', (await p.locator('.axes').innerText()).replace(/\n/g, ' | ').slice(0, 110));
await p.screenshot({ path: `${SHOT}/8-after-dismiss.png` });

// --- 8. Отсутствие + валидация замещающего
await p.click('.vtab[data-view="list"]');
await p.waitForTimeout(200);
await p.locator('#rows tr[data-id="e125"]').dblclick();
await p.waitForTimeout(300);
await p.click('#btnAbsence');
await p.waitForTimeout(300);
// выберем заведомо невалидного: Сооронова (УЗ заблокирована)
await p.selectOption('#abSub', { label: 'Сооронова Рыскан Атаевна' });
await p.waitForTimeout(200);
say('замещ. Сооронова (УЗ blocked)', (await p.locator('#abErr').innerText()) || 'ОШИБКИ НЕТ ❌');
say('  кнопка «Оформить»', await p.locator('#abConfirm').isDisabled() ? 'заблокирована ✔' : 'АКТИВНА ❌');
await p.selectOption('#abSub', { label: 'Петрова Светлана Викторовна' });
await p.waitForTimeout(200);
say('замещ. Петрова (сама в отпуске)', (await p.locator('#abErr').innerText()) || 'ОШИБКИ НЕТ ❌');
await p.selectOption('#abSub', { label: 'Жумабеков Канат Эркинович' });
await p.waitForTimeout(200);
say('замещ. Жумабеков (валиден)', (await p.locator('#abErr').innerText()) || 'ошибок нет ✔');
say('  кнопка «Оформить»', await p.locator('#abConfirm').isDisabled() ? 'ЗАБЛОКИРОВАНА ❌' : 'активна ✔');
await p.screenshot({ path: `${SHOT}/9-absence-validate.png` });
await p.click('#abConfirm');
await p.waitForTimeout(400);
await p.click('#tabs .tab:has-text("Отсутствия")');
await p.waitForTimeout(250);
say('Матраимов: отсутствий в таблице', await p.locator('.dtable tbody tr').count());
say('Матраимов доступность на 25.07', (await (async () => { await p.click('.vtab[data-view="list"]'); await p.fill('#dateInp', '2026-07-25'); await p.dispatchEvent('#dateInp','change'); await p.waitForTimeout(300); return p.locator('#rows tr[data-id=\"e125\"]').innerText(); })()).replace(/\n/g,' | '));
await p.click('.date-chip[data-d="2026-07-14"]'); await p.waitForTimeout(200);

// --- 9. Обзор пересчитался
await p.click('.vtab[data-view="overview"]');
await p.waitForTimeout(300);
say('обзор: проблем после всех операций', await p.locator('.prob-row').count());
await p.screenshot({ path: `${SHOT}/10-overview-after.png`, fullPage: true });

console.log('\n--- ОШИБКИ КОНСОЛИ ---');
console.log(errs.length ? errs.join('\n') : 'нет ✔');
await b.close();
