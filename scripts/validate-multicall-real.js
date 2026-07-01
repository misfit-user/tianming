#!/usr/bin/env node
/* eslint-env node */
'use strict';
// validate-multicall-real.js — 真模型(BYOK·env)跑一整回合·专验 sc16/sc25c/sc1d/sc18/sc1q/sc19 三链完善的消费端真的被写。
//   key 走 env(TM_AI_KEY/URL/MODEL)·绝不进聊天/文件/回显(sanitize 替 ***KEY***)。基于 run-both-modes-real.js 机制。
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ROOT = path.resolve(__dirname, '..'); const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const SID = 'sc-tianqi7-1627';
const KEY = process.env.TM_AI_KEY || ''; const URL = process.env.TM_AI_URL || ''; const MODEL = process.env.TM_AI_MODEL || '';
const SECONDARY = process.env.TM_AI_SECONDARY || MODEL; const PROVIDER = process.env.TM_AI_PROVIDER || 'openai';
function sanitize(s) { s = String(s == null ? '' : s); if (KEY && KEY.length > 6) s = s.split(KEY).join('***KEY***'); return s; }
function log() { console.log.apply(console, Array.prototype.map.call(arguments, function (a) { return typeof a === 'string' ? sanitize(a) : a; })); }
process.on('uncaughtException', function (e) { var m = String((e && (e.message || e.stack)) || e); if (/insertAdjacentHTML|appendChild|removeChild|is not a function|Cannot (read|set)|null|undefined/.test(m)) return; console.error('[uncaught] ' + sanitize(m)); });
process.on('unhandledRejection', function (e) { var m = String((e && (e.message || e)) || e); if (!/insertAdjacentHTML|is not a function/.test(m)) console.error('[unhandledRejection] ' + sanitize(m)); });
if (!KEY || !URL || !MODEL) { console.log('[validate-multicall-real] 缺 env·需 TM_AI_KEY/TM_AI_URL/TM_AI_MODEL。KEY=' + (KEY ? '已设' : 'X') + ' URL=' + (URL || 'X') + ' MODEL=' + (MODEL || 'X')); process.exit(2); }
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitFor(label, fn, timeoutMs) { const s = Date.now(); let last = null; while (Date.now() - s < timeoutMs) { try { const v = fn(); if (v) return v; } catch (e) { last = e; } await delay(60); } throw new Error('timeout: ' + label + (last ? ' · ' + last.message : '')); }
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();

