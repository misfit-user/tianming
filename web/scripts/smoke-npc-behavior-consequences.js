#!/usr/bin/env node
// smoke-npc-behavior-consequences.js
// 验证「~23 种 prompt 已承诺、apply 层却落空(纯叙事零后果)的 NPC behaviorType」现已接上机械后果。
// 手法:把 tm-endturn-apply.js 里**真实**的 behaviorType if-else 链切片出来包成 applyOne()·
//        用 spy 桩(AffinityMap/loyalty/stress/face/memory/armies)实跑·断言落地——非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } }

const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');

// ── 切出真 helper(_NPC_BEHAVIOR_CN + _npcBehaviorVerbCN) ──
const hA = src.indexOf('var _NPC_BEHAVIOR_CN');
const hEnd = src.indexOf('}', src.indexOf('function _edictTypeCN'));
ok(hA >= 0 && hEnd > hA, 'apply.js 含 behaviorType helper 段');
const helperSeg = src.slice(hA, hEnd + 1);

// ── 切出真 behaviorType if-else 链(appoint…desert·到"位置移动"注释前) ──
const cStart = src.indexOf("if (act.behaviorType === 'appoint' && act.target) {");
// 延到"连锁记忆"通用块之后(含 _bKnow 公开互动 B 侧知情记忆)·位置移动块被 act.new_location 守卫·行为测试恒跳过
const cStop = src.indexOf('// 无论是否机械执行，都记录事件');
ok(cStart >= 0 && cStop > cStart, 'apply.js 含 behaviorType if-else 链');
let chain = src.slice(cStart, cStop).trimEnd();
// 链尾应是闭合 `}`(去掉尾随空白后)

// ── 同一 ctx 里:先装 helper·再用真链体定义 applyOne ──
const ctx = { Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Boolean: Boolean, isFinite: isFinite };
vm.createContext(ctx);
vm.runInContext(helperSeg, ctx, { filename: 'helpers.js' });
ok(typeof ctx._npcBehaviorVerbCN === 'function', '_npcBehaviorVerbCN 装载');
ok(ctx._npcBehaviorVerbCN('petition_jointly') === '联名上书', 'petition_jointly→联名上书(CN表已补)·实=' + ctx._npcBehaviorVerbCN('petition_jointly'));

const applyWrap = 'function applyOne(act, env) {\n' +
  '  var GM = env.GM, AffinityMap = env.AffinityMap, findCharByName = env.findCharByName,\n' +
  '      adjustCharacterLoyalty = env.adjustCharacterLoyalty, NpcMemorySystem = env.NpcMemorySystem, FaceSystem = env.FaceSystem;\n' +
  '  var mechanicallyExecuted = false;\n' +
  '  ' + chain + '\n' +
  '  return mechanicallyExecuted;\n' +
  '}';
vm.runInContext(applyWrap, ctx, { filename: 'applyOne.js' });
ok(typeof ctx.applyOne === 'function', 'applyOne(真链体) 装载成功');

// ── spy 环境工厂 ──
function mkEnv(chars, armies) {
  const aff = [];
  const env = {
    GM: { chars: chars, armies: armies || [] },
    AffinityMap: { add: function (a, b, d, r) { aff.push({ a: a, b: b, d: d, r: r }); } },
    findCharByName: function (n) { return chars.find(function (c) { return c.name === n; }) || null; },
    adjustCharacterLoyalty: function (ch, d, r, o) { ch.loyalty = Math.max(0, Math.min(100, (ch.loyalty == null ? 50 : ch.loyalty) + d)); ch._lastLoyR = r; return { ok: true }; },
    NpcMemorySystem: { remember: function (who, ev, emo, imp, src) { var c = chars.find(function (x) { return x.name === who; }); if (c) { c._memory = c._memory || []; c._memory.push({ event: ev, emotion: emo, importance: imp }); } } },
    FaceSystem: { loseFace: function (ch, amt, r) { ch._face = (ch._face == null ? 100 : ch._face) - amt; } },
    _aff: aff
  };
  return env;
}
function affFind(env, a, b) { return env._aff.find(function (x) { return x.a === a && x.b === b; }); }

// ════════ 社交结好家族 ════════
(function () {
  var chars = [{ name: '甲' }, { name: '乙', loyalty: 50 }];
  var env = mkEnv(chars);
  var me = ctx.applyOne({ name: '甲', action: '馈赠古玩', target: '乙', behaviorType: 'gift_present' }, env);
  ok(me === true, 'gift_present mechanicallyExecuted=true(旧为 narrative_only)');
  ok(affFind(env, '甲', '乙').d === 6, 'gift_present 甲→乙 亲疏+6·实=' + (affFind(env, '甲', '乙') || {}).d);
  // ★2026-07-04 AffinityMap 对称无向图·单次 add 即双向·不再调反向(原 0.6× 回拢会落同边叠成 1.6×·系误解)
  ok(!affFind(env, '乙', '甲'), 'gift_present 对称图·无独立反向 add(原 round(6*0.6)=4 已删)·实=' + JSON.stringify(affFind(env, '乙', '甲')));
})();
(function () {
  var chars = [{ name: '师' }, { name: '徒', loyalty: 50 }];
  var env = mkEnv(chars);
  ctx.applyOne({ name: '师', action: '收徒', target: '徒', behaviorType: 'master_disciple' }, env);
  ok(affFind(env, '师', '徒').d === 12, 'master_disciple 师→徒 +12(强纽带)·实=' + (affFind(env, '师', '徒') || {}).d);
  ok(chars[1].loyalty === 53, 'master_disciple 徒 loyalty +3·实=' + chars[1].loyalty);
})();

