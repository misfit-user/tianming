// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-invariants.js — GameState 不变量校验器
 *
 * 目的：定义 GM/P 的基本不变量，在关键时点（开局/存档前/加载后/每回合）
 *      自动跑一遍，第一时间发现数据结构损坏。
 *
 * 非侵入设计：
 *   - 不自动接入业务流程
 *   - 由调用方或测试主动触发：TM.invariants.check()
 *   - 可只跑子集：TM.invariants.check('chars')
 *   - 违规不抛，只记录到 TM.errors + 返回报告对象
 *
 * 主要接口：
 *   TM.invariants.check()           // 跑全部，返回 {ok, violations, stats}
 *   TM.invariants.check('chars')    // 只跑某个 group
 *   TM.invariants.listGroups()      // 所有 group 名字
 *   TM.invariants.addCheck(name, fn) // 注册自定义检查
 *
 * 便捷：
 *   TM.invariants.assert()          // check() 后若有违规则 console.error + 返回 false
 *   TM.invariants.enableAutoCheck() // 开启每回合末自动跑（接入 endTurn hook）
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.invariants) return;

  // check 函数签名：fn() → { ok: boolean, violations: [string], details?: Object }
  var registry = {
    // ─── 核心字段存在性与类型 ───
    'gm-root': function() {
      var violations = [];
      if (typeof GM === 'undefined') violations.push('GM 未定义');
      else {
        if (typeof GM.turn !== 'number') violations.push('GM.turn 非数字：' + typeof GM.turn);
        if (GM.turn < 0) violations.push('GM.turn 负数：' + GM.turn);
        if (typeof GM.running !== 'boolean' && GM.running !== undefined) violations.push('GM.running 非 boolean');
      }
      return { ok: violations.length === 0, violations: violations };
    },

    // ─── 角色数组完整性 ───
    'chars': function() {
      var v = [];
      if (!Array.isArray(GM.chars)) { v.push('GM.chars 非数组'); return { ok: false, violations: v }; }
      var noName = 0, noFaction = 0, deadButBusy = 0;
      var nameSet = {};
      var dupNames = [];
      GM.chars.forEach(function(c, i) {
        if (!c) { v.push('chars[' + i + '] 为空'); return; }
        if (!c.name) noName++;
        else {
          if (nameSet[c.name]) dupNames.push(c.name);
          nameSet[c.name] = true;
        }
        if (c.alive === false && c.officialTitle) deadButBusy++;
      });
      if (noName > 0) v.push(noName + ' 个角色缺 name');
      if (dupNames.length > 0) v.push('重名: ' + dupNames.slice(0, 5).join('/'));
      if (deadButBusy > 0) v.push(deadButBusy + ' 个死角色仍占职');
      return {
        ok: v.length === 0,
        violations: v,
        details: { total: GM.chars.length, alive: GM.chars.filter(function(c){return c&&c.alive!==false;}).length, noName: noName, dupNames: dupNames.length, deadButBusy: deadButBusy }
      };
    },

    // ─── 势力引用完整性 ───
    'factions': function() {
      var v = [];
      if (!Array.isArray(GM.facs)) return { ok: true, violations: [], details: { skipped: '无 GM.facs' } };
      var facNames = {};
      GM.facs.forEach(function(f){ if (f && f.name) facNames[f.name] = true; });
      var orphanFac = 0;
      (GM.chars || []).forEach(function(c){
        if (c && c.faction && !facNames[c.faction]) orphanFac++;
      });
      if (orphanFac > 0) v.push(orphanFac + ' 个角色引用不存在的势力');
      return { ok: v.length === 0, violations: v, details: { factions: Object.keys(facNames).length, orphanFacRefs: orphanFac } };
    },

    // ─── 国库结构完整性 ───
    'guoku': function() {
      var v = [];
      if (!GM.guoku) return { ok: true, violations: [], details: { skipped: 'GM.guoku 未初始化' } };
      if (!GM.guoku.ledgers) v.push('GM.guoku.ledgers 缺失');
      else {
        ['money', 'grain', 'cloth'].forEach(function(k){
          if (!GM.guoku.ledgers[k]) v.push('GM.guoku.ledgers.' + k + ' 缺失');
          else if (typeof GM.guoku.ledgers[k].stock !== 'number') v.push('GM.guoku.ledgers.' + k + '.stock 非数字');
        });
      }
      return { ok: v.length === 0, violations: v };
    },

    // ─── 官制树引用一致性 ───
    'officeTree': function() {
      var v = [];
      var tree = GM.officeTree && GM.officeTree.length ? GM.officeTree : null;
      if (!tree) return { ok: true, violations: [], details: { skipped: 'GM.officeTree 空' } };
      var charSet = {};
      (GM.chars || []).forEach(function(c){ if (c && c.name) charSet[c.name] = c; });
      var phantomHolders = 0;
      var deadHolders = 0;
      function walk(nodes) {
        (nodes||[]).forEach(function(n){
          if (!n) return;
          (n.positions||[]).forEach(function(p){
            if (p && p.holder && p.holder !== '空缺') {
              var ch = charSet[p.holder];
              if (!ch) phantomHolders++;
              else if (ch.alive === false) deadHolders++;
            }
          });
          if (n.subs) walk(n.subs);
        });
      }
      walk(tree);
      if (phantomHolders > 0) v.push(phantomHolders + ' 个官职 holder 角色不存在');
      if (deadHolders > 0) v.push(deadHolders + ' 个官职 holder 已死亡');
      return { ok: v.length === 0, violations: v, details: { phantomHolders: phantomHolders, deadHolders: deadHolders } };
    },

    // ─── 行政区划完整性 ───
    'admin': function() {
      var v = [];
      var h = GM.adminHierarchy;
      if (!h || (Array.isArray(h) ? h.length === 0 : Object.keys(h).length === 0)) {
        return { ok: true, violations: [], details: { skipped: 'GM.adminHierarchy 空' } };
      }
      var emptyDivs = 0;
      function walk(nodes) {
        if (!nodes) return;
        var arr = Array.isArray(nodes) ? nodes : Object.values(nodes);
        arr.forEach(function(n){
          if (!n) return;
          if (!n.name) emptyDivs++;
          if (n.children) walk(n.children);
        });
      }
      walk(h);
      if (emptyDivs > 0) v.push(emptyDivs + ' 个行政区划缺 name');
      return { ok: v.length === 0, violations: v, details: { emptyDivs: emptyDivs } };
    },

    // ─── AI 校验与 validation 健康 ───
    'ai-validation': function() {
      var v = [];
      if (!window.TM_AI_SCHEMA) v.push('TM_AI_SCHEMA 未加载');
      if (typeof TM.validateAIOutput !== 'function') v.push('TM.validateAIOutput 未加载');
      return { ok: v.length === 0, violations: v };
    },

    // ─── DA 门面完整性 ───
    'da-facade': function() {
      var v = [];
      if (!window.DA) v.push('DA 门面未加载');
      else {
        var expectedAreas = ['chars', 'factions', 'guoku', 'officeTree', 'admin', 'turn', 'issues', 'armies', 'authority'];
        expectedAreas.forEach(function(a){
          if (!DA[a]) v.push('DA.' + a + ' 缺失');
        });
      }
      return { ok: v.length === 0, violations: v };
    },

    // ─── 存档版本号 ───
    'save-version': function() {
      var v = [];
      if (typeof SAVE_VERSION !== 'number') v.push('SAVE_VERSION 未定义');
      if (typeof SaveMigrations !== 'object' || !SaveMigrations.stamp) v.push('SaveMigrations 残缺');
      return { ok: v.length === 0, violations: v };
    },

    // ─── 当前回合事件/议题 ───
    'turn-state': function() {
      var v = [];
      if (GM.currentIssues && !Array.isArray(GM.currentIssues)) v.push('GM.currentIssues 非数组');
      if (GM._edictSuggestions && !Array.isArray(GM._edictSuggestions)) v.push('GM._edictSuggestions 非数组');
      if (GM.memorials && !Array.isArray(GM.memorials)) v.push('GM.memorials 非数组');
      return { ok: v.length === 0, violations: v };
    }
  };

  function listGroups() {
    return Object.keys(registry);
  }

  function check(groupName) {
    var groups = groupName ? [groupName] : Object.keys(registry);
    var allViolations = [];
    var results = {};
    groups.forEach(function(g){
      var fn = registry[g];
      if (!fn) {
        results[g] = { ok: false, violations: ['未知 group'] };
        allViolations.push(g + ': 未知 group');
        return;
      }
      try {
        var r = fn() || { ok: true, violations: [] };
        results[g] = r;
        (r.violations || []).forEach(function(msg){ allViolations.push('[' + g + '] ' + msg); });
      } catch(e) {
        results[g] = { ok: false, violations: ['检查自身异常: ' + (e.message||e)] };
        allViolations.push('[' + g + '] 检查异常: ' + (e.message||e));
        if (window.TM && TM.errors) TM.errors.capture(e, 'invariants.' + g);
      }
    });
    var report = {
      ok: allViolations.length === 0,
      timestamp: Date.now(),
      turn: (typeof GM !== 'undefined' && GM.turn) || 0,
      violations: allViolations,
      results: results,
      stats: {
        checked: groups.length,
        passed: groups.filter(function(g){ return results[g] && results[g].ok; }).length,
        failed: groups.filter(function(g){ return results[g] && !results[g].ok; }).length
      }
    };
    return report;
  }

  /** 包装 check，若违规则 console.error 并返回 false */
  function assert(groupName) {
    var r = check(groupName);
    if (!r.ok) {
      console.error('[invariants] ' + r.violations.length + ' 个违规：');
      r.violations.forEach(function(v){ console.error('  ✗ ' + v); });
      if (window.TM && TM.errors) {
        TM.errors.capture(new Error('invariants violations: ' + r.violations.length), 'invariants', { violations: r.violations });
      }
    }
    return r.ok;
  }

  /** 允许外部注册新检查 */
  function addCheck(name, fn) {
    if (!name || typeof fn !== 'function') return false;
    registry[name] = fn;
    return true;
  }

  /** 开启每回合末自动跑（通过 hook 或 interval） */
  var _autoEnabled = false;
  function enableAutoCheck() {
    if (_autoEnabled) return;
    _autoEnabled = true;
    // 尝试 hook endTurn——若不可用则用 setInterval 轮询
    var lastTurn = -1;
    setInterval(function() {
      if (typeof GM === 'undefined' || !GM.running) return;
      if (GM.turn !== lastTurn) {
        lastTurn = GM.turn;
        assert();
      }
    }, 5000);
  }

  TM.invariants = {
    check: check,
    assert: assert,
    listGroups: listGroups,
    addCheck: addCheck,
    enableAutoCheck: enableAutoCheck,
    _registry: registry
  };
})();
