// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-npc-decision.js — NPC 决策层 (R133 从 tm-npc-engine.js L2018-end 拆出)
// 姊妹: tm-npc-engine.js (NPC 核心引擎)
// 历史：这部分原在 tm-economy-military.js·后被移入 tm-npc-engine.js·本次归位独立
// 包含: CK3 风格权重计算+NPC Engine 双层分离架构+NPC 行为系统 (AI 驱动)
// ============================================================

// ============================================================
// 以下从 tm-economy-military.js 移入：CK3权重 + NPC决策执行
// ============================================================
// ============================================================
// CK3 风格权重计算系统
// ============================================================

// 权重计算系统用于评估候选人的综合得分
// 参考 Crusader Kings 3 的 AI 权重系统设计

// 权重因子定义
var WeightFactors = {
  // 能力因子
  ability: {
    intelligence: { base: 1.0, min: 0, max: 100 },
    valor: { base: 0.8, min: 0, max: 100 },
    benevolence: { base: 0.6, min: 0, max: 100 },
    loyalty: { base: 1.2, min: 0, max: 100 }
  },

  // 关系因子
  relationship: {
    kinship: { base: 1.5, levels: { parent: 2.0, child: 1.8, sibling: 1.5, cousin: 1.2, distant: 0.8 } },
    faction: { base: 1.3, same: 1.5, allied: 1.2, neutral: 1.0, rival: 0.5, enemy: 0.2 },
    loyalty: { base: 1.2, min: 0, max: 100 }
  },

  // 政治因子
  political: {
    legitimacy: { base: 1.8, min: 0, max: 1 },
    office: { base: 1.4, hasOffice: 1.5, noOffice: 0.8 },
    reputation: { base: 1.0, min: 0, max: 100 }
  },

  // 时代因子（根据时代状态调整）
  era: {
    centralControl: { base: 1.0, min: 0, max: 1 },
    legitimacySource: { base: 1.0, types: { hereditary: 1.5, military: 1.2, merit: 1.3, divine: 1.4, declining: 0.8 } },
    dynastyPhase: { base: 1.0, phases: { founding: 1.2, expansion: 1.1, peak: 1.0, decline: 0.9, collapse: 0.7 } }
  }
};

// 计算候选人权重得分
function calculateCandidateWeight(candidate, context) {
  if (!candidate) return 0;

  var weights = {
    ability: 0,
    relationship: 0,
    political: 0,
    era: 0
  };

  // 1. 能力权重
  weights.ability = calculateAbilityWeight(candidate, context);

  // 2. 关系权重
  weights.relationship = calculateRelationshipWeight(candidate, context);

  // 3. 政治权重
  weights.political = calculatePoliticalWeight(candidate, context);

  // 4. 时代权重（调整系数）
  var eraModifier = calculateEraModifier(candidate, context);

  // 综合得分
  var totalWeight = (weights.ability + weights.relationship + weights.political) * eraModifier;

  return {
    total: totalWeight,
    breakdown: weights,
    eraModifier: eraModifier
  };
}

// 计算能力权重
function calculateAbilityWeight(candidate, context) {
  var factors = WeightFactors.ability;
  var weight = 0;

  // 智谋
  if (candidate.intelligence !== undefined) {
    var intScore = candidate.intelligence / factors.intelligence.max;
    weight += intScore * factors.intelligence.base;
  }

  // 武勇
  if (candidate.valor !== undefined) {
    var valScore = candidate.valor / factors.valor.max;
    weight += valScore * factors.valor.base;
  }

  // 仁德
  if (candidate.benevolence !== undefined) {
    var benScore = candidate.benevolence / factors.benevolence.max;
    weight += benScore * factors.benevolence.base;
  }

  // 忠诚度
  if (candidate.loyalty !== undefined) {
    var loyScore = candidate.loyalty / factors.loyalty.max;
    weight += loyScore * factors.loyalty.base;
  }

  return weight;
}

// 计算关系权重
function calculateRelationshipWeight(candidate, context) {
  var factors = WeightFactors.relationship;
  var weight = 0;

  // 血缘关系
  if (candidate.kinship) {
    var kinshipLevel = factors.kinship.levels[candidate.kinship] || 1.0;
    weight += factors.kinship.base * kinshipLevel;
  }

  // 派系关系
  if (candidate.faction && context.playerFaction) {
    var factionRelation = 'neutral';
    if (candidate.faction === context.playerFaction) {
      factionRelation = 'same';
    } else if (context.alliedFactions && context.alliedFactions.indexOf(candidate.faction) >= 0) {
      factionRelation = 'allied';
    } else if (context.rivalFactions && context.rivalFactions.indexOf(candidate.faction) >= 0) {
      factionRelation = 'rival';
    } else if (context.enemyFactions && context.enemyFactions.indexOf(candidate.faction) >= 0) {
      factionRelation = 'enemy';
    }

    var factionMod = factors.faction[factionRelation] || factors.faction.neutral;
    weight += factors.faction.base * factionMod;
  }

  // 忠诚度（关系维度）
  if (candidate.loyalty !== undefined) {
    var loyScore = candidate.loyalty / factors.loyalty.max;
    weight += loyScore * factors.loyalty.base;
  }

  return weight;
}

// 计算政治权重
function calculatePoliticalWeight(candidate, context) {
  var factors = WeightFactors.political;
  var weight = 0;

  // 正统性
  if (candidate.legitimacy !== undefined) {
    var legScore = candidate.legitimacy / factors.legitimacy.max;
    weight += legScore * factors.legitimacy.base;
  }

  // 官职
  var hasOffice = candidate.hasOffice || findNpcOffice(candidate.name) !== null;
  var officeMod = hasOffice ? factors.office.hasOffice : factors.office.noOffice;
  weight += factors.office.base * officeMod;

  // 声望
  if (candidate.reputation !== undefined) {
    var repScore = candidate.reputation / factors.reputation.max;
    weight += repScore * factors.reputation.base;
  }

  return weight;
}

// 计算时代调整系数
function calculateEraModifier(candidate, context) {
  if (!context.eraState) return 1.0;

  var factors = WeightFactors.era;
  var modifier = 1.0;

  // 中央集权度影响
  var centralControl = context.eraState.centralControl || 0.5;
  if (centralControl < 0.3) {
    // 低集权：血缘和地方势力重要
    if (candidate.kinship) modifier *= 1.3;
    if (candidate.hasLocalSupport) modifier *= 1.2;
  } else if (centralControl > 0.7) {
    // 高集权：能力和忠诚重要
    if (candidate.intelligence > 70) modifier *= 1.2;
    if (candidate.loyalty > 80) modifier *= 1.3;
  }

  // 正统性来源影响
  var legitimacySource = context.eraState.legitimacySource || 'hereditary';
  var legMod = factors.legitimacySource.types[legitimacySource] || 1.0;

  if (legitimacySource === 'hereditary' && candidate.kinship) {
    modifier *= legMod;
  } else if (legitimacySource === 'military' && candidate.valor > 70) {
    modifier *= legMod;
  } else if (legitimacySource === 'merit' && candidate.intelligence > 70) {
    modifier *= legMod;
  }

  // 王朝阶段影响
  var dynastyPhase = context.eraState.dynastyPhase || 'peak';
  var phaseMod = factors.dynastyPhase.phases[dynastyPhase] || 1.0;
  modifier *= phaseMod;

  return modifier;
}

// 批量计算候选人权重并排序
function rankCandidatesByWeight(candidates, context) {
  if (!candidates || candidates.length === 0) return [];

  var rankedCandidates = candidates.map(function(candidate) {
    var weightResult = calculateCandidateWeight(candidate, context);
    return {
      candidate: candidate,
      weight: weightResult.total,
      breakdown: weightResult.breakdown,
      eraModifier: weightResult.eraModifier
    };
  });

  // 按权重降序排序
  rankedCandidates.sort(function(a, b) {
    return b.weight - a.weight;
  });

  return rankedCandidates;
}

// 生成权重分析报告
function generateWeightReport(rankedCandidates) {
  if (!rankedCandidates || rankedCandidates.length === 0) {
    return '无候选人';
  }

  var report = '【候选人权重分析】\n\n';

  rankedCandidates.forEach(function(item, index) {
    var candidate = item.candidate;
    var breakdown = item.breakdown;

    report += (index + 1) + '. ' + candidate.name + '（总分：' + item.weight.toFixed(2) + '）\n';
    report += '   能力：' + breakdown.ability.toFixed(2) + ' | ';
    report += '关系：' + breakdown.relationship.toFixed(2) + ' | ';
    report += '政治：' + breakdown.political.toFixed(2) + '\n';
    report += '   时代系数：' + item.eraModifier.toFixed(2) + '\n';

    if (candidate.note) {
      report += '   备注：' + candidate.note + '\n';
    }

    report += '\n';
  });

  return report;
}

