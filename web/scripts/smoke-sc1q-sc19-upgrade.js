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
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-sc1q-sc19-upgrade');

// Q1: execute the real source-bound owner, not a copied historical implementation.
const vm=require('vm'), runtime={console,Date,Math,JSON,P:{time:{daysPerTurn:30}}};runtime.window=runtime;
vm.createContext(runtime);
['tm-tax-policy.js','tm-imperial-orders.js'].forEach(file=>vm.runInContext(fs.readFileSync(path.resolve(ROOT,file),'utf8'),runtime,{filename:file}));
const orders=runtime.TM.ImperialOrders;
const actualGame={turn:5,playerInfo:{factionName:'朝廷'},facs:[{id:'court',name:'朝廷'}],chars:[{id:'zhang',name:'张三',faction:'朝廷',alive:true},{id:'li',name:'李四',faction:'朝廷',alive:true}],fiscalConfig:{taxRate:0.1},_npcCommitments:{}};runtime.GM=actualGame;
const actualSources=[{npc:'张三',task:'整饬盐政',source_conv_id:'cv1',deadline:'3回合内',category:'finance'},{npc:'李四',task:'巡边',source_conv_id:'cv2',category:'dispatch'}];
orders.fromDialogue(actualGame,actualSources,[]);
const actualTask=actualGame._npcCommitments['张三'][0];
ok(actualTask&&actualGame._npcCommitments['李四'][0],'Q1 无 SC1 feedback 时两条承诺均真实入账');
ok(actualTask.deadline===3&&typeof actualTask.deadline==='number','Q1 字符串期限归一为数值');
ok(actualTask.actorId==='zhang'&&actualTask.sourceRefs.some(r=>r.type==='dialogueCommitment'&&r.id==='cv1'),'Q1 稳定人物与对话来源保留');
orders.fromDialogue(actualGame,actualSources,[]);
ok(actualGame._npcCommitments['张三'].length===1&&actualGame._npcCommitments['李四'].length===1,'Q1 重复协调不会重复立账');
ok(actualGame._npcCommitments['李四'][0].deadline===3,'Q1 缺省期限保留三回合');

// ── Q2 collective_resolutions 持久化 ──
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

// Q4: preserve category without inventing global economic rewards for a self-report.
ok(actualTask.category==='finance'&&actualGame._npcCommitments['李四'][0].category==='dispatch','Q4 实际 owner 保留原承诺分类');
const fiscalBefore=JSON.stringify(actualGame.fiscalConfig);
orders.fromDialogue(actualGame,[],[{npc:'张三',source_conv_id:'cv1',status:'completed',feedback:'已经处理'}]);
ok(actualTask.status==='executing'&&actualTask.verificationStatus==='pending_review','Q4 自报完成没有凭据时仍待核验');
ok(JSON.stringify(actualGame.fiscalConfig)===fiscalBefore,'Q4 自报财政承诺不能凭空增加全国收入或执行率');

// ── S2 关键关系落 char.relations(含 Codex 批次2 修复) ──
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

const reportsBefore=(actualGame._imperialReports||[]).length;
orders.updates(actualGame,[{id:actualTask.id,status:'completed',feedback:'已经处理'}]);
orders.fromDialogue(actualGame,[],[{npc:'张三',task:'整饬盐政',status:'completed',feedback:'已经处理'}]);
ok(actualTask.category==='finance'&&actualTask.verificationStatus==='pending_review','精确人物与任务匹配保留分类，不能免去验收');
ok((actualGame._imperialReports||[]).length===reportsBefore,'两路相同反馈不重复生成复命');
ok(JSON.stringify(actualGame.fiscalConfig)===fiscalBefore,'两路都不能凭自报完成重复影响国库或全国税率');
orders.fromDialogue(actualGame,[],[{npc:'李四',source_conv_id:'cv1',status:'failed'}]);
ok(actualTask.status==='executing','另一人物不得覆盖当前交办');
orders.acceptByPlayer(actualGame,actualTask.id);
ok(actualTask.status==='completed'&&actualTask.verificationStatus==='verified','真实玩家验收凭据仍可完成任务');

// ── S4 仅真填充才标 _enriched(Codex 广检) ──
(function () {
  var FIELDS = ['family','birthplace','ethnicity','culture','learning','faith','speechStyle','personalGoal','personality','bio','appearance','traits'];
  function filled(ech) { return FIELDS.some(function (k) { var v = ech[k]; return v != null && v !== '' && (!Array.isArray(v) || v.length > 0); }); }
  ok(filled({ bio: '寒门出身' }) === true, 'S4行为 有 bio→标 _enriched');
  ok(filled({ appearance: '须发皆白', traits: ['刚直'] }) === true, 'S4行为 只给 appearance/traits→也算填充(Codex修·原漏判)');
  ok(filled({ name: '空壳' }) === false, 'S4行为 空/烂响应→不标(留重试)');
})();

// ── Q2 闭环:决议下回合注入 + SC1 跟进反馈 + 确定性追责 ──
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
