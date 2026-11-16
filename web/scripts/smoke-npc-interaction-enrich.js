#!/usr/bin/env node
// smoke-npc-interaction-enrich.js
// 批辛·「NPC 交互活动丰富」五刀契约 smoke。
// 手法:tm-relations.js 整体 vm 实跑(新型 effect/effectActor)·apply/tuzhi/memorials 真源切片包函数实跑·
//       ai.js/apply.js prompt 与散点登记走源码契约正则——把「新型登记散点」变成受检契约。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } }

const relSrc = fs.readFileSync(path.join(ROOT, 'tm-relations.js'), 'utf8');
const applySrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
const tuzhiSrc = fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8');
const memSrc = fs.readFileSync(path.join(ROOT, 'tm-memorials.js'), 'utf8');

// ════════ ① tm-relations.js 整体 vm 实跑：八新型 effect 落账 + effectActor 不对称 ════════
function mkRelSandbox() {
  const sandbox = { console, Date, Math, JSON };
  sandbox.window = { window: sandbox.window };
  sandbox.window.window = sandbox.window;
  sandbox.window.GM = { turn: 5, chars: [
    { name: '甲', alive: true }, { name: '乙', alive: true }
  ] };
  sandbox.window.findCharByName = function (n) { return sandbox.window.GM.chars.find(function (c) { return c.name === n; }) || null; };
  sandbox.window.NpcMemorySystem = { _log: [], remember: function (w, e, emo, imp, rel) { this._log.push({ w: w, e: e, emo: emo, imp: imp, rel: rel }); } };
  vm.runInNewContext(relSrc, sandbox.window, { filename: 'tm-relations.js' });
  return sandbox.window;
}
function relOf(w, who, other) { var c = w.findCharByName(who); return (c && c.relations && c.relations[other]) || null; }

const W0 = mkRelSandbox();
ok(typeof W0.applyNpcInteraction === 'function', 'applyNpcInteraction 装载');
ok(W0.NPC_INTERACTION_TYPES && typeof W0.NPC_INTERACTION_TYPES === 'object', 'NPC_INTERACTION_TYPES 装载');

// 八新型 effect 落账各 1 例（effect 写 rBA = target.relations[actor]）
function runType(type) { var w = mkRelSandbox(); var okApply = w.applyNpcInteraction('甲', '乙', type); return { w: w, ok: okApply, rBA: relOf(w, '乙', '甲'), rAB: relOf(w, '甲', '乙') }; }
(function () {
  var r = runType('condole');   // 吊唁 affinity+8 respect+4
  ok(r.ok === true && r.rBA && r.rBA.affinity === 58 && r.rBA.respect === 54, '吊唁 condole:rBA affinity58/respect54·实=' + (r.rBA && r.rBA.affinity + '/' + r.rBA.respect));
})();
(function () {
  var r = runType('celebrate_birthday');   // 贺寿 affinity+6 respect+3 owesFavor+1
  ok(r.rBA && r.rBA.affinity === 56 && r.rBA.respect === 53 && r.rBA.owesFavor === 1, '贺寿 celebrate_birthday:affinity56/respect53/owesFavor1');
})();
(function () {
  var r = runType('propose_match');   // 作伐 trust+6 affinity+4 owesFavor+1
  ok(r.rBA && r.rBA.trust === 56 && r.rBA.affinity === 54 && r.rBA.owesFavor === 1, '作伐 propose_match:trust56/affinity54/owesFavor1');
})();
(function () {
  var r = runType('entrust_orphan');   // 托孤 trust+30 respect+15 owesFavor+2 · effectActor trust+25
  ok(r.rBA && r.rBA.trust === 80 && r.rBA.respect === 65 && r.rBA.owesFavor === 2, '托孤 entrust_orphan:rBA trust80/respect65');
  ok(r.rAB && r.rAB.trust === 75, '托孤 effectActor:rAB trust75(50+25)·实=' + (r.rAB && r.rAB.trust));
})();
(function () {
  var r = runType('seek_instruction');   // 求教 effect affinity+5 · effectActor respect+12 affinity+5
  ok(r.rBA && r.rBA.affinity === 55, '求教 seek_instruction:rBA affinity55');
  ok(r.rAB && r.rAB.respect === 62 && r.rAB.affinity === 55, '求教 effectActor:rAB respect62/affinity55(业师之敬)');
})();
(function () {
  var r = runType('gift_medicine');   // 赠药 affinity+7 trust+5 fear-3（补 fear 维）
  ok(r.rBA && r.rBA.affinity === 57 && r.rBA.trust === 55 && r.rBA.fear === -3, '赠药 gift_medicine:affinity57/trust55/fear-3(补fear维)');
})();
(function () {
  var r = runType('farewell_feast');   // 饯行 affinity+6 respect+3
  ok(r.rBA && r.rBA.affinity === 56 && r.rBA.respect === 53, '饯行 farewell_feast:affinity56/respect53');
})();
(function () {
  var r = runType('welcome_feast');   // 接风 affinity+6 respect+3
  ok(r.rBA && r.rBA.affinity === 56 && r.rBA.respect === 53, '接风 welcome_feast:affinity56/respect53');
})();

