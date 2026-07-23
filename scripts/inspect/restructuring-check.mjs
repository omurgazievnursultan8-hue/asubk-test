// Headless smoke для mockups/restructuring/restructuring.html (спека §18, Р-1…Р-19).
// Zero-dep: извлекает <script> из HTML и исполняет чистый логический слой в node:vm
// (без DOM — тесты дёргают только pure-функции window.RS). Результат печатает и вставляет
// в комментарий-шапку HTML (блок «SMOKE (node ...)»).
//   node scripts/inspect/restructuring-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/restructuring/restructuring.html');
const src   = readFileSync(HTML, 'utf8');

// вытаскиваем тело <script> (в файле один прикладной script)
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }

// песочница: есть window (чтобы код выставил window.RS), нет document (init/рендер пропускается)
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'restructuring.inline.js' });
const RS = win.RS;
if (!RS) { console.error('window.RS не инициализирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const fresh = () => RS.seed();
const app = id => RS.appById(id);

/* 1. Неполный пакет → «Анализ» заблокирован; докомплект → открыт. */
(() => { fresh();
  const a = app('RS-1003');
  const before = RS.canAdvance(a).ok;
  RS.requiredDocs(a).forEach(d => a.packetDocs[d] = true);
  const after = RS.canAdvance(a).ok;
  ok(1, before === false && after === true, `до=${before} после=${after}`);
})();

/* 2. Незавизированное заключение → «Комитет» закрыт; виза → открыт; +заключант → снова требование. */
(() => { fresh();
  const a = app('RS-1004');
  const closed = RS.conclGate(a).ok === false;
  a.conclusions.find(c => c.dept === 'ДПО').visa = true;
  const opened = RS.conclGate(a).ok === true;
  a.conclusions.push({ dept: 'Юр', text: '', visa: false, visaDate: null });
  const reblocked = RS.conclGate(a).ok === false;
  ok(2, closed && opened && reblocked, `closed=${closed} opened=${opened} reblock=${reblocked}`);
})();

/* 3. Поля условий вне разрешений видов — не в allowedParams; +вид расширяет набор. */
(() => { fresh();
  const a = app('RS-1004');                       // вид K2 (Изменение графика) — без rate
  const before = RS.allowedParams(a);
  const rateAllowedBefore = before.has('rate');
  a.kindIds.push('K4');                            // +Капитализация → добавляет forgive/term
  const after = RS.allowedParams(a);
  const grew = after.size > before.size && after.has('forgive');
  ok(3, rateAllowedBefore === false && grew, `rateBefore=${rateAllowedBefore} grew=${grew}`);
})();

/* 4. «Направлено в Минфин» → события паузы/оверлея; отказ → снятие следующим днём + риск. */
(() => { fresh();
  const a = app('RS-1002');
  const hasPause   = a.automation.some(e => e.kind === 'pause');
  const hasOverlay = a.automation.some(e => e.kind === 'overlay');
  const unpause = a.automation.find(e => e.kind === 'unpause');
  const nextDay = unpause && unpause.when === '2026-07-01' && a.minfin.date === '2026-06-30';
  const risk = a.automation.some(e => e.kind === 'risk' && e.when === '2026-07-01');
  ok(4, hasPause && hasOverlay && nextDay && risk, `pause=${hasPause} overlay=${hasOverlay} nextDay=${nextDay} risk=${risk}`);
})();

/* 5. Красный гейт обеспечения блокирует ДС; waiver разблокирует. */
(() => { fresh();
  const a = app('RS-1001'); a.waiver = null;
  const cr = RS.creditById('CR-60541'); cr.collateralValue = cr.balance; // покрытие 100% <120%
  const blocked = RS.coverGateApp(a).ok === false;
  a.waiver = { granted: true, reason: 'основание', by: 'Комиссия', date: RS.TODAY };
  const unlocked = RS.coverGateApp(a).ok === true;
  ok(5, blocked && unlocked, `blocked=${blocked} unlocked=${unlocked}`);
})();

/* 6. ДС без номера/даты невалидно; с реквизитами → dsGate ok; версия «действует». */
(() => { fresh();
  const a = app('RS-1004');
  a.ds = { no: '', date: '' };  const bad = RS.dsGate(a).ok === false;
  a.ds = { no: 'ДС-1', date: '2026-07-19' }; const good = RS.dsGate(a).ok === true;
  const activated = app('RS-1001').version.state === 'действует';
  ok(6, bad && good && activated, `bad=${bad} good=${good} activated=${activated}`);
})();

/* 7. Режим просрочки (1) обнуляет счётчик дней; (2) — нет. */
(() => { fresh();
  const a1 = app('RS-1005');                       // вид K1 overdueMode 1
  const cr1 = RS.creditById(a1.creditIds[0]); cr1.odDays = 55;
  RS.applyEntryOps(a1);
  const zeroed = cr1.odDays === 0;
  const a2 = app('RS-1002'); a2.kindIds = ['K2'];  // K2 overdueMode 2
  const cr2 = RS.creditById(a2.creditIds[0]); cr2.odDays = 77;
  RS.applyEntryOps(a2);
  const kept = cr2.odDays === 77;
  ok(7, zeroed && kept, `mode1_zeroed=${zeroed} mode2_kept=${kept}`);
})();

/* 8. Кредит с активной заявкой нельзя добавить во вторую заявку (Р-2). */
(() => { fresh();
  const busy = RS.activeAppOnCredit('CR-61200', 'RS-9999'); // в активной RS-1004
  const free = RS.activeAppOnCredit('CR-58120', 'RS-9999'); // только в закрытой RS-1003
  ok(8, busy && busy.id === 'RS-1004' && !free, `busy=${busy && busy.id} free=${free ? free.id : 'нет'}`);
})();

/* 9. Роль Наблюдатель: canX по всем действиям = false; Куратор — да. */
(() => { fresh();
  RS.state.role = 'Наблюдатель';
  const anyAllowed = ['addCredit','fixMinfin','regDS','waiver','manageDict','fixCommittee'].some(a => RS.canX(a));
  RS.state.role = 'Куратор ОД';
  const curatorCan = RS.canX('regDS');
  ok(9, anyAllowed === false && curatorCan === true, `observerAllowed=${anyAllowed} curatorRegDS=${curatorCan}`);
})();

/* 10. Новый вид, добавленный в рантайме, доступен в заявках. */
(() => { fresh();
  const n0 = RS.state.kinds.length;
  RS.state.kinds.push({ id:'KX', name:'Тестовый вид', params:['rate','grace'], docs:['Заявление'], overdueMode:2, limits:'' });
  const a = app('RS-1004'); a.kindIds.push('KX');
  const grew = RS.state.kinds.length === n0 + 1 && RS.allowedParams(a).has('rate');
  ok(10, grew, `kinds=${RS.state.kinds.length} sawRate=${RS.allowedParams(a).has('rate')}`);
})();

/* 11. Создание заявки: реестр растёт, ИНН/охват/виды заданы, стадия «Регистрация», гейт пакета закрыт. */
(() => { fresh();
  const n0 = RS.state.apps.length;
  const app = {                                    // повторяет createApp() без DOM
    ...RS.__baseApp('RS-2001','02508199700123','ОсОО «Ак-Жол Агро»',['K1'],['CR-61200'],'2026-07-19'),
    conclusions:[{dept:'СРМиК',text:'',visa:false,visaDate:null},{dept:'ДПО',text:'',visa:false,visaDate:null}]
  };
  RS.state.apps.push(app);
  const grew = RS.state.apps.length === n0 + 1;
  const st = RS.stageOf(app);
  const stage0 = st.idx === 0 && !st.closed;
  const packetClosed = RS.packetGate(app).ok === false;   // пакет пуст → гейт закрыт
  const busy = !!RS.activeAppOnCredit('CR-61200', app.id); // CR-61200 занят RS-1004 → конфликт виден
  ok(11, grew && stage0 && packetClosed && busy, `grew=${grew} stage0=${stage0} packetClosed=${packetClosed} conflictSeen=${busy}`);
})();

/* 12. seedCredits: у каждого кредита есть snapshot/paid/remainingTermMonths с ожидаемыми числами. */
(() => { fresh();
  const cr = RS.creditById('CR-60540');
  const okSnap = cr.snapshot && cr.snapshot.principal === 4200000 && cr.snapshot.overduePrincipal === 380000
    && cr.snapshot.accruedInterest === 118000 && cr.snapshot.penalty === 73000;
  const okPaid = cr.paid && cr.paid.principalPaid === 800000 && cr.paid.interestPaid === 340000 && cr.paid.penaltyPaid === 0;
  const okRem  = cr.remainingTermMonths === 22;
  ok(12, okSnap && okPaid && okRem, `snap=${!!okSnap} paid=${!!okPaid} rem=${cr.remainingTermMonths}`);
})();

/* 13. versionFrom: вход конструктора инициализирован, plan=null, snapshot скопирован. */
(() => { fresh();
  const cr = RS.creditById('CR-60540');
  const v = RS.versionFrom(cr);
  const inputsOk = v.inputs && v.inputs.forgivePenalty === 0 && v.inputs.capInterest === 0
    && v.inputs.capPenalty === 0 && Array.isArray(v.inputs.graceBlocks) && v.inputs.graceBlocks.length === 0;
  const shape = v.cutoffDate === RS.TODAY && v.snapshot.principal === cr.snapshot.principal
    && v.plan === null && v.overdueMode === 1;
  ok(13, inputsOk && shape, `inputs=${!!inputsOk} shape=${!!shape}`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-07-19 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

// вставляем результат в шапку HTML
const marker = 'SMOKE (node scripts/inspect/restructuring-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку restructuring.html');
}
process.exit(pass === results.length ? 0 : 1);
