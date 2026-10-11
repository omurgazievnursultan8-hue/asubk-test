// Headless смоук для mockups/dashboard/dashboard.html — макет модуля «Дашборд» (седьмой модуль, «показывает»).
// Zero-dep: вытаскивает <script> из HTML и исполняет движок window.DB в node:vm без DOM
// (render() и toast() при отсутствии document — no-op). Проверяет правила канона
// mockups/dashboard/ASUBK-dashbord-logika.md на живом движке, а не «код есть»:
//   A  восемь форматов, круговой нет; плитка — один объект и до четырёх показателей (ИДБ-8)
//   B  каждая плитка объявленных раскладок отвечает при всех волнах (ИДБ-14)
//   C  число = строки: «кто в этом числе» складывается ровно в число плитки (ИДБ-7, ИДБ-9)
//   D  движение сходится, строка «прочее» есть всегда (§5.1)
//   E  сдвиг: неполный период не сравнивается (ИДБ-11), у остатков — закрытый список из трёх баз
//   F  фильтр панели и относительные параметры только сужают (ИДБ-12)
//   G  права у данных: недоступная плитка не прячется, а называет причину (ИДБ-4)
//   H  волны запуска: роль без готового ядра получает минимальную раскладку; «Мои задания» — волна 3
//   I  ступени — только по разрезу с объявленным порядком; доля — два показателя одной единицы
//   J  перекладка: новая плитка роли встаёт в конец, удалённая исчезает; «вернуть как объявлено» (ИДБ-6)
//   K  версия против новой плитки; публикация только автопроверкой (черновик, если вопрос не отвечает)
//   L  свои экраны — не больше пяти; плитка хранит вопрос, а не числа (ИДБ-2)
//   M  сторож чистоты: в видимом тексте макета нет ссылок на ADR, ДБ-, ИДБ-
// Запуск: node scripts/inspect/dashboard-check.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'mockups/dashboard/dashboard.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const ctx = { window:{}, console, setTimeout, setInterval };
vm.createContext(ctx); vm.runInContext(js, ctx);
const DB = ctx.window.DB;

let n = 0, fail = 0;
function ok(cond, msg){ n++; if(cond) console.log('  ✓ '+msg); else { fail++; console.log('  ✕ '+msg); } }
const P = id => DB.personaById(id);
const T = id => DB.tileById(id);
const near = (a,b) => Math.abs(a-b) <= Math.max(1, Math.abs(b)*1e-9);

console.log('A · форматы и вопрос плитки');
ok(Object.keys(DB.FORMATS).length===8 && !('pie' in DB.FORMATS), 'восемь форматов, круговой нет');
ok(DB.TILES.every(t=>t.m.length>=1 && t.m.length<=4), 'у каждой плитки 1–4 показателя');
ok(DB.TILES.every(t=>t.m.every(id=>id in DB.OBJ[t.obj].metrics)), 'все показатели плитки — одного объекта');
ok(DB.TILES.filter(t=>t.show.share).every(t=>t.m.length===2), 'доля — ровно два показателя');
ok(DB.TILES.every(t=>!('value' in t) && !('vals' in t)), 'плитка не хранит чисел');

console.log('B · объявленные раскладки отвечают');
DB.state.wave = 3;
for(const [role, secs] of Object.entries(DB.LAYOUTS)){
  const who = DB.PERSONAS.find(p=>p.roles.includes(role));
  const bad = secs.flatMap(s=>s.tiles).filter(id=>{ const a = DB.ask(T(id), who, null); return a.state!=='ok'; });
  ok(!bad.length, 'роль «'+DB.ROLES[role].name+'»: все плитки отвечают'+(bad.length?' — нет: '+bad.join(','):''));
}

console.log('C · число = строки');
let checked = 0, mism = [];
for(const p of DB.PERSONAS){
  for(const tab of DB.tabsOf(p).filter(t=>t.role)){
    for(const id of DB.viewSections(p, tab.key).flatMap(s=>s.items.map(i=>i.id))){
      const t = T(id); if(!['num','numShift'].includes(t.fmt)) continue;
      const a = DB.ask(t, p, null); if(a.state!=='ok') continue;
      const m = a.ms[0]; if(m.agg==='max') continue;
      const r = DB.statRows(a, {}); checked++;
      const sum = r.list.reduce((s,x)=>s+(x.vs[0]||0),0);
      if(!near(sum, a.vals[0])) mism.push(p.id+':'+id);
    }
  }
}
ok(checked>40 && !mism.length, 'строки складываются в число у '+checked+' плиток'+(mism.length?' — нет: '+mism.join(','):''));
{ const a = DB.ask(T('loans'), P('u-ruk'), null); const r = DB.statRows(a, {});
  ok(r.refused && r.tooMany && r.n===a.vals[0], 'выше порога — отказ с числом строк ('+r.n+'), а не обрезанный список'); }
{ const a = DB.ask(T('ovdSteps'), P('u-ruk'), null); const node = a.nodes[a.nodes.length-1];
  const r = DB.statRows(a, {dim:'odb', key:node.key});
  ok(near(r.list.reduce((s,x)=>s+x.vs[0],0), node.vals[0]), 'клик по ступени «'+node.key+'» — строки этого узла'); }

