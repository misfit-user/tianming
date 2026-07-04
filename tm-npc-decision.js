// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   NPC 决策系统（角色自主行为推演）
//   入口/各决策子系统按函数名 grep 定位（本文件为 NPC 行为决策聚合）
// ─────────────────────────────────────────────
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

// 生成权重分析报告

// ============================================================
// NPC Engine 双层分离架构
// ============================================================

// NPC Engine 分为两层：
// 1. 决策层（Decision Layer）：AI 推演 NPC 的动机、意图、行为倾向
// 2. 执行层（Execution Layer）：根据决策结果应用规则，执行具体行为

// ===== 决策层 =====

// NPC 决策推演（AI 驱动）
function _resolveNpcDecisionPromptChar(npc) {
  if (!npc) return {};
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return npc;
  var full = GM.chars.find(function(c) { return c && c.name === npc.name; });
  return full || npc;
}

function _buildNpcDecisionComposerAddon(npc, options) {
  var composer = (typeof TM !== 'undefined' && TM.PromptComposer) ? TM.PromptComposer : null;
  if (!composer) return '';
  var fullNpc = _resolveNpcDecisionPromptChar(npc);
  var out = '';
  try {
    if (typeof composer.buildAiPersonaText === 'function') out += composer.buildAiPersonaText(fullNpc, options) || '';
    if (typeof composer.buildRecognitionState === 'function') out += composer.buildRecognitionState(fullNpc) || '';
  } catch (_) {}
  return out;
}

function _getNpcDecisionBatchPersonaMaxLen() {
  var composer = (typeof TM !== 'undefined' && TM.PromptComposer) ? TM.PromptComposer : null;
  var sc = null;
  try {
    sc = (typeof findScenarioById === 'function' && typeof GM !== 'undefined' && GM && GM.sid) ? findScenarioById(GM.sid) : null;
  } catch (_) {}
  if (composer && typeof composer.getBatchPersonaMaxLen === 'function') return composer.getBatchPersonaMaxLen(sc, 200);
  var req = sc && sc.modelRequirements;
  var v = req && Number(req.batchPersonaMaxLen);
  return isFinite(v) && v >= 0 ? v : 200;
}

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

  prompt += _buildNpcDecisionComposerAddon(npc);

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
  _officeIndexGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
}

