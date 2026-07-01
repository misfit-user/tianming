#!/usr/bin/env node
/* eslint-env node */
// smoke-social-foundation.js — 社会层地基实跑断言（2026-06-12）
// 验：结构输入（税负/灾域/战区/欠饷/民心）→ 暴露度按身份桶 → 结构基线 →
//     稳定器缓变（近账可查）→ 议程引擎（各阶层各异/生命周期/得偿回礼/AI 槽不覆盖种子）→
//     党派单源对账（双写者合流/盟敌/议程保鲜）→ 五处接线源码契约。
'use strict';

const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js'));   // TM.FieldPipes（税负因子）
require(path.join(WEB, 'tm-engine-constants.js'));  // 供 class-engine read()
require(path.join(WEB, 'tm-class-engine.js'));      // TM.ClassEngine（总闸·得偿回礼用）
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}

function mkWorld(opts) {
  opts = opts || {};
  const leaves = [];
  for (let i = 0; i < 10; i++) {
    leaves.push({
      name: '县' + i,
      taxRate: opts.taxRate != null ? opts.taxRate : 1,
      minxin: opts.minxin != null ? opts.minxin : 55,
      statusEffects: (opts.disasterLeaves || 0) > i ? [{ kind: 'disaster', name: '旱蝗' }] : [],
      warZone: (opts.warLeaves || 0) > i
    });
  }
  const GM = { turn: opts.turn != null ? opts.turn : 10, classes: opts.classes || [], parties: opts.parties, partyState: opts.partyState, armies: opts.armies || [] };
  const P = { adminHierarchy: { player: { divisions: [{ name: '某省', children: leaves }] } } };
  return { GM, P, leaves };
}

// ── 1. 结构输入 ──
const w1 = mkWorld({ taxRate: 1.3, disasterLeaves: 3, warLeaves: 1, minxin: 40, armies: [{ name: 'a', payArrearsMonths: 4 }, { name: 'b', payArrearsMonths: 0 }] });
const in1 = SF.structuralInputs(w1.GM, w1.P);
ok(in1.taxFactor === 1.3, '结构输入·税负因子 1.3 (got ' + in1.taxFactor + ')');
ok(in1.disasterShare === 0.3 && in1.warShare === 0.1, '结构输入·灾域 30%/战区 10%');
ok(in1.arrearsMonths === 2 && in1.minxin === 40, '结构输入·欠饷均 2 月/民心 40');
ok(SF.structuralInputs(w1.GM, w1.P) === in1, '结构输入·同回合缓存');

// ── 2. 身份桶+暴露度 ──
ok(SF.bucketOf({ name: '军户' }) === 'military', '桶·军户→military');
ok(SF.bucketOf({ name: '商人', economicRole: '流通' }) === 'trade', '桶·商人→trade');
ok(SF.bucketOf({ name: '宗室', economicRole: '治理' }) === 'governing', '桶·宗室→governing');
ok(SF.bucketOf({ name: '自耕农', economicRole: '生产' }) === 'agrarian', '桶·自耕农→agrarian');
ok(SF.classExposure({ name: '自耕农', economicIndicators: { taxBurden: 90 } }).tax === 0.9, '暴露·剧本 taxBurden 优先');
ok(SF.classExposure({ name: '宗室', economicRole: '治理' }).tax === 0.15, '暴露·治理桶税暴露低');

// ── 3. 结构基线：同一实况下各阶层势位不同 ──
const sbP = SF.structuralBaseline({ name: '自耕农', economicRole: '生产', economicIndicators: { taxBurden: 80 } }, in1);
const sbG = SF.structuralBaseline({ name: '宗室', economicRole: '治理' }, in1);
const sbM = SF.structuralBaseline({ name: '军户' }, in1);
ok(sbP.baseline < 40, '基线·重税+灾+低民心 → 农 ' + sbP.baseline + ' 低');
ok(sbG.baseline > sbP.baseline + 15, '基线·治理桶 ' + sbG.baseline + ' 显著高于农');
ok(sbM.parts.some(s => /欠饷/.test(s)), '基线·军户主因含欠饷 (' + sbM.parts.join('/') + ')');

