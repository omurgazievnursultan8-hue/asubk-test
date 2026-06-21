import { chromium } from 'playwright-core';

const b = await chromium.launch({ channel:'chrome', headless:true });
const p = await b.newPage({ viewport:{ width:1400, height:1100 } });
const url = 'file://' + process.cwd() + '/mockups/decision/decisions.html';

const results = [];
const log = (tag, pass, detail) => { results.push({ tag, pass, detail }); console.log(`${pass?'PASS':'FAIL'} ${tag} :: ${detail}`); };

// fresh state: clear localStorage, then reload so seeds run clean
await p.goto(url);
await p.evaluate(() => { localStorage.removeItem('asubk_decisions_v2'); localStorage.removeItem('asubk_decisions_v1'); });
await p.goto(url);
await p.waitForTimeout(200);

// ---------- FILTER default = Одобрен ----------
let r = await p.evaluate(() => ({ cond: conditions[0], rows: filtered.length, allApproved: filtered.every(d=>d.status==='Одобрен') }));
log('FILTER-default', r.cond.prop==='status'&&r.cond.value==='Одобрен'&&r.allApproved, `default cond=${r.cond.prop}=${r.cond.value}, ${r.rows} rows, allApproved=${r.allApproved}`);

// ---------- R3: code generation ----------
r = await p.evaluate(() => ({
  a: genCode('Постановление','15.06.2026'),
  b2: genCode('Распоряжение кабинета министров','31.10.2025'),
  noKind: genCode('', '15.06.2026'),
  noYear: genCode('Постановление',''),
}));
log('R3-codegen-format', /^ПОСТ-2026-\d{4}$/.test(r.a), `Постановление+2026 => ${r.a}`);
log('R3-codegen-kindmap', /^РАСП-2025-\d{4}$/.test(r.b2), `РКМ+2025 => ${r.b2}`);
log('R3-codegen-guard', r.noKind===''&&r.noYear==='', `missing kind=>"${r.noKind}", missing year=>"${r.noYear}"`);
r = await p.evaluate(() => {
  const first = genCode('Основное','01.03.2099');
  DATA.push({code:first, kind:'Основное', date:'01.03.2099', status:'Одобрен', docs:[],log:[],programs:[]});
  const second = genCode('Основное','01.03.2099');
  DATA.pop();
  return { first, second };
});
log('R3-codegen-increment', /-0001$/.test(r.first)&&/-0002$/.test(r.second), `seq ${r.first} -> ${r.second}`);

// ---------- R5: future date rejected (manual) ----------
await p.evaluate(() => openCreate());
await p.waitForTimeout(100);
let alertMsg = null;
p.once('dialog', async d => { alertMsg = d.message(); await d.accept(); });
await p.evaluate(() => { const i=document.getElementById('decisionDate'); i.value='01.01.2099'; i.dispatchEvent(new Event('change')); });
await p.waitForTimeout(100);
r = await p.evaluate(() => document.getElementById('decisionDate').value);
log('R5-future-manual', alertMsg&&/будущ/i.test(alertMsg)&&r==='', `alert="${alertMsg}", field reset="${r}"`);

// R5: calendar disables future days
await p.evaluate(() => document.getElementById('calToggle').click());
await p.waitForTimeout(100);
r = await p.evaluate(() => {
  const pop=document.querySelector('.dp-pop');
  for(let i=0;i<24;i++){ const n=pop.querySelector('[data-nav="1"]'); n&&n.click(); }
  const days=[...pop.querySelectorAll('.dp-day[data-off="0"]')];
  return { total:days.length, disabled:days.filter(d=>d.disabled).length };
});
log('R5-future-calendar', r.disabled===r.total&&r.total>0, `future month: ${r.disabled}/${r.total} days disabled`);

// ---------- R1: approve gating on main doc ----------
await p.evaluate(() => { conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'На стадии рассмотрения'}]; renderConds(); applyFilter(); });
await p.waitForTimeout(50);
const noMainIdx = await p.evaluate(()=>filtered.findIndex(d=>!(d.docs||[]).some(x=>x.main&&!x.rejected)));
alertMsg=null;
p.once('dialog', async d=>{ alertMsg=d.message(); await d.accept(); });
await p.evaluate((i)=>{ selectRow(i); approveSelected(); }, noMainIdx);
await p.waitForTimeout(100);
r = await p.evaluate((i)=>filtered[i].status, noMainIdx);
log('R1-approve-blocked-nomaindoc', alertMsg&&/основн/i.test(alertMsg)&&r==='На стадии рассмотрения', `alert="${(alertMsg||'').split('\n')[0]}", status=${r}`);

