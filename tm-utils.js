// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  工具函数
// ============================================================
var _$=function(id){return document.getElementById(id);};

// ============================================================
//  8.6 ErrorMonitor · R114 (2026-04-24) 降级为 TM.errors 的兼容 shim
//
//  唯一的错误系统现在是 TM.errors (tm-error-collector.js)，它已注册
//  window.onerror / unhandledrejection / 资源加载错误 三套监听。
//  ErrorMonitor 保留原 API (capture / getLog / exportText / clear / count)
//  供既有 caller (tm-game-engine.js 错误日志导出按钮) 继续工作。
//  新代码一律使用 TM.errors.capture()/getLog()。
// ============================================================
var ErrorMonitor = (function() {
  function _tm() { return (typeof window !== 'undefined' && window.TM && window.TM.errors) || null; }

  function capture(type, message, stack) {
    var tm = _tm();
    if (tm) {
      // 构造伪 Error 对象喂给 TM.errors.capture
      var err = { message: String(message || ''), stack: String(stack || '') };
      tm.capture(err, 'errmon:' + (type || 'error'));
      // 同步到 GM._errorLog 老字段（既有代码可能读取）
      if (typeof GM !== 'undefined') GM._errorLog = getLog();
    } else {
      console.warn('[ErrorMonitor·no-TM]', type, message);
    }
  }

  // TM.errors 条目 → ErrorMonitor 老格式 {ts, turn, type, message, stack}
  function _toLegacy(e) {
    var mod = String(e.module || '');
    var type = mod.indexOf('errmon:') === 0 ? mod.slice(7) : (mod || 'error');
    return {
      ts: e.t || Date.now(),
      turn: e.turn || 0,
      type: type,
      message: (e.error && e.error.message) || '',
      stack: (e.error && e.error.stack) || ''
    };
  }

  function getLog() {
    var tm = _tm();
    if (!tm) return [];
    return tm.getLog().map(_toLegacy);
  }

  function exportText() {
    var log = getLog();
    if (log.length === 0) return '无错误记录';
    return '天命错误日志 (' + log.length + '条)\n' + log.map(function(e) {
      return '[T' + e.turn + ' ' + new Date(e.ts).toLocaleTimeString() + '] ' + e.type + ': ' + e.message;
    }).join('\n');
  }

  function clear() {
    var tm = _tm();
    if (tm) tm.clear();
    if (typeof GM !== 'undefined') GM._errorLog = [];
  }

  function count() { return getLog().length; }

  return { capture: capture, getLog: getLog, exportText: exportText, clear: clear, count: count };
})();

// ============================================================
//  TM.safeEval · 受限表达式求值（替代 new Function 直评）
//
//  现有 7 处 new Function('GM',...) 用于评估编辑器规则与 AI 生成的条件
//  表达式（couplingRules.if / collapseRules.condition / canShowExpr 等）。
//  内部规则可信，但用户导入第三方剧本时表达式不可信——可通过
//    GM.constructor.constructor('alert(1)')()
//  逃出沙箱执行任意代码。
//
//  本 helper 不写完整 JS parser，而是：
//    1) 黑名单封禁高危 token（constructor/__proto__/prototype/Function/eval/
//       this/window/global/globalThis/import/require/async/Symbol）
//    2) 严格模式 IIFE 让 this 为 undefined·阻断 .call/.apply 拿全局对象
//    3) 仅暴露白名单上下文键·其余标识符评估为 ReferenceError
//
//  捕获意图同 new Function·失败抛错由 caller try/catch
// ============================================================
(function(){
  if (typeof window === 'undefined') return;
  if (window.TM && window.TM.safeEval) return;
  var FORBIDDEN = /\b(?:constructor|__proto__|__defineGetter__|__defineSetter__|prototype|Function|eval|this|window|self|globalThis|global|parent|top|frames|document|location|navigator|XMLHttpRequest|fetch|Worker|import|require|async|await|Symbol|Reflect|Proxy)\b/;
  function safeEval(expr, ctx) {
    if (typeof expr !== 'string') throw new Error('safeEval: expr must be string');
    if (FORBIDDEN.test(expr)) throw new Error('safeEval: forbidden token in expr');
    var keys = ctx ? Object.keys(ctx) : [];
    var vals = keys.map(function(k){ return ctx[k]; });
    // strict 模式让 this 为 undefined·body 包一层 IIFE 防止泄露
    var fn = Function.apply(null, keys.concat(['"use strict"; return (' + expr + ');']));
    return fn.apply(undefined, vals);
  }
  if (!window.TM) window.TM = {};
  window.TM.safeEval = safeEval;
})();

// 核心指标显示名映射——动态从剧本 P.variables 读取（标记 isCore=true 的变量）
// 引擎不硬编码任何指标名，全由编辑器定义。以下仅为兜底（无剧本加载时）。
var CORE_METRIC_LABELS = {};
/**
 * 从剧本变量列表构建核心指标映射
 * 编辑器中可为变量标记 isCore:true，引擎据此在 Delta 面板/左面板展示
 * 所有指标标签完全由剧本编辑器的 isCore/displayName 决定
 */