console.log('D · движение');
const flows = DB.TILES.filter(t=>t.fmt==='flow' && t.state==='pub');
ok(flows.every(t=>{ const p = DB.PERSONAS.find(x=>DB.ask(t,x,null).state==='ok'); const a = DB.ask(t, p, null); return a.move && a.move.ok && 'other' in a.move; }), 'все '+flows.length+' «Движения» сходятся, «прочее» есть');

console.log('E · сдвиг');
const so = per => DB.shiftOptions({ obj:'payment', m:['amt'], per, show:{} });
ok(!so('m')[0].ok && /неполный период/.test(so('m')[0].why), 'текущий месяц — сдвиг погашен: «неполный период не с чем честно сравнить»');
ok(!so('today')[0].ok && !so('q')[0].ok, 'сегодня и текущий квартал — тоже нет');
ok(so('pm')[0].ok && so('pq')[0].ok && so('py')[0].ok, 'законченные периоды — м/м, кв/кв, г/г');
ok(DB.shiftOptions({ obj:'loan', m:['bal'], show:{} }).length===3, 'у остатков — три базы');

console.log('F · фильтр и параметры только сужают');
DB.state.panel = { region:'Ошская', unit:'', program:'' };
const ruk = P('u-ruk');
const widened = DB.TILES.filter(t=>t.obj==='loan' && t.state==='pub' && ['num','numShift'].includes(t.fmt)).filter(t=>{
  const a = DB.ask(t, ruk, null), b = DB.ask(t, ruk, DB.state.panel); return a.state==='ok' && b.vals[0] > a.vals[0] + 1e-6; });
ok(!widened.length, 'фильтр «Ошская» нигде не увеличил число');
{ const b = DB.ask(T('myTasks'), ruk, DB.state.panel); ok(b.panelSkipped.includes('region'), 'неприменимый фильтр — плитка печатает «без фильтра»'); }
DB.state.panel = { region:'', unit:'', program:'' };
{ const cur = P('u-cur'); const a = DB.ask(T('c_loans'), cur, null);
  ok(a.vals[0]>0 && a.rows.every(r=>r.cur===cur.emp), '«Мои кредиты» у куратора — только его кредиты ('+a.vals[0]+')');
  ok(DB.ask(T('c_loans'), ruk, null).vals[0]===0, 'та же плитка у руководителя — 0: «я» подставляется по смотрящему');
  ok(a.rows.every(r=>DB.unitDown(cur.scope).includes(r.unit)), 'охват режет сверху: строки только из области видимости'); }

console.log('G · права у данных');
{ const a = DB.ask(T('risk'), P('u-buh'), null); ok(a.state==='noaccess' && /не открыт вашей роли/.test(a.why), 'бухгалтерии «Сумма под риском» — «нельзя», плитка не прячется'); }

console.log('H · волны запуска');
DB.state.wave = 1;
ok(!DB.hasLayout('otc') && !DB.hasLayout('spec') && DB.hasLayout('ruk'), 'волна 1: Отчётность и Кредитный специалист — минимальная, Руководство — своя');
ok(!DB.answering(T('myTasks')) && DB.declaredFor('otc').every(s=>!s.items.length), '«Мои задания» — волна 3: в раскладку не попадает');
ok(DB.declaredFor('ruk').every(s=>s.items.every(i=>DB.answering(T(i.id)))), 'в раскладку попадает только отвечающая плитка');
{ const a = DB.ask(T('myTasks'), ruk, null); ok(a.state==='refuse', 'неготовая плитка — «не отвечается», владелец назван'); }
DB.state.wave = 3;

