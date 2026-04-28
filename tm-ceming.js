// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// tm-ceming.js — 策名系统·人物志补全工具
//
// 性质：玩家工具（非世界系统）
//   · 零代价·即时生效·不挂银两/民心/皇威/天命
//   · 唯一约束：模式断代闸门 + AI 检索黑名单
//   · 与现有 edictRecruitCharacter（征召为官·有政治代价）严格区分
//
// 章节：
//   §1 [L?]  闸门 canSummon — 模式断代判定（演义/轻度/严格）
//   §2 [L?]  库内策名 summonByProfile
//   §3 [L?]  库外 AI 检索·两步流程
//        §3a aiSearchCard — 第一步·身份卡查询（轻量）
//        §3b summonByCard — 第二步·完整属性生成（重量）
//   §4 [L?]  黑名单管理（疑非真人）
//   §5 [L?]  历史检查豁免名单生成器（供 endturn-ai-infer 调用）
//   §6 [L?]  UI: openDialog / 〔敕召贤良〕双 tab 对话框
//
// 依赖：
//   - HISTORICAL_CHAR_PROFILES（tm-char-historical-profiles.js）
//   - createCharFromProfile（同上）
//   - findCharByName（tm-utils.js）
//   - aiGenerateCompleteCharacter（tm-char-autogen.js）
//   - P / GM / toast / showLoading / hideLoading 全局
//
// 加载顺序：tm-char-historical-profiles + tm-char-autogen 之后
// ═══════════════════════════════════════════════════════════════

