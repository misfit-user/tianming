#!/usr/bin/env node
'use strict';
/* smoke-endturn-multicall-upgrade — sc16/sc25c/sc1d/sc18 四调用三链完善(一批)
 * sc16 F1: diplomatic_shifts→GM.factionRelations(外交问责洞)
 * sc25c M1: imperial_candidates 自动核议·M2: turn_memory→_aiMemory·M3a: alias.memory 供 reflect·M3b: event_weights→MemTables
 * sc1d D1: _cogRelCueSC 认知/关系入 tp1d·D2: _courtResolutions 入 tp1d·D3: 独立 zhengwen·D4: 空账本护栏
 * sc18 A1: 军事研判持久化 GM._militaryOutlook+回注·A2: 将领认知+时代锚
 * LLM 内容质量 owner 真机验;此处守代码契约 + 复刻行为验。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fu = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-followup.js'), 'utf8');
const ai = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai.js'), 'utf8');
const pt = fs.readFileSync(path.resolve(ROOT, 'tm-post-turn-jobs.js'), 'utf8');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-endturn-multicall-upgrade');

// ══ sc16 F1 ══
ok(/_sc16RelTarget = function/.test(fu) && /p16\.diplomatic_shifts\.forEach/.test(fu), 'sc16 F1 有 diplomatic_shifts→factionRelations 应用块');
ok(/GM\.factionRelations\.push\(\{ from: ds\.from, to: ds\.to/.test(fu) && /from: ds\.to, to: ds\.from/.test(fu), 'sc16 F1 双向写入 factionRelations(正向+反向)');
(function () {
  var _tbl = function (rel) { var s = String(rel || ''); var has = function (arr) { return arr.some(function (k) { return s.indexOf(k) >= 0; }); }; if (has(['同盟', '结盟', '盟友', '联盟'])) return 70; if (has(['宿敌', '死敌', '敌对', '开战'])) return -70; if (has(['中立'])) return 0; return null; };
  ok(_tbl('结为同盟') === 70 && _tbl('转为敌对') === -70 && _tbl('莫名其妙') === null, 'sc16 F1行为 关系类型→数值靶(未知类型→null 不改 value)');
  // 复刻应用:已有关系被移向靶
  var fr = [{ from: 'A', to: 'B', type: '中立', value: 0 }];
  var ds = { from: 'A', to: 'B', new_relation: '结为同盟' };
  var _tv = _tbl(ds.new_relation);
  var _f = fr.find(function (r) { return r.from === ds.from && r.to === ds.to; });
  _f.type = ds.new_relation; if (_tv != null) _f.value = Math.round(((_f.value || 0) + _tv) / 2);
  ok(_f.type === '结为同盟' && _f.value === 35, 'sc16 F1行为 既有关系移向靶(0→35·类型更新)');
})();

// ══ sc25c M1/M2/M3 ══
ok(/sc25c·M1/.test(fu) && /GM\._imperialCandidates/.test(fu) && /MemTables\.editorWrite\('imperialEdict'/.test(fu), 'sc25c M1 imperial_candidates 自动核议(auto-approve→imperialEdict / pending→_imperialCandidates)');
ok(/sc25c·M2/.test(fu) && /GM\._aiMemory\.push\(\{ turn: _ptT25c/.test(fu), 'sc25c M2 turn_memory→GM._aiMemory');
ok(/sc25c·M3a/.test(fu) && /memory: \(pS && pS\.consolidated\)/.test(fu), 'sc25c M3a alias.memory=strategic consolidated(供 reflect)');
ok(/sc25c·M3b/.test(fu) && /getSheet\('eventHistory'\)/.test(fu) && /event_weights/.test(fu), 'sc25c M3b event_weights→MemTables eventHistory 权重回写');
ok(/"event_weights":\[\{"event"/.test(fu), 'sc25c tactical prompt 新增 event_weights 输出字段');
(function () {
  function verdict(imp, conf) { imp = Math.max(0, Math.min(1, imp)); conf = Math.max(0, Math.min(1, conf)); return (imp >= 0.8 && conf >= 0.85) ? 'auto-approve' : (imp < 0.3 ? 'auto-reject' : 'pending'); }
  ok(verdict(0.9, 0.9) === 'auto-approve' && verdict(0.2, 0.9) === 'auto-reject' && verdict(0.5, 0.5) === 'pending', 'sc25c M1行为 KokoroMemo 三态裁决(高→approve/低→reject/中→pending)');
})();

// ══ sc1d D1/D2/D3/D4 ══
ok(/sc1d 升级·D1/.test(ai) && /_cogRelCueSC\(_ch\)/.test(ai), 'sc1d D1 _cogRelCueSC 认知/关系线索入 tp1d');
ok(/sc1d 升级·D2/.test(ai) && /GM\._courtResolutions/.test(ai) && /往期未结朝议决议/.test(ai), 'sc1d D2 往期未结朝议决议入 tp1d');
ok(/sc1d·D3/.test(ai) && /p1d\.zhengwen && String\(p1d\.zhengwen\)\.trim\(\)/.test(ai), 'sc1d D3 优先用 sc1d 独立时评 zhengwen(治逐字拷贝)');
ok(/可选字段 zhengwen/.test(ai), 'sc1d D3 schema 声明独立 zhengwen 字段');
ok(/sc1d 升级·D4/.test(ai) && /_shiluHollow/.test(ai) && /_sc1dSeedFallback/.test(ai), 'sc1d D4 空账本→标 _shiluHollow(下游勿当权威史实)');
(function () {
  // 复刻 D4 空洞检测
  function hollow(p1, facts) {
    var h = !!(p1 && p1._sc1dSeedFallback);
    if (!h) {
      var ht = (facts.turn_summary && facts.turn_summary.length > 4) || (facts.shizhengji_basis && facts.shizhengji_basis.length > 4);
      var hr = ['edict_feedback', 'events', 'char_updates'].some(function (k) { return Array.isArray(facts[k]) && facts[k].length > 0; });
      h = !ht && !hr;
    }
    return h;
  }
  ok(hollow({ _sc1dSeedFallback: true }, {}) === true, 'sc1d D4行为 seed-fallback→空洞');
  ok(hollow({}, { turn_summary: '', edict_feedback: [], events: [] }) === true, 'sc1d D4行为 全空账本→空洞');
  ok(hollow({}, { turn_summary: '本回合颁盐法诏', edict_feedback: [] }) === false, 'sc1d D4行为 有实据→非空洞');
})();

// ══ sc18 A1/A2 ══
ok(/sc18·A1/.test(fu) && /GM\._militaryOutlook/.test(fu) && /war_probability/.test(fu), 'sc18 A1 军事研判持久化 GM._militaryOutlook');
ok(/上回合军事研判/.test(fu) && /_prevMO/.test(fu), 'sc18 A1 往期研判回注 tp18(战云连续性)');
ok(/sc18·A2/.test(fu) && /getNpcCognitionSnippet\(cn\)/.test(fu) && /统兵将领底细/.test(fu), 'sc18 A2 将领 sc07 认知入 tp18');
ok(/sc18·A2/.test(fu) && /_aiScenarioDigest && GM\._aiScenarioDigest\.periodVocabulary/.test(fu), 'sc18 A2 时代锚定入 tp18');
(function () {
  // 复刻 A1 war_probability clamp
  function clampP(p) { return Math.max(0, Math.min(1, parseFloat(p) || 0)); }
  ok(clampP(1.5) === 1 && clampP(-0.3) === 0 && clampP('0.6') === 0.6, 'sc18 A1行为 probability clamp 到 [0,1]');
})();

// ══ Codex 审修复 ══
ok(/无关键字匹配则跳过/.test(fu) && !/hits = \[_eh25c\.rows\[_eh25c\.rows\.length - 1\]\]/.test(fu), 'Codex-HIGH M3b event_weights 无匹配则跳过(不兜底写末行覆盖无关事件)');
ok(/if \(_tv16 != null\) GM\.factionRelations\.push\(\{ from: ds\.from/.test(fu), 'Codex-MED F1 未知关系类型不新建中立行(_tv16!=null 才 push)');
ok(/_fwd16\._sc16Turn !== GM\.turn/.test(fu) && /_sc16Turn: GM\.turn/.test(fu), 'Codex-MED F1 同回合 _sc16Turn 幂等(防同 response 叠乘)');
ok(/GM\.factionRelations\.length > 200\) GM\.factionRelations = GM\.factionRelations\.slice\(-200\)/.test(fu), 'Codex-MED F1 sc16 自身写入后封顶 200');
ok(/_prevMO\.situation \|\| _prevMO\.army_morale/.test(fu) && /态势：/.test(fu), 'Codex-MED A1 注入含 situation/army_morale(数组空也有连续性)');
ok(/GM\._turnAiResults && GM\._turnAiResults\.subcall25 && GM\._turnAiResults\.subcall25\.memory/.test(pt), 'Codex-MED M3a reflect 快照过期回退读 live GM.subcall25.memory');
(function () {
  // 复刻 F1 未知类型不建行
  function applyFwd(fr, ds, tv) { var f = fr.find(function (r) { return r.from === ds.from && r.to === ds.to; }); if (!f) { if (tv != null) fr.push({ from: ds.from, to: ds.to, type: ds.new_relation, value: tv }); } return fr; }
  var fr1 = applyFwd([], { from: 'A', to: 'B', new_relation: '暂缓议和' }, null);
  ok(fr1.length === 0, 'Codex-MED行为 未知类型+无行→不建行(不留 value:0 中立)');
  var fr2 = applyFwd([], { from: 'A', to: 'B', new_relation: '结盟' }, 70);
  ok(fr2.length === 1 && fr2[0].value === 70, 'Codex-MED行为 已知类型→正常建行');
})();

console.log('\nsmoke-endturn-multicall-upgrade ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
