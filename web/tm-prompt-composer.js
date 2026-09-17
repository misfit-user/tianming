// ============================================================
// Module: tm-prompt-composer.js
// Domain: AI runtime / sysP 片段复用
// Owns:
//   - 中央化 sysP 通用段 builder·8 builders
//   - buildBase (朝代/剧本/角色/难度/文风)
//   - buildPersonaExtra (sc.persona)
//   - buildBookExtra (剧本书)
//   - buildNarrativeGuide (叙事指引)
//   - buildChronicleStyle (编年体风格)
//   - buildTemporalGranularity (时空粒度)
//   - buildAiPersonaText (NPC 内省·v6 配 batchPersonaMaxLen 截断)
//   - buildRecognitionState (NPC 识别状态)
//   - buildSystemPrefix
//   - buildCommon (汇总入口)
//   - getBatchPersonaMaxLen(sc) reads sc.modelRequirements.batchPersonaMaxLen
// Does not own:
//   - LLM 调度 (tm-ai-infra.js)
//   - prompt 内业务逻辑 (specialty subcalls 各自定义)
//   - sysP 内 schema (各 subcall 仍可加 specialty 段)
// Public API:
//   - TM.PromptComposer.buildBase(ctx)
//   - TM.PromptComposer.buildAiPersonaText(char, options)
//   - TM.PromptComposer.* (全 8 builders + buildCommon)
//   - TM.PromptComposer.getBatchPersonaMaxLen(sc)
// Depends on:
//   - global TM (namespace)
//   - none·pure builder (no DOM·no LLM call)
// Used by:
//   - tm-wendui.js (_wdBuildPrompt)
//   - tm-chaoyi-changchao.js (_cc3_buildSystemPromptStable / buildNpcPrompt·rename Phase 3)
//   - tm-endturn-ai-infer.js (sysP base + systemPrefix + narrative/temporal/chronicle)
//   - tm-tinyi-v3.js (sc18 / NPC decision / char arcs / endturn middle style)
// Tests:
//   - syntax-check (verify-all)
//   - cc3-smoke (covers chaoyi 调用)
// Refactor notes:
//   - Phase 6 系统翻新 我做·v0-v7 evolve
//   - Phase 1·active 唯一 prompt 复用入口·不再新建 prompt builder
//   - Phase 3·考虑增 buildEndturnSystem / buildBattleResolve 等 specialty composer
//   - 见 Desktop/剧本/notes/prompt-composer-v0-spec.md
// ============================================================

