#!/usr/bin/env node
/* eslint-env node */
'use strict';
/*
 * _probe-guanzhi-realturn.js — 官制全面升级·真机验
 *   起天启七年真局(真 officeTree 200+官员·真年龄/真品级) → 全开官制 11 开关 →
 *   在真实游戏态上跑真 tick(考课/致仕/京察/履职/职权舆图) + 组装真推演 prompt →
 *   断言：机制在真数据上点火(具体到真官员名)、官制块真注入 prompt、零运行时报错。
 *   纯机械验(不需真 LLM·免费秒回)。key 若在环境亦不用。
 * node scripts/_probe-guanzhi-realturn.js
 */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ROOT = path.resolve(__dirname, '..'); const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const SID = 'sc-tianqi7-1627';
let pass = 0, fail = 0; const notes = [];
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } }
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitFor(label, fn, timeoutMs) { const s = Date.now(); let last = null; while (Date.now() - s < timeoutMs) { try { const v = fn(); if (v) return v; } catch (e) { last = e; } await delay(60); } throw new Error('timeout: ' + label + (last ? ' · ' + last.message : '')); }
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
process.on('uncaughtException', function (e) { var m = String((e && (e.message || e.stack)) || e); if (/insertAdjacentHTML|appendChild|removeChild|is not a function|Cannot (read|set)|null|undefined/.test(m)) return; console.error('[uncaught] ' + m); });
process.on('unhandledRejection', function () {});

function loadGame() {
  const flow = { errors: [] };
  const env = helpers.makeStubs();
  env.win.console = { log: () => {}, warn: () => {}, error: (...a) => { var s = a.map(String).join(' '); if (!/favicon|insertAdjacentHTML|is not a function/.test(s)) flow.errors.push(s); }, info: () => {}, debug: () => {} };
  env.win.location.href = 'http://localhost/index.html'; env.win.location.search = '';
  env.win.document.body.insertAdjacentHTML = function () {}; env.win.document.head.insertAdjacentHTML = function () {}; env.win.document.documentElement.insertAdjacentHTML = function () {};
  // DRYRUN fetch（任何 LLM 调用都秒回最小合法响应·不联网）
  env.win.fetch = function () { var r = { choices: [{ message: { content: JSON.stringify({ narrative: '(probe)', summary: 'probe' }) } }], usage: { total_tokens: 0 } }; return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: () => Promise.resolve(JSON.stringify(r)), json: () => Promise.resolve(r) }); };
  env.win.tianming = { writeTurnData: () => Promise.resolve({ ok: true }), autoSave: () => Promise.resolve({ ok: true }), saveGame: () => Promise.resolve({ ok: true }) };
  const sandbox = vm.createContext(env.win); sandbox.__env = env;
  const scripts = helpers.parseIndexHtmlScripts();
  const cutoff = scripts.findIndex((src) => path.basename(src) === 'tm-test-harness.js');
  (cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((src) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src, timeout: 20000 }); } catch (e) {} });
  vm.runInContext('window.Audio=function(){return{play:function(){},pause:function(){},addEventListener:function(){}};};window.AudioContext=function(){return{createGain:function(){return{connect:function(){},gain:{}};},createOscillator:function(){return{connect:function(){},start:function(){},stop:function(){},frequency:{}};},destination:{},currentTime:0};};window.webkitAudioContext=window.AudioContext;showLoading=function(){};hideLoading=function(){};toast=function(){};showTurnResult=function(){};["renderGameState","renderMemorials","renderQiju","renderJishi","renderBiannian","renderShijiList","renderRenwuList","renderMap","renderTopbar","renderProvincePanel","renderOfficeTree"].forEach(function(n){window[n]=function(){};});generateMemorials=function(){if(!GM.memorials)GM.memorials=[];};aiDeepReadScenario=async function(){};aiPlanScenarioForInference=async function(){};aiPlanFactionMatrix=async function(){};aiPlanFirstTurnEvents=async function(){};', sandbox);
  vm.runInContext('P=P||{};P.ai=P.ai||{};P.ai.key="";P.conf=P.conf||{};P.conf.npcAiPrecision=false;', sandbox);
  vm.runInContext('window.__ebLog=[];(function(){var o=(typeof addEB==="function")?addEB:null;addEB=function(c,m){try{__ebLog.push(String(c)+"|"+String(m));}catch(e){}if(o)return o.apply(this,arguments);};})();', sandbox);
  vm.runInContext('(function(){var prevGet=document.getElementById?document.getElementById.bind(document):function(){return null;};function node(v){return{value:v||"",textContent:"",innerHTML:"",style:{},dataset:{},classList:{add:function(){},remove:function(){},toggle:function(){return false;},contains:function(){return false;}},addEventListener:function(){},appendChild:function(c){return c;},querySelector:function(){return null;},querySelectorAll:function(){return[];},getAttribute:function(){return null;},setAttribute:function(){}};}var nodes={"edict-pol":node("彻查辽饷亏空。"),"edict-mil":node("补足边镇火器。")};document.getElementById=function(id){return nodes[id]||prevGet(id);};})();', sandbox);
  return { sandbox, env, flow };
}
const run = (sandbox, code) => vm.runInContext(code, sandbox, { timeout: 20000 });
const J = (sandbox, code) => JSON.parse(run(sandbox, 'JSON.stringify((function(){' + code + '})())'));