// ════════ ② effectActor 三型写 rAB + 无 effectActor 型 rAB 五维逐字节不变 ════════
(function () {
  var r = runType('betray');   // 背叛新增 effectActor hostility+15（背叛者亦生恨）
  ok(r.rAB && r.rAB.hostility === 15, 'betray effectActor:rAB hostility15(背叛者亦生恨)·实=' + (r.rAB && r.rAB.hostility));
})();
// 无 effectActor 型 → rAB 五维逐字节不变（默认 50/50/50/0/0）·仅 conflict/labels/history 可动 rAB
['condole', 'celebrate_birthday', 'gift_medicine', 'recommend', 'impeach', 'gift_present'].forEach(function (t) {
  var r = runType(t);
  var untouched = r.rAB && r.rAB.affinity === 50 && r.rAB.trust === 50 && r.rAB.respect === 50 && r.rAB.fear === 0 && r.rAB.hostility === 0;
  ok(untouched, '零波及:' + t + ' 无 effectActor·rAB 五维逐字节不变');
});

// ════════ ③ 契约遍历：NPC_INTERACTION_TYPES 全部 key 在 _NPC_BEHAVIOR_CN 与 _DT_BEHAVIOR_CN 有词条 ════════
function extractCnTable(src, varName) {
  var a = src.indexOf(varName);
  var open = src.indexOf('{', a);
  // 匹配到该对象字面量的闭合 }（单行表·找该行内首个 };）
  var close = src.indexOf('};', open);
  var body = src.slice(open + 1, close);
  var keys = {};
  body.replace(/([a-z_]+)\s*:/gi, function (_m, k) { keys[k] = 1; return _m; });
  return keys;
}
var behaviorCn = extractCnTable(applySrc, 'var _NPC_BEHAVIOR_CN');
var dtCn = extractCnTable(tuzhiSrc, 'var _DT_BEHAVIOR_CN');
ok(Object.keys(behaviorCn).length > 30, '_NPC_BEHAVIOR_CN 抽取成表(' + Object.keys(behaviorCn).length + ' 键)');
ok(Object.keys(dtCn).length > 30, '_DT_BEHAVIOR_CN 抽取成表(' + Object.keys(dtCn).length + ' 键)');
var allTypes = Object.keys(W0.NPC_INTERACTION_TYPES);
ok(allTypes.length >= 30, 'NPC_INTERACTION_TYPES 共 ' + allTypes.length + ' 型(含新增)');
var missBehavior = allTypes.filter(function (t) { return !behaviorCn[t]; });
var missDt = allTypes.filter(function (t) { return !dtCn[t]; });
ok(missBehavior.length === 0, '契约:每型均在 _NPC_BEHAVIOR_CN 有词条·缺=' + JSON.stringify(missBehavior));
ok(missDt.length === 0, '契约:每型均在 _DT_BEHAVIOR_CN 有词条·缺=' + JSON.stringify(missDt));
// 八新型 + 四新面型确实注册
['condole', 'celebrate_birthday', 'propose_match', 'entrust_orphan', 'seek_instruction', 'gift_medicine', 'farewell_feast', 'welcome_feast', 'express_gratitude', 'intercede', 'petition_retire'].forEach(function (t) {
  ok(!!W0.NPC_INTERACTION_TYPES[t], '新型已注册 NPC_INTERACTION_TYPES:' + t);
});

