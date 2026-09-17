#!/usr/bin/env node
'use strict';
// smoke-tc-history-wave.js — 刀A2·修史族裸LLM口补时空约束·源码断言 + VM行为锁
//
// 两层：
//  (A) 源码断言：约束调用 / typeof守卫 / 一行注释 / full vs clauseOnly / 引用限定名 / 不适用口零注入。
//  (B) VM行为锁：在 vm 沙箱里载入【真实】_buildTemporalConstraint(从 tm-ai-infra.js 抽取·非手写sentinel)
//      + 真消费文件源码·stub 捕获 callAI/callAIMessages/callAISmart·跑到 prompt 组装处·断言
//      【捕获到的 prompt 真含约束标记】。真实约束标记：
//        SHARED='本局平行历史·唯一现实铁律'(full/clause 共有)·FULL='之后才发生的史实事件'(full专属)·
//        CLAUSE='非历史上的卒年'(clause专属)。
//      因载入真实定义并跑真源：把 _buildTemporalConstraint 改名(消费端typeof静默跳过)/删某口注入/
//      改消费端引用名·任一都会让「捕获prompt无标记」→ 行为断言变红。
//
// PASS = 退出码 0 且无行首 FAIL。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..');
const R = (n) => fs.readFileSync(path.join(WEB, n), 'utf8');

const SHARED = '本局平行历史·唯一现实铁律';
const FULL = '之后才发生的史实事件';
const CLAUSE = '非历史上的卒年';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL: ' + msg); } }
function count(hay, needle) { return hay.split(needle).length - 1; }
// 空白不敏感匹配：压缩所有空白后比对关键 token 序 → 等价改写(守卫/try 拆多行·缩进变化)不误红·删注入必红
function wsNorm(s) { return String(s).replace(/\s+/g, ''); }
function wsHas(hay, needle) { return wsNorm(hay).indexOf(wsNorm(needle)) !== -1; }
function wsCount(hay, needle) { const h = wsNorm(hay), n = wsNorm(needle); return n ? h.split(n).length - 1 : 0; }

const chronicle = R('tm-chronicle-system.js');
const core = R('tm-endturn-core.js');
const benji = R('tm-benji.js');
const depth = R('tm-endturn-agent-depth-tools.js');
const agent = R('tm-endturn-agent-mode.js');
const aira = (R('tm-ai-infra-retry.js') + '\n' + R('tm-ai-infra.js'));
// B5 真跑 run() 需新 run() 契约的硬前置依赖(kernel 预算/唯一提交器)·真加载入沙箱·否则 run() 于 :874 早退到不了 cawt
const agentKernel = R('tm-agent-kernel.js');
const agentIntentPlan = R('tm-endturn-agent-intent-plan.js');

// ══════════════════════════════════════════════════════════════
// 真实 _buildTemporalConstraint 抽取（含全部 _tc* 助手）
// ══════════════════════════════════════════════════════════════
function extractTcHelpers() {
  const s = aira.indexOf('function _buildTemporalConstraint(ch, opts) {');
  const e = aira.indexOf('/** 构建长期行动');
  if (s < 0 || e < 0 || e <= s) return null;
  return aira.slice(s, e);
}
const TC_SRC = extractTcHelpers();
// 真实定义抽取不到（如 _buildTemporalConstraint 被改名）→ 消费端 typeof 守卫将静默跳过·整刀失效·直接判红
if (TC_SRC === null) { console.log('FAIL: 真实 _buildTemporalConstraint 定义抽取失败(疑被改名/移动)·消费端将静默跳过约束'); process.exit(1); }

function baseSandbox(extra) {
  const sb = { console, Date, Math, JSON, Array, Object, String, Number, RegExp, isNaN, isFinite, parseInt, parseFloat, Promise, setTimeout, encodeURIComponent };
  sb.window = sb; sb.globalThis = sb; sb.root = sb; sb.global = sb; sb.self = sb;
  sb.getTSText = (t) => 'T' + t;
  sb.findCharByName = () => null;
  sb.GM = {
    turn: 7, year: 1627, _campaignId: 'tc-history-campaign', _timelineId: 'tml_tc_history_12345678',
    chars: [{ name: '张三', alive: true, officialTitle: '首辅', faction: '明' }, { name: '李四', alive: false, dead: true, deathTurn: 3 }]
  };
  sb.P = { time: { year: 1627, seasons: ['春', '夏', '秋', '冬'] }, playerInfo: { factionName: '明' }, conf: {} };
  if (extra) Object.keys(extra).forEach((k) => { sb[k] = extra[k]; });
  vm.createContext(sb);
  vm.runInContext(TC_SRC, sb, { filename: 'tc-helpers' });   // 真实约束定义入沙箱全局
  return sb;
}

