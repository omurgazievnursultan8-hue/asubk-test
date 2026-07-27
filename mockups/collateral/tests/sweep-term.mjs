// Метла по термину: рендерит ВЕСЬ модуль и ищет «покрыт» в том, что видит пользователь.
// Запуск: node tests/sweep-term.mjs
// Смоук проверяет то же самое инвариантом W12-1, но точечно; здесь — сплошной проход,
// чтобы новый экран не протащил слово мимо теста.
import { readFileSync } from 'node:fs';
import { load } from './harness.mjs';

const BAN = /покрыт/i;
const hits = [];
const seen = new Set();
const check = (where, html) => {
  if (typeof html !== 'string' || !BAN.test(html)) return;
  const txt = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  (txt.match(/[^.;!?]*покрыт[^.;!?]*/gi) || []).forEach(x => {
    const k = `${where} :: ${x.trim()}`;
    if (!seen.has(k)) { seen.add(k); hits.push(k); }
  });
};

const { win, zt } = load();
let renders = 0;

for (const role of ['Куратор отдела залогового обеспечения',
                    'Заведующий отделом залогового обеспечения',
                    'Комитет по администрированию бюджетных кредитов']) {
  win.eval(`role=${JSON.stringify(role)}`);

  for (const nav of ['Предметы залога', 'Залоговые договоры', 'Поручительство',
                     'Мониторинг залога', 'Регламентные параметры залога']) {
    // <script> живёт в body — его исходник не пользовательский текст, проверяется ниже отдельно
    try { win.navClick(nav); check(`nav:${nav}`, win.document.body.innerHTML
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')); renders++; }
    catch (e) { hits.push(`nav:${nav} ОШИБКА ${e.message}`); }
  }

  for (const it of zt.ITEMS) {
    try {
      check(`item-head:${it.id}`, zt.itemHead(it));
      zt.itemPanels(it).forEach((p, i) => check(`item:${it.id}:${i}`, p));
      renders += 1 + zt.itemPanels(it).length;
    } catch (e) { hits.push(`item:${it.id} ОШИБКА ${e.message}`); }
  }

  for (const c of zt.CONTRACTS) {
    try {
      check(`ctr-head:${c.id}`, zt.ctrHead(c));
      zt.ctrPanels(c).forEach((p, i) => check(`ctr:${c.id}:${i}`, p));
      check(`ctr-foot:${c.id}`, zt.ctrFooter(c));
      renders += 2 + zt.ctrPanels(c).length;
    } catch (e) { hits.push(`ctr:${c.id} ОШИБКА ${e.message}`); }
  }
}

// история — рендерится лентой, но живёт в данных: сидовые записи мимо панелей не пройдут
zt.ITEMS.forEach(o => check(`hist:${o.id}`, (o.history || []).map(h => h.what).join(' | ')));
zt.CONTRACTS.forEach(o => check(`hist:${o.id}`, (o.history || []).map(h => h.what).join(' | ')));

// строковые литералы исходника вне комментариев — ловит тосты и модалки,
// которые сплошным рендером не открыть
const src = readFileSync(new URL('../zalog.html', import.meta.url), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
src.split('\n').forEach((ln, i) => {
  if (BAN.test(ln)) hits.push(`исходник вне комментария :${i + 1}: ${ln.trim().slice(0, 140)}`);
});

console.log(`рендеров: ${renders}`);
if (hits.length) {
  console.log(`НАЙДЕНО ${hits.length}:`);
  hits.forEach(h => console.log('  ' + h));
  process.exit(1);
}
console.log('чисто: «покрыт» не встречается ни в одном пользовательском тексте модуля');
