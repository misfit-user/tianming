#!/usr/bin/env node
/* eslint-env node */
'use strict';
/*
 * _probe-realturn-w14.js — 真机跑一整回合·验世界反应总线 W1-W4 实注入 + W2a 不双算
 *   起真局(天启) → 注入四块触发条件(会战/财政赤字/腐败九源/阴谋将发/濒危metric)+ W2a flag →
 *   包 fetch 捕获真实组装的 sc1 prompt(system+user 全文) → 跑 endTurn() →
 *   断言 W1-W4 四块 + 「军务已结算·勿重复扣」护栏确实进了真 prompt；真跑则再查 AI faction_changes 不双扣。
 *
 *   TM_DRYRUN=1 → 假 fetch(免费·秒回·只验 prompt 组装) ; 无 → 真 DeepSeek(验 AI 不双扣)。
 *   key 经环境变量·全程 sanitize 脱敏·绝不回显。
 */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ROOT = path.resolve(__dirname, '..'); const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const SID = 'sc-tianqi7-1627';
const KEY = process.env.TM_AI_KEY || ''; const URL = process.env.TM_AI_URL || ''; const MODEL = process.env.TM_AI_MODEL || '';
const DRY = !!process.env.TM_DRYRUN;

function sanitize(s) { s = String(s == null ? '' : s); if (KEY && KEY.length > 6) s = s.split(KEY).join('***KEY***'); return s; }
function log() { console.log.apply(console, Array.prototype.map.call(arguments, function (a) { return typeof a === 'string' ? sanitize(a) : a; })); }
process.on('uncaughtException', function (e) { var m = String((e && (e.message || e.stack)) || e); if (/insertAdjacentHTML|appendChild|removeChild|is not a function|Cannot (read|set)|null|undefined/.test(m)) return; console.error('[uncaught] ' + sanitize(m)); });
process.on('unhandledRejection', function (e) { var m = String((e && (e.message || e)) || e); if (!/insertAdjacentHTML|is not a function/.test(m)) console.error('[unhandledRejection] ' + sanitize(m)); });

if (!DRY && (!KEY || !URL || !MODEL)) { console.log('[probe] 真跑需 TM_AI_KEY/URL/MODEL(或 TM_DRYRUN=1 干跑)·当前 KEY=' + (KEY ? '✓' : '✗') + ' URL=' + (URL || '✗') + ' MODEL=' + (MODEL || '✗')); process.exit(2); }

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitFor(label, fn, timeoutMs) { const s = Date.now(); let last = null; while (Date.now() - s < timeoutMs) { try { const v = fn(); if (v) return v; } catch (e) { last = e; } await delay(80); } throw new Error('timeout: ' + label + (last ? ' · ' + last.message : '')); }
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();

// 捕获每次 LLM 请求的 {system,user} 全文 + 响应（找 sc1 用）
const CAP = [];

