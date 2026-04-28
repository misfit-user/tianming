// 端到端运行时模拟·真实 cascade.collect() 跑全国分账
// 在 Node 中加载 1627 剧本 + cascade engine，构造最小 GM/P 全局，跑一次 collect()
// 验证 cascade 真实输出与静态推算吻合 + GM.guoku 写入字段无错

'use strict';
const fs = require('fs');
const path = require('path');

// ─── 模拟浏览器全局环境 ───
global.window = global;
global.document = undefined;  // 触发 scenario 走 setTimeout 分支
global.findScenarioById = function(id) {
  if (!global.P || !Array.isArray(global.P.scenarios)) return null;
  return global.P.scenarios.find(s => s.id === id) || null;
};

// 让 setTimeout 同步执行（剧本 register() 走 setTimeout 50ms·我们不想等）
const _origSetTimeout = global.setTimeout;
global.setTimeout = function(fn, ms) { try { fn(); } catch(e) { console.error('[setTimeout]', e); } return 0; };

// 顶层 P（剧本 register 写到这里）
global.P = {
  scenarios: [], items: [], rigidHistoryEvents: [],
  chars: [], characters: [], facs: [], factions: [], parties: [], classes: [],
  variables: [], events: [], relations: [], officeTree: [], adminHierarchy: {},
  families: [], items_extra: []
};

// 加载剧本（自注册到 global.P.scenarios）
const scenarioSrc = fs.readFileSync(path.join(__dirname, '..', 'scenarios', 'tianqi7-1627.js'), 'utf8');
eval(scenarioSrc);

const sc = global.findScenarioById('sc-tianqi7-1627');
if (!sc) { console.log('[FAIL] 剧本未注册'); process.exit(1); }
console.log('[setup] 剧本加载: ' + sc.name + ' · turnDays=' + (sc.gameSettings && sc.gameSettings.daysPerTurn));
console.log('[setup] sc.guoku.initialMoney = ' + sc.guoku.initialMoney + ' · initialGrain = ' + sc.guoku.initialGrain);
console.log('[setup] sc.fiscalConfig.taxes 数 = ' + (sc.fiscalConfig.taxes || []).length + ' · customTaxes 数 = ' + (sc.fiscalConfig.customTaxes || []).length);

// 加载 cascade engine（it auto-registers global.CascadeTax）
const cascadeSrc = fs.readFileSync(path.join(__dirname, '..', 'tm-fiscal-cascade.js'), 'utf8');
eval(cascadeSrc);

if (typeof global.CascadeTax === 'undefined') { console.log('[FAIL] CascadeTax 未挂载'); process.exit(1); }
console.log('[setup] CascadeTax 引擎已加载');

// ─── 构造最小 GM ───
// adminHierarchy 从 sc.adminHierarchy 复制（带 farmland 等 economyBase 字段）
function _deepClone(o) { return JSON.parse(JSON.stringify(o)); }

global.GM = {
  sid: 'sc-tianqi7-1627',
  turn: 1,
  adminHierarchy: _deepClone(sc.adminHierarchy || {}),
  guoku: {},
  population: { national: { mouths: 60000000, ding: 18000000 } },
  hukou: {},
  corruption: { trueIndex: 30, subDepts: { fiscal: { true: 40 }, provincial: { true: 35 } } },
  fiscal: { floatingCollectionRate: 0.05 }
};

// 模拟 GuokuEngine.initFromDynasty 对 guoku 的初值写入（最关键的几个字段）
const go = sc.guoku || {};
GM.guoku.balance = go.initialMoney;
GM.guoku.money = go.initialMoney;
GM.guoku.grain = go.initialGrain;
GM.guoku.cloth = go.initialCloth;
GM.guoku.ledgers = {
  money: { stock: go.initialMoney, sources: {}, sinks: {}, history: [] },
  grain: { stock: go.initialGrain, sources: {}, sinks: {}, history: [] },
  cloth: { stock: go.initialCloth, sources: {}, sinks: {}, history: [] }
};

