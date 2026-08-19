#!/usr/bin/env node
// scripts/smoke-faction-living-world.js — 刀F2·势力活世界
//   OFF 矩阵：总闸 GM._factionLivingWorld=false（2026-07-22 已翻默认 ON·OFF 路径须显式设 false）→ 全线零行为变更(prompt 无新增段·新动作类型不收·appliers no-op)
//   ON  矩阵：declare_war/join_war 经 CasusBelliSystem 落 activeWars·重复开战被拒·对玩家宣战门槛·(S2)目标修剪·(S3)事件化
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let PASS = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); PASS++; }

function buildContext() {
  const ctx = { console: { log: function(){}, warn: function(){}, error: function(){} },
    Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, Boolean: Boolean, RegExp: RegExp,
    isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Set: Set,
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['tm-agent-flags.js',
   'tm-faction-paradigm.js', 'tm-faction-personality.js', 'tm-faction-index.js',
   'tm-faction-derived-health.js', 'tm-faction-membership.js',
   'tm-faction-derived-economy.js', 'tm-faction-derived-cohesion.js', 'tm-faction-derived-strength.js',
   'tm-faction-npc-settings.js', 'tm-qiju-ledger.js', 'tm-faction-npc-news-bridge.js',
   'tm-faction-diplomacy.js', 'tm-faction-goal-stack.js',
   'tm-faction-action-engine.js',
   'tm-faction-npc-memorial.js', 'tm-faction-npc-edict.js', 'tm-faction-npc-chaoyi.js',
   'tm-faction-npc-office.js', 'tm-faction-npc-guoku.js',
   'tm-faction-npc-llm-decision.js'].forEach(function(f){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

// 忠实镜像 tm-feudal-warfare.js:257 CasusBelliSystem.declareWar 契约(停战/重复双向查/落 activeWars/{success,war})
function installCasusBelli(ctx) {
  ctx.CasusBelliSystem = {
    _calls: [],
    declareWar: function(attacker, defender, cbId) {
      ctx.CasusBelliSystem._calls.push({ attacker: attacker, defender: defender, cbId: cbId });
      var G = ctx.GM; if (!G.activeWars) G.activeWars = [];
      var exist = G.activeWars.find(function(w){ return (w.attacker===attacker&&w.defender===defender)||(w.attacker===defender&&w.defender===attacker); });
      if (exist) return { success: false, message: '已在交战中' };
      var war = { id: 'w' + (G.activeWars.length + 1), attacker: attacker, defender: defender, casusBelli: cbId, casusBelliName: cbId, startTurn: G.turn, warScore: 0, truceMonths: 12, _viaCasusBelli: true };
      G.activeWars.push(war);
      return { success: true, war: war };
    }
  };
}

function baseGM(ctx, opts) {
  opts = opts || {};
  ctx.P = { playerInfo: { factionId: 'fac-player', factionName: '玩家朝廷' }, conf: { npcAiPrecision: true }, ai: { key: 'fake' } };
  ctx.GM = {
    turn: 5,
    facs: [ { id: 'fac-a', name: '甲势力', treasury: { money: 100000 } }, { id: 'fac-b', name: '乙势力', treasury: { money: 100000 } }, { id: 'fac-player', name: '玩家朝廷', isPlayer: true } ],
    chars: [],
    _facIndex: { '甲势力': { chars: [], parties: {}, metrics: {} }, '乙势力': { chars: [], parties: {}, metrics: {} } },
    activeWars: [], factionRelations: []
  };
  ctx.GM._factionLivingWorld = opts.livingWorld ? true : false;   // 翻默认 ON 后·OFF 矩阵须显式关(否则默认=ON)
}

function mkDecision(actions) { return { rationale: '测·因果·Phase 1·X (cause: y)。', memorials: [], edict: null, chaoyi: null, office: [], actions: actions }; }

// ─────────────── OFF 矩阵：零行为变更 ───────────────
function offZeroChangeTest() {
  const ctx = buildContext();
  installCasusBelli(ctx);
  baseGM(ctx);   // 默认 OFF
  const eng = ctx.TM.FactionActionEngine;
  const fld = ctx.TM.FactionNpcLlmDecision;

  assert(eng.livingWorldOn() === false, 'living world OFF when _factionLivingWorld=false (2026-07-22 已翻默认 ON·显式关才 OFF)');
  assert(ctx.agentFlagOn('factionAgentEnabled') === false, 'OFF: factionAgentEnabled not brought on');
  assert(ctx.agentFlagOn('factionGoalStackEnabled') === false, 'OFF: factionGoalStackEnabled not brought on');

  // 契约 prompt·OFF 不列 living-world 类型
  const contractOff = eng.formatActionContractForPrompt({ maxChars: 4000 });
  assert(contractOff.indexOf('declare_war') < 0 && contractOff.indexOf('join_war') < 0, 'OFF: ACTION_CONTRACT must not advertise declare_war/join_war');

  // validateDecision·OFF 丢弃 living-world 动作(等同 F1：非法类型被过滤)
  const vOff = eng.validateDecision(mkDecision([{ type: 'declare_war', targetFaction: '乙势力' }, { type: 'edict', edictType: '安抚', type_x: 1 }]));
  assert(vOff.actions.filter(function(a){ return a.type === 'declare_war'; }).length === 0, 'OFF: validateDecision drops declare_war');

  // applyDecision·OFF：declare_war no-op·activeWars 不变·CasusBelli 未被调用
  const facA = ctx.GM.facs[0];
  const sumOff = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '乙势力' }]), { turn: 5 });
  assert(!sumOff.wars, 'OFF: no war applied');
  assert(ctx.GM.activeWars.length === 0, 'OFF: activeWars untouched');
  assert(ctx.CasusBelliSystem._calls.length === 0, 'OFF: CasusBelliSystem.declareWar never called');

  // buildPrompt·OFF：无 living-world / agent 段
  const pOff = fld._buildPrompt(facA);
  const combOff = pOff.system + '\n' + pOff.user;
  assert(combOff.indexOf('declare_war') < 0, 'OFF: prompt has no declare_war token');
  assert(combOff.indexOf('[ACTIVE_GOALS]') < 0 && combOff.indexOf('[INCOMING_PROPOSALS]') < 0, 'OFF: prompt has no goal-stack / diplomacy sections');
  return combOff;
}

