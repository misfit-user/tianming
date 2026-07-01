#!/usr/bin/env node
'use strict';
/* smoke-sc1bc-upgrade — sc1c(势力外交·阴谋)+ sc1b(文事·鸿雁·人际)三链完善
 * C1 修 scheme_actions↔activeSchemes 形状不匹配(真 bug) · C2/B1 喂 _npcCognition+NPC间关系(消费 sc07 成果)
 * C3 hidden_moves 死输出救活(存续+喂回) · B2 subjectLine + 修过期 expectedKeys
 * LLM 内容质量 owner 真机验;此处守代码契约 + 复刻行为验。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ai = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai.js'), 'utf8');
const ap = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-apply.js'), 'utf8');
const fu = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-followup.js'), 'utf8');   // F3 followup.js sc07 S1 关系修
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-sc1bc-upgrade');

// ── C1 scheme 形状(producer + consumer) ──
ok(/status: 'active'/.test(ai) && /progressPct: \(\{/.test(ai) && /typeName: String\(s\.typeName/.test(ai), 'C1 producer 补 status/progressPct/typeName');
ok(/sc1c 升级·C1/.test(ap) && /_stagePctC1/.test(ap) && /_pctToStageC1/.test(ap) && /scheme\.progressPct = _pctA/.test(ap), 'C1 consumer 用数值 progressPct 推进 + 同步字符串阶段');
ok(/var _tnC1 = scheme\.typeName \|\| '密谋'/.test(ap), 'C1 consumer typeName 兜底');
(function () {
  var stagePct = { '长期布局': 15, '酝酿中': 35, '即将发动': 70, '已发': 90 };
  var toStage = function (p) { return p < 25 ? '长期布局' : (p < 55 ? '酝酿中' : (p < 85 ? '即将发动' : '已发')); };
  var scheme = { progress: '酝酿中' };  // 旧形状:字符串阶段·无 progressPct
  var _pct = (typeof scheme.progressPct === 'number') ? scheme.progressPct : (stagePct[scheme.progress] || 30);
  _pct = Math.min(100, _pct + Math.min(20, 50)); scheme.progressPct = _pct; scheme.progress = toStage(_pct);
  ok(scheme.progressPct === 55 && scheme.progress === '即将发动', 'C1行为 字符串阶段派生数值基线+推进(酝酿35→55·阶段同步即将发动·原代码字符串当数字加=NaN)');
})();

// ── C2/B1 喂 _npcCognition + NPC 间关系 ──
ok(/function _cogRelCueSC/.test(ai), 'C2/B1 共享 _cogRelCueSC 助手');
ok((ai.match(/_p \+= _cogRelCueSC\(c\)/g) || []).length >= 2, 'C2/B1 sc1b + sc1c 两 brief 都追加认知+关系线索(实=' + (ai.match(/_p \+= _cogRelCueSC\(c\)/g) || []).length + ')');
ok(/GM\._npcCognition\[c\.name\]/.test(ai) && /c\.relations/.test(ai), 'C2/B1 读 sc07 的 _npcCognition + char.relations(此前 sc1b/sc1c 0 引用)');
(function () {
  var GM = { _npcCognition: { '张三': { agenda: '求雪冤', situationRead: '阉党势盛', attitudeTowardsPlayer: '凄惠' } } };
  function cue(c) {
    var bits = []; var cg = GM._npcCognition && GM._npcCognition[c.name];
    if (cg) { if (cg.agenda) bits.push('求:' + cg.agenda); if (cg.situationRead) bits.push('势:' + cg.situationRead); if (cg.attitudeTowardsPlayer) bits.push('视上:' + cg.attitudeTowardsPlayer); }
    if (c.relations) {
      var rel = Object.keys(c.relations).map(function (n) { var r = c.relations[n] || {}; return { n: n, aff: Number(r.affinity) || 50, host: Number(r.hostility) || 0 }; });
      var close = rel.filter(function (r) { return r.aff >= 65; }).slice(0, 2);
      var foe = rel.filter(function (r) { return r.host >= 25 || r.aff <= 30; }).slice(0, 2);
      if (close.length) bits.push('睦:' + close.map(function (r) { return r.n; }).join('/'));
      if (foe.length) bits.push('隙:' + foe.map(function (r) { return r.n; }).join('/'));
    }
    return bits.length ? (' ⟨' + bits.join('·') + '⟩') : '';
  }
  var out = cue({ name: '张三', relations: { '李四': { affinity: 80 }, '王五': { hostility: 40 } } });
  ok(/求:求雪冤/.test(out) && /睦:李四/.test(out) && /隙:王五/.test(out), 'C2/B1行为 cue 含所求+睦(李四)+隙(王五)·谁想要什么/谁信谁/谁恨谁');
  ok(cue({ name: '无认知者' }) === '', 'C2/B1行为 无认知无关系→空 cue(不硬塞)');
})();

// ── C3 hidden_moves 救活 ──
ok(/sc1c 升级·C3/.test(ai) && /GM\._hiddenMoves\.push/.test(ai) && /GM\._hiddenMoves = GM\._hiddenMoves\.slice\(-40\)/.test(ai), 'C3 hidden_moves 滚动存续 GM._hiddenMoves(cap40)');
ok(/var _hiddenMovesC =/.test(ai) && /近期暗流/.test(ai), 'C3 近期暗流喂回 sc1c 输入(多回合连续性·不再只 addEB 日志)');

// ── B2 sc1b 产出清理 ──
ok(/subjectLine:"/.test(ai), 'B2 npc_letters 加 subjectLine(apply.js:1197 在读却没有)');
ok(/expectedKeys: \['cultural_works', 'npc_letters', 'npc_correspondence', 'npc_interactions'\]/.test(ai) && !/expectedKeys: \['npc_interactions', 'cultural_works', 'hongyan_letters'/.test(ai), 'B2 修过期 expectedKeys(去 hongyan_letters/fengwen_snippets·换 sc1b 实产字段)');

// ── C4 npc_schemes 产出深化(motive/method/secrecy/winCondition) ──
ok(/winCondition/.test(ai) && /secrecy/.test(ai), 'C4 阴谋深化字段(winCondition/secrecy)present');
ok(/motive: String\(s\.motive/.test(ai) && /method: String\(s\.method/.test(ai) && /secrecy: String\(s\.secrecy/.test(ai) && /winCondition: String\(s\.winCondition/.test(ai), 'C4 producer 存 motive/method/secrecy/winCondition(null-safe)');
ok(/motive:"/.test(ai) && /method:"/.test(ai) && /winCondition:"/.test(ai), 'C4 schema 让模型输出这四维');

// ── Codex 审查修 F1-F4 ──
ok(/Codex 审查修·F1|feudal 数值 progress scheme/.test(ap) && /if \(typeof scheme\.progress === 'string'\)/.test(ap), 'F1 consumer 按 progress 类型分流(feudal 数值不覆写成字符串)');
ok(/s\.status === 'active' \|\| s\.status == null/.test(ap), 'F2 缺 status 视作 active(旧存档阴谋可推进)');
ok(/var _af = Number\(r\.affinity\)/.test(ai) && /aff: isFinite\(_af\)/.test(ai), 'F3 ai.js _cogRelCueSC affinity 用 isFinite(0 死敌不当中性)');
ok(/aff: isFinite\(_af\)/.test(fu) && /trust: isFinite\(_tr\)/.test(fu), 'F3 followup.js sc07 S1 关系 affinity/trust 用 isFinite');
ok(/\[s\.progress \|\| '酝酿中'\] \|\| 20/.test(ai), 'F4 producer progressPct 从默认阶段算(与 progress 一致)');
// 行为:F1 feudal 数值 progress 不被覆写 + F3 affinity 0→隙
(function () {
  // F1:数值 progress scheme(feudal)advance → 仍数值·不变字符串
  var sch = { progress: 40, status: 'active' };  // feudal 形:数值 progress
  if (typeof sch.progress === 'string') { /* sc1c path */ } else { sch.progress = Math.min(100, (Number(sch.progress) || 0) + Math.min(20, 50)); }
  ok(typeof sch.progress === 'number' && sch.progress === 60, 'F1行为 feudal 数值 progress advance→60(数值·未被覆写成字符串阶段·免 NaN)');
  // F3:affinity 0 → 隙(死敌)
  function cueRel(c) {
    var rel = Object.keys(c.relations).map(function (n) { var r = c.relations[n] || {}; var _af = Number(r.affinity); return { n: n, aff: isFinite(_af) ? _af : 50, host: Number(r.hostility) || 0 }; });
    var foe = rel.filter(function (r) { return r.host >= 25 || r.aff <= 30; }).map(function (r) { return r.n; });
    return foe;
  }
  ok(cueRel({ relations: { '死敌': { affinity: 0 } } }).indexOf('死敌') >= 0, 'F3行为 affinity:0→入隙(原 ||50 会漏)');
})();

console.log('\nsmoke-sc1bc-upgrade ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
