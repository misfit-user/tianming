// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-settings.js — NPC 决策系统设置 (Phase F3·2026-05-10)
 *
 * 一个开关·决定 NPC 内政是否走 LLM 精细化:
 *   P.conf.npcAiPrecision = true  → A+B+C (LLM enrich + personality + player 干预)
 *   P.conf.npcAiPrecision = false → B+C (本地 personality + player 干预·默认)
 *
 * 默认 false (性能优先·LLM 调用是 cost)·user 可在设置打开。
 *
 * NPC 模块 (memorial/edict/chaoyi/office/guoku) 在 generate 时:
 *   if (TM.FactionNpcSettings.isAiPrecisionEnabled()) → 走 LLM enrich path
 *   else → 走 template + personality path (现有)
 */
(function(global) {
  'use strict';

  // 默认配置
  var DEFAULTS = {
    npcAiPrecision: true,              // 主开关
    npcAiPrecisionMaxPerTurn: 2,       // 限流·过回合时最多 LLM call 次数；重活交给回合后后台队列
    npcAiPrecisionPriority: 'overall', // 'overall' | 'random' — 优先 enrich 哪些 fac
    npcAiPrecisionMaxPerTurn: 2,
    npcAiCosmeticEnrich: true,         // separate text-polish switch: cosmetic only
    npcAiPrecisionMode: 'eager',       // master switch ON means endturn batch + in-turn extra LLM can both run
    npcAiPrecisionConcurrency: 2,
    npcAiPrecisionRetryAttempts: 2,
    npcAiPrecisionTimeoutMs: 30000,
    npcAiPrecisionMaxTokens: 6000
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
      npcAiPrecision: typeof conf.npcAiPrecision === 'boolean' ? conf.npcAiPrecision : DEFAULTS.npcAiPrecision,
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
    if (!c.npcAiPrecision) return false;
    // 还要 check P.ai.key 已配·没 key 即便开了也 noop
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

  function setEnabled(on) {
    if (!global.P) return false;
    if (!global.P.conf) global.P.conf = {};
    _migrateCadence(global.P.conf);
    global.P.conf.npcAiPrecision = !!on;
    if (on) {
      global.P.conf.npcAiPrecisionMode = 'eager';
    } else if (global.TM && global.TM.FactionNpcInTurnDriver && typeof global.TM.FactionNpcInTurnDriver.cancelInTurnTimers === 'function') {
      global.TM.FactionNpcInTurnDriver.cancelInTurnTimers();
    }
    return true;
  }

  function setCosmeticEnrichEnabled(on) {
    if (!global.P) return false;
    if (!global.P.conf) global.P.conf = {};
    global.P.conf.npcAiCosmeticEnrich = !!on;
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
      reason: !c.npcAiPrecision ? 'switch off' : (!hasKey ? 'no API key' : 'enabled')
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