(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};


  // historical-agency-v21: read the active scenario; never mirror policy into another state object.
  function agencyScenario(sc) {
    if (sc && typeof sc === 'object') return sc;
    var G = global.GM || {}, P = global.P || {}, found = null;
    if (G.sid && typeof global.findScenarioById === 'function') found = global.findScenarioById(G.sid);
    if (found) return found;
    if (P.scenario && (!G.sid || P.scenario.id === G.sid)) return P.scenario;
    return { worldSettings: P.worldSettings || {} };
  }
  function agencyOn(sc) { var s = agencyScenario(sc); return !!(s.worldSettings && s.worldSettings.historicalOutcomePolicy === 'player-driven'); }
  function agencyText(sc) {
    if (!agencyOn(sc)) return '';
    return '\n【本局历史与选择】以本局已经发生的事实和人物册为准。史料用于此前经历、制度与物质条件，不是开局之后必须兑现的命令。未来年号、任免、和战、宗教政策、灾变和政权兴亡由玩家及各方行动发展，不为贴合原史强制触发、补演或回退。玩家自定年号与合乎当下条件的不同选择不因偏离原史而受惩罚。当前剧本已配置的人物（包括虚构人物）仍存在；新入局史实人物须在当前年份已出生且在世，不从未来或往昔召来。不得预写未来履历，人物只知本人当时可得消息。\n';
  }
  function agencyMode(mode, sc) {
    if (!agencyOn(sc)) return '';
    var style = mode === 'strict_hist' ? '考据严谨、行文克制，依既往史料与当下制度推演。' : mode === 'light_hist' ? '史据为本，允许合理细节演绎。' : '叙事可富有戏剧性，人物与生活仍处在当前时代。';
    return style + '后续历史不预定，年号与施政由玩家决定。新人物限当前已出生且在世者。';
  }
  function agencyAdvisor(sc) {
    return '你是本局的历史与现实条件顾问。只评估玩家措施在当前制度、资源、人物关系中是否可行，以及可能而非必然的反应。不同于原史的年号、任免、和战或改革本身不是错误；不得为了回归原史制造惩罚或强制事件。可用已发生的真实先例说明条件差别，不把后来史事当预言。不改写玩家决定；若无额外现实障碍，deviations返回空数组。后果必须指出本局实际存在的主体与原因，拿不准不编造。' + agencyText(sc);
  }
  function agencyNumber(value) { if (value == null || value === '') return null; var n=Number(value); return isFinite(n)?n:null; }
  function agencyProfile(name) {
    var profiles=global.HISTORICAL_CHAR_PROFILES || {}, keys=Object.keys(profiles);
    for(var i=0;i<keys.length;i++){var p=profiles[keys[i]];if(p && (p.name===name || p.displayName===name || (Array.isArray(p.aliases)&&p.aliases.indexOf(name)>=0)))return p;}
    return null;
  }
  function agencyEligibility(profile, opts) {
    opts=opts||{};profile=profile||{}; if(!agencyOn(opts.scenario))return {ok:true};
    var G=global.GM||{}, P=global.P||{}, year=agencyNumber(opts.year);
    if(year==null)year=agencyNumber(G.year);if(year==null)year=agencyNumber(P.time&&P.time.year);
    if(year==null)return {ok:false,reason:'当前年份尚未确定'};
    var known=agencyProfile(profile.name), b=agencyNumber(known&&known.birthYear), d=agencyNumber(known&&known.deathYear);
    if(b==null)b=agencyNumber(profile.birthYear);if(d==null)d=agencyNumber(profile.deathYear);
    var roster=(G.chars||[]).concat(G.allCharacters||[]), current=null;
    for(var i=0;i<roster.length;i++){if(roster[i]&&roster[i].name===profile.name){current=roster[i];break;}}
    if(current&&(current.alive===false||current.dead))return {ok:false,reason:'此人本局已经去世'};
    if(b!=null&&b>year)return {ok:false,reason:'此人当前尚未出生'};
    var aliveHere=!!(current&&current.alive===true);
    if(d!=null&&d<year&&!aliveHere)return {ok:false,reason:'此人不在当前年代在世'};
    if(b==null&&!aliveHere)return {ok:false,reason:'缺少可确认的出生年份'};
    var age=b==null?agencyNumber(current&&current.age):year-b;
    if(opts.minAge!=null&&(age==null||age<opts.minAge))return {ok:false,reason:'未达参与年龄'};
    if(opts.maxAge!=null&&(age==null||age>opts.maxAge))return {ok:false,reason:'已超参与年龄'};
    return {ok:true,age:age};
  }
  TM.HistoricalAgency={getScenario:agencyScenario,isPlayerDriven:agencyOn,promptText:agencyText,modeDescription:agencyMode,advisorInstruction:agencyAdvisor,temporalEligibility:agencyEligibility,findProfile:agencyProfile};

  function _str(v) { return v == null ? '' : String(v); }
  function _arr(v) { return Array.isArray(v) ? v.slice() : (v ? [v] : []); }
  function _num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function _pct(v) {
    var n = _num(v);
    if (Math.abs(n) <= 1) n *= 100;
    return Math.max(0, Math.min(100, Math.round(n)));
  }
  function _roleLabel(role) {
    role = _str(role).toLowerCase();
    if (role === 'patron') return '庇护';
    if (role === 'broker') return '调停';
    if (role === 'suppressor') return '压制';
    if (role === 'symbol') return '象征';
    if (role === 'debtor') return '亏欠';
    if (role === 'enemy') return '仇怨';
    return '代表';
  }

  /**
   * Base sysP·朝代 + 剧本 + 角色 + 难度 + 文风 + gameMode + historicalLimit
   * 多数 specialty subcall 都需要这段
   */
  function buildBase(ctx) {
    ctx = ctx || {};
    var sc = ctx.sc || {};
    var P = ctx.P || {};
    if (P.ai && P.ai.prompt) return P.ai.prompt + agencyText(sc);
    var s = '你是历史模拟AI。剧本:' + _str(sc.name) +
            '时代:' + _str(sc.era) +
            '角色:' + _str(sc.role) +
            '\n难度:' + ({narrative:'叙事',standard:'标准',hardcore:'硬核'}[P.conf && P.conf.difficulty] || _str(P.conf && P.conf.difficulty)) +
            '文风:' + _str(P.conf && P.conf.style);
    if (ctx.gameModeDesc) s += ctx.gameModeDesc;
    if (ctx.historicalCharLimit) s += ctx.historicalCharLimit;
    s += agencyText(sc);
    return s;
  }

  /**
   * 玩家附注·P.conf.aiPersona / P.conf.systemPrompt
   * cc3 / 多数 NPC subcall 需要这段
   */
  function buildPersonaExtra(P) {
    P = P || {};
    var v = (P.conf && (P.conf.aiPersona || P.conf.systemPrompt)) || '';
    return v ? '【陛下附注】' + v + '\n' : '';
  }

  /**
   * 剧本本朝特设·sc.chaoyi.systemPromptExtra (剧本可加自定义本朝规约)
   * cc3 (chaoyi) 用·其他 specialty 也可复用
   */
  function buildBookExtra(sc) {
    sc = sc || {};
    var v = sc.chaoyi && sc.chaoyi.systemPromptExtra;
    return v ? '【本朝特设】' + v + '\n' : '';
  }

  /**
   * 叙事风格·按 modeParams.narrativeStyle 选 资治通鉴/半文言/演义
   * + chronicleConfig.styleSample (剧本风格范文)
   * 主 endturn / 多数 specialty 需要
   */
  function buildNarrativeGuide(modeParams, chronicleConfig) {
    modeParams = modeParams || {};
    var s = '';
    var ns = modeParams.narrativeStyle || '半文言';  // default to the half-classical tier (not the weakest vernacular) when a scenario sets no style
    if (ns.indexOf('资治通鉴') >= 0) {
      s = '\n【叙事风格·严格文言】仿《资治通鉴》体例。用词典雅·句式简洁。禁用一切现代词汇 (如·OK / 搞定 / 给力)。对话用"曰""言""谓"引述。';
    } else if (ns.indexOf('半文言') >= 0) {
      s = '\n【叙事风格·半文言】融合文言与白话。叙事用文言·对话可用浅显白话。禁用网络用语和明显现代词汇。';
    } else {
      s = '\n【叙事风格·演义体】仿《三国演义》章回体风格。叙事可白话·但保留古典韵味。禁用网络用语。';
    }
    if (chronicleConfig && chronicleConfig.styleSample) {
      s += '\n【风格范文 (参照此文风)】' + chronicleConfig.styleSample;
    }
    return s;
  }

  /**
   * 编年史笔法·biannian/shilu/jizhuan/jishi/biji/custom
   * 主 endturn / specialty 都可复用
   */
  function buildChronicleStyle(chronicleConfig) {
    if (!chronicleConfig || !chronicleConfig.style) return '';
    var styleNames = {
      biannian: '编年体 (仿《资治通鉴》)',
      shilu: '实录体 (仿各朝实录)',
      jizhuan: '纪传体 (仿《史记》)',
      jishi: '纪事本末体 (仿《通鉴纪事本末》)',
      biji: '笔记体 (仿《世说新语》)',
      custom: chronicleConfig.customStyleDesc || '自定义'
    };
    return '\n叙事笔法：' + (styleNames[chronicleConfig.style] || chronicleConfig.style);
  }

  /**
   * 时间粒度·dpv 决定 micro/meso/macro
   * 主 endturn 用·specialty 一般不需 (回合内 subcall 已知粒度)
   */
  function buildTemporalGranularity(dpv) {
    if (dpv === undefined || dpv === null) return '';
    var granLabel = dpv <= 7 ? '微观（日/周）' : dpv <= 60 ? '中观（月）' : '宏观（季/年）';
    var s = '\n\n【时间粒度·每回合' + dpv + '天 (' + granLabel + '叙事)】';
    if (dpv <= 7) {
      s += '\n叙事如"起居注"——精确到日';
      s += '\nNPC 行动描述微观·变量变化幅度小（每回合 ±1~3 为正常）';
    } else if (dpv <= 60) {
      s += '\n叙事如"月报"';
      s += '\nNPC 行动描述中观·概括一段时间内的行为趋势';
    } else {
      s += '\n叙事如"编年史"';
      s += '\nNPC 行动描述宏观·变量变化可较大';
    }
    return s;
  }

  function buildClassCharacterContext(char, options) {
    options = options || {};
    if (!char) return '';
    var lines = [];
    var support = _str(char.classSupportSummary || '').trim();
    var opposition = _str(char.classOppositionSummary || '').trim();
    var edges = _arr(char.classBackings || (char._classCharacterEffect && char._classCharacterEffect.backingClasses))
      .concat(_arr(char._classCharacterEffect && char._classCharacterEffect.opposingClasses));
    if (char.socialCapital != null || char.classPoliticalCapital != null) {
      lines.push('  - 社会资本：' + _pct(char.socialCapital != null ? char.socialCapital : char.classPoliticalCapital));
    }
    if (char.classPressure != null) lines.push('  - 阶层压力：' + _pct(char.classPressure));
    if (support) lines.push('  - 阶层背书：' + support);
    if (opposition) lines.push('  - 阶层怨望：' + opposition);
    edges.slice(0, 5).forEach(function(edge) {
      if (!edge || !edge.className) return;
      var evidence = _arr(edge.evidence).map(function(x) { return _str(x).trim(); }).filter(Boolean).join('/');
      var row = '  - ' + edge.className + '：' + _roleLabel(edge.role) + '，信任' + _pct(edge.trust) + '，怨望' + _pct(edge.grievance);
      if (evidence) row += '，近因：' + evidence;
      lines.push(row);
    });
    if (!lines.length) return '';
    var text = '【阶层政治关系·' + (char.name || char.id || '') + '】\n' + lines.join('\n');
    var maxLen = Number(options.classContextMaxLen) || 420;
    if (maxLen > 0 && text.length > maxLen) text = text.slice(0, maxLen) + '...(截断)';
    return text;
  }

  /**
   * NPC.aiPersonaText 注入·specialty NPC subcall (cc3/sc18) 用。
   * 同时补入阶层政治关系，让 NPC 决策能感知背书、怨望与社会压力。
   */