// OFF idempotent + ON adds (逐字节：OFF 两次一致；ON 仅新增)
function offOnDiffTest() {
  const ctx = buildContext();
  installCasusBelli(ctx);
  baseGM(ctx);
  const fld = ctx.TM.FactionNpcLlmDecision;
  const facA = ctx.GM.facs[0];

  const off1 = (function(p){ return p.system + '\n' + p.user; })(fld._buildPrompt(facA));
  ctx.GM._factionLivingWorld = true;
  const on1 = (function(p){ return p.system + '\n' + p.user; })(fld._buildPrompt(facA));
  ctx.GM._factionLivingWorld = false;
  const off2 = (function(p){ return p.system + '\n' + p.user; })(fld._buildPrompt(facA));

  assert(off1 === off2, 'OFF prompt is byte-identical before and after toggling ON (zero residue)');
  assert(on1 !== off1, 'ON prompt differs from OFF (feature adds content)');
  assert(on1.length > off1.length && on1.indexOf('declare_war') >= 0, 'ON prompt is a superset that adds declare_war contract');
  assert(off1.indexOf('declare_war') < 0, 'OFF prompt never mentions declare_war');
}

// ─────────────── ON 矩阵：真战争接线 ───────────────
function onDeclareWarTest() {
  const ctx = buildContext();
  installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;

  assert(ctx.agentFlagOn('factionAgentEnabled') === true, 'ON: master brings on factionAgentEnabled');

  const contractOn = eng.formatActionContractForPrompt({ maxChars: 4000 });
  assert(contractOn.indexOf('declare_war') >= 0 && contractOn.indexOf('join_war') >= 0, 'ON: ACTION_CONTRACT advertises declare_war/join_war');

  const facA = ctx.GM.facs[0];
  const sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '乙势力', casusBelli: 'border' }]), { turn: 5 });
  assert(sum.wars === 1, 'ON: declare_war applied');
  assert(ctx.CasusBelliSystem._calls.length === 1 && ctx.CasusBelliSystem._calls[0].attacker === '甲势力' && ctx.CasusBelliSystem._calls[0].defender === '乙势力', 'ON: routed through CasusBelliSystem.declareWar (not self-written)');
  const war = ctx.GM.activeWars.find(function(w){ return w.attacker === '甲势力' && w.defender === '乙势力'; });
  assert(war && war._viaCasusBelli === true, 'ON: activeWars entry created BY CasusBelliSystem (bears its marker)');

  // 重复开战被拒
  const sum2 = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '乙势力', casusBelli: 'border' }]), { turn: 5 });
  assert(!sum2.wars, 'ON: duplicate war declaration rejected');
  assert(ctx.GM.activeWars.filter(function(w){ return (w.attacker==='甲势力'&&w.defender==='乙势力'); }).length === 1, 'ON: no duplicate war record');
}

// 对玩家宣战门槛：关系不够恶 or 无正当 CB → 拦；够恶+正当 CB → 放行
function onPlayerWarThresholdTest() {
  const ctx = buildContext();
  installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];

  // 关系中立(0) → 拦
  let sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '玩家朝廷', casusBelli: 'subjugation' }]), { turn: 5 });
  assert(!sum.wars && ctx.CasusBelliSystem._calls.length === 0, 'player-war blocked when relation not hostile enough');

  // 关系够恶(-60) 但 CB=none → 拦
  ctx.GM.factionRelations = [{ from: '甲势力', to: '玩家朝廷', value: -60 }];
  sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '玩家朝廷', casusBelli: 'none' }]), { turn: 6 });
  assert(!sum.wars, 'player-war blocked when casus belli is none even if hostile');

  // 关系够恶(-60) + 正当 CB → 放行
  sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '玩家朝廷', casusBelli: 'claim' }]), { turn: 7 });
  assert(sum.wars === 1 && ctx.GM.activeWars.some(function(w){ return w.defender === '玩家朝廷'; }), 'player-war allowed with hostility + legitimate casus belli');
}

