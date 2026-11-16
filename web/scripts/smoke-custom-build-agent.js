/* smoke-custom-build-agent.js — 自拟营建 agent · A1 验证
 *   覆盖：inspectRegion 勘地（确定性核心·node 可测）+ appraise 各回落路径 + 桩 LLM 单发核定。
 *   真机（owner BYOK）验：点【请有司核议】→ 真 LLM 当场出核议帖。
 */
'use strict';
var path = require('path');
var CBA = require(path.join(__dirname, '..', 'tm-custom-build-agent.js'));
// A2 硬门依赖：tm-building-works 在 node 下只 module.exports（不挂 window.TM）→ 手动挂到 global.TM 供 agent 读
global.TM = global.TM || {};
global.TM.BuildingWorks = require(path.join(__dirname, '..', 'tm-building-works.js'));

var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }

function mkSave() {
  var div = {
    name: '顺天府', regionType: '府',
    economyBase: { farmland: 120000, commerceVolume: 80000, saltProduction: 0, mineralProduction: 50000, maritimeTradeVolume: 0 },
    populationDetail: { mouths: 900000, ding: 200000, carryingCapacity: 1500000 },
    publicTreasury: { money: { stock: 60000 } },
    fiscalDetail: { retainedBudget: 240000 },
    buildings: [{ name: '卫所' }, { name: '文庙' }],
    fortLevel: 2,  // 内陆·无 coastalDefense 字段(真实内陆地块如此·沿海判定同 tm-coastal-raid「有此字段即沿海」)
    borderRisk: 30, troops: 8000, strategicValue: '京畿门户', armyPressure: 40,
    officeVacancy: 1, governor: '某甲', corruptionLocal: 55, minxin: 62
  };
  var coastalDiv = {
    name: '登州', regionType: '州',
    economyBase: { farmland: 30000, commerceVolume: 20000, maritimeTradeVolume: 15000, fishingProduction: 8000 },
    populationDetail: { mouths: 200000, ding: 50000 },
    coastalDefense: 1, fortLevel: 1, borderRisk: 10, troops: 1500, officeVacancy: 0
  };
  var ah = { player: { divisions: [div, coastalDiv] } };
  // 区划只留游戏里那份（GM·2026-11-15）：营造 agent 读 GM 的区划；这里让 GM 与 P 共用这棵树，同正式游戏
  global.GM = Object.assign({}, global.GM || {}, { adminHierarchy: ah });
  return {
    adminHierarchy: ah,
    ai: { key: 'sk-test' },
    conf: {}
  };
}

// ── 1. inspectRegion 勘地（内陆·全字段） ──
(function () {
  var P = mkSave();
  var r = CBA.inspectRegion('顺天府', { P: P });
  ok(r.ok, 'inspectRegion 找到顺天府');
  ok(r.data && r.data.name === '顺天府', 'data.name 正确');
  ok(r.data.geography.coastal === false, '顺天府内陆 coastal=false');
  ok(r.data.geography.products.indexOf('矿') >= 0, '识别物产·矿(mineralProduction>0)');
  ok(r.data.geography.products.indexOf('海贸') < 0, '内陆不识别海贸');
  ok(r.data.geography.farmland === 120000, '田亩读对');
  ok(r.data.existing.buildings.indexOf('卫所') >= 0 && r.data.existing.buildings.indexOf('文庙') >= 0, '已建建筑读对');
  ok(r.data.existing.fortLevel === 2, '城防档读对');
  ok(r.data.military.borderRisk === 30, '边警读对');
  ok(r.data.military.strategicValue === '京畿门户', '战略价值读对');
  ok(r.data.military.armyPressure === 40, '军压读对');
  ok(r.data.governance.officeVacancy === 1, '官缺读对');
  ok(r.data.governance.governor === '某甲', '长官读对');
  ok(r.data.population.ding === 200000, '丁口读对');
  ok(r.data.population.carryingCapacity === 1500000, '承载读对');
  ok(r.data.fiscal.localTreasury === 60000, '地方库银读对(money.stock)');
  ok(r.data.fiscal.retainedBudget === 240000, '岁留用读对');
  ok(r.text.indexOf('营建条件勘报') >= 0 && r.text.indexOf('内陆') >= 0, '人话勘报文本成形·内陆');
})();

