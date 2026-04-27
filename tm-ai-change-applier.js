// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-ai-change-applier.js — AI 推演变化应用管道
 *
 * 保证推演 AI 能自由改变游戏中所有数据（含官制/区划/公库/私产/NPC/七变量），
 * 并把每回合变化汇入 GM._turnReport，史记弹窗时分类展示。
 *
 * 核心机制：
 *   1. AI 输出约定 JSON 格式：{narrative, changes, appointments, institutions, regions, events, npc_actions, relations}
 *   2. applyAITurnChanges() 按类型派发
 *   3. _resolveBinding() 公库绑定统一解析
 *   4. onAppointment / onDismissal 钩子融入任免流程
 *   5. _applyPathDelta / _applyPathSet 按 path 改 GM
 *
 * R150 章节导航 (2091 行)：
 *   §1 [L19]   路径解析工具 (_resolvePath / _applyPathSet / _applyPathDelta)
 *   §2 [L285]  AI 编辑路径保护白名单
 *   §3 [L314]  按名字找实体 (跨 chars/facs/parties/classes/armies/items/regions)
 *   §4 [L398]  公库绑定解析 _resolveBinding 统一入口
 *   §5 [L462]  NPC 任免钩子 (onAppointment / onDismissal)
 *   §6 [L703]  动态机构 / 区划 注册
 *   §7 [L750]  ★ 主应用函数 applyAITurnChanges（入口）
 *   §8 [L948]  v2·AI 至高权力扩展通道（全域语义化快捷+兜底 anyPathChanges）
 */
