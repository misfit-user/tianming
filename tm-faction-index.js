// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-index.js — 势力反向索引 (Layer 2·2026-05-10)
 *
 * 解决 GM.facs 字符串名引用 + 无反向索引的痛点。
 * 写入 GM._facIndex·读取 TM.FactionIndex.get(name)。
 *
 * Schema:
 *   GM._facIndex = {
 *     '势力名': {
 *       chars:     [Character ref, ...],
 *       armies:    [Army ref, ...],
 *       provinces: ['省名', ...],
 *       parties:   { '党名': {memberCount, leader} },
 *       metrics: {
 *         charCount, charByRole: {ruler, court, general, clan, other},
 *         totalSoldiers, armyCount, totalCommanders,
 *         avgLoyalty, avgMutinyRisk,
 *         privatizedRatio,    // controlLevel >= 60 的将领 / 总军数
 *         arrearsArmies,      // payArrearsMonths >= 3 的军数
 *         partyDominantName,  // 该势力内最大党派
 *         partyImbalance,     // 0-1·人数差异度
 *         lastRebuildTurn     // 重建时的 GM.turn·便于 stale 检测
 *       }
 *     }
 *   }
 *
 * Hook:
 *   - startGame 末调一次
 *   - endturn pipeline render-and-finalize 末调一次
 *   - UI 读之前可 defensive call (index 缺失或 turn 不一致时重建)
 */
