// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-feudal.js — 封建·封臣·头衔·爵位·铨选·战争·盟约·阴谋·封建持有 (R10h)
// Domain: 封建 + 头衔 + 铨选 + 军事附属 + 外交 + 封建持有 (FeudalCore·R10h)
// Status: active · Last Updated: 2026-05-04 (Phase 3 R10h·吸 §H FEUDAL_HOLDING_TYPES + _tickFeudalHoldings)
// Owner: TM 团队
// Imports: tm-data-model·tm-utils·tm-index-world·tm-military (姊妹)·原 tm-tax-atomic §H (R10h done)
// Exports: 54 top-level functions/vars + 5 局部 IIFE 子系统 (WarWeightSystem·CasusBelliSystem·TreatySystem·SchemeSystem·DecisionSystem·WorkerPool) + global.FeudalCore (R10h·FEUDAL_HOLDING_TYPES + _tickFeudalHoldings)
// Used by: tm-military·tm-game-loop·tm-endturn-systems·tm-var-drawers (FeudalCore.FEUDAL_HOLDING_TYPES UI display)·index/editor.html·smoke-office-dynastification (33 assertions)
// Side effects: 全局 functions/vars (top-level)·影响 GM·DOM·CY 等·GM.feudalHoldings mutation (R10h)
// Test: smoke-office-dynastification (33)·smoke-military-systems (83 间接)
// Notes: R130 从 tm-military.js L2286-end 拆出·**Phase 3 audit·保留 single·拆 risk 高·Phase 5 namespace 化候选**
//        R10h (2026-05-04·Claude)·从 tm-tax-atomic §H 迁入 FEUDAL_HOLDING_TYPES (5 类·imperial_clan/warlord/tribal_federation/tributary_state/jimi_prefecture) + _tickFeudalHoldings·暴露为 global.FeudalCore namespace·tax-atomic 删除后 var-drawers L1267 改用 FeudalCore.FEUDAL_HOLDING_TYPES
// 姊妹: tm-military.js (战斗+行军+围城+补给+建筑)
//
// R159 章节导航 (2711 行·**R10h 后 14 sections**)：
//   §A [L21]   AUTONOMY_TYPES 封建管辖层级 + PERMISSION_MATRIX (5 自治度·中国化)
//   §B [L161]  封臣系统 (establishVassalage·breakVassalage·calculateTotalIncome·levyVassalArmies·updateVassalSystem)
//   §C [L554]  头衔体系数据 (TITLE_LEVELS·OFFICIAL_RANKS·TITLE_CLASSES·inferTitleClass)
//   §D [L656]  头衔操作 + Title 更新 (grantTitle·inheritTitle·promoteTitle·hasPrivilege·assignOfficialRank·updateTitleSystem)
//   §E [L1183] 补给系统 (updateSupplySystem·produceSupplies·consumeSupplies·transportSupplies·createSupplyRoute·generateSupplyReport)
//   §F [L1470] 铨选三层 (QuanxuanConfig·performQuanxuan·quanxuanInitialScreen·quanxuanRefinedSelection·quanxuanFinalDecision·autoQuanxuanAndAppoint)
//   §G [L1744] 军事 + 地图 update (updateMilitary·updateMap)
//   §H [L1861] 战争意愿 (WarWeightSystem·局部 IIFE)
//   §I [L1942] CB 宣战理由 (CasusBelliSystem·局部 IIFE)
//   §J [L2048] 盟约条约 (TreatySystem·局部 IIFE)
//   §K [L2161] 阴谋系统 (SchemeSystem·局部 IIFE)
//   §L [L2458] 决断系统 (DecisionSystem·局部 IIFE)
//   §M [L2589] 工人池 (WorkerPool·局部 IIFE)
//   §N [L2671] 封建持有 (R10h·FEUDAL_HOLDING_TYPES + _tickFeudalHoldings·原 tm-tax-atomic §H)
//
// audit: web/docs/tm-feudal-audit.md (R10h done note in §4)
// ============================================================

// ============================================================
// 封建管辖层级系统（中国化）
// ============================================================
// 参考中国古代政治制度：大一统集权为常，分封羁縻为变
// 五级管辖类型，按朝廷对地方的实际控制力由强到弱排列
var AUTONOMY_TYPES = {
  zhixia:   { name: '直辖', label: '京畿直辖', desc: '郡县制，流官三年一迁，税入国库，政令直达' },
  fanguo:   { name: '藩国', label: '分封藩国', desc: '宗室或功臣受封，有实封/虚封之别；诏令须经藩王' },
  fanzhen:  { name: '藩镇', label: '藩镇自治', desc: '军政合一，节度使自任官吏、自征赋税，朝廷册封但难节制' },
  jimi:     { name: '羁縻', label: '羁縻土司', desc: '土司世袭，因俗而治，敕谕形式管辖，可行改土归流' },
  chaogong: { name: '朝贡', label: '朝贡外藩', desc: '属国外藩，仅礼制朝贡，政令不达其内，可遣使册封' }
};

