#!/usr/bin/env node
'use strict';
/* smoke-classparty-tinyi-optim — 阶层/党派系统全面优化 S1-S5（2026-07-03）防腐线。
 * S1 满意度总闸收口(科举5处+后朝+解锁)   S2 党派死账三接(清誉/弹劾grade/盟敌对账)
 * S3 校准器强化(快照富账+faction幅度闸)  S4 廷议流入面(发言/折中/迁移注入真账)
 * S5 廷议流出面(双写挂起接力+票权党势加权)
 * 行为级优先(vm 实跑)·DOM 重依赖处源码契约级(照 repo smoke 惯例)。 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function mkCtx(extra) {
  var ctx = { console: { log: function(){}, warn: function(){}, error: function(){} }, Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Date: Date, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite, Promise: Promise, setTimeout: function(f){ if (typeof f === 'function') f(); }, clearTimeout: function(){} };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  Object.keys(extra || {}).forEach(function(k) { ctx[k] = extra[k]; });
  vm.createContext(ctx);
  return ctx;
}
function load(ctx, file) { vm.runInContext(read(file), ctx, { filename: file }); }
console.log('smoke-classparty-tinyi-optim');

/* ── S1 · 行为级：科举 bump 走总闸·预算 14 生效 ───────────────── */
console.log('— S1 · 满意度总闸收口(行为) —');
(function() {
  var ctx = mkCtx({ addEB: function(){}, toast: function(){} });
  load(ctx, 'tm-engine-constants.js');
  load(ctx, 'tm-class-engine.js');
  ctx.GM = { turn: 5, classes: [{ name: '士绅', satisfaction: 50 }] };
  ctx.P = { conf: {} };
  load(ctx, 'tm-keju-dianshi-events.js');
  var bump = ctx._kjBumpSatisfaction || (ctx.window && ctx.window._kjBumpSatisfaction);
  ok(typeof bump === 'function', '_kjBumpSatisfaction 可用');
  bump('士绅', 10, '殿试事件甲');
  var cls = ctx.GM.classes[0];
  ok(cls.satisfaction === 60, '首笔 +10 落账 (得 ' + cls.satisfaction + ')');
  bump('士绅', 10, '殿试事件乙');
  ok(cls.satisfaction === 64, '次笔被预算截到 +4·总不破 14 (得 ' + cls.satisfaction + ')');
  bump('士绅', 10, '殿试事件丙');
  ok(cls.satisfaction === 64, '预算耗尽第三笔 0 (得 ' + cls.satisfaction + ')');
  ok(Array.isArray(cls._satLedger) && cls._satLedger.length >= 2 && cls._satLedger[0].src === 'keju', '近账 _satLedger 记 keju 源');
})();
console.log('— S1 · 七处绕闸点接闸(契约) —');
ok((read('tm-keju.js').match(/gateSatisfaction/g) || []).length >= 2, 'tm-keju.js 两处(宗室/礼制)接闸');
ok(/gateSatisfaction/.test(read('tm-keju-activation.js')), 'tm-keju-activation.js 接闸');
ok(((read('tm-keju-runtime.js') + read('tm-keju-runtime-keyi.js')).match(/gateSatisfaction/g) || []).length >= 4, 'tm-keju-runtime.js 两处考生占比接闸');
ok(/gateSatisfaction\(GM, cls, _crDelta/.test(read('tm-endturn-followup.js')), '后朝 class_reactions 接闸');
var _apl = read('tm-endturn-apply.js');
ok(/gateSatisfaction\(GM, clsObj, impact/.test(_apl), '解锁 classesAffected 接闸');
ok(/applyClassPartyCoupling\(GM, clsObj, _uaApplied/.test(_apl), '耦合改用实批准量(闸后差值)');

/* ── S2 · 行为级：盟敌单源对账 ────────────────────────────────── */
console.log('— S2 · 盟敌对账(行为) —');
(function() {
  var ctx = mkCtx({ addEB: function(){} });
  load(ctx, 'tm-engine-constants.js');
  load(ctx, 'tm-social-foundation.js');
  var SF = ctx.TM && ctx.TM.SocialFoundation;
  ok(SF && typeof SF.syncPartyTruth === 'function', 'SocialFoundation.syncPartyTruth 可用');
  var GMx = {
    turn: 9,
    parties: [{ name: '东林党', influence: 30, cohesion: 50, allies: ['复社'], enemies: ['阉党'] }],
    partyState: { '东林党': { influence: 30, cohesion: 50, _synced_influence: 30, _synced_cohesion: 50, alliedWith: ['阉党'], conflictWith: ['浙党'] } }
  };
  SF.syncPartyTruth(GMx);
  var p = GMx.parties[0];
  ok(p.allies.indexOf('阉党') >= 0 && p.allies.indexOf('复社') >= 0, 'runtime 盟约并入 canonical·seed 保留 (' + p.allies.join('/') + ')');
  ok(p.enemies.indexOf('阉党') < 0, '同名冲突以 runtime 为准·过期 seed 敌意剔除');
  ok(p.enemies.indexOf('浙党') >= 0, 'runtime 敌意并入 canonical (' + p.enemies.join('/') + ')');
})();
console.log('— S2 · 清誉/弹劾grade(契约) —');
var _tv3 = (read('tm-tinyi-v3-persona.js') + (read('tm-tinyi-v3.js') + '\n' + read('tm-tinyi-v3-edict-personnel.js')) + read('tm-tinyi-v3-parties.js'));
ok(/function _ty3_bumpPartyReputation\(ps, delta\)/.test(_tv3), '清誉写入器在(此前全项目零写者)');
ok(/_ty3_bumpPartyReputation\(source, \(sourceWin - sourceLose\)/.test(_tv3), '政策胜负写清誉(倡议方)');
ok(/_ty3_bumpPartyReputation\(ps, \(oppWin - oppLose\)/.test(_tv3), '政策胜负写清誉(反对方)');
ok(/_ty3_bumpPartyReputation\(ps, -sanction \/ 2\)/.test(_tv3), '弹劾定罪扣清誉');
ok(/ps\.lastImpeachGrade = verdictGrade/.test(_tv3) && /ps\.recentImpeachGrade = verdictGrade/.test(_tv3), '弹劾 grade 三字段焊上(治罢官恒C档)');
ok(/_repIm/.test(_tv3) && /score -= Math\.round\(_repIm \/ 25\)/.test(_tv3), '判级消费清誉(清流难扳)');
ok(/_pvRep \* 0\.5/.test(_tv3), '公推票权消费清誉');
ok(/reputationBalance/.test(read('tm-three-systems-ext.js')) && /_repDecay \* 0\.92/.test(read('tm-three-systems-ext.js')), '清誉每回合向 0 缓归');

/* ── S3 · 行为级：校准器快照富账 + faction 幅度闸 ─────────────── */
console.log('— S3 · 校准器(行为) —');
(function() {
  var ctx = mkCtx({});
  load(ctx, 'tm-engine-constants.js');
  load(ctx, 'tm-class-engine.js');
  load(ctx, 'tm-party-goals.js');
  load(ctx, 'tm-fiscal-statements.js');
  load(ctx, 'tm-fiscal-engine.js');
  load(ctx, 'tm-party-class-llm-calibrator.js');
  var Cal = ctx.TM && ctx.TM.PartyClassLlmCalibrator;
  ok(Cal && typeof Cal.buildSnapshot === 'function' && typeof Cal.applyResult === 'function', '校准器 API 可用');
  var GMx = {
    turn: 7, stateTreasury: -999,
    guoku: { money:123456, grain:20, cloth:3, unit:{money:'贯',grain:'石',cloth:'匹'}, turnDays:10, flowBasis:'forecast', expenses:{fenglu:1200,junxiang:3600} },
    neitang: { money:200, grain:4, cloth:1, unit:{money:'贯',grain:'石',cloth:'匹'}, turnDays:10, flowBasis:'forecast' },
    _legitimacy: { clout: 61, pop: 44, flag: 'clout-heavy' },
    classes: [{
      name: '自耕农', satisfaction: 38, influence: 30,
      _structBaseline: 47.2, _radicalFrac: 0.31, revoltState: { phase: 'petition' },
      _satLedger: [{ t: 6, d: -3, src: 'event' }, { t: 7, d: -4, src: 'party-outcome' }, { t: 7, d: 1.2, src: 'struct-drift' }],
      regionalVariants: [{ region: '江南', satisfaction: 44 }, { region: '陕西', satisfaction: 12 }],
      demands: '减赋·治蝗', unrestLevels: {}, supportingParties: []
    }],
    parties: [{ name: '东林党', influence: 55, cohesion: 48 }],
    partyState: { '东林党': { officeCount: 6, reputationBalance: 12.5, recentImpeachWin: 1.4, recentImpeachLose: 0, alliedWith: ['复社'], conflictWith: ['阉党'] } },
    factions: [{ name: '后金', strength: 50, economy: 40, playerRelation: -60 }]
  };
  var snap = Cal.buildSnapshot(GMx, { turn: 7 });
  var sc = snap.classes[0];
  ok(sc.structBaseline === 47 && sc.radicalFrac === 0.31 && sc.revoltPhase === 'petition', '阶层快照带势位/乱民/民变相(47/' + sc.radicalFrac + '/' + sc.revoltPhase + ')');
  ok(sc.satTrend === -2.8, '满意近势=最近回合净漂 (-4+1.2=' + sc.satTrend + ')');
  ok(sc.worstRegion && sc.worstRegion.region === '陕西' && sc.worstRegion.satisfaction === 12, '最艰地域=陕西12');
  var sp = snap.parties[0];
  ok(sp.officeCount === 6 && sp.reputation === 12.5, '党派快照带占官/清誉');
  ok(sp.recentImpeach && sp.recentImpeach.win === 1.4, '党派快照带弹劾近况');
  ok(Array.isArray(sp.alliedWith) && sp.alliedWith[0] === '复社' && sp.conflictWith[0] === '阉党', '党派快照带 runtime 盟敌');
  ok(snap.legitimacy && snap.legitimacy.clout === 61, '快照带天命权重');
  ok(snap.fiscalNote && snap.fiscalNote.guoku.money === 123456 && snap.fiscalNote.stateTreasury === undefined, '快照读取共同国库字段，忽略过期别名');
  ok(snap.fiscalNote.guoku.unit.money==='贯' && snap.fiscalNote.guoku.grain===20 && snap.fiscalNote.guoku.expenses.junxiang===3600, '快照保留单位、粮账和军饷类别');
  ok(snap.fiscalNote.neitang.money===200 && snap.fiscalNote.neitang.flowBasis==='forecast', '快照读取内帑与预算标记');
  Cal.applyResult(GMx, { faction_updates: [{ faction: '后金', strengthDelta: 90, economyDelta: -50 }] }, { turn: 7 });
  var fac = GMx.factions[0];
  ok(fac.strength === 58, 'faction 幅度闸:strengthDelta 90 截到 +8 (得 ' + fac.strength + ')');
  ok(fac.economy === 32, 'faction 幅度闸:economyDelta -50 截到 -8 (得 ' + fac.economy + ')');
})();
console.log('— S3 · 冗余收敛(契约) —');
var _cal = read('tm-party-class-llm-calibrator.js');
ok(/_cirCache/.test(_cal) && /_invalidateCourtIssueRefs/.test(_cal), 'court-issue refs 批内缓存在(治 O(N×M) 重扫)');
ok(!/buildScenarioRelationIndex === 'function'\) TM\.PartyGoals\.buildScenarioRelationIndex\(source, \{ turn: turn, source: sourceName \}\)/.test(_cal), 'applyResult 显式关系索引重建已删(derive 内部自建)');
ok(/Snapshot field semantics/.test(_cal), 'system 提示带新字段语义注释');

/* ── S4 · 廷议流入面(契约) ───────────────────────────────────── */
console.log('— S4 · 廷议流入面(契约) —');
var _tv2 = read('tm-chaoyi-tinyi.js');
ok(/当事阶层\(/.test(_tv2) && /_ty3_currentTinyiMeta/.test(_tv2), '发言 prompt 注入当事阶层实况(治发言者对阶层全盲)');
ok(/此议由本党所倡/.test(_tv2) && /本党素反此议/.test(_tv2), '发言 prompt 注入党争归属(倡/反)');
ok(/本党处境：/.test(_tv2), '发言 prompt 注入占官/清誉/弹劾之挫');
ok(/党争格局：/.test(_tv2) && /同党难倒戈/.test(_tv2), '立场迁移判定注入党争格局');
ok(/局中利害：/.test(_tv2) && /所涉民情：/.test(_tv2), '折中提案注入局中利害');

/* ── S5 · 行为级：票权加权 + 双写挂起接力 ─────────────────────── */
console.log('— S5 · 票权与接力(行为) —');
(function() {
  var applied = [];
  var chars = {
    '党魁甲': { name: '党魁甲', prestige: 90, party: '大党' },
    '朝臣乙': { name: '朝臣乙', prestige: 50, party: '' },
    '朝臣丙': { name: '朝臣丙', prestige: 50, party: '' }
  };
  var ctx = mkCtx({
    findCharByName: function(n) { return chars[n] || null; },
    addCYBubble: function(){}, addEB: function(){}, toast: function(){}, escHtml: function(s){ return String(s); },
    _cy_jishiAdd: function(){}, _aiDialogueTok: function(){ return 300; }, _aiDialogueWordHint: function(){ return ''; },
    _useSecondaryTier: function(){ return false; }, closeChaoyi: function(){}, _$: function(){ return { innerHTML: '' }; },
    prompt: function(){ return ''; }, document: { getElementById: function(){ return null; } }
  });
  ctx.P = { ai: {}, conf: {} };
  ctx.GM = {
    turn: 3,
    parties: [{ name: '大党', influence: 90 }],
    partyState: { '大党': { reputationBalance: 20 } }
  };
  ctx.CY = {};
  ctx.TM = { ClassEngine: { applyPartyOutcomeToClasses: function(root, payload, info) { applied.push({ payload: payload, source: info && info.source }); } } };
  load(ctx, 'tm-chaoyi-tinyi.js');
  // 载入会覆盖部分 stub·载后复位(与 interject smoke 同坑同治)
  ctx.findCharByName = function(n) { return chars[n] || null; };
  ctx.addCYBubble = function(){}; ctx._cy_jishiAdd = function(){}; ctx.escHtml = function(s){ return String(s); };

  // 票权：1 名大党魁首(支持) vs 2 名无党朝臣(反对)——人头 1:2·加权后仍反对多但差距收窄
  ctx.CY._ty2 = { stances: {
    '党魁甲': { current: '支持' },
    '朝臣乙': { current: '反对' },
    '朝臣丙': { current: '反对' }
  } };
  var c = vm.runInContext('_ty2_countStances()', ctx);
  ok(c.support === 1 && c.oppose === 2, '人头票不变(1:2)');
  var wA = vm.runInContext('_ty2_stanceWeight("党魁甲")', ctx);
  var wB = vm.runInContext('_ty2_stanceWeight("朝臣乙")', ctx);
  ok(wA > 1.3 && wA <= 1.6, '党魁票权=党势+名望+清誉有界放大 (得 ' + wA + ')');
  ok(wB === 1, '无党平臣票权=1 (得 ' + wB + ')');
  ok(c.supportW === Math.round(wA * 10) / 10 && c.opposeW === 2, '加权票入账 (' + c.supportW + ':' + c.opposeW + ')');

  // 接力：v3 编排(CY._ty3 在)→decide 挂起不直落；退朝未销单→兜底补落一次
  ctx.CY._ty3 = {};
  ctx.CY._ty2.topic = '试议'; ctx.CY._ty2.topicType = 'other'; ctx.CY._ty2.attendees = ['党魁甲']; ctx.CY._ty2.stanceHistory = [];
  vm.runInContext('_ty2_decide("majority")', ctx);
  ok(applied.length === 0, 'v3 编排中 decide 不直落阶层账(挂起)');
  ok(ctx.CY._ty3._classOutcomePending && ctx.CY._ty3._classOutcomePending.payload, '落账意向已挂起');
  vm.runInContext('_ty2_finalEnd()', ctx);
  ok(applied.length === 1 && applied[0].source === 'tinyi2-final-fallback', '跳过用印径直退朝→兜底补落一次');
  // 已销单则退朝不再补落
  applied.length = 0;
  ctx.CY._ty3 = { _classOutcomePending: { payload: {}, turn: 3 }, _classOutcomeApplied: true };
  ctx.CY._ty2 = { stances: {} };
  vm.runInContext('_ty2_finalEnd()', ctx);
  ok(applied.length === 0, 'v3 用印已落账(销单)→退朝不重复落');
  // 纯 v2 旁路(无 CY._ty3)→decide 直落如旧
  applied.length = 0;
  ctx.CY._ty3 = null;
  ctx.CY._ty2 = { topic: '旁路议', topicType: 'other', attendees: ['党魁甲'], stanceHistory: [], stances: { '党魁甲': { current: '支持' } } };
  vm.runInContext('_ty2_decide("majority")', ctx);
  ok(applied.length === 1 && applied[0].source === 'tinyi2-decide', '纯 v2 旁路(keju/时政)decide 直落如旧');
})();
console.log('— S5 · v3 侧(契约) —');
ok((_tv3.match(/_classOutcomeApplied = true; CY\._ty3\._classOutcomePending = null/g) || []).length >= 2, 'v3 用印两路(issued/blocked)落账后销单');
ok(/wasApproved = _wS >= _wO/.test(_tv3), 'settle hook 弹劾判定与加权众议同步');
ok(/衡以党势名望/.test(_tv2), '裁决台面显示加权票(透明可查)');

console.log('\nsmoke-classparty-tinyi-optim ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