(function(global){
  'use strict';

  global.TM = global.TM || {};
  TM.ceming = TM.ceming || {};

  // ─────────────────────────────────────────────────────────
  // §1 闸门 canSummon — 模式断代判定
  // ─────────────────────────────────────────────────────────

  /**
   * 判定一个历史人物档案是否可在当前游戏状态下策名
   * @param {Object} profile - 历史人物档案（含 birthYear/deathYear）
   * @returns {{ok: boolean, reason: string, mode?: string}}
   */
  TM.ceming.canSummon = function(profile) {
    if (!profile) return { ok: false, reason: '档案无效' };

    var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
    var curYear = (typeof GM !== 'undefined' && GM.year) ||
                  (typeof P !== 'undefined' && P.time && P.time.year) || 0;
    var b = profile.birthYear || profile.eraStartYear || null;
    var d = profile.deathYear || profile.eraEndYear || null;

    // 演义模式：放行所有·跨时空允许
    if (mode === 'yanyi') {
      return { ok: true, reason: '演义模式·跨时空可召', mode: mode };
    }

    // 缺生卒年·非演义模式禁止（无法判定时代）
    if (!b && !d) {
      return { ok: false, reason: '档案缺生卒年·无法判定时代·切换演义模式可强行策名', mode: mode };
    }

    // 轻度史实：±N 年弹性窗口（默认 50 年·编辑器可配 P.conf.cemingEraTolerance）
    if (mode === 'light_hist') {
      var tol = (typeof P !== 'undefined' && P.conf && P.conf.cemingEraTolerance) || 50;
      if (b && curYear < b - tol) {
        return { ok: false, reason: '此人尚未出世（生于 ' + b + '·容差 ±' + tol + ' 年）', mode: mode };
      }
      if (d && curYear > d + tol) {
        return { ok: false, reason: '此人已归道山（卒于 ' + d + '·容差 ±' + tol + ' 年）', mode: mode };
      }
      return { ok: true, mode: mode };
    }

    // 严格史实：当世人物（生卒之间）
    if (mode === 'strict_hist') {
      if (b && curYear < b) {
        return { ok: false, reason: '此人尚未出世（生于 ' + b + '）', mode: mode };
      }
      if (d && curYear > d) {
        return { ok: false, reason: '此人已归道山（卒于 ' + d + '）', mode: mode };
      }
      return { ok: true, mode: mode };
    }

    return { ok: false, reason: '未知游戏模式 ' + mode, mode: mode };
  };

  // ─────────────────────────────────────────────────────────
  // §2 库内策名 summonByProfile
  // ─────────────────────────────────────────────────────────

  /**
   * 用库内 profileId 策名一位历史人物
   * @param {string} profileId
   * @returns {Promise<{existed: boolean, char: Object}>}
   */
  TM.ceming.summonByProfile = async function(profileId) {
    var profiles = (typeof global.HISTORICAL_CHAR_PROFILES === 'object') ? global.HISTORICAL_CHAR_PROFILES : null;
    if (!profiles) throw new Error('档案库未加载');
    var profile = profiles[profileId];
    if (!profile) throw new Error('档案库无此条目: ' + profileId);

    // 闸门判定
    var check = TM.ceming.canSummon(profile);
    if (!check.ok) throw new Error('断代不容: ' + check.reason);

    // 同名去重·已在册则直接返回
    if (typeof findCharByName === 'function') {
      var existing = findCharByName(profile.name);
      if (existing) return { existed: true, char: existing };
    }

    // 计算时空状态：跨时空(演义模式·非当世)走 AI 重写·让 bio 带困惑语气；当世走本地秒返
    var curYear = (typeof GM !== 'undefined' && GM.year) || 0;
    var timelineStatus = 'alive';
    if (profile.birthYear != null && profile.deathYear != null && curYear) {
      if (curYear < profile.birthYear) timelineStatus = 'future_visitor';
      else if (curYear > profile.deathYear) timelineStatus = 'past_visitor';
    }
    var isCrossTime = (timelineStatus !== 'alive');

    if (isCrossTime && typeof global.aiGenerateCompleteCharacter === 'function' &&
        typeof P !== 'undefined' && P.ai && P.ai.key) {
      // 跨时空走 AI 重写·档案当 sourceContext·按时空困惑指令重生成 bio/personality/mood
      var sc = '【档案库参考·原历史身份】\n' +
        '姓名：' + profile.name + (profile.zi ? '·字 ' + profile.zi : '') + '\n' +
        '朝代：' + (profile.dynasty || '') + (profile.era ? '·' + profile.era : '') + '\n' +
        '生卒：' + profile.birthYear + '-' + profile.deathYear + '\n' +
        '官至：' + (profile.officialTitle || profile.title || '') + '\n' +
        '类型：' + (profile.role || '') + '\n' +
        '原历史背景：' + (profile.background || '') + '\n' +
        (profile.famousQuote ? '代表言论：' + profile.famousQuote + '\n' : '') +
        (profile.historicalFate ? '原历史结局：' + profile.historicalFate + '\n' : '');
      var scnStart = (typeof P !== 'undefined' && P.scenario && P.scenario.startYear) ||
                     (typeof P !== 'undefined' && P.time && P.time.startYear) || curYear;
      var newChar = await global.aiGenerateCompleteCharacter(profile.name, {
        reason: '玩家策名·跨时空',
        sourceContext: sc,
        isHistoricalHint: true,
        birthYear: profile.birthYear,
        deathYear: profile.deathYear,
        scenarioStartYear: scnStart,
        historicalFactionHint: profile.historicalFaction || '',
        tier: 'secondary'
      });
      if (newChar) {
        newChar.source = 'ceming';
        newChar.cemingByPlayer = true;
        newChar.cemingTurn = (typeof GM !== 'undefined' && GM.turn) || 1;
        newChar.cemingMode = check.mode || 'yanyi';
        newChar.alternateNames = profile.alternateNames ? profile.alternateNames.slice() : (newChar.alternateNames || []);
        newChar._fromProfile = profileId;
      }
      return { existed: false, char: newChar };
    }

    // 当世·走本地 createCharFromProfile + 加策名标记（秒返·零 API）
    if (typeof global.createCharFromProfile !== 'function') {
      throw new Error('createCharFromProfile 不可用');
    }
    var ch = global.createCharFromProfile(profileId);
    if (!ch) throw new Error('创建失败');

    ch.source = 'ceming';
    ch.cemingTurn = (typeof GM !== 'undefined' && GM.turn) || 1;
    ch.cemingByPlayer = true;
    ch.cemingMode = check.mode || 'yanyi';
    ch.birthYear = profile.birthYear || ch.birthYear;
    ch.deathYear = profile.deathYear || ch.deathYear;
    ch.alternateNames = profile.alternateNames ? profile.alternateNames.slice() : [];
    ch.alive = true;
    // 当世人物·标 timelineStatus=alive·让推演/对话 AI 知道
    ch.timelineStatus = 'alive';
    ch.originTime = (profile.birthYear && profile.deathYear) ? { birth: profile.birthYear, death: profile.deathYear } : null;
    ch.timelineMood = 'normal';
    ch.displacement = false;
    ch.knowledgeReliability = 'verified';

    if (typeof GM !== 'undefined') {
      if (!GM.chars) GM.chars = [];
      GM.chars.push(ch);
    }

    return { existed: false, char: ch };
  };

  // ─────────────────────────────────────────────────────────
  // §3 库外 AI 检索·两步流程
  // ─────────────────────────────────────────────────────────

  /**
   * §3a 第一步：AI 检索身份卡（轻量·让玩家确认 AI 没张冠李戴）
   * @param {string} name
   * @returns {Promise<{ok: boolean, card?: Object, reason?: string, message?: string}>}
   */
  TM.ceming.aiSearchCard = async function(name) {
    if (!name) return { ok: false, reason: 'no_name', message: '需提供姓名' };
    name = String(name).trim();

    // 黑名单拦截
    if (TM.ceming.isBlacklisted(name)) {
      return { ok: false, reason: 'blacklisted', message: '此名已在黑名单·跳过' };
    }

    // 已在册则直接返回（同名去重）
    if (typeof findCharByName === 'function') {
      var inRoster = findCharByName(name);
      if (inRoster) return { ok: false, reason: 'in_roster', message: '此人已在人物志', existing: inRoster };
    }

    // 优先用项目标准 callAI（含重试/超时/Anthropic 适配）·无则降级到裸 fetch
    var hasCallAI = (typeof callAI === 'function');
    var hasFetch = (typeof fetch === 'function');
    if (!hasCallAI && !hasFetch) {
      return { ok: false, reason: 'no_runtime', message: 'AI 运行时不可用（callAI/fetch 都缺失）' };
    }
    var pAi = (typeof P !== 'undefined') ? P.ai : null;
    if (!pAi || !pAi.key) {
      return { ok: false, reason: 'no_api', message: '未配置 AI·请到设置中填 API Key·然后再来策名' };
    }
    if (!pAi.url) {
      return { ok: false, reason: 'no_url', message: 'API URL 未配置·请到设置补全' };
    }

    // 列出库内已知锚定候选（按朝代均匀采样·避免只取前 40 个明清角色）
    var anchors = '';
    try {
      if (global.HISTORICAL_CHAR_PROFILES) {
        var byDyn = {};
        Object.keys(global.HISTORICAL_CHAR_PROFILES).forEach(function(k){
          var p = global.HISTORICAL_CHAR_PROFILES[k];
          var d = p.dynasty || '?';
          if (!byDyn[d]) byDyn[d] = [];
          byDyn[d].push(p.name + '(' + d + '·' + (p.role||'') + ')');
        });
        var picked = [];
        Object.keys(byDyn).forEach(function(d){
          picked = picked.concat(byDyn[d].slice(0, 3));  // 每朝代最多 3 人
        });
        anchors = picked.join('、');
      }
    } catch(e) {}

    var prompt = '你是中国历史考据 AI。任务：为查询的人物返回一张轻量身份卡·让玩家确认是否要的人。\n\n';
    prompt += '【查询人物】' + name + '\n';
    prompt += '【已知库内人物清单·供你做相似锚定】\n' + anchors + '\n\n';
    prompt += '【任务】\n';
    prompt += '1. 判定此人是否真实存在的中国历史人物·若不存在或不可考·返回 {"found":false}\n';
    prompt += '2. 若存在·返回基本身份卡（姓名、字、朝代、生卒年、官至、类型、典故）\n';
    prompt += '3. 从清单中挑 1-3 人作风格/学问/仕途锚定（仅用清单中已存在的人物名）\n';
    prompt += '4. 不必生成完整能力数值·这是预览·正式属性在确认后再生成\n';
    prompt += '5. 若同名易混·必须在 ambiguityNote 说明\n\n';
    prompt += '只返回 JSON 对象·不要任何 markdown/前后文/代码块。格式：\n';
    prompt += '{\n';
    prompt += '  "found": true,\n';
    prompt += '  "name": "姓名",\n';
    prompt += '  "zi": "字",\n';
    prompt += '  "alternateNames": ["号","谥号"],\n';
    prompt += '  "dynasty": "朝代",\n';
    prompt += '  "era": "纪年（如贞观/嘉靖）",\n';
    prompt += '  "birthYear": 643,\n';
    prompt += '  "deathYear": 700,\n';
    prompt += '  "officialTitle": "最高官至",\n';
    prompt += '  "role": "corrupt|regent|military|clean|scholar|loyal|reformer|usurper|eunuch",\n';
    prompt += '  "historicalFaction": "★史实势力·此人原属哪个朝廷/政权(如范文程→后金·岳飞→南宋·诸葛亮→蜀汉·吴三桂晚年→清朝廷)",\n';
    prompt += '  "background": "60-100字背景",\n';
    prompt += '  "famousQuote": "代表性言论",\n';
    prompt += '  "historicalFate": "20-40字历史结局",\n';
    prompt += '  "anchors": [{"name":"锚定人物名","dimension":"风格近/学问近/仕途近","reason":"15字简述"}],\n';
    prompt += '  "confidence": "high|medium|low",\n';
    prompt += '  "ambiguityNote": "若同名易混·此处说明"\n';
    prompt += '}';

    var content = '';
    try {
      // ─── 优先走 callAI（项目标准·secondary tier·缺时自动回退 primary）───
      if (hasCallAI) {
        try { console.log('[策名] callAI 检索:', name, '(tier=secondary)'); } catch(_){}
        content = await callAI(prompt, 1200, undefined, 'secondary');
      } else {
        // ─── 降级裸 fetch ───
        try { console.log('[策名] fetch 检索:', name); } catch(_){}
        var url = pAi.url;
        // 自动补 /v1/chat/completions（若 URL 未含路径）
        if (!/\/(v1|chat|completions|messages)/.test(url)) {
          url = url.replace(/\/+$/, '') + '/v1/chat/completions';
        }
        var resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + pAi.key
          },
          body: JSON.stringify({
            model: pAi.model || 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1200
          })
        });
        if (!resp.ok) {
          var errText = '';
          try { errText = await resp.text(); } catch(_){}
          return { ok: false, reason: 'http_error', message: 'API HTTP ' + resp.status + ': ' + (errText || resp.statusText) };
        }
        var data = await resp.json();
        content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        if (!content && data.content && Array.isArray(data.content)) {
          content = data.content.map(function(b){ return b.text || ''; }).join('');
        }
      }
    } catch (e) {
      try { console.warn('[策名] AI 调用失败:', e); } catch(_){}
      return { ok: false, reason: 'api_error', message: 'AI 调用失败: ' + (e.message || String(e)) };
    }

    if (!content) {
      return { ok: false, reason: 'empty_response', message: 'AI 返回空内容·请重试' };
    }

    // 尝试多种 JSON 解析路径
    var card = null;
    try {
      if (typeof extractJSON === 'function') {
        card = extractJSON(content);
      }
    } catch(e) {}
    if (!card) {
      // 手动剥 ```json``` 包装
      var trimmed = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
      // 找第一个 { 开始的位置
      var braceStart = trimmed.indexOf('{');
      if (braceStart >= 0) {
        var braceEnd = trimmed.lastIndexOf('}');
        if (braceEnd > braceStart) {
          try { card = JSON.parse(trimmed.substring(braceStart, braceEnd + 1)); } catch(_){}
        }
      }
    }
    if (!card) {
      try { console.warn('[策名] JSON 解析失败·原始返回:', String(content).slice(0, 300)); } catch(_){}
      return { ok: false, reason: 'parse_error', message: 'AI 返回非 JSON·无法解析（请打开 F12 控制台看[策名]日志）', raw: String(content).slice(0, 200) };
    }

    if (!card.found || !card.name) {
      return { ok: false, reason: 'not_found', message: '史官未察其人·奏对再三', card: card };
    }

    return { ok: true, card: card };
  };

  /**
   * §3b 第二步：基于已确认身份卡·生成完整属性并入册
   * @param {Object} card - aiSearchCard 返回的身份卡
   * @returns {Promise<{existed: boolean, char: Object}>}
   */
  TM.ceming.summonByCard = async function(card) {
    if (!card || !card.name) throw new Error('需提供身份卡');

    // 闸门判定（用 card 中的生卒年）
    var pseudoProfile = {
      name: card.name,
      birthYear: card.birthYear,
      deathYear: card.deathYear,
      eraStartYear: card.birthYear,
      eraEndYear: card.deathYear
    };
    var check = TM.ceming.canSummon(pseudoProfile);
    if (!check.ok) throw new Error('断代不容: ' + check.reason);

    // 同名去重
    if (typeof findCharByName === 'function') {
      var existing = findCharByName(card.name);
      if (existing) return { existed: true, char: existing };
    }

    if (typeof global.aiGenerateCompleteCharacter !== 'function') {
      throw new Error('aiGenerateCompleteCharacter 不可用');
    }

    // 走现有完整生成接口·把身份卡作为强约束 sourceContext 注入
    var sourceContext = '【已确认身份·必须严格遵守】\n' +
      '姓名：' + card.name + (card.zi ? '·字 ' + card.zi : '') + '\n' +
      '朝代：' + (card.dynasty || '') + (card.era ? '·' + card.era : '') + '\n' +
      '生卒：' + (card.birthYear || '?') + '-' + (card.deathYear || '?') + '\n' +
      '官至：' + (card.officialTitle || '') + '\n' +
      '类型：' + (card.role || '') + '\n' +
      '史实势力：' + (card.historicalFaction || '') + '\n' +
      '背景：' + (card.background || '') + '\n' +
      '历史结局：' + (card.historicalFate || '') + '\n' +
      (card.famousQuote ? '代表言论：' + card.famousQuote + '\n' : '');

    var curYear = (typeof GM !== 'undefined' && GM.year) || 0;
    var age = (card.birthYear && curYear) ? (curYear - card.birthYear) : null;

    var scnStart2 = (typeof P !== 'undefined' && P.scenario && P.scenario.startYear) ||
                    (typeof P !== 'undefined' && P.time && P.time.startYear) || curYear;
    var newChar = await global.aiGenerateCompleteCharacter(card.name, {
      reason: '玩家策名·' + (card.dynasty || '') + (card.era || ''),
      sourceContext: sourceContext,
      isHistoricalHint: true,
      age: age,
      birthYear: card.birthYear,
      deathYear: card.deathYear,
      scenarioStartYear: scnStart2,
      historicalFactionHint: card.historicalFaction || '',
      tier: 'secondary'  // 策名默认次要 API·_getAITier 自动回退 primary
    });

    if (!newChar) throw new Error('生成失败');

    // 加策名标记
    newChar.source = 'ceming';
    newChar.cemingTurn = (typeof GM !== 'undefined' && GM.turn) || 1;
    newChar.cemingByPlayer = true;
    newChar.cemingMode = check.mode || 'yanyi';
    newChar.birthYear = card.birthYear || newChar.birthYear;
    newChar.deathYear = card.deathYear || newChar.deathYear;
    newChar.alternateNames = card.alternateNames ? card.alternateNames.slice() : (newChar.alternateNames || []);
    newChar.historicalFate = newChar.historicalFate || card.historicalFate;
    newChar.famousQuote = newChar.famousQuote || card.famousQuote;

    return { existed: false, char: newChar };
  };

  // ─────────────────────────────────────────────────────────
  // §4 黑名单管理（疑非真人 / API 浪费防护）
  // ─────────────────────────────────────────────────────────

  var BLACKLIST_KEY = 'tm.ceming.blacklist';

  TM.ceming.isBlacklisted = function(name) {
    if (!name) return false;
    var bl = null;
    try { bl = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || '[]'); } catch(_) { return false; }
    return Array.isArray(bl) && bl.indexOf(String(name).trim()) >= 0;
  };

  TM.ceming.addToBlacklist = function(name) {
    if (!name) return;
    var bl = [];
    try { bl = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || '[]'); } catch(_) {}
    if (!Array.isArray(bl)) bl = [];
    var n = String(name).trim();
    if (bl.indexOf(n) < 0) bl.push(n);
    try { localStorage.setItem(BLACKLIST_KEY, JSON.stringify(bl)); } catch(_) {}
  };

  TM.ceming.removeFromBlacklist = function(name) {
    if (!name) return;
    var bl = [];
    try { bl = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || '[]'); } catch(_) {}
    if (!Array.isArray(bl)) return;
    var n = String(name).trim();
    var idx = bl.indexOf(n);
    if (idx >= 0) {
      bl.splice(idx, 1);
      try { localStorage.setItem(BLACKLIST_KEY, JSON.stringify(bl)); } catch(_) {}
    }
  };

  TM.ceming.listBlacklist = function() {
    var bl = [];
    try { bl = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || '[]'); } catch(_) {}
    return Array.isArray(bl) ? bl.slice() : [];
  };

  // ─────────────────────────────────────────────────────────
  // §5 历史检查豁免名单（供 endturn-ai-infer 历史检查 prompt 调用）
  // ─────────────────────────────────────────────────────────

  /**
   * 返回所有玩家亲自策名的角色清单·用于历史检查 prompt 豁免
   * 历史检查 AI 看到这些名字必须保留·不可视为时代错乱
   * @returns {string} 多行文本（空则返回空串）
   */
  TM.ceming.buildHistCheckExemption = function() {
    if (typeof GM === 'undefined' || !GM.chars) return '';
    var cemingChars = GM.chars.filter(function(c){
      return c && c.cemingByPlayer === true && c.alive !== false;
    });
    if (cemingChars.length === 0) return '';
    var lines = cemingChars.map(function(c){
      var era = c.era ? '·' + c.era : '';
      var dyn = c.dynasty ? '·' + c.dynasty : '';
      return '· ' + c.name + dyn + era + '（第' + (c.cemingTurn || '?') + '回合·玩家策名）';
    });
    return '【玩家亲自策名·不可视为时代错乱·任何叙事提及一律保留】\n' + lines.join('\n');
  };

  // ─────────────────────────────────────────────────────────
  // §6 UI: openDialog / 〔敕召贤良〕双 tab 对话框
  // ─────────────────────────────────────────────────────────

  var _dlgState = {
    activeTab: 'library',  // 'library' | 'search'
    selectedProfile: null,  // 库内选中的 profileId
    selectedCard: null,     // 库外检索回来的 card
    filterDynasty: 'all',
    filterRole: 'all',
    searchKeyword: '',     // 自寻贤臣的搜索词
    libraryKeyword: ''     // 档案库的本地搜索词
  };

  TM.ceming.openDialog = function() {
    // 防重入
    var existing = document.getElementById('ceming-overlay');
    if (existing) { existing.remove(); }

    var ov = document.createElement('div');
    ov.id = 'ceming-overlay';
    ov.className = 'generic-modal-overlay';
    ov.innerHTML = _renderDialogShell();
    document.body.appendChild(ov);

    // 初始渲染库内 tab
    _switchTab('library');
  };

  TM.ceming.closeDialog = function() {
    var ov = document.getElementById('ceming-overlay');
    if (ov) ov.remove();
    _dlgState.selectedProfile = null;
    _dlgState.selectedCard = null;
  };

  function _renderDialogShell() {
    var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
    var modeLabel = { yanyi: '演义模式', light_hist: '轻度史实', strict_hist: '严格史实' }[mode] || mode;
    var modeColor = { yanyi: '#c08040', light_hist: '#8a6a3a', strict_hist: '#5a4a2a' }[mode] || '#888';

    return '<div class="generic-modal" style="width:min(960px,94vw);max-height:90vh;display:flex;flex-direction:column;">' +
      '<div class="generic-modal-header">' +
        '<h3>〔敕召贤良〕</h3>' +
        '<span style="margin-left:auto;margin-right:12px;padding:3px 10px;border-radius:10px;background:' + modeColor + ';color:#f8f0d8;font-size:12px;font-weight:700;">' + modeLabel + '</span>' +
        '<button class="bt bs bsm" onclick="TM.ceming.closeDialog()">✕</button>' +
      '</div>' +
      '<div style="display:flex;border-bottom:1px solid var(--border,#3a2c1a);background:rgba(0,0,0,0.15);">' +
        '<button class="cm-tab-btn" data-tab="library" onclick="TM.ceming._switchTab(\'library\')" style="flex:1;padding:10px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text);cursor:pointer;font-size:14px;">档 案 库</button>' +
        '<button class="cm-tab-btn" data-tab="search" onclick="TM.ceming._switchTab(\'search\')" style="flex:1;padding:10px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text);cursor:pointer;font-size:14px;">自 寻 贤 臣</button>' +
      '</div>' +
      '<div id="ceming-body" class="generic-modal-body" style="flex:1;overflow-y:auto;padding:14px;"></div>' +
      '<div class="generic-modal-footer">' +
        '<button class="bt bs" onclick="TM.ceming.closeDialog()">搁置</button>' +
      '</div>' +
    '</div>';
  }

  TM.ceming._switchTab = function(tab) {
    _dlgState.activeTab = tab;
    document.querySelectorAll('#ceming-overlay .cm-tab-btn').forEach(function(btn){
      var active = btn.getAttribute('data-tab') === tab;
      btn.style.borderBottomColor = active ? 'var(--gold,#c89b4d)' : 'transparent';
      btn.style.fontWeight = active ? '700' : '400';
      btn.style.color = active ? 'var(--gold,#c89b4d)' : 'var(--text)';
    });
    var body = document.getElementById('ceming-body');
    if (!body) return;
    body.innerHTML = (tab === 'library') ? _renderLibraryTab() : _renderSearchTab();
  };

  function _renderLibraryTab() {
    if (!global.HISTORICAL_CHAR_PROFILES) {
      return '<div style="text-align:center;padding:40px;color:#888;">档案库未加载</div>';
    }
    var profiles = global.HISTORICAL_CHAR_PROFILES;

    // 收集朝代/类型选项
    var dynasties = {}, roles = {};
    Object.keys(profiles).forEach(function(k){
      var p = profiles[k];
      if (p.dynasty) dynasties[p.dynasty] = true;
      if (p.role) roles[p.role] = true;
    });

    var dynastyOpts = '<option value="all">全部朝代</option>' +
      Object.keys(dynasties).map(function(d){ return '<option value="'+d+'"'+(_dlgState.filterDynasty===d?' selected':'')+'>'+d+'</option>'; }).join('');
    var roleLabels = { corrupt:'巨贪', regent:'权臣', military:'名将', clean:'清官', scholar:'文宗', loyal:'忠臣', reformer:'改革家', usurper:'篡臣', eunuch:'宦权' };
    var roleOpts = '<option value="all">全部类型</option>' +
      Object.keys(roles).map(function(r){ return '<option value="'+r+'"'+(_dlgState.filterRole===r?' selected':'')+'>'+(roleLabels[r]||r)+'</option>'; }).join('');

    var html = '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
      '<input id="cm-lib-search" placeholder="搜索姓名/字号/官至/谥号…（如 王守仁/伯安/兵部尚书）" oninput="TM.ceming._setLibKeyword(this.value)" value="' + (_dlgState.libraryKeyword || '').replace(/"/g, '&quot;') + '" style="flex:2;padding:6px 10px;background:rgba(0,0,0,0.2);border:1px solid var(--border,#3a2c1a);color:var(--text);">' +
      '<select id="cm-filter-dynasty" onchange="TM.ceming._setFilter(\'dynasty\',this.value)" style="flex:1;padding:6px;background:rgba(0,0,0,0.2);border:1px solid var(--border,#3a2c1a);color:var(--text);">' + dynastyOpts + '</select>' +
      '<select id="cm-filter-role" onchange="TM.ceming._setFilter(\'role\',this.value)" style="flex:1;padding:6px;background:rgba(0,0,0,0.2);border:1px solid var(--border,#3a2c1a);color:var(--text);">' + roleOpts + '</select>' +
    '</div>';

    // 筛选+渲染卡片网格
    var kw = (_dlgState.libraryKeyword || '').trim().toLowerCase();
    var ids = Object.keys(profiles).filter(function(k){
      var p = profiles[k];
      if (_dlgState.filterDynasty !== 'all' && p.dynasty !== _dlgState.filterDynasty) return false;
      if (_dlgState.filterRole !== 'all' && p.role !== _dlgState.filterRole) return false;
      if (kw) {
        var hay = [p.name||'', p.zi||'', p.title||'', p.officialTitle||'', p.era||'', p.dynasty||'', p.id||'',
                   (p.alternateNames||[]).join(' '), p.background||'', p.famousQuote||''].join('  ').toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    });
    // 加结果计数提示
    html += '<div style="font-size:11px;color:#888;margin-bottom:8px;">' + ids.length + ' / ' + Object.keys(profiles).length + ' 条' + (kw ? '·搜「'+(_dlgState.libraryKeyword||'')+'」' : '') + '</div>';

    if (ids.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#888;">此筛选下无人物</div>';
      return html;
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">';
    ids.forEach(function(id){
      var p = profiles[id];
      var check = TM.ceming.canSummon(p);
      var inRoster = (typeof findCharByName === 'function') && findCharByName(p.name);
      var disabled = !check.ok || inRoster;
      var dimStyle = disabled ? 'opacity:0.4;cursor:not-allowed;' : 'cursor:pointer;';
      var dimText = inRoster ? '已在册' : (!check.ok ? check.reason : '');

      html += '<div onclick="' + (disabled ? '' : ('TM.ceming._previewProfile(\'' + id + '\')')) + '" ' +
              'style="padding:10px;border:1px solid var(--border,#3a2c1a);border-radius:6px;background:rgba(0,0,0,0.15);' + dimStyle + 'transition:border-color 0.2s;" ' +
              'onmouseover="if(!this.style.opacity||this.style.opacity===\'1\')this.style.borderColor=\'var(--gold,#c89b4d)\'" ' +
              'onmouseout="this.style.borderColor=\'var(--border,#3a2c1a)\'">' +
        '<div style="font-size:15px;font-weight:700;color:var(--gold,#c89b4d);">' + (p.name || '佚名') + (p.zi ? ' <span style="font-size:11px;color:#888;font-weight:400;">字 ' + p.zi + '</span>' : '') + '</div>' +
        '<div style="font-size:12px;color:#aaa;margin-top:3px;">' + (p.dynasty || '') + (p.era ? ' · ' + p.era : '') + '</div>' +
        '<div style="font-size:11px;color:#888;margin-top:3px;">' + (p.officialTitle || p.title || '') + '</div>' +
        '<div style="font-size:10px;color:#666;margin-top:4px;">类型: ' + (roleLabels[p.role] || p.role || '?') + '</div>' +
        (dimText ? '<div style="font-size:10px;color:#a55;margin-top:4px;">⚠ ' + dimText + '</div>' : '') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function _renderSearchTab() {
    var html = '<div style="margin-bottom:12px;">' +
      '<div style="font-size:12px;color:#aaa;margin-bottom:6px;">输入历史人物姓名·AI 将为你检索·确认后再生成完整属性</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<input id="cm-search-input" placeholder="姓名 例如：沈括 / 范蠡 / 上官婉儿" style="flex:1;padding:8px;background:rgba(0,0,0,0.2);border:1px solid var(--border,#3a2c1a);color:var(--text);" value="' + (_dlgState.searchKeyword || '') + '">' +
        '<button class="bt bp" onclick="TM.ceming._doSearch()">查 阅</button>' +
      '</div>' +
    '</div>' +
    '<div id="cm-search-result"></div>';

    return html;
  }

  TM.ceming._setFilter = function(key, value) {
    if (key === 'dynasty') _dlgState.filterDynasty = value;
    else if (key === 'role') _dlgState.filterRole = value;
    var body = document.getElementById('ceming-body');
    if (body) body.innerHTML = _renderLibraryTab();
  };

  // 档案库本地搜索（保留 input 焦点·只重新渲染网格）
  TM.ceming._setLibKeyword = function(value) {
    _dlgState.libraryKeyword = value || '';
    // 整体重渲染太重·会丢焦点。改为只更新网格 + 计数·input 不动
    var body = document.getElementById('ceming-body');
    if (!body) return;
    // 简单做法：整 tab 重渲染·然后把 input 的焦点和 caret 还原
    body.innerHTML = _renderLibraryTab();
    var inp = document.getElementById('cm-lib-search');
    if (inp) {
      inp.focus();
      try { inp.setSelectionRange(value.length, value.length); } catch(_){}
    }
  };

  TM.ceming._previewProfile = function(profileId) {
    var profile = global.HISTORICAL_CHAR_PROFILES && global.HISTORICAL_CHAR_PROFILES[profileId];
    if (!profile) return;
    _dlgState.selectedProfile = profileId;
    _showIdentityCard(profile, 'profile');
  };

  TM.ceming._doSearch = async function() {
    var inp = document.getElementById('cm-search-input');
    if (!inp) return;
    var name = (inp.value || '').trim();
    if (!name) { if (typeof toast === 'function') toast('请输入姓名'); return; }
    _dlgState.searchKeyword = name;

    var resultDiv = document.getElementById('cm-search-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;">史官查阅典籍……</div>';

    var result = await TM.ceming.aiSearchCard(name);
    if (!result.ok) {
      var msg = result.message || result.reason;
      if (result.reason === 'in_roster') {
        resultDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;">' + msg + '<br><button class="bt bs" style="margin-top:10px;" onclick="TM.ceming.closeDialog();renderRenwu&&renderRenwu();">点此跳转人物志</button></div>';
      } else {
        resultDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#a55;">⚠ ' + msg + '</div>';
      }
      return;
    }
    _dlgState.selectedCard = result.card;
    _showIdentityCard(result.card, 'card');
  };

  function _showIdentityCard(data, kind) {
    // kind: 'profile' (库内) | 'card' (库外 AI 检索回的)
    var roleLabels = { corrupt:'巨贪', regent:'权臣', military:'名将', clean:'清官', scholar:'文宗', loyal:'忠臣', reformer:'改革家', usurper:'篡臣', eunuch:'宦权' };
    var dynasty = data.dynasty || '';
    var era = data.era || '';
    var b = data.birthYear || '?';
    var d = data.deathYear || '?';
    var anchorsHtml = '';
    if (data.anchors && data.anchors.length > 0) {
      anchorsHtml = '<div style="margin-top:10px;padding:8px;background:rgba(192,154,83,0.08);border-left:2px solid #c89b4d;">' +
        '<div style="font-size:11px;color:#c89b4d;font-weight:700;margin-bottom:4px;">【相似锚定】</div>' +
        data.anchors.map(function(a){
          return '<div style="font-size:11px;color:#bbb;margin:2px 0;">◐ ' + (a.dimension || '风格近') + ' <span style="color:#d4a85a;">' + a.name + '</span>' + (a.reason ? '<span style="color:#888;">·' + a.reason + '</span>' : '') + '</div>';
        }).join('') +
      '</div>';
    }

    var ambiguityHtml = data.ambiguityNote ? '<div style="margin-top:8px;font-size:11px;color:#a87;">⚠ ' + data.ambiguityNote + '</div>' : '';
    var confidenceHtml = (data.confidence === 'low') ? '<span style="margin-left:8px;font-size:10px;color:#a55;">存疑·待考</span>' : '';

    var html = '<div style="padding:18px;border:1px solid #c89b4d;border-radius:6px;background:linear-gradient(180deg,rgba(192,154,83,0.08),rgba(0,0,0,0.1));">' +
      '<div style="font-size:18px;font-weight:700;color:var(--gold,#c89b4d);">〔' + (data.name || '佚名') + (data.zi ? '  ' + data.zi : '') + '〕' + confidenceHtml + '</div>' +
      '<div style="font-size:12px;color:#aaa;margin-top:4px;">' + dynasty + (era ? ' · ' + era : '') + ' · ' + b + '-' + d + '</div>' +
      '<div style="font-size:13px;color:#ccc;margin-top:2px;">' + (data.officialTitle || data.title || '') + '</div>' +
      '<div style="margin-top:10px;height:1px;background:linear-gradient(90deg,transparent,#c89b4d,transparent);"></div>' +
      '<div style="margin-top:10px;font-size:12px;color:#bbb;"><b style="color:#d4a85a;">类型：</b>' + (roleLabels[data.role] || data.role || '?') + '</div>' +
      (data.background ? '<div style="margin-top:6px;font-size:12px;color:#bbb;line-height:1.6;"><b style="color:#d4a85a;">背景：</b>' + data.background + '</div>' : '') +
      (data.famousQuote ? '<div style="margin-top:6px;font-size:12px;color:#bbb;font-style:italic;"><b style="color:#d4a85a;font-style:normal;">代表言论：</b>" ' + data.famousQuote + ' "</div>' : '') +
      (data.historicalFate ? '<div style="margin-top:6px;font-size:12px;color:#bbb;"><b style="color:#d4a85a;">历史结局：</b>' + data.historicalFate + '</div>' : '') +
      anchorsHtml +
      ambiguityHtml +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">' +
      '<button class="bt bs" onclick="TM.ceming._backToList()">另 寻</button>' +
      (kind === 'card' ? '<button class="bt bs" style="color:#a55;" onclick="TM.ceming._markFake()">疑 非 真 人</button>' : '') +
      '<button class="bt bp" onclick="TM.ceming._confirmSummon(\'' + kind + '\')">确为此人·策 名</button>' +
    '</div>';

    var body = document.getElementById('ceming-body');
    if (body) body.innerHTML = html;
  }

  TM.ceming._backToList = function() {
    var body = document.getElementById('ceming-body');
    if (!body) return;
    body.innerHTML = (_dlgState.activeTab === 'library') ? _renderLibraryTab() : _renderSearchTab();
  };

  TM.ceming._markFake = function() {
    if (_dlgState.selectedCard && _dlgState.selectedCard.name) {
      TM.ceming.addToBlacklist(_dlgState.selectedCard.name);
      if (typeof toast === 'function') toast('已记入黑名单：' + _dlgState.selectedCard.name);
    }
    _dlgState.selectedCard = null;
    TM.ceming._backToList();
  };

  TM.ceming._confirmSummon = async function(kind) {
    var body = document.getElementById('ceming-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:60px;color:#c89b4d;font-size:14px;">史官撰其履历……<br><span style="font-size:11px;color:#888;">（请稍候，AI 正在生成完整属性）</span></div>';

    try {
      var result;
      var charName;
      if (kind === 'profile' && _dlgState.selectedProfile) {
        result = await TM.ceming.summonByProfile(_dlgState.selectedProfile);
        charName = result.char.name;
      } else if (kind === 'card' && _dlgState.selectedCard) {
        result = await TM.ceming.summonByCard(_dlgState.selectedCard);
        charName = result.char.name;
      } else {
        throw new Error('无效的策名状态');
      }

      // 决定 toast 文案
      var mode = (P && P.conf && P.conf.gameMode) || 'yanyi';
      var msg;
      if (result.existed) {
        msg = charName + ' 已在册';
      } else if (kind === 'profile') {
        // 库内·按朝代是否当世选 toast
        var profile = global.HISTORICAL_CHAR_PROFILES[_dlgState.selectedProfile];
        var curYear = (GM && GM.year) || 0;
        var isCurrentEra = profile.birthYear && profile.deathYear &&
                            curYear >= profile.birthYear && curYear <= profile.deathYear;
        if (mode === 'yanyi' && !isCurrentEra) {
          msg = charName + ' 破时空之障·应诏而来';
        } else {
          msg = charName + ' 奉诏来朝';
        }
      } else {
        msg = charName + ' 应召而至';
      }

      if (typeof toast === 'function') toast('📜 ' + msg);
      TM.ceming.closeDialog();

      // 触发人物志重渲染
      if (typeof renderRenwu === 'function') renderRenwu();

      // 写一笔起居注
      if (typeof addEB === 'function') {
        addEB('策名', charName + (result.existed ? ' 已在人物志' : ' 入人物志·' + msg));
      }
    } catch (e) {
      if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:#a55;">⚠ ' + (e.message || e) + '<br><button class="bt bs" style="margin-top:14px;" onclick="TM.ceming._backToList()">返 回</button></div>';
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