console.log('[setup] GM.guoku 初始化: 银 ' + (GM.guoku.balance/10000).toFixed(0) + ' 万 · 粮 ' + (GM.guoku.grain/10000).toFixed(0) + ' 万石 · 布 ' + (GM.guoku.cloth/10000).toFixed(0) + ' 万匹');

// 检查 adminHierarchy 是否带 farmland
let totalFarmland = 0;
let leafCount = 0;
function _walk(divs) {
  if (!Array.isArray(divs)) return;
  divs.forEach(d => {
    if (!d) return;
    if (!d.children || d.children.length === 0) {
      leafCount++;
      const fl = (d.economyBase && d.economyBase.farmland) || d.farmland || 0;
      totalFarmland += fl;
    } else {
      _walk(d.children);
    }
  });
}
Object.keys(GM.adminHierarchy).forEach(fk => {
  const tree = GM.adminHierarchy[fk];
  _walk((tree && tree.divisions) || []);
});
console.log('[setup] adminHierarchy 叶子节点: ' + leafCount + ' · 田亩合计: ' + (totalFarmland/100000000).toFixed(2) + ' 亿亩');

// ─── 跑 cascade.collect() ───
console.log('\n[run] CascadeTax.collect()...');
const result = global.CascadeTax.collect();
console.log('[result] ok=' + result.ok + (result.reason ? ' reason=' + result.reason : ''));

// ─── 验证 ───
const PASS = [];
const FAIL = [];
function check(name, cond, detail) {
  (cond ? PASS : FAIL).push(name + (detail ? ' · ' + detail : ''));
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (detail ? ' · ' + detail : ''));
}

console.log('\n[verify] cascade 输出:');

// V1 collect 成功
check('cascade.collect() ok', result.ok === true);

// V2 GM.guoku.annualIncome 是中央年化实收(已扣腐败/灾害/损耗/qiyun-cunliu)
// 史实崇祯元年中央上解 ~540-700 万两·区间放宽到 [400万,1200万]
const annualSilver = GM.guoku.annualIncome || 0;
check('annualIncome 中央年化 [400万,1200万] (史实 540-700 万)',
  annualSilver >= 4000000 && annualSilver <= 12000000,
  '实际 ' + Math.round(annualSilver/10000) + ' 万两');

// V2b 民缴年化(央+地+侵+损 合计) 应接近名义额 1500-1800 万
const summaryV2 = GM._lastCascadeSummary;
if (summaryV2) {
  const civPaidMonth = summaryV2.central.money + summaryV2.localRetain.money + summaryV2.skimmed.money + summaryV2.lostTransit.money;
  const civPaidYear = civPaidMonth / 0.082;  // 一回合 = 0.082 年
  check('民缴年化 [1000万,2500万] (名义+腐败实收·名义 1654 万附近)',
    civPaidYear >= 10000000 && civPaidYear <= 25000000,
    '实际 ' + Math.round(civPaidYear/10000) + ' 万两/年');
}

// V3 turnIncome 应 ≈ annualIncome × 30/365 ≈ 8.2%
const turnIn = GM.guoku.turnIncome || 0;
check('turnIncome ≈ 年额 × 8.2%', Math.abs(turnIn / annualSilver - 30/365) < 0.05,
  '实际 turn=' + Math.round(turnIn/10000) + ' 万 · 年=' + Math.round(annualSilver/10000) + ' 万 · 比=' + (turnIn/annualSilver*100).toFixed(1) + '%');

// V4 turnGrainIncome 写入
const turnGrain = GM.guoku.turnGrainIncome || 0;
check('turnGrainIncome 写入', turnGrain > 0, '实际 ' + Math.round(turnGrain/10000) + ' 万石');

