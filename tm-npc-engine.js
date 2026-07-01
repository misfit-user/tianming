// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Interaction System - 交互注册表系统
// Requires: tm-data-model.js (P, GM), tm-utils.js (_dbg, callAI, getTS, uid, extractJSON),
//           tm-index-world.js (findCharByName, findFacByName),
//           tm-game-engine.js (addEB),
//           tm-dynamic-systems.js (AICache, recordChange, addToIndex)
//
// R157 章节导航 (2017 行)：
//   §1 [L11]   性格系统 (8D 聚合·五常·文化标签·能力短板·压力·心声)
//   §2 [L125]  NPC 心声注入 (Prompt 上下文·重要 NPC 优先)
//   §3 [L200]  事件触发条件检查 (复合条件求值)
//   §4 [L500]  NPC 互动注册表 (interactions 系统)
//   §5 [L1100] 长期行动追踪 (longTermActions / archs)
//   §6 [L1500] 风闻录事 (lizhi 案例库)
//   §7 [L1800] 死亡墓志铭 + 持有清算
// ============================================================

// ============================================================
// 角色性格系统 — 从traitIds聚合8D维度 + 生成AI可读摘要
// ============================================================

/**
 * 从角色的traitIds聚合8D人格维度
 * @param {Object} char - 角色对象
 * @returns {Object} {boldness, compassion, rationality, greed, honor, sociability, vengefulness, energy}
 */
function _aggregatePersonalityDims(char) {
  var dims = { boldness:0, compassion:0, rationality:0, greed:0, honor:0, sociability:0, vengefulness:0, energy:0 };
  if (!char || !char.traitIds || !P.traitDefinitions) return dims;
  char.traitIds.forEach(function(tid) {
    var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
    if (!def || !def.dims) return;
    Object.keys(def.dims).forEach(function(k) {
      if (dims[k] !== undefined) dims[k] += def.dims[k];
    });
  });
  return dims;
}

/**
 * 生成角色性格的AI可读摘要（每回合注入prompt用）
 * @param {Object} char - 角色对象
 * @returns {string} 性格摘要
 */
