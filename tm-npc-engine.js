// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Interaction System - 交互注册表系统
// Requires: tm-data-model.js (P, GM), tm-utils.js (_dbg, callAI, getTS, uid, extractJSON),
//           tm-index-world.js (findCharByName, findFacByName),
//           tm-game-engine.js (addEB),
//           tm-dynamic-systems.js (AICache, recordChange, addToIndex)
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

/**
 * Interaction 注册表系统
 * 借鉴晚唐风云的设计：统一交互入口，避免 UI 按钮泛滥
 *
 * 核心概念：
 * 1. 所有交互操作注册为 Interaction 对象
 * 2. 统一从角色入口触发（右键菜单/交互面板）
 * 3. 条件检查、成本计算、效果应用统一管理
 * 4. 支持分类：外交、人事、经济、军事、阴谋
 */
var InteractionSystem = (function() {
  /**
   * 初始化交互系统
   */
  function initialize() {
    if (!P.interactionSystem || !P.interactionSystem.enabled) {
      return;
    }

    _dbg('[InteractionSystem] 初始化交互系统');
    _dbg('[InteractionSystem] 已注册 ' + P.interactionSystem.interactions.length + ' 个交互');
  }

  /**
   * 获取可用的交互列表
   * @param {Object} source - 发起者
   * @param {Object} target - 目标
   * @param {string} category - 分类（可选）
   * @returns {Array} 可用的交互列表
   */
  function getAvailableInteractions(source, target, category) {
    if (!P.interactionSystem || !P.interactionSystem.enabled) {
      return [];
    }

    var interactions = P.interactionSystem.interactions;

    // 过滤分类
    if (category) {
      interactions = interactions.filter(function(i) {
        return i.category === category;
      });
    }

    // 过滤条件
    var available = interactions.filter(function(interaction) {
      return checkConditions(interaction, source, target);
    });

    return available;
  }

  /**
   * 检查交互条件
   */
  function checkConditions(interaction, source, target) {
    if (!interaction.conditions || interaction.conditions.length === 0) {
      return true;
    }

    // 检查所有条件
    for (var i = 0; i < interaction.conditions.length; i++) {
      var condition = interaction.conditions[i];

      if (!evaluateCondition(condition, source, target)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 评估单个条件
   */
  function evaluateCondition(condition, source, target) {
    var type = condition.type;
    var field = condition.field;
    var operator = condition.operator;
    var value = condition.value;

    var actualValue;

    // 根据类型获取实际值
    switch (type) {
      case 'source':
        actualValue = getFieldValue(source, field);
        break;
      case 'target':
        actualValue = getFieldValue(target, field);
        break;
      case 'relation':
        actualValue = getRelationValue(source, target, field);
        break;
      case 'variable':
        actualValue = getVariableValue(field);
        break;
      default:
        return true;
    }

    // 比较
    switch (operator) {
      case '>': return actualValue > value;
      case '>=': return actualValue >= value;
      case '<': return actualValue < value;
      case '<=': return actualValue <= value;
      case '==': return actualValue === value;
      case '!=': return actualValue !== value;
      default: return true;
    }
  }

  /**
   * 获取对象字段值
   */
  function getFieldValue(obj, field) {
    if (!obj) return 0;
    return obj[field] || 0;
  }

  /**
   * 获取关系值
   */
  function getRelationValue(source, target, field) {
    // 简化实现：返回 0
    return 0;
  }

  /**
   * 获取变量值
   */
  function getVariableValue(varName) {
    var variable = Object.values(GM.vars).find(function(v) { return v.name === varName; });
    return variable ? (variable.value || 0) : 0;
  }

  /**
   * 执行交互
   * @param {string} interactionId - 交互 ID
   * @param {Object} source - 发起者
   * @param {Object} target - 目标
   * @returns {boolean} 是否成功
   */
  function executeInteraction(interactionId, source, target) {
    if (!P.interactionSystem || !P.interactionSystem.enabled) {
      return false;
    }

    var interaction = P.interactionSystem.interactions.find(function(i) {
      return i.id === interactionId;
    });

    if (!interaction) {
      console.error('[InteractionSystem] 交互不存在: ' + interactionId);
      return false;
    }

    // 检查条件
    if (!checkConditions(interaction, source, target)) {
      console.error('[InteractionSystem] 交互条件不满足: ' + interactionId);
      return false;
    }

    // 扣除成本
    if (interaction.cost) {
      if (!payCost(interaction.cost, source)) {
        console.error('[InteractionSystem] 成本不足: ' + interactionId);
        return false;
      }
    }

    // 应用效果
    if (interaction.effects) {
      applyEffects(interaction.effects, source, target);
    }

    _dbg('[InteractionSystem] 执行交互: ' + interaction.name);
    return true;
  }

  /**
   * 支付成本
   */
  function payCost(cost, source) {
    // 简化实现：检查并扣除金钱
    if (cost.money) {
      var money = source.money || 0;
      if (money < cost.money) {
        return false;
      }
      source.money = money - cost.money;
    }

    return true;
  }

  /**
   * 应用效果
   */
  function applyEffects(effects, source, target) {
    effects.forEach(function(effect) {
      var type = effect.type;
      var field = effect.field;
      var value = effect.value;

      switch (type) {
        case 'source':
          if (source[field] !== undefined) {
            source[field] = (source[field] || 0) + value;
          }
          break;
        case 'target':
          if (target && target[field] !== undefined) {
            target[field] = (target[field] || 0) + value;
          }
          break;
        case 'variable':
          var variable = Object.values(GM.vars).find(function(v) { return v.name === field; });
          if (variable) {
            variable.value = (variable.value || 0) + value;
          }
          break;
      }
    });
  }

  /**
   * 重置系统
   */
  function reset() {
    _dbg('[InteractionSystem] 已重置系统');
  }

  return {
    initialize: initialize,
    getAvailableInteractions: getAvailableInteractions,
    executeInteraction: executeInteraction,
    reset: reset
  };
})();

// ============================================================
// NPC Engine - 双层分离架构
// ============================================================

/**
 * NPC Engine 双层分离架构
 * 借鉴晚唐风云的设计：底层引擎不知道玩家存在
 *
 * 核心概念：
 * 1. 底层：世界自动运转层（NPC Engine）
 *    - 引擎完全不知道"玩家"的存在
 *    - 引擎只负责根据规则，为每个有决策权的角色（Actor）生成"本回合待处理事项"（Tasks）
 *    - 引擎根据角色的身份（是 NPC 还是 Player），决定这些 Task 是自动执行，还是放入收件箱
 *
 * 2. 表层：玩家决策窗口层（UI & 交互）
 *    - 玩家扮演某个角色时，本质上就是接管了该角色的"收件箱"
 *    - 玩家通过 UI 消费这些 Task，完成决策
 *    - 玩家换角色，收件箱的内容自然改变，体验无缝切换
 */
var NpcEngine = (function() {
  /**
   * 初始化 NPC Engine
   */
  function initialize() {
    if (!P.npcEngine || !P.npcEngine.enabled) {
      return;
    }

    _dbg('[NpcEngine] 初始化 NPC Engine');

    // 初始化玩家待处理任务队列
    if (!GM.playerPendingTasks) {
      GM.playerPendingTasks = [];
    }

    // 初始化玩家角色 ID（默认为第一个角色）
    if (!GM.playerCharacterId && GM.chars.length > 0) {
      GM.playerCharacterId = GM.chars[0].id;
    }

    _dbg('[NpcEngine] 初始化完成，玩家角色: ' + GM.playerCharacterId);
  }

  /**
   * 运行 NPC Engine（每回合调用）
   * 这是核心管线：生成任务 → 路由（NPC执行/玩家进队列）
   */
  function runEngine() {
    if (!P.npcEngine || !P.npcEngine.enabled) {
      return;
    }

    _dbg('[NpcEngine] 开始运行 NPC Engine (T' + GM.turn + ')');

    // Step 1: 清理过期任务
    cleanupExpiredTasks();

    // Step 2: 收集所有决策者（有决策权的角色）
    var actors = collectActors();
    _dbg('[NpcEngine] 收集到 ' + actors.length + ' 个决策者');

    // Step 3: 决策循环
    actors.forEach(function(actor) {
      processActor(actor);
    });

    _dbg('[NpcEngine] NPC Engine 运行完成');
  }

  /**
   * 清理过期任务（超时后自动执行）
   */
  function cleanupExpiredTasks() {
    if (!GM.playerPendingTasks || GM.playerPendingTasks.length === 0) {
      return;
    }

    var deadline = P.npcEngine.taskDeadline || 3;
    var expiredTasks = [];

    // 找出所有过期任务
    GM.playerPendingTasks = GM.playerPendingTasks.filter(function(task) {
      var age = GM.turn - task.createdTurn;
      if (age >= deadline) {
        expiredTasks.push(task);
        return false; // 从队列中移除
      }
      return true;
    });

    // 执行过期任务的兜底逻辑
    if (expiredTasks.length > 0) {
      _dbg('[NpcEngine] 发现 ' + expiredTasks.length + ' 个过期任务，执行兜底逻辑');
      expiredTasks.forEach(function(task) {
        executeFallback(task);
      });
    }
  }

  /**
   * 收集所有决策者
   * 决策者：活着的、有官职的、或者有特殊权限的角色
   */
  function collectActors() {
    var actors = [];

    GM.chars.forEach(function(char) {
      if (char.dead) {
        return; // 跳过已死亡角色
      }

      // 检查是否有决策权
      if (hasDecisionPower(char)) {
        actors.push(char);
      }
    });

    return actors;
  }

  /**
   * 检查角色是否有决策权
   */
  function hasDecisionPower(character) {
    // 简化实现：所有活着的角色都有决策权
    // 实际游戏中可以根据官职、权限等判断
    return true;
  }

  /**
   * 处理单个决策者
   */
  function processActor(actor) {
    var isPlayer = (actor.id === GM.playerCharacterId);

    // 计算本回合最大行动数
    var maxActions = calculateMaxActions(actor);

    // 收集所有行为模块生成的任务
    var tasks = [];
    var behaviors = P.npcEngine.behaviors || [];

    behaviors.forEach(function(behavior) {
      var task = generateTask(behavior, actor);
      if (task) {
        tasks.push(task);
      }
    });

    if (tasks.length === 0) {
      return; // 本回合无任务
    }

    // 按权重排序
    tasks.sort(function(a, b) {
      return b.weight - a.weight;
    });

    // 取前 maxActions 个任务
    var selectedTasks = tasks.slice(0, maxActions);

    _dbg('[NpcEngine] ' + actor.name + ' 本回合有 ' + selectedTasks.length + ' 个任务');

    // 路由：NPC 自动执行 / 玩家进队列
    selectedTasks.forEach(function(task) {
      if (isPlayer) {
        // 玩家角色：任务进入收件箱
        addPlayerTask(task);
      } else {
        // NPC 角色：自动执行
        executeAsNpc(task);
      }
    });
  }

  /**
   * 计算角色本回合最大行动数（按品级分档）
   * 一~三品:3次/回合  四~五品:2次  六~七品:1次  八~九品:每N月1次(timeRatio换算)
   */
  function calculateMaxActions(character) {
    // 优先使用编辑器配置的品级频率表
    var freqTable = P.npcEngine && P.npcEngine.rankActionFrequency;
    if (freqTable && Array.isArray(freqTable) && freqTable.length > 0) {
      var rank = character.rankLevel || (character.rank || 9); // 九品制1-9，品级越小越高
      for (var i = 0; i < freqTable.length; i++) {
        var rule = freqTable[i];
        if (rank >= (rule.minRank || 1) && rank <= (rule.maxRank || 9)) {
          // 每回合N次行动
          if (rule.actionsPerTurn) return rule.actionsPerTurn;
          // 每N月1次行动（低品级）
          if (rule.actionIntervalMonths) {
            var interval = (typeof turnsForMonths === 'function') ? turnsForMonths(rule.actionIntervalMonths) : rule.actionIntervalMonths;
            // 非行动回合→返回0
            if (interval > 1 && GM.turn % interval !== 0) return 0;
            return 1;
          }
        }
      }
    }

    // 兜底：使用旧逻辑
    var maxActions = P.npcEngine.maxActionsPerTurn || 3;
    if (character.management && character.management > 80) maxActions += 1;
    return maxActions;
  }

  /**
   * 生成任务（调用行为模块的 generateTask）
   */
  function generateTask(behavior, actor) {
    if (!behavior.generateTask) {
      return null;
    }

    try {
      var context = GM.npcContext || {};
      var result = behavior.generateTask(actor, context);

      if (!result) {
        return null;
      }

      return {
        id: generateTaskId(),
        type: behavior.id,
        actorId: actor.id,
        data: result.data,
        weight: result.weight || 0,
        createdTurn: GM.turn,
        behavior: behavior
      };
    } catch (error) {
      console.error('[NpcEngine] 生成任务失败:', error);
      return null;
    }
  }

  /**
   * 生成任务 ID
   */
  function generateTaskId() {
    return 'task_' + GM.turn + '_' + Date.now() + '_' + random().toString(36).substr(2, 9);
  }

  /**
   * 添加玩家任务到收件箱
   */
  function addPlayerTask(task) {
    if (!GM.playerPendingTasks) {
      GM.playerPendingTasks = [];
    }

    GM.playerPendingTasks.push(task);
    _dbg('[NpcEngine] 添加玩家任务: ' + task.type);
  }

  /**
   * NPC 自动执行任务
   */
  function executeAsNpc(task) {
    if (!task.behavior || !task.behavior.executeAsNpc) {
      console.error('[NpcEngine] 任务缺少执行逻辑:', task.type);
      return;
    }

    try {
      var actor = GM.chars.find(function(c) { return c.id === task.actorId; });
      if (!actor) {
        console.error('[NpcEngine] 找不到角色:', task.actorId);
        return;
      }

      var context = GM.npcContext || {};
      task.behavior.executeAsNpc(actor, task.data, context);
      _dbg('[NpcEngine] NPC 执行任务: ' + actor.name + ' - ' + task.type);
    } catch (error) {
      console.error('[NpcEngine] NPC 执行任务失败:', error);
    }
  }

  /**
   * 执行过期任务的兜底逻辑
   */
  function executeFallback(task) {
    if (!task.behavior) {
      console.error('[NpcEngine] 任务缺少行为模块:', task.type);
      return;
    }

    try {
      var actor = GM.chars.find(function(c) { return c.id === task.actorId; });
      if (!actor) {
        console.error('[NpcEngine] 找不到角色:', task.actorId);
        return;
      }

      var context = GM.npcContext || {};

      // 优先使用 executeFallback，否则使用 executeAsNpc
      if (task.behavior.executeFallback) {
        task.behavior.executeFallback(actor, task.data, context);
      } else if (task.behavior.executeAsNpc) {
        task.behavior.executeAsNpc(actor, task.data, context);
      }

      _dbg('[NpcEngine] 执行过期任务兜底: ' + actor.name + ' - ' + task.type);
    } catch (error) {
      console.error('[NpcEngine] 执行兜底逻辑失败:', error);
    }
  }

  /**
   * 完成玩家任务（玩家通过 UI 完成任务后调用）
   */
  function completePlayerTask(taskId) {
    if (!GM.playerPendingTasks) {
      return;
    }

    GM.playerPendingTasks = GM.playerPendingTasks.filter(function(task) {
      return task.id !== taskId;
    });

    _dbg('[NpcEngine] 玩家完成任务: ' + taskId);
  }

  /**
   * 获取玩家待处理任务列表
   */
  function getPlayerTasks() {
    return GM.playerPendingTasks || [];
  }

  /**
   * 切换玩家角色
   */
  function switchPlayerCharacter(characterId) {
    GM.playerCharacterId = characterId;
    _dbg('[NpcEngine] 切换玩家角色: ' + characterId);
  }

  /**
   * 重置系统
   */
  function reset() {
    GM.playerPendingTasks = [];
    GM.playerCharacterId = null;
    _dbg('[NpcEngine] 已重置系统');
  }

  return {
    initialize: initialize,
    runEngine: runEngine,
    completePlayerTask: completePlayerTask,
    getPlayerTasks: getPlayerTasks,
    switchPlayerCharacter: switchPlayerCharacter,
    reset: reset
  };
})();

function generateChangeReport() {
  var html = '';
  var sectionId = 0;

  // 财政变量
  var varSection = '';
  if (GM.turnChanges.variables && GM.turnChanges.variables.length > 0) {
    GM.turnChanges.variables.forEach(function(v) {
      if (v.delta === 0 && v.reasons.every(function(r) { return r.amount === 0; })) return;

      var deltaColor = v.delta > 0 ? 'var(--success)' : (v.delta < 0 ? 'var(--danger)' : 'var(--txt-d)');
      var deltaSign = v.delta > 0 ? '+' : '';
      var deltaIcon = v.delta > 0 ? '📈' : (v.delta < 0 ? '📉' : '➖');

      varSection += '<div style="margin-bottom:0.8rem;padding:0.8rem;background:var(--bg-3);border-radius:8px;border-left:4px solid '+deltaColor+';">';
      varSection += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
      varSection += '<div style="display:flex;align-items:center;gap:0.5rem;">';
      varSection += '<span style="font-size:1.2rem;">'+deltaIcon+'</span>';
      varSection += '<strong style="color:var(--gold);font-size:1rem;">' + v.name + '</strong>';
      varSection += '</div>';
      varSection += '<div style="display:flex;align-items:center;gap:1rem;">';
      varSection += '<span style="color:var(--txt-d);font-size:0.85rem">' + v.oldValue.toFixed(0) + ' → ' + v.newValue.toFixed(0) + '</span>';
      varSection += '<span style="color:' + deltaColor + ';font-weight:700;font-size:1.1rem;">' + deltaSign + v.delta.toFixed(0) + '</span>';
      varSection += '</div>';
      varSection += '</div>';

      // 明细
      if (v.reasons && v.reasons.length > 0) {
        var incomeItems = v.reasons.filter(function(r) { return r.type === '收入明细'; });
        var expenseItems = v.reasons.filter(function(r) { return r.type === '支出明细'; });
        var regularItems = v.reasons.filter(function(r) { return r.type !== '收入明细' && r.type !== '支出明细'; });

        if (incomeItems.length > 0) {
          varSection += '<div style="font-size:0.8rem;color:var(--success);margin-top:0.4rem;padding:0.3rem 0.5rem;background:rgba(0,255,0,0.05);border-radius:4px;">💰 收入：' + incomeItems.map(function(r) { return r.desc; }).join('、') + '</div>';
        }
        if (expenseItems.length > 0) {
          varSection += '<div style="font-size:0.8rem;color:var(--danger);margin-top:0.3rem;padding:0.3rem 0.5rem;background:rgba(255,0,0,0.05);border-radius:4px;">💸 支出：' + expenseItems.map(function(r) { return r.desc; }).join('、') + '</div>';
        }

        if (regularItems.length > 0) {
          varSection += '<div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--bg-2);">';
          regularItems.forEach(function(r) {
            if (r.amount !== 0) {
              var rColor = r.amount > 0 ? 'var(--success)' : 'var(--danger)';
              var rSign = r.amount > 0 ? '+' : '';
              var rIcon = r.amount > 0 ? '✅' : '❌';
              varSection += '<div style="font-size:0.8rem;color:var(--txt-s);margin-top:0.3rem;display:flex;align-items:center;gap:0.3rem;">';
              varSection += '<span>'+rIcon+'</span>';
              varSection += '<span>' + r.type + '：</span>';
              varSection += '<span style="color:' + rColor + ';font-weight:600;">' + rSign + r.amount.toFixed(0) + '</span>';
              varSection += '<span style="color:var(--txt-dim);">(' + r.desc + ')</span>';
              varSection += '</div>';
            }
          });
          varSection += '</div>';
        }
      }

      varSection += '</div>';
    });
  }

  if (varSection) {
    sectionId++;
    html += '<div class="turn-section" style="margin-bottom:1rem;">';
    html += '<h3 style="cursor:pointer;user-select:none;padding:0.8rem;background:var(--bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSection(\'section-'+sectionId+'\')">';
    html += '<span>💰 财政变化</span>';
    html += '<span id="section-'+sectionId+'-icon" style="font-size:0.8rem;">▼</span>';
    html += '</h3>';
    html += '<div class="turn-section-content" id="section-'+sectionId+'" style="padding:0.8rem;">' + varSection + '</div>';
    html += '</div>';
  }

  // 军事变化
  var milSection = '';
  if (GM.turnChanges.military && GM.turnChanges.military.length > 0) {
    GM.turnChanges.military.forEach(function(m) {
      milSection += '<div style="margin-bottom:0.8rem;padding:0.8rem;background:var(--bg-3);border-radius:8px;border-left:4px solid var(--danger);">';
      milSection += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">';
      milSection += '<span style="font-size:1.2rem;">⚔️</span>';
      milSection += '<strong style="color:var(--gold);font-size:1rem;">' + m.name + '</strong>';
      milSection += '</div>';
      m.changes.forEach(function(c) {
        milSection += '<div style="font-size:0.85rem;color:var(--txt-s);margin-left:1.5rem;margin-top:0.3rem;">• ' + c.field + '：<span style="color:var(--txt);">' + c.oldValue + ' → ' + c.newValue + '</span> <span style="color:var(--txt-dim);">(' + c.reason + ')</span></div>';
      });
      milSection += '</div>';
    });
  }

  if (milSection) {
    sectionId++;
    html += '<div class="turn-section" style="margin-bottom:1rem;">';
    html += '<h3 style="cursor:pointer;user-select:none;padding:0.8rem;background:var(--bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSection(\'section-'+sectionId+'\')">';
    html += '<span>⚔️ 军事变化</span>';
    html += '<span id="section-'+sectionId+'-icon" style="font-size:0.8rem;">▼</span>';
    html += '</h3>';
    html += '<div class="turn-section-content" id="section-'+sectionId+'" style="padding:0.8rem;">' + milSection + '</div>';
    html += '</div>';
  }

  // 人物变化
  var chrSection = '';
  if (GM.turnChanges.characters && GM.turnChanges.characters.length > 0) {
    GM.turnChanges.characters.forEach(function(c) {
      chrSection += '<div style="margin-bottom:0.8rem;padding:0.8rem;background:var(--bg-3);border-radius:8px;border-left:4px solid var(--primary);">';
      chrSection += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">';
      chrSection += '<span style="font-size:1.2rem;">👤</span>';
      chrSection += '<strong style="color:var(--gold);font-size:1rem;">' + c.name + '</strong>';
      chrSection += '</div>';
      c.changes.forEach(function(ch) {
        var changeIcon = '•';
        if (ch.field === 'loyalty') changeIcon = '💙';
        if (ch.field === 'status') changeIcon = '💀';
        chrSection += '<div style="font-size:0.85rem;color:var(--txt-s);margin-left:1.5rem;margin-top:0.3rem;">'+changeIcon+' ' + ch.field + '：<span style="color:var(--txt);">' + ch.oldValue + ' → ' + ch.newValue + '</span> <span style="color:var(--txt-dim);">(' + ch.reason + ')</span></div>';
      });
      chrSection += '</div>';
    });
  }

  if (chrSection) {
    sectionId++;
    html += '<div class="turn-section" style="margin-bottom:1rem;">';
    html += '<h3 style="cursor:pointer;user-select:none;padding:0.8rem;background:var(--bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSection(\'section-'+sectionId+'\')">';
    html += '<span>👤 人物变化</span>';
    html += '<span id="section-'+sectionId+'-icon" style="font-size:0.8rem;">▼</span>';
    html += '</h3>';
    html += '<div class="turn-section-content" id="section-'+sectionId+'" style="padding:0.8rem;">' + chrSection + '</div>';
    html += '</div>';
  }

  // 势力变化
  var facSection = '';
  if (GM.turnChanges.factions && GM.turnChanges.factions.length > 0) {
    GM.turnChanges.factions.forEach(function(f) {
      facSection += '<div style="margin-bottom:0.8rem;padding:0.8rem;background:var(--bg-3);border-radius:8px;border-left:4px solid var(--warning);">';
      facSection += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">';
      facSection += '<span style="font-size:1.2rem;">🏛️</span>';
      facSection += '<strong style="color:var(--gold);font-size:1rem;">' + f.name + '</strong>';
      facSection += '</div>';
      f.changes.forEach(function(ch) {
        facSection += '<div style="font-size:0.85rem;color:var(--txt-s);margin-left:1.5rem;margin-top:0.3rem;">• ' + ch.field + '：<span style="color:var(--txt);">' + ch.oldValue + ' → ' + ch.newValue + '</span> <span style="color:var(--txt-dim);">(' + ch.reason + ')</span></div>';
      });
      facSection += '</div>';
    });
  }

  if (facSection) {
    sectionId++;
    html += '<div class="turn-section" style="margin-bottom:1rem;">';
    html += '<h3 style="cursor:pointer;user-select:none;padding:0.8rem;background:var(--bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSection(\'section-'+sectionId+'\')">';
    html += '<span>🏛️ 势力变化</span>';
    html += '<span id="section-'+sectionId+'-icon" style="font-size:0.8rem;">▼</span>';
    html += '</h3>';
    html += '<div class="turn-section-content" id="section-'+sectionId+'" style="padding:0.8rem;">' + facSection + '</div>';
    html += '</div>';
  }

  // 党派变化
  var partySection = '';
  if (GM.turnChanges.parties && GM.turnChanges.parties.length > 0) {
    GM.turnChanges.parties.forEach(function(p) {
      partySection += '<div style="margin-bottom:0.8rem;padding:0.8rem;background:var(--bg-3);border-radius:8px;border-left:4px solid var(--info);">';
      partySection += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">';
      partySection += '<span style="font-size:1.2rem;">🎭</span>';
      partySection += '<strong style="color:var(--gold);font-size:1rem;">' + p.name + '</strong>';
      partySection += '</div>';
      p.changes.forEach(function(ch) {
        partySection += '<div style="font-size:0.85rem;color:var(--txt-s);margin-left:1.5rem;margin-top:0.3rem;">• ' + ch.field + '：<span style="color:var(--txt);">' + ch.oldValue + ' → ' + ch.newValue + '</span> <span style="color:var(--txt-dim);">(' + ch.reason + ')</span></div>';
      });
      partySection += '</div>';
    });
  }

  if (partySection) {
    sectionId++;
    html += '<div class="turn-section" style="margin-bottom:1rem;">';
    html += '<h3 style="cursor:pointer;user-select:none;padding:0.8rem;background:var(--bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSection(\'section-'+sectionId+'\')">';
    html += '<span>🎭 党派变化</span>';
    html += '<span id="section-'+sectionId+'-icon" style="font-size:0.8rem;">▼</span>';
    html += '</h3>';
    html += '<div class="turn-section-content" id="section-'+sectionId+'" style="padding:0.8rem;">' + partySection + '</div>';
    html += '</div>';
  }

  // 阶层变化
  var classSection = '';
  if (GM.turnChanges.classes && GM.turnChanges.classes.length > 0) {
    GM.turnChanges.classes.forEach(function(c) {
      classSection += '<div style="margin-bottom:0.8rem;padding:0.8rem;background:var(--bg-3);border-radius:8px;border-left:4px solid var(--accent);">';
      classSection += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">';
      classSection += '<span style="font-size:1.2rem;">👥</span>';
      classSection += '<strong style="color:var(--gold);font-size:1rem;">' + c.name + '</strong>';
      classSection += '</div>';
      c.changes.forEach(function(ch) {
        classSection += '<div style="font-size:0.85rem;color:var(--txt-s);margin-left:1.5rem;margin-top:0.3rem;">• ' + ch.field + '：<span style="color:var(--txt);">' + ch.oldValue + ' → ' + ch.newValue + '</span> <span style="color:var(--txt-dim);">(' + ch.reason + ')</span></div>';
      });
      classSection += '</div>';
    });
  }

  if (classSection) {
    sectionId++;
    html += '<div class="turn-section" style="margin-bottom:1rem;">';
    html += '<h3 style="cursor:pointer;user-select:none;padding:0.8rem;background:var(--bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onclick="toggleSection(\'section-'+sectionId+'\')">';
    html += '<span>👥 阶层变化</span>';
    html += '<span id="section-'+sectionId+'-icon" style="font-size:0.8rem;">▼</span>';
    html += '</h3>';
    html += '<div class="turn-section-content" id="section-'+sectionId+'" style="padding:0.8rem;">' + classSection + '</div>';
    html += '</div>';
  }

  // 如果没有任何变化
  if (!html) {
    html = '<div class="turn-section" style="margin-bottom:1rem;"><h3 style="padding:0.8rem;background:var(--bg-2);border-radius:8px;">📊 本回合数值变化</h3><div class="turn-section-content" style="padding:0.8rem;"><span style="color:var(--txt-d)">无显著变化</span></div></div>';
  }

  return html;
}

// 折叠/展开区块
function toggleSection(sectionId) {
  var section = document.getElementById(sectionId);
  var icon = document.getElementById(sectionId + '-icon');
  if (section && icon) {
    if (section.style.display === 'none') {
      section.style.display = 'block';
      icon.textContent = '▼';
    } else {
      section.style.display = 'none';
      icon.textContent = '▶';
    }
  }
}

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
 * 党派影响力→成员忠诚度关联
 */
function updatePartyLoyaltyLink() {
  var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
  var parties = GM.parties || [];
  if (!GM.chars || parties.length === 0) return;

  GM.chars.forEach(function(c) {
    if (!c.party || c.party === '\u65E0\u515A\u6D3E' || c.alive === false || c.isPlayer) return;
    var myParty = parties.find(function(p) { return p.name === c.party; });
    if (!myParty) return;
    if (myParty.status === '\u88AB\u538B\u5236' || (myParty.influence || 0) < 15) {
      // 被压制党派成员：忠诚度缓慢下降
      c.loyalty = Math.max(0, (c.loyalty || 50) - 2 * _ms);
    } else if (myParty.status === '\u6D3B\u8DC3' && (myParty.influence || 0) > 60) {
      // 得势党派成员：忠诚度微升
      c.loyalty = Math.min(100, (c.loyalty || 50) + 1 * _ms);
    }
  });
}

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

/**
 * 构建 NpcContext 快照
 * 借鉴晚唐风云的设计：在回合开始时构建一次全局快照，所有系统共享
 * 避免在决策循环中高频读取 GM 和重复计算，提升性能和数据一致性
 *
 * @returns {Object} NpcContext 快照对象
 */
function buildNpcContext() {
  var context = {
    // 基础信息
    turn: GM.turn,
    year: getCurrentYear(),
    month: getCurrentMonth(),
    timestamp: Date.now(),

    // 核心数据快照（深拷贝，避免后续修改影响快照）
    characters: GM.chars ? deepClone(GM.chars) : [],
    factions: GM.facs ? deepClone(GM.facs) : [],
    parties: GM.parties ? deepClone(GM.parties) : [],
    classes: GM.classes ? deepClone(GM.classes) : [],

    // 变量快照（转换为简单对象，便于访问）
    variables: {},
    relations: {},

    // 预计算缓存（O(1) 查询）
    cache: {
      // 人格缓存：characterId -> personality
      personality: {},

      // 好感度缓存：observerId -> { targetId -> opinion }
      opinion: {},

      // 军事力量缓存：factionId -> strength
      militaryStrength: {},

      // 经济水平缓存：factionId -> economicLevel
      economicLevel: {},

      // 时代状态缓存
      eraState: GM.eraState ? deepClone(GM.eraState) : null
    }
  };

  // 1. 构建变量快照
  if (GM.vars) {
    Object.keys(GM.vars).forEach(function(key) {
      var v = GM.vars[key];
      context.variables[key] = {
        value: v.value || 0,
        min: v.min || 0,
        max: v.max || 100,
        name: v.name || key
      };
    });
  }

  // 2. 构建关系快照
  if (GM.rels) {
    Object.keys(GM.rels).forEach(function(key) {
      var r = GM.rels[key];
      context.relations[key] = {
        value: r.value || 0,
        name: r.name || key
      };
    });
  }

  // 3. 预计算人格缓存（从traitIds聚合8D维度，存入_dims不覆盖personality字符串）
  context.characters.forEach(function(char) {
    var dims = _aggregatePersonalityDims(char);
    var key = char.id || char.name;
    if (key) context.cache.personality[key] = dims;
    char._dims = dims; // 独立字段，不覆盖原personality文本
  });

  // 4. 预计算好感度缓存（使用双轨好感系统）
  context.characters.forEach(function(char) {
    if (!char.name) return;
    context.cache.opinion[char.name] = {};
    // 优先使用 OpinionSystem（基础+事件双轨）
    if (typeof OpinionSystem !== 'undefined') {
      var charObj = findCharByName(char.name);
      if (!charObj) return;  // 找不到本人对应实体·跳过（可能是已死/已删除）
      context.characters.forEach(function(target) {
        if (!target || !target.name || target.name === char.name) return;
        var targetObj = findCharByName(target.name);
        if (!targetObj) return;  // 防御：目标实体不存在
        context.cache.opinion[char.name][target.name] = OpinionSystem.getTotal(charObj, targetObj);
      });
    } else if (char.opinions) {
      // 回退到旧的 opinions 字段
      Object.keys(char.opinions).forEach(function(targetId) {
        context.cache.opinion[char.name][targetId] = char.opinions[targetId];
      });
    }
  });

  // 5. 预计算军事力量缓存
  context.factions.forEach(function(faction) {
    if (faction.id) {
      var strength = 0;

      // 从军队系统计算力量
      if (GM.armies && GM.armies.length > 0) {
        GM.armies.forEach(function(army) {
          if (army.factionId === faction.id) {
            strength += army.strength || 0;
          }
        });
      }

      // 从部队系统计算力量
      if (GM.troops && GM.troops.length > 0) {
        GM.troops.forEach(function(troop) {
          if (troop.factionId === faction.id) {
            strength += troop.count || 0;
          }
        });
      }

      context.cache.militaryStrength[faction.id] = Math.round(strength);
    }
  });

  // 6. 预计算经济水平缓存
  context.factions.forEach(function(faction) {
    if (faction.id) {
      var economicLevel = 0;

      // 从变量中获取经济相关数值
      var economicVars = ['treasury', 'wealth', 'economy', 'tax', 'trade', '国库', '财富', '经济'];
      var count = 0;

      economicVars.forEach(function(varName) {
        if (context.variables[varName] && context.variables[varName].value !== undefined) {
          economicLevel += context.variables[varName].value;
          count++;
        }
      });

      if (count > 0) {
        economicLevel = Math.round(economicLevel / count);
      }

      context.cache.economicLevel[faction.id] = economicLevel;
    }
  });

  return context;
}

/**
 * 从 NpcContext 获取角色
 * @param {Object} context - NpcContext 快照
 * @param {string} charId - 角色 ID
 * @returns {Object|null} 角色对象
 */
function getCharacterFromContext(context, charId) {
  if (!context || !context.characters) return null;
  return context.characters.find(function(c) { return c.id === charId; }) || null;
}

/**
 * 从 NpcContext 获取派系
 * @param {Object} context - NpcContext 快照
 * @param {string} factionId - 派系 ID
 * @returns {Object|null} 派系对象
 */
function getFactionFromContext(context, factionId) {
  if (!context || !context.factions) return null;
  return context.factions.find(function(f) { return f.id === factionId; }) || null;
}

/**
 * 从 NpcContext 获取变量值
 * @param {Object} context - NpcContext 快照
 * @param {string} varName - 变量名
 * @returns {number} 变量值
 */
function getVariableFromContext(context, varName) {
  if (!context || !context.variables || !context.variables[varName]) return 0;
  return context.variables[varName].value || 0;
}

/**
 * 从 NpcContext 获取关系值
 * @param {Object} context - NpcContext 快照
 * @param {string} relName - 关系名
 * @returns {number} 关系值
 */
function getRelationFromContext(context, relName) {
  if (!context || !context.relations || !context.relations[relName]) return 0;
  return context.relations[relName].value || 0;
}

/**
 * 从 NpcContext 获取好感度
 * @param {Object} context - NpcContext 快照
 * @param {string} observerId - 观察者 ID
 * @param {string} targetId - 目标 ID
 * @returns {number} 好感度值
 */
function getOpinionFromContext(context, observerId, targetId) {
  if (!context || !context.cache || !context.cache.opinion) return 0;
  if (!context.cache.opinion[observerId]) return 0;
  return context.cache.opinion[observerId][targetId] || 0;
}

/**
 * 从 NpcContext 获取军事力量
 * @param {Object} context - NpcContext 快照
 * @param {string} factionId - 派系 ID
 * @returns {number} 军事力量
 */
function getMilitaryStrengthFromContext(context, factionId) {
  if (!context || !context.cache || !context.cache.militaryStrength) return 0;
  return context.cache.militaryStrength[factionId] || 0;
}

/**
 * 从 NpcContext 获取经济水平
 * @param {Object} context - NpcContext 快照
 * @param {string} factionId - 派系 ID
 * @returns {number} 经济水平
 */
function getEconomicLevelFromContext(context, factionId) {
  if (!context || !context.cache || !context.cache.economicLevel) return 0;
  return context.cache.economicLevel[factionId] || 0;
}

// ============================================================
//  AI 权重系统（借鉴 CK3）
// ============================================================

/**
 * 计算决策权重
 * 借鉴 CK3 的权重设计模式：Base + Sum(AddModifiers) × Product(FactorModifiers)
 *
 * @param {string} decisionId - 决策 ID
 * @param {Object} context - NpcContext 快照
 * @param {Object} actor - 决策者（角色对象）
 * @param {Object} target - 目标对象（可选，如宣战目标）
 * @returns {number} 最终权重值
 */
function calculateDecisionWeight(decisionId, context, actor, target) {
  if (!P.aiWeightSystem || !P.aiWeightSystem.enabled) {
    return 50; // 默认权重
  }

  var decisionConfig = P.aiWeightSystem.decisions[decisionId];
  if (!decisionConfig) {
    console.warn('[AIWeight] 未找到决策配置:', decisionId);
    return 50;
  }

  // 1. 基础权重
  var base = decisionConfig.base !== undefined ? decisionConfig.base : 50;
  var weight = base;

  _dbg('[AIWeight] 决策:', decisionId, '基础权重:', base);

  // 2. 加法修正（Add Modifiers）
  var addSum = 0;
  if (decisionConfig.addModifiers && Array.isArray(decisionConfig.addModifiers)) {
    decisionConfig.addModifiers.forEach(function(modifier) {
      if (evaluateCondition(modifier.condition, context, actor, target)) {
        addSum += modifier.add || 0;
        _dbg('[AIWeight] 加法修正触发:', modifier.add, '条件:', modifier.condition);
      }
    });
  }

  // 3. 人格修正（Personality Modifiers）——从_dims读取8D维度
  var personalitySum = 0;
  var _actorDims = actor._dims || (typeof _aggregatePersonalityDims === 'function' ? _aggregatePersonalityDims(actor) : {});
  if (decisionConfig.personalityModifiers && _actorDims) {
    Object.keys(decisionConfig.personalityModifiers).forEach(function(trait) {
      var coefficient = decisionConfig.personalityModifiers[trait];
      var traitValue = _actorDims[trait] || 0;
      var contribution = traitValue * coefficient;
      personalitySum += contribution;
      if (Math.abs(contribution) > 0.1) {
        _dbg('[AIWeight] 人格修正:', trait, '=', traitValue, '×', coefficient, '=', contribution.toFixed(2));
      }
    });
  }

  // 4. 资源修正（Resource Modifiers）
  var resourceSum = 0;
  if (decisionConfig.resourceModifiers) {
    Object.keys(decisionConfig.resourceModifiers).forEach(function(resourceName) {
      var resourceConfig = decisionConfig.resourceModifiers[resourceName];
      var resourceValue = getVariableFromContext(context, resourceName);
      if (resourceValue >= resourceConfig.threshold) {
        resourceSum += resourceConfig.add || 0;
        _dbg('[AIWeight] 资源修正:', resourceName, '>=', resourceConfig.threshold, '→ +', resourceConfig.add);
      }
    });
  }

  // 5. 应用加法修正
  weight += addSum + personalitySum + resourceSum;
  _dbg('[AIWeight] 加法修正总和:', addSum + personalitySum + resourceSum, '→ 当前权重:', weight);

  // 6. 乘法修正（Factor Modifiers）
  var factorProduct = 1.0;
  if (decisionConfig.factorModifiers && Array.isArray(decisionConfig.factorModifiers)) {
    decisionConfig.factorModifiers.forEach(function(modifier) {
      if (evaluateCondition(modifier.condition, context, actor, target)) {
        factorProduct *= (modifier.factor !== undefined ? modifier.factor : 1.0);
        _dbg('[AIWeight] 乘法修正触发: ×', modifier.factor, '条件:', modifier.condition);

        // factor = 0 是一票否决
        if (modifier.factor === 0) {
          _dbg('[AIWeight] 一票否决！权重归零');
        }
      }
    });
  }

  // 7. 应用乘法修正
  weight *= factorProduct;
  _dbg('[AIWeight] 乘法修正:', factorProduct, '→ 最终权重:', weight);

  return weight;
}

/**
 * 评估条件
 * @param {Object} condition - 条件对象
 * @param {Object} context - NpcContext 快照
 * @param {Object} actor - 决策者
 * @param {Object} target - 目标对象（可选）
 * @returns {boolean} 条件是否满足
 */
function evaluateCondition(condition, context, actor, target) {
  if (!condition) return true;

  var type = condition.type; // 'personality', 'variable', 'relation', 'militaryStrength', 'opinion'
  var field = condition.field;
  var operator = condition.operator; // '>=', '<=', '>', '<', '==', '!='
  var value = condition.value;

  var actualValue;

  // 根据类型获取实际值
  switch (type) {
    case 'personality':
      if (!actor || !actor.personality) return false;
      actualValue = actor.personality[field] || 0;
      break;

    case 'variable':
      actualValue = getVariableFromContext(context, field);
      break;

    case 'relation':
      actualValue = getRelationFromContext(context, field);
      break;

    case 'militaryStrength':
      if (!actor || !actor.factionId) return false;
      actualValue = getMilitaryStrengthFromContext(context, actor.factionId);
      break;

    case 'opinion':
      if (!actor || !target) return false;
      actualValue = getOpinionFromContext(context, actor.id, target.id);
      break;

    case 'economicLevel':
      if (!actor || !actor.factionId) return false;
      actualValue = getEconomicLevelFromContext(context, actor.factionId);
      break;

    default:
      console.warn('[AIWeight] 未知条件类型:', type);
      return false;
  }

  // 应用操作符
  switch (operator) {
    case '>=': return actualValue >= value;
    case '<=': return actualValue <= value;
    case '>': return actualValue > value;
    case '<': return actualValue < value;
    case '==': return actualValue === value;
    case '!=': return actualValue !== value;
    default:
      console.warn('[AIWeight] 未知操作符:', operator);
      return false;
  }
}

/**
 * 为角色生成所有可能的决策及其权重
 * @param {Object} context - NpcContext 快照
 * @param {Object} actor - 决策者
 * @returns {Array} 决策列表，按权重降序排列
 */
function generateDecisionsForActor(context, actor) {
  if (!P.aiWeightSystem || !P.aiWeightSystem.enabled) {
    return [];
  }

  var decisions = [];

  // 遍历所有配置的决策类型
  Object.keys(P.aiWeightSystem.decisions).forEach(function(decisionId) {
    // 计算权重
    var weight = calculateDecisionWeight(decisionId, context, actor, null);

    // 只保留权重 > 0 的决策
    if (weight > 0) {
      decisions.push({
        id: decisionId,
        weight: weight,
        actor: actor
      });
    }
  });

  // 按权重降序排列
  decisions.sort(function(a, b) {
    return b.weight - a.weight;
  });

  return decisions;
}

/**
 * NPC 自动执行决策（基于权重）
 * @param {Object} context - NpcContext 快照
 * @param {Object} actor - NPC 角色
 * @param {number} maxActions - 最大行动次数（默认 1）
 */
function executeNpcDecisions(context, actor, maxActions) {
  if (!actor || actor.isPlayer) return;

  maxActions = maxActions || 1;

  _dbg('[NPC] 角色', actor.name, '开始决策，最大行动次数:', maxActions);

  // 生成所有可能的决策
  var decisions = generateDecisionsForActor(context, actor);

  _dbg('[NPC] 生成', decisions.length, '个可能决策');

  // 执行前 N 个高权重决策
  var executedCount = 0;
  for (var i = 0; i < decisions.length && executedCount < maxActions; i++) {
    var decision = decisions[i];
    _dbg('[NPC] 执行决策:', decision.id, '权重:', decision.weight);

    // 这里应该调用具体的决策执行函数
    // executeDecision(decision.id, actor, context);

    executedCount++;
  }

  _dbg('[NPC] 角色', actor.name, '完成决策，执行了', executedCount, '个行动');
}

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
  /**
   * 初始化角色的集权数据
   */
  function initializeCharacters() {
    if (!P.centralizationSystem || !P.centralizationSystem.enabled) return;

    GM.chars.forEach(function(char) {
      // 初始化集权等级（如果没有）
      if (char.centralization === undefined) {
        char.centralization = P.centralizationSystem.defaultCentralization || 2;
      }

      // 初始化回拨率（如果没有）
      if (char.redistributionRate === undefined) {
        char.redistributionRate = P.centralizationSystem.defaultRedistributionRate || 0.3;
      }

      // 初始化财政数据
      if (!char.finance) {
        char.finance = {
          income: 0,        // 本回合收入
          tribute: 0,       // 本回合上缴
          redistribution: 0, // 本回合回拨
          netIncome: 0      // 本回合净收入
        };
      }
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

    GM.chars.forEach(function(char) {
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
    var totalTribute = 0;

    // 递归收集所有下属的贡赋
    var children = childrenMap[char.id] || [];
    children.forEach(function(child) {
      // 先递归处理子节点
      collectTributeBottomUp(child, childrenMap);

      // 计算该下属的上缴额
      var childIncome = child.finance.income || 0;
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
    char.finance.income = (char.finance.income || 0) + totalTribute;

    return totalTribute;
  }

  /**
   * 自顶向下回拨
   * @param {Object} char - 角色
   * @param {Object} childrenMap - 子节点映射
   */
  function redistributeTopDown(char, childrenMap) {
    var children = childrenMap[char.id] || [];
    if (children.length === 0) return;

    // 计算总贡赋
    var totalTribute = 0;
    var tributeMap = {};
    children.forEach(function(child) {
      var tribute = child.finance.tribute || 0;
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
      var childTribute = tributeMap[child.id];
      var contributionRatio = childTribute / totalTribute;
      var redistribution = totalRedistribution * contributionRatio;

      // 记录回拨
      child.finance.redistribution = redistribution;

      _dbg('[Centralization] 角色', child.name, '获得回拨', redistribution.toFixed(2),
                  '(贡献占比:', (contributionRatio * 100).toFixed(1) + '%)');

      // 递归处理子节点
      redistributeTopDown(child, childrenMap);
    });

    // 上级扣除回拨后的净收入
    char.finance.income -= totalRedistribution;
  }

  /**
   * 计算所有角色的净收入
   */
  function calculateNetIncome() {
    GM.chars.forEach(function(char) {
      var income = char.finance.income || 0;
      var tribute = char.finance.tribute || 0;
      var redistribution = char.finance.redistribution || 0;

      // 净收入 = 原始收入 - 上缴 + 回拨
      char.finance.netIncome = income - tribute + redistribution;

      _dbg('[Centralization] 角色', char.name, '净收入:', char.finance.netIncome.toFixed(2),
                  '(收入:', income.toFixed(2), '上缴:', tribute.toFixed(2), '回拨:', redistribution.toFixed(2) + ')');
    });
  }

  /**
   * 执行财政结算
   */
  function runFiscalSettlement() {
    if (!P.centralizationSystem || !P.centralizationSystem.enabled) return;

    _dbg('[Centralization] ========== 财政结算开始 ==========');

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
    GM.chars.forEach(function(char) {
      if (!char.finance) {
        char.finance = {};
      }
      char.finance.income = 0;
      char.finance.tribute = 0;
      char.finance.redistribution = 0;
      char.finance.netIncome = 0;
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
    getTributeRate: getTributeRate
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

