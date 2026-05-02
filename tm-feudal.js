// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-feudal.js — 封建·封臣·头衔·爵位·铨选·战争 (R130 从 tm-military.js L2286-end 拆出)
// 姊妹: tm-military.js (战斗+行军+围城+补给+建筑)
// 包含: AUTONOMY_TYPES/封臣系统/头衔/爵位类别/铨选三层/战争意愿/CB 宣战理由/
//       盟约条约/阴谋系统/行军系统增强/称王称帝决策
//
// R159 章节导航 (2596 行)：
//   §1 [L10]   AUTONOMY_TYPES 封建自治度等级
//   §2 [L150]  封臣系统 (封授/收回/继承)
//   §3 [L500]  头衔 + 爵位类别 (公侯伯子男·爵位降等)
//   §4 [L900]  铨选三层 (中央/地方/世袭)
//   §5 [L1300] 战争意愿 + CB 宣战理由
//   §6 [L1700] 盟约条约 (互不侵犯·军事同盟·朝贡)
//   §7 [L2000] 阴谋系统 (暗杀/逼宫/篡位)
//   §8 [L2300] 行军系统增强 + 称王称帝决策
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
 * 获取某种管辖类型的权限矩阵条目
 */
function getAutonomyPermission(autonomy) {
  if (!autonomy || !autonomy.type) return null;
  var key = autonomy.type;
  if (key === 'fanguo') {
    key = 'fanguo_' + (autonomy.subtype === 'real' ? 'real' : 'nominal');
  }
  return PERMISSION_MATRIX[key] || null;
}

/**
 * 批量派生所有行政区划的管辖类型——在世界加载/势力变更后调用
 */