// join_war：须有涉及目标的进行中战争(=加入)·否则拒
function onJoinWarTest() {
  const ctx = buildContext();
  installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];

  // 无进行中战争涉乙 → join 被拒
  let sum = eng.applyDecision(facA, mkDecision([{ type: 'join_war', targetFaction: '乙势力', casusBelli: 'holy' }]), { turn: 5 });
  assert(!sum.wars, 'join_war rejected when target is not in any ongoing war');

  // 造一场 玩家朝廷 vs 乙势力 的战争，甲参战攻乙 → 放行
  ctx.GM.activeWars.push({ id: 'w0', attacker: '玩家朝廷', defender: '乙势力', casusBelli: 'border', startTurn: 4 });
  sum = eng.applyDecision(facA, mkDecision([{ type: 'join_war', targetFaction: '乙势力', casusBelli: 'holy' }]), { turn: 6 });
  assert(sum.wars === 1, 'join_war applied when target is in an ongoing war');
  assert(ctx.CasusBelliSystem._calls.some(function(c){ return c.attacker === '甲势力' && c.defender === '乙势力'; }), 'join_war routes through CasusBelliSystem too');
}

// ─────────────── Slice 2·目标生命周期 ───────────────
function goalStrat(fac) {
  return { name: fac, aiStrategy: { claims: ['已占省', '未占省'], threats: ['亡势力', '活势力'], alliances: [], objectives: [], cooldowns: {} } };
}
function goalGM(ctx, facObj, opts) {
  opts = opts || {};
  ctx.P = { playerInfo: { factionName: '玩家朝廷' }, conf: { npcAiPrecision: true }, ai: { key: 'fake' } };
  ctx.GM = {
    turn: 9, facs: [facObj, { name: '活势力' }, { name: '玩家朝廷', isPlayer: true }],
    _facIndex: { '甲势力': { chars: [], parties: {}, metrics: {} } },
    _provinceToFaction: { '已占省': '甲势力' }, activeWars: []
  };
  ctx.GM._factionLivingWorld = opts.livingWorld ? true : false;   // 翻默认 ON 后·OFF 矩阵须显式关
}

function goalLifecycleOffTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  const fac = goalStrat('甲势力');
  goalGM(ctx, fac);   // OFF
  assert(ctx.agentFlagOn('factionGoalStackEnabled') === false, 'OFF: factionGoalStackEnabled not brought on');
  ctx.TM.FactionActionEngine.ensureStrategy(fac, { rationale: 'x' }, []);
  assert(fac.aiStrategy.claims.length === 2 && fac.aiStrategy.threats.length === 2, 'OFF: strategy arrays are NOT pruned (zero behavior change)');
}

function goalLifecycleOnTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  const fac = goalStrat('甲势力');
  goalGM(ctx, fac, { livingWorld: true });   // ON
  assert(ctx.agentFlagOn('factionGoalStackEnabled') === true, 'ON: master brings on factionGoalStackEnabled');
  ctx.TM.FactionActionEngine.ensureStrategy(fac, { rationale: 'x' }, []);
  assert(fac.aiStrategy.claims.indexOf('已占省') < 0, 'ON: fulfilled claim (province now owned by self) is pruned');
  assert(fac.aiStrategy.claims.indexOf('未占省') >= 0, 'ON: still-open claim retained');
  assert(fac.aiStrategy.threats.indexOf('亡势力') < 0, 'ON: dead threat (not in GM.facs) is pruned');
  assert(fac.aiStrategy.threats.indexOf('活势力') >= 0, 'ON: live threat retained');

  // 目标栈超期未推进 → abandoned(降权)·经 pruneGoals
  const gs = ctx.TM.FactionGoalStack;
  gs.addGoal(fac, { desc: '陈旧目标', horizon: 'short' }, 1);   // createdTurn 1·lastProgressTurn 1
  ctx.GM.turn = 20;   // >12 回合无进展
  ctx.TM.FactionActionEngine.ensureStrategy(fac, { rationale: 'y' }, []);   // 触发 pruneGoals
  const stale = (fac.aiStrategy.goals || []).find(function(g){ return g.desc === '陈旧目标'; });
  assert(stale && stale.status === 'abandoned', 'ON: stale goal (>12 turns no progress) is deprioritized to abandoned');

  // 目标栈路径入 prompt（goalUpdates schema 出现）
  const fld = ctx.TM.FactionNpcLlmDecision;
  ctx.GM._facIndex['甲势力'] = { chars: [], parties: {}, metrics: {} };
  const p = fld._buildPrompt(fac);
  assert((p.system + p.user).indexOf('goalUpdates') >= 0, 'ON: goal-stack schema (goalUpdates) injected into decision prompt');
}

// ─────────────── Slice 3·后果事件化 ───────────────
function eventOffTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx);   // OFF
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];
  ctx.GM.currentIssues = [];
  eng.applyDecision(facA, mkDecision([{ type: 'diplomacy', targetFaction: '乙势力', relationDelta: 60, treaty: '盟约' }]), { turn: 5 });
  assert(ctx.GM.currentIssues.filter(function(x){ return x && x._flw; }).length === 0, 'OFF: major decision does NOT emit any world event to currentIssues');
}

function eventOnDeclareWarTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];
  ctx.GM.currentIssues = [];
  eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '乙势力', casusBelli: 'border' }]), { turn: 5 });
  const iss = ctx.GM.currentIssues.filter(function(x){ return x && x._flw; });
  assert(iss.length === 1, 'ON: declare_war emits exactly one world-event issue');
  assert(iss[0].status === 'pending' && iss[0].title.indexOf('宣战') >= 0 && Number(iss[0].raisedTurn) === 5, 'ON: issue has canonical shape (pending/title/turn) for 御案时政 render');
  assert(iss[0].linkedFactions.indexOf('甲势力') >= 0 && iss[0].linkedFactions.indexOf('乙势力') >= 0, 'ON: issue linkedFactions carry actor + target');
  assert(iss[0]._flwActor === '甲势力', 'ON: issue tagged with acting faction');
}

function eventCapDedupTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];
  ctx.GM.currentIssues = [];
  // 每势力 cap 1/回合：同一势力本回合多项重大决策 → 只发最重一条
  eng.applyDecision(facA, mkDecision([
    { type: 'declare_war', targetFaction: '乙势力', casusBelli: 'border' },
    { type: 'diplomacy', targetFaction: '玩家朝廷', relationDelta: 60, treaty: '盟约' }
  ]), { turn: 5 });
  assert(ctx.GM.currentIssues.filter(function(x){ return x && x._flwActor === '甲势力' && Number(x.raisedTurn) === 5; }).length === 1, 'ON: per-faction cap 1/turn (multiple majors collapse to one issue)');
  // 同 id 去重：重发同事件不重复
  eng._emitWorldEvents(facA, [{ kind: 'declare_war', actor: '甲势力', target: '乙势力', cb: 'border' }], 5);
  assert(ctx.GM.currentIssues.filter(function(x){ return x && x._flwActor === '甲势力' && Number(x.raisedTurn) === 5; }).length === 1, 'ON: same-turn re-emit does not duplicate');
  // 全局 cap 3/回合
  ctx.GM.currentIssues = [];
  ['f1', 'f2', 'f3', 'f4'].forEach(function(n){ ctx.GM.facs.push({ name: n }); eng._emitWorldEvents({ name: n }, [{ kind: 'alliance', actor: n, target: '乙势力' }], 5); });
  assert(ctx.GM.currentIssues.filter(function(x){ return x && x._flw && Number(x.raisedTurn) === 5; }).length === 3, 'ON: global cap 3/turn caps the flood');
}

function eventDiplomacyKindTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];
  ctx.GM.currentIssues = [];
  eng.applyDecision(facA, mkDecision([{ type: 'diplomacy', targetFaction: '乙势力', relationDelta: -70 }]), { turn: 7 });
  const iss = ctx.GM.currentIssues.filter(function(x){ return x && x._flw && Number(x.raisedTurn) === 7; });
  assert(iss.length === 1 && iss[0]._flwKind === 'betrayal' && iss[0].title.indexOf('交恶') >= 0, 'ON: big negative diplomacy emits a 背刺/交恶 world event');
}

// ═══════════ Codex 返工·八阻断红绿 ═══════════
// B1·契约不截断：ON 时 maxChars=1800 仍完整含 declare_war/join_war 的字段行(旧=尾部被截) + enum 12 类
function b1ContractNotTruncatedTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine, fld = ctx.TM.FactionNpcLlmDecision;
  const c = eng.formatActionContractForPrompt({ maxChars: 1800 });
  assert(c.indexOf('declare_war') >= 0 && c.indexOf('join_war') >= 0, 'B1: contract at maxChars=1800 still lists BOTH new types (not truncated off the tail)');
  assert(c.indexOf('CasusBelliSystem') >= 0, 'B1: the declare_war full field line (mutates=CasusBelliSystem) survives, not just a mention');
  const p = fld._buildPrompt(ctx.GM.facs[0]);
  assert(p.user.indexOf('|declare_war|join_war') >= 0, 'B1: static enum becomes 12-class when living world is ON');
  assert(p.user.indexOf('10 种 type') < 0, 'B1: the false "10 种" claim is gone when ON');
}

// B8·OFF 契约绝对过滤：getActionContract() 公开 API 在 OFF 不列两新类型；OFF enum 无 declare_war
function b8OffContractFilterTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx);   // OFF
  const eng = ctx.TM.FactionActionEngine, fld = ctx.TM.FactionNpcLlmDecision;
  const c = eng.getActionContract();
  assert(!c.declare_war && !c.join_war, 'B8: getActionContract() must NOT expose living-world types when OFF');
  const p = fld._buildPrompt(ctx.GM.facs[0]);
  assert(p.user.indexOf('declare_war') < 0 && p.user.indexOf('10 种 type') >= 0, 'B8: OFF static schema stays 10-class F1 text, no declare_war leak');
  ctx.GM._factionLivingWorld = true;
  assert(!!eng.getActionContract().declare_war, 'B8: ON getActionContract() DOES expose declare_war (control)');
}