// 沙箱自检：真实约束抽取正确、标记如约
(function harnessSelfCheck() {
  const sb = baseSandbox();
  ok(typeof sb._buildTemporalConstraint === 'function', '沙箱自检：真实 _buildTemporalConstraint 未载入');
  const full = sb._buildTemporalConstraint(null, {});
  const clause = sb._buildTemporalConstraint(null, { clauseOnly: true });
  ok(full.indexOf(SHARED) >= 0 && full.indexOf(FULL) >= 0 && full.indexOf(CLAUSE) < 0, '沙箱自检：full 标记异常');
  ok(clause.indexOf(SHARED) >= 0 && clause.indexOf(CLAUSE) >= 0 && clause.indexOf(FULL) < 0, '沙箱自检：clause 标记异常');
})();

function hasFull(s) { return s.indexOf(SHARED) >= 0 && s.indexOf(FULL) >= 0; }
function hasClause(s) { return s.indexOf(SHARED) >= 0 && s.indexOf(CLAUSE) >= 0; }

// ══════════════════════════════════════════════════════════════
// (A) 源码断言
// ══════════════════════════════════════════════════════════════
// 口1 chronicle full — 局部包裹整句(含 try/catch)连续验证·非全文件搜 try
ok(chronicle.indexOf('时空约束·年度编年正史修史·full') !== -1, '口1 缺注释');
ok(wsHas(chronicle, "if (typeof _buildTemporalConstraint === 'function') { try { prompt += '\\n' + _buildTemporalConstraint(null, {}); } catch (_) {} }"), '口1 缺 full 注入整句(守卫+try+catch+调用一体·空白不敏感)');
ok(chronicle.indexOf('clauseOnly') === -1, '口1 应 full·chronicle 不应现 clauseOnly');
// 口2 monthly full
ok(core.indexOf('时空约束·月度纪事修史·full') !== -1, '口2 缺注释');
ok(wsHas(core, "if (typeof _buildTemporalConstraint === 'function') { try { _mPrompt += '\\n' + _buildTemporalConstraint(null, {}); } catch (_) {} }"), '口2 缺 full 注入整句(空白不敏感)');
ok(core.indexOf('独立callAIMessages不继承主sysP') !== -1, '口2 未标裸口理由');
ok(count(core, '时空约束·') === 1, '口7 不适用核实：endturn-core 时空约束注释应恰1处(hist_check零注入)');
// 口3 benji clauseOnly (global.)
ok(benji.indexOf('时空约束·本纪终局修史·clauseOnly裁剪版') !== -1, '口3 缺注释');
ok(wsHas(benji, "if (typeof global._buildTemporalConstraint === 'function') { try { s += '\\n' + global._buildTemporalConstraint(null, { clauseOnly: true }); } catch (_) {} }"), '口3 缺 clauseOnly 注入整句(global.·空白不敏感)');
// 口4 xinshi + 口5 depth (root.)
ok(depth.indexOf('时空约束·史记四体') !== -1, '口4 缺注释');
ok(wsHas(depth, "_xinshi += '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });"), '口4 缺 _xinshi 追加(clauseOnly·空白不敏感)');
const depthSysComments = ['世界态势快照深析', '人物内心深析', '人物关系深析', '记忆/脉络固化', '人物书信深析', '御案朝务深析', '人物认知深析', '势力/外交深析', '财政经济深析', '军事边防深析'];
depthSysComments.forEach((c) => ok(depth.indexOf('时空约束·' + c) !== -1, '口5 缺注释: ' + c));
ok(wsCount(depth, "sys += '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });") === 10, '口5 十个深析 sys+=clauseOnly 应恰10处(空白不敏感)·实=' + wsCount(depth, "sys += '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });"));
ok(wsHas(depth, "_tcBeats = '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });"), '口5 缺 _tcBeats(clauseOnly·空白不敏感)');
ok(depth.indexOf('+ _tcBeats }], 900') !== -1, '口5 _tcBeats 未穿进 beats user');
ok(wsCount(depth, '_buildTemporalConstraint(null,{})') === 0, '口4/5 depth 应全 clauseOnly·不应现 full(null,{})');
// 口6 agent 128/138 + 主transcript + 脚手架(全 clauseOnly·root.)
ok(agent.indexOf('时空约束·史记质量审读·clauseOnly') !== -1, '口6-128 缺注释');
ok(wsHas(agent, "sys += '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });"), '口6-128 缺 sys+=clauseOnly(空白不敏感)');
ok(agent.indexOf('时空约束·据审读修订史记正文·clauseOnly') !== -1, '口6-138 缺注释');
ok(wsHas(agent, "fixSys += '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });"), '口6-138 缺 fixSys+=clauseOnly(空白不敏感)');
ok(agent.indexOf('时空约束·agent执政-史官主transcript') !== -1, '口6-主transcript 缺注释');
ok(wsHas(agent, "_sysP += '\\n' + root._buildTemporalConstraint(null, { clauseOnly: true });"), '口6-主transcript 缺 _sysP+=clauseOnly(空白不敏感)');
ok(agent.indexOf('时空约束·弱模型动作脚手架') !== -1, '口6-脚手架 缺注释');
ok(agent.indexOf('scaffoldSystemHasSentinel=false') !== -1, '口6-脚手架 注释未标 Codex 实证');
ok(count(agent, '时空约束·') === 4, '口6 计数：agent-mode 时空约束注释应恰4处(128/138/主transcript/脚手架)·177 anomaly 零注入·实=' + count(agent, '时空约束·'));