function applyAutonomyToAllDivisions() {
  if (!P.adminHierarchy) return;
  var playerFaction = (P.playerInfo && P.playerInfo.factionName) || '';
  Object.keys(P.adminHierarchy).forEach(function(fk) {
    var fh = P.adminHierarchy[fk];
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

// 征召封臣军队
function levyVassalArmies(liegeName) {
  var liege = GM._indices.facByName ? GM._indices.facByName.get(liegeName) : null;
  if (!liege || !liege.vassals || liege.vassals.length === 0) {
    toast('没有可征召的封臣');
    return [];
  }

  var leviedArmies = [];

  liege.vassals.forEach(function(vassalName) {
    var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
    if (!vassal) return;

    // 根据忠诚度决定征召比例
    var vassalRuler = GM.chars.find(function(c) {
      return c.faction === vassalName && (c.position === '君主' || c.position === '首领');
    });

    var loyalty = vassalRuler ? (vassalRuler.loyalty || 50) : 50;
    var levyRate = 0;

    // 特权检查：levy_all → 无视忠诚度，征召100%
    if (typeof hasPrivilege === 'function' && hasPrivilege(liegeName, 'levy_all')) {
      levyRate = 1.0;
    } else if (loyalty >= 80) {
      levyRate = 0.8;
    } else if (loyalty >= 60) {
      levyRate = 0.6;
    } else if (loyalty >= 40) {
      levyRate = 0.4;
    } else {
      levyRate = 0.2;
    }

    // 查找封臣的军队
    var vassalArmies = GM.armies.filter(function(a) {
      return a.faction === vassalName;
    });

    vassalArmies.forEach(function(army) {
      var leviedSoldiers = Math.floor(army.soldiers * levyRate);
      if (leviedSoldiers > 0) {
        leviedArmies.push({
          name: vassalName + '征召军',
          faction: liegeName,
          soldiers: leviedSoldiers,
          morale: army.morale * 0.8, // 征召军士气降低
          location: army.location,
          source: vassalName
        });

        // 从封臣军队中扣除
        army.soldiers -= leviedSoldiers;
      }
    });
  });

  // 将征召的军队添加到宗主军队中
  leviedArmies.forEach(function(army) {
    GM.armies.push(army);
  });

  toast('征召了 ' + leviedArmies.length + ' 支封臣军队');
  return leviedArmies;
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
        ruler.loyalty = Math.min(100, (ruler.loyalty || 50) + 1 * _ms);
      } else if (centralization < 0.3) {
        ruler.loyalty = Math.max(0, (ruler.loyalty || 50) - 1 * _ms);
      }

      // 王朝衰落期额外降低忠诚
      if (dynastyPhase === 'decline' || dynastyPhase === 'collapse') {
        ruler.loyalty = Math.max(0, (ruler.loyalty || 50) - 1 * _ms);
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

// 获取势力的所有封臣（递归）
function getAllVassals(factionName, _visited) {
  if (!_visited) _visited = {};
  if (_visited[factionName]) return []; // 环检测
  _visited[factionName] = true;

  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction || !faction.vassals || faction.vassals.length === 0) {
    return [];
  }

  var allVassals = [];
  faction.vassals.forEach(function(vassalName) {
    allVassals.push(vassalName);
    var subVassals = getAllVassals(vassalName, _visited);
    allVassals = allVassals.concat(subVassals);
  });

  return allVassals;
}

// 获取势力的封建层级（带环检测）
function getFeudalLevel(factionName) {
  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction) return 0;

  var level = 0;
  var current = faction;
  var seen = {};

  while (current.liege) {
    if (seen[current.liege]) break; // 环检测
    seen[current.liege] = true;
    level++;
    current = GM._indices.facByName ? GM._indices.facByName.get(current.liege) : null;
    if (!current) break;
  }

  return level;
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

/**
 * 授予封地——将某区划标记为某角色的封地
 * @param {string} characterName - 持爵者
 * @param {string} divisionName - 封地名
 * @param {string} titleType - 关联爵位key
 * @param {string} subtype - 'real' | 'nominal'（实封/虚封）
 */
function grantFief(characterName, divisionName, titleType, subtype) {
  if (!P.adminHierarchy) return false;
  var _found = null, _fh = null;
  Object.keys(P.adminHierarchy).forEach(function(fk) {
    var fh = P.adminHierarchy[fk];
    if (!fh || !fh.divisions) return;
    (function _walk(ds) {
      ds.forEach(function(d) {
        if (d.name === divisionName) { _found = d; _fh = fh; }
        if (d.divisions) _walk(d.divisions);
      });
    })(fh.divisions);
  });
  if (!_found) { toast('未找到区划 ' + divisionName); return false; }
  // 设置 autonomy
  _found.autonomy = {
    type: 'fanguo',
    subtype: subtype || 'nominal',
    holder: characterName,
    suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
    titleType: titleType || null,
    loyalty: 80,
    tributeRate: subtype === 'real' ? 0.5 : 0.15,
    grantedTurn: GM.turn
  };
  addEB('册封', characterName + ' 受封 ' + divisionName + (subtype === 'real' ? '（实封）' : '（虚封/食邑）'));
  toast(characterName + ' 受封 ' + divisionName);
  return true;
}

/**
 * 收回封地——回归直辖
 */
function revokeFief(divisionName) {
  if (!P.adminHierarchy) return false;
  var _found = null;
  Object.keys(P.adminHierarchy).forEach(function(fk) {
    var fh = P.adminHierarchy[fk];
    if (!fh || !fh.divisions) return;
    (function _walk(ds) {
      ds.forEach(function(d) {
        if (d.name === divisionName) _found = d;
        if (d.divisions) _walk(d.divisions);
      });
    })(fh.divisions);
  });
  if (!_found) return false;
  var oldHolder = _found.autonomy && _found.autonomy.holder || '';
  _found.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
  if (oldHolder) addEB('回收', oldHolder + ' 之封地 ' + divisionName + ' 回归朝廷直辖');
  return true;
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
function revokeTitle(characterName, titleType) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character || !character.titles) {
    toast('角色没有头衔');
    return false;
  }

  var titleIndex = character.titles.findIndex(function(t) {
    return t.type === titleType;
  });

  if (titleIndex === -1) {
    toast('角色没有该头衔');
    return false;
  }

  var title = character.titles[titleIndex];
  character.titles.splice(titleIndex, 1);

  // 联动：回收该爵位下属的封地为直辖
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.autonomy && d.autonomy.holder === characterName &&
              (!title.type || d.autonomy.titleType === title.type || !d.autonomy.titleType)) {
            if (typeof revokeFief === 'function') revokeFief(d.name);
          }
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }

  // 记录事件
  addEB('降爵', characterName + ' 的 ' + title.name + ' 头衔被剥夺');

  toast(characterName + ' 的 ' + title.name + ' 头衔被剥夺');
  return true;
}

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
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.autonomy && d.autonomy.holder === deceasedName) {
            d.autonomy.holder = heirName;
            d.autonomy.grantedTurn = GM.turn;
            // 继承初期忠诚度偏低（新君/旧臣关系）
            d.autonomy.loyalty = Math.max(50, (d.autonomy.loyalty || 70) - 15);
          }
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