// 权限矩阵：玩家对每种管辖类型的行政区划能行使的权力
// 值 = '直接' | '间接' | '不得' | '须削藩' | '改土归流' | '册封' | '征讨' | '外交' 等中国化动词
var PERMISSION_MATRIX = {
  zhixia: {
    appoint:  { allow: true,  mode: '直接任命流官',  cost: '正常铨选' },
    tax:      { allow: true,  mode: '直接征收',      cost: '由户部规范' },
    edict:    { allow: true,  mode: '诏令直达',      cost: '执行看吏治' },
    reform:   { allow: true,  mode: '可行改革',      cost: '阻力看士绅' }
  },
  fanguo_real: {  // 实封藩国（汉初诸王、明初塞王）
    appoint:  { allow: false, mode: '须削藩',        cost: '叛乱风险极高' },
    tax:      { allow: false, mode: '仅收贡奉',      cost: 'tributeRate比例' },
    edict:    { allow: true,  mode: '诏令须经藩王',  cost: '执行=藩王忠诚×能力' },
    reform:   { allow: false, mode: '不得干涉内政',  cost: '强推引藩乱' }
  },
  fanguo_nominal: {  // 虚封藩国（明中后期、清代宗室爵，食禄不治事）
    appoint:  { allow: true,  mode: '可授属官但受中央节制', cost: '名义上属朝廷' },
    tax:      { allow: true,  mode: '仅食邑N户赋税',  cost: '大头仍归国库' },
    edict:    { allow: true,  mode: '诏令通达',      cost: '藩王听命' },
    reform:   { allow: true,  mode: '可推行',        cost: '碰触食邑引不满' }
  },
  fanzhen: {  // 藩镇（中晚唐河朔三镇）
    appoint:  { allow: false, mode: '节度使自任僚佐',cost: '朝廷事后追认' },
    tax:      { allow: false, mode: '朝廷仅收名义贡',cost: '实赋归节度使' },
    edict:    { allow: true,  mode: '须先请节度使',  cost: '常被阳奉阴违' },
    reform:   { allow: false, mode: '不得置喙',      cost: '强推必反' }
  },
  jimi: {  // 羁縻/土司
    appoint:  { allow: false, mode: '土司世袭承袭',   cost: '仅敕命承认' },
    tax:      { allow: true,  mode: '按土贡定额',    cost: '不计入正赋' },
    edict:    { allow: true,  mode: '敕谕转达',      cost: '土司可拒' },
    reform:   { allow: false, mode: '须改土归流',    cost: '待时机/用兵' }
  },
  chaogong: {  // 朝贡外藩
    appoint:  { allow: false, mode: '不得干预',      cost: '唯有册封其主' },
    tax:      { allow: false, mode: '仅受朝贡贡物',  cost: '无正赋' },
    edict:    { allow: false, mode: '仅为外交辞令',  cost: '实效极低' },
    reform:   { allow: false, mode: '不得干涉',      cost: '出兵征讨方可变革' }
  }
};

/**
 * 派生某行政区划的管辖类型
 * @param {Object} division - 区划对象
 * @param {Object} faction - 所属势力对象
 * @param {string} playerFaction - 玩家势力名
 * @returns {Object} { type, subtype, key, holder, suzerain, ... }
 */
function deriveAutonomy(division, faction, playerFaction) {
  // 如果区划已有显式 autonomy 设置，优先使用
  if (division && division.autonomy && division.autonomy.type) {
    return division.autonomy;
  }
  // 从势力关系推导
  var result = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
  if (!faction) return result;

  // 玩家自己的势力——直辖
  if (faction.name === playerFaction) {
    result.type = 'zhixia';
    return result;
  }
  // 没有liege——独立势力，从玩家视角看就是"外国"（不纳入玩家管辖）
  if (!faction.liege) {
    result.type = null; // 非玩家管辖
    return result;
  }
  // 玩家是宗主
  if (faction.liege === playerFaction) {
    // 根据 relationType 决定
    var rt = faction.relationType || 'vassal';  // 默认封臣
    if (rt === 'tributary' || rt === 'chaogong') {
      result.type = 'chaogong';
    } else if (rt === 'jimi' || rt === 'tusi') {
      result.type = 'jimi';
    } else if (rt === 'fanzhen') {
      result.type = 'fanzhen';
    } else {
      // vassal（封臣）——判断实封/虚封
      result.type = 'fanguo';
      result.subtype = faction.fiefSubtype || 'nominal'; // 默认虚封
    }
    result.holder = faction.name;
    result.suzerain = playerFaction;
    result.loyalty = faction.loyaltyToLiege !== undefined ? faction.loyaltyToLiege : 60;
    result.tributeRate = faction.tributeRate || 0.3;
    return result;
  }
  // 其他势力的附庸——玩家无权管辖
  result.type = null;
  return result;
}

/**
 * 批量派生所有行政区划的管辖类型——在世界加载/势力变更后调用
 */
function applyAutonomyToAllDivisions() {
  if (!GM.adminHierarchy) return;   // 区划只留游戏里那份（GM），剧本库那份只给开局与编辑器（2026-11-15）
  var playerFaction = (P.playerInfo && P.playerInfo.factionName) || '';
  Object.keys(GM.adminHierarchy).forEach(function(fk) {
    var fh = GM.adminHierarchy[fk];
    if (!fh || !fh.divisions) return;
    var faction = (GM.facs || []).find(function(f) { return f.name === fh.name || f.name === fk; });
    (function _walkDivs(divs, parentAutonomy) {
      divs.forEach(function(d) {
        // 若已有爵位持有者，保留当前 autonomy；否则从势力派生
        if (!d.autonomy || !d.autonomy.type) {
          d.autonomy = deriveAutonomy(d, faction, playerFaction);
        }
        if (d.divisions && d.divisions.length > 0) _walkDivs(d.divisions, d.autonomy);
      });
    })(fh.divisions, null);
  });
}

// ============================================================
// 封臣系统 - 借鉴 KingOfIreland Court 层级
// ============================================================

// 建立封臣关系
function establishVassalage(vassalName, liegeName, relationType) {
  var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
  var liege = GM._indices.facByName ? GM._indices.facByName.get(liegeName) : null;

  if (!vassal || !liege) {
    toast('势力不存在');
    return false;
  }

  // 检查是否已经是封臣
  if (vassal.liege === liegeName) {
    toast(vassalName + ' 已经是 ' + liegeName + ' 的封臣');
    return false;
  }

  // 如果已有宗主，先解除旧关系
  if (vassal.liege) {
    var oldLiege = GM._indices.facByName ? GM._indices.facByName.get(vassal.liege) : null;
    if (oldLiege && oldLiege.vassals) {
      oldLiege.vassals = oldLiege.vassals.filter(function(v) { return v !== vassalName; });
    }
  }

  // 建立新关系
  vassal.liege = liegeName;
  // 管辖关系类型：vassal(封臣)/tributary(朝贡)/jimi(羁縻)/fanzhen(藩镇)
  vassal.relationType = relationType || 'vassal';
  if (!liege.vassals) liege.vassals = [];
  if (liege.vassals.indexOf(vassalName) === -1) {
    liege.vassals.push(vassalName);
  }

  // 根据时代状态调整贡奉比例
  if (GM.eraState) {
    var centralization = GM.eraState.centralControl || 0.5;
    // 集权度越高，贡奉比例越高
    vassal.tributeRate = 0.2 + (centralization * 0.4); // 20%-60%
  }
  // 朝贡关系贡奉较低（外藩象征性）
  if (vassal.relationType === 'tributary') vassal.tributeRate = Math.min(vassal.tributeRate, 0.15);
  // 羁縻贡奉极低
  if (vassal.relationType === 'jimi') vassal.tributeRate = Math.min(vassal.tributeRate, 0.1);

  // 联动更新该势力所有区划的管辖类型
  if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();

  var _relLabel = { vassal:'封臣', tributary:'朝贡外藩', jimi:'羁縻土司', fanzhen:'藩镇' }[vassal.relationType] || '封臣';
  toast(vassalName + ' 成为 ' + liegeName + ' 的' + _relLabel);
  return true;
}

