// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-ai-change-pathutils.js — AI 推演变化·路径工具 + 编辑保护白名单 (拆自 tm-ai-change-applier.js·2026-05-21·Slice 1)
 *
 * 暴露·TM.AIChange.PathUtils·12 函数·
 *   resolvePath / applyPathSet / applyPathDelta / applyPathPush / applyPathMerge
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
    if (_isPathBlocked(path)) return { ok: false, path: path, reason: 'blocked' };
    // AI JSON 必须给真 number。旧逻辑把非数字目标当 0，并直接做 old + delta；
    // delta="5" 时会把 40 写成字符串 "405"，且对文本字段也会凭空造数值。
    if (typeof delta !== 'number' || !isFinite(delta)) {
      return { ok: false, path: path, reason: 'delta must be a finite number' };
    }
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
    if (typeof r.value !== 'number' || !isFinite(r.value)) {
      return { ok: false, path: path, reason: 'delta target must be a finite number' };
    }
    var old = r.value;
    r.parent[r.key] = old + delta;
    _syncCoreVarSideEffects(path, r.parent[r.key], { op: 'delta', delta: delta, reason: reason });
    _recordToTurnChanges(path, old, r.parent[r.key], reason);
    return { ok: true, path: path, old: old, new: r.parent[r.key], delta: delta, reason: reason };
  }

  function _applyPathSet(obj, path, value, reason) {
    path = _normalizeCoreVarPath(path);
    if (_isPathBlocked(path)) return { ok: false, path: path, reason: 'blocked' };
    var valueGate = _validateNestedJsonValue(path, value, 0);
    if (!valueGate.ok) return { ok: false, path: path, reason: valueGate.reason };
    var pathKey = String(path || '').replace(/^GM\./, '');
    var r = _resolvePath(obj, path);
    // 明确列出的动态 map 键属于 schema；除此之外 set 只能修改已存在叶子，禁止幽灵字段。
    var declaredDynamic = /^corruption\.byDept\.(central|provincial|county|military|palace|technical)$/.test(path);
    if (!r.parent || (!r.exists && !declaredDynamic)) return { ok: false, path: path, reason: 'path not declared in state schema' };
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
    if (_isPathBlocked(path)) return { ok: false, path: path, reason: 'blocked' };
    // collection push 的 payload 视作一个元素做敏感路径校验；armies 是例外，它会立即路由
    // applyAIArmyChange 语义 sink（其中 commander 有严格活人校验），故保留 collection 根。
    var valueBase = _normalizeCoreVarPath(path) + (pathKey === 'armies' ? '' : '.0');
    var valueGate = _validateNestedJsonValue(valueBase, value, 0);
    if (!valueGate.ok) return { ok: false, path: path, reason: valueGate.reason };
    if (pathKey === 'armies' && value && typeof value === 'object' && !Array.isArray(value)) {
      var change = Object.assign({}, value);
      if (!change.armyName && change.name) change.armyName = change.name;
      if (change.delta == null && change.soldiers_delta == null) {
        change.delta = Number(change.soldiers != null ? change.soldiers : (change.size != null ? change.size : change.strength)) || 0;
      }
      return _callArmyChange(change, { source: 'path_push.armies' });
    }
    var r = _resolvePath(obj, path);
    if (!r.parent || !r.exists) return { ok: false, path: path, reason: 'push target not declared in state schema' };
    if (!Array.isArray(r.parent[r.key])) return { ok: false, path: path, reason: 'push target must be an array' };
    r.parent[r.key].push(value);
    if (pathKey === 'armies') _callArmyRefresh(obj);
    return { ok: true };
  }

  function _isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    var proto = Object.getPrototypeOf(value);
    // vm/iframe 跨 realm 的 Object.prototype 引用不同；仍只接受构造器名为 Object 的普通 JSON 对象。
    return proto === null || !!(proto && Object.prototype.hasOwnProperty.call(proto, 'constructor') &&
      typeof proto.constructor === 'function' && proto.constructor.name === 'Object');
  }

  function _validateMergePatch(basePath, patch, depth) {
    if (!_isPlainObject(patch)) return { ok: false, reason: 'merge value must be a plain object' };
    return _validateNestedJsonValue(basePath, patch, depth);
  }

  function _validateNestedJsonValue(basePath, value, depth) {
    if (depth > 16) return { ok: false, reason: 'value too deep' };
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return { ok: true };
    if (typeof value === 'number') return isFinite(value) ? { ok: true } : { ok: false, reason: 'non-finite number at ' + basePath };
    if (Array.isArray(value)) {
      for (var ai = 0; ai < value.length; ai++) {
        var arrayGate = _validateNestedJsonValue(basePath + '.' + ai, value[ai], depth + 1);
        if (!arrayGate.ok) return arrayGate;
      }
      return { ok: true };
    }
    if (!_isPlainObject(value)) return { ok: false, reason: 'non-JSON value at ' + basePath };
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var childPath = basePath ? (basePath + '.' + key) : key;
      if (_isPathBlocked(childPath)) return { ok: false, reason: 'value contains blocked path: ' + childPath };
      var nested = _validateNestedJsonValue(childPath, value[key], depth + 1);
      if (!nested.ok) return nested;
    }
    return { ok: true };
  }

  function _mergePlainObject(target, patch) {
    Object.keys(patch).forEach(function(key) {
      var value = patch[key];
      if (_isPlainObject(value)) {
        if (!_isPlainObject(target[key])) target[key] = {};
        _mergePlainObject(target[key], value);
      } else {
        target[key] = value;
      }
    });
    return target;
  }

  function _validateMergeShape(target, patch, basePath) {
    if (!_isPlainObject(target)) return { ok: false, reason: 'merge target must be a plain object' };
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var childPath = basePath ? (basePath + '.' + key) : key;
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        return { ok: false, reason: 'merge field not declared in state schema: ' + childPath };
      }
      if (_isPlainObject(patch[key])) {
        var nested = _validateMergeShape(target[key], patch[key], childPath);
        if (!nested.ok) return nested;
      }
    }
    return { ok: true };
  }

  /**
   * anyPathChanges.op="merge" 的明确语义：仅对普通对象做深 merge；数组/标量叶子替换，
   * 目标不存在时创建普通对象。先完整校验 payload，再一次性落账，避免半写入与原型污染。
   */
  function _applyPathMerge(obj, path, patch, reason) {
    path = _normalizeCoreVarPath(path);
    if (_isPathBlocked(path)) return { ok: false, path: path, reason: 'blocked' };
    var gate = _validateMergePatch(path, patch, 0);
    if (!gate.ok) return { ok: false, path: path, reason: gate.reason };
    var r = _resolvePath(obj, path);
    if (!r.parent || !r.exists) return { ok: false, path: path, reason: 'merge target not declared in state schema' };
    if (!_isPlainObject(r.value)) return { ok: false, path: path, reason: 'merge target must be a plain object' };
    var shapeGate = _validateMergeShape(r.value, patch, path);
    if (!shapeGate.ok) return { ok: false, path: path, reason: shapeGate.reason };
    var old = {};
    _mergePlainObject(old, r.value);
    _mergePlainObject(r.value, patch);
    _recordToTurnChanges(path, old, r.value, reason);
    return { ok: true, path: path, old: old, new: r.value, reason: reason };
  }

  /**
   * changes[] 的统一强类型 dispatcher。返回实际落地数，失败逐项写入 failed；
   * applier 主文件仅负责聚合计数，避免再次膨胀为路径语义巨石。
   */
  function _applyDeclaredPathChanges(obj, changes, report, failed) {
    var count = 0;
    (Array.isArray(changes) ? changes : []).forEach(function(ch) {
      if (!ch || typeof ch !== 'object' || typeof ch.path !== 'string' || !ch.path.trim()) {
        failed.push({ change: ch, reason: 'invalid change/path' });
        return;
      }
      if (_isPathBlocked(ch.path)) { failed.push({ path: ch.path, reason: 'blocked' }); return; }
      var result;
      var hasValue = Object.prototype.hasOwnProperty.call(ch, 'value');
      var hasDelta = Object.prototype.hasOwnProperty.call(ch, 'delta');
      var op = ch.op == null || ch.op === '' ? (hasValue ? 'set' : (hasDelta ? 'delta' : '')) : String(ch.op).toLowerCase();
      if (op === 'push') {
        if (!hasValue) { failed.push({ path: ch.path, reason: 'push requires value' }); return; }
        result = _applyPathPush(obj, ch.path, ch.value);
      } else if (op === 'set') {
        if (!hasValue) { failed.push({ path: ch.path, reason: 'set requires value' }); return; }
        result = _applyPathSet(obj, ch.path, ch.value, ch.reason);
      } else if (op === 'delta') {
        if (typeof ch.delta !== 'number' || !isFinite(ch.delta)) { failed.push({ path: ch.path, reason: 'delta must be a finite number' }); return; }
        result = _applyPathDelta(obj, ch.path, ch.delta, ch.reason);
      } else if (op === 'merge') {
        if (!hasValue) { failed.push({ path: ch.path, reason: 'merge requires object value' }); return; }
        result = _applyPathMerge(obj, ch.path, ch.value, ch.reason);
      } else {
        failed.push({ path: ch.path, reason: 'unsupported op: ' + (op || '(missing)') });
        return;
      }
      if (result && result.ok) {
        count++;
        if (Array.isArray(report)) report.push({
          type: 'change', path: result.path || ch.path, old: result.old, new: result.new,
          delta: ch.delta, reason: ch.reason, turn: obj.turn || 0
        });
      } else {
        failed.push({ path: ch.path, reason: result && result.reason || 'path apply failed' });
      }
    });
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  白名单：AI 不能改的 path
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  AI 编辑路径保护（v2·最小禁区·其余全开放）
  // ═══════════════════════════════════════════════════════════════════
  // 策略：AI 至高权力·能改一切游戏内容·但有几类硬禁区：
  //   1. P.*             ——P 是剧本模板/玩家配置，不是本回合运行态；绝不从 AI 任意路径写
  //   2. GM.saveName     ——存档名·防 AI 污染
  //   3. 时序关键字段    ——turn/year/month/day/sid·防 AI 错乱时间线
  //   4. P.conf.*        ——游戏模式等通用配置·防 AI 偷改
  //   5. 运行时内部字段  ——下划线开头(_*)·如 _pendingShijiModal 等系统态
  var BLOCKED_PATHS = [
    /^turn$/, /^year$/, /^month$/, /^day$/, /^sid$/,
    /^saveName$/i,
    /^_[a-zA-Z]/,           // 下划线开头的内部字段
    /^P(\.|$)/i,             // P.*（运行态真源应写 GM.*）
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
    if (BLOCKED_PATHS.some(function(re) { return probes.some(function(p) { return re.test(p); }); })) return true;

    return probes.some(function(raw) {
      var p = String(raw || '').replace(/\[(\d+)\]/g, '.$1').replace(/^GM\./i, '');
      var segs = p.split('.').filter(Boolean);
      // 任意层级内部字段与 JS 原型链键一律不可达。
      if (segs.some(function(seg) { return /^_/.test(seg) || /^(?:__proto__|prototype|constructor)$/i.test(seg); })) return true;

      // 死亡必须走 character_deaths/applyOneDeath；任职、首领、统帅必须走各自语义 sink。
      if (segs.some(function(seg) { return /^(?:alive|dead|isDead|deceased|positionAtDeath|diedAt|death[a-zA-Z0-9_]*|_death[a-zA-Z0-9_]*)$/i.test(seg); })) return true;
      if (/^chars\.[^.]+\.(?:officialTitle|officialTitles|concurrentTitle|concurrentTitles|position|post|office)(?:\.|$)/i.test(p)) return true;
      if (/^(?:facs|factions)\.[^.]+\.(?:leader|leaderName|leader_name|ruler|newLeader)(?:\.|$)/i.test(p)) return true;
      if (/^(?:facs|factions)\.[^.]+\.leadership\.(?:ruler|leader|newLeader)(?:\.|$)/i.test(p)) return true;
      if (/^(?:facs|factions)\.[^.]+\.leaderInfo\.(?:name|leader|ruler)(?:\.|$)/i.test(p)) return true;
      if (/^(?:parties|partyState)\.[^.]+\.(?:leader|head|leaderName|leader_name|ruler|newLeader|new_leader)(?:\.|$)/i.test(p)) return true;
      if (/^armies\.[^.]+\.(?:commander|commanderName|commanderDisplayName|commander_name|general|generalName|leader|leaderName|commandingOfficer|chiefCommander|chiefGeneral|mainGeneral|newCommander|newGeneral)(?:\.|$)/i.test(p)) return true;
      if (/^officeTree(?:\.|$).*\.(?:holder|actualHolders)(?:\.|$)/i.test(p)) return true;
      if (/^(?:adminHierarchy|regionMap|provinceStats)(?:\.|$).*\.(?:governor|governorName|officialPosition)(?:\.|$)/i.test(p)) return true;
      // 刀C·C3(2026-07-19)·敏感人物字段(失势向量)不得借万能键(anyPathChanges/changes)绕过 char_update 来源判据·须走 char_updates(经 _mergeUpdatesToEntity C3 闸)。
      if (/^chars\.[^.]+\.(?:stance|grade|reputation|fame|faction)(?:\.|$)/i.test(p)) return true;
      return false;
    });
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
    applyPathMerge: _applyPathMerge,
    applyDeclaredPathChanges: _applyDeclaredPathChanges,
    isPlainObject: _isPlainObject,
    validateNestedJsonValue: _validateNestedJsonValue,
    isPathBlocked: _isPathBlocked
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.AIChange.PathUtils;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