function buildCoreMetricLabels() {
  CORE_METRIC_LABELS = {};
  if (typeof P === 'undefined' || !P.variables) return;
  // P.variables 可能是数组或 { base:[], other:[], formulas:[] } 结构
  var _allVars = [];
  if (Array.isArray(P.variables)) {
    _allVars = P.variables;
  } else if (P.variables && typeof P.variables === 'object') {
    _allVars = (P.variables.base || []).concat(P.variables.other || []);
  }
  // 从变量列表中收集标记为核心的变量
  _allVars.forEach(function(v) {
    if (v && v.isCore && v.name) {
      CORE_METRIC_LABELS[v.name] = v.displayName || v.name;
    }
  });
}
// 剧本编辑参考（核心变量由剧本编辑器配置 isCore 标记）：
//   部落联盟：{ name:'authority', displayName:'威信', isCore:true }
//             { name:'tribalUnity', displayName:'部落凝聚', isCore:true }
// 2.6: 通知分级系统——闪现/驻留/紧急 三级
var NotificationSystem = (function() {
  var _history = [];
  var MAX_HISTORY = 50;

  function _record(level, msg) {
    _history.push({level:level, msg:msg, time:Date.now(), turn:typeof GM!=='undefined'?GM.turn:0});
    if (_history.length > MAX_HISTORY) _history.shift();
  }

  return {
    /** 获取通知历史 */
    getHistory: function() { return _history; },
    /** 清空历史 */
    clearHistory: function() { _history = []; },

    /** 闪现提示(2s自动消失) —— 日常操作反馈 */
    flash: function(msg) {
      _record('flash', msg);
      var t = _$("toast"); if (!t) return;
      t.textContent = msg;
      t.className = 'toast-flash show';
      setTimeout(function(){ t.classList.remove("show"); }, 2200);
    },

    /** 驻留提示(需手动关闭) —— 成就/里程碑/重要NPC事件 */
    persist: function(msg, icon) {
      _record('persist', msg);
      var el = document.createElement('div');
      el.className = 'notify-persist show';
      var _safeIcon = icon ? (typeof escHtml==='function'?escHtml(icon):icon) : '';
      el.innerHTML = '<div class="notify-persist-body">' +
        (_safeIcon ? '<span class="notify-icon">' + _safeIcon + '</span>' : '') +
        '<span class="notify-text">' + (typeof escHtml==='function'?escHtml(msg):msg) + '</span>' +
        '<button class="notify-close" onclick="this.parentElement.parentElement.classList.remove(\'show\');setTimeout(function(){this.parentElement.parentElement.remove()}.bind(this),300);">\u2715</button>' +
        '</div>';
      var container = _$('notify-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'notify-container';
        document.body.appendChild(container);
      }
      container.appendChild(el);
    },

    /** 紧急警告(全屏遮罩，必须确认) —— 战争/死亡/灭亡 */
    urgent: function(title, detail, onConfirm) {
      _record('urgent', title + (detail ? ': ' + detail : ''));
      var overlay = document.createElement('div');
      overlay.className = 'notify-urgent';
      overlay.innerHTML = '<div class="notify-urgent-box">' +
        '<div class="notify-urgent-title">' + (typeof escHtml==='function'?escHtml(title):title) + '</div>' +
        (detail ? '<div class="notify-urgent-detail">' + (typeof escHtml==='function'?escHtml(detail):detail) + '</div>' : '') +
        '<button class="notify-urgent-btn">\u673A\u5DF2\u77E5\u6089</button>' +
        '</div>';
      overlay.querySelector('.notify-urgent-btn').onclick = function() {
        overlay.classList.add('closing');
        setTimeout(function(){ overlay.remove(); }, 300);
        if (typeof onConfirm === 'function') onConfirm();
      };
      document.body.appendChild(overlay);
    }
  };
})();

// 保持向后兼容：toast() = NotificationSystem.flash()
function toast(m) { NotificationSystem.flash(m); }
// 便捷别名
function notifyPersist(msg, icon) { NotificationSystem.persist(msg, icon); }
function notifyUrgent(title, detail, onConfirm) { NotificationSystem.urgent(title, detail, onConfirm); }

/** 显示通知历史面板 */
function showNotificationHistory() {
  var hist = NotificationSystem.getHistory();
  var html = '<div style="max-height:400px;overflow-y:auto;">';
  if (hist.length === 0) {
    html += '<div style="text-align:center;color:var(--color-foreground-muted);padding:2rem;">\u6682\u65E0\u901A\u77E5</div>';
  } else {
    hist.slice().reverse().forEach(function(n) {
      var levelLabel = n.level === 'urgent' ? '\u2757' : n.level === 'persist' ? '\u2139' : '\u00B7';
      var levelColor = n.level === 'urgent' ? 'var(--vermillion-400)' : n.level === 'persist' ? 'var(--gold-400)' : 'var(--color-foreground-muted)';
      var timeStr = new Date(n.time).toLocaleTimeString();
      html += '<div style="padding:0.3rem 0;border-bottom:1px solid var(--color-border-subtle);font-size:0.78rem;">';
      html += '<span style="color:' + levelColor + ';">' + levelLabel + '</span> ';
      html += '<span style="color:var(--color-foreground-muted);font-size:0.68rem;">T' + n.turn + ' ' + timeStr + '</span> ';
      html += (typeof escHtml==='function'?escHtml(n.msg):n.msg);
      html += '</div>';
    });
  }
  html += '</div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('\u901A\u77E5\u5386\u53F2', html);
  } else {
    showTurnResult(html);
  }
}

// 通用输入框（替代 prompt）
function showPrompt(message, defaultValue, callback) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--bg-2);padding:1.5rem;border-radius:8px;min-width:300px;max-width:500px;';

  var msg = document.createElement('div');
  msg.textContent = message;
  msg.style.cssText = 'margin-bottom:1rem;color:var(--txt-p);';

  var input = document.createElement('input');
  input.type = 'text';
  input.value = defaultValue || '';
  input.style.cssText = 'width:100%;padding:0.5rem;border:1px solid var(--bg-4);border-radius:4px;background:var(--bg-1);color:var(--txt-p);margin-bottom:1rem;font-family:inherit;';

  var btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.className = 'bt';
  cancelBtn.onclick = function() {
    overlay.remove();
    if (callback) callback(null);
  };

  var okBtn = document.createElement('button');
  okBtn.textContent = '确定';
  okBtn.className = 'bt bp';
  okBtn.onclick = function() {
    var val = input.value;
    overlay.remove();
    if (callback) callback(val);
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      okBtn.click();
    } else if (e.key === 'Escape') {
      cancelBtn.click();
    }
  };

  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(okBtn);
  box.appendChild(msg);
  box.appendChild(input);
  box.appendChild(btnContainer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  setTimeout(function() { input.focus(); }, 100);
}

