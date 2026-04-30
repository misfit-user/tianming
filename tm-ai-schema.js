// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-ai-schema.js — AI 推演输出的权威 Schema（单一真源）
 *
 * 目的：把散落在以下位置的「AI 返回字段定义」收拢到一处：
 *   - tm-endturn.js 的 prompt 字符串（告诉 AI 字段怎么填）
 *   - tm-ai-output-validator.js 的 KNOWN_FIELDS（验证 AI 返回）
 *   - tm-ai-change-applier.js 的消费代码（读 aiOutput.xxx）
 *
 * 原来三处各自维护字段列表，容易漂移（例 prompt/validator/applier 对同一字段认知不一致）。
 * 现在 validator 从 TM_AI_SCHEMA 动态构建 KNOWN_FIELDS，保持同步。
 *
 * 字段元数据约定：
 *   {
 *     type: 'array' | 'object' | 'string' | 'number',
 *     desc: '一句话说明',
 *     required: false,             // 顶层字段是否必需（当前全为 false）
 *     deprecated: 'xxx 代替',       // 若已废弃，写新字段名
 *     items: { ... }                // array 元素的 schema（递归）
 *     requiredSubFields: ['name'],  // array 元素必填子字段
 *     producedBy: ['subcall1'],     // 哪个子调用产生（用于定位）
 *     consumedBy: ['applier', 'endturn']  // 哪些模块消费（重构时参照）
 *   }
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.TM_AI_SCHEMA) return;

  // ──────────────────────────────────────────────
  // Dialogue schema — 问对/朝议/密问/科议 返回 JSON 格式
  // ──────────────────────────────────────────────
  var DIALOGUE = {
    reply:        { type: 'string', desc: '大臣发言文本（必填）' },
    loyaltyDelta: { type: 'number', desc: '忠诚度变化（-100 ~ +100）' },
    emotionState: { type: 'string', desc: '情绪状态（喜/怒/惧/忧/惊/平/疑/恨等）' },
    toneEffect:   { type: 'string', desc: '语气对关系的额外效果描述' },
    suggestions:  { type: 'array',  desc: '可划入诏书的建言要点' },
    memoryImpact: { type: 'object', desc: '对 NPC 长期记忆的影响' },
    stance:       { type: 'string', desc: '立场标签' },
    // 朝议独有
    vote:         { type: 'string', desc: '表决倾向（支持/反对/中立）' },
    rebuttal:     { type: 'string', desc: '反驳他人发言' },
    // 科议独有
    exam_opinion: { type: 'string', desc: '科举议题建议' }
  };

  var S = {
    version: 2,
    lastUpdate: '2026-04-24',

    // ──────────────────────────────────────────────
    // 叙事文本（string）
    // ──────────────────────────────────────────────
    narrative:   { type: 'string', desc: '回合主叙事，半文言 300-800 字' },
    shilu_text:  { type: 'string', desc: '实录风格叙事补充' },
    shizhengji:  { type: 'string', desc: '时政记风格补充' },
    event:       { type: 'object', desc: '单个主要事件，带 desc' },

    // ──────────────────────────────────────────────
    // 数值增量（object）
    // ──────────────────────────────────────────────
    era_state_delta:    { type: 'object', desc: '时代参数调整（social/economy/centralization/military）' },
    global_state_delta: { type: 'object', desc: '全局状态调整（tax_pressure 等）' },

    // ──────────────────────────────────────────────
    // 核心实体变化（array）
    // ──────────────────────────────────────────────
    character_deaths: {
      type: 'array',
      desc: '让角色死亡（含玩家→游戏结束）',
      requiredSubFields: ['name'],
      consumedBy: ['endturn:9636', 'endturn:14205']
    },
    new_characters: {
      type: 'array',
      desc: '创建新角色（子嗣、投奔者、新官员）',
      requiredSubFields: ['name'],
      consumedBy: ['endturn', 'applier']
    },
    char_updates: {
      type: 'array',
      desc: '角色属性增量（忠诚/智力/野心/loyalty 等）',
      consumedBy: ['applier:954']
    },
    relations: {
      type: 'array',
      desc: '角色关系变化',
      consumedBy: ['applier:938']
    },

    // ──────────────────────────────────────────────
    // 势力与派别
    // ──────────────────────────────────────────────
    faction_changes: {
      type: 'array',
      desc: '势力属性变化（strength/economy/playerRelation delta）',
      requiredSubFields: ['name']
    },
    faction_updates:          { type: 'array', desc: '势力增量更新', consumedBy: ['applier:1263'] },
    faction_events:           { type: 'array', desc: '势力间自主事件（战争/联盟/政变/行军/围城）' },
    faction_relation_changes: { type: 'array', desc: '势力间关系变化' },
    faction_create:           { type: 'array', desc: '新势力崛起（独立/割据/称帝/复国）' },
    faction_succession:       { type: 'array', desc: '势力首脑传承' },
    faction_dissolve:         { type: 'array', desc: '势力覆灭（不得用于玩家势力）' },

    party_changes: {
      type: 'array',
      desc: '党派状态修改',
      requiredSubFields: ['name']
    },
    party_updates:   { type: 'array', desc: '党派增量', consumedBy: ['applier:1273'] },
    party_create:    { type: 'array', desc: '新党派崛起' },
    party_splinter:  { type: 'array', desc: '党派分裂' },
    party_merge:     { type: 'array', desc: '党派合流' },
    party_dissolve:  { type: 'array', desc: '党派覆灭' },

    class_changes: {
      type: 'array',
      desc: '阶层状态修改',
      requiredSubFields: ['name']
    },
    class_updates: { type: 'array', desc: '阶层增量', consumedBy: ['applier:1283'] },
    class_emerge:  { type: 'array', desc: '新阶层兴起' },
    class_revolt:  { type: 'array', desc: '阶层起义' },
    class_dissolve:{ type: 'array', desc: '阶层消亡' },

    // ──────────────────────────────────────────────
    // 军事
    // ──────────────────────────────────────────────
    army_changes: { type: 'array', desc: '修改部队兵力/士气/训练（降至0→覆没）' },

    // ──────────────────────────────────────────────
    // 物品与头衔
    // ──────────────────────────────────────────────
    item_changes:     { type: 'array', desc: '角色获得/失去物品' },
    title_changes:    { type: 'array', desc: '头衔爵位变动（grant/revoke/inherit/promote）' },
    building_changes: { type: 'array', desc: '建筑变动（build/upgrade/destroy，需 territory+type）' },
    vassal_changes:   { type: 'array', desc: '封臣关系变动（establish/break/change_tribute）' },

    // ──────────────────────────────────────────────
    // 官制与行政
    // ──────────────────────────────────────────────
    office_changes: {
      type: 'array',
      desc: '官制人事变动（appoint/dismiss/promote/demote/transfer/evaluate/reform）',
      requiredSubFields: ['action'],
      consumedBy: ['endturn:11115']
    },
    office_assignments: { type: 'array', desc: '官职任命（旧格式兼容）', consumedBy: ['applier:1004'] },
    office_spawn:       { type: 'array', desc: '官制占位实体化（把 generated:false 的 holder 生成为真人）' },
    personnel_changes:  { type: 'array', desc: '人事变动（旧格式兼容）', consumedBy: ['applier:1079'] },

    admin_changes: {
      type: 'array',
      desc: '行政区划人事（appoint_governor/remove_governor/adjust）'
    },
    admin_division_updates: {
      type: 'array',
      desc: '行政区划树结构变更（add/remove/rename/merge/split/reform/territory_gain/territory_loss）',
      requiredSubFields: ['action'],
      consumedBy: ['endturn:12009']
    },

    // ──────────────────────────────────────────────
    // 后宫与文化
    // ──────────────────────────────────────────────
    harem_events: {
      type: 'array',
      desc: '后宫事件（pregnancy/birth/death/rank_change/favor_change/scandal）',
      requiredSubFields: ['type'],
      consumedBy: ['endturn:12260']
    },
    tech_civic_unlocks: { type: 'array', desc: '解锁科技或推行民政政策（自动扣费+应用）' },
    policy_changes:     { type: 'array', desc: '国策变更（add/remove）' },

    // ──────────────────────────────────────────────
    // 时局与阴谋
    // ──────────────────────────────────────────────
    scheme_actions: { type: 'array', desc: '阴谋干预（advance/disrupt/abort/expose）' },
    timeline_triggers: { type: 'array', desc: '触发剧本预设时间线事件' },
    current_issues_update: {
      type: 'array',
      desc: '时局要务增量（add/resolve/update）',
      requiredSubFields: ['action'],
      consumedBy: ['endturn:9597']
    },

    // ──────────────────────────────────────────────
    // NPC 互动与诏令问责
    // ──────────────────────────────────────────────
    npc_actions:          { type: 'array', desc: 'NPC 自主行动（兼容旧 prompt；endturn 仍消费）', consumedBy: ['endturn-ai-infer'] },
    npc_interactions:     { type: 'array', desc: 'NPC 之间或 NPC→玩家的主动互动/奏对', consumedBy: ['endturn-ai-infer:sc1b'] },
    npc_letters:          { type: 'array', desc: 'NPC 主动来书/远方奏报', consumedBy: ['endturn-ai-infer:sc1b'] },
    npc_correspondence:   { type: 'array', desc: 'NPC 之间私信/密信', consumedBy: ['endturn-ai-infer:sc1b'] },
    cultural_works:       { type: 'array', desc: '文苑作品/后人戏说', consumedBy: ['endturn-ai-infer:sc1b'] },
    directive_compliance: { type: 'array', desc: '诏令执行报告（被 _postInferenceAccountability 消费）', consumedBy: ['applier:1593'] },

    // ──────────────────────────────────────────────
    // 财政与事件
    // ──────────────────────────────────────────────
    fiscal_adjustments: { type: 'array', desc: '财政调整（income/expense，会写 guoku）', consumedBy: ['applier:1136', 'applier:1444'] },
    region_updates:     { type: 'array', desc: '地区数据增量' },
    project_updates:    { type: 'array', desc: '工程项目进度' },
    edict_feedback:     { type: 'array', desc: '诏令/裁断执行回报', consumedBy: ['endturn:9514'] },
    edict_lifecycle_update: { type: 'array', desc: '诏令生命周期推进', consumedBy: ['endturn:8843'] },
    route_disruptions:  { type: 'array', desc: '驿道/信使路线阻断或恢复', consumedBy: ['endturn-ai-infer'] },
    foreshadowing:      { type: 'array', desc: '伏笔埋设/回收', consumedBy: ['endturn-ai-infer:sc25'] },
    map_changes:        { type: 'object', desc: '地图/领地变化', consumedBy: ['endturn-ai-infer', 'map-integration'] },
    faction_interactions_advanced: { type: 'array', desc: '势力深度互动', consumedBy: ['endturn-ai-infer:sc1c'] },
    npc_schemes:        { type: 'array', desc: 'NPC 阴谋/长期布局', consumedBy: ['endturn-ai-infer:sc1c'] },
    hidden_moves:       { type: 'array', desc: '暗流行动', consumedBy: ['endturn-ai-infer:sc1c'] },
    fengwen_snippets:   { type: 'array', desc: '风闻录事条目', consumedBy: ['endturn-ai-infer:sc1c'] },
    call_court_works:   { type: 'array', desc: '朝会/廷议衍生事项（兼容字段）', consumedBy: ['endturn-ai-infer'] },
    events:             { type: 'array', desc: '本回合事件列表', consumedBy: ['ai-change-applier'] },
    changes:            { type: 'array', desc: '通用变化列表（旧格式）', consumedBy: ['ai-change-applier'] },
    appointments:       { type: 'array', desc: '任命列表（旧格式，官方用 office_changes）', consumedBy: ['ai-change-applier'] },
    institutions:       { type: 'array', desc: '制度（旧格式）', consumedBy: ['ai-change-applier'] },
    regions:            { type: 'array', desc: '地区（旧格式）', consumedBy: ['ai-change-applier'] },
    localActions:       { type: 'array', desc: '地方行动（旧格式）', consumedBy: ['ai-change-applier'] },
    anyPathChanges:     { type: 'array', desc: '任意路径变更（通用出口）', consumedBy: ['applier:1332'] },
    geoData:            { type: 'object', desc: '地理推算数据（行军/围城需要）' },
    memorials:          { type: 'array', desc: '奏疏文本' },
    letters:            { type: 'array', desc: 'NPC 主动传书' },
    bigyear:            { type: 'object', desc: '大事年（年度事件）' },
    bigYearEvent:       { type: 'object', desc: '大事年单事件（兼容命名）' },

    // ──────────────────────────────────────────────
    // 已废弃字段（validator 打 warn 提示迁移）
    // ──────────────────────────────────────────────
  };

  /**
   * 返回一个 { fieldName: type } 的平坦 map，供 validator 使用
   * @param {string} mode - 'turn-full'（默认，回合推演）| 'dialogue'（对话模式）
   */
  function toKnownFields(mode) {
    var src = (mode === 'dialogue') ? DIALOGUE : S;
    var out = {};
    Object.keys(src).forEach(function(k){
      if (k === 'version' || k === 'lastUpdate') return;
      var meta = src[k];
      if (!meta || !meta.type || meta.deprecated) return;
      out[k] = meta.type;
    });
    return out;
  }

  /**
   * 返回已废弃字段 map
   */
  function toDeprecatedFields() {
    var out = {};
    Object.keys(S).forEach(function(k){
      var meta = S[k];
      if (meta && meta.deprecated) out[k] = meta.deprecated;
    });
    return out;
  }

  /**
   * 返回 { fieldName: ['subField1', ...] } map
   */
  function toRequiredSubfields() {
    var out = {};
    Object.keys(S).forEach(function(k){
      var meta = S[k];
      if (meta && Array.isArray(meta.requiredSubFields)) out[k] = meta.requiredSubFields;
    });
    return out;
  }

  /**
   * 查询某字段的完整元信息
   */
  function describe(fieldName) {
    return S[fieldName] || null;
  }

  /**
   * Return field ownership metadata for smoke tests and debugging.
   */
  function toFieldOwnership(mode) {
    var src = (mode === 'dialogue') ? DIALOGUE : S;
    var out = {};
    Object.keys(src).forEach(function(k){
      if (k === 'version' || k === 'lastUpdate') return;
      var meta = src[k];
      if (!meta || !meta.type || meta.deprecated) return;
      var producedBy = Array.isArray(meta.producedBy) ? meta.producedBy.slice() : [];
      var consumedBy = Array.isArray(meta.consumedBy) ? meta.consumedBy.slice() : [];
      if (producedBy.length || consumedBy.length) {
        out[k] = {
          type: meta.type,
          producedBy: producedBy,
          consumedBy: consumedBy
        };
      }
    });
    return out;
  }

  function describeOwnership(fieldName, mode) {
    return toFieldOwnership(mode)[fieldName] || null;
  }

  /**
   * 列出所有未标 deprecated 的字段名
   */
  function listFields(mode) {
    var src = (mode === 'dialogue') ? DIALOGUE : S;
    return Object.keys(src).filter(function(k){
      if (k === 'version' || k === 'lastUpdate') return false;
      var meta = src[k];
      return meta && meta.type && !meta.deprecated;
    });
  }

  // ──────────────────────────────────────────────
  // Wave 2 · Reconcile tool_use schemas
  // 用于 callAIWithTools 二次自审 reconciliation·让 AI 必须以结构化 tool 输出
  // ──────────────────────────────────────────────
  var RECONCILE_TOOLS = [
    {
      name: 'record_personnel_changes',
      description: '记录角色身份/状态变化（罢免/下狱/赐死/抄家/流放/致仕/逃亡/任命）。仅当 narrative 提到但 personnel_changes 中漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            description: '角色变化列表',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '角色姓名' },
                change: { type: 'string', enum: ['罢免','下狱','赐死','抄家','流放','致仕','逃亡','任命','贬谪','削籍'], description: '变化类型' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['name', 'change']
            }
          }
        },
        required: ['changes']
      }
    },
    {
      name: 'record_office_assignments',
      description: '记录官职任命/罢免（appoint=拜/擢/迁/命，dismiss=罢/免/革）。仅当 narrative 提到但 office_assignments 中漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          assignments: {
            type: 'array',
            description: '任命列表',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '人物姓名' },
                action: { type: 'string', enum: ['appoint','dismiss'], description: '动作' },
                post: { type: 'string', description: '官职名（appoint 必填）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['name', 'action']
            }
          }
        },
        required: ['assignments']
      }
    },
    {
      name: 'record_fiscal_adjustments',
      description: '记录财政增减（target=guoku/neitang，kind=income/expense，resource=money/grain/cloth）。仅当 narrative 提到具体银两/粮石变动但 fiscal_adjustments 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          adjustments: {
            type: 'array',
            description: '财政变动列表',
            items: {
              type: 'object',
              properties: {
                target: { type: 'string', enum: ['guoku','neitang'], description: '目标：帑廪 guoku 或内帑 neitang' },
                kind: { type: 'string', enum: ['income','expense'], description: '收入或支出' },
                resource: { type: 'string', enum: ['money','grain','cloth'], description: '资源类型' },
                amount: { type: 'number', description: '数额（正数·单位与 G.guoku 一致：money=两，grain=石，cloth=匹）' },
                name: { type: 'string', description: '名目（如 辽饷加派、赈灾发放）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['target','kind','resource','amount','name']
            }
          }
        },
        required: ['adjustments']
      }
    },
    {
      name: 'record_military_changes',
      description: '记录军队人数变化（delta 正=补充/募兵·负=战损/逃散）。仅当 narrative 提到但 military_changes 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            description: '军队变动列表',
            items: {
              type: 'object',
              properties: {
                armyName: { type: 'string', description: '部队名（与 GM.armies[].name 对齐）' },
                delta: { type: 'number', description: '人数变化（正补充·负战损）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['armyName','delta']
            }
          }
        },
        required: ['changes']
      }
    },
    {
      name: 'record_sentiment_changes',
      description: '记录民心/皇威/皇权变化（用于 narrative 提到但 turn_changes 漏录的情况）。',
      parameters: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            description: '民意/权威变动列表',
            items: {
              type: 'object',
              properties: {
                target: { type: 'string', enum: ['minxin','huangwei','huangquan'], description: '目标变量：民心/皇威/皇权' },
                delta: { type: 'number', description: '变化值（-30~+30，正升负降）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['target','delta']
            }
          }
        },
        required: ['changes']
      }
    },
    {
      name: 'record_population_changes',
      description: '记录人口减少（死亡/逃亡/逃役）。仅当 narrative 明确提到伤亡或大规模流亡但 population_changes 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            description: '人口变动列表',
            items: {
              type: 'object',
              properties: {
                region: { type: 'string', description: '行政区划名（如 陕西、京师）' },
                kind: { type: 'string', enum: ['death','flee','migrate'], description: '类型：死亡/逃亡/迁徙' },
                amount: { type: 'number', description: '人数（口·正数）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['region','kind','amount']
            }
          }
        },
        required: ['changes']
      }
    },
    {
      name: 'record_war_events',
      description: '记录战争事件（开战/议和/战役）。仅当 narrative 提到但 GM.activeWars 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '战争事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['start','end','battle'], description: '动作：开战/议和/战役' },
                enemy: { type: 'string', description: '敌方势力名（开战必填）' },
                region: { type: 'string', description: '战场区域' },
                outcome: { type: 'string', enum: ['victory','defeat','stalemate','peace','surrender'], description: '结果（end/battle 必填）' },
                casualties: { type: 'number', description: '伤亡人数（可选）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_revolt_events',
      description: '记录民变事件（起事/平定/招抚）。仅当 narrative 提到但 G.minxin.revolts 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '民变事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['start','suppress','appease'], description: '动作：起事/镇压/招抚' },
                region: { type: 'string', description: '发生地（如 陕西、山东）' },
                leader: { type: 'string', description: '首领姓名（可选）' },
                scale: { type: 'number', description: '规模（人数）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','region']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_disaster_events',
      description: '记录天灾事件（旱/涝/蝗/疫/震）。仅当 narrative 提到但 GM.activeDisasters 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '天灾事件列表',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string', enum: ['drought','flood','locust','plague','quake'], description: '类型：旱/涝/蝗/疫/震' },
                region: { type: 'string', description: '发生地' },
                severity: { type: 'string', enum: ['light','moderate','severe','catastrophic'], description: '烈度' },
                casualties: { type: 'number', description: '伤亡人数（可选）' },
                reason: { type: 'string', description: '简述（不超过30字）' }
              },
              required: ['category','region']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_diplomacy_events',
      description: '记录外交事件（通使/朝贡/缔盟/绝交/宣战）。仅当 narrative 提到但 GM.facs 关系/态度漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '外交事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['envoy','tribute','alliance','sever','declare_war','vassalize'], description: '动作：通使/朝贡/缔盟/绝交/宣战/羁縻' },
                faction: { type: 'string', description: '势力名（与 G.facs[].name 对齐）' },
                attitude: { type: 'string', enum: ['friendly','neutral','hostile','vassal'], description: '新态度' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','faction']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_keju_events',
      description: '记录科举事件（开科/会试/殿试/放榜）。仅当 narrative 提到但 P.keju 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '科举事件列表',
            items: {
              type: 'object',
              properties: {
                stage: { type: 'string', enum: ['open','xiangshi','huishi','dianshi','release'], description: '阶段：开科/乡试/会试/殿试/放榜' },
                year: { type: 'string', description: '科年（如 戊辰、己巳）' },
                topThree: { type: 'array', items: { type: 'string' }, description: '前三甲姓名（放榜时填）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['stage']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_party_events',
      description: '记录党派事件（结党/解散/分裂/弹劾）。仅当 narrative 提到但 GM.parties 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '党派事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['form','dissolve','split','impeach'], description: '动作：结党/解散/分裂/弹劾' },
                partyName: { type: 'string', description: '党派名' },
                leader: { type: 'string', description: '党首（form 必填）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','partyName']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_edict_events',
      description: '记录法令颁布/废止事件。仅当 narrative 提到但 GM.activeEdicts 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '法令事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['promulgate','revoke','renew'], description: '动作：颁布/废止/续行' },
                edictName: { type: 'string', description: '法令名（如 一条鞭法、辽饷加派）' },
                category: { type: 'string', enum: ['fiscal','military','administrative','ritual','agricultural','other'], description: '类别' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','edictName']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_court_ceremony_events',
      description: '记录朝廷礼仪/后宫事件（迁都/晋爵/谥号/册立/废后/赐婚）。仅当 narrative 提到但 char title/spouse 等漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '礼仪事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['move_capital','grant_title','strip_title','posthumous_title','enthrone_consort','depose_consort','grant_marriage','grant_surname'], description: '动作' },
                target: { type: 'string', description: '人物姓名或地名' },
                newTitle: { type: 'string', description: '新爵位/谥号/封号' },
                newCapital: { type: 'string', description: '新都城（move_capital 必填）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','target']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_construction_events',
      description: '记录工程·建筑·物品事件（兴建/竣工/烧毁/铸造）。仅当 narrative 提到但 GM 项目/建筑/物品漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '工程事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['build','complete','destroy','restore','cast'], description: '动作：兴建/竣工/损毁/重修/铸造' },
                kind: { type: 'string', enum: ['palace','temple','wall','canal','bridge','arsenal','treasury','tomb','academy','warehouse','currency','weapon','ritual_object','other'], description: '类别' },
                name: { type: 'string', description: '项目/物品名' },
                region: { type: 'string', description: '所在地' },
                cost: { type: 'number', description: '耗资（两·可选）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','kind','name']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_omen_events',
      description: '记录天象异象事件（彗星/日蚀/瑞兽/谶语/陨石）。仅当 narrative 提到但 GM.omens 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '异象事件列表',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string', enum: ['comet','eclipse','meteor','strange_creature','strange_weather','prophecy','rumor','earthquake_omen','five_planets','other'], description: '类别' },
                tone: { type: 'string', enum: ['auspicious','ominous','neutral'], description: '吉凶：祥/凶/中性' },
                description: { type: 'string', description: '简述（不超过50字）' },
                region: { type: 'string', description: '观测地（可选）' }
              },
              required: ['category','tone']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_marriage_birth_events',
      description: '记录婚姻/生育/继承事件（嫁娶/诞生/夭折/即位/承嗣）。仅当 narrative 提到但 char_updates / new_characters / character_deaths 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '婚姻生育继承事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['marriage','birth','heir_death','succession','inherit_title'], description: '动作：嫁娶/诞生/夭折/即位/承袭' },
                target: { type: 'string', description: '主角姓名' },
                partner: { type: 'string', description: '配偶/父母（marriage 必填，birth 可填父母）' },
                heirName: { type: 'string', description: '新生儿/继承人姓名' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','target']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_conspiracy_events',
      description: '记录谋反/政变/弑君事件（谋反/兵变/篡位/逼宫/弑君）。仅当 narrative 提到但 personnel_changes/character_deaths 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '阴谋·政变事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['plot_uncovered','plot_failed','coup_failed','coup_succeeded','regicide','palace_coup'], description: '动作：阴谋败露/谋反失败/政变失败/政变成功/弑君/宫变' },
                instigator: { type: 'string', description: '主谋姓名' },
                target: { type: 'string', description: '目标人物（被刺者）' },
                outcome: { type: 'string', enum: ['suppressed','partial','succeeded'], description: '结果' },
                conspirators: { type: 'array', items: { type: 'string' }, description: '同谋者姓名' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','instigator']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_currency_events',
      description: '记录货币/币值/银荒事件（银荒/钞贱/铸大钱/币改）。仅当 narrative 提到但 changes/global_state_delta 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '货币事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['silver_shortage','copper_shortage','inflation','deflation','currency_reform','recoinage','ban_silver','unban_silver'], description: '动作' },
                severity: { type: 'string', enum: ['light','moderate','severe'], description: '烈度' },
                priceIndexDelta: { type: 'number', description: '物价指数变动（-100~+200）' },
                region: { type: 'string', description: '影响范围（可选·全国留空）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_religion_events',
      description: '记录宗教/教派事件（立教/灭佛/邪教兴起/沙汰僧道）。仅当 narrative 提到但 GM.religions 漏录时调用。',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: '宗教事件列表',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['promote','suppress','sect_rise','sect_ban','heresy_purge','foreign_arrival'], description: '动作：兴佛兴道/灭佛灭道/教派兴起/禁教/清剿邪教/夷教传入' },
                religion: { type: 'string', description: '教派名（如 白莲教、天主教、佛门、道门）' },
                region: { type: 'string', description: '影响地区' },
                followers: { type: 'number', description: '信众规模（人）' },
                reason: { type: 'string', description: '原因（不超过30字）' }
              },
              required: ['action','religion']
            }
          }
        },
        required: ['events']
      }
    },
    {
      name: 'record_no_changes',
      description: '若 narrative 与已写结构化数据完全一致·无需补录·调用此工具表示空补录。',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '简述为何无需补录' }
        }
      }
    }
  ];

  window.TM_AI_SCHEMA = {
    raw: S,
    dialogue: DIALOGUE,
    reconcileTools: RECONCILE_TOOLS,
    toKnownFields: toKnownFields,
    toDeprecatedFields: toDeprecatedFields,
    toRequiredSubfields: toRequiredSubfields,
    toFieldOwnership: toFieldOwnership,
    describeOwnership: describeOwnership,
    describe: describe,
    listFields: listFields
  };
})();
