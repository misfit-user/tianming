#!/usr/bin/env node
'use strict';
/* smoke-npc-cluster-repair — NPC 簇 sc15/sc15n/memwrite 修缮 (2026-07-02)
 * ① sc15n(3-tier 合并版)此前只存结果不应用——开着 sc15n 时 NPC 心态/忠诚/关系网/暗流事件簿/
 *    阴谋台账全部静默停摆(半成品替代)。应用逻辑自 sc15 内联抽出 _applyNpcDeepResult 两路共享。
 * ② 阴谋引擎知情:GM._activePlots(机械引擎)与 sc15 的叙事暗流是两本台账·把 aiContextBlock 喂进
 *    tp15/tp15n·防凭空另立重复阴谋。
 * ③ scOl 暗流形状修:sc15 默认路径的 subcall15n 镜像是 {core,common,extended} 嵌套·原平铺读恒空。
 * ④ memwrite expectedKeys 修:原钉 schema 里不存在的 relationship_notes·漏钉真产出 causal_edges。
 */
const fs = require('fs');
const path = require('path');
const W = path.join(__dirname, '..');

let A = 0, F = 0;
function ok(cond, msg) { if (cond) { A++; console.log('  ✓ ' + msg); } else { F++; console.log('  ✗ ' + msg); } }

const src = fs.readFileSync(path.join(W, 'tm-endturn-followup.js'), 'utf8');

function extractFn(anchor) {
  const st = src.indexOf(anchor);
  if (st < 0) return null;
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', st); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return end > st ? src.slice(st, end) : null;
}

// ① 应用同源
ok(src.indexOf('p15.mood_shifts.forEach') < 0 && src.indexOf('p15.cascade_effects') < 0, '① sc15 旧内联应用块已删(无双算)');
ok(src.indexOf('GM._factionUndercurrents.push(Object.assign({ turn: GM.turn||1, _fromSc15n: true }, fu))') < 0, '① sc15n 旧 append 版 undercurrents 已删(共享函数接管)');

// ④ memwrite expectedKeys
ok(src.indexOf("expectedKeys: ['memory_writes', 'arc_updates', 'relationship_notes']") < 0, '④ 幽灵键 relationship_notes 已除');

// ⑤ 行为:抽真 _applyNpcDeepResult 喂假闭包跑
const fnSrc = extractFn('var _applyNpcDeepResult = function(pND) {');
ok(!!fnSrc, '⑤ _applyNpcDeepResult 闭包提取');
const mk = new Function('findCharByName', 'clamp', 'adjustCharacterLoyalty', 'recordChange', 'AffinityMap', 'addEB', 'GM', '_dbg', '_specialtySummary', 'findFacByName', 'NpcMemorySystem', 'turnsForMonths', 'TM', 'window',
  'return (' + fnSrc.replace('var _applyNpcDeepResult = ', '') + ')');

const chars = { '张甲': { name: '张甲', loyalty: 50, stress: 0, _mood: '平' } };
const facs = { '边镇': { name: '边镇', strength: 50 } };
const eb = [], aff = [], mems = [];
const gm = { turn: 6, vars: {}, provinceStats: {}, classes: [], chars: [], _factionUndercurrents: [{ faction: '旧', situation: '旧况' }], _factionUndercurrentsHistory: [], activeSchemes: [{ schemer: '陈腐', target: '', plan: '旧谋', progress: '酝酿中', startTurn: 0, lastTurn: 0 }] };
const spec = {};
const apply = mk(
  function(n){ return chars[n] || null; },
  function(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); },
  undefined,                                        // adjustCharacterLoyalty 缺席 → 走直接赋值回退
  function(){},                                     // recordChange
  { add: function(a, b, d, r){ aff.push([a, b, d, r]); } },
  function(tag, txt){ eb.push([tag, txt]); },
  gm, function(){}, spec,
  function(n){ return facs[n] || null; },
  { remember: function(who, what){ mems.push([who, what]); } },
  undefined, {}, {}
);
apply({
  mood_shifts: [{ name: '张甲', loyalty_delta: -5, stress_delta: 8, mood: '忧惧', reason: '遭斥' }],
  relationship_changes: [{ a: '张甲', b: '李乙', delta: -12, reason: '构隙' }],
  hidden_moves: ['张甲：因遭斥→暗中联络言官→图自保'],
  faction_undercurrents: [{ faction: '边镇', situation: '粮饷不继军心浮动', trend: '衰落', nextMove: '恐哗变' }],
  npc_schemes: [{ schemer: '张甲', target: '王丙', plan: '构陷之', progress: '酝酿中' }],
  rumors: '坊间传言四起'
});
ok(chars['张甲'].loyalty === 45 && chars['张甲'].stress === 8 && chars['张甲']._mood === '忧惧', '⑤ mood_shifts 落 loyalty/stress/mood(45/8/忧惧)');
ok(aff.length === 1 && aff[0][2] === -12, '⑤ relationship_changes 落 AffinityMap');
ok(eb.some(function(e){ return e[0] === '暗流' && /联络言官/.test(e[1]); }), '⑤ hidden_moves 记入事件簿');
ok(gm._factionUndercurrents.length === 1 && gm._factionUndercurrents[0].faction === '边镇' && gm._factionUndercurrentsHistory.length === 1, '⑤ undercurrents 替换+历史归档');
ok(facs['边镇'].strength === 48, '⑤ 衰落势力扣 strength(50→48)');
ok(gm.activeSchemes.some(function(s){ return s.schemer === '张甲' && s.plan === '构陷之'; }), '⑤ npc_schemes 入台账');
ok(!gm.activeSchemes.some(function(s){ return s.schemer === '陈腐'; }), '⑤ 过期阴谋(5回合未更新)被清理');
ok(/【流言】坊间传言四起/.test(spec.sc15 || ''), '⑤ rumors 进叙事专项摘要');
ok((function(){ try { apply(null); apply({}); return true; } catch(_e) { return false; } })(), '⑤ 空结果安全跳过');

console.log('\n' + (F === 0 ? 'ALL PASS' : 'FAIL') + ' (' + A + ' pass / ' + F + ' fail)');
process.exit(F === 0 ? 0 : 1);
