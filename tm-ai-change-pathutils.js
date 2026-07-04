// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-ai-change-pathutils.js — AI 推演变化·路径工具 + 编辑保护白名单 (拆自 tm-ai-change-applier.js·2026-05-21·Slice 1)
 *
 * 暴露·TM.AIChange.PathUtils·12 函数·
 *   resolvePath / applyPathSet / applyPathDelta / applyPathPush
 *   normalizeCoreVarPath / syncCoreVarSideEffects / deriveLabel
 *   findDivisionByNameOrId / findInTreeDeep
 *   recordCharChange / recordToTurnChanges
 *   isPathBlocked
 *
 * 注·_applyPathSet / _applyPathPush 内部对 army 的回调走 lazy 查找·依赖
 *     TM.AIChange.Army (Slice 2 提取) 或全局 applyAIArmyChange / _refreshMilitaryViews。
 *     未加载 Army 模块时·army 分支静默跳过 (不影响非 army path 操作)。
 */
(function(global) {
  'use strict';

  // 延迟查找 army 模块·避免 Slice 1/2 加载顺序耦合
  function _callArmyRefresh(obj) {
    var fn = (global.TM && global.TM.AIChange && global.TM.AIChange.Army && global.TM.AIChange.Army.refreshMilitaryViews)
          || global._refreshMilitaryViews;
    if (typeof fn === 'function') return fn(obj);
  }
  function _callArmyChange(change, opts) {
    var fn = (global.TM && global.TM.AIChange && global.TM.AIChange.Army && global.TM.AIChange.Army.applyAIArmyChange)
          || global.applyAIArmyChange;
    if (typeof fn === 'function') return fn(change, opts);
    return { ok: false, reason: 'Army module not loaded' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  路径解析工具
  // ═══════════════════════════════════════════════════════════════════

  function _resolvePath(obj, path) {
    if (!obj || !path) return { parent:null, key:null, exists:false, value:undefined };
    var keys = String(path).split('.');
    var parent = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      // 支持数组索引：a[0] 或 a.0
      var m = k.match(/^(\w+)\[(\d+)\]$/);
      if (m) {
        if (!parent[m[1]]) return { parent:null, key:null, exists:false, value:undefined };
        parent = parent[m[1]][Number(m[2])];
      } else if (Array.isArray(parent) && isNaN(Number(k))) {
        // 在数组上按 name/id 查找（AI 常写 "chars.张三.loyalty" 这样路径）
        var nextParent = parent.find(function(it) {
          return it && (it.name === k || it.id === k);
        });
        if (!nextParent) return { parent:null, key:null, exists:false, value:undefined };
        parent = nextParent;
      } else if (Array.isArray(parent) && !isNaN(Number(k))) {
        parent = parent[Number(k)];
      } else {
        if (parent[k] === undefined || parent[k] === null) return { parent:null, key:null, exists:false, value:undefined };
        parent = parent[k];
      }
      if (parent === undefined || parent === null) return { parent:null, key:null, exists:false, value:undefined };
    }
    var lastKey = keys[keys.length - 1];
    // 末键也支持在数组上按 name/id 取出（set 时父为 array，key 为 name）
    if (Array.isArray(parent) && isNaN(Number(lastKey))) {
      var target = parent.find(function(it) { return it && (it.name === lastKey || it.id === lastKey); });
      if (target !== undefined) {
        return { parent: parent, key: parent.indexOf(target), exists: true, value: target };
      }
    }
    return { parent: parent, key: lastKey, exists: parent[lastKey] !== undefined, value: parent[lastKey] };
  }

  function _normalizeCoreVarPath(path) {
    var p = String(path || '').trim().replace(/\s+/g, '');
    p = p.replace(/\[(\d+)\]/g, '.$1');
    p = p.replace(/^(GM|gm)\./, '');
    p = p.replace(/^(vars|variables|var|变量|變量|七变量|七變量)\./i, '');
    var aliases = {
      '皇权': 'huangquan.index',
      '皇权.value': 'huangquan.index',
      '皇权.index': 'huangquan.index',
      '皇權': 'huangquan.index',
      '皇權.value': 'huangquan.index',
      '皇權.index': 'huangquan.index',
      '皇威': 'huangwei.index',
      '皇威.value': 'huangwei.index',
      '皇威.index': 'huangwei.index',
      '民心': 'minxin.trueIndex',
      '民心.value': 'minxin.trueIndex',
      '民心.index': 'minxin.trueIndex',
      'minxin.value': 'minxin.trueIndex',
      'minxin.index': 'minxin.trueIndex',
      '吏治': 'corruption.trueIndex',
      '吏治.value': 'corruption.trueIndex',
      '吏治.index': 'corruption.trueIndex',
      '腐败': 'corruption.trueIndex',
      '腐败.value': 'corruption.trueIndex',
      '腐败.index': 'corruption.trueIndex',
      '腐败.overall': 'corruption.trueIndex',
      '腐敗': 'corruption.trueIndex',
      '腐敗.value': 'corruption.trueIndex',
      '腐敗.index': 'corruption.trueIndex',
      '腐敗.overall': 'corruption.trueIndex',
      'corruption.value': 'corruption.trueIndex',
      'corruption.index': 'corruption.trueIndex',
      'corruption.overall': 'corruption.trueIndex',
      'huangquan.value': 'huangquan.index',
      'huangwei.value': 'huangwei.index',
      '国库': 'guoku.money',
      '國庫': 'guoku.money',
      '帑廪': 'guoku.money',
      '帑廩': 'guoku.money',
      '白银': 'guoku.money',
      '银两': 'guoku.money',
      'guoku.balance': 'guoku.money',
      'neicang': 'neitang.money',
      'neicang.money': 'neitang.money',
      'neicang.balance': 'neitang.money',
      '内帑': 'neitang.money',
      '內帑': 'neitang.money',
      'neitang.balance': 'neitang.money'
    };
    return aliases[p] || p;
  }

  function _syncCoreVarSideEffects(path, value, meta) {
    var G = global.GM;
    if (!G) return;
    meta = meta || {};
    var n = Number(value);
    var hasNumber = isFinite(n);
    function syncCorruptionDeptIndex() {
      if (!G.corruption || typeof G.corruption !== 'object') return;
      if (global.CorruptionEngine && typeof global.CorruptionEngine.syncIndexFromSubDepts === 'function') {
        try { global.CorruptionEngine.syncIndexFromSubDepts(meta.reason || 'AI腐败部门调整'); return; } catch(_) {}
      }
      var vals = [];
      Object.keys(G.corruption.subDepts || {}).forEach(function(k) {
        var d = G.corruption.subDepts[k];
        var v = d && typeof d === 'object' ? d.true : d;
        if (typeof v === 'number' && isFinite(v)) vals.push(v);
      });
      if (!vals.length) return;
      var sum = vals.reduce(function(a, b){ return a + b; }, 0);
      G.corruption.trueIndex = sum / vals.length;
      G.corruption.overall = G.corruption.trueIndex;
    }
    if (path === 'guoku.money' && G.guoku) {
      G.guoku.balance = G.guoku.money;
      if (G.guoku.ledgers && G.guoku.ledgers.money) G.guoku.ledgers.money.stock = G.guoku.money;
    }
    if (path === 'neitang.money' && G.neitang) {
      G.neitang.balance = G.neitang.money;
      if (G.neitang.ledgers && G.neitang.ledgers.money) G.neitang.ledgers.money.stock = G.neitang.money;
    }
    if (path === 'huangquan.index' && G.huangquan && typeof G.huangquan === 'object') {
      G.huangquan.value = G.huangquan.index;
    }
    if (path === 'huangwei.index' && G.huangwei && typeof G.huangwei === 'object') {
      G.huangwei.value = G.huangwei.index;
    }
    if (path === 'minxin.trueIndex' && G.minxin && typeof G.minxin === 'object') {
      G.minxin.value = G.minxin.trueIndex;
      if (G.minxin.perceivedIndex === undefined && hasNumber) G.minxin.perceivedIndex = n;
    }
    if (path === 'corruption.trueIndex' && G.corruption && typeof G.corruption === 'object') {
      G.corruption.overall = G.corruption.trueIndex;
      if (G.corruption.perceivedIndex === undefined && hasNumber) G.corruption.perceivedIndex = n;
      if (G.corruption.subDepts && hasNumber) {
        Object.keys(G.corruption.subDepts).forEach(function(k) {
          var d = G.corruption.subDepts[k];
          if (!d || typeof d !== 'object') return;
          if (meta.op === 'delta' && isFinite(Number(meta.delta))) d.true = Math.max(0, Math.min(100, (Number(d.true) || 0) + Number(meta.delta)));
          else d.true = n;
        });
      }
    }
    var subDeptMatch = path.match(/^corruption\.subDepts\.([^.]+)\.true$/);
    if (subDeptMatch && G.corruption && typeof G.corruption === 'object') {
      var subDept = subDeptMatch[1];
      var byDeptMirror = { imperial: 'palace' }[subDept] || subDept;
      if (!G.corruption.byDept) G.corruption.byDept = {};
      if (hasNumber) G.corruption.byDept[byDeptMirror] = n;
      syncCorruptionDeptIndex();
    }
    var byDeptMatch = path.match(/^corruption\.byDept\.([^.]+)$/);
    if (byDeptMatch && G.corruption && typeof G.corruption === 'object' && hasNumber) {
      var byDept = byDeptMatch[1];
      var subDeptMirror = { palace: 'imperial' }[byDept] || byDept;
      if (!G.corruption.subDepts) G.corruption.subDepts = {};
      if (!G.corruption.subDepts[subDeptMirror]) G.corruption.subDepts[subDeptMirror] = {};
      G.corruption.subDepts[subDeptMirror].true = n;
      syncCorruptionDeptIndex();
    }
  }

  // 七变量核心路径标签（纳入原史记 GM.turnChanges.variables 展示机制）
  var _VAR_PATH_LABELS = {
    'guoku.money': '国库·银',
    'guoku.grain': '国库·粮',
    'guoku.cloth': '国库·布',
    'guoku.annualIncome': '岁入',
    'guoku.monthlyIncome': '月入',
    'guoku.monthlyExpense': '月支',
    'neitang.money': '内帑·银',
    'neitang.grain': '内帑·粮',
    'neitang.huangzhuangAcres': '皇庄',
    'huangwei.index': '皇威',
    'huangwei.perceivedIndex': '皇威·视',
    'huangquan.index': '皇权',
    'minxin.trueIndex': '民心',
    'minxin.perceivedIndex': '民心·视',
    'corruption.overall': '腐败',
    'corruption.trueIndex': '腐败',
    'corruption.perceivedIndex': '腐败·视',
    'population.national.mouths': '人口',
    'population.national.households': '户数',
    'population.national.ding': '丁壮',
    'population.fugitives': '逃户',
    'population.hiddenCount': '隐户',
    'environment.nationalLoad': '承载力',
    'partyStrife': '党争',
    'unrest': '叛乱度'
  };

  function _deriveLabel(path) {
    // 动态派生标签（用于区划/公库/官职等嵌套路径）
    var m;
    // 官职公库： officeTree.x.positions.y.publicTreasuryInit.money
    if (/officeTree.*positions.*publicTreasuryInit\.(money|grain|cloth)/.test(path)) {
      var kind = path.match(/publicTreasuryInit\.(\w+)/)[1];
      return '某官职·公库·' + ({money:'银',grain:'米',cloth:'布'}[kind]||kind);
    }
    // 提取行政区划名：adminHierarchy.<fac>.divisions.<div_id_or_name>.xxx
    var divM = path.match(/adminHierarchy\.[^.]+\.divisions\.([^.]+)\./);
    var divName = '';
    if (divM) {
      var rawKey = divM[1];
      // 若是 id（div_xxx 形式），尝试查 name
      if (/^div_/.test(rawKey) && global.GM && global.GM.adminHierarchy) {
        for (var fac in global.GM.adminHierarchy) {
          var divs = global.GM.adminHierarchy[fac] && global.GM.adminHierarchy[fac].divisions || [];
          var found = _findInTreeDeep(divs, rawKey);
          if (found) { divName = found.name || rawKey; break; }
        }
      } else {
        divName = rawKey;
      }
    }
    // 区划人口
    if (/population\.(mouths|households|ding|fugitives|hiddenCount)/.test(path) && /adminHierarchy|divisions|regionMap/.test(path)) {
      var pkey = path.match(/population\.(\w+)/)[1];
      return (divName || '某地') + '·' + ({mouths:'人口',households:'户数',ding:'丁壮',fugitives:'逃户',hiddenCount:'隐户'}[pkey]||pkey);
    }
    // 区划公库
    if (/publicTreasury\.(money|grain|cloth)\.(stock|quota|used)/.test(path)) {
      var tk = path.match(/publicTreasury\.(\w+)/)[1];
      return (divName || '某地') + '·公库·' + ({money:'银',grain:'米',cloth:'布'}[tk]||tk);
    }
    // 区划财政
    if (/fiscal\.(claimedRevenue|actualRevenue|remittedToCenter|retainedBudget)/.test(path)) {
      var fk = path.match(/fiscal\.(\w+)/)[1];
      var labels = {claimedRevenue:'报解',actualRevenue:'实入',remittedToCenter:'上解',retainedBudget:'留支'};
      return (divName || '某地') + '·' + (labels[fk]||fk);
    }
    // 区划民心/腐败
    if (/minxin\.(local|trueIndex|perceivedIndex)/.test(path) && /division|adminHierarchy|regionMap/.test(path)) {
      return (divName || '某地') + '·民心';
    }
    if (/corruption\.(local|trueIndex)/.test(path) && /division|adminHierarchy|regionMap/.test(path)) {
      return (divName || '某地') + '·腐败';
    }
    // 腐败6部门
    if (/corruption\.byDept\.(\w+)/.test(path)) {
      var dept = path.match(/corruption\.byDept\.(\w+)/)[1];
      var deptMap = {central:'京官',provincial:'省级',county:'县级',military:'军中',palace:'内廷',technical:'技术官'};
      return '腐败·' + (deptMap[dept]||dept);
    }
    // NPC 私产
    if (/chars\[?\d*\]?\.resources\.private/.test(path)) {
      return 'NPC·私产';
    }
    return null;
  }

  function _findDivisionByNameOrId(G, key) {
    if (!G || !G.adminHierarchy) return null;
    var fkeys = Object.keys(G.adminHierarchy);
    for (var i = 0; i < fkeys.length; i++) {
      var tree = G.adminHierarchy[fkeys[i]];
      if (!tree || !tree.divisions) continue;
      var found = _findInTreeDeep(tree.divisions, key);
      if (found) return found;
    }
    return null;
  }

  function _findInTreeDeep(divisions, id) {
    for (var i = 0; i < (divisions||[]).length; i++) {
      var d = divisions[i];
      if (d && (d.id === id || d.name === id)) return d;
      if (d && d.children) {
        var f = _findInTreeDeep(d.children, id);
        if (f) return f;
      }
    }
    return null;
  }

  // 省名容错解析：先精确(id/name)，再去常见行政后缀后严格相等匹配——
  // 解决 AI 报「陕西」而行政区真名「陕西布政使司」对不上(命名空间不齐)、按省名查真值失败的坑。
  // 只做"去后缀后相等"(不做前缀/包含·避免「山」误中「山西/山东」)；多个命中时优先返回有数值 minxin 的节点(供民变/民心闸用)。
  var _ADMIN_SUFFIXES = ['承宣布政使司','布政使司','布政司','都指挥使司','行都指挥使司','都司','宣慰司','宣抚司','省'];
  function _stripAdminSuffix(s) {
    s = String(s == null ? '' : s);
    for (var i = 0; i < _ADMIN_SUFFIXES.length; i++) {
      var suf = _ADMIN_SUFFIXES[i];
      if (s.length > suf.length && s.slice(-suf.length) === suf) return s.slice(0, -suf.length);
    }
    return s;
  }
  function _findDivisionByNameFuzzy(G, key) {
    if (!G || !G.adminHierarchy || key == null) return null;
    var exact = _findDivisionByNameOrId(G, key);
    if (exact) return exact;
    var nk = _stripAdminSuffix(key);
    if (!nk || nk.length < 2) return null; // 太短不模糊匹配·防误中
    var best = null, bestHasMx = false;
    function walk(divs) {
      for (var i = 0; i < (divs || []).length; i++) {
        var d = divs[i];
        if (!d) continue;
        if (_stripAdminSuffix(d.name) === nk) {
          var hasMx = typeof d.minxin === 'number';
          if (!best || (hasMx && !bestHasMx)) { best = d; bestHasMx = hasMx; }
        }
        if (d.children) walk(d.children);
      }
    }
    var fkeys = Object.keys(G.adminHierarchy);
    for (var fi = 0; fi < fkeys.length; fi++) {
      var tree = G.adminHierarchy[fkeys[fi]];
      if (tree && tree.divisions) walk(tree.divisions);
    }
    return best;
  }

  function _recordCharChange(path, oldVal, newVal, reason) {
    // 若路径是 chars.<name>.<field> —— 记录到 turnChanges.characters
    var m = String(path).match(/^chars\.([^.]+)\.(\w+)$/);
    if (!m) return;
    var charName = m[1];
    var field = m[2];
    // 只跟踪有显示意义的字段
    var labels = {
      loyalty:'忠诚', ambition:'野心', integrity:'廉节', morale:'士气',
      intelligence:'智', administration:'政', military:'军', scholarship:'学',
      officialTitle:'官职', faction:'派系', alive:'存亡', rank:'品级',
      health:'体', stress:'压力', fame:'名', clanPrestige:'族望',
      strength:'实力', influence:'影响',
      // 2026-04 扩展：状态/位置变化
      location:'所在', illness:'疾病', ill:'疾病', disease:'疾病',
      mourning:'守丧', retired:'致仕', exile:'流放',
      title:'身份'
    };
    if (!labels[field]) return;
    var G = global.GM;
    if (!G.turnChanges) G.turnChanges = {};
    if (!G.turnChanges.characters) G.turnChanges.characters = [];
    // 按人名聚合（匹配 tm-endturn-render.js 期望格式）：{ name, changes:[{field, oldValue, newValue, reason}] }
    var existing = G.turnChanges.characters.find(function(c){return c.name===charName;});
    if (!existing) {
      existing = { name: charName, changes: [] };
      G.turnChanges.characters.push(existing);
    }
    var changeEntry = existing.changes.find(function(x){return x.field===field;});
    if (changeEntry) {
      changeEntry.newValue = newVal;
      if (reason) changeEntry.reason = (changeEntry.reason ? changeEntry.reason + '；' : '') + reason;
    } else {
      existing.changes.push({
        field: field, oldValue: oldVal, newValue: newVal,
        reason: reason || ''
      });
    }
  }

  function _recordToTurnChanges(path, oldVal, newVal, reason) {
    // 同时记录角色变化
    _recordCharChange(path, oldVal, newVal, reason);
    var label = _VAR_PATH_LABELS[path] || _deriveLabel(path);
    if (!label) return;
    var G = global.GM;
    if (!G) return;
    if (!G.turnChanges) G.turnChanges = {};
    if (!G.turnChanges.variables) G.turnChanges.variables = [];
    var existing = G.turnChanges.variables.find(function(v){return v.path === path;});
    if (existing) {
      existing.newValue = newVal;
      if (reason) { existing.reasons = existing.reasons || []; existing.reasons.push({ desc: reason }); }
    } else {
      G.turnChanges.variables.push({
        name: label, path: path,
        oldValue: typeof oldVal === 'number' ? oldVal : 0,
        newValue: typeof newVal === 'number' ? newVal : 0,
        reasons: reason ? [{ desc: reason }] : []
      });
    }
  }

  function _applyPathDelta(obj, path, delta, reason) {
    path = _normalizeCoreVarPath(path);
    var r = _resolvePath(obj, path);
    if (!r.parent) {
      console.warn('[ai-applier] path not found:', path);
      return { ok: false, reason: 'path not found' };
    }
    if (/^chars\.[^.]+\.loyalty$/.test(String(path)) && typeof global.adjustCharacterLoyalty === 'function') {
      var loyDelta = global.adjustCharacterLoyalty(r.parent, delta, reason, {
        source: 'ai-anypath-loyalty-delta',
        ai: true,
        defaultReason: 'AI\u63A8\u6F14',
        maxAbs: 20
      });
      if (!loyDelta || !loyDelta.ok || loyDelta.blocked) return { ok: false, reason: loyDelta && loyDelta.reason || 'loyalty rejected' };
      return { ok: true, old: loyDelta.oldValue, new: loyDelta.newValue, delta: loyDelta.delta, reason: reason };
    }
    var old = typeof r.value === 'number' ? r.value : 0;
    r.parent[r.key] = old + delta;
    _syncCoreVarSideEffects(path, r.parent[r.key], { op: 'delta', delta: delta, reason: reason });
    _recordToTurnChanges(path, old, r.parent[r.key], reason);
    return { ok: true, path: path, old: old, new: r.parent[r.key], delta: delta, reason: reason };
  }

  function _applyPathSet(obj, path, value, reason) {
    path = _normalizeCoreVarPath(path);
    var pathKey = String(path || '').replace(/^GM\./, '');
    var r = _resolvePath(obj, path);
    if (!r.parent) {
      // 尝试创建路径
      var keys = String(path).split('.');
      var cur = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        // 防御:数组上用非数字键 autovivify 会写幽灵属性(arr['名字']·真元素不动·静默失败)→拒绝建路径。
        if (Array.isArray(cur) && !/^\d+$/.test(keys[i])) return { ok: false, path: path, reason: 'array-non-numeric-key:' + keys[i] };
        if (cur[keys[i]] === undefined) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length-1]] = value;
      _syncCoreVarSideEffects(path, value, { op: 'set', reason: reason });
      _recordToTurnChanges(path, undefined, value, reason);
      if (pathKey === 'armies' && Array.isArray(value)) _callArmyRefresh(obj);
      return { ok: true, path: path, old: undefined, new: value, reason: reason };
    }
    var old = r.value;
    if (/^chars\.[^.]+\.loyalty$/.test(String(path)) && typeof global.setCharacterLoyalty === 'function') {
      var loySet = global.setCharacterLoyalty(r.parent, value, reason, {
        source: 'ai-anypath-loyalty-set',
        ai: true,
        defaultReason: 'AI\u63A8\u6F14',
        maxJump: 20
      });
      if (!loySet || !loySet.ok || loySet.blocked) return { ok: false, reason: loySet && loySet.reason || 'loyalty rejected' };
      return { ok: true, old: loySet.oldValue, new: loySet.newValue, reason: reason };
    }
    r.parent[r.key] = value;
    _syncCoreVarSideEffects(path, value, { op: 'set', reason: reason });
    _recordToTurnChanges(path, old, value, reason);
    if (pathKey === 'armies' && Array.isArray(value)) _callArmyRefresh(obj);
    return { ok: true, path: path, old: old, new: value, reason: reason };
  }

  function _applyPathPush(obj, path, value) {
    var pathKey = String(path || '').replace(/^GM\./, '');
    if (pathKey === 'armies' && value && typeof value === 'object' && !Array.isArray(value)) {
      var change = Object.assign({}, value);
      if (!change.armyName && change.name) change.armyName = change.name;
      if (change.delta == null && change.soldiers_delta == null) {
        change.delta = Number(change.soldiers != null ? change.soldiers : (change.size != null ? change.size : change.strength)) || 0;
      }
      return _callArmyChange(change, { source: 'path_push.armies' });
    }
    var r = _resolvePath(obj, path);
    if (!r.parent) {
      var keys = String(path).split('.');
      var cur = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        // 防御:数组上用非数字键 autovivify 会写幽灵属性(arr['名字']·真元素不动·静默失败)→拒绝建路径。
        if (Array.isArray(cur) && !/^\d+$/.test(keys[i])) return { ok: false, path: path, reason: 'array-non-numeric-key:' + keys[i] };
        if (cur[keys[i]] === undefined) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length-1]] = [value];
      return { ok: true };
    }
    if (!Array.isArray(r.parent[r.key])) r.parent[r.key] = [];
    r.parent[r.key].push(value);
    if (pathKey === 'armies') _callArmyRefresh(obj);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  白名单：AI 不能改的 path
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  AI 编辑路径保护（v2·最小禁区·其余全开放）
  // ═══════════════════════════════════════════════════════════════════
  // 策略：AI 至高权力·能改一切游戏内容·但有几类硬禁区：
  //   1. P.ai.*          ——玩家 API 配置·绝不允许
  //   2. GM.saveName     ——存档名·防 AI 污染
  //   3. 时序关键字段    ——turn/year/month/day/sid·防 AI 错乱时间线
  //   4. P.conf.*        ——游戏模式等通用配置·防 AI 偷改
  //   5. 运行时内部字段  ——下划线开头(_*)·如 _pendingShijiModal 等系统态
  var BLOCKED_PATHS = [
    /^turn$/, /^year$/, /^month$/, /^day$/, /^sid$/,
    /^saveName$/i,
    /^_[a-zA-Z]/,           // 下划线开头的内部字段
    /^P\.ai(\.|$)/i,         // P.ai.*
    /^P\.conf(\.|$)/i,       // P.conf.*
    /^GM\.saveName$/i,
    /^ai\.(key|url|model|temp|prompt|rules)/i,
    /_savedKeju|_savedCourtRecords|_savedWentianHistory/i
  ];

  function _isPathBlocked(path) {
    if (!path) return true;
    // 归一化后再对禁区：apply 端在检查之后才剥 GM./vars./空白前缀·裸测原始串可被「GM.turn」这类写法穿透(2026-07-04 审查定罪)
    var probes = [String(path)];
    try {
      var _norm = _normalizeCoreVarPath(String(path));
      if (_norm && probes.indexOf(_norm) < 0) probes.push(_norm);
    } catch (_e) { return true; }
    return BLOCKED_PATHS.some(function(re) { return probes.some(function(p) { return re.test(p); }); });
  }

  // ── Export ──
  var TM = global.TM = global.TM || {};
  TM.AIChange = TM.AIChange || {};
  TM.AIChange.PathUtils = {
    resolvePath: _resolvePath,
    normalizeCoreVarPath: _normalizeCoreVarPath,
    syncCoreVarSideEffects: _syncCoreVarSideEffects,
    deriveLabel: _deriveLabel,
    findDivisionByNameOrId: _findDivisionByNameOrId,
    findDivisionByNameFuzzy: _findDivisionByNameFuzzy,
    findInTreeDeep: _findInTreeDeep,
    recordCharChange: _recordCharChange,
    recordToTurnChanges: _recordToTurnChanges,
    applyPathDelta: _applyPathDelta,
    applyPathSet: _applyPathSet,
    applyPathPush: _applyPathPush,
    isPathBlocked: _isPathBlocked
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.AIChange.PathUtils;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