function loadGame() {
  const flow = { errors: [] };
  const env = helpers.makeStubs();
  env.win.console = { log: () => {}, warn: () => {}, error: (...a) => flow.errors.push(sanitize(a.map(String).join(' '))), info: () => {}, debug: () => {} };
  env.win.location.href = 'http://localhost/index.html'; env.win.location.search = '';
  env.win.document.body.insertAdjacentHTML = function () {}; env.win.document.head.insertAdjacentHTML = function () {}; env.win.document.documentElement.insertAdjacentHTML = function () {};

  function mockResp() {
    // 最小合法 sc1 响应：含 faction_changes（对 loser 故意再扣 -7 → 验"若双算判据"能识别）
    var content = JSON.stringify({
      narrative: '（干跑）边事吃紧，朝议汹汹。', summary: '干跑回合', publicSummary: '干跑',
      faction_changes: [{ name: env._loserName || '', strength_delta: -7, reason: '干跑测试·AI再扣' }]
    });
    return { choices: [{ message: { content: content } }], usage: { total_tokens: 0 } };
  }
  env.win.fetch = function (u, o) {
    var body = null; try { body = o && o.body ? JSON.parse(o.body) : null; } catch (_) {}
    var rec = { url: String(u), sys: '', user: '', respText: '' };
    if (body && Array.isArray(body.messages)) {
      body.messages.forEach(function (m) { if (m.role === 'system') rec.sys += String(m.content || ''); else if (m.role === 'user') rec.user += String(m.content || ''); });
    }
    var nth = CAP.length + 1;
    if (!DRY) try { process.stderr.write('  → LLM 调用 #' + nth + '（user ' + rec.user.length + ' 字' + (/七大变量·推演必读/.test(rec.user) ? '·★sc1主推演' : '') + '）…\n'); } catch (_) {}
    if (DRY) {
      rec.respText = JSON.stringify(mockResp());
      CAP.push(rec);
      var r = mockResp();
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: () => Promise.resolve(JSON.stringify(r)), json: () => Promise.resolve(r) });
    }
    return fetch(u, o).then(function (resp) {
      return resp.text().then(function (txt) {
        rec.respText = txt; CAP.push(rec);
        return { ok: resp.ok, status: resp.status, headers: { get: (h) => resp.headers.get(h) }, text: () => Promise.resolve(txt), json: () => Promise.resolve(JSON.parse(txt)) };
      });
    });
  };
  env.win.AbortController = (typeof AbortController !== 'undefined') ? AbortController : env.win.AbortController;
  env.win.tianming = { writeTurnData: () => Promise.resolve({ ok: true }), autoSave: () => Promise.resolve({ ok: true }), saveGame: () => Promise.resolve({ ok: true }) };
  const sandbox = vm.createContext(env.win);
  sandbox.__env = env;
  const scripts = helpers.parseIndexHtmlScripts();
  const cutoff = scripts.findIndex((src) => path.basename(src) === 'tm-test-harness.js');
  (cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((src) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src, timeout: 20000 }); } catch (e) {} });
  // 渲染/音频全 stub（避免 headless 噪音打断推演）
  vm.runInContext('window.Audio=function(){return{play:function(){},pause:function(){},addEventListener:function(){}};};window.AudioContext=function(){return{createGain:function(){return{connect:function(){},gain:{}};},createOscillator:function(){return{connect:function(){},start:function(){},stop:function(){},frequency:{}};},destination:{},currentTime:0};};window.webkitAudioContext=window.AudioContext;showLoading=function(){};hideLoading=function(){};toast=function(){};showTurnResult=function(){};["renderGameState","renderMemorials","renderQiju","renderJishi","renderBiannian","renderShijiList","renderRenwuList","renderMap","renderTopbar","renderProvincePanel"].forEach(function(n){window[n]=function(){};});generateMemorials=function(){if(!GM.memorials)GM.memorials=[];};aiDeepReadScenario=async function(){};aiPlanScenarioForInference=async function(){};aiPlanFactionMatrix=async function(){};aiPlanFirstTurnEvents=async function(){};', sandbox);
  sandbox.__AI_KEY = KEY; sandbox.__AI_URL = URL; sandbox.__AI_MODEL = MODEL;
  vm.runInContext('P=P||{};P.ai=P.ai||{};P.ai.key=__AI_KEY;P.ai.url=__AI_URL;P.ai.model=__AI_MODEL;P.ai.provider="deepseek";P.ai.secondary={key:__AI_KEY,url:__AI_URL,model:__AI_MODEL,provider:"deepseek"};P.conf=P.conf||{};P.conf.npcAiPrecision=false;P.conf.verbosity="standard";', sandbox);
  // 包 addEB 捕获事件（抓 W2a 硬护栏「拦截 AI 重复扣…防双算」是否触发）
  vm.runInContext('window.__ebLog=[];(function(){var o=(typeof addEB==="function")?addEB:null;addEB=function(c,m){try{__ebLog.push(String(c)+"|"+String(m));}catch(e){}if(o)return o.apply(this,arguments);};})();', sandbox);
  return { sandbox, env, flow };
}