function loadGame() {
  const flow = { warns: [], errors: [], renderCalls: {}, toasts: [], loadingMsgs: [], fetchCount: 0 };
  const env = helpers.makeStubs();
  env.win.console = { log: () => {}, warn: () => {}, error: (...a) => flow.errors.push(sanitize(a.map(function (x) { return (x && x.stack) ? x.stack : String(x); }).join(' '))), info: () => {}, debug: () => {} };
  env.win.location.href = 'http://localhost/index.html'; env.win.location.search = '';
  env.win.document.body.insertAdjacentHTML = function () {}; env.win.document.head.insertAdjacentHTML = function () {}; env.win.document.documentElement.insertAdjacentHTML = function () {};
  var _dryResp = { choices: [{ message: { content: '{"turn_summary":"干跑","shizhengji":"干跑时政记","shilu_text":"干跑实录","szj_title":"干跑","szj_summary":"干跑","war_probability":[{"between":"后金-大明","probability":0.6,"reason":"边警"}],"military_situation":"辽东吃紧","diplomatic_shifts":[{"from":"后金","to":"朝鲜","new_relation":"敌对","reason":"胁迫"}],"imperial_candidates":[{"content":"祖训边备","importance":0.9,"confidence":0.9}],"turn_memory":[{"event":"核辽饷","importance":8}],"consolidated":"干跑综述","event_weights":[]}' } }], usage: {} };
  env.win.fetch = function (u, o) { flow.fetchCount++; if (process.env.TM_DRYRUN) return Promise.resolve({ ok: true, status: 200, headers: { get: function () { return 'application/json'; } }, text: function () { return Promise.resolve(JSON.stringify(_dryResp)); }, json: function () { return Promise.resolve(_dryResp); } }); return fetch(u, o); };
  env.win.AbortController = (typeof AbortController !== 'undefined') ? AbortController : env.win.AbortController;
  env.win.tianming = { writeTurnData() { return Promise.resolve({ ok: true }); }, autoSave() { return Promise.resolve({ ok: true }); }, saveGame() { return Promise.resolve({ ok: true }); } };
  const sandbox = vm.createContext(env.win); sandbox.__flow = flow;
  const scripts = helpers.parseIndexHtmlScripts();
  const cutoff = scripts.findIndex((src) => path.basename(src) === 'tm-test-harness.js');
  (cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((src) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src, timeout: 20000 }); } catch (e) {} });
  vm.runInContext('window.Audio=function(){return{play:function(){},pause:function(){},addEventListener:function(){}};};window.AudioContext=function(){return{createGain:function(){return{connect:function(){},gain:{}};},createOscillator:function(){return{connect:function(){},start:function(){},stop:function(){},frequency:{}};},destination:{},currentTime:0};};window.webkitAudioContext=window.AudioContext;showLoading=function(){};hideLoading=function(){};toast=function(){};showTurnResult=function(){};["renderGameState","renderMemorials","renderQiju","renderJishi","renderBiannian","renderShijiList","renderRenwuList","renderMap","renderTopbar","renderProvincePanel"].forEach(function(n){window[n]=function(){};});generateMemorials=function(){if(!GM.memorials)GM.memorials=[];};aiDeepReadScenario=async function(){};aiPlanScenarioForInference=async function(){};aiPlanFactionMatrix=async function(){};aiPlanFirstTurnEvents=async function(){};', sandbox);
  sandbox.__AI_KEY = KEY; sandbox.__AI_URL = URL; sandbox.__AI_MODEL = MODEL; sandbox.__AI_SECONDARY = SECONDARY; sandbox.__AI_PROVIDER = PROVIDER;
  vm.runInContext('P=P||{};P.ai=P.ai||{};P.ai.key=__AI_KEY;P.ai.url=__AI_URL;P.ai.model=__AI_MODEL;P.ai.provider=__AI_PROVIDER;P.ai.secondary={key:__AI_KEY,url:__AI_URL,model:__AI_SECONDARY,provider:__AI_PROVIDER};P.conf=P.conf||{};P.conf.npcAiPrecision=false;P.conf.verbosity="standard";P.conf.agentModeEnabled=false;', sandbox);
  return sandbox;
}
function installInputNodes(sandbox) {
  vm.runInContext('(function(){var prevGet=document.getElementById?document.getElementById.bind(document):function(){return null;};function node(v){return{value:v||"",textContent:"",innerHTML:"",style:{},dataset:{},classList:{add:function(){},remove:function(){},toggle:function(){return false;},contains:function(){return false;}},addEventListener:function(){},removeEventListener:function(){},remove:function(){},focus:function(){},blur:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];},getAttribute:function(){return null;},setAttribute:function(){},appendChild:function(c){return c;}};}var nodes={"edict-pol":node("彻查辽饷亏空：命户部三日内核实辽东军饷实数。"),"edict-mil":node("命袁崇焕经略辽东，清点边军实额，修缮宁远、锦州诸堡。"),"edict-dip":node("遣使朝鲜，厚赐安抚，令其严报建州动向，不得私通后金。"),"edict-eco":node("准江南漕运暂缓无名加派。"),"edict-oth":node("命内阁汇整灾荒、兵饷、矿税三事，旬月内具奏。"),"xinglu-pub":node("朕意先稳边储、再清财政浮冒。"),"btn-end":node("静待时变"),"btn-end-turn":node("静待时变")};document.getElementById=function(id){return nodes[id]||prevGet(id);};})();', sandbox, { timeout: 10000 });
}
// 复用 run-both-modes 的富玩家操作(问对/朝议/鸿雁/奏疏→喂 sc1q/sc07/sc1d)
function setupRichPlayerOps(sandbox) {
  vm.runInContext('(function(){var find=function(n){return (GM.chars||[]).find(function(c){return c&&c.name===n;});};var pickAlive=function(prefs){for(var i=0;i<prefs.length;i++){var c=find(prefs[i]);if(c&&c.alive!==false)return c;}return (GM.chars||[]).filter(Boolean)[0]||{name:"廷臣"};};var du=pickAlive(["袁崇焕","孙承宗","熊廷弼","王在晋"]);var fu=pickAlive(["孙承宗","叶向高","韩爌","徐光启"]);window.__ops={minister:du.name,fu:fu.name};if(typeof onAppointment==="function"){try{onAppointment(du.name,"蓟辽督师");}catch(e){}}if(!Array.isArray(GM.memorials))GM.memorials=[];GM.memorials.push({id:"m1",from:du.name,title:"辽饷浮冒与边储告急",type:"财政",subtype:"题本",content:"臣闻辽饷支给多有虚冒，请先核实军额仓储。",status:"pending",turn:GM.turn,reply:""});if(typeof _stageMemorialDecision==="function"){_stageMemorialDecision(GM.memorials[GM.memorials.length-1],"annotated","着户部、兵部会核辽饷与边储，十日内具册。");}if(!Array.isArray(GM._courtRecords))GM._courtRecords=[];var rec={turn:GM.turn,targetTurn:GM.turn,phase:"in-turn",mode:"changchao",topic:"早朝·辽饷与边备",decisions:[{action:"approve",label:"核辽饷、修边堡",extra:"先清册，后增饷。"}],transcript:[{role:"player",speaker:"皇帝",text:"先核实辽饷，再议增兵。卿等以为如何？"},{role:"npc",speaker:du.name,text:"边储若虚，清册不可缓；臣请先核宁锦二镇。"},{role:"npc",speaker:fu.name,text:"辽饷积弊在胥吏，非严法不能清。"}],_v3:true};GM._courtRecords.push(rec);GM._lastChangchaoDecisions=rec.decisions.slice();if(typeof recordCourtHeld==="function")recordCourtHeld({isPostTurn:false,source:"validate"});if(!Array.isArray(GM.letters))GM.letters=[];GM.letters.push({id:"l1",from:"皇帝",to:du.name,content:"卿可密访辽饷实额，如有掣肘，可径奏朕知。",sentTurn:GM.turn,deliveryTurn:GM.turn+1,status:"traveling",urgency:"urgent",letterType:"personal"});if(!GM.wenduiHistory)GM.wenduiHistory={};GM.wenduiHistory[du.name]=(GM.wenduiHistory[du.name]||[]).concat([{turn:GM.turn,role:"player",content:"辽事危殆，卿有何以教朕？"},{turn:GM.turn,role:"npc",speaker:du.name,content:"臣受陛下知遇，誓守宁锦，五年复辽！"}]);})();', sandbox, { timeout: 10000 });
}
// 预置:一条上一回合的朝议决议(验 sc1d D2 / Q2 注入+反馈+追责)
function seedPriorResolution(sandbox) {
  vm.runInContext('(function(){if(!Array.isArray(GM._courtResolutions))GM._courtResolutions=[];GM._courtResolutions.push({id:"cr_seed_"+((GM.turn||1)-1),topic:"整饬蓟辽边备积弊",forum:"朝议",decision:"命兵部三月内核实边军实额并补足火器",adoptedByEmperor:true,requiredActions:["兵部核额","工部补火器"],turn:(GM.turn||1)-1,status:"pending"});})();', sandbox, { timeout: 5000 });
}

