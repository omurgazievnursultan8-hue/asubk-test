/* Аудит ДОСТОВЕРНОСТИ ЗАТРАВКИ макета «Взыскание» (mockups/collection/collection.html).
   Запуск: node scripts/inspect/collection-data-audit.mjs
   Печатает находки кодами A · B · C · D · E · F · G: справочники (вид, раздел, исход, канал,
   основание, номер, даты), гейты последовательности и коллегиальных органов в момент
   регистрации каждой меры, согласованность фазы/охвата/суммы/истории с журналом.
   Волна ДС (01.08.2026) снизила выдачу с 235 находок до 32; оставшиеся 32 — три
   модельных тупика, описанных в mockups/collection/ASUBK-status-razrabotki.md. */
import { chromium } from 'playwright-core';
const file = 'file:///home/azamat/projects/asubk-credit-module/.claude/worktrees/vzyskanie/mockups/collection/collection.html';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(file);
await p.waitForTimeout(400);

const out = await p.evaluate(() => {
  const F = [];                                   // findings
  const add = (code, where, msg) => F.push({ code, where, msg });
  const D = ru => ruD(ru);
  const evd = m => (m.dates && (m.dates.event || m.dates.registered)) || null;

  const SCOPE_SETTING = new Set(['Первичная претензия','Повторная претензия','Требование поручителю','Требование гаранту',
    'Требование отраслевому госоргану','Исковое заявление','Исполнительный лист','Извещение об обращении на залог']);

  const numIndex = {};
  for(const pr of PROCESSES) for(const m of pr.measures||[]){
    if(!m.num) continue;
    (numIndex[m.num] ??= []).push({proc:pr.id, kind:m.kind});
  }

  for(const pr of PROCESSES){
    const W = `дело ${pr.id}`;
    const reqIds = new Set(pr.requirements.map(r=>r.id));
    const byNum = {}; for(const m of pr.measures||[]) if(m.num) byNum[m.num] = m;

    // A10 — ничто в деле (история, меры, сроки, заседания) не может быть датировано
    // раньше открытия самого дела: opened — это МОМЕНТ ОТКРЫТИЯ, а не мягкая граница.
    // Раньше это било мимо всех существующих кодов — A9 смотрит только на меры (даты
    // мер), G1 сверяет ТЕКСТ истории с фазой, а не её ДАТУ с opened — история могла
    // рассказывать связную историю, которая началась до того, как дело завели.
    {
      const openedD = D(pr.opened);
      if(openedD){
        for(const h of pr.history||[]){
          const hd = D(String(h.when).split(' ')[0]);
          if(hd && hd < openedD) add('A10-до-открытия', `${W} · история ${h.when}`, `дата раньше открытия дела (${pr.opened})`);
        }
        for(const m of pr.measures||[]){
          const md = D(evd(m));
          if(md && md < openedD) add('A10-до-открытия', `${W} · мера ${m.num||'(без №)'} «${m.kind}»`, `дата раньше открытия дела (${pr.opened})`);
        }
        for(const d of pr.deadlines||[]){
          const bm = /\((\d{2}\.\d{2}\.\d{4})\)\s*$/.exec(d.base||'');
          if(bm){
            const bd = D(bm[1]);
            if(bd && bd < openedD) add('A10-до-открытия', `${W} · срок tpl=${d.tpl}`, `основание датировано ${bm[1]} — раньше открытия дела (${pr.opened})`);
          }
        }
        for(const h of pr.hearings||[]){
          const hd = D(String(h.when).split(' ')[0]);
          if(hd && hd < openedD) add('A10-до-открытия', `${W} · заседание ${h.when}`, `дата раньше открытия дела (${pr.opened})`);
        }
      }
    }

    for(const m of pr.measures||[]){
      const w = `${W} · мера ${m.num||'(без №)'} «${m.kind}»`;
      const kd = kindOf(m.kind);
      if(!kd){ add('A1-вид', w, 'вид меры отсутствует в справочнике MEASURE_KINDS'); continue; }

      // A2 раздел
      if(m.sec && m.sec !== sectionOf(m.kind)) add('A2-раздел', w, `sec='${m.sec}', а по справочнику KIND_SECTION раздел '${sectionOf(m.kind)}'`);

      // A3 исход
      if(kd.outcomes){
        const vals = kd.outcomes.map(o=>o.value);
        if(m.outcome != null && !vals.includes(m.outcome)) add('A3-исход', w, `исход '${m.outcome}' не входит в исходы вида [${vals.filter(Boolean).join(' | ')}]`);
      } else if(m.outcome){
        add('A3-исход', w, `у вида нет модели результата (outcomes:null${kd.resultIsDocument?', resultIsDocument':''}), но задан исход '${m.outcome}'`);
      }

      // A4 purpose «установление фазы «X»»
      const mp = /установление фазы «(.+?)»/.exec(m.purpose||'');
      const setp = measureSetsPhase(m);
      if(mp && mp[1] !== setp) add('A4-цель', w, `в purpose заявлена фаза «${mp[1]}», а пара вид×исход ставит ${setp?`«${setp}»`:'ничего'}`);
      if(!mp && setp && /установление фазы/.test(m.purpose||'')) add('A4-цель', w, `purpose='${m.purpose}' не разобран`);

      // A5 вручение
      if(kd.needsDelivery){
        if(!m.sent) add('A5-вручение', w, 'вид требует вручения, но нет sent (направление)');
        else if(m.sent.channel && !(kd.deliveryChannels||[]).includes(m.sent.channel) && m.sent.channel!=='документ приобщён')
          add('A5-вручение', w, `канал '${m.sent.channel}' вне справочника каналов вида [${(kd.deliveryChannels||[]).join(' | ')}]`);
      } else if(m.sent || m.served){
        add('A5-вручение', w, 'вид не требует вручения (needsDelivery:false), но заданы sent/served');
      }

      // A6 охват
      if(m.scope && !SCOPE_SETTING.has(m.kind)) add('A6-охват', w, `вид не устанавливает охват, но на мере задан scope=${m.scope.volume}/${m.scope.method}`);
      if(!m.scope && SCOPE_SETTING.has(m.kind)) add('A6-охват', w, 'вид устанавливает охват, но scope на мере не задан');

      // A7 основание
      if(m.basedOn){
        if(!kd.basisKinds) add('A7-основание', w, `у вида basisKinds:null, но задан basedOn='${m.basedOn}'`);
        else {
          const src = byNum[m.basedOn];
          if(!src) add('A7-основание', w, `basedOn='${m.basedOn}' — меры с таким номером в деле нет`);
          else {
            if(!kd.basisKinds.includes(src.kind)) add('A7-основание', w, `основание ${m.basedOn} имеет вид «${src.kind}», допустимы [${kd.basisKinds.join(' | ')}]`);
            const t1 = D(evd(src)), t2 = D(evd(m));
            if(t1 && t2 && t1 > t2) add('A7-основание', w, `основание ${m.basedOn} датировано ${evd(src)} — позже самой меры (${evd(m)})`);
          }
        }
      }

      // A8 цели
      const tg = m.targets||[];
      if(!tg.length) add('A8-цели', w, 'нет targets');
      for(const t of tg) if(!reqIds.has(t)) add('A8-цели', w, `target '${t}' — такого требования в деле нет`);

      // A9 даты
      const ev = m.dates && m.dates.event, rg = m.dates && m.dates.registered;
      if(!ev && !rg) add('A9-даты', w, 'нет дат (dates.event/registered)');
      if(ev && D(ev) > D(TODAY)) add('A9-даты', w, `дата события ${ev} в будущем (сегодня ${TODAY})`);
      if(ev && rg && D(rg) < D(ev)) add('A9-даты', w, `регистрация ${rg} раньше события ${ev}`);
      if(ev && D(ev) < D(pr.opened||'01.01.2000')) add('A9-даты', w, `дата ${ev} раньше открытия дела (${pr.opened})`);
      if(m.received && m.received.date && ev && D(m.received.date) < D(ev)) add('A9-даты', w, `получение ${m.received.date} раньше события ${ev}`);
      if(m.sent && m.served && D(m.served.date) < D(m.sent.date)) add('A9-даты', w, `вручение ${m.served.date} раньше направления ${m.sent.date}`);

      // A10 источник vs получение/направление
      if(kd.source==='внешний акт' && m.sent) add('A10-источник', w, 'внешний акт, но задано наше направление sent');
      if(kd.source==='наш документ' && m.received && kd.needsDelivery) add('A10-источник', w, 'наш документ с needsDelivery, но задано received');

      // A11 дубликаты номеров
      if(m.num && numIndex[m.num].length>1) add('A11-номер', w, `номер ${m.num} встречается ${numIndex[m.num].length} раз: ${numIndex[m.num].map(x=>x.proc+'/'+x.kind).join(', ')}`);
    }

    // B — последовательность: воспроизводим журнал по каждому требованию
    const all = pr.measures||[];
    for(const r of pr.requirements){
      const mine = all.filter(m => (m.targets||[]).includes(r.id) && isLiveFor(m, r.id))
        .map((m,i)=>({m,i,t:D(evd(m))||0})).sort((a,b)=>(a.t-b.t)||(a.i-b.i)).map(x=>x.m);
      for(let i=0;i<mine.length;i++){
        pr.measures = mine.slice(0,i);
        const why = sequenceReason(r, mine[i].kind);
        if(why) add('B1-последовательность', `${W} · требование ${r.id} · мера ${mine[i].num||''} «${mine[i].kind}» от ${evd(mine[i])}`, why);
        const g = gateReason(r, mine[i].kind);
        if(g) add('B2-гейт', `${W} · требование ${r.id} · мера ${mine[i].num||''} «${mine[i].kind}»`, g);
      }
      pr.measures = all;
    }
  }

  // C — состояние требований
  const rows = [];
  for(const pr of PROCESSES) for(const r of pr.requirements){
    const ph = phaseOf(r), eph = effectivePhaseOf(r), st = stageOfReq(r);
    const ms = liveMeasuresOf(r);
    const kinds = ms.map(m=>m.kind);
    const secs = [...new Set(kinds.map(sectionOf))];
    const d = debtOf(r);
    rows.push({ id:r.id, proc:pr.id, borrower:pr.borrower, role:r.role, phase:ph, ephase:eph, stage:st,
      contour:contourOf(r), scope:scopeLabel(scopeOf(r)), overdue:overdueOf(r), cat:catOfReq(r),
      closed:isClosedReq(r), outcome:outcomeOf(r), left:d.totalLeft, claim:d.claim,
      subdiv:r.subdivision, personState:personStateOf(r),
      measures: ms.map(m=>({num:m.num,kind:m.kind,sec:sectionOf(m.kind),date:evd(m),outcome:m.outcome,sum:m.sum,setsPhase:measureSetsPhase(m)})),
      sections:secs, group:groupOf(pr) });

    const W = `требование ${r.id} (дело ${pr.id}, ${pr.borrower})`;
    // C1: мера продвинутого раздела при отсталой фазе
    const maxSec = secs.reduce((a,s)=> Math.max(a, SECTION_CLEVEL[s]||0), 0);
    const curL = CONTOUR_LEVEL[contourOf(r)] ?? 0;
    if(maxSec > curL) add('C1-раздел>фаза', W, `фаза «${ph}» (контур ${contourOf(r)}, ступень ${curL}), но в журнале есть меры разделов [${secs.join(', ')}] — ступень ${maxSec}`);
    // C2: просрочка vs фаза
    const od = overdueOf(r);
    if(['Судебный порядок','Исполнительное производство'].includes(st) && od>0 && od<90)
      add('C2-просрочка', W, `стадия «${st}», но просрочка по кредиту всего ${od} дн.`);
    if(st==='Наблюдение' && od>180) add('C2-просрочка', W, `стадия «Наблюдение» при просрочке ${od} дн. (>180 — высокий риск, п. 20.1)`);
    if(st==='Досудебный порядок' && od>365) add('C2-просрочка', W, `досудебная стадия при просрочке ${od} дн.`);
    // C3: закрытое требование с ненулевым остатком / открытое с нулём
    if(r._closedChk) {}
    if(isClosedReq(r) && outcomeOf(r)==='Полное погашение' && d.totalLeft>0) add('C3-остаток', W, `исход «Полное погашение», но остаток ${fmtKGS(d.totalLeft)}`);
    if(!isClosedReq(r) && d.totalLeft<=0) add('C3-остаток', W, `нулевой остаток, но требование не закрыто`);
    // C4: сумма меры-вехи vs притязание
    const pm = phaseSetter(r);
    if(pm && pm.sum!=null){
      const s = parseSum(pm.sum);
      // мера может целить в несколько требований (§2.2) — сравниваем с суммой по ЦЕЛЯМ, один раз на кредит
      const tg = (pm.targets||[]).map(id=>REQ_INDEX[id]).filter(Boolean);
      const claimAll = claimTotal(tg.length?tg:[r]);
      if(s>0 && Math.abs(s - claimAll) > Math.max(1, claimAll*0.02))
        add('C4-сумма', W, `сумма вехи ${pm.num} = ${pm.sum}, а притязание по её целям (${tg.length||1}) = ${fmtKGS(claimAll)}`);
      if(s===0 && claimAll>0) add('C4-сумма', W, `сумма вехи ${pm.num} = 0,00 при притязании ${fmtKGS(claimAll)}`);
    }
    // C5: состояние лица
    if(personStateOf(r)==='банкротство' && !['Инициирование банкротства','Признано банкротом'].includes(ph))
      add('C5-состояние', W, `состояние лица «банкротство», сырая фаза «${ph}»`);
    // C6: подразделение vs полномочия по последним мерам
    for(const m of ms){
      const allowed = subdivOf(m.kind);
      if(allowed && m.responsible){
        rows.at(-1).respCheck ??= [];
        rows.at(-1).respCheck.push({num:m.num, kind:m.kind, resp:m.responsible, allowed});
      }
    }
    // C7: незакрытые сроки на закрытом требовании
    const dls = (pr.deadlines||[]).filter(x=>(x.targets||[]).includes(r.id));
    if(isClosedReq(r) && dls.length) add('C7-сроки', W, `требование закрыто (${outcomeOf(r)}), но на нём висит ${dls.length} срок(ов): ${dls.map(x=>x.tpl).join(', ')}`);
    // C8: передача в подвешенном состоянии на закрытом требовании
    if(isClosedReq(r) && handoverPending(r)) add('C7-сроки', W, 'требование закрыто, но передача ждёт приёма');
  }

  // D — заседания
  for(const pr of PROCESSES) for(const h of pr.hearings||[]){
    const w = `дело ${pr.id} · заседание ${h.when} (${h.kind||''})`;
    const m = (pr.measures||[]).find(x=>x.num===h.measureNum);
    if(h.measureNum && !m) add('D1-заседание', w, `measureNum='${h.measureNum}' — меры с таким номером в деле нет`);
    if(!h.measureNum) add('D1-заседание', w, 'заседание не привязано к мере (measureNum пуст)');
  }

  // E — сроки
  for(const pr of PROCESSES) for(const d of pr.deadlines||[]){
    const w = `дело ${pr.id} · срок tpl=${d.tpl} (${d.due})`;
    const t = DEADLINE_TEMPLATES.find(x=>x.n===d.tpl);
    if(!t){ add('E1-срок', w, `шаблона ${d.tpl} нет в DEADLINE_TEMPLATES`); continue; }
  }

  // F — вопросы на органы
  for(const pr of PROCESSES) for(const q of pr.committeeQuestions||[]){
    const w = `дело ${pr.id} · вопрос «${q.topic}»`;
    const known = CQ_SUBJECTS.some(s=>s.topic===q.topic);
    if(!known) add('F1-вопрос', w, 'предмет вне справочника CQ_SUBJECTS');
    const s = CQ_SUBJECTS.find(s=>s.topic===q.topic);
    if(s && s.organ && q.organ && q.organ!==s.organ) add('F1-вопрос', w, `орган '${q.organ}', а по справочнику предмет выносится на '${s.organ}'`);
    for(const c of q.credits||[]) if(!pr.credits.some(x=>x.id===c)) add('F1-вопрос', w, `кредит '${c}' не принадлежит делу`);
  }

  // G — история дела vs вычисленная фаза
  for(const pr of PROCESSES){
    // фазы, которые дело КОГДА-ЛИБО проходило (история — журнал, а не снимок)
    const phases = new Set();
    for(const r of pr.requirements){
      phases.add(phaseOf(r)); phases.add(effectivePhaseOf(r));
      for(const m of liveMilestones(r)){ const ph = measureSetsPhase(m); if(ph) phases.add(ph); }
    }
    const eph = phases;
    for(const h of pr.history||[]){
      const m = /фаза «([^»]+)»/.exec(h.what||'');
      if(!m) continue;
      if(!phases.has(m[1]) && !eph.has(m[1]))
        add('G1-история', `дело ${pr.id} · история ${h.when}`, `текст обещает фазу «${m[1]}», а требования дела сейчас на [${[...eph].join(' | ')}]`);
    }
  }
  // G2 — кредит без леджера
  for(const pr of PROCESSES) for(const c of pr.credits){
    if(typeof LEDGER!=='undefined' && !LEDGER[c.id]) add('G2-леджер', `дело ${pr.id} · кредит ${c.num}`, 'нет записи в LEDGER — долг требования считается нулём');
  }
  // G3 — заседание и его мера
  for(const pr of PROCESSES) for(const h of pr.hearings||[]){
    const m = (pr.measures||[]).find(x=>x.num===h.measureNum);
    if(!m) continue;
    const hd = ruD(String(h.when).split(' ')[0]), md = D(evd(m));
    if(hd && md && hd < md) add('D1-заседание', `дело ${pr.id} · заседание ${h.when}`, `раньше своей меры ${m.num} (${evd(m)})`);
  }
  // G4 — сроки на требовании: due раньше открытия дела
  for(const pr of PROCESSES) for(const dl of pr.deadlines||[]){
    if(dl.due && pr.opened && ruD(dl.due) < ruD(pr.opened)) add('E1-срок', `дело ${pr.id} · срок tpl=${dl.tpl}`, `дата ${dl.due} раньше открытия дела ${pr.opened}`);
  }
  return { findings:F, rows, procCount:PROCESSES.length, reqCount:allReqs().length, TODAY };
});

await b.close();
console.log('pageerrors:', errs);
console.log(JSON.stringify(out, null, 1));
console.log(`ИТОГО находок: ${out.findings.length} · дел: ${out.procCount} · требований: ${out.reqCount}`);