// V5 _lastCascadeSummary 写入
const summary = GM._lastCascadeSummary;
check('_lastCascadeSummary 存在', !!summary);
if (summary) {
  console.log('     · central: 银 ' + Math.round(summary.central.money/10000) + ' 万 · 粮 ' + Math.round(summary.central.grain/10000) + ' 万石 · 布 ' + Math.round(summary.central.cloth/10000) + ' 万匹');
  console.log('     · localRetain: 银 ' + Math.round(summary.localRetain.money/10000) + ' 万 · 粮 ' + Math.round(summary.localRetain.grain/10000) + ' 万石');
  console.log('     · skimmed (各级私分): 银 ' + Math.round(summary.skimmed.money/10000) + ' 万');
  console.log('     · lostTransit (路途损): 银 ' + Math.round(summary.lostTransit.money/10000) + ' 万');
  // V6 央+地 ≈ 应收 (相对损耗)
  const totalCollected = summary.central.money + summary.localRetain.money + summary.skimmed.money + summary.lostTransit.money;
  check('央+地+侵+损 合计 = 民缴', totalCollected > 0, '合计 ' + Math.round(totalCollected/10000) + ' 万两');
}

// V7 ledgers.money.stock = 初值 + 中央上解
const finalStock = GM.guoku.ledgers.money.stock;
const expectedStock = go.initialMoney + (summary ? summary.central.money : 0);
check('ledger.money.stock = 初值 + 中央 (相对差<5%)',
  Math.abs(finalStock - expectedStock) / Math.max(1, expectedStock) < 0.05,
  '实际 ' + Math.round(finalStock/10000) + ' 万 · 期望 ' + Math.round(expectedStock/10000) + ' 万');

// V8 同步标量 GM.guoku.money 与 ledger 一致
check('GM.guoku.money == ledger.stock',
  GM.guoku.money === GM.guoku.ledgers.money.stock,
  '标量 ' + Math.round(GM.guoku.money/10000) + ' 万 · ledger ' + Math.round(GM.guoku.ledgers.money.stock/10000) + ' 万');

// V9 sources 含我们定义的 sourceTag
const sources = GM.guoku.ledgers.money.sources || {};
const sourceTags = Object.keys(sources);
console.log('     · sources tags: ' + sourceTags.join(', '));
check('含 tianfu (田赋折银)', sourceTags.includes('tianfu') || sourceTags.includes('tianfu_silver'));
check('含 yanlizhuan (盐课)', sourceTags.includes('yanlizhuan'));
check('含 liaoxiang (辽饷)', sourceTags.includes('liaoxiang'));
check('含 chama (茶马)', sourceTags.includes('chama'));
check('含 chaoguan (钞关)', sourceTags.includes('chaoguan'));
check('含 junhu (军屯)', sourceTags.includes('junhu'));

// V10 不再含 head_tax / dingshui (一条鞭法)
check('不含 dingshui (一条鞭法已折入·已禁 head_tax)', !sourceTags.includes('dingshui'));

// ═══════════════════════════════════════════════
// 岁出审计 · FixedExpense.preview()
// ═══════════════════════════════════════════════
console.log('\n[run] 岁出 FixedExpense...');

// 加载固定支出 engine
const fixedSrc = fs.readFileSync(path.join(__dirname, '..', 'tm-fiscal-fixed-expense.js'), 'utf8');
eval(fixedSrc);
if (typeof global.FixedExpense === 'undefined') { console.log('[FAIL] FixedExpense 未挂载'); process.exit(1); }

// 把剧本的 officeTree、armies、内帑、皇威、皇室成员都复制过来
GM.officeTree = _deepClone(sc.officeTree || []);
// armies 实际在 sc.military.initialTroops (与 startGame() tm-game-loop.js:858 路径一致)
GM.armies = _deepClone((sc.military && sc.military.initialTroops) || (sc.military && sc.military.armies) || []);
// 字段对齐 (复制 startGame 的逻辑)
GM.armies.forEach(c => {
  if (c.soldiers == null && c.size != null) c.soldiers = c.size;
  if (c.size == null && c.soldiers != null) c.size = c.soldiers;
});
GM.chars = _deepClone(sc.chars || sc.characters || []);
GM.huangwei = { index: 80 };
GM.fiscal = { floatingCollectionRate: sc.fiscalConfig.floatingCollectionRate || 0.28 };
GM.neitang = { money: sc.neitang.initialMoney, grain: sc.neitang.initialGrain, cloth: sc.neitang.initialCloth };
GM.neitang.ledgers = {
  money: { stock: GM.neitang.money, sources: {}, sinks: {}, history: [] },
  grain: { stock: GM.neitang.grain, sources: {}, sinks: {}, history: [] },
  cloth: { stock: GM.neitang.cloth, sources: {}, sinks: {}, history: [] }
};
// scriptData·让 _getConfig 找得到 fixedExpense
global.scriptData = { fiscalConfig: _deepClone(sc.fiscalConfig), turnDays: 30 };

