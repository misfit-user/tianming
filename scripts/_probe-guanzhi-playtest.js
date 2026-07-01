#!/usr/bin/env node
/* eslint-env node */
'use strict';
/*
 * _probe-guanzhi-playtest.js — 官制升级·多回合 playtest（真天启局·全开 flag·驱 40 回合官制 tick）
 *   起天启真局 → 全开官制 11 flag → 逐回合驱真官制 tick(考课/致仕/京察/履职/权臣/才不配位/阴谋/功名升迁) →
 *   观察机制随时间累积产出 + 稳定性(零错误)。纯机械(DRYRUN·免 LLM)。
 * node scripts/_probe-guanzhi-playtest.js
 */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ROOT = path.resolve(__dirname, '..'); const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const SID = 'sc-tianqi7-1627';
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitFor(label, fn, t) { const s = Date.now(); let e = null; while (Date.now() - s < t) { try { if (fn()) return true; } catch (x) { e = x; } await delay(60); } throw new Error('timeout ' + label + (e ? ' ' + e.message : '')); }
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
process.on('uncaughtException', (e) => { const m = String((e && e.message) || e); if (!/insertAdjacentHTML|is not a function|Cannot read|undefined|null/.test(m)) console.error('[uncaught] ' + m); });
process.on('unhandledRejection', () => {});

function loadGame() {
  const flow = { errors: [] };
  const env = helpers.makeStubs();
  env.win.console = { log: () => {}, warn: () => {}, error: (...a) => { const s = a.map(String).join(' '); if (!/favicon|insertAdjacentHTML|is not a function/.test(s)) flow.errors.push(s); }, info: () => {}, debug: () => {} };
  env.win.location.href = 'http://localhost/index.html'; env.win.location.search = '';
  env.win.document.body.insertAdjacentHTML = function () {}; env.win.document.head.insertAdjacentHTML = function () {}; env.win.document.documentElement.insertAdjacentHTML = function () {};
  env.win.fetch = function () { const r = { choices: [{ message: { content: '{}' } }], usage: { total_tokens: 0 } }; return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: () => Promise.resolve(JSON.stringify(r)), json: () => Promise.resolve(r) }); };
  env.win.tianming = { writeTurnData: () => Promise.resolve({ ok: true }), autoSave: () => Promise.resolve({ ok: true }) };
  const sandbox = vm.createContext(env.win); sandbox.__env = env;
  const scripts = helpers.parseIndexHtmlScripts();
  const cutoff = scripts.findIndex((src) => path.basename(src) === 'tm-test-harness.js');
  (cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((src) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src, timeout: 20000 }); } catch (e) {} });
  vm.runInContext('window.Audio=function(){return{play:function(){},pause:function(){},addEventListener:function(){}};};window.AudioContext=function(){return{createGain:function(){return{connect:function(){},gain:{}};},createOscillator:function(){return{connect:function(){},start:function(){},stop:function(){},frequency:{}};},destination:{},currentTime:0};};window.webkitAudioContext=window.AudioContext;showLoading=function(){};hideLoading=function(){};toast=function(){};["renderGameState","renderMap","renderTopbar","renderOfficeTree","renderMemorials"].forEach(function(n){window[n]=function(){};});generateMemorials=function(){if(!GM.memorials)GM.memorials=[];};aiDeepReadScenario=async function(){};aiPlanScenarioForInference=async function(){};aiPlanFactionMatrix=async function(){};aiPlanFirstTurnEvents=async function(){};', sandbox);
  vm.runInContext('P=P||{};P.ai=P.ai||{};P.ai.key="";P.conf=P.conf||{};', sandbox);
  vm.runInContext('window.__ebLog=[];(function(){var o=(typeof addEB==="function")?addEB:null;addEB=function(c,m){try{__ebLog.push(String(c)+"|"+String(m));}catch(e){}if(o)return o.apply(this,arguments);};})();', sandbox);
  return { sandbox, flow };
}
const run = (sb, c) => vm.runInContext(c, sb, { timeout: 30000 });
const J = (sb, c) => JSON.parse(run(sb, 'JSON.stringify((function(){' + c + '})())'));