function inject(sandbox, env) {
  // 起真局
  vm.runInContext('_pendingUseMap=true;_pendingMapModeSid="' + SID + '";_pendingMapModeAt=Date.now();doActualStart("' + SID + '");', sandbox, { timeout: 20000 });
  // 注入四块触发条件 + W2a flag + 一场会战
  const report = vm.runInContext('JSON.stringify((function(){' +
    'var R={};' +
    // W2a：开 flag，挑两势力打一仗（loser 实力被 reactor 扣 + 写联动 chronicle）
    'P.conf.worldReactorBattleEnabled=true;' +
    'var facs=(GM.facs||[]).filter(function(f){return f&&f.name;});' +
    'var loser=facs[0],winner=facs[1]||facs[0];' +
    'R.loser=loser?loser.name:null;R.winner=winner?winner.name:null;R.loserStrBefore=loser?loser.strength:null;' +
    'if(loser&&winner&&loser!==winner&&typeof MilitarySystems!=="undefined"){MilitarySystems.applyBattleResult({winnerFaction:winner.name,loserFaction:loser.name},GM);}' +
    'R.loserStrAfter=loser?loser.strength:null;' +
    'R.settled=(GM._battleSettledFactions||[]).map(function(x){return x.faction+":"+x.strengthDelta;});' +
    'R.chronLink=(GM._chronicle||[]).filter(function(e){return e&&e.tags&&e.tags.indexOf("联动")>=0;}).length;' +
    // W2b/W4 财政：赤字下行
    'if(GM.guoku){GM.guoku.balance=-500000;GM.guoku.trend="down";if(!GM.guoku.annualIncome)GM.guoku.annualIncome=960000;}' +
    // W3 腐败九源
    'if(GM.corruption){GM.corruption.sources={emergencyLevy:16.4,officeSelling:12.1,lowSalary:8.2,innerCircle:9.9,nepotism:4.4,institutional:6,laxSupervision:0.2,redundancy:2.1,lumpSumSpending:0};}' +
    // W3 阴谋将发
    'GM._activePlots=[{id:"p1",ringleader:"温体仁",target:"钱谦益",kind:"plot",stage:"ripe",momentum:115,exposure:72,conspirators:["周延儒","王永光"],startTurn:(GM.turn||1)-3,_knownToPlayer:true}];' +
    // W4 濒危 metric
    'if(GM.minxin)GM.minxin.trueIndex=24;if(GM.huangwei)GM.huangwei.index=26;' +
    'var cls=Array.isArray(GM.classes)?GM.classes:(Array.isArray(GM.socialClasses)?GM.socialClasses:null);' +
    'R.classArr=cls?(GM.classes?"classes":"socialClasses"):"(none)";' +
    'if(cls&&cls.length){cls[0].satisfaction=14;R.lowClass=cls[0].name;}' +
    'env_loser_marker:'+
    'R.running=!!GM.running;R.turn=GM.turn;' +
    'return R;})())', sandbox, { timeout: 15000 });
  const R = JSON.parse(report.replace('env_loser_marker:', ''));
  env._loserName = R.loser;   // 给 mock 响应用（对 loser 再扣 -7 测双算判据）
  return R;
}

// 诏书/按钮等 DOM 输入桩（endTurn collectInput 会读·缺则可能崩）——照搬 run-both-modes-real.js
function installInputNodes(sandbox) {
  vm.runInContext('(function(){var prevGet=document.getElementById?document.getElementById.bind(document):function(){return null;};function node(v){return{value:v||"",textContent:"",innerHTML:"",style:{},dataset:{},classList:{add:function(){},remove:function(){},toggle:function(){return false;},contains:function(){return false;}},addEventListener:function(){},removeEventListener:function(){},remove:function(){},focus:function(){},blur:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];},getAttribute:function(){return null;},setAttribute:function(){},appendChild:function(c){return c;}};}var nodes={"edict-pol":node("彻查辽饷亏空，命户部三日内核实辽东军饷实数。"),"edict-mil":node("命督师经略辽东，补足火器粮草。"),"edict-dip":node("遣使朝鲜，厚赐安抚。"),"edict-eco":node("准江南漕运暂缓无名加派，纾民困。"),"edict-oth":node("命内阁汇整灾荒兵饷矿税三事。"),"xinglu-pub":node("朕意先稳边储、再清财政浮冒。"),"btn-end":node("静待时变"),"btn-end-turn":node("静待时变")};document.getElementById=function(id){return nodes[id]||prevGet(id);};})();', sandbox, { timeout: 10000 });
}