// ── 2. inspectRegion 沿海识别 ──
(function () {
  var P = mkSave();
  var r = CBA.inspectRegion('登州', { P: P });
  ok(r.ok && r.data.geography.coastal === true, '登州识别为沿海(coastalDefense!=null)');
  ok(r.data.geography.products.indexOf('海贸') >= 0, '沿海识别海贸');
  ok(r.data.geography.products.indexOf('渔') >= 0, '识别渔产(fishingProduction>0)');
  ok(r.text.indexOf('濒海') >= 0 && r.text.indexOf('海防') >= 0, '沿海勘报含濒海+海防档');
})();

// ── 3. inspectRegion 找不到地块 ──
(function () {
  var P = mkSave();
  var r = CBA.inspectRegion('子虚郡', { P: P });
  ok(!r.ok && r.data === null, '找不到的地块·ok=false data=null');
  ok(r.text.indexOf('未找到') >= 0, '给出未找到提示(回落通则)');
})();

// ── 3b. 双源：区划在 GM.adminHierarchy（ctx.P 空）也能找到（真机逮到的 P/GM 双约定·node mock 防回归） ──
(function () {
  var gmDiv = {
    name: '辽阳', regionType: '府',
    economyBase: { farmland: 50000, mineralProduction: 0 },
    populationDetail: { ding: 30000, mouths: 150000 },
    borderRisk: 80, troops: 5000, fortLevel: 1
  };
  global.GM = { adminHierarchy: { player: { divisions: [gmDiv] } } };
  var prevP = global.P; delete global.P;             // 模拟现场：ctx.P 空、root.P 无
  var r = CBA.inspectRegion('辽阳', { P: { adminHierarchy: {} } });
  ok(r.ok && r.data && r.data.name === '辽阳', '双源：ctx.P 空 adminHierarchy 时从 GM.adminHierarchy 找到区划');
  ok(r.data.military.borderRisk === 80, '双源·边警读对(GM 源)');
  delete global.GM; if (prevP !== undefined) global.P = prevP;
})();

