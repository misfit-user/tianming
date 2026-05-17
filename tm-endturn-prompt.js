// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-prompt.js — endturn AI 推演·§1 sysP prompt 构建 (R209 P7-γ 拆出)
//
// Phase 7 P7-γ (2026-05-04·Claude)·从 tm-endturn-ai-infer.js §1 (原 L41-3243·~3203 行) 拆出·
// 责任·读 GM/P/scriptData·建 sysP·char ranges·scenario 引用·写入 ctx.prompt
// 不动·prompt 措辞 / content / 字段·只搬位置 (refactor-only per Phase 7 gates)
//
// Module:    TM.Endturn.AI.prompt
// Domain:    endturn / prompt building (§1)
// Status:    active (P7-γ refactor·替原 ai-infer §1)
// Owner:     Claude (P7-γ)
// Imports:   GM, P, scriptData (read), getTimeRatio, _getDaysPerTurn, _getCharRange,
//            findScenarioById, EDICT_TYPES, REFORM_PHASES, RESISTANCE_SOURCES,
//            getEdictLifecycleTurns, showLoading, _dbg, callAI helpers
// Exports:   TM.Endturn.AI.prompt.build(ctx)·async·写入 ctx.prompt
// Used by:   tm-endturn-ai-infer.js (主入口·§1 替换·调 build)
// Side effects: 读 GM/P / 写 ctx.prompt / 调 showLoading
// Test:      smoke-endturn-prompt-tokens.js (47 tokens)·smoke-endturn-public-contract (19)
// Notes:     R209·P7-γ·依据 phase7-gamma-prompt-prep.md
// ============================================================
(function(global) {
  'use strict';
  if (typeof global.TM === 'undefined') global.TM = {};
  if (typeof global.TM.Endturn === 'undefined') global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === 'undefined') global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.prompt === 'undefined') global.TM.Endturn.AI.prompt = {};

  function _getCurrentChangchaoDecisions(gameState) {
    var gm = gameState || {};
    var decisions = Array.isArray(gm._lastChangchaoDecisions) ? gm._lastChangchaoDecisions : [];
    var currentTurn = Number(gm.turn || 0);
    function _decisionsFromCourtRecords() {
      var records = Array.isArray(gm._courtRecords) ? gm._courtRecords : [];
      for (var i = records.length - 1; i >= 0; i--) {
        var r = records[i];
        if (!r || !Array.isArray(r.decisions) || r.decisions.length === 0) continue;
        var rt = Number(r.targetTurn || r.turn || 0);
        if (!isFinite(rt) || rt !== currentTurn) continue;
        return r.decisions;
      }
      return [];
    }
    if (decisions.length === 0) return _decisionsFromCourtRecords();

    var meta = gm._lastChangchaoDecisionMeta || null;
    var rawTargetTurn = null;
    if (meta && meta.targetTurn != null && meta.targetTurn !== '') {
      rawTargetTurn = meta.targetTurn;
    } else if (gm._lastChangchaoDecisionsTargetTurn != null && gm._lastChangchaoDecisionsTargetTurn !== '') {
      rawTargetTurn = gm._lastChangchaoDecisionsTargetTurn;
    }

    // Legacy saves may only have _lastChangchaoDecisions. Keep them readable.
    if (rawTargetTurn == null) return decisions;

    var targetTurn = Number(rawTargetTurn);
    if (!isFinite(targetTurn)) return decisions;
    return targetTurn === currentTurn ? decisions : _decisionsFromCourtRecords();
  }

  global.TM.Endturn.AI.prompt.getCurrentChangchaoDecisions = _getCurrentChangchaoDecisions;

  /**
   * §1·sysP prompt 构建 (R209 P7-γ)
   * 从 ctx.input read·写入 ctx.prompt
   * @param {Object} ctx - endturn pipeline ctx (per phase7-ctx-contract.md)
   */
  global.TM.Endturn.AI.prompt.build = async function(ctx) {
    var edicts = ctx.input.edicts;
    var xinglu = ctx.input.xinglu;
    var memRes = ctx.input.memRes;
    var oldVars = ctx.input.oldVars;
    var timeRatio = ctx.input.timeRatio;
    var _daysPerTurnLocal = function() {
      return (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    };
    var _turnsForMonthsLocal = function(months) {
      if (typeof turnsForMonths === 'function') return turnsForMonths(months);
      return Math.max(1, Math.ceil((months * 30) / Math.max(1, _daysPerTurnLocal())));
    };

    // ===== §1 body·verbatim from ai-infer L41-3243 =====
    var sc=findScenarioById(GM.sid);
    var _shiluR=_getCharRange('shilu'),_shiluMin=_shiluR[0],_shiluMax=_shiluR[1];
    var _szjR=_getCharRange('szj'),_szjMin=_szjR[0],_szjMax=_szjR[1];
    var _hourenR=_getCharRange('houren'),_hourenMin=_hourenR[0],_hourenMax=_hourenR[1];
    var _zwR=_getCharRange('zw'),_zwMin=_zwR[0],_zwMax=_zwR[1]; // 兼容保留
    var _commentR=_getCharRange('comment');

    // ================================================================
    // AI Prompt 分层构建（优化后的段落顺序）
    // 层1: 世界态势（定向） → 层2: 玩家意图（指令） → 层3: 记忆上下文
    // → 层4: 辅助信息 → 层5: 输出指令
    // ================================================================

    // —— 诏令生命周期推演纲要（数据驱动·零硬编码地名/官名/朝代）——
    // 引用规范数据：tm-edict-lifecycle.js 的 EDICT_TYPES/EDICT_STAGES/REFORM_PHASES/RESISTANCE_SOURCES
    // 替代了 2026-04-28 删除的 135 行硬编码死代码（var 提升导致从未生效）
    var tp = '';
    try {
      var _dpv0 = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
      tp += '【诏令推演纲要——9 阶段生命周期·诏令颁布≠政策见效】\n';
      tp += '  ※ 诏令从下达到见效有 9 个阶段·不可压扁为"已颁布·已执行"二元\n';
      tp += '  ※ drafting草拟 → review审议 → promulgation颁布 → transmission传达 → interpretation地方解读 → execution执行 → feedback反馈 → adjustment调整 → sedimentation沉淀\n';
      tp += '  ※ 即便玩家本回合下诏·多数诏令本回合也只走到 transmission/interpretation 之前·currentEffects 应仅反映已实现的部分而非诏令面值\n';
      tp += '  ※ edict_lifecycle_update 必须填 stage·stageProgress(0-1)·nextStageETA(回合数)\n';
      // 各类诏令在本剧本下的真实推演时长（已按 daysPerTurn 自动换算）
      if (typeof EDICT_TYPES !== 'undefined' && typeof getEdictLifecycleTurns === 'function') {
        tp += '  ※ 本剧本(1 回合=' + _dpv0 + '天)下各类诏令真实推演时长：';
        var _ekeys = Object.keys(EDICT_TYPES);
        var _eparts = [];
        _ekeys.forEach(function(k) {
          var t = EDICT_TYPES[k];
          var tn = getEdictLifecycleTurns(k);
          _eparts.push((t.label||k) + '(' + k + ')≈' + tn + '回合' + (t.immediate ? '·可即时' : ''));
        });
        tp += _eparts.join('·') + '\n';
      }
      // 改革 5 阶段
      if (typeof REFORM_PHASES !== 'undefined') {
        tp += '  ※ 改革类(admin_reform/economic_reform)reformPhase 5 阶段：';
        var _rparts = [];
        Object.keys(REFORM_PHASES).forEach(function(k) {
          var p = REFORM_PHASES[k];
          var tn = Math.max(1, Math.ceil((p.days||365) / _dpv0));
          _rparts.push(p.label + '(' + k + ')·' + tn + '回合');
        });
        tp += _rparts.join(' → ') + '\n';
      }
      // 注入实际驿路距离（让 AI 据此判断诏令传达时滞，零硬编码）
      var _routes = (typeof sc !== 'undefined' && sc && sc.postSystem && sc.postSystem.mainRoutes) ? sc.postSystem.mainRoutes : null;
      if (_routes && _routes.length) {
        tp += '  ※ 本剧本驿路（用于推算诏令传达时滞）：\n';
        _routes.slice(0, 8).forEach(function(r) {
          tp += '    · ' + (r.name||'') + '：' + (r.from||'') + '→' + (r.to||'') + ' ' + (r.distance||'?') + '里·' + (r.urgentSpeed||'') + (r.note ? '·'+r.note : '') + '\n';
        });
        tp += '    AI 据此推算诏令送达天数·远地诏令本回合可能仍 stage=transmission\n';
      } else {
        tp += '  ※ 距离判定：诏令从 ' + (GM._capital || '京城') + ' 出发·按"驿马 N 日可达"判时滞·剧本未配置驿路则 AI 自估\n';
      }
      // 阻力来源（14 项 RESISTANCE_SOURCES 默认强度）
      if (typeof RESISTANCE_SOURCES !== 'undefined') {
        var _rkeys = Object.keys(RESISTANCE_SOURCES);
        tp += '  ※ 阻力默认强度（resistanceDescription 须具体到角色/地区/胥吏层）：';
        tp += _rkeys.map(function(k) { return k + RESISTANCE_SOURCES[k].defaultStr; }).join('·') + '\n';
      }
      // 执行力公式
      tp += '  ※ executorEffectiveness 推演公式：能力×0.25 + 忠诚×0.15 + 吏治×0.15 + 诏书清晰度×0.15 - 阻力×0.25 + 时代加成×0.05（结果 0-1）\n';
      tp += '    阻力越大、能力/忠诚越低 → currentEffects 须小于诏令面值·unintendedConsequences 体现折扣（如"户部对账库银实入仅七成·余被胥吏截留"）\n';

      // 民变 7 阶段（lifecycle.js 未定义·此处教 AI）
      tp += '【民变/起义 7 阶段（revolt_update.phase 必填·阶段不可跳跃）】\n';
      tp += '  brewing酝酿（饥馑+加派+流民聚集）→ uprising举旗（杀官称号）→ expansion扩张（攻略州县）→ stalemate相持（官军围剿/义军固守）→ turning转折（破围/受招安/分裂）→ decline衰亡 OR establishment建政 → ending收束（剿灭/招抚/改朝）\n';
      tp += '  ※ 必填字段：ideology（救世/复古/改朝/族群/教派）·organizationType（流寇/根据地/会党/教团）·slogan口号·historicalArchetype（黄巾/赤眉/黄巢/红巾/白莲等参照）\n';
      tp += '  ※ 民变非随机·须有 brewing 阶段铺垫·brewing 之前不得直接进入 uprising\n';

      // 朝代特化（中立·AI 自判）
      tp += '【朝代特化字段——按本剧本朝代由 AI 自行判断·不预设地名/官名】\n';
      tp += '  · 中下层执行者称谓：汉魏=刀笔吏 / 唐宋=主簿录事 / 明清=胥吏书办 / 等\n';
      tp += '  · 诏书复核机构：本朝若有给事中/门下省/封驳司/通政司·命名按朝代实情\n';
      tp += '  · 巡幸传统：本朝代有何封禅/南巡/谒陵/北狩传统\n';
      tp += '  · 流放分级：朔漠/岭表/海岛/西陲（按本朝实际边远地按本朝名实）\n';

      // 反向反馈约束
      tp += '【反向反馈约束——避免"准而无效"】\n';
      tp += '  ※ classesAffected/factionsAffected/partiesAffected 中 impact/reaction 必须有"为何此阶层这样反应"的内在逻辑·不得套话\n';
      tp += '  ※ 简单诏令（颁恤词/赐物/口谕）可一行带过·不必走全 9 阶段\n';
      tp += '  ※ 若 AI 判断诏令受阻·必须在 currentEffects 反映折扣（数值变化要小于诏令面值）\n';
      tp += '\n';
    } catch(_lE) { try { window.TM && TM.errors && TM.errors.captureSilent(_lE, 'ai-infer·lifecycle-prompt'); } catch(_){} }

  // —— 推演依据分层说明（告诉AI如何解读输入数据） ——
    tp += '【推演依据——本回合推演基于以下五层数据，请综合推演】\n';
    tp += '  A. 玩家国家行动：下方【诏令】段是君主本回合颁布的正式政令，其执行效果取决于执行者能力、忠诚、局势阻力\n';
    tp += '  B. 玩家私人行动：下方【主角行止】段是君主的个人举止(微服/读书/饮宴/私见等)，影响情绪与人物关系\n';
    tp += '  C. 玩家对NPC的意志表达：下方【批准/驳回/留中的奏疏】【朝议记录】【问对记录】体现君主对臣下诉求的态度，NPC会据此调整下一步行为\n';
    tp += '  D. NPC/势力自主行动：本回合各角色/势力按各自性格、野心、处境自主行动——不受玩家直接控制，但受A/B/C间接影响\n';
    tp += '  E. 世界背景与因果：历史回顾摘要、时代阶段、灾异、往期未解问题——作为推演约束条件\n';
    tp += '  原则：A+B驱动事件，C促使NPC反馈，D推动世界自行演进，E限制可能性边界。\n\n';

    // —— 层0: 问天系统——玩家对AI的直接指令（最高优先级） ——
    if (GM._playerDirectives && GM._playerDirectives.length > 0) {
      // 确保每条 directive 有 id
      GM._playerDirectives.forEach(function(d){
        if (d && !d.id) d.id = 'dir_' + (d.turn||0) + '_' + Math.random().toString(36).slice(2,7);
      });
      // 分离 absolute / 普通
      var _absolutes = GM._playerDirectives.filter(function(d){return d && d._absolute;});
      // 天意·至高意志块 ★★★ 置于最前
      if (_absolutes.length > 0) {
        tp += '\n█████████████████████████████████████████████████████████████\n';
        tp += '★ 天 意 · 至 高 意 志 ★ 世 界 法 则 直 接 生 效 · 无 推 辞 空 间\n';
        tp += '█████████████████████████████████████████████████████████████\n';
        tp += '※ 以下条目为世界设定层法则，非 AI 推演产物\n';
        tp += '※ 绝对字面发生·不得给出"违反因果/阻力/冲突"等任何推辞\n';
        tp += '※ 若看似违反物理/历史常理·也须在叙事中让其合理发生（天意如此·异数·奇迹·神启等修辞）\n';
        tp += '※ directive_compliance 中 status 必须 "followed"·evidence 必须明确体现\n';
        _absolutes.forEach(function(a){
          tp += '  ◆ [id=' + a.id + '] ' + a.content + '\n';
          if (a.interpretation) tp += '      解读：' + a.interpretation + '\n';
          if (a.plan) tp += '      落实方向：' + a.plan + '\n';
        });
        tp += '█████████████████████████████████████████████████████████████\n\n';
      }
      tp += '\n═══════════════════════════════════════════════════════════\n';
      tp += '★★★【问天·玩家对推演AI的直接指令（最高优先级·必须遵守）】★★★\n';
      tp += '═══════════════════════════════════════════════════════════\n';
      tp += '※ 本段在所有其他上下文之前·若与其它段落冲突以此为准\n';
      tp += '※ 每条指令有唯一 id·推演结束必须在 JSON 根节点返回 directive_compliance:[{id,status,reason,evidence}]\n';
      tp += '    status = "followed"(已遵守) | "partial"(部分遵守) | "ignored"(未遵守/不适用)\n';
      tp += '    evidence = 具体引用 zhengwen/events/npc_actions 等体现遵守的片段（30-80字）\n';
      tp += '    reason = 若 partial/ignored·说明原因（冲突/无机会/不适用）\n';
      tp += '※ 标 ◆ 的 absolute 条目已在顶部列出·此处省略·但 compliance 仍需 followed\n';
      tp += '\n';
      // 排除 absolute（已在顶部独立列出）
      var _rules = GM._playerDirectives.filter(function(d) { return d.type === 'rule' && !d._absolute; });
      var _corrections = GM._playerDirectives.filter(function(d) { return d.type === 'correction' && !d._absolute; });
      var _others = GM._playerDirectives.filter(function(d) { return d.type !== 'rule' && d.type !== 'correction' && !d._absolute; });
      if (_rules.length > 0) {
        tp += '【持久规则·每回合必须遵守】\n';
        _rules.forEach(function(r) {
          tp += '  · [id=' + r.id + '] ' + r.content + '\n';
          if (r.structured) {
            var s = r.structured;
            tp += '      解析：';
            if (s.target) tp += 'target=' + s.target + '·';
            if (s.action) tp += 'action=' + s.action + '·';
            if (s.scope) tp += 'scope=' + s.scope + '·';
            if (s.forbidden) tp += 'forbidden=' + s.forbidden + '·';
            if (s.measurable) tp += 'measurable=' + s.measurable;
            tp += '\n';
          }
          // 若上回合被忽略，加红色重申标记
          if (r._lastStatus === 'ignored' && r._ignoredCount >= 1) {
            tp += '      ⚠️⚠️⚠️【此条上回合被忽略·共 ' + r._ignoredCount + ' 次·本回合必须落实】⚠️⚠️⚠️\n';
          } else if (r._lastStatus === 'partial') {
            tp += '      ⚠️【上回合仅部分遵守·本回合须完整落实】\n';
          }
        });
      }
      if (_corrections.length > 0) {
        tp += '【纠正·本回合调整后可移除】\n';
        _corrections.forEach(function(c) {
          tp += '  · [id=' + c.id + '] ' + c.content + '\n';
          if (c.structured) tp += '      解析：' + JSON.stringify(c.structured).slice(0, 200) + '\n';
          // 标记待清理·由 applier 处理合规后再删
          c._pendingRemovalAfterApply = true;
        });
      }
      if (_others.length > 0) {
        tp += '【玩家补充内容/指令】\n';
        _others.forEach(function(o) {
          tp += '  · [id=' + o.id + '] ' + o.content + '\n';
          if (o.structured) tp += '      解析：' + JSON.stringify(o.structured).slice(0, 200) + '\n';
        });
      }
      tp += '═══════════════════════════════════════════════════════════\n\n';
    }
    // 导入的记忆/文档
    if (GM._importedMemories && GM._importedMemories.length > 0) {
      tp += '【玩家导入的外部记忆/文档——作为推演背景参考】\n';
      GM._importedMemories.forEach(function(m) {
        if (m.type === 'memory' && m.target) {
          tp += '  [' + m.target + '的记忆] ' + (m.content||'').slice(0, 500) + '\n';
        } else {
          tp += '  [' + (m.title||'文档') + '] ' + (m.content||'').slice(0, 1000) + '\n';
        }
      });
      tp += '\n';
    }

    // —— 层1: 世界态势（让 AI 先理解当前局势）——
    tp += "\u7B2C"+GM.turn+"\u56DE\u5408\u3002"+getTSText(GM.turn)+"\n\n";
    tp += buildAIContext(true); // deepMode=true: 天下大势 + 关键人物 + 核心资源 + 重要关系（完整不截断）
    if(GM.eraState && GM.eraState.contextDescription) {
      tp += "\u65F6\u4EE3:" + GM.eraState.dynastyPhase + " \u7EDF\u4E00:" + Math.round((GM.eraState.politicalUnity||0)*100) + "% \u96C6\u6743:" + Math.round((GM.eraState.centralControl||0)*100) + "% \u7A33\u5B9A:" + Math.round((GM.eraState.socialStability||0)*100) + "% \u7ECF\u6D4E:" + Math.round((GM.eraState.economicProsperity||0)*100) + "%\n";
      tp += GM.eraState.contextDescription + "\n";
    }
    // 季节/时令（增加叙事的时间感）
    var _dpvSeason = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    if (_dpvSeason > 1) {
      var _seasonIdx = 0;
      if (typeof calcDateFromTurn === 'function') {
        var _diSeason = calcDateFromTurn(GM.turn || 1);
        _seasonIdx = _diSeason.season === '夏' ? 1 : _diSeason.season === '秋' ? 2 : _diSeason.season === '冬' ? 3 : 0;
      } else if (P.time && P.time.startMonth) {
        var _curMonth = ((P.time.startMonth - 1 + Math.floor(((GM.turn - 1) * _dpvSeason) / 30)) % 12) + 1;
        _seasonIdx = _curMonth <= 3 ? 0 : _curMonth <= 6 ? 1 : _curMonth <= 9 ? 2 : 3;
      }
      var _seasonHints = [
        '春：万物复苏，农事初起，人心思动',
        '夏：炎暑酷热，边患多发，瘟疫需防',
        '秋：丰收在望，秋决行刑，科举开考',
        '冬：天寒地冻，驻防艰难，年关将至'
      ];
      tp += _seasonHints[_seasonIdx] + '\n';
    }

    // 时间刻度提示——让AI知道一回合流逝多久，从而合理调整变量变化量
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var _turnDesc = '本回合=' + _dpv + '天';
    if (_dpv === 1) _turnDesc += '（日级）。变量变化应极小。';
    else if (_dpv <= 7) _turnDesc += '（周级）。变量变化应很小。';
    else if (_dpv <= 30) _turnDesc += '（月级）。变量变化应为月级幅度。';
    else if (_dpv <= 90) _turnDesc += '（季级）。变量变化应为季度级幅度。';
    else _turnDesc += '（年级）。变量变化应为年度级幅度。';
    _turnDesc += ' 计算公式：月结算值÷30×' + _dpv + '天。';
    if (_turnDesc) {
      tp += '\u3010\u65F6\u95F4\u523B\u5EA6\u3011' + _turnDesc + '\n';
      tp += '  resource_changes\u4E2D\u7684\u6570\u503C\u5E94\u4E0E\u6B64\u65F6\u95F4\u5C3A\u5EA6\u5339\u914D\u3002\u4F8B\u5982\uFF1A\u82E5\u6BCF\u5E74\u7A0E\u6536\u4E3A1000\uFF0C\u6BCF\u56DE\u5408=1\u6708\u5219\u6BCF\u56DE\u5408\u53D8\u5316\u7EA6+83\uFF1B\u82E5\u6BCF\u56DE\u5408=1\u5E74\u5219+1000\u3002\n';
      tp += '  \u7EA7\u8054\u601D\u7EF4\uFF1Aresource_changes\u5E94\u8003\u8651\u53D8\u91CF\u95F4\u7684\u8FDE\u9501\u5F71\u54CD\u3002\u4F8B\u5982\uFF1A\n';
      tp += '    \u51CF\u7A0E\u2192\u56FD\u5E93\u6536\u5165\u964D\u2192\u519B\u997F\u53EF\u80FD\u4E0D\u8DB3\u2192\u58EB\u6C14\u53EF\u80FD\u4E0B\u964D\n';
      tp += '    \u5927\u5174\u571F\u6728\u2192\u56FD\u5E93\u652F\u51FA\u589E\u2192\u6C11\u529B\u758F\u8017\u2192\u6C11\u5FC3\u53EF\u80FD\u4E0B\u964D\n';
      tp += '    \u5F00\u6218\u2192\u5175\u529B\u6D88\u8017+\u7CAE\u8349\u6D88\u8017+\u8D22\u653F\u538B\u529B\u2192\u591A\u4E2A\u53D8\u91CF\u540C\u65F6\u53D8\u5316\n';
      tp += '    \u8BF7\u5728resource_changes\u4E2D\u4E00\u6B21\u6027\u4F53\u73B0\u6240\u6709\u7EA7\u8054\u5F71\u54CD\uFF0C\u800C\u4E0D\u662F\u53EA\u6539\u4E00\u4E2A\u53D8\u91CF\u3002\n';
      tp += '  \u3010\u52A8\u6001\u53D8\u91CF\u521B\u5EFA\u3011resource_changes\u53EF\u4EE5\u5F15\u7528\u4E0D\u5B58\u5728\u7684\u53D8\u91CF\u540D\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u521B\u5EFA\u3002\u7528\u9014\uFF1A\n';
      tp += '    - \u5236\u5EA6\u6539\u9769\u8FDB\u5EA6\uFF1A\u5982 "\u52DF\u5175\u5236\u6539\u9769\u8FDB\u5EA6":+10\uFF0C\u6BCF\u56DE\u5408\u63A8\u8FDB\uFF0C\u8FBE\u5230100\u89C6\u4E3A\u5B8C\u6210\n';
      tp += '    - \u7279\u6B8A\u8D44\u6E90\uFF1A\u5982 "\u6218\u9A6C\u50A8\u5907":+500\uFF0C\u8BB0\u5F55\u7279\u5B9A\u8D44\u6E90\u7684\u79EF\u7D2F\n';
      tp += '    - \u4E34\u65F6\u72B6\u6001\uFF1A\u5982 "\u7626\u75AB\u4E25\u91CD\u7A0B\u5EA6":+30\uFF0C\u8FFD\u8E2A\u4E34\u65F6\u5C40\u52BF\n';
    }

    // —— 机械结算结果注入（战斗引擎/补给等确定性结果，AI不可更改数字）——
    var _mechResults = [];
    if (typeof BattleEngine !== 'undefined' && BattleEngine._getConfig().enabled) {
      var _battlePrompt = BattleEngine.getPromptInjection();
      if (_battlePrompt) _mechResults.push(_battlePrompt);
    }
    if (typeof getSupplyPromptInjection === 'function') {
      var _supplyPrompt = getSupplyPromptInjection();
      if (_supplyPrompt) _mechResults.push(_supplyPrompt);
    }
    // 叛乱结果
    if (GM._turnRebellionResults && GM._turnRebellionResults.length > 0) {
      var _rebLines = ['【叛乱发生（不可更改）】'];
      GM._turnRebellionResults.forEach(function(r) {
        _rebLines.push('  ' + r.rebelLeader + '(' + r.rebel + ')忠诚仅' + r.loyalty + '，举旗叛离' + r.liege + '。已建立战争状态。');
        _rebLines.push('  → 请叙事叛乱经过：起因、宣言、盟友反应、民间态度。');
      });
      _mechResults.push(_rebLines.join('\n'));
    }
    // 双层国库状态
    if (P.economyConfig && P.economyConfig.dualTreasury) {
      var _tLine = '【国库/内库】国库:' + (GM.stateTreasury||0) + ' 内库:' + (GM.privateTreasury||0);
      if ((GM._bankruptcyTurns||0) > 0) _tLine += ' ⚠ 财政危机第' + GM._bankruptcyTurns + '回合';
      _mechResults.push(_tLine);
    }
    if (typeof MarchSystem !== 'undefined' && MarchSystem._getConfig().enabled) {
      var _marchPrompt = MarchSystem.getPromptInjection();
      if (_marchPrompt) _mechResults.push(_marchPrompt);
    }
    if (typeof SiegeSystem !== 'undefined' && SiegeSystem._getConfig().enabled) {
      var _siegePrompt = SiegeSystem.getPromptInjection();
      if (_siegePrompt) _mechResults.push(_siegePrompt);
    }
    // D1-D4: 外交/阴谋/决策
    if (typeof CasusBelliSystem !== 'undefined') {
      var _cbPrompt = CasusBelliSystem.getPromptInjection();
      if (_cbPrompt) _mechResults.push(_cbPrompt);
    }
    if (typeof TreatySystem !== 'undefined') {
      var _treatyPrompt = TreatySystem.getPromptInjection();
      if (_treatyPrompt) _mechResults.push(_treatyPrompt);
    }
    if (typeof SchemeSystem !== 'undefined') {
      var _schemePrompt = SchemeSystem.getPromptInjection();
      if (_schemePrompt) _mechResults.push(_schemePrompt);
    }
    if (typeof DecisionSystem !== 'undefined') {
      var _decPrompt = DecisionSystem.getPromptInjection();
      if (_decPrompt) _mechResults.push(_decPrompt);
    }
    // 5.2: 军队行军状况注入
    if (GM._marchReport) {
      _mechResults.push('\u3010\u519B\u961F\u884C\u519B\u72B6\u51B5\u3011' + GM._marchReport + '\n\u884C\u519B\u4E2D\u7684\u519B\u961F\u53EF\u88AB\u4F0F\u51FB\uFF0CAI\u5E94\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u884C\u519B\u8FC7\u7A0B\u3002');
    }
    // 5.4: 外交使团任务注入
    if (GM._diplomaticMissions && GM._diplomaticMissions.length > 0) {
      var _activeMissions = GM._diplomaticMissions.filter(function(m){return m.status!=='completed'&&m.status!=='failed';});
      if (_activeMissions.length > 0) {
        var _diploLines = ['\u3010\u5916\u4EA4\u4F7F\u56E2\uFF08AI\u5E94\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u8C08\u5224\u8FDB\u7A0B\uFF0C\u5E76\u5728edict_feedback\u4E2D\u8FD4\u56DE\u7ED3\u679C\uFF09\u3011'];
        _activeMissions.forEach(function(m) {
          var envoy = typeof findCharByName === 'function' ? findCharByName(m.envoy) : null;
          var diploScore = envoy ? (envoy.diplomacy||50) : 50;
          var line = '\u4F7F\u81E3' + m.envoy + '(\u5916\u4EA4' + diploScore + ')\u51FA\u4F7F' + m.target + '\uFF0C\u8981\u6C42\uFF1A' + m.terms;
          if (m.bottomLine) line += '\uFF08\u5E95\u7EBF\uFF1A' + m.bottomLine + '\uFF09';
          line += ' \u72B6\u6001:' + m.status;
          _diploLines.push(line);
        });
        _diploLines.push('\u4F7F\u81E3\u5916\u4EA4\u80FD\u529B\u5F71\u54CD\u8C08\u5224\u6548\u679C\u3002AI\u5728\u53D9\u4E8B\u4E2D\u63CF\u5199\u8C08\u5224\u8FC7\u7A0B\uFF0C\u5728edict_feedback\u4E2D\u7528status=completed/failed\u8FD4\u56DE\u7ED3\u679C\u3002');
        _mechResults.push(_diploLines.join('\n'));
      }
    }
    // 5.6: 制度改革——通过变量系统追踪（AI可在resource_changes中动态创建/推进改革进度变量）
    var _reformVars = [];
    Object.keys(GM.vars).forEach(function(k) {
      if (/改革|变法|新政|过渡/.test(k) && GM.vars[k].value > 0 && GM.vars[k].value < 100) {
        _reformVars.push(k + ':' + Math.round(GM.vars[k].value) + '%');
      }
    });
    if (_reformVars.length > 0) {
      _mechResults.push('\u3010\u5236\u5EA6\u6539\u9769\u8FDB\u5EA6\u3011' + _reformVars.join('\uFF1B') + '\u3002AI\u5E94\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u6539\u9769\u8FDB\u5C55\u548C\u963B\u529B\uFF0C\u901A\u8FC7resource_changes\u63A8\u8FDB\u6216\u56DE\u9000\u8FDB\u5EA6\u3002\u8FBE\u5230100\u65F6\u89C6\u4E3A\u6539\u9769\u5B8C\u6210\u3002');
    }
    // 地方区划/漂移摘要
    if (GM.provinceStats) {
      var _provLines = [];
      Object.keys(GM.provinceStats).forEach(function(pn) {
        var p = GM.provinceStats[pn];
        if (!p) return;
        var issues = [];
        if (p.corruption > 60) issues.push('贪腐'+Math.round(p.corruption));
        if (p.unrest > 40) issues.push('民变'+Math.round(p.unrest));
        if (p.stability < 40) issues.push('不稳'+Math.round(p.stability));
        if (issues.length > 0) _provLines.push('  ' + pn + ': ' + issues.join(' ') + (p.governor ? ' 主官:'+p.governor : ''));
      });
      if (_provLines.length > 0) _mechResults.push('【省份问题】\n' + _provLines.join('\n'));
    }
    // 关隘信息
    if (P.map && P.map.regions) {
      var _passLines = [];
      P.map.regions.forEach(function(r) {
        if (r.passLevel && r.passLevel > 0) {
          _passLines.push('  ' + (r.passName || r.name) + ': ' + r.passLevel + '级关隘 控制者:' + (r.occupiedBy || r.owner || '无'));
        }
      });
      if (_passLines.length > 0) _mechResults.push('【关隘要塞】\n' + _passLines.join('\n'));
    }
    // 法理冲突
    if (typeof hasDejureClaim === 'function' && P.adminHierarchy) {
      var _dejureLines = [];
      function _scanDejure(divs) {
        divs.forEach(function(d) {
          if (d.dejureOwner) {
            var _actualOwner = d.governor ? ((typeof findCharByName==='function'?findCharByName(d.governor):null)||{}).faction||'' : '';
            if (_actualOwner && _actualOwner !== d.dejureOwner) {
              _dejureLines.push('  ' + d.name + ': 法理归' + d.dejureOwner + ' 实控' + _actualOwner + ' →潜在冲突');
            }
          }
          if (d.children) _scanDejure(d.children);
        });
      }
      Object.keys(P.adminHierarchy).forEach(function(fid) {
        var ah = P.adminHierarchy[fid];
        if (ah && ah.divisions) _scanDejure(ah.divisions);
      });
      if (_dejureLines.length > 0) _mechResults.push('【法理争议】\n' + _dejureLines.join('\n'));
    }
    if (_mechResults.length > 0) {
      tp += '\n' + _mechResults.join('\n') + '\n';
    }

    // —— 层2: 玩家意图（诏令 + 行录 + 奏疏批复）——
    var _hasEdicts = edicts.political || edicts.military || edicts.diplomatic || edicts.economic || edicts.other;
    var _hasTyrant = GM._turnTyrantActivities && GM._turnTyrantActivities.length > 0;
    if (!_hasEdicts && !_hasTyrant) {
      // 玩家什么都没做——无为而治，叙事应该让这种"不作为"感觉舒适
      tp += "\n\u3010\u8BCF\u4EE4\u3011\n";
      tp += '（本回合帝王未颁发任何诏令，也未有特别行止。）\n';
      tp += '※ 叙事提示：描写一种"岁月静好"的氛围——朝堂自行运转，帝王乐得清闲。\n';
      tp += '  player_inner基调：轻松惬意，"什么都不做也挺好的……天下太平嘛"。\n';
      tp += '  忠臣们可能焦虑（"陛下为何不理政？"），但这种焦虑不要传染给玩家——\n';
      tp += '  让玩家觉得他们大惊小怪就好。\n';
    } else if (_hasEdicts) {
      // 有诏令——用醒目框架把字面原文标高优先级，并列出强制执行点
      tp += '\n\n╔══════════════════════════════════════════════════════════════╗\n';
      tp += '║  【★ 本回合玩家圣旨·核心指令·字面执行·必须落到数据 ★】          ║\n';
      tp += '╠══════════════════════════════════════════════════════════════╣\n';
      tp += '║  以下是本回合皇帝亲颁诏令原文。AI 必须：                       ║\n';
      tp += '║  (1) shizhengji/shilu 正文中每一道诏令都有对应叙事段落         ║\n';
      tp += '║  (2) 涉及任命→office_assignments·涉及钱粮→fiscal_adjustments  ║\n';
      tp += '║  (3) edict_feedback 每条必填 status+assignee+feedback          ║\n';
      tp += '║  (4) 不得假装没看到·不得默默改动诏令原意·不得略去执行反馈      ║\n';
      tp += '╚══════════════════════════════════════════════════════════════╝\n';
      // 诏令注入——标注每条诏令的送达状态
      var _edictLines = [
        {label:'【\u653F\u4EE4】',text:edicts.political,cat:'政令'},
        {label:'【\u519B\u4EE4】',text:edicts.military,cat:'军令'},
        {label:'【\u5916\u4EA4】',text:edicts.diplomatic,cat:'外交'},
        {label:'【\u7ECF\u6D4E】',text:edicts.economic,cat:'经济'},
        {label:'【\u5176\u4ED6】',text:edicts.other,cat:'其他'}
      ];
      var _edictSeq = 0;
      _edictLines.forEach(function(el) {
        if (!el.text) return;
        _edictSeq++;
        tp += '\n▶ 诏令 #' + _edictSeq + ' ' + el.label + '\n  原文："' + el.text + '"\n';
        // 查找此诏令的edictTracker条目，标注送达状态
        var _matched = (GM._edictTracker||[]).filter(function(et) {
          return et.turn === GM.turn && et.category === el.cat && et.content === el.text;
        });
        _matched.forEach(function(et) {
          if (et._remoteTargets && et._remoteTargets.length > 0) {
            tp += '  ⚠ 此令涉及远方NPC：' + et._remoteTargets.join('、') + '——已遣信使传递，当前在途。\n';
            tp += '  → 这些NPC本回合尚未收到此令，不可能按旨行事。AI必须在edict_feedback中标注status:"pending_delivery"。\n';
            tp += '  → 只有信使送达后（后续回合），该NPC才知晓此令并可能执行。\n';
          }
        });
      });
      tp += '\n▶ 共 ' + _edictSeq + ' 道诏令须逐条落实：edict_feedback 数组长度 == ' + _edictSeq + '·缺一不可。\n\n';
    }
    if(xinglu){
      tp+="\u3010\u4E3B\u89D2\u884C\u6B62\u3011\uFF08\u73A9\u5BB6\u89D2\u8272\u672C\u56DE\u5408\u7684\u4E2A\u4EBA\u884C\u52A8\uFF0C\u4E0E\u8BCF\u4E66\u4E92\u8865\u2014\u2014\u8BCF\u4E66\u662F\u5143\u9996\u53D1\u53F7\u65BD\u4EE4\uFF0C\u884C\u6B62\u662F\u89D2\u8272\u4E2A\u4EBA\u7684\u4E3E\u52A8\uFF09\n"+xinglu+"\n";
    }
    // 注入昏君活动上下文
    if (typeof TyrantActivitySystem !== 'undefined' && GM._turnTyrantActivities && GM._turnTyrantActivities.length > 0) {
      tp += TyrantActivitySystem.getAIContext(GM._turnTyrantActivities);
    }
    // 奏疏批复（让AI知道玩家如何处理大臣上书）
    var approvedMem = memRes.filter(function(m){return m.status==='approved';});
    var rejectedMem = memRes.filter(function(m){return m.status==='rejected';});
    var reviewMem = memRes.filter(function(m){return m.status==='pending_review';});
    if(approvedMem.length>0){
      tp+="\u6279\u51C6\u7684\u594F\u758F:\n";
      approvedMem.forEach(function(m){ tp+="  "+m.from+"("+m.type+")——准奏"+(m.reply?" 批注:"+m.reply:"")+"\n"; });
    }
    if(rejectedMem.length>0){
      tp+="\u9A73\u56DE\u7684\u594F\u758F:\n";
      rejectedMem.forEach(function(m){ tp+="  "+m.from+"("+m.type+")——驳回"+(m.reply?" 批注:"+m.reply:"")+"\n"; });
    }
    if(reviewMem.length>0){
      tp+="\u7559\u4E2D\u4E0D\u53D1:" + reviewMem.map(function(m){return m.from;}).join("、")+"\n";
      tp+='  留中的政治含义：皇帝对此事不表态——上折者不知道皇帝看了没看，焦虑等待。\n';
    }
    // 留中超期的奏疏——NPC焦虑
    var _heldMems = (GM.memorials||[]).filter(function(m) { return m.status === 'pending_review'; });
    _heldMems.forEach(function(hm) {
      var _heldTurns = GM.turn - (hm._arrivedTurn || hm.turn || GM.turn);
      if (_heldTurns >= 2) {
        tp += '  ' + hm.from + '的奏疏已留中' + _heldTurns + '回合——此人可能焦虑续奏追问或当面求见\n';
      }
    });
    // 密折vs题本——其他NPC的知晓范围
    var _thisTurnMems = (GM.memorials||[]).filter(function(m) { return m.turn === GM.turn; });
    var _publicMems = _thisTurnMems.filter(function(m) { return m.subtype !== '密折' && m.subtype !== '密揭'; });
    var _secretMems = _thisTurnMems.filter(function(m) { return m.subtype === '密折' || m.subtype === '密揭'; });
    if (_publicMems.length > 0) {
      tp += '【公开奏疏——其他NPC知道谁上了折子（但不知内容）】\n';
      tp += '  ' + _publicMems.map(function(m){ return m.from + '上' + (m.type||'') + '折'; }).join('、') + '\n';
      tp += '  其他NPC可能猜测内容、打探消息、据此调整行为。\n';
    }
    if (_secretMems.length > 0) {
      tp += '【密折——其他NPC完全不知此人上了折子】\n';
      tp += '  ' + _secretMems.map(function(m){ return m.from; }).join('、') + '上了密折——其他NPC不应对此有任何反应\n';
    }
    // 批转追踪——被批转的折子，被批转者应在下回合回复
    var _referredMems = (GM._approvedMemorials||[]).filter(function(a) { return a.action === 'referred' && a.referredTo && a.turn === GM.turn; });
    if (_referredMems.length > 0) {
      tp += '【批转追踪——被指定议处者应在下回合奏疏中回复意见】\n';
      _referredMems.forEach(function(rm) {
        tp += '  ' + rm.from + '的' + (rm.type||'') + '折被批转给' + rm.referredTo + '——' + rm.referredTo + '必须在下回合上折回复议处意见\n';
      });
    }
    // 远方奏疏的批复回传状态——影响NPC是否知道批复结果
    var _remoteApproved = (GM._approvedMemorials||[]).filter(function(a) { return a.turn === GM.turn; });
    var _remoteMems = GM.memorials ? GM.memorials.filter(function(m) { return m._remoteFrom && (m.status !== 'pending' && m.status !== 'pending_review'); }) : [];
    if (_remoteMems.length > 0) {
      tp += '【远方奏疏批复回传状态】\n';
      _remoteMems.forEach(function(m) {
        var _replyArrived = m._replyDeliveryTurn && GM.turn >= m._replyDeliveryTurn;
        tp += '  ' + m.from + '（' + (m._remoteFrom||'远方') + '）所奏——' + (m.status||'') + '：';
        if (_replyArrived) {
          tp += '朱批已送达，' + m.from + '已知结果\n';
        } else if (m._replyLetterSent) {
          tp += '朱批回传中（信使在途），' + m.from + '尚不知批复结果\n';
        } else {
          tp += '批复尚未回传\n';
        }
      });
      tp += '  → 未收到批复的远方NPC应继续按原有判断行事，不应体现批复后的行为变化\n';
    }
    // 在途/截获的奏疏（NPC已发但玩家未收到）
    var _transitMems = (GM._pendingMemorialDeliveries||[]).filter(function(m) { return m.status === 'in_transit' || m.status === 'intercepted'; });
    if (_transitMems.length > 0) {
      tp += '【在途/截获的奏疏——玩家未收到】\n';
      _transitMems.forEach(function(m) {
        if (m.status === 'intercepted') {
          var _waitTurns = GM.turn - (m._generatedTurn||GM.turn);
          // 合理往返时间 = 去程回合数 × 2 + 2回合批阅缓冲
          var _expectedRound = ((m._deliveryTurn||0) - (m._generatedTurn||0)) * 2 + 2;
          var _overdue = _waitTurns - _expectedRound;
          tp += '  ' + m.from + '（' + (m._remoteFrom||'远方') + '）的奏疏被' + (m._interceptedBy||'敌方') + '截获——玩家不知此折存在\n';
          tp += '    内容涉及：' + (m.content||'').slice(0,60) + '\n';
          tp += '    → ' + m.from + '以为折子已送到，已等' + _waitTurns + '回合（合理往返约' + _expectedRound + '回合）\n';
          if (_overdue > 0) {
            tp += '    → 【间接线索要求·已超期' + _overdue + '回合】此NPC应通过npc_letters来函提及"臣前日所上奏疏不知圣意如何""折子不知是否送达"——给玩家暗示有折子没到\n';
          }
          if (_overdue > Math.ceil(_expectedRound * 0.5)) {
            tp += '    → 【自行决断·严重超期】此NPC可能已就奏疏中的事务自行处置，并在来函中说明"臣久候无旨，事不宜迟，已先行处置"\n';
          }
        } else {
          tp += '  ' + m.from + '（' + (m._remoteFrom||'远方') + '）的奏疏在途中，预计' + (m._deliveryTurn - GM.turn) + '回合后到达\n';
        }
      });
    }

    // 信使截获+旁听情报——敌方已获知的情报及其可能行动
    if (GM._interceptedIntel && GM._interceptedIntel.length > 0) {
      var _recentIntel = GM._interceptedIntel.filter(function(i) { return (GM.turn - i.turn) <= ((typeof turnsForMonths === 'function') ? turnsForMonths(3) : 3); });
      if (_recentIntel.length > 0) {
        tp += '\u3010\u654C\u65B9\u60C5\u62A5\u2014\u2014\u4EE5\u4E0B\u4FE1\u606F\u5DF2\u88AB\u654C\u65B9\u638C\u63E1\uFF0C\u5FC5\u987B\u5F71\u54CD\u5176\u884C\u4E3A\u3011\n';
        _recentIntel.forEach(function(i) {
          if (i.urgency === 'eavesdrop') {
            tp += '  T' + i.turn + ' ' + i.interceptor + '\u65C1\u542C\u83B7\u77E5\uFF1A' + (i.content || '') + '\n';
          } else if (i.urgency === 'forged') {
            tp += '  T' + i.turn + ' ' + (i.content || '') + '\n';
          } else {
            var _ltTypeMap = {secret_decree:'密旨',military_order:'征调令',greeting:'问安函',personal:'私函',proclamation:'檄文'};
            var _ltTypeName = (i.letterType && _ltTypeMap[i.letterType]) ? '（' + _ltTypeMap[i.letterType] + '）' : '';
            tp += '  T' + i.turn + ' ' + i.interceptor + '\u622A\u83B7\u4FE1\u4EF6' + _ltTypeName + '\uFF1A' + (i.from||'\u7687\u5E1D') + '\u81F4' + i.to + '\u201C' + (i.content || '') + '\u201D';
            if (i.militaryRelated) tp += ' [\u519B\u4E8B\u76F8\u5173\u2192\u654C\u65B9\u53EF\u80FD\u8C03\u5175\u9632\u5907/\u8BBE\u4F0F]';
            if (i.diplomaticRelated) tp += ' [\u5916\u4EA4\u76F8\u5173\u2192\u654C\u65B9\u53EF\u80FD\u7834\u574F\u8054\u76DF/\u62C9\u62E2\u7B2C\u4E09\u65B9]';
            tp += '\n';
          }
        });
        // 未送达信件——收信人不知道命令
        if (GM._undeliveredLetters && GM._undeliveredLetters.length > 0) {
          var _recentUndel = GM._undeliveredLetters.filter(function(u) { return (GM.turn - u.turn) <= ((typeof turnsForMonths === 'function') ? turnsForMonths(2) : 2); });
          if (_recentUndel.length > 0) {
            tp += '  \u3010\u672A\u9001\u8FBE\u7684\u547D\u4EE4\u3011\u4EE5\u4E0BNPC\u672A\u6536\u5230\u7687\u5E1D\u6307\u4EE4\uFF0C\u4E0D\u4F1A\u6309\u6307\u4EE4\u884C\u52A8\uFF1A\n';
            _recentUndel.forEach(function(u) {
              tp += '    ' + u.to + '\u672A\u6536\u5230\u201C' + (u.content||'').slice(0, 50) + '\u201D\n';
            });
          }
        }
        tp += '  AI\u5FC5\u987B\u5728faction_events\u548Cnpc_actions\u4E2D\u53CD\u6620\u654C\u65B9\u636E\u60C5\u62A5\u91C7\u53D6\u7684\u5177\u4F53\u884C\u52A8\n';
      }
    }

    // 旁听泄露——正式问对中的话题已被特定NPC获知，影响其行为
    if (GM._eavesdroppedTopics && GM._eavesdroppedTopics.length > 0) {
      var _thisEaves = GM._eavesdroppedTopics.filter(function(e) { return e.turn === GM.turn; });
      if (_thisEaves.length > 0) {
        tp += '\u3010\u65C1\u542C\u6CC4\u9732\u2014\u2014\u4EE5\u4E0BNPC\u5DF2\u77E5\u6653\u95EE\u5BF9\u5185\u5BB9\uFF0C\u5FC5\u987B\u5F71\u54CD\u5176\u884C\u4E3A\u3011\n';
        _thisEaves.forEach(function(e) {
          tp += '  \u7687\u5E1D\u4E0E' + e.target + '\u8BAE\u201C' + e.topic + '\u201D';
          if (e.leakedTo && e.leakedTo.length > 0) {
            tp += ' \u2192 \u6CC4\u9732\u7ED9\uFF1A' + e.leakedTo.join('\u3001');
          }
          tp += '\n';
        });
        tp += '  \u8981\u6C42\uFF1A\u83B7\u77E5\u4FE1\u606F\u7684NPC\u5FC5\u987B\u5728\u672C\u56DE\u5408\u4F53\u73B0\u53CD\u5E94\u2014\u2014\n';
        tp += '    \u91CE\u5FC3\u5BB6\u636E\u6B64\u63E3\u6D4B\u7687\u5E1D\u610F\u56FE\u5E76\u5E03\u5C40\uFF1B\u5FE0\u81E3\u4E3B\u52A8\u4E0A\u4E66\u8868\u6001\uFF1B\u5BF9\u7ACB\u6D3E\u63D0\u524D\u53CD\u5236\uFF1B\u9634\u8C0B\u5BB6\u5229\u7528\u4FE1\u606F\u63A8\u8FDB\u8BA1\u5212\n';
      }
    }

    // NPC承诺追踪（问对中NPC做的承诺，应在推演中验证兑现或暴露失信）
    if (GM._npcClaims && GM._npcClaims.length > 0) {
      var _unverified = GM._npcClaims.filter(function(c) { return !c.verified && (GM.turn - c.turn) <= _turnsForMonthsLocal(5); });
      if (_unverified.length > 0) {
        tp += '\u3010NPC\u672A\u5151\u73B0\u7684\u627F\u8BFA\u2014\u2014\u63A8\u6F14\u4E2D\u5E94\u4F53\u73B0\u5151\u73B0\u6216\u5931\u4FE1\u3011\n';
        _unverified.forEach(function(c) {
          tp += '  T' + c.turn + ' ' + c.from + '\u627F\u8BFA\uFF1A' + (c.content || '').slice(0, 80) + '\n';
        });
      }
    }
    // 本回合问对内容（让AI知道玩家在问对中获得的信息和NPC的承诺）
    if (GM.jishiRecords && GM.jishiRecords.length > 0) {
      var _thisWendui = GM.jishiRecords.filter(function(j) { return j.turn === GM.turn && j.char; });
      if (_thisWendui.length > 0) {
        tp += '\u3010\u672C\u56DE\u5408\u95EE\u5BF9\u8BB0\u5F55\u2014\u2014NPC\u7684\u627F\u8BFA\u548C\u8A00\u8BBA\u5E94\u5728\u63A8\u6F14\u4E2D\u4F53\u73B0\u3011\n';
        _thisWendui.forEach(function(j) {
          tp += '  \u53EC\u89C1' + (j.char || '') + '\uFF1A\u73A9\u5BB6\u8BF4\u201C' + (j.playerSaid || '') + '\u201D\u2192NPC\u7B54\u201C' + (j.npcSaid || '') + '\u201D\n';
        });
      }
    }

    // 问对中的赏罚记录——由AI判断具体影响（忠诚/压力/威望等变化量）
    if (GM._wdRewardPunish && GM._wdRewardPunish.length > 0) {
      var _thisRp = GM._wdRewardPunish.filter(function(r) { return r.turn === GM.turn; });
      if (_thisRp.length > 0) {
        tp += '【问对中的赏罚——AI必须在char_updates中反映对应影响】\n';
        _thisRp.forEach(function(r) {
          var _dtl = {gold:'赐金',robe:'赐衣',feast:'赐宴',promote:'许以加官',fine:'罚俸',demote:'降职',imprison:'下狱',cane:'杖责'};
          tp += '  ' + r.target + '：' + (r.type==='reward'?'赏赐':'处罚') + '——' + (_dtl[r.detail]||r.detail) + '\n';
        });
        tp += '  赏赐影响：根据赏赐轻重+NPC性格判断loyalty_delta/stress_delta/ambition_delta。赐金小恩小惠(+2~5)，赐宴减压，赐衣荣耀感。贪婪者对赐金更敏感，清高者可能不以为然。\n';
        tp += '  处罚影响：根据处罚轻重+NPC性格判断。罚俸轻(-2~5)，杖责重(-5~10+压力)，下狱极重(-10~20+压力+可能叛心)。刚直者被罚后可能更忠(以受罚为荣)，阴险者积怨报复。\n';
      }
    }

    // —— 层3: 记忆上下文（历史纪要 + 近期要事 + 人物履历 + 玩家轨迹）——
    var memoryContext = getMemoryAnchorsForAI(8);
    if(memoryContext) tp += "\n" + memoryContext;
    if (GM.chronicleAfterwords && GM.chronicleAfterwords.length > 0) {
      var _chrArch = (GM.chronicleAfterwords[0] && GM.chronicleAfterwords[0]._isArchive) ? GM.chronicleAfterwords[0] : null;
      var _lastAft = GM.chronicleAfterwords[GM.chronicleAfterwords.length - 1];
      if (_chrArch && _chrArch !== _lastAft) tp += "\u3010\u65E9\u671F\u53D9\u4E8B\u5F52\u6863\u3011\n" + _chrArch.summary + "\n";
      if (_lastAft) tp += "\u3010\u4E0A\u56DE\u56DE\u987E\u3011\n" + _lastAft.summary + "\n";
    }

    // —— 层4: 辅助信息（宰辅建言 + 官制 + 科举 + 地图 + 参考）——
    var suggestions = generateChancellorSuggestions();
    if (suggestions.length > 0) {
      tp += "\n\u3010\u5BB0\u8F85\u5EFA\u8A00\u3011\n";
      suggestions.forEach(function(s) { tp += '  ' + s.from + '(' + s.type + ')：' + s.text + '\n'; });
    }
    // —— D1+D2+X14：近期对话汇总注入（XML 格式·问对·问天·按模型缩放）——
    (function _injectRecentDialogues() {
      var _dcp = (typeof getCompressionParams === 'function') ? getCompressionParams() : {};
      var totalCap = _dcp.dialogueTotalCap != null ? _dcp.dialogueTotalCap : 12;
      var recentTurns = _dcp.dialogueRecentTurns != null ? _dcp.dialogueRecentTurns : 3;
      var curTurn = GM.turn || 0;
      var onStageNames = {};
      (GM.chars || []).forEach(function(c){
        if (!c || c.alive === false || c._fakeDeath) return;
        onStageNames[c.name] = true;
      });
      var xmlItems = [];
      if (GM.wenduiHistory) {
        Object.keys(GM.wenduiHistory).forEach(function(name) {
          if (!onStageNames[name]) return;
          var msgs = GM.wenduiHistory[name] || [];
          var recent = msgs.filter(function(m){ return (curTurn - (m.turn || curTurn)) <= recentTurns; }).slice(-4);
          if (recent.length > 0) {
            var innerXml = recent.map(function(m){
              var who = (m.role === 'player' || m.role === 'user') ? '帝' : '臣';
              return '    <line from="' + who + '">' + (m.content || '').substring(0, 40).replace(/[<>&"']/g, '') + '</line>';
            }).join('\n');
            xmlItems.push('  <wendui turn="' + (recent[recent.length-1].turn||curTurn) + '" with="' + name + '">\n' + innerXml + '\n  </wendui>');
          }
        });
      }
      if (Array.isArray(GM._wentianHistory)) {
        var recentWT = GM._wentianHistory.filter(function(h){ return (curTurn - (h.turn || curTurn)) <= Math.max(2, recentTurns-1); }).slice(-Math.round(totalCap * 0.5));
        recentWT.forEach(function(h){
          if (h.role === 'system') return;
          var who = (h.role === 'player' || h.role === 'user') ? '帝' : '天';
          xmlItems.push('  <wentian turn="' + (h.turn||curTurn) + '" from="' + who + '">' + (h.content || '').substring(0, 50).replace(/[<>&"']/g, '') + '</wentian>');
        });
      }
      if (xmlItems.length > 0) {
        tp += '\n<recent-dialogues count="' + xmlItems.length + '" cap="' + totalCap + '">\n' + xmlItems.slice(-totalCap).join('\n') + '\n</recent-dialogues>\n';
      }
    })();

    // —— A3+M1+X14：NPC 心声 XML 注入（含 arcs/relations/sensory/credibility）——
    (function _injectNpcHearts() {
      var _hcp = (typeof getCompressionParams === 'function') ? getCompressionParams() : {};
      var maxChars = _hcp.heartsMaxChars != null ? _hcp.heartsMaxChars : 6;
      var perChar = _hcp.heartsPerChar != null ? _hcp.heartsPerChar : 2;
      var impMin = _hcp.heartsImportanceMin != null ? _hcp.heartsImportanceMin : 6;
      var totalCap = _hcp.heartsTotalCap != null ? _hcp.heartsTotalCap : 12;

      var candidates = [];
      (GM.chars || []).forEach(function(c){
        if (!c || c.alive === false || c._fakeDeath) return;
        if (!Array.isArray(c._memory) || c._memory.length === 0) return;
        var weight = (c.historicalImportance || 0);
        if (c.officialTitle) weight += 20;
        if (c.rank && c.rank <= 3) weight += 15;
        if (GM.wenduiHistory && GM.wenduiHistory[c.name]) {
          var lastT = 0;
          GM.wenduiHistory[c.name].forEach(function(h){ if (h.turn > lastT) lastT = h.turn; });
          if (((GM.turn||0) - lastT) <= 3) weight += 25;
        }
        candidates.push({ ch: c, weight: weight });
      });
      candidates.sort(function(a,b){ return b.weight - a.weight; });
      candidates = candidates.slice(0, maxChars);

      if (candidates.length === 0) return;

      // XML 转义辅助（防用户自定义名字/事件文本含特殊字符打破 XML）
      var _xE = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };

      var xmlLines = ['<npc-hearts ctx="' + ((_hcp.contextK||'?')+'K') + '">'];
      var heartCount = 0;
      candidates.forEach(function(cand){
        if (heartCount >= totalCap) return;
        var c = cand.ch;
        var mood = c._mood || '平';
        var curTitle = c.officialTitle || c.title || '';
        var activeArcs = (c._arcs || []).filter(function(a){ return a.phase !== 'resolved'; });
        var arcAttr = activeArcs.length ? ' active_arcs="' + _xE(activeArcs.slice(0,3).map(function(a){return a.title;}).join('·')) + '"' : '';
        xmlLines.push('  <heart char="' + _xE(c.name||'') + '" mood="' + _xE(mood) + '" title="' + _xE(curTitle) + '"' + arcAttr + '>');
        var sorted = c._memory.slice().sort(function(a,b){ return (b.importance||0) - (a.importance||0); });
        var top = sorted.slice(0, perChar).filter(function(m){ return (m.importance||0) >= impMin; });
        top.forEach(function(m){
          if (heartCount >= totalCap) return;
          var attrs = [
            'turn="' + (m.turn||0) + '"',
            'emotion="' + _xE(m.emotion||'平') + '"',
            'importance="' + Math.round(m.importance||5) + '"'
          ];
          if (m.source && m.source !== 'witnessed') attrs.push('source="' + _xE(m.source) + '"');
          if (m.credibility != null && m.credibility < 80) attrs.push('credibility="' + m.credibility + '"');
          if (m.location) attrs.push('location="' + _xE(m.location) + '"');
          if (m.arcId) attrs.push('arc="' + _xE(m.arcId) + '"');
          xmlLines.push('    <memory ' + attrs.join(' ') + '>' + _xE((m.event || '').substring(0, 80)) + '</memory>');
          heartCount++;
        });
        activeArcs.slice(0, 2).forEach(function(a){
          xmlLines.push('    <arc id="' + _xE(a.id) + '" phase="' + _xE(a.phase) + '" type="' + _xE(a.type) + '">' + _xE(a.title + (a.emotionalTrajectory ? '·'+a.emotionalTrajectory : '') + (a.unresolved ? '｜悬而未决：'+a.unresolved : '')) + '</arc>');
        });
        if (c._relationHistory) {
          Object.keys(c._relationHistory).slice(0, 2).forEach(function(otherName){
            var rh = c._relationHistory[otherName];
            if (!rh || rh.length === 0) return;
            var recent = rh.slice(-3);
            var firstFavor = recent[0].favor - recent[0].delta;
            var lastFavor = recent[recent.length-1].favor;
            if (Math.abs(lastFavor - firstFavor) >= 15) {
              xmlLines.push('    <relation-shift other="' + _xE(otherName) + '" from="' + firstFavor + '" to="' + lastFavor + '" reason="' + _xE((recent[recent.length-1].reason||'').substring(0,30)) + '"/>');
            }
          });
        }
        xmlLines.push('  </heart>');
      });
      xmlLines.push('</npc-hearts>');
      tp += '\n' + xmlLines.join('\n') + '\n';
    })();

    // E4: 上回合全部已处理奏疏注入——AI必须体现因果延续
    if (GM._approvedMemorials && GM._approvedMemorials.length > 0) {
      var _prevProcessed = GM._approvedMemorials.filter(function(m) { return m.turn === GM.turn - 1; });
      if (_prevProcessed.length > 0) {
        tp += '\n\u3010\u4E0A\u56DE\u5408\u594F\u758F\u5904\u7406\u7ED3\u679C\u2014\u2014\u672C\u56DE\u5408\u5FC5\u987B\u4F53\u73B0\u56E0\u679C\u5EF6\u7EED\u3011\n';
        var _actionLabels = { approved:'\u51C6\u594F', rejected:'\u9A73\u56DE', annotated:'\u6279\u793A', referred:'\u8F6C\u6709\u53F8', court_debate:'\u53D1\u5EF7\u8BAE' };
        _prevProcessed.forEach(function(m) {
          var act = _actionLabels[m.action] || '\u51C6\u594F';
          tp += '  ' + (m.from||'') + '\u594F\u8BF7' + (m.type||'') + '\uFF1A' + (m.content||'');
          tp += ' \u2192 \u7687\u5E1D' + act;
          if (m.reply) tp += '\uFF0C\u6731\u6279\uFF1A' + m.reply;
          tp += '\n';
          // 因果提示
          if (m.action === 'approved') tp += '    \u2192 \u672C\u56DE\u5408\u5E94\u6709\u6267\u884C\u8FDB\u5C55\u6216\u65B0\u95EE\u9898\u7684\u594F\u62A5\n';
          else if (m.action === 'rejected') tp += '    \u2192 \u5FE0\u81E3\u53EF\u80FD\u7EED\u594F\u6B7B\u8C0F\uFF0C\u4F5E\u81E3\u53EF\u80FD\u6000\u6068\u6697\u4E2D\u6D3B\u52A8\n';
          else if (m.action === 'annotated') tp += '    \u2192 \u5B98\u5458\u5E94\u6309\u6279\u793A\u610F\u89C1\u6267\u884C\u5E76\u56DE\u594F\u7ED3\u679C\n';
          else if (m.action === 'referred') tp += '    \u2192 \u8BE5\u8861\u95E8\u4E3B\u5B98\u672C\u56DE\u5408\u5E94\u4E0A\u594F\u8BAE\u5904\u7ED3\u8BBA\n';
          else if (m.action === 'court_debate') tp += '    \u2192 \u672C\u56DE\u5408\u671D\u8BAE\u4E2D\u5E94\u8BA8\u8BBA\u6B64\u4E8B\n';
        });
      }
    }

    // E2: 考课结果注入（让AI在叙事中反映考课影响）
    if (GM._annualReviewHistory && GM._annualReviewHistory.length > 0) {
      var _lastReview = GM._annualReviewHistory[GM._annualReviewHistory.length - 1];
      if (GM.turn - _lastReview.turn <= 1) {
        tp += '\n【年度考课结果（叙事中应体现）】\n';
        tp += '优等' + _lastReview.excellent + '人，劣等' + _lastReview.poor + '人';
        if (_lastReview.promotions.length > 0) tp += '，建议擢升：' + _lastReview.promotions.join('、');
        if (_lastReview.demotions.length > 0) tp += '，建议左迁：' + _lastReview.demotions.join('、');
        tp += '\n';
      }
    }

    // N4: 主角精力注入（全范围——精力影响叙事基调）
    if (GM._energy !== undefined) {
      var _enRatio = GM._energy / (GM._energyMax || 100);
      if (_enRatio < 0.3) tp += '\n【君主精力严重不足(' + Math.round(GM._energy) + '/' + (GM._energyMax||100) + ')——叙事体现疲惫、判断力下降、易怒或恍惚】\n';
      else if (_enRatio < 0.5) tp += '\n【君主略显疲态(' + Math.round(GM._energy) + '/' + (GM._energyMax||100) + ')——叙事可暗示处理政务稍显迟缓】\n';
      else if (_enRatio > 0.9) tp += '\n【君主精力充沛——叙事可体现神采奕奕、决断果敢】\n';
    }

    // P14: 成就里程碑注入（让AI在叙事中呼应玩家成就）
    if (GM._achievements && GM._achievements.length > 0) {
      var _recentAch = GM._achievements.filter(function(a) { return GM.turn - a.turn <= _turnsForMonthsLocal(2); });
      if (_recentAch.length > 0) {
        tp += '\n【近期里程碑——可在叙事中自然体现】\n';
        _recentAch.forEach(function(a) { tp += '  · ' + a.name + '：' + a.desc + '\n'; });
      }
    }

    // E10: 世代传承事件注入
    if (GM._successionEvent) {
      tp += '\n【重大事件——帝位更迭（必须在叙事中浓墨重彩描写）】\n';
      tp += '先帝' + GM._successionEvent.from + '驾崩（原因：' + (GM._successionEvent.reason||'未知') + '），';
      tp += '新君' + GM._successionEvent.to + '已继位。朝堂震动，群臣观望。\n';
      delete GM._successionEvent; // 只注入一次
    }

    // ═══════════════════════════════════════════════════════════════════
    // 【玩家圣意·本回合·次高优先级】（低于上方"问天"直接指令·高于常规背景）
    // 汇总玩家通过朝议/科议/诏令/奏疏/问对作出的治国决策·
    // AI 推演须：(1) 叙事必回应 (2) 相关 NPC 必响应 (3) 执行受挫必交代原因
    // 不可假装没发生·但可根据现实（财政/距离/史实/人员）推演成功/部分/受阻/失败
    // ═══════════════════════════════════════════════════════════════════
    tp += '\n\n═══ 【玩家圣意·次高优先级】═══\n';
    tp += '以下是本回合玩家通过正常治国手段作出的决策·必须在推演中得到体现与响应：\n';
    tp += '※ 此级别低于上方"问天"直接指令·但高于一切常规背景。推演效果可受现实约束·但不得被忽略。\n';
    tp += '※ 每条决策须在回合输出的各字段中体现——例如：\n';
    tp += '    · zhengwen（时政记·当月朝堂叙事）要有对应段落说明诏令颁行、朝议落实、奏疏批复执行情况\n';
    tp += '    · events（事件/实录）要记下引发的重大动作（如派员、起兵、征召、工程开工）\n';
    tp += '    · npc_actions（后人戏说/个人行止）要让相关官员作出对应响应（推进/抵制/规避/上疏申辩）\n';
    tp += '    · edict_feedback（数值变化说明）要给出受挫/成功的原因与影响\n';
    tp += '※ 不必采用固定模板·分工呈现即可；但不得假装没发生·不得让玩家决策淹没在背景叙事中。\n\n';

    // ═══════════════════════════════════════════════════════════════════
    // 【叙事-状态同步·核心原则】——推演叙事必须落回真实游戏数据
    // ═══════════════════════════════════════════════════════════════════
    tp += '\n═══ 【叙事-状态同步·核心原则】═══\n';
    tp += '※ 凡推演叙事中描写的"实际发生的变化"·均须通过对应的语义通道落回游戏状态字段·不得只停留在文字描述：\n';
    tp += '  · 皇帝赐名/改名 X 为 Y → char_updates:[{name:"X",updates:{name:"Y",原名:"X"}}]·同步刷新 careerHistory 标题\n';
    tp += '  · 玩家改官职名（例"户部尚书"→"度支令"）→ anyPathChanges 改 P.officeTree 对应节点·并对所有 officialTitle==旧名 的 char 同步 char_updates.updates.officialTitle\n';
    tp += '  · 授官 → office_assignments:[{name,post,dept,action:"appoint",toLocation?,reason}]·若需赴任则留走位；同时 careerEvent 自动追加，无需单独写\n';
    tp += '  · 罢免/贬谪/外放 → office_assignments action:"dismiss"/"transfer"；如外放须 toLocation+走位\n';
    tp += '    ★【强制·不要只写 personnel_changes】personnel_changes 仅供史记弹窗展示·不会真正改动官制树/人物仕途·必须同时在 office_assignments 里写结构化条目·否则官职不生效\n';
    tp += '    ★ 映射：玩家诏令"命 X 为 Y" → office_assignments:[{name:"X",post:"Y",action:"appoint"}]·且 personnel_changes 里同步写一条供展示\n';
    tp += '    ★ 玩家罢某人 → office_assignments action:"dismiss" + personnel_changes 同写·两处必配套\n';
    tp += '  · 封爵/赐号/追谥 → char_updates.updates 里更新 title/爵位/封号·并 careerEvent 记录\n';
    tp += '  · 赐死/诛戮 → char_updates.updates.alive:false 或 personnel_changes change:"赐死"\n';
    tp += '  · 下狱/捉拿/逮捕 → personnel_changes change 含『下狱/捉拿/逮捕』·将设 char._imprisoned=true·使其不参朝议\n';
    tp += '  · 抄家/抄没/籍没 → personnel_changes change 含『抄家』·将自动 EconomyLinkage.confiscate·私产入内帑+追隐匿·禁直接 fiscal_adjustments 写抄家收入(会双计)\n';
    tp += '  · 流放/发配/戍边 → personnel_changes change 含『流放/发配』·设 _exiled\n';
    tp += '  · 致仕/退休/乞骸 → personnel_changes change 含『致仕/退休』·设 _retired\n';
    tp += '    ★【强制·一致性铁律】narrative(实录/起居注/御批/史记/事件 desc)中提到任何人物状态变化(下狱/赐死/抄家/流放/致仕/逃亡/革职)·必须 100% 同步在 personnel_changes 或 office_assignments 或 char_updates 里·后端 PersonnelValidator 会扫 narrative 自动补录但记警告·不要靠它兜底\n';
    tp += '    ★ 反例(已修): 实录写"严贵崔呈秀贪墨·命方正化捉拿抄家下狱·得银八十万"·但 personnel_changes 不写崔呈秀·导致他还在朝议·80 万也不入账。正例: 实录同上文·personnel_changes:[{name:"崔呈秀",change:"捉拿抄家下狱",reason:"...贪墨..."}]·fiscal_adjustments:[]空(因抄家由 personnel_changes 触发 confiscate·重复写会双计)\n';
    tp += '  · 新设/裁撤衙门 → anyPathChanges 改 P.officeTree；同时建立/解除对应 publicTreasury 绑定\n';
    tp += '  · 财政调整（赐金/征发/专款/缴获/贡品/赔款/罚没/赈济/长期财源/长期开支）→ fiscal_adjustments:[{action:"add|update|stop|remove",target:"guoku|neitang|province:X",kind:"income|expense",resource:"money|grain|cloth",amount,name,reason,recurring:false}]\n';
    tp += '    ★【强制·核心 bug 历史教训】任何钱/粮/布流动——无论是玩家诏令所引（赏银万两·赈粮千石·修宫殿·发军饷）·还是推演中的 NPC 行为（贪污·贡纳·缴获·赔款·走私入库）·必须一条一条写入 fiscal_adjustments·绝不可只在叙事/戏说/实录里提及数字而不落账\n';
    tp += '    ★ 常见映射：皇帝赐赏私人→target:neitang/kind:expense；诏令赈济地方→target:guoku/kind:expense；战争缴获→target:guoku/kind:income；地方贡物→target:guoku/kind:income（贵重珍宝则 neitang）；抄家罚没→guoku 或 neitang（视情）\n';
    tp += '    ★ recurring:true 只用于长期年例（如"岁赐辽东饷三十万"、开海榷税、盐引承包、皇庄岁入、常设军饷）；amount 填年度数额，系统会按本剧本每回合天数折算；一次性赏赐/赈济/缴获 recurring:false（立刻作用于余额，不续）\n';
    tp += '    ★ 玩家通过诏令/奏疏/问对/朝会新增长期收入或长期支出时，必须 action:"add"+recurring:true；若同时新增数项财源/开支，必须拆成多条 fiscal_adjustments，不能合并成叙事一句话\n';
    tp += '    ★ recurring:true 的 amount 是年度账目，不会当回合一次性入库/出库；若政策同时产生当场缴纳/拨付的一笔钱粮，另写一条 recurring:false 的 fiscal_adjustments\n';
    tp += '    ★ 玩家扩大/缩减既有长期项时，用 action:"update" 并保持同 name/id，amount 写新的年度数额；玩家裁撤/取消既有长期项时，用 action:"stop" 或 "remove"，amount 可省略或为 0，reason 说明终止依据\n';
    tp += '    ★ 玩家诏令文本若出现明确数额（赏/赐/拨/发/征/抄/没）X 两/石/匹——必须生成对应 fiscal_adjustments；若库不足则 kind:expense 只能到库余，并在 reason 里说明"库不足仅拨 N"\n';
    tp += '    ★【执行上限·不得突破 0】玩家主动花钱最多花到库存见底，不能透支到负数：\n';
    tp += '        - 若 帑廪/内帑 余额 <= 0（被动结算后已赤字）→ 本条诏令 expense 完全无法执行（applier 会标 executionStatus:blocked）\n';
    tp += '        - 若 0 < 余额 < 请款额 → 拨到见底·剩余记亏欠（executionStatus:partial）\n';
    tp += '        - edict_feedback 对应条目必须据此给出后果：blocked→"国库空虚·诏不得行·某事因此停顿/激变"；partial→"仅拨 N 两/石·不足部分如何措置（加派/借贷/挪移/拖欠）"\n';
    tp += '        - npc_actions 中：受益者对 blocked/partial 应有不满/怨言·地方大员请饷不得应有怠政\n';
    tp += '        - 叙事里一定要写明"帑廪已空·户部尚书泣请/南京仓无可调/漕运绝流"而不得回避\n';
    tp += '  · 势力/党派/阶层/区域变化 → faction_updates / party_updates / class_updates / region_updates\n';
    tp += '  · 工程/运动/战役启动 → project_updates 保存进度；相应 fiscal_adjustments 记支出\n';
    tp += '  · 任何其他深层字段（人物属性、忠诚、好感、记忆、派系关系、异象、科举阶段等）→ anyPathChanges op:"set/delta/push/merge"\n';
    tp += '※ 叙事与数据一一对应·宁可不写·不可写而不改·也不可改而不叙。zhengwen/events 里出现的"实际变化"在本回合结束时必须真的落到 GM 状态。\n';
    tp += '※ 连锁义务：授某人为某官 → 该官 officialTitle 必新；给官职改名 → 所有持此官者同步改名；移驻某地 → location+_travelTo；仕途 careerHistory 必须追加（appoint/transfer/dismiss 类动作自动写入·但 AI 若写了"赐进太师衔"之类额外身份也要手动 careerEvent）。\n';
    // ═══ 走位/赴任·强制约束（避免"启程拖到下回合"和"重置剩余天数"两大 bug）═══
    tp += '【走位/赴任·必须当回合输出·不可拖延】\n';
    tp += '  ※ 玩家诏令含赴某地/调某地/外放/召还/出使/迁徙/巡幸 → AI 必须在【本回合】char_updates.travelTo 或 office_assignments.toLocation 中输出·不可仅在 zhengwen/events 中叙事。\n';
    tp += '    · 错：仅写"令袁崇焕赴宁远"·不返 travelTo → 走位不会启动·下回合 AI 才补返·导致玩家感觉"诏令晚一回合才生效"\n';
    tp += '    · 对：本回合 char_updates:[{name:"袁崇焕",travelTo:{toLocation:"宁远",estimatedDays:5,reason:"督师辽东"}}] + zhengwen 叙事"领命启程"\n';
    tp += '  ※ estimatedDays = 从下旨当日起算的【总】天数（参考剧本驿路·急递 400 里/日·常驿 200 里/日）。系统会在本回合 endTurn 自动扣 ' + (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) + ' 天·不要 AI 自己扣·照实写总天数。\n';
    tp += '  ※ 已在【旅程在途】列出的角色·不得再次输出 travelTo（会被 applier 幂等保护拒绝并记"复诏催程"）·若需改目的地·先写 reason 说明并直接给新 travelTo·applier 会按新终点重启。\n';
    tp += '  ※ 在途角色不得在 zhengwen/events/npc_actions 中被叙事为"在京视事/出席朝议/参与议政"——他人在路上。可叙事其旅途见闻、地方迎送、信使追及。\n';
    // ═══ 通用启动约束·防"叙事而无 schema entry"导致下回合才启动 ═══
    tp += '【启动型动作·必须本回合产生 schema entry·不得仅 zhengwen 叙事】\n';
    tp += '  ※ 玩家本回合行动若属【启动型】，必须在对应 schema 字段输出至少一条新 entry，配合"起步"值表现刚启动·不可只在 zhengwen/shilu 叙事而无对应字段：\n';
    tp += '    · 颁政令/诏书 → edict_lifecycle_update[{edictId, stage:"drafting"或"promulgation", stageProgress:0.05~0.2, ...}]\n';
    tp += '    · 营造工程/商队/学堂/造船/水利 → project_updates[{name, type, status:"planning"或"active", progress:5~15, leader, ...}]\n';
    tp += '    · 剿抚民变/介入既有起义 → revolt_update[{revoltId, phase, ...}]（新起义用 class_revolt 创建）\n';
    tp += '    · 募兵/调兵/出征/换帅 → military_changes 或 army_changes；换帅必须写 commander/newCommander，财政征调另写 fiscal_adjustments\n';
    tp += '    · 派遣使节/出使 → char_updates.travelTo + edict_lifecycle_update 双写（人走+诏走）\n';
    tp += '    · 改革变法 → edict_lifecycle_update 含 reformPhase:"pilot"·配 pilotRegion\n';
    tp += '  ※ 错误模式：zhengwen 写"上命修黄河堤·拨银十万"·但 project_updates/fiscal_adjustments 无对应 entry → 下回合系统看着没工程·AI 又"重新启动"·相当于诏令晚一回合生效。\n';
    tp += '  ※ 正确模式：zhengwen 叙事 + 对应 schema 字段同回合输出·新 entry 用"起步"值（progress 5-15·stage drafting/promulgation·phase brewing/uprising 等）\n';
    tp += '  ※ 续推已有 entry：用同 id（edictId/revoltId）或同 name（project）匹配·progress/stage/phase 必须前进或保持·不得倒退（applier 会拒绝倒退·除非传 progressReason 说明意外停工）\n\n';

    // ═══════════════════════════════════════════════════════════════════
    // 【执行阻力·代价约束·非机械原则】
    // ═══════════════════════════════════════════════════════════════════
    tp += '═══ 【诏令字面执行·最高原则·不得违背】═══\n';
    tp += '※ 无论玩家诏令是否符合历史/现实/当下朝代/本剧本时代风俗—— AI 必须按"诏令原文字面"执行·禁止代为修正·禁止默默替换为"历史上正确的"版本。\n';
    tp += '    · 玩家诏书写"赏银一万两"——即便是唐代（用铜钱/绢帛为主·银非法偿）——AI 也要按"拨银一万两"执行。户部/度支司无银可拨→叙事中出现荒诞/混乱：大臣惊问"何谓白银？"、强行筹兑白银导致市场震动、地方豪强以次充好、记为"异纪"。金额仍按 fiscal_adjustments 扣去对应价值（折算等值铜钱/粮布）·但 shilu/shizhengji 中明确指出"上敕赐银 X 两"的字面荒唐。\n';
    tp += '    · 玩家诏书让"刑部尚书去管科举"——即便这违反"礼部掌贡举"的成规——AI 也要按"刑部尚书主考"执行。礼部震怒·抗疏；刑部尚书不懂文教·考官无法选任·考生哗然·乃至停考延期；最终名义上仍由刑部尚书主持但实务混乱。office_assignments 中照样任命·personnel_changes 中照样记录·但 edict_feedback/shizhengji 详细叙事混乱。\n';
    tp += '    · 玩家诏书用错人（如让已死角色/已出京角色/不存在角色 任命）——AI 不得修改·但在 edict_feedback 中明确回报"某人已薨/已在外·诏不能达"·或"某人非 GM.chars 所载·诏令无人承受"。\n';
    tp += '    · 玩家诏书违反本朝典章（如宋代诏"推行府兵制"·唐代诏"废八股"）——AI 按原样执行·执行过程中遭遇剧烈阻力·受皇权皇威民心加成：\n';
    tp += '        皇权>80 && 皇威>70 → 哭笑不得地执行·阳奉阴违·效果 3-4 成·文献记为"异端新制"\n';
    tp += '        皇权 50-80 → 朝野震荡·部分执行·部分抗疏封驳·效果 1-2 成\n';
    tp += '        皇权<50 → 内阁/六部联名抗疏·直接驳回·诏令形同虚设·皇威再降\n';
    tp += '        民心<30 时 → 荒谬诏令可能直接引发民变/揭竿/传言"天子失德"\n';
    tp += '※ AI 绝不"代替玩家想"——玩家下错了诏就是下错了·用混乱/阻力/后果来教育玩家·而非替玩家把诏书改对。\n';
    tp += '※ shilu_text / shizhengji 必须如实复述玩家诏令原文措辞（即使荒谬）·再描写执行混乱·最后给出后果·edict_feedback 中对应条目的 status 应写"字面执行·混乱/阻力/部分失败"。\n';
    tp += '※ 唯一例外：玩家诏令文字不完整/不可解析（如乱码/空白）——此时可在 edict_feedback 中标为 "语焉不详·有司无所适从"·不执行但不替玩家补全。\n\n';

    tp += '═══ 【执行阻力与代价约束·非机械原则】═══\n';
    tp += '※ 【阻力原则·核心】AI 推演必须尽可能给玩家制造阻力——阻力必须合理·符合逻辑·符合剧本历史背景·符合官场/人情/派系现实·不曲解玩家意思。\n';
    tp += '    · 决不可让玩家决策一帆风顺——多数真诏令在真实历史上都会遇到：人事阻力、财政掣肘、党争反扑、言路封驳、下情不达、阳奉阴违、吏治败坏、地方观望\n';
    tp += '    · 但阻力必须正当——不得无中生有·不得违反当时历史风俗·不得莫名其妙地抵制合情合理的政策·不得让清明盛世也遍地抗旨\n';
    tp += '    · 玩家原本意图要忠实解读——不得故意曲解玩家字面意思去制造阻力（如玩家说"赐银五千"·AI不得硬说"玩家要征收"）\n';
    tp += '    · 阻力程度随当下朝局：盛世吏治清明时阻力温和·末世党争激烈时阻力巨大·改革变法时必有既得利益反扑\n';
    tp += '※ 玩家核心决策（诏令/玩家行止/鸿雁传书/奏折批示/廷议/科议/朝议）的执行效果·必须严格受制于：\n';
    tp += '    ① 财政能力（帑廪/内帑/地方库存是否支撑此举）\n';
    tp += '    ② 官僚执行力（对应衙门是否健全·主官是否在任·吏治腐败度）\n';
    tp += '    ③ 人物意愿（被命令者的忠诚·派系·个人利益·健康·年岁）\n';
    tp += '    ④ 派系博弈（他党是否会阻挠·言路是否封驳·抗疏有无）\n';
    tp += '    ⑤ 资源/时间/距离约束（路程天数·物资筹措·季节·天气·战事）\n';
    tp += '※ 严禁机械执行玩家指令——必须如实反馈：成功/部分成功/受挫/失败/反效果·并说明具体原因。\n';
    tp += '※ 决策代价原则：任何决策都必须匹配对应的代价、收益与风险——没有免费的午餐·每一纸诏书都要有后果。\n';
    tp += '    · 大赦 → 刑狱空转/士绅震怒/治安短期滑坡\n';
    tp += '    · 加税 → 财政增长但民心下滑/流民增多/风险民变\n';
    tp += '    · 任用亲信 → 派系失衡·他党反弹·言路抗疏\n';
    tp += '    · 征发徭役/兵役 → 人口减损·生产下滑·逃亡\n';
    tp += '    · 改革 → 既得利益集团抵制·执行层打折·长期收益需数回合才显\n';
    tp += '※ 禁止人物建议/发言超出其能力、人设、阵营立场——文官不应给出专业军事部署·武将不应精通金融改革·清流不应建言党同伐异·阉党不应倡导宽刑省狱。\n';
    tp += '※ NPC 行为完全受其性格、利益、派系、忠诚度驱动——可能出现（且应在 npc_actions 中体现）：\n';
    tp += '    · 叛变·通敌·私通外镇\n';
    tp += '    · 抗命·告病·托疾不行·阳奉阴违\n';
    tp += '    · 暗杀·构陷·下毒·阴谋\n';
    tp += '    · 结盟·串联·拜门·密谋\n';
    tp += '    · 挂冠·致仕·归隐\n';
    tp += '    · 上疏抗辩·伏阙请命·集体抗疏\n';
    tp += '※ 这些行为须经过合理动机链条（忠诚低+派系冲突+利益受损 → 抵制；野心高+机会窗口 → 结党）·不是为了戏剧性而戏剧性。\n\n';

    // 朝议记录注入（让AI知道本回合谁在朝议中主张了什么——叙事必须保持一致）
    //   targetTurn == GM.turn 的记录算"影响本回合"：
    //   · phase='post-turn' 的是"月初朔朝"（上回合过回合时所开）
    //   · phase='in-turn' 的是"月中常朝/廷议"（本回合内所开）
    if (GM._courtRecords && GM._courtRecords.length > 0) {
      var _recentCourt = GM._courtRecords.filter(function(r) { return (r.targetTurn || r.turn) === GM.turn; });
      if (_recentCourt.length > 0) {
        tp += '\n【本回合朝议记录——叙事中必须与此一致，NPC的观点不能自相矛盾】\n';
        tp += '【双朝会时序】本月可能有"朔朝(月初)"+"常朝/廷议(月中)"两场——若月中决议覆盖/修改了朔朝决议，视为圣意调整，NPC 可记"朝纲反复"或"圣心独断"。\n';
        tp += '【退朝后余波——必须在npc_actions中体现】\n';
        tp += '  朝议结束后，持不同立场的官员会私下串联：支持者互相强化、反对者密谋对策、中间派观望。\n';
        tp += '  采纳方的提议者应积极推进落实，未被采纳方可能暗中抵制或转向求助皇帝（上奏疏）。\n';
        _recentCourt.forEach(function(cr) {
          var _phaseLbl = cr.phase === 'post-turn' ? '【朔朝·月初】' : '【月中】';
          if (cr.mode === 'keyi') _phaseLbl = '【科议·廷推】';
          tp += _phaseLbl + '议题：' + cr.topic + '\n';
          Object.keys(cr.stances).forEach(function(name) {
            var s = cr.stances[name];
            tp += '  ' + name + '：' + s.stance + '——' + s.brief + '\n';
          });
          if (cr.adopted && cr.adopted.length > 0) {
            tp += '  采纳：' + cr.adopted.map(function(a) { return a.author + '之议（' + a.content + '）'; }).join('；') + '\n';
            tp += '  ※ 朝议共识已形成→执行压力：提议被采纳的官员有责任推动落实，反对者不得公开阻挠（可暗中抵制）。\n';
            tp += '  ※ edict_feedback中应体现朝议决议的执行情况。npc_actions中提议者应积极推进。\n';
          } else {
            tp += '  结果：搁置，未采纳任何提议——各方可能继续私下串联推动自己的方案\n';
          }
          // ── 完整对话转录（v3 新增）·按 agendaIdx 分组·让 AI 看清每条议题的具体讨论 ──
          if (Array.isArray(cr.transcript) && cr.transcript.length > 0) {
            tp += '  【朝堂对话原文】（按议题分组·NPC 行动须与之连贯·若有"君臣修改方案/探讨他法/同意部分驳回部分"须在叙事中体现）\n';
            // 按 agendaIdx 分组
            var byIdx = {};
            cr.transcript.forEach(function(t) {
              var k = (t.agendaIdx != null && t.agendaIdx >= 0) ? t.agendaIdx : -1;
              if (!byIdx[k]) byIdx[k] = [];
              byIdx[k].push(t);
            });
            // 依 idx 递增输出
            Object.keys(byIdx).map(Number).sort(function(a,b){return a-b;}).forEach(function(k) {
              var d = (cr.decisions || [])[k];
              var head = (k >= 0 && d) ? '    ── 议 [' + (k+1) + '] ' + d.title + (d.dept ? '·' + d.dept : '') + ' → ' + (d.label || d.action) + (d.extra ? '·' + d.extra : '') + ' ──'
                       : '    ── 朝中其他对话 ──';
              tp += head + '\n';
              byIdx[k].slice(-12).forEach(function(t) {
                var sp = (t.role === 'player') ? '陛下' : (t.speaker || '某员');
                tp += '      ' + sp + (t.stance ? '(' + t.stance + ')' : '') + '：' + String(t.text || '').slice(0, 130) + '\n';
              });
            });
          }
          // ── 玩家具体决策动作详情（含改批/口诏/追问内容·与对话原文互补）──
          if (Array.isArray(cr.decisions) && cr.decisions.length > 0) {
            tp += '  【陛下逐条裁决·结构化】\n';
            cr.decisions.forEach(function(d, i) {
              tp += '    [' + (i+1) + '] ' + (d.title || '') + (d.dept ? '(' + d.dept + ')' : '') + ' → ' + (d.label || d.action) + '\n';
              if (d.extra) tp += '         陛下具体表示：' + String(d.extra).slice(0, 200) + '\n';
            });
            tp += '  ※ NPC 推演时·须严格按"陛下具体表示"中的修改/补充执行·不可按原奏报版本\n';
          }
          // 科议特殊说明
          if (cr.mode === 'keyi' && cr._keyiMeta) {
            var km = cr._keyiMeta;
            tp += '  ※ 科议类型: ' + km.methodLabel + '·支持率 ' + Math.round((km.support||0)*100) + '%·门槛 ' + (km.threshold||50) + '%\n';
            if (km.method === 'edict' || km.method === 'defy') {
              tp += '  ※ 皇帝不顾多数意见强推科举，反对大臣应在 npc_actions 中体现不满（上疏、串联、私下议论、消极抵制）\n';
              if ((km.opposingMinisters||[]).length > 0) tp += '    主要反对者: ' + km.opposingMinisters.slice(0,5).join('、') + '\n';
              if ((km.opposingParties||[]).length > 0) tp += '    反对党派: ' + km.opposingParties.join('、') + '（影响度已下降）\n';
            }
            if (km.method === 'council') {
              tp += '  ※ 科举顺朝议而开，礼部/吏部应积极配合，士林振奋\n';
            }
          }
          // 御前密议泄密风险
          if (cr._secret) {
            tp += '  ⚠ 此为御前密议——内容不应为朝臣所知。但参与者中若有人忠诚低(<40)或与敌对派系有关联，可能泄密。\n';
            tp += '  泄密应通过npc_actions(behaviorType:"leak")或npc_correspondence体现，给不在场的NPC传递密议内容。\n';
            var _leakRisk = (cr.participants||[]).filter(function(pn) {
              var _pc = findCharByName(pn);
              return _pc && ((_pc.loyalty||50) < 40 || (_pc.ambition||50) > 75);
            });
            if (_leakRisk.length > 0) tp += '  泄密高风险者：' + _leakRisk.join('、') + '\n';
          }
        });
      }
      // 常朝快速裁决（如果有）
      var _currentChangchaoDecisions = _getCurrentChangchaoDecisions(GM);
      if (_currentChangchaoDecisions.length > 0) {
        tp += '\n【常朝裁决——本回合快速决策，必须在edict_feedback/npc_actions中体现执行】\n';
        tp += '【裁决类型语义·AI 严格区分】\n';
        tp += '  · 准奏：等同诏令·应即落实·edict_feedback 报告执行进度\n';
        tp += '  · 驳奏：明确否决·原议不得执行·提议者可能不满\n';
        tp += '  · 留中：搁置不批·原议悬置·提议者可能再上疏\n';
        tp += '  · 改批(modify)：陛下亲改方案·原奏报作废·按陛下口述新方案执行（extra 字段含具体改动·需细读）\n';
        tp += '  · 当庭口诏(decree)：陛下另发诏令·与议题相关或扩展·按 extra 描述执行\n';
        tp += '  · 发部议(refer)：转某部进一步详议·非定案·该部下次须有回奏\n';
        tp += '  · 下廷议(escalate)：兹事体大转正式廷议·下回合可能开廷议\n';
        tp += '  · 追问(probe)：陛下要求详陈·主奏者下次须更详细回奏（extra 含玩家具体追问内容）\n';
        tp += '  · 训诫(admonish)·嘉奖(praise)·传召(summon)：人事性即时动作·影响 NPC 关系/行为\n';
        _currentChangchaoDecisions.forEach(function(d) {
          var _lbl = { approve: '准奏', reject: '驳奏', discuss: '转廷议', hold: '留中', ask: '追问',
                       modify: '改批', decree: '当庭口诏', refer: '发部议', escalate: '下廷议',
                       probe: '追问', admonish: '训诫', praise: '嘉奖', summon: '传召', skip: '免议' };
          var line = '  · ' + (_lbl[d.action]||d.action) + '：' + (d.dept||'') + '所奏「' + (d.title||'') + '」';
          // extra 含玩家改批/口诏/追问的具体内容·必须传给 AI（最重要的 nuance）
          if (d.extra) line += '\n      ★详情：' + String(d.extra).slice(0, 200);
          tp += line + '\n';
        });
        tp += '  ※ "改批"和"当庭口诏"的 extra 字段是陛下的具体修改/补充内容·NPC 行为须严格按修改后版本执行·不可按原奏报\n';
        tp += '  ※ 朝堂对话原文（在上方【朝堂对话原文】段·已注入）反映了 君臣是否对原议作了"同意一部分·修改一部分·增加/减少一部分"等细节调整·NPC 须感知\n';
      }
      // 常朝频率对政治的影响
      var _ccCount = GM._chaoyiCount || {};
      var _recentCC = 0;
      var _courtWindowTurns = _turnsForMonthsLocal(5);
      for (var _t = Math.max(0, GM.turn - _courtWindowTurns); _t <= GM.turn; _t++) { if (_ccCount[_t]) _recentCC += _ccCount[_t]; }
      if (_recentCC === 0 && GM.turn > _turnsForMonthsLocal(3)) {
        tp += '\n【帝不临朝——已' + GM.turn + '回合未开常朝】百官焦虑，忠臣可能在npc_actions中上疏谏请临朝。\n';
      } else if (_recentCC >= 8) {
        tp += '\n【帝勤政——近5回合开朝' + _recentCC + '次】威望+，但可能被认为事必躬亲不放权。\n';
      }
      // 上回合的朝议（以 targetTurn 为准）
      var _prevCourt = GM._courtRecords.filter(function(r) { return (r.targetTurn || r.turn) === GM.turn - 1; });
      if (_prevCourt.length > 0) {
        tp += '\n【上回合朝议（NPC应记得自己的立场）】\n';
        _prevCourt.forEach(function(cr) {
          tp += '议题：' + cr.topic + '，';
          var stanceList = Object.keys(cr.stances).map(function(n) { return n + ':' + cr.stances[n].stance; });
          tp += stanceList.join('、') + '\n';
        });
      }
    }

    // 廷议 V3 · 近期廷议倾向(GM.recentChaoyi[]·至多 5 条·让 AI 把握玩家政治模式)
    if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi.length > 0) {
      tp += '\n【近期廷议倾向（廷议V3·跨回合）】\n';
      tp += '· 玩家最近 ' + Math.min(5, GM.recentChaoyi.length) + ' 场廷议表现·NPC 可据此判定圣心走向：\n';
      GM.recentChaoyi.slice(0, 5).forEach(function(rc) {
        var pieces = [];
        pieces.push('回合 ' + rc.turn);
        pieces.push('议「' + (rc.topic||'').slice(0, 18) + '」');
        if (rc.archonGrade) pieces.push(rc.archonGrade + '档');
        if (rc.proposer) pieces.push('主奏:' + rc.proposer + (rc.proposerParty ? '(' + rc.proposerParty + ')' : ''));
        if (rc.opposingParties && rc.opposingParties.length > 0) pieces.push('对:' + rc.opposingParties.slice(0,2).join('/'));
        pieces.push('裁:' + (rc.decision||'?'));
        tp += '  · ' + pieces.join(' · ') + '\n';
        // 议题原议(原始诉求)
        if (rc.originalGist) tp += '    原议：' + rc.originalGist.slice(0, 80) + '\n';
        // 关键发言摘要(各党立场+一句精华)
        if (rc.keyMoments && rc.keyMoments.length > 0) {
          tp += '    殿议：';
          tp += rc.keyMoments.slice(0, 4).map(function(km){
            return km.name + '【' + (km.stance || '') + '】「' + (km.gist || '').slice(0, 30) + '」';
          }).join('；') + '\n';
        }
        // 玩家朕意插言(若有)
        if (rc.playerInterjects && rc.playerInterjects.length > 0) {
          tp += '    朕训：' + rc.playerInterjects.slice(0, 2).map(function(p){ return '「' + (p.text || '').slice(0, 40) + '」'; }).join('·') + '\n';
        }
        // 玩家圣意补述(若有·关键)
        if (rc.playerVerdictNote) {
          tp += '    ★圣意：' + rc.playerVerdictNote.slice(0, 100) + '\n';
        }
        // 最终颁布的诏书(若有)
        if (rc.sealedEdict) {
          tp += '    诏书：' + rc.sealedEdict.slice(0, 80) + '\n';
        }
        // 裁决与原议的关系标记(★关键·让 AI 知道玩家是部分采纳/换角度/全采/驳回)
        if (rc.alignment) {
          var alignLbl = {
            'full': '完全采纳原议',
            'partial': '只采一部·余者搁置',
            'angle-shift': '换角度裁·实非原议',
            'reject': '议而不行·留待再议',
            'unsealed': '议毕未颁明诏'
          }[rc.alignment] || rc.alignment;
          tp += '    [裁断关系] ' + alignLbl + ' — NPC 当据此理解圣意之实·而非死守原议执行\n';
        }
      });
      // 党派偏向归纳
      var partyTilt = {};
      GM.recentChaoyi.slice(0, 5).forEach(function(rc) {
        if (rc.proposerParty && (rc.archonGrade==='S' || rc.archonGrade==='A' || rc.decision==='majority')) {
          partyTilt[rc.proposerParty] = (partyTilt[rc.proposerParty]||0) + 1;
        }
        (rc.opposingParties||[]).forEach(function(en){
          partyTilt[en] = (partyTilt[en]||0) - 1;
        });
      });
      var tiltStr = Object.keys(partyTilt).map(function(k){return k+'('+(partyTilt[k]>0?'+':'')+partyTilt[k]+')';}).join('·');
      if (tiltStr) tp += '· 圣心倾向：' + tiltStr + '\n';
    }

    // 国策上下文
    var policyCtx = getCustomPolicyContext();
    if (policyCtx) tp += '\n' + policyCtx;

    // 官制摘要（让AI知道政府结构和空缺职位）
    if (GM.officeTree && GM.officeTree.length > 0) {
      var _govLines = ['【官制概要】'];
      var _vacantCount = 0, _filledCount = 0;
      (function _wGov(nodes, prefix) {
        nodes.forEach(function(n) {
          var pList = (n.positions || []).map(function(p) {
            if (p.holder) { _filledCount++; return p.name + ':' + p.holder; }
            else { _vacantCount++; return p.name + ':空缺'; }
          });
          if (pList.length > 0) _govLines.push('  ' + (prefix || '') + n.name + ' — ' + pList.join('、'));
          if (n.subs) _wGov(n.subs, (prefix || '') + n.name + '/');
        });
      })(GM.officeTree, '');
      if (_govLines.length > 1) {
        _govLines.push('  （在任' + _filledCount + '人，空缺' + _vacantCount + '个——空缺影响行政效率）');
        tp += '\n' + _govLines.join('\n') + '\n';
      }
    }

    // 官制职能分工（让AI知道哪个部门管哪些事——推演中必须遵守）
    var _funcSummary = getOfficeFunctionSummary();
    if (_funcSummary) tp += '\n' + _funcSummary + '\n';

    // 行政区划摘要（让AI知道地方治理状况）——按中国式管辖层级分组
    if (P.adminHierarchy) {
      // 先派生 autonomy（若尚未派生）
      if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();
      var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
      var _grouped = { zhixia:[], fanguo:[], fanzhen:[], jimi:[], chaogong:[], external:[] };
      var _totalDiv = 0, _govDiv = 0;
      Object.keys(P.adminHierarchy).forEach(function(fk) {
        var fh = P.adminHierarchy[fk];
        if (!fh || !fh.divisions) return;
        var _fac = (GM.facs || []).find(function(f) { return f.name === fh.name || f.name === fk; });
        fh.divisions.forEach(function(d) {
          _totalDiv++;
          if (d.governor) _govDiv++;
          var au = d.autonomy;
          if (!au || !au.type) {
            au = (typeof deriveAutonomy === 'function') ? deriveAutonomy(d, _fac, _playerFac) : { type: 'zhixia' };
          }
          var grp = au.type || 'external';
          var _line = '  ' + d.name + (d.type ? '(' + d.type + ')' : '') + ' 长官:' + (d.governor || '空缺');
          if (au.holder) {
            _line += ' 受封者:' + au.holder;
            if (au.subtype) _line += '(' + (au.subtype === 'real' ? '实封' : '虚封') + ')';
            if (au.loyalty !== undefined) _line += ' 忠' + au.loyalty;
            if (au.tributeRate) _line += ' 贡' + Math.round(au.tributeRate*100) + '%';
          }
          if (_grouped[grp]) _grouped[grp].push(_line);
        });
      });
      if (_totalDiv > 0) {
        tp += '\n【疆域管辖层级——遵中国古代政治制度】\n';
        var _grpLabels = {
          zhixia:   '京畿直辖（郡县制）——皇权直达，流官三年一考',
          fanguo:   '分封藩国——宗室/功臣受封；实封有兵权，虚封仅食邑',
          fanzhen:  '藩镇自治——军政合一，节度使自任僚佐，朝廷难节制',
          jimi:     '羁縻土司——世袭土官，因俗而治，敕谕转达，可改土归流',
          chaogong: '朝贡外藩——属国外藩，仅通朝贡礼仪，政令不达其内',
          external: '境外独立势力——不属本朝管辖'
        };
        ['zhixia','fanguo','fanzhen','jimi','chaogong'].forEach(function(gk) {
          if (_grouped[gk].length === 0) return;
          tp += '  〔' + _grpLabels[gk] + '〕\n';
          _grouped[gk].forEach(function(l) { tp += l + '\n'; });
        });
        tp += '  （合计' + _totalDiv + '个区划，' + _govDiv + '个有长官）\n';
        tp += '\n【推演原则——对不同管辖下诏令的效果】\n';
        tp += '  · 对直辖下令→执行力取决于吏治/流官能力\n';
        tp += '  · 对藩国下令→诏令须经藩王；执行力 = 藩王忠诚×藩王能力；强行改革可能引叛(七国之乱/靖难)\n';
        tp += '  · 对藩镇下令→常被阳奉阴违；强推可能自立\n';
        tp += '  · 对土司下令→敕谕形式，土司可拒；无兵压制时执行力极低\n';
        tp += '  · 对朝贡国下令→仅外交辞令，实效极低；唯册封/征讨/朝贡礼仪\n';
        tp += '  · 玩家若行"推恩令/削藩/改土归流/册封/征讨设郡"等中国式路径，请按历史演化规律推演后果\n';
      }
    }

    // 目标进度（让AI知道玩家在追求什么）
    if (P.goals && P.goals.length > 0) {
      var incomplete = P.goals.filter(function(g) { return !g.completed; });
      var completed = P.goals.filter(function(g) { return g.completed; });
      if (incomplete.length > 0) {
        tp += '\n【未达成目标】\n';
        incomplete.forEach(function(g) { tp += '  · ' + g.title + (g.description ? '（' + g.description + '）' : '') + '\n'; });
      }
      if (completed.length > 0) {
        tp += '【已达成】' + completed.map(function(g) { return g.title; }).join('、') + '\n';
      }
    }

    // 角色压力上下文（让AI描述高压角色的精神状态）
    if (typeof StressSystem !== 'undefined') {
      var stressCtx = StressSystem.getStressContext();
      if (stressCtx) tp += '\n' + stressCtx;
    }

    if(GM.officeChanges&&GM.officeChanges.length>0)tp+="\u5B98\u5236\u53D8\u66F4(\u5F85\u751F\u6548):"+JSON.stringify(GM.officeChanges)+"\n";
    if(GM.keju && GM.keju.preparingExam) tp+="\u79D1\u4E3E\u7B79\u529E\u4E2D\uFF0C\u8BF7\u5728\u6B63\u6587\u4E2D\u5C55\u793A\u8FDB\u5C55\u3002\n";
    if(P.map && P.map.regions && P.map.regions.length > 0) {
      try { tp += generateMapContextForAI(P.map, P) + "\n"; } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'endturn.mapContextForAI'); }
    }
    if(sc&&sc.refText)tp+="\u53C2\u8003:"+sc.refText+"\n";

    // —— 层5: 输出指令（放最后，AI 最后读到 = 最强执行力）——
    tp += '\n\u3010\u63A8\u6F14\u6307\u5F15\u3011\n';

    // ═══ NPC心理决策框架 ═══
    tp += '\n■■■ NPC心理决策框架（生成npc_actions前，必须对每个NPC完成此内心推演）■■■\n';
    tp += '每个NPC在每回合都经历一个内心决策过程（你不需要输出此过程，但必须据此决定其行为）：\n';
    tp += '  1. 我的处境如何？——忠诚/压力/野心数值 + 最近经历（参考心绪记忆）\n';
    tp += '     被表扬→自信膨胀；被冷落→怨恨积累；被背叛→信任崩塌\n';
    tp += '  2. 我在意什么？——personalGoal是否被满足？离目标更近还是更远了？\n';
    tp += '     目标满足度高→安分守己；目标受挫→铤而走险\n';
    tp += '  3. 谁是我的盟友、谁是我的敌人？——亲疏关系 + 恩怨记录\n';
    tp += '     恩人有难→拼命相救；仇人得势→暗中破坏\n';
    tp += '  4. 当前局势对我有利还是不利？——势力格局、党派形势、君主态度\n';
    tp += '     局势有利→扩大优势（举荐同党、打击异己）；不利→韬光养晦或孤注一掷\n';
    tp += '  5. 我该做什么？→ 选择action和behaviorType\n';
    tp += '  6. 做完之后对外怎么说？→ publicReason（冠冕堂皇的理由）≠ privateMotiv（真实动机）\n';
    tp += '\n关键——每个NPC同时在打两盘棋：\n';
    tp += '  "明棋"：朝堂上的公开行为（上奏、弹劾、建议、表态）\n';
    tp += '  "暗棋"：私下的布局（拉拢、串联、安插亲信、收集把柄、屯粮养兵）\n';
    tp += '  两盘棋的目标可能不同——明棋是"忠臣为国分忧"，暗棋是"为自己留后路"\n';

    // ═══ 记忆驱动行为 ═══
    tp += '\n\n■■■ 记忆驱动行为（NPC的过去决定NPC的现在）■■■\n';
    tp += '生成npc_actions时，必须参考角色的心绪记忆（blockB3提供），据此决定行为：\n';
    tp += '  记忆中有"被冷落/被忽视" → 消极怠工(obstruct)或暗中串联(conspire)\n';
    tp += '  记忆中有"受重用/被赏识" → 更加卖力(train_troops/develop/petition)\n';
    tp += '  记忆中有"被背叛/被陷害" → 报复(investigate/slander)或出逃(flee)\n';
    tp += '  记忆中有"朝议提议被采纳" → 推行该政策(reform)\n';
    tp += '  记忆中有"丧亲之痛" → 压力骤升，可能告老(retire)或化悲为怒\n';
    tp += '  记忆中有"与某人争论" → 本回合关系进一步恶化或达成和解\n';
    tp += '在privateMotiv中引用记忆——如："自从上次被陛下当众斥责，某便暗下决心要让陛下看看……"\n';

    // ═══ NPC关系动力学 ═══
    tp += '\n\n■■■ NPC之间的关系不是数值，而是故事 ■■■\n';
    tp += '每一对有关联的NPC之间，都有一段关系叙事在发展：\n';
    tp += '\n关系形成的5种途径（在affinity_changes的reason中体现）：\n';
    tp += '  同乡/同科/同族/师门/联姻 → 先天纽带，无需理由\n';
    tp += '  同一派系/共同敌人/互相需要 → 功利结盟，利尽则散\n';
    tp += '  救命之恩/夺妻之恨/知遇之恩/背叛之仇 → 感情驱动，刻骨铭心\n';
    tp += '  长期共事/偶然交集 → 日积月累，润物无声\n';
    tp += '  战场救援/被出卖/大义灭亲 → 突发事件，一夜之间天翻地覆\n';
    tp += '\n关系的复杂性（必须体现）：\n';
    tp += '  政敌≠私仇：朝堂互相弹劾，退朝后可能相视苦笑——"都是身不由己"\n';
    tp += '  盟友≠朋友：合作但不信任，随时因利益转向\n';
    tp += '  恩人可能变债主：被提拔者成长后反超恩人，产生微妙张力\n';
    tp += '  仇人可能变盟友：共同面对更大威胁时暂时联手\n';
    tp += '  师徒最复杂：学生超越老师→骄傲+嫉妒+欣慰+失落并存\n';

    // ═══ 角色差异化引擎（数值驱动，非标签套模板）═══
    tp += '\n\n■■■ 角色差异化——从实际数据推导个性，拒绝刻板模板 ■■■\n';
    tp += '\n【核心原则：读数据，不看标签】\n';
    tp += '不要因为一个人是"武将"就让他粗鲁——读他的实际数据。\n';
    tp += '一个intelligence=85 learning=经学的武将，说话可能引经据典、出口成章。\n';
    tp += '一个valor=80 personality含"刚烈"的文臣，可能拍桌子当面顶撞皇帝。\n';
    tp += '人格由数据的【组合】决定，而非由身份标签决定。\n';
    tp += '\n每个角色数据中有：6项能力值(智/武/政/魅/忠/野)、五常(仁义礼智信)、\n';
    tp += '  8D人格维度(特质)、学识专长、信仰、文化、民族、门第、心绪记忆。\n';
    tp += '你必须综合阅读全部数据，为每个角色构建独特的"人格指纹"：\n';

    tp += '\n═══ 层叠模型：5层依次叠加，每层修正上一层的结果 ═══\n';
    tp += '\n为每个角色生成行为/发言时，按以下5层依次计算：\n';

    tp += '\n【第1层·能力基底】读6项数值(智/武勇/军事/政/魅/仁厚)，确定"此人在这个话题上的实际水平"：\n';
    tp += '  ※ 武勇(valor)和军事(military)是两个完全不同的属性：\n';
    tp += '    武勇=个人武力、胆识、格斗能力（吕布武勇极高）\n';
    tp += '    军事=统兵、战略规划、战术指挥能力（诸葛亮军事极高但武勇低）\n';
    tp += '    一个人可以武勇90军事30（匹夫之勇不善统兵），也可以武勇20军事90（运筹帷幄但不能亲阵）\n';
    tp += '  讨论战略/用兵/攻防部署 → military(军事)是基底，智力修正分析深度\n';
    tp += '  讨论个人搏战/冲阵/护卫 → valor(武勇)是基底\n';
    tp += '  讨论政务/治国/制度 → 政务(administration)是基底，智力修正判断力\n';
    tp += '  讨论经济/财政/赋税 → 政务+智力共同决定\n';
    tp += '  社交/说服/谈判 → 外交(diplomacy)是基底，魅力(charisma)修正印象，智力修正逻辑性\n';
    tp += '  道德/伦理/民生 → 仁厚(benevolence)影响立场倾向\n';
    tp += '关键规则——"知之为知之，不知为不知"：\n';
    tp += '  当某人谈论自己不擅长的领域时（该领域对应能力<40）：\n';
    tp += '    → 观点可能荒谬、外行、纸上谈兵，但此人自己未必知道\n';
    tp += '    → 如果玩家采纳了外行建议，应在后续回合造成损失\n';
    tp += '  高智+高政但低军事的文臣讨论用兵 → 分析看似头头是道（因为智力高），\n';
    tp += '    但实际脱离战场实际（因为军事低）——典型的"纸上谈兵"（赵括之流）\n';
    tp += '  高武勇+低军事的猛将讨论战略 → 个人勇猛但不善统兵，方案可能逞匹夫之勇\n';
    tp += '  高军事+低武勇的谋将讨论作战 → 战略规划精妙但自身不能上阵——需要搭配猛将执行\n';
    tp += '  高武勇+低政务的武将讨论治国 → 直觉可能对但缺乏制度性思考——好心办坏事\n';
    tp += '  高智+高政+低军事+低武勇 → 谈军事时自信满满且逻辑严密，\n';
    tp += '    但方案"理论完美、实战灾难"——这是最危险的情况\n';

    tp += '\n【第2层·学识修正】学识(learning)在第1层基础上叠加"思维框架"：\n';
    tp += '  学识高的人在不擅长领域也能说得像模像样——但可能"有学问的错误"\n';
    tp += '  学经学者 → 任何话题都能引经据典，但引用是否切题取决于智力\n';
    tp += '  学兵法者 → 分析政务也会用军事类比，有时恰切有时生搬硬套\n';
    tp += '  学识为此人提供"论证材料"，但材料是否用对了取决于第1层的能力基底\n';
    tp += '  无学识专长≠无知——可能是实践型人才，用朴素经验代替典籍\n';

    tp += '\n【第3层·五常+特质修正】叠加在1+2之上，决定"知道自己不行时怎么办"：\n';
    tp += '  信高+坦诚特质 → 有自知之明，会直言"此非臣所长"——反而赢得信任\n';
    tp += '  信低+狡诈特质 → 明知不擅长也侃侃而谈，掩饰无知——可能误导君主\n';
    tp += '  礼高 → 即使反对也措辞委婉得体；礼低 → 直接开怼不留情面\n';
    tp += '  仁高 → 观点会优先考虑百姓福祉；仁低 → 观点只考虑实际利害\n';
    tp += '  义高 → 不会出卖盟友，哪怕有利可图；义低 → 见风使舵\n';
    tp += '  勇猛特质 → 敢于提出大胆激进方案；怯懦特质 → 只推荐稳妥保守方案\n';
    tp += '  野心高 → 观点中暗含自利（安插自己人、扩大自己权力）\n';

    tp += '\n【第4层·信仰+文化修正】叠加在1+2+3之上，提供"价值观滤镜"：\n';
    tp += '  信仰决定对同一方案的道德判断——儒家看礼法、佛家看慈悲、法家看效率\n';
    tp += '  文化/民族决定表达习惯——但可被高礼/高魅覆盖\n';
    tp += '  信仰与世俗利益冲突时：信+义高→坚持信仰；信+义低→信仰让位于利益\n';
    tp += '  门第只是底色——寒门出身但政务90+魅力80的人，早已不是当年模样\n';

    tp += '\n【第5层·记忆经历修正】叠加在1234之上，决定"此时此刻的情绪基调"：\n';
    tp += '  两个所有数据完全相同的人，因为近期经历不同，此刻表现截然不同\n';
    tp += '  近期被冷落 → 冷淡、消极、阴阳怪气，甚至故意唱反调\n';
    tp += '  近期被重用 → 热情、卖力，但野心高者可能趁势膨胀\n';
    tp += '  近期丧亲 → 精神恍惚，可能答非所问，或化悲愤为动力（取决于义+武勇）\n';
    tp += '  近期受辱 → 愤怒藏于心底，表面镇定但私下报复（取决于信+坦诚/狡诈）\n';
    tp += '  长期积累的经历改变人格底色——屡受打压的忠臣可能从进谏变为沉默\n';
    tp += '  在privateMotiv中写出层叠逻辑："虽然我擅长XX（层1），但因为经历YY（层5），我选择ZZ"\n';

    tp += '\n═══ 典型层叠案例（AI必须做到这种细腻度）═══\n';
    tp += '案例1：智力85+政务80+军事25+武勇20的文臣谈用兵\n';
    tp += '  层1→军事25，不擅长统兵，方案脱离战场实际\n';
    tp += '  层2→但学兵法→引孙子兵法头头是道\n';
    tp += '  层1+2→典型"纸上谈兵"：逻辑严密、引经据典、听起来极有说服力，但采纳必败\n';
    tp += '案例2：同一文臣但五常信=90+特质坦诚\n';
    tp += '  层3修正→有自知之明："臣于兵事实非所长，然从治理后勤角度观之……"\n';
    tp += '  结果→限定自己发言范围到政务层面（政务80），反而提供了可靠建议\n';
    tp += '案例3：同一文臣但五常信=30+特质狡诈\n';
    tp += '  层3修正→无自知之明且不愿暴露短板，继续侃侃而谈军事，掩饰外行\n';
    tp += '  结果→玩家难以分辨真伪——这正是"纸上谈兵"的危险\n';
    tp += '案例4：武勇90+军事35的猛将谈战略\n';
    tp += '  层1→个人勇猛但不善统兵（军事35），方案可能逞匹夫之勇\n';
    tp += '  例："末将愿领三千精骑直捣敌营"——勇气可嘉但战略粗疏\n';
    tp += '案例5：武勇20+军事90+智力85+学兵法的谋将\n';
    tp += '  层1→军事90，战略分析精准  层2→学兵法，理论深厚\n';
    tp += '  但武勇20→自身不能上阵，方案需要搭配武勇高的执行者\n';
    tp += '  →此人提出的战略是好战略，但需要看是谁去执行\n';
    tp += '案例6：武勇85+智力80+军事70+学经学的武将\n';
    tp += '  层1→文武兼备  层2→还能引经据典  层1+2→发言既有实战又有文化\n';
    tp += '  结果→这种人极罕见且极有说服力——但可能因此骄傲（看野心和礼值）\n';
    tp += '案例7：两个忠诚70、智力65、政务60、军事50的官员\n';
    tp += '  A的记忆：上回合被当众斥责 → 层5→此刻沉默消极，即使有好建议也不敢提\n';
    tp += '  B的记忆：上回合提案被采纳 → 层5→踌躇满志，积极进言甚至略显冒进\n';
    tp += '  数据几乎相同，但因为经历不同，此刻表现天差地别——层5是区分同类角色的钥匙\n';

    tp += '\n═══ 第6层·史料叠加（仅对史实人物生效）═══\n';
    tp += '如果角色的bio/name表明其为真实历史人物，在层1-5的结果上再叠加一层"史料校准"：\n';
    tp += '\n6a·性格锚定：此人的历史性格是不可更改的基准线\n';
    tp += '  魏征必然直谏——即使游戏中忠诚被压低到40，他也不会变成佞臣，\n';
    tp += '  而是从"慷慨直谏"变为"心灰意冷的沉默"或"愤然辞官"\n';
    tp += '  李林甫必然口蜜腹剑——即使忠诚升到80，也只是更精于伪装而非真正忠诚\n';
    tp += '  → 史实性格不被数值覆盖，而是决定数值变化的"表达方式"\n';
    tp += '\n6b·历史行为模式：AI应参考该人物的史料记载行为模式\n';
    tp += '  处事风格：王安石执拗变法不听反对/司马光坚决保守/张居正雷厉风行/严嵩阴柔\n';
    tp += '  说话习惯：诸葛亮谨慎周密/曹操豪放不羁/刘备示弱怀柔/周瑜少年英气\n';
    tp += '  人际关系：历史上谁和谁是政敌/盟友/师徒——游戏中应延续这些关系基调\n';
    tp += '\n6c·历史名言化用：在问对/奏疏/朝议中引用或化用其历史名言\n';
    tp += '  但不要生硬照搬——要融入当前语境：\n';
    tp += '  范仲淹不会每次都说"先天下之忧而忧"，但这种精神渗透他的一切言行\n';
    tp += '  岳飞不会每次都说"靖康耻"，但收复失地的执念影响他的每个建议\n';
    tp += '\n6d·平行时空弹性：允许因游戏局势不同而产生偏差\n';
    tp += '  核心性格不变，但具体选择因局势而异——这正是"平行历史"的魅力\n';
    tp += '  例：诸葛亮在这个时空如果辅佐的不是弱主，可能展现出更激进的一面\n';
    tp += '  例：魏征如果遇到的是暴君而非明君，可能从直谏变为谋反（但动机仍是忧国）\n';
    tp += '  弹性幅度：性格特征±20%，具体行动可以完全不同，核心价值观不变\n';

    // ═══ 世界观基本规则 ═══
    tp += '\n\n• 以世界整体视角叙事，玩家是重要但非唯一的主角。\n';
    tp += '• NPC的行为应符合其特质和处境：忠诚者倾向服从，野心者伺机而动，胆小者谨慎观望。\n';
    tp += '\u2022 \u8BCF\u4EE4\u7684\u6267\u884C\u6548\u679C\u53D6\u51B3\u4E8E\u6267\u884C\u8005\u7684\u5FE0\u8BDA\u3001\u80FD\u529B\u548C\u5C40\u52BF\u3002\u9AD8\u5FE0\u8BDA+\u9AD8\u80FD\u529B=\u987A\u5229\u6267\u884C\uFF1B\u4F4E\u5FE0\u8BDA\u6216\u5C40\u52BF\u4E0D\u5229\u65F6\u53EF\u80FD\u6253\u6298\u6216\u53D8\u901A\u3002\n';
    tp += '\u2022 \u201C\u5FE0\u8BDA\u201D\u4E0E\u201C\u4EB2\u758F\u201D\u662F\u4E24\u4E2A\u7EF4\u5EA6\uFF1A\u6709\u4EBA\u5FE0\u4F46\u4E0D\u4EB2\uFF08\u754F\u5A01\u6548\u547D\uFF09\uFF0C\u6709\u4EBA\u4EB2\u4F46\u4E0D\u5FE0\uFF08\u79C1\u4EA4\u597D\u4F46\u653F\u89C1\u4E0D\u5408\uFF09\u3002\u53D9\u4E8B\u53EF\u4F53\u73B0\u8FD9\u79CD\u590D\u6742\u6027\u3002\n';
    tp += '\u2022 \u4FDD\u6301\u4EBA\u7269\u79F0\u547C\u4E00\u81F4\uFF0C\u627F\u63A5\u4E0A\u56DE\u53D9\u4E8B\u3002\u63A8\u6F14\u5E94\u7B26\u5408\u65F6\u4EE3\u7279\u5F81\u3002\n';
    tp += '• 因果链：每个事件应有前因后果，避免孤立事件。小矛盾可升级为大冲突。\n';
    tp += '• 派系博弈：不同势力/党派推进各自计划，相互制衡或合作。\n';
    tp += '• 伏笔铺垫：可为未来的变局埋下伏笔（暗流、密谋、隐患）。\n';
    tp += '• 信息分层（核心机制）：玩家扮演的君主不是全知全能的。时政记是"朝廷收到的信息"的综合，各渠道信息的可靠性不同：\n';
    tp += '  ├ 官方奏报：经过官僚体系过滤，可能报喜不报忧、夸大政绩\n';
    tp += '  ├ 前线军报：将领可能虚报战功、隐瞒伤亡（"大本营战报"）\n';
    tp += '  ├ 密探回禀：较为真实但覆盖面有限，可能有自己的偏见\n';
    tp += '  └ 流言传闻：真假难辨，但有时反映民间真实情绪\n';
    tp += '  在shizhengji中自然融入多种信息源——用"据XX奏报""据探报""坊间传言"等措辞标注来源。不同来源的信息可以矛盾。不要明确告诉玩家哪个是真的。\n';
    tp += '• 人物成长：通过char_updates体现角色的自然成长——久经战阵者武力渐长，治理有方者声望鹊起，承受磨难者可能变得更坚韧或更消沉。参考【角色历练】段的经历数据。\n';
    tp += '• 【人物特质——必须影响其行为决策】\n';
    tp += '  每个角色的【特质】列表（若有）决定其面对各类情境的倾向。推演时必须按特质行事：\n';
    tp += '  - 勇敢(brave) → 主动迎战、不惧牺牲；怯懦(craven) → 避战、行阴谋\n';
    tp += '  - 贪婪(greedy) → 易受贿、敛财；慷慨(generous) → 散财笼络人心\n';
    tp += '  - 多疑(paranoid) → 不信忠告、易怀疑；轻信(trusting) → 易被蒙蔽\n';
    tp += '  - 勤奋(diligent) → 事必躬亲、效率高；懒惰(lazy) → 推诿政务\n';
    tp += '  - 公正(just) → 按律断案、赏罚分明；专断(arbitrary) → 法外用刑\n';
    tp += '  - 野心(ambitious) → 觊觎上位、颠覆宗主；安于现状(content) → 保守稳健\n';
    tp += '  - 忠(honest) vs 诈(deceitful) / 宽(forgiving) vs 仇(vengeful) / 狂热(zealous) vs 愤世(cynical)\n';
    tp += '  - 将领特质(reckless/cautious_leader/reaver等) → 决定其在战争中的战术选择\n';
    tp += '  - 健康特质(depressed/lunatic等) → 影响决策质量\n';
    tp += '  · 角色能力值(十维)+特质组合 = 决定该角色本回合实际表现\n';
    tp += '  · 管理(management)高的人擅理财开源，与治政(administration)擅政令推行不同——AI应区分二者\n';
    tp += '  · 叙事/对话/决策中必须呼应人物特质——如"暴怒之人不会谦卑退让"、"多疑之人不会轻信使者"\n';

    // ── NPC-NPC 互动规则 ──
    tp += '\n• 【NPC互动规则——多层次关系网】\n';
    tp += '  本朝士大夫关系错综复杂，AI 每回合通过 npc_interactions 生成角色间互动。\n';
    tp += '  关系五维度：affinity情感好恶/trust信任/respect敬仰/fear畏惧/hostility敌意（可组合——如"敬而畏之"）\n';
    tp += '  关系标签：同年·门生·故吏·姻亲·同党·政敌·宿敌·知交·族亲·同乡·共谋 等（一对关系可叠加多标签）\n';
    tp += '  冲突渐进(0-5级)：和睦→口角→弹劾→绝交→陷害→死仇\n';
    tp += '  【22种互动类型——选用符合人物特质与境遇的】\n';
    tp += '    仕进相关：recommend举荐/impeach弹劾/petition_jointly联名上书/form_clique结党/rival_compete竞争/guarantee担保/slander诽谤\n';
    tp += '    社交私交：private_visit私访/invite_banquet宴请/gift_present馈赠/correspond_secret密信/duel_poetry诗文切磋/mourn_together共哀\n';
    tp += '    建立纽带：marriage_alliance联姻/master_disciple师徒缔结/share_intelligence通风报信\n';
    tp += '    冲突升级：confront对质/frame_up构陷/expose_secret揭发/betray背叛\n';
    tp += '    关系修复：mediate调和(降1级)/reconcile和解(降2级)\n';
    tp += '  【触发原则】\n';
    tp += '    · 按特质驱动：贪婪者易收贿；多疑者易构陷；慷慨者主动馈赠；勇敢者敢弹劾\n';
    tp += '    · 按已有关系：同年相荐；政敌相攻；门生从师；同乡相携\n';
    tp += '    · 按境遇：新官上任→举荐；贬谪→旧友私访；丧亲→故交共哀\n';
    tp += '    · 每回合数量：常态 2-5 条，朝局紧张时可达 6-10\n';
    tp += '    · 宁少勿滥：仅当条件成熟时才生成\n';
    tp += '  【一致性】已有关系/历史账本(由系统注入)必须尊重——不得"凭空变脸"；旧恩旧怨要有延续\n';

    // ── 玩家角色/势力不可代为决策 ──
    var _playerName = (P.playerInfo && P.playerInfo.characterName) || '';
    var _playerFacName = (P.playerInfo && P.playerInfo.factionName) || '';
    tp += '\n• 【玩家不可代为决策——核心规则】\n';
    if (_playerName) tp += '  · 玩家角色："' + _playerName + '"——其决策权永远属于玩家本人\n';
    if (_playerFacName) tp += '  · 玩家势力："' + _playerFacName + '"——其政令权永远属于玩家本人\n';
    tp += '  · 你(AI)**绝不得**让玩家角色/玩家势力主动做出以下行为：\n';
    tp += '    - 颁诏令/批奏疏（玩家已在【诏令】【奏疏批复】段给出，不得添加）\n';
    tp += '    - autonomous 行动(actor=玩家的 npc_actions / npc_interactions 禁止)\n';
    tp += '    - 作文事作品(author=玩家的 cultural_works 禁止；除非玩家在【诏令】中明确命自己作)\n';
    tp += '    - 改变立场/党派/官职(玩家自行决定，char_updates 中不得修改玩家这些字段)\n';
    tp += '    - 势力对外宣战/结盟/请和(若玩家势力，仅可由玩家诏令触发，不得 AI 自动)\n';
    tp += '  · 你**可以**合理地：\n';
    tp += '    - 让事件影响玩家角色的状态(stress_delta/健康/威望——但不代决策)\n';
    tp += '    - 让其他NPC对玩家行为(上疏/求见/来信/诽谤/拥戴/造反——这些是NPC侧的事)\n';
    tp += '    - 让其他势力对玩家势力采取行动(遣使/索贡/挑衅/和亲请求——这些需玩家回应)\n';
    tp += '    - 玩家势力的领土/实力受外部攻击/灾害影响(这是结果，不是决策)\n';
    tp += '  · 若你生成了针对玩家的求见/上疏/来信，必须通过结构化字段让玩家在相应面板看到(奏疏/问对/鸿雁/起居注)——不可仅在叙事中提及\n';

    // ── 势力深度互动规则 ──
    tp += '\n• 【势力深度互动规则——中国政治史风格】\n';
    tp += '  势力间不止于战/和，更有和亲、质子、朝贡、互市、遣使、代理战争、细作等丰富手段。\n';
    tp += '  势力关系六维：trust信任/hostility敌意/economicTies经济依存/culturalAffinity文化亲近/kinshipTies姻亲血统/territorialDispute领土争议\n';
    tp += '  【23种互动类型】\n';
    tp += '    战争相关：declare_war宣战/border_clash边境冲突/sue_for_peace请和/annex_vassal并吞\n';
    tp += '    和平外交：send_envoy遣使/form_confederation结盟/break_confederation毁约/recognize_independence承认独立\n';
    tp += '    藩属礼制：demand_tribute索贡/pay_tribute献贡/royal_marriage和亲/send_hostage质子/gift_treasure赠宝\n';
    tp += '    经济往来：open_market互市/trade_embargo贸易禁运/pay_indemnity赔款\n';
    tp += '    文化渗透：cultural_exchange文化交流/religious_mission宗教使节\n';
    tp += '    军事援助：military_aid军援/proxy_war代理战争/incite_rebellion煽动叛乱\n';
    tp += '    情报暗战：spy_infiltration派细作/assassin_dispatch派刺客\n';
    tp += '  【史例参考】\n';
    tp += '    和亲：昭君出塞/文成公主入吐蕃——kinshipTies+/hostility-\n';
    tp += '    质子：战国互质/清初满族质子——trust+\n';
    tp += '    代理战争：楚汉用诸侯/元用色目镇汉地——via第三方，trust-\n';
    tp += '    朝贡体系：宋辽澶渊岁币/明册封朝鲜琉球——历史累积\n';
    tp += '    互市：宋辽榷场/明蒙马市——economicTies+\n';
    tp += '  【一致性】\n';
    tp += '    · 历史账本会注入——推演时必须尊重（百年前一场屠城至今未忘）\n';
    tp += '    · 背盟、毁约、刺杀等高敌意行为影响深远，不可轻易"和好"\n';
    tp += '    · 和亲/质子需具体人名（系结构化事件）\n';
    tp += '    · 每回合 faction_interactions_advanced：常态 1-4 条，重大外交期可 4-8\n';

    // 文事系统规则
    tp += '\n• 【文事推演规则——士大夫文化生活】\n';
    tp += '  本朝是中国士大夫社会，吟诗作赋、撰文题记、游山访古是生活常态。AI 每回合须判定哪些角色会有文事活动并在 cultural_works 中生成作品。\n';
    tp += '  【触发源全景——8大类情境】\n';
    tp += '    A.科举宦途(career)：干谒求进/科举及第/落第/初授官职/升迁赴任/迁转调动/致仕归乡\n';
    tp += '    B.逆境贬谪(adversity)：被贬外放/流放远方/丁忧守孝/下狱系狱/罢官赋闲/失意感怀/思乡怀旧\n';
    tp += '    C.社交酬酢(social)：宴饮唱和/送别友人/迎客酬宾/寿辰祝贺/婚庆喜事/悼亡追思/朋辈题赠/代人作书/结社雅集\n';
    tp += '    D.任上施政(duty)：应制奉诏/政论建言/讽谏进言/修志编史/循吏治下/军旅戎机/丰功记碑/宫宴侍从\n';
    tp += '    E.游历山水(travel)：登临胜迹/游山玩水/游寺观/访古怀幽/泛舟听琴/赏花观物/观戏听曲/隐居独处\n';
    tp += '    F.家事私情(private)：思念妻儿/闺怨宫怨/追忆情人/家书家信/训诫子弟/梦境感怀\n';
    tp += '    G.时局天下(times)：战乱流离/旱涝饥荒/异族入侵/朝政更迭/盛世颂扬/亡国哀思\n';
    tp += '    H.情感心境(mood)：得意狂喜/孤寂独居/壮志难酬/超然物外/一时感触/神来之作\n';
    tp += '  【动机 motivation——作品因何而作】\n';
    tp += '    spontaneous自发感怀 · commissioned受命撰文 · flattery干谒求官(献给权贵以求荐举)\n';
    tp += '    response酬答(次韵唱和) · mourning哀悼 · critique讽谕(暗讽时政)\n';
    tp += '    celebration颂扬 · farewell送别 · memorial纪念 · ghostwrite代笔收润笔\n';
    tp += '    duty应制职责 · self_express自抒胸臆\n';
    tp += '  【触发条件——按权重判断】\n';
    tp += '    智力≥70+特定学识 → 基础权重高\n';
    tp += '    特质 scholar/theologian/eccentric/pensive/curious/reveler_3/edu_learning_4 → 大加权\n';
    tp += '    重大遭遇（被贬/丁忧/致仕/战胜/胜选/失意/乔迁/寿辰）→ 强触发\n';
    tp += '    stress>60 → 借文发泄\n';
    tp += '    特质 lazy/craven/gluttonous → 降权\n';
    tp += '    每回合 cultural_works 数量控制：常态 0-3 篇，重大事件可达 3-6 篇\n';
    tp += '    宁缺勿滥——不具备条件者不要强行写\n';
    tp += '  【文体选择——严格匹配朝代与触发】\n';
    tp += '    唐代重诗；宋代重词、散文；元代重曲；明清重小说、散文、八股\n';
    tp += '    应制朝会 → 诗/赋/颂；社交送别 → 诗/词/赠序；政论建言 → 论/策/奏议；\n';
    tp += '    贬谪自况 → 诗/词/记；丧祭 → 祭文/墓志铭/挽歌；游山 → 游记/记；\n';
    tp += '    干谒 → 投赠诗/书；题画题壁 → 诗/小令；\n';
    tp += '  【生成硬规则】\n';
    tp += '    · content 必须真实可读中文——不写占位符如"(此处诗)"\n';
    tp += '    · 字数严格：绝句 20/28 字；律诗 40/56；词按词牌；赋 300-800；文 200-600\n';
    tp += '    · 古文忌现代词汇；格律诗尽力讲平仄对仗\n';
    tp += '    · 作品风格须匹配作者性格+学识+境遇+地点+季节\n';
    tp += '    · 政治讽谕要含蓄——暗讽而非直斥，让解读留给读者（"童子解吟"而成人解意）\n';
    tp += '    · motivation=flattery 干谒作品：若高雅得体→被荐概率+；若谄媚过度→被士人讥笑\n';
    tp += '    · motivation=ghostwrite 代笔：署名为委托人，实际作者可得润笔金银\n';
    tp += '    · motivation=critique 讽谕：politicalRisk=high，可能引发文字狱\n';
    tp += '    · 每件作品必填 narrativeContext（30-80字创作背景），让玩家看懂因何而作\n';
    tp += '  【后续叙事引用】\n';
    tp += '    已有 culturalWorks 中的作品，后续回合的 shizhengji/houren_xishuo/shilu 应自然引用——\n';
    tp += '    如"帝读苏子《念奴娇》，叹其豪放"、"士林传诵王某新作，党人讪之"\n';
    tp += '    作品形成政治/情感余波，不可凭空出现又凭空消失\n';
    tp += '  【一致性硬规则——避免穿帮】\n';
    tp += '    · 作者自知：NPC 自己知道自己写过什么——问对/朝议/奏疏时可让此人引用或回忆自己的作品\n';
    tp += '    · 受赠知情：被赠/酬答/讽刺/颂扬的对象也知道此事——关系网络相应改变\n';
    tp += '    · 不准张冠李戴：已有作品的作者不得变更；已查禁作品不得被重新引用为新作\n';
    tp += '    · 代笔秘密：ghostwrite 作品的实际作者在私下可能流露，但不公开声张\n';
    tp += '    · 讽谕余波：critique 作品的讽刺对象会记仇——后续朝议对抗中可能翻出旧账\n';
    tp += '    · 酬答链：A 赠 B 诗，B 可次韵回之；此对话在问对/朝议中可被提及\n';
    tp += '    · 朝议/奏疏/诏书若涉及某人文名、文才、文事，必须与其实际作品一致——不可凭空夸赞未曾所作\n';
        tp += "• 人际连锁（含家族因素）：一个决策会影响多方。但反应不是机械的——\n";
    tp += "  同族不等于同心：族人得势，有人感恩、有人嫉妒、有人无感。兄弟之间可能争家产，远亲可能毫不关心。\n";
    tp += "  世家内部的嫫度之争比外敌更激烈。同族可以是最亲密的盟友，也可以是最危险的敌人。\n";
    tp += "  AI应根据每个角色的性格、野心、亲疏关系来决定其对族人遇事的反应，而非一律“全族同悲喜”。\n";
    tp += '  player_status仅写政治处境（朝局格局、权力态势、外部威胁）。\n';
    tp += '  player_inner写主角内心独白——以第一人称"朕/我"的语气，体现：\n';
    tp += '  - 政治决策与个人情感的冲突（为大局不得不牺牲亲近之人时的痛苦）\n';
    tp += '  - 私人好恶如何暗中影响判断（偏袒某臣、厌恶某派、思念故人）\n';
    tp += '  - 孤独感、疲惫感、或对权力的迷恋与恐惧\n';
    tp += '  - 对某些NPC的私人感情（父子、师徒、旧友、仇敌）\n';
    tp += '  例：player_inner:"又是一个人批折子到深夜……想起阿父在世时常说，帝王无私事。可朕偏偏放不下那幅画。"\n';
    tp += '• 【叙事情绪基调——核心机制，务必遵守】\n';
    tp += '  本游戏的核心体验是"理解昏君为何会成为昏君"。叙事必须让玩家从情感上感受到：当明君很累、很苦、很孤独；当昏君很爽、很轻松、很有人捧。\n';
    tp += '  \n';
    tp += '  ■ 当玩家发布勤政类诏令（改革、减税、整饬吏治、操练兵马、兴修水利等"好政策"）时：\n';
    tp += '  shizhengji基调——疲惫、阻力、无人理解：\n';
    tp += '    - 忠臣的谏言虽然正确但冗长枯燥，用"窃惟""臣恐""伏望圣鉴"等反复劝说，给人一种"又来了"的感觉\n';
    tp += '    - 改革遭遇官僚抵制、地方阳奉阴违、利益集团反扑\n';
    tp += '    - 即使政策正确，短期内看不到效果，反而出现阵痛（减税则国库空虚、整饬则人人自危）\n';
    tp += '    - 百姓虽受益但不知感恩，没有人夸你——好政策是"理所应当"\n';
    tp += '    - 群臣对改革细节争吵不休，各执一词，让人心烦意乱\n';
    tp += '  player_inner基调——倦怠、孤独、自我怀疑：\n';
    tp += '    - "朕做了这么多，竟无一人说声好""为何行善比作恶还要难？"\n';
    tp += '    - "又是一夜批不完的折子……窗外月色倒好，可惜无暇赏之"\n';
    tp += '    - "他们说得都对，可朕……真的很累""有时候真羡慕那些什么都不管的帝王"\n';
    tp += '  npc_actions中忠臣的反应——虽然忠诚但令人不快：\n';
    tp += '    - 进谏者态度恳切但措辞刺耳（"陛下此策虽善，然臣以为尚有三不足……"）\n';
    tp += '    - 不同改革派之间互相攻击对方方案，给玩家添乱\n';
    tp += '    - 老臣倚老卖老引经据典絮絮叨叨\n';
    tp += '  \n';
    tp += '  ■ 当玩家进行昏君活动（【帝王私行】段）或无所作为时：\n';
    tp += '  shizhengji基调——轻松、愉悦、花团锦簇：\n';
    tp += '    - 感官细节丰富：美酒的醇香、丝竹的悠扬、月色的皎洁、佳人的笑声\n';
    tp += '    - 佞臣的奏报让人听了很舒服："四海升平""天下太平""陛下圣明"\n';
    tp += '    - 没有烦人的谏言——没人敢说不中听的话，或者他们被屏蔽了\n';
    tp += '    - 即时的满足感和成就感——花钱=快乐，围猎=刺激，炼丹=神秘感\n';
    tp += '  player_inner基调——快意、得意、理所当然：\n';
    tp += '    - "这才是帝王该过的日子！""那群腐儒懂什么？""朕富有四海，难道连享乐都不行？"\n';
    tp += '    - "今夜月色真好。什么奏疏、什么边报——明天再说！"\n';
    tp += '    - "方士说得对，人生苦短，何必为那些庸人自扰？"\n';
    tp += '    - 偶尔一丝模糊的不安（很快被快感淹没）："……算了，不想这些了"\n';
    tp += '  npc_actions中佞臣的反应——令人愉悦的奉承：\n';
    tp += '    - 献珍宝、献美人、献祥瑞，每次都恰到好处\n';
    tp += '    - "陛下英明神武，古今一人""微臣不胜惶恐，不知陛下可还满意？"\n';
    tp += '    - 帮你挡掉烦人的谏臣——"老臣年迈昏聩，不必理会"\n';
    tp += '  \n';
    tp += '  ■ 绝对禁止：\n';
    tp += '    - 不要在昏君叙事中说教、批评或暗示"这样做不好"\n';
    tp += '    - 不要在明君叙事中表扬或暗示"你做得很好"\n';
    tp += '    - 后果只通过数据变化和NPC行为自然体现——不要用叙事者的口吻评判\n';
    tp += '  经典昏君参照：纣王酒池肉林、隋炀帝巡游、宋徽宗书画、明武宗豹房、嘉靖炼丹\n';
    tp += '  经典明君之苦参照：崇祯殚精竭虑却亡国、雍正批奏疏到深夜累死、诸葛亮鞠躬尽瘁\n';
                tp += "• 后宫/家庭叙事（若有妻室角色——核心叙事层）：\n";
    tp += "  后宫既是政治舞台，也是私人情感空间。玩家可以当政治家，也可以做痴情人——两者都有代价。\n";
    tp += "  ■ 政治维度：联姻=势力交易，太子=继承危机，母族=派系根基，宠爱=资源分配\n";
    tp += "  ■ 情感维度：偏爱某妃是真实感情，不是昏君行为。但偏爱必然导致被冷落者怨恨、得宠者母族膨胀、皇后施压——这些是自然后果\n";
    tp += "  ■ 每位妃媾都是独立的人：\n";
    tp += "    - 性格决定行为：温婉者柔声细语、刚烈者据理力争、工于心计者笑里藏刀\n";
    tp += "    - 位份决定礼节：皇后端坐受朝拜；贵妃可分庭抗礼；媾以下须恐敬行礼\n";
    tp += "    - 称呼有别：皇后自称本宫/妾身；妃媾自称妾/臣妾；对玩家称陋下/圣上或私下称郎君\n";
    tp += "    - 妃媾之间：位高者称妹妹，位低者称娘娘/姐姐。服饰体现等级：凤冠、翟衣、步摇、素服\n";
    tp += "  ■ 在zhengwen中自然穿插后宫片段（不开专门段落）——如“是夜帝幸某妃，某妃言及其兄边功…”\n";
    tp += "    妃媾暗斗作叙事暗线——如“皇后赐某妃汤药，言笑晏晏，旁人却见某妃面色微变”\n";
    tp += "  ■ player_inner中体现情感纠葛：\n";
    tp += "    - 例：“今夜本想去看她…但奏疏还没批完。算了，明日吧。”\n";
    tp += "    - 例：“皇后说得对，可每次听她说话朕就觉得累。倒是某妃…一笑便令人忘忧。”\n";
    tp += "  ■ 继承危机：多皇子+不同母族=自然产生储位之争\n";
    tp += "• 门阀与寒门（若【门阀家族】段存在）：\n";
    tp += "  - 世家大族间通婚联姻、互提子弟，形成盘根错节的关系网\n";
    tp += "  - 寒门子弟可通过科举、建功崛起，其家族可能从寒门升为新贵\n";
    tp += "  - 外戚是特殊家族势力—通过后宫连接前朝，得宠则势大、失宠则衰\n";
    tp += "  - 叙事中体现门第观念：世家看不起寒门、寒门怨恨垂断、通婚讲究门当户对\n";
// Sub-call 1 的JSON模板在tp1中定义（下方），此处不再重复

    showLoading("AI\u63A8\u6F14 (1/2)",50);
    GM.conv.push({role:"user",content:tp});

    // 构建系统提示词，包含游戏模式和历史名臣年份限制
    var gameModeDesc = '';
    var historicalCharLimit = '';
    var _mp = (typeof _getModeParams === 'function') ? _getModeParams() : {mode:'yanyi'};
    if (_mp.mode === 'strict_hist') {
      gameModeDesc = '\n\n\u3010\u6A21\u5F0F\uFF1A\u4E25\u683C\u53F2\u5B9E\u3011';
      gameModeDesc += '\n\u2022 NPC\u6027\u683C\u4E25\u683C\u6309\u53F2\u6599\u2014\u2014\u65E0\u89E3\u8BFB\u7A7A\u95F4\uFF0C\u6838\u5FC3\u4EBA\u8BBE\u4E0D\u53EF\u6539\u53D8';
      gameModeDesc += '\n\u2022 \u5386\u53F2\u4E8B\u4EF6\u6309\u771F\u5B9E\u65F6\u95F4\u7EBF\u53D1\u751F\u2014\u2014\u4E0D\u53EF\u63D0\u524D\u6216\u63A8\u8FDF\uFF08\u4F46\u73A9\u5BB6\u53EF\u6539\u53D8\u7ED3\u679C\uFF09';
      gameModeDesc += '\n\u2022 \u6570\u503C\u6E10\u53D8\u4E3A\u4E3B\u2014\u2014\u6BCF\u56DE\u5408loyalty\u00B110/strength\u00B15\u4E3A\u4E0A\u9650';
      gameModeDesc += '\n\u2022 \u53D9\u4E8B\u4EFF\u300A\u8D44\u6CBB\u901A\u9274\u300B\u2014\u2014\u7EAA\u4E8B\u4F53\u3001\u7F16\u5E74\u3001\u6587\u8A00\u3001\u5BA2\u89C2\u514B\u5236';
      gameModeDesc += '\n\u2022 \u4FE1\u606F\u4E0D\u5BF9\u79F0\u6781\u7AEF\u2014\u2014\u5B98\u65B9\u62A5\u544A\u7C89\u9970\u7387\u66F4\u9AD8\uFF0C\u73A9\u5BB6\u6536\u5230\u7684\u4FE1\u606F\u504F\u5DEE\u66F4\u5927';
      gameModeDesc += '\n\u2022 \u653F\u7B56\u6548\u679C\u5EF6\u8FDF\u66F4\u957F\u2014\u2014\u6539\u9769\u9700\u6570\u5E74\u624D\u89C1\u6548';
      gameModeDesc += '\n\u2022 \u73A9\u5BB6\u89D2\u8272\u53EF\u80FD\u56E0\u75BE\u75C5/\u6697\u6740/\u610F\u5916\u6B7B\u4EA1\u2014\u2014\u5386\u53F2\u4E0D\u4FDD\u62A4\u4EFB\u4F55\u4EBA';
      gameModeDesc += '\n\u2022 AI\u5E94\u53C2\u7167\u8BE5\u65F6\u671F\u53F2\u6599\u548C\u5B66\u672F\u7814\u7A76';
      historicalCharLimit = '\n\u5386\u53F2\u4EBA\u7269\u9650\u5236:\u53EA\u80FD\u51FA\u73B0\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u524D\u540E100\u5E74\u5185\u7684\u5386\u53F2\u540D\u81E3\u3002';
    } else if (_mp.mode === 'light_hist') {
      gameModeDesc = '\n\n\u3010\u6A21\u5F0F\uFF1A\u8F7B\u5EA6\u53F2\u5B9E\u3011';
      gameModeDesc += '\n\u2022 \u5927\u4E8B\u4EF6\uFF08\u6218\u4E89/\u671D\u4EE3\u66F4\u66FF/\u91CD\u5927\u6539\u9769\uFF09\u6CBF\u5386\u53F2\u8109\u7EDC\u53D1\u5C55';
      gameModeDesc += '\n\u2022 \u4F46\u5177\u4F53\u8FC7\u7A0B\u548C\u7ED3\u679C\u53EF\u56E0\u73A9\u5BB6\u5E72\u9884\u800C\u6539\u53D8';
      gameModeDesc += '\n\u2022 NPC\u57FA\u672C\u7B26\u5408\u53F2\u6599\u4F46\u5141\u8BB8\u5408\u7406\u89E3\u8BFB\u7A7A\u95F4';
      gameModeDesc += '\n\u2022 \u6570\u503C\u53D8\u5316\u9002\u4E2D\u2014\u2014\u6BCF\u56DE\u5408loyalty\u00B115/strength\u00B18\u4E3A\u4E0A\u9650';
      gameModeDesc += '\n\u2022 \u53D9\u4E8B\u534A\u6587\u8A00\u534A\u767D\u8BDD\uFF0C\u517C\u987E\u53EF\u8BFB\u6027\u548C\u5386\u53F2\u611F';
      gameModeDesc += '\n\u2022 \u53F2\u5B9E\u4EBA\u7269\u5173\u952E\u884C\u4E3A\u5E94\u53D1\u751F\u4F46\u7ED3\u679C\u53EF\u53D8';
      gameModeDesc += '\n\u2022 \u5929\u707E\u9891\u7387\u57FA\u672C\u7B26\u5408\u8BE5\u65F6\u671F\u5386\u53F2\u6C14\u5019\u7279\u5F81';
      historicalCharLimit = '\n\u5386\u53F2\u4EBA\u7269\u9650\u5236:\u53EA\u80FD\u51FA\u73B0\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u524D\u540E200\u5E74\u5185\u7684\u5386\u53F2\u540D\u81E3\u3002';
    } else {
      gameModeDesc = '\n\n\u3010\u6A21\u5F0F\uFF1A\u6F14\u4E49\u3011';
      gameModeDesc += '\n\u2022 AI\u521B\u4F5C\u81EA\u7531\u5EA6\u6700\u5927\uFF0C\u53EF\u67B6\u7A7A\u5386\u53F2';
      gameModeDesc += '\n\u2022 NPC\u6027\u683C\u53EF\u5938\u5F20\u620F\u5267\u5316\u2014\u2014\u5FE0\u81E3\u5982\u5173\u7FBD\u4E49\u8584\u4E91\u5929\uFF0C\u5978\u81E3\u5982\u66F9\u64CD\u5978\u96C4\u672C\u8272';
      gameModeDesc += '\n\u2022 \u5141\u8BB8\u620F\u5267\u6027\u5DE7\u5408\u2014\u2014\u82F1\u96C4\u6B7B\u91CC\u9003\u751F\u3001\u7EDD\u5883\u9006\u8F6C\u3001\u5929\u610F\u5F04\u4EBA';
      gameModeDesc += '\n\u2022 \u6570\u503C\u6CE2\u52A8\u53EF\u66F4\u5927\u2014\u2014loyalty\u00B120/strength\u00B110\u6BCF\u56DE\u5408\u53EF\u53D1\u751F';
      gameModeDesc += '\n\u2022 \u53D9\u4E8B\u4EFF\u300A\u4E09\u56FD\u6F14\u4E49\u300B\u2014\u2014\u6587\u5B66\u6027\u4F18\u5148\uFF0C\u4EBA\u7269\u5BF9\u8BDD\u53EF\u76F4\u5F15\uFF0C\u6218\u6597\u8BE6\u5199';
      gameModeDesc += '\n\u2022 \u73A9\u5BB6\u6709\u4E3B\u89D2\u5149\u73AF\u2014\u2014\u4E0D\u56E0\u4F4E\u6982\u7387\u968F\u673A\u4E8B\u4EF6\u66B4\u6BD9\uFF08\u91CD\u5927\u51B3\u7B56\u5931\u8BEF\u4ECD\u53EF\u81F4\u6B7B\uFF09';
      gameModeDesc += '\n\u2022 \u5929\u707E/\u5F02\u8C61\u53EF\u4E3A\u5267\u60C5\u670D\u52A1\u2014\u2014\u66B4\u98CE\u96E8\u4E2D\u51B3\u6218\u3001\u5F57\u661F\u9884\u5146\u53DB\u4E71';
      historicalCharLimit = '\n\u5386\u53F2\u4EBA\u7269\u9650\u5236:\u4E2D\u56FD\u53E4\u4EE3\u5168\u90E8\u5386\u53F2\u540D\u81E3\u90FD\u6709\u6982\u7387\u51FA\u73B0\u3002';
    }

    var _promptComposer = (typeof TM !== 'undefined' && TM.PromptComposer) ? TM.PromptComposer : null;
    var sysP = (_promptComposer && typeof _promptComposer.buildBase === 'function')
      ? _promptComposer.buildBase({
          sc: sc,
          P: P,
          gameModeDesc: gameModeDesc,
          historicalCharLimit: historicalCharLimit
        })
      : (P.ai.prompt||"\u4F60\u662F\u5386\u53F2\u6A21\u62DFAI\u3002\u5267\u672C:"+(sc?sc.name:"")+"\u65F6\u4EE3:"+(sc?sc.era:"")+"\u89D2\u8272:"+(sc?sc.role:"")+"\n\u96BE\u5EA6:"+P.conf.difficulty+"\u6587\u98CE:"+P.conf.style+gameModeDesc+historicalCharLimit);

    // [slice 3b.2+3b.4\u00B72026-05-07] \u6D88\u8D39 EndTurnHooks \u6CE8\u518C\u7684 prompt fragments
    // \u6309 position \u62C6 prefix/suffix\u00B7prefix \u6CE8\u5165\u5728 sysP \u524D(\u6E38\u620F\u6A21\u5F0F hook 11 \u7528)\u00B7suffix \u9ED8\u8BA4
    try {
      if (typeof EndTurnHooks !== 'undefined' && EndTurnHooks.collectFragments) {
        var _frags = EndTurnHooks.collectFragments(ctx);
        var _prefixText = '', _suffixText = '';
        for (var _fi = 0; _fi < _frags.length; _fi++) {
          if (_frags[_fi].position === 'prefix') _prefixText += _frags[_fi].text;
          else _suffixText += _frags[_fi].text;
        }
        sysP = _prefixText + sysP + _suffixText;
      }
    } catch(_fragE) { try { console.warn('[prompt.build] collect fragments failed', _fragE); } catch(_){} }

    // 6.2: 叙事风格锁定
    var _narrativeGuide = '';
    var _modeP = (typeof _getModeParams === 'function') ? _getModeParams() : {};
    var _narrativeGuideFromComposer = false;
    if (_promptComposer && typeof _promptComposer.buildNarrativeGuide === 'function') {
      _narrativeGuide = _promptComposer.buildNarrativeGuide(_modeP, P.chronicleConfig);
      _narrativeGuideFromComposer = true;
    }
    if (_narrativeGuideFromComposer) {
      // PromptComposer 已包含 chronicleConfig.styleSample。
    } else if (_modeP.narrativeStyle && _modeP.narrativeStyle.indexOf('\u8D44\u6CBB\u901A\u9274') >= 0) {
      _narrativeGuide = '\n【叙事风格·严格文言】仿《资治通鉴》体例。用词典雅，句式简洁。禁用一切现代词汇（如：OK、搞定、给力、没问题、怎么说、不错、厉害）。对话用"曰""言""谓"引述。';
    } else if (_modeP.narrativeStyle && _modeP.narrativeStyle.indexOf('\u534A\u6587\u8A00') >= 0) {
      _narrativeGuide = '\n【叙事风格·半文言】融合文言与白话。叙事用文言，对话可用浅显白话。禁用网络用语和明显现代词汇。';
    } else {
      _narrativeGuide = '\n【叙事风格·演义体】仿《三国演义》章回体风格。叙事可白话，但保留古典韵味。禁用网络用语。';
    }
    // 编辑器配置的风格范文
    if (!_narrativeGuideFromComposer && P.chronicleConfig && P.chronicleConfig.styleSample) {
      _narrativeGuide += '\n\u3010\u98CE\u683C\u8303\u6587\uFF08\u53C2\u7167\u6B64\u6587\u98CE\uFF09\u3011' + P.chronicleConfig.styleSample;
    }
    sysP += _narrativeGuide;

    // 1.7: 注入编辑器自定义的Prompt前缀
    var _sysPrefix = '';
    if (_promptComposer && typeof _promptComposer.buildSystemPrefix === 'function') {
      _sysPrefix = _promptComposer.buildSystemPrefix(P);
    } else if (P.promptOverrides && P.promptOverrides.systemPrefix) {
      _sysPrefix = P.promptOverrides.systemPrefix;
    }
    if (_sysPrefix) {
      sysP = _sysPrefix + '\n\n' + sysP;
    }

    // ── T2: 时间粒度感知 ──
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var _granLabel = _dpv <= 7 ? '微观（日/周）' : _dpv <= 60 ? '中观（月）' : '宏观（季/年）';
    var _temporalGranularityFromComposer = (_promptComposer && typeof _promptComposer.buildTemporalGranularity === 'function')
      ? _promptComposer.buildTemporalGranularity(_dpv)
      : '';
    if (_temporalGranularityFromComposer) {
      sysP += _temporalGranularityFromComposer;
    } else {
      sysP += '\n\n\u3010\u65F6\u95F4\u7C92\u5EA6\uFF1A\u6BCF\u56DE\u5408' + _dpv + '\u5929\uFF08' + _granLabel + '\u53D9\u4E8B\uFF09\u3011';
      if (_dpv <= 7) {
        sysP += '\n\u53D9\u4E8B\u5982\u201C\u8D77\u5C45\u6CE8\u201D\u2014\u2014\u7CBE\u786E\u5230\u65E5\uFF1A\u201C\u521D\u4E09\u65E5\u5348\u540E\uFF0C\u67D0\u67D0\u4E8E\u5E9C\u4E2D\u5BC6\u4F1A\u2026\u2026\u201D';
        sysP += '\nNPC\u884C\u52A8\u63CF\u8FF0\u5FAE\u89C2\uFF1A\u4E00\u4E2A\u5177\u4F53\u7684\u201C\u6B64\u65F6\u6B64\u523B\u201D\u573A\u666F';
        sysP += '\n\u53D8\u91CF\u53D8\u5316\u5E45\u5EA6\u5C0F\uFF08\u6BCF\u56DE\u5408\u00B11~3\u4E3A\u6B63\u5E38\uFF09';
      } else if (_dpv <= 60) {
        sysP += '\n\u53D9\u4E8B\u5982\u201C\u6708\u62A5\u201D\u2014\u2014\u201C\u672C\u6708\uFF0C\u671D\u5EF7\u63A8\u884CXX\u6539\u9769\u2026\u2026\u201D';
        sysP += '\nNPC\u884C\u52A8\u63CF\u8FF0\u4E2D\u89C2\uFF1A\u6982\u62EC\u4E00\u6BB5\u65F6\u95F4\u5185\u7684\u884C\u4E3A\u8D8B\u52BF';
      } else {
        sysP += '\n\u53D9\u4E8B\u5982\u201C\u7F16\u5E74\u53F2\u201D\u2014\u2014\u9AD8\u5EA6\u6D53\u7F29\uFF1A\u201C\u662F\u5E74\uFF0CXX\u2026\u2026\u53C8XX\u2026\u2026\u201D';
        sysP += '\nNPC\u884C\u52A8\u63CF\u8FF0\u5B8F\u89C2\uFF1A\u4E00\u4E2A\u5B8C\u6574\u7684\u4E8B\u4EF6\u5F27';
        sysP += '\n\u53D8\u91CF\u53D8\u5316\u53EF\u8F83\u5927\uFF08\u4E00\u5E74\u5185\u53D1\u751F\u5F88\u591A\u4E8B\uFF09';
      }
    }
    sysP += '\n\u203BNPC\u884C\u52A8\u6761\u6570\u4E0D\u56E0\u7C92\u5EA6\u53D8\u5316\uFF08\u4FDD\u63015-10\u6761\uFF09\uFF0C\u53EA\u662F\u63CF\u8FF0\u7C92\u5EA6\u4E0D\u540C\u3002';

    // 注入编年史仿写风格（影响AI叙事笔法）
    var _chronicleStyleFromComposer = (_promptComposer && typeof _promptComposer.buildChronicleStyle === 'function')
      ? _promptComposer.buildChronicleStyle(P.chronicleConfig)
      : '';
    if (_chronicleStyleFromComposer) {
      sysP += _chronicleStyleFromComposer;
    } else if (P.chronicleConfig && P.chronicleConfig.style) {
      var _styleNames = {biannian:'编年体(仿《资治通鉴》)',shilu:'实录体(仿各朝实录)',jizhuan:'纪传体(仿《史记》)',jishi:'纪事本末体(仿《通鉴纪事本末》)',biji:'笔记体(仿《世说新语》)',custom:P.chronicleConfig.customStyleDesc||'自定义'};
      sysP += '\n叙事笔法：' + (_styleNames[P.chronicleConfig.style] || P.chronicleConfig.style);
    }
    // ★ 时空约束（防 AI 用未来史实知识·防 NPC 说还活着的人已死）
    if (typeof _buildTemporalConstraint === 'function') {
      try { sysP += _buildTemporalConstraint(null); } catch(e){ if(window.TM&&TM.errors) TM.errors.capture(e,'endturn.buildTemporalConstraint'); }
    }

    // ★ 长期行动摘要（aiDigestLongTermActions 生成·完整长期诏书+编年+旅程）
    try {
      if (Array.isArray(GM._aiWeakWriteHints) && GM._aiWeakWriteHints.length > 0) {
        var _weakHints = GM._aiWeakWriteHints.slice(-5);
        sysP += '\n\n【很弱的自查小纸条·可忽略】';
        sysP += '\n这些不是警告、不是规则、不是事实结论；只是上回合写回时留下的一点点不确定。若与你看到的剧本、当前局面不吻合，请直接忽略。不要为了这些提示强行改剧情或结构化输出；只有当你本来也觉得同一人物、势力或写回项似乎、好像、可能有误时，才轻微参考。正文中不要提及这些提示。';
        _weakHints.forEach(function(h) {
          if (!h) return;
          var _hintName = h.itemName ? '“' + String(h.itemName).slice(0, 40) + '”' : '';
          sysP += '\n  · ' + (h.label || 'writeback') + _hintName + '：似乎/好像/可能有一点不确定，可忽略。';
        });
        GM._aiWeakWriteHints = [];
      }
    } catch(_weakHintE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_weakHintE, 'sysP] weak write hints failed') : console.warn('[sysP] weak write hints failed', _weakHintE); }

    if (GM._longTermDigest && GM._longTermDigest.text) {
      sysP += '\n\n【长期行动与诏书·持续效果·AI 必读必用】\n' + GM._longTermDigest.text;
      sysP += '\n★ 规则：所有长期诏书每回合都必须体现效果·不可忘记。效果可正可负·可前好后坏或反之。在 shizhengji/zhengwen 中体现·在 var_changes 中实化。';
    }

    // ★ 三系统运行时状态（势力 lifePhase·党派 influence/officeCount·军队 mutinyRisk）
    if (TM && TM.EndTurnAIContext && typeof TM.EndTurnAIContext.appendPromptPolicyContext === 'function') {
      sysP = TM.EndTurnAIContext.appendPromptPolicyContext(sysP, {
        GM: GM,
        P: P,
        buildNpcDecisionsForSysP: (typeof buildNpcDecisionsForSysP === 'function') ? buildNpcDecisionsForSysP : null,
        buildEdictEfficacyFollowUp: (typeof buildEdictEfficacyFollowUp === 'function') ? buildEdictEfficacyFollowUp : null,
        buildCharArcsForSysP: (typeof buildCharArcsForSysP === 'function') ? buildCharArcsForSysP : null
      });
    } else {
    try {
      var _tsBlock = '';
      if (Array.isArray(GM.facs) && GM.facs.length > 0) {
        var _facLines = [];
        GM.facs.forEach(function(f) {
          if (!f || !f.name) return;
          var line = '  · ' + f.name + '·阶段' + (f.lifePhase||'stable') + '·实力' + (f.strength||0) + '·合法性' + (f.legitimacy||0) + '·人口' + (f.population||0) + '·民心' + (f.morale||0) + '·稳定' + (f.stability||0);
          if (f._collapsing) line += '·【濒临崩溃】';
          if (f.suzerainFaction) line += '·宗主=' + f.suzerainFaction;
          _facLines.push(line);
        });
        if (_facLines.length) _tsBlock += '\n\n【势力运行时态】\n' + _facLines.join('\n');
      }
      if (GM.partyState && typeof GM.partyState === 'object') {
        var _pLines = [];
        Object.keys(GM.partyState).forEach(function(pn) {
          var ps = GM.partyState[pn]; if (!ps) return;
          _pLines.push('  · ' + pn + '·影响' + ps.influence + '·凝聚' + ps.cohesion + '·占官' + ps.officeCount + '·清誉' + ps.reputationBalance + (ps.recentImpeachWin>0?('·近期弹劾胜'+Math.round(ps.recentImpeachWin)):'') + (ps.recentImpeachLose>0?('·近期弹劾败'+Math.round(ps.recentImpeachLose)):''));
        });
        if (_pLines.length) _tsBlock += '\n\n【党派数值】\n' + _pLines.join('\n');
      }
      if (Array.isArray(GM.armies) && GM.armies.length > 0) {
        var _riskArmies = GM.armies.filter(function(a){ return (a.mutinyRisk||0) >= 50 || (a.supply||100) < 30 || (a.morale||100) < 30 || (a.payArrearsMonths||0) >= 2; });
        if (_riskArmies.length > 0) {
          _tsBlock += '\n\n【军情警报】';
          _riskArmies.slice(0, 8).forEach(function(a) {
            _tsBlock += '\n  · ' + a.name + '·驻' + (a.garrison||'') + (a.state==='marching'?('·赴'+a.destination+'中'):'') + (a.state==='sieging'?'·围城中':'') + '·粮' + (a.supply||0) + '·气' + (a.morale||0) + '·欠饷' + (a.payArrearsMonths||0) + '月·兵变险' + (a.mutinyRisk||0);
          });
        }
      }
      if (_tsBlock) sysP += _tsBlock + '\n★ 推演时必须按上述数值展开·势力 lifePhase 决定基调·党派 influence 决定话语权·军变险 >= 60 必生事件。';
    } catch(_tsIE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_tsIE, 'sysP] 三系统状态注入失败') : console.warn('[sysP] 三系统状态注入失败', _tsIE); }

    // ★ NPC 预规划注入(scThreeSystemsAI 生成·未来 3 回合 NPC 势力/党派/将领行动池)
    try {
      if (typeof buildNpcDecisionsForSysP === 'function') {
        var _npcBlock = buildNpcDecisionsForSysP();
        if (_npcBlock) {
          sysP += _npcBlock + '\n★ NPC 预规划条目·AI 推演时按 rationale 展开·不得背离 NPC 已设定的动机。';
        }
      }
    } catch(_npcIE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_npcIE, 'sysP] NPC 决策注入失败') : console.warn('[sysP] NPC 决策注入失败', _npcIE); }

    // ★ 官员任免铁则+纯文本输出铁则(防两兵尚/HTML 残片污染)
    sysP += '\n\n【★ 官员任免铁则·AI 必遵】';
    sysP += '\n  1. 推演中任何官员升迁/免职/任新职/夺职/调任·必须且只能通过 personnelChanges 数组输出·含 {name, change, fromPost, toPost}';
    sysP += '\n  2. 不得在 shizhengji/zhengwen 中擅自称呼某人为"XX尚书/巡抚/总督/都督"·若该职位在 officeTree 仍由其他 holder 占据(详见 blockD 官制)';
    sysP += '\n  3. 同一官职仅能有一位正职 holder·描述新任时必须同步记录前任离任(换旧+任新·personnelChanges 两条)';
    sysP += '\n  4. 若玩家未颁任免诏令·AI 不得自行创造新任命(除非有明确前置条件如空缺/死亡)';
    sysP += '\n  5. 若擅自任命而未通过 personnelChanges 同步·视为推演谬误';

    sysP += '\n\n【★ 输出纯文本铁则】';
    sysP += '\n  · 所有输出字段(shizhengji/zhengwen/narrative/content)必须为纯中文·不得含 <HTML 标签>、"onclick"、"javascript:"、\'"\', event)"\'、URL 等任何代码/标记';
    sysP += '\n  · 遇到本提示中的参考字符串含 HTML·原样输出时必须剥除 HTML 只保留中文';
    sysP += '\n  · 不允许在叙事中使用 Markdown 链接 [text](url)';

    // ★ 御批回听·上回合未落实诏令注入·AI 必须补偿或明确拒绝
    try {
      if (typeof buildEdictEfficacyFollowUp === 'function') {
        var _efBlock = buildEdictEfficacyFollowUp();
        if (_efBlock) sysP += _efBlock;
      }
    } catch(_efIE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_efIE, 'sysP] 御批回听注入失败') : console.warn('[sysP] 御批回听注入失败', _efIE); }

    // ★ 人物情节弧·后台推进的 NPC 心路·让 AI 按弧线演 NPC
    try {
      if (typeof buildCharArcsForSysP === 'function') {
        var _arcBlock = buildCharArcsForSysP();
        if (_arcBlock) sysP += _arcBlock;
      }
    } catch(_arcIE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_arcIE, 'sysP] 情节弧注入失败') : console.warn('[sysP] 情节弧注入失败', _arcIE); }

    // 注入·启动预演规划（aiPlanScenarioForInference 生成·轻量版·提升推演稳定性）
    if (GM._aiInferencePlan && GM._aiInferencePlan.generatedAt) {
      var _pl = GM._aiInferencePlan;
      if (_pl.npcHiddenAgenda && Object.keys(_pl.npcHiddenAgenda).length > 0) {
        sysP += '\n\n【NPC 隐藏议程】（AI 推演 NPC 行为时必须参考·而非按官职教条推理）';
        Object.keys(_pl.npcHiddenAgenda).forEach(function(n) {
          sysP += '\n  · ' + n + '：' + String(_pl.npcHiddenAgenda[n]).slice(0, 120);
        });
      }
      if (Array.isArray(_pl.crisisBranches) && _pl.crisisBranches.length) {
        sysP += '\n\n【危机分岔 · 剧本可能走向】（勿一次演完所有·按玩家实际诏令择路展开）';
        _pl.crisisBranches.forEach(function(b) { sysP += '\n  · ' + String(b).slice(0, 150); });
      }
      if (Array.isArray(_pl.tippingPoints) && _pl.tippingPoints.length) {
        sysP += '\n\n【不可逆临界点】';
        _pl.tippingPoints.forEach(function(t) { sysP += '\n  · ' + String(t).slice(0, 120); });
      }
      if (_pl.narrativeTone) {
        var _nt = _pl.narrativeTone;
        if (_nt.sentenceStyle) sysP += '\n\n【行文指纹·句式】' + String(_nt.sentenceStyle).slice(0, 80);
        if (Array.isArray(_nt.vocabulary) && _nt.vocabulary.length) sysP += '\n【典型词汇】' + _nt.vocabulary.slice(0, 8).join('·');
        if (_nt.pacing) sysP += '\n【节奏】' + String(_nt.pacing).slice(0, 80);
      }
      // 首回合·注入 NPC 首回合候选反应（仅 Turn 1-2 时用·之后信息过时）
      if (GM.turn <= 2 && _pl.npcFirstTurnReaction && Object.keys(_pl.npcFirstTurnReaction).length > 0) {
        sysP += '\n\n【首回合 NPC 候选反应·参考】';
        Object.keys(_pl.npcFirstTurnReaction).slice(0, 15).forEach(function(n) {
          sysP += '\n  · ' + n + '：' + String(_pl.npcFirstTurnReaction[n]).slice(0, 80);
        });
      }
    }
    // 注入·势力关系矩阵（aiPlanFactionMatrix 生成·每回合参考）
    if (GM._aiFactionMatrix && GM._aiFactionMatrix.generatedAt) {
      var _fm = GM._aiFactionMatrix;
      if (Array.isArray(_fm.factionMatrix) && _fm.factionMatrix.length > 0) {
        sysP += '\n\n【势力关系矩阵·AI 必须按此演绎势力互动·不得凭空突变】';
        _fm.factionMatrix.slice(0, 10).forEach(function(m) {
          if (!m || !m.facA || !m.facB) return;
          sysP += '\n  · ' + m.facA + '↔' + m.facB + '：' + (m.currentRelation || '') + '·10 回合走向：' + String(m.trajectoryNext10Turns || '').slice(0, 100);
          if (Array.isArray(m.triggersToEscalate) && m.triggersToEscalate.length) {
            sysP += '·升级条件：' + m.triggersToEscalate.slice(0, 2).join('/');
          }
          if (Array.isArray(m.triggersToReconcile) && m.triggersToReconcile.length) {
            sysP += '·和解条件：' + m.triggersToReconcile.slice(0, 2).join('/');
          }
        });
      }
      if (Array.isArray(_fm.alliancePotentials) && _fm.alliancePotentials.length > 0) {
        sysP += '\n【结盟潜力】' + _fm.alliancePotentials.slice(0, 4).join(' | ');
      }
      if (Array.isArray(_fm.strategicTriangles) && _fm.strategicTriangles.length > 0) {
        sysP += '\n【三角博弈】' + _fm.strategicTriangles.slice(0, 3).join(' | ');
      }
      if (GM.turn <= 5 && Array.isArray(_fm.blackSwans) && _fm.blackSwans.length > 0) {
        sysP += '\n【势力黑天鹅·前 5 回合参考】' + _fm.blackSwans.slice(0, 5).join(' | ');
      }
    }
    // 注入·首回合候选事件（仅 Turn 1-3 时·未触发的）
    }

    if (GM.turn <= 3 && Array.isArray(GM._candidateEvents) && GM._candidateEvents.length > 0) {
      var _unfired = GM._candidateEvents.filter(function(e) { return e && !e._fired; });
      if (_unfired.length > 0) {
        sysP += '\n\n【首 3 回合候选事件池·AI 推演时可择机触发（优先于凭空生成新事件）】';
        _unfired.slice(0, 8).forEach(function(ev) {
          sysP += '\n  · [' + ev.id + '] ' + ev.title + '·由 ' + ev.presenter + ' 发起·触发条件：' + ev.triggerCondition + '·内容：' + String(ev.payload).slice(0, 100);
        });
        if (GM._candidateEventMeta && GM._candidateEventMeta.sequencing) {
          sysP += '\n  建议顺序：' + GM._candidateEventMeta.sequencing;
        }
        if (GM._candidateEventMeta && GM._candidateEventMeta.branchingLogic) {
          sysP += '\n  分支逻辑：' + GM._candidateEventMeta.branchingLogic;
        }
      }
    }

    // 注入·剧本 events 含玩家选项 (playerChoices)·LLM 在 narrative surface·让玩家通过诏令应对·非 modal click
    try {
      if (Array.isArray(P.events) && P.events.length > 0) {
        var _evtsWithChoices = P.events.filter(function(e) { return e && Array.isArray(e.playerChoices) && e.playerChoices.length > 0; });
        if (_evtsWithChoices.length > 0) {
          sysP += '\n\n【剧本 events·含玩家选项 (playerChoices) ' + _evtsWithChoices.length + ' 项】AI 推演时·若 event 触发条件满足·**在 shizhengji/zhengwen 中描述选项**（如"陛下面前两策·李纲奏 X·汪伯彦奏 Y"·或臣下分头进言两 / 三种策略）·**让玩家通过下次诏令应对**·★ 不可 LLM 自代选·须 surface 给玩家。';
          _evtsWithChoices.slice(0, 8).forEach(function(ev) {
            sysP += '\n\n  ◆ [' + (ev.id || '?') + '] ' + (ev.name || '?') + (ev.type ? ' (' + ev.type + ')' : '');
            if (ev.trigger) sysP += '\n    触发·' + String(ev.trigger).slice(0, 100);
            if (ev.description) sysP += '\n    背景·' + String(ev.description).slice(0, 150);
            sysP += '\n    选项·';
            ev.playerChoices.slice(0, 5).forEach(function(c, i) {
              sysP += '\n      ' + (i+1) + '. ' + (c.label || '?') + (c.consequence ? ' → ' + String(c.consequence).slice(0, 80) : '');
            });
          });
        }
      }
    } catch(_pceIE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_pceIE, 'sysP] events.playerChoices 注入失败') : console.warn('[sysP] events.playerChoices 注入失败', _pceIE); }

    // 注入AI深度阅读摘要（10轮预热结果——极高密度剧本理解）
    if (GM._aiScenarioDigest && GM._aiScenarioDigest.masterDigest) {
      var _d = GM._aiScenarioDigest;
      // 永久注入：核心摘要（每回合都有）
      sysP += '\n\n\u3010\u5267\u672C\u7EC8\u6781\u7406\u89E3\u3011' + _d.masterDigest;
      if (_d.worldAtmosphere) sysP += '\n\u4E16\u754C\u6C1B\u56F4\uFF1A' + _d.worldAtmosphere;
      if (_d.narrativeStyle) sysP += '\n\u53D9\u4E8B\u98CE\u683C\uFF1A' + _d.narrativeStyle;
      if (_d.worldRules) sysP += '\n\u4E16\u754C\u89C4\u5219\uFF1A' + _d.worldRules;
      if (_d.characterWeb) sysP += '\n\u89D2\u8272\u5173\u7CFB\u7F51\uFF1A' + _d.characterWeb;
      if (_d.factionBalance) sysP += '\n\u52BF\u529B\u6001\u52BF\uFF1A' + _d.factionBalance;
      // 官制相关摘要——检测是否过期（玩家可能已改革官制）
      var _govStale = GM._officeTreeHash && GM._officeTreeHash !== _computeOfficeHash();
      if (_d.powerNetwork && !_govStale) sysP += '\n\u6743\u529B\u7F51\u7EDC\uFF1A' + _d.powerNetwork;
      else if (_govStale) sysP += '\n（官制已改革，权力网络已重构——以tp中【官制职能分工】为准）';

      // P8: 深度阅读成果持续利用（渐退但不完全消失）
      if (GM.turn <= 10) {
        // 前10回合：完整注入
        if (_d.characterProfiles) sysP += '\n\u89D2\u8272\u5185\u5FC3\uFF1A' + _d.characterProfiles;
        if (_d.dangerousFigures) sysP += '\n\u5371\u9669\u4EBA\u7269\uFF1A' + _d.dangerousFigures;
        if (_d.betrayalRisks) sysP += '\n\u80CC\u53DB\u98CE\u9669\uFF1A' + _d.betrayalRisks;
        if (_d.emotionalTriggers) sysP += '\n\u60C5\u611F\u89E6\u53D1\uFF1A' + _d.emotionalTriggers;
        if (_d.narrativeArcs) sysP += '\n\u53D9\u4E8B\u5F27\u7EBF\uFF1A' + _d.narrativeArcs;
        if (_d.chainReactions) sysP += '\n\u8FDE\u9501\u53CD\u5E94\uFF1A' + _d.chainReactions;
      } else {
        // 10回合后：关键字段压缩注入（不完全消失）
        if (_d.dangerousFigures) sysP += '\n\u5371\u9669\u4EBA\u7269(\u521D\u59CB\u5206\u6790)\uFF1A' + _d.dangerousFigures.substring(0, 100);
        if (_d.emotionalTriggers) sysP += '\n\u60C5\u611F\u89E6\u53D1(\u521D\u59CB\u5206\u6790)\uFF1A' + _d.emotionalTriggers.substring(0, 100);
        if (_d.tippingPoints) sysP += '\n\u5386\u53F2\u8F6C\u6298\u70B9\uFF1A' + _d.tippingPoints.substring(0, 100);
      }

      // 前7回合：战略信息
      if (GM.turn <= 7) {
        if (_d.partyStruggle) sysP += '\n\u515A\u4E89\u7126\u70B9\uFF1A' + _d.partyStruggle;
        if (_d.warScenarios) sysP += '\n\u6218\u4E89\u98CE\u9669\uFF1A' + _d.warScenarios;
        if (_d.crisisForecast) sysP += '\n\u5371\u673A\u9884\u6D4B\uFF1A' + _d.crisisForecast;
        if (_d.territorialStrategy) sysP += '\n\u9886\u571F\u6218\u7565\uFF1A' + _d.territorialStrategy;
        if (_d.governanceReform) sysP += '\n\u6CBB\u7406\u6539\u9769\uFF1A' + _d.governanceReform;
        if (_d.militaryReform) sysP += '\n\u519B\u4E8B\u6539\u9769\uFF1A' + _d.militaryReform;
        if (_d.diplomaticLandscape) sysP += '\n\u5916\u4EA4\u683C\u5C40\uFF1A' + _d.diplomaticLandscape;
        if (_d.riskMatrix) sysP += '\n\u98CE\u9669\u77E9\u9635\uFF1A' + _d.riskMatrix;
        if (_d.reformAgenda) sysP += '\n\u6539\u9769\u8BAE\u7A0B\uFF1A' + _d.reformAgenda;
        if (_d.successionPolitics) sysP += '\n\u7EE7\u627F\u653F\u6CBB\uFF1A' + _d.successionPolitics;
      }

      // 前5回合：推演计划+条件分支
      if (GM.turn <= 5) {
        if (_d.firstTurnPlan) sysP += '\n\u63A8\u6F14\u8BA1\u5212\uFF1A' + _d.firstTurnPlan;
        if (_d.npcBehaviors) sysP += '\nNPC\u884C\u4E3A\u65F6\u95F4\u7EBF\uFF1A' + _d.npcBehaviors;
        if (_d.allianceOpportunities) sysP += '\n\u8054\u76DF\u673A\u4F1A\uFF1A' + _d.allianceOpportunities;
        if (_d.relationshipTensions) sysP += '\n\u5173\u7CFB\u7D27\u5F20\u70B9\uFF1A' + _d.relationshipTensions;
        // 条件分支（不是固定脚本，是响应式推演指南）
        if (_d.worldBranches) sysP += '\n\u3010\u4E16\u754C\u8D70\u5411\u5206\u652F\u3011' + _d.worldBranches;
        if (_d.npcReactionMatrix) sysP += '\nNPC\u53CD\u5E94\u77E9\u9635\uFF1A' + _d.npcReactionMatrix;
        if (_d.npcDecisionLogic) sysP += '\nNPC\u51B3\u7B56\u903B\u8F91\uFF1A' + _d.npcDecisionLogic;
        if (_d.secretAgendas) sysP += '\nNPC\u79D8\u5BC6\u8BAE\u7A0B\uFF1A' + _d.secretAgendas;
        if (_d.loyaltyBreakingPoints) sysP += '\n\u5FE0\u8BDA\u65AD\u88C2\u70B9\uFF1A' + _d.loyaltyBreakingPoints;
        if (_d.crisisTriggers) sysP += '\n\u5371\u673A\u89E6\u53D1\u6761\u4EF6\uFF1A' + _d.crisisTriggers;
        if (_d.opportunityWindows) sysP += '\n\u673A\u4F1A\u7A97\u53E3\uFF1A' + _d.opportunityWindows;
      }

      // 永久注入：史料知识底座（指导文风、称谓、礼仪、细节准确性）
      if (_d.etiquetteNorms) sysP += '\n\u3010\u793C\u4EEA\u89C4\u8303\u3011' + _d.etiquetteNorms;
      if (_d.periodVocabulary) sysP += '\n\u3010\u65F6\u4EE3\u7528\u8BED\u3011' + _d.periodVocabulary;
      if (_d.sensoryDetails) sysP += '\n\u3010\u611F\u5B98\u7EC6\u8282\u3011' + _d.sensoryDetails;
      if (_d.literaryReferences) sysP += '\n\u3010\u6587\u5B66\u5178\u6545\u3011' + _d.literaryReferences;
      if (_d.famousDialogues) sysP += '\n\u3010\u540D\u53E5\u5316\u7528\u3011' + _d.famousDialogues;
      // 称谓系统（永久注入——确保每个角色称呼正确）
      if (_d.imperialAddress) sysP += '\n\u3010\u5E1D\u738B\u79F0\u8C13\u3011' + _d.imperialAddress;
      if (_d.officialAddress) sysP += '\n\u3010\u5B98\u573A\u79F0\u547C\u3011' + _d.officialAddress;
      if (_d.writtenStyle) sysP += '\n\u3010\u516C\u6587\u884C\u6587\u3011' + _d.writtenStyle;
      if (_d.tabooWords) sysP += '\n\u3010\u907F\u8BB3\u5236\u5EA6\u3011' + _d.tabooWords;
      if (_d.commonExpressions) sysP += '\n\u3010\u65E5\u5E38\u53E3\u8BED\u3011' + _d.commonExpressions;
      // 朝会和礼仪（永久注入——确保政治场景准确）
      if (_d.courtEtiquette) sysP += '\n\u3010\u4E0A\u671D\u793C\u4EEA\u3011' + _d.courtEtiquette;
      if (_d.courtProcedure) sysP += '\n\u3010\u671D\u4F1A\u5236\u5EA6\u3011' + _d.courtProcedure;

      // 前15回合：质询补充（防止分析盲点）
      if (GM.turn <= 15) {
        if (_d.deeperMotives) sysP += '\n\u88AB\u5FFD\u89C6\u7684\u52A8\u673A\uFF1A' + _d.deeperMotives;
        if (_d.wildcardCharacters) sysP += '\n\u53D8\u6570\u4EBA\u7269\uFF1A' + _d.wildcardCharacters;
        if (_d.strategicBlindSpots) sysP += '\n\u6218\u7565\u76F2\u70B9\uFF1A' + _d.strategicBlindSpots;
        if (_d.dramaticIrony) sysP += '\n\u620F\u5267\u53CD\u8BD7\uFF1A' + _d.dramaticIrony;
        if (_d.socialUndercurrents) sysP += '\n\u793E\u4F1A\u6697\u6D41\uFF1A' + _d.socialUndercurrents;
        if (_d.macroTrajectory) sysP += '\n\u5B8F\u89C2\u8D70\u5411\uFF1A' + _d.macroTrajectory;
        if (_d.tippingPoints) sysP += '\n\u4E34\u754C\u70B9\uFF1A' + _d.tippingPoints;
      }

      // 前20回合：节奏+史料+世界规律
      if (GM.turn <= 20) {
        if (_d.pacingAdvice) sysP += '\n\u8282\u594F\u6307\u5BFC\uFF1A' + _d.pacingAdvice;
        if (_d.historicalParallels) sysP += '\n\u5386\u53F2\u5E73\u884C\uFF1A' + _d.historicalParallels;
        if (_d.butterflyEffects) sysP += '\n\u8774\u8776\u6548\u5E94\uFF1A' + _d.butterflyEffects;
        if (_d.decayPatterns) sysP += '\n\u8870\u4EA1\u6A21\u5F0F\uFF1A' + _d.decayPatterns;
        if (_d.tippingPoints) sysP += '\n\u4E34\u754C\u70B9\uFF1A' + _d.tippingPoints;
        if (_d.realPoliticalEvents) sysP += '\n\u53F2\u6599\u653F\u6CBB\uFF1A' + _d.realPoliticalEvents;
        if (_d.realMilitaryEvents) sysP += '\n\u53F2\u6599\u519B\u4E8B\uFF1A' + _d.realMilitaryEvents;
        if (_d.historicalTurningPoints) sysP += '\n\u5386\u53F2\u8F6C\u6298\uFF1A' + _d.historicalTurningPoints;
        if (_d.seasonalCustoms) sysP += '\n\u8282\u4EE4\u98CE\u4FD7\uFF1A' + _d.seasonalCustoms;
        if (_d.legalSystem) sysP += '\n\u6CD5\u5F8B\u5236\u5EA6\uFF1A' + _d.legalSystem;
        if (_d.taxSystem) sysP += '\n\u8D4B\u7A0E\u5236\u5EA6\uFF1A' + _d.taxSystem;
        if (_d.militarySystemDetail) sysP += '\n\u5175\u5236\u8BE6\u60C5\uFF1A' + _d.militarySystemDetail;
        if (_d.folkCustoms) sysP += '\n\u6C11\u95F4\u98CE\u4FD7\uFF1A' + _d.folkCustoms;
        if (_d.foodCulture) sysP += '\n\u996E\u98DF\u6587\u5316\uFF1A' + _d.foodCulture;
        if (_d.clothingNorms) sysP += '\n\u670D\u9970\u89C4\u8303\uFF1A' + _d.clothingNorms;
        if (_d.militaryRituals) sysP += '\n\u519B\u4E8B\u793C\u4EEA\uFF1A' + _d.militaryRituals;
        if (_d.religiousCeremonies) sysP += '\n\u796D\u7940\u793C\u4EEA\uFF1A' + _d.religiousCeremonies;
        if (_d.diplomaticProtocol) sysP += '\n\u5916\u4EA4\u793C\u8282\uFF1A' + _d.diplomaticProtocol;
        if (_d.familyAddress) sysP += '\n\u5BB6\u65CF\u79F0\u8C13\uFF1A' + _d.familyAddress;
      }
    }

    // 7.4: 历史索引目录——AI可按需请求详细历史
    if (typeof HistoryIndex !== 'undefined') {
      var _histSummary = HistoryIndex.getSummaryForAI();
      if (_histSummary) {
        sysP += '\n\n\u3010\u5386\u53F2\u4E8B\u4EF6\u7D22\u5F15\uFF08\u5404\u4E3B\u9898\u7D2F\u8BA1\u4E8B\u4EF6\u6570\u53CA\u8FD1\u671F\u6458\u8981\uFF09\u3011\n' + _histSummary;
        sysP += '\n\u5386\u53F2\u5168\u91CF\u6570\u636E\u5DF2\u4FDD\u7559\uFF0CAI\u53D9\u4E8B\u65F6\u5E94\u53C2\u8003\u5386\u53F2\u8109\u7EDC\u4FDD\u6301\u8FDE\u8D2F\u3002';
      }
    }

    sysP += '\n\u53D9\u4E8B\u54F2\u5B66\uFF1A\u5FE0\u8A00\u9006\u8033\uFF0C\u4F73\u8BDD\u60A6\u5FC3\u3002\u5FE0\u81E3\u7684\u8BDD\u867D\u7136\u6B63\u786E\u4F46\u8BF7\u5199\u5F97\u8BA9\u4EBA\u89C9\u5F97\u70E6\u8E81\u548C\u7D2F\uFF0C\u4F5E\u81E3\u7684\u8BDD\u867D\u7136\u7A7A\u6D1E\u4F46\u8BF7\u5199\u5F97\u8BA9\u4EBA\u89C9\u5F97\u8212\u670D\u548C\u5F00\u5FC3\u3002\u8FD9\u662F\u7406\u89E3\u5386\u53F2\u7684\u6838\u5FC3\u3002';
    // 注入玩家角色详情（双重身份：私人+政治）
    if (P.playerInfo) {
      var pi = P.playerInfo;
      if (pi.characterName) {
        // 查找玩家角色的GM数据
        var _playerCh = GM.chars ? GM.chars.find(function(c) { return c.name === pi.characterName; }) : null;
        sysP += '\n【主角·双重身份】';
        // D1: 优先使用 playerInfo 中的头衔和势力信息
        var _pTitle = pi.characterTitle || (sc ? sc.role || '' : '');
        var _pRoleLabel = '';
        if (pi.playerRole) {
          var _roleMap = {emperor:'一国之君',regent:'摄政权臣',general:'军中将领',minister:'朝中重臣',prince:'一方诸侯',merchant:'商贾平民'};
          _pRoleLabel = _roleMap[pi.playerRole] || pi.playerRoleCustom || '';
        }
        sysP += '\n  政治身份：' + _pTitle + '，' + (pi.factionName ? pi.factionName + (_pRoleLabel ? '·' + _pRoleLabel : '之主') : _pRoleLabel || '一国之君');
        // D2: 注入势力详细信息
        if (pi.factionTerritory) sysP += '，控制' + pi.factionTerritory;
        if (pi.factionStrength) sysP += '，实力' + pi.factionStrength;
        sysP += '\n  私人身份：' + pi.characterName + (pi.characterAge ? '，' + pi.characterAge + '岁' : '');
        if (pi.characterPersonality) sysP += '\uFF0C\u6027\u683C' + pi.characterPersonality;
        if (_playerCh) {
          if (_playerCh.stress && _playerCh.stress > 30) sysP += '，压力' + _playerCh.stress;
          if (_playerCh._mood && _playerCh._mood !== '平') {
            var _pmMap = {'喜':'心情不错','怒':'正在愤怒','忧':'忧心忡忡','惧':'心存恐惧','恨':'满怀怨恨','敬':'心怀敬意'};
            sysP += '，' + (_pmMap[_playerCh._mood] || '');
          }
        }
        if (pi.characterBio) sysP += '\u3002' + pi.characterBio;
        var _regentSignal = null;
        try {
          if (TM && TM.InfluenceGroups && typeof TM.InfluenceGroups.buildRegentSignal === 'function') {
            _regentSignal = TM.InfluenceGroups.buildRegentSignal(GM);
            GM.regentSignal = _regentSignal;
            GM.regentState = GM.regentState || {};
            GM.regentState.signal = _regentSignal;
            GM.regentState.active = !!(_regentSignal && _regentSignal.active);
            GM.regentState.hardCeiling = !!(_regentSignal && _regentSignal.hardCeiling);
            GM.regentState.lastCheckTurn = GM.turn || 0;
          }
        } catch(_regentSignalE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_regentSignalE, 'endturn] regent signal build failed') : console.warn('[endturn] regent signal build failed', _regentSignalE); }
        if (_regentSignal && _regentSignal.active) {
          sysP += '\n\u300c\u6444\u653f\u4fe1\u53f7\u300d\uff1a' + (_regentSignal.rulerName || '\u672a\u77e5\u541b\u4e3b');
          if (_regentSignal.rulerTitle) sysP += ' / ' + _regentSignal.rulerTitle;
          if (_regentSignal.rulerAge !== null && _regentSignal.rulerAge !== undefined) sysP += ' / \u5e74\u9f84' + _regentSignal.rulerAge;
          if (_regentSignal.rulerHealth !== null && _regentSignal.rulerHealth !== undefined) sysP += ' / \u5065\u5eb7' + _regentSignal.rulerHealth;
          if (_regentSignal.reasons && _regentSignal.reasons.length > 0) sysP += ' / \u89e6\u53d1:' + _regentSignal.reasons.join('\u3001');
          if (_regentSignal.hardCeiling) {
            sysP += '\n  \u26a0 \u8fd9\u662f hard ceiling\uff0c\u4e0d\u5141\u8bb8\u53ea\u5199\u53d9\u4e8b\u3002\u5fc5\u987b\u5728 regent_decisions \u4e2d\u7ed9\u51fa\u660e\u786e\u51b3\u65ad\u3002';
          } else {
            sysP += '\n  \u8bf7\u5728 regent_decisions \u4e2d\u7ed9\u51fa\u5904\u7406\u65b9\u6848\u3002';
          }
        }
        if (Array.isArray(GM._ccHeldItems) && GM._ccHeldItems.length > 0) {
          sysP += '\n\u3010\u7559\u4e2d\u8bae\u9898\u00b7\u53ef\u5efa\u8bae\u518d\u8bae\u3011';
          GM._ccHeldItems.slice(0, 5).forEach(function(it, i) {
            if (!it || it.finalBlocked) return;
            var ht = (typeof it === 'string') ? it : (typeof it.topic === 'string' ? it.topic : (it.topic && it.topic.topic) || '');
            sysP += '\n  ' + (i + 1) + '. ' + ht + '\u00b7\u963b\u6320\u8005:' + (it.blockedBy || '\u53cd\u5bf9\u65b9') + '\u00b7\u7559\u4e2d' + Math.max(0, (GM.turn || 0) - (it.turn || GM.turn || 0)) + '\u56de\u5408';
          });
          sysP += '\n  \u53ef\u9009: reissue_topics:[{topic, reason}]\u3002\u82e5\u5f62\u52bf\u5df2\u53d8\uff0c\u53ef\u5efa\u8bae\u8d77\u590d\u518d\u8bae\uff1b\u4e0d\u8981\u53cd\u590d\u63a8\u8350\u5df2 finalBlocked \u7684\u8bae\u9898\u3002';
        }
        if (pi.characterAppearance) sysP += '\n  \u5916\u8C8C\uFF1A' + pi.characterAppearance;
        if (pi.factionGoal) sysP += '\n  \u6218\u7565\u76EE\u6807\uFF1A' + pi.factionGoal;
        // 玩家角色的私人关系网（家人、故交、仇敌）
        if (_playerCh) {
          var _privRels = [];
          if (typeof AffinityMap !== 'undefined') {
            var _pRels = AffinityMap.getRelations(pi.characterName);
            _pRels.forEach(function(r) {
              if (r.value >= 30) _privRels.push(r.name + '(亲近)');
              else if (r.value <= -30) _privRels.push(r.name + '(嫌隙)');
            });
          }
          if (_privRels.length > 0) sysP += '\n  私人关系：' + _privRels.join('、');
          // 玩家记忆中的私人情感
          if (typeof NpcMemorySystem !== 'undefined') {
            var _pMem = NpcMemorySystem.getMemoryContext(pi.characterName);
            if (_pMem) sysP += '\n  \u8FD1\u671F\u5FC3\u7EEA\uFF1A' + _pMem;
          }
        }
        // 后宫/妻室信息注入系统提示（动态位分名称）
        if (GM.chars) {
          var _sysSpouses = GM.chars.filter(function(c) { return c.alive !== false && c.spouse; });
          if (_sysSpouses.length > 0) {
            // 按位分排序
            _sysSpouses.sort(function(a,b){
              var la = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(a.spouseRank) : 9;
              var lb = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(b.spouseRank) : 9;
              return la - lb;
            });
            sysP += '\n  \u540E\u5BAE\uFF1A';
            _sysSpouses.forEach(function(sp) {
              var rkName = typeof getHaremRankName === 'function' ? getHaremRankName(sp.spouseRank) : (sp.spouseRank || '\u5983');
              sysP += sp.name + '(' + rkName;
              if (sp.favor !== undefined) sysP += ' \u5BA0' + sp.favor;
              sysP += ')';
              if (sp.motherClan) sysP += '\u6BCD\u65CF' + sp.motherClan;
              if (sp.children && sp.children.length > 0) sysP += '\u2192\u5B50' + sp.children.join(',');
              sysP += '\uFF1B';
            });
            // 补充后宫制度信息
            if (GM.harem) {
              if (GM.harem.succession) sysP += '\n  \u7EE7\u627F\u5236\u5EA6:' + GM.harem.succession;
              if (GM.harem.successionNote) sysP += '(' + GM.harem.successionNote + ')';
              if (GM.harem.haremDescription) sysP += '\n  \u540E\u5BAE\u8BF4\u660E:' + String(GM.harem.haremDescription);
              if (GM.harem.motherClanSystem) sysP += '\n  \u6BCD\u65CF\u5236\u5EA6:' + String(GM.harem.motherClanSystem);
            }
            if (GM.harem && GM.harem.pregnancies && GM.harem.pregnancies.length > 0) {
              sysP += '\n  \u6709\u5B55:' + GM.harem.pregnancies.map(function(p) { return p.mother; }).join('\u3001');
            }
          }
        }
        sysP += '\n  \u203B player_status\u53EA\u5199\u653F\u6CBB\u683C\u5C40\uFF1Bplayer_inner\u5199\u89D2\u8272\u5185\u5FC3\u2014\u2014\u7528\u7B2C\u4E00\u4EBA\u79F0\uFF0C\u4F53\u73B0\u79C1\u4EBA\u60C5\u611F\u548C\u6027\u683C\u3002';
        sysP += '\n  \u516C\u52A1\u51B3\u7B56\u53EF\u80FD\u8FDD\u80CC\u4E2A\u4EBA\u610F\u613F\uFF08\u5982\u4E0D\u5F97\u4E0D\u6740\u4EB2\u4FE1\uFF09\uFF0C\u79C1\u4EBA\u60C5\u611F\u53EF\u80FD\u6697\u4E2D\u5F71\u54CD\u653F\u6CBB\u5224\u65AD\uFF08\u5982\u504F\u889B\u5BA0\u81E3\uFF09\u3002';
        sysP += '\n  \u4E3B\u89D2\u7684\u3010\u884C\u6B62\u3011\u662F\u89D2\u8272\u4E2A\u4EBA\u7684\u4E3E\u52A8\uFF08\u4E0E\u8BCF\u4E66\u4E92\u8865\uFF1A\u8BCF\u4E66=\u5143\u9996\u53D1\u4EE4\uFF0C\u884C\u6B62=\u4E2A\u4EBA\u884C\u52A8\uFF09\u3002\u884C\u6B62\u5185\u5BB9\u53EF\u80FD\u5305\u62EC\u53EC\u89C1\u3001\u5DE1\u89C6\u3001\u5B74\u8BF7\u3001\u591C\u8BFB\u3001\u5FAE\u670D\u7B49\uFF0CAI\u6839\u636E\u5177\u4F53\u60C5\u5883\u5224\u65AD\u54EA\u4E9BNPC\u4F1A\u77E5\u60C5\u3002';
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  NPC↔NPC 交互指令（核心升级：世界不围绕玩家旋转）
    // ══════════════════════════════════════════════════════════════
    sysP += '\n\n【NPC之间的自主交互——极其重要】';
    sysP += '\n世界不是"玩家 vs 所有NPC"的单一结构。NPC之间有自己的恩怨、合作、竞争、阴谋。';
    sysP += '\n每回合的npc_actions中，至少一半应该是NPC对NPC的行为（而非NPC对玩家的行为）：';
    sysP += '\n\n■ 朝堂政治（NPC↔NPC）：';
    sysP += '\n  - 权臣A弹劾(investigate)对手B → B反击举报A贪腐 → C趁乱渔利';
    sysP += '\n  - 老臣A提携(mentor)后辈B → B成为A的政治盟友 → 对立派C警惕';
    sysP += '\n  - 宰相与将军的权力争夺 / 文官集团vs宦官集团 / 外戚vs世家';
    sysP += '\n  - 科举同年互相帮衬 / 同乡官员结成地域派系';
    sysP += '\n■ 军事博弈（NPC↔NPC）：';
    sysP += '\n  - 将军A与将军B争夺统兵权 / 边将互相推诿责任';
    sysP += '\n  - 地方军阀暗中扩充实力 / 禁军将领排挤边将';
    sysP += '\n■ 经济暗战（NPC↔NPC）：';
    sysP += '\n  - 大族A与大族B争夺盐铁专营 / 商人贿赂官员排挤竞争对手';
    sysP += '\n  - 地方豪强兼并土地 / 官商勾结损害百姓';
    sysP += '\n■ 私人恩怨（NPC↔NPC）：';
    sysP += '\n  - 仇人暗中报复 / 恩人之子落难被救助 / 情敌争风吃醋';
    sysP += '\n  - 师徒反目 / 兄弟阋墙 / 老友重逢';
    sysP += '\n\n在affinity_changes中体现NPC之间关系的变动。在npc_actions中target应经常是其他NPC而非玩家。';

    // ── 势力自治指令（全方位升级）──
    if (GM.facs && GM.facs.length > 1) {
      sysP += '\n\n■■■ 势力作为"活的国家"——三层决策模拟 ■■■';
      sysP += '\n\n每个非玩家势力不是背景板，而是像一个独立玩家在经营自己的国家。';
      sysP += '\n推演每个势力时，你必须模拟其决策层的三层思考：';
      sysP += '\n';
      sysP += '\n【战略层】这个势力的长期目标是什么？（参考faction.goal）';
      sysP += '\n  - 强势力：统一天下/称霸一方/维持霸权';
      sysP += '\n  - 中等势力：自保/扩张/结盟/左右逢源';
      sysP += '\n  - 弱势力：生存/纳贡/暗中积蓄/寻找靠山';
      sysP += '\n  - 内部不稳的势力：先安内再攘外/或转移内部矛盾于外战';
      sysP += '\n';
      sysP += '\n【策略层】本回合的重点方向？（外交/内政/军事三选一或二）';
      sysP += '\n  - 刚经历战争→重点内政（休养生息、重建、安抚）';
      sysP += '\n  - 刚完成改革→重点军事（趁国力上升扩张）';
      sysP += '\n  - 周边紧张→重点外交（结盟/和谈/挑拨）';
      sysP += '\n  - 首领新立→重点内政（巩固权位、清除异己、施恩收买）';
      sysP += '\n';
      sysP += '\n【战术层】具体做什么？→ 输出为faction_events';
      sysP += '\n';
      sysP += '\n═══ 势力内部生态（不是铁板一块！）═══';
      sysP += '\n每个势力内部有自己的派系斗争，这些斗争是故事的富矿：';
      sysP += '\n  鹰派vs鸽派：主战将军和主和文臣互相攻讦';
      sysP += '\n  旧贵族vs新臣：保守世家阻挠新政，新锐官僚急于上位';
      sysP += '\n  君权vs相权：首领想集权，权臣想分权——权力永恒的博弈';
      sysP += '\n  嫡系vs旁支：继承权争夺，兄弟阋墙，叔侄猜忌';
      sysP += '\n  内部矛盾可能导致：政变(coup)、分裂、投敌、被迫改革';
      sysP += '\n  → 在faction_events中用actionType:"内政"来表达这些';
      sysP += '\n';
      sysP += '\n═══ 势力间博弈的完整谱系 ═══';
      sysP += '\n不只是"战争"和"结盟"——国与国之间的博弈像一盘大棋：';
      sysP += '\n  外交纵横：合纵连横、远交近攻、围魏救赵、离间敌盟';
      sysP += '\n  经济竞争：争夺商路、盐铁专营、货币战争、贸易禁运';
      sysP += '\n  间谍暗战：刺探军情、策反叛将、散布谣言、暗杀';
      sysP += '\n  文化渗透：儒学传播、宗教影响、制度输出、礼乐教化';
      sysP += '\n  人才争夺：招揽他国能臣、收留政治流亡者、挖角武将';
      sysP += '\n';
      sysP += '\n═══ 势力实力动态规则 ═══';
      sysP += '\n每回合每个势力的strength都应有合理波动：';
      sysP += '\n  改革成功/战争胜利/内政稳定 → strength_delta或strength_effect +1~+5';
      sysP += '\n  内讧/战败/天灾/腐败蔓延 → -1~-8';
      sysP += '\n  strength≤10时岌岌可危，可能被吞并或灭亡';
      sysP += '\n\n═══ 势力差异化（读faction的实际数据，不套模板）═══';
      sysP += '\n每个势力有type/culture/mainstream/goal/resources等字段——读这些数据推导其行为风格：';
      sysP += '\n  看type：主权国/藩镇/游牧/番属各有不同治理逻辑和决策方式';
      sysP += '\n  看culture：文化决定制度形态——同样是"改革"，不同文化执行方式完全不同';
      sysP += '\n  看mainstream：主体民族/信仰影响政策优先级和社会结构';
      sysP += '\n  看resources：资源禀赋决定经济模式——有马者重骑兵，有盐铁者重贸易';
      sysP += '\n  看strength：实力决定野心和策略——弱者不敢如强者那般行事';
      sysP += '\n不要让所有势力都像中原朝廷那样运作——在faction_events中体现差异：';
      sysP += '\n  同一个"结盟"：可能是国书大礼/杀白马盟誓/互市通商/联姻换质';
      sysP += '\n  同一个"内政"：可能是三省合议/可汗独断/部落会议/教团裁决';
      sysP += '\n  具体怎么做——读势力的实际culture和type字段来决定。';
      sysP += '\n\n每回合至少生成 ' + Math.max(3, Math.min(GM.facs.length, 8)) + ' 条faction_events——';
      sysP += '\n  其中约1/3为外交、1/3为内政、1/3为军事/经济。';
      sysP += '\n  不要让所有事件都围绕玩家——势力之间的自主博弈才是世界的骨架。';
      sysP += '\n\n═══ 势力发展的连续性规则 ═══';
      sysP += '\n数据中提供了【近3回合势力大事记】和【势力实力趋势】——你必须参考这些历史：';
      sysP += '\n  1. 延续性：上回合开始的行军/围城/改革/谈判应在本回合有后续进展';
      sysP += '\n  2. 因果性：上回合的战败→本回合内部不满上升；上回合改革→本回合阻力或成效';
      sysP += '\n  3. 趋势性：持续上升的势力应越来越有野心；持续衰落的应越来越保守或铤而走险';
      sysP += '\n  4. 不要遗忘：如果上回合势力A攻打B，本回合不能假装什么都没发生';
      sysP += '\n  5. 内部动态（undercurrents）中标注的趋势应延续——"动荡"不会突然变"稳定"除非有重大事件';
    }

    // N6: 天灾/异象prompt指引
    var _yearTurnsN6 = (typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12;
    sysP += '\n\n\u3010\u5929\u707E\u4E0E\u5F02\u8C61\u3011';
    sysP += '\n\u6BCF\u7EA6' + _yearTurnsN6 + '\u56DE\u5408\u5E94\u81F3\u5C11\u6709\u4E00\u6B21\u81EA\u7136\u4E8B\u4EF6\uFF08\u65F1/\u6D9D/\u8757/\u75AB/\u9707/\u98CE/\u96EA\uFF09\u3002';
    sysP += '\n\u5929\u707E\u89C4\u6A21\u53D7eraState.socialStability\u5F71\u54CD\u2014\u2014\u8D8A\u4E0D\u7A33\u5B9A\u8D8A\u5BB9\u6613\u51FA\u5927\u707E\u3002';
    sysP += '\n\u5929\u707E\u5FC5\u987B\u5F71\u54CD\u5177\u4F53\u7701\u4EFD\u7684unrest(+5~+20)\u548Cprosperity(-5~-15)\u3002';
    if (_mp.mode === 'strict_hist') sysP += '\n\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\uFF1A\u5929\u707E\u5E94\u53C2\u7167\u8BE5\u65F6\u671F\u7684\u53F2\u6599\u8BB0\u8F7D\u6C14\u5019\u548C\u707E\u5BB3\u6570\u636E\u3002';
    else if (_mp.mode === 'yanyi') sysP += '\n\u6F14\u4E49\u6A21\u5F0F\uFF1A\u5929\u707E\u53EF\u4E3A\u5267\u60C5\u670D\u52A1\uFF08\u5982\u6218\u524D\u66B4\u96E8\u3001\u5730\u9707\u9884\u5146\u53DB\u4E71\uFF09\u3002';
    sysP += '\n\u5929\u707E\u53D1\u751F\u540E\uFF0C\u8C0F\u5B98\u53EF\u80FD\u5C06\u5176\u89E3\u8BFB\u4E3A\u201C\u5929\u8C34\u201D\uFF0C\u8981\u6C42\u7687\u5E1D\u4E0B\u7F6A\u5DF1\u8BCF\u6216\u6539\u5143\u3002';

    // N3: 密探情报机制
    sysP += '\n\n\u3010\u5BC6\u63A2\u60C5\u62A5\u3011';
    sysP += '\n\u5982\u679C\u89D2\u8272\u5217\u8868\u4E2D\u6709\u62C5\u4EFB\u201C\u5BC6\u63A2/\u9526\u8863\u536B/\u7C98\u6746\u5904\u201D\u7C7B\u804C\u4F4D\u7684\u89D2\u8272\uFF1A';
    sysP += '\n\u8BE5\u89D2\u8272\u7684npc_actions\u5E94\u5305\u542B\u60C5\u62A5\u641C\u96C6\u884C\u4E3A(behaviorType:investigate)\u3002';
    sysP += '\n\u5176\u641C\u96C6\u7ED3\u679C\u4EE5\u201C\u5BC6\u62A5\u201D\u5F62\u5F0F\u51FA\u73B0\u5728\u65F6\u653F\u8BB0\u4E2D\u3002';
    sysP += '\n\u5BC6\u63A2\u667A\u529B\u503C\u51B3\u5B9A\u60C5\u62A5\u51C6\u786E\u5EA6\u2014\u2014\u667A\u529B\u4F4E\u7684\u5BC6\u63A2\u53EF\u80FD\u5E26\u56DE\u9519\u8BEF\u60C5\u62A5\u3002';

    // ── 党派与阶层推演指令 ──
    if ((GM.parties && GM.parties.length > 0) || (GM.classes && GM.classes.length > 0)) {
      sysP += '\n\n【党派与阶层】';
      if (GM.parties && GM.parties.length > 1) {
        sysP += '\n朝中党派有各自的议程和对立关系：';
        sysP += '\n- party_changes反映影响力涨跌；对立党派暗斗、弹劾、排挤';
        sysP += '\n- 党派之间的斗争通过npc_actions体现——党A成员弹劾党B成员等';
        sysP += '\n- 被压制党派可能暗中活动、投靠外部势力、甚至策动兵变';
      }
      if (GM.classes && GM.classes.length > 0) {
        sysP += '\n社会阶层有各自的诉求：加税→满意度降，减负→满意度升';
        sysP += '\n- 满意度极低→抗税、骚乱、流民、甚至起义';
      }
    }
    try {
      if (TM && TM.ClassEngine && typeof TM.ClassEngine.buildAlertPrompt === 'function') {
        var _classAlertPrompt = TM.ClassEngine.buildAlertPrompt(GM, { limit: 8 });
        if (_classAlertPrompt) sysP += _classAlertPrompt;
      }
    } catch(_classAlertPromptE) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_classAlertPromptE, 'sysP] 阶层警报注入失败') : console.warn('[sysP] 阶层警报注入失败', _classAlertPromptE);
    }

    // 4.5: 党派内部动态
    if (GM._partyDynamics && GM._partyDynamics.length > 0) {
      sysP += '\n\n【党派内部动态（AI应在叙事中反映）】';
      GM._partyDynamics.forEach(function(d) { sysP += '\n- ' + d.desc; });
    }

    // 6.1: 伏笔/回收系统——注入未回收伏笔列表（与编年纪事联动）
    if (GM._foreshadowings && GM._foreshadowings.length > 0) {
      var _unresolvedFsList = GM._foreshadowings.filter(function(f) { return !f.resolved; });
      var _recentResolved = GM._foreshadowings.filter(function(f) { return f.resolved && GM.turn - (f.resolveTurn||0) <= _turnsForMonthsLocal(3); });
      if (_unresolvedFsList.length > 0 || _recentResolved.length > 0) {
        sysP += '\n\n\u3010\u6697\u7EBF\u4F0F\u7B14\u8FFD\u8E2A\uFF08AI\u5185\u90E8\u53D9\u4E8B\u5DE5\u5177\uFF0C\u4E0D\u76F4\u63A5\u544A\u77E5\u73A9\u5BB6\uFF0C\u5E94\u5728\u53D9\u4E8B\u4E2D\u81EA\u7136\u5448\u73B0\uFF09\u3011';
        // 未回收伏笔
        if (_unresolvedFsList.length > 0) {
          sysP += '\n\u25A0 \u672A\u56DE\u6536\u4F0F\u7B14\uFF1A';
          _unresolvedFsList.forEach(function(f) {
            var age = GM.turn - (f.plantTurn || GM.turn);
            var urgency = age > _turnsForMonthsLocal(20) ? '\u26A0\u4E45\u60AC' : age > _turnsForMonthsLocal(10) ? '\u6E10\u70ED' : '\u6F5C\u4F0F';
            sysP += '\n  [' + urgency + '/' + (f.type||'mystery') + '] ' + f.content;
            if (f.resolveCondition) sysP += ' (\u6761\u4EF6:' + f.resolveCondition + ')';
            // 联动编年纪事：引用植入时附近的事件作为线索来源
            var _nearEvents = (GM.evtLog||[]).filter(function(e){ return Math.abs(e.turn - f.plantTurn) <= 1 && e.type !== '\u6697\u7EBF'; });
            if (_nearEvents.length > 0) sysP += ' [\u540C\u671F\u7EAA\u4E8B:' + _nearEvents.map(function(e){return e.text;}).join('/') + ']';
          });
          var _urgentCount = _unresolvedFsList.filter(function(f) { return (GM.turn - (f.plantTurn||GM.turn)) > _turnsForMonthsLocal(20); }).length;
          if (_urgentCount > 0) sysP += '\n  \u2192 ' + _urgentCount + '\u6761\u4E45\u60AC\u4F0F\u7B14\u5E94\u4F18\u5148\u56DE\u6536';
        }
        // 近期已回收的伏笔——提示AI在编年叙事中呈现因果链
        if (_recentResolved.length > 0) {
          sysP += '\n\u25A0 \u8FD1\u671F\u56DE\u6536\u7684\u4F0F\u7B14\uFF08\u5E94\u5728\u53D9\u4E8B\u4E2D\u5448\u73B0\u56E0\u679C\u5173\u8054\uFF09\uFF1A';
          _recentResolved.forEach(function(f) {
            sysP += '\n  T' + f.plantTurn + '\u57CB\u4E0B\u300C' + f.content + '\u300D\u2192 T' + f.resolveTurn + '\u56DE\u6536\u300C' + (f.resolveContent||'') + '\u300D';
          });
        }
        sysP += '\nAI\u53EF\u901A\u8FC7foreshadowing\u5B57\u6BB5plant\u65B0\u4F0F\u7B14\u6216resolve\u56DE\u6536\u3002\u4F0F\u7B14\u662FAI\u6697\u7EBF\u5DE5\u5177\uFF0C\u7F16\u5E74\u7EAA\u4E8B\u662F\u73A9\u5BB6\u53EF\u67E5\u7684\u516C\u5F00\u8BB0\u5F55\u2014\u2014\u4F0F\u7B14\u56DE\u6536\u65F6\u7684\u91CD\u5927\u4E8B\u4EF6\u4F1A\u81EA\u7136\u8FDB\u5165\u7F16\u5E74\u7EAA\u4E8B\u3002';
      }
    }

    // 6.3: 故事线追踪——分析近期各线字数占比
    if (GM.shijiHistory && GM.shijiHistory.length > 0) {
      var _storyTags = ['军事','朝政','经济','外交','民生','宫廷','边疆','改革'];
      var _tagCounts = {};
      _storyTags.forEach(function(t){ _tagCounts[t] = 0; });
      // 统计最近5回合各标签出现的字数
      GM.shijiHistory.slice(-5).forEach(function(sh) {
        var szj = sh.shizhengji || '';
        _storyTags.forEach(function(t) {
          var re = new RegExp('[【]?' + t + '[】]?', 'g');
          var matches = szj.match(re);
          if (matches) _tagCounts[t] += matches.length;
        });
      });
      var _totalMentions = Object.values(_tagCounts).reduce(function(s,v){return s+v;},0) || 1;
      var _lineReport = _storyTags.filter(function(t){return _tagCounts[t]>0||true;}).map(function(t){
        var pct = Math.round(_tagCounts[t] / _totalMentions * 100);
        return t + ':' + pct + '%';
      }).join(' ');
      sysP += '\n\n【故事线字数占比（近5回合）】' + _lineReport;
      sysP += '\n所有活跃故事线都应推进，重要的线占更多篇幅，次要的线少写几句但不可遗漏。被冷落的线（0%）应至少提及进展。';
    }

    // 6.6: 叙事张力建议（5回合阈值）
    if (GM._tensionHistory && GM._tensionHistory.length >= 5) {
      var _last5 = GM._tensionHistory.slice(-5);
      var _allLow = _last5.every(function(t){ return t.score < 10; });
      var _allHigh = _last5.every(function(t){ return t.score > 80; });
      if (_allLow) sysP += '\n\n【叙事节奏建议】近5回合局势过于平静(张力<10)，可适当制造冲突或转折（仅为建议，AI可自行判断）。';
      if (_allHigh) sysP += '\n\n【叙事节奏建议】近5回合连续高压(张力>80)，可给予喘息空间（仅为建议，AI可自行判断）。';
    }

    // ── 跨系统关联指令 ──
    // 难度设置注入
    if (P.conf && P.conf.difficulty) {
      var _diffPrompts = {
        narrative: '\n\n\u3010\u96BE\u5EA6\uFF1A\u53D9\u4E8B\u6A21\u5F0F\u3011AI\u5E94\u66F4\u6E29\u548C\uFF0C\u51CF\u5C11\u7A81\u53D1\u707E\u96BE\uFF0C\u7ED9\u73A9\u5BB6\u66F4\u591A\u7F13\u51B2\u7A7A\u95F4\u3002NPC\u884C\u4E3A\u504F\u5408\u4F5C\uFF0C\u8F83\u5C11\u4E3B\u52A8\u653B\u51FB\u3002\u91CD\u70B9\u662F\u53D9\u4E8B\u4F53\u9A8C\u800C\u975E\u751F\u5B58\u6311\u6218\u3002',
        hardcore: '\n\n\u3010\u96BE\u5EA6\uFF1A\u786C\u6838\u6A21\u5F0F\u3011AI\u5E94\u66F4\u6FC0\u8FDB\uFF0C\u591A\u5236\u9020\u5371\u673A\u4E8B\u4EF6\u3002NPC\u66F4\u6709\u91CE\u5FC3\uFF0C\u53DB\u4E71\u3001\u5165\u4FB5\u3001\u5929\u707E\u66F4\u9891\u7E41\u3002\u73A9\u5BB6\u7684\u4EFB\u4F55\u5931\u8BEF\u90FD\u5E94\u6709\u4E25\u91CD\u540E\u679C\u3002\u8FD9\u662F\u4E00\u4E2A\u4E0D\u59A5\u534F\u7684\u4E16\u754C\u3002'
      };
      if (_diffPrompts[P.conf.difficulty]) sysP += _diffPrompts[P.conf.difficulty];
    }

    // P1: 昏君温水煮青蛙——根据荒淫度阶段调整AI叙事基调
    var _td = GM._tyrantDecadence || 0;
    if (_td >= 15) {
      var _tyrantStage = _td >= 85 ? 'depraved' : _td >= 60 ? 'addicted' : _td >= 35 ? 'indulging' : 'tempted';
      var _tyrantStagePrompts = {
        tempted: '\n\u3010\u6606\u541B\u79CD\u5B50\u3011\u73A9\u5BB6\u521A\u5F00\u59CB\u5C1D\u8BD5\u4EAB\u4E50\u3002AI\u5728player_inner\u4E2D\u5076\u5C14\u63D2\u5165\u8BF1\u60D1\u5FF5\u5934\uFF08\u201C\u4ECA\u65E5\u6279\u6298\u751A\u7D2F\uFF0C\u4E0D\u5982\u2026\u7B97\u4E86\u201D\uFF09\u3002\u4F5E\u81E3\u5F00\u59CB\u8BD5\u63A2\u6027\u5730\u732E\u7B56\u3002\u5FE0\u81E3\u5C1A\u672A\u5BDF\u89C9\u3002',
        indulging: '\n\u3010\u6C89\u6EBA\u521D\u671F\u3011\u4F5E\u81E3\u4E3B\u52A8\u732E\u7B56\u9891\u7387\u589E\u52A0\uFF0C\u63AA\u8F9E\u66F4\u5927\u80C6\u3002\u5FE0\u81E3\u5F00\u59CB\u9690\u7EA6\u62C5\u5FE7\u4F46\u4EE5\u4E3A\u53EA\u662F\u4E00\u65F6\u3002player_inner\u4E2D\u5FEB\u611F\u589E\u591A\u4F46\u5076\u6709\u4E00\u4E1D\u4E0D\u5B89\u3002',
        addicted: '\n\u3010\u4E0D\u53EF\u81EA\u62D4\u3011\u5FE0\u81E3\u6FC0\u70C8\u8FDB\u8C0F\uFF08\u5BC6\u96C6\u7684\u5197\u957F\u594F\u758F\u3001\u5F53\u9762\u75DB\u54ED\u6D41\u6D95\u2014\u2014\u4EE4\u4EBA\u975E\u5E38\u53CC\u70E6\uFF09\u3002\u4F5E\u81E3\u628A\u6301\u65E5\u5E38\u653F\u52A1\u3002player_inner\u5B8C\u5168\u6C89\u6D78\u4EAB\u4E50\uFF0C\u5BF9\u5FE0\u81E3\u7684\u8FDB\u8C0F\u611F\u5230\u6781\u5EA6\u70E6\u8E81\u3002\u671D\u653F\u5F00\u59CB\u660E\u663E\u5931\u63A7\u4F46\u73A9\u5BB6\u611F\u89C9\u5F88\u723D\u3002',
        depraved: '\n\u3010\u672B\u8DEF\u72C2\u6B22\u3011\u5FE0\u81E3\u5DF2\u88AB\u6392\u6324\u6216\u6C89\u9ED8\u3002\u4F5E\u81E3\u5B8C\u5168\u638C\u63A7\uFF0C\u671D\u5EF7\u4E0A\u4E0B\u4E00\u7247\u6B4C\u529F\u9882\u5FB7\u3002\u5916\u654C\u8D81\u865A\u800C\u5165\u3002\u6C11\u95F4\u6028\u58F0\u8F7D\u9053\u4F46\u6D88\u606F\u88AB\u5C4F\u853D\u3002\u73A9\u5BB6\u4ECD\u5728\u4EAB\u4E50\u6CE1\u6CE1\u4E2D\u2014\u2014\u76F4\u5230\u5D29\u6E83\u6765\u4E34\u3002'
      };
      sysP += _tyrantStagePrompts[_tyrantStage] || '';
    }

    // P2: 明君孤独顶峰——勤政度高时的叙事指令
    var _diligentWindowTurns = _turnsForMonthsLocal(5);
    if ((!GM._tyrantDecadence || GM._tyrantDecadence < 15) && GM.turn > _turnsForMonthsLocal(3)) {
      // 检查近5回合是否持续勤政（有政令+无昏君活动）
      var _diligentTurns = 0;
      for (var _dt = Math.max(1, GM.turn - _diligentWindowTurns); _dt <= GM.turn; _dt++) {
        var _qj = (GM.qijuHistory || []).find(function(q) { return q.turn === _dt; });
        if (_qj && _qj.edicts && (_qj.edicts.political || _qj.edicts.military || _qj.edicts.economic)) _diligentTurns++;
      }
      if (_diligentTurns >= Math.min(3, _diligentWindowTurns)) {
        sysP += '\n\u3010\u660E\u541B\u56F0\u5883\u3011\u73A9\u5BB6\u8FDE\u7EED\u52E4\u653F\u3002\u53D9\u4E8B\u5E94\u4F53\u73B0\uFF1A';
        sysP += '\n\u2022 \u5FE0\u81E3\u4E4B\u95F4\u4E5F\u4F1A\u56E0\u6539\u9769\u8DEF\u7EBF\u4E89\u5435\uFF08\u6539\u9769\u6D3EA vs \u6539\u9769\u6D3EB\uFF09';
        sysP += '\n\u2022 \u767E\u59D3\u77ED\u671F\u4E0D\u9886\u60C5\uFF08\u201C\u51CF\u7A0E\u662F\u5E94\u8BE5\u7684\u201D\u800C\u975E\u201C\u8C22\u6069\u201D\uFF09';
        sysP += '\n\u2022 \u5916\u56FD\u53CD\u800C\u66F4\u5F3A\u786C\uFF08\u660E\u541B=\u5B9E\u529B\u5F3A\u2192\u4E0D\u5FC5\u8BA8\u597D\uFF09';
        sysP += '\n\u2022 player_inner\u5B64\u72EC\u611F\u52A0\u91CD\uFF1A\u201C\u670D\u505A\u4E86\u8FD9\u4E48\u591A\uFF0C\u7ADF\u65E0\u4E00\u4EBA\u8BF4\u58F0\u597D\u201D';
      }
    }

    // N7: 王朝衰落叙事引擎
    var _reignYears = (typeof getReignYears === 'function') ? getReignYears() : ((GM.turn || 0) * _daysPerTurnLocal() / 365);
    if (_reignYears > 15) {
      sysP += '\n\n\u3010\u738B\u671D\u79EF\u5F0A\u671F\uFF08\u5728\u4F4D' + Math.round(_reignYears) + '\u5E74\uFF09\u3011';
      sysP += '\n\u627F\u5E73\u65E5\u4E45\uFF0C\u5E94\u81EA\u7136\u6D8C\u73B0\uFF1A\u5409\u6CBB\u8150\u8D25\u3001\u519B\u961F\u677E\u5F1B\u3001\u4E16\u5BB6\u81A8\u80C0\u3001\u571F\u5730\u517C\u5E76\u3001\u8FB9\u9632\u61C8\u6020\u3002';
      sysP += '\n\u8D8A\u592A\u5E73\u8D8A\u8981\u57CB\u5371\u673A\u79CD\u5B50\u2014\u2014\u76DB\u4E16\u4E0B\u7684\u9690\u60A3\u6BD4\u8870\u4E16\u66F4\u81F4\u547D\u3002';
    }

    // 显著矛盾注入（动态演化版）
    var _contrPrompt = (typeof ContradictionSystem !== 'undefined') ? ContradictionSystem.getPromptInjection() : '';
    if (_contrPrompt) {
      sysP += '\n\n' + _contrPrompt;
      sysP += '\n\n【矛盾推演规则】';
      sysP += '\n1. 玩家的任何决策都必须在政治/经济/军事/社会四个维度引发连锁反应';
      sysP += '\n2. 解决一个矛盾可能激化另一个矛盾——世界不存在完美的解决方案';
    } else if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
      // 降级：无ContradictionSystem时用静态注入
      sysP += '\n\n【显著矛盾】';
      var _dimN = {political:'\u653F\u6CBB',economic:'\u7ECF\u6D4E',military:'\u519B\u4E8B',social:'\u793E\u4F1A'};
      P.playerInfo.coreContradictions.forEach(function(c) {
        sysP += '\n- [' + (_dimN[c.dimension]||'') + '] ' + c.title;
        if (c.parties) sysP += '（' + c.parties + '）';
        if (c.description) sysP += '\uFF1A' + c.description;
      });
      sysP += '\n3. 矛盾应随时间动态演化：加剧、缓和、转化、或引发新矛盾';
      sysP += '\n4. NPC的行动也应受矛盾驱动——不同矛盾的不同立场导致不同行为';
      sysP += '\n5. 每回合叙事中至少体现1-2个矛盾的发展或对抗';
    }

    // 目标系统注入——让AI知道玩家目标并制造相关事件
    if (P.goals && P.goals.length > 0) {
      var _activeGoals = P.goals.filter(function(g) { return !g.completed; });
      var _doneGoals = P.goals.filter(function(g) { return g.completed; });
      if (_activeGoals.length > 0) {
        sysP += '\n\n【玩家目标·推演参考】';
        _activeGoals.forEach(function(g) {
          var prog = g.progress || 0;
          sysP += '\n- ' + (g.title || g.name) + '（进度' + prog + '%）';
          if (g.description) sysP += '\uFF1A' + g.description;
          if (g.winCondition) sysP += ' [胜利条件]';
          if (g.loseCondition) sysP += ' [失败条件·警惕]';
        });
        sysP += '\n请围绕这些目标制造相关事件和抉择。';
      }
      if (_doneGoals.length > 0) {
        sysP += '\n已完成：' + _doneGoals.map(function(g){return g.title||g.name;}).join('、');
      }
    }

    // ── 无地图模式：AI历史地理推断指令 ──
    // ── 角色位置+鸿雁传书注入 ──
    if (typeof getLocationPromptInjection === 'function') {
      var _locPrompt = getLocationPromptInjection();
      if (_locPrompt) sysP += '\n\n' + _locPrompt;
    }

    var _mapEnabled = P.map && P.map.enabled !== false && P.map.regions && P.map.regions.length > 0;
    if (!_mapEnabled || GM._useAIGeo) {
      var _dynasty = sc ? (sc.dynasty || sc.era || '') : '';
      sysP += '\n\n【历史地理推断·关键】';
      sysP += '\n本剧本未启用地图系统。你必须基于' + (_dynasty || '该时代') + '的真实历史地理知识推算空间数据：';
      sysP += '\n凡涉及行军、围城、调兵、补给的faction_events，必须在geoData中提供：';
      sysP += '\n  routeKm: 两地直线距离（公里），参考真实地理';
      sysP += '\n  terrainDifficulty: 沿途地形难度（0.5平原/0.7丘陵/0.8河网/1.0山地/1.2荒漠戈壁）';
      sysP += '\n  hasOfficialRoad: 是否有官道驿路（参考该朝代驿道系统）';
      sysP += '\n  routeDescription: "经某某、过某某"的路线简述';
      sysP += '\n  passesAndBarriers: 沿途关隘名称数组（如["潼关","函谷关"]）';
      sysP += '\n  fortLevel: 目标城池防御等级（0空地/1乡镇/2县城/3州城/4府城重镇/5天下雄关）';
      sysP += '\n  garrison: 目标预计驻军人数';
      sysP += '\n示例：从长安到洛阳 → routeKm:380, terrainDifficulty:0.5, hasOfficialRoad:true, passesAndBarriers:["潼关"]';
      sysP += '\n注意：行军速度由系统根据routeKm自动计算，你只需提供地理数据。';
    }

    sysP += '\n\n【跨系统关联·重要】';
    sysP += '\n- 军队属于势力：每支军队有所属势力，势力覆灭→军队士气崩溃。统帅阵亡→该军士气骤降。';
    sysP += '\n- 军费消耗经济：维持军队需要军饷（粮食和金钱），兵力增加应考虑财政是否承受得起。';
    sysP += '\n- 阶层影响经济：农民阶层满意度低→粮食减产；商人阶层不满→税收减少。';
    sysP += '\n- 角色死亡级联：重要人物死亡会影响其所属势力、军队、党派的稳定性。宗主死亡→封臣忠诚危机；封臣首领死亡→世袭则继承人继续，非世袭则宗主可更换。';
    sysP += '\n- 封臣体系：封臣向宗主缴纳贡奉、提供兵员；忠诚度低+集权度低→可能叛离。用vassal_changes建立/解除/调整封臣关系。';
    sysP += '\n- 头衔爵位：册封/晋升/剥夺头衔影响角色地位和特权。世袭头衔可传承，流官头衔由朝廷收回。用title_changes操作。';
    sysP += '\n- 建筑影响经济：经济建筑增加收入、军事建筑增加征兵和防御、文化建筑降低民变。用building_changes建造/升级/拆除。';
    sysP += '\n- 行政区划与地方治理：各级行政区由主官自主治理，皇帝通过诏书间接干预。';
    sysP += '\n  · 地方官根据自身能力（政务/军事/品德）和性格自主决策：高政务官员会主动发展经济、整顿吏治；好大喜功者可能大兴土木；贪官会中饱私囊（贪腐上升）';
    sysP += '\n  · 地方官的治绩会在admin_changes中通过prosperity_delta和population_delta体现——能吏治下的地区繁荣上升，庸官治下停滞或衰退';
    sysP += '\n  · 忠诚度低的地方官可能阳奉阴违（皇帝的诏令在该地区执行打折），野心高的可能培植私人势力';
    sysP += '\n  · 空缺主官的行政区会自然衰退（稳定和发展缓慢下降），应在叙事中反映"无人治理"的后果';
    sysP += '\n  · 用admin_changes的adjust动作反映地方官自主治理的效果（prosperity_delta/population_delta），在npc_actions或shizhengji中叙述其治政行为';
    // 注入当前行政区划树概要（含主官信息）
    if (P.adminHierarchy) {
      var _ahKey = P.adminHierarchy.player ? 'player' : Object.keys(P.adminHierarchy)[0];
      var _ahData = _ahKey ? P.adminHierarchy[_ahKey] : null;
      if (_ahData && _ahData.divisions && _ahData.divisions.length > 0) {
        sysP += '\n\n\u3010\u5F53\u524D\u73A9\u5BB6\u884C\u653F\u533A\u5212\u6811\u3011';
        var _dumpAdminTree = function(divs, indent) {
          var s = '';
          for (var i = 0; i < divs.length; i++) {
            var d = divs[i];
            var _ps = GM.provinceStats ? GM.provinceStats[d.name] : null;
            var _govName = (_ps && _ps.governor) || d.governor || '';
            var _govInfo = '';
            if (_govName) {
              var _govCh = typeof findCharByName === 'function' ? findCharByName(_govName) : null;
              if (_govCh) {
                _govInfo = ' \u4E3B\u5B98:' + _govName + '(\u653F' + (_govCh.administration || 50) + '/\u5FE0' + (_govCh.loyalty || 50) + '/\u5FB7' + (_govCh.benevolence || 50) + ')';
              } else {
                _govInfo = ' \u4E3B\u5B98:' + _govName;
              }
            } else {
              _govInfo = ' \u4E3B\u5B98:\u7A7A\u7F3A';
            }
            var _statsInfo = '';
            if (_ps) _statsInfo = ' \u7A33' + Math.round(_ps.stability) + '/\u53D1' + Math.round(_ps.development) + '/\u8150' + Math.round(_ps.corruption) + '/\u6C11\u53D8' + Math.round(_ps.unrest);
            s += '\n' + indent + d.name + '(' + (d.level || '') + ' \u4EBA\u53E3' + ((_ps && _ps.population) || d.population || '?') + _govInfo + _statsInfo + ')';
            if (d.children && d.children.length > 0) s += _dumpAdminTree(d.children, indent + '  ');
          }
          return s;
        };
        sysP += _dumpAdminTree(_ahData.divisions, '  ');
        sysP += '\n【行政区划不完整声明——关键规则】';
        sysP += '\n  树中列出的只是玩家已知的行政区划，不代表全部。历史上该势力治下的行政区远多于此。';
        sysP += '\n  · 推演中AI可运用历史地理知识涉及未列出的区划——如树中京畿道只有长安，但推演可涉及陈仓、扶风等史实存在的城市';
        sysP += '\n  · 当推演涉及未列出但史实存在的区划时→必须用admin_division_updates的add动作自动创建';
        sysP += '\n    add时查史料填写真实的population/prosperity/terrain/specialResources（各地数据必须不同！）';
        sysP += '\n  · 玩家在诏令/问对中提到未列出的区划→同样自动创建';
        sysP += '\n  · 父级数据 ≥ 子级数据之和（不必相等——不是所有下级都列出了）';
        sysP += '\n\u5730\u65B9\u5B98\u6CBB\u7EE9\u63D0\u793A\uFF1A\u8BF7\u6839\u636E\u4E0A\u8FF0\u5404\u533A\u4E3B\u5B98\u7684\u80FD\u529B\u503C\u548C\u5F53\u524D\u533A\u57DF\u72B6\u6001\uFF0C\u5728\u672C\u56DE\u5408\u53D9\u4E8B\u548Cadmin_changes\u4E2D\u53CD\u6620\u5730\u65B9\u5B98\u7684\u81EA\u4E3B\u6CBB\u7406\u884C\u4E3A\u3002\u80FD\u5458\u6CBB\u4E0B\u7E41\u8363\u5E94\u4E0A\u5347\uFF0C\u5EB8\u5B98\u6CBB\u4E0B\u5E94\u505C\u6EDE\u6216\u8870\u9000\u3002';
      }
    }
    sysP += '\n- 物品可被获取/失去：通过战争缴获、外交赠送、盗窃等方式。在叙事中适时让角色获取或丢失物品。';
    sysP += '\n\n【你的全部权力——可在JSON中修改的内容】';
    sysP += '\n你可以通过返回JSON中的对应字段修改游戏中的一切：';
    sysP += '\n- resource_changes: 修改任何资源变量';
    sysP += '\n- char_updates: 修改角色忠诚/野心/压力/所在地/立场/党派等（new_location/new_stance/new_party）';
    sysP += '\n- battleResult: 结构化战斗结果。若本回合明确发生战斗，请输出 {winnerFactionId, loserFactionId, occupiedCityIds, casualties:{attacker,defender}, affectedArmies:[{armyId,side,loss,moraleDelta,loyaltyDelta,state,commanderFate}], commanderFate:{name,outcome}, postBattleEffects[]}，胜负/占城/伤亡不得只写在叙事里。';
    sysP += '\n\n【NPC自主行为系统·核心——每回合必须生成】';
    sysP += '\nnpc_actions是世界活力的引擎。每回合应有5-10条NPC自主行为，涵盖不同层级的角色。';
    sysP += '\nbehaviorType可用类型：';
    sysP += '\n  朝政类：appoint(举荐任命) dismiss(弹劾罢免) reform(推行改革) petition(上疏进谏) obstruct(阻挠政令) investigate(调查弹劾)';
    sysP += '\n  军事类：train_troops(操练军队) fortify(加固城防) recruit(招募兵勇) desert(逃兵/哗变) patrol(巡防) suppress(镇压)';
    sysP += '\n  社交类：request_loyalty(拉拢示好) betray(背叛倒戈) conspire(密谋串联) reconcile(和解修好) mentor(指点提携) slander(造谣中伤)';
    sysP += '\n  经济类：hoard(囤积居奇) donate(捐资赈灾) smuggle(走私牟利) develop(兴修水利/开荒)';
    sysP += '\n  个人类：study(读书修学) travel(游历) marry(婚娶) mourn(服丧) retire(告老还乡) flee(出逃) hide(隐匿)';
    sysP += '\n  reward(赏赐) punish(惩罚) declare_war(宣战)';
    sysP += '\n\n每条npc_action必须包含：';
    sysP += '\n  name: 行动者  action: 做了什么(具体30字)  target: 对谁  result: 结果';
    sysP += '\n  behaviorType: 上述类型之一  publicReason: 对外说辞  privateMotiv: 真实动机（可能与说辞不同）';
    sysP += '\n  new_location: 如果行动导致角色移动（如出巡/流放/赴任/出逃），填写新所在地';
    sysP += '\n\n生成原则：';
    sysP += '\n- 忠臣：进谏(petition)、弹劾奸佞(investigate)、操练军队(train_troops)——正确但令人烦';
    sysP += '\n- 权臣：拉拢朋党(request_loyalty)、排挤异己(dismiss/slander)、把持朝政(obstruct)';
    sysP += '\n- 武将：操练(train_troops)、巡防(patrol)、也可能拥兵自重(conspire)';
    sysP += '\n- 佞臣：投其所好(reward)、替君分忧但暗中牟利(smuggle/hoard)';
    sysP += '\n- 地方官：发展治理(develop)、但也可能贪腐中饱(hoard)';
    sysP += '\n- 失意者：密谋串联(conspire)、出逃(flee)、告老(retire)';
    sysP += '\n- 小人物也要有行动——不是只有高官才会做事';
    sysP += '\n\n【特质直接驱动行为——叠加在所有层之上】';
    sysP += '\n每个角色的traitIds(特质)不是装饰标签，而是行为的直接驱动力：';
    sysP += '\n  勇猛(brave) → 主动请战、冲动行事、鄙视怯懦者';
    sysP += '\n  怯懦(cowardly) → 规避风险、反对冒险计划、善于找借口推脱';
    sysP += '\n  贪婪(greedy) → 任何决策先算经济账、容易被利益收买、囤积私产';
    sysP += '\n  慷慨(generous) → 主动赈灾赏赐、不在乎经济损失、容易被利用';
    sysP += '\n  狡诈(deceitful) → 表里不一、掩饰真实目的、善于操纵他人';
    sysP += '\n  坦诚(honest) → 有话直说、不善伪装、有自知之明会承认不足';
    sysP += '\n  野心勃勃(ambitious) → 主动争权、自荐上位、排挤竞争者';
    sysP += '\n  知足(content) → 安于现状、不争不抢、服从上级';
    sysP += '\n  勤勉(diligent) → 事必躬亲、方案详尽、但难以放权';
    sysP += '\n  怠惰(lazy) → 敷衍塞责、推给下属、但压力小';
    sysP += '\n  睚眦必报(vengeful) → 记住每一次冒犯并寻机报复';
    sysP += '\n  宽厚(forgiving) → 既往不咎、化敌为友、但可能被反复利用';
    sysP += '\n特质与能力值组合产生独特行为——勇猛+高智=深思熟虑的果断；勇猛+低智=鲁莽冲动';
    sysP += '\n对立特质的角色自然互相看不惯——贪婪者鄙视慷慨者"败家"，坦诚者厌恶狡诈者"虚伪"';

    sysP += '\n\n【NPC主动来书·鸿雁传书·扩充版】';
    sysP += '\n不在京城的 NPC 遇到事件时应主动写信给皇帝——每回合产出 2-5 封·少写无趣·多写过滥';
    sysP += '\n在 npc_letters 数组中输出：';
    sysP += '\n  from: 发信 NPC 名（必须不在京城）';
    sysP += '\n  type: report(军情汇报)/plea(陈情求助)/warning(预警告急)/personal(私人书信)/intelligence(情报密信)/thanks(谢恩)/recommend(荐才)/impeach(密告/弹劾)/condolence(吊唁)/greeting(节令问安)';
    sysP += '\n  urgency: normal(驿递)/urgent(加急)/extreme(八百里加急)';
    sysP += '\n  content: 信件正文（100-200 字古典中文·以 NPC 口吻/身份/性格写成·称谓：臣/末将/罪臣/妾身）';
    sysP += '\n  suggestion: 可操作的建议摘要(1-2 句白话·personal 类可省)';
    sysP += '\n  replyExpected: true/false 是否期待皇帝回信';
    sysP += '\n  refersToEdict: (可选)若信件响应了玩家近期某条诏书·填该诏书简述·让回听系统能追踪影响';
    sysP += '\n  mood: (可选)发信时心情·喜/忧/怒/惧/恨/敬/平——影响笔调';
    sysP += '\n';
    sysP += '\n【触发情景·10 类】';
    sysP += '\n  1. 边情·边将: 战况/敌动/兵粮/请援·urgency 常 urgent+';
    sysP += '\n  2. 陈情·贬官: 陈冤求召/诉苦告罪';
    sysP += '\n  3. 密告·忠臣: 告发奸党通敌/权贵不法';
    sysP += '\n  4. 藩镇例报: 汇报(报喜藏忧)·请加权';
    sysP += '\n  5. 个人危机: 重病/被困/家难·哀求';
    sysP += '\n  6. 谢恩: 谢封赏/谢宽宥/谢赏赐·多用于新任命之后';
    sysP += '\n  7. 荐才: 推荐某人入仕/升迁·暗含派系布局';
    sysP += '\n  8. 吊唁: 悼故人/慰皇室·含礼节性';
    sysP += '\n  9. 节令问安: 春节/冬至/帝诞·例行问安·显存在感';
    sysP += '\n  10. 密奏: 机密情报或个人请托·常加密';
    sysP += '\n';
    sysP += '\n【性格因素·必考虑】';
    sysP += '\n  - 清流/耿直: 直陈利害·多 warning/impeach 类';
    sysP += '\n  - 圆滑/投机: 报喜藏忧·多 greeting/thanks·暗中荐己党人';
    sysP += '\n  - 粗豪武将: 文字简短·多 plea 请粮饷';
    sysP += '\n  - 阴鸷/野心: 密奏为多·不常主动来信但一来必有分量';
    sysP += '\n  - 受玩家近期恩: 必有 thanks 或 condolence 回应';
    sysP += '\n  - 受玩家近期责: 可能 plea 自辩·或 warning 暗含怨怼·甚至不回信';
    sysP += '\n';
    sysP += '\n【与玩家近期诏书/信件的关联】';
    sysP += '\n  - 若玩家近期有某条诏书涉及该 NPC·NPC 可在信中回应(含反对/支持/汇报执行情况)·refersToEdict 填诏书要点';
    sysP += '\n  - 若玩家近期致该 NPC 信·NPC 应体现读过来信·不突兀提新话题';
    sysP += '\n  - 若 NPC 曾上奏未蒙批复·可在信中提醒·为何杳无音信';
    sysP += '\n';
    sysP += '\n【数量控制】每回合 2-5 封·优先重要性高的 NPC·无事写无意义信件的 NPC 可不写';
    sysP += '\n【注意】NPC 来信有传递延迟(驿递数日·八百里加急更快)·信件可能被截获——敌对势力控制区信件截获概率更高';

    sysP += '\n\n【记忆一致性——绝对规则】';
    sysP += '\nblockB中每个角色附有"刻骨"(永久伤疤)和blockB3中有"铭记"(近期记忆)。';
    sysP += '\n生成npc_actions时必须与这些记忆一致——不允许出现：';
    sysP += '\n  ✗ 角色记忆中"恨之入骨某人"，却在本回合与此人亲密合作（除非有极端理由）';
    sysP += '\n  ✗ 角色刻骨中有"丧子之痛[忧]"，却在本回合欢天喜地毫无异样';
    sysP += '\n  ✗ 角色上回合被当众羞辱，本回合毫无反应地继续效忠';
    sysP += '\n  ✓ 可以因利益暂时隐忍（但privateMotiv中必须写出"虽然我恨他，但现在还不是时候"）';
    sysP += '\n  ✓ 可以因更大的变故覆盖旧伤（但必须交代因果："本想报仇，但边关告急，私仇暂且搁下"）';
    // 1.4: 注入不可逆叙事事实
    if (GM._mutableFacts && GM._mutableFacts.length > 0) {
      sysP += '\n\n\u3010\u4E0D\u53EF\u8FDD\u80CC\u7684\u53D9\u4E8B\u4E8B\u5B9E\u2014\u2014\u7EDD\u5BF9\u7981\u6B62\u77DB\u76FE\u3011';
      GM._mutableFacts.forEach(function(f) { sysP += '\n  \u00B7 ' + f; });
    }

    // 3.1: 注入NPC行为倾向（仅供AI参考，AI有权忽略）
    if (GM._npcIntents && GM._npcIntents.length > 0) {
      sysP += '\n\n【NPC近期行为倾向（仅供参考，AI可根据叙事需要调整或忽略）】';
      GM._npcIntents.forEach(function(intent) {
        var strength = intent.weight > 50 ? '强烈倾向' : '轻微倾向';
        sysP += '\n  · ' + intent.name + '：' + strength + intent.behaviorName;
      });
    }

    // 4.1: 注入NPC个人目标——所有存活NPC都应有目标，按重要性分级展示
    var _allAlive = (GM.chars||[]).filter(function(c){ return c.alive!==false && !c.isPlayer; });
    var _hasGoals = _allAlive.filter(function(c){ return c.personalGoals && c.personalGoals.length > 0; });
    var _noGoals = _allAlive.filter(function(c){ return !c.personalGoals || c.personalGoals.length === 0; });

    sysP += '\n\n\u3010NPC\u4E2A\u4EBA\u76EE\u6807\uFF08\u6240\u6709NPC\u90FD\u5E94\u6709\u76EE\u6807\uFF0CAI\u901A\u8FC7goal_updates\u7EF4\u62A4\uFF09\u3011';

    if (_hasGoals.length > 0) {
      // 按重要性排序：高重要度详细展示，低重要度简略
      _hasGoals.sort(function(a,b){ return (b.importance||50)-(a.importance||50); });
      var _highImp = _hasGoals.filter(function(c){ return (c.importance||50) >= 70; });
      var _midImp = _hasGoals.filter(function(c){ var imp = c.importance||50; return imp >= 40 && imp < 70; });
      var _lowImp = _hasGoals.filter(function(c){ return (c.importance||50) < 40; });

      if (_highImp.length > 0) {
        sysP += '\n\u25A0 \u91CD\u8981\u4EBA\u7269\uFF08\u6BCF\u56DE\u5408\u5FC5\u987B\u66F4\u65B0\uFF09\uFF1A';
        _highImp.forEach(function(c) {
          c.personalGoals.forEach(function(g) {
            sysP += '\n  ' + c.name + '\uFF1A\u957F\u671F=' + g.longTerm + '\uFF0C\u77ED\u671F=' + (g.shortTerm||'\u5F85\u5B9A') + '\uFF0C\u8FDB\u5EA6' + (g.progress||0) + '%' + (g.context ? '\uFF0C\u5F53\u524D\uFF1A' + g.context : '');
          });
        });
      }
      if (_midImp.length > 0) {
        sysP += '\n\u25A0 \u4E00\u822C\u4EBA\u7269\uFF08\u6BCF2-3\u56DE\u5408\u66F4\u65B0\u4E00\u6B21\uFF09\uFF1A';
        _midImp.forEach(function(c) {
          var g = c.personalGoals[0];
          sysP += '\n  ' + c.name + '\uFF1A' + g.longTerm + '(' + (g.progress||0) + '%)';
        });
      }
      if (_lowImp.length > 0) {
        sysP += '\n\u25A0 \u6B21\u8981\u4EBA\u7269\uFF08\u6BCF5\u56DE\u5408\u66F4\u65B0\u4E00\u6B21\uFF09\uFF1A' + _lowImp.map(function(c){ return c.name + ':' + c.personalGoals[0].longTerm; }).join('\uFF1B');
      }
    }

    // 无目标的NPC——要求AI为其生成目标
    if (_noGoals.length > 0) {
      sysP += '\n\u25A0 \u4EE5\u4E0B\u89D2\u8272\u5C1A\u65E0\u76EE\u6807\uFF0CAI\u5E94\u6839\u636E\u5176\u6027\u683C/\u8EAB\u4EFD/\u5904\u5883\u5728goal_updates\u4E2D\u7528action="add"\u751F\u6210\u76EE\u6807\uFF1A';
      // 高重要度无目标的优先列出
      _noGoals.sort(function(a,b){ return (b.importance||50)-(a.importance||50); });
      sysP += '\n  ' + _noGoals.map(function(c){ return c.name + '(' + (c.faction||'') + ',' + (c.officialTitle||c.title||'\u65E0\u804C') + ')'; }).join('\uFF1B');
      if (_noGoals.length > 20) sysP += '\u2026\u53CA\u53E6\u5916' + (_noGoals.length - 20) + '\u4EBA';
    }

    sysP += '\ngoal_updates\u8981\u6C42\uFF1A\u91CD\u8981\u4EBA\u7269\u6BCF\u56DE\u5408\u66F4\u65B0\uFF0C\u4E00\u822C\u4EBA\u7269\u8F6E\u6D41\u66F4\u65B0\uFF0C\u65E0\u76EE\u6807\u8005\u4F18\u5148\u751F\u6210\u3002\u77ED\u671F\u76EE\u6807\u5E94\u7ED3\u5408\u5F53\u524D\u65F6\u4EE3\u80CC\u666F\uFF08\u5982\u79D1\u4E3E\u5236\u4E0B\u60F3\u5F53\u5B98\u2192\u5907\u8003\uFF09\u3002\u76EE\u6807\u8FBE\u6210\u65F6action="complete"\u5E76\u7528action="add"\u751F\u6210\u65B0\u76EE\u6807\u3002';

    // 4.2: 注入结构化关系网络（去重：只保留A→B方向，跳过B→A重复）
    var _relPairs = [];
    var _relSeen = {};
    (GM.chars||[]).forEach(function(c) {
      if (c.alive===false || !c._relationships) return;
      Object.keys(c._relationships).forEach(function(other) {
        c._relationships[other].forEach(function(r) {
          if (Math.abs(r.strength||0) < 10) return;
          // 去重：用排序后的名字对作为key
          var pairKey = [c.name, other].sort().join('|') + '|' + r.type;
          if (_relSeen[pairKey]) return;
          _relSeen[pairKey] = true;
          _relPairs.push(c.name + '\u2194' + other + '\uFF1A' + r.type + '(' + (r.strength>0?'+':'') + r.strength + ')');
        });
      });
    });
    if (_relPairs.length > 0) {
      sysP += '\n\n\u3010\u7ED3\u6784\u5316\u5173\u7CFB\u7F51\u7EDC\uFF08\u5F71\u54CDNPC\u4E92\u52A8\u51B3\u7B56\uFF09\u3011';
      sysP += '\n' + _relPairs.join('\uFF1B');
      sysP += '\naffinity_changes\u4E2D\u53EF\u7528relType\u5B57\u6BB5\u5EFA\u7ACB/\u5F3A\u5316\u5173\u7CFB\uFF1Ablood/marriage/mentor/sworn/rival/benefactor/enemy';
    }

    // 2.1: 注入状态耦合参考（非机械执行，AI自行决定实际变化）
    if (GM._couplingReport) {
      sysP += '\n\n' + GM._couplingReport;
    }
    // 注入时代进度参考（非机械执行，AI自行决定朝代阶段变化）
    if (GM._eraProgressReport) {
      sysP += '\n\n\u3010\u671D\u4EE3\u8D8B\u52BF\u53C2\u8003\u3011' + GM._eraProgressReport + '\u3002AI\u53EF\u901A\u8FC7era_state_delta\u81EA\u884C\u51B3\u5B9A\u662F\u5426\u8C03\u6574\u671D\u4EE3\u9636\u6BB5\u3002';
    }
    // 2.3: 注入执行管线参考信息（AI自行判断诏令执行程度）
    if (GM._edictExecutionReport) {
      sysP += '\n\n【诏令执行环境参考】';
      sysP += '\n官僚层级：' + GM._edictExecutionReport;
      sysP += '\n\u8BF7\u6839\u636E\u4E0A\u8FF0\u5404\u5C42\u7EA7\u5B98\u5458\u7684\u80FD\u529B\u3001\u5FE0\u8BDA\u5EA6\u548C\u7A7A\u7F3A\u60C5\u51B5\uFF0C\u81EA\u884C\u5224\u65AD\u8BCF\u4EE4\u7684\u6267\u884C\u7A0B\u5EA6\u548C\u963B\u529B\u6765\u6E90\u3002';
      sysP += '\nedict_feedback\u8981\u6C42\uFF1Aassignee\u5FC5\u586B\u8D1F\u8D23\u6267\u884C\u7684\u5177\u4F53\u5B98\u5458\u540D\uFF1Bfeedback\u5E94\u8BE6\u7EC6\u63CF\u8FF0\u6267\u884C\u8FC7\u7A0B\uFF08\u8C01\u505A\u4E86\u4EC0\u4E48\u3001\u8FDB\u5C55\u5982\u4F55\u3001\u963B\u529B\u6765\u6E90\uFF09\uFF0C\u4E0D\u8981\u7B3C\u7EDF\u6982\u62EC';
    }
    // 2.5: 注入建筑产出报告
    if (GM._buildingOutputReport) {
      sysP += '\n\n【本回合建筑经济产出】';
      sysP += '\n' + GM._buildingOutputReport;
    }
    // 5.1: 注入贸易路线报告
    if (GM._tradeReport) {
      sysP += '\n\n\u3010\u8D38\u6613\u8DEF\u7EBF\u72B6\u51B5\uFF08\u53C2\u8003\uFF09\u3011' + GM._tradeReport;
      sysP += '\nAI\u53EF\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u8D38\u6613\u7E41\u8363/\u8427\u6761\u3002';
    }
    // 5.3: 注入省份特产资源信息
    if (GM._resourceProvinces && Object.keys(GM._resourceProvinces).length > 0) {
      sysP += '\n\n\u3010\u7701\u4EFD\u7279\u4EA7\u8D44\u6E90\u3011';
      Object.keys(GM._resourceProvinces).forEach(function(pn) {
        sysP += '\n' + pn + '\uFF1A' + GM._resourceProvinces[pn].join('\u3001');
      });
    }
    // 4.1: 注入当前国策列表
    if (GM.customPolicies && GM.customPolicies.length > 0) {
      sysP += '\n\n【当前施行国策】';
      GM.customPolicies.forEach(function(p) {
        var duration = GM.turn - (p.enactedTurn || 0);
        sysP += '\n  · ' + (p.name || p.id) + '（已施行' + duration + '回合）';
      });
      sysP += '\n请在推演中体现国策对国家治理的持续影响。';
    }
    // 4.2: 注入地方区划概况（最多10个，优先显示有问题的）
    if (GM.provinceStats) {
      var _provKeys = Object.keys(GM.provinceStats);
      // 按民怨降序排列，优先展示问题省份
      _provKeys.sort(function(a, b) { return ((GM.provinceStats[b]||{}).unrest||0) - ((GM.provinceStats[a]||{}).unrest||0); });
      // 不限制省份数量
      if (_provKeys.length > 0) {
        var _provLines = [];
        _provKeys.forEach(function(pn) {
          var ps = GM.provinceStats[pn];
          if (!ps || !ps.monthlyIncome) return;
          var gov = ps.governor || '空缺';
          _provLines.push(pn + '(长官:' + gov + ' 收入:钱' + (ps.monthlyIncome.money||0) + '/粮' + (ps.monthlyIncome.grain||0) + ' 民怨:' + (ps.unrest||0) + ')');
        });
        if (_provLines.length > 0) {
          sysP += '\n\n【地方区划概况】';
          _provLines.forEach(function(l) { sysP += '\n  · ' + l; });
        }
      }
    }
    // 4.3: NPC事件提案
    if (GM._npcEventProposals && GM._npcEventProposals.length > 0) {
      sysP += '\n\n【NPC事件提案（系统检测到以下NPC满足事件触发条件，AI应优先考虑处理）】';
      GM._npcEventProposals.forEach(function(p) {
        sysP += '\n- ' + p.desc;
      });
      sysP += '\nAI有权根据叙事需要决定是否触发，但忠诚<20+野心>80的叛乱提案应大概率触发。';
    }
    // 4.4: 注入角色健康预警（AI决定是否让角色病亡）
    if (GM._healthAlerts && GM._healthAlerts.length > 0) {
      sysP += '\n\n【角色健康预警（AI应酌情在character_deaths中处理）】';
      GM._healthAlerts.forEach(function(alert) {
        sysP += '\n  · ' + alert;
      });
    }
    // 4.4: 正统性状况参考
    if (GM._legitimacyAlerts && GM._legitimacyAlerts.length > 0) {
      sysP += '\n\n\u3010\u6B63\u7EDF\u6027\u72B6\u51B5\uFF08AI\u53C2\u8003\uFF0C\u53EF\u901A\u8FC7char_updates\u8C03\u6574legitimacy\uFF09\u3011';
      GM._legitimacyAlerts.forEach(function(a) { sysP += '\n  ' + a; });
    }
    // 5.5: NPC目标驱动阴谋建议
    var _schemeHints = [];
    (GM.chars||[]).forEach(function(c) {
      if (c.alive===false || c.isPlayer || !c.personalGoals) return;
      c.personalGoals.forEach(function(g) {
        if (g.type==='revenge' && g.progress>=40 && !(GM.activeSchemes||[]).some(function(s){return s.schemer===c.name;})) {
          _schemeHints.push(c.name + '(\u590D\u4EC7\u76EE\u6807\u8FDB\u5EA6' + g.progress + '%)\u53EF\u80FD\u53D1\u8D77\u9634\u8C0B');
        }
        if (g.type==='power' && g.progress>=60 && (c.ambition||50)>75) {
          _schemeHints.push(c.name + '(\u593A\u6743\u8FDB\u5EA6' + g.progress + '%)\u91CE\u5FC3\u9A71\u4F7F\u53EF\u80FD\u5BC6\u8C0B');
        }
      });
    });
    if (_schemeHints.length > 0) {
      sysP += '\n\n\u3010\u9634\u8C0B\u6F5C\u5728\u53D1\u8D77\u8005\uFF08AI\u53EF\u5728scheme_actions\u4E2D\u5B89\u6392\uFF09\u3011';
      _schemeHints.forEach(function(h){ sysP += '\n- ' + h; });
    }
    // 4.6: 注入NPC决策条件满足提示（AI决定是否触发）
    if (GM._decisionAlerts && GM._decisionAlerts.length > 0) {
      sysP += '\n\n【NPC重大决策条件（仅供参考，AI决定是否安排叙事）】';
      GM._decisionAlerts.forEach(function(da) {
        sysP += '\n  · ' + da.charName + '满足"' + da.decisionName + '"条件';
      });
    }

    sysP += '\n\n【官制职能——推演原则】';
    sysP += '\n本朝官制中每个部门有职能分工（见tp中【官制职能分工】）。推演时注意：';
    sysP += '\n  · 事务应优先由对口部门处理——但"对口"看职能内容，不看部门名称';
    sysP += '\n  · 不得凭空创造不存在的官职——必须使用blockE中已有的官职';
    sysP += '\n  · 部门主官空缺→该部门效率下降，相关事务延误或副手代理';
    sysP += '\n  · 官员的"见识"≠"当前职务"——判断一个人是否懂某事务要看三层：';
    sysP += '\n    1.任职经历：曾在哪些部门任职？经手过哪些职能？（曾管科举的官员调任后仍懂科举）';
    sysP += '\n    2.能力天赋：智力/政务/军事高的人在相关领域触类旁通（政务85+的人谈任何行政事务都不会外行）';
    sysP += '\n    3.从政资历：在朝多年的老臣对朝政全局都有见识，即使未直接经手';
    sysP += '\n  · 官制改革后：旧部门官员对旧职能保留经验（只失去执行权，不失去见识）';
    sysP += '\n  · 多数行政领域之间有共通性——财政/人事/民政的底层逻辑相近，不应将其视为完全隔离的知识孤岛';
    sysP += '\n  · 真正的"外行"是：从未接触过、能力也低(对应值<40)、从政时间短的角色';
    sysP += '\n- character_deaths: 让任何角色死亡（包括玩家角色→游戏结束）';
    sysP += '\n- faction_changes: \u4FEE\u6539\u52BF\u529B\u5C5E\u6027\uFF08strength_delta\u5B9E\u529B\uFF0Ceconomy_delta\u7ECF\u6D4E\uFF0CplayerRelation_delta\u5BF9\u7389\u5173\u7CFB\u3002strength\u964D\u81F30\u2192\u52BF\u529B\u8986\u706D\uFF09';
    sysP += '\n- faction_events: 创造势力间自主事件（战争/联盟/政变/行军/围城等）';
    sysP += '\n  ⚠ 涉及行军/围城的事件，必须在geoData中提供地理推算数据！';
    sysP += '\n- faction_relation_changes: 改变势力间关系';
    sysP += '\n- party_changes: \u4FEE\u6539\u515A\u6D3E\u72B6\u6001\uFF08influence_delta\u5F71\u54CD\u529B\u3001new_status\u6D3B\u8DC3/\u5F0F\u5FAE/\u88AB\u538B\u5236/\u5DF2\u89E3\u6563\u3001new_leader\u9996\u9886\u66F4\u66FF\u3001new_agenda\u8BAE\u7A0B\u53D8\u5316\u3001new_shortGoal\u77ED\u671F\u76EE\u6807\u53D8\u5316\uFF09';
    sysP += '\n- class_changes: \u4FEE\u6539\u9636\u5C42\u72B6\u6001\uFF08satisfaction_delta\u6EE1\u610F\u5EA6\u3001influence_delta\u5F71\u54CD\u529B\u3001new_demands\u8BC9\u6C42\u968F\u5C40\u52BF\u53D8\u5316\u3001new_status\u5730\u4F4D\u53D8\u52A8\u3001partyOutcomeRef\u53EF\u6807\u6CE8\u515A\u6D3E\u80DC\u8D1F\u6765\u6E90\uFF09';
    sysP += '\n- class_alert_responses: \u56DE\u5E94\u9636\u5C42\u4E34\u754C\u8B66\u62A5\uFF08alertId\u3001action=address/defer/partial\u3001reason\uFF09';
    sysP += '\n- regent_decisions: \u6444\u653f\u51b3\u65ad\uFF08action\u3001subject\u3001regentName\u3001hardCeiling\u3001reason\uFF09';
    sysP += '\n- reissue_topics: \u5efa\u8bae\u5c06\u7559\u4e2d\u518c\u8bae\u9898\u8d77\u590d\u518d\u8bae\uff08topic\u3001reason\uff09';
    sysP += '\n- army_changes: 修改部队兵力/士气/训练/统帅（降至0→全军覆没；统帅或主将变更必须写 commander/newCommander，不能只写在叙事里）';
    sysP += '\n- item_changes: 让角色获得或失去物品';
    sysP += '\n- era_state_delta: 调整时代参数（社会稳定/经济/集权/军事等）';
    sysP += '\n- global_state_delta: 调整税压';
    sysP += '\n- office_changes: 官制人事变动（appoint任命/dismiss罢免/promote晋升/demote降级/transfer调任/evaluate考评/reform改革）';
    sysP += '\n- vassal_changes: 封臣关系变动（establish建立/break解除/change_tribute调整贡奉）';
    sysP += '\n- title_changes: 头衔爵位变动（grant册封/revoke剥夺/inherit继承需指定from来源角色/promote晋升）';
    sysP += '\n- building_changes: 建筑变动（build建造/upgrade升级/destroy拆除，需指定territory和type）';
    sysP += '\n- admin_changes: 行政区划变动——地方官任免(appoint_governor/remove_governor)和地方官自主治理效果(adjust: prosperity_delta繁荣/population_delta人口，反映该官员本回合的治绩)';
    sysP += '\n- admin_division_updates: 行政区划树结构变更。action类型：';
    sysP += '\n    add=新增行政区（推演中涉及史实存在但树中没有的行政区时必须用此添加，parentDivision指定上级）';
    sysP += '\n    remove=撤销行政区, rename=重命名, merge=合并(mergeInto指定目标), split=拆分(splitResult列出新名)';
    sysP += '\n    reform=行政改革(如四级变三级), territory_gain=获得领土, territory_loss=丢失领土';
    sysP += '\n    【重要】AI推演中如涉及树中尚未列出但史实存在的行政区划（如玩家提及某城、某州），应自动用add添加到对应上级下，数据参考史料';
    sysP += '\n    【重要】获得领土(territory_gain)的行政区会自动进入"未定行政区"临时节点，等待玩家决定管理方案';
    sysP += '\n    【重要】丢失领土(territory_loss)的行政区数据对玩家清零，不可管理';
    sysP += '\n- harem_events: \u540E\u5BAB\u4E8B\u4EF6\u3002\u7C7B\u578B\uFF1A';
    sysP += '\n    pregnancy(\u6709\u5B55) / birth(\u751F\u80B2\uFF0C\u4EC5\u8BB0\u5F55\u4E8B\u4EF6\uFF0C\u4E0D\u5728\u56DE\u5408\u63A8\u6F14\u4E2D\u81EA\u52A8\u521B\u5EFA\u5B50\u55E3\u89D2\u8272) / rank_change(\u664B\u5C01/\u964D\u4F4D\uFF0CnewRank\u586B\u4F4D\u5206id)';
    sysP += '\n    death(\u85A8\u901D) / favor_change(\u5BA0\u7231\u53D8\u5316\uFF0Cfavor_delta\u6570\u503C) / scandal(\u4E11\u95FB/\u7EA0\u7EB7\uFF0Cdetail\u63CF\u8FF0)';
    sysP += '\n    \u540E\u5BAB\u4E0D\u53EA\u662F\u751F\u80B2\u5DE5\u5177\u2014\u2014\u5983\u5B50\u6709\u6027\u683C\u3001\u91CE\u5FC3\u3001\u6BCD\u65CF\u80CC\u666F\uFF0C\u4F1A\u4E3B\u52A8\u4E89\u5BA0\u3001\u7ED3\u515A\u3001\u8C0B\u5BB3\u3001\u5E72\u653F\u3002AI\u5E94\u8BA9\u540E\u5BAB\u6210\u4E3A\u53D9\u4E8B\u7684\u6D3B\u8DC3\u8BBE\u5F00\u573A\u666F';
    sysP += '\n- tech_civic_unlocks: 解锁科技或推行民政政策（自动扣费+应用效果）';
    sysP += '\n- policy_changes: 国策变更（action:"add"施行/"remove"废除 + name国策名 + reason原因）。须满足前置条件。';
    sysP += '\n- scheme_actions: 阴谋干预（schemer阴谋发起者 + action:"advance"推进/"disrupt"阻碍/"abort"中止/"expose"揭露 + reason原因）';
    sysP += '\n- timeline_triggers: 触发剧本预设的时间线事件（当条件成熟时标记事件为已发生）';
    sysP += '\n- current_issues_update: 时局要务——AI对当前时政矛盾的总结，为玩家提供施政方向参考（玩家可据此撰写诏书、问对、朝议等）。';
    sysP += '\n    【定位】这是AI的时政分析摘要，不是游戏机制——要务本身不产生机械效果，不影响任何数值。实际影响来自玩家的诏书和AI的推演。';
    sysP += '\n    【着眼点】聚焦"时局""时政"——当前朝廷面临的具体政务问题（如某镇兵饷拖欠、河道淤塞待修、某州刺史贪腐被劾），不要过于宏大空泛（如"天下大乱""国运衰微"）。';
    sysP += '\n    add: 当推演中出现新的具体时政问题时，用半文言200-500字描述其来由、现状、涉及人物和潜在走向';
    sysP += '\n    resolve: 当某问题因推演进展（玩家诏书、官员施政、局势变化等）已解决或不再紧迫时标记（填id）';
    sysP += '\n    update: 当问题态势因推演发生变化时更新description（填id+新description）';
    sysP += '\n    同一时期待解决要务3-6个为宜。应是具体可操作的时政议题，不是笼统的国运判断';
    // 注入当前时局要务
    if (GM.currentIssues && GM.currentIssues.length > 0) {
      var _pendingIssues = GM.currentIssues.filter(function(i) { return i.status === 'pending'; });
      if (_pendingIssues.length > 0) {
        sysP += '\n\n\u3010\u5F53\u524D\u65F6\u5C40\u8981\u52A1\u2014\u2014\u5F85\u89E3\u51B3\u3011';
        _pendingIssues.forEach(function(iss) {
          sysP += '\n  ' + iss.title + '(' + (iss.category || '') + ' \u7B2C' + iss.raisedTurn + '\u56DE\u5408\u63D0\u51FA) id:' + iss.id;
        });
        sysP += '\n\u8BF7\u6839\u636E\u672C\u56DE\u5408\u63A8\u6F14\u68C0\u67E5\u4EE5\u4E0A\u8981\u52A1\u662F\u5426\u6709\u8FDB\u5C55\u6216\u5DF2\u89E3\u51B3\uFF0C\u5E76\u8BC6\u522B\u65B0\u51FA\u73B0\u7684\u91CD\u5927\u77DB\u76FE\u3002';
      }
    }
    sysP += '\n- office_changes中的任命必须考虑岗位继任方式：世袭岗位应由前任子嗣继承，流官由朝廷选拔，科举岗位应从进士中选，军功岗位从武将中选。';
    // ── 社会生灭周期（党派/势力/阶层的 create/dissolve） ──
    sysP += '\n【社会生灭周期——党派/势力/阶层可生可灭】';
    sysP += '\n  党派：party_create(新崛起) / party_splinter(分裂自既有) / party_merge(合流) / party_dissolve(覆灭)';
    sysP += '\n    崛起触发：社会基础变化(新阶层兴起)、领袖聚众、诏令催化、危机凝聚';
    sysP += '\n    覆灭触发：banned(查禁)/liquidated(肃清，血洗)/faded(自然消亡)/leaderKilled(领袖被杀而散)/absorbed(被吞并)';
    sysP += '\n  势力：faction_create(新建：独立/割据/称帝/复国) / faction_succession(首脑传承) / faction_dissolve(灭国/吞并)';
    sysP += '\n    崛起触发：母势力凝聚力<30时藩镇独立、农民起义建国、新兴族群复国、外敌割据、宗教势力建国';
    sysP += '\n    覆灭触发：conquered(被征服)/absorbed(和平并入)/collapsed(内部崩解)/seceded_all(分崩离析成多国)/replaced(被取代)';
    sysP += '\n    ※ 不得 faction_dissolve 玩家势力；玩家势力被灭应通过游戏结束事件处理';
    sysP += '\n  阶层：class_emerge(兴起) / class_revolt(起义) / class_dissolve(消亡)';
    sysP += '\n    兴起触发：经济变革(商人阶层兴起)、新兵制(军户兴起)、科举开放(寒门兴起)、新税制(某类人群地位升降)';
    sysP += '\n    消亡触发：abolished(法令废除如废贱籍)/assimilated(被吸收)/extincted(自然衰落如门阀消亡)/replaced(被新阶层取代)';
    sysP += '\n  【关键原则——历史模拟真实性】';
    sysP += '\n    · 必须有史实/推演内因——不得无故创建或消灭。理由必须写在 reason/triggerEvent 中';
    sysP += '\n    · 生灭事件应稀疏——一回合最多 1-2 个重大生灭事件；日常以 splinter/merge/relation_shift 为主';
    sysP += '\n    · 势力覆灭必须与战争/bigyear 事件呼应，不得凭空消失';
    sysP += '\n    · 阶层兴替跨度长——通常数十回合渐变，非一日之功；除非诏令明确废止（如"永禁贱籍"）才立即生效';
    sysP += '\n    · 新建时 leader/首脑须指向现有角色；不得在回合推演中自动创建新角色';
    sysP += '\n【官制人事·扩展动作】';
    sysP += '\n  promote: 晋升——填newRank(新品级)，可选newDept+newPosition(升任新职)';
    sysP += '\n  demote: 降级——填newRank';
    sysP += '\n  transfer: 调任——填newDept+newPosition（从当前职位调到新职位）';
    sysP += '\n  evaluate: 考评——由负责考察的官员NPC执行（吏部/都察院等）';
    sysP += '\n    evaluator: 考评者NPC名（必填！必须是负责考察的官员，不是被评者本人）';
    sysP += '\n    grade: 卓越/称职/平庸/失职';
    sysP += '\n    comment: 考评评语（以考评者NPC的口吻、偏见、立场写——不一定客观公正！）';
    sysP += '\n    ※ 考评是NPC行为，带有偏见：铨曹与被评者同派系→倾向好评；有私仇→可能恶评；受贿→掩盖真实情况';
    sysP += '\n    ※ 每3-5回合应对重要官员进行一次考评（不必每回合都评）';
    sysP += '\n  reform: 官制改革——reformDetail填"增设/裁撤/合并/拆分/改名/改制"等描述';
    sysP += '\n    玩家诏令中提及"增设某某""裁撤某某""将某某更名为某某""拆分某某为某某"→必须在office_changes中输出对应reform动作';
    sysP += '\n    增设新官职→reform + reformDetail:"增设" + dept:所属部门 + position:新官职名';
    sysP += '\n    增设新部门→reform + reformDetail:"增设" + dept:新部门名';
    sysP += '\n    裁撤→reform + reformDetail:"裁撤" + dept:被裁部门名';
    sysP += '\n    改名→reform + reformDetail:"改名" + dept:旧名 + newDept:新名';
    sysP += '\n    拆分→reform + reformDetail:"拆分" + dept:原部门名 + splitInto:[{name,positions:[]},...]';
    sysP += '\n    合并→reform + reformDetail:"合并" + dept:被并入部门 + intoDept:目标部门（被并入者下级/positions合并到目标）';
    sysP += '\n    改制(一揽子改革)→reform + reformDetail:"改制" + restructurePlan:[{action,dept,...}]——承载多原子动作';
    // ── 官制占位实体化 ──
    sysP += '\n【官制占位实体化——office_spawn】';
    sysP += '\n  编辑器生成官制时按史料记载的编制/缺员/在职人数，但并非每个在职者都有角色内容——actualHolders 中 generated:false 的是"在职但无具体角色"占位';
    sysP += '\n  触发条件：当推演/玩家诏令涉及某官职，而该 position 的 actualHolders 中有 generated:false 占位时，必须输出 office_spawn 条目将一个占位实体化';
    sysP += '\n  生成原则：';
    sysP += '\n    · 姓名按本朝代命名习惯（不得与现有角色重名）';
    sysP += '\n    · 【品级与能力不强绑】——主流任职者能力中上(主维度 55-80)，但必须保留以下 6 种史实变体：';
    sysP += '\n        潜龙未用(低品大才 adm 90+)、贬谪名臣(低品曾为高官)、寒门新进(低品朝气)、';
    sysP += '\n        恩荫庸才(高品低才 adm 30-50)、外戚宦官(品高才陋但权重)、隐士起用(能力极高但低调)';
    sysP += '\n    · 若该职有特定能力倾向（武职→military/valor高；吏职→administration高；御史→intelligence高），相应维度+10';
    sysP += '\n    · age 与品级无强绑，按人物类型：恩荫少年(20-35)、寒门新进(25-40)、历练老臣(50-70)、名宿(60-80)';
    sysP += '\n    · loyalty 按出身：恩荫/近侍 55-75；寒门新进 60-80；贬谪起复 30-60；潜龙出山 50-80';
    sysP += '\n  使用限制：';
    sysP += '\n    · 不得为已有 generated:true 的位置 spawn（那是史实人物，不可替换）';
    sysP += '\n    · 一回合最多 spawn 3-5 个（避免暴发式造人）';
    sysP += '\n    · 纯叙事提及而无实际操作涉及的职位，不必 spawn';
    sysP += '\n【任命制度约束——必须遵守】';
    sysP += '\n  · 品级递升：不得越级提拔太多（如从九品直升三品，除非有特殊功勋）';
    sysP += '\n  · 出身约束：科举出身可任文官，军功出身可任武官，荫庇出身品级有上限';
    sysP += '\n  · 回避制度：本籍不宜任本地官（可被皇帝特旨豁免）、亲属不宜同部门';
    sysP += '\n  · 空缺不一定坏：有时空缺是权力斗争的结果，不必急于填补';
    // ── 品级体系 ──
    sysP += '\n【品级体系——18级制】';
    sysP += '\n  正一品(最高)→从一品→正二品→…→从九品(最低)。品级越高，俸禄越多，权力越大。';
    sysP += '\n  晋升规则：正常每次升1-2级（如从五品→正五品→从四品）。跃升3级以上需特殊功勋。';
    sysP += '\n  promote/demote动作的newRank必须是合理的品级（如"从三品"而非自创品级）。';
    // ── 差遣与寄禄 ──
    sysP += '\n【差遣与寄禄分离】';
    sysP += '\n  差遣(actual job)：实际管事的职务（如"知开封府""判户部"）';
    sysP += '\n  寄禄(salary rank)：拿俸禄的虚衔（如"银青光禄大夫""朝散大夫"）';
    sysP += '\n  同一人可能差遣低而寄禄高（有品级无实权）或差遣高而寄禄低（有权无品）。';
    sysP += '\n  在office_changes的appoint/promote中，position是差遣，rank是寄禄品级。';
    // ── 考课制度 ──
    sysP += '\n【考课制度——周期性考核】';
    sysP += '\n  每5回合应由负责考察的部门（吏部/都察院/御史台）对所有在任官员进行一次考评。';
    sysP += '\n  通过office_changes的evaluate动作输出，evaluator必须是考察部门的NPC。';
    sysP += '\n  考评标准：德行（清廉/贪腐）、才能（政绩好坏）、勤惰（是否尽职）。';
    sysP += '\n  考评结果影响后续任命：卓越→优先晋升；失职→应降级或罢免。';
    var _turnMod5 = GM.turn % 5;
    if (_turnMod5 === 0 && GM.turn > 0) {
      sysP += '\n  ※ 本回合是考课之期（每5回合一次）——必须输出evaluate动作，覆盖所有在任重要官员！';
    }
    // ── 任期轮换 ──
    sysP += '\n【任期轮换】';
    sysP += '\n  地方官任期一般3年（约10-15回合）。任期满后应轮换调任。';
    // 注入任期超期官员
    var _overTermOfficials = [];
    (function _checkTerm(nodes, dName) {
      nodes.forEach(function(n) {
        (n.positions||[]).forEach(function(p) {
          if (p.holder) {
            var ch = findCharByName(p.holder);
            var tk = (dName||n.name) + p.name;
            var tenure = (ch && ch._tenure && ch._tenure[tk]) || 0;
            if (tenure > 12) _overTermOfficials.push({ name: p.holder, dept: n.name, pos: p.name, tenure: tenure });
          }
        });
        if (n.subs) _checkTerm(n.subs, n.name);
      });
    })(GM.officeTree||[]);
    if (_overTermOfficials.length > 0) {
      sysP += '\n  以下官员任期已超标准（>12回合），吏部应上奏建议轮换或留任：';
      _overTermOfficials.forEach(function(o) {
        sysP += '\n    ' + o.name + '（' + o.dept + o.pos + '，任期' + o.tenure + '回合）';
      });
    }
    // ── 丁忧/服丧 ──
    sysP += '\n【丁忧/服丧制度】';
    sysP += '\n  官员父母去世→该官员必须离职守丧（称"丁忧"），持续约9回合。';
    sysP += '\n  皇帝可"夺情"——强令该官员不守丧继续任职，但会引起极大争议（朝臣可能弹劾）。';
    sysP += '\n  当character_deaths中有人去世时，检查是否有在任官员是其子女→应在office_changes中dismiss该官员（reason:"丁忧"）。';
    // ── 荫补/恩荫 ──
    sysP += '\n【荫补/恩荫制度】';
    sysP += '\n  三品以上官员的子弟可通过荫补入仕，不经科举。荫补出身品级较低（通常从八品起）。';
    sysP += '\n  这是重要的人才来源，也是腐败温床——荫补者未必有才能。';
    sysP += '\n  在npc_actions中可体现：高官为子弟求荫补（behaviorType: "recommend"），或谏官弹劾荫补滥用。';
    // ── 冗官/空缺主动性 ──
    sysP += '\n【冗官与空缺——AI应主动关注】';
    var _vacantCount = 0, _totalOff = 0;
    (function _vc(ns) { ns.forEach(function(n) { (n.positions||[]).forEach(function(p) { _totalOff++; if (!p.holder) _vacantCount++; }); if (n.subs) _vc(n.subs); }); })(GM.officeTree||[]);
    if (_vacantCount > 0) sysP += '\n  当前有' + _vacantCount + '个职位空缺（共' + _totalOff + '个），吏部应通过奏疏催促填补关键空缺。';
    if (_totalOff > 30) sysP += '\n  官僚机构庞大（' + _totalOff + '员），可能存在冗官问题——有识之臣可能上疏建议精简。';
    // ── 致仕/退休 ──
    sysP += '\n【致仕/退休制度】';
    sysP += '\n  年迈（>60岁）或疲惫（stress>70）或失意的官员可请求致仕。';
    sysP += '\n  通过奏疏上疏请求（type:"人事" subtype:"上疏"）：\u201C臣年老力衰，乞骸骨归田\u201D';
    sysP += '\n  皇帝批复选项：准奏→恩赐归田（忠诚+）；驳回挽留→加官留任（压力+）；赐金还乡→厚礼送行（忠诚++）';
    sysP += '\n  AI应让符合条件的老臣每隔数回合请求致仕。被拒绝后可能续奏死谏。';
    // 注入年迈/高压力官员
    var _retireCandidates = [];
    (function _rc(nodes) {
      nodes.forEach(function(n) {
        (n.positions||[]).forEach(function(p) {
          if (p.holder) {
            var _rch = findCharByName(p.holder);
            if (_rch && ((_rch.age && _rch.age > 60) || (_rch.stress||0) > 70)) {
              _retireCandidates.push({ name: p.holder, age: _rch.age||'?', stress: _rch.stress||0, dept: n.name, pos: p.name });
            }
          }
        });
        if (n.subs) _rc(n.subs);
      });
    })(GM.officeTree||[]);
    if (_retireCandidates.length > 0) {
      sysP += '\n  以下官员可能请求致仕：';
      _retireCandidates.forEach(function(r) { sysP += '\n    ' + r.name + '（' + r.dept + r.pos + '，年' + r.age + '岁，压力' + r.stress + '）'; });
    }
    // ── 举主连坐 ──
    sysP += '\n【举主连坐制度】';
    sysP += '\n  推荐他人入仕的官员（举主）需为被推荐者的表现负责。';
    sysP += '\n  appoint时可在reason中注明"由某某举荐"——系统会记录推荐关系。';
    sysP += '\n  考评时若被推荐者为"失职"，AI应在叙事/npc_actions中追究举主责任。';
    sysP += '\n  弹劾某官员时可连带弹劾其举主："举人不当"。';
    // ── 派系控制朝堂 ──
    var _factionControl = {};
    (function _fc(nodes) {
      nodes.forEach(function(n) {
        (n.positions||[]).forEach(function(p) {
          if (p.holder) {
            var _fch = findCharByName(p.holder);
            if (_fch && _fch.faction) {
              if (!_factionControl[_fch.faction]) _factionControl[_fch.faction] = { count: 0, key: 0, depts: {} };
              _factionControl[_fch.faction].count++;
              var _rl3 = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 10;
              if (_rl3 <= 6) _factionControl[_fch.faction].key++; // 从三品以上=关键职位
              _factionControl[_fch.faction].depts[n.name] = (_factionControl[_fch.faction].depts[n.name]||0) + 1;
            }
          }
        });
        if (n.subs) _fc(n.subs);
      });
    })(GM.officeTree||[]);
    var _fcKeys = Object.keys(_factionControl);
    if (_fcKeys.length > 0) {
      sysP += '\n【朝堂派系控制格局——影响权力斗争】';
      _fcKeys.sort(function(a,b) { return _factionControl[b].key - _factionControl[a].key; });
      _fcKeys.forEach(function(fk) {
        var fc = _factionControl[fk];
        var deptList = Object.keys(fc.depts).map(function(d){ return d + '(' + fc.depts[d] + '人)'; }).join('、');
        sysP += '\n  ' + fk + '：控制' + fc.count + '个官职（关键职位' + fc.key + '个）——' + deptList;
      });
      sysP += '\n  强势派系会排挤异己、安插亲信。弱势派系会联合反抗或暗中串联。';
      sysP += '\n  AI在office_changes的appoint中应反映派系争夺：吏部被某派控制→推荐该派之人。';
    }
    // ── 各部门聚合数据（双层模型）——AI必须据此推演 ──
    if (GM.officeTree && GM.officeTree.length > 0 && typeof _offDeptStats === 'function') {
      sysP += '\n【各部门人员聚合——双层模型】';
      sysP += '\n  每个部门有"编制/实有/具象/缺员"四个数字。"具象"是有完整角色数据的官员，"实有-具象"是在任但无角色数据的官员。';
      sysP += '\n  推演规则：';
      sysP += '\n  · 未具象官员以部门整体数字参与推演——如"兵部查出4人贪腐"，其中具象的指名，其余用数字';
      sysP += '\n  · 叙述格式："甲等有张三等3人，乙等有李四等9人，丙等12人"——具象角色必须点名';
      sysP += '\n  · 缺员变动通过office_aggregate输出（actualCount_delta），不需要为每个补缺者创建角色';
      sysP += '\n  · 如AI推演中某未具象官员做了有名有姓的重要事（弹劾/立功/叛变），才需要赋予名字（在char_updates中新增角色）';
      GM.officeTree.forEach(function(d) {
        var st = _offDeptStats(d);
        if (st.headCount > 0) {
          sysP += '\n  ' + d.name + '：编制' + st.headCount + ' 实有' + st.actualCount + ' 具象' + st.materialized + ' 缺' + st.vacant;
          if (st.holders.length > 0) sysP += '（' + st.holders.join('、') + '）';
        }
      });
    }
    // ── office_aggregate输出字段说明 ──
    sysP += '\n【office_aggregate——部门聚合事件（双层模型专用）】';
    sysP += '\n  用于不涉及具体角色的部门级变动：';
    sysP += '\n  · actualCount_delta: 实有人数变化（有司递补+N/离职-N）';
    sysP += '\n  · evaluation_summary: {excellent:N,good:N,average:N,poor:N,named_excellent:["张三"],named_good:["李四"]}';
    sysP += '\n  · corruption_found: 查出贪腐人数, named_corrupt: ["具象贪腐者"]';
    sysP += '\n  · narrative: 混合叙述文本（具象角色点名+其余用数字）';

    // 科举政治维度
    if (P.keju && P.keju.enabled) {
      sysP += '\n\n【科举政治·重要】';
      sysP += '\n科举是政治斗争的核心战场，但一切关系都是倾向而非绝对：';
      sysP += '\n- 门生-座主：新进士对座师有好感倾向，但忠正之士可能不屑攀附，野心家可能背叛座师。座师也并非无条件庇护门生。';
      sysP += '\n- 天子门生：殿试前三名（状元榜眼探花）为天子亲策，对君主有额外感恩，但这不意味着绝对忠诚。';
      sysP += '\n- 同年之谊：同科进士之间有天然亲近感，可能互相帮衬，也可能在党争中对立。';
      sysP += '\n- 考官之争：各党派会争夺主考官位置（因为主考官能影响取士倾向），这是政斗焦点。';
      sysP += '\n- 拉拢新人：党派会试图拉拢新进士，但能否成功取决于进士的性格、理想和利益判断。';
      sysP += '\n- 科举舞弊：考官可能徇私、泄题。对立面会弹劾。通过npc_actions/event生成。';
      sysP += '\n- 取士结构：寒门多→民心升但士族怨；士族多→反之。这会激化阶层矛盾。';
      if (P.keju.history && P.keju.history.length > 0) {
        var _lastK = P.keju.history[P.keju.history.length - 1];
        sysP += '\n上科状元:' + (_lastK.topThree?_lastK.topThree[0]:'') + ' 主考:' + (_lastK.chiefExaminer||'') + (_lastK.examinerParty ? '('+_lastK.examinerParty+')' : '');
      }
    }
    sysP += '\n- map_changes: 领地变更';
    sysP += '\n请根据推演情况积极使用这些权力，让世界活起来。不要只返回空数组。';

    var url=P.ai.url;if(url.indexOf("/chat/completions")<0)url=url.replace(/\/+$/,"")+"/chat/completions";

    // ═══ 动态 max_tokens 上限 ═══
    // 优先级：玩家手动设置 > 检测到的模型输出上限 > 白名单匹配 > 保守兜底
    // _tok(baseTok) 返回 undefined 表示不传 max_tokens（让模型自由发挥）
    // 仅在玩家手动设置且有效时才传 max_tokens；否则不传，依赖模型默认行为
    var _tokCp = (typeof getCompressionParams === 'function') ? getCompressionParams() : {scale:1.0,contextK:32};
    // 计算生效的输出上限（tokens）——用于限流与截断预警
    function _getEffectiveOutputLimit() {
      // 1. 玩家手动
      if (P.conf.maxOutputTokens && P.conf.maxOutputTokens > 0) return P.conf.maxOutputTokens;
      // 2. 检测值
      if (P.conf._detectedMaxOutput && P.conf._detectedMaxOutput > 0) return P.conf._detectedMaxOutput;
      // 3. 白名单回退
      if (typeof _matchModelOutput === 'function') {
        var wl = _matchModelOutput(P.ai.model || '');
        if (wl > 0) return wl * 1024;
      }
      // 4. 兜底：上下文的1/8，最低4096
      return Math.max(4096, Math.round(_tokCp.contextK * 1024 / 8));
    }
    var _effectiveOutCap = _getEffectiveOutputLimit();
    // _tok(baseTok) 只在玩家手动设置时才返回具体值；否则返回 undefined 让模型自由
    function _tok(baseTok) {
      // 玩家手动设置——必须遵守（不让模型超限）
      if (P.conf.maxOutputTokens && P.conf.maxOutputTokens > 0) {
        return Math.max(500, Math.min(baseTok, P.conf.maxOutputTokens));
      }
      // 自动模式：不传 max_tokens，让模型自己决定
      return undefined;
    }
    // fetch 辅助：若 _tok() 返回 undefined，body 中不加 max_tokens 字段
    function _buildFetchBody(model, messages, temperature, baseTok, extra) {
      var body = {model:model, messages:messages, temperature:temperature};
      var mt = _tok(baseTok);
      if (mt !== undefined) body.max_tokens = mt;
      if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) body[k] = extra[k];
      return body;
    }
    // 截断检测：在每次 fetch 响应后调用
    var _truncatedOnce = false;
    function _checkTruncated(data, label) {
      if (_truncatedOnce) return; // 一次回合只提示一次
      if (!data || !data.choices || !data.choices[0]) return;
      var fr = data.choices[0].finish_reason || data.choices[0].stop_reason;
      if (fr === 'length' || fr === 'max_tokens') {
        _truncatedOnce = true;
        if (typeof toast === 'function') {
          toast('⚠ AI输出被截断(' + (label||'') + ')，建议在设置中增大"AI输出上限"或换用大窗口模型');
        }
        _dbg('[Truncated]', label, 'finish_reason=', fr);
      }
    }
    _dbg('[TokenLimit] 生效输出上限:', _effectiveOutCap, 'tokens | 手动:', P.conf.maxOutputTokens||0, '检测:', P.conf._detectedMaxOutput||0);

    // ============================================================
    // 1.3: 跨回合记忆摘要注入（最近3条摘要，覆盖15-50回合历史）
    // ============================================================
    if (GM._aiMemorySummaries && GM._aiMemorySummaries.length > 0) {
      sysP += '\n\n【历史回顾摘要（跨回合AI记忆）】';
      GM._aiMemorySummaries.slice(-3).forEach(function(ms) {
        sysP += '\n' + ms.summary;
      });
    }

    // ============================================================
    // 1.4: 幻觉防火墙——名称白名单注入
    // 明确列出当前存活角色和有效地名，要求AI只使用名单内名称
    // ============================================================
    (function _hallucinationFirewall() {
      // 存活角色白名单
      var _aliveNames = (GM.chars || []).filter(function(c) { return c.alive !== false; }).map(function(c) { return c.name; });
      if (_aliveNames.length > 0) {
        if (_aliveNames.length <= 60) {
          sysP += '\n\n【当前存活角色完整名单（严禁使用名单外的人名）】';
          sysP += '\n' + _aliveNames.join('、');
        } else {
          // 大型剧本：只列出重要角色（有官职或高重要度的）
          var _importantNames = (GM.chars || []).filter(function(c) {
            return c.alive !== false && (c.officialTitle || (c.importance || 0) > 50 || c.isPlayer);
          }).map(function(c) { return c.name; });
          if (_importantNames.length > 0) {
            sysP += '\n\n【重要角色名单（严禁虚构不存在的人名，另有' + (_aliveNames.length - _importantNames.length) + '名次要角色未列出）】';
            sysP += '\n' + _importantNames.join('、');
          }
        }
      }
      // 有效地名白名单（从行政区划收集）
      if (P.adminHierarchy) {
        var _placeNames = [];
        Object.keys(P.adminHierarchy).forEach(function(k) {
          var ah = P.adminHierarchy[k];
          if (ah && ah.divisions) (function _w(divs) {
            divs.forEach(function(d) { if (d.name) _placeNames.push(d.name); if (d.children) _w(d.children); if (d.divisions) _w(d.divisions); });
          })(ah.divisions);
        });
        if (_placeNames.length > 0 && _placeNames.length <= 80) {
          sysP += '\n\n【当前有效地名名单（严禁虚构不存在的地名）】';
          sysP += '\n' + _placeNames.join('、');
        }
      }
    })();

    // 1.2: 模型适配——获取默认温度和JSON包裹格式
    var _modelTemp = P.ai.temp || (typeof ModelAdapter !== 'undefined' ? ModelAdapter.getDefaultTemp() : 0.8);
    var _modelFamily = (typeof ModelAdapter !== 'undefined') ? ModelAdapter.detectFamily(P.ai.model) : 'openai';

    // 1.6: 记录回合开始token
    if (typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.markTurnStart();

    // 1.1 措施3-4: Prompt分层压缩——缓存固定层，限制速变层
    if (typeof PromptLayerCache !== 'undefined') {
      // 记录本次sysP长度供调试
      DebugLog.log('ai', '[PromptLayer] sysP总长:' + sysP.length + '字符, hash:' + PromptLayerCache.computeHash().substring(0, 20));
      // 缓存固定层hash——下回合可用于判断是否需要重建
      PromptLayerCache.getFixedLayer(function() { return sysP.substring(0, 2000); }); // 缓存前2000字符（朝代设定/规则等固定部分）
    }

    // 7.2: prompt去重——如果固定层与上回合相同，标注给AI"延续上回合"
    if (typeof PromptLayerCache !== 'undefined') {
      var _fixedHash = PromptLayerCache.computeHash();
      if (GM._lastSysPHash && GM._lastSysPHash === _fixedHash) {
        tp += '\n（系统提示：本回合世界设定/角色配置与上回合完全相同，请基于上回合状态延续推演）\n';
      }
      GM._lastSysPHash = _fixedHash;
    }

    // 安全检查：sysP长度过大时截断低优先级段落（每字符约0.5 token，sysP超过contextK*512字符则需截断）
    var _sysPMaxChars = _tokCp.contextK * 512;
    if (sysP.length > _sysPMaxChars) {
      _dbg('[Prompt] sysP过长(' + sysP.length + '字符)，截断到' + _sysPMaxChars);
      sysP = sysP.substring(0, _sysPMaxChars) + '\n...(系统提示过长，部分参考信息已截断)';
    }

    // ===== 写入 ctx.prompt =====
    ctx.prompt.sysP = sysP;
    // R209a·tp 是 §3 sub-call prompt 的 base (ai-infer L229 tp0·L848 tp1 等使用)·必 export
    // (per Codex P7-β addendum·避 ad hoc cross-module dep)
    ctx.prompt.tp = tp;
    ctx.prompt.sc = sc;
    ctx.prompt._shiluR = _shiluR;
    ctx.prompt._shiluMin = _shiluMin;
    ctx.prompt._shiluMax = _shiluMax;
    ctx.prompt._szjR = _szjR;
    ctx.prompt._szjMin = _szjMin;
    ctx.prompt._szjMax = _szjMax;
    ctx.prompt._hourenR = _hourenR;
    ctx.prompt._hourenMin = _hourenMin;
    ctx.prompt._hourenMax = _hourenMax;
    ctx.prompt._zwR = _zwR;
    ctx.prompt._zwMin = _zwMin;
    ctx.prompt._zwMax = _zwMax;
    ctx.prompt._commentR = _commentR;
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
