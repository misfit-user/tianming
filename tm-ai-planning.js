// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-ai-planning.js — 启动 AI 规划 (R138 从 tm-endturn-prep.js L1-1698 拆出)
// 姊妹: tm-endturn-prep.js (L1699-end·真正的 endTurn 前置 init/collect)
//       tm-endturn-ai-infer.js (10k 单函数·推演主体)
//       tm-endturn-core.js (入口)
// 包含: aiDeepReadScenario (剧本深读) + aiPlanScenarioForInference (启动预演规划)+
//       aiPlanFactionMatrix (势力矩阵规划) + openMemoryAnchors + endTurn 事件钩子系统
// ============================================================

// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-prep.js — 回合结算前置 (R110 从 tm-endturn.js L1-2185 拆出)
// 职责: 剧本深读·剧本规划·记忆锚点·后宫生成·_endTurn_init·_endTurn_collectInput
// 姊妹: tm-endturn-ai-infer.js (L2186-12711·巨 AI 推演)
//       tm-endturn-core.js     (L12712-end·endTurn/_endTurnCore 入口)
// 原文件注释：
// EndTurn System — 回合结算（天命核心模块·当前 13,447 行）
//
// 📜 重构历史（R86-R100·2026-04-24 一日 15 轮）
//   原始 18,686 行 → 现 13,447 行·-5,239 行 -28%·大小 1.22MB→0.82MB
//   拆分出 14 个新模块·详见下面"§ 已拆分子模块"表
//
// Requires: tm-data-model.js, tm-utils.js, tm-mechanics.js,
//           tm-change-queue.js, tm-index-world.js, tm-npc-engine.js,
//           tm-game-engine.js, tm-dynamic-systems.js (all prior modules)
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（R101 重修·2026-04-24 当前行号）
// ══════════════════════════════════════════════════════════════
//
//  ┌─ §A 辅助系统 & 剧本深读 ─────────────────────────┐
//  │  L93    aiDeepReadScenario()          开局一次性场景深读
//  │  L1318  aiPlanScenarioForInference()  剧本推演预生成
//  │  L1430  aiPlanFactionMatrix()         势力矩阵预推演
//  │  L1718-1844  _generateConsortAudiences / _generateConsortLiterary
//  │  （记忆锚/角色弧/post-turn/history-events/ai-helpers 已拆出·见下）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B 回合初始化 ──────────────────────────────────┐
//  │  L1845  _endTurn_init()               初始化 + 重置
//  │  L1881  _reactToEdicts()              应诏反应
//  │  L1927  _endTurn_collectInput()       收集玩家输入
//  │  （§B 诏令处理 6 函数已拆到 tm-endturn-edict.js · R88）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C+§D AI 推演 + 输出应用（主战场） ─────────────┐
//  │  L2169  _endTurn_aiInfer(edicts, xinglu, memRes, oldVars)
//  │         10,514 行 async 巨函数·内部结构：
//  │           - sysP 巨型 prompt 构建（~L4700-5000）
//  │           - p1 = extractJSON(c1)      Sub-call 1 返回解析
//  │           - p1b = extractJSON(c1b)    Sub-call 1b 文事/势力
//  │           - p1c = extractJSON(c1c)    Sub-call 1c 诏令问责
//  │           - AI 输出字段处理·p1.xxx 散落多处
//  │  R100 已抽出 applyCharacterDeaths(p1) → tm-ai-apply-deaths.js
//  │  TODO: office_changes/admin_division_updates/harem_events 待抽
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §E/§F 回合收尾 ─────────────────────────────────┐
//  │  L12683 _endTurnInternal()            并发入口
//  │  L12688 endTurn()                     玩家触发（"静待时变"）
//  │  L12694 _endTurnCore()                核心流程
//  │  （§E 系统更新 _endTurn_updateSystems → tm-endturn-systems.js · R95）
//  │  （朝会追踪 8 函数 → tm-court-meter.js · R96）
//  │  （史记+起居注 UI → tm-shiji-qiju-ui.js · R97）
//  │  （人物志 UI → tm-renwu-ui.js · R98）
//  │  （侧栏+面板 UI → tm-sidebar-ui.js · R99）
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  📦 已拆分子模块（14 个·均 window 全局可访问）
// ══════════════════════════════════════════════════════════════
//
//    R88  tm-endturn-edict.js        诏令处理 8 函数
//    R89  tm-chronicle-system.js     编年史对象 9 方法
//    R90  tm-memory-anchors.js       记忆锚点 9 函数
//    R91  tm-arcs.js                 角色弧+决策追踪 5 函数
//    R92  tm-post-turn-jobs.js       M3/M4/S2 后台任务 6 函数
//    R93  tm-history-events.js       历史事件+时间工具 9 函数
//    R94  tm-endturn-ai-helpers.js   AI 预演辅助 4 函数
//    R95  tm-endturn-systems.js      §E 系统更新调度器
//    R96  tm-court-meter.js          朝会追踪 8 函数
//    R97  tm-shiji-qiju-ui.js        史记+起居注 UI 13 函数
//    R98  tm-renwu-ui.js             人物志 UI 9 函数（单次最大 887 行）
//    R99  tm-sidebar-ui.js           侧栏+面板 UI 12+ 函数
//    R100 tm-ai-apply-deaths.js      AI 角色死亡应用器（首次 in-function 抽）
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口（浏览器控制台）
// ══════════════════════════════════════════════════════════════
//
//  GM._turnAiResults.subcall1       最近一次主推演返回
//  GM._turnAiResults.subcall1_raw   原始文本
//  TM.getLastValidation()           最近一次 validator 报告
//  TM.errors.byModule('applier')    变更应用异常
//  TM.errors.getLogLoud()           值得注意的错误
//  TM.errors.getLogSilent()         R86 迁移的 159 处静默捕获
//  TM.perf.print()                  tick 耗时 p50/p95/max
//  TM.namespaces.verify()           命名空间门面自检
//  DA.turn.current()                当前回合号
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 架构注意事项
// ══════════════════════════════════════════════════════════════
//
//  1. 本文件现 13,447 行·_endTurn_aiInfer 仍占 10,514 行是最大技术债
//     剩余拆分计划：按 p1.xxx 字段一个个抽出 applier 到 tm-ai-apply-*.js
//
//  2. 不要再新增 AI 输出字段处理在本文件——改去 tm-ai-schema.js 声明
//     复杂逻辑放到对应 tm-ai-apply-*.js (参考 R100 applyCharacterDeaths)
//
//  3. 不要在本文件直接写 GM.chars.find()——走 DA.chars.findByName()
//
//  4. 每次合并 AI 子调用前先看 TM_AI_SCHEMA.describe(字段名)
//
//  5. 备份链 .bak-r86 到 .bak-r100 保留·R100 完全验证前不得删除
//
// ══════════════════════════════════════════════════════════════
/**
 * 根据职能关键词在官制体系中查找负责部门和主官
 * @param {string} funcKeyword - 职能关键词（如"铨选""科举""军务""刑狱""礼仪""户口"）
 * @returns {{dept:string, deptDesc:string, official:string, holder:string, duties:string}|null}
 */