// ── 4-8. appraise 各路径（async） ──
(async function () {
  var REQ = { name: '龙江矿场', category: 'economic', description: '于此地开矿冶铁，增矿课。' };

  // 5. 无 callAIWithTools → no-cawt
  (function () { var P = mkSave(); global.P = P; delete global.callAIWithTools; })();
  var r5 = await CBA.appraise('顺天府', REQ, {});
  ok(!r5.ok && r5.reason === 'no-cawt', '无 callAIWithTools → reason=no-cawt');

  // 6. 无 API key → no-key
  (function () {
    var P = mkSave(); P.ai.key = ''; global.P = P;
    global.callAIWithTools = async function () { return { toolCalls: [], text: '' }; };
  })();
  var r6 = await CBA.appraise('顺天府', REQ, {});
  ok(!r6.ok && r6.reason === 'no-key', '无 API key → reason=no-key(回落原录入路径)');

  // 7. 桩 LLM 成功 → ok + 解析核议 + prompt 含勘地与请求
  var capturedPrompt = null, capturedTools = null, capturedOpts = null;
  (function () {
    var P = mkSave(); P.conf.customBuildAgentRounds = 1; global.P = P;  // A5:此测专验单发 appraise(单轮·谏官恒开但桩不回 critique→不改核议)
    global.callAIWithTools = async function (prompt, tools, opts) {
      if (capturedPrompt === null) { capturedPrompt = prompt; capturedTools = tools; capturedOpts = opts; }  // 只捕首调(appraise)·谏官复调不覆写
      return {
        toolCalls: [{
          name: 'submit_appraisal',
          input: {
            feasibility: '合理', costActual: 50000, timeActual: 4,
            effectsStructured: { abs: { 'economyBase.mineralProduction': 40000 }, upkeepPerTurn: 1000 },
            judgedEffects: '矿课大增·岁增矿税约四万两', reason: '此地有矿藏，开矿冶铁正得其宜。'
          }
        }],
        text: '', fallback: false
      };
    };
  })();
  var r7 = await CBA.appraise('顺天府', REQ, {});
  ok(r7.ok, '桩 LLM 单发核定 → ok=true');
  ok(r7.appraisal && r7.appraisal.feasibility === '合理', '核议·可行性解析');
  ok(r7.appraisal.costActual === 50000 && r7.appraisal.timeActual === 4, '核议·造价/工期解析');
  ok(r7.appraisal.effectsStructured && r7.appraisal.effectsStructured.abs['economyBase.mineralProduction'] === 40000, '核议·effectsStructured 解析');
  ok(r7.appraisal.judgedEffects.indexOf('矿课') >= 0 && r7.appraisal.reason.indexOf('有矿') >= 0, '核议·叙述/判语解析');
  ok(capturedPrompt && capturedPrompt.indexOf('龙江矿场') >= 0 && capturedPrompt.indexOf('营建条件勘报') >= 0, 'prompt 含玩家请求 + 勘地注入(不脱节)');
  ok(capturedPrompt.indexOf('顺天府') >= 0 && capturedPrompt.indexOf('物产 矿') >= 0, 'prompt 含此地真实条件(顺天府·有矿)');
  ok(capturedTools && capturedTools.some(function (t) { return t && t.name === 'submit_appraisal'; }), '工具集含 submit_appraisal(A5 多步带 inspect/recall/appraisal)');
  ok(capturedOpts && capturedOpts.forceTool === 'submit_appraisal' && capturedOpts.tier === 'secondary', 'forceTool + tier=secondary(次要 API)');
  ok(r7.inspection && r7.inspection.ok, 'appraise 带回 inspection 勘报');

  // 8. 桩返回无 submit_appraisal → no-appraisal
  (function () {
    var P = mkSave(); global.P = P;
    global.callAIWithTools = async function () { return { toolCalls: [], text: '空' }; };
  })();
  var r8 = await CBA.appraise('顺天府', REQ, {});
  ok(!r8.ok && r8.reason === 'no-appraisal', '无 submit_appraisal 调用 → reason=no-appraisal');

  // 8b. A2 落账硬门：越费效封顶削顶 + 白名单外丢弃 + 徽签/维护费/原拟可观测
  (function () {
    var P = mkSave(); global.P = P;
    global.callAIWithTools = async function () {
      return { toolCalls: [{ name: 'submit_appraisal', input: {
        feasibility: '勉强', costActual: 500, timeActual: 2,
        effectsStructured: { pct: { 'economyBase.commerceVolume': 0.5, 'economyBase.bogus': 0.2 }, abs: { fortLevel: 1 } },
        judgedEffects: '小坊微利', reason: '费薄不及大效'
      } }], text: '', fallback: false };
    };
  })();
  var r8b = await CBA.appraise('顺天府', { name: '小作坊', category: 'economic', description: '小本经营' }, {});
  ok(r8b.ok, '硬门·appraise ok');
  ok(r8b.appraisal.effectsStructured && r8b.appraisal.effectsStructured.pct['economyBase.commerceVolume'] === 0.03, '硬门·越费效封顶削顶(0.5→0.03 @cost500)');
  ok(!(r8b.appraisal.effectsStructured.pct && r8b.appraisal.effectsStructured.pct['economyBase.bogus']), '硬门·白名单外路径丢弃(economyBase.bogus)');
  ok(!(r8b.appraisal.effectsStructured.abs && r8b.appraisal.effectsStructured.abs.fortLevel), '硬门·城防费不及(cost<5000)丢弃 fortLevel');
  ok(r8b.appraisal.effectLabels && r8b.appraisal.effectLabels.length > 0, '徽签·人话效果标签非空');
  ok(r8b.appraisal.effectLabels.some(function (x) { return x.indexOf('商贸') >= 0; }), '徽签·含商贸标签');
  ok(r8b.appraisal.upkeep > 0, '维护费·非零');
  ok(r8b.appraisal.effectsRaw && r8b.appraisal.effectsRaw.pct['economyBase.commerceVolume'] === 0.5, '可观测·effectsRaw 保留 AI 原拟 0.5(对照削了什么)');

  // 8c. A4 活字段 write 词汇表：defenseBonus/officialSupply 纳白名单·strategicValue(字符串)被弃·徽签含边防/育官
  (function () {
    var P = mkSave(); global.P = P;
    global.callAIWithTools = async function () {
      return { toolCalls: [{ name: 'submit_appraisal', input: {
        feasibility: '合理', costActual: 30000, timeActual: 5,
        effectsStructured: { abs: { defenseBonus: 2, officialSupply: 1, strategicValue: 5, fortLevel: 1 } },
        judgedEffects: '雄关育官', reason: '边镇要冲'
      } }], text: '', fallback: false };
    };
  })();
  var r8c = await CBA.appraise('顺天府', { name: '雄关书院', category: 'military', description: '关隘+书院' }, {});
  ok(r8c.ok, 'A4·appraise ok');
  ok(r8c.appraisal.effectsStructured.abs && r8c.appraisal.effectsStructured.abs.defenseBonus === 2, 'A4·defenseBonus 纳白名单(cost30000·cap6内留2)');
  ok(r8c.appraisal.effectsStructured.abs.officialSupply === 1, 'A4·officialSupply 纳白名单(育官同学额之度)');
  ok(!('strategicValue' in r8c.appraisal.effectsStructured.abs), 'A4·strategicValue(描述性字符串字段)非数值白名单·被弃(防 addPath NaN 化)');
  ok(r8c.appraisal.effectsStructured.abs.fortLevel === 1, 'A4·fortLevel 仍认(cost≥5000)');
  ok(r8c.appraisal.effectLabels.some(function (x) { return x.indexOf('边防') >= 0; }) && r8c.appraisal.effectLabels.some(function (x) { return x.indexOf('育官') >= 0; }), 'A4·徽签含边防/育官');

  // 11-14. approveBuild（A3 准奏开工：扣银 + 落库 + 注入推演）
  // FiscalEngine 桩：spendFromGuoku 记录 + 返回 deducted/deficit（镜像真引擎返回结构）
  global.FiscalEngine = {
    _calls: [],
    spendFromGuoku: function (amt, tag) {
      this._calls.push({ amt: amt, tag: tag });
      var want = (amt && amt.money) || 0;
      var avail = (global.__guoku != null) ? global.__guoku : 1000000;
      var ded = Math.min(want, avail); global.__guoku = avail - ded;
      return { ok: true, deducted: { money: { deducted: ded, deficit: want - ded } } };
    }
  };

  // 11. 准奏成功：落库 + 扣国库 + 记 _pendingCustomBuilds
  var div11 = { name: '宁波府', buildings: [], economyBase: {} };
  global.GM = { turn: 5, adminHierarchy: { player: { divisions: [div11] } } };
  global.P = { adminHierarchy: global.GM.adminHierarchy };
  global.__guoku = 1000000; global.FiscalEngine._calls.length = 0;
  var ap11 = { feasibility: '合理', costActual: 80000, timeActual: 4, effectsStructured: { abs: { 'economyBase.commerceVolume': 30000 } }, judgedEffects: '商贸大兴', reason: '濒海通商' };
  var r11 = CBA.approveBuild('宁波府', ap11, { name: '市舶提举司', category: 'economic', description: '设市舶以通海贸' }, {});
  ok(r11.ok, '准奏·ok');
  ok(div11.buildings.length === 1, '准奏·建筑落库 division.buildings[]');
  ok(div11.buildings[0].status === 'building' && div11.buildings[0].remainingTurns === 4, '准奏·status=building·remainingTurns=工期');
  ok(div11.buildings[0].isCustom === true && div11.buildings[0]._viaAgent === true, '准奏·标 isCustom + _viaAgent(可观测)');
  ok(div11.buildings[0].effectsStructured && div11.buildings[0].effectsStructured.abs['economyBase.commerceVolume'] === 30000, '准奏·effectsStructured(A2削正后)落库');
  ok(global.FiscalEngine._calls.length === 1 && global.FiscalEngine._calls[0].amt.money === 80000, '准奏·spendFromGuoku 扣国库 80000(走真引擎)');
  ok(r11.spent.money === 80000 && r11.spent.deficit === 0, '准奏·spent 报扣款 80000 无欠');
  ok(global.GM._pendingCustomBuilds && global.GM._pendingCustomBuilds.length === 1, '注入推演·记 GM._pendingCustomBuilds');
  ok(global.GM._pendingCustomBuilds[0].turn === 5 && global.GM._pendingCustomBuilds[0].name === '市舶提举司', '注入推演·带 turn + 名目(prompt 段消费)');

  // 12. 不合理拒绝
  var r12 = CBA.approveBuild('宁波府', { feasibility: '不合理', costActual: 100 }, { name: 'x' }, {});
  ok(!r12.ok && r12.reason === 'infeasible', '准奏·不合理拒绝(reason=infeasible)');

  // 13. 找不到地块
  var r13 = CBA.approveBuild('子虚郡', { feasibility: '合理', costActual: 1000, timeActual: 2 }, { name: 'y' }, {});
  ok(!r13.ok && r13.reason === 'no-div', '准奏·找不到地块(reason=no-div)');

  // 14. timeActual<1 钳为 1 + 国库不继报欠
  var div14 = { name: '蓟州', buildings: [] };
  global.GM = { turn: 6, adminHierarchy: { player: { divisions: [div14] } } };
  global.P = { adminHierarchy: global.GM.adminHierarchy };
  global.__guoku = 5000; global.FiscalEngine._calls.length = 0;
  var r14 = CBA.approveBuild('蓟州', { feasibility: '勉强', costActual: 20000, timeActual: 0 }, { name: '墩台' }, {});
  ok(r14.ok, '准奏·勉强可开工');
  ok(div14.buildings[0].remainingTurns === 1, '准奏·timeActual<1 钳为 1 回合(无瞬成魔法)');
  ok(r14.spent.money === 5000 && r14.spent.deficit === 15000, '准奏·国库不继·扣5000欠15000(deficit报告·不阻断)');

  // 9. enabled() 恒开(斩旗转正·customBuildAgentEnabled flag 已删)
  (function () { var P = mkSave(); global.P = P; })();
  ok(CBA.enabled() === true, 'enabled() 恒开(空 conf)');

  // 15. A5 多步 + 谏官对抗审：inspect_region 续轮 → submit → critique 回调(过誉缩效/虚短延工期·全走 secondary)
  var a5Log = [];
  (function () {
    var P = mkSave(); global.P = P;   // A5 默认开(多步 + 谏官)
    global.callAIWithTools = async function (prompt, tools, opts) {
      var id = (opts && opts.id) || '';
      a5Log.push({ id: id, tier: opts && opts.tier });
      if (id.indexOf('critique') >= 0) return { toolCalls: [{ name: 'critique', input: { sound: false, effectScale: 0.5, minTimeActual: 8, note: '矿课过誉·工期虚短' } }], text: '' };
      if (/:r1$/.test(id)) return { toolCalls: [{ name: 'inspect_region', input: { divName: '顺天府' } }], text: '' };   // 首轮查
      return { toolCalls: [{ name: 'submit_appraisal', input: { feasibility: '合理', costActual: 50000, timeActual: 4, effectsStructured: { abs: { 'economyBase.mineralProduction': 40000 } }, judgedEffects: '矿课', reason: '此地有矿' } }], text: '' };
    };
  })();
  var r15 = await CBA.appraise('顺天府', { name: '龙江矿场', category: 'economic', description: '开矿冶铁' }, {});
  ok(r15.ok, 'A5·多步核定 ok');
  ok(r15.toolStats && r15.toolStats.rounds === 2, 'A5·多步:首轮查→次轮核议(rounds=2)');
  ok(r15.toolStats.reads === 1, 'A5·多步:inspect_region 被调一次(reads=1)');
  ok(r15.critique && r15.critique.sound === false, 'A5·谏官覆核 sound=false(过誉)');
  ok(r15.appraisal.timeActual === 8, 'A5·谏官延工期(4→minTime8)');
  ok(r15.appraisal.effectsStructured.abs['economyBase.mineralProduction'] === 20000, 'A5·谏官缩效(40000×0.5→20000·过硬门留存)');
  ok(r15.appraisal.reason.indexOf('谏官') >= 0, 'A5·谏言缀入判语');
  ok(a5Log.some(function (c) { return /:r1$/.test(c.id); }) && a5Log.some(function (c) { return /:r2$/.test(c.id); }) && a5Log.some(function (c) { return c.id.indexOf('critique') >= 0; }), 'A5·三段调用(r1勘+r2核+critique审)');
  ok(a5Log.every(function (c) { return c.tier === 'secondary'; }), 'A5·全程走次要 API(secondary)');

  console.log('\n[smoke-custom-build-agent] ' + pass + '/' + (pass + fail) + ' 通过' + (fail ? ('·' + fail + ' 失败') : ''));
  process.exit(fail ? 1 : 0);
})();
