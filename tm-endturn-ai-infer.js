// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-ai-infer.js — 回合 AI 推演巨函数 (R110 从 tm-endturn.js L2186-12711 拆出)
//
// ⚠ 此文件仅有一个函数：async function _endTurn_aiInfer(edicts, xinglu, memRes, oldVars)
//   长约 11,330 行（更新于 2026-04-28）·是项目最大的单函数·包含 sysP prompt 构建 + sc1/sc1b/sc1c 三次 AI 子调用
//   + 所有 AI 返回字段的写回逻辑 (char_updates/factions/offices/fiscal/admin/events/harem 等)
//
// 后续工作：按 AI schema 字段族进一步拆成 tm-ai-apply-chars/factions/offices/fiscal/admin/events/harem.js
//   需先为每个字段族写 pre/post 行为快照·现阶段先做文件级隔离·内部不动
//
// 姊妹: tm-endturn-prep.js (L1-2185·前置) + tm-endturn-core.js (L12712-end·入口)
//
// R147 章节导航（更新于 2026-04-28·替代死代码为数据驱动 lifecycle 块约 80 行）：
//   §1 [L17-3120]   入参初始化 + sysP prompt 构建（包含 lifecycle 块 L54-130）
//   §2 [L3121-3200] Sub-call 注册化基础设施（_runSubcall + 共享变量声明）
//   §3 [L3201-5055] sc0/sc05/sc1/sc1b/sc1c 子调用（深度思考/记忆/主推演/文事/势力）
//   §4 [L5056-9580] sc1 写回（applyAITurnChanges + 各字段族 GM 落地）
//   §5 [L9581-end]  sc15-sc27 后续子调用 + 收尾（NPC/势力/财政/军事/审计/丰化/叙事）
// ============================================================

async function _endTurn_aiInfer(edicts, xinglu, memRes, oldVars) {
  // ═══════════════════════════════════════════════════════════
  // §1 入参初始化 + sysP prompt 构建
  // ═══════════════════════════════════════════════════════════
  var shizhengji="",zhengwen="",playerStatus="",playerInner="",turnSummary="";
  // 新增字段：实录、时政记标题/总结、人事变动、后人戏说
  var shiluText="",szjTitle="",szjSummary="",personnelChanges=[],hourenXishuo="";
  var timeRatio = getTimeRatio();

  // 2. AI推演
  if(P.ai.key){
    // 严格史实模式：检索数据库
    if(P.conf.gameMode === 'strict_hist' && P.conf.refText) {
      showLoading("检索数据库中",20);
      await new Promise(resolve => setTimeout(resolve, 300)); // 模拟检索延迟
    }

    showLoading("\u6253\u5305\u6570\u636E",25);
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
    var _perTurn = P.time && P.time.perTurn || '1m';
    if (_perTurn !== '1d') {
      var _seasonIdx = 0;
      if (P.time && P.time.startMonth) {
        var _curMonth = ((P.time.startMonth - 1 + (GM.turn - 1) * (_perTurn === '1m' ? 1 : _perTurn === '1s' ? 3 : 12)) % 12) + 1;
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
      var _recentIntel = GM._interceptedIntel.filter(function(i) { return (GM.turn - i.turn) <= 3; });
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
          var _recentUndel = GM._undeliveredLetters.filter(function(u) { return (GM.turn - u.turn) <= 2; });
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
      var _unverified = GM._npcClaims.filter(function(c) { return !c.verified && (GM.turn - c.turn) <= 5; });
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
      var _recentAch = GM._achievements.filter(function(a) { return GM.turn - a.turn <= 2; });
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
    tp += '  · 财政调整（赐金/征发/专款/缴获/贡品/赔款/罚没/赈济）→ fiscal_adjustments:[{target:"guoku|neitang|province:X",kind:"income|expense",resource:"money|grain|cloth",amount,name,reason,recurring:false}]\n';
    tp += '    ★【强制·核心 bug 历史教训】任何钱/粮/布流动——无论是玩家诏令所引（赏银万两·赈粮千石·修宫殿·发军饷）·还是推演中的 NPC 行为（贪污·贡纳·缴获·赔款·走私入库）·必须一条一条写入 fiscal_adjustments·绝不可只在叙事/戏说/实录里提及数字而不落账\n';
    tp += '    ★ 常见映射：皇帝赐赏私人→target:neitang/kind:expense；诏令赈济地方→target:guoku/kind:expense；战争缴获→target:guoku/kind:income；地方贡物→target:guoku/kind:income（贵重珍宝则 neitang）；抄家罚没→guoku 或 neitang（视情）\n';
    tp += '    ★ recurring:true 只用于长期年例（如"岁赐辽东饷三十万"）；一次性赏赐/赈济/缴获 recurring:false（立刻作用于余额，不续）\n';
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
    tp += '    · 募兵/调兵/出征 → military_changes 或 fiscal_adjustments 含征调记录\n';
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
      if (GM._lastChangchaoDecisions && GM._lastChangchaoDecisions.length > 0) {
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
        GM._lastChangchaoDecisions.forEach(function(d) {
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
      for (var _t = Math.max(0, GM.turn - 5); _t <= GM.turn; _t++) { if (_ccCount[_t]) _recentCC += _ccCount[_t]; }
      if (_recentCC === 0 && GM.turn > 3) {
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
    tp += "  ■ AI可通过new_characters安排子嗣出生，子女姓名由AI起名需合乎时代\n";
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

    var sysP=P.ai.prompt||"\u4F60\u662F\u5386\u53F2\u6A21\u62DFAI\u3002\u5267\u672C:"+(sc?sc.name:"")+"\u65F6\u4EE3:"+(sc?sc.era:"")+"\u89D2\u8272:"+(sc?sc.role:"")+"\n\u96BE\u5EA6:"+P.conf.difficulty+"\u6587\u98CE:"+P.conf.style+gameModeDesc+historicalCharLimit;

    // 6.2: 叙事风格锁定
    var _narrativeGuide = '';
    var _modeP = (typeof _getModeParams === 'function') ? _getModeParams() : {};
    if (_modeP.narrativeStyle && _modeP.narrativeStyle.indexOf('\u8D44\u6CBB\u901A\u9274') >= 0) {
      _narrativeGuide = '\n【叙事风格·严格文言】仿《资治通鉴》体例。用词典雅，句式简洁。禁用一切现代词汇（如：OK、搞定、给力、没问题、怎么说、不错、厉害）。对话用"曰""言""谓"引述。';
    } else if (_modeP.narrativeStyle && _modeP.narrativeStyle.indexOf('\u534A\u6587\u8A00') >= 0) {
      _narrativeGuide = '\n【叙事风格·半文言】融合文言与白话。叙事用文言，对话可用浅显白话。禁用网络用语和明显现代词汇。';
    } else {
      _narrativeGuide = '\n【叙事风格·演义体】仿《三国演义》章回体风格。叙事可白话，但保留古典韵味。禁用网络用语。';
    }
    // 编辑器配置的风格范文
    if (P.chronicleConfig && P.chronicleConfig.styleSample) {
      _narrativeGuide += '\n\u3010\u98CE\u683C\u8303\u6587\uFF08\u53C2\u7167\u6B64\u6587\u98CE\uFF09\u3011' + P.chronicleConfig.styleSample;
    }
    sysP += _narrativeGuide;

    // 1.7: 注入编辑器自定义的Prompt前缀
    if (P.promptOverrides && P.promptOverrides.systemPrefix) {
      sysP = P.promptOverrides.systemPrefix + '\n\n' + sysP;
    }

    // ── T2: 时间粒度感知 ──
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var _granLabel = _dpv <= 7 ? '微观（日/周）' : _dpv <= 60 ? '中观（月）' : '宏观（季/年）';
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
    sysP += '\n\u203BNPC\u884C\u52A8\u6761\u6570\u4E0D\u56E0\u7C92\u5EA6\u53D8\u5316\uFF08\u4FDD\u63015-10\u6761\uFF09\uFF0C\u53EA\u662F\u63CF\u8FF0\u7C92\u5EA6\u4E0D\u540C\u3002';

    // 注入编年史仿写风格（影响AI叙事笔法）
    if (P.chronicleConfig && P.chronicleConfig.style) {
      var _styleNames = {biannian:'编年体(仿《资治通鉴》)',shilu:'实录体(仿各朝实录)',jizhuan:'纪传体(仿《史记》)',jishi:'纪事本末体(仿《通鉴纪事本末》)',biji:'笔记体(仿《世说新语》)',custom:P.chronicleConfig.customStyleDesc||'自定义'};
      sysP += '\n叙事笔法：' + (_styleNames[P.chronicleConfig.style] || P.chronicleConfig.style);
    }
    // ★ 时空约束（防 AI 用未来史实知识·防 NPC 说还活着的人已死）
    if (typeof _buildTemporalConstraint === 'function') {
      try { sysP += _buildTemporalConstraint(null); } catch(e){ if(window.TM&&TM.errors) TM.errors.capture(e,'endturn.buildTemporalConstraint'); }
    }

    // ★ 长期行动摘要（aiDigestLongTermActions 生成·完整长期诏书+编年+旅程）
    if (GM._longTermDigest && GM._longTermDigest.text) {
      sysP += '\n\n【长期行动与诏书·持续效果·AI 必读必用】\n' + GM._longTermDigest.text;
      sysP += '\n★ 规则：所有长期诏书每回合都必须体现效果·不可忘记。效果可正可负·可前好后坏或反之。在 shizhengji/zhengwen 中体现·在 var_changes 中实化。';
    }

    // ★ 三系统运行时状态（势力 lifePhase·党派 influence/officeCount·军队 mutinyRisk）
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

    // 4.5: 党派内部动态
    if (GM._partyDynamics && GM._partyDynamics.length > 0) {
      sysP += '\n\n【党派内部动态（AI应在叙事中反映）】';
      GM._partyDynamics.forEach(function(d) { sysP += '\n- ' + d.desc; });
    }

    // 6.1: 伏笔/回收系统——注入未回收伏笔列表（与编年纪事联动）
    if (GM._foreshadowings && GM._foreshadowings.length > 0) {
      var _unresolvedFsList = GM._foreshadowings.filter(function(f) { return !f.resolved; });
      var _recentResolved = GM._foreshadowings.filter(function(f) { return f.resolved && GM.turn - (f.resolveTurn||0) <= 3; });
      if (_unresolvedFsList.length > 0 || _recentResolved.length > 0) {
        sysP += '\n\n\u3010\u6697\u7EBF\u4F0F\u7B14\u8FFD\u8E2A\uFF08AI\u5185\u90E8\u53D9\u4E8B\u5DE5\u5177\uFF0C\u4E0D\u76F4\u63A5\u544A\u77E5\u73A9\u5BB6\uFF0C\u5E94\u5728\u53D9\u4E8B\u4E2D\u81EA\u7136\u5448\u73B0\uFF09\u3011';
        // 未回收伏笔
        if (_unresolvedFsList.length > 0) {
          sysP += '\n\u25A0 \u672A\u56DE\u6536\u4F0F\u7B14\uFF1A';
          _unresolvedFsList.forEach(function(f) {
            var age = GM.turn - (f.plantTurn || GM.turn);
            var urgency = age > 20 ? '\u26A0\u4E45\u60AC' : age > 10 ? '\u6E10\u70ED' : '\u6F5C\u4F0F';
            sysP += '\n  [' + urgency + '/' + (f.type||'mystery') + '] ' + f.content;
            if (f.resolveCondition) sysP += ' (\u6761\u4EF6:' + f.resolveCondition + ')';
            // 联动编年纪事：引用植入时附近的事件作为线索来源
            var _nearEvents = (GM.evtLog||[]).filter(function(e){ return Math.abs(e.turn - f.plantTurn) <= 1 && e.type !== '\u6697\u7EBF'; });
            if (_nearEvents.length > 0) sysP += ' [\u540C\u671F\u7EAA\u4E8B:' + _nearEvents.map(function(e){return e.text;}).join('/') + ']';
          });
          var _urgentCount = _unresolvedFsList.filter(function(f) { return (GM.turn - (f.plantTurn||GM.turn)) > 20; }).length;
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
    if ((!GM._tyrantDecadence || GM._tyrantDecadence < 15) && GM.turn > 3) {
      // 检查近5回合是否持续勤政（有政令+无昏君活动）
      var _diligentTurns = 0;
      for (var _dt = Math.max(1, GM.turn - 5); _dt <= GM.turn; _dt++) {
        var _qj = (GM.qijuHistory || []).find(function(q) { return q.turn === _dt; });
        if (_qj && _qj.edicts && (_qj.edicts.political || _qj.edicts.military || _qj.edicts.economic)) _diligentTurns++;
      }
      if (_diligentTurns >= 3) {
        sysP += '\n\u3010\u660E\u541B\u56F0\u5883\u3011\u73A9\u5BB6\u8FDE\u7EED\u52E4\u653F\u3002\u53D9\u4E8B\u5E94\u4F53\u73B0\uFF1A';
        sysP += '\n\u2022 \u5FE0\u81E3\u4E4B\u95F4\u4E5F\u4F1A\u56E0\u6539\u9769\u8DEF\u7EBF\u4E89\u5435\uFF08\u6539\u9769\u6D3EA vs \u6539\u9769\u6D3EB\uFF09';
        sysP += '\n\u2022 \u767E\u59D3\u77ED\u671F\u4E0D\u9886\u60C5\uFF08\u201C\u51CF\u7A0E\u662F\u5E94\u8BE5\u7684\u201D\u800C\u975E\u201C\u8C22\u6069\u201D\uFF09';
        sysP += '\n\u2022 \u5916\u56FD\u53CD\u800C\u66F4\u5F3A\u786C\uFF08\u660E\u541B=\u5B9E\u529B\u5F3A\u2192\u4E0D\u5FC5\u8BA8\u597D\uFF09';
        sysP += '\n\u2022 player_inner\u5B64\u72EC\u611F\u52A0\u91CD\uFF1A\u201C\u670D\u505A\u4E86\u8FD9\u4E48\u591A\uFF0C\u7ADF\u65E0\u4E00\u4EBA\u8BF4\u58F0\u597D\u201D';
      }
    }

    // N7: 王朝衰落叙事引擎
    var _reignYears = (typeof getReignYears === 'function') ? getReignYears() : GM.turn / 12;
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
    sysP += '\n- new_characters: 创建新角色（子嗣、投奔者、新官员等）';
    sysP += '\n- faction_changes: \u4FEE\u6539\u52BF\u529B\u5C5E\u6027\uFF08strength_delta\u5B9E\u529B\uFF0Ceconomy_delta\u7ECF\u6D4E\uFF0CplayerRelation_delta\u5BF9\u7389\u5173\u7CFB\u3002strength\u964D\u81F30\u2192\u52BF\u529B\u8986\u706D\uFF09';
    sysP += '\n- faction_events: 创造势力间自主事件（战争/联盟/政变/行军/围城等）';
    sysP += '\n  ⚠ 涉及行军/围城的事件，必须在geoData中提供地理推算数据！';
    sysP += '\n- faction_relation_changes: 改变势力间关系';
    sysP += '\n- party_changes: \u4FEE\u6539\u515A\u6D3E\u72B6\u6001\uFF08influence_delta\u5F71\u54CD\u529B\u3001new_status\u6D3B\u8DC3/\u5F0F\u5FAE/\u88AB\u538B\u5236/\u5DF2\u89E3\u6563\u3001new_leader\u9996\u9886\u66F4\u66FF\u3001new_agenda\u8BAE\u7A0B\u53D8\u5316\u3001new_shortGoal\u77ED\u671F\u76EE\u6807\u53D8\u5316\uFF09';
    sysP += '\n- class_changes: \u4FEE\u6539\u9636\u5C42\u72B6\u6001\uFF08satisfaction_delta\u6EE1\u610F\u5EA6\u3001influence_delta\u5F71\u54CD\u529B\u3001new_demands\u8BC9\u6C42\u968F\u5C40\u52BF\u53D8\u5316\u3001new_status\u5730\u4F4D\u53D8\u52A8\uFF09';
    sysP += '\n- army_changes: 修改部队兵力/士气/训练（降至0→全军覆没）';
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
    sysP += '\n    pregnancy(\u6709\u5B55) / birth(\u751F\u80B2\uFF0C\u5FC5\u987B\u540C\u65F6\u5728new_characters\u4E2D\u521B\u5EFA\u5B50\u55E3\u89D2\u8272\u542BmotherName) / rank_change(\u664B\u5C01/\u964D\u4F4D\uFF0CnewRank\u586B\u4F4D\u5206id)';
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
    sysP += '\n    · 新建时 leader/首脑须指向现有角色，或在同一回合的 new_characters 中一并创建';
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

    // ═══════════════════════════════════════════════════════════
    // §2 Sub-call 注册化基础设施（_runSubcall + 共享变量声明）
    // ═══════════════════════════════════════════════════════════
    try{
      // 3.3: Sub-call注册化——共享变量前置声明 + 管线描述 + 执行包装器
      var _aiDepth = (P.conf && P.conf.aiCallDepth) || 'full';
      var aiThinking = '';
      var memoryReview = '';
      var p1 = null;
      var p2 = null;
      var p1Summary = '';
      GM._turnAiResults = {}; // 收集所有Sub-call的原始返回值
      GM._subcallTimings = {}; // 收集每个Sub-call的耗时

      // 3.3: Sub-call管线描述（用于调试/监控/未来完整迁移）
      var _subcallMeta = [
        {id:'sc0', name:'AI深度思考', minDepth:'standard', order:0},
        {id:'sc05', name:'记忆回顾', minDepth:'standard', order:5},
        {id:'sc1', name:'结构化数据', minDepth:'lite', order:100},
        {id:'sc1b', name:'文事鸿雁人际', minDepth:'lite', order:110},
        {id:'sc1c', name:'势力外交·NPC阴谋', minDepth:'lite', order:120},
        {id:'sc15', name:'NPC深度', minDepth:'standard', order:150},
        {id:'sc_memwrite', name:'NPC记忆回写', minDepth:'lite', order:155},
        {id:'sc16', name:'势力推演', minDepth:'full', order:160},
        {id:'sc17', name:'经济财政', minDepth:'full', order:170},
        {id:'sc18', name:'军事态势', minDepth:'full', order:180},
        {id:'sc_audit', name:'数据一致性审核', minDepth:'lite', order:185},
        {id:'sc2', name:'叙事正文', minDepth:'lite', order:200},
        {id:'sc25', name:'伏笔记忆', minDepth:'lite', order:250},
        {id:'sc27', name:'叙事审查', minDepth:'standard', order:270},
        {id:'sc07', name:'NPC认知整合', minDepth:'lite', order:275},
        {id:'sc28', name:'世界快照', minDepth:'full', order:280}
      ];

      // ★ 静默 loading 辅助（2026-04-30）：post-turn 队列触发的子调用·不再弹 loading 蒙层
      // post-turn 任务运行时玩家已在看史记/操作下回合·此时若 showLoading 会错误打断 UI
      // GM._postTurnJobs 由 _ensurePostTurnJobQueue 创建·flush 后保持到下回合开始 await
      function _quietLoad(label, pct) {
        if (GM && GM._postTurnJobs) return; // 后台静默
        if (typeof showLoading === 'function') showLoading(label, pct);
      }

      // ★ Prompt cache 统一辅助（2026-04-30）：双重门控·只为原生 Anthropic 启用 cache_control
      // 兼容性：OpenAI/GPT/Gemini/DeepSeek/OpenRouter/国内中转站等所有走 /chat/completions 的接口
      //         一律返回原字符串·完全 no-op·因为 (1) provider 不是 anthropic 或 (2) URL 不是 api.anthropic.com
      // 使用：messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tpX}]
      function _maybeCacheSys(sysContent) {
        try {
          var _provider = (typeof _detectAIProvider === 'function') ? _detectAIProvider() : '';
          var _native = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
          // 必须两个条件同时满足：provider 检测为 anthropic + URL 是官方域名（防中转站 400）
          if (_provider === 'anthropic' && _native && typeof sysContent === 'string' && sysContent.length > 1500) {
            return [{ type: 'text', text: sysContent, cache_control: { type: 'ephemeral' } }];
          }
        } catch(_mcsE) {}
        return sysContent;
      }

      // 3.3: Sub-call执行包装器——统一计时/错误处理/重试 + AI调度统计
      if (!GM._aiDispatchStats) GM._aiDispatchStats = { totalCalls:0, totalTime:0, errors:0, byId:{}, errorLog:[] };
      async function _runSubcall(id, name, minDepth, fn) {
        var _depthOrder = {lite:0, standard:1, full:2};
        if (_depthOrder[_aiDepth] < _depthOrder[minDepth]) {
          _dbg('[' + id + '] 跳过(depth=' + _aiDepth + '<' + minDepth + ')');
          return;
        }
        var _start = Date.now();
        var _retries = (id === 'sc1') ? 2 : 1;
        var _stats = GM._aiDispatchStats;
        if (!_stats.byId[id]) _stats.byId[id] = { name:name, calls:0, totalTime:0, errors:0 };
        _stats.totalCalls++;
        _stats.byId[id].calls++;
        for (var _attempt = 0; _attempt <= _retries; _attempt++) {
          try {
            await fn();
            var _elapsed = Date.now() - _start;
            GM._subcallTimings[id] = _elapsed;
            _stats.totalTime += _elapsed;
            _stats.byId[id].totalTime += _elapsed;
            return;
          } catch(_scErr) {
            _dbg('[' + name + '] 第' + (_attempt+1) + '次执行失败:', _scErr.message);
            if (_attempt >= _retries) {
              var _elapsed = Date.now() - _start;
              GM._subcallTimings[id] = _elapsed;
              _stats.totalTime += _elapsed;
              _stats.byId[id].totalTime += _elapsed;
              _stats.errors++;
              _stats.byId[id].errors++;
              _stats.errorLog.push({ id:id, name:name, turn:GM.turn, msg:_scErr.message, time:new Date().toLocaleTimeString() });
              if (_stats.errorLog.length > 20) _stats.errorLog.shift();
              console.warn('[' + name + '] 重试' + _retries + '次后仍失败');
              if (typeof toast === 'function') toast('\u26A0 ' + name + '失败，部分推演可能不完整');
            }
          }
        }
      }

      async function _runSubcallBatch(label, tasks, limit) {
        if (!Array.isArray(tasks) || tasks.length === 0) return;
        var _confLimit = parseInt(P.conf && P.conf.aiSubcallConcurrency, 10);
        var _limit = _confLimit > 0 ? _confLimit : (limit || 3);
        _limit = Math.max(1, Math.min(_limit, tasks.length));
        var _cursor = 0;
        var _started = Date.now();
        async function _worker() {
          while (_cursor < tasks.length) {
            var _idx = _cursor++;
            var _task = tasks[_idx];
            if (typeof _task === 'function') await _task();
          }
        }
        var _workers = [];
        for (var _i = 0; _i < _limit; _i++) _workers.push(_worker());
        await Promise.all(_workers);
        _dbg('[SubcallBatch] ' + label + ' finished ' + tasks.length + ' tasks in ' + ((Date.now() - _started) / 1000).toFixed(1) + 's, concurrency=' + _limit);
      }

      var _queuedPostTurnSubcalls = [];
      function _queuePostTurnSubcall(id, fn) {
        _queuedPostTurnSubcalls.push({ id: id, fn: fn });
      }
      function _flushQueuedPostTurnSubcalls() {
        if (!_queuedPostTurnSubcalls.length) return;
        var _q = _queuedPostTurnSubcalls.slice();
        _queuedPostTurnSubcalls.length = 0;
        _q.forEach(function(job) {
          if (typeof _enqueuePostTurnJob === 'function') return _enqueuePostTurnJob(job.id, job.fn);
          _enqueueLocalPostTurnJob(job.id, job.fn);
        });
      }
      function _enqueueLocalPostTurnJob(id, fn) {
        if (!GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) GM._postTurnJobs = { pending: [], launchedAt: Date.now() };
        var p = Promise.resolve().then(fn).catch(function(e){ _dbg('[PostTurn]' + id + ' failed:', e); });
        GM._postTurnJobs.pending.push({ id: id, promise: p });
        return p;
      }
      async function _awaitQueuedPostTurnSubcallsById(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return;
        if (typeof _awaitPostTurnJobsById === 'function') {
          await _awaitPostTurnJobsById(ids);
          return;
        }
        if (!GM || !GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) return;
        var waiting = GM._postTurnJobs.pending.filter(function(job) {
          return job && ids.indexOf(job.id) >= 0 && job.promise;
        });
        if (waiting.length) await Promise.all(waiting.map(function(job) { return job.promise; }));
      }

      // --- 预处理：等待上回合 post-turn 任务 + 同步本地记忆保鲜 ---
      try {
        if (typeof _awaitPostTurnJobs === 'function') await _awaitPostTurnJobs();
        if (typeof _ensureMemoryFreshness === 'function') _ensureMemoryFreshness(GM);
      } catch(_emfE) { _dbg('[MemoryFresh] 预处理失败:', _emfE); }

      // ═══════════════════════════════════════════════════════════
      // §3 Sub-calls sc0/sc05/sc1/sc1b/sc1c（深度思考·记忆·主推演·文事·势力）
      // ═══════════════════════════════════════════════════════════

      // --- Sub-call 0: AI深度思考（全面分析当前局势，不限字数）---
      await _runSubcall('sc0', 'AI深度思考', 'standard', async function() {
      showLoading("AI\u6DF1\u5EA6\u601D\u8003",42);
      var tp0 = tp + '\n\u8BF7\u6781\u5176\u6DF1\u5165\u5730\u5206\u6790\u5F53\u524D\u5C40\u52BF\uFF0C\u8FD4\u56DEJSON\uFF1A\n' +
        '{"tensions":"\u5F53\u524D5\u4E2A\u6700\u5927\u77DB\u76FE/\u5371\u673A\u53CA\u5176\u4E25\u91CD\u7A0B\u5EA6(150\u5B57)","consequences":"\u73A9\u5BB6\u672C\u56DE\u5408\u6BCF\u4E2A\u884C\u52A8\u7684\u8BE6\u7EC6\u540E\u679C\u5206\u6790(150\u5B57)","npc_spotlight":"\u672C\u56DE\u5408\u6700\u53EF\u80FD\u6709\u52A8\u4F5C\u76845\u4E2ANPC\u53CA\u5176\u52A8\u673A\u548C\u884C\u52A8\u65B9\u5F0F(200\u5B57)","faction_dynamics":"\u975E\u73A9\u5BB6\u52BF\u529B\u672C\u56DE\u5408\u7684\u81EA\u4E3B\u884C\u52A8\u8BE6\u7EC6\u63A8\u6F14(200\u5B57)","family_dynamics":"\u5BB6\u65CF/\u540E\u5BAB/\u5A5A\u59FB\u5C42\u9762\u7684\u6F5C\u5728\u53D8\u5316(100\u5B57)","class_unrest":"\u5404\u9636\u5C42\u7684\u4E0D\u6EE1\u60C5\u7EEA\u548C\u53EF\u80FD\u7684\u6C11\u53D8(100\u5B57)","economic_pressure":"\u8D22\u653F\u538B\u529B\u548C\u7ECF\u6D4E\u8D70\u5411(80\u5B57)","foreshadow":"\u5E94\u57CB\u4E0B\u76843\u4E2A\u4F0F\u7B14\u53CA\u5176\u5C06\u5728\u4F55\u65F6\u5F15\u7206(100\u5B57)","mood":"\u672C\u56DE\u5408\u53D9\u4E8B\u5E94\u8425\u9020\u7684\u60C5\u611F\u57FA\u8C03(50\u5B57)","memoryQueries":[{"keywords":["关键词1","关键词2"],"turnRange":[起始回合,结束回合],"participant":"相关人物名(可空)","minImportance":5,"purpose":"为何要检索"}]}\n' +
        '\u8FD9\u662F\u4F60\u7684\u6DF1\u5EA6\u601D\u8003\u8FC7\u7A0B\uFF0C\u4E0D\u663E\u793A\u7ED9\u73A9\u5BB6\u3002\u8BF7\u5145\u5206\u601D\u8003\uFF0C\u4E0D\u8981\u5401\u60DC\u5B57\u6570\u3002\n' +
        '【memoryQueries】如需要回忆更早的具体事件·在此列出 1-4 条检索查询·系统将从四源永久档案中检索并注入后续推演·否则留空数组。\n' +
        '  · 四个检索源：(1) NPC 个人记忆 (2) 长期事势(ChronicleTracker) (3) 史记本传(shijiHistory) (4) 已埋伏笔(_foreshadows)\n' +
        '  · 适合查询的场景：「此人是否真在那回合背叛过」「某改革当年具体推进到哪里」「玩家曾埋下何种伏笔」「某事件距今多少回合」\n' +
        '  · keywords 用具体名词(角色名/事件关键词/政策名)·turnRange 可选(若不填则全档案)·participant 仅 NPC 记忆源使用·minImportance 仅 NPC 记忆源使用';
      var resp0 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
        body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp0}], temperature:0.6, max_tokens:_tok(12000)})});
      if (resp0.ok) {
        var data0 = await resp0.json();
        _checkTruncated(data0, '局势分析');
        if (data0.choices && data0.choices[0] && data0.choices[0].message) {
          aiThinking = data0.choices[0].message.content;
          GM._turnAiResults.thinking = aiThinking;
          _dbg('[AI Think]', aiThinking.substring(0, 200));
        }
      }
      }); // end Sub-call 0 _runSubcall

      // --- SC_RECALL: 按 SC0 生成的 memoryQueries 从永久档检索·注入到后续 prompt ---
      // 方向 6：RAG 式按需检索（2026-04-30 扩展：四源——NPC记忆/Chronicle/史记/伏笔）+ Phase 2.2 第 5 源向量
      // P10.4A：KokoroMemo 范式·Retrieval Gate 节流——非必要回合跳过·节省 API/CPU 开销 40-60%
      var _recallResults = [];
      var _gateDecision = { shouldRecall: true, reason: 'gate 未加载' };
      try {
        if (typeof RecallGate !== 'undefined' && RecallGate.shouldRecall) {
          _gateDecision = RecallGate.shouldRecall({
            aiThinking: aiThinking,
            currentEdicts: edicts
          });
          RecallGate.record(_gateDecision);
          if (!_gateDecision.shouldRecall) {
            _dbg('[RecallGate] 跳过 SC_RECALL·reason:', _gateDecision.reason);
          } else {
            _dbg('[RecallGate] 触发 SC_RECALL·reason:', _gateDecision.reason);
          }
        }
      } catch(_gateE) { _dbg('[RecallGate] fail·默认跑 SC_RECALL:', _gateE); }

      try {
        if (!_gateDecision.shouldRecall) {
          // gate 节流·跳过整段 SC_RECALL·_recallResults 保持空数组
          throw '__SKIP_RECALL__';
        }
        var _think = aiThinking || '';
        var _thinkJson = extractJSON(_think);
        if (_thinkJson && Array.isArray(_thinkJson.memoryQueries) && _thinkJson.memoryQueries.length > 0) {
          var _mqList = _thinkJson.memoryQueries.slice(0, 4);
          for (var _mqI = 0; _mqI < _mqList.length; _mqI++) {
            var q = _mqList[_mqI];
            if (!q || typeof q !== 'object') continue;
            var allHits = [];
            var keywords = Array.isArray(q.keywords) ? q.keywords : (q.keywords ? [q.keywords] : []);
            keywords = keywords.map(function(k) { return String(k || '').trim().slice(0, 40); }).filter(Boolean).slice(0, 6);
            var keywordRe = keywords.length > 0 ? new RegExp(keywords.map(function(k){return String(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'), 'i') : null;

            // 源 1: NpcMemorySystem 人物记忆（精准）
            if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.recallMemory) {
              try {
                var npcHits = NpcMemorySystem.recallMemory({
                  keywords: keywords,
                  turnRange: q.turnRange,
                  participant: q.participant,
                  minImportance: q.minImportance
                }, { limit: 6 });
                if (npcHits && npcHits.length > 0) {
                  npcHits.forEach(function(h) {
                    allHits.push({ source: 'npc', char: h.char, turn: h.turn, text: h.event, importance: h.importance });
                  });
                }
              } catch(_e1) {}
            }

            // 源 2: ChronicleTracker 长期事势（关键词过滤）
            if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAll && keywordRe) {
              try {
                var chronAll = ChronicleTracker.getAll({}) || [];
                var chronHits = chronAll.filter(function(c) {
                  if (!c) return false;
                  var hay = (c.title || '') + ' ' + (c.description || c.summary || '') + ' ' + (c.result || '');
                  return keywordRe.test(hay);
                }).slice(0, 4);
                chronHits.forEach(function(c) {
                  allHits.push({ source: 'chronicle', turn: c.startTurn || c.completedTurn || 0, text: (c.title || '') + (c.description ? '·' + String(c.description).slice(0, 80) : ''), status: c.status });
                });
              } catch(_e2) {}
            }

            // 源 3: shijiHistory 史记（关键词过滤·近 30 回合）
            if (Array.isArray(GM.shijiHistory) && keywordRe) {
              try {
                var sjLook = GM.shijiHistory.slice(-30);
                // 若 turnRange 限制，进一步过滤
                if (Array.isArray(q.turnRange) && q.turnRange.length === 2) {
                  sjLook = sjLook.filter(function(sh) { return sh.turn >= q.turnRange[0] && sh.turn <= q.turnRange[1]; });
                }
                var sjHits = sjLook.filter(function(sh) {
                  if (!sh) return false;
                  var hay = (sh.shizhengji || '') + ' ' + (sh.zhengwen || '') + ' ' + (sh.shilu || '');
                  return keywordRe.test(hay);
                }).slice(-4); // 取最近 4 条
                sjHits.forEach(function(sh) {
                  // 提取包含关键词的句子
                  var combined = (sh.shilu || sh.shizhengji || '').replace(/\s+/g, ' ');
                  var sentences = combined.split(/[。！？]/).filter(function(s) { return s && keywordRe.test(s); });
                  var snippet = sentences.slice(0, 2).join('。').slice(0, 120);
                  allHits.push({ source: 'shiji', turn: sh.turn, text: snippet || combined.slice(0, 100) });
                });
              } catch(_e3) {}
            }

            // 源 4: _foreshadows 伏笔（关键词过滤）
            if (Array.isArray(GM._foreshadows) && keywordRe) {
              try {
                var foreHits = GM._foreshadows.filter(function(f) {
                  if (!f) return false;
                  var hay = (f.content || f.text || '') + (f.context || '');
                  return keywordRe.test(hay);
                }).slice(-3);
                foreHits.forEach(function(f) {
                  allHits.push({ source: 'foreshadow', turn: f.turn || 0, text: String(f.content || f.text || '').slice(0, 100) });
                });
              } catch(_e4) {}
            }

            // 源 5: 语义向量检索（bge-small-zh）·若模型未就绪/未启用·静默跳过
            if (typeof SemanticRecall !== 'undefined' && SemanticRecall.searchSyncSafe && SemanticRecall.status && SemanticRecall.status().modelReady) {
              try {
                var qText = (q.query || '') + ' ' + keywords.join(' ');
                if (qText.trim()) {
                  var vecHits = await SemanticRecall.searchSyncSafe(qText.trim(), { topK: 4, threshold: 0.55 });
                  if (vecHits && vecHits.length) {
                    vecHits.forEach(function(v) {
                      allHits.push({ source: 'vector', sub: v.sub, turn: v.turn, text: v.text, sim: v.sim });
                    });
                  }
                }
              } catch(_e5) {}
            }

            if (allHits.length > 0) {
              // P12.3 5 维加权打分（KokoroMemo card_retriever.py:163-169 范式·本地化为天命语境）
              // score = vector*0.45 + importance*0.20 + recency*0.15 + source_priority*0.15 + dim_weight*0.05
              var _curT = (typeof GM !== 'undefined' && GM && GM.turn) || 1;
              var _sourcePriority = { 'imperialEdict': 1.0, 'pinned': 1.0, 'chronicle': 0.8, 'shiji': 0.7, 'foreshadow': 0.65, 'vector': 0.6, 'npc': 0.5, 'unknown': 0.4 };
              var _scoreHit = function(h) {
                // (1) vector 相似度·已归一化 0-1·非 vector 源用 0.6 默认（关键词匹配视为中等相似）
                var vs = (typeof h.sim === 'number') ? h.sim : 0.6;
                // (2) importance·NPC 记忆/Chronicle 自带 0-10 → 归一·shiji/foreshadow 默认 0.5
                var imp = 0.5;
                if (typeof h.importance === 'number') imp = Math.max(0, Math.min(1, h.importance / 10));
                // (3) recency·按 turn 距动态衰减（≤1 = 1.0·≤5 = 0.85·≤15 = 0.65·≤50 = 0.45·更远 = 0.30）
                var dt = _curT - (h.turn || 0);
                var rec = (dt <= 1) ? 1.0 : (dt <= 5) ? 0.85 : (dt <= 15) ? 0.65 : (dt <= 50) ? 0.45 : 0.30;
                // (4) source_priority·按源类型固定权重
                var sp = _sourcePriority[h.source] || _sourcePriority.unknown;
                // (5) dim_weight·若是 vector 或 eventHistory 命中且带 affects_future·加分
                var dw = 0.5;
                if (h.affects_future === true || h.affects_future === 'true') dw = 1.0;
                else if (h.source === 'vector') dw = 0.7;
                // 加权总分
                return vs * 0.45 + imp * 0.20 + rec * 0.15 + sp * 0.15 + dw * 0.05;
              };
              allHits.forEach(function(h) { h._score = _scoreHit(h); });
              allHits.sort(function(a, b) { return (b._score||0) - (a._score||0); });
              _recallResults.push({
                query: q,
                hits: allHits.slice(0, 12),  // 单查询 top-12 命中（按加权总分降序·KokoroMemo 范式）
                _scoring: '5dim-weighted'
              });
            }
          }

          if (_recallResults.length > 0) {
            GM._turnAiResults.recallResults = _recallResults;
            var _totalHits = _recallResults.reduce(function(s,r){return s+r.hits.length;},0);
            // 按源分类计数
            var _bySrc = {};
            _recallResults.forEach(function(r) {
              r.hits.forEach(function(h) { _bySrc[h.source] = (_bySrc[h.source]||0) + 1; });
            });
            var _srcSummary = Object.keys(_bySrc).map(function(k){return k+':'+_bySrc[k];}).join(' ');
            _dbg('[SC_RECALL] 4 源检索:', _thinkJson.memoryQueries.length, '查询·总命中', _totalHits, '条·分布', _srcSummary);
          }
        }
      } catch(_rcE) {
        if (_rcE === '__SKIP_RECALL__') {
          // P10.4A gate 决定跳过·非错误·静默
        } else {
          _dbg('[SC_RECALL] 失败:', _rcE);
        }
      }

      // --- Sub-call 0.5: 深度记忆回顾 ---
      await _runSubcall('sc05', '记忆回顾', 'standard', async function() {
      showLoading("\u6DF1\u5EA6\u56DE\u987E",48);
      try {
        // P6.6 分层全读：近 5 回合完整不截断·5-12 回合 400 字摘要·12+ 回合靠 _aiMemory 压缩层
        // 用户需求："时政记应该不止四百字·要完整读取·超出读取回合范围的自动纳入压缩之中"
        var _recentHistory = '';
        if (GM.shijiHistory && GM.shijiHistory.length > 0) {
          // 动态调整近端窗口（按 token 预算·若上下文紧张可减·若宽裕可增）
          var _injCpRH = (typeof getCompressionParams === 'function') ? getCompressionParams() : { fullReadTurns: 5, briefReadTurns: 12 };
          var _fullN = _injCpRH.fullReadTurns || 5;
          var _briefN = _injCpRH.briefReadTurns || 12;
          var _allHistory = GM.shijiHistory;
          var _fullSlice = _allHistory.slice(-_fullN);
          var _briefSlice = _allHistory.slice(-_briefN, -_fullN); // 5-12 回合段
          // 近端·完整全文（时政记+实录+正文+人事+诏令）
          if (_fullSlice.length > 0) {
            _recentHistory += '\n=== 近 ' + _fullSlice.length + ' 回合·完整记录（不截断） ===\n';
            _fullSlice.forEach(function(sh) {
              _recentHistory += '\n────── T' + sh.turn + (sh.time ? '·' + sh.time : '') + ' ──────\n';
              if (sh.shizhengji) _recentHistory += '【时政记】\n' + sh.shizhengji + '\n';
              if (sh.shilu) _recentHistory += '【实录】\n' + sh.shilu + '\n';
              if (sh.zhengwen) _recentHistory += '【正文/后人戏说】\n' + sh.zhengwen + '\n';
              // 玩家诏令完整列出
              if (sh.edicts && typeof sh.edicts === 'object') {
                var _ed = [];
                Object.keys(sh.edicts).forEach(function(cat) {
                  var v = sh.edicts[cat];
                  if (typeof v === 'string' && v.trim()) {
                    v.split(/[\n；;]+/).map(function(s){return s.trim();}).filter(Boolean).forEach(function(line) {
                      _ed.push('[' + cat + '] ' + line);
                    });
                  }
                });
                if (_ed.length > 0) _recentHistory += '【玩家诏令】\n' + _ed.join('\n') + '\n';
              }
              if (sh.personnel && Array.isArray(sh.personnel) && sh.personnel.length > 0) {
                _recentHistory += '【人事变动】\n' + sh.personnel.map(function(p) {
                  return '· ' + (p.name || '?') + (p.former ? '(原' + p.former + ')' : '') + '·' + (p.change || '') + (p.reason ? ' ←' + p.reason : '');
                }).join('\n') + '\n';
              }
              if (sh.playerStatus) _recentHistory += '【政局摘要】' + sh.playerStatus + '\n';
              if (sh.playerInner) _recentHistory += '【内省】' + sh.playerInner + '\n';
            });
            _recentHistory += '\n=== 近端完整记录结束 ===\n\n';
          }
          // 中端·400 字摘要（5-12 回合）
          if (_briefSlice.length > 0) {
            _recentHistory += '=== ' + (_fullN+1) + '-' + (_fullN+_briefSlice.length) + ' 回合前·摘要回顾 ===\n';
            _briefSlice.forEach(function(sh) {
              _recentHistory += 'T' + sh.turn + ' [时政] ' + (sh.shizhengji || '').substring(0, 400) + '\n';
              if (sh.shilu) _recentHistory += '       [实录] ' + (sh.shilu || '').substring(0, 150) + '\n';
              if (sh.edicts && typeof sh.edicts === 'object') {
                var _eSum = [];
                Object.keys(sh.edicts).forEach(function(cat) {
                  var v = sh.edicts[cat];
                  if (typeof v === 'string' && v.trim()) _eSum.push('[' + cat + ']' + v.split(/[\n；;]/)[0].slice(0, 40));
                });
                if (_eSum.length > 0) _recentHistory += '       [玩家诏] ' + _eSum.join(' · ') + '\n';
              }
            });
            _recentHistory += '\n';
          }
          // 12+ 回合：靠下方注入的 _aiMemory 压缩段（已自动 sc25 后台触发）+ _memoryLayers L2/L3·此处不重复
        }
        if (GM.evtLog && GM.evtLog.length > 0) {
          // B2：过滤已死角色的过往事件（epitaph 已摘要·避免死人复活）
          var _keyEvts = GM.evtLog.slice(-30).filter(function(e){ return !e._charDied; }).map(function(e) { return 'T' + e.turn + ' [' + e.type + '] ' + e.text; }).join('\n');
          _recentHistory += '\n' + _keyEvts;
        }
        // B2：注入墓志铭（死者在本章节之外不得出现）
        if (Array.isArray(GM._epitaphs) && GM._epitaphs.length > 0) {
          var _epitaphSection = '\n【历代人物墓志铭（死者在当前回合推演中不得行动）】\n';
          GM._epitaphs.slice(-8).forEach(function(ep){
            _epitaphSection += '  · ' + ep.char + '（殁于T' + ep.diedTurn + (ep.diedAt?'·'+ep.diedAt:'') + '·' + (ep.reason||'') + '）' + (ep.positionAtDeath?'卒时任'+ep.positionAtDeath:'') + '\n';
          });
          _recentHistory += _epitaphSection;
        }
        // 加入伏笔和AI记忆
        if (GM._foreshadows && GM._foreshadows.length > 0) {
          var _compressedFore = GM._foreshadows.filter(function(f){return f.type==='compressed';});
          var _activeFore = GM._foreshadows.filter(function(f){return f.type!=='compressed';}).slice(-15);
          _recentHistory += '\n【已埋伏笔】\n';
          if (_compressedFore.length > 0) _recentHistory += _compressedFore.map(function(f){return f.content||f;}).join('\n') + '\n';
          _recentHistory += _activeFore.map(function(f){return 'T'+(f.turn||'?')+': '+(f.content||f.text||f);}).join('\n');
        }
        if (GM._aiMemory && GM._aiMemory.length > 0) {
          // 使用动态探测的上下文参数决定注入量
          var _injCp = getCompressionParams();
          var _memInjectCount = _injCp.memInjectCount;
          // 优先注入压缩摘要（type=compressed），再注入最近记忆
          var _compressedMem = GM._aiMemory.filter(function(m){return m.type==='compressed';});
          var _recentMem = GM._aiMemory.filter(function(m){return m.type!=='compressed';}).slice(-_memInjectCount);
          _recentHistory += '\n【AI记忆】\n';
          if (_compressedMem.length > 0) _recentHistory += _compressedMem.map(function(m){return m.content||m;}).join('\n') + '\n';
          _recentHistory += _recentMem.map(function(m){return 'T'+(m.turn||'?')+': '+(m.content||m.text||m);}).join('\n');
        }
        // —— A1 三层记忆金字塔：L3 年代纲要 + L2 情景摘要（XML 结构化·永不丢失的历史根）——
        if (GM._memoryLayers) {
          var _ML = GM._memoryLayers;
          // XML 转义辅助（统一防注入）
          var _xE2 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          if (Array.isArray(_ML.L3) && _ML.L3.length > 0) {
            _recentHistory += '\n<era-outline>\n';
            _ML.L3.slice(-4).forEach(function(x){
              if (x.aiGenerated) {
                _recentHistory += '  <era range="' + _xE2(x.turnRange) + '" theme="' + _xE2(x.theme||'') + '" atmosphere="' + _xE2(x.atmosphere||'') + '">\n';
                if (x.mainThreads) _recentHistory += '    <threads>' + _xE2(x.mainThreads) + '</threads>\n';
                if (x.causalSummary) _recentHistory += '    <causal>' + _xE2(x.causalSummary) + '</causal>\n';
                if (Array.isArray(x.highlights)) _recentHistory += '    <highlights>' + _xE2(x.highlights.join('｜')) + '</highlights>\n';
                _recentHistory += '  </era>\n';
              } else {
                _recentHistory += '  <era range="' + _xE2(x.turnRange) + '">' + _xE2(x.summary) + '</era>\n';
              }
            });
            _recentHistory += '</era-outline>\n';
          }
          if (Array.isArray(_ML.L2) && _ML.L2.length > 0) {
            _recentHistory += '\n<scene-summaries>\n';
            _ML.L2.slice(-6).forEach(function(x){
              if (x.aiGenerated) {
                _recentHistory += '  <scene range="' + _xE2(x.turnRange) + '" mood="' + _xE2(x.mood||'') + '">' + _xE2(x.summary) + '</scene>\n';
              } else {
                _recentHistory += '  <scene range="' + _xE2(x.turnRange) + '">' + _xE2(x.summary) + '</scene>\n';
              }
            });
            _recentHistory += '</scene-summaries>\n';
          }
        }
        // —— SC_RECALL 检索结果注入（XML 格式·转义·支持多源 hit 格式：npc/chronicle/shiji/foreshadow/vector）——
        if (_recallResults && _recallResults.length > 0) {
          var _xE3 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          // P10.4D 护栏（KokoroMemo injector.py 范式）：明确告知 AI 这些是历史记忆·可能不完整或过期
          _recentHistory += '\n<recall-disclaimer>以下 recalled-memories 来自历史档案·可能不完整或过期·不能覆盖本回合刚发生的事实·若有冲突以当前回合推演为准。</recall-disclaimer>\n';
          _recentHistory += '\n<recalled-memories>\n';
          _recallResults.forEach(function(rr) {
            _recentHistory += '  <recall purpose="' + _xE3((rr.query.purpose||'').substring(0,40)) + '">\n';
            rr.hits.slice(0, 8).forEach(function(hit) {
              // 兼容两种 hit 格式：旧 (char/event/importance) + 新多源 (source/text/turn[/char][/importance])
              var _hitText = hit.text || hit.event || '';
              var _hitChar = hit.char || '';
              var _hitSource = hit.source || (hit.char ? 'npc' : 'unknown');
              var _hitImportance = Math.round(hit.importance || 5);
              var _hitStatus = hit.status || '';
              _recentHistory += '    <hit source="' + _xE3(_hitSource) + '"';
              if (_hitChar) _recentHistory += ' char="' + _xE3(_hitChar) + '"';
              _recentHistory += ' turn="' + (hit.turn||0) + '" importance="' + _hitImportance + '"';
              if (_hitStatus) _recentHistory += ' status="' + _xE3(_hitStatus) + '"';
              // P12.3 显示 5 维加权总分（如有）·让 AI 知道哪些命中更可信
              if (typeof hit._score === 'number') _recentHistory += ' score="' + Math.round(hit._score * 100) / 100 + '"';
              _recentHistory += '>' + _xE3(String(_hitText).substring(0, 100)) + '</hit>\n';
            });
            _recentHistory += '  </recall>\n';
          });
          _recentHistory += '</recalled-memories>\n';
        }
        // —— 因果图近期边（转义）——
        if (GM._causalGraph && Array.isArray(GM._causalGraph.edges) && GM._causalGraph.edges.length > 0) {
          var _xE4 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          var _recentEdges = GM._causalGraph.edges.slice(-15);
          _recentHistory += '\n<causal-graph recent-edges="' + _recentEdges.length + '">\n';
          _recentEdges.forEach(function(e) {
            _recentHistory += '  <edge from="' + _xE4((e.from||'').substring(0,30)) + '" to="' + _xE4((e.to||'').substring(0,30)) + '" type="' + _xE4(e.type||'') + '" strength="' + (e.strength||0.5) + '">' + _xE4((e.explanation||'').substring(0,60)) + '</edge>\n';
          });
          _recentHistory += '</causal-graph>\n';
        }
        // —— 势力弧（转义）——
        if (GM._factionArcs && Object.keys(GM._factionArcs).length > 0) {
          var _xE5 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          _recentHistory += '\n<faction-arcs>\n';
          Object.keys(GM._factionArcs).slice(0, 6).forEach(function(fn) {
            var fa = GM._factionArcs[fn];
            if (!fa || !fa.phaseHistory) return;
            _recentHistory += '  <arc faction="' + _xE5(fn) + '" phase="' + _xE5(fa.currentPhase||'') + '" influence="' + (fa.cumulativeInfluence||0) + '">\n';
            (fa.phaseHistory || []).slice(-4).forEach(function(ph) {
              _recentHistory += '    <phase turn="' + (ph.turn||0) + '" stage="' + _xE5(ph.phase||'') + '">' + _xE5((ph.event||'').substring(0,50)) + '</phase>\n';
            });
            _recentHistory += '  </arc>\n';
          });
          _recentHistory += '</faction-arcs>\n';
        }
        // —— 自我反省（转义）——
        if (GM._aiReflections && GM._aiReflections.length > 0) {
          var _xE6 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          _recentHistory += '\n<self-reflections>\n';
          GM._aiReflections.slice(-3).forEach(function(r) {
            _recentHistory += '  <reflection turn="' + (r.turn||0) + '" divergence="' + _xE6(r.divergence||'') + '">\n';
            _recentHistory += '    <predicted>' + _xE6((r.predictedLast||'').substring(0,80)) + '</predicted>\n';
            _recentHistory += '    <actual>' + _xE6((r.actualThis||'').substring(0,80)) + '</actual>\n';
            _recentHistory += '    <lesson>' + _xE6((r.lesson||'').substring(0,80)) + '</lesson>\n';
            _recentHistory += '  </reflection>\n';
          });
          _recentHistory += '</self-reflections>\n';
        }
        // 加入玩家决策记录
        if (GM.playerDecisions && GM.playerDecisions.length > 0) {
          _recentHistory += '\n\u3010\u73A9\u5BB6\u51B3\u7B56\u3011\n' + GM.playerDecisions.slice(-8).map(function(d){return 'T'+(d.turn||'?')+' '+d.type+': '+(d.content||d.description||'');}).join('\n');
        }
        // 决策回响（让AI追踪延迟后果）
        if (GM._decisionEchoes && GM._decisionEchoes.length > 0) {
          _recentHistory += '\n【决策回响——延迟后果】\n';
          GM._decisionEchoes.slice(-5).forEach(function(de) { _recentHistory += 'T' + de.turn + ': ' + de.content + '→预期回响:' + (de.echoDesc||'') + '（' + (de.delayTurns||3) + '回合后）\n'; });
        }
        // 考课历史摘要
        if (GM._annualReviewHistory && GM._annualReviewHistory.length > 0) {
          var _lr = GM._annualReviewHistory[GM._annualReviewHistory.length - 1];
          _recentHistory += '\n【最近考课T' + _lr.turn + '】优等' + _lr.excellent + '人 劣等' + _lr.poor + '人';
          if (_lr.promotions.length) _recentHistory += ' 建议擢升:' + _lr.promotions.join('、');
          if (_lr.demotions.length) _recentHistory += ' 建议左迁:' + _lr.demotions.join('、');
          _recentHistory += '\n';
        }
        // 情节线索
        if (GM._plotThreads && GM._plotThreads.length > 0) {
          _recentHistory += '\n【活跃情节线索】\n';
          GM._plotThreads.filter(function(t){return t.status==='active';}).slice(-5).forEach(function(t) { _recentHistory += '  · ' + t.title + '(' + t.type + ') P' + t.priority + '\n'; });
        }
        if (_recentHistory.length > 50) {
          var tp05 = '\u4EE5\u4E0B\u662F\u8FD1\u671F\u7684\u5B8C\u6574\u4E8B\u4EF6\u8BB0\u5F55\u3001\u5DF2\u57CB\u4F0F\u7B14\u3001AI\u8BB0\u5FC6\u548C\u73A9\u5BB6\u51B3\u7B56\uFF1A\n' + _recentHistory + '\n\n';
          tp05 += '\u8BF7\u8FD4\u56DEJSON\uFF1A\n{"causal_chains":"\u8FD1\u671F\u4E8B\u4EF6\u4E4B\u95F4\u7684\u5B8C\u6574\u56E0\u679C\u5173\u7CFB\u94FE(200\u5B57)","unresolved":"\u5C1A\u672A\u89E3\u51B3\u7684\u7EBF\u7D22\u548C\u60AC\u5FF5\u2014\u2014\u54EA\u4E9B\u4F0F\u7B14\u5E94\u8BE5\u5F15\u7206(150\u5B57)","patterns":"\u53CD\u590D\u51FA\u73B0\u7684\u6A21\u5F0F\u548C\u52A0\u901F\u7684\u8D8B\u52BF(100\u5B57)","player_impact":"\u73A9\u5BB6\u8FD1\u671F\u51B3\u7B56\u7684\u7D2F\u79EF\u5F71\u54CD\u2014\u2014\u54EA\u4E9B\u540E\u679C\u5373\u5C06\u663E\u73B0(150\u5B57)","npc_memories":"\u5404NPC\u5BF9\u8FD1\u671F\u4E8B\u4EF6\u7684\u8BB0\u5FC6\u548C\u60C5\u7EEA\u53D8\u5316(100\u5B57)","momentum":"\u5F53\u524D\u4E16\u754C\u7684\u60EF\u6027\u65B9\u5411\u2014\u2014\u5982\u679C\u6CA1\u6709\u5E72\u9884\uFF0C\u4E8B\u60C5\u4F1A\u5F80\u54EA\u4E2A\u65B9\u5411\u53D1\u5C55(80\u5B57)"}\n';
          tp05 += '\u8FD9\u662F\u4F60\u7684\u6DF1\u5EA6\u5185\u90E8\u5206\u6790\u3002\u8BF7\u5145\u5206\u601D\u8003\u6BCF\u4E00\u6761\u56E0\u679C\u94FE\u3002';
          var resp05 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp05}], temperature:0.5, max_tokens:_tok(5000)})});
          if (resp05.ok) {
            var data05 = await resp05.json();
            _checkTruncated(data05, '因果合成');
            if (data05.choices && data05.choices[0] && data05.choices[0].message) {
              memoryReview = data05.choices[0].message.content;
              GM._turnAiResults.memoryReview = memoryReview;
              _dbg('[Memory Review]', memoryReview.substring(0, 150));
            }
          }
        }
      } catch(e05) { _dbg('[Memory Review] \u5931\u8D25:', e05); throw e05; }
      }); // end Sub-call 0.5 _runSubcall

      // --- Sub-call 1: 结构化数据 (时政记/数值变化/事件/角色状态) --- [always runs]
      await _runSubcall('sc1', '结构化数据', 'lite', async function() {
      var _preAnalysis = '';
      if (aiThinking) _preAnalysis += '\n\u3010AI\u5C40\u52BF\u5206\u6790\u3011\n' + aiThinking + '\n';
      if (memoryReview) _preAnalysis += '\u3010\u8DE8\u56DE\u5408\u56E0\u679C\u94FE\u3011\n' + memoryReview + '\n';
      if (_preAnalysis) _preAnalysis += '\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5206\u6790\u63A8\u6F14\uFF0C\u786E\u4FDD\u524D\u56DE\u5408\u7684\u60AC\u5FF5\u5F97\u5230\u56DE\u5E94\uFF0C\u56E0\u679C\u94FE\u5F97\u5230\u5EF6\u7EED\u3002\n';
      // —— 【硬约束】死亡角色名单 + 财务一致性 ——
      var _hardConstraints = '';
      try {
        var _deadList = [];
        var _fakeList = [];
        (GM.chars || []).forEach(function(c){
          if (!c) return;
          if (c._fakeDeath) { _fakeList.push(c.name); return; }
          if (c.alive === false) _deadList.push(c.name);
        });
        _hardConstraints += '\n═══【本回合硬约束·违反将被校验器标记并自动补录·影响 AI 评级】═══\n';
        _hardConstraints += '① 金额一致性：shilu_text/shizhengji/events 中出现的任何"拨/赐/赈/征/抄/缴/赔/贡 N两/石/匹"等具体金额动作，必须在 fiscal_adjustments 中有对应条目（target/kind/resource/amount 一一对应）。缺失将被自动校验器补录标记。\n';
        _hardConstraints += '② 死亡禁动：以下角色已死·不得在本回合有任何行动/对话/奏折/任命（出现在 personnel_changes / npc_actions / char_updates 等字段均为违规）：\n';
        _hardConstraints += '    已死：' + (_deadList.length ? _deadList.join('、') : '（无）') + '\n';
        if (_fakeList.length) {
          _hardConstraints += '    诈死(明面死实则藏匿·仅允许极隐秘活动·需剧情合理)：' + _fakeList.join('、') + '\n';
        }
        _hardConstraints += '③ 死亡→墓志铭：若本回合新增 character_deaths·必须在 reason 中写清死因(病/诛/战/自尽/意外/诈死)·type:fake则系统会走holding不归档。\n';
        _hardConstraints += '④ 数据与叙事不得互悖：宁可不写不可写而不改。所有"实际变化"必须落到对应结构化字段。\n';
        _hardConstraints += '⑤ 忠诚语义：每个角色的 loyalty 是"对自己所属势力/首领"的忠诚，不是"对玩家"的忠诚。皇太极忠于后金·不忠于明廷皇帝；岳飞忠于宋廷·不忠于金国皇帝。敌对势力角色 loyalty 再高也不会为玩家效力。\n';
        _hardConstraints += '⑥ 角色归属铁律：c.faction 决定角色阵营——非玩家势力角色（敌对/附属/外邦）不得作为本朝官员任命（如不能让皇太极当明朝主考官/宰相/将军）。只有投降/归顺（先改 faction·再任命）才能跨势力任官。任命 office_assignments/任命类 changes 必须先检查 faction 与玩家同·否则视为荒唐诏令按字面执行+剧烈混乱+皇威暴跌。\n';
        _hardConstraints += '═════════════════════════════════════════════\n';
      } catch(_hcE) { _dbg('[HardConstraints] build failed', _hcE); }

      // ★ 世界状态快照注入（2026-04-30 记忆增强）：把"事实"以结构化卡片形式置于 prompt 顶部
      // 让 AI 一眼看到客观局势（玩家/国势/要职/死者/进行中诏令/NPC 当下状态），降低叙事漂移
      var _wsSnap = '';
      try { if (typeof _buildAllSnapshots === 'function') _wsSnap = _buildAllSnapshots() || ''; } catch(_wsE){ _dbg('[WorldSnap sc1] fail:', _wsE); }
      // ★ 12 表结构化记忆注入（2026-04-30 Phase 1）：sc1 前先同步 GM 状态到表·再把表序列化注入
      var _memTblInj = '', _memTblRule = '';
      try {
        if (window.MemTables && MemTables.ensureInit && MemTables.ensureInit()) {
          MemTables.syncFromGM({});
          _memTblInj = MemTables.buildTablesInjection({}) || '';
          _memTblRule = MemTables.buildTableRulePostscript() || '';
        }
      } catch(_mtE){ _dbg('[MemTables sc1] fail:', _mtE); }
      // ★ 时间参考块（Phase 4.1 Horae 风格）·防 AI 把"3 天前"说成"昨天"
      var _timeRef = '';
      try { if (typeof _buildTimeRef === 'function') _timeRef = _buildTimeRef() || ''; } catch(_tr){}
      // ★ 长期约束（Phase 4.2 ReNovel-AI affects_future 范式）
      var _futureC = '';
      try { if (typeof _mtBuildFuture === 'function') _futureC = _mtBuildFuture() || ''; } catch(_fc){}
      // ★ P12.1 state_board 注入（KokoroMemo state_renderer 范式·按 priority 排序·~1200 字预算）
      // 4 类轻量会话状态——朝堂氛围/未解线索/近期摘要/未兑现承诺
      // 优先级：mood（最即时） > unfulfilled_promises（玩家责任） > open_loops（待推进） > recent_summary（背景）
      var _stateBoard = '';
      try {
        if (GM._stateBoard && typeof GM._stateBoard === 'object' && GM._stateBoard.turn === (GM.turn || 1) - 1) {
          var sb = GM._stateBoard;
          var sbLines = [];
          sbLines.push('=== 上回合 state_board（朝堂状态板·下回合主推演必读·按重要度排序） ===');
          if (sb.mood) sbLines.push('【朝堂氛围】' + sb.mood);
          if (Array.isArray(sb.unfulfilled_promises) && sb.unfulfilled_promises.length > 0) {
            sbLines.push('【玩家未兑现承诺/拟议未颁诏令·下回合应推进】');
            sb.unfulfilled_promises.forEach(function(p) { sbLines.push('  · ' + p); });
          }
          if (Array.isArray(sb.open_loops) && sb.open_loops.length > 0) {
            sbLines.push('【悬而未决线索·应在叙事中推进或回收】');
            sb.open_loops.forEach(function(l) { sbLines.push('  · ' + l); });
          }
          if (sb.recent_summary) sbLines.push('【近期摘要】' + sb.recent_summary);
          sbLines.push('=== state_board 结束 ===\n');
          _stateBoard = sbLines.join('\n') + '\n';
        }
      } catch(_sbE){ _dbg('[StateBoard inject] fail:', _sbE); }
      // ★ 上回合记忆固化（Phase 7 sc_consolidate 后台输出·密度最高·应排在最前）
      var _consolidated = '';
      try {
        if (Array.isArray(GM._consolidatedMemory) && GM._consolidatedMemory.length > 0) {
          var _lastC = GM._consolidatedMemory[GM._consolidatedMemory.length - 1];
          if (_lastC && _lastC.turn === (GM.turn || 1) - 1) {
            // 仅当上回合刚刚整合·才注入（避免重复读老条目）
            _consolidated = '\n=== 上回合记忆固化（sc_consolidate 后台输出·下回合主推演必读） ===\n';
            if (_lastC.consolidated) _consolidated += '【整合摘要】\n' + _lastC.consolidated + '\n\n';
            if (Array.isArray(_lastC.key_threads) && _lastC.key_threads.length > 0) {
              // P10.4C + P11.2C-full：rejected 不展示·approved 普通展示·pending 带 ⚠ 待验证
              var _vthreads = _lastC.key_threads.filter(function(t) { return t._status !== 'rejected'; });
              if (_vthreads.length > 0) {
                _consolidated += '【关键线索】\n' + _vthreads.map(function(t) {
                  var statusMark = '';
                  if (t._status === 'pending') statusMark = '⚠[待验证] ';
                  else if (t._status === 'approved') statusMark = '✓ ';
                  return '· ' + statusMark + '[' + (t.status||'?') + '·张力' + (t.tension||'?') + '/10] ' + (t.thread||'') + '·参与:' + (t.actors||'?') + '·下一步:' + (t.next||'?');
                }).join('\n') + '\n\n';
              }
            }
            if (Array.isArray(_lastC.npc_trajectories) && _lastC.npc_trajectories.length > 0) {
              _consolidated += '【NPC 轨迹】\n' + _lastC.npc_trajectories.map(function(n) {
                return '· ' + (n.name||'?') + '·心境:' + (n.mood||'?') + '·' + (n.arc||'') + '·对玩家:' + (n.commitment||'');
              }).join('\n') + '\n\n';
            }
            if (Array.isArray(_lastC.faction_vectors) && _lastC.faction_vectors.length > 0) {
              _consolidated += '【势力走向】\n' + _lastC.faction_vectors.map(function(f) {
                return '· ' + (f.faction||'?') + '·' + (f.trajectory||'稳定') + '·驱动:' + (f.driver||'?') + '·风险:' + (f.risk||'');
              }).join('\n') + '\n\n';
            }
            if (Array.isArray(_lastC.unresolved_tensions) && _lastC.unresolved_tensions.length > 0) {
              // P11.2C-full：rejected 不展示·approved/pending 区分标记
              var _vtensions = _lastC.unresolved_tensions.filter(function(t) {
                return typeof t === 'string' || t._status !== 'rejected';
              });
              if (_vtensions.length > 0) {
                _consolidated += '【未解张力（下回合可能引爆）】\n' + _vtensions.map(function(t) {
                  if (typeof t === 'string') return '· ' + t;
                  var sm = '';
                  if (t._status === 'pending') sm = '⚠[待验证] ';
                  else if (t._status === 'approved') sm = '✓ ';
                  return '· ' + sm + (t.text || '');
                }).join('\n') + '\n\n';
              }
            }
            if (Array.isArray(_lastC.player_reputation_drift) && _lastC.player_reputation_drift.length > 0) {
              _consolidated += '【玩家声望漂移】\n' + _lastC.player_reputation_drift.map(function(p) {
                return '· ' + (p.group||'?') + '·' + (p.direction||'稳定') + '·当前印象:' + (p.perception||'?') + '·主因:' + (p.cause||'');
              }).join('\n') + '\n\n';
            }
            if (Array.isArray(_lastC.next_turn_focus) && _lastC.next_turn_focus.length > 0) {
              // P11.2C-full：rejected 不展示·approved/pending 区分（focus 默认全部建议级）
              var _vfocus = _lastC.next_turn_focus.filter(function(f) {
                return typeof f === 'string' || f._status !== 'rejected';
              });
              if (_vfocus.length > 0) {
                _consolidated += '【下回合演绎建议（参考·非命令）】\n' + _vfocus.map(function(f) {
                  if (typeof f === 'string') return '· ' + f;
                  var sm = (f._status === 'approved') ? '✓ ' : '⚠[建议] ';
                  return '· ' + sm + (f.text || '');
                }).join('\n') + '\n';
              }
            }
            _consolidated += '=== 记忆固化结束·此段是下回合 sc1 推演的最高优先级输入 ===\n\n';
          }
        }
      } catch(_consE){ _dbg('[sc1 consolidate inject] fail:', _consE); }
      var tp1 = _stateBoard + _consolidated + _timeRef + _futureC + _wsSnap + _memTblInj + tp + _preAnalysis + _hardConstraints + "\n请仅返回绝JSON，包含:\n"+
        "{\"turn_summary\":\"一句话概括本回合最重要的变化(30-50字，如:北境叛乱平定，国库因军费骤降三成)\","+
        // 实录：纯文言史官体，仿资治通鉴/历代实录
        "\"shilu_text\":\"实录"+_shiluMin+"-"+_shiluMax+"字——纯文言文(仿《资治通鉴》《明实录》)，以干支月份/日为单位，记事不评论。只记可验证事实：诏令、任免、战事、灾异、人事大变。句式仿实录：'某月某日，上诏……'/'是月，某地……'/'上命某官……'。禁止白话词汇，禁止主观评论。\","+
        // 时政记：朝政纪要体（副标题+总括+分领域因果链+总结）
        "\"szj_title\":\"时政记副标题——七字对仗两句，概括本回合主题(如'雷霆除藩安豫地，断禄激变祸萧墙'；两句用'，'分隔)\","+
        "\"shizhengji\":\"时政记正文"+_szjMin+"-"+_szjMax+"字——仿崇祯朝政纪要体：\\n  1.开篇总括：'陛下本回合……颁布数道谕旨：其一……；其二……'，逐条复述玩家诏令/私人行动\\n  2.按领域分段(3-5段)——军事与边防/内政与民生/吏治与人事/宗室与外戚/关外局势等，每段开头用【军事】【朝政】【经济】【外交】【民生】【宫廷】等方括号标签\\n  3.每段必须完整因果链：诏令→执行者→执行过程→阻力/意外→实际效果→遗留隐患。不要只写结果，要写过程和阻碍\\n  4.跨回合延续：用'此前''原本''延续'衔接往期决策的后续影响\\n  5.自然融入信息源：据XX奏报/有司呈报/密探来报/坊间传言/边军塘报\\n  段间用\\n\\n分隔。\","+
        "\"szj_summary\":\"时政记总结一句话——四字对仗成语风格(如'内帑充盈，边军暂安，然宗室怨气冲天，局势如履薄冰')\","+
        // 玩家角色状态——保留(供NPC记忆系统与昏君叙事基调使用；同时会在后人戏说中自然展现)
        "\"player_status\":\"政治处境(1句话——朝局格局、权力态势、外部威胁)\",\"player_inner\":\"主角内心独白(1-2句，第一人称，私人情感、矛盾挣扎——此字段仅供NPC记忆，不会直接展示)\","+
        // 人事变动：从office_changes/title_changes/character_deaths聚合后的可读列表
        "\"personnel_changes\":[{\"name\":\"姓名\",\"former\":\"原职或原身份\",\"change\":\"变动描述\",\"reason\":\"原因(可选)\"}],"+
        "\"resource_changes\":{\"\u8D44\u6E90\u540D\":\u53D8\u5316\u91CF},\"relation_changes\":{\"\u5173\u7CFB\u540D\":\u53D8\u5316\u91CF},"+
        "\"event\":{\"title\":\"...\",\"type\":\"...\"}\u6216null,"+
        "\"npc_actions\":[{\"name\":\"\u89D2\u8272\u540D\",\"action\":\"\u505A\u4E86\u4EC0\u4E48(30\u5B57)\",\"target\":\"\u5BF9\u8C01\",\"result\":\"\u7ED3\u679C\",\"behaviorType\":\"\u884C\u4E3A\u7C7B\u578B\",\"publicReason\":\"\u5BF9\u5916\u8BF4\u8F9E\",\"privateMotiv\":\"\u771F\u5B9E\u52A8\u673A\",\"new_location\":\"\u56E0\u884C\u52A8\u8F6C\u79FB\u5230\u4F55\u5904(\u53EF\u9009)\"}],"+
        "\"affinity_changes\":[{\"a\":\"\u89D2\u8272A\",\"b\":\"\u89D2\u8272B\",\"delta\":\u53D8\u5316\u91CF,\"reason\":\"\u539F\u56E0\",\"relType\":\"blood/marriage/mentor/sworn/rival/benefactor/enemy(\u53EF\u9009\uFF0C\u65B0\u589E\u6216\u5F3A\u5316\u5173\u7CFB\u7C7B\u578B)\"}],"+
        "\"goal_updates\":[{\"name\":\"\u89D2\u8272\u540D\",\"goalId\":\"goal_1\",\"action\":\"update/add/complete/replace\",\"longTerm\":\"\u957F\u671F\u76EE\u6807(add/replace\u65F6\u5FC5\u586B)\",\"shortTerm\":\"\u5F53\u524D\u77ED\u671F\u76EE\u6807\",\"progress\":\"0-100\",\"context\":\"\u5F53\u524D\u884C\u52A8\u65B9\u5411(1\u53E5)\",\"type\":\"power/wealth/revenge/protect/knowledge/faith(add\u65F6\u5FC5\u586B)\",\"priority\":\"1-10\"}],\"character_deaths\":[{\"name\":\"角色名\",\"reason\":\"死因描述\"}],\"char_updates\":[{\"name\":\"角色名\",\"loyalty_delta\":0,\"ambition_delta\":0,\"stress_delta\":0,\"intelligence_delta\":0,\"valor_delta\":0,\"military_delta\":0,\"administration_delta\":0,\"management_delta\":0,\"charisma_delta\":0,\"diplomacy_delta\":0,\"benevolence_delta\":0,\"legitimacy_delta\":0,\"add_traits\":[\"新获得的特质id\"],\"remove_traits\":[\"失去的特质id\"],\"new_location\":\"新所在地(可选,如被贬/外派/召回)\",\"new_stance\":\"新立场(可选)\",\"new_party\":\"新党派(可选)\",\"action_type\":\"行为类型(punish/reward/betray/mercy/declare_war/reform等)\",\"reason\":\"原因\"}],\"faction_changes\":[{\"name\":\"\u52BF\u529B\u540D\",\"strength_delta\":0,\"economy_delta\":0,\"playerRelation_delta\":0,\"reason\":\"\u539F\u56E0\"}],\"party_changes\":[{\"name\":\"\u515A\u6D3E\u540D\",\"influence_delta\":0,\"new_status\":\"\u6D3B\u8DC3/\u5F0F\u5FAE/\u88AB\u538B\u5236/\u5DF2\u89E3\u6563(\u53EF\u9009)\",\"new_leader\":\"\u65B0\u9996\u9886(\u53EF\u9009)\",\"new_agenda\":\"\u65B0\u8BAE\u7A0B(\u53EF\u9009)\",\"new_shortGoal\":\"\u65B0\u77ED\u671F\u76EE\u6807(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"faction_events\":[{\"actor\":\"\u52BF\u529BA\",\"target\":\"\u52BF\u529BB\u6216\u7A7A(\u5185\u653F\u4E8B\u4EF6\u53EF\u4E0D\u586Btarget)\",\"action\":\"\u5177\u4F53\u884C\u4E3A\u63CF\u8FF0(30\u5B57)\",\"actionType\":\"\u5916\u4EA4/\u5185\u653F/\u519B\u4E8B/\u7ECF\u6D4E\",\"result\":\"\u7ED3\u679C(30\u5B57)\",\"strength_effect\":0,\"geoData\":{\"routeKm\":0,\"terrainDifficulty\":0.5,\"hasOfficialRoad\":true,\"routeDescription\":\"\u7ECF\u2026\u2026\",\"passesAndBarriers\":[],\"fortLevel\":0,\"garrison\":0}}],"+
        "\"faction_relation_changes\":[{\"from\":\"\u52BF\u529BA\",\"to\":\"\u52BF\u529BB\",\"type\":\"\u65B0\u5173\u7CFB\",\"delta\":\u53D8\u5316\u91CF,\"reason\":\"\u539F\u56E0\"}],"+
        "\"class_changes\":[{\"name\":\"\u9636\u5C42\u540D\",\"satisfaction_delta\":0,\"influence_delta\":0,\"new_demands\":\"\u65B0\u8BC9\u6C42(\u53EF\u9009)\",\"new_status\":\"\u65B0\u5730\u4F4D(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"army_changes\":[{\"name\":\"\u90E8\u961F\u540D\",\"soldiers_delta\":\u5175\u529B\u53D8\u5316,\"morale_delta\":\u58EB\u6C14\u53D8\u5316,\"training_delta\":\u8BAD\u7EC3\u53D8\u5316,\"destination\":\"\u8C03\u5175\u76EE\u7684\u5730(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"item_changes\":[{\"name\":\"\u7269\u54C1\u540D\",\"acquired\":true,\"owner\":\"\u65B0\u6301\u6709\u8005\",\"reason\":\"\u83B7\u5F97/\u5931\u53BB\u539F\u56E0\"}],"+
        "\"era_state_delta\":{\"socialStability_delta\":0,\"economicProsperity_delta\":0,\"centralControl_delta\":0,\"militaryProfessionalism_delta\":0},"+
        "\"global_state_delta\":{\"taxPressure_delta\":0},"+
        "\"office_changes\":[{\"dept\":\"\u90E8\u95E8\",\"position\":\"\u5B98\u804C\",\"action\":\"appoint/dismiss/promote/demote/transfer/evaluate/reform\",\"person\":\"\u4EBA\u540D\",\"reason\":\"\u539F\u56E0\",\"newDept\":\"\u65B0\u90E8\u95E8(transfer\u65F6)\",\"newPosition\":\"\u65B0\u5B98\u804C(transfer/promote\u65F6)\",\"newRank\":\"\u65B0\u54C1\u7EA7(promote/demote\u65F6)\",\"evaluator\":\"\u8003\u8BC4\u8005NPC\u540D(evaluate\u65F6\u5FC5\u586B)\",\"grade\":\"\u5353\u8D8A/\u79F0\u804C/\u5E73\u5EB8/\u5931\u804C(evaluate\u65F6)\",\"comment\":\"\u8003\u8BC4\u8BC4\u8BED(evaluate\u65F6)\",\"reformDetail\":\"\u6539\u9769\u5185\u5BB9(reform\u65F6\uFF1A\u589E\u8BBE/\u88C1\u6492/\u5408\u5E76/\u6539\u540D)\"}],"+
        "\"office_aggregate\":[{\"dept\":\"\u90E8\u95E8\u540D\",\"actualCount_delta\":\"\u5B9E\u6709\u4EBA\u6570\u53D8\u5316(+N\u9012\u8865/-N\u79BB\u804C)\",\"evaluation_summary\":{\"excellent\":0,\"good\":0,\"average\":0,\"poor\":0,\"named_excellent\":[\"\u5177\u8C61\u89D2\u8272\"],\"named_good\":[\"\u5177\u8C61\u89D2\u8272\"]},\"corruption_found\":0,\"named_corrupt\":[\"\u5177\u8C61\u8D2A\u8150\u8005\"],\"narrative\":\"\u6DF7\u5408\u53D9\u8FF0\u2014\u2014\u5177\u8C61\u89D2\u8272\u70B9\u540D+\u5176\u4F59\u7528\u6570\u5B57\"}],"+
        // 官制占位实体化——当推演涉及编辑器留的 generated:false 占位时，AI 按史料风格生成对应任职者
        "\"office_spawn\":[{\"dept\":\"部门名(与officeTree中的node.name精确匹配)\",\"position\":\"官职名(与positions[].name精确匹配)\",\"holderName\":\"按本朝代命名习惯起的真实姓名(不得重复现有角色)\",\"age\":35,\"abilities\":{\"intelligence\":60,\"administration\":65,\"military\":40,\"valor\":35,\"charisma\":55,\"diplomacy\":50,\"benevolence\":55},\"personality\":\"性格简述\",\"stance\":\"中立/君党/太子党/外戚党等\",\"loyalty\":55,\"reason\":\"为何在本回合被实体化(如'玩家下诏涉及此官''推演提及此官员')\"}],"+
        // 党派议程演进——AI 每 3-5 回合评估，基于时局变化输出
        "\"party_agenda_shift\":[{\"party\":\"党派名\",\"newAgenda\":\"新议程\",\"oldAgenda\":\"旧议程\",\"reason\":\"变化原因\",\"influence_delta\":0}],"+
        // 党派分裂——凝聚力过低或议程分歧严重时
        "\"party_splinter\":[{\"parent\":\"原党派名\",\"newName\":\"分裂出的新党派名\",\"newLeader\":\"新党派领袖\",\"members\":[\"带走的成员\"],\"ideology\":\"新派立场\",\"reason\":\"分裂原因\"}],"+
        // 党派合流——势力均衡或大势所迫
        "\"party_merge\":[{\"absorber\":\"吸收方党派\",\"absorbed\":\"被吸收党派\",\"reason\":\"合流原因\"}],"+
        // 势力继承事件——首脑死亡后触发
        "\"faction_succession\":[{\"faction\":\"势力名\",\"oldLeader\":\"旧首脑\",\"newLeader\":\"新首脑\",\"legitimacy\":70,\"stability_delta\":-10,\"disputeType\":\"正常继承/争位/篡位/内战/外戚专政\",\"narrative\":\"继承叙事\"}],"+
        // 起义前兆——酝酿期状态（流民聚集/密谋/谶语流传），不一定爆发起义
        "\"revolt_precursor\":[{\"class\":\"蓄势阶层\",\"region\":\"发生地\",\"indicator\":\"famine饥荒/landConcentration土地兼并/heavyTax苛税/corvee繁役/officialCorruption吏治腐败/propheticOmen谶纬异象/secretSociety教门密谋\",\"severity\":\"mild/severe/critical\",\"detail\":\"具体表现(如'青州连续三年旱，流民十万涌入徐州')\",\"couldLeadTo\":\"可能导致的起义类型\"}],"+
        // 阶层起义爆发——进入长周期生命周期，AI 每回合通过 revolt_update 推进
        "\"class_revolt\":[{"+
          "\"revoltId\":\"本次起义的唯一ID(如revolt_huangjin/revolt_1886)\","+
          "\"class\":\"起义阶层\","+
          "\"region\":\"起义地区(须与行政区划匹配)\","+
          "\"leaderName\":\"起义领袖姓名(按朝代命名，如张角、黄巢、李自成风格)\","+
          "\"secondaryLeaders\":[\"副将/兄弟/军师\"],"+
          "\"ideology\":\"religious宗教/dynastic光复/ethnic民族/populist民生/nobleClaim宗室分支/warlord军阀/tributary边疆\","+
          "\"organizationType\":\"flowingBandit流寇/baseArea根据地/builtState建制/secretSociety教门/militaryMutiny军变\","+
          "\"slogan\":\"口号(如'苍天已死黄天当立'、'均田免粮'、'驱除鞑虏')\","+
          "\"religiousSect\":\"宗教派别(ideology=religious时必填，如太平道/白莲教)\","+
          "\"historicalArchetype\":\"参考的历史原型(如'黄巾之乱''黄巢之乱''红巾军')\","+
          "\"scale\":\"小/中/大/滔天\","+
          "\"militaryStrength\":5000,"+
          "\"composition\":\"兵员组成(如'流民为主、饥卒为辅、少数武装乡民')\","+
          "\"supplyStatus\":50,"+
          "\"phase\":\"brewing酝酿/uprising首义/expansion扩张/stalemate相持/turning转折/decline衰落/establishment建政/ending结局\","+
          "\"demands\":[\"起义诉求\"],"+
          "\"grievances\":[\"积怨(连续三年旱灾/徭役过重/官员贪索/土地兼并)\"],"+
          "\"spreadPattern\":\"mobile流动作战/baseDefense根据地/urbanSiege攻城/cascade多点齐发\","+
          "\"reason\":\"起义导火索\""+
        "}],"+
        // 起义进展更新——AI 每回合推进阶段（类似诏令生命周期）
        "\"revolt_update\":[{"+
          "\"revoltId\":\"匹配现有 revolt 的 id\","+
          "\"newPhase\":\"新阶段(brewing→uprising→expansion→stalemate→turning→decline/establishment→ending)\","+
          "\"territoryGained\":[\"本回合占领的城/州\"],"+
          "\"territoryLost\":[\"本回合失去的\"],"+
          "\"strength_delta\":1000,"+
          "\"supplyStatus_delta\":-5,"+
          "\"absorbedForces\":[\"本回合收编的势力/降将(如'归附了张某三千人'、'收编某都尉降卒')\"],"+
          "\"externalSupport\":[\"外援(如'受契丹暗中接济粮草')\"],"+
          "\"defectedOfficials\":[\"归附的朝廷官员(他们会自动转投起义军)\"],"+
          "\"counterForces\":[\"对抗力量(如'某乡勇首领某某纠集千人抗拒')\"],"+
          "\"narrative\":\"30-120 字阶段叙事——体现历史真实感\","+
          "\"keyEvent\":\"本回合关键事件(如'攻陷长安'、'领袖受伤')\","+
          "\"leaderCasualty\":\"领袖伤亡情况(可空；如'领袖中箭负伤'、'副将战死')\""+
        "}],"+
        // 起义镇压行动——朝廷派兵/士绅乡勇/外援等对抗
        "\"revolt_suppress\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"suppressor\":\"镇压主力(官军将领/乡勇首领/异族援军)\","+
          "\"suppressorForce\":20000,"+
          "\"tactic\":\"围剿/坚壁清野/分化瓦解/利诱降服/借异族/迁徙裹挟\","+
          "\"outcome\":\"victory彻底剿灭/partial部分镇压/stalemate相持/defeat反被击溃\","+
          "\"casualties\":{\"rebel\":5000,\"official\":1500,\"civilian\":3000},"+
          "\"narrative\":\"战况叙事\""+
        "}],"+
        // 起义招安——朝廷给条件换取归顺
        "\"revolt_amnesty\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"envoy\":\"招安使节NPC\","+
          "\"terms\":\"招安条件(如'封某节度使，残部编入禁军')\","+
          "\"outcome\":\"accepted接受/rejected拒绝/split分化(部分接受部分拒绝)\","+
          "\"acceptedLeaders\":[\"接受招安的领袖\"],"+
          "\"rejectedLeaders\":[\"拒绝的顽固派\"],"+
          "\"fateOfAccepted\":\"归顺后安置(如'宋江等一十八人封武节大夫')\","+
          "\"narrative\":\"招安过程\""+
        "}],"+
        // 问对承诺进展更新——NPC 对玩家承诺任务的执行报告
        "\"commitment_update\":[{\"id\":\"承诺id(匹配GM._npcCommitments)\",\"npcName\":\"承诺者\",\"progress_delta\":10,\"status\":\"executing/completed/failed/delayed\",\"feedback\":\"执行情况叙事(30-80字，具体描述做了什么、遇到什么)\",\"consequenceType\":\"success/partial/obstructed/abandoned\"}],"+
        // 起义转化——建政/割据/融入他派/彻底消散
        "\"revolt_transform\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"transformType\":\"toFaction升级为独立势力/merged融入他派/coopted被招安编入/dissolved自行消散/dynastyReplaced建立新朝(玩家GAMEOVER)\","+
          "\"newFactionName\":\"新势力名(toFaction时必填)\","+
          "\"mergedInto\":\"被并入的势力名(merged时必填)\","+
          "\"finalTerritory\":\"最终控制区(toFaction时)\","+
          "\"narrative\":\"转化叙事\""+
        "}],"+
        // 势力关系动态变化
        "\"faction_relation_shift\":[{\"from\":\"势力A\",\"to\":\"势力B\",\"relation_delta\":-10,\"new_type\":\"敌对/联盟/交战/朝贡/通婚\",\"event\":\"变化事件\",\"reason\":\"原因\"}],"+
        // 党派新建——当局势催生新政治集团（非分裂自既有）
        "\"party_create\":[{\"name\":\"新党派名\",\"ideology\":\"立场\",\"leader\":\"党魁(须已存在或同时在char_updates创建)\",\"influence\":20,\"socialBase\":[{\"class\":\"阶层名\",\"affinity\":0.6}],\"currentAgenda\":\"当前议程\",\"status\":\"活跃\",\"memberCount\":15,\"cohesion\":70,\"crossFaction\":false,\"trigger\":\"触发因素(诏令/事件/人物聚集)\",\"reason\":\"崛起原因\"}],"+
        // 党派覆灭——被查禁/首领被杀/成员风流云散
        "\"party_dissolve\":[{\"name\":\"被解散党派名\",\"cause\":\"banned(查禁)/liquidated(肃清)/faded(自然消亡)/leaderKilled(领袖被杀)/absorbed(吞并他党)\",\"perpetrator\":\"主使者(可空)\",\"fatePerMember\":\"流放/下狱/归隐/转投别党\",\"reason\":\"原因\"}],"+
        // 势力新建——独立/割据/称帝/复国
        "\"faction_create\":[{\"name\":\"新势力名\",\"type\":\"主权国/藩镇/番属/起义军/宗教势力\",\"leader\":\"首脑\",\"territory\":\"控制地区\",\"parentFaction\":\"脱离自的原势力(可空)\",\"strength\":30,\"militaryStrength\":20000,\"economy\":40,\"attitude\":\"敌对\",\"playerRelation\":-30,\"cohesion\":{\"political\":50,\"military\":60,\"economic\":40,\"cultural\":50,\"ethnic\":60,\"loyalty\":50},\"triggerEvent\":\"触发事件(如:安史之乱/黄巾起义/五代更迭)\",\"reason\":\"新建原因\"}],"+
        // 势力覆灭——被灭国/吞并/解体
        "\"faction_dissolve\":[{\"name\":\"被灭势力名\",\"cause\":\"conquered(征服)/absorbed(并入)/collapsed(内部崩解)/seceded_all(分崩离析)/replaced(被取而代之)\",\"conqueror\":\"征服者势力(conquered/absorbed时必填)\",\"territoryFate\":\"territory归属(如:并入某势力/独立成多国/设郡县)\",\"leaderFate\":\"首脑下场(降/死/逃亡)\",\"refugees\":[\"出逃核心人物\"],\"reason\":\"原因\"}],"+
        // 阶层兴起——新的社会阶层出现
        "\"class_emerge\":[{\"name\":\"新阶层名\",\"size\":\"约5%\",\"mobility\":\"中\",\"economicRole\":\"商贸/军事/手工/治理\",\"status\":\"良民\",\"privileges\":\"\",\"obligations\":\"\",\"satisfaction\":50,\"influence\":15,\"demands\":\"诉求\",\"origin\":\"从哪演化来(如:军功地主自均田崩坏中兴起/士商自科举资格放开中兴起)\",\"unrestThreshold\":30,\"reason\":\"兴起原因\"}],"+
        // 阶层消亡——传统阶层衰落/被废除
        "\"class_dissolve\":[{\"name\":\"消亡阶层名\",\"cause\":\"abolished(法令废除)/assimilated(被吸收)/extincted(衰落消亡)/replaced(被新阶层取代)\",\"successorClass\":\"后继阶层(可空)\",\"membersFate\":\"成员去向(如:编入平民/降为贱籍/融入士绅)\",\"reason\":\"原因\"}],"+
        "\"vassal_changes\":[{\"action\":\"establish/break/change_tribute\",\"vassal\":\"\u5C01\u81E3\u52BF\u529B\u540D\",\"liege\":\"\u5B97\u4E3B\u52BF\u529B\u540D\",\"tributeRate\":0.3,\"reason\":\"\u539F\u56E0\"}],"+
        "\"title_changes\":[{\"action\":\"grant/revoke/inherit/promote\",\"character\":\"\u89D2\u8272\u540D\",\"titleName\":\"\u7235\u4F4D\u540D\u79F0\",\"titleLevel\":3,\"hereditary\":true,\"from\":\"\u7EE7\u627F\u6765\u6E90\u89D2\u8272(inherit\u65F6\u5FC5\u586B)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"building_changes\":[{\"action\":\"build/upgrade/destroy/custom_build\",\"territory\":\"行政区划名\",\"type\":\"建筑名称(对应剧本buildingTypes中的name;custom_build时可为自定义名)\",\"isCustom\":false,\"description\":\"自定义建筑时必填——描述作用(AI自判合理性)\",\"level\":1,\"faction\":\"势力名\",\"costActual\":\"实际花费(两)\",\"timeActual\":\"实际工期(回合)\",\"feasibility\":\"合理/勉强/不合理\",\"judgedEffects\":\"AI判定的效果描述——写入推演叙事(如'每月增收银五百两、田亩增一成；建造期民力消耗较大，需徭役若干')\",\"reason\":\"建造原因\"}],"+
        "\"admin_changes\":[{\"action\":\"appoint_governor/remove_governor/adjust\",\"division\":\"\u884C\u653F\u533A\u540D\",\"person\":\"\u4EBA\u540D\",\"prosperity_delta\":0,\"population_delta\":0,\"corruption_delta\":0,\"stability_delta\":0,\"unrest_delta\":0,\"reason\":\"\u5730\u65B9\u5B98\u6CBB\u7406\u884C\u4E3A\u63CF\u8FF0\"}],"+
        // 中国化管辖变更：封建/削藩/改土归流/册封等历史制度动作
        "\"autonomy_changes\":[{\"action\":\"enfeoff_prince/enfeoff_duke/enfeoff_tusi/invest_tributary/establish_fanzhen/grace_edict/abolish_fief/tusi_to_liuguan/conquer_as_prefecture\",\"division\":\"行政区划名\",\"holder\":\"持爵者(enfeoff类必填)\",\"titleName\":\"爵名(如亲王/国公/宣慰使)\",\"subtype\":\"real(实封)/nominal(虚封)\",\"loyalty\":60,\"tributeRate\":0.3,\"risk\":\"rebellion/secession/stable\",\"reason\":\"原因——须与中国历史事件命名对应(推恩令/削藩/改土归流/册封/设郡等)\"}],"+
        "\"admin_division_updates\":[{\"action\":\"add/remove/rename/merge/split/reform/territory_gain/territory_loss\",\"parentDivision\":\"\u4E0A\u7EA7\u884C\u653F\u533A\u540D(add\u65F6\u5FC5\u586B)\",\"division\":\"\u884C\u653F\u533A\u540D\",\"newName\":\"\u65B0\u540D(rename\u65F6)\",\"level\":\"\u884C\u653F\u5C42\u7EA7\",\"population\":0,\"prosperity\":0,\"terrain\":\"\",\"specialResources\":\"\",\"taxLevel\":\"\u4E2D\",\"officialPosition\":\"\u4E3B\u5B98\u804C\u4F4D\",\"governor\":\"\u4E3B\u5B98\u540D\",\"description\":\"\u63CF\u8FF0\",\"mergeInto\":\"\u5408\u5E76\u76EE\u6807(merge\u65F6)\",\"splitResult\":[\"\u62C6\u5206\u540E\u540D\u79F0\u5217\u8868(split\u65F6)\"],\"lostTo\":\"\u5931\u53BB\u7ED9\u54EA\u4E2A\u52BF\u529B(territory_loss\u65F6)\",\"gainedFrom\":\"\u4ECE\u54EA\u4E2A\u52BF\u529B\u83B7\u5F97(territory_gain\u65F6)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"harem_events\":[{\"type\":\"pregnancy/birth/death/rank_change/favor_change/scandal\",\"character\":\"\u5983\u5B50\u540D\",\"detail\":\"\u63CF\u8FF0\",\"newRank\":\"\u65B0\u4F4D\u5206id(rank_change\u65F6)\",\"favor_delta\":\"\u5BA0\u7231\u53D8\u5316\u6570\u503C(favor_change\u65F6)\"}],"+
        // 皇城宫殿变更
        "\"palace_changes\":[{\"action\":\"build/renovate/assign/ruined/abandon\",\"palace\":\"宫殿名\",\"subHall\":\"殿名(assign时必填)\",\"occupant\":\"居住者(assign时必填)\",\"previousOccupant\":\"原居者(assign/移居时)\",\"newPalace\":\"新宫殿名(build时)\",\"palaceType\":\"main_hall/imperial_residence/consort_residence/dowager/crown_prince/ceremonial/garden/office/offering(build时)\",\"costActual\":\"花费(两)\",\"timeActual\":\"工期(回合)\",\"feasibility\":\"合理/勉强/不合理\",\"judgedEffects\":\"AI判定效果(对威望/国库/民力的影响)\",\"reason\":\"原因\"}],"+
        // NPC 互动（人物间多样化关系演进）
        "\"npc_interactions\":[{"+
          "\"type\":\"recommend举荐/impeach弹劾/petition_jointly联名上书/form_clique结党/private_visit私访/invite_banquet宴请/gift_present馈赠/correspond_secret密信/confront对质/mediate调和/frame_up构陷/expose_secret揭发/marriage_alliance联姻/master_disciple师徒缔结/duel_poetry诗文切磋/share_intelligence通风报信/betray背叛/reconcile和解/mourn_together共哀/rival_compete竞争/guarantee担保/slander诽谤\","+
          "\"actor\":\"发起者角色名\","+
          "\"target\":\"对象角色名\","+
          "\"involvedOthers\":[\"涉及的第三方角色\"],"+
          "\"description\":\"具体行为描述(20-60字)\","+
          "\"publicKnown\":true,"+
          "\"evidence\":\"书信/当庭/密会/宴饮/私室/朝堂/书院\","+
          "\"reason\":\"动机\""+
        "}],"+
        // 势力深度互动（中国政治史典型）
        "\"faction_interactions_advanced\":[{"+
          "\"type\":\"military_aid军援/trade_embargo禁运/open_market互市/send_envoy遣使/demand_tribute索贡/pay_tribute献贡/royal_marriage和亲/send_hostage质子/cultural_exchange文化交流/religious_mission宗教使节/proxy_war代理战争/incite_rebellion煽动叛乱/spy_infiltration派细作/assassin_dispatch派刺客/border_clash边境冲突/declare_war宣战/sue_for_peace请和/annex_vassal并吞/recognize_independence承认独立/form_confederation结盟/break_confederation毁约/gift_treasure赠宝/pay_indemnity赔款\","+
          "\"from\":\"势力A\","+
          "\"to\":\"势力B\","+
          "\"viaProxy\":\"第三方代理势力(proxy_war时填)\","+
          "\"terms\":\"具体条款\","+
          "\"tributeItems\":\"贡物清单(tribute时)\","+
          "\"marriageDetails\":\"XX公主嫁YY王(marriage时)\","+
          "\"hostageDetails\":\"XX子入质(hostage时)\","+
          "\"treatyType\":\"条约类型(盟好/称臣/停战/互不侵犯)\","+
          "\"description\":\"完整描述\","+
          "\"durationTurns\":10,"+
          "\"reason\":\"政治/经济/军事动因\""+
        "}],"+
        // 文事作品（诗词文赋画等，AI按触发源+境遇+人物条件判断是否生成）
        "\"cultural_works\":[{"+
          "\"author\":\"作者角色名\","+
          "\"turn\":" + GM.turn + ","+
          "\"date\":\"具体日期/时节(如'元丰五年七月')\","+
          "\"location\":\"创作地点(如'黄州赤壁'/'京师翰林院'/'岭南谪所')\","+
          "\"triggerCategory\":\"career/adversity/social/duty/travel/private/times/mood (8大类)\","+
          "\"trigger\":\"具体触发源(如seeking_official干谒/pass_exam登科/demoted_exile被贬/mourning_parent丁忧/farewell_friend送别/banquet宴饮/imperial_order应制/visit_temple访寺/travel_scenery游山/war_outing出征/disaster_famine灾荒/casual_mood闲情等)\","+
          "\"motivation\":\"spontaneous自发/commissioned受命/flattery干谒/response酬答/mourning哀悼/critique讽谕/celebration颂扬/farewell送别/memorial纪念/ghostwrite代笔/duty应制/self_express自抒\","+
          "\"lifeStage\":\"early_seeking/young_official/mid_career/exiled/mourning/retired/elder\","+
          "\"genre\":\"shi诗/ci词/fu赋/qu曲/ge歌行/wen散文/apply应用文(表书檄露布)/ji记叙文(游记楼记笔记)/ritual祭文碑铭/paratext序跋\","+
          "\"subtype\":\"具体体式(如'七言绝句'/'念奴娇'/'前出师表'/'岳阳楼记'/'干谒投赠诗')\","+
          "\"title\":\"作品题目\","+
          "\"content\":\"【必须全文真实生成】绝句20/绝28字/律诗40/56字/词按词牌字数/赋300-800/文200-600字。严格匹配作者性格+学识+境遇+地点+时代文风，古文忌现代词汇，格律诗尽力平仄对仗\","+
          "\"mood\":\"豪放/悲怆/闲适/讽刺/追思/感怀/咏物/绮丽/清雅/凄苦/豁达 等\","+
          "\"theme\":\"山水纪行/怀古咏史/送别/应制/讽谕/咏物/羁旅/闺怨/田园/边塞/悼亡/求仕干谒/言志抒怀 等\","+
          "\"elegance\":\"refined雅/vernacular俗/mixed兼融\","+
          "\"dedicatedTo\":[\"赠答对象角色名数组(可空)\"],"+
          "\"inspiredBy\":\"次韵或酬答的源作id(可空)\","+
          "\"commissionedBy\":\"委托人角色名(motivation=ghostwrite/commissioned时必填)\","+
          "\"praiseTarget\":\"颂扬对象(若有)\","+
          "\"satireTarget\":\"讽刺对象(若有;讽谕政治时务必填)\","+
          "\"quality\":\"0-100综合质量(AI据作者智慧学识+心境+主题相性自判)\","+
          "\"politicalImplication\":\"政治暗讽/隐含立场描述(可空;讽谏时必填)\","+
          "\"politicalRisk\":\"low/medium/high（高者易招诗狱）\","+
          "\"narrativeContext\":\"30-80字创作背景叙述——让玩家明白此作因何而作\","+
          "\"preservationPotential\":\"low/medium/high(能否传世,视质量/题材/境遇)\""+
        "}],"+
        "\"tech_civic_unlocks\":[{\"name\":\"\u79D1\u6280\u6216\u653F\u7B56\u540D\",\"type\":\"tech/civic\",\"reason\":\"\u89E3\u9501\u539F\u56E0\"}],"+
        "\"policy_changes\":[{\"action\":\"add/remove\",\"name\":\"\u56FD\u7B56\u540D\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"scheme_actions\":[{\"schemer\":\"\u53D1\u8D77\u8005\u540D\",\"action\":\"advance/disrupt/abort/expose\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"timeline_triggers\":[{\"name\":\"\u65F6\u95F4\u7EBF\u4E8B\u4EF6\u540D\",\"result\":\"\u5B9E\u9645\u53D1\u751F\u60C5\u51B5\"}],"+
        "\"edict_feedback\":[{\"content\":\"\u8BCF\u4EE4\u5185\u5BB9\u6458\u8981\",\"assignee\":\"\u8D1F\u8D23\u6267\u884C\u7684\u5B98\u5458\u540D(\u5FC5\u586B)\",\"status\":\"executing/completed/obstructed/partial/pending_delivery(\u4FE1\u4F7F\u5728\u9014\u5C1A\u672A\u9001\u8FBE)\",\"feedback\":\"\u6267\u884C\u60C5\u51B5\u8BE6\u7EC6\u63CF\u8FF0\u2014\u2014\u8C01\u505A\u4E86\u4EC0\u4E48\u3001\u8FDB\u5C55\u5982\u4F55\u3001\u906D\u9047\u4EC0\u4E48\u963B\u529B\u3001\u4E3A\u4EC0\u4E48\u53D7\u963B\",\"progressPercent\":50}],"+
        // 诏令生命周期更新——AI每回合推进诏令的阶段状态，按中国施政真实模型
        "\"edict_lifecycle_update\":[{"+
          "\"edictId\":\"诏令ID——本回合新诏令必须取自上方【本回合诏令】列表中的tracker.id；延续推演的诏令必须用上方【生命周期推演中的诏令】列表中的已有id，不得凭空生成新id\","+
          "\"edictType\":\"amnesty大赦/reward封赏/personnel人事/tax_reduction减赋/tax_increase加征/admin_reform行政改革/economic_reform经济改革/military_mobilize军事动员/diplomacy对外/imperial_ritual巡幸祭祀/criminal_justice刑狱/education_culture文教\","+
          "\"stage\":\"drafting草拟/review审议/promulgation颁布/transmission传达/interpretation地方解读/execution执行/feedback反馈/adjustment调整/sedimentation沉淀\","+
          "\"reformPhase\":\"pilot试点/expand局部推广/national全国推广/backlash反扑/outcome定局(改革类必填)\","+
          "\"stageProgress\":0.5,"+
          "\"executor\":\"督办者角色名\","+
          "\"executorEffectiveness\":0.85,"+
          "\"classesAffected\":{\"士绅\":{\"impact\":-10,\"resistance\":70},\"农民\":{\"impact\":+8,\"resistance\":10}},"+
          "\"factionsAffected\":{\"契丹\":{\"relation_delta\":-5,\"attitude_shift\":\"hostile\",\"reason\":\"对此诏令的反应\"}},"+
          "\"partiesAffected\":{\"东林党\":{\"influence_delta\":-8,\"agenda_impact\":\"反对/支持/不关心\",\"reason\":\"态度依据\"}},"+
          "\"resistanceDescription\":\"阻力来源与形态描述(如'江南士绅联名抗税，地方胥吏怠工截留')\","+
          "\"currentEffects\":{\"stateTreasury\":-50000,\"民心_江南\":-5},"+
          "\"unintendedConsequences\":\"意外后果(如'户部对账发现库银实际仅入库一半，其余被胥吏截留')\","+
          "\"pilotRegion\":\"试点地名(改革类必填)\","+
          "\"expansionRegions\":[\"已推广地区\"],"+
          "\"oppositionLeaders\":[\"反对派核心人物\"],"+
          "\"supporters\":[\"核心支持者\"],"+
          "\"nextStageETA\":2,"+
          "\"canPlayerIntervene\":true,"+
          "\"interventionOptions\":[\"加派干吏督办\",\"暂缓一州\",\"放弃\",\"更严苛执行\"],"+
          "\"narrativeSnippet\":\"30-80字本阶段叙事——体现程序感和阻力感\""+
        "}],"+
        "\"npc_letters\":[{\"from\":\"\u89D2\u8272\u540D(\u5FC5\u987B\u662F\u4E0D\u5728\u4EAC\u57CE\u7684NPC)\",\"type\":\"report/plea/warning/personal/intelligence\",\"urgency\":\"normal/urgent/extreme\",\"content\":\"\u4FE1\u4EF6\u5185\u5BB9(100-200\u5B57\u53E4\u5178\u4E2D\u6587)\",\"suggestion\":\"\u53EF\u64CD\u4F5C\u7684\u5EFA\u8BAE\u6458\u8981(1-2\u53E5\u2014\u2014\u5982'\u8BF7\u6C42\u589E\u63F4\u4E09\u5343\u5175\u9A6C'\u3001'\u5EFA\u8BAE\u51CF\u514D\u6CB3\u5317\u8D4B\u7A0E'\u2014\u2014\u53EF\u9009\uFF0Cpersonal\u7C7B\u578B\u53EF\u4E0D\u586B)\",\"replyExpected\":true}],"+
        "\"npc_correspondence\":[{\"from\":\"\u53D1\u4FE1NPC\",\"to\":\"\u6536\u4FE1NPC\",\"content\":\"\u4FE1\u4EF6\u5185\u5BB9(50-150\u5B57)\",\"summary\":\"\u4E00\u53E5\u8BDD\u6982\u62EC\",\"implication\":\"\u5BF9\u5C40\u52BF\u7684\u6F5C\u5728\u5F71\u54CD\",\"type\":\"secret/alliance/conspiracy/routine\"}],"+
        "\"route_disruptions\":[{\"route\":\"\u8D77\u70B9-\u7EC8\u70B9\",\"reason\":\"\u963B\u65AD\u539F\u56E0(\u6218\u4E71/\u6D2A\u6C34/\u53DB\u519B\u5360\u636E)\",\"resolved\":false}],"+
        "\"foreshadowing\":[{\"action\":\"plant/resolve\",\"content\":\"\u4F0F\u7B14\u5185\u5BB9\",\"type\":\"threat/opportunity/mystery/romance\",\"resolveCondition\":\"\u56DE\u6536\u6761\u4EF6(plant\u65F6\u586B)\"}],"+
        "\"current_issues_update\":[{\"action\":\"add/resolve/update\",\"title\":\"\u65F6\u653F\u8BAE\u9898\u6807\u9898(\u5982:\u6CB3\u5317\u5175\u997F\u62D6\u6B20\u3001\u6C34\u5229\u5E74\u4E45\u5931\u4FEE\u3001\u67D0\u5DDE\u523A\u53F2\u8D2A\u8150\u88AB\u52BE)\",\"category\":\"\u519B\u653F/\u8D22\u8D4B/\u6C34\u5229/\u5409\u51F6/\u8FB9\u9632/\u5F62\u52BF/\u4EBA\u4E8B/\u6C11\u751F\",\"description\":\"\u534A\u6587\u8A00200-500\u5B57\uFF0C\u7ED3\u5408\u63A8\u6F14\u5B9E\u9645\u7EC6\u5316\u63CF\u8FF0\u5177\u4F53\u65F6\u653F\u95EE\u9898\u7684\u6765\u7531\u3001\u6D89\u53CA\u4EBA\u7269\u3001\u5F53\u524D\u6001\u52BF\",\"id\":\"\u66F4\u65B0/\u89E3\u51B3\u65F6\u586B\u5DF2\u6709\u8981\u52A1id\"}],"+
        "\"map_changes\":{\"ownership_changes\":[],\"development_changes\":[]},"+
        // ═══ AI 至高权力·v2 新增语义通道（可选·按需使用）═══
        // char_updates 条目可混搭传统 delta 字段 + 以下扩展字段：
        "\"char_updates\":[{\"name\":\"角色名(必填)\",\"loyalty_delta\":0,\"ambition_delta\":0,\"new_location\":\"简单改位置\",\"updates\":{\"officialTitle\":\"新官职\",\"title\":\"新头衔\",\"age\":45,\"任何字段\":\"任何值\"},\"careerEvent\":{\"title\":\"新职\",\"dept\":\"部门\",\"action\":\"appoint/dismiss/transfer\",\"reason\":\"原因\",\"summary\":\"仕途概要(会附加到 ch.careerHistory)\"},\"travelTo\":{\"toLocation\":\"目的地\",\"estimatedDays\":30,\"reason\":\"赴任/召回/出使\",\"assignPost\":\"到达后就任的官职(可选)\"}}],"+
        // 任命+走位（若 toLocation ≠ ch.location 会自动启动走位·到期自动就任）
        "\"office_assignments\":[{\"name\":\"角色名\",\"post\":\"职位\",\"dept\":\"部门\",\"action\":\"appoint/dismiss/transfer\",\"fromLocation\":\"原地(可选)\",\"toLocation\":\"任职地(不同于原地则走位)\",\"estimatedDays\":30,\"reason\":\"原因\"}],"+
        // 岁入岁出动态增删（派人经商、大工程、新税目等）
        "\"fiscal_adjustments\":[{\"target\":\"guoku/neitang/province:某省\",\"kind\":\"income/expense\",\"category\":\"商贸/工程/赈济/军饷/杂税\",\"name\":\"项目名(如:派郑和下西洋商队)\",\"amount\":50000,\"reason\":\"依据/推演得出\",\"recurring\":true,\"stopAfterTurn\":null}],"+
        // 问天 directive 合规回报（若有 directive 则必填，逐条回报）
        "\"directive_compliance\":[{\"id\":\"dir_xxx\",\"status\":\"followed|partial|ignored\",\"reason\":\"若非 followed 说明原因\",\"evidence\":\"引用 zhengwen/events/npc_actions 中体现遵守的具体片段 30-80 字\"}],"+
        // 势力/党派/阶层/区划任意字段修改（补充既有 xxx_changes 的不足）
        "\"faction_updates\":[{\"name\":\"势力名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"party_updates\":[{\"name\":\"党派名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"class_updates\":[{\"name\":\"阶层名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"region_updates\":[{\"id或name\":\"行政区划\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        // 长期工程/商队/学堂·跨回合追踪
        "\"project_updates\":[{\"name\":\"工程名\",\"type\":\"工程/商队/学堂/道路/造船\",\"status\":\"planning/active/completed/abandoned\",\"cost\":10000,\"progress\":30,\"leader\":\"负责人\",\"region\":\"地点\",\"description\":\"概述\",\"endTurn\":50}],"+
        // 兜底·可用 dotted.path 改任意字段（除禁区：P.ai P.conf GM.saveName turn/year/month/day/sid _开头）
        "\"anyPathChanges\":[{\"path\":\"GM.任意嵌套路径\",\"op\":\"set/push/delta/merge/delete\",\"value\":\"值\",\"reason\":\"原因\"}]," +
        // ★ 12 表结构化记忆增量更新（Phase 5.3 修 OpenAI response_format='json_object' 屏蔽 <tableEdit> 的致命 bug）
        "\"table_updates\":[{\"sheet\":\"courtNpc/charProfile/edictsActive/specialMeans/importantItems/organizations/importantPlaces/relationNet/curStatus 之一\",\"op\":\"insert/update/delete\",\"rowIdx\":\"update/delete 时填行号\",\"values\":{\"colIdx数字\":\"值\"}}]," +
        // ★ P11.2B 诏令冲突链（KokoroMemo graph.py 范式·8 边类型缩为 4 种）
        "\"edict_relations\":[{\"from\":\"诏令编码或简称(如 T15-E03 / 盐法)\",\"to\":\"另一诏令编码或简称\",\"type\":\"supersedes/contradicts/continues/elaborates\",\"reason\":\"为何这样关联(40字)\"}]" +
        "}";
      // 注入待追踪诏令（让AI知道本回合有哪些诏令需要反馈）
      if (GM._edictTracker) {
        var _pendingEdicts = GM._edictTracker.filter(function(e) { return e.turn === GM.turn && e.status === 'pending'; });
        if (_pendingEdicts.length > 0) {
          // 按内政/外交分类注入
          var _domesticEdicts = _pendingEdicts.filter(function(e){ return !e._crossFaction; });
          var _diplomaticEdicts = _pendingEdicts.filter(function(e){ return e._crossFaction; });
          if (_domesticEdicts.length > 0) {
            tp1 += '\n\n【本回合内政诏令——每条必须在edict_feedback中逐条报告执行情况，填写assignee和feedback】\n';
            _domesticEdicts.forEach(function(e) {
              tp1 += '  【' + e.category + '】' + e.content;
              if (e._deliveryStatus === 'sending' && e._remoteTargets) {
                tp1 += ' ⚠信使在途→' + e._remoteTargets.join('、') + '（远方NPC尚未收到，status应为pending_delivery）';
              }
              tp1 += '\n';
            });
          }
          // 前议追责·涵盖常朝/廷议/御前所有玩家正式裁决·三回合后到期复盘
          // 让 AI 据 outcome + venue 自主演绎(narrative + NPC actions + 角色/党派 deltas)
          if (Array.isArray(GM._ty3_pendingReviewForPrompt) && GM._ty3_pendingReviewForPrompt.length > 0) {
            tp1 += '\n\n【前议追责·三回合前诏命到期——必须在 narrative + npc_actions 中演绎·并自主裁量数值反馈·不写死】\n';
            tp1 += '  ※ 涵盖范围：\n';
            tp1 += '    廷议诏令 → 朝野公开议论·派系格局变动·政敌/同党反应明显\n';
            tp1 += '    常朝诏令 → 寻常政务回响·有司奉行/抵制·言官跟疏\n';
            tp1 += '    亲诏(常朝玩家口述) → 比常朝更显君威·失败时损耗皇权更大\n';
            tp1 += '    御前密议 → 反响隐晦·走密室路线·泄密则成大案\n';
            tp1 += '  ※ 此为叙事种子·outcome 已系统判定·朝野反响与具体数值变化由你(AI)裁量：\n';
            tp1 += '    1·narrative 中铺陈反响：颂德/弹劾/民议/党狱/异象 等·依 outcome 烈度而定\n';
            tp1 += '    2·char_updates 给 主奏者/党首/承办者 发 prestige/loyalty/stress/favor 增减(必须有合理 reason)\n';
            tp1 += '    3·party_* 给 主奏党 发 cohesion/influence 调整(若 fulfilled 可+·若 backfire 可大-)\n';
            tp1 += '    4·event 段可补「颂德立祠」「言官追疏」「民间立碑」「党狱兴起」等\n';
            tp1 += '    5·npc_actions 中相关党派党首/政敌/承办者应有反应行动\n';
            tp1 += '  ※ 量级参考(可上下浮动·按党派 influence/角色 prestige 体量)：\n';
            tp1 += '    准奏果验(fulfilled) → 主奏者+5~8 prestige·主奏党 cohesion+3~6·政敌党 cohesion-2~5\n';
            tp1 += '    行而未尽(partial) → 中性·或 ±1~2 微调·可不动\n';
            tp1 += '    奉行不力(unfulfilled) → 主奏者-5~10 prestige·主奏党 cohesion-5~10·言官追疏\n';
            tp1 += '    适得其反(backfire) → 主奏者-10~20 prestige·-5~15 favor·主奏党 cohesion-10~20 影响-3~8·民心-·可能下狱/贬谪\n';
            tp1 += '  ※ 不可仅写 narrative 而无 deltas·亦不可硬套量级·须按当事人能力/党派强弱酌情\n';
            GM._ty3_pendingReviewForPrompt.forEach(function(rv) {
              var line = '  · ' + (rv.venueType ? '['+rv.venueType+']' : '') + '「' + (rv.content||'').slice(0, 50) + '」·';
              if (rv.proposerParty) line += rv.proposerParty + '所主·';
              if (rv.assigneeName) line += '承办：' + rv.assigneeName + '·';
              if (rv.leaderName) line += '党首：' + rv.leaderName + '·';
              line += '此回合议结：【' + (rv.histLabel || rv.label) + '】(' + rv.outcome + ')';
              tp1 += line + '\n';
            });
            tp1 += '\n';
          }
          if (_diplomaticEdicts.length > 0) {
            tp1 += '\n\n【本回合外交文书·对他势力——此非内政诏令·对方非本朝臣属·未必奉诏】\n';
            tp1 += '  ※ 对方势力有独立的君主/国策/宗教/敌友关系·可能：(1) 接受但变通执行 (2) 敷衍推诿 (3) 明确拒绝 (4) 反唇相讥甚至兴兵 (5) 暂缓答复以观望\n';
            tp1 += '  ※ 依势力对本朝 relation/attitude/militaryStrength 与议题内容择合理回应·不可如内政般"执行→反馈"·应按外交逻辑回报\n';
            tp1 += '  ※ edict_feedback 的 status 用 executing/partial/obstructed 映射外交层级（受理/半允/拒绝）·feedback 写对方朝堂/酋长/酋使的实际回应态度\n';
            tp1 += '  ※ 连带反映到 faction_updates（relation_delta/attitude_shift 等）·必要时触发 factionsAffected/revolt_update/map_changes\n';
            _diplomaticEdicts.forEach(function(e) {
              tp1 += '  【' + e.category + '】致' + (e._targetFactions||[]).join('·') + '：' + e.content;
              if (e._targetNpcs && e._targetNpcs.length) tp1 += ' (目标人物: ' + e._targetNpcs.join('、') + ')';
              if (e._deliveryStatus === 'sending' && e._remoteTargets) {
                tp1 += ' ⚠使节在途→' + e._remoteTargets.join('、') + '（尚未送达·status应为pending_delivery）';
              }
              tp1 += '\n';
            });
          }
        }
        // ═══ 长期诏令连带·跨回合·AI 须交代进展 ═══
        // 包括：前回合未完成(executing/partial/obstructed)、本回合刚下延续(pending_delivery)的诏令
        // 要求 AI 在 edict_feedback 中对这些"旧诏"也给出进展或连锁效应
        var _longLivingEdicts = GM._edictTracker.filter(function(e) {
          if (e.turn >= GM.turn) return false;
          if (!e.status) return true;
          return e.status === 'executing' || e.status === 'partial' || e.status === 'obstructed' || e.status === 'pending_delivery';
        });
        if (_longLivingEdicts.length > 0) {
          tp1 += '\n【跨回合持续诏令——前回合下的诏令尚未收束，本回合必须在 edict_feedback 中追报进展+连锁效应】\n';
          _longLivingEdicts.slice(0, 12).forEach(function(e) {
            var age = GM.turn - e.turn;
            tp1 += '  #id=' + e.id + ' 【' + e.category + ' · ' + age + '回合前】' + e.content.slice(0, 80);
            tp1 += ' / 上次状态:' + (e.status || 'pending');
            if (e.assignee) tp1 += ' / 执行者:' + e.assignee;
            if (e.progressPercent) tp1 += ' / 进度:' + e.progressPercent + '%';
            if (e.feedback) tp1 += '\n     上回反馈：' + e.feedback.slice(0, 120);
            if (e._chainEffects && e._chainEffects.length) {
              tp1 += '\n     已记连锁：' + e._chainEffects.slice(-3).map(function(ce){return ce.effect;}).join('；');
            }
            tp1 += '\n';
          });
          tp1 += '  ※ edict_feedback 里对旧诏令须给出：当下进展 / 新增连锁效应（NPC 反应 / 财政余波 / 民心涟漪）/ 下一步动向\n';
          tp1 += '  ※ 连锁效应示例："辽饷加派"三回合后——民心持续下降·陕北流民骤增·边军哗饷已歇；"免除江南赋税"——地方士绅感恩·中央税入骤降·其他州县请援\n';
          tp1 += '  ※ 连锁效应必须同步反映到 数值变化（fiscal_adjustments/class_updates/region_updates 等）·不能只是文字\n';
        }
        // 往期在途诏令——信使已送达的，提醒AI该NPC现在知道了
        var _priorRemote = (GM._edictTracker||[]).filter(function(e) {
          return e.turn < GM.turn && e._letterIds && e._letterIds.length > 0;
        });
        if (_priorRemote.length > 0) {
          var _deliveredThisTurn = [];
          var _stillTransit = [];
          _priorRemote.forEach(function(e) {
            (e._letterIds||[]).forEach(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return;
              if (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying') {
                _deliveredThisTurn.push({ edict: e, letter: lt });
              } else if (lt.status === 'traveling') {
                _stillTransit.push({ edict: e, letter: lt });
              } else if (lt.status === 'intercepted') {
                _stillTransit.push({ edict: e, letter: lt, lost: true });
              }
            });
          });
          if (_deliveredThisTurn.length > 0) {
            tp1 += '\n【往期诏令已送达——以下NPC已收到命令，应在本回合开始执行】\n';
            _deliveredThisTurn.forEach(function(d) {
              tp1 += '  ' + d.letter.to + '已收到：【' + d.edict.category + '】' + d.edict.content.slice(0,60) + '\n';
            });
          }
          if (_stillTransit.length > 0) {
            tp1 += '\n【往期诏令仍在途——以下NPC仍未收到命令】\n';
            _stillTransit.forEach(function(d) {
              tp1 += '  ' + d.letter.to + '：' + (d.lost ? '⚠信使失踪' : '信使在途') + '——' + d.edict.content.slice(0,40) + '\n';
            });
          }
        }
      }
      // 注入生命周期进行中的诏令（让AI记住上回合到哪阶段、反对派是谁、已积累效果）
      if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
        var _ongoing = GM._edictLifecycle.filter(function(e) { return !e.isCompleted; });
        if (_ongoing.length > 0) {
          tp1 += '\n\n【生命周期推演中的诏令——必须在 edict_lifecycle_update 中继续推进，不得重置回 drafting】\n';
          _ongoing.forEach(function(e) {
            var lastStage = e.stages && e.stages.length > 0 ? e.stages[e.stages.length - 1] : null;
            var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
            var phaseLabel = '';
            if (e.reformPhase && typeof REFORM_PHASES !== 'undefined' && REFORM_PHASES[e.reformPhase]) {
              phaseLabel = '·' + REFORM_PHASES[e.reformPhase].label;
            }
            var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : (lastStage ? lastStage.stage : '');
            var elapsed = GM.turn - (e.startTurn || GM.turn);
            tp1 += '  [id=' + e.edictId + '] ' + typeLabel + phaseLabel + ' 已推进' + elapsed + '回合，上回合→' + stageLabel;
            if (lastStage && lastStage.executor) tp1 += '（' + lastStage.executor + '督办）';
            if (e.oppositionLeaders && e.oppositionLeaders.length > 0) tp1 += '；反对派：' + e.oppositionLeaders.slice(0, 3).join('、');
            if (e.supporters && e.supporters.length > 0) tp1 += '；支持者：' + e.supporters.slice(0, 3).join('、');
            if (e.pilotRegion) tp1 += '；试点：' + e.pilotRegion;
            if (e.expansionRegions && e.expansionRegions.length > 0) tp1 += '；已推广：' + e.expansionRegions.slice(0, 3).join('、');
            // 累计效果（告诉AI已经花了多少国库、造成多大民心波动）
            var effectKeys = Object.keys(e.totalEffects || {});
            if (effectKeys.length > 0) {
              var effParts = effectKeys.slice(0, 4).map(function(k) { return k + (e.totalEffects[k] >= 0 ? '+' : '') + e.totalEffects[k]; });
              tp1 += '；累计效果：' + effParts.join('、');
            }
            if (lastStage && lastStage.resistanceDescription) tp1 += '；阻力：' + lastStage.resistanceDescription.slice(0, 50);
            tp1 += '\n';
          });
          tp1 += '  ※ 本回合继续推进（下一阶段或细化当前阶段），不得从草拟重起；改革类逐步推进 pilot→expand→national→backlash→outcome\n';
        }
      }
      // 注入起义前兆——最近 3 回合累积
      if (Array.isArray(GM._revoltPrecursors) && GM._revoltPrecursors.length > 0) {
        var _recentPrec = GM._revoltPrecursors.filter(function(pc){return GM.turn - pc.turn <= 5;});
        if (_recentPrec.length > 0) {
          tp1 += '\n\n【起义前兆——最近 5 回合累积】\n';
          _recentPrec.forEach(function(pc) {
            tp1 += '  T' + pc.turn + '·[' + (pc.region||'?') + '] ' + pc.class + '：' + pc.indicator + '(' + pc.severity + ')';
            if (pc.detail) tp1 += '——' + pc.detail.slice(0, 60);
            if (pc.couldLeadTo) tp1 += '；或演变为：' + pc.couldLeadTo;
            tp1 += '\n';
          });
          tp1 += '  ※ 前兆累积超 3 条且 severity=critical → 下回合应考虑 class_revolt 爆发\n';
        }
      }
      // 注入进行中起义——AI 必须继续推进每一起
      if (Array.isArray(GM._activeRevolts)) {
        var _ongoingRev = GM._activeRevolts.filter(function(r){return !r.outcome;});
        if (_ongoingRev.length > 0) {
          tp1 += '\n\n【进行中的起义——每起必须在 revolt_update 中推进；满足条件应 suppress/amnesty/transform】\n';
          _ongoingRev.forEach(function(r) {
            var elapsed = GM.turn - r.startTurn;
            tp1 += '  [id=' + r.id + '] ' + r.leaderName + '·' + r.class + '起义 已' + elapsed + '回合\n';
            tp1 += '    意识形态:' + r.ideology + ' 组织:' + r.organizationType + ' 阶段:' + r.phase + ' 规模:' + r.scale + '\n';
            if (r.historicalArchetype) tp1 += '    原型:' + r.historicalArchetype + '\n';
            if (r.slogan) tp1 += '    口号「' + r.slogan + '」\n';
            if (r.religiousSect) tp1 += '    教派:' + r.religiousSect + '\n';
            tp1 += '    兵' + r.militaryStrength + ' 粮' + r.supplyStatus + '/100 控制:[' + r.territoryControl.join('、') + ']\n';
            if (r.absorbedForces.length) tp1 += '    已收编:' + r.absorbedForces.slice(0,3).join('、') + '\n';
            if (r.defectedOfficials.length) tp1 += '    叛投官员:' + r.defectedOfficials.slice(0,3).join('、') + '\n';
            if (r.secondaryLeaders.length) tp1 += '    副将:' + r.secondaryLeaders.slice(0,3).join('、') + '\n';
            if (r.history.length > 0) {
              var _recH = r.history.slice(-3).map(function(h){return 'T'+h.turn+':'+(h.event||'').slice(0,30);}).join(' → ');
              tp1 += '    近事:' + _recH + '\n';
            }
            if (r._needTransform) tp1 += '    ⚠已达建政阈值，本回合必须 revolt_transform type=toFaction 升级为独立势力\n';
            if (r.phase === 'stalemate' && elapsed > 5) tp1 += '    ⚠相持过久，考虑招安(revolt_amnesty)或加强剿灭(revolt_suppress)\n';
            if (r.supplyStatus < 20) tp1 += '    ⚠粮草枯竭，可能自行 decline 或内讧\n';
          });
        }
      }
      // 注入问对承诺——NPC 应按应诺去做（或按性格推诿/拖延）
      if (GM._npcCommitments && Object.keys(GM._npcCommitments).length > 0) {
        var _pendingCmt = [];
        Object.keys(GM._npcCommitments).forEach(function(nm) {
          (GM._npcCommitments[nm]||[]).forEach(function(c) {
            if (c.status === 'pending' || c.status === 'executing' || c.status === 'delayed') _pendingCmt.push({ name: nm, c: c });
          });
        });
        if (_pendingCmt.length > 0) {
          tp1 += '\n\n【问对承诺——NPC 应按此行动（AI 推演时体现；可通过 npc_actions 或 commitment_update 报告进展）】\n';
          _pendingCmt.forEach(function(x) {
            var elapsed = GM.turn - x.c.assignedTurn;
            tp1 += '  [id=' + x.c.id + '] ' + x.name + ' 允' + elapsed + '回合前：' + x.c.task + '（意愿' + Math.round((x.c.willingness||0.5)*100) + '%，限' + x.c.deadline + '回合，状态' + x.c.status + ' 进展' + x.c.progress + '%）\n';
            if (x.c.npcPromise) tp1 += '    原诺："' + x.c.npcPromise + '"\n';
          });
          tp1 += '  ※ 忠诚/意愿高者执行快；忠诚低/推诿型者易拖延/忘记/阳奉阴违；可在 npc_actions 中体现行动，或在 p1 中新增 commitment_update:[{id,progress,status,feedback}]\n';
        }
      }
      // 注入御前密谋（activeSchemes 中 source=yuqian2 的）——提醒 AI 暗中推进
      if (Array.isArray(GM.activeSchemes)) {
        var _secretYuq = GM.activeSchemes.filter(function(s){ return s.source === 'yuqian2' && (!s.progress || s.progress !== '完成'); });
        if (_secretYuq.length > 0) {
          tp1 += '\n\n【御前密议遗策——暗中推进】\n';
          _secretYuq.forEach(function(s) {
            tp1 += '  T' + s.startTurn + '·' + (s.schemer||'皇帝') + '：' + (s.plan||'').slice(0, 80) + '（进度:' + (s.progress||'酝酿') + '，同谋:' + (s.allies||'') + '）\n';
          });
          tp1 += '  ※ 密谋推进应合乎逻辑——需行动者、需时机、需风险；可能暴露或成败\n';
        }
        // P6.3 修：注入 NPC 阴谋（非御前密议·sc1c 之外的全部）·主 sc1 应知朝中暗流
        var _npcSchemes = GM.activeSchemes.filter(function(s){ return s.source !== 'yuqian2' && (!s.progress || s.progress !== '完成'); });
        if (_npcSchemes.length > 0) {
          tp1 += '\n\n【朝中阴谋·非公开（仅 AI 知晓·影响 hidden_moves 演绎）】\n';
          _npcSchemes.slice(-10).forEach(function(s) {
            tp1 += '  T' + (s.startTurn||'?') + '·' + (s.schemer||'?') + '→' + (s.target||'?') + '：' + String(s.plan||'').slice(0, 60) + '（' + (s.progress||'酝酿中') + '·同谋' + (s.allies||'独行') + '）\n';
          });
          tp1 += '  ※ 这些阴谋当前对玩家不公开·但 NPC/势力会按此推进。叙事中应自然呈现端倪而非直白·让玩家从风闻/暗示中察觉\n';
        }
      }
      // P6.3 修：注入势力暗流（_factionUndercurrents·上回合 sc15 输出）
      if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
        tp1 += '\n\n【势力内部暗流·上回合 NPC 推演结论·本回合应延续】\n';
        GM._factionUndercurrents.slice(0, 8).forEach(function(u) {
          tp1 += '  ' + (u.faction||'?') + '：' + (u.situation||'') + '（趋势 ' + (u.trend||'稳定') + '·' + (u.nextMove||'') + '）\n';
        });
      }
      // P11.2B 修：注入诏令冲突链（_edictRelations·让 AI 知道哪些诏令彼此覆盖/冲突/接续/细则）
      if (Array.isArray(GM._edictRelations) && GM._edictRelations.length > 0) {
        var _recentRels = GM._edictRelations.slice(-15);
        if (_recentRels.length > 0) {
          tp1 += '\n\n【诏令关系图（KokoroMemo 范式·近 15 条·须维持因果连贯）】\n';
          _recentRels.forEach(function(r) {
            var typeLabel = { supersedes: '覆盖', contradicts: '冲突', continues: '接续', elaborates: '细则' }[r.type] || r.type;
            tp1 += '  · T' + (r.turn||'?') + ' [' + r.from + '] →[' + typeLabel + ']→ [' + r.to + ']' + (r.reason ? ' ←' + r.reason : '') + '\n';
          });
          tp1 += '  ※ supersedes(覆盖)：新政废旧政·旧政效力终止·须明叙取代经过\n';
          tp1 += '  ※ contradicts(冲突)：两道诏令逻辑矛盾·至少一道无法完全执行·须呈现执行困境\n';
          tp1 += '  ※ continues(接续)：本诏推进前诏未竟之业·须延续叙事而非另起炉灶\n';
          tp1 += '  ※ elaborates(细则)：本诏细化前诏·实施层面·须呼应原诏精神\n';
          tp1 += '  本回合若颁新政与上述任一构成新关系·须在 edict_relations 输出补充·不得回滚或忽视已有关系。\n';
        }
      }

      // P6.3 修：注入御批回听（_edictEfficacyHistory·上 5 回合诏令成败结果·让 AI 不重蹈覆辙）
      if (Array.isArray(GM._edictEfficacyHistory) && GM._edictEfficacyHistory.length > 0) {
        var _recentEfficacy = GM._edictEfficacyHistory.slice(-5);
        tp1 += '\n\n【御批回听·过去 5 回合诏令落实情况（AI 应据此调整本回合诏令兑现节奏）】\n';
        _recentEfficacy.forEach(function(eh) {
          var efficacy = (eh.overallEfficacy != null ? eh.overallEfficacy + '%' : '?');
          tp1 += '  T' + (eh.turn||'?') + ' 整体兑现率 ' + efficacy;
          if (eh.efficacyByDimension) {
            var dims = Object.keys(eh.efficacyByDimension).map(function(k){ return k + ':' + eh.efficacyByDimension[k] + '%'; }).join('·');
            if (dims) tp1 += '（' + dims + '）';
          }
          tp1 += '\n';
        });
        // 当前回合 _edictEfficacyReport 的具体未落实条目（更细粒度·上回合产生）
        var _lastEf = GM._edictEfficacyReport;
        if (_lastEf && Array.isArray(_lastEf.ignoredOrDelayed) && _lastEf.ignoredOrDelayed.length > 0) {
          tp1 += '【上回合未落实/搁置/失败诏令·下回合应明确处理（继续/废止/换臣推动/认错改弦）】\n';
          _lastEf.ignoredOrDelayed.slice(0, 10).forEach(function(r) {
            tp1 += '  · 「' + String(r.content || '').slice(0, 50) + '」 status:' + (r.status||'?') + '·原因:' + String(r.reason||'').slice(0, 40) + '\n';
          });
        }
      }
      // 方案融入：推演前先①税收级联自然结算 ②区划→七变量聚合 ③注入深化上下文
      try {
        // ①地方按税制征收 → 分账 → 损耗 → 上解中央（所有税种钱粮布走三账）
        if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function') {
          try { CascadeTax.collect(); } catch(_ctE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ctE, 'endTurn] CascadeTax.collect') : console.warn('[endTurn] CascadeTax.collect', _ctE); }
        }
        // ①.5 固定支出（俸禄/军饷/宫廷）—— 三账扣减
        if (typeof FixedExpense !== 'undefined' && typeof FixedExpense.collect === 'function') {
          try { FixedExpense.collect(); } catch(_feE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_feE, 'endTurn] FixedExpense.collect') : console.warn('[endTurn] FixedExpense.collect', _feE); }
        }
        // ①.6 军事双 schema 同步·GM.armies → GM.population.military.types(派生)·防止后续 _tickMilitarySupply 用陈旧数据
        if (typeof syncMilitarySources === 'function') {
          try { syncMilitarySources(GM); } catch(_smE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_smE, 'endTurn] syncMilitarySources') : console.warn('[endTurn] syncMilitarySources', _smE); }
        }
        // ②区划 → 七变量聚合（户口/民心/腐败/财政 等）
        if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') {
          try { IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_aggE, 'endTurn] aggregate pre-AI') : console.warn('[endTurn] aggregate pre-AI', _aggE); }
        }
        // v3：NpcMemorials 不再硬扫事件，只构造朝堂场景上下文
        if (typeof buildNpcSceneContext === 'function') {
          var _sceneCtx = buildNpcSceneContext();
          if (_sceneCtx) tp1 += '\n\n' + _sceneCtx;
        }
        // 长期事势追踪·注入（含 hidden 条目，AI 全见，玩家不见 hidden）
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtx = ChronicleTracker.getAIContextString();
          if (_chronCtx) {
            tp1 += '\n\n' + _chronCtx;
            // 硬约束·让长期工程穿透到所有输出通道
            tp1 += '\n\n【★ 长期工程穿透指令·必须遵守】\n';
            tp1 += '  · shizhengji/zhengwen(时政记)：凡涉以上「长期事势」的回合·必须在叙事中点出"陛下 X 月前所颁某诏·至今进展 Y%·主奏者某某奏报近况"·不可只写本回合孤立事件。\n';
            tp1 += '  · resource_changes(数值变化)：进度 ≥70% 时·相关方向数值应显著正向(如治河工程进 70% → 该地 unrest -3·prosperity +2)·≥95% 接近完成时·应大幅正向(unrest -5·prestige +5)·主奏者 prestige/favor +5~10。逾期或滞涩(<20% 历 3 回合+) 时·相关方向数值负向(主奏者 prestige -3·相关 region 民心 -2)。\n';
            tp1 += '  · events(事件)：进度满 95% 应 spawn"X 工竣报"事件·含主奏者奏报、地方反响、朝堂庆贺。逾期应 spawn"X 督查不力"事件·含言官弹劾。\n';
            tp1 += '  · char_updates(人物变动)：主奏者随工程推进/失败·prestige/loyalty/favor 自然变化。stakeholder NPC(关联部门长官、相关 region 大员)亦同。\n';
            tp1 += '  · npc_actions(NPC 行动)：相关 NPC 应有奏报本工程进展的奏疏 OR 私下行动(如盐法将成则盐商党首派人贿赂；治河将竣则河漕总督奏请封赏)。\n';
            tp1 += '  · 不可只字不提进行中的长期工程·这是史官最严苛的考核·真朝廷绝无可能 N 年大工程在某月一字未提的情况。\n';
          }
        }
        // 后妃请见生成器——每回合按冷落/性格/宫心决定概率
        try { _generateConsortAudiences(); } catch(_caE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_caE, 'consortAudience') : console.warn('[consortAudience]', _caE); }
        // 后妃文苑参与生成——高学识/智力后妃有概率作文投稿
        try { _generateConsortLiterary(); } catch(_clE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_clE, 'consortLit') : console.warn('[consortLit]', _clE); }
        // 后妃文苑作品待 AI 补完题名正文
        if (Array.isArray(GM.culturalWorks)) {
          // R88-fix: era 在本函数从未声明·原 pre-existing ReferenceError
          var era = '';
          try {
            var _scEra = (typeof findScenarioById === 'function') ? findScenarioById(GM.sid) : null;
            if (_scEra) era = _scEra.era || _scEra.dynasty || '';
          } catch(_) {}
          var _pendingLit = GM.culturalWorks.filter(function(w){return w && w.authorIsSpouse && w._pendingAIComplete && w.turn === GM.turn - 1;});
          if (_pendingLit.length > 0) {
            tp1 += '\n\n【★ 后妃新作·文苑待补 ★】请在 char_updates/culturalWorks_updates 里补 title 和 preview：';
            _pendingLit.forEach(function(w){
              var chw = (GM.chars||[]).find(function(c){return c&&c.name===w.author;});
              tp1 += '\n  · ' + w.author + '（' + (chw&&chw.spouseRank||'') + '）作《' + w.genre + '》·动机【' + w.motive + '】·风格【' + w.mood + '】';
              if (chw && chw.learning) tp1 += '·学识' + chw.learning;
            });
            tp1 += '\n  ★ 要求：题名典雅·正文(preview)16-40 字·符合动机与风格·贴合' + (era||'此时') + '风貌';
            tp1 += '\n  ★ 补完方式：anyPathChanges 数组里 path="culturalWorks[i]" op:"merge" value:{title:"...",preview:"..."}（i 对应 turn 和 author 定位）·或 char_updates 该妃 +culturalContribution 记叙';
          }
          // 已送到皇帝面前的作品
          if (Array.isArray(GM._consortPendingLiteraryForEmperor) && GM._consortPendingLiteraryForEmperor.length > 0) {
            var _sent = GM._consortPendingLiteraryForEmperor.filter(function(p){return p && p.turn === GM.turn - 1;});
            if (_sent.length > 0) {
              tp1 += '\n【★ 后妃呈作 ★】以下妃嫔将作品呈于陛下御览，houren_xishuo 中应有反应：';
              _sent.forEach(function(p){ tp1 += '\n  · ' + p.name + '【' + p.motive + '】'; });
              tp1 += '\n  ★ 规劝类作品 → 帝或喜或怒视性格；邀宠类 → 可能导致帝召幸（加 _pendingOvernight）；寄意类 → 帝黯然或动容';
              GM._consortPendingLiteraryForEmperor = GM._consortPendingLiteraryForEmperor.filter(function(p){return p && p.turn !== GM.turn - 1;});
            }
          }
        }
        // 朝堂问对后妃事件——触发外臣警觉"后宫干政"
        if (Array.isArray(GM._consortFormalAudiences) && GM._consortFormalAudiences.length > 0) {
          var _cfa = GM._consortFormalAudiences.filter(function(c){return c && !c.processed && c.turn === GM.turn - 1;});
          if (_cfa.length > 0) {
            tp1 += '\n\n【★ 后宫干政警报 ★】上回合陛下在朝堂问对后妃：';
            _cfa.forEach(function(c){
              tp1 += '\n  · ' + c.name + '（' + (c.spouseRank||'') + '）' + (c.motherClan?'·母族'+c.motherClan:'');
            });
            tp1 += '\n  ★ 本回合 AI 应生成外臣反应：';
            tp1 += '\n      - 御史/谏官/礼部上奏疏：memorials.push {type:"谏疏",title:"谏后宫干政疏",content:"妇人无外事·古训也·陛下亲幸朝堂问后妃·恐启妇言乱政之渐"...}';
            tp1 += '\n      - 部分清流大臣可能 npc_actions 请见规劝（type:"advise"/"remonstrate"）';
            tp1 += '\n      - 若该妃母族强势（' + _cfa.filter(function(c){return c.motherClan;}).length + ' 人有母族）→ 他派大臣可能联名弹劾外戚';
            tp1 += '\n      - 视朝代开明度 + 妃身份：朝代若偏崇礼教（宋明清前期）反应尤烈；胡族/唐/辽反应较轻';
            tp1 += '\n      - 妃子本人的 opinion 对此可能矛盾：若她爱干政则暗喜；若矜持则懊悔（记入 NPC 记忆）';
            tp1 += '\n      - 皇威 -2~-5（视反响规模），民心略降';
            GM._consortFormalAudiences.forEach(function(c){ if (c.turn === GM.turn - 1) c.processed = true; });
            // 清理已处理+超过 5 回合的
            GM._consortFormalAudiences = GM._consortFormalAudiences.filter(function(c){ return c && !c.processed; });
          }
        }
        // 若玩家上回合应允了留宿，注入 AI prompt 让推演体现
        if (Array.isArray(GM._pendingOvernight) && GM._pendingOvernight.length > 0) {
          var _on = GM._pendingOvernight.filter(function(o){return o && o.status==='accepted' && o.turn === GM.turn - 1;});
          if (_on.length > 0) {
            tp1 += '\n\n【★ 后宫·帝幸 ★】本回合推演应体现：';
            _on.forEach(function(o){
              var ch_sp = (GM.chars||[]).find(function(c){return c && c.name===o.name;});
              var spRank = ch_sp && ch_sp.spouseRank;
              var palName = ch_sp && ch_sp.residence || '';
              tp1 += '\n  · 帝幸' + o.name + '（' + (spRank||'妻室') + '·' + (palName||'某宫') + '）';
              if (ch_sp && ch_sp.motherClan) tp1 += '·母族'+ch_sp.motherClan;
            });
            tp1 += '\n  houren_xishuo 中须细写帝幸场景（行礼/叙话/旧情/枕席/次日辞朝），后妃之母族/子女可借此被提及';
            tp1 += '\n  对该后妃 loyalty/opinion 有提升，stress 下降；若有怀孕可能，npc_interactions 中加一条内廷暧昧暗示';
            tp1 += '\n  此次留宿可能引发其他后妃嫉妒/暗生怨气（npc_actions 中可体现）';
            // 清理已消费的标记
            GM._pendingOvernight = GM._pendingOvernight.filter(function(o){return !(o && o.turn === GM.turn - 1 && o.status==='accepted');});
          }
        }
        // 财政赤字状态注入——当前任一库为负 → AI 必须严厉叙事
        var _defItems = [];
        ['money','grain','cloth'].forEach(function(r){
          if (GM.guoku && (Number(GM.guoku[r])||0) < 0) _defItems.push({t:'guoku',r:r,v:GM.guoku[r]});
          if (GM.neitang && (Number(GM.neitang[r])||0) < 0) _defItems.push({t:'neitang',r:r,v:GM.neitang[r]});
        });
        if (_defItems.length > 0) {
          var _streak = GM._fiscalDeficitStreak || 1;
          tp1 += '\n\n【★★ 财政赤字·持续 ' + _streak + ' 回合 ★★】';
          _defItems.forEach(function(d){
            var tg = d.t==='guoku'?'帑廪':'内帑', rl = d.r==='money'?'银':d.r==='grain'?'粮':'布';
            tp1 += '\n  · ' + tg + '(' + rl + ')：' + d.v + '（负值表示赤字借贷）';
          });
          tp1 += '\n※ 赤字期必须在叙事中体现严重后果：';
          tp1 += '\n    - 银亏：俸禄拖欠→百官怨怼/告病离朝、军饷失发→兵变/逃亡、商贾不敢赊借、民间挤兑';
          tp1 += '\n    - 粮亏：饥荒蔓延、米价腾贵、流民暴动、军队哗变、漕运停滞';
          tp1 += '\n    - 布亏：军装不继、工匠罢织、宫廷缩减供给';
          tp1 += '\n    - 持续 ' + _streak + ' 回合赤字：权臣借机坐大、地方观望、异族窥伺、天象示警（若朝代迷信）';
          tp1 += '\n※ edict_feedback 中需将相关诏令标 obstructed（执行停滞），并在 feedback 中明言"库已空虚/某军哗变/某地起义"';
          tp1 += '\n※ npc_actions 可让臣子主动上奏请"借贷于商贾/加税/抄豪强/开捐纳/发内帑"等筹款手段，但每种手段都有副作用';
          if (_streak >= 3) tp1 += '\n※ 持续 3+ 回合·AI 须生成至少 1 条 major 事件：某军哗变/某地民变/某大臣请辞/某豪强抗税/外族借机入侵';
        }
        // 财政亏欠注入——上回合库不足导致的未付款项，AI 本回合必须叙事处置
        if (Array.isArray(GM._fiscalShortfalls) && GM._fiscalShortfalls.length > 0) {
          var _unresolved = GM._fiscalShortfalls.filter(function(s){return s && !s.resolved;});
          if (_unresolved.length > 0) {
            tp1 += '\n\n【★ 财政亏欠·上回合库不足未付】';
            _unresolved.slice(0, 12).forEach(function(s){
              var _tg = s.target === 'guoku' ? '帑廪' : s.target === 'neitang' ? '内帑' : s.target;
              var _rl = s.resource === 'grain' ? '粮' : s.resource === 'cloth' ? '布' : '银';
              tp1 += '\n  · T' + s.turn + ' ' + _tg + '(' + _rl + ')【' + (s.name||'') + '】请 ' + s.requested + ' · 仅拨 ' + s.applied + ' · 亏欠 ' + s.shortfall + (s.reason?'（'+s.reason+'）':'');
            });
            tp1 += '\n  ※ 本回合 AI 必须就以上亏欠给出后果：';
            tp1 += '\n      - 赏赐亏欠 → 受赏者/势力不满或失望，npc_actions/关系下滑，可能 loyalty -5~-15';
            tp1 += '\n      - 军饷亏欠 → 军队哗变/逃亡/将领怨怼，edict_feedback 标 obstructed，民心-2 皇威-3';
            tp1 += '\n      - 赈济亏欠 → 饥荒扩散/民变概率↑，地方 region 民心下滑，新增 pendingCrisis';
            tp1 += '\n      - 工程/专款亏欠 → 工期停滞，project_updates 标 halted，工匠罢工';
            tp1 += '\n      - 外交赔款亏欠 → 敌方 faction 恼怒，可能宣战或报复，边境 hostility↑';
            tp1 += '\n      - 如本回合已补齐（通过新的 fiscal_adjustments），标 _fiscalShortfalls[i].resolved=true（通过 anyPathChanges）';
            tp1 += '\n      - 玩家可能下诏筹款（加税/借贷/抄家/鬻爵），AI 须判定执行阻力';
          }
        }
        if (typeof buildFullAIContext === 'function') {
          var _fCtx = buildFullAIContext();
          // ── 七变量 + 深化字段（详细）──
          if (_fCtx.variables) {
            tp1 += '\n\n【七大变量·推演必读（深化数据）】';
            var _v = _fCtx.variables;
            if (_v.huangwei)  tp1 += '\n  皇威：真 ' + Math.round((_v.huangwei.index||0)) + ' / 视 ' + Math.round(_v.huangwei.perceivedIndex||_v.huangwei.index||0) + ' · ' + (_v.huangwei.phase||'') + (_v.huangwei.tyrantSyndrome?' · 暴君症候活':'') + (_v.huangwei.lostCrisis?' · 失威危机活':'');
            if (_v.huangquan) tp1 += '\n  皇权：' + Math.round((_v.huangquan.index||0)) + ' · ' + (_v.huangquan.phase||'') + (_v.huangquan.powerMinister?' · 权臣 '+ _v.huangquan.powerMinister.name:'');
            if (_v.minxin)    tp1 += '\n  民心：真 ' + Math.round((_v.minxin.index||0)) + ' / 视 ' + Math.round(_v.minxin.perceivedIndex||_v.minxin.index||0) + ' · ' + (_v.minxin.phase||'');
            if (_v.corruption) tp1 += '\n  吏治：真 ' + Math.round((_v.corruption.index||0)) + ' / 视 ' + Math.round(_v.corruption.perceivedIndex||_v.corruption.index||0);
            if (_v.guoku)     tp1 += '\n  帑廪：钱 ' + Math.round((_v.guoku.money||0)/10000) + ' 万两 · 粮 ' + Math.round((_v.guoku.grain||0)/10000) + ' 万石 · 布 ' + Math.round((_v.guoku.cloth||0)/10000) + ' 万匹 · 月入 ' + Math.round((GM.guoku && GM.guoku.monthlyIncome||0)/10000) + ' 万';
            if (_v.neitang)   tp1 += '\n  内帑：钱 ' + Math.round((_v.neitang.money||0)/10000) + ' 万两 · 粮 ' + Math.round((GM.neitang && GM.neitang.grain||0)/10000) + ' 万石 · 布 ' + Math.round((GM.neitang && GM.neitang.cloth||0)/10000) + ' 万匹 · 皇庄 ' + Math.round(_v.neitang.huangzhuangAcres||0) + ' 亩';
            // 本回合税收级联摘要（帮助 AI 了解自然结算已完成什么）
            if (GM._lastCascadeSummary) {
              var cs = GM._lastCascadeSummary;
              tp1 += '\n  本回合自然税收已结算：上解中央 钱 ' + Math.round(cs.central.money/10000) + '万/粮 ' + Math.round(cs.central.grain/10000) + '万/布 ' + Math.round(cs.central.cloth/10000) + '万';
              tp1 += '；地方留存 钱 ' + Math.round(cs.localRetain.money/10000) + '万/粮 ' + Math.round(cs.localRetain.grain/10000) + '万';
              tp1 += '；被贪 钱 ' + Math.round(cs.skimmed.money/10000) + '万/粮 ' + Math.round(cs.skimmed.grain/10000) + '万；路途损耗 钱 ' + Math.round(cs.lostTransit.money/10000) + '万';
            }

            // ★ 帑廪 收源 subItems · 让 AI 看 8 大类下细目（如田赋·正赋 X 万 + 附加 Y 万）
            try {
              if (GM.guoku && GM.guoku.sourcesDetail) {
                var _gkSrcCats = ['tianfu','dingshui','caoliang','yanlizhuan','shipaiShui','quanShui','mining','fishingTax','juanNa','qita'];
                var _gkSrcCatNames = {tianfu:'田赋',dingshui:'丁税',caoliang:'漕粮',yanlizhuan:'盐铁茶',shipaiShui:'市舶',quanShui:'榷税',mining:'矿冶',fishingTax:'渔课',juanNa:'捐纳',qita:'其他'};
                var _gkSrcArr = [];
                _gkSrcCats.forEach(function(cat) {
                  var items = GM.guoku.sourcesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 1000) return; // 过滤 < 0.1 万的零碎
                  var parts = items.slice(0, 3).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _gkSrcArr.push((_gkSrcCatNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_gkSrcArr.length > 0) tp1 += '\n  帑廪·收源细目：' + _gkSrcArr.join('；');
              }
            } catch(_e){}

            // ★ 帑廪 支用 subItems · 让 AI 看 8 大类下细目
            try {
              if (GM.guoku && GM.guoku.expensesDetail) {
                var _gkExpCats = ['fenglu','junxiang','zhenzi','gongcheng','jisi','shangci','neiting','qita'];
                var _gkExpCatNames = {fenglu:'俸禄',junxiang:'军饷',zhenzi:'赈济',gongcheng:'工程',jisi:'祭祀',shangci:'赏赐',neiting:'内廷转运',qita:'其他'};
                var _gkExpArr = [];
                _gkExpCats.forEach(function(cat) {
                  var items = GM.guoku.expensesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 1000) return;
                  var parts = items.slice(0, 3).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _gkExpArr.push((_gkExpCatNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_gkExpArr.length > 0) tp1 += '\n  帑廪·支用细目：' + _gkExpArr.join('；');
              }
            } catch(_e){}

            // ★ 内帑 收/支 subItems
            try {
              if (GM.neitang && GM.neitang.sourcesDetail) {
                var _ntSrcCats = ['huangzhuang','huangchan','specialTax','confiscation','tribute','guokuTransfer'];
                var _ntSrcNames = {huangzhuang:'皇庄',huangchan:'皇产',specialTax:'特税',confiscation:'抄家',tribute:'朝贡',guokuTransfer:'帑廪转运'};
                var _ntSrcArr = [];
                _ntSrcCats.forEach(function(cat) {
                  var items = GM.neitang.sourcesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 500) return;
                  var parts = items.slice(0, 2).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _ntSrcArr.push((_ntSrcNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_ntSrcArr.length > 0) tp1 += '\n  内帑·收源细目：' + _ntSrcArr.join('；');
              }
              if (GM.neitang && GM.neitang.expensesDetail) {
                var _ntExpCats = ['gongting','dadian','shangci','houGongLingQin','guokuRescue'];
                var _ntExpNames = {gongting:'宫廷',dadian:'大典',shangci:'赏赐',houGongLingQin:'后宫陵寝',guokuRescue:'援帑廪'};
                var _ntExpArr = [];
                _ntExpCats.forEach(function(cat) {
                  var items = GM.neitang.expensesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 500) return;
                  var parts = items.slice(0, 2).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _ntExpArr.push((_ntExpNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_ntExpArr.length > 0) tp1 += '\n  内帑·支用细目：' + _ntExpArr.join('；');
              }
            } catch(_e){}

            // ★ 各税种地方贡献 top·央地财政透明溯源
            try {
              if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.getTopContributors === 'function' && GM.guoku && GM.guoku._sourceContributors) {
                var _topRows = [];
                var _topNameMap = {tianfu:'田赋',dingshui:'丁',caoliang:'漕',yanke:'盐',yanlizhuan:'盐铁',shipo:'市舶',shipaiShui:'市舶',mining:'矿',quanShui:'榷',fishingTax:'渔',juanNa:'捐'};
                Object.keys(GM.guoku._sourceContributors).slice(0, 6).forEach(function(cat) {
                  var tops = CascadeTax.getTopContributors(cat, 3);
                  if (!tops || tops.length === 0) return;
                  var topStr = tops.map(function(t){ return t.name + t.pct.toFixed(0) + '%'; }).join('|');
                  _topRows.push((_topNameMap[cat]||cat) + '⊳' + topStr);
                });
                if (_topRows.length > 0) tp1 += '\n  地方贡献占比·主税种：' + _topRows.join('；');
              }
            } catch(_e){}
            if (_v.population && _v.population.national) tp1 += '\n  户口：户 ' + Math.round((_v.population.national.households||0)/10000) + ' 万 · 口 ' + Math.round((_v.population.national.mouths||0)/10000) + ' 万 · 丁 ' + Math.round((_v.population.national.ding||0)/10000) + ' 万 · 逃户 ' + (_v.population.fugitives||0) + ' · 隐户 ' + (_v.population.hiddenCount||0);
          }
          // ── 民心分阶层/分区域 ──
          try {
            if (GM.minxin && GM.minxin.byClass) {
              var classKeys = Object.keys(GM.minxin.byClass);
              if (classKeys.length > 0) {
                var cls = classKeys.slice(0,9).map(function(k){
                  var v = GM.minxin.byClass[k];
                  var idx = (typeof v === 'object' && v !== null) ? (v.index || v.true || 60) : v;
                  return k + Math.round(idx||60);
                }).join('·');
                tp1 += '\n  民心·分阶层：' + cls;
              }
            }
          } catch(_e){}
          // ── 腐败 6 部门 ──
          try {
            if (GM.corruption && GM.corruption.byDept) {
              var dp = Object.keys(GM.corruption.byDept).map(function(d){
                var v = GM.corruption.byDept[d];
                if (typeof v === 'object') v = v.true || v.overall;
                return d + Math.round(v||0);
              }).join('·');
              if (dp) tp1 += '\n  吏治·6部门：' + dp;
            }
          } catch(_e){}
          // ── 14源累积（民心驱动因素）──
          try {
            if (GM.minxin && GM.minxin.sources) {
              var src = Object.keys(GM.minxin.sources).filter(function(k){return Math.abs(GM.minxin.sources[k])>0.5;})
                .slice(0,8).map(function(k){var v=GM.minxin.sources[k];return k+(v>=0?'+':'')+v.toFixed(1);}).join(' ');
              if (src) tp1 += '\n  民心·主要驱动：' + src;
            }
          } catch(_e){}

          // ── 行政区划深化（每顶级）──
          try {
            if (GM.adminHierarchy) {
              var divTxt = [];
              Object.keys(GM.adminHierarchy).slice(0,3).forEach(function(fk){
                var divs = GM.adminHierarchy[fk] && GM.adminHierarchy[fk].divisions || [];
                divs.slice(0,8).forEach(function(d){
                  var line = '  ' + (d.name||d.id) + '(' + (d.level||'') + ')';
                  if (d.governor) line += ' 官:' + d.governor;
                  if (d.population && typeof d.population === 'object') {
                    if (d.population.mouths) line += ' 口' + Math.round(d.population.mouths/10000) + '万';
                    if (d.population.fugitives) line += ' 逃' + d.population.fugitives;
                  }
                  if (typeof d.minxin === 'number') line += ' 民心' + Math.round(d.minxin);
                  if (typeof d.corruption === 'number') line += ' 腐' + Math.round(d.corruption);
                  if (d.fiscal && d.fiscal.actualRevenue) {
                    line += ' 赋' + Math.round(d.fiscal.actualRevenue/10000) + '万';
                    // ★ 各税种贡献细目（top 3）
                    if (d.fiscal.contributionsByCategory) {
                      var _catKeys = Object.keys(d.fiscal.contributionsByCategory)
                        .filter(function(c){ return d.fiscal.contributionsByCategory[c] > 1000; })
                        .sort(function(a,b){ return d.fiscal.contributionsByCategory[b] - d.fiscal.contributionsByCategory[a]; })
                        .slice(0, 3);
                      if (_catKeys.length > 0) {
                        var _catNameMap = {tianfu:'田',dingshui:'丁',caoliang:'漕',yanke:'盐',yanlizhuan:'盐',shipo:'舶',shipaiShui:'舶',mining:'矿',quanShui:'榷',fishingTax:'渔',juanNa:'捐'};
                        line += '[' + _catKeys.map(function(c){ return (_catNameMap[c]||c) + Math.round(d.fiscal.contributionsByCategory[c]/10000) + 'w'; }).join(',') + ']';
                      }
                    }
                  }
                  if (d.publicTreasury && d.publicTreasury.money && d.publicTreasury.money.deficit>0) line += ' 亏' + Math.round(d.publicTreasury.money.deficit/10000) + '万';
                  if (d.regionType && d.regionType !== 'normal') line += ' [' + d.regionType + ']';
                  if (d.environment && d.environment.currentLoad > 0.9) line += ' 过载';
                  // ★ 田亩流转·本回合
                  if (d._thisTurnLandFlow) {
                    var _lf = d._thisTurnLandFlow;
                    var _lfP = [];
                    if (_lf.annexed > 0) _lfP.push('兼并' + Math.round(_lf.annexed/10000) + 'w');
                    if (_lf.reclaimed > 0) _lfP.push('开垦' + Math.round(_lf.reclaimed/10000) + 'w');
                    if (_lf.surveyed > 0) _lfP.push('清丈' + Math.round(_lf.surveyed/10000) + 'w');
                    if (_lfP.length) line += ' 田流(' + _lfP.join('|') + ')';
                  }
                  // ★ 经济基础 tags（让 AI 知道此区有何特殊属性·从而推演策略）
                  if (d.tags) {
                    var _tagP = [];
                    if (d.tags.hasPort) _tagP.push('港');
                    if (d.tags.saltRegion) _tagP.push('盐');
                    if (d.tags.mineralRegion) _tagP.push('矿');
                    if (d.tags.horseRegion) _tagP.push('马');
                    if (d.tags.fishingRegion) _tagP.push('渔');
                    if (d.tags.imperialDomain) _tagP.push('辖');
                    if (_tagP.length) line += ' [' + _tagP.join('') + ']';
                  }
                  // ★ 累计兼并 — 提示 AI 是否需要清丈
                  if (d.economyBase && d.economyBase.landsAnnexed > 100000) {
                    line += ' 兼并累' + Math.round(d.economyBase.landsAnnexed/10000) + 'w';
                  }
                  divTxt.push(line);
                });
              });
              if (divTxt.length) tp1 += '\n\n【行政区划·深化】（你可改 adminHierarchy.{fac}.divisions.{id或name}.{field}）\n' + divTxt.join('\n');
            }
          } catch(_e){}

          // ── 输出格式 ──
          tp1 += '\n\n【推演产出要求】';
          tp1 += '\n推演产生的任何变化请通过以下 JSON 字段输出：';
          tp1 += '\n  · changes: [{path, delta|value, reason}]  （path 支持 by-name：如 "chars.张三.loyalty" / "adminHierarchy.player.divisions.冀州.population.mouths"）';
          tp1 += '\n  · appointments: [{action:"appoint|dismiss|transfer", charName, position, binding}]';
          tp1 += '\n  · institutions: [{action:"create|abolish", type, id, name, annualBudget}]';
          tp1 += '\n  · regions: [{action:"reclassify", id, newType, reason}]';
          tp1 += '\n  · events: [{category, text, credibility}]';
          tp1 += '\n  · npc_interactions: [{actor, target, type:"impeach|slander|recommend|frame_up|betray|private_visit|correspond_secret|mediate|expose_secret|duel_poetry|master_disciple|reconcile|guarantee|..", description, involvedOthers?, publicKnown?}] —— 系统自动路由到 奏疏/问对/鸿雁/起居注/风闻，且按 type 自动涨/跌 actor 的 fame(名望 -100..+100)与 virtueMerit(贤能 累积)——譬如 recommend/mediate 提贤能，frame_up/betray/slander 损名望，expose_secret/impeach 对被揭者 fame 大跌。请按人物性格/立场/与目标关系选择合适的 type，避免机械化';
          tp1 += '\n  · localActions: [{region, type:"disaster_relief|public_works_water|public_works_road|education|granary_stockpile|military_prep|charity_local|illicit", amount, reason, proposer}] —— 地方官自主治理（按 region.fiscal 情况决定，amount < 3% 地方留存为常规，10-30% 为应急。illicit 为贪墨挪用，进入主官私产）';
          tp1 += '\n';
          tp1 += '\n【财政与田亩流转·新机制·可用 path】';
          tp1 += '\n  · 各 division.economyBase 字段可读·田赋/盐课/矿/海贸 = farmland × landTaxRate / saltProduction × saltTaxRate / mineralProduction × mineralTaxRate / maritimeTradeVolume × maritimeRate';
          tp1 += '\n  · 兼并自动结算：corruption > 50 时按 (corr-50)/100×4%/年 farmland 流入 landsAnnexed（豪强吞并）';
          tp1 += '\n  · 开垦自动结算：currentLoad < 0.7 时按 (1-load)×1.5%/年 增 farmland，劝农政策×2.5（path: "policies.encourageFarming" = true 启动）';
          tp1 += '\n  · 清丈触发：path "adminHierarchy.{fac}.divisions.{name}._surveyTrigger" = true 单次触发·下回合按 30-60% 从 landsAnnexed 回 farmland（民心高 → 比例高）';
          tp1 += '\n  · 道路质量 economyBase.roadQuality 影响驿递成本与商旅·可由地方治理「修路」localAction 缓慢提升';
          tp1 += '\n  · 帑廪/内帑 subItems 已展示·推演时引用具体细目（如「田赋·正赋下降 X 万因兼并」）而非空洞「岁入下降」';
          tp1 += '\n';
          tp1 += '\n【重要原则】';
          tp1 += '\n · 必读以上七变量+深化字段，推演要体现数据（而非空洞叙事）';
          tp1 += '\n · 不受历史约束——剧本仅作参考，只要合理即可（架空策略、反史实均允许）';
          tp1 += '\n · NPC 行为不要按职位套模板（御史必谏/将军必请战是工具人思维）';
          tp1 += '\n · 突发事件（灾/疫/异象/权臣/民变）通过 npc_interactions 让大臣/官员上奏或求见告知玩家，不要另起弹窗';
        }
      } catch(_fctxErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fctxErr, 'endturn] fullCtx inject:') : console.warn('[endturn] fullCtx inject:', _fctxErr); }

      // 1.2+1.8+S1：ModelAdapter温度 + OpenAI原生JSON模式 + 流式感知进度
      // 动态 max_tokens：取模型单次最大输出（_MODEL_CTX_MAP）与业务需要 16K 的较小值·避免小模型被要求超限、大模型被限制过保守
      var _sc1BaseTok = Math.min(_effectiveOutCap || 16384, 16384);
      // G1+G5·Schema 裁剪：按模型输出能力自动裁剪·玩家可通过 P.conf.modelTier 手动覆写档位（low/medium/high）
      try {
        var _outCapK_G1 = _effectiveOutCap ? Math.round(_effectiveOutCap / 1024) : 16;
        // G5 手动覆写：low→当 4K 处理；medium→当 8K；high→不裁剪
        var _tierOverride = P.conf && P.conf.modelTier;
        if (_tierOverride === 'low') _outCapK_G1 = 4;
        else if (_tierOverride === 'medium') _outCapK_G1 = 8;
        else if (_tierOverride === 'high') _outCapK_G1 = 32;
        if (_outCapK_G1 <= 4) {
          tp1 += '\n\n【★模型能力降级·SC1 schema 精简】\n';
          tp1 += '  · 检测到单次输出 ≤ 4K tokens·请尽量压缩 schema\n';
          tp1 += '  · 必填核心字段：shizhengji/zhengwen/playerStatus/playerInner + edict_feedback 数组\n';
          tp1 += '  · 可缩或留空：cultural_works/npc_letters/npc_correspondence/npc_interactions/faction_interactions_advanced/faction_events/npc_schemes/hidden_moves/fengwen_snippets（这些由 SC1b/SC1c 补充·此处可 []）\n';
          tp1 += '  · 人物/势力/阶层 updates 只给最要紧 3 条·不要凑数\n';
          tp1 += '  · shizhengji/zhengwen 控制在 400 字内·不要长篇铺陈\n';
        } else if (_outCapK_G1 <= 8) {
          tp1 += '\n\n【模型能力中等·SC1 schema 中度精简】\n';
          tp1 += '  · 检测到单次输出 ≤ 8K tokens\n';
          tp1 += '  · cultural_works/npc_correspondence/fengwen_snippets 可 []（由 SC1b/SC1c 补充）\n';
          tp1 += '  · 核心字段 shizhengji/zhengwen/edict_feedback/char_updates 必填\n';
        }
      } catch(_g1E) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_g1E, 'G1 schema prune') : console.warn('[G1 schema prune]', _g1E); }
      // G3·温度按子调用类型分：SC1 主推演叙事·保持 _modelTemp（常 0.8）
      var _sc1Temp = _modelTemp;
      // ★ Token 预算监控·SC1 prompt 接近 / 超出 context window 时报警 + 自动裁剪
      try {
        if (typeof checkPromptTokenBudget === 'function') {
          var _sc1FullPrompt = (sysP || '') + '\n' + (tp1 || '');
          var _sc1TokRes = checkPromptTokenBudget(_sc1FullPrompt, function(status, tokens, bg) {
            var msg = '[SC1] prompt ' + status + '·estimated ' + tokens + ' tokens·budget ' + bg.budget + ' (' + bg.contextK + 'K context)';
            if (typeof toast === 'function') toast(msg);
            if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(new Error(msg), 'SC1.tokenBudget');
          });
          if (typeof window !== 'undefined') {
            window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
            window.TM.lastPromptTokens.sc1 = { tokens: _sc1TokRes.tokens, status: _sc1TokRes.status, budget: _sc1TokRes.budget.budget, trimmed: false, ts: Date.now() };
          }
          // critical → 双调用策略：Call A 压缩长段·Call B(SC1) 用压缩结果·保证质量不截断
          if (_sc1TokRes.status === 'critical' && tp1.length > 8000) {
            var _longSections = [
              { rx: /\n  帑廪·收源细目：[\s\S]*?(?=\n  帑廪·支用|\n  内帑·|\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '帑廪收源' },
              { rx: /\n  帑廪·支用细目：[\s\S]*?(?=\n  内帑·|\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '帑廪支用' },
              { rx: /\n  内帑·收源细目：[\s\S]*?(?=\n  内帑·支用|\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '内帑收源' },
              { rx: /\n  内帑·支用细目：[\s\S]*?(?=\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '内帑支用' },
              { rx: /\n  地方贡献占比·主税种：[\s\S]*?(?=\n  户口|\n  民心|\n\n【|$)/, label: '地方贡献' },
              { rx: /\n  民心·主要驱动：[\s\S]*?(?=\n\n【|$)/, label: '民心 14 源' },
              { rx: /\n  腐败·6部门：[\s\S]*?(?=\n  民心·|\n  14|\n\n【|$)/, label: '腐败 6 部门' },
              { rx: /\n  民心·分阶层：[\s\S]*?(?=\n  腐败·|\n\n【|$)/, label: '民心分阶层' }
            ];
            var _extracted = '';
            var _extractedLabels = [];
            _longSections.forEach(function(sect) {
              var match = tp1.match(sect.rx);
              if (match) {
                _extracted += '\n[' + sect.label + ']' + match[0];
                _extractedLabels.push(sect.label);
                tp1 = tp1.replace(sect.rx, '');
              }
            });
            // 仅当抽取出 > 1.5KB 内容时启动 Call A 压缩
            if (_extracted.length > 1500 && typeof callAIMessages === 'function') {
              var _callASys = '你是天命游戏的「财政民心摘要史官」·阅读以下原始数据·压缩为 ≤ 700 字的「关键观察清单」·要求：(1) 保留具体数字（如「田赋88万·盐课168万」）(2) 标注异常（如「四川田赋仅 6 万远低预期」）(3) 标注 top 1-2 个支柱地区 (4) 用 · 分隔条目·不写解释性废话';
              var _callAUser = _extracted;
              try {
                if (typeof toast === 'function') toast('[SC1] critical·启动 Call A 压缩长段...');
                var _callABody = {
                  model: P.ai.model || 'gpt-4o',
                  messages: [{ role: 'system', content: _callASys }, { role: 'user', content: _callAUser }],
                  temperature: 0.3,
                  max_tokens: _tok(1200)
                };
                var _callARaw = await callAIMessages(_callABody.messages, _callABody.max_tokens, undefined, 'tier-low');
                var _summary = (_callARaw && _callARaw.choices && _callARaw.choices[0] && _callARaw.choices[0].message && _callARaw.choices[0].message.content) || '';
                if (_summary.length > 100) {
                  // 把压缩结果嵌回 tp1 — 紧接七变量段后
                  var _injection = '\n\n【财政民心·压缩观察(原数据 ' + _extractedLabels.length + ' 段·共 ' + _extracted.length + ' 字 → 压缩 ' + _summary.length + ' 字)】\n' + _summary.trim() + '\n';
                  // 找一个合适注入点：「【行政区划·深化】」之前·或在 tp1 末尾增量
                  if (tp1.indexOf('\n\n【行政区划') >= 0) {
                    tp1 = tp1.replace(/\n\n【行政区划/, _injection + '\n\n【行政区划');
                  } else {
                    tp1 += _injection;
                  }
                  // 记录
                  window.TM.lastPromptTokens.sc1.compressed = {
                    sections: _extractedLabels,
                    rawChars: _extracted.length,
                    summaryChars: _summary.length,
                    callAModel: _callABody.model
                  };
                  if (typeof toast === 'function') toast('[SC1] Call A 压缩成功·' + _extracted.length + '字 → ' + _summary.length + '字');
                  // 重新检测 SC1 token
                  var _retok = checkPromptTokenBudget((sysP||'') + '\n' + tp1);
                  window.TM.lastPromptTokens.sc1.tokensAfter = _retok.tokens;
                  window.TM.lastPromptTokens.sc1.statusAfter = _retok.status;
                } else {
                  // Call A 失败·把抽取的内容贴回去（保证不丢）
                  tp1 += _extracted;
                  if (typeof toast === 'function') toast('[SC1] Call A 返回为空·已贴回原内容');
                }
              } catch(_callAErr) {
                // Call A 抛错·把抽取内容贴回去
                tp1 += _extracted;
                if (typeof toast === 'function') toast('[SC1] Call A 失败·已贴回原内容: ' + (_callAErr && _callAErr.message || ''));
                if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(_callAErr, 'SC1.callA');
              }
            } else if (_extracted.length > 0) {
              // 抽取到内容但太少·或 callAIMessages 不可用·贴回去
              tp1 += _extracted;
            }
          }
        }
      } catch(_tokE) {}
      // ★ 后置强调（depth=0 等价物·LSR 范式）：把表操作规则投到 user prompt 末尾·克服长上下文头部衰减
      if (_memTblRule) tp1 += '\n\n' + _memTblRule;
      var _sc1Body = {model:P.ai.model||"gpt-4o",messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp1}],temperature:_sc1Temp,max_tokens:_tok(_sc1BaseTok)};
      if (_modelFamily === 'openai') _sc1Body.response_format = { type: 'json_object' };
      var _streamSC1 = (P.ai && P.ai.stream_sc1 !== false);  // 默认开·可通过 P.ai.stream_sc1=false 关闭
      var c1 = "";
      var data1 = null;
      if (_streamSC1) {
        // 流式·边接收边更新进度条（不尝试 partial JSON parse·避免数据损坏）
        _sc1Body.stream = true;
        try {
          c1 = await callAIMessagesStream(_sc1Body.messages, _sc1Body.max_tokens, {
            temperature: _sc1Temp,
            extraBody: _modelFamily === 'openai' ? { response_format: { type: 'json_object' } } : undefined,
            onChunk: function(text) {
              // 按字数大致估算进度：5K字约 55%·10K约 60%·15K约 65%
              var _approx = 50 + Math.min(15, Math.floor(text.length / 1500));
              showLoading('AI\u63A8\u6F14\u4E2D\u00B7\u5DF2\u751F\u6210' + Math.round(text.length/100)/10 + 'k\u5B57', _approx);
            }
          });
          data1 = { choices: [{ message: { content: c1 } }] };
          // 流式模式无 usage·不记 token
        } catch(_se) {
          _dbg('[SC1 stream] failed·fallback to fetch:', _se);
          _streamSC1 = false;
        }
      }
      if (!_streamSC1) {
        delete _sc1Body.stream;  // 确保 fallback 不发 stream:true
        var resp1=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},body:JSON.stringify(_sc1Body)});
        if(!resp1.ok) throw new Error('HTTP ' + resp1.status);
        data1=await resp1.json();
        if(data1.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data1.usage);
        if(data1.choices&&data1.choices[0]&&data1.choices[0].message) c1=data1.choices[0].message.content;
      }
      _checkTruncated(data1, '结构化数据');
      p1=null; // 赋值到外层声明的p1
      p1=extractJSON(c1);
      GM._turnAiResults.subcall1_raw = c1;
      GM._turnAiResults.subcall1 = p1;
      // ★ P11.2C-full 审核收件箱·解决 pending 条目（KokoroMemo review_policy 范式·完整版）
      // 逻辑：pending 条目超 2 回合·检查后续 shijiHistory 是否提及→approved；否则 rejected
      try {
        if (Array.isArray(GM._consolidatedMemory) && GM._consolidatedMemory.length > 0) {
          var _curTurnReview = (GM.turn || 1);
          var _recentShijiText = '';
          if (Array.isArray(GM.shijiHistory)) {
            GM.shijiHistory.slice(-3).forEach(function(sh) {
              _recentShijiText += (sh.shizhengji || '') + ' ' + (sh.shilu || '') + ' ' + (sh.zhengwen || '');
            });
          }
          var _approvedCnt = 0, _rejectedCnt = 0;
          GM._consolidatedMemory.forEach(function(cm) {
            if (!cm || !cm._pendingTurn) cm._pendingTurn = cm.turn;
            var age = _curTurnReview - cm.turn;
            if (age < 2) return; // 不足 2 回合·继续 pending
            // 检查 key_threads
            (cm.key_threads || []).forEach(function(th) {
              if (th._status !== 'pending') return;
              // 用线索关键词匹配 shijiHistory
              var threadText = (th.thread || '') + ' ' + (th.actors || '');
              var keywords = threadText.split(/[·、，,。\s]/).filter(function(s){ return s.length >= 2; }).slice(0, 3);
              var hit = keywords.some(function(k) { return _recentShijiText.indexOf(k) >= 0; });
              th._status = hit ? 'approved' : 'rejected';
              th._reviewedTurn = _curTurnReview;
              if (hit) _approvedCnt++; else _rejectedCnt++;
            });
            // 检查 unresolved_tensions / next_turn_focus 同理
            (cm.unresolved_tensions || []).forEach(function(t) {
              if (typeof t !== 'object' || t._status !== 'pending') return;
              var tText = t.text || '';
              var tWords = tText.split(/[·、，,。\s]/).filter(function(s){ return s.length >= 2; }).slice(0, 3);
              var hit = tWords.some(function(k) { return _recentShijiText.indexOf(k) >= 0; });
              t._status = hit ? 'approved' : 'rejected';
              t._reviewedTurn = _curTurnReview;
              if (hit) _approvedCnt++; else _rejectedCnt++;
            });
            (cm.next_turn_focus || []).forEach(function(f) {
              if (typeof f !== 'object' || f._status !== 'pending') return;
              var fText = f.text || '';
              var fWords = fText.split(/[·、，,。\s]/).filter(function(s){ return s.length >= 2; }).slice(0, 3);
              var hit = fWords.some(function(k) { return _recentShijiText.indexOf(k) >= 0; });
              f._status = hit ? 'approved' : 'rejected';
              f._reviewedTurn = _curTurnReview;
              if (hit) _approvedCnt++; else _rejectedCnt++;
            });
          });
          if (_approvedCnt + _rejectedCnt > 0) {
            _dbg('[InboxReview] approved=' + _approvedCnt + ' rejected=' + _rejectedCnt);
          }
        }
      } catch(_invE) { _dbg('[InboxReview] fail:', _invE); }

      // ★ P11.2B 诏令冲突链消费端（KokoroMemo graph.py 范式）
      try {
        if (p1 && Array.isArray(p1.edict_relations) && p1.edict_relations.length > 0) {
          if (!Array.isArray(GM._edictRelations)) GM._edictRelations = [];
          var _curT = GM.turn || 1;
          p1.edict_relations.forEach(function(er) {
            if (!er || !er.from || !er.to || !er.type) return;
            var validTypes = ['supersedes', 'contradicts', 'continues', 'elaborates'];
            if (validTypes.indexOf(er.type) < 0) return;
            GM._edictRelations.push({
              from: String(er.from).slice(0, 40),
              to: String(er.to).slice(0, 40),
              type: er.type,
              reason: String(er.reason || '').slice(0, 80),
              turn: _curT
            });
          });
          // LRU 100 条
          if (GM._edictRelations.length > 100) GM._edictRelations = GM._edictRelations.slice(-100);
          _dbg('[EdictRelations] 本回合新增', p1.edict_relations.length, '条·总计', GM._edictRelations.length);
        }
      } catch(_erE) { _dbg('[EdictRelations] 解析失败:', _erE); }

      // ★ 应用 12 表更新·三通道兼容（Phase 5.3 修 OpenAI response_format='json_object' 屏蔽 <tableEdit> 的致命 bug）
      try {
        if (window.MemTables) {
          var _mtTotalOps = [];
          // 通道 A：sc1 JSON 字段 p1.table_updates 数组（OpenAI 强制 json_object 时唯一可走通道·结构化最稳）
          if (p1 && Array.isArray(p1.table_updates) && p1.table_updates.length > 0) {
            p1.table_updates.forEach(function(d) {
              if (!d || !d.sheet) return;
              var def = MemTables.SHEET_BY_KEY[d.sheet] || MemTables.SHEET_BY_IDX[d.sheet];
              if (!def) return;
              var cmd = (d.op || d.cmd || 'insert').toLowerCase();
              var rowIdx = (typeof d.rowIdx === 'number') ? d.rowIdx : parseInt(d.rowIdx, 10);
              if ((cmd === 'update' || cmd === 'delete') && (isNaN(rowIdx) || rowIdx < 0)) return;
              _mtTotalOps.push({
                cmd: cmd,
                tableIdx: def.idx,
                rowIdx: isNaN(rowIdx) ? null : rowIdx,
                values: d.values || {}
              });
            });
          }
          // 通道 B：p1.tableEdit 字符串（AI 输出 JSON 中带 tableEdit 字段）
          // 通道 C：c1 文本中嵌入 <tableEdit> 块（Anthropic/Gemini 无 response_format 限制时可走）
          var _mtEditText = (p1 && typeof p1.tableEdit === 'string') ? p1.tableEdit : c1;
          if (_mtEditText && (_mtEditText.indexOf('<tableEdit>') >= 0 || _mtEditText.indexOf('insertRow(') >= 0)) {
            var _mtParsed = MemTables.parseTableEdit(_mtEditText);
            if (_mtParsed && _mtParsed.ops && _mtParsed.ops.length > 0) {
              _mtTotalOps = _mtTotalOps.concat(_mtParsed.ops);
            }
          }
          if (_mtTotalOps.length > 0) {
            var _mtStats = MemTables.applyAIOps(_mtTotalOps, { actor: 'ai' });
            _dbg('[MemTables sc1] applied:', _mtStats,
                 '·channels: json=' + ((p1 && p1.table_updates) ? p1.table_updates.length : 0) +
                 ' xml=' + ((_mtEditText && _mtEditText.indexOf('<tableEdit>') >= 0) ? 'y' : 'n'));
          }
          // 一致性哨兵·sc1 之后扫一遍
          if (MemTables.runConsistencySentinel) {
            var _mtWarns = MemTables.runConsistencySentinel((typeof GM !== 'undefined' && GM && GM.turn) || 1);
            if (_mtWarns && _mtWarns.length) _dbg('[MemTables sentinel]', _mtWarns.length, 'warnings');
          }
        }
      } catch(_mtAE) { _dbg('[MemTables sc1 apply] fail:', _mtAE); }
      // 校验 AI 输出结构（非阻断）
      try { if (window.TM && TM.validateAIOutput) TM.validateAIOutput(p1, 'subcall1'); } catch(_ve){}

      // ═══ Sub-call 1b + 1c · 并行执行（S3 优化）══════════════════════════════
      // 两者无交集字段，通过 async IIFE 并行启动，Promise.all 等待
      var _sc1bP = (async function() {
      // ═══ Sub-call 1b · 文事鸿雁人际专项（独立预算 8k，避免文事/鸿雁/互动被 sc1 庞大 schema 挤出）═══
      try {
        var _sc1bStart = Date.now();
        showLoading('\u6587\u4E8B\u00B7\u52BF\u529B\u00B7\u5E76\u884C\u63A8\u6F14', 58);

        var _charsBriefB = '';
        try {
          var _liveCharsB = (GM.chars||[]).filter(function(c){return c && c.alive!==false;});
          _liveCharsB.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
          var _briefListB = _liveCharsB.slice(0,24).map(function(c){
            var _p = c.name;
            if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
            if (c.location) _p += '@' + c.location;
            if (c.faction) _p += '[' + c.faction + ']';
            _p += ' \u5FE0' + (c.loyalty||50) + '\u00B7\u667A' + (c.intelligence||50) + '\u00B7\u5B66' + (c.scholarship||c.intelligence||50);
            if (Array.isArray(c.traits) && c.traits.length) _p += ' \u7279{' + c.traits.slice(0,3).join(',') + '}';
            return _p;
          });
          _charsBriefB = _briefListB.join('\n');
        } catch(_cbE){}

        var _capB = (GM._capital) || (P.playerInfo && P.playerInfo.capital) || '\u4EAC\u57CE';
        var _pNameB = (P.playerInfo && P.playerInfo.characterName) || '';
        var _recentSZJ = (p1 && p1.shizhengji) ? String(p1.shizhengji).slice(0,1500) : '';

        var tp1b = '\u3010\u6587\u4E8B\u00B7\u9E3F\u96C1\u00B7\u4EBA\u9645\u4E92\u52A8\u00B7\u4E13\u9879\u63A8\u6F14\u3011\n';
        tp1b += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + ' \u00B7 \u9996\u90FD\uFF1A' + _capB + '\n';
        if (_pNameB) tp1b += '\u73A9\u5BB6\u89D2\u8272\uFF1A' + _pNameB + '\uFF08\u4E0D\u5F97\u4F5C\u4E3A npc_interactions.actor\uFF0C\u4E0D\u5F97 autonomous \u4F5C cultural_works\uFF09\n';
        if (_recentSZJ) tp1b += '\n\u3010\u672C\u56DE\u5408\u5DF2\u8BB0\u65F6\u653F\u3011\n' + _recentSZJ + '\n';
        if (_charsBriefB) tp1b += '\n\u3010\u4E3B\u8981\u4EBA\u7269\uFF08\u542B\u4F4D\u7F6E/\u5B98\u804C/\u6D3E\u7CFB/\u7279\u8D28\uFF09\u3011\n' + _charsBriefB + '\n';
        // 长期事势注入·让后人戏说/鸿雁/密信能涉及多年未竣的工程
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtxB = ChronicleTracker.getAIContextString();
          if (_chronCtxB) {
            tp1b += '\n' + _chronCtxB + '\n';
            tp1b += '\n\u3010\u2605 \u957F\u671F\u4E8B\u52BF\u7A7F\u900F\u5230\u6587\u4E8B/\u9E3F\u96C1/\u5BC6\u4FE1\u3011\n';
            tp1b += '  \u00B7 cultural_works(\u540E\u4EBA\u620F\u8BF4/\u6587\u82D1\u4F5C\u54C1)\uFF1A\u8FDB\u5EA6 \u226570% \u5DE5\u7A0B\u00B7\u76F8\u5173 NPC \u5F53\u4F5C\u300C\u9882\u529F\u8BD7\u8D4B/\u54CF\u53F9\u5DE5\u827A\u300D\u00B7\u8FDB\u5EA6 <20% \u5386\u591A\u56DE\u5408\u00B7\u5F53\u4F5C\u300C\u8BBD\u523A\u8BD7/\u5F39\u52BE\u6587/\u6C11\u8C23\u8BAF\u4E4B\u300D\u3002\n';
            tp1b += '  \u00B7 npc_letters(\u9E3F\u96C1\u4F20\u4E66)\uFF1A\u53C2\u4E0E\u8BE5\u5DE5\u7A0B\u7684\u5730\u65B9\u5B98\u5E94\u6709\u594F\u62A5\u672C\u5DE5\u7A0B\u8FDB\u5C55\u7684\u4E66\u4FE1(\u5982\u6CBB\u6CB3 60% \u2192 \u6CB3\u9053\u603B\u7763\u594F\u300C\u6CB3\u5DE5\u73B0\u72B6\u00B7\u5824\u5DF2\u6210\u516B\u4E5D\u00B7\u5C1A\u9700\u2026\u2026\u300D)\u3002\n';
            tp1b += '  \u00B7 npc_correspondence(\u5BC6\u4FE1)\uFF1A\u957F\u671F\u5DE5\u7A0B\u4E2D\u5931\u610F/\u53CD\u5BF9\u65B9 NPC \u5E94\u6709\u79C1\u4E0B\u62B1\u6028/\u4E32\u8054(\u5982\u53D8\u6CD5\u5C06\u6210 \u2192 \u53CD\u5BF9\u515A\u515A\u9B41\u4E0E\u95E8\u751F\u5BC6\u8BAE\u300C\u6B64\u6CD5\u96BE\u4E45\u00B7\u5F53\u5F85\u65F6\u7FFB\u6848\u300D)\u3002\n';
            tp1b += '  \u00B7 npc_interactions(NPC \u4E92\u52A8)\uFF1A\u957F\u671F\u5DE5\u7A0B\u4E3B\u594F\u8005\u4E0E stakeholder \u4E4B\u95F4\u5E94\u6709\u534F\u8C03\u4E92\u52A8\u3002\n';
            tp1b += '  \u00B7 \u8FD9\u4E9B\u5185\u5BB9\u987B\u5207\u5B9E\u547C\u5E94\u300C\u957F\u671F\u4E8B\u52BF\u300D\u4E2D\u7684\u5177\u4F53\u6761\u76EE\u00B7\u4E0D\u53EF\u53EA\u5199\u672C\u56DE\u5408\u5B64\u7ACB\u4E8B\u00B7\u8BA9\u73A9\u5BB6\u611F\u5230\u300C\u6709\u51E0\u4E2A\u4E09\u4E94\u5E74\u5927\u4E8B\u5728\u80CC\u666F\u6301\u7EED\u63A8\u8FDB\u300D\u3002\n';
          }
        }

        // 已有内容提示（避免重复）
        var _existCW = (p1 && Array.isArray(p1.cultural_works)) ? p1.cultural_works.length : 0;
        var _existNL = (p1 && Array.isArray(p1.npc_letters)) ? p1.npc_letters.length : 0;
        var _existNC = (p1 && Array.isArray(p1.npc_correspondence)) ? p1.npc_correspondence.length : 0;
        var _existNI = (p1 && Array.isArray(p1.npc_interactions)) ? p1.npc_interactions.length : 0;
        if (_existCW || _existNL || _existNC || _existNI) {
          tp1b += '\n\u3010\u4E0A\u4E00\u5B50\u8C03\u7528\u5DF2\u751F\u6210\u3011\u6587\u4E8B ' + _existCW + ' \u7BC7\uFF0C\u9E3F\u96C1 ' + _existNL + ' \u5C01\uFF0C\u5BC6\u4FE1 ' + _existNC + ' \u6761\uFF0C\u4E92\u52A8 ' + _existNI + ' \u6B21\u3002\u8BF7\u8865\u5145\u751F\u6210\u66F4\u591A\u4E0D\u540C\u5185\u5BB9\uFF0C\u4E0D\u8981\u91CD\u590D\u3002\n';
        }

        tp1b += '\n\u3010\u4EFB\u52A1\u3011\u751F\u6210\u4EE5\u4E0B\u56DB\u7C7B\u5185\u5BB9\uFF0C\u8FD4\u56DE\u4E25\u683C JSON\uFF08\u4EC5\u5305\u542B\u8FD9\u56DB\u4E2A\u5B57\u6BB5\uFF09\uFF1A\n\n';

        tp1b += '\u25C6 cultural_works\uFF08\u6587\u82D1\u4F5C\u54C1\u00B7\u5E38\u6001 3-6 \u7BC7\uFF0C\u91CD\u5927\u4E8B\u4EF6\u65F6 5-10 \u7BC7\uFF09\u2014\u2014\n';
        tp1b += '  \u6309\u89E6\u53D1\u6E90\uFF08A\u79D1\u4E3E\u5BA6\u9014/B\u9006\u5883\u8D2C\u8C2A/C\u793E\u4EA4\u916C\u9162/D\u4EFB\u4E0A\u65BD\u653F/E\u6E38\u5386\u5C71\u6C34/F\u5BB6\u4E8B\u79C1\u60C5/G\u65F6\u5C40\u5929\u4E0B/H\u60C5\u611F\u5FC3\u5883\uFF09\u9009\u6709\u8D44\u683C\u7684 NPC \u751F\u6210\u5176\u4F5C\u54C1\u3002\n';
        tp1b += '  \u2605 content \u5FC5\u987B\u5168\u6587\u771F\u5B9E\u751F\u6210\uFF1A\u7EDD\u53E5 20/\u5F8B\u8BD7 40\u621656/\u8BCD\u6309\u8BCD\u724C\u5B57\u6570/\u8D4B 300-800/\u6587 200-600\uFF1B\u53E4\u6587\u5FCC\u73B0\u4EE3\u8BCD\u6C47\uFF1B\u683C\u5F8B\u8BD7\u5C3D\u529B\u8BB2\u5E73\u4EC4\u5BF9\u4ED7\u3002\u4E0D\u5F97\u5199\u5360\u4F4D\u7B26\u5982"(\u6B64\u5904\u8BD7)"\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{author, turn:' + (GM.turn||1) + ', date, location, triggerCategory, trigger, motivation, lifeStage, genre, subtype, title, content, mood, theme, elegance, dedicatedTo[], inspiredBy, commissionedBy, praiseTarget, satireTarget, quality, politicalImplication, politicalRisk, narrativeContext, preservationPotential}\n';
        tp1b += '  motivation\uFF1Aspontaneous\u81EA\u53D1/commissioned\u53D7\u547D/flattery\u5E72\u8C12/response\u916C\u7B54/mourning\u54C0\u60BC/critique\u8BBD\u8C15/celebration\u9882\u626C/farewell\u9001\u522B/memorial\u7EAA\u5FF5/ghostwrite\u4EE3\u7B14/duty\u5E94\u5236/self_express\u81EA\u62D2\n';
        tp1b += '  genre\uFF1Ashi\u8BD7/ci\u8BCD/fu\u8D4B/qu\u66F2/ge\u6B4C\u884C/wen\u6563\u6587/apply\u5E94\u7528\u6587/ji\u8BB0\u53D9\u6587/ritual\u796D\u6587\u7891\u94ED/paratext\u5E8F\u8DCB\n';
        tp1b += '  politicalRisk\uFF1A\u8BBD\u8C15/critique \u7C7B\u9AD8\uFF0C\u5E73\u548C\u7C7B\u4F4E\u3002preservationPotential \u8D28\u91CF\u8D8A\u9AD8/\u9898\u6750\u8D8A\u91CD\u8D8A\u5BB9\u6613\u4F20\u4E16\u3002\n';
        tp1b += '  \u89E6\u53D1\u6761\u4EF6\uFF1A\u667A\u529B\u226570 + scholar/theologian/eccentric/pensive/curious \u7279\u8D28 \u2192 \u9AD8\u6743\u91CD\uFF1B\u9047\u8D2C/\u4E01\u5FE7/\u81F4\u4ED5/\u6218\u80DC/\u593A\u804C/\u4E54\u8FC1/\u5BFF\u8FB0 \u2192 \u5F3A\u89E6\u53D1\uFF1Bstress>60 \u501F\u6587\u53D1\u6CC4\u3002lazy/craven \u964D\u6743\u3002\n\n';

        tp1b += '\u25C6 npc_letters\uFF08\u9E3F\u96C1\u4F20\u4E66\u00B7\u6BCF\u56DE\u5408 2-5 \u5C01\uFF09\u2014\u2014\n';
        tp1b += '  \u4E0D\u5728 ' + _capB + ' \u7684 NPC \u9047\u91CD\u5927\u4E8B\u4EF6\u4E3B\u52A8\u5199\u4FE1\u7ED9\u7687\u5E1D\u3002from \u5FC5\u987B\u662F\u4E0D\u5728\u9996\u90FD\u7684 NPC\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{from, type:"report\u5954\u544A/plea\u6C42\u63F4/warning\u8B66\u62A5/personal\u79C1\u60C5/intelligence\u60C5\u62A5", urgency:"normal/urgent/extreme", content(100-200\u5B57\u53E4\u5178\u4E2D\u6587), suggestion(1-2\u53E5\u53EF\u7701), replyExpected:true}\n';
        tp1b += '  \u53C2\u8003\u4FE1\u4EF6\u6A21\u5F0F\uFF1A\u8FB9\u5C06\u544A\u6025\u00B7\u5730\u65B9\u5B98\u8BF7\u547D\u00B7\u6D41\u5B98\u8FF0\u60C5\u00B7\u51FA\u4F7F\u56DE\u62A5\u00B7\u79BB\u4EAC\u65E7\u81E3\u6000\u60F3\u00B7\u5BC6\u63A2\u5BC6\u62A5\u3002\n\n';

        tp1b += '\u25C6 npc_correspondence\uFF08NPC \u4E4B\u95F4\u5BC6\u4FE1\u00B72-5 \u6761\uFF09\u2014\u2014\n';
        tp1b += '  NPC \u95F4\u79D8\u5BC6\u4E66\u4FE1/\u7ED3\u76DF\u7EA6\u5B9A/\u60C5\u62A5\u4EA4\u6362/\u5BC6\u8C0B\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{from, to, content(50-150\u5B57), summary(\u4E00\u53E5\u8BDD), implication(\u5BF9\u5C40\u52BF\u6F5C\u5728\u5F71\u54CD), type:"secret/alliance/conspiracy/routine"}\n\n';

        tp1b += '\u25C6 npc_interactions\uFF08NPC \u4E92\u52A8\u00B75-12 \u6761\uFF09\u2014\u2014\n';
        tp1b += '  \u7CFB\u7EDF\u81EA\u52A8\u8DEF\u7531\uFF1Aimpeach/slander/expose_secret \u2192 \u594F\u758F\u5F39\u7AE0\uFF1Brecommend/guarantee/petition_jointly \u2192 \u8350\u8868\uFF1B\n';
        tp1b += '  private_visit/invite_banquet/duel_poetry \u2192 \u95EE\u5BF9\u6C42\u89C1\uFF1Bgift_present \u2192 \u9E3F\u96C1\u9644\u793C\uFF1Bcorrespond_secret/share_intelligence \u2192 \u9E3F\u96C1\u5BC6\u4FE1\uFF1B\n';
        tp1b += '  frame_up/betray/mediate/reconcile \u2192 \u98CE\u95FB\uFF1Bmaster_disciple \u2192 \u8D77\u5C45\u6CE8\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{actor, target, type, description(30-60\u5B57), involvedOthers?, publicKnown?(true/false)}\n';
        tp1b += '  \u6309\u4EBA\u7269\u6027\u683C/\u6D3E\u7CFB/\u5173\u7CFB\u9009\u5408\u9002\u7684 type\uFF0C\u907F\u514D"\u5FA1\u53F2\u5FC5\u8C0F/\u5C06\u519B\u5FC5\u8BF7\u6218"\u5DE5\u5177\u4EBA\u6A21\u677F\u3002\n';
        tp1b += '  \u7279\u522B\u6CE8\u610F\uFF1A\u5305\u542B\u5F39\u52BE/\u8350\u4E3E/\u5BC6\u5BFF/\u8FAD\u7E41/\u5F92\u5F92\u4F20\u9053\u7B49\u53E4\u5178\u653F\u6CBB\u884C\u4E3A\uFF0C\u4E00\u90E8\u5206 publicKnown=true \u8FDB\u98CE\u95FB\uFF0C\u4E00\u90E8\u5206 false \u79C1\u4E0B\u3002\n\n';

        tp1b += '\u3010\u786C\u89C4\u5219\u3011\n';
        tp1b += '  \u00B7 \u53EA\u8FD4\u56DE\u4E0A\u8FF0\u56DB\u4E2A\u5B57\u6BB5\u7684 JSON\uFF08\u65E0\u5176\u4ED6\u5B57\u6BB5\uFF09\n';
        tp1b += '  \u00B7 \u4EBA\u540D\u5FC5\u987B\u662F\u73B0\u6709\u89D2\u8272\uFF08\u5DF2\u5217\u5728\u4E0A\u65B9\u4EBA\u7269\u8868\u4E2D\uFF09\n';
        tp1b += '  \u00B7 \u5185\u5BB9\u8981\u4E30\u5BCC\u3001\u6709\u753B\u9762\u611F\u3001\u4E0D\u673A\u68B0\u5316\n';
        tp1b += '  \u00B7 \u73A9\u5BB6 ' + _pNameB + ' \u4E0D\u5F97\u4F5C npc_interactions.actor\uFF1B\u4E0D\u5F97 autonomous \u4F5C cultural_works\n';
        tp1b += '  \u00B7 \u9AD8\u8D28\u91CF\uFF1A\u8BD7\u8981\u6709\u5883\uFF0C\u6587\u8981\u6709\u56E0\uFF0C\u4FE1\u8981\u6709\u9690\uFF0C\u4E92\u52A8\u8981\u6709\u65B9\n';
        tp1b += '\n\u8FD4\u56DE\u683C\u5F0F\uFF1A\n';
        tp1b += '{\n  "cultural_works":[{...}],\n  "npc_letters":[{...}],\n  "npc_correspondence":[{...}],\n  "npc_interactions":[{...}]\n}';

        // 动态 max_tokens：取模型输出上限与业务 8K 的较小值
        var _sc1bBaseTok = Math.min(_effectiveOutCap || 8192, 8192);
        // G3·SC1b 文事创意类·温度调高促生诗文情志的发散
        var _sc1bTemp = Math.min(1.0, _modelTemp + 0.15);
        // M4·Anthropic 原生 API 且 sys 长·加 cache_control
        var _sc1bMsgs = [{role:'system',content:sysP},{role:'user',content:tp1b}];
        try {
          var _isNativeAnth1b = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
          if (_modelFamily === 'anthropic' && _isNativeAnth1b && sysP.length > 1500) {
            _sc1bMsgs = [{role:'system', content:[{type:'text', text:sysP, cache_control:{type:'ephemeral'}}]}, {role:'user',content:tp1b}];
          }
        } catch(_){}
        // ★ Token 预算监控·SC1b
        try {
          if (typeof checkPromptTokenBudget === 'function') {
            var _sc1bFullPrompt = (sysP || '') + '\n' + (tp1b || '');
            var _sc1bTokRes = checkPromptTokenBudget(_sc1bFullPrompt, function(status, tokens, bg) {
              if (typeof toast === 'function') toast('[SC1b] prompt ' + status + '·' + tokens + ' tokens');
            });
            if (typeof window !== 'undefined') {
              window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
              window.TM.lastPromptTokens.sc1b = { tokens: _sc1bTokRes.tokens, status: _sc1bTokRes.status, ts: Date.now() };
            }
          }
        } catch(_tokE) {}
        var _sc1bBody = {model:P.ai.model||'gpt-4o', messages:_sc1bMsgs, temperature:_sc1bTemp, max_tokens:_tok(_sc1bBaseTok)};
        if (_modelFamily === 'openai') _sc1bBody.response_format = { type:'json_object' };

        var resp1b = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body:JSON.stringify(_sc1bBody)});
        if (resp1b.ok) {
          var data1b = await resp1b.json();
          _checkTruncated(data1b, '\u6587\u4E8B\u9E3F\u96C1\u4EBA\u9645');
          if (data1b.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data1b.usage);
          var c1b = (data1b.choices && data1b.choices[0] && data1b.choices[0].message) ? data1b.choices[0].message.content : '';
          var p1b = extractJSON(c1b);
          GM._turnAiResults.subcall1b_raw = c1b;
          GM._turnAiResults.subcall1b = p1b;
          try { if (window.TM && TM.validateAIOutput) TM.validateAIOutput(p1b, 'subcall1b'); } catch(_vbe){}

          if (p1b && p1) {
            if (Array.isArray(p1b.cultural_works)) p1.cultural_works = (Array.isArray(p1.cultural_works) ? p1.cultural_works : []).concat(p1b.cultural_works);
            if (Array.isArray(p1b.npc_letters)) p1.npc_letters = (Array.isArray(p1.npc_letters) ? p1.npc_letters : []).concat(p1b.npc_letters);
            if (Array.isArray(p1b.npc_correspondence)) p1.npc_correspondence = (Array.isArray(p1.npc_correspondence) ? p1.npc_correspondence : []).concat(p1b.npc_correspondence);
            if (Array.isArray(p1b.npc_interactions)) p1.npc_interactions = (Array.isArray(p1.npc_interactions) ? p1.npc_interactions : []).concat(p1b.npc_interactions);
            _dbg('[sc1b] \u5408\u5E76: \u6587\u4E8B+' + (p1b.cultural_works||[]).length + ' \u9E3F\u96C1+' + (p1b.npc_letters||[]).length + ' \u5BC6\u4FE1+' + (p1b.npc_correspondence||[]).length + ' \u4E92\u52A8+' + (p1b.npc_interactions||[]).length);
          }
          GM._subcallTimings.sc1b = Date.now() - _sc1bStart;
        } else {
          console.warn('[sc1b] HTTP', resp1b.status);
        }
      } catch(_sc1bErr) {
        console.warn('[sc1b] \u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u4E3B\u6D41\u7A0B\uFF09:', _sc1bErr.message || _sc1bErr);
      }
      })();  // end SC1b IIFE

      var _sc1cP = (async function() {
      // ═══ Sub-call 1c · 势力 & NPC 自主博弈专项（独立预算 8k，丰富势力外交+NPC 阴谋）═══
      try {
        var _sc1cStart = Date.now();

        var _facsBriefC = '';
        try {
          var _liveFacsC = (GM.facs||[]).filter(function(f){return f && !f.isPlayer;});
          _facsBriefC = _liveFacsC.slice(0,14).map(function(f){
            var _p = f.name + ' \u5B9E' + (f.strength||50);
            if (f.leader) _p += ' \u9996:' + f.leader;
            if (f.attitude) _p += ' \u6001:' + f.attitude;
            if (f.goal) _p += ' \u76EE:' + String(f.goal).slice(0,30);
            if (f.culture) _p += ' [' + f.culture + ']';
            if (f.mainstream) _p += '\u00B7' + f.mainstream;
            if (f.type) _p += '\u00B7' + f.type;
            return _p;
          }).join('\n');
        } catch(_e){}

        var _relsBriefC = '';
        try {
          if (Array.isArray(GM.factionRelations)) {
            _relsBriefC = GM.factionRelations.slice(0,18).map(function(r){
              var s = r.from + '\u2192' + r.to + ' ' + (r.type||'?');
              if (r.value !== undefined) s += '(' + r.value + ')';
              if (r.trust !== undefined) s += ' \u4FE1' + r.trust;
              if (r.hostility !== undefined) s += ' \u654C' + r.hostility;
              if (r.economicTies !== undefined) s += ' \u7ECF' + r.economicTies;
              if (r.kinshipTies !== undefined) s += ' \u4EB2' + r.kinshipTies;
              return s;
            }).join('\n');
          }
        } catch(_e){}

        var _npcsBriefC = '';
        try {
          var _liveNpcsC = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;});
          _liveNpcsC.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
          _npcsBriefC = _liveNpcsC.slice(0,20).map(function(c){
            var _p = c.name;
            if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
            if (c.faction) _p += '[' + c.faction + ']';
            if (c.party) _p += '{' + c.party + '}';
            _p += ' \u5FE0' + (c.loyalty||50) + '\u00B7\u5FD7' + (c.ambition||50) + '\u00B7\u5EC9' + (c.integrity||50);
            if (Array.isArray(c.traits) && c.traits.length) _p += ' \u7279{' + c.traits.slice(0,2).join(',') + '}';
            return _p;
          }).join('\n');
        } catch(_e){}

        var _undercurrentsC = '';
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _undercurrentsC = GM._factionUndercurrents.slice(0,8).map(function(u){
            return (u.faction||'?') + ': ' + (u.situation||'') + (u.nextMove?' (\u53EF\u80FD:'+u.nextMove+')':'');
          }).join('\n');
        }

        var _activeSchemesC = '';
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _activeSchemesC = GM.activeSchemes.slice(-8).map(function(s){
            return (s.schemer||'?') + ' \u9488\u5BF9 ' + (s.target||'?') + ': ' + String(s.plan||'').slice(0,40) + ' [' + (s.progress||'') + ']';
          }).join('\n');
        }

        var _recentSZJC = (p1 && p1.shizhengji) ? String(p1.shizhengji).slice(0,1200) : '';
        var _pNameC = (P.playerInfo && P.playerInfo.characterName) || '';

        var tp1c = '\u3010\u52BF\u529B\u5916\u4EA4\u00B7NPC\u9634\u8C0B\u00B7\u4E13\u9879\u63A8\u6F14\u3011\n';
        tp1c += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '\n';
        if (_recentSZJC) tp1c += '\n\u3010\u672C\u56DE\u5408\u65F6\u653F\u3011\n' + _recentSZJC + '\n';
        if (_facsBriefC) tp1c += '\n\u3010\u975E\u73A9\u5BB6\u52BF\u529B\u3011\n' + _facsBriefC + '\n';
        if (_relsBriefC) tp1c += '\n\u3010\u52BF\u529B\u5173\u7CFB\u5FEB\u7167\u3011\n' + _relsBriefC + '\n';
        if (_undercurrentsC) tp1c += '\n\u3010\u4E0A\u56DE\u5408\u52BF\u529B\u6697\u6D41\uFF08\u5E94\u6709\u540E\u7EED\uFF09\u3011\n' + _undercurrentsC + '\n';
        if (_activeSchemesC) tp1c += '\n\u3010\u8FDB\u884C\u4E2D\u9634\u8C0B\uFF08\u901A\u8FC7 scheme_actions \u63A8\u8FDB\uFF0C\u4E0D\u8981\u5728 npc_schemes \u91CD\u590D\uFF09\u3011\n' + _activeSchemesC + '\n';
        // 长期事势·含 hidden 条目（AI 全见，用于构思本回合该推进/完成哪些）
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtxC = ChronicleTracker.getAIContextString();
          if (_chronCtxC) tp1c += '\n' + _chronCtxC + '\n';
        }
        if (_npcsBriefC) tp1c += '\n\u3010\u4E3B\u8981 NPC\uFF08\u542B\u5B98\u804C/\u6D3E\u7CFB/\u5FE0\u5FD7\u5EC9/\u7279\u8D28\uFF09\u3011\n' + _npcsBriefC + '\n';

        tp1c += '\n\u3010\u4EFB\u52A1\u3011\u751F\u6210\u4EE5\u4E0B\u4E03\u7C7B\u5185\u5BB9\uFF0C\u8FD4\u56DE\u4E25\u683C JSON\uFF08\u4EC5\u5305\u542B\u8FD9\u4E9B\u5B57\u6BB5\uFF09\uFF1A\n\n';

        tp1c += '\u25C6 faction_interactions_advanced\uFF08\u52BF\u529B\u6DF1\u5EA6\u4E92\u52A8\u00B7\u5E38\u6001 3-6 \u6761\uFF0C\u5916\u4EA4\u6D3B\u8DC3\u671F 6-10 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  23 \u79CD type\uFF1A\n';
        tp1c += '    \u6218\u4E89\uFF1Adeclare_war\u5BA3\u6218/border_clash\u8FB9\u5883\u51B2\u7A81/sue_for_peace\u8BF7\u548C/annex_vassal\u5E76\u541E\n';
        tp1c += '    \u548C\u5E73\uFF1Asend_envoy\u9063\u4F7F/form_confederation\u7ED3\u76DF/break_confederation\u6BC1\u7EA6/recognize_independence\u627F\u8BA4\u72EC\u7ACB\n';
        tp1c += '    \u85E9\u5C5E\uFF1Ademand_tribute\u7D22\u8D21/pay_tribute\u732E\u8D21/royal_marriage\u548C\u4EB2/send_hostage\u8D28\u5B50/gift_treasure\u8D60\u5B9D\n';
        tp1c += '    \u7ECF\u6D4E\uFF1Aopen_market\u4E92\u5E02/trade_embargo\u8D38\u6613\u7981\u8FD0/pay_indemnity\u8D54\u6B3E\n';
        tp1c += '    \u6587\u5316\uFF1Acultural_exchange\u6587\u5316\u4EA4\u6D41/religious_mission\u5B97\u6559\u4F7F\u8282\n';
        tp1c += '    \u519B\u4E8B\uFF1Amilitary_aid\u519B\u63F4/proxy_war\u4EE3\u7406\u6218\u4E89/incite_rebellion\u7172\u52A8\u53DB\u4E71\n';
        tp1c += '    \u60C5\u62A5\uFF1Aspy_infiltration\u7EC6\u4F5C/assassin_dispatch\u523A\u5BA2\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{from, to, type, viaProxy?(proxy_war\u65F6), terms, tributeItems?(tribute\u65F6), marriageDetails?(marriage\u65F6\u2014\u2014"XX\u516C\u4E3B\u5AC1YY\u738B"), hostageDetails?(hostage\u65F6\u2014\u2014"XX\u5B50\u5165\u8D28"), treatyType?(\u76DF\u597D/\u79F0\u81E3/\u505C\u6218/\u4E92\u4E0D\u4FB5\u72AF), description, durationTurns, reason}\n';
        tp1c += '  \u5386\u53F2\u53C2\u8003\uFF1A\u662D\u541B\u51FA\u585E/\u6587\u6210\u516C\u4E3B\u5165\u85CF(kinshipTies+/hostility-)\uFF1B\u6E05\u521D\u8D28\u5B50(trust+)\uFF1B\u695A\u6C49\u7528\u8BF8\u4FAF\u4EE3\u7406\u6218\u4E89(trust-)\uFF1B\u5BCB\u6E0A\u5C81\u5E01/\u660E\u518C\u5C01\u671D\u9C9C\u7434\u7409\u7403\uFF1B\u5B8B\u8FBD\u6982\u573A/\u660E\u8499\u9A6C\u5E02(economicTies+)\n';
        tp1c += '  \u4E00\u81F4\u6027\u5F0F\uFF1A\u80CC\u76DF/\u6BC1\u7EA6/\u523A\u6740\u5F71\u54CD\u6DF1\u8FDC\u4E0D\u53EF\u8F7B\u6613"\u548C\u597D"\uFF1B\u548C\u4EB2/\u8D28\u5B50\u8981\u5177\u4F53\u4EBA\u540D\n\n';

        tp1c += '\u25C6 faction_events\uFF08\u52BF\u529B\u95F4/\u5185\u90E8\u4E8B\u4EF6\u00B7\u5E38\u6001 3-6 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{actor, target?(\u5185\u653F\u4E8B\u4EF6\u53EF\u7701), action(30\u5B57), actionType:"\u5916\u4EA4/\u5185\u653F/\u519B\u4E8B/\u7ECF\u6D4E", result(30\u5B57), strength_effect:0, geoData?:{routeKm, terrainDifficulty:0.5, hasOfficialRoad, routeDescription("\u7ECF\u2026\u2026"), passesAndBarriers[], fortLevel, garrison}}\n';
        tp1c += '  \u519B\u4E8B\u7C7B geoData \u5FC5\u586B\uFF0C\u5176\u4ED6\u7C7B\u53EF\u7701\n\n';

        tp1c += '\u25C6 faction_relation_changes\uFF08\u52BF\u529B\u5173\u7CFB\u53D8\u5316\u00B72-5 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{from, to, type, delta, reason}\n';
        tp1c += '  \u5173\u7CFB\u516D\u7EF4\uFF1Atrust\u4FE1\u4EFB/hostility\u654C\u610F/economicTies\u7ECF\u6D4E/culturalAffinity\u6587\u5316/kinshipTies\u59FB\u4EB2/territorialDispute\u9886\u571F\uFF1B\u6309\u4E92\u52A8\u5BFC\u81F4\u7684\u7EF4\u5EA6\u66F4\u65B0\n\n';

        tp1c += '\u25C6 faction_succession\uFF08\u52BF\u529B\u7EE7\u627F\u00B7\u4EC5\u5F53\u9996\u9886\u6B7B\u4EA1/\u5931\u5FC3/\u6C11\u53D8\u65F6\u89E6\u53D1\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{faction, oldLeader, newLeader, legitimacy:70, stability_delta:-10, disputeType:"\u6B63\u5E38\u7EE7\u627F/\u4E89\u4F4D/\u7BE1\u4F4D/\u5185\u6218/\u5916\u621A\u4E13\u653F/\u91CD\u81E3\u63A8\u8F7D", narrative(40\u5B57)}\n\n';

        tp1c += '\u25C6 npc_schemes\uFF08NPC \u9634\u8C0B\u00B7\u65B0\u589E\u9634\u8C0B\u3002\u5E38\u6001 2-4 \u6761\uFF0C\u5F20\u529B\u671F 4-8 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u8DE8\u56DE\u5408\u9634\u8C0B\u2014\u2014\u6743\u81E3\u6392\u6324\u5BF9\u624B\u3001\u5C06\u519B\u6697\u8054\u5916\u90E8\u3001\u6536\u96C6\u53CD\u5BF9\u6D3E\u7F6A\u8BC1\u3001\u6B3E\u586B\u4E00\u8D1D\u3001\u4EA4\u5851\u540E\u5BAB\u3001\u6D41\u8A00\u9020\u52BF\u3001\u540E\u9752\u52FE\u7ED3\u7B49\u957F\u671F\u5E03\u5C40\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{schemer, target, plan(40\u5B57\u63CF\u8FF0), progress:"\u915D\u917F\u4E2D/\u5373\u5C06\u53D1\u52A8/\u957F\u671F\u5E03\u5C40", allies:"\u540C\u8C0B\u8005\uFF08\u4EBA\u540D\u9017\u53F7\u5206\u9694\uFF09"}\n\n';

        tp1c += '\u25C6 scheme_actions\uFF08\u5DF2\u6709\u9634\u8C0B\u63A8\u8FDB\u00B71-3 \u6761\uFF0C\u5BF9\u5E94\u4E0A\u4E00\u56DE\u5408\u9634\u8C0B\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{schemer, action:"advance\u63A8\u8FDB/disrupt\u7834\u574F/abort\u4E2D\u6B62/expose\u88AB\u63ED\u53D1", reason(30\u5B57)}\n\n';

        tp1c += '\u25C6 hidden_moves\uFF08NPC \u6697\u4E2D\u884C\u52A8\u00B7\u81F3\u5C11 8 \u6761\uFF0C\u5B57\u7B26\u4E32\u6570\u7EC4\uFF09\u2014\u2014\n';
        tp1c += '  \u6BCF\u6761\u683C\u5F0F\uFF1A"\u67D0\u89D2\u8272\uFF1A\u56E0\u4E3A\u4EC0\u4E48\u2192\u6697\u4E2D\u505A\u4E86\u4EC0\u4E48\u2192\u76EE\u7684\u662F\u4EC0\u4E48"\uFF0830-60\u5B57\uFF09\n';
        tp1c += '  \u5FC5\u5305\u542B\uFF1A\u2265 3 \u6761 NPC\u5BF9NPC\u6697\u884C\uFF1B\u2265 1 \u6761 \u52BF\u529B\u5185\u90E8\u6697\u6D41\uFF1B\u2265 1 \u6761 \u5C0F\u4EBA\u7269\u52A8\u4F5C\uFF08\u5C0F\u540F\u8D2A\u5893/\u5546\u4EBA\u56E4\u8D27/\u63A2\u5B50\u4F20\u4FE1/\u6D41\u6C11\u805A\u96C6\uFF09\n\n';

        tp1c += '\u25C6 fengwen_snippets\uFF08\u98CE\u95FB\u5F55\u4E8B\u00B7\u5E38\u6001 12-20 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u4EBA\u7269\u548C\u52BF\u529B\u7684\u6D3B\u52A8\u98CE\u95FB\u2014\u2014\u6E90\u81EA\u5751\u95F4\u8033\u76EE\u3001\u671D\u5802\u98CE\u8BEE\u3001\u5F80\u6765\u5BC6\u51FD\u7B49\uFF0C\u901A\u8FC7\u8D77\u5C45\u6CE8/\u8033\u62A5/\u5857\u62A5/\u574A\u95F4\u4F20\u95FB\u62A5\u5165\u3002\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{type, text(30-60\u5B57\u53E4\u5178\u4E2D\u6587\u98CE), credibility(0.3-0.95), actors:["\u4EBA\u540D\u6216\u52BF\u529B\u540D"], source:"\u574A\u95F4/\u671D\u5802/\u8033\u76EE/\u5857\u62A5/\u5BC6\u672D/\u8FB9\u5173", mood?:"\u5FE7/\u559C/\u6012/\u6050/\u4EB2/\u4EC7(\u4F20\u9012\u7ED9 actors \u8BB0\u5FC6\u7684\u4E3B\u5BFC\u60C5\u7EEA)"}\n';
        tp1c += '  type \u5206\u7C7B\uFF1A\u5F39\u52BE/\u8350\u4E3E/\u594F\u8BAE/\u7ED3\u515A/\u9020\u8C23/\u79C1\u8BBF/\u5BB4\u996E/\u6E38\u5BB4/\u8BD7\u793E/\u5B66\u8BBA/\u6C42\u5A5A/\u6BCD\u796D/\u4E39\u9053/\u85AC\u91CA/\u5DE1\u89C6/\u5DE1\u8005/\u8D51\u635C/\u53F8\u6CD5/\u6838\u67E5/\u6350\u4FF8/\u8D22\u884C/\u5BB6\u4E8B/\u7F6E\u4EA7/\u5C45\u7740/\u96C5\u793A/\u5BC6\u8054/\u6218\u62A5/\u8FB9\u62A5/\u548C\u4EB2/\u8D28\u5B50/\u671D\u8D21/\u4E92\u5E02/\u76DF\u7EA6/\u9063\u4F7F/\u63ED\u79C1\n';
        tp1c += '  \u4F8B\uFF1A{type:"\u8BD7\u793E", text:"\u897F\u6E56\u4E09\u96C5\u96C6\u4E8E\u5317\u5C71\uFF0C\u67D0\u7532\u8D4B\u300A\u79CB\u6C34\u300B\uFF0C\u67D0\u4E59\u6B21\u97F5\uFF0C\u67D0\u4E19\u7ACB\u5212\u70B9\u65AD\u53E5\u3002", credibility:0.75, actors:["\u67D0\u7532","\u67D0\u4E59"], source:"\u574A\u95F4", mood:"\u559C"}\n';
        tp1c += '  \u3010\u786C\u89C4\u5219\u00B7\u98CE\u95FB\u8986\u76D6\u8981\u6C42\u3011\n';
        tp1c += '    \u00B7 \u4E0A\u8FF0\u65B0\u83DC\u5355\u6240\u6709\u7C7B\u578B\u4E3B\u52A8\u884C\u4E3A\uFF08\u540D\u671B\u5EFA\u6784/\u5730\u65B9\u6CBB\u7406/\u4E2D\u592E\u5C65\u804C/\u79C1\u4EA7\u7ECF\u8425/\u516C\u5E93\u62C5\u5F53/\u653F\u6597\u535A\u5F08/\u4EBA\u6C11\u4E92\u52A8\u793E\u4EA4/\u79C1\u4EBA\u751F\u6D3B\uFF09\u5F53\u5C06\u751F\u6210 1+ \u6761\u98CE\u95FB\n';
        tp1c += '    \u00B7 \u52BF\u529B\u7684\u516C\u5F00\u4E92\u52A8\u4E5F\u4F1A\u81EA\u52A8\u8FDB\u98CE\u95FB\uFF08\u5DF2\u7CFB\u7EDF\u81EA\u52A8\u5904\u7406\uFF0C\u4F60\u4E0D\u9700\u91CD\u590D\uFF09\n';
        tp1c += '    \u00B7 \u65AD\u8BAE\u7ED3\u679C/\u94A5\u5B66\u4FEE\u9C81\u7B49\u79C1\u4EBA\u884C\u4E3A\u4F1A\u5728\u5750\u95F4\u52AD\u7EEC\u50E3\u6709\u81C0\u5854\u4E39\u9038\u4E0B\u906E\n';
        tp1c += '    \u26A0 \u3010\u9634\u8C0B npc_schemes \u4E0D\u5F97\u8FDB\u98CE\u95FB_snippets\uFF01\u3011\u2014\u2014\u9634\u8C0B\u9ED8\u8BA4\u9690\u85CF\uFF0C\u53EA\u6709\u5728 scheme_actions.expose \u65F6\u7531\u7CFB\u7EDF\u81EA\u52A8\u751F\u6210\u300C\u63ED\u79C1\u300D\u98CE\u95FB\u3002\n';
        tp1c += '    \u00B7 \u4F53\u73B0\u5F53\u4E8B\u4EBA\u5FC3\u7EEA\uFF1Afengwen \u7684 mood \u5B57\u6BB5\u4F1A\u4F20\u9012\u7ED9 actors \u7684\u8BB0\u5FC6\u2014\u2014\u5F39\u52BE/\u63ED\u79C1 \u2192 \u6012\uFF1B\u8350\u4E3E/\u9054\u706E \u2192 \u559C\uFF1B\u4E0A\u7F8E\u4E0B\u9700 \u2192 \u4EB2\uFF1B\u5956\u5F0F\u80B2\u5169 \u2192 \u559C\uFF1B\u8D22\u5343\u9020\u8C23 \u2192 \u4EC7\u3002\n\n';

        tp1c += '\u3010\u6D3B\u52A8\u5185\u5BB9\u65B9\u5411\uFF08AI \u63A8\u7406\u53C2\u8003\uFF09\u3011\n';
        tp1c += '  \u65E0\u9700\u6BCF\u79CD\u90FD\u7528\uFF0C\u6309 NPC/\u52BF\u529B\u6027\u683C\u3001\u5F53\u524D\u5C40\u52BF\u3001\u79C1\u5FC3\u81EA\u7531\u9009\u62E9\u2014\u2014\u8BE5\u5206\u7C7B\u4EC5\u4F9B\u6269\u5C55\u601D\u8DEF\uFF0C\u907F\u514D\u5355\u8C03\u91CD\u590D\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u653F\u6597\u671D\u5802\u535A\u5F08\u3011\n';
        tp1c += '    \u00B7 \u4E0A\u758F\u4E89\u8FA9\uFF08\u4E3A\u67D0\u653F\u7B56\u5386\u4E0B\u53CD\u590D\u529B\u4E89\uFF09\n';
        tp1c += '    \u00B7 \u5F39\u52BE\u53CD\u5F39\u8FDE\u73AF\uFF08\u5F39\u8005\u53CD\u88AB\u53CD\u8BD8\u7275\u8FDE\uFF09\n';
        tp1c += '    \u00B7 \u7ED3\u515A\u00B7\u8054\u540D\u5954\u8FF0\uFF08\u7ACB\u573A\u76F8\u8FD1\u8005\u5171\u540C\u4E0A\u8868\uFF09\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u6E38\u8BF4\u4E2D\u7ACB\u6D3E\uFF08\u5BB4\u8BF7\u00B7\u8BB8\u4EE5\u597D\u5904\u6216\u5A01\u80C1\uFF09\n';
        tp1c += '    \u00B7 \u501F\u5929\u8C61/\u707E\u5F02\u8FDB\u8A00\uFF08\u9644\u4F1A\u9634\u9633\u00B7\u6258\u8A00\u5929\u8B66\uFF09\n';
        tp1c += '    \u00B7 \u8BA9\u65C1\u4EBA\u4F5C\u66FF\u8EAB\u2014\u2014\u907F\u76F4\u63A5\u51B2\u7A81\uFF08\u501F\u5FA1\u53F2\u53F0/\u501F\u8BD7\u6587\u5F71\u5C04/\u501F\u5F1F\u5B50\u9677\u9635\uFF09\n';
        tp1c += '    \u00B7 \u6536\u96C6\u5BF9\u624B\u628A\u67C4/\u4F3A\u673A\u53D1\u96BE\uFF08\u8D26\u76EE\u00B7\u79C1\u4EA4\u00B7\u5BB6\u4EBA\u8FC7\u5931\uFF09\n';
        tp1c += '    \u00B7 \u5236\u9020\u8206\u8BBA\u00B7\u6563\u5E03\u6D41\u8A00\uFF08\u501F\u7AE5\u8C23\u00B7\u8C36\u8BED\u00B7\u79C1\u8BE9\uFF09\n';
        tp1c += '    \u00B7 \u6258\u5BA6\u5B98/\u5916\u621A/\u540E\u5983\u8FDB\u8A00\uFF08\u8D70\u5185\u7EBF\u00B7\u7ED5\u5F00\u524D\u671D\uFF09\n';
        tp1c += '    \u00B7 \u62D2\u4E0D\u8868\u6001\u00B7\u660E\u54F2\u4FDD\u8EAB\uFF08\u7ACB\u573A\u4E0D\u660E\u00B7\u6301\u9EBB\u4F7F\u524D\uFF09\n';
        tp1c += '    \u00B7 \u79BB\u673A\u8C0B\u4F4D\u00B7\u4E0A\u7591\u5DE5\u5F85\u52BF\uFF08\u5C0F\u4EBA\u4E4B\u9A9A\u6269\u5927/\u770B\u98CE\u4F7F\u8235\uFF09\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u6CBB\u7406\u516C\u52A1\u5904\u7F6E\u3011\n';
        tp1c += '    \u00B7 \u6279\u9605\u6587\u4E66/\u79EF\u538B\u6848\u724D\uFF08\u8BE5\u5B98\u7C7B\u578B\u6027\u663E\uFF09\n';
        tp1c += '    \u00B7 \u53EC\u96C6\u50DA\u5C5E\u8BAE\u4E8B/\u5802\u6742\u00B7\u4F1A\u516C\u5546\u4E8B\n';
        tp1c += '    \u00B7 \u5DE1\u89C6\u8F96\u533A\u00B7\u5DE1\u6D4E\u4EB2\u770B\uFF08\u6C34\u5229/\u5175\u9632/\u72F1\u8BBC/\u519C\u65F6\uFF09\n';
        tp1c += '    \u00B7 \u5FAE\u670D\u8BBF\u6C11\u60C5\u00B7\u767E\u59D3\u6B8A\u547C\n';
        tp1c += '    \u00B7 \u6574\u985D\u98CE\u7EAA\u00B7\u60E9\u8D2A\u9501\u5BB3\uFF08\u67E5\u5C5E\u90E8\u00B7\u6838\u7269\u5238\uFF09\n';
        tp1c += '    \u00B7 \u67E5\u9605\u6237\u7C4D\u00B7\u4E08\u91CF\u7530\u4EA9\u00B7\u6CBB\u7406\u9690\u6237\n';
        tp1c += '    \u00B7 \u4FEE\u8BA2\u5730\u65B9\u89C4\u7AE0\u00B7\u4FBF\u5B9C\u884C\u4E8B\n';
        tp1c += '    \u00B7 \u8350\u4E3E\u90E8\u5C5E\u00B7\u8003\u8BFE\u9EDC\u9677\uFF08\u4E0A\u9650\u5355/\u8003\u8BE6\u5355\uFF09\n';
        tp1c += '    \u00B7 \u5BA1\u7406\u7591\u96BE\u6848\u4EF6\u00B7\u5BB9\u6781\u51A4\u72F1\n';
        tp1c += '    \u00B7 \u629A\u6170\u6D41\u6C11/\u53D1\u4ED3\u8D48\u6D4E/\u8D44\u9063\u8FD4\u4E61\n';
        tp1c += '    \u00B7 \u7B79\u63AA\u519B\u9700/\u6574\u5907\u9632\u52A1/\u589E\u5385\u5C11\u961F\n';
        tp1c += '    \u00B7 \u62DB\u629A\u76D7\u8D3C/\u8BAE\u548C\u8FB9\u6C11\n';
        tp1c += '    \u00B7 \u7B79\u5EFA\u5DE5\u7A0B\uFF08\u6865\u6881/\u5824\u575D/\u9A7F\u9053/\u5B66\u5BAB/\u7985\u9662\uFF09\n';
        tp1c += '    \u00B7 \u5904\u7406\u4E0A\u7EA7\u578B\u6307\u4EE4\u00B7\u52A0\u76D6\u8F6C\u53D1\u4E0B\u53F8\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u5F7C\u6B64\u4E92\u52A8\u793E\u4EA4\u96C5\u4E8B\u3011\n';
        tp1c += '    \u00B7 \u540C\u50DA\u5BB4\u996E\u00B7\u8BD7\u9152\u5531\u548C\n';
        tp1c += '    \u00B7 \u5B66\u672F\u5207\u78CB\u00B7\u8BBA\u5B66\u8FA9\u96BE\u00B7\u8BB2\u4F1A\n';
        tp1c += '    \u00B7 \u8BBF\u53CB\u95EE\u5B66\u00B7\u8BF7\u6559\u524D\u8F88\u00B7\u8868\u62A5\u5E08\u95E8\n';
        tp1c += '    \u00B7 \u8054\u59FB\u6C42\u4EB2\u00B7\u4EA4\u6362\u5A5A\u8BFA\u00B7\u5408\u5C01\u5C54\u5973\n';
        tp1c += '    \u00B7 \u5E08\u5F92\u4F20\u9053\u00B7\u6536\u5F92\u7ACB\u6D3E\u00B7\u9616\u5B8B\u4F20\u7ECF\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u8C03\u505C\u53CC\u65B9\u7EA0\u7EB7\u00B7\u8BB0\u6069\u4E0E\u6068\n';
        tp1c += '    \u00B7 \u5546\u8BAE\u5171\u540C\u4E0A\u758F\u00B7\u8054\u540D\u5448\u8BF7\n';
        tp1c += '    \u00B7 \u8F6C\u6C42\u540C\u95E8/\u540C\u4E61\u63F4\u5F15\n';
        tp1c += '    \u00B7 \u5199\u4FE1\u6170\u95EE\u75C5\u8005\u00B7\u540A\u5510\u4E27\u8005\u00B7\u8D53\u793C\u7230\u5BD7\n';
        tp1c += '    \u00B7 \u540C\u89C2\u4E66\u753B\u00B7\u5171\u8D4F\u53E4\u73A9\u00B7\u6B23\u8D4F\u82B1\u6728\n';
        tp1c += '    \u00B7 \u7ED3\u793E\u96C5\u96C6\uFF08\u8BD7\u793E/\u6587\u793E/\u4E49\u793E/\u4E91\u7845\u4F1A\uFF09\n';
        tp1c += '    \u00B7 \u65C5\u884C\u540C\u6E38\u00B7\u8BBF\u53E4\u5BFB\u80DC\u00B7\u5BFC\u6E38\u516C\u4E8B\n';
        tp1c += '    \u00B7 \u8D60\u7B54\u6587\u5B57\u00B7\u6B21\u97F5\u552F\u92F3\u7B54\u7B54\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u4E3B\u52A8\u5EFA\u6784\u540D\u671B\u8D24\u80FD\u884C\u4E3A\uFF08\u5FC3\u6709\u91CE\u671B/\u91CD\u89C6\u540D\u8282\u7684 NPC \u5E94\u4E3B\u52A8\u4E3A\u4E4B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6551\u6D4E\u707E\u6C11\u00B7\u65BD\u7CA5\u6296\u8863\uFF08\u540D\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u6350\u8D44\u5174\u5B66\u00B7\u5EFA\u4E66\u9662\u00B7\u7F62\u5B66\u8D4F\u4E8B\uFF08\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u8BB2\u5B66\u00B7\u7ACB\u8A00\u00B7\u8457\u4E66\u7ACB\u5B66\u6D3E\uFF08\u6587\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u5956\u638E\u540E\u8FDB\u00B7\u8350\u62D4\u8D24\u624D\u00B7\u63D0\u643A\u4E0B\u58EB\uFF08\u8D24\u80FD++\uFF09\n';
        tp1c += '    \u00B7 \u4FEE\u5FD7\u7F16\u53F2\u00B7\u96C6\u8D24\u8BEF\u7279\u7AD9\uFF08\u6587\u5316\u8D21\u732E\u00B7\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u5174\u4FEE\u6C34\u5229\u00B7\u5EFA\u8DEF\u7B51\u6865\u00B7\u60E0\u6C11\u5DE5\u7A0B\uFF08\u540D\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u6E05\u5EC9\u81EA\u5B88\u00B7\u62D2\u8D3F\u4E0D\u62DC\u00B7\u5404\u6D01\u8EAB\u4EE5\u98DF\uFF08\u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u629A\u6070\u5B64\u5BA1\u00B7\u65BD\u60E0\u8001\u5F31\u00B7\u89E3\u56F0\u5982\u4EB2\uFF08\u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u5E73\u53CD\u51A4\u72F1\u00B7\u56F4\u590D\u540D\u6D41\u00B7\u6B63\u6C89\u53D7\u5C48\uFF08\u540D\u671B++ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u4E61\u796D\u00B7\u8C03\u505C\u5B97\u65CF\u7EA0\u7EB7\uFF08\u5730\u65B9\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u66FF\u4EBA\u62C5\u4FDD\u00B7\u8DF5\u8BFA\u5B88\u4FE1\u00B7\u4E49\u8D48\u6025\u96BE\uFF08\u4FE1\u4E49+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u4E3A\u56FD\u732E\u7B56\u00B7\u72AF\u9A6C\u76F4\u8C0F\u00B7\u62A5\u56FD\u5C4E\u8EAB\uFF08\u5FE0\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u6784\u7C50\u8BD7\u6587\u00B7\u9898\u8DCB\u540D\u54C1\u00B7\u9700\u987B\u96B6\u5B66\uFF08\u6587\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u7F6E\u4E49\u7530\u4E49\u58AE\u00B7\u4EA4\u4E8B\u5BD7\u65CF\u4EBA\uFF08\u65CF\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u2605 \u9700\u6839\u636E NPC \u6027\u683C\u4E0E\u91CE\u5FC3\u9009\u62E9\uFF1A\u6E05\u6D41\u58EB\u5927\u592B\u504F\u5411\u6587\u5316\u00B7\u8BB2\u5B66\u00B7\u7F6E\u4E49\u7530\uFF0C\n';
        tp1c += '      \u529F\u5229\u578B\u504F\u5411\u6350\u8D44\u5174\u6559\u00B7\u8350\u62D4\u00B7\u60E0\u6C11\u5DE5\u7A0B\uFF0C\u5FE0\u81EA\u578B\u504F\u5411\u76F4\u8C0F\u00B7\u5CD7\u8074\u00B7\u62A5\u56FD\uFF0C\u4EC1\u5FB7\u578B\u504F\u5411\u5E73\u51A4\u00B7\u5B88\u4FE1\u00B7\u629A\u6070\u3002\n';
        tp1c += '    \u2605 \u4EE5\u4E0A\u884C\u4E3A\u53EF\u901A\u8FC7 npc_interactions \u8F93\u51FA\uFF08type \u53EF\u4EE3\u5165 mediate/recommend/guarantee/petition_jointly\u7B49\uFF09\uFF0C\n';
        tp1c += '      \u6216\u901A\u8FC7 fengwen_snippets \u98CE\u95FB\u6761\u5230\u6620\u5728\u73A9\u5BB6\u76F8\u5173\u9762\u677F\u3002\n\n';

        tp1c += '  \u3010\u5730\u65B9\u5B98\u00B7\u8F96\u533A\u6CBB\u7406\u884C\u4E3A\uFF08\u5728\u5730\u65B9\u4EFB\u804C\u7684 NPC \u5E94\u4E3A\u672C\u8F96\u4E4B\u653F\uFF09\u3011\n';
        tp1c += '    \u00B7 \u52DD\u8BFE\u519C\u6851\u00B7\u7763\u7A3B\u5782\u6E9E\uFF08\u6625\u8015\u79CB\u6536\u65F6\u8282\uFF09\n';
        tp1c += '    \u00B7 \u5174\u4FEE\u6C34\u5229\u00B7\u7591\u5824\u758F\u6CB3\u00B7\u62A4\u5821\u7B51\u9655\n';
        tp1c += '    \u00B7 \u6E05\u4E08\u7530\u4EA9\u00B7\u6838\u9AA8\u6237\u53E3\u00B7\u8FFD\u8FFD\u9690\u6237\u00B7\u6536\u62DB\u6D41\u6C11\n';
        tp1c += '    \u00B7 \u5BA1\u7406\u523B\u72F1\u00B7\u5A87\u96F7\u51A4\u72F1\u00B7\u907F\u796D\u6B24\u9F50\u7AED\n';
        tp1c += '    \u00B7 \u6574\u987F\u9A7F\u4F20\u00B7\u5DE1\u4F50\u5173\u5361\u00B7\u6682\u6CC4\u76D7\u532A\u00B7\u7ACB\u7AAD\u5802\u6A50\n';
        tp1c += '    \u00B7 \u5174\u529E\u5B66\u5BAB\u00B7\u9009\u62D4\u8D21\u751F\u00B7\u8BAE\u4E0A\u4E61\u5B66\u00B7\u9080\u6743\u8BB2\u5B66\n';
        tp1c += '    \u00B7 \u5907\u8352\u4ED3\u5EEA\u00B7\u5E73\u7C74\u5E73\u7C75\u00B7\u8D48\u707E\u6296\u60E0\n';
        tp1c += '    \u00B7 \u6574\u6CBB\u80E5\u540F\u00B7\u60E9\u8BAE\u7EB9\u5C24\u00B7\u63AD\u9664\u5347\u6597\u6301\u6237\n';
        tp1c += '    \u00B7 \u7981\u6BC1\u6DEB\u7960\u00B7\u79FB\u98CE\u6613\u4FD7\u00B7\u65BD\u8005\u6E05\u81D5\u9664\u75B0\n';
        tp1c += '    \u00B7 \u7AC0\u8BA7\u7269\u4EF7\u00B7\u7763\u67E5\u5E02\u6728\u00B7\u62B1\u514B\u632A\u66FF\u00B7\u7F6E\u55BD\u53AA\u5BBF\n';
        tp1c += '    \u00B7 \u6309\u5BDF\u6B66\u4E61\u00B7\u56E0\u4E8B\u8BF7\u5D1C\u6C11\u529B\u00B7\u5BD2\u4E8B\u5385\u6EEA\n';
        tp1c += '    \u2605 \u6210\u4EE3\u5B9E\u65BD\u53EF\u63D2 localActions (region/type/amount/reason/proposer)\uFF0C\u4EA6\u53EF\u5165 fengwen_snippets\u3002\n\n';

        tp1c += '  \u3010\u4E2D\u592E\u5B98\u5458\u00B7\u90E8\u5236\u5C65\u804C\u00B7\u9673\u66FF\u884C\u4E3A\uFF08\u4EAC\u4E2D\u4EFB\u804C\u7684 NPC \u5E94\u4E3A\u5C5E\u7CFB\u4E4B\u4E8B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6279\u9605\u79EF\u538B\u6587\u4E66\u00B7\u4F1A\u5BA1\u5357\u5317\u9707\u58AC\u00B7\u5904\u7F6E\u5076\u6298\u5F52\u5B98\n';
        tp1c += '    \u00B7 \u5802\u53F8\u4F1A\u516C\u00B7\u96F2\u4F7F\u548C\u8BAE\u00B7\u53EC\u96C6\u8FDE\u4E95\u00B7\u4F1A\u4F1A\u503E\u5CE7\u8868\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u90E8\u52A1\u4F1A\u8BAE\u00B7\u4E0B\u8BB0\u90E8\u5C5E\u00B7\u8003\u5BDF\u8D4E\u9EDC\u9676\n';
        tp1c += '    \u00B7 \u5949\u65E8\u67E5\u6838\u67D0\u4E8B\u00B7\u8F9F\u9B42\u8C03\u9605\u6863\u6848\u00B7\u8C03\u5BFB\u7B25\u58AB\u53B2\u5171\n';
        tp1c += '    \u00B7 \u5E9C\u540E\u805D\u4E0B\u90E8\u5C5E\u00B7\u7763\u8B3C\u6EE1\u8F93\u597A\u6210\u90E8\u00B7\u8003\u57CE\u51E1\u6240\u636F\n';
        tp1c += '    \u00B7 \u6D1D\u5C06\u6C97\u76EE\u00B7\u4F7F\u5B98\u4F53\u7B25\u7B49\u900F\u00B7\u5B66\u80FD\u6025\u89C4\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u5927\u793C\u00B7\u8FD8\u9882\u793E\u7A37\u00B7\u53EC\u5F00\u796D\u6BBF\u00B7\u66FF\u7687\u4E0B\u6388\u8BC4\n';
        tp1c += '    \u00B7 \u63A5\u5F85\u5916\u4F7F\u00B7\u5C5E\u56FD\u671D\u8D21\u00B7\u4F1A\u8C08\u5916\u4F7F\u00B7\u8BB0\u6C88\u5916\u4E0B\n';
        tp1c += '    \u00B7 \u7B79\u5212\u672C\u90E8\u6539\u9769\u00B7\u8BAE\u5E76\u5E9C\u5C40\u00B7\u5351\u963B\u51FA\u5C5E\u5B5D\u5FC6\u8ACB\u7684\n';
        tp1c += '    \u00B7 \u540C\u4E8B\u4F1A\u8BAE\u3001\u8054\u540D\u4E0A\u7983\u00B7\u4F1A\u540C\u4E0D\u540C\u90E8\u95E8\u5E9C\u5177\u5171\u4EE4\n';
        tp1c += '    \u2605 \u90E8\u5185\u884C\u4E3A\u53EF\u7528 npc_interactions (type:mediate/petition_jointly/recommend) \u6216 fengwen_snippets(type:\u594F\u8BAE/\u594F\u8BEE/\u8BAE\u793A)\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u79C1\u4EA7\u7ECF\u8425\u884C\u4E3A\uFF08\u51E0\u4E4E\u6240\u6709 NPC \u90FD\u4F1A\u8003\u8651\u5BB6\u5E9F\uFF09\u3011\n';
        tp1c += '    \u00B7 \u8D2D\u7F6E\u7530\u4EA9\u00B7\u540A\u7F6E\u5B85\u9662\u00B7\u628A\u58F0\u540C\u4EA7\u00B7\u4FEE\u7F6E\u5E84\u56ED\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u7ECF\u5546\u00B7\u5F00\u8BBE\u5178\u5F53\u00B7\u653E\u8D37\u53D6\u606F\u00B7\u6295\u81D3\u7980\u5385\u4E1A\n';
        tp1c += '    \u00B7 \u6536\u53D7\u793C\u91D1\u00B7\u4E0B\u5C5E\u5B5D\u656C\u00B7\u5916\u585E\u6C14\u541F\u793C\u00B7\u4E92\u79FB\u8D35\u91CD\u8D60\u4E86\n';
        tp1c += '    \u00B7 \u5C06\u4E2A\u4EBA\u8D22\u4EA7\u8F6C\u79FB\u6216\u863E\u533F\u00B7\u79C1\u4E0B\u884C\u4E50\n';
        tp1c += '    \u00B7 \u5957\u7528\u516C\u5B34\u00B7\u6D6A\u8D39\u516C\u6B3E\u00B7\u4F53\u5F52\u6578\u8D22\u00B7\u8C15\u8106\u5173\u6BBF\n';
        tp1c += '    \u00B7 \u878D\u8D44\u65CF\u4EA7\u00B7\u5BB6\u5B5F\u6E4F\u6E34\u00B7\u517B\u95E8\u5BA2\u6216\u96C7\u7528\u4EBA\n';
        tp1c += '    \u00B7 \u538B\u4EAC\u4FE1\u00B7\u8D44\u52A9\u4ECE\u7BE5\u4EB2\u53CB\u00B7\u5B8C\u6210\u4E3B\u7537\u5973\u5A5A\u5B50\u5C00\n';
        tp1c += '    \u00B7 \u8D2A\u6E9A\u6311\u62DB\u00B7\u8D37\u9057\u79C1\u4EBA\u50A8\u91D1\u00B7\u7528\u4E8E\u7529\u961F\u9886\u8A00\u6280\u5DE7\u7B49\n';
        tp1c += '    \u2605 \u901A\u8FC7 char_updates.updates.resources.private.money (delta) \u4F53\u73B0\u79C1\u4EA7\u53D8\u5316\uFF1B\n';
        tp1c += '      \u6216 fengwen_snippets (type:\u8D22\u884C/\u5BB6\u4E8B/\u7F6E\u4EA7) \u98CE\u95FB\u4F20\u3002\n';
        tp1c += '    \u26A0 \u4FB5\u5E05\u7C7B\u884C\u4E3A (\u5957\u7528\u516C\u5B34/\u53D7\u8D3F) \u4F1A\u4F7F\u540D\u671B\u7F29\u51CF\uFF1B\u8907\u9ED1\u7684\u4F1A\u88AB\u8BAE\u79C1\u4E0B\u4F20\u6B66\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u516C\u5E93\u5173\u5207\u62C5\u5F53\u884C\u4E3A\uFF08\u4EC5\u6709\u80FD\u529B/\u5FD7\u5411/\u4E94\u5E38\u4EC1\u4E49+ \u7684 NPC \u624D\u4F1A\u4E3A\u4E4B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6350\u4FF8\u8865\u516C\u5E93\u4E8F\u7A7A\u00B7\u8DDF\u4E0D\u53D7\u63D0\u996E\u00B7\u4EE5\u79C1\u8D27\u57AB\u529E\u516C\u4E8B\n';
        tp1c += '    \u00B7 \u51FB\u76D8\u4FDD\u5F92\u00B7\u4E3B\u52A8\u6838\u67E5\u8D26\u76EE\u00B7\u67E5\u63ED\u8D2A\u5F0A\u00B7\u9A71\u9010\u8D2A\u5414\n';
        tp1c += '    \u00B7 \u7BC0\u6D41\u7701\u8D39\u00B7\u5F01\u5E9F\u79C1\u8D39\u00B7\u8DDF\u683C\u5F15\u7BC0\u516C\u9A7F\u6F14\n';
        tp1c += '    \u00B7 \u4E0A\u7687\u8BF7\u589E\u62E8\u6B3E\u00B7\u79E6\u8BF7\u6BEA\u52A8\u516C\u5E93\u00B7\u8BF7\u8C03\u9971\u6D88\u5206\u5F01\n';
        tp1c += '    \u00B7 \u5F39\u52BE\u632A\u6324\u516C\u5E93\u8005\u00B7\u6770\u7D22\u56DE\u8086\u53D1\u6263\u6B3E\n';
        tp1c += '    \u00B7 \u4E88\u4EE5\u4EFB\u4E00\u884C\u4E3A\u4E2D\u8D44\u8D28\u4E8E\u5751\u516C\u4EBA\u4EFB\u7684\u7269\u4EF7\u76D2\u5FAA\u5229\u751F\u4F1A\u8FE3\u4E4B\n';
        tp1c += '    \u2605 \u8D24\u80FD+\u5EC9 \u2265 65 \u4E14 \u4ED6 \u8D1F\u8D23\u4E86\u67D0\u516C\u5E93 \u2192 \u9AD8\u6982\u7387\u8003\u8651\u4E3A\u4E4B\uFF1B\n';
        tp1c += '      \u79C1\u5FC3\u91CD/\u5EC9<40 \u2192 \u5C11\u6709\u5173\u5207\uFF0C\u4E00\u5207\u79C1\u4E3A\u5148\u3002\n';
        tp1c += '    \u2605 \u884C\u4E3A\u6279\u5230 npc_interactions (type:expose_secret/impeach/guarantee) \u6216 char_updates\u8C03\u516C\u5E93\uFF1B\n';
        tp1c += '      fengwen_snippets (type:\u53F8\u6CD5/\u6838\u67E5/\u6350\u4FF8) \u4F20\u98CE\u95FB\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u79C1\u4EBA\u751F\u6D3B\u65E5\u5E38\u3011\n';
        tp1c += '    \u00B7 \u5BB6\u4E8B\u5904\u7406\uFF08\u796D\u7956/\u5A5A\u5A36/\u4E27\u846C/\u8BAD\u5B50/\u5206\u5BB6\uFF09\n';
        tp1c += '    \u00B7 \u5B97\u6559\u4FE1\u4EF0\uFF08\u8FDB\u5E99/\u793C\u4F5B/\u6C42\u9053/\u9F4B\u6212/\u7167\u706B\u7586\u75AB\uFF09\n';
        tp1c += '    \u00B7 \u517B\u751F\u4FDD\u5065\uFF08\u670D\u836F/\u9759\u5750/\u5BFC\u5F15/\u4E94\u79BD\u620F\uFF09\n';
        tp1c += '    \u00B7 \u6587\u623F\u96C5\u4E8B\uFF08\u6536\u85CF\u91D1\u77F3/\u9898\u8DCB\u4E27\u672C/\u4E34\u5E16/\u523B\u5370\uFF09\n';
        tp1c += '    \u00B7 \u56ED\u6797\u6E38\u61A9\uFF08\u8D4F\u82B1/\u542C\u7434/\u9493\u9C7C/\u5F02\u745E\u552F\u548C\uFF09\n';
        tp1c += '    \u00B7 \u7814\u7A76\u8457\u8FF0\uFF08\u6821\u52D8\u7ECF\u7C4D/\u64B0\u53F2/\u6CE8\u758F/\u4FEE\u65B9\u5FD7\uFF09\n';
        tp1c += '    \u00B7 \u5904\u7406\u75BE\u75C5\u00B7\u4E27\u670D\u5B88\u5236\n';
        tp1c += '    \u00B7 \u4E91\u6E38\u53E4\u8FF9\u00B7\u65E0\u65E0\u5C81\u6708\u00B7\u6E29\u8F66\u6253\u5149\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u5185\u653F\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u6574\u987F\u5F8B\u6CD5\u00B7\u9881\u5E03\u65B0\u4EE4\n';
        tp1c += '    \u00B7 \u6E05\u67E5\u6237\u53E3\u00B7\u4E08\u91CF\u7530\u4EA9\n';
        tp1c += '    \u00B7 \u6539\u5143\u00B7\u66F4\u5B9A\u5E74\u53F7\u00B7\u6539\u5236\u5189\u5B98\n';
        tp1c += '    \u00B7 \u5BAB\u5EF7\u4EBA\u4E8B\u6574\u987F\u00B7\u7F62\u9769\u5B66\u5E9C/\u56FD\u5B50\u76D1\n';
        tp1c += '    \u00B7 \u7F62\u9769\u5BA6\u5B98\u00B7\u6574\u9970\u5185\u5BAB\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u519B\u4E8B\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u7B79\u5EFA\u65B0\u519B\u00B7\u6574\u7F16\u65E7\u90E8\n';
        tp1c += '    \u00B7 \u4FEE\u7B51\u57CE\u9632\u00B7\u589E\u8BBE\u8FB9\u585E/\u5821\u91D1\n';
        tp1c += '    \u00B7 \u8C03\u52A8\u9A7B\u519B\u00B7\u66F4\u6362\u5C06\u9886\n';
        tp1c += '    \u00B7 \u50A8\u5907\u7CAE\u8349\u00B7\u8C03\u8FD0\u519B\u9700\n';
        tp1c += '    \u00B7 \u5F81\u52DF\u5175\u6E90\u00B7\u7EC3\u5175\u8BB2\u6B66\n';
        tp1c += '    \u00B7 \u519B\u5C6F\u519B\u7530\u6539\u5236\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u7ECF\u6D4E\u6C11\u751F\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u5F00\u5E02\u901A\u5546\u00B7\u6574\u8083\u5E02\u6988\n';
        tp1c += '    \u00B7 \u53EC\u52DF\u6D41\u6C11\u5C6F\u57A6\n';
        tp1c += '    \u00B7 \u63A8\u884C\u5E73\u7C74/\u5E73\u7C75\n';
        tp1c += '    \u00B7 \u6539\u94F8\u94B1\u5E01\u00B7\u6574\u7406\u76D0\u94C1\n';
        tp1c += '    \u00B7 \u5174\u529E\u77FF\u51B6\u00B7\u7B79\u5EFA\u6F15\u8FD0\n';
        tp1c += '    \u00B7 \u8BBE\u7ACB\u4ED3\u50A8\u00B7\u8D48\u707E\u6D4E\u6C11\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u6587\u5316\u5B97\u6559\u5916\u4EA4\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u4E3E\u529E\u79D1\u4E3E/\u796D\u5929/\u5C01\u7985\n';
        tp1c += '    \u00B7 \u5174\u5EFA\u5BFA\u89C2\u00B7\u656C\u4E8B\u795E\u7948\n';
        tp1c += '    \u00B7 \u6574\u7406\u5178\u7C4D\u00B7\u7F16\u7EAE\u56FD\u53F2\n';
        tp1c += '    \u00B7 \u63A8\u5E7F\u672C\u65CF\u6587\u5316/\u6587\u5B57\n';
        tp1c += '    \u00B7 \u6291\u5236\u5F02\u7AEF\u00B7\u7981\u6BC1\u90AA\u8BF4\n';
        tp1c += '    \u00B7 \u6D3E\u9063\u4F7F\u8005/\u63A5\u7EB3\u6D41\u4EA1\n';
        tp1c += '    \u00B7 \u53EC\u96C6\u90E8\u843D\u5927\u4F1A/\u8BF8\u4FAF\u76DF\u4F1A\n\n';

        tp1c += '\u3010\u786C\u89C4\u5219\u3011\n';
        tp1c += '  \u00B7 \u4EC5\u8FD4\u56DE\u4E0A\u8FF0 8 \u4E2A\u5B57\u6BB5\u7684 JSON\uFF0C\u4E0D\u8981\u4EFB\u4F55\u5176\u4ED6\u5B57\u6BB5\n';
        tp1c += '  \u00B7 \u4EBA\u540D/\u52BF\u529B\u540D\u5FC5\u987B\u4F7F\u7528\u4E0A\u65B9\u5217\u51FA\u7684\u540D\u79F0\n';
        tp1c += '  \u00B7 \u9632\u6B62"\u5FA1\u53F2\u5FC5\u8C0F\u00B7\u5C06\u519B\u5FC5\u6218\u00B7\u6E05\u6D41\u5FC5\u52BE\u5BA6\u5B98"\u5DE5\u5177\u4EBA\u6A21\u677F\u2014\u2014\u6309 NPC \u6027\u683C/\u6D3E\u7CFB/\u4E0E\u76EE\u6807\u5173\u7CFB/\u5FE0\u5FD7\u5EC9\u9009\u884C\u4E3A\n';
        tp1c += '  \u00B7 \u591A\u6570\u4EBA\u89C2\u671B/\u660E\u54F2\u4FDD\u8EAB\uFF0C\u5C11\u6570\u4EBA\u4ECB\u5165\n';
        tp1c += '  \u00B7 \u73A9\u5BB6 ' + _pNameC + ' \u4E0D\u5F97\u4F5C\u4EFB\u4F55\u5B57\u6BB5\u4E2D\u7684 actor/schemer\n';
        tp1c += '  \u00B7 \u5386\u53F2\u8D26\u672C\u4E00\u81F4\u6027\u2014\u2014\u767E\u5E74\u524D\u7684\u4EE4\u6068/\u6069\u60E0\u4ECA\u4ECD\u6709\u4F59\u6CE2\uFF1B\u4E0D\u53EF\u8F7B\u6613\u201C\u548C\u597D\u201D\u4E4B\u524D\u7684\u5C60\u57CE/\u80CC\u76DF\u4EC7\u6577\n';

        tp1c += '\n\u8FD4\u56DE\u683C\u5F0F\u793A\u4F8B\uFF1A\n';
        tp1c += '{\n  "faction_interactions_advanced":[{...}],\n  "faction_events":[{...}],\n  "faction_relation_changes":[{...}],\n  "faction_succession":[{...}],\n  "npc_schemes":[{...}],\n  "scheme_actions":[{...}],\n  "hidden_moves":["..."],\n  "fengwen_snippets":[{...}]\n}';

        // 动态 max_tokens：取模型输出上限与业务 8K 的较小值
        var _sc1cBaseTok = Math.min(_effectiveOutCap || 8192, 8192);
        // G3·SC1c 势力博弈·温度略降·求稳不求怪
        var _sc1cTemp = Math.max(0.3, _modelTemp - 0.15);
        // M4·Anthropic 原生 API 且 sys 长·加 cache_control
        var _sc1cMsgs = [{role:'system',content:sysP},{role:'user',content:tp1c}];
        try {
          var _isNativeAnth1c = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
          if (_modelFamily === 'anthropic' && _isNativeAnth1c && sysP.length > 1500) {
            _sc1cMsgs = [{role:'system', content:[{type:'text', text:sysP, cache_control:{type:'ephemeral'}}]}, {role:'user',content:tp1c}];
          }
        } catch(_){}
        // ★ Token 预算监控·SC1c
        try {
          if (typeof checkPromptTokenBudget === 'function') {
            var _sc1cFullPrompt = (sysP || '') + '\n' + (tp1c || '');
            var _sc1cTokRes = checkPromptTokenBudget(_sc1cFullPrompt, function(status, tokens, bg) {
              if (typeof toast === 'function') toast('[SC1c] prompt ' + status + '·' + tokens + ' tokens');
            });
            if (typeof window !== 'undefined') {
              window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
              window.TM.lastPromptTokens.sc1c = { tokens: _sc1cTokRes.tokens, status: _sc1cTokRes.status, ts: Date.now() };
            }
          }
        } catch(_tokE) {}
        var _sc1cBody = {model:P.ai.model||'gpt-4o', messages:_sc1cMsgs, temperature:_sc1cTemp, max_tokens:_tok(_sc1cBaseTok)};
        if (_modelFamily === 'openai') _sc1cBody.response_format = { type:'json_object' };

        var resp1c = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body:JSON.stringify(_sc1cBody)});
        if (resp1c.ok) {
          var data1c = await resp1c.json();
          _checkTruncated(data1c, '\u52BF\u529B\u9634\u8C0B');
          if (data1c.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data1c.usage);
          var c1c = (data1c.choices && data1c.choices[0] && data1c.choices[0].message) ? data1c.choices[0].message.content : '';
          var p1c = extractJSON(c1c);
          GM._turnAiResults.subcall1c_raw = c1c;
          GM._turnAiResults.subcall1c = p1c;
          try { if (window.TM && TM.validateAIOutput) TM.validateAIOutput(p1c, 'subcall1c'); } catch(_vce){}

          if (p1c && p1) {
            // ── sc1 自动派发的 5 字段：concat 合并即可 ──
            if (Array.isArray(p1c.faction_interactions_advanced)) p1.faction_interactions_advanced = (Array.isArray(p1.faction_interactions_advanced) ? p1.faction_interactions_advanced : []).concat(p1c.faction_interactions_advanced);
            if (Array.isArray(p1c.faction_events)) p1.faction_events = (Array.isArray(p1.faction_events) ? p1.faction_events : []).concat(p1c.faction_events);
            if (Array.isArray(p1c.faction_relation_changes)) p1.faction_relation_changes = (Array.isArray(p1.faction_relation_changes) ? p1.faction_relation_changes : []).concat(p1c.faction_relation_changes);
            if (Array.isArray(p1c.faction_succession)) p1.faction_succession = (Array.isArray(p1.faction_succession) ? p1.faction_succession : []).concat(p1c.faction_succession);
            if (Array.isArray(p1c.scheme_actions)) p1.scheme_actions = (Array.isArray(p1.scheme_actions) ? p1.scheme_actions : []).concat(p1c.scheme_actions);

            // ── npc_schemes / hidden_moves：sc1 不派发，内联处理 ──
            if (Array.isArray(p1c.npc_schemes)) {
              if (!GM.activeSchemes) GM.activeSchemes = [];
              p1c.npc_schemes.forEach(function(s){
                if (!s || !s.schemer || !s.target || !s.plan) return;
                GM.activeSchemes.push({
                  id: 'scheme_T' + GM.turn + '_' + Math.random().toString(36).slice(2,6),
                  schemer: s.schemer, target: s.target,
                  plan: s.plan, progress: s.progress || '\u915D\u917F\u4E2D',
                  allies: s.allies || '',
                  startTurn: GM.turn
                });
                addEB('\u9634\u8C0B', s.schemer + ' \u9488\u5BF9 ' + s.target + '\uFF1A' + String(s.plan).slice(0,40) + ' [' + (s.progress||'\u915D\u917F\u4E2D') + ']');
              });
            }
            if (Array.isArray(p1c.hidden_moves)) {
              p1c.hidden_moves.forEach(function(hm){
                if (typeof hm === 'string' && hm) addEB('\u6697\u6D41', hm);
              });
            }

            // ── fengwen_snippets：直接入风闻录事 + actors 记忆心绪联动 ──
            if (Array.isArray(p1c.fengwen_snippets) && typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
              // type → 默认 mood 映射（若 AI 未显式给 mood）
              var _fwMoodMap = {
                '\u5F39\u52BE':'\u6012','\u6784\u9677':'\u6012','\u9020\u8C23':'\u6012','\u8BBD\u523A':'\u6012','\u63ED\u79C1':'\u6012',
                '\u8350\u4E3E':'\u559C','\u6350\u4FF8':'\u559C','\u5BB4\u996E':'\u559C','\u6E38\u5BB4':'\u559C','\u8BD7\u793E':'\u559C','\u5956\u5F0F':'\u559C','\u96C5\u793A':'\u559C','\u6C42\u5A5A':'\u559C','\u4E92\u5E02':'\u559C','\u76DF\u7EA6':'\u559C',
                '\u7ED3\u515A':'\u5E73','\u79C1\u8BBF':'\u5E73','\u5B66\u8BBA':'\u5E73','\u8D22\u884C':'\u5E73','\u7F6E\u4EA7':'\u5E73','\u5C45\u7740':'\u5E73','\u8FB9\u62A5':'\u5E73','\u671D\u8D21':'\u5E73','\u9063\u4F7F':'\u5E73',
                '\u6BCD\u796D':'\u5FE7','\u4E27\u796D':'\u5FE7','\u6218\u62A5':'\u5FE7','\u4E39\u9053':'\u5FE7','\u85AC\u91CA':'\u5FE7','\u5BB6\u4E8B':'\u5FE7',
                '\u5BC6\u8054':'\u5FE7','\u5DE1\u89C6':'\u5E73','\u5DE1\u8005':'\u5E73','\u8D51\u635C':'\u6050','\u53F8\u6CD5':'\u5FE7','\u6838\u67E5':'\u5FE7','\u548C\u4EB2':'\u559C','\u8D28\u5B50':'\u5FE7'
              };
              p1c.fengwen_snippets.forEach(function(fw){
                if (!fw || !fw.text) return;
                var _fwActors = Array.isArray(fw.actors) ? fw.actors : [];
                PhaseD.addFengwen({
                  type: fw.type || '\u98CE\u8BAE',
                  text: String(fw.text).slice(0, 120),
                  credibility: (typeof fw.credibility === 'number') ? Math.max(0.3, Math.min(0.95, fw.credibility)) : 0.7,
                  source: fw.source || 'ai_sc1c',
                  actors: _fwActors,
                  turn: GM.turn
                });
                // 当事 actors → NpcMemorySystem 记忆（含心绪传递）
                if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                  var _mood = fw.mood || _fwMoodMap[fw.type] || '\u5E73';
                  var _importance = (typeof fw.credibility === 'number' && fw.credibility > 0.8) ? 5 : 3;
                  _fwActors.forEach(function(actorName){
                    if (!actorName) return;
                    // 只为 NPC 人物写记忆（不给势力）——快速判断：有同名角色
                    if (typeof findCharByName === 'function') {
                      var _ch = findCharByName(actorName);
                      if (!_ch) return;
                      NpcMemorySystem.remember(actorName, '[' + (fw.type||'\u98CE\u95FB') + '] ' + String(fw.text).slice(0, 60), _mood, _importance);
                    }
                  });
                }
              });
            }

            _dbg('[sc1c] \u5408\u5E76: \u52BF\u4E92\u52A8+' + (p1c.faction_interactions_advanced||[]).length + ' \u52BF\u4E8B\u4EF6+' + (p1c.faction_events||[]).length + ' \u5173\u7CFB+' + (p1c.faction_relation_changes||[]).length + ' \u7EE7\u627F+' + (p1c.faction_succession||[]).length + ' \u63A8\u8FDB+' + (p1c.scheme_actions||[]).length + ' \u65B0\u9634\u8C0B+' + (p1c.npc_schemes||[]).length + ' \u6697\u6D41+' + (p1c.hidden_moves||[]).length + ' \u98CE\u95FB+' + (p1c.fengwen_snippets||[]).length);
          }
          GM._subcallTimings.sc1c = Date.now() - _sc1cStart;
        } else {
          console.warn('[sc1c] HTTP', resp1c.status);
        }
      } catch(_sc1cErr) {
        console.warn('[sc1c] \u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u4E3B\u6D41\u7A0B\uFF09:', _sc1cErr.message || _sc1cErr);
      }
      })();  // end SC1c IIFE

      // 并行等待 SC1b + SC1c 完成（S3 优化·两者无交集字段）
      try { await Promise.all([_sc1bP, _sc1cP]); } catch(_sc1bcErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_sc1bcErr, 'sc1b+1c parallel') : console.warn('[sc1b+1c parallel]', _sc1bcErr); }

      // G2·失败降级链：若 SC1 主推演 JSON 失败或空·从 SC1b/SC1c 合成最小可用 p1·避免整回合卡死
      if (!p1 || (!p1.shizhengji && !p1.zhengwen)) {
        var _p1bG2 = GM._turnAiResults && GM._turnAiResults.subcall1b;
        var _p1cG2 = GM._turnAiResults && GM._turnAiResults.subcall1c;
        if (_p1bG2 || _p1cG2) {
          console.warn('[G2·降级] SC1 无有效数据·从 SC1b/SC1c 合成 fallback shizhengji');
          var _fbParts = [];
          if (_p1cG2 && Array.isArray(_p1cG2.faction_events) && _p1cG2.faction_events.length) {
            _p1cG2.faction_events.slice(0,3).forEach(function(fe){
              _fbParts.push((fe.actor||'') + (fe.target?('·'+fe.target):'') + '·' + (fe.action||'') + (fe.result?('。'+fe.result):'。'));
            });
          }
          if (_p1bG2 && Array.isArray(_p1bG2.npc_interactions) && _p1bG2.npc_interactions.length) {
            _p1bG2.npc_interactions.slice(0,3).forEach(function(ni){
              _fbParts.push((ni.actor||'') + (ni.target?('·'+ni.target):'') + '·' + (ni.description||''));
            });
          }
          var _fallbackShizhengji = _fbParts.length ? ('（AI主推演缺数·从文事势力片段合成）' + _fbParts.join('；')) : ('（AI推演暂无·天下暂无大事）');
          p1 = p1 || {};
          p1.shizhengji = p1.shizhengji || _fallbackShizhengji;
          p1.zhengwen = p1.zhengwen || _fallbackShizhengji;
          p1._g2Fallback = true;
          if (typeof toast === 'function') toast('⚠ AI主推演未返回有效数据·已从子调用合成最小史记·建议检查模型输出能力');
        }
      }

      // ═══════════════════════════════════════════════════════════
      // §4 sc1 写回（applyAITurnChanges + 各字段族 GM 落地·~4000 行）
      // ═══════════════════════════════════════════════════════════
      if(p1){
        // 方案融入：AI 产出的通用变化/任免/机构/区划/事件/NPC行动/关系 → 统一应用
        try {
          if (typeof applyAITurnChanges === 'function') {
            applyAITurnChanges({
              narrative: p1.shizhengji || '',
              changes: Array.isArray(p1.changes) ? p1.changes : [],
              appointments: Array.isArray(p1.appointments) ? p1.appointments : [],
              institutions: Array.isArray(p1.institutions) ? p1.institutions : [],
              regions: Array.isArray(p1.regions) ? p1.regions : [],
              events: Array.isArray(p1.events) ? p1.events : [],
              npc_actions: Array.isArray(p1.npc_actions) ? p1.npc_actions : [],
              relations: Array.isArray(p1.relations) ? p1.relations : [],
              // 关键补传：AI 返回的财政/人事/势力/党派调整要透传给 applier
              fiscal_adjustments: Array.isArray(p1.fiscal_adjustments) ? p1.fiscal_adjustments : [],
              char_updates: Array.isArray(p1.char_updates) ? p1.char_updates : [],
              office_assignments: Array.isArray(p1.office_assignments) ? p1.office_assignments : [],
              faction_updates: Array.isArray(p1.faction_updates) ? p1.faction_updates : [],
              party_updates: Array.isArray(p1.party_updates) ? p1.party_updates : [],
              // 兜底：AI 常只写 personnel_changes (展示用) 而不写 office_assignments — applier 里做备胎消费
              personnel_changes: Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [],
              // 问天 directive 合规回报
              directive_compliance: Array.isArray(p1.directive_compliance) ? p1.directive_compliance : []
            });
          }
        } catch(_applyErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_applyErr, 'endturn] applyAITurnChanges:') : console.warn('[endturn] applyAITurnChanges:', _applyErr); }

        // ═══════════════════════════════════════════════════════════════════
        // Wave 1c+2 · 二次 AI 自审 reconciliation·tool_use 强约束
        // 6 个 validator 累计警告 >= 3 时·_maybeReconcileWithAI 设 GM._needsReconcile·此处取走并调 AI 二审
        // Wave 2 改造：用 callAIWithTools·让 AI 必须以结构化 tool_call 输出·彻底消灭 narrative/JSON 不一致
        // 兼容所有 API（Anthropic 原生/Gemini 原生/OpenAI 兼容/失败 fallback 到 schema-注入 prompt）
        // ═══════════════════════════════════════════════════════════════════
        if (GM && GM._needsReconcile) {
          var _rec = GM._needsReconcile;
          GM._needsReconcile = null;  // 立即取走·避免下回合重复
          try {
            var _totalW = Object.values(_rec.warnings).reduce(function(a,b){return a+b;},0);
            var _reconcilePrompt = '【一致性自审任务】\n你刚才输出的 narrative 与结构化 JSON 之间·校验器检测到 ' + _totalW + ' 处不一致·按领域分布:\n' +
              JSON.stringify(_rec.warnings) + '\n\n' +
              '【你的 narrative 节选(2KB)】\n' + _rec.narrativeSnapshot + '\n\n' +
              '【你已写的结构化数据(摘要)】\n' +
              'personnel_changes: ' + JSON.stringify((_rec.structuredSnapshot.personnel_changes||[]).slice(0,5)) + '\n' +
              'office_assignments: ' + JSON.stringify((_rec.structuredSnapshot.office_assignments||[]).slice(0,5)) + '\n' +
              'fiscal_adjustments: ' + JSON.stringify((_rec.structuredSnapshot.fiscal_adjustments||[]).slice(0,5)) + '\n' +
              'military_changes: ' + JSON.stringify((_rec.structuredSnapshot.military_changes||[]).slice(0,5)) + '\n\n' +
              '请检查 narrative 中提到但未在结构化数据里体现的状态变化·只补遗漏的·不要重复已写过的。\n' +
              '使用提供的 5 个工具之一记录补录·若完全无需补录请调用 record_no_changes。\n' +
              '注意：每个工具可调用多次·按领域分别调用（人事/任命/财政/军事各自独立）。';

            // 取 reconcile 工具集
            var _reconcileTools = (window.TM_AI_SCHEMA && TM_AI_SCHEMA.reconcileTools) || [];
            var _toolResp = null;
            if (typeof callAIWithTools === 'function' && _reconcileTools.length > 0) {
              _toolResp = await callAIWithTools(_reconcilePrompt, _reconcileTools, { maxTok: 1500, tier: 'secondary' });
            } else {
              // 极端兜底（不该发生·callAIWithTools 应已加载）
              var _raw = await callAI(_reconcilePrompt, 1500, undefined, 'secondary');
              _toolResp = { text: _raw||'', toolCalls: [] };
            }

            // 把 toolCalls 聚合为 patch 字段
            var _patch = { personnel_changes: [], office_assignments: [], fiscal_adjustments: [], military_changes: [], sentiment_changes: [], population_changes: [], war_events: [], revolt_events: [], disaster_events: [], diplomacy_events: [], keju_events: [], party_events: [], edict_events: [], court_ceremony_events: [], construction_events: [], omen_events: [], marriage_birth_events: [], conspiracy_events: [], currency_events: [], religion_events: [] };
            (_toolResp.toolCalls || []).forEach(function(tc) {
              if (!tc || !tc.name || !tc.input) return;
              if (tc.name === 'record_personnel_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(c) {
                  if (c && c.name) _patch.personnel_changes.push({ name: c.name, change: c.change||'罢免', reason: c.reason||'' });
                });
              } else if (tc.name === 'record_office_assignments' && Array.isArray(tc.input.assignments)) {
                tc.input.assignments.forEach(function(a) {
                  if (a && a.name) _patch.office_assignments.push({ name: a.name, action: a.action||'dismiss', post: a.post||'', reason: a.reason||'' });
                });
              } else if (tc.name === 'record_fiscal_adjustments' && Array.isArray(tc.input.adjustments)) {
                tc.input.adjustments.forEach(function(f) {
                  if (f && f.target && f.amount) _patch.fiscal_adjustments.push({ target: f.target, kind: f.kind||'expense', resource: f.resource||'money', amount: Number(f.amount)||0, name: f.name||'', reason: f.reason||'' });
                });
              } else if (tc.name === 'record_military_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(m) {
                  if (m && m.armyName) _patch.military_changes.push({ armyName: m.armyName, delta: Number(m.delta)||0, reason: m.reason||'' });
                });
              } else if (tc.name === 'record_sentiment_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(s) {
                  if (s && s.target && typeof s.delta === 'number') _patch.sentiment_changes.push({ target: s.target, delta: Number(s.delta)||0, reason: s.reason||'' });
                });
              } else if (tc.name === 'record_population_changes' && Array.isArray(tc.input.changes)) {
                tc.input.changes.forEach(function(p) {
                  if (p && p.region && p.amount) _patch.population_changes.push({ region: p.region, kind: p.kind||'death', amount: Number(p.amount)||0, reason: p.reason||'' });
                });
              } else if (tc.name === 'record_war_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(w) {
                  if (w && w.action) _patch.war_events.push({ action: w.action, enemy: w.enemy||'', region: w.region||'', outcome: w.outcome||'', casualties: Number(w.casualties)||0, reason: w.reason||'' });
                });
              } else if (tc.name === 'record_revolt_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(r) {
                  if (r && r.action && r.region) _patch.revolt_events.push({ action: r.action, region: r.region, leader: r.leader||'', scale: Number(r.scale)||0, reason: r.reason||'' });
                });
              } else if (tc.name === 'record_disaster_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(d) {
                  if (d && d.category && d.region) _patch.disaster_events.push({ category: d.category, region: d.region, severity: d.severity||'moderate', casualties: Number(d.casualties)||0, reason: d.reason||'' });
                });
              } else if (tc.name === 'record_diplomacy_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.faction) _patch.diplomacy_events.push({ action: e.action, faction: e.faction, attitude: e.attitude||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_keju_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.stage) _patch.keju_events.push({ stage: e.stage, year: e.year||'', topThree: Array.isArray(e.topThree)?e.topThree:[], reason: e.reason||'' }); });
              } else if (tc.name === 'record_party_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.partyName) _patch.party_events.push({ action: e.action, partyName: e.partyName, leader: e.leader||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_edict_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.edictName) _patch.edict_events.push({ action: e.action, edictName: e.edictName, category: e.category||'other', reason: e.reason||'' }); });
              } else if (tc.name === 'record_court_ceremony_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.target) _patch.court_ceremony_events.push({ action: e.action, target: e.target, newTitle: e.newTitle||'', newCapital: e.newCapital||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_construction_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.kind && e.name) _patch.construction_events.push({ action: e.action, kind: e.kind, name: e.name, region: e.region||'', cost: Number(e.cost)||0, reason: e.reason||'' }); });
              } else if (tc.name === 'record_omen_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.category && e.tone) _patch.omen_events.push({ category: e.category, tone: e.tone, description: e.description||'', region: e.region||'' }); });
              } else if (tc.name === 'record_marriage_birth_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.target) _patch.marriage_birth_events.push({ action: e.action, target: e.target, partner: e.partner||'', heirName: e.heirName||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_conspiracy_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.instigator) _patch.conspiracy_events.push({ action: e.action, instigator: e.instigator, target: e.target||'', outcome: e.outcome||'suppressed', conspirators: Array.isArray(e.conspirators)?e.conspirators:[], reason: e.reason||'' }); });
              } else if (tc.name === 'record_currency_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action) _patch.currency_events.push({ action: e.action, severity: e.severity||'moderate', priceIndexDelta: Number(e.priceIndexDelta)||0, region: e.region||'', reason: e.reason||'' }); });
              } else if (tc.name === 'record_religion_events' && Array.isArray(tc.input.events)) {
                tc.input.events.forEach(function(e) { if (e && e.action && e.religion) _patch.religion_events.push({ action: e.action, religion: e.religion, region: e.region||'', followers: Number(e.followers)||0, reason: e.reason||'' }); });
              } else if (tc.name === 'record_no_changes') {
                // 显式声明无需补录·略
              }
            });

            // ─ 直接施加 sentiment/population 补丁（不走 applyAITurnChanges 因为它没这俩字段） ─
            try {
              _patch.sentiment_changes.forEach(function(s) {
                var pathMap = { minxin: 'minxin', huangwei: 'huangwei', huangquan: 'huangquan' };
                var key = pathMap[s.target]; if (!key || !GM[key]) return;
                if (typeof GM[key] === 'object' && typeof GM[key].index === 'number') {
                  GM[key].index = Math.max(0, Math.min(100, GM[key].index + s.delta));
                } else if (typeof GM[key] === 'number') {
                  GM[key] = Math.max(0, Math.min(100, GM[key] + s.delta));
                }
                // 登记 turnChanges 供史记显示
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: key + '.index', label: ({minxin:'民心',huangwei:'皇威',huangquan:'皇权'})[s.target], delta: s.delta, reason: s.reason || '一致性补录' });
              });
              _patch.population_changes.forEach(function(p) {
                if (!GM.adminHierarchy || !Array.isArray(GM.adminHierarchy.nodes)) return;
                var node = GM.adminHierarchy.nodes.find(function(n){return n.name === p.region;});
                if (!node || !node.populationDetail) return;
                var amt = Math.max(0, Math.min(p.amount, node.populationDetail.mouths || 0));
                if (p.kind === 'death') {
                  node.populationDetail.mouths = Math.max(0, (node.populationDetail.mouths||0) - amt);
                } else if (p.kind === 'flee') {
                  node.populationDetail.fugitives = (node.populationDetail.fugitives||0) + amt;
                  node.populationDetail.mouths = Math.max(0, (node.populationDetail.mouths||0) - amt);
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'admin.' + p.region + '.mouths', label: p.region + (p.kind==='flee'?'·逃亡':'·伤亡'), delta: -amt, reason: p.reason || '一致性补录' });
              });
              // 战争补录
              _patch.war_events.forEach(function(w) {
                if (!Array.isArray(GM.activeWars)) GM.activeWars = [];
                if (w.action === 'start') {
                  GM.activeWars.push({
                    name: (w.enemy||'?') + '之役',
                    enemy: w.enemy || '',
                    region: w.region || '',
                    startedTurn: GM.turn || 0,
                    status: 'ongoing',
                    battles: [],
                    _autoFromReconcile: true
                  });
                } else if (w.action === 'end') {
                  // 取最早一场未结束的战争·标 ended
                  var openWar = GM.activeWars.find(function(x){return x && (x.status==='ongoing' || !x.endedTurn);});
                  if (openWar) {
                    openWar.status = (w.outcome === 'peace' || w.outcome === 'surrender') ? 'peace' : 'ended';
                    openWar.endedTurn = GM.turn || 0;
                    openWar.outcome = w.outcome || 'stalemate';
                  }
                } else if (w.action === 'battle') {
                  var ongoingWar = GM.activeWars.find(function(x){return x && x.status==='ongoing';});
                  if (ongoingWar) {
                    if (!Array.isArray(ongoingWar.battles)) ongoingWar.battles = [];
                    ongoingWar.battles.push({ turn: GM.turn||0, region: w.region||'', outcome: w.outcome||'stalemate', casualties: w.casualties||0, reason: w.reason||'' });
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'activeWars', label: '战事·' + (w.enemy||w.action), delta: w.action==='start'?1:(w.action==='end'?-1:0), reason: w.reason || '一致性补录' });
              });
              // 民变补录
              _patch.revolt_events.forEach(function(r) {
                if (!GM.minxin) GM.minxin = {};
                if (!Array.isArray(GM.minxin.revolts)) GM.minxin.revolts = [];
                if (r.action === 'start') {
                  GM.minxin.revolts.push({
                    region: r.region,
                    leader: r.leader || '',
                    scale: r.scale || 1000,
                    startedTurn: GM.turn || 0,
                    status: 'ongoing',
                    _autoFromReconcile: true
                  });
                } else if (r.action === 'suppress' || r.action === 'appease') {
                  var openR = GM.minxin.revolts.find(function(x){return x && x.status === 'ongoing' && x.region === r.region;});
                  if (openR) {
                    openR.status = (r.action === 'suppress') ? 'suppressed' : 'appeased';
                    openR.endedTurn = GM.turn || 0;
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'minxin.revolts', label: r.region + '·民变·' + r.action, delta: r.action==='start'?1:-1, reason: r.reason || '一致性补录' });
              });
              // 天灾补录
              _patch.disaster_events.forEach(function(d) {
                if (!Array.isArray(GM.activeDisasters)) GM.activeDisasters = [];
                GM.activeDisasters.push({
                  type: d.category,
                  category: d.category,
                  region: d.region,
                  severity: d.severity || 'moderate',
                  casualties: d.casualties || 0,
                  startedTurn: GM.turn || 0,
                  reason: d.reason || '',
                  _autoFromReconcile: true
                });
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'activeDisasters', label: d.region + '·' + ({drought:'旱',flood:'涝',locust:'蝗',plague:'疫',quake:'震'})[d.category], delta: 1, reason: d.reason || '一致性补录' });
              });
              // 外交补录
              _patch.diplomacy_events.forEach(function(e) {
                if (!Array.isArray(GM.facs)) GM.facs = [];
                var fac = GM.facs.find(function(f){return f && f.name === e.faction;});
                if (fac) {
                  if (e.attitude) fac.attitude = e.attitude;
                  if (!fac._diplomaticHistory) fac._diplomaticHistory = [];
                  fac._diplomaticHistory.push({ turn: GM.turn||0, action: e.action, reason: e.reason||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'facs.' + e.faction, label: '外交·' + e.faction + '·' + e.action, delta: 0, reason: e.reason || '一致性补录' });
              });
              // 科举补录
              _patch.keju_events.forEach(function(e) {
                if (typeof P !== 'undefined') {
                  if (!P.keju) P.keju = {};
                  if (!P.keju.history) P.keju.history = [];
                  P.keju.history.push({ turn: GM.turn||0, stage: e.stage, year: e.year||'', topThree: e.topThree||[], reason: e.reason||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'keju.history', label: '科举·' + e.stage + (e.year?'·'+e.year:''), delta: 1, reason: e.reason || '一致性补录' });
              });
              // 党派补录
              _patch.party_events.forEach(function(e) {
                if (!Array.isArray(GM.parties)) GM.parties = [];
                if (e.action === 'form') {
                  GM.parties.push({ name: e.partyName, leader: e.leader||'', members: e.leader?[e.leader]:[], formedTurn: GM.turn||0, status: 'active', reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'dissolve') {
                  var p = GM.parties.find(function(x){return x && x.name === e.partyName && x.status === 'active';});
                  if (p) { p.status = 'dissolved'; p.dissolvedTurn = GM.turn||0; }
                } else if (e.action === 'split' || e.action === 'impeach') {
                  var p2 = GM.parties.find(function(x){return x && x.name === e.partyName;});
                  if (p2) { if (!p2._events) p2._events = []; p2._events.push({ turn: GM.turn||0, action: e.action, reason: e.reason||'' }); }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'parties.' + e.partyName, label: '党派·' + e.partyName + '·' + e.action, delta: e.action==='form'?1:(e.action==='dissolve'?-1:0), reason: e.reason || '一致性补录' });
              });
              // 法令补录
              _patch.edict_events.forEach(function(e) {
                if (!Array.isArray(GM.activeEdicts)) GM.activeEdicts = [];
                if (e.action === 'promulgate' || e.action === 'renew') {
                  GM.activeEdicts.push({ name: e.edictName, category: e.category||'other', startedTurn: GM.turn||0, status: 'active', reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'revoke') {
                  var ed = GM.activeEdicts.find(function(x){return x && x.name === e.edictName && x.status === 'active';});
                  if (ed) { ed.status = 'revoked'; ed.revokedTurn = GM.turn||0; }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'activeEdicts.' + e.edictName, label: '法令·' + e.edictName + '·' + e.action, delta: e.action==='promulgate'?1:(e.action==='revoke'?-1:0), reason: e.reason || '一致性补录' });
              });
              // 朝廷礼仪 / 后宫补录
              _patch.court_ceremony_events.forEach(function(e) {
                if (e.action === 'move_capital' && e.newCapital) {
                  GM._capitalHistory = GM._capitalHistory || [];
                  GM._capitalHistory.push({ turn: GM.turn||0, from: GM.capital||'', to: e.newCapital, reason: e.reason||'', _autoFromReconcile: true });
                  GM.capital = e.newCapital;
                } else {
                  // 角色相关：找 char 并加 title/posthumous/spouse
                  var ch = (GM.chars||[]).find(function(c){return c && c.name === e.target;});
                  if (ch) {
                    if (e.action === 'grant_title' || e.action === 'enthrone_consort') ch.title = e.newTitle || ch.title;
                    else if (e.action === 'strip_title' || e.action === 'depose_consort') ch.titleStripped = true;
                    else if (e.action === 'posthumous_title') ch.posthumousName = e.newTitle || ch.posthumousName;
                    else if (e.action === 'grant_marriage') ch.recentMarriage = { partner: e.newTitle||'', turn: GM.turn||0 };
                    else if (e.action === 'grant_surname') ch.bestowedSurname = e.newTitle || '';
                    if (!ch._titleHistory) ch._titleHistory = [];
                    ch._titleHistory.push({ turn: GM.turn||0, action: e.action, value: e.newTitle||'', reason: e.reason||'', _autoFromReconcile: true });
                  }
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'court.' + e.target, label: '朝仪·' + e.target + '·' + e.action, delta: 0, reason: e.reason || '一致性补录' });
              });
              // 工程·物品·建筑补录
              _patch.construction_events.forEach(function(e) {
                if (!Array.isArray(GM.activeProjects)) GM.activeProjects = [];
                if (e.action === 'build' || e.action === 'restore' || e.action === 'cast') {
                  GM.activeProjects.push({ kind: e.kind, name: e.name, region: e.region||'', cost: e.cost||0, action: e.action, status: 'in_progress', startedTurn: GM.turn||0, reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'complete') {
                  var prj = GM.activeProjects.find(function(x){return x && x.name === e.name && x.status === 'in_progress';});
                  if (prj) { prj.status = 'complete'; prj.completedTurn = GM.turn||0; }
                  else GM.activeProjects.push({ kind: e.kind, name: e.name, region: e.region||'', status: 'complete', completedTurn: GM.turn||0, reason: e.reason||'', _autoFromReconcile: true });
                } else if (e.action === 'destroy') {
                  GM.activeProjects.push({ kind: e.kind, name: e.name, region: e.region||'', status: 'destroyed', destroyedTurn: GM.turn||0, reason: e.reason||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'projects.' + e.name, label: e.kind + '·' + e.name + '·' + e.action, delta: e.action==='destroy'?-1:1, reason: e.reason || '一致性补录' });
              });
              // 异象补录
              _patch.omen_events.forEach(function(e) {
                if (!Array.isArray(GM.omens)) GM.omens = [];
                GM.omens.push({ category: e.category, tone: e.tone, description: e.description||'', region: e.region||'', turn: GM.turn||0, _autoFromReconcile: true });
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'omens', label: '异象·' + e.category + '·' + e.tone, delta: 1, reason: e.description || '一致性补录' });
              });
              // 婚姻·生育·继承 补录
              _patch.marriage_birth_events.forEach(function(e) {
                var ch = (GM.chars||[]).find(function(c){return c && c.name === e.target;});
                if (!GM._marriageBirthHistory) GM._marriageBirthHistory = [];
                GM._marriageBirthHistory.push({ turn: GM.turn||0, action: e.action, target: e.target, partner: e.partner||'', heirName: e.heirName||'', reason: e.reason||'', _autoFromReconcile: true });
                if (ch) {
                  if (e.action === 'marriage') ch.spouse = e.partner || ch.spouse;
                  else if (e.action === 'birth' && e.heirName) {
                    if (!ch.children) ch.children = [];
                    ch.children.push(e.heirName);
                  } else if (e.action === 'succession') ch.inheritedTitle = true;
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'family.' + e.target, label: '家事·' + e.target + '·' + e.action, delta: 0, reason: e.reason || '一致性补录' });
              });
              // 谋反·政变 补录
              _patch.conspiracy_events.forEach(function(e) {
                if (!GM._conspiracies) GM._conspiracies = [];
                GM._conspiracies.push({ turn: GM.turn||0, action: e.action, instigator: e.instigator, target: e.target||'', outcome: e.outcome||'suppressed', conspirators: e.conspirators||[], reason: e.reason||'', _autoFromReconcile: true });
                // 主谋通常应受惩·登记 NPC 状态
                var inst = (GM.chars||[]).find(function(c){return c && c.name === e.instigator;});
                if (inst && (e.outcome === 'suppressed' || e.action === 'plot_failed' || e.action === 'coup_failed')) {
                  inst._imprisoned = true;
                  inst._conspiracyConvicted = true;
                  inst._imprisonedTurn = GM.turn||0;
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: '_conspiracies', label: '谋反·' + e.instigator + '·' + e.action + '/' + (e.outcome||''), delta: 1, reason: e.reason || '一致性补录' });
              });
              // 货币·币值 补录
              _patch.currency_events.forEach(function(e) {
                if (!GM.currency) GM.currency = {};
                if (!GM.currency.events) GM.currency.events = [];
                GM.currency.events.push({ turn: GM.turn||0, action: e.action, severity: e.severity||'moderate', region: e.region||'', reason: e.reason||'', _autoFromReconcile: true });
                if (e.priceIndexDelta) {
                  var prev = (typeof GM.currency.priceIndex === 'number') ? GM.currency.priceIndex : 100;
                  GM.currency.priceIndex = Math.max(20, Math.min(800, prev + e.priceIndexDelta));
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'currency.' + e.action, label: '币政·' + e.action + (e.region?'@'+e.region:''), delta: e.priceIndexDelta||0, reason: e.reason || '一致性补录' });
              });
              // 宗教·教派 补录
              _patch.religion_events.forEach(function(e) {
                if (!Array.isArray(GM.religions)) GM.religions = [];
                if (e.action === 'sect_rise' || e.action === 'foreign_arrival' || e.action === 'promote') {
                  var existRel = GM.religions.find(function(r){return r && r.name === e.religion;});
                  if (existRel) {
                    existRel.followers = (existRel.followers||0) + (e.followers||0);
                    existRel.status = 'active';
                  } else {
                    GM.religions.push({ name: e.religion, status: 'active', followers: e.followers||0, foundedTurn: GM.turn||0, region: e.region||'', _autoFromReconcile: true });
                  }
                } else if (e.action === 'suppress' || e.action === 'sect_ban' || e.action === 'heresy_purge') {
                  var existRel2 = GM.religions.find(function(r){return r && r.name === e.religion;});
                  if (existRel2) { existRel2.status = 'suppressed'; existRel2.suppressedTurn = GM.turn||0; }
                  else GM.religions.push({ name: e.religion, status: 'suppressed', suppressedTurn: GM.turn||0, region: e.region||'', _autoFromReconcile: true });
                }
                if (!GM.turnChanges) GM.turnChanges = {};
                if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
                GM.turnChanges.variables.push({ path: 'religions.' + e.religion, label: '宗教·' + e.religion + '·' + e.action, delta: e.action.indexOf('rise')>=0||e.action==='promote'?1:-1, reason: e.reason || '一致性补录' });
              });
            } catch(_apE) {
              (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_apE, 'reconcile sentiment/population:') : console.warn('[Reconcile] sentiment/population apply failed:', _apE);
            }

            var _patched = _patch.personnel_changes.length + _patch.office_assignments.length + _patch.fiscal_adjustments.length + _patch.military_changes.length + _patch.sentiment_changes.length + _patch.population_changes.length + _patch.war_events.length + _patch.revolt_events.length + _patch.disaster_events.length + _patch.diplomacy_events.length + _patch.keju_events.length + _patch.party_events.length + _patch.edict_events.length + _patch.court_ceremony_events.length + _patch.construction_events.length + _patch.omen_events.length + _patch.marriage_birth_events.length + _patch.conspiracy_events.length + _patch.currency_events.length + _patch.religion_events.length;
            if ((_patch.personnel_changes.length + _patch.office_assignments.length + _patch.fiscal_adjustments.length + _patch.military_changes.length) > 0 && typeof applyAITurnChanges === 'function') {
              applyAITurnChanges({
                personnel_changes: _patch.personnel_changes,
                office_assignments: _patch.office_assignments,
                fiscal_adjustments: _patch.fiscal_adjustments,
                military_changes: _patch.military_changes,
                // 不传 narrative·避免触发 validator 死循环
                shilu_text: '',
                shizhengji: ''
              });
              if (!GM._reconcilePatchLog) GM._reconcilePatchLog = [];
              GM._reconcilePatchLog.push({ turn: GM.turn||0, patch: _patch, mode: _toolResp.fallback ? 'fallback' : 'tool_use', timestamp: Date.now() });
              if (GM._reconcilePatchLog.length > 10) GM._reconcilePatchLog = GM._reconcilePatchLog.slice(-10);
              console.log('[Reconcile] AI 二审完成·补录 ' + _patched + ' 条·模式=' + (_toolResp.fallback?'fallback':'tool_use'));
              if (typeof addEB === 'function') {
                addEB('校验补录', 'AI 二审一致性·补录 ' + _patched + ' 条结构化数据' + (_toolResp.fallback?'（兜底）':''));
              }
            } else {
              console.log('[Reconcile] AI 二审完成·无需补录·模式=' + (_toolResp.fallback?'fallback':'tool_use'));
            }
          } catch(_recE) {
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_recE, 'endturn] reconcile AI:') : console.warn('[endturn] reconcile AI failed:', _recE);
          }
        }

        // v5·人物生成 B · 取消每回合 API 调用·改为玩家在史记弹窗手动点击 pending 名时按需生成
        // (原 scanMentionedCharacters 调用已废弃·扫描+自动 AI 生成会产生误抓且耗 token)
        // pending 名仍由 char-link 的 onclick 触发 _tmClickPendingChar → crystallizePendingCharacter

        shizhengji=p1.shizhengji||"";
        turnSummary=p1.turn_summary||"";
        playerStatus=p1.player_status||""; // 兼容旧字段
        playerInner=p1.player_inner||"";   // 兼容旧字段
        // 新增字段
        shiluText = p1.shilu_text || "";
        szjTitle = p1.szj_title || "";
        szjSummary = p1.szj_summary || "";
        personnelChanges = Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [];
        // 将主角内省记入角色记忆（兼容旧逻辑）
        if (playerInner && typeof NpcMemorySystem !== 'undefined' && P.playerInfo && P.playerInfo.characterName) {
          var _innerEmo = /痛|苦|忧|恨|怒|惧|恐|悲|泪/.test(playerInner) ? '忧' : /喜|乐|慰|畅|笑/.test(playerInner) ? '喜' : '平';
          NpcMemorySystem.remember(P.playerInfo.characterName, playerInner, _innerEmo, 6);
        }
        if(p1.resource_changes){
          Object.entries(p1.resource_changes).forEach(function(e){
            var d=parseFloat(e[1]);if(isNaN(d))return;
            if(GM.vars[e[0]]){
              GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+d,GM.vars[e[0]].min,GM.vars[e[0]].max);
            } else {
              // AI动态创建新变量（如改革进度、特殊资源等）
              GM.vars[e[0]]={value:clamp(d,0,9999),min:0,max:9999,unit:''};
              _dbg('[resource_changes] \u52A8\u6001\u521B\u5EFA\u53D8\u91CF: ' + e[0] + ' = ' + d);
            }
          });
          // 公式约束校验+联动执行
          _enforceFormulas(p1.resource_changes);
        }
        if(p1.relation_changes)Object.entries(p1.relation_changes).forEach(function(e){var d=parseFloat(e[1]);if(isNaN(d))return;if(GM.rels[e[0]])GM.rels[e[0]].value=clamp(GM.rels[e[0]].value+d,-100,100);});
        if(p1.event&&p1.event.title){
          // 事件白名单校验
          var _evtCheck = (typeof EventConstraintSystem!=='undefined') ? EventConstraintSystem.validate(p1.event) : {allowed:true};
          if (_evtCheck.allowed) {
            addEB(p1.event.type||"\u4E8B\u4EF6",p1.event.title + (_evtCheck.downgraded ? '（纯叙事）' : ''));
            if (!_evtCheck.downgraded && typeof EventConstraintSystem!=='undefined') EventConstraintSystem.recordTriggered(p1.event.type);
          } else {
            _dbg('[EventConstraint] 事件被拒绝:', p1.event.type, _evtCheck.reason);
          }
        }

        // 应用 AI 返回的地图变化
        if(p1.map_changes && P.map) {
          try {
            applyAIMapChanges(p1, P.map);
          } catch(e) {
            console.error('应用地图变化失败:', e);
          }
        }
        // 处理 NPC 自主行为（AI 报告的 NPC 独立行动）
        if (p1.npc_actions && Array.isArray(p1.npc_actions)) {
          p1.npc_actions.forEach(function(act) {
            if (!act.name || !act.action) return;
            // 2.3: 模糊匹配名称（防止AI用字/号/略称导致匹配失败）
            var _ff = typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar : null;
            if (_ff && act.name && !findCharByName(act.name)) {
              var _fm = _ff(act.name);
              if (_fm) act.name = _fm.name;
            }
            if (_ff && act.target && !findCharByName(act.target)) {
              var _ft = _ff(act.target);
              if (_ft) act.target = _ft.name;
            }

            // 尝试机械执行（让 AI 的决策产生真实游戏效果）
            var mechanicallyExecuted = false;

            if (act.behaviorType === 'appoint' && act.target) {
              // NPC 任命：尝试通过 PostTransfer 执行
              if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts) {
                var targetPost = null;
                GM.postSystem.posts.forEach(function(p) {
                  if (p.name && act.action.indexOf(p.name) >= 0 && (!p.holder || p.status === 'vacant')) targetPost = p;
                });
                if (targetPost) {
                  PostTransfer.seat(targetPost.id, act.target, act.name);
                  if (typeof recordCharacterArc === 'function') recordCharacterArc(act.target, 'appointment', '被' + act.name + '任命为' + targetPost.name);
                  if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
                    var _tc = (GM.chars || []).find(function(c){ return c.name === act.target; });
                    if (_tc) CorruptionEngine.markAsRecentAppointment(_tc);
                  }
                  if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 8, '被提拔');
                  mechanicallyExecuted = true;
                }
              }
            } else if (act.behaviorType === 'dismiss' && act.target) {
              // NPC 罢免
              if (typeof PostTransfer !== 'undefined') {
                PostTransfer.cascadeVacate(act.target);
                if (typeof recordCharacterArc === 'function') recordCharacterArc(act.target, 'dismissal', '被' + act.name + '罢免');
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -12, '被罢免');
                mechanicallyExecuted = true;
              }
            } else if (act.behaviorType === 'declare_war' && act.target) {
              // NPC 宣战：更新亲疏
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -30, '宣战');
              if (typeof WarWeightSystem !== 'undefined') WarWeightSystem.addTruce(act.name, act.target);
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reward' && act.target) {
              // NPC 赏赐
              var targetChar = findCharByName(act.target);
              if (targetChar) { targetChar.loyalty = Math.min(100, (targetChar.loyalty || 50) + 5); }
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 10, '受赏');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'punish' && act.target) {
              // NPC 惩罚
              var pChar = findCharByName(act.target);
              if (pChar) { pChar.loyalty = Math.max(0, (pChar.loyalty || 50) - 8); }
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -15, '受罚');
              if (typeof StressSystem !== 'undefined' && pChar) StressSystem.checkStress(pChar, '受罚');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'request_loyalty' && act.target) {
              // NPC 拉拢/试探忠诚
              var rlChar = findCharByName(act.target);
              if (rlChar) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 3, '被拉拢');
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(act.target, act.name + '暗中拉拢示好', '平', 5, act.name);
                  NpcMemorySystem.remember(act.name, '试探' + act.target + '的立场', '平', 4, act.target);
                }
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reform') {
              // NPC 推行改革
              if (typeof AutoReboundSystem !== 'undefined' && AutoReboundSystem.checkReforms) {
                var reformChanges = {};
                reformChanges[act.intent || '改革'] = 5;
                AutoReboundSystem.checkReforms(reformChanges);
              }
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(act.name, '推行改革：' + (act.intent || act.action), '平', 6);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'betray') {
              // NPC 背叛
              var bCh = findCharByName(act.name);
              if (bCh) { bCh.loyalty = Math.max(0, (bCh.loyalty||50) - 25); bCh.stance = '投机'; }
              if (typeof AffinityMap !== 'undefined' && act.target) AffinityMap.add(act.name, act.target, -25, '背叛');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(act.name, '背叛：' + act.action, '忧', 9, act.target||'');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'conspire') {
              // NPC 密谋串联
              if (typeof AffinityMap !== 'undefined' && act.target) AffinityMap.add(act.name, act.target, 8, '密谋同盟');
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(act.name, '暗中串联' + (act.target||''), '平', 6, act.target||'');
                if (act.target) NpcMemorySystem.remember(act.target, act.name + '来联络密事', '平', 5, act.name);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'petition' || act.behaviorType === 'investigate') {
              // NPC 上疏/弹劾调查
              if (act.target) {
                var _tgt = findCharByName(act.target);
                if (_tgt) { _tgt.stress = Math.min(100, (_tgt.stress||0) + 8); }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -8, act.behaviorType === 'investigate' ? '弹劾' : '进谏批评');
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'obstruct') {
              // NPC 阻挠政令（仅事件，不修改顶栏数值）
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'slander') {
              // NPC 造谣中伤
              if (act.target) {
                var _slCh = findCharByName(act.target);
                if (_slCh) { _slCh.loyalty = Math.max(0, (_slCh.loyalty||50) - 5); _slCh.stress = Math.min(100, (_slCh.stress||0) + 10); }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -12, '被中伤');
                if (typeof FaceSystem !== 'undefined' && _slCh) FaceSystem.loseFace(_slCh, 10, act.name + '造谣');
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reconcile' || act.behaviorType === 'mentor') {
              // NPC 和解/提携
              if (act.target) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, act.behaviorType === 'mentor' ? 12 : 8, act.behaviorType === 'mentor' ? '师徒提携' : '冰释前嫌');
                var _rcCh = findCharByName(act.target);
                if (_rcCh) _rcCh.loyalty = Math.min(100, (_rcCh.loyalty||50) + 3);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'train_troops' || act.behaviorType === 'fortify' || act.behaviorType === 'patrol') {
              // 军事行为——提升相关军队士气/训练
              var _armyMatch = (GM.armies||[]).find(function(a){return !a.destroyed && (a.commander === act.name || (act.target && a.name === act.target));});
              if (_armyMatch) {
                if (act.behaviorType === 'train_troops') _armyMatch.training = Math.min(100, (_armyMatch.training||50) + 5);
                else if (act.behaviorType === 'patrol') _armyMatch.morale = Math.min(100, (_armyMatch.morale||50) + 3);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'flee' || act.behaviorType === 'retire' || act.behaviorType === 'travel') {
              // NPC 出逃/告老/游历——移动位置
              if (act.new_location) {
                var _flCh = findCharByName(act.name);
                if (_flCh) { _flCh.location = act.new_location; _flCh._locationExplicit = false; }
              }
              if (act.behaviorType === 'flee') {
                var _flCh2 = findCharByName(act.name);
                if (_flCh2) _flCh2.loyalty = Math.max(0, (_flCh2.loyalty||50) - 20);
              }
              if (act.behaviorType === 'retire') {
                // 告老还乡——从官制中移除（新老模型同步）
                if (GM.officeTree) (function _rmHolder(nodes) {
                  nodes.forEach(function(n) {
                    if (n.positions) n.positions.forEach(function(p) {
                      if (p.holder === act.name || (Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){return h && h.name===act.name;}))) {
                        if (typeof _offDismissPerson === 'function') _offDismissPerson(p, act.name);
                        else p.holder = '';
                      }
                    });
                    if (n.subs) _rmHolder(n.subs);
                  });
                })(GM.officeTree);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'develop' || act.behaviorType === 'donate') {
              // 地方发展/赈灾
              if (act.target && GM.provinceStats && GM.provinceStats[act.target]) {
                var ps = GM.provinceStats[act.target];
                if (act.behaviorType === 'develop') ps.prosperity = Math.min(100, (ps.prosperity||50) + 5);
                if (act.behaviorType === 'donate') ps.unrest = Math.max(0, (ps.unrest||0) - 5);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'hoard' || act.behaviorType === 'smuggle') {
              // 囤积/走私——损害经济
              if (GM.taxPressure !== undefined) GM.taxPressure = Math.min(100, GM.taxPressure + 2);
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'suppress') {
              // 镇压——仅事件，不修改顶栏数值
              mechanicallyExecuted = true;
            }

            // NPC行为导致的位置移动（通用处理——flee/retire/travel已内部处理，此处兜底其他情况）
            if (act.new_location && !mechanicallyExecuted) {
              var _nlCh = findCharByName(act.name);
              if (_nlCh && !_isSameLocation(_nlCh.location, act.new_location)) {
                _nlCh.location = act.new_location;
                _nlCh._locationExplicit = false;
              }
            }

            // NPC行为产生连锁记忆——行动者、被动者、旁观同僚都会记住
            if (typeof NpcMemorySystem !== 'undefined' && act.behaviorType && act.behaviorType !== 'none') {
              // 行动者自己的记忆
              var _actEmo = (act.behaviorType === 'reward' || act.behaviorType === 'appoint') ? '喜' : (act.behaviorType === 'punish' || act.behaviorType === 'dismiss') ? '平' : (act.behaviorType === 'declare_war') ? '怒' : '平';
              NpcMemorySystem.remember(act.name, act.action, _actEmo, 5, act.target || '');
              // 同势力同僚也会知道这件事（朝堂无秘密）
              if (act.target && GM.chars && (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'declare_war')) {
                var _actChar = findCharByName(act.name);
                if (_actChar && _actChar.faction) {
                  GM.chars.forEach(function(colleague) {
                    if (colleague.alive !== false && colleague.name !== act.name && colleague.name !== act.target && colleague.faction === _actChar.faction) {
                      NpcMemorySystem.remember(colleague.name, act.name + '对' + act.target + '施以' + act.behaviorType, '忧', 3, act.name);
                    }
                  });
                }
              }
            }

            // 无论是否机械执行，都记录事件
            // 公开事件中只显示 publicReason（对外说辞），不泄露 privateMotiv（真实动机）
            var _pubReason = act.publicReason || act.intent || '';
            var _evtText = act.name + '：' + act.action + (act.target ? '（对象：' + act.target + '）' : '') + (act.result ? ' → ' + act.result : '');
            if (_pubReason) _evtText += '（' + _pubReason + '）';
            addEB('NPC自主', _evtText);
            // 角色弧线记录真实动机（玩家通过人物志可窥见深层故事）
            var _arcDesc = act.action;
            if (act.privateMotiv) _arcDesc += '——' + act.privateMotiv;
            else if (act.innerThought) _arcDesc += '——' + act.innerThought;
            if (typeof recordCharacterArc === 'function') recordCharacterArc(act.name, 'autonomous', _arcDesc);

            if (!mechanicallyExecuted && act.behaviorType && act.behaviorType !== 'none') {
              _dbg('[npc_actions] ' + act.name + ' 行为 ' + act.behaviorType + ' 无法机械执行，仅记录叙事');
            }

            // 3.1: 涟漪效应——与被影响者关系密切的人额外触发记忆
            if (act.target && typeof NpcMemorySystem !== 'undefined' && GM.chars) {
              var _targetCh = findCharByName(act.target);
              if (_targetCh && _targetCh._impressions) {
                for (var _rpn in _targetCh._impressions) {
                  if (_rpn === act.name || _rpn === act.target) continue;
                  var _rpImp = _targetCh._impressions[_rpn];
                  if (Math.abs(_rpImp.favor) >= 15) {
                    var _rpCh = findCharByName(_rpn);
                    if (_rpCh && _rpCh.alive !== false) {
                      var _rpEmo = _rpImp.favor > 0 ? (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'slander' ? '\u6012' : '\u559C') : '\u5E73';
                      var _rpDelta = _rpImp.favor > 0 ? -3 : 2; // 友被害→怨施害者；敌被害→对施害者好感
                      NpcMemorySystem.remember(_rpn, act.target + '\u88AB' + act.name + act.behaviorType, _rpEmo, 4, act.name);
                      if (typeof AffinityMap !== 'undefined') AffinityMap.add(_rpn, act.name, _rpDelta, act.target + '\u88AB' + act.behaviorType);
                    }
                  }
                }
              }
            }
          });
        }

        // 处理 NPC 主动来书（AI推演的远方NPC写信给皇帝）
        if (p1.npc_letters && Array.isArray(p1.npc_letters)) {
          if (!GM._pendingNpcLetters) GM._pendingNpcLetters = [];
          var _nlAccepted = 0, _nlSkipNoChar = 0, _nlSkipCapital = 0, _nlSkipMissing = 0;
          p1.npc_letters.forEach(function(nl) {
            if (!nl.from || !nl.content) { _nlSkipMissing++; return; }
            // 验证from是远方NPC
            var _nlCh = findCharByName(nl.from);
            var _cap = GM._capital || '京城';
            if (!_nlCh) { _nlSkipNoChar++; _dbg('[npc_letters] 找不到角色: ' + nl.from + '·跳过'); return; }
            if (_nlCh.isPlayer) { _nlSkipMissing++; return; }
            if (_isSameLocation(_nlCh.location, _cap)) {
              // 在京 NPC 不应走鸿雁——但 AI 已生成内容·改投奏疏避免内容浪费
              _nlSkipCapital++;
              _dbg('[npc_letters] 在京NPC ' + nl.from + ' 写信·改投奏疏');
              if (!GM.memorials) GM.memorials = [];
              GM.memorials.push({
                id: uid(), from: nl.from, title: _nlCh.officialTitle||_nlCh.title||'',
                type: nl.type === 'impeach' ? '人事' : (nl.type === 'warning' ? '军务' : '政务'),
                subtype: nl.type === 'intelligence' ? '密折' : '题本',
                content: nl.content, status: 'pending', turn: GM.turn, reply: '',
                reliability: 'medium', bias: 'none', priority: nl.urgency === 'extreme' ? 'urgent' : 'normal',
                _convertedFromLetter: true
              });
              return;
            }
            _nlAccepted++;
            GM._pendingNpcLetters.push({
              from: nl.from,
              type: nl.type || 'report',
              urgency: nl.urgency || 'normal',
              content: nl.content,
              suggestion: nl.suggestion || '',
              replyExpected: nl.replyExpected !== false
            });
            // NPC 记一笔·"我写过这封信"·以备日后推演时保持一致
            try {
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                var emoMap = { warning: '忧', plea: '忧', report: '敬', intelligence: '惧', thanks: '敬', impeach: '怒', condolence: '哀', personal: '平', recommend: '敬', greeting: '平' };
                var emo = emoMap[nl.type] || '平';
                var memTxt = '自' + (_nlCh.location || '远方') + '上书天子：' + (nl.subjectLine ? '《'+nl.subjectLine.slice(0,20)+'》' : '') + String(nl.content).slice(0, 60);
                NpcMemorySystem.remember(nl.from, memTxt, emo, nl.urgency === 'extreme' ? 9 : nl.urgency === 'urgent' ? 7 : 5, '天子');
              }
            } catch(_memE) {}
            _dbg('[npc_letters] ' + nl.from + ' 主动来书（' + (nl.type||'report') + '）');
          });
          _dbg('[npc_letters] 入队 ' + _nlAccepted + ' 封·跳过(无角色 ' + _nlSkipNoChar + '·在京改奏疏 ' + _nlSkipCapital + '·缺字段 ' + _nlSkipMissing + ')');
        }

        // 处理 NPC 间通信（密谋/结盟/情报交换）
        if (p1.npc_correspondence && Array.isArray(p1.npc_correspondence)) {
          if (!GM._pendingNpcCorrespondence) GM._pendingNpcCorrespondence = [];
          p1.npc_correspondence.forEach(function(nc) {
            if (!nc.from || !nc.to) return;
            GM._pendingNpcCorrespondence.push({
              from: nc.from, to: nc.to,
              content: nc.content||'', summary: nc.summary||'',
              implication: nc.implication||'', type: nc.type||'secret'
            });
            _dbg('[npc_correspondence] ' + nc.from + ' → ' + nc.to + '（' + (nc.type||'secret') + '）');
          });
        }

        // 处理驿路阻断
        if (p1.route_disruptions && Array.isArray(p1.route_disruptions)) {
          if (!GM._routeDisruptions) GM._routeDisruptions = [];
          p1.route_disruptions.forEach(function(rd) {
            if (!rd.route && !rd.from) return;
            var route = rd.route || (rd.from + '-' + rd.to);
            // 检查是否已有该路线的阻断记录
            var existing = GM._routeDisruptions.find(function(d) { return d.route === route && !d.resolved; });
            if (rd.resolved) {
              // 恢复驿路
              if (existing) existing.resolved = true;
              _dbg('[route_disruptions] 驿路恢复：' + route);
            } else if (!existing) {
              GM._routeDisruptions.push({
                route: route, from: rd.from||'', to: rd.to||'',
                reason: rd.reason||'', resolved: false, turn: GM.turn
              });
              _dbg('[route_disruptions] 驿路阻断：' + route + '（' + (rd.reason||'') + '）');
              if (typeof addEB === 'function') addEB('传书', '⚠ 驿路阻断：' + route + (rd.reason ? '（' + rd.reason + '）' : ''));
            }
          });
        }

        // 处理 NPC 间亲疏变化（AI 推演的人际关系变动）
        if (p1.affinity_changes && Array.isArray(p1.affinity_changes)) {
          p1.affinity_changes.forEach(function(ac) {
            if (!ac.a || !ac.b || !ac.delta) return;
            var delta = clamp(parseInt(ac.delta) || 0, -30, 30);
            if (delta !== 0 && typeof AffinityMap !== 'undefined') {
              AffinityMap.add(ac.a, ac.b, delta, ac.reason || 'AI\u63A8\u6F14');
            }
            // 4.2: 存储结构化关系类型
            if (ac.relType) {
              var ch_a = findCharByName(ac.a);
              if (ch_a) {
                if (!ch_a._relationships) ch_a._relationships = {};
                if (!ch_a._relationships[ac.b]) ch_a._relationships[ac.b] = [];
                var existingRel = ch_a._relationships[ac.b].find(function(r){return r.type===ac.relType;});
                if (existingRel) { existingRel.strength = Math.max(-100, Math.min(100, (existingRel.strength||0) + (ac.delta||0))); }
                else { ch_a._relationships[ac.b].push({type: ac.relType, strength: ac.delta||0, since: GM.turn}); }
                // 双向
                var ch_b = findCharByName(ac.b);
                if (ch_b) {
                  if (!ch_b._relationships) ch_b._relationships = {};
                  if (!ch_b._relationships[ac.a]) ch_b._relationships[ac.a] = [];
                  var existingRel2 = ch_b._relationships[ac.a].find(function(r){return r.type===ac.relType;});
                  if (existingRel2) { existingRel2.strength = Math.max(-100, Math.min(100, (existingRel2.strength||0) + (ac.delta||0))); }
                  else { ch_b._relationships[ac.a].push({type: ac.relType, strength: ac.delta||0, since: GM.turn}); }
                }
              }
            }
          });
        }

        // 处理角色目标更新（4.1: NPC动态目标系统）
        if (p1.goal_updates && Array.isArray(p1.goal_updates)) {
          p1.goal_updates.forEach(function(gu) {
            if (!gu.name) return;
            var ch = findCharByName(gu.name);
            if (!ch) return;
            if (!ch.personalGoals) ch.personalGoals = [];
            var action = gu.action || 'update';
            if (action === 'add' || action === 'replace') {
              // 添加新目标或替换已完成的目标
              var newGoal = {
                id: gu.goalId || ('goal_' + Date.now() + '_' + Math.floor(Math.random()*1000)),
                type: gu.type || 'power',
                longTerm: gu.longTerm || gu.goal || '',
                shortTerm: gu.shortTerm || '',
                progress: gu.progress || 0,
                priority: gu.priority || 5,
                context: gu.context || '',
                createdTurn: GM.turn,
                dynamic: true
              };
              if (action === 'replace' && gu.goalId) {
                var idx = ch.personalGoals.findIndex(function(g){return g.id===gu.goalId;});
                if (idx >= 0) ch.personalGoals[idx] = newGoal;
                else ch.personalGoals.push(newGoal);
              } else {
                ch.personalGoals.push(newGoal);
              }
              // 最多3个目标
              if (ch.personalGoals.length > 3) ch.personalGoals = ch.personalGoals.sort(function(a,b){return (b.priority||5)-(a.priority||5);}).slice(0,3);
            } else if (action === 'complete') {
              // 目标达成
              var gi = ch.personalGoals.findIndex(function(g){return g.id===gu.goalId;});
              if (gi >= 0) {
                var completed = ch.personalGoals.splice(gi, 1)[0];
                if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(ch.name, '达成目标：' + completed.longTerm, '喜', 8);
                addEB('目标', ch.name + '达成：' + completed.longTerm);
              }
            } else {
              // update: 更新现有目标的短期目标/进度/上下文
              var existing = gu.goalId ? ch.personalGoals.find(function(g){return g.id===gu.goalId;}) : ch.personalGoals[0];
              if (existing) {
                if (gu.shortTerm) existing.shortTerm = gu.shortTerm;
                if (gu.progress !== undefined) existing.progress = Math.max(0, Math.min(100, gu.progress));
                if (gu.context) existing.context = gu.context;
                if (gu.longTerm) existing.longTerm = gu.longTerm;
              }
            }
            // 兼容旧格式
            ch.personalGoal = ch.personalGoals.length > 0 ? ch.personalGoals[0].longTerm : '';
            _dbg('[Goal] ' + gu.name + ' ' + action + ': ' + (gu.longTerm || gu.shortTerm || gu.goalId));
          });
        }

        // 6.1: 伏笔/回收系统处理
        if (p1.foreshadowing && Array.isArray(p1.foreshadowing)) {
          if (!GM._foreshadowings) GM._foreshadowings = [];
          p1.foreshadowing.forEach(function(fs) {
            if (!fs.content || !fs.action) return;
            if (fs.action === 'plant') {
              var newFs = {
                id: 'fs_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                content: fs.content,
                type: fs.type || 'mystery',
                resolveCondition: fs.resolveCondition || '',
                plantTurn: GM.turn,
                resolved: false
              };
              GM._foreshadowings.push(newFs);
              addEB('\u6697\u7EBF', fs.content.slice(0, 40));
              // 6.1联动编年纪事：在编年面板创建一个"进行中"事件（玩家可见的表层线索）
              if (!GM.biannianItems) GM.biannianItems = [];
              GM.biannianItems.push({
                id: newFs.id,
                name: fs.content.slice(0, 15),
                title: fs.content.slice(0, 15),
                content: fs.content,
                startTurn: GM.turn,
                turn: GM.turn,
                duration: 9999, // 持续到被回收
                date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                _isForeshadow: true // 内部标记
              });
              _dbg('[Foreshadow] plant: ' + fs.content.slice(0, 40));
            } else if (fs.action === 'resolve') {
              // 模糊匹配最佳伏笔
              var bestMatch = null;
              var bestScore = 0;
              GM._foreshadowings.forEach(function(existing) {
                if (existing.resolved) return;
                var score = 0;
                // 内容相似度：简单字符匹配
                var keywords = fs.content.replace(/[，。、！？\s]/g, '').split('');
                var existWords = existing.content.replace(/[，。、！？\s]/g, '');
                keywords.forEach(function(ch) { if (existWords.indexOf(ch) >= 0) score++; });
                if (fs.type && fs.type === existing.type) score += 5;
                if (score > bestScore) { bestScore = score; bestMatch = existing; }
              });
              if (bestMatch && bestScore >= 3) {
                bestMatch.resolved = true;
                bestMatch.resolveTurn = GM.turn;
                bestMatch.resolveContent = fs.content;
                addEB('\u8F6C\u6298', bestMatch.content.slice(0,15) + '\u2192' + fs.content.slice(0, 25));
                if (typeof ChronicleSystem !== 'undefined' && typeof ChronicleSystem.addMonthDraft === 'function') {
                  ChronicleSystem.addMonthDraft(GM.turn, '\u4F0F\u7B14\u56DE\u6536', bestMatch.content + ' \u2192 ' + fs.content);
                }
                // 6.1联动编年纪事：完成对应的biannian事件
                if (GM.biannianItems) {
                  var _bIdx = GM.biannianItems.findIndex(function(b){ return b._isForeshadow && b.id === bestMatch.id; });
                  if (_bIdx >= 0) {
                    GM.biannianItems[_bIdx].duration = GM.turn - GM.biannianItems[_bIdx].startTurn;
                    GM.biannianItems[_bIdx].content = bestMatch.content + ' \u2192 ' + fs.content;
                  }
                }
                _dbg('[Foreshadow] resolve: ' + fs.content.slice(0, 40) + ' matched: ' + bestMatch.content.slice(0, 30));
              } else {
                _dbg('[Foreshadow] resolve failed - no match for: ' + fs.content.slice(0, 40));
              }
            }
          });
          // 动态上限控制
          var _dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
          var _fsLimit = _dpt <= 3 ? 100 : _dpt <= 40 ? 40 : _dpt <= 100 ? 25 : 15;
          var _unresolvedFs = GM._foreshadowings.filter(function(f) { return !f.resolved; });
          if (_unresolvedFs.length > _fsLimit) {
            // 按埋下回合排序，移除最老的
            _unresolvedFs.sort(function(a, b) { return a.plantTurn - b.plantTurn; });
            var _toRemove = _unresolvedFs.length - _fsLimit;
            for (var _ri = 0; _ri < _toRemove; _ri++) {
              _unresolvedFs[_ri].resolved = true;
              _unresolvedFs[_ri].resolveTurn = GM.turn;
              _unresolvedFs[_ri].resolveContent = '\u8D85\u4E0A\u9650\u81EA\u52A8\u79FB\u9664';
              // 清理对应的biannianItem（防止幽灵条目）
              if (GM.biannianItems) {
                var _bci = GM.biannianItems.findIndex(function(b){ return b._isForeshadow && b.id === _unresolvedFs[_ri].id; });
                if (_bci >= 0) GM.biannianItems.splice(_bci, 1);
              }
            }
            _dbg('[Foreshadow] trimmed ' + _toRemove + ' oldest unresolved (limit=' + _fsLimit + ')');
          }
        }

        // 处理时局要务更新
        if (p1.current_issues_update && Array.isArray(p1.current_issues_update)) {
          if (!GM.currentIssues) GM.currentIssues = [];
          p1.current_issues_update.forEach(function(iu) {
            if (!iu.action) return;
            if (iu.action === 'add' && iu.title) {
              var newIssue = {
                id: 'issue_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                title: iu.title,
                category: iu.category || '',
                description: iu.description || '',
                status: 'pending',
                raisedTurn: GM.turn,
                raisedDate: typeof getTSText === 'function' ? getTSText(GM.turn) : ''
              };
              GM.currentIssues.push(newIssue);
              addEB('\u65F6\u5C40', '\u65B0\u8981\u52A1\uFF1A' + iu.title);
              _dbg('[Issues] add: ' + iu.title);
            } else if (iu.action === 'resolve' && iu.id) {
              var _ri = GM.currentIssues.find(function(i) { return i.id === iu.id && i.status === 'pending'; });
              if (_ri) {
                _ri.status = 'resolved';
                _ri.resolvedTurn = GM.turn;
                _ri.resolvedDate = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
                addEB('\u65F6\u5C40', '\u8981\u52A1\u89E3\u51B3\uFF1A' + _ri.title);
                _dbg('[Issues] resolve: ' + _ri.title);
              }
            } else if (iu.action === 'update' && iu.id) {
              var _ui = GM.currentIssues.find(function(i) { return i.id === iu.id; });
              if (_ui) {
                if (iu.description) _ui.description = iu.description;
                if (iu.title) _ui.title = iu.title;
                if (iu.category) _ui.category = iu.category;
                _dbg('[Issues] update: ' + _ui.title);
              }
            }
          });
        }

        applyCharacterDeaths(p1);  // R100 抽出·原 220 行 if-block → tm-ai-apply-deaths.js

        // 处理AI新增角色（子嗣出生、新投奔者等）
        if (p1.new_characters && Array.isArray(p1.new_characters)) {
          p1.new_characters.forEach(function(nc) {
            if (!nc.name) return;
            // 防止重名
            if (findCharByName(nc.name)) { _dbg('[NewChar] 重名跳过: ' + nc.name); return; }
            var newCh = {
              name: nc.name, title: nc.title || '', age: clamp(parseInt(nc.age) || 0, 0, 120), gender: nc.gender || '',
              faction: nc.faction || (P.playerInfo ? P.playerInfo.factionName : '') || '',
              personality: nc.personality || '', appearance: nc.appearance || '',
              loyalty: 70, ambition: 30,
              intelligence: 40 + Math.floor(random() * 30),
              valor: 30 + Math.floor(random() * 20),
              administration: 30 + Math.floor(random() * 20),
              charisma: 30 + Math.floor(random() * 40),
              diplomacy: 30 + Math.floor(random() * 40),
              alive: true, stress: 0, health: 100, traitIds: [], children: [],
              _memory: [], _memArchive: [], _scars: [], _impressions: {},
              location: nc.location || GM._capital || '',
              parentOf: nc.parentOf || null, bio: nc.reason || '',
              family: nc.family || '', familyTier: nc.familyTier || 'common',
              _createdTurn: GM.turn
            };
            // 子嗣继承父族家族与门第
            if (nc.parentOf && !newCh.family) {
              var _parent = findCharByName(nc.parentOf);
              if (_parent) {
                if (_parent.family) newCh.family = _parent.family;
                if (_parent.familyTier) newCh.familyTier = _parent.familyTier;
              }
            }
            // 如果是子嗣——标记母亲并更新母亲children列表
            if (nc.motherName) {
              var mother = findCharByName(nc.motherName);
              if (mother) {
                if (!mother.children) mother.children = [];
                mother.children.push(nc.name);
                newCh.motherClan = mother.motherClan || mother.faction || '';
                // 子嗣自动加入继承人列表
                if (mother.spouse && GM.harem && nc.gender !== '\u5973') {
                  if (!GM.harem.heirs) GM.harem.heirs = [];
                  GM.harem.heirs.push(nc.name);
                }
              }
            }
            GM.chars.push(newCh);
            // 更新角色索引
            if (GM._indices && GM._indices.charByName) GM._indices.charByName.set(newCh.name, newCh);
            GM.allCharacters.push({name:newCh.name,title:newCh.title,age:newCh.age,gender:newCh.gender,personality:newCh.personality,loyalty:newCh.loyalty,faction:newCh.faction,recruited:true,recruitTurn:GM.turn,source:nc.reason||'\u65B0\u751F'});
            // 加入家族注册表
            if (newCh.family && typeof addToFamily === 'function') addToFamily(newCh.name, newCh.family);
            // 设置血缘关系
            if (newCh.family && newCh.parentOf && typeof setFamilyRelation === 'function') {
              setFamilyRelation(newCh.family, nc.name, newCh.parentOf, '\u7236\u5B50');
            }
            if (newCh.family && nc.motherName && typeof setFamilyRelation === 'function') {
              setFamilyRelation(newCh.family, nc.name, nc.motherName, '\u6BCD\u5B50');
            }
            addEB('\u65B0\u4EBA', nc.name + '\uFF1A' + (nc.reason || '\u65B0\u89D2\u8272'));
            if (typeof recordCharacterArc === 'function') recordCharacterArc(nc.name, 'event', nc.reason || '\u5165\u4E16');
            // 子嗣出生时记入母亲和玩家的记忆
            if (nc.motherName && typeof NpcMemorySystem !== 'undefined') {
              NpcMemorySystem.remember(nc.motherName, '\u8BDE\u4E0B' + (nc.gender === '\u5973' ? '\u516C\u4E3B' : '\u7687\u5B50') + nc.name, '\u559C', 10, nc.name);
              if (P.playerInfo && P.playerInfo.characterName) {
                NpcMemorySystem.remember(P.playerInfo.characterName, nc.motherName + '\u8BDE\u4E0B' + nc.name, '\u559C', 8, nc.motherName);
              }
            }
            _dbg('[NewChar] ' + nc.name + ' (' + (nc.reason || '') + ')');
          });
        }

        // 检测AI叙事中的怀孕事件（从shizhengji中提取）
        if (typeof HaremSettlement !== 'undefined' && GM.chars) {
          var _pregKeywords = /(\S{1,4})(有孕|怀孕|有喜|身怀六甲|珠胎暗结)/;
          var _pregMatch = (shizhengji || '').match(_pregKeywords);
          if (_pregMatch) {
            var _pregMother = findCharByName(_pregMatch[1]);
            if (_pregMother && _pregMother.spouse) {
              HaremSettlement.registerPregnancy(_pregMother.name);
            }
          }
        }

        // 处理角色属性变化（AI直接调整个体角色忠诚/野心等）
        if (p1.char_updates && Array.isArray(p1.char_updates)) {
          var _pNameCU = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.char_updates.forEach(function(cu) {
            if (!cu.name) return;
            var ch = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(cu.name) : null) || findCharByName(cu.name);
            if (!ch) return;
            // ── 玩家保护：玩家角色的决策字段(立场/党派/官职) 不允许 AI 修改 ──
            var _isPlayerTarget = (_pNameCU && cu.name === _pNameCU) || ch.isPlayer;
            if (_isPlayerTarget) {
              // 移除玩家决策字段——只保留状态影响字段(stress/health/能力变化)
              delete cu.new_stance;
              delete cu.new_party;
              delete cu.new_location; // 玩家位置由玩家自行决定
              delete cu.add_traits;
              delete cu.remove_traits;
              // loyalty_delta 对玩家无意义（玩家不会对自己忠诚）
              delete cu.loyalty_delta;
              delete cu.legitimacy_delta;
            }
            if (cu.loyalty_delta) {
              var oldL = ch.loyalty || 50;
              var _loyClamp = (typeof _getModeParams === 'function') ? _getModeParams().loyaltyClamp : 20;
              ch.loyalty = clamp(oldL + clamp(parseInt(cu.loyalty_delta)||0, -_loyClamp, _loyClamp), 0, 100);
              if (Math.abs(cu.loyalty_delta) >= 5) recordChange('characters', cu.name, 'loyalty', oldL, ch.loyalty, cu.reason || 'AI推演');
            }
            if (cu.ambition_delta) {
              ch.ambition = clamp((ch.ambition||50) + clamp(parseInt(cu.ambition_delta)||0, -15, 15), 0, 100);
            }
            if (cu.stress_delta && typeof StressSystem !== 'undefined') {
              ch.stress = clamp((ch.stress||0) + clamp(parseInt(cu.stress_delta)||0, -20, 20), 0, 100);
            }
            // 外交能力变化
            if (cu.diplomacy_delta) {
              ch.diplomacy = clamp((ch.diplomacy||50) + clamp(parseInt(cu.diplomacy_delta)||0, -15, 15), 0, 100);
            }
            // 其余 7 维能力变化（AI可根据经历调整）
            ['intelligence','valor','military','administration','management','charisma','benevolence'].forEach(function(_dim) {
              var _deltaKey = _dim + '_delta';
              if (cu[_deltaKey]) {
                ch[_dim] = clamp((ch[_dim]||50) + clamp(parseInt(cu[_deltaKey])||0, -15, 15), 0, 100);
              }
            });
            // 特质增删（如经历事件后新获特质/失去特质）
            if (Array.isArray(cu.add_traits) && cu.add_traits.length) {
              if (!Array.isArray(ch.traits)) ch.traits = [];
              cu.add_traits.forEach(function(tid) {
                if (typeof TRAIT_LIBRARY === 'undefined' || !TRAIT_LIBRARY[tid]) return;
                // 自动移除冲突特质
                if (typeof traitsConflict === 'function') {
                  ch.traits = ch.traits.filter(function(x) { return !traitsConflict(x, tid); });
                }
                if (ch.traits.indexOf(tid) < 0) ch.traits.push(tid);
              });
            }
            if (Array.isArray(cu.remove_traits) && cu.remove_traits.length && Array.isArray(ch.traits)) {
              ch.traits = ch.traits.filter(function(tid) { return cu.remove_traits.indexOf(tid) < 0; });
            }
            // 正统性变化
            if (cu.legitimacy_delta) {
              ch.legitimacy = clamp((ch.legitimacy||50) + clamp(parseInt(cu.legitimacy_delta)||0, -20, 20), 0, 100);
            }
            // 所在地变更（如被外派、流放、召回京城等）
            if (cu.new_location && typeof cu.new_location === 'string') {
              var _oldLoc = ch.location || GM._capital || '京城';
              ch.location = cu.new_location;
              ch._locationExplicit = false; // AI设置的非编辑器显式
              if (_oldLoc !== cu.new_location) {
                recordChange('characters', cu.name, 'location', _oldLoc, cu.new_location, cu.reason || 'AI推演');
                if (typeof addEB === 'function') addEB('人事', cu.name + '从' + _oldLoc + '赴' + cu.new_location);
              }
            }
            // 立场变化
            if (cu.new_stance && typeof cu.new_stance === 'string') {
              ch.stance = cu.new_stance;
            }
            // 党派变化
            if (cu.new_party !== undefined) {
              ch.party = cu.new_party || '';
            }
            // 压力-特质挂钩
            if (cu.action_type && typeof StressTraitSystem !== 'undefined') {
              var _stressDelta = StressTraitSystem.evaluateStress(ch, cu.action_type);
              if (_stressDelta !== 0) {
                ch.stress = clamp((ch.stress||0) + _stressDelta, 0, 100);
              }
            }
            // NPC记忆：记录重大变化
            if (typeof NpcMemorySystem !== 'undefined' && cu.reason) {
              var _emo = '平';
              if (cu.loyalty_delta && cu.loyalty_delta < -5) _emo = '怒';
              else if (cu.loyalty_delta && cu.loyalty_delta > 5) _emo = '喜';
              else if (cu.stress_delta && cu.stress_delta > 5) _emo = '忧';
              var _imp = Math.min(10, Math.max(1, Math.abs(cu.loyalty_delta||0) + Math.abs(cu.stress_delta||0)));
              if (_imp >= 3) NpcMemorySystem.remember(cu.name, cu.reason, _emo, _imp, '天子');
            }
          });
        }

        // 处理势力变化
        if (p1.faction_changes && Array.isArray(p1.faction_changes)) {
          p1.faction_changes.forEach(function(fc) {
            if (!fc.name) return;
            var fac = (typeof _fuzzyFindFac === 'function' ? _fuzzyFindFac(fc.name) : null) || findFacByName(fc.name);
            if (!fac) return;
            if (fc.strength_delta) {
              var oldS = fac.strength || 50;
              var _strClamp = (typeof _getModeParams === 'function') ? _getModeParams().strengthClamp * 2 : 20;
              fac.strength = clamp(oldS + clamp(parseInt(fc.strength_delta)||0, -_strClamp, _strClamp), 0, 100);
              recordChange('factions', fc.name, 'strength', oldS, fac.strength, fc.reason || 'AI\u63A8\u6F14');
            }
            if (fc.economy_delta) {
              fac.economy = clamp((fac.economy || 50) + clamp(parseInt(fc.economy_delta)||0, -20, 20), 0, 100);
            }
            if (fc.playerRelation_delta) {
              fac.playerRelation = clamp((fac.playerRelation || 0) + clamp(parseInt(fc.playerRelation_delta)||0, -30, 30), -100, 100);
            }
            // 势力覆灭级联（在所有delta处理完毕后检查）
            if (fac.strength <= 0 && !fac.destroyed) {
              fac.destroyed = true;
              addEB('\u52BF\u529B\u52A8\u6001', fc.name + '\u5DF2\u8986\u706D\uFF1A' + (fc.reason || ''));
              if (typeof GameEventBus !== 'undefined') GameEventBus.emit('faction:defeated', { name: fc.name, reason: fc.reason || '' });
              if (GM.chars) {
                GM.chars.forEach(function(c) {
                  if (c.alive !== false && c.faction === fc.name) {
                    c.faction = '';
                    if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '\u6240\u5C5E\u52BF\u529B' + fc.name + '\u8986\u706D', '\u5FE7', 8);
                  }
                });
              }
              if (GM.armies) {
                GM.armies.forEach(function(a) {
                  if (a.faction === fc.name && !a.destroyed) {
                    a.morale = Math.max(0, (a.morale || 50) - 30);
                    addEB('\u519B\u4E8B', a.name + '\u56E0\u52BF\u529B\u8986\u706D\u58EB\u6C14\u5D29\u6E83');
                  }
                });
              }
            }
          });
        }

        // ── 处理势力自治事件 ──
        // 条约违约检测
        if (p1.faction_events && typeof TreatySystem !== 'undefined' && TreatySystem.checkViolations) {
          TreatySystem.checkViolations(p1.faction_events);
        }
        if (p1.faction_events && Array.isArray(p1.faction_events)) {
          p1.faction_events.forEach(function(fe) {
            if (!fe.actor || !fe.action) return;
            var evt = { turn: GM.turn, actor: fe.actor, target: fe.target || '', action: fe.action, result: fe.result || '' };
            if (!GM.factionEvents) GM.factionEvents = [];
            GM.factionEvents.push(evt);
            // 防止无限增长——保留最近100条
            if (GM.factionEvents.length > 100) GM.factionEvents = GM.factionEvents.filter(function(e) { return e.turn >= GM.turn - 5; });
            // 内政事件的strength_effect自动应用
            var _seVal = parseFloat(fe.strength_effect);
            if (!isNaN(_seVal) && _seVal !== 0) {
              var _seFac = findFacByName(fe.actor);
              if (_seFac) {
                _seFac.strength = clamp((_seFac.strength||50) + clamp(_seVal, -10, 10), 0, 100);
              }
            }
            // 分类事件日志
            var _feTag = fe.actionType ? fe.actionType : (fe.target ? '外交' : '内政');
            addEB('势力·' + _feTag, fe.actor + (fe.target ? '→' + fe.target : '') + '：' + fe.action + (fe.result ? '(' + fe.result + ')' : ''));
            _dbg('[FactionEvent/' + _feTag + '] ' + fe.actor + ' → ' + (fe.target || '自身') + ': ' + fe.action);

            // ── 机械系统自动路由 ──
            var _act = (fe.action || '').toLowerCase();
            // 宣战 → CasusBelliSystem
            if ((_act.indexOf('宣战') >= 0 || _act.indexOf('开战') >= 0) && fe.target) {
              if (typeof CasusBelliSystem !== 'undefined') CasusBelliSystem.declareWar(fe.actor, fe.target, fe.casusBelli || 'none');
              if (typeof GameEventBus !== 'undefined') GameEventBus.emit('war:start', {attacker: fe.actor, defender: fe.target, reason: fe.action});
            }
            // 结盟/和亲/朝贡/互市 → TreatySystem
            if (typeof TreatySystem !== 'undefined') {
              if (_act.indexOf('结盟') >= 0 || _act.indexOf('同盟') >= 0) TreatySystem.createTreaty('alliance', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('和亲') >= 0) TreatySystem.createTreaty('marriage', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('朝贡') >= 0) TreatySystem.createTreaty('tribute', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('互市') >= 0) TreatySystem.createTreaty('trade', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('停战') >= 0 || _act.indexOf('讲和') >= 0) TreatySystem.createTreaty('truce', fe.actor, fe.target || '', fe.terms);
            }
            // 行军 → MarchSystem
            if ((_act.indexOf('行军') >= 0 || _act.indexOf('调军') >= 0 || _act.indexOf('进军') >= 0) && typeof MarchSystem !== 'undefined' && MarchSystem._getConfig().enabled) {
              var _marchArmy = (GM.armies||[]).find(function(a) { return a.name === fe.actor || a.faction === fe.actor; });
              if (_marchArmy && fe.target) {
                MarchSystem.createMarchOrder(_marchArmy, _marchArmy.garrison || _marchArmy.location || fe.actor, fe.target, fe.geoData || null);
              }
            }
            // 政变/叛乱 → 势力实力大幅变动
            if (_act.indexOf('政变') >= 0 || _act.indexOf('叛乱') >= 0 || _act.indexOf('篡位') >= 0) {
              var _coupFac = findFacByName(fe.actor);
              if (_coupFac) {
                _coupFac.strength = Math.max(5, (_coupFac.strength||50) - 15); // 内部动荡大减实力
                if (fe.result && (fe.result.indexOf('成功') >= 0 || fe.result.indexOf('胜') >= 0)) {
                  // 政变成功——可能更换首领
                  if (fe.newLeader) _coupFac.leader = fe.newLeader;
                  _coupFac.strength = Math.min(100, (_coupFac.strength||30) + 10); // 稳定后回升
                }
              }
            }
            // 改革 → 实力缓慢提升（但可能引发内部不满）
            if (_act.indexOf('改革') >= 0 || _act.indexOf('变法') >= 0) {
              var _reformFac = findFacByName(fe.actor);
              if (_reformFac) _reformFac.strength = Math.min(100, (_reformFac.strength||50) + 2);
            }
            // 征兵 → 军事力量增长
            if (_act.indexOf('征兵') >= 0 || _act.indexOf('扩军') >= 0) {
              var _recFac = findFacByName(fe.actor);
              if (_recFac && _recFac.militaryStrength) {
                _recFac.militaryStrength = Math.round(_recFac.militaryStrength * 1.1);
              }
            }
            // 围城 → SiegeSystem
            if ((_act.indexOf('围城') >= 0 || _act.indexOf('攻城') >= 0 || _act.indexOf('围困') >= 0) && typeof SiegeSystem !== 'undefined' && SiegeSystem._getConfig().enabled) {
              var _siegeArmy = (GM.armies||[]).find(function(a) { return a.name === fe.actor || a.faction === fe.actor; });
              if (_siegeArmy) {
                // 三层读取：AI事件字段 → AI geoData → 地图区域 → 默认值
                var _siegeRegion = (P.map&&P.map.regions||[]).find(function(r){return (r.id||r.name)===fe.target;});
                var _geo = fe.geoData || {};
                var _siegeFort = fe.fortLevel || _geo.fortLevel || (_siegeRegion ? (_siegeRegion.passLevel||0) : 2);
                var _siegeGarrison = fe.garrison || _geo.garrison || (_siegeRegion ? (_siegeRegion.troops||3000) : 3000);
                SiegeSystem.createSiege(_siegeArmy, fe.target || '未知城池', _siegeFort, _siegeGarrison);
              }
            }
          });
        }

        // ── 处理势力间关系变化 ──
        if (p1.faction_relation_changes && Array.isArray(p1.faction_relation_changes)) {
          if (!GM.factionRelations) GM.factionRelations = [];
          p1.faction_relation_changes.forEach(function(rc) {
            if (!rc.from || !rc.to) return;
            var delta = parseInt(rc.delta) || 0;
            // 查找已有关系
            var existing = GM.factionRelations.find(function(r) { return r.from === rc.from && r.to === rc.to; });
            if (existing) {
              if (rc.type) existing.type = rc.type;
              existing.value = clamp((existing.value || 0) + delta, -100, 100);
              if (rc.reason) existing.desc = rc.reason;
            } else {
              GM.factionRelations.push({ from: rc.from, to: rc.to, type: rc.type || '中立', value: clamp(delta, -100, 100), desc: rc.reason || '' });
            }
            // 双向：自动创建反向关系（如果不存在）
            var reverse = GM.factionRelations.find(function(r) { return r.from === rc.to && r.to === rc.from; });
            if (!reverse) {
              GM.factionRelations.push({ from: rc.to, to: rc.from, type: rc.type || '中立', value: clamp(delta, -100, 100), desc: rc.reason || '' });
            } else {
              // 反向也受影响（幅度减半）
              reverse.value = clamp((reverse.value || 0) + Math.round(delta * 0.5), -100, 100);
            }
            _dbg('[FactionRelChange] ' + rc.from + '→' + rc.to + ' ' + (rc.type || '') + ' ' + delta + ' ' + (rc.reason || ''));
          });
          // 防止无限增长——合并重复关系对，保留最新值
          if (GM.factionRelations && GM.factionRelations.length > 200) {
            var _relMap = {};
            GM.factionRelations.forEach(function(r) { _relMap[r.from + '→' + r.to] = r; });
            GM.factionRelations = Object.values(_relMap);
          }
        }

        // 处理党派变化
        if (p1.party_changes && Array.isArray(p1.party_changes)) {
          p1.party_changes.forEach(function(pc) {
            if (!pc.name) return;
            var party = null;
            if (GM.parties) GM.parties.forEach(function(p) { if (p.name === pc.name) party = p; });
            if (!party) return;
            if (pc.influence_delta) {
              var oldI = party.influence || 50;
              party.influence = clamp(oldI + clamp(parseInt(pc.influence_delta)||0, -20, 20), 0, 100);
              recordChange('parties', pc.name, 'influence', oldI, party.influence, pc.reason || 'AI\u63A8\u6F14');
            }
            if (pc.new_status) { party.status = pc.new_status; addEB('\u515A\u6D3E', pc.name + '\u72B6\u6001\u53D8\u4E3A' + pc.new_status); }
            if (pc.new_leader) { party.leader = pc.new_leader; addEB('\u515A\u6D3E', pc.name + '\u65B0\u9996\u9886:' + pc.new_leader); }
            if (pc.new_agenda) party.currentAgenda = pc.new_agenda;
            if (pc.new_shortGoal) party.shortGoal = pc.new_shortGoal;
          });
        }

        // 处理阶层变化
        if (p1.class_changes && Array.isArray(p1.class_changes)) {
          p1.class_changes.forEach(function(cc) {
            if (!cc.name) return;
            var cls = null;
            if (GM.classes) GM.classes.forEach(function(c) { if (c.name === cc.name) cls = c; });
            if (!cls) return;
            if (cc.satisfaction_delta) {
              var oldS = parseInt(cls.satisfaction) || 50;
              cls.satisfaction = clamp(oldS + clamp(parseInt(cc.satisfaction_delta)||0, -20, 20), 0, 100);
              recordChange('classes', cc.name, 'satisfaction', oldS, cls.satisfaction, cc.reason || 'AI\u63A8\u6F14');
            }
            if (cc.influence_delta) {
              var oldI = parseInt(cls.influence || cls.classInfluence) || 50;
              cls.influence = clamp(oldI + clamp(parseInt(cc.influence_delta)||0, -20, 20), 0, 100);
              recordChange('classes', cc.name, 'influence', oldI, cls.influence, cc.reason || 'AI\u63A8\u6F14');
            }
            if (cc.new_demands) cls.demands = cc.new_demands;
            if (cc.new_status) cls.status = cc.new_status;
          });
        }

        // 处理部队变化
        if (p1.army_changes && Array.isArray(p1.army_changes)) {
          p1.army_changes.forEach(function(ac) {
            if (!ac.name) return;
            var army = GM.armies ? GM.armies.find(function(a) { return a.name === ac.name; }) : null;
            if (!army) return;
            if (ac.soldiers_delta) {
              var oldS = army.soldiers || 0;
              army.soldiers = Math.max(0, oldS + (parseInt(ac.soldiers_delta) || 0));
              recordChange('military', ac.name, 'soldiers', oldS, army.soldiers, ac.reason || 'AI推演');
              // 部队全灭
              if (army.soldiers <= 0) { army.destroyed = true; addEB('军事', ac.name + '全军覆没：' + (ac.reason || '')); }
            }
            if (ac.morale_delta) {
              var oldM = army.morale || 50;
              army.morale = clamp(oldM + clamp(parseInt(ac.morale_delta) || 0, -30, 30), 0, 100);
              recordChange('military', ac.name, 'morale', oldM, army.morale, ac.reason || 'AI推演');
            }
            if (ac.training_delta) {
              var oldT = army.training || 50;
              army.training = clamp(oldT + clamp(parseInt(ac.training_delta) || 0, -20, 20), 0, 100);
            }
            // 5.2: AI调兵——设置行军目的地
            if (ac.destination && typeof ac.destination === 'string') {
              army.destination = ac.destination;
              army._remainingDistance = 0; // 重置，armyMarch pipeline会重新计算
              addEB('\u884C\u519B', ac.name + '\u63A5\u4EE4\u8C03\u5F80' + ac.destination);
            }
          });
        }

        // 处理物品变动
        if (p1.item_changes && Array.isArray(p1.item_changes)) {
          p1.item_changes.forEach(function(ic) {
            if (!ic.name) return;
            var item = GM.items ? GM.items.find(function(it) { return it.name === ic.name; }) : null;
            if (!item) return;
            var wasAcquired = item.acquired;
            if (ic.acquired !== undefined) item.acquired = !!ic.acquired;
            if (ic.owner !== undefined) item.owner = ic.owner;
            if (item.acquired && !wasAcquired) {
              addEB('\u7269\u54C1', '\u83B7\u5F97' + ic.name + (ic.reason ? '\uFF1A' + ic.reason : ''));
            } else if (!item.acquired && wasAcquired) {
              addEB('\u7269\u54C1', '\u5931\u53BB' + ic.name + (ic.reason ? '\uFF1A' + ic.reason : ''));
            }
          });
        }

        // 处理时代状态变动
        if (p1.era_state_delta && GM.eraState) {
          ['socialStability','economicProsperity','centralControl','militaryProfessionalism','culturalVibrancy','bureaucracyStrength'].forEach(function(key) {
            var dk = key + '_delta';
            if (p1.era_state_delta[dk]) {
              var d = parseFloat(p1.era_state_delta[dk]) || 0;
              d = Math.max(-0.1, Math.min(0.1, d)); // 每回合最大±10%
              var oldV = GM.eraState[key] || 0.5;
              GM.eraState[key] = Math.max(0, Math.min(1, oldV + d));
            }
          });
          // 朝代阶段可由AI直接调整
          if (p1.era_state_delta.dynastyPhase) GM.eraState.dynastyPhase = p1.era_state_delta.dynastyPhase;
        }

        // 处理全局状态指标变动（税压）
        if (p1.global_state_delta) {
          var gsd = p1.global_state_delta;
          if (gsd.taxPressure_delta) GM.taxPressure = clamp((GM.taxPressure||50) + clamp(parseInt(gsd.taxPressure_delta)||0, -15, 15), 0, 100);
        }

        // 处理官制占位实体化（将 generated:false 占位变成真角色）
        if (p1.office_spawn && Array.isArray(p1.office_spawn) && GM.officeTree) {
          var _spawnedCount = 0;
          p1.office_spawn.forEach(function(sp) {
            if (!sp || !sp.dept || !sp.position || !sp.holderName) return;
            if (_spawnedCount >= 5) return; // 单回合上限
            // 重名校验
            if (findCharByName(sp.holderName)) {
              _dbg('[office_spawn] 跳过：姓名重复 ' + sp.holderName);
              return;
            }
            // 递归找 position
            var targetPos = null, targetDept = null;
            (function walk(ns, deptChain) {
              ns.forEach(function(n) {
                if (!n) return;
                var chain = deptChain ? deptChain + '·' + n.name : n.name;
                if ((n.name === sp.dept || chain.indexOf(sp.dept) >= 0) && Array.isArray(n.positions)) {
                  var found = n.positions.find(function(p){ return p && p.name === sp.position; });
                  if (found && !targetPos) { targetPos = found; targetDept = n; }
                }
                if (n.subs) walk(n.subs, chain);
              });
            })(GM.officeTree, '');
            if (!targetPos) {
              _dbg('[office_spawn] 未找到 ' + sp.dept + '·' + sp.position);
              return;
            }
            if (!Array.isArray(targetPos.actualHolders)) targetPos.actualHolders = [];
            // 找第一个 generated:false 占位
            var slot = targetPos.actualHolders.find(function(h){ return h && h.generated === false; });
            if (!slot) {
              _dbg('[office_spawn] ' + sp.position + ' 无占位可实体化');
              return;
            }
            // 实体化占位
            slot.name = sp.holderName;
            slot.generated = true;
            slot.spawnedTurn = GM.turn;
            // 双向同步老字段（双层模型）
            if (!targetPos.holder) {
              targetPos.holder = sp.holderName;
            } else if (targetPos.holder !== sp.holderName) {
              if (!Array.isArray(targetPos.additionalHolders)) targetPos.additionalHolders = [];
              if (targetPos.additionalHolders.indexOf(sp.holderName) < 0) targetPos.additionalHolders.push(sp.holderName);
            }
            // 更新 actualCount（具象+占位共计）
            var _totalActual = targetPos.actualHolders.length;
            if (targetPos.actualCount == null || targetPos.actualCount < _totalActual) targetPos.actualCount = _totalActual;
            // 创建角色
            var abilities = sp.abilities || {};
            var newChar = {
              name: sp.holderName,
              title: targetDept.name + sp.position,
              officialTitle: sp.position,
              age: parseInt(sp.age, 10) || 35,
              gender: 'male',
              faction: (P.playerInfo && P.playerInfo.factionName) || '',
              stance: sp.stance || '中立',
              loyalty: Math.max(0, Math.min(100, parseInt(sp.loyalty, 10) || 50)),
              intelligence: Math.max(1, Math.min(100, parseInt(abilities.intelligence, 10) || 50)),
              administration: Math.max(1, Math.min(100, parseInt(abilities.administration, 10) || 50)),
              military: Math.max(1, Math.min(100, parseInt(abilities.military, 10) || 40)),
              valor: Math.max(1, Math.min(100, parseInt(abilities.valor, 10) || 40)),
              charisma: Math.max(1, Math.min(100, parseInt(abilities.charisma, 10) || 50)),
              diplomacy: Math.max(1, Math.min(100, parseInt(abilities.diplomacy, 10) || 50)),
              benevolence: Math.max(1, Math.min(100, parseInt(abilities.benevolence, 10) || 50)),
              personality: sp.personality || '',
              alive: true,
              _spawnedFromOffice: { dept: targetDept.name, position: sp.position, turn: GM.turn, reason: sp.reason || '' }
            };
            if (!Array.isArray(GM.chars)) GM.chars = [];
            GM.chars.push(newChar);
            _spawnedCount++;
            addEB('\u5B98\u5236', '\u3010\u5B9E\u4F53\u5316\u3011' + sp.holderName + '\u5C31\u4EFB' + targetDept.name + sp.position + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
            if (GM.qijuHistory) {
              GM.qijuHistory.unshift({
                turn: GM.turn,
                date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                content: '\u3010\u5B98\u5236\u5B9E\u4F53\u3011\u900F\u8FC7\u63A8\u6F14\u6D89\u53CA\uFF0C' + targetDept.name + sp.position + '\u4E4B\u4F4D\u4E4B\u4EFB\u804C\u8005' + sp.holderName + '\u6D6E\u51FA\u53F2\u4E0B\u3002' + (sp.reason || ''),
                category: '\u5B98\u5236'
              });
            }
          });
        }

        // ── 党派议程演进 ──
        if (p1.party_agenda_shift && Array.isArray(p1.party_agenda_shift) && GM.parties) {
          p1.party_agenda_shift.forEach(function(sh) {
            if (!sh || !sh.party) return;
            var pObj = GM.parties.find(function(p){return p.name === sh.party;});
            if (!pObj) return;
            var old = pObj.currentAgenda || sh.oldAgenda || '';
            pObj.currentAgenda = sh.newAgenda || pObj.currentAgenda;
            if (sh.influence_delta) pObj.influence = Math.max(0, Math.min(100, (pObj.influence||50) + parseFloat(sh.influence_delta)));
            if (!Array.isArray(pObj.agenda_history)) pObj.agenda_history = [];
            pObj.agenda_history.push({ turn: GM.turn, agenda: sh.newAgenda || '', outcome: sh.reason || '', prev: old });
            if (pObj.agenda_history.length > 20) pObj.agenda_history = pObj.agenda_history.slice(-20);
            addEB('\u515A\u4E89', sh.party + '\u8BAE\u7A0B\u8F6C\u5411\u300C' + (sh.newAgenda || '') + '\u300D' + (sh.reason ? '\uFF08' + sh.reason + '\uFF09' : ''));
          });
        }

        // ── 党派分裂 ──
        if (p1.party_splinter && Array.isArray(p1.party_splinter) && GM.parties) {
          p1.party_splinter.forEach(function(sp) {
            if (!sp || !sp.parent || !sp.newName) return;
            var parent = GM.parties.find(function(p){return p.name === sp.parent;});
            if (!parent) return;
            if (GM.parties.some(function(p){return p.name === sp.newName;})) return;
            var newParty = {
              name: sp.newName,
              ideology: sp.ideology || parent.ideology || '',
              leader: sp.newLeader || '',
              influence: Math.floor((parent.influence||50) * 0.4),
              status: '活跃',
              splinterFrom: parent.name,
              cohesion: 70,
              agenda_history: [{ turn: GM.turn, agenda: '立派', outcome: sp.reason||'' }],
              socialBase: parent.socialBase ? JSON.parse(JSON.stringify(parent.socialBase)) : [],
              memberCount: (sp.members && sp.members.length) || 0,
              description: '自' + parent.name + '分裂，' + (sp.reason||''),
              _createdTurn: GM.turn
            };
            GM.parties.push(newParty);
            parent.influence = Math.max(5, (parent.influence||50) - 15);
            parent.cohesion = Math.max(10, (parent.cohesion||60) - 15);
            // 迁移成员
            if (Array.isArray(sp.members) && GM.chars) {
              sp.members.forEach(function(nm) {
                var ch = findCharByName(nm);
                if (ch && ch.party === parent.name) ch.party = sp.newName;
              });
            }
            addEB('\u515A\u4E89', '\u3010\u5206\u88C2\u3011' + parent.name + '\u5206\u88C2\u51FA' + sp.newName + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
          });
        }

        // ── 党派合流 ──
        if (p1.party_merge && Array.isArray(p1.party_merge) && GM.parties) {
          p1.party_merge.forEach(function(mg) {
            if (!mg || !mg.absorber || !mg.absorbed) return;
            var abs = GM.parties.find(function(p){return p.name === mg.absorber;});
            var absd = GM.parties.find(function(p){return p.name === mg.absorbed;});
            if (!abs || !absd) return;
            abs.influence = Math.min(100, (abs.influence||50) + Math.floor((absd.influence||50) * 0.5));
            abs.memberCount = (abs.memberCount||0) + (absd.memberCount||0);
            absd.mergedWith = abs.name;
            absd.status = '已解散';
            // 迁移成员
            if (GM.chars) GM.chars.forEach(function(c){ if (c.party === absd.name) c.party = abs.name; });
            // 从 parties 中移除被吸收方
            GM.parties = GM.parties.filter(function(p){return p.name !== absd.name || p.mergedWith;});
            addEB('\u515A\u4E89', '\u3010\u5408\u6D41\u3011' + absd.name + '\u5E76\u5165' + abs.name + (mg.reason ? '\uFF08' + mg.reason + '\uFF09' : ''));
          });
        }

        // ── 势力继承事件 ──
        if (p1.faction_succession && Array.isArray(p1.faction_succession) && GM.facs) {
          p1.faction_succession.forEach(function(sc) {
            if (!sc || !sc.faction || !sc.newLeader) return;
            var fObj = GM.facs.find(function(f){return f.name === sc.faction;});
            if (!fObj) return;
            var oldLeader = fObj.leader;
            fObj.leader = sc.newLeader;
            if (fObj.leaderInfo) fObj.leaderInfo.name = sc.newLeader;
            if (!fObj.succession) fObj.succession = { rule: 'primogeniture', designatedHeir: '', stability: 60 };
            fObj.succession.stability = Math.max(0, Math.min(100, (fObj.succession.stability||60) + (parseInt(sc.stability_delta)||0)));
            if (!Array.isArray(fObj.historicalEvents)) fObj.historicalEvents = [];
            fObj.historicalEvents.push({ turn: GM.turn, event: sc.disputeType || '继承', impact: oldLeader + '→' + sc.newLeader });
            addEB('\u7EE7\u627F', '\u3010' + sc.faction + '\u3011' + (oldLeader||'?') + '\u2192' + sc.newLeader + '(' + (sc.disputeType||'\u6B63\u5E38\u7EE7\u627F') + ')' + (sc.narrative ? '\uFF1A' + sc.narrative.slice(0,80) : ''));
            if (GM.qijuHistory) {
              GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u7EE7\u627F\u4E8B\u3011' + sc.faction + '\uFF1A' + sc.narrative, category: '\u52BF\u529B' });
            }
          });
        }

        // ── 问对承诺进展更新 ──
        if (p1.commitment_update && Array.isArray(p1.commitment_update) && GM._npcCommitments) {
          p1.commitment_update.forEach(function(cu) {
            if (!cu || !cu.id) return;
            // 遍历找到对应承诺
            var found = null, foundNpc = null;
            Object.keys(GM._npcCommitments).forEach(function(nm) {
              (GM._npcCommitments[nm]||[]).forEach(function(c) {
                if (c.id === cu.id) { found = c; foundNpc = nm; }
              });
            });
            if (!found) return;
            // 若 AI 指定了 npcName 但与实际不符，以实际为准
            var npcActual = cu.npcName || foundNpc;
            found.progress = Math.max(0, Math.min(100, (found.progress||0) + (parseInt(cu.progress_delta,10)||0)));
            if (cu.status) found.status = cu.status;
            if (cu.feedback) found.feedback = cu.feedback;
            found.lastUpdateTurn = GM.turn;
            // 完成/失败处理
            if (found.status === 'completed' || found.consequenceType === 'success') {
              found.status = 'completed';
              addEB('\u95EE\u5BF9\u00B7\u5C65\u884C', foundNpc + '\u4EAB\u606F\uFF1A' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0, 40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '履命完成：' + found.task + '——' + (cu.feedback||''), '慰', 5);
              // 忠诚奖励
              var _cch = findCharByName(foundNpc);
              if (_cch) _cch.loyalty = Math.min(100, (_cch.loyalty||50) + 3);
            } else if (found.status === 'failed' || cu.consequenceType === 'abandoned') {
              found.status = 'failed';
              addEB('\u95EE\u5BF9\u00B7\u5931\u8BFA', foundNpc + '\u672A\u5C65\uFF1A' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0,40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '未履命：' + found.task + '——' + (cu.feedback||''), '忧', 5);
              var _fch = findCharByName(foundNpc);
              if (_fch) { _fch.loyalty = Math.max(0, (_fch.loyalty||50) - 3); _fch.stress = Math.min(100, (_fch.stress||0) + 5); }
            } else if (cu.feedback) {
              addEB('\u95EE\u5BF9\u00B7\u8FDB\u5C55', foundNpc + '：' + (cu.feedback||'').slice(0,50));
            }
            // 写入起居注
            if (GM.qijuHistory && cu.feedback) {
              GM.qijuHistory.unshift({
                turn: GM.turn,
                date: typeof getTSText==='function'?getTSText(GM.turn):'',
                content: '【问对·履命】' + foundNpc + '就「' + found.task + '」：' + cu.feedback,
                category: '问对'
              });
            }
            // 完成/失败的承诺保留在 list 但状态终结；deadline 过期未完成自动标 failed
            if (found.status === 'pending' || found.status === 'executing' || found.status === 'delayed') {
              var elapsed = GM.turn - found.assignedTurn;
              if (elapsed > (found.deadline || 3) + 2 && found.progress < 50) {
                found.status = 'failed';
                addEB('\u95EE\u5BF9\u00B7\u8FC7\u671F', foundNpc + '迟迟未办：' + found.task.slice(0,30));
              }
            }
          });
        }

        // ── 起义前兆（酝酿期） ──
        if (p1.revolt_precursor && Array.isArray(p1.revolt_precursor)) {
          if (!Array.isArray(GM._revoltPrecursors)) GM._revoltPrecursors = [];
          p1.revolt_precursor.forEach(function(pc) {
            if (!pc || !pc.class || !pc.indicator) return;
            GM._revoltPrecursors.push({
              turn: GM.turn, class: pc.class, region: pc.region || '',
              indicator: pc.indicator, severity: pc.severity || 'mild',
              detail: pc.detail || '', couldLeadTo: pc.couldLeadTo || ''
            });
            // 老前兆自动过期（>15 回合）
            GM._revoltPrecursors = GM._revoltPrecursors.filter(function(p){return GM.turn - p.turn < 15;});
            // 推动 unrestLevels 下降（对应阶层）
            var _cObj = (GM.classes||[]).find(function(c){return c.name === pc.class;});
            if (_cObj) {
              if (!_cObj.unrestLevels) _cObj.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
              var _drop = pc.severity === 'critical' ? 10 : pc.severity === 'severe' ? 5 : 2;
              _cObj.unrestLevels.grievance = Math.max(0, (_cObj.unrestLevels.grievance||60) - _drop);
              if (pc.severity !== 'mild') _cObj.unrestLevels.petition = Math.max(0, (_cObj.unrestLevels.petition||70) - _drop * 0.7);
              if (pc.severity === 'critical') _cObj.unrestLevels.revolt = Math.max(0, (_cObj.unrestLevels.revolt||90) - _drop * 0.5);
            }
            var _indLbl = {famine:'饥荒',landConcentration:'土地兼并',heavyTax:'苛税',corvee:'繁役',officialCorruption:'吏治腐败',propheticOmen:'谶纬异象',secretSociety:'教门密谋'}[pc.indicator] || pc.indicator;
            addEB('\u524D\u5146', '\u3010' + (pc.region||'') + '\u3011' + pc.class + '——' + _indLbl + '(' + (pc.severity||'') + ')' + (pc.detail?'：' + pc.detail.slice(0,80):''));
          });
        }

        // ── 阶层起义爆发——长周期生命周期起点 ──
        if (p1.class_revolt && Array.isArray(p1.class_revolt) && GM.classes) {
          if (!Array.isArray(GM._activeRevolts)) GM._activeRevolts = [];
          p1.class_revolt.forEach(function(rv) {
            if (!rv || !rv.class || !rv.leaderName) return;
            var cObj = GM.classes.find(function(c){return c.name === rv.class;});
            if (!cObj) return;
            var _rid = rv.revoltId || ('revolt_' + GM.turn + '_' + Math.random().toString(36).slice(2, 8));
            if (GM._activeRevolts.some(function(r){return r.id === _rid;})) return; // 重复ID
            // 生成起义领袖角色（若不存在）
            if (GM.chars && !findCharByName(rv.leaderName)) {
              var _abBase = { intelligence: 50, administration: 40, military: 55, valor: 65, charisma: 75, diplomacy: 40, benevolence: 50 };
              // 根据 ideology 调整能力倾向
              if (rv.ideology === 'religious') { _abBase.charisma += 15; _abBase.intelligence += 10; _abBase.diplomacy += 5; }
              else if (rv.ideology === 'warlord' || rv.organizationType === 'militaryMutiny') { _abBase.military += 15; _abBase.valor += 10; }
              else if (rv.ideology === 'nobleClaim') { _abBase.administration += 15; _abBase.intelligence += 10; _abBase.charisma += 10; }
              else if (rv.ideology === 'populist') { _abBase.benevolence += 15; _abBase.charisma += 10; }
              GM.chars.push({
                name: rv.leaderName,
                title: rv.class + '领袖',
                faction: rv.class + '起义军',
                class: rv.class,
                alive: true,
                age: 35,
                loyalty: 0,
                stance: '反对',
                intelligence: Math.min(100, _abBase.intelligence),
                administration: Math.min(100, _abBase.administration),
                military: Math.min(100, _abBase.military),
                valor: Math.min(100, _abBase.valor),
                charisma: Math.min(100, _abBase.charisma),
                diplomacy: Math.min(100, _abBase.diplomacy),
                benevolence: Math.min(100, _abBase.benevolence),
                personality: '起义领袖——' + (rv.slogan || (rv.demands ? rv.demands.join('、') : '')),
                _spawnedFromRevolt: { revoltId: _rid, class: rv.class, region: rv.region, turn: GM.turn }
              });
            }
            // 生成副将（若指定且不存在）
            if (Array.isArray(rv.secondaryLeaders) && GM.chars) {
              rv.secondaryLeaders.forEach(function(sln) {
                if (!sln || findCharByName(sln)) return;
                GM.chars.push({
                  name: sln, title: rv.class + '义军副将', faction: rv.class + '起义军', class: rv.class, alive: true,
                  age: 32, loyalty: 70, stance: '反对',
                  intelligence: 45, administration: 35, military: 60, valor: 65, charisma: 50, diplomacy: 35, benevolence: 45,
                  _spawnedFromRevolt: { revoltId: _rid, class: rv.class, region: rv.region, turn: GM.turn, role: 'secondary' }
                });
              });
            }
            // 构建 revolt 实体
            var revolt = {
              id: _rid,
              class: rv.class, region: rv.region || '',
              leaderName: rv.leaderName,
              secondaryLeaders: Array.isArray(rv.secondaryLeaders) ? rv.secondaryLeaders : [],
              ideology: rv.ideology || 'populist',
              organizationType: rv.organizationType || 'flowingBandit',
              slogan: rv.slogan || '',
              religiousSect: rv.religiousSect || '',
              historicalArchetype: rv.historicalArchetype || '',
              scale: rv.scale || '中',
              militaryStrength: parseInt(rv.militaryStrength, 10) || 5000,
              composition: rv.composition || '',
              supplyStatus: 50,
              phase: rv.phase || 'uprising',
              demands: Array.isArray(rv.demands) ? rv.demands : [],
              grievances: Array.isArray(rv.grievances) ? rv.grievances : [],
              spreadPattern: rv.spreadPattern || 'mobile',
              territoryControl: rv.region ? [rv.region] : [],
              absorbedForces: [],
              externalSupport: [],
              defectedOfficials: [],
              startTurn: GM.turn,
              history: [{ turn: GM.turn, phase: rv.phase || 'uprising', event: '首义：' + (rv.reason || rv.slogan || '') }],
              outcome: null
            };
            GM._activeRevolts.push(revolt);

            // 更新阶层领袖
            if (!Array.isArray(cObj.leaders)) cObj.leaders = [];
            if (cObj.leaders.indexOf(rv.leaderName) < 0) cObj.leaders.push(rv.leaderName);
            // 加入 activeWars
            if (!Array.isArray(GM.activeWars)) GM.activeWars = [];
            GM.activeWars.push({
              enemy: rv.class + '起义军', leader: rv.leaderName, region: rv.region,
              militaryStrength: revolt.militaryStrength, turn: GM.turn,
              demands: revolt.demands, revoltId: _rid
            });
            // 清理关联前兆（已爆发）
            if (Array.isArray(GM._revoltPrecursors)) {
              GM._revoltPrecursors = GM._revoltPrecursors.filter(function(pc){return !(pc.class === rv.class && pc.region === rv.region);});
            }
            addEB('\u8D77\u4E49', '\u3010' + (rv.region||'') + '\u3011' + rv.class + '\u8D77\u4E49\uFF01\u9886\u8896' + rv.leaderName + (rv.slogan?'\u6253\u300C' + rv.slogan + '\u300D':'') + '\u2014\u2014' + (rv.historicalArchetype?'\u5F62\u5982' + rv.historicalArchetype + '\uFF0C':'') + '\u89C4\u6A21' + (rv.scale||'\u4E2D') + (rv.reason ? '\u56E0\u2014\u2014' + rv.reason : ''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义爆发】' + rv.leaderName + '起兵于' + (rv.region||'?') + (rv.slogan?'，号"' + rv.slogan + '"':'') + '。' + (rv.reason||''), category: '起义' });
          });
        }

        // ── 起义进展更新 ──
        if (p1.revolt_update && Array.isArray(p1.revolt_update) && GM._activeRevolts) {
          p1.revolt_update.forEach(function(ru) {
            if (!ru || !ru.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === ru.revoltId;});
            if (!r || r.outcome) return;
            var oldPhase = r.phase;
            if (ru.newPhase) r.phase = ru.newPhase;
            if (Array.isArray(ru.territoryGained)) ru.territoryGained.forEach(function(t){ if(t && r.territoryControl.indexOf(t)<0) r.territoryControl.push(t); });
            if (Array.isArray(ru.territoryLost)) ru.territoryLost.forEach(function(t){ r.territoryControl = r.territoryControl.filter(function(tt){return tt !== t;}); });
            if (ru.strength_delta) r.militaryStrength = Math.max(0, (r.militaryStrength||0) + parseInt(ru.strength_delta, 10));
            if (ru.supplyStatus_delta) r.supplyStatus = Math.max(0, Math.min(100, (r.supplyStatus||50) + parseInt(ru.supplyStatus_delta, 10)));
            if (Array.isArray(ru.absorbedForces)) ru.absorbedForces.forEach(function(f){ if (r.absorbedForces.indexOf(f) < 0) r.absorbedForces.push(f); });
            if (Array.isArray(ru.externalSupport)) ru.externalSupport.forEach(function(s){ if (r.externalSupport.indexOf(s) < 0) r.externalSupport.push(s); });
            if (Array.isArray(ru.defectedOfficials)) {
              ru.defectedOfficials.forEach(function(nm) {
                if (r.defectedOfficials.indexOf(nm) < 0) r.defectedOfficials.push(nm);
                var _och = findCharByName(nm);
                if (_och) {
                  _och.faction = r.class + '起义军';
                  _och.loyalty = 80;
                  _och._defectedTurn = GM.turn;
                  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(nm, '投奔起义军：' + (r.slogan||''), '决', 8);
                }
              });
            }
            // 领袖伤亡
            if (ru.leaderCasualty) {
              addEB('\u8D77\u4E49', '\u3010' + r.leaderName + '\u3011' + ru.leaderCasualty);
              if (/\u6B7B|\u6218\u6B7B|\u88AB\u6740|\u906E\u6BD9/.test(ru.leaderCasualty)) {
                var _lCh = findCharByName(r.leaderName);
                if (_lCh) { _lCh.alive = false; _lCh.dead = true; _lCh.deathTurn = GM.turn; _lCh.deathReason = ru.leaderCasualty; if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: _lCh.name, reason: ru.leaderCasualty }); }
                // 领袖死亡通常推向 decline（除非已转 establishment）
                if (r.phase !== 'establishment') r.phase = 'decline';
              }
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: ru.keyEvent || ru.narrative || '推进' });
            // 同步 activeWars 的 militaryStrength
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars.forEach(function(w){ if (w.revoltId === r.id) w.militaryStrength = r.militaryStrength; });
            }
            // 自动建政提示——若进入 establishment 而未转化，AI 下回合应 revolt_transform to faction_create
            if (r.phase === 'establishment' && oldPhase !== 'establishment') {
              r._needTransform = true;
            }
            addEB('\u8D77\u4E49', '\u3010' + r.leaderName + '\u3011' + (oldPhase!==r.phase?'\u8F6C\u5165' + r.phase + '\uFF1A':'\u63A8\u8FDB\uFF1A') + (ru.keyEvent||'') + (ru.narrative?'\u2014\u2014' + ru.narrative.slice(0,80):''));
            if (GM.qijuHistory && (ru.keyEvent || ru.narrative)) {
              GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义·' + r.phase + '】' + r.leaderName + '：' + (ru.keyEvent||ru.narrative||''), category: '起义' });
            }
          });
        }

        // ── 镇压行动 ──
        if (p1.revolt_suppress && Array.isArray(p1.revolt_suppress) && GM._activeRevolts) {
          p1.revolt_suppress.forEach(function(sp) {
            if (!sp || !sp.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === sp.revoltId;});
            if (!r || r.outcome) return;
            var cas = sp.casualties || {};
            if (cas.rebel) r.militaryStrength = Math.max(0, (r.militaryStrength||0) - parseInt(cas.rebel, 10));
            if (sp.tactic === '坚壁清野') r.supplyStatus = Math.max(0, (r.supplyStatus||50) - 15);
            if (sp.tactic === '分化瓦解') { r.absorbedForces = r.absorbedForces.slice(0, Math.max(0, r.absorbedForces.length - 2)); }
            if (sp.outcome === 'victory') {
              r.outcome = 'suppressed';
              r.phase = 'ending';
              // 移除 activeWars
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              // 领袖被杀
              var _l = findCharByName(r.leaderName);
              if (_l) { _l.alive = false; _l.dead = true; _l.deathTurn = GM.turn; _l.deathReason = '起义失败被剿'; if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: _l.name, reason: '起义失败被剿' }); }
            } else if (sp.outcome === 'defeat') {
              // 官军反被击溃——起义壮大
              r.militaryStrength = Math.min(999999, (r.militaryStrength||0) + 3000);
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '镇压:' + (sp.suppressor||'官军') + '-' + (sp.outcome||'相持') });
            addEB('\u9547\u538B', '【' + (sp.suppressor||'官军') + '】' + (sp.tactic||'') + '→' + r.leaderName + '之乱' + (sp.outcome==='victory'?'\u5E73\u5B9A':sp.outcome==='defeat'?'\u53CD\u88AB\u51FB\u6E83':'') + (sp.narrative?'\u2014\u2014' + sp.narrative.slice(0,80):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【镇压】' + (sp.suppressor||'?') + '战' + r.leaderName + '，结' + (sp.outcome||'?') + '。' + (sp.narrative||''), category: '起义' });
          });
        }

        // ── 招安行动 ──
        if (p1.revolt_amnesty && Array.isArray(p1.revolt_amnesty) && GM._activeRevolts) {
          p1.revolt_amnesty.forEach(function(am) {
            if (!am || !am.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === am.revoltId;});
            if (!r || r.outcome) return;
            if (am.outcome === 'accepted') {
              r.outcome = 'coopted';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              // 领袖归顺：faction 改回朝廷，loyalty 恢复
              var _acLeaders = Array.isArray(am.acceptedLeaders) && am.acceptedLeaders.length ? am.acceptedLeaders : [r.leaderName];
              _acLeaders.forEach(function(nm) {
                var _ch = findCharByName(nm);
                if (_ch) {
                  _ch.faction = (P.playerInfo && P.playerInfo.factionName) || _ch.faction;
                  _ch.loyalty = 45;
                  _ch._cooptedTurn = GM.turn;
                  _ch.title = '归附·' + (_ch.title || '将领');
                }
              });
            } else if (am.outcome === 'split') {
              // 分化：接受者归顺，拒绝者继续
              if (Array.isArray(am.acceptedLeaders)) {
                am.acceptedLeaders.forEach(function(nm) {
                  var _ch = findCharByName(nm);
                  if (_ch) { _ch.faction = (P.playerInfo && P.playerInfo.factionName) || _ch.faction; _ch.loyalty = 40; _ch._cooptedTurn = GM.turn; }
                });
              }
              r.militaryStrength = Math.floor((r.militaryStrength||0) * 0.5);
              r.phase = 'decline';
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '招安:' + (am.envoy||'') + '-' + (am.outcome||'') });
            addEB('\u62DB\u5B89', '【' + (am.envoy||'?') + '】招安' + r.leaderName + '：' + (am.outcome||'?') + (am.terms?'；条件：' + am.terms.slice(0,60):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【招安】' + (am.envoy||'?') + '抚' + r.leaderName + '，' + (am.outcome||'?') + '。' + (am.narrative||''), category: '起义' });
          });
        }

        // ── 起义转化（建政 / 招安编入 / 融入他派 / 改朝） ──
        if (p1.revolt_transform && Array.isArray(p1.revolt_transform) && GM._activeRevolts) {
          p1.revolt_transform.forEach(function(tr) {
            if (!tr || !tr.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === tr.revoltId;});
            if (!r || r.outcome) return;
            if (tr.transformType === 'toFaction' && tr.newFactionName) {
              // 自动创建 faction
              if (!Array.isArray(GM.facs)) GM.facs = [];
              if (!GM.facs.some(function(f){return f.name === tr.newFactionName;})) {
                GM.facs.push({
                  id: 'faction_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
                  name: tr.newFactionName,
                  type: r.organizationType === 'builtState' ? '主权国' : '起义军',
                  leader: r.leaderName,
                  territory: (tr.finalTerritory || r.territoryControl.join('、')),
                  strength: Math.min(100, 20 + Math.floor((r.militaryStrength||0) / 5000)),
                  militaryStrength: r.militaryStrength || 10000,
                  economy: 30,
                  attitude: '敌对',
                  playerRelation: -50,
                  cohesion: { political: 40, military: 70, economic: 30, cultural: r.ideology === 'religious' ? 80 : 50, ethnic: r.ideology === 'ethnic' ? 90 : 60, loyalty: 70 },
                  militaryBreakdown: { standingArmy: Math.floor((r.militaryStrength||0) * 0.6), militia: Math.floor((r.militaryStrength||0) * 0.4), elite: 0, fleet: 0 },
                  succession: { rule: 'strongest', designatedHeir: '', stability: 30 },
                  historicalEvents: [{ turn: r.startTurn, event: '起义立国', impact: r.slogan||'' }, { turn: GM.turn, event: '正式建政', impact: tr.narrative||'' }],
                  internalParties: [],
                  description: '自' + r.class + '起义（' + (r.historicalArchetype||'') + '）升级',
                  color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
                  _createdTurn: GM.turn,
                  _fromRevolt: r.id
                });
                // 更新角色 faction
                if (GM.chars) {
                  GM.chars.filter(function(c){return c.faction === r.class + '起义军';}).forEach(function(c){ c.faction = tr.newFactionName; });
                }
                // activeWars 更新
                if (Array.isArray(GM.activeWars)) {
                  GM.activeWars.forEach(function(w){ if (w.revoltId === r.id) w.enemy = tr.newFactionName; });
                }
              }
              r.outcome = 'seceded';
              r.phase = 'ending';
            } else if (tr.transformType === 'dynastyReplaced') {
              r.outcome = 'dynastyReplaced';
              r.phase = 'ending';
              // 游戏结束信号——让上层 UI 处理
              GM._gameOverPending = { reason: 'dynasty_replaced_by_revolt', revoltId: r.id, newDynasty: tr.newFactionName, narrative: tr.narrative };
              addEB('\u6539\u671D', '【改朝换代】' + r.leaderName + '之乱颠覆旧朝，' + (tr.newFactionName||'新朝') + '立。');
            } else if (tr.transformType === 'merged' && tr.mergedInto) {
              r.outcome = 'merged';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              if (GM.chars) GM.chars.filter(function(c){return c.faction === r.class + '起义军';}).forEach(function(c){ c.faction = tr.mergedInto; });
            } else if (tr.transformType === 'coopted') {
              r.outcome = 'coopted';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
            } else if (tr.transformType === 'dissolved') {
              r.outcome = 'dissolved';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '转化:' + tr.transformType });
            addEB('\u8D77\u4E49', '【转化】' + r.leaderName + '之乱→' + tr.transformType + (tr.newFactionName?'：立' + tr.newFactionName:'') + (tr.narrative?'——' + tr.narrative.slice(0,80):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义转化】' + r.leaderName + '：' + tr.transformType + '。' + (tr.narrative||''), category: '起义' });
          });
        }

        // ── 党派新建 ──
        if (p1.party_create && Array.isArray(p1.party_create)) {
          if (!Array.isArray(GM.parties)) GM.parties = [];
          p1.party_create.forEach(function(pc) {
            if (!pc || !pc.name) return;
            if (GM.parties.some(function(p){return p.name === pc.name;})) return;
            var newP = {
              name: pc.name,
              ideology: pc.ideology || '',
              leader: pc.leader || '',
              influence: parseInt(pc.influence, 10) || 20,
              status: pc.status || '活跃',
              cohesion: parseInt(pc.cohesion, 10) || 70,
              memberCount: parseInt(pc.memberCount, 10) || 0,
              crossFaction: !!pc.crossFaction,
              currentAgenda: pc.currentAgenda || '',
              socialBase: Array.isArray(pc.socialBase) ? pc.socialBase : [],
              agenda_history: [{ turn: GM.turn, agenda: '立党', outcome: pc.reason || pc.trigger || '' }],
              focal_disputes: [],
              officePositions: [],
              description: pc.reason || '',
              _createdTurn: GM.turn
            };
            GM.parties.push(newP);
            // 党魁如是已有角色，则标记其 party
            if (pc.leader) {
              var _ldr = findCharByName(pc.leader);
              if (_ldr) _ldr.party = pc.name;
            }
            addEB('\u515A\u4E89', '\u3010\u65B0\u515A\u5D1B\u8D77\u3011' + pc.name + (pc.leader ? '\uFF08\u9996\uFF1A' + pc.leader + '\uFF09' : '') + (pc.trigger ? '\u2014\u2014' + pc.trigger : '') + (pc.reason ? '\uFF1A' + pc.reason : ''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u515A\u3011' + pc.name + '\u6210\u7ACB\u3002' + (pc.reason||''), category: '\u515A\u6D3E' });
          });
        }

        // ── 党派覆灭 ──
        if (p1.party_dissolve && Array.isArray(p1.party_dissolve) && GM.parties) {
          p1.party_dissolve.forEach(function(pd) {
            if (!pd || !pd.name) return;
            var pObj = GM.parties.find(function(p){return p.name === pd.name;});
            if (!pObj) return;
            pObj.status = '已解散';
            pObj._dissolvedTurn = GM.turn;
            pObj._dissolveCause = pd.cause;
            // 成员去向
            if (GM.chars) {
              GM.chars.filter(function(c){return c.party === pd.name;}).forEach(function(c) {
                c.party = '';
                c.partyRank = '';
                c._formerParty = pd.name;
                // 按 fatePerMember 调整状态
                if (pd.cause === 'liquidated' || pd.cause === 'leaderKilled') {
                  c.loyalty = Math.max(0, (c.loyalty||50) - 20);
                  c.stress = Math.min(100, (c.stress||0) + 25);
                }
                if (typeof NpcMemorySystem !== 'undefined') {
                  var _emo = pd.cause === 'liquidated' ? '恨' : pd.cause === 'leaderKilled' ? '悲' : '忧';
                  NpcMemorySystem.remember(c.name, pd.name + '被' + (pd.cause||'解散') + '——' + (pd.fatePerMember||''), _emo, 7);
                }
              });
            }
            // 从列表中移除（保留 _dissolvedTurn 供历史追溯）
            GM.parties = GM.parties.filter(function(p){return p.name !== pd.name;});
            var _cLbl = {banned:'被查禁',liquidated:'被肃清',faded:'自然消亡',leaderKilled:'领袖被杀而散',absorbed:'被吞并'}[pd.cause] || pd.cause || '覆灭';
            addEB('\u515A\u4E89', '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + (pd.perpetrator?'\uFF08' + pd.perpetrator + '\u4E3B\u7F16\uFF09':'') + (pd.reason?'\uFF1A' + pd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + '\u3002' + (pd.reason||''), category: '\u515A\u6D3E' });
          });
        }

        // ── 势力新建 ──
        if (p1.faction_create && Array.isArray(p1.faction_create)) {
          if (!Array.isArray(GM.facs)) GM.facs = [];
          p1.faction_create.forEach(function(fc) {
            if (!fc || !fc.name) return;
            if (GM.facs.some(function(f){return f.name === fc.name;})) return;
            var newF = {
              id: 'faction_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
              name: fc.name,
              type: fc.type || '起义军',
              leader: fc.leader || '',
              territory: fc.territory || '',
              strength: parseInt(fc.strength, 10) || 30,
              militaryStrength: parseInt(fc.militaryStrength, 10) || 10000,
              economy: parseInt(fc.economy, 10) || 40,
              attitude: fc.attitude || '敌对',
              playerRelation: parseInt(fc.playerRelation, 10) || -30,
              cohesion: fc.cohesion || { political: 50, military: 60, economic: 40, cultural: 50, ethnic: 60, loyalty: 50 },
              militaryBreakdown: { standingArmy: parseInt(fc.militaryStrength, 10)||10000, militia: 0, elite: 0, fleet: 0 },
              succession: { rule: 'strongest', designatedHeir: '', stability: 40 },
              historicalEvents: [{ turn: GM.turn, event: '立国', impact: fc.triggerEvent || fc.reason || '' }],
              internalParties: [],
              parentFaction: fc.parentFaction || '',
              description: fc.reason || '',
              color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
              _createdTurn: GM.turn
            };
            GM.facs.push(newF);
            // 关联现有角色
            if (fc.leader) {
              var _fLdr = findCharByName(fc.leader);
              if (_fLdr) _fLdr.faction = fc.name;
            }
            // 若有 parentFaction，母势力凝聚力下降
            if (fc.parentFaction) {
              var _par = GM.facs.find(function(f){return f.name === fc.parentFaction;});
              if (_par) {
                if (_par.cohesion) _par.cohesion.political = Math.max(0, (_par.cohesion.political||50) - 15);
                _par.strength = Math.max(5, (_par.strength||50) - 10);
                if (!Array.isArray(_par.historicalEvents)) _par.historicalEvents = [];
                _par.historicalEvents.push({ turn: GM.turn, event: fc.name + '脱离', impact: '政治统一度下降' });
              }
            }
            addEB('\u52BF\u529B', '\u3010\u65B0\u52BF\u529B\u7AD6\u8D77\u3011' + fc.name + '\u6210\u7ACB\uFF08' + (fc.type||'') + '\uFF09' + (fc.parentFaction?'\u2014\u2014\u8131\u79BB\u81EA' + fc.parentFaction:'') + (fc.triggerEvent?'\uFF1A' + fc.triggerEvent:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u52BF\u529B\u3011' + fc.name + '\u7AD6\u8D77\u3002' + (fc.reason||''), category: '\u52BF\u529B' });
          });
        }

        // ── 势力覆灭 ──
        if (p1.faction_dissolve && Array.isArray(p1.faction_dissolve) && GM.facs) {
          p1.faction_dissolve.forEach(function(fd) {
            if (!fd || !fd.name) return;
            var fObj = GM.facs.find(function(f){return f.name === fd.name;});
            if (!fObj) return;
            if (fObj.isPlayer) { addEB('势力', '【拒绝】不得在 faction_dissolve 中灭玩家势力'); return; }
            fObj._dissolvedTurn = GM.turn;
            fObj._dissolveCause = fd.cause;
            // 征服者处理
            if (fd.conqueror && (fd.cause === 'conquered' || fd.cause === 'absorbed')) {
              var _con = GM.facs.find(function(f){return f.name === fd.conqueror;});
              if (_con) {
                _con.strength = Math.min(100, (_con.strength||50) + Math.floor((fObj.strength||30) * 0.4));
                if (fObj.militaryStrength) _con.militaryStrength = (_con.militaryStrength||0) + Math.floor(fObj.militaryStrength * 0.3);
                if (!Array.isArray(_con.historicalEvents)) _con.historicalEvents = [];
                _con.historicalEvents.push({ turn: GM.turn, event: '吞并' + fd.name, impact: '国力增强' });
              }
            }
            // 角色处理
            if (GM.chars) {
              GM.chars.filter(function(c){return c.faction === fd.name;}).forEach(function(c) {
                c._formerFaction = fd.name;
                if (fd.cause === 'conquered' || fd.cause === 'absorbed') {
                  c.faction = fd.conqueror || '';
                  c.loyalty = Math.max(0, (c.loyalty||50) - 25);
                  c.stress = Math.min(100, (c.stress||0) + 30);
                } else {
                  c.faction = '';
                }
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c.name, fd.name + '亡国：' + (fd.cause||'') + '——' + (fd.leaderFate||''), '悲', 8);
                }
              });
            }
            // 出逃核心人物
            if (Array.isArray(fd.refugees)) {
              fd.refugees.forEach(function(nm) {
                var _r = findCharByName(nm);
                if (_r) { _r._refugee = true; _r._refugeeTurn = GM.turn; _r.loyalty = Math.max(0, (_r.loyalty||50) - 10); }
              });
            }
            // 从 activeWars 移除相关条目（该势力已灭）
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars = GM.activeWars.filter(function(w) { return w.enemy !== fd.name; });
            }
            // 从 factions 中移除
            GM.facs = GM.facs.filter(function(f){return f.name !== fd.name;});
            // 关系矩阵清理
            if (GM.factionRelationsMap) {
              Object.keys(GM.factionRelationsMap).forEach(function(k) {
                if (k.indexOf(fd.name + '->') === 0 || k.indexOf('->' + fd.name) > 0) delete GM.factionRelationsMap[k];
              });
            }
            var _fcLbl = {conquered:'被征服',absorbed:'被并入',collapsed:'内部崩解',seceded_all:'分崩离析',replaced:'被取代'}[fd.cause] || fd.cause || '覆灭';
            addEB('\u52BF\u529B', '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + (fd.conqueror?'\uFF08\u4E3A' + fd.conqueror + '\u6240\u7EC8\uFF09':'') + (fd.territoryFate?'\uFF0C\u7586\u571F:' + fd.territoryFate:'') + (fd.leaderFate?'\u2014\u2014\u9996\u8111:' + fd.leaderFate:'') + (fd.reason?'\uFF1A' + fd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + '\u3002' + (fd.reason||''), category: '\u52BF\u529B' });
          });
        }

        // ── 阶层兴起 ──
        if (p1.class_emerge && Array.isArray(p1.class_emerge)) {
          if (!Array.isArray(GM.classes)) GM.classes = [];
          p1.class_emerge.forEach(function(ce) {
            if (!ce || !ce.name) return;
            if (GM.classes.some(function(c){return c.name === ce.name;})) return;
            var newC = {
              name: ce.name,
              size: ce.size || '约5%',
              mobility: ce.mobility || '中',
              economicRole: ce.economicRole || '其他',
              status: ce.status || '良民',
              privileges: ce.privileges || '',
              obligations: ce.obligations || '',
              satisfaction: parseInt(ce.satisfaction, 10) || 50,
              influence: parseInt(ce.influence, 10) || 15,
              demands: ce.demands || '',
              unrestThreshold: parseInt(ce.unrestThreshold, 10) || 30,
              representativeNpcs: [],
              leaders: [],
              supportingParties: [],
              regionalVariants: [],
              internalFaction: [],
              unrestLevels: { grievance: 60, petition: 70, strike: 80, revolt: 90 },
              economicIndicators: { wealth: 40, taxBurden: 40, landHolding: 20 },
              description: '【新兴阶层】' + (ce.origin || '') + (ce.reason ? '——' + ce.reason : ''),
              _emergeTurn: GM.turn,
              _origin: ce.origin
            };
            GM.classes.push(newC);
            addEB('\u9636\u5C42', '\u3010\u65B0\u9636\u5C42\u5174\u8D77\u3011' + ce.name + (ce.origin?'\u2014\u2014' + ce.origin:'') + (ce.reason?'\uFF1A' + ce.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u5174\u66BF\u3011' + ce.name + '\u5174\u8D77\u3002' + (ce.reason||''), category: '\u9636\u5C42' });
          });
        }

        // ── 阶层消亡 ──
        if (p1.class_dissolve && Array.isArray(p1.class_dissolve) && GM.classes) {
          p1.class_dissolve.forEach(function(cd) {
            if (!cd || !cd.name) return;
            var cObj = GM.classes.find(function(c){return c.name === cd.name;});
            if (!cObj) return;
            cObj._dissolvedTurn = GM.turn;
            cObj._dissolveCause = cd.cause;
            // 成员流向：character.class 迁移
            if (GM.chars) {
              GM.chars.filter(function(c){return c.class === cd.name;}).forEach(function(c) {
                c._formerClass = cd.name;
                c.class = cd.successorClass || '';
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c.name, cd.name + '消亡：' + (cd.cause||'') + '——' + (cd.membersFate||''), '忧', 6);
                }
              });
            }
            // 依赖该阶层的党派 socialBase 清理
            if (Array.isArray(GM.parties)) {
              GM.parties.forEach(function(p) {
                if (Array.isArray(p.socialBase)) p.socialBase = p.socialBase.filter(function(sb){return sb.class !== cd.name;});
              });
            }
            // 从 classes 移除
            GM.classes = GM.classes.filter(function(c){return c.name !== cd.name;});
            var _ccLbl = {abolished:'被法令废除',assimilated:'被吸收融合',extincted:'衰落消亡',replaced:'被新阶层取代'}[cd.cause] || cd.cause || '消亡';
            addEB('\u9636\u5C42', '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + (cd.successorClass?'\uFF08\u7EE7\u4EFB\uFF1A' + cd.successorClass + '\uFF09':'') + (cd.membersFate?'\u2014\u2014\u6210\u5458:' + cd.membersFate:'') + (cd.reason?'\uFF1A' + cd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + '\u3002' + (cd.reason||''), category: '\u9636\u5C42' });
          });
        }

        // ── 势力关系动态变化 ──
        if (p1.faction_relation_shift && Array.isArray(p1.faction_relation_shift) && GM.factionRelationsMap) {
          p1.faction_relation_shift.forEach(function(rs) {
            if (!rs || !rs.from || !rs.to) return;
            var key1 = rs.from + '->' + rs.to, key2 = rs.to + '->' + rs.from;
            var rel1 = GM.factionRelationsMap[key1] || (GM.factionRelationsMap[key1] = {});
            var rel2 = GM.factionRelationsMap[key2] || (GM.factionRelationsMap[key2] = {});
            var delta = parseFloat(rs.relation_delta) || 0;
            [rel1, rel2].forEach(function(r) {
              if (delta) r.value = Math.max(-100, Math.min(100, (r.value||0) + delta));
              if (rs.new_type) r.type = rs.new_type;
              if (!Array.isArray(r.historicalEvents)) r.historicalEvents = [];
              r.historicalEvents.push({ turn: GM.turn, event: rs.event || rs.reason || '', delta: delta });
              if (r.historicalEvents.length > 20) r.historicalEvents = r.historicalEvents.slice(-20);
            });
            addEB('\u5916\u4EA4', rs.from + '\u2194' + rs.to + ' ' + (rs.new_type||(delta>0?'\u6539\u5584':'\u6076\u5316')) + (rs.event ? '\uFF1A' + rs.event : ''));
          });
        }

        // 处理官制变动（AI可任命/罢免官员）
        if (p1.office_changes && Array.isArray(p1.office_changes) && GM.officeTree) {
          p1.office_changes.forEach(function(oc) {
            if (!oc.dept || !oc.position || !oc.action) return;
            // 遍历官制树查找匹配的部门和职位
            (function walkTree(nodes) {
              nodes.forEach(function(node) {
                if (node.name === oc.dept && node.positions) {
                  node.positions.forEach(function(pos) {
                    if (pos.name === oc.position) {
                      if (oc.action === 'appoint' && oc.person) {
                        var oldHolder = pos.holder || '';
                        // 新模型：把旧 holder 转成占位再把新 holder 填入
                        if (oldHolder && oldHolder !== oc.person && typeof _offDismissPerson === 'function') _offDismissPerson(pos, oldHolder);
                        if (typeof _offAppointPerson === 'function') _offAppointPerson(pos, oc.person);
                        else pos.holder = oc.person;
                        // 记录继任方式到事件（让叙事更准确）
                        var _succDesc = '';
                        if (pos.succession) {
                          var _succMap = {appointment:'\u6D41\u5B98\u4EFB\u547D',hereditary:'\u4E16\u88AD\u7EE7\u4EFB',examination:'\u79D1\u4E3E\u9009\u62D4',military:'\u519B\u529F\u6388\u804C',recommendation:'\u4E3E\u8350\u4EFB\u7528'};
                          _succDesc = _succMap[pos.succession] ? '(\u4EE5' + _succMap[pos.succession] + ')' : '';
                        }
                        addEB('\u4EFB\u547D', oc.person + _succDesc + '\u4EFB' + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
                        var ch = findCharByName(oc.person);
                        if (ch) {
                          ch.loyalty = Math.min(100, (ch.loyalty||50) + 5);
                          ch.officialTitle = oc.position;
                          ch.title = oc.dept + oc.position;
                          // 举主追踪——从reason中提取"由某某举荐"
                          if (oc.reason) {
                            var _jzMatch = (oc.reason||'').match(/由(.{1,6})举荐|(.{1,6})推荐/);
                            if (_jzMatch) {
                              ch._recommendedBy = _jzMatch[1] || _jzMatch[2];
                              ch._recommendTurn = GM.turn;
                            }
                          }
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(oc.person, 'appointment', '\u4EFB' + oc.dept + oc.position);
                          if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
                            CorruptionEngine.markAsRecentAppointment(ch);
                          }
                        }
                        // 清除旧任职者的官职字段
                        if (oldHolder) {
                          var _oldCh = findCharByName(oldHolder);
                          if (_oldCh && _oldCh.officialTitle === oc.position) _oldCh.officialTitle = '';
                        }
                        // 同步PostSystem（如果有对应post）
                        if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts) {
                          var _mp = GM.postSystem.posts.find(function(p) { return p.name === oc.position || p.name === oc.dept + oc.position; });
                          if (_mp && oc.person) PostTransfer.seat(_mp.id, oc.person, 'AI\u63A8\u6F14');
                        }
                        // 同步行政区划governor（如果该官职对应某个行政单位的主官）
                        if (P.adminHierarchy) {
                          (function _syncAdmGov(ah) {
                            var _aks = Object.keys(ah);
                            _aks.forEach(function(k) {
                              if (!ah[k] || !ah[k].divisions) return;
                              (function _walk(divs) {
                                divs.forEach(function(dv) {
                                  if (dv.officialPosition === oc.position && (!dv.governor || dv.governor === oldHolder)) {
                                    dv.governor = oc.person;
                                    if (GM.provinceStats && GM.provinceStats[dv.name]) GM.provinceStats[dv.name].governor = oc.person;
                                  }
                                  if (dv.children) _walk(dv.children);
                                });
                              })(ah[k].divisions);
                            });
                          })(P.adminHierarchy);
                        }
                      } else if (oc.action === 'promote' && pos.holder) {
                        // 晋升——品级提升，可能调任新职
                        if (oc.newRank) pos.rank = oc.newRank;
                        addEB('晋升', pos.holder + '晋升' + (oc.newRank||'') + (oc.reason ? '（' + oc.reason + '）' : ''));
                        var _pch = findCharByName(pos.holder);
                        if (_pch) {
                          _pch.loyalty = Math.min(100, (_pch.loyalty||50) + 8);
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(pos.holder, 'promotion', '晋升' + (oc.newRank||''));
                        }
                        // 如果指定了新职位，执行调任
                        if (oc.newPosition && oc.newDept) {
                          var _transferPerson = pos.holder;
                          pos.holder = ''; // 空出旧位
                          // 查找新职位并任命
                          (function _findNewPos(ns) {
                            ns.forEach(function(nd) {
                              if (nd.name === oc.newDept && nd.positions) {
                                nd.positions.forEach(function(np) {
                                  if (np.name === oc.newPosition) {
                                    // 记录历任
                                    if (!np._history) np._history = [];
                                    if (np.holder) np._history.push({ holder: np.holder, to: GM.turn });
                                    np.holder = _transferPerson;
                                  }
                                });
                              }
                              if (nd.subs) _findNewPos(nd.subs);
                            });
                          })(GM.officeTree);
                        }
                      } else if (oc.action === 'demote' && pos.holder) {
                        if (oc.newRank) pos.rank = oc.newRank;
                        addEB('降级', pos.holder + '降为' + (oc.newRank||'') + (oc.reason ? '（' + oc.reason + '）' : ''));
                        var _dch2 = findCharByName(pos.holder);
                        if (_dch2) {
                          _dch2.loyalty = Math.max(0, (_dch2.loyalty||50) - 8);
                          _dch2.stress = Math.min(100, (_dch2.stress||0) + 10);
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(pos.holder, 'demotion', '降为' + (oc.newRank||''));
                        }
                      } else if (oc.action === 'transfer' && pos.holder && oc.newDept && oc.newPosition) {
                        var _tPerson = pos.holder;
                        // 记录历任
                        if (!pos._history) pos._history = [];
                        pos._history.push({ holder: _tPerson, to: GM.turn });
                        pos.holder = '';
                        addEB('调任', _tPerson + '调任' + oc.newDept + oc.newPosition);
                        // 任命到新位
                        (function _findTP(ns2) {
                          ns2.forEach(function(nd2) {
                            if (nd2.name === oc.newDept && nd2.positions) {
                              nd2.positions.forEach(function(np2) {
                                if (np2.name === oc.newPosition) {
                                  if (!np2._history) np2._history = [];
                                  if (np2.holder) np2._history.push({ holder: np2.holder, to: GM.turn });
                                  np2.holder = _tPerson;
                                }
                              });
                            }
                            if (nd2.subs) _findTP(nd2.subs);
                          });
                        })(GM.officeTree);
                        var _tch = findCharByName(_tPerson);
                        if (_tch) {
                          _tch.officialTitle = oc.newPosition;
                          _tch.title = oc.newDept + oc.newPosition;
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(_tPerson, 'transfer', '调任' + oc.newDept + oc.newPosition);
                        }
                      } else if (oc.action === 'evaluate' && pos.holder && oc.evaluator) {
                        // NPC考评——由负责考察的官员执行（带偏见）
                        if (!pos._evaluations) pos._evaluations = [];
                        pos._evaluations.push({
                          turn: GM.turn, evaluator: oc.evaluator,
                          grade: oc.grade || '平庸', comment: oc.comment || '',
                          holder: pos.holder
                        });
                        if (pos._evaluations.length > 10) pos._evaluations.shift();
                        addEB('考评', oc.evaluator + '考评' + pos.holder + '：' + (oc.grade||'') + (oc.comment ? '（' + oc.comment + '）' : ''));
                        // 考评者记忆
                        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                          NpcMemorySystem.remember(oc.evaluator, '考评' + pos.holder + '为' + oc.dept + oc.position + '：' + (oc.grade||''), '平', 4);
                          NpcMemorySystem.remember(pos.holder, '被' + oc.evaluator + '考评为' + (oc.grade||''), oc.grade === '失职' ? '怨' : '平', 5);
                        }
                        // 举主连坐——失职考评追溯举主
                        if (oc.grade === '失职') {
                          var _evalCh = findCharByName(pos.holder);
                          if (_evalCh && _evalCh._recommendedBy) {
                            addEB('举主连坐', pos.holder + '考评失职，举主' + _evalCh._recommendedBy + '受牵连（举人不当）');
                            if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                              NpcMemorySystem.remember(_evalCh._recommendedBy, '所举荐的' + pos.holder + '被评为失职，本人受"举人不当"之责', '忧', 6);
                            }
                            var _jzCh = findCharByName(_evalCh._recommendedBy);
                            if (_jzCh) {
                              _jzCh.loyalty = Math.max(0, (_jzCh.loyalty||50) - 5);
                              _jzCh.stress = Math.min(100, (_jzCh.stress||0) + 8);
                            }
                          }
                        }
                      } else if (oc.action === 'dismiss') {
                        var dismissed = pos.holder;
                        // 新模型：把该任职者从 actualHolders 移除，留占位
                        if (dismissed && typeof _offDismissPerson === 'function') _offDismissPerson(pos, dismissed);
                        else pos.holder = '';
                        if (dismissed) {
                          addEB('\u7F62\u514D', dismissed + '\u88AB\u514D\u53BB' + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
                          var dch = findCharByName(dismissed);
                          if (dch) {
                            // 致仕（退休）vs 罢免——情绪影响不同
                          var _isRetire = (oc.reason||'').indexOf('\u81F4\u4ED5') >= 0 || (oc.reason||'').indexOf('\u9000\u4F11') >= 0 || (oc.reason||'').indexOf('\u4E5E\u9AB8\u9AA8') >= 0 || (oc.reason||'').indexOf('\u8D50\u91D1\u8FD8\u4E61') >= 0;
                          if (_isRetire) {
                            dch.loyalty = Math.min(100, (dch.loyalty||50) + 5); // 恩准致仕→感恩
                            dch.stress = Math.max(0, (dch.stress||0) - 20); // 卸任减压
                            dch._retired = true;
                            dch._retireTurn = GM.turn;
                            addEB('\u81F4\u4ED5', dismissed + '\u6069\u51C6\u81F4\u4ED5\u5F52\u7530' + (oc.reason ? '（' + oc.reason + '）' : ''));
                          } else {
                            dch.loyalty = Math.max(0, (dch.loyalty||50) - 10);
                            dch.stress = Math.min(100, (dch.stress||0) + 15);
                          }
                          if (dch.officialTitle === oc.position) dch.officialTitle = '';
                          dch.title = _isRetire ? '致仕' : '';
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(dismissed, _isRetire ? 'retirement' : 'dismissal', (_isRetire ? '\u6069\u51C6\u81F4\u4ED5' : '\u88AB\u514D\u53BB') + oc.dept + oc.position + (oc.reason ? '：' + oc.reason : ''));
                          }
                          // 同步PostSystem
                          if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(dismissed);
                          // 同步行政区划：清除被免职者的governor
                          if (P.adminHierarchy) {
                            (function _clearAdmGov(ah) {
                              var _aks2 = Object.keys(ah);
                              _aks2.forEach(function(k) {
                                if (!ah[k] || !ah[k].divisions) return;
                                (function _walk2(divs) {
                                  divs.forEach(function(dv) {
                                    if (dv.governor === dismissed) {
                                      dv.governor = '';
                                      if (GM.provinceStats && GM.provinceStats[dv.name]) GM.provinceStats[dv.name].governor = '';
                                    }
                                    if (dv.children) _walk2(dv.children);
                                  });
                                })(ah[k].divisions);
                              });
                            })(P.adminHierarchy);
                          }
                        }
                      }
                    }
                  });
                }
                if (node.subs) walkTree(node.subs);
              });
            })(GM.officeTree);
            // reform动作——在walkTree之外处理（修改树结构）
            if (oc.action === 'reform' && oc.reformDetail) {
              var _rd = oc.reformDetail;
              if (oc.position && (_rd.indexOf('增设') >= 0 || _rd.indexOf('新设') >= 0)) {
                // 增设官职（在指定部门下）——同时填充老字段与新字段
                (function _addPos(ns) {
                  ns.forEach(function(n) {
                    if (n.name === oc.dept) {
                      if (!n.positions) n.positions = [];
                      var _newPos = {
                        name: oc.position, rank: oc.newRank||'', holder: '', desc: oc.reason||'',
                        headCount: 1, actualCount: 0, additionalHolders: [],
                        establishedCount: 1, vacancyCount: 1, actualHolders: []
                      };
                      n.positions.push(_newPos);
                    }
                    if (n.subs) _addPos(n.subs);
                  });
                })(GM.officeTree);
                addEB('官制改革', oc.dept + '增设' + oc.position + (oc.reason ? '（' + oc.reason + '）' : ''));
              } else if (!oc.position && (_rd.indexOf('增设') >= 0 || _rd.indexOf('新设') >= 0)) {
                // 增设部门
                if (oc.newDept) {
                  // 增设为某部门的下属
                  (function _addSub(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.dept) {
                        if (!n.subs) n.subs = [];
                        n.subs.push({ name: oc.newDept, desc: oc.reason||'', positions: [], subs: [], functions: [] });
                      }
                      if (n.subs) _addSub(n.subs);
                    });
                  })(GM.officeTree);
                  addEB('官制改革', oc.dept + '下增设' + oc.newDept);
                } else {
                  // 增设顶层部门
                  var _newName = oc.dept || '新设部门';
                  GM.officeTree.push({ name: _newName, desc: oc.reason||'', positions: [], subs: [], functions: [] });
                  addEB('官制改革', '增设' + _newName + (oc.reason ? '（' + oc.reason + '）' : ''));
                }
              } else if (_rd.indexOf('裁撤') >= 0 || _rd.indexOf('废除') >= 0) {
                if (oc.position) {
                  // 裁撤官职
                  (function _delPos(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.dept && n.positions) {
                        var _dismissed = n.positions.filter(function(p){ return p.name === oc.position && p.holder; });
                        _dismissed.forEach(function(p) {
                          var dch = findCharByName(p.holder);
                          if (dch) { dch.officialTitle = ''; dch.title = ''; }
                        });
                        n.positions = n.positions.filter(function(p) { return p.name !== oc.position; });
                      }
                      if (n.subs) _delPos(n.subs);
                    });
                  })(GM.officeTree);
                  addEB('官制改革', '裁撤' + oc.dept + oc.position);
                } else {
                  // 裁撤部门
                  GM.officeTree = GM.officeTree.filter(function(d) { return d.name !== oc.dept; });
                  (function _delSub(ns) { ns.forEach(function(n) { if (n.subs) { n.subs = n.subs.filter(function(s) { return s.name !== oc.dept; }); _delSub(n.subs); } }); })(GM.officeTree);
                  addEB('官制改革', '裁撤' + oc.dept + (oc.reason ? '（' + oc.reason + '）' : ''));
                }
              } else if (_rd.indexOf('改名') >= 0 || _rd.indexOf('更名') >= 0) {
                (function _rename(ns) { ns.forEach(function(n) { if (n.name === oc.dept && oc.newDept) n.name = oc.newDept; if (n.subs) _rename(n.subs); }); })(GM.officeTree);
                addEB('官制改革', oc.dept + '更名为' + (oc.newDept||''));
              } else if (_rd.indexOf('合并') >= 0) {
                // 合并：将oc.dept合并入oc.newDept（职位转移）
                var _srcDept = null;
                (function _findSrc(ns) { ns.forEach(function(n) { if (n.name === oc.dept) _srcDept = n; if (n.subs) _findSrc(n.subs); }); })(GM.officeTree);
                if (_srcDept) {
                  (function _findDst(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.newDept) {
                        if (!n.positions) n.positions = [];
                        (_srcDept.positions||[]).forEach(function(p) { n.positions.push(p); });
                        if (!n.subs) n.subs = [];
                        (_srcDept.subs||[]).forEach(function(s) { n.subs.push(s); });
                      }
                      if (n.subs) _findDst(n.subs);
                    });
                  })(GM.officeTree);
                  // 删除源部门
                  GM.officeTree = GM.officeTree.filter(function(d) { return d.name !== oc.dept; });
                  (function _delMerged(ns) { ns.forEach(function(n) { if (n.subs) { n.subs = n.subs.filter(function(s) { return s.name !== oc.dept; }); _delMerged(n.subs); } }); })(GM.officeTree);
                  addEB('官制改革', oc.dept + '并入' + oc.newDept);
                }
              } else if (_rd.indexOf('拆分') >= 0 && Array.isArray(oc.splitInto) && oc.splitInto.length > 0) {
                // 拆分：将 oc.dept 按 splitInto 分成多个新部门；原部门的 positions 按 splitInto 指定的 positions 分配
                var _splitSrc = null, _splitParent = null;
                (function _findSp(ns, parent) {
                  ns.forEach(function(n) {
                    if (n.name === oc.dept) { _splitSrc = n; _splitParent = parent; }
                    if (n.subs) _findSp(n.subs, n);
                  });
                })(GM.officeTree, null);
                if (_splitSrc) {
                  var _splitSiblings = _splitParent ? _splitParent.subs : GM.officeTree;
                  var _srcIdx = _splitSiblings.indexOf(_splitSrc);
                  var _newDepts = oc.splitInto.map(function(info) {
                    var posList = Array.isArray(info.positions) ? info.positions : [];
                    // 从源部门摘取匹配 positions（按 name）
                    var takenPos = [];
                    posList.forEach(function(pn) {
                      var pname = typeof pn === 'string' ? pn : (pn && pn.name);
                      if (!pname) return;
                      var idx = (_splitSrc.positions||[]).findIndex(function(p){return p.name===pname;});
                      if (idx >= 0) { takenPos.push(_splitSrc.positions[idx]); _splitSrc.positions.splice(idx,1); }
                    });
                    return { name: info.name || '新部门', desc: info.desc || '', positions: takenPos, subs: [], functions: info.functions || [] };
                  });
                  // 未分配的 positions 追加到第一个新部门
                  if (_splitSrc.positions && _splitSrc.positions.length > 0 && _newDepts.length > 0) {
                    _newDepts[0].positions = _newDepts[0].positions.concat(_splitSrc.positions);
                  }
                  // 替换：移除原部门，插入新部门
                  _splitSiblings.splice.apply(_splitSiblings, [_srcIdx, 1].concat(_newDepts));
                  addEB('官制改革', oc.dept + '拆分为' + _newDepts.map(function(d){return d.name;}).join('、'));
                }
              } else if (_rd.indexOf('改制') >= 0 && Array.isArray(oc.restructurePlan) && oc.restructurePlan.length > 0) {
                // 改制：执行一揽子原子动作，每项是一个 reform 子命令 {action, dept, position, newDept, ...}
                var _restructureCount = 0;
                oc.restructurePlan.forEach(function(atom) {
                  if (!atom || !atom.action) return;
                  var subOC = {
                    dept: atom.dept, position: atom.position,
                    newDept: atom.newDept, newPosition: atom.newPosition,
                    newRank: atom.newRank,
                    reason: atom.reason || oc.reason || '改制',
                    action: 'reform',
                    reformDetail: atom.action,
                    splitInto: atom.splitInto,
                    intoDept: atom.intoDept
                  };
                  // 复用本分支处理逻辑——简化起见用 addEB 日志（实际结构变更依赖下一 oc 迭代）
                  // 直接调用自身分支不方便，这里做常见原子动作的内联处理
                  if (atom.action === '增设' && subOC.position && subOC.dept) {
                    (function _ap(ns) { ns.forEach(function(n) {
                      if (n.name === subOC.dept) {
                        if (!n.positions) n.positions = [];
                        n.positions.push({
                          name: subOC.position, rank: subOC.newRank||'', holder: '', desc: subOC.reason||'',
                          headCount: 1, actualCount: 0, additionalHolders: [],
                          establishedCount: 1, vacancyCount: 1, actualHolders: []
                        });
                      }
                      if (n.subs) _ap(n.subs);
                    }); })(GM.officeTree);
                    _restructureCount++;
                  } else if (atom.action === '裁撤' && subOC.position && subOC.dept) {
                    (function _dp(ns) { ns.forEach(function(n) { if (n.name === subOC.dept && n.positions) n.positions = n.positions.filter(function(p) { return p.name !== subOC.position; }); if (n.subs) _dp(n.subs); }); })(GM.officeTree);
                    _restructureCount++;
                  } else if (atom.action === '改名' && subOC.dept && subOC.newDept) {
                    (function _rn(ns) { ns.forEach(function(n) { if (n.name === subOC.dept) n.name = subOC.newDept; if (n.subs) _rn(n.subs); }); })(GM.officeTree);
                    _restructureCount++;
                  }
                });
                addEB('官制改革', '【改制】' + (oc.reason||'') + '——执行' + _restructureCount + '项原子变更');
              }
              _dbg('[office_reform] ' + _rd + ' ' + (oc.dept||''));
            }
            // 任命/免职时记录历任
            if ((oc.action === 'appoint' || oc.action === 'dismiss') && oc.dept && oc.position) {
              (function _recHistory(ns) {
                ns.forEach(function(n) {
                  if (n.name === oc.dept && n.positions) {
                    n.positions.forEach(function(p) {
                      if (p.name === oc.position) {
                        if (!p._history) p._history = [];
                        if (oc.action === 'dismiss' && oc.person) {
                          p._history.push({ holder: oc.person, to: GM.turn, reason: oc.reason||'' });
                        } else if (oc.action === 'appoint' && oc.person) {
                          p._history.push({ holder: oc.person, from: GM.turn });
                        }
                        if (p._history.length > 20) p._history = p._history.slice(-20);
                      }
                    });
                  }
                  if (n.subs) _recHistory(n.subs);
                });
              })(GM.officeTree);
            }
          });
        }

        // 处理部门聚合事件（双层模型）
        if (p1.office_aggregate && Array.isArray(p1.office_aggregate) && GM.officeTree) {
          p1.office_aggregate.forEach(function(oa) {
            if (!oa.dept) return;
            // 找到对应部门
            var _targetDept = null;
            (function _fd(ns) { ns.forEach(function(n) { if (n.name === oa.dept) _targetDept = n; if (n.subs) _fd(n.subs); }); })(GM.officeTree);
            if (!_targetDept) return;
            // actualCount变动（递补/离职）
            if (oa.actualCount_delta) {
              var delta = parseInt(oa.actualCount_delta) || 0;
              // 分摊到各职位的actualCount
              (_targetDept.positions||[]).forEach(function(p) {
                if (typeof _offMigratePosition === 'function') _offMigratePosition(p);
                if (delta > 0 && (p.actualCount||0) < (p.headCount||1)) {
                  var canAdd = Math.min(delta, (p.headCount||1) - (p.actualCount||0));
                  p.actualCount = (p.actualCount||0) + canAdd;
                  // 新模型同步：递补增加占位，减少 vacancyCount
                  if (!Array.isArray(p.actualHolders)) p.actualHolders = [];
                  for (var _ai = 0; _ai < canAdd; _ai++) {
                    p.actualHolders.push({ name:'', generated:false, placeholderId:'ph_'+Math.random().toString(36).slice(2,8), filledTurn: GM.turn });
                  }
                  p.vacancyCount = Math.max(0, (p.establishedCount||p.headCount||1) - p.actualCount);
                  delta -= canAdd;
                } else if (delta < 0 && (p.actualCount||0) > _offMaterializedCount(p)) {
                  var canRemove = Math.min(-delta, (p.actualCount||0) - _offMaterializedCount(p));
                  p.actualCount = (p.actualCount||0) - canRemove;
                  // 新模型同步：移除占位（仅 generated:false 的），增加 vacancyCount
                  if (Array.isArray(p.actualHolders)) {
                    for (var _ri = 0; _ri < canRemove; _ri++) {
                      var _phIdx = p.actualHolders.findIndex(function(h){return h && h.generated===false;});
                      if (_phIdx >= 0) p.actualHolders.splice(_phIdx, 1);
                    }
                  }
                  p.vacancyCount = Math.max(0, (p.establishedCount||p.headCount||1) - p.actualCount);
                  delta += canRemove;
                }
              });
              if (delta > 0) addEB('官制', oa.dept + '递补' + delta + '人');
              else if (delta < 0) addEB('官制', oa.dept + '减员' + Math.abs(delta) + '人');
            }
            // 考评摘要（存入部门级别）
            if (oa.evaluation_summary) {
              if (!_targetDept._evalHistory) _targetDept._evalHistory = [];
              _targetDept._evalHistory.push({ turn: GM.turn, summary: oa.evaluation_summary });
              if (_targetDept._evalHistory.length > 5) _targetDept._evalHistory.shift();
              // 具象角色的考评同步到position._evaluations
              var _namedAll = [].concat(oa.evaluation_summary.named_excellent||[], oa.evaluation_summary.named_good||[], oa.evaluation_summary.named_average||[], oa.evaluation_summary.named_poor||[]);
              _namedAll.forEach(function(name) {
                var _grade = (oa.evaluation_summary.named_excellent||[]).indexOf(name) >= 0 ? '卓越' :
                             (oa.evaluation_summary.named_good||[]).indexOf(name) >= 0 ? '称职' :
                             (oa.evaluation_summary.named_poor||[]).indexOf(name) >= 0 ? '失职' : '平庸';
                (_targetDept.positions||[]).forEach(function(p) {
                  if (p.holder === name || (p.additionalHolders||[]).indexOf(name) >= 0) {
                    if (!p._evaluations) p._evaluations = [];
                    p._evaluations.push({ turn: GM.turn, evaluator: '有司', grade: _grade, comment: '', holder: name });
                  }
                });
              });
              if (oa.narrative) addEB('考评', oa.narrative);
            }
            // 贪腐查处
            if (oa.corruption_found) {
              addEB('吏治', oa.dept + '查出' + oa.corruption_found + '人贪腐' + ((oa.named_corrupt||[]).length > 0 ? '（' + oa.named_corrupt.join('、') + '等）' : ''));
            }
          });
        }

        // 处理封臣关系变动（AI新通道）
        if (p1.vassal_changes && Array.isArray(p1.vassal_changes)) {
          p1.vassal_changes.forEach(function(vc) {
            if (!vc.action) return;
            if (vc.action === 'establish' && vc.vassal && vc.liege) {
              if (typeof establishVassalage === 'function') {
                var ok = establishVassalage(vc.vassal, vc.liege);
                if (ok) {
                  if (vc.tributeRate !== undefined) {
                    var _vFac = GM._indices.facByName ? GM._indices.facByName.get(vc.vassal) : null;
                    if (_vFac) _vFac.tributeRate = clamp(parseFloat(vc.tributeRate) || 0.3, 0.05, 0.8);
                  }
                  addEB('\u5C01\u81E3', vc.vassal + '\u6210\u4E3A' + vc.liege + '\u7684\u5C01\u81E3' + (vc.reason ? '(' + vc.reason + ')' : ''));
                }
              }
            } else if (vc.action === 'break' && vc.vassal) {
              if (typeof breakVassalage === 'function') {
                var ok2 = breakVassalage(vc.vassal);
                if (ok2) addEB('\u5C01\u81E3', vc.vassal + '\u8131\u79BB\u5C01\u81E3\u5173\u7CFB' + (vc.reason ? '(' + vc.reason + ')' : ''));
              }
            } else if (vc.action === 'change_tribute' && vc.vassal && vc.tributeRate !== undefined) {
              var _vf = GM._indices.facByName ? GM._indices.facByName.get(vc.vassal) : null;
              if (_vf && _vf.liege) {
                var oldRate = _vf.tributeRate || 0.3;
                _vf.tributeRate = clamp(parseFloat(vc.tributeRate) || 0.3, 0.05, 0.8);
                addEB('\u5C01\u81E3', vc.vassal + '\u8D21\u8D4B\u6BD4\u4F8B\u8C03\u6574\uFF1A' + Math.round(oldRate*100) + '%\u2192' + Math.round(_vf.tributeRate*100) + '%' + (vc.reason ? '(' + vc.reason + ')' : ''));
              }
            }
          });
        }

        // 处理头衔爵位变动（AI新通道）
        if (p1.title_changes && Array.isArray(p1.title_changes)) {
          p1.title_changes.forEach(function(tc) {
            if (!tc.action || !tc.character) return;
            var _tch = findCharByName(tc.character);
            if (!_tch) return;
            if (!_tch.titles) _tch.titles = [];

            if (tc.action === 'grant') {
              // 册封头衔
              var _tName = tc.titleName || '';
              var _tLevel = parseInt(tc.titleLevel) || 5;
              var _existing = _tch.titles.find(function(t) { return t.name === _tName; });
              if (!_existing && _tName) {
                _tch.titles.push({
                  name: _tName, level: _tLevel,
                  hereditary: tc.hereditary || false,
                  grantedTurn: GM.turn, grantedBy: tc.grantedBy || '\u671D\u5EF7',
                  privileges: tc.privileges || [], _suppressed: []
                });
                addEB('\u518C\u5C01', tc.character + '\u88AB\u518C\u5C01\u4E3A' + _tName + (tc.reason ? '(' + tc.reason + ')' : ''));
                if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_grant', '\u518C\u5C01' + _tName);
                _tch.loyalty = Math.min(100, (_tch.loyalty || 50) + 5);
              }
            } else if (tc.action === 'revoke') {
              // 剥夺头衔
              var _tIdx = _tch.titles.findIndex(function(t) { return t.name === (tc.titleName || ''); });
              if (_tIdx !== -1) {
                var _removed = _tch.titles.splice(_tIdx, 1)[0];
                addEB('\u964D\u7235', tc.character + '\u7684' + _removed.name + '\u5934\u8854\u88AB\u5265\u593A' + (tc.reason ? '(' + tc.reason + ')' : ''));
                if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_revoke', '\u88AB\u593A' + _removed.name);
                _tch.loyalty = Math.max(0, (_tch.loyalty || 50) - 15);
                _tch.stress = Math.min(100, (_tch.stress || 0) + 10);
              }
            } else if (tc.action === 'promote') {
              // 晋升头衔（移除旧最高，授予新的更高头衔）
              var _tName2 = tc.titleName || '';
              var _tLevel2 = parseInt(tc.titleLevel) || 3;
              // 移除同类型的旧头衔（等级更低的）
              _tch.titles = _tch.titles.filter(function(t) { return t.level <= _tLevel2; });
              _tch.titles.push({
                name: _tName2, level: _tLevel2,
                hereditary: tc.hereditary || false,
                grantedTurn: GM.turn, grantedBy: '\u671D\u5EF7',
                privileges: tc.privileges || [], _suppressed: []
              });
              addEB('\u664B\u7235', tc.character + '\u664B\u5347\u4E3A' + _tName2 + (tc.reason ? '(' + tc.reason + ')' : ''));
              if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_promote', '\u664B\u5347' + _tName2);
              _tch.loyalty = Math.min(100, (_tch.loyalty || 50) + 3);
            } else if (tc.action === 'inherit' && tc.from) {
              // 继承头衔
              var _deceased = findCharByName(tc.from);
              if (_deceased && _deceased.titles) {
                var _iTitle = _deceased.titles.find(function(t) { return t.name === (tc.titleName || ''); });
                if (_iTitle && (_iTitle.hereditary || (GM.eraState && (GM.eraState.centralControl || 0.5) < 0.5))) {
                  _tch.titles.push({
                    name: _iTitle.name, level: _iTitle.level,
                    hereditary: _iTitle.hereditary,
                    grantedTurn: GM.turn, grantedBy: tc.from + '(\u7EE7\u627F)',
                    privileges: _iTitle.privileges || [], _suppressed: _iTitle._suppressed || []
                  });
                  addEB('\u7EE7\u627F', tc.character + '\u7EE7\u627F\u4E86' + tc.from + '\u7684' + _iTitle.name + '\u5934\u8854');
                }
              }
            }
          });
        }

        // 处理建筑变动（AI新通道）
        if (p1.building_changes && Array.isArray(p1.building_changes)) {
          // 确保GM建筑数据结构存在
          if (!GM.buildings) GM.buildings = [];
          if (!GM._indices) GM._indices = {};
          if (!GM._indices.buildingById) GM._indices.buildingById = new Map();
          if (!GM._indices.buildingByTerritory) GM._indices.buildingByTerritory = new Map();

          p1.building_changes.forEach(function(bc) {
            if (!bc.action || !bc.territory) return;

            // 同步写入 adminHierarchy 的 division.buildings（新模式——去结构化，由AI自判效果）
            if (bc.action === 'build' || bc.action === 'custom_build' || bc.action === 'upgrade' || bc.action === 'destroy') {
              if (P.adminHierarchy) {
                var _targetDiv = null;
                Object.keys(P.adminHierarchy).forEach(function(fk) {
                  var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
                  (function _walk(ds) {
                    ds.forEach(function(d) {
                      if (d.name === bc.territory) _targetDiv = d;
                      if (d.children) _walk(d.children);
                      if (d.divisions) _walk(d.divisions);
                    });
                  })(fh.divisions);
                });
                if (_targetDiv) {
                  if (!_targetDiv.buildings) _targetDiv.buildings = [];
                  if (bc.action === 'destroy') {
                    _targetDiv.buildings = _targetDiv.buildings.filter(function(b) { return b.name !== bc.type; });
                    addEB('\u5EFA\u8BBE', bc.territory + '拆除 ' + bc.type);
                  } else if (bc.action === 'upgrade') {
                    var _exB = _targetDiv.buildings.find(function(b) { return b.name === bc.type; });
                    if (_exB) {
                      _exB.level = (_exB.level || 1) + 1;
                      addEB('\u5EFA\u8BBE', bc.territory + '的' + bc.type + '升级至' + _exB.level + '级');
                    }
                  } else {
                    // build 或 custom_build
                    var _isCustom = bc.action === 'custom_build' || bc.isCustom;
                    var _feasibility = bc.feasibility || '合理';
                    if (_feasibility === '不合理') {
                      addEB('\u5EFA\u8BBE', bc.territory + '拟建 ' + bc.type + ' 因不合理未能实施');
                    } else {
                      _targetDiv.buildings.push({
                        name: bc.type,
                        level: bc.level || 1,
                        isCustom: _isCustom,
                        description: bc.description || '',
                        judgedEffects: bc.judgedEffects || '',
                        costActual: bc.costActual || null,
                        timeActual: bc.timeActual || null,
                        status: (bc.timeActual && bc.timeActual > 0) ? 'building' : 'completed',
                        remainingTurns: bc.timeActual || 0,
                        startTurn: GM.turn
                      });
                      addEB('\u5EFA\u8BBE', bc.territory + (_isCustom?'自定义建造 ':'建造 ') + bc.type + (_feasibility!=='合理'?('('+_feasibility+')'):'') + (bc.reason?' —— '+bc.reason:''));
                    }
                  }
                }
              }
            }

            // 以下为旧版本的 BUILDING_TYPES/GM.buildings 逻辑（保留兼容）
            // 支持中文建筑名匹配到type key
            var _bcType = (bc.type || '').replace(/\s/g, '_').toLowerCase();
            if (!_bcType) return;
            // 如果type是中文名，尝试从BUILDING_TYPES反查key
            if (typeof BUILDING_TYPES !== 'undefined') {
              var _btKeys = Object.keys(BUILDING_TYPES);
              for (var _bk = 0; _bk < _btKeys.length; _bk++) {
                if (BUILDING_TYPES[_btKeys[_bk]].name === bc.type) { _bcType = _btKeys[_bk]; break; }
              }
            }

            if (bc.action === 'build' && _bcType) {
              if (typeof createBuilding === 'function') {
                // 推断势力归属
                var _bFaction = bc.faction || '';
                if (!_bFaction && GM.facs) {
                  var _ownerFac = GM.facs.find(function(f) { return f.territories && f.territories.indexOf(bc.territory) !== -1; });
                  if (_ownerFac) _bFaction = _ownerFac.name;
                }
                var _newB = createBuilding(_bcType, bc.level || 1, _bFaction, bc.territory);
                GM.buildings.push(_newB);
                GM._indices.buildingById.set(_newB.id, _newB);
                if (!GM._indices.buildingByTerritory.has(bc.territory)) GM._indices.buildingByTerritory.set(bc.territory, []);
                GM._indices.buildingByTerritory.get(bc.territory).push(_newB);
                addEB('\u5EFA\u8BBE', bc.territory + '\u5EFA\u9020\u4E86' + _newB.name + (bc.reason ? '(' + bc.reason + ')' : ''));
              }
            } else if (bc.action === 'upgrade' && _bcType) {
              // 升级建筑
              var _bList = GM._indices.buildingByTerritory ? GM._indices.buildingByTerritory.get(bc.territory) : null;
              if (_bList) {
                var _bMatch = _bList.find(function(b) { return b.type === _bcType; });
                if (_bMatch) {
                  var _btInfo = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES[_bcType] : null;
                  var _maxLv = (_btInfo && _btInfo.maxLevel) || 5;
                  if (_bMatch.level < _maxLv) {
                    _bMatch.level++;
                    if (typeof getBuildingEffects === 'function') _bMatch.effects = getBuildingEffects(_bcType, _bMatch.level);
                    addEB('\u5EFA\u8BBE', bc.territory + '\u7684' + _bMatch.name + '\u5347\u7EA7\u81F3' + _bMatch.level + '\u7EA7' + (bc.reason ? '(' + bc.reason + ')' : ''));
                  }
                }
              }
            } else if (bc.action === 'destroy' && _bcType) {
              // 拆除建筑
              var _bList2 = GM._indices.buildingByTerritory ? GM._indices.buildingByTerritory.get(bc.territory) : null;
              if (_bList2) {
                var _bIdx = _bList2.findIndex(function(b) { return b.type === _bcType; });
                if (_bIdx !== -1) {
                  var _removed = _bList2.splice(_bIdx, 1)[0];
                  if (GM.buildings) GM.buildings = GM.buildings.filter(function(b) { return b.id !== _removed.id; });
                  if (GM._indices.buildingById) GM._indices.buildingById.delete(_removed.id);
                  addEB('\u5EFA\u8BBE', bc.territory + '\u7684' + _removed.name + '\u88AB\u62C6\u9664' + (bc.reason ? '(' + bc.reason + ')' : ''));
                }
              }
            }
          });
        }

        // 处理行政区划变动（AI新通道）
        if (p1.admin_changes && Array.isArray(p1.admin_changes) && P.adminHierarchy) {
          p1.admin_changes.forEach(function(ac) {
            if (!ac.action || !ac.division) return;

            // 在行政区划树中查找目标节点
            var _targetDiv = null;
            function _findDiv(divs) {
              for (var i = 0; i < divs.length; i++) {
                if (divs[i].name === ac.division) { _targetDiv = divs[i]; return; }
                if (divs[i].children) _findDiv(divs[i].children);
              }
            }
            var _adminKeys = Object.keys(P.adminHierarchy);
            for (var _ak = 0; _ak < _adminKeys.length; _ak++) {
              var _ah = P.adminHierarchy[_adminKeys[_ak]];
              if (_ah && _ah.divisions) _findDiv(_ah.divisions);
              if (_targetDiv) break;
            }

            if (!_targetDiv) return;

            if (ac.action === 'appoint_governor' && ac.person) {
              var oldGov = _targetDiv.governor || '';
              _targetDiv.governor = ac.person;
              addEB('\u4EFB\u547D', ac.person + '\u88AB\u4EFB\u547D\u4E3A' + ac.division + '\u4E3B\u5B98' + (ac.reason ? '(' + ac.reason + ')' : ''));
              var _govCh = findCharByName(ac.person);
              if (_govCh) _govCh.loyalty = Math.min(100, (_govCh.loyalty || 50) + 3);
              // 同步到officeTree：如果该行政单位有officialPosition，同步到对应position.holder
              if (_targetDiv.officialPosition && GM.officeTree) {
                (function _syncOffPos(nodes) {
                  nodes.forEach(function(nd) {
                    if (nd.positions) {
                      nd.positions.forEach(function(p) {
                        if (p.name === _targetDiv.officialPosition && (!p.holder || p.holder === oldGov)) {
                          p.holder = ac.person;
                        }
                      });
                    }
                    if (nd.subs) _syncOffPos(nd.subs);
                  });
                })(GM.officeTree);
              }
            } else if (ac.action === 'remove_governor') {
              var _removedGov = _targetDiv.governor;
              _targetDiv.governor = '';
              if (_removedGov) {
                addEB('\u7F62\u514D', _removedGov + '\u88AB\u514D\u53BB' + ac.division + '\u4E3B\u5B98' + (ac.reason ? '(' + ac.reason + ')' : ''));
                var _rCh = findCharByName(_removedGov);
                if (_rCh) { _rCh.loyalty = Math.max(0, (_rCh.loyalty || 50) - 8); _rCh.stress = Math.min(100, (_rCh.stress || 0) + 10); }
                // 同步清除officeTree中的holder
                if (_targetDiv.officialPosition && GM.officeTree) {
                  (function _clrOffPos(nodes) {
                    nodes.forEach(function(nd) {
                      if (nd.positions) nd.positions.forEach(function(p) { if (p.name === _targetDiv.officialPosition && p.holder === _removedGov) p.holder = ''; });
                      if (nd.subs) _clrOffPos(nd.subs);
                    });
                  })(GM.officeTree);
                }
              }
            } else if (ac.action === 'adjust') {
              addEB('\u5730\u65B9', ac.division + ': ' + (ac.reason || '\u5730\u65B9\u5B98\u6CBB\u7406'));
            }

            // delta字段统一处理（所有action类型都可附带）
            if (ac.prosperity_delta) {
              _targetDiv.prosperity = clamp((_targetDiv.prosperity || 50) + clamp(parseInt(ac.prosperity_delta) || 0, -20, 20), 0, 100);
            }
            if (ac.population_delta) {
              _targetDiv.population = Math.max(0, (_targetDiv.population || 50000) + clamp(parseInt(ac.population_delta) || 0, -50000, 50000));
            }

            // 同步到地方区划
            if (GM.provinceStats && GM.provinceStats[ac.division]) {
              var _ps = GM.provinceStats[ac.division];
              if (_targetDiv.governor !== undefined) _ps.governor = _targetDiv.governor;
              if (_targetDiv.prosperity !== undefined) _ps.wealth = _targetDiv.prosperity;
              if (_targetDiv.population !== undefined) _ps.population = _targetDiv.population;
              if (ac.corruption_delta) _ps.corruption = clamp((_ps.corruption || 0) + clamp(parseInt(ac.corruption_delta) || 0, -20, 20), 0, 100);
              if (ac.stability_delta) _ps.stability = clamp((_ps.stability || 50) + clamp(parseInt(ac.stability_delta) || 0, -20, 20), 0, 100);
              if (ac.unrest_delta) _ps.unrest = clamp((_ps.unrest || 0) + clamp(parseInt(ac.unrest_delta) || 0, -20, 20), 0, 100);
            }
          });
        }

        // 处理中国化管辖层级变更（封建/削藩/改土归流等）
        if (p1.autonomy_changes && Array.isArray(p1.autonomy_changes) && P.adminHierarchy) {
          p1.autonomy_changes.forEach(function(ac) {
            if (!ac || !ac.action || !ac.division) return;
            // 查找区划
            var _targetAutDiv = null;
            Object.keys(P.adminHierarchy).forEach(function(fk) {
              var fh = P.adminHierarchy[fk];
              if (!fh || !fh.divisions) return;
              (function _w(ds) {
                ds.forEach(function(d) { if (d.name === ac.division) _targetAutDiv = d; if (d.divisions) _w(d.divisions); });
              })(fh.divisions);
            });
            if (!_targetAutDiv) return;
            // 按动作分支
            if (ac.action === 'enfeoff_prince' || ac.action === 'enfeoff_duke') {
              _targetAutDiv.autonomy = {
                type: 'fanguo',
                subtype: ac.subtype || (ac.action === 'enfeoff_prince' ? 'real' : 'nominal'),
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 80,
                tributeRate: ac.tributeRate || (ac.subtype === 'real' ? 0.5 : 0.15),
                grantedTurn: GM.turn
              };
              addEB('\u518C\u5C01', (ac.holder || '某人') + ' 受封为' + (ac.titleName || '王') + '，封地 ' + ac.division);
              // NPC 记忆：受封者感恩
              if (ac.holder && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(ac.holder, '受封' + (ac.titleName || '王') + '于' + ac.division + '，皇恩浩荡', '喜', 8);
              }
            } else if (ac.action === 'enfeoff_tusi') {
              _targetAutDiv.autonomy = {
                type: 'jimi', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '宣慰使',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 70,
                tributeRate: ac.tributeRate || 0.1
              };
              addEB('\u6388\u7F81\u7E3B', (ac.holder || '某部') + ' 授' + (ac.titleName || '宣慰使') + '，镇守 ' + ac.division);
            } else if (ac.action === 'invest_tributary') {
              _targetAutDiv.autonomy = {
                type: 'chaogong', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 60,
                tributeRate: ac.tributeRate || 0.05
              };
              addEB('\u518C\u5C01\u5C5E\u56FD', (ac.holder || '某国') + ' 受册为属国，朝贡 ' + ac.division);
            } else if (ac.action === 'establish_fanzhen') {
              _targetAutDiv.autonomy = {
                type: 'fanzhen', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '节度使',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 50,
                tributeRate: ac.tributeRate || 0.1
              };
              addEB('\u8BBE\u7F6E\u85E9\u9547', (ac.holder || '') + ' 任' + (ac.titleName || '节度使') + '，镇守 ' + ac.division);
            } else if (ac.action === 'grace_edict') {
              // 推恩令——分封子弟后逐代分薄
              if (_targetAutDiv.autonomy) {
                _targetAutDiv.autonomy.gracePartitions = (_targetAutDiv.autonomy.gracePartitions || 0) + 1;
                var _holder = _targetAutDiv.autonomy.holder;
                if (_targetAutDiv.autonomy.gracePartitions >= 5) {
                  // 五代后自动回收
                  _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
                  addEB('\u63A8\u6069\u4EE4', ac.division + ' 五代分封完毕，自然回归直辖');
                } else {
                  // 削弱藩王实力
                  _targetAutDiv.autonomy.loyalty = Math.min(100, (_targetAutDiv.autonomy.loyalty || 70) + 5);
                  _targetAutDiv.autonomy.tributeRate = Math.max(0.05, (_targetAutDiv.autonomy.tributeRate || 0.3) - 0.05);
                  addEB('\u63A8\u6069\u4EE4', ac.division + ' 行推恩（第' + _targetAutDiv.autonomy.gracePartitions + '代），藩权逐代分薄');
                }
                // NPC记忆：持爵者忧虑
                if (_holder && typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(_holder, '朝廷行推恩令于 ' + ac.division + '，宗业渐分于子孙，藩权日薄', '忧', 6);
                }
              }
            } else if (ac.action === 'abolish_fief') {
              // 削藩——直接回收，引发忠诚暴跌
              var _hld = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u524A\u85E9', '回收' + _hld + '之封地 ' + ac.division + '，改为直辖');
              // 如果该 holder 对应一个势力，忠诚度暴跌 + 初始化 rebellionRisk
              var _hldFac = (GM.facs || []).find(function(f) { return f.name === _hld; });
              if (_hldFac) {
                _hldFac.loyaltyToLiege = Math.max(0, (_hldFac.loyaltyToLiege !== undefined ? _hldFac.loyaltyToLiege : 60) - 40);
                _hldFac.rebellionRisk = Math.min(100, (_hldFac.rebellionRisk !== undefined ? _hldFac.rebellionRisk : 20) + 40);
              }
              // 持爵者 NPC 本人记仇
              var _hldChar = GM._indices && GM._indices.charByName ? GM._indices.charByName.get(_hld) : null;
              if (_hldChar && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_hld, '封地' + ac.division + '被朝廷削夺，宗业尽失', '恨', 10);
                if (_hldChar.loyalty !== undefined) _hldChar.loyalty = Math.max(0, _hldChar.loyalty - 30);
                if (_hldChar.ambition !== undefined) _hldChar.ambition = Math.min(100, (_hldChar.ambition||50) + 20);
              }
            } else if (ac.action === 'tusi_to_liuguan') {
              // 改土归流
              var _oldTusi = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u6539\u571F\u5F52\u6D41', ac.division + ' 改土归流，设流官');
              if (_oldTusi && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_oldTusi, '祖传土司之位被改流官夺去，族人散失', '恨', 9);
              }
            } else if (ac.action === 'conquer_as_prefecture') {
              // 征讨设郡
              var _oldKing = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u5F81\u4F10\u8BBE\u90E1', '征讨' + ac.division + '，于其地置郡');
              if (_oldKing && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_oldKing, '国破家亡，宗社沦丧于 ' + ac.division, '恨', 10);
              }
            }
          });
        }

        // 处理行政区划树结构变更（P1/P2/P4）
        if (p1.admin_division_updates && Array.isArray(p1.admin_division_updates) && P.adminHierarchy) {
          // 确定玩家行政区划数据
          var _ahPlayerKey = P.adminHierarchy.player ? 'player' : null;
          if (!_ahPlayerKey) {
            var _ahks = Object.keys(P.adminHierarchy);
            for (var _ki = 0; _ki < _ahks.length; _ki++) {
              if (P.adminHierarchy[_ahks[_ki]] && P.adminHierarchy[_ahks[_ki]].divisions) { _ahPlayerKey = _ahks[_ki]; break; }
            }
          }
          var _ahPlayer = _ahPlayerKey ? P.adminHierarchy[_ahPlayerKey] : null;
          if (_ahPlayer) {
            // 辅助：在树中查找节点（返回 { node, parent, index }）
            function _findAdminNode(name, divs, parent) {
              for (var i = 0; i < divs.length; i++) {
                if (divs[i].name === name) return { node: divs[i], parent: parent, arr: divs, index: i };
                if (divs[i].children && divs[i].children.length > 0) {
                  var r = _findAdminNode(name, divs[i].children, divs[i]);
                  if (r) return r;
                }
              }
              return null;
            }

            p1.admin_division_updates.forEach(function(adu) {
              if (!adu.action) return;
              var act = adu.action;

              if (act === 'add') {
                // 新增行政区到指定上级下
                var newDiv = {
                  id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: adu.division || '未命名',
                  level: adu.level || '',
                  officialPosition: adu.officialPosition || '',
                  governor: adu.governor || '',
                  description: adu.description || '',
                  population: parseInt(adu.population) || 50000,
                  prosperity: parseInt(adu.prosperity) || 50,
                  terrain: adu.terrain || '',
                  specialResources: adu.specialResources || '',
                  taxLevel: adu.taxLevel || '\u4E2D',
                  children: []
                };
                if (adu.parentDivision) {
                  var parentFound = _findAdminNode(adu.parentDivision, _ahPlayer.divisions, null);
                  if (parentFound) {
                    if (!parentFound.node.children) parentFound.node.children = [];
                    parentFound.node.children.push(newDiv);
                  } else {
                    _ahPlayer.divisions.push(newDiv); // 找不到上级则添加为顶级
                  }
                } else {
                  _ahPlayer.divisions.push(newDiv);
                }
                // 同步到provinceStats
                if (!GM.provinceStats) GM.provinceStats = {};
                var _playerFacName = (P.playerInfo && P.playerInfo.factionName) || '';
                GM.provinceStats[newDiv.name] = {
                  name: newDiv.name, owner: _playerFacName,
                  population: newDiv.population, wealth: newDiv.prosperity,
                  stability: 60, development: Math.round(newDiv.prosperity * 0.8),
                  taxRevenue: 0, militaryRecruits: 0,
                  unrest: 15, corruption: 25,
                  terrain: newDiv.terrain, specialResources: newDiv.specialResources,
                  governor: newDiv.governor, taxLevel: newDiv.taxLevel
                };
                addEB('\u884C\u653F', '\u65B0\u589E\u884C\u653F\u533A\u5212\uFF1A' + newDiv.name + (adu.reason ? '(' + adu.reason + ')' : ''));

              } else if (act === 'remove') {
                var found = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (found) {
                  found.arr.splice(found.index, 1);
                  if (GM.provinceStats && GM.provinceStats[adu.division]) delete GM.provinceStats[adu.division];
                  addEB('\u884C\u653F', '\u64A4\u9500\u884C\u653F\u533A\u5212\uFF1A' + adu.division + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'rename') {
                var found = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (found && adu.newName) {
                  var oldName = found.node.name;
                  found.node.name = adu.newName;
                  // 同步provinceStats
                  if (GM.provinceStats && GM.provinceStats[oldName]) {
                    GM.provinceStats[adu.newName] = GM.provinceStats[oldName];
                    GM.provinceStats[adu.newName].name = adu.newName;
                    delete GM.provinceStats[oldName];
                  }
                  addEB('\u884C\u653F', oldName + '\u6539\u540D\u4E3A' + adu.newName + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'merge') {
                // 合并：将源节点数据并入目标节点，删除源节点
                if (adu.division === adu.mergeInto) return; // 防止自我合并
                var src = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                var dst = adu.mergeInto ? _findAdminNode(adu.mergeInto, _ahPlayer.divisions, null) : null;
                if (src && dst && src.node !== dst.node) {
                  // 合并人口
                  dst.node.population = (dst.node.population || 0) + (src.node.population || 0);
                  // 合并子节点
                  if (src.node.children && src.node.children.length > 0) {
                    if (!dst.node.children) dst.node.children = [];
                    dst.node.children = dst.node.children.concat(src.node.children);
                  }
                  src.arr.splice(src.index, 1);
                  // 同步provinceStats
                  if (GM.provinceStats) {
                    var _srcPS = GM.provinceStats[adu.division];
                    var _dstPS = GM.provinceStats[adu.mergeInto];
                    if (_srcPS && _dstPS) {
                      _dstPS.population += _srcPS.population || 0;
                      _dstPS.taxRevenue += _srcPS.taxRevenue || 0;
                      _dstPS.militaryRecruits += _srcPS.militaryRecruits || 0;
                    }
                    delete GM.provinceStats[adu.division];
                  }
                  addEB('\u884C\u653F', adu.division + '\u5E76\u5165' + adu.mergeInto + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'split') {
                // 拆分：原节点保留，创建新节点分走部分人口
                var orig = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (orig && adu.splitResult && Array.isArray(adu.splitResult) && adu.splitResult.length > 0) {
                  var parentArr = orig.parent ? orig.parent.children : _ahPlayer.divisions;
                  var splitCount = adu.splitResult.length;
                  var popPerSplit = Math.floor((orig.node.population || 50000) / (splitCount + 1));
                  orig.node.population = popPerSplit; // 原节点保留一份
                  adu.splitResult.forEach(function(newName) {
                    var newDiv = {
                      id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                      name: newName, level: orig.node.level || '',
                      officialPosition: orig.node.officialPosition || '',
                      governor: '', description: '\u62C6\u5206\u81EA' + adu.division,
                      population: popPerSplit, prosperity: orig.node.prosperity || 50,
                      terrain: orig.node.terrain || '', specialResources: '',
                      taxLevel: orig.node.taxLevel || '\u4E2D', children: []
                    };
                    parentArr.push(newDiv);
                  });
                  addEB('\u884C\u653F', adu.division + '\u62C6\u5206\u4E3A' + adu.splitResult.join('\u3001') + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'territory_gain') {
                // P2: 获得领土 → 创建"未定行政区"临时顶级节点
                var undetermined = _findAdminNode('\u672A\u5B9A\u884C\u653F\u533A', _ahPlayer.divisions, null);
                if (!undetermined) {
                  var undNode = {
                    id: 'div_undetermined', name: '\u672A\u5B9A\u884C\u653F\u533A',
                    level: '\u4E34\u65F6', officialPosition: '',
                    description: '\u65B0\u83B7\u5F97\u9886\u571F\uFF0C\u7B49\u5F85\u7BA1\u7406\u65B9\u6848',
                    population: 0, prosperity: 30, terrain: '', taxLevel: '\u4E2D',
                    children: []
                  };
                  _ahPlayer.divisions.push(undNode);
                  undetermined = { node: undNode };
                }
                // 添加获得的行政区到未定行政区下
                var gainDiv = {
                  id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: adu.division || '\u65B0\u9886\u571F',
                  level: adu.level || '', officialPosition: adu.officialPosition || '',
                  governor: '', description: '\u4ECE' + (adu.gainedFrom || '\u654C\u65B9') + '\u83B7\u5F97',
                  population: parseInt(adu.population) || 30000, prosperity: parseInt(adu.prosperity) || 30,
                  terrain: adu.terrain || '', specialResources: adu.specialResources || '',
                  taxLevel: adu.taxLevel || '\u4E2D', children: []
                };
                if (!undetermined.node.children) undetermined.node.children = [];
                undetermined.node.children.push(gainDiv);
                undetermined.node.population += gainDiv.population;
                // 同步provinceStats
                if (!GM.provinceStats) GM.provinceStats = {};
                var _pfn = (P.playerInfo && P.playerInfo.factionName) || '';
                GM.provinceStats[gainDiv.name] = {
                  name: gainDiv.name, owner: _pfn,
                  population: gainDiv.population, wealth: gainDiv.prosperity,
                  stability: 40, development: 30,
                  taxRevenue: 0, militaryRecruits: 0,
                  unrest: 30, corruption: 30,
                  terrain: gainDiv.terrain, specialResources: gainDiv.specialResources,
                  governor: '', taxLevel: gainDiv.taxLevel
                };
                addEB('\u9886\u571F', '\u83B7\u5F97\u9886\u571F\uFF1A' + gainDiv.name + '\uFF0C\u7EB3\u5165\u672A\u5B9A\u884C\u653F\u533A' + (adu.reason ? '(' + adu.reason + ')' : ''));
                // 触发上奏/议程
                if (GM.memorials) {
                  GM.memorials.push({
                    type: 'territory', priority: 'urgent', turn: GM.turn, status: 'pending',
                    title: '\u65B0\u83B7\u9886\u571F' + gainDiv.name + '\u7BA1\u7406\u65B9\u6848',
                    content: '\u81E3\u5949\u8868\uFF1A\u65B0\u83B7' + gainDiv.name + '\u5C1A\u672A\u8BBE\u7F6E\u884C\u653F\u533A\u5212\u548C\u5730\u65B9\u5B98\uFF0C\u8BF7\u965B\u4E0B\u5B9A\u593A\u7BA1\u7406\u65B9\u6848\u3002',
                    from: '\u6709\u53F8', reply: ''
                  });
                }

              } else if (act === 'territory_loss') {
                // P2: 丢失领土 → 数据对玩家清零
                var lost = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (lost) {
                  // 记录丢失前数据（供侨置用）
                  if (!GM._lostTerritories) GM._lostTerritories = {};
                  GM._lostTerritories[adu.division] = {
                    node: JSON.parse(JSON.stringify(lost.node)),
                    lostTo: adu.lostTo || '\u654C\u65B9',
                    turn: GM.turn
                  };
                  // 从玩家树中移除
                  lost.arr.splice(lost.index, 1);
                  // 从provinceStats中移除
                  if (GM.provinceStats && GM.provinceStats[adu.division]) {
                    delete GM.provinceStats[adu.division];
                  }
                  // 递归移除所有子节点的provinceStats
                  function _removeChildPS(children) {
                    if (!children) return;
                    children.forEach(function(c) {
                      if (GM.provinceStats && GM.provinceStats[c.name]) delete GM.provinceStats[c.name];
                      if (c.children) _removeChildPS(c.children);
                    });
                  }
                  _removeChildPS(lost.node.children);
                  addEB('\u9886\u571F', '\u4E22\u5931\u9886\u571F\uFF1A' + adu.division + '\uFF0C\u5F52\u5C5E' + (adu.lostTo || '\u654C\u65B9') + (adu.reason ? '(' + adu.reason + ')' : ''));
                  // 地方官受影响 + NPC记忆
                  var _lostGov = lost.node.governor;
                  if (_lostGov) {
                    var _lgCh = findCharByName(_lostGov);
                    if (_lgCh) {
                      _lgCh.loyalty = Math.max(0, (_lgCh.loyalty || 50) - 10);
                      _lgCh.stress = Math.min(100, (_lgCh.stress || 0) + 15);
                      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                        NpcMemorySystem.remember(_lostGov, '\u6240\u8F96' + adu.division + '\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u5BF9\u6B64\u6DF1\u611F\u7126\u8651\u548C\u7F9A\u803B', 'trauma');
                      }
                    }
                  }
                  // 触发侨置决策上奏
                  if (GM.memorials) {
                    GM.memorials.push({
                      type: 'territory', priority: 'urgent', turn: GM.turn, status: 'pending',
                      title: adu.division + '\u5931\u9677\uFF0C\u662F\u5426\u4FA8\u7F6E\uFF1F',
                      content: '\u81E3\u5949\u8868\uFF1A' + adu.division + '\u5DF2\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u8BF7\u965B\u4E0B\u5B9A\u593A\u662F\u5426\u4FA8\u7F6E\u6B64\u5730\u884C\u653F\u533A\u5212\u3002',
                      from: '\u6709\u53F8', reply: '',
                      _qiaozhiTarget: adu.division
                    });
                  }
                }

              } else if (act === 'reform') {
                // P4: 行政改革
                addEB('\u884C\u653F', '\u884C\u653F\u6539\u9769\uFF1A' + (adu.division || '') + ' ' + (adu.description || adu.reason || ''));
              }
            });
          }
        }

        // 处理后宫事件
        if (p1.harem_events && Array.isArray(p1.harem_events) && GM.harem) {
          p1.harem_events.forEach(function(he) {
            if (!he.type || !he.character) return;
            if (he.type === 'pregnancy') {
              if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
              GM.harem.pregnancies.push({ mother: he.character, startTurn: GM.turn, detail: he.detail || '' });
              addEB('\u540E\u5BAB', he.character + '\u6709\u5B55');
            } else if (he.type === 'birth') {
              addEB('\u540E\u5BAB', he.character + '\u8BDE\u4E0B\u5B50\u55E3' + (he.detail || ''));
              // 从pregnancies移除
              if (GM.harem.pregnancies) GM.harem.pregnancies = GM.harem.pregnancies.filter(function(p) { return p.mother !== he.character; });
            } else if (he.type === 'rank_change') {
              var sp = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (sp) {
                // 优先使用结构化newRank字段，回退到detail文本
                var _newRankId = he.newRank || he.detail || '';
                sp.spouseRank = _newRankId;
                // 获取位份中文名显示
                var _rankDisplayName = _newRankId;
                if (typeof getHaremRankName === 'function') {
                  var _rn = getHaremRankName(_newRankId);
                  if (_rn && _rn !== _newRankId) _rankDisplayName = _rn;
                }
                addEB('\u540E\u5BAB', he.character + '\u664B\u5C01\u4E3A' + _rankDisplayName);
              }
            } else if (he.type === 'death') {
              var spd = GM.chars ? GM.chars.find(function(c) { return c.name === he.character; }) : null;
              if (spd) {
                spd.alive = false; spd.dead = true; spd.deathTurn = GM.turn; spd.deathReason = he.detail || '';
                // 触发完整死亡级联（官职清理/军队统帅/事件总线/叙事事实）
                if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(he.character);
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: he.character, reason: he.detail || '薨逝' });
                // 军队统帅清理
                if (GM.armies) GM.armies.forEach(function(a) { if (a.commander === he.character) { a.commander = ''; a.morale = Math.max(0, (a.morale||50) - 15); } });
              }
              addEB('\u540E\u5BAB', he.character + '\u85A8\u901D' + (he.detail ? '\uFF1A' + he.detail : ''));
            } else if (he.type === 'favor_change') {
              // 宠爱变化
              var spf = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (spf) {
                if (spf.favor === undefined) spf.favor = 50;
                spf.favor = clamp(spf.favor + clamp(parseInt(he.favor_delta) || 0, -30, 30), 0, 100);
                if (he.detail) addEB('\u540E\u5BAB', he.character + '\uFF1A' + he.detail);
                // 宠爱极端值影响忠诚
                if (spf.favor > 85) spf.loyalty = Math.min(100, (spf.loyalty || 50) + 2);
                if (spf.favor < 20) spf.loyalty = Math.max(0, (spf.loyalty || 50) - 3);
              }
            } else if (he.type === 'scandal') {
              // 丑闻/纠纷
              var sps = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (sps) {
                sps.stress = Math.min(100, (sps.stress || 0) + 15);
                if (sps.favor !== undefined) sps.favor = Math.max(0, sps.favor - 10);
              }
              addEB('\u540E\u5BAB', he.character + '\u4E11\u95FB' + (he.detail ? '\uFF1A' + he.detail : ''));
              // NPC记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(he.character, '\u540E\u5BAB\u4E11\u95FB\uFF1A' + (he.detail || ''), 'scandal');
              }
            }
          });
        }

        // 处理皇城宫殿变更
        if (p1.palace_changes && Array.isArray(p1.palace_changes)) {
          // 自动初始化（若剧本未启用皇城系统但AI尝试建）
          if (!P.palaceSystem) P.palaceSystem = { enabled: true, capitalName: '', capitalDescription: '', palaces: [] };
          if (!P.palaceSystem.palaces) P.palaceSystem.palaces = [];
          p1.palace_changes.forEach(function(pc) {
            if (!pc.action) return;
            var palaces = P.palaceSystem.palaces;
            if (pc.action === 'build') {
              var nm = pc.newPalace || pc.palace;
              if (!nm) return;
              var _feas = pc.feasibility || '合理';
              if (_feas === '不合理') {
                addEB('\u5BAB\u5EFA', '拟建 ' + nm + ' 因不合理未能实施');
                return;
              }
              palaces.push({
                id: 'pal_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
                name: nm,
                type: pc.palaceType || 'main_hall',
                function: pc.reason || '',
                description: pc.judgedEffects || '',
                status: (pc.timeActual && pc.timeActual > 0) ? 'underconstruction' : 'intact',
                level: 1,
                subHalls: [],
                isHistorical: false,
                costActual: pc.costActual || 0,
                remainingTurns: pc.timeActual || 0,
                startTurn: GM.turn
              });
              addEB('\u5BAB\u5EFA', '新建' + nm + (pc.reason ? '：' + pc.reason : ''));
            } else if (pc.action === 'renovate') {
              var _p = palaces.find(function(x) { return x.name === pc.palace; });
              if (_p) {
                _p.status = 'intact';
                _p.lastRenovation = GM.turn;
                addEB('\u5BAB\u5EFA', _p.name + ' 修缮完工');
              }
            } else if (pc.action === 'ruined') {
              var _p2 = palaces.find(function(x) { return x.name === pc.palace; });
              if (_p2) {
                _p2.status = 'ruined';
                addEB('\u5BAB\u5EFA', _p2.name + ' 荒废' + (pc.reason ? '：' + pc.reason : ''));
              }
            } else if (pc.action === 'abandon') {
              var _idx = palaces.findIndex(function(x) { return x.name === pc.palace; });
              if (_idx >= 0) {
                var _ab = palaces[_idx];
                palaces.splice(_idx, 1);
                addEB('\u5BAB\u5EFA', _ab.name + ' 废弃' + (pc.reason ? '：' + pc.reason : ''));
              }
            } else if (pc.action === 'assign') {
              // 居所分配/移居
              var _tp = palaces.find(function(x) { return x.name === pc.palace; });
              if (_tp && _tp.subHalls) {
                var _sh = _tp.subHalls.find(function(s) { return s.name === pc.subHall; });
                if (_sh && pc.occupant) {
                  // 获取原居所用于比较（判断是晋升还是贬谪）
                  var _prevRole = null;
                  palaces.forEach(function(xp) {
                    if (!xp.subHalls) return;
                    xp.subHalls.forEach(function(xs) {
                      if (xs.occupants && xs.occupants.indexOf(pc.occupant) >= 0) _prevRole = xs.role;
                    });
                  });
                  // 从原位移除
                  palaces.forEach(function(xp) {
                    if (!xp.subHalls) return;
                    xp.subHalls.forEach(function(xs) {
                      if (xs.occupants) xs.occupants = xs.occupants.filter(function(n) { return n !== pc.occupant; });
                    });
                  });
                  // 移入新位
                  if (!_sh.occupants) _sh.occupants = [];
                  _sh.occupants.push(pc.occupant);
                  // 更新 character.residence
                  var _ch = (GM.chars || []).find(function(c) { return c.name === pc.occupant; });
                  if (_ch) _ch.residence = { palaceId: _tp.id, subHallId: _sh.id };
                  addEB('\u5BAB\u5EFA', pc.occupant + ' 移居' + _tp.name + '·' + _sh.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                  // NPC 记忆：按升降分级写入
                  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                    var _roleRank = { main:3, side:2, attached:1 };
                    var _prevRk = _prevRole ? _roleRank[_prevRole] : 0;
                    var _newRk = _roleRank[_sh.role] || 1;
                    var _moodText, _moodKey;
                    if (_newRk > _prevRk) { _moodText = '迁居' + _tp.name + '·' + _sh.name + '，位遇晋升'; _moodKey = '喜'; }
                    else if (_newRk < _prevRk) { _moodText = '由旧居迁至 ' + _tp.name + '·' + _sh.name + '，位遇下降，恐圣眷不再'; _moodKey = '忧'; }
                    else { _moodText = '迁居 ' + _tp.name + '·' + _sh.name; _moodKey = '平'; }
                    NpcMemorySystem.remember(pc.occupant, _moodText, _moodKey, 5);
                  }
                }
              }
            } else if (pc.action === 'build' && pc.occupant) {
              // AI若在新建时指定居住者，也写入记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(pc.occupant, '蒙恩新赐' + (pc.newPalace || pc.palace) + '为居所', '喜', 7);
              }
            } else if (pc.action === 'abandon' || pc.action === 'ruined') {
              // 若废弃/荒废的宫殿有居住者，通知NPC记忆
              var _ruinedPal = palaces.find(function(x) { return x.name === pc.palace; });
              if (!_ruinedPal && pc.action === 'abandon') {
                // already removed, lookup previous occupants is not possible
              }
              // 对于 ruined，occupants仍然在对象中可查
              if (_ruinedPal && _ruinedPal.subHalls) {
                _ruinedPal.subHalls.forEach(function(sh) {
                  (sh.occupants || []).forEach(function(occ) {
                    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                      NpcMemorySystem.remember(occ, '所居 ' + _ruinedPal.name + ' 荒废，流离失所', '忧', 6);
                    }
                  });
                });
              }
            }
          });
        }

        // 处理文事作品（诗词文赋画等）
        if (p1.cultural_works && Array.isArray(p1.cultural_works) && p1.cultural_works.length > 0) {
          if (!GM.culturalWorks) GM.culturalWorks = [];
          var _pNameW = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.cultural_works.forEach(function(w) {
            if (!w || !w.author || !w.content || !w.title) return;
            // ── 玩家保护：作者是玩家——除非玩家在本回合诏令中明确命自己作，否则过滤 ──
            if (_pNameW && w.author === _pNameW) {
              // 检查 motivation 是否 commissioned（由玩家诏令命作）
              if (w.motivation !== 'commissioned' && w.motivation !== 'duty') {
                addEB('\u8FC7\u6EE4', 'AI 试图让玩家 ' + _pNameW + ' autonomous 作 ' + w.title + '，已过滤');
                return;
              }
            }
            // 补全字段
            var work = {
              id: 'work_T' + GM.turn + '_' + Math.random().toString(36).slice(2, 8),
              author: w.author,
              turn: GM.turn,
              date: w.date || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
              location: w.location || '',
              triggerCategory: w.triggerCategory || 'mood',
              trigger: w.trigger || 'casual_mood',
              motivation: w.motivation || 'spontaneous',
              lifeStage: w.lifeStage || '',
              genre: w.genre || 'shi',
              subtype: w.subtype || '',
              title: w.title,
              content: w.content,
              mood: w.mood || '',
              theme: w.theme || '',
              elegance: w.elegance || 'refined',
              dedicatedTo: Array.isArray(w.dedicatedTo) ? w.dedicatedTo : [],
              inspiredBy: w.inspiredBy || '',
              commissionedBy: w.commissionedBy || '',
              praiseTarget: w.praiseTarget || '',
              satireTarget: w.satireTarget || '',
              quality: parseInt(w.quality) || 60,
              politicalImplication: w.politicalImplication || '',
              politicalRisk: w.politicalRisk || 'low',
              narrativeContext: w.narrativeContext || '',
              preservationPotential: w.preservationPotential || 'low',
              isPreserved: (w.preservationPotential === 'high' || (parseInt(w.quality) || 0) >= 88),
              appreciatedBy: [],
              echoResponses: [],
              isForbidden: false,
              authorTraits: []
            };
            // 记录作者特质快照
            var authorCh = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(w.author) : null) || findCharByName(w.author);
            if (authorCh) {
              work.authorTraits = Array.isArray(authorCh.traits) ? authorCh.traits.slice() : [];
              // 作者索引
              if (!Array.isArray(authorCh.works)) authorCh.works = [];
              authorCh.works.push(work.id);
              // ── 作者自身记忆——"我记得自己写过这篇" ──
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                var _authorMood = (work.motivation === 'mourning' || work.mood === '悲怆' || work.mood === '凄苦') ? '忧' :
                                  (work.mood === '豪迈' || work.mood === '豪放' || work.motivation === 'celebration') ? '喜' :
                                  (work.motivation === 'critique' || work.mood === '讽刺') ? '恨' : '平';
                var _importance = Math.min(10, Math.max(4, Math.round((work.quality || 60) / 12)));
                var _memText = '作《' + work.title + '》于' + (work.location || '此地') + '——' +
                               (work.mood ? work.mood + '之作' : '') +
                               (work.narrativeContext ? '：' + work.narrativeContext.substring(0, 50) : '');
                NpcMemorySystem.remember(authorCh.name, _memText, _authorMood, _importance);
              }
            }
            GM.culturalWorks.push(work);
            // === 按动机应用差异化效果 ===
            var _mot = work.motivation;
            var _qBonus = Math.max(0, (work.quality - 50)) / 10; // 0-5
            if (authorCh) {
              if (_mot === 'spontaneous' || _mot === 'self_express') {
                // 自发之作：单纯文名
                if (work.quality >= 85) addEB('文事', authorCh.name + '作' + work.title + '，一时传诵');
              } else if (_mot === 'flattery') {
                // 干谒求官——看质量+委托对象
                var _target = (work.dedicatedTo && work.dedicatedTo[0]) || work.praiseTarget;
                var _targetCh = _target ? findCharByName(_target) : null;
                if (work.elegance === 'refined' && work.quality >= 75) {
                  if (_targetCh) {
                    _targetCh.affinity = (_targetCh.affinity || 50) + 5;
                    addEB('\u6587\u4E8B', authorCh.name + '以《' + work.title + '》干谒' + _target + '，得赏识');
                  }
                } else if (work.elegance === 'vernacular' || work.quality < 60) {
                  // 谄媚过度 → 士林讥嘲
                  authorCh.prestige = Math.max(0, (authorCh.prestige || 50) - 2);
                  addEB('\u6587\u4E8B', authorCh.name + '作《' + work.title + '》献媚于' + _target + '，士林讥之');
                }
              } else if (_mot === 'critique' || work.politicalRisk === 'high') {
                // 讽谕之作：风险+长远文名
                addEB('\u6587\u4E8B', '【讽谕】' + authorCh.name + '《' + work.title + '》出，' + (work.satireTarget ? '暗讽' + work.satireTarget + '，' : '') + '士论哗然');
                // 讽刺对象若为权贵，其可能记恨
                var _satCh = work.satireTarget ? findCharByName(work.satireTarget) : null;
                if (_satCh && typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(_satCh.name, authorCh.name + '作讽谕之文《' + work.title + '》暗刺吾，宜记之', '恨', 7);
                  _satCh.affinity = Math.max(0, (_satCh.affinity || 50) - 8);
                }
                if (work.quality >= 85) {
                  authorCh.prestige = Math.min(100, (authorCh.prestige || 50) + 3);
                }
              } else if (_mot === 'ghostwrite' && work.commissionedBy) {
                // 代笔：委托人署名得名声，作者得润笔
                addEB('\u6587\u4E8B', authorCh.name + '代' + work.commissionedBy + '撰《' + work.title + '》');
                var _commCh = findCharByName(work.commissionedBy);
                if (_commCh) {
                  _commCh.prestige = Math.min(100, (_commCh.prestige || 50) + Math.round(_qBonus));
                  _commCh.affinity = (_commCh.affinity || 50) + 3;
                  // 双方都记忆此事（委托人知道这是代笔，作者也记得）
                  if (typeof NpcMemorySystem !== 'undefined') {
                    NpcMemorySystem.remember(_commCh.name, '托' + authorCh.name + '代作《' + work.title + '》——知其实笔', '平', 5, authorCh.name);
                  }
                }
              } else if (_mot === 'mourning' || _mot === 'memorial') {
                // 悼亡/祭文：仁孝名声
                authorCh.benevolence = Math.min(100, (authorCh.benevolence || 50) + 1);
                addEB('\u6587\u4E8B', authorCh.name + '撰《' + work.title + '》以祭，情深意切');
              } else if (_mot === 'celebration') {
                // 颂扬
                var _prTar = work.praiseTarget ? findCharByName(work.praiseTarget) : null;
                if (_prTar) {
                  _prTar.affinity = (_prTar.affinity || 50) + 4;
                  addEB('\u6587\u4E8B', authorCh.name + '作' + work.title + '颂' + work.praiseTarget);
                  // 被颂者的记忆
                  if (typeof NpcMemorySystem !== 'undefined') {
                    NpcMemorySystem.remember(_prTar.name, authorCh.name + '作《' + work.title + '》颂吾——感其知遇', '喜', 6, authorCh.name);
                  }
                }
              } else if (_mot === 'farewell') {
                // 送别
                (work.dedicatedTo || []).forEach(function(n) {
                  var _ch = findCharByName(n);
                  if (_ch) {
                    _ch.affinity = (_ch.affinity || 50) + 5;
                    _ch.loyalty = Math.min(100, (_ch.loyalty || 50) + 2);
                    // 受赠者记忆
                    if (typeof NpcMemorySystem !== 'undefined') {
                      NpcMemorySystem.remember(n, authorCh.name + '于别时赠《' + work.title + '》，情深意厚', '喜', 7);
                    }
                  }
                });
                addEB('\u6587\u4E8B', authorCh.name + '送别' + (work.dedicatedTo||[]).join('、') + '，作《' + work.title + '》');
              } else if (_mot === 'response') {
                // 次韵酬答：文友关系
                (work.dedicatedTo || []).forEach(function(n) {
                  var _ch = findCharByName(n);
                  if (_ch) {
                    _ch.affinity = (_ch.affinity || 50) + 4;
                    if (typeof NpcMemorySystem !== 'undefined') {
                      NpcMemorySystem.remember(n, authorCh.name + '次韵和余作《' + work.title + '》——文友相重', '喜', 5);
                    }
                  }
                });
              } else if (_mot === 'duty' || _mot === 'commissioned') {
                // 应制：皇恩+
                authorCh.loyalty = Math.min(100, (authorCh.loyalty || 50) + 1);
              }
              // 通用效果：威望与文化影响
              authorCh.prestige = Math.min(100, (authorCh.prestige || 50) + Math.round(_qBonus * 0.5));
              if (GM.eraState && typeof GM.eraState.culturalVibrancy === 'number') {
                GM.eraState.culturalVibrancy = Math.min(1.0, GM.eraState.culturalVibrancy + Math.max(0, work.quality - 70) * 0.001);
              }
            }
          });
        }

        // 处理诏令生命周期更新（AI每回合推进的阶段状态）
        if (p1.edict_lifecycle_update && Array.isArray(p1.edict_lifecycle_update) && p1.edict_lifecycle_update.length > 0) {
          if (!GM._edictLifecycle) GM._edictLifecycle = [];
          p1.edict_lifecycle_update.forEach(function(u) {
            if (!u || !u.edictId) return;
            // 查找或创建生命周期记录
            var entry = GM._edictLifecycle.find(function(e) { return e.edictId === u.edictId; });
            if (!entry) {
              // 新条目——必须能在 _edictTracker 找到对应诏令，否则视为 AI 臆造并拒绝
              var _src = (GM._edictTracker || []).find(function(t) { return t.id === u.edictId; });
              if (!_src) {
                addEB('\u8BCF\u4EE4', '【过滤】AI 试图为不存在的诏令ID(' + u.edictId + ')创建生命周期，已拒绝');
                _dbg('[edict_lifecycle] 拒绝臆造 edictId=' + u.edictId);
                return;
              }
              entry = {
                edictId: u.edictId,
                edictType: u.edictType || '',
                edictContent: _src.content || '',
                edictCategory: _src.category || '',
                startTurn: GM.turn,
                stages: [],
                reformPhase: u.reformPhase || null,
                pilotRegion: u.pilotRegion || '',
                expansionRegions: [],
                oppositionLeaders: [],
                supporters: [],
                totalEffects: {},
                isCompleted: false
              };
              GM._edictLifecycle.push(entry);
            }
            // 推进阶段
            var stageEntry = {
              turn: GM.turn,
              stage: u.stage || 'execution',
              progress: u.stageProgress || 0,
              executor: u.executor || '',
              executorEffectiveness: u.executorEffectiveness || 0.5,
              resistanceDescription: u.resistanceDescription || '',
              narrativeSnippet: u.narrativeSnippet || ''
            };
            entry.stages.push(stageEntry);
            if (u.reformPhase) entry.reformPhase = u.reformPhase;
            if (u.pilotRegion && !entry.pilotRegion) entry.pilotRegion = u.pilotRegion;
            if (Array.isArray(u.expansionRegions)) {
              u.expansionRegions.forEach(function(r) {
                if (entry.expansionRegions.indexOf(r) < 0) entry.expansionRegions.push(r);
              });
            }
            if (Array.isArray(u.oppositionLeaders)) {
              u.oppositionLeaders.forEach(function(n) {
                if (entry.oppositionLeaders.indexOf(n) < 0) entry.oppositionLeaders.push(n);
              });
            }
            if (Array.isArray(u.supporters)) {
              u.supporters.forEach(function(n) {
                if (entry.supporters.indexOf(n) < 0) entry.supporters.push(n);
              });
            }
            // 阶段 = sedimentation 标为完成
            if (u.stage === 'sedimentation') entry.isCompleted = true;

            // 应用 currentEffects 到资源/阶层
            if (u.currentEffects && typeof u.currentEffects === 'object') {
              Object.keys(u.currentEffects).forEach(function(k) {
                var v = parseFloat(u.currentEffects[k]) || 0;
                entry.totalEffects[k] = (entry.totalEffects[k] || 0) + v;
                // 已有变量：直接应用
                if (GM.vars && GM.vars[k]) {
                  GM.vars[k].value = Math.max(GM.vars[k].min || 0, Math.min(GM.vars[k].max || 999999999, (GM.vars[k].value || 0) + v));
                } else if (k === 'stateTreasury' && typeof GM.stateTreasury === 'number') {
                  GM.stateTreasury = Math.max(0, GM.stateTreasury + v);
                }
              });
            }
            // 阶层影响 → classSatisfaction / unrest 联动
            if (u.classesAffected && typeof u.classesAffected === 'object' && GM.classes) {
              Object.keys(u.classesAffected).forEach(function(cls) {
                var info = u.classesAffected[cls] || {};
                var impact = parseFloat(info.impact) || 0;
                var clsObj = (GM.classes || []).find(function(c) { return c.name === cls; });
                if (clsObj) {
                  clsObj.satisfaction = Math.max(0, Math.min(100, (clsObj.satisfaction || 50) + impact));
                  // 联动分级不满：满意度剧降推高 unrestLevels 阶梯
                  if (!clsObj.unrestLevels) clsObj.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
                  if (impact < -5) {
                    clsObj.unrestLevels.grievance = Math.max(0, (clsObj.unrestLevels.grievance || 60) + impact * 0.8);
                    if (impact < -10) clsObj.unrestLevels.petition = Math.max(0, (clsObj.unrestLevels.petition || 70) + impact * 0.5);
                    if (impact < -20) clsObj.unrestLevels.strike = Math.max(0, (clsObj.unrestLevels.strike || 80) + impact * 0.3);
                  }
                }
              });
            }
            // 势力影响 → factionRelations / playerRelation 联动
            if (u.factionsAffected && typeof u.factionsAffected === 'object' && GM.facs) {
              Object.keys(u.factionsAffected).forEach(function(fn) {
                var info = u.factionsAffected[fn] || {};
                var delta = parseFloat(info.relation_delta) || 0;
                var fObj = (GM.facs || []).find(function(f) { return f.name === fn; });
                if (fObj) {
                  if (delta) fObj.playerRelation = Math.max(-100, Math.min(100, (fObj.playerRelation || 0) + delta));
                  if (info.attitude_shift && info.attitude_shift !== fObj.attitude) {
                    fObj.attitude = info.attitude_shift;
                    addEB('外交', fn + '因诏令转向' + info.attitude_shift + (info.reason ? '（' + info.reason + '）' : ''));
                  }
                  // 存入势力历史大事
                  if (!Array.isArray(fObj.historicalEvents)) fObj.historicalEvents = [];
                  if (Math.abs(delta) >= 5) {
                    fObj.historicalEvents.push({ turn: GM.turn, event: '对' + ((P.playerInfo && P.playerInfo.factionName) || '我方') + '诏令的反应', impact: (delta > 0 ? '关系+' : '关系') + delta });
                    if (fObj.historicalEvents.length > 30) fObj.historicalEvents = fObj.historicalEvents.slice(-30);
                  }
                }
              });
            }
            // 党派影响 → influence / agenda_history 联动
            if (u.partiesAffected && typeof u.partiesAffected === 'object' && GM.parties) {
              Object.keys(u.partiesAffected).forEach(function(pn) {
                var info = u.partiesAffected[pn] || {};
                var infDelta = parseFloat(info.influence_delta) || 0;
                var pObj = (GM.parties || []).find(function(pp) { return pp.name === pn; });
                if (pObj) {
                  if (infDelta) pObj.influence = Math.max(0, Math.min(100, (pObj.influence || 50) + infDelta));
                  // 写入议程演进
                  if (info.agenda_impact || info.reason) {
                    if (!Array.isArray(pObj.agenda_history)) pObj.agenda_history = [];
                    pObj.agenda_history.push({ turn: GM.turn, agenda: info.agenda_impact || '诏令反应', outcome: info.reason || '' });
                    if (pObj.agenda_history.length > 20) pObj.agenda_history = pObj.agenda_history.slice(-20);
                  }
                  // 反对派 → 党员写入恨意记忆
                  if (info.agenda_impact === '反对' && typeof NpcMemorySystem !== 'undefined' && GM.chars) {
                    GM.chars.filter(function(c){return c.party === pn;}).slice(0, 3).forEach(function(c) {
                      NpcMemorySystem.remember(c.name, '党议反对诏令(' + (u.edictType||'') + ')', '恨', 5);
                    });
                  }
                }
              });
            }

            // 意外后果 → 编年 + 起居注
            if (u.unintendedConsequences) {
              addEB('\u8BCF\u4EE4', '【意外】' + u.unintendedConsequences);
              if (GM.qijuHistory) {
                GM.qijuHistory.unshift({
                  turn: GM.turn,
                  date: typeof getTSText==='function'?getTSText(GM.turn):'',
                  content: '【意外后果】' + u.unintendedConsequences,
                  category: '诏令'
                });
              }
            }

            // 阻力生成 → 反对派 NPC 记忆（恨意积累）
            if (Array.isArray(u.oppositionLeaders) && typeof NpcMemorySystem !== 'undefined') {
              u.oppositionLeaders.forEach(function(oppName) {
                NpcMemorySystem.remember(oppName, '反对诏令(' + (u.edictType||'') + ')——深恶之', '恨', 6);
                // 与执行者建立冲突级关系
                if (u.executor && typeof applyNpcInteraction === 'function') {
                  // 这里不直接 applyNpcInteraction（避免叠加过多），只做记忆标记
                }
              });
            }
            // 事件板简要记录
            var stageLabel = (typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[u.stage]) ? EDICT_STAGES[u.stage].label : (u.stage||'');
            var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[u.edictType]) ? EDICT_TYPES[u.edictType].label : (u.edictType||'');
            var phaseTag = '';
            if (u.reformPhase && typeof REFORM_PHASES !== 'undefined' && REFORM_PHASES[u.reformPhase]) {
              phaseTag = '·' + REFORM_PHASES[u.reformPhase].label;
            }
            addEB('\u8BCF\u4EE4', typeLabel + phaseTag + ' → ' + stageLabel + (u.executor ? '(' + u.executor + '督办)' : '') + (u.narrativeSnippet ? '：' + u.narrativeSnippet.substring(0,60) : ''));
          });
        }

        // 处理 NPC 互动
        if (p1.npc_interactions && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          var _pName = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.npc_interactions.forEach(function(it) {
            if (!it || !it.type || !it.actor || !it.target) return;
            // ── 玩家保护：actor=玩家的 autonomous 互动一律过滤（玩家应通过诏令/批奏疏/问对自行操作）──
            if (_pName && (it.actor === _pName)) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家 ' + _pName + ' autonomous 互动(' + it.type + '→' + it.target + ')，已过滤');
              return;
            }
            if (typeof applyNpcInteraction !== 'function') return;
            var extra = { description: it.description || '' };
            var ok = applyNpcInteraction(it.actor, it.target, it.type, extra);
            if (ok) {
              var typeInfo = (typeof NPC_INTERACTION_TYPES !== 'undefined' && NPC_INTERACTION_TYPES[it.type]) ? NPC_INTERACTION_TYPES[it.type].label : it.type;
              addEB('\u4EBA\u7269', it.actor + '→' + it.target + ' ' + typeInfo + (it.description ? '：' + it.description : ''));
              // ── 名望/贤能涨跌（由行为定义查询）──
              try {
                var _typeDef = (typeof NPC_INTERACTION_TYPES !== 'undefined' && NPC_INTERACTION_TYPES[it.type]) ? NPC_INTERACTION_TYPES[it.type] : null;
                var _cEng = (typeof CharEconEngine !== 'undefined') ? CharEconEngine : null;
                if (_typeDef && _cEng) {
                  var _actorCh = (typeof findCharByName==='function') ? findCharByName(it.actor) : null;
                  var _targetCh = (typeof findCharByName==='function') ? findCharByName(it.target) : null;
                  if (_actorCh && _typeDef.fameActor) _cEng.adjustFame(_actorCh, _typeDef.fameActor, typeInfo+'→'+it.target);
                  if (_targetCh && _typeDef.fameTarget) _cEng.adjustFame(_targetCh, _typeDef.fameTarget, '被'+it.actor+typeInfo);
                  if (_actorCh && _typeDef.virtueActor) _cEng.adjustVirtueMerit(_actorCh, _typeDef.virtueActor, typeInfo);
                  if (_targetCh && _typeDef.virtueTarget) _cEng.adjustVirtueMerit(_targetCh, _typeDef.virtueTarget, '被'+typeInfo);
                }
              } catch(_fve){}
              // ── 当事人（actor、target）写入记忆 ──
              if (typeof NpcMemorySystem !== 'undefined') {
                var _aggressive = ['impeach','slander','frame_up','betray','expose_secret'].indexOf(it.type) >= 0;
                var _friendly = ['recommend','guarantee','petition_jointly','private_visit','invite_banquet','gift_present','duel_poetry'].indexOf(it.type) >= 0;
                var _emo = _aggressive ? '怒' : (_friendly ? '喜' : '平');
                var _wt = _aggressive ? 6 : (_friendly ? 4 : 3);
                if (it.actor && it.actor !== _pName) {
                  NpcMemorySystem.remember(it.actor, '我对 ' + it.target + ' ' + typeInfo + (it.description ? '：' + it.description.slice(0,30) : ''), _emo, _wt);
                }
                if (it.target && it.target !== _pName) {
                  NpcMemorySystem.remember(it.target, ' ' + it.actor + ' 对我 ' + typeInfo + (it.description ? '——' + it.description.slice(0,30) : ''), _aggressive ? '恨' : _emo, _wt);
                }
              }
              // 涉及第三方——也记入他们的记忆
              if (Array.isArray(it.involvedOthers) && typeof NpcMemorySystem !== 'undefined') {
                it.involvedOthers.forEach(function(n) {
                  if (n && n !== _pName) NpcMemorySystem.remember(n, '见 ' + it.actor + ' 对 ' + it.target + ' ' + typeInfo, '平', 3);
                });
              }
              // ── NPC 对玩家行为的分发 ──
              if (_pName && it.target === _pName) {
                _dispatchNpcActionToPlayer(it, typeInfo);
              }
              // ── publicKnown 的 NPC 间互动 → 起居注风闻 + 风闻录事 ──
              if (it.publicKnown) {
                if (GM.qijuHistory) {
                  GM.qijuHistory.unshift({
                    turn: GM.turn,
                    date: typeof getTSText==='function'?getTSText(GM.turn):'',
                    content: '【风闻】' + it.actor + ' 对 ' + it.target + ' ' + typeInfo + (it.description ? '——' + it.description.substring(0,60) : ''),
                    category: '风闻'
                  });
                }
                if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  var _fwType = (['impeach','slander','frame_up','expose_secret'].indexOf(it.type)>=0) ? '告状'
                              : (['correspond_secret','share_intelligence'].indexOf(it.type)>=0) ? '密札'
                              : (['private_visit','invite_banquet','duel_poetry','gift_present','recommend','guarantee','petition_jointly'].indexOf(it.type)>=0) ? '耳报'
                              : '风议';
                  PhaseD.addFengwen({
                    type: _fwType,
                    text: it.actor + '·' + typeInfo + '·' + it.target + (it.description ? '——' + it.description.slice(0,80) : ''),
                    credibility: 0.7,
                    source: 'npc_interaction',
                    actors: [it.actor, it.target].concat(it.involvedOthers||[]),
                    turn: GM.turn
                  });
                }
              } else if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen && Math.random() < 0.2) {
                // 非公开互动 20% 概率由耳目察觉，走"密札"
                PhaseD.addFengwen({
                  type: '密札',
                  text: '耳目报：' + it.actor + '→' + it.target + ' ' + typeInfo + '（未广传）',
                  credibility: 0.4,
                  source: 'spy',
                  actors: [it.actor, it.target],
                  turn: GM.turn
                });
              }
            }
          });
        }

        // 辅助：NPC 对玩家的互动分发到相应 tab
        function _dispatchNpcActionToPlayer(it, typeInfo) {
          if (!GM) return;
          var actor = it.actor, desc = it.description || typeInfo;
          var turn = GM.turn;
          var date = typeof getTSText==='function'?getTSText(turn):'';
          // 按 type 分发
          if (it.type === 'impeach' || it.type === 'slander' || it.type === 'expose_secret') {
            // 弹劾/诽谤/揭发 → 奏疏（弹章）
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '弹章', subtype: '公疏',
              title: actor + '弹劾' + (it.involvedOthers && it.involvedOthers[0] ? it.involvedOthers[0] : ''),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'recommend' || it.type === 'guarantee' || it.type === 'petition_jointly') {
            // 举荐/担保/联名 → 奏疏
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '荐表', subtype: '公疏',
              title: actor + (it.type==='recommend'?'举荐':it.type==='guarantee'?'担保':'联名'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'private_visit' || it.type === 'invite_banquet' || it.type === 'duel_poetry') {
            // 私访/宴请/切磋 → 问对（求见队列）
            if (!GM._pendingAudiences) GM._pendingAudiences = [];
            GM._pendingAudiences.push({ name: actor, reason: desc, turn: turn });
          } else if (it.type === 'gift_present' || it.type === 'correspond_secret' || it.type === 'share_intelligence') {
            // 馈赠/密信/通报 → 鸿雁（NPC 主动来书）
            // R: 旧版只填 from/to/letterType/content/turn/status·缺 _npcInitiated/sentTurn/deliveryTurn/
            //    fromLocation·导致 Section 3 不接管·UI 不显示「回书/摘入」按钮·日期渲染异常
            if (!GM.letters) GM.letters = [];
            var _actorCh = (typeof findCharByName === 'function') ? findCharByName(actor) : null;
            var _capital = GM._capital || '京城';
            var _fromLoc = (_actorCh && _actorCh.location) || '远方';
            var _dpv1 = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
            var _nowD1 = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (turn-1)*_dpv1;
            GM.letters.push({
              id: 'letter_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, to: '玩家',
              fromLocation: _fromLoc, toLocation: _capital,
              letterType: it.type === 'gift_present' ? 'gift' : 'intelligence',
              content: desc,
              sentTurn: turn, deliveryTurn: turn,
              _sentDay: _nowD1, _deliveryDay: _nowD1, _travelDays: 0,
              status: 'delivered', urgency: 'normal',
              _npcInitiated: true, _replyExpected: it.type !== 'gift_present',
              _playerRead: false, _sendMode: 'multi_courier'
            });
          } else if (it.type === 'frame_up' || it.type === 'betray') {
            // 构陷/背叛 → 奏疏(警报) + 起居注
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: '有司', type: '警报', subtype: '密折',
              title: actor + (it.type==='betray'?'似有不臣之心':'恐有构陷之谋'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          }
          // 所有对玩家的 NPC 行为也记起居注
          if (GM.qijuHistory) {
            GM.qijuHistory.unshift({
              turn: turn, date: date,
              content: '【' + typeInfo + '】' + actor + '→陛下' + (desc ? '：' + desc : ''),
              category: '对上'
            });
          }
        }

        // 处理势力深度互动
        if (p1.faction_interactions_advanced && Array.isArray(p1.faction_interactions_advanced) && p1.faction_interactions_advanced.length > 0) {
          var _pFac = (P.playerInfo && P.playerInfo.factionName) || '';
          p1.faction_interactions_advanced.forEach(function(it) {
            if (!it || !it.type || !it.from || !it.to) return;
            // ── 玩家势力保护：from=玩家势力的主动宣战/结盟/毁约等一律过滤——这些只能由玩家诏令触发 ──
            var _playerInitiatedTypes = ['declare_war','sue_for_peace','form_confederation','break_confederation','trade_embargo','open_market','send_envoy','demand_tribute','pay_tribute','royal_marriage','send_hostage','cultural_exchange','spy_infiltration','assassin_dispatch','annex_vassal','recognize_independence','incite_rebellion','proxy_war'];
            if (_pFac && it.from === _pFac && _playerInitiatedTypes.indexOf(it.type) >= 0) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家势力 ' + _pFac + ' autonomous 对外 ' + it.type + '，已过滤（须玩家诏令）');
              return;
            }
            if (typeof applyFactionInteraction !== 'function') return;
            var extra = {
              description: it.description || it.terms || '',
              viaProxy: it.viaProxy || '',
              action: it.action || '',
              treatyType: it.treatyType || '',
              terms: it.terms || '',
              until: it.until || null
            };
            var ok = applyFactionInteraction(it.from, it.to, it.type, extra);
            if (ok) {
              var typeInfo = (typeof FACTION_INTERACTION_TYPES !== 'undefined' && FACTION_INTERACTION_TYPES[it.type]) ? FACTION_INTERACTION_TYPES[it.type].label : it.type;
              addEB('\u52BF\u529B', it.from + '→' + it.to + ' ' + typeInfo + (it.description ? '：' + it.description : ''));
              // 公开势力互动 → 风闻录事（机密类除外）
              try {
                var _covertTypes = ['spy_infiltration','assassin_dispatch','incite_rebellion'];
                var _isCovert = _covertTypes.indexOf(it.type) >= 0;
                if (!_isCovert && typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  var _fwType = it.type === 'declare_war' ? '\u6218\u62A5'
                              : it.type === 'border_clash' ? '\u8FB9\u62A5'
                              : it.type === 'royal_marriage' ? '\u548C\u4EB2'
                              : it.type === 'send_hostage' ? '\u8D28\u5B50'
                              : it.type === 'demand_tribute' || it.type === 'pay_tribute' ? '\u671D\u8D21'
                              : it.type === 'open_market' || it.type === 'trade_embargo' ? '\u4E92\u5E02'
                              : it.type === 'form_confederation' || it.type === 'break_confederation' ? '\u76DF\u7EA6'
                              : it.type === 'send_envoy' ? '\u9063\u4F7F'
                              : it.type === 'cultural_exchange' || it.type === 'religious_mission' ? '\u4F7F\u8282'
                              : it.type === 'military_aid' || it.type === 'proxy_war' ? '\u519B\u60C5'
                              : it.type === 'pay_indemnity' ? '\u8D54\u6B3E'
                              : it.type === 'annex_vassal' || it.type === 'recognize_independence' ? '\u5916\u4EA4'
                              : it.type === 'gift_treasure' ? '\u8D60\u8D22'
                              : it.type === 'sue_for_peace' ? '\u8BF7\u548C'
                              : '\u98CE\u8BAE';
                  PhaseD.addFengwen({
                    type: _fwType,
                    text: it.from + '\u00B7' + typeInfo + '\u00B7' + it.to + (it.description ? '\u2014\u2014' + String(it.description).slice(0,60) : ''),
                    credibility: 0.85,
                    source: 'faction_public',
                    actors: [it.from, it.to],
                    turn: GM.turn
                  });
                }
              } catch(_fwErr){}
              // 联姻细节——写入角色数据
              if (it.type === 'royal_marriage' && it.marriageDetails) {
                addEB('\u548C\u4EB2', it.marriageDetails);
              }
              // 质子细节
              if (it.type === 'send_hostage' && it.hostageDetails) {
                addEB('\u8D28\u5B50', it.hostageDetails);
              }
              // 宣战——联动 activeWars + 编年
              if (it.type === 'declare_war') {
                if (GM.activeWars) GM.activeWars.push({ attacker: it.from, defender: it.to, startTurn: GM.turn, reason: it.reason || '', declared: true });
                if (!GM.biannianItems) GM.biannianItems = [];
                GM.biannianItems.unshift({
                  turn: GM.turn, startTurn: GM.turn,
                  date: typeof getTSText==='function'?getTSText(GM.turn):'',
                  title: it.from + ' 对 ' + it.to + ' 宣战',
                  content: it.description || (it.from + '向' + it.to + '下战书，两国开战。'),
                  duration: 1, importance: 'high', category: '军事'
                });
              }
              // ── 势力对玩家势力的分发 ──
              if (_pFac && it.to === _pFac) {
                _dispatchFactionActionToPlayer(it, typeInfo);
              }
            }
          });
        }

        // 辅助：他国势力对玩家势力的互动分发
        function _dispatchFactionActionToPlayer(it, typeInfo) {
          if (!GM) return;
          var from = it.from, desc = it.description || typeInfo;
          var turn = GM.turn;
          var date = typeof getTSText==='function'?getTSText(turn):'';
          // 外交类 → 鸿雁（国书）
          var diplomaticTypes = ['send_envoy','demand_tribute','pay_tribute','royal_marriage','send_hostage','sue_for_peace','form_confederation','break_confederation','cultural_exchange','religious_mission','gift_treasure','pay_indemnity','open_market','trade_embargo','recognize_independence'];
          if (diplomaticTypes.indexOf(it.type) >= 0) {
            if (!GM.letters) GM.letters = [];
            // R: 旧版缺 _npcInitiated/sentTurn/deliveryTurn·to 用"朝廷"与其它路径不一致·补齐
            var _capital2 = GM._capital || '京城';
            var _dpv2 = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
            var _nowD2 = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (turn-1)*_dpv2;
            GM.letters.push({
              id: 'letter_diplomatic_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: from, to: '玩家',
              fromLocation: from + '·使节', toLocation: _capital2,
              letterType: 'diplomatic',
              subtype: it.type,
              content: desc + (it.terms ? '\n条款：'+it.terms : '') + (it.tributeItems ? '\n贡物：'+it.tributeItems : ''),
              sentTurn: turn, deliveryTurn: turn,
              _sentDay: _nowD2, _deliveryDay: _nowD2, _travelDays: 0,
              status: 'delivered', urgency: 'normal',
              _npcInitiated: true, _replyExpected: true, _playerRead: false,
              _sendMode: 'multi_courier'
            });
            // 需要玩家回应的重大外交（和亲/索贡/请和/联盟）→ 问对待接见
            var requireResponseTypes = ['royal_marriage','demand_tribute','sue_for_peace','form_confederation','send_envoy'];
            if (requireResponseTypes.indexOf(it.type) >= 0) {
              if (!GM._pendingAudiences) GM._pendingAudiences = [];
              GM._pendingAudiences.push({
                name: from + '使节', reason: typeInfo + '——' + desc, turn: turn,
                isEnvoy: true, fromFaction: from, interactionType: it.type
              });
            }
          }
          // 军事类 → 编年（重大）+ 奏疏（边报）
          var militaryTypes = ['declare_war','border_clash','assassin_dispatch','incite_rebellion','proxy_war','spy_infiltration'];
          if (militaryTypes.indexOf(it.type) >= 0) {
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_border_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: '边军塘报', type: '边报', subtype: '公疏',
              title: from + ' ' + typeInfo,
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn,
              urgency: it.type === 'declare_war' ? 'extreme' : 'urgent'
            });
            // 宣战已在上方入编年；其余军事事件也入编年
            if (it.type !== 'declare_war') {
              if (!GM.biannianItems) GM.biannianItems = [];
              GM.biannianItems.unshift({
                turn: turn, startTurn: turn, date: date,
                title: from + ' ' + typeInfo,
                content: desc, duration: 1,
                importance: it.type === 'border_clash' ? 'high' : 'medium',
                category: '军事'
              });
            }
          }
          // 并吞/承认独立 → 编年
          if (it.type === 'annex_vassal' || it.type === 'recognize_independence') {
            if (!GM.biannianItems) GM.biannianItems = [];
            GM.biannianItems.unshift({
              turn: turn, startTurn: turn, date: date,
              title: it.type === 'annex_vassal' ? (from + '并吞' + it.to) : (from + '宣告独立'),
              content: desc, duration: 1, importance: 'high', category: '政治'
            });
          }
          // 所有对玩家势力的行为都入起居注
          if (GM.qijuHistory) {
            GM.qijuHistory.unshift({
              turn: turn, date: date,
              content: '【外藩】' + from + ' → 本朝：' + typeInfo + (desc ? '——' + desc.substring(0,80) : ''),
              category: '外交'
            });
          }
        }

        // 处理科技/民政解锁（AI可在推演中解锁科技或推行政策）
        if (p1.tech_civic_unlocks && Array.isArray(p1.tech_civic_unlocks)) {
          p1.tech_civic_unlocks.forEach(function(tu) {
            if (!tu.name) return;
            if (tu.type === 'tech') {
              var tech = GM.techTree ? GM.techTree.find(function(t) { return t.name === tu.name && !t.unlocked; }) : null;
              if (tech) {
                tech.unlocked = true;
                // 扣除费用（如果有）
                if (tech.costs && Array.isArray(tech.costs)) {
                  tech.costs.forEach(function(c) { if (c.variable && GM.vars[c.variable]) GM.vars[c.variable].value = Math.max(GM.vars[c.variable].min||0, GM.vars[c.variable].value - (c.amount||0)); });
                }
                // 应用效果
                if (tech.effect) {
                  Object.entries(tech.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + (parseFloat(e[1])||0), GM.vars[e[0]].min||0, GM.vars[e[0]].max||9999); });
                }
                addEB('\u79D1\u6280', '\u89E3\u9501' + tu.name + (tu.reason ? '(' + tu.reason + ')' : ''));
              }
            } else if (tu.type === 'civic') {
              var civic = GM.civicTree ? GM.civicTree.find(function(c) { return c.name === tu.name && !c.adopted; }) : null;
              if (civic) {
                civic.adopted = true;
                if (civic.costs && Array.isArray(civic.costs)) {
                  civic.costs.forEach(function(c) { if (c.variable && GM.vars[c.variable]) GM.vars[c.variable].value = Math.max(GM.vars[c.variable].min||0, GM.vars[c.variable].value - (c.amount||0)); });
                }
                if (civic.effect) {
                  Object.entries(civic.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + (parseFloat(e[1])||0), GM.vars[e[0]].min||0, GM.vars[e[0]].max||9999); });
                }
                addEB('\u6C11\u653F', '\u63A8\u884C' + tu.name + (tu.reason ? '(' + tu.reason + ')' : ''));
              }
            }
          });
        }

        // 4.1: 处理国策变更（AI可添加/废除国策）
        if (p1.policy_changes && Array.isArray(p1.policy_changes)) {
          if (!GM.customPolicies) GM.customPolicies = [];
          var _pTree = (P.mechanicsConfig && P.mechanicsConfig.policyTree) || [];
          p1.policy_changes.forEach(function(pc) {
            if (!pc.action || !pc.name) return;
            if (pc.action === 'add') {
              // 检查前置条件
              var pDef = _pTree.find(function(pt) { return pt.name === pc.name || pt.id === pc.name; });
              if (pDef && pDef.prerequisites && pDef.prerequisites.length > 0) {
                var allMet = pDef.prerequisites.every(function(pre) {
                  return GM.customPolicies.some(function(cp) { return cp.name === pre || cp.id === pre; });
                });
                if (!allMet) { addEB('国策', pc.name + '前置条件不满足，未能施行'); return; }
              }
              if (!GM.customPolicies.some(function(cp) { return cp.name === pc.name; })) {
                GM.customPolicies.push({ name: pc.name, id: pc.name, enactedTurn: GM.turn, reason: pc.reason || '' });
                addEB('国策', '施行新国策：' + pc.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                // NPC记忆：所有在朝NPC记住新国策
                if (typeof NpcMemorySystem !== 'undefined') {
                  (GM.chars || []).forEach(function(c) {
                    if (c.alive !== false && !c.isPlayer && c.officialTitle) {
                      NpcMemorySystem.remember(c.name, '朝廷推行新国策：' + pc.name, '平', 4);
                    }
                  });
                }
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('policy:enacted', { name: pc.name, reason: pc.reason });
              }
            } else if (pc.action === 'remove') {
              var _idx = GM.customPolicies.findIndex(function(cp) { return cp.name === pc.name || cp.id === pc.name; });
              if (_idx >= 0) {
                GM.customPolicies.splice(_idx, 1);
                addEB('国策', '废除国策：' + pc.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                // NPC记忆：在朝NPC记住国策废除
                if (typeof NpcMemorySystem !== 'undefined') {
                  (GM.chars || []).forEach(function(c) {
                    if (c.alive !== false && !c.isPlayer && c.officialTitle) {
                      NpcMemorySystem.remember(c.name, '朝廷废除国策：' + pc.name, '平', 4);
                    }
                  });
                }
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('policy:abolished', { name: pc.name, reason: pc.reason });
              }
            }
          });
          if (GM.customPolicies.length > 30) GM.customPolicies = GM.customPolicies.slice(-30);
        }

        // 2.4: 处理阴谋干预（AI可推进/破坏/中止阴谋）
        if (p1.scheme_actions && Array.isArray(p1.scheme_actions) && GM.activeSchemes) {
          p1.scheme_actions.forEach(function(sa) {
            if (!sa.schemeId && !sa.schemer) return;
            var scheme = GM.activeSchemes.find(function(s) {
              return (sa.schemeId && s.id === sa.schemeId) || (sa.schemer && s.schemer === sa.schemer && s.status === 'active');
            });
            if (!scheme) return;
            if (sa.action === 'advance') {
              var _advAmt = Math.abs(parseInt(sa.amount) || 20);
              scheme.progress = Math.min(100, scheme.progress + Math.min(_advAmt, 50));
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '被推进(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划推进顺利', '喜', 5, scheme.target);
            } else if (sa.action === 'disrupt') {
              var _disAmt = Math.abs(parseInt(sa.amount) || 30);
              scheme.progress = Math.max(0, scheme.progress - Math.min(_disAmt, 50));
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '受阻(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划受阻：' + (sa.reason || ''), '忧', 6, scheme.target);
            } else if (sa.action === 'abort') {
              scheme.status = 'failure';
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '被迫中止(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划被迫中止', '忧', 8, scheme.target);
            } else if (sa.action === 'expose') {
              scheme.status = 'exposed';
              scheme.discovered = true;
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '阴谋败露(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(scheme.schemer, '对' + scheme.target + '的' + scheme.typeName + '阴谋败露，身败名裂', '忧', 9, scheme.target);
                NpcMemorySystem.remember(scheme.target, '识破了' + scheme.schemer + '的' + scheme.typeName + '阴谋', '怒', 8, scheme.schemer);
              }
              // 暴露的阴谋 → 风闻录事（高可信度公告）
              try {
                if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  PhaseD.addFengwen({
                    type: '\u63ED\u79C1',
                    text: scheme.schemer + '\u8C0B\u5BB3 ' + scheme.target + ' \u4E4B\u4E8B\u8D25\u9732\u2014\u2014' + String(sa.reason||'').slice(0,60),
                    credibility: 0.9,
                    source: 'scheme_exposed',
                    actors: [scheme.schemer, scheme.target],
                    turn: GM.turn
                  });
                }
              } catch(_e){}
              // 同步更新 ChronicleTracker 条目（阴谋暴露后对玩家可见）
              try {
                if (typeof ChronicleTracker !== 'undefined' && scheme.id) {
                  var _ex = ChronicleTracker.findBySource('scheme', scheme.id);
                  if (_ex) {
                    ChronicleTracker.update(_ex.id, { hidden: false, currentStage: '\u5DF2\u66B4\u9732', result: sa.reason || '' });
                    ChronicleTracker.abort(_ex.id, '\u5DF2\u66B4\u9732');
                  }
                }
              } catch(_e){}
            }
          });
        }

        // 处理时间线/事件触发（统一处理timeline和events）
        if (p1.timeline_triggers && Array.isArray(p1.timeline_triggers)) {
          // 1. 查找时间线事件
          if (P.timeline) {
            var _allTL = [].concat(P.timeline.past||[]).concat(P.timeline.future||[]);
            p1.timeline_triggers.forEach(function(tt) {
              if (!tt.name) return;
              var evt = _allTL.find(function(t) { return (t.name === tt.name || t.event === tt.name) && !t.triggered; });
              if (evt) {
                evt.triggered = true;
                evt.triggeredTurn = GM.turn;
                evt.triggeredResult = tt.result || '';
                addEB('\u5386\u53F2\u8282\u70B9', evt.name + '\u5DF2\u53D1\u751F' + (tt.result ? '\uFF1A' + tt.result : ''));
                _dbg('[TimelineTrigger] ' + evt.name);
              }
            });
          }
          // 2. 也查找编辑器定义的事件（GM.events）
          if (GM.events && GM.events.length > 0) {
            p1.timeline_triggers.forEach(function(tt) {
              if (!tt.name) return;
              var gmEvt = GM.events.find(function(e) { return e.name === tt.name && !e.triggered; });
              if (gmEvt) {
                gmEvt.triggered = true;
                gmEvt.triggeredTurn = GM.turn;
                gmEvt.triggeredResult = tt.result || '';
                addEB('\u4E8B\u4EF6', gmEvt.name + '\u5DF2\u89E6\u53D1' + (tt.result ? '\uFF1A' + tt.result : ''));
                _dbg('[EventTrigger] ' + gmEvt.name);
                // 连锁事件：如果有chainNext，提示AI关注
                if (gmEvt.chainNext) {
                  addEB('\u8FDE\u9501', gmEvt.name + '\u89E6\u53D1\u540E\u5E94\u7EE7\u7EED\u5F15\u53D1: ' + gmEvt.chainNext);
                }
              }
            });
          }
        }
        // 1.1: 处理诏令执行反馈——支持跨回合长期诏令的追报+连锁效应累积
        if (p1.edict_feedback && Array.isArray(p1.edict_feedback) && GM._edictTracker) {
          p1.edict_feedback.forEach(function(ef) {
            if (!ef.content && !ef.edictId) return;
            var tracker = null;
            // Path 1: 按 edictId 精确匹配（AI 若遵循指示会填 edictId）
            if (ef.edictId) {
              tracker = GM._edictTracker.find(function(t) { return t.id === ef.edictId; });
            }
            // Path 2: 按 content 模糊匹配本回合 pending
            if (!tracker && ef.content) {
              tracker = GM._edictTracker.find(function(t) {
                return t.turn === GM.turn && t.status === 'pending' && t.content.indexOf(ef.content.slice(0, 10)) >= 0;
              });
            }
            // Path 3: 跨回合匹配·对前回合未收束诏令追报
            if (!tracker && ef.content) {
              tracker = GM._edictTracker.find(function(t) {
                return t.turn < GM.turn && (t.status==='executing'||t.status==='partial'||t.status==='obstructed'||t.status==='pending_delivery')
                  && t.content.indexOf(ef.content.slice(0, 10)) >= 0;
              });
            }
            // Path 4: 按类别匹配本回合 pending
            if (!tracker) {
              tracker = GM._edictTracker.find(function(t) { return t.turn === GM.turn && t.status === 'pending'; });
            }
            if (tracker) {
              // 远方诏令——信使未送达前强制pending_delivery
              if (tracker._remoteTargets && tracker._letterIds && tracker._letterIds.length > 0) {
                var _allDelivered = tracker._letterIds.every(function(lid) {
                  var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
                  return lt && (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying');
                });
                if (!_allDelivered) {
                  tracker.status = 'pending_delivery';
                  tracker.feedback = ef.feedback || '信使尚在途中，目标NPC未收到诏令';
                  tracker.progressPercent = 0;
                  return;
                }
              }
              // 旧回合追报·连锁效应累积（不覆盖·累加）
              if (tracker.turn < GM.turn) {
                if (!tracker._chainEffects) tracker._chainEffects = [];
                tracker._chainEffects.push({
                  turn: GM.turn, status: ef.status || 'executing',
                  effect: ef.feedback || ef.content || '',
                  progress: parseInt(ef.progressPercent) || tracker.progressPercent || 0
                });
                // 累积进度·不倒退
                var newProg = parseInt(ef.progressPercent) || 0;
                if (newProg > (tracker.progressPercent || 0)) tracker.progressPercent = newProg;
                tracker.status = ef.status || tracker.status;
                tracker.feedback = ef.feedback || tracker.feedback;
              } else {
                // 本回合新诏令·初次设置
                tracker.status = ef.status || 'executing';
                tracker.assignee = ef.assignee || tracker.assignee || '';
                tracker.feedback = ef.feedback || '';
                tracker.progressPercent = parseInt(ef.progressPercent) || (ef.status === 'completed' ? 100 : 50);
              }
              // 受阻/完成推送到 eventBus 供 数值变化说明立即展示
              if (ef.status === 'obstructed') {
                addEB('\u8BCF\u4EE4\u53D7\u963B', tracker.category + '\uFF1A' + tracker.content.slice(0,40) + ' \u2014 ' + (ef.feedback || '\u6267\u884C\u53D7\u963B'));
              } else if (ef.status === 'completed') {
                addEB('\u8BCF\u4EE4\u529F\u6210', tracker.category + '\uFF1A' + tracker.content.slice(0,40) + ' \u2014 ' + (ef.feedback || '\u5DF2\u8F7D\u65BD\u884C'));
              } else if (ef.status === 'partial') {
                addEB('\u8BCF\u4EE4\u90E8\u884C', tracker.category + '\uFF1A' + tracker.content.slice(0,40) + ' \u2014 ' + (ef.feedback || '\u90E8\u5206\u6267\u884C'));
              } else if (tracker.turn < GM.turn) {
                addEB('\u8BCF\u4EE4\u8FDB\u5C55', tracker.category + '\uFF1A' + tracker.content.slice(0,30) + ' \u8FDB\u5C55 ' + (tracker.progressPercent||0) + '% \u2014 ' + (ef.feedback || ''));
              }
            }
          });
        }
      }else{
        shizhengji="\u63A8\u6F14\u5B8C\u6210";
      }

      // 1.4: 幻觉防火墙——后验校验（检查AI返回的人名/地名是否在白名单内）
      if (p1 && p1.npc_actions) {
        var _aliveSet = {};
        (GM.chars || []).forEach(function(c) { if (c.alive !== false) _aliveSet[c.name] = true; });
        p1.npc_actions.forEach(function(act) {
          if (act.name && !_aliveSet[act.name]) {
            // 尝试模糊匹配
            var _fuzzy = (typeof _fuzzyFindChar === 'function') ? _fuzzyFindChar(act.name) : null;
            if (_fuzzy) {
              DebugLog.log('ai', '[幻觉修正] NPC名' + act.name + '→' + _fuzzy.name);
              act.name = _fuzzy.name;
            } else {
              DebugLog.warn('ai', '[幻觉检测] AI生成了不存在的NPC: ' + act.name);
              act._hallucinated = true;
            }
          }
        });
        // 过滤掉无法修正的幻觉NPC行动
        p1.npc_actions = p1.npc_actions.filter(function(a) { return !a._hallucinated; });
      }
      }); // end Sub-call 1 _runSubcall

      // ═══════════════════════════════════════════════════════════
      // §5 sc15-sc27 后续子调用 + 收尾（NPC 深度·势力·财政·军事·审计·丰化·叙事）
      // ★ 并行优化（2026-04-30）：sc1 完成后扇出三路并行
      //   Branch A: sc15 → sc_memwrite（memwrite 消费 sc15 的 hidden_moves）
      //   Branch B: sc16/17/18 batch（已是 _runSubcallBatch 内部并发=3）
      //   Branch C: sc2 → sc27（sc27 修饰 sc2 的 zhengwen）
      //   三路无交集字段·下游消费者均通过 GM/p1 全局，立即可见
      // ═══════════════════════════════════════════════════════════

      // ── Branch A · NPC 深度推演 ──（P8.1: sc_memwrite 已移到 post-turn）
      var _branchA = (async function() {
      // --- Sub-call 1.5: NPC全面深度推演 --- [standard+full]
      await _runSubcall('sc15', 'NPC深度推演', 'standard', async function() {
      showLoading("NPC\u5168\u9762\u63A8\u6F14",60);
      try {
        // \u2605 \u4E16\u754C\u72B6\u6001\u5FEB\u7167\u6CE8\u5165\uFF08sc15 \u91CD\u70B9\uFF1A\u9632\u6B7B\u8005\u590D\u6D3B\u00B7\u63D0\u793A\u8FDB\u884C\u4E2D\u8BCF\u4EE4\u00B7\u5173\u7CFB\u7A81\u53D8\u00B7\u5DF2\u786E\u7ACB\u4E8B\u5B9E\uFF09
        var _ws15 = '';
        try {
          if (typeof _buildDeadPin === 'function') _ws15 += _buildDeadPin();
          if (typeof _buildCanonicalFacts === 'function') _ws15 += _buildCanonicalFacts();
          if (typeof _buildEdictProgressCards === 'function') _ws15 += _buildEdictProgressCards();
          if (typeof _buildRelationDeltas === 'function') _ws15 += _buildRelationDeltas();
        } catch(_wse15){ _dbg('[WorldSnap sc15] fail:', _wse15); }
        // 12 \u8868\u6CE8\u5165\uFF08\u4EC5\u4E8B\u5B9E\u5C42\u00B7courtNpc/charProfile/relationNet/imperialEdict\u00B7\u8FC7\u6EE4 secret \u7684\u5929\u673A\u6761\u76EE\uFF09
        var _mt15 = '';
        try {
          if (window.MemTables && MemTables.buildTablesInjection) {
            _mt15 = MemTables.buildTablesInjection({ include: ['courtNpc', 'charProfile', 'relationNet', 'imperialEdict', 'edictsActive'], hideSecret: true }) || '';
          }
        } catch(_mt15E){ _dbg('[MemTables sc15] fail:', _mt15E); }
        // \u65F6\u95F4\u53C2\u8003\uFF08Phase 4.1\uFF09
        var _tr15 = '';
        try { if (typeof _buildTimeRef === 'function') _tr15 = _buildTimeRef() || ''; } catch(_e){}
        var tp15 = _tr15 + _ws15 + _mt15 + '\u57FA\u4E8E\u672C\u56DE\u5408\u53D1\u751F\u7684\u4E8B\u4EF6\uFF1A\n';
        if (shizhengji) tp15 += '\u65F6\u653F\u8BB0\uFF1A' + shizhengji + '\n'; // 完整不截断
        if (p1 && p1.npc_actions && p1.npc_actions.length > 0) {
          tp15 += '\u5DF2\u77E5NPC\u884C\u52A8\uFF1A' + p1.npc_actions.map(function(a) { return a.name + ':' + a.action + (a.result?'\u2192'+a.result:''); }).join('\uFF1B') + '\n';
        }
        if (p1 && p1.faction_events && p1.faction_events.length > 0) {
          tp15 += '\u52BF\u529B\u4E8B\u4EF6\uFF1A' + p1.faction_events.map(function(fe){return (fe.actor||'')+fe.action;}).join('\uFF1B') + '\n';
        }
        // 全部存活角色完整状态（不限制数量）
        tp15 += '\n\u5168\u90E8\u5B58\u6D3B\u89D2\u8272\u5F53\u524D\u72B6\u6001\uFF1A\n';
        (GM.chars || []).filter(function(c) { return c.alive !== false; }).forEach(function(c) {
          var parts = [c.name];
          if (c.title) parts.push(c.title);
          if (c.faction) parts.push('\u52BF:' + c.faction);
          if (c.party) parts.push('\u515A:' + c.party);
          if (c.officialTitle && c.officialTitle !== '\u65E0') parts.push('\u5B98:' + c.officialTitle);
          parts.push('\u5FE0' + (c.loyalty || 50) + ' \u91CE' + (c.ambition || 50) + ' \u667A' + (c.intelligence || 50) + ' \u6B66\u52C7' + (c.valor || 50) + ' \u519B\u4E8B' + (c.military || 50) + ' \u653F' + (c.administration || 50) + ' \u7BA1' + (c.management || 50) + ' \u9B45' + (c.charisma || 50) + ' \u4EA4' + (c.diplomacy || 50) + ' \u4EC1' + (c.benevolence || 50));
          if (c.traits && c.traits.length > 0 && typeof getTraitBehaviorSummary === 'function') {
            parts.push('\u7279:' + c.traits.slice(0, 6).map(function(tid) {
              var t = (typeof TRAIT_LIBRARY !== 'undefined' && TRAIT_LIBRARY[tid]) ? TRAIT_LIBRARY[tid].name : tid;
              return t;
            }).join('\u3001'));
          }
          if ((c.stress || 0) > 20) parts.push('\u538B\u529B' + c.stress);
          if (c._mood && c._mood !== '\u5E73') parts.push('\u60C5:' + c._mood);
          if (c.personality) parts.push('\u6027:' + c.personality);
          if (c.spouse) parts.push('[\u540E\u5BAB]');
          if (c.personalGoal) parts.push('\u6C42:' + c.personalGoal.substring(0, 30));
          // 伤疤/勋章——永久影响此人行为的刻骨经历
          if (c._scars && c._scars.length > 0) {
            parts.push('\u4F24:' + c._scars.slice(-3).map(function(s) { return s.event + '[' + s.emotion + ']'; }).join(';'));
          }
          if (c.isPlayer) parts.push('\u2605\u73A9\u5BB6');
          tp15 += '  ' + parts.join(' ') + '\n';
        });
        // 加入显著矛盾（NPC行为应受矛盾驱动）
        if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
          tp15 += '\n\u3010\u663E\u8457\u77DB\u76FE\u2014\u2014NPC\u884C\u4E3A\u5E94\u53D7\u6B64\u9A71\u52A8\u3011\n';
          P.playerInfo.coreContradictions.forEach(function(c) { tp15 += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + '\n'; });
        }
        // 省份状况（影响地方官行为）
        if (GM.provinceStats) {
          var _critProv = Object.entries(GM.provinceStats).filter(function(e){return e[1].unrest>50||e[1].corruption>60;});
          if (_critProv.length > 0) {
            tp15 += '\n\u3010\u5371\u673A\u7701\u4EFD\u3011' + _critProv.map(function(e){return e[0]+' \u6C11\u53D8'+Math.round(e[1].unrest)+' \u8150'+Math.round(e[1].corruption);}).join('\uFF1B') + '\n';
          }
        }
        // 列出本回合的资源变化（让AI思考级联影响）
        if (p1 && p1.resource_changes) {
          tp15 += '\n\u672C\u56DE\u5408\u8D44\u6E90\u53D8\u5316\uFF1A';
          Object.entries(p1.resource_changes).forEach(function(e) { tp15 += e[0] + (parseFloat(e[1]) > 0 ? '+' : '') + e[1] + ' '; });
          tp15 += '\n';
        }
        tp15 += '\n请返回JSON。这是"水面下的冰山"——玩家看不到这些，但它们决定了未来走向：\n';
        tp15 += '{\n';
        tp15 += '  "hidden_moves":["某角色：因为什么→暗中做了什么→目的是什么(40字每条，至少7条)"],\n';
        tp15 += '  "mood_shifts":[{"name":"","loyalty_delta":0,"stress_delta":0,"mood":"新情绪","reason":"(30字)"}],\n';
        tp15 += '  "relationship_changes":[{"a":"角色A","b":"角色B","delta":0,"reason":"关系变化原因"}],\n';
        tp15 += '  "cascade_effects":{"变量名":变化量},\n';
        tp15 += '  "province_impacts":[{"name":"省份","unrest_delta":0,"prosperity_delta":0,"reason":""}],\n';
        tp15 += '  "class_reactions":[{"class":"阶层","satisfaction_delta":0,"reason":""}],\n';
        tp15 += '  "party_maneuvers":[{"party":"党派","action":"动作","target":"对谁"}],\n';
        tp15 += '  "faction_undercurrents":[{"faction":"势力名","situation":"内部局势(40字)","trend":"上升/稳定/动荡/衰落","nextMove":"下一步可能行动(30字)"}],\n';
        tp15 += '  "npc_schemes":[{"schemer":"谁","target":"针对谁","plan":"什么阴谋(40字)","progress":"酝酿中/即将发动/长期布局","allies":"同谋者"}],\n';
        tp15 += '  "rumors":"朝堂/军营/民间/后宫传闻各一条(100字)",\n';
        tp15 += '  "contradiction_shift":"矛盾演化方向(60字)"\n';
        tp15 += '}\n';
        tp15 += '\n■ hidden_moves要求：\n';
        tp15 += '  至少7条（角色越多越需要更多暗流）。必须包含：\n';
        tp15 += '  - 至少3条NPC对NPC的暗中行动（权臣排挤对手、将军暗中联络、谋士居中调停）\n';
        tp15 += '  - 至少1条势力内部暗流（某势力重臣暗中联络他国/谋划政变/收集首领罪证）\n';
        tp15 += '  - 至少1条小人物的小动作（小吏贪墨、商人囤货、探子传信、流民聚集）\n';
        tp15 += '  - 每条必须有"动机链"：因为什么→做了什么→想达到什么目的\n';
        tp15 += '  - 如前几回合有伏笔/暗流，应在此回收或推进\n';
        tp15 += '\n■ faction_undercurrents：每个非玩家势力一条——它们的内部在发生什么？\n';
        tp15 += '  situation写当前内部局势（如"权臣与太子争权白热化""改革派占上风""粮荒导致军心不稳"）\n';
        tp15 += '  trend写趋势方向；nextMove写这个势力下一步可能采取的行动\n';
        tp15 += '\n■ npc_schemes：正在酝酿中的阴谋——可能跨多回合。至少2条。\n';
        tp15 += '  progress:"酝酿中"的阴谋不会本回合发动，但会在future turns逐步推进\n';
        tp15 += '  progress:"即将发动"的阴谋会在下1-2回合爆发\n';
        tp15 += '\n■ mood_shifts: 每个受本回合事件影响的角色都应有心态变化。\n';
        tp15 += '■ relationship_changes: NPC之间的关系变动（不只是NPC与玩家的关系）。';

        var resp15 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp15}], temperature:P.ai.temp||0.8, max_tokens:_tok(12000)})});
        if (resp15.ok) {
          var data15 = await resp15.json();
          _checkTruncated(data15, '人物关系');
          var c15 = '';
          if (data15.choices && data15.choices[0] && data15.choices[0].message) c15 = data15.choices[0].message.content;
          var p15 = extractJSON(c15);
          if (p15) {
            // 应用心态变化
            if (p15.mood_shifts && Array.isArray(p15.mood_shifts)) {
              p15.mood_shifts.forEach(function(ms) {
                if (!ms.name) return;
                var msCh = findCharByName(ms.name);
                if (!msCh) return;
                if (ms.loyalty_delta) msCh.loyalty = clamp((msCh.loyalty || 50) + clamp(parseInt(ms.loyalty_delta) || 0, -10, 10), 0, 100);
                if (ms.stress_delta) msCh.stress = clamp((msCh.stress || 0) + clamp(parseInt(ms.stress_delta) || 0, -10, 10), 0, 100);
              });
            }
            // 应用隐藏关系变化
            if (p15.relationship_changes && Array.isArray(p15.relationship_changes)) {
              p15.relationship_changes.forEach(function(rc) {
                if (!rc.a || !rc.b || !rc.delta) return;
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(rc.a, rc.b, clamp(parseInt(rc.delta) || 0, -15, 15), rc.reason || '\u6697\u6D41');
              });
            }
            // 隐藏行动记入事件日志
            if (p15.hidden_moves && Array.isArray(p15.hidden_moves)) {
              p15.hidden_moves.forEach(function(hm) { addEB('\u6697\u6D41', hm); });
            }
            // 应用级联变量效果（AI补充的连锁影响）
            if (p15.cascade_effects && typeof p15.cascade_effects === 'object') {
              Object.entries(p15.cascade_effects).forEach(function(ce) {
                var varName = ce[0], delta = parseFloat(ce[1]);
                if (isNaN(delta) || !GM.vars[varName]) return;
                // 级联变化幅度限制（防止AI过度调整）
                delta = clamp(delta, -GM.vars[varName].max * 0.05, GM.vars[varName].max * 0.05);
                if (Math.abs(delta) >= 0.1) {
                  GM.vars[varName].value = clamp(GM.vars[varName].value + delta, GM.vars[varName].min, GM.vars[varName].max);
                  _dbg('[Cascade] ' + varName + ': ' + (delta > 0 ? '+' : '') + delta.toFixed(1));
                }
              });
            }
            // 应用省份影响
            if (p15.province_impacts && Array.isArray(p15.province_impacts)) {
              p15.province_impacts.forEach(function(pi) {
                if (!pi.name || !GM.provinceStats || !GM.provinceStats[pi.name]) return;
                var ps = GM.provinceStats[pi.name];
                if (pi.unrest_delta) ps.unrest = clamp((ps.unrest||10) + clamp(parseInt(pi.unrest_delta)||0, -10, 10), 0, 100);
                if (pi.prosperity_delta) ps.wealth = clamp((ps.wealth||50) + clamp(parseInt(pi.prosperity_delta)||0, -8, 8), 0, 100);
              });
            }
            // 应用阶层反应
            if (p15.class_reactions && Array.isArray(p15.class_reactions) && GM.classes) {
              p15.class_reactions.forEach(function(cr) {
                if (!cr.class) return;
                var cls = GM.classes.find(function(c){return c.name===cr.class;});
                if (cls && cr.satisfaction_delta) cls.satisfaction = clamp(parseInt(cls.satisfaction||50) + clamp(parseInt(cr.satisfaction_delta)||0, -8, 8), 0, 100);
              });
            }
            // 应用党派动作到事件日志
            if (p15.party_maneuvers && Array.isArray(p15.party_maneuvers)) {
              p15.party_maneuvers.forEach(function(pm) { if (pm.party && pm.action) addEB('\u515A\u4E89', pm.party + '：' + pm.action + (pm.target ? '(\u9488\u5BF9' + pm.target + ')' : '')); });
            }
            // 矛盾演化记入事件
            if (p15.contradiction_shift) addEB('\u77DB\u76FE', p15.contradiction_shift);
            // 流言用于Sub-call 2叙事
            if (p15.rumors) p1Summary = (p1Summary || '') + '\u3010\u6D41\u8A00\u3011' + p15.rumors + '\n';

            // 势力内部暗流——保留历史（最近3回合的暗流，供AI看到趋势演变）
            if (p15.faction_undercurrents && Array.isArray(p15.faction_undercurrents)) {
              if (!GM._factionUndercurrents) GM._factionUndercurrents = [];
              if (!GM._factionUndercurrentsHistory) GM._factionUndercurrentsHistory = [];
              // 存档当前轮暗流到历史
              if (GM._factionUndercurrents.length > 0) {
                GM._factionUndercurrentsHistory.push({ turn: GM.turn, data: GM._factionUndercurrents });
                if (GM._factionUndercurrentsHistory.length > 3) GM._factionUndercurrentsHistory.shift();
              }
              GM._factionUndercurrents = p15.faction_undercurrents;
              p15.faction_undercurrents.forEach(function(fu) {
                if (fu.faction && fu.situation) {
                  addEB('势力·内幕', fu.faction + '：' + fu.situation + (fu.trend ? '（' + fu.trend + '）' : ''));
                  // 动荡/衰落的势力扣strength
                  if (fu.trend === '动荡' || fu.trend === '衰落') {
                    var _uFac = findFacByName(fu.faction);
                    if (_uFac) _uFac.strength = Math.max(1, (_uFac.strength||50) - (fu.trend === '衰落' ? 2 : 1));
                  }
                }
              });
            }

            // NPC阴谋——存入GM，跨回合持续推进
            if (p15.npc_schemes && Array.isArray(p15.npc_schemes)) {
              if (!GM.activeSchemes) GM.activeSchemes = [];
              p15.npc_schemes.forEach(function(sc2) {
                if (!sc2.schemer || !sc2.plan) return;
                // 查找是否有已存在的同一阴谋
                var existing = GM.activeSchemes.find(function(s) { return s.schemer === sc2.schemer && s.target === sc2.target; });
                if (existing) {
                  // 更新进度
                  existing.plan = sc2.plan;
                  existing.progress = sc2.progress || existing.progress;
                  existing.allies = sc2.allies || existing.allies;
                  existing.lastTurn = GM.turn;
                } else {
                  GM.activeSchemes.push({ schemer: sc2.schemer, target: sc2.target || '', plan: sc2.plan, progress: sc2.progress || '酝酿中', allies: sc2.allies || '', startTurn: GM.turn, lastTurn: GM.turn });
                }
                // 记入阴谋者记忆
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(sc2.schemer, '\u6697\u4E2D\u8C0B\u5212\uFF1A' + sc2.plan, '\u5E73', 4, sc2.target || '');
                }
                addEB('暗流', sc2.schemer + '密谋' + (sc2.target ? '针对' + sc2.target : '') + '（' + (sc2.progress || '') + '）');
              });
              // 清理过期阴谋（超过5回合未更新的视为放弃）
              GM.activeSchemes = GM.activeSchemes.filter(function(s) { return GM.turn - s.lastTurn < 5; });
            }

            GM._turnAiResults.subcall15 = p15;
            _dbg('[NPC Deep] hidden:', (p15.hidden_moves||[]).length, 'mood:', (p15.mood_shifts||[]).length, 'undercurrents:', (p15.faction_undercurrents||[]).length, 'schemes:', (p15.npc_schemes||[]).length);
          }
        }
      } catch(e15) { _dbg('[NPC Deep] \u5931\u8D25:', e15); throw e15; }
      }); // end Sub-call 1.5 _runSubcall
      })(); // ── end Branch A IIFE (P8.1: 仅含 sc15·sc_memwrite 已移到 post-turn 队列) ──

      // --- Sub-call SC_MEMWRITE: NPC 记忆自动回写 (P8.1 移到 post-turn·消费方仅是下回合 NPC 记忆系统) ---
      _queuePostTurnSubcall('sc_memwrite', function(){ return _runSubcall('sc_memwrite', 'NPC记忆回写', 'lite', async function() {
      showLoading("NPC\u8BB0\u5FC6\u56DE\u5199", 67);
      try {
        var _p15 = (GM._turnAiResults && GM._turnAiResults.subcall15) || {};
        // 收集输入
        var tpMW = '【任务·从本回合叙事中为每个涉事 NPC 提取结构化记忆条目】\n\n';
        tpMW += '<shizhengji>' + ((p1 && p1.shizhengji) || '').substring(0, 3000) + '</shizhengji>\n';
        tpMW += '<shilu>' + ((p1 && p1.shilu_text) || '').substring(0, 2000) + '</shilu>\n';
        if (p1 && p1.npc_actions && p1.npc_actions.length) {
          tpMW += '<npc-actions>\n';
          p1.npc_actions.slice(0, 30).forEach(function(a) {
            tpMW += '  <action char="' + (a.name||'') + '" target="' + (a.target||'') + '">' + (a.action||'') + ' → ' + (a.result||'') + '</action>\n';
          });
          tpMW += '</npc-actions>\n';
        }
        if (_p15.hidden_moves && _p15.hidden_moves.length) {
          tpMW += '<hidden-moves>\n';
          _p15.hidden_moves.slice(0, 20).forEach(function(h) {
            tpMW += '  <move char="' + (h.char||'') + '">' + (h.action||'') + '</move>\n';
          });
          tpMW += '</hidden-moves>\n';
        }
        if (p1 && Array.isArray(p1.faction_events)) {
          tpMW += '<faction-events>\n';
          p1.faction_events.slice(0, 15).forEach(function(fe) {
            tpMW += '  <event actor="' + (fe.actor||'') + '" target="' + (fe.target||'') + '">' + (fe.action||'') + '</event>\n';
          });
          tpMW += '</faction-events>\n';
        }

        tpMW += '\n【输出 JSON 严格 schema】\n';
        tpMW += '{\n';
        tpMW += '  "memory_writes": [\n';
        tpMW += '    {\n';
        tpMW += '      "char": "记忆归属的角色名（必须是 GM.chars 中存在的）",\n';
        tpMW += '      "event": "第三人称叙事·20-60字·含具体动作/对象/结果",\n';
        tpMW += '      "emotion": "喜/怒/忧/惧/恨/敬/平/察/警/强/谦 之一",\n';
        tpMW += '      "importance": 1-10 数值·依事件对此角色的震撼度·日常琐事1-3·重大事件7-10,\n';
        tpMW += '      "relatedPerson": "本事件中与 char 最相关的另一方（可空）",\n';
        tpMW += '      "participants": ["在场所有参与者姓名·含 char 与 relatedPerson"],\n';
        tpMW += '      "source": "witnessed（亲历）/reported（他人转述）/rumor（风闻）/intuition（直觉）",\n';
        tpMW += '      "credibility": 0-100 整数·witnessed=90+·reported=60-80·rumor=30-50,\n';
        tpMW += '      "location": "发生地点·如未提及则留空",\n';
        tpMW += '      "witnesses": ["在场但非参与的目击者·如未提及则空数组"],\n';
        tpMW += '      "type": "betrayal/kindness/humiliation/promotion/loss/marriage/military/dialogue/scheme/general",\n';
        tpMW += '      "arcId": "归属 arc 的 id·格式「arc_{turn}_{slug}」·若为新 arc·须与 arc_updates 中同 arc 的 id 字段完全一致（同一 id 出现两处：arc_updates.id 和 memory_writes.arcId）"\n';
        tpMW += '    }\n';
        tpMW += '  ],\n';
        tpMW += '  "arc_updates": [\n';
        tpMW += '    {\n';
        tpMW += '      "char": "arc 归属角色",\n';
        tpMW += '      "id": "arc 现有id或留空",\n';
        tpMW += '      "title": "剧情弧标题·如「北伐之议」",\n';
        tpMW += '      "type": "political/military/personal/economic/succession/foreign/romance/revenge",\n';
        tpMW += '      "phase": "brewing/rising/climax/resolving/resolved",\n';
        tpMW += '      "participants": ["参与者"],\n';
        tpMW += '      "emotionalTrajectory": "情感轨迹描述·如「期待→怀疑→失望」",\n';
        tpMW += '      "unresolved": "尚未解决的核心问题"\n';
        tpMW += '    }\n';
        tpMW += '  ],\n';
        tpMW += '  "causal_edges": [\n';
        tpMW += '    {\n';
        tpMW += '      "from": "原因事件id或描述",\n';
        tpMW += '      "to": "结果事件id或描述",\n';
        tpMW += '      "type": "triggered/enabled/prevented/accelerated",\n';
        tpMW += '      "strength": 0-1 小数,\n';
        tpMW += '      "explanation": "因果关系说明·30字内"\n';
        tpMW += '    }\n';
        tpMW += '  ]\n';
        tpMW += '}\n\n';
        tpMW += '【原则】\n';
        tpMW += '· 宁多勿漏：叙事中每个有名有姓涉事者都应获得至少一条 memory_write\n';
        tpMW += '· 镜像互感：A 羞辱 B·不需要写两条（B 那条由系统自动镜像）·但要为"在场的 C"也写一条 source=witnessed\n';
        tpMW += '· 感官具体：能填 location/witnesses 就填·这是质感的关键\n';
        tpMW += '· 可信度严谨：仅"在场目击"=witnessed；转述=reported；坊间=rumor\n';
        tpMW += '· arc 延续：同一主题跨回合的事件·尽量关联到已有 arc_id（若 char._arcs 已有同主题）\n';
        tpMW += '· 因果要节制：causal_edges 只写强逻辑关系·不追求多\n';

        var _cpMW = (typeof getCompressionParams === 'function') ? getCompressionParams() : { scale: 1.0 };
        var _mwBudget = Math.round(8000 * Math.max(1.0, _cpMW.scale));
        var respMW = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + P.ai.key },
          body: JSON.stringify({
            model: P.ai.model || "gpt-4o",
            messages: [{ role: "system", content: _maybeCacheSys(sysP) }, { role: "user", content: tpMW }],
            temperature: 0.5,
            max_tokens: _mwBudget
          })
        });
        if (respMW.ok) {
          var dataMW = await respMW.json();
          _checkTruncated(dataMW, 'NPC记忆回写');
          var cMW = '';
          if (dataMW.choices && dataMW.choices[0] && dataMW.choices[0].message) cMW = dataMW.choices[0].message.content;
          var pMW = extractJSON(cMW);
          if (pMW) {
            GM._turnAiResults.subcallMemwrite = pMW;
            // 应用 arc_updates（先做·让 memory_writes 能引用 arcId）
            if (Array.isArray(pMW.arc_updates)) {
              pMW.arc_updates.forEach(function(au) {
                if (!au || !au.char || !au.title) return;
                if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.upsertArc) {
                  NpcMemorySystem.upsertArc(au.char, au);
                }
              });
            }
            // 应用 memory_writes
            var _mwCount = 0;
            if (Array.isArray(pMW.memory_writes)) {
              pMW.memory_writes.forEach(function(mw) {
                if (!mw || !mw.char || !mw.event) return;
                if (typeof NpcMemorySystem === 'undefined' || !NpcMemorySystem.remember) return;
                try {
                  NpcMemorySystem.remember(
                    mw.char,
                    mw.event,
                    mw.emotion || '平',
                    mw.importance || 5,
                    mw.relatedPerson || '',
                    {
                      type: mw.type,
                      source: mw.source,
                      credibility: mw.credibility,
                      location: mw.location,
                      witnesses: mw.witnesses,
                      participants: mw.participants,
                      arcId: mw.arcId
                    }
                  );
                  _mwCount++;
                } catch(_mwE) { _dbg('[MemWrite] remember failed for', mw.char, _mwE); }
              });
            }
            // 应用 causal_edges
            if (Array.isArray(pMW.causal_edges) && pMW.causal_edges.length > 0) {
              if (!GM._causalGraph) GM._causalGraph = { nodes: [], edges: [] };
              pMW.causal_edges.forEach(function(ce) {
                if (!ce || !ce.from || !ce.to) return;
                GM._causalGraph.edges.push({
                  id: 'e_' + (GM.turn||0) + '_' + Math.random().toString(36).slice(2,5),
                  from: ce.from, to: ce.to,
                  type: ce.type || 'triggered',
                  strength: Math.max(0, Math.min(1, parseFloat(ce.strength) || 0.5)),
                  explanation: (ce.explanation || '').substring(0, 80),
                  turn: GM.turn || 0
                });
              });
              // 限制总量（保留最近 300 条边）
              if (GM._causalGraph.edges.length > 300) GM._causalGraph.edges = GM._causalGraph.edges.slice(-300);
            }
            _dbg('[MemWrite] 回写', _mwCount, '条 NPC 记忆·', (pMW.arc_updates||[]).length, '个 arc 更新·', (pMW.causal_edges||[]).length, '条因果');
          }
        }
      } catch(eMW) { _dbg('[MemWrite] 失败:', eMW); /* P8.1 post-turn·静默失败不抛 */ }
      }); }); // end SC_MEMWRITE (queued post-turn)

      // ── Branch B · 势力·经济·军事专项（_runSubcallBatch 已内部 concurrency=3）──
      // --- Sub-call 1.6/1.7/1.8 batch --- [full only]
      var _branchB = _runSubcallBatch('full-specialty', [
      function(){ return _runSubcall('sc16', '势力推演', 'full', async function() {
      showLoading("\u52BF\u529B\u81EA\u4E3B\u63A8\u6F14",63);
      try {
        var tp16 = '\u57FA\u4E8E\u672C\u56DE\u5408\u5C40\u52BF\uFF0C\u63A8\u6F14\u6BCF\u4E2A\u975E\u73A9\u5BB6\u52BF\u529B\u7684\u81EA\u4E3B\u884C\u52A8\uFF1A\n';
        tp16 += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji||'').substring(0,500) + '\n';
        (GM.facs||[]).forEach(function(f) {
          if (f.isPlayer) return;
          tp16 += f.name + ' \u5B9E\u529B' + (f.strength||50) + (f.leader?' \u9996\u9886:'+f.leader:'') + (f.goal?' \u76EE\u6807:'+f.goal:'') + (f.attitude?' \u6001\u5EA6:'+f.attitude:'') + '\n';
        });
        if (GM.factionRelations && GM.factionRelations.length > 0) {
          tp16 += '\u52BF\u529B\u5173\u7CFB\uFF1A' + GM.factionRelations.map(function(r){return r.from+'\u2192'+r.to+' '+r.type+'('+r.value+')';}).join('\uFF1B') + '\n';
        }
        // 势力暗流（连续性——上回合行动应有后续）
        if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) {
          tp16 += '\n【势力暗流——上回合行动应有后续进展】\n';
          GM._factionUndercurrents.forEach(function(fu) {
            tp16 += '  ' + fu.faction + '：' + fu.situation + (fu.nextMove ? ' 可能行动:' + fu.nextMove : '') + '\n';
          });
        }
        // 势力叙事（记忆上文）
        if (GM._factionNarratives) {
          var _fnKeys = Object.keys(GM._factionNarratives);
          if (_fnKeys.length > 0) {
            tp16 += '【势力发展记忆】\n';
            _fnKeys.forEach(function(k) { tp16 += '  ' + k + '\uFF1A' + (GM._factionNarratives[k]||'') + '\n'; });
          }
        }
        tp16 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"faction_actions":[{"faction":"\u52BF\u529B\u540D","action":"\u5177\u4F53\u884C\u52A8(50\u5B57)","target":"\u5BF9\u8C01","motive":"\u52A8\u673A","impact":"\u5F71\u54CD"}],"diplomatic_shifts":[{"from":"","to":"","old_relation":"","new_relation":"","reason":""}],"territorial_changes":"\u9886\u571F\u53D8\u5316\u63CF\u8FF0(100\u5B57)","power_balance_shift":"\u529B\u91CF\u5BF9\u6BD4\u53D8\u5316(100\u5B57)"}\n';
        tp16 += '\u6BCF\u4E2A\u52BF\u529B\u90FD\u5E94\u6709\u884C\u52A8\u3002\u5305\u62EC\u6218\u4E89\u3001\u8054\u76DF\u3001\u8D38\u6613\u3001\u5185\u90E8\u6574\u5408\u3001\u6269\u5F20\u3001\u9632\u5FA1\u7B49\u3002';
        var resp16 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp16}], temperature:P.ai.temp||0.8, max_tokens:_tok(8000)})});
        if (resp16.ok) {
          var j16 = await resp16.json(); _checkTruncated(j16, '势力行动'); var c16 = j16.choices&&j16.choices[0]?j16.choices[0].message.content:'';
          var p16 = extractJSON(c16);
          if (p16) {
            if (p16.faction_actions && Array.isArray(p16.faction_actions)) {
              p16.faction_actions.forEach(function(fa) { if (fa.faction && fa.action) addEB('\u52BF\u529B\u52A8\u6001', fa.faction + '：' + fa.action); });
            }
            if (p16.diplomatic_shifts && Array.isArray(p16.diplomatic_shifts)) {
              p16.diplomatic_shifts.forEach(function(ds) {
                if (ds.from && ds.to && GM.factionRelations) {
                  var rel = GM.factionRelations.find(function(r){return r.from===ds.from&&r.to===ds.to;});
                  if (rel && ds.new_relation) { rel.type = ds.new_relation; addEB('\u5916\u4EA4', ds.from+'\u2192'+ds.to+' '+ds.new_relation); }
                }
              });
            }
            p1Summary = (p1Summary||'') + '\u3010\u52BF\u529B\u52A8\u6001\u3011' + (p16.power_balance_shift||'') + '\n';
            GM._turnAiResults.subcall16 = p16;
          }
        }
      } catch(e16) { _dbg('[Faction Auto] fail:', e16); throw e16; }
      }); }, // end Sub-call 1.6 _runSubcall

      // --- Sub-call 1.7: 经济财政专项推演 --- [full only]
      function(){ return _runSubcall('sc17', '经济财政', 'full', async function() {
      showLoading("\u7ECF\u6D4E\u8D22\u653F\u63A8\u6F14",65);
      try {
        var tp17 = '\u672C\u56DE\u5408\u7ECF\u6D4E\u8D22\u653F\u72B6\u51B5\uFF1A\n';
        Object.entries(GM.vars||{}).forEach(function(e) { tp17 += '  ' + e[0] + '=' + Math.round(e[1].value) + (e[1].unit||'') + '\n'; });
        if (GM.provinceStats) {
          tp17 += '\u5730\u65B9\u533A\u5212\uFF1A\n';
          Object.entries(GM.provinceStats).forEach(function(e) { var ps=e[1]; tp17 += '  ' + e[0] + ' \u7A0E'+ps.taxRevenue+' \u8D22'+ps.wealth+' \u6C11\u53D8'+Math.round(ps.unrest)+' \u8150'+Math.round(ps.corruption)+'\n'; });
        }
        if (p1 && p1.resource_changes) tp17 += '\u672C\u56DE\u5408\u8D44\u6E90\u53D8\u5316\uFF1A' + JSON.stringify(p1.resource_changes) + '\n';
        tp17 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"fiscal_analysis":"\u8D22\u653F\u5B8C\u6574\u5206\u6790\u2014\u2014\u6536\u5165\u6765\u6E90\u3001\u652F\u51FA\u538B\u529B\u3001\u76C8\u4E8F\u72B6\u51B5(200\u5B57)","trade_dynamics":"\u8D38\u6613\u548C\u5546\u4E1A\u52A8\u6001(100\u5B57)","inflation_pressure":"\u901A\u80C0/\u7269\u4EF7\u538B\u529B(80\u5B57)","resource_forecast":"\u4E0B\u56DE\u5408\u8D44\u6E90\u9884\u6D4B(100\u5B57)","economic_advice":"\u7ECF\u6D4E\u5EFA\u8BAE\u2014\u2014\u5E94\u8BE5\u505A\u4EC0\u4E48\u4E0D\u5E94\u8BE5\u505A\u4EC0\u4E48(100\u5B57)","supplementary_resource_changes":{"\u53D8\u91CF\u540D":\u8865\u5145\u53D8\u5316\u91CF}}';
        var resp17 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp17}], temperature:0.6, max_tokens:_tok(12000)})});
        if (resp17.ok) {
          var j17 = await resp17.json(); _checkTruncated(j17, '资源变动'); var c17 = j17.choices&&j17.choices[0]?j17.choices[0].message.content:'';
          var p17 = extractJSON(c17);
          if (p17) {
            if (p17.supplementary_resource_changes && typeof p17.supplementary_resource_changes === 'object') {
              Object.entries(p17.supplementary_resource_changes).forEach(function(e) {
                var d = parseFloat(e[1]); if (isNaN(d) || !GM.vars[e[0]]) return;
                d = clamp(d, -GM.vars[e[0]].max*0.03, GM.vars[e[0]].max*0.03);
                if (Math.abs(d) >= 0.1) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value+d, GM.vars[e[0]].min, GM.vars[e[0]].max);
              });
            }
            p1Summary = (p1Summary||'') + '\u3010\u8D22\u653F\u3011' + (p17.fiscal_analysis||'').substring(0,100) + '\n';
            GM._turnAiResults.subcall17 = p17;
          }
        }
      } catch(e17) { _dbg('[Econ] fail:', e17); throw e17; }
      }); }, // end Sub-call 1.7 _runSubcall

      // --- Sub-call 1.8: 军事态势专项推演 --- [full only]
      function(){ return _runSubcall('sc18', '军事态势', 'full', async function() {
      showLoading("\u519B\u4E8B\u6001\u52BF\u63A8\u6F14",67);
      try {
        var tp18 = '\u672C\u56DE\u5408\u519B\u4E8B\u6001\u52BF\uFF1A\n';
        // 找出玩家势力
        var _playerFac = '';
        try { var _pcM = (GM.chars||[]).find(function(c){return c&&c.isPlayer;}); if (_pcM) _playerFac = _pcM.faction || ''; } catch(_){}
        // 按势力分组列兵·清晰显示"我方/敌方/中立"
        var _armyByFac = {};
        (GM.armies||[]).forEach(function(a) {
          if (a.destroyed) return;
          var fac = a.faction || '无势力';
          if (!_armyByFac[fac]) _armyByFac[fac] = [];
          _armyByFac[fac].push(a);
        });
        Object.keys(_armyByFac).forEach(function(fac) {
          var marker = fac === _playerFac ? '【我方·'+fac+'】' : ('【'+fac+'·敌/中】');
          tp18 += '\n' + marker + '\n';
          _armyByFac[fac].forEach(function(a) {
            tp18 += '  ' + a.name + ' 兵' + (a.soldiers||0) + ' 士气' + (a.morale||50) + ' 训' + (a.training||50) + (a.commander?' 帅:'+a.commander:'') + (a.garrison?' 驻:'+a.garrison:'') + '\n';
          });
        });
        if (p1 && p1.army_changes && p1.army_changes.length > 0) tp18 += '\u672C\u56DE\u5408\u519B\u4E8B\u53D8\u52A8\uFF1A' + p1.army_changes.map(function(a){return a.name+' \u5175'+a.soldiers_delta;}).join('\uFF1B') + '\n';

        tp18 += '\n【铁律·势力军事自主】\n';
        tp18 += '· 非玩家势力（后金/察哈尔/朝鲜/郑氏/流民/外族等）的军队·由你自主推演其军事行动：扩张/掠袭/征服/防御/内争/联盟/背叛\n';
        tp18 += '· 各势力按其性格+战略+资源自主决策——后金必图辽西·皇太极可能绕蒙古入塞；察哈尔被后金逼西迁；朝鲜夹缝求存；郑氏海商谋台海\n';
        tp18 += '· 敌方势力兵力·玩家不可直接调动·但可通过外交/册封/招抚/挑衅影响其行动\n';
        tp18 += '· 两势力交锋·按双方兵力/士气/装备/补给/训练/统帅能力综合推演·给出具体伤亡与结果\n';
        tp18 += '· 每个非玩家势力本回合应至少 1 条 faction_military_actions 条目（兵力调动/作战/备战/征募等）\n';
        tp18 += '\n请返回JSON：{"military_situation":"全局军事态势分析(200字)","border_threats":"边境威胁评估(150字)","army_morale_analysis":"各军士气分析和风险(100字)","supplementary_army_changes":[{"name":"部队","faction":"所属","soldiers_delta":0,"morale_delta":0,"reason":""}],"faction_military_actions":[{"faction":"势力名","action":"军事行动30字","targetFaction":"目标势力可空","casualties":0,"outcome":"结果30字","rationale":"动机30字"}],"war_probability":"下回合爆发战争的概率和方向(80字)"}';
        var resp18 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp18}], temperature:0.7, max_tokens:_tok(12000)})});
        if (resp18.ok) {
          var j18 = await resp18.json(); _checkTruncated(j18, '军事变动'); var c18 = j18.choices&&j18.choices[0]?j18.choices[0].message.content:'';
          var p18 = extractJSON(c18);
          if (p18) {
            if (p18.supplementary_army_changes && Array.isArray(p18.supplementary_army_changes)) {
              p18.supplementary_army_changes.forEach(function(ac) {
                if (!ac.name) return;
                var army = (GM.armies||[]).find(function(a){return a.name===ac.name;});
                if (army) {
                  if (ac.soldiers_delta) army.soldiers = Math.max(0, (army.soldiers||0) + clamp(parseInt(ac.soldiers_delta)||0, -2000, 2000));
                  if (ac.morale_delta) army.morale = clamp((army.morale||50) + clamp(parseInt(ac.morale_delta)||0, -15, 15), 0, 100);
                  if (ac.reason) addEB('\u519B\u4E8B', army.name + '：' + ac.reason);
                }
              });
            }
            // 各势力军事行动
            if (Array.isArray(p18.faction_military_actions) && p18.faction_military_actions.length > 0) {
              if (!GM._factionMilitaryLog) GM._factionMilitaryLog = [];
              p18.faction_military_actions.forEach(function(fa) {
                if (!fa || !fa.faction) return;
                GM._factionMilitaryLog.push({
                  turn: GM.turn, faction: fa.faction, target: fa.targetFaction||'',
                  action: (fa.action||'').substring(0, 60),
                  casualties: parseInt(fa.casualties)||0,
                  outcome: (fa.outcome||'').substring(0, 60),
                  rationale: (fa.rationale||'').substring(0, 60)
                });
                if (typeof addEB==='function') addEB('势力军事', fa.faction + (fa.targetFaction?'→'+fa.targetFaction:'') + '：' + (fa.action||'').substring(0,40) + (fa.casualties?'·伤亡'+fa.casualties:''));
                // 若伤亡·自动给该势力所属军兵力扣减
                if (fa.casualties > 0) {
                  var facArmies = (GM.armies||[]).filter(function(a){return a && a.faction===fa.faction;});
                  if (facArmies.length > 0) {
                    var perArmy = Math.floor(fa.casualties / facArmies.length);
                    facArmies.forEach(function(aa){ aa.soldiers = Math.max(0, (aa.soldiers||0) - perArmy); });
                  }
                }
              });
              // 上限保持最近 200 条
              if (GM._factionMilitaryLog.length > 200) GM._factionMilitaryLog = GM._factionMilitaryLog.slice(-200);
            }
            p1Summary = (p1Summary||'') + '\u3010\u519B\u4E8B\u3011' + (p18.military_situation||'').substring(0,100) + '\n';
            GM._turnAiResults.subcall18 = p18;
          }
        }
      } catch(e18) { _dbg('[Military] fail:', e18); throw e18; }
      }); } // end Sub-call 1.8 _runSubcall
      ], 3);

      // --- SC_CONSISTENCY_AUDIT: 深化数据一致性审核（方向7扩展·S3） ---
      // 扫描 SC16/17/18 彼此的输出是否冲突·auto-patch 或 rerun
      // 保持前台收束：审计可能修正 _turnAiResults 中被 sc2 摘要读取的对象引用。
      var _runConsistencyAudit = async function(){ return _runSubcall('sc_audit', '数据一致性审核', 'lite', async function() {
      _quietLoad("\u6570\u636E\u4E00\u81F4\u6027\u5BA1\u6838", 66);
      try {
        var _tres = GM._turnAiResults || {};
        var tpAu = '【任务·跨 sub-call 数据一致性审核】\n\n';
        tpAu += '<subcall-1-core>\n';
        if (_tres.subcall1) {
          tpAu += '  <faction-events>' + JSON.stringify((_tres.subcall1.faction_events||[]).slice(0,20)) + '</faction-events>\n';
          tpAu += '  <fiscal>' + JSON.stringify((_tres.subcall1.fiscal_adjustments||[]).slice(0,20)) + '</fiscal>\n';
          tpAu += '  <army>' + JSON.stringify((_tres.subcall1.army_changes||[]).slice(0,20)) + '</army>\n';
        }
        tpAu += '</subcall-1-core>\n';
        tpAu += '<subcall-16-faction>' + JSON.stringify((_tres.subcall16||{})).substring(0,2000) + '</subcall-16-faction>\n';
        tpAu += '<subcall-17-economy>' + JSON.stringify((_tres.subcall17||{})).substring(0,2000) + '</subcall-17-economy>\n';
        tpAu += '<subcall-18-military>' + JSON.stringify((_tres.subcall18||{})).substring(0,2000) + '</subcall-18-military>\n\n';
        tpAu += '【检查项】\n';
        tpAu += '1. 势力 strength 变化 vs 兵力变化是否矛盾（大增兵却势力减·反之）\n';
        tpAu += '2. fiscal_adjustments 金额 vs 军费/赈济/赏赐叙事是否一致\n';
        tpAu += '3. 同一势力/角色在不同 sub-call 中状态是否矛盾\n';
        tpAu += '4. 因果是否倒置（结果在原因之前）\n\n';
        tpAu += '【输出 JSON】\n';
        tpAu += '{\n';
        tpAu += '  "conflicts": [\n';
        tpAu += '    {\n';
        tpAu += '      "field_a": "sc16.faction.东林党.strength:+5",\n';
        tpAu += '      "field_b": "sc18.army_changes.东林党.soldiers:-2000",\n';
        tpAu += '      "nature": "势力增强但兵力骤减·逻辑矛盾",\n';
        tpAu += '      "severity": "high/mid/low",\n';
        tpAu += '      "resolution": "以 sc18 为准·下调 sc16 strength_delta 到 -3"\n';
        tpAu += '    }\n';
        tpAu += '  ],\n';
        tpAu += '  "auto_patches": [{"path":"subcall1.faction_events[0].strength_effect","op":"set","value":-3,"reason":"..."}],\n';
        tpAu += '  "needs_rerun": ["sc16"]\n';
        tpAu += '}\n';
        tpAu += '如无冲突·全部字段返回空数组 []。';

        // Phase 5.1 三模型解耦：sc_audit (Reviewer 角色) 优先用次要 API·没配则回退主要
        var _auTier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
        var _auCfg = (typeof _getAITier === 'function') ? _getAITier(_auTier) : { key: P.ai.key, url: url, model: P.ai.model || 'gpt-4o' };
        var _auUrl = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_auTier) : url;
        _dbg('[sc_audit] using tier:', _auCfg.tier || _auTier, 'model:', _auCfg.model);
        var respAu = await fetch(_auUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _auCfg.key },
          body: JSON.stringify({
            model: _auCfg.model,
            messages: [{ role: "system", content: "你是严谨的数据一致性审核 AI·只报真实矛盾·不制造伪问题。" }, { role: "user", content: tpAu }],
            temperature: 0.2,
            max_tokens: _tok(3000)
          })
        });
        if (respAu.ok) {
          var dataAu = await respAu.json();
          var cAu = '';
          if (dataAu.choices && dataAu.choices[0] && dataAu.choices[0].message) cAu = dataAu.choices[0].message.content;
          var pAu = extractJSON(cAu);
          if (pAu) {
            GM._turnAiResults.subcallAudit = pAu;
            var conflictCount = (pAu.conflicts || []).length;
            if (conflictCount > 0) {
              _dbg('[Consistency Audit] 发现', conflictCount, '项冲突');
              // 应用 auto_patches（支持数组索引 foo[0].bar 路径）
              if (Array.isArray(pAu.auto_patches)) {
                pAu.auto_patches.forEach(function(ap) {
                  if (!ap || !ap.path) return;
                  try {
                    // 拆分路径 · 处理形如 subcall1.faction_events[0].strength_effect
                    var tokens = [];
                    ap.path.split('.').forEach(function(seg) {
                      var m = /^([^\[]+)((?:\[\d+\])+)?$/.exec(seg);
                      if (!m) { tokens.push(seg); return; }
                      tokens.push(m[1]);
                      var rest = m[2] || '';
                      var idxM;
                      var idxRe = /\[(\d+)\]/g;
                      while ((idxM = idxRe.exec(rest)) !== null) {
                        tokens.push(parseInt(idxM[1], 10));
                      }
                    });
                    var obj = GM._turnAiResults;
                    for (var i = 0; i < tokens.length - 1; i++) {
                      if (obj == null) return;
                      obj = obj[tokens[i]];
                    }
                    if (obj == null) return;
                    if (ap.op === 'set') obj[tokens[tokens.length-1]] = ap.value;
                    else if (ap.op === 'delta' && typeof obj[tokens[tokens.length-1]] === 'number') obj[tokens[tokens.length-1]] += (parseFloat(ap.value) || 0);
                    _dbg('[Audit] 自动修正:', ap.path, '=', ap.value);
                  } catch(_ape) { _dbg('[Audit] 修正失败:', ap.path, _ape); }
                });
              }
              // 严重冲突入 turnReport 让玩家看到
              if (!GM._turnReport) GM._turnReport = [];
              GM._turnReport.push({
                type: 'consistency_audit',
                conflicts: pAu.conflicts.slice(0, 10),
                turn: GM.turn || 0
              });
            }
          }
        }
      } catch(eAu) { _dbg('[Consistency Audit] fail:', eAu); }
      }); }; // end SC_CONSISTENCY_AUDIT

      // --- Sub-call 1.9: 新实体丰化（复用编辑器 AI 级 schema，填充骨架） ---
      // ★ 后台化（2026-04-30）：丰化仅填充 GM.facs/classes/parties/chars 已存在骨架的空字段；
      //   不影响当回合叙事；_RETRY_WINDOW=3 回合保护未完成情况
      _queuePostTurnSubcall('sc19', function(){ return _runSubcall('sc19', '新实体丰化', 'lite', async function() {
        try {
          var _RETRY_WINDOW = 3; // 失败后 3 回合内可重试
          var _sparseFacs = (GM.facs||[]).filter(function(f) {
            return f._createdTurn != null && (GM.turn - f._createdTurn) <= _RETRY_WINDOW && !f._enriched && !f.isPlayer;
          });
          var _sparseClasses = (GM.classes||[]).filter(function(c) {
            return c._emergeTurn != null && (GM.turn - c._emergeTurn) <= _RETRY_WINDOW && !c._enriched;
          });
          var _sparseParties = (GM.parties||[]).filter(function(p) {
            return p._createdTurn != null && (GM.turn - p._createdTurn) <= _RETRY_WINDOW && !p._enriched;
          });
          var _sparseChars = (GM.chars||[]).filter(function(c) {
            var _turn = (c._spawnedFromOffice && c._spawnedFromOffice.turn)
              || (c._spawnedFromRevolt && c._spawnedFromRevolt.turn)
              || c._createdTurn;
            return _turn != null && (GM.turn - _turn) <= _RETRY_WINDOW && !c._enriched;
          });

          var _totalSparse = _sparseFacs.length + _sparseClasses.length + _sparseParties.length + _sparseChars.length;
          if (_totalSparse === 0) return; // 无新实体，跳过

          _quietLoad('AI 丰化新实体（' + _totalSparse + '项）', 68);
          _dbg('[Enrich] 丰化 ' + _totalSparse + ' 项：facs' + _sparseFacs.length + ' classes' + _sparseClasses.length + ' parties' + _sparseParties.length + ' chars' + _sparseChars.length);

          var dynasty = sc.dynasty || sc.era || '';
          var startY = sc.startYear || (sc.gameSettings && sc.gameSettings.startYear) || '';
          var _existingClassNames = (GM.classes||[]).map(function(c){return c.name;}).join('、');
          var _existingCharNames = (GM.chars||[]).filter(function(c){return c.alive!==false;}).slice(0, 60).map(function(c){return c.name;}).join('、');

          var enrichP = '你是' + dynasty + '历史学家。当前是公元' + startY + '年+' + GM.turn + '回合。以下新出现的实体只有骨架，请按史实风格补齐完整字段。\n\n';
          enrichP += '【数值基准——必须遵守】\n';
          enrichP += '· 角色能力按档：顶级92-98/优秀80-91/中等60-79/平庸40-59/拙劣<40\n';
          enrichP += '  武将：valor/military 高；文臣：administration/intelligence 高；管理者：management 高；后妃：charisma 高\n';
          enrichP += '  武勇(个人武力)≠军事(统兵)：吕布 valor99 military70；诸葛亮 military95 valor25\n';
          enrichP += '  治政(行政)≠管理(理财)：王安石 administration88 management92；桑弘羊 management98 administration75\n';
          enrichP += '· 五常(仁义礼智信)按性格定位：compassionate→仁高；just/zealous→义高；humble→礼高；intelligence 约等于 智；honest→信高\n';
          enrichP += '· 起义领袖：charisma 75-90 valor 60-80 benevolence 40-70 loyalty 5-20（对旧朝）\n';
          enrichP += '· 官制占位实体化：品级与能力不强绑——高品可有恩荫庸才(adm40)，低品可有潜龙大才(adm90)；\n';
          enrichP += '  主官通常能力中上(主维度 60-85)，佐官 50-75，小吏 40-65；但特殊情况皆可（贬谪/恩荫/潜龙）\n';
          enrichP += '· 每人数值必须不同，不得雷同！\n\n';

          if (_sparseFacs.length > 0) {
            enrichP += '【待丰化·势力】\n';
            _sparseFacs.forEach(function(f) {
              enrichP += '  ' + f.name + ' 类型:' + (f.type||'?') + ' 首脑:' + (f.leader||'?') + ' 领地:' + (f.territory||'?') + '\n';
              if (f.parentFaction) enrichP += '    脱离自:' + f.parentFaction + '\n';
              if (f.description) enrichP += '    背景:' + f.description + '\n';
            });
            enrichP += '  每个势力须返回:\n';
            enrichP += '    leaderInfo:{name,age,gender,personality(30字),belief,learning,ethnicity,bio(80字)}\n';
            enrichP += '    heirInfo(可null)、resources(主要资源)、mainstream(主体民族/信仰)、culture(文化特征)\n';
            enrichP += '    goal(战略目标 20字)、militaryBreakdown(若缺则按 militaryStrength 分解)\n';
            enrichP += '    description(100-150字 补全历史背景、政治特点、与玩家关系)\n';
          }

          if (_sparseClasses.length > 0) {
            enrichP += '\n【待丰化·阶层】\n';
            _sparseClasses.forEach(function(c) {
              enrichP += '  ' + c.name + (c._origin?' 源于:'+c._origin:'') + (c.description?' 描述:'+c.description.slice(0,80):'') + '\n';
            });
            enrichP += '  参考现有阶层名:' + _existingClassNames + '（勿重复）\n';
            enrichP += '  参考现有角色:' + _existingCharNames + '\n';
            enrichP += '  每个阶层须返回:\n';
            enrichP += '    representativeNpcs:[从上列角色中挑选 2-4 个]\n';
            enrichP += '    leaders:[领袖 1-3 人，可与代表重合]\n';
            enrichP += '    supportingParties:[倾向支持的党派]\n';
            enrichP += '    regionalVariants:[2-4 个地域变体 {region,satisfaction,distinguishing}]\n';
            enrichP += '    internalFaction:[1-2 个内部分化 {name,size,stance}]\n';
            enrichP += '    privileges、obligations、demands 补全\n';
          }

          if (_sparseParties.length > 0) {
            enrichP += '\n【待丰化·党派】\n';
            _sparseParties.forEach(function(p) {
              enrichP += '  ' + p.name + ' 立场:' + (p.ideology||'?') + ' 首领:' + (p.leader||'?') + ' 议程:' + (p.currentAgenda||'?') + '\n';
            });
            enrichP += '  参考现有角色:' + _existingCharNames + '\n';
            enrichP += '  参考现有阶层:' + _existingClassNames + '\n';
            enrichP += '  每个党派须返回:\n';
            enrichP += '    shortGoal、longGoal、description(100字)\n';
            enrichP += '    members(主要成员，逗号分隔，从现有角色中选 3-6 人)\n';
            enrichP += '    base(支持群体如"士绅/寒门/军功贵族")\n';
            enrichP += '    policyStance(政策立场标签 3-5 个)\n';
            enrichP += '    socialBase:[{class,affinity:-1~1}]（补全与阶层关联）\n';
            enrichP += '    agenda_history:[{turn:负数回溯,agenda,outcome}]（回溯 1-2 条历史）\n';
            enrichP += '    focal_disputes:[{topic,rival,stakes}]\n';
          }

          if (_sparseChars.length > 0) {
            enrichP += '\n【待丰化·角色】\n';
            _sparseChars.forEach(function(c) {
              var _origin = c._spawnedFromRevolt ? ('起义领袖：'+c._spawnedFromRevolt.class)
                : c._spawnedFromOffice ? ('官制实体化：'+c._spawnedFromOffice.dept+c._spawnedFromOffice.position)
                : '新出场';
              enrichP += '  ' + c.name + (c.title?'('+c.title+')':'') + ' ' + _origin + '\n';
              if (c.age) enrichP += '    年' + c.age + ' 忠' + (c.loyalty||50) + ' 政' + (c.administration||50) + ' 武' + (c.valor||50) + '\n';
            });
            enrichP += '  每个角色须返回:\n';
            enrichP += '    family(家族)、birthplace(籍贯)、ethnicity(民族)、culture(文化背景)\n';
            enrichP += '    learning(学识如"经学/律学/兵法")、faith(信仰)\n';
            enrichP += '    speechStyle(说话风格 20字)、personalGoal(心中所求 30字)\n';
            enrichP += '    personality(性格 40字)、bio(生平 80-120字)\n';
            enrichP += '    appearance(外貌 30字)\n';
            enrichP += '    traits:[特质标签 3-5 个，如"刚直/狡诈/仁厚/多疑"]\n';
          }

          enrichP += '\n返回 JSON：{\n';
          if (_sparseFacs.length) enrichP += '"factions_enriched":[{"name":"原势力名(锚点)","leaderInfo":{...},"heirInfo":{...}或null,"resources":"","mainstream":"","culture":"","goal":"","description":""}],\n';
          if (_sparseClasses.length) enrichP += '"classes_enriched":[{"name":"","representativeNpcs":[],"leaders":[],"supportingParties":[],"regionalVariants":[],"internalFaction":[],"privileges":"","obligations":"","demands":""}],\n';
          if (_sparseParties.length) enrichP += '"parties_enriched":[{"name":"","shortGoal":"","longGoal":"","description":"","members":"","base":"","policyStance":[],"socialBase":[],"agenda_history":[],"focal_disputes":[]}],\n';
          if (_sparseChars.length) enrichP += '"characters_enriched":[{"name":"","family":"","birthplace":"","ethnicity":"","culture":"","learning":"","faith":"","speechStyle":"","personalGoal":"","personality":"","bio":"","appearance":"","traits":[]}]\n';
          enrichP += '}\n请严格按史实生成；name 必须精确对应上方骨架名。';

          var _enrichBody = {
            model: P.ai.model || 'gpt-4o',
            messages: [{ role: 'user', content: enrichP }],
            temperature: 0.7,
            max_tokens: _tok(4000)
          };
          if (_modelFamily === 'openai') _enrichBody.response_format = { type: 'json_object' };
          var respE = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body: JSON.stringify(_enrichBody)});
          if (!respE.ok) { _dbg('[Enrich] HTTP ' + respE.status); return; }
          var dataE = await respE.json();
          if (dataE.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(dataE.usage);
          var cE = (dataE.choices && dataE.choices[0] && dataE.choices[0].message) ? dataE.choices[0].message.content : '';
          var pE = extractJSON(cE);
          if (!pE) { _dbg('[Enrich] JSON 解析失败'); return; }

          // 合并回 GM——只覆盖空字段，保留 AI 已生成的内容
          function _mergeIfEmpty(target, src, keys) {
            keys.forEach(function(k) {
              var v = src[k];
              if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return;
              var tv = target[k];
              var isEmpty = tv === undefined || tv === null || tv === '' || (Array.isArray(tv) && tv.length === 0) || (typeof tv === 'object' && !Array.isArray(tv) && Object.keys(tv||{}).length === 0);
              if (isEmpty) target[k] = v;
            });
          }

          if (Array.isArray(pE.factions_enriched)) {
            pE.factions_enriched.forEach(function(ef) {
              if (!ef || !ef.name) return;
              var tgt = GM.facs.find(function(f){return f.name === ef.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ef, ['leaderInfo','heirInfo','resources','mainstream','culture','goal']);
              if (ef.description && (!tgt.description || tgt.description.length < 80)) tgt.description = ef.description;
              if (ef.militaryBreakdown && tgt.militaryBreakdown) _mergeIfEmpty(tgt.militaryBreakdown, ef.militaryBreakdown, ['standingArmy','militia','elite','fleet']);
              tgt._enriched = true;
              _dbg('[Enrich] faction done: ' + ef.name);
            });
          }
          if (Array.isArray(pE.classes_enriched)) {
            pE.classes_enriched.forEach(function(ec) {
              if (!ec || !ec.name) return;
              var tgt = GM.classes.find(function(c){return c.name === ec.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ec, ['representativeNpcs','leaders','supportingParties','regionalVariants','internalFaction','privileges','obligations','demands']);
              tgt._enriched = true;
              _dbg('[Enrich] class done: ' + ec.name);
            });
          }
          if (Array.isArray(pE.parties_enriched)) {
            pE.parties_enriched.forEach(function(ep) {
              if (!ep || !ep.name) return;
              var tgt = GM.parties.find(function(p){return p.name === ep.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ep, ['shortGoal','longGoal','description','members','base','policyStance','socialBase','agenda_history','focal_disputes']);
              tgt._enriched = true;
              _dbg('[Enrich] party done: ' + ep.name);
            });
          }
          if (Array.isArray(pE.characters_enriched)) {
            pE.characters_enriched.forEach(function(ech) {
              if (!ech || !ech.name) return;
              var tgt = findCharByName(ech.name);
              if (!tgt) return;
              _mergeIfEmpty(tgt, ech, ['family','birthplace','ethnicity','culture','learning','faith','speechStyle','personalGoal','personality','bio','appearance','traits']);
              tgt._enriched = true;
              // 写入 NPC 记忆：初始身世记忆
              if (typeof NpcMemorySystem !== 'undefined' && ech.bio) {
                NpcMemorySystem.remember(ech.name, '身世：' + ech.bio.slice(0, 60), '平', 5);
              }
              _dbg('[Enrich] char done: ' + ech.name);
            });
          }

          GM._turnAiResults.subcall19 = pE;
          addEB('\u4E30\u5316', '\u672C\u56DE\u5408\u4E30\u5316\u65B0\u5B9E\u4F53 ' + _totalSparse + ' \u9879');
          _dbg('[Enrich] 完成 ' + _totalSparse + ' 项丰化');
        } catch (eE) { _dbg('[Enrich] fail:', eE); }
      }); }); // end Sub-call 1.9 (queued post-turn)

      // ── Branch C · 后人戏说 → 叙事审查 ──
      // 会读取 GM/p1 当前世界状态，必须等 sc16/17/18 的补充变动和一致性审计收束后再跑。
      var _runBranchC = async function() {
      // --- Sub-call 2: 后人戏说（场景叙事，完整生活进程） --- [always runs]
      await _runSubcall('sc2', '后人戏说', 'lite', async function() {
      showLoading("AI撰写后人戏说",70);
      // 将Sub-call 1的决策摘要传给Sub-call 2，确保叙事与数据一致
      p1Summary = '';
      if (p1) {
        if (shizhengji) p1Summary += '【时政记(摘要)】' + shizhengji.substring(0, 400) + '\n';
        if (shiluText) p1Summary += '【实录】' + shiluText + '\n';
        if (p1.npc_actions && p1.npc_actions.length > 0) {
          p1Summary += '【NPC行动】' + p1.npc_actions.map(function(a) { return a.name + ':' + a.action; }).join('；') + '\n';
        }
        if (p1.character_deaths && p1.character_deaths.length > 0) {
          p1Summary += '【死亡】' + p1.character_deaths.map(function(d) { return d.name + ':' + d.reason; }).join('；') + '\n';
        }
        if (p1.event && p1.event.title) p1Summary += '【事件】' + p1.event.title + '\n';
        if (personnelChanges && personnelChanges.length > 0) {
          p1Summary += '【人事】' + personnelChanges.map(function(p){return p.name+'→'+p.change;}).join('；') + '\n';
        }
        // 额外上下文
        if (GM._energy !== undefined && GM._energy < 40) p1Summary += '【君主疲态】精力' + Math.round(GM._energy) + '%——应暗示倦容\n';
        if (GM._successionEvent) p1Summary += '【帝位更迭】' + GM._successionEvent.from + '→' + GM._successionEvent.to + '（重点描写）\n';
        if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) p1Summary += '【待铨】' + GM._kejuPendingAssignment.length + '名进士等待授官\n';
      }
      // 附加：玩家本回合推演依据（让AI明白哪些要体现在场景中）
      var _basisBrief = '';
      // 名望/贤能显著变动的 NPC（供后人戏说穿插议论）
      try {
        var _fvMovers = (GM.chars || []).filter(function(c){
          return c && c.alive!==false && !c.isPlayer && c._fameHistory &&
                 c._fameHistory.some(function(h){return h.turn === GM.turn;});
        }).slice(0, 5);
        if (_fvMovers.length > 0) {
          _basisBrief += '【本回合名望/贤能显著变动的 NPC(可在后人戏说里穿插议论/清议/书院学子的评论)】\n';
          _fvMovers.forEach(function(c){
            var _thisTurn = (c._fameHistory||[]).filter(function(h){return h.turn===GM.turn;});
            var _totalD = _thisTurn.reduce(function(s,h){return s+(h.delta||0);},0);
            var _reasons = _thisTurn.map(function(h){return h.reason||'';}).filter(Boolean).slice(0,2).join('/');
            _basisBrief += '  · ' + c.name + ' 名望' + (_totalD>0?'+':'') + _totalD.toFixed(0) + '（' + _reasons + '）\n';
          });
        }
      } catch(_mvE){}
      if (edicts) {
        var _eL = [];
        if (edicts.political) _eL.push('政令:' + edicts.political.substring(0,60));
        if (edicts.military) _eL.push('军令:' + edicts.military.substring(0,60));
        if (edicts.diplomatic) _eL.push('外交:' + edicts.diplomatic.substring(0,60));
        if (edicts.economic) _eL.push('经济:' + edicts.economic.substring(0,60));
        if (edicts.other) _eL.push('其他:' + edicts.other.substring(0,60));
        if (_eL.length) _basisBrief += '\n【玩家诏令(须在场景中具体展开执行过程)】\n  ' + _eL.join('\n  ') + '\n';
      }
      if (xinglu) _basisBrief += '【主角私人行止(须作为主角日常生活片段呈现)】\n  ' + xinglu + '\n';
      if (memRes && memRes.length) {
        var _appMem = memRes.filter(function(m){return m.status==='approved'||m.status==='rejected';}).slice(0,5);
        if (_appMem.length) {
          _basisBrief += '【本回合奏疏批复(至少一份要在场景中被具体展开)】\n';
          _appMem.forEach(function(m){ _basisBrief += '  '+m.from+'('+m.type+')——'+(m.status==='approved'?'准':'驳')+(m.reply?' 批:'+m.reply.substring(0,30):'')+'\n'; });
        }
      }
      if (GM._courtRecords) {
        var _thisCourt = GM._courtRecords.filter(function(r){return (r.targetTurn||r.turn)===GM.turn;});
        if (_thisCourt.length) {
          _basisBrief += '【本回合朝议/问对(作为场景展现)】\n';
          _thisCourt.slice(-3).forEach(function(r){ _basisBrief += '  '+(r.topic||r.mode||'议事')+'\n'; });
        }
      }
      // 前议追责回响·涵盖常朝/廷议/御前·三回合到期·让后人戏说自然引及朝野余响(非数值修改·叙事种子)
      if (Array.isArray(GM._ty3_pendingReviewForPrompt) && GM._ty3_pendingReviewForPrompt.length > 0) {
        _basisBrief += '【前议追责·三回合前诏命到期(后人戏说应自然嵌入·非主线但可作议论/茶肆传闻/书院清议/家书提及)】\n';
        _basisBrief += '  ※ 按场所性质演绎反响位置：\n';
        _basisBrief += '    [廷议] → 茶肆/书院/官员私第议论·士论翕然或汹汹\n';
        _basisBrief += '    [常朝] → 衙门内外回响·部曹奉行或推诿\n';
        _basisBrief += '    [亲诏] → 民间惊议·近臣窃语·有司战兢\n';
        _basisBrief += '    [御前] → 不可明言·只能借密报/侍从私下流露·若泄则成大事\n';
        _basisBrief += '  ※ 据 outcome 体现：\n';
        _basisBrief += '    准奏果验 → 民间立祠/士子赋诗/茶肆称颂/政敌暗议\n';
        _basisBrief += '    行而未尽 → 朝野观望/书院叹息/老臣摇头/言路疑议\n';
        _basisBrief += '    奉行不力 → 言官追疏/政敌得势/承办者低首/家书诉冤\n';
        _basisBrief += '    适得其反 → 民间嗟叹/异象传闻/党狱兴起/旧友远遁\n';
        GM._ty3_pendingReviewForPrompt.forEach(function(rv) {
          _basisBrief += '  · ' + (rv.venueType ? '['+rv.venueType+']' : '') + '「' + (rv.content||'').slice(0, 40) + '」·' +
            (rv.proposerParty ? rv.proposerParty + '所主·' : '') +
            '此回合议结：【' + (rv.histLabel || rv.label) + '】\n';
        });
      }

      // 长期事势注入·sub-call 2 后人戏说·让多年工程在场景中折射
      var _chronCtx2 = '';
      if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
        var _cc2raw = ChronicleTracker.getAIContextString();
        if (_cc2raw) {
          _chronCtx2 = '\n' + _cc2raw + '\n';
          _chronCtx2 += '【★ 长期事势穿透到《后人戏说》场景叙事】\n';
          _chronCtx2 += '  · 进度 ≥70% 工程·相关大臣应在某时辰汇报近况(如治河近成→河漕总督来朝奏报；盐法将就→盐运使呈报新法收效)。\n';
          _chronCtx2 += '  · 进度 <20% 历多回合·应有人在场景中提及搁置(如"那道清查户口的诏，已两年余了，至今……")。\n';
          _chronCtx2 += '  · 100% 接近完成·主角应有内心独白回想当年颁诏情景·或与近侍提起。\n';
          _chronCtx2 += '  · 工程涉及的地方·若主角"巡视"或"接见"该地官员·必须自然引及其进展。\n';
          _chronCtx2 += '  · 这些不是主线·但要让玩家感到"陛下治国数年·真有几桩大事在背景持续推进"。\n';
        }
      }

      // ★ 世界状态快照注入（sc2 重点：叙事接地·防身份漂移与死者复活·前情提要）
      var _ws2 = '';
      try {
        if (typeof _buildWorldStateSnapshot === 'function') _ws2 += _buildWorldStateSnapshot();
        if (typeof _buildDeadPin === 'function') _ws2 += _buildDeadPin();
        if (typeof _buildPriorTurnBrief === 'function') _ws2 += _buildPriorTurnBrief();
      } catch(_wse2){ _dbg('[WorldSnap sc2] fail:', _wse2); }
      // 12 表注入·sc2 仅看公开皇命·不看天机
      var _mt2 = '';
      try {
        if (window.MemTables && MemTables.buildTablesInjection) {
          _mt2 = MemTables.buildTablesInjection({ include: ['imperialEdict', 'curStatus'], hideSecret: true }) || '';
        }
      } catch(_e){}
      // 时间参考块（Phase 4.1）
      var _tr2 = '';
      try { if (typeof _buildTimeRef === 'function') _tr2 = _buildTimeRef() || ''; } catch(_e){}
      var tp2 = _tr2 + _ws2 + _mt2 + p1Summary + _basisBrief + _chronCtx2
        + (aiThinking ? '【AI分析】' + aiThinking.substring(0, 200) + '\n' : '')
        + "\n基于上述全部资料，撰写《后人戏说》——这是玩家角色本回合的完整生活进程，核心目的是**完整、立体地呈现玩家角色的日常生活**，让玩家看见自己的角色如何度过这一段时光。\n"
        + "【核心要义——叙事性第一】\n"
        + "  这不是战报、不是史书、不是摘要，而是一段可读的故事。让玩家'跟着角色过完这段日子'。\n"
        + "  要有人物的具体动作、神态、对话、内心活动；要有场景的具体环境、时间、氛围。\n"
        + "  玩家角色不是一个抽象的决策符号，是一个有血有肉的人——他吃饭、他疲倦、他忧虑、他动怒、他思念、他沉默。\n"
        + "【结构骨架——按时辰顺序自然展开】\n"
        + "  晨(卯时)：主角起身——批阅奏折/晨起盥洗/与近侍对话/晨食\n"
        + "  上午(辰时-巳时)：正式政务——朝会/殿见大臣/军务讨论/外交接见\n"
        + "  午后(未时-申时)：续政务/接见/巡视/或私事(若本回合有帝王私行/内眷互动)\n"
        + "  傍晚(酉时-戌时)：私人时间——家人/帝后对话/内省/私下思考；也可继续政务\n"
        + "  深夜/就寝：只在本回合有特别事件时写\n"
        + "  日与日之间用空行或'……'切换；若本回合跨多日请分日叙述\n"
        + "  注：时辰只是顺序参考，具体节奏看本回合实际内容——不必强行每个时段都写\n"
        + "【文风——重在叙事，而非特定标点】\n"
        + "  · **标点自由**：可用句号/逗号/冒号/引号正常组织句子；破折号可用可不用，不强制；顿号、分号也可用\n"
        + "  · 以叙事流畅为首要目标——避免电报体、避免列清单、避免句句破折\n"
        + "  · 对话自然融入场景；可带'说道''答道''低声道'等叙事动词，也可不带(上下文能识别即可)\n"
        + "  · 每个人物说话方式要贴合其性格(忠臣的直/佞臣的滑/老臣的稳/年少者的急/亲眷的柔)\n"
        + "  · 数据融入场景——不要列'国库-20万'，而写成对话或动作(如'户部侍郎垂首奏报：库银减了二十万两，赈灾拨了十五……')\n"
        + "  · 穿插生活碎片：饮食、天气、季节、家人互动(子女成长、帝后闲谈、妃嫔往来)\n"
        + "  · 内心独白可直接写角色所想，不必隐藏——如'他想，今日这事，父皇当年怕是也难办吧。'\n"
        + "  · 幽默感来自人物智慧与情境，不来自吐槽\n"
        + "【着重呈现(推演依据必须场景化)】\n"
        + "  · 玩家诏令：至少一条要在具体场景中被某个大臣收到/讨论/执行——让玩家看见令下之后谁去做、怎么做\n"
        + "  · 玩家行止：作为主角的日常生活片段自然出现\n"
        + "  · 本回合批复的奏疏：至少一份在场景中展开(谁呈上、何时、皇帝的反应)\n"
        + "  · 问对/朝议结果：作为对话场景再现(若本回合有)\n"
        + "  · NPC自主行动：至少出现2-3个NPC的日常片段或私下对话\n"
        + "  · 势力/阴谋伏笔：暗线自然融入\n"
        + "  · 本回合最戏剧性的一幕必须展开写足\n"
        + "【禁止】\n"
        + "  · 不用emoji\n"
        + "  · 不用日式轻小说元素(不出现'诶''嘛''啦'等语气词)\n"
        + "  · 不用全知叙述者评论('这一天注定不平凡'之类)\n"
        + "  · 不是时政记的复述——时政记是摘要报告，后人戏说是把同一事件还原为可感知的生活\n"
        + "  · 少用'陛下圣明''微臣该死'之类套话，让对话贴近真实人际交流\n"
        + "【字数】" + _hourenMin + "-" + _hourenMax + "字。字数应花在场景细节和人物互动上，不要注水。\n"
        + "【情绪基调】若主角勤政——写出'做好事真难'(阻力、孤独、疲惫)；若主角享乐——写出'享乐真好'(感官、轻快、奉承)，但不说教。\n"
        + "\n返回纯JSON：\n"
        + "{\"houren_xishuo\":\"...(场景叙事正文)\",\"new_activities\":[{\"name\":\"...\",\"duration\":3,\"desc\":\"...\",\"effect\":{}}]}";
      // R104·给 AI 完整对话（GM.conv 已由 P.conf.convKeep 设置截断过，用户在设置里改 convKeep 即控制总量）
      var msgs2=[{role:"system",content:_maybeCacheSys(sysP)}].concat(GM.conv);
      msgs2.push({role:"user",content:tp2});
      var resp2=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},body:JSON.stringify({model:P.ai.model||"gpt-4o",messages:msgs2,temperature:P.ai.temp||0.8,max_tokens:_tok(16000)})});
      if(!resp2.ok) throw new Error('HTTP ' + resp2.status);
      var data2=await resp2.json();
      _checkTruncated(data2, '后人戏说');
      var c2="";if(data2.choices&&data2.choices[0]&&data2.choices[0].message)c2=data2.choices[0].message.content;
      p2=extractJSON(c2);
      GM._turnAiResults.subcall2_raw = c2;
      GM._turnAiResults.subcall2 = p2;

      if(p2){
        // 优先读取新字段houren_xishuo；兼容旧zhengwen字段
        hourenXishuo = p2.houren_xishuo || p2.zhengwen || c2 || "时光流逝";
        zhengwen = hourenXishuo; // 兼容现有调用
        if(p2.new_activities)p2.new_activities.forEach(function(a){if(a.name)GM.biannianItems.push({name:a.name,startTurn:GM.turn+1,duration:a.duration||3,desc:a.desc||"",effect:a.effect||{}});});
        // 清理过期的biannianItems
        if(GM.biannianItems&&GM.biannianItems.length>50)GM.biannianItems=GM.biannianItems.filter(function(b){return b.startTurn+b.duration>=GM.turn;});
      }

      // 建议不足时自动补全（借鉴 ChongzhenSim fallback choices）
      if (!p2 || !p2.suggestions || p2.suggestions.length < 2) {
        // 动态生成建议——忠臣的建议故意写得冗长、说教（让玩家感受忠言逆耳）
        var _dynSugg = [];
        _dynSugg.push('巩固民心，推行惠政（然此非一朝一夕之功，须持之以恒，不可半途而废）');
        _dynSugg.push('臣以为当整饬吏治、选贤任能，此乃治国之本。然贤愚难辨，望陛下明察秋毫');
        if (GM.eraState && GM.eraState.militaryProfessionalism < 0.4) _dynSugg.push('军备松弛久矣，臣以为宜操练兵马、加强边防。然此事费银甚巨、耗时良久，朝中恐有异议');
        if (_dynSugg.length < 3) _dynSugg.push('臣以为当修文德以来远人，虽见效缓慢，然为万世之基业');
        // 当荒淫值较高时，混入佞臣式的"好建议"
        if (GM._tyrantDecadence && GM._tyrantDecadence > 25) {
          var _badSugg = [
            '近来操劳过度，宜宴饮群臣，以慰圣心',
            '方士进献灵丹，服之可延年益寿，何不一试',
            '天子当享天下之福，何必自苦？宜大赦天下、普天同庆',
            '某处风景绝佳，可建行宫一座，以备避暑',
            '后宫虚设，宜选天下淑女以充掖庭',
            '边功卓著，何不御驾亲征、扬威四海？',
            '近臣某某忠心可嘉，宜委以重任（注：此人谄媚之辈）'
          ];
          _dynSugg.push(_badSugg[Math.floor(random() * _badSugg.length)]);
        }
        if (!p2) p2 = {};
        p2.suggestions = (p2.suggestions || []).concat(_dynSugg).slice(0, 4);
      }

      if(!zhengwen){
        zhengwen = c2 || "时光流逝";
        if (!hourenXishuo) hourenXishuo = zhengwen;
      }
      // 【防止对话历史被后人戏说撑爆】——将过长叙事截断为摘要入conv；完整版已在shijiHistory
      // 标准策略：>1500字时只保留开头600+结尾400作为上下文线索；其余用"……(中略)……"代替
      var _convContent = zhengwen || '';
      if (_convContent.length > 1500) {
        _convContent = _convContent.substring(0, 600) + '\n……（后人戏说正文过长，此处略去中段；完整版见史记）……\n' + _convContent.substring(_convContent.length - 400);
      }
      GM.conv.push({role:"assistant",content:_convContent});
      }); // end Sub-call 2 _runSubcall

      // --- Sub-call 2.5: 深度伏笔种植 + 回合记忆压缩 + NPC情绪快照 ---
      _queuePostTurnSubcall('sc25', function(){ return _runSubcall('sc25', '伏笔记忆', 'lite', async function() {
      _dbg('[PostTurn] sc25 start');
      try {
        var _ptTurn25 = (GM._postTurnJobs && GM._postTurnJobs.turn) || GM.turn || 0;
        var _turnSummary = '\u672C\u56DE\u5408\u5B8C\u6574\u6458\u8981\uFF1A\n';
        _turnSummary += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji || '') + '\n';
        _turnSummary += '\u6B63\u6587\uFF1A' + (zhengwen || '').substring(0, 600) + '\n';
        if (playerStatus) _turnSummary += '\u653F\u5C40\uFF1A' + playerStatus + '\n';
        if (playerInner) _turnSummary += '\u5185\u7701\uFF1A' + playerInner + '\n';
        // 完整变动记录
        var _changeSummary = [];
        if (p1 && p1.npc_actions) p1.npc_actions.forEach(function(a) { _changeSummary.push(a.name + ':' + a.action + (a.result?'→'+a.result:'')); });
        if (p1 && p1.character_deaths) p1.character_deaths.forEach(function(d) { _changeSummary.push(d.name + '\u6B7B:' + d.reason); });
        if (p1 && p1.faction_events) p1.faction_events.forEach(function(fe) { _changeSummary.push((fe.actor||'') + (fe.action||'')); });
        if (p1 && p1.faction_changes) p1.faction_changes.forEach(function(fc) { _changeSummary.push(fc.name + '\u5B9E\u529B' + (fc.strength_delta>0?'+':'')+fc.strength_delta); });
        if (_changeSummary.length > 0) _turnSummary += '\u5168\u90E8\u53D8\u52A8\uFF1A' + _changeSummary.join('\uFF1B') + '\n';
        // 玩家本回合决策
        if (GM.playerDecisions && GM.playerDecisions.length > 0) {
          var _lastDecs = GM.playerDecisions.filter(function(d){return d.turn===_ptTurn25;});
          if (_lastDecs.length) _turnSummary += '\u73A9\u5BB6\u51B3\u7B56\uFF1A' + _lastDecs.map(function(d){return d.type+':'+d.content;}).join('\uFF1B') + '\n';
        }

        // 注入已有情节线索（让AI延续而非重造）
        if (GM._plotThreads && GM._plotThreads.length > 0) {
          var _activeThreads = GM._plotThreads.filter(function(t){ return t.status !== 'resolved'; });
          if (_activeThreads.length > 0) {
            _turnSummary += '\n【活跃情节线索——应在plot_updates中更新进展】\n';
            _activeThreads.forEach(function(t) { _turnSummary += '  · [' + t.id + '] ' + t.title + ' (' + t.type + ') 状态:' + t.status + '\n'; });
          }
        }
        var tp25 = _turnSummary + '\n\u8BF7\u8FD4\u56DEJSON\uFF1A\n';
        tp25 += '{"foreshadow":["\u4F0F\u7B141\u2014\u201440\u5B57\u2014\u2014\u5305\u542B\u4F55\u4EBA\u4F55\u4E8B\u4F55\u65F6\u5F15\u7206","\u4F0F\u7B142","\u4F0F\u7B143","\u4F0F\u7B144","\u4F0F\u7B145"],';
        tp25 += '"plot_updates":[{"threadId":"\u5DF2\u6709\u7EBFID\u6216null","title":"\u5267\u60C5\u7EBF\u540D","threadType":"political/military/personal/economic/succession/foreign","update":"\u672C\u56DE\u5408\u8FDB\u5C55(30\u5B57)","status":"brewing/active/climax/resolved","newThread":false}],';
        tp25 += '"decision_echoes":[{"content":"\u54EA\u6761\u8BCF\u4EE4/\u51B3\u7B56","echoType":"positive/negative/mixed","echoDesc":"\u5EF6\u65F6\u540E\u679C\u63CF\u8FF0(30\u5B57)","delayTurns":0}],';
        tp25 += '"faction_narrative":{"\u52BF\u529B\u540D":"\u8FD1\u671F\u53D1\u5C55\u4E00\u53E5\u8BDD\u603B\u7ED3(30\u5B57)"},';
        tp25 += '"memory":"\u672C\u56DE\u5408\u7684\u9AD8\u5BC6\u5EA6\u538B\u7F29\u8BB0\u5F55\u2014\u2014\u5305\u542B\u6240\u6709\u5173\u952E\u4EBA\u540D\u3001\u4E8B\u4EF6\u3001\u53D8\u5316\u3001\u73A9\u5BB6\u51B3\u7B56\u53CA\u5176\u540E\u679C(200\u5B57)","trend":"\u5F53\u524D\u5927\u52BF\u8D70\u5411\u548C\u52A0\u901F\u65B9\u5411(50\u5B57)","npc_mood_snapshot":"\u5404\u4E3B\u8981NPC\u672C\u56DE\u5408\u540E\u7684\u60C5\u7EEA\u72B6\u6001(100\u5B57)","contradiction_evolution":"\u5404\u77DB\u76FE\u672C\u56DE\u5408\u7684\u6F14\u5316\u65B9\u5411\u2014\u2014\u52A0\u5267/\u7F13\u548C/\u8F6C\u5316(80\u5B57)",';
        // P12.1 state_board 4 \u5B57\u6BB5\uFF08KokoroMemo state_schema 14 \u7C7B\u5BF9\u7167\u00B7\u8865\u5929\u547D\u7F3A\u5931\u7684\u8F7B\u91CF\u4F1A\u8BDD\u72B6\u6001\uFF09
        tp25 += '"state_board":{';
        tp25 += '"mood":"\u671D\u5802\u5F53\u524D\u6C1B\u56F4\u57FA\u8C03\u4E00\u53E5\u8BDD(40\u5B57\u00B7\u5982"\u767E\u5B98\u89C2\u671B\u00B7\u7687\u5E1D\u5A01\u91CD\u00B7\u6050\u60E7\u5927\u4E8E\u5E0C\u671B")",';
        tp25 += '"open_loops":["\u60AC\u800C\u672A\u51B3\u4F46\u5E94\u63A8\u8FDB\u7684\u5267\u60C5\u7EBF 1(35\u5B57)","\u7EBF 2","\u7EBF 3"],';
        tp25 += '"recent_summary":"\u672C\u56DE\u5408\u6700\u538B\u7F29\u7684\u6458\u8981(150\u5B57\u00B7\u8986\u76D6\u6240\u6709\u5173\u952E\u53D8\u52A8\u00B7\u4E0B\u56DE\u5408 sc1 \u4F18\u5148\u8BFB)",';
        tp25 += '"unfulfilled_promises":["\u73A9\u5BB6\u672A\u5151\u73B0\u7684\u627F\u8BFA/\u62DF\u8BAE\u4F46\u672A\u9881\u7684\u8BCF\u4EE4 1(35\u5B57)","2","3"]';
        tp25 += '},';
        // 10 \u7EF4\u4E8B\u4EF6\u8BC4\u5206\uFF08\u53C2\u8003\u5168\u81EA\u52A8\u603B\u7ED3 v4 \u51DB\u503E\u534F\u8BAE\u00B7\u672C\u5730\u5316\u4E3A\u5929\u547D\u8BED\u5883\uFF09+ affects_future \u4E8C\u5143\u6807\u8BB0\uFF08Phase 4.2 ReNovel-AI \u8303\u5F0F\uFF09
        tp25 += '"event_weights":[{"event":"\u4E8B\u4EF6\u63CF\u8FF050\u5B57\u4EE5\u5185","weight":0.65,"dims":["d1","d3"],"affects_future":true}]}\n';
        tp25 += '\n\u3010event_weights \u8BC4\u5206\u89C4\u5219\u3011\u5BF9\u672C\u56DE\u5408\u4E0A\u62A5 5-10 \u4EF6\u4E8B\u4EF6\u00B7\u9010\u4EF6\u6309 10 \u4E2A\u7EF4\u5EA6\u5404\u6253 0.05-0.15 \u7D2F\u52A0\u5C01\u9876 1.0\uFF1A\n';
        tp25 += '  d1 \u541B\u4E3B\u884C\u52A8/\u5F71\u54CD(\u4E0A\u9650 0.15) | d2 \u4E09\u516C\u4E5D\u537F\u53C2\u4E0E(0.10) | d3 \u91CD\u5927\u51B3\u7B56/\u8F6C\u6298(0.15) | d4 \u4E3B\u8981\u51B2\u7A81\u8FDB\u5C55(0.15) | d5 \u6838\u5FC3\u4FE1\u606F\u63ED\u9732(0.15) | d6 \u5236\u5EA6/\u7586\u57DF\u9610\u91CA(0.10) | d7 \u65B0\u52BF\u529B/\u65B0\u4EBA\u7269(0.15) | d8 NPC\u6210\u957F/\u5173\u7CFB\u53D8\u52A8(0.15) | d9 \u60C5\u611F\u5CF0\u503C/\u5371\u673A\u65F6\u523B(0.15) | d10 \u4E3B\u7EBF\u63A8\u8FDB(0.15)\n';
        tp25 += '\u8F93\u51FA\u7684 event \u63CF\u8FF0\u9700\u4E0E [\u4E8B\u4EF6\u5386\u53F2] \u8868\u4E2D\u5DF2\u5B58\u5728\u7684\u63CF\u8FF0\u504F\u8FD1\u00B7dims \u5C42\u9762\u53EA\u9700\u4E2D\u9AD8\u8D21\u732E\u7EF4\u5EA6\u00B7\u4E0D\u8981\u8F93\u51FA\u6BCF\u4E2A\u7EF4\u5EA6\u7684\u5206\u6570\u3002\n';
        tp25 += '\n\u3010affects_future \u4E8C\u5143\u6807\u8BB0\u3011\u5BF9\u6BCF\u6761\u4E8B\u4EF6\u5355\u72EC\u8BC4\u4F30\uFF1A\n';
        tp25 += '  affects_future=true\uFF1A\u6B64\u4E8B\u4EF6\u5BF9 5+ \u56DE\u5408\u540E\u4ECD\u6709\u7EA6\u675F\u529B\uFF08\u5982\uFF1A\u67D0\u91CD\u81E3\u83B7\u5175\u6743\u00B7\u67D0\u6761\u7EA6\u7B7E\u8BA2\u00B7\u67D0\u6539\u9769\u843D\u5730\u00B7\u67D0\u5173\u952E\u4EBA\u7269\u8EAB\u4EFD\u53D8\u5316\u00B7\u67D0\u5730\u5931\u5B88\uFF09\n';
        tp25 += '  affects_future=false\uFF1A\u672C\u56DE\u5408\u4E00\u6B21\u6027\u7EC6\u8282\uFF08\u5982\uFF1A\u67D0\u6B21\u53EC\u5BF9\u00B7\u67D0\u6B21\u5C0F\u578B\u9A9A\u4E71\u00B7\u4E00\u6B21\u6027\u7684\u6069\u8D4F\uFF09\n';
        tp25 += '  \u6807\u8BB0 true \u7684\u4E8B\u4EF6\u4F1A\u8FDB\u5165"\u957F\u671F\u7EA6\u675F"\u6BB5\u00B7\u4E0B\u56DE\u5408 sc1 \u63A8\u6F14\u65F6 AI \u5FC5\u987B\u9075\u5FAA\u00B7\u4E0D\u5F97\u8FDD\u53CD\u6216\u9057\u5FD8\u3002\n';
        tp25 += '\u4F0F\u7B14\u8981\u5177\u4F53\uFF1A\u5305\u542B\u201C\u8C01\u201D\u201C\u505A\u4EC0\u4E48\u201D\u201C\u5728\u54EA\u91CC\u201D\u201C\u51E0\u56DE\u5408\u540E\u5F15\u7206\u201D\u3002\u4E0D\u8981\u6A21\u7CCA\u3002\n';
        tp25 += 'memory\u5FC5\u987B\u5305\u542B\u6240\u6709\u5173\u952E\u53D8\u5316\uFF0C\u8FD9\u662F\u4E0B\u56DE\u5408AI\u7684\u552F\u4E00\u56DE\u5FC6\u6765\u6E90\u3002';

        // Phase 5.1 三模型解耦：sc25 (Analyzer 角色) 优先用次要 API·没配则回退主要
        var _t25 = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
        var _c25 = (typeof _getAITier === 'function') ? _getAITier(_t25) : { key: P.ai.key, url: url, model: P.ai.model || 'gpt-4o' };
        var _u25 = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_t25) : url;
        _dbg('[sc25] using tier:', _c25.tier || _t25, 'model:', _c25.model);
        var resp25 = await fetch(_u25, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+_c25.key},
          body:JSON.stringify({model:_c25.model, messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp25}], temperature:0.7, max_tokens:_tok(12000)})});
        if (resp25.ok) {
          var data25 = await resp25.json();
          _checkTruncated(data25, '伏笔记忆');
          var c25 = '';
          if (data25.choices && data25.choices[0] && data25.choices[0].message) c25 = data25.choices[0].message.content;
          var p25 = extractJSON(c25);
          if (p25) {
            // 存储伏笔（供下回合AI使用）
            if (p25.foreshadow && Array.isArray(p25.foreshadow)) {
              if (!GM._foreshadows) GM._foreshadows = [];
              p25.foreshadow.forEach(function(f) {
                if (f) GM._foreshadows.push({ turn: _ptTurn25, text: f });
              });
              // 硬上限保护（正常由压缩系统管理，此为兜底；上限随模型动态调整）
              var _foreHardLim = getCompressionParams().foreHardLimit || 60;
              if (GM._foreshadows.length > _foreHardLim) GM._foreshadows = GM._foreshadows.slice(-Math.round(_foreHardLim * 0.8));
            }
            // 存储AI压缩记忆
            if (p25.memory) {
              if (!GM._aiMemory) GM._aiMemory = [];
              GM._aiMemory.push({ turn: _ptTurn25, text: p25.memory });
              // 硬上限保护（正常由压缩系统管理，此为兜底；上限随模型动态调整）
              var _memHardLim = getCompressionParams().memHardLimit || 100;
              if (GM._aiMemory.length > _memHardLim) GM._aiMemory = GM._aiMemory.slice(-Math.round(_memHardLim * 0.8));
            }
            // 存储趋势
            if (p25.trend) GM._currentTrend = p25.trend;
            // P12.1 state_board 4 字段
            if (p25.state_board && typeof p25.state_board === 'object') {
              GM._stateBoard = {
                turn: _ptTurn25,
                ts: Date.now(),
                mood: String(p25.state_board.mood || '').slice(0, 80),
                open_loops: Array.isArray(p25.state_board.open_loops) ? p25.state_board.open_loops.slice(0, 5).map(function(s){ return String(s).slice(0, 60); }) : [],
                recent_summary: String(p25.state_board.recent_summary || '').slice(0, 250),
                unfulfilled_promises: Array.isArray(p25.state_board.unfulfilled_promises) ? p25.state_board.unfulfilled_promises.slice(0, 5).map(function(s){ return String(s).slice(0, 60); }) : []
              };
            }

            // 2.1: 处理剧情线更新
            if (p25.plot_updates && Array.isArray(p25.plot_updates)) {
              if (!GM._plotThreads) GM._plotThreads = [];
              p25.plot_updates.forEach(function(pu) {
                if (!pu.title) return;
                if (pu.newThread || !pu.threadId) {
                  // 创建新线
                  var existing = GM._plotThreads.find(function(t) { return t.title === pu.title; });
                  if (!existing) {
                    GM._plotThreads.push({
                      id: uid(), title: pu.title, description: pu.update || '',
                      participants: [], startTurn: _ptTurn25, lastUpdateTurn: _ptTurn25,
                      status: pu.status || 'active', priority: 3,
                      threadType: pu.threadType || 'political',
                      updates: [{ turn: _ptTurn25, text: pu.update || '' }]
                    });
                  }
                } else {
                  // 更新已有线
                  var thread = GM._plotThreads.find(function(t) { return t.id === pu.threadId || t.title === pu.title; });
                  if (thread) {
                    thread.lastUpdateTurn = _ptTurn25;
                    if (pu.status) thread.status = pu.status;
                    if (pu.update) thread.updates.push({ turn: _ptTurn25, text: pu.update });
                    if (thread.updates.length > 20) thread.updates = thread.updates.slice(-20);
                  }
                }
              });
              // 清理已完结超过5回合的线
              GM._plotThreads = GM._plotThreads.filter(function(t) {
                return t.status !== 'resolved' || _ptTurn25 - t.lastUpdateTurn < 5;
              });
              // 上限15条
              if (GM._plotThreads.length > 15) GM._plotThreads = GM._plotThreads.slice(-15);
            }

            // N1: 处理决策延时后果生成
            if (p25.decision_echoes && Array.isArray(p25.decision_echoes)) {
              if (!GM._decisionEchoes) GM._decisionEchoes = [];
              p25.decision_echoes.forEach(function(de) {
                if (!de.content || !de.echoDesc) return;
                var delay = parseInt(de.delayTurns) || ((typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12);
                GM._decisionEchoes.push({
                  id: uid(), content: de.content, turn: _ptTurn25,
                  echoTurn: _ptTurn25 + delay, echoType: de.echoType || 'mixed',
                  echoDesc: de.echoDesc, applied: false
                });
              });
              // 清理已应用的和过期的
              GM._decisionEchoes = GM._decisionEchoes.filter(function(e) { return !e.applied || _ptTurn25 - e.echoTurn < 3; });
              if (GM._decisionEchoes.length > 20) GM._decisionEchoes = GM._decisionEchoes.slice(-20);
            }

            // 标记到期的决策回声为已应用
            if (GM._decisionEchoes) {
              GM._decisionEchoes.forEach(function(e) {
                if (!e.applied && e.echoTurn <= _ptTurn25) e.applied = true;
              });
            }

            // 3.3: 势力发展叙事存储
            if (p25.faction_narrative && typeof p25.faction_narrative === 'object') {
              GM._factionNarrative = p25.faction_narrative;
            }

            // 10 维事件评分回写到 eventHistory 表（Phase 2.3）
            if (p25.event_weights && Array.isArray(p25.event_weights) && window.MemTables) {
              try {
                var _eh = MemTables.getSheet('eventHistory');
                if (_eh && _eh.rows && _eh.rows.length) {
                  p25.event_weights.forEach(function(ew) {
                    if (!ew || !ew.event) return;
                    var w = parseFloat(ew.weight);
                    if (isNaN(w) || w < 0) w = 0; if (w > 1) w = 1;
                    var dims = Array.isArray(ew.dims) ? ew.dims.join(',') : (ew.dims || '');
                    var aff = (ew.affects_future === true || ew.affects_future === 'true' || ew.affects_future === 1) ? 'true' : '';
                    // 模糊匹配·查找最近回合中描述包含该事件关键字的行
                    var hits = _eh.rows.filter(function(r) {
                      var rTurn = parseInt(r[1], 10) || 0;
                      return rTurn >= _ptTurn25 - 1 && rTurn <= _ptTurn25 && r[2] && r[2].indexOf(String(ew.event).slice(0, 8)) >= 0;
                    });
                    if (hits.length === 0 && _eh.rows.length > 0) {
                      // 兜底：取本回合最后一行
                      hits = [_eh.rows[_eh.rows.length - 1]];
                    }
                    hits.forEach(function(r) { r[3] = String(w); if (dims) r[4] = dims; if (aff) r[6] = aff; });
                  });
                  _dbg('[EventWeights] 已为 ' + p25.event_weights.length + ' 件事件写回权重');
                }
              } catch(_ewE){ _dbg('[EventWeights] fail:', _ewE); }
            }
            GM._turnAiResults.subcall25 = p25;
            _dbg('[Foreshadow]', (p25.foreshadow || []).length, 'hooks. Threads:', (GM._plotThreads||[]).length, 'Echoes:', (GM._decisionEchoes||[]).length);
          }
        }
      } catch(e25) { _dbg('[Foreshadow] \u5931\u8D25:', e25); throw e25; }
      }); }); // end Sub-call 2.5 _runSubcall (queued post-turn)

      // --- Sub-call 2.7: 叙事质量审查与增强 --- [standard+full]
      await _runSubcall('sc27', '叙事审查', 'standard', async function() {
      showLoading("\u53D9\u4E8B\u8D28\u91CF\u5BA1\u67E5",85);
      try {
        var tp27 = '请审查以下叙事正文的质量：\n' + (zhengwen||'') + '\n\n';
        tp27 += '【铁律】玩家诏令引起的任何字面执行描述（即使荒唐/时代错乱）·你都不得改写。若玩家在唐代诏"赏银"/令"刑部管科举"等·相关叙事必须原样保留。你只能增补环境/情绪/感官细节·或重写"纯 AI 虚构的、与玩家无关的段落"。\n';
        // 注入史料知识供审查参考
        if (GM._aiScenarioDigest) {
          if (GM._aiScenarioDigest.periodVocabulary) tp27 += '\u65F6\u4EE3\u7528\u8BED\uFF1A' + GM._aiScenarioDigest.periodVocabulary.substring(0,200) + '\n';
          if (GM._aiScenarioDigest.etiquetteNorms) tp27 += '\u793C\u4EEA\u89C4\u8303\uFF1A' + GM._aiScenarioDigest.etiquetteNorms.substring(0,200) + '\n';
          if (GM._aiScenarioDigest.sensoryDetails) tp27 += '\u611F\u5B98\u7EC6\u8282\uFF1A' + GM._aiScenarioDigest.sensoryDetails.substring(0,200) + '\n';
        }
        // 注入角色名单供一致性检查
        var _charNames27 = (GM.chars||[]).filter(function(c){return c.alive!==false;}).map(function(c){return c.name;});
        if (_charNames27.length > 0) tp27 += '\u3010\u5728\u4E16\u89D2\u8272\u540D\u5355\uFF08\u6B63\u6587\u4E2D\u63D0\u5230\u7684\u4EBA\u540D\u5FC5\u987B\u5728\u6B64\u5217\u8868\u4E2D\uFF09\u3011' + _charNames27.join('\u3001') + '\n';
        tp27 += '\u8BF7\u8FD4\u56DEJSON\uFF1A{"anachronisms":"\u53D1\u73B0\u7684\u65F6\u4EE3\u9519\u8BEF\u2014\u2014\u7528\u8BCD\u3001\u79F0\u8C13\u3001\u5236\u5EA6\u4E0D\u7B26\u5408\u65F6\u4EE3(100\u5B57)","name_errors":"\u6B63\u6587\u4E2D\u51FA\u73B0\u4F46\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D\u7684\u4EBA\u540D(\u5982\u6709)","enhancement":"\u53EF\u4EE5\u589E\u5F3A\u7684\u90E8\u5206\u2014\u2014\u54EA\u91CC\u53EF\u4EE5\u52A0\u5165\u66F4\u591A\u611F\u5B98\u7EC6\u8282\u3001\u5178\u6545\u5F15\u7528\u3001\u60C5\u611F\u6E32\u67D3(150\u5B57)","rewritten_passages":"\u91CD\u5199\u7684\u6BB5\u843D\u2014\u2014\u5C06\u6700\u5F31\u76842-3\u6BB5\u91CD\u5199\u5F97\u66F4\u597D(300\u5B57)","added_details":"\u5E94\u8865\u5145\u7684\u7EC6\u8282\u2014\u2014\u73AF\u5883\u63CF\u5199\u3001\u4EBA\u7269\u795E\u6001\u3001\u6C14\u6C1B\u70D8\u6258(200\u5B57)"}';
        var resp27 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp27}], temperature:0.6, max_tokens:_tok(12000)})});
        if (resp27.ok) {
          var j27 = await resp27.json(); _checkTruncated(j27, '人名校验'); var c27 = j27.choices&&j27.choices[0]?j27.choices[0].message.content:'';
          var p27 = extractJSON(c27);
          if (p27) {
            // 将增强内容附加到正文
            if (p27.rewritten_passages) zhengwen = zhengwen + '\n\n' + p27.rewritten_passages;
            if (p27.added_details) zhengwen = zhengwen + '\n' + p27.added_details;
            GM._turnAiResults.subcall27 = p27;
            _dbg('[Narrative Review] anachronisms:', (p27.anachronisms||'').substring(0,50));
          }
        }
      } catch(e27) { _dbg('[Narrative Review] fail:', e27); throw e27; }
      }); // end Sub-call 2.7 _runSubcall
      }; // ── end Branch C runner ──

      // ★ P8.2 稳妥并行（深化）：A/B 完成后·sc_audit + Branch C + sc07 三者完全独立·全部并行
      //   - sc_audit 改 _turnAiResults 数值字段（faction_events/fiscal/army）
      //   - Branch C (sc2→sc27) 写 zhengwen 叙事
      //   - sc07 写 _npcCognition 为下回合 NPC 行动准备认知快照
      //   三者操作不同字段·无字段冲突·并行节省 ~20-40 秒
      try {
        var _branchSettled = await Promise.all([
          _branchA.then(function(){ return null; }, function(e){ return e; }),
          _branchB.then(function(){ return null; }, function(e){ return e; })
        ]);
        _branchSettled.forEach(function(e, i) {
          if (!e) return;
          var _ctx = i === 0 ? 'sc1后稳妥并行收束:branchA' : 'sc1后稳妥并行收束:branchB';
          (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, _ctx) : console.warn('[' + _ctx + ']', e);
        });
        // P8.2 三路并行：注意 _runSc07 在下方声明·此处通过 setTimeout 0 推迟执行让 JS 先解析后续代码
        // 实际上由于 JS 函数声明被提升·_runSc07 此处可用·但赋值表达式（var _runSc07 = async function...）不被提升
        // 因此把 _runSc07 调用挪到声明之后·见下方"finalParallel"块
      }
      catch(_pBranchE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_pBranchE, 'sc1后稳妥并行收束') : console.warn('[sc1后稳妥并行收束]', _pBranchE); }

      // --- Sub-call 0.7: NPC 认知整合 ---
      //   · 位置：所有推演完成之后，世界快照之前
      //   · 职责：为每个关键 NPC 生成"当下此刻的信息掌握画像"
      //   · 持久化：GM._npcCognition（与 GM 同命周期·随存档）
      //   · 消费者：问对/朝议/科议/奏疏回复等回合内 AI 调用（通过 getNpcCognitionSnippet）
      // 按既定约束保留前台执行，不放入 post-turn 队列。
      // P8.2：包成函数·与 sc_audit + Branch C 并行执行（三者操作不同字段·无冲突）
      var _runSc07 = async function() { return _runSubcall('sc07', 'NPC认知整合', 'lite', async function() {
      showLoading("NPC \u8BA4\u77E5\u6574\u5408", 89);
      try {
        var _liveCharsCog = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;});
        _liveCharsCog.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
        var _cogTargets = _liveCharsCog.slice(0, 22);
        if (_cogTargets.length === 0) return;

        var _cogCtx = '';
        _cogCtx += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '\n';
        if (shizhengji) _cogCtx += '\n\u3010\u672C\u56DE\u5408\u65F6\u653F\u8BB0\u3011\n' + String(shizhengji).slice(0,1500) + '\n';
        // 风闻摘要
        if (Array.isArray(GM._fengwenRecord) && GM._fengwenRecord.length > 0) {
          var _fwRecent = GM._fengwenRecord.slice(-20).reverse().map(function(fw){return '['+fw.type+'] '+(fw.text||'').slice(0,50);}).join('\n');
          _cogCtx += '\n\u3010\u8FD1\u671F\u98CE\u95FB\u3011\n' + _fwRecent + '\n';
        }
        // 本回合主要事件
        if (p1 && Array.isArray(p1.events) && p1.events.length > 0) {
          _cogCtx += '\n\u3010\u672C\u56DE\u5408\u4E8B\u4EF6\u3011\n' + p1.events.slice(0,10).map(function(e){return '\u00B7 ['+(e.category||'')+'] '+(e.text||'').slice(0,60);}).join('\n') + '\n';
        }
        // NPC 交互
        if (p1 && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          _cogCtx += '\n\u3010\u672C\u56DE\u5408 NPC \u4E92\u52A8\u3011\n' + p1.npc_interactions.slice(0,12).map(function(it){return '\u00B7 '+it.actor+'\u2192'+it.target+' '+it.type+(it.publicKnown?'\u3010\u516C\u3011':'\u3010\u79C1\u3011');}).join('\n') + '\n';
        }
        // 势力暗流
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _cogCtx += '\n\u3010\u52BF\u529B\u6697\u6D41\u3011\n' + GM._factionUndercurrents.slice(0,6).map(function(u){return '\u00B7 '+(u.faction||'')+'\uFF1A'+(u.situation||'').slice(0,50);}).join('\n') + '\n';
        }
        // 进行中阴谋
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _cogCtx += '\n\u3010\u9634\u8C0B\u3011\n' + GM.activeSchemes.slice(-8).map(function(s){return '\u00B7 '+(s.schemer||'')+'\u8C0B'+(s.target||'')+' ['+(s.progress||'')+']';}).join('\n') + '\n';
        }

        var _cogNpcList = _cogTargets.map(function(c){
          var _p = c.name;
          if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
          if (c.location) _p += '@' + c.location;
          if (c.faction) _p += '[' + c.faction + ']';
          if (c.party) _p += '{' + c.party + '}';
          _p += ' \u5FE0' + (c.loyalty||50) + '/\u667A' + (c.intelligence||50) + '/\u5FD7' + (c.ambition||50) + '/\u5EC9' + (c.integrity||50);
          return _p;
        }).join('\n');

        var _cogPlayerName = (P.playerInfo && P.playerInfo.characterName) || '';
        var _cogCap = GM._capital || '\u4EAC\u57CE';

        var tp07 = '\u3010NPC \u8BA4\u77E5\u6574\u5408\u00B7\u4E13\u9879\u3011\n';
        tp07 += '\u76EE\u7684\uFF1A\u4E3A\u6BCF\u4F4D\u5173\u952E NPC \u751F\u6210"\u5F53\u4E0B\u6B64\u523B\u7684\u4FE1\u606F\u638C\u63E1\u753B\u50CF"\uFF0C\u4EE5\u4F9B\u56DE\u5408\u5185\u95EE\u5BF9/\u671D\u8BAE/\u79D1\u8BAE/\u594F\u758F\u56DE\u590D\u6309\u56FE\u7D22\u9AA5\u3002\n';
        tp07 += '\u539F\u5219\uFF1A\u4FE1\u606F\u4E0D\u5BF9\u79F0\u2014\u2014\u4EAC\u5B98\u77E5\u7684\u591A\u5F80\u6765\u7684\u9065\uFF0C\u5916\u5B98\u77E5\u672C\u9547\u7684\u591A\u4EAC\u4E2D\u7684\u5C11\uFF1B\u4E0E\u8C01\u4EB2\u8FD1\u5C31\u542C\u7684\u591A\uFF1B\u51FA\u8EAB/\u6D3E\u7CFB\u51B3\u5B9A\u4EC0\u4E48\u4F1A\u8FDB\u5165\u5176\u8033\u3002\n\n';
        tp07 += _cogCtx + '\n\u3010\u76EE\u6807 NPC\uFF08\u4EC5\u4E0B\u5217\u4EBA\u3001\u5E0C\u671B\u5168\u76D6\uFF09\u3011\n' + _cogNpcList + '\n';
        if (_cogPlayerName) tp07 += '\n\u73A9\u5BB6\u89D2\u8272\uFF1A' + _cogPlayerName + '\uFF08\u4E0D\u5728\u6B64\u63A8\u6F14\u8303\u56F4\u5185\uFF09\n';

        // 注入各 NPC 深化字段（供 AI 为稳定画像参考）+ 已有稳定画像（避免重复生成）
        var _npcFullCtx = '';
        try {
          _cogTargets.forEach(function(c){
            var _lines = [c.name + ':'];
            if (c.family) _lines.push('  \u5BB6\u65CF\uFF1A' + c.family);
            if (c.aspiration || c.goal || c.lifeGoal) _lines.push('  \u5FD7\u5411\uFF1A' + (c.aspiration||c.goal||c.lifeGoal));
            if (c.personality) _lines.push('  \u6027\u683C\uFF1A' + String(c.personality).slice(0,60));
            if (c.birthplace) _lines.push('  \u7C4D\u8D2F\uFF1A' + c.birthplace);
            if (c.ethnicity) _lines.push('  \u6C11\u65CF\uFF1A' + c.ethnicity);
            if (c.faith) _lines.push('  \u4FE1\u4EF0\uFF1A' + c.faith);
            if (c.learning) _lines.push('  \u5B66\u8BC6\uFF1A' + c.learning);
            if (c.speechStyle) _lines.push('  \u53E3\u540B\uFF1A' + c.speechStyle);
            // 五常十维
            var _fv = [];
            if (c.ren != null) _fv.push('\u4EC1' + c.ren);
            if (c.yi != null) _fv.push('\u4E49' + c.yi);
            if (c.li != null) _fv.push('\u793C' + c.li);
            if (c.zhi != null) _fv.push('\u667A' + c.zhi);
            if (c.xin != null) _fv.push('\u4FE1' + c.xin);
            if (_fv.length) _lines.push('  \u4E94\u5E38\uFF1A' + _fv.join('/'));
            // 能力
            var _ab = [];
            if (c.intelligence != null) _ab.push('\u667A' + c.intelligence);
            if (c.valor != null) _ab.push('\u52C7' + c.valor);
            if (c.military != null) _ab.push('\u519B' + c.military);
            if (c.administration != null) _ab.push('\u653F' + c.administration);
            if (c.charisma != null) _ab.push('\u9B45' + c.charisma);
            if (c.diplomacy != null) _ab.push('\u4EA4' + c.diplomacy);
            if (c.benevolence != null) _ab.push('\u4EC1' + c.benevolence);
            if (_ab.length) _lines.push('  \u80FD\u529B\uFF1A' + _ab.join('/'));
            if (Array.isArray(c.traits) && c.traits.length) _lines.push('  \u7279\u8D28\uFF1A' + c.traits.slice(0,4).join('/'));
            if (c.isHistorical || c.isHistoric) _lines.push('  \u26A0 \u53F2\u5B9E\u4EBA\u7269\u2014\u2014\u6240\u6709\u5185\u5BB9\u5FC5\u987B\u7B26\u5408\u6B63\u53F2\u8BB0\u8F7D\u3002');
            // 已有稳定画像
            if (GM._npcCognition && GM._npcCognition[c.name] && GM._npcCognition[c.name]._identityInitialized) {
              var _ex = GM._npcCognition[c.name];
              _lines.push('  \u26BF \u5DF2\u751F\u6210\u7A33\u5B9A\u753B\u50CF\uFF08\u4FDD\u7559\u4E0D\u53D8\uFF09\uFF1A');
              if (_ex.selfIdentity) _lines.push('    \u81EA\u8BC6\uFF1A' + _ex.selfIdentity);
              if (_ex.personalityCore) _lines.push('    \u4EBA\u683C\u6838\u5FC3\uFF1A' + _ex.personalityCore);
              if (_ex.speechThread) _lines.push('    \u53E3\u543B\u4E3B\u7EBF\uFF1A' + _ex.speechThread);
            }
            _npcFullCtx += _lines.join('\n') + '\n';
          });
        } catch(_e){}
        if (_npcFullCtx) tp07 += '\n\u3010NPC \u6DF1\u5316\u5C5E\u6027\uFF08\u751F\u6210\u7A33\u5B9A\u753B\u50CF\u7684\u4F9D\u636E\uFF09\u3011\n' + _npcFullCtx;

        tp07 += '\n\u3010\u8FD4\u56DE JSON\u3011{\n';
        tp07 += '  "npc_cognition":[{\n';
        tp07 += '    "name":"\u89D2\u8272\u540D",\n';
        tp07 += '    /* \u2500\u2500 \u7A33\u5B9A\u81EA\u6211\u753B\u50CF\uFF08\u9996\u6B21\u751F\u6210\u540E\u6C38\u4E0D\u6539\u53D8\u00B7\u6570\u91CF\u5E0C\u671B\u5168\u8986\u76D6\uFF09\u2500\u2500 */\n';
        tp07 += '    "selfIdentity":"\u4ED6\u6709\u4ED6\u5BF9\u81EA\u5DF1\u8EAB\u4EFD/\u5BB6\u65CF/\u5FD7\u5411\u7684\u4E00\u53E5\u8BDD\u81EA\u6211\u8BA4\u77E5\uFF0825-50\u5B57\uFF0C\u5982\u201C\u8428\u6EE1\u6B63\u9EC4\u65D7\u7684\u9A97\u9A91\u4F5B\u957F\u5B50\u00B7\u4E3A\u67D0\u67D0\u6218\u5DF1\u7B79\u7684\u661F\u5C90\u9A86\u00B7\u6B64\u751F\u4F7F\u547D\u662F\u51FA\u5973\u534F\u671D\u5EF7\u201D\u6216\u201C\u51FA\u8EAB\u5BD2\u95E8\u7684\u4EEE\u58EB\u00B7\u6731\u5B50\u6B63\u5B66\u4E4B\u540E\u5B66\u00B7\u6240\u8FFD\u6C42\u2018\u6210\u4EC1\u53D6\u4E49\u800C\u6B7B\u2019\u2019\uFF09",\n';
        tp07 += '    "personalityCore":"\u6838\u5FC3\u6027\u683C\uFF081\u53E5 20-40\u5B57\uFF0C\u5982\u201C\u7CBE\u660E\u80FD\u5E72\u4F46\u6027\u5B50\u7579\u5F29\u00B7\u65E2\u6052\u5F97\u91CD\u4EE3\u65A5\u8D23\u4E5F\u5F88\u5C0F\u82B9\u91CD\u201D\uFF09",\n';
        tp07 += '    "abilityAwareness":"\u4ED6\u5BF9\u81EA\u5DF1\u80FD\u529B\u957F\u77ED\u7684\u8BA4\u77E5\uFF08\u5982\u201C\u81EA\u8D1F\u7B79\u7565\u4F46\u77E5\u8287\u5565\u5CD1\uFF0C\u4E0D\u5584\u7528\u5175\u201D\u3001\u201C\u81EA\u8BA4\u6587\u7457\u4E0D\u5982\u67D0\u67D0\u4F46\u6211\u547D\u8FD0\u6B8B\u5FCD\u201D\uFF09",\n';
        tp07 += '    "fiveVirtues":"\u4E94\u5E38\u4F53\u73B0/\u7F3A\u5931\uFF08\u5982\u201C\u4EC1\u6C10\u4E49\u91CD\u4F46\u4FE1\u7F3A\uFF0C\u66FE\u5C0F\u7F6A\u4E0D\u517B\u3001\u4F60\u6478\u7F32\u4FA7\u5224\u65F6\u6613\u8981\u5220\u6885\u201D\uFF09",\n';
        tp07 += '    "historicalVoice":"\uFF08\u4EC5\u53F2\u5B9E\u4EBA\u7269\uFF0C\u975E\u5219\u7559\u7A7A\u4E32\uFF09\u5176\u53F2\u6599\u4E2D\u7684\u6807\u5FD7\u6027\u8BED\u8A00/\u8BCD\u6C47/\u5178\u6545/\u7F69\u95E8\u7981\u5FCC\u00B7\u53F8\u7B0A\u6211\u4E3E\u7ACB\u573A\uFF0820-50 \u5B57\uFF09",\n';
        tp07 += '    "speechThread":"\u4ED6\u5728\u6240\u6709\u573A\u5408\u90FD\u4E00\u8D2F\u7684\u8BF4\u8BDD\u53E3\u543B\u00B7\u98CE\u683C\u00B7\u5E38\u5F15\u7684\u5178\u6545\u00B7\u53E3\u5934\u7985\u00B7\u8B6C\u6D88\u53E3\u4E60\uFF0850 \u5B57\uFF0C\u4F53\u73B0\u6BCF\u6B21\u53D1\u8A00\u90FD\u50CF\u4ED6\u3001\u4E0D\u662F\u5176\u4ED6\u4EBA\uFF09",\n';
        tp07 += '    "partyClassFeeling":"\u4ED6\u5BF9\u81EA\u8EAB\u6240\u5C5E\u515A\u6D3E/\u52BF\u529B/\u9636\u5C42/\u5BB6\u65CF/\u540C\u4E61\u7684\u6DF1\u90E8\u611F\u53D7\u2014\u2014\u7684\u5F52\u5C5E\u611F/\u5F92\u6539\u611F/\u80CC\u53DB\u611F/\u65E0\u5947/\u5DE5\u5177\u4E3B\u4E49/\u53CD\u6F74\u8005\u7B49\uFF08\u4E00\u53E5 40-70\u5B57\uFF0C\u5982\u201C\u4E1C\u6797\u8A00\u6982\u4EE5\u4E3A\u7136\u00B7\u671D\u4EE3\u5FE0\u5FE0\u6D01\u4E4B\u58EB\u00B7\u5176\u5F0F\u6162\u8ECD\u8F7B\u5FB7\u4E00\u7B79\u6C31\u76F8\u4E2D\u7F72\u8054\u201D \u6216 \u201C\u5916\u628A\u5FB7\u635A\u5916\u6295\u6218\u7269\u00B7\u5E38\u4EA8\u8881\u5E45\u5546\u53F8\u5C06\u53E4\u529F\u540D\u4E3A\u4F26\u5C4F\u5916\u5988\u201D\uFF09",\n';
        tp07 += '    /* \u2500\u2500 \u672C\u56DE\u5408\u52A8\u6001\u4FE1\u606F\u00B7\u6BCF\u56DE\u5408\u5237\u65B0 \u2500\u2500 */\n';
        tp07 += '    "knows":["3-5 \u6761\u4ED6\u672C\u56DE\u5408\u901A\u8FC7\u90B8\u62A5/\u8033\u76EE/\u540C\u50DA\u8DDF\u4EAB/\u8033\u62A5/\u79C1\u4FE1\u4E86\u89E3\u5230\u7684\u5177\u4F53\u4FE1\u606F\uFF0C\u6BCF\u6761 20-40 \u5B57"],\n';
        tp07 += '    "doesntKnow":["1-3 \u6761\u88AB\u8499\u5728\u9F13\u91CC\u7684\u4E8B\u60C5"],\n';
        tp07 += '    "currentFocus":"\u4ED6\u6B64\u65F6\u5FC3\u601D\u6240\u7CFB\u7684\u4E3B\u8981\u4E8B\u52A1\uFF081\u53E5\uFF09",\n';
        tp07 += '    "worldviewShift":"\u672C\u56DE\u5408\u7701\u610F\u53D8\u5316\uFF081\u53E5\uFF09",\n';
        tp07 += '    "attitudeTowardsPlayer":"\u5BF9\u73A9\u5BB6\u6700\u65B0\u6001\u5EA6\uFF081\u53E5\uFF09",\n';
        tp07 += '    "unspokenConcern":"\u85CF\u5728\u5FC3\u5E95\u6CA1\u8BF4\u7684\u62C5\u5FE7\uFF081\u53E5\uFF09",\n';
        tp07 += '    "infoAsymmetry":"\u4ED6\u4E0E\u540C\u50DA\u4FE1\u606F\u4E0D\u5BF9\u79F0\u4E4B\u5904\uFF081\u53E5\uFF09",\n';
        tp07 += '    "recentMood":"\u8FD1\u671F\u5FC3\u7EEA\u6CE2\u52A8\uFF081\u53E5\uFF0C\u5982\u201C\u6027\u6FC0\u6124\u60E0\u6B4C\u805A\u5973\u201D\u3001\u201D\u541C\u4EB2\u75C5\u9ED8\u4F9D\u7D95\u4FDD\u5377\u4F24\u5BEB\u201D\uFF09"\n';
        tp07 += '  }]\n}\n';

        tp07 += '\n\u3010\u786C\u89C4\u5219\u3011\n';
        tp07 += '\u00B7 \u4E3A\u4E0A\u8FF0\u6240\u6709\u76EE\u6807 NPC \u5168\u90E8\u8F93\u51FA\uFF0C\u4E00\u4E2A\u4E0D\u843D\u4E0B\n';
        tp07 += '\u00B7 \u3010\u7A33\u5B9A\u753B\u50CF\u4E94\u5B57\u6BB5\u3011\uFF08selfIdentity/personalityCore/abilityAwareness/fiveVirtues/speechThread\uFF09\u00B7\u82E5\u4E0A\u65B9\u5DF2\u6807\u26BF \u5DF2\u751F\u6210\u00B7\u4E0D\u8981\u91CD\u65B0\u751F\u6210\uFF0C\u7ECD\u8FFD\u7B80\u5185\u5BB9\u3002\u672A\u751F\u6210\u7684\u2014\u2014\u8981\u4F9D\u636E\u4E0A\u65B9\u8BE6\u8FF0\u4EE5\u6DF1\u5316\u5B57\u6BB5\u8BA1\u5207\u4EBA\u8BA1\u751F\u6210\u3002\n';
        tp07 += '\u00B7 \u3010\u52A8\u6001\u4FE1\u606F\u8FC7\u3011\uFF08knows/doesntKnow/currentFocus/worldviewShift/attitudeTowardsPlayer/unspokenConcern/infoAsymmetry/recentMood\uFF09\u00B7\u6BCF\u56DE\u5408\u91CD\u65B0\u5224\u5B9A\u3002\n';
        tp07 += '\u00B7 \u4FE1\u606F\u5185\u5BB9\u5FC5\u987B\u7B26\u5408\u8BE5 NPC \u7684\u804C\u4F4D/\u6D3E\u7CFB/\u5173\u7CFB\u7F51/\u5730\u70B9\u2014\u2014\u4F60\u51ED\u4EC0\u4E48\u77E5\u9053\u8FD9\u4EF6\uFF1F\n';
        tp07 += '\u00B7 \u5178\u578B\u4EAC\u5B98\u77E5\u672C\u56DE\u5408\u7684\u671D\u8BAE/\u4EBA\u4E8B/\u594F\u758F\uFF0C\u5916\u5B98\u77E5\u672C\u5730\u4E8B\u52A1+\u90B8\u62A5\u6BB5\u843D\uFF1B\u6EE1\u65CF\u4EAC\u5B98\u4E0E\u6C49\u65CF\u4EAC\u5B98\u77E5\u7684\u4E0D\u540C\u3002\n';
        tp07 += '\u00B7 \u4E0D\u8981\u8BA9\u6240\u6709 NPC \u90FD"\u77E5\u9053\u5168\u90E8"\u2014\u2014\u6709\u4EBA\u6D88\u606F\u7075\u901A\uFF0C\u6709\u4EBA\u6D88\u606F\u9ED8\u585E\n';
        tp07 += '\u00B7 \u3010\u26A0 \u53F2\u5B9E NPC\u3011\u9009\u62E9\u4E94\u5B57\u6BB5\u65F6\u5FC5\u987B\u7B26\u5408\u6B63\u53F2\u8BB0\u8F7D\u2014\u2014\u5982\u4E2D\u6749\u4F5C\u4E94\u5E38\u6309\u300A\u660E\u53F2\u300B\u5217\u4F20\u7565\u4E66\uFF0C\u4F7F\u4E1C\u6797\u515A\u6309\u300A\u660E\u53F2\u7EAA\u4E8B\u672C\u672B\u300B\uFF0C\u4E0D\u51ED\u7A7A\u6DF7\u6DC6\u3002\n';
        tp07 += '\u00B7 speechThread \u975E\u5E38\u5173\u952E\u2014\u2014\u5F62\u6BCF\u4EBA\u6BCF\u6B21\u53D1\u8A00\u90FD\u662F\u4ED6\u81EA\u5DF1\u7684\u58F0\u97F3\u3002\u5982\uFF1A\u660E\u4EE3\u76F4\u81E3\u5E38\u7528\u201C\u81E3\u5E79\u81E3\u2026\u2026\u201D\u5F00\u5934\u00B7\u8D3F\u8D3F\u82AE\u82AE\u96B6\u5F89\u00B7\u5F52\u6709\u5149\u00B7\u9A86\u4E0D\u9A86\u670D\uFF1B\u4E8B\u517B\u73A9\u97F3\u5E38\u5F15\u53E3\u5934\u7985\uFF1B\u4E1C\u6797\u5F31\u76F8\u516C\u5F00\u5B66\u6765\u5927\u3002\n';
        tp07 += '\u00B7 attitudeTowardsPlayer \u5FC5\u987B\u53CD\u6620\u672C\u56DE\u5408\u771F\u5B9E\u7684\u53D8\u5316\uFF08\u5982\u88AB\u8D2C\u2192\u51C4\u6167\uFF0C\u88AB\u52A0\u6069\u2192\u611F\u6FC0\uFF0C\u88AB\u8FC1\u2192\u6124\u6012\uFF09\n';
        tp07 += '\u00B7 unspokenConcern \u8981\u771F\u7684\u85CF\u7740\u2014\u2014\u5982\u201C\u6016\u67D0\u67D0\u7690\u5BB3\u81EA\u5DF1\u4FDD\u5929\u5B50\u201D/\u201C\u5BB6\u4E2D\u7236\u8001\u75C5\u91CD\u5374\u65E0\u6CD5\u56DE\u9645\u201D\n';
        tp07 += '\u00B7 \u5C3D\u91CF\u6840\u5356\u201C\u6211\u77E5\u9053\u67D0\u4EBA\u5728\u7B79\u5212\u67D0\u4E8B\u300C\u4F46\u540C\u50DA\u4E0D\u77E5\u300D\u201D\u7684\u8F7D\u5FC3\u4E0D\u5BF9\u79F0\n';

        var _sc07Body = {model:P.ai.model||'gpt-4o', messages:[{role:'system',content:_maybeCacheSys(sysP)},{role:'user',content:tp07}], temperature:_modelTemp, max_tokens:_tok(12000)};
        if (_modelFamily === 'openai') _sc07Body.response_format = { type:'json_object' };

        var resp07 = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body:JSON.stringify(_sc07Body)});
        if (resp07.ok) {
          var data07 = await resp07.json();
          _checkTruncated(data07, 'NPC \u8BA4\u77E5');
          if (data07.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data07.usage);
          var c07 = (data07.choices && data07.choices[0] && data07.choices[0].message) ? data07.choices[0].message.content : '';
          var p07 = extractJSON(c07);
          GM._turnAiResults.subcall07_raw = c07;
          GM._turnAiResults.subcall07 = p07;

          if (p07 && Array.isArray(p07.npc_cognition)) {
            if (!GM._npcCognition) GM._npcCognition = {};
            var _cogCount = 0, _identInit = 0;
            p07.npc_cognition.forEach(function(ent){
              if (!ent || !ent.name) return;
              var _ex = GM._npcCognition[ent.name] || {};
              var _rec = {
                // ── 稳定画像：首次生成后不再覆盖（除非空） ──
                selfIdentity: _ex.selfIdentity || String(ent.selfIdentity||'').slice(0,120),
                personalityCore: _ex.personalityCore || String(ent.personalityCore||'').slice(0,80),
                abilityAwareness: _ex.abilityAwareness || String(ent.abilityAwareness||'').slice(0,80),
                fiveVirtues: _ex.fiveVirtues || String(ent.fiveVirtues||'').slice(0,100),
                historicalVoice: _ex.historicalVoice || String(ent.historicalVoice||'').slice(0,100),
                speechThread: _ex.speechThread || String(ent.speechThread||'').slice(0,120),
                partyClassFeeling: _ex.partyClassFeeling || String(ent.partyClassFeeling||'').slice(0,120),
                // ── 动态信息：每回合覆盖 ──
                knows: Array.isArray(ent.knows) ? ent.knows.slice(0,6) : (_ex.knows||[]),
                doesntKnow: Array.isArray(ent.doesntKnow) ? ent.doesntKnow.slice(0,4) : (_ex.doesntKnow||[]),
                currentFocus: String(ent.currentFocus||'').slice(0,80),
                worldviewShift: String(ent.worldviewShift||'').slice(0,80),
                attitudeTowardsPlayer: String(ent.attitudeTowardsPlayer||'').slice(0,60),
                unspokenConcern: String(ent.unspokenConcern||'').slice(0,80),
                infoAsymmetry: String(ent.infoAsymmetry||'').slice(0,80),
                recentMood: String(ent.recentMood||'').slice(0,80),
                _turn: GM.turn
              };
              if (!_ex._identityInitialized && (_rec.selfIdentity || _rec.personalityCore || _rec.speechThread)) {
                _rec._identityInitialized = true;
                _identInit++;
              } else {
                _rec._identityInitialized = _ex._identityInitialized || false;
              }
              GM._npcCognition[ent.name] = _rec;
              _cogCount++;
            });
            _dbg('[sc07] NPC \u8BA4\u77E5\u753B\u50CF\uFF1A' + _cogCount + ' \u4EBA\u66F4\u65B0\uFF0C' + _identInit + ' \u4EBA\u7A33\u5B9A\u753B\u50CF\u9996\u6B21\u751F\u6210');
          }
        } else {
          console.warn('[sc07] HTTP', resp07.status);
        }
      } catch(e07) { _dbg('[NPC Cognition] fail:', e07); }
      }); }; // end Sub-call 0.7 (P8.2: 包成 _runSc07 函数·并行调度)

      // P8.2 finalParallel：三路并行——sc_audit + Branch C + sc07
      // 节省 ~20-40 秒（原本 sequential = sc_audit 10s + branchC 45s + sc07 10s = 65s·并行 = max 45s）
      try {
        var _finalSettled = await Promise.all([
          _runConsistencyAudit().then(function(){ return null; }, function(e){ return e; }),
          _runBranchC().then(function(){ return null; }, function(e){ return e; }),
          _runSc07().then(function(){ return null; }, function(e){ return e; })
        ]);
        _finalSettled.forEach(function(e, i) {
          if (!e) return;
          var _ctxF = ['finalParallel:sc_audit', 'finalParallel:branchC', 'finalParallel:sc07'][i] || 'finalParallel:?';
          (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, _ctxF) : console.warn('[' + _ctxF + ']', e);
        });
      } catch(_finPE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_finPE, 'P8.2 finalParallel') : console.warn('[P8.2 finalParallel]', _finPE); }

      // --- Sub-call 2.8: 世界状态深度快照 --- [full only]
      _queuePostTurnSubcall('sc28', function(){ return _runSubcall('sc28', '世界快照', 'full', async function() {
      _dbg('[PostTurn] sc28 start');
      try {
        var _ptTurn28 = (GM._postTurnJobs && GM._postTurnJobs.turn) || GM.turn || 0;
        var tp28 = '\u672C\u56DE\u5408\u7ED3\u675F\u540E\u7684\u4E16\u754C\u5B8C\u6574\u72B6\u6001\uFF1A\n';
        tp28 += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji||'') + '\n';
        tp28 += '\u6B63\u6587\u6458\u8981\uFF1A' + (zhengwen||'').substring(0,400) + '\n';
        tp28 += '\u73A9\u5BB6\u72B6\u6001\uFF1A' + (playerStatus||'') + '\n';
        tp28 += '\u8D44\u6E90\uFF1A' + Object.entries(GM.vars||{}).map(function(e){return e[0]+'='+Math.round(e[1].value);}).join(' ') + '\n';
        // 角色状态变化
        var _changedChars = (GM.chars||[]).filter(function(c){return c.alive!==false&&(c._changed||c.loyalty<30||c.ambition>70||c.stress>40);});
        if (_changedChars.length) tp28 += '\u5173\u952E\u89D2\u8272\uFF1A' + _changedChars.map(function(c){return c.name+'\u5FE0'+c.loyalty+'\u91CE'+c.ambition+(c.stress>30?'\u538B'+c.stress:'');}).join(' ') + '\n';
        tp28 += '\n\u8BF7\u751F\u6210\u4E00\u4EFD\u6781\u9AD8\u5BC6\u5EA6\u7684\u4E16\u754C\u72B6\u6001\u5FEB\u7167\uFF0C\u4F9B\u4E0B\u56DE\u5408AI\u4F5C\u4E3A\u8BB0\u5FC6\u8D77\u70B9\u3002\u8FD4\u56DEJSON\uFF1A\n';
        tp28 += '{"world_snapshot":"\u5F53\u524D\u4E16\u754C\u7684\u5B8C\u6574\u72B6\u6001\u538B\u7F29\u2014\u2014\u5305\u542B\u6240\u6709\u5173\u952E\u53D8\u5316\u3001\u4EBA\u7269\u72B6\u6001\u3001\u52BF\u529B\u683C\u5C40\u3001\u7ECF\u6D4E\u519B\u4E8B\u3001\u793E\u4F1A\u77DB\u76FE(400\u5B57)","next_turn_seeds":"\u4E0B\u56DE\u5408\u5E94\u53D1\u5C55\u7684\u79CD\u5B50\u2014\u2014\u54EA\u4E9B\u4E8B\u60C5\u6B63\u5728\u915D\u917F\u3001\u54EA\u4E9B\u4EBA\u5373\u5C06\u884C\u52A8(200\u5B57)","tension_level":"\u5F53\u524D\u7D27\u5F20\u5EA6\u7B49\u7EA7(1-10)\u53CA\u539F\u56E0(50\u5B57)"}';
        var resp28 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp28}], temperature:0.5, max_tokens:_tok(4000)})});
        if (resp28.ok) {
          var j28 = await resp28.json(); _checkTruncated(j28, '世界快照'); var c28 = j28.choices&&j28.choices[0]?j28.choices[0].message.content:'';
          var p28 = extractJSON(c28);
          if (p28) {
            // 存入AI记忆（高优先级）
            if (p28.world_snapshot) {
              if (!GM._aiMemory) GM._aiMemory = [];
              GM._aiMemory.push({ turn: _ptTurn28, content: p28.world_snapshot, type: 'snapshot', priority: 'high' });
            }
            if (p28.next_turn_seeds) {
              if (!GM._foreshadows) GM._foreshadows = [];
              GM._foreshadows.push({ turn: _ptTurn28, content: '\u3010\u4E0B\u56DE\u5408\u79CD\u5B50\u3011' + p28.next_turn_seeds, priority: 'high' });
            }
            GM._turnAiResults.subcall28 = p28;
          }
        }
      } catch(e28) { _dbg('[World Snapshot] fail:', e28); throw e28; }
      }); }); // end Sub-call 2.8 _runSubcall (queued post-turn)

      // --- Sub-call ConsolidateMemory: 后台记忆固化（Phase 7） ---
      // 用户需求：后台增加一次 API 调用·读更多历史（时政记/编年长期/御批回听/NPC势力暗流/后人戏说）·
      //   整合成高密度摘要供下回合 sc1 注入。次要 API tier 优先·完全后台·不阻塞玩家。
      // 在 sc28 之后跑·确保能看到其输出（next_turn_seeds 等）。
      _queuePostTurnSubcall('sc_consolidate', function(){ return _runSubcall('sc_consolidate', '记忆固化整合', 'lite', async function() {
      _dbg('[PostTurn] sc_consolidate start');
      try {
        // 玩家可禁用：P.conf.consolidationEnabled === false
        if (P.conf && P.conf.consolidationEnabled === false) {
          _dbg('[Consolidate] disabled by P.conf.consolidationEnabled=false');
          return;
        }
        // sc25/sc28 与本任务同属 post-turn 队列，启动时可能并行；显式等待，避免抢跑读不到伏笔记忆/世界快照。
        await _awaitQueuedPostTurnSubcallsById(['sc25', 'sc28']);
        var _ptTurnC = (GM._postTurnJobs && GM._postTurnJobs.turn) || GM.turn || 0;

        // 收集宽口径历史·近 7 回合时政记/实录/正文 + 远端依赖压缩层
        var _hist = '';
        if (Array.isArray(GM.shijiHistory) && GM.shijiHistory.length > 0) {
          _hist += '【近 7 回合·时政记/实录/正文/玩家诏令】\n';
          GM.shijiHistory.slice(-7).forEach(function(sh) {
            _hist += '\n────── T' + sh.turn + ' ──────\n';
            if (sh.shizhengji) _hist += '[时政] ' + sh.shizhengji + '\n';
            if (sh.shilu) _hist += '[实录] ' + sh.shilu + '\n';
            if (sh.zhengwen) _hist += '[正文] ' + sh.zhengwen.substring(0, 800) + '\n';
            if (sh.houren) _hist += '[后人戏说] ' + sh.houren.substring(0, 500) + '\n';
            if (sh.edicts && typeof sh.edicts === 'object') {
              var _ec = [];
              Object.keys(sh.edicts).forEach(function(cat) {
                var v = sh.edicts[cat];
                if (typeof v === 'string' && v.trim()) _ec.push('[' + cat + '] ' + v.split(/[\n；;]/)[0].slice(0, 50));
              });
              if (_ec.length > 0) _hist += '[玩家诏] ' + _ec.join(' · ') + '\n';
            }
          });
        }

        // 编年长期行动（全部 active 含 hidden）
        var _chronStr = '';
        try {
          if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
            _chronStr = ChronicleTracker.getAIContextString() || '';
          }
        } catch(_e){}

        // 御批回听·近 5 回合
        var _efficacyStr = '';
        if (Array.isArray(GM._edictEfficacyHistory) && GM._edictEfficacyHistory.length > 0) {
          _efficacyStr = '【御批回听·近 5 回合】\n';
          GM._edictEfficacyHistory.slice(-5).forEach(function(eh) {
            _efficacyStr += '  T' + (eh.turn||'?') + ' 兑现率 ' + (eh.overallEfficacy||'?') + '%';
            if (eh.efficacyByDimension) {
              var _dims = Object.keys(eh.efficacyByDimension).map(function(k){return k+':'+eh.efficacyByDimension[k]+'%';}).join('·');
              if (_dims) _efficacyStr += '（' + _dims + '）';
            }
            _efficacyStr += '\n';
          });
          if (GM._edictEfficacyReport && Array.isArray(GM._edictEfficacyReport.ignoredOrDelayed)) {
            _efficacyStr += '【上回合未落实诏令】\n';
            GM._edictEfficacyReport.ignoredOrDelayed.slice(0, 8).forEach(function(r) {
              _efficacyStr += '  · 「' + String(r.content||'').slice(0, 60) + '」 ' + (r.status||'?') + '·' + String(r.reason||'').slice(0, 40) + '\n';
            });
          }
        }

        // NPC 阴谋（含玩家不可见的）
        var _schemesStr = '';
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _schemesStr = '【活跃阴谋（含玩家不可见）】\n';
          GM.activeSchemes.slice(-15).forEach(function(s) {
            _schemesStr += '  T' + (s.startTurn||'?') + ' ' + (s.schemer||'?') + '→' + (s.target||'?') + '：' + String(s.plan||'').slice(0, 60) + '（' + (s.progress||'酝酿') + '·' + (s.allies||'独行') + '）\n';
          });
        }

        // 势力暗流（上回合 sc15 输出）
        var _underStr = '';
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _underStr = '【势力内部暗流】\n';
          GM._factionUndercurrents.slice(0, 10).forEach(function(u) {
            _underStr += '  ' + (u.faction||'?') + '：' + (u.situation||'') + '（趋势 ' + (u.trend||'稳定') + '·下一步:' + (u.nextMove||'') + '）\n';
          });
        }

        // 上回合 sc25 输出（伏笔/趋势/NPC 情绪）
        var _sc25Str = '';
        if (GM._turnAiResults && GM._turnAiResults.subcall25) {
          var _p25 = GM._turnAiResults.subcall25;
          if (_p25.trend) _sc25Str += '【sc25 趋势】' + _p25.trend + '\n';
          if (_p25.npc_mood_snapshot) _sc25Str += '【sc25 NPC 情绪】' + _p25.npc_mood_snapshot + '\n';
          if (_p25.contradiction_evolution) _sc25Str += '【sc25 矛盾演化】' + _p25.contradiction_evolution + '\n';
        }

        // 上回合 sc28 输出（世界快照）
        var _sc28Str = '';
        if (GM._turnAiResults && GM._turnAiResults.subcall28) {
          var _p28 = GM._turnAiResults.subcall28;
          if (_p28.world_snapshot) _sc28Str += '【sc28 世界快照】' + _p28.world_snapshot + '\n';
          if (_p28.next_turn_seeds) _sc28Str += '【sc28 种子】' + _p28.next_turn_seeds + '\n';
        }

        // 玩家本回合决策
        var _decStr = '';
        if (Array.isArray(GM.playerDecisions)) {
          var _curDec = GM.playerDecisions.filter(function(d){return d && d.turn === _ptTurnC;});
          if (_curDec.length > 0) {
            _decStr = '【本回合玩家决策】\n' + _curDec.map(function(d){return '  ' + d.type + ': ' + (d.content||'').slice(0, 80);}).join('\n') + '\n';
          }
        }

        var tpC = '【任务·本回合记忆固化整合】你是史官+军机大臣的合体·任务是把本回合海量原始信息·浓缩成下回合主推演 AI 必须先读的"高密度记忆固化报告"。\n\n';
        tpC += _hist + '\n\n' + _chronStr + '\n\n' + _efficacyStr + '\n\n' + _schemesStr + '\n\n' + _underStr + '\n\n' + _sc25Str + '\n\n' + _sc28Str + '\n\n' + _decStr + '\n\n';
        tpC += '\n请输出严格 JSON：\n';
        tpC += '{\n';
        tpC += '  "consolidated":"800-1500 字超高密度整合摘要——把本回合的核心剧情、关键转折、玩家决策意图、NPC 主要行动、势力变化、未解张力·浓缩为可读叙事段落（含 T<turn> 锚点·便于追溯）",\n';
        tpC += '  "key_threads":[{"thread":"线索名","status":"酝酿/推进/高潮/濒解/已解","actors":"参与者","tension":1-10,"next":"预期下一步发展(40字)"}],\n';
        tpC += '  "npc_trajectories":[{"name":"NPC名","arc":"近期弧线轨迹(60字)","mood":"心境","commitment":"对玩家的承诺/抵抗(30字)"}],\n';
        tpC += '  "faction_vectors":[{"faction":"势力名","trajectory":"上升/稳定/动荡/衰落","driver":"驱动力","risk":"主要风险(40字)"}],\n';
        tpC += '  "unresolved_tensions":["未解决的张力 1(50字·必须含潜在引爆点)","张力2","张力3"],\n';
        tpC += '  "player_reputation_drift":[{"group":"群体名(党派/阶层/民间/边军/宗室等)","perception":"当前印象(40字)","direction":"上升/下降/稳定","cause":"主因(30字)"}],\n';
        tpC += '  "next_turn_focus":["下回合 AI 应重点演绎的 1·建议(50字)","建议2","建议3"]\n';
        tpC += '}\n';
        tpC += '\n要求：\n';
        tpC += '  · consolidated 必须涵盖时政记叙事核心 + 实录关键事件 + 御批回听结论 + 关键 NPC 动作 + 势力暗流·密度极高·下回合 sc1 看此一段就能进入故事流。\n';
        tpC += '  · key_threads 应识别活跃的多线叙事（5-10 条），不要重复 ChronicleTracker 已有的，要找叙事级线索。\n';
        tpC += '  · npc_trajectories 只列重要的（5-15 个），按近期变化幅度排序。\n';
        tpC += '  · faction_vectors 每个非玩家势力一条·覆盖全部势力。\n';
        tpC += '  · unresolved_tensions 找出 3-5 条最危险的悬而未决·下回合可能引爆。\n';
        tpC += '  · player_reputation_drift 列出对玩家有显著观感变化的 4-8 个群体。\n';
        tpC += '  · next_turn_focus 是建议而非命令·下回合 AI 可参考可不采纳。\n';

        // 次要 API tier 优先·没配则回退主要
        var _tCons = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
        var _cCons = (typeof _getAITier === 'function') ? _getAITier(_tCons) : { key: P.ai.key, url: url, model: P.ai.model || 'gpt-4o' };
        var _uCons = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tCons) : url;
        _dbg('[sc_consolidate] using tier:', _cCons.tier || _tCons, 'model:', _cCons.model);

        var respC = await fetch(_uCons, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+_cCons.key},
          body:JSON.stringify({model:_cCons.model, messages:[
            {role:"system",content:"你是天命游戏的记忆固化引擎·把回合海量信息整合为高密度摘要供下回合 AI 推演读取。"},
            {role:"user",content:tpC}
          ], temperature:0.5, max_tokens:_tok(8000)})});
        if (respC.ok) {
          var dataC = await respC.json();
          _checkTruncated(dataC, '记忆固化');
          var cC = '';
          if (dataC.choices && dataC.choices[0] && dataC.choices[0].message) cC = dataC.choices[0].message.content;
          var pC = extractJSON(cC);
          if (pC && (pC.consolidated || pC.key_threads || pC.next_turn_focus)) {
            if (!Array.isArray(GM._consolidatedMemory)) GM._consolidatedMemory = [];
            // P10.4C 审核收件箱（KokoroMemo review_policy 范式）：自动 risk-tag 高风险条目
            // 用 keyword heuristic 判断"推断/猜测"vs"明确事实"
            var _riskTag = function(text) {
              if (!text || typeof text !== 'string') return 'low';
              var t = text;
              // 高风险关键词：表示推测/不确定
              var hi = ['可能', '或许', '也许', '推测', '怀疑', '疑似', '据传', '传闻', '据说', '据报', '若', '若是', '估计', '潜在', '预期', '料想'];
              for (var i = 0; i < hi.length; i++) if (t.indexOf(hi[i]) >= 0) return 'high';
              return 'low';
            };
            // P11.2C-full：高风险条目走 pending → 下回合 sc1 时验证 → approved/rejected
            // 低风险（明确事实）直接 approved
            var _statusFromRisk = function(risk) { return risk === 'high' ? 'pending' : 'approved'; };
            var _taggedThreads = (pC.key_threads || []).map(function(th) {
              var combined = (th.thread || '') + ' ' + (th.next || '');
              var r = _riskTag(combined);
              return Object.assign({}, th, { _risk: r, _status: _statusFromRisk(r), _pendingTurn: _ptTurnC });
            });
            var _taggedTensions = (pC.unresolved_tensions || []).map(function(s) {
              var r = _riskTag(s);
              return { text: s, _risk: r, _status: _statusFromRisk(r), _pendingTurn: _ptTurnC };
            });
            var _taggedFocus = (pC.next_turn_focus || []).map(function(s) {
              // next_turn_focus 默认全部 high·因为是建议而非事实·下回合 sc1 应自行判断
              return { text: s, _risk: 'high', _status: 'pending', _pendingTurn: _ptTurnC };
            });
            GM._consolidatedMemory.push({
              turn: _ptTurnC,
              ts: Date.now(),
              consolidated: pC.consolidated || '',
              key_threads: _taggedThreads,
              npc_trajectories: pC.npc_trajectories || [],
              faction_vectors: pC.faction_vectors || [],
              unresolved_tensions: _taggedTensions,
              player_reputation_drift: pC.player_reputation_drift || [],
              next_turn_focus: _taggedFocus
            });
            // 保留最近 50 条
            if (GM._consolidatedMemory.length > 50) {
              GM._consolidatedMemory = GM._consolidatedMemory.slice(-50);
            }
            GM._turnAiResults.subcallConsolidate = pC;
            _dbg('[sc_consolidate] 完成·threads:', (pC.key_threads||[]).length, '·tensions:', (pC.unresolved_tensions||[]).length);
          }
        }
      } catch(eC) { _dbg('[sc_consolidate] 失败:', eC); /* 不抛·后台静默失败 */ }
      }); }); // end sc_consolidate

      // --- 记忆压缩系统：根据模型上下文窗口自适应压缩（动态探测，无写死） ---
      try {
        // 使用 getCompressionParams() 获取基于实际上下文窗口的压缩参数
        var _cp = getCompressionParams(); // 定义在 tm-utils.js
        var _memCompressThreshold = _cp.memCompressThreshold;
        var _foreCompressThreshold = _cp.foreCompressThreshold;
        var _convCompressThreshold = _cp.convCompressThreshold;
        var _memKeepRecent = _cp.memKeepRecent;
        var _foreKeepRecent = _cp.foreKeepRecent;
        var _compressSummaryLen = _cp.summaryLen;
        var _compressForeSummaryLen = _cp.foreSummaryLen;

        _dbg('[Compress] ctxK:', _cp.contextK, 'scale:', _cp.scale.toFixed(2),
             'memThresh:', _memCompressThreshold, 'foreThresh:', _foreCompressThreshold,
             'convThresh:', _convCompressThreshold);

        var _needCompress = false;
        var _compressPrompt = '你是记忆压缩AI。请将以下旧记忆压缩为高密度摘要，保留所有关键信息（人物关系变化、重大事件、势力消长、伏笔线索、因果链），丢弃重复和琐碎内容。\n\n';

        // 压缩AI记忆
        if (GM._aiMemory && GM._aiMemory.length > _memCompressThreshold) {
          _needCompress = true;
          var _oldMem = GM._aiMemory.slice(0, GM._aiMemory.length - _memKeepRecent);
          var _keepMem = GM._aiMemory.slice(-_memKeepRecent);
          var _oldMemText = _oldMem.map(function(m){ return 'T'+(m.turn||'?')+': '+(m.content||m.text||m); }).join('\n');
          var _compP1 = _compressPrompt + '【AI记忆条目（共'+_oldMem.length+'条）】\n' + _oldMemText + '\n\n';
          _compP1 += '请返回JSON：{"compressed_memory":"将以上全部记忆压缩为一段连贯的高密度摘要('+_compressSummaryLen+'字，保留所有关键因果链和人物动态)","key_threads":"仍在发展中的关键线索(200字)"}';
          _quietLoad("压缩AI记忆",89);
          var _compResp1 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"你是记忆压缩专家。必须保留所有关键信息。"},{role:"user",content:_compP1}], temperature:0.3, max_tokens:_tok(6000)})});
          if (_compResp1.ok) {
            var _compJ1 = await _compResp1.json();
            var _compC1 = _compJ1.choices&&_compJ1.choices[0]?_compJ1.choices[0].message.content:'';
            var _compP1r = extractJSON(_compC1);
            if (_compP1r && _compP1r.compressed_memory) {
              // 用压缩摘要替换旧记忆，保留最近20条
              GM._aiMemory = [
                { turn: GM.turn, content: '【历史记忆压缩摘要·T1-T'+((_oldMem[_oldMem.length-1]||{}).turn||'?')+'】' + _compP1r.compressed_memory + (_compP1r.key_threads ? '\n【活跃线索】' + _compP1r.key_threads : ''), type: 'compressed', priority: 'critical' }
              ].concat(_keepMem);
              _dbg('[Memory Compress] AI记忆从', _oldMem.length+_keepMem.length, '条压缩为', GM._aiMemory.length, '条');
            }
          }
        }

        // 压缩伏笔
        if (GM._foreshadows && GM._foreshadows.length > _foreCompressThreshold) {
          var _oldFore = GM._foreshadows.slice(0, GM._foreshadows.length - _foreKeepRecent);
          var _keepFore = GM._foreshadows.slice(-_foreKeepRecent);
          var _oldForeText = _oldFore.map(function(f){ return 'T'+(f.turn||'?')+': '+(f.content||f.text||f); }).join('\n');
          var _compP2 = _compressPrompt + '【伏笔条目（共'+_oldFore.length+'条）】\n' + _oldForeText + '\n\n';
          _compP2 += '请判断哪些伏笔已被回收（已实现/已失效），哪些仍然活跃。返回JSON：{"active_foreshadows":"仍然活跃的伏笔汇总('+_compressForeSummaryLen+'字)","resolved":"已回收的伏笔简述(100字)","still_pending_count":数字}';
          _quietLoad("整理伏笔",90);
          var _compResp2 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"你是叙事顾问。判断伏笔是否已被回收。"},{role:"user",content:_compP2}], temperature:0.3, max_tokens:_tok(4000)})});
          if (_compResp2.ok) {
            var _compJ2 = await _compResp2.json();
            var _compC2 = _compJ2.choices&&_compJ2.choices[0]?_compJ2.choices[0].message.content:'';
            var _compP2r = extractJSON(_compC2);
            if (_compP2r && _compP2r.active_foreshadows) {
              GM._foreshadows = [
                { turn: GM.turn, content: '【伏笔压缩摘要】' + _compP2r.active_foreshadows + (_compP2r.resolved ? '\n【已回收】' + _compP2r.resolved : ''), type: 'compressed', priority: 'high' }
              ].concat(_keepFore);
              _dbg('[Foreshadow Compress]', _oldFore.length, '条旧伏笔压缩为摘要');
            }
          }
        }

        // 压缩对话历史
        var _maxConvForCompress = (P.conf && P.conf.convKeep) || ((P.ai.mem || 20) * 2);
        if (GM.conv && GM.conv.length > _convCompressThreshold && GM.conv.length > _maxConvForCompress * 0.7) {
          var _halfConv = Math.floor(GM.conv.length / 2);
          var _oldConv = GM.conv.slice(0, _halfConv);
          var _keepConv = GM.conv.slice(_halfConv);
          var _oldConvText = _oldConv.map(function(c){
            var role = c.role || 'unknown';
            var content = (c.content || '').substring(0, 150);
            return '[' + role + '] ' + content;
          }).join('\n');
          var _compP3 = '以下是早期的对话历史（玩家与AI的交互记录）：\n' + _oldConvText + '\n\n';
          _compP3 += '请压缩为一段摘要，保留：玩家的关键决策、AI给出的重要建议、双方达成的共识、未解决的议题。\n';
          _compP3 += '返回JSON：{"conversation_summary":"对话历史压缩摘要(300-500字)"}';
          _quietLoad("压缩对话",91);
          var _compResp3 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"你是对话压缩专家。"},{role:"user",content:_compP3}], temperature:0.3, max_tokens:_tok(4000)})});
          if (_compResp3.ok) {
            var _compJ3 = await _compResp3.json();
            var _compC3 = _compJ3.choices&&_compJ3.choices[0]?_compJ3.choices[0].message.content:'';
            var _compP3r = extractJSON(_compC3);
            if (_compP3r && _compP3r.conversation_summary) {
              // R103·归档被压缩的老对话原文到 GM._convArchive（存档带走）
              if (!GM._convArchive) GM._convArchive = [];
              Array.prototype.push.apply(GM._convArchive, _oldConv.map(function(c){
                return { role: c.role, content: c.content, _turn: GM.turn, _compressedAt: Date.now() };
              }));
              // 用摘要消息替换旧对话，保留后半段原样
              GM.conv = [
                { role: 'system', content: '【早期对话压缩摘要】' + _compP3r.conversation_summary }
              ].concat(_keepConv);
              _dbg('[Conv Compress]', _oldConv.length, '条旧对话压缩为摘要·原文已归档');
            }
          }
        }
      } catch(_compErr) { _dbg('[Memory Compress] 失败:', _compErr); }

      // 存储叙事摘要供下回合使用
      if (zhengwen && zhengwen.length > 10) {
        if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
        var sentences = zhengwen.split(/[。！？]/).filter(function(s) { return s.trim().length > 5; });
        var lastTwo = sentences.slice(-2).join('。') + '。';
        GM.chronicleAfterwords.push({ turn: GM.turn, summary: lastTwo.substring(0, 200) });
        var chrLimit = (P.conf && P.conf.chronicleKeep) || 10;
        if (GM.chronicleAfterwords.length > chrLimit) {
          // 超限时压缩最老半数为归档条目，不永久丢失
          var _keepN = Math.max(1, chrLimit - 1);
          var _old = GM.chronicleAfterwords.slice(0, GM.chronicleAfterwords.length - _keepN);
          var _keep = GM.chronicleAfterwords.slice(-_keepN);
          var _existChr = (_old[0] && _old[0]._isArchive) ? _old[0] : null;
          var _archChr;
          if (_existChr) {
            _archChr = _existChr;
            var _toM = _old.slice(1);
            _archChr.summary = ('早期叙事摘要·' + (_archChr.summary||'').replace(/^早期叙事摘要·/, '') + '｜' +
              _toM.map(function(c){return 'T'+(c.turn||0)+':'+((c.summary||'').slice(0, 40));}).join('｜')).slice(0, 800);
            _archChr.eventCount = (_archChr.eventCount||1) + _toM.length;
            _archChr.turn = _archChr.firstTurn || _old[0].turn;
            _archChr.lastTurn = Math.max(_archChr.lastTurn||0, (_toM[_toM.length-1]||{}).turn || 0);
          } else {
            _archChr = {
              _isArchive: true,
              turn: _old[0].turn,
              firstTurn: _old[0].turn,
              lastTurn: _old[_old.length-1].turn,
              eventCount: _old.length,
              summary: '早期叙事摘要·' + _old.map(function(c){return 'T'+(c.turn||0)+':'+((c.summary||'').slice(0, 40));}).join('｜').slice(0, 720)
            };
          }
          GM.chronicleAfterwords = [_archChr].concat(_keep);
        }
      }

      // 防止对话历史无限增长：使用玩家配置的对话保留数
      var maxConv = (P.conf && P.conf.convKeep) || ((P.ai.mem || 20) * 2);
      if (GM.conv.length > maxConv) {
        // R103·归档被截断的老对话原文到 GM._convArchive（存档带走）
        if (!GM._convArchive) GM._convArchive = [];
        var _dropping = GM.conv.slice(0, GM.conv.length - maxConv);
        Array.prototype.push.apply(GM._convArchive, _dropping.map(function(c){
          return { role: c.role, content: c.content, _turn: GM.turn, _truncatedAt: Date.now() };
        }));
        GM.conv = GM.conv.slice(-maxConv);
      }

      // 历史检查环节（轻度和严格史实模式）
      //   ★ 核心原则：此检查只"标注"AI 自生的时代错乱（如唐代 shizhengji 中出现"火枪"）
      //   ★ 绝对不触碰玩家诏令引发的任何字面执行（玩家诏"赏银万两"在唐代·按原文记录·不修正）
      //   ★ 只能追加"史官按"注释·不得重写 shizhengji/zhengwen 原文
      if(P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') {
        showLoading("历史检查",85);
        try {
          var _edictText = '';
          try {
            // 收集本回合玩家诏令原文·让历史审查者知道哪些不可动
            var _eVals = [edicts.political, edicts.military, edicts.diplomatic, edicts.economic, edicts.other].filter(Boolean);
            _edictText = _eVals.join('\n · ');
          } catch(_eE) {}

          var histCheckPrompt = "你是历史顾问 AI。剧本背景：" + (sc ? sc.dynasty : "") + "，" + (sc ? sc.emperor : "") + "皇帝时期。\n\n";
          histCheckPrompt += "【不可改的部分·玩家诏令原文】\n · " + (_edictText || '（无明确诏令）') + "\n";
          // 策名豁免名单（玩家亲自策名的人物，含跨时代）
          var _cemingExempt = '';
          try {
            if (window.TM && TM.ceming && typeof TM.ceming.buildHistCheckExemption === 'function') {
              _cemingExempt = TM.ceming.buildHistCheckExemption();
            }
          } catch(_ce) {}
          if (_cemingExempt) histCheckPrompt += _cemingExempt + '\n';
          histCheckPrompt += '【铁律一】玩家诏令字面执行是最高原则。即使诏令本身时代错乱（如唐代用白银、刑部管科举），你绝不得将其改回「历史正确版本」——那是玩家的选择·以混乱/阻力形式体现。与玩家诏令相关的叙事文字原样保留。\n';
          histCheckPrompt += '【铁律二】纯 AI 自生的时代错乱（如 AI 凭空写出 火枪/蒸汽船/拿破仑/共和国/未出生的历史人物 等超时代元素）必须修正。此为你的核心职责。\n';
          histCheckPrompt += '【铁律三】玩家通过策名系统纳入的人物（上方豁免名单·若有）一律视为合法角色·与玩家诏令字面同等保护·任何叙事提及不得改写。\n\n';
          histCheckPrompt += "【检查并修正】下方时政记/正文：\n";
          histCheckPrompt += "时政记：" + shizhengji + "\n";
          histCheckPrompt += "正文：" + zhengwen.substring(0, 500) + "\n\n";
          histCheckPrompt += "返回 JSON：\n";
          histCheckPrompt += '{\n';
          histCheckPrompt += '  "has_ai_hallucination": true/false,\n';
          histCheckPrompt += '  "ai_errors": ["AI 自虚构的错误描述·列举具体错误点"],\n';
          histCheckPrompt += '  "corrected_shizhengji": "修正后的时政记全文·仅替换 AI 自生错误的词句·玩家诏令引起的内容原样保留",\n';
          histCheckPrompt += '  "corrected_zhengwen": "修正后的正文全文·同规则",\n';
          histCheckPrompt += '  "note": "一段 30-60 字的「史官按」注释·文言体·说明 AI 幻觉已被修正"\n';
          histCheckPrompt += '}\n';
          histCheckPrompt += "★ 修正原则：只换 AI 错的词句·不删不增玩家内容·不改叙事框架。\n";
          histCheckPrompt += "★ 若全部是玩家诏令引起（即便荒唐）·返回 has_ai_hallucination:false·其他字段留空。";

          var histResp = await fetch(url,{
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({
              model:P.ai.model||"gpt-4o",
              messages:[{role:"system",content:"你是历史顾问·仅检查 AI 幻觉·不得修改玩家诏令引发的任何字面执行。"},{role:"user",content:histCheckPrompt}],
              temperature:0.2,
              max_tokens:_tok(1500)
            })
          });
          if(!histResp.ok) throw new Error('HTTP ' + histResp.status);
          var histData = await histResp.json();
          var histContent = "";
          if(histData.choices && histData.choices[0] && histData.choices[0].message) {
            histContent = histData.choices[0].message.content;
          }

          try {
            var histJson = extractJSON(histContent);
            if(histJson && histJson.has_ai_hallucination) {
              _dbg('[历史检查] AI 幻觉:', histJson.ai_errors);
              // 替换 AI 自生的错误·玩家诏令引起的内容由 AI 保留
              if (histJson.corrected_shizhengji) shizhengji = histJson.corrected_shizhengji;
              if (histJson.corrected_zhengwen) zhengwen = histJson.corrected_zhengwen;
              // 追加史官按注释
              if (histJson.note) {
                shizhengji = (shizhengji || '') + '\n\n【史官按】' + histJson.note;
              }
              if(histJson.ai_errors && histJson.ai_errors.length > 0) {
                console.warn('[历史检查] AI 幻觉已修正:', histJson.ai_errors.join('; '));
              }
            } else {
              _dbg('[历史检查] 未发现 AI 幻觉');
            }
          } catch(histParseErr) {
            console.warn('[历史检查] 解析结果失败:', histParseErr);
          }
        } catch(histErr) {
          console.warn('[历史检查] 检查失败:', histErr);
        }
      }

      // E13: 逻辑一致性自检（轻量、不调用API）
      (function _logicSelfCheck() {
        var _lcIssues = [];
        // 检查：死人出现在行动中
        var _deadNames = (GM.chars || []).filter(function(c){ return c.alive === false; }).map(function(c){ return c.name; });
        if (p1 && p1.npc_actions && Array.isArray(p1.npc_actions)) {
          p1.npc_actions.forEach(function(a) {
            var actor = a.actor || a.name || '';
            if (_deadNames.indexOf(actor) >= 0) {
              _lcIssues.push('已故人物"' + actor + '"仍在执行行动，已移除');
            }
          });
          // 移除死人行动
          p1.npc_actions = p1.npc_actions.filter(function(a) {
            return _deadNames.indexOf(a.actor || a.name || '') < 0;
          });
        }
        // 检查：已故人物的属性变化
        if (p1 && p1.char_updates && Array.isArray(p1.char_updates)) {
          p1.char_updates = p1.char_updates.filter(function(u) {
            if (_deadNames.indexOf(u.name || '') >= 0) {
              _lcIssues.push('已故人物"' + (u.name||'') + '"的属性更新已忽略');
              return false;
            }
            return true;
          });
        }
        if (_lcIssues.length > 0) {
          _dbg('[E13 逻辑自检] 修正' + _lcIssues.length + '项：', _lcIssues);
        }
      })();

      showLoading("\u89E3\u6790",90);

      // 3.3: Sub-call管线计时汇总
      if (GM._subcallTimings && Object.keys(GM._subcallTimings).length > 0) {
        var _timingParts = [];
        Object.keys(GM._subcallTimings).forEach(function(k) {
          var _meta = _subcallMeta.filter(function(m){return m.id===k;})[0];
          _timingParts.push((_meta ? _meta.name : k) + ':' + (GM._subcallTimings[k]/1000).toFixed(1) + 's');
        });
        _dbg('[3.3 Pipeline] ' + _timingParts.join(' | '));
      }

      // Start queued next-turn memory/snapshot jobs only after foreground cleanup
      // has finished, so compression cannot overwrite their late writes.
      try { _flushQueuedPostTurnSubcalls(); } catch(_qptE) { _dbg('[PostTurn] queued subcall launch failed:', _qptE); }

      // S2：启动 post-turn 异步任务（L2_AI/L3_CONDENSE/REFLECT/factionArcs）
      //   不 await·让玩家看结果时后台运行·下回合开始前 _awaitPostTurnJobs 会等齐
      try { if (typeof _launchPostTurnJobs === 'function') _launchPostTurnJobs(); } catch(_ptE) { _dbg('[PostTurn] launch failed:', _ptE); }
    }
    catch(err){shizhengji="\u5931\u8D25:"+err.message;zhengwen="\u9519\u8BEF";}
  }else{
    Object.keys(GM.vars).forEach(function(n){GM.vars[n].value=clamp(GM.vars[n].value+Math.floor(random()*7)-3,GM.vars[n].min,GM.vars[n].max);});
    shizhengji="\u56FD\u5BB6\u53D8\u5316\u4E2D";zhengwen="\u65F6\u5149\u6D41\u901D";playerStatus="\u5982\u5E38";
  }
  // 存储本回合 AI 叙事摘要供 NPC 引擎使用（避免重复 API 调用）
  GM._turnContext = {
    edicts: edicts,
    shizhengji: (shizhengji || '').substring(0, 300),
    zhengwen: (zhengwen || '').substring(0, 200),
    npcActionsThisTurn: (p1 && p1.npc_actions) ? p1.npc_actions.map(function(a) { return a.name; }) : []
  };

  // AI失败兜底——确保玩家至少看到时间推进的信息
  if (!shizhengji) {
    var _tsF = typeof getTSText === 'function' ? getTSText(GM.turn) : '本期';
    shizhengji = _tsF + '，天下暂无大事。（AI推演未返回有效数据）';
  }
  if (!zhengwen) zhengwen = '时移事去，朝堂内外一切如故。';

  // 清洗·剥除 HTML 残片/onclick/event 引号序列/markdown 链接·防 AI 污染
  function _stripHtmlResidue(s) {
    if (!s || typeof s !== 'string') return s;
    // 1. 剥除 HTML 标签 <tag>...</tag> 或 <tag />
    s = s.replace(/<[^>]+>/g, '');
    // 2. 剥除 onclick/onmouseover 等事件属性残片·如 `', event)">`  `, event)>` 等
    s = s.replace(/['"]?\s*,?\s*event\s*\)['"]?\s*>?/g, '');
    s = s.replace(/onclick\s*=\s*['"][^'"]*['"]/g, '');
    // 3. 剥除 markdown 链接 [text](url)·保留 text
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // 4. 剥除可疑 JS 协议
    s = s.replace(/javascript:[^\s,·]*/g, '');
    // 5. 规范化多余空白
    s = s.replace(/\s+,/g, '，').replace(/\s*>+\s*/g, '').replace(/\s{3,}/g, ' ');
    return s;
  }
  shizhengji = _stripHtmlResidue(shizhengji);
  zhengwen = _stripHtmlResidue(zhengwen);
  if (shiluText) shiluText = _stripHtmlResidue(shiluText);
  if (hourenXishuo) hourenXishuo = _stripHtmlResidue(hourenXishuo);

  return {
    shizhengji:shizhengji, zhengwen:zhengwen,
    playerStatus:playerStatus, playerInner:playerInner,
    turnSummary:turnSummary, timeRatio:timeRatio,
    suggestions:(p2&&p2.suggestions)||[],
    // 新增字段：实录/时政记标题/总结/人事/后人戏说
    shiluText:shiluText, szjTitle:szjTitle, szjSummary:szjSummary,
    personnelChanges:personnelChanges, hourenXishuo:hourenXishuo
  };
}

// ══════ §E 系统更新已迁移到 tm-endturn-systems.js (R95) ══════
// - _endTurn_updateSystems(timeRatio, zhengwen)
// ═══════════════════════════════════════════════════════

/** Step 4: 渲染 + 存档 — UI 更新、史记显示、自动存档 */
// ============================================================
//  endTurn() — 主调度器，按阶段调用子函数
// ============================================================
/** 主回合推演入口（玩家点击"静待时变"触发） */
// ══════ 朝会追踪+post-turn 决策已迁移到 tm-court-meter.js (R96) ══════
// - recordCourtHeld / _settleCourtMeter
// - _showPostTurnCourtPromptAndStartEndTurn / _postTurnCourtChoose
// - _showPostTurnCourtBanner / _updatePostTurnCourtBanner / _hidePostTurnCourtBanner
// - _onPostTurnCourtEnd (async)
// ═══════════════════════════════════════════════════════