// 解除封臣关系
function breakVassalage(vassalName) {
  var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
  if (!vassal || !vassal.liege) {
    toast('该势力没有宗主');
    return false;
  }

  var liegeName = vassal.liege;
  var liege = GM._indices.facByName ? GM._indices.facByName.get(liegeName) : null;

  // 解除关系
  vassal.liege = null;
  vassal.relationType = null;
  if (liege && liege.vassals) {
    liege.vassals = liege.vassals.filter(function(v) { return v !== vassalName; });
  }
  // 联动刷新管辖
  if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();

  toast(vassalName + ' 脱离 ' + liegeName + ' 的控制');
  return true;
}

// 递归计算势力总收入（包含封臣贡奉）
function calculateTotalIncome(factionName, _visited) {
  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction) return 0;

  // 环检测：防止循环封臣关系导致无限递归
  if (!_visited) _visited = {};
  if (_visited[factionName]) return 0;
  _visited[factionName] = true;

  var totalIncome = 0;

  // 1. 直辖收入（领地建筑收入）
  if (P.buildingSystem && P.buildingSystem.enabled) {
    var buildingEffects = applyBuildingEffectsToFaction(faction);
    totalIncome += buildingEffects.income || 0;
  }

  // 2. 基础收入
  var baseIncome = P.economyConfig ? P.economyConfig.baseIncome : 100;
  if (faction.territories && faction.territories.length > 0) {
    totalIncome += baseIncome * faction.territories.length;
  } else {
    totalIncome += baseIncome;
  }

  // 3. 封臣贡奉（仅计算，不扣除——扣除在 updateVassalSystem 中处理）
  if (faction.vassals && faction.vassals.length > 0) {
    faction.vassals.forEach(function(vassalName) {
      var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
      if (vassal) {
        var vassalIncome = calculateTotalIncome(vassalName, _visited);
        var tribute = vassalIncome * (vassal.tributeRate || 0.3);
        totalIncome += tribute;
      }
    });
  }

  return totalIncome;
}