(function(global) {
  'use strict';

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
    'corruption.trueIndex': '腐败·真',
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
    var r = _resolvePath(obj, path);
    if (!r.parent) {
      console.warn('[ai-applier] path not found:', path);
      return { ok: false, reason: 'path not found' };
    }
    var old = typeof r.value === 'number' ? r.value : 0;
    r.parent[r.key] = old + delta;
    _recordToTurnChanges(path, old, r.parent[r.key], reason);
    return { ok: true, old: old, new: r.parent[r.key], delta: delta, reason: reason };
  }

  function _applyPathSet(obj, path, value, reason) {
    var r = _resolvePath(obj, path);
    if (!r.parent) {
      // 尝试创建路径
      var keys = String(path).split('.');
      var cur = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === undefined) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length-1]] = value;
      _recordToTurnChanges(path, undefined, value, reason);
      return { ok: true, old: undefined, new: value, reason: reason };
    }
    var old = r.value;
    r.parent[r.key] = value;
    _recordToTurnChanges(path, old, value, reason);
    return { ok: true, old: old, new: value, reason: reason };
  }

  function _applyPathPush(obj, path, value) {
    var r = _resolvePath(obj, path);
    if (!r.parent) {
      var keys = String(path).split('.');
      var cur = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === undefined) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length-1]] = [value];
      return { ok: true };
    }
    if (!Array.isArray(r.parent[r.key])) r.parent[r.key] = [];
    r.parent[r.key].push(value);
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
    return BLOCKED_PATHS.some(function(re) { return re.test(path); });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  辅助：按名字找实体（跨 chars/facs/parties/classes/armies/items/regions）
  // ═══════════════════════════════════════════════════════════════════
  function _findEntity(G, category, identifier) {
    if (!G || !identifier) return null;
    category = (category || '').toLowerCase();
    if (category === 'char' || category === 'character') {
      var clean = String(identifier).trim().replace(/[\s,，、。？！；：]/g, '');
      if (!clean) return null;
      var exact = (G.chars||[]).find(function(c){ return c && (c.name === clean || c.id === clean); });
      if (exact) return exact;
      // 宽松：去头部称谓(太师/大学士/尚书/公/侯/伯)+去尾部动词·再精确匹配
      var stripped = clean.replace(/^(太\u5E08|太\u5085|太\u4FDD|\u592A\u5B50|\u9646|\u592A\u9632|\u4E2D|\u5927)/, '');
      if (stripped && stripped !== clean) {
        exact = (G.chars||[]).find(function(c){ return c && c.name === stripped; });
        if (exact) return exact;
      }
      // 宽松：char.name 作为 prefix（"张惟贤接" → "张惟贤"）
      var prefix = (G.chars||[]).find(function(c){ return c && c.name && clean.indexOf(c.name) === 0 && clean.length - c.name.length <= 2; });
      if (prefix) return prefix;
      return null;
    } else if (category === 'faction' || category === 'fac') {
      return (G.facs||[]).find(function(f){ return f && (f.name === identifier || f.id === identifier); });
    } else if (category === 'party') {
      return (G.parties||[]).find(function(p){ return p && (p.name === identifier || p.id === identifier); });
    } else if (category === 'class') {
      return (G.classes||[]).find(function(c){ return c && (c.name === identifier || c.id === identifier); });
    } else if (category === 'army') {
      return (G.armies||[]).find(function(a){ return a && (a.name === identifier || a.id === identifier); });
    } else if (category === 'item') {
      return (G.items||[]).find(function(i){ return i && (i.name === identifier || i.id === identifier); });
    } else if (category === 'region' || category === 'division') {
      return _findDivisionByNameOrId(G, identifier);
    }
    return null;
  }

  /** 深度 merge updates 到 entity·每个字段变化记入 _turnReport */
  function _mergeUpdatesToEntity(entity, updates, reportType, entityName) {
    if (!entity || !updates) return 0;
    var G = global.GM;
    var count = 0;
    Object.keys(updates).forEach(function(key){
      // 跳过禁区字段（以 _ 开头）
      if (/^_/.test(key)) return;
      var newVal = updates[key];
      var oldVal = entity[key];
      // 数组追加（key 以 + 开头·如 "+careerHistory"）
      if (/^\+/.test(key)) {
        var realKey = key.slice(1);
        if (!Array.isArray(entity[realKey])) entity[realKey] = [];
        if (Array.isArray(newVal)) entity[realKey] = entity[realKey].concat(newVal);
        else entity[realKey].push(newVal);
        count++;
      } else if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal) &&
                 typeof entity[key] === 'object' && entity[key] !== null && !Array.isArray(entity[key])) {
        // 对象深 merge
        Object.keys(newVal).forEach(function(subK){
          if (/^_/.test(subK)) return;
          entity[key][subK] = newVal[subK];
        });
        count++;
      } else {
        entity[key] = newVal;
        count++;
      }
      if (G && G._turnReport) {
        G._turnReport.push({
          type: reportType || 'entity_update',
          entity: entityName || entity.name || entity.id,
          field: key,
          old: oldVal,
          new: entity[key],
          turn: G.turn||0
        });
      }
      // 若是人物更新·同步登记到 turnChanges.characters（供史记数值变化说明显示）
      if (reportType === 'char_update' && entityName && !/^\+/.test(key)) {
        try { _recordCharChange('chars.' + entityName + '.' + key, oldVal, entity[key], ''); } catch(_rcE){ if(window.TM&&TM.errors) TM.errors.capture(_rcE,'applier.recordCharChange'); }
      }
    });
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  公库绑定解析（统一入口）
  // ═══════════════════════════════════════════════════════════════════

  function _resolveBinding(binding) {
    var G = global.GM;
    if (!G || !binding) return null;
    var parts = String(binding).split(':');
    var type = parts[0], id = parts[1];
    switch (type) {
      case 'region':
        if (G.regionMap && G.regionMap[id]) return G.regionMap[id];
        if (G.dynamicInstitutions && G.dynamicInstitutions.regions && G.dynamicInstitutions.regions[id]) return G.dynamicInstitutions.regions[id];
        // 尝试 adminHierarchy 查找
        if (G.adminHierarchy) {
          for (var facId in G.adminHierarchy) {
            var divs = G.adminHierarchy[facId].divisions || [];
            var found = _findInTree(divs, id);
            if (found) return found;
          }
        }
        return null;
      case 'ministry':
        if (G.fiscal && G.fiscal.guoku && G.fiscal.guoku.subBudgets && G.fiscal.guoku.subBudgets[id]) return G.fiscal.guoku.subBudgets[id];
        if (G.dynamicInstitutions && G.dynamicInstitutions.ministries && G.dynamicInstitutions.ministries[id]) return G.dynamicInstitutions.ministries[id];
        return null;
      case 'military':
        if (G.fiscal && G.fiscal.guoku && G.fiscal.guoku.subBudgets && G.fiscal.guoku.subBudgets.military && G.fiscal.guoku.subBudgets.military[id]) return G.fiscal.guoku.subBudgets.military[id];
        if (G.dynamicInstitutions && G.dynamicInstitutions.militaryUnits && G.dynamicInstitutions.militaryUnits[id]) return G.dynamicInstitutions.militaryUnits[id];
        return null;
      case 'imperial':
        if (G.fiscal && G.fiscal.neicang && G.fiscal.neicang.subBudgets && G.fiscal.neicang.subBudgets[id]) return G.fiscal.neicang.subBudgets[id];
        return null;
      default:
        return null;
    }
  }

  function _findInTree(divisions, id) {
    for (var i = 0; i < (divisions||[]).length; i++) {
      var d = divisions[i];
      if (d && d.id === id) return d;
      if (d && d.children) {
        var f = _findInTree(d.children, id);
        if (f) return f;
      }
    }
    return null;
  }

  function _ensurePublicTreasury(entity) {
    if (!entity) return null;
    if (!entity.publicTreasury) {
      entity.publicTreasury = {
        money: { stock:0, quota:0, used:0, available:0, deficit:0 },
        grain: { stock:0, quota:0, used:0, available:0, deficit:0 },
        cloth: { stock:0, quota:0, used:0, available:0, deficit:0 },
        currentHead: null, previousHead: null,
        handoverLog: []
      };
    }
    return entity.publicTreasury;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  NPC 任免钩子
  // ═══════════════════════════════════════════════════════════════════

  function _findChar(name) {
    var G = global.GM;
    if (!G || !G.chars) return null;
    return G.chars.find(function(c){return c.name === name;});
  }

  // 遍历 officeTree，找到 name 匹配的 position；可选 deptHint 限定部门
  function _findOfficePos(tree, positionName, deptHint) {
    if (!tree || !positionName) return null;
    var found = null;
    function walk(nodes, parentPath) {
      (nodes||[]).forEach(function(n) {
        if (found) return;
        if (!n) return;
        var curPath = (parentPath ? parentPath + '/' : '') + (n.name||'');
        if (Array.isArray(n.positions)) {
          for (var i = 0; i < n.positions.length; i++) {
            var p = n.positions[i];
            if (!p || !p.name) continue;
            // 精确匹配 + 模糊匹配（position 名含/被含）
            var match = p.name === positionName || p.name.indexOf(positionName) >= 0 || positionName.indexOf(p.name) >= 0;
            if (!match) continue;
            // 若指定部门提示且不匹配，继续找更好的
            if (deptHint && curPath.indexOf(deptHint) < 0 && n.name !== deptHint) continue;
            found = { node: n, pos: p, path: curPath };
            return;
          }
        }
        if (Array.isArray(n.subs)) walk(n.subs, curPath);
      });
    }
    // 第一遍：有 deptHint 约束
    if (deptHint) walk(tree, '');
    // 第二遍：无约束 fallback
    if (!found) { deptHint = null; walk(tree, ''); }
    return found;
  }

  function onAppointment(charName, position, binding) {
    var G = global.GM;
    var ch = _findChar(charName);
    if (!ch) return { ok: false, reason: '未找到角色 ' + charName };
    // 解绑旧
    var oldBinding = ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.binding;
    if (oldBinding) {
      var oldEntity = _resolveBinding(oldBinding);
      if (oldEntity) {
        _ensurePublicTreasury(oldEntity);
        oldEntity.publicTreasury.handoverLog.push({
          turn: G.turn || 0,
          fromChar: charName,
          toChar: null,
          note: '转任 ' + (position || '新职'),
          deficit: oldEntity.publicTreasury.money.deficit || 0
        });
        oldEntity.publicTreasury.previousHead = charName;
        oldEntity.publicTreasury.currentHead = null;
      }
    }
    // 建新绑定
    if (!ch.resources) ch.resources = {};
    if (!ch.resources.publicTreasury) ch.resources.publicTreasury = { binding: null };
    ch.resources.publicTreasury.binding = binding || null;
    if (position) ch.officialTitle = position;
    if (position && ch.currentPosition) ch.currentPosition.title = position;

    // ★ 核心修复：同步 officeTree.positions.holder —— 官制面板靠此字段
    var treeUpdated = false;
    var evicted = null;
    if (position) {
      // 1) 先扫 officeTree 清除本人持有的其他职位（避免一人占两位）
      function _clearOldHolders(nodes) {
        (nodes||[]).forEach(function(n) {
          if (!n) return;
          if (Array.isArray(n.positions)) {
            n.positions.forEach(function(p) {
              if (!p) return;
              var wasHolder = (p.holder === charName);
              // actualHolders 里也要剔除
              if (Array.isArray(p.actualHolders)) {
                var oldIdx = -1;
                for (var _i=0;_i<p.actualHolders.length;_i++){
                  if (p.actualHolders[_i] && p.actualHolders[_i].name === charName) { oldIdx = _i; break; }
                }
                if (oldIdx >= 0) {
                  var removed = p.actualHolders.splice(oldIdx, 1)[0];
                  if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
                  p.holderHistory.push({ name: charName, since: (removed && removed.joinedTurn) || 0, until: G.turn||0, reason: '转任' });
                  // 若主 holder 被腾走·从剩余 actualHolders 回填
                  if (wasHolder) {
                    p.holder = (p.actualHolders[0] && p.actualHolders[0].name) || '';
                    p.holderSinceTurn = (p.actualHolders[0] && p.actualHolders[0].joinedTurn) || (G.turn||0);
                  }
                }
              } else if (wasHolder) {
                // 无 actualHolders 结构·单人位直接清
                if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
                p.holderHistory.push({ name: charName, since: p.holderSinceTurn||0, until: G.turn||0, reason: '转任' });
                p.holder = '';
              }
            });
          }
          if (Array.isArray(n.subs)) _clearOldHolders(n.subs);
        });
      }
      var deptHint = (binding && typeof binding === 'object') ? (binding.dept || binding.deptHint) : null;
      _clearOldHolders(G.officeTree || []);
      // 2) 找目标 position 并写入·按 headCount 允许几人同任
      var hit = _findOfficePos(G.officeTree || [], position, deptHint);
      if (hit) {
        var pos = hit.pos;
        var cap = Math.max(1, parseInt(pos.headCount) || 1);
        // 初始化 actualHolders（兼容老数据只有 holder 字段）
        if (!Array.isArray(pos.actualHolders)) {
          pos.actualHolders = [];
          if (pos.holder) pos.actualHolders.push({ name: pos.holder, joinedTurn: pos.holderSinceTurn||0 });
        }
        var curCount = pos.actualHolders.length;
        // 若此人已在任（不常见·前面已清）直接跳
        if (pos.actualHolders.some(function(h){return h&&h.name===charName;})) {
          // no-op
        } else if (curCount < cap) {
          // 有空额·直接 append·不罢免他人
          pos.actualHolders.push({ name: charName, joinedTurn: G.turn||0 });
        } else {
          // 超员·按策略罢免 oldest（最早 joinedTurn 者）
          var oldestIdx = 0;
          var oldestTurn = Number.POSITIVE_INFINITY;
          pos.actualHolders.forEach(function(h, idx){
            if (!h) return;
            var jt = (typeof h.joinedTurn === 'number') ? h.joinedTurn : 0;
            if (jt < oldestTurn) { oldestTurn = jt; oldestIdx = idx; }
          });
          var removed2 = pos.actualHolders.splice(oldestIdx, 1)[0];
          if (removed2 && removed2.name) {
            evicted = removed2.name;
            var prevCh2 = _findChar(removed2.name);
            if (prevCh2 && (prevCh2.officialTitle === pos.name || prevCh2.officialTitle === position)) prevCh2.officialTitle = '';
            if (!Array.isArray(pos.holderHistory)) pos.holderHistory = [];
            pos.holderHistory.push({ name: removed2.name, since: removed2.joinedTurn||0, until: G.turn||0, reason: '额满·最老者罢黜' });
            if (global.addEB) global.addEB('\u4EFB\u514D', pos.name + ' \u989D\u6EE1\uFF08' + cap + '\u4EBA\uFF09\u2014\u2014' + removed2.name + ' \u7F62');
          }
          pos.actualHolders.push({ name: charName, joinedTurn: G.turn||0 });
        }
        // 同步 primary holder（兼容旧 UI 只读 holder 字段）
        pos.holder = (pos.actualHolders[0] && pos.actualHolders[0].name) || charName;
        pos.holderSinceTurn = (pos.actualHolders[0] && pos.actualHolders[0].joinedTurn) || (G.turn || 0);
        treeUpdated = true;
        // 修正 ch.officialTitle 为树里的规范名称
        if (pos.name && pos.name !== position) ch.officialTitle = pos.name;
        // 同时同步公库绑定到该位（若编辑器 position 有 bindingHint）
        if (!binding && pos.bindingHint) {
          ch.resources.publicTreasury.binding = { dept: hit.node.name, position: pos.name, hint: pos.bindingHint };
        }
      } else {
        if (global.addEB) global.addEB('\u4EFB\u514D\u203B', '\u5B98\u5236\u65E0 \u300C' + position + '\u300D\u4E00\u804C\uFF0C\u4EC5\u8BB0\u5728\u89D2\u8272\u8868 officialTitle');
      }
    }

    if (binding) {
      var newEntity = _resolveBinding(binding);
      if (newEntity) {
        _ensurePublicTreasury(newEntity);
        newEntity.publicTreasury.currentHead = charName;
        newEntity.publicTreasury.headSinceTurn = G.turn || 0;
        // 若前任留亏空 → 生成奏疏提示（风闻）
        if (newEntity.publicTreasury.money.deficit > 0) {
          if (global.addEB) global.addEB('任免', charName + ' 承 ' + (newEntity.publicTreasury.previousHead||'前任') + ' 亏空 ' + newEntity.publicTreasury.money.deficit + ' 两');
        }
      }
    }
    if (global.addEB) global.addEB('任免', '擢 ' + charName + ' 为 ' + (position||'某职') + (treeUpdated?'':' \u00B7 \u5B98\u5236\u672A\u540C\u6B65') + (evicted?' \u00B7 \u989D\u6EE1\u7F62 '+evicted:''));
    return { ok: true, treeUpdated: treeUpdated, evicted: evicted };
  }

  function onDismissal(charName, reason) {
    var G = global.GM;
    var ch = _findChar(charName);
    if (!ch) return { ok: false, reason: '未找到 ' + charName };
    var binding = ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.binding;
    if (binding) {
      var entity = _resolveBinding(binding);
      if (entity) {
        _ensurePublicTreasury(entity);
        entity.publicTreasury.handoverLog.push({
          turn: G.turn || 0,
          fromChar: charName,
          toChar: null,
          note: reason || '免职',
          deficit: entity.publicTreasury.money.deficit || 0
        });
        entity.publicTreasury.previousHead = charName;
        entity.publicTreasury.currentHead = null;
      }
    }
    if (ch.resources && ch.resources.publicTreasury) ch.resources.publicTreasury.binding = null;
    var _reasonStr = String(reason || '');
    // ★ 状态分级·根据 reason 关键字设置精确状态字段·让 chaoyi/wendui/shizheng UI 自动过滤
    // 死刑/处决 → alive=false; 下狱 → _imprisoned=true; 流放 → _exiled=true; 致仕 → _retired=true; 逃亡 → _fled=true
    if (/处决|斩|诛|赐死|execute|凌迟|绞|死刑/.test(_reasonStr)) {
      ch.alive = false;
      ch._deathCause = _reasonStr;
      ch._deathTurn = G.turn || 0;
    } else if (/下狱|捉拿|逮捕|押|拘|入狱|系狱|imprison|jail/.test(_reasonStr)) {
      ch._imprisoned = true;
      ch._imprisonedTurn = G.turn || 0;
      ch._imprisonReason = _reasonStr;
      // 同步官职状态：兵部尚书·下狱待决（不清官职·只标状态）
      if (ch.officialTitle && !/下狱/.test(ch.officialTitle)) ch._origOfficialTitle = ch.officialTitle;
    } else if (/流放|发配|戍边|exile|banish/.test(_reasonStr)) {
      ch._exiled = true;
      ch._exileTurn = G.turn || 0;
      ch._exileReason = _reasonStr;
    } else if (/致仕|乞骸|归田|退休|retire/.test(_reasonStr)) {
      ch._retired = true;
      ch.retired = true;  // 兼容老字段
    } else if (/逃|遁|匿|逃亡|失踪|flee|missing/.test(_reasonStr)) {
      ch._fled = true;
      ch._missing = true;
    }
    // 抄家通常与下狱/处决并发·独立 if (不互斥·一个动作可同时下狱+抄家)
    // 抄家·触发真实财产清算（私产→内帑·含隐匿挖掘+亲族株连）
    var _confKey = _reasonStr;
    if (_confKey === '抄家' || /抄|籍没|没官|抄没|查抄|抄家/.test(_confKey)) {
      try {
        if (global.EconomyLinkage && typeof global.EconomyLinkage.triggerConfiscationByName === 'function' && !ch._confiscated) {
          // 默认入内帑·intensity 0.6（中度挖掘+轻度株连）·若 reason 含「重抄」「严抄」则提级
          var _intense = /重抄|严抄|彻查|连坐|株连/.test(_confKey) ? 0.85 : 0.6;
          var _confR = global.EconomyLinkage.triggerConfiscationByName(charName, 'neitang', _intense);
          if (_confR && _confR.success) {
            ch._confiscated = true;
            if (global.addEB) {
              var _wan = Math.round((_confR.total||0)/10000);
              global.addEB('惩罚', '抄' + charName + '家·明 ' + Math.round((_confR.visible||0)/10000) + ' 万 + 暗 ' + Math.round((_confR.hidden||0)/10000) + ' 万 = 共 ' + _wan + ' 万两入内帑');
            }
            if (global.GM && global.GM.qijuHistory) {
              var _qd = (typeof getTSText === 'function') ? getTSText(global.GM.turn) : '';
              global.GM.qijuHistory.unshift({ turn: global.GM.turn, date: _qd, content: '【抄家】抄' + charName + '家产·得银 ' + Math.round((_confR.total||0)/10000) + ' 万两·解内帑。' });
            }
          }
        }
      } catch(_confE) { try { window.TM&&TM.errors&&TM.errors.captureSilent&&TM.errors.captureSilent(_confE,'confiscate'); } catch(__){} }
    }
    // ★ 清 officeTree 里所有此人 holder + actualHolders
    (function _clearAll(nodes){
      (nodes||[]).forEach(function(n){
        if (!n) return;
        if (Array.isArray(n.positions)) n.positions.forEach(function(p){
          if (!p) return;
          var removedFromArr = null;
          if (Array.isArray(p.actualHolders)) {
            var i = -1;
            for (var k=0;k<p.actualHolders.length;k++){
              if (p.actualHolders[k] && p.actualHolders[k].name === charName) { i = k; break; }
            }
            if (i >= 0) removedFromArr = p.actualHolders.splice(i, 1)[0];
          }
          var wasPrimary = (p.holder === charName);
          if (removedFromArr || wasPrimary) {
            if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
            p.holderHistory.push({ name: charName, since: (removedFromArr && removedFromArr.joinedTurn) || p.holderSinceTurn || 0, until: G.turn||0, reason: reason||'免职' });
          }
          if (wasPrimary) {
            // primary 被免·由 actualHolders 回填
            p.holder = (Array.isArray(p.actualHolders) && p.actualHolders[0] && p.actualHolders[0].name) || '';
            p.holderSinceTurn = (Array.isArray(p.actualHolders) && p.actualHolders[0] && p.actualHolders[0].joinedTurn) || 0;
          }
        });
        if (Array.isArray(n.subs)) _clearAll(n.subs);
      });
    })(G.officeTree || []);
    ch.officialTitle = null;
    if (global.addEB) global.addEB('任免', charName + ' ' + (reason || '免职'));
    return { ok: true };
  }

  function onTransfer(charName, fromPosition, toPosition, toBinding) {
    onDismissal(charName, '转任');
    return onAppointment(charName, toPosition, toBinding);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  动态机构 / 区划 注册
  // ═══════════════════════════════════════════════════════════════════

  function registerInstitution(spec) {
    var G = global.GM;
    if (!G.dynamicInstitutions) G.dynamicInstitutions = { ministries:{}, regions:{}, militaryUnits:{} };
    var inst = Object.assign({
      id: spec.id || 'inst_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      name: spec.name || '新设机构',
      createdTurn: G.turn || 0,
      stage: 'running'
    }, spec);
    _ensurePublicTreasury(inst);
    if (spec.type === 'region') G.dynamicInstitutions.regions[inst.id] = inst;
    else if (spec.type === 'military') G.dynamicInstitutions.militaryUnits[inst.id] = inst;
    else G.dynamicInstitutions.ministries[inst.id] = inst;
    if (global.addEB) global.addEB('新制', '设 ' + inst.name);
    return inst;
  }

  function abolishInstitution(id, reason) {
    var G = global.GM;
    if (!G.dynamicInstitutions) return { ok:false };
    var inst = null;
    ['ministries','regions','militaryUnits'].forEach(function(pool) {
      if (G.dynamicInstitutions[pool] && G.dynamicInstitutions[pool][id]) inst = G.dynamicInstitutions[pool][id];
    });
    if (!inst) return { ok:false };
    inst.stage = 'abolished';
    inst.abolishedTurn = G.turn || 0;
    inst.abolishReason = reason || '裁撤';
    if (global.addEB) global.addEB('新制', inst.name + ' 裁撤');
    return { ok: true };
  }

  function reclassifyRegion(regionId, newType, reason) {
    var G = global.GM;
    var r = null;
    if (G.regionMap && G.regionMap[regionId]) r = G.regionMap[regionId];
    if (!r && G.dynamicInstitutions && G.dynamicInstitutions.regions) r = G.dynamicInstitutions.regions[regionId];
    if (!r) return { ok: false };
    r.regionType = newType;
    if (global.addEB) global.addEB('区划', regionId + ' 改为 ' + newType + '（' + (reason||'') + '）');
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主应用函数：applyAITurnChanges
  // ═══════════════════════════════════════════════════════════════════

  function applyAITurnChanges(aiOutput) {
    var G = global.GM;
    if (!G) return { ok: false };
    if (!aiOutput || typeof aiOutput !== 'object') return { ok: false };

    // 确保 _turnReport 存在
    if (!G._turnReport) G._turnReport = [];

    var applied = {
      changes: 0, appointments: 0, institutions: 0, regions: 0,
      events: 0, npcActions: 0, relations: 0, failed: [],
      // 保守版 validator 用·记录调用 applier 前的数组长度·用于"数量是否增加"判定
      _warsBefore: Array.isArray(G.activeWars) ? G.activeWars.length : 0,
      _revoltsBefore: (G.minxin && Array.isArray(G.minxin.revolts)) ? G.minxin.revolts.length : 0,
      _disastersBefore: Array.isArray(G.activeDisasters) ? G.activeDisasters.length : 0,
      // 激进版 validator 用
      _partiesBefore: Array.isArray(G.parties) ? G.parties.length : 0,
      _edictsBefore: Array.isArray(G.activeEdicts) ? G.activeEdicts.length : 0,
      _omensBefore: Array.isArray(G.omens) ? G.omens.length : ((G.events||[]).filter(function(e){return e&&(e.type==='omen'||e.category==='omen');}).length),
      _religionsBefore: Array.isArray(G.religions) ? G.religions.length : 0
    };

    // 叙事
    if (aiOutput.narrative) {
      G._turnReport.push({ type: 'narrative', text: aiOutput.narrative, turn: G.turn||0 });
    }

    // 1. 数据变化
    (aiOutput.changes || []).forEach(function(ch) {
      if (_isPathBlocked(ch.path)) {
        applied.failed.push({ path: ch.path, reason: 'blocked' });
        return;
      }
      var result;
      if (ch.op === 'push') {
        result = _applyPathPush(G, ch.path, ch.value);
      } else if (ch.op === 'set' || ch.value !== undefined) {
        result = _applyPathSet(G, ch.path, ch.value, ch.reason);
      } else {
        result = _applyPathDelta(G, ch.path, ch.delta, ch.reason);
      }
      if (result.ok) {
        applied.changes++;
        G._turnReport.push({
          type: 'change',
          path: ch.path,
          old: result.old,
          new: result.new,
          delta: ch.delta,
          reason: ch.reason,
          turn: G.turn||0
        });
      } else {
        applied.failed.push({ path: ch.path, reason: result.reason });
      }
    });

    // 2. 任免
    (aiOutput.appointments || []).forEach(function(a) {
      var r;
      if (a.action === 'appoint') r = onAppointment(a.charName, a.position, a.binding);
      else if (a.action === 'dismiss') r = onDismissal(a.charName, a.reason);
      else if (a.action === 'transfer') r = onTransfer(a.charName, a.fromPosition, a.toPosition, a.binding);
      if (r && r.ok) {
        applied.appointments++;
        G._turnReport.push({ type:'appointment', action:a.action, charName:a.charName, position:a.position||a.toPosition, turn:G.turn||0 });
      } else {
        applied.failed.push({ appointment: a, reason: r && r.reason });
      }
    });

    // 3. 动态机构
    (aiOutput.institutions || []).forEach(function(i) {
      var r;
      if (i.action === 'create') r = { ok:true, inst: registerInstitution(i) };
      else if (i.action === 'abolish') r = abolishInstitution(i.id, i.reason);
      if (r && r.ok) {
        applied.institutions++;
        G._turnReport.push({ type:'institution', action:i.action, name:i.name||i.id, turn:G.turn||0 });
      }
    });

    // 4. 区划变动
    (aiOutput.regions || []).forEach(function(rg) {
      if (rg.action === 'reclassify') {
        var r = reclassifyRegion(rg.id, rg.newType, rg.reason);
        if (r.ok) {
          applied.regions++;
          G._turnReport.push({ type:'region', action:'reclassify', id:rg.id, newType:rg.newType, turn:G.turn||0 });
        }
      }
    });

    // 4.5 地方官自主治理（localActions）—— 央地财政方案 Phase 3.3 discretionary
    // schema: { region, type:'disaster_relief|public_works_water|public_works_road|education|granary_stockpile|military_prep|charity_local|illicit', amount, reason, proposer }
    (aiOutput.localActions || []).forEach(function(la) {
      if (!la || !la.region || !la.type) return;
      var div = _findDivisionByNameOrId(G, la.region);
      if (!div) { applied.failed.push({localAction:la, reason:'region not found'}); return; }
      if (!div.fiscal) div.fiscal = {};
      if (!div.fiscal.expenditures) div.fiscal.expenditures = { fixed:[], discretionary:[], imperial:[], illicit:[], downstream:[] };
      var bucket = (la.type === 'illicit') ? 'illicit' : 'discretionary';
      div.fiscal.expenditures[bucket].push({
        type: la.type,
        amount: Math.max(0, Math.round(la.amount||0)),
        reason: la.reason || '',
        proposer: la.proposer || div.governor || '某地方官',
        turn: G.turn || 0
      });
      // 扣地方公库钱（若公库不足则部分扣）
      if (div.publicTreasury && div.publicTreasury.money) {
        var cost = Math.max(0, Math.round(la.amount||0));
        div.publicTreasury.money.stock = Math.max(0, (div.publicTreasury.money.stock||0) - cost);
        if (div.publicTreasury.money.stock === 0 && cost > 0) {
          div.publicTreasury.money.deficit = (div.publicTreasury.money.deficit||0) + (cost - (div.publicTreasury.money.stock||0));
        }
      }
      // illicit 进主官私产
      if (la.type === 'illicit' && div.governor) {
        var ch = G.chars ? G.chars.find(function(c){return c.name===div.governor;}) : null;
        if (ch) {
          if (!ch.resources) ch.resources = {};
          if (!ch.resources.privateWealth) ch.resources.privateWealth = { money:0, grain:0, cloth:0 };
          ch.resources.privateWealth.money = (ch.resources.privateWealth.money||0) + Math.round((la.amount||0) * 0.6);
        }
      }
      if (global.addEB) global.addEB('地方', (div.name||la.region) + '·' + (div.governor||'地方官') + ' ' + la.type + ' ' + (la.amount||0) + (la.reason?' (' + la.reason + ')':''));
      G._turnReport.push({ type:'localAction', region:la.region, actionType:la.type, amount:la.amount, reason:la.reason, turn:G.turn||0 });

      // ── 地方官治理 → 风闻录事 + 主官记忆 ───────────────────
      var _laTypeLbl = {
        disaster_relief:'赈灾', public_works_water:'修水利', public_works_road:'修路',
        education:'兴学', granary_stockpile:'平籴备荒', military_prep:'备边',
        charity_local:'恤民', illicit:'中饱私囊',
        supernatural_disaster_relief:'禳灾'
      }[la.type] || la.type;
      var _laGov = la.proposer || div.governor || '地方官';
      var _isIllicit = (la.type === 'illicit');
      if (global.PhaseD && global.PhaseD.addFengwen) {
        try {
          global.PhaseD.addFengwen({
            type: _isIllicit ? '告状' : '耳报',
            text: (div.name||la.region) + '·' + _laGov + ' ' + _laTypeLbl + (la.amount?' '+la.amount+'贯':'') + (la.reason?'（' + la.reason.slice(0,40) + '）':'') + (_isIllicit?'【疑有侵贪】':''),
            credibility: _isIllicit ? 0.4 : 0.8,
            source: 'localAction',
            actors: [_laGov],
            region: la.region,
            actionType: la.type,
            turn: G.turn||0
          });
        } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ai-change-applier');}catch(_){}}
      }
      if (global.NpcMemorySystem && _laGov && _laGov !== '地方官') {
        var _emo = _isIllicit ? '愧' : (la.type === 'disaster_relief' || la.type === 'charity_local' ? '喜' : '平');
        var _wt = _isIllicit ? 6 : 3;
        try {
          global.NpcMemorySystem.remember(_laGov, '我在 ' + (div.name||la.region) + ' 行 ' + _laTypeLbl + '（' + (la.amount||0) + '）——' + (la.reason||'').slice(0,30), _emo, _wt);
        } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ai-change-applier');}catch(_){}}
      }
      // 地方官名望/贤能涨跌
      try {
        var _govCh = (global.GM.chars || []).find(function(c){return c.name===_laGov;});
        if (_govCh && global.CharEconEngine) {
          var _fameDelta = {
            disaster_relief: +4, public_works_water: +2, public_works_road: +1, education: +2,
            granary_stockpile: +1, military_prep: +1, charity_local: +3,
            supernatural_disaster_relief: +1, illicit: -6
          }[la.type] || 0;
          var _virDelta = {
            disaster_relief: +6, public_works_water: +3, public_works_road: +2, education: +4,
            granary_stockpile: +2, military_prep: +1, charity_local: +4,
            supernatural_disaster_relief: +1, illicit: -8
          }[la.type] || 0;
          if (_fameDelta) global.CharEconEngine.adjustFame(_govCh, _fameDelta, _laTypeLbl);
          if (_virDelta) global.CharEconEngine.adjustVirtueMerit(_govCh, _virDelta, _laTypeLbl);
        }
      } catch(_lafve){ if(window.TM&&TM.errors) TM.errors.capture(_lafve,'applier.localActions.fame'); }
    });

    // 5. 事件（风闻）
    (aiOutput.events || []).forEach(function(e) {
      if (global.addEB) global.addEB(e.category || '事', e.text || '', { credibility: e.credibility || 'medium' });
      applied.events++;
      G._turnReport.push({ type:'event', category:e.category, text:e.text, turn:G.turn||0 });
    });

    // 6. NPC 行动 ——【已废弃】
    // 现有 tm-endturn.js 的 p1.npc_interactions + _dispatchNpcActionToPlayer
    // 已负责 奏疏/问对/鸿雁/起居注/风闻 全部路由。此处不再重复处理，
    // 避免 AI 产两套字段造成混乱。若 aiOutput.npc_actions 误存在，仅作日志。
    if (Array.isArray(aiOutput.npc_actions) && aiOutput.npc_actions.length > 0) {
      console.warn('[ai-applier] npc_actions 已废弃，请使用 p1.npc_interactions schema（见 tm-endturn.js _dispatchNpcActionToPlayer）。本次忽略 ' + aiOutput.npc_actions.length + ' 条。');
    }

    // 7. NPC 关系变化
    (aiOutput.relations || []).forEach(function(r) {
      if (typeof global.applyNpcInteraction === 'function' && r.actor && r.target && r.type) {
        global.applyNpcInteraction(r.actor, r.target, r.type, r.extra);
        applied.relations++;
        G._turnReport.push({ type:'relation', actor:r.actor, target:r.target, interaction:r.type, turn:G.turn||0 });
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // v2·AI 至高权力扩展通道（全域语义化快捷+兜底 anyPathChanges）
    // ═══════════════════════════════════════════════════════════════════
    if (!applied.semantic) applied.semantic = {};

    // ── 8. char_updates：角色任意字段修改+仕途条目+走位 ──
    // schema: [{ name, updates:{...任意字段...}, careerEvent:{title,date,summary,...}, travelTo:{toLocation,estimatedDays,reason} }]
    var charUpdCount = 0;
    (aiOutput.char_updates || []).forEach(function(cu) {
      if (!cu || !cu.name) return;
      var ch = _findEntity(G, 'char', cu.name);
      if (!ch) { applied.failed.push({char_update: cu, reason: 'char not found'}); return; }
      // updates：任意字段
      if (cu.updates) charUpdCount += _mergeUpdatesToEntity(ch, cu.updates, 'char_update', ch.name);
      // careerEvent：仕途条目追加
      if (cu.careerEvent) {
        if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
        ch.careerHistory.push(Object.assign({ turn: G.turn||0, date: (typeof getTSText==='function'?getTSText(G.turn):'T'+(G.turn||0)) }, cu.careerEvent));
        charUpdCount++;
        G._turnReport.push({ type:'career', char: ch.name, event: cu.careerEvent.summary || cu.careerEvent.title, turn:G.turn||0 });
      }
      // travelTo：启动走位
      if (cu.travelTo && cu.travelTo.toLocation) {
        var days = cu.travelTo.estimatedDays || _estimateTravelDays(ch.location, cu.travelTo.toLocation);
        ch._travelTo = cu.travelTo.toLocation;
        ch._travelFrom = ch.location || '';
        ch._travelStartTurn = G.turn || 0;
        ch._travelRemainingDays = days;
        ch._travelReason = cu.travelTo.reason || '';
        ch._travelAssignPost = cu.travelTo.assignPost || '';
        charUpdCount++;
        G._turnReport.push({ type:'travel', char: ch.name, from:ch._travelFrom, to:ch._travelTo, days:days, reason:ch._travelReason, turn:G.turn||0 });
        if (typeof global.addEB === 'function') global.addEB('\u4EBA\u4E8B', ch.name + ' \u8D74 ' + ch._travelTo + '\uFF08\u9884\u8BA1 ' + days + ' \u65E5\uFF09');
        if (G.qijuHistory) {
          var _dt0 = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));
          G.qijuHistory.unshift({
            turn: G.turn || 0,
            date: _dt0,
            content: '\u3010\u542F\u7A0B\u3011' + ch.name + ' \u81EA' + (ch._travelFrom || '\u672C\u5904') + ' \u8D74 ' + ch._travelTo + '\uFF0C\u9884\u8BA1 ' + days + ' \u65E5\u62B5\u8FBE' + (ch._travelReason ? '\u3002\u7F18\u7531\uFF1A' + ch._travelReason : '') + '\u3002'
          });
        }
        // ★ 编年·启程条
        if (!Array.isArray(G._chronicle)) G._chronicle = [];
        G._chronicle.unshift({
          turn: G.turn || 0,
          date: (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0)),
          type: '\u542F\u7A0B',
          title: ch.name + ' \u8D74 ' + ch._travelTo,
          content: ch.name + ' \u81EA' + (ch._travelFrom || '\u672C\u5904') + ' \u542F\u7A0B\u8D74 ' + ch._travelTo + '\u00B7\u9884\u8BA1 ' + days + ' \u65E5\u62B5\u8FBE' + (ch._travelReason ? '\u00B7' + ch._travelReason : '') + '\u3002',
          category: '\u4EBA\u4E8B', tags: ['人事', '启程', ch.name]
        });
      }
    });
    if (charUpdCount > 0) applied.semantic.char_updates = charUpdCount;

    // ── 9. office_assignments：任命含走位 ──
    // schema: [{ name, post, dept, action:'appoint|dismiss|transfer', fromLocation, toLocation, estimatedDays, reason }]
    var officeCount = 0;
    (aiOutput.office_assignments || []).forEach(function(oa) {
      if (!oa || !oa.name) return;
      var ch = _findEntity(G, 'char', oa.name);
      if (!ch) { applied.failed.push({office_assignment: oa, reason: 'char not found'}); return; }
      var action = oa.action || 'appoint';
      // 是否需要先走位（任命/调任至他处皆走位）
      var needTravel = oa.toLocation && ch.location && oa.toLocation !== ch.location;
      if (needTravel && (action === 'appoint' || action === 'transfer')) {
        // 启动走位·到达后再就任（由 travel tick 完成）
        var days = oa.estimatedDays || _estimateTravelDays(ch.location, oa.toLocation);
        ch._travelTo = oa.toLocation;
        ch._travelFrom = ch.location;
        ch._travelStartTurn = G.turn || 0;
        ch._travelRemainingDays = days;
        ch._travelReason = (oa.reason || '') + '·赴任';
        ch._travelAssignPost = (oa.dept ? oa.dept + '/' : '') + (oa.post || '');
        G._turnReport.push({ type:'travel', char: ch.name, from:ch._travelFrom, to:ch._travelTo, days:days, reason:ch._travelReason, turn:G.turn||0 });
        if (typeof global.addEB === 'function') global.addEB('\u4EFB\u547D', ch.name + ' \u8D74 ' + oa.toLocation + ' \u4EFB ' + (oa.post||'') + '\uFF08\u9884\u8BA1 ' + days + ' \u65E5\u5230\u4EFB\uFF09');
        if (G.qijuHistory) {
          var _dt1 = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));
          G.qijuHistory.unshift({
            turn: G.turn || 0,
            date: _dt1,
            content: '\u3010\u8D74\u4EFB\u3011' + ch.name + ' \u81EA' + (ch._travelFrom || '\u672C\u5904') + ' \u8D74 ' + oa.toLocation + '\uFF0C\u5F85\u5230\u5373\u5C31 ' + (oa.post || '') + '\u4E4B\u4EFB\uFF0C\u9884\u8BA1 ' + days + ' \u65E5\u3002'
          });
        }
        // ★ 编年·赴任启程条
        if (!Array.isArray(G._chronicle)) G._chronicle = [];
        G._chronicle.unshift({
          turn: G.turn || 0,
          date: (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0)),
          type: '\u8D74\u4EFB\u542F\u7A0B',
          title: ch.name + ' \u8D74 ' + oa.toLocation,
          content: ch.name + ' \u81EA' + (ch._travelFrom || '\u672C\u5904') + ' \u542F\u7A0B\u8D74 ' + oa.toLocation + '\u00B7\u5F85\u5230\u5373\u5C31 ' + (oa.post || '') + '\u4E4B\u4EFB\u00B7\u9884\u8BA1 ' + days + ' \u65E5\u3002',
          category: '\u4EBA\u4E8B', tags: ['人事', '赴任', '启程', ch.name]
        });
      } else {
        // 无需走位·直接就任·沿用原 onAppointment
        // 若 post 为复合名（如"中书侍郎、同平章事"）拆分多个分别任命
        var r = null;
        var posList = [oa.post];
        if (typeof oa.post === 'string' && /[、,·\s]/.test(oa.post)) {
          posList = oa.post.split(/[、,·\s]+/).filter(function(s){return s&&s.trim();});
        }
        posList.forEach(function(singlePost, idx) {
          var rr;
          if (action === 'appoint') rr = onAppointment(oa.name, singlePost, { dept: oa.dept });
          else if (action === 'dismiss') rr = onDismissal(oa.name, oa.reason);
          else if (action === 'transfer') rr = onTransfer(oa.name, oa.fromPost, singlePost, { dept: oa.dept });
          if (rr && rr.ok) {
            if (idx === 0) r = rr;
            officeCount++;
            G._turnReport.push({ type:'appointment', action: action, charName: oa.name, position: singlePost, turn:G.turn||0 });
            if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
            ch.careerHistory.push({
              turn: G.turn||0,
              date: (typeof getTSText==='function'?getTSText(G.turn):'T'+(G.turn||0)),
              title: singlePost,
              dept: oa.dept,
              action: action,
              reason: oa.reason || ''
            });
          }
        });
      }
      officeCount++;
    });
    if (officeCount > 0) applied.semantic.office_assignments = officeCount;

    // ── 9.5. personnel_changes 兜底 —— AI 常只写展示用的 personnel_changes，没写 office_assignments ──
    // schema: [{ name, former, change, reason }]；change 里含动词（任/拜/授/擢/为/命…为…/免/罢/贬/黜/斩/诛）
    // 已由 office_assignments 处理过的 name 不重复执行
    var handledNames = {};
    (aiOutput.office_assignments || []).forEach(function(oa){ if (oa && oa.name) handledNames[oa.name] = true; });
    var personnelFromPcCount = 0;
    (aiOutput.personnel_changes || []).forEach(function(pc){
      if (!pc || !pc.name) return;
      if (handledNames[pc.name]) return;
      var changeText = String(pc.change || '').trim();
      if (!changeText) return;
      // 动作识别
      var action = null, post = '', reason = pc.reason || changeText;
      // 免/罢/贬/黜/斩/诛/免职/罢官/致仕
      // \u4E0B\u72F1/\u5165\u72F1/\u7CFB\u72F1/\u6349\u62FF/\u902E\u6355 -> imprison
      if (/\u4E0B\u72F1|\u5165\u72F1|\u7CFB\u72F1|\u6349\u62FF|\u902E\u6355|\u6293\u6355|\u7F09\u62FF/.test(changeText)) {
        action = 'dismiss'; reason = changeText;
      // \u62C4\u5BB6/\u62C4\u6CA1/\u7C4D\u6CA1/\u67E5\u62C4/\u6CA1\u5B98 -> confiscate
      } else if (/\u62C4\u5BB6|\u62C4\u6CA1|\u7C4D\u6CA1|\u67E5\u62C4|\u6CA1\u5B98/.test(changeText)) {
        action = 'dismiss'; reason = changeText;
      // \u6D41\u653E/\u53D1\u914D/\u620D\u8FB9 -> exile
      } else if (/\u6D41\u653E|\u53D1\u914D|\u620D\u8FB9/.test(changeText)) {
        action = 'dismiss'; reason = changeText;
      } else if (/(\u514D\u804C|\u7F62\u5B98|\u7F62\u514D|\u7F62|\u514D|\u8D2C|\u9EDC|\u81F4\u4ED5|\u9000\u4F11|\u9A7B)/.test(changeText)) {
        action = 'dismiss';
      } else if (/(\u65A9|\u8BDB|\u66B4\u6BD9|\u8D50\u6B7B|\u6B3B|\u8BDB\u6740|\u8BDB\u4E5D\u65CF|\u62C4\u5BB6)/.test(changeText)) {
        action = 'dismiss'; reason = 'execute';
      } else {
        // 任命类：拜/授/擢/迁/转/命X为Y/升/进
        var m;
        // 命…为 XX / 拜 XX / 授 XX / 擢 XX / 为 XX
        if ((m = changeText.match(/(?:\u547D|\u4EE4|\u62DC|\u6388|\u6412|\u8FC1|\u8F6C|\u8FC1\u8F6C|\u8FDB|\u5347|\u4E3A|\u4EFB)\s*([^\s，,。.；;]+)/))) {
          post = m[1].replace(/^(\u4E3A|\u4EFB)/, '');
        }
        if (!post && pc.former && changeText.indexOf(pc.former) < 0) {
          // 若 former 有职，change 里是新职
          post = changeText.replace(/^(?:\u4ECE|\u81EA)?.*(?:\u8FC1|\u6539|\u8F6C)\s*/, '').replace(/[\s，,。.；;].*$/, '');
        }
        if (post) action = 'appoint';
      }
      if (!action) return;
      var r = null;
      if (action === 'appoint' && post) r = onAppointment(pc.name, post, null);
      else if (action === 'dismiss') r = onDismissal(pc.name, reason);
      if (r && r.ok) {
        personnelFromPcCount++;
        handledNames[pc.name] = true;
        if (action === 'appoint') {
          // 仕途追加
          var chP = _findEntity(G, 'char', pc.name);
          if (chP) {
            if (!Array.isArray(chP.careerHistory)) chP.careerHistory = [];
            chP.careerHistory.push({
              turn: G.turn || 0,
              date: (typeof getTSText==='function'?getTSText(G.turn):'T'+(G.turn||0)),
              title: post,
              action: 'appoint',
              reason: pc.reason || changeText,
              source: 'personnel_changes'  // 标记来源·便于调试
            });
          }
          G._turnReport.push({ type:'appointment', action: 'appoint', charName: pc.name, position: post, source:'pc_fallback', turn:G.turn||0 });
        } else {
          G._turnReport.push({ type:'appointment', action: 'dismiss', charName: pc.name, source:'pc_fallback', turn:G.turn||0 });
        }
      }
    });
    if (personnelFromPcCount > 0) applied.semantic.personnel_changes_fallback = personnelFromPcCount;

    // ── 10. fiscal_adjustments：岁入岁出动态增删 + **立即作用于余额** ──
    // schema: [{ target:'guoku|neitang|province:X', kind:'income|expense', resource?:'money|grain|cloth', category, name, amount, reason, recurring:bool, stopAfterTurn }]
    var fiscalCount = 0;
    (aiOutput.fiscal_adjustments || []).forEach(function(fa) {
      if (!fa || !fa.target || !fa.kind) return;
      var amount = Math.abs(parseFloat(fa.amount) || 0);
      if (amount <= 0) return;
      var resource = (fa.resource === 'grain' || fa.resource === 'cloth') ? fa.resource : 'money';
      var entry = {
        id: 'fa_' + (G.turn||0) + '_' + Math.random().toString(36).slice(2,6),
        name: fa.name || '',
        category: fa.category || '',
        resource: resource,
        amount: amount,
        reason: fa.reason || '',
        recurring: !!fa.recurring,
        addedTurn: G.turn || 0,
        stopAfterTurn: fa.stopAfterTurn || null
      };
      // 确定目标容器
      var target = null, containerKey = null, immediateTarget = null;
      if (fa.target === 'guoku') {
        if (!G.guoku) G.guoku = {};
        if (!G.guoku.extraIncome) G.guoku.extraIncome = [];
        if (!G.guoku.extraExpense) G.guoku.extraExpense = [];
        target = G.guoku;
        containerKey = (fa.kind === 'income') ? 'extraIncome' : 'extraExpense';
        immediateTarget = G.guoku;
      } else if (fa.target === 'neitang') {
        if (!G.neitang) G.neitang = {};
        if (!G.neitang.extraIncome) G.neitang.extraIncome = [];
        if (!G.neitang.extraExpense) G.neitang.extraExpense = [];
        target = G.neitang;
        containerKey = (fa.kind === 'income') ? 'extraIncome' : 'extraExpense';
        immediateTarget = G.neitang;
      } else if (/^province:/.test(fa.target)) {
        var provName = fa.target.replace(/^province:/, '');
        var div = _findDivisionByNameOrId(G, provName);
        if (div) {
          if (!div.extraFiscal) div.extraFiscal = { income: [], expense: [] };
          target = div.extraFiscal;
          containerKey = (fa.kind === 'income') ? 'income' : 'expense';
          immediateTarget = div;
        }
      }
      if (target && containerKey) {
        target[containerKey].push(entry);
        fiscalCount++;
        // ★ 立即作用于余额：支出不得突破 0（主动行为最多拨完库存）
        //   被动结算（CascadeTax/FixedExpense）已在 fiscal_adjustments 之前运行
        //   · 若此时 cur <= 0（被动结算后已赤字）→ 主动支出完全失败，amount=0/shortfall=requested
        //   · 若 0 < cur < amount → 拨到见底（库→0），剩余记亏欠，决策部分执行
        //   · 若 cur >= amount → 足额拨付，无亏欠
        var actualApplied = amount;
        var shortfall = 0;
        var executionStatus = 'completed';  // completed / partial / blocked
        if (immediateTarget) {
          var cur = Number(immediateTarget[resource]) || 0;
          if (fa.kind === 'expense') {
            if (cur <= 0) {
              // 库已空或赤字 → 主动支出彻底无法执行
              actualApplied = 0;
              shortfall = amount;
              executionStatus = 'blocked';
              // 余额不动
            } else if (cur < amount) {
              // 仅够一部分 → 拨到见底
              actualApplied = cur;
              shortfall = amount - cur;
              executionStatus = 'partial';
              immediateTarget[resource] = 0;
              if (immediateTarget.ledgers && immediateTarget.ledgers[resource]) {
                immediateTarget.ledgers[resource].stock = 0;
              }
            } else {
              // 足额
              actualApplied = amount;
              shortfall = 0;
              executionStatus = 'completed';
              immediateTarget[resource] = cur - amount;
              if (immediateTarget.ledgers && immediateTarget.ledgers[resource]) {
                var _led = immediateTarget.ledgers[resource];
                _led.stock = (Number(_led.stock)||0) - amount;
              }
            }
          } else {
            // 收入：直接加（若原为负·可抹平债务）
            immediateTarget[resource] = cur + amount;
            if (immediateTarget.ledgers && immediateTarget.ledgers[resource]) {
              var ledI = immediateTarget.ledgers[resource];
              ledI.stock = (Number(ledI.stock)||0) + amount;
            }
          }
          if (immediateTarget === G.guoku && resource === 'money') immediateTarget.balance = immediateTarget.money;
        }
        // 条目标记实际应用量+亏欠量+执行状态
        entry.applied = actualApplied;
        entry.shortfall = shortfall;
        entry.executionStatus = executionStatus;
        // turnReport：记 actual + shortfall + status（渲染器区别对待）
        G._turnReport.push({ type:'fiscal_adj', target: fa.target, kind: fa.kind, resource: resource, name: entry.name, amount: actualApplied, requested: amount, shortfall: shortfall, executionStatus: executionStatus, reason: entry.reason, turn: G.turn||0 });
        // 亏欠单独登记——供下回合 AI 推演、史记、风闻录事参考
        if (shortfall > 0) {
          if (!G._fiscalShortfalls) G._fiscalShortfalls = [];
          G._fiscalShortfalls.push({
            turn: G.turn || 0,
            target: fa.target, resource: resource,
            name: entry.name, reason: entry.reason,
            requested: amount, applied: actualApplied, shortfall: shortfall,
            executionStatus: executionStatus,
            resolved: false
          });
        }
        var _resLbl = resource === 'grain' ? '粮' : resource === 'cloth' ? '布' : '银';
        var _tgtLbl = fa.target === 'guoku' ? '帑廪' : fa.target === 'neitang' ? '内帑' : fa.target;
        if (typeof global.addEB === 'function') {
          if (executionStatus === 'blocked') {
            global.addEB('\u8D22\u653F\u2757\u2757', _tgtLbl + '\u8D4C\u7A7A\u2014\u300C' + (fa.name||'') + '\u300D\u65E0\u6CD5\u6267\u884C\uFF01\u8BF7' + amount + _resLbl + '\u00B7\u4E00\u6587\u672A\u62E8');
          } else if (executionStatus === 'partial') {
            global.addEB('\u8D22\u653F\u2757', _tgtLbl + '\u4E0D\u8DB3\uFF01' + (fa.name||'') + '\u8BF7' + amount + _resLbl + '\uFF0C\u4EC5\u62E8' + actualApplied + '\uFF0C\u4E8F' + shortfall);
          } else {
            global.addEB('\u8D22\u653F', _tgtLbl + (fa.kind==='income'?'\u5165':'\u51FA') + _resLbl + ' ' + actualApplied + (fa.name?'\uFF08'+fa.name+'\uFF09':'') + (fa.recurring?'\u00B7\u6052\u5E74':''));
          }
        }
      }
    });
    if (fiscalCount > 0) applied.semantic.fiscal_adjustments = fiscalCount;

    // ── 11. faction_updates ──
    var facCount = 0;
    (aiOutput.faction_updates || []).forEach(function(fu) {
      if (!fu || !fu.name) return;
      var fac = _findEntity(G, 'faction', fu.name);
      if (!fac) { applied.failed.push({faction_update: fu, reason: 'faction not found'}); return; }
      if (fu.updates) facCount += _mergeUpdatesToEntity(fac, fu.updates, 'faction_update', fac.name);
    });
    if (facCount > 0) applied.semantic.faction_updates = facCount;

    // ── 12. party_updates ──
    var partyCount = 0;
    (aiOutput.party_updates || []).forEach(function(pu) {
      if (!pu || !pu.name) return;
      var party = _findEntity(G, 'party', pu.name);
      if (!party) { applied.failed.push({party_update: pu, reason: 'party not found'}); return; }
      if (pu.updates) partyCount += _mergeUpdatesToEntity(party, pu.updates, 'party_update', party.name);
    });
    if (partyCount > 0) applied.semantic.party_updates = partyCount;

    // ── 13. class_updates ──
    var classCount = 0;
    (aiOutput.class_updates || []).forEach(function(cu) {
      if (!cu || !cu.name) return;
      var cls = _findEntity(G, 'class', cu.name);
      if (!cls) { applied.failed.push({class_update: cu, reason: 'class not found'}); return; }
      if (cu.updates) classCount += _mergeUpdatesToEntity(cls, cu.updates, 'class_update', cls.name);
    });
    if (classCount > 0) applied.semantic.class_updates = classCount;

    // ── 14. region_updates ──
    var regionCount = 0;
    (aiOutput.region_updates || []).forEach(function(ru) {
      if (!ru) return;
      var identifier = ru.id || ru.name;
      if (!identifier) return;
      var div = _findDivisionByNameOrId(G, identifier);
      if (!div) { applied.failed.push({region_update: ru, reason: 'region not found'}); return; }
      if (ru.updates) regionCount += _mergeUpdatesToEntity(div, ru.updates, 'region_update', div.name || div.id);
    });
    if (regionCount > 0) applied.semantic.region_updates = regionCount;

    // ── 15. project_updates：长期工程/商队/学堂/道路等 ──
    // schema: [{ name, type:'工程|商队|学堂|道路|etc', status:'planning|active|completed|abandoned', cost, progress, leader, region, startTurn, endTurn, description }]
    var projectCount = 0;
    if (!G.activeProjects) G.activeProjects = [];
    (aiOutput.project_updates || []).forEach(function(pu) {
      if (!pu || !pu.name) return;
      var existing = G.activeProjects.find(function(p){ return p.name === pu.name; });
      if (existing) {
        Object.keys(pu).forEach(function(k){
          if (/^_/.test(k)) return;
          existing[k] = pu[k];
        });
        existing._lastUpdated = G.turn || 0;
      } else {
        G.activeProjects.push(Object.assign({
          id: 'proj_' + (G.turn||0) + '_' + Math.random().toString(36).slice(2,6),
          startTurn: G.turn || 0,
          status: 'active'
        }, pu));
      }
      projectCount++;
      G._turnReport.push({ type:'project', name: pu.name, projectType: pu.type, status: pu.status, turn: G.turn||0 });
      if (typeof global.addEB === 'function') global.addEB('\u5DE5\u7A0B', pu.name + ' ' + (pu.status||'\u8FDB\u884C\u4E2D') + (pu.progress?' '+pu.progress+'%':''));
    });
    if (projectCount > 0) applied.semantic.project_updates = projectCount;

    // ── 16. anyPathChanges：兜底·AI 可用任意路径改任意字段（除禁区） ──
    // schema: [{ path, op:'set|push|delta|merge|delete', value, reason }]
    var anyPathCount = 0;
    (aiOutput.anyPathChanges || []).forEach(function(apc) {
      if (!apc || !apc.path) return;
      if (_isPathBlocked(apc.path)) {
        applied.failed.push({ anyPath: apc.path, reason: 'blocked' });
        return;
      }
      var result;
      if (apc.op === 'push') result = _applyPathPush(G, apc.path, apc.value);
      else if (apc.op === 'delta') result = _applyPathDelta(G, apc.path, parseFloat(apc.value)||0, apc.reason);
      else if (apc.op === 'delete') {
        try {
          var parts = apc.path.split('.');
          var parent = G;
          for (var i=0; i<parts.length-1; i++) parent = parent && parent[parts[i]];
          if (parent && parts.length) {
            var last = parts[parts.length-1];
            delete parent[last];
            result = { ok: true, old: null, new: undefined };
          }
        } catch(e) { result = { ok:false, reason:'delete failed' }; }
      } else {
        result = _applyPathSet(G, apc.path, apc.value, apc.reason);
      }
      if (result && result.ok) {
        anyPathCount++;
        G._turnReport.push({ type:'anyPath', path: apc.path, op: apc.op||'set', old: result.old, new: result.new, reason: apc.reason, turn: G.turn||0 });
      } else {
        applied.failed.push({ anyPath: apc.path, reason: result && result.reason });
      }
    });
    if (anyPathCount > 0) applied.semantic.anyPathChanges = anyPathCount;

    // ── 12. 赤字惩罚 engine：帑廪/内帑 任一项 < 0 → 按深度施以严惩 ──
    try { _applyFiscalDeficitPenalties(G); } catch(_dfE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dfE, 'applier] deficit penalty:') : console.warn('[applier] deficit penalty:', _dfE); }

    // ── 13. 问天 directive 合规回报 ──
    // schema: directive_compliance:[{id,status:'followed|partial|ignored',reason,evidence}]
    try { _applyDirectiveCompliance(G, aiOutput); } catch(_dcE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dcE, 'applier] directive compliance:') : console.warn('[applier] directive compliance:', _dcE); }

    // ── 14. 财务一致性校验：扫描叙事中的金额 vs fiscal_adjustments 总量 ──
    try { _validateFiscalConsistency(G, aiOutput, applied); } catch(_fvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fvE, 'applier] fiscal validator:') : console.warn('[applier] fiscal validator:', _fvE); }

    // ── 14a. 人事一致性校验·扫描叙事中『某某下狱/赐死/抄家/流放』vs 结构化数据 ──
    try { _validatePersonnelConsistency(G, aiOutput, applied); } catch(_pvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_pvE, 'applier] personnel validator:') : console.warn('[applier] personnel validator:', _pvE); }

    // ── 14b. 军事一致性校验·扫描『扩军/裁汰 N 万』vs GM.armies 真实变化 ──
    try { _validateMilitaryConsistency(G, aiOutput, applied); } catch(_mvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_mvE, 'applier] military validator:') : console.warn('[applier] military validator:', _mvE); }

    // ── 14c. 民心/皇威一致性校验·扫描『民心大振/民怨沸腾/朝野失望』vs turnChanges ──
    try { _validateSentimentConsistency(G, aiOutput, applied); } catch(_svE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_svE, 'applier] sentiment validator:') : console.warn('[applier] sentiment validator:', _svE); }

    // ── 14d. 户口一致性校验·扫描『饥荒死 N/逃户 M/迁徙 X』vs GM.population ──
    try { _validatePopulationConsistency(G, aiOutput, applied); } catch(_uvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_uvE, 'applier] population validator:') : console.warn('[applier] population validator:', _uvE); }

    // ── 14e. 官职任免一致性校验·扫描『拜 X 为 Y/擢 X 为 Y/迁』vs office_assignments ──
    try { _validateOfficeConsistency(G, aiOutput, applied); } catch(_ovE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ovE, 'applier] office validator:') : console.warn('[applier] office validator:', _ovE); }

    // ── 14f-1. 战争一致性校验·扫描『起兵/北伐/议和/陷落』vs GM.activeWars ──
    try { _validateWarConsistency(G, aiOutput, applied); } catch(_wvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_wvE, 'applier] war validator:') : console.warn('[applier] war validator:', _wvE); }

    // ── 14f-2. 民变一致性校验·扫描『起事/聚众/平定/招抚』vs GM.minxin.revolts ──
    try { _validateRevoltConsistency(G, aiOutput, applied); } catch(_rvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rvE, 'applier] revolt validator:') : console.warn('[applier] revolt validator:', _rvE); }

    // ── 14f-3. 天灾一致性校验·扫描『大旱/洪/蝗/瘟疫/地震』vs GM.activeDisasters ──
    try { _validateDisasterConsistency(G, aiOutput, applied); } catch(_dvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dvE, 'applier] disaster validator:') : console.warn('[applier] disaster validator:', _dvE); }

    // ── 14f-4. 外交一致性校验·扫『通使/朝贡/绝交/羁縻』 vs GM.facs[].relations ──
    try { _validateDiplomacyConsistency(G, aiOutput, applied); } catch(_diE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_diE, 'applier] diplomacy validator:') : console.warn('[applier] diplomacy validator:', _diE); }

    // ── 14f-5. 科举一致性校验·扫『开科/会试/殿试/放榜/赐进士』 vs P.keju ──
    try { _validateKejuConsistency(G, aiOutput, applied); } catch(_kjE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_kjE, 'applier] keju validator:') : console.warn('[applier] keju validator:', _kjE); }

    // ── 14f-6. 党派一致性校验·扫『结社/立党/解散/瓦解』 vs GM.parties ──
    try { _validatePartyConsistency(G, aiOutput, applied); } catch(_pyE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_pyE, 'applier] party validator:') : console.warn('[applier] party validator:', _pyE); }

    // ── 14f-7. 法令效力一致性校验·扫『颁诏/降旨/敕谕/废制』 vs GM.activeEdicts ──
    try { _validateEdictEffectConsistency(G, aiOutput, applied); } catch(_edE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_edE, 'applier] edictEffect validator:') : console.warn('[applier] edictEffect validator:', _edE); }

    // ── 14f-8. 朝廷礼仪一致性校验·扫『迁都/晋爵/谥/册立/废后』 vs char_updates 内 title/posthumous/spouse ──
    try { _validateCourtCeremonyConsistency(G, aiOutput, applied); } catch(_ccE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ccE, 'applier] courtCeremony validator:') : console.warn('[applier] courtCeremony validator:', _ccE); }

    // ── 14f-9. 工程·物品·建筑一致性校验·扫『兴工/督造/烧毁/铸器』 vs changes 路径 ──
    try { _validateConstructionConsistency(G, aiOutput, applied); } catch(_csE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_csE, 'applier] construction validator:') : console.warn('[applier] construction validator:', _csE); }

    // ── 14f-10. 异象·谶语一致性校验·扫『彗见/日蚀/瑞兽/谶/谣』 vs GM.omens ──
    try { _validateOmenConsistency(G, aiOutput, applied); } catch(_omE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_omE, 'applier] omen validator:') : console.warn('[applier] omen validator:', _omE); }

    // ── 14f-11. 婚姻·生育·继承一致性校验·扫『嫁/娶/诞生/夭折/即位/承嗣』 ──
    try { _validateMarriageBirthConsistency(G, aiOutput, applied); } catch(_mbE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_mbE, 'applier] marriageBirth validator:') : console.warn('[applier] marriageBirth validator:', _mbE); }

    // ── 14f-12. 谋反·政变·弑君一致性校验·扫『谋反/弑君/宫变/篡位』 ──
    try { _validateConspiracyConsistency(G, aiOutput, applied); } catch(_cyE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_cyE, 'applier] conspiracy validator:') : console.warn('[applier] conspiracy validator:', _cyE); }

    // ── 14f-13. 货币·币值·银荒一致性校验·扫『银荒/钱荒/通胀/币改』 ──
    try { _validateCurrencyConsistency(G, aiOutput, applied); } catch(_cuE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_cuE, 'applier] currency validator:') : console.warn('[applier] currency validator:', _cuE); }

    // ── 14f-14. 宗教·教派一致性校验·扫『立教/灭佛/白莲/天主/邪教』 ──
    try { _validateReligionConsistency(G, aiOutput, applied); } catch(_rgE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rgE, 'applier] religion validator:') : console.warn('[applier] religion validator:', _rgE); }

    // ── 14g. 二次 AI 自审·若多个 validator 报警·调一次 AI 让其自查 narrative-vs-structured ──
    // 仅当本回合校验器累计补录 > 5 条时触发·避免每回合都额外烧 token
    try { _maybeReconcileWithAI(G, aiOutput, applied); } catch(_rvE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rvE, 'applier] ai reconcile:') : console.warn('[applier] ai reconcile:', _rvE); }

    // ── 15. 死亡墓志铭 & 诈死holding ──
    try { _processDeathEpitaphs(G, aiOutput); } catch(_deE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_deE, 'applier] death epitaph:') : console.warn('[applier] death epitaph:', _deE); }

    // ── 16. 财政三字段强制同步·防 money/balance/ledgers.stock 跑偏 ──
    // 多个引擎(applier/FixedExpense/AuthorityComplete/AuthorityEngines/Keju)各自写不同字段·此处兜底对齐
    try { if (typeof _syncFiscalScalars === 'function') _syncFiscalScalars(G); } catch(_syE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_syE, 'applier] fiscal sync:') : console.warn('[applier] fiscal sync:', _syE); }

    return { ok: true, applied: applied };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  财政三字段同步守卫·确保 GM.guoku/neitang 的 money/balance/ledgers.stock 三字段一致
  //  策略：以 ledgers.stock 为权威源（applier 内 fiscal_adjustments 同时更新它和 .money）·向后写 .money 和 .balance
  //  若 ledger 不存在则以 .money 为准·补全 .balance
  // ═══════════════════════════════════════════════════════════════════
  function _syncFiscalScalars(G) {
    if (!G) return;
    ['guoku', 'neitang'].forEach(function(target) {
      var t = G[target];
      if (!t) return;
      ['money','grain','cloth'].forEach(function(res) {
        var ledStock = (t.ledgers && t.ledgers[res] && typeof t.ledgers[res].stock === 'number') ? t.ledgers[res].stock : null;
        var scalar = (typeof t[res] === 'number') ? t[res] : null;
        // 取权威值：ledger 优先·否则 scalar·否则 0
        var canon = (ledStock != null) ? ledStock : (scalar != null ? scalar : 0);
        // 写回三处
        t[res] = canon;
        if (t.ledgers && t.ledgers[res]) t.ledgers[res].stock = canon;
        if (res === 'money') t.balance = canon;  // balance 仅对 money 有意义
      });
      // 若有 ledger 但 .money 与 stock 之前就不一致·留一条警告
      if (t.ledgers && t.ledgers.money && typeof t.ledgers.money.stock === 'number' && typeof t.money === 'number') {
        // 此时已对齐·不再需要警告
      }
    });
  }
  // 暴露给 window·让 endTurn / renderGameState 可调用兜底
  if (typeof window !== 'undefined') window._syncFiscalScalars = _syncFiscalScalars;

  // ═══════════════════════════════════════════════════════════════════
  //  财务一致性校验器
  //  扫描 shilu_text/shizhengji/events 中提及金额，比对 fiscal_adjustments 总量
  // ═══════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  //  人事一致性校验器·Wave 1a (2026-04-27)
  //  解决: AI narrative 提『某某下狱/赐死/抄家/流放』但不写 personnel_changes·数据不变
  //  做法: 扫所有 narrative 字段·用动词关键字 + 人名 regex 抓·与结构化数据对比·直接补调 onDismissal
  // ═══════════════════════════════════════════════════════════════════
  function _validatePersonnelConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrativeText = '';
    if (aiOutput.shilu_text) narrativeText += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji) narrativeText += String(aiOutput.shizhengji) + '\n';
    if (aiOutput.yupiHuiting) narrativeText += String(aiOutput.yupiHuiting) + '\n';
    if (aiOutput.qijuHistory) narrativeText += String(aiOutput.qijuHistory) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) narrativeText += String(e.desc) + '\n'; });
    }
    if (aiOutput.event && aiOutput.event.desc) narrativeText += String(aiOutput.event.desc) + '\n';
    // npc_actions 也扫
    if (Array.isArray(aiOutput.npc_actions)) {
      aiOutput.npc_actions.forEach(function(na){ if (na && na.desc) narrativeText += String(na.desc) + '\n'; });
    }
    if (!narrativeText) return;

    // 状态动词字典·区分 7 大动作类型
    var statusVerbs = {
      execute:    ['处决', '赐死', '诛戮', '凌迟', '腰斩', '弃市', '绞刑', '斩首', '诛九族'],
      imprison:   ['下狱', '入狱', '系狱', '收押', '关押', '捉拿下狱', '逮捕下狱', '锁拿'],
      arrest:     ['捉拿', '逮捕', '抓捕', '缉拿', '锁拿'],   // 不一定下狱·区分对待
      exile:      ['流放', '发配', '戍边', '充军', '远谪', '贬谪边远'],
      retire:     ['致仕', '乞骸骨', '归田', '退休', '告老'],
      flee:       ['潜逃', '远遁', '逃匿', '隐遁'],
      confiscate: ['抄家', '抄没', '籍没', '查抄', '没官'],
      dismiss:    ['革职', '罢官', '罢免', '降职贬黜', '罢相', '罢免']
    };

    // 收集所有人名(2-4字·过滤明显非人名)
    var allChars = (G.chars || []).filter(function(c){ return c && c.name && c.alive !== false; });
    var charNameSet = {};
    allChars.forEach(function(c){
      charNameSet[c.name] = c;
      // 也收去前缀的『字』『号』·如『字'国之'』
      if (c.zi) charNameSet[c.zi] = c;
    });

    // 扫 narrative·匹配 "<人名> + <动作>" 或 "<动作> + <人名>" 模式
    var mentioned = [];
    Object.keys(statusVerbs).forEach(function(action) {
      statusVerbs[action].forEach(function(verb) {
        // 正向: "X 下狱"
        var pat1 = new RegExp('([\\u4e00-\\u9fff]{2,4})\\s*' + verb, 'g');
        // 反向: "下狱 X" / "命...将 X 下狱"
        var pat2 = new RegExp(verb + '[^\\u4e00-\\u9fff]{0,5}([\\u4e00-\\u9fff]{2,4})', 'g');
        [pat1, pat2].forEach(function(pat) {
          var m;
          while ((m = pat.exec(narrativeText)) !== null) {
            var name = m[1];
            if (!charNameSet[name]) continue;
            // 去重·同人同 action 只记一次
            var key = name + '_' + action;
            if (mentioned.find(function(x){return x.key===key;})) continue;
            mentioned.push({ key: key, name: name, action: action, verb: verb, raw: m[0] });
          }
        });
      });
    });

    if (!mentioned.length) return;

    // 已在结构化数据中处理的人·跳过
    var handled = {};
    (aiOutput.personnel_changes || []).forEach(function(pc) {
      if (pc && pc.name) handled[pc.name] = true;
    });
    (aiOutput.office_assignments || []).forEach(function(oa) {
      if (oa && oa.name && (oa.action === 'dismiss' || oa.action === 'transfer')) handled[oa.name] = true;
    });
    (aiOutput.char_updates || []).forEach(function(cu) {
      if (cu && cu.name && cu.updates) {
        var u = cu.updates;
        if (u.alive === false || u._imprisoned || u._exiled || u._retired || u._fled) handled[cu.name] = true;
      }
    });

    var missing = mentioned.filter(function(m){ return !handled[m.name]; });
    if (!missing.length) return;

    // 直接补调 onDismissal·让其状态字段写入·不修改 aiOutput.personnel_changes(已处理过)
    var patched = 0;
    missing.forEach(function(m) {
      // 找该人物
      var ch = charNameSet[m.name];
      if (!ch) return;
      try {
        // 调 onDismissal·reason 用 verb 让函数内部 regex 命中状态分支
        var r = onDismissal(ch.name, m.verb);
        if (r && r.ok) {
          patched++;
          if (global.addEB) {
            global.addEB('校验补录', '人事校验器·' + ch.name + '『' + m.verb + '』补录入库(原文: ' + m.raw + ')');
          }
        }
      } catch(_e) {
        try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_e, 'personnel-validator'); } catch(__){}
      }
    });

    if (!G._personnelValidatorLog) G._personnelValidatorLog = [];
    G._personnelValidatorLog.push({ turn: G.turn || 0, missing: missing, patched: patched });
    if (G._personnelValidatorLog.length > 20) G._personnelValidatorLog = G._personnelValidatorLog.slice(-20);

    if (G._turnReport) {
      G._turnReport.push({ type: 'personnel_validation', missing: missing, patched: patched, turn: G.turn || 0 });
    }

    console.warn('[PersonnelValidator] 叙事提及但 AI 未填结构化的人物状态变化(已自动补录 ' + patched + '/' + missing.length + '):', missing);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  通用 helper: 从 narrative 抓所有文本·供各领域 validator 用
  // ═══════════════════════════════════════════════════════════════════
  function _getNarrativeText(aiOutput) {
    var t = '';
    if (!aiOutput) return t;
    if (aiOutput.shilu_text)   t += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji)   t += String(aiOutput.shizhengji) + '\n';
    if (aiOutput.yupiHuiting)  t += String(aiOutput.yupiHuiting) + '\n';
    if (aiOutput.qijuHistory)  t += String(aiOutput.qijuHistory) + '\n';
    if (aiOutput.event && aiOutput.event.desc) t += String(aiOutput.event.desc) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) t += String(e.desc) + '\n'; });
    }
    if (Array.isArray(aiOutput.npc_actions)) {
      aiOutput.npc_actions.forEach(function(na){ if (na && na.desc) t += String(na.desc) + '\n'; });
    }
    return t;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  军事一致性校验器·Wave 1b
  //  扫『扩军/募兵/裁汰 N 万兵』vs GM.armies / military_changes
  // ═══════════════════════════════════════════════════════════════════
  function _validateMilitaryConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    // 数字解析(中阿混合)
    function parseNum(s, mult) {
      var cnMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000,'万':10000};
      var n = parseFloat(s);
      if (isNaN(n) || n <= 0) {
        n = 0; var prev = 0;
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i);
          if (cnMap[ch] != null) {
            if (ch === '十' || ch === '百' || ch === '千' || ch === '万') prev = (prev || 1) * cnMap[ch];
            else prev = prev * 10 + cnMap[ch];
          }
        }
        n = prev;
      }
      if (mult === '万') n *= 10000;
      else if (mult === '千') n *= 1000;
      return n;
    }

    // 增兵动词 + 减兵动词
    var addVerbs = '招募|募兵|招兵|增兵|扩军|新建|添募|添兵|增编|拨补|增添';
    var cutVerbs = '裁汰|裁军|裁撤|遣散|罢遣|裁革|削减|裁减';
    var lossVerbs = '阵亡|战死|溃散|逃亡|染瘟|染瘴';
    function _scan(verbs, kind) {
      var pat = new RegExp('(' + verbs + ')[^。；,\\s]{0,8}?([\\d一二三四五六七八九十百千万]+)\\s*(万|千)?\\s*(兵|人|卒|马|骑|众|甲)', 'g');
      var arr = [], m;
      while ((m = pat.exec(narrative)) !== null) {
        var n = parseNum(m[2], m[3] || '');
        if (n < 100) continue;
        arr.push({ kind: kind, verb: m[1], num: n, raw: m[0] });
      }
      return arr;
    }
    var mentioned = [].concat(_scan(addVerbs, 'add'), _scan(cutVerbs, 'cut'), _scan(lossVerbs, 'loss'));
    if (!mentioned.length) return;

    // 与 military_changes / npc_actions 中军事行动对比·结构化数据中是否有同等量变
    var structuredTotal = { add: 0, cut: 0, loss: 0 };
    if (Array.isArray(aiOutput.military_changes)) {
      aiOutput.military_changes.forEach(function(mc) {
        if (!mc) return;
        var n = Math.abs(parseInt(mc.delta) || 0);
        if (mc.delta > 0) structuredTotal.add += n;
        else if (mc.delta < 0) structuredTotal.cut += n;
      });
    }

    var mentTotal = { add: 0, cut: 0, loss: 0 };
    mentioned.forEach(function(x) { mentTotal[x.kind] += x.num; });

    var warnings = [];
    ['add','cut','loss'].forEach(function(k) {
      if (mentTotal[k] <= 1000) return;  // 千以下噪声
      if (structuredTotal[k] < mentTotal[k] * 0.5) {
        warnings.push({ kind: k, mentioned: mentTotal[k], structured: structuredTotal[k], shortfall: mentTotal[k] - structuredTotal[k] });
      }
    });

    if (!warnings.length) return;

    if (!G._militaryValidatorLog) G._militaryValidatorLog = [];
    G._militaryValidatorLog.push({ turn: G.turn || 0, warnings: warnings, samples: mentioned.slice(0, 5) });
    if (G._militaryValidatorLog.length > 20) G._militaryValidatorLog = G._militaryValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'military_validation', warnings: warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
    console.warn('[MilitaryValidator] 叙事兵数与结构化 military_changes 偏差:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心/皇威/皇权一致性校验器·Wave 1b
  //  扫『民心大振/民怨沸腾/朝野失望/天下共愤』 vs turnChanges.variables 中民心/皇威/皇权 delta
  // ═══════════════════════════════════════════════════════════════════
  function _validateSentimentConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    // 极性词典: 正向情绪(应升民心/皇威) vs 负向(应降)
    var positiveKW = /民心大振|百姓欢悦|歌颂圣明|海内归心|朝野振奋|众心翕然|万民欣戴|四海升平|拥护|赞颂|拊掌|颂扬/g;
    var negativeKW = /民怨沸腾|怨声载道|朝野失望|天下共愤|举国震骇|民不聊生|流离失所|冤死狼藉|弃捐道路|哀鸿遍野|怨望|愤激|忿恚|骚然/g;
    var posCount = (narrative.match(positiveKW) || []).length;
    var negCount = (narrative.match(negativeKW) || []).length;
    if (posCount === 0 && negCount === 0) return;

    // 检查 turnChanges 是否含 民心/皇威/皇权 delta
    var sentDelta = 0;
    var tc = (G.turnChanges && G.turnChanges.variables) || [];
    tc.forEach(function(v) {
      if (!v || !v.name) return;
      if (/民心|皇威|皇权|声望|威信|拥戴/.test(v.name)) {
        sentDelta += (v.delta || (v.newValue||0) - (v.oldValue||0));
      }
    });

    var warnings = [];
    // 强正向但 sentDelta 不正 → 警告
    if (posCount >= 2 && sentDelta <= 0) {
      warnings.push({ kind: 'positive_no_uplift', posCount: posCount, sentDelta: sentDelta });
    }
    // 强负向但 sentDelta 不负 → 警告
    if (negCount >= 2 && sentDelta >= 0) {
      warnings.push({ kind: 'negative_no_drop', negCount: negCount, sentDelta: sentDelta });
    }

    if (!warnings.length) return;

    if (!G._sentimentValidatorLog) G._sentimentValidatorLog = [];
    G._sentimentValidatorLog.push({ turn: G.turn || 0, posCount: posCount, negCount: negCount, sentDelta: sentDelta, warnings: warnings });
    if (G._sentimentValidatorLog.length > 20) G._sentimentValidatorLog = G._sentimentValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'sentiment_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[SentimentValidator] 叙事情绪与变量变动不一致·posKW=' + posCount + '·negKW=' + negCount + '·sentDelta=' + sentDelta + ':', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口一致性校验器·Wave 1b
  //  扫『饥荒死 N/逃户 M/迁徙 X』 vs GM.population.* 实际变动
  // ═══════════════════════════════════════════════════════════════════
  function _validatePopulationConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    function _pn(s, mult) {
      var cnMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000,'万':10000};
      var n = parseFloat(s);
      if (isNaN(n) || n <= 0) {
        n = 0;
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i);
          if (cnMap[ch] != null) {
            if (ch === '十' || ch === '百' || ch === '千' || ch === '万') n = (n || 1) * cnMap[ch];
            else n = n * 10 + cnMap[ch];
          }
        }
      }
      if (mult === '万') n *= 10000;
      return n;
    }

    var deathVerbs = '饿死|冻死|疫死|战死|灾亡|溺死|染瘟|疫亡|流亡|罹难|罹疫';
    var fleeVerbs = '逃亡|逃难|流离|迁徙|迁移|流民';
    function _scan(verbs, kind) {
      var pat = new RegExp('(' + verbs + ')[^。；,\\s]{0,10}?([\\d一二三四五六七八九十百千万]+)\\s*(万|千)?\\s*(口|户|人|众)', 'g');
      var arr = [], m;
      while ((m = pat.exec(narrative)) !== null) {
        var n = _pn(m[2], m[3] || '');
        if (n < 100) continue;
        arr.push({ kind: kind, verb: m[1], num: n, raw: m[0] });
      }
      return arr;
    }
    var mentioned = [].concat(_scan(deathVerbs, 'death'), _scan(fleeVerbs, 'flee'));
    if (!mentioned.length) return;

    // 与 turnChanges.variables 中户口 delta 对比
    var popDelta = { death: 0, flee: 0 };
    var tc = (G.turnChanges && G.turnChanges.variables) || [];
    tc.forEach(function(v) {
      if (!v || !v.name) return;
      var d = (v.delta || (v.newValue||0) - (v.oldValue||0));
      if (/口|人口|mouths|总口|户籍|户口/.test(v.name)) {
        if (d < 0) popDelta.death += Math.abs(d);
      }
      if (/逃户|流民|fugitives/.test(v.name)) {
        if (d > 0) popDelta.flee += d;
      }
    });

    var mentTotal = { death: 0, flee: 0 };
    mentioned.forEach(function(x) { mentTotal[x.kind] += x.num; });

    var warnings = [];
    if (mentTotal.death > 1000 && popDelta.death < mentTotal.death * 0.3) {
      warnings.push({ kind: 'death', mentioned: mentTotal.death, structured: popDelta.death, shortfall: mentTotal.death - popDelta.death });
    }
    if (mentTotal.flee > 1000 && popDelta.flee < mentTotal.flee * 0.3) {
      warnings.push({ kind: 'flee', mentioned: mentTotal.flee, structured: popDelta.flee, shortfall: mentTotal.flee - popDelta.flee });
    }

    if (!warnings.length) return;

    if (!G._populationValidatorLog) G._populationValidatorLog = [];
    G._populationValidatorLog.push({ turn: G.turn || 0, warnings: warnings, samples: mentioned.slice(0, 5) });
    if (G._populationValidatorLog.length > 20) G._populationValidatorLog = G._populationValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'population_validation', warnings: warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
    console.warn('[PopulationValidator] 叙事人口变动与结构化偏差:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  官职任免一致性校验器·Wave 1b
  //  扫『拜 X 为 Y / 擢 X 为 Y / 迁 X 为 Y / 命 X 为 Y』vs office_assignments
  // ═══════════════════════════════════════════════════════════════════
  function _validateOfficeConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    var allChars = (G.chars || []).filter(function(c){return c && c.name && c.alive !== false;});
    var charNames = {};
    allChars.forEach(function(c){ charNames[c.name] = c; });

    // 任命动词 + 人名 + 为 + 官职
    var appointVerbs = '拜|擢|迁|转|命|授|任|升|进|起|起复|改任|擢任|超擢';
    // 模式 1: 动词 X 为/任 Y
    var pat = new RegExp('(' + appointVerbs + ')\\s*([\\u4e00-\\u9fff]{2,4})\\s*(?:为|任)\\s*([\\u4e00-\\u9fff]{2,12})', 'g');

    var mentioned = [];
    var m;
    while ((m = pat.exec(narrative)) !== null) {
      var name = m[2];
      var post = m[3];
      if (!charNames[name]) continue;
      var key = name + '_' + post;
      if (mentioned.find(function(x){return x.key===key;})) continue;
      mentioned.push({ key: key, name: name, post: post, verb: m[1], raw: m[0] });
    }
    if (!mentioned.length) return;

    var handled = {};
    (aiOutput.office_assignments || []).forEach(function(oa) {
      if (oa && oa.name && (oa.action === 'appoint' || oa.action === 'transfer')) handled[oa.name] = true;
    });
    (aiOutput.personnel_changes || []).forEach(function(pc) {
      if (pc && pc.name) handled[pc.name] = true;
    });

    var missing = mentioned.filter(function(m){ return !handled[m.name]; });
    if (!missing.length) return;

    // 自动补录·调 onAppointment
    var patched = 0;
    missing.forEach(function(m) {
      try {
        if (typeof onAppointment === 'function') {
          var r = onAppointment(m.name, m.post, null);
          if (r && r.ok) {
            patched++;
            if (global.addEB) global.addEB('校验补录', '官职校验·' + m.name + '『' + m.verb + '为' + m.post + '』补录(原文: ' + m.raw + ')');
          }
        }
      } catch(_e) {
        try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_e, 'office-validator'); } catch(__){}
      }
    });

    if (!G._officeValidatorLog) G._officeValidatorLog = [];
    G._officeValidatorLog.push({ turn: G.turn || 0, missing: missing, patched: patched });
    if (G._officeValidatorLog.length > 20) G._officeValidatorLog = G._officeValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'office_validation', missing: missing, patched: patched, turn: G.turn || 0 });
    console.warn('[OfficeValidator] 叙事任命与 office_assignments 漏录(补 ' + patched + '/' + missing.length + '):', missing);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  保守版·14f-1·战争一致性校验
  //  扫描 narrative 中『起兵/北伐/讨伐/议和/罢兵/大败/陷落』·对照 GM.activeWars
  // ═══════════════════════════════════════════════════════════════════
  function _validateWarConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    // 开战/扩战动词
    var warStartVerbs = ['起兵','兴师','讨伐','征伐','北伐','南征','东征','西征','进犯','入寇','犯境','寇边','兵临','出兵','开战','起衅','启衅','南下','北上'];
    // 议和/结束动词
    var warEndVerbs = ['议和','和谈','罢兵','讲和','纳贡','约和','盟约','停战','受降','献降','纳款','奉表','称臣'];
    // 战役结果动词
    var battleVerbs = ['大败','大捷','克复','陷落','失守','收复','破','突围','会战','激战','溃败','全军覆没','戍御','解围'];

    function _hit(arr) {
      for (var i = 0; i < arr.length; i++) if (narrative.indexOf(arr[i]) >= 0) return arr[i];
      return null;
    }
    var startKw = _hit(warStartVerbs);
    var endKw = _hit(warEndVerbs);
    var battleKw = _hit(battleVerbs);
    if (!startKw && !endKw && !battleKw) return;

    var warnings = [];
    var existingWars = Array.isArray(G.activeWars) ? G.activeWars : [];
    var beforeCount = (applied && typeof applied._warsBefore === 'number') ? applied._warsBefore : existingWars.length;
    // narrative 提到开战·但 activeWars 数量未增加
    if (startKw && existingWars.length <= beforeCount) {
      warnings.push({ kind: 'war_start_missing', keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
    }
    // narrative 提到议和·但没有 war.status 变 ended/peaced
    if (endKw) {
      var hasPeaced = existingWars.some(function(w) { return w && (w.status === 'ended' || w.status === 'peace' || w.status === 'truce' || w.endedTurn); });
      if (!hasPeaced) warnings.push({ kind: 'war_end_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
    }
    // narrative 提到具体战役·但 war.battles 都为空
    if (battleKw) {
      var hasBattle = existingWars.some(function(w) { return w && Array.isArray(w.battles) && w.battles.length > 0; });
      if (!hasBattle && existingWars.length > 0) {
        warnings.push({ kind: 'battle_missing', keyword: battleKw, snippet: _snippetAround(narrative, battleKw, 30) });
      }
    }
    if (!warnings.length) return;

    if (!G._warValidatorLog) G._warValidatorLog = [];
    G._warValidatorLog.push({ turn: G.turn || 0, warnings: warnings });
    if (G._warValidatorLog.length > 20) G._warValidatorLog = G._warValidatorLog.slice(-20);
    if (G._turnReport) G._turnReport.push({ type: 'war_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[WarValidator] 战争一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  保守版·14f-2·民变一致性校验
  //  扫描 narrative 中『起事/聚众/作乱/平定/招抚』·对照 G.minxin.revolts
  // ═══════════════════════════════════════════════════════════════════
  function _validateRevoltConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    var revoltStartVerbs = ['起事','起义','造反','反叛','暴动','聚众','啸聚','揭竿','作乱','民变','匪乱','盗起','贼起','倡乱','倡反','倡叛','流寇'];
    var revoltEndVerbs = ['镇压','平定','剿','扑灭','招抚','宣抚','讨平','戡定','平息','靖','勘平'];

    function _hit(arr) {
      for (var i = 0; i < arr.length; i++) if (narrative.indexOf(arr[i]) >= 0) return arr[i];
      return null;
    }
    var startKw = _hit(revoltStartVerbs);
    var endKw = _hit(revoltEndVerbs);
    if (!startKw && !endKw) return;

    var warnings = [];
    var existingRevolts = (G.minxin && Array.isArray(G.minxin.revolts)) ? G.minxin.revolts : [];
    var beforeCount = (applied && typeof applied._revoltsBefore === 'number') ? applied._revoltsBefore : existingRevolts.length;
    if (startKw && existingRevolts.length <= beforeCount) {
      warnings.push({ kind: 'revolt_start_missing', keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
    }
    if (endKw) {
      var hasEnded = existingRevolts.some(function(r) {
        return r && (r.status === 'suppressed' || r.status === 'appeased' || r.status === 'ended' || r.endedTurn);
      });
      var hasOngoingBefore = existingRevolts.some(function(r) { return r && r.status === 'ongoing'; });
      if (!hasEnded && hasOngoingBefore) {
        warnings.push({ kind: 'revolt_end_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
      }
    }
    if (!warnings.length) return;

    if (!G._revoltValidatorLog) G._revoltValidatorLog = [];
    G._revoltValidatorLog.push({ turn: G.turn || 0, warnings: warnings });
    if (G._revoltValidatorLog.length > 20) G._revoltValidatorLog = G._revoltValidatorLog.slice(-20);
    if (G._turnReport) G._turnReport.push({ type: 'revolt_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[RevoltValidator] 民变一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  保守版·14f-3·天灾一致性校验
  //  扫描 narrative 中『大旱/洪/蝗/瘟疫/地震』·对照 G.activeDisasters
  // ═══════════════════════════════════════════════════════════════════
  function _validateDisasterConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    var disasterCategories = {
      drought: ['大旱','亢旱','赤地','久旱','久不雨','焦土','草木枯','禾稼焦'],
      flood: ['大水','洪水','决堤','江溢','河溢','暴雨','水患','溃决','汎滥','泛滥'],
      locust: ['蝗','飞蝗','蝻'],
      plague: ['大疫','瘟疫','疠疫','染疫','疫死','瘟','时疫','痘疹'],
      quake: ['地动','地震','地陷','山崩','山摇']
    };

    function _hitCat() {
      var hits = [];
      Object.keys(disasterCategories).forEach(function(cat) {
        for (var i = 0; i < disasterCategories[cat].length; i++) {
          if (narrative.indexOf(disasterCategories[cat][i]) >= 0) {
            hits.push({ category: cat, keyword: disasterCategories[cat][i] });
            break;
          }
        }
      });
      return hits;
    }
    var hitList = _hitCat();
    if (!hitList.length) return;

    var warnings = [];
    var existingDisasters = Array.isArray(G.activeDisasters) ? G.activeDisasters : [];
    var beforeCount = (applied && typeof applied._disastersBefore === 'number') ? applied._disastersBefore : existingDisasters.length;
    // 若 narrative 命中灾害关键词·但 activeDisasters 数量未增加·按命中类别报警
    if (existingDisasters.length <= beforeCount) {
      hitList.forEach(function(h) {
        warnings.push({ kind: 'disaster_missing', category: h.category, keyword: h.keyword, snippet: _snippetAround(narrative, h.keyword, 30) });
      });
    } else {
      // 数量增加了·但要核对类别匹配
      var existingCats = {};
      existingDisasters.forEach(function(d) {
        if (d && (d.type || d.category)) existingCats[d.type || d.category] = true;
      });
      hitList.forEach(function(h) {
        if (!existingCats[h.category] && !existingCats[h.keyword]) {
          warnings.push({ kind: 'disaster_category_mismatch', category: h.category, keyword: h.keyword, snippet: _snippetAround(narrative, h.keyword, 30) });
        }
      });
    }
    if (!warnings.length) return;

    if (!G._disasterValidatorLog) G._disasterValidatorLog = [];
    G._disasterValidatorLog.push({ turn: G.turn || 0, warnings: warnings });
    if (G._disasterValidatorLog.length > 20) G._disasterValidatorLog = G._disasterValidatorLog.slice(-20);
    if (G._turnReport) G._turnReport.push({ type: 'disaster_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[DisasterValidator] 天灾一致性警告:', warnings);
  }

  // 辅助·取关键词附近文本
  function _snippetAround(text, keyword, span) {
    var idx = text.indexOf(keyword);
    if (idx < 0) return '';
    var start = Math.max(0, idx - span);
    var end = Math.min(text.length, idx + keyword.length + span);
    return text.substring(start, end);
  }
  // 辅助·命中关键词数组中的任一项
  function _firstHit(text, arr) {
    for (var i = 0; i < arr.length; i++) if (text.indexOf(arr[i]) >= 0) return arr[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-4·外交一致性校验
  //  扫『通使/朝贡/绝交/羁縻/抚夷』·对照 G.facs[].relations / attitude
  // ═══════════════════════════════════════════════════════════════════
  function _validateDiplomacyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var startKw = _firstHit(narrative, ['通使','缔盟','和好','朝贡','纳款','纳贡','遣使','称臣','羁縻','抚夷','封贡']);
    var endKw = _firstHit(narrative, ['绝交','逐使','断绝','宣战','犯界','寇边','弃约','背盟']);
    if (!startKw && !endKw) return;
    // facs.attitude / relations 是否本回合有 update
    var fuArr = aiOutput.faction_updates || [];
    var hasFactionUpdate = fuArr.length > 0 || (G.turnChanges && (G.turnChanges.factions||[]).length > 0);
    if (hasFactionUpdate) return;
    var warnings = [];
    if (startKw) warnings.push({ kind: 'diplomacy_friendly_missing', keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
    if (endKw) warnings.push({ kind: 'diplomacy_hostile_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
    if (!warnings.length) return;
    if (!G._diplomacyValidatorLog) G._diplomacyValidatorLog = [];
    G._diplomacyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._diplomacyValidatorLog.length > 20) G._diplomacyValidatorLog = G._diplomacyValidatorLog.slice(-20);
    console.warn('[DiplomacyValidator] 外交一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-5·科举一致性校验
  //  扫『开科/会试/殿试/放榜/赐进士』·对照 P.keju
  // ═══════════════════════════════════════════════════════════════════
  function _validateKejuConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var kw = _firstHit(narrative, ['开科','会试','殿试','放榜','赐进士','钦点状元','钦定三甲','一甲及第','二甲赐进士','金榜','龙虎榜','春闱','秋闱','恩科','乡试','贡士']);
    if (!kw) return;
    var Pref = (typeof P !== 'undefined') ? P : null;
    var kejuActive = (Pref && Pref.keju && (Pref.keju.currentExam || (Pref.keju.history && Pref.keju.history.length)));
    if (kejuActive) return;
    var warnings = [{ kind: 'keju_missing', keyword: kw, snippet: _snippetAround(narrative, kw, 30) }];
    if (!G._kejuValidatorLog) G._kejuValidatorLog = [];
    G._kejuValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._kejuValidatorLog.length > 20) G._kejuValidatorLog = G._kejuValidatorLog.slice(-20);
    console.warn('[KejuValidator] 科举一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-6·党派一致性校验
  //  扫『结党/立党/盟誓/解散/瓦解/弹劾』·对照 GM.parties[]
  // ═══════════════════════════════════════════════════════════════════
  function _validatePartyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var formKw = _firstHit(narrative, ['结社','立党','结党','盟誓','倡党','倡议设','门户','朋党','立社']);
    var endKw = _firstHit(narrative, ['解散','瓦解','分裂','分崩','倾覆','清党','除党','禁社']);
    if (!formKw && !endKw) return;
    var existing = Array.isArray(G.parties) ? G.parties : [];
    var beforeCount = (applied && typeof applied._partiesBefore === 'number') ? applied._partiesBefore : existing.length;
    var hasUpdate = (aiOutput.party_updates || []).length > 0;
    if (hasUpdate) return;
    var warnings = [];
    if (formKw && existing.length <= beforeCount) warnings.push({ kind: 'party_form_missing', keyword: formKw, snippet: _snippetAround(narrative, formKw, 30) });
    if (endKw && existing.length >= beforeCount && existing.some(function(p){return p && p.status==='active';})) warnings.push({ kind: 'party_end_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
    if (!warnings.length) return;
    if (!G._partyValidatorLog) G._partyValidatorLog = [];
    G._partyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._partyValidatorLog.length > 20) G._partyValidatorLog = G._partyValidatorLog.slice(-20);
    console.warn('[PartyValidator] 党派一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-7·法令效力一致性校验
  //  扫『颁诏/降旨/敕谕/废制/施行新政/罢...诏』·对照 GM.activeEdicts
  // ═══════════════════════════════════════════════════════════════════
  function _validateEdictEffectConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var promulgateKw = _firstHit(narrative, ['颁诏','降旨','敕谕','颁行','颁布','下诏','明诏','谕令','制曰','施行新政','开行...新法','申严']);
    var revokeKw = _firstHit(narrative, ['废诏','废制','停止施行','撤回','撤销','废止','废罢','收回成命']);
    if (!promulgateKw && !revokeKw) return;
    var existingEdicts = Array.isArray(G.activeEdicts) ? G.activeEdicts : [];
    var beforeCount = (applied && typeof applied._edictsBefore === 'number') ? applied._edictsBefore : existingEdicts.length;
    var warnings = [];
    if (promulgateKw && existingEdicts.length <= beforeCount) warnings.push({ kind: 'edict_promulgate_missing', keyword: promulgateKw, snippet: _snippetAround(narrative, promulgateKw, 30) });
    if (revokeKw && existingEdicts.length >= beforeCount) warnings.push({ kind: 'edict_revoke_missing', keyword: revokeKw, snippet: _snippetAround(narrative, revokeKw, 30) });
    if (!warnings.length) return;
    if (!G._edictEffectValidatorLog) G._edictEffectValidatorLog = [];
    G._edictEffectValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._edictEffectValidatorLog.length > 20) G._edictEffectValidatorLog = G._edictEffectValidatorLog.slice(-20);
    console.warn('[EdictEffectValidator] 法令效力一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-8·朝廷礼仪一致性校验（含后宫）
  //  扫『迁都/晋爵/赠官/谥/追封/赐姓/册立...为后/晋...为妃/废后/出宫』
  // ═══════════════════════════════════════════════════════════════════
  function _validateCourtCeremonyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var moveCapKw = _firstHit(narrative, ['迁都','移都','改都']);
    var titleKw = _firstHit(narrative, ['晋爵','晋封','加封','进爵','赐爵','削爵','夺爵','除爵','赠','追赠','追封','谥','赐姓','赐婚']);
    var haremKw = _firstHit(narrative, ['册立','册封','晋为妃','晋为贵妃','立为皇后','废后','废妃','降为','贬为','出宫','选秀','纳妃']);
    if (!moveCapKw && !titleKw && !haremKw) return;
    var charUpdates = aiOutput.char_updates || [];
    // 简单粗略：char_updates 中是否含 title/posthumous/spouse 修改
    var hasRelevantUpdate = charUpdates.some(function(c){
      if (!c || !c.changes) return false;
      var chKeys = Object.keys(c.changes||{});
      return chKeys.some(function(k){return /title|posthumous|spouse|wife|consort/i.test(k);});
    });
    var warnings = [];
    if (moveCapKw) warnings.push({ kind: 'capital_move_missing', keyword: moveCapKw, snippet: _snippetAround(narrative, moveCapKw, 30) });
    if (titleKw && !hasRelevantUpdate) warnings.push({ kind: 'title_change_missing', keyword: titleKw, snippet: _snippetAround(narrative, titleKw, 30) });
    if (haremKw && !hasRelevantUpdate) warnings.push({ kind: 'harem_change_missing', keyword: haremKw, snippet: _snippetAround(narrative, haremKw, 30) });
    if (!warnings.length) return;
    if (!G._courtCeremonyValidatorLog) G._courtCeremonyValidatorLog = [];
    G._courtCeremonyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._courtCeremonyValidatorLog.length > 20) G._courtCeremonyValidatorLog = G._courtCeremonyValidatorLog.slice(-20);
    console.warn('[CourtCeremonyValidator] 朝廷礼仪一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-9·工程·物品·建筑一致性校验
  //  扫『兴工/督造/敕造/竣工/烧毁/重建/铸钱/铸器/重修/...毁』
  // ═══════════════════════════════════════════════════════════════════
  function _validateConstructionConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var buildKw = _firstHit(narrative, ['兴工','督造','敕造','竣工','落成','营建','营造','重建','修缮','整修','修陵','治水','河工','堰塞','筑城','筑堡','铸钱','铸器','造船','试制']);
    var destroyKw = _firstHit(narrative, ['烧毁','毁','摧','颓','坍','圮','废墟','焚毁']);
    if (!buildKw && !destroyKw) return;
    // 检查 changes 中是否含 building / project / item 路径
    var hasRelevant = (aiOutput.changes || []).some(function(c){
      var p = (c && c.path) || '';
      return /building|project|construction|item|works|edifice/i.test(p);
    });
    var warnings = [];
    if (buildKw && !hasRelevant) warnings.push({ kind: 'construction_build_missing', keyword: buildKw, snippet: _snippetAround(narrative, buildKw, 30) });
    if (destroyKw && !hasRelevant) warnings.push({ kind: 'construction_destroy_missing', keyword: destroyKw, snippet: _snippetAround(narrative, destroyKw, 30) });
    if (!warnings.length) return;
    if (!G._constructionValidatorLog) G._constructionValidatorLog = [];
    G._constructionValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._constructionValidatorLog.length > 20) G._constructionValidatorLog = G._constructionValidatorLog.slice(-20);
    console.warn('[ConstructionValidator] 工程·物品一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-11·婚姻·生育·继承一致性校验
  //  扫『嫁/娶/聘/纳/有娠/诞生/分娩/夭折/绝嗣/承嗣/即位』·对照 GM.harem / chars
  // ═══════════════════════════════════════════════════════════════════
  function _validateMarriageBirthConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var marryKw = _firstHit(narrative, ['嫁','娶','聘','纳采','纳征','成婚','结亲','缔婚','和亲','联姻','大婚']);
    var birthKw = _firstHit(narrative, ['有娠','怀孕','身娠','诞生','分娩','降生','弄璋','弄瓦','长公主','皇子','皇女','龙胎']);
    var deathHeirKw = _firstHit(narrative, ['夭折','早殇','薨于稚龄','婴卒','绝嗣','无嗣','断后']);
    var succKw = _firstHit(narrative, ['即位','登基','嗣位','继统','承祧','承嗣','袭爵','袭封','袭位']);
    if (!marryKw && !birthKw && !deathHeirKw && !succKw) return;
    var charUpdates = aiOutput.char_updates || [];
    var newChars = aiOutput.new_characters || [];
    var charDeaths = aiOutput.character_deaths || [];
    var hasUpdate = charUpdates.some(function(c){return c && c.changes && Object.keys(c.changes).some(function(k){return /spouse|wife|consort|children|heir|inherited|succeeded/i.test(k);});});
    var warnings = [];
    if (marryKw && !hasUpdate) warnings.push({ kind: 'marriage_missing', keyword: marryKw, snippet: _snippetAround(narrative, marryKw, 30) });
    if (birthKw && newChars.length === 0) warnings.push({ kind: 'birth_missing', keyword: birthKw, snippet: _snippetAround(narrative, birthKw, 30) });
    if (deathHeirKw && charDeaths.length === 0) warnings.push({ kind: 'heir_death_missing', keyword: deathHeirKw, snippet: _snippetAround(narrative, deathHeirKw, 30) });
    if (succKw && !hasUpdate) warnings.push({ kind: 'succession_missing', keyword: succKw, snippet: _snippetAround(narrative, succKw, 30) });
    if (!warnings.length) return;
    if (!G._marriageBirthValidatorLog) G._marriageBirthValidatorLog = [];
    G._marriageBirthValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._marriageBirthValidatorLog.length > 20) G._marriageBirthValidatorLog = G._marriageBirthValidatorLog.slice(-20);
    console.warn('[MarriageBirthValidator] 婚姻·生育·继承一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-12·谋反·政变·弑君一致性校验
  //  扫『谋反/谋逆/弑君/宫变/篡位/兵谏/逼宫/犯阙/兵围』·对照 GM._conspiracies
  // ═══════════════════════════════════════════════════════════════════
  function _validateConspiracyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var plotKw = _firstHit(narrative, ['谋反','谋逆','谋叛','造逆','阴谋','蓄志','潜谋','怀异','私通','密议','结连','潜图']);
    var coupKw = _firstHit(narrative, ['弑君','宫变','政变','兵变','篡位','兵谏','逼宫','犯阙','兵围禁中','闯宫','劫驾']);
    if (!plotKw && !coupKw) return;
    // 检查 personnel_changes 是否有 reason 含『反/逆/篡』
    var pcArr = aiOutput.personnel_changes || [];
    var hasReason = pcArr.some(function(p){return p && p.reason && /反|逆|篡|谋|变|党/.test(p.reason);});
    var charDeaths = (aiOutput.character_deaths || []).some(function(d){return d && d.cause && /反|逆|弑|篡|刺|杀/.test(d.cause||d.reason||'');});
    var warnings = [];
    if (plotKw && !hasReason && !charDeaths) warnings.push({ kind: 'plot_missing', keyword: plotKw, snippet: _snippetAround(narrative, plotKw, 30) });
    if (coupKw && !hasReason && !charDeaths) warnings.push({ kind: 'coup_missing', keyword: coupKw, snippet: _snippetAround(narrative, coupKw, 30) });
    if (!warnings.length) return;
    if (!G._conspiracyValidatorLog) G._conspiracyValidatorLog = [];
    G._conspiracyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._conspiracyValidatorLog.length > 20) G._conspiracyValidatorLog = G._conspiracyValidatorLog.slice(-20);
    console.warn('[ConspiracyValidator] 谋反·政变一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-13·货币·币值·银荒一致性校验
  //  扫『银荒/钱荒/钞贱/通胀/铜贵/银贵/币改/换钞/铸大钱』·对照 GM.currency
  // ═══════════════════════════════════════════════════════════════════
  function _validateCurrencyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var crisisKw = _firstHit(narrative, ['银荒','钱荒','钞贱','通胀','铜贵','银贵','物价腾贵','米价踊贵','货贵','钱贱']);
    var reformKw = _firstHit(narrative, ['币改','换钞','行钞','行银','铸大钱','改铸','禁银','禁铜','解禁','弛禁']);
    if (!crisisKw && !reformKw) return;
    // 检查 changes / fiscal_adjustments / global_state_delta 是否含 currency/silver/copper/inflation
    var hasUpdate = (aiOutput.changes || []).some(function(c){var p=(c&&c.path)||'';return /currenc|silver|copper|inflation|银价|物价/i.test(p);})
      || (aiOutput.global_state_delta && Object.keys(aiOutput.global_state_delta||{}).some(function(k){return /inflation|currency|priceIndex/i.test(k);}));
    var warnings = [];
    if (crisisKw && !hasUpdate) warnings.push({ kind: 'currency_crisis_missing', keyword: crisisKw, snippet: _snippetAround(narrative, crisisKw, 30) });
    if (reformKw && !hasUpdate) warnings.push({ kind: 'currency_reform_missing', keyword: reformKw, snippet: _snippetAround(narrative, reformKw, 30) });
    if (!warnings.length) return;
    if (!G._currencyValidatorLog) G._currencyValidatorLog = [];
    G._currencyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._currencyValidatorLog.length > 20) G._currencyValidatorLog = G._currencyValidatorLog.slice(-20);
    console.warn('[CurrencyValidator] 货币·币值一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-14·宗教·教派一致性校验
  //  扫『立教/兴佛/灭佛/传教/邪教/白莲/天主/教门/兴道/灭道/僧伽』·对照 GM.religions
  // ═══════════════════════════════════════════════════════════════════
  function _validateReligionConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var riseKw = _firstHit(narrative, ['立教','兴佛','兴道','传教','弘法','弘道','立寺','建观','开堂']);
    var fallKw = _firstHit(narrative, ['灭佛','灭道','禁教','毁寺','毁观','焚经','沙汰','逐僧','逐道']);
    var sectKw = _firstHit(narrative, ['白莲','弥勒','无生老母','闻香','天主','耶稣会','回回','袄教','摩尼','邪教','妖教','妖人']);
    if (!riseKw && !fallKw && !sectKw) return;
    var existingRel = Array.isArray(G.religions) ? G.religions : [];
    var beforeCount = (applied && typeof applied._religionsBefore === 'number') ? applied._religionsBefore : existingRel.length;
    var hasUpdate = (aiOutput.changes||[]).some(function(c){var p=(c&&c.path)||'';return /religion|sect|temple|monastic/i.test(p);});
    var warnings = [];
    if ((riseKw || fallKw) && !hasUpdate && existingRel.length === beforeCount) warnings.push({ kind: 'religion_change_missing', keyword: riseKw || fallKw, snippet: _snippetAround(narrative, riseKw || fallKw, 30) });
    if (sectKw && !hasUpdate) warnings.push({ kind: 'sect_event_missing', keyword: sectKw, snippet: _snippetAround(narrative, sectKw, 30) });
    if (!warnings.length) return;
    if (!G._religionValidatorLog) G._religionValidatorLog = [];
    G._religionValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._religionValidatorLog.length > 20) G._religionValidatorLog = G._religionValidatorLog.slice(-20);
    console.warn('[ReligionValidator] 宗教·教派一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-10·异象·谶语一致性校验
  //  扫『彗见/星孛/日蚀/月蚀/血雨/虹贯/瑞兽/麒麟/凤凰/白虎/谶/谣/天象』
  // ═══════════════════════════════════════════════════════════════════
  function _validateOmenConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var omenKw = _firstHit(narrative, ['彗见','彗星','星孛','日蚀','日食','月蚀','月食','血雨','虹贯','虹气','白虹','瑞兽','麒麟','凤凰','白虎','五星连珠','陨石','地龙','童谣','谶','妖言','灾异','祥瑞']);
    if (!omenKw) return;
    var existingOmens = Array.isArray(G.omens) ? G.omens : (G.events||[]).filter(function(e){return e && (e.type==='omen'||e.category==='omen');});
    var beforeCount = (applied && typeof applied._omensBefore === 'number') ? applied._omensBefore : existingOmens.length;
    if (existingOmens.length > beforeCount) return;
    var warnings = [{ kind: 'omen_missing', keyword: omenKw, snippet: _snippetAround(narrative, omenKw, 30) }];
    if (!G._omenValidatorLog) G._omenValidatorLog = [];
    G._omenValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._omenValidatorLog.length > 20) G._omenValidatorLog = G._omenValidatorLog.slice(-20);
    console.warn('[OmenValidator] 异象一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  二次 AI 自审 reconciliation·Wave 1c
  //  仅当本回合 5 个 validator 累计警告 >= 3 时触发·让 AI 看自己的 narrative+JSON·查矛盾·返回补录
  //  返回的 reconciliation_patch 自动 apply 到 GM·token 成本约 +20%
  // ═══════════════════════════════════════════════════════════════════
  function _maybeReconcileWithAI(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    // 统计本回合各 validator 警告数·阈值 3
    var fiscalW = (G._fiscalValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var personW = (G._personnelValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.missing||[]).length;},0);
    var militaryW = (G._militaryValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var sentW = (G._sentimentValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var popW = (G._populationValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var officeW = (G._officeValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.missing||[]).length;},0);
    // 保守版·三类新 validator
    var warW = (G._warValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var revoltW = (G._revoltValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var disasterW = (G._disasterValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    // 激进版·七类新 validator
    var diplomacyW = (G._diplomacyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var kejuW = (G._kejuValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var partyW = (G._partyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var edictEffectW = (G._edictEffectValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var courtCeremonyW = (G._courtCeremonyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var constructionW = (G._constructionValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var omenW = (G._omenValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    // 极致版·末四类
    var marriageBirthW = (G._marriageBirthValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var conspiracyW = (G._conspiracyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var currencyW = (G._currencyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var religionW = (G._religionValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var totalW = fiscalW + personW + militaryW + sentW + popW + officeW + warW + revoltW + disasterW + diplomacyW + kejuW + partyW + edictEffectW + courtCeremonyW + constructionW + omenW + marriageBirthW + conspiracyW + currencyW + religionW;

    if (!G._reconcileLog) G._reconcileLog = [];
    G._reconcileLog.push({ turn: G.turn || 0, fiscalW: fiscalW, personW: personW, militaryW: militaryW, sentW: sentW, popW: popW, officeW: officeW, warW: warW, revoltW: revoltW, disasterW: disasterW, diplomacyW: diplomacyW, kejuW: kejuW, partyW: partyW, edictEffectW: edictEffectW, courtCeremonyW: courtCeremonyW, constructionW: constructionW, omenW: omenW, marriageBirthW: marriageBirthW, conspiracyW: conspiracyW, currencyW: currencyW, religionW: religionW, total: totalW });
    if (G._reconcileLog.length > 20) G._reconcileLog = G._reconcileLog.slice(-20);

    if (totalW < 3) return;  // 未达阈值
    // ★ 不在 applier 同步触发 AI(applier 是同步函数)·标记需要 reconcile·让 endturn-ai-infer 异步处理
    G._needsReconcile = {
      turn: G.turn || 0,
      warnings: { fiscal: fiscalW, personnel: personW, military: militaryW, sentiment: sentW, population: popW, office: officeW, war: warW, revolt: revoltW, disaster: disasterW, diplomacy: diplomacyW, keju: kejuW, party: partyW, edictEffect: edictEffectW, courtCeremony: courtCeremonyW, construction: constructionW, omen: omenW, marriageBirth: marriageBirthW, conspiracy: conspiracyW, currency: currencyW, religion: religionW },
      narrativeSnapshot: _getNarrativeText(aiOutput).slice(0, 2000),  // 截断防止 prompt 过长
      structuredSnapshot: {
        personnel_changes: aiOutput.personnel_changes || [],
        office_assignments: aiOutput.office_assignments || [],
        fiscal_adjustments: aiOutput.fiscal_adjustments || [],
        military_changes: aiOutput.military_changes || [],
        activeWars: G.activeWars || [],
        revolts: (G.minxin && G.minxin.revolts) || [],
        activeDisasters: G.activeDisasters || [],
        facs: (G.facs||[]).slice(0,5),
        parties: G.parties || [],
        activeEdicts: G.activeEdicts || []
      }
    };
    console.warn('[ReconcileAI] 本回合校验器累计警告 ' + totalW + ' 条 >= 阈值·标记 GM._needsReconcile·待异步 AI 自审');
    if (G._turnReport) G._turnReport.push({ type: 'reconcile_pending', total: totalW, turn: G.turn || 0 });
  }

  function _validateFiscalConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrativeText = '';
    if (aiOutput.shilu_text) narrativeText += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji) narrativeText += String(aiOutput.shizhengji) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) narrativeText += String(e.desc) + '\n'; });
    }
    if (aiOutput.event && aiOutput.event.desc) narrativeText += String(aiOutput.event.desc) + '\n';
    if (!narrativeText) return;

    // 中文/阿拉伯混合数字转阿拉伯数字
    function _parseNum(numStr, mult) {
      var cnMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'两':2,'壹':1,'贰':2,'叁':3,'肆':4,'伍':5,'陆':6,'柒':7,'捌':8,'玖':9};
      var n = parseFloat(numStr);
      if (!isNaN(n) && n > 0) {
        // 阿拉伯前缀：检查尾部是否携带量级单位（如"30万"）
        if (/万$/.test(numStr)) n *= 10000;
        else if (/千$/.test(numStr)) n *= 1000;
        else if (/百$/.test(numStr)) n *= 100;
        else if (/十$/.test(numStr)) n *= 10;
      } else {
        // 纯中文数字解析
        n = 0;
        for (var i = 0; i < numStr.length; i++) {
          var ch = numStr.charAt(i);
          if (cnMap[ch] != null) n = n * 10 + cnMap[ch];
          else if (ch === '十') n = (n || 1) * 10;
          else if (ch === '百') n = (n || 1) * 100;
          else if (ch === '千') n = (n || 1) * 1000;
          else if (ch === '万') n = (n || 1) * 10000;
        }
      }
      if (mult === '万') n *= 10000;
      else if (mult === '千') n *= 1000;
      else if (mult === '百') n *= 100;
      else if (mult === '十') n *= 10;
      return n;
    }

    var mentioned = [];
    // ★ 双向匹配：支出动词(outflow) + 收入动词(inflow)·分别标记 kind
    // 之前正则只识别支出动词·导致 AI 叙述『获得三百万两白银』时校验器抓不到·数值不对账
    // 2026-04 扩充：补『籍没/抄没/查抄/划拨/支给/支应/赏银/赈银/拨款/专款』等诏令式动词
    var outflowVerbs = '赐|赏|发|拨|赈|征|没收|缴获|贡|赔|罚没|献|输|筹|济|捐|赠|颁|犒|赠送|耗费|花费|花|靡费|费' +
      '|拨付|拨给|拨入|拨内帑|拨内库|划拨|调拨|发付|发给|发支|出库|起解|起运|解送|解部|解到|报销|发还|分给|拨与|赏给|犒赏|犒军|赈济|赈灾|赈给|安抚|抚恤|抚慰' +
      '|支应|支给|支用|支放|支发|支领|动支|动用|提取|提用|划支|划归|经费|靡费|开支|开销|耗用';
    var inflowVerbs = '获得|获|收|入|进|得|得到|收到|进项|进帐|进账|收入|入账|入库|入帑|入内帑|纳入|抄获|抄到|没入|缴入|追缴|追讨|追回|罚入|查封充公|抄没入|没收入' +
      '|籍没|籍家|籍没家产|抄家|抄籍|抄没|查抄|抄入|查封|充公|没官|没充|没户' +
      '|入私库|入御府|入库银|起运入|解送至|划入|转入|调入|拨归|归入|纳款|捐输|报效' +
      '|追比|追征|追缴|追赔|籍录|籍其家|罚银|罚没';
    // 单位匹配（带单位）— 高置信度
    var patOut = new RegExp('(' + outflowVerbs + ')[^。；\\s,，]{0,8}?([\\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖]+)\\s*(万|千|百|十)?\\s*(两|石|匹|斛|贯|缗|斗)', 'g');
    var patIn  = new RegExp('(' + inflowVerbs + ')[^。；\\s,，]{0,8}?([\\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖]+)\\s*(万|千|百|十)?\\s*(两|石|匹|斛|贯|缗|斗)', 'g');
    function _scanPattern(pat, kind) {
      var m;
      while ((m = pat.exec(narrativeText)) !== null) {
        var action = m[1];
        var numStr = m[2];
        var mult = m[3] || '';
        var unit = m[4];
        var amt = _parseNum(numStr, mult);
        if (!amt || amt < 100) continue;
        var resType = (unit === '石' || unit === '斛' || unit === '斗') ? 'grain'
                    : (unit === '匹') ? 'cloth'
                    : 'money';
        mentioned.push({ action: action, amount: amt, resource: resType, kind: kind, raw: m[0] });
      }
    }
    _scanPattern(patOut, 'expense');
    _scanPattern(patIn,  'income');

    // ★ 兜底：无单位裸数额"N 万"——必须 narrative 段落含金钱语境关键词才视为 money
    // 这套补丁专杀玩家原档的"籍没X家产 +150万 / 京营赏银 -10万 / X查抄 +450万"等诏令式表达
    var moneyContextKw = /银|帑|库|帑廪|内帑|私库|内库|国库|库银|赏银|赈银|饷银|饷|赏|赈|犒|拨款|专款|经费|赔款|银两|帑库|公库/;
    var hasMoneyContext = moneyContextKw.test(narrativeText);
    if (hasMoneyContext) {
      // 模式：动词 + (人名/地名/事由)? + 数字 + 万 (无两/石/匹后缀)·宽松匹配
      // 允许空格·允许小数点（如 139.2万）·允许 +/- 前缀符号（modal 常用 "+150万"）
      var patOutLoose = new RegExp('(' + outflowVerbs + ')[^。；,，]{0,16}?([+\\-]?[\\d一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖]+(?:\\.\\d+)?)\\s*万(?!两|石|匹|斛|贯|缗|斗|文|众|户|口|人|亩|顷|名)', 'g');
      var patInLoose  = new RegExp('(' + inflowVerbs + ')[^。；,，]{0,16}?([+\\-]?[\\d一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖]+(?:\\.\\d+)?)\\s*万(?!两|石|匹|斛|贯|缗|斗|文|众|户|口|人|亩|顷|名)', 'g');
      function _scanLoose(pat, kind) {
        var m;
        while ((m = pat.exec(narrativeText)) !== null) {
          var raw = m[0];
          // 排重·已在严格匹配里命中过的整段不再 push
          if (mentioned.some(function(x){return x.raw === raw;})) continue;
          var amt = _parseNum(m[2], '万');
          if (!amt || amt < 1000) continue;  // 兜底匹配·阈值更高(1000+ 单位=两)·避免误抓"X 万人/X 万亩"
          mentioned.push({ action: m[1], amount: amt, resource: 'money', kind: kind, raw: raw, _loose: true });
        }
      }
      _scanLoose(patOutLoose, 'expense');
      _scanLoose(patInLoose, 'income');
    }
    if (!mentioned.length) return;

    // 比对 fiscal_adjustments 总量·分 income/expense 两边
    var adjTotal = { income: { money:0, grain:0, cloth:0 }, expense: { money:0, grain:0, cloth:0 } };
    (aiOutput.fiscal_adjustments || []).forEach(function(fa){
      if (!fa) return;
      var res = (fa.resource === 'grain' || fa.resource === 'cloth') ? fa.resource : 'money';
      var k = (fa.kind === 'income') ? 'income' : 'expense';
      adjTotal[k][res] += Math.abs(parseFloat(fa.amount) || 0);
    });
    var mentTotal = { income: { money:0, grain:0, cloth:0 }, expense: { money:0, grain:0, cloth:0 } };
    mentioned.forEach(function(x){ mentTotal[x.kind][x.resource] += x.amount; });

    var warnings = [];
    ['income','expense'].forEach(function(kind) {
      ['money','grain','cloth'].forEach(function(res){
        if (mentTotal[kind][res] <= 0) return;
        var ratio = adjTotal[kind][res] / mentTotal[kind][res];
        // 允许fiscal_adjustments总量 >= 50% of mentioned，低于此阈值视为严重脱节
        if (ratio < 0.5) {
          warnings.push({
            kind: kind,
            resource: res,
            mentioned: mentTotal[kind][res],
            adjusted: adjTotal[kind][res],
            shortfall: Math.round(mentTotal[kind][res] - adjTotal[kind][res]),
            ratio: Math.round(ratio * 100) / 100
          });
        }
      });
    });

    if (!warnings.length) return;

    if (!G._fiscalValidatorLog) G._fiscalValidatorLog = [];
    G._fiscalValidatorLog.push({ turn: G.turn || 0, warnings: warnings, samples: mentioned.slice(0, 8) });
    if (G._fiscalValidatorLog.length > 20) G._fiscalValidatorLog = G._fiscalValidatorLog.slice(-20);

    G._turnReport.push({ type: 'fiscal_validation', warnings: warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
    console.warn('[FiscalValidator] 叙事金额与 fiscal_adjustments 不符:', warnings);

    // 自动补录·分 income/expense 两边·按 kind 真正补录
    warnings.forEach(function(w){
      if (w.shortfall <= 0) return;
      if (!G.guoku) G.guoku = {};
      var containerKey = (w.kind === 'income') ? 'extraIncome' : 'extraExpense';
      if (!G.guoku[containerKey]) G.guoku[containerKey] = [];
      var patch = {
        id: 'fa_autopatch_' + (G.turn||0) + '_' + Math.random().toString(36).slice(2,5),
        name: '叙事脱节补录·' + (w.kind === 'income' ? '入' : '出'),
        category: '校验补录',
        resource: w.resource,
        amount: w.shortfall,
        kind: w.kind,
        reason: '财务校验器·叙事提及' + w.kind + (w.resource==='grain'?'粮':w.resource==='cloth'?'布':'银') + w.mentioned + '·fiscal_adjustments 仅 ' + w.adjusted + '·自动补录差额',
        recurring: false,
        addedTurn: G.turn || 0,
        stopAfterTurn: null,
        _autoPatched: true
      };
      G.guoku[containerKey].push(patch);
      // 立即作用：income 加库 / expense 扣库（不突破 0）
      var cur = Number(G.guoku[w.resource]) || 0;
      var actual;
      if (w.kind === 'income') {
        // 入：直接加（可抹平负债）
        G.guoku[w.resource] = cur + w.shortfall;
        if (G.guoku.ledgers && G.guoku.ledgers[w.resource]) {
          G.guoku.ledgers[w.resource].stock = (Number(G.guoku.ledgers[w.resource].stock)||0) + w.shortfall;
        }
        actual = w.shortfall;
        patch.shortfall = 0;
      } else {
        // 出：拨到见底
        actual = Math.min(cur, w.shortfall);
        if (cur > 0) {
          G.guoku[w.resource] = cur - actual;
          if (G.guoku.ledgers && G.guoku.ledgers[w.resource]) {
            G.guoku.ledgers[w.resource].stock = Math.max(0, (Number(G.guoku.ledgers[w.resource].stock)||0) - actual);
          }
        }
        patch.shortfall = w.shortfall - actual;
      }
      if (w.resource === 'money') G.guoku.balance = G.guoku.money;
      patch.applied = actual;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  死亡墓志铭 & 诈死holding
  // ═══════════════════════════════════════════════════════════════════
  function _processDeathEpitaphs(G, aiOutput) {
    if (!G || !Array.isArray(G.chars)) return;
    if (!G._epitaphs) G._epitaphs = [];
    if (!G._fakeDeathHolding) G._fakeDeathHolding = {};

    // 处理本回合 character_deaths
    var deathList = Array.isArray(aiOutput.character_deaths) ? aiOutput.character_deaths : [];
    deathList.forEach(function(d){
      if (!d || !d.name) return;
      var ch = _findEntity(G, 'char', d.name);
      if (!ch) return;
      var isFake = (d.type === 'fake' || d.type === '诈死' || /\u8BC8\u6B7B/.test(d.reason || ''));
      if (isFake) {
        ch._fakeDeath = true;
        // holding：保留该角色过往 aiMemory/evtLog 引用·不摘要不清理
        G._fakeDeathHolding[ch.name] = {
          turn: G.turn || 0,
          reason: d.reason || '',
          _memorySnapshot: (ch._memory ? ch._memory.slice() : [])
        };
        G._turnReport.push({ type: 'fake_death', char: ch.name, reason: d.reason, turn: G.turn || 0 });
        return;
      }
      // 真死：生成墓志铭
      _generateEpitaph(G, ch, d.reason || '');
    });

    // 补扫：alive=false 但尚无墓志铭的角色（可能被 char_updates 间接赐死）
    G.chars.forEach(function(ch){
      if (!ch || ch.alive !== false || ch._fakeDeath) return;
      if (ch._epitaphed) return;
      _generateEpitaph(G, ch, ch._deathReason || '');
    });
  }

  function _generateEpitaph(G, ch, reason) {
    if (!ch || ch._epitaphed) return;
    var name = ch.name || '';
    // 摘要：取过去30回合内 aiMemory/evtLog 中涉及该角色的事件
    var snippets = [];
    var curTurn = G.turn || 0;
    (G._aiMemory || []).forEach(function(mem){
      if (!mem) return;
      var mtxt = (mem.text || mem.content || '') + '';
      if (!mtxt) return;
      if ((curTurn - (mem.turn||0)) > 30) return;
      if (mtxt.indexOf(name) >= 0) snippets.push('T'+mem.turn+' '+mtxt.substring(0,80));
    });
    var _evtLen = (G.evtLog || []).length;
    (G.evtLog || []).forEach(function(ev, idx){
      if (!ev) return;
      var txt = (ev.desc || ev.text || '') + '';
      if (!txt || txt.indexOf(name) < 0) return;
      // 最近200条采样入墓志铭
      if ((_evtLen - idx) <= 200) {
        snippets.push('T'+(ev.turn||0)+' '+txt.substring(0,80));
      }
      // 打标：所有提及该死者的事件（不限200条）均标注，后续 prompt 过滤
      ev._charDied = true;
    });
    var epitaph = {
      char: name,
      diedTurn: curTurn,
      diedAt: ch.diedAt || (G.eraState && G.eraState.yearLabel) || '',
      reason: reason || ch._deathReason || '',
      positionAtDeath: ch.officialTitle || '',
      summary: snippets.slice(0, 10).join(' | ') || ('T'+curTurn+' '+name+'薨'),
      importance: (ch.historicalImportance || 0) + (ch._memory ? ch._memory.length : 0)
    };
    G._epitaphs.push(epitaph);
    // 从 _aiMemory 移除该角色原始条目（保留墓志铭摘要）
    if (Array.isArray(G._aiMemory)) {
      G._aiMemory = G._aiMemory.filter(function(mem){
        if (!mem || !mem.text) return true;
        return mem.text.indexOf(name) < 0;
      });
    }
    ch._epitaphed = true;
    G._turnReport.push({ type: 'epitaph', char: name, reason: epitaph.reason, turn: curTurn });
  }

  function _applyDirectiveCompliance(G, aiOutput) {
    if (!G || !Array.isArray(G._playerDirectives) || G._playerDirectives.length === 0) return;
    var reports = aiOutput && Array.isArray(aiOutput.directive_compliance) ? aiOutput.directive_compliance : [];
    // 按 id 索引指令
    var idMap = {};
    G._playerDirectives.forEach(function(d){ if (d && d.id) idMap[d.id] = d; });
    reports.forEach(function(r){
      if (!r || !r.id) return;
      var d = idMap[r.id];
      if (!d) return;
      d._lastStatus = r.status || 'ignored';
      d._lastReason = r.reason || '';
      d._lastEvidence = r.evidence || '';
      d._lastCheckTurn = G.turn || 0;
      if (d._lastStatus === 'ignored') {
        d._ignoredCount = (d._ignoredCount||0) + 1;
      } else if (d._lastStatus === 'followed') {
        d._followedCount = (d._followedCount||0) + 1;
      } else if (d._lastStatus === 'partial') {
        d._partialCount = (d._partialCount||0) + 1;
      }
      G._turnReport.push({ type: 'directive_compliance', id: r.id, status: r.status, reason: r.reason, evidence: r.evidence, turn: G.turn||0 });
    });
    // 未回报的 rule 类指令也标记为 unchecked （避免以为被遵守）
    G._playerDirectives.forEach(function(d){
      if (!d || !d.id) return;
      var reported = reports.some(function(r){return r && r.id===d.id;});
      if (!reported && d.type === 'rule' && d._lastCheckTurn !== G.turn) {
        d._lastStatus = 'unchecked';
        d._lastCheckTurn = G.turn || 0;
      }
    });
    // 合规处理完·清理本回合标记的一次性 directive（纠正类执行后移除）
    G._playerDirectives = G._playerDirectives.filter(function(d){
      return !(d && d._pendingRemovalAfterApply);
    });
  }
  global._applyDirectiveCompliance = _applyDirectiveCompliance;

  // 赤字深度等级：返回 tier 对应的惩罚倍率（越深越重）
  function _deficitTier(amount, scaleMoney) {
    var deep = Math.abs(amount);
    var pct = deep / Math.max(1, scaleMoney);
    if (pct < 0.1) return { tier: 1, label: '微亏', mult: 1 };       // <10%
    if (pct < 0.3) return { tier: 2, label: '告急', mult: 2 };        // 10-30%
    if (pct < 0.8) return { tier: 3, label: '空虚', mult: 4 };        // 30-80%
    if (pct < 2) return { tier: 4, label: '债台高筑', mult: 7 };      // 80-200%
    return { tier: 5, label: '民穷财尽', mult: 12 };                   // >200%
  }

  function _applyFiscalDeficitPenalties(G) {
    if (!G) return;
    var pens = [];
    // 规模参考：用岁入作 baseline（无则 fallback）
    var monthIn = (G.guoku && (G.guoku.monthlyIncome || G.guoku.turnIncome)) || 100000;
    var scaleMoney = Math.max(100000, monthIn * 12);   // 年入作比例基准
    var scaleGrain = Math.max(50000, (G.guoku && G.guoku.monthlyGrainIncome || 10000) * 12);
    var scaleCloth = Math.max(20000, (G.guoku && G.guoku.monthlyClothIncome || 5000) * 12);

    function checkTreasury(targetName, targetObj) {
      if (!targetObj) return;
      var checks = [
        { res:'money', scale:scaleMoney, label:'银' },
        { res:'grain', scale:scaleGrain, label:'粮' },
        { res:'cloth', scale:scaleCloth, label:'布' }
      ];
      checks.forEach(function(ck){
        var v = Number(targetObj[ck.res]);
        if (typeof v !== 'number' || isNaN(v) || v >= 0) return;
        var t = _deficitTier(v, ck.scale);
        pens.push({ target: targetName, resource: ck.res, label: ck.label, tier: t.tier, tierLabel: t.label, amount: v, mult: t.mult });
      });
    }
    checkTreasury('guoku', G.guoku);
    checkTreasury('neitang', G.neitang);
    if (pens.length === 0) return;

    // 汇总倍率（多项赤字累加·累加封顶 ×3）
    var totalMult = 0;
    pens.forEach(function(p){ totalMult += p.mult; });
    totalMult = Math.min(totalMult, 36);

    // 应用到各系统
    // 1) 皇威（真实值）
    if (!G._huangweiState) G._huangweiState = { index: 70 };
    var hwPenalty = Math.round(totalMult * 0.25);  // tier1:-0.25~ tier5:-3
    G._huangweiState.index = Math.max(0, (Number(G._huangweiState.index)||70) - hwPenalty);
    // 2) 民心
    if (!G._minxinState) G._minxinState = { index: 60 };
    var mxPenalty = Math.round(totalMult * 0.3);
    G._minxinState.index = Math.max(0, (Number(G._minxinState.index)||60) - mxPenalty);
    // 3) 动乱
    G.unrest = Math.min(100, (Number(G.unrest)||0) + Math.round(totalMult * 0.4));
    // 4) 吏治 (corruption 上升·越穷越腐)
    if (G._corruptionState) {
      G._corruptionState.index = Math.min(100, (Number(G._corruptionState.index)||0) + Math.round(totalMult * 0.15));
    }
    // 5) 军心（NPC 将领忠诚 -1~-3）—— 仅 tier3+ 才影响武将
    if (pens.some(function(p){return p.tier >= 3;}) && Array.isArray(G.chars)) {
      G.chars.forEach(function(c){
        if (!c || c.alive === false) return;
        var isMilitary = (c.military||0) > 60 || /\u519B|\u5C06|\u5E05|\u53F2/.test(c.officialTitle||'');
        if (isMilitary && typeof c.loyalty === 'number') {
          c.loyalty = Math.max(0, c.loyalty - Math.round(totalMult * 0.08));
        }
      });
    }
    // 6) 粮亏独立加成：饥荒事件概率 + 人口逃散
    var grainDef = pens.find(function(p){return p.resource==='grain' && p.tier>=2;});
    if (grainDef && G.population && G.population.national) {
      var fugitives = Math.round((G.population.national.mouths||0) * 0.002 * grainDef.mult);
      G.population.fugitives = (Number(G.population.fugitives)||0) + fugitives;
      G.population.national.mouths = Math.max(0, (G.population.national.mouths||0) - fugitives);
    }
    // 登记事件
    if (!G._turnReport) G._turnReport = [];
    G._turnReport.push({
      type: 'fiscal_deficit',
      penalties: pens,
      totalMult: totalMult,
      appliedTo: { huangwei: -hwPenalty, minxin: -mxPenalty, unrest: Math.round(totalMult*0.4), corruption: Math.round(totalMult*0.15) },
      turn: G.turn || 0
    });
    // 累计告警（连续赤字计数）
    if (!G._fiscalDeficitStreak) G._fiscalDeficitStreak = 0;
    G._fiscalDeficitStreak++;
    if (G._fiscalDeficitStreak >= 3) {
      // 持续 3+ 回合赤字：弹窗+重大告警
      if (typeof global.addEB === 'function') global.addEB('\u8D22\u653F\u2757\u2757', '\u8D4C\u7A7A\u7EE7\u7EED ' + G._fiscalDeficitStreak + ' \u56DE\u5408\uFF01\u7687\u5A01 -' + hwPenalty + ' \u6C11\u5FC3 -' + mxPenalty + ' \u52A8\u4E71+' + Math.round(totalMult*0.4));
    } else {
      if (typeof global.addEB === 'function') global.addEB('\u8D22\u653F\u2757', '\u56FD\u5EAA\u8D64\u5B57\uFF01' + pens.map(function(p){return p.label+p.tierLabel;}).join('\u3001') + ' \u2192 \u7687\u5A01-' + hwPenalty + ' \u6C11\u5FC3-' + mxPenalty);
    }
  }
  // 若连续两回合均未赤字·streak 归零（入口：某处定期重置）
  function _resetDeficitStreakIfHealthy(G) {
    if (!G) return;
    var anyDef = false;
    ['money','grain','cloth'].forEach(function(r){
      if (G.guoku && (Number(G.guoku[r])||0) < 0) anyDef = true;
      if (G.neitang && (Number(G.neitang[r])||0) < 0) anyDef = true;
    });
    if (!anyDef) G._fiscalDeficitStreak = 0;
  }
  global._applyFiscalDeficitPenalties = _applyFiscalDeficitPenalties;
  global._resetDeficitStreakIfHealthy = _resetDeficitStreakIfHealthy;

  // ═══════════════════════════════════════════════════════════════════
  //  路程估算（v3·仅作 AI 未指定天数时的保底·AI 应据历史地理知识自行给出）
  // ═══════════════════════════════════════════════════════════════════
  // AI 在 char_updates.travelTo.estimatedDays / office_assignments.estimatedDays
  // 中须自行根据历史地理知识估算·考虑：
  //   · 两地实际直线/路程距离
  //   · 朝代交通条件（马车/驿传/漕船/官船/赴任规制）
  //   · 季节（冬春河冻/春秋正季/夏季酷暑）
  //   · 人员身份（大员驿传优先/庶民步行/军队缓行）
  //   · 是否征召紧急（急召加速/常规徐行）
  // 此函数仅在 AI 未给出天数时返回粗略保底（以免 travelRemainingDays 为 0 立即到达）
  function _estimateTravelDays(from, to) {
    if (!from || !to) return 20;
    if (from === to) return 0;
    return 20;  // 保底·实际天数由 AI 填入
  }

  // ═══════════════════════════════════════════════════════════════════
  //  回合报告 · 史记弹窗
  // ═══════════════════════════════════════════════════════════════════

  function generateTurnReport(turn) {
    var G = global.GM;
    if (!G._turnReport) return { empty: true };
    var thisTurn = turn || (G.turn - 1) || G.turn || 0;
    var items = G._turnReport.filter(function(r){return r.turn === thisTurn;});
    if (items.length === 0) return { empty: true };

    var byType = {};
    items.forEach(function(it) {
      if (!byType[it.type]) byType[it.type] = [];
      byType[it.type].push(it);
    });

    return {
      turn: thisTurn,
      narrative: (byType.narrative || []).map(function(n){return n.text;}),
      changes: byType.change || [],
      appointments: byType.appointment || [],
      institutions: byType.institution || [],
      regions: byType.region || [],
      events: byType.event || [],
      npcActions: byType.npc_action || [],
      relations: byType.relation || []
    };
  }

  function renderTurnReport(turn) {
    var rep = generateTurnReport(turn);
    if (rep.empty) return '';
    var html = '<div style="font-family:inherit;">';
    html += '<div style="font-size:1.0rem;color:var(--gold);margin-bottom:0.6rem;">回合 ' + rep.turn + ' 纪要</div>';

    if (rep.narrative.length > 0) {
      html += '<section style="padding:6px 10px;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:8px;font-size:0.82rem;line-height:1.8;">';
      rep.narrative.forEach(function(n){ html += '<div>' + _esc(n) + '</div>'; });
      html += '</section>';
    }

    if (rep.changes.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【变数】</div>';
      rep.changes.forEach(function(c) {
        var delta = c.delta !== undefined ? (c.delta>=0?'+':'') + c.delta : '';
        var oldV = c.old !== undefined ? _fmt(c.old) + ' → ' + _fmt(c.new) : _fmt(c.new);
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· <code>' + _esc(c.path) + '</code>：' + oldV + (delta?' ('+delta+')':'') + (c.reason?' · '+_esc(c.reason):'') + '</div>';
      });
    }
    if (rep.appointments.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【任免】</div>';
      rep.appointments.forEach(function(a) {
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + ({appoint:'擢',dismiss:'罢',transfer:'调'}[a.action]||a.action) + ' <b>' + _esc(a.charName) + '</b>' + (a.position?' 为 '+_esc(a.position):'') + '</div>';
      });
    }
    if (rep.institutions.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【新制·裁撤】</div>';
      rep.institutions.forEach(function(i) {
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + (i.action==='create'?'设':'废') + ' <b>' + _esc(i.name) + '</b></div>';
      });
    }
    if (rep.regions.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【区划】</div>';
      rep.regions.forEach(function(r) {
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· <b>' + _esc(r.id) + '</b> 改为 ' + _esc(r.newType) + '</div>';
      });
    }
    if (rep.events.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【朝堂事件】</div>';
      rep.events.forEach(function(e) {
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· [' + _esc(e.category) + '] ' + _esc(e.text) + '</div>';
      });
    }
    if (rep.npcActions.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【NPC 行动】</div>';
      rep.npcActions.forEach(function(a) {
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + _esc(a.actor) + '：' + _esc(a.action) + (a.targets ? '（' + a.targets.map(function(t){return _esc(t);}).join('、') + '）' : '') + '</div>';
      });
    }
    if (rep.relations.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【关系变动】</div>';
      rep.relations.forEach(function(r) {
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + _esc(r.actor) + ' → ' + _esc(r.target) + ' ' + _esc(r.interaction) + '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function _fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e8) return (n/1e8).toFixed(2) + '亿';
    if (abs >= 1e4) return (n/1e4).toFixed(1) + '万';
    return Math.round(n).toLocaleString();
  }
  // R143·委托给 tm-utils.js:569 的 escHtml
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')); }

  // ═══════════════════════════════════════════════════════════════════
  //  AI Prompt 上下文（注入七变量+NPC+关系网）
  // ═══════════════════════════════════════════════════════════════════

  function buildFullAIContext() {
    var G = global.GM;
    if (!G) return {};
    var ctx = {
      turn: G.turn, year: G.year, month: G.month,
      dynasty: G.dynasty,
      variables: {
        huangwei: _getVarState(G.huangwei),
        huangquan: _getVarState(G.huangquan),
        minxin: _getVarState(G.minxin),
        guoku: G.guoku ? { money: G.guoku.money, grain: G.guoku.grain, cloth: G.guoku.cloth, annualIncome: G.guoku.annualIncome } : null,
        neitang: G.neitang ? { money: G.neitang.money, huangzhuangAcres: G.neitang.huangzhuangAcres } : null,
        population: G.population ? { national: G.population.national, fugitives: G.population.fugitives, hiddenCount: G.population.hiddenCount } : null,
        corruption: _getVarState(G.corruption)
      },
      npcs: _getImportantNpcs(G),
      factions: G.facs || [],
      recentEvents: _getRecentEvents(G),
      pendingMemorials: (G._pendingMemorials||[]).length,
      activeRevolts: G.minxin && G.minxin.revolts ? G.minxin.revolts.filter(function(r){return r.status==='ongoing';}).length : 0,
      // 本回合待反应事件（NPC 按自身人格自主决定行为，非硬查表）
      pendingEventReactions: G._pendingEventReactions || [],
      eventReactionPromptText: (typeof global.buildEventReactionPrompt === 'function') ? global.buildEventReactionPrompt() : ''
    };
    return ctx;
  }

  function _getVarState(v) {
    if (!v) return null;
    if (typeof v === 'number') return { value: v };
    return {
      index: v.index || v.trueIndex || v.overall,
      perceivedIndex: v.perceivedIndex,
      phase: v.phase,
      subDims: v.subDims,
      tyrantSyndrome: v.tyrantSyndrome && v.tyrantSyndrome.active,
      lostCrisis: v.lostAuthorityCrisis && v.lostAuthorityCrisis.active,
      powerMinister: v.powerMinister
    };
  }

  function _getImportantNpcs(G) {
    if (!G.chars) return [];
    // 官职公库查找：O(officeTree) 建索引
    var posByName = {};
    var _walkOT = function(nodes){ (nodes||[]).forEach(function(n){
      (n.positions||[]).forEach(function(p){ if (p && p.name) posByName[p.name] = p; });
      if (n.subs) _walkOT(n.subs);
    }); };
    _walkOT(G.officeTree || []);
    return G.chars.filter(function(c) {
      return c.alive !== false && (c.officialTitle || (c.rank && c.rank <= 4));
    }).slice(0, 30).map(function(c) {
      var topRel = (typeof global.getTopRelations === 'function') ? global.getTopRelations(c.name, 3) : [];
      var posMeta = posByName[c.officialTitle];
      var pubTreasuryBinding = c.resources && c.resources.publicTreasury && c.resources.publicTreasury.binding;
      var pubTreasury = null;
      if (pubTreasuryBinding && typeof _resolveBinding === 'function') {
        try {
          var ent = _resolveBinding(pubTreasuryBinding);
          if (ent && ent.publicTreasury) {
            pubTreasury = {
              binding: pubTreasuryBinding,
              money: ent.publicTreasury.money && ent.publicTreasury.money.stock,
              grain: ent.publicTreasury.grain && ent.publicTreasury.grain.stock,
              deficit: ent.publicTreasury.money && ent.publicTreasury.money.deficit
            };
          }
        } catch (_e) { if(window.TM&&TM.errors) TM.errors.capture(_e,'applier.pubTreasury'); }
      }
      return {
        name: c.name, title: c.officialTitle, rank: c.rank, faction: c.faction,
        loyalty: c.loyalty, ambition: c.ambition, integrity: c.integrity,
        region: c.region,
        topRelations: topRel,
        // 官职元数据（深化字段）—— AI 推演 NPC 行为参考
        positionMeta: posMeta ? {
          bindingHint: posMeta.bindingHint,
          powers: posMeta.powers,
          hooks: posMeta.hooks,
          illicitRisk: posMeta.privateIncome && posMeta.privateIncome.illicitRisk
        } : null,
        publicTreasury: pubTreasury,
        // 私产：便于 AI 判断动机
        privateWealth: c.resources && c.resources.private ? {
          money: c.resources.private.money,
          land: c.resources.private.landAcres
        } : null
      };
    });
  }

  function _getRecentEvents(G) {
    if (!G._eventBus) return [];
    return (G._eventBus.items || []).slice(-20);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  角色路程推进·到达自动就任（AI 至高权力·Step 4）
  //  每回合调用 · daysPassed = P.time.daysPerTurn
  // ═══════════════════════════════════════════════════════════════════
  function advanceCharTravelByDays(daysPassed) {
    var G = global.GM;
    if (!G || !Array.isArray(G.chars) || !(daysPassed > 0)) return { arrived: 0, inflight: 0 };
    var arrived = 0, inflight = 0;
    var dateText = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));

    G.chars.forEach(function(ch) {
      if (!ch || !ch._travelTo) return;
      // 用天数系统
      if (typeof ch._travelRemainingDays === 'number') {
        ch._travelRemainingDays -= daysPassed;
        if (ch._travelRemainingDays > 0) { inflight++; return; }
      } else if (typeof ch._travelArrival === 'number') {
        // 旧版回合系统兼容：未到回合则继续
        if ((G.turn || 0) < ch._travelArrival) { inflight++; return; }
      }

      // —— 到达 ——
      var fromLoc = ch._travelFrom || '';
      var toLoc = ch._travelTo;
      var assignPost = ch._travelAssignPost || '';
      var reason = ch._travelReason || '';

      ch.location = toLoc;

      // 自动就任·仅当 _travelAssignPost 存在
      if (assignPost) {
        var dept = '', post = assignPost;
        if (assignPost.indexOf('/') >= 0) {
          var parts = assignPost.split('/');
          dept = parts[0] || '';
          post = parts.slice(1).join('/') || '';
        }
        try {
          var r = onAppointment(ch.name, post, { dept: dept });
          if (r && r.ok) {
            if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
            ch.careerHistory.push({
              turn: G.turn || 0,
              date: dateText,
              title: post,
              dept: dept,
              action: 'appoint',
              location: toLoc,
              reason: (reason || '') + '·赴任抵达'
            });
          }
        } catch(_appE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_appE, 'travelTick] auto-appoint') : console.warn('[travelTick] auto-appoint', _appE); }
      }

      // 播报
      if (typeof global.addEB === 'function') {
        if (assignPost) {
          global.addEB('\u4EBA\u4E8B', ch.name + ' \u62B5 ' + toLoc + '\u00B7\u5C31\u4EFB ' + (assignPost.replace('/', ' ')));
        } else {
          global.addEB('\u4EBA\u4E8B', ch.name + ' \u5DF2\u62B5\u8FBE ' + toLoc);
        }
      }
      if (G.qijuHistory) {
        G.qijuHistory.unshift({
          turn: G.turn || 0,
          date: dateText,
          content: '\u3010\u5165\u5883\u3011' + ch.name + ' \u81EA' + (fromLoc || '\u8FDC\u65B9') + ' \u62B5 ' + toLoc
                 + (assignPost ? '\uFF0C\u5373\u65E5\u5C31\u4EFB ' + assignPost.replace('/', ' ') : '') + '\u3002'
        });
      }
      // ★ 编年·抵达条
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.unshift({
        turn: G.turn || 0,
        date: dateText,
        type: '\u8D74\u4EFB\u62B5\u8FBE',
        title: ch.name + ' \u62B5 ' + toLoc,
        content: ch.name + ' \u81EA' + (fromLoc || '\u8FDC\u65B9') + ' \u62B5 ' + toLoc + (assignPost ? '\u00B7\u5373\u65E5\u5C31\u4EFB ' + assignPost.replace('/', ' ') : '') + '\u3002',
        category: '\u4EBA\u4E8B', tags: ['人事', '赴任', '抵达', ch.name]
      });
      if (typeof global.toast === 'function') {
        global.toast(ch.name + ' 抵达 ' + toLoc + (assignPost ? '·就任' + assignPost.replace('/', ' ') : ''), 'info');
      }

      // 清理走位字段
      delete ch._travelTo;
      delete ch._travelFrom;
      delete ch._travelStartTurn;
      delete ch._travelRemainingDays;
      delete ch._travelArrival;
      delete ch._travelReason;
      delete ch._travelAssignPost;

      // 写入本回合报告（供史记读取）
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type:'travel_arrived', char: ch.name, to: toLoc, assignPost: assignPost, turn: G.turn || 0 });
      arrived++;
    });

    return { arrived: arrived, inflight: inflight };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.AIChangeApplier = {
    applyAITurnChanges: applyAITurnChanges,
    onAppointment: onAppointment,
    onDismissal: onDismissal,
    onTransfer: onTransfer,
    registerInstitution: registerInstitution,
    abolishInstitution: abolishInstitution,
    reclassifyRegion: reclassifyRegion,
    resolveBinding: _resolveBinding,
    ensurePublicTreasury: _ensurePublicTreasury,
    applyPathDelta: _applyPathDelta,
    applyPathSet: _applyPathSet,
    generateTurnReport: generateTurnReport,
    renderTurnReport: renderTurnReport,
    buildFullAIContext: buildFullAIContext,
    advanceCharTravelByDays: advanceCharTravelByDays,
    VERSION: 1
  };

  // 全局快捷
  global.applyAITurnChanges = applyAITurnChanges;
  global.onAppointment = onAppointment;
  global.onDismissal = onDismissal;
  global._resolveBinding = _resolveBinding;
  global.renderTurnReport = renderTurnReport;
  global.buildFullAIContext = buildFullAIContext;
  global.advanceCharTravelByDays = advanceCharTravelByDays;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
