#!/usr/bin/env node
'use strict';
// smoke-battle-terrain-clamp — BattleEngine 地形/季节/城防夹取(#28·接通批·opt-in 扩展)
//   源契约:默认 ON(2026-07-05 翻默认·===false 才关)·resolve 传 season·矛盾判定+夹取标记·原 absurd 处理保留(回归)
//   行为复刻:矛盾条件(AI攻方胜+引擎判守住+AI低估攻方伤亡)的触发/不触发
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }

console.log('smoke-battle-terrain-clamp');

const mil = fs.readFileSync(path.join(ROOT,'tm-military.js'),'utf8');

// ── 源契约 ──
ok(!/conf\.deterministicCasualties|battleConfig\.deterministicCasualties/.test(mil), '① 正式伤亡核算不读旧关闭配置');
ok(/_hasTerrainFactor = \(_toNum\(br\.fortLevel, 0\) > 0\)/.test(mil), '② 地形/城防因子判定(fortLevel>0 或非平原)');
ok(/season: br\.season/.test(mil), '③ resolve() 现传 season(季节参与战力)');
ok(/_detDefenderHeld = \(_det\.verdict === '败北'\)/.test(mil), '④ 引擎判「败北」=守方守住');
ok(/_aiAttackerWon && _detDefenderHeld && lossBySide\.attacker < _det\.attackerLoss \* 0\.6/.test(mil), '⑤ 矛盾判定:AI攻方胜 + 引擎守住 + AI低估攻方伤亡(<60%)');
ok(/br\._terrainClamped = true/.test(mil), '⑥ 夹取留标记 _terrainClamped + EB');
ok(/_aBad \|\| _dBad \|\| _bothZero/.test(mil), '⑦ 原 absurd/双零 处理保留(回归·不破已有 opt-in)');

// ── 行为复刻:矛盾条件 ──
function contradicts(aiWinnerFac, attackerFac, detVerdict, aiAttackerLoss, detAttackerLoss){
  var aiAttackerWon = !!(aiWinnerFac && attackerFac && aiWinnerFac === attackerFac);
  var detDefenderHeld = (detVerdict === '败北');
  return aiAttackerWon && detDefenderHeld && aiAttackerLoss < detAttackerLoss * 0.6;
}
ok(contradicts('本朝','本朝','败北', 100, 1000) === true, '⑧ ★AI攻方轻取(伤亡100) vs 引擎判守住(预期1000)→矛盾·夹取(强攻雄关真实代价)');
ok(contradicts('本朝','本朝','大胜', 100, 1000) === false, '⑧ 引擎也判攻方大胜→不矛盾·尊重 AI 叙事');
ok(contradicts('后金','本朝','败北', 100, 1000) === false, '⑧ AI 判守方胜→与引擎一致·不夹');
ok(contradicts('本朝','本朝','败北', 700, 1000) === false, '⑧ AI 给攻方伤亡已够高(700≥60%)→不强夹(只纠强烈低估)');

console.log('\n结果: '+A+' 通过 / 0 失败');
