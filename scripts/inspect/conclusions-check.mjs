// Проверка фичи «Заключения отделов» (спек 2026-07-10).
// Грузит мокап, драйвит назначение/ЖЦ заключений, ассертит модель и DOM. Ищет JS-ошибки.
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

const results = [];
const check = (name, ok) => { results.push((ok ? 'PASS ' : 'FAIL ') + name); };

// Заявка З-2026-000105 — демо-сид: комплект подтверждён ГФ, залога нет,
// заключения в трёх состояниях (submitted · submitted · draft · pending).
async function openConcl(num, role){
  await page.evaluate(([n, r]) => { setRole(r || 'spec'); gotoDetail(n, 'tab-concl'); showTab('tab-concl'); }, [num, role]);
  await page.waitForTimeout(250);
}

// ── T1: справочник и модель ──────────────────────────────────────────────
await openConcl('З-2026-000105');
const t1 = await page.evaluate(() => {
  const app = _detailApp, c = _conclOf(app);
  return {
    dirKeys:   DEPT_DIR.map(d => d.key),
    dflt:      DEPT_DIR.filter(d => d.dflt).map(d => d.key),
    hasColl:   app.hasCollateral,
    assigned:  c.assigned.map(a => a.dept),
    statuses:  c.assigned.map(a => c.items[a.dept].status),
    riskV:     c.items.risk.verdict,
    riskConds: c.items.risk.conds.length,
    riskFiles: c.items.risk.files.length,
    lockedRisk:   _conclLocked(app, 'risk'),
    lockedLegal:  _conclLocked(app, 'legal'),
    counts:    _conclCounts(app),
    ready:     conclusionsReady(app),
    logLen:    c.items.risk.log.length,
  };
});
check('T1 справочник содержит 7 отделов', t1.dirKeys.length === 7 && t1.dirKeys.includes('analytics') && t1.dirKeys.includes('monitor'));
check('T1 дефолтные — risk + credit', t1.dflt.join(',') === 'risk,credit');
check('T1 у демо-заявки 105 залога нет', t1.hasColl === false);
check('T1 сид 105: назначены risk,credit,legal,analytics', t1.assigned.join(',') === 'risk,credit,legal,analytics');
check('T1 сид 105: статусы submitted,submitted,draft,pending', t1.statuses.join(',') === 'submitted,submitted,draft,pending');
check('T1 сид 105: риск — «С условиями», 2 пункта, 1 вложение', t1.riskV === 'cond' && t1.riskConds === 2 && t1.riskFiles === 1);
check('T1 дефолтный отдел заперт, опциональный — нет', t1.lockedRisk === true && t1.lockedLegal === false);
check('T1 счётчики: pos1 cond1 neg0 pending2 done2 total4',
  t1.counts.pos === 1 && t1.counts.cond === 1 && t1.counts.neg === 0 && t1.counts.pending === 2 &&
  t1.counts.done === 2 && t1.counts.total === 4);
check('T1 гейт закрыт — внесены не все', t1.ready === false);
check('T1 у внесённого заключения есть история', t1.logLen >= 2);

// ── T1b: залог → авто-назначение отдела залога; без залога — только дефолтные;
//        отклонённая заявка — neg у риска ─────────────────────────────────
const t1b = await page.evaluate(() => {
  const coll   = APPLICATIONS.find(a => a.hasCollateral && condPhase(a.status) === 'draft');
  const noColl = APPLICATIONS.find(a => !a.hasCollateral && condPhase(a.status) === 'draft' && a.num !== 'З-2026-000105');
  const rej    = APPLICATIONS.find(a => a.status === 'Отклонена');
  return {
    collDepts:   coll ? _conclOf(coll).assigned.map(a => a.dept) : null,
    collAuto:    coll ? _conclOf(coll).assigned.find(a => a.dept === 'coll').auto : null,
    collLocked:  coll ? _conclLocked(coll, 'coll') : null,
    noCollDepts: noColl ? _conclOf(noColl).assigned.map(a => a.dept) : null,
    noCollLock:  noColl ? _conclLocked(noColl, 'coll') : null,
    rejVerdict:  rej ? _conclOf(rej).items.risk.verdict : null,
    rejReady:    rej ? conclusionsReady(rej) : null,
    negDepts:    rej ? _conclNegDepts(rej) : null,
  };
});
check('T1b при залоге отдел залога назначен авто и заперт',
  t1b.collDepts && t1b.collDepts.join(',') === 'risk,credit,coll' && t1b.collAuto === true && t1b.collLocked === true);
check('T1b без залога назначены только дефолтные, coll не заперт',
  t1b.noCollDepts && t1b.noCollDepts.join(',') === 'risk,credit' && t1b.noCollLock === false);
check('T1b отклонённая заявка: у риска отрицательное', t1b.rejVerdict === 'neg');
check('T1b отрицательное закрывает гейт', t1b.rejReady === false && t1b.negDepts.join(',') === 'risk');

console.log(results.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO JS ERRORS');
await ctx.close();
if (results.some(r => r.startsWith('FAIL')) || errors.length) process.exit(1);