// 晋升头衔
function promoteTitle(characterName, newTitleType) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character) {
    toast('角色不存在');
    return false;
  }

  var currentLevels = getTitleLevels();
  var newTitleInfo = currentLevels[newTitleType];
  if (!newTitleInfo) {
    // 按name查找
    var keys = Object.keys(currentLevels);
    for (var k = 0; k < keys.length; k++) {
      if (currentLevels[keys[k]].name === newTitleType) {
        newTitleInfo = currentLevels[keys[k]];
        newTitleType = keys[k];
        break;
      }
    }
  }
  if (!newTitleInfo) {
    toast('头衔类型无效');
    return false;
  }

  // 查找当前最高头衔
  var currentTitle = null;
  var currentTitleIndex = -1;

  if (character.titles && character.titles.length > 0) {
    character.titles.forEach(function(t, index) {
      if (!currentTitle || t.level < currentTitle.level) {
        currentTitle = t;
        currentTitleIndex = index;
      }
    });
  }

  // 检查是否可以晋升
  if (currentTitle && currentTitle.level <= newTitleInfo.level) {
    toast('新头衔等级不高于当前头衔');
    return false;
  }

  // 移除旧头衔
  if (currentTitleIndex !== -1) {
    character.titles.splice(currentTitleIndex, 1);
  }

  // 授予新头衔
  var newTitle = {
    type: newTitleType,
    name: newTitleInfo.name,
    level: newTitleInfo.level,
    privileges: newTitleInfo.privileges || [],
    hereditary: currentTitle ? currentTitle.hereditary : false,
    grantedTurn: GM.turn,
    grantedBy: '朝廷'
  };

  if (!character.titles) character.titles = [];
  character.titles.push(newTitle);

  // 记录事件
  addEB('晋爵', characterName + ' 晋升为 ' + newTitleInfo.name);

  toast(characterName + ' 晋升为 ' + newTitleInfo.name);
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
function getHighestTitle(characterName) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character || !character.titles || character.titles.length === 0) {
    return null;
  }

  var highestTitle = character.titles[0];
  character.titles.forEach(function(t) {
    if (t.level < highestTitle.level) {
      highestTitle = t;
    }
  });

  return highestTitle;
}

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

// 创建补给线路
function createSupplyRoute(sourceDepotId, targetDepotId, capacity) {
  var route = {
    id: uid(),
    sourceId: sourceDepotId,
    targetId: targetDepotId,
    capacity: capacity || 100,
    active: true,
    createdTurn: GM.turn
  };

  if (!GM.supplyRoutes) GM.supplyRoutes = [];
  GM.supplyRoutes.push(route);

  var sourceDepot = GM._indices.supplyDepotById.get(sourceDepotId);
  var targetDepot = GM._indices.supplyDepotById.get(targetDepotId);

  if (sourceDepot && targetDepot) {
    addEB('补给', '建立补给线路：' + sourceDepot.name + ' → ' + targetDepot.name);
  }

  return route;
}

// 切断补给线路
function cutSupplyRoute(routeId) {
  var route = GM.supplyRoutes.find(function(r) { return r.id === routeId; });
  if (!route) {
    return { success: false, reason: '补给线路不存在' };
  }

  route.active = false;
  addEB('补给', '补给线路已切断');

  return { success: true };
}

