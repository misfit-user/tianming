#!/usr/bin/env node
'use strict';
/* smoke-player-natural-death-routing — 皇帝自然死路由修（2026-07-07）防腐线。
 * 病灶：经济 tick 老化扣血 health≤0 → triggerCharacterDeath 只标 dead·不特判 isPlayer——
 * 皇帝被静默标尸照常执政（终局屏只认 AI 死亡路径的 _playerDead）。
 * 修：isPlayer 分支镜像 tm-ai-apply-deaths E10（resolveHeir 世代传承→无嗣 _playerDead）。
 * 鼎革R1a(2026-07-07)：两份镜像收拢进 adjudicatePlayerDeath@tm-endturn-helpers·
 * 本 smoke harness 注入真裁决器切片(整合真验)·静态契约改钉「两产地皆委托统一收口」。
 * §a vm 切片实跑 triggerCharacterDeath  §b 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-player-natural-death-routing');

var src = read('tm-char-economy-engine.js');
var s = src.indexOf('function triggerCharacterDeath(ch, cause) {');
var e = src.indexOf('function distributeInheritance(');
ok(s > 0 && e > s, '切片边界在(triggerCharacterDeath)');
var code = src.slice(s, e);

// R1a：裁决器真身切片(来自 tm-endturn-helpers·整合真验·而非 stub)
var hsrc = read('tm-endturn-helpers.js');
var ha = hsrc.indexOf('function adjudicatePlayerDeath(ch, cause, opts) {');
(function () {
  var j = hsrc.indexOf('{', ha), d = 0;
  for (; j < hsrc.length; j++) { var c = hsrc[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  var adjCode = hsrc.slice(ha, j);
  mk._adjCode = adjCode;
})();

function mk(opts) {
  opts = opts || {};
  var ebs = [], mems = [], emits = [];
  var ctx = {
    GM: { turn: 20, chars: opts.chars || [] },
    P: { playerInfo: { characterName: '天子' } },
    addEB: function (cat, txt) { ebs.push(cat + '|' + txt); },
    distributeInheritance: function () {},
    resolveHeir: opts.resolveHeir,
    NpcMemorySystem: { addMemory: function (name, ev, imp, kind) { mems.push(name + '|' + ev); } },
    GameEventBus: { emit: function (t, d) { emits.push(t); } },
    console: { warn: function () {}, log: function () {} }
  };
  if (opts.noResolve) delete ctx.resolveHeir;
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  if (!opts.noAdjudicator) vm.runInContext(mk._adjCode, ctx, { filename: 'adjudicator-slice.js' });
  vm.runInContext(code, ctx, { filename: 'death-slice.js' });
  ctx._ebs = ebs; ctx._mems = mems; ctx._emits = emits;
  return ctx;
}

/* ── §a 行为 ─────────────────────────────────────────────── */
console.log('— §a · triggerCharacterDeath 行为 —');
(function () {
  // NPC 死：原路不变(零回归)
  var c1 = mk({ noResolve: true });
  var npc = { name: '某臣', id: 'c9' };
  c1.triggerCharacterDeath(npc, '疾');
  ok(npc.dead === true && npc.alive === false && npc.deathTurn === 20, 'NPC 死亡字段原样(零回归)');
  ok(!c1.GM._playerDead && !c1.GM._successionEvent, 'NPC 死不触玩家路由');
  ok(c1._ebs.some(function (x) { return x.indexOf('薨') > 0; }), 'NPC 讣文仍称薨');

  // 玩家死+有嗣：世代传承
  var heir = { name: '皇长子', alive: true };
  var c2 = mk({ chars: [{ name: '旧臣', alive: true }], resolveHeir: function () { return heir; } });
  var emperor = { name: '天子', isPlayer: true, id: 'p1' };
  c2.triggerCharacterDeath(emperor, '疾');
  ok(emperor.isPlayer === false && heir.isPlayer === true, '有嗣：先帝退位·继承人接玩家位');
  ok(c2.GM.playerInfo.characterName === '皇长子', 'GM.playerInfo 随继位更新');
  ok(c2.P.playerInfo.characterName === '天子', 'P.playerInfo 保持剧本配置不受运行期继位污染');
  ok(!c2.GM._playerDead, '继位成功不触终局');
  ok(c2.GM._successionEvent && c2.GM._successionEvent.from === '天子' && c2.GM._successionEvent.to === '皇长子', '_successionEvent 落(叙事【帝位更迭】已有消费点)');
  ok(c2._emits.indexOf('succession') >= 0, 'GameEventBus succession 事件发出');
  ok(c2._mems.some(function (m) { return m.indexOf('皇长子|') === 0; }) && c2._mems.some(function (m) { return m.indexOf('旧臣|') === 0; }), '新君+群臣记忆驾崩(镜像 AI 路径)');
  ok(c2._ebs.some(function (x) { return x.indexOf('崩') > 0; }), '皇帝讣文称崩不称薨');

  // 玩家死+无嗣：终局
  var c3 = mk({ resolveHeir: function () { return null; } });
  var emperor3 = { name: '天子', isPlayer: true, id: 'p1' };
  c3.triggerCharacterDeath(emperor3, '疾');
  ok(c3.GM._playerDead === true, '无嗣：_playerDead 落(endturn-core 终局屏可消费·不再静默尸政)');
  ok(/圣躬不豫/.test(c3.GM._playerDeathReason || ''), '死因人话化(疾→圣躬不豫医药罔效)');

  // resolveHeir 缺位(沙箱/极端)：typeof 守卫→无嗣路径
  var c4 = mk({ noResolve: true });
  var emperor4 = { name: '天子', isPlayer: true };
  c4.triggerCharacterDeath(emperor4, '疾');
  ok(c4.GM._playerDead === true, 'resolveHeir 缺位：typeof 守卫走终局(不抛不静默)');

  // resolveHeir 抛异常：catch 回落终局
  var c5 = mk({ resolveHeir: function () { throw new Error('boom'); } });
  var emperor5 = { name: '天子', isPlayer: true };
  c5.triggerCharacterDeath(emperor5, '战殁');
  ok(c5.GM._playerDead === true && c5.GM._playerDeathReason === '战殁', '继承路由异常：回落终局(宁终局勿尸政)');

  // 嗣已死：不传死人
  var c6 = mk({ resolveHeir: function () { return { name: '故太子', dead: true, alive: false }; } });
  var emperor6 = { name: '天子', isPlayer: true };
  c6.triggerCharacterDeath(emperor6, '疾');
  ok(c6.GM._playerDead === true, '继承人已殁：不传死人·走终局');
})();

/* ── §b 接线契约 ─────────────────────────────────────────────── */
console.log('— §b · 接线契约 —');
(function () {
  ok(/if \(ch\.health <= 0 && !ch\.dead\) \{\s*\n\s*triggerCharacterDeath\(ch, '疾'\);/.test(src), '老化扣血→触死路径原样在(上游未动)');
  ok(/if \(ch\.isPlayer\) \{/.test(src.slice(s, s + 3000)), 'triggerCharacterDeath 内 isPlayer 分支在');
  ok(/adjudicatePlayerDeath/.test(src.slice(s, e)), 'isPlayer 分支委托玩家之死裁决器(R1a 统一收口)');
  var core = read('tm-endturn-core.js');
  ok(/_playerDead/.test(core), 'endturn-core 终局消费点在(下游未动)');
  var aid = read('tm-ai-apply-deaths.js');
  ok(/adjudicatePlayerDeath/.test(aid), 'AI 死亡路径 E10 同委托裁决器(两产地一口)');
})();

console.log('\nsmoke-player-natural-death-routing ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
