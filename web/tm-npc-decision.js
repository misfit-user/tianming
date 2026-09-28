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
  var ledger=TM.NPC.ActionLedger, lease=ledger.capture(), budget=ledger.state(GM);
  if(!npc || npc.isPlayer || !P.ai || !P.ai.key)return null;
  if(budget.modelTurn!==GM.turn){budget.modelTurn=GM.turn;budget.modelCalls=0;}
  if(budget.modelCalls>=3)return null;
  var decisions=await batchNpcDecisions([npc],buildNpcBehaviorContext(npc),{privateActorId:npc.id});
  if(!ledger.current(lease))return null;
  var decision=decisions[0]||null;
  if(decision){ledger.prepare(decision,GM);Object.defineProperty(decision,'_npcLease',{value:lease,enumerable:false});}
  return decision;
}

// 构建 NPC 决策提示词
function buildNpcDecisionPrompt(npc, context) {
  return '请仅依据本人所知选择下一步，承诺与实施分开。返回 JSON 决策。\n'+JSON.stringify(buildNpcBehaviorContext(npc));
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
      return TM.NPC.ActionLedger.execute(npc, decision, context, handler);
    } else if (decision.behaviorType !== 'none') {
      _dbg('[NPC] 未注册的行为类型：' + decision.behaviorType);
    }
  }
};