// ============================================================
// NPC Engine 双层分离架构
// ============================================================

// NPC Engine 分为两层：
// 1. 决策层（Decision Layer）：AI 推演 NPC 的动机、意图、行为倾向
// 2. 执行层（Execution Layer）：根据决策结果应用规则，执行具体行为

// ===== 决策层 =====

// NPC 决策推演（AI 驱动）
async function npcDecisionLayer(npc, context) {
  if (!P.ai.key) return null;

  // 构建 NPC 决策提示词
  var prompt = buildNpcDecisionPrompt(npc, context);

  try {
    var url = P.ai.url;
    if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';

    var response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + P.ai.key
      },
      body: JSON.stringify({
        model: P.ai.model || 'gpt-4o',
        messages: [{role: 'user', content: prompt}],
        temperature: 0.8,
        max_tokens: Math.round(800 * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0))
      })
    });

    if (!response.ok) return null;

    var data = await response.json();
    var content = (data.choices&&data.choices[0]&&data.choices[0].message)?data.choices[0].message.content:'';

    // 提取 JSON
    var jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('NPC 决策推演失败:', error);
  }

  return null;
}

// 构建 NPC 决策提示词
function buildNpcDecisionPrompt(npc, context) {
  var eraContext = '';
  if (context.eraState) {
    eraContext = '时代背景：\n' +
      '政治统一度：' + context.eraState.politicalUnity + '（0=分裂，1=统一）\n' +
      '中央集权度：' + context.eraState.centralControl + '（0=地方割据，1=高度集权）\n' +
      '社会稳定度：' + context.eraState.socialStability + '（0=动荡，1=稳定）\n' +
      '正统性来源：' + context.eraState.legitimacySource + '\n' +
      '王朝阶段：' + context.eraState.dynastyPhase + '\n';
  }

  var npcOffice = findNpcOffice(npc.name);
  var officeInfo = npcOffice ? '官职：' + npcOffice.deptName + ' ' + npcOffice.posName : '无官职';

  var prompt = '你是 NPC 行为推演引擎。请推演以下 NPC 的行为意图：\n\n' +
    '【NPC 信息】\n' +
    '姓名：' + npc.name + '\n' +
    '头衔：' + (npc.title || '无') + '\n' +
    officeInfo + '\n' +
    // 封臣���份
    (function() {
      if (!npc.faction || !GM.facs) return '';
      var _npcFac = GM._indices.facByName ? GM._indices.facByName.get(npc.faction) : null;
      if (!_npcFac) return '';
      var info = '';
      if (_npcFac.liege) info += '封臣身份：臣属于' + _npcFac.liege + '，贡奉' + Math.round((_npcFac.tributeRate || 0.3) * 100) + '%\n';
      if (_npcFac.vassals && _npcFac.vassals.length > 0) info += '宗主身份：下辖封臣' + _npcFac.vassals.join('、') + '\n';
      return info;
    })() +
    // 头衔爵位
    (function() {
      if (!npc.titles || npc.titles.length === 0) return '';
      return '爵位：' + npc.titles.map(function(t) { return t.name + (t.hereditary ? '(世袭)' : '(流官)'); }).join('、') + '\n';
    })() +
    // 行政治理（该NPC是否担任地方官）
    (function() {
      if (!P.adminHierarchy || !npc.name) return '';
      var govInfo = '';
      var _ak = Object.keys(P.adminHierarchy);
      for (var i = 0; i < _ak.length; i++) {
        var ah = P.adminHierarchy[_ak[i]];
        if (!ah || !ah.divisions) continue;
        function _findGov(divs) {
          for (var j = 0; j < divs.length; j++) {
            if (divs[j].governor === npc.name) {
              govInfo += '治理：' + divs[j].name + '(' + (divs[j].level || '') + ')';
              if (divs[j].prosperity) govInfo += ' 繁荣' + divs[j].prosperity;
              if (divs[j].terrain) govInfo += ' ' + divs[j].terrain;
              if (GM.provinceStats && GM.provinceStats[divs[j].name]) {
                var ps = GM.provinceStats[divs[j].name];
                govInfo += ' 腐败' + Math.round(ps.corruption || 0) + ' 稳定' + Math.round(ps.stability || 50);
              }
              govInfo += '\n';
            }
            if (divs[j].children) _findGov(divs[j].children);
          }
        }
        _findGov(ah.divisions);
      }
      return govInfo;
    })() +
    '忠诚度：' + (npc.loyalty || 50) + '（0-100）\n' +
    // 亲疏关系（与其他关键人物）
    (function() {
    if (typeof AffinityMap !== 'undefined') {
      var npcRels = AffinityMap.getRelations(npc.name).slice(0, 3);
      if (npcRels.length > 0) {
        return '亲疏：' + npcRels.map(function(r) { return r.name + (r.value>0?'(亲'+r.value+')':'(疏'+r.value+')'); }).join('，') + '\n';
      }
    }
    return '';
    })() +
    '野心：' + (npc.ambition || 50) + '（0-100）\n' +
    '智谋：' + (npc.intelligence || 50) + '（0-100）\n' +
    '武勇：' + (npc.valor || 50) + '（0-100）\n' +
    '派系：' + (npc.faction || '无') + '\n' +
    '性格：' + (function() {
  if (npc.traitIds && npc.traitIds.length > 0 && P.traitDefinitions) {
    var names = [];
    var hints = [];
    npc.traitIds.forEach(function(tid) {
      var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
      if (def) { names.push(def.name); if (def.aiHint) hints.push(def.aiHint); }
    });
    return names.join('、') + (hints.length ? '\n行为倾向：' + hints.join('；') : '');
  }
  return npc.personality || '未知';
})() + '\n\n' +
    '【当前局势】\n' +
    eraContext +
    '回合：第 ' + context.turn + ' 回合\n' +
    '日期：' + context.date + '\n' +
    '资源状态：' + JSON.stringify(context.resources) + '\n' +
    '关系状态：' + JSON.stringify(context.relations) + '\n\n' +
    '【推演要求】\n' +
    '请根据 NPC 的属性、时代背景、当前局势，推演其行为意图。返回 JSON：\n' +
    '{\n' +
    '  "motivation": "当前主要动机（权力/财富/忠诚/生存/理想）",\n' +
    '  "intent": "行为意图描述（50-100字）",\n' +
    '  "behaviorType": "行为类型（appoint/dismiss/transfer/reward/punish/declare_war/request_loyalty/reform/none）",\n' +
    '  "target": "行为目标（人名/势力名/地区名，如果 behaviorType 是 none 则为空）",\n' +
    '  "reasoning": "推理过程（100-150字）",\n' +
    '  "shouldExecute": true/false,\n' +
    '  "priority": 0.0-1.0,\n' +
    '  "riskLevel": "low/medium/high",\n' +
    '  "expectedOutcome": "预期结果描述（50-100字）"\n' +
    '}\n\n' +
    '【推演规则】\n' +
    '1. 根据时代背景调整行为倾向：\n' +
    '   - 低集权时期（<0.3）：地方大员倾向扩张势力、任命亲信、抗拒中央\n' +
    '   - 中集权时期（0.3-0.7）：平衡中央与地方，谨慎行事\n' +
    '   - 高集权时期（>0.7）：服从中央，按规则办事\n' +
    '2. 根据忠诚度调整：\n' +
    '   - 高忠诚（>80）：支持中央，维护稳定\n' +
    '   - 中忠诚（50-80）：观望，自保为主\n' +
    '   - 低忠诚（<50）：可能叛乱、割据、篡位\n' +
    '3. 根据野心调整：\n' +
    '   - 高野心（>80）：积极扩张，寻求权力\n' +
    '   - 中野心（50-80）：稳健发展\n' +
    '   - 低野心（<50）：保守，维持现状\n' +
    '4. 根据王朝阶段调整：\n' +
    '   - 初创期：功臣争权，不稳定\n' +
    '   - 盛期：制度化，行为规范\n' +
    '   - 末期：混乱，实力为王\n' +
    '5. shouldExecute 判断：\n' +
    '   - 考虑时机是否合适\n' +
    '   - 考虑风险是否可控\n' +
    '   - 考虑资源是否充足\n' +
    '6. priority 评分：\n' +
    '   - 紧急且重要：0.8-1.0\n' +
    '   - 重要不紧急：0.5-0.8\n' +
    '   - 一般：0.3-0.5\n' +
    '   - 可选：0.0-0.3';

  return prompt;
}