// ── 4. 稳定器缓变（tick 内）──
const clsLow = { name: '自耕农', economicRole: '生产', satisfaction: 5, influence: 25, demands: '减赋免派·救荒' };
const clsHigh = { name: '宗室', economicRole: '治理', satisfaction: 95, influence: 42, demands: '增岁禄' };
const w4 = mkWorld({ taxRate: 1.3, disasterLeaves: 3, minxin: 40, classes: [clsLow, clsHigh], turn: 20 });
SF.tick(w4.GM, w4.P);
ok(clsLow.satisfaction > 5 && clsLow.satisfaction <= 5.95, '缓变·低于势位回升慢 ≤0.9（不对称·2026-06-16）(got ' + clsLow.satisfaction + ')');
ok(clsHigh.satisfaction < 95 && clsHigh.satisfaction >= 92.9, '缓变·高于势位恶化向落快 ≤1.92（旧对称1.2·契约有意改·2026-06-16）(got ' + clsHigh.satisfaction + ')');
ok(clsLow._satLedger.some(e => e.src === 'struct-drift' && /结构回归/.test(e.why)), '缓变·近账「结构回归」可查');
ok(typeof clsLow._structBaseline === 'number' && Array.isArray(clsLow._structParts), '缓变·势位+主因挂账供 UI');

// ── 4b. 不对称缓变（升米恩斗米仇·2026-06-16）：恶化向(快) 显著 > 回升向(慢) ──
const wAsym = mkWorld({ taxRate: 1, minxin: 55, turn: 30 });
const blN = SF.structuralBaseline({ name: '测试农', economicRole: '生产' }, SF.structuralInputs(wAsym.GM, wAsym.P)).baseline;
const cUp = { name: '测试农', economicRole: '生产', satisfaction: blN - 10, influence: 20 };
const cDn = { name: '测试农', economicRole: '生产', satisfaction: blN + 10, influence: 20 };
wAsym.GM.classes = [cUp, cDn];
SF.tick(wAsym.GM, wAsym.P);
const dUp = Math.round((cUp.satisfaction - (blN - 10)) * 100) / 100;
const dDn = Math.round((cDn.satisfaction - (blN + 10)) * 100) / 100;
ok(dUp > 0 && dDn < 0, '不对称·同|gap| 回升向上(' + dUp + ')、恶化向下(' + dDn + ')');
ok(Math.abs(dDn) >= Math.abs(dUp) * 1.8, '不对称·恶化快于回升 ≥1.8×（rate 0.18 vs 0.08·' + Math.abs(dDn) + ' vs ' + Math.abs(dUp) + '）');

// ── 5. 议程引擎：各异/触发/种子 ──
ok(clsLow.demands !== clsHigh.demands, '议程·农/宗室诉求各异');
const itemsLow = clsLow._agenda.items, itemsHigh = clsHigh._agenda.items;
ok(itemsLow.some(it => it.kind === 'tax'), '议程·重税触发农「' + (itemsLow.find(it => it.kind === 'tax') || {}).text + '」');
ok(itemsLow.some(it => it.kind === 'disaster'), '议程·灾域触发赈济条目');
ok(!itemsHigh.some(it => it.kind === 'tax'), '议程·治理桶税暴露低不触发减赋');
ok(itemsLow.some(it => it.kind === 'seed' && it.text === '减赋免派'), '议程·剧本种子保留');
ok(clsLow._seedDemands.length === 2, '议程·种子快照 2 条');
ok(/减田赋|开仓赈济/.test(clsLow.currentDemand), '议程·急者顶到 currentDemand (got ' + clsLow.currentDemand + ')');

// 军户欠饷条目
const clsMil = { name: '军户', satisfaction: 22, influence: 30, demands: '清饷' };
const w5 = mkWorld({ classes: [clsMil], armies: [{ name: 'x', payArrearsMonths: 4 }], turn: 21 });
SF.tick(w5.GM, w5.P);
ok(clsMil._agenda.items.some(it => it.kind === 'arrears'), '议程·欠饷触发军户「清积欠」');

