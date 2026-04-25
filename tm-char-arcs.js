// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-char-arcs.js
 * 人物情节弧推进·后台 idle 异步调度
 *
 * 三层触发保险：
 *   Layer 1·enterGame:after +10s·requestIdleCallback
 *   Layer 2·面板打开时(openCharDetail/openWenduiModal)·预热
 *   Layer 3·过回合前兜底检查
 *
 * 不占 endturn 时间·可被玩家操作 abort·缓存在 GM._charArcs
 * 主推演 sysP 读取·AI 按弧线演 NPC
 */
(function(global){
  'use strict';

  var CACHE_REFRESH_INTERVAL_TURNS = 2;   // 每 2 回合刷新
  var IDLE_TRIGGER_DELAY_MS = 10000;       // 新回合+10s 触发
  var MAX_KEY_CHARS = 12;                  // 最多处理 12 位 NPC
  var MIN_IMPORTANCE = 65;                 // importance 阈值

  var _inProgress = false;
  var _abortController = null;
  var _lastTriggerTurn = -2;

  function _shouldAdvance() {
    if (_inProgress) return false;
    if (!global.GM || !global.P || !global.P.ai || !global.P.ai.key) return false;
    if (!Array.isArray(GM.chars) || GM.chars.length === 0) return false;
    var lastTurn = (GM._charArcs && GM._charArcs._lastTurn);
    if (typeof lastTurn !== 'number') lastTurn = -CACHE_REFRESH_INTERVAL_TURNS;
    return ((GM.turn || 0) - lastTurn) >= CACHE_REFRESH_INTERVAL_TURNS;
  }

  function _selectKeyChars() {
    if (!global.GM || !Array.isArray(GM.chars)) return [];
    var pool = GM.chars.filter(function(c) {
      if (!c || !c.name || c.dead || c.destroyed) return false;
      if ((c.importance || 0) >= MIN_IMPORTANCE) return true;
      if (c.officialTitle && (c.rankLevel || 99) <= 5) return true;  // 一至五品
      if (c.isPlayer || c.isHistorical) return true;
      if ((c.ambition || 0) >= 85 || (c.loyalty || 50) <= 15) return true;  // 野心/不忠
      return false;
    });
    // 按 importance 排序
    pool.sort(function(a,b){ return (b.importance||0) - (a.importance||0); });
    return pool.slice(0, MAX_KEY_CHARS);
  }

  function _collectRecentEventsAboutChar(charName, limit) {
    if (!global.GM || !Array.isArray(GM._chronicle)) return [];
    limit = limit || 5;
    return GM._chronicle.filter(function(ev) {
      if (!ev || !ev.text) return false;
      return ev.text.indexOf(charName) >= 0;
    }).slice(-limit).map(function(ev) {
      return 'T' + (ev.turn || '?') + '·' + (ev.text || '').slice(0, 80);
    });
  }

  function _buildPrompt(keyChars) {
    var turnTxt = (typeof getTSText === 'function') ? getTSText(GM.turn || 1) : ('T' + (GM.turn || 1));
    var ctxList = keyChars.map(function(c) {
      return {
        name: c.name,
        zi: c.zi || '',
        party: c.party || '',
        faction: c.faction || '',
        officialTitle: c.officialTitle || c.title || '',
        rankLevel: c.rankLevel || null,
        loyalty: c.loyalty || 50,
        ambition: c.ambition || 50,
        innerThought: (c.innerThought || '').slice(0, 100),
        stressSources: Array.isArray(c.stressSources) ? c.stressSources.slice(0, 3) : [],
        personalGoal: (c.personalGoal || '').slice(0, 80),
        currentArc: (GM._charArcs && GM._charArcs[c.name]) ? GM._charArcs[c.name].arcStage : '',
        recentEvents: _collectRecentEventsAboutChar(c.name, 5)
      };
    });

    var prompt = '你是剧作师·负责推进主要 NPC 的情节弧。基于以下 NPC 的当前状态+近 5 回合所涉编年事件·为每位 NPC 推进/起草未来 3-5 回合的心理走向。\n\n' +
      '【当前时间】' + turnTxt + '\n\n' +
      '【NPC 快照】\n' + JSON.stringify(ctxList, null, 2) +
      '\n\n【输出 JSON】对每位 NPC 输出：\n' +
      '{\n' +
      '  "NPC姓名": {\n' +
      '    "arcStage": "当前弧线阶段·如：初识/受挫/顿悟/觉醒/堕落/暗疑/孤愤/释怀/投机观望/等",\n' +
      '    "motivation": "当前核心动机(30字内·引述文本)",\n' +
      '    "emotionalState": "情绪状态·如 沉郁/亢奋/阴鸷/惶惑/坦然/等",\n' +
      '    "arcProgress": 0-100 (该弧线完成度整数),\n' +
      '    "nextCue": "未来 1-3 回合最可能的关键动作(40字内)",\n' +
      '    "innerChange": "对角色原 innerThought 的微修订(50字内·可继承·可演化)"\n' +
      '  }\n' +
      '}\n\n' +
      '【准则】\n' +
      '1. 弧线必须连续·不得突变(除非遭遇剧本已定的不可逆事件)\n' +
      '2. arcStage 要有"戏剧感"·不是状态标签·而是境遇\n' +
      '3. 不得引入未在当前游戏时间之前发生的未来史实\n' +
      '4. emotionalState 随 loyalty/ambition/stressSources/recentEvents 变化\n' +
      '5. nextCue 是"可能"·不是"必然"·给推演 AI 启发\n' +
      '6. 只输出 JSON·无其他文字';
    return prompt;
  }

  async function advanceCharArcs(options) {
    options = options || {};
    if (_inProgress) {
      console.log('[情节弧] 已有调用进行中·跳过');
      return;
    }
    if (!_shouldAdvance() && !options.force) {
      return;
    }
    var keyChars = _selectKeyChars();
    if (keyChars.length === 0) return;

    _inProgress = true;
    _abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var signal = _abortController ? _abortController.signal : undefined;

    try {
      var prompt = _buildPrompt(keyChars);
      if (typeof toast === 'function' && options.showToast) toast('史官正录人物心路…');
      var raw;
      try {
        if (typeof callAISmart === 'function') {
          raw = await callAISmart(prompt, 2500, { maxRetries: 2 });
        } else if (typeof callAI === 'function') {
          raw = await callAI(prompt, 2500, signal);
        }
      } catch(e) {
        if (e && e.name === 'AbortError') { console.log('[情节弧] 已取消'); return; }
        throw e;
      }
      if (!raw) return;
      var parsed;
      try {
        var m = raw.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : JSON.parse(raw);
      } catch(e) {
        console.warn('[情节弧] JSON 解析失败', e, raw.slice(0, 150));
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;

      if (!GM._charArcs) GM._charArcs = {};
      GM._charArcs._lastTurn = GM.turn || 0;
      GM._charArcs._lastUpdatedAt = Date.now();
      GM._charArcs._keyCharNames = keyChars.map(function(c){return c.name;});
      var updated = 0;
      Object.keys(parsed).forEach(function(name) {
        if (name.indexOf('_') === 0) return;
        var arc = parsed[name];
        if (!arc || typeof arc !== 'object') return;
        GM._charArcs[name] = {
          arcStage: arc.arcStage || '',
          motivation: arc.motivation || '',
          emotionalState: arc.emotionalState || '',
          arcProgress: typeof arc.arcProgress === 'number' ? arc.arcProgress : 0,
          nextCue: arc.nextCue || '',
          innerChange: arc.innerChange || '',
          turn: GM.turn || 0
        };
        // 微修订 character.innerThought
        if (arc.innerChange && typeof arc.innerChange === 'string' && arc.innerChange.length > 5) {
          var ch = GM.chars.find(function(c){ return c.name === name; });
          if (ch) ch.innerThought = arc.innerChange.slice(0, 200);
        }
        updated++;
      });
      console.log('[情节弧] 已更新 ' + updated + '/' + keyChars.length + ' 位 NPC @ T' + GM.turn);
      if (options.showToast && typeof toast === 'function') toast('人物心路已更新·' + updated + ' 位');
    } catch(e) {
      console.warn('[情节弧] 异常', e);
    } finally {
      _inProgress = false;
      _abortController = null;
    }
  }

  function abortCharArcs() {
    if (_abortController) {
      try { _abortController.abort(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-char-arcs');}catch(_){}}
      _abortController = null;
    }
    _inProgress = false;
  }

  // —— 构建主推演 sysP 注入块 ——
  function buildCharArcsForSysP() {
    if (!global.GM || !GM._charArcs) return '';
    var keys = Object.keys(GM._charArcs).filter(function(k){ return k.indexOf('_') !== 0; });
    if (keys.length === 0) return '';
    var out = '\n\n【关键 NPC 情节弧·推演时务必按此演绎 NPC 心路·保持弧线连续】';
    keys.slice(0, 12).forEach(function(name) {
      var arc = GM._charArcs[name];
      if (!arc) return;
      var line = '\n  · ' + name;
      if (arc.arcStage) line += '·' + arc.arcStage;
      if (arc.emotionalState) line += '·' + arc.emotionalState;
      if (arc.motivation) line += '·动机:' + arc.motivation.slice(0, 40);
      if (arc.nextCue) line += '·潜动:' + arc.nextCue.slice(0, 40);
      out += line;
    });
    out += '\n★ NPC 行为/发言必须契合其 arcStage+emotionalState·不得与 motivation 矛盾。';
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  //  三层触发保险
  // ══════════════════════════════════════════════════════════════

  // Layer 1·enterGame:after + 10s·requestIdleCallback
  function _scheduleIdleAdvance() {
    if (!global.GM || !GM.running) return;
    setTimeout(function() {
      if (!GM.running) return;
      if (!_shouldAdvance()) return;
      var run = function() {
        if (!GM.running || !_shouldAdvance()) return;
        advanceCharArcs({ showToast: false }).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '情节弧·idle') : console.warn('[情节弧·idle]', e); });
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 5000 });
      } else {
        run();
      }
    }, IDLE_TRIGGER_DELAY_MS);
  }

  // Layer 2·面板打开时预热(若缓存过期)·不阻塞
  function warmCharArcsIfStale() {
    if (!_shouldAdvance()) return;
    // 延迟 2 秒·让面板先渲染
    setTimeout(function() {
      if (_shouldAdvance()) {
        advanceCharArcs({ showToast: false }).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '情节弧·warm') : console.warn('[情节弧·warm]', e); });
      }
    }, 2000);
  }

  // Layer 3·过回合前兜底·仅检查缓存·若严重过期(>=4 回合未更新) 静默触发
  function ensureCharArcsBeforeEndturn() {
    if (!global.GM) return;
    var lastTurn = (GM._charArcs && GM._charArcs._lastTurn);
    if (typeof lastTurn !== 'number') lastTurn = -99;
    var gap = (GM.turn || 0) - lastTurn;
    if (gap >= 4 && !_inProgress) {
      // 触发但不等待
      advanceCharArcs({ showToast: false }).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '情节弧·endturn兜底') : console.warn('[情节弧·endturn兜底]', e); });
    }
  }

  // —— GameHooks 注册 ——
  if (global.GameHooks && typeof global.GameHooks.on === 'function') {
    global.GameHooks.on('enterGame:after', _scheduleIdleAdvance);
    global.GameHooks.on('startGame:after', _scheduleIdleAdvance);
  }

  // —— 玩家操作钩子·预热 ——
  // 监听点击事件·当玩家打开涉及人物的面板时触发
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
      if (!global.GM || !GM.running) return;
      var t = e.target;
      if (!t) return;
      // 捕获人物相关点击
      var txt = (t.textContent || '').trim();
      if (/问对|人物|朝臣|起复|召还/.test(txt) && t.tagName && /^(A|BUTTON|SPAN|DIV)$/.test(t.tagName)) {
        warmCharArcsIfStale();
      }
    }, { passive: true, capture: true });
  }

  // —— 暴露 ——
  global.CharArcs = {
    advance: advanceCharArcs,
    abort: abortCharArcs,
    buildForSysP: buildCharArcsForSysP,
    shouldAdvance: _shouldAdvance,
    warmIfStale: warmCharArcsIfStale,
    ensureBeforeEndturn: ensureCharArcsBeforeEndturn
  };
  global.advanceCharArcs = advanceCharArcs;
  global.buildCharArcsForSysP = buildCharArcsForSysP;
  global.ensureCharArcsBeforeEndturn = ensureCharArcsBeforeEndturn;

})(typeof window !== 'undefined' ? window : this);