// B2·响应按 id 精确匹配：同回合 A 发 alliance+joint_action，B 接受 alliance/拒绝 joint_action 不错配
function b2ResponseIdMatchTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const dip = ctx.TM.FactionDiplomacy;
  const B = ctx.GM.facs[1];   // 乙势力
  dip.recordProposals('甲势力', [
    { toFaction: '乙势力', type: 'alliance', terms: '共御外敌' },
    { toFaction: '乙势力', type: 'joint_action', terms: '联攻丙' }
  ], 5);
  const inc = B._incomingProposals;
  assert(inc && inc.length === 2, 'B2 setup: two proposals from 甲 recorded on 乙');
  const idAlliance = inc.find(function(x){ return x.type === 'alliance'; }).id;
  const idJoint = inc.find(function(x){ return x.type === 'joint_action'; }).id;
  dip.applyResponses(B, [
    { proposalId: idAlliance, decision: 'accept' },
    { proposalId: idJoint, decision: 'reject' }
  ], 5);
  const allianceProp = (B._incomingProposals || []).find(function(x){ return x.id === idAlliance; });
  const jointProp = (B._incomingProposals || []).find(function(x){ return x.id === idJoint; });
  assert(allianceProp && allianceProp.status === 'accepted', 'B2: alliance accepted by id (not swapped)');
  assert(jointProp && jointProp.status === 'rejected', 'B2: joint_action rejected by id (not swapped)');
}

// B3·结盟落 GM.treaties(有牙)：accept alliance → treaty(mutual_defense,parties) 落账·战争引擎可读
function b3AllianceTreatyTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const dip = ctx.TM.FactionDiplomacy;
  const B = ctx.GM.facs[1];
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'alliance', terms: '同盟' }], 5);
  const id = B._incomingProposals[0].id;
  dip.applyResponses(B, [{ proposalId: id, decision: 'accept' }], 5);
  const tr = (ctx.GM.treaties || []).find(function(t){
    var parties = Array.isArray(t.parties) ? t.parties.map(function(p){ return (p && p.name) || p; }) : [];
    return t.type === 'alliance' && parties.indexOf('甲势力') >= 0 && parties.indexOf('乙势力') >= 0;
  });
  assert(tr, 'B3: accepted alliance lodges a real GM.treaties entry (not just aiStrategy.alliances)');
  assert(tr.mutual_defense === true && tr.active === true, 'B3: alliance treaty carries mutual_defense + active (feudal-warfare _ty_callAlliesToWar consumes these)');
  assert(tr.parties[0].id === 'fac-a' && tr.parties[1].id === 'fac-b', 'B3: treaty parties carry stable faction ids alongside display names');
}

// B3b·同名势力必须按 ID 路由；缺 ID 的歧义名称 fail-closed。
function b3bStableFactionIdentityTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  ctx.P = { playerInfo: { factionId: 'fac-player', factionName: '玩家朝廷' }, conf: { npcAiPrecision: true }, ai: { key: 'fake' } };
  const from = { id: 'fac-from', name: '发议方' };
  const sameA = { id: 'fac-same-a', name: '同名势力' };
  const sameB = { id: 'fac-same-b', name: '同名势力' };
  ctx.GM = { turn: 5, _factionLivingWorld: true, facs: [from, sameA, sameB], activeWars: [], factionRelations: [] };
  const dip = ctx.TM.FactionDiplomacy;
  const routed = dip.recordProposals(from, [{ toFaction: '同名势力', toFactionId: 'fac-same-b', type: 'alliance', terms: '凭 ID 缔盟' }], 5);
  assert(routed.recorded === 1 && !sameA._incomingProposals && sameB._incomingProposals.length === 1,
    'B3b: explicit toFactionId routes a proposal to the correct same-name faction only');
  const proposal = sameB._incomingProposals[0];
  assert(proposal.fromId === 'fac-from' && proposal.toId === 'fac-same-b', 'B3b: proposal persists stable from/to ids');
  dip.applyResponses(sameB, [{ proposalId: proposal.id, decision: 'accept' }], 5);
  assert(from.aiStrategy.allianceIds[0] === 'fac-same-b' && sameB.aiStrategy.allianceIds[0] === 'fac-from',
    'B3b: accepted alliance canonical relation arrays use stable ids');
  assert(ctx.GM.treaties[0].parties.some(function(p){ return p.id === 'fac-same-b'; }), 'B3b: same-name treaty preserves the selected faction id');
  const ambiguous = dip.recordProposals(from, [{ toFaction: '同名势力', type: 'deal', terms: '无 ID 歧义' }], 6);
  assert(ambiguous.recorded === 0 && (sameA._incomingProposals || []).length === 0,
    'B3b: ambiguous same-name target without id is rejected instead of selecting array-first');
}

// B4·目标契约不撞车：goal-stack 激活时 s.goals 纯结构对象·字符串标签落 recentActionLabels
function b4GoalStructureTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine, gs = ctx.TM.FactionGoalStack;
  const facA = ctx.GM.facs[0];
  gs.addGoal(facA, { desc: '结构化目标', horizon: 'short' }, 5);
  eng.applyDecision(facA, mkDecision([{ type: 'diplomacy', targetFaction: '乙势力', relationDelta: -20, reason: '边衅' }]), { turn: 5 });
  const goals = facA.aiStrategy.goals || [];
  assert(goals.length >= 1 && goals.every(function(g){ return g && typeof g === 'object'; }), 'B4: aiStrategy.goals holds ONLY structured objects (no string labels mixed in)');
  assert(Array.isArray(facA.aiStrategy.recentActionLabels) && facA.aiStrategy.recentActionLabels.some(function(l){ return typeof l === 'string' && l.indexOf('diplomacy') >= 0; }), 'B4: action string labels are redirected to recentActionLabels');
}

