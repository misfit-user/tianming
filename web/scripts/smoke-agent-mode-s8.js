'use strict';
// ============================================================
// smoke-agent-mode-s8.js — 「模式 b · agent 模式」S8 语义写工具守卫
//   验:adjust_treasury 走 FiscalEngine.spendFromGuoku/addToGuoku · appoint/dismiss 走 onAppointment/onDismissal
//       + 报账(_turnReport)+ 引擎让步标记 + 失败可见 + 通用工具描述引导硬核账走语义工具
// ============================================================

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
const WT = globalThis.TM.Endturn.AgentWriteTools;

const originalTools=['set_field','adjust_field','push_field','adjust_treasury','appoint_official','dismiss_official','remove_field','adjust_fiscal_item','resolve_battle','command_army','diplomatic_action','building_project','restructure_division','move_character','relocate_capital','change_region_owner','adjust_region_state'];
const explicitNewTools=['form_party','emerge_class','create_office'];
const actualTools=WT.defs().map(tool=>tool.name);
assert(actualTools.length===20&&new Set(actualTools).size===20&&originalTools.concat(explicitNewTools).every(name=>actualTools.includes(name)&&WT.isToolName(name)), '保留全部17个原工具及当前3个正式创建工具，无重复或遗漏');
assert(WT.isToolName('adjust_treasury') && WT.isToolName('remove_field') && WT.isToolName('adjust_fiscal_item') && WT.isToolName('command_army') && WT.isToolName('diplomatic_action') && WT.isToolName('building_project') && WT.isToolName('restructure_division'), 'isToolName 认全部语义工具(含四域)');

function makeGM() { return { turn: 7, guoku: { balance: 1000000, money: 1000000, grain: 500000 }, chars: [{ id: 'c1', name: '张三' }], _turnReport: [] }; }

