/* Аудит ДОСТОВЕРНОСТИ ЗАТРАВКИ макета «Взыскание» (mockups/collection/collection.html).
   Запуск: node scripts/inspect/collection-data-audit.mjs
   Печатает находки кодами A · B · C · D · E · F · G: справочники (вид, раздел, исход, канал,
   основание, номер, даты), гейты последовательности и коллегиальных органов в момент
   регистрации каждой меры, согласованность фазы/охвата/суммы/истории с журналом.
   Волна ДС (01.08.2026, старая SEED-модель — до затравки-декларации ниже) снизила
   выдачу с 235 находок до 32; те 32 были тремя модельными тупиками старой SEED,
   описанными в mockups/collection/ASUBK-status-razrabotki.md — числа и id из того
   отчёта (142/56/п, 309/409/г, 097…397 и т.д.) относятся к ДРУГОЙ, дореформенной
   затравке и с текущими id (Tasks 1–6, «SEED = декларация + билдер») не совпадают.
   Текущий прогон (Tasks 1–6, контуры К0…К3): 0 находок, 52 дела, 55 требований —
   см. ИТОГО в конце вывода, не эту шапку. */
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

  // Task 7 fix-round1 (Important 2): 'Признание банкротом' дописан — тот же идиом
  // scope+accelerated, что 'Извещение об обращении на залог' уже несёт (п. 20.4);
  // без записи здесь новая мера падала бы в A6 («вид не устанавливает охват»),
  // хотя п. 71 («все обязательства считаются наступившими») именно охват и меняет.
  const SCOPE_SETTING = new Set(['Первичная претензия','Повторная претензия','Требование поручителю','Требование гаранту',
    'Требование отраслевому госоргану','Исковое заявление','Исполнительный лист','Извещение об обращении на залог',
    'Признание банкротом']);

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
        /* Task 9 fix round 2: вопрос на коллегиальный орган — такая же датированная
           запись дела, что история/меры/сроки/заседания, и до этой правки был
           единственной, которую A10 не смотрела вовсе. Билдер выводит дату заседания
           как «дата гейтовой меры − 10 к.д.»: сдвинь кто-нибудь меру к самому
           открытию — и заседание уехало бы ЗА него молча. */
        for(const q of pr.committeeQuestions||[]){
          for(const f of ['meetingDate','protocolDate']){
            const qd = q[f] ? D(q[f]) : null;
            if(!qd) continue;
            if(qd < openedD)
              add('A10-до-открытия', `${W} · вопрос «${q.topic}» (${f})`, `дата ${q[f]} раньше открытия дела (${pr.opened})`);
            /* Task 9 fix round 3 (ревью, Minor): верхняя граница — как у мер (A9) и
               издержек (C9). Вопрос, объявленный кейсом напрямую (extra), минует
               вывод даты билдером («дата гейтовой меры − 10 к.д.») целиком, и
               протокол «из будущего» проходил бы молча. Заседание, НАЗНАЧЕННОЕ на
               будущее, законно — верхняя граница только у протокола (решение
               состоялось) и у уже РЕШЁННОГО вопроса. */
            if(qd > D(TODAY) && (f === 'protocolDate' || q.decided))
              add('A10-до-открытия', `${W} · вопрос «${q.topic}» (${f})`, `дата ${q[f]} в будущем (сегодня ${TODAY}), а вопрос уже решён`);
          }
        }
        /* Task 9 fix round 3 (ревью, Minor): передача требования (п. 98) — такой же
           датированный факт дела, как мера или издержка, и до этого раунда её дату не
           проверяло НИЧТО (журнал живёт на требовании, а A10 обходила дело). */
        for(const r of pr.requirements||[]) for(const h of r.handovers||[]){
          const hd = h.when ? D(h.when) : null;
          if(!hd) continue;
          if(hd < openedD) add('A10-до-открытия', `${W} · передача ${r.id} → ${h.to} (${h.when})`, `дата раньше открытия дела (${pr.opened})`);
          if(hd > D(TODAY)) add('A10-до-открытия', `${W} · передача ${r.id} → ${h.to} (${h.when})`, `дата в будущем (сегодня ${TODAY})`);
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
            // Ревью раунд3, IMPORTANT: пересечение targets меры и её основания — раньше
            // не проверялось НИЧЕМ в аудите (только живым рендером panelSud, пилюля
            // «basedOn вне целей»); старый C1 (до раунда2) ловил аналогичную форму
            // per-требование, редизайн C1 её потерял, а комментарий рядом с C1 ошибочно
            // утверждал, что это уже проверяет A7 — не проверял. basedOnValid(m) — та
            // же функция, что рендер уже использует (не переизобретаем пересечение
            // здесь второй раз, делегируем).
            if(!basedOnValid(m)) add('A7-основание', w, `пересечение целей меры (${(m.targets||[]).join(', ')||'—'}) и целей основания ${m.basedOn} (${(src.targets||[]).join(', ')||'—'}) пусто — ссылка адресует чужую цель`);
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
    // C1 (ревью раунд1 IMPORTANT 2, раунд2 IMPORTANT): переписан ВТОРОЙ раз — раунд1
    // хардкодил «Исковое заявление» как единственный корень, но справочник УЖЕ отвечает
    // на этот вопрос: basisKinds:null у вида означает «основание не нужно», а не «нужно,
    // но конкретно это не подходит». Хардкод корня бил ложными находками на «Иск стороны
    // в отношении Фонда» (иск ПРОТИВ Фонда — по определению не наш, basisKinds:null),
    // «Письмо в правоохранительные органы» (тоже basisKinds:null) и любую меру, что
    // повисла бы на третьем законном корне «Исковое заявление на понуждение» (тоже
    // basisKinds:null, свой отдельный трек). Заодно двоился с B1 на больших прыжках
    // («Письмо в ПССИ» на К1 — B1 ловит стадийным гейтом, старый C1 бил ВТОРОЙ находкой
    // за то же самое, хотя у вида и так basisKinds:null — обоснования не требуется
    // вовсе). Переписан на прямое чтение справочника, без единого хардкода вида:
    // basisKinds != null — вид ТРЕБУЕТ основания — а basedOn не задан вовсе. A7 (выше
    // по файлу, ревью раунд3 добавил ей проверку пересечения targets через
    // basedOnValid — раньше НЕ проверяла) проверяет basedOn, КОГДА ОНО ЗАДАНО (вид,
    // дата, пересечение целей); этот код — симметричная половина: ОТСУТСТВИЕ
    // обязательного basedOn. «Частная жалоба» без
    // иска по-прежнему ловится (её basisKinds не null, а безоговорочный builder-код
    // всегда ставит basedOn — синтетические данные без него остаются находкой), и
    // двойного репорта с B1 больше нет: у видов, что B1 ловит стадийным прыжком без
    // veha-позиции (Письмо в ПССИ и подобные), basisKinds — null.
    for(const m of ms){
      const kd = kindOf(m.kind);
      if(!kd || !kd.basisKinds) continue;
      if(!m.basedOn)
        add('C1-без-основания', W, `мера «${m.kind}» ${m.num||''} — вид требует основания (basisKinds: [${kd.basisKinds.join(' | ')}]), а basedOn не задан`);
    }
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
    // C4 (ревью раунд1, IMPORTANT 3; раунд2, MINOR — делегирование): «одна мера на
    // требование» было тем же классом дыры под разными именами (сперва phaseSetter(r),
    // потом scopeSetter(r) — оба читают ТОЛЬКО последнюю по времени меру); определение,
    // решение, постановление апелляц. инстанции, ЧЖ/АЖ, МС, СДИ не проверялись НИЧЕМ.
    // Проверяем КАЖДУЮ меру requirement'а с sum, под ОХВАТОМ, что реально действовал
    // в момент ЕЁ СОБСТВЕННОЙ регистрации — LEDGER статичен (ADR-0004, единственный
    // `asOf`), значит «какой охват действовал НА ДАТУ» — чистая функция журнала, не
    // требует машины времени по деньгам. scopeAtDate — единственная часть, что
    // ОСТАЁТСЯ здесь: замер «на дату» не существует нигде на живой странице (там
    // scopeOf/scopeSetter всегда живые, «сейчас»), это по природе аудиторская
    // историческая реплика — тот же приём, что и B1 выше (усечённый журнал). Но САМ
    // фолд денег (бакеты LEDGER, дедуп по кредиту) раньше был ВТОРОЙ копией debtOf/
    // claimTotal с литеральным списком бакетов вместо LEDGER_BUCKETS — тот же класс
    // дыры, что чинил делегирующий C1 (переизобретение вместо чтения справочника).
    // claimTotal(reqs, scopeVolume) (ревью раунд2) — расширена необязательным вторым
    // параметром РОВНО под эту нужду, без изменения поведения ни одного из остальных
    // вызовов без второго аргумента: делегируем реальному фолду, не копируем его.
    function scopeAtDate(rq, dateStr){
      const bound = D(dateStr);
      const at = liveScopeMeasures(rq).filter(x => { const t = D(evd(x)); return t!=null && bound!=null && t<=bound; });
      return at.length ? at[at.length-1].scope : DEFAULT_SCOPE;
    }
    // Task 7 fix-round1 (ruling координатора п.1/п.4): claimTotal получает ТРЕТЬИМ
    // аргументом дату САМОЙ МЕРЫ (evd(m)) — debtOf() теперь считает пятую статью
    // (costs) и ускорение (accelerated, п. 71) date-aware, и без этого аргумента
    // «на дату» деградировало бы обратно в «сейчас» (costs/ускорение будущих или
    // ещё-не-наступивших событий молча утекали бы в притязание меры из прошлого —
    // ровно тот системный разрыв, что дело 350 съедало на 88% старого 2%-допуска).
    // Task 7 fix-round2 (ruling координатора п.2): 0,05% (было 0,02 → 0,0005) на
    // претензиях в сотни тысяч — это 75–175 сом, всё ещё щель для систематического
    // сдвига. Суммы целые в копейках (sumKGS) и проходят fmtKGS→parseSum туда-обратно
    // БЕЗ потерь — round-off не накапливается. Допуск — плоский 1 сом (не «%
    // от суммы»): совпадение либо точное (с точностью до сантима), либо это не
    // округление, а расхождение модели — measure, не tolerance, чинить.
    for(const m of ms){
      if(m.sum == null) continue;
      const s = parseSum(m.sum);
      const scopeHere = scopeAtDate(r, evd(m));
      // мера может целить в несколько требований (§2.2) — сравниваем с суммой по ЦЕЛЯМ, один раз на кредит
      const tg = (m.targets||[]).map(id=>REQ_INDEX[id]).filter(Boolean);
      const claimAll = claimTotal(tg.length?tg:[r], scopeHere.volume, evd(m));
      if(s>0 && Math.abs(s - claimAll) > 1)
        add('C4-сумма', W, `сумма меры ${m.num||''} «${m.kind}» = ${m.sum} (${evd(m)}), а притязание под охватом «${scopeHere.volume}», действовавшим на эту дату, по её целям (${tg.length||1}) = ${fmtKGS(claimAll)}`);
      if(s===0 && claimAll>0) add('C4-сумма', W, `сумма меры ${m.num||''} «${m.kind}» = 0,00 при притязании ${fmtKGS(claimAll)}`);
    }
    // C5: состояние лица
    if(personStateOf(r)==='банкротство' && !['Инициирование банкротства','Признано банкротом'].includes(ph))
      add('C5-состояние', W, `состояние лица «банкротство», сырая фаза «${ph}»`);
    // C7: незакрытые сроки на закрытом требовании
    const dls = (pr.deadlines||[]).filter(x=>(x.targets||[]).includes(r.id));
    if(isClosedReq(r) && dls.length) add('C7-сроки', W, `требование закрыто (${outcomeOf(r)}), но на нём висит ${dls.length} срок(ов): ${dls.map(x=>x.tpl).join(', ')}`);
    // C8: передача в подвешенном состоянии на закрытом требовании
    if(isClosedReq(r) && handoverPending(r)) add('C7-сроки', W, 'требование закрыто, но передача ждёт приёма');
    // C9 (Task 7 fix-round1, ruling координатора п.3 — «класс, который ревью
    // не смогло увидеть»): та же дисциплина, что A10 уже применяет к истории/мерам/
    // срокам/заседаниям дела, но её не было для пятой статьи (r.costs) — издержка,
    // датированная раньше открытия дела или позже TODAY, была бы находкой A10-
    // семьи в любом другом месте журнала; расходы её обходили молча (ровно так и
    // была датирована старая COSTS_SEED-константа '25.07.2026' — на четыре дня
    // позже TODAY, никем не пойманная).
    for(const x of (r.costs||[])){
      const xd = D(x.date);
      if(!xd) continue;
      if(pr.opened && xd < D(pr.opened))
        add('C9-издержки', W, `издержка «${x.kind}» ${x.date} — раньше открытия дела (${pr.opened})`);
      if(xd > D(TODAY))
        add('C9-издержки', W, `издержка «${x.kind}» ${x.date} — в будущем (сегодня ${TODAY})`);
    }
  }

  /* C6 — подписант. Task 9 fix round 2 (утверждение вместо сбора строк) + round 3
     (ревью, Important 3: ключ).

     Буквальное `resp ∈ allowed` данным недоступно: allowed — список ПОДРАЗДЕЛЕНИЙ
     (['ДАК','ОД','РП']), а m.responsible — ФИО, и карты «ФИО → подразделение» в данных
     нет. Единственная похожая, ACCEPTOR_BY_DEPT, авторитетом не является: затравка
     переиспользует те же имена как кураторов дел ДРУГИХ подразделений — сверка по ней
     даёт 46 «нарушений» на 12 делах прошлых волн (303, 307, 316, 322, 338, 120, 345,
     355, 359, 376, 377, 392 — измерено прогоном). Пробел записан в отчёт для Task 12.

     Утверждается проверяемое высказывание той же природы, взятое из самой модели
     подписанта (respFor: `deptCurators[cr.subdiv] || c.curator`): подписант — функция
     ПОДРАЗДЕЛЕНИЯ КРЕДИТА, а не вида меры. Значит ключ — ПАРА «набор допустимых
     подразделений × подразделение кредита меры», а не один только набор: дело с
     кредитами в РАЗНЫХ подразделениях, оба из которых допустимы для одного вида
     (например претензия по ОД-договору и по ДАК-договору), законно подписано ДВУМЯ
     людьми, и ключ по одному набору репортил бы это как дефект (round 2 проходил лишь
     потому, что deptCurators дела 412 схлопывается на те же имена). Подразделение
     кредита читается через цели меры (m.targets → требование → _credit.subdiv), а не
     через r.subdivision: последнее двигает ПРИНЯТАЯ ПЕРЕДАЧА (ADR-0023), тогда как
     подписант определялся подразделением договора на момент регистрации.

     По ДЕЛУ, а не по требованию: мера может целить в несколько требований, и внутри
     цикла по требованиям один и тот же разнобой репортился бы дважды. */
  for(const pr of PROCESSES){
    const signerOf = {};
    for(const m of pr.measures||[]){
      const allowed = subdivOf(m.kind);
      if(!allowed || !m.responsible) continue;
      const creditSubdivs = [...new Set((m.targets||[]).map(id => REQ_INDEX[id])
        .filter(Boolean).map(r => String((r._credit||{}).subdiv || '—')))].sort();
      const key = `${allowed.join(' | ')} @ ${creditSubdivs.join('+') || '—'}`;
      const prev = signerOf[key];
      if(prev && prev.resp !== m.responsible)
        add('C6-подписант', `дело ${pr.id} · мера ${m.num||'(без №)'} «${m.kind}»`,
          `подписант «${m.responsible}», а мера ${prev.num} «${prev.kind}» с тем же ключом «${key}» (допустимые подразделения × подразделение кредита) подписана «${prev.resp}» — подписант выводится из подразделения кредита, а не из вида меры: у одной пары он один`);
      signerOf[key] ??= { resp:m.responsible, num:m.num, kind:m.kind };
    }
  }

  // D — заседания
  for(const pr of PROCESSES) for(const h of pr.hearings||[]){
    const w = `дело ${pr.id} · заседание ${h.when} (${h.kind||''})`;
    const m = (pr.measures||[]).find(x=>x.num===h.measureNum);
    if(h.measureNum && !m) add('D1-заседание', w, `measureNum='${h.measureNum}' — меры с таким номером в деле нет`);
    if(!h.measureNum) add('D1-заседание', w, 'заседание не привязано к мере (measureNum пуст)');
    // D2 (ревью раунд2, MINOR): та же «дыра», что реестр «Заседания» (frame().hole) и
    // карточка «Суд» уже считают/красят живым рендером — до сих пор не было НИ ОДНОГО
    // кода-инварианта, только ручной просмотр. hApplicable(h) — «Извещение о
    // назначении…» не считается (у него исхода не бывает по природе вида, см.
    // HEARING_NO_OUTCOME_KINDS); прошедший «Судебный процесс» без исхода — да.
    if(hApplicable(h) && !hDone(h) && (hLeft(h) ?? 1) < 0)
      add('D2-заседание', w, 'заседание прошедшее, применимого исхода нет (не уведомление) — исход не внесён');
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
    // Task 9 fix round 2: предмет вопроса бывает СВОБОДНЫМ (CQ_FREE в форме) — форма
    // пишет в topic сам текст, а признак free:true отмечает, что так и задумано. До
    // этой правки F1 не отличала свободный предмет от чужого/опечатки: любой текст вне
    // справочника был находкой, поэтому затравка была вынуждена ставить в topic сам
    // ярлык-заглушку «Другое (иной вопрос)», и настоящий предмет прятался в решении.
    const known = CQ_SUBJECTS.some(s=>s.topic===q.topic);
    /* Task 9 fix round 3 (ревью, Minor): сам ярлык-заглушка в поле предмета — всегда
       дефект, и с free:true, и без него. Форма пишет в topic СФОРМУЛИРОВАННЫЙ текст, а
       CQ_FREE — лишь значение селекта; но CQ_FREE входит в CQ_SUBJECTS, поэтому без
       этой строки регресс «снова засеяли заглушку» проходил бы как known и оставался
       незамеченным ровно той проверкой, что писалась ради него. */
    if(q.topic === CQ_FREE) add('F1-вопрос', w, `предмет — ярлык-заглушка «${CQ_FREE}» из селекта формы, а не сформулированный вопрос (форма подставляет в topic сам текст, free:true отмечает свободный предмет)`);
    else if(!known && !q.free) add('F1-вопрос', w, 'предмет вне справочника CQ_SUBJECTS (свободный предмет помечается free:true — так его ставит форма)');
    if(q.free && !String(q.topic||'').trim()) add('F1-вопрос', w, 'free:true, но предмет не сформулирован (форма этого не допускает)');
    // Свободным текстом нельзя ПОВТОРИТЬ справочный предмет: гейт совпадает по строке
    // (gateTopic), и «свободный» вопрос с текстом гейтового предмета открыл бы гейт в
    // обход выбора предмета из справочника.
    if(q.free && known) add('F1-вопрос', w, 'помечен свободным (free:true), но текст совпадает с предметом справочника CQ_SUBJECTS — предмет выбирается из справочника, иначе гейт открывается текстом');
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