// AI 槽：补充不覆盖
SF.setAiDemand(w4.GM, clsLow, '严惩本府贪吏', { turn: 20, source: 'smoke' });
ok(clsLow._agenda.items.some(it => it.id === 'ai:demand' && it.text === '严惩本府贪吏'), '议程·AI 槽立项');
ok(clsLow._agenda.items.some(it => it.kind === 'seed'), '议程·AI 补充后种子仍在（不再整体覆盖）');
SF.setAiDemand(w4.GM, clsLow, '另一诉求', { turn: 20, source: 'smoke' });
ok(clsLow._agenda.items.filter(it => it.kind === 'ai').length === 1, '议程·AI 槽只占一席（替换不堆积）');

// 生命周期：条件解除 → 得偿 + 回礼
const clsRes = { name: '自耕农', economicRole: '生产', satisfaction: 30, influence: 25, demands: '减赋' };
const wBad = mkWorld({ taxRate: 1.3, classes: [clsRes], turn: 30 });
SF.tick(wBad.GM, wBad.P);
ok(clsRes._agenda.items.some(it => it.kind === 'tax'), '生命周期·先立项');
const satBefore = clsRes.satisfaction;
const wGood = mkWorld({ taxRate: 1.0, minxin: 60, classes: [clsRes], turn: 31 });
SF.tick(wGood.GM, wGood.P);
ok(!clsRes._agenda.items.some(it => it.kind === 'tax'), '生命周期·税轻条目得偿撤项');
ok(clsRes._agendaResolved.some(r => r.kind === 'tax'), '生命周期·得偿入档');
ok(clsRes._satLedger.some(e => e.src === 'agenda-resolved'), '生命周期·得偿回礼过总闸入近账');
ok(clsRes.satisfaction > satBefore, '生命周期·得偿+回归 满意回升 ' + satBefore + '→' + clsRes.satisfaction);

// ── 6. 党派单源对账 ──
const parties = [{ name: '清流', influence: 40, cohesion: 60, currentAgenda: '旧议程', _agendaTurn: 1 }];
const partyState = { '清流': { name: '清流', influence: 40, cohesion: 60, historyLog: [] } };
const w6 = mkWorld({ parties, partyState, turn: 12 });
SF.syncPartyTruth(w6.GM);
// 引擎侧涨 6（如弹劾胜），AI 侧 canonical 涨 3 —— 两写者都不丢
partyState['清流'].influence = 46;
parties[0].influence = 43;
const sync2 = SF.syncPartyTruth(w6.GM);
ok(parties[0].influence === 49 && partyState['清流'].influence === 49, '对账·引擎Δ+6 与 AI Δ+3 合流 = 49 (got ' + parties[0].influence + ')');
ok(partyState['清流'].historyLog.some(e => e.field === 'influence'), '对账·引擎并账入近账');
// 议程保鲜：8 回合无鲜议程 → 由活跃目标派生
globalThis.TM.PartyGoals = { getActiveGoals: function() { return [{ text: '请开言路·整肃纲纪', priority: 92 }]; } };
SF.syncPartyTruth(w6.GM);
ok(parties[0].currentAgenda === '请开言路·整肃纲纪' && parties[0]._agendaSource === 'party-goal', '对账·陈旧议程由活跃目标保鲜');
delete globalThis.TM.PartyGoals;