// B5·join_war 语义：新战标 parentWarId 关联原战对象(双边模型取舍)
function b5JoinWarParentTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  ctx.GM.activeWars.push({ id: 'origW', attacker: '玩家朝廷', defender: '乙势力', casusBelli: 'border', startTurn: 4 });
  eng.applyDecision(ctx.GM.facs[0], mkDecision([{ type: 'join_war', targetFaction: '乙势力', casusBelli: 'holy' }]), { turn: 6 });
  const joined = ctx.GM.activeWars.find(function(w){ return w.attacker === '甲势力' && w.defender === '乙势力'; });
  assert(joined && joined.parentWarId === 'origW' && joined._joinedWar === true, 'B5: join_war stamps parentWarId of the original war (join semantics, not orphan war)');
}

// B6·对玩家 casus belli fail-closed：缺失/非法 → 拒(即便关系够恶)·正当 CB → 放行
function b6PlayerCbFailClosedTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0];
  ctx.GM.factionRelations = [{ from: '甲势力', to: '玩家朝廷', value: -70 }];   // 关系够恶
  let sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '玩家朝廷', casusBelli: '莫须有' }]), { turn: 5 });
  assert(!sum.wars, 'B6: garbage casus belli against player is rejected (fail-closed·not auto-normalized to border)');
  sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '玩家朝廷' }]), { turn: 6 });
  assert(!sum.wars, 'B6: MISSING casus belli against player is rejected (fail-closed)');
  sum = eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '玩家朝廷', casusBelli: 'claim' }]), { turn: 7 });
  assert(sum.wars === 1, 'B6: explicit legitimate casus belli against player IS allowed');
  // NPC-vs-NPC 保留宽松：非法 CB 归一 border 仍可开战
  const ctx2 = buildContext(); installCasusBelli(ctx2); baseGM(ctx2, { livingWorld: true });
  const s2 = ctx2.TM.FactionActionEngine.applyDecision(ctx2.GM.facs[0], mkDecision([{ type: 'declare_war', targetFaction: '乙势力', casusBelli: '莫须有' }]), { turn: 5 });
  assert(s2.wars === 1, 'B6: NPC-vs-NPC keeps lenient normalization (garbage → border, still wars)');
}

// B7·事件跨回合防积压(过期>2回合 + 全局上限) + 结盟标题按 relationType 分词
function b7EventBoundAndTitleTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  ctx.GM.currentIssues = [];
  // 跨 6 回合不同势力各发事件 → 总 pending 有界 + 老事件(>2回合)过期
  for (var t = 20; t <= 25; t++) { ctx.GM.facs.push({ name: 'fac' + t }); eng._emitWorldEvents({ name: 'fac' + t }, [{ kind: 'declare_war', actor: 'fac' + t, target: '乙势力', cb: 'border' }], t); }
  const pend = ctx.GM.currentIssues.filter(function(x){ return x && x._flw && x.status === 'pending'; });
  assert(pend.length <= 5, 'B7: cross-turn pending living-world events are globally bounded (<=5), not unbounded');
  assert(!ctx.GM.currentIssues.some(function(x){ return x && x._flw && x.status === 'pending' && (25 - Number(x.raisedTurn) > 2); }), 'B7: events older than 2 turns are expired (no stale backlog)');
  // 结盟标题分词：互不侵犯 relationType → 「议互不侵犯」不是「结盟」
  ctx.GM.currentIssues = [];
  eng.applyDecision(ctx.GM.facs[0], mkDecision([{ type: 'diplomacy', targetFaction: '乙势力', relationDelta: 55, relationType: '互不侵犯' }]), { turn: 5 });
  const iss = ctx.GM.currentIssues.filter(function(x){ return x && x._flw && Number(x.raisedTurn) === 5; })[0];
  assert(iss && iss.title.indexOf('议互不侵犯') >= 0 && iss.title.indexOf('结盟') < 0, 'B7: alliance-family event title splits by relationType (互不侵犯→议互不侵犯, not 结盟)');
}