console.log('I · допустимость форматов');
{ const fa = DB.formatAvail({ obj:'loan', m:['bal'], dims:['region'], f:[], show:{}, per:null });
  ok(/нет объявленного порядка/.test(fa.steps) && !fa.slice, 'ступени по «Области» погашены с причиной, разрез — можно'); }
{ const fa = DB.formatAvail({ obj:'loan', m:['bal'], dims:[], f:[], show:{}, per:null });
  ok(/выберите период оборотов/.test(fa.flow) && /нужны два разреза/.test(fa.heat), 'движение без периода и карта без двух разрезов — погашены'); }
{ const fa = DB.formatAvail({ obj:'loan', m:['ovd'], dims:[], f:[], show:{}, per:null });
  ok(!fa.flow || /период/.test(fa.flow), 'у «Просрочено» обороты объявлены'); }

console.log('J · перекладка');
DB.setPersona && (DB.state.persona = 'u-ruk');
DB.state.tab = 'role:ruk';
delete DB.state.overlays['u-ruk|role:ruk'];
DB.LAY.hide('loans');
ok(DB.viewSections(ruk, 'role:ruk')[0].items.find(i=>i.id==='loans').hidden, 'скрыть у себя — флаг в перекладке, объявленная не тронута');
ok(!DB.LAYOUTS.ruk[0].tiles.includes('x') && DB.LAYOUTS.ruk[0].tiles.includes('loans'), 'объявленная раскладка роли не изменилась');
DB.LAYOUTS.ruk[0].tiles.unshift('cntRegion');
{ const secs = DB.viewSections(ruk, 'role:ruk'); const last = secs[secs.length-1].items; ok(last[last.length-1].id==='cntRegion', 'новая плитка роли встала в конец личной перекладки'); }
DB.LAYOUTS.ruk[0].tiles.shift(); DB.LAYOUTS.ruk[0].tiles.splice(DB.LAYOUTS.ruk[0].tiles.indexOf('borrowers'),1);
ok(!DB.viewSections(ruk, 'role:ruk').some(s=>s.items.some(i=>i.id==='borrowers')), 'удалённая из объявленной — исчезла из перекладки');
DB.LAYOUTS.ruk[0].tiles.splice(1,0,'borrowers');
DB.LAY.reset();
ok(!DB.state.overlays['u-ruk|role:ruk'], '«вернуть как объявлено» стирает перекладку целиком');

console.log('K · версия и публикация');
DB.state.persona = 'u-an';
DB.state.draft = Object.assign(DB.blankDraft(), { editingId:'risk', title:'Под риском', obj:'loan', m:['risk'], fmt:'numShift', show:{shift:'ys'} });
const v0 = T('risk').ver; DB.saveDraft('own');
ok(T('risk').ver===v0+1 && T('risk').title==='Под риском', 'правка подписи и показа — новая версия той же плитки');
const before = DB.TILES.length;
DB.state.draft = Object.assign(DB.blankDraft(), { editingId:'risk', title:'Остаток вместо риска', obj:'loan', m:['bal'], fmt:'num' });
DB.saveDraft('draft');
ok(DB.TILES.length===before+1 && T('risk').m[0]==='risk', 'смена показателя — новая плитка, старая не тронута');
DB.state.wave = 1;
DB.state.draft = Object.assign(DB.blankDraft(), { title:'Задания отдела', obj:'task', m:['open'], fmt:'num' });
const t1 = DB.saveDraft('pub');
ok(t1.state==='draft', 'вопрос не отвечает — публикация оставляет черновиком');
DB.state.wave = 3;
DB.state.draft = Object.assign(DB.blankDraft(), { title:'Задания отдела', obj:'task', m:['open'], fmt:'num' });
ok(DB.saveDraft('pub').state==='pub', 'автопроверка прошла — опубликована без второго ключа');
ok(DB.TILES.filter(t=>t.src==='own').every(t=>t.owner), 'личная плитка знает автора');

console.log('L · свои экраны');
let err = null; try{ for(let i=0;i<6;i++) DB.newScreen(P('u-otd'), 'Экран '+i, false); }catch(e){ err = e; }
ok(err && DB.state.screens.filter(s=>s.owner==='u-otd').length===5, 'шестой свой экран — отказ');

console.log('M · сторож чистоты');
const visible = html.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
ok(!/ADR-\d|ДБ-\d|ИДБ-\d|ИС-\d/.test(visible), 'в видимом тексте нет номеров решений');

console.log('\n'+(n-fail)+' из '+n+' проверок'+(fail?' — ПРОВАЛ':' — ok'));
process.exit(fail?1:0);