// ===== 官职索引缓存（O(1) 查询替代 O(m) 递归遍历）=====
var _officeIndex = null; // Map<holderName, {deptName, posName, rank, position}>
var _officeIndexTurn = -1; // 上次构建索引的回合

function _buildOfficeIndex() {
  _officeIndex = new Map();
  if (!GM.officeTree || GM.officeTree.length === 0) return;
  function walk(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.positions) {
        for (var j = 0; j < node.positions.length; j++) {
          var pos = node.positions[j];
          if (pos.holder) {
            _officeIndex.set(pos.holder, {
              deptName: node.name,
              posName: pos.name,
              rank: pos.rank || '',
              position: pos
            });
          }
        }
      }
      if (node.subs && node.subs.length > 0) walk(node.subs);
    }
  }
  walk(GM.officeTree);
  _officeIndexTurn = GM.turn;
}

function _ensureOfficeIndex() {
  if (_officeIndexTurn !== GM.turn || !_officeIndex) _buildOfficeIndex();
}

/** @param {string} npcName @returns {{deptName:string, posName:string, rank:string, position:Object}|null} */
function findNpcOffice(npcName) {
  _ensureOfficeIndex();
  return _officeIndex.get(npcName) || null;
}

// ===== 行为注册表（借鉴晚唐风云 behavior registry）=====
// 剧本可通过 NpcBehaviorRegistry.register() 添加自定义行为
/**
 * NPC 行为注册表 - 剧本可注册自定义行为
 * @namespace
 * @property {function(string, Function):void} register - 注册行为
 * @property {function():string[]} list - 列出已注册行为
 * @property {function(Object, Object, Object):void} execute - 执行行为
 */
var NpcBehaviorRegistry = {
  _behaviors: {},

  /** 注册行为处理器 */
  register: function(behaviorType, handler) {
    NpcBehaviorRegistry._behaviors[behaviorType] = handler;
  },

  /** 获取已注册行为列表 */
  list: function() { return Object.keys(NpcBehaviorRegistry._behaviors); },

  /** 执行行为（内部调用） */
  execute: function(npc, decision, context) {
    var handler = NpcBehaviorRegistry._behaviors[decision.behaviorType];
    if (handler) {
      handler(npc, decision.target, decision, context);
    } else if (decision.behaviorType !== 'none') {
      _dbg('[NPC] 未注册的行为类型：' + decision.behaviorType);
    }
  }
};