// ══════════════════════════════════════════════════════════════
// (B) VM 行为锁
// ══════════════════════════════════════════════════════════════
const behaviorPromises = [];

// B1 chronicle 年度正史 → full
(function () {
  let captured = '';
  const sb = baseSandbox({
    findScenarioById: () => ({ dynasty: '大明', emperor: '思宗' }),
    _getCharRange: () => [100, 200],
    _charRangeText: () => '',
    _charRangeScaled: () => '',
    calcDateFromTurn: () => ({ adYear: 1627 }),
    extractJSON: () => null, _dbg: () => {}, addEB: () => {},
    callAI: function (prompt) { captured = String(prompt || ''); return { then: function () { return { catch: function () {} }; } }; }
  });
  sb.P.ai = { key: 'k' };
  sb.GM.sid = 's1';
  vm.runInContext(chronicle, sb, { filename: 'chronicle' });
  sb.ChronicleSystem.monthDrafts = { 'y1627_1': { year: 1627, turn: 1, season: 0, summary: '正月大事' } };
  sb.ChronicleSystem._tryGenerateYearChronicle(1627);
  ok(hasFull(captured), 'B1 chronicle 年度正史 prompt 未含 full 约束(SHARED+FULL)');
})();

// B2 monthly 月度纪事 → full（抽取真实 IIFE 源码·同沙箱真实约束）
(function () {
  const startMarker = '(function _monthlyChronicle() {';
  const s = core.indexOf(startMarker);
  if (s < 0) { ok(false, 'B2 monthly IIFE 源码未找到'); return; }
  let depthB = 0, i = s + startMarker.length - 1;
  for (; i < core.length; i++) { const ch = core[i]; if (ch === '{') depthB++; else if (ch === '}') { depthB--; if (depthB === 0) break; } }
  const tail = core.indexOf(')();', i);
  const monthlySrc = core.slice(s, tail + 4);
  ok(monthlySrc.indexOf('_monthlyChronicle') >= 0 && monthlySrc.length > 400, 'B2 monthly 源码抽取异常');
  let capUser = '';
  const sb = baseSandbox({
    turnsForDuration: () => 1,
    _getDaysPerTurn: () => 30,
    DebugLog: { log: () => {}, warn: () => {} },
    callAIMessages: function (messages) { capUser = (messages && messages[1] && messages[1].content) || ''; return { then: function () { return { catch: function () {} }; } }; }
  });
  sb.P.ai = { key: 'k' };
  sb.P.dynasty = '大明';
  sb.P.mechanicsConfig = { chronicleConfig: { monthlyEnabled: true, monthlyWordLimit: 200, narratorRole: '史官' } };
  sb.GM.turn = 1;
  sb.GM.evtLog = [{ turn: 1, type: '政', text: '朝廷推行某改革' }];
  sb.GM.monthlyChronicles = [];
  vm.runInContext(monthlySrc, sb, { filename: 'monthly-iife' });
  ok(hasFull(capUser), 'B2 monthly 月度纪事 prompt 未含 full 约束(SHARED+FULL)');
})();

