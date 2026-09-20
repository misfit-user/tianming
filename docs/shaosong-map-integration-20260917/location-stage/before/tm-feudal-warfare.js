// @ts-check
// ═══ 巨石拆分(20260706)：tm-feudal 军事/地图/战争意愿/CB/条约/阴谋/决断/工人池/封建持有片(原§G-§N·行1657-2679) ═══
// 从 tm-feudal.js 后缀切出·顶层函数型(列0全局符号·5局部IIFE自包含·无alias)。
// 须紧接 tm-feudal.js 之后装载。契约见 lint-split-contracts。

// 更新军事单位
function updateMilitary(timeRatio) {
  var ratio = Number(timeRatio);
  if (!Number.isFinite(ratio) || ratio < 0) throw new Error('军事更新 timeRatio 非法');
  var armies = GM && Array.isArray(GM.armies) ? GM.armies : [];

  armies.forEach(function(troop) {
    if (!troop || !troop.name) return;

    // 士气变化
    if (troop.morale !== undefined) {
      var oldMorale = troop.morale;
      var change = Math.floor((random() - 0.5) * 6 * ratio); // 年度±3
      troop.morale = Math.max(0, Math.min(100, troop.morale + change));

      if (Math.abs(change) > 1) {
        recordChange('military', troop.name, 'morale', oldMorale, troop.morale, '日常波动');
      }
    }

    // 训练度提升
    if (troop.training !== undefined && troop.training < 100) {
      var oldTraining = troop.training;
      var inc = Math.floor(random() * 3 * ratio); // 年度+0-2
      troop.training = Math.min(100, troop.training + inc);

      if (inc > 0) {
        recordChange('military', troop.name, 'training', oldTraining, troop.training, '日常训练');
      }
    }

    // 忠诚度微调
    if (troop.loyalty !== undefined) {
      var oldLoyalty = troop.loyalty;
      var change = Math.floor((random() - 0.5) * 4 * ratio); // 年度±2
      troop.loyalty = Math.max(0, Math.min(100, troop.loyalty + change));

      if (Math.abs(change) > 1) {
        recordChange('military', troop.name, 'loyalty', oldLoyalty, troop.loyalty, '军心变化');
      }
    }
  });
}

// 更新地图数据
function updateMap(timeRatio) {
  var ratio = Number(timeRatio);
  if (!Number.isFinite(ratio) || ratio < 0) throw new Error('地图更新 timeRatio 非法');
  var liveMap = typeof ensureWritableRuntimeMap === 'function'
    ? ensureWritableRuntimeMap()
    : (GM && GM.mapData);
  if (liveMap && Array.isArray(liveMap.regions)) {
    liveMap.regions.forEach(function(region) {
      if (!region) return;

      // 1. 发展度自然变化
      var oldDev = Number(region.development);
      if (!Number.isFinite(oldDev)) oldDev = 50;
      var newDev = oldDev;

      // 和平时期缓慢增长
      if (region.owner && random() < 0.3) {
        var growth = (1 + random() * 2) * ratio; // 1-3点/年
        newDev = Math.min(100, oldDev + growth);
      }

      // 战争或无主降低发展度
      if (!region.owner && random() < 0.2) {
        var decline = (1 + random() * 3) * ratio;
        newDev = Math.max(0, oldDev - decline);
      }

      if (Math.abs(newDev - oldDev) > 0.5) {
        region.development = Math.round(newDev);
        recordChange('map', region.name, 'development', oldDev, region.development,
          newDev > oldDev ? '发展' : '衰退');
      }

      // 2. 驻军自然消耗
      var troopCount = Number(region.troops);
      if (Number.isFinite(troopCount) && troopCount > 0 && random() < 0.1) {
        var oldTroops = troopCount;
        var attrition = Math.floor(troopCount * 0.01 * ratio); // 1%损耗/年
        region.troops = Math.max(0, troopCount - attrition);
        if (attrition > 0) {
          recordChange('map', region.name, 'troops', oldTroops, region.troops, '自然损耗');
        }
      }
    });
  }
}

// ============================================================
// 战争意愿权重系统（借鉴晚唐风云 warCalc）
// 用权重决定 NPC 宣战意愿，AI 负责叙述理由
// ============================================================
/**
 * 战争意愿权重系统
 * @namespace
 * @property {function(Object, Object, Object=):number} evaluateWarWeight - 宣战意愿(0-100)
 * @property {function(string, string, number=):void} addTruce - 添加停战
 * @property {function(string, string):boolean} hasTruce - 检查停战
 * @property {function():Object} serialize
 * @property {function(Object):void} deserialize
 */