// ============================================================
// 确定性随机系统（借鉴晚唐风云 seedrandom 思路）
// 同一种子 + 同一调用序列 = 完全相同结果，支持存档重放
// ============================================================
var _rngState = { seed: '', s: 0 };

/** 简单但可重放的伪随机生成器（xorshift32） */
function _xorshift32() {
  var x = _rngState.s;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  _rngState.s = x;
  return (x >>> 0) / 4294967296; // 转为 [0, 1)
}

/** 从字符串种子生成初始状态 */
function _seedToState(seed) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return h === 0 ? 1 : h; // xorshift 不能为 0
}

/** @param {string} [seed] - 随机种子 */
function initRng(seed) {
  _rngState.seed = seed || (Date.now().toString(36) + Date.now().toString(16));
  _rngState.s = _seedToState(_rngState.seed);
  _dbg('[RNG] 初始化种子:', _rngState.seed);
}

/** @returns {{seed:string, s:number}} RNG 状态（存档用） */
function getRngState() { return { seed: _rngState.seed, s: _rngState.s }; }

/** @param {{seed:string, s:number}} state - 保存的 RNG 状态 */
function restoreRng(state) {
  if (state && state.seed) {
    _rngState.seed = state.seed;
    _rngState.s = state.s || _seedToState(state.seed);
  }
}

/**
 * 读取 NPC 认知画像并生成 prompt 就绪片段（由 sc07 在 endturn 生成·随 GM 持久化）
 * 用于回合内 AI 调用（问对/朝议/科议/奏疏回复）为该 NPC 注入"当下信息掌握"。
 * @param {string} name 角色名
 * @param {object} [opts] { short:true 返回 40-60字紧凑版；full 返回 150-200字完整版 }
 * @returns {string} 可直接拼入 prompt 的段落；无数据则返回空字符串
 */
function getNpcCognitionSnippet(name, opts) {
  if (!name || !window.GM || !window.GM._npcCognition) return '';
  var cog = window.GM._npcCognition[name];
  if (!cog) return '';
  var short = opts && opts.short;
  var bits = [];
  // 稳定自我画像（无论 short 都注入——全场景口吻一致之关键）
  if (cog.selfIdentity) bits.push('\u81EA\u8BC6\uFF1A' + cog.selfIdentity);
  if (cog.personalityCore) bits.push('\u4EBA\u683C\uFF1A' + cog.personalityCore);
  if (cog.speechThread) bits.push('\u53E3\u543B\uFF1A' + cog.speechThread);
  if (!short) {
    if (cog.abilityAwareness) bits.push('\u81EA\u77E5\uFF1A' + cog.abilityAwareness);
    if (cog.fiveVirtues) bits.push('\u4E94\u5E38\uFF1A' + cog.fiveVirtues);
    if (cog.historicalVoice) bits.push('\u53F2\u6807\uFF1A' + cog.historicalVoice);
    if (cog.partyClassFeeling) bits.push('\u515A\u9636\uFF1A' + cog.partyClassFeeling);
  }
  // 动态信息
  if (cog.currentFocus) bits.push('\u5FC3\u5FF5\uFF1A' + cog.currentFocus);
  if (cog.attitudeTowardsPlayer) bits.push('\u5BF9\u5E1D\uFF1A' + cog.attitudeTowardsPlayer);
  if (!short) {
    if (Array.isArray(cog.knows) && cog.knows.length) bits.push('\u77E5\uFF1A' + cog.knows.slice(0,3).join('\uFF1B'));
    if (Array.isArray(cog.doesntKnow) && cog.doesntKnow.length) bits.push('\u4E0D\u77E5\uFF1A' + cog.doesntKnow.slice(0,2).join('\uFF1B'));
    if (cog.worldviewShift) bits.push('\u5FC3\u5883\uFF1A' + cog.worldviewShift);
    if (cog.unspokenConcern) bits.push('\u6697\u62C5\uFF1A' + cog.unspokenConcern);
    if (cog.infoAsymmetry) bits.push('\u72EC\u77E5\uFF1A' + cog.infoAsymmetry);
    if (cog.recentMood) bits.push('\u5FC3\u7EEA\uFF1A' + cog.recentMood);
  }
  // 自作文苑作品（文事系统·NPC 对自己的作品应了如指掌）
  if (!short && window.GM && Array.isArray(window.GM.culturalWorks)) {
    var _myW = window.GM.culturalWorks.filter(function(w){return w && w.author === name;});
    if (_myW.length) {
      var _recent = _myW.slice(-5).map(function(w){
        var s = '\u300A' + (w.title||'\u65E0\u9898') + '\u300B';
        if (w.subtype || w.genre) s += '(' + (w.subtype||w.genre) + ')';
        if (w.mood) s += '\u00B7' + w.mood;
        return s;
      }).join('\u3001');
      bits.push('\u81EA\u4F5C\u00B7\u8FD1 ' + _myW.length + ' \u7BC7\uFF1A' + _recent);
    }
    var _dedTo = window.GM.culturalWorks.filter(function(w){return w && Array.isArray(w.dedicatedTo) && w.dedicatedTo.indexOf(name) >= 0;}).slice(-3);
    if (_dedTo.length) bits.push('\u88AB\u8D60\u4F5C\uFF1A' + _dedTo.map(function(w){return w.author+'\u300A'+w.title+'\u300B';}).join('\u3001'));
    var _satire = window.GM.culturalWorks.filter(function(w){return w && w.satireTarget === name;}).slice(-2);
    if (_satire.length) bits.push('\u8BBD\u6211\uFF1A' + _satire.map(function(w){return w.author+'\u300A'+w.title+'\u300B';}).join('\u3001'));
  }

  if (bits.length === 0) return '';
  return '\n\u3010\u8BE5\u81E3\u8BA4\u77E5\u00B7\u81EA\u6211\u753B\u50CF\u00B7\u6587\u4E8B\u7C4D\u5F71\u3011\n' + bits.join('\n') + '\n';
}
if (typeof window !== 'undefined') window.getNpcCognitionSnippet = getNpcCognitionSnippet;