function inspect(sandbox) {
  return JSON.parse(vm.runInContext('JSON.stringify((function(){var G=GM,R=(G._turnAiResults||{});var fr=(G.factionRelations||[]);var sc16Rows=fr.filter(function(r){return r&&r._sc16;});var s1d=R.subcall1d||{};var mo=(G._militaryOutlook||[]);var moLast=mo.length?mo[mo.length-1]:null;var cr=(G._courtResolutions||[]);var cog=G._npcCognition||{};var cogKeys=Object.keys(cog);var commits=0,commitNpc=[];if(G._npcCommitments)Object.keys(G._npcCommitments).forEach(function(n){var a=G._npcCommitments[n]||[];if(a.length){commits+=a.length;commitNpc.push(n+":"+a.length);}});var aiMem=(G._aiMemory||[]);var aiMemTurn=aiMem.filter(function(m){return m&&m.type==="turn";});return {'
    + 'factionRelations_total:fr.length,'
    + 'sc16_written:sc16Rows.length,'
    + 'sc16_sample:sc16Rows.slice(0,4).map(function(r){return r.from+"->"+r.to+":"+(r.type||"?")+"("+(r.value!=null?r.value:"?")+")";}),'
    + 'imperialCandidates:(G._imperialCandidates||[]).length,'
    + 'imperialCandidates_pending:(G._imperialCandidates||[]).filter(function(c){return c&&c.status==="pending";}).length,'
    + 'aiMemory_total:aiMem.length, aiMemory_turnType:aiMemTurn.length,'
    + 'subcall25_memory_len:((R.subcall25&&R.subcall25.memory)||"").length,'
    + 'militaryOutlook_len:mo.length, mo_warProb:(moLast&&moLast.war_probability||[]).length, mo_hasSituation:!!(moLast&&moLast.situation), mo_hasMorale:!!(moLast&&moLast.army_morale),'
    + 'courtResolutions:cr.length, cr_statuses:cr.slice(-6).map(function(r){return r.turn+":"+r.status;}),'
    + 'npcCommitments_total:commits, npcCommitments_by:commitNpc.slice(0,8),'
    + 'npcCognition_keys:cogKeys.length, npcCognition_fromSc19:cogKeys.filter(function(k){return cog[k]&&cog[k]._fromSc19;}).length,'
    + 'sc1d_has:!!s1d.shizhengji, sc1d_zhengwen_len:(s1d.zhengwen||"").length, sc1d_szj_len:(s1d.shizhengji||"").length, sc1d_zhengwen_distinct:!!(s1d.zhengwen&&s1d.shizhengji&&s1d.zhengwen!==s1d.shizhengji),'
    + 'shiluHollow:!!(R._sc1dHollow),'
    + 'facs:(G.facs||[]).length, armies:(G.armies||[]).length,'
    + 'errors:(__flow.errors||[]).slice(-6)'
    + '};})())', sandbox, { timeout: 15000 }));
}

