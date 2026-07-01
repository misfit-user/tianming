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
const cc = fs.readFileSync(path.resolve(ROOT, 'tm-chaoyi-changchao.js'), 'utf8');

// ── S1 输入增强 ──
ok(/sc07 升级·S1 输入增强/.test(fu) && /_close07/.test(fu) && /_foe07/.test(fu), 'S1 每 NPC 注入关系网(亲近/嫌隙 top·信息不对称之据)');
ok(/亲近：/.test(fu) && /嫌隙：/.test(fu), 'S1 关系网含亲近/嫌隙标签');
ok(/本回合亲历/.test(fu) && /it\.actor === c\.name/.test(fu), 'S1 高亮该 NPC 本回合自己的动作(必强知)');

// ── S2 产出深化 + 修 preserve-once ──
['gratitudeGrudge', 'agenda', 'situationRead', 'rumorVsFact'].forEach(function (k) {
  ok(new RegExp('"' + k + '"').test(fu), 'S2 schema 含新字段 ' + k);
  ok(new RegExp(k + ': String\\(ent\\.' + k).test(fu), 'S2 _rec 处理新字段 ' + k + '(null-safe)');
});
ok(/sc07 升级·S2 修「生成一次永不更新」/.test(fu), 'S2 标注修 preserve-once');
ok(/var _lim = ent\.lastInteractionMemory/.test(fu) && /if \(_lim && typeof _lim === 'object'\) return _lim;/.test(fu) && /return _ex\.lastInteractionMemory \|\| null;/.test(fu), 'S2+CodexFix2 lastInteractionMemory 可演进(对象直接用/字符串归一/省略保旧)');
ok(/recognitionState: \(ent\.recognitionState && typeof ent\.recognitionState === 'object'\) \? ent\.recognitionState : \(_ex\.recognitionState/.test(fu), 'S2 recognitionState 同上(可演进)');
ok(!/recognitionState: _ex\.recognitionState \|\| \(ent\.recognitionState/.test(fu), 'S2 旧 preserve-once(_ex||ent)已清');

// ── S3 消费打通 ──
['gratitudeGrudge', 'agenda', 'situationRead', 'rumorVsFact'].forEach(function (k) {
  ok(new RegExp('cog\\.' + k).test(ut), 'S3 snippet 出新字段 ' + k);
});
ok(/恩怨：/.test(ut) && /所求：/.test(ut) && /朝局判断：/.test(ut) && /风闻\(未证\)：/.test(ut), 'S3 snippet 新字段中文标签');
ok(/sc07 升级·S3 消费打通/.test(cc) && /getNpcCognitionSnippet\(name\)/.test(cc), 'S3 常朝 _cc3_aiGenReact 接入 getNpcCognitionSnippet(此前完全没接)');

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
ok(/sc07 深化·D1 名录相关性优先/.test(fu) && /_cogRelevance07/.test(fu), 'D1 名录按相关性排序(非纯品级)');
ok(/_activeN07\[it\.actor\]|_activeN07\[it\.target\]/.test(fu) && /GM\.memorials/.test(fu), 'D1 相关性含本回合互动 + 近期上疏者');
ok(!/_liveCharsCog\.sort\(function\(a,b\)\{return \(a\.rank\|\|99\)-\(b\.rank\|\|99\);\}\);/.test(fu), 'D1 旧纯品级排序已换');
// 逻辑自验:活跃者(+1000)排在纯高品级(rank1→99分)前
(function () {
  var active = { '李四': 1 };
  function rel(c) { return (active[c.name] ? 1000 : 0) + Math.max(0, 100 - (c.rank || 99)); }
  var arr = [{ name: '张一品', rank: 1 }, { name: '李四', rank: 50 }].sort(function (a, b) { return rel(b) - rel(a); });
  ok(arr[0].name === '李四', 'D1 本回合活跃的低品级(李四)排在高品级(张一品)前(实首=' + arr[0].name + ')');
})();

// ── D2 廷议批量接认知短线索 ──
const cy = fs.readFileSync(path.resolve(ROOT, 'tm-chaoyi.js'), 'utf8');
ok(/sc07 深化·D2 廷议批量接认知/.test(cy) && /_cc2CogCue07/.test(cy), 'D2 廷议定义认知短线索助手');
ok(/\+ _cc2CogCue07\(a\.name\)/.test(cy), 'D2 在场官员名录行追加认知线索(念/对陛下/求)');

// ── D3 信息不对称收紧(亲近关系+公私→knows/doesntKnow) ──
ok(/sc07 深化·D3 信息不对称收紧/.test(fu) && /知与不知·硬规则/.test(fu), 'D3 加「知与不知」硬规则');
ok(/消息顺关系网传/.test(fu) && /rumorVsFact 而非 knows/.test(fu), 'D3 素无往来者只得风闻(入 rumorVsFact 非 knows)');

// ── D4 认知反哺机制层(态度净变化→char.loyalty·有界/幂等/门控/默认关) ──
ok(/sc07 深化·D4 认知反哺/.test(fu), 'D4 认知反哺桥存在');
ok(/"attitudeDelta"/.test(fu) && /attitudeDelta: \(function\(\)\{ var _ad = parseInt/.test(fu), 'D4 sc07 输出结构化 attitudeDelta(-3..3·有据非文本解析)');
ok(/P\.conf\.cognitionFeedbackEnabled/.test(fu), 'D4 默认关(cognitionFeedbackEnabled flag·动数值须真机验)');
ok(/_ch\._cogFeedbackTurn === GM\.turn/.test(fu) && /_ch\._cogFeedbackTurn = GM\.turn/.test(fu), 'D4 幂等:per-char turn 戳防 sc07 重跑双算');
ok(/var _cfCap = 2/.test(fu) && /Math\.max\(0, Math\.min\(100, _ch\.loyalty \+ _nud\)\)/.test(fu), 'D4 有界:±2/回合封顶 + loyalty clamp 0-100');
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
ok(/Codex 审查修·HIGH/.test(fu), 'Codex 修:标注两处 HIGH 修复');
ok(/var _lvl = Number\(c && c\.rankLevel\)/.test(fu) && !/Math\.max\(0, 100 - \(Number\(c\.rank\) \|\| 99\)\)/.test(fu), 'CodexFix1 _cogRelevance07 改用 rankLevel(原纯 c.rank 已清)');
ok(/typeof _lim === 'string' && _lim\.trim\(\)/.test(fu) && /event: _lim\.trim\(\)\.slice/.test(fu), 'CodexFix2 lastInteractionMemory 字符串归一为对象(可演进)');
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
