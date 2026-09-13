// GENERATED FILE — run: npm run build:renderer-modules

(() => {
  // web/modules/ai-change-applier/core.js
  function createCore(deps) {
    if (!deps || !deps.global) throw new Error("[AIChangeApplier] core dependencies missing");
    var global = deps.global;
    var _modules = { validators: null, reconcile: null };
    "use strict";
    var _PathUtils = deps.pathUtils;
    if (!_PathUtils) console.warn("[ai-change-applier] TM.AIChange.PathUtils not loaded·legacy aliases will be null");
    var _resolvePath = _PathUtils && _PathUtils.resolvePath;
    var _normalizeCoreVarPath = _PathUtils && _PathUtils.normalizeCoreVarPath;
    var _syncCoreVarSideEffects = _PathUtils && _PathUtils.syncCoreVarSideEffects;
    var _deriveLabel = _PathUtils && _PathUtils.deriveLabel;
    var _findDivisionByNameOrId = _PathUtils && _PathUtils.findDivisionByNameOrId;
    var _findInTreeDeep = _PathUtils && _PathUtils.findInTreeDeep;
    var _recordCharChange = _PathUtils && _PathUtils.recordCharChange;
    var _recordToTurnChanges = _PathUtils && _PathUtils.recordToTurnChanges;
    var _applyPathDelta = _PathUtils && _PathUtils.applyPathDelta;
    var _applyPathSet = _PathUtils && _PathUtils.applyPathSet;
    var _applyPathPush = _PathUtils && _PathUtils.applyPathPush;
    var _applyPathMerge = _PathUtils && _PathUtils.applyPathMerge;
    var _applyDeclaredPathChanges = _PathUtils && _PathUtils.applyDeclaredPathChanges;
    var _isPlainObject = _PathUtils && _PathUtils.isPlainObject;
    var _isPathBlocked = _PathUtils && _PathUtils.isPathBlocked;
    var _Army = deps.army;
    if (!_Army) console.warn("[ai-change-applier] TM.AIChange.Army not loaded·legacy army aliases will be null");
    var applyAIArmyChange = _Army && _Army.applyAIArmyChange;
    var _applyAIArmyChangeList = _Army && _Army.applyAIArmyChangeList;
    var _clampNum = _Army && _Army.clampNum;
    var _normalizeArmyKey = _Army && _Army.normalizeArmyKey;
    var _findArmyForAIChange = _Army && _Army.findArmyForAIChange;
    var _refreshMilitaryViews = _Army && _Army.refreshMilitaryViews;
    var _armyLooseNamePattern = _Army && _Army.armyLooseNamePattern;
    var _armyNarrativeAliases = _Army && _Army.armyNarrativeAliases;
    var _resolveNarrativeCommanderName = _Army && _Army.resolveNarrativeCommanderName;
    var _applyNarrativeArmyCommanderFallback = _Army && _Army.applyNarrativeArmyCommanderFallback;
    var _Narrative = deps.narrative;
    if (!_Narrative) console.warn("[ai-change-applier] TM.AIChange.Narrative not loaded·legacy narrative aliases will be null");
    var _mergeUpdatesToEntity = _Narrative && _Narrative.mergeUpdatesToEntity;
    var _applyNarrativeArmyFieldFallback = _Narrative && _Narrative.applyNarrativeArmyFieldFallback;
    var _applyNarrativeRegionFieldFallback = _Narrative && _Narrative.applyNarrativeRegionFieldFallback;
    var _applyNarrativeFactionFieldFallback = _Narrative && _Narrative.applyNarrativeFactionFieldFallback;
    var _setFactionLeader = _Narrative && _Narrative.setFactionLeader;
    var _resolveNarrativeAliveChar = _Narrative && _Narrative.resolveAliveChar;
    var _safeOwnCopy = _Narrative && _Narrative.safeOwnCopy;
    var _applyStructuredPartyUpdate = _Narrative && _Narrative.applyStructuredPartyUpdate;
    function _findEntity2(G, category, identifier) {
      if (!G || !identifier) return null;
      category = (category || "").toLowerCase();
      if (category === "char" || category === "character") {
        var clean = String(identifier).trim().replace(/[\s,，、。？！；：]/g, "");
        if (!clean) return null;
        var exact = (G.chars || []).find(function(c) {
          return c && (c.name === clean || c.id === clean);
        });
        if (exact) return exact;
        var stripped = clean.replace(/^(太\u5E08|太\u5085|太\u4FDD|\u592A\u5B50|\u9646|\u592A\u9632|\u4E2D|\u5927)/, "");
        if (stripped && stripped !== clean) {
          exact = (G.chars || []).find(function(c) {
            return c && c.name === stripped;
          });
          if (exact) return exact;
        }
        var prefix = (G.chars || []).find(function(c) {
          return c && c.name && clean.indexOf(c.name) === 0 && clean.length - c.name.length <= 2;
        });
        if (prefix) return prefix;
        return null;
      } else if (category === "faction" || category === "fac") {
        return (G.facs || []).find(function(f) {
          return f && (f.name === identifier || f.id === identifier);
        });
      } else if (category === "party") {
        return (G.parties || []).find(function(p) {
          return p && (p.name === identifier || p.id === identifier);
        });
      } else if (category === "class") {
        return (G.classes || []).find(function(c) {
          return c && (c.name === identifier || c.id === identifier);
        });
      } else if (category === "army") {
        return (G.armies || []).find(function(a) {
          return a && (a.name === identifier || a.id === identifier);
        });
      } else if (category === "item") {
        return (G.items || []).find(function(i) {
          return i && (i.name === identifier || i.id === identifier);
        });
      } else if (category === "region" || category === "division") {
        return _findDivisionByNameOrId(G, identifier);
      }
      return null;
    }
    function _resolveBinding(binding) {
      var G = global.GM;
      if (!G || !binding) return null;
      var parts = String(binding).split(":");
      var type = parts[0], id = parts[1];
      switch (type) {
        case "region":
          if (G.regionMap && G.regionMap[id]) return G.regionMap[id];
          var _diR = _normalizeDynamicInstitutions(G).find(function(x) {
            return x && x.id === id && x.type === "region";
          });
          if (_diR) return _diR;
          if (G.adminHierarchy) {
            for (var facId in G.adminHierarchy) {
              var divs = G.adminHierarchy[facId].divisions || [];
              var found = _findInTree(divs, id);
              if (found) return found;
            }
          }
          return null;
        case "ministry":
          if (G.fiscal && G.fiscal.guoku && G.fiscal.guoku.subBudgets && G.fiscal.guoku.subBudgets[id]) return G.fiscal.guoku.subBudgets[id];
          var _diM = _normalizeDynamicInstitutions(G).find(function(x) {
            return x && x.id === id && (x.type === "ministry" || x.type == null);
          });
          if (_diM) return _diM;
          return null;
        case "military":
          if (G.fiscal && G.fiscal.guoku && G.fiscal.guoku.subBudgets && G.fiscal.guoku.subBudgets.military && G.fiscal.guoku.subBudgets.military[id]) return G.fiscal.guoku.subBudgets.military[id];
          var _diU = _normalizeDynamicInstitutions(G).find(function(x) {
            return x && x.id === id && x.type === "military";
          });
          if (_diU) return _diU;
          return null;
        case "imperial":
          if (G.fiscal && G.fiscal.neicang && G.fiscal.neicang.subBudgets && G.fiscal.neicang.subBudgets[id]) return G.fiscal.neicang.subBudgets[id];
          return null;
        default:
          return null;
      }
    }
    function _findInTree(divisions, id) {
      for (var i = 0; i < (divisions || []).length; i++) {
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
          money: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
          grain: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
          cloth: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
          currentHead: null,
          previousHead: null,
          handoverLog: []
        };
      }
      return entity.publicTreasury;
    }
    function _ensurePublicTreasuryResource(entity, resource) {
      var treasury = _ensurePublicTreasury(entity);
      if (!treasury) return null;
      if (!treasury[resource]) treasury[resource] = { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 };
      return treasury[resource];
    }
    function _readFiscalStock(target, resource) {
      if (!target) return 0;
      if (target.stock !== void 0 || target.available !== void 0 || target.quota !== void 0 || target.deficit !== void 0) {
        if (target.stock !== void 0) return Number(target.stock) || 0;
        return Number(target.available) || 0;
      }
      if (resource === "money") {
        if (target.money !== void 0) return Number(target.money) || 0;
        if (target.balance !== void 0) return Number(target.balance) || 0;
      }
      return Number(target[resource]) || 0;
    }
    function _writeFiscalStock(target, resource, value) {
      if (!target) return;
      value = Number(value) || 0;
      if (target.stock !== void 0 || target.available !== void 0 || target.quota !== void 0 || target.deficit !== void 0) {
        target.stock = value;
        if (target.available !== void 0) target.available = value;
        return;
      }
      target[resource] = value;
      if (resource === "money") target.balance = value;
      if (target.ledgers && target.ledgers[resource]) {
        target.ledgers[resource].stock = value;
      }
    }
    function _findChar(name) {
      var G = global.GM;
      if (!G || !G.chars) return null;
      return G.chars.find(function(c) {
        return c.name === name;
      });
    }
    function _findOfficePos(tree, positionName, deptHint) {
      if (!tree || !positionName) return null;
      var found = null;
      function walk(nodes, parentPath) {
        (nodes || []).forEach(function(n) {
          if (found) return;
          if (!n) return;
          var curPath = (parentPath ? parentPath + "/" : "") + (n.name || "");
          if (Array.isArray(n.positions)) {
            for (var i = 0; i < n.positions.length; i++) {
              var p = n.positions[i];
              if (!p || !p.name) continue;
              var match = p.name === positionName || p.name.indexOf(positionName) >= 0 || positionName.indexOf(p.name) >= 0;
              if (!match) continue;
              if (deptHint && curPath.indexOf(deptHint) < 0 && n.name !== deptHint) continue;
              found = { node: n, pos: p, path: curPath };
              return;
            }
          }
          if (Array.isArray(n.subs)) walk(n.subs, curPath);
        });
      }
      if (deptHint) walk(tree, "");
      if (!found) {
        deptHint = null;
        walk(tree, "");
      }
      return found;
    }
    function _isKnownOfficeType(G, position) {
      var p = String(position || "");
      if (p.length < 2) return false;
      if (/(尚书|侍郎|郎中|主事|员外郎|巡抚|巡按|总督|督师|经略|总兵|提督|镇守|总镇|参将|游击|守备|布政使|按察使|都指挥|知府|知州|知县|同知|通判|刺史|太守|节度|观察使|防御使|团练使|学士|大学士|御史|给事中|寺卿|少卿|詹事|府尹|州牧|总理|总管|留守|宣慰使|宣抚使|安抚使|招讨使|经历司)$/.test(p)) return true;
      var sufs = [p.slice(-2)];
      if (p.length >= 3) sufs.push(p.slice(-3));
      var pool = [];
      try {
        (G && G.chars || []).forEach(function(c) {
          if (!c) return;
          if (c.officialTitle) pool.push(String(c.officialTitle));
          if (Array.isArray(c.officialTitles)) c.officialTitles.forEach(function(t) {
            if (t) pool.push(String(t));
          });
        });
      } catch (_e1) {
      }
      try {
        (function walk(nodes) {
          (nodes || []).forEach(function(n) {
            if (!n) return;
            if (n.name) pool.push(String(n.name));
            if (Array.isArray(n.positions)) n.positions.forEach(function(pp) {
              if (pp && pp.name) pool.push(String(pp.name));
            });
            if (Array.isArray(n.subs)) walk(n.subs);
          });
        })(G && G.officeTree || []);
      } catch (_e2) {
      }
      return pool.some(function(t) {
        return t && t !== p && sufs.some(function(s) {
          return s.length >= 2 && t.indexOf(s) >= 0;
        });
      });
    }
    function onAppointment(charName, position, binding) {
      var G = global.GM;
      var ch = _findChar(charName);
      if (!ch) return { ok: false, reason: "未找到角色 " + charName };
      var isConcurrent = typeof global._offIsConcurrentAppointment === "function" ? global._offIsConcurrentAppointment(binding || {}, position) : !!(binding && (binding.concurrent || binding.mode === "concurrent"));
      var oldBinding = ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.binding;
      if (!isConcurrent && oldBinding) {
        var oldEntity = _resolveBinding(oldBinding);
        if (oldEntity) {
          _ensurePublicTreasury(oldEntity);
          oldEntity.publicTreasury.handoverLog.push({
            turn: G.turn || 0,
            fromChar: charName,
            toChar: null,
            note: "转任 " + (position || "新职"),
            deficit: oldEntity.publicTreasury.money.deficit || 0
          });
          oldEntity.publicTreasury.previousHead = charName;
          oldEntity.publicTreasury.currentHead = null;
        }
      }
      if (!ch.resources) ch.resources = {};
      if (!ch.resources.publicTreasury) ch.resources.publicTreasury = { binding: null };
      if (isConcurrent && binding) {
        if (!Array.isArray(ch.resources.publicTreasury.concurrentBindings)) ch.resources.publicTreasury.concurrentBindings = [];
        ch.resources.publicTreasury.concurrentBindings.push(binding);
      } else {
        ch.resources.publicTreasury.binding = binding || null;
      }
      var _preApptTitle = ch.officialTitle || "";
      if (position) {
        if (typeof global._offAddCharOfficeTitle === "function") {
          global._offAddCharOfficeTitle(ch, position, { concurrent: isConcurrent });
        } else if (!isConcurrent || !ch.officialTitle) {
          ch.officialTitle = position;
        }
      }
      if (position && ch.currentPosition && !isConcurrent) ch.currentPosition.title = position;
      var treeUpdated = false;
      var evicted = null;
      if (position) {
        let _clearOldHolders = function(nodes) {
          (nodes || []).forEach(function(n) {
            if (!n) return;
            if (Array.isArray(n.positions)) {
              n.positions.forEach(function(p) {
                if (!p) return;
                var wasHolder = p.holder === charName;
                if (Array.isArray(p.actualHolders)) {
                  var oldIdx = -1;
                  for (var _i = 0; _i < p.actualHolders.length; _i++) {
                    if (p.actualHolders[_i] && p.actualHolders[_i].name === charName) {
                      oldIdx = _i;
                      break;
                    }
                  }
                  if (oldIdx >= 0) {
                    var removed = p.actualHolders.splice(oldIdx, 1)[0];
                    if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
                    p.holderHistory.push({ name: charName, since: removed && removed.joinedTurn || 0, until: G.turn || 0, reason: "转任" });
                    if (wasHolder) {
                      p.holder = p.actualHolders[0] && p.actualHolders[0].name || "";
                      p.holderSinceTurn = p.actualHolders[0] && p.actualHolders[0].joinedTurn || (G.turn || 0);
                    }
                  }
                } else if (wasHolder) {
                  if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
                  p.holderHistory.push({ name: charName, since: p.holderSinceTurn || 0, until: G.turn || 0, reason: "转任" });
                  p.holder = "";
                }
              });
            }
            if (Array.isArray(n.subs)) _clearOldHolders(n.subs);
          });
        };
        var deptHint = binding && typeof binding === "object" ? binding.dept || binding.deptHint : null;
        if (!isConcurrent) _clearOldHolders(G.officeTree || []);
        var hit = _findOfficePos(G.officeTree || [], position, deptHint);
        if (hit) {
          var pos = hit.pos;
          var cap = Math.max(1, parseInt(pos.headCount) || 1);
          if (!Array.isArray(pos.actualHolders)) {
            pos.actualHolders = [];
            if (pos.holder) pos.actualHolders.push({ name: pos.holder, joinedTurn: pos.holderSinceTurn || 0 });
          }
          var curCount = pos.actualHolders.length;
          if (pos.actualHolders.some(function(h) {
            return h && h.name === charName;
          })) {
          } else if (curCount < cap) {
            pos.actualHolders.push({ name: charName, joinedTurn: G.turn || 0 });
          } else {
            var oldestIdx = 0;
            var oldestTurn = Number.POSITIVE_INFINITY;
            pos.actualHolders.forEach(function(h, idx) {
              if (!h) return;
              var jt = typeof h.joinedTurn === "number" ? h.joinedTurn : 0;
              if (jt < oldestTurn) {
                oldestTurn = jt;
                oldestIdx = idx;
              }
            });
            var removed2 = pos.actualHolders.splice(oldestIdx, 1)[0];
            if (removed2 && removed2.name) {
              evicted = removed2.name;
              var prevCh2 = _findChar(removed2.name);
              var _vac2 = prevCh2 && typeof global._offVacateCharFromSeat === "function" && global._offVacateCharFromSeat(prevCh2, hit.node && hit.node.name || "", pos.name || position);
              if (!_vac2 && prevCh2 && typeof global._offRemoveCharOfficeTitle === "function") {
                global._offRemoveCharOfficeTitle(prevCh2, pos.name || position);
                if (position && position !== pos.name) global._offRemoveCharOfficeTitle(prevCh2, position);
              } else if (!_vac2 && prevCh2 && (prevCh2.officialTitle === pos.name || prevCh2.officialTitle === position)) {
                prevCh2.officialTitle = "";
                prevCh2.title = "";
              }
              if (!Array.isArray(pos.holderHistory)) pos.holderHistory = [];
              pos.holderHistory.push({ name: removed2.name, since: removed2.joinedTurn || 0, until: G.turn || 0, reason: "额满·最老者罢黜" });
              if (global.addEB) global.addEB("任免", pos.name + " 额满（" + cap + "人）——" + removed2.name + " 罢");
            }
            pos.actualHolders.push({ name: charName, joinedTurn: G.turn || 0 });
          }
          pos.holder = pos.actualHolders[0] && pos.actualHolders[0].name || charName;
          pos.holderSinceTurn = pos.actualHolders[0] && pos.actualHolders[0].joinedTurn || (G.turn || 0);
          if (typeof _offMigratePosition === "function") _offMigratePosition(pos);
          if (Array.isArray(pos.actualHolders)) {
            var _namedSync = pos.actualHolders.filter(function(h) {
              return h && h.name && h.generated !== false;
            }).map(function(h) {
              return h.name;
            });
            pos.holder = _namedSync[0] || charName;
            pos.additionalHolders = _namedSync.slice(1);
            var _estSync = pos.establishedCount != null ? parseInt(pos.establishedCount, 10) : parseInt(pos.headCount, 10) || Math.max(1, _namedSync.length);
            pos.vacancyCount = Math.max(0, _estSync - _namedSync.length);
            pos.actualCount = Math.max(pos.actualHolders.length, _namedSync.length);
          }
          treeUpdated = true;
          if (pos.name && pos.name !== position) {
            if (typeof global._offRemoveCharOfficeTitle === "function") global._offRemoveCharOfficeTitle(ch, position);
            if (typeof global._offAddCharOfficeTitle === "function") global._offAddCharOfficeTitle(ch, pos.name, { concurrent: isConcurrent });
            else ch.officialTitle = pos.name;
          }
          if (!binding && pos.bindingHint) {
            ch.resources.publicTreasury.binding = { dept: hit.node.name, position: pos.name, hint: pos.bindingHint };
          }
        } else if (_isKnownOfficeType(G, position)) {
          if (ch.currentPosition && !isConcurrent && ch.currentPosition.title !== position) ch.currentPosition.title = position;
          if (global.addEB) global.addEB("任免", "官制树无「" + position + "」节点（地方/未列职·职种已有）·衔记于角色表 officialTitle");
        } else {
          if (typeof global._offRemoveCharOfficeTitle === "function") {
            try {
              global._offRemoveCharOfficeTitle(ch, position);
            } catch (_gh) {
            }
          }
          if (ch.officialTitle === position) ch.officialTitle = _preApptTitle;
          if (ch.currentPosition && ch.currentPosition.title === position) ch.currentPosition.title = _preApptTitle;
          if (global.addEB) global.addEB("任免※", "官制无「" + position + "」一职（职种剧本查无·疑杜撰）·回滚幽灵衔");
        }
      }
      if (binding) {
        var newEntity = _resolveBinding(binding);
        if (newEntity) {
          _ensurePublicTreasury(newEntity);
          newEntity.publicTreasury.currentHead = charName;
          newEntity.publicTreasury.headSinceTurn = G.turn || 0;
          if (newEntity.publicTreasury.money.deficit > 0) {
            if (global.addEB) global.addEB("任免", charName + " 承 " + (newEntity.publicTreasury.previousHead || "前任") + " 亏空 " + newEntity.publicTreasury.money.deficit + " 两");
          }
        }
      }
      if (global.addEB) global.addEB("任免", "擢 " + charName + " 为 " + (position || "某职") + (treeUpdated ? "" : " · 官制未同步") + (evicted ? " · 额满罢 " + evicted : ""));
      var _newLv = null;
      try {
        if (global.TMPromotion && typeof global.TMPromotion.resolveRankLevel === "function") {
          _newLv = global.TMPromotion.resolveRankLevel(ch, G);
          if (_newLv != null && _newLv >= 1 && _newLv <= 18) ch.rankLevel = _newLv;
        }
      } catch (_rlE) {
      }
      try {
        var _TPp = global.TMPromotion;
        if (_TPp && _newLv != null && !isConcurrent) {
          var _pen = _TPp.penaltyForGap(_TPp.meritFloor(_newLv) - (ch.resources && ch.resources.virtueMerit || 0));
          if (_pen.severity >= 2) {
            var _hwDelta = (_pen.severity === 3 ? -3 : -2) - (_TPp.isPoliticalZone(_newLv) ? 3 : 0);
            if (global.AuthorityEngines && typeof global.AuthorityEngines.adjustHuangwei === "function") global.AuthorityEngines.adjustHuangwei("promotion_unqualified", _hwDelta, charName + " 功名浅而骤擢·" + _pen.label);
            if (global.addEB) global.addEB("清议", "言官论 " + charName + " " + _pen.label + "·功名未孚而骤膺重任·物议沸然");
          }
          var _TG = global.TMGongming;
          var _cg = _TG && _TG.ceilingGap ? _TG.ceilingGap(ch, _newLv, G) : 0;
          if (_cg > 0) {
            var _og = _TG && _TG.describe ? _TG.describe(ch, G) : null;
            var _ohw = -Math.min(10, 3 + _cg * 2) - (_TPp.isPoliticalZone(_newLv) ? 2 : 0);
            if (global.AuthorityEngines && typeof global.AuthorityEngines.adjustHuangwei === "function") global.AuthorityEngines.adjustHuangwei("promotion_overceiling", _ohw, charName + " 出身" + (_og ? "（" + _og.title + "）" : "") + "·越次逾品·名分有亏");
            if (global.addEB) global.addEB("清议", "言官劾 " + charName + " 出身" + (_og && _og.yi ? "异途" : "资浅") + "·骤膺逾品之任" + (_og && _og.qing === false && _TPp.isPoliticalZone(_newLv) ? "·玷污清班" : "") + "·清议大哗");
          }
        }
      } catch (_penE) {
      }
      try {
        if (global.CharEconEngine && typeof global.CharEconEngine.reconcileSocialClassOnAppointment === "function") global.CharEconEngine.reconcileSocialClassOnAppointment(ch);
      } catch (_scE) {
      }
      try {
        if (position && !isConcurrent && ch.location && !ch._travelTo && typeof _sameTravelLocation === "function") {
          var _apCap = G && (G._capital || G.capital) || "京师";
          var _apDest = _apCap;
          var _apRe = /([一-龥]{2,4})(?:巡抚|总兵|总督|督师|经略|节度|布政使|按察使|提督|镇守)/;
          var _apReg = String(position || "").match(_apRe);
          if (!(_apReg && _apReg[1]) && deptHint) _apReg = String(deptHint).match(_apRe);
          if (_apReg && _apReg[1]) _apDest = _apReg[1];
          if (!_sameTravelLocation(ch.location, _apDest)) {
            var _apDays = typeof _estimateTravelDays === "function" ? _estimateTravelDays(ch.location, _apDest) : 20;
            var _apInstant = typeof _hasInstantArrivalRule === "function" && _hasInstantArrivalRule(G) || !(_apDays > 0);
            ch._travelFrom = ch.location;
            ch._travelTo = _apDest;
            ch._travelReason = "奉诏赴任 " + position;
            if (_apInstant && typeof _arriveCharNow === "function") {
              _arriveCharNow(G, ch, typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0));
            } else {
              ch._travelStartTurn = G.turn || 0;
              ch._travelRemainingDays = _apDays;
              try {
                if (typeof _syncCharacterLocationMirrors === "function") _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
              } catch (_smE) {
              }
              if (global.addEB) global.addEB("人事", charName + " 奉诏赴 " + _apDest + " 就任 " + position + "（预计 " + _apDays + " 日抵任）");
            }
          }
        }
      } catch (_apptTravelE) {
        try {
          console.warn("[onAppointment] 赴任行程启动失败(不阻断任命)", _apptTravelE);
        } catch (_) {
        }
      }
      return { ok: true, treeUpdated, evicted };
    }
    var _TM_IMPRISON_RE = /诏狱|下狱|入狱|系狱|系于狱|关押|羁押|拘押|拘禁|拘捕|拘系|缉拿|收押|收监|监禁|囚禁|囚系|牢狱|大牢|天牢|死牢|下牢|捉拿|逮捕|逮治|逮问|拿问|拿办|锁拿|械系|械送|槛车|下廷尉|下大理寺|下镇抚司|送镇抚司|镇抚司狱|打入(?:诏狱|大牢|天牢|死牢|牢|监|狱)|投入(?:诏狱|大牢|牢|监|狱)|关进(?:诏狱|大牢|牢|监|狱)|imprison|jail|prison/;
    var _TM_IMPRISON_NEG_RE = /(?:免于|免遭|免被|免予|幸免|得免|获免|避免|以免|险些|差点|差些|未予|不予|未曾|未尝|从未|无须)(?:[^，。；！？、]{0,3})?(?:诏狱|下狱|入狱|系狱|逮捕|捉拿|缉拿|拘押|羁押|拘禁|收押|收监|监禁|囚禁|牢狱|大牢|镇抚司|槛车|锁拿|械系|拿问|逮治)|(?:未|不)(?:诏狱|下狱|入狱|系狱|逮捕)/;
    function _tmReasonIsImprison(reason) {
      var s = String(reason || "");
      return _TM_IMPRISON_RE.test(s) && !_TM_IMPRISON_NEG_RE.test(s);
    }
    function onDismissal(charName, reason, aiOutput) {
      var G = global.GM;
      var ch = _findChar(charName);
      if (!ch) return { ok: false, reason: "未找到 " + charName };
      var _wgD = _modules.validators;
      if (_wgD && _wgD._gateDeathRoutingSource && _wgD._gateDeathRoutingSource(G, ch, String(reason || ""), aiOutput)) return { ok: false, reason: "no-source-bare-death(write-gate·返工issue4·死亡管线收口)" };
      var _repeatConfisc = /抄|籍没|没官|查抄/.test(String(reason || "")) && (ch._confiscated || ch.confiscated || ch._confiscatedTurn != null);
      var binding = ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.binding;
      if (binding && !_repeatConfisc) {
        var entity = _resolveBinding(binding);
        if (entity) {
          _ensurePublicTreasury(entity);
          entity.publicTreasury.handoverLog.push({
            turn: G.turn || 0,
            fromChar: charName,
            toChar: null,
            note: reason || "免职",
            deficit: entity.publicTreasury.money.deficit || 0
          });
          entity.publicTreasury.previousHead = charName;
          entity.publicTreasury.currentHead = null;
          var _benign = /致仕|乞骸|归田|退休|乞归|休致|致政|退隐|retire|召回|起复|复职|平反|释放|开释|赦免|大赦|无罪|昭雪/.test(String(reason || ""));
          if (!_benign && global.CharEconEngine && typeof global.CharEconEngine.pursueTreasuryDeficit === "function") {
            try {
              var _pr = global.CharEconEngine.pursueTreasuryDeficit(ch, entity);
              if (_pr && _pr.pursued > 0) {
                entity.publicTreasury.handoverLog.push({ turn: G.turn || 0, fromChar: charName, note: "追亏", pursued: _pr.pursued, deficitRemaining: _pr.deficitRemaining });
              }
            } catch (e) {
            }
          }
        }
      }
      if (ch.resources && ch.resources.publicTreasury) ch.resources.publicTreasury.binding = null;
      var _reasonStr = String(reason || "");
      if (/处决|处斩|处死|斩首|斩决|斩杀|戮杀|正法|明正典刑|诛杀|诛戮|诛九族|凌迟|腰斩|弃市|枭首|枭示|问斩|赐死|赐自尽|绞刑|绞死|伏诛|伏法|就戮|授首|自尽|自缢|自刎|自裁|自杀|服毒自尽|畏罪自尽|磔|execute|死刑|身故|病故|病逝|病殁|病卒|病亡|亡故|暴毙|暴卒|暴亡|猝死|物故|殒命|毙命|殉国|殉难|殉城|殉职|罹难|遇害|遇难|遭难|薨逝|溘逝|寿终|城破身死/.test(_reasonStr)) {
        var _routedDeath = false;
        if (ch.alive === false) {
          _routedDeath = true;
        } else {
          var _deathCd = { name: ch.name, reason: _reasonStr };
          try {
            if (typeof global.applyOneDeath === "function") {
              global.applyOneDeath(_deathCd);
              _routedDeath = ch.alive === false || ch.dead === true;
            } else if (typeof global.applyCharacterDeaths === "function") {
              global.applyCharacterDeaths({ character_deaths: [_deathCd] });
              _routedDeath = ch.alive === false || ch.dead === true;
            }
          } catch (_odDeathE) {
            try {
              window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_odDeathE, "onDismissal-death-route");
            } catch (__) {
            }
          }
        }
        if (!_routedDeath) {
          var _unappliedSink = global.TM && global.TM.Endturn && global.TM.Endturn.AI && global.TM.Endturn.AI.apply && global.TM.Endturn.AI.apply.recordUnappliedChange;
          if (typeof _unappliedSink === "function") _unappliedSink({ character_death: ch.name, reason: "death pipeline unavailable" }, "onDismissal");
          try {
            if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_gate", { label: "character_deaths", reason: "death pipeline unavailable", item: _deathCd });
          } catch (_) {
          }
          return { ok: false, reason: "death pipeline unavailable" };
        }
      } else if (/释放|开释|赦免|大赦|无罪|平反|昭雪|宽释|保释|出狱|赦出/.test(_reasonStr)) {
        ch._imprisoned = false;
        ch._releasedTurn = G.turn || 0;
        ch._releaseReason = _reasonStr;
      } else if (/召回|起复|复职|平反归朝/.test(_reasonStr)) {
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
        if (ch.officialTitle && !/下狱/.test(ch.officialTitle)) ch._origOfficialTitle = ch.officialTitle;
      } else if (/流放|发配|戍边|充军|发配充军|遣戍|exile|banish/.test(_reasonStr)) {
        ch._exiled = true;
        ch._exileTurn = G.turn || 0;
        ch._exileReason = _reasonStr;
      } else if (/致仕|乞骸|归田|退休|乞归|休致|致政|退隐|retire/.test(_reasonStr)) {
        ch._retired = true;
        ch.retired = true;
        ch._retireTurn = G.turn || 0;
      } else if (/逃亡|潜逃|出奔|外逃|失踪|不知所终|畏罪潜逃|flee|missing/.test(_reasonStr)) {
        ch._fled = true;
        ch._missing = true;
      }
      var _confKey = _reasonStr;
      if (_confKey === "抄家" || /抄|籍没|没官|抄没|查抄|抄家/.test(_confKey)) {
        try {
          if (global.EconomyLinkage && typeof global.EconomyLinkage.triggerConfiscationByName === "function" && !(ch._confiscated || ch.confiscated || ch._confiscatedTurn != null)) {
            var _intense = /重抄|严抄|彻查|连坐|株连/.test(_confKey) ? 0.85 : 0.6;
            var _confR = global.EconomyLinkage.triggerConfiscationByName(charName, "neitang", _intense);
            if (_confR && _confR.success) {
              ch._confiscated = true;
              ch.confiscated = true;
              if (global.addEB) {
                var _wan = Math.round((_confR.total || 0) / 1e4);
                global.addEB("惩罚", "抄" + charName + "家·明 " + Math.round((_confR.visible || 0) / 1e4) + " 万 + 暗 " + Math.round((_confR.hidden || 0) / 1e4) + " 万 = 共 " + _wan + " 万两入内帑");
              }
              if (global.GM && global.GM.qijuHistory) {
                var _qd = typeof getTSText === "function" ? getTSText(global.GM.turn) : "";
                if (typeof TM !== "undefined" && TM.Qiju) TM.Qiju.recordEntry({ turn: global.GM.turn, date: _qd, content: "【抄家】抄" + charName + "家产·得银 " + Math.round((_confR.total || 0) / 1e4) + " 万两·解内帑。" });
              }
            }
          }
        } catch (_confE) {
          try {
            window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_confE, "confiscate");
          } catch (__) {
          }
        }
      }
      (function _clearAll(nodes) {
        (nodes || []).forEach(function(n) {
          if (!n) return;
          if (Array.isArray(n.positions)) n.positions.forEach(function(p) {
            if (!p) return;
            var removedFromArr = null;
            if (Array.isArray(p.actualHolders)) {
              var i = -1;
              for (var k = 0; k < p.actualHolders.length; k++) {
                if (p.actualHolders[k] && p.actualHolders[k].name === charName) {
                  i = k;
                  break;
                }
              }
              if (i >= 0) removedFromArr = p.actualHolders.splice(i, 1)[0];
            }
            var wasPrimary = p.holder === charName;
            if (removedFromArr || wasPrimary) {
              if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
              p.holderHistory.push({ name: charName, since: removedFromArr && removedFromArr.joinedTurn || p.holderSinceTurn || 0, until: G.turn || 0, reason: reason || "免职" });
            }
            if (wasPrimary) {
              p.holder = Array.isArray(p.actualHolders) && p.actualHolders[0] && p.actualHolders[0].name || "";
              p.holderSinceTurn = Array.isArray(p.actualHolders) && p.actualHolders[0] && p.actualHolders[0].joinedTurn || 0;
            }
            if (removedFromArr || wasPrimary) {
              var namedAfterDismiss = Array.isArray(p.actualHolders) ? p.actualHolders.filter(function(h) {
                return h && h.name && h.generated !== false;
              }).map(function(h) {
                return h.name;
              }) : p.holder ? [p.holder] : [];
              p.holder = namedAfterDismiss[0] || "";
              p.additionalHolders = namedAfterDismiss.slice(1);
              var estAfterDismiss = p.establishedCount != null ? parseInt(p.establishedCount, 10) : parseInt(p.headCount, 10) || Math.max(1, namedAfterDismiss.length);
              p.vacancyCount = Math.max(0, estAfterDismiss - namedAfterDismiss.length);
              p.actualCount = Array.isArray(p.actualHolders) ? p.actualHolders.length : namedAfterDismiss.length;
            }
          });
          if (Array.isArray(n.subs)) _clearAll(n.subs);
        });
      })(G.officeTree || []);
      ch.officialTitle = null;
      ch.position = "";
      ch.title = "";
      ch.officialTitles = [];
      ch.concurrentTitles = [];
      ch.concurrentTitle = "";
      delete ch._travelAssignPost;
      delete ch._travelTo;
      delete ch._travelRemainingDays;
      ch._removedFromOfficeTurn = G.turn || 0;
      ch._removedReason = _reasonStr || "免职";
      if (global.addEB) global.addEB("任免", charName + " " + (reason || "免职"));
      return { ok: true };
    }
    function _alreadyResolvedState(ch, action, G) {
      if (!ch) return true;
      var t = G && G.turn || 0;
      var _pardoned = ch._releasedTurn != null && t - ch._releasedTurn <= 2 || ch._recalledTurn != null && t - ch._recalledTurn <= 2;
      if ((action === "imprison" || action === "arrest") && (ch._imprisoned === true || _pardoned)) return true;
      if (action === "exile" && (ch._exiled === true || _pardoned)) return true;
      if (action === "retire" && (ch._retired === true || ch.retired === true || _pardoned)) return true;
      if (action === "flee" && (ch._fled === true || ch._missing === true || _pardoned)) return true;
      if (action === "confiscate" && (ch._confiscated === true || ch.confiscated === true || ch._confiscatedTurn != null)) return true;
      if (action === "dismiss" && (!ch.officialTitle && !ch.position)) return true;
      if (action === "execute" && ch.alive === false) return true;
      return false;
    }
    function onTransfer(charName, fromPosition, toPosition, toBinding) {
      onDismissal(charName, "转任");
      return onAppointment(charName, toPosition, toBinding);
    }
    function _normalizeDynamicInstitutions(G) {
      if (!G) return [];
      var di = G.dynamicInstitutions;
      if (Array.isArray(di)) return di;
      var out = [];
      if (di && typeof di === "object") {
        [["ministries", "ministry"], ["regions", "region"], ["militaryUnits", "military"]].forEach(function(pair) {
          var pool = di[pair[0]];
          if (pool && typeof pool === "object") Object.keys(pool).forEach(function(k) {
            var inst = pool[k];
            if (inst && typeof inst === "object") {
              if (inst.type == null) inst.type = pair[1];
              out.push(inst);
            }
          });
        });
      }
      G.dynamicInstitutions = out;
      return out;
    }
    function registerInstitution(spec) {
      var G = global.GM;
      var _di = _normalizeDynamicInstitutions(G);
      var _t = spec.type === "region" ? "region" : spec.type === "military" ? "military" : "ministry";
      var inst = Object.assign({
        id: spec.id || "inst_" + (G.turn || 0) + "_" + Math.floor(Math.random() * 1e4),
        name: spec.name || "新设机构",
        createdTurn: G.turn || 0,
        stage: "running"
      }, spec, { type: _t });
      _ensurePublicTreasury(inst);
      _di.push(inst);
      if (global.addEB) global.addEB("新制", "设 " + inst.name);
      return inst;
    }
    function abolishInstitution(id, reason) {
      var G = global.GM;
      var _di = _normalizeDynamicInstitutions(G);
      if (!_di.length) return { ok: false };
      var inst = _di.find(function(x) {
        return x && x.id === id;
      });
      if (!inst) return { ok: false };
      inst.stage = "abolished";
      inst.abolishedTurn = G.turn || 0;
      inst.abolishReason = reason || "裁撤";
      if (global.addEB) global.addEB("新制", inst.name + " 裁撤");
      return { ok: true };
    }
    function reclassifyRegion(regionId, newType, reason) {
      var G = global.GM;
      var r = null;
      if (G.regionMap && G.regionMap[regionId]) r = G.regionMap[regionId];
      if (!r) r = _normalizeDynamicInstitutions(G).find(function(x) {
        return x && x.id === regionId && x.type === "region";
      }) || null;
      if (!r) return { ok: false };
      r.regionType = newType;
      if (global.addEB) global.addEB("区划", regionId + " 改为 " + newType + "（" + (reason || "") + "）");
      return { ok: true };
    }
    function _aiPolicyText(v) {
      return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    }
    function _aiPolicyAmount(v, fallback) {
      var n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback || 0;
    }
    function _aiPolicyRegion(item) {
      item = item || {};
      return _aiPolicyText(item.regionName || item.region || item.target || item.regionId || item.province || "天下");
    }
    function _aiPolicyRatioLabel(value, fallback) {
      var n = Number(value);
      if (!Number.isFinite(n)) n = fallback;
      if (!Number.isFinite(n)) n = 0.3;
      if (n <= 1) n = n * 10;
      n = Math.max(0, Math.min(10, Math.round(n)));
      return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] || String(n);
    }
    function _aiStructuredPolicyText(field, item) {
      item = item || {};
      var explicit = _aiPolicyText(item.text || item.edictText || item.draftText || item.content || item.body);
      if (explicit) return explicit;
      var action = _aiPolicyText(item.action || item.type || item.kind || item.policyId).toLowerCase();
      var region = _aiPolicyRegion(item);
      var amount = _aiPolicyAmount(item.amount || item.money || item.silver, 0);
      if (field === "currency_adjustments") {
        if (/full_currency_reform|currency_reform|silver_standard|coinage_reform/.test(action)) return "诏令：推行完整币制改革，校正银钱比价，赋役折银，以天下一钱法。";
        if (/regional_acceptance|paper_acceptance|acceptance/.test(action)) return "诏令：令" + region + "先行承用" + (item.paperName || item.name || "宝钞") + "，设兑换官局，稳其民间接受。";
        if (/overseas_silver_flow|maritime_silver|silver_flow|overseas/.test(action)) return "诏令：开海通商，引海外银流入" + region + "，并设银估以平市价。";
        if (/ban|private|mint|私铸|私钱|禁/.test(action)) return "诏令：严禁民间私铸，整饬钱法，搜检私钱作坊。";
        if (/issue|paper|发行|发钞|发/.test(action)) return "诏令：发行" + (item.paperName || item.name || "纸币") + (amount || 1e6) + "贯，准备金" + _aiPolicyRatioLabel(item.reserveRatio, 0.3) + "成。";
        if (/abolish|retire|废|罢|停/.test(action)) return "诏令：废止" + (item.paperName || item.name || "宝钞") + "，收回旧钞。";
        if (/debase|贬|减铸|轻钱/.test(action)) return "诏令：减铸" + (item.coinName || item.coinType || "铜钱") + _aiPolicyRatioLabel(item.level, 0.1) + "成，以纾军用。";
        return "";
      }
      if (field === "population_adjustments") {
        if (/start_large_corvee|large_corvee|corvee|yaoyi/.test(action)) return "诏令：征发大徭役" + (amount || 3e4) + "人，按户籍派差，以修河渠城防。";
        if (/conscription|recruit|levy_soldier|zhaomu/.test(action)) return "诏令：于" + region + "征兵" + (amount || 1e4) + "名，按" + (item.system || item.enable || "募兵") + "制补入军籍。";
        if (/migration_settlement|migrate|migration|settlement|relocate/.test(action)) return "诏令：迁徙安置流民" + (amount || 5e3) + "户，拨田给粮，令入籍安业。";
        if (/hidden|purge|清查|隐户|漏籍/.test(action)) return "诏令：清查隐户，重编入黄籍。";
        if (/resettle|refugee|fugitive|招抚|逃户|流民/.test(action)) return "诏令：招抚逃户流民，令复业入籍。";
        if (/baojia|保甲|里甲/.test(action)) return "诏令：全国编设保甲，十户一牌。";
        if (/recount|register|huangce|黄册|重造|编审/.test(action)) return "诏令：重造黄册，清厘天下户籍。";
        return "";
      }
      if (field === "central_local_actions") {
        if (/fiscal_bargain|bargain|local_fiscal/.test(action)) return "诏令：与" + region + "议地方财政博弈，明起运存留之分，以捕捐饷而安地方。";
        if (/long_term_tracking|tracking|follow_up|monitor/.test(action)) return "诏令：建立" + region + "长期财政追踪，逐月核对起运、存留、民力与官耗。";
        if (/transfer|grant|下拨|拨银|发帑|赈/.test(action)) return "诏令：下拨" + region + "银" + (amount || 5e4) + "两赈济水灾。";
        if (/force|levy|强征|追征|催征/.test(action)) return "诏令：强征" + region + "地方留存" + (amount || 3e4) + "两，以充军饷。";
        if (/censor|audit|监察|巡按|巡察/.test(action)) return "诏令：派监察御史巡按" + region + "，核其钱粮。";
        if (/allocation|share|分成|起运|存留|留成/.test(action)) return "诏令：调整" + region + "分成，起运" + _aiPolicyRatioLabel(item.qiyunRatio != null ? item.qiyunRatio : item.centralShare, 0.7) + "成，存留" + _aiPolicyRatioLabel(item.cunliuRatio != null ? item.cunliuRatio : item.retainedShare, 0.3) + "成。";
        return "";
      }
      if (field === "environment_actions") {
        if (/migration_relief|migration|relocate|carry_capacity/.test(action)) return "诏令：令" + region + "迁民出山，退耕还林，减轻山地承载。";
        if (/tech_investment|technology|water_tech|investment/.test(action)) return "诏令：于" + region + "投入水利技术与省水农具，试行新法以复田力。";
        if (/disaster_recovery|recovery|restore|post_disaster/.test(action)) return "诏令：行" + region + "灾后恢复链，修堤、清淤、复耕，三年考其成。";
        if (/ban|logging|jin_hu|禁伐|禁樵/.test(action)) return "诏令：禁伐" + region + "山林，严禁樵采。";
        if (/dredge|water|shui|疏浚|水利|治水/.test(action)) return "诏令：疏浚" + region + "河道，兴修水利。";
        if (/reclaim|relief|tun|复耕|屯田|赈灾/.test(action)) return "诏令：赈灾复耕，屯田养地。";
        if (/fallow|rest|休耕|限垦|养地/.test(action)) return "诏令：限垦休耕，以养地力。";
        if (/open|waste|开荒|垦荒|垦殖/.test(action)) return "诏令：开荒" + region + "荒田，以增农亩。";
        return "";
      }
      if (field === "institution_changes") {
        if (/abolish|remove|retire|废|罢|裁|撤|裁撤|废止/.test(action)) {
          var oldName = _aiPolicyText(item.officeName || item.name || item.institutionName || item.id || "旧司");
          return "诏令：裁撤" + oldName + "机构，归并职掌，罢其冗员。";
        }
        if (/create|add|register|office|设|立|置|创|新/.test(action)) {
          var name = _aiPolicyText(item.officeName || item.name || item.institutionName || "新司");
          return "诏令：设" + name + "，品级" + (item.rank || 5) + "，掌" + (item.duties || item.description || "专理新政") + "。";
        }
        return "";
      }
      return "";
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
      if (field === "currency_adjustments") {
        if (item.paperId) params.paperId = item.paperId;
        if (item.paperName || item.name) params.paperName = item.paperName || item.name;
        if (item.reserveRatio != null) params.reserveRatio = Number(item.reserveRatio);
        if (item.coinType) params.coinType = item.coinType;
        if (item.level != null) params.level = Number(item.level);
        if (item.acceptanceDelta != null) params.acceptanceDelta = Number(item.acceptanceDelta);
      } else if (field === "central_local_actions") {
        if (item.qiyunRatio != null || item.centralShare != null) params.qiyunRatio = Number(item.qiyunRatio != null ? item.qiyunRatio : item.centralShare);
        if (item.cunliuRatio != null || item.retainedShare != null) params.cunliuRatio = Number(item.cunliuRatio != null ? item.cunliuRatio : item.retainedShare);
        if (item.retainedShare != null) params.retainedShare = Number(item.retainedShare);
        if (item.purpose) params.purpose = item.purpose;
        if (item.cost != null) params.cost = _aiPolicyAmount(item.cost, 0);
      } else if (field === "environment_actions") {
        if (item.policyId) params.policyId = item.policyId;
      } else if (field === "institution_changes") {
        params.officeName = item.officeName || item.name || item.institutionName || "";
        params.rank = item.rank || 5;
        params.duties = item.duties || item.description || "";
        if (item.region) params.region = item.region;
        if (item.staffSize != null) params.staffSize = _aiPolicyAmount(item.staffSize, 20);
        if (item.annualBudget != null) params.annualBudget = _aiPolicyAmount(item.annualBudget, 5e4);
        if (item.fundingSource) params.fundingSource = item.fundingSource;
      }
      return params;
    }
    function _aiStructuredPolicyExpectedType(field) {
      return {
        currency_adjustments: "currency_reform",
        population_adjustments: "huji_reform",
        central_local_actions: "central_local_finance",
        environment_actions: "environment_policy",
        institution_changes: "office_reform"
      }[field] || "";
    }
    function _aiInstitutionLifecycleAction(item) {
      var action = _aiPolicyText(item && (item.action || item.type || item.kind || "")).toLowerCase();
      if (/abolish|remove|retire|废|罢|裁|撤|裁撤|废止/.test(action)) return "abolish";
      if (/create|add|register|office|设|立|置|创|新/.test(action)) return "create";
      return "";
    }
    function _findAIInstitutionLifecycleTarget(item) {
      var G = global.GM || {};
      var list = _normalizeDynamicInstitutions(G);
      var id = _aiPolicyText(item && (item.id || item.instId || item.institutionId || item.officeId || ""));
      var name = _aiPolicyText(item && (item.officeName || item.name || item.institutionName || ""));
      if (id) {
        var byId = list.find(function(x) {
          return x && String(x.id || "") === id;
        });
        if (byId) return byId;
      }
      if (name) {
        return list.find(function(x) {
          return x && (String(x.name || "") === name || String(x.name || "").indexOf(name) >= 0 || name.indexOf(String(x.name || "")) >= 0);
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
      if (action === "create") {
        if (typeof parser.executeOfficeCreation === "function") {
          var parentDept = item.subordinateTo || item.parentDept || "";
          var declared = {
            action: "reform",
            reformDetail: "增设",
            dept: parentDept || params.officeName,
            newDept: parentDept ? params.officeName : "",
            deptId: item.deptId,
            deptPath: item.deptPath,
            positions: item.positions || [],
            newRank: params.rank,
            reason: params.duties || ""
          };
          var result = parser.executeOfficeCreation([declared], Object.assign({}, params, { createdBy: "ai-structured-policy" }));
          return Object.assign({ action: "create", name: params.officeName }, result || { ok: false, reason: "官制创建没有返回回执" });
        }
        if (typeof parser.registerDynamicInstitution !== "function") return null;
        var spec = {
          name: params.officeName || item.name || item.institutionName || "新司",
          rank: params.rank || 5,
          duties: params.duties || item.description || "",
          region: params.region || item.region || "central",
          staffSize: params.staffSize || item.staffSize || 20,
          annualBudget: params.annualBudget || item.annualBudget || 5e4,
          fundingSource: params.fundingSource || item.fundingSource || "guoku.central",
          headOfficial: item.headOfficial || item.head || null,
          createdBy: "ai-structured-policy"
        };
        var created = parser.registerDynamicInstitution(spec);
        return created ? { ok: true, action: "create", instId: created.id, name: created.name, result: created } : { ok: false, action: "create", reason: "registerDynamicInstitution failed" };
      }
      if (action === "abolish") {
        if (typeof parser.abolishInstitution !== "function") return null;
        var target = _findAIInstitutionLifecycleTarget(item);
        if (!target) return { ok: false, action: "abolish", reason: "institution not found" };
        var abolished = parser.abolishInstitution(target.id);
        if (abolished && item.reason) abolished.abolishReason = item.reason;
        return abolished ? { ok: true, action: "abolish", instId: target.id, name: target.name, result: abolished } : { ok: false, action: "abolish", instId: target.id, reason: "abolishInstitution failed" };
      }
      return null;
    }
    function _applyAIStructuredPolicyActions(aiOutput, applied) {
      var G = global.GM;
      var parser = global.EdictParser;
      if (!G || !parser || typeof parser.tryExecute !== "function") return 0;
      var fields = ["currency_adjustments", "population_adjustments", "central_local_actions", "environment_actions", "institution_changes"];
      var count = 0;
      if (!Array.isArray(G._aiStructuredPolicyActions)) G._aiStructuredPolicyActions = [];
      fields.forEach(function(field) {
        var list = Array.isArray(aiOutput[field]) ? aiOutput[field] : [];
        list.forEach(function(item) {
          if (!item) return;
          var text = _aiStructuredPolicyText(field, item);
          if (!text) {
            applied.failed.push({ field, item, reason: "no structured policy text" });
            return;
          }
          var params = _aiStructuredPolicyParams(field, item);
          var meta = {
            source: "ai-structured-policy",
            field,
            expectedType: _aiStructuredPolicyExpectedType(field),
            raw: item
          };
          var lifecycle = null;
          var lifecycleAttempted = false;
          if (field === "institution_changes") {
            lifecycleAttempted = !!(parser && (typeof parser.registerDynamicInstitution === "function" || typeof parser.abolishInstitution === "function"));
          }
          var edictResult = null;
          var result = null;
          var ok = false;
          var action = field === "institution_changes" ? _aiInstitutionLifecycleAction(item) : "";
          if (!(field === "institution_changes" && (action === "abolish" || action === "create" && typeof parser.executeOfficeCreation === "function"))) {
            try {
              edictResult = parser.tryExecute(text, params, meta);
              ok = !!(edictResult && edictResult.ok !== false);
            } catch (e) {
              ok = false;
              edictResult = { ok: false, reason: e && e.message || String(e) };
            }
          }
          if (field === "institution_changes") {
            lifecycle = _applyAIInstitutionLifecycleChange(item, params);
            if (lifecycleAttempted) ok = !!(lifecycle && lifecycle.ok);
          }
          result = { ok, edict: edictResult, lifecycle, reason: lifecycle && lifecycle.reason || edictResult && edictResult.reason || "" };
          G._aiStructuredPolicyActions.push({
            turn: G.turn || 0,
            field,
            text,
            ok,
            result,
            lifecycle: lifecycle ? { action: lifecycle.action, instId: lifecycle.instId || "", name: lifecycle.name || "", ok: !!lifecycle.ok, reason: lifecycle.reason || "" } : null
          });
          if (ok) {
            count++;
            G._turnReport.push({ type: "aiPolicyAction", field, text, turn: G.turn || 0 });
          } else {
            applied.failed.push({ field, text, reason: result && (result.reason || result.pathway) || "execute failed" });
          }
        });
      });
      if (G._aiStructuredPolicyActions.length > 100) G._aiStructuredPolicyActions.splice(0, G._aiStructuredPolicyActions.length - 100);
      return count;
    }
    function applyAllegianceChange(G, charRef, newFacRef, opts) {
      opts = opts || {};
      if (!G || !Array.isArray(G.chars) || !Array.isArray(G.facs)) return { ok: false, reason: "no_game" };
      var ch = charRef && typeof charRef === "object" ? charRef : G.chars.find(function(c) {
        return c && (c.name === charRef || c.id === charRef);
      });
      if (!ch) return { ok: false, reason: "char_not_found:" + charRef };
      var nf = G.facs.find(function(f) {
        return f && (f.id === newFacRef || f.name === newFacRef);
      });
      if (!nf && typeof newFacRef === "string" && newFacRef.length >= 2) {
        var _cands = G.facs.filter(function(f) {
          return f && f.name && (f.name.indexOf(newFacRef) === 0 || newFacRef.indexOf(f.name) === 0 || f.name.indexOf(newFacRef) >= 0);
        });
        if (_cands.length === 1) nf = _cands[0];
      }
      var newName = nf ? nf.name : typeof newFacRef === "string" ? newFacRef : "";
      var newId = nf ? nf.id : "";
      if (!newName) return { ok: false, reason: "faction_unresolved:" + newFacRef };
      var oldName = ch.faction || ch.factionName || "";
      if (oldName === newName) return { ok: false, reason: "same_faction" };
      var _fm = typeof TM !== "undefined" && TM && TM.FactionMembership || typeof window !== "undefined" && window.TM && window.TM.FactionMembership || null;
      if (_fm && typeof _fm.assignChar === "function") {
        _fm.assignChar(ch, newName, { reason: opts.reason || "改换门庭" + (opts.type ? "·" + opts.type : ""), byTurn: G.turn });
      } else {
        ch.faction = newName;
        if (newId) ch.factionId = newId;
        else delete ch.factionId;
      }
      if ("factionName" in ch) ch.factionName = newName;
      var type = opts.type || "";
      ch.loyalty = type === "return" || type === "rescue" || type === "reinstate" ? 62 : type === "surrender" || type === "capture" || type === "coerced" ? 30 : 42;
      ch._allegianceHistory = Array.isArray(ch._allegianceHistory) ? ch._allegianceHistory : [];
      ch._allegianceHistory.push({ from: oldName, to: newName, turn: G.turn || 0, type, reason: opts.reason || "" });
      try {
        if (typeof addEB === "function") addEB("改换门庭", ch.name + "：" + (oldName || "无属") + " → " + newName + (opts.reason ? "（" + opts.reason + "）" : ""));
      } catch (_eb) {
      }
      try {
        if (G._turnReport) G._turnReport.push({ type: "allegiance", from: oldName, to: newName, char: ch.name, reason: opts.reason || "", turn: G.turn || 0 });
      } catch (_tr) {
      }
      return { ok: true, from: oldName, to: newName, char: ch.name };
    }
    function _captureValidatorBaseline(G) {
      return _modules.reconcile._captureValidatorBaseline.apply(this, arguments);
    }
    function _collectValidatorFailures(G, baseline) {
      return _modules.reconcile._collectValidatorFailures.apply(this, arguments);
    }
    function _runConsistencyValidator(applied, aiOutput, name, fn) {
      return _modules.reconcile._runConsistencyValidator.apply(this, arguments);
    }
    function _applyAITurnChangesUnsafe(aiOutput) {
      var G = global.GM;
      if (!G) return { ok: false };
      if (!aiOutput || typeof aiOutput !== "object") return { ok: false };
      var _validatorBaseline = _captureValidatorBaseline(G);
      var _deathNormalization = typeof global.normalizeAIWriteBackDeaths === "function" ? global.normalizeAIWriteBackDeaths(aiOutput, { source: "applyAITurnChanges" }) : { added: [], routed: [], failed: [], normalized: 0 };
      if (typeof preflightAIWriteBack === "function") preflightAIWriteBack(aiOutput, { source: "applyAITurnChanges" });
      if (!G._turnReport) G._turnReport = [];
      var applied = {
        changes: 0,
        appointments: 0,
        institutions: 0,
        regions: 0,
        events: 0,
        npcActions: 0,
        relations: 0,
        failed: [],
        // 保守版 validator 用·记录调用 applier 前的数组长度·用于"数量是否增加"判定
        _warsBefore: Array.isArray(G.activeWars) ? G.activeWars.length : 0,
        _revoltsBefore: G.minxin && Array.isArray(G.minxin.revolts) ? G.minxin.revolts.length : 0,
        _disastersBefore: Array.isArray(G.activeDisasters) ? G.activeDisasters.length : 0,
        // 激进版 validator 用
        _partiesBefore: Array.isArray(G.parties) ? G.parties.length : 0,
        _edictsBefore: Array.isArray(G.activeEdicts) ? G.activeEdicts.length : 0,
        _omensBefore: Array.isArray(G.omens) ? G.omens.length : (G.events || []).filter(function(e) {
          return e && (e.type === "omen" || e.category === "omen");
        }).length,
        _religionsBefore: Array.isArray(G.religions) ? G.religions.length : 0
      };
      if (typeof global.applyNormalizedAIWriteBackDeaths === "function") {
        global.applyNormalizedAIWriteBackDeaths(G, _deathNormalization, applied);
      }
      if (aiOutput.narrative) {
        G._turnReport.push({ type: "narrative", text: aiOutput.narrative, turn: G.turn || 0 });
      }
      (aiOutput.tax_reforms || aiOutput.taxReforms || []).forEach(function(tr) {
        try {
          if (!tr || !tr.op) return;
          var FE = global.FiscalEngine;
          if (!FE || typeof FE.applyPlayerTaxReform !== "function") {
            applied.failed.push({ taxReform: tr, reason: "no_fiscal_engine" });
            return;
          }
          var rr = FE.applyPlayerTaxReform(tr);
          if (rr && rr.ok) {
            applied.changes++;
            G._turnReport.push({ type: "tax_reform", change: rr.change, minxinDelta: rr.minxinDelta, reason: tr.reason || "", turn: G.turn || 0 });
          } else {
            applied.failed.push({ taxReform: tr, reason: rr && rr.reason || "reform_failed" });
          }
        } catch (e) {
          applied.failed.push({ taxReform: tr, reason: e && e.message || "exception" });
        }
      });
      if (typeof _applyDeclaredPathChanges === "function") {
        applied.changes += _applyDeclaredPathChanges(G, aiOutput.changes, G._turnReport, applied.failed);
      } else if (Array.isArray(aiOutput.changes) && aiOutput.changes.length) {
        applied.failed.push({ field: "changes", reason: "path dispatcher unavailable" });
      }
      (aiOutput.allegiance_changes || aiOutput.allegianceChanges || aiOutput.defections || []).forEach(function(a) {
        if (!a || typeof a !== "object") return;
        var charRef = a.character || a.char || a.name || a.who || a.subject;
        var newFac = a.newFaction || a.toFaction || a.to_faction || a.faction || a.to || a.newAllegiance;
        if (!charRef || !newFac) return;
        var _wgAl = _modules.validators;
        var r = _wgAl && _wgAl._gateAllegianceSource && _wgAl._gateAllegianceSource(G, aiOutput, charRef, newFac, a.reason || a.cause || "", applied) ? { ok: false, reason: "no-source-faction(write-gate)" } : applyAllegianceChange(G, charRef, newFac, { reason: a.reason || a.cause || "", type: a.type || a.kind || a.mode || "" });
        if (r.ok) {
          applied.changes++;
        } else applied.failed.push({ field: "allegiance_changes", text: charRef + " → " + newFac, reason: r.reason });
      });
      (aiOutput.appointments || []).forEach(function(a) {
        var r;
        if (a.action === "appoint") r = onAppointment(a.charName, a.position, a.binding);
        else if (a.action === "dismiss") r = onDismissal(a.charName, a.reason, aiOutput);
        else if (a.action === "transfer") r = onTransfer(a.charName, a.fromPosition, a.toPosition, a.binding);
        if (r && r.ok) {
          applied.appointments++;
          G._turnReport.push({ type: "appointment", action: a.action, charName: a.charName, position: a.position || a.toPosition, turn: G.turn || 0 });
        } else {
          applied.failed.push({ appointment: a, reason: r && r.reason });
        }
      });
      (aiOutput.institutions || []).forEach(function(i) {
        var r;
        if (i.action === "create") r = { ok: true, inst: registerInstitution(i) };
        else if (i.action === "abolish") r = abolishInstitution(i.id, i.reason);
        if (r && r.ok) {
          applied.institutions++;
          G._turnReport.push({ type: "institution", action: i.action, name: i.name || i.id, turn: G.turn || 0 });
        }
      });
      (aiOutput.regions || []).forEach(function(rg) {
        if (rg.action === "reclassify") {
          var r = reclassifyRegion(rg.id, rg.newType, rg.reason);
          if (r.ok) {
            applied.regions++;
            G._turnReport.push({ type: "region", action: "reclassify", id: rg.id, newType: rg.newType, turn: G.turn || 0 });
          }
        }
      });
      (aiOutput.localActions || []).forEach(function(la) {
        if (!la || !la.region || !la.type) return;
        var div = _findDivisionByNameOrId(G, la.region);
        if (!div) {
          applied.failed.push({ localAction: la, reason: "region not found" });
          return;
        }
        if (!div.fiscal) div.fiscal = {};
        if (!div.fiscal.expenditures) div.fiscal.expenditures = { fixed: [], discretionary: [], imperial: [], illicit: [], downstream: [] };
        var bucket = la.type === "illicit" ? "illicit" : "discretionary";
        div.fiscal.expenditures[bucket].push({
          type: la.type,
          amount: Math.max(0, Math.round(la.amount || 0)),
          reason: la.reason || "",
          proposer: la.proposer || div.governor || "某地方官",
          turn: G.turn || 0
        });
        var _localPaid = 0;
        if (div.publicTreasury && div.publicTreasury.money) {
          var cost = Math.max(0, Math.round(la.amount || 0));
          var _localBefore = Math.max(0, Number(div.publicTreasury.money.stock) || 0);
          _localPaid = Math.min(_localBefore, cost);
          div.publicTreasury.money.stock = _localBefore - _localPaid;
          var _localDeficit = cost - _localPaid;
          if (_localDeficit > 0) div.publicTreasury.money.deficit = (Number(div.publicTreasury.money.deficit) || 0) + _localDeficit;
        }
        if (la.type === "illicit" && div.governor) {
          var ch = G.chars ? G.chars.find(function(c) {
            return c.name === div.governor;
          }) : null;
          if (ch) {
            if (!ch.resources) ch.resources = {};
            if (!ch.resources.privateWealth) ch.resources.privateWealth = { money: 0, grain: 0, cloth: 0 };
            ch.resources.privateWealth.money = (ch.resources.privateWealth.money || 0) + Math.round(_localPaid * 0.6);
          }
        }
        if (global.addEB) global.addEB("地方", (div.name || la.region) + "·" + (div.governor || "地方官") + " " + ({ disaster_relief: "赈灾", public_works_water: "修水利", public_works_road: "修路", education: "兴学", granary_stockpile: "平籴备荒", military_prep: "备边", charity_local: "恤民", illicit: "中饱私囊", supernatural_disaster_relief: "禳灾" }[la.type] || la.type) + " " + (la.amount || 0) + (la.reason ? " (" + la.reason + ")" : ""));
        G._turnReport.push({ type: "localAction", region: la.region, actionType: la.type, amount: la.amount, reason: la.reason, turn: G.turn || 0 });
        if (la.type === "disaster_relief" || la.type === "granary_stockpile" || la.type === "charity_local") {
          var _wantGrain = Math.max(0, Math.round(Number(la.grainAmount) || 0));
          if (!_wantGrain && Number(la.amount) > 0) _wantGrain = Math.round(Number(la.amount) * 0.2);
          if (_wantGrain > 0) {
            var _gotGrain = 0;
            if (div.publicTreasury && div.publicTreasury.grain) {
              var _fromLocal = Math.min(_wantGrain, Number(div.publicTreasury.grain.stock) || 0);
              if (_fromLocal > 0) {
                div.publicTreasury.grain.stock -= _fromLocal;
                _gotGrain += _fromLocal;
              }
            }
            if (_gotGrain < _wantGrain && G.guoku) {
              var _central = Number(G.guoku.grain) || 0;
              var _fromCentral = Math.min(_wantGrain - _gotGrain, _central);
              if (_fromCentral > 0) {
                G.guoku.grain = _central - _fromCentral;
                _gotGrain += _fromCentral;
              }
            }
            if (_gotGrain > 0) {
              var _gleaves = [];
              (function _wl(_n) {
                if (!_n) return;
                var _ks = _n.divisions || _n.children;
                if (_ks && _ks.length) {
                  for (var _j = 0; _j < _ks.length; _j++) _wl(_ks[_j]);
                } else _gleaves.push(_n);
              })(div);
              if (!_gleaves.length) _gleaves = [div];
              var _needs = _gleaves.map(function(_l) {
                var _rid = String(_l.id || _l.name || "");
                var _rg = G.renli && G.renli.byRegion ? G.renli.byRegion[_rid] || (_l.name ? G.renli.byRegion[_l.name] : null) : null;
                return _rg ? Math.max(0, (Number(_rg.foodNeed) || 0) - (Number(_rg.grainOutput) || 0)) : 0;
              });
              var _totNeed = _needs.reduce(function(_a, _b) {
                return _a + _b;
              }, 0);
              _gleaves.forEach(function(_l, _i) {
                var _share = _totNeed > 0 ? _needs[_i] / _totNeed : 1 / _gleaves.length;
                _l._grainInflowThisTurn = (Number(_l._grainInflowThisTurn) || 0) + _gotGrain * _share;
              });
              if (global.addEB) global.addEB("地方", (div.name || la.region) + " 调粮赈济 " + Math.round(_gotGrain) + " 石（救荒入缺粮地）");
            }
          }
        }
        var _laTypeLbl = {
          disaster_relief: "赈灾",
          public_works_water: "修水利",
          public_works_road: "修路",
          education: "兴学",
          granary_stockpile: "平籴备荒",
          military_prep: "备边",
          charity_local: "恤民",
          illicit: "中饱私囊",
          supernatural_disaster_relief: "禳灾"
        }[la.type] || la.type;
        var _laGov = la.proposer || div.governor || "地方官";
        var _isIllicit = la.type === "illicit";
        if (global.PhaseD && global.PhaseD.addFengwen) {
          try {
            global.PhaseD.addFengwen({
              type: _isIllicit ? "告状" : "耳报",
              text: (div.name || la.region) + "·" + _laGov + " " + _laTypeLbl + (la.amount ? " " + la.amount + "贯" : "") + (la.reason ? "（" + la.reason.slice(0, 40) + "）" : "") + (_isIllicit ? "【疑有侵贪】" : ""),
              credibility: _isIllicit ? 0.4 : 0.8,
              source: "localAction",
              actors: [_laGov],
              region: la.region,
              actionType: la.type,
              turn: G.turn || 0
            });
          } catch (e) {
            try {
              window.TM && TM.errors && TM.errors.captureSilent(e, "tm-ai-change-applier");
            } catch (_) {
            }
          }
        }
        if (global.NpcMemorySystem && _laGov && _laGov !== "地方官") {
          var _emo = _isIllicit ? "愧" : la.type === "disaster_relief" || la.type === "charity_local" ? "喜" : "平";
          var _wt = _isIllicit ? 6 : 3;
          try {
            global.NpcMemorySystem.remember(_laGov, "我在 " + (div.name || la.region) + " 行 " + _laTypeLbl + "（" + (la.amount || 0) + "）——" + (la.reason || "").slice(0, 30), _emo, _wt);
          } catch (e) {
            try {
              window.TM && TM.errors && TM.errors.captureSilent(e, "tm-ai-change-applier");
            } catch (_) {
            }
          }
        }
        try {
          var _govCh = (global.GM.chars || []).find(function(c) {
            return c.name === _laGov;
          });
          if (_govCh && global.CharEconEngine) {
            var _fameDelta = {
              disaster_relief: 4,
              public_works_water: 2,
              public_works_road: 1,
              education: 2,
              granary_stockpile: 1,
              military_prep: 1,
              charity_local: 3,
              supernatural_disaster_relief: 1,
              illicit: -6
            }[la.type] || 0;
            var _virDelta = {
              disaster_relief: 6,
              public_works_water: 3,
              public_works_road: 2,
              education: 4,
              granary_stockpile: 2,
              military_prep: 1,
              charity_local: 4,
              supernatural_disaster_relief: 1,
              illicit: -8
            }[la.type] || 0;
            if (_fameDelta) global.CharEconEngine.adjustFame(_govCh, _fameDelta, _laTypeLbl);
            if (_virDelta > 0 && global.TMPromotion) {
              var _gcap = global.TMPromotion.capability(_govCh, typeof getEffectiveAttr === "function" ? getEffectiveAttr : null);
              if (Math.random() < Math.min(0.95, 0.3 + _gcap / 100 * 0.6)) global.CharEconEngine.adjustVirtueMerit(_govCh, Math.round(_virDelta * global.TMPromotion.SCALE * (0.6 + _gcap / 100 * 0.6)), _laTypeLbl);
              else global.CharEconEngine.adjustVirtueMerit(_govCh, global.TMPromotion.failureDelta("task_botched"), _laTypeLbl + " 办砸");
            } else if (_virDelta > 0) {
              global.CharEconEngine.adjustVirtueMerit(_govCh, _virDelta, _laTypeLbl);
            }
          }
        } catch (_lafve) {
          if (window.TM && TM.errors) TM.errors.capture(_lafve, "applier.localActions.fame");
        }
      });
      (aiOutput.events || []).forEach(function(e) {
        var _c4b = _modules.validators;
        if (_c4b && _c4b._gateEventTimepoint && _c4b._gateEventTimepoint(G, e, applied)) return;
        if (e && e.critical && Array.isArray(e.choices) && e.choices.length && typeof global._eventAdjudicationOn === "function" && global._eventAdjudicationOn()) {
          try {
            var _G2 = global.GM;
            if (_G2) {
              if (!Array.isArray(_G2.currentIssues)) _G2.currentIssues = [];
              var _iid = "aiev_" + (e.id || (_G2.turn || 0) + "_" + _G2.currentIssues.length);
              if (!_G2.currentIssues.some(function(i) {
                return i && i.id === _iid;
              })) {
                _G2.currentIssues.push({
                  id: _iid,
                  title: e.title || e.category || "时局要务",
                  description: e.text || "",
                  category: e.category || "要务",
                  status: "pending",
                  raisedTurn: _G2.turn || 1,
                  raisedDate: _G2._gameDate || "",
                  choices: e.choices.map(function(c) {
                    return { text: c.text || "应对", desc: c.desc || "", aiHint: c.aiHint || "", effect: c.effect || null };
                  })
                });
                if (global.addEB) global.addEB(e.category || "要务", "临御案：" + (e.title || e.text || ""), { credibility: e.credibility || "medium" });
                applied.events++;
                return;
              }
            }
          } catch (_seqE) {
          }
        }
        if (global.addEB) global.addEB(e.category || "事", e.text || "", { credibility: e.credibility || "medium" });
        applied.events++;
        G._turnReport.push({ type: "event", category: e.category, text: e.text, turn: G.turn || 0 });
      });
      (aiOutput.relations || []).forEach(function(r) {
        if (typeof global.applyNpcInteraction === "function" && r.actor && r.target && r.type) {
          global.applyNpcInteraction(r.actor, r.target, r.type, r.extra);
          applied.relations++;
          G._turnReport.push({ type: "relation", actor: r.actor, target: r.target, interaction: r.type, turn: G.turn || 0 });
        }
      });
      if (!applied.semantic) applied.semantic = {};
      var aiPolicyActionCount = _applyAIStructuredPolicyActions(aiOutput, applied);
      if (aiPolicyActionCount > 0) applied.semantic.ai_policy_actions = aiPolicyActionCount;
      var militaryChangeCount = 0;
      if (Array.isArray(aiOutput.military_changes)) {
        militaryChangeCount += _applyAIArmyChangeList(aiOutput.military_changes, "military_changes", { failed: applied.failed });
      }
      if (Array.isArray(aiOutput.army_changes)) {
        militaryChangeCount += _applyAIArmyChangeList(aiOutput.army_changes, "army_changes", { failed: applied.failed });
      }
      if (militaryChangeCount > 0) applied.semantic.military_changes = militaryChangeCount;
      var procureCount = 0;
      if (Array.isArray(aiOutput.armory_procurement)) {
        var AR_proc = typeof window !== "undefined" && window.TMArmory || typeof global !== "undefined" && global.TMArmory;
        if (AR_proc && typeof AR_proc.procure === "function") {
          aiOutput.armory_procurement.forEach(function(p) {
            if (!p || !p.category) return;
            try {
              var r = AR_proc.procure(G, p.category, p.quantity != null ? p.quantity : p.amount, { unitPrice: p.unitPrice });
              if (r && r.realQty > 0) {
                procureCount++;
                if (typeof addEB === "function") addEB("军备", "采买" + p.category + r.realQty + "·费银" + r.cost + (p.channel ? "·" + p.channel : "") + (r.afford < 1 ? "（国库不继·减采）" : ""));
                if (G._turnReport) G._turnReport.push({ type: "military", field: "armory_procurement", category: p.category, qty: r.realQty, cost: r.cost, channel: p.channel || "", reason: p.reason || "采买", turn: G.turn || 0 });
              }
            } catch (_pe) {
            }
          });
        }
      }
      if (procureCount > 0) applied.semantic.armory_procurement = procureCount;
      var armyCommanderFallbackCount = _applyNarrativeArmyCommanderFallback(G, aiOutput);
      if (armyCommanderFallbackCount > 0) applied.semantic.army_commander_fallback = armyCommanderFallbackCount;
      var armyFieldFallbackCount = _applyNarrativeArmyFieldFallback(G, aiOutput);
      if (armyFieldFallbackCount > 0) applied.semantic.army_field_fallback = armyFieldFallbackCount;
      var charUpdCount = 0;
      (aiOutput.char_updates || []).forEach(function(cu) {
        if (!cu || !cu.name) return;
        var ch = _findEntity2(G, "char", cu.name);
        if (!ch) {
          applied.failed.push({ char_update: cu, reason: "char not found" });
          return;
        }
        if (cu.updates) charUpdCount += _mergeUpdatesToEntity(ch, cu.updates, "char_update", ch.name, cu.reason || "", applied.failed, aiOutput);
        if (cu.careerEvent) {
          if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
          ch.careerHistory.push(Object.assign({ turn: G.turn || 0, date: typeof getTSText === "function" ? getTSText(G.turn) : "T" + (G.turn || 0) }, cu.careerEvent));
          charUpdCount++;
          G._turnReport.push({ type: "career", char: ch.name, event: cu.careerEvent.summary || cu.careerEvent.title, turn: G.turn || 0 });
        }
        if (cu.travelTo && cu.travelTo.toLocation) {
          if (ch._travelTo && _sameTravelLocation(ch._travelTo, cu.travelTo.toLocation)) {
            if (typeof global.addEB === "function") {
              global.addEB("人事", ch.name + " 复诏催程赴 " + ch._travelTo + "（已在路·留剩 " + (typeof ch._travelRemainingDays === "number" ? ch._travelRemainingDays + " 日" : "未抵") + "）");
            }
            return;
          }
          if (ch.location && _sameTravelLocation(ch.location, cu.travelTo.toLocation)) {
            _syncCharacterLocationMirrors(G, ch, { location: ch.location }, [
              "_travelTo",
              "_travelFrom",
              "_travelStartTurn",
              "_travelRemainingDays",
              "_travelArrival",
              "_travelReason",
              "_travelAssignPost"
            ]);
            return;
          }
          var days = cu.travelTo.estimatedDays || _estimateTravelDays(ch.location, cu.travelTo.toLocation);
          ch._travelTo = cu.travelTo.toLocation;
          ch._travelFrom = ch.location || "";
          ch._travelStartTurn = G.turn || 0;
          ch._travelRemainingDays = days;
          ch._travelReason = cu.travelTo.reason || "";
          ch._travelAssignPost = cu.travelTo.assignPost || "";
          _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
          charUpdCount++;
          G._turnReport.push({ type: "travel", char: ch.name, from: ch._travelFrom, to: ch._travelTo, days, reason: ch._travelReason, turn: G.turn || 0 });
          if (typeof global.addEB === "function") global.addEB("人事", ch.name + " 赴 " + ch._travelTo + "（预计 " + days + " 日）");
          if (G.qijuHistory) {
            var _dt0 = typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0);
            G.qijuHistory.unshift({
              turn: G.turn || 0,
              date: _dt0,
              content: "【启程】" + ch.name + " 自" + (ch._travelFrom || "本处") + " 赴 " + ch._travelTo + "，预计 " + days + " 日抵达" + (ch._travelReason ? "。缘由：" + ch._travelReason : "") + "。"
            });
          }
          if (!Array.isArray(G._chronicle)) G._chronicle = [];
          G._chronicle.unshift({
            turn: G.turn || 0,
            date: typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0),
            type: "启程",
            title: ch.name + " 赴 " + ch._travelTo,
            content: ch.name + " 自" + (ch._travelFrom || "本处") + " 启程赴 " + ch._travelTo + "·预计 " + days + " 日抵达" + (ch._travelReason ? "·" + ch._travelReason : "") + "。",
            category: "人事",
            tags: ["人事", "启程", ch.name]
          });
        }
      });
      if (charUpdCount > 0) applied.semantic.char_updates = charUpdCount;
      var officeCount = 0;
      (aiOutput.office_assignments || []).forEach(function(oa) {
        if (!oa || !oa.name) return;
        var ch = _findEntity2(G, "char", oa.name);
        if (!ch) {
          applied.failed.push({ office_assignment: oa, reason: "char not found" });
          return;
        }
        var rawAction = String(oa.action || "appoint");
        var action = rawAction.toLowerCase();
        var isConcurrentOffice = typeof global._offIsConcurrentAppointment === "function" ? global._offIsConcurrentAppointment(Object.assign({}, oa, { action: rawAction }), oa.post || "") : /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(rawAction + " " + (oa.reason || ""));
        if (/兼/.test(rawAction)) action = "appoint";
        if (action === "concurrent") {
          action = "appoint";
          isConcurrentOffice = true;
        }
        var needTravel = oa.toLocation && ch.location && !_sameTravelLocation(oa.toLocation, ch.location);
        if (needTravel && (action === "appoint" || action === "transfer")) {
          if (ch._travelTo && _sameTravelLocation(ch._travelTo, oa.toLocation)) {
            if (typeof global.addEB === "function") {
              global.addEB("任命", ch.name + " 复诏催赴 " + ch._travelTo + " 任 " + (oa.post || "") + "（已在路·留剩 " + (typeof ch._travelRemainingDays === "number" ? ch._travelRemainingDays + " 日" : "未抵") + "）");
            }
            if (oa.post && !ch._travelAssignPost) {
              ch._travelAssignPost = (oa.dept ? oa.dept + "/" : "") + oa.post;
              ch._travelAssignConcurrent = !!isConcurrentOffice;
              _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
            }
            return;
          }
          var days = oa.estimatedDays || _estimateTravelDays(ch.location, oa.toLocation);
          ch._travelTo = oa.toLocation;
          ch._travelFrom = ch.location;
          ch._travelStartTurn = G.turn || 0;
          ch._travelRemainingDays = days;
          ch._travelReason = (oa.reason || "") + "·赴任";
          ch._travelAssignPost = (oa.dept ? oa.dept + "/" : "") + (oa.post || "");
          ch._travelAssignConcurrent = !!isConcurrentOffice;
          _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
          G._turnReport.push({ type: "travel", char: ch.name, from: ch._travelFrom, to: ch._travelTo, days, reason: ch._travelReason, turn: G.turn || 0 });
          if (typeof global.addEB === "function") global.addEB("任命", ch.name + " 赴 " + oa.toLocation + " 任 " + (oa.post || "") + "（预计 " + days + " 日到任）");
          if (G.qijuHistory) {
            var _dt1 = typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0);
            G.qijuHistory.unshift({
              turn: G.turn || 0,
              date: _dt1,
              content: "【赴任】" + ch.name + " 自" + (ch._travelFrom || "本处") + " 赴 " + oa.toLocation + "，待到即就 " + (oa.post || "") + "之任，预计 " + days + " 日。"
            });
          }
          if (!Array.isArray(G._chronicle)) G._chronicle = [];
          G._chronicle.unshift({
            turn: G.turn || 0,
            date: typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0),
            type: "赴任启程",
            title: ch.name + " 赴 " + oa.toLocation,
            content: ch.name + " 自" + (ch._travelFrom || "本处") + " 启程赴 " + oa.toLocation + "·待到即就 " + (oa.post || "") + "之任·预计 " + days + " 日。",
            category: "人事",
            tags: ["人事", "赴任", "启程", ch.name]
          });
        } else {
          var r = null;
          var posList = [oa.post];
          if (typeof oa.post === "string" && /[、,·\s]/.test(oa.post)) {
            posList = oa.post.split(/[、,·\s]+/).filter(function(s) {
              return s && s.trim();
            });
          }
          posList.forEach(function(singlePost, idx) {
            var rr;
            if (action === "appoint") rr = onAppointment(oa.name, singlePost, { dept: oa.dept, concurrent: isConcurrentOffice, reason: oa.reason || "" });
            else if (action === "dismiss") rr = onDismissal(oa.name, oa.reason, aiOutput);
            else if (action === "transfer") rr = onTransfer(oa.name, oa.fromPost, singlePost, { dept: oa.dept });
            if (rr && rr.ok) {
              if (idx === 0) r = rr;
              officeCount++;
              G._turnReport.push({ type: "appointment", action, charName: oa.name, position: singlePost, turn: G.turn || 0 });
              if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
              ch.careerHistory.push({
                turn: G.turn || 0,
                date: typeof getTSText === "function" ? getTSText(G.turn) : "T" + (G.turn || 0),
                title: singlePost,
                dept: oa.dept,
                action,
                reason: oa.reason || ""
              });
            }
          });
        }
        officeCount++;
      });
      if (officeCount > 0) applied.semantic.office_assignments = officeCount;
      var handledNames = {};
      (aiOutput.office_assignments || []).forEach(function(oa) {
        if (oa && oa.name) handledNames[oa.name] = true;
      });
      var personnelFromPcCount = 0;
      (aiOutput.personnel_changes || []).forEach(function(pc) {
        if (!pc || !pc.name) return;
        if (handledNames[pc.name]) return;
        var changeText = String(pc.change || "").trim();
        if (!changeText) return;
        var action = null, post = "", reason = pc.reason || changeText;
        var isConcurrentPersonnel = typeof global._offIsConcurrentAppointment === "function" ? global._offIsConcurrentAppointment({ reason, raw: changeText }, changeText) : /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(changeText);
        if (/\u4E0B\u72F1|\u5165\u72F1|\u7CFB\u72F1|\u6349\u62FF|\u902E\u6355|\u6293\u6355|\u7F09\u62FF/.test(changeText)) {
          action = "dismiss";
          reason = changeText;
        } else if (/\u62C4\u5BB6|\u62C4\u6CA1|\u7C4D\u6CA1|\u67E5\u62C4|\u6CA1\u5B98/.test(changeText)) {
          action = "dismiss";
          reason = changeText;
        } else if (/\u6D41\u653E|\u53D1\u914D|\u620D\u8FB9/.test(changeText)) {
          action = "dismiss";
          reason = changeText;
        } else if (/(\u514D\u804C|\u7F62\u5B98|\u7F62\u514D|\u7F62|\u514D|\u8D2C|\u9EDC|\u81F4\u4ED5|\u9000\u4F11|\u9A7B)/.test(changeText)) {
          action = "dismiss";
        } else if (/(\u65A9|\u8BDB|\u66B4\u6BD9|\u8D50\u6B7B|\u6B3B|\u8BDB\u6740|\u8BDB\u4E5D\u65CF|\u62C4\u5BB6)/.test(changeText)) {
          action = "dismiss";
          reason = "execute";
        } else {
          var m;
          if (m = changeText.match(/(?:\u547D|\u4EE4|\u62DC|\u6388|\u6412|\u8FC1|\u8F6C|\u8FC1\u8F6C|\u8FDB|\u5347|\u4E3A|\u4EFB)\s*([^\s，,。.；;]+)/)) {
            post = m[1].replace(/^(\u4E3A|\u4EFB)/, "");
          }
          if (!post && pc.former && changeText.indexOf(pc.former) < 0) {
            post = changeText.replace(/^(?:\u4ECE|\u81EA)?.*(?:\u8FC1|\u6539|\u8F6C)\s*/, "").replace(/[\s，,。.；;].*$/, "");
          }
          if (post) action = "appoint";
        }
        if (!action) return;
        if (action === "dismiss") {
          var _c2b = _modules.validators;
          if (_c2b && _c2b._gateJudicialPersonnelChange && _c2b._gateJudicialPersonnelChange(G, aiOutput, pc, changeText, applied)) return;
        }
        var r = null;
        if (action === "appoint" && post) r = onAppointment(pc.name, post, { concurrent: isConcurrentPersonnel, reason });
        else if (action === "dismiss") r = onDismissal(pc.name, reason, aiOutput);
        if (r && r.ok) {
          personnelFromPcCount++;
          handledNames[pc.name] = true;
          if (action === "appoint") {
            var chP = _findEntity2(G, "char", pc.name);
            if (chP) {
              if (!Array.isArray(chP.careerHistory)) chP.careerHistory = [];
              chP.careerHistory.push({
                turn: G.turn || 0,
                date: typeof getTSText === "function" ? getTSText(G.turn) : "T" + (G.turn || 0),
                title: post,
                action: "appoint",
                reason: pc.reason || changeText,
                source: "personnel_changes"
                // 标记来源·便于调试
              });
            }
            G._turnReport.push({ type: "appointment", action: "appoint", charName: pc.name, position: post, source: "pc_fallback", turn: G.turn || 0 });
          } else {
            G._turnReport.push({ type: "appointment", action: "dismiss", charName: pc.name, source: "pc_fallback", turn: G.turn || 0 });
          }
        } else {
          pc._applyFailed = true;
          if (applied && Array.isArray(applied.failed)) applied.failed.push({ personnel_change: { name: pc.name, change: pc.change }, reason: r && r.reason || "appoint/dismiss 未落地(目标对不上)" });
        }
      });
      if (personnelFromPcCount > 0) applied.semantic.personnel_changes_fallback = personnelFromPcCount;
      if (officeCount > 0 || personnelFromPcCount > 0) {
        try {
          if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
            if (!window._tmOfficeUiRefreshPending) {
              window._tmOfficeUiRefreshPending = true;
              window.setTimeout(function() {
                window._tmOfficeUiRefreshPending = false;
                try {
                  if (typeof window.renderOfficeTree === "function") window.renderOfficeTree();
                } catch (_) {
                }
                try {
                  if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.refresh === "function") window.TMPhase8FormalBridge.refresh();
                } catch (_) {
                }
              }, 0);
            }
          }
        } catch (_) {
        }
      }
      var fiscalCount = 0;
      var _transferPairSeen = {};
      (function _flagFiscalTransferPairs() {
        var list = aiOutput.fiscal_adjustments;
        if (!Array.isArray(list) || list.length < 2) return;
        function _normTarget(t) {
          var s = String(t == null ? "" : t).trim();
          if (/^(太仓|太仓库|国库|户部库|外库|公帑|公库|guoku|taicang|taicangku)$/i.test(s)) return "guoku";
          if (/^(内帑|内库|内承运库|私帑|帝室库|御库|neitang|neicang)$/i.test(s)) return "neitang";
          if (/^(province|省|布政使司)\s*[:：]/i.test(s)) return "province:" + s.replace(/^(province|省|布政使司)\s*[:：]\s*/i, "");
          if (s === "guoku" || s === "neitang" || /^province:/.test(s)) return s;
          return "";
        }
        function _normKind(k) {
          var s = String(k == null ? "" : k).trim();
          if (/^(income|收入|进项|增收|入项)$/i.test(s)) return "income";
          if (/^(expense|expenditure|支出|开支|耗费|拨支|出项)$/i.test(s)) return "expense";
          return s === "income" || s === "expense" ? s : "";
        }
        function _norm(fa) {
          if (!fa) return null;
          var act = String(fa.action || fa.op || "add").toLowerCase();
          if (act === "modify" || act === "set") act = "update";
          if (act === "delete" || act === "disable" || act === "cancel") act = "stop";
          if (act !== "add" && act !== "update" && act !== "stop" && act !== "remove") act = "add";
          if (act !== "add") return null;
          var res = fa.resource === "grain" || fa.resource === "cloth" ? fa.resource : "money";
          if (res !== "money") return null;
          var tgt = _normTarget(fa.target);
          if (!tgt) return null;
          var kind = _normKind(fa.kind);
          if (!kind) return null;
          var amt = Math.abs(parseFloat(fa.amount) || 0);
          if (!(amt > 0)) return null;
          return { fa, target: tgt, kind, amount: amt, label: String((fa.name || "") + " " + (fa.category || "") + " " + (fa.reason || "")) };
        }
        function _clean(s) {
          return String(s || "").replace(/[\s　]+/g, "").replace(/[，。、；：·「」『』()（）\-—_./]/g, "");
        }
        function _sameSource(a, b) {
          var x = _clean(a), y = _clean(b);
          if (x.length < 2 || y.length < 2) return false;
          if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return true;
          function _bg(s) {
            var m = {};
            for (var i2 = 0; i2 < s.length - 1; i2++) m[s.substr(i2, 2)] = 1;
            return m;
          }
          var bx = _bg(x), by = _bg(y), inter = 0, uni = {};
          Object.keys(bx).forEach(function(k) {
            uni[k] = 1;
            if (by[k]) inter++;
          });
          Object.keys(by).forEach(function(k) {
            uni[k] = 1;
          });
          var u = Object.keys(uni).length;
          return u > 0 && inter / u >= 0.5;
        }
        var norms = list.map(_norm), paired = {};
        for (var i = 0; i < norms.length; i++) {
          var A = norms[i];
          if (!A || paired[i]) continue;
          for (var j = i + 1; j < norms.length; j++) {
            var B = norms[j];
            if (!B || paired[j]) continue;
            if (A.kind === B.kind) continue;
            if (A.target === B.target) continue;
            var hi = Math.max(A.amount, B.amount), lo = Math.min(A.amount, B.amount);
            if (hi - lo > Math.max(1, lo * 0.01)) continue;
            if (!_sameSource(A.label, B.label)) continue;
            var pid = "tpair_" + (G.turn || 0) + "_" + i + "_" + j;
            A.fa._transferPairSuspect = true;
            A.fa._transferPairId = pid;
            A.fa._transferPairWith = B.target + "/" + B.kind;
            B.fa._transferPairSuspect = true;
            B.fa._transferPairId = pid;
            B.fa._transferPairWith = A.target + "/" + A.kind;
            paired[i] = true;
            paired[j] = true;
            break;
          }
        }
      })();
      (aiOutput.fiscal_adjustments || []).forEach(function(fa) {
        if (!fa) return;
        if (fa.target != null) {
          var _ft = String(fa.target).trim();
          if (/^(太仓|太仓库|国库|户部库|外库|公帑|公库|guoku|taicang|taicangku)$/i.test(_ft)) fa.target = "guoku";
          else if (/^(内帑|内库|内承运库|私帑|帝室库|御库|neitang|neicang)$/i.test(_ft)) fa.target = "neitang";
          else if (/^(province|省|布政使司)\s*[:：]/i.test(_ft)) fa.target = "province:" + _ft.replace(/^(province|省|布政使司)\s*[:：]\s*/i, "");
        }
        if (fa.kind != null) {
          var _fk = String(fa.kind).trim();
          if (/^(income|收入|进项|增收|入项)$/i.test(_fk)) fa.kind = "income";
          else if (/^(expense|expenditure|支出|开支|耗费|拨支|出项)$/i.test(_fk)) fa.kind = "expense";
        }
        if (!fa.target || !fa.kind) return;
        var action = String(fa.action || fa.op || "add").toLowerCase();
        if (action === "modify") action = "update";
        if (action === "set") action = "update";
        if (action === "delete" || action === "disable" || action === "cancel") action = "stop";
        if (action !== "add" && action !== "update" && action !== "stop" && action !== "remove") action = "add";
        var amount = Math.abs(parseFloat(fa.amount) || 0);
        if (action === "add" && amount <= 0) return;
        amount = _applyTaxAuthorityGate(G, fa, amount);
        var resource = fa.resource === "grain" || fa.resource === "cloth" ? fa.resource : "money";
        if (action === "add") {
          var _cutLabel = String((fa.name || "") + " " + (fa.category || "") + " " + (fa.reason || ""));
          if (/(裁减|裁革|削减|核减|减省|节省|省减|俭省|裁汰|缩减|撙节)/.test(_cutLabel) && /(用度|开支|支出|费用|经费|浮费|冗费|宫费|糜费|靡费)/.test(_cutLabel)) {
            if (applied && Array.isArray(applied.failed)) applied.failed.push({ fiscal_adjustment: { target: fa.target, kind: fa.kind, name: fa.name || fa.category, amount }, reason: "裁减用度类旨意不产生银两调拨·语义守卫拦截(应降常例支出)" });
            G._turnReport.push({ type: "fiscal_adj_rejected", action, target: fa.target, kind: fa.kind, resource, name: fa.name || fa.category || "", amount: 0, requested: amount, recurring: !!fa.recurring, executionStatus: "rejected_semantic", reason: "裁减/节省用度为节流令·不动帑银·未入账", turn: G.turn || 0 });
            if (typeof global.addEB === "function") global.addEB("财政", (fa.target === "guoku" ? "帑廪" : fa.target === "neitang" ? "内帑" : fa.target) + "「" + (fa.name || "裁减用度") + "」系节流之令·不动帑银·未按 " + amount + " 计调拨");
            return;
          }
        }
        if (fa.recurring) {
          var _faText = String((fa.name || "") + " " + (fa.reason || "") + " " + (fa.category || ""));
          var _oneTimeRe = /赏|赐|犒|赉|恤|赈|振济|抚恤|抄没|抄家|籍没|罚没|没入|查抄|缴获|赔款|赔偿|报效|进献|捐输|搜括|一次|临时|特支|特拨|特赐|赎银|犒军|犒赏/;
          var _recurRe = /岁|年例|年额|月饷|月粮|月例|常额|常例|常税|经制|经常|盐课|盐引|榷|关税|商税|田赋|加派|皇庄|俸|禄|每年|每岁|逐年|年度/;
          if (_oneTimeRe.test(_faText) && !_recurRe.test(_faText)) {
            fa.recurring = false;
            fa._coercedOneTime = true;
          }
        }
        var entry = {
          id: "fa_" + (G.turn || 0) + "_" + Math.random().toString(36).slice(2, 6),
          name: fa.name || "",
          category: fa.category || "",
          resource,
          amount,
          reason: fa.reason || "",
          recurring: !!fa.recurring,
          _coercedOneTime: !!fa._coercedOneTime,
          _transferPairSuspect: !!fa._transferPairSuspect,
          // 刀②·两库转账对嫌疑标记(随条目持久化·可见于存档/奏报)
          addedTurn: G.turn || 0,
          stopAfterTurn: fa.stopAfterTurn || null,
          action
        };
        var target = null, containerKey = null, immediateTarget = null, fiscalStockTarget = null;
        if (fa.target === "guoku") {
          if (!G.guoku) G.guoku = {};
          if (!G.guoku.extraIncome) G.guoku.extraIncome = [];
          if (!G.guoku.extraExpense) G.guoku.extraExpense = [];
          target = G.guoku;
          containerKey = fa.kind === "income" ? "extraIncome" : "extraExpense";
          immediateTarget = G.guoku;
          fiscalStockTarget = G.guoku;
        } else if (fa.target === "neitang") {
          if (!G.neitang) G.neitang = {};
          if (!G.neitang.extraIncome) G.neitang.extraIncome = [];
          if (!G.neitang.extraExpense) G.neitang.extraExpense = [];
          target = G.neitang;
          containerKey = fa.kind === "income" ? "extraIncome" : "extraExpense";
          immediateTarget = G.neitang;
          fiscalStockTarget = G.neitang;
        } else if (/^province:/.test(fa.target)) {
          var provName = fa.target.replace(/^province:/, "");
          var div = _findDivisionByNameOrId(G, provName);
          if (div) {
            if (!div.extraFiscal) div.extraFiscal = { income: [], expense: [] };
            target = div.extraFiscal;
            containerKey = fa.kind === "income" ? "income" : "expense";
            immediateTarget = div;
            fiscalStockTarget = _ensurePublicTreasuryResource(div, resource);
          } else {
            if (applied && Array.isArray(applied.failed)) applied.failed.push({ fiscal_adjustment: { target: fa.target, kind: fa.kind, name: fa.name || fa.category }, reason: "province 未找到·财政未落地: " + provName });
          }
        }
        if (amount > 0 && target && resource === "money" && (fa.target === "guoku" || fa.target === "neitang")) {
          var _mFlow = Math.max(Number(target.monthlyIncome) || 0, Number(target.monthlyExpense) || 0) * 12;
          var _amtCap = Math.max(_mFlow * 3, 1e6);
          if (_mFlow > 0 && amount > _amtCap) {
            var _rawAmt = amount;
            amount = Math.round(_amtCap);
            entry.amount = amount;
            entry._clampedFrom = _rawAmt;
            entry.reason = (entry.reason ? entry.reason + "·" : "") + "原报 " + _rawAmt + " 超账户年流水三倍·压至 " + amount;
            if (typeof global.addEB === "function") global.addEB("财政⚠", (fa.target === "guoku" ? "帑廪" : "内帑") + "「" + (entry.name || "") + "」报额 " + _rawAmt + " 显异常·压至 " + amount);
          }
        }
        if (target && containerKey && action !== "add") {
          var list = target[containerKey] || [];
          var lookup = String(fa.id || fa.name || fa.category || "").trim().toLowerCase();
          var existing = lookup ? list.find(function(item) {
            return item && (String(item.id || "").toLowerCase() === lookup || String(item.name || "").toLowerCase() === lookup || String(item.category || "").toLowerCase() === lookup);
          }) : null;
          if (existing) {
            if (action === "stop" || action === "remove") {
              existing.recurring = false;
              existing.stopAfterTurn = G.turn || 0;
              existing.stoppedTurn = G.turn || 0;
              existing.executionStatus = action === "remove" ? "removed" : "stopped";
              existing.stopReason = fa.reason || existing.stopReason || existing.reason || "";
              fiscalCount++;
              G._turnReport.push({ type: "fiscal_adj", action, target: fa.target, kind: fa.kind, resource: existing.resource || resource, name: existing.name, amount: 0, requested: 0, annualAmount: Number(existing.amount) || 0, recurring: false, shortfall: 0, executionStatus: existing.executionStatus, reason: existing.stopReason, turn: G.turn || 0 });
              if (typeof global.addEB === "function") global.addEB("财政", (fa.target === "guoku" ? "帑廪" : fa.target === "neitang" ? "内帑" : fa.target) + "停用年例「" + (existing.name || fa.name || "") + "」");
              return;
            }
            if (amount > 0) existing.amount = amount;
            existing.resource = resource;
            existing.recurring = fa.recurring !== void 0 ? !!fa.recurring : existing.recurring;
            if (fa.stopAfterTurn !== void 0) existing.stopAfterTurn = fa.stopAfterTurn;
            if (fa.category !== void 0) existing.category = fa.category || existing.category || "";
            if (fa.reason) existing.reason = fa.reason;
            if (existing.recurring) existing.lastSettledTurn = G.turn || 0;
            existing.updatedTurn = G.turn || 0;
            existing.executionStatus = "updated";
            fiscalCount++;
            G._turnReport.push({ type: "fiscal_adj", action, target: fa.target, kind: fa.kind, resource, name: existing.name || fa.name, amount: 0, requested: amount, annualAmount: existing.recurring ? Number(existing.amount) || amount : 0, recurring: !!existing.recurring, shortfall: 0, executionStatus: "updated", reason: fa.reason || existing.reason || "", turn: G.turn || 0 });
            if (typeof global.addEB === "function") global.addEB("财政", (fa.target === "guoku" ? "帑廪" : fa.target === "neitang" ? "内帑" : fa.target) + "改定年例「" + (existing.name || fa.name || "") + "」");
            return;
          }
          if (action === "stop" || action === "remove") return;
          if (amount <= 0) return;
          action = "add";
          entry.action = "add";
        }
        if (target && containerKey) {
          target[containerKey].push(entry);
          fiscalCount++;
          if (fa._transferPairSuspect && !_transferPairSeen[fa._transferPairId]) {
            _transferPairSeen[fa._transferPairId] = true;
            if (applied && applied.semantic) applied.semantic.fiscal_transfer_pair_suspects = (applied.semantic.fiscal_transfer_pair_suspects || 0) + 1;
            if (typeof global.addEB === "function") global.addEB("财政❗", "疑似两库转账对·" + (fa.target === "guoku" ? "帑廪" : fa.target === "neitang" ? "内帑" : fa.target) + (fa.kind === "income" ? "入" : "出") + amount + "两「" + (entry.name || "") + "」与 " + (fa._transferPairWith || "") + " 同额·事由同源·两笔照落待核(防单边节流/增支误记成两库搬家)");
          }
          var actualApplied = amount;
          var shortfall = 0;
          var executionStatus = "completed";
          if (entry.recurring) {
            actualApplied = 0;
            shortfall = 0;
            executionStatus = "scheduled";
          } else if (immediateTarget) {
            var stockTarget = fiscalStockTarget || immediateTarget;
            var cur = _readFiscalStock(stockTarget, resource);
            if (fa.kind === "expense") {
              if (cur <= 0) {
                actualApplied = 0;
                shortfall = amount;
                executionStatus = "blocked";
              } else if (cur < amount) {
                actualApplied = cur;
                shortfall = amount - cur;
                executionStatus = "partial";
                _writeFiscalStock(stockTarget, resource, 0);
              } else {
                actualApplied = amount;
                shortfall = 0;
                executionStatus = "completed";
                _writeFiscalStock(stockTarget, resource, cur - amount);
              }
            } else {
              _writeFiscalStock(stockTarget, resource, cur + amount);
            }
            if ((immediateTarget === G.guoku || immediateTarget === G.neitang) && resource === "money") immediateTarget.balance = immediateTarget.money;
          }
          if (entry.recurring) entry.lastSettledTurn = G.turn || 0;
          entry.applied = actualApplied;
          entry.shortfall = shortfall;
          entry.executionStatus = executionStatus;
          G._turnReport.push({ type: "fiscal_adj", action, target: fa.target, kind: fa.kind, resource, name: entry.name, amount: actualApplied, requested: amount, annualAmount: entry.recurring ? amount : 0, recurring: !!entry.recurring, coercedOneTime: !!entry._coercedOneTime, transferPairSuspect: !!fa._transferPairSuspect, shortfall, executionStatus, reason: entry.reason, turn: G.turn || 0 });
          if (shortfall > 0) {
            if (!G._fiscalShortfalls) G._fiscalShortfalls = [];
            G._fiscalShortfalls.push({
              turn: G.turn || 0,
              target: fa.target,
              resource,
              name: entry.name,
              reason: entry.reason,
              requested: amount,
              applied: actualApplied,
              shortfall,
              executionStatus,
              resolved: false
            });
          }
          var _resLbl = resource === "grain" ? "粮" : resource === "cloth" ? "布" : "银";
          var _tgtLbl = fa.target === "guoku" ? "帑廪" : fa.target === "neitang" ? "内帑" : fa.target;
          if (typeof global.addEB === "function") {
            if (executionStatus === "blocked") {
              global.addEB("财政❗❗", _tgtLbl + "赌空—「" + (fa.name || "") + "」无法执行！请" + amount + _resLbl + "·一文未拨");
            } else if (executionStatus === "partial") {
              global.addEB("财政❗", _tgtLbl + "不足！" + (fa.name || "") + "请" + amount + _resLbl + "，仅拨" + actualApplied + "，亏" + shortfall);
            } else {
              global.addEB("财政", _tgtLbl + (fa.kind === "income" ? "入" : "出") + _resLbl + " " + actualApplied + (fa.name ? "（" + fa.name + "）" : "") + (fa.recurring ? "·恒年" : ""));
            }
          }
        }
      });
      if (fiscalCount > 0) applied.semantic.fiscal_adjustments = fiscalCount;
      var facCount = 0;
      (aiOutput.faction_updates || []).forEach(function(fu) {
        if (!fu || !fu.name) return;
        var fac = _findEntity2(G, "faction", fu.name);
        if (!fac) {
          applied.failed.push({ faction_update: fu, reason: "faction not found" });
          return;
        }
        if (fu.updates && typeof _isPlainObject === "function" && _isPlainObject(fu.updates)) {
          let takeLeader = function(obj, key) {
            if (obj && Object.prototype.hasOwnProperty.call(obj, key)) leaderCandidates.push(String(obj[key] == null ? "" : obj[key]).trim());
            if (obj) delete obj[key];
          };
          var cleanUpdates = _safeOwnCopy(fu.updates);
          var leaderCandidates = [];
          takeLeader(cleanUpdates, "leader");
          takeLeader(cleanUpdates, "ruler");
          takeLeader(cleanUpdates, "newLeader");
          takeLeader(cleanUpdates, "leaderName");
          takeLeader(cleanUpdates, "leader_name");
          if (Object.prototype.hasOwnProperty.call(cleanUpdates, "leadership")) {
            var leadershipUpdate = cleanUpdates.leadership;
            delete cleanUpdates.leadership;
            if (typeof _isPlainObject === "function" && _isPlainObject(leadershipUpdate)) {
              leadershipUpdate = _safeOwnCopy(leadershipUpdate);
              takeLeader(leadershipUpdate, "ruler");
              takeLeader(leadershipUpdate, "leader");
              takeLeader(leadershipUpdate, "newLeader");
              if (Object.keys(leadershipUpdate).length) cleanUpdates.leadership = leadershipUpdate;
            } else applied.failed.push({ faction_update: fu.name, updateKey: "leadership", reason: "leadership must be a plain object" });
          }
          if (Object.prototype.hasOwnProperty.call(cleanUpdates, "leaderInfo")) {
            var leaderInfoUpdate = cleanUpdates.leaderInfo;
            delete cleanUpdates.leaderInfo;
            if (typeof _isPlainObject === "function" && _isPlainObject(leaderInfoUpdate)) {
              leaderInfoUpdate = _safeOwnCopy(leaderInfoUpdate);
              takeLeader(leaderInfoUpdate, "name");
              if (Object.keys(leaderInfoUpdate).length) cleanUpdates.leaderInfo = leaderInfoUpdate;
            } else applied.failed.push({ faction_update: fu.name, updateKey: "leaderInfo", reason: "leaderInfo must be a plain object" });
          }
          if (leaderCandidates.length) {
            var uniqueLeaders = leaderCandidates.filter(function(v, i, arr) {
              return arr.indexOf(v) === i;
            });
            if (uniqueLeaders.length > 1) {
              applied.failed.push({ faction_update: fu.name, reason: "conflicting faction leader mirrors" });
            } else {
              var leader = uniqueLeaders[0];
              var livingLeader = leader && typeof _resolveNarrativeAliveChar === "function" ? _resolveNarrativeAliveChar(G, leader) : null;
              if (leader && !livingLeader) {
                applied.failed.push({ faction_update: fu.name, reason: "faction leader must be an existing living character: " + leader });
              } else if (typeof _setFactionLeader !== "function") {
                applied.failed.push({ faction_update: fu.name, reason: "faction leader sink unavailable" });
              } else if (_setFactionLeader(fac, livingLeader ? livingLeader.id || livingLeader.name : "", G, fu.reason || "AI势力首领变更")) {
                facCount++;
              }
            }
          }
          facCount += _mergeUpdatesToEntity(fac, cleanUpdates, "faction_update", fac.name, fu.reason || "", applied.failed);
        } else if (fu.updates != null) applied.failed.push({ faction_update: fu.name, reason: "updates must be a plain JSON object" });
      });
      if (facCount > 0) applied.semantic.faction_updates = facCount;
      var factionFieldFallbackCount = _applyNarrativeFactionFieldFallback(G, aiOutput);
      if (factionFieldFallbackCount > 0) applied.semantic.faction_field_fallback = factionFieldFallbackCount;
      var partyCount = 0;
      (aiOutput.party_updates || []).forEach(function(pu) {
        if (!pu || !pu.name) return;
        var party = _findEntity2(G, "party", pu.name);
        if (!party) {
          applied.failed.push({ party_update: pu, reason: "party not found" });
          return;
        }
        if (typeof _applyStructuredPartyUpdate === "function") partyCount += _applyStructuredPartyUpdate(G, party, pu, applied.failed);
        else applied.failed.push({ party_update: pu.name, reason: "party update sink unavailable" });
      });
      if (partyCount > 0) applied.semantic.party_updates = partyCount;
      var classCount = 0;
      (aiOutput.class_updates || []).forEach(function(cu) {
        if (!cu || !cu.name) return;
        var cls = _findEntity2(G, "class", cu.name);
        if (!cls) {
          applied.failed.push({ class_update: cu, reason: "class not found" });
          return;
        }
        if (cu.updates) classCount += _mergeUpdatesToEntity(cls, cu.updates, "class_update", cls.name, cu.reason || "", applied.failed);
      });
      if (classCount > 0) applied.semantic.class_updates = classCount;
      var regionCount = 0;
      (aiOutput.region_updates || []).forEach(function(ru) {
        if (!ru) return;
        var identifier = ru.id || ru.name;
        if (!identifier) return;
        var div = _findDivisionByNameOrId(G, identifier);
        if (!div) {
          applied.failed.push({ region_update: ru, reason: "region not found" });
          return;
        }
        if (ru.updates) regionCount += _mergeUpdatesToEntity(div, ru.updates, "region_update", div.name || div.id, ru.reason || "", applied.failed);
      });
      if (regionCount > 0) applied.semantic.region_updates = regionCount;
      var regionFieldFallbackCount = _applyNarrativeRegionFieldFallback(G, aiOutput);
      if (regionFieldFallbackCount > 0) applied.semantic.region_field_fallback = regionFieldFallbackCount;
      var projectCount = 0;
      if (!G.activeProjects) G.activeProjects = [];
      (aiOutput.project_updates || []).forEach(function(pu) {
        if (!pu || !pu.name) return;
        var existing = G.activeProjects.find(function(p) {
          return p.name === pu.name;
        });
        if (existing) {
          if ((existing.status === "completed" || existing.status === "abandoned") && !pu.reactivate) {
            if (typeof global.addEB === "function") global.addEB("工程", existing.name + "·已结案·拒绝重写（如需重启请加 reactivate=true）");
            return;
          }
          if (typeof pu.progress === "number" && typeof existing.progress === "number" && pu.progress < existing.progress && !pu.progressReason) {
            if (typeof global.addEB === "function") global.addEB("工程", existing.name + "·进度倒退被拒（旧 " + existing.progress + "%→新 " + pu.progress + "%·缺 progressReason）");
            delete pu.progress;
          }
          Object.keys(pu).forEach(function(k) {
            if (/^_/.test(k)) return;
            existing[k] = pu[k];
          });
          existing._lastUpdated = G.turn || 0;
        } else {
          G.activeProjects.push(Object.assign({
            id: "proj_" + (G.turn || 0) + "_" + Math.random().toString(36).slice(2, 6),
            startTurn: G.turn || 0,
            status: "active"
          }, pu));
        }
        projectCount++;
        G._turnReport.push({ type: "project", name: pu.name, projectType: pu.type, status: pu.status, turn: G.turn || 0 });
        if (typeof global.addEB === "function") global.addEB("工程", pu.name + " " + (pu.status || "进行中") + (pu.progress ? " " + pu.progress + "%" : ""));
      });
      if (projectCount > 0) applied.semantic.project_updates = projectCount;
      var anyPathCount = 0;
      (aiOutput.anyPathChanges || []).forEach(function(apc) {
        if (!apc || !apc.path) return;
        if (_isPathBlocked(apc.path)) {
          applied.failed.push({ anyPath: apc.path, reason: "blocked" });
          return;
        }
        var result;
        var anyOp = apc.op == null || apc.op === "" ? "set" : String(apc.op).toLowerCase();
        if (anyOp === "push") {
          if (!Object.prototype.hasOwnProperty.call(apc, "value")) result = { ok: false, reason: "push requires value" };
          else result = _applyPathPush(G, apc.path, apc.value);
        } else if (anyOp === "delta") {
          var anyDelta = Object.prototype.hasOwnProperty.call(apc, "delta") ? apc.delta : apc.value;
          if (typeof anyDelta !== "number" || !isFinite(anyDelta)) result = { ok: false, reason: "delta must be a finite number" };
          else result = _applyPathDelta(G, apc.path, anyDelta, apc.reason);
        } else if (anyOp === "merge") {
          result = typeof _applyPathMerge === "function" ? _applyPathMerge(G, apc.path, apc.value, apc.reason) : { ok: false, reason: "merge unavailable" };
        } else if (anyOp === "delete") {
          try {
            var resolvedDelete = _resolvePath(G, _normalizeCoreVarPath(apc.path));
            if (!resolvedDelete.parent || !resolvedDelete.exists) result = { ok: false, reason: "delete target not found" };
            else {
              var oldDelete = resolvedDelete.value;
              if (Array.isArray(resolvedDelete.parent) && /^\d+$/.test(String(resolvedDelete.key))) resolvedDelete.parent.splice(Number(resolvedDelete.key), 1);
              else delete resolvedDelete.parent[resolvedDelete.key];
              result = { ok: true, path: _normalizeCoreVarPath(apc.path), old: oldDelete, new: void 0 };
            }
          } catch (e) {
            result = { ok: false, reason: "delete failed" };
          }
        } else if (anyOp === "set") {
          if (!Object.prototype.hasOwnProperty.call(apc, "value")) result = { ok: false, reason: "set requires value" };
          else result = _applyPathSet(G, apc.path, apc.value, apc.reason);
        } else {
          result = { ok: false, reason: "unsupported op: " + anyOp };
        }
        if (result && result.ok) {
          anyPathCount++;
          G._turnReport.push({ type: "anyPath", path: result.path || apc.path, op: apc.op || "set", old: result.old, new: result.new, reason: apc.reason, turn: G.turn || 0 });
        } else {
          applied.failed.push({ anyPath: apc.path, reason: result && result.reason });
        }
      });
      if (anyPathCount > 0) applied.semantic.anyPathChanges = anyPathCount;
      try {
        _applyFiscalDeficitPenalties(G);
      } catch (_dfE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_dfE, "applier] deficit penalty:") : console.warn("[applier] deficit penalty:", _dfE);
      }
      try {
        _applyDirectiveCompliance(G, aiOutput);
      } catch (_dcE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_dcE, "applier] directive compliance:") : console.warn("[applier] directive compliance:", _dcE);
      }
      try {
        _reconcilePlayerMovements(G);
      } catch (_rmE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_rmE, "applier] move reconcile:") : console.warn("[applier] move reconcile:", _rmE);
      }
      try {
        _reconcilePlayerFiscalReforms(G, aiOutput);
      } catch (_frE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_frE, "applier] fiscal reform reconcile:") : console.warn("[applier] fiscal reform reconcile:", _frE);
      }
      try {
        _applyOfficeDutyTick(G);
      } catch (_odE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_odE, "applier] office duty tick:") : console.warn("[applier] office duty tick:", _odE);
      }
      try {
        _applyRegentDecisions(G, aiOutput);
      } catch (_rdE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_rdE, "applier] regent decisions:") : console.warn("[applier] regent decisions:", _rdE);
      }
      try {
        _applyBattleResult(G, aiOutput, applied);
      } catch (_brE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_brE, "applier] battle result:") : console.warn("[applier] battle result:", _brE);
      }
      _runConsistencyValidator(applied, aiOutput, "fiscal", function() {
        _validateFiscalConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "personnel", function() {
        _validatePersonnelConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "military", function() {
        _validateMilitaryConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "sentiment", function() {
        _validateSentimentConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "population", function() {
        _validatePopulationConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "office", function() {
        _validateOfficeConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "war", function() {
        _validateWarConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "revolt", function() {
        _validateRevoltConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "disaster", function() {
        _validateDisasterConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "diplomacy", function() {
        _validateDiplomacyConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "keju", function() {
        _validateKejuConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "party", function() {
        _validatePartyConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "edictEffect", function() {
        _validateEdictEffectConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "courtCeremony", function() {
        _validateCourtCeremonyConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "construction", function() {
        _validateConstructionConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "omen", function() {
        _validateOmenConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "marriageBirth", function() {
        _validateMarriageBirthConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "conspiracy", function() {
        _validateConspiracyConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "currency", function() {
        _validateCurrencyConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "religion", function() {
        _validateReligionConsistency(G, aiOutput, applied);
      });
      _runConsistencyValidator(applied, aiOutput, "livingActor", function() {
        if (typeof window !== "undefined" && typeof window._validateLivingActorConsistency === "function") window._validateLivingActorConsistency(G, aiOutput);
      });
      _runConsistencyValidator(applied, aiOutput, "anachronism", function() {
        if (typeof window !== "undefined" && typeof window._validateNarrativeAnachronism === "function") window._validateNarrativeAnachronism(G, aiOutput);
      });
      var _validatorFailures = aiOutput._strictValidation === true ? _collectValidatorFailures(G, _validatorBaseline) : [];
      if (_validatorFailures.length) Array.prototype.push.apply(applied.failed, _validatorFailures);
      try {
        _processDeathEpitaphs(G, aiOutput);
      } catch (_deE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_deE, "applier] death epitaph:") : console.warn("[applier] death epitaph:", _deE);
      }
      try {
        if (typeof _syncFiscalScalars === "function") _syncFiscalScalars(G);
      } catch (_syE) {
        window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_syE, "applier] fiscal sync:") : console.warn("[applier] fiscal sync:", _syE);
      }
      return { ok: true, applied };
    }
    function applyAITurnChanges(aiOutput) {
      return _modules.reconcile.applyAITurnChangesAtomic.apply(this, arguments);
    }
    function _syncFiscalScalars(G) {
      return _modules.reconcile._syncFiscalScalars.apply(this, arguments);
    }
    function _validatePersonnelConsistency(G, aiOutput, applied) {
      return _modules.validators._validatePersonnelConsistency.apply(this, arguments);
    }
    function _validateMilitaryConsistency(G, aiOutput, applied) {
      return _modules.validators._validateMilitaryConsistency.apply(this, arguments);
    }
    function _validateSentimentConsistency(G, aiOutput, applied) {
      return _modules.validators._validateSentimentConsistency.apply(this, arguments);
    }
    function _validatePopulationConsistency(G, aiOutput, applied) {
      return _modules.validators._validatePopulationConsistency.apply(this, arguments);
    }
    function _validateOfficeConsistency(G, aiOutput, applied) {
      return _modules.validators._validateOfficeConsistency.apply(this, arguments);
    }
    function _validateWarConsistency(G, aiOutput, applied) {
      return _modules.validators._validateWarConsistency.apply(this, arguments);
    }
    function _validateRevoltConsistency(G, aiOutput, applied) {
      return _modules.validators._validateRevoltConsistency.apply(this, arguments);
    }
    function _validateDisasterConsistency(G, aiOutput, applied) {
      return _modules.validators._validateDisasterConsistency.apply(this, arguments);
    }
    function _validateDiplomacyConsistency(G, aiOutput, applied) {
      return _modules.validators._validateDiplomacyConsistency.apply(this, arguments);
    }
    function _validateKejuConsistency(G, aiOutput, applied) {
      return _modules.validators._validateKejuConsistency.apply(this, arguments);
    }
    function _validatePartyConsistency(G, aiOutput, applied) {
      return _modules.validators._validatePartyConsistency.apply(this, arguments);
    }
    function _validateEdictEffectConsistency(G, aiOutput, applied) {
      return _modules.validators._validateEdictEffectConsistency.apply(this, arguments);
    }
    function _validateCourtCeremonyConsistency(G, aiOutput, applied) {
      return _modules.validators._validateCourtCeremonyConsistency.apply(this, arguments);
    }
    function _validateConstructionConsistency(G, aiOutput, applied) {
      return _modules.validators._validateConstructionConsistency.apply(this, arguments);
    }
    function _validateMarriageBirthConsistency(G, aiOutput, applied) {
      return _modules.validators._validateMarriageBirthConsistency.apply(this, arguments);
    }
    function _validateConspiracyConsistency(G, aiOutput, applied) {
      return _modules.validators._validateConspiracyConsistency.apply(this, arguments);
    }
    function _validateCurrencyConsistency(G, aiOutput, applied) {
      return _modules.validators._validateCurrencyConsistency.apply(this, arguments);
    }
    function _validateReligionConsistency(G, aiOutput, applied) {
      return _modules.validators._validateReligionConsistency.apply(this, arguments);
    }
    function _validateOmenConsistency(G, aiOutput, applied) {
      return _modules.validators._validateOmenConsistency.apply(this, arguments);
    }
    function _validateFiscalConsistency(G, aiOutput, applied) {
      return _modules.validators._validateFiscalConsistency.apply(this, arguments);
    }
    function _maybeReconcileWithAI(G, aiOutput, applied) {
      return _modules.validators._maybeReconcileWithAI.apply(this, arguments);
    }
    function _processDeathEpitaphs(G, aiOutput) {
      return _modules.reconcile._processDeathEpitaphs.apply(this, arguments);
    }
    function _reconcilePlayerMovements(G) {
      return _modules.reconcile._reconcilePlayerMovements.apply(this, arguments);
    }
    function _reconcilePlayerFiscalReforms(G, aiOutput) {
      return _modules.reconcile._reconcilePlayerFiscalReforms.apply(this, arguments);
    }
    function _applyOfficeDutyTick(G) {
      return _modules.reconcile._applyOfficeDutyTick.apply(this, arguments);
    }
    function _applyTaxAuthorityGate(G, fa, amount) {
      return _modules.reconcile._applyTaxAuthorityGate.apply(this, arguments);
    }
    function _applyDirectiveCompliance(G, aiOutput) {
      return _modules.reconcile._applyDirectiveCompliance.apply(this, arguments);
    }
    function _applyRegentDecisions(G, aiOutput) {
      return _modules.reconcile._applyRegentDecisions.apply(this, arguments);
    }
    function preflightAIWriteBack(aiOutput, opts) {
      return _modules.reconcile.preflightAIWriteBack.apply(this, arguments);
    }
    function _applyBattleResult(G, aiOutput, applied) {
      return _modules.reconcile._applyBattleResult.apply(this, arguments);
    }
    function _applyFiscalDeficitPenalties(G) {
      return _modules.reconcile._applyFiscalDeficitPenalties.apply(this, arguments);
    }
    function _hasInstantArrivalRule(G) {
      return _modules.reconcile._hasInstantArrivalRule.apply(this, arguments);
    }
    function _estimateTravelDays(from, to) {
      if (!from || !to) return 20;
      if (from === to) return 0;
      return 20;
    }
    function generateTurnReport(turn) {
      var G = global.GM;
      if (!G._turnReport) return { empty: true };
      var thisTurn = turn || G.turn - 1 || G.turn || 0;
      var items = G._turnReport.filter(function(r) {
        return r.turn === thisTurn;
      });
      if (items.length === 0) return { empty: true };
      var byType = {};
      items.forEach(function(it) {
        if (!byType[it.type]) byType[it.type] = [];
        byType[it.type].push(it);
      });
      return {
        turn: thisTurn,
        narrative: (byType.narrative || []).map(function(n) {
          return n.text;
        }),
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
      if (rep.empty) return "";
      var html = '<div style="font-family:inherit;">';
      html += '<div style="font-size:1.0rem;color:var(--gold);margin-bottom:0.6rem;">回合 ' + rep.turn + " 纪要</div>";
      if (rep.narrative.length > 0) {
        html += '<section style="padding:6px 10px;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:8px;font-size:0.82rem;line-height:1.8;">';
        rep.narrative.forEach(function(n) {
          html += "<div>" + _esc(n) + "</div>";
        });
        html += "</section>";
      }
      if (rep.changes.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【变数】</div>';
        rep.changes.forEach(function(c) {
          var delta = c.delta !== void 0 ? (c.delta >= 0 ? "+" : "") + c.delta : "";
          var oldV = c.old !== void 0 ? _fmt(c.old) + " → " + _fmt(c.new) : _fmt(c.new);
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· <code>' + _esc(c.path) + "</code>：" + oldV + (delta ? " (" + delta + ")" : "") + (c.reason ? " · " + _esc(c.reason) : "") + "</div>";
        });
      }
      if (rep.appointments.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【任免】</div>';
        rep.appointments.forEach(function(a) {
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + ({ appoint: "擢", dismiss: "罢", transfer: "调" }[a.action] || a.action) + " <b>" + _esc(a.charName) + "</b>" + (a.position ? " 为 " + _esc(a.position) : "") + "</div>";
        });
      }
      if (rep.institutions.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【新制·裁撤】</div>';
        rep.institutions.forEach(function(i) {
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + (i.action === "create" ? "设" : "废") + " <b>" + _esc(i.name) + "</b></div>";
        });
      }
      if (rep.institutionLifecycle.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【制度运行】</div>';
        rep.institutionLifecycle.forEach(function(i) {
          var label = { created: "新设", underfunded: "欠费", corruption_high: "腐化", abolished: "裁撤" }[i.action] || i.action || "状态";
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + _esc(label) + " <b>" + _esc(i.name) + "</b>" + (i.text ? "：" + _esc(i.text) : "") + "</div>";
        });
      }
      if (rep.regions.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【区划】</div>';
        rep.regions.forEach(function(r) {
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· <b>' + _esc(r.id) + "</b> 改为 " + _esc(r.newType) + "</div>";
        });
      }
      if (rep.events.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【朝堂事件】</div>';
        rep.events.forEach(function(e) {
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· [' + _esc(e.category) + "] " + _esc(e.text) + "</div>";
        });
      }
      if (rep.npcActions.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【NPC 行动】</div>';
        rep.npcActions.forEach(function(a) {
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + _esc(a.actor) + "：" + _esc(a.action) + (a.targets ? "（" + a.targets.map(function(t) {
            return _esc(t);
          }).join("、") + "）" : "") + "</div>";
        });
      }
      if (rep.relations.length > 0) {
        html += '<div style="font-size:0.78rem;color:var(--gold);margin:6px 0 3px;">【关系变动】</div>';
        rep.relations.forEach(function(r) {
          html += '<div style="font-size:0.72rem;padding:1px 4px;">· ' + _esc(r.actor) + " → " + _esc(r.target) + " " + _esc(r.interaction) + "</div>";
        });
      }
      html += "</div>";
      return html;
    }
    function _fmt(n) {
      if (n === void 0 || n === null || isNaN(n)) return "—";
      var abs = Math.abs(n);
      if (abs >= 1e8) return (n / 1e8).toFixed(2) + "亿";
      if (abs >= 1e4) return (n / 1e4).toFixed(1) + "万";
      return Math.round(n).toLocaleString();
    }
    function _esc(s) {
      return typeof escHtml === "function" ? escHtml(s) : s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function _getFiscalContextTurnDays(G) {
      if (typeof global._getDaysPerTurn === "function") {
        try {
          var d = Number(global._getDaysPerTurn());
          if (d > 0) return d;
        } catch (_) {
        }
      }
      if (global.P && P.time && Number(P.time.daysPerTurn) > 0) return Number(P.time.daysPerTurn);
      if (G && G.guoku && Number(G.guoku.turnDays) > 0) return Number(G.guoku.turnDays);
      return 30;
    }
    function _isFiscalContextEntryActive(entry, G) {
      if (!entry) return false;
      if (entry.stopAfterTurn !== void 0 && entry.stopAfterTurn !== null && (G.turn || 0) > Number(entry.stopAfterTurn)) return false;
      return true;
    }
    function _normalizeFiscalContextEntry(target, kind, entry, monthRatio, G) {
      if (!_isFiscalContextEntryActive(entry, G)) return null;
      var recurring = !!entry.recurring;
      var amount = Math.max(0, Number(entry.amount) || 0);
      var turnAmount = recurring ? amount / 12 * monthRatio : entry.applied !== void 0 ? Math.max(0, Number(entry.applied) || 0) : amount;
      return {
        target,
        kind,
        resource: entry.resource === "grain" || entry.resource === "cloth" ? entry.resource : "money",
        name: entry.name || entry.category || "",
        category: entry.category || "",
        annualAmount: recurring ? amount : 0,
        amount,
        turnAmount,
        recurring,
        addedTurn: entry.addedTurn || 0,
        stopAfterTurn: entry.stopAfterTurn || null,
        lastSettledTurn: entry.lastSettledTurn || null,
        executionStatus: entry.executionStatus || "",
        shortfall: Number(entry.shortfall) || 0,
        reason: entry.reason || ""
      };
    }
    function _buildFiscalDynamicContext(G) {
      var turnDays = _getFiscalContextTurnDays(G);
      var monthRatio = turnDays / 30;
      var result = {
        turnDays,
        monthRatio,
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
        (G.guoku.extraIncome || []).forEach(function(entry) {
          pushEntry("guoku", "income", entry, result.byTarget.guoku.income);
        });
        (G.guoku.extraExpense || []).forEach(function(entry) {
          pushEntry("guoku", "expense", entry, result.byTarget.guoku.expense);
        });
      }
      if (G.neitang) {
        (G.neitang.extraIncome || []).forEach(function(entry) {
          pushEntry("neitang", "income", entry, result.byTarget.neitang.income);
        });
        (G.neitang.extraExpense || []).forEach(function(entry) {
          pushEntry("neitang", "expense", entry, result.byTarget.neitang.expense);
        });
      }
      function walkDivs(divs) {
        (divs || []).forEach(function(div) {
          if (!div) return;
          if (div.extraFiscal) {
            var bucket = { id: div.id || "", name: div.name || div.id || "", income: [], expense: [] };
            (div.extraFiscal.income || []).forEach(function(entry) {
              pushEntry("province:" + bucket.name, "income", entry, bucket.income);
            });
            (div.extraFiscal.expense || []).forEach(function(entry) {
              pushEntry("province:" + bucket.name, "expense", entry, bucket.expense);
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
      result.active.sort(function(a, b) {
        return Math.abs(b.turnAmount || 0) - Math.abs(a.turnAmount || 0);
      });
      return result;
    }
    function buildFullAIContext() {
      var G = global.GM;
      if (!G) return {};
      var ctx = {
        turn: G.turn,
        year: G.year,
        month: G.month,
        dynasty: G.dynasty,
        variables: {
          huangwei: _getVarState(G.huangwei),
          huangquan: _getVarState(G.huangquan),
          minxin: _getVarState(G.minxin),
          guoku: G.guoku ? {
            money: G.guoku.money !== void 0 ? G.guoku.money : G.guoku.balance,
            grain: G.guoku.grain,
            cloth: G.guoku.cloth,
            annualIncome: G.guoku.annualIncome,
            monthlyIncome: G.guoku.monthlyIncome,
            monthlyExpense: G.guoku.monthlyExpense,
            turnIncome: G.guoku.turnIncome,
            turnExpense: G.guoku.turnExpense,
            turnDays: G.guoku.turnDays,
            armory: typeof window !== "undefined" && window.TMArmory ? window.TMArmory.allStock(G) : void 0,
            // 军备库(甲胄/兵刃/弓弩/火器/战马)·供AI推演军务可读
            materials: typeof window !== "undefined" && window.TMArmory ? window.TMArmory.matAllStock(G) : void 0,
            // 原料库(铁/硝石/皮革/木)
            armoryReadiness: typeof window !== "undefined" && window.TMArmory && window.TMArmory.readinessForAI ? window.TMArmory.readinessForAI(G) : void 0
            // 军备研判(储备vs全军需求·充盈/够用/偏紧/紧缺)·供AI推演判军事虚实(火器紧缺→不宜倚火器决胜)
          } : null,
          neitang: G.neitang ? {
            money: G.neitang.money !== void 0 ? G.neitang.money : G.neitang.balance,
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
        pendingMemorials: (G._pendingMemorials || []).length,
        activeRevolts: G.minxin && G.minxin.revolts ? G.minxin.revolts.filter(function(r) {
          return r.status === "ongoing";
        }).length : 0,
        // 本回合待反应事件（NPC 按自身人格自主决定行为，非硬查表）
        pendingEventReactions: G._pendingEventReactions || [],
        eventReactionPromptText: typeof global.buildEventReactionPrompt === "function" ? global.buildEventReactionPrompt() : ""
      };
      return ctx;
    }
    function _getVarState(v) {
      if (!v) return null;
      if (typeof v === "number") return { value: v };
      return {
        index: v.index !== void 0 ? v.index : v.trueIndex !== void 0 ? v.trueIndex : v.overall,
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
      if (c && global.CharEconEngine && typeof global.CharEconEngine.buildEconomySnapshot === "function") {
        try {
          return global.CharEconEngine.buildEconomySnapshot(c);
        } catch (_snapErr) {
          if (window.TM && TM.errors) TM.errors.capture(_snapErr, "applier.charEconomySnapshot");
        }
      }
      if (!c || !c.resources) return null;
      var r = c.resources || {};
      var privateWealth = r.privateWealth || r.private || {};
      var money = _num(privateWealth.money);
      return {
        privateWealth: {
          money,
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
      var posByName = {};
      var _walkOT = function(nodes) {
        (nodes || []).forEach(function(n) {
          (n.positions || []).forEach(function(p) {
            if (p && p.name) posByName[p.name] = p;
          });
          if (n.subs) _walkOT(n.subs);
        });
      };
      _walkOT(G.officeTree || []);
      return G.chars.filter(function(c) {
        return c.alive !== false && (c.officialTitle || c.rank && c.rank <= 4);
      }).slice(0, 30).map(function(c) {
        var topRel = typeof global.getTopRelations === "function" ? global.getTopRelations(c.name, 3) : [];
        var posMeta = posByName[c.officialTitle];
        var pubTreasuryBinding = c.resources && c.resources.publicTreasury && c.resources.publicTreasury.binding;
        var pubTreasury = null;
        if (pubTreasuryBinding && typeof _resolveBinding === "function") {
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
          } catch (_e) {
            if (window.TM && TM.errors) TM.errors.capture(_e, "applier.pubTreasury");
          }
        }
        var economy = _getCharEconomySnapshot(c);
        return {
          name: c.name,
          title: c.officialTitle,
          rank: c.rank,
          faction: c.faction,
          loyalty: c.loyalty,
          ambition: c.ambition,
          integrity: c.integrity,
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
          economy
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
        source = G._turnReport.filter(function(r) {
          return r && r.type === "institution_lifecycle";
        });
      }
      return source.filter(function(e) {
        if (!e) return false;
        var t = typeof e.turn === "number" ? e.turn : turn;
        return turn - t <= windowTurns;
      }).slice(-8).map(function(e) {
        return {
          turn: e.turn || 0,
          id: e.id || "",
          name: e.name || "",
          action: e.action || "",
          stage: e.stage || "",
          text: e.text || ""
        };
      });
    }
    function _sameTravelLocation(a, b) {
      if (!a || !b) return false;
      try {
        if (typeof global._isSameLocation === "function") return !!global._isSameLocation(a, b);
      } catch (_) {
      }
      try {
        if (typeof _isSameLocation === "function") return !!_isSameLocation(a, b);
      } catch (_) {
      }
      return String(a || "").replace(/\s/g, "") === String(b || "").replace(/\s/g, "");
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
          Object.keys(fields).forEach(function(k) {
            item[k] = fields[k];
          });
          deleteKeys.forEach(function(k) {
            try {
              delete item[k];
            } catch (_) {
            }
          });
        });
      });
    }
    function _refreshCharacterLocationUiAfterTravel() {
      try {
        if (typeof global.buildIndices === "function") global.buildIndices();
      } catch (_) {
      }
      try {
        if (typeof global.renderGameState === "function") global.renderGameState();
      } catch (_) {
      }
      try {
        if (typeof global.renderRenwu === "function") global.renderRenwu(true);
      } catch (_) {
      }
      try {
        if (typeof global.renderSidePanels === "function") global.renderSidePanels();
      } catch (_) {
      }
      try {
        if (typeof global.renderWenduiPanel === "function") global.renderWenduiPanel();
      } catch (_) {
      }
      try {
        if (typeof global.renderShizhengPanel === "function") global.renderShizhengPanel();
      } catch (_) {
      }
    }
    function advanceCharTravelByDays(daysPassed) {
      var G = global.GM;
      if (!G || !Array.isArray(G.chars) || !(daysPassed > 0)) return { arrived: 0, inflight: 0 };
      var arrived = 0, inflight = 0;
      var dateText = typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0);
      G.chars.forEach(function(ch) {
        if (!ch || !ch._travelTo) return;
        if (ch.alive === false || ch.dead === true) return;
        ch._travelElapsedDays = (Number(ch._travelElapsedDays) || 0) + daysPassed;
        if (!(ch._travelExpectedDays > 0)) {
          ch._travelExpectedDays = typeof ch._travelRemainingDays === "number" && ch._travelRemainingDays > 0 ? ch._travelRemainingDays : 20;
        }
        var _capDays = Math.max(ch._travelExpectedDays * 2, 40);
        var _forceArrive = ch._travelElapsedDays >= _capDays;
        if (!_forceArrive && typeof ch._travelRemainingDays === "number") {
          ch._travelRemainingDays -= daysPassed;
          if (ch._travelRemainingDays > 0) {
            inflight++;
            return;
          }
        } else if (!_forceArrive && typeof ch._travelArrival === "number") {
          if ((G.turn || 0) < ch._travelArrival) {
            inflight++;
            return;
          }
        }
        _arriveCharNow(G, ch, dateText);
        arrived++;
      });
      if (arrived > 0) _refreshCharacterLocationUiAfterTravel();
      return { arrived, inflight };
    }
    function _arriveCharNow(G, ch, dateText) {
      if (!G || !ch || !ch._travelTo) return;
      if (!dateText) dateText = typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0);
      var fromLoc = ch._travelFrom || "";
      var toLoc = ch._travelTo;
      var assignPost = ch._travelAssignPost || "";
      var reason = ch._travelReason || "";
      var assignConcurrent = !!ch._travelAssignConcurrent || /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(reason + " " + assignPost);
      ch.location = toLoc;
      _syncCharacterLocationMirrors(G, ch, { location: toLoc }, []);
      if (assignPost) {
        var dept = "", post = assignPost;
        if (assignPost.indexOf("/") >= 0) {
          var parts = assignPost.split("/");
          dept = parts[0] || "";
          post = parts.slice(1).join("/") || "";
        }
        try {
          var r = onAppointment(ch.name, post, { dept, concurrent: assignConcurrent, reason });
          if (r && r.ok) {
            if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
            ch.careerHistory.push({
              turn: G.turn || 0,
              date: dateText,
              title: post,
              dept,
              action: "appoint",
              location: toLoc,
              reason: (reason || "") + "·赴任抵达"
            });
          }
        } catch (_appE) {
          window.TM && TM.errors && TM.errors.capture ? TM.errors.capture(_appE, "travelTick] auto-appoint") : console.warn("[travelTick] auto-appoint", _appE);
        }
      }
      if (typeof global.addEB === "function") {
        if (assignPost) {
          global.addEB("人事", ch.name + " 抵 " + toLoc + "·就任 " + assignPost.replace("/", " "));
        } else {
          global.addEB("人事", ch.name + " 已抵达 " + toLoc);
        }
      }
      if (G.qijuHistory) {
        G.qijuHistory.unshift({
          turn: G.turn || 0,
          date: dateText,
          content: "【入境】" + ch.name + " 自" + (fromLoc || "远方") + " 抵 " + toLoc + (assignPost ? "，即日就任 " + assignPost.replace("/", " ") : "") + "。"
        });
      }
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.unshift({
        turn: G.turn || 0,
        date: dateText,
        type: "赴任抵达",
        title: ch.name + " 抵 " + toLoc,
        content: ch.name + " 自" + (fromLoc || "远方") + " 抵 " + toLoc + (assignPost ? "·即日就任 " + assignPost.replace("/", " ") : "") + "。",
        category: "人事",
        tags: ["人事", "赴任", "抵达", ch.name]
      });
      if (typeof global.toast === "function") {
        global.toast(ch.name + " 抵达 " + toLoc + (assignPost ? "·就任" + assignPost.replace("/", " ") : ""), "info");
      }
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
        "_travelTo",
        "_travelFrom",
        "_travelStartTurn",
        "_travelRemainingDays",
        "_travelArrival",
        "_travelReason",
        "_travelAssignPost",
        "_travelAssignConcurrent",
        "_travelElapsedDays",
        "_travelExpectedDays"
      ]);
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type: "travel_arrived", char: ch.name, to: toLoc, assignPost, turn: G.turn || 0 });
    }
    var facade = {
      applyAITurnChanges,
      applyAIArmyChange,
      onAppointment,
      onDismissal,
      onTransfer,
      registerInstitution,
      abolishInstitution,
      reclassifyRegion,
      resolveBinding: _resolveBinding,
      ensurePublicTreasury: _ensurePublicTreasury,
      applyPathDelta: _applyPathDelta,
      applyPathSet: _applyPathSet,
      preflightAIWriteBack,
      generateTurnReport,
      renderTurnReport,
      buildFullAIContext,
      advanceCharTravelByDays,
      VERSION: 1
    };
    var _modulesBound = false;
    function bindModules(modules) {
      if (_modulesBound) throw new Error("[AIChangeApplier] module graph already bound");
      if (!modules || !modules.validators || !modules.reconcile) throw new Error("[AIChangeApplier] incomplete module graph");
      _modules = modules;
      _modulesBound = true;
      return facade;
    }
    return {
      bindModules,
      facade,
      legacyExports: {
        AIChangeApplier: facade,
        applyAllegianceChange,
        _syncFiscalScalars,
        _arriveCharNow,
        _hasInstantArrivalRule,
        applyAITurnChanges,
        applyAIArmyChange,
        onAppointment,
        onDismissal,
        _tmReasonIsImprison,
        _TM_IMPRISON_RE,
        _resolveBinding,
        renderTurnReport,
        buildFullAIContext,
        advanceCharTravelByDays
      },
      internals: {
        _alreadyResolvedState,
        _readFiscalStock,
        _writeFiscalStock,
        onAppointment,
        onDismissal,
        _findEntity: _findEntity2,
        _estimateTravelDays,
        _arriveCharNow,
        _sameTravelLocation,
        _travelMirrorFields,
        _syncCharacterLocationMirrors,
        _refreshCharacterLocationUiAfterTravel,
        _applyAITurnChangesUnsafe
      }
    };
  }

  // web/modules/ai-change-applier/validators.js
  function createValidators(deps) {
    "use strict";
    if (!deps || !deps.global || !deps.core) throw new Error("[AIChangeApplier] validator dependencies missing");
    var global = deps.global;
    var core = deps.core;
    var _alreadyResolvedState = core._alreadyResolvedState;
    var _readFiscalStock = core._readFiscalStock;
    var _writeFiscalStock = core._writeFiscalStock;
    var onAppointment = core.onAppointment;
    var onDismissal = core.onDismissal;
    function _textMentionsName(text, nm, allNames) {
      if (!nm) return false;
      var s = String(text == null ? "" : text);
      if (s.indexOf(nm) < 0) return false;
      var longer = (allNames || []).filter(function(n) {
        return n && n.length > nm.length && n.indexOf(nm) >= 0;
      }).sort(function(a, b) {
        return b.length - a.length;
      });
      for (var i = 0; i < longer.length; i++) {
        var L = longer[i], idx;
        while ((idx = s.indexOf(L)) >= 0) {
          s = s.slice(0, idx) + " ".repeat(L.length) + s.slice(idx + L.length);
        }
      }
      return s.indexOf(nm) >= 0;
    }
    function _narrativeDeathSourced(G, aiOutput, ch, opts) {
      if (!ch || !ch.name) return true;
      var nm = ch.name;
      if (ch.isPlayer === true) return true;
      if (ch._imprisoned || ch._exiled || ch._fled || ch._confiscated) return true;
      if (!aiOutput) aiOutput = {};
      function _named(arr, keys) {
        if (!Array.isArray(arr)) return false;
        for (var i = 0; i < arr.length; i++) {
          var x = arr[i];
          if (!x) continue;
          for (var k = 0; k < keys.length; k++) {
            if (x[keys[k]] === nm) return true;
          }
        }
        return false;
      }
      var _exSet = {};
      if (opts && opts.excludeStructuredKey) _exSet[opts.excludeStructuredKey] = true;
      if (opts && Array.isArray(opts.excludeStructuredKeys)) opts.excludeStructuredKeys.forEach(function(k) {
        _exSet[k] = true;
      });
      if (!_exSet["character_deaths"] && _named(aiOutput.character_deaths, ["name"])) return true;
      if (!_exSet["personnel_changes"] && _named(aiOutput.personnel_changes, ["name"])) return true;
      if (!_exSet["char_updates"] && _named(aiOutput.char_updates, ["name"])) return true;
      if (!_exSet["office_assignments"] && _named(aiOutput.office_assignments, ["name"])) return true;
      if (_named(aiOutput.npc_actions, ["name", "actor", "target"])) return true;
      var allNames = G && Array.isArray(G.chars) ? G.chars.map(function(c) {
        return c && c.name;
      }).filter(Boolean) : [];
      function _dirHit(text) {
        return _textMentionsName(text, nm, allNames);
      }
      var dirs = G && Array.isArray(G._playerDirectives) ? G._playerDirectives : [];
      for (var d = 0; d < dirs.length; d++) {
        if (dirs[d] && _dirHit(dirs[d].content)) return true;
      }
      var appliedDirs = G && Array.isArray(G._directivesAppliedThisTurn) ? G._directivesAppliedThisTurn : [];
      for (var a = 0; a < appliedDirs.length; a++) {
        if (appliedDirs[a] && _dirHit(appliedDirs[a].content)) return true;
      }
      var recent = G && Array.isArray(G._agentRecentDirectives) ? G._agentRecentDirectives : [];
      for (var r = 0; r < recent.length; r++) {
        var rd = recent[r];
        if (!rd) continue;
        if (Array.isArray(rd.edicts)) {
          for (var e = 0; e < rd.edicts.length; e++) {
            if (_dirHit(rd.edicts[e])) return true;
          }
        }
        if (_dirHit(rd.xinglu) || _dirHit(rd.content) || _dirHit(rd.text) || _dirHit(rd.note)) return true;
      }
      return false;
    }
    function _classifyStructuredDeathKind(reason) {
      var s = String(reason == null ? "" : reason);
      if (!s) return "active";
      if (/战殁|战死|阵亡|阵殁|阵前|殉国|殉难|殉城|殉职|捐躯|城破|城陷|遇害|遇难|遭难|罹难|殒命|毙命|兵败|兵变|民变|乱兵|流寇|奉旨|奉诏|明正典刑|就地正法|被斩|被诛|被杀|被害|被处死/.test(s)) return "active";
      if (/伏诛|伏法|弃市|就戮|授首|自尽|自缢|自刎|自裁|自杀|溘然长逝|病故|病逝|病殁|病卒|病亡|病笃|寝疾|亡故|暴毙|暴卒|暴亡|猝死|物故|身故|薨逝|薨|溘逝|寿终|谢世|辞世|弃世|长逝|无疾而终/.test(s)) return "bare";
      if (/斩|诛|赐死|赐自尽|处决|处斩|处死|正法|凌迟|腰斩|枭首|枭示|问斩|绞|戮|磔/.test(s)) return "active";
      return "active";
    }
    function _wgLoadGen(G) {
      return typeof global !== "undefined" && global._tmLoadGen || G && G._tmLoadGen || 0;
    }
    function _wgFp(x, n) {
      return String(x == null ? "" : x).slice(0, n || 10);
    }
    function _wgAllNamesSig(G) {
      var chars = G && Array.isArray(G.chars) ? G.chars : [];
      var n = chars.length;
      return (G && G.turn || 0) + "|" + _wgLoadGen(G) + "|" + n + "|" + _wgFp(n ? chars[0] && chars[0].name : "", 12) + "|" + _wgFp(n ? chars[n - 1] && chars[n - 1].name : "", 12);
    }
    function _wgCachedAllNames(G) {
      if (!G) return [];
      var sig = _wgAllNamesSig(G);
      if (G._wgAllNamesCache && G._wgAllNamesSigVal === sig) return G._wgAllNamesCache;
      var names = Array.isArray(G.chars) ? G.chars.map(function(c) {
        return c && c.name;
      }).filter(Boolean) : [];
      G._wgAllNamesCache = names;
      G._wgAllNamesSigVal = sig;
      return names;
    }
    function _wgLccTargetTurn(G) {
      var meta = G && G._lastChangchaoDecisionMeta;
      if (meta && meta.targetTurn != null && meta.targetTurn !== "") return Number(meta.targetTurn);
      if (G && G._lastChangchaoDecisionsTargetTurn != null && G._lastChangchaoDecisionsTargetTurn !== "") return Number(G._lastChangchaoDecisionsTargetTurn);
      return null;
    }
    function _wgStringifyDecision(d) {
      if (d == null) return "";
      if (typeof d !== "object") return " " + String(d);
      var s = "";
      ["direction", "custom", "text", "line", "mode", "action", "title", "detail", "content"].forEach(function(k) {
        if (d[k] != null && typeof d[k] !== "object") s += " " + d[k];
      });
      return s;
    }
    function _wgRecFp(rec) {
      return rec ? (rec.turn == null ? "" : rec.turn) + "_" + (rec.targetTurn == null ? "" : rec.targetTurn) + "_" + _wgFp(rec.topic || rec.decision && rec.decision.direction || Array.isArray(rec.decisions) && rec.decisions[0] && rec.decisions[0].title || "", 10) : "";
    }
    function _wgDecFp(dd) {
      return dd ? _wgFp((dd.title || "") + "/" + (dd.extra || ""), 14) : "";
    }
    function _wgCourtTextSig(G) {
      var crs = G && Array.isArray(G._courtRecords) ? G._courtRecords : [];
      var lcc = G && Array.isArray(G._lastChangchaoDecisions) ? G._lastChangchaoDecisions : [];
      var cn = crs.length, ln = lcc.length;
      return (G && G.turn || 0) + "|" + _wgLoadGen(G) + "|c" + cn + ":" + _wgRecFp(cn ? crs[0] : null) + ":" + _wgRecFp(cn ? crs[cn - 1] : null) + "|l" + ln + ":" + _wgDecFp(ln ? lcc[0] : null) + ":" + _wgDecFp(ln ? lcc[ln - 1] : null) + "|lt:" + ((G && G._lastChangchaoDecisionsTargetTurn) == null ? "" : G._lastChangchaoDecisionsTargetTurn) + ":" + ((G && G._lastChangchaoDecisionMeta && G._lastChangchaoDecisionMeta.targetTurn) == null ? "" : G._lastChangchaoDecisionMeta.targetTurn);
    }
    function _wgCachedCourtText(G) {
      if (!G) return "";
      var t = G.turn || 0;
      var crs = Array.isArray(G._courtRecords) ? G._courtRecords : [];
      var sig = _wgCourtTextSig(G);
      if (G._wgCourtTextCache != null && G._wgCourtTextSigVal === sig) return G._wgCourtTextCache;
      var txt = "";
      if (_wgLccTargetTurn(G) === t && Array.isArray(G._lastChangchaoDecisions)) {
        G._lastChangchaoDecisions.forEach(function(dd) {
          if (dd) txt += " " + (dd.title || "") + " " + (dd.extra || "") + " " + (dd.dept || "");
        });
      }
      for (var c = 0; c < crs.length; c++) {
        var rec = crs[c];
        if (!rec) continue;
        var rt = Number(rec.targetTurn != null && rec.targetTurn !== "" ? rec.targetTurn : rec.turn);
        if (!isFinite(rt) || rt !== t) continue;
        txt += " " + (rec.topic || "") + _wgStringifyDecision(rec.decision);
        var decs = Array.isArray(rec.decisions) ? rec.decisions : [];
        for (var di = 0; di < decs.length; di++) {
          var de = decs[di];
          if (de) txt += " " + (de.title || "") + " " + (de.detail || "") + " " + (de.content || "") + " " + (de.presenter || "") + " " + (de.dept || "");
        }
        var tr = Array.isArray(rec.transcript) ? rec.transcript : [];
        for (var ti = 0; ti < tr.length; ti++) {
          var te = tr[ti];
          if (te) txt += " " + (te.text || "") + " " + (te.speaker || "");
        }
      }
      G._wgCourtTextCache = txt;
      G._wgCourtTextSigVal = sig;
      return txt;
    }
    function _writeActionSourced(G, aiOutput, ch, opts) {
      opts = opts || {};
      if (_narrativeDeathSourced(G, aiOutput, ch, opts)) return true;
      if (opts.scanInputs && ch && ch.name) {
        var nm = ch.name;
        var allNames = _wgCachedAllNames(G);
        var _hit = function(t) {
          return _textMentionsName(t, nm, allNames);
        };
        var mems = G && Array.isArray(G.memorials) ? G.memorials : [];
        for (var i = 0; i < mems.length; i++) {
          var m = mems[i];
          if (!m) continue;
          if (_hit(m.title) || _hit(m.text) || _hit(m.content) || _hit(m.from) || _hit(m.target) || _hit(m.subject) || _hit(m.about)) return true;
        }
        var iss = G && Array.isArray(G.currentIssues) ? G.currentIssues : [];
        for (var j = 0; j < iss.length; j++) {
          var q = iss[j];
          if (!q) continue;
          if (_hit(q.title) || _hit(q.description) || _hit(q.desc)) return true;
        }
        var _courtTxt = _wgCachedCourtText(G);
        if (_courtTxt && _hit(_courtTxt)) return true;
      }
      return false;
    }
    function _gateJudicialPersonnelChange(G, aiOutput, pc, changeText, applied) {
      if (!G || !pc || !pc.name) return false;
      var judicial = /下狱|入狱|系狱|收押|收监|关押|囚禁|捉拿|逮捕|抓捕|缉拿|锁拿|拿问|逮治|械系|下诏狱|抄家|抄没|籍没|查抄|没官|流放|发配|戍边|充军|斩|诛|处决|处斩|处死|正法|凌迟|枭首|问斩|赐死|杖毙|廷杖|杖责|夺职拿问|暴毙|暴卒|暴亡|猝死|病故|病逝|病殁|病卒|病亡|亡故|物故|身故|溘逝|薨逝|薨|寿终|自尽|自缢|自刎|自裁|服毒|伏诛|伏法|弃市|殒命|毙命/.test(String(changeText || ""));
      if (!judicial) return false;
      var ch = typeof _findEntity === "function" ? _findEntity(G, "char", pc.name) : Array.isArray(G.chars) ? G.chars.filter(function(c) {
        return c && c.name === pc.name;
      })[0] : null;
      if (!ch) return false;
      if (_writeActionSourced(G, aiOutput, ch, { excludeStructuredKey: "personnel_changes", scanInputs: true })) return false;
      console.warn("[personnel/C2] 无源司法类人事动作·不执行(疑 AI 史实幻觉·转弱自查纸条留痕): " + pc.name + " ← 「" + String(changeText || "") + "」");
      if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
      G._aiWeakWriteHints.push({ label: "无源司法人事", reason: "司法类人事动作本回合无任一源头(玩家诏令/司法态/结构化互证/弹劾朝议输入)·疑史实幻觉·摘要「" + String(changeText || "").slice(0, 20) + "」", itemName: pc.name, source: "personnel-c2-no-source", active: null, turn: G.turn || 0 });
      if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
      try {
        if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", { label: "无源司法人事", itemName: pc.name, raw: String(changeText || "") });
      } catch (_c2e) {
      }
      if (applied && Array.isArray(applied.failed)) applied.failed.push({ personnel_change: { name: pc.name, change: pc.change }, reason: "无源司法类人事动作·未落库(疑史实幻觉·转弱自查纸条)" });
      return true;
    }
    function _sensitiveCharFieldSourced(G, aiOutput, entity, realKey, entityName) {
      if (!G || !entity) return true;
      if (_writeActionSourced(G, aiOutput, entity, { excludeStructuredKey: "char_updates", scanInputs: true })) return true;
      if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
      G._aiWeakWriteHints.push({ label: "无源敏感字段", reason: "char." + realKey + " 更新本回合无任一源头(玩家诏令/司法态/结构化互证/弹劾朝议输入)·疑 AI 史实幻觉失势向量", itemName: entityName || entity.name || entity.id, source: "char-update-c3-no-source", active: null, turn: G.turn || 0 });
      if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
      try {
        console.warn("[char_update/C3] 无源敏感字段·跳过·不落库(转弱自查纸条): " + (entityName || "") + "." + realKey);
      } catch (_c3w) {
      }
      try {
        if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", { label: "无源敏感字段", itemName: entityName || "", field: realKey });
      } catch (_c3d) {
      }
      return false;
    }
    function _extractEventYear(e) {
      var cands = [e.year, e.eventYear, e.triggerYear, e.happenedYear, e.gYear, e.date, e.time];
      for (var i = 0; i < cands.length; i++) {
        var v = cands[i];
        if (v == null) continue;
        if (typeof v === "number" && isFinite(v) && v > 0) return Math.floor(v);
        var m = String(v).match(/(?:^|[^0-9])((?:1[0-9]|20)[0-9]{2})(?:\s*年|[^0-9]|$)/);
        if (m) return parseInt(m[1], 10);
      }
      return 0;
    }
    function _gateEventTimepoint(G, e, applied) {
      if (!G || !e || typeof e !== "object") return false;
      function _pushHint(label, reason) {
        if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
        G._aiWeakWriteHints.push({ label, reason, itemName: e.title || e.name || e.category || "", source: "events-c4-timepoint", active: null, turn: G.turn || 0 });
        if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
        try {
          if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", { label, itemName: e.title || e.name || "" });
        } catch (_ge) {
        }
      }
      var curYear = 0;
      try {
        if (typeof global.calcDateFromTurn === "function" && G.turn != null) {
          var _cd = global.calcDateFromTurn(G.turn);
          curYear = Number(_cd && _cd.adYear) || 0;
        }
      } catch (_te) {
      }
      if (!(curYear >= 1e3 && curYear <= 2099)) curYear = Number(G.year) || Number(G.currentYear) || 0;
      if (!(curYear >= 1e3 && curYear <= 2099)) curYear = 0;
      var evYear = _extractEventYear(e);
      if (curYear && evYear && evYear > curYear) {
        try {
          console.warn("[events/C4] 未来时点事件·拒(当既成播报未来史实): 「" + String(e.title || e.text || e.name || "").slice(0, 30) + "」·事件年 " + evYear + " > 当前 " + curYear);
        } catch (_cw) {
        }
        _pushHint("未来时点事件", "事件标注年份 " + evYear + " 晚于当前游戏年 " + curYear + "·疑把未来史实当既成事件播报·拒落库");
        if (applied && Array.isArray(applied.failed)) applied.failed.push({ event: e.title || e.name || "", reason: "future-timepoint: " + evYear + " > " + curYear });
        return true;
      }
      var rig = Array.isArray(G.rigidHistoryEvents) && G.rigidHistoryEvents || global.P && Array.isArray(global.P.rigidHistoryEvents) && global.P.rigidHistoryEvents || null;
      if (rig && rig.length) {
        var txt = String((e.text || "") + " " + (e.title || "") + " " + (e.desc || "") + " " + (e.name || "") + " " + (e.category || ""));
        for (var r = 0; r < rig.length; r++) {
          var rev = rig[r];
          if (!rev || !rev.name) continue;
          var tt = Number(rev.triggerTurn);
          if (isFinite(tt) && tt > (G.turn || 0) && String(rev.name).length >= 2 && txt.indexOf(String(rev.name)) >= 0) {
            try {
              console.warn("[events/C4] 未到期既定史实名现于事件文本·软提示(不拒): 「" + rev.name + "」 triggerTurn=" + tt + " > 当前回合 " + (G.turn || 0));
            } catch (_cw2) {
            }
            _pushHint("未到期史实事件", "事件文本提及未到 triggerTurn(" + tt + ") 的既定史实「" + rev.name + "」·疑既成播报未来·软提示(不硬拒)");
            break;
          }
        }
      }
      return false;
    }
    function _gateAllegianceSource(G, aiOutput, charRef, newName, reason, applied) {
      if (!G || !charRef) return false;
      var ch = typeof _findEntity === "function" ? _findEntity(G, "char", charRef) : Array.isArray(G.chars) ? G.chars.filter(function(c) {
        return c && (c.name === charRef || c.id === charRef);
      })[0] : null;
      if (!ch) return false;
      if (/战败|兵败|大败|溃败|败绩|围城|城破|城陷|陷城|破城|策反|反正|反水|归降|归附|来降|来附|投诚|投降|纳降|请降|乞降|招抚|招降|抚定|胁迫|挟持|俘获|被俘|就擒|拥立|劫盟|叛降|叛附|献城|献关|举城|哗变|倒戈/.test(String(reason || ""))) return false;
      if (_writeActionSourced(G, aiOutput, ch, { scanInputs: true })) return false;
      console.warn("[allegiance/返工] 无源改换门庭·不执行(疑史实幻觉·转弱自查纸条留痕): " + (ch.name || charRef) + " → " + newName);
      if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
      G._aiWeakWriteHints.push({ label: "无源改换门庭", reason: "改换门庭本回合无军政诱因(战败/围城/策反)亦无玩家诏令/朝议来源·疑史实幻觉·目标势力「" + String(newName || "").slice(0, 20) + "」", itemName: ch.name || charRef, source: "allegiance-no-source", active: null, turn: G.turn || 0 });
      if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
      try {
        if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", { label: "无源改换门庭", itemName: ch.name || charRef });
      } catch (_ae) {
      }
      if (applied && Array.isArray(applied.failed)) applied.failed.push({ field: "allegiance_changes", text: (ch.name || charRef) + " → " + newName, reason: "无源改换门庭·未落库(疑史实幻觉)" });
      return true;
    }
    function _gateDeathRoutingSource(G, ch, reasonText, aiOutput) {
      if (!G || !ch || !ch.name || !aiOutput) return false;
      if (ch.isPlayer === true) return false;
      var rs = String(reasonText || "");
      if (!/处决|处斩|处死|斩首|斩决|斩杀|戮杀|正法|明正典刑|诛杀|诛戮|诛九族|凌迟|腰斩|弃市|枭首|枭示|问斩|赐死|赐自尽|绞刑|绞死|伏诛|伏法|就戮|授首|自尽|自缢|自刎|自裁|自杀|服毒自尽|畏罪自尽|磔|死刑|身故|病故|病逝|病殁|病卒|病亡|亡故|暴毙|暴卒|暴亡|猝死|物故|殒命|毙命|殉国|殉难|殉城|殉职|罹难|遇害|遇难|遭难|薨逝|溘逝|寿终|城破身死/.test(rs)) return false;
      if (_classifyStructuredDeathKind(rs) !== "bare") return false;
      if (_writeActionSourced(G, aiOutput, ch, { excludeStructuredKeys: ["character_deaths", "office_assignments", "personnel_changes"], scanInputs: true })) return false;
      console.warn("[death-route/返工] 无源裸死亡经人事通道入死亡管线·拦(疑史实幻觉·转弱自查纸条留痕): " + ch.name + " ← 「" + rs.slice(0, 30) + "」");
      if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
      G._aiWeakWriteHints.push({ label: "无源人事死亡", reason: "裸死亡经 personnel/appointments/office→onDismissal 死亡管线·本回合无任一源头·疑史实幻觉·死因「" + rs.slice(0, 20) + "」", itemName: ch.name, source: "death-routing-no-source", active: null, turn: G.turn || 0 });
      if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
      try {
        if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", { label: "无源人事死亡", itemName: ch.name });
      } catch (_de) {
      }
      return true;
    }
    function _validatePersonnelConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrativeText = "";
      if (aiOutput.narrative) narrativeText += String(aiOutput.narrative) + "\n";
      if (aiOutput.shilu_text) narrativeText += String(aiOutput.shilu_text) + "\n";
      if (aiOutput.shizhengji) narrativeText += String(aiOutput.shizhengji) + "\n";
      if (aiOutput.zhengwen) narrativeText += String(aiOutput.zhengwen) + "\n";
      if (aiOutput.yupiHuiting) narrativeText += String(aiOutput.yupiHuiting) + "\n";
      if (aiOutput.qijuHistory) narrativeText += String(aiOutput.qijuHistory) + "\n";
      if (Array.isArray(aiOutput.events)) {
        aiOutput.events.forEach(function(e) {
          if (e && e.desc) narrativeText += String(e.desc) + "\n";
        });
      }
      if (aiOutput.event && aiOutput.event.desc) narrativeText += String(aiOutput.event.desc) + "\n";
      if (Array.isArray(aiOutput.npc_actions)) {
        aiOutput.npc_actions.forEach(function(na) {
          if (na && na.desc) narrativeText += String(na.desc) + "\n";
        });
      }
      if (!narrativeText) return;
      var statusVerbs = {
        imprison: ["诏狱", "下诏狱", "入诏狱", "下狱", "入狱", "系狱", "收押", "收监", "关押", "囚禁", "拿问", "逮治", "槛车", "捉拿下狱", "逮捕下狱", "锁拿"],
        arrest: ["捉拿", "逮捕", "抓捕", "缉拿", "锁拿"],
        // 不一定下狱·区分对待
        exile: ["流放", "发配", "戍边", "充军", "远谪", "贬谪边远"],
        retire: ["致仕", "乞骸骨", "归田", "退休", "告老"],
        flee: ["潜逃", "远遁", "逃匿", "隐遁"],
        confiscate: ["抄家", "抄没", "籍没", "查抄", "没官"],
        dismiss: ["革职", "罢官", "罢免", "降职贬黜", "罢相", "罢免"]
      };
      var allChars = (G.chars || []).filter(function(c) {
        return c && c.name && c.alive !== false;
      });
      var charNameSet = {};
      allChars.forEach(function(c) {
        charNameSet[c.name] = c;
        if (c.zi) charNameSet[c.zi] = c;
      });
      var mentioned = [];
      Object.keys(statusVerbs).forEach(function(action) {
        statusVerbs[action].forEach(function(verb) {
          var pat1 = new RegExp("([\\u4e00-\\u9fff]{2,4})\\s*" + verb, "g");
          var pat2 = new RegExp(verb + "[^\\u4e00-\\u9fff]{0,5}([\\u4e00-\\u9fff]{2,4})", "g");
          [pat1, pat2].forEach(function(pat) {
            var m;
            while ((m = pat.exec(narrativeText)) !== null) {
              var name = m[1];
              if (!charNameSet[name]) continue;
              var key = name + "_" + action;
              if (mentioned.find(function(x) {
                return x.key === key;
              })) continue;
              mentioned.push({ key, name, action, verb, raw: m[0] });
            }
          });
        });
      });
      (function _scanExecutions() {
        var KILL_TRANS = [
          "明正典刑",
          "就地正法",
          "诛九族",
          "斩杀",
          "斩首",
          "斩决",
          "诛杀",
          "诛戮",
          "戮杀",
          "处决",
          "处斩",
          "处死",
          "正法",
          "凌迟",
          "腰斩",
          "枭首",
          "枭示",
          "问斩",
          "绞刑",
          "绞死",
          "赐死",
          "赐自尽",
          "斩",
          "杀",
          "砍",
          "戮",
          "诛"
        ];
        var KILL_INTRANS = [
          "服毒自尽",
          "畏罪自尽",
          "畏罪自缢",
          "阖门自尽",
          "投缳自尽",
          "伏诛",
          "伏法",
          "弃市",
          "就戮",
          "授首",
          "自尽",
          "自缢",
          "自刎",
          "自裁",
          "自杀",
          "磔"
        ];
        var KILL_NATURAL_VIOLENT = ["城破身死", "城陷而死", "以身殉国", "为国捐躯", "殉国", "殉难", "殉城", "殉职", "罹难", "遇害", "遇难", "遭难", "殒命", "毙命"];
        var KILL_NATURAL_PLAIN = ["溘然长逝", "病故", "病逝", "病殁", "病卒", "病亡", "亡故", "暴毙", "暴卒", "暴亡", "猝死", "物故", "身故", "薨逝", "溘逝", "寿终", "谢世", "辞世", "弃世", "长逝"];
        var KILL_NATURAL = KILL_NATURAL_VIOLENT.concat(KILL_NATURAL_PLAIN);
        function alt(list) {
          return list.slice().sort(function(a, b) {
            return b.length - a.length;
          }).join("|");
        }
        var transAlt = alt(KILL_TRANS), intransAlt = alt(KILL_INTRANS), natViolentAlt = alt(KILL_NATURAL_VIOLENT), natPlainAlt = alt(KILL_NATURAL_PLAIN);
        var _relRe = /之|其|亲|眷|属|族|子|女|父|母|妻|夫|弟|兄|孙|侄|甥|婿|妾|嗣|叔|伯|舅|姑|姊|妹/;
        var NP = "[^。！？；;.!?，,、\\n]{0,6}";
        function esc(s) {
          return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
        Object.keys(charNameSet).forEach(function(nm) {
          if (!nm || nm.length < 2 || narrativeText.indexOf(nm) < 0) return;
          var e = esc(nm), m = null, hit = null;
          var reP = new RegExp(e + "(?:[^。！？；;.!?\\n]{0,12}[，,、])?(?:旋|竟|遂|已|终|卒)?被(?!命|令|饬|派|遣|敕|诏|委|差|使|着)" + NP + "(?:" + transAlt + ")");
          var reW = new RegExp(e + "(?:[^。！？；;.!?\\n]{0,12}[，,、])?(?:旋|竟|遂|已|终|卒)?为" + NP + "所" + NP + "(?:" + transAlt + "|害|弑|戕|毙|殒)");
          var reB = new RegExp("把\\s*" + e + NP + "(?:" + transAlt + ")");
          var _victimRole = "(?:叛将|叛臣|叛贼|逆贼|逆臣|逆首|逆酋|贼首|贼酋|反贼|首恶|元凶|巨魁|渠魁|巨寇|渠帅|奸党|逆党|逆犯|要犯|钦犯)?";
          var reV = new RegExp("(?:" + transAlt + ")(?:了|之|讫|于[^。！？；，、\\n]{0,4})?" + _victimRole + "\\s*" + e);
          var reI = new RegExp(e + "[^。！？；;，,、\\n]{0,4}(?:" + intransAlt + ")");
          var reNv = new RegExp(e + "([^。！？；;，,、\\n]{0,4})(?:" + natViolentAlt + ")");
          var reNp = new RegExp(e + "([^。！？；;，,、\\n]{0,4})(?:" + natPlainAlt + ")");
          var _vpref = "处决", _deathKind = "active";
          if (m = reP.exec(narrativeText)) hit = m[0];
          else if (m = reW.exec(narrativeText)) hit = m[0];
          else if (m = reB.exec(narrativeText)) hit = m[0];
          else if (m = reV.exec(narrativeText)) hit = m[0];
          else if (m = reI.exec(narrativeText)) {
            hit = m[0];
            _deathKind = "bare";
          } else if ((m = reNv.exec(narrativeText)) && !_relRe.test(m[1] || "")) {
            hit = m[0];
            _vpref = "身故";
          } else if ((m = reNp.exec(narrativeText)) && !_relRe.test(m[1] || "")) {
            hit = m[0];
            _vpref = "身故";
            _deathKind = "bare";
          }
          if (!hit) return;
          var key = nm + "_execute";
          if (mentioned.find(function(x) {
            return x.key === key;
          })) return;
          mentioned.push({ key, name: nm, action: "execute", verb: _vpref + "·据叙事「" + hit + "」", raw: hit, deathKind: _deathKind });
        });
      })();
      if (!mentioned.length) return;
      var handled = {};
      (aiOutput.personnel_changes || []).forEach(function(pc) {
        if (pc && pc.name) handled[pc.name] = true;
      });
      (aiOutput.office_assignments || []).forEach(function(oa) {
        if (oa && oa.name && (oa.action === "dismiss" || oa.action === "transfer")) handled[oa.name] = true;
      });
      (aiOutput.char_updates || []).forEach(function(cu) {
        if (cu && cu.name && cu.updates) {
          var u = cu.updates;
          if (u.alive !== void 0 || u._imprisoned !== void 0 || u._exiled !== void 0 || u._retired !== void 0 || u._fled !== void 0 || u._confiscated !== void 0) handled[cu.name] = true;
        }
      });
      (aiOutput.character_deaths || []).forEach(function(cd) {
        if (cd && cd.name) handled[cd.name] = true;
      });
      var missing = mentioned.filter(function(m) {
        if (handled[m.name]) return false;
        if (_alreadyResolvedState(charNameSet[m.name], m.action, G)) return false;
        return true;
      });
      if (!missing.length) return;
      var patched = 0;
      var skipped = [];
      function _routeDeathToPipeline(ch, reason) {
        var cd = { name: ch.name, reason };
        try {
          if (typeof global.applyOneDeath === "function") {
            global.applyOneDeath(cd);
            return ch.alive === false;
          }
          if (typeof global.applyCharacterDeaths === "function") {
            global.applyCharacterDeaths({ character_deaths: [cd] });
            return ch.alive === false;
          }
        } catch (_de) {
          try {
            window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_de, "personnel-validator-death");
          } catch (__) {
          }
        }
        return false;
      }
      missing.forEach(function(m) {
        var ch = charNameSet[m.name];
        if (!ch) {
          skipped.push({ name: m.name, action: m.action, reason: "entity-not-found", raw: m.raw });
          return;
        }
        if (m.action !== "execute" && ch.alive === false) {
          skipped.push({ name: ch.name, action: m.action, reason: "already-dead", raw: m.raw });
          return;
        }
        try {
          if (m.action === "execute") {
            if (m.deathKind === "bare" && !_narrativeDeathSourced(G, aiOutput, ch)) {
              if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
              G._aiWeakWriteHints.push({ label: "无源叙事死亡", reason: "孤立叙事死亡·本回合无死亡意图/玩家诏令/司法前置·疑 AI 史实幻觉", itemName: ch.name, source: "personnel-validator-no-source", active: null, turn: G.turn || 0 });
              if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
              try {
                if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", { label: "无源叙事死亡", itemName: ch.name, raw: m.raw });
              } catch (_rhE) {
              }
              skipped.push({ name: ch.name, action: m.action, reason: "no-source-isolated-death", raw: m.raw });
              console.warn("[PersonnelValidator] 无源孤立叙事死亡·不落库(转弱自查纸条留痕): " + ch.name + " ← 「" + m.raw + "」");
              return;
            }
            if (_routeDeathToPipeline(ch, m.verb)) {
              patched++;
              if (global.addEB) global.addEB("校验补录", "人事校验器·" + ch.name + "『" + m.verb + "』经死亡管线补录入库(原文: " + m.raw + ")");
            } else {
              var rf = onDismissal(ch.name, m.verb);
              if (rf && rf.ok) {
                patched++;
                if (global.addEB) global.addEB("校验补录", "人事校验器·" + ch.name + "『" + m.verb + "』补录入库(回落·原文: " + m.raw + ")");
              } else {
                skipped.push({ name: ch.name, action: m.action, reason: rf && rf.reason || "death-route-failed", raw: m.raw });
              }
            }
          } else {
            var r = onDismissal(ch.name, m.verb);
            if (r && r.ok) {
              patched++;
              if (global.addEB) global.addEB("校验补录", "人事校验器·" + ch.name + "『" + m.verb + "』补录入库(原文: " + m.raw + ")");
            } else {
              skipped.push({ name: ch.name, action: m.action, reason: r && r.reason || "onDismissal-failed", raw: m.raw });
            }
          }
        } catch (_e) {
          try {
            window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_e, "personnel-validator");
          } catch (__) {
          }
        }
      });
      if (!G._personnelValidatorLog) G._personnelValidatorLog = [];
      G._personnelValidatorLog.push({ turn: G.turn || 0, missing, patched, skipped });
      if (G._personnelValidatorLog.length > 20) G._personnelValidatorLog = G._personnelValidatorLog.slice(-20);
      if (G._turnReport) {
        G._turnReport.push({ type: "personnel_validation", missing, patched, skipped, turn: G.turn || 0 });
      }
      console.warn("[PersonnelValidator] 叙事提及但 AI 未填结构化的人物状态变化(已自动补录 " + patched + "/" + missing.length + "):", missing);
      if (skipped.length) console.warn("[PersonnelValidator] 存疑未落账(实体缺失/死者/路由失败·已留痕):", skipped);
    }
    function _getNarrativeText(aiOutput) {
      var t = "";
      if (!aiOutput) return t;
      if (aiOutput.narrative) t += String(aiOutput.narrative) + "\n";
      if (aiOutput.shilu_text) t += String(aiOutput.shilu_text) + "\n";
      if (aiOutput.shizhengji) t += String(aiOutput.shizhengji) + "\n";
      if (aiOutput.yupiHuiting) t += String(aiOutput.yupiHuiting) + "\n";
      if (aiOutput.qijuHistory) t += String(aiOutput.qijuHistory) + "\n";
      if (aiOutput.event && aiOutput.event.desc) t += String(aiOutput.event.desc) + "\n";
      if (Array.isArray(aiOutput.events)) {
        aiOutput.events.forEach(function(e) {
          if (e && e.desc) t += String(e.desc) + "\n";
        });
      }
      if (Array.isArray(aiOutput.npc_actions)) {
        aiOutput.npc_actions.forEach(function(na) {
          if (na && na.desc) t += String(na.desc) + "\n";
        });
      }
      return t;
    }
    function _firstNarrativeHit(text, keywords) {
      for (var i = 0; i < keywords.length; i++) {
        if (text.indexOf(keywords[i]) >= 0) return keywords[i];
      }
      return null;
    }
    function _validateMilitaryConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      function parseNum(s, mult) {
        var cnMap = { "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "百": 100, "千": 1e3, "万": 1e4 };
        var n = parseFloat(s);
        if (isNaN(n) || n <= 0) {
          n = 0;
          var prev = 0;
          for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i);
            if (cnMap[ch] != null) {
              if (ch === "十" || ch === "百" || ch === "千" || ch === "万") prev = (prev || 1) * cnMap[ch];
              else prev = prev * 10 + cnMap[ch];
            }
          }
          n = prev;
        }
        if (mult === "万") n *= 1e4;
        else if (mult === "千") n *= 1e3;
        return n;
      }
      var addVerbs = "招募|募兵|招兵|增兵|扩军|新建|添募|添兵|增编|拨补|增添";
      var cutVerbs = "裁汰|裁军|裁撤|遣散|罢遣|裁革|削减|裁减";
      var lossVerbs = "阵亡|战死|溃散|逃亡|染瘟|染瘴";
      function _scan(verbs, kind) {
        var pat = new RegExp("(" + verbs + ")[^。；,\\s]{0,8}?([\\d一二三四五六七八九十百千万]+)\\s*(万|千)?\\s*(兵|人|卒|马|骑|众|甲)", "g");
        var arr = [], m;
        while ((m = pat.exec(narrative)) !== null) {
          var n = parseNum(m[2], m[3] || "");
          if (n < 100) continue;
          arr.push({ kind, verb: m[1], num: n, raw: m[0] });
        }
        return arr;
      }
      var mentioned = [].concat(_scan(addVerbs, "add"), _scan(cutVerbs, "cut"), _scan(lossVerbs, "loss"));
      if (!mentioned.length) return;
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
      mentioned.forEach(function(x) {
        mentTotal[x.kind] += x.num;
      });
      var warnings = [];
      ["add", "cut", "loss"].forEach(function(k) {
        if (mentTotal[k] <= 1e3) return;
        if (structuredTotal[k] < mentTotal[k] * 0.5) {
          warnings.push({ kind: k, mentioned: mentTotal[k], structured: structuredTotal[k], shortfall: mentTotal[k] - structuredTotal[k] });
        }
      });
      if (!warnings.length) return;
      if (!G._militaryValidatorLog) G._militaryValidatorLog = [];
      G._militaryValidatorLog.push({ turn: G.turn || 0, warnings, samples: mentioned.slice(0, 5) });
      if (G._militaryValidatorLog.length > 20) G._militaryValidatorLog = G._militaryValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "military_validation", warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
      console.warn("[MilitaryValidator] 叙事兵数与结构化 military_changes 偏差:", warnings);
    }
    function _validateSentimentConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var positiveKW = /民心大振|百姓欢悦|歌颂圣明|海内归心|朝野振奋|众心翕然|万民欣戴|四海升平|拥护|赞颂|拊掌|颂扬/g;
      var negativeKW = /民怨沸腾|怨声载道|朝野失望|天下共愤|举国震骇|民不聊生|流离失所|冤死狼藉|弃捐道路|哀鸿遍野|怨望|愤激|忿恚|骚然/g;
      var posCount = (narrative.match(positiveKW) || []).length;
      var negCount = (narrative.match(negativeKW) || []).length;
      if (posCount === 0 && negCount === 0) return;
      var sentDelta = 0;
      var tc = G.turnChanges && G.turnChanges.variables || [];
      tc.forEach(function(v) {
        if (!v || !v.name) return;
        if (/民心|皇威|皇权|声望|威信|拥戴/.test(v.name)) {
          sentDelta += v.delta || (v.newValue || 0) - (v.oldValue || 0);
        }
      });
      var warnings = [];
      if (posCount >= 2 && sentDelta <= 0) {
        warnings.push({ kind: "positive_no_uplift", posCount, sentDelta });
      }
      if (negCount >= 2 && sentDelta >= 0) {
        warnings.push({ kind: "negative_no_drop", negCount, sentDelta });
      }
      if (!warnings.length) return;
      if (!G._sentimentValidatorLog) G._sentimentValidatorLog = [];
      G._sentimentValidatorLog.push({ turn: G.turn || 0, posCount, negCount, sentDelta, warnings });
      if (G._sentimentValidatorLog.length > 20) G._sentimentValidatorLog = G._sentimentValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "sentiment_validation", warnings, turn: G.turn || 0 });
      console.warn("[SentimentValidator] 叙事情绪与变量变动不一致·posKW=" + posCount + "·negKW=" + negCount + "·sentDelta=" + sentDelta + ":", warnings);
    }
    function _validatePopulationConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      function _pn(s, mult) {
        var cnMap = { "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "百": 100, "千": 1e3, "万": 1e4 };
        var n = parseFloat(s);
        if (isNaN(n) || n <= 0) {
          n = 0;
          for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i);
            if (cnMap[ch] != null) {
              if (ch === "十" || ch === "百" || ch === "千" || ch === "万") n = (n || 1) * cnMap[ch];
              else n = n * 10 + cnMap[ch];
            }
          }
        }
        if (mult === "万") n *= 1e4;
        return n;
      }
      var deathVerbs = "饿死|冻死|疫死|战死|灾亡|溺死|染瘟|疫亡|流亡|罹难|罹疫";
      var fleeVerbs = "逃亡|逃难|流离|迁徙|迁移|流民";
      function _scan(verbs, kind) {
        var pat = new RegExp("(" + verbs + ")[^。；,\\s]{0,10}?([\\d一二三四五六七八九十百千万]+)\\s*(万|千)?\\s*(口|户|人|众)", "g");
        var arr = [], m;
        while ((m = pat.exec(narrative)) !== null) {
          var n = _pn(m[2], m[3] || "");
          if (n < 100) continue;
          arr.push({ kind, verb: m[1], num: n, raw: m[0] });
        }
        return arr;
      }
      var mentioned = [].concat(_scan(deathVerbs, "death"), _scan(fleeVerbs, "flee"));
      if (!mentioned.length) return;
      var popDelta = { death: 0, flee: 0 };
      var tc = G.turnChanges && G.turnChanges.variables || [];
      tc.forEach(function(v) {
        if (!v || !v.name) return;
        var d = v.delta || (v.newValue || 0) - (v.oldValue || 0);
        if (/口|人口|mouths|总口|户籍|户口/.test(v.name)) {
          if (d < 0) popDelta.death += Math.abs(d);
        }
        if (/逃户|流民|fugitives/.test(v.name)) {
          if (d > 0) popDelta.flee += d;
        }
      });
      var mentTotal = { death: 0, flee: 0 };
      mentioned.forEach(function(x) {
        mentTotal[x.kind] += x.num;
      });
      var warnings = [];
      if (mentTotal.death > 1e3 && popDelta.death < mentTotal.death * 0.3) {
        warnings.push({ kind: "death", mentioned: mentTotal.death, structured: popDelta.death, shortfall: mentTotal.death - popDelta.death });
      }
      if (mentTotal.flee > 1e3 && popDelta.flee < mentTotal.flee * 0.3) {
        warnings.push({ kind: "flee", mentioned: mentTotal.flee, structured: popDelta.flee, shortfall: mentTotal.flee - popDelta.flee });
      }
      if (!warnings.length) return;
      if (!G._populationValidatorLog) G._populationValidatorLog = [];
      G._populationValidatorLog.push({ turn: G.turn || 0, warnings, samples: mentioned.slice(0, 5) });
      if (G._populationValidatorLog.length > 20) G._populationValidatorLog = G._populationValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "population_validation", warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
      console.warn("[PopulationValidator] 叙事人口变动与结构化偏差:", warnings);
    }
    function _validateOfficeConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var allChars = (G.chars || []).filter(function(c) {
        return c && c.name && c.alive !== false;
      });
      var charNames = {};
      allChars.forEach(function(c) {
        charNames[c.name] = c;
      });
      var appointVerbs = "拜|擢|迁|转|命|授|任|升|进|起|起复|改任|擢任|超擢|兼任|兼职|加兼|兼领|兼署|兼管|兼摄";
      var pat = new RegExp("(" + appointVerbs + ")\\s*([\\u4e00-\\u9fff]{2,4})\\s*(?:为|任)\\s*([\\u4e00-\\u9fff]{2,12})", "g");
      var mentioned = [];
      var m;
      while ((m = pat.exec(narrative)) !== null) {
        var name = m[2];
        var post = m[3];
        if (!charNames[name]) continue;
        var key = name + "_" + post;
        if (mentioned.find(function(x) {
          return x.key === key;
        })) continue;
        mentioned.push({ key, name, post, verb: m[1], raw: m[0] });
      }
      if (!mentioned.length) return;
      var handled = {};
      (aiOutput.office_assignments || []).forEach(function(oa) {
        if (oa && oa.name && (oa.action === "appoint" || oa.action === "transfer")) handled[oa.name] = true;
      });
      (aiOutput.personnel_changes || []).forEach(function(pc) {
        if (pc && pc.name) handled[pc.name] = true;
      });
      var missing = mentioned.filter(function(m2) {
        return !handled[m2.name];
      });
      if (!missing.length) return;
      var patched = 0;
      missing.forEach(function(m2) {
        try {
          if (typeof onAppointment === "function") {
            var r = onAppointment(m2.name, m2.post, { concurrent: /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(m2.raw), reason: m2.raw });
            if (r && r.ok) {
              patched++;
              if (global.addEB) global.addEB("校验补录", "官职校验·" + m2.name + "『" + m2.verb + "为" + m2.post + "』补录(原文: " + m2.raw + ")");
            }
          }
        } catch (_e) {
          try {
            window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_e, "office-validator");
          } catch (__) {
          }
        }
      });
      if (!G._officeValidatorLog) G._officeValidatorLog = [];
      G._officeValidatorLog.push({ turn: G.turn || 0, missing, patched });
      if (G._officeValidatorLog.length > 20) G._officeValidatorLog = G._officeValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "office_validation", missing, patched, turn: G.turn || 0 });
      console.warn("[OfficeValidator] 叙事任命与 office_assignments 漏录(补 " + patched + "/" + missing.length + "):", missing);
    }
    function _validateWarConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var warStartVerbs = ["起兵", "兴师", "讨伐", "征伐", "北伐", "南征", "东征", "西征", "进犯", "入寇", "犯境", "寇边", "兵临", "出兵", "开战", "起衅", "启衅", "南下", "北上"];
      var warEndVerbs = ["议和", "和谈", "罢兵", "讲和", "纳贡", "约和", "盟约", "停战", "受降", "献降", "纳款", "奉表", "称臣"];
      var battleVerbs = ["大败", "大捷", "克复", "陷落", "失守", "收复", "破", "突围", "会战", "激战", "溃败", "全军覆没", "戍御", "解围"];
      var startKw = _firstNarrativeHit(narrative, warStartVerbs);
      var endKw = _firstNarrativeHit(narrative, warEndVerbs);
      var battleKw = _firstNarrativeHit(narrative, battleVerbs);
      if (!startKw && !endKw && !battleKw) return;
      var warnings = [];
      var existingWars = Array.isArray(G.activeWars) ? G.activeWars : [];
      var beforeCount = applied && typeof applied._warsBefore === "number" ? applied._warsBefore : existingWars.length;
      if (startKw && existingWars.length <= beforeCount) {
        warnings.push({ kind: "war_start_missing", keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
      }
      if (endKw) {
        var hasPeaced = existingWars.some(function(w) {
          return w && (w.status === "ended" || w.status === "peace" || w.status === "truce" || w.endedTurn);
        });
        if (!hasPeaced) warnings.push({ kind: "war_end_missing", keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
      }
      if (battleKw) {
        var hasBattle = existingWars.some(function(w) {
          return w && Array.isArray(w.battles) && w.battles.length > 0;
        });
        if (!hasBattle && existingWars.length > 0) {
          warnings.push({ kind: "battle_missing", keyword: battleKw, snippet: _snippetAround(narrative, battleKw, 30) });
        }
      }
      if (!warnings.length) return;
      if (!G._warValidatorLog) G._warValidatorLog = [];
      G._warValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._warValidatorLog.length > 20) G._warValidatorLog = G._warValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "war_validation", warnings, turn: G.turn || 0 });
      console.warn("[WarValidator] 战争一致性警告:", warnings);
    }
    function _validateRevoltConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var revoltStartVerbs = ["起事", "起义", "造反", "反叛", "暴动", "聚众", "啸聚", "揭竿", "作乱", "民变", "匪乱", "盗起", "贼起", "倡乱", "倡反", "倡叛", "流寇"];
      var revoltEndVerbs = ["镇压", "平定", "剿", "扑灭", "招抚", "宣抚", "讨平", "戡定", "平息", "靖", "勘平"];
      var startKw = _firstNarrativeHit(narrative, revoltStartVerbs);
      var endKw = _firstNarrativeHit(narrative, revoltEndVerbs);
      if (!startKw && !endKw) return;
      var warnings = [];
      var existingRevolts = G.minxin && Array.isArray(G.minxin.revolts) ? G.minxin.revolts : [];
      var beforeCount = applied && typeof applied._revoltsBefore === "number" ? applied._revoltsBefore : existingRevolts.length;
      if (startKw && existingRevolts.length <= beforeCount) {
        warnings.push({ kind: "revolt_start_missing", keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
      }
      if (endKw) {
        var hasEnded = existingRevolts.some(function(r) {
          return r && (r.status === "suppressed" || r.status === "appeased" || r.status === "ended" || r.endedTurn);
        });
        var hasOngoingBefore = existingRevolts.some(function(r) {
          return r && r.status === "ongoing";
        });
        if (!hasEnded && hasOngoingBefore) {
          warnings.push({ kind: "revolt_end_missing", keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
        }
      }
      if (!warnings.length) return;
      if (!G._revoltValidatorLog) G._revoltValidatorLog = [];
      G._revoltValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._revoltValidatorLog.length > 20) G._revoltValidatorLog = G._revoltValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "revolt_validation", warnings, turn: G.turn || 0 });
      console.warn("[RevoltValidator] 民变一致性警告:", warnings);
    }
    function _validateDisasterConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var disasterCategories = {
        drought: ["大旱", "亢旱", "赤地", "久旱", "久不雨", "焦土", "草木枯", "禾稼焦"],
        flood: ["大水", "洪水", "决堤", "江溢", "河溢", "暴雨", "水患", "溃决", "汎滥", "泛滥"],
        locust: ["蝗", "飞蝗", "蝻"],
        plague: ["大疫", "瘟疫", "疠疫", "染疫", "疫死", "瘟", "时疫", "痘疹"],
        quake: ["地动", "地震", "地陷", "山崩", "山摇"]
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
      var beforeCount = applied && typeof applied._disastersBefore === "number" ? applied._disastersBefore : existingDisasters.length;
      if (existingDisasters.length <= beforeCount) {
        hitList.forEach(function(h) {
          warnings.push({ kind: "disaster_missing", category: h.category, keyword: h.keyword, snippet: _snippetAround(narrative, h.keyword, 30) });
        });
      } else {
        var existingCats = {};
        existingDisasters.forEach(function(d) {
          if (d && (d.type || d.category)) existingCats[d.type || d.category] = true;
        });
        hitList.forEach(function(h) {
          if (!existingCats[h.category] && !existingCats[h.keyword]) {
            warnings.push({ kind: "disaster_category_mismatch", category: h.category, keyword: h.keyword, snippet: _snippetAround(narrative, h.keyword, 30) });
          }
        });
      }
      if (!warnings.length) return;
      if (!G._disasterValidatorLog) G._disasterValidatorLog = [];
      G._disasterValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._disasterValidatorLog.length > 20) G._disasterValidatorLog = G._disasterValidatorLog.slice(-20);
      if (G._turnReport) G._turnReport.push({ type: "disaster_validation", warnings, turn: G.turn || 0 });
      console.warn("[DisasterValidator] 天灾一致性警告:", warnings);
    }
    function _snippetAround(text, keyword, span) {
      var idx = text.indexOf(keyword);
      if (idx < 0) return "";
      var start = Math.max(0, idx - span);
      var end = Math.min(text.length, idx + keyword.length + span);
      return text.substring(start, end);
    }
    function _firstHit(text, arr) {
      for (var i = 0; i < arr.length; i++) if (text.indexOf(arr[i]) >= 0) return arr[i];
      return null;
    }
    function _validateDiplomacyConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var startKw = _firstHit(narrative, ["通使", "缔盟", "和好", "朝贡", "纳款", "纳贡", "遣使", "称臣", "羁縻", "抚夷", "封贡"]);
      var endKw = _firstHit(narrative, ["绝交", "逐使", "断绝", "宣战", "犯界", "寇边", "弃约", "背盟"]);
      if (!startKw && !endKw) return;
      var fuArr = aiOutput.faction_updates || [];
      var hasRelationFallback = applied && applied.semantic && applied.semantic.faction_field_fallback > 0 && (G._turnReport || []).some(function(r) {
        return r && r.turn === (G.turn || 0) && r.type === "faction_update" && r.field === "relation";
      });
      var hasFactionUpdate = fuArr.length > 0 || hasRelationFallback || G.turnChanges && (G.turnChanges.factions || []).length > 0;
      if (hasFactionUpdate) return;
      var warnings = [];
      if (startKw) warnings.push({ kind: "diplomacy_friendly_missing", keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
      if (endKw) warnings.push({ kind: "diplomacy_hostile_missing", keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
      if (!warnings.length) return;
      if (!G._diplomacyValidatorLog) G._diplomacyValidatorLog = [];
      G._diplomacyValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._diplomacyValidatorLog.length > 20) G._diplomacyValidatorLog = G._diplomacyValidatorLog.slice(-20);
      console.warn("[DiplomacyValidator] 外交一致性警告:", warnings);
    }
    function _validateKejuConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var kw = _firstHit(narrative, ["开科", "会试", "殿试", "放榜", "赐进士", "钦点状元", "钦定三甲", "一甲及第", "二甲赐进士", "金榜", "龙虎榜", "春闱", "秋闱", "恩科", "乡试", "贡士"]);
      if (!kw) return;
      var Pref = typeof P !== "undefined" ? P : null;
      var kejuActive = Pref && Pref.keju && (Pref.keju.currentExam || Pref.keju.history && Pref.keju.history.length);
      if (kejuActive) return;
      var warnings = [{ kind: "keju_missing", keyword: kw, snippet: _snippetAround(narrative, kw, 30) }];
      if (!G._kejuValidatorLog) G._kejuValidatorLog = [];
      G._kejuValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._kejuValidatorLog.length > 20) G._kejuValidatorLog = G._kejuValidatorLog.slice(-20);
      console.warn("[KejuValidator] 科举一致性警告:", warnings);
    }
    function _validatePartyConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var formKw = _firstHit(narrative, ["结社", "立党", "结党", "盟誓", "倡党", "倡议设", "门户", "朋党", "立社"]);
      var endKw = _firstHit(narrative, ["解散", "瓦解", "分裂", "分崩", "倾覆", "清党", "除党", "禁社"]);
      if (!formKw && !endKw) return;
      var existing = Array.isArray(G.parties) ? G.parties : [];
      var beforeCount = applied && typeof applied._partiesBefore === "number" ? applied._partiesBefore : existing.length;
      var hasUpdate = (aiOutput.party_updates || []).length > 0;
      if (hasUpdate) return;
      var warnings = [];
      if (formKw && existing.length <= beforeCount) warnings.push({ kind: "party_form_missing", keyword: formKw, snippet: _snippetAround(narrative, formKw, 30) });
      if (endKw && existing.length >= beforeCount && existing.some(function(p) {
        return p && p.status === "active";
      })) warnings.push({ kind: "party_end_missing", keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
      if (!warnings.length) return;
      if (!G._partyValidatorLog) G._partyValidatorLog = [];
      G._partyValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._partyValidatorLog.length > 20) G._partyValidatorLog = G._partyValidatorLog.slice(-20);
      console.warn("[PartyValidator] 党派一致性警告:", warnings);
    }
    function _validateEdictEffectConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var edictNarrative = narrative.replace(/下诏狱/g, "下狱");
      var promulgateKw = _firstHit(edictNarrative, ["颁诏", "降旨", "敕谕", "颁行", "颁布", "下诏", "明诏", "谕令", "制曰", "施行新政", "开行...新法", "申严"]);
      var revokeKw = _firstHit(narrative, ["废诏", "废制", "停止施行", "撤回", "撤销", "废止", "废罢", "收回成命"]);
      if (!promulgateKw && !revokeKw) return;
      var existingEdicts = Array.isArray(G.activeEdicts) ? G.activeEdicts : [];
      var beforeCount = applied && typeof applied._edictsBefore === "number" ? applied._edictsBefore : existingEdicts.length;
      var warnings = [];
      if (promulgateKw && existingEdicts.length <= beforeCount) warnings.push({ kind: "edict_promulgate_missing", keyword: promulgateKw, snippet: _snippetAround(narrative, promulgateKw, 30) });
      if (revokeKw && existingEdicts.length >= beforeCount) warnings.push({ kind: "edict_revoke_missing", keyword: revokeKw, snippet: _snippetAround(narrative, revokeKw, 30) });
      if (!warnings.length) return;
      if (!G._edictEffectValidatorLog) G._edictEffectValidatorLog = [];
      G._edictEffectValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._edictEffectValidatorLog.length > 20) G._edictEffectValidatorLog = G._edictEffectValidatorLog.slice(-20);
      console.warn("[EdictEffectValidator] 法令效力一致性警告:", warnings);
    }
    function _validateCourtCeremonyConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var moveCapKw = _firstHit(narrative, ["迁都", "移都", "改都"]);
      var titleKw = _firstHit(narrative, ["晋爵", "晋封", "加封", "进爵", "赐爵", "削爵", "夺爵", "除爵", "赠", "追赠", "追封", "谥", "赐姓", "赐婚"]);
      var haremKw = _firstHit(narrative, ["册立", "册封", "晋为妃", "晋为贵妃", "立为皇后", "废后", "废妃", "降为", "贬为", "出宫", "选秀", "纳妃"]);
      if (!moveCapKw && !titleKw && !haremKw) return;
      var charUpdates = aiOutput.char_updates || [];
      var hasCapitalMove = (G._turnReport || []).some(function(r) {
        return r && r.turn === (G.turn || 0) && r.type === "faction_update" && r.field === "capital";
      }) || (aiOutput.faction_updates || []).some(function(fu) {
        return fu && fu.updates && (fu.updates.capital || fu.updates.capitalName);
      });
      var hasRelevantUpdate = charUpdates.some(function(c) {
        if (!c || !c.changes) return false;
        var chKeys = Object.keys(c.changes || {});
        return chKeys.some(function(k) {
          return /title|posthumous|spouse|wife|consort/i.test(k);
        });
      });
      var warnings = [];
      if (moveCapKw && !hasCapitalMove) warnings.push({ kind: "capital_move_missing", keyword: moveCapKw, snippet: _snippetAround(narrative, moveCapKw, 30) });
      if (titleKw && !hasRelevantUpdate) warnings.push({ kind: "title_change_missing", keyword: titleKw, snippet: _snippetAround(narrative, titleKw, 30) });
      if (haremKw && !hasRelevantUpdate) warnings.push({ kind: "harem_change_missing", keyword: haremKw, snippet: _snippetAround(narrative, haremKw, 30) });
      if (!warnings.length) return;
      if (!G._courtCeremonyValidatorLog) G._courtCeremonyValidatorLog = [];
      G._courtCeremonyValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._courtCeremonyValidatorLog.length > 20) G._courtCeremonyValidatorLog = G._courtCeremonyValidatorLog.slice(-20);
      console.warn("[CourtCeremonyValidator] 朝廷礼仪一致性警告:", warnings);
    }
    function _validateConstructionConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var buildKw = _firstHit(narrative, ["兴工", "督造", "敕造", "竣工", "落成", "营建", "营造", "重建", "修缮", "整修", "修陵", "治水", "河工", "堰塞", "筑城", "筑堡", "铸钱", "铸器", "造船", "试制"]);
      var destroyKw = _firstHit(narrative, ["烧毁", "毁", "摧", "颓", "坍", "圮", "废墟", "焚毁"]);
      if (!buildKw && !destroyKw) return;
      var hasRelevant = (aiOutput.changes || []).some(function(c) {
        var p = c && c.path || "";
        return /building|project|construction|item|works|edifice/i.test(p);
      });
      if (!hasRelevant && global.TM && global.TM.BuildingOrders) {
        hasRelevant = global.TM.BuildingOrders.verifyReceipts(G, global.P, aiOutput.construction_receipts, narrative);
      }
      var warnings = [];
      if (buildKw && !hasRelevant) warnings.push({ kind: "construction_build_missing", keyword: buildKw, snippet: _snippetAround(narrative, buildKw, 30) });
      if (destroyKw && !hasRelevant) warnings.push({ kind: "construction_destroy_missing", keyword: destroyKw, snippet: _snippetAround(narrative, destroyKw, 30) });
      if (!warnings.length) return;
      if (!G._constructionValidatorLog) G._constructionValidatorLog = [];
      G._constructionValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._constructionValidatorLog.length > 20) G._constructionValidatorLog = G._constructionValidatorLog.slice(-20);
      console.warn("[ConstructionValidator] 工程·物品一致性警告:", warnings);
    }
    function _validateMarriageBirthConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var marryKw = _firstHit(narrative, ["嫁", "娶", "聘", "纳采", "纳征", "成婚", "结亲", "缔婚", "和亲", "联姻", "大婚"]);
      var birthKw = _firstHit(narrative, ["有娠", "怀孕", "身娠", "诞生", "分娩", "降生", "弄璋", "弄瓦", "长公主", "皇子", "皇女", "龙胎"]);
      var deathHeirKw = _firstHit(narrative, ["夭折", "早殇", "薨于稚龄", "婴卒", "绝嗣", "无嗣", "断后"]);
      var succKw = _firstHit(narrative, ["即位", "登基", "嗣位", "继统", "承祧", "承嗣", "袭爵", "袭封", "袭位"]);
      if (!marryKw && !birthKw && !deathHeirKw && !succKw) return;
      var charUpdates = aiOutput.char_updates || [];
      var charDeaths = aiOutput.character_deaths || [];
      var hasUpdate = charUpdates.some(function(c) {
        return c && c.changes && Object.keys(c.changes).some(function(k) {
          return /spouse|wife|consort|children|heir|inherited|succeeded/i.test(k);
        });
      });
      var warnings = [];
      if (marryKw && !hasUpdate) warnings.push({ kind: "marriage_missing", keyword: marryKw, snippet: _snippetAround(narrative, marryKw, 30) });
      if (deathHeirKw && charDeaths.length === 0) warnings.push({ kind: "heir_death_missing", keyword: deathHeirKw, snippet: _snippetAround(narrative, deathHeirKw, 30) });
      if (succKw && !hasUpdate) warnings.push({ kind: "succession_missing", keyword: succKw, snippet: _snippetAround(narrative, succKw, 30) });
      if (!warnings.length) return;
      if (!G._marriageBirthValidatorLog) G._marriageBirthValidatorLog = [];
      G._marriageBirthValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._marriageBirthValidatorLog.length > 20) G._marriageBirthValidatorLog = G._marriageBirthValidatorLog.slice(-20);
      console.warn("[MarriageBirthValidator] 婚姻·生育·继承一致性警告:", warnings);
    }
    function _validateConspiracyConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var plotKw = _firstHit(narrative, ["谋反", "谋逆", "谋叛", "造逆", "阴谋", "蓄志", "潜谋", "怀异", "私通", "密议", "结连", "潜图"]);
      var coupKw = _firstHit(narrative, ["弑君", "宫变", "政变", "兵变", "篡位", "兵谏", "逼宫", "犯阙", "兵围禁中", "闯宫", "劫驾"]);
      if (!plotKw && !coupKw) return;
      var pcArr = aiOutput.personnel_changes || [];
      var hasReason = pcArr.some(function(p) {
        return p && p.reason && /反|逆|篡|谋|变|党/.test(p.reason);
      });
      var charDeaths = (aiOutput.character_deaths || []).some(function(d) {
        return d && d.cause && /反|逆|弑|篡|刺|杀/.test(d.cause || d.reason || "");
      });
      var warnings = [];
      if (plotKw && !hasReason && !charDeaths) warnings.push({ kind: "plot_missing", keyword: plotKw, snippet: _snippetAround(narrative, plotKw, 30) });
      if (coupKw && !hasReason && !charDeaths) warnings.push({ kind: "coup_missing", keyword: coupKw, snippet: _snippetAround(narrative, coupKw, 30) });
      if (!warnings.length) return;
      if (!G._conspiracyValidatorLog) G._conspiracyValidatorLog = [];
      G._conspiracyValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._conspiracyValidatorLog.length > 20) G._conspiracyValidatorLog = G._conspiracyValidatorLog.slice(-20);
      console.warn("[ConspiracyValidator] 谋反·政变一致性警告:", warnings);
    }
    function _validateCurrencyConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var crisisKw = _firstHit(narrative, ["银荒", "钱荒", "钞贱", "通胀", "铜贵", "银贵", "物价腾贵", "米价踊贵", "货贵", "钱贱"]);
      var reformKw = _firstHit(narrative, ["币改", "换钞", "行钞", "行银", "铸大钱", "改铸", "禁银", "禁铜", "解禁", "弛禁"]);
      if (!crisisKw && !reformKw) return;
      var hasUpdate = (aiOutput.changes || []).some(function(c) {
        var p = c && c.path || "";
        return /currenc|silver|copper|inflation|银价|物价/i.test(p);
      }) || aiOutput.global_state_delta && Object.keys(aiOutput.global_state_delta || {}).some(function(k) {
        return /inflation|currency|priceIndex/i.test(k);
      });
      var warnings = [];
      if (crisisKw && !hasUpdate) warnings.push({ kind: "currency_crisis_missing", keyword: crisisKw, snippet: _snippetAround(narrative, crisisKw, 30) });
      if (reformKw && !hasUpdate) warnings.push({ kind: "currency_reform_missing", keyword: reformKw, snippet: _snippetAround(narrative, reformKw, 30) });
      if (!warnings.length) return;
      if (!G._currencyValidatorLog) G._currencyValidatorLog = [];
      G._currencyValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._currencyValidatorLog.length > 20) G._currencyValidatorLog = G._currencyValidatorLog.slice(-20);
      console.warn("[CurrencyValidator] 货币·币值一致性警告:", warnings);
    }
    function _validateReligionConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var riseKw = _firstHit(narrative, ["立教", "兴佛", "兴道", "传教", "弘法", "弘道", "立寺", "建观", "开堂"]);
      var fallKw = _firstHit(narrative, ["灭佛", "灭道", "禁教", "毁寺", "毁观", "焚经", "沙汰", "逐僧", "逐道"]);
      var sectKw = _firstHit(narrative, ["白莲", "弥勒", "无生老母", "闻香", "天主", "耶稣会", "回回", "袄教", "摩尼", "邪教", "妖教", "妖人"]);
      if (!riseKw && !fallKw && !sectKw) return;
      var existingRel = Array.isArray(G.religions) ? G.religions : [];
      var beforeCount = applied && typeof applied._religionsBefore === "number" ? applied._religionsBefore : existingRel.length;
      var hasUpdate = (aiOutput.changes || []).some(function(c) {
        var p = c && c.path || "";
        return /religion|sect|temple|monastic/i.test(p);
      });
      var warnings = [];
      if ((riseKw || fallKw) && !hasUpdate && existingRel.length === beforeCount) warnings.push({ kind: "religion_change_missing", keyword: riseKw || fallKw, snippet: _snippetAround(narrative, riseKw || fallKw, 30) });
      if (sectKw && !hasUpdate) warnings.push({ kind: "sect_event_missing", keyword: sectKw, snippet: _snippetAround(narrative, sectKw, 30) });
      if (!warnings.length) return;
      if (!G._religionValidatorLog) G._religionValidatorLog = [];
      G._religionValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._religionValidatorLog.length > 20) G._religionValidatorLog = G._religionValidatorLog.slice(-20);
      console.warn("[ReligionValidator] 宗教·教派一致性警告:", warnings);
    }
    function _validateOmenConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrative = _getNarrativeText(aiOutput);
      if (!narrative) return;
      var omenKw = _firstHit(narrative, ["彗见", "彗星", "星孛", "日蚀", "日食", "月蚀", "月食", "血雨", "虹贯", "虹气", "白虹", "瑞兽", "麒麟", "凤凰", "白虎", "五星连珠", "陨石", "地龙", "童谣", "谶", "妖言", "灾异", "祥瑞"]);
      if (!omenKw) return;
      var existingOmens = Array.isArray(G.omens) ? G.omens : (G.events || []).filter(function(e) {
        return e && (e.type === "omen" || e.category === "omen");
      });
      var beforeCount = applied && typeof applied._omensBefore === "number" ? applied._omensBefore : existingOmens.length;
      if (existingOmens.length > beforeCount) return;
      var warnings = [{ kind: "omen_missing", keyword: omenKw, snippet: _snippetAround(narrative, omenKw, 30) }];
      if (!G._omenValidatorLog) G._omenValidatorLog = [];
      G._omenValidatorLog.push({ turn: G.turn || 0, warnings });
      if (G._omenValidatorLog.length > 20) G._omenValidatorLog = G._omenValidatorLog.slice(-20);
      console.warn("[OmenValidator] 异象一致性警告:", warnings);
    }
    function _maybeReconcileWithAI(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var fiscalW = (G._fiscalValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var personW = (G._personnelValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.missing || []).length;
      }, 0);
      var militaryW = (G._militaryValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var sentW = (G._sentimentValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var popW = (G._populationValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var officeW = (G._officeValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.missing || []).length;
      }, 0);
      var warW = (G._warValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var revoltW = (G._revoltValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var disasterW = (G._disasterValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var diplomacyW = (G._diplomacyValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var kejuW = (G._kejuValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var partyW = (G._partyValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var edictEffectW = (G._edictEffectValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var courtCeremonyW = (G._courtCeremonyValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var constructionW = (G._constructionValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var omenW = (G._omenValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var marriageBirthW = (G._marriageBirthValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var conspiracyW = (G._conspiracyValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var currencyW = (G._currencyValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var religionW = (G._religionValidatorLog || []).filter(function(x) {
        return x.turn === G.turn;
      }).reduce(function(s, x) {
        return s + (x.warnings || []).length;
      }, 0);
      var totalW = fiscalW + personW + militaryW + sentW + popW + officeW + warW + revoltW + disasterW + diplomacyW + kejuW + partyW + edictEffectW + courtCeremonyW + constructionW + omenW + marriageBirthW + conspiracyW + currencyW + religionW;
      if (!G._reconcileLog) G._reconcileLog = [];
      G._reconcileLog.push({ turn: G.turn || 0, fiscalW, personW, militaryW, sentW, popW, officeW, warW, revoltW, disasterW, diplomacyW, kejuW, partyW, edictEffectW, courtCeremonyW, constructionW, omenW, marriageBirthW, conspiracyW, currencyW, religionW, total: totalW });
      if (G._reconcileLog.length > 20) G._reconcileLog = G._reconcileLog.slice(-20);
      if (totalW < 3) return;
      G._needsReconcile = {
        turn: G.turn || 0,
        warnings: { fiscal: fiscalW, personnel: personW, military: militaryW, sentiment: sentW, population: popW, office: officeW, war: warW, revolt: revoltW, disaster: disasterW, diplomacy: diplomacyW, keju: kejuW, party: partyW, edictEffect: edictEffectW, courtCeremony: courtCeremonyW, construction: constructionW, omen: omenW, marriageBirth: marriageBirthW, conspiracy: conspiracyW, currency: currencyW, religion: religionW },
        narrativeSnapshot: _getNarrativeText(aiOutput).slice(0, 2e3),
        // 截断防止 prompt 过长
        structuredSnapshot: {
          personnel_changes: aiOutput.personnel_changes || [],
          office_assignments: aiOutput.office_assignments || [],
          fiscal_adjustments: aiOutput.fiscal_adjustments || [],
          military_changes: aiOutput.military_changes || [],
          activeWars: G.activeWars || [],
          revolts: G.minxin && G.minxin.revolts || [],
          activeDisasters: G.activeDisasters || [],
          facs: (G.facs || []).slice(0, 5),
          parties: G.parties || [],
          activeEdicts: G.activeEdicts || []
        }
      };
      console.warn("[ReconcileAI] 本回合校验器累计警告 " + totalW + " 条 >= 阈值·标记 GM._needsReconcile·待异步 AI 自审");
      if (G._turnReport) G._turnReport.push({ type: "reconcile_pending", total: totalW, turn: G.turn || 0 });
    }
    function _validateFiscalConsistency(G, aiOutput, applied) {
      if (!G || !aiOutput) return;
      var narrativeText = "";
      if (aiOutput.shilu_text) narrativeText += String(aiOutput.shilu_text) + "\n";
      if (aiOutput.shizhengji) narrativeText += String(aiOutput.shizhengji) + "\n";
      if (Array.isArray(aiOutput.events)) {
        aiOutput.events.forEach(function(e) {
          if (e && e.desc) narrativeText += String(e.desc) + "\n";
        });
      }
      if (aiOutput.event && aiOutput.event.desc) narrativeText += String(aiOutput.event.desc) + "\n";
      if (!narrativeText) return;
      function _parseNum(numStr, mult) {
        var cnMap = { "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "两": 2, "壹": 1, "贰": 2, "叁": 3, "肆": 4, "伍": 5, "陆": 6, "柒": 7, "捌": 8, "玖": 9 };
        var n = parseFloat(numStr);
        if (!isNaN(n) && n > 0) {
          if (/万$/.test(numStr)) n *= 1e4;
          else if (/千$/.test(numStr)) n *= 1e3;
          else if (/百$/.test(numStr)) n *= 100;
          else if (/十$/.test(numStr)) n *= 10;
        } else {
          n = 0;
          for (var i = 0; i < numStr.length; i++) {
            var ch = numStr.charAt(i);
            if (cnMap[ch] != null) n = n * 10 + cnMap[ch];
            else if (ch === "十") n = (n || 1) * 10;
            else if (ch === "百") n = (n || 1) * 100;
            else if (ch === "千") n = (n || 1) * 1e3;
            else if (ch === "万") n = (n || 1) * 1e4;
          }
        }
        if (mult === "万") n *= 1e4;
        else if (mult === "千") n *= 1e3;
        else if (mult === "百") n *= 100;
        else if (mult === "十") n *= 10;
        return n;
      }
      var mentioned = [];
      var outflowVerbs = "赐|赏|发|拨|赈|征|没收|缴获|贡|赔|罚没|献|输|筹|济|捐|赠|颁|犒|赠送|耗费|花费|花|靡费|费|拨付|拨给|拨入|拨内帑|拨内库|划拨|调拨|发付|发给|发支|出库|起解|起运|解送|解部|解到|报销|发还|分给|拨与|赏给|犒赏|犒军|赈济|赈灾|赈给|安抚|抚恤|抚慰|支应|支给|支用|支放|支发|支领|动支|动用|提取|提用|划支|划归|经费|靡费|开支|开销|耗用";
      var inflowVerbs = "获得|获|收|入|进|得|得到|收到|进项|进帐|进账|收入|入账|入库|入帑|入内帑|纳入|抄获|抄到|没入|缴入|追缴|追讨|追回|罚入|查封充公|抄没入|没收入|籍没|籍家|籍没家产|抄家|抄籍|抄没|查抄|抄入|查封|充公|没官|没充|没户|入私库|入御府|入库银|起运入|解送至|划入|转入|调入|拨归|归入|纳款|捐输|报效|追比|追征|追缴|追赔|籍录|籍其家|罚银|罚没";
      var patOut = new RegExp("(" + outflowVerbs + ")[^。；\\s,，]{0,8}?([\\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖]+)\\s*(万|千|百|十)?\\s*(两|石|匹|斛|贯|缗|斗)", "g");
      var patIn = new RegExp("(" + inflowVerbs + ")[^。；\\s,，]{0,8}?([\\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖]+)\\s*(万|千|百|十)?\\s*(两|石|匹|斛|贯|缗|斗)", "g");
      function _scanPattern(pat, kind) {
        var m;
        while ((m = pat.exec(narrativeText)) !== null) {
          var action = m[1];
          var numStr = m[2];
          var mult = m[3] || "";
          var unit = m[4];
          var amt = _parseNum(numStr, mult);
          if (!amt || amt < 100) continue;
          var resType = unit === "石" || unit === "斛" || unit === "斗" ? "grain" : unit === "匹" ? "cloth" : "money";
          mentioned.push({ action, amount: amt, resource: resType, kind, raw: m[0] });
        }
      }
      _scanPattern(patOut, "expense");
      _scanPattern(patIn, "income");
      var moneyContextKw = /银|帑|库|帑廪|内帑|私库|内库|国库|库银|赏银|赈银|饷银|饷|赏|赈|犒|拨款|专款|经费|赔款|银两|帑库|公库/;
      var hasMoneyContext = moneyContextKw.test(narrativeText);
      if (hasMoneyContext) {
        let _scanLoose = function(pat, kind) {
          var m;
          while ((m = pat.exec(narrativeText)) !== null) {
            var raw = m[0];
            if (mentioned.some(function(x) {
              return x.raw === raw;
            })) continue;
            var amt = _parseNum(m[2], "万");
            if (!amt || amt < 1e3) continue;
            mentioned.push({ action: m[1], amount: amt, resource: "money", kind, raw, _loose: true });
          }
        };
        var patOutLoose = new RegExp("(" + outflowVerbs + ")[^。；,，]{0,16}?([+\\-]?[\\d一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖]+(?:\\.\\d+)?)\\s*万(?!两|石|匹|斛|贯|缗|斗|文|众|户|口|人|亩|顷|名)", "g");
        var patInLoose = new RegExp("(" + inflowVerbs + ")[^。；,，]{0,16}?([+\\-]?[\\d一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖]+(?:\\.\\d+)?)\\s*万(?!两|石|匹|斛|贯|缗|斗|文|众|户|口|人|亩|顷|名)", "g");
        _scanLoose(patOutLoose, "expense");
        _scanLoose(patInLoose, "income");
      }
      if (!mentioned.length) return;
      var adjTotal = { income: { money: 0, grain: 0, cloth: 0 }, expense: { money: 0, grain: 0, cloth: 0 } };
      (aiOutput.fiscal_adjustments || []).forEach(function(fa) {
        if (!fa) return;
        var res = fa.resource === "grain" || fa.resource === "cloth" ? fa.resource : "money";
        var k = fa.kind === "income" ? "income" : "expense";
        adjTotal[k][res] += Math.abs(parseFloat(fa.amount) || 0);
      });
      if (global.TM && global.TM.BuildingOrders) {
        (aiOutput.construction_receipts || []).forEach(function(r) {
          if (r && r.committed && global.TM.BuildingOrders.verifyReceipts(G, global.P, [r], narrativeText)) {
            adjTotal.expense.money += Math.max(0, Number(r.spent && r.spent.money) || 0);
          }
        });
      }
      var mentTotal = { income: { money: 0, grain: 0, cloth: 0 }, expense: { money: 0, grain: 0, cloth: 0 } };
      mentioned.forEach(function(x) {
        mentTotal[x.kind][x.resource] += x.amount;
      });
      var warnings = [];
      ["income", "expense"].forEach(function(kind) {
        ["money", "grain", "cloth"].forEach(function(res) {
          if (mentTotal[kind][res] <= 0) return;
          var ratio = adjTotal[kind][res] / mentTotal[kind][res];
          if (ratio < 0.5) {
            warnings.push({
              kind,
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
      G._fiscalValidatorLog.push({ turn: G.turn || 0, warnings, samples: mentioned.slice(0, 8) });
      if (G._fiscalValidatorLog.length > 20) G._fiscalValidatorLog = G._fiscalValidatorLog.slice(-20);
      G._turnReport.push({ type: "fiscal_validation", warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
      console.warn("[FiscalValidator] 叙事金额与 fiscal_adjustments 不符:", warnings);
      warnings.forEach(function(w) {
        if (w.shortfall <= 0) return;
        if (!G.guoku) G.guoku = {};
        var containerKey = w.kind === "income" ? "extraIncome" : "extraExpense";
        if (!G.guoku[containerKey]) G.guoku[containerKey] = [];
        var patch = {
          id: "fa_autopatch_" + (G.turn || 0) + "_" + Math.random().toString(36).slice(2, 5),
          name: "叙事脱节补录·" + (w.kind === "income" ? "入" : "出"),
          category: "校验补录",
          resource: w.resource,
          amount: w.shortfall,
          kind: w.kind,
          reason: "财务校验器·叙事提及" + w.kind + (w.resource === "grain" ? "粮" : w.resource === "cloth" ? "布" : "银") + w.mentioned + "·fiscal_adjustments 仅 " + w.adjusted + "·自动补录差额",
          recurring: false,
          addedTurn: G.turn || 0,
          stopAfterTurn: null,
          _autoPatched: true
        };
        G.guoku[containerKey].push(patch);
        var cur = _readFiscalStock(G.guoku, w.resource);
        var actual;
        if (w.kind === "income") {
          _writeFiscalStock(G.guoku, w.resource, cur + w.shortfall);
          actual = w.shortfall;
          patch.shortfall = 0;
        } else {
          actual = Math.min(cur, w.shortfall);
          if (cur > 0) {
            _writeFiscalStock(G.guoku, w.resource, cur - actual);
          }
          patch.shortfall = w.shortfall - actual;
        }
        if (w.resource === "money") G.guoku.balance = G.guoku.money;
        patch.applied = actual;
      });
    }
    return {
      _validatePersonnelConsistency,
      _validateMilitaryConsistency,
      _validateSentimentConsistency,
      _validatePopulationConsistency,
      _validateOfficeConsistency,
      _validateWarConsistency,
      _validateRevoltConsistency,
      _validateDisasterConsistency,
      _validateDiplomacyConsistency,
      _validateKejuConsistency,
      _validatePartyConsistency,
      _validateEdictEffectConsistency,
      _validateCourtCeremonyConsistency,
      _validateConstructionConsistency,
      _validateMarriageBirthConsistency,
      _validateConspiracyConsistency,
      _validateCurrencyConsistency,
      _validateReligionConsistency,
      _validateOmenConsistency,
      _validateFiscalConsistency,
      _maybeReconcileWithAI,
      _narrativeDeathSourced,
      _textMentionsName,
      _classifyStructuredDeathKind,
      _writeActionSourced,
      _gateJudicialPersonnelChange,
      _sensitiveCharFieldSourced,
      _gateEventTimepoint,
      _gateAllegianceSource,
      _gateDeathRoutingSource,
      _wgCachedAllNames,
      _wgCachedCourtText
    };
  }

  // web/modules/ai-change-applier/reconcile.js
  function createReconcile(deps) {
    "use strict";
    if (!deps || !deps.global || !deps.core || !deps.validators) throw new Error("[AIChangeApplier] reconcile dependencies missing");
    var global = deps.global;
    var core = deps.core;
    var validators = deps.validators;
    var _findEntity2 = core._findEntity;
    var _estimateTravelDays = core._estimateTravelDays;
    var _arriveCharNow = core._arriveCharNow;
    var _sameTravelLocation = core._sameTravelLocation;
    var _travelMirrorFields = core._travelMirrorFields;
    var _syncCharacterLocationMirrors = core._syncCharacterLocationMirrors;
    var _refreshCharacterLocationUiAfterTravel = core._refreshCharacterLocationUiAfterTravel;
    var _applyAITurnChangesUnsafe = core._applyAITurnChangesUnsafe;
    var _CHAR_DEATH_FIELD_RE = /^(?:alive|dead|isDead|deceased|positionAtDeath|diedAt|death[a-zA-Z0-9_]*|_death[a-zA-Z0-9_]*)$/i;
    function _strictLivingChar(G, ref) {
      var name = String(ref == null ? "" : ref).trim();
      if (!name || !G || !Array.isArray(G.chars)) return null;
      var ch = G.chars.find(function(c) {
        return c && (c.name != null && String(c.name).trim() === name || c.id != null && String(c.id).trim() === name);
      });
      return ch && ch.alive !== false && ch.dead !== true ? ch : null;
    }
    function _tmResolveStableOrUniqueIdentity(list, stableRef, legacyRef) {
      if (!Array.isArray(list)) return { entity: null, code: "identity-roster-missing" };
      var stable = String(stableRef == null ? "" : stableRef).trim();
      var legacy = String(legacyRef == null ? "" : legacyRef).trim();
      if (stable) {
        var stableMatches = list.filter(function(entity) {
          return entity && entity.id != null && String(entity.id).trim() === stable;
        });
        if (stableMatches.length === 1) return { entity: stableMatches[0], via: "id" };
        return { entity: null, code: stableMatches.length > 1 ? "ambiguous-reference" : "identity-not-found", ref: stable };
      }
      if (!legacy) return { entity: null, code: "missing-required-field", ref: "" };
      var idMatches = list.filter(function(entity) {
        return entity && entity.id != null && String(entity.id).trim() === legacy;
      });
      if (idMatches.length === 1) return { entity: idMatches[0], via: "id" };
      if (idMatches.length > 1) return { entity: null, code: "ambiguous-reference", ref: legacy };
      var nameMatches = list.filter(function(entity) {
        return entity && entity.name != null && String(entity.name).trim() === legacy;
      });
      if (nameMatches.length === 1) return { entity: nameMatches[0], via: "unique-name" };
      return { entity: null, code: nameMatches.length > 1 ? "ambiguous-reference" : "identity-not-found", ref: legacy };
    }
    function normalizeAIWriteBackDeaths(aiOutput, opts) {
      opts = opts || {};
      var G = global.GM;
      var result = { added: [], routed: [], failed: [], normalized: 0 };
      if (!G || !aiOutput || typeof aiOutput !== "object" || !Array.isArray(aiOutput.char_updates)) return result;
      if (!Array.isArray(aiOutput.character_deaths)) aiOutput.character_deaths = [];
      aiOutput.char_updates.forEach(function(cu) {
        if (!cu || typeof cu !== "object") return;
        var updates = cu.updates && typeof cu.updates === "object" && !Array.isArray(cu.updates) ? cu.updates : null;
        var wantsDeath = !!(updates && (updates.alive === false || updates.dead === true || updates.isDead === true || updates.deceased === true) || cu.alive === false || cu.dead === true || cu.isDead === true || cu.deceased === true);
        var hadSensitive = false;
        var reason = String(cu.reason || cu.deathReason || cu.deathCause || updates && (updates.deathReason || updates.deathCause || updates._deathCause) || "AI人物死亡").trim();
        if (updates) Object.keys(updates).forEach(function(key) {
          if (_CHAR_DEATH_FIELD_RE.test(key)) {
            hadSensitive = true;
            delete updates[key];
          }
        });
        Object.keys(cu).forEach(function(key) {
          if (_CHAR_DEATH_FIELD_RE.test(key)) {
            hadSensitive = true;
            delete cu[key];
          }
        });
        if (!hadSensitive) return;
        if (!wantsDeath) {
          result.failed.push({ char_update: cu.name || "", reason: "sensitive death fields require character_deaths" });
          return;
        }
        var ch = _strictLivingChar(G, cu.name);
        if (!ch) {
          result.failed.push({ char_update: cu.name || "", reason: "death target must be an existing living character" });
          return;
        }
        var existing = aiOutput.character_deaths.find(function(cd) {
          var ref = cd && String(cd.name || "").trim();
          return ref && (ref === String(ch.name || "").trim() || ref === String(ch.id || "").trim());
        });
        if (!existing) {
          existing = { name: ch.name || ch.id, reason: reason || "AI人物死亡" };
          aiOutput.character_deaths.push(existing);
          result.added.push(existing);
        } else if (!existing.reason && !existing.cause && !existing.deathReason) {
          existing.reason = reason || "AI人物死亡";
        }
        if (!result.routed.some(function(cd) {
          return cd === existing;
        })) result.routed.push(existing);
        result.normalized++;
      });
      return result;
    }
    function applyNormalizedAIWriteBackDeaths(G, normalization, applied) {
      normalization = normalization || { routed: [], added: [], failed: [] };
      applied = applied || { failed: [] };
      if (!Array.isArray(applied.failed)) applied.failed = [];
      if (Array.isArray(normalization.failed) && normalization.failed.length) {
        Array.prototype.push.apply(applied.failed, normalization.failed);
      }
      var routed = Array.isArray(normalization.routed) ? normalization.routed : normalization.added || [];
      var appliedChars = [];
      routed.forEach(function(cd) {
        var ch = _strictLivingChar(G, cd && cd.name);
        if (!ch) {
          applied.failed.push({ character_death: cd, reason: "death target no longer living" });
          return;
        }
        if (appliedChars.indexOf(ch) >= 0) return;
        try {
          if (typeof global.applyOneDeath === "function") global.applyOneDeath(cd);
          else if (typeof global.applyCharacterDeaths === "function") global.applyCharacterDeaths({ character_deaths: [cd] });
          else {
            applied.failed.push({ character_death: cd, reason: "death pipeline unavailable" });
            return;
          }
          if (ch.alive === false || ch.dead === true) appliedChars.push(ch);
          else applied.failed.push({ character_death: cd, reason: "death pipeline did not apply" });
        } catch (e) {
          applied.failed.push({ character_death: cd, reason: e && e.message || "death pipeline exception" });
        }
      });
      if (appliedChars.length) {
        applied.semantic = applied.semantic || {};
        applied.semantic.character_deaths_normalized = appliedChars.length;
      }
      return appliedChars.length;
    }
    function _processDeathEpitaphs(G, aiOutput) {
      if (!G || !Array.isArray(G.chars)) return;
      if (!G._epitaphs) G._epitaphs = [];
      if (!G._fakeDeathHolding) G._fakeDeathHolding = {};
      var deathList = Array.isArray(aiOutput.character_deaths) ? aiOutput.character_deaths : [];
      deathList.forEach(function(d) {
        if (!d || !d.name) return;
        var ch = _findEntity2(G, "char", d.name);
        if (!ch) return;
        var isFake = d.type === "fake" || d.type === "诈死" || /\u8BC8\u6B7B/.test(d.reason || "");
        if (isFake) {
          ch._fakeDeath = true;
          G._fakeDeathHolding[ch.name] = {
            turn: G.turn || 0,
            reason: d.reason || "",
            _memorySnapshot: ch._memory ? ch._memory.slice() : []
          };
          G._turnReport.push({ type: "fake_death", char: ch.name, reason: d.reason, turn: G.turn || 0 });
          return;
        }
        _generateEpitaph(G, ch, d.reason || "");
      });
      G.chars.forEach(function(ch) {
        if (!ch || ch.alive !== false || ch._fakeDeath) return;
        if (ch._epitaphed) return;
        _generateEpitaph(G, ch, ch._deathReason || "");
      });
    }
    function _generateEpitaph(G, ch, reason) {
      if (!ch || ch._epitaphed) return;
      var name = ch.name || "";
      var snippets = [];
      var curTurn = G.turn || 0;
      (G._aiMemory || []).forEach(function(mem) {
        if (!mem) return;
        var mtxt = typeof memoryEntryText === "function" ? memoryEntryText(mem) : (mem.text || mem.content || "") + "";
        if (!mtxt) return;
        if (curTurn - (mem.turn || 0) > 30) return;
        if (mtxt.indexOf(name) >= 0) snippets.push("T" + mem.turn + " " + mtxt.substring(0, 80));
      });
      var _evtLen = (G.evtLog || []).length;
      (G.evtLog || []).forEach(function(ev, idx) {
        if (!ev) return;
        var txt = (ev.desc || ev.text || "") + "";
        if (!txt || txt.indexOf(name) < 0) return;
        if (_evtLen - idx <= 200) {
          snippets.push("T" + (ev.turn || 0) + " " + txt.substring(0, 80));
        }
        ev._charDied = true;
      });
      var epitaph = {
        char: name,
        diedTurn: curTurn,
        diedAt: ch.diedAt || G.eraState && G.eraState.yearLabel || "",
        reason: reason || ch._deathReason || "",
        positionAtDeath: ch.positionAtDeath || ch.officialTitle || "",
        // 死亡应用已清 officialTitle·殁前官衔存于 positionAtDeath
        summary: snippets.slice(0, 10).join(" | ") || "T" + curTurn + " " + name + "薨",
        importance: (ch.historicalImportance || 0) + (ch._memory ? ch._memory.length : 0)
      };
      G._epitaphs.push(epitaph);
      if (Array.isArray(G._aiMemory)) {
        G._aiMemory = G._aiMemory.filter(function(mem) {
          var memText = typeof memoryEntryText === "function" ? memoryEntryText(mem) : mem && (mem.text || mem.content) || "";
          if (!mem || !memText) return true;
          return memText.indexOf(name) < 0;
        });
      }
      ch._epitaphed = true;
      G._turnReport.push({ type: "epitaph", char: name, reason: epitaph.reason, turn: curTurn });
    }
    function _hasInstantArrivalRule(G) {
      if (!G || !Array.isArray(G._playerDirectives)) return false;
      var moveKey = /人事|调动|调任|移动|移驻|赴任|召见|召还|到任|抵达|走位/;
      var instKey = /即刻|即时|瞬间|立即|当回合|次回合|疾驰|星夜|无在途|不在途|不存在.{0,3}在途/;
      return G._playerDirectives.some(function(d) {
        if (!d) return false;
        if (d.type !== "rule" && !d._absolute) return false;
        var t = (d.content || "") + " " + (d.structured ? JSON.stringify(d.structured) : "");
        return moveKey.test(t) && instKey.test(t);
      });
    }
    function _applyInstantArrivalCost(G, ch, mc) {
      try {
        if (typeof ch.stress === "number") ch.stress = Math.min(100, ch.stress + 5);
        else ch.stress = 5;
        if (typeof global.addEB === "function") global.addEB("人事", ch.name + " 奉诏急递星夜驰抵 " + mc.to + "·鞍马劳顿（即时到达·驿传代价）");
        if (!Array.isArray(G._turnReport)) G._turnReport = [];
        G._turnReport.push({ type: "instant_arrival_cost", char: ch.name, to: mc.to, stress: 5, turn: G.turn || 0 });
      } catch (_) {
      }
    }
    function _reconcilePlayerMovements(G) {
      if (!G || !Array.isArray(G._turnMoveCommands) || G._turnMoveCommands.length === 0) return;
      var cmds = G._turnMoveCommands;
      G._turnMoveCommands = [];
      if (!Array.isArray(G.chars)) return;
      var instant = _hasInstantArrivalRule(G);
      var dateText = typeof global.getTSText === "function" ? global.getTSText(G.turn || 0) : "T" + (G.turn || 0);
      var fixed = 0;
      cmds.forEach(function(mc) {
        if (!mc || !mc.char || !mc.to) return;
        var ch = null;
        for (var i = 0; i < G.chars.length; i++) {
          if (G.chars[i] && G.chars[i].name === mc.char) {
            ch = G.chars[i];
            break;
          }
        }
        if (!ch) return;
        if (ch.alive === false) return;
        if (_sameTravelLocation(ch.location || "", mc.to)) return;
        var heading = ch._travelTo && _sameTravelLocation(ch._travelTo, mc.to);
        var cmdInstant = instant || !!mc.instant;
        if (heading && !cmdInstant) return;
        if (typeof ch._travelAssignPost !== "string") ch._travelAssignPost = "";
        if (cmdInstant) {
          if (!heading) ch._travelFrom = ch.location || "";
          ch._travelTo = mc.to;
          ch._travelReason = (mc.reason || "诏令移动") + "·急递即刻抵达(玩家规则)";
          _arriveCharNow(G, ch, dateText);
          _applyInstantArrivalCost(G, ch, mc);
        } else {
          ch._travelFrom = ch.location || "";
          ch._travelTo = mc.to;
          ch._travelReason = (mc.reason || "诏令移动") + "·引擎补启";
          ch._travelStartTurn = G.turn || 0;
          ch._travelRemainingDays = _estimateTravelDays(ch._travelFrom, mc.to);
          try {
            _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []);
          } catch (_) {
          }
          if (typeof global.addEB === "function") global.addEB("人事", ch.name + " 奉诏启程赴 " + mc.to + "（引擎补启·AI 漏返 travelTo）");
        }
        if (!Array.isArray(G._turnReport)) G._turnReport = [];
        G._turnReport.push({ type: "move_reconciled", char: ch.name, to: mc.to, instant: !!instant, turn: G.turn || 0 });
        fixed++;
      });
      if (fixed > 0 && typeof _refreshCharacterLocationUiAfterTravel === "function") {
        try {
          _refreshCharacterLocationUiAfterTravel();
        } catch (_) {
        }
      }
    }
    function _reconcilePlayerFiscalReforms(G, aiOutput) {
      if (!G || !Array.isArray(G._turnFiscalReforms) || G._turnFiscalReforms.length === 0) return;
      var reforms = G._turnFiscalReforms;
      G._turnFiscalReforms = [];
      var FE = typeof window !== "undefined" && window.FiscalEngine || typeof global !== "undefined" && global.FiscalEngine || null;
      var _P = typeof window !== "undefined" && window.P || typeof global !== "undefined" && global.P || null;
      var pFac = _P && _P.playerInfo && _P.playerInfo.factionName || "";
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      var BASE = { compliance: 0.05, saltRate: 0.05, corruption: 3 };
      var aiMag = {};
      var _aiRe = aiOutput && Array.isArray(aiOutput.reform_effects) ? aiOutput.reform_effects : [];
      _aiRe.forEach(function(re) {
        if (re && re.type) aiMag[re.type] = re;
      });
      reforms.forEach(function(fr) {
        if (!fr || !fr.type) return;
        var detail = { type: fr.type };
        if (fr.type === "anticorruption") {
          var cd = aiMag.anticorruption && typeof aiMag.anticorruption.complianceDelta === "number" ? Math.max(0, Math.min(0.2, aiMag.anticorruption.complianceDelta)) : BASE.compliance;
          var n = FE && FE.adjustPlayerCompliance ? FE.adjustPlayerCompliance(pFac, cd, 0.1, 1) : 0;
          if (n === 0 && FE && FE.adjustPlayerCompliance) n = FE.adjustPlayerCompliance("", cd, 0.1, 1);
          detail.complianceUp = cd;
          detail.fromAI = !!aiMag.anticorruption;
          detail.divisions = n;
          try {
            var corrDrop = aiMag.anticorruption && typeof aiMag.anticorruption.corruptionDelta === "number" ? Math.max(0, Math.min(15, aiMag.anticorruption.corruptionDelta)) : BASE.corruption;
            var _divN = FE && FE.adjustPlayerDivisionCorruption ? FE.adjustPlayerDivisionCorruption(pFac, -corrDrop, 0, 100) : 0;
            if (_divN === 0 && FE && FE.adjustPlayerDivisionCorruption) _divN = FE.adjustPlayerDivisionCorruption("", -corrDrop, 0, 100);
            var _CE = typeof global !== "undefined" && global.CorruptionEngine || typeof window !== "undefined" && window.CorruptionEngine || null;
            var _GMc = typeof global !== "undefined" && global.GM || G;
            if (_GMc && _GMc.corruption && _GMc.corruption.subDepts && _GMc.corruption.subDepts.fiscal && typeof _GMc.corruption.subDepts.fiscal.true === "number") {
              _GMc.corruption.subDepts.fiscal.true = Math.max(0, _GMc.corruption.subDepts.fiscal.true - corrDrop);
              if (_CE && typeof _CE.syncIndexFromSubDepts === "function") _CE.syncIndexFromSubDepts("肃贪整饬吏治（P-DZ·财政口·实征率回升）");
            }
            detail.corruptionDrop = corrDrop;
            detail.corruptionDivisions = _divN;
            detail.corruptionFromAI = !!(aiMag.anticorruption && typeof aiMag.anticorruption.corruptionDelta === "number");
          } catch (_dzE) {
          }
        } else if (fr.type === "landsurvey") {
          var ns = FE && FE.triggerPlayerSurvey ? FE.triggerPlayerSurvey(pFac) : 0;
          if (ns === 0 && FE && FE.triggerPlayerSurvey) ns = FE.triggerPlayerSurvey("");
          detail.surveyed = ns;
        } else if (fr.type === "saltreform") {
          if (!G.policies) G.policies = {};
          var cur = typeof G.policies.saltTaxRate === "number" ? G.policies.saltTaxRate : 0.4;
          var sd = aiMag.saltreform && typeof aiMag.saltreform.rateDelta === "number" ? Math.max(-0.2, Math.min(0.2, aiMag.saltreform.rateDelta)) : BASE.saltRate;
          G.policies.saltTaxRate = Math.max(0, Math.min(0.8, cur + sd));
          detail.saltTaxRate = G.policies.saltTaxRate;
          detail.fromAI = !!aiMag.saltreform;
        } else if (fr.type === "openmaritime") {
          if (G._maritimeBan) G._maritimeBan = { active: false, turn: G.turn || 0 };
          detail.maritimeBanLifted = true;
        } else if (fr.type === "encouragefarming") {
          if (!G.policies) G.policies = {};
          G.policies.encourageFarming = true;
          detail.encourageFarming = true;
        } else {
          return;
        }
        G._turnReport.push({ type: "fiscal_reform_reconciled", reform: fr.type, detail, turn: G.turn || 0 });
        if (typeof global.addEB === "function") global.addEB("财政改革", ({ anticorruption: "肃贪", landsurvey: "丈田", saltreform: "盐政改革", openmaritime: "开海通商", encouragefarming: "劝农" }[fr.type] || fr.type) + "·已确定性落账·必生效");
      });
    }
    function _applyOfficeDutyTick(G) {
      if (typeof officeFlagOn !== "function" || !officeFlagOn("officeDutyStateEnabled")) return;
      if (typeof tickOfficeDutyState !== "function") return;
      var agg = tickOfficeDutyState(G);
      if (!agg || !agg.compliance && !agg.corruption) return;
      var FE = typeof window !== "undefined" && window.FiscalEngine || typeof global !== "undefined" && global.FiscalEngine || null;
      var _P = typeof window !== "undefined" && window.P || typeof global !== "undefined" && global.P || null;
      var pFac = _P && _P.playerInfo && _P.playerInfo.factionName || "";
      if (!FE) return;
      if (agg.compliance && FE.adjustPlayerCompliance) {
        var nc = FE.adjustPlayerCompliance(pFac, agg.compliance, 0.1, 1);
        if (nc === 0) FE.adjustPlayerCompliance("", agg.compliance, 0.1, 1);
      }
      if (agg.corruption && FE.adjustPlayerDivisionCorruption) {
        var nk = FE.adjustPlayerDivisionCorruption(pFac, agg.corruption, 0, 100);
        if (nk === 0) FE.adjustPlayerDivisionCorruption("", agg.corruption, 0, 100);
      }
      try {
        if (typeof global.addEB === "function" && agg.details && agg.details.length) {
          var _low = agg.details.filter(function(x) {
            return x.band === "low";
          }).map(function(x) {
            return x.dept + (x.pos || "");
          });
          var _high = agg.details.filter(function(x) {
            return x.band === "high";
          }).map(function(x) {
            return x.dept + (x.pos || "");
          });
          var _seg = [];
          if (_low.length) _seg.push("失职：" + _low.join("、"));
          if (_high.length) _seg.push("称职：" + _high.join("、"));
          if (_seg.length) {
            global.addEB("官制", "履职结算·" + _seg.join("；") + "（实征率" + (agg.compliance >= 0 ? "+" : "") + agg.compliance.toFixed(3) + "·腐败" + (agg.corruption >= 0 ? "+" : "") + agg.corruption.toFixed(1) + "）");
            if (!Array.isArray(G._chronicle)) G._chronicle = [];
            G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || "", type: agg.compliance !== 0 && agg.corruption !== 0 ? "官制↔财政·吏治" : agg.corruption !== 0 ? "官制↔吏治" : "官制↔财政", text: "百官履职·" + _seg.join("；") + "·实征率" + (agg.compliance >= 0 ? "+" : "") + agg.compliance.toFixed(3) + "·吏治" + (agg.corruption >= 0 ? "+" : "") + agg.corruption.toFixed(1), tags: ["联动", "官制"] });
          }
        }
      } catch (_ebE) {
      }
    }
    function _isTaxIncome(fa) {
      var s = String((fa.category || "") + "|" + (fa.name || "") + "|" + (fa.reason || ""));
      if (/缴获|贡纳|进贡|赏赐|罚没|抄没|抄家|捐纳|卖官|借款|赎银|缴还/.test(s)) return false;
      return /加赋|加派|加征|田赋|商税|盐课|盐税|关税|榷|赋税|税赋|征税|催征|追征|辽饷|练饷|剿饷|杂税|丁银|条鞭|火耗|正赋|钱粮|税银/.test(s);
    }
    function _applyTaxAuthorityGate(G, fa, amount) {
      if (typeof officeFlagOn !== "function" || !officeFlagOn("officeAuthorityGateEnabled")) return amount;
      if (typeof resolveOfficeAuthority !== "function") return amount;
      if (!(amount > 0) || fa.kind !== "income" || !_isTaxIncome(fa)) return amount;
      var auth = resolveOfficeAuthority(G, "taxCollect");
      if (!auth || auth.effectiveness >= 1) return amount;
      var collected = Math.round(amount * auth.effectiveness);
      var shortfall = amount - collected;
      if (shortfall > 0) {
        try {
          var FE = typeof window !== "undefined" && window.FiscalEngine || typeof global !== "undefined" && global.FiscalEngine || null;
          if (FE && FE.adjustPlayerDivisionCorruption) {
            var _P = typeof window !== "undefined" && window.P || typeof global !== "undefined" && global.P || null;
            var pFac = _P && _P.playerInfo && _P.playerInfo.factionName || "";
            var corrBump = Math.min(8, (1 - auth.effectiveness) * 10);
            var nn = FE.adjustPlayerDivisionCorruption(pFac, corrBump, 0, 100);
            if (nn === 0) FE.adjustPlayerDivisionCorruption("", corrBump, 0, 100);
          }
        } catch (_cgE) {
        }
      }
      try {
        if (typeof global.addEB === "function") global.addEB("官制", "加赋失实·" + (fa.name || fa.category || "税入") + " 原额" + amount + " → 实收" + collected + "（×" + auth.effectiveness.toFixed(2) + "·" + auth.reason + "·漏额中饱）");
      } catch (_egE) {
      }
      try {
        if (!Array.isArray(G._chronicle)) G._chronicle = [];
        G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || "", type: "官制↔财政·吏治", text: "掌征税之权" + auth.reason + "·" + (fa.name || fa.category || "税入") + " 加赋原额" + amount + "·实收" + collected + "·漏额" + shortfall + "中饱", tags: ["联动", "官制"] });
      } catch (_cgE2) {
      }
      return collected;
    }
    function _applyDirectiveCompliance(G, aiOutput) {
      if (!G) return;
      var _curTurn = G.turn || 0;
      if (!Array.isArray(G._directivesAppliedThisTurn) || G._directivesAppliedTurn !== _curTurn) {
        G._directivesAppliedThisTurn = [];
        G._directivesAppliedTurn = _curTurn;
      }
      if (!Array.isArray(G._playerDirectives) || G._playerDirectives.length === 0) return;
      var reports = aiOutput && Array.isArray(aiOutput.directive_compliance) ? aiOutput.directive_compliance : [];
      var idMap = {};
      G._playerDirectives.forEach(function(d) {
        if (d && d.id) idMap[d.id] = d;
      });
      reports.forEach(function(r) {
        if (!r || !r.id) return;
        var d = idMap[r.id];
        if (!d) return;
        d._lastStatus = r.status || "ignored";
        d._lastReason = r.reason || "";
        d._lastEvidence = r.evidence || "";
        d._lastCheckTurn = G.turn || 0;
        if (d._lastStatus === "ignored") {
          d._ignoredCount = (d._ignoredCount || 0) + 1;
        } else if (d._lastStatus === "followed") {
          d._followedCount = (d._followedCount || 0) + 1;
        } else if (d._lastStatus === "partial") {
          d._partialCount = (d._partialCount || 0) + 1;
        }
        G._turnReport.push({ type: "directive_compliance", id: r.id, status: r.status, reason: r.reason, evidence: r.evidence, turn: G.turn || 0 });
      });
      G._playerDirectives.forEach(function(d) {
        if (!d || !d.id) return;
        var reported = reports.some(function(r) {
          return r && r.id === d.id;
        });
        if (!reported && d.type === "rule" && d._lastCheckTurn !== G.turn) {
          d._lastStatus = "unchecked";
          d._lastCheckTurn = G.turn || 0;
        }
      });
      G._playerDirectives = G._playerDirectives.filter(function(d) {
        if (d && d._pendingRemovalAfterApply) {
          try {
            var _dc = d.content != null ? String(d.content) : "";
            if (!G._directivesAppliedThisTurn.some(function(x) {
              return x && x.content === _dc;
            })) {
              G._directivesAppliedThisTurn.push({ turn: _curTurn, content: _dc });
            }
          } catch (_) {
          }
          return false;
        }
        return true;
      });
    }
    function _applyRegentDecisions(G, aiOutput) {
      if (!G) return;
      var signal = G.regentSignal || G.regentState && G.regentState.signal || null;
      var decisions = aiOutput && Array.isArray(aiOutput.regent_decisions) ? aiOutput.regent_decisions : [];
      if (!signal && decisions.length === 0) {
        if (G.regentState && G.regentState.active === true) {
          G.regentState.active = false;
          G.regentState.hardCeiling = false;
          G.regentState.lastDecisionTurn = G.turn || 0;
        }
        return;
      }
      if (!G.regentState || typeof G.regentState !== "object") G.regentState = {};
      G.regentState.signal = signal || G.regentState.signal || null;
      G.regentState.decisions = decisions.map(function(r) {
        return {
          subject: r && r.subject || "",
          regentName: r && r.regentName || "",
          action: r && r.action || "defer",
          hardCeiling: !!(r && r.hardCeiling),
          reason: r && r.reason || ""
        };
      });
      G.regentState.active = !!(signal && signal.active);
      G.regentState.hardCeiling = !!(signal && signal.hardCeiling);
      G.regentState.lastDecisionTurn = G.turn || 0;
      if (signal) {
        G.regentState.rulerName = signal.rulerName || "";
        G.regentState.rulerTitle = signal.rulerTitle || "";
        G.regentState.rulerAge = signal.rulerAge;
        G.regentState.rulerHealth = signal.rulerHealth;
        G.regentState.playerRole = signal.playerRole || "";
        G.regentState.reasons = signal.reasons || [];
      }
      decisions.forEach(function(r) {
        G._turnReport.push({
          type: "regent_decision",
          subject: r && r.subject || "",
          regentName: r && r.regentName || "",
          action: r && r.action || "defer",
          hardCeiling: !!(r && r.hardCeiling),
          reason: r && r.reason || "",
          turn: G.turn || 0
        });
      });
    }
    var _tmPreflightCollector = null;
    var _tmPreflightContext = null;
    var _tmPreflightSideEffects = true;
    function _tmGateCode(label, reason) {
      var text = String(reason || "").toLowerCase();
      if (/ambiguous|conflicting|歧义/.test(text)) return "ambiguous-reference";
      if (/not in active|not active|not found|未找到|不存在|无法解析/.test(text)) return String(label || "entity") + "-not-found";
      if (/already dead|is dead|死亡/.test(text)) return "target-not-living";
      if (/duplicate/.test(text)) return "duplicate-entity";
      if (/missing/.test(text)) return "missing-required-field";
      if (/amount|finite|numeric|nan|infinity/.test(text)) return "invalid-numeric-value";
      if (/invalid target/.test(text)) return "invalid-target";
      if (/invalid kind|unsupported/.test(text)) return "unsupported-change-type";
      return "writeback-preflight-rejected";
    }
    function _tmGateTarget(item) {
      if (!item || typeof item !== "object") return "";
      return item.characterId || item.charId || item.factionId || item.regionId || item.id || item.name || item.charName || item.character || item.faction || item.target || item.post || "";
    }
    function _tmGateReason(label, reason, item, overrideCode, identityFields) {
      var context = _tmPreflightContext || {};
      var payload = {
        label: label || "",
        field: context.field || label || "",
        index: Number.isInteger(context.index) ? context.index : null,
        code: overrideCode || _tmGateCode(label, reason),
        target: _tmGateTarget(item),
        reason: reason || "",
        retryable: /not-found|ambiguous-reference|missing-required-field|invalid-target/.test(overrideCode || _tmGateCode(label, reason)),
        item: item || null
      };
      if (Array.isArray(identityFields) && identityFields.length) payload.identityFields = identityFields.slice();
      if (Array.isArray(_tmPreflightCollector)) _tmPreflightCollector.push(payload);
      if (!_tmPreflightSideEffects) return false;
      try {
        if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_gate", payload);
      } catch (_) {
      }
      _tmPushAIWeakHint(label, reason, item);
      return false;
    }
    function _tmNormName(name) {
      return String(name || "").trim().replace(/[\s·\-—、，。（）()《》“”"'：:；;！？?]/g, "");
    }
    function _tmNameOf(entity) {
      return entity && (entity.name || entity.id || entity.title || entity.label);
    }
    function _tmAliasHit(entity, raw, norm) {
      if (!entity) return false;
      var fields = ["_aliases", "aliases", "alias", "courtesyName", "zi", "hao", "posthumousName", "templeName"];
      for (var i = 0; i < fields.length; i++) {
        var v = entity[fields[i]];
        if (!v) continue;
        var arr = Array.isArray(v) ? v : String(v).split(/[、,，/|;]/);
        for (var j = 0; j < arr.length; j++) {
          var a = String(arr[j] || "").trim();
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
        e = list[i];
        en = _tmNameOf(e);
        if (e && en && String(en).trim() === raw) return e;
      }
      for (i = 0; i < list.length; i++) {
        e = list[i];
        en = _tmNameOf(e);
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
        if (typeof global.findScenarioById === "function" && G && G.sid) return global.findScenarioById(G.sid);
      } catch (_) {
      }
      return null;
    }
    function _tmPushArrays(root, keys, out) {
      if (!root || typeof root !== "object") return;
      keys.forEach(function(k) {
        if (Array.isArray(root[k])) out.push(root[k]);
      });
    }
    function _tmResolveChar(G, name) {
      if (!name || !G) return null;
      var active = _tmFindInList(G.chars || [], name);
      if (active) return { entity: active, source: "GM.chars", active: true };
      try {
        if (global.DA && global.DA.chars && typeof global.DA.chars.findByName === "function") {
          var da = global.DA.chars.findByName(name);
          if (da) return { entity: da, source: "DA.chars", active: !!_tmFindInList(G.chars || [], _tmNameOf(da) || name) };
        }
      } catch (_) {
      }
      try {
        if (typeof global._fuzzyFindChar === "function") {
          var fuzzy = global._fuzzyFindChar(name);
          if (fuzzy) return { entity: fuzzy, source: "_fuzzyFindChar", active: !!_tmFindInList(G.chars || [], _tmNameOf(fuzzy) || name) };
        }
      } catch (_) {
      }
      var all = _tmFindInList(G.allCharacters || [], name);
      if (all) return { entity: all, source: "GM.allCharacters", active: false };
      var sc = _tmGetScenario(G);
      var sd = global.scriptData || {};
      var buckets = [];
      _tmPushArrays(sd, ["characters", "chars", "npcs", "persons", "allCharacters"], buckets);
      _tmPushArrays(sc, ["characters", "chars", "npcs", "persons", "allCharacters"], buckets);
      for (var i = 0; i < buckets.length; i++) {
        var hit = _tmFindInList(buckets[i], name);
        if (hit) return { entity: hit, source: "scenario.characters", active: false };
      }
      return null;
    }
    function _tmResolveFaction(G, name) {
      if (!name || !G) return null;
      var active = _tmFindInList(G.facs || [], name);
      if (active) return { entity: active, source: "GM.facs", active: true };
      try {
        if (global.DA && global.DA.factions && typeof global.DA.factions.findByName === "function") {
          var da = global.DA.factions.findByName(name);
          if (da) return { entity: da, source: "DA.factions", active: !!_tmFindInList(G.facs || [], _tmNameOf(da) || name) };
        }
      } catch (_) {
      }
      try {
        if (typeof global._fuzzyFindFac === "function") {
          var fuzzy = global._fuzzyFindFac(name);
          if (fuzzy) return { entity: fuzzy, source: "_fuzzyFindFac", active: !!_tmFindInList(G.facs || [], _tmNameOf(fuzzy) || name) };
        }
      } catch (_) {
      }
      var sc = _tmGetScenario(G);
      var sd = global.scriptData || {};
      var buckets = [];
      _tmPushArrays(G, ["factions", "allFactions", "extForces"], buckets);
      _tmPushArrays(sd, ["factions", "facs", "allFactions", "extForces"], buckets);
      _tmPushArrays(sc, ["factions", "facs", "allFactions", "extForces"], buckets);
      for (var i = 0; i < buckets.length; i++) {
        var hit = _tmFindInList(buckets[i], name);
        if (hit) return { entity: hit, source: "scenario.factions", active: false };
      }
      return null;
    }
    function _tmPushAIWeakHint(label, reason, item, resolution) {
      var G = global.GM;
      if (!G) return true;
      var hint = {
        label: label || "",
        reason: reason || "",
        itemName: item && (item.name || item.faction || item.newLeader || item.target || ""),
        source: resolution && resolution.source || "",
        active: resolution ? !!resolution.active : null,
        turn: G.turn || 0
      };
      if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
      G._aiWeakWriteHints.push(hint);
      if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
      try {
        if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_hint", hint);
      } catch (_) {
      }
      return true;
    }
    function _tmWeakEntityHint(label, reason, item, resolution) {
      if (Array.isArray(_tmPreflightCollector)) return _tmGateReason(label, reason, item, "entity-reference-not-found");
      _tmPushAIWeakHint(label, reason, item, resolution);
      return true;
    }
    function _tmReferencesPendingFaction(aiOutput, ref) {
      var raw = String(ref == null ? "" : ref).trim();
      if (!raw) return false;
      return (Array.isArray(aiOutput && aiOutput.faction_create) ? aiOutput.faction_create : []).some(function(item) {
        return item && [item.id, item.factionId, item.name].some(function(value) {
          return value != null && String(value).trim() === raw;
        });
      });
    }
    function _faNormTargetForGate(t) {
      var s = String(t == null ? "" : t).trim();
      if (/^(太仓|太仓库|国库|户部库|外库|公帑|公库|guoku|taicang|taicangku)$/i.test(s)) return "guoku";
      if (/^(内帑|内库|内承运库|私帑|帝室库|御库|neitang|neicang)$/i.test(s)) return "neitang";
      if (/^(province|省|布政使司)\s*[:：]/i.test(s)) return "province:" + s.replace(/^(province|省|布政使司)\s*[:：]\s*/i, "");
      if (s === "guoku" || s === "neitang" || /^province:/.test(s)) return s;
      return "";
    }
    function _faNormKindForGate(k) {
      var s = String(k == null ? "" : k).trim();
      if (/^(income|收入|进项|增收|入项)$/i.test(s)) return "income";
      if (/^(expense|expenditure|支出|开支|耗费|拨支|出项)$/i.test(s)) return "expense";
      return s === "income" || s === "expense" ? s : "";
    }
    function preflightAIWriteBack(aiOutput, opts) {
      var G = global.GM;
      if (!G || !aiOutput || typeof aiOutput !== "object") return aiOutput;
      opts = opts || {};
      var blocked = 0;
      function keepArray(field, label, fn) {
        if (!Array.isArray(aiOutput[field])) return;
        var kept = [];
        aiOutput[field].forEach(function(item, index) {
          var previousContext = _tmPreflightContext;
          _tmPreflightContext = { field, label, index };
          try {
            if (fn(item)) kept.push(item);
            else blocked++;
          } finally {
            _tmPreflightContext = previousContext;
          }
        });
        aiOutput[field] = kept;
      }
      function canonicalLeaderFields(item, fields, outputField, label) {
        if (!item || typeof item !== "object") return { present: false, ok: true };
        var present = fields.filter(function(key) {
          return Object.prototype.hasOwnProperty.call(item, key);
        });
        if (!present.length) return { present: false, ok: true };
        var refs = present.map(function(key) {
          return String(item[key] == null ? "" : item[key]).trim();
        });
        if (refs.every(function(ref) {
          return !ref;
        })) {
          present.forEach(function(key) {
            delete item[key];
          });
          item[outputField] = "";
          return { present: true, ok: true, name: "" };
        }
        var resolved = refs.map(function(ref) {
          return ref ? _strictLivingChar(G, ref) : null;
        });
        if (resolved.some(function(ch) {
          return !ch;
        })) {
          _tmGateReason(label, "leader/head must resolve exactly to a living active character", item);
          return { present: true, ok: false };
        }
        var first = resolved[0];
        if (resolved.some(function(ch) {
          return ch !== first;
        })) {
          _tmGateReason(label, "conflicting leader/head mirrors", item);
          return { present: true, ok: false };
        }
        present.forEach(function(key) {
          delete item[key];
        });
        item[outputField] = first.name || refs[0];
        return { present: true, ok: true, name: item[outputField] };
      }
      keepArray("character_deaths", "character_deaths", function(d) {
        if (!d || !d.name) return _tmGateReason("character_deaths", "missing name", d);
        var rawDeathName = String(d.name).trim();
        var ch = (G.chars || []).find(function(c) {
          return c && (c.name != null && String(c.name).trim() === rawDeathName || c.id != null && String(c.id).trim() === rawDeathName);
        });
        if (!ch) return _tmGateReason("character_deaths", "death target not in active roster: " + d.name, d);
        if (ch.alive === false || ch.dead === true) return _tmGateReason("character_deaths", "char already dead: " + d.name, d);
        var deathReason = d.reason || d.cause || d.deathReason;
        if (!deathReason) return _tmGateReason("character_deaths", "missing cause/reason: " + d.name, d);
        d.name = ch.name || rawDeathName;
        if (!d.reason) d.reason = String(deathReason);
        try {
          var _c1bkt = validators;
          var _c1classify = _c1bkt && _c1bkt._classifyStructuredDeathKind;
          var _c1sourced = _c1bkt && _c1bkt._narrativeDeathSourced;
          if (_c1classify && _c1sourced && _c1classify(d.reason) === "bare" && !_c1sourced(G, aiOutput, ch, { excludeStructuredKey: "character_deaths" })) {
            console.warn("[preflight/character_deaths] 无源孤立结构化死亡·不落库(疑 AI 史实幻觉·转弱自查纸条留痕): " + d.name + " ← 「" + String(d.reason).slice(0, 40) + "」");
            return _tmGateReason("character_deaths", "无源孤立结构化死亡(疑史实幻觉·bare 死因无任何源头): " + d.name + "·死因「" + String(d.reason).slice(0, 30) + "」", d);
          }
        } catch (_c1e) {
        }
        return true;
      });
      keepArray("faction_create", "faction_create", function(fc) {
        if (!fc || !fc.name) return _tmGateReason("faction_create", "missing name", fc);
        var fcRes = _tmResolveFaction(G, fc.name);
        if (fcRes && fcRes.active) return _tmGateReason("faction_create", "duplicate active faction: " + fc.name, fc);
        if (fcRes && !fcRes.active) _tmPushAIWeakHint("faction_create", "faction name seems known outside active roster: " + fc.name, fc, fcRes);
        if (!(fc.reason || fc.triggerEvent || fc.origin || fc.parentFaction)) return _tmGateReason("faction_create", "missing reason/trigger: " + fc.name, fc);
        if (!canonicalLeaderFields(fc, ["leader", "head", "newLeader", "new_leader", "leaderName", "leader_name", "ruler"], "leader", "faction_create").ok) return false;
        return true;
      });
      keepArray("party_create", "party_create", function(pc) {
        if (!pc || !pc.name) return _tmGateReason("party_create", "missing name", pc);
        if ((G.parties || []).some(function(p) {
          return p && p.name === pc.name;
        })) return _tmGateReason("party_create", "duplicate active party: " + pc.name, pc);
        if (!canonicalLeaderFields(pc, ["leader", "head", "newLeader", "new_leader", "leaderName", "leader_name", "ruler"], "leader", "party_create").ok) return false;
        return true;
      });
      keepArray("party_splinter", "party_splinter", function(sp) {
        if (!sp || !sp.parent || !sp.newName) return _tmGateReason("party_splinter", "missing parent/newName", sp);
        if (!(G.parties || []).some(function(p) {
          return p && p.name === sp.parent;
        })) return _tmGateReason("party_splinter", "parent party not active: " + sp.parent, sp);
        if (!canonicalLeaderFields(sp, ["newLeader", "new_leader", "leader", "head", "leaderName", "leader_name", "ruler"], "newLeader", "party_splinter").ok) return false;
        return true;
      });
      (Array.isArray(aiOutput.faction_events) ? aiOutput.faction_events : []).forEach(function(fe) {
        var gate = canonicalLeaderFields(fe, ["newLeader", "new_leader", "leader", "head", "leaderName", "leader_name", "ruler"], "newLeader", "faction_events");
        if (gate.present && !gate.ok) blocked++;
      });
      (Array.isArray(aiOutput.party_changes) ? aiOutput.party_changes : []).forEach(function(pc) {
        var gate = canonicalLeaderFields(pc, ["new_leader", "newLeader", "leader", "head", "leaderName", "leader_name", "ruler"], "new_leader", "party_changes");
        if (gate.present && !gate.ok) blocked++;
      });
      (Array.isArray(aiOutput.party_updates) ? aiOutput.party_updates : []).forEach(function(pu) {
        if (!pu || !pu.updates || typeof pu.updates !== "object" || Array.isArray(pu.updates)) return;
        var gate = canonicalLeaderFields(pu.updates, ["leader", "head", "newLeader", "new_leader", "leaderName", "leader_name", "ruler"], "leader", "party_updates");
        if (gate.present && !gate.ok) blocked++;
      });
      keepArray("faction_succession", "faction_succession", function(sc) {
        var factionRef = sc && (sc.factionId || sc.faction);
        var leaderRef = sc && (sc.newLeaderId || sc.newLeader);
        if (!sc || !factionRef || !leaderRef) return _tmGateReason(
          "faction_succession",
          "missing factionId/faction or newLeaderId/newLeader",
          sc,
          "missing-required-field",
          ["factionId", "faction", "newLeaderId", "newLeader"]
        );
        if (_tmReferencesPendingFaction(aiOutput, factionRef)) return _tmGateReason("faction_succession", "faction succession executes before faction_create; defer it to a later turn", sc, "batch-dependency-order-unsupported");
        var facResult = _tmResolveStableOrUniqueIdentity(G.facs || [], sc.factionId, sc.faction);
        if (!facResult.entity) return _tmGateReason(
          "faction_succession",
          "faction identity rejected: " + factionRef,
          sc,
          facResult.code === "ambiguous-reference" ? "ambiguous-reference" : "faction-not-found",
          ["factionId", "faction"]
        );
        var fac = facResult.entity;
        if (fac.id == null || !String(fac.id).trim()) return _tmGateReason("faction_succession", "faction has no stable id: " + factionRef, sc, "stable-id-missing", ["factionId", "faction"]);
        var leaderResult = _tmResolveStableOrUniqueIdentity(G.chars || [], sc.newLeaderId, sc.newLeader);
        if (!leaderResult.entity) return _tmGateReason(
          "faction_succession",
          "newLeader identity rejected: " + leaderRef,
          sc,
          leaderResult.code === "ambiguous-reference" ? "ambiguous-reference" : "character-not-found",
          ["newLeaderId", "newLeader"]
        );
        var leader = leaderResult.entity;
        if (leader.id == null || !String(leader.id).trim()) return _tmGateReason("faction_succession", "newLeader has no stable id: " + leaderRef, sc, "stable-id-missing", ["newLeaderId", "newLeader"]);
        if (leader.alive === false || leader.dead === true) return _tmGateReason("faction_succession", "newLeader is dead: " + leaderRef, sc);
        Object.assign(sc, {
          factionId: String(fac.id),
          faction: String(fac.name || fac.id),
          newLeaderId: String(leader.id),
          newLeader: String(leader.name || leader.id)
        });
        return true;
      });
      keepArray("faction_dissolve", "faction_dissolve", function(fd) {
        if (!fd || !fd.name) return _tmGateReason("faction_dissolve", "missing name", fd);
        if (_tmReferencesPendingFaction(aiOutput, fd.factionId || fd.id || fd.name)) return _tmGateReason("faction_dissolve", "faction dissolve executes before faction_create; contradictory same-batch lifecycle", fd, "batch-dependency-order-unsupported");
        var facRes = _tmResolveFaction(G, fd.name);
        if (!facRes) return _tmWeakEntityHint("faction_dissolve", "faction seems not in current known lists: " + fd.name, fd, facRes);
        var fac = facRes.entity;
        if (!facRes.active) _tmPushAIWeakHint("faction_dissolve", "faction seems known but not active: " + fd.name, fd, facRes);
        if (fac.isPlayer) return _tmGateReason("faction_dissolve", "player faction cannot dissolve: " + fd.name, fd);
        if (!(fd.cause || fd.reason)) return _tmGateReason("faction_dissolve", "missing cause/reason: " + fd.name, fd);
        if ((fd.cause === "conquered" || fd.cause === "absorbed") && fd.conqueror) {
          var conquerorRes = _tmResolveFaction(G, fd.conqueror);
          if (!conquerorRes) return _tmWeakEntityHint("faction_dissolve", "conqueror seems not in current known lists: " + fd.conqueror, fd, conquerorRes);
          if (!conquerorRes.active) _tmPushAIWeakHint("faction_dissolve", "conqueror seems known but not active: " + fd.conqueror, fd, conquerorRes);
        }
        return true;
      });
      keepArray("office_assignments", "office_assignments", function(oa) {
        if (!oa || !oa.name) return _tmGateReason("office_assignments", "missing name", oa);
        var oaRes = _tmResolveChar(G, oa.name);
        if (!oaRes) return _tmWeakEntityHint("office_assignments", "char seems not in current known lists: " + oa.name, oa, oaRes);
        if (!oaRes.active) _tmPushAIWeakHint("office_assignments", "char seems known but not active roster: " + oa.name, oa, oaRes);
        var action = String(oa.action || "appoint").toLowerCase();
        if (/兼/.test(String(oa.action || ""))) action = "appoint";
        if (action === "concurrent") action = "appoint";
        if ((action === "appoint" || action === "transfer") && !oa.post) return _tmGateReason("office_assignments", "missing post: " + oa.name, oa);
        return true;
      });
      keepArray("fiscal_adjustments", "fiscal_adjustments", function(fa) {
        if (!fa || !fa.target || !fa.kind) return _tmGateReason("fiscal_adjustments", "missing target/kind", fa);
        var _gateKind = _faNormKindForGate(fa.kind);
        if (_gateKind !== "income" && _gateKind !== "expense") return _tmGateReason("fiscal_adjustments", "invalid kind: " + fa.kind, fa);
        var fiscalAction = String(fa.action || fa.op || "add").toLowerCase();
        if (fiscalAction === "modify" || fiscalAction === "set") fiscalAction = "update";
        if (fiscalAction === "delete" || fiscalAction === "disable" || fiscalAction === "cancel") fiscalAction = "stop";
        if (fiscalAction !== "stop" && fiscalAction !== "remove" && !(parseFloat(fa.amount) > 0)) return _tmGateReason("fiscal_adjustments", "invalid amount", fa);
        if (!_faNormTargetForGate(fa.target)) {
          return _tmGateReason("fiscal_adjustments", "invalid target: " + fa.target, fa);
        }
        return true;
      });
      if (aiOutput.battleResult) {
        var br = aiOutput.battleResult;
        var winnerRef = br.winnerFactionId || br.winnerFaction || br.winner;
        var loserRef = br.loserFactionId || br.loserFaction || br.loser;
        if (!winnerRef || !loserRef) {
          _tmGateReason("battleResult", "missing winner/loser faction reference", br);
          delete aiOutput.battleResult;
          blocked++;
        } else if (_tmReferencesPendingFaction(aiOutput, winnerRef) || _tmReferencesPendingFaction(aiOutput, loserRef)) {
          _tmGateReason("battleResult", "battleResult executes before faction_create; defer battles involving a newly created faction", br, "batch-dependency-order-unsupported");
          delete aiOutput.battleResult;
          blocked++;
        } else {
          var battleFailures = Array.isArray(_tmPreflightCollector) ? _tmPreflightCollector : [];
          var winner = _tmStrictIdentity(G.facs, winnerRef, "faction", "battleResult", null, battleFailures, {
            identityFields: ["winnerFactionId", "winnerFaction", "winner"]
          });
          var loser = _tmStrictIdentity(G.facs, loserRef, "faction", "battleResult", null, battleFailures, {
            identityFields: ["loserFactionId", "loserFaction", "loser"]
          });
          if (!winner || !loser || winner === loser) {
            if (winner && loser && winner === loser) {
              var sameFailure = { field: "battleResult", index: null, code: "battle-factions-identical", target: String(winner.id || winner.name || ""), retryable: false, reason: "battle winner and loser must be different factions", item: br };
              if (Array.isArray(_tmPreflightCollector)) _tmPreflightCollector.push(sameFailure);
              else _tmGateReason("battleResult", sameFailure.reason, br, sameFailure.code);
            } else if (!Array.isArray(_tmPreflightCollector)) {
              _tmGateReason("battleResult", "winner/loser faction must resolve uniquely in the current world", br, "faction-not-found");
            }
            delete aiOutput.battleResult;
            blocked++;
          } else {
            br.winnerFactionId = String(winner.id || winner.name || winnerRef);
            br.loserFactionId = String(loser.id || loser.name || loserRef);
            br.winnerFaction = String(winner.name || winner.id || winnerRef);
            br.loserFaction = String(loser.name || loser.id || loserRef);
          }
        }
      }
      if (blocked > 0) {
        try {
          if (typeof global.recordAIDiagnostic === "function") global.recordAIDiagnostic("write_gate_summary", { blocked, source: opts.source || "" });
        } catch (_) {
        }
      }
      return aiOutput;
    }
    function _tmCloneWriteback(value, seen) {
      if (value == null || typeof value !== "object") return value;
      seen = seen || (typeof WeakMap === "function" ? /* @__PURE__ */ new WeakMap() : null);
      if (seen && seen.has(value)) return seen.get(value);
      var out = Array.isArray(value) ? [] : {};
      if (seen) seen.set(value, out);
      Object.keys(value).forEach(function(key) {
        out[key] = _tmCloneWriteback(value[key], seen);
      });
      return out;
    }
    function _tmStrictIdentity(rows, ref, kind, field, index, failures, opts) {
      opts = opts || {};
      function fail(payload) {
        if (Array.isArray(opts.identityFields) && opts.identityFields.length) payload.identityFields = opts.identityFields.slice();
        failures.push(payload);
      }
      var raw = String(ref == null ? "" : ref).trim();
      if (!raw) {
        fail({ field, index, code: "missing-required-field", target: "", retryable: true, reason: kind + " reference is missing" });
        return null;
      }
      if (!Array.isArray(rows)) {
        fail({ field, index, code: kind + "-collection-unavailable", target: raw, retryable: false, reason: kind + " collection is unavailable" });
        return null;
      }
      var byId = rows.filter(function(row) {
        return row && row.id != null && String(row.id).trim() === raw;
      });
      if (byId.length === 1) return byId[0];
      if (byId.length > 1) {
        fail({ field, index, code: "ambiguous-reference", target: raw, retryable: true, reason: kind + " id is not unique" });
        return null;
      }
      var byName = rows.filter(function(row) {
        return row && row.name != null && String(row.name).trim() === raw;
      });
      if (byName.length === 1) return byName[0];
      fail({
        field,
        index,
        code: byName.length > 1 ? "ambiguous-reference" : kind + "-not-found",
        target: raw,
        retryable: true,
        reason: byName.length > 1 ? kind + " name is ambiguous; use stable id" : kind + " is not in the current world"
      });
      return null;
    }
    function _tmWalkOfficeNodes(nodes, out) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(function(node) {
        if (!node || typeof node !== "object") return;
        out.push(node);
        if (Array.isArray(node.subs)) _tmWalkOfficeNodes(node.subs, out);
        if (Array.isArray(node.children)) _tmWalkOfficeNodes(node.children, out);
        if (Array.isArray(node.positions)) _tmWalkOfficeNodes(node.positions, out);
      });
    }
    function _tmStrictOfficeExists(G, ref) {
      var raw = String(ref == null ? "" : ref).trim();
      if (!raw) return false;
      var nodes = [];
      _tmWalkOfficeNodes(G && G.officeTree, nodes);
      return nodes.some(function(node) {
        return [node.id, node.name, node.title, node.position, node.officialTitle].some(function(value) {
          return value != null && String(value).trim() === raw;
        });
      });
    }
    function _tmStrictRegionRows(G) {
      var rows = [];
      var seen = [];
      function add(row) {
        if (!row || typeof row !== "object" || seen.indexOf(row) >= 0) return;
        seen.push(row);
        rows.push(row);
        if (Array.isArray(row.children)) row.children.forEach(add);
        if (Array.isArray(row.subs)) row.subs.forEach(add);
        if (Array.isArray(row.divisions)) row.divisions.forEach(add);
      }
      var map = G && (G.mapData || G.map);
      if (map && Array.isArray(map.regions)) map.regions.forEach(add);
      if (G && G.regionMap && typeof G.regionMap === "object") Object.keys(G.regionMap).forEach(function(key) {
        add(G.regionMap[key]);
      });
      if (G && G.adminHierarchy && typeof G.adminHierarchy === "object") Object.keys(G.adminHierarchy).forEach(function(key) {
        add(G.adminHierarchy[key]);
      });
      return rows;
    }
    function _tmValidateFiniteFields(root, path, failures, seen) {
      if (!root || typeof root !== "object") return;
      seen = seen || (typeof WeakSet === "function" ? /* @__PURE__ */ new WeakSet() : null);
      if (seen && seen.has(root)) return;
      if (seen) seen.add(root);
      Object.keys(root).forEach(function(key) {
        var value = root[key];
        var nextPath = path ? path + "." + key : key;
        if (typeof value === "number" && !Number.isFinite(value)) {
          failures.push({ field: nextPath, index: null, code: "invalid-numeric-value", target: nextPath, retryable: true, reason: "numeric writeback value must be finite" });
        } else if (value && typeof value === "object") {
          _tmValidateFiniteFields(value, nextPath, failures, seen);
        }
      });
    }
    function validateAIWriteBackBatch(aiOutput, opts) {
      opts = opts || {};
      var G = global.GM;
      var failures = [];
      if (!G || typeof G !== "object" || !aiOutput || typeof aiOutput !== "object" || Array.isArray(aiOutput)) {
        return { ok: false, output: null, failures: [{ field: "", index: null, code: "invalid-writeback-batch", target: "", retryable: false, reason: "GM and AI writeback must be objects" }] };
      }
      var detached = _tmCloneWriteback(aiOutput);
      var previousCollector = _tmPreflightCollector;
      var previousSideEffects = _tmPreflightSideEffects;
      var previousContext = _tmPreflightContext;
      _tmPreflightCollector = failures;
      _tmPreflightSideEffects = false;
      _tmPreflightContext = null;
      try {
        var deathNormalization = normalizeAIWriteBackDeaths(detached, { source: opts.source || "strict-preflight", deferDeaths: true });
        (deathNormalization.failed || []).forEach(function(failure, index) {
          failures.push({ field: "char_updates", index, code: "invalid-character-death", target: failure.char_update || "", retryable: true, reason: failure.reason || "invalid character death" });
        });
        preflightAIWriteBack(detached, { source: opts.source || "strict-preflight" });
      } finally {
        _tmPreflightCollector = previousCollector;
        _tmPreflightSideEffects = previousSideEffects;
        _tmPreflightContext = previousContext;
      }
      function validateRefs(field, rows, kind, refOf, extra) {
        (Array.isArray(detached[field]) ? detached[field] : []).forEach(function(item, index) {
          var ref = refOf(item || {});
          var entity = _tmStrictIdentity(rows, ref, kind, field, index, failures);
          if (entity && extra) extra(item, entity, index);
        });
      }
      validateRefs("appointments", G.chars, "character", function(item) {
        return item.characterId || item.charId || item.charName;
      }, function(item, entity, index) {
        if (entity.alive === false || entity.dead === true) failures.push({ field: "appointments", index, code: "target-not-living", target: entity.id || entity.name, retryable: true, reason: "appointment target is not living" });
        var action = String(item.action || "").toLowerCase();
        var post = action === "transfer" ? item.toPosition : item.position;
        if ((action === "appoint" || action === "transfer") && !_tmStrictOfficeExists(G, post)) failures.push({ field: "appointments", index, code: "office-not-found", target: post || "", retryable: true, reason: "office position is not declared in current office tree" });
      });
      validateRefs("char_updates", G.chars, "character", function(item) {
        return item.characterId || item.charId || item.name;
      });
      validateRefs("office_assignments", G.chars, "character", function(item) {
        return item.characterId || item.charId || item.name;
      }, function(item, entity, index) {
        var action = String(item.action || "appoint").toLowerCase();
        if ((action === "appoint" || action === "transfer" || action === "concurrent") && !_tmStrictOfficeExists(G, item.post)) failures.push({ field: "office_assignments", index, code: "office-not-found", target: item.post || "", retryable: true, reason: "office position is not declared in current office tree" });
      });
      validateRefs("personnel_changes", G.chars, "character", function(item) {
        return item.characterId || item.charId || item.name;
      });
      (Array.isArray(detached.faction_updates) ? detached.faction_updates : []).forEach(function(item, index) {
        var ref = item && (item.factionId || item.id || item.name);
        if (_tmReferencesPendingFaction(detached, ref)) {
          failures.push({
            field: "faction_updates",
            index,
            code: "batch-dependency-order-unsupported",
            target: String(ref || ""),
            retryable: false,
            reason: "faction_updates execute before faction_create; put initial fields in faction_create or defer the update",
            item
          });
          return;
        }
        _tmStrictIdentity(G.facs, ref, "faction", "faction_updates", index, failures);
      });
      validateRefs("faction_dissolve", G.facs, "faction", function(item) {
        return item.factionId || item.id || item.name;
      });
      var regionRows = _tmStrictRegionRows(G);
      ["region_updates", "population_adjustments", "central_local_actions", "environment_actions"].forEach(function(field) {
        (Array.isArray(detached[field]) ? detached[field] : []).forEach(function(item, index) {
          var ref = item && (item.regionId || item.region_id || item.region || item.targetRegion || item.target);
          if (ref) _tmStrictIdentity(regionRows, ref, "region", field, index, failures);
        });
      });
      _tmValidateFiniteFields(detached, "", failures);
      var unique = [];
      var seenFailures = /* @__PURE__ */ Object.create(null);
      failures.forEach(function(failure) {
        var key = [failure.field, failure.index, failure.code, failure.target, failure.reason].join("|");
        if (!seenFailures[key]) {
          seenFailures[key] = true;
          unique.push(failure);
        }
      });
      return { ok: unique.length === 0, output: detached, failures: unique };
    }
    function _applyBattleResult(G, aiOutput, applied) {
      if (!G || !aiOutput || !aiOutput.battleResult) return;
      var api = global.MilitarySystems || global.TM && global.TM.MilitarySystems;
      if (!api || typeof api.applyBattleResult !== "function") {
        if (applied && applied.failed) applied.failed.push({ battleResult: true, reason: "MilitarySystems missing" });
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
          type: "battleResult",
          battleId: r.result && r.result.battleId,
          winner: r.result && r.result.winner,
          loser: r.result && r.result.loser,
          turn: G.turn || 0
        });
        try {
          var _cfBR = aiOutput.battleResult.commanderFate;
          if (_cfBR && _cfBR.name && /败|挫|溃|defeat|rout|擒|俘|captur|surrender|降|逃|escap|伤|wound/i.test(String(_cfBR.outcome || ""))) {
            var _cfChBR = (G.chars || []).find(function(c) {
              return c && c.name === _cfBR.name;
            });
            if (_cfChBR && _cfChBR.alive !== false) {
              _cfChBR._defeatTurn = G.turn || 0;
              _cfChBR._defeatReason = String(_cfBR.outcome || "战败");
            }
          }
        } catch (_dfBR) {
        }
        try {
          var _AE5TK = global.AuthorityEngines || global.TM && global.TM.AuthorityEngines;
          if (_AE5TK && typeof _AE5TK.adjustHuangwei === "function") {
            var _winId5TK = String(aiOutput.battleResult.winnerFactionId || aiOutput.battleResult.winnerFaction || aiOutput.battleResult.winner || r.result && r.result.winner || "").trim();
            var _winFac5TK = _winId5TK ? (G.facs || []).find(function(f) {
              return f && (f.name === _winId5TK || f.id === _winId5TK);
            }) : null;
            var _P5TK = typeof window !== "undefined" && window.P || typeof global !== "undefined" && global.P || null;
            var _pName5TK = _P5TK && _P5TK.playerInfo && _P5TK.playerInfo.factionName || "";
            var _isPlayerWin5TK = !!(_winFac5TK && _winFac5TK.isPlayer) || !!_pName5TK && _winId5TK === _pName5TK;
            if (_isPlayerWin5TK) {
              var P5TK_HW_WIN_BASE = 2;
              var P5TK_HW_WIN_CAP = 8;
              var _aiHw5TK = Number(aiOutput.battleResult.huangweiDelta);
              var _hwGain5TK = isFinite(_aiHw5TK) && _aiHw5TK > 0 ? Math.min(_aiHw5TK, P5TK_HW_WIN_CAP) : P5TK_HW_WIN_BASE;
              if (_hwGain5TK > 0) {
                var _hwR5TK = _AE5TK.adjustHuangwei("militaryVictory", _hwGain5TK, "玩家方军胜·" + _winId5TK + "（P-5TK 军功接皇威）");
                if (applied) {
                  if (!applied.semantic) applied.semantic = {};
                  applied.semantic.huangweiMilitaryVictory = _hwR5TK && _hwR5TK.delta || _hwGain5TK;
                }
              }
            }
          }
        } catch (_e5TK) {
        }
      } else if (applied && applied.failed) {
        applied.failed.push({ battleResult: true, reason: r && r.reason });
      }
    }
    function _deficitTier(amount, scaleMoney) {
      var deep = Math.abs(amount);
      var pct = deep / Math.max(1, scaleMoney);
      if (pct < 0.1) return { tier: 1, label: "微亏", mult: 1 };
      if (pct < 0.3) return { tier: 2, label: "告急", mult: 2 };
      if (pct < 0.8) return { tier: 3, label: "空虚", mult: 4 };
      if (pct < 2) return { tier: 4, label: "债台高筑", mult: 7 };
      return { tier: 5, label: "民穷财尽", mult: 12 };
    }
    function _applyFiscalDeficitPenalties(G) {
      if (!G) return;
      var pens = [];
      var monthIn = G.guoku && (G.guoku.monthlyIncome || G.guoku.turnIncome) || 1e5;
      var scaleMoney = Math.max(1e5, monthIn * 12);
      var scaleGrain = Math.max(5e4, (G.guoku && G.guoku.monthlyGrainIncome || 1e4) * 12);
      var scaleCloth = Math.max(2e4, (G.guoku && G.guoku.monthlyClothIncome || 5e3) * 12);
      function checkTreasury(targetName, targetObj) {
        if (!targetObj) return;
        var checks = [
          { res: "money", scale: scaleMoney, label: "银" },
          { res: "grain", scale: scaleGrain, label: "粮" },
          { res: "cloth", scale: scaleCloth, label: "布" }
        ];
        checks.forEach(function(ck) {
          var v = Number(targetObj[ck.res]);
          if (typeof v !== "number" || isNaN(v) || v >= 0) return;
          var t = _deficitTier(v, ck.scale);
          pens.push({ target: targetName, resource: ck.res, label: ck.label, tier: t.tier, tierLabel: t.label, amount: v, mult: t.mult });
        });
      }
      checkTreasury("guoku", G.guoku);
      checkTreasury("neitang", G.neitang);
      if (pens.length === 0) return;
      var totalMult = 0;
      pens.forEach(function(p) {
        totalMult += p.mult;
      });
      totalMult = Math.min(totalMult, 36);
      if (!G._huangweiState) G._huangweiState = { index: 70 };
      var hwPenalty = Math.round(totalMult * 0.25);
      G._huangweiState.index = Math.max(0, (Number(G._huangweiState.index) || 70) - hwPenalty);
      if (!G._minxinState) G._minxinState = { index: 60 };
      var mxPenalty = Math.round(totalMult * 0.3);
      G._minxinState.index = Math.max(0, (Number(G._minxinState.index) || 60) - mxPenalty);
      G.unrest = Math.min(100, (Number(G.unrest) || 0) + Math.round(totalMult * 0.4));
      if (G._corruptionState) {
        G._corruptionState.index = Math.min(100, (Number(G._corruptionState.index) || 0) + Math.round(totalMult * 0.15));
      }
      if (pens.some(function(p) {
        return p.tier >= 3;
      }) && Array.isArray(G.chars)) {
        G.chars.forEach(function(c) {
          if (!c || c.alive === false) return;
          var isMilitary = (c.military || 0) > 60 || /\u519B|\u5C06|\u5E05|\u53F2/.test(c.officialTitle || "");
          if (isMilitary && typeof c.loyalty === "number") {
            if (typeof global.adjustCharacterLoyalty === "function") {
              global.adjustCharacterLoyalty(c, -Math.round(totalMult * 0.08), "国用窘迫导致军心动摇", { source: "resource-deficit-military-loyalty", oncePerTurn: true });
            } else {
              c.loyalty = Math.max(0, c.loyalty - Math.round(totalMult * 0.08));
            }
          }
        });
      }
      var grainDef = pens.find(function(p) {
        return p.resource === "grain" && p.tier >= 2;
      });
      if (grainDef && G.population && G.population.national) {
        var fugitives = Math.round((G.population.national.mouths || 0) * 2e-3 * grainDef.mult);
        G.population.fugitives = (Number(G.population.fugitives) || 0) + fugitives;
        G.population.national.mouths = Math.max(0, (G.population.national.mouths || 0) - fugitives);
      }
      if (!G._turnReport) G._turnReport = [];
      G._turnReport.push({
        type: "fiscal_deficit",
        penalties: pens,
        totalMult,
        appliedTo: { huangwei: -hwPenalty, minxin: -mxPenalty, unrest: Math.round(totalMult * 0.4), corruption: Math.round(totalMult * 0.15) },
        turn: G.turn || 0
      });
      if (!G._fiscalDeficitStreak) G._fiscalDeficitStreak = 0;
      G._fiscalDeficitStreak++;
      if (G._fiscalDeficitStreak >= 3) {
        if (typeof global.addEB === "function") global.addEB("财政❗❗", "赌空继续 " + G._fiscalDeficitStreak + " 回合！皇威 -" + hwPenalty + " 民心 -" + mxPenalty + " 动乱+" + Math.round(totalMult * 0.4));
      } else {
        if (typeof global.addEB === "function") global.addEB("财政❗", "国庪赤字！" + pens.map(function(p) {
          return p.label + p.tierLabel;
        }).join("、") + " → 皇威-" + hwPenalty + " 民心-" + mxPenalty);
      }
    }
    function _resetDeficitStreakIfHealthy(G) {
      if (!G) return;
      var anyDef = false;
      ["money", "grain", "cloth"].forEach(function(r) {
        if (G.guoku && (Number(G.guoku[r]) || 0) < 0) anyDef = true;
        if (G.neitang && (Number(G.neitang[r]) || 0) < 0) anyDef = true;
      });
      if (!anyDef) G._fiscalDeficitStreak = 0;
    }
    var _AI_VALIDATOR_LOG_KEYS = [
      "_fiscalValidatorLog",
      "_personnelValidatorLog",
      "_militaryValidatorLog",
      "_sentimentValidatorLog",
      "_populationValidatorLog",
      "_officeValidatorLog",
      "_warValidatorLog",
      "_revoltValidatorLog",
      "_disasterValidatorLog",
      "_diplomacyValidatorLog",
      "_kejuValidatorLog",
      "_partyValidatorLog",
      "_edictEffectValidatorLog",
      "_courtCeremonyValidatorLog",
      "_constructionValidatorLog",
      "_omenValidatorLog",
      "_marriageBirthValidatorLog",
      "_conspiracyValidatorLog",
      "_currencyValidatorLog",
      "_religionValidatorLog"
    ];
    function _captureValidatorBaseline(G) {
      var out = {};
      _AI_VALIDATOR_LOG_KEYS.forEach(function(key) {
        out[key] = Array.isArray(G && G[key]) ? G[key].length : 0;
      });
      return out;
    }
    function _collectValidatorFailures(G, baseline) {
      var failures = [];
      _AI_VALIDATOR_LOG_KEYS.forEach(function(key) {
        var rows = Array.isArray(G && G[key]) ? G[key].slice(baseline[key] || 0) : [];
        rows.forEach(function(row) {
          if (!row || Number(row.turn || 0) !== Number(G && G.turn || 0)) return;
          var details = [];
          ["warnings", "missing", "skipped", "errors"].forEach(function(field) {
            if (Array.isArray(row[field]) && row[field].length) details = details.concat(row[field]);
          });
          if (details.length) failures.push({ validator: key, reason: "consistency validation failed", details: details.slice(0, 8) });
        });
      });
      return failures;
    }
    function _runConsistencyValidator(applied, aiOutput, name, fn) {
      try {
        fn();
        return true;
      } catch (error) {
        var message = String(error && (error.message || error) || "validator exception");
        if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(error, "applier] " + name + " validator:");
        else console.warn("[applier] " + name + " validator:", error);
        if (aiOutput && aiOutput._strictValidation === true) {
          if (!Array.isArray(applied.failed)) applied.failed = [];
          applied.failed.push({ validator: name, reason: "validator exception", details: [message] });
        }
        return false;
      }
    }
    function _refreshAIIndices(G, P0) {
      try {
        if (typeof global.buildIndices === "function") global.buildIndices();
        else if (global.TM && global.TM.Indices && typeof global.TM.Indices.invalidate === "function") global.TM.Indices.invalidate(G, P0);
      } catch (_) {
        try {
          if (global.TM && global.TM.Indices && typeof global.TM.Indices.invalidate === "function") global.TM.Indices.invalidate(G, P0);
        } catch (_2) {
        }
      }
    }
    function _captureAIStateObject(obj, runtimeKeys) {
      var data = typeof global.deepClone === "function" ? global.deepClone(obj) : JSON.parse(JSON.stringify(obj));
      var descriptors = {};
      Object.getOwnPropertyNames(obj || {}).forEach(function(key) {
        var d = Object.getOwnPropertyDescriptor(obj, key);
        if (!d) return;
        if (key === "_indices") {
          try {
            delete data[key];
          } catch (_) {
          }
          return;
        }
        if (runtimeKeys && runtimeKeys.indexOf(key) >= 0 || d.get || d.set || Object.prototype.hasOwnProperty.call(d, "value") && typeof d.value === "function" || !Object.prototype.hasOwnProperty.call(data, key)) {
          descriptors[key] = d;
          try {
            delete data[key];
          } catch (_) {
          }
        }
      });
      return { data, descriptors };
    }
    function _restoreAIStateObject(target, snapshot) {
      Object.getOwnPropertyNames(target || {}).forEach(function(key) {
        try {
          delete target[key];
        } catch (_) {
        }
      });
      Object.keys(snapshot.data || {}).forEach(function(key) {
        target[key] = snapshot.data[key];
      });
      Object.keys(snapshot.descriptors || {}).forEach(function(key) {
        try {
          Object.defineProperty(target, key, snapshot.descriptors[key]);
        } catch (_) {
          if (Object.prototype.hasOwnProperty.call(snapshot.descriptors[key], "value")) target[key] = snapshot.descriptors[key].value;
        }
      });
    }
    function _validateAIResultState(G) {
      var failures = [];
      if (!G || typeof G !== "object" || Array.isArray(G)) failures.push({ reason: "GM must remain an object" });
      ["chars", "facs", "armies"].forEach(function(key) {
        if (G && Object.prototype.hasOwnProperty.call(G, key) && !Array.isArray(G[key])) failures.push({ path: key, reason: key + " must remain an array" });
      });
      ["guoku", "neitang"].forEach(function(key) {
        var box = G && G[key];
        if (!box) return;
        ["money", "grain", "cloth"].forEach(function(res) {
          if (Object.prototype.hasOwnProperty.call(box, res) && (typeof box[res] !== "number" || !isFinite(box[res]))) {
            failures.push({ path: key + "." + res, reason: "fiscal scalar must be finite" });
          }
        });
      });
      return failures;
    }
    function applyAITurnChangesAtomic(aiOutput) {
      var G = global.GM;
      var P0 = global.P;
      if (!G || !aiOutput || typeof aiOutput !== "object") return { ok: false, applied: { failed: [{ reason: "invalid GM/AI output" }] } };
      if (aiOutput._strictValidation === true) {
        var strictPreflight = validateAIWriteBackBatch(aiOutput, { source: "applyAITurnChangesAtomic" });
        if (!strictPreflight.ok) {
          return {
            ok: false,
            rolledBack: false,
            preflightRejected: true,
            applied: { failed: strictPreflight.failures.map(function(failure) {
              return Object.assign({ reason: failure.reason || failure.code }, failure);
            }) }
          };
        }
        aiOutput = strictPreflight.output;
      }
      var gSnapshot, pSnapshot;
      try {
        gSnapshot = _captureAIStateObject(G, ["_postTurnJobs", "_postTurnDetachedJobs", "_indices"]);
        if (P0 && typeof P0 === "object") pSnapshot = _captureAIStateObject(P0, ["scenario", "_indices"]);
        var result = _applyAITurnChangesUnsafe(aiOutput);
        result = result && typeof result === "object" ? result : { ok: false, applied: { failed: [{ reason: "applier returned no result" }] } };
        result.applied = result.applied || { failed: [] };
        result.applied.failed = Array.isArray(result.applied.failed) ? result.applied.failed : [];
        var stateFailures = _validateAIResultState(G);
        if (stateFailures.length) Array.prototype.push.apply(result.applied.failed, stateFailures);
        if (result.ok !== true || result.applied.failed.length) {
          _restoreAIStateObject(G, gSnapshot);
          if (P0 && pSnapshot) _restoreAIStateObject(P0, pSnapshot);
          _refreshAIIndices(G, P0);
          return { ok: false, applied: result.applied, rolledBack: true, error: "AI writeback transaction rejected" };
        }
        return result;
      } catch (e) {
        try {
          if (gSnapshot) _restoreAIStateObject(G, gSnapshot);
        } catch (_) {
        }
        try {
          if (P0 && pSnapshot) _restoreAIStateObject(P0, pSnapshot);
        } catch (_) {
        }
        _refreshAIIndices(G, P0);
        return { ok: false, applied: { failed: [{ reason: String(e && (e.message || e) || "AI writeback exception") }] }, rolledBack: true, error: e };
      }
    }
    function _syncFiscalScalars(G) {
      if (!G) return;
      ["guoku", "neitang"].forEach(function(target) {
        var t = G[target];
        if (!t) return;
        ["money", "grain", "cloth"].forEach(function(res) {
          var ledStock = t.ledgers && t.ledgers[res] && typeof t.ledgers[res].stock === "number" ? t.ledgers[res].stock : null;
          var scalar = typeof t[res] === "number" ? t[res] : null;
          var canon = ledStock != null ? ledStock : scalar != null ? scalar : 0;
          t[res] = canon;
          if (t.ledgers && t.ledgers[res]) t.ledgers[res].stock = canon;
          if (res === "money") t.balance = canon;
        });
        if (t.ledgers && t.ledgers.money && typeof t.ledgers.money.stock === "number" && typeof t.money === "number") {
        }
      });
    }
    return {
      _processDeathEpitaphs,
      _reconcilePlayerMovements,
      _reconcilePlayerFiscalReforms,
      _applyOfficeDutyTick,
      _applyTaxAuthorityGate,
      _applyDirectiveCompliance,
      _applyRegentDecisions,
      preflightAIWriteBack,
      validateAIWriteBackBatch,
      _applyBattleResult,
      _applyFiscalDeficitPenalties,
      _hasInstantArrivalRule,
      _captureValidatorBaseline,
      _collectValidatorFailures,
      _runConsistencyValidator,
      applyAITurnChangesAtomic,
      _syncFiscalScalars,
      legacyExports: {
        normalizeAIWriteBackDeaths,
        applyNormalizedAIWriteBackDeaths,
        _reconcilePlayerMovements,
        _reconcilePlayerFiscalReforms,
        _applyOfficeDutyTick,
        _applyTaxAuthorityGate,
        _applyDirectiveCompliance,
        _applyRegentDecisions,
        preflightAIWriteBack,
        validateAIWriteBackBatch,
        _applyBattleResult,
        _applyFiscalDeficitPenalties,
        _resetDeficitStreakIfHealthy,
        _syncFiscalScalars
      }
    };
  }

  // web/modules/ai-change-applier/context.js
  function stableById(list, id) {
    var key = String(id == null ? "" : id).trim();
    if (!key || !Array.isArray(list)) return null;
    var matches = list.filter(function(row) {
      return row && row.id != null && String(row.id).trim() === key;
    });
    return matches.length === 1 ? matches[0] : null;
  }
  function uniqueLegacyName(list, name) {
    var key = String(name == null ? "" : name).trim();
    if (!key || !Array.isArray(list)) return { ok: false, code: "missing-reference" };
    var matches = list.filter(function(row) {
      return row && row.name != null && String(row.name).trim() === key;
    });
    if (matches.length === 1) return { ok: true, value: matches[0] };
    return { ok: false, code: matches.length ? "ambiguous-reference" : "identity-not-found" };
  }
  function createLegacyDeps(global) {
    if (!global || typeof global !== "object") throw new Error("[AIChangeApplier] renderer root missing");
    var tm = global.TM || {};
    var aiChange = tm.AIChange || {};
    return {
      global,
      pathUtils: aiChange.PathUtils,
      army: aiChange.Army,
      narrative: aiChange.Narrative,
      world: {
        current: function() {
          return global.GM;
        },
        snapshot: function() {
          if (typeof global._tmBuildDetachedPersistenceState === "function") {
            return global._tmBuildDetachedPersistenceState({ GM: global.GM, P: global.P });
          }
          return null;
        },
        transaction: function(fn) {
          return fn(global.GM, global.P);
        }
      },
      identities: {
        characterById: function(id) {
          return stableById(global.GM && global.GM.chars, id);
        },
        factionById: function(id) {
          return stableById(global.GM && global.GM.facs, id);
        },
        positionById: function(id) {
          return typeof global._offFindPositionById === "function" ? global._offFindPositionById(id) : null;
        },
        uniqueLegacyCharacterName: function(name) {
          return uniqueLegacyName(global.GM && global.GM.chars, name);
        },
        uniqueLegacyFactionName: function(name) {
          return uniqueLegacyName(global.GM && global.GM.facs, name);
        }
      },
      commands: {
        roster: tm.Roster || null,
        factions: tm.Factions || null,
        office: tm.Office || null,
        ledger: tm.Ledger || null,
        military: aiChange.Army || null,
        regions: tm.Regions || null,
        travel: tm.Travel || null
      },
      diagnostics: tm.errors || global.console,
      events: tm.Events || null,
      uiInvalidation: tm.UIInvalidation || null
    };
  }
  function validateDependencies(deps) {
    var failures = [];
    if (!deps || !deps.global) failures.push("global");
    if (!deps || !deps.world || typeof deps.world.current !== "function") failures.push("world.current");
    if (!deps || !deps.identities || typeof deps.identities.characterById !== "function") failures.push("identities.characterById");
    if (!deps || !deps.pathUtils || typeof deps.pathUtils.applyPathSet !== "function") failures.push("TM.AIChange.PathUtils");
    if (!deps || !deps.army || typeof deps.army.applyAIArmyChange !== "function") failures.push("TM.AIChange.Army");
    if (!deps || !deps.narrative || typeof deps.narrative.mergeUpdatesToEntity !== "function") failures.push("TM.AIChange.Narrative");
    if (failures.length) {
      var error = new Error("[AIChangeApplier] dependencies unavailable: " + failures.join(", "));
      error.code = "ai-change-applier-dependencies-missing";
      error.details = failures;
      throw error;
    }
    return deps;
  }

  // web/modules/ai-change-applier/legacy-adapter.js
  function snapshotProperty(target, key) {
    return { target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) };
  }
  function publishProperty(target, key, value) {
    target[key] = value;
    if (target[key] !== value) throw new Error("[AIChangeApplier] legacy export was not installed: " + key);
  }
  function restoreProperties(snapshots) {
    var failures = [];
    for (var index = snapshots.length - 1; index >= 0; index -= 1) {
      var row = snapshots[index];
      try {
        if (row.descriptor) Object.defineProperty(row.target, row.key, row.descriptor);
        else if (!delete row.target[row.key] && Object.prototype.hasOwnProperty.call(row.target, row.key)) {
          throw new Error("property could not be deleted");
        }
      } catch (error) {
        failures.push({ key: row.key, error: String(error && (error.message || error) || "rollback failed") });
      }
    }
    return failures;
  }
  function installLegacyFacade(global, build, createDeps) {
    var aiNamespace = global && global.TM && global.TM.AIChange;
    var existing = aiNamespace && aiNamespace.ApplierModule;
    if (existing && existing.initialized === true) return existing.facade;
    if (global.AIChangeApplier) {
      var conflict = new Error("[AIChangeApplier] refusing to overwrite an existing provider");
      conflict.code = "ai-change-applier-provider-conflict";
      throw conflict;
    }
    var deps = createDeps(global);
    var installation = build(deps);
    var facade = installation && installation.facade;
    var legacyExports = installation && installation.legacyExports;
    aiNamespace = global && global.TM && global.TM.AIChange;
    if (!facade || !legacyExports || !aiNamespace || typeof aiNamespace !== "object") {
      var invalid = new Error("[AIChangeApplier] incomplete legacy installation");
      invalid.code = "ai-change-applier-installation-invalid";
      throw invalid;
    }
    if (legacyExports.AIChangeApplier !== facade) {
      var mismatch = new Error("[AIChangeApplier] facade export mismatch");
      mismatch.code = "ai-change-applier-installation-invalid";
      throw mismatch;
    }
    var state = Object.freeze({
      initialized: true,
      facade,
      create: function(nextDeps) {
        return build(nextDeps).facade;
      },
      build,
      createLegacyDeps: createDeps
    });
    var exportKeys = Object.keys(legacyExports);
    var snapshots = exportKeys.map(function(key) {
      return snapshotProperty(global, key);
    });
    snapshots.push(snapshotProperty(aiNamespace, "WriteGuards"));
    snapshots.push(snapshotProperty(aiNamespace, "ApplierModule"));
    try {
      exportKeys.forEach(function(key) {
        publishProperty(global, key, legacyExports[key]);
      });
      publishProperty(aiNamespace, "WriteGuards", facade.writeGuards);
      publishProperty(aiNamespace, "ApplierModule", state);
      return facade;
    } catch (error) {
      var rollbackFailures = restoreProperties(snapshots);
      var publishError = new Error("[AIChangeApplier] atomic legacy publish failed: " + String(error && (error.message || error) || "unknown"));
      publishError.code = "ai-change-applier-publish-failed";
      publishError.cause = error;
      publishError.rollbackFailures = rollbackFailures;
      throw publishError;
    }
  }

  // web/modules/ai-change-applier/index.js
  function buildAIChangeApplier(deps) {
    validateDependencies(deps);
    var core = createCore(deps);
    var validators = createValidators({ global: deps.global, core: core.internals });
    var reconcile = createReconcile({
      global: deps.global,
      core: core.internals,
      validators
    });
    core.bindModules({ validators, reconcile });
    core.facade.writeGuards = Object.freeze({
      sensitiveCharFieldSourced: validators._sensitiveCharFieldSourced
    });
    return {
      facade: core.facade,
      legacyExports: Object.assign({}, core.legacyExports, reconcile.legacyExports)
    };
  }
  function createAIChangeApplier(deps) {
    return buildAIChangeApplier(deps).facade;
  }
  function installAIChangeApplier(global) {
    return installLegacyFacade(global, buildAIChangeApplier, createLegacyDeps);
  }
  var rendererRoot = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null;
  if (rendererRoot) installAIChangeApplier(rendererRoot);
})();