// ═══════════ Codex 二轮·五阻断红绿 ═══════════
// B2①·去重键加 terms：同 from+type 但不同条款两提案都保留(旧=去重丢第一条)
function b2aDedupTermsTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const dip = ctx.TM.FactionDiplomacy, B = ctx.GM.facs[1];
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'deal', terms: '互市粮秣' }], 5);
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'deal', terms: '互市茶马' }], 5);
  const deals = (B._incomingProposals || []).filter(function(x){ return x.type === 'deal' && x.status === 'pending'; });
  assert(deals.length === 2, 'B2①: two same from+type but DIFFERENT-terms proposals are both kept (not deduped to one)');
}
// B2②·全局递增序号：同回合两次 recordProposals 的 id 不碰撞(旧=n 重置 → dp-5-a-0 撞)
function b2bSeqNoCollisionTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const dip = ctx.TM.FactionDiplomacy, B = ctx.GM.facs[1];
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'alliance', terms: 'a' }], 5);
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'nonaggression', terms: 'b' }], 5);
  const ids = (B._incomingProposals || []).map(function(x){ return x.id; });
  assert(ids.length === 2 && ids[0] !== ids[1], 'B2②: two same-turn recordProposals calls yield DISTINCT ids (global seq)');
}
// B2③·匹配 fail-closed：带 id 未命中→保持未决；无 id 歧义→保持未决；无 id 唯一→结算
function b2cMatchFailClosedTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const dip = ctx.TM.FactionDiplomacy, B = ctx.GM.facs[1];
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'alliance', terms: 't' }], 5);
  dip.applyResponses(B, [{ proposalId: 'no-such-id', decision: 'accept' }], 5);
  assert((B._incomingProposals || []).every(function(p){ return p.status === 'pending'; }), 'B2③: response with unknown id is fail-closed (stays pending, not mis-settled to another proposal)');
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'deal', terms: 'x' }], 5);
  dip.recordProposals('甲势力', [{ toFaction: '乙势力', type: 'deal', terms: 'y' }], 5);
  dip.applyResponses(B, [{ from: '甲势力', type: 'deal', decision: 'accept' }], 5);
  const deals = (B._incomingProposals || []).filter(function(p){ return p.type === 'deal'; });
  assert(deals.length === 2 && deals.every(function(p){ return p.status === 'pending'; }), 'B2③: ambiguous no-id response (2 candidates) keeps BOTH pending');
  dip.applyResponses(B, [{ from: '甲势力', type: 'alliance', decision: 'accept' }], 5);
  const alli = (B._incomingProposals || []).filter(function(p){ return p.type === 'alliance'; })[0];
  assert(alli && alli.status === 'accepted', 'B2③: unique no-id response IS settled');
}
// B4·混合数组一次性迁移：OFF 跑出字符串 goals → 开闸 → 纯结构对象
function b4MigrationTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  const fac = { name: '甲势力', treasury: { money: 100000 } };
  ctx.P = { playerInfo: { factionName: '玩家朝廷' }, conf: { npcAiPrecision: true }, ai: { key: 'fake' } };
  ctx.GM = { turn: 5, _factionLivingWorld: false, facs: [fac, { name: '乙势力' }, { name: '玩家朝廷', isPlayer: true }], _facIndex: { '甲势力': { chars: [], parties: {}, metrics: {} } }, activeWars: [], factionRelations: [] };
  const eng = ctx.TM.FactionActionEngine;
  eng.ensureStrategy(fac, { rationale: 'x' }, [{ type: 'diplomacy', payload: { targetFaction: '乙势力', relationDelta: -10 } }]);   // OFF (显式 _factionLivingWorld=false)
  assert(fac.aiStrategy.goals.some(function(g){ return typeof g === 'string'; }), 'B4 setup: OFF produced legacy string goals');
  ctx.GM._factionLivingWorld = true;
  ctx.TM.FactionGoalStack.addGoal(fac, { desc: '真目标', horizon: 'short' }, 5);   // 此刻 goals 混合(字符串+对象)
  eng.ensureStrategy(fac, { rationale: 'y' }, []);   // 触发一次性迁移
  assert(fac.aiStrategy.goals.length >= 1 && fac.aiStrategy.goals.every(function(g){ return g && typeof g === 'object'; }), 'B4: flag-on migrates the mixed array → goals pure structured objects');
  assert(fac.aiStrategy.recentActionLabels.some(function(l){ return typeof l === 'string'; }), 'B4: migrated string labels moved to recentActionLabels');
}
// B5·join_war honor 指定 warId(非数组首/非最新)
function b5WarIdHonorTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  ctx.GM.facs.push({ name: '丙' });
  ctx.GM.activeWars.push({ id: 'w-first', attacker: '玩家朝廷', defender: '乙势力', startTurn: 5 });   // 数组首·最新
  ctx.GM.activeWars.push({ id: 'w-old', attacker: '丙', defender: '乙势力', startTurn: 3 });            // 较老
  eng.applyDecision(ctx.GM.facs[0], mkDecision([{ type: 'join_war', targetFaction: '乙势力', casusBelli: 'holy', warId: 'w-old' }]), { turn: 6 });
  const joined = ctx.GM.activeWars.find(function(w){ return w.attacker === '甲势力' && w.defender === '乙势力'; });
  assert(joined && joined.parentWarId === 'w-old', 'B5: join_war honors specified warId=w-old (not array-first w-first / not latest)');
}
// B5b·inactive/ended warId 不合法：指定死战→拒 honor·回退最新活战；唯一涉目标战已结束→join 拒
function b5InactiveWarIdTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  ctx.GM.facs.push({ name: '丙' });
  ctx.GM.activeWars.push({ id: 'w-dead', attacker: '丙', defender: '乙势力', startTurn: 9, status: 'ended' });   // 残留死战(startTurn 最大)
  ctx.GM.activeWars.push({ id: 'w-live', attacker: '玩家朝廷', defender: '乙势力', startTurn: 4 });               // 进行中
  eng.applyDecision(ctx.GM.facs[0], mkDecision([{ type: 'join_war', targetFaction: '乙势力', casusBelli: 'holy', warId: 'w-dead' }]), { turn: 10 });
  const joined = ctx.GM.activeWars.find(function(w){ return w.attacker === '甲势力' && w.defender === '乙势力'; });
  assert(joined && joined.parentWarId === 'w-live', 'B5b: inactive warId=w-dead is rejected → falls back to latest ONGOING war (w-live), not the ended w-dead');
}
function b5AllInactiveRejectTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  ctx.GM.facs.push({ name: '丙' });
  ctx.GM.activeWars.push({ id: 'w-dead', attacker: '丙', defender: '乙势力', startTurn: 9, active: false });   // 残留(active:false)
  const sum = eng.applyDecision(ctx.GM.facs[0], mkDecision([{ type: 'join_war', targetFaction: '乙势力', casusBelli: 'holy' }]), { turn: 10 });
  assert(!sum.wars, 'B5b: when the only war involving target is inactive/ended, join_war is rejected (no ongoing war to join)');
}