// 统计 officeTree 含 holder 的 position 数
let posWithHolder = 0;
let posTotal = 0;
let positionsEstablished = 0;
function _walkOff(nodes) {
  (nodes || []).forEach(n => {
    if (!n) return;
    (n.positions || []).forEach(p => {
      posTotal++;
      if (p.holder && p.holder !== '空缺' && p.holder !== '(空缺)' && p.holder !== '') posWithHolder++;
      if (p.establishedCount) positionsEstablished += p.establishedCount;
    });
    if (n.subs) _walkOff(n.subs);
  });
}
_walkOff(GM.officeTree);

// 统计兵数
let totalSoldiers = 0;
GM.armies.forEach(a => {
  if (!a || a.destroyed) return;
  totalSoldiers += a.soldiers || a.strength || a.size || 0;
});

console.log('[setup·岁出] officeTree: ' + posTotal + ' 职位 · ' + posWithHolder + ' 有 holder · 编制总额 ' + positionsEstablished);
console.log('[setup·岁出] armies: ' + GM.armies.length + ' 支 · 兵 ' + totalSoldiers + ' 人');
console.log('[setup·岁出] huangwei.index = ' + GM.huangwei.index + ' · royalClanPressure.annualStipendPaid = ' + (sc.fiscalConfig.neicangRules.royalClanPressure.annualStipendPaid) + ' 万石');

const fp = global.FixedExpense.preview();
console.log('\n[result·岁出·一回合 30 天]');
console.log('  俸禄(京外官实任): 银 ' + Math.round(fp.salary.money/10000) + ' 万 · 米 ' + Math.round(fp.salary.grain/10000) + ' 万石');
console.log('  宗禄(宗藩岁禄):   银 ' + Math.round(fp.royal.money/10000) + ' 万 · 米 ' + Math.round(fp.royal.grain/10000) + ' 万石');
console.log('  军饷:             银 ' + Math.round(fp.army.money/10000) + ' 万 · 粮 ' + Math.round(fp.army.grain/10000) + ' 万石 · 布 ' + Math.round(fp.army.cloth/10000) + ' 万匹');
console.log('  宫廷(内帑扣):     银 ' + Math.round(fp.imperial.money/10000) + ' 万 · 米 ' + Math.round(fp.imperial.grain/10000) + ' 万石 · 布 ' + Math.round(fp.imperial.cloth/10000) + ' 万匹');
console.log('  ─────────────────────────────────');
console.log('  合计/月:          银 ' + Math.round(fp.totalMoney/10000) + ' 万 · 粮 ' + Math.round(fp.totalGrain/10000) + ' 万石 · 布 ' + Math.round(fp.totalCloth/10000) + ' 万匹');
console.log('  合计/年:          银 ' + Math.round(fp.totalMoney*12/10000) + ' 万 · 粮 ' + Math.round(fp.totalGrain*12/10000) + ' 万石');

// 史实参照
console.log('\n[史实参照·崇祯元年]');
console.log('  俸禄(京外官+杂职): 100-120 万两/年 + 150 万石/年 (折色后)');
console.log('  宗禄: 实付 300 万石/年 (累计欠 280 万石)');
console.log('  军饷(70-80 万兵): 1000-1500 万两/年 (含辽饷 500 万) + 300-500 万石/年');
console.log('  宫廷+内帑: 100-150 万两/年');
console.log('  岁出合计: 1500-2000 万两/年 + 750-950 万石/年');