// ── 6.5 地域分账（backlog 落地）──
const clsReg = {
  name: '自耕农', economicRole: '生产', satisfaction: 40, influence: 25, demands: '减赋',
  regionalVariants: [
    { region: '陕西', satisfaction: 10, distinguishing: '三年大旱' },
    { region: '江南', satisfaction: 38, distinguishing: '赋重有副业' }
  ]
};
// 世界：前 5 县归「陕西」重灾，后 5 县归「江南」平稳 —— 自建两顶级区划
const regLeaves = (tax, dis, mx, prefix) => Array.from({ length: 5 }, (_, i) => ({
  name: prefix + i, taxRate: tax, minxin: mx, statusEffects: dis > i ? [{ kind: 'disaster' }] : [], warZone: false
}));
const wReg = {
  GM: { turn: 40, classes: [clsReg], armies: [] },
  P: { adminHierarchy: { player: { divisions: [
    { name: '陕西', children: regLeaves(1.3, 4, 25, '陕县') },
    { name: '江南', children: regLeaves(1.0, 0, 62, '吴县') }
  ] } } }
};
const liShan = SF.localInputsFor(wReg.GM, wReg.P, '陕西');
const liWu = SF.localInputsFor(wReg.GM, wReg.P, '江南');
ok(liShan && liShan.disasterShare === 0.8 && liShan.taxFactor === 1.3, '地域·陕西局部输入（灾80%·税1.3）');
ok(liWu && liWu.disasterShare === 0 && liWu.minxin === 62, '地域·江南局部输入');
ok(SF.localInputsFor(wReg.GM, wReg.P, '陕西') === liShan, '地域·局部输入同回合缓存');
SF.tick(wReg.GM, wReg.P);
const vShan = clsReg.regionalVariants[0], vWu = clsReg.regionalVariants[1];
ok(typeof vShan._satLocal === 'number' && typeof vShan._structBaseline === 'number', '地域·变体活化（_satLocal/势位）');
ok(vShan._structBaseline < vWu._structBaseline - 10, '地域·重灾地势位显著更低 (' + vShan._structBaseline + ' vs ' + vWu._structBaseline + ')');
ok(vShan.satisfaction >= 10 && vWu.satisfaction !== vShan.satisfaction, '地域·分账各走各的');
// AI 指域事件
ok(SF.applyRegionalDelta(wReg.GM, clsReg, '陕西', 8, { turn: 40 }) === true, '地域·指域事件命中变体');
ok(vShan.satisfaction > 10, '地域·陕西分账受惠 (got ' + vShan.satisfaction + ')');
ok(SF.applyRegionalDelta(wReg.GM, clsReg, '不存在之地', 8, {}) === false, '地域·无此变体不误伤');

// ── 7. 接线源码契约 ──
function srcHas(file, re, msg) {
  const s = fs.readFileSync(path.join(WEB, file), 'utf8');
  ok(re.test(s), msg);
}
srcHas('tm-endturn-core.js', /TM\.SocialFoundation\.tick/, 'endturn-core：SocialFoundation.tick 挂载');
srcHas('index.html', /tm-social-foundation\.js/, 'index.html：模块已挂载');
srcHas('tm-endturn-prompt.js', /【阶层正册】/, 'prompt：阶层正册注入（旧版对阶层全盲）');
srcHas('tm-endturn-prompt.js', /·议程:/, 'prompt：党派数值行带议程');
srcHas('tm-endturn-apply.js', /_agendaTurn = GM\.turn/, 'apply：new_agenda 保鲜戳');
srcHas('tm-endturn-apply.js', /_synced_influence = party\.influence/, 'apply：AI 写党势即时镜像 partyState');
srcHas('tm-class-engine.js', /SF\.setAiDemand|setAiDemand === 'function'/, 'class-engine：new_demands 走议程槽');
srcHas('phase8-formal-rightrail.js', /rightSatLedgerRows/, 'UI：满意近账');
srcHas('phase8-formal-rightrail.js', /rightClassRegionRows/, 'UI：地域分账');
srcHas('tm-class-engine.js', /applyRegionalDelta/, 'class-engine：cc.region 指域转发');
srcHas('tm-endturn-prompt.js', /最艰:/, 'prompt：正册带最艰地域');
srcHas('tm-endturn-prompt.js', /party_relation_changes/, 'prompt：党派关系通道教学');
srcHas('tm-endturn-apply.js', /party_relation_changes/, 'apply：党派关系处理器');
srcHas('tm-ai-schema.js', /party_relation_changes/, 'schema：党派关系通道声明');
srcHas('tm-ai-output-validator.js', /party_relation_changes/, 'validator：党派关系白名单');
srcHas('phase8-formal-map.js', /localityLayer/, '军绑：聚落层名册');
srcHas('phase8-formal-map.js', /regionHint/, '军绑：剧本 regionHint 扩展点');
srcHas('phase8-formal-map.js', /分驻/, '军绑：散驻分摊');
srcHas('scenarios/tianqi7-1627.js', /regionHint"?:\s*['"]北直隶['"]/, '剧本：京营/蓟州 regionHint');
srcHas('phase8-formal-rightrail.js', /rightAgendaChips/, 'UI：议程条目徽');
srcHas('phase8-formal-rightrail.js', /rightPartyLedgerRows/, 'UI：党势近账');
srcHas('phase8-formal-bridge.js', /tmrp-ledger-row/, 'CSS：近账行样式');

console.log('\n[smoke-social-foundation] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