// 更新封臣系统（每回合调用）
function updateVassalSystem() {
  if (!GM.facs) return;

  var centralization = (GM.eraState && GM.eraState.centralControl) || 0.5;
  var dynastyPhase = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';

  // 1. 封臣忠诚度动态调整 + 危机检测
  GM.facs.forEach(function(faction) {
    if (!faction.liege) return;

    var ruler = GM.chars ? GM.chars.find(function(c) {
      return c.faction === faction.name && c.alive !== false && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886');
    }) : null;

    if (ruler) {
      var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
      // 集权度影响封臣忠诚度自然漂移
      if (centralization > 0.7) {
        if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ruler, 1 * _ms, '\u4E2D\u592E\u96C6\u6743\u589E\u5F3A\uFF0C\u5C01\u81E3\u5F52\u5FC3', { source:'feudal-centralization-drift', oncePerTurn:true });
        else ruler.loyalty = Math.min(100, ((typeof ruler.loyalty === 'number' && isFinite(ruler.loyalty)) ? ruler.loyalty : 50) + 1 * _ms);
      } else if (centralization < 0.3) {
        if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ruler, -1 * _ms, '\u4E2D\u592E\u96C6\u6743\u504F\u5F31\uFF0C\u5C01\u81E3\u79BB\u5FC3', { source:'feudal-centralization-drift', oncePerTurn:true });
        else ruler.loyalty = Math.max(0, ((typeof ruler.loyalty === 'number' && isFinite(ruler.loyalty)) ? ruler.loyalty : 50) - 1 * _ms);
      }

      // 王朝衰落期额外降低忠诚
      if (dynastyPhase === 'decline' || dynastyPhase === 'collapse') {
        if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ruler, -1 * _ms, '\u738B\u671D\u8870\u843D\u671F\u5C01\u81E3\u79BB\u5FC3', { source:'feudal-dynasty-decline-drift', oncePerTurn:true });
        else ruler.loyalty = Math.max(0, ((typeof ruler.loyalty === 'number' && isFinite(ruler.loyalty)) ? ruler.loyalty : 50) - 1 * _ms);
      }

      // 获取叛乱阈值（从封臣类型定义中取，或默认25）
      var rebellionThreshold = 25;
      if (P.vassalSystem && P.vassalSystem.vassalTypes && faction.vassalType) {
        var vtDef = P.vassalSystem.vassalTypes.find(function(v) { return v.name === faction.vassalType; });
        if (vtDef && vtDef.rebellionThreshold) rebellionThreshold = vtDef.rebellionThreshold;
      }

      // 低忠诚度→封臣危机 / 叛乱执行
      var _rebCfg = (P.vassalSystem && P.vassalSystem.rebellionConfig) || {};
      var _rebCheckInterval = _rebCfg.checkIntervalMonths || 3;
      var _rebCheckTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(_rebCheckInterval) : 3;
      var _shouldCheckReb = (_rebCheckTurns <= 1) || (GM.turn % _rebCheckTurns === 0);

      if (ruler.loyalty < rebellionThreshold && _shouldCheckReb) {
        // 叛乱概率检定
        var _rebBaseChance = _rebCfg.baseChancePerYear || 0.6;
        var _rebTR = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
        var _rebChance = _rebBaseChance * _rebTR * (_rebCheckInterval / 12);
        // 性格加成：胆大更易叛乱
        if (ruler.ambition) _rebChance += (ruler.ambition / 100) * (_rebCfg.boldnessWeight || 0.15);
        // 忠诚越低越易叛
        _rebChance += (rebellionThreshold - ruler.loyalty) * 0.01;
        _rebChance = Math.min(0.95, Math.max(0.05, _rebChance));

        if ((typeof random === 'function' ? random() : Math.random()) < _rebChance) {
          // ═══ 叛乱发生！═══
          addEB('叛乱', '⚠ ' + faction.name + '首领' + ruler.name + '忠诚仅' + ruler.loyalty + '，愤而举旗叛乱！');

          // 断开封臣关系
          if (_rebCfg.autoBreakVassalage !== false && typeof breakVassalage === 'function') {
            breakVassalage(faction.name);
          }

          // 创建战争记录
          var _liegeFac = (GM.facs || []).find(function(f) { return f.name === faction.liege; });
          if (_liegeFac) {
            if (!GM.activeWars) GM.activeWars = [];
            GM.activeWars.push({
              id: uid(),
              attacker: faction.name,
              defender: _liegeFac.name,
              casusBelli: 'rebellion',
              startTurn: GM.turn,
              warScore: 0
            });
          }

          // 叛军士气加成
          var _rebMoraleBonus = _rebCfg.rebelMoraleBonus || 10;
          (GM.armies || []).forEach(function(a) {
            if (a.faction === faction.name) {
              a.morale = Math.min(100, (a.morale || 50) + _rebMoraleBonus);
            }
          });

          // 记入本回合结果（供AI prompt注入）
          if (!GM._turnRebellionResults) GM._turnRebellionResults = [];
          GM._turnRebellionResults.push({
            rebel: faction.name,
            rebelLeader: ruler.name,
            liege: faction.liege || '中央',
            loyalty: ruler.loyalty,
            turn: GM.turn
          });
        } else {
          addEB('封臣危机', faction.name + '首领' + ruler.name + '忠诚度仅' + ruler.loyalty + '，有叛乱倾向（本回合未发生）');
        }
      } else if (ruler.loyalty < rebellionThreshold + 10 && (centralization < 0.4 || dynastyPhase === 'decline')) {
        addEB('封臣动态', faction.name + '封臣' + ruler.name + '忠诚度' + ruler.loyalty + '，局势不稳');
      }
    }

    // 贡奉比例受集权度影响动态调整
    // 特权检查：tax_exempt → 免除朝贡
    var _vassalRulerName = ruler ? ruler.name : '';
    if (_vassalRulerName && typeof hasPrivilege === 'function' && hasPrivilege(_vassalRulerName, 'tax_exempt')) {
      faction._effectiveTributeRate = 0;
      // 跳过后续贡奉计算（直接设为0已赋值）
    }
    var baseTribute = faction.tributeRate || 0.3;
    var adjustedTribute = baseTribute;
    if (centralization > 0.7) {
      adjustedTribute = Math.min(0.8, baseTribute * 1.1); // 高集权→贡奉略增
    } else if (centralization < 0.3 && ruler && ruler.loyalty < 50) {
      adjustedTribute = Math.max(0.05, baseTribute * 0.7); // 低集权+低忠诚→贡奉减少
    }
    faction._effectiveTributeRate = adjustedTribute;
  });

  // 2. 计算并应用封臣贡奉
  GM.facs.forEach(function(faction) {
    if (!faction.vassals || faction.vassals.length === 0) return;

    var totalTribute = 0;
    faction.vassals.forEach(function(vassalName) {
      var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
      if (!vassal) return;

      var vassalIncome = calculateTotalIncome(vassalName);
      var effectiveRate = vassal._effectiveTributeRate || vassal.tributeRate || 0.3;
      var tribute = Math.round(vassalIncome * effectiveRate);
      totalTribute += tribute;

      // 从封臣收入中扣除贡奉（确保不为NaN）
      if (typeof vassal.money === 'number') {
        vassal.money -= tribute;
      }
    });

    // 宗主获得贡奉
    if (typeof faction.money === 'number') {
      faction.money += totalTribute;
    }
  });

  // 3. 清理无效封臣引用（封臣势力被灭后自动解除）
  GM.facs.forEach(function(faction) {
    if (faction.vassals && faction.vassals.length > 0) {
      faction.vassals = faction.vassals.filter(function(vn) {
        var vf = GM._indices.facByName ? GM._indices.facByName.get(vn) : null;
        if (!vf || (vf.strength !== undefined && vf.strength <= 0)) {
          return false; // 势力不存在或已覆灭
        }
        return true;
      });
    }
    if (faction.liege) {
      var lf = GM._indices.facByName ? GM._indices.facByName.get(faction.liege) : null;
      if (!lf || (lf.strength !== undefined && lf.strength <= 0)) {
        faction.liege = null; // 宗主不存在或已覆灭，自动脱离
      }
    }
  });
}

// ============================================================
// 头衔系统 - 借鉴 KingOfIreland Title 系统
// ============================================================

// 爵位等级（优先从剧本配置P.titleSystem.titleRanks读取，此为通用默认值）
var _DEFAULT_TITLE_LEVELS = {
  emperor: { name: '皇帝', level: 0, privileges: ['supreme_authority', 'appoint_all', 'levy_all'] },
  king: { name: '王', level: 1, privileges: ['regional_authority', 'appoint_officials', 'levy_vassals'] },
  duke: { name: '公', level: 2, privileges: ['local_authority', 'appoint_subordinates', 'levy_limited'] },
  marquis: { name: '侯', level: 3, privileges: ['limited_authority', 'appoint_assistants'] },
  earl: { name: '伯', level: 4, privileges: ['basic_authority'] },
  viscount: { name: '子', level: 5, privileges: [] },
  baron: { name: '男', level: 6, privileges: [] }
};
/** 获取当前剧本的爵位等级定义（统一返回对象格式） */
function getTitleLevels() {
  if (P.titleSystem && P.titleSystem.titleRanks) {
    var ranks = P.titleSystem.titleRanks;
    // 如果是数组（编辑器格式），转为对象
    if (Array.isArray(ranks) && ranks.length > 0) {
      var obj = {};
      ranks.forEach(function(r) {
        var key = (r.name || '').replace(/\s/g, '_').toLowerCase() || ('rank_' + (r.level || 0));
        obj[key] = {
          name: r.name || key, level: r.level || 0,
          privileges: Array.isArray(r.privileges) ? r.privileges : (r.privileges ? [r.privileges] : []),
          salary: r.salary || 0, landGrant: !!r.landGrant,
          maxHolders: r.maxHolders || 0, degradeRule: r.degradeRule || '',
          succession: r.succession || '', category: r.category || '',
          associatedPosts: r.associatedPosts || []
        };
      });
      return obj;
    }
    // 如果已经是对象格式
    if (typeof ranks === 'object' && !Array.isArray(ranks) && Object.keys(ranks).length > 0) {
      return ranks;
    }
  }
  return _DEFAULT_TITLE_LEVELS;
}
var TITLE_LEVELS = _DEFAULT_TITLE_LEVELS; // 兼容直接引用