// 生成补给报告
function generateSupplyReport(faction) {
  if (!faction) return '无势力数据';

  var report = '【补给报告：' + faction.name + '】\n\n';

  // 仓库列表
  if (faction.supplyDepots && faction.supplyDepots.length > 0) {
    report += '【补给仓库】\n';
    faction.supplyDepots.forEach(function(depotId) {
      var depot = GM._indices.supplyDepotById.get(depotId);
      if (depot) {
        report += '• ' + depot.name + '（' + depot.location + '）\n';
        report += '  容量：' + depot.capacity + '\n';
        report += '  粮草：' + Math.floor(depot.supplies.food) + ' | ';
        report += '武器：' + Math.floor(depot.supplies.weapon) + ' | ';
        report += '盔甲：' + Math.floor(depot.supplies.armor) + '\n';
        report += '  药品：' + Math.floor(depot.supplies.medicine) + ' | ';
        report += '马料：' + Math.floor(depot.supplies.fodder) + '\n';
      }
    });
    report += '\n';
  }

  // 军队补给状态
  var factionArmies = GM.armies.filter(function(a) { return a.faction === faction.name; });
  if (factionArmies.length > 0) {
    report += '【军队补给状态】\n';
    factionArmies.forEach(function(army) {
      report += '• ' + army.name + '（' + (army.soldiers || 0) + ' 人）\n';
      if (army.supplyRatio !== undefined) {
        var ratio = (army.supplyRatio * 100).toFixed(0);
        var status = army.supplyRatio > 0.8 ? '充足' : (army.supplyRatio > 0.5 ? '一般' : '不足');
        report += '  补给状态：' + status + '（' + ratio + '%）\n';
      } else {
        report += '  补给状态：未知\n';
      }
    });
    report += '\n';
  }

  // 补给线路
  if (GM.supplyRoutes && GM.supplyRoutes.length > 0) {
    var factionRoutes = GM.supplyRoutes.filter(function(r) {
      var sourceDepot = GM._indices.supplyDepotById.get(r.sourceId);
      return sourceDepot && sourceDepot.faction === faction.name;
    });

    if (factionRoutes.length > 0) {
      report += '【补给线路】\n';
      factionRoutes.forEach(function(route) {
        var sourceDepot = GM._indices.supplyDepotById.get(route.sourceId);
        var targetDepot = GM._indices.supplyDepotById.get(route.targetId);
        if (sourceDepot && targetDepot) {
          var status = route.active ? '运行中' : '已切断';
          report += '• ' + sourceDepot.name + ' → ' + targetDepot.name + '（' + status + '）\n';
          report += '  运输能力：' + route.capacity + '/回合\n';
        }
      });
    }
  }

  return report;
}

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

// 铨选主流程
function performQuanxuan(postId, context) {
  if (!postId || !context) {
    return { success: false, reason: '参数不足' };
  }

  var post = findPostById(postId);
  if (!post) {
    return { success: false, reason: '岗位不存在' };
  }

  // 第一层：初筛
  var initialCandidates = quanxuanInitialScreen(post, context);
  if (initialCandidates.length === 0) {
    return { success: false, reason: '无符合资格的候选人' };
  }

  // 第二层：精选
  var refinedCandidates = quanxuanRefinedSelection(initialCandidates, post, context);

  // 第三层：最终决策
  var finalDecision = quanxuanFinalDecision(refinedCandidates, post, context);

  return {
    success: true,
    initialCount: initialCandidates.length,
    refinedCandidates: refinedCandidates,
    finalDecision: finalDecision
  };
}

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
    var age = char.age || 30;
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

// 第二层：精选（能力评估）
function quanxuanRefinedSelection(initialCandidates, post, context) {
  if (!initialCandidates || initialCandidates.length === 0) return { excellent: [], qualified: [], unqualified: [] };

  var config = QuanxuanConfig.refinedSelection;
  var excellent = [];
  var qualified = [];
  var unqualified = [];

  initialCandidates.forEach(function(candidate) {
    var char = candidate.character;

    // 使用权重计算系统评估候选人
    var weightResult = calculateCandidateWeight({
      name: char.name,
      intelligence: char.intelligence || 50,
      valor: char.valor || 50,
      benevolence: char.benevolence || 50,
      loyalty: char.loyalty || 50,
      faction: char.faction,
      kinship: char.kinship,
      hasOffice: findNpcOffice(char.name) !== null,
      reputation: char.reputation || 50
    }, context);

    // 归一化得分（0-1）
    var normalizedScore = Math.min(1, weightResult.total / 10);

    var refinedCandidate = {
      name: char.name,
      character: char,
      score: normalizedScore,
      weightBreakdown: weightResult.breakdown,
      eraModifier: weightResult.eraModifier
    };

    // 分级
    if (normalizedScore >= config.excellentThreshold) {
      refinedCandidate.grade = 'excellent';
      excellent.push(refinedCandidate);
    } else if (normalizedScore >= config.qualifiedThreshold) {
      refinedCandidate.grade = 'qualified';
      qualified.push(refinedCandidate);
    } else {
      refinedCandidate.grade = 'unqualified';
      unqualified.push(refinedCandidate);
    }
  });

  // 排序
  excellent.sort(function(a, b) { return b.score - a.score; });
  qualified.sort(function(a, b) { return b.score - a.score; });
  unqualified.sort(function(a, b) { return b.score - a.score; });

  return {
    excellent: excellent,
    qualified: qualified,
    unqualified: unqualified
  };
}