(function(global) {
  'use strict';

  function _classifyChar(c) {
    if (!c) return 'other';
    var pos = (c.position || c.role || c.title || '');
    var s = String(pos);
    // 君主 / 首领
    if (s.indexOf('君主') >= 0 || s.indexOf('皇帝') >= 0 || s.indexOf('国王') >= 0
        || s.indexOf('首领') >= 0 || s.indexOf('可汗') >= 0 || s.indexOf('汗') >= 0) return 'ruler';
    // 宗室 (优先于"王"·因为亲王/郡王也算宗室)
    if (s.indexOf('宗室') >= 0 || s.indexOf('亲王') >= 0 || s.indexOf('郡王') >= 0
        || s.indexOf('公主') >= 0 || s.indexOf('贝勒') >= 0) return 'clan';
    // 武将
    if (s.indexOf('总兵') >= 0 || s.indexOf('都督') >= 0 || s.indexOf('参将') >= 0
        || s.indexOf('副将') >= 0 || s.indexOf('提督') >= 0 || s.indexOf('守备') >= 0
        || s.indexOf('游击') >= 0 || s.indexOf('经略') >= 0
        || (typeof c.military === 'number' && c.military >= 70 && (c.valor || 0) >= 60)) return 'general';
    // 朝臣
    if (s.indexOf('尚书') >= 0 || s.indexOf('侍郎') >= 0 || s.indexOf('大学士') >= 0
        || s.indexOf('御史') >= 0 || s.indexOf('给事中') >= 0 || s.indexOf('翰林') >= 0
        || s.indexOf('阁') >= 0 || s.indexOf('卿') >= 0 || s.indexOf('监') >= 0) return 'court';
    return 'other';
  }

  function _isAlive(c) {
    if (!c) return false;
    if (c.alive === false) return false;
    if (c.dead === true) return false;
    return true;
  }

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  function rebuild() {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    if (!Array.isArray(GM.facs)) { GM._facIndex = {}; return GM._facIndex; }

    var index = {};
    var turn = GM.turn || 0;

    // 1. 初始化每个 fac 的 entry
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      index[f.name] = {
        chars: [],
        armies: [],
        provinces: [],
        parties: {},
        metrics: {
          charCount: 0,
          charByRole: { ruler: 0, court: 0, general: 0, clan: 0, other: 0 },
          totalSoldiers: 0,
          armyCount: 0,
          totalCommanders: 0,
          avgLoyalty: 0,
          avgMutinyRisk: 0,
          privatizedRatio: 0,
          arrearsArmies: 0,
          partyDominantName: '',
          partyImbalance: 0,
          lastRebuildTurn: turn
        }
      };
    });

    // 2. 索引人物
    var loyaltyAcc = {};   // 势力名 → {sum, count}
    if (Array.isArray(GM.chars)) {
      GM.chars.forEach(function(c) {
        if (!c || !c.faction || !_isAlive(c)) return;
        var entry = index[c.faction];
        if (!entry) return;  // faction 名引用不存在·skip (常见 stale ref)
        entry.chars.push(c);
        entry.metrics.charCount++;
        entry.metrics.charByRole[_classifyChar(c)]++;
        if (typeof c.loyalty === 'number') {
          if (!loyaltyAcc[c.faction]) loyaltyAcc[c.faction] = { sum: 0, count: 0 };
          loyaltyAcc[c.faction].sum += c.loyalty;
          loyaltyAcc[c.faction].count++;
        }
        if (c.party) {
          if (!entry.parties[c.party]) entry.parties[c.party] = { memberCount: 0, leader: '' };
          entry.parties[c.party].memberCount++;
        }
      });
      Object.keys(loyaltyAcc).forEach(function(fn) {
        if (index[fn] && loyaltyAcc[fn].count > 0) {
          index[fn].metrics.avgLoyalty = Math.round(loyaltyAcc[fn].sum / loyaltyAcc[fn].count);
        }
      });
    }

    // 3. 索引军队
    var mutinyAcc = {};
    if (Array.isArray(GM.armies)) {
      GM.armies.forEach(function(a) {
        if (!a || a.destroyed) return;
        // Slice E·只读 a.faction (a.owner 已废)·migrate 在 startGame 已跑
        var owner = a.faction || '';
        if (!owner) return;
        var entry = index[owner];
        if (!entry) return;
        entry.armies.push(a);
        entry.metrics.armyCount++;
        entry.metrics.totalSoldiers += _safeNum(a.soldiers || a.size);
        if (a.commander) entry.metrics.totalCommanders++;
        if ((a.payArrearsMonths || 0) >= 3) entry.metrics.arrearsArmies++;
        if (typeof a.mutinyRisk === 'number') {
          if (!mutinyAcc[owner]) mutinyAcc[owner] = { sum: 0, count: 0 };
          mutinyAcc[owner].sum += a.mutinyRisk;
          mutinyAcc[owner].count++;
        }
      });
      Object.keys(index).forEach(function(name) {
        var entry = index[name];
        if (entry.metrics.armyCount > 0) {
          var priv = entry.armies.filter(function(a){ return (a.controlLevel || 0) >= 60; }).length;
          entry.metrics.privatizedRatio = Math.round(priv / entry.metrics.armyCount * 100) / 100;
        }
        if (mutinyAcc[name] && mutinyAcc[name].count > 0) {
          entry.metrics.avgMutinyRisk = Math.round(mutinyAcc[name].sum / mutinyAcc[name].count);
        }
      });
    }

    // 4. 索引省份 (走 getFactionProvinces·依赖 GM._provinceToFaction)
    if (typeof global.getFactionProvinces === 'function') {
      Object.keys(index).forEach(function(name) {
        try {
          var provs = global.getFactionProvinces(name);
          if (Array.isArray(provs)) index[name].provinces = provs.slice();
        } catch(_) { /* tolerate */ }
      });
    }

    // 4b. territoryStress(2026-07-03·断链B)：省均动荡度(0-100 高=糟)·取 max(unrest, 100-stability) 均值。
    // 供 derivedHealth 第五指标 territorialControl——民变四起/治安崩坏真牵动政权健康度。无省或无账不写(健康度自动回落四指标·老存档零回归)。
    (function () {
      var ps = GM.provinceStats;
      if (!ps) return;
      Object.keys(index).forEach(function (name) {
        var entry = index[name];
        var sum = 0, n = 0;
        (entry.provinces || []).forEach(function (p) {
          var st = ps[p];
          if (!st) return;
          var unrest = isFinite(Number(st.unrest)) ? Number(st.unrest) : null;
          var instab = isFinite(Number(st.stability)) ? 100 - Number(st.stability) : null;
          var v = Math.max(unrest === null ? -1 : unrest, instab === null ? -1 : instab);
          if (v >= 0) { sum += Math.max(0, Math.min(100, v)); n += 1; }
        });
        if (n > 0) entry.metrics.territoryStress = Math.round(sum / n);
      });
    })();

    // 5. 党派 dominant + imbalance + leader (该党 + 该势力 charisma 最高)
    Object.keys(index).forEach(function(name) {
      var entry = index[name];
      var partyNames = Object.keys(entry.parties);
      if (partyNames.length === 0) return;
      var max = 0, dominant = '', total = 0, counts = [];
      partyNames.forEach(function(pn) {
        var cnt = entry.parties[pn].memberCount;
        counts.push(cnt);
        total += cnt;
        if (cnt > max) { max = cnt; dominant = pn; }
        var leaderChar = entry.chars
          .filter(function(c){ return c.party === pn; })
          .sort(function(a,b){ return _safeNum(b.charisma) - _safeNum(a.charisma); })[0];
        if (leaderChar) entry.parties[pn].leader = leaderChar.name || '';
      });
      entry.metrics.partyDominantName = dominant;
      if (total > 0 && partyNames.length >= 2) {
        var minC = Math.min.apply(null, counts);
        entry.metrics.partyImbalance = Math.round((max - minC) / total * 100) / 100;
      }
    });

    GM._facIndex = index;

    // ──────── Slice I·2026-05-10·Bidirectional fac.members ────────
    // 把派生数据写到 faction 对象本身·让 fac 真正"拥有"它的成员
    // 现状：char.faction → fac (单向 string ref)·fac 不知自己有谁
    // 改后：fac.members.{chars, armies, provinces, parties}·O(1) forward query
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      var entry = index[f.name];
      if (!entry) return;
      if (!f.members || typeof f.members !== 'object') f.members = {};
      // 注：直接持引用·不 deep copy·rebuild 时整体覆盖
      f.members.chars = entry.chars.slice();      // 浅拷数组·防止外部 push 污染 entry
      f.members.armies = entry.armies.slice();
      f.members.provinces = entry.provinces.slice();
      f.members.parties = Object.assign({}, entry.parties);
      f.members.summary = {
        charCount: entry.metrics.charCount,
        armyCount: entry.metrics.armyCount,
        provinceCount: entry.provinces.length,
        partyCount: Object.keys(entry.parties).length,
        totalSoldiers: entry.metrics.totalSoldiers,
        rebuiltTurn: turn
      };
    });

    return index;
  }

  function get(facName) {
    if (typeof global.GM === 'undefined') return null;
    if (!global.GM._facIndex) return null;
    return global.GM._facIndex[facName] || null;
  }

  // 防御性·UI 读时若发现 index 不存在或 turn 不一致·自动重建
  function getOrRebuild(facName) {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    var stale = !GM._facIndex
      || !GM._facIndex[facName]
      || (GM._facIndex[facName].metrics.lastRebuildTurn !== (GM.turn || 0));
    if (stale) rebuild();
    return get(facName);
  }

  global.TM = global.TM || {};
  global.TM.FactionIndex = {
    rebuild: rebuild,
    get: get,
    getOrRebuild: getOrRebuild
  };
})(typeof window !== 'undefined' ? window : globalThis);