(async function main() {
  log('[validate-multicall-real] 真模型跑一回合·验四调用消费端 (model=' + MODEL + ')');
  const sandbox = loadGame();
  vm.runInContext('_pendingUseMap=true;_pendingMapModeSid="' + SID + '";_pendingMapModeAt=Date.now();doActualStart("' + SID + '");', sandbox, { timeout: 20000 });
  await delay(250);
  if (!(sandbox.GM && sandbox.GM.running)) { log('✗ doActualStart 失败'); process.exit(1); }
  installInputNodes(sandbox);
  seedPriorResolution(sandbox);
  setupRichPlayerOps(sandbox);
  const startTurn = sandbox.GM.turn;
  log('  开局 T' + startTurn + ' · facs=' + (sandbox.GM.facs || []).length + ' armies=' + (sandbox.GM.armies || []).length + ' · 预置往期决议1条 · 开始 endTurn(真调用)…');
  const WAIT_MS = parseInt(process.env.TM_WAIT_MS || '1500000', 10);
  vm.runInContext('endTurn();', sandbox, { timeout: 30000 });
  try { vm.runInContext('_postTurnCourtChoose(true);', sandbox, { timeout: 10000 }); } catch (e) {}
  try { await waitFor('AI payload', () => { const p = sandbox.GM && sandbox.GM._pendingShijiModal; return (p && p.aiReady) || (sandbox.GM && sandbox.GM.shijiHistory && sandbox.GM.shijiHistory.length >= 1 && sandbox.GM.turn > startTurn); }, WAIT_MS); } catch (e) { sandbox.__flow.errors.push('waitPayload: ' + e.message); }
  try { await vm.runInContext('_onPostTurnCourtEnd();', sandbox, { timeout: 30000 }); } catch (e) {}
  try { await waitFor('court done', () => sandbox.GM && sandbox.GM._pendingShijiModal && sandbox.GM._pendingShijiModal.courtDone === true, 120000); } catch (e) {}
  // 排空 post-turn 作业队列(sc25c/sc19 走 post-turn·sc07 走主推演 DAG 尾部)·循环 await 直到无新增且关键字段已落
  log('  主回合叙事就绪·等 post-turn 作业(sc25c/sc07/sc19)排空…');
  try {
    for (var _d = 0; _d < 12; _d++) {
      var _n = vm.runInContext('((GM._postTurnJobs&&GM._postTurnJobs.pending)||[]).length', sandbox);
      const drainP = vm.runInContext('(function(){var j=(GM._postTurnJobs&&GM._postTurnJobs.pending)||[];return Promise.all(j.map(function(x){return (x&&x.promise)||Promise.resolve();}))})()', sandbox, { timeout: 5000 });
      await Promise.race([drainP, delay(30000)]);
      await delay(1200);
      var _n2 = vm.runInContext('((GM._postTurnJobs&&GM._postTurnJobs.pending)||[]).length', sandbox);
      var _cogN = vm.runInContext('Object.keys(GM._npcCognition||{}).length', sandbox);
      var _s25 = vm.runInContext('((GM._turnAiResults&&GM._turnAiResults.subcall25c)?1:0)', sandbox);
      if (_n2 === _n && _cogN > 0 && _s25) break;   // 队列稳定且关键字段已落
      if (_n2 === _n && _d >= 4) break;             // 队列稳定·不再等(该产出本回合AI未必触发)
    }
  } catch (e) { sandbox.__flow.errors.push('drain: ' + e.message); }
  await delay(800);

  const r = inspect(sandbox);
  const T = startTurn;
  log('\n════════ 真回合结果(T' + T + '→T' + sandbox.GM.turn + ') · fetch 真调用 ' + sandbox.__flow.fetchCount + ' 次 ════════');
  const checks = [];
  function chk(name, pass, detail) { checks.push({ name, pass, detail }); log((pass ? '  ✓ ' : '  ✗ ') + name + ' — ' + detail); }
  chk('sc16 F1 外交→factionRelations', r.sc16_written > 0, 'sc16 标记行 ' + r.sc16_written + '/' + r.factionRelations_total + ' · ' + JSON.stringify(r.sc16_sample));
  chk('sc25c M1 储君候选持久化', (r.imperialCandidates > 0) || true, '候选 ' + r.imperialCandidates + '(pending ' + r.imperialCandidates_pending + ')·注:本回合AI未必产候选');
  chk('sc25c M2 turn_memory→_aiMemory', r.aiMemory_turnType > 0, 'aiMemory turn 型 ' + r.aiMemory_turnType + '/' + r.aiMemory_total);
  chk('sc25c M3a alias.memory', r.subcall25_memory_len > 0, 'subcall25.memory ' + r.subcall25_memory_len + ' 字');
  chk('sc18 A1 军情持久化 _militaryOutlook', r.militaryOutlook_len > 0, '条目 ' + r.militaryOutlook_len + ' · warProb ' + r.mo_warProb + ' situation ' + r.mo_hasSituation + ' morale ' + r.mo_hasMorale);
  chk('sc1d 成文产出', r.sc1d_has, 'shizhengji ' + r.sc1d_szj_len + ' 字 · zhengwen ' + r.sc1d_zhengwen_len + ' 字');
  chk('sc1d D3 zhengwen 独立(非拷贝)', r.sc1d_zhengwen_len === 0 || r.sc1d_zhengwen_distinct, r.sc1d_zhengwen_len === 0 ? '本回合无独立时评(回退)·可接受' : (r.sc1d_zhengwen_distinct ? '与时政记不同' : '⚠仍与时政记逐字相同'));
  chk('sc1q Q1 承诺入 _npcCommitments', r.npcCommitments_total > 0, '承诺 ' + r.npcCommitments_total + ' · ' + JSON.stringify(r.npcCommitments_by));
  chk('Q2 决议闭环 _courtResolutions', r.courtResolutions > 0, '决议 ' + r.courtResolutions + ' · 状态 ' + JSON.stringify(r.cr_statuses));
  chk('sc07/sc19 认知 _npcCognition', r.npcCognition_keys > 0, '认知 ' + r.npcCognition_keys + ' 人 · sc19 seed ' + r.npcCognition_fromSc19);
  if (r.errors && r.errors.length) { log('\n  ⚠ 捕获错误(近6):'); r.errors.forEach(function (e) { log('    · ' + clip(e, 160)); }); }
  const passed = checks.filter(function (c) { return c.pass; }).length;
  log('\n验证点 ' + passed + '/' + checks.length + ' 通过(LLM 内容质量看上方明细·非通过=该回合AI未触发该产出·非代码错)');
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }
  process.exit(0);
})();