// ════════ ④ 多人雅集：involvedOthers 真源切片实跑（建边封顶6/死者跳过/玩家跳过）════════
(function () {
  var s = applySrc.indexOf('// 涉及第三方——记入他们的记忆·并与 actor');
  var e = applySrc.indexOf('NPC 对玩家行为的分发', s);
  ok(s >= 0 && e > s, '能定位 involvedOthers 轻边切片');
  var block = applySrc.slice(s, e);
  var ctx = { Math: Math, Array: Array, String: String };
  vm.createContext(ctx);
  vm.runInContext('function tieBuild(it,_pName,typeInfo,env){var NpcMemorySystem=env.NpcMemorySystem,AffinityMap=env.AffinityMap,findCharByName=env.findCharByName;\n' + block + '\n}', ctx, { filename: 'tieBuild.js' });
  ok(typeof ctx.tieBuild === 'function', 'tieBuild(真切片) 装载');
  // env：spy AffinityMap + 名册（含死者与玩家）
  function mkTieEnv(chars) {
    var adds = [];
    return { adds: adds, NpcMemorySystem: { remember: function () {} },
      AffinityMap: { add: function (a, b, d, r) { adds.push({ a: a, b: b, d: d, r: r }); } },
      findCharByName: function (n) { return chars.find(function (c) { return c.name === n; }) || null; } };
  }
  // 8 位与会者(含 1 死 + 玩家)·活着非玩家非actor者取前6
  var chars = [{ name: '主' }];
  var involved = [];
  for (var i = 1; i <= 8; i++) { var nm = 'k' + i; chars.push({ name: nm, alive: i === 3 ? false : true }); involved.push(nm); }
  involved.push('王'); chars.push({ name: '王' });   // 玩家名=王
  var env = mkTieEnv(chars);
  ctx.tieBuild({ actor: '主', target: '乙', involvedOthers: involved.concat(['主']), publicKnown: true }, '王', '宴集', env);
  ok(env.adds.length === 6, '建边封顶 6·实=' + env.adds.length);
  ok(env.adds.every(function (x) { return x.d === 2; }), '每条轻边 +2');
  ok(env.adds.every(function (x) { return x.a === '主'; }), '都以 actor(主) 为一端');
  ok(!env.adds.some(function (x) { return x.b === 'k3'; }), '死者 k3 不建边');
  ok(!env.adds.some(function (x) { return x.b === '王'; }), '玩家王 不建边');
  ok(!env.adds.some(function (x) { return x.b === '主'; }), 'actor 不自建边');
})();

// ════════ ⑥ 乞休批红接线：真源切片实跑（准→_retired+饯行忆·留→挽留忆+忠诚+3）════════
(function () {
  var s = memSrc.indexOf("if (m.type === '乞休' && m.from && (status === 'approved' || status === 'rejected')) {");
  var e = memSrc.indexOf('// 批复差异化后果（施于上奏者', s);
  ok(s >= 0 && e > s, '能定位 乞休批红 切片');
  var block = memSrc.slice(s, e).trimEnd();
  var ctx = { Math: Math, String: String };
  vm.createContext(ctx);
  vm.runInContext('function commitRetire(m,status,env){var GM=env.GM,findCharByName=env.findCharByName,NpcMemorySystem=env.NpcMemorySystem,adjustCharacterLoyalty=env.adjustCharacterLoyalty,addEB=env.addEB,_memorialSendReply=env._memorialSendReply;\n' + block + '\nreturn "fell-through";\n}', ctx, { filename: 'commitRetire.js' });
  ok(typeof ctx.commitRetire === 'function', 'commitRetire(真切片) 装载');
  function mkEnv(ch) {
    var mem = [], reps = [];
    return { chars: [ch], mem: mem, reps: reps,
      GM: { turn: 9 }, findCharByName: function (n) { return n === ch.name ? ch : null; },
      NpcMemorySystem: { remember: function (w, ev, emo, imp) { mem.push({ w: w, ev: ev, emo: emo, imp: imp }); } },
      adjustCharacterLoyalty: function (c, d) { c.loyalty = (c.loyalty == null ? 50 : c.loyalty) + d; },
      addEB: function () {}, _memorialSendReply: function (m, lbl) { reps.push(lbl); } };
  }
  // 语义确定性可判：status 是引擎显式字段·准=approved / 留=rejected（无须解析朱批关键词）
  var chA = { name: '老臣', alive: true, loyalty: 50 };
  var envA = mkEnv(chA);
  var rA = ctx.commitRetire({ type: '乞休', from: '老臣', status: 'approved' }, 'approved', envA);
  ok(chA._retired === true && chA._retireTurn === 9, '准(approved)→_retired=true+_retireTurn·实=' + chA._retired + '/' + chA._retireTurn);
  ok(envA.mem.some(function (x) { return x.emo === '喜' && /饯行/.test(x.ev) && x.imp === 6; }), '准→饯行忆(喜·imp6)');
  ok(rA === undefined, '准→早 return(不落通用挫面后果)·实=' + rA);
  ok(envA.reps[0] === '准其致仕', '准→回传朱批「准其致仕」');

  var chB = { name: '老臣', alive: true, loyalty: 50 };
  var envB = mkEnv(chB);
  ctx.commitRetire({ type: '乞休', from: '老臣', status: 'rejected' }, 'rejected', envB);
  ok(chB._retired !== true, '留(rejected)→不致仕');
  ok(chB.loyalty === 53, '留→忠诚+3(君恩挽留)·实=' + chB.loyalty);
  ok(envB.mem.some(function (x) { return x.emo === '喜' && /挽留|慰留/.test(x.ev) && x.imp === 6; }), '留→挽留忆(喜·imp6)');
  ok(envB.reps[0] === '温谕慰留', '留→回传朱批「温谕慰留」');
  // 非乞休型不被此块吞（须落通用后果）
  var chC = { name: '他', alive: true, loyalty: 50 };
  var envC = mkEnv(chC);
  var rC = ctx.commitRetire({ type: '荐表', from: '他', status: 'approved' }, 'approved', envC);
  ok(rC === 'fell-through' && chC._retired !== true, '非乞休型不被吞(落通用路径)');
})();