var WarWeightSystem = {
  TRUCE_DURATION: 24, // 24回合 ≈ 2年

  _perfProvider: function() {
    var host = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    return host && host['TM'] && host['TM']['perf'];
  },

  _perfCount: function(name, delta) {
    var perf = WarWeightSystem._perfProvider();
    if (perf && typeof perf.count === 'function') perf.count(name, delta == null ? 1 : delta);
  },

  _markNormalized: function(state) {
    if (!state || typeof state !== 'object') return state;
    try {
      Object.defineProperty(state, '__tmWarTrucesNormalized', {
        value: true,
        enumerable: false,
        configurable: true
      });
    } catch (error) {
      _dbg('[War] 无法标记停战状态规范化', error);
    }
    return state;
  },

  _emptyState: function() {
    return WarWeightSystem._markNormalized({ version: 1, truces: Object.create(null) });
  },

  _world: function(world) {
    if (world && typeof world === 'object') return world;
    return (typeof GM !== 'undefined' && GM && typeof GM === 'object') ? GM : null;
  },

  _normalizeState: function(input) {
    var perf = WarWeightSystem._perfProvider();
    var span = perf && typeof perf.beginSpan === 'function'
      ? perf.beginSpan('truce.normalize', { hasInput: !!input }) : null;
    WarWeightSystem._perfCount('truce.normalizeCount', 1);
    try {
      var normalized = WarWeightSystem._emptyState();
      if (!input || typeof input !== 'object' || Array.isArray(input)) return normalized;
      var raw = input;
      if (Object.prototype.hasOwnProperty.call(input, 'truces')) {
        raw = input.truces;
      } else if (Object.prototype.hasOwnProperty.call(input, 'version')) {
        raw = null;
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return normalized;
      Object.keys(raw).forEach(function(key) {
        WarWeightSystem._perfCount('truce.keyChecks', 1);
        var parties = String(key).split('|');
        var unsafeKey = parties.some(function(part) {
          var name = String(part || '').trim();
          return !name || name === '__proto__' || name === 'prototype' || name === 'constructor';
        });
        var expiry = Number(raw[key]);
        if (unsafeKey || !Number.isFinite(expiry) || expiry < 0) return;
        normalized.truces[String(key)] = Math.floor(expiry);
      });
      return normalized;
    } finally {
      if (span && perf && typeof perf.endSpan === 'function') perf.endSpan(span);
    }
  },

  _state: function(world) {
    var target = WarWeightSystem._world(world);
    if (!target) return WarWeightSystem._emptyState();
    var state = target._warTruces;
    if (!state || state.version !== 1 || !state.truces || typeof state.truces !== 'object' || Array.isArray(state.truces) || state.__tmWarTrucesNormalized !== true) {
      target._warTruces = WarWeightSystem._normalizeState(state);
    }
    return target._warTruces;
  },

  _partyDescriptor: function(party, world) {
    var target = WarWeightSystem._world(world);
    if (party && typeof party === 'object') {
      var objectId = party.id || party.factionId || party.sid;
      var objectName = String(party.name || party.factionName || '').trim();
      return {
        stable: objectId != null && String(objectId).trim() ? 'id:' + String(objectId).trim() : '',
        legacy: objectName
      };
    }
    if (typeof party !== 'string') return { stable: '', legacy: '' };
    var name = party.trim();
    if (!name) return { stable: '', legacy: '' };
    var factions = [];
    if (target) factions = Array.isArray(target.facs) ? target.facs : (Array.isArray(target.factions) ? target.factions : []);
    var matches = factions.filter(function(faction) {
      return faction && String(faction.name || faction.factionName || '').trim() === name;
    });
    var stable = matches.length === 1 && matches[0] && matches[0].id != null && String(matches[0].id).trim()
      ? 'id:' + String(matches[0].id).trim()
      : '';
    return { stable: stable, legacy: name };
  },

  _pairKeys: function(partyA, partyB, world) {
    var a = WarWeightSystem._partyDescriptor(partyA, world);
    var b = WarWeightSystem._partyDescriptor(partyB, world);
    var legacy = a.legacy && b.legacy ? [a.legacy, b.legacy].sort().join('|') : '';
    var stable = a.stable && b.stable ? [a.stable, b.stable].sort().join('|') : '';
    return { primary: stable || legacy, stable: stable, legacy: legacy };
  },

  _pairKey: function(partyA, partyB) {
    if (typeof partyA !== 'string' || typeof partyB !== 'string') return '';
    var a = partyA.trim();
    var b = partyB.trim();
    if (!a || !b) return '';
    return [a, b].sort().join('|');
  },

  /** 评估 NPC 宣战意愿权重（0=绝不，100=必战） */
  evaluateWarWeight: function(attacker, defender, context) {
    if (!attacker || !defender) return 0;
    var weight = 0;

    // 基础：默认不倾向战争
    weight -= 10;

    // 军力对比
    var aStr = (attacker.troops || 0) + (attacker.soldiers || 0);
    var dStr = (defender.troops || 0) + (defender.soldiers || 0);
    var ratio = dStr > 0 ? aStr / dStr : 2;
    if (ratio >= 2) weight += 20;
    else if (ratio >= 1.5) weight += 10;
    else if (ratio < 0.5) weight -= 30;
    else if (ratio < 0.8) weight -= 15;

    // 性格影响（如果有）
    if (attacker.ambition) weight += (attacker.ambition - 50) * 0.3;
    if (attacker.loyalty !== undefined) weight -= attacker.loyalty * 0.2;

    // 关系影响
    if (context && context.opinion !== undefined) {
      if (context.opinion > 20) weight -= 30; // 友好不开战
      else if (context.opinion < -30) weight += 15;
    }

    // 时代影响
    if (GM.eraState) {
      var phase = GM.eraState.dynastyPhase || 'peak';
      if (phase === 'collapse') weight += 20;
      else if (phase === 'decline') weight += 10;
      else if (phase === 'peak') weight -= 15;
    }

    // 停战惩罚
    if (WarWeightSystem.hasTruce(attacker, defender)) {
      weight -= 40;
    }

    return clamp(Math.round(weight), 0, 100);
  },

  /** 添加停战 */
  addTruce: function(partyA, partyB, duration, world) {
    var target = WarWeightSystem._world(world);
    var key = WarWeightSystem._pairKeys(partyA, partyB, target).primary;
    var turns = duration === undefined || duration === null
      ? WarWeightSystem.TRUCE_DURATION : Number(duration);
    if (!target || !key || !Number.isFinite(turns) || turns <= 0) return false;
    var turn = Number(target.turn);
    if (!Number.isFinite(turn) || turn < 0) turn = 0;
    var state = WarWeightSystem._state(target);
    state.truces[key] = Math.floor(turn + turns);
    _dbg('[War] 停战协议:', partyA, '↔', partyB, '至回合', state.truces[key]);
    return true;
  },

  /** 检查停战 */
  hasTruce: function(partyA, partyB, world) {
    var target = WarWeightSystem._world(world);
    var keys = WarWeightSystem._pairKeys(partyA, partyB, target);
    var key = keys.primary;
    if (!target || !key) return false;
    var state = WarWeightSystem._state(target);
    WarWeightSystem._perfCount('truce.keyChecks', 1);
    var expiry = state.truces[key];
    if (!expiry && keys.stable && keys.legacy && state.truces[keys.legacy]) {
      expiry = state.truces[keys.legacy];
      state.truces[keys.stable] = expiry;
      delete state.truces[keys.legacy];
      key = keys.stable;
    }
    if (!expiry) return false;
    var turn = Number(target.turn);
    if (!Number.isFinite(turn) || turn < 0) turn = 0;
    if (turn >= expiry) { delete state.truces[key]; return false; }
    return true;
  },

  /** 清理过期停战 */
  cleanTruces: function(world) {
    var target = WarWeightSystem._world(world);
    if (!target) return 0;
    var state = WarWeightSystem._state(target);
    var turn = Number(target.turn);
    if (!Number.isFinite(turn) || turn < 0) turn = 0;
    var removed = 0;
    var keys = Object.keys(state.truces);
    keys.forEach(function(k) {
      if (turn >= state.truces[k]) {
        delete state.truces[k];
        removed++;
      }
    });
    return removed;
  },

  /** 序列化 */
  serialize: function(world) {
    var state = WarWeightSystem._state(world);
    var detached = WarWeightSystem._emptyState();
    Object.keys(state.truces).forEach(function(key) {
      detached.truces[key] = state.truces[key];
    });
    return detached;
  },

  deserialize: function(data, world) {
    var target = WarWeightSystem._world(world);
    var normalized = WarWeightSystem._normalizeState(data);
    if (target) target._warTruces = normalized;
    return WarWeightSystem.serialize(target || { _warTruces: normalized });
  },

  reset: function(world) {
    var target = WarWeightSystem._world(world);
    var empty = WarWeightSystem._emptyState();
    if (target) target._warTruces = empty;
    return WarWeightSystem.serialize(target || { _warTruces: empty });
  }
};

// ============================================================
// D1. 宣战理由(Casus Belli)系统
// ============================================================

var CasusBelliSystem = (function() {
  'use strict';

  function _getTypes() {
    return (P.warConfig && P.warConfig.casusBelliTypes) || [
      {id:'rebellion', name:'平叛讨逆', prestigeCost:0, legitimacyCost:0, truceMonths:12},
      {id:'border', name:'边境争端', prestigeCost:3, legitimacyCost:0, truceMonths:12},
      {id:'claim', name:'宣称领土', prestigeCost:8, legitimacyCost:10, truceMonths:36},
      {id:'holy', name:'天子讨不臣', prestigeCost:0, legitimacyCost:0, truceMonths:36},
      {id:'subjugation', name:'武力征服', prestigeCost:15, legitimacyCost:20, truceMonths:48},
      {id:'none', name:'无端开衅', prestigeCost:25, legitimacyCost:40, truceMonths:60}
    ];
  }

  /**
   * 查找CB定义
   * @param {string} cbId
   * @returns {Object|null}
   */
  function findCB(cbId) {
    return _getTypes().find(function(cb) { return cb.id === cbId; }) || null;
  }

  /**
   * 处理宣战：扣除成本、创建战争记录、添加停战
   * @param {string} attacker - 攻方势力名
   * @param {string} defender - 守方势力名
   * @param {string} cbId - CB类型ID（不提供则套用'none'）
   * @returns {Object} {success, war, cbUsed, message}
   */
  // #26·联盟参战:守方有 mutual_defense 同盟→盟友应约对攻方宣战(原 alliance.mutual_defense 标志写而不读·盟友永不参战)
  function _ty_callAlliesToWar(defender, attacker, cb) {
    if (!Array.isArray(GM.treaties)) return;
    var seen = {};
    GM.treaties.forEach(function(t){
      if (!t || t.active === false) return;
      var isAlliance = t.mutual_defense === true || t.type === 'alliance' || t.typeName === '同盟';
      if (!isAlliance) return;
      var parties = Array.isArray(t.parties) ? t.parties.map(function(p){ return (p && p.name) || p; }) : [];
      if (parties.indexOf(defender) < 0) return;
      parties.forEach(function(ally){
        if (!ally || ally === defender || ally === attacker || seen[ally]) return;
        var already = (GM.activeWars||[]).some(function(w){ return (w.attacker===ally&&w.defender===attacker)||(w.attacker===attacker&&w.defender===ally); });
        var truce = (typeof WarWeightSystem !== 'undefined' && WarWeightSystem.hasTruce) ? WarWeightSystem.hasTruce(ally, attacker) : false;
        if (already || truce) return;
        seen[ally] = true;
        GM.activeWars.push({ id: uid(), attacker: attacker, defender: ally, casusBelli: 'mutual_defense', casusBelliName: '应盟参战', startTurn: GM.turn, warScore: 0, truceMonths: (cb && cb.truceMonths) || 12, _alliedWar: true });
        if (typeof addEB === 'function') addEB('外交', ally + '应' + defender + '之盟·对' + attacker + '宣战');
      });
    });
  }

  function declareWar(attacker, defender, cbId) {
    var cb = findCB(cbId || 'none') || findCB('none');

    // 检查停战
    if (WarWeightSystem.hasTruce(attacker, defender)) {
      return {success:false, message:'停战期内不可宣战'};
    }

    // 检查已有战争
    var existingWar = (GM.activeWars||[]).find(function(w) {
      return (w.attacker===attacker && w.defender===defender) || (w.attacker===defender && w.defender===attacker);
    });
    if (existingWar) return {success:false, message:'已在交战中'};

    addEB('外交', attacker + '以"' + cb.name + '"为由向' + defender + '宣战');

    // 创建战争记录
    var war = {
      id: uid(),
      attacker: attacker,
      defender: defender,
      casusBelli: cb.id,
      casusBelliName: cb.name,
      startTurn: GM.turn,
      warScore: 0,
      truceMonths: cb.truceMonths || 12
    };
    if (!GM.activeWars) GM.activeWars = [];
    GM.activeWars.push(war);
    try { _ty_callAlliesToWar(defender, attacker, cb); } catch (_caw) {}   // #26·联盟参战:盟友应约

    return {success:true, war:war, cbUsed:cb};
  }

  /**
   * 结束战争：添加停战期
   */
  function endWar(warId) {
    var idx = (GM.activeWars||[]).findIndex(function(w){return w.id===warId;});
    if (idx < 0) return;
    var war = GM.activeWars[idx];
    // 添加停战
    var truceTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(war.truceMonths||12) : 12;
    WarWeightSystem.addTruce(war.attacker, war.defender, truceTurns);
    // 移除战争
    GM.activeWars.splice(idx, 1);
    addEB('外交', war.attacker + '与' + war.defender + '停战，停战期' + (war.truceMonths||12) + '个月');
  }

  /**
   * 生成AI prompt——可用CB列表+现有战争
   */
  function getPromptInjection() {
    var lines = [];
    // 现有战争
    if (GM.activeWars && GM.activeWars.length > 0) {
      lines.push('【当前战争】');
      GM.activeWars.forEach(function(w) {
        lines.push('  ' + w.attacker + ' vs ' + w.defender + ' (理由:' + (w.casusBelliName||w.casusBelli) + ' 积分:' + (w.warScore||0) + ')');
      });
    }
    // CB约束提示
    var types = _getTypes();
    if (types.length > 0) {
      lines.push('【战争法则】发动战争需指定理由(casusBelli)，否则视为"无端开衅"（最高惩罚）。');
      lines.push('  可用理由: ' + types.map(function(t){return t.name+'(威望-'+t.prestigeCost+')';}).join(' | '));
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  return { findCB:findCB, declareWar:declareWar, endWar:endWar, getPromptInjection:getPromptInjection };
})();

// ============================================================
// D2. 盟约条约系统
// ============================================================

var TreatySystem = (function() {
  'use strict';

  function _getTypeTemplates() {
    return (P.diplomacyConfig && P.diplomacyConfig.treatyTypes) || [
      {id:'alliance', name:'同盟', durationMonths:36, mutual_defense:true, breakPenalty:{prestige:-20}},
      {id:'truce', name:'停战', durationMonths:12, breakPenalty:{prestige:-15}},
      {id:'tribute', name:'朝贡', durationMonths:0},
      {id:'marriage', name:'和亲', durationMonths:0, breakPenalty:{prestige:-25}},
      {id:'trade', name:'互市', durationMonths:12}
    ];
  }

  /**
   * 创建条约
   */
  function createTreaty(typeId, partyA, partyB, terms) {
    var template = _getTypeTemplates().find(function(t){return t.id===typeId;});
    if (!template) return null;
    var durationTurns = template.durationMonths > 0 ? ((typeof turnsForMonths==='function') ? turnsForMonths(template.durationMonths) : template.durationMonths) : 0;

    var treaty = {
      id: uid(),
      type: typeId,
      typeName: template.name,
      parties: [partyA, partyB],
      startTurn: GM.turn,
      durationTurns: durationTurns, // 0=永久
      expiryTurn: durationTurns > 0 ? GM.turn + durationTurns : 0,
      terms: terms || template.terms || {},
      breakPenalty: template.breakPenalty || {},
      mutual_defense: template.mutual_defense === true,   // #26·从模板带上共同防御标志(原 createTreaty 不拷·致 mutual_defense 写而不读)
      active: true
    };
    if (!GM.treaties) GM.treaties = [];
    GM.treaties.push(treaty);
    addEB('外交', partyA + '与' + partyB + '缔结' + template.name + (durationTurns>0 ? '（期限'+durationTurns+'回合）' : '（永久）'));
    return treaty;
  }

  function _treaties() {
    return Array.isArray(GM.treaties) ? GM.treaties : [];
  }

  function _partyName(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') return String(value.name || value.faction || value.id || '').trim();
    return String(value).trim();
  }

  function _treatyParties(t) {
    if (!t) return [];
    var raw = [];
    if (Array.isArray(t.parties)) raw = raw.concat(t.parties);
    if (Array.isArray(t.factions)) raw = raw.concat(t.factions);
    if (Array.isArray(t.participants)) raw = raw.concat(t.participants);
    ['partyA', 'partyB', 'factionA', 'factionB', 'actor', 'target', 'from', 'to', 'liege', 'vassal'].forEach(function(key) {
      if (t[key]) raw.push(t[key]);
    });
    var seen = {};
    return raw.map(_partyName).filter(function(name) {
      if (!name || seen[name]) return false;
      seen[name] = true;
      return true;
    });
  }

  function _treatyTypeName(t) {
    return (t && (t.typeName || t.name || t.type)) || '条约';
  }

  function _isTreatyActive(t) {
    return !!t && t.active !== false;
  }

  /**
   * 违约/废除条约
   */
  function breakTreaty(treatyId, breakerName) {
    var idx = _treaties().findIndex(function(t){return t.id===treatyId;});
    if (idx < 0) return;
    var treaty = GM.treaties[idx];
    var parties = _treatyParties(treaty);
    var others = parties.filter(function(p){return p!==breakerName;});
    addEB('外交', breakerName + '废除了与' + (others.length ? others.join('、') : '对方') + '的' + _treatyTypeName(treaty) + '，信誉受损');
    GM.treaties.splice(idx, 1);
  }

  /**
   * 每回合清理到期条约
   */
  function cleanExpired() {
    if (!Array.isArray(GM.treaties)) return;
    GM.treaties = GM.treaties.filter(function(t) {
      if (t.expiryTurn > 0 && GM.turn >= t.expiryTurn) {
        var parties = _treatyParties(t);
        addEB('外交', (parties.length ? parties.join('与') : '一项条约') + '的' + _treatyTypeName(t) + '到期解除');
        return false;
      }
      return true;
    });
  }

  /**
   * 检查两方是否有特定类型的条约
   */
  function hasTreaty(partyA, partyB, typeId) {
    return _treaties().some(function(t) {
      var parties = _treatyParties(t);
      var match = parties.indexOf(partyA) >= 0 && parties.indexOf(partyB) >= 0;
      return match && (!typeId || t.type === typeId) && _isTreatyActive(t);
    });
  }

  function getPromptInjection() {
    var treaties = _treaties();
    if (!treaties.length) return '';
    var lines = ['【现有条约】'];
    treaties.forEach(function(t) {
      var parties = _treatyParties(t);
      if (parties.length < 2) return;
      var remaining = t.expiryTurn > 0 ? '剩' + (t.expiryTurn - GM.turn) + '回合' : '永久';
      lines.push('  ' + parties.join('↔') + ' ' + _treatyTypeName(t) + ' (' + remaining + ')');
    });
    return lines.length > 1 ? lines.join('\n') : '';
  }

  /** 检查faction_events中的宣战是否违反现有条约 */
  function checkViolations(factionEvents) {
    if (!_treaties().length || !factionEvents) return;
    factionEvents.forEach(function(fe) {
      if (!fe.action || fe.action.indexOf('宣战') < 0) return;
      var attacker = fe.actor || '';
      var defender = fe.target || '';
      if (!attacker || !defender) return;
      // 检查是否有和平/联盟条约
      var violated = _treaties().filter(function(t) {
        var parties = _treatyParties(t);
        return _isTreatyActive(t) && parties.indexOf(attacker) >= 0 && parties.indexOf(defender) >= 0;
      });
      violated.forEach(function(t) {
        t.active = false; // 条约失效
        addEB('违约', attacker + '背弃与' + defender + '的' + _treatyTypeName(t) + '！');
      });
    });
  }

  return { createTreaty:createTreaty, breakTreaty:breakTreaty, cleanExpired:cleanExpired, hasTreaty:hasTreaty, checkViolations:checkViolations, getPromptInjection:getPromptInjection };
})();

// 注册条约清理
SettlementPipeline.register('treatyClean', '条约清理', function() { TreatySystem.cleanExpired(); }, 30, 'perturn');

// ============================================================
// D3. 阴谋系统
// ============================================================

var SchemeSystem = (function() {
  'use strict';

  function _getTypes() {
    return (P.schemeConfig && P.schemeConfig.schemeTypes) || [];
  }

  // 刀丁2·feudal 数值 scheme 独立账本 GM._feudalSchemes(不与叙事 activeSchemes 混居·根治 R-2 连坐)。
  //   老档迁移(幂等)：把 activeSchemes 里 feudal 形数值 scheme(typeId+phase+数值 progress)搬入自家账本。
  function _ensureFeudal() {
    if (!Array.isArray(GM._feudalSchemes)) GM._feudalSchemes = [];
    if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length) {
      var moved = [];
      GM.activeSchemes = GM.activeSchemes.filter(function(s) {
        if (s && s.typeId && s.phase && typeof s.progress === 'number') { moved.push(s); return false; }
        return true;
      });
      for (var _mi = 0; _mi < moved.length; _mi++) { if (!moved[_mi].origin) moved[_mi].origin = 'feudal'; GM._feudalSchemes.push(moved[_mi]); }
    }
  }

  /**
   * 发起阴谋
   */
  function initiate(schemerId, targetId, typeId) {
    var types = _getTypes();
    var sType = types.find(function(t){return t.id===typeId;});
    if (!sType) return {success:false, message:'未知阴谋类型'};
    if (!P.schemeConfig || !P.schemeConfig.enabled) return {success:false, message:'阴谋系统未启用'};

    // 冷却检查
    if (!GM.schemeCooldowns) GM.schemeCooldowns = {};
    var cdKey = schemerId + '_' + targetId + '_' + typeId;
    var cdTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(sType.cooldownMonths || 24) : 24;
    if (GM.schemeCooldowns[cdKey] && GM.turn - GM.schemeCooldowns[cdKey] < cdTurns) {
      return {success:false, message:'冷却中（剩余' + (cdTurns - (GM.turn - GM.schemeCooldowns[cdKey])) + '回合）'};
    }

    // 计算成功率
    var schemer = findCharByName(schemerId);
    var target = findCharByName(targetId);
    if (!schemer || !target) return {success:false, message:'角色不存在'};

    var successRate = sType.baseSuccess || 0.15;
    successRate += (schemer.intelligence || 50) * (sType.offenseWeight || 0.005);
    if (sType.defenseAttr && sType.defenseWeight) {
      successRate -= (target[sType.defenseAttr] || 50) * sType.defenseWeight;
    }
    successRate = Math.max(0.01, Math.min(0.95, successRate));

    // 2.4: 多阶段支持——从schemeType读取阶段数（默认1）
    var totalPhases = sType.phases || 1;
    var phaseNames = sType.phaseNames || [];
    var phaseProgress = sType.phaseProgress || []; // 每阶段月基准进度

    var scheme = {
      id: uid(),
      origin: 'feudal',
      typeId: typeId,
      typeName: sType.name,
      schemer: schemerId,
      target: targetId,
      startTurn: GM.turn,
      successRate: Math.round(successRate * 100),
      progress: 0, // 当前阶段进度 0-100
      discovered: false,
      status: 'active', // active|success|failure|exposed
      // 2.4: 多阶段字段
      phase: { current: 1, total: totalPhases },
      phaseNames: phaseNames,
      phaseProgress: phaseProgress,
      // 2.4: 发起时冻结快照（后续阶段不再实时读取能力值）
      snapshot: {
        initiatorIntel: schemer.intelligence || 50,
        targetIntel: target.intelligence || 50,
        baseRate: successRate
      }
    };

    _ensureFeudal();
    GM._feudalSchemes.push(scheme);
    DebugLog.log('scheme', schemerId, '发起', sType.name, '→', targetId,
      '成功率', scheme.successRate + '%', '阶段', '1/' + totalPhases);
    return {success:true, scheme:scheme};
  }

  /**
   * 每回合推进所有活跃阴谋
   */
  function advanceAll() {
    _ensureFeudal();
    if (!GM._feudalSchemes.length) return;
    if (!P.schemeConfig || !P.schemeConfig.enabled) return;

    var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var monthScale = tr * 12;

    GM._feudalSchemes.forEach(function(scheme) {
      if (scheme.status !== 'active') return;

      // 2.4: 多阶段进度推进
      // 确保phase对象存在（兼容旧存档）
      if (!scheme.phase) scheme.phase = { current: 1, total: 1 };
      var curPhase = scheme.phase.current;
      var totalPhases = scheme.phase.total;

      // 每阶段月基准进度（从配置读取，越后越慢；默认10）
      var baseProgress = 10;
      if (scheme.phaseProgress && scheme.phaseProgress.length >= curPhase) {
        baseProgress = scheme.phaseProgress[curPhase - 1];
      }
      // 最小月进度保障
      var minProg = (typeof getBalanceVal === 'function') ? getBalanceVal('scheme.minProgressPerMonth', 3) : 3;
      baseProgress = Math.max(minProg, baseProgress);

      // 进度增量clamp到合理范围，防止大回合剧本(1年/回合)一回合完成全部进度
      var progressIncrement = Math.min(30, baseProgress * monthScale);
      scheme.progress = Math.min(100, scheme.progress + progressIncrement);

      // 5.5: 阴谋暴露——关系弱的参与者更易告密
      if (scheme.participants && scheme.status === 'active') {
        scheme.participants.forEach(function(pName) {
          if (scheme.status !== 'active') return; // 已被告密则跳过
          var pCh = findCharByName(pName);
          if (!pCh || !pCh._relationships) return;
          var schemerRel = pCh._relationships[scheme.schemer];
          var relStrength = 0;
          if (schemerRel) schemerRel.forEach(function(r){ relStrength += (r.strength||0); });
          // 关系弱→告密概率增加（每回合base 2%，关系每-10增加1%）
          var betrayalChance = 0.02 + Math.max(0, -relStrength) * 0.001;
          if (random() < betrayalChance) {
            scheme.discovered = true;
            scheme.status = 'exposed';
            addEB('\u9634\u8C0B', pName + '\u544A\u53D1\u4E86' + scheme.schemer + '\u7684' + scheme.typeName);
          }
        });
      }

      // 败露检测
      var sType = _getTypes().find(function(t){return t.id===scheme.typeId;});
      var discoveryChance = (sType && sType.discoveryChance) || 0.1;
      // 越后面的阶段败露概率越高
      var phaseDiscoveryMult = 1 + (curPhase - 1) * 0.3;
      // 用补概率模型防止大回合溢出：1-(1-p)^months，而非 p*months
      var effectiveDiscovery = 1 - Math.pow(1 - Math.min(discoveryChance * phaseDiscoveryMult, 0.5), Math.max(1, monthScale));
      if (random() < effectiveDiscovery) {
        scheme.discovered = true;
        scheme.status = 'exposed';
        if (typeof EnYuanSystem !== 'undefined') {
          EnYuanSystem.add('yuan', scheme.target, scheme.schemer, 3, scheme.typeName + '阴谋败露');
        }
        if (typeof FaceSystem !== 'undefined') {
          var schemerChar = findCharByName(scheme.schemer);
          if (schemerChar) FaceSystem.changeFace(schemerChar, -20, scheme.typeName + '败露');
        }
        var phaseName = (scheme.phaseNames && scheme.phaseNames[curPhase-1]) || ('第' + curPhase + '阶段');
        addEB('阴谋', scheme.schemer + '对' + scheme.target + '的' + scheme.typeName + '在' + phaseName + '败露！');
      }

      // 进度满→判断是否进入下一阶段
      if (scheme.progress >= 100 && scheme.status === 'active') {
        if (curPhase < totalPhases) {
          // 进入下一阶段
          scheme.phase.current = curPhase + 1;
          scheme.progress = 0;
          var nextPhaseName = (scheme.phaseNames && scheme.phaseNames[curPhase]) || ('第' + (curPhase+1) + '阶段');
          addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '进入' + nextPhaseName);
          // 写入NPC记忆
          if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
            NpcMemorySystem.addMemory(scheme.schemer, scheme.typeName + '计划进入' + nextPhaseName, 5, 'scheme');
          }
          // emit事件
          if (typeof GameEventBus !== 'undefined') {
            GameEventBus.emit('scheme:phaseChange', { scheme: scheme, newPhase: curPhase + 1 });
          }
          DebugLog.log('scheme', scheme.schemer, scheme.typeName, '进入阶段', curPhase + 1, '/', totalPhases);
        } else {
          // 最终阶段完成→结算（使用快照中的成功率）
          var finalRate = scheme.successRate;
          var roll = random();
          if (roll < finalRate / 100) {
            scheme.status = 'success';
            addEB('阴谋', scheme.schemer + '对' + scheme.target + '的' + scheme.typeName + '成功！');
          } else {
            scheme.status = 'failure';
            addEB('阴谋', scheme.schemer + '对' + scheme.target + '的' + scheme.typeName + '失败。');
          }
          if (!GM.schemeCooldowns) GM.schemeCooldowns = {};
          GM.schemeCooldowns[scheme.schemer + '_' + scheme.target + '_' + scheme.typeId] = GM.turn;
        }
      }
    });

    // 清理已结算的 + 写入NPC记忆
    var resolved = GM._feudalSchemes.filter(function(s){return s.status!=='active';});
    if (!GM._turnSchemeResults) GM._turnSchemeResults = [];
    resolved.forEach(function(s){
      GM._turnSchemeResults.push(s);
      // E3: 阴谋结果写入相关角色记忆
      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
        if (s.status === 'success') {
          NpcMemorySystem.addMemory(s.schemer, '对' + s.target + '发起的' + s.typeName + '阴谋得逞', 8, 'scheme');
          NpcMemorySystem.addMemory(s.target, '遭到' + s.typeName + '阴谋，受害严重', 9, 'scheme');
        } else if (s.status === 'exposed') {
          NpcMemorySystem.addMemory(s.schemer, '对' + s.target + '的' + s.typeName + '阴谋败露，身败名裂', 9, 'scheme');
          NpcMemorySystem.addMemory(s.target, '识破了' + s.schemer + '的' + s.typeName + '阴谋', 7, 'scheme');
          // 败露影响派系关系
          var sc = findCharByName(s.schemer), tc = findCharByName(s.target);
          if (sc && tc && sc.faction && tc.faction && sc.faction !== tc.faction) {
            var sf = GM.facs && GM.facs.find(function(f){return f.name===sc.faction;});
            var tf = GM.facs && GM.facs.find(function(f){return f.name===tc.faction;});
            if (sf && tf) {
              if (!sf._factionRelations) sf._factionRelations = {};
              sf._factionRelations[tc.faction] = (sf._factionRelations[tc.faction] || 0) - 15;
            }
          }
        } else if (s.status === 'failure') {
          NpcMemorySystem.addMemory(s.schemer, '对' + s.target + '的' + s.typeName + '阴谋未能成功', 6, 'scheme');
        }
      }
    });
    GM._feudalSchemes = GM._feudalSchemes.filter(function(s){return s.status==='active';});
  }

  function getPromptInjection() {
    _ensureFeudal();
    var lines = [];
    if (GM._feudalSchemes.length > 0) {
      lines.push('【进行中的阴谋】');
      GM._feudalSchemes.forEach(function(s) {
        // 2.4: 显示阶段信息
        var phaseInfo = '';
        if (s.phase && s.phase.total > 1) {
          var pName = (s.phaseNames && s.phaseNames[s.phase.current-1]) || ('阶段' + s.phase.current);
          phaseInfo = ' 第' + s.phase.current + '/' + s.phase.total + '阶段(' + pName + ')';
        }
        lines.push('  ' + s.schemer + '→' + s.target + ' ' + s.typeName + phaseInfo + ' 进度' + Math.round(s.progress) + '% 成功率' + s.successRate + '%');
      });
    }
    if (GM._turnSchemeResults && GM._turnSchemeResults.length > 0) {
      lines.push('【阴谋结果（不可更改）】');
      GM._turnSchemeResults.forEach(function(s) {
        lines.push('  ' + s.schemer + '→' + s.target + ' ' + s.typeName + ': ' +
          (s.status==='success'?'成功':s.status==='exposed'?'败露':s.status==='failure'?'失败':s.status));
      });
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  return { initiate:initiate, advanceAll:advanceAll, getPromptInjection:getPromptInjection };
})();

// 注册阴谋推进
SettlementPipeline.register('scheme', '阴谋推进', function() { SchemeSystem.advanceAll(); }, 38, 'perturn');

// ============================================================
// 5.2: 军队行军与位置系统（基于GM.armies的destination字段）
// 与MarchSystem并行——MarchSystem处理marchOrders，本步骤处理armies的destination
// ============================================================
SettlementPipeline.register('armyMarch', '军队行军', function() {
  if (!GM.armies) GM.armies = [];
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var marchReports = [];

  GM.armies.forEach(function(army) {
    if (!army.destination || army.destination === army.location) return;
    // 行军速度（里/天）
    var speed = 30; // 默认步兵
    if (army.type === 'cavalry' || army.cavalryRatio > 0.5) speed = 60;
    if (army.hasSiege || army.hasSupplyTrain) speed = Math.min(speed, 20);
    // 编辑器可配置
    if (P.mechanicsConfig && P.mechanicsConfig.marchSpeed) speed = P.mechanicsConfig.marchSpeed[army.type] || speed;

    var dailyDistance = speed;
    var turnDistance = dailyDistance * dpv;

    // 有地图时计算实际距离
    var totalDistance = army._remainingDistance || 0;
    if (totalDistance <= 0) {
      // 首次行军——估算距离（有地图用邻接，无地图用默认值）
      if (P.map && P.map.regions) {
        // 简化：邻接步数 × 300里
        totalDistance = 600; // 默认2步邻接
      } else {
        totalDistance = 900; // 无地图默认距离
      }
      army._remainingDistance = totalDistance;
      army._marchStartTurn = GM.turn;
    }

    army._remainingDistance -= turnDistance;

    if (army._remainingDistance <= 0) {
      // 到达目的地
      army.location = army.destination;
      army.destination = '';
      army._remainingDistance = 0;
      marchReports.push(army.name + '\u5DF2\u62B5\u8FBE' + army.location);
      if (typeof addEB === 'function') addEB('\u884C\u519B', army.name + '\u62B5\u8FBE' + army.location);
    } else {
      // 行军中——消耗补给、降低士气
      army.morale = Math.max(10, (army.morale || 70) - 2);
      if (army.supply !== undefined) army.supply = Math.max(0, army.supply - dpv * 0.5);
      var turnsLeft = Math.ceil(army._remainingDistance / turnDistance);
      marchReports.push(army.name + '\u6B63\u5728\u884C\u519B\u2192' + army.destination + '\uFF08\u7EA6' + turnsLeft + '\u56DE\u5408\u5230\u8FBE\uFF09');
    }
  });
  GM._marchReport = marchReports.length > 0 ? marchReports.join('\uFF1B') : '';
}, 37, 'perturn');

// ============================================================
// D4. 称王称帝决策系统
// ============================================================

var DecisionSystem = (function() {
  'use strict';

  function _getDecisions() {
    return (P.decisionConfig && P.decisionConfig.decisions) || [
      {id:'create_emperor', name:'称帝',
       conditions:['eraPhase==乱世','noExistingEmperor','controlRatio>=0.6'],
       cost:{prestige:40, money:10000},
       effects:[{type:'grant_title',level:'emperor'},{type:'set_era',phase:'治世'}],
       description:'登基称帝，开创新朝'},
      {id:'create_kingdom', name:'称王',
       conditions:['controlRatio>=0.5'],
       cost:{prestige:20, money:5000},
       effects:[{type:'grant_title',level:'king'}],
       description:'称王建国'},
      {id:'destroy_title', name:'废黜头衔',
       conditions:['hasHighTitle'],
       cost:{prestige:10},
       effects:[{type:'revoke_title'}],
       description:'废黜某个头衔'}
    ];
  }

  /**
   * 检查决策条件是否满足
   * @returns {{canExecute:boolean, reasons:string[]}}
   */
  function checkConditions(decisionId, actorName) {
    var decision = _getDecisions().find(function(d){return d.id===decisionId;});
    if (!decision) return {canExecute:false, reasons:['决策不存在']};

    var reasons = [];
    (decision.conditions || []).forEach(function(cond) {
      // 简单条件解析
      if (cond === 'noExistingEmperor') {
        var hasEmperor = (GM.chars||[]).some(function(c){return c.alive!==false && c.titles && c.titles.some(function(t){return t.type==='emperor';});});
        if (hasEmperor) reasons.push('已有天子在位');
      }
      if (cond.indexOf('controlRatio>=') === 0) {
        var needed = parseFloat(cond.split('>=')[1]);
        // 简化：检查势力实力占比
        var actor = (GM.facs||[]).find(function(f){return f.name===actorName||f.leader===actorName;});
        var totalStr = 0; (GM.facs||[]).forEach(function(f){totalStr += f.strength||50;});
        var ratio = actor ? (actor.strength||50)/Math.max(totalStr,1) : 0;
        if (ratio < needed) reasons.push('势力占比不足(' + (ratio*100).toFixed(0) + '%<' + (needed*100) + '%)');
      }
      if (cond.indexOf('eraPhase==') === 0) {
        var phase = cond.split('==')[1];
        var cur = GM.eraState ? GM.eraState.dynastyPhase : 'peak';
        // 映射中文
        var phaseMap = {'乱世':'collapse','危世':'decline','治世':'peak'};
        if (phaseMap[phase] && cur !== phaseMap[phase] && cur !== phase) reasons.push('当前非' + phase + '时期');
      }
    });

    return {canExecute: reasons.length === 0, reasons: reasons};
  }

  /**
   * 执行决策
   */
  function execute(decisionId, actorName) {
    var check = checkConditions(decisionId, actorName);
    if (!check.canExecute) return {success:false, reasons:check.reasons};

    var decision = _getDecisions().find(function(d){return d.id===decisionId;});
    // 扣除成本
    if (decision.cost) {
      if (decision.cost.money && P.economyConfig && P.economyConfig.dualTreasury) {
        GM.stateTreasury = (GM.stateTreasury||0) - decision.cost.money;
      }
    }

    // 应用效果
    (decision.effects || []).forEach(function(eff) {
      if (eff.type === 'grant_title' && typeof grantTitle === 'function') {
        grantTitle(actorName, eff.level, 0, true);
      }
      if (eff.type === 'set_era' && GM.eraState) {
        var phaseMap2 = {'治世':'peak','危世':'decline','乱世':'collapse'};
        GM.eraState.dynastyPhase = phaseMap2[eff.phase] || eff.phase;
      }
    });

    addEB('决策', actorName + '执行了"' + decision.name + '"！' + decision.description);
    return {success:true, decision:decision};
  }

  function getPromptInjection() {
    var decs = _getDecisions();
    if (!decs || decs.length === 0) return '';
    var playerName = (P.playerInfo && P.playerInfo.characterName) || '';
    if (!playerName) return '';

    var available = [];
    decs.forEach(function(d) {
      var check = checkConditions(d.id, playerName);
      if (check.canExecute) {
        available.push(d.name + '(威望-' + ((d.cost&&d.cost.prestige)||0) + ')');
      }
    });
    if (available.length === 0) return '';
    return '【可用决策】' + available.join(' | ');
  }

  return { checkConditions:checkConditions, execute:execute, getPromptInjection:getPromptInjection };
})();

// ============================================================
// 注册结算步骤到 SettlementPipeline
// ============================================================
// monthly 步骤：每月子tick执行
SettlementPipeline.register('factions', '势力更新', function(ctx) { updateFactions(ctx.timeRatio); }, 30, 'monthly');
SettlementPipeline.register('parties', '党派更新', function(ctx) { updateParties(ctx.timeRatio); }, 31, 'monthly');
SettlementPipeline.register('classes', '阶层更新', function(ctx) { updateClasses(ctx.timeRatio); }, 32, 'monthly');
SettlementPipeline.register('characters', '角色更新', function(ctx) { updateCharacters(ctx.timeRatio); }, 33, 'monthly');
// daily 步骤：每日子tick执行（军事行动高频更新）
SettlementPipeline.register('military', '军事更新', function(ctx) { updateMilitary(ctx.timeRatio); }, 34, 'daily');
// monthly 步骤
SettlementPipeline.register('map', '地图更新', function(ctx) { updateMap(ctx.timeRatio); }, 35, 'monthly');
SettlementPipeline.register('units', '单位系统', function() { if(typeof updateUnitSystem==='function') updateUnitSystem(); }, 40, 'monthly');
SettlementPipeline.register('supply', '补给系统', function() { if(typeof updateSupplySystem==='function') updateSupplySystem(); }, 41, 'monthly');
SettlementPipeline.register('buildings', '建筑系统', function() { if(typeof updateBuildingSystem==='function') updateBuildingSystem(); }, 42, 'monthly');
SettlementPipeline.register('vassals', '封臣系统', function() { if(typeof updateVassalSystem==='function') updateVassalSystem(); }, 43, 'monthly');
SettlementPipeline.register('titles', '头衔系统', function() { if(typeof updateTitleSystem==='function') updateTitleSystem(); }, 44, 'monthly');
SettlementPipeline.register('adminDivisions', '行政区划', function() { if(typeof updateAdminHierarchy==='function') updateAdminHierarchy(); }, 44.5, 'monthly');
SettlementPipeline.register('mapState', '地图状态', function() { if(typeof updateMapState==='function') updateMapState(); }, 45, 'monthly');

// 生成变化报告（史记第二部分）

// 7.5: Worker管理器
var WorkerPool = (function() {
  var _worker = null;
  var _pending = {};
  var _reqId = 0;
  var _supported = typeof Worker !== 'undefined';

  function _init() {
    if (_worker || !_supported) return;
    try {
      _worker = new Worker('tm-worker.js');
      _worker.onmessage = function(e) {
        var msg = e.data;
        if (msg.requestId && _pending[msg.requestId]) {
          _pending[msg.requestId](msg);
          delete _pending[msg.requestId];
        }
      };
      _worker.onerror = function(e) {
        console.warn('[WorkerPool] error:', e.message);
        _supported = false; // 降级到主线程
      };
    } catch(e) {
      _supported = false;
    }
  }

  return {
    isSupported: function() { return _supported; },

    // 发送计算任务到Worker，返回Promise
    compute: function(taskType, data) {
      return new Promise(function(resolve) {
        if (!_supported) { resolve(null); return; } // 不支持时返回null，主线程自行计算
        _init();
        if (!_worker) { resolve(null); return; }
        var id = 'req_' + (++_reqId);
        data.type = taskType;
        data.requestId = id;
        _pending[id] = function(msg) {
          if (msg.type === 'error') { resolve(null); }
          else { resolve(msg.result); }
        };
        _worker.postMessage(data);
        // 超时保护：3秒内没返回则降级
        setTimeout(function() {
          if (_pending[id]) { delete _pending[id]; resolve(null); }
        }, 3000);
      });
    },

    terminate: function() {
      if (_worker) { _worker.terminate(); _worker = null; }
    }
  };
})();

// 8.2: 填充TM命名空间（tm-utils.js中预留的economy/military子域）
if (typeof TM !== 'undefined') {
  TM.economy = {
    calculateProvinceEconomy: typeof calculateProvinceEconomy === 'function' ? calculateProvinceEconomy : null,
    calculateBuildingOutput: typeof calculateBuildingOutput === 'function' ? calculateBuildingOutput : null,
    applyBuildingEffectsToFaction: typeof applyBuildingEffectsToFaction === 'function' ? applyBuildingEffectsToFaction : null
  };
  TM.military = {
    enhancedResolveBattle: typeof enhancedResolveBattle === 'function' ? enhancedResolveBattle : null,
    calculateSiegeProgress: typeof calculateSiegeProgress === 'function' ? calculateSiegeProgress : null
  };
}

// ============================================================
// §N · FEUDAL_HOLDING_TYPES + _tickFeudalHoldings
// (R10h·原 tm-tax-atomic §H·R12 redistribute·5 类封建持有 + tick)
// ============================================================

var FEUDAL_HOLDING_TYPES = {
  imperial_clan:     { tributeRate: 0.15, military: 'imperial',  autonomy: 0.3, description:'皇族分封' },
  warlord:           { tributeRate: 0.3,  military: 'own',       autonomy: 0.85,description:'藩镇自立' },
  tribal_federation: { tributeRate: 0.05, military: 'auxiliary', autonomy: 0.7, description:'部族联盟' },
  tributary_state:   { tributeRate: 0.01, military: 'nominal',   autonomy: 0.95,description:'朝贡国' },
  jimi_prefecture:   { tributeRate: 0.10, military: 'nominal',   autonomy: 0.6, description:'羁縻府州' }
};

function _tickFeudalHoldings(ctx, mr) {
  var _tmFeudalGlobal = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
  var G = _tmFeudalGlobal.GM;
  if (!G || !G.feudalHoldings) return;
  G.feudalHoldings.forEach(function(fh) {
    var rule = FEUDAL_HOLDING_TYPES[fh.type];
    if (!rule) return;
    if ((G.month||1) === 1 && G.guoku && fh.tribute && fh.tribute.annual) {
      G.guoku.money = (G.guoku.money || 0) + fh.tribute.annual;
    }
    var hw = G.huangwei && G.huangwei.index || 50;
    if (hw < 30) fh.loyalty = Math.max(0, (fh.loyalty||0.5) - 0.005 * mr);
    if (hw > 70) fh.loyalty = Math.min(1, (fh.loyalty||0.5) + 0.003 * mr);
    if (fh.loyalty < 0.15 && Math.random() < 0.02 * mr) {
      fh.status = 'rebelling';
      if (_tmFeudalGlobal.addEB) _tmFeudalGlobal.addEB('藩镇', fh.name + ' 叛');
    }
  });
}

(function() {
  var _g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
  _g.FeudalCore = _g.FeudalCore || {};
  _g.FeudalCore.FEUDAL_HOLDING_TYPES = FEUDAL_HOLDING_TYPES;
  _g.FeudalCore._tickFeudalHoldings = _tickFeudalHoldings;
  _g.FeudalCore.VERSION = 1;
})();