function buildAiPersonaText(char, options) {
    options = options || {};
    if (!char) return '';
    var text = char.aiPersonaText ? _str(char.aiPersonaText) : '';
    var maxLen = Number(options.maxLen) || 0;
    if (maxLen > 0 && text.length > maxLen) {
      text = text.slice(0, maxLen) + '...(截断)';
    }
    var classContext = buildClassCharacterContext(char, options);
    var parts = [text, classContext].filter(function(x) { return !!x; });
    if (!parts.length) return '';
    return '\n【NPC 内省·' + (char.name || '') + '】\n' + parts.join('\n') + '\n';
  }

  function getBatchPersonaMaxLen(sc, fallback) {
    var n = fallback == null ? 200 : Number(fallback);
    if (!isFinite(n) || n < 0) n = 200;
    var req = sc && sc.modelRequirements;
    var v = req && Number(req.batchPersonaMaxLen);
    return isFinite(v) && v >= 0 ? v : n;
  }

  /**
   * recognitionState 注入·phase 6 NPC 识别状态
   * char.recognitionState = { subject, familiarity, level, lastTurn, lastEvent, lastEmotion, lastType, lastSource, lastWho, summary, history[] }
   * specialty NPC subcall (cc3/sc18) 按需注入
   */
  function buildRecognitionState(char) {
    if (!char || !char.recognitionState) return '';
    var rs = char.recognitionState;
    var s = '\n【NPC 识别状态·' + (char.name || rs.subject || '') + '】';
    if (rs.level) s += '\n  · 熟识等级·' + rs.level + (rs.familiarity != null ? ' (' + rs.familiarity + ')' : '');
    if (rs.lastTurn) s += '\n  · 上次见·T' + rs.lastTurn + (rs.lastEvent ? '·因' + rs.lastEvent : '');
    if (rs.lastEmotion) s += '\n  · 上次情感·' + rs.lastEmotion;
    if (rs.lastWho) s += '\n  · 上次互动者·' + rs.lastWho;
    if (rs.summary) s += '\n  · 关系摘要·' + rs.summary;
    return s;
  }

  /**
   * promptOverrides.systemPrefix·前置 override
   * 主 endturn / specialty 都可前置·返回字符串供 caller prepend
   */
  function buildSystemPrefix(P) {
    if (!P || !P.promptOverrides || !P.promptOverrides.systemPrefix) return '';
    return P.promptOverrides.systemPrefix;
  }

  /**
   * 一站式·主 endturn 不用 (因有 15+ specialty 段)·specialty subcall 用
   * 组合·base + persona + book + narrativeGuide + chronicleStyle (按需)
   * 不含·temporal granularity / specialty (NPC decisions / char arcs / etc)
   */
  function buildCommon(ctx) {
    ctx = ctx || {};
    var sc = ctx.sc || {};
    var P = ctx.P || {};
    var parts = [];

    var prefix = buildSystemPrefix(P);
    var base = buildBase(ctx);
    if (prefix) {
      parts.push(prefix);
      parts.push(base);
    } else {
      parts.push(base);
    }

    var book = buildBookExtra(sc);
    if (book) parts.push(book);

    var persona = buildPersonaExtra(P);
    if (persona) parts.push(persona);

    var ng = buildNarrativeGuide(ctx.modeParams, P.chronicleConfig);
    if (ng) parts.push(ng);

    var cs = buildChronicleStyle(P.chronicleConfig);
    if (cs) parts.push(cs);

    return parts.filter(function(p) { return p; }).join('\n');
  }

  /**
   * Phase 7·Wall-clock 优化·共享 prompt prefix (角色名单·近期史记·时代信息)
   * 19 子调用都需要的"客观参考"·抽到 sysP 末尾·走 cache·prompt 删重复段
   */
  function buildSharedPromptPrefix(GMRef, opts) {
    opts = opts || {};
    if (!GMRef) return '';
    var parts = [];
    // 在世角色名单 (sc1/sc1b/sc1c/sc15/sc15n/sc27 都要)·~250 字限
    try {
      var chars = (GMRef.chars || []).filter(function(c){ return c && c.alive !== false; }).slice(0, 30);
      if (chars.length) {
        parts.push('【在世角色】' + chars.map(function(c){
          return c.name + (c.officialTitle ? '·' + c.officialTitle : '');
        }).join('、'));
      }
    } catch(_){}
    // 时代信息 (sc1/sc1d/sc2/sc27 都要)
    try {
      if (GMRef.turn) parts.push('【本回合】T' + GMRef.turn);
    } catch(_){}
    // 主要势力快照 (sc1c/sc15/sc16/sc28 都要)
    try {
      var facs = (GMRef.facs || []).filter(function(f){ return f && !f.player; }).slice(0, 10);
      if (facs.length) {
        parts.push('【非玩家势力】' + facs.map(function(f){ return f.name + '(兵' + (f.militaryStrength||0) + ')'; }).join('、'));
      }
    } catch(_){}
    return parts.length ? '\n\n=== 客观参考 (共享·全管线 cache 命中) ===\n' + parts.join('\n') + '\n=== 参考结束 ===' : '';
  }

  /**
   * Phase 2 Slice 1·硬约束块 (静态部分)·全管线共享·放 sysP 走 cache
   * 不含·死亡名单/诈死名单 (每回合变·留 user prompt)·见 tm-endturn-ai.js _hardConstraints 动态段
   * 适用·sc1/sc1b/sc1c/sc1d/sc15/sc16/sc17/sc18/sc2/sc27 等所有 endturn 子调用
   */
  function buildHardConstraints() {
    return '\n═══【全管线硬约束·违反将被校验器标记并自动补录·影响 AI 评级】═══\n'
      + '① 金额一致性：shilu_text/shizhengji/events 中出现的任何"拨/赐/赈/征/抄/缴/赔/贡 N两/石/匹"等具体金额动作，必须在 fiscal_adjustments 中有对应条目（target/kind/resource/amount 一一对应）。缺失将被自动校验器补录标记。\n'
      + '② 死亡禁动：本回合 user prompt 中列出的"已死"角色不得有任何行动/对话/奏折/任命（出现在 personnel_changes / npc_actions / char_updates 等字段均为违规）。\n'
      + '③ 死亡→墓志铭：若本回合新增 character_deaths·必须在 reason 中写清死因(病/诛/战/自尽/意外/诈死)·type:fake则系统会走holding不归档。\n'
      + '④ 数据与叙事不得互悖：宁可不写不可写而不改。所有"实际变化"必须落到对应结构化字段。\n'
      + '⑤ 忠诚语义：每个角色的 loyalty 是"对自己所属势力/首领"的忠诚，不是"对玩家"的忠诚。皇太极忠于后金·不忠于明廷皇帝；岳飞忠于宋廷·不忠于金国皇帝。敌对势力角色 loyalty 再高也不会为玩家效力。\n'
      + '⑥ 角色归属铁律：c.faction 决定角色阵营——非玩家势力角色（敌对/附属/外邦）不得作为本朝官员任命（如不能让皇太极当明朝主考官/宰相/将军）。只有投降/归顺（先改 faction·再任命）才能跨势力任官。任命 office_assignments/任命类 changes 必须先检查 faction 与玩家同·否则视为荒唐诏令按字面执行+剧烈混乱+皇威暴跌。\n'
      + '═════════════════════════════════════════════\n';
  }

  TM.PromptComposer = {
    buildBase: buildBase,
    buildPersonaExtra: buildPersonaExtra,
    buildBookExtra: buildBookExtra,
    buildNarrativeGuide: buildNarrativeGuide,
    buildChronicleStyle: buildChronicleStyle,
    buildTemporalGranularity: buildTemporalGranularity,
    buildAiPersonaText: buildAiPersonaText,
    getBatchPersonaMaxLen: getBatchPersonaMaxLen,
    buildRecognitionState: buildRecognitionState,
    buildSystemPrefix: buildSystemPrefix,
    buildCommon: buildCommon,
    buildHardConstraints: buildHardConstraints,
    buildSharedPromptPrefix: buildSharedPromptPrefix,
    _version: 'v9'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.PromptComposer;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