// B3 benji 本纪 → clauseOnly
behaviorPromises.push((function () {
  let captured = '';
  const sb = baseSandbox({
    callAISmart: function (prompt) { if (!captured) captured = String(prompt || ''); return Promise.resolve('本纪正文一段。'); },
    escHtml: (x) => String(x)
  });
  sb.P.conf = { benjiEnabled: true };
  sb.P.ai = { key: 'k' };
  sb.GM = { turn: 6, sid: 's1', qijuHistory: [], shijiHistory: [], biannianItems: [], chars: sb.GM.chars };
  vm.runInContext(benji, sb, { filename: 'benji' });
  return sb.TM.Benji.compose(sb.GM, { deathLine: '崩于某年', playerName: '上' }).then(function () {
    ok(hasClause(captured), 'B3 benji 本纪 prompt 未含 clauseOnly 约束(SHARED+CLAUSE)');
  });
})());

// B4 depth deepen_narrative → _xinshi(record+后人戏说) + _tcBeats(纲要)·真数据流双消费者
behaviorPromises.push((function () {
  const calls = [];
  const sb = baseSandbox({
    callAIMessages: function (messages) {
      calls.push({ sys: (messages && messages[0] && messages[0].content) || '', user: (messages && messages[1] && messages[1].content) || '' });
      return Promise.resolve('{"beats":["脉络一"],"tone":"沉","shizhengji":"时政记正文","shilu":"实录","zhengwen":"政文","houren_xishuo":"戏说","title":"标题","summary":"摘要","playerStatus":"状态","playerInner":"内心"}');
    },
    robustParseJSON: function (t) { try { return JSON.parse(String(t).match(/\{[\s\S]*\}/)[0]); } catch (e) { return null; } }
  });
  sb.P.conf = { agentNarrativeTier: 'primary' };
  sb.TM = sb.TM || {}; sb.TM.Endturn = sb.TM.Endturn || {}; sb.TM.Endturn.AI = { prompt: {
    recordSpecs: () => ({ shizhengji: '时政记desc', shilu: '实录desc', szjMin: 100, szjMax: 1200, playerStatus: '状态desc', playerInner: '内心desc', szjTitle: '标题desc', szjSummary: '摘要desc', shiluMax: 400, hourenMax: 6000 }),
    hourenSpec: () => '【后人戏说要求】'
  } };
  vm.runInContext(depth, sb, { filename: 'depth-tools' });
  const gm = { turn: 7, chars: sb.GM.chars, _turnReport: [], _aiScenarioDigest: {} };
  return sb.TM.Endturn.AgentDepthTools.handle('deepen_narrative', {}, { GM: gm }).then(function () {
    const beats = calls.filter((c) => c.sys.indexOf('先列本回合史记的关键脉络') >= 0);
    const record = calls.filter((c) => c.sys.indexOf('产出本回合史记主体记录') >= 0);
    const houren = calls.filter((c) => c.sys.indexOf('撰写《后人戏说》') >= 0);
    ok(beats.length === 1 && hasClause(beats[0].user), 'B4 深析纲要 beats 未含 clauseOnly(_tcBeats)');
    ok(record.length === 1 && hasClause(record[0].user), 'B4 深析 record(时政记主体) 未含 clauseOnly(_xinshi 数据流)');
    ok(houren.length === 1 && hasClause(houren[0].user), 'B4 深析 后人戏说 未含 clauseOnly(_xinshi 数据流)·双消费者之二');
  });
})());

