// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-record.js — endturn AI 推演·收尾 return assembly (R210 P7-η 拆出)
//
// Phase 7 P7-η (2026-05-05·Claude)·从 tm-endturn-ai-infer.js 收尾 return 段拆出·
// 责任·读 ctx.record / ctx.input·assemble 主入口 return 对象 (12 字段)
// 不动·sanitize 仍在 ai-infer (主入口职责·非 record)·AI 失败兜底亦留 ai-infer
//
// Module:    TM.Endturn.AI.record
// Domain:    endturn / final return assembly
// Status:    active (P7-η refactor·替原 ai-infer 末段 inline return)
// Owner:     Claude (P7-η)
// Imports:   ctx (含 record / input 子组)·只读·非 GM/P 直接依赖
// Exports:   TM.Endturn.AI.record.finalize(ctx)·sync·return 12-field 对象
// Used by:   tm-endturn-ai-infer.js (主入口·末尾调 finalize 替 inline return)
// Side effects: 无 (纯 read·assemble·return)
// Test:      smoke-endturn-public-contract (含 record namespace 检查)
//            smoke-endturn-section-boundary (含 record.js 文件存在 + finalize export)
// Notes:     R210·P7-η·suggestions 来源 ctx.record.suggestions (P7-ζ followup 已自 sc2 写)
//            非读取 p2 的 sc2 局部·避免重引入 main-entry 局部依赖
// ============================================================
(function(global) {
  'use strict';
  if (typeof global.TM === 'undefined') global.TM = {};
  if (typeof global.TM.Endturn === 'undefined') global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === 'undefined') global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.record === 'undefined') global.TM.Endturn.AI.record = {};

  var ns = global.TM.Endturn.AI.record;

  // Phase 7·_costHistory hook·每回合末汇总 _subcallMeta 成本/token·写入 GM._costHistory
  // 最近 20 回合·设置面板"成本历史"区显示·诊断 export 也可读
  function _captureCostHistorySnapshot() {
    try {
      var GM = (typeof global !== 'undefined' && global.GM) || (typeof window !== 'undefined' && window.GM);
      if (!GM) return;
      var stats = GM._aiDispatchStats || {};
      var totalCalls = Number(stats.totalCalls) || 0;
      var totalTime = Number(stats.totalTime) || 0;
      var errors = Number(stats.errors) || 0;
      var byId = {};
      if (stats.byId && typeof stats.byId === 'object') {
        Object.keys(stats.byId).forEach(function(id) {
          var s = stats.byId[id] || {};
          byId[id] = { calls: s.calls || 0, totalTime: s.totalTime || 0, errors: s.errors || 0, name: s.name || id };
        });
      }
      // TokenUsageTracker 累计 (若可用)
      var tokenUsage = null;
      try {
        if (typeof global.TokenUsageTracker !== 'undefined' && global.TokenUsageTracker.getSnapshot) {
          tokenUsage = global.TokenUsageTracker.getSnapshot();
        }
      } catch(_) {}
      if (!Array.isArray(GM._costHistory)) GM._costHistory = [];
      GM._costHistory.push({
        turn: GM.turn || 0,
        ts: Date.now(),
        totalCalls: totalCalls,
        totalTimeMs: totalTime,
        errors: errors,
        byId: byId,
        tokenUsage: tokenUsage,
        modelTier: (typeof global !== 'undefined' && global.P && global.P.conf && global.P.conf.modelTier) || 'standard',
        // Phase 6 标记
        sc1StrictFallback: !!(GM._turnAiResults && GM._turnAiResults._sc1StrictFallback)
      });
      // 容量保护·最近 20 回合
      if (GM._costHistory.length > 20) GM._costHistory = GM._costHistory.slice(-20);
    } catch(_costE) {
      try { if (typeof console !== 'undefined') console.warn('[costHistory] capture fail:', _costE); } catch(_){}
    }
  }
  ns.finalize = function(ctx) {
    _captureCostHistorySnapshot();
    if (ctx && global.TM.Endturn.Validity && global.TM.Endturn.Validity.preserveNarrative) global.TM.Endturn.Validity.preserveNarrative(ctx);
    var record = (ctx && ctx.record) ? ctx.record : {};
    var input = (ctx && ctx.input) ? ctx.input : {};
    return {
      shizhengji: record.shizhengji || '',
      zhengwen: record.zhengwen || '',
      playerStatus: record.playerStatus || '',
      playerInner: record.playerInner || '',
      turnSummary: record.turnSummary || '',
      timeRatio: input.timeRatio,
      suggestions: Array.isArray(record.suggestions) ? record.suggestions : [],
      basis_refs: Array.isArray(record.basis_refs) ? record.basis_refs : [],
      shiluText: record.shiluText || '',
      szjTitle: record.szjTitle || '',
      szjSummary: record.szjSummary || '',
      personnelChanges: Array.isArray(record.personnelChanges) ? record.personnelChanges : [],
      hourenXishuo: record.hourenXishuo || ''
    };
  };
  // Phase 7·诊断 export 公开 API·便于设置面板按钮调用
  ns._captureCostHistorySnapshot = _captureCostHistorySnapshot;
})(typeof window !== 'undefined' ? window : globalThis);