async function aiDeepReadScenario() {
  if (!P.ai || !P.ai.key) return;
  if (GM._aiScenarioDigest) return;
  if (GM.turn > 1) return;

  var sc = findScenarioById(GM.sid);
  if (!sc) return;

  // 剧本已人工深化·跳过 28 次 AI 深读·用剧本原文本直接兜底 _aiScenarioDigest
  if (sc.aiAutoEnrich === false || sc.isFullyDetailed === true) {
    var pi0 = P.playerInfo || {};
    var overviewText = (sc.overview || '') + '\n' + (sc.openingText || '');
    var rulesText = sc.globalRules || '';
    var playerBgText = [pi0.characterBio, pi0.characterPersonality, pi0.factionGoal].filter(Boolean).join('·');
    // 矛盾列表
    var contradictText = '';
    if (pi0.coreContradictions && pi0.coreContradictions.length > 0) {
      contradictText = pi0.coreContradictions.map(function(c) { return '[' + c.dimension + ']' + c.title + (c.description ? '：' + c.description : ''); }).join('；');
    }
    GM._aiScenarioDigest = {
      masterDigest: (overviewText + '\n' + contradictText).slice(0, 1200),
      worldAtmosphere: (sc.overview || '').slice(0, 400),
      narrativeStyle: (sc.openingText || '').slice(0, 400),
      worldRules: rulesText,
      characterWeb: playerBgText,
      factionBalance: '剧本势力格局见 GM.facs',
      powerNetwork: '见官制树',
      contradictionAnalysis: contradictText,
      playerDilemma: pi0.characterBio || '',
      // 字段兜底·避免 undefined
      characterProfiles: '', dangerousFigures: '', betrayalRisks: '',
      emotionalTriggers: '', narrativeArcs: '',
      periodVocabulary: '', etiquetteNorms: '', sensoryDetails: '',
      firstTurnFocus: pi0.factionGoal || '',
      scenarioDigest: (sc.overview || '').slice(0, 800),
      generatedAt: GM.turn,
      _fromScenarioText: true  // 标记·非 AI 生成
    };
    // 记录初始官制哈希（检测后续改革）
    try { GM._officeTreeHash = _computeOfficeHash(); } catch(_){}
    _dbg && _dbg('[AI DeepRead] 剧本已深化·跳过 28 次 AI·用原文本兜底');
    return;
  }
  var url = P.ai.url; if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';
  var model = P.ai.model || 'gpt-4o';
  var pi = P.playerInfo || {};

  async function _call(sysMsg, userMsg, maxTok) {
    // 根据模型上下文窗口动态调整max_tokens
    // 基础倍率×3 + 上下文缩放因子（大模型可以输出更多内容）
    var _drCp = (typeof getCompressionParams === 'function') ? getCompressionParams() : {scale:1.0,contextK:32};
    var _drScale = Math.max(1.0, _drCp.scale); // 深度阅读不缩小，只放大
    var _actualTok = Math.round((maxTok || 800) * 3 * _drScale);
    // 限制不超过模型输出上限（上下文的1/4）
    var _drOutputCap = Math.round(_drCp.contextK * 1024 / 4);
    _actualTok = Math.min(_actualTok, _drOutputCap);
    _actualTok = Math.max(_actualTok, 500);
    var resp = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key},
      body:JSON.stringify({model:model, messages:[{role:'system',content:sysMsg},{role:'user',content:userMsg}], temperature:0.5, max_tokens:_actualTok})});
    if (!resp.ok) return {};
    var j = await resp.json(); var raw = (j.choices&&j.choices[0]&&j.choices[0].message) ? j.choices[0].message.content : '';
    try { return JSON.parse(raw.match(/\{[\s\S]*\}/)[0]); } catch(e) { return {_raw: raw}; }
  }

  var totalSteps = 28;
  function prog(step, label) { showLoading(label, Math.round(step / totalSteps * 100)); }

  // ═══ 构建全量数据块（完全不截断） ═══

  // 块A: 剧本元信息 + 总述 + 规则 + 矛盾
  var blockA = '【剧本】' + (sc.name||'') + ' ' + (sc.era||sc.dynasty||'') + ' ' + (sc.emperor||'') + '\n';
  if (sc.overview) blockA += '【总述全文】\n' + sc.overview + '\n';
  if (sc.globalRules) blockA += '【全局规则】\n' + sc.globalRules + '\n';
  if (pi.characterName) blockA += '【玩家】' + pi.characterName + (pi.characterTitle?'('+pi.characterTitle+')':'') + ' 势力:' + (pi.factionName||'') + ' 目标:' + (pi.factionGoal||'') + '\n';
  if (pi.characterBio) blockA += '  简介:' + pi.characterBio + '\n';
  if (pi.characterPersonality) blockA += '  性格:' + pi.characterPersonality + '\n';
  if (pi.coreContradictions && pi.coreContradictions.length > 0) {
    blockA += '【显著矛盾】\n';
    pi.coreContradictions.forEach(function(c) { blockA += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + ': ' + (c.description||'') + '\n'; });
  }

  // 块B: 全部角色（完整字段）——D10: 超过30人时动态压缩
  var _aliveChars = (GM.chars||[]).filter(function(c){ return c.alive !== false; });
  var _charCount = _aliveChars.length;
  var _compressChars = _charCount > 30; // 超过30人启用压缩模式
  var blockB = '【全部角色(' + _charCount + '人)——请逐个记住】\n';

  // 压缩模式下，按重要性排序：玩家>后妃>高品级>高记忆>其他
  if (_compressChars) {
    _aliveChars.sort(function(a, b) {
      var sa = (a.isPlayer ? 100 : 0) + (a.spouse ? 30 : 0) + ((10 - (a.rankLevel||9)) * 5) + ((a._memory||[]).length * 2) + ((a._scars||[]).length * 5);
      var sb = (b.isPlayer ? 100 : 0) + (b.spouse ? 30 : 0) + ((10 - (b.rankLevel||9)) * 5) + ((b._memory||[]).length * 2) + ((b._scars||[]).length * 5);
      return sb - sa;
    });
    blockB += '（角色较多，前30位高重要角色详述，其余精简。精简角色可参与群体事件但不宜作为独立行动主角）\n';
  }

  _aliveChars.forEach(function(c, _ci) {
    // D10: 压缩模式下，排名30之后的角色只注入一行精简信息
    var _isMinor = _compressChars && _ci >= 30;

    if (_isMinor) {
      // 精简模式：名字+势力+职务+忠诚+一个关键属性
      var _brief = c.name;
      if (c.faction) _brief += '(' + c.faction + ')';
      if (c.officialTitle && c.officialTitle !== '无') _brief += ' ' + c.officialTitle;
      else if (c.title) _brief += ' ' + c.title;
      _brief += ' 忠' + (c.loyalty||50);
      if (c.location && c.location !== (GM._capital||'京城')) _brief += ' 在' + c.location;
      blockB += '  ' + _brief + '\n';
      return;
    }

    // 完整模式
    var line = c.name;
    if (c.title) line += '(' + c.title + ')';
    if (c.faction) line += ' 势力:' + c.faction;
    if (c.officialTitle && c.officialTitle !== '无') line += ' 官职:' + c.officialTitle;
    if (c.party) line += ' 党派:' + c.party;
    if (c.isPlayer) line += ' ★玩家';
    line += ' 忠' + (c.loyalty||50) + ' 野' + (c.ambition||50) + ' 智' + (c.intelligence||50) + ' 武勇' + (c.valor||50) + ' 军事' + (c.military||50) + ' 政' + (c.administration||50) + ' 管' + (c.management||50) + ' 魅' + (c.charisma||50) + ' 交' + (c.diplomacy||50) + ' 仁' + (c.benevolence||50);
    // 追加特质行为倾向（若有）
    if (c.traits && c.traits.length > 0 && typeof getTraitBehaviorSummary === 'function') {
      var _tbs = getTraitBehaviorSummary(c.traits);
      if (_tbs) line += '\n     [特质]' + _tbs;
    }
    // 文事简况——让AI知道此人是否文人、代表作
    if (c.works && c.works.length > 0 && GM.culturalWorks) {
      var _cwMap = {};
      GM.culturalWorks.forEach(function(w){ _cwMap[w.id] = w; });
      var _myW = c.works.map(function(id) { return _cwMap[id]; }).filter(Boolean);
      if (_myW.length) {
        var _rep = _myW.slice(-3).map(function(w) { return '《' + w.title + '》' + (w.isPreserved?'★':''); }).join('、');
        line += '\n     [文事]作品' + _myW.length + '篇：' + _rep;
      }
    }
    // 关系网——最强5条关系（含标签/冲突/累积历史）
    if (typeof getTopRelations === 'function' && c.relations) {
      var _topR = getTopRelations(c.name, 5);
      if (_topR.length > 0) {
        var _relLines = _topR.map(function(t) { return typeof summarizeRelation === 'function' ? summarizeRelation(t.name, t.rel) : t.name; });
        line += '\n     [关系]' + _relLines.join('；');
      }
    }
    // 五常语义层
    if (typeof getWuchangText === 'function') line += ' ' + getWuchangText(c);
    // 家世门第
    if (typeof getFamilyStatusText === 'function') { var _fst = getFamilyStatusText(c); if (_fst) line += ' ' + _fst; }
    // 恩怨
    if (typeof EnYuanSystem !== 'undefined') { var _eyt = EnYuanSystem.getTextForChar(c.name); if (_eyt) line += ' ' + _eyt; }
    // 门生网络
    if (typeof PatronNetwork !== 'undefined') { var _pnt = PatronNetwork.getTextForChar(c.name); if (_pnt) line += ' ' + _pnt; }
    // 面子
    if (typeof FaceSystem !== 'undefined' && c._face !== undefined) line += ' ' + FaceSystem.getFaceText(c);
    // 特质名（比8D维度更可读）
    if (c.traitIds && c.traitIds.length > 0 && P.traitDefinitions) {
      var _tNames = c.traitIds.map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;});return d?d.name:'';}).filter(Boolean);
      if (_tNames.length) line += ' 特质:' + _tNames.join('·');
    }
    if (c.stance) line += ' 立场:' + c.stance;
    if (c.role && c.role !== c.title) line += ' 身份:' + c.role;
    if (c.faith) line += ' 信仰:' + c.faith;
    if (c.culture) line += ' 文化:' + c.culture;
    if (c.learning) line += ' 学识:' + c.learning;
    if (c.ethnicity) line += ' 民族:' + c.ethnicity;
    if (c.birthplace) line += ' 籍贯:' + c.birthplace;
    if (c.partyRank) line += '(' + c.partyRank + ')';
    if (c.location && c.location !== (GM._capital||'京城')) line += ' 在:' + c.location;
    if (c.bio) line += ' 简介:' + c.bio;
    if (c.personalGoal) line += ' 目标:' + c.personalGoal;
    if (c._goalSatisfaction !== undefined) line += '(满足' + Math.round(c._goalSatisfaction) + '%)';
    // 永久伤疤/勋章（一生中最深刻的经历）
    if (c._scars && c._scars.length > 0) {
      line += ' \u523B\u9AA8:' + c._scars.slice(-3).map(function(s) { return s.event + '[' + s.emotion + ']'; }).join(';');
    }
    if (c.personality) line += ' \u6027\u683C:' + String(c.personality);
    if (c.appearance) line += ' \u5916\u8C8C:' + String(c.appearance);
    if (c.spouse) line += ' [\u914D\u5076]';
    if (c.family) line += ' \u5BB6\u65CF:' + c.family;
    if (c.vassalType) line += ' 封臣:' + c.vassalType;
    blockB += '  ' + line + '\n';
  });

  // 块B2: NPC性格行为倾向（让AI理解NPC行为动机）
  if (typeof getNpcPersonalityInjection === 'function') {
    var _npcBrief = getNpcPersonalityInjection(8);
    if (_npcBrief) blockB += '\n' + _npcBrief + '\n';
  }

  // 块B3: NPC个人记忆+心绪（全员注入，分层详略）
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) {
    var _memLines = ['【全员心绪记忆——必须驱动NPC行为】'];
    var _allMemChars = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer; });

    // 模型倍率决定注入详细程度
    var _memScale = 1.0;
    if (typeof getCompressionParams === 'function') {
      _memScale = Math.max(0.6, Math.min(getCompressionParams().scale, 2.0));
    }
    var _t1Limit = Math.round(300 * _memScale); // 核心人物截断
    var _t2Limit = Math.round(180 * _memScale); // 重要人物截断
    var _t3EventLen = Math.round(20 * _memScale); // 一般人物事件截断

    // 按重要性分3层
    var _tier1 = []; // 核心人物 → 完整记忆
    var _tier2 = []; // 重要人物 → 精简记忆
    var _tier3 = []; // 一般人物 → 一行情绪

    _allMemChars.forEach(function(c) {
      var cap = NpcMemorySystem.getCapacity(c);
      var hasMemory = c._memory && c._memory.length > 0;
      var hasScars = c._scars && c._scars.length > 0;
      var maxImp = hasMemory ? c._memory.reduce(function(m,e){return Math.max(m,e.importance||0);},0) : 0;

      // 后妃/首领/高容量(≥50)角色→tier1
      if (c.spouse || cap.active >= 50) { _tier1.push(c); return; }
      // 有高importance记忆(≥6)或伤疤或高容量(≥30)→tier2
      if (maxImp >= 6 || hasScars || cap.active >= 30) { _tier2.push(c); return; }
      // 有记忆或情绪→tier3
      if (hasMemory || (c._mood && c._mood !== '平')) { _tier3.push(c); return; }
    });

    // Tier 1: 完整记忆上下文
    if (_tier1.length > 0) {
      _memLines.push('\n〔核心人物·完整记忆〕');
      _tier1.forEach(function(c) {
        var ctx = NpcMemorySystem.getMemoryContext(c.name);
        if (ctx) _memLines.push('★ ' + c.name + '：' + ctx.slice(0, _t1Limit));
      });
    }

    // Tier 2: 精简记忆
    if (_tier2.length > 0) {
      _memLines.push('\n〔重要人物·关键记忆〕');
      _tier2.sort(function(a,b) {
        var aM = (a._memory||[]).reduce(function(m,e){return Math.max(m,e.importance||0);},0);
        var bM = (b._memory||[]).reduce(function(m,e){return Math.max(m,e.importance||0);},0);
        return bM - aM;
      });
      _tier2.forEach(function(c) {
        var ctx = NpcMemorySystem.getMemoryContext(c.name);
        if (ctx) _memLines.push('- ' + c.name + '：' + ctx.slice(0, _t2Limit));
      });
    }

    // Tier 3: 一行情绪+最近事件
    if (_tier3.length > 0) {
      _memLines.push('\n〔一般人物·当前状态〕');
      var _t3Lines = _tier3.map(function(c) {
        var mood = c._mood || '平';
        var topMem = (c._memory && c._memory.length > 0) ? c._memory[c._memory.length - 1].event : '';
        var scar = (c._scars && c._scars.length > 0) ? '!' + c._scars[c._scars.length - 1].event : '';
        return c.name + '(' + mood + (topMem ? '·' + topMem : '') + scar + ')';
      });
      for (var _t3i = 0; _t3i < _t3Lines.length; _t3i += 3) {
        _memLines.push('  ' + _t3Lines.slice(_t3i, _t3i + 3).join('  '));
      }
    }

    _memLines.push('');
    _memLines.push('共' + (_tier1.length + _tier2.length + _tier3.length) + '人有记忆（核心' + _tier1.length + '+重要' + _tier2.length + '+一般' + _tier3.length + '，模型倍率×' + _memScale.toFixed(1) + '）');
    _memLines.push('【记忆→行为规则】所有有记忆的NPC，其行为必须与记忆一致。');
    _memLines.push('核心人物(★)的记忆逐条考虑；重要人物(-)的关键事件影响行为；一般人物的情绪体现在叙事中。');
    _memLines.push('特质(traitIds)叠加在记忆之上：狡诈者隐忍不发但暗中报复；坦诚者有仇当面说；勇猛者冲动行事；怯懦者逃避问题。');
    blockB += '\n' + _memLines.join('\n') + '\n';
  }

  // 块B4: NPC人际印象网络（让AI知道谁对谁有好感/敌意——驱动结盟/背叛）
  var _impLines = [];
  (GM.chars||[]).forEach(function(c) {
    if (c.alive === false || !c._impressions) return;
    var entries = [];
    for (var pn in c._impressions) {
      var imp = c._impressions[pn];
      if (Math.abs(imp.favor) >= 10) {
        var rel = imp.favor >= 25 ? '深信' : imp.favor >= 10 ? '好感' : imp.favor <= -25 ? '死仇' : '嫌恶';
        entries.push(pn + ':' + rel + '(' + imp.favor + ')');
      }
    }
    if (entries.length > 0) _impLines.push(c.name + '\u2192' + entries.join(' '));
  });
  if (_impLines.length > 0) {
    blockB += '\n【人际印象网络——NPC之间的好恶必须影响其行为选择】\n';
    blockB += _impLines.join('\n') + '\n';
    if (_impLines.length > 30) blockB += '...及另外' + (_impLines.length - 30) + '组关系\n';
  }

  // 块B5: 待铨进士（让AI知道有新人才可用）
  if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) {
    blockB += '\n【待铨进士（科举及第、尚未授官）】\n';
    GM._kejuPendingAssignment.forEach(function(p) {
      blockB += '  ' + p.name + '（第' + p.rank + '名，' + (p.origin||'') + '）等待' + (GM.turn - p.enrollTurn) + '回合\n';
    });
  }

  // 块C: 全部势力+党派+阶层+关系 —— D10: 超过30个势力时压缩
  var _facCount = (GM.facs||[]).length;
  var _compressFacs = _facCount > 30;
  var blockC = '【全部势力(' + _facCount + '个)】\n';
  // 压缩模式下按重要性排序
  var _sortedFacs = (GM.facs||[]).slice();
  if (_compressFacs) {
    _sortedFacs.sort(function(a, b) {
      var sa = (a.isPlayer ? 100 : 0) + (a.strength||50);
      var sb = (b.isPlayer ? 100 : 0) + (b.strength||50);
      return sb - sa;
    });
    blockC += '（势力较多，前30详述，其余精简）\n';
  }
  _sortedFacs.forEach(function(f, _fi) {
    // D10: 压缩模式下排名30之后的势力只注入一行
    if (_compressFacs && _fi >= 30) {
      blockC += '  ' + f.name + ' 实力' + (f.strength||50) + (f.leader ? ' 首领:'+f.leader : '') + (f.isPlayer ? ' ★' : '') + '\n';
      return;
    }
    var line = f.name + ' 实力' + (f.strength||50);
    if (f.leader) line += ' 首领:' + f.leader;
    if (f.type) line += ' 类型:' + f.type;
    if (f.territory) line += ' 领地:' + f.territory;
    if (f.goal) line += ' 目标:' + f.goal;
    if (f.attitude) line += ' 态度:' + f.attitude;
    if (f.leaderTitle) line += '(' + f.leaderTitle + ')';
    if (f.militaryStrength) line += ' \u5175\u529B:' + f.militaryStrength;
    if (f.economy) line += ' \u7ECF\u6D4E:' + f.economy;
    if (f.playerRelation !== undefined && f.playerRelation !== 0) line += ' \u5BF9\u7389\u5173\u7CFB:' + f.playerRelation;
    if (f.resources) line += ' \u8D44\u6E90:' + f.resources;
    if (f.mainstream) line += ' 主体:' + f.mainstream;
    if (f.culture) line += ' 文化:' + f.culture;
    if (f.description) line += ' 描述:' + f.description;
    if (f.vassals && f.vassals.length > 0) line += ' 封臣:[' + f.vassals.join(',') + ']';
    if (f.liege) line += ' 宗主:' + f.liege;
    if (f.isPlayer) line += ' ★玩家';
    // 势力深化字段
    if (f.cohesion && typeof f.cohesion === 'object') {
      var _cohParts = [];
      ['political','military','economic','cultural','ethnic','loyalty'].forEach(function(k){ if (f.cohesion[k]!=null) _cohParts.push(k[0].toUpperCase() + f.cohesion[k]); });
      if (_cohParts.length) line += ' \u51DD' + _cohParts.join(',');
    }
    if (f.militaryBreakdown) {
      var _mb = f.militaryBreakdown;
      var _mbParts = [];
      if (_mb.standingArmy) _mbParts.push('常'+_mb.standingArmy);
      if (_mb.militia) _mbParts.push('民兵'+_mb.militia);
      if (_mb.elite) _mbParts.push('精'+_mb.elite);
      if (_mb.fleet) _mbParts.push('舰'+_mb.fleet);
      if (_mbParts.length) line += ' 军:' + _mbParts.join('/');
    }
    if (f.succession) {
      line += ' 储君:' + (f.succession.designatedHeir||'未立') + '(' + (f.succession.rule||'') + ' 稳' + (f.succession.stability||60) + ')';
    }
    if (Array.isArray(f.internalParties) && f.internalParties.length > 0) line += ' 内部党派:[' + f.internalParties.join(',') + ']';
    if (Array.isArray(f.historicalEvents) && f.historicalEvents.length > 0) {
      var _recentH = f.historicalEvents.slice(-2).map(function(e){return 'T'+e.turn+':'+(e.event||'');}).join('；');
      line += ' 近事:' + _recentH;
    }
    blockC += '  ' + line + '\n';
  });
  if (GM.factionRelations && GM.factionRelations.length > 0) {
    blockC += '\u3010\u52BF\u529B\u5173\u7CFB\u3011\n';
    GM.factionRelations.forEach(function(r) { blockC += '  ' + r.from + '\u2192' + r.to + ' ' + (r.type||'') + '(' + (r.value||0) + ')' + (r.desc ? ' ' + r.desc : '') + '\n'; });
  }
  // 封臣关系实例
  var _vassalLines = [];
  (GM.facs || []).forEach(function(f) {
    if (f.vassals && f.vassals.length > 0) {
      f.vassals.forEach(function(vn) {
        var vf = GM.facs.find(function(ff) { return ff.name === vn; });
        _vassalLines.push('  ' + vn + '\u2192\u5B97\u4E3B:' + f.name + (vf && vf.tributeRate ? ' \u8D21' + Math.round(vf.tributeRate * 100) + '%' : ''));
      });
    }
  });
  if (_vassalLines.length > 0) {
    blockC += '\u3010\u5C01\u81E3\u5173\u7CFB\u3011\n' + _vassalLines.join('\n') + '\n';
  }
  // 头衔持有
  var _titleLines = [];
  (GM.chars || []).filter(function(c) { return c.alive !== false && c.titles && c.titles.length > 0; }).forEach(function(c) {
    c.titles.forEach(function(t) { _titleLines.push('  ' + c.name + ' \u6301\u6709:' + (t.titleName || t.name || t) + (t.hereditary ? '(\u4E16\u88AD)' : '')); });
  });
  if (_titleLines.length > 0) {
    blockC += '\u3010\u5934\u8854\u7235\u4F4D\u3011\n' + _titleLines.join('\n') + '\n';
  }
  if (GM.parties && GM.parties.length > 0) {
    blockC += '\u3010\u515A\u6D3E(' + GM.parties.length + '\u4E2A)\u3011\n';
    GM.parties.forEach(function(p) {
      var line = '  ' + p.name + ' \u5F71\u54CD' + (p.influence || 0);
      if (p.status) line += ' \u72B6\u6001:' + p.status;
      if (p.leader) line += ' \u9996\u9886:' + p.leader;
      if (p.ideology) line += ' \u7ACB\u573A:' + p.ideology;
      if (p.rivalParty) line += ' \u5BBF\u654C:' + p.rivalParty;
      if (p.currentAgenda) line += ' \u8BAE\u7A0B:' + p.currentAgenda;
      if (p.shortGoal) line += ' \u77ED\u671F\u76EE\u6807:' + p.shortGoal;
      if (p.longGoal) line += ' \u957F\u671F\u8FFD\u6C42:' + p.longGoal;
      if (p.policyStance) line += ' \u653F\u7B56:' + (Array.isArray(p.policyStance) ? p.policyStance.join('/') : p.policyStance);
      if (p.members) line += ' \u6210\u5458:' + p.members;
      if (p.base) line += ' \u57FA\u76D8:' + p.base;
      if (p.org) line += ' \u7EC4\u7EC7\u5EA6:' + p.org;
      if (p.description) line += ' ' + String(p.description);
      // 党派深化字段
      if (p.cohesion != null) line += ' 凝' + p.cohesion;
      if (p.memberCount) line += ' 党徒~' + p.memberCount;
      if (p.crossFaction) line += ' [跨势力]';
      if (p.splinterFrom) line += ' 分裂自:' + p.splinterFrom;
      if (Array.isArray(p.socialBase) && p.socialBase.length > 0) {
        line += ' 社会基础:' + p.socialBase.map(function(sb){return sb.class+'('+Math.round((sb.affinity||0)*10)/10+')';}).join('/');
      }
      if (Array.isArray(p.focal_disputes) && p.focal_disputes.length > 0) {
        line += ' 焦点:' + p.focal_disputes.slice(0,2).map(function(d){return d.topic+(d.rival?'↔'+d.rival:'');}).join('；');
      }
      if (Array.isArray(p.agenda_history) && p.agenda_history.length > 0) {
        var _recAH = p.agenda_history.slice(-2);
        line += ' 议程史:' + _recAH.map(function(a){return 'T'+a.turn+':'+(a.agenda||'');}).join('→');
      }
      if (Array.isArray(p.officePositions) && p.officePositions.length > 0) line += ' 掌控:[' + p.officePositions.slice(0,5).join(',') + ']';
      blockC += line + '\n';
    });
  }
  if (GM.classes && GM.classes.length > 0) {
    blockC += '\u3010\u9636\u5C42(' + GM.classes.length + '\u4E2A)\u3011\n';
    GM.classes.forEach(function(cl) {
      var line = '  ' + cl.name + ' \u6EE1\u610F' + (cl.satisfaction || 50) + ' \u5F71\u54CD' + (cl.influence || 0);
      if (cl.size) line += ' \u89C4\u6A21:' + cl.size;
      if (cl.economicRole) line += ' \u89D2\u8272:' + cl.economicRole;
      if (cl.status) line += ' \u5730\u4F4D:' + cl.status;
      if (cl.mobility) line += ' \u6D41\u52A8:' + cl.mobility;
      if (cl.privileges) line += ' \u7279\u6743:' + cl.privileges;
      if (cl.obligations) line += ' \u4E49\u52A1:' + cl.obligations;
      if (cl.demands) line += ' \u8BC9\u6C42:' + cl.demands;
      if (cl.unrestThreshold) line += ' \u4E0D\u6EE1\u9608\u503C:' + cl.unrestThreshold;
      if (cl.description) line += ' ' + String(cl.description);
      // 阶层深化字段
      if (Array.isArray(cl.representativeNpcs) && cl.representativeNpcs.length > 0) line += ' 代表:[' + cl.representativeNpcs.slice(0,3).join(',') + ']';
      if (Array.isArray(cl.leaders) && cl.leaders.length > 0) line += ' 领袖:[' + cl.leaders.slice(0,3).join(',') + ']';
      if (Array.isArray(cl.supportingParties) && cl.supportingParties.length > 0) line += ' 支持党派:[' + cl.supportingParties.join(',') + ']';
      if (Array.isArray(cl.internalFaction) && cl.internalFaction.length > 0) {
        line += ' 内部分化:' + cl.internalFaction.map(function(ifc){return ifc.name+(ifc.stance?'('+ifc.stance+')':'');}).join('/');
      }
      if (Array.isArray(cl.regionalVariants) && cl.regionalVariants.length > 0) {
        line += ' 地域:' + cl.regionalVariants.map(function(rv){return rv.region+':满'+(rv.satisfaction||'?');}).join('/');
      }
      if (cl.unrestLevels) {
        var _lvAlerts = [];
        if (cl.unrestLevels.grievance != null && cl.unrestLevels.grievance < 30) _lvAlerts.push('抱怨危');
        if (cl.unrestLevels.petition != null && cl.unrestLevels.petition < 30) _lvAlerts.push('请愿在即');
        if (cl.unrestLevels.strike != null && cl.unrestLevels.strike < 30) _lvAlerts.push('罢市');
        if (cl.unrestLevels.revolt != null && cl.unrestLevels.revolt < 20) _lvAlerts.push('⚠起义临界');
        if (_lvAlerts.length) line += ' ⚠分级不满:' + _lvAlerts.join(',');
      }
      if (cl.economicIndicators) {
        line += ' 富' + (cl.economicIndicators.wealth||50) + '/税' + (cl.economicIndicators.taxBurden||50) + '/田' + (cl.economicIndicators.landHolding||30);
      }
      blockC += line + '\n';
    });
    blockC += '  ※ 阶层 unrestLevels.revolt<10 触发 class_revolt 起义；推演须考虑阶层立场影响诏令执行与NPC行为\n';
  }

  // 3.2: 势力内部核心角色注入
  if (GM.facs && GM.chars) {
    GM.facs.forEach(function(f) {
      if (f.isPlayer) return; // 玩家势力角色已在blockB中详述
      var members = GM.chars.filter(function(c) { return c.alive !== false && c.faction === f.name; });
      if (members.length > 0) {
        blockC += '  ' + f.name + '\u6838\u5FC3\u4EBA\u7269\uFF1A';
        blockC += members.map(function(m) {
          return m.name + '(' + (m.title || '') + ' \u5FE0' + (m.loyalty || 50) + ' \u91CE' + (m.ambition || 50) + ')';
        }).join('\u3001');
        if (members.length > 5) blockC += '\u7B49' + members.length + '\u4EBA';
        blockC += '\n';
      }
    });
  }

  // 势力内部暗流（含历史趋势演变）
  if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) {
    blockC += '\n【各势力内部动态】\n';
    GM._factionUndercurrents.forEach(function(fu) {
      // 查找此势力前几轮的暗流趋势
      var trendHistory = '';
      if (GM._factionUndercurrentsHistory && GM._factionUndercurrentsHistory.length > 0) {
        var pastTrends = [];
        GM._factionUndercurrentsHistory.forEach(function(h) {
          var past = h.data.find(function(d) { return d.faction === fu.faction; });
          if (past) pastTrends.push('T' + h.turn + ':' + past.trend);
        });
        if (pastTrends.length > 0) trendHistory = ' 历史:' + pastTrends.join('→') + '→当前:' + (fu.trend||'');
      }
      blockC += '  ' + fu.faction + '：' + fu.situation + ' 趋势:' + (fu.trend||'') + trendHistory + (fu.nextMove ? ' 可能行动:' + fu.nextMove : '') + '\n';
    });
  }
  if (GM.activeSchemes && GM.activeSchemes.length > 0) {
    blockC += '\n【正在酝酿的阴谋（跨回合持续，AI应推进或让其爆发/失败）】\n';
    GM.activeSchemes.forEach(function(sc2) {
      blockC += '  ' + sc2.schemer + (sc2.target ? '→' + sc2.target : '') + '：' + sc2.plan + ' [' + sc2.progress + '，始于T' + sc2.startTurn + ']\n';
    });
  }

  // 近期势力事件摘要（让AI看到势力最近做了什么，保持叙事连续性）
  if (GM.factionEvents && GM.factionEvents.length > 0) {
    var recentFE = GM.factionEvents.filter(function(e) { return e.turn >= GM.turn - 3; });
    if (recentFE.length > 0) {
      blockC += '\n【近3回合势力大事记——叙事应延续这些事件的后果】\n';
      recentFE.slice(-12).forEach(function(e) {
        blockC += '  T' + e.turn + ' ' + e.actor + (e.target ? '\u2192' + e.target : '') + '\uFF1A' + (e.action || '') + (e.result ? '(' + e.result + ')' : '') + '\n';
      });
    }
  }

  // 3.3: 势力发展叙事注入
  if (GM._factionNarrative && typeof GM._factionNarrative === 'object') {
    var _fnKeys = Object.keys(GM._factionNarrative);
    if (_fnKeys.length > 0) {
      blockC += '\n\u3010\u52BF\u529B\u53D1\u5C55\u53D9\u4E8B\uFF08\u4E0A\u56DE\u5408AI\u603B\u7ED3\uFF09\u3011\n';
      _fnKeys.forEach(function(k) { blockC += '  ' + k + '\uFF1A' + GM._factionNarrative[k] + '\n'; });
    }
  }

  // 势力关系多维矩阵（含累积历史账本）
  if (GM.factionRelationsMap && Object.keys(GM.factionRelationsMap).length > 0) {
    var _mats = [];
    Object.keys(GM.factionRelationsMap).forEach(function(a) {
      Object.keys(GM.factionRelationsMap[a]).forEach(function(b) {
        if (typeof summarizeFactionRelation === 'function') {
          var s = summarizeFactionRelation(a, b);
          if (s) _mats.push('  '+s);
        }
      });
    });
    if (_mats.length > 0) {
      blockC += '\n【势力多维关系矩阵——推演必须尊重历史账本】\n';
      blockC += _mats.slice(0, 30).join('\n') + '\n';
    }
  }

  // 势力实力趋势（从历史快照提取，让AI看到"由盛转衰"或"稳步上升"）
  if (GM._factionHistory && GM._factionHistory.length >= 3) {
    blockC += '\n【势力实力趋势（近' + GM._factionHistory.length + '回合）——推演时必须延续趋势或给出转折理由】\n';
    GM.facs.forEach(function(f) {
      var history = GM._factionHistory.map(function(h) { return h.factions[f.name] ? h.factions[f.name].strength : null; }).filter(function(v) { return v !== null; });
      if (history.length < 3) return;
      var first = history[0], last = history[history.length - 1];
      var delta = last - first;
      var trend = delta > 8 ? '持续上升' : delta > 3 ? '缓慢上升' : delta < -8 ? '急剧衰落' : delta < -3 ? '缓慢衰落' : '基本稳定';
      var sparkline = history.map(function(v) { return Math.round(v); }).join('→');
      blockC += '  ' + f.name + ': ' + sparkline + ' (' + trend + ')\n';
    });
  }

  // 2.1: 活跃剧情线注入
  if (GM._plotThreads && GM._plotThreads.length > 0) {
    var _activeThreads = GM._plotThreads.filter(function(t) { return t.status !== 'resolved'; });
    if (_activeThreads.length > 0) {
      var _stallThresh = (typeof turnsForDuration === 'function') ? turnsForDuration('3months') : 3;
      blockC += '\n\u3010\u6D3B\u8DC3\u5267\u60C5\u7EBF\u2014\u2014\u5FC5\u987B\u63A8\u8FDB\u6BCF\u4E00\u6761\u6216\u89E3\u91CA\u641E\u7F6E\u539F\u56E0\u3011\n';
      _activeThreads.forEach(function(t) {
        var age = GM.turn - (t.lastUpdateTurn || t.startTurn);
        var stalled = age >= _stallThresh;
        var icon = t.status === 'climax' ? '\u2605' : stalled ? '\u26A0\uFE0F' : '\u25CF';
        blockC += icon + ' [' + (t.threadType || '?') + '\u00B7P' + (t.priority || 3) + '] ' + t.title;
        blockC += '\uFF08T' + t.startTurn + '\u8D77\uFF0C\u4E0A\u6B21\u66F4\u65B0T' + (t.lastUpdateTurn || t.startTurn);
        if (stalled) blockC += ' \u2014\u5DF2' + age + '\u56DE\u5408\u672A\u66F4\u65B0\uFF01';
        blockC += '\uFF09';
        if (t.updates && t.updates.length > 0) {
          blockC += '\uFF1A' + t.updates[t.updates.length - 1].text;
        }
        blockC += '\n';
      });
    }
  }

  // N1: 到期的决策延时后果注入
  if (GM._decisionEchoes && GM._decisionEchoes.length > 0) {
    var _dueEchoes = GM._decisionEchoes.filter(function(e) { return !e.applied && e.echoTurn <= GM.turn; });
    if (_dueEchoes.length > 0) {
      blockC += '\n\u3010\u5386\u53F2\u51B3\u7B56\u7684\u5EF6\u65F6\u540E\u679C\u2014\u2014\u672C\u56DE\u5408\u5FC5\u987B\u5728\u53D9\u4E8B\u4E2D\u4F53\u73B0\u3011\n';
      _dueEchoes.forEach(function(e) {
        blockC += '  T' + e.turn + '\u7684\u51B3\u7B56\u201C' + e.content + '\u201D\u2192' + e.echoDesc + ' [' + e.echoType + ']\n';
      });
    }
  }

  // 块D: 世界设定+时代状态（完整）
  var blockD = '';
  if (P.worldSettings) {
    blockD += '【世界设定——完整文本】\n';
    var wsLabels = {culture:'文化风俗',weather:'气候天象',religion:'宗教信仰',economy:'经济形态',technology:'技术水平',diplomacy:'外交格局'};
    ['culture','weather','religion','economy','technology','diplomacy'].forEach(function(k) {
      if (P.worldSettings[k]) blockD += '  [' + wsLabels[k] + ']\n  ' + P.worldSettings[k] + '\n';
    });
  }
  if (GM.eraState) {
    blockD += '【时代状态】政治统一' + (GM.eraState.politicalUnity||0.5) + ' 集权' + (GM.eraState.centralControl||0.5) + ' 社会稳定' + (GM.eraState.socialStability||0.5) + ' 经济' + (GM.eraState.economicProsperity||0.5) + ' 文化' + (GM.eraState.culturalVibrancy||0.5) + ' 官僚' + (GM.eraState.bureaucracyStrength||0.5) + ' 军事' + (GM.eraState.militaryProfessionalism||0.5);
    blockD += ' 正统:' + (GM.eraState.legitimacySource||'') + ' 土地:' + (GM.eraState.landSystemType||'') + ' 阶段:' + (GM.eraState.dynastyPhase||'');
    if (GM.eraState.contextDescription) blockD += '\n  背景:' + GM.eraState.contextDescription;
    blockD += '\n';
  }
  if (P.rules && typeof P.rules === 'object' && !Array.isArray(P.rules)) {
    blockD += '【推演规则——完整文本】\n';
    ['base','combat','economy','diplomacy'].forEach(function(k) { if (P.rules[k]) blockD += '  [' + k + '] ' + P.rules[k] + '\n'; });
  }

  // 块E: 官制+行政（完整）
  var blockE = '';
  if (GM.officeTree && GM.officeTree.length > 0) {
    blockE += '【官制体系——完整树】\n';
    (function _gd(nodes, d) { nodes.forEach(function(n) {
      blockE += '  '.repeat(d) + n.name + (n.desc?' - '+n.desc:'');
      if (n.functions && n.functions.length) blockE += ' 职能:[' + n.functions.join(',') + ']';
      blockE += '\n';
      if (n.positions) n.positions.forEach(function(p) {
        var est = p.establishedCount != null ? p.establishedCount : (parseInt(p.headCount,10) || 1);
        var vac = p.vacancyCount != null ? p.vacancyCount : 0;
        var occ = Math.max(0, est - vac);
        var ah = Array.isArray(p.actualHolders) ? p.actualHolders : [];
        var namedHolders = ah.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
        var placeholderCount = ah.filter(function(h){return h && h.generated===false;}).length;
        blockE += '  '.repeat(d+1) + '官:' + p.name + (p.rank?'('+p.rank+')':'');
        blockE += ' 编'+est+(vac?'·缺'+vac:'')+'·在'+occ;
        if (namedHolders.length > 0) blockE += ' 已知任职:'+namedHolders.join('/');
        if (placeholderCount > 0) blockE += ' ⚐'+placeholderCount+'位在职未具名(需时可 office_spawn 实体化)';
        if (p.succession) blockE += ' ['+p.succession+']';
        if (p.historicalRecord) blockE += ' 据:'+p.historicalRecord;
        if (p.duties) blockE += ' 职责:'+p.duties.slice(0,60);
        blockE += '\n';
      });
      if (n.subs) _gd(n.subs, d+1);
    }); })(GM.officeTree, 1);
  }
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(k) {
      var ah = P.adminHierarchy[k];
      if (!ah || !ah.divisions || ah.divisions.length === 0) return;
      blockE += '【行政区划——完整树】\n';
      (function _ad(divs, d) { divs.forEach(function(dv) {
        blockE += '  '.repeat(d) + dv.name + (dv.level?'('+dv.level+')':'') + (dv.governor?' 官:'+dv.governor:'') + (dv.population?' 人口'+dv.population:'') + (dv.prosperity?' 繁荣'+dv.prosperity:'') + (dv.terrain?' '+dv.terrain:'') + (dv.specialResources?' 产:'+dv.specialResources:'') + '\n';
        if (dv.children) _ad(dv.children, d+1);
      }); })(ah.divisions, 1);
    });
  }

  // 块F: 军事+变量+经济
  var blockF = '';
  if (GM.armies && GM.armies.length > 0) {
    blockF += '【军事力量(' + GM.armies.length + '支)——完整数据】\n';
    GM.armies.forEach(function(a) {
      var _aLine = '  ' + a.name + ' \u5175' + (a.soldiers||0) + ' \u58EB\u6C14' + (a.morale||50) + ' \u8BAD\u7EC3' + (a.training||50);
      if (a.commander) _aLine += ' \u5E05:' + a.commander;
      if (a.faction) _aLine += ' \u5C5E:' + a.faction;
      if (a.garrison) _aLine += ' \u9A7B:' + a.garrison;
      if (a.armyType) _aLine += ' \u578B:' + a.armyType;
      if (a.quality) _aLine += ' \u8D28:' + a.quality;
      if (a.loyalty) _aLine += ' \u5FE0:' + a.loyalty;
      if (a.equipmentCondition) _aLine += ' \u88C5\u5907:' + a.equipmentCondition;
      if (a.activity) _aLine += ' \u72B6\u6001:' + a.activity;
      if (a.composition && a.composition.length) _aLine += ' \u7F16\u5236:' + a.composition.map(function(c){return c.type+(c.count?'*'+c.count:'');}).join('/');
      blockF += _aLine + '\n';
    });
  }
  if (GM.vars && Object.keys(GM.vars).length > 0) {
    blockF += '【资源变量——完整】\n';
    Object.entries(GM.vars).forEach(function(e) { blockF += '  ' + e[0] + '=' + e[1].value + (e[1].unit||'') + ' [' + (e[1].min||0) + '~' + (e[1].max||'?') + ']' + (e[1].calcMethod?' 算法:'+e[1].calcMethod:'') + (e[1].description?' '+e[1].description:'') + '\n'; });
  }
  if (P.economyConfig && P.economyConfig.enabled) {
    blockF += '【经济配置】货币:' + (P.economyConfig.currency||'') + ' 基收:' + (P.economyConfig.baseIncome||0) + ' 税率:' + (P.economyConfig.taxRate||0) + ' 通胀:' + (P.economyConfig.inflationRate||0) + ' 贸易:' + (P.economyConfig.tradeBonus||0) + '\n';
  }

  // 块G: 事件+时间线+目标
  var blockG = '';
  if (GM.events && GM.events.length > 0) {
    blockG += '【全部事件(' + GM.events.length + '个)——完整】\n';
    GM.events.forEach(function(e) { blockG += '  [' + (e.type||'') + (e.importance?' '+e.importance:'') + '] ' + e.name + (e.trigger?' 条件:'+e.trigger:'') + (e.effect?' 效果:'+e.effect:'') + (e.description?' '+e.description:'') + (e.chainNext?' →链:'+e.chainNext:'') + '\n'; });
  }
  if (P.timeline) {
    var tl = [].concat(P.timeline.past||[]).concat(P.timeline.future||[]);
    if (tl.length > 0) {
      blockG += '【时间线(' + tl.length + '项)】\n';
      tl.forEach(function(t) { blockG += '  ' + (t.year||'') + ' ' + (t.name||t.event||'') + (t.type==='future'?' [未来]':'') + (t.description?' '+t.description:'') + '\n'; });
    }
  }
  if (P.goals && P.goals.length > 0) {
    blockG += '【目标条件(' + P.goals.length + '个)】\n';
    P.goals.forEach(function(g) { blockG += '  [' + (g.type||'') + '] ' + g.name + (g.description?' '+g.description:'') + '\n'; });
  }

  // 编年纪事（全部未完结叙事线索，含伏笔标记）
  if (GM.biannianItems && GM.biannianItems.length > 0) {
    var _activeBN = GM.biannianItems.filter(function(b) { return !b._resolved; });
    if (_activeBN.length > 0) {
      blockG += '\u3010\u7F16\u5E74\u7EAA\u4E8B\u2014\u2014\u5168\u90E8\u8FDB\u884C\u4E2D\u7684\u53D9\u4E8B\u7EBF(' + _activeBN.length + '\u6761)\u3011\n';
      _activeBN.forEach(function(b) {
        blockG += '  ' + (b.name || b.title || '') + (b._isForeshadow ? '(\u4F0F\u7B14)' : '') + ' T' + (b.turn || b.startTurn || '?') + (b.content ? ' ' + String(b.content) : '') + '\n';
      });
    }
  }
  // 纪事本末（全部奏疏批复记录——反映玩家决策轨迹）
  if (GM.jishiRecords && GM.jishiRecords.length > 0) {
    blockG += '\u3010\u594F\u758F\u6279\u590D\u8BB0\u5F55(' + GM.jishiRecords.length + '\u6761)\u3011\n';
    GM.jishiRecords.forEach(function(j) {
      blockG += '  T' + (j.turn || '?') + ' ' + (j.from || j.char || '') + ': ' + String(j.title || j.content || j.playerSaid || '') + (j.reply ? ' \u2192\u6731\u6279:' + String(j.reply) : (j.npcSaid ? ' ' + String(j.npcSaid) : '')) + '\n';
    });
  }
  // 预设历史事件提示（让AI知道即将到来的剧本事件）
  if (P.rigidHistoryEvents && P.rigidHistoryEvents.length > 0) {
    var _untriggered = P.rigidHistoryEvents.filter(function(e) { return !GM.triggeredHistoryEvents || !GM.triggeredHistoryEvents[e.id]; });
    if (_untriggered.length > 0) {
      blockG += '\u3010\u5386\u53F2\u8FDB\u7A0B\u63D0\u793A\u3011\u5269\u4F59' + _untriggered.length + '\u4E2A\u9884\u8BBE\u4E8B\u4EF6\u5F85\u89E6\u53D1\uFF08AI\u5E94\u5728\u53D9\u4E8B\u4E2D\u4E3A\u5176\u94FA\u57AB\uFF09\n';
      _untriggered.forEach(function(e) {
        blockG += '  ' + e.name + (e.trigger && e.trigger.year ? ' \u89E6\u53D1\u5E74:' + e.trigger.year : '') + (e.description ? ' ' + String(e.description) : '') + '\n';
      });
    }
  }

  // ═══ 块H: 缺失的15个数据源——全部补齐 ═══
  var blockH = '';

  // 开场白
  if (sc.opening || sc.openingText) blockH += '【开场白】\n' + (sc.opening || sc.openingText || '') + '\n';

  // 物品
  if (GM.items && GM.items.length > 0) {
    blockH += '【物品(' + GM.items.length + '件)】\n';
    GM.items.forEach(function(it) { blockH += '  ' + it.name + (it.type?' ['+it.type+']':'') + (it.rarity?' '+it.rarity:'') + (it.value?' \u4EF7:'+it.value:'') + (it.owner?' \u6301\u6709:'+it.owner:'') + (it.effect?' \u6548\u679C:'+it.effect:'') + (it.description?' '+it.description:'') + '\n'; });
  }

  // 科技树
  if (GM.techTree && GM.techTree.length > 0) {
    blockH += '【科技树(' + GM.techTree.length + '项)】\n';
    GM.techTree.forEach(function(t) { blockH += '  ' + t.name + (t.era?' ['+t.era+']':'') + (t.unlocked?' ★已研':'') + (t.prereqs&&t.prereqs.length?' 前置:'+t.prereqs.join(','):'') + (t.description?' '+t.description:'') + '\n'; });
  }

  // 民政树
  if (GM.civicTree && GM.civicTree.length > 0) {
    blockH += '【民政树(' + GM.civicTree.length + '项)】\n';
    GM.civicTree.forEach(function(c) { blockH += '  ' + c.name + (c.category?' ['+c.category+']':'') + (c.adopted?' ★已用':'') + (c.description?' '+c.description:'') + '\n'; });
  }


  // 封臣类型
  if (P.vassalSystem && P.vassalSystem.vassalTypes && P.vassalSystem.vassalTypes.length > 0) {
    blockH += '【封臣类型(' + P.vassalSystem.vassalTypes.length + '种)】\n';
    P.vassalSystem.vassalTypes.forEach(function(v) { blockH += '  ' + v.name + (v.rank?' '+v.rank:'') + (v.controlLevel?' '+v.controlLevel:'') + (v.succession?' 继承:'+v.succession:'') + (v.obligations?' 义务:'+v.obligations:'') + (v.rights?' 权利:'+v.rights:'') + '\n'; });
  }

  // 头衔等级
  if (P.titleSystem && P.titleSystem.titleRanks && P.titleSystem.titleRanks.length > 0) {
    blockH += '【头衔体系(' + P.titleSystem.titleRanks.length + '级)】\n';
    P.titleSystem.titleRanks.forEach(function(t) { blockH += '  ' + t.name + ' Lv' + (t.level||0) + (t.category?' '+t.category:'') + (t.succession?' 继承:'+t.succession:'') + (t.privileges?' 特权:'+t.privileges:'') + '\n'; });
  }

  // 建筑类型
  if (P.buildingSystem && P.buildingSystem.buildingTypes && P.buildingSystem.buildingTypes.length > 0) {
    blockH += '【建筑类型(' + P.buildingSystem.buildingTypes.length + '种)——效果由AI根据描述综合判定】\n';
    P.buildingSystem.buildingTypes.forEach(function(b) {
      blockH += '  · ' + b.name + (b.category?' ['+b.category+']':'') + (b.maxLevel?' 最高Lv'+b.maxLevel:'') + (b.baseCost?' 成本'+b.baseCost+'两':'') + (b.buildTime?' 工期'+b.buildTime+'回合':'') + '\n';
      if (b.description) blockH += '    ' + b.description.substring(0,250) + '\n';
    });
    blockH += '  ※ 推演原则：建筑效果(收入/征兵/防御/文化/繁荣等)由AI根据上述描述+所在地形/经济/民心自行综合判定，不存在固定数值表\n';
    // 注入已建成的建筑状态（territory.buildings）
    var _builtBuildings = [];
    (P.adminHierarchy && Object.keys(P.adminHierarchy)).forEach && Object.keys(P.adminHierarchy||{}).forEach(function(fk) {
      var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.buildings && d.buildings.length) {
            d.buildings.forEach(function(bd) {
              _builtBuildings.push(d.name + ':' + bd.name + (bd.level?'(Lv'+bd.level+')':'') + (bd.status==='building'?'[建造中'+(bd.remainingTurns||'?')+'回合]':''));
            });
          }
          if (d.children) _walk(d.children);
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
    if (_builtBuildings.length > 0) blockH += '  【已建成/在建】' + _builtBuildings.slice(0,30).join('；') + '\n';
  }

  // 皇城宫殿系统
  if (P.palaceSystem && P.palaceSystem.enabled && P.palaceSystem.palaces && P.palaceSystem.palaces.length > 0) {
    blockH += '【皇城·' + (P.palaceSystem.capitalName || '皇城') + '(' + P.palaceSystem.palaces.length + '处宫殿)】\n';
    if (P.palaceSystem.capitalDescription) blockH += '  ' + P.palaceSystem.capitalDescription.substring(0, 200) + '\n';
    // 按type分组简述
    var _palGroups = {};
    P.palaceSystem.palaces.forEach(function(p) { (_palGroups[p.type] = _palGroups[p.type] || []).push(p); });
    var _palTypeLabels = { main_hall:'外朝主殿', imperial_residence:'帝居', consort_residence:'后妃居所', dowager:'太后宫', crown_prince:'太子宫', ceremonial:'礼制', garden:'园林', office:'内廷', offering:'祭祀' };
    Object.keys(_palGroups).forEach(function(t) {
      blockH += '  〔' + (_palTypeLabels[t] || t) + '〕';
      _palGroups[t].forEach(function(p) {
        blockH += p.name + (p.status && p.status !== 'intact' ? '(' + p.status + ')' : '') + '；';
      });
      blockH += '\n';
    });
    // 妃嫔居所分配——叙事中须用具体宫殿名
    blockH += '  【居所分配——叙事中须准确使用宫殿名】\n';
    P.palaceSystem.palaces.forEach(function(p) {
      if (!p.subHalls) return;
      p.subHalls.forEach(function(sh) {
        if (sh.occupants && sh.occupants.length) {
          blockH += '    ' + p.name + '·' + sh.name + '(' + sh.role + ')：' + sh.occupants.join('、') + '\n';
        }
      });
    });
    blockH += '  ※ 推演原则：后宫叙事须使用具体宫殿与殿名(如"帝幸储秀宫正殿"而非笼统"后宫")；修建/修缮/移居由AI通过palace_changes返回\n';
  }

  // 文事作品——注入最近传世之作（防膨胀：最多 20 条）
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _recentWorks = GM.culturalWorks.filter(function(w) {
      return w.isPreserved || (GM.turn - (w.turn || 0) <= 10) || (w.quality || 0) >= 85;
    }).slice(-20);
    if (_recentWorks.length > 0) {
      blockH += '【文事作品(已有 ' + GM.culturalWorks.length + ' 篇，近期节选 ' + _recentWorks.length + ')】\n';
      _recentWorks.forEach(function(w) {
        blockH += '  · [' + (w.genre || '') + '] ' + (w.author || '?') + '《' + (w.title || '?') + '》';
        if (w.trigger) blockH += ' ('+ w.trigger +')';
        if (w.politicalImplication) blockH += ' ⚠' + w.politicalImplication.substring(0, 40);
        if (w.quality) blockH += ' 品'+w.quality;
        blockH += '\n';
      });
      blockH += '  ※ 推演原则：新作与旧作之间可次韵酬答；叙事可引用旧作意象；讽谕作品余波未平\n';
    }
  }

  // 岗位规则
  if (P.postSystem && P.postSystem.postRules && P.postSystem.postRules.length > 0) {
    blockH += '【岗位规则(' + P.postSystem.postRules.length + '条)】\n';
    P.postSystem.postRules.forEach(function(r) { blockH += '  ' + (r.positionName||r.name||'') + ' 继任:' + (r.succession||'') + (r.hasAppointmentRight?' [有辟署权]':'') + (r.description?' '+r.description:'') + '\n'; });
  }

  // 科举
  if (P.keju && P.keju.enabled) {
    blockH += '【科举制度】' + (P.keju.examIntervalNote||'已启用') + (P.keju.examSubjects?' 科目:'+P.keju.examSubjects:'') + (P.keju.quotaPerExam?' 取士:'+P.keju.quotaPerExam:'') + (P.keju.specialRules?' 规则:'+P.keju.specialRules:'') + '\n';
    if (P.keju.examNote) blockH += '  ' + P.keju.examNote + '\n';
  }

  // 后宫
  if (GM.harem) {
    blockH += '【后宫制度】继承:' + (GM.harem.succession||'eldest_legitimate');
    if (GM.harem.haremDescription) blockH += ' ' + GM.harem.haremDescription;
    if (GM.harem.motherClanSystem) blockH += ' 外戚:' + GM.harem.motherClanSystem;
    blockH += '\n';
    if (GM.harem.rankSystem && GM.harem.rankSystem.length > 0) {
      blockH += '  位份:' + GM.harem.rankSystem.map(function(r){return r.name+'(Lv'+r.level+')';}).join('→') + '\n';
    }
    var _spouses = (GM.chars||[]).filter(function(c){return c.alive!==false&&c.spouse;});
    if (_spouses.length > 0) {
      blockH += '  妃嫔:' + _spouses.map(function(s){return s.name+(s.spouseRank?'('+s.spouseRank+')':'');}).join('、') + '\n';
    }
  }

  // 地方区划
  if (GM.provinceStats && Object.keys(GM.provinceStats).length > 0) {
    blockH += '【地方区划(' + Object.keys(GM.provinceStats).length + '个)】\n';
    Object.entries(GM.provinceStats).forEach(function(e) {
      var ps = e[1];
      blockH += '  ' + e[0] + ' 人口' + (ps.population||0) + ' 财' + (ps.wealth||0) + ' 稳' + (ps.stability||0) + ' 税' + (ps.taxRevenue||0) + (ps.governor?' 官:'+ps.governor:'') + (ps.terrain?' '+ps.terrain:'') + '\n';
    });
  }

  // 变量公式（结构化强制指令）
  if (GM._varFormulas && GM._varFormulas.length > 0) {
    var _typeLabels = {income:'收支',constraint:'约束',trigger:'触发',coupling:'联动',ratio:'比例'};
    blockH += '【变量公式·强制执行（' + GM._varFormulas.length + '条）】\n';
    blockH += '⚠ 以下公式是resource_changes的强制计算规则，AI必须严格遵守：\n';
    GM._varFormulas.forEach(function(f) {
      blockH += '  [' + (_typeLabels[f.type]||'规则') + '] ' + f.name + '：' + (f.expression||'') + '\n';
      if (f.chains && f.chains.length > 0) {
        blockH += '    链式影响：' + f.chains.join('；') + '\n';
      }
    });
    blockH += '  规则：\n';
    blockH += '  1. income类公式：每回合resource_changes必须体现收支计算，数值应与公式一致\n';
    blockH += '  2. constraint类：resource_changes不得使变量违反约束（如粮食不可为负）\n';
    blockH += '  3. trigger类：当变量达到阈值时，叙事和事件必须反映触发效果\n';
    blockH += '  4. coupling类：改变一个变量时，关联变量必须同步变化\n';
    blockH += '  5. ratio类：相关变量必须维持公式定义的比例关系\n';
  }

  var sysPre = '你是一个顶级历史模拟AI的记忆核心模块。你即将开始模拟' + (sc.era||sc.dynasty||'一个历史时期') + '。请极其仔细地阅读以下内容，记住每一个角色、每一个势力、每一条规则、每一件物品、每一项制度。你的分析质量将直接决定后续数十回合的叙事深度。不要遗漏任何细节。';

  try {
    // ═══ Call 1/10: 剧本概要+矛盾 ═══
    prog(1, '深度阅读(1/12) 剧本概要与矛盾...');
    var r1 = await _call(sysPre, blockA + '\n\n请返回JSON：{"era_essence":"这个时代的本质特征和核心氛围(150字)","contradiction_analysis":"各矛盾之间的联动关系和演化趋势(150字)","player_dilemma":"玩家面临的核心两难困境(100字)"}', 600);

    // ═══ Call 2/8: 角色深度分析 ═══
    prog(2, '深度阅读(2/8) 全部角色...');
    var r2 = await _call(sysPre, blockB + '\n\n请返回JSON：{"character_web":"角色间的关系网络——忠诚、对立、暗流(200字)","dangerous_figures":"最危险的3个NPC及其可能行动(150字)","loyal_allies":"玩家最可靠的盟友及其弱点(100字)","hidden_agendas":"可能隐藏野心或秘密目标的角色(100字)"}', 800);

    // ═══ Call 3/8: 势力+党派+阶层分析 ═══
    prog(3, '深度阅读(3/8) 势力与党派格局...');
    var r3 = await _call(sysPre, blockC + '\n\n请返回JSON：{"faction_balance":"势力间的力量平衡和战略态势(200字)","alliance_possibilities":"可能形成的联盟和对抗阵营(100字)","party_struggle":"党争的核心焦点和可能走向(100字)","class_tensions":"阶层间的主要矛盾和爆发点(100字)","vassal_risks":"封臣体系中的不稳定因素(80字)"}', 800);

    // ═══ Call 4/8: 世界设定+规则 ═══
    prog(4, '深度阅读(4/10) 世界设定与规则...');
    var r4 = await _call(sysPre, blockD + '\n\n请返回JSON：{"world_atmosphere":"世界的整体氛围和时代精神——从视觉、听觉、情感三个层面描述(250字)","rule_implications":"规则对推演的核心约束——哪些事不能做、哪些事必须做、哪些事有代价(200字)","cultural_dynamics":"文化和宗教对政治的深层影响——信仰冲突、礼制之争、文化认同(200字)","economic_logic":"经济体系的完整运作逻辑——收入来源、支出项目、脆弱点、改革空间(200字)"}', 1200);

    // ═══ Call 5/10: 官制体系深度 ═══
    prog(5, '深度阅读(5/10) 官制体系...');
    var r5 = await _call(sysPre, blockE + '\n\n请返回JSON：{"bureaucratic_state":"官僚体系的运作状态——各部门效率、人员构成、派系分布(200字)","power_network":"权力网络——谁控制什么、谁依附谁、哪些职位是关键节点(200字)","vacant_critical":"最需要填补的关键空缺及最佳人选建议(150字)","succession_risks":"继任风险——哪些关键岗位的现任者可能出问题(100字)","governance_reform":"治理改革空间——哪些制度可以优化、风险是什么(150字)"}', 1200);

    // ═══ Call 6/10: 行政区划深度 ═══
    prog(6, '深度阅读(6/10) 行政区划与地方治理...');
    var r6admin = await _call(sysPre, blockE + '\n\n请返回JSON：{"regional_strengths":"各行政区的经济军事优势——哪里富庶、哪里有兵、哪里产粮(200字)","regional_risks":"各区域的风险——哪里可能叛乱、哪里治理薄弱、哪里边防空虚(200字)","governor_assessment":"各地方官的能力评估——谁称职、谁贪腐、谁可能反叛(150字)","territorial_strategy":"领土战略——应优先发展哪里、防守哪里、进攻哪里(150字)"}', 1000);

    // ═══ Call 7/10: 军事+经济深度 ═══
    prog(7, '深度阅读(7/10) 军事与经济...');
    var r7mil = await _call(sysPre, blockF + '\n\n请返回JSON：{"military_assessment":"军事力量的完整评估——各军实力对比、统帅能力、士气状况、装备水平(250字)","economic_outlook":"财政完整状况——收入结构、支出压力、储备情况、经济前景(200字)","war_scenarios":"最可能的战争场景——谁打谁、何时、在哪里、胜算几何(200字)","resource_crises":"资源危机预警——哪些资源即将耗尽、影响什么、如何应对(150字)","military_reform":"军事改革方向——当前军制的缺陷和改进空间(100字)"}', 1200);

    // ═══ Call 8/10: 事件+时间线深度 ═══
    prog(8, '深度阅读(8/10) 事件与时间线...');
    var r8evt = await _call(sysPre, blockG + '\n\n请返回JSON：{"event_priorities":"最应优先触发的事件及详细时机和触发方式(200字)","timeline_foreshadow":"时间线中需要提前铺垫的未来事件——具体铺垫方式(200字)","goal_strategy":"实现各目标的详细策略路径——步骤和风险(200字)","narrative_arcs":"最有戏剧张力的5条叙事弧线——起承转合设计(200字)","chain_reactions":"事件间的连锁反应链——A发生→B必然→C可能(150字)"}', 1200);

    // ═══ Call 9/10: 角色个体深度分析 ═══
    prog(9, '深度阅读(9/10) 角色个体深度分析...');
    var topChars = (GM.chars||[]).filter(function(c){return c.alive!==false;}).sort(function(a,b){
      var sa = (a.isPlayer?100:0) + Math.abs(50-(a.loyalty||50)) + (a.ambition||50);
      var sb = (b.isPlayer?100:0) + Math.abs(50-(b.loyalty||50)) + (b.ambition||50);
      return sb - sa;
    });
    var charDeepBlock = '请逐个分析以下关键角色的内心世界和行为预测：\n';
    topChars.forEach(function(c) {
      charDeepBlock += '\n' + c.name + (c.title?'('+c.title+')':'') + ' 忠' + (c.loyalty||50) + ' 野' + (c.ambition||50) + ' 智' + (c.intelligence||50);
      if (c.personality) charDeepBlock += ' 性格:' + c.personality;
      if (c.personalGoal) charDeepBlock += ' 目标:' + c.personalGoal;
      if (c.bio) charDeepBlock += ' 经历:' + c.bio;
      if (c.faction) charDeepBlock += ' 势力:' + c.faction;
      if (c.party) charDeepBlock += ' 党派:' + c.party;
      if (c.spouse) charDeepBlock += ' [有配偶]';
    });
    var r9 = await _call(sysPre, charDeepBlock + '\n\n请返回JSON：{"character_profiles":"每个角色的内心独白——他们真正想要什么、害怕什么、会为什么铤而走险(300字)","relationship_tensions":"角色间最紧张的5对关系及爆发条件(200字)","betrayal_risks":"最可能背叛的角色及其动机和时机(150字)","alliance_opportunities":"最可能结盟的角色组合及其共同利益(150字)","emotional_triggers":"各角色的情感触发点——什么事件会让他们暴怒/崩溃/感动(200字)"}', 1500);

    // ═══ Call 11/12: 制度+物品+科技+外交（新增数据源） ═══
    prog(11, '深度阅读(11/12) 制度·物品·科技·外交...');
    var blockH1 = blockH.substring(0, Math.min(blockH.length, 6000)); // 前半
    var r11 = await _call(sysPre, blockH1 + '\n\n请返回JSON：{"tech_strategy":"科技发展路线和优先研究方向(150字)","item_significance":"关键物品的政治象征意义和使用策略(100字)","diplomatic_landscape":"与外部势力的完整外交格局和最佳策略(200字)","vassal_title_dynamics":"封臣体系和爵位制度对权力的影响(150字)","succession_politics":"继承制度和后宫政治对国运的影响(150字)"}', 1200);

    // ═══ Call 12/12: 经济·省份·建筑·完整世界理解 ═══
    prog(12, '深度阅读(12/12) 经济·省份·建筑...');
    var blockH2 = blockH.substring(Math.min(blockH.length, 6000)); // 后半（如果有）
    if (!blockH2) blockH2 = '以上数据已在前一轮提供。';
    var r12 = await _call(sysPre, blockH2 + '\n补充数据：\n' + blockF.substring(0, 3000) + '\n\n请返回JSON：{"province_assessment":"各省份的经济健康度和发展潜力(200字)","building_priorities":"最应优先建设的建筑及理由(100字)","reform_agenda":"前10回合的治国改革议程(200字)","risk_matrix":"政治/经济/军事/社会四维度的风险矩阵(200字)","opening_narrative":"开局第一回合最佳的叙事开场方式(150字)"}', 1200);

    // ═══ Call 13/12: 终极综合大摘要 ═══
    prog(13, '深度阅读 生成终极综合分析...');
    var allAnalysis = JSON.stringify(r1) + '\n' + JSON.stringify(r2) + '\n' + JSON.stringify(r3) + '\n' + JSON.stringify(r4) + '\n' + JSON.stringify(r5) + '\n' + JSON.stringify(r6admin) + '\n' + JSON.stringify(r7mil) + '\n' + JSON.stringify(r8evt) + '\n' + JSON.stringify(r9) + '\n' + JSON.stringify(r11) + '\n' + JSON.stringify(r12);
    var r10 = await _call(
      '你是历史模拟AI的总设计师。基于前9轮的极其详尽的深度分析，生成一份终极剧本理解文档。这份文档将永久注入你的记忆核心，指导后续数十回合的每一个推演决策。请确保涵盖所有关键维度，不遗漏任何重要信息。',
      allAnalysis + '\n\n请返回JSON：{"master_digest":"剧本终极摘要——这是你对整个世界的终极理解，必须涵盖：时代本质、核心矛盾、关键人物关系网、势力均衡、制度特点、经济军事状况、文化宗教背景、治理风险、战争风险。不要吝惜字数，写得越详细越好(1500-2000字)","first_turn_plan":"第一回合的完整推演计划——应发生的所有事件、每个NPC的具体行动、矛盾如何体现、氛围如何营造、叙事的起承转合(600字)","npc_behaviors":"前5回合各主要NPC的详细行为时间线——逐人逐回合(600字)","crisis_forecast":"即将爆发的5个危机——触发条件、爆发时间、影响范围、应对方案、玩家可利用的机会(500字)","narrative_style":"本剧本最适合的叙事风格——文学基调、用典方向、情感色彩、节奏把控、参考的文学作品(300字)","world_rules":"这个世界的底层运行规则——什么行为会被奖励、什么会被惩罚、什么是不可逆的、哪些是隐藏规则(400字)"}',
      2000
    );
    var r8 = r10; // 兼容旧变量名

    // ════════════════════════════════════════════
    // 第二层：交叉质询（AI自问自答，发现遗漏和矛盾）
    // ════════════════════════════════════════════
    var sysQuestioner = '你是一个极其严苛的历史学家和剧本审查官。你的任务是质疑前面的分析，找出遗漏、矛盾和不合理之处。不要客气，尽管挑刺。';
    var masterText = r10.master_digest || '';

    // ═══ Q1: 人物关系质询 ═══
    prog(14, '交叉质询(1/4) 审查人物关系...');
    var rQ1 = await _call(sysQuestioner,
      '前面的分析认为：\n角色关系网：' + (r2.character_web||'') + '\n危险人物：' + (r2.dangerous_figures||'') + '\n角色内心：' + (r9.character_profiles||'') + '\n背叛风险：' + (r9.betrayal_risks||'') + '\n\n原始角色数据：\n' + blockB.substring(0, 4000) +
      '\n\n请严格审查并返回JSON：{"missed_relationships":"被遗漏的重要人物关系——检查每对有关联的角色(200字)","logic_flaws":"分析中的逻辑矛盾——哪些判断不合理(150字)","deeper_motives":"被忽视的深层动机——哪些角色的真实目的被低估(200字)","wildcard_characters":"被忽视的变数人物——哪些看似不重要的角色可能有大作为(150字)"}', 1000);

    // ═══ Q2: 势力战略质询 ═══
    prog(15, '交叉质询(2/4) 审查势力战略...');
    var rQ2 = await _call(sysQuestioner,
      '前面的分析认为：\n势力态势：' + (r3.faction_balance||'') + '\n战争风险：' + (r7mil.war_scenarios||'') + '\n危机预测：' + (r10.crisis_forecast||'') + '\n\n原始势力数据：\n' + blockC.substring(0, 3000) +
      '\n\n请严格审查并返回JSON：{"strategic_blind_spots":"战略分析的盲点——哪些威胁被低估(200字)","alliance_shifts":"可能的联盟翻转——哪些看似稳固的联盟可能瓦解(150字)","cascade_scenarios":"多米诺效应场景——一个势力覆灭会引发什么连锁(200字)","player_vulnerabilities":"玩家势力的隐藏弱点——从敌人视角看玩家(150字)"}', 1000);

    // ═══ Q3: 制度经济质询 ═══
    prog(16, '交叉质询(3/4) 审查制度经济...');
    var rQ3 = await _call(sysQuestioner,
      '前面的分析认为：\n经济状况：' + (r7mil.economic_outlook||'') + '\n官僚状态：' + (r5.bureaucratic_state||'') + '\n治理改革：' + (r5.governance_reform||'') + '\n风险矩阵：' + (r12.risk_matrix||'') + '\n\n原始数据：\n' + blockD.substring(0, 2000) + '\n' + blockF.substring(0, 2000) +
      '\n\n请严格审查并返回JSON：{"economic_time_bombs":"被忽视的经济定时炸弹(150字)","institutional_decay":"制度衰败的隐性信号(150字)","reform_paradoxes":"改革的悖论——为什么改也错不改也错(200字)","social_undercurrents":"社会暗流——底层正在发生什么(150字)"}', 1000);

    // ═══ Q4: 叙事逻辑质询 ═══
    prog(17, '交叉质询(4/4) 审查叙事逻辑...');
    var rQ4 = await _call(sysQuestioner,
      '终极摘要：' + masterText + '\n叙事弧线：' + (r8evt.narrative_arcs||'') + '\n连锁反应：' + (r8evt.chain_reactions||'') + '\n推演计划：' + (r10.first_turn_plan||'') +
      '\n\n请严格审查并返回JSON：{"narrative_gaps":"叙事中的逻辑断裂——哪些因果链不成立(200字)","tone_conflicts":"基调矛盾——哪些场景的情感处理可能冲突(150字)","pacing_advice":"节奏建议——前5回合的叙事节奏应该怎样起伏(200字)","dramatic_irony":"戏剧反讽机会——玩家不知道但AI知道的秘密(200字)"}', 1000);

    // ════════════════════════════════════════════
    // 第三层：史料研究（让AI回忆真实历史，建立知识底座）
    // ════════════════════════════════════════════
    var dynasty = sc.era || sc.dynasty || '';
    var year = P.time && P.time.year ? P.time.year : '';
    var sysHistorian = '你是一位学识渊博的' + dynasty + '历史学家，精通该时期的所有正史、野史、笔记小说。请调动你对' + dynasty + '的全部知识。';
    var allQ = JSON.stringify(rQ1) + '\n' + JSON.stringify(rQ2) + '\n' + JSON.stringify(rQ3) + '\n' + JSON.stringify(rQ4);

    // ═══ H1: 史料·政治军事 ═══
    prog(18, '史料研究(1/4) 政治军事史料...');
    var rH1 = await _call(sysHistorian,
      '本剧本设定在' + dynasty + (year ? '(约公元'+year+'年)' : '') + '。\n玩家势力：' + (pi.factionName||'') + '\n当前局势：' + masterText.substring(0, 500) +
      '\n\n请根据你对该时期历史的了解，返回JSON：{"real_political_events":"这一时期真实发生的重大政治事件——按时间顺序列举，包括政变、废立、改制、党争等(300字)","real_military_events":"这一时期的真实军事冲突——战役名称、交战双方、结果、影响(300字)","key_historical_figures":"这一时期最关键的历史人物——他们的真实结局和历史评价(250字)","institutional_reality":"这一时期制度的真实运作状况——正史记载的吏治、财政、军制实况(200字)"}', 1500);

    // ═══ H2: 史料·社会经济 ═══
    prog(19, '史料研究(2/4) 社会经济史料...');
    var rH2 = await _call(sysHistorian,
      '继续研究' + dynasty + '的社会经济状况。\n剧本概述：' + (sc.overview||'').substring(0, 400) +
      '\n\n请返回JSON：{"real_social_conditions":"这一时期的真实社会状况——人口、阶级矛盾、民变、灾荒、疫病、流民(300字)","real_economic_data":"这一时期的真实经济数据——赋税制度、物价、通货、贸易路线、财政收支(250字)","real_cultural_scene":"这一时期的文化思想状况——学术流派、宗教势力、礼制之争、文学艺术(200字)","real_daily_life":"这一时期普通人的日常生活——衣食住行、婚丧嫁娶、市井风俗(200字)"}', 1500);

    // ═══ H3: 史料·人物与典故 ═══
    prog(20, '史料研究(3/4) 人物典故与文学素材...');
    var charNames = (GM.chars||[]).filter(function(c){return c.alive!==false;}).map(function(c){return c.name;}).join('\u3001');
    var rH3 = await _call(sysHistorian,
      '剧本中的关键角色：' + charNames + '\n\n请返回JSON：{"historical_anecdotes":"与这些人物（或同名/同类型历史人物）相关的真实历史典故和逸事——可用于游戏叙事中(300字)","literary_references":"这一时期最适合引用的诗词歌赋、典籍名句——按场景分类：朝堂、战争、宴饮、离别、感慨(250字)","famous_dialogues":"这一时期流传的著名对话或奏疏名句——可在角色对白中化用(200字)","historical_turning_points":"这一时期的历史转折点——哪些关键决策改变了历史走向(200字)"}', 1500);

    // ═══ H4: 史料·细节与氛围 ═══
    prog(21, '史料研究(4/4) 细节氛围素材...');
    var rH4 = await _call(sysHistorian,
      '这个剧本需要营造极其真实的' + dynasty + '氛围。\n\n请返回JSON：{"sensory_details":"这一时期的感官细节——宫殿什么样、街道什么样、战场什么样、朝堂什么气味什么声音(300字)","etiquette_norms":"这一时期的礼仪规范——君臣之间、官场之间、军中的称呼方式、行礼方式、禁忌(250字)","period_vocabulary":"这一时期应该使用的特有词汇和表达方式——官职称谓、日常用语、骂人话、赞美话(200字)","seasonal_customs":"这一时期的节令风俗——四季不同的朝政活动、祭祀、农事、军事行动时机(200字)"}', 1500);

    // ═══ H5: 史料·民俗风情与日常 ═══
    prog(22, '史料研究(5/8) 民俗风情...');
    var rH5 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的民间风俗习惯。\n\n返回JSON：{"folk_customs":"民间婚丧嫁娶、生育、命名、成人礼的完整习俗(300字)","festival_rituals":"主要节日（元旦、上巳、端午、中秋、重阳、冬至等）的庆祝方式和禁忌(300字)","food_culture":"饮食文化——主食、副食、酒、茶、宴席规格、席次讲究(250字)","clothing_norms":"服饰规范——不同阶层不同场合的穿着要求、颜色禁忌、首饰佩戴(200字)","housing_patterns":"居住形制——宫殿/官邸/民居/军营的建筑形式和空间布局(200字)"}', 1800);

    // ═══ H6: 史料·制度典章深度 ═══
    prog(23, '史料研究(6/8) 制度典章...');
    var rH6 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的制度典章。\n当前剧本的官制：' + (r5.bureaucratic_state||'').substring(0,300) +
      '\n\n返回JSON：{"court_procedure":"朝会制度——常朝/朔望朝/大朝的流程、时间、地点、参加者、议事规则(300字)","legal_system":"法律制度——刑法体系、审判流程、量刑标准、特赦制度、株连规则(300字)","tax_system":"赋税制度——税种名称、征收方式、税率、减免条件、地方截留比例(250字)","military_system":"兵制详情——兵源(征/募/世兵)、编制名称、粮饷标准、调兵手续、战时动员流程(250字)","selection_system":"选官制度——' + (P.keju&&P.keju.enabled?'科举各级考试流程、阅卷标准、录取比例、座主门生关系':'察举/九品中正/军功等选拔流程') + '(200字)"}', 1800);

    // ═══ H7: 史料·称谓与语言习惯 ═══
    prog(24, '史料研究(7/8) 称谓语言...');
    var rH7 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的称呼方式和语言习惯。\n\n返回JSON：{"imperial_address":"帝王的自称和被称——朕/寡人/孤/陛下/圣上/天子等使用场合(200字)","official_address":"官场称呼——上下级之间、同僚之间、奏对时的称谓规范(250字)","family_address":"家族称呼——父母/兄弟/妻妾/子女的称谓、嫡庶区分(200字)","written_style":"公文行文风格——奏疏/诏书/檄文/私信的开头结尾格式和固定用语(250字)","taboo_words":"避讳制度——皇帝名讳如何避、先人名讳如何避、犯讳的后果(200字)","common_expressions":"时代口语——日常打招呼、表示同意/反对、骂人/赞美的习惯用语(200字)"}', 1800);

    // ═══ H8: 史料·礼仪典礼深度 ═══
    prog(25, '史料研究(8/8) 礼仪典礼...');
    var rH8 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的礼仪典礼。\n\n返回JSON：{"court_etiquette":"上朝礼仪——入殿顺序、站位、奏事流程、叩拜方式、退朝规矩(300字)","audience_protocol":"觐见礼仪——外臣/使节/将领觐见皇帝的完整流程(200字)","military_rituals":"军事礼仪——出征誓师、犒赏三军、凯旋献俘、阵前对话的规矩(250字)","religious_ceremonies":"祭祀礼仪——天坛/太庙/社稷/山川的祭祀流程和意义(200字)","life_ceremonies":"人生礼仪——册封/赐婚/丧葬/祭祖的具体流程(200字)","diplomatic_protocol":"外交礼仪——接待外国使节/属国朝贡/互市谈判的礼节(200字)"}', 1800);

    // ════════════════════════════════════════════
    // 第五层：条件分支式推演（不预定剧本，而是准备多种走向）
    // ════════════════════════════════════════════
    var sysDirector = '你是这个历史世界的总导演。重要原则：玩家的选择必须能真正影响世界走向。不要预定剧本，而是准备多种可能性。你拥有前面24轮积累的全部知识。';

    // ═══ R1: 条件分支·世界走向 ═══
    prog(26, '条件推演(1/3) 世界走向分支树...');
    var rR1 = await _call(sysDirector,
      '终极摘要：' + masterText + '\n质询补充：' + allQ.substring(0, 2000) + '\n史料参考：' + JSON.stringify(rH1).substring(0, 1500) +
      '\n\n【重要】不要写固定脚本！要写条件分支。玩家的每个决策都应导向不同结果。\n返回JSON：{"world_branches":"世界走向分支树——列出3-5个关键决策点，每个决策点有2-3个分支走向(400字)","npc_reaction_matrix":"NPC对玩家不同决策的反应矩阵——如果玩家做X则NPC-A会Y(300字)","crisis_triggers":"危机触发条件——不是固定时间触发，而是当特定变量/关系达到阈值时触发(200字)","opportunity_windows":"机会窗口——哪些时机稍纵即逝，玩家必须在特定条件下才能抓住(200字)"}', 1800);

    // ═══ R2: 条件分支·NPC自主性 ═══
    prog(27, '条件推演(2/3) NPC自主行为逻辑...');
    var rR2 = await _call(sysDirector,
      '角色内心：' + (r9.character_profiles||'') + '\n被忽视的动机：' + (rQ1.deeper_motives||'') + '\n史料人物：' + (rH3.historical_anecdotes||'').substring(0, 500) +
      '\n\n【重要】NPC不是预设脚本的演员，而是有自主意志的个体。他们的行为取决于当前局势，而非预定时间表。\n返回JSON：{"npc_decision_logic":"每个重要NPC的决策逻辑树——什么条件下做什么(400字)","secret_agendas":"各NPC的秘密议程——他们不会告诉玩家的真实目的(200字)","emotional_triggers":"情感触发点——什么事件会让哪个NPC做出非理性行为(200字)","loyalty_breaking_points":"忠诚断裂点——每个NPC在什么条件下会背叛(200字)"}', 1500);

    // ═══ R3: 条件分支·世界演化规律 ═══
    prog(28, '条件推演(3/3) 世界演化规律...');
    var rR3 = await _call(sysDirector,
      '宏观分析：' + (r12.risk_matrix||'') + '\n史料经济：' + (rH2.real_economic_data||'').substring(0, 500) + '\n史料社会：' + (rH2.real_social_conditions||'').substring(0, 500) +
      '\n\n返回JSON：{"macro_trajectory":"世界宏观走向——政治/经济/军事/社会四维度在不同玩家策略下的演化(400字)","tipping_points":"不可逆临界点——一旦跨过就无法回头的5个关键阈值(250字)","butterfly_effects":"蝴蝶效应清单——10个看似微小但影响深远的决策(250字)","historical_parallels":"历史平行——这个局面最像哪些真实历史场景，那些场景最终如何收场(200字)","decay_patterns":"衰亡模式——如果玩家不作为，世界会按什么规律自然衰败(200字)"}', 1500);

    // ═══ 合并存储 ═══
    GM._aiScenarioDigest = {
      // Call 1
      eraEssence: (r1.era_essence||''),
      contradictionAnalysis: (r1.contradiction_analysis||''),
      playerDilemma: (r1.player_dilemma||''),
      // Call 2
      characterWeb: (r2.character_web||''),
      dangerousFigures: (r2.dangerous_figures||''),
      loyalAllies: (r2.loyal_allies||''),
      hiddenAgendas: (r2.hidden_agendas||''),
      // Call 3
      factionBalance: (r3.faction_balance||''),
      alliancePossibilities: (r3.alliance_possibilities||''),
      partyStruggle: (r3.party_struggle||''),
      classTensions: (r3.class_tensions||''),
      vassalRisks: (r3.vassal_risks||''),
      // Call 4
      worldAtmosphere: (r4.world_atmosphere||''),
      ruleImplications: (r4.rule_implications||''),
      culturalDynamics: (r4.cultural_dynamics||''),
      economicLogic: (r4.economic_logic||''),
      // Call 5 - 官制
      bureaucraticState: (r5.bureaucratic_state||''),
      powerNetwork: (r5.power_network||''),
      vacantCritical: (r5.vacant_critical||''),
      successionRisks: (r5.succession_risks||''),
      governanceReform: (r5.governance_reform||''),
      // Call 6 - 行政
      regionalStrengths: (r6admin.regional_strengths||''),
      regionalRisks: (r6admin.regional_risks||''),
      governorAssessment: (r6admin.governor_assessment||''),
      territorialStrategy: (r6admin.territorial_strategy||''),
      // Call 7 - 军事经济
      militaryAssessment: (r7mil.military_assessment||''),
      economicOutlook: (r7mil.economic_outlook||''),
      warScenarios: (r7mil.war_scenarios||''),
      resourceCrises: (r7mil.resource_crises||''),
      militaryReform: (r7mil.military_reform||''),
      // Call 8 - 事件
      eventPriorities: (r8evt.event_priorities||''),
      timelineForeshadow: (r8evt.timeline_foreshadow||''),
      goalStrategy: (r8evt.goal_strategy||''),
      narrativeArcs: (r8evt.narrative_arcs||''),
      chainReactions: (r8evt.chain_reactions||''),
      // Call 9 - 角色深度
      characterProfiles: (r9.character_profiles||''),
      relationshipTensions: (r9.relationship_tensions||''),
      betrayalRisks: (r9.betrayal_risks||''),
      allianceOpportunities: (r9.alliance_opportunities||''),
      emotionalTriggers: (r9.emotional_triggers||''),
      // Call 11 - 制度+物品+外交
      techStrategy: (r11.tech_strategy||''),
      itemSignificance: (r11.item_significance||''),
      diplomaticLandscape: (r11.diplomatic_landscape||''),
      vassalTitleDynamics: (r11.vassal_title_dynamics||''),
      successionPolitics: (r11.succession_politics||''),
      // Call 12 - 经济+省份+改革
      provinceAssessment: (r12.province_assessment||''),
      buildingPriorities: (r12.building_priorities||''),
      reformAgenda: (r12.reform_agenda||''),
      riskMatrix: (r12.risk_matrix||''),
      openingNarrative: (r12.opening_narrative||''),
      // Layer 2 - 交叉质询
      missedRelationships: (rQ1.missed_relationships||''),
      logicFlaws: (rQ1.logic_flaws||''),
      deeperMotives: (rQ1.deeper_motives||''),
      wildcardCharacters: (rQ1.wildcard_characters||''),
      strategicBlindSpots: (rQ2.strategic_blind_spots||''),
      allianceShifts: (rQ2.alliance_shifts||''),
      cascadeScenarios: (rQ2.cascade_scenarios||''),
      playerVulnerabilities: (rQ2.player_vulnerabilities||''),
      economicTimeBombs: (rQ3.economic_time_bombs||''),
      institutionalDecay: (rQ3.institutional_decay||''),
      reformParadoxes: (rQ3.reform_paradoxes||''),
      socialUndercurrents: (rQ3.social_undercurrents||''),
      narrativeGaps: (rQ4.narrative_gaps||''),
      pacingAdvice: (rQ4.pacing_advice||''),
      dramaticIrony: (rQ4.dramatic_irony||''),
      // Layer 3 - 史料研究
      realPoliticalEvents: (rH1.real_political_events||''),
      realMilitaryEvents: (rH1.real_military_events||''),
      keyHistoricalFigures: (rH1.key_historical_figures||''),
      institutionalReality: (rH1.institutional_reality||''),
      realSocialConditions: (rH2.real_social_conditions||''),
      realEconomicData: (rH2.real_economic_data||''),
      realCulturalScene: (rH2.real_cultural_scene||''),
      realDailyLife: (rH2.real_daily_life||''),
      historicalAnecdotes: (rH3.historical_anecdotes||''),
      literaryReferences: (rH3.literary_references||''),
      famousDialogues: (rH3.famous_dialogues||''),
      historicalTurningPoints: (rH3.historical_turning_points||''),
      sensoryDetails: (rH4.sensory_details||''),
      etiquetteNorms: (rH4.etiquette_norms||''),
      periodVocabulary: (rH4.period_vocabulary||''),
      seasonalCustoms: (rH4.seasonal_customs||''),
      // Layer 3 continued - 史料研究扩展
      folkCustoms: (rH5.folk_customs||''),
      festivalRituals: (rH5.festival_rituals||''),
      foodCulture: (rH5.food_culture||''),
      clothingNorms: (rH5.clothing_norms||''),
      housingPatterns: (rH5.housing_patterns||''),
      courtProcedure: (rH6.court_procedure||''),
      legalSystem: (rH6.legal_system||''),
      taxSystem: (rH6.tax_system||''),
      militarySystemDetail: (rH6.military_system||''),
      selectionSystemDetail: (rH6.selection_system||''),
      imperialAddress: (rH7.imperial_address||''),
      officialAddress: (rH7.official_address||''),
      familyAddress: (rH7.family_address||''),
      writtenStyle: (rH7.written_style||''),
      tabooWords: (rH7.taboo_words||''),
      commonExpressions: (rH7.common_expressions||''),
      courtEtiquette: (rH8.court_etiquette||''),
      audienceProtocol: (rH8.audience_protocol||''),
      militaryRituals: (rH8.military_rituals||''),
      religiousCeremonies: (rH8.religious_ceremonies||''),
      lifeCeremonies: (rH8.life_ceremonies||''),
      diplomaticProtocol: (rH8.diplomatic_protocol||''),
      // Layer 5 - 条件分支推演
      worldBranches: (rR1.world_branches||''),
      npcReactionMatrix: (rR1.npc_reaction_matrix||''),
      crisisTriggers: (rR1.crisis_triggers||''),
      opportunityWindows: (rR1.opportunity_windows||''),
      npcDecisionLogic: (rR2.npc_decision_logic||''),
      secretAgendas: (rR2.secret_agendas||''),
      emotionalTriggers: (rR2.emotional_triggers||''),
      loyaltyBreakingPoints: (rR2.loyalty_breaking_points||''),
      macroTrajectory: (rR3.macro_trajectory||''),
      tippingPoints: (rR3.tipping_points||''),
      butterflyEffects: (rR3.butterfly_effects||''),
      historicalParallels: (rR3.historical_parallels||''),
      decayPatterns: (rR3.decay_patterns||''),
      // Call 13 - Master
      masterDigest: (r8.master_digest||''),
      firstTurnPlan: (r8.first_turn_plan||''),
      npcBehaviors: (r8.npc_behaviors||''),
      crisisForecast: (r8.crisis_forecast||''),
      narrativeStyle: (r8.narrative_style||''),
      worldRules: (r8.world_rules||''),
      // Meta
      scenarioDigest: (r8.master_digest||''), // 兼容旧字段
      firstTurnFocus: (r8.first_turn_plan||''),
      npcIntentions: (r8.npc_behaviors||''),
      generatedAt: GM.turn
    };
    // 记录初始官制哈希（检测后续改革）
    GM._officeTreeHash = _computeOfficeHash();

    _dbg('[AI DeepRead 8-call] Master digest:', (GM._aiScenarioDigest.masterDigest||'').substring(0, 150));
    showLoading('\u6DF1\u5EA6\u9605\u8BFB\u5B8C\u6210\uFF01', 100);
  } catch(e) {
    console.warn('[AI DeepRead] Failed:', e);
    GM._aiScenarioDigest = { scenarioDigest: '', firstTurnFocus: '', npcIntentions: '', masterDigest: '', generatedAt: 0 };
  }
  setTimeout(hideLoading, 500);
}