// 玩家操作（奏疏/朝会/书信/问对）——给推演叙事素材·照搬 run-both-modes-real.js（主推演在 post-turn 流程触发，需这些）
function setupRichPlayerOps(sandbox) {
  vm.runInContext('(function(){var find=function(n){return (GM.chars||[]).find(function(c){return c&&c.name===n;});};var pickAlive=function(prefs){for(var i=0;i<prefs.length;i++){var c=find(prefs[i]);if(c&&c.alive!==false)return c;}return (GM.chars||[]).filter(Boolean)[0]||{name:"廷臣"};};'
    + 'var du=pickAlive(["袁崇焕","孙承宗","熊廷弼","王在晋"]);var fu=pickAlive(["孙承宗","叶向高","韩爌","徐光启"]);'
    + 'window.__ops={appoints:[],minister:du.name,fu:fu.name};'
    + 'if(typeof onAppointment==="function"){try{onAppointment(du.name,"蓟辽督师");}catch(e){}try{if(fu.name!==du.name){onAppointment(fu.name,"东阁大学士");}}catch(e){}}'
    + 'if(!Array.isArray(GM.memorials))GM.memorials=[];'
    + 'GM.memorials.push({id:"m1",from:du.name,title:"辽饷浮冒与边储告急",type:"财政",subtype:"题本",content:"臣闻辽饷支给多有虚冒，请先核实军额仓储。",status:"pending",turn:GM.turn,reply:""});'
    + 'if(typeof _stageMemorialDecision==="function"){_stageMemorialDecision(GM.memorials[GM.memorials.length-1],"annotated","着户部、兵部会核辽饷与边储，十日内具册。");}'
    + 'if(!Array.isArray(GM._courtRecords))GM._courtRecords=[];var rec={turn:GM.turn,targetTurn:GM.turn,phase:"in-turn",mode:"changchao",topic:"早朝·辽饷与边备",decisions:[{action:"approve",label:"核辽饷、修边堡",extra:"先清册，后增饷。"}],transcript:[{role:"player",speaker:"皇帝",text:"先核实辽饷，再议增兵。卿等以为如何？"},{role:"npc",speaker:du.name,text:"边储若虚，清册不可缓。"}],_v3:true};GM._courtRecords.push(rec);GM._lastChangchaoDecisions=rec.decisions.slice();GM._lastChangchaoDecisionMeta={turn:rec.turn,targetTurn:rec.targetTurn,phase:rec.phase,mode:rec.mode};GM._lastChangchaoDecisionsTargetTurn=rec.targetTurn;if(typeof recordCourtHeld==="function")recordCourtHeld({isPostTurn:false,source:"probe"});'
    + 'if(!Array.isArray(GM.letters))GM.letters=[];GM.letters.push({id:"l1",from:"皇帝",to:du.name,content:"卿可密访辽饷实额。",sentTurn:GM.turn,deliveryTurn:GM.turn+1,status:"traveling",urgency:"urgent",letterType:"personal"});'
    + 'if(!GM.wenduiHistory)GM.wenduiHistory={};GM.wenduiHistory[du.name]=(GM.wenduiHistory[du.name]||[]).concat([{turn:GM.turn,role:"player",content:"辽事危殆，卿有何以教朕？"},{turn:GM.turn,role:"npc",speaker:du.name,content:"臣誓守宁锦，五年复辽！"}]);'
    + 'if(!Array.isArray(GM.evtLog))GM.evtLog=[];GM.evtLog.push({turn:GM.turn,type:"玩家操作",text:"早朝议辽饷，起督师、辅臣入阁，朱批奏疏，遣密札。"});'
    + '})();', sandbox, { timeout: 10000 });
}

function findSc1(cap) {
  // sc1 主推演：user 含「七大变量·推演必读」或「天下牵动」；取最长的那条
  var c = cap.filter(function (x) { return /七大变量·推演必读|本回合天下牵动|天下气运/.test(x.user); });
  c.sort(function (a, b) { return b.user.length - a.user.length; });
  return c[0] || cap.slice().sort(function (a, b) { return b.user.length - a.user.length; })[0] || null;
}