var _officeIndexGen = -1;
function _ensureOfficeIndex() {
  // 读档代际参与失效(2026-07-04 审查定罪)：只按 GM.turn 失效·读同回合号存档(回滚/另一局)曾继续用旧局官职树
  var _gen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
  if (_officeIndexTurn !== GM.turn || _officeIndexGen !== _gen || !_officeIndex) _buildOfficeIndex();
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
NpcBehaviorRegistry.register('petition', function(npc, target, d, ctx) { executePetitionBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('conspire', function(npc, target, d, ctx) { executeConspireBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('train_troops', function(npc, target, d, ctx) { executeTrainTroopsBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('send_letter', function(npc, target, d, ctx) { executeSendLetterBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('seek_audience', function(npc, target, d, ctx) { executeSeekAudienceBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('request_funds', function(npc, target, d, ctx) { executeRequestFundsBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('obstruct', function(npc, target, d, ctx) { executeObstructBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('slander', function(npc, target, d, ctx) { executeSlanderBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('private_correspondence', function(npc, target, d, ctx) { executePrivateCorrespondenceBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('recommend', function(npc, target, d, ctx) { executeRecommendBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('impeach', function(npc, target, d, ctx) { executeImpeachBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('patrol', function(npc, target, d, ctx) { executePatrolBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('fortify', function(npc, target, d, ctx) { executeFortifyBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('develop_local', function(npc, target, d, ctx) { executeDevelopLocalBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('relief', function(npc, target, d, ctx) { executeReliefBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('build_network', function(npc, target, d, ctx) { executeBuildNetworkBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('office_duty', function(npc, target, d, ctx) { executeOfficeDutyBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('private_life', function(npc, target, d, ctx) { executePrivateLifeBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('palace_intrigue', function(npc, target, d, ctx) { executePalaceIntrigueBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('court_politics', function(npc, target, d, ctx) { executeCourtPoliticsBehavior(npc, target, d, ctx); });

// ===== 执行层 =====

// NPC 行为执行（通过注册表分发）

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
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, 10, npc.name + '\u63D0\u62D4\u4EFB\u547D', { source:'npc-decision-appoint' });
    else targetChar.loyalty = Math.min(100, targetChar.loyalty + 10);
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
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, -20, npc.name + '\u7F62\u514D\u5B98\u804C', { source:'npc-decision-dismiss' });
    else targetChar.loyalty = Math.max(0, targetChar.loyalty - 20);
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
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, 5, npc.name + '\u8D4F\u8D50', { source:'npc-decision-reward' });
    else targetChar.loyalty = Math.min(100, targetChar.loyalty + 5);
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
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, -15, npc.name + '\u60E9\u7F5A', { source:'npc-decision-punish' });
    else targetChar.loyalty = Math.max(0, targetChar.loyalty - 15);
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
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, 10, '\u63A5\u53D7' + npc.name + '\u8981\u6C42\u6548\u5FE0', { source:'npc-decision-request-loyalty-accept' });
    else targetChar.loyalty = Math.min(100, targetChar.loyalty + 10);
  } else {
    addEB('拒绝', target + ' 拒绝效忠');
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(targetChar, -10, '\u62D2\u7EDD' + npc.name + '\u8981\u6C42\u6548\u5FE0', { source:'npc-decision-request-loyalty-reject' });
    else targetChar.loyalty = Math.max(0, targetChar.loyalty - 10);
  }
}

// 执行改革行为
function executeReformBehavior(npc, target, decision, context) {
  addEB('改革', npc.name + ' 推行改革：' + target);

  // 改革影响资源和稳定度——民心走总闸：vars['民心'].value 是已退役镜像·直写被 aggregateTrue 冲掉(2026-07-04 审查定罪)
  if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
    try { TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'npc-reform', kind: 'npcReform', delta: -5, reason: (npc && npc.name || '大臣') + '推行改革·扰动民生' }); } catch (_e) {}
  }

  if (GM.eraState) {
    GM.eraState.socialStability = Math.max(0, GM.eraState.socialStability - 0.05);
  }
}

function _npcActionUid(npc, type, target) {
  return ['npcact', npc && npc.name || 'unknown', type || 'none', target || ''].join(':');
}

function _findNpcCommandedArmies(npc) {
  if (!npc || !Array.isArray(GM.armies)) return [];
  var name = npc.name;
  var aliases = ['commander', 'commanderName', 'commanderDisplayName', 'commander_name', 'general', 'generalName', 'leader', 'leaderName', 'commandingOfficer', 'chiefCommander', 'chiefGeneral', 'mainGeneral'];
  return GM.armies.filter(function(army) {
    return aliases.some(function(k) { return army && army[k] === name; });
  });
}

function _hasMilitaryCommand(npc) {
  if (!npc) return false;
  if (_findNpcCommandedArmies(npc).length > 0) return true;
  if ((npc.troops || 0) > 0) return true;
  var title = String(npc.officialTitle || npc.title || npc.position || '');
  return /将|帅|军|营|总兵|提督|都督|指挥|General/i.test(title);
}

function _npcNumber(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : (fallback == null ? 50 : fallback);
}

function _npcAbilityValue(npc, key, fallback) {
  npc = npc || {};
  var sources = [
    npc[key],
    npc.abilities && npc.abilities[key],
    npc.stats && npc.stats[key],
    npc.attributes && npc.attributes[key]
  ];
  for (var i = 0; i < sources.length; i++) {
    if (sources[i] != null) return _npcNumber(sources[i], fallback == null ? 50 : fallback);
  }
  return fallback == null ? 50 : fallback;
}

function _npcAbilityProfile(npc) {
  return {
    intelligence: _npcAbilityValue(npc, 'intelligence', 50),
    valor: _npcAbilityValue(npc, 'valor', 50),
    military: _npcAbilityValue(npc, 'military', _npcAbilityValue(npc, 'valor', 50)),
    administration: _npcAbilityValue(npc, 'administration', 50),
    management: _npcAbilityValue(npc, 'management', _npcAbilityValue(npc, 'administration', 50)),
    charisma: _npcAbilityValue(npc, 'charisma', 50),
    diplomacy: _npcAbilityValue(npc, 'diplomacy', 50),
    benevolence: _npcAbilityValue(npc, 'benevolence', 50)
  };
}

function _npcWuchangProfile(npc) {
  return {
    ren: _npcWuchangScore(npc, '仁', _npcAbilityValue(npc, 'benevolence', 50)),
    yi: _npcWuchangScore(npc, '义', _npcAbilityValue(npc, 'integrity', 50)),
    li: _npcWuchangScore(npc, '礼', _npcAbilityValue(npc, 'charisma', 50)),
    zhi: _npcWuchangScore(npc, '智', _npcAbilityValue(npc, 'intelligence', 50)),
    xin: _npcWuchangScore(npc, '信', _npcAbilityValue(npc, 'integrity', 50))
  };
}

function _npcPositiveFit(value, scale, cap) {
  return Math.min(cap == null ? 20 : cap, Math.max(0, (Number(value || 0) - 50) * (scale == null ? 0.2 : scale)));
}

function _npcInverseFit(value, scale, cap) {
  return Math.min(cap == null ? 20 : cap, Math.max(0, (50 - Number(value || 0)) * (scale == null ? 0.2 : scale)));
}

function _npcAvg(values) {
  var sum = 0;
  var count = 0;
  values.forEach(function(v) {
    var n = Number(v);
    if (isFinite(n)) { sum += n; count++; }
  });
  return count ? sum / count : 50;
}

function _npcGetEconomyRow(npc, context) {
  if (!npc) return null;
  var list = context && Array.isArray(context.characterEconomy) ? context.characterEconomy : [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].name === npc.name) return list[i];
  }
  if (typeof _npcBuildCharacterEconomySnapshot === 'function') return _npcBuildCharacterEconomySnapshot(npc);
  return null;
}

function _npcPublicTreasuryPressure(npc, context) {
  var row = _npcGetEconomyRow(npc, context);
  if (!row) return 0;
  var publicPurse = row.publicPurse || {};
  var publicTreasury = row.publicTreasury || {};
  var deficit = Math.max(0, Number(publicTreasury.deficit || 0));
  var balance = Number(publicTreasury.balance != null ? publicTreasury.balance : publicPurse.money || 0);
  var lowPurse = balance > 0 ? Math.max(0, 2000 - balance) : 2000;
  return Math.min(24, deficit / 450 + lowPurse / 600);
}

function _npcPrivateDebtPressure(npc, context) {
  var row = _npcGetEconomyRow(npc, context);
  if (!row) return 0;
  var money = row.privateWealth ? Number(row.privateWealth.money || 0) : 0;
  var debt = Number(row.debt || (money < 0 ? Math.abs(money) : 0));
  return Math.min(24, debt / 80 + Math.max(0, 500 - money) / 160 + Math.max(0, Number(row.stress || 0) - 55) / 3);
}

function _npcShadowWealthPressure(npc, context) {
  var row = _npcGetEconomyRow(npc, context);
  if (!row) return 0;
  return Math.min(24,
    Math.max(0, Number(row.hiddenWealth || 0)) / 350 +
    Math.max(0, -Number(row.fame || 0)) / 3 +
    Math.max(0, -Number(row.virtueMerit || 0)) / 25
  );
}

function _npcVirtueEconomyPull(npc, context) {
  var row = _npcGetEconomyRow(npc, context);
  if (!row) return 0;
  return Math.min(16, Math.max(0, Number(row.virtueMerit || 0)) / 55 + Math.max(0, Number(row.fame || 0)) / 6);
}

function _npcAbilityActionFit(type, npc) {
  var a = _npcAbilityProfile(npc);
  var avg = 50;
  if (type === 'office_duty') avg = _npcAvg([a.administration, a.management, a.intelligence]);
  else if (type === 'petition' || type === 'seek_audience') avg = _npcAvg([a.intelligence, a.diplomacy, a.charisma]);
  else if (type === 'recommend' || type === 'impeach') avg = _npcAvg([a.intelligence, a.administration, a.diplomacy]);
  else if (type === 'conspire' || type === 'court_politics' || type === 'obstruct' || type === 'slander') avg = _npcAvg([a.intelligence, a.charisma, a.diplomacy]);
  else if (type === 'private_correspondence' || type === 'build_network') avg = _npcAvg([a.diplomacy, a.charisma, a.intelligence]);
  else if (type === 'train_troops' || type === 'patrol' || type === 'fortify') avg = _npcAvg([a.military, a.valor, a.intelligence]);
  else if (type === 'request_funds') avg = _hasMilitaryCommand(npc) ? _npcAvg([a.military, a.diplomacy, a.intelligence]) : _npcAvg([a.management, a.administration, a.diplomacy]);
  else if (type === 'develop_local') avg = _npcAvg([a.administration, a.management, a.benevolence]);
  else if (type === 'relief') avg = _npcAvg([a.benevolence, a.administration, a.management, a.diplomacy]);
  else if (type === 'private_life') avg = _npcAvg([a.management, a.intelligence]);
  else if (type === 'palace_intrigue') avg = _npcAvg([a.charisma, a.diplomacy, a.intelligence]);
  else if (type === 'send_letter') avg = _npcAvg([a.diplomacy, a.intelligence]);
  return Math.round(_npcPositiveFit(avg, 0.28, 18));
}

function _npcWuchangActionFit(type, npc) {
  var w = _npcWuchangProfile(npc);
  var fit = 0;
  if (type === 'recommend' || type === 'impeach') fit = _npcPositiveFit(_npcAvg([w.yi, w.xin, w.zhi]), 0.3, 18);
  else if (type === 'office_duty' || type === 'petition') fit = _npcPositiveFit(_npcAvg([w.yi, w.xin, w.li, w.zhi]), 0.22, 16);
  else if (type === 'relief') fit = _npcPositiveFit(_npcAvg([w.ren, w.yi, w.xin]), 0.35, 20);
  else if (type === 'develop_local') fit = _npcPositiveFit(_npcAvg([w.ren, w.li, w.zhi]), 0.22, 14);
  else if (type === 'private_life') fit = _npcPositiveFit(_npcAvg([w.li, w.zhi]), 0.12, 8);
  else if (type === 'train_troops' || type === 'patrol' || type === 'fortify') fit = _npcPositiveFit(_npcAvg([w.yi, w.xin, w.zhi]), 0.16, 12);
  else if (type === 'send_letter' || type === 'seek_audience') fit = _npcPositiveFit(_npcAvg([w.li, w.xin, w.zhi]), 0.18, 12);
  else if (type === 'build_network' || type === 'private_correspondence' || type === 'court_politics' || type === 'palace_intrigue') fit = _npcPositiveFit(_npcAvg([w.li, w.zhi]), 0.2, 14);
  else if (type === 'conspire' || type === 'obstruct' || type === 'slander') {
    fit = _npcInverseFit(_npcAvg([w.yi, w.xin]), 0.34, 18) + _npcPositiveFit(_npcAvg([w.zhi, w.li]), 0.12, 8);
  }
  return Math.round(fit);
}

function _npcEconomyActionFit(type, npc, context) {
  var publicPressure = _npcPublicTreasuryPressure(npc, context);
  var debtPressure = _npcPrivateDebtPressure(npc, context);
  var shadowPressure = _npcShadowWealthPressure(npc, context);
  var virtuePull = _npcVirtueEconomyPull(npc, context);
  var fit = 0;
  if (type === 'request_funds') fit += publicPressure + debtPressure * 0.25;
  else if (type === 'office_duty') fit += publicPressure * 0.8 + virtuePull * 0.25;
  else if (type === 'private_life') fit += debtPressure;
  else if (type === 'conspire' || type === 'obstruct' || type === 'slander') fit += shadowPressure + debtPressure * 0.35;
  else if (type === 'private_correspondence' || type === 'build_network' || type === 'court_politics') fit += shadowPressure * 0.65 + debtPressure * 0.15;
  else if (type === 'recommend' || type === 'impeach') fit += virtuePull;
  else if (type === 'relief' || type === 'develop_local') fit += virtuePull * 0.7;
  else if (type === 'seek_audience' || type === 'petition') fit += Math.max(publicPressure, debtPressure) * 0.4;
  return Math.round(Math.min(24, Math.max(0, fit)));
}

function _npcFamilyEconomyFor(npc, context) {
  var row = _npcGetEconomyRow(npc, context);
  return row && row.familyEconomy || null;
}

function _npcSocialTierFor(npc, context) {
  var row = _npcGetEconomyRow(npc, context);
  return row && row.socialTier || null;
}

function _npcFamilyActionFit(type, npc, context) {
  var fam = _npcFamilyEconomyFor(npc, context);
  if (!fam) return 0;
  var shared = Math.max(0, Number(fam.sharedWealth || 0));
  var renown = Math.max(0, Number(fam.renown || fam.prestige || 0));
  var tier = String(fam.tier || '').toLowerCase();
  var influence = Math.min(24, shared / 2500 + renown / 10 + (fam.isHead ? 4 : 0));
  if (tier.indexOf('great') >= 0 || tier.indexOf('noble') >= 0 || tier.indexOf('imperial') >= 0) influence += 3;
  if (type === 'build_network' || type === 'court_politics' || type === 'private_correspondence') return Math.round(Math.min(24, influence));
  if (type === 'recommend' || type === 'petition' || type === 'seek_audience') return Math.round(Math.min(16, influence * 0.55));
  if (type === 'private_life') return Math.round(Math.min(12, shared / 3600 + (fam.isHead ? 2 : 0)));
  return Math.round(Math.min(8, influence * 0.2));
}

function _npcTierActionFit(type, npc, context) {
  var tier = _npcSocialTierFor(npc, context);
  var row = _npcGetEconomyRow(npc, context);
  if (!tier) return 0;
  var key = String(tier.key || '').toLowerCase();
  var params = tier.classParams || {};
  var pw = row && row.privateWealth || {};
  var commerce = Math.max(0, Number(pw.commerce || 0));
  var land = Math.max(0, Number(pw.land || 0));
  var fit = 0;
  if (key === 'merchant') {
    if (type === 'build_network' || type === 'private_correspondence' || type === 'send_letter') fit += commerce / 900 + Number(params.commerceYield || 0) * 80 + 4;
    else if (type === 'private_life') fit += commerce / 1300 + Number(params.commerceYield || 0) * 60 + 3;
    else if (type === 'petition' || type === 'seek_audience') fit += commerce / 2400;
  } else if (key === 'civilofficial') {
    if (type === 'office_duty' || type === 'petition' || type === 'recommend') fit += 6 + Math.max(0, 8 - Number(tier.rankLevel || 9));
    if (type === 'court_politics' || type === 'build_network') fit += 3;
  } else if (key === 'militaryofficial') {
    if (type === 'train_troops' || type === 'patrol' || type === 'fortify' || type === 'request_funds') fit += 10;
  } else if (key === 'noble' || key === 'imperial') {
    if (type === 'build_network' || type === 'court_politics' || type === 'seek_audience' || type === 'recommend') fit += 10;
  } else if (key === 'landlord') {
    if (type === 'private_life' || type === 'develop_local') fit += land / 90 + Number(params.landYield || 0) * 60;
  } else if (key === 'commoner') {
    if (type === 'private_life') fit += Math.min(8, Number(row && row.debt || 0) / 260 + Math.max(0, Number(row && row.stress || 0) - 55) / 8);
    if (type === 'seek_audience') fit += Math.min(6, Math.max(0, Number(row && row.stress || 0) - 60) / 6);
  }
  return Math.round(Math.min(24, Math.max(0, fit)));
}

function _buildNpcMotiveProfile(npc, context) {
  npc = npc || {};
  context = context || {};
  var loyalty = typeof npc.loyalty === 'number' ? npc.loyalty : 50;
  var ambition = typeof npc.ambition === 'number' ? npc.ambition : 50;
  var ability = _npcAbilityProfile(npc);
  var wuchang = _npcWuchangProfile(npc);
  var intel = ability.intelligence;
  var integrity = typeof npc.integrity === 'number' ? npc.integrity : _npcAvg([wuchang.yi, wuchang.xin]);
  var valor = ability.valor;
  var stress = typeof npc.stress === 'number' ? npc.stress : 0;
  var capital = GM && GM._capital || 'Capital';
  var localKey = npc.jurisdiction || npc.location || npc.province || '';
  var localStats = GM && GM.provinceStats && localKey ? GM.provinceStats[localKey] : null;
  var localUnrest = localStats ? Number(localStats.unrest || 0) : 0;
  var publicPressure = _npcPublicTreasuryPressure(npc, context);
  var debtPressure = _npcPrivateDebtPressure(npc, context);
  var shadowPressure = _npcShadowWealthPressure(npc, context);
  var virtuePull = _npcVirtueEconomyPull(npc, context);
  return {
    career: Math.max(0, 12 + (hasOffice(npc.name) ? 14 : 0) + (intel - 50) * 0.2 + (ambition - 50) * 0.15 + _npcPositiveFit(_npcAvg([ability.administration, ability.management]), 0.15, 8) + publicPressure * 0.25),
    networking: Math.max(0, 10 + (ambition - 45) * 0.35 + Math.max(0, 70 - loyalty) * 0.12 + (_npcHasRealParty(npc) ? 8 : 0) + _npcPositiveFit(_npcAvg([ability.charisma, ability.diplomacy]), 0.18, 10) + shadowPressure * 0.25),
    military: Math.max(0, (_hasMilitaryCommand(npc) ? 28 : 0) + (valor - 50) * 0.18 + (ability.military - 50) * 0.28 + _npcPositiveFit(wuchang.yi, 0.08, 5)),
    local: Math.max(0, (npc.location && npc.location !== capital ? 18 : 0) + (localKey ? 8 : 0) + localUnrest * 0.18 + _npcPositiveFit(_npcAvg([ability.administration, ability.benevolence]), 0.16, 9) + virtuePull * 0.2),
    integrity: Math.max(0, (integrity - 45) * 0.24 + (intel - 55) * 0.12 + (loyalty - 50) * 0.08 + _npcPositiveFit(_npcAvg([wuchang.yi, wuchang.xin]), 0.24, 14) + virtuePull * 0.35),
    grievance: Math.max(0, Math.max(0, 55 - loyalty) * 0.28 + Math.max(0, ambition - 60) * 0.22 + stress * 0.16 + _npcInverseFit(_npcAvg([wuchang.yi, wuchang.xin]), 0.18, 10) + shadowPressure * 0.35),
    survival: Math.max(0, stress * 0.2 + Math.max(0, 45 - loyalty) * 0.2 + debtPressure * 0.75 + _npcPositiveFit(ability.management, 0.08, 5))
  };
}

function _npcMotiveForBehavior(type) {
  var map = {
    petition: 'career',
    recommend: 'integrity',
    impeach: 'integrity',
    conspire: 'networking',
    private_correspondence: 'networking',
    build_network: 'networking',
    train_troops: 'military',
    request_funds: 'military',
    patrol: 'military',
    fortify: 'military',
    send_letter: 'local',
    seek_audience: 'career',
    develop_local: 'local',
    relief: 'local',
    office_duty: 'career',
    private_life: 'survival',
    palace_intrigue: 'networking',
    court_politics: 'networking',
    obstruct: 'grievance',
    slander: 'grievance'
  };
  return map[type] || 'career';
}

function _scoreNpcActionCandidate(candidate, npc, context) {
  if (!candidate || !npc) return 0;
  var loyalty = typeof npc.loyalty === 'number' ? npc.loyalty : 50;
  var ambition = typeof npc.ambition === 'number' ? npc.ambition : 50;
  var intel = typeof npc.intelligence === 'number' ? npc.intelligence : 50;
  var score = candidate.baseScore || 10;
  if (typeof candidate.motiveScore === 'number') score += candidate.motiveScore * 0.35;
  score += Number(candidate.abilityFit || 0) * 0.4;
  score += Number(candidate.wuchangFit || 0) * 0.4;
  score += Number(candidate.economyFit || 0) * 0.8;
  score += Number(candidate.familyFit || 0) * 0.65;
  score += Number(candidate.tierFit || 0) * 0.65;
  if (candidate.behaviorType === 'petition') {
    score += Math.max(0, intel - 50) * 0.15;
    score += loyalty >= 60 ? 8 : 3;
  } else if (candidate.behaviorType === 'recommend' || candidate.behaviorType === 'impeach') {
    score += Math.max(0, (npc.integrity || 50) - 55) * 0.22;
    score += Math.max(0, intel - 55) * 0.15;
  } else if (candidate.behaviorType === 'conspire') {
    score += Math.max(0, ambition - 55) * 0.35;
    score += Math.max(0, 55 - loyalty) * 0.25;
  } else if (candidate.behaviorType === 'build_network') {
    score += Math.max(0, ambition - 55) * 0.28;
    score += _npcHasRealParty(npc) ? 6 : 0;
    score += Number(candidate.familyFit || 0) * 0.45 + Number(candidate.tierFit || 0) * 0.55;
  } else if (candidate.behaviorType === 'train_troops') {
    score += _hasMilitaryCommand(npc) ? 15 : 0;
    score += Math.max(0, (npc.valor || 50) - 50) * 0.2;
  } else if (candidate.behaviorType === 'patrol' || candidate.behaviorType === 'fortify') {
    score += _hasMilitaryCommand(npc) ? 10 : 0;
    score += Math.max(0, (npc.valor || 50) - 45) * 0.16;
  } else if (candidate.behaviorType === 'send_letter') {
    var capital = GM._capital || '京师';
    score += npc.location && npc.location !== capital ? 12 : 2;
    score += Math.max(0, intel - 45) * 0.1;
  } else if (candidate.behaviorType === 'private_correspondence') {
    score += Math.max(0, ambition - 55) * 0.25;
    score += Math.max(0, intel - 50) * 0.12;
    score += Math.max(0, 70 - loyalty) * 0.08;
  } else if (candidate.behaviorType === 'seek_audience') {
    score += npc.location && npc.location !== (GM._capital || '京师') ? 8 : 4;
    score += Math.max(0, (npc.stress || 0) - 40) * 0.2;
  } else if (candidate.behaviorType === 'request_funds') {
    score += _hasMilitaryCommand(npc) ? 12 : 2;
    score += Math.max(0, (npc.valor || 50) - 50) * 0.1;
  } else if (candidate.behaviorType === 'develop_local' || candidate.behaviorType === 'relief') {
    score += npc.location && npc.location !== (GM._capital || 'Capital') ? 8 : 2;
    score += Math.max(0, (npc.integrity || 50) - 50) * 0.1;
  } else if (candidate.behaviorType === 'office_duty') {
    score += hasOffice(npc.name) ? 14 : 4;
    score += Math.max(0, (npc.administration || npc.management || 50) - 50) * 0.18;
    score += Math.max(0, (npc.integrity || 50) - 45) * 0.1;
  } else if (candidate.behaviorType === 'private_life') {
    score += !hasOffice(npc.name) ? 12 : 1;
    score += Math.max(0, (npc.management || npc.intelligence || 50) - 50) * 0.16;
    score += Math.max(0, ambition - 50) * 0.08;
    score += Number(candidate.tierFit || 0) * 0.25;
  } else if (candidate.behaviorType === 'palace_intrigue') {
    score += _npcIsPlayerConsort(npc) ? 16 : 0;
    score += Math.max(0, (npc.charisma || 50) - 50) * 0.18;
    score += Math.max(0, ambition - 55) * 0.22;
  } else if (candidate.behaviorType === 'court_politics') {
    score += hasOffice(npc.name) ? 10 : 2;
    score += Math.max(0, ambition - 55) * 0.22;
    score += Math.max(0, intel - 50) * 0.12;
  } else if (candidate.behaviorType === 'obstruct' || candidate.behaviorType === 'slander') {
    score += Math.max(0, ambition - 60) * 0.25;
    score += Math.max(0, 50 - loyalty) * 0.15;
  }
  return Math.max(1, Math.round(score));
}

function _makeNpcActionCandidate(npc, type, target, intent, baseScore, context) {
  var motives = _buildNpcMotiveProfile(npc, context || {});
  var motive = _npcMotiveForBehavior(type);
  var candidate = {
    id: _npcActionUid(npc, type, target),
    actor: npc && npc.name || '',
    name: npc && npc.name || '',
    behaviorType: type,
    target: target || '',
    intent: intent || type,
    baseScore: baseScore || 10,
    motive: motive,
    motiveScore: Math.round(Number(motives[motive] || 0))
  };
  candidate.abilityFit = _npcAbilityActionFit(type, npc);
  candidate.wuchangFit = _npcWuchangActionFit(type, npc);
  candidate.economyFit = _npcEconomyActionFit(type, npc, context || null);
  candidate.familyFit = _npcFamilyActionFit(type, npc, context || null);
  candidate.tierFit = _npcTierActionFit(type, npc, context || null);
  candidate.score = _scoreNpcActionCandidate(candidate, npc, context || null);
  return candidate;
}

function _npcLiveCharacters() {
  return Array.isArray(GM.chars) ? GM.chars.filter(function(ch) {
    return ch && ch.alive !== false && ch.name;
  }) : [];
}

function _npcHasRealParty(npc) {
  var party = String(npc && npc.party || '').trim();
  return !!party && party !== '\u65E0\u515A\u6D3E' && party.toLowerCase() !== 'none';
}

function _npcSameFaction(a, b) {
  var af = String(a && (a.faction || a.factionName) || '').trim();
  var bf = String(b && (b.faction || b.factionName) || '').trim();
  return !!af && af === bf;
}

function _npcCleanIdentityName(value) {
  return String(value || '').replace(/[\s·\-—、，。,.()（）【】\[\]：:\/\\]/g, '').trim();
}

function _npcIsPlayerConsort(npc) {
  if (typeof _tmIsPlayerConsort === 'function') {
    try { return !!_tmIsPlayerConsort(npc); } catch (_) {}
  }
  if (!npc || npc.alive === false || npc.dead) return false;
  var spouse = npc.spouse;
  if (typeof spouse === 'string' && spouse.trim()) {
    var names = [];
    try {
      if (typeof P !== 'undefined' && P && P.playerInfo) {
        if (P.playerInfo.characterName) names.push(P.playerInfo.characterName);
        if (P.playerInfo.name) names.push(P.playerInfo.name);
      }
      if (typeof GM !== 'undefined' && GM && GM.playerName) names.push(GM.playerName);
    } catch (_) {}
    var clean = _npcCleanIdentityName(spouse);
    if (names.map(_npcCleanIdentityName).indexOf(clean) >= 0) return true;
    return false;
  }
  var rel = String(npc.playerRelation || npc.relationToPlayer || npc.relationshipToPlayer || '');
  if (/(夫妻|夫妾|妻妾|帝妃|帝后|后妃|妃嫔|皇后|贵妃|爱妃|宠妃)/.test(rel)) return true;
  if (!(spouse === true || npc._isConsort || npc.isConsort || npc.spouseRank)) return false;
  var text = [npc.title, npc.officialTitle, npc.role, npc.position, npc.rank, npc.spouseRank].join(' ');
  if (/(先朝|遗妃|遗孀|皇嫂|嫂叔|太后|皇太后|太皇太后|太妃|王太妃|福晋|王妃|王后|可汗|大汗|汗妃)/.test(text)) return false;
  return /(皇后|贵妃|妃|嫔|才人|选侍|淑人|常在|答应|宫人|侍妾|后宫|中宫|正妻|妻室|consort|empress|queen|concubine|attendant)/i.test(text);
}

function _npcIsAtPlayerLocation(npc) {
  if (typeof _tmIsAtPlayerLocation === 'function') {
    try { return !!_tmIsAtPlayerLocation(npc); } catch (_) {}
  }
  if (!npc || npc.alive === false || npc.dead || npc._travelTo || npc._enRouteToOffice || npc._imprisoned || npc.imprisoned || npc._exiled || npc.exiled || npc._fled || npc._missing) return false;
  var playerLoc = '';
  try { if (typeof _getPlayerLocation === 'function') playerLoc = _getPlayerLocation(); } catch (_) {}
  if (!playerLoc) playerLoc = (typeof GM !== 'undefined' && GM && (GM._capital || GM.capital)) || '京师';
  var loc = npc.location || npc.place || npc.currentLocation || playerLoc;
  return (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (_npcCleanIdentityName(loc) === _npcCleanIdentityName(playerLoc));
}

function _npcTargetSort(a, b) {
  return (b.score || 0) - (a.score || 0) || String(a.ch.name).localeCompare(String(b.ch.name));
}

function _npcHistoryKindForAction(type) {
  if (type === 'conspire') return 'conspiracy';
  if (type === 'private_correspondence') return 'private_correspondence';
  if (type === 'obstruct' || type === 'slander') return 'hidden_move';
  if (type === 'palace_intrigue') return 'palace_intrigue';
  if (type === 'court_politics') return 'court_politics';
  return type || '';
}

function _npcRecentTargetPenalty(npc, type, target) {
  if (!npc || !npc.name || !target || typeof GM === 'undefined' || !GM) return 0;
  var kind = _npcHistoryKindForAction(type);
  var turn = Number(GM.turn || 0);
  var maxPenalty = 0;
  function inspect(item, itemKind) {
    if (!item) return;
    var effectiveKind = item.kind || itemKind || '';
    if (kind && effectiveKind && effectiveKind !== kind) return;
    var from = item.from || item.actor || item.name || '';
    var to = item.to || item.target || '';
    if (from !== npc.name || to !== target) return;
    var age = turn - Number(item.turn || turn);
    if (age < 0 || age > 4) return;
    maxPenalty = Math.max(maxPenalty, Math.max(20, 48 - age * 6));
  }
  (Array.isArray(GM._npcInternalActionHistory) ? GM._npcInternalActionHistory : []).forEach(function(item) {
    inspect(item, item && item.kind);
  });
  (Array.isArray(GM._pendingNpcCorrespondence) ? GM._pendingNpcCorrespondence : []).forEach(function(item) {
    inspect(item, 'private_correspondence');
  });
  (Array.isArray(GM._pendingNpcConspiracies) ? GM._pendingNpcConspiracies : []).forEach(function(item) {
    inspect(item, 'conspiracy');
  });
  (Array.isArray(GM._npcHiddenMoves) ? GM._npcHiddenMoves : []).forEach(function(item) {
    inspect(item, 'hidden_move');
  });
  return maxPenalty;
}

// ★2026-07-01 W2a·NPC自主决策纳入记忆链条:此前 _selectNpcActionTarget 只按党派/野心/忠诚/才干打分选对象·
//   完全不读「此人对目标的印象/好感」(记忆底座 _impressions)——W1汇流审计坐实的缺口。此助手读好感(-100..100)·
//   令 NPC 更倾向与亲近信任者密谋通书、构陷素所记恨者·把记忆真正接进自主推演的对象选择(确定性·无好感回退0=旧行为)。
//   优先走零调用的 NpcMemorySystem.getImpression(点亮死API)·失败回退直读 _impressions.favor。
function _npcFavorToward(npc, targetName) {
  if (!npc || !targetName) return 0;
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getImpression) {
      var imp = NpcMemorySystem.getImpression(npc.name, targetName);
      if (typeof imp === 'number') return imp;
      if (imp && typeof imp.favor === 'number') return imp.favor;
    }
  } catch (_e) {}
  var d = npc._impressions && npc._impressions[targetName];
  return (d && typeof d.favor === 'number') ? d.favor : 0;
}
function _selectNpcActionTarget(npc, type, context) {
  if (!npc || !npc.name) return '';
  var people = _npcLiveCharacters().filter(function(ch) { return ch.name !== npc.name && !ch.isPlayer; });
  if (!people.length) return '';
  var actorOffice = findNpcOffice(npc.name);

  if (type === 'conspire' || type === 'build_network') {
    var allies = people.map(function(ch) {
      var score = 0;
      if (_npcHasRealParty(npc) && ch.party === npc.party) score += 40;
      if (_npcSameFaction(npc, ch)) score += 15;
      if (npc.location && ch.location === npc.location) score += 8;
      if (findNpcOffice(ch.name)) score += 6;
      score += Math.max(0, (ch.ambition || 50) - 50) * 0.1;
      score += Math.max(0, 75 - (ch.loyalty || 50)) * 0.05;
      score += _npcFavorToward(npc, ch.name) * 0.2;   // W2a·亲近信任者更可能被引为同谋/结网·记恨者避之
      score -= _npcRecentTargetPenalty(npc, type, ch.name);
      return { ch: ch, score: score };
    }).filter(function(item) { return item.score > 0; }).sort(_npcTargetSort);
    return allies[0] ? allies[0].ch.name : '';
  }

  if (type === 'private_correspondence') {
    var contacts = people.map(function(ch) {
      var score = 0;
      if (_npcHasRealParty(npc) && ch.party === npc.party) score += 36;
      if (_npcSameFaction(npc, ch)) score += 14;
      if (npc.location && ch.location === npc.location) score += 10;
      if (findNpcOffice(ch.name)) score += 6;
      score += Math.max(0, (ch.intelligence || 50) - 50) * 0.08;
      score += Math.max(0, 80 - (ch.loyalty || 50)) * 0.25;
      score -= Math.max(0, (ch.integrity || 50) - 75) * 0.8;
      score += _npcFavorToward(npc, ch.name) * 0.18;   // W2a·更愿与好感高者私相通书
      score -= _npcRecentTargetPenalty(npc, type, ch.name);
      return { ch: ch, score: score };
    }).filter(function(item) { return item.score > 0; }).sort(_npcTargetSort);
    return contacts[0] ? contacts[0].ch.name : '';
  }

  if (type === 'recommend') {
    var talents = people.map(function(ch) {
      var score = 0;
      if (_npcSameFaction(npc, ch)) score += 20;
      if (_npcHasRealParty(npc) && ch.party === npc.party) score += 12;
      if (findNpcOffice(ch.name)) score += 6;
      score += Math.max(0, (ch.intelligence || 50) - 50) * 0.18;
      score += Math.max(0, (ch.integrity || 50) - 45) * 0.12;
      score += _npcFavorToward(npc, ch.name) * 0.12;   // W2a·举荐倾向自己赏识者·不荐所恶
      score -= _npcRecentTargetPenalty(npc, type, ch.name);
      return { ch: ch, score: score };
    }).filter(function(item) { return item.score > 0; }).sort(_npcTargetSort);
    return talents[0] ? talents[0].ch.name : '';
  }

  if (type === 'obstruct' || type === 'slander' || type === 'impeach') {
    var rivals = people.map(function(ch) {
      var score = 0;
      if (_npcHasRealParty(npc) && _npcHasRealParty(ch) && ch.party !== npc.party) score += 35;
      if (_npcSameFaction(npc, ch)) score += 12;
      if (actorOffice) {
        var office = findNpcOffice(ch.name);
        if (office && office.deptName === actorOffice.deptName) score += 12;
      }
      if (findNpcOffice(ch.name)) score += 6;
      score += Math.max(0, (ch.ambition || 50) - 55) * 0.15;
      score += Math.max(0, (ch.intelligence || 50) - 55) * 0.08;
      score += (-_npcFavorToward(npc, ch.name)) * 0.2;   // W2a·记恨者(负好感)更易成构陷/弹劾目标·友好者(正好感)则避之
      score -= _npcRecentTargetPenalty(npc, type, ch.name);
      return { ch: ch, score: score };
    }).filter(function(item) { return item.score > 0; }).sort(_npcTargetSort);
    return rivals[0] ? rivals[0].ch.name : '';
  }

  if (type === 'palace_intrigue') {
    var consorts = people.map(function(ch) {
      var score = 0;
      if (_npcIsPlayerConsort(ch)) score += 30;
      if (ch.motherClan && npc.motherClan && ch.motherClan !== npc.motherClan) score += 10;
      score += Math.max(0, (ch.charisma || 50) - 50) * 0.08;
      score += Math.max(0, (ch.ambition || 50) - 45) * 0.12;
      score += Math.max(0, -_npcFavorToward(npc, ch.name)) * 0.15;   // W2a·宫斗倾向所忌所恶者
      score -= _npcRecentTargetPenalty(npc, type, ch.name);
      return { ch: ch, score: score };
    }).filter(function(item) { return item.score > 0; }).sort(_npcTargetSort);
    return consorts[0] ? consorts[0].ch.name : '';
  }

  if (type === 'court_politics') {
    var politicalTargets = people.map(function(ch) {
      var score = 0;
      if (findNpcOffice(ch.name)) score += 16;
      if (_npcHasRealParty(npc) && _npcHasRealParty(ch) && ch.party !== npc.party) score += 28;
      if (_npcSameFaction(npc, ch)) score += 8;
      score += Math.max(0, (ch.ambition || 50) - 50) * 0.1;
      score -= _npcRecentTargetPenalty(npc, type, ch.name);
      return { ch: ch, score: score };
    }).filter(function(item) { return item.score > 0; }).sort(_npcTargetSort);
    return politicalTargets[0] ? politicalTargets[0].ch.name : '';
  }

  return '';
}

function _npcActionCooldownTurns(type) {
  var map = {
    petition: 2,
    conspire: 2,
    train_troops: 1,
    send_letter: 2,
    private_correspondence: 2,
    seek_audience: 2,
    request_funds: 3,
    obstruct: 2,
    slander: 2,
    recommend: 3,
    impeach: 3,
    patrol: 1,
    fortify: 2,
    develop_local: 2,
    relief: 2,
    build_network: 4,
    office_duty: 1,
    private_life: 1,
    palace_intrigue: 2,
    court_politics: 2
  };
  return map[type] || 1;
}

function _getNpcActionLedger() {
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.ensureLedger) {
    return TM.NPC.ActionLedger.ensureLedger(GM);
  }
  if (!Array.isArray(GM._npcActionLedger)) GM._npcActionLedger = [];
  return GM._npcActionLedger;
}

function _isNpcActionCoolingDown(npc, type, target, context, actionId) {
  if (!npc || !type || type === 'none') return false;
  var turn = Number(GM.turn || 0);
  var cooldown = _npcActionCooldownTurns(type);
  var ledger = _getNpcActionLedger();
  return ledger.some(function(item) {
    if (!item || item.actor !== npc.name || item.behaviorType !== type) return false;
    if (actionId && item.actionId && item.actionId === actionId) return true;
    if (String(item.target || '') !== String(target || '')) return false;
    var age = turn - Number(item.turn || 0);
    return age >= 0 && age < cooldown;
  });
}

function _recordNpcActionLedger(npc, decision) {
  if (!npc || !decision || !decision.behaviorType || decision.behaviorType === 'none') return;
  var stateEffects = decision._executionResult ? { executionResult: decision._executionResult } : null;
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.record) {
    TM.NPC.ActionLedger.record({
      source: 'npc-autonomy',
      kind: 'npc_action',
      actor: npc.name,
      behaviorType: decision.behaviorType,
      type: decision.behaviorType,
      target: decision.target || '',
      action: decision.action || decision.intent || '',
      intent: decision.intent || '',
      actionId: decision.actionId || '',
      status: 'applied',
      result: decision._executionResult && decision._executionResult.outcome || '',
      abilityFit: decision.abilityFit,
      wuchangFit: decision.wuchangFit,
      economyFit: decision.economyFit,
      familyFit: decision.familyFit,
      tierFit: decision.tierFit,
      stateEffects: stateEffects,
      uiRoutes: ['event', 'memory']
    }, { markHandled: true });
    return;
  }
  var ledger = _getNpcActionLedger();
  var turn = GM.turn || 0;
  var exists = ledger.some(function(item) {
    return item && item.turn === turn && item.actor === npc.name && item.behaviorType === decision.behaviorType && String(item.target || '') === String(decision.target || '');
  });
  if (!exists) {
    ledger.push({
      turn: turn,
      actor: npc.name,
      behaviorType: decision.behaviorType,
      target: decision.target || '',
      intent: decision.intent || '',
      actionId: decision.actionId || '',
      result: decision._executionResult && decision._executionResult.outcome || '',
      abilityFit: decision.abilityFit,
      wuchangFit: decision.wuchangFit,
      economyFit: decision.economyFit,
      familyFit: decision.familyFit,
      tierFit: decision.tierFit,
      stateEffects: stateEffects,
      source: 'npc-autonomy'
    });
  }
  if (ledger.length > 200) ledger.splice(0, ledger.length - 200);
}

function _npcPendingMemorialCount() {
  var list = Array.isArray(GM.memorials) ? GM.memorials : [];
  return list.filter(function(m) {
    if (!m) return false;
    var status = String(m.status || m.state || '').toLowerCase();
    if (m.reviewed === true) return false;
    return !status || status === 'pending_review' || status === 'pending' || status === 'new' || status === 'unread';
  }).length;
}

function _npcPendingAudienceCount() {
  return Array.isArray(GM._pendingAudiences) ? GM._pendingAudiences.length : 0;
}

function _npcPendingLetterCount() {
  return Array.isArray(GM._pendingNpcLetters) ? GM._pendingNpcLetters.length : 0;
}

function _isNpcCandidateBlockedByQueuePressure(candidate) {
  if (!candidate) return false;
  var type = candidate.behaviorType;
  var score = Number(candidate.score || candidate.baseScore || 0);
  if (type === 'request_funds' && _npcPendingMemorialCount() >= 10) {
    if (Number(candidate.economyFit || 0) < 12) return true;
    return score < 55;
  }
  if (type === 'petition' && _npcPendingMemorialCount() >= 10) {
    return score < 45;
  }
  if (type === 'seek_audience' && _npcPendingAudienceCount() >= 6) {
    return score < 45;
  }
  if (type === 'send_letter' && _npcPendingLetterCount() >= 10) {
    return score < 45;
  }
  return false;
}

function _buildNpcActionCandidates(npc, context) {
  if (!npc || npc.alive === false) return [];
  context = context || buildNpcBehaviorContext();
  var candidates = [];
  var capital = GM._capital || '京师';
  var memorialQueueBusy = _npcPendingMemorialCount() >= 10;
  var officeInfo = findNpcOffice(npc.name);
  var hasOfficialRole = !!officeInfo || !!npc.officialTitle || !!npc.title;
  var privateDebtPressure = _npcPrivateDebtPressure(npc, context);
  var publicTreasuryPressure = _npcPublicTreasuryPressure(npc, context);
  var networkFamilyFit = _npcFamilyActionFit('build_network', npc, context);
  var networkTierFit = _npcTierActionFit('build_network', npc, context);
  if (hasOfficialRole) {
    var officeTarget = npc.jurisdiction || npc.location || (officeInfo && (officeInfo.deptName + officeInfo.posName)) || 'court';
    candidates.push(_makeNpcActionCandidate(npc, 'office_duty', officeTarget, '履行本职，处置官署公务', 17, context));
    if (!_npcIsPlayerConsort(npc) && privateDebtPressure >= 8) {
      candidates.push(_makeNpcActionCandidate(npc, 'private_life', npc.name, '私财承压，整顿家计以求自保', 12, context));
    }
  } else if (!_npcIsPlayerConsort(npc)) {
    candidates.push(_makeNpcActionCandidate(npc, 'private_life', npc.name, '经营家计或处理日常琐事', 12, context));
  }
  if (_npcIsPlayerConsort(npc)) {
    var palaceTarget = _selectNpcActionTarget(npc, 'palace_intrigue', context) || 'inner palace';
    candidates.push(_makeNpcActionCandidate(npc, 'palace_intrigue', palaceTarget, '经营宫中人情，争取眷顾与声势', 15, context));
  }
  if (hasOfficialRole || (npc.ambition || 50) >= 65) {
    var politicsTarget = _selectNpcActionTarget(npc, 'court_politics', context) || _selectNpcActionTarget(npc, 'obstruct', context) || 'court';
    candidates.push(_makeNpcActionCandidate(npc, 'court_politics', politicsTarget, '在朝堂中联络攻守，试探政敌', 14, context));
  }
  if (!memorialQueueBusy && (hasOffice(npc.name) || npc.officialTitle || npc.title)) {
    candidates.push(_makeNpcActionCandidate(npc, 'petition', '朝廷', '上奏陈事，请求朝廷裁断', 18, context));
  }
  if (!memorialQueueBusy && hasOfficialRole && !_hasMilitaryCommand(npc) && publicTreasuryPressure >= 8) {
    candidates.push(_makeNpcActionCandidate(npc, 'request_funds', '朝廷', '公库亏空，请求拨帑周转', 15, context));
  }
  if (!memorialQueueBusy && hasOffice(npc.name) && ((npc.integrity || 50) >= 70 || (npc.intelligence || 50) >= 78)) {
    var recommendTarget = _selectNpcActionTarget(npc, 'recommend', context) || '';
    if (recommendTarget) candidates.push(_makeNpcActionCandidate(npc, 'recommend', recommendTarget, 'Recommend a useful official to court', 14, context));
    var impeachTarget = _selectNpcActionTarget(npc, 'impeach', context) || '';
    if (impeachTarget) candidates.push(_makeNpcActionCandidate(npc, 'impeach', impeachTarget, 'Impeach a rival or corrupt official', 13, context));
  }
  if ((npc.ambition || 50) >= 70 || ((npc.loyalty || 50) < 40 && (npc.ambition || 50) >= 55)) {
    var allyTarget = _selectNpcActionTarget(npc, 'conspire', context) || '同党';
    candidates.push(_makeNpcActionCandidate(npc, 'conspire', allyTarget, '暗中串联，试探同道', 16, context));
    var contactTarget = _selectNpcActionTarget(npc, 'private_correspondence', context) || allyTarget;
    candidates.push(_makeNpcActionCandidate(npc, 'private_correspondence', contactTarget, '私下通书，互探局势', 14, context));
    var networkTarget = _selectNpcActionTarget(npc, 'build_network', context) || contactTarget || allyTarget;
    candidates.push(_makeNpcActionCandidate(npc, 'build_network', networkTarget, 'Build a durable political network', 15, context));
  }
  if ((networkFamilyFit >= 8 || networkTierFit >= 8) && !candidates.some(function(c) { return c.behaviorType === 'build_network'; })) {
    var supportedNetworkTarget = _selectNpcActionTarget(npc, 'build_network', context) || _selectNpcActionTarget(npc, 'private_correspondence', context) || npc.name;
    var supportedBase = networkTierFit >= 8 ? 18 : 16;
    candidates.push(_makeNpcActionCandidate(npc, 'build_network', supportedNetworkTarget, 'Use family or class resources to build a durable network', supportedBase, context));
  }
  if (_hasMilitaryCommand(npc)) {
    candidates.push(_makeNpcActionCandidate(npc, 'train_troops', npc.name, '整训所部，申严军纪', 20, context));
    candidates.push(_makeNpcActionCandidate(npc, 'request_funds', '朝廷', '请给军饷器械，以固军心', 15, context));
    candidates.push(_makeNpcActionCandidate(npc, 'patrol', npc.location || npc.name, 'Patrol troops and secure the district', 13, context));
    candidates.push(_makeNpcActionCandidate(npc, 'fortify', npc.location || npc.name, 'Fortify frontier defenses', 12, context));
  }
  if (npc.location && npc.location !== capital) {
    candidates.push(_makeNpcActionCandidate(npc, 'send_letter', '朝廷', '遣书入京，通报地方情势', 14, context));
    candidates.push(_makeNpcActionCandidate(npc, 'develop_local', npc.jurisdiction || npc.location, 'Develop local administration and livelihood', 13, context));
    var stats = GM.provinceStats && GM.provinceStats[npc.jurisdiction || npc.location];
    if (!stats || Number(stats.unrest || 0) >= 20) {
      candidates.push(_makeNpcActionCandidate(npc, 'relief', npc.jurisdiction || npc.location, 'Organize relief to calm local unrest', 12, context));
    }
  }
  if ((npc.stress || 0) >= 60 && _npcIsAtPlayerLocation(npc)) {
    candidates.push(_makeNpcActionCandidate(npc, 'seek_audience', '天子', '压力积重，请求面圣陈情', 13, context));
  }
  if ((npc.ambition || 50) >= 75 && (npc.loyalty || 50) < 70) {
    var rivalTarget = _selectNpcActionTarget(npc, 'obstruct', context) || '政敌';
    candidates.push(_makeNpcActionCandidate(npc, 'obstruct', rivalTarget, '私下拖延阻挠不利己之事', 11, context));
    candidates.push(_makeNpcActionCandidate(npc, 'slander', rivalTarget, '散布微词，试探朝局风向', 10, context));
  }
  candidates = candidates.filter(function(c) {
    return !_isNpcActionCoolingDown(npc, c.behaviorType, c.target, context, c.id)
      && !_isNpcCandidateBlockedByQueuePressure(c);
  });
  candidates.sort(function(a, b) { return b.score - a.score; });
  return candidates;
}

function _resolveNpcActionCandidate(raw, npc, context) {
  if (!raw || !raw.actionId || !npc) return null;
  var candidates = _buildNpcActionCandidates(npc, context || buildNpcBehaviorContext());
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].id === raw.actionId) return candidates[i];
  }
  return null;
}

function _npcGeneratedId(prefix, npc) {
  if (typeof uid === 'function') return uid();
  return [prefix || 'npc', GM.turn || 0, npc && npc.name || 'unknown', Math.floor(random() * 100000)].join('-');
}

function _npcEnsureArray(obj, key) {
  if (!obj) return [];
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}

function _npcShortText(text, fallback, maxLen) {
  var raw = String(text || fallback || '').replace(/\s+/g, ' ').trim();
  if (!raw) raw = String(fallback || '');
  var n = maxLen || 80;
  return raw.length > n ? raw.slice(0, n) : raw;
}

function _npcRemember(name, text, emotion, importance, who) {
  if (!name || typeof NpcMemorySystem === 'undefined' || !NpcMemorySystem.remember) return;
  try {
    NpcMemorySystem.remember(name, text, emotion || '平', importance || 5, who || '自主行动');
  } catch (_) {}
}

function _recordNpcInternalAction(kind, item) {
  if (!kind || !item) return;
  var history = _npcEnsureArray(GM, '_npcInternalActionHistory');
  var rec = {
    kind: kind,
    from: item.from || item.actor || item.name || '',
    to: item.to || item.target || '',
    intent: _npcShortText(item.intent || item.content || item.subjectLine || item.reason || '', '', 100),
    turn: Number(item.turn || item.createdTurn || GM.turn || 0),
    actionId: item._actionId || item.actionId || item.id || '',
    visibility: item.visibility || item.type || 'internal'
  };
  if (item.amount != null) rec.amount = Number(item.amount) || 0;
  if (item.abilityFit != null) rec.abilityFit = Number(item.abilityFit) || 0;
  if (item.wuchangFit != null) rec.wuchangFit = Number(item.wuchangFit) || 0;
  if (item.economyFit != null) rec.economyFit = Number(item.economyFit) || 0;
  if (item.familyFit != null) rec.familyFit = Number(item.familyFit) || 0;
  if (item.tierFit != null) rec.tierFit = Number(item.tierFit) || 0;
  if (item.resultType || item.outcome) rec.resultType = item.resultType || item.outcome;
  if (item.effects) rec.effects = item.effects;
  var exists = history.some(function(x) {
    if (!x) return false;
    if (rec.actionId && x.actionId === rec.actionId) return true;
    return x.kind === rec.kind && x.from === rec.from && x.to === rec.to && x.turn === rec.turn && x.intent === rec.intent;
  });
  if (!exists) history.push(rec);
  if (history.length > 80) history.splice(0, history.length - 80);
}

function executePetitionBehavior(npc, target, decision, context) {
  var list = _npcEnsureArray(GM, 'memorials');
  var title = _npcShortText(decision.title || decision.subject || decision.intent, npc.name + '上疏言事', 36);
  var content = _npcShortText(decision.content || decision.publicReason || decision.intent, '臣请朝廷垂察。', 260);
  var rec = {
    id: _npcGeneratedId('memorial', npc),
    from: npc.name,
    author: npc.name,
    presenter: npc.name,
    title: title,
    type: decision.petitionType || decision.memorialType || '政务',
    subtype: decision.subtype || '公疏',
    content: content,
    status: 'pending_review',
    reviewed: false,
    turn: GM.turn,
    createdTurn: GM.turn,
    _npcAutonomous: true,
    _actionId: decision.actionId || '',
    reply: ''
  };
  if (decision._npcFundingRequest) rec._npcFundingRequest = decision._npcFundingRequest;
  list.push(rec);
  addEB('奏疏', npc.name + '递上一封奏疏：' + title);
  _npcRemember(npc.name, '自主上疏：' + title, '敬', 5, '朝堂');
}

function executeConspireBehavior(npc, target, decision, context) {
  var list = _npcEnsureArray(GM, '_pendingNpcConspiracies');
  var rec = {
    id: _npcGeneratedId('conspire', npc),
    from: npc.name,
    target: target || '',
    intent: decision.intent || '暗中串联',
    turn: GM.turn,
    _npcAutonomous: true
  };
  list.push(rec);
  _recordNpcInternalAction('conspiracy', rec);
  if (typeof AffinityMap !== 'undefined' && target) {
    try { AffinityMap.add(npc.name, target, 6, '暗中串联'); } catch (_) {}
  }
  addEB('暗流', npc.name + '暗中联络人脉。');
  _npcRemember(npc.name, '暗中串联' + (target ? '·' + target : ''), '密', 6, target || '同党');
  // ★2026-07-01 W3·走漏:所引同谋(target)之亲信圈或有耳闻→风声沿其同党/亲近传出·令第三方隐约知情(确定性·非玩家触发)
  if (typeof TM !== 'undefined' && TM.Gossip && target) TM.Gossip.enqueue({ text: '风传' + npc.name + '暗中结连党羽', subject: npc.name, seeds: [target], importance: 4, budget: 2 });
}

function executeTrainTroopsBehavior(npc, target, decision, context) {
  var armies = _findNpcCommandedArmies(npc);
  armies.forEach(function(army) {
    var oldTraining = typeof army.training === 'number' ? army.training : 0;
    army.training = Math.min(100, oldTraining + 5);
    if (typeof army.morale === 'number') army.morale = Math.min(100, army.morale + 1);
  });
  if (armies.length === 0 && typeof npc.troops === 'number') {
    npc.training = Math.min(100, (npc.training || 0) + 5);
  }
  addEB('军事', npc.name + '整训所部。');
}

function executeSendLetterBehavior(npc, target, decision, context) {
  var letters = _npcEnsureArray(GM, '_pendingNpcLetters');
  letters.push({
    id: _npcGeneratedId('letter', npc),
    from: npc.name,
    to: target || '朝廷',
    type: decision.letterType || 'report',
    urgency: decision.urgency || 'normal',
    subjectLine: decision.title || decision.subject || decision.intent || '',
    content: decision.content || decision.intent || decision.publicReason || '地方近况谨报。',
    suggestion: decision.suggestion || decision.intent || '',
    replyExpected: decision.replyExpected !== false,
    turn: GM.turn,
    _npcAutonomous: true,
    _actionId: decision.actionId || ''
  });
  addEB('书信', npc.name + '遣人送出书信。');
  _npcRemember(npc.name, '遣信上闻：' + _npcShortText(decision.intent, '', 50), '平', 5, '天子');
}

function executePrivateCorrespondenceBehavior(npc, target, decision, context) {
  var list = _npcEnsureArray(GM, '_pendingNpcCorrespondence');
  var to = target || decision.to || decision.targetName || '';
  if (!to || to === npc.name || (typeof findCharByName === 'function' && !findCharByName(to))) {
    to = _selectNpcActionTarget(npc, 'private_correspondence', context || buildNpcBehaviorContext());
  }
  if (!to || to === npc.name) return;
  var rec = {
    id: _npcGeneratedId('npc-corr', npc),
    from: npc.name,
    to: to,
    target: to,
    subjectLine: decision.title || decision.subject || decision.intent || '私下通信',
    content: decision.content || decision.privateMotiv || decision.intent || '私下通书，互探局势。',
    intent: decision.intent || '私下通信',
    visibility: 'private',
    turn: GM.turn,
    _npcAutonomous: true,
    _actionId: decision.actionId || ''
  };
  list.push(rec);
  _recordNpcInternalAction('private_correspondence', rec);
  if (typeof AffinityMap !== 'undefined' && to) {
    try { AffinityMap.add(npc.name, to, 3, '私下通信'); } catch (_) {}
  }
  addEB('私信', npc.name + '私下致书' + (to ? '·' + to : ''));
  _npcRemember(npc.name, '私下通信：' + _npcShortText(decision.intent, to, 50), '密', 5, to || '同僚');
  _npcRemember(to, '收到' + npc.name + '私下来信：' + _npcShortText(decision.intent, '', 50), '密', 5, npc.name);
  // ★2026-07-01 W3·走漏:两人私相往来·旁观/侍从或有察觉→风声沿双方同党/亲近传出
  if (typeof TM !== 'undefined' && TM.Gossip && to) TM.Gossip.enqueue({ text: npc.name + '与' + to + '近日私相往来', subject: npc.name, seeds: [npc.name, to], importance: 3, budget: 2 });
}

function executeSeekAudienceBehavior(npc, target, decision, context) {
  // 阵营闸(2026-07-04)：求见入对/遣书入奏=臣→君·须本朝人物。决策池(_npcLiveCharacters)只滤活人·外邦君主也会跑到此行为——放行则入 _pendingAudiences 喂推演·成「皇太极候于殿外求见」。只拦明确标了异势力者·空 faction 朝臣放行。外邦对朝廷的往来自有使节/国书线。
  if (typeof _tmIsForeignCourtChar === 'function' && _tmIsForeignCourtChar(npc)) return;
  if (!_npcIsAtPlayerLocation(npc)) {
    var redirected = {};
    Object.keys(decision || {}).forEach(function(k) { redirected[k] = decision[k]; });
    redirected.intent = redirected.intent || redirected.reason || redirected.publicReason || '远在外地，遣书入奏';
    redirected.title = redirected.title || '遣书请对';
    redirected.content = redirected.content || redirected.intent || '远在外地，先遣书入奏。';
    redirected.replyExpected = redirected.replyExpected !== false;
    executeSendLetterBehavior(npc, target || '朝廷', redirected, context);
    return;
  }
  var list = _npcEnsureArray(GM, '_pendingAudiences');
  list.push({
    name: npc.name,
    reason: _npcShortText(decision.reason || decision.intent || decision.publicReason, '请见陈事', 120),
    topic: decision.topic || decision.title || '',
    urgency: decision.urgency || 'normal',
    turn: GM.turn,
    _npcAutonomous: true,
    _actionId: decision.actionId || ''
  });
  addEB('求见', npc.name + '请求入对。');
  _npcRemember(npc.name, '请求入对：' + _npcShortText(decision.intent, '', 50), '敬', 5, '天子');
}

function _npcProvinceKeyFor(npc, target) {
  var key = target || (npc && (npc.jurisdiction || npc.location || npc.province)) || '';
  if (key && GM.provinceStats && GM.provinceStats[key]) return key;
  if (npc && npc.location && GM.provinceStats && GM.provinceStats[npc.location]) return npc.location;
  if (GM.provinceStats) {
    var keys = Object.keys(GM.provinceStats);
    if (keys.length) return keys[0];
  }
  return key || '';
}

function _npcEnsureProvinceStats(key) {
  if (!key) return null;
  if (!GM.provinceStats) GM.provinceStats = {};
  if (!GM.provinceStats[key]) GM.provinceStats[key] = { prosperity: 50, unrest: 20, security: 50 };
  return GM.provinceStats[key];
}

function _npcAdjustProvinceStat(key, field, delta, min, max) {
  var stats = _npcEnsureProvinceStats(key);
  if (!stats) return null;
  var old = Number(stats[field] == null ? 0 : stats[field]);
  var lo = min == null ? 0 : min;
  var hi = max == null ? 100 : max;
  stats[field] = Math.max(lo, Math.min(hi, old + delta));
  return stats[field];
}

function _npcEnsureCharResources(npc) {
  if (!npc.resources) npc.resources = {};
  if (!npc.resources.privateWealth) npc.resources.privateWealth = { money: 0, grain: 0, cloth: 0 };
  if (!npc.resources.publicPurse && !npc.resources.publicTreasury) npc.resources.publicPurse = { money: 0, grain: 0, cloth: 0 };
  return npc.resources;
}

function _npcAdjustPrivateWealth(npc, delta, reason) {
  if (!npc) return 0;
  var r = _npcEnsureCharResources(npc);
  var pw = r.privateWealth;
  var old = Number(pw.money || 0);
  pw.money = old + Math.round(delta || 0);
  _npcRemember(npc.name, (reason || '私财变动') + '：' + (delta >= 0 ? '+' : '') + Math.round(delta || 0), '平', 4, '家计');
  return pw.money;
}

function _npcAdjustGuoku(delta) {
  // 国库出入走 FiscalEngine 真账(2026-07-04 收口)·手工三账同步就是两本账的病灶
  delta = Math.round(delta || 0);
  try {
    var _F = (typeof FiscalEngine !== 'undefined' && FiscalEngine) || (typeof window !== 'undefined' && window.FiscalEngine) || null;
    if (_F && delta > 0 && _F.addToGuoku) _F.addToGuoku({ money: delta }, '臣工进献');
    else if (_F && delta < 0 && _F.spendFromGuoku) _F.spendFromGuoku({ money: -delta }, '臣工奏销');
  } catch (_e) {}
  return (GM.guoku && GM.guoku.balance) || 0;
}

function _npcWuchangScore(npc, key, fallback) {
  var w = (npc && (npc.wuchangOverride || npc.wuchang || npc.fiveConstants)) || {};
  var value = w[key];
  if (value == null && key === '仁') value = npc && npc.benevolence;
  if (value == null && key === '智') value = npc && npc.intelligence;
  if (value == null && key === '信') value = npc && npc.integrity;
  if (value == null && key === '义') value = npc && npc.integrity;
  if (value == null && key === '礼') value = npc && npc.charisma;
  value = Number(value);
  return isFinite(value) ? value : (fallback == null ? 50 : fallback);
}

function _npcRecordMoneyAction(kind, npc, target, intent, amount, visibility) {
  var meta = arguments.length > 6 && arguments[6] ? arguments[6] : null;
  var rec = {
    from: npc.name,
    to: target || '',
    intent: intent || '',
    amount: Math.round(amount || 0),
    turn: GM.turn,
    visibility: visibility || 'public'
  };
  if (meta) {
    rec.abilityFit = meta.abilityFit;
    rec.wuchangFit = meta.wuchangFit;
    rec.economyFit = meta.economyFit;
    rec.familyFit = meta.familyFit;
    rec.tierFit = meta.tierFit;
    rec.resultType = meta.resultType || meta.outcome || '';
    rec.effects = meta.effects || null;
  }
  _recordNpcInternalAction(kind, rec);
}

function _npcEnsureExecutionFactors(npc, type, context, decision) {
  decision = decision || {};
  var factors = {
    abilityFit: Number(decision.abilityFit != null ? decision.abilityFit : _npcAbilityActionFit(type, npc)),
    wuchangFit: Number(decision.wuchangFit != null ? decision.wuchangFit : _npcWuchangActionFit(type, npc)),
    economyFit: Number(decision.economyFit != null ? decision.economyFit : _npcEconomyActionFit(type, npc, context || null)),
    ability: _npcAbilityProfile(npc),
    wuchang: _npcWuchangProfile(npc),
    publicPressure: _npcPublicTreasuryPressure(npc, context || null),
    debtPressure: _npcPrivateDebtPressure(npc, context || null),
    shadowPressure: _npcShadowWealthPressure(npc, context || null),
    virtuePull: _npcVirtueEconomyPull(npc, context || null),
    familyFit: Number(decision.familyFit != null ? decision.familyFit : _npcFamilyActionFit(type, npc, context || null)),
    tierFit: Number(decision.tierFit != null ? decision.tierFit : _npcTierActionFit(type, npc, context || null)),
    familyEconomy: _npcFamilyEconomyFor(npc, context || null),
    socialTier: _npcSocialTierFor(npc, context || null)
  };
  if (!isFinite(factors.abilityFit)) factors.abilityFit = 0;
  if (!isFinite(factors.wuchangFit)) factors.wuchangFit = 0;
  if (!isFinite(factors.economyFit)) factors.economyFit = 0;
  if (!isFinite(factors.familyFit)) factors.familyFit = 0;
  if (!isFinite(factors.tierFit)) factors.tierFit = 0;
  decision.abilityFit = factors.abilityFit;
  decision.wuchangFit = factors.wuchangFit;
  decision.economyFit = factors.economyFit;
  decision.familyFit = factors.familyFit;
  decision.tierFit = factors.tierFit;
  decision._executionFactors = factors;
  return factors;
}

function _npcRound(v) {
  var n = Number(v || 0);
  return isFinite(n) ? Math.round(n) : 0;
}

function _npcAdjustPublicPurse(npc, delta, reason) {
  var r = _npcEnsureCharResources(npc);
  if (!r.publicPurse) r.publicPurse = { money: 0, grain: 0, cloth: 0 };
  var publicPurse = r.publicPurse;
  var publicTreasury = r.publicTreasury || null;
  var amount = _npcRound(delta);
  var purseBefore = Number(publicPurse.money || 0);
  publicPurse.money = purseBefore + amount;
  var result = {
    reason: reason || '',
    delta: amount,
    purseBefore: purseBefore,
    purseAfter: publicPurse.money,
    deficitBefore: publicTreasury ? Number(publicTreasury.deficit || 0) : 0,
    deficitAfter: publicTreasury ? Number(publicTreasury.deficit || 0) : 0
  };
  if (publicTreasury) {
    var balanceBefore = Number(publicTreasury.balance != null ? publicTreasury.balance : publicTreasury.money || purseBefore);
    publicTreasury.balance = balanceBefore + amount;
    if (publicTreasury.money != null) publicTreasury.money = Number(publicTreasury.money || 0) + amount;
    if (amount > 0 && publicTreasury.deficit != null) {
      publicTreasury.deficit = Math.max(0, Number(publicTreasury.deficit || 0) - amount);
    } else if (amount < 0 && publicTreasury.balance < 0) {
      publicTreasury.deficit = Number(publicTreasury.deficit || 0) + Math.abs(publicTreasury.balance);
    }
    result.balanceBefore = balanceBefore;
    result.balanceAfter = publicTreasury.balance;
    result.deficitAfter = Number(publicTreasury.deficit || 0);
  }
  return result;
}

function _npcApplyPublicGrant(npc, amount, reason) {
  var grant = Math.max(0, _npcRound(amount));
  if (grant <= 0) return _npcAdjustPublicPurse(npc, 0, reason || '拨款');
  _npcAdjustGuoku(-grant);
  return _npcAdjustPublicPurse(npc, grant, reason || '拨款');
}

function _npcFindFamilyRecord(npc, familyEconomy) {
  var fam = familyEconomy || _npcFamilyEconomyFor(npc, null);
  if (!fam) return null;
  var ids = [fam.clanId, fam.id, fam.clanName, fam.name].filter(Boolean).map(String);
  var containers = [GM && GM.clans, GM && GM.families];
  for (var c = 0; c < containers.length; c++) {
    var src = containers[c];
    if (!src) continue;
    if (Array.isArray(src)) {
      for (var i = 0; i < src.length; i++) {
        var rec = src[i];
        if (rec && ids.indexOf(String(rec.id || rec.key || rec.name || '')) >= 0) return rec;
      }
    } else {
      for (var k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        var item = src[k];
        if (!item) continue;
        if (ids.indexOf(String(k)) >= 0 || ids.indexOf(String(item.id || item.key || item.name || '')) >= 0) return item;
      }
    }
  }
  return null;
}

function _npcAdjustFamilySharedWealth(npc, delta, familyEconomy, reason) {
  var rec = _npcFindFamilyRecord(npc, familyEconomy);
  if (!rec) return { reason: reason || '', delta: 0, before: 0, after: 0, spent: 0 };
  var key = rec.sharedWealth != null ? 'sharedWealth' : (rec.commonWealth != null ? 'commonWealth' : 'sharedWealth');
  var before = Number(rec[key] || 0);
  var amount = _npcRound(delta);
  rec[key] = Math.max(0, before + amount);
  return {
    reason: reason || '',
    clanId: rec.id || rec.key || familyEconomy && familyEconomy.clanId || '',
    clanName: rec.name || familyEconomy && familyEconomy.clanName || '',
    delta: amount,
    before: before,
    after: rec[key],
    spent: amount < 0 ? before - rec[key] : 0
  };
}

function _npcPushExecutionResult(npc, decision, result) {
  if (!npc || !decision || !result) return result;
  var factors = decision._executionFactors || _npcEnsureExecutionFactors(npc, decision.behaviorType, null, decision);
  result = Object.assign({
    turn: GM.turn || 0,
    actor: npc.name,
    behaviorType: decision.behaviorType,
    target: decision.target || '',
    abilityFit: factors.abilityFit,
    wuchangFit: factors.wuchangFit,
    economyFit: factors.economyFit,
    familyFit: factors.familyFit,
    tierFit: factors.tierFit
  }, result);
  decision._executionResult = result;
  npc._lastNpcExecution = result;
  var list = _npcEnsureArray(GM, '_npcExecutionResults');
  list.push(result);
  if (list.length > 120) list.splice(0, list.length - 120);
  return result;
}

function executePalaceIntrigueBehavior(npc, target, decision, context) {
  var to = target || _selectNpcActionTarget(npc, 'palace_intrigue', context || buildNpcBehaviorContext()) || '';
  var rec = {
    id: _npcGeneratedId('palace', npc),
    from: npc.name,
    to: to,
    intent: decision.intent || '经营宫中人情',
    turn: GM.turn,
    visibility: 'hidden',
    _npcAutonomous: true
  };
  _recordNpcInternalAction('palace_intrigue', rec);
  if (to && typeof AffinityMap !== 'undefined') {
    try { AffinityMap.add(npc.name, to, -4, '宫中争宠'); } catch (_) {}
  }
  _npcRemember(npc.name, '宫中经营人情' + (to ? '，牵涉' + to : ''), '密', 6, to || '内廷');
  if (to) _npcRemember(to, npc.name + '在宫中另有动作', '疑', 5, npc.name);
  addEB('宫闱', npc.name + '在内廷经营声势。');
}

function executeCourtPoliticsBehavior(npc, target, decision, context) {
  var to = target || _selectNpcActionTarget(npc, 'court_politics', context || buildNpcBehaviorContext()) || '';
  var rec = {
    id: _npcGeneratedId('court-pol', npc),
    from: npc.name,
    to: to,
    intent: decision.intent || '朝堂攻守',
    turn: GM.turn,
    visibility: 'political',
    _npcAutonomous: true
  };
  _recordNpcInternalAction('court_politics', rec);
  if (to && typeof AffinityMap !== 'undefined') {
    try { AffinityMap.add(npc.name, to, -3, '朝堂政斗'); } catch (_) {}
  }
  _npcRemember(npc.name, '朝堂政斗：' + _npcShortText(decision.intent, to, 60), '谋', 6, to || '朝堂');
  addEB('朝争', npc.name + '在朝堂中试探攻守' + (to ? '·' + to : '') + '。');
}

function executeRecommendBehavior(npc, target, decision, context) {
  var to = target || decision.targetName || _selectNpcActionTarget(npc, 'recommend', context || buildNpcBehaviorContext());
  decision.title = decision.title || 'Personnel recommendation';
  decision.content = decision.content || (npc.name + ' recommends ' + (to || 'a suitable talent') + ' for court attention.');
  decision.petitionType = decision.petitionType || 'Personnel';
  decision.subtype = decision.subtype || 'Recommend';
  executePetitionBehavior(npc, to || 'court', decision, context);
  if (to && typeof AffinityMap !== 'undefined') {
    try { AffinityMap.add(to, npc.name, 5, 'NPC recommendation'); } catch (_) {}
  }
  _npcRemember(npc.name, 'Recommended ' + (to || 'a talent') + ' to court', '敬', 5, to || 'court');
}

function executeImpeachBehavior(npc, target, decision, context) {
  var to = target || decision.targetName || _selectNpcActionTarget(npc, 'impeach', context || buildNpcBehaviorContext());
  decision.title = decision.title || 'Impeachment memorial';
  decision.content = decision.content || (npc.name + ' impeaches ' + (to || 'a rival') + ' for misconduct.');
  decision.petitionType = decision.petitionType || 'Personnel';
  decision.subtype = decision.subtype || 'Impeach';
  executePetitionBehavior(npc, to || 'court', decision, context);
  if (to && typeof AffinityMap !== 'undefined') {
    try { AffinityMap.add(to, npc.name, -8, 'NPC impeachment'); } catch (_) {}
  }
  _recordNpcInternalAction('impeach', {
    from: npc.name,
    to: to || '',
    intent: decision.intent || decision.content,
    turn: GM.turn,
    visibility: 'public'
  });
}

function executePatrolBehavior(npc, target, decision, context) {
  var armies = _findNpcCommandedArmies(npc);
  armies.forEach(function(army) {
    army.morale = Math.min(100, Number(army.morale || 50) + 3);
    army.training = Math.min(100, Number(army.training || 0) + 1);
  });
  var key = _npcProvinceKeyFor(npc, target);
  _npcAdjustProvinceStat(key, 'security', 4, 0, 100);
  addEB('NPC Patrol', npc.name + ' patrols ' + (key || 'his jurisdiction') + '.');
}

function executeFortifyBehavior(npc, target, decision, context) {
  var armies = _findNpcCommandedArmies(npc);
  armies.forEach(function(army) {
    army.fortification = Math.min(100, Number(army.fortification || 0) + 5);
    army.morale = Math.min(100, Number(army.morale || 50) + 1);
  });
  var key = _npcProvinceKeyFor(npc, target);
  _npcAdjustProvinceStat(key, 'security', 5, 0, 100);
  addEB('NPC Fortify', npc.name + ' strengthens defenses at ' + (key || 'the frontier') + '.');
}

// Economy-aware NPC execution handlers.
function executeRequestFundsBehavior(npc, target, decision, context) {
  var factors = _npcEnsureExecutionFactors(npc, 'request_funds', context, decision);
  var civilFiscal = !_hasMilitaryCommand(npc) && factors.publicPressure > 0;
  var requestedAmount = Math.max(800, Math.round(600 + factors.economyFit * 170 + factors.abilityFit * 80 + factors.wuchangFit * 60));
  decision._npcFundingRequest = {
    civilFiscal: !!civilFiscal,
    requestedAmount: requestedAmount,
    abilityFit: factors.abilityFit,
    wuchangFit: factors.wuchangFit,
    economyFit: factors.economyFit,
    publicPressure: factors.publicPressure,
    debtPressure: factors.debtPressure
  };
  decision.title = decision.title || (civilFiscal ? 'NPC civil public-fund request' : 'NPC military fund request');
  decision.content = decision.content || decision.intent || (civilFiscal ? 'Requests court funds to repair the attached public treasury.' : 'Requests supplies and funds for troops.');
  decision.petitionType = decision.petitionType || (civilFiscal ? 'Finance' : 'Military');
  decision.subtype = decision.subtype || (civilFiscal ? 'PublicPurse' : 'MilitaryFunds');
  executePetitionBehavior(npc, target || 'court', decision, context);
  if (civilFiscal) {
    var grant = Math.min(requestedAmount, Math.max(600, Math.round(500 + factors.publicPressure * 210 + factors.abilityFit * 65 + factors.wuchangFit * 45)));
    var purse = _npcApplyPublicGrant(npc, grant, 'npc-civil-public-fund-grant');
    _npcRecordMoneyAction('request_funds', npc, target || 'court', decision.intent || 'request public funds', grant, 'public', {
      abilityFit: factors.abilityFit,
      wuchangFit: factors.wuchangFit,
      economyFit: factors.economyFit,
      familyFit: factors.familyFit,
      tierFit: factors.tierFit,
      resultType: 'civil_funds',
      effects: purse
    });
    _npcPushExecutionResult(npc, decision, {
      outcome: 'civil_funds',
      grant: grant,
      publicPurse: purse
    });
  } else {
    _npcPushExecutionResult(npc, decision, {
      outcome: 'memorial_only',
      requestedAmount: requestedAmount
    });
  }
}

function executeOfficeDutyBehavior(npc, target, decision, context) {
  var factors = _npcEnsureExecutionFactors(npc, 'office_duty', context, decision);
  var office = findNpcOffice(npc.name);
  var key = _npcProvinceKeyFor(npc, target || npc.jurisdiction || npc.location);
  var a = factors.ability || _npcAbilityProfile(npc);
  var w = factors.wuchang || _npcWuchangProfile(npc);
  var admin = Number(a.administration || npc.administration || npc.management || npc.intelligence || 50);
  var manage = Number(a.management || npc.management || npc.administration || 50);
  var integrity = Number(npc.integrity || _npcAvg([w.yi, w.xin]) || 50);
  var ability = _npcAvg([admin, manage, a.intelligence, w.zhi, w.xin, w.yi]);
  var corruptPressure = Math.max(0, Number(npc.ambition || 50) - 60)
    + Math.max(0, 58 - integrity)
    + Math.max(0, 55 - Number(w.xin || 50))
    + Math.max(0, 55 - Number(w.yi || 50))
    + factors.shadowPressure * 1.4;
  var amount = Math.round(800 + ability * 28 + factors.abilityFit * 42 + factors.economyFit * 55);
  var intent = decision.intent || (office ? (office.deptName + office.posName + ' office duty') : 'office duty');
  if (corruptPressure > 45) {
    var hiddenGain = Math.round(amount * (0.16 + Math.min(0.35, factors.shadowPressure / 90) + Math.max(0, 55 - integrity) / 260));
    var purseLossAmount = Math.max(120, Math.round(amount * (0.34 + Math.min(0.22, corruptPressure / 420))));
    var r = _npcEnsureCharResources(npc);
    r.hiddenWealth = Number(r.hiddenWealth || 0) + hiddenGain;
    _npcAdjustGuoku(-purseLossAmount);
    var corruptPurse = _npcAdjustPublicPurse(npc, -purseLossAmount, 'npc-corrupt-office-duty');
    _npcAdjustPrivateWealth(npc, Math.round(hiddenGain * 0.45), 'npc-corrupt-private-gain');
    if (GM.corruption) {
      GM.corruption.trueIndex = Math.min(100, Number(GM.corruption.trueIndex || 0) + 0.4);
      if (GM.corruption.subDepts && GM.corruption.subDepts.provincial) {
        GM.corruption.subDepts.provincial.true = Math.min(100, Number(GM.corruption.subDepts.provincial.true || 0) + 0.5);
      }
    }
    var corruptResult = _npcPushExecutionResult(npc, decision, {
      outcome: 'corrupt',
      amount: -purseLossAmount,
      hiddenGain: hiddenGain,
      publicPurse: corruptPurse
    });
    _npcRecordMoneyAction('office_duty', npc, target || key, intent + ':corrupt', -purseLossAmount, 'hidden', {
      abilityFit: factors.abilityFit,
      wuchangFit: factors.wuchangFit,
      economyFit: factors.economyFit,
      familyFit: factors.familyFit,
      tierFit: factors.tierFit,
      resultType: corruptResult.outcome,
      effects: corruptResult
    });
    addEB('NPC office duty', npc.name + ' abuses office funds.');
  } else if (ability >= 66 || factors.abilityFit + factors.wuchangFit >= 18) {
    var publicGain = Math.max(180, Math.round(amount * (0.32 + factors.abilityFit / 120 + factors.wuchangFit / 150 + factors.economyFit / 190)));
    _npcAdjustGuoku(publicGain);
    var cleanPurse = _npcAdjustPublicPurse(npc, publicGain, 'npc-clean-office-duty');
    _npcAdjustProvinceStat(key, 'prosperity', 2 + Math.floor(factors.abilityFit / 9), 0, 100);
    _npcAdjustProvinceStat(key, 'corruption', -1 - Math.floor(factors.wuchangFit / 14), 0, 100);
    var cleanResult = _npcPushExecutionResult(npc, decision, {
      outcome: 'clean',
      amount: publicGain,
      publicPurse: cleanPurse
    });
    _npcRecordMoneyAction('office_duty', npc, target || key, intent + ':clean', publicGain, 'public', {
      abilityFit: factors.abilityFit,
      wuchangFit: factors.wuchangFit,
      economyFit: factors.economyFit,
      familyFit: factors.familyFit,
      tierFit: factors.tierFit,
      resultType: cleanResult.outcome,
      effects: cleanResult
    });
    addEB('NPC office duty', npc.name + ' replenishes public funds.');
  } else {
    var routineCost = Math.max(80, Math.round(amount * 0.28));
    _npcAdjustGuoku(-routineCost);
    var routinePurse = _npcAdjustPublicPurse(npc, -routineCost, 'npc-routine-office-duty');
    _npcAdjustProvinceStat(key, 'unrest', -1, 0, 100);
    var routineResult = _npcPushExecutionResult(npc, decision, {
      outcome: 'routine',
      amount: -routineCost,
      publicPurse: routinePurse
    });
    _npcRecordMoneyAction('office_duty', npc, target || key, intent + ':routine', -routineCost, 'public', {
      abilityFit: factors.abilityFit,
      wuchangFit: factors.wuchangFit,
      economyFit: factors.economyFit,
      familyFit: factors.familyFit,
      tierFit: factors.tierFit,
      resultType: routineResult.outcome,
      effects: routineResult
    });
    addEB('NPC office duty', npc.name + ' spends public funds on routine affairs.');
  }
}

function executePrivateLifeBehavior(npc, target, decision, context) {
  var factors = _npcEnsureExecutionFactors(npc, 'private_life', context, decision);
  var a = factors.ability || _npcAbilityProfile(npc);
  var w = factors.wuchang || _npcWuchangProfile(npc);
  var r = _npcEnsureCharResources(npc);
  var pw = r.privateWealth;
  var moneyBefore = Number(pw.money || 0);
  var debtBefore = Number(pw.debt || Math.max(0, -moneyBefore));
  var base = (Number(a.management || 50) - 48) * 18 + (Number(a.intelligence || 50) - 50) * 6 + (Number(w.li || 50) - 50) * 4;
  var debtRelief = factors.debtPressure > 0 ? 140 + factors.debtPressure * 42 + factors.economyFit * 28 : 0;
  var tier = factors.socialTier || {};
  var tierKey = String(tier.key || '').toLowerCase();
  var tierParams = tier.classParams || {};
  var commerceYield = 0;
  if (tierKey === 'merchant') {
    commerceYield = Math.round(Math.max(0, Number(pw.commerce || 0)) * (Number(tierParams.commerceYield || 0.08)) / 3 + factors.tierFit * 18);
  }
  var tierOutcome = commerceYield > 0 ? { type: tierKey, commerceYield: commerceYield } : null;
  var familySupport = null;
  if (debtBefore > 0 && factors.familyEconomy && Number(factors.familyEconomy.sharedWealth || 0) > 0) {
    var familyAid = Math.min(Math.round(debtBefore * 0.35), Math.round(Number(factors.familyEconomy.sharedWealth || 0) * 0.04), 900);
    if (familyAid > 0) familySupport = _npcAdjustFamilySharedWealth(npc, -familyAid, factors.familyEconomy, 'npc-family-debt-support');
  }
  var delta = Math.round(base + debtRelief + commerceYield + (familySupport ? familySupport.spent : 0));
  if (Math.abs(delta) < 80) delta = Number(a.management || 50) >= 55 ? 120 : -120;
  var hiddenGain = 0;
  if (delta > 0 && (Number(w.yi || 50) < 35 || Number(w.xin || 50) < 35) && factors.shadowPressure >= 8) {
    hiddenGain = Math.round(delta * 0.28);
    r.hiddenWealth = Number(r.hiddenWealth || 0) + hiddenGain;
    delta -= hiddenGain;
  }
  var moneyAfter = _npcAdjustPrivateWealth(npc, delta, delta >= 0 ? 'npc-private-life-gain' : 'npc-private-life-cost');
  if (delta > 0 && debtBefore > 0) {
    pw.debt = Math.max(0, debtBefore - delta);
  }
  var result = _npcPushExecutionResult(npc, decision, {
    outcome: 'private_life',
    delta: delta,
    hiddenGain: hiddenGain,
    familySupport: familySupport,
    tierOutcome: tierOutcome,
    moneyBefore: moneyBefore,
    moneyAfter: moneyAfter,
    debtBefore: debtBefore,
    debtAfter: Number(pw.debt || 0)
  });
  _npcRecordMoneyAction('private_life', npc, target || npc.name, decision.intent || 'private life', delta, 'private', {
    abilityFit: factors.abilityFit,
    wuchangFit: factors.wuchangFit,
    economyFit: factors.economyFit,
    familyFit: factors.familyFit,
    tierFit: factors.tierFit,
    resultType: result.outcome,
    effects: result
  });
  addEB('NPC private life', npc.name + (delta >= 0 ? ' improves private finances.' : ' spends private wealth.'));
}

function executeDevelopLocalBehavior(npc, target, decision, context) {
  var factors = _npcEnsureExecutionFactors(npc, 'develop_local', context, decision);
  var key = _npcProvinceKeyFor(npc, target);
  var cost = Math.max(260, Math.round(350 + factors.abilityFit * 35 + factors.wuchangFit * 18));
  var purse = _npcAdjustPublicPurse(npc, -cost, 'npc-develop-local-investment');
  var prosperityGain = Math.max(5, Math.round(4 + factors.abilityFit / 7 + factors.wuchangFit / 12));
  var unrestDrop = Math.max(1, Math.round(1 + factors.wuchangFit / 18));
  _npcAdjustProvinceStat(key, 'prosperity', prosperityGain, 0, 100);
  _npcAdjustProvinceStat(key, 'unrest', -unrestDrop, 0, 100);
  var result = _npcPushExecutionResult(npc, decision, {
    outcome: 'develop_local',
    cost: cost,
    prosperityGain: prosperityGain,
    unrestDrop: unrestDrop,
    publicPurse: purse
  });
  _npcRecordMoneyAction('develop_local', npc, key, decision.intent || 'develop local', -cost, 'public', {
    abilityFit: factors.abilityFit,
    wuchangFit: factors.wuchangFit,
    economyFit: factors.economyFit,
    familyFit: factors.familyFit,
    tierFit: factors.tierFit,
    resultType: result.outcome,
    effects: result
  });
  addEB('NPC Local', npc.name + ' develops ' + (key || 'local administration') + '.');
}

function executeReliefBehavior(npc, target, decision, context) {
  var factors = _npcEnsureExecutionFactors(npc, 'relief', context, decision);
  var key = _npcProvinceKeyFor(npc, target);
  var cost = Math.max(320, Math.round(420 + factors.abilityFit * 30 + factors.wuchangFit * 42 + factors.economyFit * 18));
  var purse = _npcAdjustPublicPurse(npc, -cost, 'npc-relief-funds');
  var unrestDrop = Math.max(6, Math.round(5 + factors.abilityFit / 6 + factors.wuchangFit / 8 + factors.economyFit / 10));
  var prosperityGain = Math.max(1, Math.round(1 + factors.wuchangFit / 16));
  _npcAdjustProvinceStat(key, 'unrest', -unrestDrop, 0, 100);
  _npcAdjustProvinceStat(key, 'prosperity', prosperityGain, 0, 100);
  var result = _npcPushExecutionResult(npc, decision, {
    outcome: 'relief',
    cost: cost,
    unrestDrop: unrestDrop,
    prosperityGain: prosperityGain,
    publicPurse: purse
  });
  _npcRecordMoneyAction('relief', npc, key, decision.intent || 'relief', -cost, 'public', {
    abilityFit: factors.abilityFit,
    wuchangFit: factors.wuchangFit,
    economyFit: factors.economyFit,
    familyFit: factors.familyFit,
    tierFit: factors.tierFit,
    resultType: result.outcome,
    effects: result
  });
  addEB('NPC Relief', npc.name + ' organizes relief at ' + (key || 'his jurisdiction') + '.');
}

function executeBuildNetworkBehavior(npc, target, decision, context) {
  var factors = _npcEnsureExecutionFactors(npc, 'build_network', context, decision);
  var to = target || decision.targetName || _selectNpcActionTarget(npc, 'build_network', context || buildNpcBehaviorContext()) || '';
  var familySupport = null;
  if (factors.familyEconomy && factors.familyEconomy.isHead && Number(factors.familyEconomy.sharedWealth || 0) > 0) {
    var networkCost = Math.min(Math.round(Number(factors.familyEconomy.sharedWealth || 0) * 0.06), Math.round(240 + factors.familyFit * 55 + factors.tierFit * 24), 2400);
    if (networkCost > 0) familySupport = _npcAdjustFamilySharedWealth(npc, -networkCost, factors.familyEconomy, 'npc-build-network-family-support');
  }
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.recordPlan) {
    TM.NPC.ActionLedger.recordPlan({
      actor: npc.name,
      type: 'build_network',
      target: to,
      intent: decision.intent || decision.action || 'Build a court network',
      source: 'npc-autonomy'
    }, { GM: GM, progress: 1 });
  } else {
    var plans = _npcEnsureArray(GM, '_npcPlans');
    plans.push({ id: _npcGeneratedId('npc-plan', npc), actor: npc.name, type: 'build_network', target: to, intent: decision.intent || '', createdTurn: GM.turn, updatedTurn: GM.turn, progress: 1, status: 'active' });
  }
  if (to && typeof AffinityMap !== 'undefined') {
    try { AffinityMap.add(npc.name, to, 4, 'NPC network building'); } catch (_) {}
  }
  _recordNpcInternalAction('plan', {
    from: npc.name,
    to: to,
    intent: decision.intent || 'Build a court network',
    turn: GM.turn,
    visibility: 'internal',
    abilityFit: factors.abilityFit,
    wuchangFit: factors.wuchangFit,
    economyFit: factors.economyFit,
    familyFit: factors.familyFit,
    tierFit: factors.tierFit
  });
  _npcPushExecutionResult(npc, decision, {
    outcome: 'build_network',
    familySupport: familySupport,
    tierOutcome: factors.socialTier ? { type: factors.socialTier.key || '', classParams: factors.socialTier.classParams || null } : null,
    target: to
  });
  addEB('NPC Plan', npc.name + ' begins building a network' + (to ? ' with ' + to : '') + '.');
}

function executeObstructBehavior(npc, target, decision, context) {
  var moves = _npcEnsureArray(GM, '_npcHiddenMoves');
  var rec = {
    id: _npcGeneratedId('obstruct', npc),
    actor: npc.name,
    target: target || '',
    intent: decision.intent || '私下阻挠',
    turn: GM.turn,
    visibility: 'hidden',
    _npcAutonomous: true
  };
  moves.push(rec);
  _recordNpcInternalAction('hidden_move', rec);
  addEB('阻挠', npc.name + '私下阻挠' + (target ? '·' + target : ''));
  _npcRemember(npc.name, '私下阻挠：' + _npcShortText(decision.intent, target, 50), '密', 5, target || '局中人');
}

function executeSlanderBehavior(npc, target, decision, context) {
  var targetChar = findCharByName(target);
  if (targetChar && typeof adjustCharacterLoyalty === 'function') {
    adjustCharacterLoyalty(targetChar, -5, npc.name + '谗言攻讦', { source: 'npc-decision-slander', actor: npc.name });
  } else if (targetChar) {
    targetChar.loyalty = Math.max(0, (targetChar.loyalty || 50) - 5);
  }
  if (typeof AffinityMap !== 'undefined' && target) {
    try { AffinityMap.add(target, npc.name, -8, '遭谗言'); } catch (_) {}
  }
  _recordNpcInternalAction('hidden_move', {
    id: _npcGeneratedId('slander', npc),
    actor: npc.name,
    target: target || '',
    intent: decision.intent || '谗言攻讦',
    turn: GM.turn,
    visibility: 'hidden'
  });
  addEB('谗言', npc.name + '议及' + (target || '他人'));
  _npcRemember(npc.name, '攻讦' + (target || '他人') + '：' + _npcShortText(decision.intent, '', 50), '密', 5, target || '他人');
  // ★2026-07-01 W3·走漏:谗言天然扩散·slander者的同党圈会听到并附和→对 target 的恶评传开(经记恨者转述更走样)
  if (typeof TM !== 'undefined' && TM.Gossip && target) TM.Gossip.enqueue({ text: '有人暗指' + target + '之过', subject: target, seeds: [npc.name], importance: 3, budget: 3 });
}

// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】NPC 行为系统·AI 驱动(原§2393-末) → tm-npc-decision-ai-driven.js
//  （载于本文件之后）·保序切割·全局名跨文件解析
// ═══════════════════════════════════════════════════════════════════════