// B7·过期是每回合必经：无新事件也过期(旧=清理挂在非空事件检查之后)
function b7UnconditionalExpireTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  const eng = ctx.TM.FactionActionEngine;
  const facA = ctx.GM.facs[0], facB = ctx.GM.facs[1];
  ctx.GM.currentIssues = [];
  eng.applyDecision(facA, mkDecision([{ type: 'declare_war', targetFaction: '乙势力', casusBelli: 'border' }]), { turn: 1 });
  assert(ctx.GM.currentIssues.filter(function(x){ return x && x._flw && x.status === 'pending'; }).length === 1, 'B7 setup: T1 event pending');
  // T2..T4：乙只做无世界事件的决策(fiscal)——过期须在此必经路径跑
  eng.applyDecision(facB, mkDecision([{ type: 'fiscal_policy', resource: 'money', treasuryDelta: 100, reason: 'x' }]), { turn: 2 });
  eng.applyDecision(facB, mkDecision([{ type: 'fiscal_policy', resource: 'money', treasuryDelta: 100, reason: 'x' }]), { turn: 3 });
  eng.applyDecision(facB, mkDecision([{ type: 'fiscal_policy', resource: 'money', treasuryDelta: 100, reason: 'x' }]), { turn: 4 });
  assert(!ctx.GM.currentIssues.some(function(x){ return x && x._flw && x.status === 'pending' && Number(x.raisedTurn) === 1; }), 'B7: T1 event expired by T4 even with NO new events (unconditional cleanup, not gated on emit)');
}
// B8·agent-mode + 总闸组合：功能不可达 + prompt 不注入新段(一致语义·消除半开)
function b8AgentModeInertTest() {
  const ctx = buildContext(); installCasusBelli(ctx);
  baseGM(ctx, { livingWorld: true });
  ctx.P.conf.agentModeEnabled = true;   // 进入 agent 模式(mode-b)
  const eng = ctx.TM.FactionActionEngine, fld = ctx.TM.FactionNpcLlmDecision;
  assert(ctx.agentModeOn() === true, 'B8 setup: agent-mode on');
  assert(eng.livingWorldOn() === false, 'B8: _livingWorldOn is false in agent-mode even with master ON (功能不可达)');
  assert(ctx.agentFlagOn('factionAgentEnabled') === false && ctx.agentFlagOn('factionGoalStackEnabled') === false, 'B8: master does NOT light sub-flags in agent-mode (no half-open)');
  assert(eng.formatActionContractForPrompt({ maxChars: 4000 }).indexOf('declare_war') < 0, 'B8: agent-mode+master → contract has no living-world types');
  const p = fld._buildPrompt(ctx.GM.facs[0]);
  assert((p.system + p.user).indexOf('declare_war') < 0 && p.user.indexOf('proposalResponses') < 0, 'B8: agent-mode+master → prompt injects no new sections/schema (no goalUpdates/proposalResponses without a consumer)');
  const sum = eng.applyDecision(ctx.GM.facs[0], mkDecision([{ type: 'declare_war', targetFaction: '乙势力', casusBelli: 'border' }]), { turn: 5 });
  assert(!sum.wars && ctx.CasusBelliSystem._calls.length === 0, 'B8: agent-mode+master → declare_war applier is a no-op (war unreachable)');
}

function main() {
  offZeroChangeTest();
  offOnDiffTest();
  onDeclareWarTest();
  onPlayerWarThresholdTest();
  onJoinWarTest();
  goalLifecycleOffTest();
  goalLifecycleOnTest();
  eventOffTest();
  eventOnDeclareWarTest();
  eventCapDedupTest();
  eventDiplomacyKindTest();
  b1ContractNotTruncatedTest();
  b8OffContractFilterTest();
  b2ResponseIdMatchTest();
  b3AllianceTreatyTest();
  b3bStableFactionIdentityTest();
  b4GoalStructureTest();
  b5JoinWarParentTest();
  b6PlayerCbFailClosedTest();
  b7EventBoundAndTitleTest();
  // Codex 二轮
  b2aDedupTermsTest();
  b2bSeqNoCollisionTest();
  b2cMatchFailClosedTest();
  b4MigrationTest();
  b5WarIdHonorTest();
  b5InactiveWarIdTest();
  b5AllInactiveRejectTest();
  b7UnconditionalExpireTest();
  b8AgentModeInertTest();
  console.log('[smoke-faction-living-world] all pass · ' + PASS + ' assertions');
}

try { main(); } catch (e) {
  console.error('[smoke-faction-living-world] ' + ((e && e.message) || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}