// 官职品级（优先从剧本配置读取，此为九品制通用默认值）
var _DEFAULT_OFFICIAL_RANKS = {
  rank1: { name: '一品', level: 1, salary: 1000 },
  rank2: { name: '二品', level: 2, salary: 800 },
  rank3: { name: '三品', level: 3, salary: 600 },
  rank4: { name: '四品', level: 4, salary: 400 },
  rank5: { name: '五品', level: 5, salary: 300 },
  rank6: { name: '六品', level: 6, salary: 200 },
  rank7: { name: '七品', level: 7, salary: 150 },
  rank8: { name: '八品', level: 8, salary: 100 },
  rank9: { name: '九品', level: 9, salary: 80 }
};
/** 获取当前剧本的官职品级定义 */
function _normalizeOfficialRanks(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    var out = {};
    raw.forEach(function(name, idx) {
      var key = 'rank_' + (idx + 1);
      out[key] = {
        name: String(name),
        level: idx + 1,
        salary: Math.max(20, Math.round(1000 - idx * 45))
      };
    });
    return out;
  }
  if (typeof raw === 'object' && Object.keys(raw).length > 0) return raw;
  return null;
}

function _readEngineOfficialRanks() {
  var sources = [];
  if (typeof GM !== 'undefined' && GM) sources.push(GM);
  if (typeof P !== 'undefined' && P) sources.push(P);
  if (typeof scriptData !== 'undefined' && scriptData) sources.push(scriptData);
  for (var i = 0; i < sources.length; i++) {
    try {
      if (typeof TM !== 'undefined' && TM.EngineConstants && typeof TM.EngineConstants.read === 'function') {
        var fromEngine = TM.EngineConstants.read('officialRanks', sources[i]);
        var normalizedEngine = _normalizeOfficialRanks(fromEngine);
        if (normalizedEngine) return normalizedEngine;
      }
      var direct = sources[i].engineConstants && sources[i].engineConstants.officialRanks;
      var normalizedDirect = _normalizeOfficialRanks(direct);
      if (normalizedDirect) return normalizedDirect;
    } catch (_) {}
  }
  return null;
}

function getOfficialRanks() {
  var engineRanks = _readEngineOfficialRanks();
  if (engineRanks) return engineRanks;
  return (P.officialRanks && Object.keys(P.officialRanks).length > 0)
    ? _normalizeOfficialRanks(P.officialRanks) : _DEFAULT_OFFICIAL_RANKS;
}
var OFFICIAL_RANKS = _DEFAULT_OFFICIAL_RANKS; // 兼容直接引用

// ============================================================
// 爵位分类（中国古代制度）与封地绑定
// ============================================================
// 爵位类别——决定该爵位是否可持封地、封地类型如何
var TITLE_CLASSES = {
  // 宗室王爵（亲王/郡王）——多为虚封（明代塞王除外有兵权）
  royal_prince: {
    name: '宗室王爵', examples: ['亲王','郡王','嗣王'],
    canHoldFief: true,       // 可持封地
    fiefSubtype: 'nominal',  // 默认虚封（明清制）；特殊时代可实封
    allowRealFief: true,     // 允许改为实封（如明初塞王）
    hereditaryDefault: true,
    autonomyTypeDerived: 'fanguo'
  },
  // 勋贵爵（国公/郡公/县公）——功臣，多虚封食邑
  meritorious_duke: {
    name: '勋贵公爵', examples: ['国公','郡公','县公'],
    canHoldFief: true,
    fiefSubtype: 'nominal',
    allowRealFief: false,
    hereditaryDefault: false, // 流爵为主
    autonomyTypeDerived: 'fanguo'
  },
  // 列侯（彻侯/关内侯/开国县侯）——汉唐制，食邑N户
  marquess: {
    name: '列侯', examples: ['彻侯','关内侯','开国县侯','开国县伯'],
    canHoldFief: true,
    fiefSubtype: 'nominal',
    allowRealFief: false,
    hereditaryDefault: false,
    autonomyTypeDerived: 'fanguo'
  },
  // 周五等爵（公侯伯子男）——古制，周分封
  five_ranks: {
    name: '五等爵', examples: ['公','侯','伯','子','男'],
    canHoldFief: true,
    fiefSubtype: 'real',     // 古制实封
    allowRealFief: true,
    hereditaryDefault: true,
    autonomyTypeDerived: 'fanguo'
  },
  // 土司爵（宣慰司/宣抚司/安抚司/长官司）——边疆羁縻
  tusi: {
    name: '土司爵', examples: ['宣慰使','宣抚使','安抚使','长官司'],
    canHoldFief: true,
    fiefSubtype: null,       // 不适用
    hereditaryDefault: true,  // 世袭
    autonomyTypeDerived: 'jimi'
  },
  // 外藩王（属国国王/部族可汗）——朝贡
  foreign_king: {
    name: '外藩王', examples: ['国王','可汗','单于'],
    canHoldFief: true,
    fiefSubtype: null,
    hereditaryDefault: true,
    autonomyTypeDerived: 'chaogong'
  },
  // 节度使（藩镇主）——军政合一
  military_governor: {
    name: '节度使', examples: ['节度使','经略使','观察使'],
    canHoldFief: true,
    fiefSubtype: null,
    hereditaryDefault: false, // 原不世袭，安史后实际自成体系
    autonomyTypeDerived: 'fanzhen'
  },
  // 无爵位（荣誉/散官）
  honorary: {
    name: '散爵', examples: ['散骑常侍','荣禄大夫','光禄大夫'],
    canHoldFief: false,
    hereditaryDefault: false,
    autonomyTypeDerived: null
  }
};

