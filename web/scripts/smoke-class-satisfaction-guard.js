#!/usr/bin/env node
/* eslint-env node */
// smoke-class-satisfaction-guard.js — 阶层满意度治本守卫（2026-06-12）
// 验五病根修复：①方向感知（标签只读事由·惠政反转）②权威反转（AI delta 为主·矩阵为先验）
// ③总预算闸（多源同回合净变动封顶+近账）④读病（合法 0 不读成 50）⑤党派胜负耦合限幅
// ＋校准器关闸源码契约（绝对值禁设·demands 不覆盖）。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WEB = path.join(__dirname, '..');

const ctx = { console, Date, JSON, Math, GM: { turn: 12 }, P: {}, scriptData: {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['tm-engine-constants.js', 'tm-class-engine.js'].forEach(function(f) {
  vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
});
const CE = ctx.TM.ClassEngine, EC = ctx.TM.EngineConstants;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}
function mkRoot() {
  const r = { turn: 12, population: { national: { mouths: 1000 }, byClass: {} }, minxin: { alerts: [] }, classes: [] };
  EC.applyTemplate(r, 'ming');
  return r;
}

// ── ① 方向感知 ──
ok(CE.deriveDirection('朝廷蠲免赋税并放粮赈济') === 1, '① 蠲赈减免 → 惠政 +1');
ok(CE.deriveDirection('加派辽饷·摊派各府') === -1, '① 加征摊派 → 苛政 -1');
ok(CE.deriveDirection('市面如常') === 0, '① 无方向词 → 0');
ok(CE.deriveDirection('蠲免一半·其余加征') === 0, '① 惠虐并见 → 0（矩阵静默信 AI）');

const r1 = mkRoot();
const peasant = { name: '佃农', size: '30%', satisfaction: 10, influence: 10, demands: '减赋免派·禁止兼并', description: '赋役最重，最易破产' };
r1.classes = [peasant];
const c1 = CE.applyClassChange(r1, peasant, { name: '佃农', reason: '朝廷蠲免赋税并放粮赈济灾民' }, { turn: 12, source: 'smoke' });
ok(c1.direction === 1 && c1.applied.satisfaction > 0, '① 惠政对受害最重阶层为正向 (applied=' + c1.applied.satisfaction + ')');
ok(peasant.satisfaction === 20, '① 佃农 10→20（tax 基线 -15 反转 +15·clamp ±10）');
// 旧病根：阶层自身静态文本不再当事由匹配
const r1b = mkRoot();
const peasant2 = { name: '佃农', size: '30%', satisfaction: 30, influence: 10, demands: '减赋免派·禁止兼并', description: '赋役最重' };
r1b.classes = [peasant2];
const c1b = CE.applyClassChange(r1b, peasant2, { name: '佃农', reason: '与税赋无关的寻常往来' }, { turn: 12, source: 'smoke' });
ok(c1b.tags.indexOf('corvee') < 0 && c1b.tags.indexOf('privilege') < 0, '① 静态 demands/description 不再派生标签（旧版必中 corvee/privilege）');

// ── ② 权威反转 ──
const r2 = mkRoot();
const gentry = { name: '士绅', size: '12%', satisfaction: 50, influence: 50 };
r2.classes = [gentry];
const c2 = CE.applyClassChange(r2, gentry, { name: '士绅', satisfaction_delta: 99, influence_delta: -99, reason: '加税徭役' }, { turn: 12, source: 'smoke' });
ok(c2.ai.satisfaction === 12 && c2.ai.influence === -8, '② AI delta clamp ±12/±8');
ok(c2.applied.satisfaction === 12, '② 异号信 AI（旧版被矩阵 30% 限幅夹成 -3）');
ok(gentry.satisfaction === 62, '② 50→62');
// 同号取强者不叠加
const r2b = mkRoot();
const farmer = { name: '自耕农', size: '20%', satisfaction: 40, influence: 25 };
r2b.classes = [farmer];
const c2b = CE.applyClassChange(r2b, farmer, { name: '自耕农', satisfaction_delta: 5, reason: '蠲免田赋' }, { turn: 12, source: 'smoke' });
ok(c2b.applied.satisfaction === 10, '② 同号取强者：AI+5 与基线+10(反转夹10) → +10 非 +15 (got ' + c2b.applied.satisfaction + ')');

// ── ③ 总预算闸 ──
const c3 = CE.applyClassChange(r2, gentry, { name: '士绅', satisfaction_delta: -12, reason: '又有变故' }, { turn: 12, source: 'smoke' });
ok(c3.applied.satisfaction === -12 && gentry.satisfaction === 50, '③ 同回合反向变化按净额生效 (got ' + c3.applied.satisfaction + ')');
ok(gentry._satBudget && gentry._satBudget.net === 0 && gentry._satBudget.used === 24, '③ 预算保留累计量并独立记录净额');
ok(Array.isArray(gentry._satLedger) && gentry._satLedger.length === 2, '③ 近账逐笔（2 条）');
// 跨回合预算重置
r2.turn = 13;
const c3b = CE.applyClassChange(r2, gentry, { name: '士绅', satisfaction_delta: -6, reason: '新回合变故' }, { turn: 13, source: 'smoke' });
ok(c3b.applied.satisfaction === -6, '③ 新回合预算重置 (got ' + c3b.applied.satisfaction + ')');
// gate 直接调用
const gz = CE.gateSatisfaction(r2, gentry, 0, { turn: 13 });
ok(gz.approved === 0 && gentry._satLedger.length === 3, '③ 零额不入账');

// ── ④ 读病修：合法 0 ──
const r4 = mkRoot();
const zero = { name: '军户', size: '2%', satisfaction: 0, influence: 20 };
r4.classes = [zero];
const c4 = CE.applyClassChange(r4, zero, { name: '军户', satisfaction_delta: -5, reason: '欠饷累月' }, { turn: 12, source: 'smoke' });
ok(c4.before.satisfaction === 0 && zero.satisfaction === 0, '④ 0 读为 0（旧版 ||50 读成 50→45 跳变）');
CE.applyClassChange(r4, zero, { name: '军户', satisfaction_delta: 6, reason: '朝廷补饷清欠' }, { turn: 12, source: 'smoke' });
ok(zero.satisfaction === 6, '④ 0 有恢复路径 (got ' + zero.satisfaction + ')');

// ── ⑤ 党派胜负耦合限幅 ──
const r5 = mkRoot();
const sdf = { name: '士大夫', satisfaction: 30, influence: 88, supportingParties: [{ class: '清流', affinity: 1 }] };
r5.classes = [sdf];
const po = CE.applyPartyOutcomeToClasses(r5, { partyDeltas: { '清流': -20 } }, { turn: 12, source: 'smoke' });
ok(po.ok && po.applied[0].delta === -4, '⑤ 单次胜负 clamp ±4 (got ' + po.applied[0].delta + ')');
ok(sdf.satisfaction === 26, '⑤ 30→26');
ok(sdf._satLedger && sdf._satLedger.length === 1, '⑤ 胜负耦合也入近账');
// 连环胜负同回合也被总闸拦住
for (let i = 0; i < 6; i++) CE.applyPartyOutcomeToClasses(r5, { partyDeltas: { '清流': -20 } }, { turn: 12, source: 'smoke' });
ok(sdf.satisfaction >= 16, '⑤ 连败同回合净跌 ≤14 (sat=' + sdf.satisfaction + ')');

// ── ⑥ partyState 关系播种 ──
const r6 = mkRoot();
r6.parties = [{ name: '甲党', influence: 50, allies: ['乙党'], enemies: ['丙党', '丁党'] }];
CE.applyClassPartyCoupling(r6, { name: 'x', supportingParties: [{ class: '甲党', affinity: 1 }] }, 2, { turn: 12 });
ok(r6.partyState['甲党'].alliedWith.join() === '乙党' && r6.partyState['甲党'].conflictWith.join() === '丙党,丁党', '⑥ 剧本盟敌播种进 partyState');

// ── ⑦ 校准器源码契约 ──
const cal = fs.readFileSync(path.join(WEB, 'tm-party-class-llm-calibrator.js'), 'utf8');
ok(/绝对值通道关闸/.test(cal) && /pushSat\(absTarget - absCur/.test(cal), '⑦ 校准器绝对值→差值过闸');
ok(/gateSatisfaction === 'function'/.test(cal), '⑦ 校准器 delta 路接总闸');
ok(/Never return absolute satisfaction or cohesion values/.test(cal), '⑦ 校准器系统提示禁绝对值');
ok(/never reuse the same demand wording across different classes/.test(cal), '⑦ 校准器系统提示禁诉求雷同');
ok(/setAiDemand/.test(cal), '⑦ 校准器 demands 走议程槽不覆盖');
ok(cal.indexOf("demands: ['short demand']") < 0, '⑦ 英文模板诉求示例已除（议程雷同源之一）');

console.log('\n[smoke-class-satisfaction-guard] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
