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

  // ── 拆自 Slice 1·pathutils 模块·绑回原名以保留 §4-§35 callsite ──
  var _PathUtils = (global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils) || null;
  if (!_PathUtils) console.warn('[ai-change-applier] TM.AIChange.PathUtils not loaded·legacy aliases will be null');
  var _resolvePath              = _PathUtils && _PathUtils.resolvePath;
  var _normalizeCoreVarPath     = _PathUtils && _PathUtils.normalizeCoreVarPath;
  var _syncCoreVarSideEffects   = _PathUtils && _PathUtils.syncCoreVarSideEffects;
  var _deriveLabel              = _PathUtils && _PathUtils.deriveLabel;
  var _findDivisionByNameOrId   = _PathUtils && _PathUtils.findDivisionByNameOrId;
  var _findInTreeDeep           = _PathUtils && _PathUtils.findInTreeDeep;
  var _recordCharChange         = _PathUtils && _PathUtils.recordCharChange;
  var _recordToTurnChanges      = _PathUtils && _PathUtils.recordToTurnChanges;
  var _applyPathDelta           = _PathUtils && _PathUtils.applyPathDelta;
  var _applyPathSet             = _PathUtils && _PathUtils.applyPathSet;
  var _applyPathPush            = _PathUtils && _PathUtils.applyPathPush;
  var _isPathBlocked            = _PathUtils && _PathUtils.isPathBlocked;
  // ── 拆自 Slice 2·army 模块·绑回原名以保留 §4-§35 callsite ──
  var _Army = (global.TM && global.TM.AIChange && global.TM.AIChange.Army) || null;
  if (!_Army) console.warn('[ai-change-applier] TM.AIChange.Army not loaded·legacy army aliases will be null');
  var applyAIArmyChange                    = _Army && _Army.applyAIArmyChange;
  var _applyAIArmyChangeList               = _Army && _Army.applyAIArmyChangeList;
  var _clampNum                            = _Army && _Army.clampNum;
  var _normalizeArmyKey                    = _Army && _Army.normalizeArmyKey;
  var _findArmyForAIChange                 = _Army && _Army.findArmyForAIChange;
  var _refreshMilitaryViews                = _Army && _Army.refreshMilitaryViews;
  var _armyLooseNamePattern                = _Army && _Army.armyLooseNamePattern;
  var _armyNarrativeAliases                = _Army && _Army.armyNarrativeAliases;
  var _resolveNarrativeCommanderName       = _Army && _Army.resolveNarrativeCommanderName;
  var _applyNarrativeArmyCommanderFallback = _Army && _Army.applyNarrativeArmyCommanderFallback;
  // ── 拆自 Slice 3·narrative 模块·绑回原名以保留 §4-§35 callsite ──
  var _Narrative = (global.TM && global.TM.AIChange && global.TM.AIChange.Narrative) || null;
  if (!_Narrative) console.warn('[ai-change-applier] TM.AIChange.Narrative not loaded·legacy narrative aliases will be null');
  var _mergeUpdatesToEntity              = _Narrative && _Narrative.mergeUpdatesToEntity;
  var _applyNarrativeArmyFieldFallback   = _Narrative && _Narrative.applyNarrativeArmyFieldFallback;
  var _applyNarrativeRegionFieldFallback = _Narrative && _Narrative.applyNarrativeRegionFieldFallback;
  var _applyNarrativeFactionFieldFallback= _Narrative && _Narrative.applyNarrativeFactionFieldFallback;

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

  function _ensurePublicTreasuryResource(entity, resource) {
    var treasury = _ensurePublicTreasury(entity);
    if (!treasury) return null;
    if (!treasury[resource]) treasury[resource] = { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 };
    return treasury[resource];
  }

  function _readFiscalStock(target, resource) {
    if (!target) return 0;
    if (target.stock !== undefined || target.available !== undefined || target.quota !== undefined || target.deficit !== undefined) {
      if (target.stock !== undefined) return Number(target.stock) || 0;
      return Number(target.available) || 0;
    }
    if (resource === 'money') {
      if (target.money !== undefined) return Number(target.money) || 0;
      if (target.balance !== undefined) return Number(target.balance) || 0;
    }
    return Number(target[resource]) || 0;
  }

  function _writeFiscalStock(target, resource, value) {
    if (!target) return;
    value = Number(value) || 0;
    if (target.stock !== undefined || target.available !== undefined || target.quota !== undefined || target.deficit !== undefined) {
      target.stock = value;
      if (target.available !== undefined) target.available = value;
      return;
    }
    target[resource] = value;
    if (resource === 'money') target.balance = value;
    if (target.ledgers && target.ledgers[resource]) {
      target.ledgers[resource].stock = value;
    }
  }

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

  // 判定 position 是否为「既有职种」(officeTree 无此座时·区分"合法地方/未列职"[保留衔] vs "AI 杜撰穿越职"[回滚幽灵衔])。
  //   ① 跨朝代通用职种后缀(尚书/巡抚/总督等历代常见官职**类型**·非内阁/票拟/司礼监类单朝特例·与赴任正则同源·兜稀疏剧本)
  //   ② 数据驱动:职种后缀与本剧本既有角色官衔/officeTree 节点同种(剧本自有词汇·朝代中立)。任一命中即视为真职种。
  function _isKnownOfficeType(G, position) {
    var p = String(position || '');
    if (p.length < 2) return false;
    if (/(尚书|侍郎|郎中|主事|员外郎|巡抚|巡按|总督|督师|经略|总兵|提督|镇守|总镇|参将|游击|守备|布政使|按察使|都指挥|知府|知州|知县|同知|通判|刺史|太守|节度|观察使|防御使|团练使|学士|大学士|御史|给事中|寺卿|少卿|詹事|府尹|州牧|总理|总管|留守|宣慰使|宣抚使|安抚使|招讨使|经历司)$/.test(p)) return true;
    var sufs = [p.slice(-2)]; if (p.length >= 3) sufs.push(p.slice(-3));
    var pool = [];
    try { ((G && G.chars) || []).forEach(function (c) { if (!c) return; if (c.officialTitle) pool.push(String(c.officialTitle)); if (Array.isArray(c.officialTitles)) c.officialTitles.forEach(function (t) { if (t) pool.push(String(t)); }); }); } catch (_e1) {}
    try { (function walk(nodes) { (nodes || []).forEach(function (n) { if (!n) return; if (n.name) pool.push(String(n.name)); if (Array.isArray(n.positions)) n.positions.forEach(function (pp) { if (pp && pp.name) pool.push(String(pp.name)); }); if (Array.isArray(n.subs)) walk(n.subs); }); })((G && G.officeTree) || []); } catch (_e2) {}
    return pool.some(function (t) { return t && t !== p && sufs.some(function (s) { return s.length >= 2 && t.indexOf(s) >= 0; }); });
  }

  function onAppointment(charName, position, binding) {
    var G = global.GM;
    var ch = _findChar(charName);
    if (!ch) return { ok: false, reason: '未找到角色 ' + charName };
    var isConcurrent = (typeof global._offIsConcurrentAppointment === 'function')
      ? global._offIsConcurrentAppointment(binding || {}, position)
      : !!(binding && (binding.concurrent || binding.mode === 'concurrent'));
    // 解绑旧
    var oldBinding = ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.binding;
    if (!isConcurrent && oldBinding) {
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
    if (isConcurrent && binding) {
      if (!Array.isArray(ch.resources.publicTreasury.concurrentBindings)) ch.resources.publicTreasury.concurrentBindings = [];
      ch.resources.publicTreasury.concurrentBindings.push(binding);
    } else {
      ch.resources.publicTreasury.binding = binding || null;
    }
    var _preApptTitle = ch.officialTitle || '';  // remember pre-appointment title, to roll back if the office turns out not to exist
    if (position) {
      if (typeof global._offAddCharOfficeTitle === 'function') {
        global._offAddCharOfficeTitle(ch, position, { concurrent: isConcurrent });
      } else if (!isConcurrent || !ch.officialTitle) {
        ch.officialTitle = position;
      }
    }
    if (position && ch.currentPosition && !isConcurrent) ch.currentPosition.title = position;

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
      if (!isConcurrent) _clearOldHolders(G.officeTree || []);
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
            // 单一真相源·robust 让位:啰嗦/异写旧衔精确相等清不掉→ghost·按座撤衔(回退精确)
            var _vac2 = (prevCh2 && typeof global._offVacateCharFromSeat === 'function') && global._offVacateCharFromSeat(prevCh2, (hit.node && hit.node.name) || '', pos.name || position);
            if (!_vac2 && prevCh2 && typeof global._offRemoveCharOfficeTitle === 'function') {
              global._offRemoveCharOfficeTitle(prevCh2, pos.name || position);
              if (position && position !== pos.name) global._offRemoveCharOfficeTitle(prevCh2, position);
            } else if (!_vac2 && prevCh2 && (prevCh2.officialTitle === pos.name || prevCh2.officialTitle === position)) {
              prevCh2.officialTitle = '';
              prevCh2.title = ''; // 同步·否则被逐出者 title 仍是旧官职·廷议回退显示
            }
            if (!Array.isArray(pos.holderHistory)) pos.holderHistory = [];
            pos.holderHistory.push({ name: removed2.name, since: removed2.joinedTurn||0, until: G.turn||0, reason: '额满·最老者罢黜' });
            if (global.addEB) global.addEB('\u4EFB\u514D', pos.name + ' \u989D\u6EE1\uFF08' + cap + '\u4EBA\uFF09\u2014\u2014' + removed2.name + ' \u7F62');
          }
          pos.actualHolders.push({ name: charName, joinedTurn: G.turn||0 });
        }
        // 同步 primary holder（兼容旧 UI 只读 holder 字段）
        pos.holder = (pos.actualHolders[0] && pos.actualHolders[0].name) || charName;
        pos.holderSinceTurn = (pos.actualHolders[0] && pos.actualHolders[0].joinedTurn) || (G.turn || 0);
        if (typeof _offMigratePosition === 'function') _offMigratePosition(pos);
        if (Array.isArray(pos.actualHolders)) {
          var _namedSync = pos.actualHolders.filter(function(h){ return h && h.name && h.generated !== false; }).map(function(h){ return h.name; });
          pos.holder = _namedSync[0] || charName;
          pos.additionalHolders = _namedSync.slice(1);
          var _estSync = pos.establishedCount != null ? parseInt(pos.establishedCount, 10) : (parseInt(pos.headCount, 10) || Math.max(1, _namedSync.length));
          pos.vacancyCount = Math.max(0, _estSync - _namedSync.length);
          pos.actualCount = Math.max(pos.actualHolders.length, _namedSync.length);
        }
        treeUpdated = true;
        // 修正 ch.officialTitle 为树里的规范名称
        if (pos.name && pos.name !== position) {
          if (typeof global._offRemoveCharOfficeTitle === 'function') global._offRemoveCharOfficeTitle(ch, position);
          if (typeof global._offAddCharOfficeTitle === 'function') global._offAddCharOfficeTitle(ch, pos.name, { concurrent: isConcurrent });
          else ch.officialTitle = pos.name;
        }
        // 同时同步公库绑定到该位（若编辑器 position 有 bindingHint）
        if (!binding && pos.bindingHint) {
          ch.resources.publicTreasury.binding = { dept: hit.node.name, position: pos.name, hint: pos.bindingHint };
        }
      } else if (_isKnownOfficeType(G, position)) {
        // office tree \u65E0\u6B64\u5EA7\u00B7\u4F46\u300C\u804C\u79CD\u300D\u5267\u672C\u65E2\u6709(\u5E38\u89C1\u5730\u65B9\u804C:\u7763\u5E08/\u603B\u7763/\u5DE1\u629A\u7B49\u00B7\u53EA\u662F\u4E0D\u5728\u672C\u5267\u672C\u4E2D\u592E officeTree \u8282\u70B9\u91CC)\u3002
        //   \u5B98\u8854\u5DF2\u5728\u4E0A\u65B9 _offAddCharOfficeTitle \u8BB0\u4E8E\u89D2\u8272\u8868 officialTitle\u00B7\u6B64\u5904**\u4FDD\u7559**(\u6811\u65E0\u5EA7\u4F46\u4EBA\u6709\u8854)\u2014\u2014\u6CBB\u771F\u673A\u902E\u7684"\u5730\u65B9\u804C\u4EFB\u547D\u540E\u5B98\u8854\u7A7A/\u88AB\u5F53\u5E7D\u7075\u56DE\u6EDA"\u3002
        if (ch.currentPosition && !isConcurrent && ch.currentPosition.title !== position) ch.currentPosition.title = position;
        if (global.addEB) global.addEB('\u4EFB\u514D', '\u5B98\u5236\u6811\u65E0\u300C' + position + '\u300D\u8282\u70B9\uFF08\u5730\u65B9/\u672A\u5217\u804C\u00B7\u804C\u79CD\u5DF2\u6709\uFF09\u00B7\u8854\u8BB0\u4E8E\u89D2\u8272\u8868 officialTitle');
      } else {
        // office tree \u65E0\u6B64\u5EA7 \u4E14 \u804C\u79CD\u5267\u672C\u67E5\u65E0 \u2192 \u7591 AI \u675C\u64B0/\u7A7F\u8D8A\u804C(\u5982"\u5B87\u5B99\u8230\u961F\u53F8\u4EE4"):\u56DE\u6EDA\u5E7D\u7075\u8854(\u53CD\u7A7F\u8D8A\u5B88\u536B)\u00B7\u52FF\u7559\u5728\u771F\u4EBA\u8EAB\u4E0A\u3002
        if (typeof global._offRemoveCharOfficeTitle === 'function') { try { global._offRemoveCharOfficeTitle(ch, position); } catch (_gh) {} }
        if (ch.officialTitle === position) ch.officialTitle = _preApptTitle;
        if (ch.currentPosition && ch.currentPosition.title === position) ch.currentPosition.title = _preApptTitle;
        if (global.addEB) global.addEB('\u4EFB\u514D\u203B', '\u5B98\u5236\u65E0\u300C' + position + '\u300D\u4E00\u804C\uFF08\u804C\u79CD\u5267\u672C\u67E5\u65E0\u00B7\u7591\u675C\u64B0\uFF09\u00B7\u56DE\u6EDA\u5E7D\u7075\u8854');
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
    var _newLv = null;
    try { if (global.TMPromotion && typeof global.TMPromotion.resolveRankLevel === 'function') { _newLv = global.TMPromotion.resolveRankLevel(ch, G); if (_newLv != null && _newLv >= 1 && _newLv <= 18) ch.rankLevel = _newLv; } } catch (_rlE) {}
    // 功名门槛(软):擢人到功名不配位的高品=骤擢幸进·按缺口档招言官清议+皇威损(玩家可越级强擢但有代价)·大员(政治区)更重。
    try {
      var _TPp = global.TMPromotion;
      if (_TPp && _newLv != null && !isConcurrent) {
        var _pen = _TPp.penaltyForGap(_TPp.meritFloor(_newLv) - ((ch.resources && ch.resources.virtueMerit) || 0));
        if (_pen.severity >= 2) {
          var _hwDelta = (_pen.severity === 3 ? -3 : -2) - (_TPp.isPoliticalZone(_newLv) ? 3 : 0);
          if (global.AuthorityEngines && typeof global.AuthorityEngines.adjustHuangwei === 'function') global.AuthorityEngines.adjustHuangwei('promotion_unqualified', _hwDelta, charName + ' 功名浅而骤擢·' + _pen.label);
          if (global.addEB) global.addEB('清议', '言官论 ' + charName + ' ' + _pen.label + '·功名未孚而骤膺重任·物议沸然');
        }
        // 出身天花板(硬):越出身典型上限擢用=破铨政名分·异途骤升清要尤遭物议·叠加皇威损+清议(独立于功名缺口)
        var _TG = global.TMGongming;
        var _cg = (_TG && _TG.ceilingGap) ? _TG.ceilingGap(ch, _newLv, G) : 0;
        if (_cg > 0) {
          var _og = (_TG && _TG.describe) ? _TG.describe(ch, G) : null;
          var _ohw = -Math.min(10, 3 + _cg * 2) - (_TPp.isPoliticalZone(_newLv) ? 2 : 0);
          if (global.AuthorityEngines && typeof global.AuthorityEngines.adjustHuangwei === 'function') global.AuthorityEngines.adjustHuangwei('promotion_overceiling', _ohw, charName + ' 出身' + (_og ? ('（' + _og.title + '）') : '') + '·越次逾品·名分有亏');
          if (global.addEB) global.addEB('清议', '言官劾 ' + charName + ' 出身' + (_og && _og.yi ? '异途' : '资浅') + '·骤膺逾品之任' + (_og && _og.qing === false && _TPp.isPoliticalZone(_newLv) ? '·玷污清班' : '') + '·清议大哗');
        }
      }
    } catch (_penE) {}
    // 身份转换：入仕/受封升阶（捐纳/科举→官身·世袭→勋贵）
    try { if (global.CharEconEngine && typeof global.CharEconEngine.reconcileSocialClassOnAppointment === 'function') global.CharEconEngine.reconcileSocialClassOnAppointment(ch); } catch (_scE) {}
    // ★ 赴任行程:官制/AI/agent 任命与诏书任命一致——远地受任者启动赴任(否则"官制任命后官员长期不赴任"·留原地有衔无人)。
    //   镜像 edict.js 诏书任命的赴任逻辑(目的地=职名含地名[巡抚/总兵/总督/督师/经略/节度/布政使/按察使/提督/镇守]取该地·否则京师);
    //   即时抵达规则在线(玩家"人事调动即刻抵达")或 0 日 → 当回合即抵(复用 _arriveCharNow·与移动 bug 修复同口径)·否则启多回合行程。
    try {
      if (position && !isConcurrent && ch.location && !ch._travelTo && typeof _sameTravelLocation === 'function') {
        var _apCap = (G && (G._capital || G.capital)) || '京师';
        var _apDest = _apCap;
        var _apRe = /([一-龥]{2,4})(?:巡抚|总兵|总督|督师|经略|节度|布政使|按察使|提督|镇守)/;
        var _apReg = String(position || '').match(_apRe);   // 先从职名取地名(陕西巡抚→陕西)·不拼 deptHint·防贪婪正则把部名也吞进去(吏部陕西巡抚→误吞"吏部陕西")
        if (!(_apReg && _apReg[1]) && deptHint) _apReg = String(deptHint).match(_apRe);   // 职名无地名·再独立查部名兜底
        if (_apReg && _apReg[1]) _apDest = _apReg[1];
        if (!_sameTravelLocation(ch.location, _apDest)) {
          var _apDays = (typeof _estimateTravelDays === 'function') ? _estimateTravelDays(ch.location, _apDest) : 20;
          var _apInstant = (typeof _hasInstantArrivalRule === 'function' && _hasInstantArrivalRule(G)) || !(_apDays > 0);
          ch._travelFrom = ch.location;
          ch._travelTo = _apDest;
          ch._travelReason = '奉诏赴任 ' + position;
          // ★ 不设 _travelAssignPost:onAppointment 已在上方完成完整就任(绑定/库银/官衔/officeTree holder)·
          //   此赴任仅为"纯迁地"·抵达时 _arriveCharNow 不应再调 onAppointment 重复就任(否则双重绑定/库银交接)。
          //   (对比 _offPickerConfirm/edict:它们只设 officeTree holder·完整就任本就靠抵达时 _arriveCharNow→onAppointment·故那两路需要 assignPost。)
          if (_apInstant && typeof _arriveCharNow === 'function') {
            _arriveCharNow(G, ch, (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0)));  // 即抵·到任
          } else {
            ch._travelStartTurn = G.turn || 0;
            ch._travelRemainingDays = _apDays;
            try { if (typeof _syncCharacterLocationMirrors === 'function') _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []); } catch (_smE) {}
            if (global.addEB) global.addEB('人事', charName + ' 奉诏赴 ' + _apDest + ' 就任 ' + position + '（预计 ' + _apDays + ' 日抵任）');
          }
        }
      }
    } catch (_apptTravelE) { try { console.warn('[onAppointment] 赴任行程启动失败(不阻断任命)', _apptTravelE); } catch (_) {} }
    return { ok: true, treeUpdated: treeUpdated, evicted: evicted };
  }

  // ── 下狱识别·单一真源(onDismissal/叙事校验器/migration 共用·防三处正则漂移) ──
  // 正面涵盖明代常见入狱说法·避开歧义裸字(监只用复合·廷尉/大理寺/镇抚司须下送)
  var _TM_IMPRISON_RE = /诏狱|下狱|入狱|系狱|系于狱|关押|羁押|拘押|拘禁|拘捕|拘系|缉拿|收押|收监|监禁|囚禁|囚系|牢狱|大牢|天牢|死牢|下牢|捉拿|逮捕|逮治|逮问|拿问|拿办|锁拿|械系|械送|槛车|下廷尉|下大理寺|下镇抚司|送镇抚司|镇抚司狱|打入(?:诏狱|大牢|天牢|死牢|牢|监|狱)|投入(?:诏狱|大牢|牢|监|狱)|关进(?:诏狱|大牢|牢|监|狱)|imprison|jail|prison/;
  // 否决:仅 AVOID 类复合(免于/幸免/未予…)·不含裸"免/不/未"(防误杀 免官下狱/免死下狱/不法下狱)·标点边界锁同句
  var _TM_IMPRISON_NEG_RE = /(?:免于|免遭|免被|免予|幸免|得免|获免|避免|以免|险些|差点|差些|未予|不予|未曾|未尝|从未|无须)(?:[^，。；！？、]{0,3})?(?:诏狱|下狱|入狱|系狱|逮捕|捉拿|缉拿|拘押|羁押|拘禁|收押|收监|监禁|囚禁|牢狱|大牢|镇抚司|槛车|锁拿|械系|拿问|逮治)|(?:未|不)(?:诏狱|下狱|入狱|系狱|逮捕)/;
  function _tmReasonIsImprison(reason) {
    var s = String(reason || '');
    return _TM_IMPRISON_RE.test(s) && !_TM_IMPRISON_NEG_RE.test(s);
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
        // 去职追亏：非善意去职(获罪/罢黜)且机构有亏空 → 向本人私产追偿（"追亏"传统）
        var _benign = /致仕|乞骸|归田|退休|乞归|休致|致政|退隐|retire|召回|起复|复职|平反|释放|开释|赦免|大赦|无罪|昭雪/.test(String(reason || ''));
        if (!_benign && global.CharEconEngine && typeof global.CharEconEngine.pursueTreasuryDeficit === 'function') {
          try {
            var _pr = global.CharEconEngine.pursueTreasuryDeficit(ch, entity);
            if (_pr && _pr.pursued > 0) {
              entity.publicTreasury.handoverLog.push({ turn: G.turn || 0, fromChar: charName, note: '追亏', pursued: _pr.pursued, deficitRemaining: _pr.deficitRemaining });
            }
          } catch (e) {}
        }
      }
    }
    if (ch.resources && ch.resources.publicTreasury) ch.resources.publicTreasury.binding = null;
    var _reasonStr = String(reason || '');
    // ★ 状态分级·根据 reason 关键字设置精确状态字段·让 chaoyi/wendui/shizheng UI 自动过滤
    // 死刑/处决 → alive=false; 下狱 → _imprisoned=true; 流放 → _exiled=true; 致仕 → _retired=true; 逃亡 → _fled=true
    // 2026-05-21·bug fix·原 regex 含单字「押」「拘」「逃」「遁」「匿」过宽·
    //   误判·押解/押粮/押司/签押/押韵/拘谨/拘泥/拘束/逃避/隐遁/匿名 等 → false positive
    //   改用必须的入狱/流放/逃亡 compound·并加 release/起复路径清 _imprisoned/_exiled/_fled
    if (/处决|斩首|诛杀|赐死|execute|凌迟|绞刑|死刑|枭首/.test(_reasonStr)) {
      ch.alive = false;
      ch._deathCause = _reasonStr;
      ch._deathTurn = G.turn || 0;
    } else if (/释放|开释|赦免|大赦|无罪|平反|昭雪|宽释|保释|出狱|赦出/.test(_reasonStr)) {
      // ★ 释放 / 赦免·清入狱状态
      ch._imprisoned = false;
      ch._releasedTurn = G.turn || 0;
      ch._releaseReason = _reasonStr;
    } else if (/召回|起复|复职|平反归朝/.test(_reasonStr)) {
      // ★ 召回·清流放/致仕/逃亡状态 (复出朝堂)
      if (ch._exiled || ch._retired || ch._fled || ch._missing) {
        ch._exiled = false;
        ch._retired = false;
        ch.retired = false;
        ch._fled = false;
        ch._missing = false;
        ch._recalledTurn = G.turn || 0;
        ch._recallReason = _reasonStr;
      }
    } else if (_tmReasonIsImprison(_reasonStr)) {
      ch._imprisoned = true;
      ch._imprisonedTurn = G.turn || 0;
      ch._imprisonReason = _reasonStr;
      // 同步官职状态：兵部尚书·下狱待决（不清官职·只标状态）
      if (ch.officialTitle && !/下狱/.test(ch.officialTitle)) ch._origOfficialTitle = ch.officialTitle;
    } else if (/流放|发配|戍边|充军|发配充军|遣戍|exile|banish/.test(_reasonStr)) {
      ch._exiled = true;
      ch._exileTurn = G.turn || 0;
      ch._exileReason = _reasonStr;
    } else if (/致仕|乞骸|归田|退休|乞归|休致|致政|退隐|retire/.test(_reasonStr)) {
      ch._retired = true;
      ch.retired = true;  // 兼容老字段
      ch._retireTurn = G.turn || 0;
    } else if (/逃亡|潜逃|出奔|外逃|失踪|不知所终|畏罪潜逃|flee|missing/.test(_reasonStr)) {
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
          if (removedFromArr || wasPrimary) {
            var namedAfterDismiss = Array.isArray(p.actualHolders)
              ? p.actualHolders.filter(function(h){ return h && h.name && h.generated !== false; }).map(function(h){ return h.name; })
              : (p.holder ? [p.holder] : []);
            p.holder = namedAfterDismiss[0] || '';
            p.additionalHolders = namedAfterDismiss.slice(1);
            var estAfterDismiss = p.establishedCount != null ? parseInt(p.establishedCount, 10) : (parseInt(p.headCount, 10) || Math.max(1, namedAfterDismiss.length));
            p.vacancyCount = Math.max(0, estAfterDismiss - namedAfterDismiss.length);
            p.actualCount = Array.isArray(p.actualHolders) ? p.actualHolders.length : namedAfterDismiss.length;
          }
        });
        if (Array.isArray(n.subs)) _clearAll(n.subs);
      });
    })(G.officeTree || []);
    ch.officialTitle = null;
    ch.position = '';
    ch.title = ''; // 同步描述性 title·否则免职后廷议等 `officialTitle||title` 回退仍显示原官职
    ch.officialTitles = [];
    ch.concurrentTitles = [];
    ch.concurrentTitle = '';
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

  function _aiPolicyText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function _aiPolicyAmount(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : (fallback || 0);
  }

  function _aiPolicyRegion(item) {
    item = item || {};
    return _aiPolicyText(item.regionName || item.region || item.target || item.regionId || item.province || '天下');
  }

  function _aiPolicyRatioLabel(value, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    if (!Number.isFinite(n)) n = 0.3;
    if (n <= 1) n = n * 10;
    n = Math.max(0, Math.min(10, Math.round(n)));
    return ['零','一','二','三','四','五','六','七','八','九','十'][n] || String(n);
  }

  function _aiStructuredPolicyText(field, item) {
    item = item || {};
    var explicit = _aiPolicyText(item.text || item.edictText || item.draftText || item.content || item.body);
    if (explicit) return explicit;
    var action = _aiPolicyText(item.action || item.type || item.kind || item.policyId).toLowerCase();
    var region = _aiPolicyRegion(item);
    var amount = _aiPolicyAmount(item.amount || item.money || item.silver, 0);

    if (field === 'currency_adjustments') {
      if (/full_currency_reform|currency_reform|silver_standard|coinage_reform/.test(action)) return '\u8bcf\u4ee4\uff1a\u63a8\u884c\u5b8c\u6574\u5e01\u5236\u6539\u9769\uff0c\u6821\u6b63\u94f6\u94b1\u6bd4\u4ef7\uff0c\u8d4b\u5f79\u6298\u94f6\uff0c\u4ee5\u5929\u4e0b\u4e00\u94b1\u6cd5\u3002';
      if (/regional_acceptance|paper_acceptance|acceptance/.test(action)) return '\u8bcf\u4ee4\uff1a\u4ee4' + region + '\u5148\u884c\u627f\u7528' + (item.paperName || item.name || '\u5b9d\u949e') + '\uff0c\u8bbe\u5151\u6362\u5b98\u5c40\uff0c\u7a33\u5176\u6c11\u95f4\u63a5\u53d7\u3002';
      if (/overseas_silver_flow|maritime_silver|silver_flow|overseas/.test(action)) return '\u8bcf\u4ee4\uff1a\u5f00\u6d77\u901a\u5546\uff0c\u5f15\u6d77\u5916\u94f6\u6d41\u5165' + region + '\uff0c\u5e76\u8bbe\u94f6\u4f30\u4ee5\u5e73\u5e02\u4ef7\u3002';
      if (/ban|private|mint|私铸|私钱|禁/.test(action)) return '诏令：严禁民间私铸，整饬钱法，搜检私钱作坊。';
      if (/issue|paper|发行|发钞|发/.test(action)) return '诏令：发行' + (item.paperName || item.name || '纸币') + (amount || 1000000) + '贯，准备金' + _aiPolicyRatioLabel(item.reserveRatio, 0.3) + '成。';
      if (/abolish|retire|废|罢|停/.test(action)) return '诏令：废止' + (item.paperName || item.name || '宝钞') + '，收回旧钞。';
      if (/debase|贬|减铸|轻钱/.test(action)) return '诏令：减铸' + (item.coinName || item.coinType || '铜钱') + _aiPolicyRatioLabel(item.level, 0.1) + '成，以纾军用。';
      return '';
    }

    if (field === 'population_adjustments') {
      if (/start_large_corvee|large_corvee|corvee|yaoyi/.test(action)) return '\u8bcf\u4ee4\uff1a\u5f81\u53d1\u5927\u5fad\u5f79' + (amount || 30000) + '\u4eba\uff0c\u6309\u6237\u7c4d\u6d3e\u5dee\uff0c\u4ee5\u4fee\u6cb3\u6e20\u57ce\u9632\u3002';
      if (/conscription|recruit|levy_soldier|zhaomu/.test(action)) return '\u8bcf\u4ee4\uff1a\u4e8e' + region + '\u5f81\u5175' + (amount || 10000) + '\u540d\uff0c\u6309' + (item.system || item.enable || '\u52df\u5175') + '\u5236\u8865\u5165\u519b\u7c4d\u3002';
      if (/migration_settlement|migrate|migration|settlement|relocate/.test(action)) return '\u8bcf\u4ee4\uff1a\u8fc1\u5f99\u5b89\u7f6e\u6d41\u6c11' + (amount || 5000) + '\u6237\uff0c\u62e8\u7530\u7ed9\u7cae\uff0c\u4ee4\u5165\u7c4d\u5b89\u4e1a\u3002';
      if (/hidden|purge|清查|隐户|漏籍/.test(action)) return '诏令：清查隐户，重编入黄籍。';
      if (/resettle|refugee|fugitive|招抚|逃户|流民/.test(action)) return '诏令：招抚逃户流民，令复业入籍。';
      if (/baojia|保甲|里甲/.test(action)) return '诏令：全国编设保甲，十户一牌。';
      if (/recount|register|huangce|黄册|重造|编审/.test(action)) return '诏令：重造黄册，清厘天下户籍。';
      return '';
    }

    if (field === 'central_local_actions') {
      if (/fiscal_bargain|bargain|local_fiscal/.test(action)) return '\u8bcf\u4ee4\uff1a\u4e0e' + region + '\u8bae\u5730\u65b9\u8d22\u653f\u535a\u5f08\uff0c\u660e\u8d77\u8fd0\u5b58\u7559\u4e4b\u5206\uff0c\u4ee5\u6355\u6350\u9977\u800c\u5b89\u5730\u65b9\u3002';
      if (/long_term_tracking|tracking|follow_up|monitor/.test(action)) return '\u8bcf\u4ee4\uff1a\u5efa\u7acb' + region + '\u957f\u671f\u8d22\u653f\u8ffd\u8e2a\uff0c\u9010\u6708\u6838\u5bf9\u8d77\u8fd0\u3001\u5b58\u7559\u3001\u6c11\u529b\u4e0e\u5b98\u8017\u3002';
      if (/transfer|grant|下拨|拨银|发帑|赈/.test(action)) return '诏令：下拨' + region + '银' + (amount || 50000) + '两赈济水灾。';
      if (/force|levy|强征|追征|催征/.test(action)) return '诏令：强征' + region + '地方留存' + (amount || 30000) + '两，以充军饷。';
      if (/censor|audit|监察|巡按|巡察/.test(action)) return '诏令：派监察御史巡按' + region + '，核其钱粮。';
      if (/allocation|share|分成|起运|存留|留成/.test(action)) return '诏令：调整' + region + '分成，起运' + _aiPolicyRatioLabel(item.qiyunRatio != null ? item.qiyunRatio : item.centralShare, 0.7) + '成，存留' + _aiPolicyRatioLabel(item.cunliuRatio != null ? item.cunliuRatio : item.retainedShare, 0.3) + '成。';
      return '';
    }

    if (field === 'environment_actions') {
      if (/migration_relief|migration|relocate|carry_capacity/.test(action)) return '\u8bcf\u4ee4\uff1a\u4ee4' + region + '\u8fc1\u6c11\u51fa\u5c71\uff0c\u9000\u8015\u8fd8\u6797\uff0c\u51cf\u8f7b\u5c71\u5730\u627f\u8f7d\u3002';
      if (/tech_investment|technology|water_tech|investment/.test(action)) return '\u8bcf\u4ee4\uff1a\u4e8e' + region + '\u6295\u5165\u6c34\u5229\u6280\u672f\u4e0e\u7701\u6c34\u519c\u5177\uff0c\u8bd5\u884c\u65b0\u6cd5\u4ee5\u590d\u7530\u529b\u3002';
      if (/disaster_recovery|recovery|restore|post_disaster/.test(action)) return '\u8bcf\u4ee4\uff1a\u884c' + region + '\u707e\u540e\u6062\u590d\u94fe\uff0c\u4fee\u5824\u3001\u6e05\u6de4\u3001\u590d\u8015\uff0c\u4e09\u5e74\u8003\u5176\u6210\u3002';
      if (/ban|logging|jin_hu|禁伐|禁樵/.test(action)) return '诏令：禁伐' + region + '山林，严禁樵采。';
      if (/dredge|water|shui|疏浚|水利|治水/.test(action)) return '诏令：疏浚' + region + '河道，兴修水利。';
      if (/reclaim|relief|tun|复耕|屯田|赈灾/.test(action)) return '诏令：赈灾复耕，屯田养地。';
      if (/fallow|rest|休耕|限垦|养地/.test(action)) return '诏令：限垦休耕，以养地力。';
      if (/open|waste|开荒|垦荒|垦殖/.test(action)) return '诏令：开荒' + region + '荒田，以增农亩。';
      return '';
    }

    if (field === 'institution_changes') {
      if (/abolish|remove|retire|废|罢|裁|撤|裁撤|废止/.test(action)) {
        var oldName = _aiPolicyText(item.officeName || item.name || item.institutionName || item.id || '旧司');
        return '诏令：裁撤' + oldName + '机构，归并职掌，罢其冗员。';
      }
      if (/create|add|register|office|设|立|置|创|新/.test(action)) {
        var name = _aiPolicyText(item.officeName || item.name || item.institutionName || '新司');
        return '诏令：设' + name + '，品级' + (item.rank || 5) + '，掌' + (item.duties || item.description || '专理新政') + '。';
      }
      return '';
    }
    return '';
  }

  function _aiStructuredPolicyParams(field, item) {
    item = item || {};
    var params = {};
    var action = _aiPolicyText(item.action || item.type || item.kind || item.policyId);
    if (action) params.action = action;
    if (item.regionId) params.regionId = item.regionId;
    if (item.region) params.region = item.region;
    if (item.sourceRegionId) params.sourceRegionId = item.sourceRegionId;
    if (item.targetRegionId) params.targetRegionId = item.targetRegionId;
    if (item.presetId || item.preset) params.presetId = item.presetId || item.preset;
    if (item.system || item.enable) params.system = item.system || item.enable;
    if (item.horizonTurns != null) params.horizonTurns = Number(item.horizonTurns);
    if (item.amount != null || item.money != null || item.silver != null) params.amount = _aiPolicyAmount(item.amount || item.money || item.silver, 0);
    if (field === 'currency_adjustments') {
      if (item.paperId) params.paperId = item.paperId;
      if (item.paperName || item.name) params.paperName = item.paperName || item.name;
      if (item.reserveRatio != null) params.reserveRatio = Number(item.reserveRatio);
      if (item.coinType) params.coinType = item.coinType;
      if (item.level != null) params.level = Number(item.level);
      if (item.acceptanceDelta != null) params.acceptanceDelta = Number(item.acceptanceDelta);
    } else if (field === 'central_local_actions') {
      if (item.qiyunRatio != null || item.centralShare != null) params.qiyunRatio = Number(item.qiyunRatio != null ? item.qiyunRatio : item.centralShare);
      if (item.cunliuRatio != null || item.retainedShare != null) params.cunliuRatio = Number(item.cunliuRatio != null ? item.cunliuRatio : item.retainedShare);
      if (item.retainedShare != null) params.retainedShare = Number(item.retainedShare);
      if (item.purpose) params.purpose = item.purpose;
      if (item.cost != null) params.cost = _aiPolicyAmount(item.cost, 0);
    } else if (field === 'environment_actions') {
      if (item.policyId) params.policyId = item.policyId;
    } else if (field === 'institution_changes') {
      params.officeName = item.officeName || item.name || item.institutionName || '新司';
      params.rank = item.rank || 5;
      params.duties = item.duties || item.description || '';
      if (item.region) params.region = item.region;
      if (item.staffSize != null) params.staffSize = _aiPolicyAmount(item.staffSize, 20);
      if (item.annualBudget != null) params.annualBudget = _aiPolicyAmount(item.annualBudget, 50000);
      if (item.fundingSource) params.fundingSource = item.fundingSource;
    }
    return params;
  }

  function _aiStructuredPolicyExpectedType(field) {
    return {
      currency_adjustments: 'currency_reform',
      population_adjustments: 'huji_reform',
      central_local_actions: 'central_local_finance',
      environment_actions: 'environment_policy',
      institution_changes: 'office_reform'
    }[field] || '';
  }

  function _aiInstitutionLifecycleAction(item) {
    var action = _aiPolicyText(item && (item.action || item.type || item.kind || '')).toLowerCase();
    if (/abolish|remove|retire|废|罢|裁|撤|裁撤|废止/.test(action)) return 'abolish';
    if (/create|add|register|office|设|立|置|创|新/.test(action)) return 'create';
    return '';
  }

  function _findAIInstitutionLifecycleTarget(item) {
    var G = global.GM || {};
    var list = Array.isArray(G.dynamicInstitutions) ? G.dynamicInstitutions : [];
    var id = _aiPolicyText(item && (item.id || item.instId || item.institutionId || item.officeId || ''));
    var name = _aiPolicyText(item && (item.officeName || item.name || item.institutionName || ''));
    if (id) {
      var byId = list.find(function(x) { return x && String(x.id || '') === id; });
      if (byId) return byId;
    }
    if (name) {
      return list.find(function(x) {
        return x && (String(x.name || '') === name || String(x.name || '').indexOf(name) >= 0 || name.indexOf(String(x.name || '')) >= 0);
      }) || null;
    }
    return null;
  }

  function _applyAIInstitutionLifecycleChange(item, params) {
    var G = global.GM;
    var parser = global.EdictParser;
    if (!G || !parser) return null;
    var action = _aiInstitutionLifecycleAction(item);
    if (!action) return null;
    if (!G.dynamicInstitutions) G.dynamicInstitutions = [];
    if (!Array.isArray(G.dynamicInstitutions)) {
      return { ok: false, action: action, reason: 'dynamicInstitutions is not array' };
    }
    if (action === 'create') {
      if (typeof parser.registerDynamicInstitution !== 'function') return null;
      var spec = {
        name: params.officeName || item.name || item.institutionName || '新司',
        rank: params.rank || 5,
        duties: params.duties || item.description || '',
        region: params.region || item.region || 'central',
        staffSize: params.staffSize || item.staffSize || 20,
        annualBudget: params.annualBudget || item.annualBudget || 50000,
        fundingSource: params.fundingSource || item.fundingSource || 'guoku.central',
        headOfficial: item.headOfficial || item.head || null,
        createdBy: 'ai-structured-policy'
      };
      var created = parser.registerDynamicInstitution(spec);
      return created ? { ok: true, action: 'create', instId: created.id, name: created.name, result: created } : { ok: false, action: 'create', reason: 'registerDynamicInstitution failed' };
    }
    if (action === 'abolish') {
      if (typeof parser.abolishInstitution !== 'function') return null;
      var target = _findAIInstitutionLifecycleTarget(item);
      if (!target) return { ok: false, action: 'abolish', reason: 'institution not found' };
      var abolished = parser.abolishInstitution(target.id);
      if (abolished && item.reason) abolished.abolishReason = item.reason;
      return abolished ? { ok: true, action: 'abolish', instId: target.id, name: target.name, result: abolished } : { ok: false, action: 'abolish', instId: target.id, reason: 'abolishInstitution failed' };
    }
    return null;
  }

  function _applyAIStructuredPolicyActions(aiOutput, applied) {
    var G = global.GM;
    var parser = global.EdictParser;
    if (!G || !parser || typeof parser.tryExecute !== 'function') return 0;
    var fields = ['currency_adjustments', 'population_adjustments', 'central_local_actions', 'environment_actions', 'institution_changes'];
    var count = 0;
    if (!Array.isArray(G._aiStructuredPolicyActions)) G._aiStructuredPolicyActions = [];
    fields.forEach(function(field) {
      var list = Array.isArray(aiOutput[field]) ? aiOutput[field] : [];
      list.forEach(function(item) {
        if (!item) return;
        var text = _aiStructuredPolicyText(field, item);
        if (!text) {
          applied.failed.push({ field: field, item: item, reason: 'no structured policy text' });
          return;
        }
        var params = _aiStructuredPolicyParams(field, item);
        var meta = {
          source: 'ai-structured-policy',
          field: field,
          expectedType: _aiStructuredPolicyExpectedType(field),
          raw: item
        };
        var lifecycle = null;
        var lifecycleAttempted = false;
        if (field === 'institution_changes') {
          lifecycleAttempted = !!(parser && (typeof parser.registerDynamicInstitution === 'function' || typeof parser.abolishInstitution === 'function'));
        }
        var edictResult = null;
        var result = null;
        var ok = false;
        var action = field === 'institution_changes' ? _aiInstitutionLifecycleAction(item) : '';
        if (!(field === 'institution_changes' && action === 'abolish')) {
          try {
            edictResult = parser.tryExecute(text, params, meta);
            ok = !!(edictResult && edictResult.ok !== false);
          } catch (e) {
            ok = false;
            edictResult = { ok: false, reason: e && e.message || String(e) };
          }
        }
        if (field === 'institution_changes') {
          lifecycle = _applyAIInstitutionLifecycleChange(item, params);
          if (lifecycleAttempted) ok = !!(lifecycle && lifecycle.ok);
        }
        result = { ok: ok, edict: edictResult, lifecycle: lifecycle };
        G._aiStructuredPolicyActions.push({
          turn: G.turn || 0,
          field: field,
          text: text,
          ok: ok,
          result: result,
          lifecycle: lifecycle ? { action: lifecycle.action, instId: lifecycle.instId || '', name: lifecycle.name || '', ok: !!lifecycle.ok, reason: lifecycle.reason || '' } : null
        });
        if (ok) {
          count++;
          G._turnReport.push({ type: 'aiPolicyAction', field: field, text: text, turn: G.turn || 0 });
        } else {
          applied.failed.push({ field: field, text: text, reason: result && (result.reason || result.pathway) || 'execute failed' });
        }
      });
    });
    if (G._aiStructuredPolicyActions.length > 100) G._aiStructuredPolicyActions.splice(0, G._aiStructuredPolicyActions.length - 100);
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  改换门庭（通用·跨朝代）：推演叙事 justify 时把人物从一势力改到另一势力。
  //  叛降 / 归附 / 反正 / 俘获 / 拥立——只由推演驱动（显式 allegiance_changes 或叙事动词检测），非随机。
  //  强绑定：factionId + faction 名串双锚同改，roster 关系随之；忠诚按改换类型重置（初投待考）。
  // ═══════════════════════════════════════════════════════════════════
  function applyAllegianceChange(G, charRef, newFacRef, opts) {
    opts = opts || {};
    if (!G || !Array.isArray(G.chars) || !Array.isArray(G.facs)) return { ok: false, reason: 'no_game' };
    var ch = (charRef && typeof charRef === 'object') ? charRef
      : G.chars.find(function (c) { return c && (c.name === charRef || c.id === charRef); });
    if (!ch) return { ok: false, reason: 'char_not_found:' + charRef };
    var nf = G.facs.find(function (f) { return f && (f.id === newFacRef || f.name === newFacRef); });
    // 名不精确容错（AI/叙事常给简称「金国」而剧本作「金国（大金）」）：前缀/包含匹配·唯一命中才采·
    // 否则 newName 是死名串→assignChar 的 _findFac 找不到→factionId 漂离老势力(绑定散)。
    if (!nf && typeof newFacRef === 'string' && newFacRef.length >= 2) {
      var _cands = G.facs.filter(function (f) { return f && f.name && (f.name.indexOf(newFacRef) === 0 || newFacRef.indexOf(f.name) === 0 || f.name.indexOf(newFacRef) >= 0); });
      if (_cands.length === 1) nf = _cands[0];
    }
    var newName = nf ? nf.name : (typeof newFacRef === 'string' ? newFacRef : '');   // 中立桶/无对象势力名亦可（如「群盗」）
    var newId = nf ? nf.id : '';
    if (!newName) return { ok: false, reason: 'faction_unresolved:' + newFacRef };
    var oldName = ch.faction || ch.factionName || '';
    if (oldName === newName) return { ok: false, reason: 'same_faction' };
    // 改归属·走 canonical 单一 mutator FactionMembership.assignChar：同步 char.faction+factionId
    // + FactionIndex roster 重建 + memberLeft/memberJoined 事件 + _factionHistory（绑定根治：不再绕过直接写）。
    var _fm = (typeof TM !== 'undefined' && TM && TM.FactionMembership) || (typeof window !== 'undefined' && window.TM && window.TM.FactionMembership) || null;
    if (_fm && typeof _fm.assignChar === 'function') {
      _fm.assignChar(ch, newName, { reason: opts.reason || ('改换门庭' + (opts.type ? '·' + opts.type : '')), byTurn: G.turn });
    } else {
      // 兜底（membership 模块缺位）：直接写双锚
      ch.faction = newName;
      if (newId) ch.factionId = newId; else delete ch.factionId;
    }
    if ('factionName' in ch) ch.factionName = newName;
    // 忠诚按改换性质重置：反正/获救对新主忠诚较高，俘降较低，主动叛投居中——皆「初投待考」非满忠
    var type = opts.type || '';
    ch.loyalty = (type === 'return' || type === 'rescue' || type === 'reinstate') ? 62
      : (type === 'surrender' || type === 'capture' || type === 'coerced') ? 30 : 42;
    ch._allegianceHistory = Array.isArray(ch._allegianceHistory) ? ch._allegianceHistory : [];
    ch._allegianceHistory.push({ from: oldName, to: newName, turn: G.turn || 0, type: type, reason: opts.reason || '' });
    try { if (typeof addEB === 'function') addEB('改换门庭', ch.name + '：' + (oldName || '无属') + ' → ' + newName + (opts.reason ? '（' + opts.reason + '）' : '')); } catch (_eb) {}
    try { if (G._turnReport) G._turnReport.push({ type: 'allegiance', from: oldName, to: newName, char: ch.name, reason: opts.reason || '', turn: G.turn || 0 }); } catch (_tr) {}
    return { ok: true, from: oldName, to: newName, char: ch.name };
  }
  if (typeof global !== 'undefined') { try { global.applyAllegianceChange = applyAllegianceChange; } catch (_g) {} }
  if (typeof window !== 'undefined') { window.applyAllegianceChange = applyAllegianceChange; }

  // ═══════════════════════════════════════════════════════════════════
  //  主应用函数：applyAITurnChanges
  // ═══════════════════════════════════════════════════════════════════

  function applyAITurnChanges(aiOutput) {
    var G = global.GM;
    if (!G) return { ok: false };
    if (!aiOutput || typeof aiOutput !== 'object') return { ok: false };

    // 确保 _turnReport 存在
    if (typeof preflightAIWriteBack === 'function') preflightAIWriteBack(aiOutput, { source: 'applyAITurnChanges' });
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

    // 0.5 税制变更（玩家诏书/奏疏/朝议/问对 → AI 推演解读 → 落地改 fiscalConfig.taxList）
    //   走治国闭环·非直改面板。AI 输出 tax_reforms:[{op:'rate'|'add'|'remove',taxId,rate?,tax?,reason}]·此处调引擎 applyPlayerTaxReform 落地（改即下回合 CascadeTax 重算 + 民心按民负响应）。
    (aiOutput.tax_reforms || aiOutput.taxReforms || []).forEach(function(tr) {
      try {
        if (!tr || !tr.op) return;
        var FE = global.FiscalEngine;
        if (!FE || typeof FE.applyPlayerTaxReform !== 'function') { applied.failed.push({ taxReform: tr, reason: 'no_fiscal_engine' }); return; }
        var rr = FE.applyPlayerTaxReform(tr);
        if (rr && rr.ok) {
          applied.changes++;
          G._turnReport.push({ type: 'tax_reform', change: rr.change, minxinDelta: rr.minxinDelta, reason: tr.reason || '', turn: G.turn || 0 });
        } else {
          applied.failed.push({ taxReform: tr, reason: (rr && rr.reason) || 'reform_failed' });
        }
      } catch (e) { applied.failed.push({ taxReform: tr, reason: (e && e.message) || 'exception' }); }
    });

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
          path: result.path || ch.path,
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

    // 1.5 改换门庭（推演驱动·叛降/归附/反正/俘获/拥立）：显式列表 [{character,newFaction,reason,type}]。
    //     兼容多种字段名；解析失败入 failed 可见。narrative 动词检测在叙事扫描段补漏（见下）。
    (aiOutput.allegiance_changes || aiOutput.allegianceChanges || aiOutput.defections || []).forEach(function(a) {
      if (!a || typeof a !== 'object') return;
      var charRef = a.character || a.char || a.name || a.who || a.subject;
      var newFac = a.newFaction || a.toFaction || a.to_faction || a.faction || a.to || a.newAllegiance;
      if (!charRef || !newFac) return;
      var r = applyAllegianceChange(G, charRef, newFac, { reason: a.reason || a.cause || '', type: a.type || a.kind || a.mode || '' });
      if (r.ok) { applied.changes++; }
      else applied.failed.push({ field: 'allegiance_changes', text: charRef + ' → ' + newFac, reason: r.reason });
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
      if (global.addEB) global.addEB('地方', (div.name||la.region) + '·' + (div.governor||'地方官') + ' ' + ({disaster_relief:'赈灾',public_works_water:'修水利',public_works_road:'修路',education:'兴学',granary_stockpile:'平籴备荒',military_prep:'备边',charity_local:'恤民',illicit:'中饱私囊',supernatural_disaster_relief:'禳灾'}[la.type]||la.type) + ' ' + (la.amount||0) + (la.reason?' (' + la.reason + ')':''));
      G._turnReport.push({ type:'localAction', region:la.region, actionType:la.type, amount:la.amount, reason:la.reason, turn:G.turn||0 });

      // ── S3·调粮救荒(2026-06)：赈灾/平籴/恤民 → 调粮入缺粮叶·写 _grainInflowThisTurn(tm-huji-engine S2 读它减 load 救荒)。
      // 走地方官「主动行动」通道·零新 UI。粮源：先地方仓·不足走中央漕运 guoku.grain·供给数量封顶(调多少救多少)。
      if (la.type === 'disaster_relief' || la.type === 'granary_stockpile' || la.type === 'charity_local') {
        var _wantGrain = Math.max(0, Math.round(Number(la.grainAmount) || 0));
        if (!_wantGrain && Number(la.amount) > 0) _wantGrain = Math.round(Number(la.amount) * 0.2); // 无显式调粮·按拨款 1/5 折粮
        if (_wantGrain > 0) {
          var _gotGrain = 0;
          if (div.publicTreasury && div.publicTreasury.grain) {            // ①地方仓
            var _fromLocal = Math.min(_wantGrain, Number(div.publicTreasury.grain.stock) || 0);
            if (_fromLocal > 0) { div.publicTreasury.grain.stock -= _fromLocal; _gotGrain += _fromLocal; }
          }
          if (_gotGrain < _wantGrain && G.guoku) {                         // ②中央漕运·封顶(供给数量)
            var _central = Number(G.guoku.grain) || 0;
            var _fromCentral = Math.min(_wantGrain - _gotGrain, _central);
            if (_fromCentral > 0) { G.guoku.grain = _central - _fromCentral; _gotGrain += _fromCentral; }
          }
          if (_gotGrain > 0) {                                             // 调入缺粮叶(按缺口分摊)
            // (2026-06-20 真机修)：div 是区划节点非 adminHierarchy·递归 divisions/children 取其下叶(原 getLeafDivisions(div) 取不到)
            var _gleaves = [];
            (function _wl(_n){ if(!_n) return; var _ks=_n.divisions||_n.children; if(_ks&&_ks.length){for(var _j=0;_j<_ks.length;_j++)_wl(_ks[_j]);} else _gleaves.push(_n); })(div);
            if (!_gleaves.length) _gleaves = [div];
            var _needs = _gleaves.map(function(_l){
              var _rid = String(_l.id || _l.name || '');
              var _rg = (G.renli && G.renli.byRegion) ? (G.renli.byRegion[_rid] || (_l.name ? G.renli.byRegion[_l.name] : null)) : null;
              return _rg ? Math.max(0, (Number(_rg.foodNeed) || 0) - (Number(_rg.grainOutput) || 0)) : 0;
            });
            var _totNeed = _needs.reduce(function(_a, _b){ return _a + _b; }, 0);
            _gleaves.forEach(function(_l, _i){
              var _share = _totNeed > 0 ? (_needs[_i] / _totNeed) : (1 / _gleaves.length);
              _l._grainInflowThisTurn = (Number(_l._grainInflowThisTurn) || 0) + _gotGrain * _share;
            });
            if (global.addEB) global.addEB('地方', (div.name || la.region) + ' 调粮赈济 ' + Math.round(_gotGrain) + ' 石（救荒入缺粮地）');
          }
        }
      }

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
          // 功名:正政绩按能臣度概率化(成功×SCALE·量随能力·庸才低概率甚至办砸→失败扣分)·illicit 贪腐不扣功名(#3 功名与廉洁解耦·只贪腐案发才扣)
          if (_virDelta > 0 && global.TMPromotion) {
            var _gcap = global.TMPromotion.capability(_govCh, (typeof getEffectiveAttr === 'function' ? getEffectiveAttr : null));
            if (Math.random() < Math.min(0.95, 0.3 + _gcap / 100 * 0.6)) global.CharEconEngine.adjustVirtueMerit(_govCh, Math.round(_virDelta * global.TMPromotion.SCALE * (0.6 + _gcap / 100 * 0.6)), _laTypeLbl);
            else global.CharEconEngine.adjustVirtueMerit(_govCh, global.TMPromotion.failureDelta('task_botched'), _laTypeLbl + ' 办砸');
          } else if (_virDelta > 0) {
            global.CharEconEngine.adjustVirtueMerit(_govCh, _virDelta, _laTypeLbl);
          }
        }
      } catch(_lafve){ if(window.TM&&TM.errors) TM.errors.capture(_lafve,'applier.localActions.fame'); }
    });

    // 5. 事件（风闻）
    (aiOutput.events || []).forEach(function(e) {
      // v0.2·来源涌现：AI 标记 critical 的决策型事件(带 choices)+ 开关开 → 收编进御案时政 currentIssues
      //   (玩家在御案时政「陛下决断」·_chooseIssueOption 开关开走 AI 据局面裁后果)。寻常事件保持播报/走 playerChoices 软 surface(寄生为主·抉择 C)。
      if (e && e.critical && Array.isArray(e.choices) && e.choices.length
          && typeof global._eventAdjudicationOn === 'function' && global._eventAdjudicationOn()) {
        try {
          var _G2 = global.GM;
          if (_G2) {
            if (!Array.isArray(_G2.currentIssues)) _G2.currentIssues = [];
            var _iid = 'aiev_' + (e.id || ((_G2.turn || 0) + '_' + _G2.currentIssues.length));
            if (!_G2.currentIssues.some(function(i){ return i && i.id === _iid; })) {
              _G2.currentIssues.push({
                id: _iid,
                title: e.title || e.category || '时局要务',
                description: e.text || '',
                category: e.category || '要务',
                status: 'pending',
                raisedTurn: _G2.turn || 1,
                raisedDate: _G2._gameDate || '',
                choices: e.choices.map(function(c){ return { text: c.text || '应对', desc: c.desc || '', aiHint: c.aiHint || '', effect: c.effect || null }; })
              });
              if (global.addEB) global.addEB(e.category || '要务', '临御案：' + (e.title || e.text || ''), { credibility: e.credibility || 'medium' });
              applied.events++;
              return; // 收编进御案时政·不再走风闻播报
            }
          }
        } catch(_seqE){ /* 收编失败·回落播报 */ }
      }
      if (global.addEB) global.addEB(e.category || '事', e.text || '', { credibility: e.credibility || 'medium' });
      applied.events++;
      G._turnReport.push({ type:'event', category:e.category, text:e.text, turn:G.turn||0 });
    });

    // 6. NPC 行动
    // p1.npc_actions 仍由 tm-endturn-ai-infer 的专门通道执行；这里不重复落盘，
    // 但也不再把它标成废弃，避免 validator/applier 与 prompt 消费方互相打架。

    // 7. NPC 关系变化
    (aiOutput.relations || []).forEach(function(r) {
      if (typeof global.applyNpcInteraction === 'function' && r.actor && r.target && r.type) {
        global.applyNpcInteraction(r.actor, r.target, r.type, r.extra);
        applied.relations++;
        G._turnReport.push({ type:'relation', actor:r.actor, target:r.target, interaction:r.type, turn:G.turn||0 });
      }
    });

    if (!applied.semantic) applied.semantic = {};
    var aiPolicyActionCount = _applyAIStructuredPolicyActions(aiOutput, applied);
    if (aiPolicyActionCount > 0) applied.semantic.ai_policy_actions = aiPolicyActionCount;

    // 7.5. 军事变化：诏令/奏疏/问对/朝会 AI 常返回 military_changes 或 army_changes。
    // 旧逻辑只展示这些字段，不会在 GM.armies 缺项时创建新军，导致军队 UI 看不到新部队。
    var militaryChangeCount = 0;
    if (Array.isArray(aiOutput.military_changes)) {
      militaryChangeCount += _applyAIArmyChangeList(aiOutput.military_changes, 'military_changes');
    }
    if (Array.isArray(aiOutput.army_changes)) {
      militaryChangeCount += _applyAIArmyChangeList(aiOutput.army_changes, 'army_changes');
    }
    if (militaryChangeCount > 0) applied.semantic.military_changes = militaryChangeCount;
    // 7.6. 采买：银→军备(治理·应急外购·尤火器外购/茶马市马·渠道由AI核定·玩家国库扣银)
    var procureCount = 0;
    if (Array.isArray(aiOutput.armory_procurement)) {
      var AR_proc = (typeof window !== 'undefined' && window.TMArmory) || (typeof global !== 'undefined' && global.TMArmory);
      if (AR_proc && typeof AR_proc.procure === 'function') {
        aiOutput.armory_procurement.forEach(function(p){
          if (!p || !p.category) return;
          try {
            var r = AR_proc.procure(G, p.category, (p.quantity != null ? p.quantity : p.amount), { unitPrice: p.unitPrice });
            if (r && r.realQty > 0) {
              procureCount++;
              if (typeof addEB === 'function') addEB('军备', '采买' + p.category + r.realQty + '·费银' + r.cost + (p.channel ? ('·' + p.channel) : '') + (r.afford < 1 ? '（国库不继·减采）' : ''));
              if (G._turnReport) G._turnReport.push({ type:'military', field:'armory_procurement', category: p.category, qty: r.realQty, cost: r.cost, channel: p.channel || '', reason: p.reason || '采买', turn: G.turn || 0 });
            }
          } catch (_pe) {}
        });
      }
    }
    if (procureCount > 0) applied.semantic.armory_procurement = procureCount;
    var armyCommanderFallbackCount = _applyNarrativeArmyCommanderFallback(G, aiOutput);
    if (armyCommanderFallbackCount > 0) applied.semantic.army_commander_fallback = armyCommanderFallbackCount;
    var armyFieldFallbackCount = _applyNarrativeArmyFieldFallback(G, aiOutput);
    if (armyFieldFallbackCount > 0) applied.semantic.army_field_fallback = armyFieldFallbackCount;

    // ═══════════════════════════════════════════════════════════════════
    // v2·AI 至高权力扩展通道（全域语义化快捷+兜底 anyPathChanges）
    // ═══════════════════════════════════════════════════════════════════

    // ── 8. char_updates：角色任意字段修改+仕途条目+走位 ──
    // schema: [{ name, updates:{...任意字段...}, careerEvent:{title,date,summary,...}, travelTo:{toLocation,estimatedDays,reason} }]
    var charUpdCount = 0;
    (aiOutput.char_updates || []).forEach(function(cu) {
      if (!cu || !cu.name) return;
      var ch = _findEntity(G, 'char', cu.name);
      if (!ch) { applied.failed.push({char_update: cu, reason: 'char not found'}); return; }
      // updates：任意字段
      if (cu.updates) charUpdCount += _mergeUpdatesToEntity(ch, cu.updates, 'char_update', ch.name, cu.reason || '');
      // careerEvent：仕途条目追加
      if (cu.careerEvent) {
        if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
        ch.careerHistory.push(Object.assign({ turn: G.turn||0, date: (typeof getTSText==='function'?getTSText(G.turn):'T'+(G.turn||0)) }, cu.careerEvent));
        charUpdCount++;
        G._turnReport.push({ type:'career', char: ch.name, event: cu.careerEvent.summary || cu.careerEvent.title, turn:G.turn||0 });
      }
      // travelTo：启动走位
      if (cu.travelTo && cu.travelTo.toLocation) {
        // —— 幂等保护·若已在赴同一终点·不重写剩余天数（避免 AI 重复 issue 重置走位） ——
        if (ch._travelTo && _sameTravelLocation(ch._travelTo, cu.travelTo.toLocation)) {
          if (typeof global.addEB === 'function') {
            global.addEB('人事', ch.name + ' 复诏催程赴 ' + ch._travelTo + '（已在路·留剩 ' + (typeof ch._travelRemainingDays === 'number' ? ch._travelRemainingDays + ' 日' : '未抵') + '）');
          }
          return; // 跳过重启走位
        }
        if (ch.location && _sameTravelLocation(ch.location, cu.travelTo.toLocation)) {
          _syncCharacterLocationMirrors(G, ch, { location: ch.location }, [
            '_travelTo',
            '_travelFrom',
            '_travelStartTurn',
            '_travelRemainingDays',
            '_travelArrival',
            '_travelReason',
            '_travelAssignPost'
          ]);
          return; // 已在同地（如顺天府=京师）·不启动无意义走位
        }
        var days = cu.travelTo.estimatedDays || _estimateTravelDays(ch.location, cu.travelTo.toLocation);
        ch._travelTo = cu.travelTo.toLocation;
        ch._travelFrom = ch.location || '';
        ch._travelStartTurn = G.turn || 0;
        ch._travelRemainingDays = days;
        ch._travelReason = cu.travelTo.reason || '';
        ch._travelAssignPost = cu.travelTo.assignPost || '';
        _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
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
      var rawAction = String(oa.action || 'appoint');
      var action = rawAction.toLowerCase();
      var isConcurrentOffice = (typeof global._offIsConcurrentAppointment === 'function')
        ? global._offIsConcurrentAppointment(Object.assign({}, oa, { action: rawAction }), oa.post || '')
        : /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(rawAction + ' ' + (oa.reason || ''));
      if (/兼/.test(rawAction)) action = 'appoint';
      if (action === 'concurrent') { action = 'appoint'; isConcurrentOffice = true; }
      // 是否需要先走位（任命/调任至他处皆走位）
      var needTravel = oa.toLocation && ch.location && !_sameTravelLocation(oa.toLocation, ch.location);
      if (needTravel && (action === 'appoint' || action === 'transfer')) {
        // —— 幂等保护·若已在赴同一终点·不重写剩余天数（避免 AI 重复 issue 重置走位） ——
        if (ch._travelTo && _sameTravelLocation(ch._travelTo, oa.toLocation)) {
          if (typeof global.addEB === 'function') {
            global.addEB('任命', ch.name + ' 复诏催赴 ' + ch._travelTo + ' 任 ' + (oa.post||'') + '（已在路·留剩 ' + (typeof ch._travelRemainingDays === 'number' ? ch._travelRemainingDays + ' 日' : '未抵') + '）');
          }
          // 若新诏含官职·补到 _travelAssignPost（原 travelTo 可能是 char_updates 设的·没 assignPost）
          if (oa.post && !ch._travelAssignPost) {
            ch._travelAssignPost = (oa.dept ? oa.dept + '/' : '') + oa.post;
            ch._travelAssignConcurrent = !!isConcurrentOffice;
            _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
          }
          return;
        }
        // 启动走位·到达后再就任（由 travel tick 完成）
        var days = oa.estimatedDays || _estimateTravelDays(ch.location, oa.toLocation);
        ch._travelTo = oa.toLocation;
        ch._travelFrom = ch.location;
        ch._travelStartTurn = G.turn || 0;
        ch._travelRemainingDays = days;
        ch._travelReason = (oa.reason || '') + '·赴任';
        ch._travelAssignPost = (oa.dept ? oa.dept + '/' : '') + (oa.post || '');
        ch._travelAssignConcurrent = !!isConcurrentOffice;
        _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
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
          if (action === 'appoint') rr = onAppointment(oa.name, singlePost, { dept: oa.dept, concurrent: isConcurrentOffice, reason: oa.reason || '' });
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
      var isConcurrentPersonnel = (typeof global._offIsConcurrentAppointment === 'function')
        ? global._offIsConcurrentAppointment({ reason: reason, raw: changeText }, changeText)
        : /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(changeText);
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
      if (action === 'appoint' && post) r = onAppointment(pc.name, post, { concurrent: isConcurrentPersonnel, reason: reason });
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
      } else {
        // 【落地核对·2026-06】人事兜底 onAppointment/onDismissal 失败原本**纯静默**(不记 failed·面板却照显原话)→标记同一 pc 对象供面板打"⚠未落地"·并入 applied.failed 供失败可见性 surface
        pc._applyFailed = true;
        if (applied && Array.isArray(applied.failed)) applied.failed.push({ personnel_change: { name: pc.name, change: pc.change }, reason: (r && r.reason) || 'appoint/dismiss 未落地(目标对不上)' });
      }
    });
    if (personnelFromPcCount > 0) applied.semantic.personnel_changes_fallback = personnelFromPcCount;

    // 2026-06-11·治「任命/罢免/改任推演成功但官制树 UI 不变」：office/personnel 变更后刷新官制 UI。
    //   御案默认 UI 的官制面板在右栏(renderZhiRich/rightOfficeTree·读 GM.officeTree 的 holder)。此前 army/narrative
    //   变更都调 TMPhase8FormalBridge.refresh()(见 tm-ai-change-army.js:104 / tm-ai-change-narrative.js:221)，唯独 office 漏了。
    //   延后一帧(setTimeout 0)执行：确保本轮 apply 的后续段(personnel/narrative 等)也已落、读到最新 GM.officeTree；去抖只刷一次。
    if (officeCount > 0 || personnelFromPcCount > 0) {
      try {
        if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
          if (!window._tmOfficeUiRefreshPending) {
            window._tmOfficeUiRefreshPending = true;
            window.setTimeout(function(){
              window._tmOfficeUiRefreshPending = false;
              try { if (typeof window.renderOfficeTree === 'function') window.renderOfficeTree(); } catch(_){}
              try { if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.refresh === 'function') window.TMPhase8FormalBridge.refresh(); } catch(_){}
            }, 0);
          }
        }
      } catch(_){}
    }

    // ── 10. fiscal_adjustments：岁入岁出动态增删 + **立即作用于余额** ──
    // schema: [{ target:'guoku|neitang|province:X', kind:'income|expense', resource?:'money|grain|cloth', category, name, amount, reason, recurring:bool, stopAfterTurn }]
    var fiscalCount = 0;
    (aiOutput.fiscal_adjustments || []).forEach(function(fa) {
      if (!fa) return;
      // ★ fiscal 容差归一(2026-06-02·bug A)：AI 常用中文/自然名指账户与收支·若不归一则 target 解析为 null·
      //   此条 fiscal 静默漏账(财政死账真凶之一)。映射常见别名到 guoku/neitang/province: 与 income/expense。
      if (fa.target != null) {
        var _ft = String(fa.target).trim();
        if (/^(太仓|太仓库|国库|户部库|外库|公帑|公库|guoku|taicang|taicangku)$/i.test(_ft)) fa.target = 'guoku';
        else if (/^(内帑|内库|内承运库|私帑|帝室库|御库|neitang|neicang)$/i.test(_ft)) fa.target = 'neitang';
        else if (/^(province|省|布政使司)\s*[:：]/i.test(_ft)) fa.target = 'province:' + _ft.replace(/^(province|省|布政使司)\s*[:：]\s*/i, '');
      }
      if (fa.kind != null) {
        var _fk = String(fa.kind).trim();
        if (/^(income|收入|进项|增收|入项)$/i.test(_fk)) fa.kind = 'income';
        else if (/^(expense|expenditure|支出|开支|耗费|拨支|出项)$/i.test(_fk)) fa.kind = 'expense';
      }
      if (!fa.target || !fa.kind) return;
      var action = String(fa.action || fa.op || 'add').toLowerCase();
      if (action === 'modify') action = 'update';
      if (action === 'set') action = 'update';
      if (action === 'delete' || action === 'disable' || action === 'cancel') action = 'stop';
      if (action !== 'add' && action !== 'update' && action !== 'stop' && action !== 'remove') action = 'add';
      var amount = Math.abs(parseFloat(fa.amount) || 0);
      if (action === 'add' && amount <= 0) return;
      amount = _applyTaxAuthorityGate(G, fa, amount);   // 官制活化 Slice③ 权限门：税类 income 按掌征税权者执行力打折
      var resource = (fa.resource === 'grain' || fa.resource === 'cloth') ? fa.resource : 'money';
      // ★ 一次性误判护栏(2026-06-21)：LLM 偶把突发赏赐/赈济/抄没/缴获等「一次性」收支误标 recurring:true·
      //   被当长期年例逐回合重复结算(虚增岁入岁出·且因 scheduled 分支当回合反而不入账)。
      //   据名目/缘由关键字保守纠偏：含明确一次性词且无长期年例词 → 强制 recurring:false。
      //   有长期信号(岁/年例/月饷/盐课/加派/皇庄/俸禄…)则不动·避免误伤辽饷加派、盐课等真年例。
      if (fa.recurring) {
        var _faText = String((fa.name || '') + ' ' + (fa.reason || '') + ' ' + (fa.category || ''));
        var _oneTimeRe = /赏|赐|犒|赉|恤|赈|振济|抚恤|抄没|抄家|籍没|罚没|没入|查抄|缴获|赔款|赔偿|报效|进献|捐输|搜括|一次|临时|特支|特拨|特赐|赎银|犒军|犒赏/;
        var _recurRe = /岁|年例|年额|月饷|月粮|月例|常额|常例|常税|经制|经常|盐课|盐引|榷|关税|商税|田赋|加派|皇庄|俸|禄|每年|每岁|逐年|年度/;
        if (_oneTimeRe.test(_faText) && !_recurRe.test(_faText)) {
          fa.recurring = false;
          fa._coercedOneTime = true;
        }
      }
      var entry = {
        id: 'fa_' + (G.turn||0) + '_' + Math.random().toString(36).slice(2,6),
        name: fa.name || '',
        category: fa.category || '',
        resource: resource,
        amount: amount,
        reason: fa.reason || '',
        recurring: !!fa.recurring,
        _coercedOneTime: !!fa._coercedOneTime,
        addedTurn: G.turn || 0,
        stopAfterTurn: fa.stopAfterTurn || null,
        action: action
      };
      // 确定目标容器
      var target = null, containerKey = null, immediateTarget = null, fiscalStockTarget = null;
      if (fa.target === 'guoku') {
        if (!G.guoku) G.guoku = {};
        if (!G.guoku.extraIncome) G.guoku.extraIncome = [];
        if (!G.guoku.extraExpense) G.guoku.extraExpense = [];
        target = G.guoku;
        containerKey = (fa.kind === 'income') ? 'extraIncome' : 'extraExpense';
        immediateTarget = G.guoku;
        fiscalStockTarget = G.guoku;
      } else if (fa.target === 'neitang') {
        if (!G.neitang) G.neitang = {};
        if (!G.neitang.extraIncome) G.neitang.extraIncome = [];
        if (!G.neitang.extraExpense) G.neitang.extraExpense = [];
        target = G.neitang;
        containerKey = (fa.kind === 'income') ? 'extraIncome' : 'extraExpense';
        immediateTarget = G.neitang;
        fiscalStockTarget = G.neitang;
      } else if (/^province:/.test(fa.target)) {
        var provName = fa.target.replace(/^province:/, '');
        var div = _findDivisionByNameOrId(G, provName);
        if (div) {
          if (!div.extraFiscal) div.extraFiscal = { income: [], expense: [] };
          target = div.extraFiscal;
          containerKey = (fa.kind === 'income') ? 'income' : 'expense';
          immediateTarget = div;
          fiscalStockTarget = _ensurePublicTreasuryResource(div, resource);
        } else {
          // 【落地核对·Slice4·2026-06】province 解析不到→原本 target 留 null→后续 if(target&&containerKey) 静默跳过=财政死账真凶。记 failed 可见(Slice1 surface)·不改控制流(仍照旧落空)
          if (applied && Array.isArray(applied.failed)) applied.failed.push({ fiscal_adjustment: { target: fa.target, kind: fa.kind, name: fa.name || fa.category }, reason: 'province 未找到·财政未落地: ' + provName });
        }
      }
      if (target && containerKey && action !== 'add') {
        var list = target[containerKey] || [];
        var lookup = String(fa.id || fa.name || fa.category || '').trim().toLowerCase();
        var existing = lookup ? list.find(function(item) {
          return item && (
            String(item.id || '').toLowerCase() === lookup ||
            String(item.name || '').toLowerCase() === lookup ||
            String(item.category || '').toLowerCase() === lookup
          );
        }) : null;
        if (existing) {
          if (action === 'stop' || action === 'remove') {
            existing.recurring = false;
            existing.stopAfterTurn = G.turn || 0;
            existing.stoppedTurn = G.turn || 0;
            existing.executionStatus = action === 'remove' ? 'removed' : 'stopped';
            existing.stopReason = fa.reason || existing.stopReason || existing.reason || '';
            fiscalCount++;
            G._turnReport.push({ type:'fiscal_adj', action: action, target: fa.target, kind: fa.kind, resource: existing.resource || resource, name: existing.name, amount: 0, requested: 0, annualAmount: Number(existing.amount) || 0, recurring: false, shortfall: 0, executionStatus: existing.executionStatus, reason: existing.stopReason, turn: G.turn||0 });
            if (typeof global.addEB === 'function') global.addEB('\u8D22\u653F', (fa.target === 'guoku' ? '\u5E11\u5EEA' : fa.target === 'neitang' ? '\u5185\u5E11' : fa.target) + '\u505C\u7528\u5E74\u4F8B\u300C' + (existing.name || fa.name || '') + '\u300D');
            return;
          }
          if (amount > 0) existing.amount = amount;
          existing.resource = resource;
          existing.recurring = fa.recurring !== undefined ? !!fa.recurring : existing.recurring;
          if (fa.stopAfterTurn !== undefined) existing.stopAfterTurn = fa.stopAfterTurn;
          if (fa.category !== undefined) existing.category = fa.category || existing.category || '';
          if (fa.reason) existing.reason = fa.reason;
          if (existing.recurring) existing.lastSettledTurn = G.turn || 0;
          existing.updatedTurn = G.turn || 0;
          existing.executionStatus = 'updated';
          fiscalCount++;
          G._turnReport.push({ type:'fiscal_adj', action: action, target: fa.target, kind: fa.kind, resource: resource, name: existing.name || fa.name, amount: 0, requested: amount, annualAmount: existing.recurring ? (Number(existing.amount) || amount) : 0, recurring: !!existing.recurring, shortfall: 0, executionStatus: 'updated', reason: fa.reason || existing.reason || '', turn: G.turn||0 });
          if (typeof global.addEB === 'function') global.addEB('\u8D22\u653F', (fa.target === 'guoku' ? '\u5E11\u5EEA' : fa.target === 'neitang' ? '\u5185\u5E11' : fa.target) + '\u6539\u5B9A\u5E74\u4F8B\u300C' + (existing.name || fa.name || '') + '\u300D');
          return;
        }
        if (action === 'stop' || action === 'remove') return;
        if (amount <= 0) return;
        action = 'add';
        entry.action = 'add';
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
        var executionStatus = 'completed';  // completed / partial / blocked / scheduled
        if (entry.recurring) {
          actualApplied = 0;
          shortfall = 0;
          executionStatus = 'scheduled';
        } else if (immediateTarget) {
          var stockTarget = fiscalStockTarget || immediateTarget;
          var cur = _readFiscalStock(stockTarget, resource);
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
              _writeFiscalStock(stockTarget, resource, 0);
            } else {
              // 足额
              actualApplied = amount;
              shortfall = 0;
              executionStatus = 'completed';
              _writeFiscalStock(stockTarget, resource, cur - amount);
            }
          } else {
            // 收入：直接加（若原为负·可抹平债务）
            _writeFiscalStock(stockTarget, resource, cur + amount);
          }
          if ((immediateTarget === G.guoku || immediateTarget === G.neitang) && resource === 'money') immediateTarget.balance = immediateTarget.money;
        }
        // 条目标记实际应用量+亏欠量+执行状态
        if (entry.recurring) entry.lastSettledTurn = G.turn || 0;
        entry.applied = actualApplied;
        entry.shortfall = shortfall;
        entry.executionStatus = executionStatus;
        // turnReport：记 actual + shortfall + status（渲染器区别对待）
        G._turnReport.push({ type:'fiscal_adj', action: action, target: fa.target, kind: fa.kind, resource: resource, name: entry.name, amount: actualApplied, requested: amount, annualAmount: entry.recurring ? amount : 0, recurring: !!entry.recurring, coercedOneTime: !!entry._coercedOneTime, shortfall: shortfall, executionStatus: executionStatus, reason: entry.reason, turn: G.turn||0 });
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
      if (fu.updates) facCount += _mergeUpdatesToEntity(fac, fu.updates, 'faction_update', fac.name, fu.reason || '');
    });
    if (facCount > 0) applied.semantic.faction_updates = facCount;
    var factionFieldFallbackCount = _applyNarrativeFactionFieldFallback(G, aiOutput);
    if (factionFieldFallbackCount > 0) applied.semantic.faction_field_fallback = factionFieldFallbackCount;

    // ── 12. party_updates ──
    var partyCount = 0;
    (aiOutput.party_updates || []).forEach(function(pu) {
      if (!pu || !pu.name) return;
      var party = _findEntity(G, 'party', pu.name);
      if (!party) { applied.failed.push({party_update: pu, reason: 'party not found'}); return; }
      if (pu.updates) partyCount += _mergeUpdatesToEntity(party, pu.updates, 'party_update', party.name, pu.reason || '');
    });
    if (partyCount > 0) applied.semantic.party_updates = partyCount;

    // ── 13. class_updates ──
    var classCount = 0;
    (aiOutput.class_updates || []).forEach(function(cu) {
      if (!cu || !cu.name) return;
      var cls = _findEntity(G, 'class', cu.name);
      if (!cls) { applied.failed.push({class_update: cu, reason: 'class not found'}); return; }
      if (cu.updates) classCount += _mergeUpdatesToEntity(cls, cu.updates, 'class_update', cls.name, cu.reason || '');
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
      if (ru.updates) regionCount += _mergeUpdatesToEntity(div, ru.updates, 'region_update', div.name || div.id, ru.reason || '');
    });
    if (regionCount > 0) applied.semantic.region_updates = regionCount;
    var regionFieldFallbackCount = _applyNarrativeRegionFieldFallback(G, aiOutput);
    if (regionFieldFallbackCount > 0) applied.semantic.region_field_fallback = regionFieldFallbackCount;

    // ── 15. project_updates：长期工程/商队/学堂/道路等 ──
    // schema: [{ name, type:'工程|商队|学堂|道路|etc', status:'planning|active|completed|abandoned', cost, progress, leader, region, startTurn, endTurn, description }]
    var projectCount = 0;
    if (!G.activeProjects) G.activeProjects = [];
    (aiOutput.project_updates || []).forEach(function(pu) {
      if (!pu || !pu.name) return;
      var existing = G.activeProjects.find(function(p){ return p.name === pu.name; });
      if (existing) {
        // —— 防进度倒退·防卡死保护 ——
        // 已 completed/abandoned 的不再被覆盖（除非 AI 明确传 reactivate=true）
        if ((existing.status === 'completed' || existing.status === 'abandoned') && !pu.reactivate) {
          if (typeof global.addEB === 'function') global.addEB('工程', existing.name + '·已结案·拒绝重写（如需重启请加 reactivate=true）');
          return;
        }
        // 进度不可倒退（除非 AI 明确传 progressReason 说明意外·如停工/被破坏）
        if (typeof pu.progress === 'number' && typeof existing.progress === 'number' && pu.progress < existing.progress && !pu.progressReason) {
          if (typeof global.addEB === 'function') global.addEB('工程', existing.name + '·进度倒退被拒（旧 ' + existing.progress + '%→新 ' + pu.progress + '%·缺 progressReason）');
          delete pu.progress; // 保留旧 progress·其他字段照写
        }
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
        G._turnReport.push({ type:'anyPath', path: result.path || apc.path, op: apc.op||'set', old: result.old, new: result.new, reason: apc.reason, turn: G.turn||0 });
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
    // ── 13.5 移动对账·确定性兜底（AI 漏吐 travelTo 时·引擎按玩家移动令+即时规则自行落地·根治"人物原地不动"顽疾）──
    try { _reconcilePlayerMovements(G); } catch(_rmE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rmE, 'applier] move reconcile:') : console.warn('[applier] move reconcile:', _rmE); }
    // ── 13.6 财政改革对账·P-VWF·确定性拨开关（肃贪升compliance/清丈triggerSurvey/盐法/开海/劝农）·根治"改革不进央地真账·月入死焊" ──
    try { _reconcilePlayerFiscalReforms(G, aiOutput); } catch(_frE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_frE, 'applier] fiscal reform reconcile:') : console.warn('[applier] fiscal reform reconcile:', _frE); }
    // ── 13.7 官制履职 tick·官制活化 Slice②·确定性施加履职度→实征率/腐败（开关 officeDutyStateEnabled·默认关零回归）──
    try { _applyOfficeDutyTick(G); } catch(_odE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_odE, 'applier] office duty tick:') : console.warn('[applier] office duty tick:', _odE); }
    try { _applyRegentDecisions(G, aiOutput); } catch(_rdE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rdE, 'applier] regent decisions:') : console.warn('[applier] regent decisions:', _rdE); }
    try { _applyBattleResult(G, aiOutput, applied); } catch(_brE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_brE, 'applier] battle result:') : console.warn('[applier] battle result:', _brE); }

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
    try { if (typeof window !== 'undefined' && typeof window._validateLivingActorConsistency === 'function') window._validateLivingActorConsistency(G, aiOutput); } catch(_laE) { console.warn('[applier] livingActor guard:', _laE); }
    try { if (typeof window !== 'undefined' && typeof window._validateNarrativeAnachronism === 'function') window._validateNarrativeAnachronism(G, aiOutput); } catch(_anE) { console.warn('[applier] anachronism guard:', _anE); }

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
      imprison:   ['诏狱', '下诏狱', '入诏狱', '下狱', '入狱', '系狱', '收押', '收监', '关押', '囚禁', '拿问', '逮治', '槛车', '捉拿下狱', '逮捕下狱', '锁拿'],
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
    if (aiOutput.narrative)    t += String(aiOutput.narrative) + '\n';
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

  function _firstNarrativeHit(text, keywords) {
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) >= 0) return keywords[i];
    }
    return null;
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
    if (aiOutput.battleResult && aiOutput.battleResult.casualties) {
      var brLoss = aiOutput.battleResult.casualties;
      structuredTotal.loss += Math.max(0, Math.round(Number(brLoss.attacker || 0)));
      structuredTotal.loss += Math.max(0, Math.round(Number(brLoss.defender || 0)));
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
    var appointVerbs = '拜|擢|迁|转|命|授|任|升|进|起|起复|改任|擢任|超擢|兼任|兼职|加兼|兼领|兼署|兼管|兼摄';
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
          var r = onAppointment(m.name, m.post, { concurrent: /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(m.raw), reason: m.raw });
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

    var startKw = _firstNarrativeHit(narrative, warStartVerbs);
    var endKw = _firstNarrativeHit(narrative, warEndVerbs);
    var battleKw = _firstNarrativeHit(narrative, battleVerbs);
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

    var startKw = _firstNarrativeHit(narrative, revoltStartVerbs);
    var endKw = _firstNarrativeHit(narrative, revoltEndVerbs);
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
    var hasRelationFallback = applied && applied.semantic && applied.semantic.faction_field_fallback > 0 &&
      (G._turnReport || []).some(function(r){ return r && r.turn === (G.turn || 0) && r.type === 'faction_update' && r.field === 'relation'; });
    var hasFactionUpdate = fuArr.length > 0 || hasRelationFallback || (G.turnChanges && (G.turnChanges.factions||[]).length > 0);
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
    var hasCapitalMove = (G._turnReport || []).some(function(r){ return r && r.turn === (G.turn || 0) && r.type === 'faction_update' && r.field === 'capital'; }) ||
      (aiOutput.faction_updates || []).some(function(fu){ return fu && fu.updates && (fu.updates.capital || fu.updates.capitalName); });
    // 简单粗略：char_updates 中是否含 title/posthumous/spouse 修改
    var hasRelevantUpdate = charUpdates.some(function(c){
      if (!c || !c.changes) return false;
      var chKeys = Object.keys(c.changes||{});
      return chKeys.some(function(k){return /title|posthumous|spouse|wife|consort/i.test(k);});
    });
    var warnings = [];
    if (moveCapKw && !hasCapitalMove) warnings.push({ kind: 'capital_move_missing', keyword: moveCapKw, snippet: _snippetAround(narrative, moveCapKw, 30) });
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
    var charDeaths = aiOutput.character_deaths || [];
    var hasUpdate = charUpdates.some(function(c){return c && c.changes && Object.keys(c.changes).some(function(k){return /spouse|wife|consort|children|heir|inherited|succeeded/i.test(k);});});
    var warnings = [];
    if (marryKw && !hasUpdate) warnings.push({ kind: 'marriage_missing', keyword: marryKw, snippet: _snippetAround(narrative, marryKw, 30) });
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
      var cur = _readFiscalStock(G.guoku, w.resource);
      var actual;
      if (w.kind === 'income') {
        // 入：直接加（可抹平负债）
        _writeFiscalStock(G.guoku, w.resource, cur + w.shortfall);
        actual = w.shortfall;
        patch.shortfall = 0;
      } else {
        // 出：拨到见底
        actual = Math.min(cur, w.shortfall);
        if (cur > 0) {
          _writeFiscalStock(G.guoku, w.resource, cur - actual);
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
      var mtxt = (typeof memoryEntryText === 'function') ? memoryEntryText(mem) : ((mem.text || mem.content || '') + '');
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
        var memText = (typeof memoryEntryText === 'function') ? memoryEntryText(mem) : ((mem && (mem.text || mem.content)) || '');
        if (!mem || !memText) return true;
        return memText.indexOf(name) < 0;
      });
    }
    ch._epitaphed = true;
    G._turnReport.push({ type: 'epitaph', char: name, reason: epitaph.reason, turn: curTurn });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  移动对账层 S3·确定性兜底（2026-05-28）
  //  顽疾根因：人物移动 100% 靠 AI 自愿吐 char_updates.travelTo·AI 只叙事不吐字段→原地不动。
  //  本层在 AI 变更应用后·按 prep 捕获的玩家移动令逐条核对·AI 漏的引擎自己落地。
  // ═══════════════════════════════════════════════════════════════════
  // 是否有"即时/次回合抵达"类玩家持久规则/天意在线（决策2·规则纯 context·这里只读不改规则）
  function _hasInstantArrivalRule(G) {
    if (!G || !Array.isArray(G._playerDirectives)) return false;
    var moveKey = /人事|调动|调任|移动|移驻|赴任|召见|召还|到任|抵达|走位/;
    var instKey = /即刻|即时|瞬间|立即|当回合|次回合|疾驰|星夜|无在途|不在途|不存在.{0,3}在途/;
    return G._playerDirectives.some(function(d){
      if (!d) return false;
      if (d.type !== 'rule' && !d._absolute) return false;   // 仅持久规则/天意
      var t = (d.content || '') + ' ' + (d.structured ? JSON.stringify(d.structured) : '');
      return moveKey.test(t) && instKey.test(t);
    });
  }
  // 决策1·即时到达=系统型·须挂后果（轻量·不直写财政账本避免 desync·重后果可后续按距离/品级扩展）
  function _applyInstantArrivalCost(G, ch, mc) {
    try {
      if (typeof ch.stress === 'number') ch.stress = Math.min(100, ch.stress + 5); else ch.stress = 5;
      if (typeof global.addEB === 'function') global.addEB('人事', ch.name + ' 奉诏急递星夜驰抵 ' + mc.to + '·鞍马劳顿（即时到达·驿传代价）');
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type:'instant_arrival_cost', char: ch.name, to: mc.to, stress: 5, turn: G.turn || 0 });
    } catch(_){}
  }
  function _reconcilePlayerMovements(G) {
    if (!G || !Array.isArray(G._turnMoveCommands) || G._turnMoveCommands.length === 0) return;
    var cmds = G._turnMoveCommands;
    G._turnMoveCommands = [];   // 本回合消费一次·清空·避免跨回合重复兜底
    if (!Array.isArray(G.chars)) return;
    var instant = _hasInstantArrivalRule(G);
    var dateText = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));
    var fixed = 0;
    cmds.forEach(function(mc){
      if (!mc || !mc.char || !mc.to) return;
      var ch = null;
      for (var i = 0; i < G.chars.length; i++) { if (G.chars[i] && G.chars[i].name === mc.char) { ch = G.chars[i]; break; } }
      if (!ch) return;
      if (ch.alive === false) return;                                  // 已故不动
      if (_sameTravelLocation(ch.location || '', mc.to)) return;        // 已在目标地·达成
      var heading = ch._travelTo && _sameTravelLocation(ch._travelTo, mc.to);  // AI 已为此目标启程在途
      var cmdInstant = instant || !!mc.instant;                        // 即时=持久规则在线 或 本条移动令诏文直言即刻/瞬间(extractEdictMovements 标 mc.instant)
      if (heading && !cmdInstant) return;                              // 已在途·又无即时要求→尊重 AI 行程·不重复兜底
      if (typeof ch._travelAssignPost !== 'string') ch._travelAssignPost = '';
      if (cmdInstant) {
        // 即时抵达规则在线→当回合直接到位（AI 漏吐 或 只启了慢程·都压成即抵·满足"不存在在途"）+ 决策1后果
        if (!heading) ch._travelFrom = ch.location || '';
        ch._travelTo = mc.to;
        ch._travelReason = (mc.reason || '诏令移动') + '·急递即刻抵达(玩家规则)';
        _arriveCharNow(G, ch, dateText);
        _applyInstantArrivalCost(G, ch, mc);
      } else {
        // 无即时规则·AI 又漏了→引擎补启正常多回合行程（至少"走位起步"·不再原地不动）
        ch._travelFrom = ch.location || '';
        ch._travelTo = mc.to;
        ch._travelReason = (mc.reason || '诏令移动') + '·引擎补启';
        ch._travelStartTurn = G.turn || 0;
        ch._travelRemainingDays = _estimateTravelDays(ch._travelFrom, mc.to);
        try { _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []); } catch(_){}
        if (typeof global.addEB === 'function') global.addEB('人事', ch.name + ' 奉诏启程赴 ' + mc.to + '（引擎补启·AI 漏返 travelTo）');
      }
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type:'move_reconciled', char: ch.name, to: mc.to, instant: !!instant, turn: G.turn || 0 });
      fixed++;
    });
    if (fixed > 0 && typeof _refreshCharacterLocationUiAfterTravel === 'function') {
      try { _refreshCharacterLocationUiAfterTravel(); } catch(_){}
    }
  }
  global._reconcilePlayerMovements = _reconcilePlayerMovements;

  // ── P-VWF·2026-05-29·财政改革对账层 ──
  // 照 _reconcilePlayerMovements 范式·读 GM._turnFiscalReforms·按 type 确定性拨开关（必生效）·
  // 根治"玩家开源改革(肃贪/清丈/盐法/开海/劝农)未接入央地真账·中央月入死焊"。
  // 量：粗保底值（明示·owner 可调·绝非精细基线表）·只是 AI 没吐力度时的"必生效"兜底；
  // AI 按情境吐力度（2b-AI量）留后续 prompt 教 AI 再接·此处先保"生不生效"高一量级的红线。
  function _reconcilePlayerFiscalReforms(G, aiOutput) {
    if (!G || !Array.isArray(G._turnFiscalReforms) || G._turnFiscalReforms.length === 0) return;
    var reforms = G._turnFiscalReforms;
    G._turnFiscalReforms = [];   // 本回合消费一次·清空·避免跨回合重复兜底
    var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || null;
    var _P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
    var pFac = (_P && _P.playerInfo && _P.playerInfo.factionName) || '';
    if (!Array.isArray(G._turnReport)) G._turnReport = [];
    // 粗保底量（owner 可调·非精细分操作表·仅 AI 未吐力度时的必生效兜底）
    var BASE = { compliance: 0.05, saltRate: 0.05, corruption: 3 };
    // 2b-AI量：AI 按情境吐 reform_effects:[{type, complianceDelta?, rateDelta?}]·有则用 AI（夹护栏）·无则走 BASE 粗保底
    var aiMag = {};
    var _aiRe = (aiOutput && Array.isArray(aiOutput.reform_effects)) ? aiOutput.reform_effects : [];
    _aiRe.forEach(function(re) { if (re && re.type) aiMag[re.type] = re; });

    reforms.forEach(function(fr) {
      if (!fr || !fr.type) return;
      var detail = { type: fr.type };
      if (fr.type === 'anticorruption') {
        var cd = (aiMag.anticorruption && typeof aiMag.anticorruption.complianceDelta === 'number') ? Math.max(0, Math.min(0.2, aiMag.anticorruption.complianceDelta)) : BASE.compliance; // AI 给则用·夹护栏 0-0.2·无则粗保底
        var n = (FE && FE.adjustPlayerCompliance) ? FE.adjustPlayerCompliance(pFac, cd, 0.1, 1) : 0;
        if (n === 0 && FE && FE.adjustPlayerCompliance) n = FE.adjustPlayerCompliance('', cd, 0.1, 1); // 势力key对不上→不过滤兜底·保必生效
        detail.complianceUp = cd; detail.fromAI = !!aiMag.anticorruption; detail.divisions = n;
        // P-DZ·吏治接浊度：肃贪降浊度。落点已查死（aggregateRegionsToVariables endturn 把 div.corruption 聚合→subDepts.provincial.true，会覆盖直接写的 provincial），故分两条：
        //   ① provincial 半 + cascade 中央月入：降源头 div.corruption（cascade corrPenalty 直接读·computeTaxAmount→实收；回合末 aggregate 把它聚合成 provincial.true→实征率面板·持久不回弹）
        //   ② fiscal 半：独立全局口·aggregate 不覆盖·直接降 subDepts.fiscal.true + sync（当回合即反映实征率财政半）
        // 确定性管「降这件事 + 护栏」，量交 AI（corruptionDelta 夹 0~15）·无则粗保底
        try {
          var corrDrop = (aiMag.anticorruption && typeof aiMag.anticorruption.corruptionDelta === 'number') ? Math.max(0, Math.min(15, aiMag.anticorruption.corruptionDelta)) : BASE.corruption; // AI 给则用·夹 0~15·无则粗保底
          // ① 降源头 div.corruption（cascade 中央月入 + 回合末 aggregate→provincial.true）
          var _divN = (FE && FE.adjustPlayerDivisionCorruption) ? FE.adjustPlayerDivisionCorruption(pFac, -corrDrop, 0, 100) : 0;
          if (_divN === 0 && FE && FE.adjustPlayerDivisionCorruption) _divN = FE.adjustPlayerDivisionCorruption('', -corrDrop, 0, 100); // 势力 key 对不上→不过滤兜底·保必生效
          // ② fiscal 独立全局口·直接降 + sync（当回合即反映）
          var _CE = (typeof global !== 'undefined' && global.CorruptionEngine) || (typeof window !== 'undefined' && window.CorruptionEngine) || null;
          var _GMc = (typeof global !== 'undefined' && global.GM) || G; // 与 corruption-engine 同源
          if (_GMc && _GMc.corruption && _GMc.corruption.subDepts && _GMc.corruption.subDepts.fiscal && typeof _GMc.corruption.subDepts.fiscal.true === 'number') {
            _GMc.corruption.subDepts.fiscal.true = Math.max(0, _GMc.corruption.subDepts.fiscal.true - corrDrop);
            if (_CE && typeof _CE.syncIndexFromSubDepts === 'function') _CE.syncIndexFromSubDepts('肃贪整饬吏治（P-DZ·财政口·实征率回升）');
          }
          detail.corruptionDrop = corrDrop; detail.corruptionDivisions = _divN; detail.corruptionFromAI = !!(aiMag.anticorruption && typeof aiMag.anticorruption.corruptionDelta === 'number');
        } catch (_dzE) {}
      } else if (fr.type === 'landsurvey') {
        var ns = (FE && FE.triggerPlayerSurvey) ? FE.triggerPlayerSurvey(pFac) : 0;
        if (ns === 0 && FE && FE.triggerPlayerSurvey) ns = FE.triggerPlayerSurvey('');
        detail.surveyed = ns;
      } else if (fr.type === 'saltreform') {
        if (!G.policies) G.policies = {};
        var cur = typeof G.policies.saltTaxRate === 'number' ? G.policies.saltTaxRate : 0.40;
        var sd = (aiMag.saltreform && typeof aiMag.saltreform.rateDelta === 'number') ? Math.max(-0.2, Math.min(0.2, aiMag.saltreform.rateDelta)) : BASE.saltRate; // AI 给则用·夹护栏 ±0.2·无则粗保底
        G.policies.saltTaxRate = Math.max(0, Math.min(0.8, cur + sd)); // 护栏·税率不破0.8崩档
        detail.saltTaxRate = G.policies.saltTaxRate; detail.fromAI = !!aiMag.saltreform;
      } else if (fr.type === 'openmaritime') {
        if (G._maritimeBan) G._maritimeBan = { active: false, turn: G.turn || 0 };
        detail.maritimeBanLifted = true;
      } else if (fr.type === 'encouragefarming') {
        if (!G.policies) G.policies = {};
        G.policies.encourageFarming = true;
        detail.encourageFarming = true;
      } else {
        return;
      }
      G._turnReport.push({ type: 'fiscal_reform_reconciled', reform: fr.type, detail: detail, turn: G.turn || 0 });
      if (typeof global.addEB === 'function') global.addEB('财政改革', ({anticorruption:'肃贪',landsurvey:'丈田',saltreform:'盐政改革',openmaritime:'开海通商',encouragefarming:'劝农'}[fr.type]||fr.type) + '·已确定性落账·必生效');
    });
  }
  global._reconcilePlayerFiscalReforms = _reconcilePlayerFiscalReforms;

  // ── 官制活化 Slice②·履职 tick → 实征率/腐败（确定性·开关 officeDutyStateEnabled·默认关零回归）──
  // 每回合调 tickOfficeDutyState：失职扣/称职奖·按抽象 power 映射既有 FE 杠杆（taxCollect→compliance·supervise/impeach→corruption）。
  function _applyOfficeDutyTick(G) {
    if (typeof officeFlagOn !== 'function' || !officeFlagOn('officeDutyStateEnabled')) return;
    if (typeof tickOfficeDutyState !== 'function') return;
    var agg = tickOfficeDutyState(G);
    if (!agg || (!agg.compliance && !agg.corruption)) return;
    var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || null;
    var _P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
    var pFac = (_P && _P.playerInfo && _P.playerInfo.factionName) || '';
    if (!FE) return;
    if (agg.compliance && FE.adjustPlayerCompliance) {
      var nc = FE.adjustPlayerCompliance(pFac, agg.compliance, 0.1, 1);
      if (nc === 0) FE.adjustPlayerCompliance('', agg.compliance, 0.1, 1);   // 势力 key 对不上→不过滤兜底·保生效
    }
    if (agg.corruption && FE.adjustPlayerDivisionCorruption) {
      var nk = FE.adjustPlayerDivisionCorruption(pFac, agg.corruption, 0, 100);
      if (nk === 0) FE.adjustPlayerDivisionCorruption('', agg.corruption, 0, 100);
    }
    try {
      if (typeof global.addEB === 'function' && agg.details && agg.details.length) {
        var _low = agg.details.filter(function (x) { return x.band === 'low'; }).map(function (x) { return x.dept + (x.pos || ''); });
        var _high = agg.details.filter(function (x) { return x.band === 'high'; }).map(function (x) { return x.dept + (x.pos || ''); });
        var _seg = [];
        if (_low.length) _seg.push('失职：' + _low.join('、'));
        if (_high.length) _seg.push('称职：' + _high.join('、'));
        if (_seg.length) { global.addEB('官制', '履职结算·' + _seg.join('；') + '（实征率' + (agg.compliance >= 0 ? '+' : '') + agg.compliance.toFixed(3) + '·腐败' + (agg.corruption >= 0 ? '+' : '') + agg.corruption.toFixed(1) + '）'); if (!Array.isArray(G._chronicle)) G._chronicle = []; G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: (agg.compliance !== 0 && agg.corruption !== 0) ? '官制↔财政·吏治' : (agg.corruption !== 0 ? '官制↔吏治' : '官制↔财政'), text: '百官履职·' + _seg.join('；') + '·实征率' + (agg.compliance >= 0 ? '+' : '') + agg.compliance.toFixed(3) + '·吏治' + (agg.corruption >= 0 ? '+' : '') + agg.corruption.toFixed(1), tags: ['联动', '官制'] }); }
      }
    } catch (_ebE) {}
  }
  global._applyOfficeDutyTick = _applyOfficeDutyTick;

  // ── 官制活化 Slice③ 权限门·税类 income 执行力打折（颁布权≠执行力·开关 officeAuthorityGateEnabled·默认关零回归）──
  function _isTaxIncome(fa) {
    var s = String((fa.category || '') + '|' + (fa.name || '') + '|' + (fa.reason || ''));
    if (/缴获|贡纳|进贡|赏赐|罚没|抄没|抄家|捐纳|卖官|借款|赎银|缴还/.test(s)) return false;
    return /加赋|加派|加征|田赋|商税|盐课|盐税|关税|榷|赋税|税赋|征税|催征|追征|辽饷|练饷|剿饷|杂税|丁银|条鞭|火耗|正赋|钱粮|税银/.test(s);
  }
  function _applyTaxAuthorityGate(G, fa, amount) {
    if (typeof officeFlagOn !== 'function' || !officeFlagOn('officeAuthorityGateEnabled')) return amount;
    if (typeof resolveOfficeAuthority !== 'function') return amount;
    if (!(amount > 0) || fa.kind !== 'income' || !_isTaxIncome(fa)) return amount;
    var auth = resolveOfficeAuthority(G, 'taxCollect');
    if (!auth || auth.effectiveness >= 1) return amount;             // 称职满效·不打折
    var collected = Math.round(amount * auth.effectiveness);
    var shortfall = amount - collected;
    if (shortfall > 0) {
      try {
        var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || null;
        if (FE && FE.adjustPlayerDivisionCorruption) {
          var _P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
          var pFac = (_P && _P.playerInfo && _P.playerInfo.factionName) || '';
          var corrBump = Math.min(8, (1 - auth.effectiveness) * 10);  // 漏额→中饱私囊·失效越狠涨越多·夹8
          var nn = FE.adjustPlayerDivisionCorruption(pFac, corrBump, 0, 100);
          if (nn === 0) FE.adjustPlayerDivisionCorruption('', corrBump, 0, 100);
        }
      } catch (_cgE) {}
    }
    try { if (typeof global.addEB === 'function') global.addEB('官制', '加赋失实·' + (fa.name || fa.category || '税入') + ' 原额' + amount + ' → 实收' + collected + '（×' + auth.effectiveness.toFixed(2) + '·' + auth.reason + '·漏额中饱）'); } catch (_egE) {}
    try { if (!Array.isArray(G._chronicle)) G._chronicle = []; G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: '官制↔财政·吏治', text: '掌征税之权' + auth.reason + '·' + (fa.name || fa.category || '税入') + ' 加赋原额' + amount + '·实收' + collected + '·漏额' + shortfall + '中饱', tags: ['联动', '官制'] }); } catch (_cgE2) {}
    return collected;
  }
  global._applyTaxAuthorityGate = _applyTaxAuthorityGate;

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

  function _applyRegentDecisions(G, aiOutput) {
    if (!G) return;
    var signal = G.regentSignal || (G.regentState && G.regentState.signal) || null;
    var decisions = aiOutput && Array.isArray(aiOutput.regent_decisions) ? aiOutput.regent_decisions : [];
    if (!signal && decisions.length === 0) {
      if (G.regentState && G.regentState.active === true) {
        G.regentState.active = false;
        G.regentState.hardCeiling = false;
        G.regentState.lastDecisionTurn = G.turn || 0;
      }
      return;
    }
    if (!G.regentState || typeof G.regentState !== 'object') G.regentState = {};
    G.regentState.signal = signal || G.regentState.signal || null;
    G.regentState.decisions = decisions.map(function(r) {
      return {
        subject: r && r.subject || '',
        regentName: r && r.regentName || '',
        action: r && r.action || 'defer',
        hardCeiling: !!(r && r.hardCeiling),
        reason: r && r.reason || ''
      };
    });
    G.regentState.active = !!(signal && signal.active);
    G.regentState.hardCeiling = !!(signal && signal.hardCeiling);
    G.regentState.lastDecisionTurn = G.turn || 0;
    if (signal) {
      G.regentState.rulerName = signal.rulerName || '';
      G.regentState.rulerTitle = signal.rulerTitle || '';
      G.regentState.rulerAge = signal.rulerAge;
      G.regentState.rulerHealth = signal.rulerHealth;
      G.regentState.playerRole = signal.playerRole || '';
      G.regentState.reasons = signal.reasons || [];
    }
    decisions.forEach(function(r) {
      G._turnReport.push({
        type: 'regent_decision',
        subject: r && r.subject || '',
        regentName: r && r.regentName || '',
        action: r && r.action || 'defer',
        hardCeiling: !!(r && r.hardCeiling),
        reason: r && r.reason || '',
        turn: G.turn || 0
      });
    });
  }
  global._applyRegentDecisions = _applyRegentDecisions;

  function _tmGateReason(label, reason, item) {
    var payload = { label: label || '', reason: reason || '', item: item || null };
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_gate', payload); } catch(_) {}
    _tmPushAIWeakHint(label, reason, item);
    return false;
  }

  function _tmNormName(name) {
    return String(name || '').trim().replace(/[\s·\-—、，。（）()《》“”"'：:；;！？?]/g, '');
  }

  function _tmNameOf(entity) {
    return entity && (entity.name || entity.id || entity.title || entity.label);
  }

  function _tmAliasHit(entity, raw, norm) {
    if (!entity) return false;
    var fields = ['_aliases', 'aliases', 'alias', 'courtesyName', 'zi', 'hao', 'posthumousName', 'templeName'];
    for (var i = 0; i < fields.length; i++) {
      var v = entity[fields[i]];
      if (!v) continue;
      var arr = Array.isArray(v) ? v : String(v).split(/[、,，/|;]/);
      for (var j = 0; j < arr.length; j++) {
        var a = String(arr[j] || '').trim();
        if (a && (a === raw || _tmNormName(a) === norm)) return true;
      }
    }
    return false;
  }

  function _tmFindInList(list, name) {
    if (!Array.isArray(list) || !name) return null;
    var raw = String(name).trim();
    var norm = _tmNormName(raw);
    if (!norm) return null;
    var i, e, en;
    for (i = 0; i < list.length; i++) {
      e = list[i]; en = _tmNameOf(e);
      if (e && en && String(en).trim() === raw) return e;
    }
    for (i = 0; i < list.length; i++) {
      e = list[i]; en = _tmNameOf(e);
      if (e && en && _tmNormName(en) === norm) return e;
    }
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (_tmAliasHit(e, raw, norm)) return e;
    }
    return null;
  }

  function _tmGetScenario(G) {
    try {
      if (typeof global.findScenarioById === 'function' && G && G.sid) return global.findScenarioById(G.sid);
    } catch(_) {}
    return null;
  }

  function _tmPushArrays(root, keys, out) {
    if (!root || typeof root !== 'object') return;
    keys.forEach(function(k) {
      if (Array.isArray(root[k])) out.push(root[k]);
    });
  }

  function _tmResolveChar(G, name) {
    if (!name || !G) return null;
    var active = _tmFindInList(G.chars || [], name);
    if (active) return { entity: active, source: 'GM.chars', active: true };
    try {
      if (global.DA && global.DA.chars && typeof global.DA.chars.findByName === 'function') {
        var da = global.DA.chars.findByName(name);
        if (da) return { entity: da, source: 'DA.chars', active: !!_tmFindInList(G.chars || [], _tmNameOf(da) || name) };
      }
    } catch(_) {}
    try {
      if (typeof global._fuzzyFindChar === 'function') {
        var fuzzy = global._fuzzyFindChar(name);
        if (fuzzy) return { entity: fuzzy, source: '_fuzzyFindChar', active: !!_tmFindInList(G.chars || [], _tmNameOf(fuzzy) || name) };
      }
    } catch(_) {}
    var all = _tmFindInList(G.allCharacters || [], name);
    if (all) return { entity: all, source: 'GM.allCharacters', active: false };
    var sc = _tmGetScenario(G);
    var sd = global.scriptData || {};
    var buckets = [];
    _tmPushArrays(sd, ['characters', 'chars', 'npcs', 'persons', 'allCharacters'], buckets);
    _tmPushArrays(sc, ['characters', 'chars', 'npcs', 'persons', 'allCharacters'], buckets);
    for (var i = 0; i < buckets.length; i++) {
      var hit = _tmFindInList(buckets[i], name);
      if (hit) return { entity: hit, source: 'scenario.characters', active: false };
    }
    return null;
  }

  function _tmResolveFaction(G, name) {
    if (!name || !G) return null;
    var active = _tmFindInList(G.facs || [], name);
    if (active) return { entity: active, source: 'GM.facs', active: true };
    try {
      if (global.DA && global.DA.factions && typeof global.DA.factions.findByName === 'function') {
        var da = global.DA.factions.findByName(name);
        if (da) return { entity: da, source: 'DA.factions', active: !!_tmFindInList(G.facs || [], _tmNameOf(da) || name) };
      }
    } catch(_) {}
    try {
      if (typeof global._fuzzyFindFac === 'function') {
        var fuzzy = global._fuzzyFindFac(name);
        if (fuzzy) return { entity: fuzzy, source: '_fuzzyFindFac', active: !!_tmFindInList(G.facs || [], _tmNameOf(fuzzy) || name) };
      }
    } catch(_) {}
    var sc = _tmGetScenario(G);
    var sd = global.scriptData || {};
    var buckets = [];
    _tmPushArrays(G, ['factions', 'allFactions', 'extForces'], buckets);
    _tmPushArrays(sd, ['factions', 'facs', 'allFactions', 'extForces'], buckets);
    _tmPushArrays(sc, ['factions', 'facs', 'allFactions', 'extForces'], buckets);
    for (var i = 0; i < buckets.length; i++) {
      var hit = _tmFindInList(buckets[i], name);
      if (hit) return { entity: hit, source: 'scenario.factions', active: false };
    }
    return null;
  }

  function _tmPushAIWeakHint(label, reason, item, resolution) {
    var G = global.GM;
    if (!G) return true;
    var hint = {
      label: label || '',
      reason: reason || '',
      itemName: item && (item.name || item.faction || item.newLeader || item.target || ''),
      source: resolution && resolution.source || '',
      active: resolution ? !!resolution.active : null,
      turn: G.turn || 0
    };
    if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
    G._aiWeakWriteHints.push(hint);
    if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', hint); } catch(_) {}
    return true;
  }

  function _tmWeakEntityHint(label, reason, item, resolution) {
    _tmPushAIWeakHint(label, reason, item, resolution);
    return true;
  }

  function preflightAIWriteBack(aiOutput, opts) {
    var G = global.GM;
    if (!G || !aiOutput || typeof aiOutput !== 'object') return aiOutput;
    opts = opts || {};
    var blocked = 0;
    function keepArray(field, label, fn) {
      if (!Array.isArray(aiOutput[field])) return;
      var kept = [];
      aiOutput[field].forEach(function(item) {
        if (fn(item)) kept.push(item);
        else blocked++;
      });
      aiOutput[field] = kept;
    }

    keepArray('character_deaths', 'character_deaths', function(d) {
      if (!d || !d.name) return _tmGateReason('character_deaths', 'missing name', d);
      var chRes = _tmResolveChar(G, d.name);
      if (!chRes) return _tmWeakEntityHint('character_deaths', 'char seems not in current known lists: ' + d.name, d, chRes);
      var ch = chRes.entity;
      if (!chRes.active) _tmPushAIWeakHint('character_deaths', 'char seems known but not in active roster: ' + d.name, d, chRes);
      if (ch.alive === false || ch.dead === true) return _tmGateReason('character_deaths', 'char already dead: ' + d.name, d);
      if (!(d.cause || d.reason || d.deathReason)) return _tmGateReason('character_deaths', 'missing cause/reason: ' + d.name, d);
      return true;
    });

    keepArray('faction_create', 'faction_create', function(fc) {
      if (!fc || !fc.name) return _tmGateReason('faction_create', 'missing name', fc);
      var fcRes = _tmResolveFaction(G, fc.name);
      if (fcRes && fcRes.active) return _tmGateReason('faction_create', 'duplicate active faction: ' + fc.name, fc);
      if (fcRes && !fcRes.active) _tmPushAIWeakHint('faction_create', 'faction name seems known outside active roster: ' + fc.name, fc, fcRes);
      if (!(fc.reason || fc.triggerEvent || fc.origin || fc.parentFaction)) return _tmGateReason('faction_create', 'missing reason/trigger: ' + fc.name, fc);
      return true;
    });

    keepArray('faction_succession', 'faction_succession', function(sc) {
      if (!sc || !sc.faction || !sc.newLeader) return _tmGateReason('faction_succession', 'missing faction/newLeader', sc);
      var facRes = _tmResolveFaction(G, sc.faction);
      var leaderRes = _tmResolveChar(G, sc.newLeader);
      if (!facRes) return _tmWeakEntityHint('faction_succession', 'faction seems not in current known lists: ' + sc.faction, sc, facRes);
      if (!facRes.active) _tmPushAIWeakHint('faction_succession', 'faction seems known but not active: ' + sc.faction, sc, facRes);
      if (!leaderRes) return _tmWeakEntityHint('faction_succession', 'newLeader seems not in current known lists: ' + sc.newLeader, sc, leaderRes);
      if (!leaderRes.active) _tmPushAIWeakHint('faction_succession', 'newLeader seems known but not active: ' + sc.newLeader, sc, leaderRes);
      return true;
    });

    keepArray('faction_dissolve', 'faction_dissolve', function(fd) {
      if (!fd || !fd.name) return _tmGateReason('faction_dissolve', 'missing name', fd);
      var facRes = _tmResolveFaction(G, fd.name);
      if (!facRes) return _tmWeakEntityHint('faction_dissolve', 'faction seems not in current known lists: ' + fd.name, fd, facRes);
      var fac = facRes.entity;
      if (!facRes.active) _tmPushAIWeakHint('faction_dissolve', 'faction seems known but not active: ' + fd.name, fd, facRes);
      if (fac.isPlayer) return _tmGateReason('faction_dissolve', 'player faction cannot dissolve: ' + fd.name, fd);
      if (!(fd.cause || fd.reason)) return _tmGateReason('faction_dissolve', 'missing cause/reason: ' + fd.name, fd);
      if ((fd.cause === 'conquered' || fd.cause === 'absorbed') && fd.conqueror) {
        var conquerorRes = _tmResolveFaction(G, fd.conqueror);
        if (!conquerorRes) return _tmWeakEntityHint('faction_dissolve', 'conqueror seems not in current known lists: ' + fd.conqueror, fd, conquerorRes);
        if (!conquerorRes.active) _tmPushAIWeakHint('faction_dissolve', 'conqueror seems known but not active: ' + fd.conqueror, fd, conquerorRes);
      }
      return true;
    });

    keepArray('office_assignments', 'office_assignments', function(oa) {
      if (!oa || !oa.name) return _tmGateReason('office_assignments', 'missing name', oa);
      var oaRes = _tmResolveChar(G, oa.name);
      if (!oaRes) return _tmWeakEntityHint('office_assignments', 'char seems not in current known lists: ' + oa.name, oa, oaRes);
      if (!oaRes.active) _tmPushAIWeakHint('office_assignments', 'char seems known but not active roster: ' + oa.name, oa, oaRes);
      var action = String(oa.action || 'appoint').toLowerCase();
      if (/兼/.test(String(oa.action || ''))) action = 'appoint';
      if (action === 'concurrent') action = 'appoint';
      if ((action === 'appoint' || action === 'transfer') && !oa.post) return _tmGateReason('office_assignments', 'missing post: ' + oa.name, oa);
      return true;
    });

    keepArray('fiscal_adjustments', 'fiscal_adjustments', function(fa) {
      if (!fa || !fa.target || !fa.kind) return _tmGateReason('fiscal_adjustments', 'missing target/kind', fa);
      if (fa.kind !== 'income' && fa.kind !== 'expense') return _tmGateReason('fiscal_adjustments', 'invalid kind: ' + fa.kind, fa);
      var fiscalAction = String(fa.action || fa.op || 'add').toLowerCase();
      if (fiscalAction === 'modify' || fiscalAction === 'set') fiscalAction = 'update';
      if (fiscalAction === 'delete' || fiscalAction === 'disable' || fiscalAction === 'cancel') fiscalAction = 'stop';
      if (fiscalAction !== 'stop' && fiscalAction !== 'remove' && !(parseFloat(fa.amount) > 0)) return _tmGateReason('fiscal_adjustments', 'invalid amount', fa);
      if (fa.target !== 'guoku' && fa.target !== 'neitang' && !/^province:/.test(String(fa.target))) {
        return _tmGateReason('fiscal_adjustments', 'invalid target: ' + fa.target, fa);
      }
      return true;
    });

    if (aiOutput.battleResult) {
      var br = aiOutput.battleResult;
      if (!br.winnerFactionId || !br.loserFactionId) {
        _tmGateReason('battleResult', 'missing winnerFactionId/loserFactionId', br);
        delete aiOutput.battleResult;
        blocked++;
      }
    }

    if (blocked > 0) {
      try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_gate_summary', { blocked: blocked, source: opts.source || '' }); } catch(_) {}
    }
    return aiOutput;
  }
  global.preflightAIWriteBack = preflightAIWriteBack;

  function _applyBattleResult(G, aiOutput, applied) {
    if (!G || !aiOutput || !aiOutput.battleResult) return;
    var api = global.MilitarySystems || (global.TM && global.TM.MilitarySystems);
    if (!api || typeof api.applyBattleResult !== 'function') {
      if (applied && applied.failed) applied.failed.push({ battleResult: true, reason: 'MilitarySystems missing' });
      return;
    }
    var r = api.applyBattleResult(aiOutput.battleResult, G);
    if (r && r.ok) {
      if (applied) {
        if (!applied.semantic) applied.semantic = {};
        applied.semantic.battleResult = 1;
      }
      if (!G._turnReport) G._turnReport = [];
      G._turnReport.push({
        type: 'battleResult',
        battleId: r.result && r.result.battleId,
        winner: r.result && r.result.winner,
        loser: r.result && r.result.loser,
        turn: G.turn || 0
      });

      // 标记败方主帅(幸存败将)·供 NPC 战败涟漪反应(_npcDefeatRipple)。阵亡者 alive=false·走死亡涟漪不在此标。
      try {
        var _cfBR = aiOutput.battleResult.commanderFate;
        if (_cfBR && _cfBR.name && /败|挫|溃|defeat|rout|擒|俘|captur|surrender|降|逃|escap|伤|wound/i.test(String(_cfBR.outcome || ''))) {
          var _cfChBR = (G.chars || []).find(function(c){ return c && c.name === _cfBR.name; });
          if (_cfChBR && _cfChBR.alive !== false) { _cfChBR._defeatTurn = G.turn || 0; _cfChBR._defeatReason = String(_cfBR.outcome || '战败'); }
        }
      } catch (_dfBR) {}

      // P-5TK 第二刀：玩家方军胜 → 皇威加分（病根②：军功此前几乎不接皇威，金州/喜峰口胜仗皇威累计≈0）
      // 确定性管「赢了必加 + 护栏 + 保守保底（防面板纹丝不动）」；量优先 AI(battleResult.huangweiDelta)，AI 没吐才走保底
      try {
        var _AE5TK = global.AuthorityEngines || (global.TM && global.TM.AuthorityEngines);
        if (_AE5TK && typeof _AE5TK.adjustHuangwei === 'function') {
          var _winId5TK = String(aiOutput.battleResult.winnerFactionId || aiOutput.battleResult.winnerFaction || aiOutput.battleResult.winner || (r.result && r.result.winner) || '').trim();
          // 宁漏不误：在 G.facs 按 name/id 找到 winner 对应势力、确认 isPlayer 才加；拿不准就不加（绝不给敌胜误涨皇威）
          var _winFac5TK = _winId5TK ? (G.facs || []).find(function(f){ return f && (f.name === _winId5TK || f.id === _winId5TK); }) : null;
          var _P5TK = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
          var _pName5TK = (_P5TK && _P5TK.playerInfo && _P5TK.playerInfo.factionName) || '';
          var _isPlayerWin5TK = !!(_winFac5TK && _winFac5TK.isPlayer) || (!!_pName5TK && _winId5TK === _pName5TK);
          if (_isPlayerWin5TK) {
            var P5TK_HW_WIN_BASE = 2;   // 军胜皇威保底加分（AI 未吐量时兜底·可调）
            var P5TK_HW_WIN_CAP = 8;    // 单场皇威加分护栏上限（防 AI 吐爆表·可调）
            var _aiHw5TK = Number(aiOutput.battleResult.huangweiDelta);
            var _hwGain5TK = (isFinite(_aiHw5TK) && _aiHw5TK > 0) ? Math.min(_aiHw5TK, P5TK_HW_WIN_CAP) : P5TK_HW_WIN_BASE;
            if (_hwGain5TK > 0) {
              var _hwR5TK = _AE5TK.adjustHuangwei('militaryVictory', _hwGain5TK, '玩家方军胜·' + _winId5TK + '（P-5TK 军功接皇威）');
              if (applied) {
                if (!applied.semantic) applied.semantic = {};
                applied.semantic.huangweiMilitaryVictory = (_hwR5TK && _hwR5TK.delta) || _hwGain5TK;
              }
            }
          }
        }
      } catch (_e5TK) {}
    } else if (applied && applied.failed) {
      applied.failed.push({ battleResult: true, reason: r && r.reason });
    }
  }
  global._applyBattleResult = _applyBattleResult;

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
          if (typeof global.adjustCharacterLoyalty === 'function') {
            global.adjustCharacterLoyalty(c, -Math.round(totalMult * 0.08), '\u56FD\u7528\u7A98\u8FEB\u5BFC\u81F4\u519B\u5FC3\u52A8\u6447', { source:'resource-deficit-military-loyalty', oncePerTurn:true });
          } else {
            c.loyalty = Math.max(0, c.loyalty - Math.round(totalMult * 0.08));
          }
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
      institutionLifecycle: byType.institution_lifecycle || [],
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
    if (rep.institutionLifecycle.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【制度运行】</div>';
      rep.institutionLifecycle.forEach(function(i) {
        var label = ({ created:'新设', underfunded:'欠费', corruption_high:'腐化', abolished:'裁撤' }[i.action] || i.action || '状态');
        html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + _esc(label) + ' <b>' + _esc(i.name) + '</b>' + (i.text ? '：' + _esc(i.text) : '') + '</div>';
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

  function _getFiscalContextTurnDays(G) {
    if (typeof global._getDaysPerTurn === 'function') {
      try {
        var d = Number(global._getDaysPerTurn());
        if (d > 0) return d;
      } catch(_) {}
    }
    if (global.P && P.time && Number(P.time.daysPerTurn) > 0) return Number(P.time.daysPerTurn);
    if (G && G.guoku && Number(G.guoku.turnDays) > 0) return Number(G.guoku.turnDays);
    return 30;
  }

  function _isFiscalContextEntryActive(entry, G) {
    if (!entry) return false;
    if (entry.stopAfterTurn !== undefined && entry.stopAfterTurn !== null &&
        (G.turn || 0) > Number(entry.stopAfterTurn)) return false;
    return true;
  }

  function _normalizeFiscalContextEntry(target, kind, entry, monthRatio, G) {
    if (!_isFiscalContextEntryActive(entry, G)) return null;
    var recurring = !!entry.recurring;
    var amount = Math.max(0, Number(entry.amount) || 0);
    var turnAmount = recurring
      ? amount / 12 * monthRatio
      : (entry.applied !== undefined ? Math.max(0, Number(entry.applied) || 0) : amount);
    return {
      target: target,
      kind: kind,
      resource: (entry.resource === 'grain' || entry.resource === 'cloth') ? entry.resource : 'money',
      name: entry.name || entry.category || '',
      category: entry.category || '',
      annualAmount: recurring ? amount : 0,
      amount: amount,
      turnAmount: turnAmount,
      recurring: recurring,
      addedTurn: entry.addedTurn || 0,
      stopAfterTurn: entry.stopAfterTurn || null,
      lastSettledTurn: entry.lastSettledTurn || null,
      executionStatus: entry.executionStatus || '',
      shortfall: Number(entry.shortfall) || 0,
      reason: entry.reason || ''
    };
  }

  function _buildFiscalDynamicContext(G) {
    var turnDays = _getFiscalContextTurnDays(G);
    var monthRatio = turnDays / 30;
    var result = {
      turnDays: turnDays,
      monthRatio: monthRatio,
      active: [],
      byTarget: {
        guoku: { income: [], expense: [] },
        neitang: { income: [], expense: [] }
      },
      provinces: []
    };

    function pushEntry(target, kind, entry, bucket) {
      var item = _normalizeFiscalContextEntry(target, kind, entry, monthRatio, G);
      if (!item) return;
      bucket.push(item);
      if (item.recurring) result.active.push(item);
    }

    if (G.guoku) {
      (G.guoku.extraIncome || []).forEach(function(entry) { pushEntry('guoku', 'income', entry, result.byTarget.guoku.income); });
      (G.guoku.extraExpense || []).forEach(function(entry) { pushEntry('guoku', 'expense', entry, result.byTarget.guoku.expense); });
    }
    if (G.neitang) {
      (G.neitang.extraIncome || []).forEach(function(entry) { pushEntry('neitang', 'income', entry, result.byTarget.neitang.income); });
      (G.neitang.extraExpense || []).forEach(function(entry) { pushEntry('neitang', 'expense', entry, result.byTarget.neitang.expense); });
    }

    function walkDivs(divs) {
      (divs || []).forEach(function(div) {
        if (!div) return;
        if (div.extraFiscal) {
          var bucket = { id: div.id || '', name: div.name || div.id || '', income: [], expense: [] };
          (div.extraFiscal.income || []).forEach(function(entry) {
            pushEntry('province:' + bucket.name, 'income', entry, bucket.income);
          });
          (div.extraFiscal.expense || []).forEach(function(entry) {
            pushEntry('province:' + bucket.name, 'expense', entry, bucket.expense);
          });
          if (bucket.income.length || bucket.expense.length) result.provinces.push(bucket);
        }
        if (div.children) walkDivs(div.children);
        if (div.divisions) walkDivs(div.divisions);
      });
    }
    if (G.adminHierarchy) {
      Object.keys(G.adminHierarchy).forEach(function(key) {
        var tree = G.adminHierarchy[key];
        if (tree && tree.divisions) walkDivs(tree.divisions);
      });
    }
    result.active.sort(function(a, b) { return Math.abs(b.turnAmount || 0) - Math.abs(a.turnAmount || 0); });
    return result;
  }

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
        guoku: G.guoku ? {
          money: G.guoku.money !== undefined ? G.guoku.money : G.guoku.balance,
          grain: G.guoku.grain,
          cloth: G.guoku.cloth,
          annualIncome: G.guoku.annualIncome,
          monthlyIncome: G.guoku.monthlyIncome,
          monthlyExpense: G.guoku.monthlyExpense,
          turnIncome: G.guoku.turnIncome,
          turnExpense: G.guoku.turnExpense,
          turnDays: G.guoku.turnDays,
          armory: (typeof window !== 'undefined' && window.TMArmory) ? window.TMArmory.allStock(G) : undefined,      // 军备库(甲胄/兵刃/弓弩/火器/战马)·供AI推演军务可读
          materials: (typeof window !== 'undefined' && window.TMArmory) ? window.TMArmory.matAllStock(G) : undefined,  // 原料库(铁/硝石/皮革/木)
          armoryReadiness: (typeof window !== 'undefined' && window.TMArmory && window.TMArmory.readinessForAI) ? window.TMArmory.readinessForAI(G) : undefined  // 军备研判(储备vs全军需求·充盈/够用/偏紧/紧缺)·供AI推演判军事虚实(火器紧缺→不宜倚火器决胜)
        } : null,
        neitang: G.neitang ? {
          money: G.neitang.money !== undefined ? G.neitang.money : G.neitang.balance,
          grain: G.neitang.grain,
          cloth: G.neitang.cloth,
          huangzhuangAcres: G.neitang.huangzhuangAcres,
          monthlyIncome: G.neitang.monthlyIncome,
          monthlyExpense: G.neitang.monthlyExpense,
          turnIncome: G.neitang.turnIncome,
          turnExpense: G.neitang.turnExpense
        } : null,
        fiscalDynamic: _buildFiscalDynamicContext(G),
        population: G.population ? { national: G.population.national, fugitives: G.population.fugitives, hiddenCount: G.population.hiddenCount } : null,
        corruption: _getVarState(G.corruption)
      },
      npcs: _getImportantNpcs(G),
      factions: G.facs || [],
      recentEvents: _getRecentEvents(G),
      recentInstitutionLifecycle: _getRecentInstitutionLifecycle(G),
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
      index: v.index !== undefined ? v.index : (v.trueIndex !== undefined ? v.trueIndex : v.overall),
      perceivedIndex: v.perceivedIndex,
      phase: v.phase,
      subDims: v.subDims,
      tyrantSyndrome: v.tyrantSyndrome && v.tyrantSyndrome.active,
      lostCrisis: v.lostAuthorityCrisis && v.lostAuthorityCrisis.active,
      powerMinister: v.powerMinister
    };
  }

  function _num(v) {
    var n = Number(v || 0);
    return isFinite(n) ? n : 0;
  }

  function _getCharEconomySnapshot(c) {
    if (c && global.CharEconEngine && typeof global.CharEconEngine.buildEconomySnapshot === 'function') {
      try { return global.CharEconEngine.buildEconomySnapshot(c); } catch (_snapErr) { if(window.TM&&TM.errors) TM.errors.capture(_snapErr,'applier.charEconomySnapshot'); }
    }
    if (!c || !c.resources) return null;
    var r = c.resources || {};
    var privateWealth = r.privateWealth || r.private || {};
    var money = _num(privateWealth.money);
    return {
      privateWealth: {
        money: money,
        grain: _num(privateWealth.grain),
        cloth: _num(privateWealth.cloth),
        land: _num(privateWealth.land != null ? privateWealth.land : privateWealth.landAcres),
        treasure: _num(privateWealth.treasure),
        commerce: _num(privateWealth.commerce),
        debt: money < 0 ? Math.abs(money) : _num(privateWealth.debt)
      },
      hiddenWealth: _num(r.hiddenWealth),
      fame: _num(r.fame),
      virtueMerit: _num(r.virtueMerit),
      virtueStage: _num(r.virtueStage),
      health: _num(r.health),
      stress: _num(r.stress),
      publicPurse: r.publicPurse ? {
        money: _num(r.publicPurse.money),
        grain: _num(r.publicPurse.grain),
        cloth: _num(r.publicPurse.cloth)
      } : null,
      publicTreasury: r.publicTreasury ? {
        linkedPost: r.publicTreasury.linkedPost || r.publicTreasury.post || null,
        linkedRegion: r.publicTreasury.linkedRegion || r.publicTreasury.region || null,
        balance: _num(r.publicTreasury.balance != null ? r.publicTreasury.balance : r.publicTreasury.money),
        grain: _num(r.publicTreasury.grain),
        cloth: _num(r.publicTreasury.cloth),
        deficit: _num(r.publicTreasury.deficit != null ? r.publicTreasury.deficit : r.publicTreasury.lastHandoverDeficit),
        isReadOnly: r.publicTreasury.isReadOnly !== false
      } : null,
      lastTick: {
        income: c._lastTickIncome || null,
        expense: c._lastTickExpense || null,
        net: _num(c._lastTickNet)
      }
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
      var economy = _getCharEconomySnapshot(c);
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
        privateWealth: economy ? economy.privateWealth : null,
        familyEconomy: economy ? economy.familyEconomy : null,
        socialTier: economy ? economy.socialTier : null,
        economy: economy
      };
    });
  }

  function _getRecentEvents(G) {
    if (!G._eventBus) return [];
    return (G._eventBus.items || []).slice(-20);
  }

  function _getRecentInstitutionLifecycle(G) {
    var turn = G.turn || 0;
    var windowTurns = 12;
    var source = [];
    if (Array.isArray(G._institutionLifecycleEvents)) {
      source = G._institutionLifecycleEvents;
    } else if (Array.isArray(G._turnReport)) {
      source = G._turnReport.filter(function(r) { return r && r.type === 'institution_lifecycle'; });
    }
    return source.filter(function(e) {
      if (!e) return false;
      var t = typeof e.turn === 'number' ? e.turn : turn;
      return turn - t <= windowTurns;
    }).slice(-8).map(function(e) {
      return {
        turn: e.turn || 0,
        id: e.id || '',
        name: e.name || '',
        action: e.action || '',
        stage: e.stage || '',
        text: e.text || ''
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  角色路程推进·到达自动就任（AI 至高权力·Step 4）
  //  每回合调用 · daysPassed = P.time.daysPerTurn
  // ═══════════════════════════════════════════════════════════════════
  function _sameTravelLocation(a, b) {
    if (!a || !b) return false;
    try {
      if (typeof global._isSameLocation === 'function') return !!global._isSameLocation(a, b);
    } catch(_) {}
    try {
      if (typeof _isSameLocation === 'function') return !!_isSameLocation(a, b);
    } catch(_) {}
    return String(a || '').replace(/\s/g, '') === String(b || '').replace(/\s/g, '');
  }

  function _travelMirrorFields(ch) {
    return {
      _travelTo: ch && ch._travelTo,
      _travelFrom: ch && ch._travelFrom,
      _travelStartTurn: ch && ch._travelStartTurn,
      _travelRemainingDays: ch && ch._travelRemainingDays,
      _travelArrival: ch && ch._travelArrival,
      _travelReason: ch && ch._travelReason,
      _travelAssignPost: ch && ch._travelAssignPost
    };
  }

  function _syncCharacterLocationMirrors(G, ch, fields, deleteKeys) {
    if (!G || !ch || !ch.name) return;
    fields = fields || {};
    deleteKeys = deleteKeys || [];
    [G.chars, G.allCharacters].forEach(function(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function(item) {
        if (!item || item.name !== ch.name) return;
        Object.keys(fields).forEach(function(k) { item[k] = fields[k]; });
        deleteKeys.forEach(function(k) { try { delete item[k]; } catch(_) {} });
      });
    });
  }

  function _refreshCharacterLocationUiAfterTravel() {
    try {
      if (typeof global.buildIndices === 'function') global.buildIndices();
    } catch(_) {}
    try {
      if (typeof global.renderGameState === 'function') global.renderGameState();
    } catch(_) {}
    try {
      if (typeof global.renderRenwu === 'function') global.renderRenwu(true);
    } catch(_) {}
    try {
      if (typeof global.renderSidePanels === 'function') global.renderSidePanels();
    } catch(_) {}
    try {
      if (typeof global.renderWenduiPanel === 'function') global.renderWenduiPanel();
    } catch(_) {}
    try {
      if (typeof global.renderShizhengPanel === 'function') global.renderShizhengPanel();
    } catch(_) {}
  }

  function advanceCharTravelByDays(daysPassed) {
    var G = global.GM;
    if (!G || !Array.isArray(G.chars) || !(daysPassed > 0)) return { arrived: 0, inflight: 0 };
    var arrived = 0, inflight = 0;
    var dateText = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));

    G.chars.forEach(function(ch) {
      if (!ch || !ch._travelTo) return;
      // ★赴任硬上限·按"天"计(与每回合天数刻度无关·1回合=1天的剧本不会被误伤)：
      //  逐 tick 累计实耗天数(AI 重发同终点不清此计数→剩余天数被重置也兜得住)·
      //  首 tick 锚定应耗天数(此后不被 AI 重置缩小)·实耗超「应耗×2 且 ≥40 天」即判卡死强制抵达。
      //  正常 N 日旅程仍由下方天数分支在「走满 N 天」那一回合正常抵达·此闸只兜永不递减/被重置等卡死成因。
      ch._travelElapsedDays = (Number(ch._travelElapsedDays) || 0) + daysPassed;
      if (!(ch._travelExpectedDays > 0)) {
        ch._travelExpectedDays = (typeof ch._travelRemainingDays === 'number' && ch._travelRemainingDays > 0) ? ch._travelRemainingDays : 20;
      }
      var _capDays = Math.max(ch._travelExpectedDays * 2, 40);
      var _forceArrive = ch._travelElapsedDays >= _capDays;
      if (!_forceArrive && typeof ch._travelRemainingDays === 'number') {
        ch._travelRemainingDays -= daysPassed;
        if (ch._travelRemainingDays > 0) { inflight++; return; }
      } else if (!_forceArrive && typeof ch._travelArrival === 'number') {
        // 旧版回合系统兼容：未到回合则继续
        if ((G.turn || 0) < ch._travelArrival) { inflight++; return; }
      }
      _arriveCharNow(G, ch, dateText);
      arrived++;
    });

    if (arrived > 0) _refreshCharacterLocationUiAfterTravel();
    return { arrived: arrived, inflight: inflight };
  }

  // 到达落地（天数到期 / 即时抵达对账 两处复用·移动对账层 S3 抽出 2026-05-28）
  // 调用前 ch._travelTo 等走位字段须已就位；本函数落 location + 自动就任 + 三处播报 + 清字段。
  function _arriveCharNow(G, ch, dateText) {
    if (!G || !ch || !ch._travelTo) return;
    if (!dateText) dateText = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));
      // —— 到达 ——
      var fromLoc = ch._travelFrom || '';
      var toLoc = ch._travelTo;
      var assignPost = ch._travelAssignPost || '';
      var reason = ch._travelReason || '';
      var assignConcurrent = !!ch._travelAssignConcurrent || /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(reason + ' ' + assignPost);

      ch.location = toLoc;
      _syncCharacterLocationMirrors(G, ch, { location: toLoc }, []);

      // 自动就任·仅当 _travelAssignPost 存在
      if (assignPost) {
        var dept = '', post = assignPost;
        if (assignPost.indexOf('/') >= 0) {
          var parts = assignPost.split('/');
          dept = parts[0] || '';
          post = parts.slice(1).join('/') || '';
        }
        try {
          var r = onAppointment(ch.name, post, { dept: dept, concurrent: assignConcurrent, reason: reason });
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
      delete ch._travelAssignConcurrent;
      delete ch._travelElapsedDays;
      delete ch._travelExpectedDays;
      _syncCharacterLocationMirrors(G, ch, { location: toLoc }, [
        '_travelTo',
        '_travelFrom',
        '_travelStartTurn',
        '_travelRemainingDays',
        '_travelArrival',
        '_travelReason',
        '_travelAssignPost',
        '_travelAssignConcurrent',
        '_travelElapsedDays',
        '_travelExpectedDays'
      ]);

      // 写入本回合报告（供史记读取）
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type:'travel_arrived', char: ch.name, to: toLoc, assignPost: assignPost, turn: G.turn || 0 });
  }
  global._arriveCharNow = _arriveCharNow;
  global._hasInstantArrivalRule = _hasInstantArrivalRule;   // 导出·供官制面板 _offPickerConfirm 认"瞬间抵达"规则即抵(治"官制任命后长期不赴任")

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.AIChangeApplier = {
    applyAITurnChanges: applyAITurnChanges,
    applyAIArmyChange: applyAIArmyChange,
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
    preflightAIWriteBack: preflightAIWriteBack,
    generateTurnReport: generateTurnReport,
    renderTurnReport: renderTurnReport,
    buildFullAIContext: buildFullAIContext,
    advanceCharTravelByDays: advanceCharTravelByDays,
    VERSION: 1
  };

  // 全局快捷
  global.applyAITurnChanges = applyAITurnChanges;
  global.applyAIArmyChange = applyAIArmyChange;
  global.onAppointment = onAppointment;
  global.onDismissal = onDismissal;
  global._tmReasonIsImprison = _tmReasonIsImprison;
  global._TM_IMPRISON_RE = _TM_IMPRISON_RE;
  global._resolveBinding = _resolveBinding;
  global.renderTurnReport = renderTurnReport;
  global.buildFullAIContext = buildFullAIContext;
  global.advanceCharTravelByDays = advanceCharTravelByDays;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