function getCharacterPersonalityBrief(char) {
  if (!char) return '';
  var dims = char._dims || _aggregatePersonalityDims(char);
  var parts = [char.name];

  // 8D维度→行为倾向短语
  if (dims.boldness > 0.3) parts.push('胆大好斗');
  else if (dims.boldness < -0.3) parts.push('怯懦避祸');
  if (dims.compassion > 0.3) parts.push('仁善不忍杀伐');
  else if (dims.compassion < -0.3) parts.push('冷酷果断');
  if (dims.rationality > 0.3) parts.push('理性务实');
  else if (dims.rationality < -0.3) parts.push('冲动偏激');
  if (dims.greed > 0.3) parts.push('贪财好利');
  else if (dims.greed < -0.3) parts.push('淡泊名利');
  if (dims.honor > 0.3) parts.push('重名节');
  else if (dims.honor < -0.3) parts.push('不拘小节');
  if (dims.sociability > 0.3) parts.push('善于结交');
  else if (dims.sociability < -0.3) parts.push('孤僻寡言');
  if (dims.vengefulness > 0.3) parts.push('睚眦必报');
  else if (dims.vengefulness < -0.3) parts.push('宽厚能容');
  if (dims.energy > 0.3) parts.push('勤勉精干');
  else if (dims.energy < -0.3) parts.push('懒散怠政');

  // 特质名列表
  if (char.traitIds && char.traitIds.length > 0 && P.traitDefinitions) {
    var names = char.traitIds.map(function(tid) {
      var d = P.traitDefinitions.find(function(t) { return t.id === tid; });
      return d ? d.name : '';
    }).filter(Boolean);
    if (names.length) parts.push('【' + names.join('·') + '】');
  }

  // 五常
  if (typeof calculateWuchang === 'function') {
    var wc = calculateWuchang(char);
    parts.push(wc.气质);
  }

  // 文化/信仰/学识标签（影响行为风格的关键差异化因素）
  if (char.learning) parts.push('学:' + char.learning);
  if (char.faith) parts.push('信:' + char.faith);
  if (char.ethnicity && char.ethnicity !== '汉') parts.push('族:' + char.ethnicity);
  if (char.familyTier) {
    var _ftLabels = {imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
    if (_ftLabels[char.familyTier]) parts.push(_ftLabels[char.familyTier]);
  }

  // 能力特长/短板（极端值才提及）
  if ((char.intelligence || 50) >= 80) parts.push('极聪慧');
  else if ((char.intelligence || 50) <= 25) parts.push('智识浅薄');
  if ((char.valor || 50) >= 80) parts.push('勇冠三军');
  if ((char.administration || 50) >= 80) parts.push('治政老手');
  if ((char.charisma || 50) >= 80) parts.push('极善交际');

  // 个人目标
  if (char.personalGoal) parts.push('志：' + char.personalGoal.slice(0, 20));

  // 当下压力源（最紧迫 1-2 条）
  if (Array.isArray(char.stressSources) && char.stressSources.length > 0) {
    parts.push('忧:' + char.stressSources.slice(0, 2).join('/'));
  }

  // 内心所思（AI 可读到其心声，从而反应更一致）
  if (char.innerThought) parts.push('思:「' + char.innerThought.slice(0, 22) + (char.innerThought.length > 22 ? '…' : '') + '」');

  // 家中要员（妻/父/子，决定其对家族牵挂）
  if (Array.isArray(char.familyMembers) && char.familyMembers.length > 0) {
    var fkin = char.familyMembers.filter(function(m) {
      return !m.dead && (m.relation === '妻' || m.relation === '父' || m.relation === '母' || m.relation === '长子');
    }).slice(0, 2).map(function(m) { return m.relation + m.name; }).join('·');
    if (fkin) parts.push('家:' + fkin);
  }

  // 字、门第加强身份感
  if (char.zi) parts.push('字' + char.zi);

  // 压力状态
  if (char.stress && char.stress > 50) parts.push('压力' + Math.round(char.stress));

  return parts.join('，');
}

/**
 * 为AI prompt生成前N个重要NPC的性格摘要
 * @param {number} maxChars - 最多包含几个角色
 * @returns {string} AI prompt文本
 */
function getNpcPersonalityInjection(maxChars) {
  if (!GM.chars || !GM.chars.length) return '';
  var n = maxChars || 10;
  // 选取最重要的NPC（有官职/高忠诚/高影响的优先）
  var sorted = GM.chars.filter(function(c) { return c.alive !== false && !c.isPlayer; })
    .sort(function(a, b) {
      var scoreA = (a.title ? 20 : 0) + (a.loyalty || 50) + (a.ambition || 50);
      var scoreB = (b.title ? 20 : 0) + (b.loyalty || 50) + (b.ambition || 50);
      return scoreB - scoreA;
    })
    .slice(0, n);

  if (!sorted.length) return '';
  var lines = ['【重要人物·性格行为倾向】'];
  lines.push('以下信息决定了NPC的行为选择，AI在模拟NPC决策时必须参考其性格特征：');
  sorted.forEach(function(c) {
    lines.push('- ' + getCharacterPersonalityBrief(c));
  });
  return lines.join('\n');
}

// ============================================================

// ============================================================
// NPC Engine - 双层分离架构
// ============================================================

// 重置变化追踪
function resetTurnChanges() {
  GM.turnChanges = {
    variables: [],
    characters: [],
    factions: [],
    parties: [],
    classes: [],
    military: [],
    map: []
  };
}

// ============================================================
// 派系-忠诚度联动（借鉴 HistorySimAI 党派机制）
// ============================================================

/**
 * 阈值触发系统（空实现，保留接口兼容）
 */
function evaluateThresholdTriggers() {
  return [];
}

// ============================================================
// 季度议程系统 - 借鉴 HistorySimAI
// ============================================================

/**
 * 议程模板库（根据局势动态生成）
 */
//  NpcContext 快照系统（借鉴晚唐风云）
// ============================================================

// ============================================================
//  AI 权重系统（借鉴 CK3）
// ============================================================

// ============================================================
//  集权等级与回拨系统（借鉴晚唐风云）
// ============================================================

/**
 * 集权回拨系统
 * 借鉴晚唐风云的财政系统设计：
 * 1. 自底向上收集贡赋（按集权等级 × 领地类型查表）
 * 2. 自顶向下回拨（按回拨率 × 贡献占比）
 */
var CentralizationSystem = (function() {
  function _num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function _ensureFinance(char) {
    if (!char || typeof char !== 'object') return null;
    if (!char.finance || typeof char.finance !== 'object') char.finance = {};
    char.finance.income = _num(char.finance.income);
    char.finance.tribute = _num(char.finance.tribute);
    char.finance.redistribution = _num(char.finance.redistribution);
    char.finance.netIncome = _num(char.finance.netIncome);
    if (!char.finance.expenses || typeof char.finance.expenses !== 'object') char.finance.expenses = {};
    if (!Array.isArray(char.finance.expenses.fixed)) char.finance.expenses.fixed = [];
    if (!Array.isArray(char.finance.expenses.discretionary)) char.finance.expenses.discretionary = [];
    if (!Array.isArray(char.finance.expenses.illicit)) char.finance.expenses.illicit = [];
    if (!Array.isArray(char.finance.expenses.imperial)) char.finance.expenses.imperial = [];
    return char.finance;
  }

  /**
   * 初始化角色的集权数据
   */
  function initializeCharacters() {
    if (!P.centralizationSystem || !P.centralizationSystem.enabled) return;

    (GM.chars || []).forEach(function(char) {
      if (!char || typeof char !== 'object') return;
      // 初始化集权等级（如果没有）
      if (char.centralization === undefined) {
        char.centralization = P.centralizationSystem.defaultCentralization || 2;
      }

      // 初始化回拨率（如果没有）
      if (char.redistributionRate === undefined) {
        char.redistributionRate = P.centralizationSystem.defaultRedistributionRate || 0.3;
      }

      // 初始化财政数据
      _ensureFinance(char);
    });

    _dbg('[Centralization] 角色集权数据初始化完成');
  }

  /**
   * 获取上缴率
   * @param {number} centralization - 集权等级（1-4）
   * @param {string} territoryType - 领地类型（'military'/'civil'）
   * @returns {number} 上缴率（0-1）
   */
  function getTributeRate(centralization, territoryType) {
    if (!P.centralizationSystem || !P.centralizationSystem.tributeRates) {
      return 0.3; // 默认 30%
    }

    var rates = P.centralizationSystem.tributeRates[centralization];
    if (!rates) return 0.3;

    return rates[territoryType] || 0.3;
  }

  /**
   * 构建领主层级树
   * @returns {Object} 层级树：{ roots: [], childrenMap: {} }
   */
  function buildHierarchyTree() {
    var roots = [];
    var childrenMap = {};

    (GM.chars || []).forEach(function(char) {
      if (!char || typeof char !== 'object') return;
      _ensureFinance(char);
      if (!char.overlordId) {
        // 没有上级，是根节点
        roots.push(char);
      } else {
        // 有上级，加入子节点列表
        if (!childrenMap[char.overlordId]) {
          childrenMap[char.overlordId] = [];
        }
        childrenMap[char.overlordId].push(char);
      }
    });

    return { roots: roots, childrenMap: childrenMap };
  }

  /**
   * 自底向上收集贡赋
   * @param {Object} char - 角色
   * @param {Object} childrenMap - 子节点映射
   * @returns {number} 该角色收到的总贡赋
   */
  function collectTributeBottomUp(char, childrenMap) {
    var finance = _ensureFinance(char);
    if (!char || !finance) return 0;
    var totalTribute = 0;

    // 递归收集所有下属的贡赋
    var children = childrenMap[char.id] || [];
    children.forEach(function(child) {
      if (!child || typeof child !== 'object') return;
      var childFinance = _ensureFinance(child);
      if (!childFinance) return;
      // 先递归处理子节点
      collectTributeBottomUp(child, childrenMap);

      // 计算该下属的上缴额
      var childIncome = _num(child.finance && child.finance.income);
      var tributeRate = getTributeRate(child.centralization, child.territoryType || 'civil');
      var tribute = childIncome * tributeRate;

      // 记录下属的上缴
      child.finance.tribute = tribute;

      // 累加到本角色的收入
      totalTribute += tribute;

      _dbg('[Centralization] 角色', child.name, '上缴', tribute.toFixed(2),
                  '(收入:', childIncome.toFixed(2), '集权:', child.centralization,
                  '类型:', child.territoryType, '率:', (tributeRate * 100).toFixed(1) + '%)');
    });

    // 更新本角色的收入（原有收入 + 下属贡赋）
    finance.income = _num(finance.income) + totalTribute;

    return totalTribute;
  }

  /**
   * 自顶向下回拨
   * @param {Object} char - 角色
   * @param {Object} childrenMap - 子节点映射
   */
  function redistributeTopDown(char, childrenMap) {
    var finance = _ensureFinance(char);
    if (!char || !finance) return;
    var children = childrenMap[char.id] || [];
    if (children.length === 0) return;

    // 计算总贡赋
    var totalTribute = 0;
    var tributeMap = {};
    children.forEach(function(child) {
      if (!child || typeof child !== 'object') return;
      var childFinance = _ensureFinance(child);
      var tribute = childFinance ? _num(childFinance.tribute) : 0;
      totalTribute += tribute;
      tributeMap[child.id] = tribute;
    });

    if (totalTribute === 0) return;

    // 计算回拨总额
    var redistributionRate = char.redistributionRate || 0;
    var totalRedistribution = totalTribute * redistributionRate;

    _dbg('[Centralization] 角色', char.name, '回拨总额:', totalRedistribution.toFixed(2),
                '(贡赋:', totalTribute.toFixed(2), '回拨率:', (redistributionRate * 100).toFixed(1) + '%)');

    // 按贡献占比分配回拨
    children.forEach(function(child) {
      if (!child || typeof child !== 'object') return;
      var childFinance = _ensureFinance(child);
      if (!childFinance) return;
      var childTribute = tributeMap[child.id];
      var contributionRatio = childTribute / totalTribute;
      var redistribution = totalRedistribution * contributionRatio;

      // 记录回拨
      childFinance.redistribution = redistribution;

      _dbg('[Centralization] 角色', child.name, '获得回拨', redistribution.toFixed(2),
                  '(贡献占比:', (contributionRatio * 100).toFixed(1) + '%)');

      // 递归处理子节点
      redistributeTopDown(child, childrenMap);
    });

    // 上级扣除回拨后的净收入
    finance.income = _num(finance.income) - totalRedistribution;
  }

  /**
   * 计算所有角色的净收入
   */
  function calculateNetIncome() {
    (GM.chars || []).forEach(function(char) {
      var finance = _ensureFinance(char);
      if (!char || !finance) return;
      var income = _num(finance.income);
      var tribute = _num(finance.tribute);
      var redistribution = _num(finance.redistribution);

      // 净收入 = 原始收入 - 上缴 + 回拨
      finance.netIncome = income - tribute + redistribution;

      _dbg('[Centralization] 角色', char.name, '净收入:', finance.netIncome.toFixed(2),
                  '(收入:', income.toFixed(2), '上缴:', tribute.toFixed(2), '回拨:', redistribution.toFixed(2) + ')');
    });
  }

  /**
   * 执行财政结算
   */
  function runFiscalSettlement() {
    if (!P.centralizationSystem || !P.centralizationSystem.enabled) return;

    _dbg('[Centralization] ========== 财政结算开始 ==========');
    initializeCharacters();

    // 1. 构建层级树
    var tree = buildHierarchyTree();
    _dbg('[Centralization] 层级树构建完成，根节点数:', tree.roots.length);

    // 2. 自底向上收集贡赋
    tree.roots.forEach(function(root) {
      collectTributeBottomUp(root, tree.childrenMap);
    });

    // 3. 自顶向下回拨
    tree.roots.forEach(function(root) {
      redistributeTopDown(root, tree.childrenMap);
    });

    // 4. 计算净收入
    calculateNetIncome();

    _dbg('[Centralization] ========== 财政结算完成 ==========');
  }

  /**
   * 重置财政数据（回合开始时）
   */
  function resetFinance() {
    (GM.chars || []).forEach(function(char) {
      var finance = _ensureFinance(char);
      if (!finance) return;
      finance.income = 0;
      finance.tribute = 0;
      finance.redistribution = 0;
      finance.netIncome = 0;
    });
  }

  /**
   * 设置角色的集权等级
   * @param {string} charId - 角色 ID
   * @param {number} level - 集权等级（1-4）
   */
  function setCentralization(charId, level) {
    var char = GM.chars.find(function(c) { return c.id === charId; });
    if (!char) {
      console.warn('[Centralization] 角色不存在:', charId);
      return;
    }

    level = Math.max(1, Math.min(4, level));
    char.centralization = level;

    _dbg('[Centralization] 设置角色', char.name, '集权等级为', level);
  }

  /**
   * 设置角色的回拨率
   * @param {string} charId - 角色 ID
   * @param {number} rate - 回拨率（0-1）
   */
  function setRedistributionRate(charId, rate) {
    var char = GM.chars.find(function(c) { return c.id === charId; });
    if (!char) {
      console.warn('[Centralization] 角色不存在:', charId);
      return;
    }

    rate = Math.max(0, Math.min(1, rate));
    char.redistributionRate = rate;

    _dbg('[Centralization] 设置角色', char.name, '回拨率为', (rate * 100).toFixed(1) + '%');
  }

  // 公共接口
  return {
    initialize: initializeCharacters,
    runSettlement: runFiscalSettlement,
    resetFinance: resetFinance,
    setCentralization: setCentralization,
    setRedistributionRate: setRedistributionRate,
    getTributeRate: getTributeRate,
    _ensureFinance: _ensureFinance
  };
})();

// ============================================================
//  领地产出系统（借鉴晚唐风云）
// ============================================================

/**
 * 领地产出系统
 * 借鉴晚唐风云的精细化产出公式：
 * 总产出 = basePopulation × K × (development/100) × (control/100) × (1 + admin×0.02)
 * 钱 = 总产出 × moneyRatio / (moneyRatio + grainRatio) + 建筑加成
 * 粮 = 总产出 × grainRatio / (moneyRatio + grainRatio) + 建筑加成
 */
var TerritoryProductionSystem = (function() {
  /**
   * 初始化领地数据
   */
  function initializeTerritories() {
    if (!P.territoryProductionSystem || !P.territoryProductionSystem.enabled) return;

    // 如果游戏有领地系统
    if (GM.territories && Array.isArray(GM.territories)) {
      GM.territories.forEach(function(territory) {
        initializeTerritory(territory);
      });
    }

    // 如果游戏有地图系统
    if (P.map && P.map.regions && Array.isArray(P.map.regions)) {
      P.map.regions.forEach(function(region) {
        initializeTerritory(region);
      });
    }

    _dbg('[TerritoryProduction] 领地数据初始化完成');
  }

  /**
   * 初始化单个领地
   */
  function initializeTerritory(territory) {
    var defaults = P.territoryProductionSystem.defaultValues || {};

    if (territory.basePopulation === undefined) {
      territory.basePopulation = defaults.basePopulation || 50000;
    }
    if (territory.moneyRatio === undefined) {
      territory.moneyRatio = defaults.moneyRatio || 3;
    }
    if (territory.grainRatio === undefined) {
      territory.grainRatio = defaults.grainRatio || 4;
    }
    if (territory.development === undefined) {
      territory.development = defaults.development || 50;
    }
    if (territory.control === undefined) {
      territory.control = defaults.control || 70;
    }
    if (territory.populace === undefined) {
      territory.populace = defaults.populace || 60;
    }
    if (territory.admin === undefined) {
      territory.admin = defaults.admin || 50;
    }
    if (!territory.buildings) {
      territory.buildings = [];
    }
  }

  /**
   * 计算领地产出
   * @param {Object} territory - 领地对象
   * @returns {Object} { money, grain, totalProduction }
   */
  function calculateProduction(territory) {
    if (!P.territoryProductionSystem || !P.territoryProductionSystem.enabled) {
      return { money: 0, grain: 0, totalProduction: 0 };
    }

    var config = P.territoryProductionSystem;

    // 1. 基础数据
    var basePopulation = territory.basePopulation || 50000;
    var K = config.productionCoefficient || 0.9;
    var development = territory.development || 50;
    var control = territory.control || 70;
    var admin = territory.admin || 50;
    var adminBonus = config.adminBonus || 0.02;

    // 2. 计算总产出
    var totalProduction = basePopulation * K * (development / 100) * (control / 100) * (1 + admin * adminBonus);

    // 3. 计算钱粮比例
    var moneyRatio = territory.moneyRatio || 3;
    var grainRatio = territory.grainRatio || 4;
    var totalRatio = moneyRatio + grainRatio;

    var baseMoney = totalProduction * moneyRatio / totalRatio;
    var baseGrain = totalProduction * grainRatio / totalRatio;

    // 4. 建筑加成
    var buildingMoneyBonus = 0;
    var buildingGrainBonus = 0;

    if (territory.buildings && Array.isArray(territory.buildings)) {
      territory.buildings.forEach(function(building) {
        if (building.moneyBonus) buildingMoneyBonus += building.moneyBonus;
        if (building.grainBonus) buildingGrainBonus += building.grainBonus;
      });
    }

    // 5. 最终产出
    var money = Math.round(baseMoney + buildingMoneyBonus);
    var grain = Math.round(baseGrain + buildingGrainBonus);

    return {
      money: money,
      grain: grain,
      totalProduction: Math.round(totalProduction)
    };
  }

  /**
   * 计算所有领地的产出并分配给角色
   */
  function calculateAllProduction() {
    if (!P.territoryProductionSystem || !P.territoryProductionSystem.enabled) return;

    _dbg('[TerritoryProduction] ========== 领地产出计算开始 ==========');

    var totalMoney = 0;
    var totalGrain = 0;

    // 处理领地系统
    if (GM.territories && Array.isArray(GM.territories)) {
      GM.territories.forEach(function(territory) {
        var production = calculateProduction(territory);

        _dbg('[TerritoryProduction] 领地', territory.name || territory.id,
                    '产出 - 钱:', production.money, '粮:', production.grain,
                    '(人口:', territory.basePopulation, '发展:', territory.development,
                    '控制:', territory.control, '管理:', territory.admin + ')');

        // 分配给控制者
        if (territory.controllerId) {
          var controller = GM.chars.find(function(c) { return c.id === territory.controllerId; });
          if (controller) {
            if (!controller.finance) controller.finance = { income: 0 };
            controller.finance.income += production.money;

            _dbg('[TerritoryProduction] 分配给角色', controller.name, '收入:', production.money);
          }
        }

        totalMoney += production.money;
        totalGrain += production.grain;
      });
    }

    // 处理地图系统
    if (P.map && P.map.regions && Array.isArray(P.map.regions)) {
      P.map.regions.forEach(function(region) {
        if (!region.basePopulation) return; // 跳过未初始化的区域

        var production = calculateProduction(region);

        _dbg('[TerritoryProduction] 区域', region.name || region.id,
                    '产出 - 钱:', production.money, '粮:', production.grain);

        // 分配给拥有者
        if (region.owner) {
          var owner = GM.chars.find(function(c) { return c.name === region.owner || c.id === region.owner; });
          if (owner) {
            if (!owner.finance) owner.finance = { income: 0 };
            owner.finance.income += production.money;

            _dbg('[TerritoryProduction] 分配给角色', owner.name, '收入:', production.money);
          }
        }

        totalMoney += production.money;
        totalGrain += production.grain;
      });
    }

    _dbg('[TerritoryProduction] 总产出 - 钱:', totalMoney, '粮:', totalGrain);
    _dbg('[TerritoryProduction] ========== 领地产出计算完成 ==========');
  }

  /**
   * 更新领地属性（自然漂移）
   */
  function updateTerritoryAttributes() {
    if (!P.territoryProductionSystem || !P.territoryProductionSystem.enabled) return;

    // 处理领地系统
    if (GM.territories && Array.isArray(GM.territories)) {
      GM.territories.forEach(function(territory) {
        updateSingleTerritory(territory);
      });
    }

    // 处理地图系统
    if (P.map && P.map.regions && Array.isArray(P.map.regions)) {
      P.map.regions.forEach(function(region) {
        if (region.basePopulation) {
          updateSingleTerritory(region);
        }
      });
    }
  }

  /**
   * 更新单个领地属性
   */
  function updateSingleTerritory(territory) {
    var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    // 发展度自然增长（月基准0.1）
    if (territory.development < 100) {
      territory.development = Math.min(100, territory.development + 0.1 * _ms);
    }

    // 控制度/民心变化由AI推演驱动，此处仅做微幅惯性趋势
    // 大幅变化通过AI的map_changes字段实现
    if (territory.control < territory.populace) {
      territory.control = Math.min(100, territory.control + 0.1 * _ms);
    } else if (territory.control > territory.populace) {
      territory.control = Math.max(0, territory.control - 0.1 * _ms);
    }
  }

  // 公共接口
  return {
    initialize: initializeTerritories,
    calculateProduction: calculateProduction,
    calculateAll: calculateAllProduction,
    updateAttributes: updateTerritoryAttributes
  };
})();

// ============================================================
// Namespace export·暴露 8D 人格聚合 + 性格摘要到 TM.NpcEngine
// 让 tm-chaoyi-changchao.js 等模块走 TM.NpcEngine.aggregateDims(ch)
// 跟 TM.PromptComposer.buildAiPersonaText(ch) 同 paradigm
// ============================================================
if (typeof window !== 'undefined') {
  window.TM = window.TM || {};
  window.TM.NpcEngine = window.TM.NpcEngine || {};
  window.TM.NpcEngine.aggregateDims = _aggregatePersonalityDims;
  window.TM.NpcEngine.getCharacterPersonalityBrief = getCharacterPersonalityBrief;
}

// ============================================================