/**
 * 按爵位名推断其类别
 */
function inferTitleClass(titleName) {
  if (!titleName) return 'honorary';
  var keys = Object.keys(TITLE_CLASSES);
  for (var i = 0; i < keys.length; i++) {
    var cls = TITLE_CLASSES[keys[i]];
    if (cls.examples && cls.examples.some(function(ex) { return titleName.indexOf(ex) >= 0; })) {
      return keys[i];
    }
  }
  return 'honorary';
}

// 为角色授予头衔（支持key查找或直接传名称）
function grantTitle(characterName, titleType, titleLevel, hereditary) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character) {
    toast('角色不存在');
    return false;
  }

  // 从当前爵位定义中查找（兼容key和name两种方式）
  var currentLevels = getTitleLevels();
  var titleInfo = currentLevels[titleType];
  if (!titleInfo) {
    // 按 name 字段查找
    var keys = Object.keys(currentLevels);
    for (var k = 0; k < keys.length; k++) {
      if (currentLevels[keys[k]].name === titleType) {
        titleInfo = currentLevels[keys[k]];
        titleType = keys[k];
        break;
      }
    }
  }
  if (!titleInfo) {
    // 允许自定义头衔名（AI可能传中文名）
    titleInfo = { name: titleType, level: titleLevel || 5, privileges: [] };
  }

  // 初始化头衔字段
  if (!character.titles) character.titles = [];

  // 检查是否已有该头衔
  var existingTitle = character.titles.find(function(t) {
    return t.type === titleType || t.name === titleInfo.name;
  });

  if (existingTitle) {
    toast(characterName + ' 已拥有 ' + titleInfo.name + ' 头衔');
    return false;
  }

  // 推断中国爵位类别（宗室王爵/勋贵公爵/列侯/五等爵/土司/外藩王/节度使/散爵）
  var titleClass = inferTitleClass(titleInfo.name);
  var classDef = TITLE_CLASSES[titleClass] || {};

  // 创建头衔
  var title = {
    type: titleType,
    name: titleInfo.name,
    level: titleInfo.level,
    titleClass: titleClass,                            // 中国爵位类别
    privileges: titleInfo.privileges || [],
    _suppressed: [], // 被集权压制的特权（可恢复）
    hereditary: hereditary !== undefined ? hereditary : (classDef.hereditaryDefault || false),
    canHoldFief: classDef.canHoldFief || false,
    fiefSubtype: classDef.fiefSubtype || null,
    grantedTurn: GM.turn,
    grantedBy: '朝廷'
  };

  character.titles.push(title);

  addEB('册封', characterName + ' 被册封为 ' + titleInfo.name + '(' + (classDef.name || '爵') + ')');
  toast(characterName + ' 被册封为 ' + titleInfo.name);
  return true;
}

// 剥夺头衔

// 头衔继承
function inheritTitle(deceasedName, heirName, titleType) {
  var deceased = GM._indices.charByName ? GM._indices.charByName.get(deceasedName) : null;
  var heir = GM._indices.charByName ? GM._indices.charByName.get(heirName) : null;

  if (!deceased || !heir) {
    toast('角色不存在');
    return false;
  }

  if (!deceased.titles || deceased.titles.length === 0) {
    return false; // 没有头衔可继承
  }

  // 查找指定头衔
  var title = deceased.titles.find(function(t) {
    return t.type === titleType;
  });

  if (!title) {
    return false;
  }

  // 检查是否可继承
  if (!title.hereditary) {
    // 非世袭头衔，根据时代状态决定是否继承
    if (GM.eraState) {
      var centralization = GM.eraState.centralControl || 0.5;
      // 集权度低时，更容易世袭
      if (centralization > 0.6) {
        toast(title.name + ' 为流官，不可世袭');
        return false;
      }
    }
  }

  // 继承头衔
  if (!heir.titles) heir.titles = [];

  var inheritedTitle = {
    type: title.type,
    name: title.name,
    level: title.level,
    privileges: title.privileges || [],
    hereditary: title.hereditary,
    grantedTurn: GM.turn,
    grantedBy: deceasedName + '（继承）'
  };

  heir.titles.push(inheritedTitle);

  // 联动：将逝者名下的封地过继给继承人
  if (GM.adminHierarchy) {
    Object.keys(GM.adminHierarchy).forEach(function(fk) {
      var fh = GM.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.autonomy && d.autonomy.holder === deceasedName) {
            d.autonomy.holder = heirName;
            d.autonomy.grantedTurn = GM.turn;
            // 继承初期忠诚度偏低（新君/旧臣关系）
            d.autonomy.loyalty = Math.max(50, (d.autonomy.loyalty || 70) - 15);
          }
          if (d.children) _walk(d.children);   // 府县封地也过继
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }

  // 记录事件
  addEB('继承', heirName + ' 继承了 ' + deceasedName + ' 的 ' + title.name + ' 头衔');

  toast(heirName + ' 继承了 ' + title.name + ' 头衔');
  return true;
}

// 检查角色是否拥有特权
function hasPrivilege(characterName, privilege) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character || !character.titles) {
    return false;
  }

  for (var i = 0; i < character.titles.length; i++) {
    var title = character.titles[i];
    if (title.privileges && title.privileges.indexOf(privilege) !== -1) {
      return true;
    }
  }

  return false;
}

// 获取角色的最高头衔

// 为官职添加品级
function assignOfficialRank(characterName, position, rank) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character) {
    toast('角色不存在');
    return false;
  }

  var ranks = (typeof getOfficialRanks === 'function') ? getOfficialRanks() : OFFICIAL_RANKS;
  var rankInfo = ranks[rank];
  if (!rankInfo) {
    Object.keys(ranks || {}).some(function(key) {
      if (ranks[key] && ranks[key].name === rank) {
        rank = key;
        rankInfo = ranks[key];
        return true;
      }
      return false;
    });
  }
  if (!rankInfo) {
    toast('品级无效');
    return false;
  }

  // 更新角色的官职信息
  character.position = position;
  character.officialRank = rank;
  character.officialRankName = rankInfo.name;
  character.salary = rankInfo.salary;

  toast(characterName + ' 被任命为 ' + position + '（' + rankInfo.name + '）');
  return true;
}