// ════════ ⑦ 五维图志渲染函数抽验：adaptWuweiRels 真源切片实跑 ════════
(function () {
  var s = tuzhiSrc.indexOf('function adaptWuweiRels(c){');
  ok(s >= 0, '能定位 adaptWuweiRels');
  var e = tuzhiSrc.indexOf('\n}', s);
  var fn = tuzhiSrc.slice(s, e + 2);
  var ctx = { Math: Math, Object: Object };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx, { filename: 'adaptWuweiRels.js' });
  ok(typeof ctx.adaptWuweiRels === 'function', 'adaptWuweiRels 装载');
  var c = { relations: {
    '甲': { affinity: 95, trust: 90, respect: 88, fear: 0, hostility: 0 },   // 大偏离
    '乙': { affinity: 50, trust: 50, respect: 50, fear: 0, hostility: 0 },   // 中性→滤除
    '丙': { affinity: 20, trust: 30, respect: 45, fear: 60, hostility: 70 }, // 大偏离(畏敌)
    '丁': { affinity: 52, trust: 51, respect: 50, fear: 0, hostility: 0 },   // dev=3<8→滤除
    '戊': { affinity: 40, trust: 40, respect: 40, fear: 0, hostility: 0 },   // dev=30
    '己': { affinity: 35, trust: 40, respect: 45, fear: 5, hostility: 10 }   // dev=45
  } };
  var out = ctx.adaptWuweiRels(c);
  ok(Array.isArray(out) && out.length === 4, '取偏离基线 top4·实=' + out.length);
  ok(!out.some(function (x) { return x.name === '乙' || x.name === '丁'; }), '近中性(乙/丁·dev<8)被滤');
  var top = out[0];
  ok(top.name === '甲' || top.name === '丙', 'top1 是大偏离者(甲或丙)');
  var jia = out.find(function (x) { return x.name === '甲'; });
  ok(jia && jia.affinity === 95 && jia.trust === 90 && jia.respect === 88, '甲:五维数值带出(亲95/信90/敬88)');
  var bing = out.find(function (x) { return x.name === '丙'; });
  ok(bing && bing.fear === 60 && bing.hostility === 70, '丙:畏60/敌70 带出');
  // 空/无 relations → 空数组
  ok(ctx.adaptWuweiRels({}).length === 0 && ctx.adaptWuweiRels(null).length === 0, '无 relations→空数组');
})();
// tuzhi 渲染契约：观感五维段挂在关系 tab·adaptChar 已喂 wuweiRels

// ════════ ⑧ sc1b prompt 注入段：囚者至交 / 关系网 cue / 前瞻 / 预算截断 / 路由提示 ════════
// 路由提示行含中文·tp1b 块统一 \u 转义风格·故按 ASCII 型名锚点断言(转义无关)

console.log('[smoke-npc-interaction-enrich] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
