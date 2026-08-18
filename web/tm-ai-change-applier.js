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
  var _applyPathMerge           = _PathUtils && _PathUtils.applyPathMerge;
  var _applyDeclaredPathChanges = _PathUtils && _PathUtils.applyDeclaredPathChanges;
  var _isPlainObject            = _PathUtils && _PathUtils.isPlainObject;
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
  var _setFactionLeader                   = _Narrative && _Narrative.setFactionLeader;
  var _resolveNarrativeAliveChar          = _Narrative && _Narrative.resolveAliveChar;
  var _safeOwnCopy                      = _Narrative && _Narrative.safeOwnCopy;
  var _applyStructuredPartyUpdate       = _Narrative && _Narrative.applyStructuredPartyUpdate;

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
        var _diR = _normalizeDynamicInstitutions(G).find(function (x) { return x && x.id === id && x.type === 'region'; });
        if (_diR) return _diR;
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
        var _diM = _normalizeDynamicInstitutions(G).find(function (x) { return x && x.id === id && (x.type === 'ministry' || x.type == null); });
        if (_diM) return _diM;
        return null;
      case 'military':
        if (G.fiscal && G.fiscal.guoku && G.fiscal.guoku.subBudgets && G.fiscal.guoku.subBudgets.military && G.fiscal.guoku.subBudgets.military[id]) return G.fiscal.guoku.subBudgets.military[id];
        var _diU = _normalizeDynamicInstitutions(G).find(function (x) { return x && x.id === id && x.type === 'military'; });
        if (_diU) return _diU;
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

  function onDismissal(charName, reason, aiOutput) {
    var G = global.GM;
    var ch = _findChar(charName);
    if (!ch) return { ok: false, reason: '未找到 ' + charName };
    // 重复抄家(reason 含抄/查抄且此人已被抄)·跳过移交/追亏·免二次进账(与下方抄家三标记守卫一致)
    var _wgD = global.TM && global.TM.__acaParts; if (_wgD && _wgD._gateDeathRoutingSource && _wgD._gateDeathRoutingSource(G, ch, String(reason || ''), aiOutput)) return { ok: false, reason: 'no-source-bare-death(write-gate·返工issue4·死亡管线收口)' };     var _repeatConfisc = /抄|籍没|没官|查抄/.test(String(reason || '')) && (ch._confiscated || ch.confiscated || ch._confiscatedTurn != null);
    var binding = ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.binding;
    if (binding && !_repeatConfisc) {
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
    if (/处决|处斩|处死|斩首|斩决|斩杀|戮杀|正法|明正典刑|诛杀|诛戮|诛九族|凌迟|腰斩|弃市|枭首|枭示|问斩|赐死|赐自尽|绞刑|绞死|伏诛|伏法|就戮|授首|自尽|自缢|自刎|自裁|自杀|服毒自尽|畏罪自尽|磔|execute|死刑|身故|病故|病逝|病殁|病卒|病亡|亡故|暴毙|暴卒|暴亡|猝死|物故|殒命|毙命|殉国|殉难|殉城|殉职|罹难|遇害|遇难|遭难|薨逝|溘逝|寿终|城破身死/.test(_reasonStr)) {
      // ★ 落库契约硬化刀①(2026-07-16)：死亡分支不再裸写 ch.alive=false。
      //   旧直写绕过「玩家之死裁决器」adjudicatePlayerDeath(合法继统门·鼎革 R1a)与死亡级联
      //   (军队摘帅/丁忧/势力首领继承/头衔/governor/后宫)——结构化 personnel_changes(change='赐死'类·
      //   经本文件 1601 行映射 reason='execute')及 appointments/office_assignments 的死因 reason 都经此·
      //   会静默置死玩家角色而既不路由继统、也不触终局(尸政/无嗣不终局)。改为合成 character_deaths 同构条目
      //   投喂既有死亡管线 applyOneDeath(缺位回落 applyCharacterDeaths；两者都缺则失败留痕，绝不裸写)。
      //   幂等：applyOneDeath 无「已死早退」·对已死者重投会重跑全级联(重复 addEB/家族声望-2/摘帅-15)造双落账·
      //   故此处前置已死闸(alive===false 即不重投)。本分支后续(抄家/officeTree 清理/addEB)属非死亡通用段·零改动。
      var _routedDeath = false;
      if (ch.alive === false) {
        _routedDeath = true;  // 已死·死亡管线此前已跑·不重投(防双落账)
      } else {
        var _deathCd = { name: ch.name, reason: _reasonStr };
        try {
          if (typeof global.applyOneDeath === 'function') { global.applyOneDeath(_deathCd); _routedDeath = ch.alive === false || ch.dead === true; }
          else if (typeof global.applyCharacterDeaths === 'function') { global.applyCharacterDeaths({ character_deaths: [_deathCd] }); _routedDeath = ch.alive === false || ch.dead === true; }
        } catch (_odDeathE) {
          try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_odDeathE, 'onDismissal-death-route'); } catch (__) {}
        }
      }
      if (!_routedDeath) {
        var _unappliedSink = global.TM && global.TM.Endturn && global.TM.Endturn.AI && global.TM.Endturn.AI.apply && global.TM.Endturn.AI.apply.recordUnappliedChange;
        if (typeof _unappliedSink === 'function') _unappliedSink({ character_death:ch.name, reason:'death pipeline unavailable' }, 'onDismissal');
        try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_gate', { label:'character_deaths', reason:'death pipeline unavailable', item:_deathCd }); } catch (_) {}
        return { ok:false, reason:'death pipeline unavailable' };
      }
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
        // 幂等守卫统一三套抄家实现的标记(applier._confiscated / engine.confiscated / fiscal-ui._confiscatedTurn)·
        // 防"下回合叙事复述抄家→校验器又调一次→另一套引擎照抄"重复进账(玩家报+900万又抄一次)
        if (global.EconomyLinkage && typeof global.EconomyLinkage.triggerConfiscationByName === 'function' && !(ch._confiscated || ch.confiscated || ch._confiscatedTurn != null)) {
          // 默认入内帑·intensity 0.6（中度挖掘+轻度株连）·若 reason 含「重抄」「严抄」则提级
          var _intense = /重抄|严抄|彻查|连坐|株连/.test(_confKey) ? 0.85 : 0.6;
          var _confR = global.EconomyLinkage.triggerConfiscationByName(charName, 'neitang', _intense);
          if (_confR && _confR.success) {
            ch._confiscated = true;
            ch.confiscated = true;  // 与引擎(tm-char-economy-engine:1363)标记统一·令引擎按钮/校验器二次调用都被挡
            if (global.addEB) {
              var _wan = Math.round((_confR.total||0)/10000);
              global.addEB('惩罚', '抄' + charName + '家·明 ' + Math.round((_confR.visible||0)/10000) + ' 万 + 暗 ' + Math.round((_confR.hidden||0)/10000) + ' 万 = 共 ' + _wan + ' 万两入内帑');
            }
            if (global.GM && global.GM.qijuHistory) {
              var _qd = (typeof getTSText === 'function') ? getTSText(global.GM.turn) : '';
              if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: global.GM.turn, date: _qd, content: '【抄家】抄' + charName + '家产·得银 ' + Math.round((_confR.total||0)/10000) + ' 万两·解内帑。' });
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
    // 免职须斩在途赴任链：否则 _arriveCharNow 到期无条件 onAppointment·被免者「抵达即复职」翻案(2026-07-04 审查定罪)
    delete ch._travelAssignPost; delete ch._travelTo; delete ch._travelRemainingDays;
    // 记去职标记·供推演 prompt「受限人员现状名册」识别罢官者·令 AI 勿再称旧衔/勿令其理事
    // (下狱/流放另有 _imprisoned/_exiled·此标记主要覆盖纯罢官免职;再任命后 officialTitle 非空即不再判罢官)
    ch._removedFromOfficeTurn = G.turn || 0;
    ch._removedReason = _reasonStr || '免职';
    if (global.addEB) global.addEB('任免', charName + ' ' + (reason || '免职'));
    return { ok: true };
  }

  // 叙事校验器补录前的幂等判定·防"AI 每回合复述旧状态→重复施加"(玩家报:放了又被关/抄两次/莫名重复)·
  // 返回 true = 已在此状态或玩家本回合已反向处置(释放/召回)·不应再补调 onDismissal
  function _alreadyResolvedState(ch, action, G) {
    if (!ch) return true;
    var t = (G && G.turn) || 0;
    // 释放/召回后 2 回合内·不被 AI 叙事复述重新关押/流放(叙事多为陈述旧态·真·新逮捕可待窗口后)·
    // 治玩家报"下诏放人·下回合又被关"(仅"本回合已释放"不够·次回合叙事仍会复述在狱)
    var _pardoned = (ch._releasedTurn != null && (t - ch._releasedTurn) <= 2) ||
                    (ch._recalledTurn != null && (t - ch._recalledTurn) <= 2);
    if ((action === 'imprison' || action === 'arrest') && (ch._imprisoned === true || _pardoned)) return true;
    if (action === 'exile'  && (ch._exiled === true  || _pardoned)) return true;
    if (action === 'retire' && (ch._retired === true || ch.retired === true || _pardoned)) return true;
    if (action === 'flee'   && (ch._fled === true || ch._missing === true || _pardoned)) return true;
    if (action === 'confiscate' && (ch._confiscated === true || ch.confiscated === true || ch._confiscatedTurn != null)) return true;
    if (action === 'dismiss' && (!ch.officialTitle && !ch.position)) return true; // 已无官职·勿重复免职
    if (action === 'execute' && ch.alive === false) return true;
    return false;
  }

  function onTransfer(charName, fromPosition, toPosition, toBinding) {
    onDismissal(charName, '转任');
    return onAppointment(charName, toPosition, toBinding);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  动态机构 / 区划 注册
  // ═══════════════════════════════════════════════════════════════════

  // 动态机构统一为数组表示（type 字段分 region/military/ministry·不分池）·与圣旨路径(edict-parser)一致。
  // 老档/旧版本可能存成对象池 {ministries,regions,militaryUnits}·此处一次性合并成数组·下游全部按数组读·幂等。
  function _normalizeDynamicInstitutions(G) {
    if (!G) return [];
    var di = G.dynamicInstitutions;
    if (Array.isArray(di)) return di;
    var out = [];
    if (di && typeof di === 'object') {
      [['ministries', 'ministry'], ['regions', 'region'], ['militaryUnits', 'military']].forEach(function (pair) {
        var pool = di[pair[0]];
        if (pool && typeof pool === 'object') Object.keys(pool).forEach(function (k) {
          var inst = pool[k];
          if (inst && typeof inst === 'object') { if (inst.type == null) inst.type = pair[1]; out.push(inst); }
        });
      });
    }
    G.dynamicInstitutions = out;
    return out;
  }

  function registerInstitution(spec) {
    var G = global.GM;
    var _di = _normalizeDynamicInstitutions(G);
    var _t = spec.type === 'region' ? 'region' : spec.type === 'military' ? 'military' : 'ministry';
    var inst = Object.assign({
      id: spec.id || 'inst_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      name: spec.name || '新设机构',
      createdTurn: G.turn || 0,
      stage: 'running'
    }, spec, { type: _t });
    _ensurePublicTreasury(inst);
    _di.push(inst);
    if (global.addEB) global.addEB('新制', '设 ' + inst.name);
    return inst;
  }

  function abolishInstitution(id, reason) {
    var G = global.GM;
    var _di = _normalizeDynamicInstitutions(G);
    if (!_di.length) return { ok:false };
    var inst = _di.find(function (x) { return x && x.id === id; });
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
    if (!r) r = _normalizeDynamicInstitutions(G).find(function (x) { return x && x.id === regionId && x.type === 'region'; }) || null;
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
    var list = _normalizeDynamicInstitutions(G);
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
    _normalizeDynamicInstitutions(G);
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

  function _captureValidatorBaseline(G){ return __acaP._captureValidatorBaseline.apply(this, arguments); }
  function _collectValidatorFailures(G, baseline){ return __acaP._collectValidatorFailures.apply(this, arguments); }
  function _runConsistencyValidator(applied, aiOutput, name, fn){ return __acaP._runConsistencyValidator.apply(this, arguments); }

  function _applyAITurnChangesUnsafe(aiOutput) {
    var G = global.GM;
    if (!G) return { ok: false };
    if (!aiOutput || typeof aiOutput !== 'object') return { ok: false };

    var _validatorBaseline = _captureValidatorBaseline(G);
    // 先把 char_updates.alive/dead 规范化；end-turn dispatcher 会预先在原 p1 上做同一步并延后
    // 给既有 applyCharacterDeaths。直接调用本 applier 时，下面只消费本次新合成的 death 条目。
    var _deathNormalization = (typeof global.normalizeAIWriteBackDeaths === 'function')
      ? global.normalizeAIWriteBackDeaths(aiOutput, { source: 'applyAITurnChanges' })
      : { added: [], routed: [], failed: [], normalized: 0 };
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
    if (typeof global.applyNormalizedAIWriteBackDeaths === 'function') {
      global.applyNormalizedAIWriteBackDeaths(G, _deathNormalization, applied);
    }

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

    // 1. 数据变化（强类型 path dispatcher 位于 PathUtils 分片）
    if (typeof _applyDeclaredPathChanges === 'function') {
      applied.changes += _applyDeclaredPathChanges(G, aiOutput.changes, G._turnReport, applied.failed);
    } else if (Array.isArray(aiOutput.changes) && aiOutput.changes.length) {
      applied.failed.push({ field: 'changes', reason: 'path dispatcher unavailable' });
    }

    // 1.5 改换门庭（推演驱动·叛降/归附/反正/俘获/拥立）：显式列表 [{character,newFaction,reason,type}]。
    //     兼容多种字段名；解析失败入 failed 可见。narrative 动词检测在叙事扫描段补漏（见下）。
    (aiOutput.allegiance_changes || aiOutput.allegianceChanges || aiOutput.defections || []).forEach(function(a) {
      if (!a || typeof a !== 'object') return;
      var charRef = a.character || a.char || a.name || a.who || a.subject;
      var newFac = a.newFaction || a.toFaction || a.to_faction || a.faction || a.to || a.newAllegiance;
      if (!charRef || !newFac) return;
      var _wgAl = global.TM && global.TM.__acaParts; var r = (_wgAl && _wgAl._gateAllegianceSource && _wgAl._gateAllegianceSource(G, aiOutput, charRef, newFac, a.reason || a.cause || '', applied)) ? { ok: false, reason: 'no-source-faction(write-gate)' } : applyAllegianceChange(G, charRef, newFac, { reason: a.reason || a.cause || '', type: a.type || a.kind || a.mode || '' });   // 刀C·返工issue5·改换门庭判源
      if (r.ok) { applied.changes++; }
      else applied.failed.push({ field: 'allegiance_changes', text: charRef + ' → ' + newFac, reason: r.reason });
    });

    // 2. 任免
    (aiOutput.appointments || []).forEach(function(a) {
      var r;
      if (a.action === 'appoint') r = onAppointment(a.charName, a.position, a.binding);
      else if (a.action === 'dismiss') r = onDismissal(a.charName, a.reason, aiOutput);
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
      var _localPaid = 0;
      if (div.publicTreasury && div.publicTreasury.money) {
        var cost = Math.max(0, Math.round(la.amount||0));
        var _localBefore = Math.max(0, Number(div.publicTreasury.money.stock) || 0);
        _localPaid = Math.min(_localBefore, cost);
        div.publicTreasury.money.stock = _localBefore - _localPaid;
        var _localDeficit = cost - _localPaid;
        if (_localDeficit > 0) div.publicTreasury.money.deficit = (Number(div.publicTreasury.money.deficit) || 0) + _localDeficit;
      }
      // illicit 进主官私产
      if (la.type === 'illicit' && div.governor) {
        var ch = G.chars ? G.chars.find(function(c){return c.name===div.governor;}) : null;
        if (ch) {
          if (!ch.resources) ch.resources = {};
          if (!ch.resources.privateWealth) ch.resources.privateWealth = { money:0, grain:0, cloth:0 };
          ch.resources.privateWealth.money = (ch.resources.privateWealth.money||0) + Math.round(_localPaid * 0.6);
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
      var _c4b = global.TM && global.TM.__acaParts; if (_c4b && _c4b._gateEventTimepoint && _c4b._gateEventTimepoint(G, e, applied)) return;   // 刀C·C4·events 时点闸(逻辑在 validators·未来年份硬拒/未到期史实软提示)
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
      militaryChangeCount += _applyAIArmyChangeList(aiOutput.military_changes, 'military_changes', { failed: applied.failed });
    }
    if (Array.isArray(aiOutput.army_changes)) {
      militaryChangeCount += _applyAIArmyChangeList(aiOutput.army_changes, 'army_changes', { failed: applied.failed });
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
      if (cu.updates) charUpdCount += _mergeUpdatesToEntity(ch, cu.updates, 'char_update', ch.name, cu.reason || '', applied.failed, aiOutput);   // 刀C·C3·透传 aiOutput 供敏感字段来源判据(结构化互证)
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
          else if (action === 'dismiss') rr = onDismissal(oa.name, oa.reason, aiOutput);
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
      if (action === 'dismiss') { var _c2b = global.TM && global.TM.__acaParts; if (_c2b && _c2b._gateJudicialPersonnelChange && _c2b._gateJudicialPersonnelChange(G, aiOutput, pc, changeText, applied)) return; }   // 刀C·C2·司法类人事无源判据(逻辑在 validators·alias 内联·免堆巨石)
      var r = null;
      if (action === 'appoint' && post) r = onAppointment(pc.name, post, { concurrent: isConcurrentPersonnel, reason: reason });
      else if (action === 'dismiss') r = onDismissal(pc.name, reason, aiOutput);
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
    var _transferPairSeen = {};
    // ★ 转账对语义闸(2026-07-16·落库契约硬化刀②·居平内帑案的另一形态)：
    //   居平案原形=同批次「A库 expense + B库 income、金额相等、事由同源」一对——把单边节流/增支旨意
    //   错记成两库转账·凭空多出一侧假账(内帑掏空 + 国库虚增)。既有「裁减语义守卫」(下方 1696)只拦
    //   含"裁减/节省…用度"关键字的单条·既有「金额相称闸」(下方 1769)只拦单条超量·两者都漏这种
    //   "两条各自结构合法、成对才露馅"的转账对形态。此闸纯确定性配对(不掷骰不调 AI)·四条件全中才算：
    //   ①一 income 一 expense ②跨两个库(guoku/neitang/province) ③金额近等(≤1%) ④事由文本同源。
    //   处置=保守留痕：fiscal schema 无原生 transfer 语义(只 income/expense)·不折算·两笔照落但打
    //   嫌疑标记(entry._transferPairSuspect)+ turnReport 携标 + 事件簿⚠·让 playtest 看得见·不静默
    //   吞账(真转账不误杀)也不误伤(两笔无关同额收支·事由不同源→不判)。
    (function _flagFiscalTransferPairs(){
      var list = aiOutput.fiscal_adjustments;
      if (!Array.isArray(list) || list.length < 2) return;
      // ★别名表镜像·改须与 tm-ai-change-applier-reconcile.js:_faNormTargetForGate/_faNormKindForGate 及下方
      //   fiscal_adjustments 容差归一段同步(三处逐字一致)。
      function _normTarget(t){
        var s = String(t == null ? '' : t).trim();
        if (/^(太仓|太仓库|国库|户部库|外库|公帑|公库|guoku|taicang|taicangku)$/i.test(s)) return 'guoku';
        if (/^(内帑|内库|内承运库|私帑|帝室库|御库|neitang|neicang)$/i.test(s)) return 'neitang';
        if (/^(province|省|布政使司)\s*[:：]/i.test(s)) return 'province:' + s.replace(/^(province|省|布政使司)\s*[:：]\s*/i, '');
        if (s === 'guoku' || s === 'neitang' || /^province:/.test(s)) return s;
        return '';
      }
      function _normKind(k){
        var s = String(k == null ? '' : k).trim();
        if (/^(income|收入|进项|增收|入项)$/i.test(s)) return 'income';
        if (/^(expense|expenditure|支出|开支|耗费|拨支|出项)$/i.test(s)) return 'expense';
        return (s === 'income' || s === 'expense') ? s : '';
      }
      function _norm(fa){
        if (!fa) return null;
        var act = String(fa.action || fa.op || 'add').toLowerCase();
        if (act === 'modify' || act === 'set') act = 'update';
        if (act === 'delete' || act === 'disable' || act === 'cancel') act = 'stop';
        if (act !== 'add' && act !== 'update' && act !== 'stop' && act !== 'remove') act = 'add';
        if (act !== 'add') return null;                                   // 只在新增(add)之间配对
        var res = (fa.resource === 'grain' || fa.resource === 'cloth') ? fa.resource : 'money';
        if (res !== 'money') return null;                                 // 仅银两转账对(粮布不判·宁漏勿误)
        var tgt = _normTarget(fa.target); if (!tgt) return null;
        var kind = _normKind(fa.kind); if (!kind) return null;
        var amt = Math.abs(parseFloat(fa.amount) || 0); if (!(amt > 0)) return null;
        return { fa: fa, target: tgt, kind: kind, amount: amt, label: String((fa.name||'') + ' ' + (fa.category||'') + ' ' + (fa.reason||'')) };
      }
      function _clean(s){ return String(s || '').replace(/[\s　]+/g, '').replace(/[，。、；：·「」『』()（）\-—_./]/g, ''); }
      function _sameSource(a, b){   // 确定性同源：短串被长串包含(≥2字) 或 字符二元组 Jaccard ≥ 0.5
        var x = _clean(a), y = _clean(b);
        if (x.length < 2 || y.length < 2) return false;
        if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return true;
        function _bg(s){ var m = {}; for (var i = 0; i < s.length - 1; i++) m[s.substr(i, 2)] = 1; return m; }
        var bx = _bg(x), by = _bg(y), inter = 0, uni = {};
        Object.keys(bx).forEach(function(k){ uni[k] = 1; if (by[k]) inter++; });
        Object.keys(by).forEach(function(k){ uni[k] = 1; });
        var u = Object.keys(uni).length;
        return u > 0 && (inter / u) >= 0.5;
      }
      var norms = list.map(_norm), paired = {};
      for (var i = 0; i < norms.length; i++) {
        var A = norms[i]; if (!A || paired[i]) continue;
        for (var j = i + 1; j < norms.length; j++) {
          var B = norms[j]; if (!B || paired[j]) continue;
          if (A.kind === B.kind) continue;                               // ①须一进一出
          if (A.target === B.target) continue;                           // ②须跨两库
          var hi = Math.max(A.amount, B.amount), lo = Math.min(A.amount, B.amount);
          if ((hi - lo) > Math.max(1, lo * 0.01)) continue;              // ③金额近等(≤1%)
          if (!_sameSource(A.label, B.label)) continue;                  // ④事由同源
          var pid = 'tpair_' + (G.turn || 0) + '_' + i + '_' + j;
          A.fa._transferPairSuspect = true; A.fa._transferPairId = pid; A.fa._transferPairWith = B.target + '/' + B.kind;
          B.fa._transferPairSuspect = true; B.fa._transferPairId = pid; B.fa._transferPairWith = A.target + '/' + A.kind;
          paired[i] = true; paired[j] = true;
          break;
        }
      }
    })();
    (aiOutput.fiscal_adjustments || []).forEach(function(fa) {
      if (!fa) return;
      // ★ fiscal 容差归一(2026-06-02·bug A)：AI 常用中文/自然名指账户与收支·若不归一则 target 解析为 null·
      //   此条 fiscal 静默漏账(财政死账真凶之一)。映射常见别名到 guoku/neitang/province: 与 income/expense。
      //   ★别名表镜像·改须与 _normTarget(上方 _flagFiscalTransferPairs 内)及 tm-ai-change-applier-reconcile.js:
      //   _faNormTargetForGate/_faNormKindForGate(preflight 白名单)同步(三处逐字一致)。
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
      // ★ 裁减语义守卫(2026-07-12·居平内帑案)：「裁减/节省用度」类旨意是降常例支出率的节流令·不是帑银调拨——
      //   本 schema 只有 income/expense 两个库存动词·LLM 只能错映射成「支出 N 两」(内帑侧被真扣)或
      //   「节省 N 两入库」(国库侧凭空进账)·一对条目=巨款凭空搬家(实证:后宫裁减用度 1300 万·内帑掏空+国库虚增)。
      //   动词+宾语双匹配才拦(裁汰冗兵遣散费=真支出·不误伤)·仅拦 add(stop/update 既有条目照旧)·
      //   不动库存·记 fiscal_adj_rejected 独立 type(agent 写工具按无 fiscal_adj 正确得 ok:false)·事件簿可见。
      if (action === 'add') {
        var _cutLabel = String((fa.name || '') + ' ' + (fa.category || '') + ' ' + (fa.reason || ''));
        if (/(裁减|裁革|削减|核减|减省|节省|省减|俭省|裁汰|缩减|撙节)/.test(_cutLabel) &&
            /(用度|开支|支出|费用|经费|浮费|冗费|宫费|糜费|靡费)/.test(_cutLabel)) {
          if (applied && Array.isArray(applied.failed)) applied.failed.push({ fiscal_adjustment: { target: fa.target, kind: fa.kind, name: fa.name || fa.category, amount: amount }, reason: '裁减用度类旨意不产生银两调拨·语义守卫拦截(应降常例支出)' });
          G._turnReport.push({ type: 'fiscal_adj_rejected', action: action, target: fa.target, kind: fa.kind, resource: resource, name: fa.name || fa.category || '', amount: 0, requested: amount, recurring: !!fa.recurring, executionStatus: 'rejected_semantic', reason: '裁减/节省用度为节流令·不动帑银·未入账', turn: G.turn || 0 });
          if (typeof global.addEB === 'function') global.addEB('财政', (fa.target === 'guoku' ? '帑廪' : fa.target === 'neitang' ? '内帑' : fa.target) + '「' + (fa.name || '裁减用度') + '」系节流之令·不动帑银·未按 ' + amount + ' 计调拨');
          return;
        }
      }
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
        _transferPairSuspect: !!fa._transferPairSuspect,   // 刀②·两库转账对嫌疑标记(随条目持久化·可见于存档/奏报)
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
      // ★ 金额相称闸(2026-07-12·同刀)：单条银两金额超过 max(账户年流水×3, 100 万) = 幻觉量级——
      //   压至该上限并留痕(entry._clampedFrom·reason 追注·事件簿⚠)·勿静默。年流水取 monthlyIncome/
      //   monthlyExpense 较大者×12(guoku/neitang 引擎均维护该字段)·无流水数据或粮布资源不压(宁漏勿误杀)。
      //   100 万地板保正常大额(犒军/岁币/报效)零打扰·年流水×3 随经济规模自适应(加派类真年例放行)。
      if (amount > 0 && target && resource === 'money' && (fa.target === 'guoku' || fa.target === 'neitang')) {
        var _mFlow = Math.max(Number(target.monthlyIncome) || 0, Number(target.monthlyExpense) || 0) * 12;
        var _amtCap = Math.max(_mFlow * 3, 1000000);
        if (_mFlow > 0 && amount > _amtCap) {
          var _rawAmt = amount;
          amount = Math.round(_amtCap);
          entry.amount = amount;
          entry._clampedFrom = _rawAmt;
          entry.reason = (entry.reason ? entry.reason + '·' : '') + '原报 ' + _rawAmt + ' 超账户年流水三倍·压至 ' + amount;
          if (typeof global.addEB === 'function') global.addEB('财政⚠', (fa.target === 'guoku' ? '帑廪' : '内帑') + '「' + (entry.name || '') + '」报额 ' + _rawAmt + ' 显异常·压至 ' + amount);
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
        // ★ 刀②·转账对嫌疑留痕：两笔照落·不动银·仅按对告警一次(供 playtest 核是否单边节流/增支误记成两库搬家)
        if (fa._transferPairSuspect && !_transferPairSeen[fa._transferPairId]) {
          _transferPairSeen[fa._transferPairId] = true;
          if (applied && applied.semantic) applied.semantic.fiscal_transfer_pair_suspects = (applied.semantic.fiscal_transfer_pair_suspects || 0) + 1;
          if (typeof global.addEB === 'function') global.addEB('财政❗', '疑似两库转账对·' + (fa.target==='guoku'?'帑廪':fa.target==='neitang'?'内帑':fa.target) + (fa.kind==='income'?'入':'出') + amount + '两「' + (entry.name||'') + '」与 ' + (fa._transferPairWith||'') + ' 同额·事由同源·两笔照落待核(防单边节流/增支误记成两库搬家)');
        }
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
        G._turnReport.push({ type:'fiscal_adj', action: action, target: fa.target, kind: fa.kind, resource: resource, name: entry.name, amount: actualApplied, requested: amount, annualAmount: entry.recurring ? amount : 0, recurring: !!entry.recurring, coercedOneTime: !!entry._coercedOneTime, transferPairSuspect: !!fa._transferPairSuspect, shortfall: shortfall, executionStatus: executionStatus, reason: entry.reason, turn: G.turn||0 });
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
      if (fu.updates && typeof _isPlainObject === 'function' && _isPlainObject(fu.updates)) {
        var cleanUpdates = _safeOwnCopy(fu.updates);
        var leaderCandidates = [];
        function takeLeader(obj, key) {
          if (obj && Object.prototype.hasOwnProperty.call(obj, key)) leaderCandidates.push(String(obj[key] == null ? '' : obj[key]).trim());
          if (obj) delete obj[key];
        }
        takeLeader(cleanUpdates, 'leader'); takeLeader(cleanUpdates, 'ruler'); takeLeader(cleanUpdates, 'newLeader'); takeLeader(cleanUpdates, 'leaderName'); takeLeader(cleanUpdates, 'leader_name');
        if (Object.prototype.hasOwnProperty.call(cleanUpdates, 'leadership')) {
          var leadershipUpdate = cleanUpdates.leadership; delete cleanUpdates.leadership;
          if (typeof _isPlainObject === 'function' && _isPlainObject(leadershipUpdate)) {
            leadershipUpdate = _safeOwnCopy(leadershipUpdate); takeLeader(leadershipUpdate, 'ruler'); takeLeader(leadershipUpdate, 'leader'); takeLeader(leadershipUpdate, 'newLeader');
            if (Object.keys(leadershipUpdate).length) cleanUpdates.leadership = leadershipUpdate;
          } else applied.failed.push({ faction_update: fu.name, updateKey: 'leadership', reason: 'leadership must be a plain object' });
        }
        if (Object.prototype.hasOwnProperty.call(cleanUpdates, 'leaderInfo')) {
          var leaderInfoUpdate = cleanUpdates.leaderInfo; delete cleanUpdates.leaderInfo;
          if (typeof _isPlainObject === 'function' && _isPlainObject(leaderInfoUpdate)) {
            leaderInfoUpdate = _safeOwnCopy(leaderInfoUpdate); takeLeader(leaderInfoUpdate, 'name');
            if (Object.keys(leaderInfoUpdate).length) cleanUpdates.leaderInfo = leaderInfoUpdate;
          } else applied.failed.push({ faction_update: fu.name, updateKey: 'leaderInfo', reason: 'leaderInfo must be a plain object' });
        }
        if (leaderCandidates.length) {
          var uniqueLeaders = leaderCandidates.filter(function(v, i, arr) { return arr.indexOf(v) === i; });
          if (uniqueLeaders.length > 1) {
            applied.failed.push({ faction_update: fu.name, reason: 'conflicting faction leader mirrors' });
          } else {
            var leader = uniqueLeaders[0];
            var livingLeader = leader && typeof _resolveNarrativeAliveChar === 'function' ? _resolveNarrativeAliveChar(G, leader) : null;
            if (leader && !livingLeader) {
              applied.failed.push({ faction_update: fu.name, reason: 'faction leader must be an existing living character: ' + leader });
            } else if (typeof _setFactionLeader !== 'function') {
              applied.failed.push({ faction_update: fu.name, reason: 'faction leader sink unavailable' });
            } else if (_setFactionLeader(fac, livingLeader ? livingLeader.name : '', G, fu.reason || 'AI势力首领变更')) {
              facCount++;
            }
          }
        }
        facCount += _mergeUpdatesToEntity(fac, cleanUpdates, 'faction_update', fac.name, fu.reason || '', applied.failed);
      } else if (fu.updates != null) applied.failed.push({ faction_update: fu.name, reason: 'updates must be a plain JSON object' });
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
      if (typeof _applyStructuredPartyUpdate === 'function') partyCount += _applyStructuredPartyUpdate(G, party, pu, applied.failed);
      else applied.failed.push({ party_update:pu.name, reason:'party update sink unavailable' });
    });
    if (partyCount > 0) applied.semantic.party_updates = partyCount;

    // ── 13. class_updates ──
    var classCount = 0;
    (aiOutput.class_updates || []).forEach(function(cu) {
      if (!cu || !cu.name) return;
      var cls = _findEntity(G, 'class', cu.name);
      if (!cls) { applied.failed.push({class_update: cu, reason: 'class not found'}); return; }
      if (cu.updates) classCount += _mergeUpdatesToEntity(cls, cu.updates, 'class_update', cls.name, cu.reason || '', applied.failed);
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
      if (ru.updates) regionCount += _mergeUpdatesToEntity(div, ru.updates, 'region_update', div.name || div.id, ru.reason || '', applied.failed);
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
      var anyOp = apc.op == null || apc.op === '' ? 'set' : String(apc.op).toLowerCase();
      if (anyOp === 'push') {
        if (!Object.prototype.hasOwnProperty.call(apc, 'value')) result = { ok:false, reason:'push requires value' };
        else result = _applyPathPush(G, apc.path, apc.value);
      } else if (anyOp === 'delta') {
        var anyDelta = Object.prototype.hasOwnProperty.call(apc, 'delta') ? apc.delta : apc.value;
        if (typeof anyDelta !== 'number' || !isFinite(anyDelta)) result = { ok:false, reason:'delta must be a finite number' };
        else result = _applyPathDelta(G, apc.path, anyDelta, apc.reason);
      } else if (anyOp === 'merge') {
        result = typeof _applyPathMerge === 'function' ? _applyPathMerge(G, apc.path, apc.value, apc.reason) : { ok:false, reason:'merge unavailable' };
      } else if (anyOp === 'delete') {
        try {
          var resolvedDelete = _resolvePath(G, _normalizeCoreVarPath(apc.path));
          if (!resolvedDelete.parent || !resolvedDelete.exists) result = { ok:false, reason:'delete target not found' };
          else {
            var oldDelete = resolvedDelete.value;
            if (Array.isArray(resolvedDelete.parent) && /^\d+$/.test(String(resolvedDelete.key))) resolvedDelete.parent.splice(Number(resolvedDelete.key), 1);
            else delete resolvedDelete.parent[resolvedDelete.key];
            result = { ok: true, path:_normalizeCoreVarPath(apc.path), old: oldDelete, new: undefined };
          }
        } catch(e) { result = { ok:false, reason:'delete failed' }; }
      } else if (anyOp === 'set') {
        if (!Object.prototype.hasOwnProperty.call(apc, 'value')) result = { ok:false, reason:'set requires value' };
        else result = _applyPathSet(G, apc.path, apc.value, apc.reason);
      } else {
        result = { ok:false, reason:'unsupported op: ' + anyOp };
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
    _runConsistencyValidator(applied, aiOutput, 'fiscal', function() { _validateFiscalConsistency(G, aiOutput, applied); });

    // ── 14a. 人事一致性校验·扫描叙事中『某某下狱/赐死/抄家/流放』vs 结构化数据 ──
    _runConsistencyValidator(applied, aiOutput, 'personnel', function() { _validatePersonnelConsistency(G, aiOutput, applied); });

    // ── 14b. 军事一致性校验·扫描『扩军/裁汰 N 万』vs GM.armies 真实变化 ──
    _runConsistencyValidator(applied, aiOutput, 'military', function() { _validateMilitaryConsistency(G, aiOutput, applied); });

    // ── 14c. 民心/皇威一致性校验·扫描『民心大振/民怨沸腾/朝野失望』vs turnChanges ──
    _runConsistencyValidator(applied, aiOutput, 'sentiment', function() { _validateSentimentConsistency(G, aiOutput, applied); });

    // ── 14d. 户口一致性校验·扫描『饥荒死 N/逃户 M/迁徙 X』vs GM.population ──
    _runConsistencyValidator(applied, aiOutput, 'population', function() { _validatePopulationConsistency(G, aiOutput, applied); });

    // ── 14e. 官职任免一致性校验·扫描『拜 X 为 Y/擢 X 为 Y/迁』vs office_assignments ──
    _runConsistencyValidator(applied, aiOutput, 'office', function() { _validateOfficeConsistency(G, aiOutput, applied); });

    // ── 14f-1. 战争一致性校验·扫描『起兵/北伐/议和/陷落』vs GM.activeWars ──
    _runConsistencyValidator(applied, aiOutput, 'war', function() { _validateWarConsistency(G, aiOutput, applied); });

    // ── 14f-2. 民变一致性校验·扫描『起事/聚众/平定/招抚』vs GM.minxin.revolts ──
    _runConsistencyValidator(applied, aiOutput, 'revolt', function() { _validateRevoltConsistency(G, aiOutput, applied); });

    // ── 14f-3. 天灾一致性校验·扫描『大旱/洪/蝗/瘟疫/地震』vs GM.activeDisasters ──
    _runConsistencyValidator(applied, aiOutput, 'disaster', function() { _validateDisasterConsistency(G, aiOutput, applied); });

    // ── 14f-4. 外交一致性校验·扫『通使/朝贡/绝交/羁縻』 vs GM.facs[].relations ──
    _runConsistencyValidator(applied, aiOutput, 'diplomacy', function() { _validateDiplomacyConsistency(G, aiOutput, applied); });

    // ── 14f-5. 科举一致性校验·扫『开科/会试/殿试/放榜/赐进士』 vs P.keju ──
    _runConsistencyValidator(applied, aiOutput, 'keju', function() { _validateKejuConsistency(G, aiOutput, applied); });

    // ── 14f-6. 党派一致性校验·扫『结社/立党/解散/瓦解』 vs GM.parties ──
    _runConsistencyValidator(applied, aiOutput, 'party', function() { _validatePartyConsistency(G, aiOutput, applied); });

    // ── 14f-7. 法令效力一致性校验·扫『颁诏/降旨/敕谕/废制』 vs GM.activeEdicts ──
    _runConsistencyValidator(applied, aiOutput, 'edictEffect', function() { _validateEdictEffectConsistency(G, aiOutput, applied); });

    // ── 14f-8. 朝廷礼仪一致性校验·扫『迁都/晋爵/谥/册立/废后』 vs char_updates 内 title/posthumous/spouse ──
    _runConsistencyValidator(applied, aiOutput, 'courtCeremony', function() { _validateCourtCeremonyConsistency(G, aiOutput, applied); });

    // ── 14f-9. 工程·物品·建筑一致性校验·扫『兴工/督造/烧毁/铸器』 vs changes 路径 ──
    _runConsistencyValidator(applied, aiOutput, 'construction', function() { _validateConstructionConsistency(G, aiOutput, applied); });

    // ── 14f-10. 异象·谶语一致性校验·扫『彗见/日蚀/瑞兽/谶/谣』 vs GM.omens ──
    _runConsistencyValidator(applied, aiOutput, 'omen', function() { _validateOmenConsistency(G, aiOutput, applied); });

    // ── 14f-11. 婚姻·生育·继承一致性校验·扫『嫁/娶/诞生/夭折/即位/承嗣』 ──
    _runConsistencyValidator(applied, aiOutput, 'marriageBirth', function() { _validateMarriageBirthConsistency(G, aiOutput, applied); });

    // ── 14f-12. 谋反·政变·弑君一致性校验·扫『谋反/弑君/宫变/篡位』 ──
    _runConsistencyValidator(applied, aiOutput, 'conspiracy', function() { _validateConspiracyConsistency(G, aiOutput, applied); });

    // ── 14f-13. 货币·币值·银荒一致性校验·扫『银荒/钱荒/通胀/币改』 ──
    _runConsistencyValidator(applied, aiOutput, 'currency', function() { _validateCurrencyConsistency(G, aiOutput, applied); });

    // ── 14f-14. 宗教·教派一致性校验·扫『立教/灭佛/白莲/天主/邪教』 ──
    _runConsistencyValidator(applied, aiOutput, 'religion', function() { _validateReligionConsistency(G, aiOutput, applied); });
    _runConsistencyValidator(applied, aiOutput, 'livingActor', function() {
      if (typeof window !== 'undefined' && typeof window._validateLivingActorConsistency === 'function') window._validateLivingActorConsistency(G, aiOutput);
    });
    _runConsistencyValidator(applied, aiOutput, 'anachronism', function() {
      if (typeof window !== 'undefined' && typeof window._validateNarrativeAnachronism === 'function') window._validateNarrativeAnachronism(G, aiOutput);
    });

    // validator 命中即属于结构化写回不完整。旧逻辑只 warning 后继续，并另起后台 AI
    // 补录，导致本批先以成功状态部分提交；现改为失败清单，由外层草稿事务整体回滚。
    // 只有完整 endTurn 主写回携带 strictValidation。独立的确定性补丁/测试调用常无完整
    // narrative，上下文不足时不能把“缺叙事证据”误判为状态失败。
    var _validatorFailures = aiOutput._strictValidation === true ? _collectValidatorFailures(G, _validatorBaseline) : [];
    if (_validatorFailures.length) Array.prototype.push.apply(applied.failed, _validatorFailures);

    // ── 15. 死亡墓志铭 & 诈死holding ──
    try { _processDeathEpitaphs(G, aiOutput); } catch(_deE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_deE, 'applier] death epitaph:') : console.warn('[applier] death epitaph:', _deE); }

    // ── 16. 财政三字段强制同步·防 money/balance/ledgers.stock 跑偏 ──
    // 多个引擎(applier/FixedExpense/AuthorityComplete/AuthorityEngines/Keju)各自写不同字段·此处兜底对齐
    try { if (typeof _syncFiscalScalars === 'function') _syncFiscalScalars(G); } catch(_syE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_syE, 'applier] fiscal sync:') : console.warn('[applier] fiscal sync:', _syE); }

    return { ok: true, applied: applied };
  }

  function applyAITurnChanges(aiOutput){ return __acaP.applyAITurnChangesAtomic.apply(this, arguments); }
  function _syncFiscalScalars(G){ return __acaP._syncFiscalScalars.apply(this, arguments); }
  if (typeof window !== 'undefined') window._syncFiscalScalars = _syncFiscalScalars;

  //>>ACA-SPLIT22-SHIMS-START  (巨石拆分第二十二拆 20260706·脚本生成·勿手改)
  // origin=本片(先装载)。两分片 tm-ai-change-applier-validators.js / -reconcile.js 于本片【之后】装载，
  // 经共享 bucket TM.__acaParts 双向接线：本片装载末尾把 kept 成员导出 bucket 供分片闭包捕获；
  // 分片把校验器/复核族函数回填 bucket，本片下列委托 shim（函数声明·已提升·形参列表保真=arity 与拆前一致）于调用期解析。契约见 lint-split-contracts。
  var __acaP = (function(){ var t = global.TM = global.TM || {}; return t.__acaParts = t.__acaParts || {}; })();
  // — 校验器族（迁出 tm-ai-change-applier-validators.js）—
  function _validatePersonnelConsistency(G, aiOutput, applied){ return __acaP._validatePersonnelConsistency.apply(this, arguments); }
  function _validateMilitaryConsistency(G, aiOutput, applied){ return __acaP._validateMilitaryConsistency.apply(this, arguments); }
  function _validateSentimentConsistency(G, aiOutput, applied){ return __acaP._validateSentimentConsistency.apply(this, arguments); }
  function _validatePopulationConsistency(G, aiOutput, applied){ return __acaP._validatePopulationConsistency.apply(this, arguments); }
  function _validateOfficeConsistency(G, aiOutput, applied){ return __acaP._validateOfficeConsistency.apply(this, arguments); }
  function _validateWarConsistency(G, aiOutput, applied){ return __acaP._validateWarConsistency.apply(this, arguments); }
  function _validateRevoltConsistency(G, aiOutput, applied){ return __acaP._validateRevoltConsistency.apply(this, arguments); }
  function _validateDisasterConsistency(G, aiOutput, applied){ return __acaP._validateDisasterConsistency.apply(this, arguments); }
  function _validateDiplomacyConsistency(G, aiOutput, applied){ return __acaP._validateDiplomacyConsistency.apply(this, arguments); }
  function _validateKejuConsistency(G, aiOutput, applied){ return __acaP._validateKejuConsistency.apply(this, arguments); }
  function _validatePartyConsistency(G, aiOutput, applied){ return __acaP._validatePartyConsistency.apply(this, arguments); }
  function _validateEdictEffectConsistency(G, aiOutput, applied){ return __acaP._validateEdictEffectConsistency.apply(this, arguments); }
  function _validateCourtCeremonyConsistency(G, aiOutput, applied){ return __acaP._validateCourtCeremonyConsistency.apply(this, arguments); }
  function _validateConstructionConsistency(G, aiOutput, applied){ return __acaP._validateConstructionConsistency.apply(this, arguments); }
  function _validateMarriageBirthConsistency(G, aiOutput, applied){ return __acaP._validateMarriageBirthConsistency.apply(this, arguments); }
  function _validateConspiracyConsistency(G, aiOutput, applied){ return __acaP._validateConspiracyConsistency.apply(this, arguments); }
  function _validateCurrencyConsistency(G, aiOutput, applied){ return __acaP._validateCurrencyConsistency.apply(this, arguments); }
  function _validateReligionConsistency(G, aiOutput, applied){ return __acaP._validateReligionConsistency.apply(this, arguments); }
  function _validateOmenConsistency(G, aiOutput, applied){ return __acaP._validateOmenConsistency.apply(this, arguments); }
  function _validateFiscalConsistency(G, aiOutput, applied){ return __acaP._validateFiscalConsistency.apply(this, arguments); }
  function _maybeReconcileWithAI(G, aiOutput, applied){ return __acaP._maybeReconcileWithAI.apply(this, arguments); }
  // — 复核/善后族（迁出 tm-ai-change-applier-reconcile.js）—
  function _processDeathEpitaphs(G, aiOutput){ return __acaP._processDeathEpitaphs.apply(this, arguments); }
  function _reconcilePlayerMovements(G){ return __acaP._reconcilePlayerMovements.apply(this, arguments); }
  function _reconcilePlayerFiscalReforms(G, aiOutput){ return __acaP._reconcilePlayerFiscalReforms.apply(this, arguments); }
  function _applyOfficeDutyTick(G){ return __acaP._applyOfficeDutyTick.apply(this, arguments); }
  function _applyTaxAuthorityGate(G, fa, amount){ return __acaP._applyTaxAuthorityGate.apply(this, arguments); }
  function _applyDirectiveCompliance(G, aiOutput){ return __acaP._applyDirectiveCompliance.apply(this, arguments); }
  function _applyRegentDecisions(G, aiOutput){ return __acaP._applyRegentDecisions.apply(this, arguments); }
  function preflightAIWriteBack(aiOutput, opts){ return __acaP.preflightAIWriteBack.apply(this, arguments); }
  function _applyBattleResult(G, aiOutput, applied){ return __acaP._applyBattleResult.apply(this, arguments); }
  function _applyFiscalDeficitPenalties(G){ return __acaP._applyFiscalDeficitPenalties.apply(this, arguments); }
  function _hasInstantArrivalRule(G){ return __acaP._hasInstantArrivalRule.apply(this, arguments); }
  //>>ACA-SPLIT22-SHIMS-END

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
      if (ch.alive === false || ch.dead === true) return; // 死者不赶路·不「抵达就任」(2026-07-04 审查定罪)
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
  //>>ACA-SPLIT22-EXPORT-START  (reverse：origin→分片·全部 kept 成员已定义于此点之前)
  __acaP._alreadyResolvedState = _alreadyResolvedState; __acaP._readFiscalStock = _readFiscalStock; __acaP._writeFiscalStock = _writeFiscalStock; __acaP.onAppointment = onAppointment; __acaP.onDismissal = onDismissal; __acaP._findEntity = _findEntity;
  __acaP._estimateTravelDays = _estimateTravelDays; __acaP._arriveCharNow = _arriveCharNow; __acaP._sameTravelLocation = _sameTravelLocation; __acaP._travelMirrorFields = _travelMirrorFields; __acaP._syncCharacterLocationMirrors = _syncCharacterLocationMirrors; __acaP._refreshCharacterLocationUiAfterTravel = _refreshCharacterLocationUiAfterTravel;
  __acaP._applyAITurnChangesUnsafe = _applyAITurnChangesUnsafe;
  //>>ACA-SPLIT22-EXPORT-END

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