// 更新头衔系统（每回合调用）
function updateTitleSystem() {
  // 1. 根据时代状态动态调整头衔特权（suppressed标记，可恢复）
  if (GM.eraState) {
    var centralization = GM.eraState.centralControl || 0.5;
    var _suppressTargets = ['appoint_subordinates', 'appoint_assistants', 'levy_limited'];

    GM.chars.forEach(function(character) {
      if (!character.titles || character.titles.length === 0 || character.alive === false) return;
      character.titles.forEach(function(title) {
        if (!title.privileges) title.privileges = [];
        if (!title._suppressed) title._suppressed = [];

        if (centralization > 0.7) {
          // 高集权：压制地方特权（移入_suppressed，不永久删除）
          _suppressTargets.forEach(function(p) {
            var idx = title.privileges.indexOf(p);
            if (idx !== -1) {
              title.privileges.splice(idx, 1);
              if (title._suppressed.indexOf(p) === -1) title._suppressed.push(p);
            }
          });
        } else if (centralization < 0.4) {
          // 低集权：恢复被压制的特权
          if (title._suppressed.length > 0) {
            title._suppressed.forEach(function(p) {
              if (title.privileges.indexOf(p) === -1) title.privileges.push(p);
            });
            title._suppressed = [];
          }
        }
      });
    });
  }

  // 2. 检查头衔限额（maxHolders）
  var currentLevels = getTitleLevels();
  var titleKeys = Object.keys(currentLevels);
  titleKeys.forEach(function(key) {
    var def = currentLevels[key];
    if (def.maxHolders && def.maxHolders > 0) {
      var holders = GM.chars.filter(function(c) {
        return c.alive !== false && c.titles && c.titles.some(function(t) { return t.name === def.name || t.type === key; });
      });
      if (holders.length > def.maxHolders) {
        addEB('\u7235\u4F4D', def.name + '\u6301\u6709\u8005' + holders.length + '\u4EBA\u8D85\u51FA\u9650\u989D' + def.maxHolders);
      }
    }
  });
}

// 更新补给系统
function updateSupplySystem() {
  if (!P.supplySystem || !P.supplySystem.enabled) return;

  // 1. 生产补给（每回合自动生产）
  produceSupplies();

  // 2. 军队消耗补给
  consumeSupplies();

  // 3. 运输补给（沿补给线路）
  transportSupplies();

  // 4. 检查补给不足的军队
  checkSupplyShortage();
}

// 生产补给
function produceSupplies() {
  if (!GM.supplyDepots || !Array.isArray(GM.supplyDepots)) return;
  GM.supplyDepots.forEach(function(depot) {
    var faction = findFacByName(depot.faction);
    if (!faction) return;

    // 基础生产量（基于势力经济，按天数缩放）
    var _sms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    var baseProduction = (faction.money || 0) / 100 * _sms;
    var eraState = GM.eraState || P.eraState || {};
    var prosperity = eraState.economicProsperity || 0.5;

    // 生产各类补给
    depot.supplies.food = Math.min(depot.capacity, depot.supplies.food + baseProduction * prosperity * 10);
    depot.supplies.weapon = Math.min(depot.capacity * 0.2, depot.supplies.weapon + baseProduction * 0.5);
    depot.supplies.armor = Math.min(depot.capacity * 0.1, depot.supplies.armor + baseProduction * 0.3);
    depot.supplies.medicine = Math.min(depot.capacity * 0.05, depot.supplies.medicine + baseProduction * 0.2);
    depot.supplies.fodder = Math.min(depot.capacity * 0.15, depot.supplies.fodder + baseProduction * 0.8);
  });
}

// 消耗补给
function consumeSupplies() {
  if (!GM.armies || !Array.isArray(GM.armies)) return;
  GM.armies.forEach(function(army) {
    if (!army.supplyDepotId) {
      // 未指定补给来源，尝试从势力主仓库获取
      var faction = findFacByName(army.faction);
      if (faction && faction.supplyDepots && faction.supplyDepots.length > 0) {
        army.supplyDepotId = faction.supplyDepots[0];
      }
    }

    if (!army.supplyDepotId) return;

    var depot = GM._indices.supplyDepotById.get(army.supplyDepotId);
    if (!depot) return;

    var soldiers = army.soldiers || 0;
    if (soldiers === 0) return;

    // 计算消耗量
    var foodConsume = soldiers * SupplyTypes.food.consumeRate;
    var weaponConsume = soldiers * SupplyTypes.weapon.consumeRate;
    var armorConsume = soldiers * SupplyTypes.armor.consumeRate;
    var medicineConsume = soldiers * SupplyTypes.medicine.consumeRate;

    // 骑兵额外消耗马料
    var cavalryCount = 0;
    if (army.units) {
      army.units.forEach(function(unitId) {
        var unit = GM._indices.unitById.get(unitId);
        if (unit && (unit.type === 'cavalry' || unit.type === 'heavy_cavalry')) {
          cavalryCount += unit.count;
        }
      });
    }
    var fodderConsume = cavalryCount * SupplyTypes.fodder.consumeRate;

    // 从仓库扣除
    var actualFood = Math.min(foodConsume, depot.supplies.food);
    var actualWeapon = Math.min(weaponConsume, depot.supplies.weapon);
    var actualArmor = Math.min(armorConsume, depot.supplies.armor);
    var actualMedicine = Math.min(medicineConsume, depot.supplies.medicine);
    var actualFodder = Math.min(fodderConsume, depot.supplies.fodder);

    depot.supplies.food -= actualFood;
    depot.supplies.weapon -= actualWeapon;
    depot.supplies.armor -= actualArmor;
    depot.supplies.medicine -= actualMedicine;
    depot.supplies.fodder -= actualFodder;

    // 计算补给充足度
    var supplyRatio = (actualFood / foodConsume + actualWeapon / weaponConsume +
                       actualArmor / armorConsume + actualMedicine / medicineConsume) / 4;

    if (cavalryCount > 0) {
      supplyRatio = (supplyRatio * 4 + actualFodder / fodderConsume) / 5;
    }

    // 记录补给状态
    army.supplyRatio = supplyRatio;

    // 补给不足影响士气（按timeRatio缩放）
    var _supTR = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var _supScale = _supTR * 12; // 月度缩放因子（月制=1, 日制≈0.033, 年制=12）
    var _supCfg = (P.battleConfig && P.battleConfig.supplyConfig) || {};
    var _lowLoss = (_supCfg.lowSupplyMoraleLoss || 10) * _supScale;
    var _starveLoss = (_supCfg.starvationMoraleLoss || 20) * _supScale;

    if (supplyRatio < 0.2) {
      // 严重断供/断粮——大幅士气损失+兵力损耗
      army.morale = Math.max(0, (army.morale || 70) - _starveLoss);
      var _attrition = Math.floor(soldiers * 0.02 * _supScale); // 月损2%
      army.soldiers = Math.max(0, soldiers - _attrition);
      // 可能兵变（士气<15时50%概率）
      if ((army.morale || 0) < 15 && (typeof random === 'function' ? random() : Math.random()) < 0.5 * _supScale) {
        addEB('兵变', army.name + '因断粮发生兵变！');
        army.morale = 0;
        army.loyalty = Math.max(0, (army.loyalty || 50) - 30);
      }
    } else if (supplyRatio < 0.5) {
      army.morale = Math.max(0, (army.morale || 70) - _lowLoss);
      var _attrition2 = Math.floor(soldiers * 0.01 * _supScale); // 月损1%
      army.soldiers = Math.max(0, soldiers - _attrition2);
    } else if (supplyRatio < 0.8) {
      army.morale = Math.max(0, (army.morale || 70) - 2 * _supScale);
    }
  });
}