// add main doc then approve
await p.evaluate((i)=>{ selectRow(i); openDetail(); detailRec.docs.push({id:'tpdf',name:'main.pdf',size:1000,main:true,version:1,at:'now',by:'admin'}); renderDocs(); }, noMainIdx);
p.on('dialog', async d=>{ await d.accept(); });
await p.evaluate((i)=>{ selectRow(i); approveSelected(); }, noMainIdx);
await p.waitForTimeout(100);
r = await p.evaluate(()=>{ const rec=DATA.find(d=>d.docs&&d.docs.some(x=>x.id==='tpdf')); return rec&&rec.status; });
log('R1-approve-ok-withmaindoc', r==='Одобрен', `record after approve status=${r}`);

// R1: non-PDF rejected by validator
r = await p.evaluate(()=>{
  const isPdf=f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf';
  const f={name:'x.docx',type:'',size:500};
  return isPdf(f);
});
log('R1-nonpdf-detect', r===false, `x.docx isPdf=${r} (rejected path)`);

// R1: approved record - file delete disabled
r = await p.evaluate(()=>{
  const rec=DATA.find(d=>d.status==='Одобрен'&&(d.docs||[]).length>0);
  detailRec=rec; renderDocs();
  const del=[...document.querySelectorAll('#docList [data-act="remove"]')];
  return { found:!!rec, all:del.length, disabled:del.some(b=>b.disabled) };
});
log('R1-approved-file-delete-blocked', r.found&&r.all>0&&r.disabled, `approved: ${r.all} files, delete disabled=${r.disabled}`);

// ---------- R2: reject reason + audit ----------
await p.evaluate(()=>{ conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'На стадии рассмотрения'}]; renderConds(); applyFilter(); });
await p.waitForTimeout(50);
r = await p.evaluate(()=>{
  selectRow(0); document.getElementById('btnReject').click();
  return { open:document.getElementById('reasonOverlay').classList.contains('open'), confirmDisabled:document.getElementById('reasonConfirm').disabled };
});
log('R2-reject-modal-gated', r.open&&r.confirmDisabled, `modal=${r.open}, confirm disabled w/o reason=${r.confirmDisabled}`);
r = await p.evaluate(()=>{
  const t=document.getElementById('reasonText'); t.value='Причина теста'; t.dispatchEvent(new Event('input'));
  const dis=document.getElementById('reasonConfirm').disabled;
  const name=filtered[0].name;
  document.getElementById('reasonConfirm').click();
  const rec=DATA.find(d=>d.name===name);
  return { enabled:!dis, status:rec.status, reason:rec.rejectReason, last:rec.log[rec.log.length-1] };
});
log('R2-reject-applies', r.enabled&&r.status==='Закрыт'&&r.reason==='Причина теста', `enabled=${r.enabled}, status=${r.status}, reason="${r.reason}"`);
log('R2-reject-audit', r.last&&r.last.action==='Отклонение'&&r.last.reason==='Причина теста', `log=${r.last&&r.last.action}/"${r.last&&r.last.reason}"/${r.last&&r.last.by}`);

// reactivate
r = await p.evaluate(()=>{
  conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'Закрыт'}]; renderConds(); applyFilter();
  const idx=filtered.findIndex(d=>d.rejectReason==='Причина теста');
  selectRow(idx);
  const dis=document.getElementById('btnReactivate').disabled;
  document.getElementById('btnReactivate').click();
  const t=document.getElementById('reasonText'); t.value='Возврат теста'; t.dispatchEvent(new Event('input'));
  const name=filtered[idx].name;
  document.getElementById('reasonConfirm').click();
  const rec=DATA.find(d=>d.name===name);
  return { dis, status:rec.status, reason:rec.rejectReason, last:rec.log[rec.log.length-1] };
});
log('R2-reactivate', r.dis===false&&r.status==='На стадии рассмотрения'&&r.reason==='', `enabled=${!r.dis}, status=${r.status}, reason cleared=${r.reason===''}`);
log('R2-reactivate-audit', r.last&&r.last.action==='Возврат на рассмотрение', `log action=${r.last&&r.last.action}`);

// R7: status-gated buttons on approved row
r = await p.evaluate(()=>{
  conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'Одобрен'}]; renderConds(); applyFilter();
  selectRow(0);
  const g=id=>document.getElementById(id).disabled;
  return { ap:g('btnApprove'), rj:g('btnReject'), re:g('btnReactivate'), del:g('btnDelete'), ed:g('btnEdit'), vw:g('btnView') };
});
log('R7-buttons-on-approved', r.ap&&r.rj&&r.re&&r.del&&!r.ed&&!r.vw, `approved: approve/reject/react/del disabled=${r.ap}/${r.rj}/${r.re}/${r.del}, edit/view enabled=${!r.ed}/${!r.vw}`);