// 注册内置行为
NpcBehaviorRegistry.register('appoint', function(npc, target, d, ctx) { return executeAppointBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('dismiss', function(npc, target, d, ctx) { return executeDismissBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('transfer', function(npc, target, d, ctx) { return executeTransferBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('reward', function(npc, target, d, ctx) { return executeRewardBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('punish', function(npc, target, d, ctx) { return executePunishBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('declare_war', function(npc, target, d, ctx) { return executeDeclareWarBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('request_loyalty', function(npc, target, d, ctx) { return executeRequestLoyaltyBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('reform', function(npc, target, d, ctx) { return executeReformBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('petition', function(npc, target, d, ctx) { return executePetitionBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('conspire', function(npc, target, d, ctx) { return executeConspireBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('train_troops', function(npc, target, d, ctx) { return executeTrainTroopsBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('send_letter', function(npc, target, d, ctx) { return executeSendLetterBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('seek_audience', function(npc, target, d, ctx) { return executeSeekAudienceBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('request_funds', function(npc, target, d, ctx) { return executeRequestFundsBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('obstruct', function(npc, target, d, ctx) { return executeObstructBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('slander', function(npc, target, d, ctx) { return executeSlanderBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('private_correspondence', function(npc, target, d, ctx) { return executePrivateCorrespondenceBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('recommend', function(npc, target, d, ctx) { return executeRecommendBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('impeach', function(npc, target, d, ctx) { return executeImpeachBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('patrol', function(npc, target, d, ctx) { return executePatrolBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('fortify', function(npc, target, d, ctx) { return executeFortifyBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('develop_local', function(npc, target, d, ctx) { return executeDevelopLocalBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('relief', function(npc, target, d, ctx) { return executeReliefBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('build_network', function(npc, target, d, ctx) { return executeBuildNetworkBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('office_duty', function(npc, target, d, ctx) { return executeOfficeDutyBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('private_life', function(npc, target, d, ctx) { return executePrivateLifeBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('palace_intrigue', function(npc, target, d, ctx) { return executePalaceIntrigueBehavior(npc, target, d, ctx); });
NpcBehaviorRegistry.register('court_politics', function(npc, target, d, ctx) { return executeCourtPoliticsBehavior(npc, target, d, ctx); });


// Existing interpersonal names use the same request/response ledger.
['private_visit','seek_instruction','assist','commission','invite_banquet','correspond_secret','share_intelligence','petition_jointly','reconcile','mediate','mentor','duel_poetry','entrust_orphan','propose_match','guarantee','form_clique','master_disciple','marriage_alliance','farewell_feast','welcome_feast'].forEach(function(type) {
  NpcBehaviorRegistry.register(type, function(npc,target,d) { return TM.NPC.ActionLedger.social(npc,d); });
});
NpcBehaviorRegistry.register('gift_present',function(npc,target,d){return _npcReward(npc,target,d);});

// ===== 执行层 =====

// NPC 行为执行（通过注册表分发）

// 执行任命行为
function executeAppointBehavior(npc, target, decision, context) {
  return _npcPersonnel(npc, target, decision, context);
}

// 执行罢免行为
function executeDismissBehavior(npc, target, decision, context) {
  return _npcPersonnel(npc, target, decision, context);
}

// 执行转任行为
function executeTransferBehavior(npc, target, decision, context) {
  return _npcPersonnel(npc, target, decision, context);
}

// 执行赏赐行为
function executeRewardBehavior(npc, target, decision, context) {
  return _npcReward(npc, target, decision, context);
}

// 执行惩罚行为
function executePunishBehavior(npc, target, decision, context) {
  return _npcPunish(npc, target, decision, context);
}

// 执行宣战行为
function executeDeclareWarBehavior(npc, target, decision, context) {
  return _npcWar(npc, target, decision, context);
}

// 执行要求效忠行为
function executeRequestLoyaltyBehavior(npc, target, decision, context) {
  return TM.NPC.ActionLedger.social(npc, decision);
}

// 执行改革行为
function executeReformBehavior(npc, target, decision, context) {
  return _npcReform(npc, target, decision, context);
}

function _npcActionUid(npc, type, target) {
  return ['npcact', npc && npc.name || 'unknown', type || 'none', target || ''].join(':');
}

function _findNpcCommandedArmies(npc) {
  if (!npc || !Array.isArray(GM.armies)) return [];
  var name = npc.name;
  var aliases = ['commander', 'commanderName', 'commanderDisplayName', 'commander_name', 'general', 'generalName', 'leader', 'leaderName', 'commandingOfficer', 'chiefCommander', 'chiefGeneral', 'mainGeneral'];
  return GM.armies.filter(function(army) {
    if (!army) return false;
    if (army.commanderId != null) return String(army.commanderId) === String(npc.id);
    if (TM.NPC.ActionLedger.findChar(name, GM) !== npc) return false;
    return aliases.some(function(k) { return army[k] === name; });
  });
}

function _hasMilitaryCommand(npc) { return _findNpcCommandedArmies(npc).length > 0; }

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
  if (!npc) return '';
  var publicOnly=context && context.publicOnly;
  var people=(GM.chars||[]).filter(function(c){return c&&c!==npc&&c.alive!==false&&!c.dead&&!c.hidden&&(!c._missing)&&(!c.visibility||c.visibility==='public'||c.location===npc.location);});
  return people.map(function(c){
    var known=(c.location&&c.location===npc.location)||publicOnly||npc.relations&&npc.relations[c.name]||npc._impressions&&npc._impressions[c.name];
    var score=(c.location&&c.location===npc.location?10:0)+(c.faction&&c.faction===npc.faction?5:0);
    if(!publicOnly&&known)score+=_npcFavorToward(npc,c.name)*(type==='impeach'||type==='slander'?-0.2:0.2);
    return {c:c,score:known?score:-1000};
  }).filter(function(r){return r.score>-1000;}).sort(function(a,b){return b.score-a.score||String(a.c.id).localeCompare(String(b.c.id));}).map(function(r){return r.c.name;})[0]||'';
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
  if (!actionId || /^npcact:|^npccard:/.test(actionId)) return false;
  var receipts=TM.NPC.ActionLedger.state(GM).receipts;
  return !!receipts[JSON.stringify([actionId,'execute'])];
}

function _recordNpcActionLedger(npc, decision) {
  var receipt=decision&&decision._executionResult;
  if(!npc||!receipt||!receipt.actionId)return null;
  return TM.NPC.ActionLedger.record(Object.assign({},receipt,{characterId:npc.id,status:receipt.outcome}),{markHandled:false});
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
  if (!raw || !(raw.cardId || raw.actionId) || !npc) return null;
  var candidates = _buildNpcActionCandidates(npc, context || buildNpcBehaviorContext());
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].id === (raw.cardId || raw.actionId)) return candidates[i];
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
    actorId: item.actorId || item.fromId || '', targetId: item.targetId || item.toId || '',
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
  _npcEvent('奏疏', npc.name + '递上一封奏疏：' + title);
  _npcRemember(npc.name, '自主上疏：' + title, '敬', 5, '朝堂');
  return _npcResult('submitted', '奏疏已提交，待批复', [{ kind: 'memorial', id: rec.id }]);
}

function executeConspireBehavior(npc, target, decision, context) {
  if (target) return TM.NPC.ActionLedger.social(npc, decision);
  var plan = TM.NPC.ActionLedger.recordPlan({ id: decision.actionId, actor: npc.name, actorId: npc.id, type: decision.behaviorType, intent: decision.intent, stage: 'needs_target' }, { GM: GM });
  return plan ? _npcResult('submitted', '待明确接触对象', [{ kind: 'plan', id: plan.id }]) : _npcResult('blocked', 'invalid_plan');
}

function executeTrainTroopsBehavior(npc, target, decision, context) {
  return _npcMilitaryWork(npc, decision);
}

function executeSendLetterBehavior(npc, target, decision, context) {
  var recipient=_npcTarget(decision);
  if (decision.planId || recipient && !recipient.isPlayer || decision.task) return TM.NPC.ActionLedger.social(npc,decision);
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
  _npcEvent('书信', npc.name + '遣人送出书信。');
  _npcRemember(npc.name, '遣信上闻：' + _npcShortText(decision.intent, '', 50), '平', 5, '天子');
  return _npcResult('submitted', '信件已寄出，待送达', [{ kind: 'letter_queue', id: letters[letters.length - 1].id }]);
}

function executePrivateCorrespondenceBehavior(npc, target, decision, context) {
  return TM.NPC.ActionLedger.social(npc, decision);
}

function executeSeekAudienceBehavior(npc, target, decision, context) {
  // 阵营闸(2026-07-04)：求见入对/遣书入奏=臣→君·须本朝人物。决策池(_npcLiveCharacters)只滤活人·外邦君主也会跑到此行为——放行则入 _pendingAudiences 喂推演·成「皇太极候于殿外求见」。只拦明确标了异势力者·空 faction 朝臣放行。外邦对朝廷的往来自有使节/国书线。
  if (typeof _tmIsForeignCourtChar === 'function' && _tmIsForeignCourtChar(npc)) return _npcResult('blocked', 'foreign_court');
  if (!_npcIsAtPlayerLocation(npc)) {
    var redirected = {};
    Object.keys(decision || {}).forEach(function(k) { redirected[k] = decision[k]; });
    redirected.intent = redirected.intent || redirected.reason || redirected.publicReason || '远在外地，遣书入奏';
    redirected.title = redirected.title || '遣书请对';
    redirected.content = redirected.content || redirected.intent || '远在外地，先遣书入奏。';
    redirected.replyExpected = redirected.replyExpected !== false;
    return executeSendLetterBehavior(npc, target || '朝廷', redirected, context);
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
  _npcEvent('求见', npc.name + '请求入对。');
  _npcRemember(npc.name, '请求入对：' + _npcShortText(decision.intent, '', 50), '敬', 5, '天子');
  return _npcResult('submitted', '求见已登记，待接见', [{ kind: 'audience', id: decision.actionId }]);
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

function _npcAdjustPrivateWealth(npc, delta, reason) { return _npcResult('blocked','counterparty_operation_required'); }

function _npcAdjustGuoku(delta) { return _npcResult('blocked','source_account_operation_required'); }

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
    abilityFit: Number(_npcAbilityActionFit(type, npc)),
    wuchangFit: Number(_npcWuchangActionFit(type, npc)),
    economyFit: Number(_npcEconomyActionFit(type, npc, context || null)),
    ability: _npcAbilityProfile(npc),
    wuchang: _npcWuchangProfile(npc),
    publicPressure: _npcPublicTreasuryPressure(npc, context || null),
    debtPressure: _npcPrivateDebtPressure(npc, context || null),
    shadowPressure: _npcShadowWealthPressure(npc, context || null),
    virtuePull: _npcVirtueEconomyPull(npc, context || null),
    familyFit: Number(_npcFamilyActionFit(type, npc, context || null)),
    tierFit: Number(_npcTierActionFit(type, npc, context || null)),
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
  return _npcResult('blocked', 'public_account_operation_required');
}

function _npcApplyPublicGrant(npc, amount, reason, decision) {
  if (!decision) return _npcResult('blocked', 'authorization_and_accounts_required');
  return _npcTransferPublic(npc, decision);
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
  decision._executionResult = result;
  return result;
}

function executePalaceIntrigueBehavior(npc, target, decision, context) {
  if (target) return TM.NPC.ActionLedger.social(npc, decision);
  var plan = TM.NPC.ActionLedger.recordPlan({ id: decision.actionId, actor: npc.name, actorId: npc.id, type: decision.behaviorType, intent: decision.intent, stage: 'needs_target' }, { GM: GM });
  return plan ? _npcResult('submitted', '待明确接触对象', [{ kind: 'plan', id: plan.id }]) : _npcResult('blocked', 'invalid_plan');
}

function executeCourtPoliticsBehavior(npc, target, decision, context) {
  if (target) return TM.NPC.ActionLedger.social(npc, decision);
  var plan = TM.NPC.ActionLedger.recordPlan({ id: decision.actionId, actor: npc.name, actorId: npc.id, type: decision.behaviorType, intent: decision.intent, stage: 'needs_target' }, { GM: GM });
  return plan ? _npcResult('submitted', '待明确接触对象', [{ kind: 'plan', id: plan.id }]) : _npcResult('blocked', 'invalid_plan');
}

function executeRecommendBehavior(npc, target, decision, context) {
  if (!_npcTarget(decision)) return _npcResult('blocked', 'unknown_target');
  decision.title = decision.title || "荐举人才";
  return executePetitionBehavior(npc, target, decision, context);
}

function executeImpeachBehavior(npc, target, decision, context) {
  if (!_npcTarget(decision)) return _npcResult('blocked', 'unknown_target');
  decision.title = decision.title || "请核失职";
  return executePetitionBehavior(npc, target, decision, context);
}

function executePatrolBehavior(npc, target, decision, context) {
  return _npcMilitaryWork(npc, decision);
}

function executeFortifyBehavior(npc, target, decision, context) {
  return _npcMilitaryWork(npc, decision);
}

// Economy-aware NPC execution handlers.
function executeRequestFundsBehavior(npc, target, decision, context) {
  decision.petitionType = '财政';
  decision.title = decision.title || '请拨经费';
  decision._npcFundingRequest = { requestedAmount: Number.isFinite(Number(decision.amount)) && Number(decision.amount) > 0 ? Number(decision.amount) : null, actionId: decision.actionId };
  return executePetitionBehavior(npc, target || '朝廷', decision, context);
}

function executeOfficeDutyBehavior(npc, target, decision, context) {
  return _npcConcreteDuty(npc, decision, context);
}

function executePrivateLifeBehavior(npc, target, decision, context) {
  if (decision.planId || target && target !== npc.name) return TM.NPC.ActionLedger.social(npc, decision);
  return _npcResult('noop', '休息或料理家务；无已核验收支');
}

function executeDevelopLocalBehavior(npc, target, decision, context) {
  decision.title = decision.title || "地方营建协办";
  return _npcConcreteDuty(npc, decision, context);
}

function executeReliefBehavior(npc, target, decision, context) {
  decision.title = decision.title || "赈济协办";
  return _npcConcreteDuty(npc, decision, context);
}

function executeBuildNetworkBehavior(npc, target, decision, context) {
  return TM.NPC.ActionLedger.social(npc, decision);
}

function executeObstructBehavior(npc,target,decision,context) { return _npcCovertIntent(npc,target,decision); }

function executeSlanderBehavior(npc,target,decision,context) { return _npcCovertIntent(npc,target,decision); }

// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】NPC 行为系统·AI 驱动(原§2393-末) → tm-npc-decision-ai-driven.js
//  （载于本文件之后）·保序切割·全局名跨文件解析
// ═══════════════════════════════════════════════════════════════════════

// All domain writes below run inside ActionLedger's existing AI atomic writer.
function _npcResult(status, reason, refs, extra) { return TM.NPC.ActionLedger.result(status, reason, refs, extra); }
function _npcEvent(type, text) { try { if (typeof addEB === 'function') addEB(type, text); } catch(e) { console.warn('[NPC notification]', e); } }
function _npcTarget(d) { return TM.NPC.ActionLedger.findChar({ id: d.targetId, name: d.target }, GM); }
function _npcPosition(id) {
  var rows = [];
  if (TM.OfficeHolderState) TM.OfficeHolderState.walk(GM.officeTree, function(p,n) { if (String(p.id) === String(id)) rows.push({ pos:p, node:n }); });
  return rows.length === 1 ? rows[0] : null;
}
function _npcAuthority(npc, d, power, subject) {
  var hs = TM.OfficeHolderState;
  if (!hs) return null;
  var assignment = hs.select(GM, npc, { positionId:d.actingPositionId, appointmentId:d.appointmentId });
  if (!assignment || !assignment.pos.powers || assignment.pos.powers[power] !== true) return null;
  var row = assignment.holder || {}, pos = assignment.pos;
  if (pos.status === 'abolished' || pos.enabled === false || row.expiresTurn != null && GM.turn >= row.expiresTurn || pos.expiresTurn != null && GM.turn >= pos.expiresTurn) return null;
  var availability = hs.availability(GM, npc, pos);
  if (!availability.capacity || availability.char !== npc) return null;
  if (subject && subject.node !== assignment.node) {
    var scope = pos.authorityScope || {};
    if (!(Array.isArray(scope.positionIds) && scope.positionIds.indexOf(subject.pos.id) >= 0) && !(Array.isArray(scope.departmentIds) && scope.departmentIds.indexOf(subject.node.id) >= 0)) return null;
  }
  return assignment;
}
function _npcPersonnel(npc, target, d) {
  var who = _npcTarget(d), seat = _npcPosition(d.positionId);
  if (!who || who.alive === false || who.dead) return _npcResult('blocked', 'unknown_or_dead_target');
  if (!seat) return _npcResult('blocked', 'specific_position_required');
  var auth = _npcAuthority(npc, d, 'appointment', seat);
  if (!auth) return _npcResult('blocked', 'appointment_authority_required');
  var hs = TM.OfficeHolderState, before = hs.read(GM, seat.pos);
  if (d.behaviorType === 'dismiss') {
    if (!before.characters.some(function(h){return h.char === who;})) return _npcResult('noop','target_not_in_position');
    if (TM.NativeWorld && !TM.NativeWorld.officePermission(GM,seat.pos,npc.id)) return _npcResult('blocked','native_appointment_authority_denied');
    var dismissal = _offVacatePersonSlot(seat.pos, who, 'npc-dismiss', GM);
    if (!dismissal.ok) return _npcResult('blocked', dismissal.reason);
    _offRemoveCharOfficeTitle(who, seat.pos.name);
    if (hs.read(GM, seat.pos).characters.some(function(h){return h.char === who;})) throw Error('dismissal_postcondition');
  } else {
    if (before.characters.some(function(h){return h.char === who;})) return _npcResult('noop','already_appointed');
    if (before.vacancyCount <= 0) return _npcResult('blocked','position_has_no_vacancy');
    var former = d.behaviorType === 'transfer' ? _npcPosition(d.fromPositionId) : null;
    if (d.behaviorType === 'transfer') {
      if (!former || !_npcAuthority(npc,d,'appointment',former) || !hs.read(GM,former.pos).characters.some(function(h){return h.char===who;})) return _npcResult('blocked','transfer_source_or_authority_invalid');
      if (TM.NativeWorld && !TM.NativeWorld.officePermission(GM,former.pos,npc.id)) return _npcResult('blocked','native_transfer_authority_denied');
      var vacated = _offVacatePersonSlot(former.pos,who,'npc-transfer',GM);
      if (!vacated.ok) return _npcResult('blocked',vacated.reason);
      _offRemoveCharOfficeTitle(who,former.pos.name);
    }
    var appointed = _offAppointCharacter(seat.pos,who,{world:GM,actorCharacterId:npc.id});
    if (!appointed.ok) return _npcResult('blocked',appointed.reason);
    _offAddCharOfficeTitle(who,seat.pos.name,{concurrent:true,keepConcurrent:true});
    if (!hs.read(GM,seat.pos).characters.some(function(h){return h.char===who;})) throw Error('appointment_postcondition');
    if (appointed.holder) appointed.holder.appointmentId = d.actionId;
  }
  _npcEvent('任职', npc.name + '办理' + who.name + '·' + seat.pos.name);
  if (typeof NpcMemorySystem !== 'undefined') {
    var officeMeta={_noMirror:true,relationshipHandled:true,sourceId:d.actionId,sourceRefs:[{kind:'office',positionId:seat.pos.id,actionId:d.actionId}],factStatus:'verified_operation'};
    NpcMemorySystem.remember(who.name,(d.behaviorType==='dismiss'?'已卸任':d.behaviorType==='transfer'?'已调任':'已获任')+seat.pos.name+'，经办人为'+npc.name,'平',6,npc.name,Object.assign({},officeMeta,{characterId:who.id}));
    NpcMemorySystem.remember(npc.name,'已为'+who.name+'办理'+seat.pos.name+'任职变更','平',5,who.name,Object.assign({},officeMeta,{characterId:npc.id}));
  }
  return _npcResult('completed','任职真源已核验',[{kind:'office',positionId:seat.pos.id,characterId:who.id}],{actingPositionId:auth.pos.id});
}
function _npcReward(npc, target, d) {
  var who = _npcTarget(d), amount = Number(d.amount);
  if (!who || who === npc || who.alive === false || who.dead || who._missing) return _npcResult('blocked','unknown_or_invalid_target');
  var contact=npc.location&&who.location&&(typeof _isSameLocation==='function'?_isSameLocation(npc.location,who.location):npc.location===who.location);
  if(!contact)return _npcResult('blocked','physical_handover_requires_contact');
  var from = npc.resources && npc.resources.privateWealth, to = who.resources && who.resources.privateWealth;
  if (!from || !to || !Number.isFinite(from.money) || !Number.isFinite(to.money)) return _npcResult('blocked','private_balance_unknown');
  if (!Number.isFinite(amount) || amount <= 0 || amount !== Math.round(amount)) return _npcResult('blocked','positive_integer_amount_required');
  if (from.money < amount) return _npcResult('blocked','insufficient_private_resources');
  var total = from.money + to.money;
  from.money -= amount; to.money += amount;
  if (from.money < 0 || from.money + to.money !== total) throw Error('private_transfer_postcondition');
  // The receiving person's evaluation is directional; no forced mutual gratitude.
  // Delivery is a fact; the recipient's later response supplies their own evaluation.
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(who.name,'收到'+npc.name+'赠予'+amount,'平',5,npc.name,{_noMirror:true,relationshipHandled:true,sourceId:d.actionId,characterId:who.id});
    NpcMemorySystem.remember(npc.name,'已向'+who.name+'交付'+amount,'平',4,who.name,{_noMirror:true,relationshipHandled:true,sourceId:d.actionId,characterId:npc.id});
  }
  return _npcResult('completed','私人财产交付已核验',[{kind:'private_transfer',id:d.actionId,fromId:npc.id,toId:who.id,amount:amount}]);
}
function _npcPunish(npc, target, d) {
  var who = _npcTarget(d), seat = _npcPosition(d.targetPositionId);
  if (!who || !seat || !TM.OfficeHolderState.read(GM,seat.pos).characters.some(function(h){return h.char===who;})) return _npcResult('blocked','specific_office_subject_required');
  if (!_npcAuthority(npc,d,'judicial',seat)) return _npcResult('blocked','judicial_authority_required');
  // A disciplinary request is real; it is not a fabricated conviction or confiscation.
  d.title = d.title || '请核处分';
  return executePetitionBehavior(npc,target,d);
}
function _npcWar(npc, target, d) {
  var factions = GM.facs || [], own = factions.filter(function(f){return String(f.leaderId || f.rulerId || '')===String(npc.id) || !f.leaderId && !f.rulerId && f.leader===npc.name && TM.NPC.ActionLedger.findChar(npc.name,GM)===npc;});
  var enemies = factions.filter(function(f){return d.targetId ? String(f.id)===String(d.targetId) : f.name===target;});
  if (own.length!==1 || enemies.length!==1 || own[0]===enemies[0]) return _npcResult('blocked','faction_leader_and_enemy_required');
  if (typeof CasusBelliSystem==='undefined' || !CasusBelliSystem.declareWar) return _npcResult('blocked','war_domain_unavailable');
  var r = CasusBelliSystem.declareWar(own[0].name,enemies[0].name,d.casusBelliId);
  if (!r || !r.success || !r.war || !(GM.activeWars||[]).some(function(w){return w.id===r.war.id;})) return _npcResult('blocked',r&&r.message||'war_not_started');
  return _npcResult('started','战争已登记',[{kind:'war',id:r.war.id}]);
}
function _npcReform(npc, target, d) {
  if (!_npcAuthority(npc,d,'reform')) { d.title=d.title||'改制建议'; return executePetitionBehavior(npc,target,d); }
  if (!d.reform || typeof enqueuePendingReform!=='function') return _npcResult('blocked','specific_reform_required');
  var proposal=enqueuePendingReform(GM,d.reform,GM.turn);
  return proposal ? _npcResult('submitted','改制已进入现有拟制流程',[{kind:'reform',id:proposal._key}]) : _npcResult('noop','reform_already_pending');
}
function _npcTransferPublic(npc, d) {
  var auth = _npcAuthority(npc,d,'treasurySpend'), service=TM.PublicTreasury;
  if (!auth || !service) return _npcResult('blocked','spending_authority_required');
  var binding=auth.pos.treasuryBinding||{}, refs=binding.accountRefs||(binding.accountRef?[binding.accountRef]:[]);
  if (refs.indexOf(d.fromAccount)<0 || binding.role==='oversight' || binding.role==='none') return _npcResult('blocked','account_scope_denied');
  var src=service.getAccountView({game:GM,ref:d.fromAccount}),dst=service.getAccountView({game:GM,ref:d.toAccount});
  if (!src.exists || !dst.exists || src.kind==='pool' || dst.kind==='pool') return _npcResult('blocked','physical_accounts_required');
  if (!d.purpose || !d.amounts || !Object.keys(d.amounts).some(function(k){return Number(d.amounts[k])>0;})) return _npcResult('blocked','purpose_and_amounts_required');
  var keys=Object.keys(d.amounts);
  if (keys.some(function(k){var r=src.resources[k],n=Number(d.amounts[k]);return !r||!Number.isFinite(n)||n<0||r.available==null||n>r.available||r.quota!=null && n>Math.max(0,r.quota-(r.used||0));})) return _npcResult('blocked','insufficient_resources_or_quota');
  var scope=auth.pos.authorityScope||{};
  if(Array.isArray(scope.accountRefs)&&scope.accountRefs.indexOf(dst.id)<0)return _npcResult('blocked','destination_scope_denied');
  if (src.factionId && dst.factionId && src.factionId!==dst.factionId && (!scope.accountRefs || scope.accountRefs.indexOf(dst.id)<0)) return _npcResult('blocked','destination_scope_denied');
  var r=service.transfer({game:GM,from:d.fromAccount,to:d.toAccount,amounts:d.amounts,reason:d.purpose,enforceQuota:true,transactionId:d.actionId+':'+(d.phase||'execute')});
  if (!r || !r.ok) return _npcResult('blocked',r&&r.reason||'public_transfer_failed');
  return _npcResult('completed','实体公库转移已核验',[{kind:'public_transfer',id:r.transactionId}],{transfer:r,actingPositionId:auth.pos.id});
}
function _npcConcreteDuty(npc, d) {
  var hs=TM.OfficeHolderState, assignment=hs&&hs.select(GM,npc,{positionId:d.actingPositionId,appointmentId:d.appointmentId});
  if (!assignment) return _npcResult('blocked','specific_current_assignment_required');
  if (d.planId) return TM.NPC.ActionLedger.social(npc,d);
  if (d.step==='transfer') return _npcTransferPublic(npc,d);
  if (d.target || d.targetId) return TM.NPC.ActionLedger.social(npc,d);
  if(d.step==='report' && typeof d.content==='string' && d.content.trim()) {
    d.title=d.title||'履职报告';
    return executePetitionBehavior(npc,'朝廷',d);
  }
  return _npcResult('noop','尚无具体待办、文书或已授权安排');
}
function _npcMilitaryWork(npc,d) {
  var armies=_findNpcCommandedArmies(npc).filter(function(a){return d.armyId ? String(a.id)===String(d.armyId) : true;});
  if (!armies.length) return _npcResult('blocked','actual_command_required');
  if (d.behaviorType!=='train_troops') { d.title=d.title||'军务安排'; return executePetitionBehavior(npc,d.target,d); }
  var work=armies.filter(function(a){return a._npcTrainingTurn!==GM.turn;});
  if (!work.length) return _npcResult('noop','simulation_time_already_used');
  work.forEach(function(a){a.training=Math.min(100,(Number(a.training)||0)+5);a._npcTrainingTurn=GM.turn;});
  return _npcResult('completed','本回合既定操练已结算',work.map(function(a){return {kind:'army_training',id:a.id||a.name,turn:GM.turn};}));
}

function _npcCovertIntent(npc,target,d) {
  var who=_npcTarget(d);
  if(!who)return _npcResult('blocked','specific_subject_required');
  if(d.recipientId && d.content) {
    var recipient=TM.NPC.ActionLedger.findChar({id:d.recipientId},GM);
    if(!recipient)return _npcResult('blocked','unknown_recipient');
    return TM.NPC.ActionLedger.social(npc,Object.assign({},d,{targetId:recipient.id,target:recipient.name,task:{kind:'notice'}}));
  }
  var p=TM.NPC.ActionLedger.recordPlan({id:'plan:'+d.actionId,actor:npc.name,actorId:npc.id,target:who.name,targetId:who.id,type:d.behaviorType,intent:d.intent,stage:'needs_method'},{GM:GM});
  if(!p)return _npcResult('blocked','plan_rejected');
  var view={id:d.actionId,actionId:d.actionId,planId:p.id,actor:npc.name,actorId:npc.id,target:who.name,targetId:who.id,intent:d.intent,visibility:'hidden',turn:GM.turn,status:'intended'};
  var moves=_npcEnsureArray(GM,'_npcHiddenMoves');moves.push(view);if(moves.length>40)moves.splice(0,moves.length-40);
  _recordNpcInternalAction('hidden_move',view);
  return _npcResult('submitted','意图已登记，待具体方法与接触对象',[{kind:'plan',id:p.id}]);
}