(async function () {
  // ── adjust_treasury 走 FiscalEngine ──
  var gm = makeGM(); globalThis.GM = gm; var ctx = { GM: gm };
  var feCalls = [];
  globalThis.FiscalEngine = {
    spendFromGuoku: function (amt, tag) { feCalls.push({ fn: 'spend', amt: amt, tag: tag }); gm.guoku.money -= (amt.money || 0); gm.guoku.balance = gm.guoku.money; return { ok: true }; },
    addToGuoku: function (amt, tag) { feCalls.push({ fn: 'add', amt: amt, tag: tag }); gm.guoku.money += (amt.money || 0); gm.guoku.balance = gm.guoku.money; return { ok: true }; }
  };
  var r = await WT.handle('adjust_treasury', { delta: -50000, reason: '赈灾拨款' }, ctx);
  assert(r.ok && feCalls.length === 1 && feCalls[0].fn === 'spend' && feCalls[0].amt.money === 50000, 'adjust_treasury 负→spendFromGuoku({money:50000})');
  assert(gm.guoku.balance === 950000 && r.result.new === 950000, '国库真减(1000000→950000·balance 同步)');
  var te = gm._turnReport.find(function (e) { return e._op === 'treasury'; });
  assert(te && te.path === 'guoku.money' && te.old === 1000000 && te.new === 950000, 'treasury 报账条目(old/new 对)');
  assert(gm._agentOverrides && gm._agentOverrides['guoku'], 'treasury 打引擎让步标记');

  r = await WT.handle('adjust_treasury', { delta: 30000, currency: 'money', reason: '互市之利' }, ctx);
  assert(r.ok && feCalls[1].fn === 'add' && feCalls[1].amt.money === 30000 && gm.guoku.balance === 980000, 'adjust_treasury 正→addToGuoku({money:30000})');

  // 零/非法 delta → 拒
  r = await WT.handle('adjust_treasury', { delta: 0 }, ctx);
  assert(!r.ok && /零|非法/.test(r.result.reason || ''), 'adjust_treasury delta=0 → 拒');
  // FiscalEngine 缺失 → 拒(可见)
  delete globalThis.FiscalEngine;
  r = await WT.handle('adjust_treasury', { delta: -100, reason: 'x' }, ctx);
  assert(!r.ok && /FiscalEngine/.test(r.result.reason || ''), 'FiscalEngine 缺失 → 拒(可见)');

  // ── appoint_official 走 onAppointment ──
  var apCalls = [];
  globalThis.onAppointment = function (name, pos) { apCalls.push({ name: name, pos: pos }); return { ok: true }; };
  r = await WT.handle('appoint_official', { name: '李四', position: '户部尚书', reason: '才堪大用' }, ctx);
  assert(r.ok && apCalls.length === 1 && apCalls[0].name === '李四' && apCalls[0].pos === '户部尚书', 'appoint_official 走 onAppointment(name,position)');
  var pe = gm._turnReport.find(function (e) { return e._op === 'appoint'; });
  assert(pe && /李四/.test(pe.path) && pe.new === '户部尚书', 'appoint 报账条目');
  // onAppointment {ok:false} → 失败可见
  globalThis.onAppointment = function () { return { ok: false, reason: '未找到角色' }; };
  r = await WT.handle('appoint_official', { name: '查无此人', position: '太傅' }, ctx);
  assert(!r.ok && /未找到/.test(r.result.reason || ''), 'onAppointment {ok:false} → 失败可见');
  assert((gm._agentWriteFailed || []).some(function (f) { return f.op === 'appoint'; }), '任命失败入 _agentWriteFailed');

  // ── dismiss_official 走 onDismissal ──
  var dmCalls = [];
  // 刀C·返工二轮issue1：onDismissal 契约 3 参(name,reason,aiOutput)·agent 语义写传显式标记令死亡收口闸判源经 GM 而非 fail-open。
  globalThis.onDismissal = function (name, reason, aiOutput) { dmCalls.push({ name: name, reason: reason, aiOutput: aiOutput }); return { ok: true }; };
  r = await WT.handle('dismiss_official', { name: '王五', reason: '渎职' }, ctx);
  assert(r.ok && dmCalls[0].name === '王五' && dmCalls[0].reason === '渎职', 'dismiss_official 走 onDismissal(name,reason)');
  assert(dmCalls[0].aiOutput && dmCalls[0].aiOutput._agentWrite === true, 'dismiss_official 传第3参 aiOutput 标记(死亡收口闸判源不 fail-open)');
  assert(gm._turnReport.some(function (e) { return e._op === 'dismiss'; }), 'dismiss 报账条目');

  // ── remove_field 删数组项(推演后果·部队覆灭/党派清洗)+ 玩家保护 ──
  var gmR = { turn: 7, parties: [{ id: 'p1', name: '阉党' }, { id: 'p2', name: '东林' }], armies: [{ name: '关宁军' }, { name: '溃军' }], playerFactionId: 'p2', _turnReport: [] };
  var rc = { GM: gmR };
  r = await WT.handle('remove_field', { path: 'parties', match: '阉党', reason: '党争清洗' }, rc);
  assert(r.ok && gmR.parties.length === 1 && gmR.parties[0].name === '东林', 'remove_field 按 match 删数组项(阉党被清洗)');
  assert(gmR._turnReport.some(function (e) { return e._op === 'remove' && /已删除/.test(e.new || ''); }), 'remove_field 报账(已删除)');
  r = await WT.handle('remove_field', { path: 'armies', index: 1, reason: '部队覆灭' }, rc);
  assert(r.ok && gmR.armies.length === 1 && gmR.armies[0].name === '关宁军', 'remove_field 按 index 删(溃军覆灭)');
  // 玩家保护:禁删玩家势力
  r = await WT.handle('remove_field', { path: 'parties', match: '东林' }, rc);  // 东林 id=p2=playerFactionId
  assert(!r.ok && /玩家/.test(r.result.reason || '') && gmR.parties.length === 1, 'remove_field 禁删玩家势力');
  // 非数组/未找到 → 拒(可见)
  r = await WT.handle('remove_field', { path: 'guoku', index: 0 }, rc);
  assert(!r.ok, 'remove_field 非数组路径 → 拒');
  r = await WT.handle('remove_field', { path: 'armies', match: '查无此军' }, rc);
  assert(!r.ok && /未找到/.test(r.result.reason || ''), 'remove_field 未找到项 → 拒(可见)');

  // ── adjust_fiscal_item 增/改/停/删收入支出项(复用 applier fiscal_adjustments·零 drift) ──
  var gmF = { turn: 7, guoku: { balance: 1000000, money: 1000000 }, _turnReport: [] }; var fc = { GM: gmF };
  var capturedFa = null;
  globalThis.applyAITurnChanges = function (out) { capturedFa = (out && out.fiscal_adjustments) || null; gmF._turnReport.push({ type: 'fiscal_adj', name: capturedFa && capturedFa[0] && capturedFa[0].name }); return { ok: true }; };
  r = await WT.handle('adjust_fiscal_item', { kind: 'income', name: '盐税', amount: 100000, recurring: true, reason: '开盐税增收' }, fc);
  assert(r.ok && capturedFa && capturedFa[0].kind === 'income' && capturedFa[0].name === '盐税' && capturedFa[0].amount === 100000 && capturedFa[0].recurring === true, 'adjust_fiscal_item 增收入项·正确路由 applyAITurnChanges(kind/name/amount/recurring)');
  assert(gmF._turnReport.some(function (e) { return e._op === 'fiscal_item'; }), 'fiscal_item 报账(_agent 标)');
  r = await WT.handle('adjust_fiscal_item', { kind: 'expense', action: 'add', name: '辽东军费', amount: 200000, target: 'guoku', reason: '军费' }, fc);
  assert(r.ok && capturedFa[0].kind === 'expense' && capturedFa[0].name === '辽东军费', 'adjust_fiscal_item 增支出项');
  r = await WT.handle('adjust_fiscal_item', { kind: 'expense', action: 'stop', name: '辽东军费', reason: '停发' }, fc);
  assert(r.ok && capturedFa[0].action === 'stop', 'adjust_fiscal_item 停发(action=stop)');
  // 缺 kind / 增改缺正 amount → 拒
  r = await WT.handle('adjust_fiscal_item', { name: 'x' }, fc);
  assert(!r.ok && /kind/.test(r.result.reason || ''), 'adjust_fiscal_item 缺 kind → 拒');
  r = await WT.handle('adjust_fiscal_item', { kind: 'income', amount: 0 }, fc);
  assert(!r.ok && /amount/.test(r.result.reason || ''), 'adjust_fiscal_item 增收缺正 amount → 拒');
  // applyAITurnChanges 缺失 → 拒(可见)
  delete globalThis.applyAITurnChanges;
  r = await WT.handle('adjust_fiscal_item', { kind: 'income', name: 'y', amount: 100 }, fc);
  assert(!r.ok && /applyAITurnChanges/.test(r.result.reason || ''), 'applyAITurnChanges 缺失 → 拒(可见)');

  // ── ② 军事 command_army → applyAIArmyChange ──
  var gmM = { turn: 7, armies: [{ name: '关宁军', soldiers: 80000 }], _turnReport: [] }; var mc = { GM: gmM };
  var armyCh = null; globalThis.applyAIArmyChange = function (ch) { armyCh = ch; return { ok: true, name: ch.armyName }; };
  r = await WT.handle('command_army', { armyName: '关宁军', soldiersDelta: 20000, location: '宁远', reason: '募兵移防' }, mc);
  assert(r.ok && armyCh.armyName === '关宁军' && armyCh.soldiers_delta === 20000 && armyCh.location === '宁远', 'command_army 募兵+调动→applyAIArmyChange(armyName/soldiers_delta/location)');
  assert(gmM._turnReport.some(function (e) { return e._op === 'army'; }), 'command_army 报账');
  r = await WT.handle('command_army', { reason: 'x' }, mc);
  assert(!r.ok && /armyName/.test(r.result.reason || ''), 'command_army 缺 armyName → 拒');

  // ── ③ 外交 diplomatic_action → declareWar/endWar/setFactionRelation ──
  var gmD = { turn: 7, activeWars: [{ id: 'w1', attacker: '明', defender: '后金' }], _turnReport: [] }; var dc = { GM: gmD };
  var warArgs = null; globalThis.declareWar = function (a, d, cb) { warArgs = { a: a, d: d, cb: cb }; return { success: true }; };
  var endArgs = null; globalThis.endWar = function (id) { endArgs = id; return { ok: true }; };
  var relArgs = null; globalThis.setFactionRelation = function (f, t, patch) { relArgs = { f: f, t: t, patch: patch }; return { ok: true }; };
  r = await WT.handle('diplomatic_action', { action: 'declare_war', attacker: '明', defender: '蒙古', casusBelli: '边衅', reason: '宣战' }, dc);
  assert(r.ok && warArgs.a === '明' && warArgs.d === '蒙古' && warArgs.cb === '边衅', 'diplomatic_action declare_war→declareWar(attacker/defender/cb)');
  r = await WT.handle('diplomatic_action', { action: 'make_peace', attacker: '明', defender: '后金', reason: '议和' }, dc);
  assert(r.ok && endArgs === 'w1', 'diplomatic_action make_peace→endWar(按 attacker+defender 定位 warId=w1)');
  r = await WT.handle('diplomatic_action', { action: 'set_relation', from: '明', to: '朝鲜', value: 60, reason: '厚结' }, dc);
  assert(r.ok && relArgs.f === '明' && relArgs.t === '朝鲜' && relArgs.patch.value === 60, 'diplomatic_action set_relation→setFactionRelation(from/to/patch.value)');

  // ── ④ 建筑 building_project + ① 区划 restructure_division(adminHierarchy 区划树)──
  var gmB = { turn: 7, adminHierarchy: { '明': { divisions: [{ name: '辽东镇', regionType: 'zhen', buildings: [], children: [{ name: '宁远', regionType: 'county' }] }] } }, _turnReport: [] };
  globalThis.TM = globalThis.TM || {}; globalThis.TM.BuildingWorks = { revertBuilding: function () {} };
  var bc = { GM: gmB };
  r = await WT.handle('building_project', { action: 'start', region: '宁远', name: '宁远卫城', turns: 4, cost: 50000, reason: '修边堡' }, bc);
  var ningyuan = gmB.adminHierarchy['明'].divisions[0].children[0];
  assert(r.ok && Array.isArray(ningyuan.buildings) && ningyuan.buildings[0].name === '宁远卫城' && ningyuan.buildings[0].status === 'building' && ningyuan.buildings[0].remainingTurns === 4, 'building_project start→区划树定位宁远·push 工程(status=building/工期4)');
  r = await WT.handle('building_project', { action: 'demolish', region: '宁远', name: '宁远卫城', reason: '废弃' }, bc);
  assert(r.ok && ningyuan.buildings.length === 0, 'building_project demolish→拆毁(revertBuilding+移除)');
  r = await WT.handle('building_project', { action: 'start', region: '查无此地', name: 'x' }, bc);
  assert(!r.ok && /未找到地块/.test(r.result.reason || ''), 'building_project 地块不存在 → 拒');
  // 区划改制
  r = await WT.handle('restructure_division', { action: 'modify', region: '辽东镇', fields: { regionType: 'dusi', governor: '袁崇焕' }, reason: '升都司' }, bc);
  assert(r.ok && gmB.adminHierarchy['明'].divisions[0].regionType === 'dusi' && gmB.adminHierarchy['明'].divisions[0].governor === '袁崇焕', 'restructure_division modify→改 regionType/governor');
  r = await WT.handle('restructure_division', { action: 'add', parent: '辽东镇', name: '锦州', regionType: 'county', reason: '设县' }, bc);
  assert(r.ok && gmB.adminHierarchy['明'].divisions[0].children.some(function (c) { return c.name === '锦州'; }), 'restructure_division add→在辽东镇下设锦州');
  r = await WT.handle('restructure_division', { action: 'remove', region: '锦州', reason: '废县' }, bc);
  assert(r.ok && !gmB.adminHierarchy['明'].divisions[0].children.some(function (c) { return c.name === '锦州'; }), 'restructure_division remove→废锦州');

  // ── 通用工具仍在(回归)+ 描述引导硬核账走语义工具 ──
  var setDef = WT.DEFS.find(function (d) { return d.name === 'set_field'; });
  assert(/adjust_treasury|appoint_official/.test(setDef.description), 'set_field 描述引导硬核账走语义工具');
  // 源码:agent-mode prompt 也引导
  var amSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-agent-mode.js'), 'utf8');
  assert(amSrc.indexOf('adjust_treasury') >= 0 && amSrc.indexOf('appoint_official') >= 0, 'agent-mode system prompt 引导用语义工具');

  console.log('[smoke-agent-mode-s8] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
