// @ts-check
// ============================================================
// tm-time-utils.js — 时间一等公民系统（2026-04-30 Phase 4.1）
//
// 设计来源：Horae 插件的 timeUtils.js（472 行）·适配天命语境
//
// 天命已有：_getDaysPerTurn()·turnsForDuration()·turnsForMonths()
// 缺的是：把回合 → 干支年月日 + 相对时间口语化（"上个月初十/3年前"）+ 时辰季节
//
// 核心思想（Horae）：
// > AI 把"3 天前"说成"昨天"·原因是它看不到"3 天 = 跨周/跨月/前回合"的语义
// > 解决：每个事件挂相对时间括号·sc1 prompt 注入"时间参考"行
// ============================================================

(function(global) {
  'use strict';

  // ────── 干支 ──────
  var TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var DIZHI   = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var ZODIAC  = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var SEASONS = ['冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬', '冬'];
  var MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

  // 十二地支时辰映射（24 小时制·与 Horae 同款）
  var EARTHLY_BRANCH_HOURS = {
    '子': 23, '丑': 1, '寅': 3, '卯': 5, '辰': 7, '巳': 9,
    '午': 11, '未': 13, '申': 15, '酉': 17, '戌': 19, '亥': 21
  };

  function _getDaysPerTurn_() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn();
    return 30;
  }

  // 读起始年（剧本起始年·没有则用回合 1 = 公元 1 年作占位）
  function _getStartYear() {
    if (typeof P !== 'undefined' && P && P.time && P.time.startYear) return P.time.startYear;
    if (typeof GM !== 'undefined' && GM && GM._startYear) return GM._startYear;
    if (typeof findScenarioById === 'function' && typeof GM !== 'undefined' && GM && GM.sid) {
      try {
        var sc = findScenarioById(GM.sid);
        if (sc && sc.startYear) return sc.startYear;
      } catch(_e){}
    }
    return 1;
  }

  // ────── 1. 回合 → 绝对日期 ──────
  // 把 turn=N 转为 {year, month, day, gan, zhi, season, monthLabel}
  function turnToDate(turn) {
    if (turn == null) turn = (typeof GM !== 'undefined' && GM && GM.turn) || 1;
    var dpv = _getDaysPerTurn_();
    var startYear = _getStartYear();
    // 回合开始那天·距离剧本起点的天数
    var daysFromStart = (turn - 1) * dpv;
    var startDateMs = new Date(startYear, 0, 1).getTime();
    var d = new Date(startDateMs + daysFromStart * 86400000);
    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var ganIdx = ((year - 4) % 10 + 10) % 10;
    var zhiIdx = ((year - 4) % 12 + 12) % 12;
    return {
      year: year,
      month: month,
      day: day,
      gan: TIANGAN[ganIdx],
      zhi: DIZHI[zhiIdx],
      ganzhi: TIANGAN[ganIdx] + DIZHI[zhiIdx],
      zodiac: ZODIAC[zhiIdx],
      season: SEASONS[month - 1],
      monthLabel: MONTH_CN[month - 1] || String(month),
      daysFromStart: daysFromStart
    };
  }

  // ────── 2. 相对时间口语化（核心 Horae 借鉴） ──────
  // 根据"现在 - 之前"的天数差·返回口语化表达
  function formatRelativeTime(thenTurn, nowTurn) {
    if (thenTurn == null || nowTurn == null) return '';
    if (thenTurn === nowTurn) return '本回合';
    var dpv = _getDaysPerTurn_();
    var diffDays = (nowTurn - thenTurn) * dpv;
    var future = diffDays < 0;
    diffDays = Math.abs(diffDays);

    // < 1 天
    if (diffDays < 1) return future ? '即刻' : '今日';
    // 0 < diffDays <= 7
    if (diffDays <= 1) return future ? '明日' : '昨日';
    if (diffDays <= 2) return future ? '后日' : '前日';
    if (diffDays <= 3) return future ? '三日后' : '三日前';
    if (diffDays <= 7) return future ? Math.round(diffDays) + '日后' : Math.round(diffDays) + '日前';
    // 7 < diffDays <= 14
    if (diffDays <= 14) return future ? '下旬' : '上旬';
    // 14 < diffDays <= 60
    if (diffDays <= 60) {
      var months = Math.round(diffDays / 30);
      return future ? months + '月后' : months + '月前';
    }
    // 60 < diffDays <= 365
    if (diffDays <= 365) {
      var months2 = Math.round(diffDays / 30);
      return future ? months2 + '月后' : months2 + '月前';
    }
    // > 365
    var years = Math.floor(diffDays / 365);
    var leftMonths = Math.round((diffDays - years * 365) / 30);
    var s = years + '年';
    if (leftMonths > 0 && leftMonths < 12) s += leftMonths + '月';
    return future ? s + '后' : s + '前';
  }

  // ────── 3. 时辰转换 ──────
  function getShichen(hour24) {
    if (hour24 == null || hour24 < 0) return '';
    var h = hour24 % 24;
    // 子时 23-1
    if (h >= 23 || h < 1) return '子';
    var keys = Object.keys(EARTHLY_BRANCH_HOURS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var s = EARTHLY_BRANCH_HOURS[k];
      var e = (s + 2) % 24;
      if (s < e) {
        if (h >= s && h < e) return k;
      } else {
        if (h >= s || h < e) return k;
      }
    }
    return '';
  }

  // ────── 4. 描述当前回合（一句话） ──────
  // 例如："皇明十一年正月辛酉·春·龙年" 或 "T15·公元 1611 春正月"
  function describeCurrentTurn(turn) {
    if (turn == null) turn = (typeof GM !== 'undefined' && GM && GM.turn) || 1;
    var d = turnToDate(turn);
    var era = '';
    if (typeof GM !== 'undefined' && GM && GM.eraName) era = GM.eraName;
    else if (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.dynasty) era = P.playerInfo.dynasty;
    var parts = [];
    parts.push('T' + turn);
    if (era) parts.push(era);
    parts.push(d.year + '年' + d.monthLabel + '月');
    parts.push(d.ganzhi + '年');
    parts.push(d.season);
    return parts.join('·');
  }

  // ────── 5. 注入到 prompt 的"时间参考"段（Horae 风格） ──────
  // 在 sc1/sc15/sc2 prompt 顶部注入·让 AI 一眼看到"上回合=何时·上月=T几·年初=T几"
  function buildTimeReferenceBlock() {
    if (typeof GM === 'undefined' || !GM) return '';
    var nowTurn = GM.turn || 1;
    var nowDate = turnToDate(nowTurn);
    var lines = [];
    lines.push('=== 时间参考（防止 AI 把"3 天前"说成"昨天"） ===');
    lines.push('[当前] T' + nowTurn + ' = ' + nowDate.year + '年' + nowDate.monthLabel + '月·' + nowDate.ganzhi + '年·' + nowDate.season + '季');
    // 列出近 10 个关键回合
    var refs = [];
    if (nowTurn > 1) refs.push({ t: nowTurn - 1, label: '上回合' });
    if (nowTurn > 3) refs.push({ t: nowTurn - 3, label: '三回合前' });
    var dpv = _getDaysPerTurn_();
    var monthsPerTurn = dpv / 30;
    var turnsPerYear = Math.max(1, Math.round(360 / dpv));
    if (turnsPerYear < nowTurn) refs.push({ t: nowTurn - turnsPerYear, label: '一年前' });
    if (turnsPerYear * 3 < nowTurn) refs.push({ t: nowTurn - turnsPerYear * 3, label: '三年前' });
    if (turnsPerYear * 5 < nowTurn) refs.push({ t: nowTurn - turnsPerYear * 5, label: '五年前' });
    refs.forEach(function(r) {
      var d = turnToDate(r.t);
      lines.push('[' + r.label + '] T' + r.t + ' = ' + d.year + '年' + d.monthLabel + '月·' + d.ganzhi + '年·' + d.season + '季');
    });
    lines.push('=== 此后引用任何过去事件·必须用相对时间括号（如"三年前"·"上月"·"去岁春"） ===');
    return lines.join('\n') + '\n';
  }

  // ────── 6. 给事件挂相对时间标注 ──────
  // 输入 "T15: 沈炼背叛"·当前 turn 20·返回 "T15(五月前): 沈炼背叛"
  function annotateRelativeTime(text, eventTurn, nowTurn) {
    if (!text || eventTurn == null) return text || '';
    if (nowTurn == null) nowTurn = (typeof GM !== 'undefined' && GM && GM.turn) || 1;
    var rel = formatRelativeTime(eventTurn, nowTurn);
    if (!rel || rel === '本回合') return text;
    return text.replace(/T(\d+)/, 'T$1(' + rel + ')');
  }

  // ────── 暴露 ──────
  global.TimeUtils = {
    TIANGAN: TIANGAN,
    DIZHI: DIZHI,
    ZODIAC: ZODIAC,
    SEASONS: SEASONS,
    MONTH_CN: MONTH_CN,
    turnToDate: turnToDate,
    formatRelativeTime: formatRelativeTime,
    getShichen: getShichen,
    describeCurrentTurn: describeCurrentTurn,
    buildTimeReferenceBlock: buildTimeReferenceBlock,
    annotateRelativeTime: annotateRelativeTime
  };
  global._formatRelativeTime = formatRelativeTime;
  global._buildTimeRef = buildTimeReferenceBlock;
  global._describeCurrentTurn = describeCurrentTurn;
})(typeof window !== 'undefined' ? window : this);
