#!/usr/bin/env node
'use strict';
// Execute the real runtime and its manual/automatic entries. AI transport is a deterministic fixture.
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(WEB, 'tm-keju-runtime.js'), 'utf8');
const keyi = fs.readFileSync(path.join(WEB, 'tm-keju-runtime-keyi.js'), 'utf8');
const composer = fs.readFileSync(path.join(WEB, 'tm-prompt-composer.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const national = [
  {name:'州学举送', level:'province', interactive:false, daysCost:12, desc:'州学审察，具牒送省。'},
  {name:'礼部省试', level:'national', interactive:true, daysCost:18}
];
const imperial = [...national, {name:'御前亲试', level:'imperial', interactive:true, daysCost:9}];
let assertions = 0;
function ok(value, message) { assert.ok(value, message); assertions++; }
function fixture(tiers = national, opts = {}) {
  const calls = {prompts:[], costs:[], penalties:[], notices:[], logs:[], errors:[]};
  const c = {
    console:{log(){},info(){},warn(){},error(...a){calls.errors.push(a);}},
    setTimeout: fn => {fn(); return 1;}, clearTimeout(){},
    P:{ai:{key:'fixture'}, conf:{maxOutputTokens:16000}, dynasty:'某朝', time:{year:840,daysPerTurn:30},
      keju:{enabled:true, tiers:clone(tiers), history:[], quotaPerExam:opts.quota || 4,
        paradigmOverrides:{graduateTitle:'及第出身', ceremony:{palaceTest: opts.palaceTest !== false}},
        attributeBonus:{gongshi:{fame:18,virtue:12},tanhua:{fame:22,virtue:12}},
        stageDurationDays:{examiner_select:2,huishi_draft:3,huishi:18,dianshi:9,dianshi_draft:2},
        examSubjects:'诗赋与策论', specialRules:'取出身，另候铨选'}},
    GM:{turn:1, year:840, month:1, day:1, vars:{}, chars:[], allCharacters:[], classes:[],parties:[],facs:[],
      eraState:{bureaucracyStrength:0.5}, officeTree:[{name:'吏司',positions:[{name:'知县',rank:7,holder:''}]}]},
    document:{getElementById(){return null;}},
    toast:m=>calls.notices.push(m), showLoading(){}, hideLoading(){}, _dbg(){},
    addEB:(...a)=>calls.logs.push(a), extractJSON:JSON.parse,
    escHtml:s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    renderGameState(){},
    _kejuWriteJishi:(...a)=>calls.logs.push(a),
    _kejuSettleLocalCosts:e=>calls.costs.push('local'),
    _kejuSettleProvincialCosts:e=>calls.costs.push('province'),
    _kejuSettleCentralCost:(e,stage)=>{e._paid=e._paid||{};if(!e._paid[stage]){e._paid[stage]=true;calls.costs.push(stage);}},
    _kejuNotifyUrgentStage:(e,stage)=>calls.notices.push(stage),
    findCharByName:name=>c.GM.chars.find(ch=>ch.name===name),
    createRuntimeCharacter:data=>{
      if(c.TM&&c.TM.HistoricalAgency&&data.isHistorical) {
        const eligibility=c.TM.HistoricalAgency.temporalEligibility(data,{year:c.GM.year});
        if(!eligibility.ok) throw new Error('fixture ingress: '+eligibility.reason);
      }
      c.GM.chars.push(data);return data;
    },
    pickHistoricalCandidates:async()=>[],
    randInt:(a,b)=>a
  };
  c.window = c;
  let roster = [];
  c.callAISmart = async prompt => {
    calls.prompts.push(prompt);
    if (opts.failAI) throw new Error('fixture transport failure');
    if (prompt.includes('暂不写答卷')) {
      const count = Number(prompt.match(/生成(\d+)名合格/)[1]);
      roster = Array.from({length:count},(_,i)=>({name:'举子'+(i+1),age:25+i,origin:'州'+(i+1),
        rank:i+1,ethnicity:'汉',class:i%2?'寒门':'士族',party:'',score:90-i,
        personalityHint:'问学勤恳',isHistorical:false}));
      if (opts.historical) roster[0] = {...roster[0], ...opts.historical};
      return JSON.stringify(opts.duplicate ? roster.map(c=>({...c,name:'同名'})) : roster);
    }
    if (prompt.startsWith('请按')) {
      const names = [...prompt.matchAll(/第(\d+)名：([^（\n]+)（/g)];
      return JSON.stringify(names.map(m=>({rank:Number(m[1]),name:m[2],
        fullAnswer:opts.shortAnswer?'短卷':('臣闻治民者先明本业，而后责其赋役。').repeat(45),evaluation:'先陈农事，次议赋役，条贯尚明。'})));
    }
    if (prompt.includes('各写一则批语')) return JSON.stringify(roster.map(c=>({name:c.name,rank:c.rank,chiefExaminerComment:'所论有据，尚须辨轻重。'})));
    if (prompt.includes('地方选拔模拟器')) return JSON.stringify({totalApplicants:100,passedToNational:20});
    if (prompt.includes('会试评判系统')) return JSON.stringify({passedCount:10,dianshiCount:4,quality:'良好',classRatio:{寒门:0.5}});
    if (prompt.includes('科举进士档案')) return JSON.stringify({bio:'少习经义，客居京师，应本场考试而及第。',appearance:'衣冠整洁。'});
    throw new Error('Unexpected fixture prompt: '+prompt.slice(0,80));
  };
  vm.createContext(c);
  if (opts.agency) {
    c.P.worldSettings={historicalOutcomePolicy:'player-driven'};
    vm.runInContext(composer,c,{filename:'tm-prompt-composer.js'});
  }
  vm.runInContext(runtime, c, {filename:'tm-keju-runtime.js'});
  vm.runInContext(keyi, c, {filename:'tm-keju-runtime-keyi.js'});
  c._adjustHuangwei=(n,why)=>calls.penalties.push({n,why});
  c.startKejuExam({type:opts.enke?'enke':'zhengke'});
  const exam = opts.enke ? c.P.keju.currentEnke : c.P.keju.currentExam;
  exam.huishiTopic = '请论田租与农时相妨之弊。';
  exam.chiefExaminer = '主考甲';
  return {c,exam,calls,opts};
}

async function run() {
  const initial=fixture(national);
  initial.c.P.keju.tiers=[];
  await initial.c.initKejuSystem({era:'某朝',keju:{enabled:true,tiers:clone(national)}});
  ok(initial.c.P.keju.tiers.length===2&&initial.c.P.keju.tiers[1].name==='礼部省试','explicit tiers survive initialization with AI configured');
  ok(initial.calls.prompts.length===0,'explicit examination configuration is not sent for AI replacement');
  const a=fixture(national);
  ok(a.exam.stage==='preliminary_provincial','two-tier exam begins at its sole local selection');
  ok(a.c._kejuStageDays(a.exam,a.exam.stage)===12,'selection duration comes from its tier');
  await a.c._finalizeStageAndAdvance(a.exam);
  ok(a.exam.stage==='examiner_select','sole lower tier advances directly to examiners');
  ok(a.calls.costs.join(',')==='province','no invented county/prefecture examination cost');
  a.exam.stage='huishi';
  await a.c._finalizeStageAndAdvance(a.exam);
  ok(a.exam.stage==='finished'&&a.exam._nationalResultsReady,'automatic national terminal advances to roster');
  ok(a.exam.huishiPassed.length===4&&a.exam.huishiPassed.every(c=>c.name&&c.fullAnswer.length>=600),'roster retains named candidates and readable papers');
  ok(a.exam.finalRanking===null&&a.exam.statistics.dianshiCount===0,'no three-place imperial ranking');
  ok(!a.calls.costs.includes('dianshi')&&!a.calls.notices.includes('dianshi_draft')&&!a.calls.penalties.length,'no palace cost, urgent stage or emperor penalty');
  ok(a.c.GM.eraState.bureaucracyStrength===0.5,'passing the exam does not act as an appointment');
  const body={innerHTML:''};
  a.c.renderFinishedStage(body);
  ok(body.innerHTML.includes('礼部省试放榜')&&body.innerHTML.includes('候铨')&&!/状元|榜眼|探花|三甲/.test(body.innerHTML),'finished UI shows the configured terminal roster');
  a.c.recruitCandidate(0);
  ok(a.c.GM.chars[0].title==='及第出身'&&!a.c.GM.chars[0].officialTitle,'manual candidate entry uses eligibility title');
  ok(a.c.GM.chars[0].resources.fame===18,'ordinary graduate does not receive the third-place bonus');
  a.c.finishKeju();
  ok(a.c.P.keju.currentExam===null&&a.c.P.keju.history[0].terminalLevel==='national','finish archives the national exam');
  ok(a.c.GM.chars.length===4&&a.c.GM._kejuPendingAssignment.length===4,'all graduates including first three enter the pending pool');
  ok(a.c.GM.chars.every(ch=>ch.title==='及第出身'&&!ch.officialTitle),'graduates have no automatic official title');
  a.c._kejuFinalize(a.exam);
  a.c._kejuFinishNational(a.exam);
  ok(a.c.GM.chars.length===4&&a.c.GM._kejuPendingAssignment.length===4&&a.c.P.keju.history.length===1,'repeat finalization is idempotent');
  a.c.GM.turn+=100;
  a.c._kejuAutoAssign();
  ok(!a.c.GM.officeTree[0].positions[0].holder&&a.c.GM._kejuPendingAssignment.length===4,'later automatic settlement neither fills offices nor discards candidates');
  a.c.GM.chars[0].officialTitle='另行授任';
  a.c._kejuAutoAssign();
  ok(a.c.GM._kejuPendingAssignment.length===3,'explicitly appointed graduates leave the waiting pool');

  const manual=fixture(national,{quota:23});manual.exam.stage='huishi';
  manual.c.GM._kejuParadigm={quota:{total:30}};
  await Promise.all([manual.c.generateHuishiResults(),manual.c.generateHuishiResults()]);
  ok(manual.exam.stage==='finished'&&manual.exam.huishiPassed.length===23,'manual release honors the current quota over a stale paradigm quota and the former 20-paper cap');
  ok(manual.calls.prompts.filter(p=>p.includes('暂不写答卷')).length===1&&manual.calls.costs.filter(s=>s==='huishi').length===1,'concurrent manual clicks share one generation and fee');
  ok(!JSON.stringify(manual.exam).includes('_nationalResultsPromise'),'generation promise never enters save data');
  await manual.c.generateHuishiResults();
  ok(manual.calls.prompts.filter(p=>p.includes('暂不写答卷')).length===1,'reopening a released roster does not regenerate it');

  const guard=fixture(national);guard.exam.stage='dianshi';
  await guard.c.startDianshi();
  ok(guard.exam.stage==='finished'&&!guard.calls.costs.includes('dianshi'),'obsolete manual palace entry routes through the actual terminal exam');
  guard.c.confirmFinalRanking();
  ok(guard.exam.finalRanking===null,'manual final-ranking entry cannot add imperial titles');
  const ceremony=fixture(imperial,{palaceTest:false});ceremony.exam.stage='huishi';
  await ceremony.c._finalizeStageAndAdvance(ceremony.exam);
  ok(ceremony.exam.stage==='finished','explicitly disabled palace ceremony overrides an imperial tier');
  const enke=fixture(national,{enke:true});enke.exam.stage='huishi';
  await enke.c._finalizeStageAndAdvance(enke.exam,'currentEnke');
  ok(enke.exam.stage==='finished'&&enke.c.P.keju.currentExam===undefined,'automatic extra examination updates its own slot');

  const old=fixture(imperial);old.exam.stage='huishi';
  await old.c._finalizeStageAndAdvance(old.exam);
  ok(old.exam.stage==='dianshi_draft'&&old.calls.notices.includes('dianshi_draft'),'imperial automatic route still requests palace questions');
  const oldManual=fixture(imperial);oldManual.exam.stage='huishi';
  await oldManual.c.generateHuishiResults();
  ok(oldManual.exam.stage==='dianshi'&&oldManual.exam.dianshiCandidates.length===4,'imperial manual route retains its palace candidates');
  oldManual.exam.dianshiResults=[{name:'甲'},{name:'乙'},{name:'丙'}];
  await oldManual.c._finalizeStageAndAdvance(oldManual.exam);
  ok(oldManual.exam.stage==='finished'&&oldManual.exam.finalRanking.zhuangyuan==='甲','imperial ranking remains supported');
  ok(oldManual.calls.costs.includes('dianshi'),'imperial route still settles its own cost');

  for (const flag of ['failAI','shortAnswer','duplicate']) {
    const failed=fixture(national,{[flag]:true});failed.exam.stage='huishi';
    await failed.c._finalizeStageAndAdvance(failed.exam);
    ok(failed.exam.stage==='huishi'&&!failed.exam._nationalResultsReady,'invalid '+flag+' keeps the exam open for retry');
    ok(!failed.calls.costs.includes('huishi')&&!failed.c.GM.chars.length,'invalid '+flag+' grants no fees/people/office effects');
  }
  const offline=fixture(national);offline.exam.stage='huishi';offline.c.P.ai.key='';
  await offline.c._finalizeStageAndAdvance(offline.exam);
  ok(offline.exam.stage==='huishi'&&!offline.exam._nationalResultsReady,'offline result is not falsely declared complete');
  const later=fixture(national,{agency:true,historical:{name:'未生者',isHistorical:true,birthYear:900,deathYear:970}});later.exam.stage='huishi';
  await later.c.generateHuishiResults();
  ok(later.exam.stage==='huishi'&&!later.exam._nationalResultsReady,'meta-stage historical candidates also pass through the current-year guard');
  const living=fixture(national,{agency:true,historical:{name:'当世举子',isHistorical:true,birthYear:810,deathYear:870}});living.exam.stage='huishi';
  await living.c.generateHuishiResults();
  ok(living.exam.stage==='finished'&&living.exam.huishiPassed[0].age===30,'eligible historical candidate age comes from the current year');
  living.c.finishKeju();
  ok(living.c.GM.chars[0].birthYear===810&&living.c.GM.chars[0].deathYear===870,'national basic recruitment preserves dates for the shared ingress guard');
  await living.c._aiGenerateFullCharacter({name:'当世举子乙',age:30,isHistorical:true,birthYear:810,deathYear:870},'erjia');
  ok(living.c.GM.chars.some(c=>c.name==='当世举子乙'&&c.birthYear===810&&c.deathYear===870),'complete character generation also preserves verified dates');
  console.log('PASS smoke-keju-terminal-exam-flow: '+assertions+' assertions');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