// 注册内置行为
NpcBehaviorRegistry.register('appoint', function(npc, target, d, ctx) { executeAppointBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('dismiss', function(npc, target, d, ctx) { executeDismissBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('transfer', function(npc, target, d, ctx) { executeTransferBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('reward', function(npc, target, d, ctx) { executeRewardBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('punish', function(npc, target, d, ctx) { executePunishBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('declare_war', function(npc, target, d, ctx) { executeDeclareWarBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('request_loyalty', function(npc, target, d, ctx) { executeRequestLoyaltyBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('reform', function(npc, target, d, ctx) { executeReformBehavior(npc, target, d, ctx); });

// ===== 执行层 =====

// NPC 行为执行（通过注册表分发）
function npcExecutionLayer(npc, decision, context) {
  if (!decision || !decision.shouldExecute) return;
  _dbg('[NPC Engine] ' + npc.name + ' 执行行为：' + decision.behaviorType + ' -> ' + decision.target);
  NpcBehaviorRegistry.execute(npc, decision, context);
  addEB('NPC行为', npc.name + '：' + decision.intent);
}

// 执行任命行为
function executeAppointBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (!targetChar) return;

  // 检查 NPC 是否有任命权
  var npcOffice = findNpcOffice(npc.name);
  if (!npcOffice) return;

  // 简化：假设 NPC 可以任命下属
  addEB('任命', npc.name + ' 任命 ' + target + ' 为下属官员');

  // 更新目标角色的忠诚度（向任命者倾斜）
  if (targetChar.loyalty < 80) {
    targetChar.loyalty = Math.min(100, targetChar.loyalty + 10);
  }
  // NPC任命：被任命者对任命者亲近+8
  if (typeof AffinityMap !== 'undefined' && target) {
    var targetChar2 = findCharByName(target);
    if (targetChar2) AffinityMap.add(target, npc.name, 8, '被' + npc.name + '提拔');
  }
  // NPC记忆
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(target, '被' + npc.name + '提拔任命', '喜', 7, npc.name);
    NpcMemorySystem.remember(npc.name, '提拔了' + target, '平', 4, target);
  }
  // 被任命者积累政务经验
  if (typeof CharacterGrowthSystem !== 'undefined') CharacterGrowthSystem.addExperience(target, 'politics', 3, '\u83B7\u4EFB\u547D');
  // 家族声望微调（族人获任命→声望略升，具体族人反应由AI决定）
  if (targetChar.family && GM.families && GM.families[targetChar.family] && typeof updateFamilyRenown === 'function') {
    updateFamilyRenown(targetChar.family, 1, target + '\u83B7\u4EFB\u547D');
  }
}

// 执行罢免行为
function executeDismissBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (!targetChar) return;

  addEB('罢免', npc.name + ' 罢免 ' + target);

  // 降低目标角色的忠诚度
  if (targetChar.loyalty > 20) {
    targetChar.loyalty = Math.max(0, targetChar.loyalty - 20);
  }
  if (typeof AffinityMap !== 'undefined' && target) AffinityMap.add(target, npc.name, -12, '被' + npc.name + '罢免');
  if (typeof StressSystem !== 'undefined') StressSystem.checkStress(targetChar, '被罢免');
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(target, '\u88AB' + npc.name + '\u7F62\u514D\u5B98\u804C', '\u6012', 8, npc.name);
  // 家族声望微调（族人被罢→声望略降，具体族人反应由AI决定）
  if (targetChar.family && GM.families && GM.families[targetChar.family] && typeof updateFamilyRenown === 'function') {
    updateFamilyRenown(targetChar.family, -1, target + '\u88AB\u7F62\u514D');
  }
}

// 执行转任行为
function executeTransferBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (!targetChar) return;

  addEB('转任', npc.name + ' 将 ' + target + ' 转任他职');
}

// 执行赏赐行为
function executeRewardBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (!targetChar) return;

  addEB('赏赐', npc.name + ' 赏赐 ' + target);

  // 提升目标角色的忠诚度和士气
  if (targetChar.loyalty < 90) {
    targetChar.loyalty = Math.min(100, targetChar.loyalty + 5);
  }
  if (targetChar.morale < 90) {
    targetChar.morale = Math.min(100, targetChar.morale + 10);
  }
  if (typeof AffinityMap !== 'undefined' && target) AffinityMap.add(target, npc.name, 10, '受赏');
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(target, '受' + npc.name + '赏赐', '喜', 5, npc.name);
}

// 执行惩罚行为
function executePunishBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (!targetChar) return;

  addEB('惩罚', npc.name + ' 惩罚 ' + target);
  if (typeof StressSystem !== 'undefined') StressSystem.checkStress(targetChar, '受罚');
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(target, '被' + npc.name + '惩罚', '恨', 8, npc.name);

  // 降低目标角色的忠诚度和士气
  if (targetChar.loyalty > 10) {
    targetChar.loyalty = Math.max(0, targetChar.loyalty - 15);
  }
  if (targetChar.morale > 10) {
    targetChar.morale = Math.max(0, targetChar.morale - 20);
  }
  if (typeof AffinityMap !== 'undefined' && target) AffinityMap.add(target, npc.name, -15, '受罚');
}

// 执行宣战行为
function executeDeclareWarBehavior(npc, target, decision, context) {
  addEB('宣战', npc.name + ' 向 ' + target + ' 宣战');

  // 更新关系
  if (GM.rels[target]) {
    GM.rels[target].value = Math.max(-100, GM.rels[target].value - 30);
  }
  if (typeof AffinityMap !== 'undefined' && target) AffinityMap.add(npc.name, target, -30, '宣战');
}

// 执行要求效忠行为
function executeRequestLoyaltyBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (!targetChar) return;

  addEB('要求效忠', npc.name + ' 要求 ' + target + ' 效忠');

  // 根据目标角色的忠诚度和野心判断是否接受
  var acceptChance = ((targetChar.loyalty || 50) / 100) * (1 - (targetChar.ambition || 50) / 100);

  if (random() < acceptChance) {
    addEB('效忠', target + ' 接受效忠');
    targetChar.loyalty = Math.min(100, targetChar.loyalty + 10);
  } else {
    addEB('拒绝', target + ' 拒绝效忠');
    targetChar.loyalty = Math.max(0, targetChar.loyalty - 10);
  }
}

// 执行改革行为
function executeReformBehavior(npc, target, decision, context) {
  addEB('改革', npc.name + ' 推行改革：' + target);

  // 改革影响资源和稳定度
  var __npcMk=typeof _findVarByType==='function'?_findVarByType('morale'):null;
  if (__npcMk&&GM.vars[__npcMk]) {
    GM.vars[__npcMk].value = Math.max(GM.vars[__npcMk].min||0, GM.vars[__npcMk].value - 5);
  }

  if (GM.eraState) {
    GM.eraState.socialStability = Math.max(0, GM.eraState.socialStability - 0.05);
  }
}

// ============================================================
// NPC 行为系统 - AI 驱动
// ============================================================

/** 主NPC行为推演入口（endTurn中调用）— 批量化版本 */
/**
 * 校验 NPC 行为是否与性格特质一致
 * @param {Object} npc - 角色
 * @param {Object} decision - 决策
 * @returns {boolean} true=一致可执行，false=矛盾应阻止
 */
function _validatePersonalityConsistency(npc, decision) {
  if (!npc.traitIds || !P.traitDefinitions || !decision.behaviorType) return true;
  var bt = decision.behaviorType;

  // 构建人格维度总和
  var dims = {};
  npc.traitIds.forEach(function(tid) {
    var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
    if (!def || !def.dims) return;
    Object.keys(def.dims).forEach(function(k) { dims[k] = (dims[k] || 0) + def.dims[k]; });
  });

  // 校验规则
  // 怯懦者（boldness < -0.3）不应主动宣战
  if (bt === 'declare_war' && (dims.boldness || 0) < -0.3) {
    _dbg('[NPC Validate] ' + npc.name + ' boldness=' + (dims.boldness||0).toFixed(2) + ' 太低，阻止宣战');
    return false;
  }
  // 仁慈者（compassion > 0.3）不应主动惩罚
  if (bt === 'punish' && (dims.compassion || 0) > 0.3) {
    _dbg('[NPC Validate] ' + npc.name + ' compassion=' + (dims.compassion||0).toFixed(2) + ' 太高，阻止惩罚');
    return false;
  }
  // 忠诚者（honor > 0.3 且 loyalty > 70）不应叛变/宣战领主
  if (bt === 'declare_war' && (dims.honor || 0) > 0.3 && (npc.loyalty || 50) > 70) {
    _dbg('[NPC Validate] ' + npc.name + ' honor高且忠诚，阻止对领主宣战');
    return false;
  }
  // 懒惰者（energy < -0.2）不应主动改革
  if (bt === 'reform' && (dims.energy || 0) < -0.2) {
    _dbg('[NPC Validate] ' + npc.name + ' energy太低，阻止主动改革');
    return false;
  }
  // 贪婪者（greed > 0.3）不应主动赏赐
  if (bt === 'reward' && (dims.greed || 0) > 0.3) {
    _dbg('[NPC Validate] ' + npc.name + ' greed太高，阻止主动赏赐');
    return false;
  }

  return true; // 默认通过
}

async function executeNpcBehaviors() {
  if (!P.ai.key) return;
  if (!GM.chars || GM.chars.length === 0) return;
  if (typeof AICache === 'undefined') { _dbg('[NPC] AICache 未初始化，跳过'); return; }

  AICache.cleanup();

  var npcs = GM.chars.filter(function(c) { return c.alive !== false && !c.isPlayer; });
  if (npcs.length === 0) return;

  var context = buildNpcBehaviorContext();
  var importantNpcs = selectImportantNpcs(npcs);
  if (importantNpcs.length === 0) return;

  // 去重：跳过本回合 AI 已决定行动的 NPC
  var aiHandled = (GM._turnContext && GM._turnContext.npcActionsThisTurn) || [];
  var toDecide = importantNpcs.filter(function(npc) {
    return aiHandled.indexOf(npc.name) < 0;
  });

  if (toDecide.length === 0) {
    _dbg('[NPC] 所有重要NPC已由AI推演处理，跳过独立决策');
    return;
  }

  // 批量决策：一次 API 调用为所有 NPC 生成行为
  try {
    var batchDecisions = await batchNpcDecisions(toDecide, context);
    batchDecisions.forEach(function(d) {
      if (!d || !d.name) return;
      var npc = findCharByName(d.name);
      if (!npc) return;
      if (d.shouldExecute) {
        // 性格一致性校验：校验行为是否与特质矛盾
        if (_validatePersonalityConsistency(npc, d)) {
          NpcBehaviorRegistry.execute(npc, d, context);
        } else {
          _dbg('[NPC] ' + npc.name + ' 行为 ' + d.behaviorType + ' 与性格矛盾，降级为观望');
          d.behaviorType = 'none';
          d.shouldExecute = false;
        }
      }
    });
  } catch(e) {
    console.error('[NPC] 批量决策失败，回退逐个处理:', e);
    // 回退：逐个处理前3个最重要的NPC
    for (var i = 0; i < Math.min(3, toDecide.length); i++) {
      try {
        var dec = await npcDecisionLayer(toDecide[i], context);
        if (dec && dec.shouldExecute) {
          NpcBehaviorRegistry.execute(toDecide[i], dec, context);
        }
      } catch(e2) { _dbg('[NPC] 个别决策失败:', toDecide[i].name, e2); }
    }
  }
}

/**
 * 批量 NPC 决策（1 次 API 调用替代 N 次）
 * @param {Array} npcs - 待决策的 NPC 列表
 * @param {Object} context - NPC 上下文
 * @returns {Promise<Array>} 决策结果数组
 */
async function batchNpcDecisions(npcs, context) {
  if (!npcs || npcs.length === 0) return [];

  // 构建批量 prompt
  var turnCtx = GM._turnContext || {};
  var prompt = '你是历史模拟AI。以下是' + npcs.length + '个NPC角色，请为每人决定本回合行为。\n\n';

  // 注入当前回合上下文（玩家诏令 + AI叙事摘要）
  if (turnCtx.edicts) {
    var edictParts = [];
    if (turnCtx.edicts.political) edictParts.push('政:' + turnCtx.edicts.political);
    if (turnCtx.edicts.military) edictParts.push('军:' + turnCtx.edicts.military);
    if (turnCtx.edicts.diplomatic) edictParts.push('外:' + turnCtx.edicts.diplomatic);
    if (turnCtx.edicts.economic) edictParts.push('经:' + turnCtx.edicts.economic);
    if (edictParts.length) prompt += '【本回合诏令】' + edictParts.join('；') + '\n';
  }
  if (turnCtx.shizhengji) prompt += '【本回合时政】' + turnCtx.shizhengji + '\n';

  // 世界状态简要
  if (GM.eraState) {
    prompt += '时代:' + (GM.eraState.dynastyPhase || '') + ' 集权:' + Math.round((GM.eraState.centralControl || 0.5) * 100) + '% 稳定:' + Math.round((GM.eraState.socialStability || 0.5) * 100) + '%\n';
  }
  // 空缺要职（让NPC知道可以争抢什么职位）
  var _vacantPosts = [];
  if (GM.officeTree) {
    (function _vp(nodes) { nodes.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (!p.holder) _vacantPosts.push(n.name + p.name); }); if (n.subs) _vp(n.subs); }); })(GM.officeTree);
  }
  if (_vacantPosts.length > 0) prompt += '\u7A7A\u7F3A\u5B98\u804C:' + _vacantPosts.slice(0, 5).join('\u3001') + '\n';

  // 可用新进士（科举产出的人才）
  if (GM.chars) {
    var _jinshi = GM.chars.filter(function(c) { return c.alive !== false && c.source === '\u79D1\u4E3E' && c.recruitTurn >= GM.turn - 5; });
    if (_jinshi.length > 0) {
      prompt += '\u65B0\u79D1\u8FDB\u58EB\u53EF\u7528:' + _jinshi.slice(0, 3).map(function(j) { return j.name + '(\u667A' + (j.intelligence||0) + ')'; }).join('\u3001') + '\n';
    }
  }

  // 岗位继任方式（让NPC尊重规则）
  if (P.postSystem && P.postSystem.postRules && P.postSystem.postRules.length > 0) {
    var _sucRules = P.postSystem.postRules.filter(function(r) { return r.succession === 'hereditary' || r.hasAppointmentRight; });
    if (_sucRules.length > 0) {
      prompt += '\u5C97\u4F4D\u89C4\u5219:' + _sucRules.slice(0, 3).map(function(r) { return (r.positionName||'') + '=' + (r.succession==='hereditary'?'\u4E16\u88AD':'\u6D41\u5B98') + (r.hasAppointmentRight?'+\u8F9F\u7F72\u6743':''); }).join(';') + '\n';
    }
  }

  // 帝王荒淫程度（影响NPC行为判断）
  var _tyHistLen = GM._tyrantHistory ? GM._tyrantHistory.length : 0;
  if (_tyHistLen > 2) {
    if (_tyHistLen > 10) {
      prompt += '\u5E1D\u738B\u957F\u671F\u653E\u7EB5\u4EAB\u4E50\uFF0C\u660F\u5EB8\u4E4B\u540D\u5DF2\u5E7F\u4F20\u3002\n';
      prompt += 'NPC\u53CD\u5E94\u6307\u5357\uFF1A\u5FE0\u8BDA>70\u7684\u521A\u76F4\u4E4B\u81E3\u5E94\u6B7B\u8C0F/\u8F9E\u5B98\uFF1B\u5FE0\u8BDA40-70\u7684\u5EB8\u81E3\u89C2\u671B\u4E0D\u8BED\uFF1B';
      prompt += '\u5FE0\u8BDA<40\u7684\u91CE\u5FC3\u5BB6\u5E94\u6697\u4E2D\u4E32\u8054/\u56FE\u8C0B\uFF1B\u4F5E\u81E3\u5E94\u732E\u5A9A/\u8FDB\u8D21\u73CD\u5B9D\n';
    } else if (_tyHistLen > 6) {
      prompt += '\u5E1D\u738B\u6709\u653E\u7EB5\u4E4B\u540D\uFF0C\u5FE0\u81E3\u5B9C\u59D4\u5A49\u8FDB\u8C0F\uFF0C\u4F5E\u81E3\u5F53\u8D81\u673A\u732E\u5A9A\n';
    } else {
      prompt += '\u5E1D\u738B\u5076\u6709\u653E\u7EB5\uFF0C\u5C1A\u53EF\u5BB9\u5FCD\n';
    }
    prompt += '\n';
    // 最近一次昏君活动（让NPC知道发生了什么）
    if (GM._tyrantHistory && GM._tyrantHistory.length > 0) {
      var _lastTy = GM._tyrantHistory[GM._tyrantHistory.length - 1];
      if (_lastTy.turn >= GM.turn - 1) {
        var _lastActs = _lastTy.acts.map(function(id) {
          var a = typeof TYRANT_ACTIVITIES !== 'undefined' ? TYRANT_ACTIVITIES.find(function(x) { return x.id === id; }) : null;
          return a ? a.name : id;
        });
        prompt += '上回合帝王:' + _lastActs.join('、') + '\n';
      }
    }
  }

  // 每个 NPC 简要信息
  prompt += '\n角色列表：\n';
  npcs.forEach(function(npc, idx) {
    var traitText = '';
    if (npc.traitIds && npc.traitIds.length > 0 && P.traitDefinitions) {
      var hints = [];
      npc.traitIds.forEach(function(tid) {
        var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
        if (def) { traitText += def.name + ' '; if (def.aiHint) hints.push(def.aiHint); }
      });
      if (hints.length) traitText += '(' + hints.join(';').substring(0, 60) + ')';
    } else {
      traitText = npc.personality || '';
    }
    var goal = npc.personalGoal ? '目标:' + npc.personalGoal.substring(0, 30) : '';
    var office = findNpcOffice(npc.name);
    var officeText = office ? office.deptName + office.posName : '无官职';
    var affRels = (typeof AffinityMap !== 'undefined') ? AffinityMap.getRelations(npc.name).slice(0, 2) : [];
    var affText = affRels.length ? '亲疏:' + affRels.map(function(r) { return r.name + (r.value > 0 ? '+' : '') + r.value; }).join(',') : '';

    // 角色近期经历（自我记忆）
    var arcText = '';
    if (GM.characterArcs && GM.characterArcs[npc.name]) {
      var recentArcs = GM.characterArcs[npc.name].slice(-3);
      if (recentArcs.length > 0) {
        arcText = '经历:' + recentArcs.map(function(a) { return 'T' + a.turn + a.desc; }).join(';');
      }
    }

    var stressNote = (npc.stress && npc.stress > 40) ? ' 压力' + npc.stress : '';
    var ambNote = (npc.ambition || 50) > 70 ? ' 野心勃勃' : '';
    // NPC个人记忆（内心世界）
    var memText = '';
    if (typeof NpcMemorySystem !== 'undefined') {
      var _mc = NpcMemorySystem.getMemoryContext(npc.name);
      if (_mc) memText = ' 内心:' + _mc.slice(0, 80);
    }
    // 人生阅历
    var expText = '';
    if (npc._lifeExp && npc._lifeExp.length > 0) {
      expText = ' 阅历:' + npc._lifeExp.slice(-2).map(function(e) { return e.desc; }).join(';').slice(0, 50);
    }
    // 后宫/家庭身份标注
    var spouseText = '';
    if (npc.spouse) {
      spouseText = ' [\u540E\u5BAB:' + (typeof getHaremRankName === 'function' ? getHaremRankName(npc.spouseRank) : (npc.spouseRank || '\u59BB\u5BA4'));
      if (npc.motherClan) spouseText += ',\u6BCD\u65CF' + npc.motherClan;
      if (npc.children && npc.children.length > 0) spouseText += ',\u5B50' + npc.children.join('/');
      spouseText += ']';
    }
    if (npc.parentOf) spouseText += ' [\u7687\u5B50/\u7687\u5973,\u7236:' + npc.parentOf + ']';
    var familyText = '';
    if (npc.family) {
      var _famObj = GM.families ? GM.families[npc.family] : null;
      familyText = ' \u65CF:' + npc.family;
      if (_famObj) familyText += '(\u58F0\u671B' + Math.round(_famObj.renown || 0) + ')';
      // 添加血亲信息
      if (typeof getBloodRelatives === 'function') {
        var _brels = getBloodRelatives(npc.name).slice(0, 3);
        if (_brels.length > 0) familyText += ' \u8840\u4EB2:' + _brels.map(function(r) { return r.name + '(' + r.relation + ')'; }).join(',');
      }
    }
    var charismaText = (npc.charisma || 0) > 75 ? ' \u9B45\u529B\u51FA\u4F17' : '';
    // B3: 注入党派上下文
    var partyText = '';
    if (npc.party && npc.party !== '\u65E0\u515A\u6D3E' && npc.party !== '') {
      var _npcParty = GM.parties ? GM.parties.find(function(pp) { return pp.name === npc.party; }) : null;
      partyText = ' \u515A:' + npc.party;
      if (_npcParty) {
        if (_npcParty.currentAgenda) partyText += '(\u8BAE\u7A0B:' + _npcParty.currentAgenda.slice(0, 15) + ')';
        if (_npcParty.status === '\u88AB\u538B\u5236') partyText += '[\u88AB\u538B\u5236]';
      }
    }
    // 科举出身+座主+同年+天子门生
    var kejuText = '';
    if (npc.source === '\u79D1\u4E3E') {
      kejuText = ' [\u79D1\u4E3E]';
      if (npc._mentorParty) kejuText += '[\u5EA7\u5E08\u503E\u5411' + npc._mentorParty + ']';
      // 查找座主
      if (P.keju && P.keju.history) {
        P.keju.history.forEach(function(h) {
          if (h.topThree && h.topThree.indexOf(npc.name) >= 0) {
            if (h.chiefExaminer) kejuText += '[\u5EA7\u5E08:' + h.chiefExaminer + ']';
            kejuText += '[\u5929\u5B50\u95E8\u751F]';
          }
        });
      }
      // 同年
      var _sameYear = (GM.chars||[]).filter(function(c){return c.alive!==false && c.source==='\u79D1\u4E3E' && c.recruitTurn===npc.recruitTurn && c.name!==npc.name;});
      if (_sameYear.length > 0) kejuText += '[\u540C\u5E74:' + _sameYear.slice(0,2).map(function(c){return c.name;}).join(',') + ']';
    }
    prompt += (idx + 1) + '. ' + npc.name + '(' + officeText + ')' + spouseText + familyText + partyText + kejuText + ' \u5FE0' + (npc.loyalty || 50) + charismaText + ambNote + stressNote + ' ' + traitText + ' ' + goal + ' ' + affText + (arcText ? ' ' + arcText : '') + memText + expText + '\n';
  });

  prompt += '\n为每人返回JSON数组：[{"name":"角色名","behaviorType":"appoint|dismiss|reward|punish|declare_war|request_loyalty|reform|none","target":"对象","intent":"意图描述20字","shouldExecute":true,"publicReason":"对外说辞/冠冕堂皇的理由15字","privateMotiv":"真实内心动机15字","innerThought":"内心独白15字"}]\n';
  prompt += '\u6CE8\u610F\uFF1A\n';
  prompt += '\u2022 \u6BCF\u4E2A\u89D2\u8272\u662F\u72EC\u7ACB\u7684\u4EBA\uFF0C\u6709\u81EA\u5DF1\u7684\u559C\u6012\u54C0\u4E50\u3001\u6069\u6028\u60C5\u4EC7\uFF0C\u4E0D\u56F4\u7ED5\u73A9\u5BB6\u3002\n';
  prompt += '\u2022 \u7EFC\u5408\u5224\u65AD\uFF1A\u7279\u8D28\u3001\u5FE0\u8BDA\u3001\u4EB2\u758F\u3001\u76EE\u6807\u3001\u8FD1\u671F\u7ECF\u5386\u3001\u5BB6\u65CF\u5229\u76CA\u3001\u540E\u5BAB\u5173\u7CFB\u3002\n';
  prompt += '\u2022 \u591A\u6570\u89D2\u8272\u5E94\u4E3Anone\uFF08\u89C2\u671B\uFF09\uFF0C\u4EC5\u6709\u5F3A\u52A8\u673A\u8005\u624D\u884C\u52A8\u3002\n';
  prompt += '\u2022 \u515A\u6D3E\u56E0\u7D20\uFF1A\u540C\u515A\u6D3E\u6210\u5458\u503E\u5411\u4E92\u76F8\u652F\u6301\uFF1B\u5BF9\u7ACB\u515A\u6D3E\u6210\u5458\u53EF\u80FD\u4E92\u76F8\u653B\u51FB\uFF1B\u88AB\u538B\u5236\u515A\u6D3E\u6210\u5458\u53EF\u80FD\u6697\u4E2D\u4E32\u8054\u6216\u8F9E\u5B98\u3002\n';
  prompt += '\u2022 \u79D1\u4E3E\u5173\u7CFB\uFF1A\u5EA7\u5E08\u95E8\u751F\u503E\u5411\u4E92\u52A9\u4F46\u975E\u7EDD\u5BF9\u2014\u2014\u5FE0\u6B63\u4E4B\u58EB\u4E0D\u5C51\u653E\u9644\uFF0C\u91CE\u5FC3\u5BB6\u53EF\u80FD\u80CC\u53DB\u5EA7\u5E08\u3002\u540C\u5E74\u8FDB\u58EB\u6709\u4EB2\u8FD1\u611F\u4F46\u4E5F\u53EF\u80FD\u7ADE\u4E89\u3002\u5929\u5B50\u95E8\u751F(\u72B6\u5143\u699C\u773C\u63A2\u82B1)\u5BF9\u541B\u4E3B\u6709\u989D\u5916\u611F\u6069\u3002\n';
  prompt += '\u2022 \u5BB6\u65CF\u56E0\u7D20\uFF1A\u540C\u65CF\u4E0D\u7B49\u4E8E\u540C\u5FC3\u3002\u65CF\u4EBA\u5F97\u52BF\u65F6\uFF0C\u6709\u4EBA\u611F\u6069\u3001\u6709\u4EBA\u5AC9\u5992\u3001\u6709\u4EBA\u5229\u7528\u3002\u5F97\u7F6A\u65CF\u4EBA\u65F6\uFF0C\u6709\u4EBA\u62A5\u590D\u3001\u6709\u4EBA\u5212\u6E05\u754C\u9650\u3001\u6709\u4EBA\u6F20\u4E0D\u5173\u5FC3\u3002\n';
  prompt += '\u2022 \u516C\u79C1\u4E4B\u5206\uFF08\u6838\u5FC3\uFF09\uFF1A\n';
  prompt += '  - publicReason\uFF1A\u5BF9\u5916\u5BA3\u79F0\u7684\u7406\u7531\uFF0C\u53EF\u80FD\u662F\u771F\u5FC3\u4E5F\u53EF\u80FD\u662F\u501F\u53E3\n';
  prompt += '  - privateMotiv\uFF1A\u5185\u5FC3\u771F\u6B63\u7684\u9A71\u52A8\uFF08\u6392\u9664\u5F02\u5DF1\u3001\u6276\u690D\u4EB2\u4FE1\u3001\u62A5\u79C1\u4EC7\u3001\u4E3A\u5BB6\u65CF\u4E89\u5229\uFF09\n';
  prompt += '  - innerThought\uFF1A\u5185\u5FC3\u72EC\u767D\uFF0C\u4F53\u73B0\u6027\u683C\uFF08\u91CE\u5FC3\u8005\u7B97\u8BA1\u3001\u5FE0\u81E3\u5FE7\u56FD\u3001\u6028\u6068\u8005\u6697\u6068\u3001\u5BD2\u95E8\u8005\u4E0D\u5FFF\uFF09\n';
  prompt += '  - \u4E8C\u8005\u53EF\u4EE5\u4E00\u81F4\uFF08\u516C\u5FE0\u4F53\u56FD\uFF09\u4E5F\u53EF\u4EE5\u77DB\u76FE\uFF08\u8868\u9762\u5FE0\u8BDA\u5B9E\u5219\u56FE\u8C0B\uFF09\n';

  var result = await callAI(prompt, 2500);
  var parsed = extractJSON(result);

  if (Array.isArray(parsed)) return parsed;
  // 如果返回的是对象包含数组
  if (parsed && parsed.decisions && Array.isArray(parsed.decisions)) return parsed.decisions;
  if (parsed && parsed.npc_actions && Array.isArray(parsed.npc_actions)) return parsed.npc_actions;
  return [];
}

// 构建 NPC 行为推演的上下文
function buildNpcBehaviorContext() {
  var context = {
    turn: GM.turn,
    date: getTSText(GM.turn),
    eraState: GM.eraState,
    resources: {},
    relations: {},
    officeTree: GM.officeTree,
    factions: GM.facs
  };

  // 资源状态
  Object.keys(GM.vars).forEach(function(key) {
    context.resources[key] = GM.vars[key].value;
  });

  // 关系状态
  Object.keys(GM.rels).forEach(function(key) {
    context.relations[key] = GM.rels[key].value;
  });

  // 后宫/家庭状态
  if (GM.chars) {
    var spouses = GM.chars.filter(function(c) { return c.alive !== false && c.spouse; });
    if (spouses.length > 0) {
      context.harem = spouses.map(function(sp) {
        return { name: sp.name, rank: sp.spouseRank, motherClan: sp.motherClan, children: sp.children || [], loyalty: sp.loyalty || 50 };
      });
    }
    if (GM.harem) {
      context.heirs = GM.harem.heirs || [];
      context.pregnancies = GM.harem.pregnancies || [];
    }
  }

  return context;
}

/** @param {Array} npcs @returns {Array} 按重要度排序的前10个NPC */
function selectImportantNpcs(npcs) {
  var important = [];

  npcs.forEach(function(npc) {
    var score = 0;

    // 有官职的角色
    if (hasOffice(npc.name)) {
      score += 10;
    }

    // 高野心
    if (npc.ambition && npc.ambition > 70) {
      score += 5;
    }

    // 低忠诚（可能叛乱）
    if (npc.loyalty !== undefined && npc.loyalty < 30) {
      score += 8;
    }

    // 中等忠诚（可能动摇）
    if (npc.loyalty !== undefined && npc.loyalty >= 30 && npc.loyalty < 60) {
      score += 3;
    }

    // 高能力
    if ((typeof getEffectiveAttr === 'function' ? getEffectiveAttr(npc, 'intelligence') : (npc.intelligence || 0)) > 80) {
      score += 3;
    }

    // 高魅力（影响力大、人脉广）
    var _npcCha = typeof getEffectiveAttr === 'function' ? getEffectiveAttr(npc, 'charisma') : (npc.charisma || 0);
    if (_npcCha > 80) score += 4;
    else if (_npcCha > 65) score += 2;

    // 有军队的角色
    if (npc.troops && npc.troops > 0) {
      score += 5;
    }

    // 后宫妻室（政治影响力极大）
    if (npc.spouse) {
      score += 7; // 妻室总是重要角色
      if (npc.spouseRank === 'empress' || npc.spouseRank === 'queen') score += 5;
      if (npc.children && npc.children.length > 0) score += 3; // 有子嗣更重要
    }
    // 皇子/皇女（继承人）
    if (npc.parentOf) score += 4;

    // 频率分级调度：低品级 NPC 间隔执行
    var officeInfo = findNpcOffice(npc.name);
    var rankLevel = 0;
    if (officeInfo && officeInfo.rank) {
      var rankMatch = officeInfo.rank.match(/[一二三四五六七八九]/);
      if (rankMatch) {
        var rankMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
        rankLevel = rankMap[rankMatch[0]] || 9;
      }
    }
    // 所有NPC每回合都有机会参与评估——AI推演的核心是每个角色都是独立主体
    // 品级仅影响最终入选优先级（通过score体现），不再硬性跳过
    // 高品级加分以体现政治影响力
    if (rankLevel >= 1 && rankLevel <= 3) score += 2;
    else if (rankLevel >= 4 && rankLevel <= 6) score += 1;

    if (score > 0) {
      important.push({npc: npc, score: score});
    }
  });

  // 按分数排序，取前 10 个（增加到 10 个）
  important.sort(function(a, b) { return b.score - a.score; });
  return important.slice(0, 10).map(function(item) { return item.npc; });
}

/** @param {string} charName @returns {boolean} */
function hasOffice(charName) {
  _ensureOfficeIndex();
  return _officeIndex.has(charName);
}

/** @deprecated 使用 batchNpcDecisions 替代。仅作为批量失败时的回退。 */
// 为单个 NPC 推演行为
async function executeNpcBehavior(npc, context) {
  if (typeof AICache === 'undefined') return null;
  try {
    // 检查缓存
    var cached = AICache.get(npc, context);
    if (cached) {
      AICache.stats.cacheHits++;
      return cached;
    }

    AICache.stats.cacheMisses++;
    var startTime = Date.now();

    // 构建 prompt
    var prompt = '角色：' + npc.name + '\n';
    if (npc.title) prompt += '职位：' + npc.title + '\n';
    // 封臣/头衔上下文
    if (npc.faction && GM.facs) {
      var _nf = GM._indices.facByName ? GM._indices.facByName.get(npc.faction) : null;
      if (_nf && _nf.liege) prompt += '封臣身份：臣属' + _nf.liege + '，贡奉' + Math.round((_nf.tributeRate||0.3)*100) + '%\n';
      if (_nf && _nf.vassals && _nf.vassals.length > 0) prompt += '宗主身份：辖' + _nf.vassals.join('、') + '\n';
    }
    if (npc.titles && npc.titles.length > 0) prompt += '爵位：' + npc.titles.map(function(t){return t.name+(t.hereditary?'(世袭)':'');}).join('、') + '\n';
    if (npc.personality) prompt += '性格：' + npc.personality + '\n';
    if (npc.loyalty !== undefined) prompt += '忠诚度：' + npc.loyalty + '\n';
    if (npc.ambition !== undefined) prompt += '野心：' + npc.ambition + '\n';
    if (npc.intelligence !== undefined) prompt += '智力：' + npc.intelligence + '\n';

    prompt += '\n当前局势：\n';
    prompt += '回合：' + context.turn + '，' + context.date + '\n';

    if (context.eraState) {
      prompt += '时代状态：\n';
      prompt += '  中央集权度：' + context.eraState.centralControl + '\n';
      prompt += '  社会稳定度：' + context.eraState.socialStability + '\n';
      prompt += '  王朝阶段：' + context.eraState.dynastyPhase + '\n';
    }

    prompt += '\n资源状态：' + JSON.stringify(context.resources) + '\n';
    prompt += '关系状态：' + JSON.stringify(context.relations) + '\n';

    prompt += '\n请推演该角色在本回合可能采取的行动。返回 JSON：\n';
    prompt += '{\n';
    prompt += '  "action": "行动类型",\n';
    prompt += '  "target": "行动目标（人物或地区名）",\n';
    prompt += '  "reason": "行动原因（50-100字）",\n';
    prompt += '  "consequence": "可能后果（50-100字）",\n';
    prompt += '  "shouldExecute": true/false,\n';
    prompt += '  "priority": "high/medium/low"\n';
    prompt += '}\n\n';
    prompt += '行动类型包括：\n';
    prompt += '1. 政治类：请求任命、提出建议、弹劾他人、结盟、背叛\n';
    prompt += '2. 军事类：密谋叛乱、请求出兵、扩张势力、招募军队\n';
    prompt += '3. 经济类：请求资源、贪污受贿、发展经济、减免赋税\n';
    prompt += '4. 外交类：联姻、结盟、威胁、谈判\n';
    prompt += '5. 人事类：推荐人才、辞职、隐退、培养继承人\n';
    prompt += '6. 社会类：赈济灾民、兴修水利、镇压叛乱、安抚民心\n\n';
    prompt += '决策原则：\n';
    prompt += '1. 根据角色性格、忠诚度、野心推断行动\n';
    prompt += '2. 考虑时代背景（如低集权时期更容易叛乱，王朝末期更多人辞职）\n';
    prompt += '3. 考虑资源状态（财政紧张时更多人请求资源或贪污）\n';
    prompt += '4. 考虑关系状态（与其他角色的关系影响行动选择）\n';
    prompt += '5. shouldExecute=true 表示立即执行，false 表示仅记录意图\n';
    prompt += '6. priority 表示行动优先级，影响执行顺序\n';
    prompt += '7. 不是每个角色每回合都要行动，可以返回 null 表示无特殊行动';

    var url = P.ai.url;
    if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';

    var response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + P.ai.key
      },
      body: JSON.stringify({
        model: P.ai.model || 'gpt-4o',
        messages: [{role: 'user', content: prompt}],
        temperature: 0.7,
        max_tokens: Math.round(500 * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0))
      })
    });

    if (!response.ok) {
      console.error('NPC 行为推演失败:', npc.name);
      AICache.stats.errors++;
      return null;
    }

    var data = await response.json();
    var content = (data.choices&&data.choices[0]&&data.choices[0].message)?data.choices[0].message.content:'';

    // 提取 JSON
    var jsonMatch = content.match(/\{[\s\S]*\}/);
    var behavior = null;

    if (jsonMatch) {
      behavior = JSON.parse(jsonMatch[0]);

      if (behavior && behavior.action) {
        // 记录 NPC 行为到事件簿
        addEB('NPC行为', npc.name + '：' + behavior.action + '。' + behavior.reason);

        // 缓存结果
        AICache.set(npc, context, behavior);
      }
    }

    // 记录性能
    var duration = Date.now() - startTime;
    AICache.stats.totalCalls++;
    AICache.stats.totalTime += duration;
    AICache.stats.avgTime = AICache.stats.totalTime / AICache.stats.totalCalls;

    return behavior;

  } catch (error) {
    console.error('NPC 行为推演错误:', npc.name, error);
    AICache.stats.errors++;
    return null;
  }
}

