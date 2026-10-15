// Шаблон договора: виден ли загруженный файл (имя, ссылка на скачивание) и что отвечает
// «Проверить шаблон» — у шаблона с файлом (id 3) и без файла (id 1). Выход «Отмена», без сохранения.
//   node scripts/inspect/blanks-validate.mjs
import { open, go } from './app-lib.mjs';

const { ctx, page } = await open();
await page.setViewportSize({ width: 1920, height: 1080 });

for (const id of [3, 1]) {
  await go(page, 'agreement-templates');
  await page.goto(`https://fkftest.okmot.kg/agreement-templates/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const fileArea = await page.evaluate(() => {
    const up = document.querySelector('jmix-upload-button');
    const host = up?.closest('jmix-file-storage-upload-field, jmix-file-upload-field, vaadin-custom-field, vaadin-horizontal-layout, div');
    return {
      host: host?.localName,
      text: host?.innerText,
      links: [...(host?.querySelectorAll('a, vaadin-button') || [])].map(a => `${a.localName}:${a.innerText.trim()}:${a.getAttribute('href') || ''}`),
      fieldValue: host?.value ?? null,
      anchors: [...document.querySelectorAll('a[href*="download"], a[href*="files"], a[download]')].map(a => a.href),
    };
  });
  console.log(`\n== template ${id} file area:`, JSON.stringify(fileArea));
  const before = await page.evaluate(() => [...document.querySelectorAll('vaadin-text-area, vaadin-text-field')].map(f => `${f.label}=${(f.value || '').slice(0, 200)}`));
  await page.getByRole('button', { name: 'Проверить шаблон' }).click();
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => [...document.querySelectorAll('vaadin-text-area, vaadin-text-field')].map(f => `${f.label}=${(f.value || '').slice(0, 200)}`));
  const notes = await page.evaluate(() => [...document.querySelectorAll('vaadin-notification-card, vaadin-dialog-overlay')].map(n => n.innerText.trim()));
  console.log('before:', JSON.stringify(before.filter(s => !s.startsWith('Доступные'))));
  console.log('after: ', JSON.stringify(after.filter(s => !s.startsWith('Доступные'))));
  console.log('notes: ', JSON.stringify(notes));
  await page.screenshot({ path: `.auth/blanks/validate-${id}.png`, fullPage: true });
  const c = page.getByRole('button', { name: 'Отмена', exact: true });
  if (await c.count()) await c.last().click().catch(() => {});
  await page.waitForTimeout(800);
  const discard = page.locator('vaadin-dialog-overlay vaadin-button', { hasText: /Не сохранять|Отменить|Закрыть без/ });
  if (await discard.count()) await discard.first().click().catch(() => {});
}
await ctx.close();
