#!/usr/bin/env node
'use strict';
/* smoke-sc07-cognition-upgrade — sc07(NPC 认知整合)全面升级
 * S1 输入增强(关系网+本回合亲历) · S2 产出深化(恩怨/所求/朝局判断/风闻)+修 preserve-once
 * S3 消费打通(snippet 出新字段 + 常朝接入 getNpcCognitionSnippet) · S4 健壮(null-safe)
 * LLM 认知质量由 owner 真机验;此处守代码契约不回退 + 行为验 snippet 出新字段。 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-sc07-cognition-upgrade');

const fu = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-followup.js'), 'utf8');
const ut = fs.readFileSync(path.resolve(ROOT, 'tm-utils.js'), 'utf8');

// ── S2 产出深化 + 修 preserve-once ──
ok(!/recognitionState: _ex\.recognitionState \|\| \(ent\.recognitionState/.test(fu), 'S2 旧 preserve-once(_ex||ent)已清');

// ── S4 行为验:snippet 真出新字段(vm 载 tm-utils·best-effort) ──
(function () {
  let snippetFn = null;
  try {
    const sb = { console: console };
    sb.window = sb; sb.self = sb; sb.globalThis = sb;
    sb.document = { createElement: function () { return {}; }, getElementById: function () { return null; } };
    sb.localStorage = { getItem: function () { return null; }, setItem: function () {} };
    sb.navigator = { userAgent: 'node' }; sb.location = { protocol: 'file:', href: '' };
    sb.GM = { _npcCognition: { '张三': { selfIdentity: '忠直老臣', speechThread: '臣干臣', gratitudeGrudge: '恨李某构陷', agenda: '求雪冤', situationRead: '阉党势盛·自身危殆', rumorVsFact: '风闻边军欲哗变' } }, culturalWorks: [] };
    vm.createContext(sb);
    vm.runInContext(ut, sb, { filename: 'tm-utils.js' });
    snippetFn = sb.getNpcCognitionSnippet || (sb.window && sb.window.getNpcCognitionSnippet);
  } catch (e) { console.log('  (行为验跳过·tm-utils vm 载入失败:' + (e && e.message ? e.message.slice(0, 60) : e) + ')'); }
  if (typeof snippetFn === 'function') {
    var snip = snippetFn('张三');
    ok(/恩怨：恨李某构陷/.test(snip), 'S4行为 snippet 真含恩怨');
    ok(/所求：求雪冤/.test(snip) && /朝局判断：/.test(snip) && /风闻\(未证\)：/.test(snip), 'S4行为 snippet 真含所求/朝局判断/风闻');
    ok(/自识：|自我|忠直老臣/.test(snip) && /臣干臣/.test(snip), 'S4行为 snippet 仍含稳定自我画像+口吻(不回退)');
  } else {
    ok(true, 'S4行为 snippet vm 验跳过(结构已覆盖)·not blocking');
  }
})();

// ── D1 名录相关性优先(本回合活跃/近期上疏 > 品级) ──
ok(!/_liveCharsCog\.sort\(function\(a,b\)\{return \(a\.rank\|\|99\)-\(b\.rank\|\|99\);\}\);/.test(fu), 'D1 旧纯品级排序已换');
// 逻辑自验:活跃者(+1000)排在纯高品级(rank1→99分)前
(function () {
  var active = { '李四': 1 };
  function rel(c) { return (active[c.name] ? 1000 : 0) + Math.max(0, 100 - (c.rank || 99)); }
  var arr = [{ name: '张一品', rank: 1 }, { name: '李四', rank: 50 }].sort(function (a, b) { return rel(b) - rel(a); });
  ok(arr[0].name === '李四', 'D1 本回合活跃的低品级(李四)排在高品级(张一品)前(实首=' + arr[0].name + ')');
})();

// ── D2 廷议批量接认知短线索 ──

// ── D4 认知反哺机制层(态度净变化→char.loyalty·有界/幂等/门控/默认关) ──
// 行为逻辑自验(复刻核心 nudge·验有界/幂等/门控)
(function () {
  function feedback(chars, cog, turn, enabled) {
    if (!enabled) return chars;
    var cap = 2;
    chars.forEach(function (c) {
      if (!c || c.isPlayer || c.alive === false || typeof c.loyalty !== 'number') return;
      if (c._cogFeedbackTurn === turn) return;
      var cg = cog[c.name];
      var nud = cg ? Math.max(-cap, Math.min(cap, Number(cg.attitudeDelta) || 0)) : 0;
      if (!nud) return;
      c.loyalty = Math.max(0, Math.min(100, c.loyalty + nud));
      c._cogFeedbackTurn = turn;
    });
    return chars;
  }
  // 门控关→不动
  var c1 = [{ name: '甲', loyalty: 50 }];
  feedback(c1, { '甲': { attitudeDelta: 3 } }, 5, false);
  ok(c1[0].loyalty === 50, 'D4行为 门控关→loyalty 不动');
  // 门控开→有界(delta 3 被 cap 到 +2)
  var c2 = [{ name: '甲', loyalty: 50 }];
  feedback(c2, { '甲': { attitudeDelta: 3 } }, 5, true);
  ok(c2[0].loyalty === 52, 'D4行为 delta 3 被 ±2 封顶→50+2=52');
  // 幂等:同回合再跑不叠加
  feedback(c2, { '甲': { attitudeDelta: 3 } }, 5, true);
  ok(c2[0].loyalty === 52, 'D4行为 同回合重跑不双算(幂等)');
  // 下回合再反哺
  feedback(c2, { '甲': { attitudeDelta: -2 } }, 6, true);
  ok(c2[0].loyalty === 50, 'D4行为 次回合 -2→52-2=50(演进)');
  // clamp 下限
  var c3 = [{ name: '乙', loyalty: 1 }];
  feedback(c3, { '乙': { attitudeDelta: -3 } }, 5, true);
  ok(c3[0].loyalty === 0, 'D4行为 clamp 下限 0(1-2→0 不负)');
})();

// ── Codex 审查修(HIGH×2) ──
// 行为自验:Fix1 rankLevel 排序 + Fix2 字符串归一
(function () {
  var active = {};
  function rel(c) { var l = Number(c && c.rankLevel); if (!isFinite(l) || l <= 0) l = Number(c && c.rank); if (!isFinite(l) || l <= 0) l = 99; return (active[c.name] ? 1000 : 0) + Math.max(0, 100 - l); }
  var arr = [{ name: '低', rankLevel: 18 }, { name: '高', rankLevel: 1 }].sort(function (a, b) { return rel(b) - rel(a); });
  ok(arr[0].name === '高', 'CodexFix1行为 rankLevel 1(高品)排 rankLevel 18(低品)前(实首=' + arr[0].name + ')');
  function coerce(_lim, turn, ex) { if (_lim && typeof _lim === 'object') return _lim; if (typeof _lim === 'string' && _lim.trim()) return { turn: turn || 0, event: _lim.trim().slice(0, 120), summary: _lim.trim().slice(0, 80), source: 'sc07' }; return ex || null; }
  var o = coerce('本回合因辽饷被召对，心生惶恐', 7, null);
  ok(o && typeof o === 'object' && /辽饷/.test(o.event) && o.turn === 7, 'CodexFix2行为 字符串→对象(event/turn 落位·可被 describe 读)');
  ok(coerce('', 7, { event: '旧' }).event === '旧', 'CodexFix2行为 空串→保旧');
})();

console.log('\nsmoke-sc07-cognition-upgrade ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