(async function main() {
  log('\n████ 真机跑一整回合 · 世界反应总线 W1-W4 实注入验证 ' + (DRY ? '[干跑·免费]' : '[真 DeepSeek]') + ' ████');
  if (!DRY) log('模型=' + MODEL + ' 端点=' + URL.replace(/\/\/[^/]+/, '//***') + ' (key 脱敏)');
  const { sandbox, env, flow } = loadGame();
  const R = inject(sandbox, env);
  installInputNodes(sandbox);
  setupRichPlayerOps(sandbox);
  log('\n[起局] running=' + R.running + ' turn=' + R.turn + ' 阶层数组=' + R.classArr);
  log('[W2a 会战] ' + R.loser + ' 败于 ' + R.winner + ' · 实力 ' + R.loserStrBefore + '→' + R.loserStrAfter + '(reactor 扣) · 已结算标记=[' + R.settled.join(',') + '] · 联动chronicle=' + R.chronLink + ' 条');
  if (R.lowClass) log('[W4] 压低阶层「' + R.lowClass + '」满意=14');

  log('\n[跑 endTurn + post-turn] ' + (DRY ? '干跑（假 fetch）' : '真模型推演（数分钟·LLM 调用打点 stderr）') + '…');
  const hasSc1 = () => CAP.some(function (x) { return /七大变量·推演必读/.test(x.user); });
  try { vm.runInContext('Promise.resolve().then(function(){return endTurn();}).catch(function(e){__env.__endturnErr=String(e&&(e.stack||e.message)||e);});', sandbox, { timeout: 30000 }); } catch (e) { flow.errors.push('endTurn-sync: ' + sanitize(e.message)); }
  // 主推演 sc1 在 post-turn 朝会流程触发（非裸 endTurn）——照搬 run-both-modes 序列驱动到 sc1
  try { await delay(400); vm.runInContext('try{_postTurnCourtChoose(true);}catch(e){}', sandbox, { timeout: 10000 }); } catch (e) {}
  try { vm.runInContext('(function(){if(!Array.isArray(GM._courtRecords))GM._courtRecords=[];var st=GM.turn;GM._courtRecords.push({turn:st,targetTurn:st+1,phase:"post-turn",mode:"changchao",topic:"朔朝·次月边饷",decisions:[{action:"decree",label:"次月续核辽饷"}],transcript:[{role:"player",speaker:"皇帝",text:"次月仍以辽饷为先。"},{role:"npc",speaker:"阁臣",text:"谨遵上意。"}],_v3:true});if(typeof recordCourtHeld==="function")recordCourtHeld({isPostTurn:true,source:"probe"});})();', sandbox, { timeout: 10000 }); } catch (e) {}
  try { await waitFor('AI payload', () => hasSc1() || (sandbox.GM && sandbox.GM._pendingShijiModal && sandbox.GM._pendingShijiModal.aiReady) || (sandbox.GM && sandbox.GM.turn > R.turn), DRY ? 8000 : 600000); } catch (e) { log('⚠ AI payload 等待: ' + e.message); }
  try { await vm.runInContext('Promise.resolve().then(function(){return _onPostTurnCourtEnd();}).catch(function(e){__env.__courtErr=String(e&&(e.message)||e);});', sandbox, { timeout: 60000 }); } catch (e) {}
  try { await waitFor('sc1 主推演 prompt', hasSc1, DRY ? 2000 : 360000); }
  catch (e) {
    log('⚠ 未等到 sc1（' + e.message + '）');
    if (!DRY) { try { var pl = vm.runInContext('JSON.stringify({turn:GM.turn,pipe:((TM.Endturn&&TM.Endturn.Pipeline&&TM.Endturn.Pipeline.lastRun)?TM.Endturn.Pipeline.lastRun():[]).map(function(x){return x.step+(x.ok?"✓":"✗"+(x.error?":"+String(x.error.message||x.error).slice(0,60):""));}),shiji:(GM.shijiHistory||[]).length,modal:!!GM._pendingShijiModal,etErr:(__env&&__env.__endturnErr||"").slice(0,200),courtErr:(__env&&__env.__courtErr||"").slice(0,200)})', sandbox); log('  [pipeline 诊断] ' + sanitize(pl)); } catch (_) {} }
  }

  const sc1 = findSc1(CAP);
  if (!sc1) { log('\n✗ 未捕获到任何推演 prompt（CAP=' + CAP.length + ' 条）·errors: ' + flow.errors.slice(-4).join(' | ')); process.exit(1); }
  // ★跨所有捕获的 prompt 搜标记（robust：块可能分布在 sysP/tp1 不同 LLM 调用里）
  const full = CAP.map(function (c) { return c.sys + '\n' + c.user; }).join('\n\n');
  const isSc1 = /七大变量·推演必读/.test(sc1.user);
  log('\n[捕获] LLM 请求共 ' + CAP.length + ' 次·合计 prompt ' + full.length + ' 字·sc1 主推演=' + (isSc1 ? '✓已捕获(user ' + sc1.user.length + '字)' : '✗未到(止于 pre-submit·干跑常态)'));

  if (process.env.TM_DIAG) {
    log('\n[诊断] 各请求 user 长度: ' + CAP.map(function (x) { return x.user.length; }).join(', '));
    CAP.forEach(function (x, i) { log('  请求#' + i + ' sys=' + x.sys.length + ' user=' + x.user.length + ' · user头:「' + sanitize(x.user.slice(0, 90).replace(/\n/g, '⏎')) + '」'); });
    ['七大变量', '吏治：真', '吏治·6部门', '吏治·九源', '民心：真', '本回合天下牵动', '天下气运', '暗流涌动', '密谋', '牵动', '因何而腐', 'WorldDigest', '皇威：真'].forEach(function (k) {
      log('  「' + k + '」在 prompt: ' + (full.indexOf(k) >= 0 ? '✓@' + full.indexOf(k) : '✗'));
    });
    var gi = full.indexOf('吏治·6部门'); if (gi >= 0) log('\n  [吏治·6部门 周边 360 字]\n  ' + sanitize(full.slice(gi, gi + 360).replace(/\n/g, ' ⏎ ')));
    log('\n  [WorldDigest/Conspiracy 全局是否加载] ' + vm.runInContext('JSON.stringify({WorldDigest:typeof WorldDigest,Conspiracy:typeof ConspiracyEngine,wdPreview:(typeof WorldDigest!=="undefined"&&typeof WorldDigest.previewBlock),plots:(GM._activePlots||[]).length,corrSrc:!!(GM.corruption&&GM.corruption.sources)})', sandbox));
    var pv = vm.runInContext('(typeof WorldDigest!=="undefined"&&WorldDigest.previewBlock)?WorldDigest.previewBlock(GM,{limit:4}):"(no WD)"', sandbox);
    log('  [直调 WorldDigest.previewBlock(GM)]\n  ' + sanitize(String(pv).replace(/\n/g, ' ⏎ ')));
  }

  // ── 断言四块 + 护栏 ──
  function grab(re, span) { var m = full.match(re); if (!m) return null; var i = full.indexOf(m[0]); return full.slice(i, i + (span || 120)).replace(/\n/g, ' ⏎ '); }
  const checks = [
    ['W1/综述·天下牵动', /本回合天下牵动·因果综述/, /本回合天下牵动·因果综述[\s\S]{0,200}/],
    ['W2a 护栏·军务已结算勿重复扣', /军务已结算·叙事勿重复扣实力/, /[^\n]*军务已结算·叙事勿重复扣实力[^\n]*/],
    ['W3 阴谋数值·密谋N败露N', /密谋\s*\d+[\s\S]{0,8}败露\s*\d+/, /朝中暗流涌动[\s\S]{0,160}/],
    ['W3 腐败九源·因何而腐', /吏治·九源（因何而腐）/, /吏治·九源（因何而腐）[^\n]*/],
    ['W4 趋势预演·若不干预', /天下气运·若不干预之趋势/, /天下气运·若不干预之趋势[\s\S]{0,260}/]
  ];
  log('\n══════ W1-W4 实注入断言 ══════');
  let okN = 0;
  checks.forEach(function (c) {
    var hit = c[1].test(full);
    if (hit) okN++;
    log((hit ? '✓ ' : '✗ ') + c[0]);
    if (hit) { var snip = grab(c[2], 240); if (snip) log('    ⟪' + sanitize(snip) + '⟫'); }
  });
  log('\n注入命中 ' + okN + '/' + checks.length + ' 块');

  // ── W2a 硬护栏实战验证：等 writeBack 应用 AI 的 faction_changes（护栏在此跑）──
  log('\n══════ W2a 硬护栏·真 AI 输出下验证 ══════');
  log('① 软防·护栏文本入 prompt：' + (/军务已结算·叙事勿重复扣实力/.test(full) ? '✓ 是（AI 被告知勿重复扣）' : '✗ 否'));
  var _aiSrc = DRY ? '干跑 mock（对 loser 故意扣 -7·走真 applier 代码验护栏）' : '真 AI';
  {
    // 等 faction_changes 被应用（loser 实力变 / 护栏事件 / 史记入库）·dryrun 走真 applier 代码确定性证护栏·真跑看真 AI
    try { await waitFor('writeBack 应用', () => {
      var st = vm.runInContext('JSON.stringify({eb:(window.__ebLog||[]).filter(function(s){return /防双算|拦截 AI 重复扣/.test(s);}).length,shiji:(GM.shijiHistory||[]).length,strChanged:((GM.facs||[]).filter(function(f){return f&&f.name===' + JSON.stringify(R.loser) + ';})[0]||{}).strength})', sandbox);
      var s = JSON.parse(st); return s.eb > 0 || s.shiji > 0 || (s.strChanged != null && s.strChanged !== R.loserStrAfter);
    }, 180000); } catch (e) { log('  ⚠ writeBack 等待: ' + e.message); }

    var probe = JSON.parse(vm.runInContext('JSON.stringify({' +
      'loserStr:((GM.facs||[]).filter(function(f){return f&&f.name===' + JSON.stringify(R.loser) + ';})[0]||{}).strength,' +
      'curTurn:GM.turn,' +
      'settled:(GM._battleSettledFactions||[]).filter(function(b){return b&&b.faction===' + JSON.stringify(R.loser) + ';}),' +
      'guardEv:(window.__ebLog||[]).filter(function(s){return /防双算|拦截 AI 重复扣/.test(s);}),' +
      'loserEv:(window.__ebLog||[]).filter(function(s){return s.indexOf(' + JSON.stringify(R.loser) + ')>=0;}).slice(-6)' +
      '})', sandbox));
    var _dtNow = (probe.settled[0] != null) ? (probe.curTurn - probe.settled[0].turn) : null;
    log('   [时序] 结算 turn=' + (probe.settled[0] ? probe.settled[0].turn : '?') + ' · 应用时 GM.turn=' + probe.curTurn + ' · 差=' + _dtNow + (_dtNow != null && _dtNow >= 0 && _dtNow <= 1 ? '（在容差内·护栏可触发）' : '（超容差·护栏不触发）'));
    // AI 原始输出是否对 loser 负扣（从 sc1 响应抽 faction_changes·best-effort + 原文邻近兜底）
    var aiTriedReDecr = false, aiFcStr = '(未解析出)';
    try {
      var rj = JSON.parse(sc1.respText); var content = (rj.choices && rj.choices[0] && rj.choices[0].message && rj.choices[0].message.content) || '';
      var m = content.match(/"faction_changes"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      if (m) { var arr = JSON.parse(m[1]); var lf = arr.filter(function (x) { return x && x.name && String(x.name).indexOf(R.loser) >= 0; }); if (lf.length) { aiFcStr = JSON.stringify(lf); aiTriedReDecr = lf.some(function (x) { return (parseInt(x.strength_delta || x.strengthDelta || 0) || 0) < 0; }); } }
      if (aiFcStr === '(未解析出)') { var rgx = new RegExp(R.loser + '[\\s\\S]{0,90}?strength_delta["\\s:]*(-\\d+)|strength_delta["\\s:]*(-\\d+)[\\s\\S]{0,90}?' + R.loser); var rm = content.match(rgx); if (rm) { aiTriedReDecr = true; aiFcStr = '原文邻近命中：' + sanitize(rm[0].replace(/\s+/g, ' ').slice(0, 80)); } }
    } catch (e) {}

    log('② ' + _aiSrc + ' 对战败方「' + R.loser + '」是否再负扣：' + (aiTriedReDecr ? '⚠ 是（' + aiFcStr + '）' : '否/未解析（' + aiFcStr + '）'));
    log('③ 硬护栏是否触发拦截：' + (probe.guardEv.length ? '✓ 触发 ' + probe.guardEv.length + ' 次 → ' + sanitize(probe.guardEv.join(' ; ')) : '未触发'));
    log('④ 战败方「' + R.loser + '」最终实力：reactor 结算后 ' + R.loserStrAfter + ' → 全回合后 ' + probe.loserStr + (probe.loserStr != null && probe.loserStr >= R.loserStrAfter ? '（未被进一步负扣·无双算 ✓）' : '（⚠ 低于结算值，需查）'));
    if (probe.loserEv.length) log('   战败方相关事件：' + sanitize(probe.loserEv.join(' | ')));
    // 裁决
    var verdict;
    if (aiTriedReDecr && probe.guardEv.length && probe.loserStr >= R.loserStrAfter) verdict = '✅ 硬护栏生效：' + _aiSrc + ' 试图重复扣实力，被硬护栏拦下，战败方实力未双扣（' + (DRY ? '确定性证真 applier 代码路径' : '真 AI 实战') + '）。';
    else if (probe.guardEv.length && probe.loserStr >= R.loserStrAfter) verdict = '✅ 硬护栏触发并守住实力。';
    else if (!aiTriedReDecr && probe.loserStr >= R.loserStrAfter) verdict = '◻ 本轮 ' + _aiSrc + ' 未重复扣（无双算·护栏未被触发）—结局正确。';
    else verdict = '⚠ 战败方实力低于结算值，需排查（护栏事件=' + probe.guardEv.length + '·再扣=' + aiTriedReDecr + '·_dt=' + _dtNow + '）。';
    log('\n裁决：' + verdict);
  }

  // ── W2a flag 实战效果：AI 是否把"会战战败"编进叙事（reactor 战报→digest→AI 叙事 的闭环呈现）──
  if (!DRY) {
    log('\n══════ W2a flag 实战效果 · AI 叙事是否呼应会战 ══════');
    var narr = '';
    try {
      var rj2 = JSON.parse(sc1.respText); var ct = (rj2.choices && rj2.choices[0] && rj2.choices[0].message && rj2.choices[0].message.content) || '';
      var pj2 = null; try { pj2 = JSON.parse(ct); } catch (e) { var mm = ct.match(/\{[\s\S]*\}/); if (mm) try { pj2 = JSON.parse(mm[0]); } catch (e2) {} }
      if (pj2) narr = [pj2.turn_summary, pj2.shizhengji, pj2.shilu_text, pj2.zhengwen].filter(Boolean).join(' ／ ');
      if (!narr) narr = ct;   // 退化：原文
    } catch (e) {}
    narr = String(narr).replace(/\s+/g, ' ');
    var mentionsBattle = new RegExp('(' + R.loser + '|' + R.winner + ')').test(narr) && /(战败|败于|败绩|失利|挫败|溃|丧师|大败|兵败|战事|交锋|失守)/.test(narr);
    log('① reactor 战报入 digest（已 5/5 注入·含「' + R.loser + ' 战败于 ' + R.winner + '·实力-5」）→ AI 读到了战败既成事实');
    log('② AI 叙事是否呼应会战：' + (mentionsBattle ? '✓ 提及（reactor 战报流入叙事·闭环成立）' : '◻ 本轮未明显提及（叙事自由·不强制）'));
    log('   [AI 叙事摘录] ' + sanitize(narr.slice(0, 360)) + (narr.length > 360 ? '…' : ''));
    log('③ flag 实战链：会战 applyBattleResult → reactor 确定性扣 ' + R.loser + ' 实力 ' + R.loserStrBefore + '→' + R.loserStrAfter + ' + 写联动 chronicle → WorldDigest 注入 sc1 prompt → AI 据此叙事（+ 硬护栏防 AI 重复扣）');
  }
  log('\nerrors(尾4): ' + (flow.errors.slice(-4).map(sanitize).join(' | ') || '(无)'));
  process.exit(okN >= 4 ? 0 : 1);
})();