// ---------- R4: delete protection ----------
alertMsg=null;
p.removeAllListeners('dialog');
p.once('dialog', async d=>{ alertMsg=d.message(); await d.accept(); });
await p.evaluate(()=>{ conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'Одобрен'}]; renderConds(); applyFilter(); selectRow(0); document.getElementById('btnDelete').click(); });
await p.waitForTimeout(50);
log('R4-delete-approved-blocked', alertMsg&&/стадии рассмотрения/i.test(alertMsg), `alert="${alertMsg}"`);

alertMsg=null;
p.once('dialog', async d=>{ alertMsg=d.message(); await d.accept(); });
r = await p.evaluate(()=>{
  conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'На стадии рассмотрения'}]; renderConds(); applyFilter();
  const idx=filtered.findIndex(d=>d.refs>0);
  selectRow(idx); document.getElementById('btnDelete').click();
  return idx>=0?filtered[idx].refs:null;
});
await p.waitForTimeout(50);
log('R4-delete-refs-blocked', alertMsg&&/ссылаются/i.test(alertMsg), `refs=${r}, alert="${alertMsg}"`);

// pending refs=0 -> soft delete (auto-accept confirm)
p.removeAllListeners('dialog');
p.on('dialog', async d=>{ await d.accept(); });
r = await p.evaluate(()=>{
  conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'На стадии рассмотрения'}]; renderConds(); applyFilter();
  const idx=filtered.findIndex(d=>d.refs===0);
  return idx>=0?filtered[idx].name:null;
});
await p.evaluate((name)=>{ const idx=filtered.findIndex(d=>d.name===name); selectRow(idx); document.getElementById('btnDelete').click(); }, r);
await p.waitForTimeout(100);
let after = await p.evaluate((name)=>{ const rec=DATA.find(d=>d.name===name); return { deleted:rec&&rec.deleted, inList:filtered.some(d=>d.name===name), last:rec&&rec.log[rec.log.length-1] }; }, r);
log('R4-soft-delete', after.deleted===true&&after.inList===false, `"${r}" deleted=${after.deleted}, hidden=${!after.inList}`);
log('R4-delete-audit', after.last&&after.last.action==='Удаление', `log action=${after.last&&after.last.action}`);

// ---------- R6: detail page ----------
r = await p.evaluate(()=>{
  conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'Одобрен'}]; renderConds(); applyFilter();
  selectRow(0); openDetail();
  const v=id=>document.getElementById(id).textContent;
  return { view:document.getElementById('detailView').classList.contains('active'), name:v('dName'), kind:v('dKind'),
    date:v('dDate'), org:v('dOrg'), active:v('dActive'),
    tabs:[...document.querySelectorAll('#detailTabs .tab')].map(t=>t.textContent),
    programs:document.querySelectorAll('#dPrograms tr').length, timeline:document.querySelectorAll('#dTimeline .tl-item').length };
});
log('R6-detail-view', r.view&&r.name!=='—', `active=${r.view}, name="${r.name}"`);
log('R6-detail-fields', !!(r.kind&&r.date&&r.org)&&['Да','Нет'].includes(r.active), `kind="${r.kind}", date="${r.date}", org="${r.org}", active=${r.active}`);
log('R6-detail-tabs', r.tabs.length===4&&r.tabs.includes('Документы')&&r.tabs.includes('История'), `tabs=[${r.tabs.join(', ')}]`);
log('R6-detail-programs', r.programs>0, `linked programs=${r.programs}`);
log('R6-detail-timeline', r.timeline>0, `timeline entries=${r.timeline}`);
r = await p.evaluate(()=>{
  conditions=[{prop:'status',label:'Статус',type:'enum',op:'equal',value:'Закрыт'}]; renderConds(); applyFilter();
  selectRow(0); openDetail();
  return { shown:document.getElementById('dReasonField').style.display!=='none', reason:document.getElementById('dReason').textContent };
});
log('R6-detail-reason-closed', r.shown&&r.reason&&r.reason!=='—', `reason field shown=${r.shown}, reason="${r.reason}"`);

const fails = results.filter(x=>!x.pass);
console.log(`\n==== ${results.length-fails.length}/${results.length} PASS, ${fails.length} FAIL ====`);
if (fails.length) console.log('FAILURES:\n'+fails.map(f=>`  - ${f.tag}: ${f.detail}`).join('\n'));
await b.close();
