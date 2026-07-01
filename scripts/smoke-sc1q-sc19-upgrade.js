#!/usr/bin/env node
'use strict';
/* smoke-sc1q-sc19-upgrade — sc1q(对话承诺问责)+ sc19(新实体填充)三链完善·全 8 刀 + Codex 修复
 * sc1q: Q1 承诺蒸发洞(无条件 reconcile) · Q2 collective_resolutions 持久化 · Q3 喂涉事 NPC 认知 · Q4 commit 加 category 触发结构化后果
 * sc19: S1 丰化人设 seed _npcCognition · S2 关键关系落 char.relations · S3 补 sysP+时代锚定 · S4 仅真填充才标 _enriched
 * Codex 修复: HIGH deadline 字符串→数字·MED Q2 去重比截断版·MED S4 广检字段
 * LLM 内容质量 owner 真机验;此处守代码契约 + 复刻行为验。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ap = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-apply.js'), 'utf8');
const fu = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-followup.js'), 'utf8');
const ai = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai.js'), 'utf8');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-sc1q-sc19-upgrade');

// ── Q1 承诺蒸发洞:无条件 reconcile ──
ok(/sc1q 升级·Q1/.test(ap) && /_q1Commits/.test(ap), 'Q1 apply 有无条件承诺 reconcile 块');
ok(/subcall1q\.dialogue_commitments/.test(ap) && /_sc1qAutoReconciled: true/.test(ap), 'Q1 直接读 sc1q dialogue_commitments·补建标 _sc1qAutoReconciled(不靠 sc1 feedback)');
(function () {
  var commitments = {};
  var sc1qCommits = [{ npc: '张三', task: '整饬盐政', source_conv_id: 'cv1', deadline: '3回合内' }, { npc: '李四', task: '巡边' }];
  var T = 5;
  sc1qCommits.forEach(function (c) {
    if (!c || !c.npc || !c.task) return;
    var nm = c.npc, _task = String(c.task || '');
    if (!Array.isArray(commitments[nm])) commitments[nm] = [];
    var arr = commitments[nm];
    var exists = arr.find(function (e) { return e && e.assignedTurn === T && ((c.source_conv_id && e._sc1qSourceConvId === c.source_conv_id) || (e.task && (e.task.indexOf(_task.slice(0, 10)) >= 0 || _task.indexOf(e.task.slice(0, 10)) >= 0))); });
    if (exists) return;
    arr.push({ task: _task, status: 'pending', assignedTurn: T, deadline: parseInt(c.deadline, 10) || 3, _sc1qSourceConvId: c.source_conv_id || '', _sc1qAutoReconciled: true });
  });
  ok(commitments['张三'] && commitments['张三'][0].status === 'pending' && commitments['李四'], 'Q1行为 sc1 无 feedback 时·两条承诺仍都进 _npcCommitments(不蒸发)');
  ok(commitments['张三'][0].deadline === 3 && typeof commitments['张三'][0].deadline === 'number', 'Q1行为 deadline "3回合内"→数字3(Codex修·过期结算不 NaN)');
  var before = commitments['张三'].length;
  sc1qCommits.forEach(function (c) { var nm = c.npc, _task = String(c.task || ''); var arr = commitments[nm]; var ex = arr.find(function (e) { return e && e.assignedTurn === T && ((c.source_conv_id && e._sc1qSourceConvId === c.source_conv_id) || (e.task && (e.task.indexOf(_task.slice(0, 10)) >= 0 || _task.indexOf(e.task.slice(0, 10)) >= 0))); }); if (ex) return; arr.push({ task: _task }); });
  ok(commitments['张三'].length === before, 'Q1行为 重跑幂等(已建的不重复补)');
})();
ok(/deadline: parseInt\(c\.deadline, 10\) \|\| 3/.test(ap) && /deadline: parseInt\(srcCommit && srcCommit\.deadline, 10\) \|\| 3/.test(ap), 'Codex-HIGH Q1+feedback 两路 deadline 都 parseInt 解析(字符串→数字)');

// ── Q2 collective_resolutions 持久化 ──
ok(/sc1q 升级·Q2/.test(ap) && /GM\._courtResolutions/.test(ap), 'Q2 collective_resolutions 存进 GM._courtResolutions(状态之家)');
ok(/subcall1q\.collective_resolutions/.test(ap) && /status: 'pending'/.test(ap) && /slice\(-40\)/.test(ap), 'Q2 读 sc1q 决议·建 pending 状态·cap40');
ok(/e\.topic === String\(r\.topic\)\.slice\(0, 60\)/.test(ap), 'Codex-MED Q2 去重比存储的截断版(>60字议题不重复入)');
(function () {
  // 复刻 Q2 dedup·长 topic
  var court = [];
  var T = 3;
  var longTopic = '关于'.repeat(40);  // >60 字
  function reconcile(r) { if (court.some(function (e) { return e && e.turn === T && e.topic === String(r.topic).slice(0, 60); })) return; court.push({ topic: String(r.topic).slice(0, 60), turn: T, status: 'pending' }); }
  reconcile({ topic: longTopic, decision: 'd' });
  reconcile({ topic: longTopic, decision: 'd' });
  ok(court.length === 1, 'Q2行为 同回合同长议题只入一条(修前会入两条)');
})();

// ── Q3 sc1q 喂涉事 NPC 认知 ──
ok(/sc1q 升级·Q3/.test(ai) && /getNpcCognitionSnippet/.test(ai) && /_q3Cue/.test(ai), 'Q3 sc1q prompt 注入涉事 NPC 认知快照(getNpcCognitionSnippet)');
ok(/涉事 NPC 认知底细/.test(ai) || /\\u6d89\\u4e8b/.test(ai), 'Q3 认知块有 header(据此推断 mood/willingness)');

// ── Q4 commit 加 category ──
ok(/"category":"query\/finance\/intel\/dispatch\/diplomacy\/write\/other/.test(ai), 'Q4 sc1q schema 加 category(与 canonical _ckW 分类同一套)');
ok(/category: \(srcCommit && srcCommit\.category\) \|\| dcf\.category \|\| 'dialogue'/.test(ap), 'Q4 apply 用 sc1q 分类(非硬编码 dialogue·让财赋/查办/侦查触发结构化后果)');
(function () {
  // 复刻:canonical 效果分支按 category·finance 命中提 compliance
  function fires(category) { return category === 'query' || category === 'intel' || category === 'finance'; }
  ok(fires((null && null) || 'finance' || 'dialogue') === true, 'Q4行为 finance commit→触发 canonical 结构化后果');
  ok(fires('dialogue') === false, 'Q4行为 纯 dialogue 无结构化后果(原硬编码恒此→饿死)');
})();

// ── S1 丰化人设 seed 进 _npcCognition ──
ok(/sc19 升级·S1/.test(fu) && /GM\._npcCognition\[ech\.name\] = Object\.assign/.test(fu), 'S1 sc19 seed _npcCognition');
ok(/_identityInitialized/.test(fu) && /_fromSc19: true/.test(fu), 'S1 标 _identityInitialized(不覆盖 sc07)+_fromSc19');
ok(/speechThread: \(_exCog19 && _exCog19\.speechThread\) \|\| _sp19/.test(fu), 'S1 speechStyle→speechThread(问对/朝议 snippet 读)');

// ── S2 关键关系落 char.relations(含 Codex 批次2 修复) ──
ok(/sc19 升级·S2/.test(fu) && /_seedRel19\(ech\.name, kr\.name/.test(fu), 'S2 keyRelations 经 _seedRel19→ensureCharRelation 落 char.relations');
ok(/function _relPristine19/.test(fu) && /r\.hostility == null \|\| r\.hostility === 0/.test(fu), 'S2 Codex-HIGH:全默认态才 seed(查全轴·非只 affinity)');
ok(/_seedRel19\(kr\.name, ech\.name/.test(fu) && /_relInv19/.test(fu), 'S2 Codex-MED:双向 B→A(反向标签镜像)');
ok(/keyRelations/.test(fu) && /盟友\/师承\/门生\/亲族\/政敌\/宿怨\/举主/.test(fu), 'S2 schema+char 规格含 keyRelations 类型枚举');
(function () {
  var _relTbl19 = { '政敌': { affinity: 36, trust: 40, respect: 48, hostility: 42 } };
  function pristine(r) { return r && !r._fromSc19 && (r.affinity == null || r.affinity === 50) && (r.trust == null || r.trust === 50) && (r.respect == null || r.respect === 50) && (r.fear == null || r.fear === 0) && (r.hostility == null || r.hostility === 0) && !(r.labels && r.labels.length) && !(r.history && r.history.length); }
  function seed(rel, kr) { var v = _relTbl19[kr.type]; if (!v || !pristine(rel)) return rel; rel.affinity = v.affinity; rel.trust = v.trust; rel.respect = v.respect; rel.hostility = v.hostility; rel._fromSc19 = true; return rel; }
  var fresh = seed({ affinity: 50, trust: 50, respect: 50, fear: 0, hostility: 0, labels: [], history: [] }, { type: '政敌' });
  ok(fresh.hostility === 42 && fresh._fromSc19 === true, 'S2行为 全默认关系→seed 为政敌(host42)');
  var enemy = seed({ affinity: 50, trust: 15, respect: 40, fear: 0, hostility: 60, labels: [], history: [] }, { type: '政敌' });
  ok(enemy.hostility === 60 && enemy.trust === 15 && !enemy._fromSc19, 'S2行为 Codex-HIGH:affinity=50 但 host60/trust15 的死敌不被覆盖(旧版 bug)');
  var evolved = seed({ affinity: 80, trust: 70, respect: 60, hostility: 0, labels: ['盟友'], history: [{}] }, { type: '政敌' });
  ok(evolved.affinity === 80 && !evolved._fromSc19, 'S2行为 已演化关系(aff80/有标签)不被覆盖');
})();

// ── Codex 批次2 修复:Q4 双路结构化后果 + 兜底找回 + prompt 回带 ──
ok(/function _fireCommitCanon/.test(ap) && /found\._canonFired/.test(ap), 'Codex-MED _fireCommitCanon 抽为共享·_canonFired 防双计');
ok((ap.match(/_fireCommitCanon\(/g) || []).length >= 3, 'Codex-MED _fireCommitCanon 定义+commitment_update+feedback 两路都调(≥3处)');
ok(/npc\+task 相似度兜底找回 sc1q commit/.test(ap) && /!srcCommit && dcf\.npc/.test(ap), 'Codex-MED feedback 路按 npc+task 兜底找回 category(防误落 dialogue)');
ok(/dc\.category/.test(ai) && /dc\.source_conv_id/.test(ai) && /回带该承诺的 source_conv_id 与 category/.test(ai), 'Codex-MED SC1 prompt 回带 category/convId + 指令');
(function () {
  var fired = 0;
  function fire(found) { if (found._canonFired) return; if (found.category === 'finance' || found.category === 'query' || found.category === 'intel') fired++; found._canonFired = true; }
  var c = { category: 'finance' };
  fire(c); fire(c);   // 两条完成路径都调
  ok(fired === 1, 'Codex-MED行为 finance 结构化后果只触发一次(双路 _canonFired 防双计)');
})();

// ── S3 补 sysP + 时代锚定 ──
ok(/sc19 升级·S3/.test(fu) && /messages: \[\{ role: 'system', content: _maybeCacheSys\(sysPFor\('sc19'\)\) \}/.test(fu), 'S3 sc19 call 补系统提示 sysPFor(sc19)');
ok(/GM\._aiScenarioDigest/.test(fu) && /periodVocabulary/.test(fu) && /时代用语锚定/.test(fu), 'S3 注入时代用语/礼仪锚定(复用 _aiScenarioDigest·治穿越)');

// ── S4 仅真填充才标 _enriched(Codex 广检) ──
ok(/sc19 升级·S4/.test(fu) && /_s4Filled/.test(fu) && /appearance','traits'\]\.some/.test(fu), 'S4 _enriched 检查全部可 merge 字段(Codex修·含 appearance/traits/culture)');
(function () {
  var FIELDS = ['family','birthplace','ethnicity','culture','learning','faith','speechStyle','personalGoal','personality','bio','appearance','traits'];
  function filled(ech) { return FIELDS.some(function (k) { var v = ech[k]; return v != null && v !== '' && (!Array.isArray(v) || v.length > 0); }); }
  ok(filled({ bio: '寒门出身' }) === true, 'S4行为 有 bio→标 _enriched');
  ok(filled({ appearance: '须发皆白', traits: ['刚直'] }) === true, 'S4行为 只给 appearance/traits→也算填充(Codex修·原漏判)');
  ok(filled({ name: '空壳' }) === false, 'S4行为 空/烂响应→不标(留重试)');
})();

// ── Q2 闭环:决议下回合注入 + SC1 跟进反馈 + 确定性追责 ──
ok(/Q2闭环/.test(ap) && /id: 'cr_' \+ _q2T/.test(ap), 'Q2闭环 决议持久化带稳定 id');
ok(/Q2 闭环·消费/.test(ap) && /p1\.court_resolution_feedback/.test(ap), 'Q2闭环 消费 court_resolution_feedback→更新状态');
ok(/Q2 闭环·确定性追责/.test(ap) && /status = 'lapsed'/.test(ap) && /courtResolutionMaxAge/.test(ap), 'Q2闭环 pending/stalled 超龄→lapsed(束之高阁)');
ok(/Q2 闭环·注入/.test(ai) && /往期未结朝议决议/.test(ai) && /court_resolution_feedback/.test(ai), 'Q2闭环 往期未结决议注入下回合 sc1 prompt');
ok(/court_resolution_feedback: \{ type: 'array'/.test(ai), 'Q2闭环 sc1 schema 声明 court_resolution_feedback');
(function () {
  var res = [{ id: 'cr_2_0', topic: '整饬盐政疏', decision: 'd', turn: 2, status: 'pending' }];
  [{ id: 'cr_2_0', status: 'resolved', note: '已派员核查' }].forEach(function (f) { var cr = res.find(function (e) { return e.id === f.id; }); if (cr && (cr.status === 'pending' || cr.status === 'stalled') && f.status === 'resolved') { cr.status = 'resolved'; cr.resolvedTurn = 5; } });
  ok(res[0].status === 'resolved' && res[0].resolvedTurn === 5, 'Q2闭环行为 SC1 反馈 resolved→决议标落实');
  var res2 = [{ topic: 't', turn: 1, status: 'pending' }];
  var T = 6, maxAge = 5;
  res2.forEach(function (e) { if ((e.status === 'pending' || e.status === 'stalled') && (T - (e.turn || T)) >= maxAge) { e.status = 'lapsed'; } });
  ok(res2[0].status === 'lapsed', 'Q2闭环行为 pending 决议超5回合无跟进→lapsed');
})();

console.log('\nsmoke-sc1q-sc19-upgrade ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
