#!/usr/bin/env node
'use strict';
/* smoke-dangling-signal-fixes — 悬空信号小修批（2026-07-07）防腐线。
 * 四修：①_factionNarratives复数错名→单数(党派叙事回喂AI恒空一字之差)
 *      ②_issueEffects黑洞桶补告警(要务效果key不匹配被静默吞)
 *      ③_courtSilenced噤声标记接读点(叙事注入+agent求见压制·写点在apply不动)
 *      ④精力标签一致化(廷议卡25→15补owner调参漏网·常朝补扣10兑现卡片承诺)
 * §a 错名契约  §b 黑洞桶告警  §c 噤声读点(vm行为)  §d 精力(vm行为+契约) */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-dangling-signal-fixes');

/* ── §a 错名修：_factionNarratives(复数) 全灭·单数读取带类型防御 ── */
console.log('— §a · 党派叙事错名修 —');
(function () {
  var fu = read('tm-endturn-followup.js');
  ok(!/GM\._factionNarratives/.test(fu), 'followup 复数错名 _factionNarratives 已绝迹');
  var ctx=require('./lib-political-action-fixture').politicalFixture();ctx.GM._factionNarrative={privateThought:'PRIVATE_FACTION_NARRATIVE'};ok(!ctx.TM.PoliticalActions.strategicPrompt().user.includes('PRIVATE_FACTION_NARRATIVE'),'SC16 公开投影不读取全局人物内心叙述');
  ok(/GM\._factionNarrative = p25\.faction_narrative/.test(fu), '写点(单数)原样保留');
  var ap = read('tm-ai-planning.js');
  ok(/GM\._factionNarrative && typeof GM\._factionNarrative === 'object'/.test(ap), 'ai-planning 单数读点未受扰(零回归)');
})();

/* ── §b 黑洞桶告警 ── */
console.log('— §b · _issueEffects 黑洞桶告警 —');
(function () {
  var h = read('tm-endturn-helpers.js');
  ok(/GM\._issueEffects\[k\] = \(GM\._issueEffects\[k\] \|\| 0\) \+ v;\s*\n\s*try \{ console\.warn\(/.test(h), '未识别效果键落桶时 console.warn 告警(不再静默吞)');
  ok(/console\.warn\([^\n]*_issueEffects/.test(h), '告警文案点名 _issueEffects 便于排查');
})();

/* ── §c 噤声读点 ── */
console.log('— §c · _courtSilenced 噤声读点 —');
(function () {
  var fu = read('tm-endturn-followup.js');
  ok(/typeof GM\._courtSilenced === 'number' && \(GM\.turn - GM\._courtSilenced\) >= 0 && \(GM\.turn - GM\._courtSilenced\) <= 3/.test(fu), '叙事注入读点在(≤3回合窗)');
  var dt = read('tm-endturn-agent-depth-tools.js');
  ok(/_silencedRecently = \(typeof gm\._courtSilenced === 'number'/.test(dt), 'agent 求见压制读点在');

  // vm 行为级：切出求见段实跑(含 names/audN 定义·至 total 聚合行前)
  var s = dt.indexOf("if (!Array.isArray(gm._pendingAudiences)) gm._pendingAudiences = [];");
  var e = dt.indexOf('var total = addN');
  ok(s > 0 && e > s, '求见段切片边界在');
  var seg = dt.slice(s, e);
  function runSeg(silencedTurn, audCount) {
    var gm = {
      _courtSilenced: silencedTurn,
      chars: [{ name: '甲', alive: true }, { name: '乙', alive: true }, { name: '丙', alive: true }],
      _pendingAudiences: []
    };
    var ctx = {
      gm: gm, turn: 10, root: {},
      p: { audiences: Array.from({ length: audCount }, function (_, i) { return { name: ['甲', '乙', '丙'][i], reason: '求见' }; }) },
      Array: Array, String: String, console: console
    };
    vm.createContext(ctx);
    vm.runInContext(seg, ctx, { filename: 'aud-seg.js' });
    return gm._pendingAudiences.length;
  }
  ok(runSeg(undefined, 3) === 3, '无噤声：3人求见全入队');
  ok(runSeg(9, 3) === 1, '噤声次回合(turn-1)：百官寒蝉·仅1人入队');
  ok(runSeg(5, 3) === 3, '噤声已过5回合(>3窗)：恢复常态全入');
})();

/* ── §d 精力标签一致化 ── */
console.log('— §d · 精力标签/实扣一致 —');
(function () {
  var cy = read('tm-chaoyi.js');
  ok(/'tinyi',[^\n]*'精力 15'/.test(cy), '廷议卡片 25→15(owner 调参漏网补齐·与实扣 tinyi:_spendEnergy(15) 一致)');
  ok(!/'精力 25'/.test(cy), '旧标签「精力 25」绝迹');
  ok(/_spendEnergy\(10, '常朝'\)/.test(cy), '常朝实扣 10 接上(卡片承诺兑现)');
  var ti = read('tm-chaoyi-tinyi.js');
  ok(/_spendEnergy\(15, '廷议'\)/.test(ti), '廷议实扣 15 未动(零回归)');

  // vm 行为级：_cy_pickMode changchao 分支
  var s2 = cy.indexOf('function _cy_pickMode(');
  var e2 = cy.indexOf('function startChaoyiSession');
  ok(s2 > 0 && e2 > s2, '_cy_pickMode 切片边界在');
  var code2 = cy.slice(s2, e2);
  function runPick(spendOk) {
    var calls = { cc3: 0, spend: [] };
    var ctx = {
      CY: {}, GM: { turn: 3, _chaoyiCount: {} },
      _cy_isModeBlockedByFrequency: function () { return false; },
      _spendEnergy: function (cost, name) { calls.spend.push(cost + '|' + name); return spendOk; },
      _cc3_open: function () { calls.cc3++; },
      _ty2_openSetup: function () {}, _yq2_openSetup: function () {},
      toast: function () {}, console: console
    };
    vm.createContext(ctx);
    vm.runInContext(code2, ctx, { filename: 'pick-slice.js' });
    ctx._cy_pickMode('changchao');
    return calls;
  }
  var r1 = runPick(true);
  ok(r1.spend.length === 1 && r1.spend[0] === '10|常朝' && r1.cc3 === 1, '精力足：扣10并开常朝');
  var r2 = runPick(false);
  ok(r2.spend.length === 1 && r2.cc3 === 0, '精力不足：拦截不开朝(与廷议/御前同款)');
})();

console.log('\nsmoke-dangling-signal-fixes ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