// 运输补给
function transportSupplies() {
  if (!GM.supplyRoutes || GM.supplyRoutes.length === 0) return;

  GM.supplyRoutes.forEach(function(route) {
    if (!route.active) return;

    var sourceDepot = GM._indices.supplyDepotById.get(route.sourceId);
    var targetDepot = GM._indices.supplyDepotById.get(route.targetId);

    if (!sourceDepot || !targetDepot) return;

    // 运输量（每回合固定量）
    var transportAmount = route.capacity || 100;

    // 按比例运输各类补给
    Object.keys(SupplyTypes).forEach(function(type) {
      var amount = Math.min(transportAmount * 0.2, sourceDepot.supplies[type]);
      if (amount > 0 && targetDepot.supplies[type] < targetDepot.capacity) {
        sourceDepot.supplies[type] -= amount;
        targetDepot.supplies[type] = Math.min(targetDepot.capacity, targetDepot.supplies[type] + amount);
      }
    });
  });
}

// 检查补给不足
function checkSupplyShortage() {
  if (!GM.armies || !Array.isArray(GM.armies)) return;
  GM.armies.forEach(function(army) {
    if (army.supplyRatio !== undefined && army.supplyRatio < 0.3) {
      addEB('补给', army.name + ' 补给严重不足（' + (army.supplyRatio * 100).toFixed(0) + '%），士气下降');
    }
  });
}

/**
 * 生成补给状态的AI prompt注入文本
 * @returns {string}
 */
function getSupplyPromptInjection() {
  if (!GM.armies || !Array.isArray(GM.armies)) return '';
  var lines = [];
  GM.armies.forEach(function(army) {
    if (!army.soldiers || army.soldiers <= 0) return;
    if (army.supplyRatio === undefined) return;
    var status = army.supplyRatio >= 0.8 ? '充足' : army.supplyRatio >= 0.5 ? '紧张' : army.supplyRatio >= 0.2 ? '匮乏' : '断粮';
    if (status !== '充足') {
      lines.push('  ' + (army.name||'某军') + ': 补给' + status + '(' + (army.supplyRatio*100).toFixed(0) + '%)' +
        (status === '断粮' ? ' ⚠ 士气骤降，可能兵变' : ''));
    }
  });
  if (lines.length === 0) return '';
  return '【补给状况】\n' + lines.join('\n');
}

// 切断补给线路

// ============================================================
// 铨选三层候选人分级系统
// ============================================================

// 铨选系统：模拟中国古代官员选拔的三层筛选机制
// 第一层：初筛（资格审查）
// 第二层：精选（能力评估）
// 第三层：最终决策（综合权衡）

// 铨选配置
var QuanxuanConfig = {
  // 初筛标准
  initialScreen: {
    minAge: 20,
    maxAge: 70,
    minLoyalty: 30,
    minIntelligence: 20,
    requiredStatus: ['alive', 'available'] // 必须存活且可用
  },

  // 精选标准
  refinedSelection: {
    excellentThreshold: 0.8,  // 优秀：综合得分 > 0.8
    qualifiedThreshold: 0.5,  // 合格：综合得分 > 0.5
    // 不合格：综合得分 <= 0.5
  },

  // 最终决策权重
  finalDecision: {
    abilityWeight: 0.4,
    loyaltyWeight: 0.3,
    relationshipWeight: 0.2,
    eraFactorWeight: 0.1
  }
};

// 第一层：初筛（资格审查）
function quanxuanInitialScreen(post, context) {
  if (!GM.chars || GM.chars.length === 0) return [];

  var config = QuanxuanConfig.initialScreen;
  var candidates = [];

  GM.chars.forEach(function(char) {
    // 基本资格检查
    if (char.alive === false) return;
    if (char.isPlayer) return; // 玩家角色不参与铨选

    // 年龄检查
    var age = typeof getValidAge === 'function' ? getValidAge(char, 30) : (Number.isFinite(char.age) && char.age >= 0 ? Math.floor(char.age) : 30);
    if (age < config.minAge || age > config.maxAge) return;

    // 忠诚度检查
    var loyalty = char.loyalty || 50;
    if (loyalty < config.minLoyalty) return;

    // 智谋检查
    var intelligence = char.intelligence || 50;
    if (intelligence < config.minIntelligence) return;

    // 岗位特定要求检查
    if (post.requirements) {
      if (post.requirements.minIntelligence && intelligence < post.requirements.minIntelligence) return;
      if (post.requirements.minValor && (char.valor || 50) < post.requirements.minValor) return;
      if (post.requirements.minLoyalty && loyalty < post.requirements.minLoyalty) return;
    }

    // 通过初筛
    candidates.push({
      name: char.name,
      character: char,
      screenLevel: 'initial'
    });
  });

  return candidates;
}