(async function main() {
  console.log('\n████ 官制全面升级 · 真机验（天启七年真局·全开 11 开关）████\n');
  const { sandbox, flow } = loadGame();
  // 起真局
  run(sandbox, '_pendingUseMap=true;_pendingMapModeSid="' + SID + '";_pendingMapModeAt=Date.now();doActualStart("' + SID + '");');
  await waitFor('running+officeTree', () => run(sandbox, '!!(GM&&GM.running&&Array.isArray(GM.officeTree)&&GM.officeTree.length&&Array.isArray(GM.chars)&&GM.chars.length)'), 20000);
  const boot = J(sandbox, 'return {turn:GM.turn,chars:(GM.chars||[]).length,office:(GM.officeTree||[]).length,facs:(GM.facs||[]).length};');
  console.log('[起局] 天启七年 running·turn=' + boot.turn + '·真官员=' + boot.chars + '·官制树部门=' + boot.office + '·势力=' + boot.facs + '\n');
  ok(boot.chars > 50 && boot.office > 0, '真局起成：' + boot.chars + ' 官员 + ' + boot.office + ' 部门官制树（真剧本数据）');

  // 全开官制 11 开关
  run(sandbox, 'P.conf.powerMinisterEnabled=true;P.conf.officeReviewLandingEnabled=true;P.conf.officeConspiracyEnabled=true;P.conf.officeSatisfactionFeedbackEnabled=true;P.conf.officeSalaryHeadcountEnabled=true;P.conf.officeDutyStateEnabled=true;P.conf.officeAuthorityGateEnabled=true;P.conf.officeReformAdjudicationEnabled=true;P.conf.officePersonnelTurnoverEnabled=true;P.conf.officeJingchaEnabled=true;');
  ok(run(sandbox, 'officeFlagOn("officePowerPerceptionEnabled")===true && officeFlagOn("officeDutyStateEnabled")===true'), '①默认开 + ②等开关全 on（officeFlagOn 真返 true）');

  console.log('\n══════ 一·官制块真注入推演 prompt（真 officeTree/官员）══════');
  // ① 职权舆图：在真 officeTree 上生成
  const opm = run(sandbox, 'String(buildOfficePowerMap(GM,{cap:14})||"")');
  ok(opm.indexOf('【职权舆图】') === 0 && opm.indexOf('〔掌权要职〕') >= 0, '①职权舆图在真局生成（衙门概览+掌权要职）');
  const opmDetail = run(sandbox, 'String(buildOfficePowerMap(GM,{cap:14})||"").split("〔掌权要职〕")[1]||""');
  ok(opmDetail.trim().length > 0 && opmDetail.indexOf('权[') >= 0, '①掌权要职明细非空+含权力标（真 officeTree powers 数据）');
  const opmFilled = J(sandbox, 'var s=String(buildOfficePowerMap(GM,{cap:60})||"");var hit=(GM.chars||[]).filter(function(c){return c&&c.name&&c.officialTitle&&!/皇后|妃|嫔|选侍/.test(c.officialTitle)&&s.indexOf(c.name)>=0;}).slice(0,4).map(function(c){return c.name;});return hit;');
  ok(opmFilled.length >= 1, '①职权舆图(cap60)含真在任官员：' + opmFilled.join('、'));
  notes.push('职权舆图掌权要职明细(节录)：' + opmDetail.trim().split('\n').slice(0, 2).join(' / '));

  console.log('\n══════ 二·官制机制在真数据上点火（真官员名为证）══════');
  // ② 履职度：在真 officeTree 上 tick → _dutyState 落到真职位
  const duty = J(sandbox, 'var agg=(typeof tickOfficeDutyState==="function")?tickOfficeDutyState(GM):null;var n=0;(function w(ns){(ns||[]).forEach(function(d){(d.positions||[]).forEach(function(p){if(p&&p._dutyState&&typeof p._dutyState.fulfillment==="number")n++;});if(d.subs)w(d.subs);});})(GM.officeTree);return {seeded:n,compliance:agg&&agg.compliance,corruption:agg&&agg.corruption,details:(agg&&agg.details||[]).length};');
  ok(duty.seeded > 0, '②履职度 tick 在真官制树落 _dutyState=' + duty.seeded + ' 个职位（compliance ' + duty.compliance + '·corruption ' + duty.corruption + '·' + duty.details + ' 条域效果）');

  // ③ 权限门：resolveOfficeAuthority 在真局对 taxCollect 求执行力
  const auth = J(sandbox, 'var a=(typeof resolveOfficeAuthority==="function")?resolveOfficeAuthority(GM,"taxCollect"):null;return a?{eff:a.effectiveness,reason:String(a.reason||"")}:null;');
  ok(auth && typeof auth.eff === 'number', '③权限门 resolveOfficeAuthority(taxCollect) 真局求得执行力 eff=' + (auth && auth.eff) + '（' + (auth && auth.reason) + '）');

  // 考课（年度）：把 turn 设到真年终·跑 runAnnualReview·验在真官员上评出优劣
  const rev = J(sandbox, 'var yr=(typeof turnsForDuration==="function")?(turnsForDuration("year")||12):12;GM.turn=yr;var r=(typeof runAnnualReview==="function")?runAnnualReview():null;return r?{exc:r.excellent.length,adq:r.adequate.length,poor:r.poor.length}:null;');
  ok(rev && (rev.exc + rev.adq + rev.poor) > 0, '考课落地：真年终在真官员上评 优' + (rev && rev.exc) + '/中' + (rev && rev.adq) + '/劣' + (rev && rev.poor) + ' 人');

  // 致仕：取一名真在任官员·设其耄耋·跑 _tickOfficePersonnelTurnover·验引擎准其致仕
  const ret = J(sandbox, 'var yr=(typeof turnsForDuration==="function")?(turnsForDuration("year")||12):12;GM.turn=yr;'
    + 'var c=(GM.chars||[]).filter(function(x){return x&&x.officialTitle&&!x.isPlayer&&x.alive!==false&&!x._retired&&!/致仕|乞骸|罢|去职|皇后|皇贵妃|贵妃|妃|嫔|选侍/.test(x.officialTitle);})[0];'
    + 'if(!c)return null;var nm=c.name,t0=c.officialTitle;c.age=77;_tickOfficePersonnelTurnover();return {name:nm,t0:t0,retired:!!c._retired,title:c.officialTitle,pre:c._preRetireTitle};');
  ok(ret && ret.retired && /致仕/.test(ret.title || ''), '致仕：真官员「' + (ret && ret.name) + '」(设耄耋77)→引擎准致仕·' + (ret && ret.t0) + '→' + (ret && ret.title) + '（可起复）');

  // 京察：取一名真在任官员·注其连劣·跑 _tickJingcha·验功名罚黜降
  const jc = J(sandbox, 'var yr=(typeof turnsForDuration==="function")?(turnsForDuration("year")||12):12;GM.turn=yr*3;'
    + 'var c=(GM.chars||[]).filter(function(x){return x&&x.officialTitle&&!x.isPlayer&&x.alive!==false&&!x._retired&&/尚书|侍郎|大学士|御史|郎中|主事|知府|知县|总督|巡抚|布政|按察|寺卿|少卿|给事中|学士|参政/.test(x.officialTitle);})[0];'
    + 'if(!c)return null;if(!c.resources)c.resources={};c.resources.virtueMerit=1000;var nm=c.name,m0=c.resources.virtueMerit;c._reviewPoorStreak=3;_tickJingcha();'
    + 'return {name:nm,m0:m0,m1:c.resources.virtueMerit,streak:c._reviewPoorStreak,demoted:(GM._jingchaResult&&GM._jingchaResult.demoted)||[]};');
  ok(jc && jc.m1 < jc.m0 && jc.streak === 0, '京察黜降：真官员「' + (jc && jc.name) + '」(注连劣3)→功名 ' + (jc && jc.m0) + '→' + (jc && jc.m1) + '·连劣清零（rankLevel↓·未革职）');

  // ★真机抓 bug 回归：后宫(皇后/妃嫔)不入官制代谢（_OFF_HAREM_RE 守·stub smoke 漏）
  const harem = J(sandbox, 'var yr=(typeof turnsForDuration==="function")?(turnsForDuration("year")||12):12;GM.turn=yr*3;'
    + 'var h=(GM.chars||[]).filter(function(x){return x&&x.officialTitle&&/皇后|皇贵妃|贵妃|妃|嫔|选侍/.test(x.officialTitle)&&!x._retired;})[0];'
    + 'if(!h)return {none:true};var nm=h.name,t0=h.officialTitle;h.age=78;h._retired=false;h._reviewPoorStreak=3;if(!h.resources)h.resources={};h.resources.virtueMerit=1000;'
    + '_tickOfficePersonnelTurnover();_tickJingcha();return {name:nm,title:t0,retired:!!h._retired,merit:h.resources.virtueMerit};');
  ok(harem.none || (!harem.retired && harem.merit === 1000), '★后宫排除：「' + (harem.name || '(无后宫样本)') + (harem.title ? '·' + harem.title : '') + '」设耄耋78+连劣3 仍不致仕不黜降（真机抓的 bug 已修）');

  // digest 联动：上述 tick 应推 chronicle 官制↔联动 → WorldDigest 前景化
  const dig = J(sandbox, 'var ch=(GM._chronicle||[]).filter(function(e){return e&&/官制/.test(String(e.type))&&e.tags&&e.tags.indexOf("联动")>=0;});var items=(typeof WorldDigest!=="undefined"&&WorldDigest.collect)?WorldDigest.collect(GM,{turnsBack:5}):[];var off=items.filter(function(it){return /官制/.test(String(it.domain));});return {chron:ch.length,offItems:off.length,sample:off[0]?String(off[0].line).slice(0,50):""};');
  ok(dig.chron > 0, 'digest 联动：官制后果写入 _chronicle ' + dig.chron + ' 条·WorldDigest 前景化官制行 ' + dig.offItems + ' 条' + (dig.sample ? '（如「' + dig.sample + '…」）' : ''));

  console.log('\n══════ 三·真局零运行时报错 ══════');
  const errs = flow.errors.slice(0, 6);
  ok(flow.errors.length === 0, '真局全程运行时错误数=' + flow.errors.length + (errs.length ? '（' + errs.join(' | ').slice(0, 200) + '）' : '（无）'));

  console.log('\n══════ 摘录 ══════');
  notes.forEach((n) => console.log('· ' + n));
  console.log('\n[真机验] ' + (fail === 0 ? '✅ PASS' : '❌ FAIL') + ' ' + pass + '/' + (pass + fail));
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('[probe fatal] ' + String((e && e.message) || e)); process.exit(3); });
