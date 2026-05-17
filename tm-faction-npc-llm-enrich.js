// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-llm-enrich.js — NPC 内政 LLM 润色 (Phase F4·2026-05-10)
 *
 * 仅在 P.conf.npcAiPrecision = true 且 P.ai.key 配置时生效。
 * 默认 OFF·保护 token cost。
 *
 * 调用方式 (async):
 *   await TM.FactionNpcLlmEnrich.enrichRecent()  → 选 top N fac·LLM 润色其 last memorial/edict
 *
 * 限流: TM.FactionNpcSettings.maxPerTurn() (默认 8)·按 fac.derivedStrength.value 优先
 * 写到 mem._enrichedContent / edict._enrichedContent·UI 优先显示 enriched
 *
 * 不在 endturn pipeline 默认调 (避免阻塞)·user 在 NPC 查阅 panel 主动触发
 * 或在 setTimeout 异步在 endturn 后台跑
 */
(function(global) {
  'use strict';

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _normFactionName(v) { return String(v == null ? '' : v).replace(/\s+/g, '').trim(); }
  function _isMarkedPlayerFaction(f) {
    return !!(f && (f.isPlayer || f.playerControlled || f.controlledBy === 'player' || f.controller === 'player' || f.controlType === 'player'));
  }
  function _resolvePlayerFactionNames() {
    var G = global.GM || {};
    var P0 = global.P || {};
    var names = [];
    function push(v) {
      var s = String(v == null ? '' : v).trim();
      var k = _normFactionName(s);
      if (s && names.map(_normFactionName).indexOf(k) < 0) names.push(s);
    }
    var pi = P0.playerInfo || {};
    push(pi.factionName);
    push(P0.playerFactionName);
    push(P0.playerFaction);
    push(G.playerFactionName);
    push(G.playerFaction);
    if (G.playerInfo) push(G.playerInfo.factionName);
    _arr(G.facs).forEach(function(f){ if (_isMarkedPlayerFaction(f)) push(f.name); });
    _arr(G.chars).forEach(function(c){ if (c && (c.isPlayer || c.playerControlled || c.controlledBy === 'player')) push(c.faction || c.factionName || c.ownerFaction); });
    return names;
  }
  function _isPlayerFaction(f, playerFactionNames) {
    if (!f) return false;
    if (_isMarkedPlayerFaction(f)) return true;
    var k = _normFactionName(f.name);
    return !!k && _arr(playerFactionNames).some(function(n){ return _normFactionName(n) === k; });
  }

  function _isEnabled() {
    if (!global.TM || !global.TM.FactionNpcSettings) return false;
    if (typeof global.TM.FactionNpcSettings.isCosmeticEnrichEnabled === 'function') {
      return global.TM.FactionNpcSettings.isCosmeticEnrichEnabled();
    }
    return global.TM.FactionNpcSettings.isAiPrecisionEnabled();
  }

  // 拼 NPC 内政 prompt
  function _buildPrompt(fac, item, kind) {
    var ruler = fac.leader || (item.to || item.issuer || '本朝主君');
    var paradigm = (global.TM && global.TM.FactionParadigm) ? global.TM.FactionParadigm.detect(fac.name, fac) : 'generic';
    var derived = fac.derivedHealth || {};
    var econ = fac.derivedEconomy || {};
    var era = (global.P && global.P.scenarioName) || '';

    var sys = '你是一位古文笔法娴熟的史官。任务: 把简版 NPC 内政摘要润色成 80-120 字的史观文笔。';
    sys += '\n背景: ' + era + '·势力·' + fac.name + ' (' + paradigm + ')·主君·' + ruler;
    sys += '\n势力状态: 健康度 ' + (derived.overall || 50) + ' 财政压 ' + (econ.fiscalStress || 0);

    var user = '';
    if (kind === 'memorial') {
      user = '请润色这条奏疏·保留人物 (' + (item.from || '') + ' 上奏 ' + (item.to || '') + ')·类型 (' + (item.type || '') + ')·状态 (' + (item.status || '') + ')。\n原内容: ' + (item.content || '');
      if (item.ruling) user += '\n朱批: ' + item.ruling;
      user += '\n要求·古文文风·80-120 字·保留事实·只增文采。';
    } else if (kind === 'edict') {
      user = '请润色这条诏令·保留发出人 (' + (item.issuer || '') + ')·类型 (' + (item.type || '') + ')·触发原因 (' + (item.trigger || '') + ')。\n原诏: ' + (item.content || '');
      user += '\n要求·诏书古文风格·80-120 字·保留事实·只增文采。';
    }
    return { system: sys, user: user };
  }

  async function _callLLM(prompts) {
    if (typeof global.callAI !== 'function') return null;
    try {
      var combined = prompts.system + '\n\n' + prompts.user;
      var result = await global.callAI(combined, 200, null, 'secondary', { priority: 'background' });  // 走次要 API 省主 quota
      return result || null;
    } catch (e) {
      try { console.warn('[npc-llm-enrich] LLM call failed', e); } catch(_){}
      return null;
    }
  }

  // 选 top N fac (按 derivedStrength)·enrich 其 last memorial + last edict·并发 (Promise.all)
  async function enrichRecent() {
    if (!_isEnabled()) return { skipped: true, reason: 'AI precision off or no key' };
    if (typeof global.GM === 'undefined' || !Array.isArray(global.GM.facs)) return { skipped: true, reason: 'no GM' };
    var maxPerTurn = (global.TM.FactionNpcSettings && global.TM.FactionNpcSettings.maxPerTurn()) || 8;
    var playerFacNames = _resolvePlayerFactionNames();

    var npcs = global.GM.facs
      .filter(function(f){ return f && f.name && !_isPlayerFaction(f, playerFacNames); })
      .sort(function(a, b){
        var sa = (a.derivedStrength && a.derivedStrength.value) || 0;
        var sb = (b.derivedStrength && b.derivedStrength.value) || 0;
        return sb - sa;
      });

    // 收集所有 enrich tasks (max maxPerTurn)·然后 Promise.all 并发
    var tasks = [];  // [{fac, item, kind, prompt}]
    for (var i = 0; i < npcs.length && tasks.length < maxPerTurn; i++) {
      var fac = npcs[i];
      var lastMem = (Array.isArray(fac.npcMemorials) && fac.npcMemorials.length > 0) ? fac.npcMemorials[fac.npcMemorials.length - 1] : null;
      if (lastMem && !lastMem._enrichedContent && tasks.length < maxPerTurn) {
        tasks.push({ fac: fac, item: lastMem, kind: 'memorial', prompt: _buildPrompt(fac, lastMem, 'memorial') });
      }
      var lastEd = (Array.isArray(fac.npcEdicts) && fac.npcEdicts.length > 0) ? fac.npcEdicts[fac.npcEdicts.length - 1] : null;
      if (lastEd && !lastEd._enrichedContent && tasks.length < maxPerTurn) {
        tasks.push({ fac: fac, item: lastEd, kind: 'edict', prompt: _buildPrompt(fac, lastEd, 'edict') });
      }
    }

    var results = await Promise.all(tasks.map(function(t){
      return _callLLM(t.prompt).then(function(r){
        if (r) t.item._enrichedContent = r;
        return r;
      }).catch(function(){ return null; });
    }));
    var enriched = results.filter(function(r){ return !!r; }).length;
    return { enriched: enriched, attempted: tasks.length, skipped: false };
  }

  // Lazy enrich·只 enrich 单个 fac 的 last mem + last edict·user 打开 NPC 查阅 panel 时调
  async function enrichFaction(facName) {
    if (!_isEnabled()) return { skipped: true, reason: 'AI precision off or no key' };
    if (typeof global.GM === 'undefined' || !Array.isArray(global.GM.facs)) return { skipped: true, reason: 'no GM' };
    var fac = global.GM.facs.find(function(x){ return x && x.name === facName; });
    if (!fac) return { skipped: true, reason: 'fac not found' };
    var playerFacNames = _resolvePlayerFactionNames();
    if (_isPlayerFaction(fac, playerFacNames)) return { skipped: true, reason: 'player faction' };

    var tasks = [];
    var lastMem = (Array.isArray(fac.npcMemorials) && fac.npcMemorials.length > 0) ? fac.npcMemorials[fac.npcMemorials.length - 1] : null;
    if (lastMem && !lastMem._enrichedContent) tasks.push({ item: lastMem, prompt: _buildPrompt(fac, lastMem, 'memorial') });
    var lastEd = (Array.isArray(fac.npcEdicts) && fac.npcEdicts.length > 0) ? fac.npcEdicts[fac.npcEdicts.length - 1] : null;
    if (lastEd && !lastEd._enrichedContent) tasks.push({ item: lastEd, prompt: _buildPrompt(fac, lastEd, 'edict') });

    if (tasks.length === 0) return { enriched: 0, attempted: 0, skipped: false, alreadyEnriched: true };

    var results = await Promise.all(tasks.map(function(t){
      return _callLLM(t.prompt).then(function(r){
        if (r) t.item._enrichedContent = r;
        return r;
      }).catch(function(){ return null; });
    }));
    var enriched = results.filter(function(r){ return !!r; }).length;
    return { enriched: enriched, attempted: tasks.length, skipped: false };
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcLlmEnrich = {
    enrichRecent: enrichRecent,
    enrichFaction: enrichFaction,
    _isEnabled: _isEnabled,
    _buildPrompt: _buildPrompt
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { enrichRecent: enrichRecent, enrichFaction: enrichFaction };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