// ════════ 倾轧构陷家族 ════════
(function () {
  var chars = [{ name: '甲' }, { name: '乙', loyalty: 50, stress: 0, _face: 100 }];
  var env = mkEnv(chars);
  var me = ctx.applyOne({ name: '甲', action: '构陷', target: '乙', behaviorType: 'frame_up' }, env);
  ok(me === true, 'frame_up mechanicallyExecuted=true');
  ok(chars[1].loyalty === 44, 'frame_up 乙 loyalty-6·实=' + chars[1].loyalty);
  ok(chars[1].stress === 12, 'frame_up 乙 stress+12·实=' + chars[1].stress);
  ok(chars[1]._face === 88, 'frame_up 乙 掉面子12·实=' + chars[1]._face);
  ok(affFind(env, '乙', '甲').d === -15, 'frame_up 乙→甲 亲疏-15·实=' + (affFind(env, '乙', '甲') || {}).d);
  ok((chars[1]._memory || []).length === 1, 'frame_up 乙 记一条受害记忆');
})();
(function () {
  var chars = [{ name: '甲', stress: 0 }, { name: '乙', stress: 0 }];
  var env = mkEnv(chars);
  ctx.applyOne({ name: '甲', action: '当廷对质', target: '乙', behaviorType: 'confront' }, env);
  ok(affFind(env, '甲', '乙').d === -8 && !affFind(env, '乙', '甲'), 'confront 对称图·单次-8 即双向交恶(原调两次叠成-16)·实=' + (affFind(env, '甲', '乙')||{}).d + '/' + JSON.stringify(affFind(env, '乙', '甲')));
  ok(chars[1].stress === 5 && chars[0].stress === 3, 'confront 乙stress+5/甲stress+3·实=' + chars[1].stress + '/' + chars[0].stress);
})();

// ════════ 弹劾家族 ════════
(function () {
  var chars = [{ name: '言官' }, { name: '权臣', stress: 0 }];
  var env = mkEnv(chars);
  ctx.applyOne({ name: '言官', action: '联名上书劾权臣', target: '权臣', behaviorType: 'petition_jointly' }, env);
  ok(chars[1].stress === 8, 'petition_jointly 被劾者 stress+8·实=' + chars[1].stress);
  ok(affFind(env, '言官', '权臣').d === -8, 'petition_jointly 亲疏-8');
})();

// ════════ 缔结/举荐/调和家族 ════════
(function () {
  var chars = [{ name: '甲' }, { name: '乙', loyalty: 50 }];
  var env = mkEnv(chars);
  ctx.applyOne({ name: '甲', action: '联姻', target: '乙', behaviorType: 'marriage_alliance' }, env);
  ok(affFind(env, '甲', '乙').d === 15 && !affFind(env, '乙', '甲'), 'marriage_alliance 对称图·单次+15 即双向缔结(原调两次叠成+30)·实=' + (affFind(env, '甲', '乙')||{}).d + '/' + JSON.stringify(affFind(env, '乙', '甲')));
  ok(chars[1].loyalty === 53, 'marriage_alliance 乙 loyalty+3·实=' + chars[1].loyalty);
})();
(function () {
  var chars = [{ name: '举主' }, { name: '后进' }];
  var env = mkEnv(chars);
  ctx.applyOne({ name: '举主', action: '举荐后进入台省', target: '后进', behaviorType: 'recommend' }, env);
  ok(affFind(env, '后进', '举主').d === 8, 'recommend 后进→举主 荐拔之恩+8·实=' + (affFind(env, '后进', '举主') || {}).d);
})();
(function () {
  var chars = [{ name: '甲' }, { name: '乙' }];
  var env = mkEnv(chars);
  ctx.applyOne({ name: '甲', action: '居中调和', target: '乙', behaviorType: 'mediate' }, env);
  ok(affFind(env, '甲', '乙').d === 6, 'mediate 调和+6(弱化版和解)·实=' + (affFind(env, '甲', '乙') || {}).d);
})();