// B5 agent 主 transcript(总口) → 真跑 run()·stub callAIWithTools 捕获真实 transcript
//   锁的是「_buildSystemPrompt() 的产出真流进了发给 LLM 的 transcript」这条线——
//   run() 内 :957 `_bParts.sys = _buildSystemPrompt()` → _assembleBase() → baseTranscript → :1030 cawt;
//   而 clauseOnly 约束由 _buildSystemPrompt() 内 :419-420 注入。把 :419-420 注入删掉(或 :957 sys 改 '')
//   后·捕获的 transcript 无 sentinel → 变红。
//   ⚠ 新 run() 契约(国师 Agent 升级)硬前置:TM.AgentKernel(预算)+ TM.Endturn.AgentIntentPlan(唯一提交器)·
//     缺则 run() 于 :874 早退到不了 cawt——故真加载这两个模块入同沙箱(非 stub·与 smoke-agent-mode-governance 同范式)。
behaviorPromises.push((function () {
  const captured = [];
  const sb = baseSandbox({ showLoading: () => {} });
  sb.callAIWithTools = function (transcript) { captured.push(String(transcript || '')); return Promise.resolve({ text: '', toolCalls: [] }); };
  sb.callAIMessages = function () { return Promise.resolve('{"actions":[]}'); };   // 循环后脚手架/深化兜底(不影响本断言)
  vm.runInContext(agentKernel, sb, { filename: 'agent-kernel' });         // TM.AgentKernel(预算/回执底座)真加载
  vm.runInContext(agentIntentPlan, sb, { filename: 'agent-intent-plan' }); // TM.Endturn.AgentIntentPlan(唯一提交器)真加载
  vm.runInContext(agent, sb, { filename: 'agent-mode' });
  sb.TM.Endturn.AgentReadTools = { defs: () => [] };
  sb.TM.Endturn.AgentWriteTools = { defs: () => [{ name: 'set_field' }] };
  const gm = { turn: 7, sid: 's1', chars: sb.GM.chars, _turnReport: [] };
  const done = (function () { try { return sb.TM.Endturn.AgentMode.run({ GM: gm, input: {} }); } catch (e) { return Promise.resolve(); } })();
  return Promise.resolve(done).catch(() => {}).then(function () {
    ok(captured.length >= 1, 'B5 run() 未跑到 callAIWithTools(无 transcript 捕获)');
    ok(captured.length >= 1 && captured.every(hasClause), 'B5 agent 主transcript(真跑run·捕获cawt) 未含 clauseOnly(SHARED+CLAUSE)·主循环丢约束');
  });
})());

// B6 agent 脚手架 → clauseOnly·运行态断言
behaviorPromises.push((function () {
  let scaffoldSys = '';
  const sb = baseSandbox({ showLoading: () => {} });
  sb.callAIMessages = function (messages) { scaffoldSys = (messages && messages[0] && messages[0].content) || ''; return Promise.resolve('{"actions":[]}'); };
  vm.runInContext(agent, sb, { filename: 'agent-mode' });
  sb.TM.Endturn.AgentWriteTools = { defs: () => [{ name: 'set_field' }] };
  return sb.TM.Endturn.AgentMode.scaffoldAction({ prompt: { sysP: '依据X', tp: '回合Y' } }, sb.GM, '基线', {}).then(function () {
    ok(hasClause(scaffoldSys), 'B6 agent 脚手架(scaffoldAction) 运行态未含 clauseOnly(SHARED+CLAUSE)');
  });
})());

// B7 agent 质量审读(128) + 据审读修订史记(138) → clauseOnly·运行态断言
behaviorPromises.push((function () {
  const caps = [];
  let n = 0;
  const sb = baseSandbox({ showLoading: () => {} });
  sb.callAIMessages = function (messages) {
    caps.push((messages && messages[0] && messages[0].content) || '');
    n++;
    if (n === 1) return Promise.resolve('{"pass":false,"issues":[{"dim":"信史","problem":"某问题","fix":"某修正"}]}');
    return Promise.resolve('{"shizhengji":"修订后时政记","shilu":"修订后实录","zhengwen":"修订后政文"}');
  };
  vm.runInContext(agent, sb, { filename: 'agent-mode' });
  const gm = { turn: 7, chars: sb.GM.chars, _turnReport: [{ type: 'change', path: '财政', reason: '某改动' }], _agentChronicle: { shizhengji: '这是本回合的时政记正文'.repeat(3) } };
  return sb.TM.Endturn.AgentMode.qualityGate({ input: {} }, gm, {}, '叙事').then(function () {
    ok(caps.length >= 2 && hasClause(caps[0]), 'B7 质量审读(128) sys 运行态未含 clauseOnly');
    ok(caps.length >= 2 && hasClause(caps[1]), 'B7 据审读修订史记(138) fixSys 运行态未含 clauseOnly');
  });
})());

// ── 收官 ──
Promise.all(behaviorPromises).then(function () {
  console.log('---');
  console.log('断言总数 ' + (pass + fail) + '·PASS ' + pass + '·FAIL ' + fail);
  if (fail > 0) { console.log('FAIL: smoke-tc-history-wave 有 ' + fail + ' 条断言未过'); process.exit(1); }
  console.log('smoke-tc-history-wave PASS (源码断言 + VM行为锁)');
}).catch(function (e) {
  console.log('FAIL: smoke-tc-history-wave 行为锁异常 ' + (e && e.stack || e));
  process.exit(1);
});