// 执行 NPC 行动
function executeNpcAction(npc, behavior, context) {
  var action = behavior.action;
  var target = behavior.target;

  // 1. 政治类行动
  if (action.indexOf('叛乱') >= 0 || action.indexOf('起兵') >= 0) {
    // 叛乱：降低忠诚度，增加野心
    if (npc.loyalty !== undefined) {
      var oldLoyalty = npc.loyalty;
      npc.loyalty = Math.max(0, npc.loyalty - 30);
      recordChange('characters', npc.name, 'loyalty', oldLoyalty, npc.loyalty, '密谋叛乱');
      addToIndex('char', npc.name, npc);
    }

    // 降低社会稳定度
    if (GM.eraState && GM.eraState.socialStability !== undefined) {
      GM.eraState.socialStability = Math.max(0, GM.eraState.socialStability - 0.05);
    }

    addEB('叛乱', npc.name + '起兵叛乱！' + behavior.consequence);
  }
  else if (action.indexOf('结盟') >= 0 || action.indexOf('联盟') >= 0) {
    // 结盟：提升与目标的关系
    if (target && GM.rels[npc.name + '-' + target]) {
      var oldRel = GM.rels[npc.name + '-' + target].value;
      GM.rels[npc.name + '-' + target].value = Math.min(100, oldRel + 20);
      recordChange('relations', npc.name + '-' + target, 'value', oldRel, GM.rels[npc.name + '-' + target].value, '结盟');
    }
    addEB('外交', npc.name + '与' + (target || '他人') + '结盟。' + behavior.consequence);
  }
  else if (action.indexOf('背叛') >= 0 || action.indexOf('反叛') >= 0) {
    // 背叛：降低忠诚度和关系
    if (npc.loyalty !== undefined) {
      var oldLoyalty = npc.loyalty;
      npc.loyalty = Math.max(0, npc.loyalty - 40);
      recordChange('characters', npc.name, 'loyalty', oldLoyalty, npc.loyalty, '背叛');
      addToIndex('char', npc.name, npc);
    }
    if (target && GM.rels[npc.name + '-' + target]) {
      GM.rels[npc.name + '-' + target].value = Math.max(0, GM.rels[npc.name + '-' + target].value - 30);
    }
    addEB('背叛', npc.name + '背叛' + (target || '朝廷') + '！' + behavior.consequence);
  }
  else if (action.indexOf('弹劾') >= 0) {
    // 弹劾：降低目标的声望
    if (target) {
      var targetChar = findCharByName(target);
      if (targetChar && targetChar.loyalty !== undefined) {
        var oldLoyalty = targetChar.loyalty;
        targetChar.loyalty = Math.max(0, targetChar.loyalty - 10);
        recordChange('characters', target, 'loyalty', oldLoyalty, targetChar.loyalty, '被弹劾');
        addToIndex('char', target, targetChar);
      }
    }
    addEB('政治', npc.name + '弹劾' + (target || '他人') + '。' + behavior.consequence);
  }

  // 2. 军事类行动
  else if (action.indexOf('招募') >= 0 || action.indexOf('征兵') >= 0) {
    // 招募军队：增加军队数量
    var _milKey2 = typeof _findVarByType === 'function' ? _findVarByType('military') : null;
    if (_milKey2 && GM.vars[_milKey2]) {
      var oldValue = GM.vars[_milKey2].value;
      var recruited = Math.floor(random() * 1000) + 500;
      GM.vars[_milKey2].value = Math.min(GM.vars[_milKey2].max, oldValue + recruited);
      recordChange('military', npc.name, _milKey2, oldValue, GM.vars[_milKey2].value, '\u62DB\u52DF\u519B\u961F');
    }
    addEB('军事', npc.name + '招募军队。' + behavior.consequence);
  }
  else if (action.indexOf('扩张') >= 0 || action.indexOf('出兵') >= 0) {
    // 扩张势力：降低社会稳定度
    if (GM.eraState && GM.eraState.socialStability !== undefined) {
      GM.eraState.socialStability = Math.max(0, GM.eraState.socialStability - 0.03);
    }
    addEB('军事', npc.name + '扩张势力。' + behavior.consequence);
  }

  // 3. 经济类行动
  else if (action.indexOf('请求资源') >= 0 || action.indexOf('请求') >= 0) {
    // 请求资源：记录到奏疏系统
    if (GM.memorials) {
      GM.memorials.push({
        id: uid(),
        from: npc.name,
        title: npc.title || '',
        type: '财政',
        content: behavior.reason,
        status: 'pending',
        turn: GM.turn,
        reply: ''
      });
    }
    addEB('财政', npc.name + '请求资源。' + behavior.reason);
  }
  else if (action.indexOf('贪污') >= 0 || action.indexOf('受贿') >= 0) {
    // 贪污：降低财政，降低忠诚度
    var _ecoKey2 = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
    if (_ecoKey2 && GM.vars[_ecoKey2]) {
      var oldValue = GM.vars[_ecoKey2].value;
      var embezzled = Math.floor(random() * 500) + 200;
      GM.vars[_ecoKey2].value = Math.max(GM.vars[_ecoKey2].min || 0, oldValue - embezzled);
      recordChange('economy', npc.name, _ecoKey2, oldValue, GM.vars[_ecoKey2].value, '\u8D2A\u6C61\u53D7\u8D3F');
    }
    if (npc.loyalty !== undefined) {
      npc.loyalty = Math.max(0, npc.loyalty - 5);
      addToIndex('char', npc.name, npc);
    }
    addEB('腐败', npc.name + '贪污受贿。' + behavior.consequence);
  }
  else if (action.indexOf('发展经济') >= 0 || action.indexOf('减免赋税') >= 0) {
    // 发展经济：提升经济繁荣度
    if (GM.eraState && GM.eraState.economicProsperity !== undefined) {
      GM.eraState.economicProsperity = Math.min(1, GM.eraState.economicProsperity + 0.02);
    }
    addEB('经济', npc.name + '发展经济。' + behavior.consequence);
  }

  // 4. 人事类行动
  else if (action.indexOf('辞职') >= 0 || action.indexOf('隐退') >= 0) {
    // 辞职：清空官职
    if (GM.officeTree && GM.officeTree.length > 0) {
      function clearOffice(nodes) {
        nodes.forEach(function(node) {
          if (node.positions) {
            node.positions.forEach(function(pos) {
              if (pos.holder === npc.name) {
                pos.holder = '';
              }
            });
          }
          if (node.subs && node.subs.length > 0) {
            clearOffice(node.subs);
          }
        });
      }
      clearOffice(GM.officeTree);
    }
    addEB('人事', npc.name + '辞职。' + behavior.consequence);
  }
  else if (action.indexOf('推荐') >= 0 || action.indexOf('举荐') >= 0) {
    // 推荐人才：记录到奏疏系统
    if (GM.memorials) {
      GM.memorials.push({
        id: uid(),
        from: npc.name,
        title: npc.title || '',
        type: '人事',
        content: behavior.reason,
        status: 'pending',
        turn: GM.turn,
        reply: ''
      });
    }
    addEB('人事', npc.name + '推荐' + (target || '人才') + '。' + behavior.reason);
  }

  // 5. 社会类行动
  else if (action.indexOf('赈济') >= 0 || action.indexOf('安抚') >= 0) {
    // 赈济灾民：提升社会稳定度
    if (GM.eraState && GM.eraState.socialStability !== undefined) {
      GM.eraState.socialStability = Math.min(1, GM.eraState.socialStability + 0.03);
    }
    var _morK3=typeof _findVarByType==='function'?_findVarByType('morale'):null;
    if (_morK3&&GM.vars[_morK3]) {
      var oldValue = GM.vars[_morK3].value;
      GM.vars[_morK3].value = Math.min(GM.vars[_morK3].max||100, oldValue + 5);
      recordChange('society', npc.name, _morK3, oldValue, GM.vars[_morK3].value, '\u8D48\u6D4E\u707E\u6C11');
    }
    addEB('\u793E\u4F1A', npc.name + '\u8D48\u6D4E\u707E\u6C11\u3002' + behavior.consequence);
  }
  else if (action.indexOf('\u9547\u538B') >= 0) {
    if (GM.eraState && GM.eraState.socialStability !== undefined) {
      GM.eraState.socialStability = Math.min(1, GM.eraState.socialStability + 0.05);
    }
    var _morK4=typeof _findVarByType==='function'?_findVarByType('morale'):null;
    if (_morK4&&GM.vars[_morK4]) {
      GM.vars[_morK4].value = Math.max(GM.vars[_morK4].min || 0, GM.vars[_morK4].value - 10);
    }
    addEB('军事', npc.name + '镇压叛乱。' + behavior.consequence);
  }

  // 6. 建议类行动（通用）
  else if (action.indexOf('建议') >= 0) {
    // 建议：记录到奏疏系统
    if (GM.memorials) {
      GM.memorials.push({
        id: uid(),
        from: npc.name,
        title: npc.title || '',
        type: '政务',
        content: behavior.reason,
        status: 'pending',
        turn: GM.turn,
        reply: ''
      });
    }
    addEB('政务', npc.name + '提出建议。' + behavior.reason);
  }

  // 7. 其他行动：仅记录
  else {
    addEB('NPC动态', npc.name + '：' + behavior.action + '。' + behavior.consequence);
  }
}