/** @returns {number} 确定性随机数 [0, 1) */
function random() { return _xorshift32(); }

/** @param {number} min @param {number} max @returns {number} [min, max] 闭区间随机整数 */
function randInt(min, max) { return min + Math.floor(random() * (max - min + 1)); }

/** @template T @param {T[]} arr @returns {T[]} 原地洗牌后的数组 */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = randInt(0, i);
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// ============================================================
// 子种子RNG工厂 —— 战斗/阴谋等独立模块用独立种子，不消耗主RNG序列
// ============================================================
/**
 * 创建独立的子RNG（xorshift32），不影响全局 _rngState
 * @param {string} seed - 子种子字符串（如 "battle_T5_长安"）
 * @returns {function():number} 返回 [0,1) 的随机数生成函数
 */
function createSubRng(seed) {
  var s = _seedToState(String(seed));
  return function() {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ============================================================
// 每回合RNG检查点 —— 支持存档重放时从特定回合恢复
// ============================================================
/**
 * 保存当前RNG状态到GM检查点（最多保留最近20个）
 * 在endTurn开头调用
 */
function checkpointRng() {
  if (!GM._rngCheckpoints) GM._rngCheckpoints = [];
  GM._rngCheckpoints.push({ turn: GM.turn, state: getRngState() });
  if (GM._rngCheckpoints.length > 20) GM._rngCheckpoints = GM._rngCheckpoints.slice(-20);
}

// ============================================================
// 时间换算工具 —— 所有机械系统的时间参数统一用"月"作基准，运行时按回合时长缩放
// getTimeRatio() 定义在 tm-dynamic-systems.js（日=1/365, 月=1/12, 季=1/4, 年=1）
// ============================================================

/**
 * 获取每回合天数（统一入口，兼容旧格式）
 * 定义在 tm-utils.js 以确保所有后续文件都能访问
 * @returns {number}
 */
function _getDaysPerTurn() {
  if (!P || !P.time) return 30;
  // 新格式：直接读 daysPerTurn
  if (P.time.daysPerTurn && P.time.daysPerTurn > 0) return P.time.daysPerTurn;
  // 旧格式兼容：从 perTurn 代码转换
  var pt = P.time.perTurn || '1m';
  if (pt === '1d') return 1;
  if (pt === '1w') return 7;
  if (pt === '1m') return 30;
  if (pt === '1s') return 90;
  if (pt === '1y') return 365;
  if (pt === 'custom' && P.time.customDays > 0) return P.time.customDays;
  var num = parseInt(pt);
  if (num > 0) return num;
  return 30;
}

/**
 * 将"月数"换算为"回合数"
 * @param {number} months - 月数（如冷却24个月、停战12个月）
 * @returns {number} 对应的回合数（至少1）
 * @example turnsForMonths(24) → 月制:24回合, 日制:730回合, 季制:8回合, 年制:2回合
 */
/**
 * 月→日→回合：将月数转为回合数
 * 公式：months × 30 / daysPerTurn
 * @param {number} months - 月数（如冷却24个月、停战12个月）
 * @returns {number} 对应的回合数（至少1）
 */
function turnsForMonths(months) {
  if (!months || months <= 0) return 0;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return Math.max(1, Math.ceil(months * 30 / dpv));
}

/**
 * 将"年度速率"换算为"每回合速率"
 * 公式：yearRate / 12 / 30 × daysPerTurn = yearRate × daysPerTurn / 360
 * @param {number} ratePerYear - 年度速率
 * @returns {number} 每回合速率
 */
function ratePerTurn(ratePerYear) {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ratePerYear * dpv / 360;
}

/**
 * 将"月度速率"换算为"每回合速率"
 * 公式：monthRate / 30 × daysPerTurn
 * @param {number} ratePerMonth - 月度速率
 * @returns {number} 每回合速率
 */
function monthlyRatePerTurn(ratePerMonth) {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ratePerMonth * dpv / 30;
}

/**
 * 检测当前回合是否跨越年末
 * @returns {boolean}
 */
function isYearBoundary() {
  if (!P.time) return false;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  if (dpv >= 365) return true; // 年制或更长，每回合都跨年
  var prevDays = (GM.turn - 1) * dpv;
  var curDays = GM.turn * dpv;
  return Math.floor(curDays / 365) > Math.floor(prevDays / 365);
}

/**
 * 将"现实时间描述"转为"当前剧本下的回合数"（至少1）
 * @param {string} duration - 'week'|'month'|'3months'|'season'|'halfyear'|'year'|'3years'|'5years'
 * @returns {number}
 */
function turnsForDuration(duration) {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var daysMap = { 'week':7, 'month':30, '3months':90, 'season':90, 'halfyear':180, 'year':360, '3years':1080, '5years':1800 };
  return Math.max(1, Math.ceil((daysMap[duration] || 30) / dpv));
}

/** 获取当前在位年数（浮点数） */
function getReignYears() {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ((GM.turn || 1) * dpv) / 360;
}

/** 获取游戏模式行为参数 */
function _getModeParams() {
  var mode = (P && P.conf && P.conf.gameMode) || 'yanyi';
  return {
    mode: mode,
    loyaltyClamp: mode === 'strict_hist' ? 10 : mode === 'light_hist' ? 15 : 20,
    strengthClamp: mode === 'strict_hist' ? 5 : mode === 'light_hist' ? 8 : 10,
    echoDelay: mode === 'strict_hist' ? 2.0 : mode === 'light_hist' ? 1.0 : 0.5,
    eventIntensity: mode === 'strict_hist' ? 0.7 : mode === 'light_hist' ? 1.0 : 1.5,
    playerDeathProtection: mode === 'yanyi',
    narrativeStyle: mode === 'strict_hist' ? '仿《资治通鉴》纪事体文言' : mode === 'light_hist' ? '半文言半白话' : '仿《三国演义》章回体'
  };
}

/**
 * 获取每回合天数
 * @returns {number}
 */
function getTurnDays() {
  return (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
}

var _uidSeq = 0;
function uid(){
  _uidSeq = (_uidSeq + 1) % 46656;
  return Date.now().toString(36) + _uidSeq.toString(36).padStart(3, '0') + random().toString(36).slice(2,7);
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
/** prompt 内字数指引——每条发言直接按用户设置范围，不做倍率
 *  category: 'wd'=问对, 'cy'=朝议（默认 cy） */
function _aiDialogueWordHint(category) {
  category = category || 'cy';
  var r = (typeof _getCharRange === 'function') ? _getCharRange(category) : [150, 300];
  return '（每条发言约 ' + r[0] + '-' + r[1] + ' 字）';
}

/** 对话 max_tokens——按 speakerCount 预留 token 预算（保证多人场景每人都写足字数，不互相挤占）
 *  category: 'wd'|'cy'  speakerCount: 本次调用需生成几条发言（默认 1） */
function _aiDialogueTok(category, speakerCount) {
  category = category || 'cy';
  var n = parseInt(speakerCount, 10) || 1;
  var r = (typeof _getCharRange === 'function') ? _getCharRange(category) : [150, 300];
  var perMax = r[1];
  var totalChars = perMax * n;
  // 汉字 → token：约 × 2 + JSON wrapper/思考 buffer
  var tok = Math.max(500, Math.round(totalChars * 2.5));
  try { if (window._dbgDialogueWC) console.log('[对话字数]', category, '×' + n + '人', 'range=', r, '→ tok=', tok); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-utils');}catch(_){}}
  return tok;
}

/** 开关对话字数 debug 日志——在浏览器控制台执行 _toggleDialogueDebug() 开启 */
function _toggleDialogueDebug() {
  window._dbgDialogueWC = !window._dbgDialogueWC;
  console.log('[对话字数 debug]', window._dbgDialogueWC ? '✅ 已开启' : '❌ 已关闭');
  if (window._dbgDialogueWC) {
    console.log('当前档位 verbosity =', P.conf.verbosity);
    console.log('问对自定义值 wdMin/wdMax =', P.conf.wdMin, '/', P.conf.wdMax);
    console.log('朝议自定义值 cyMin/cyMax =', P.conf.cyMin, '/', P.conf.cyMax);
    console.log('生效范围:');
    console.log('  问对 _getCharRange(wd) =', _getCharRange('wd'));
    console.log('  朝议 _getCharRange(cy) =', _getCharRange('cy'));
  }
  return window._dbgDialogueWC;
}

/** 显示数字——保留 1 位小数，四舍五入；整数不显示小数（AI 读取不变，仅 UI 用） */
function _fmtNum1(v){
  if (v === undefined || v === null || v === '') return '0';
  var n = parseFloat(v);
  if (isNaN(n)) return String(v);
  var r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r | 0) : r.toFixed(1);
}
/** 高效深拷贝：优先 structuredClone，回退 JSON */
function deepClone(obj){
  if(obj===null||typeof obj!=='object')return obj;
  try{return structuredClone(obj);}catch(e){return JSON.parse(JSON.stringify(obj));}
}
/** HTML转义：防止 innerHTML 拼接时的 XSS */
function escHtml(s){
  if(s===null||s===undefined)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/**
 * 所在地别名表：同一城市/宫城的多种叫法。
 * 用于 _isSameLocation 匹配——"紫禁城·乾清宫"/"坤宁宫"/"京师·文渊阁"视为同城。
 * 值为 canonical key，key 方有多个别名。
 */
var _LOC_ALIASES = {
  '京城': '京城', '京师': '京城', '北京': '京城', '燕京': '京城', '顺天府': '京城',
  '紫禁城': '京城', '皇城': '京城', '宫中': '京城', '内廷': '京城', '禁中': '京城',
  '南京': '南京', '应天府': '南京', '建康': '南京', '金陵': '南京', '陪都': '南京',
  '盛京': '盛京', '沈阳': '盛京', '赫图阿拉': '盛京', '辽阳': '盛京',
  '杭州': '杭州', '临安': '杭州', '西湖': '杭州',
  '苏州': '苏州', '姑苏': '苏州', '吴中': '苏州',
  '洛阳': '洛阳', '东都': '洛阳',
  '西安': '西安', '长安': '西安',
  '成都': '成都', '蜀京': '成都',
  '汉城': '汉城', '汉阳': '汉城', '首尔': '汉城'
};
/**
 * 把地点字符串规范化到"主地点"——取首段（按 · , /、空格等分割）后查别名表。
 * 例："紫禁城·乾清宫" → "紫禁城" → 查表得 "京城"
 *     "京师·文渊阁" → "京师" → "京城"
 *     "南京·户部衙门" → "南京" → "南京"
 *     "陕西·西安" → "陕西"（未在表中，返回自身）
 */
function _normalizeLocation(loc) {
  if (!loc || typeof loc !== 'string') return '';
  var s = String(loc).trim();
  if (!s) return '';
  // 取首段——按常见分隔符拆分
  var parts = s.split(/[·・\/\,，、\s\-—>→→]+/);
  for (var i = 0; i < parts.length; i++) {
    var p = (parts[i] || '').trim();
    if (!p) continue;
    if (_LOC_ALIASES[p]) return _LOC_ALIASES[p];
    // 别名表覆盖更长前缀（如 "紫禁城·乾清宫"）
    var keys = Object.keys(_LOC_ALIASES);
    for (var k = 0; k < keys.length; k++) {
      if (p.indexOf(keys[k]) === 0) return _LOC_ALIASES[keys[k]];
    }
    return p; // 首段未匹配即返回
  }
  return s;
}
/**
 * 判定两地是否"视为同地"——同城/同宫室都算。
 * 规则：规范化后首段相等；或一方包含另一方的主键（如两者都含"紫禁城"或"京师"）。
 */
function _isSameLocation(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  var na = _normalizeLocation(a);
  var nb = _normalizeLocation(b);
  if (na === nb) return true;
  // 原串相互包含亦算（兜底宽松匹配）
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
  return false;
}

/** 模糊查找角色（精确→去空格标点→前2字唯一→别名→null） */
function _fuzzyFindChar(name) {
  if (!name || !GM.chars) return null;
  var n = name.trim();
  // 1. 精确
  var exact = GM.chars.find(function(c) { return c.name === n; });
  if (exact) return exact;
  // 2. 去空格/标点
  var cleaned = n.replace(/[\s·\-—、，。（）()]/g, '');
  var m2 = GM.chars.find(function(c) { return c.name.replace(/[\s·\-—、，。（）()]/g, '') === cleaned; });
  if (m2) { _dbg('[FuzzyMatch] "' + n + '" → "' + m2.name + '"'); return m2; }
  // 3. 前2字唯一匹配
  if (cleaned.length >= 2) {
    var pf = cleaned.substring(0, 2);
    var pms = GM.chars.filter(function(c) { return c.alive !== false && c.name.indexOf(pf) === 0; });
    if (pms.length === 1) { _dbg('[FuzzyMatch] prefix "' + n + '" → "' + pms[0].name + '"'); return pms[0]; }
  }
  // 4. 别名
  var am = GM.chars.find(function(c) { return c._aliases && c._aliases.indexOf(n) >= 0; });
  if (am) { _dbg('[FuzzyMatch] alias "' + n + '" → "' + am.name + '"'); return am; }
  return null;
}
/** 模糊查找势力 */
function _fuzzyFindFac(name) {
  if (!name || !GM.facs) return null;
  var exact = GM.facs.find(function(f) { return f.name === name; });
  if (exact) return exact;
  var cl = (name || '').replace(/[\s·\-—]/g, '');
  return GM.facs.find(function(f) { return f.name.replace(/[\s·\-—]/g, '') === cl; }) || null;
}

/** 从 AI 响应文本中提取 JSON（4级降级解析，借鉴 ChongzhenSim） */
/** extractJSON —— 保留为 robustParseJSON 的别名（向后兼容） */
function extractJSON(text) { return robustParseJSON(text); }
/** 调试日志：仅在 P.conf.debugLog 为 true 时输出（兼容旧调用，新代码用 DebugLog.log） */
function _dbg(){if(P&&P.conf&&P.conf.debugLog)console.log.apply(console,arguments);}
function gSid(s){var el=_$(s);return el?el.value:(P.scenarios[0]?P.scenarios[0].id:"");}
var _aiProgressTimer=null;
var _LOADING_HINTS=['运筹帷幄之中','决胜千里之外','天下大势，分合有时','时来天地皆同力','万事俱备','风云际会','暗潮涌动','大势将至','变局已生','棋局已布'];
var _loadingMaxPct = 0;  // 单调递增的最大值·防止进度条倒退
function showLoading(msg,pct){
  if (typeof GM !== 'undefined' && GM && GM._isPostTurnCourt && (!GM._pendingShijiModal || GM._pendingShijiModal.courtDone === false)) {
    return;
  }
  _$("loading").classList.add("show");
  _$("loading-sub").textContent=msg||_LOADING_HINTS[Math.floor((typeof random==='function'?random():Math.random())*_LOADING_HINTS.length)];
  if(_aiProgressTimer){clearInterval(_aiProgressTimer);_aiProgressTimer=null;}
  var requestedPct = pct || 5;
  // 单调递增：新 pct 不得低于当前 max·避免不同 sub-call 传入乱序 pct 导致回退
  var cur = Math.max(requestedPct, _loadingMaxPct);
  _loadingMaxPct = cur;
  _$("loading-fill").style.width=cur+"%";
  _aiProgressTimer=setInterval(function(){
    cur+=(Date.now()%7)*0.3+0.2;
    if(cur>95)cur=95;
    _loadingMaxPct = cur;
    _$("loading-fill").style.width=cur+"%";
  },400);
}
function hideLoading(){
  if(_aiProgressTimer){clearInterval(_aiProgressTimer);_aiProgressTimer=null;}
  _$("loading-fill").style.width="100%";
  _loadingMaxPct = 0;  // 重置·下回合从 0 开始
  setTimeout(function(){_$("loading").classList.remove("show");_$("loading-fill").style.width="0%";},250);
}
// ═══ 后朝并发期间·模态排队机制 ═══
// 朝会进行中（_isPostTurnCourt && !courtDone）触发的非史记弹窗（事件/科举/大事记等），
// 先暂存队列；朝会关闭并弹出史记后，按顺序依次 flush
var _postTurnModalQueue = [];
function _isPostTurnActive() {
  return typeof GM !== 'undefined' && GM && GM._isPostTurnCourt === true
      && GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false;
}
function _queuePostTurnModal(fn, label) {
  if (typeof fn !== 'function') return;
  _postTurnModalQueue.push({ fn: fn, label: label || '模态' });
}
function _flushPostTurnModalQueue() {
  if (_postTurnModalQueue.length === 0) return;
  // 依次弹出，每弹一个等待前一个被关闭（简化为 setTimeout 给 UI 时间）
  var q = _postTurnModalQueue.slice();
  _postTurnModalQueue.length = 0;
  var i = 0;
  function _next() {
    if (i >= q.length) return;
    try { q[i].fn(); } catch(_qe) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_qe, 'postTurnModal') : console.warn('[postTurnModal] ' + (q[i].label||'') + ':', _qe); }
    i++;
    // 300ms 后弹下一个·给用户时间看到上一个
    if (i < q.length) setTimeout(_next, 300);
  }
  _next();
}

function showTurnResult(html, idx){
  // 后朝进行中·排队延后（朝会结束后再弹）
  if (typeof _isPostTurnActive === 'function' && _isPostTurnActive()) {
    _queuePostTurnModal(function(){ showTurnResult(html, idx); }, '史记');
    return;
  }
  var body = _$("turn-body"); if (body) body.innerHTML = html;
  // 尝试定位对应 shijiHistory 索引
  if (idx == null && GM.shijiHistory && GM.shijiHistory.length > 0) {
    for (var i = GM.shijiHistory.length - 1; i >= 0; i--) {
      if (GM.shijiHistory[i].html === html) { idx = i; break; }
    }
    if (idx == null) idx = GM.shijiHistory.length - 1; // 新回合
  }
  GM._trCurrentIdx = (typeof idx === 'number') ? idx : null;
  _trPopulateHead();
  _$("turn-modal").classList.add("show");
  // v5·C·装饰 pending 人名为可点击
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(_$("turn-body")); } catch(_){}
}
function closeTurnResult(){_$("turn-modal").classList.remove("show");}

/** 填充弹窗头部（日期/回合/一句话总曰/要闻标签），从 shijiHistory[_trCurrentIdx] 读取 */
function _trPopulateHead(){
  var idx = GM._trCurrentIdx;
  var sj = (idx != null && GM.shijiHistory && GM.shijiHistory[idx]) ? GM.shijiHistory[idx] : null;
  var turnNo = sj ? sj.turn : (GM.turn - 1);
  var dateStr = sj ? (sj.time || '') : (typeof getTSText==='function'?getTSText(GM.turn):'');

  var turnEl = _$("tr-turn-no"); if (turnEl) turnEl.textContent = '\u7B2C ' + turnNo + ' \u56DE \u5408';
  var dateEl = _$("tr-date");
  if (dateEl) {
    var era = (dateStr||'').match(/([\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678][\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5])/);
    var eraStr = era ? era[1] : '';
    var main = dateStr.replace(eraStr, '').trim();
    dateEl.innerHTML = escHtml(main || dateStr) + (eraStr ? ' <span class="tr-era-chip">' + escHtml(eraStr) + '</span>' : '');
  }
  // 一句话总曰
  var sumEl = _$("tr-summary");
  if (sumEl) {
    var sum = sj ? (sj.turnSummary || sj.szjSummary || '') : '';
    if (!sum && sj && sj.shizhengji) sum = (sj.shizhengji.split(/[\u3002\uFF01\n]/)[0] || '').slice(0, 80);
    if (sum) { sumEl.textContent = sum; sumEl.style.display = 'block'; }
    else sumEl.style.display = 'none';
  }
  // 要闻标签
  var critEl = _$("tr-critical");
  if (critEl) {
    var tags = _trDetectCritical(sj);
    if (tags.length > 0) {
      var lh = '<span class="tr-critical-lbl">\u672C \u56DE \u8981 \u95FB</span>';
      tags.forEach(function(t){ lh += '<span class="tr-critical-tag ' + t.cls + '">' + escHtml(t.txt) + '</span>'; });
      critEl.innerHTML = lh; critEl.style.display = 'flex';
    } else { critEl.style.display = 'none'; critEl.innerHTML = ''; }
  }
  // 前后翻阅按钮
  var total = (GM.shijiHistory||[]).length;
  var prev = _$("tr-prev"), next = _$("tr-next");
  if (prev) prev.disabled = !(idx != null && idx > 0);
  if (next) next.disabled = !(idx != null && idx < total - 1);
}

/** 侦测关键事件标签 */
function _trDetectCritical(sj){
  var tags = [];
  if (!sj) return tags;
  var t = (sj.shizhengji||'') + ' ' + (sj.shilu||'') + ' ' + (sj.html||'');
  if (/\u6218\u4E8B|\u6218\u5F79|\u653B\u57CE|\u5927\u6377|\u51FA\u5175|\u65CB\u5E08|\u5931\u9677/.test(t)) tags.push({cls:'war', txt:'\u6218 \u4E8B'});
  if (/\u6B81|\u5D29|\u55E1|\u4EBA\u6BBA|\u75C5\u6B7B|\u81EA\u5208/.test(t)) tags.push({cls:'death', txt:'\u4EBA \u6B81'});
  if (/\u5BC6\u8C0B|\u963F\u8C0B|\u9634\u8C0B|\u8C0B\u907F/.test(t)) tags.push({cls:'scheme', txt:'\u5BC6 \u8C0B'});
  if (/\u515A\u4E89|\u515A\u6D3E|\u4E1C\u6797|\u9609\u515A/.test(t)) tags.push({cls:'faction', txt:'\u515A \u4E89'});
  if (/\u65F1\u707E|\u6D2A\u707E|\u96EA\u707E|\u9707\u707E|\u75AB|\u7792|\u5929\u706B|\u5730\u9707|\u5929\u5E1D\u6C44/.test(t)) tags.push({cls:'calamity', txt:'\u707E \u5F02'});
  return tags.slice(0, 4);
}

/** 前后回合翻阅 */
function _trNavTurn(dir){
  if (GM._trCurrentIdx == null || !GM.shijiHistory) return;
  var newIdx = GM._trCurrentIdx + dir;
  if (newIdx < 0 || newIdx >= GM.shijiHistory.length) return;
  showTurnResult(GM.shijiHistory[newIdx].html || '', newIdx);
}

/** 导出本回 */
function _trExportCurrent(){
  var idx = GM._trCurrentIdx;
  var sj = (idx != null && GM.shijiHistory && GM.shijiHistory[idx]) ? GM.shijiHistory[idx] : null;
  if (!sj) { if (typeof toast === 'function') toast('\u65E0\u53EF\u5BFC\u51FA\u6570\u636E'); return; }
  var txt = '[T' + sj.turn + '] ' + (sj.time||'') + '\n';
  if (sj.szjTitle) txt += '\n【' + sj.szjTitle + '】\n';
  if (sj.turnSummary) txt += '\u603B\u66F0\uFF1A' + sj.turnSummary + '\n';
  if (sj.shilu) txt += '\n\u3010\u5B9E\u5F55\u3011\n' + sj.shilu + '\n';
  if (sj.shizhengji) txt += '\n\u3010\u65F6\u653F\u8BB0\u3011\n' + sj.shizhengji + '\n';
  if (sj.zhengwen) txt += '\n\u3010\u653F\u6587\u3011\n' + sj.zhengwen + '\n';
  if (sj.houren) txt += '\n\u3010\u540E\u4EBA\u620F\u8BF4\u3011\n' + sj.houren + '\n';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function(){ if(typeof toast==='function')toast('\u5DF2\u590D\u5236'); }).catch(function(){ _trDownloadTxt(txt, sj.turn); });
  } else _trDownloadTxt(txt, sj.turn);
}
function _trDownloadTxt(txt, turn){
  var a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='shiji_T'+turn+'.txt';a.click();
  if (typeof toast === 'function') toast('\u5DF2\u5BFC\u51FA');
}
function saveP(){
  // 1. 写入 IndexedDB（主存储，无容量限制）
  if (typeof TM_SaveDB !== 'undefined') {
    TM_SaveDB.saveProject(deepClone(P)).catch(function(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveP') : console.warn('[saveP] IndexedDB写入失败:', e); });
  }
  // 2. 写入 localStorage 骨架（轻量，<10KB，用于快速启动）
  try {
    var lite = {
      scenarios: (P.scenarios || []).map(function(s) { return {id:s.id, name:s.name, era:s.era, role:s.role}; }),
      ai: P.ai,
      _hasFullData: true // 标记：完整数据在IndexedDB
    };
    localStorage.setItem('tm_P_lite', JSON.stringify(lite));
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveP] localStorage骨架写入失败:') : console.warn('[saveP] localStorage骨架写入失败:', e); }
  // 3. 桌面端额外保存
  if (window.tianming && window.tianming.isDesktop) {
    window.tianming.autoSave(P).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveP] desktop failed:') : console.warn('[saveP] desktop failed:', e); });
  }
}

// 启动时恢复P（三层恢复：localStorage骨架 → IndexedDB完整 → 桌面端autoSave）
(function _restoreP(){
  // 层1: localStorage 骨架（同步，秒级启动）
  try {
    // 尝试旧格式 tm_P
    var s = localStorage.getItem('tm_P');
    if (s) {
      var saved = JSON.parse(s);
      for (var key in saved) {
        if (saved.hasOwnProperty(key)) P[key] = saved[key];
      }
      console.log('[restoreP] 从localStorage(tm_P)恢复, scenarios:', P.scenarios.length);
      // 迁移：旧格式存在则写入IndexedDB并清理
      if (typeof TM_SaveDB !== 'undefined') {
        TM_SaveDB.saveProject(deepClone(P)).then(function() {
          try { localStorage.removeItem('tm_P'); } catch(e) {}
          console.log('[restoreP] 已迁移tm_P到IndexedDB');
        });
      }
    } else {
      // 新格式：从lite骨架恢复API配置 (R153 包内 try·防嵌套被外层 catch 误吞)
      var lite = null;
      try { lite = localStorage.getItem('tm_P_lite'); } catch(_){}
      if (lite) {
        var liteData = JSON.parse(lite);
        if (liteData.ai) P.ai = liteData.ai;
        console.log('[restoreP] 从localStorage骨架恢复AI配置');
      }
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'restoreP] localStorage恢复失败:') : console.warn('[restoreP] localStorage恢复失败:', e); }

  // 层2: IndexedDB 完整数据（异步，覆盖骨架）
  if (typeof TM_SaveDB !== 'undefined') {
    TM_SaveDB.loadProject().then(function(fullP) {
      if (fullP && fullP.scenarios) {
        for (var key in fullP) {
          if (fullP.hasOwnProperty(key)) P[key] = fullP[key];
        }
        console.log('[restoreP] 从IndexedDB恢复完整P, scenarios:', P.scenarios.length);
        // 如果已在剧本管理页，刷新显示
        if (typeof showScnManage === 'function' && document.querySelector('.scn-page.show')) {
          showScnManage();
        }
      }
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'restoreP] IndexedDB恢复失败:') : console.warn('[restoreP] IndexedDB恢复失败:', e); });
  }

  // 层3: 桌面端 autoSave
  if (window.tianming && window.tianming.isDesktop) {
    window.tianming.loadAutoSave().then(function(r) {
      if (r && r.success && r.data && r.data.scenarios) {
        for (var key in r.data) {
          if (r.data.hasOwnProperty(key) && key !== 'gameState' && key !== '_saveMeta') {
            P[key] = r.data[key];
          }
        }
        console.log('[restoreP] 从desktop autoSave补充恢复');
      }
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'restoreP] desktop恢复失败:') : console.warn('[restoreP] desktop恢复失败:', e); });
  }
})();