// 第三层：最终决策（综合权衡）
function quanxuanFinalDecision(refinedCandidates, post, context) {
  // 优先从优秀候选人中选择
  if (refinedCandidates.excellent && refinedCandidates.excellent.length > 0) {
    var topCandidate = refinedCandidates.excellent[0];
    return {
      selected: topCandidate,
      reason: '优秀候选人，综合得分最高',
      alternatives: refinedCandidates.excellent.slice(1, 3)
    };
  }

  // 其次从合格候选人中选择
  if (refinedCandidates.qualified && refinedCandidates.qualified.length > 0) {
    var topQualified = refinedCandidates.qualified[0];
    return {
      selected: topQualified,
      reason: '合格候选人，能力达标',
      alternatives: refinedCandidates.qualified.slice(1, 3)
    };
  }

  // 无合适候选人
  return {
    selected: null,
    reason: '无合适候选人',
    alternatives: []
  };
}

// 生成铨选报告
function generateQuanxuanReport(quanxuanResult) {
  if (!quanxuanResult.success) {
    return '铨选失败：' + quanxuanResult.reason;
  }

  var report = '【铨选报告】\n\n';

  report += '初筛通过：' + quanxuanResult.initialCount + ' 人\n\n';

  var refined = quanxuanResult.refinedCandidates;

  report += '精选结果：\n';
  report += '  优秀：' + refined.excellent.length + ' 人\n';
  report += '  合格：' + refined.qualified.length + ' 人\n';
  report += '  不合格：' + refined.unqualified.length + ' 人\n\n';

  if (refined.excellent.length > 0) {
    report += '【优秀候选人】\n';
    refined.excellent.slice(0, 5).forEach(function(c, i) {
      report += (i + 1) + '. ' + c.name + '（得分：' + c.score.toFixed(2) + '）\n';
      report += '   智谋：' + (c.character.intelligence || 50) + ' | ';
      report += '忠诚：' + (c.character.loyalty || 50) + ' | ';
      report += '武勇：' + (c.character.valor || 50) + '\n';
    });
    report += '\n';
  }

  if (refined.qualified.length > 0) {
    report += '【合格候选人】\n';
    refined.qualified.slice(0, 3).forEach(function(c, i) {
      report += (i + 1) + '. ' + c.name + '（得分：' + c.score.toFixed(2) + '）\n';
    });
    report += '\n';
  }

  var decision = quanxuanResult.finalDecision;
  if (decision.selected) {
    report += '【最终决策】\n';
    report += '推荐：' + decision.selected.name + '\n';
    report += '理由：' + decision.reason + '\n';

    if (decision.alternatives && decision.alternatives.length > 0) {
      report += '备选：' + decision.alternatives.map(function(a) { return a.name; }).join('、') + '\n';
    }
  } else {
    report += '【最终决策】\n';
    report += '无合适候选人\n';
  }

  return report;
}

// 自动铨选并任命
function autoQuanxuanAndAppoint(postId, context) {
  var result = performQuanxuan(postId, context);

  if (!result.success || !result.finalDecision.selected) {
    return { success: false, reason: '铨选失败或无合适候选人' };
  }

  var selectedCandidate = result.finalDecision.selected;
  var appointResult = appointToPost(postId, selectedCandidate.name);

  if (appointResult.success) {
    addEB('铨选', '通过铨选任命 ' + selectedCandidate.name + ' 到岗位');
    return { success: true, candidate: selectedCandidate, report: generateQuanxuanReport(result) };
  } else {
    return { success: false, reason: '任命失败：' + appointResult.reason };
  }
}