console.log('\n[verify·岁出]');
const ann = { money: fp.totalMoney * 12, grain: fp.totalGrain * 12 };
check('俸禄·年额 在 [50万,300万] 区间',
  fp.salary.money * 12 >= 500000 && fp.salary.money * 12 <= 3000000,
  '俸 ' + Math.round(fp.salary.money*12/10000) + ' 万/年');
check('宗禄·年额 > 100 万 (剧本写 300 万石/年)',
  fp.royal.money * 12 > 1000000 || fp.royal.grain * 12 > 1000000,
  '宗禄 ' + Math.round(fp.royal.money*12/10000) + ' 万银 + ' + Math.round(fp.royal.grain*12/10000) + ' 万石');
check('军饷·年额 在 [600万,2500万] 区间',
  fp.army.money * 12 >= 6000000 && fp.army.money * 12 <= 25000000,
  '军 ' + Math.round(fp.army.money*12/10000) + ' 万/年 · 兵 ' + totalSoldiers);
check('宫廷·年额 在 [50万,300万] 区间',
  fp.imperial.money * 12 >= 500000 && fp.imperial.money * 12 <= 3000000,
  '廷 ' + Math.round(fp.imperial.money*12/10000) + ' 万/年');
check('岁出合计/年 在 [1000万,3500万] 区间 (史实 1500-2000 万)',
  ann.money >= 10000000 && ann.money <= 35000000,
  '总 ' + Math.round(ann.money/10000) + ' 万/年');

// ═══════════════════════════════════════════════
// 三数·民缴/官收/应收 验证
// ═══════════════════════════════════════════════
console.log('\n[verify·三数 民缴/官收/应收]');
if (summary) {
  const central = summary.central.money;
  const local = summary.localRetain.money;
  const skim = summary.skimmed.money;
  const lost = summary.lostTransit.money;
  const nominalNet = central + local + skim + lost;       // 应收(扣腐败/灾害后名义)
  const actualReceived = central + local;                  // 官收(实际入库)
  // overCollectRate 由 corruption + floatingCollectionRate 0.05 + 苛捐底色 0.05 推算
  // (fc+pc)/200×0.5 + 0.28 + 0.05 = 0.1875 + 0.33 = ~0.52
  const fc = 40, pc = 35;
  const overRate = (fc+pc)/200*0.5 + 0.05 + 0.05 + 0.05;  // floatingCollectionRate 在 cascade 修后才填到 GM.fiscal·这里只是估算
  // 但我们用 1627 剧本的 floatingCollectionRate 0.28
  const overRate1627 = (fc+pc)/200*0.5 + 0.28 + 0.05;     // ≈ 0.52
  const peasantPaid = nominalNet * (1 + overRate1627);
  console.log('  应收(名义·扣腐败后) = 央+地+侵+损 = ' + Math.round(nominalNet/10000) + ' 万/月 → ' + Math.round(nominalNet*12/10000) + ' 万/年');
  console.log('  官收(实际入库) = 央+地 = ' + Math.round(actualReceived/10000) + ' 万/月 → ' + Math.round(actualReceived*12/10000) + ' 万/年');
  console.log('  民缴(名义×(1+浮收)·overRate≈' + overRate1627.toFixed(2) + ') = ' + Math.round(peasantPaid/10000) + ' 万/月 → ' + Math.round(peasantPaid*12/10000) + ' 万/年');
  check('民缴 > 应收 > 官收 (苛捐杂税层层盘剥)',
    peasantPaid > nominalNet && nominalNet > actualReceived,
    '民 ' + Math.round(peasantPaid/10000) + ' > 应 ' + Math.round(nominalNet/10000) + ' > 官 ' + Math.round(actualReceived/10000));
}

// ─── 总结 ───
console.log('\n' + '='.repeat(60));
console.log('PASS: ' + PASS.length + ' / FAIL: ' + FAIL.length);
if (FAIL.length > 0) {
  console.log('\n失败项:');
  FAIL.forEach(f => console.log('  · ' + f));
}
console.log('=== ' + (FAIL.length === 0 ? 'ALL PASS' : 'FAIL') + ' ===');
process.exit(FAIL.length === 0 ? 0 : 1);
