// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-settings.js — NPC 决策系统设置 (Phase F3·2026-05-10)
 *
 * NPC 真决策已纳入正式玩法；缺少 API 配置时使用本地人格与模板。
 * 调用频率、并发、预算和文字润色仍分别配置。
 *
 * NPC 模块 (memorial/edict/chaoyi/office/guoku) 在 generate 时:
 *   if (TM.FactionNpcSettings.isAiPrecisionEnabled()) → 走 LLM enrich path
 *   else → 走 template + personality path (现有)
 */
(function(global) {
  'use strict';

  // 默认配置
  var DEFAULTS = {
    npcAiPrecision: true,              // 兼容旧状态读口，固定启用
    npcAiPrecisionMaxPerTurn: 2,       // 限流·过回合时最多 LLM call 次数；重活交给回合后后台队列
    npcAiPrecisionPriority: 'overall', // F0 2026-05-22·历史字段·无消费者 (ranking 走 FactionActionEngine.scoreFactionCandidate)·保留避免破坏存档迁移
    npcAiCosmeticEnrich: true,         // separate text-polish switch: cosmetic only
    npcAiPrecisionMode: 'eager',       // 默认回合批次与回合间补充决策均可运行
    npcAiPrecisionConcurrency: 2,
    npcAiPrecisionRetryAttempts: 2,
    npcAiPrecisionTimeoutMs: 30000,
    npcAiPrecisionMaxTokens: 6000,
    npcEagerDelayMs: 300               // F0 2026-05-22·dispatcher 读·补上与 dispatcher DEFAULTS 一致
  };

  function _migrateCadence(conf) {
    if (!conf || conf._npcAiPrecisionCadenceSwapped) return;
    if (conf.npcAiPrecisionMaxPerTurn === 8 || typeof conf.npcAiPrecisionMaxPerTurn !== 'number') {
      conf.npcAiPrecisionMaxPerTurn = 2;
    }
    if (conf.npcInTurnMaxPerTurn === 2 || typeof conf.npcInTurnMaxPerTurn !== 'number') {
      conf.npcInTurnMaxPerTurn = 8;
    }
    conf._npcAiPrecisionCadenceSwapped = true;
  }

  function _getConf() {
    var P = global.P;
    if (!P || !P.conf) return DEFAULTS;
    var conf = P.conf;
    _migrateCadence(conf);
    return {
      npcAiPrecision: true, // 真决策已转正；旧存档的 false 不再禁用。
      npcAiPrecisionMaxPerTurn: typeof conf.npcAiPrecisionMaxPerTurn === 'number' ? conf.npcAiPrecisionMaxPerTurn : DEFAULTS.npcAiPrecisionMaxPerTurn,
      npcAiPrecisionPriority: conf.npcAiPrecisionPriority || DEFAULTS.npcAiPrecisionPriority,
      npcAiCosmeticEnrich: typeof conf.npcAiCosmeticEnrich === 'boolean' ? conf.npcAiCosmeticEnrich : DEFAULTS.npcAiCosmeticEnrich,
      npcAiPrecisionMode: conf.npcAiPrecisionMode || DEFAULTS.npcAiPrecisionMode,
      npcAiPrecisionConcurrency: typeof conf.npcAiPrecisionConcurrency === 'number' ? conf.npcAiPrecisionConcurrency : DEFAULTS.npcAiPrecisionConcurrency,
      npcAiPrecisionRetryAttempts: typeof conf.npcAiPrecisionRetryAttempts === 'number' ? conf.npcAiPrecisionRetryAttempts : DEFAULTS.npcAiPrecisionRetryAttempts,
      npcAiPrecisionTimeoutMs: typeof conf.npcAiPrecisionTimeoutMs === 'number' ? conf.npcAiPrecisionTimeoutMs : DEFAULTS.npcAiPrecisionTimeoutMs,
      npcAiPrecisionMaxTokens: typeof conf.npcAiPrecisionMaxTokens === 'number' ? conf.npcAiPrecisionMaxTokens : DEFAULTS.npcAiPrecisionMaxTokens
    };
  }

  function isEagerMode() {
    var c = _getConf();
    return !!c.npcAiPrecision && c.npcAiPrecisionMode === 'eager';
  }

  function isAiPrecisionEnabled() {
    var c = _getConf();
    // API 未配置时不发起模型调用。
    if (!global.P || !global.P.ai || !global.P.ai.key) return false;
    return true;
  }

  function isCosmeticEnrichEnabled() {
    var c = _getConf();
    if (!c.npcAiCosmeticEnrich) return false;
    if (!global.P || !global.P.ai || !global.P.ai.key) return false;
    return true;
  }

  function maxPerTurn() {
    return _getConf().npcAiPrecisionMaxPerTurn;
  }

  function concurrency() {
    return Math.max(1, Math.min(4, _getConf().npcAiPrecisionConcurrency));
  }

  // 兼容旧设置入口，正式决策只受 API 可用性和调用预算约束。
  function setEnabled() { return true; }

  function setCosmeticEnrichEnabled(on) {
    if (!global.P) return false;
    if (!global.P.conf) global.P.conf = {};
    global.P.conf.npcAiCosmeticEnrich = !!on;
    try { if (typeof global.saveP === 'function') global.saveP(); } catch (_e) {} // 写必随存(2026-07-04)
    return true;
  }

  function getStatus() {
    var c = _getConf();
    var hasKey = !!(global.P && global.P.ai && global.P.ai.key);
    return {
      enabled: c.npcAiPrecision,
      effectivelyOn: isAiPrecisionEnabled(),
      cosmeticEnrich: c.npcAiCosmeticEnrich,
      cosmeticEffectivelyOn: isCosmeticEnrichEnabled(),
      eagerMode: isEagerMode(),
      hasKey: hasKey,
      maxPerTurn: c.npcAiPrecisionMaxPerTurn,
      concurrency: c.npcAiPrecisionConcurrency,
      retryAttempts: c.npcAiPrecisionRetryAttempts,
      timeoutMs: c.npcAiPrecisionTimeoutMs,
      maxTokens: c.npcAiPrecisionMaxTokens,
      reason: !hasKey ? 'no API key' : 'enabled'
    };
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcSettings = {
    isAiPrecisionEnabled: isAiPrecisionEnabled,
    isCosmeticEnrichEnabled: isCosmeticEnrichEnabled,
    isEagerMode: isEagerMode,
    maxPerTurn: maxPerTurn,
    concurrency: concurrency,
    setEnabled: setEnabled,
    setCosmeticEnrichEnabled: setCosmeticEnrichEnabled,
    getStatus: getStatus,
    DEFAULTS: DEFAULTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isAiPrecisionEnabled: isAiPrecisionEnabled,
      isCosmeticEnrichEnabled: isCosmeticEnrichEnabled,
      isEagerMode: isEagerMode,
      setEnabled: setEnabled,
      setCosmeticEnrichEnabled: setCosmeticEnrichEnabled,
      getStatus: getStatus
    };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