// 更新军事单位
function updateMilitary(timeRatio) {
  var sc = findScenarioById(GM.sid);
  if (!sc || !sc.military || !sc.military.initialTroops) return;

  sc.military.initialTroops.forEach(function(troop) {
    if (!troop || !troop.name) return;

    // 士气变化
    if (troop.morale !== undefined) {
      var oldMorale = troop.morale;
      var change = Math.floor((random() - 0.5) * 6 * timeRatio); // 年度±3
      troop.morale = Math.max(0, Math.min(100, troop.morale + change));

      if (Math.abs(change) > 1) {
        recordChange('military', troop.name, 'morale', oldMorale, troop.morale, '日常波动');
      }
    }

    // 训练度提升
    if (troop.training !== undefined && troop.training < 100) {
      var oldTraining = troop.training;
      var inc = Math.floor(random() * 3 * timeRatio); // 年度+0-2
      troop.training = Math.min(100, troop.training + inc);

      if (inc > 0) {
        recordChange('military', troop.name, 'training', oldTraining, troop.training, '日常训练');
      }
    }

    // 忠诚度微调
    if (troop.loyalty !== undefined) {
      var oldLoyalty = troop.loyalty;
      var change = Math.floor((random() - 0.5) * 4 * timeRatio); // 年度±2
      troop.loyalty = Math.max(0, Math.min(100, troop.loyalty + change));

      if (Math.abs(change) > 1) {
        recordChange('military', troop.name, 'loyalty', oldLoyalty, troop.loyalty, '军心变化');
      }
    }
  });
}