// ============================================================
// 启动预演规划 aiPlanScenarioForInference
// 在剧本加载时做 1 次 AI 调用·生成推演稳定性关键字段：
//   · npcHiddenAgenda   每个关键 NPC 的真正目标（防 AI 角色动机漂移）
//   · crisisBranches    未来 5-10 回合分岔路线（防 AI 一次演完所有好戏）
//   · tippingPoints     关键时间锚·不可逆临界
//   · npcFirstTurnReaction  首回合每关键 NPC 的候选反应（指导奏疏+议程生成）
//   · narrativeTone     行文风格锚点（保证每回合笔法一致）
// 即使剧本 isFullyDetailed=true 也运行（替代 aiDeepReadScenario 后的价值补偿）
// 除非剧本显式 skipInferencePlanning:true
// ============================================================
async function aiPlanScenarioForInference() {
  if (!P.ai || !P.ai.key) return;
  if (GM._aiInferencePlan && GM._aiInferencePlan.generatedAt) return; // 已规划过
  if (GM.turn > 1) return;

  var sc = findScenarioById(GM.sid);
  if (!sc) return;
  if (sc.skipInferencePlanning === true) return;

  var pi = P.playerInfo || {};
  var keyChars = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    // 关键角色判定：有官职/重要度/isHistorical/忠诚极端/野心极端
    if (c.officialTitle || c.isHistorical || c.importance >= 60) return true;
    if (c.loyalty != null && (c.loyalty < 30 || c.loyalty > 85)) return true;
    if (c.ambition != null && c.ambition > 75) return true;
    return false;
  }).slice(0, 24); // 上限 24·控 prompt 尺寸

  var charList = keyChars.map(function(c) {
    var parts = [];
    parts.push(c.name);
    if (c.officialTitle) parts.push(c.officialTitle);
    if (c.party) parts.push(c.party);
    if (c.loyalty != null) parts.push('忠' + c.loyalty);
    if (c.ambition != null) parts.push('野' + c.ambition);
    return parts.join('·');
  }).join('\n  · ');

  var contradictText = '';
  if (pi.coreContradictions && pi.coreContradictions.length > 0) {
    contradictText = pi.coreContradictions.map(function(c) {
      return '[' + c.dimension + ']' + c.title + (c.parties ? '(' + c.parties + ')' : '') + (c.description ? '：' + c.description.slice(0, 60) : '');
    }).join('；');
  }

  var overviewText = (sc.overview || '').slice(0, 600);
  var openingText = (sc.openingText || '').slice(0, 400);
  var rulesText = (sc.globalRules || '').slice(0, 400);

  var prompt = '你是' + (sc.era || sc.dynasty || '中国古代') + '历史沙盘推演专家。请基于剧本完成推演稳定性规划。\n\n';
  prompt += '【剧本总述】\n' + overviewText + '\n';
  if (openingText) prompt += '【开场白】\n' + openingText + '\n';
  if (rulesText) prompt += '【全局规则】\n' + rulesText + '\n';
  if (pi.characterName) prompt += '\n【玩家】' + pi.characterName + (pi.characterTitle ? '·' + pi.characterTitle : '') + '\n';
  if (pi.factionGoal) prompt += '玩家目标：' + pi.factionGoal + '\n';
  if (contradictText) prompt += '【显著矛盾】' + contradictText + '\n';
  prompt += '\n【关键 NPC · ' + keyChars.length + ' 人】\n  · ' + charList + '\n';

  prompt += '\n\n请返回 JSON：\n';
  prompt += '{\n';
  prompt += '  "npcHiddenAgenda": {"NPC姓名": "1-2 句话的真实目标/隐藏意图(而非表面官职职责)", ...},\n';
  prompt += '  "crisisBranches": [\n';
  prompt += '    "A. 方向一·特征·可能结局(30-50字)",\n';
  prompt += '    "B. 方向二·...",\n';
  prompt += '    "C. 方向三·..."\n';
  prompt += '  ],\n';
  prompt += '  "tippingPoints": [\n';
  prompt += '    "T3-5·某事件·不可逆临界点(30字)",\n';
  prompt += '    "T8-12·...",\n';
  prompt += '    "T15+·..."\n';
  prompt += '  ],\n';
  prompt += '  "npcFirstTurnReaction": {"NPC姓名": "第一回合最可能的言行(20-40字·体现其隐藏议程)", ...关键 NPC 8-15 人即可},\n';
  prompt += '  "narrativeTone": {\n';
  prompt += '    "sentenceStyle": "句式风格特征(20字)",\n';
  prompt += '    "vocabulary": ["典型词1", "典型词2", ...5-8 个],\n';
  prompt += '    "pacing": "叙事节奏建议(20字)"\n';
  prompt += '  }\n';
  prompt += '}\n';
  prompt += '只输出 JSON。npcHiddenAgenda 和 npcFirstTurnReaction 覆盖主要 NPC 即可·不必全覆盖。';

  try {
    if (typeof showLoading === 'function') showLoading('规划推演锚点·NPC 动机与危机分岔…', 50);
    var raw = await callAISmart(prompt, 4000, { maxRetries: 2, minLength: 400 });
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[aiPlan] 解析失败·跳过');
      return;
    }
    GM._aiInferencePlan = {
      npcHiddenAgenda: parsed.npcHiddenAgenda || {},
      crisisBranches: Array.isArray(parsed.crisisBranches) ? parsed.crisisBranches : [],
      tippingPoints: Array.isArray(parsed.tippingPoints) ? parsed.tippingPoints : [],
      npcFirstTurnReaction: parsed.npcFirstTurnReaction || {},
      narrativeTone: parsed.narrativeTone || {},
      generatedAt: GM.turn || 1
    };
    // 同步关键字段到 _aiScenarioDigest·供老推演路径复用
    if (!GM._aiScenarioDigest) GM._aiScenarioDigest = {};
    if (parsed.npcHiddenAgenda) {
      var ag = Object.keys(parsed.npcHiddenAgenda).map(function(k) { return k + '：' + parsed.npcHiddenAgenda[k]; }).join('；');
      GM._aiScenarioDigest.secretAgendas = ag.slice(0, 1500);
    }
    if (Array.isArray(parsed.crisisBranches)) {
      GM._aiScenarioDigest.crisisTriggers = parsed.crisisBranches.join(' | ').slice(0, 800);
    }
    if (Array.isArray(parsed.tippingPoints)) {
      GM._aiScenarioDigest.tippingPoints = parsed.tippingPoints.join(' | ').slice(0, 600);
    }
    console.log('[aiPlan] 推演规划完成·NPC 议程 ' + Object.keys(parsed.npcHiddenAgenda||{}).length + ' 条·分岔 ' + ((parsed.crisisBranches||[]).length) + ' 条');
  } catch(e) {
    console.warn('[aiPlan] 失败:', e && e.message);
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// ============================================================
// 启动势力关系矩阵 aiPlanFactionMatrix
// 1 次 AI 调用·生成每两个势力间的当前关系+10 回合轨迹+升级/和解触发条件
// 注入推演：势力互动依据此表·避免"魏忠贤一夜降金"之类荒谬演绎
// ============================================================
async function aiPlanFactionMatrix() {
  if (!P.ai || !P.ai.key) return;
  if (GM._aiFactionMatrix && GM._aiFactionMatrix.generatedAt) return;
  if (GM.turn > 1) return;

  var sc = findScenarioById(GM.sid);
  if (!sc) return;
  if (sc.skipInferencePlanning === true) return;

  var facs = (GM.facs || []).filter(function(f) { return f && f.name; });
  if (facs.length < 2) return;

  var facList = facs.slice(0, 12).map(function(f) {
    var parts = [f.name];
    if (f.isPlayer) parts.push('玩家');
    if (f.leader) parts.push('首领:' + f.leader);
    if (f.strength != null) parts.push('实力' + f.strength);
    if (f.goal) parts.push('目标:' + String(f.goal).slice(0, 40));
    return parts.join('·');
  }).join('\n  · ');

  var presetRels = (sc.presetRelations && Array.isArray(sc.presetRelations.faction)) ? sc.presetRelations.faction : [];
  var relText = presetRels.slice(0, 20).map(function(r) {
    return r.facA + '↔' + r.facB + (r.trust != null ? ' 信' + r.trust : '') + (r.hostility != null ? ' 敌' + r.hostility : '') + (r.labels && r.labels.length ? '[' + r.labels.slice(0, 3).join('·') + ']' : '');
  }).join('；');

  var prompt = '你是' + (sc.era || sc.dynasty || '') + '地缘政治分析专家。基于剧本生成势力关系矩阵+轨迹预判。\n\n';
  prompt += '【势力·' + facs.length + '】\n  · ' + facList + '\n';
  if (relText) prompt += '【剧本预设关系】' + relText + '\n';
  prompt += '\n【剧本总述】' + (sc.overview || '').slice(0, 500) + '\n';

  prompt += '\n返回 JSON：\n';
  prompt += '{\n';
  prompt += '  "factionMatrix": [\n';
  prompt += '    {"facA":"A","facB":"B","currentRelation":"当前关系(15字·如敌对/同盟/牵制/互不信任)","trajectoryNext10Turns":"未来 10 回合走向预判(30-60字)","triggersToEscalate":["升级冲突条件1","条件2"],"triggersToReconcile":["和解条件1","条件2"]},\n';
  prompt += '    ...（每两个势力一条·至多 N(N-1)/2 条）\n';
  prompt += '  ],\n';
  prompt += '  "alliancePotentials": ["可拉拢或结盟的势力·代价与时机·30字"],\n';
  prompt += '  "strategicTriangles": ["三角博弈·玩家处境·30字"],\n';
  prompt += '  "blackSwans": ["势力层面的黑天鹅事件·5-8 条·每条 30字"]\n';
  prompt += '}\n只输出 JSON。';

  try {
    if (typeof showLoading === 'function') showLoading('规划势力动态·国际格局预判…', 60);
    var raw = await callAISmart(prompt, 2500, { maxRetries: 2, minLength: 300 });
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!parsed || typeof parsed !== 'object') { console.warn('[aiFacMatrix] 解析失败'); return; }
    GM._aiFactionMatrix = {
      factionMatrix: Array.isArray(parsed.factionMatrix) ? parsed.factionMatrix : [],
      alliancePotentials: Array.isArray(parsed.alliancePotentials) ? parsed.alliancePotentials : [],
      strategicTriangles: Array.isArray(parsed.strategicTriangles) ? parsed.strategicTriangles : [],
      blackSwans: Array.isArray(parsed.blackSwans) ? parsed.blackSwans : [],
      generatedAt: GM.turn || 1
    };
    console.log('[aiFacMatrix] 势力矩阵 ' + (GM._aiFactionMatrix.factionMatrix.length) + ' 对·黑天鹅 ' + (GM._aiFactionMatrix.blackSwans.length) + ' 条');
  } catch(e) {
    console.warn('[aiFacMatrix] 失败:', e && e.message);
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// ══════ AI 预演辅助已迁移到 tm-endturn-ai-helpers.js (R94) ══════
// - aiPlanFirstTurnEvents / aiDigestLongTermActions
// - aiEdictEfficacyAudit / buildEdictEfficacyFollowUp
// ═══════════════════════════════════════════════════════

// ══════ 记忆锚点系统已迁移到 tm-memory-anchors.js (R90) ══════
// - createMemoryAnchor / createExecutionConstraint
// - calculateTotalMilitaryStrength / calculateEconomicLevel
// - buildContextDescription / calculateAnchorImportance
// - getMemoryAnchorsForAI / archiveOldMemories / _ensureMemoryFreshness
// ═══════════════════════════════════════════════════════

// ══════ Post-turn jobs 已迁移到 tm-post-turn-jobs.js (R92) ══════
// - _scL2AIGenerate / _scL3Condense / _scReflect
// - _updateFactionArcs / _launchPostTurnJobs / _compressOldArchives
// ═══════════════════════════════════════════════════════

// ══════ 角色弧+决策追踪已迁移到 tm-arcs.js (R91) ══════
// - recordCharacterArc / getCharacterArcSummary / getAllCharacterArcContext
// - recordPlayerDecision / getPlayerDecisionContext
// ═══════════════════════════════════════════════════════

/**
 * 打开记忆锚点面板
 * 增强版：显示结构化状态信息
 */
function openMemoryAnchors() {
  if (!GM.memoryAnchors) GM.memoryAnchors = [];

  var typeColor = { decision:'var(--blue)', event:'var(--gold)', policy:'var(--green)', crisis:'var(--red)', archive:'var(--txt-d)' };
  var typeLabel = { decision:'\u51B3\u7B56', event:'\u4E8B\u4EF6', policy:'\u653F\u7B56', crisis:'\u5371\u673A', archive:'\u7EAA\u8981' };

  // 按年分组
  var byYear = {};
  GM.memoryAnchors.forEach(function(a) {
    var yr = a.year || ('\u7B2C' + Math.ceil((a.turn || 1) / 4) + '\u5E74');
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(a);
  });

  // 年份倒序
  var years = Object.keys(byYear).sort(function(a, b) {
    var na = parseInt(a) || 0, nb = parseInt(b) || 0;
    return nb - na;
  });

  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';

  if (GM.memoryAnchors.length === 0) {
    html += '<div style="text-align:center;color:var(--txt-d);padding:2rem;">\u6682\u65E0\u5927\u4E8B\u8BB0</div>';
  } else {
    years.forEach(function(yr, yi) {
      var anchors = byYear[yr].sort(function(a, b) { return (b.turn || 0) - (a.turn || 0); });
      var maxImp = 0;
      anchors.forEach(function(a) { if ((a.importance || 0) > maxImp) maxImp = a.importance; });
      var collapsed = yi > 0; // 第一年展开，其余折叠

      html += '<div style="margin-bottom:0.8rem;">';
      html += '<div style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding:0.4rem 0;" onclick="var el=this.nextElementSibling;el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=el.style.display===\'none\'?\'\u25B6\':\'\u25BC\';">';
      html += '<span style="font-size:0.8rem;color:var(--gold);">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';
      html += '<span style="font-weight:700;color:var(--txt-l);font-size:0.95rem;">' + yr + '</span>';
      html += '<span style="font-size:0.72rem;color:var(--txt-d);">' + anchors.length + '\u4EF6</span>';
      html += '</div>';

      html += '<div style="display:' + (collapsed ? 'none' : 'block') + ';">';
      anchors.forEach(function(anchor) {
        var tc = typeColor[anchor.type] || 'var(--bg-3)';
        var tl = typeLabel[anchor.type] || '\u5176\u4ED6';
        var isHigh = (anchor.importance || 0) >= 80;

        html += '<div style="margin-bottom:0.6rem;padding:0.7rem;background:var(--bg-2);border-left:4px solid ' + tc + ';border-radius:4px;'
          + (isHigh ? 'border:1px solid var(--gold);' : '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">';
        html += '<span style="font-weight:700;color:' + (isHigh ? 'var(--gold)' : 'var(--txt-l)') + ';">' + escHtml(anchor.title || '') + '</span>';
        html += '<div style="display:flex;gap:0.4rem;align-items:center;">';
        html += '<span style="font-size:0.68rem;color:' + tc + ';background:var(--bg-3);padding:1px 5px;border-radius:3px;">' + tl + '</span>';
        html += '<span style="font-size:0.68rem;color:var(--txt-d);">T' + (anchor.turn || '?') + '</span>';
        html += '</div></div>';

        html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.5;">' + escHtml(anchor.content || '') + '</div>';

        if (anchor.risk) {
          var ri = [];
          if (anchor.risk.unrest !== undefined) ri.push('\u6C11\u53D8' + anchor.risk.unrest);
          if (anchor.risk.partyStrife !== undefined) ri.push('\u515A\u4E89' + anchor.risk.partyStrife);
          if (anchor.risk.prestige !== undefined) ri.push('\u5A01\u671B' + anchor.risk.prestige);
          if (ri.length > 0) html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:0.3rem;">' + ri.join(' | ') + '</div>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    });
  }

  html += '<div style="text-align:center;font-size:0.72rem;color:var(--txt-d);padding:0.5rem 0;border-top:1px solid var(--bg-3);margin-top:0.5rem;">\u4EE5\u4E0A\u5927\u4E8B\u8BB0\u5DF2\u81EA\u52A8\u7EB3\u5165AI\u63A8\u6F14\u8BB0\u5FC6</div>';
  html += '</div>';

  openGenericModal('\u5927\u4E8B\u8BB0', html, null);
}

// ══════ 历史事件系统+时间工具已迁移到 tm-history-events.js (R93) ══════
// - checkHistoryEvents / showHistoryEventModal / applyEventBranch
// - checkRigidTriggers / triggerRigidEvent
// - getValueByPath / setValueByPath
// - getCurrentYear / getCurrentMonth
// ═══════════════════════════════════════════════════════


// ============================================================
//  endTurn 事件钩子系统
// ============================================================

/**
 * endTurn 钩子系统
 * 替代原有的多层包装链（_origEndTurn, _origEndTurn2, etc.）
 * 提供清晰的执行顺序和易于维护的扩展机制
 */
var EndTurnHooks = (function() {
  var hooks = {
    before: [],  // 在 endTurn 核心逻辑之前执行
    after: []    // 在 endTurn 核心逻辑之后执行
  };

  /**
   * 注册钩子函数
   * @param {string} phase - 'before' 或 'after'
   * @param {Function} callback - 钩子函数（可以是 async）
   * @param {string} name - 钩子名称（用于调试）
   */
  function register(phase, callback, name) {
    if (phase !== 'before' && phase !== 'after') {
      console.error('[EndTurnHooks] 无效的 phase:', phase);
      return;
    }
    hooks[phase].push({ callback: callback, name: name || 'anonymous' });
    _dbg('[EndTurnHooks] 注册钩子:', phase, name);
  }

  /**
   * 执行指定阶段的所有钩子
   * @param {string} phase - 'before' 或 'after'
   */
  async function execute(phase) {
    var phaseHooks = hooks[phase];
    _dbg('[EndTurnHooks] 执行 ' + phase + ' 钩子，共 ' + phaseHooks.length + ' 个');

    for (var i = 0; i < phaseHooks.length; i++) {
      var hook = phaseHooks[i];
      try {
        _dbg('[EndTurnHooks] 执行钩子: ' + hook.name);
        await hook.callback();
      } catch (error) {
        console.error('[EndTurnHooks] 钩子执行失败:', hook.name, error);
      }
    }
  }

  /**
   * 清空所有钩子（用于重置）
   */
  function clear() {
    hooks.before = [];
    hooks.after = [];
    _dbg('[EndTurnHooks] 已清空所有钩子');
  }

  /**
   * 获取钩子统计信息
   */
  function getStats() {
    return {
      before: hooks.before.length,
      after: hooks.after.length,
      total: hooks.before.length + hooks.after.length
    };
  }

  return {
    register: register,
    execute: execute,
    clear: clear,
    getStats: getStats
  };
})();