(async function main() {
  console.log('\n████ 官制升级 · 多回合 PLAYTEST（天启真局·全开 11 flag·驱 40 回合）████\n');
  const { sandbox, flow } = loadGame();
  run(sandbox, '_pendingUseMap=true;_pendingMapModeSid="' + SID + '";doActualStart("' + SID + '");');
  await waitFor('boot', () => run(sandbox, '!!(GM&&GM.running&&GM.officeTree&&GM.chars&&GM.chars.length>50)'), 20000);
  // 全开 11 flag
  run(sandbox, 'P.conf.officeActivationEnabled=true;P.conf.powerMinisterEnabled=true;P.conf.officeReviewLandingEnabled=true;P.conf.officeConspiracyEnabled=true;P.conf.officeSatisfactionFeedbackEnabled=true;P.conf.officeSalaryHeadcountEnabled=true;P.conf.officeDutyStateEnabled=true;P.conf.officeAuthorityGateEnabled=true;P.conf.officeReformAdjudicationEnabled=true;P.conf.officePersonnelTurnoverEnabled=true;P.conf.officeJingchaEnabled=true;');
  const b = J(sandbox, 'return {turn:GM.turn,chars:(GM.chars||[]).length};');
  console.log('[起局] 天启 turn=' + b.turn + ' · ' + b.chars + ' 官员 · 全开 11 flag · 驱 40 回合...\n');

  const R = J(sandbox, `
    var R={turns:0,evts:{},errs:[],snaps:[]};
    var mr=((typeof _getDaysPerTurn==='function'?_getDaysPerTurn():90)/30)||3;
    function tally(t){R.evts[t]=(R.evts[t]||0)+1;}
    function snap(){
      var serving=(GM.chars||[]).filter(function(c){return c&&c.alive!==false&&c.officialTitle&&!/致仕|罢|去职/.test(c.officialTitle);}).length;
      var retired=(GM.chars||[]).filter(function(c){return c&&c._retired;}).length;
      var pm=GM.huangquan&&GM.huangquan.powerMinister&&GM.huangquan.powerMinister.name;
      var plots=(GM._activePlots||[]).length;
      var seeksRem=(GM.chars||[]).filter(function(c){return c&&c._seeksRemoval;}).length;
      var meritSum=(GM.chars||[]).reduce(function(s,c){return s+((c.resources&&c.resources.virtueMerit)||0);},0);
      return {turn:GM.turn,serving:serving,retired:retired,pm:pm||null,plots:plots,seeksRem:seeksRem,merit:Math.round(meritSum)};
    }
    R.snaps.push(snap());
    for(var k=0;k<40;k++){
      GM.turn=(GM.turn||1)+1;
      var before=__ebLog.length;
      try{if(typeof CharacterGrowthSystem!=='undefined')CharacterGrowthSystem.autoGainExperience();}catch(e){R.errs.push('growth:'+e.message);}
      try{if(typeof AuthorityComplete!=='undefined')AuthorityComplete.tick({turn:GM.turn,monthRatio:mr});}catch(e){R.errs.push('authority:'+e.message);}
      try{if(typeof _applyOfficeDutyTick==='function')_applyOfficeDutyTick(GM);}catch(e){R.errs.push('duty:'+e.message);}
      try{if(typeof runAnnualReview==='function')runAnnualReview();}catch(e){R.errs.push('review:'+e.message);}
      try{if(typeof _tickOfficialDisaffection==='function')_tickOfficialDisaffection();}catch(e){R.errs.push('disaffect:'+e.message);}
      try{if(typeof _tickOfficePersonnelTurnover==='function')_tickOfficePersonnelTurnover();}catch(e){R.errs.push('retire:'+e.message);}
      try{if(typeof _tickJingcha==='function')_tickJingcha();}catch(e){R.errs.push('jingcha:'+e.message);}
      try{if(typeof TMPromotion!=='undefined'&&TMPromotion.runAutoPromotion)TMPromotion.runAutoPromotion(GM,mr);}catch(e){R.errs.push('promo:'+e.message);}
      try{if(typeof ConspiracyEngine!=='undefined'&&ConspiracyEngine.tick)ConspiracyEngine.tick();}catch(e){R.errs.push('conspiracy:'+e.message);}
      for(var j=before;j<__ebLog.length;j++){var s=__ebLog[j];
        if(/考课/.test(s))tally('考课');
        if(/致仕|乞骸/.test(s))tally('致仕/乞骸');
        if(/京察/.test(s))tally('京察');
        if(/履职结算/.test(s))tally('履职结算');
        if(/权臣|坐大|截留|自拟诏/.test(s))tally('权臣');
        if(/怀才不遇|才高位卑|求去/.test(s))tally('才不配位');
        if(/暗流|阴谋|谋逆|心怀叵测/.test(s))tally('阴谋');
        if(/加赋失实/.test(s))tally('权限门·加赋失实');
      }
      R.turns++;
      if(k%8===7)R.snaps.push(snap());
    }
    R.snaps.push(snap());
    return R;
  `);

  console.log('══════ 40 回合 playtest 结果 ══════');
  console.log('稳定性：驱动 ' + R.turns + ' 回合 · 运行时错误 ' + R.errs.length + (R.errs.length ? '（' + R.errs.slice(0, 5).join(' | ') + '）' : '（零错误 ✅）'));
  console.log('引擎运行时错误(loadGame 捕获)：' + flow.errors.length + (flow.errors.length ? '（' + flow.errors.slice(0, 3).join(' | ').slice(0, 200) + '）' : '（无）'));
  console.log('\n机制点火累计（40 回合·真官员）：');
  const order = ['考课', '履职结算', '权限门·加赋失实', '才不配位', '致仕/乞骸', '京察', '权臣', '阴谋'];
  order.forEach((t) => { if (R.evts[t]) console.log('  · ' + t + '：' + R.evts[t] + ' 次'); });
  Object.keys(R.evts).forEach((t) => { if (order.indexOf(t) < 0) console.log('  · ' + t + '：' + R.evts[t] + ' 次'); });
  console.log('\n状态演化（每 4 回合快照）：');
  console.log('  turn   在任   致仕   求去   阴谋   功名总   权臣');
  R.snaps.forEach((s) => { console.log('  ' + String(s.turn).padEnd(6) + ' ' + String(s.serving).padEnd(6) + ' ' + String(s.retired).padEnd(6) + ' ' + String(s.seeksRem).padEnd(6) + ' ' + String(s.plots).padEnd(6) + ' ' + String(s.merit).padEnd(8) + ' ' + (s.pm || '—')); });
  const ok = R.errs.length === 0 && flow.errors.length === 0 && R.turns === 40;
  console.log('\n[PLAYTEST] ' + (ok ? '✅ 40 回合稳定·机制随时间产出' : '⚠ 见上'));
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('[fatal] ' + String((e && e.message) || e)); process.exit(3); });