// 更新地图数据
function updateMap(timeRatio) {
  // 支持新的地图数据结构 (P.map.regions)
  if (P.map && P.map.regions && P.map.regions.length > 0) {
    P.map.regions.forEach(function(region) {
      if (!region) return;

      // 1. 发展度自然变化
      var oldDev = region.development || 50;
      var newDev = oldDev;

      // 和平时期缓慢增长
      if (region.owner && random() < 0.3) {
        var growth = (1 + random() * 2) * timeRatio; // 1-3点/年
        newDev = Math.min(100, oldDev + growth);
      }

      // 战争或无主降低发展度
      if (!region.owner && random() < 0.2) {
        var decline = (1 + random() * 3) * timeRatio;
        newDev = Math.max(0, oldDev - decline);
      }

      if (Math.abs(newDev - oldDev) > 0.5) {
        region.development = Math.round(newDev);
        recordChange('map', region.name, 'development', oldDev, region.development,
          newDev > oldDev ? '发展' : '衰退');
      }

      // 2. 驻军自然消耗
      if (region.troops > 0 && random() < 0.1) {
        var oldTroops = region.troops;
        var attrition = Math.floor(region.troops * 0.01 * timeRatio); // 1%损耗/年
        region.troops = Math.max(0, region.troops - attrition);
        if (attrition > 0) {
          recordChange('map', region.name, 'troops', oldTroops, region.troops, '自然损耗');
        }
      }
    });
  }

  // 兼容旧的地图数据结构
  var sc = findScenarioById(GM.sid);
  if (!sc || !sc.map || !sc.map.items) return;

  sc.map.items.forEach(function(item) {
    if (!item || !item.name) return;

    if (item.type === 'city' && item.population) {
      // 城市人口缓慢增长
      var oldPop = item.population;
      // 简化：人口年增长1-3%
      if (random() < 0.5) {
        var growthRate = 0.01 + random() * 0.02; // 1-3%
        var change = growthRate * timeRatio;
        // 这里需要解析人口字符串，简化处理
        recordChange('map', item.name, 'population', oldPop, item.population, '自然增长');
      }
    }
  });
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
    if (WarWeightSystem.hasTruce(attacker.name, defender.name)) {
      weight -= 40;
    }

    return clamp(Math.round(weight), 0, 100);
  },

  // 停战记录 {key: expiryTurn}
  _truces: {},
  TRUCE_DURATION: 24, // 24回合 ≈ 2年

  /** 添加停战 */
  addTruce: function(partyA, partyB, duration) {
    var key = [partyA, partyB].sort().join('|');
    WarWeightSystem._truces[key] = GM.turn + (duration || WarWeightSystem.TRUCE_DURATION);
    _dbg('[War] 停战协议:', partyA, '↔', partyB, '至回合', WarWeightSystem._truces[key]);
  },

  /** 检查停战 */
  hasTruce: function(partyA, partyB) {
    var key = [partyA, partyB].sort().join('|');
    var expiry = WarWeightSystem._truces[key];
    if (!expiry) return false;
    if (GM.turn >= expiry) { delete WarWeightSystem._truces[key]; return false; }
    return true;
  },

  /** 清理过期停战 */
  cleanTruces: function() {
    var keys = Object.keys(WarWeightSystem._truces);
    keys.forEach(function(k) {
      if (GM.turn >= WarWeightSystem._truces[k]) delete WarWeightSystem._truces[k];
    });
  },

  /** 序列化 */
  serialize: function() { return { truces: WarWeightSystem._truces }; },
  deserialize: function(d) { if (d && d.truces) WarWeightSystem._truces = d.truces; }
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
      active: true
    };
    if (!GM.treaties) GM.treaties = [];
    GM.treaties.push(treaty);
    addEB('外交', partyA + '与' + partyB + '缔结' + template.name + (durationTurns>0 ? '（期限'+durationTurns+'回合）' : '（永久）'));
    return treaty;
  }

  /**
   * 违约/废除条约
   */
  function breakTreaty(treatyId, breakerName) {
    var idx = (GM.treaties||[]).findIndex(function(t){return t.id===treatyId;});
    if (idx < 0) return;
    var treaty = GM.treaties[idx];
    addEB('外交', breakerName + '废除了与' + treaty.parties.filter(function(p){return p!==breakerName;}).join('、') + '的' + treaty.typeName + '，信誉受损');
    GM.treaties.splice(idx, 1);
  }

  /**
   * 每回合清理到期条约
   */
  function cleanExpired() {
    if (!GM.treaties) return;
    GM.treaties = GM.treaties.filter(function(t) {
      if (t.expiryTurn > 0 && GM.turn >= t.expiryTurn) {
        addEB('外交', t.parties.join('与') + '的' + t.typeName + '到期解除');
        return false;
      }
      return true;
    });
  }

  /**
   * 检查两方是否有特定类型的条约
   */
  function hasTreaty(partyA, partyB, typeId) {
    return (GM.treaties||[]).some(function(t) {
      var match = t.parties.indexOf(partyA) >= 0 && t.parties.indexOf(partyB) >= 0;
      return match && (!typeId || t.type === typeId) && t.active;
    });
  }

  function getPromptInjection() {
    if (!GM.treaties || GM.treaties.length === 0) return '';
    var lines = ['【现有条约】'];
    GM.treaties.forEach(function(t) {
      var remaining = t.expiryTurn > 0 ? '剩' + (t.expiryTurn - GM.turn) + '回合' : '永久';
      lines.push('  ' + t.parties.join('↔') + ' ' + t.typeName + ' (' + remaining + ')');
    });
    return lines.join('\n');
  }

  /** 检查faction_events中的宣战是否违反现有条约 */
  function checkViolations(factionEvents) {
    if (!GM.treaties || !GM.treaties.length || !factionEvents) return;
    factionEvents.forEach(function(fe) {
      if (!fe.action || fe.action.indexOf('宣战') < 0) return;
      var attacker = fe.actor || '';
      var defender = fe.target || '';
      if (!attacker || !defender) return;
      // 检查是否有和平/联盟条约
      var violated = GM.treaties.filter(function(t) {
        return t.active && t.parties.indexOf(attacker) >= 0 && t.parties.indexOf(defender) >= 0;
      });
      violated.forEach(function(t) {
        t.active = false; // 条约失效
        addEB('违约', attacker + '背弃与' + defender + '的' + t.typeName + '！');
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

    if (!GM.activeSchemes) GM.activeSchemes = [];
    GM.activeSchemes.push(scheme);
    DebugLog.log('scheme', schemerId, '发起', sType.name, '→', targetId,
      '成功率', scheme.successRate + '%', '阶段', '1/' + totalPhases);
    return {success:true, scheme:scheme};
  }

  /**
   * 每回合推进所有活跃阴谋
   */
  function advanceAll() {
    if (!GM.activeSchemes || !GM.activeSchemes.length) return;
    if (!P.schemeConfig || !P.schemeConfig.enabled) return;

    var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var monthScale = tr * 12;

    GM.activeSchemes.forEach(function(scheme) {
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
    var resolved = GM.activeSchemes.filter(function(s){return s.status!=='active';});
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
    GM.activeSchemes = GM.activeSchemes.filter(function(s){return s.status==='active';});
  }

  function getPromptInjection() {
    var lines = [];
    if (GM.activeSchemes && GM.activeSchemes.length > 0) {
      lines.push('【进行中的阴谋】');
      GM.activeSchemes.forEach(function(s) {
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
