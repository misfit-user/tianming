// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-systems.js — endTurn §E 系统更新调度器
//
// R95 从 tm-endturn.js 抽出·原 L12887-13259 (373 行)
// 1 函数：_endTurn_updateSystems(timeRatio, zhengwen)
//
// 作用：Step 3 机械层结算 + SubTickRunner 分层调度 + NPC 行为推演
//      依次调用：BattleEngine / SubTickRunner / executeNpcBehaviors /
//               NpcEngine / FiscalCascade / CharEconomyEngine /
//               HujiEngine / EnvCapacityEngine / advanceKejuByDays /
//               AuthorityEngines / CorruptionEngine / GuokuEngine
//
// 外部调用：0 (仅 tm-endturn.js _endTurnCore 内调用)
// 依赖外部：大量引擎/工具 均 window 全局
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

/** Step 3: 系统更新 — 动态数据更新 + NPC + ChangeQueue 结算 */
async function _endTurn_updateSystems(timeRatio, zhengwen) {
  // 3.0 机械层先行结算（战斗/围城/行军等确定性系统，在AI叙事之后、系统更新之前）
  if (typeof BattleEngine !== 'undefined' && BattleEngine._getConfig().enabled) {
    try { BattleEngine.resolveAllBattles(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'BattleEngine] 结算失败:') : console.error('[BattleEngine] 结算失败:', e); }
  }

  // 3. 通过子回合调度器执行分层结算（daily→monthly→perturn）
  showLoading("更新数据",92);
  var monthRatio = (typeof _getDaysPerTurn === 'function')
    ? _getDaysPerTurn() / 30
    : ((typeof timeRatio === 'number' && isFinite(timeRatio) && timeRatio > 0) ? timeRatio * 12 : 1);
  var pipelineCtx = { timeRatio: timeRatio, turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio };
  SubTickRunner.run(pipelineCtx);

  // 3.5 NPC 行为推演（异步，不在 pipeline 中）
  try {
    if (P.ai.key) { showLoading("推演 NPC 行为",94); await executeNpcBehaviors(); }
    if (P.npcEngine && P.npcEngine.enabled) { showLoading("运行 NPC Engine",94.5); NpcEngine.runEngine(); }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] NPC行为推演失败:') : console.error('[endTurn] NPC行为推演失败:', e); }

  // 5. 编年处理
  processBiannian();

  // 6. 推进回合
  GM.turn++;

  // 6.01 腐败引擎回合演化（九源累积/衰减/真实感知更新/后果传导/揭发概率）
  try {
    if (typeof CorruptionEngine !== 'undefined') {
      CorruptionEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CorruptionEngine.tick 失败:') : console.error('[endTurn] CorruptionEngine.tick 失败:', e); }

  // 6.015 户口前移（方案联动总表推荐：腐败→户口→帑廪→内帑→民心→皇权→皇威）
  try {
    if (typeof HujiEngine !== 'undefined') {
      HujiEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] HujiEngine(early) 失败:') : console.error('[endTurn] HujiEngine(early) 失败:', e); }
  try {
    if (typeof HujiDeepFill !== 'undefined') {
      HujiDeepFill.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] HujiDeepFill(early) 失败:') : console.error('[endTurn] HujiDeepFill(early) 失败:', e); }
  // 标记已早跑，后文跳过
  GM._hujiEarlyTicked = true;

  // 6.02 帑廪引擎回合结算（八源+八支+月度流水+年末决算）
  try {
    if (typeof GuokuEngine !== 'undefined') {
      GuokuEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] GuokuEngine.tick 失败:') : console.error('[endTurn] GuokuEngine.tick 失败:', e); }

  // 6.03 内帑引擎回合结算（6 源+5 支+月度+年末+危机检查）
  try {
    if (typeof NeitangEngine !== 'undefined') {
      NeitangEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] NeitangEngine.tick 失败:') : console.error('[endTurn] NeitangEngine.tick 失败:', e); }

  // 6.04 角色经济回合结算（6 资源 × 全角色）
  try {
    if (typeof CharEconEngine !== 'undefined') {
      CharEconEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CharEconEngine.tick 失败:') : console.error('[endTurn] CharEconEngine.tick 失败:', e); }

  // 6.05 经济联动（层层剥夺/区域财政/俸禄流/贪腐流/下拨/民心反馈）
  try {
    if (typeof EconomyLinkage !== 'undefined') {
      EconomyLinkage.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EconomyLinkage.tick 失败:') : console.error('[endTurn] EconomyLinkage.tick 失败:', e); }

  // 6.055 货币系统（铸币/纸币生命周期/市场/海外银流/钱荒钱贱）
  try {
    if (typeof CurrencyEngine !== 'undefined') {
      CurrencyEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CurrencyEngine.tick 失败:') : console.error('[endTurn] CurrencyEngine.tick 失败:', e); }

  // 6.056 央地财政（合规率/地方 AI 决策/14 支出效果/监察/自立藩镇）
  try {
    if (typeof CentralLocalEngine !== 'undefined') {
      CentralLocalEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CentralLocalEngine.tick 失败:') : console.error('[endTurn] CentralLocalEngine.tick 失败:', e); }

  // 6.057 经济补完（封建财政/土地兼并/借贷/虚报差额/地域接受度/套利）
  try {
    if (typeof EconomyGapFill !== 'undefined') {
      EconomyGapFill.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EconomyGapFill.tick 失败:') : console.error('[endTurn] EconomyGapFill.tick 失败:', e); }

  // 6.07 户口系统（已在 6.015 早跑，跳过）
  if (!GM._hujiEarlyTicked) try {
    if (typeof HujiEngine !== 'undefined') {
      HujiEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] HujiEngine.tick 失败:') : console.error('[endTurn] HujiEngine.tick 失败:', e); }

  // 6.08 环境承载力（五维/疤痕/过载/危机/技术/政策）
  try {
    if (typeof EnvCapacityEngine !== 'undefined') {
      EnvCapacityEngine.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EnvCapacityEngine.tick 失败:') : console.error('[endTurn] EnvCapacityEngine.tick 失败:', e); }

  // 6.09 诏令/奏疏/抗疏（二阶段流程、待朱批清理）
  try {
    if (typeof EdictParser !== 'undefined') {
      EdictParser.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EdictParser.tick 失败:') : console.error('[endTurn] EdictParser.tick 失败:', e); }

  // 6.10 户口深化（已在 6.015 早跑，跳过）
  if (!GM._hujiEarlyTicked) try {
    if (typeof HujiDeepFill !== 'undefined') {
      HujiDeepFill.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] HujiDeepFill.tick 失败:') : console.error('[endTurn] HujiDeepFill.tick 失败:', e); }
  // 清 early 标记，下回合重新走
  GM._hujiEarlyTicked = false;

  // 6.11 诏令补完（11 类反向触发 + 自动路由）
  try {
    if (typeof EdictComplete !== 'undefined') {
      EdictComplete.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EdictComplete.tick 失败:') : console.error('[endTurn] EdictComplete.tick 失败:', e); }

  // 6.12 环境恢复政策 + §9 联动
  try {
    if (typeof EnvRecoveryFill !== 'undefined') {
      EnvRecoveryFill.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EnvRecoveryFill.tick 失败:') : console.error('[endTurn] EnvRecoveryFill.tick 失败:', e); }

  // 6.13 皇威/皇权/民心 tick + 42 项变量联动
  try {
    if (typeof AuthorityEngines !== 'undefined') {
      AuthorityEngines.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] AuthorityEngines.tick 失败:') : console.error('[endTurn] AuthorityEngines.tick 失败:', e); }

  // 6.14 权力系统补完（权臣/民变5级/暴君症状/失威危机/天象/联动全）
  try {
    if (typeof AuthorityComplete !== 'undefined') {
      AuthorityComplete.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] AuthorityComplete.tick 失败:') : console.error('[endTurn] AuthorityComplete.tick 失败:', e); }

  // 6.15 历史补完（年龄金字塔精细化+疫病战亡字段维护）
  try {
    if (typeof HistoricalPresets !== 'undefined') {
      HistoricalPresets.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] HistoricalPresets.tick 失败:') : console.error('[endTurn] HistoricalPresets.tick 失败:', e); }

  // 6.16 C/D/B/A/E 阶段补丁 tick
  try {
    if (typeof PhaseC !== 'undefined') PhaseC.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseC.tick 失败:') : console.error('[endTurn] PhaseC.tick 失败:', e); }
  try {
    if (typeof PhaseD !== 'undefined') PhaseD.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseD.tick 失败:') : console.error('[endTurn] PhaseD.tick 失败:', e); }
  try {
    if (typeof PhaseB !== 'undefined') PhaseB.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseB.tick 失败:') : console.error('[endTurn] PhaseB.tick 失败:', e); }
  try {
    if (typeof PhaseA !== 'undefined') PhaseA.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseA.tick 失败:') : console.error('[endTurn] PhaseA.tick 失败:', e); }
  try {
    if (typeof PhaseE !== 'undefined') PhaseE.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio });
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseE.tick 失败:') : console.error('[endTurn] PhaseE.tick 失败:', e); }
  // 6.17 F 阶段全部补丁 tick
  try { if (typeof PhaseF1 !== 'undefined') PhaseF1.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseF1.tick 失败:') : console.error('[endTurn] PhaseF1.tick 失败:', e); }
  try { if (typeof PhaseF2 !== 'undefined') PhaseF2.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseF2.tick 失败:') : console.error('[endTurn] PhaseF2.tick 失败:', e); }
  try { if (typeof PhaseF3 !== 'undefined') PhaseF3.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseF3.tick 失败:') : console.error('[endTurn] PhaseF3.tick 失败:', e); }
  try { if (typeof PhaseF4 !== 'undefined') PhaseF4.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseF4.tick 失败:') : console.error('[endTurn] PhaseF4.tick 失败:', e); }
  try { if (typeof PhaseF5 !== 'undefined') PhaseF5.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseF5.tick 失败:') : console.error('[endTurn] PhaseF5.tick 失败:', e); }
  try { if (typeof PhaseF6 !== 'undefined') PhaseF6.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseF6.tick 失败:') : console.error('[endTurn] PhaseF6.tick 失败:', e); }
  // 6.18 G 阶段终结补丁 tick
  try { if (typeof PhaseG1 !== 'undefined') PhaseG1.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseG1.tick 失败:') : console.error('[endTurn] PhaseG1.tick 失败:', e); }
  try { if (typeof PhaseG2 !== 'undefined') PhaseG2.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseG2.tick 失败:') : console.error('[endTurn] PhaseG2.tick 失败:', e); }
  try { if (typeof PhaseG3 !== 'undefined') PhaseG3.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseG3.tick 失败:') : console.error('[endTurn] PhaseG3.tick 失败:', e); }
  try { if (typeof PhaseG4 !== 'undefined') PhaseG4.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] PhaseG4.tick 失败:') : console.error('[endTurn] PhaseG4.tick 失败:', e); }
  // 6.19 H 阶段·原 PhaseH.tick 拆为 7 项原生调用 (R10 collapse·delete tm-tax-atomic.js·redistribute → CurrencyEngine·FiscalEngine·FeudalCore·EdictComplete)
  try { if (typeof CurrencyEngine !== 'undefined' && typeof CurrencyEngine._updatePaperStateAtomic === 'function') CurrencyEngine._updatePaperStateAtomic(GM, monthRatio); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CurrencyEngine._updatePaperStateAtomic 失败:') : console.error('[endTurn] CurrencyEngine._updatePaperStateAtomic 失败:', e); }
  try { if (typeof CurrencyEngine !== 'undefined' && typeof CurrencyEngine._updateGrainPriceAtomic === 'function') CurrencyEngine._updateGrainPriceAtomic(GM, monthRatio); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CurrencyEngine._updateGrainPriceAtomic 失败:') : console.error('[endTurn] CurrencyEngine._updateGrainPriceAtomic 失败:', e); }
  try { if (typeof FiscalEngine !== 'undefined' && typeof FiscalEngine._tickTransferOrders === 'function') FiscalEngine._tickTransferOrders({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }, monthRatio); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] FiscalEngine._tickTransferOrders 失败:') : console.error('[endTurn] FiscalEngine._tickTransferOrders 失败:', e); }
  try { if (typeof FeudalCore !== 'undefined' && typeof FeudalCore._tickFeudalHoldings === 'function') FeudalCore._tickFeudalHoldings({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }, monthRatio); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] FeudalCore._tickFeudalHoldings 失败:') : console.error('[endTurn] FeudalCore._tickFeudalHoldings 失败:', e); }
  try { if (typeof EdictComplete !== 'undefined' && typeof EdictComplete._checkProjectCompletion === 'function') EdictComplete._checkProjectCompletion({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EdictComplete._checkProjectCompletion 失败:') : console.error('[endTurn] EdictComplete._checkProjectCompletion 失败:', e); }
  try { if (typeof EdictComplete !== 'undefined' && typeof EdictComplete._checkHuangceCycle === 'function') EdictComplete._checkHuangceCycle({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EdictComplete._checkHuangceCycle 失败:') : console.error('[endTurn] EdictComplete._checkHuangceCycle 失败:', e); }
  try { if (typeof EdictComplete !== 'undefined' && typeof EdictComplete._checkGaituEscalation === 'function') EdictComplete._checkGaituEscalation({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] EdictComplete._checkGaituEscalation 失败:') : console.error('[endTurn] EdictComplete._checkGaituEscalation 失败:', e); }
  // 6.20 NPC 按立场自主献策产生奏疏（天象/权臣/民变/灾变/瘟疫/军败 触发）
  try { if (typeof NpcMemorials !== 'undefined') NpcMemorials.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] NpcMemorials.tick 失败:') : console.error('[endTurn] NpcMemorials.tick 失败:', e); }
  // 6.21 融合桥接：行政区划 → 七变量 聚合
  try { if (typeof IntegrationBridge !== 'undefined') IntegrationBridge.tick({ turn: GM.turn, monthRatio: monthRatio, _monthRatio: monthRatio }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] IntegrationBridge.tick 失败:') : console.error('[endTurn] IntegrationBridge.tick 失败:', e); }

  // 6.06 角色完整字段推演（stressSources/innerThought/career/familyMembers/clanPrestige）
  try {
    if (typeof CharFullSchema !== 'undefined' && Array.isArray(GM.chars)) {
      var _mr = monthRatio;
      GM.chars.forEach(function(ch) {
        if (!ch || ch.alive === false) return;
        CharFullSchema.ensureFullFields(ch);
        CharFullSchema.evolveTick(ch, _mr);
      });
      // 官职变动侦测 → 仕途履历
      GM.chars.forEach(function(ch) {
        if (!ch || ch.alive === false) return;
        var curTitle = ch.officialTitle || '';
        if (ch._lastRecordedTitle !== undefined && curTitle !== ch._lastRecordedTitle) {
          CharFullSchema.recordCareerEvent(
            ch,
            (typeof getTSText === 'function' ? getTSText(GM.turn) : '第' + GM.turn + '回'),
            (ch._lastRecordedTitle ? '由 ' + ch._lastRecordedTitle + ' ' : '') + (curTitle ? '升/转 ' + curTitle : '去官'),
            '',
            !!curTitle && !ch._lastRecordedTitle // 首任视为里程碑
          );
        }
        ch._lastRecordedTitle = curTitle;
      });
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] CharFullSchema.evolveTick 失败:') : console.error('[endTurn] CharFullSchema.evolveTick 失败:', e); }
  // N4: 精力回复（每回合自动回满）
  if (GM._energy !== undefined) {
    GM._energy = GM._energyMax || 100;
  }

  // 6.63 领地产出计算（在集权回拨之前）
  if (P.territoryProductionSystem && P.territoryProductionSystem.enabled) {
    showLoading("计算领地产出",92.5);
    CentralizationSystem.resetFinance();
    TerritoryProductionSystem.calculateAll();
    TerritoryProductionSystem.updateAttributes();
  }

  // 6.65 集权回拨系统财政结算
  if (P.centralizationSystem && P.centralizationSystem.enabled) {
    showLoading("财政结算",93);
    CentralizationSystem.runSettlement();
  }

  // 6.82-6.85 国策/议程/省经济（已注册到 pipeline，此处仅补充未注册的部分）
  // 这些步骤在 pipeline 中按优先级自动执行，此处保留为兜底
  try { if (typeof evaluateThresholdTriggers === 'function') evaluateThresholdTriggers(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 阈值触发检查失败:') : console.error('[endTurn] 阈值触发检查失败:', e); }
  try { updateProvinceEconomy(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 省经济更新失败:') : console.error('[endTurn] 省经济更新失败:', e); }
  try { StateCouplingSystem.processCouplings(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 状态耦合失败:') : console.error('[endTurn] 状态耦合失败:', e); }
  try { AutoReboundSystem.applyRebounds(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 自动反弹失败:') : console.error('[endTurn] 自动反弹失败:', e); }

  // 6.855 应用变动队列（ChangeQueue System）
  showLoading("应用决策变动", 93);
  _dbg('[endTurn] Step 6.855: 开始应用变动队列');
  var queueResult = null;
  try {
    queueResult = ChangeQueue.applyAll() || {};
    _dbg('[endTurn] 变动队列应用完成:', queueResult);
    var _execRate = (typeof queueResult.executionRate === 'number') ? queueResult.executionRate : 0;
    _dbg('[endTurn] 执行率: ' + _execRate.toFixed(1) + '%，已应用 ' + (queueResult.appliedCount || 0) + ' 个变动');

    // 将队列中的国库变动记录到 AccountingSystem
    var appliedChanges = ChangeQueue.getAppliedChanges();

    // 收集变量变化用于检查改革触发
    var variableChanges = {};
    appliedChanges.forEach(function(change) {
      if (change.type === 'treasury' && change.field === 'gold') {
        if (change.delta > 0) {
          AccountingSystem.addIncome(change.description, change.delta, change.source);
        } else if (change.delta < 0) {
          AccountingSystem.addExpense(change.description, Math.abs(change.delta), change.source);
        }
      } else if (change.type === 'variable' && change.delta !== undefined) {
        // 累积变量变化
        if (!variableChanges[change.target]) {
          variableChanges[change.target] = 0;
        }
        variableChanges[change.target] += change.delta;
      }
    });

    // 清空队列
    ChangeQueue.clear();
    _dbg('[endTurn] 变动队列已清空');

    // 检查改革触发（基于本回合变量变化）
    AutoReboundSystem.checkReforms(variableChanges);

    // 应用得罪群体系统衰减
    OffendGroupsSystem.applyDecay();

    // 更新状态耦合系统的变量快照（为下一回合准备）
    StateCouplingSystem.updateSnapshot();
  } catch (error) {
    console.error('[endTurn] 应用变动队列失败:', error);
  }

  // 6.87 检查历史事件触发
  try {
    if (typeof checkHistoryEvents === 'function') checkHistoryEvents();
  } catch(e) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 历史事件触发检查失败:') : console.error('[endTurn] 历史事件触发检查失败:', e);
  }

  // 6.88 检查刚性触发器
  try {
    if (typeof checkRigidTriggers === 'function') checkRigidTriggers();
  } catch(e) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 刚性触发器检查失败:') : console.error('[endTurn] 刚性触发器检查失败:', e);
  }

  // 6.885 检查科举筹办完成
  if(GM.keju && GM.keju.preparingExam && zhengwen) {
    // 检查AI是否在正文中提到科举筹办完成、科举开考等关键词
    var kejuCompleteKeywords = ['科举.*?开考', '科举.*?举办', '科举.*?完成', '科举.*?如期', '贡院.*?开启', '考生.*?入场', '放榜'];
    var isKejuComplete = kejuCompleteKeywords.some(function(keyword) {
      return new RegExp(keyword).test(zhengwen);
    });

    if(isKejuComplete) {
      _dbg('[科举] AI推演显示科举筹办完成，准备开考');
      GM.keju.preparingExam = false;
      // 在下一回合自动触发科举考试
      setTimeout(function() {
        if(P.keju && P.keju.enabled && !P.keju.currentExam) {
          _dbg('[科举] 自动触发科举考试');
          startKejuExam();
        }
      }, 2000);
    }
  }

  // 6.89 更新职位系统（品位晋升）
  if (P.positionSystem && P.positionSystem.enabled) {
    _dbg('[endTurn] Step 6.89: 更新职位系统');
    try {
      if (typeof PositionSystem !== 'undefined' && PositionSystem && typeof PositionSystem.updatePrestige === 'function') {
        PositionSystem.updatePrestige();
      }
    } catch(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 职位系统更新失败:') : console.error('[endTurn] 职位系统更新失败:', e);
    }
  }

  // 6.90 检查空缺职位提醒
  if (P.vacantPositionReminder && P.vacantPositionReminder.enabled) {
    _dbg('[endTurn] Step 6.90: 检查空缺职位');
    try {
      if (typeof VacantPositionReminder !== 'undefined' && VacantPositionReminder && typeof VacantPositionReminder.checkVacantPositions === 'function') {
        VacantPositionReminder.checkVacantPositions();
      }
    } catch(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 空缺职位提醒失败:') : console.error('[endTurn] 空缺职位提醒失败:', e);
    }
  }

  // 6.91 检查自然死亡
  if (P.naturalDeath && P.naturalDeath.enabled) {
    _dbg('[endTurn] Step 6.91: 检查自然死亡');
    try {
      if (typeof NaturalDeathSystem !== 'undefined' && NaturalDeathSystem && typeof NaturalDeathSystem.checkNaturalDeaths === 'function') {
        NaturalDeathSystem.checkNaturalDeaths();
      }
    } catch(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 自然死亡检查失败:') : console.error('[endTurn] 自然死亡检查失败:', e);
    }
  }

  // 6.9 处理数据变化队列（监听系统）
  try {
    if (typeof processChangeQueue === 'function') processChangeQueue();
  } catch(e) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 监听队列处理失败:') : console.error('[endTurn] 监听队列处理失败:', e);
  }

  // 6.91b 关系网冲突自然衰减（每回合）
  if (typeof decayConflictLevels === 'function') {
    try { decayConflictLevels(); } catch(_) {}
  }
  // 6.91c 跨代父仇继承（conflictLevel≥4 + 双方有子嗣）
  if (typeof inheritBloodFeuds === 'function') {
    try { inheritBloodFeuds(); } catch(_) {}
  }

  // 6.92 文事作品老化：非传世且质量<70 的作品 > 10 回合后移入 _forgottenWorks（压缩记忆）
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    if (!GM._forgottenWorks) GM._forgottenWorks = [];
    var _aged = [];
    GM.culturalWorks = GM.culturalWorks.filter(function(w) {
      if (w.isPreserved) return true;
      if (GM.turn - (w.turn || 0) > 10 && (w.quality || 0) < 70) {
        _aged.push({ id: w.id, author: w.author, title: w.title, turn: w.turn, genre: w.genre });
        return false;
      }
      return true;
    });
    if (_aged.length > 0) {
      GM._forgottenWorks = GM._forgottenWorks.concat(_aged);
      if (GM._forgottenWorks.length > 500) GM._forgottenWorks = GM._forgottenWorks.slice(-500);
    }
  }

  // 6.95 清空查询缓存（每回合结束后数据已变化）
  try {
    if (typeof WorldHelper !== 'undefined' && WorldHelper && typeof WorldHelper.clearCache === 'function') {
      WorldHelper.clearCache();
    }
  } catch(e) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] 世界缓存清理失败:') : console.error('[endTurn] 世界缓存清理失败:', e);
  }

  return queueResult;
}