// 通用AI调用
function _buildAIUrl(base){
  var u=(base||P.ai.url||"").replace(/\/+$/,"");
  if(!u)return u;
  if(u.indexOf("/chat/completions")>=0||u.indexOf("/messages")>=0)return u;
  return u+"/chat/completions";
}

// M3·判断次 API 是否配置完整且已启用·供调用方决定是否走次 tier
function _useSecondaryTier() {
  if (typeof P === 'undefined' || !P.ai || !P.ai.secondary) return false;
  if (!P.ai.secondary.key || !P.ai.secondary.url) return false;
  // 启用开关·默认 true（保持旧行为）·显式 false 则关闭
  if (P.conf && P.conf.secondaryEnabled === false) return false;
  return true;
}

// M3·按 tier 获取 AI 配置·secondary 未配时回退 primary
// tier: 'primary'|'secondary'·默认 primary
function _getAITier(tier) {
  var _s = P.ai && P.ai.secondary;
  if (tier === 'secondary' && _s && _s.key && _s.url) {
    return {
      key: _s.key,
      url: _s.url,
      model: _s.model || P.ai.model || 'gpt-4o-mini',
      tier: 'secondary'
    };
  }
  return {
    key: (P.ai && P.ai.key) || '',
    url: (P.ai && P.ai.url) || '',
    model: (P.ai && P.ai.model) || 'gpt-4o',
    tier: 'primary'
  };
}
function _buildAIUrlForTier(tier) {
  var cfg = _getAITier(tier);
  var u = (cfg.url || '').replace(/\/+$/, '');
  if (!u) return u;
  if (u.indexOf('/chat/completions') >= 0 || u.indexOf('/messages') >= 0) return u;
  return u + '/chat/completions';
}