// ════════ 军事家族(recruit/desert + fortify 修 no-op) ════════
(function () {
  var armies = [{ name: '甲营', commander: '甲', morale: 50, training: 50 }];
  var env = mkEnv([{ name: '甲' }], armies);
  ctx.applyOne({ name: '甲', action: '募兵', behaviorType: 'recruit' }, env);
  ok(armies[0].morale === 53, 'recruit 甲营 morale+3·实=' + armies[0].morale);
})();
(function () {
  var armies = [{ name: '乙营', commander: '乙', morale: 50, training: 50 }];
  var env = mkEnv([{ name: '乙' }], armies);
  ctx.applyOne({ name: '乙', action: '哗变', behaviorType: 'desert' }, env);
  ok(armies[0].morale === 44 && armies[0].training === 45, 'desert 乙营 morale-6/training-5·实=' + armies[0].morale + '/' + armies[0].training);
})();
(function () {
  var armies = [{ name: '丙营', commander: '丙', morale: 50, fortification: 30 }];
  var env = mkEnv([{ name: '丙' }], armies);
  var me = ctx.applyOne({ name: '丙', action: '加固城防', behaviorType: 'fortify' }, env);
  ok(me === true && armies[0].morale === 52 && armies[0].fortification === 35, 'fortify 修 no-op:丙营 morale+2/城防+5·实=' + armies[0].morale + '/' + armies[0].fortification);
})();

// ════════ 回归:旧分支未被切片破坏(reward 仍生效) ════════
(function () {
  var chars = [{ name: '甲' }, { name: '乙', loyalty: 50 }];
  var env = mkEnv(chars);
  var me = ctx.applyOne({ name: '甲', action: '赏赐', target: '乙', behaviorType: 'reward' }, env);
  ok(me === true && chars[1].loyalty === 55 && affFind(env, '乙', '甲').d === 10, '回归:reward 旧分支仍 乙loyalty+5/亲疏+10·实=' + chars[1].loyalty);
})();

// ════════ 交互双向性(2026-07-04)·公开互动当事人(B)得 imp>=6 知情记忆·covert 不提权 ════════
// 注:本 harness 的 NpcMemorySystem mock 不做自动镜像·故 B 侧记忆全来自代码里的**显式** remember(target,...)。
function bMemMaxImp(env, name) { var c = env.GM.chars.find(function (x) { return x.name === name; }); var ms = (c && c._memory) || []; return ms.reduce(function (m, e) { return Math.max(m, e.importance || 0); }, 0); }
function bMemHas(env, name, kw, minImp) { var c = env.GM.chars.find(function (x) { return x.name === name; }); return ((c && c._memory) || []).some(function (e) { return (e.importance || 0) >= minImp && String(e.event || '').indexOf(kw) >= 0; }); }
(function () {
  var env = mkEnv([{ name: '甲' }, { name: '乙', loyalty: 50 }]);
  ctx.applyOne({ name: '甲', action: '罢黜乙', target: '乙', behaviorType: 'dismiss' }, env);
  ok(bMemHas(env, '乙', '罢黜', 6), '公开·dismiss:被罢者乙得 imp>=6「遭甲罢黜」知情记忆(过推演门槛)·实 maxImp=' + bMemMaxImp(env, '乙'));
})();
(function () {
  var env = mkEnv([{ name: '甲' }, { name: '乙', loyalty: 50 }]);
  ctx.applyOne({ name: '甲', action: '上疏参劾乙', target: '乙', behaviorType: 'petition' }, env);
  ok(bMemHas(env, '乙', '参劾', 6), '公开·petition:被参劾者乙得 imp>=6 知情记忆·实 maxImp=' + bMemMaxImp(env, '乙'));
})();
(function () {
  var env = mkEnv([{ name: '甲' }, { name: '乙', loyalty: 50 }]);
  ctx.applyOne({ name: '甲', action: '登门私访乙', target: '乙', behaviorType: 'private_visit' }, env);
  ok(bMemHas(env, '乙', '私访', 6), '公开·private_visit:受访者乙得 imp>=6 知情记忆·实 maxImp=' + bMemMaxImp(env, '乙'));
})();
(function () {
  // covert·slander(诽谤中伤)不在 _bKnow·不给被中伤者 imp6 知情记忆(维持隐蔽·mock 无镜像故应无记忆)
  var env = mkEnv([{ name: '甲' }, { name: '乙', loyalty: 50 }]);
  ctx.applyOne({ name: '甲', action: '散布乙的谣言', target: '乙', behaviorType: 'slander' }, env);
  ok(bMemMaxImp(env, '乙') < 6, 'covert·slander:被中伤者乙无 imp>=6 知情记忆(不提权·维持半隐蔽)·实 maxImp=' + bMemMaxImp(env, '乙'));
})();
// 契约:公开互动 B 侧知情记忆表存在·covert 类被排除
ok(!/slander:\[|betray:\[|frame_up:\[|expose_secret:\[/.test(src), '契约:_bKnow 不含 covert(slander/betray/frame_up/expose_secret)');
// codex 修:covert 的通用 actor 记忆加 _noMirror·堵住镜像泄露 imp4 给被算计者
// codex 修:廷议 winDir 从权威裁决 actualDirection 推(含加权票+override)·非人头票 counts

console.log('[smoke-npc-behavior-consequences] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
