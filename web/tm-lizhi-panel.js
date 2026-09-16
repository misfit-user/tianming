// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 吏治（腐败）详情面板 · 天下污浊图
// 见 设计方案-腐败系统.md §5.3
// 数据来源：GM.corruption
// ═══════════════════════════════════════════════════════════════

// 跳转中间栏标签页（取代原操作按钮）
function _lizhiTabJump(label, tabId) {
  var safeLabel = String(label).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
    'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '→ <b>' + safeLabel + '</b>（切至标签页处理）' +
  '</div>';
}

// ─── 通用墨点渲染（0-100 → 0-4 dots）───
function renderInkDots(value, maxSev) {
  // value 越高越"浊"（腐败高=吏治差）
  var v = Math.max(0, Math.min(100, value || 0));
  var filled = v < 25 ? 0 :
               v < 50 ? 1 :
               v < 70 ? 2 :
               v < 85 ? 3 : 4;
  var severity = filled === 0 ? 1 :    // 清明 → 绿
                 filled === 1 ? 2 :    // 尚可 → 灰
                 filled === 2 ? 3 :    // 渐弊 → 深灰
                 filled === 3 ? 4 :    // 颓靡 → 暗金
                                5;     // 积重 → 朱红
  var html = '<span class="vd-ink-dots severity-' + severity + '">';
  for (var i = 0; i < 4; i++) {
    html += '<span class="dot' + (i < filled ? ' filled' : '') + '"></span>';
  }
  html += '</span>';
  return html;
}

// R87 阶段 2 迁移示范：getLizhiPhase / getTrendSymbol / getCorrVisibility
// 用 function 声明定义主体·然后 TM.Lizhi.xxx = xxx 作引用（非包装）
// 避免：tm-namespaces.js 后来 facade 替换 TM.Lizhi 时 getter 回指 window 导致循环
function getLizhiPhase(value) {
  var v = value || 0;
  if (v < 25) return { name:'清明', cls:'clean' };
  if (v < 50) return { name:'尚可', cls:'okay' };
  if (v < 70) return { name:'渐弊', cls:'fading' };
  if (v < 85) return { name:'颓靡', cls:'rotting' };
  return { name:'积重', cls:'hopeless' };
}

function getTrendSymbol(trend) {
  if (trend === 'rising' || trend === 'up')     return { sym:'▲▲', cls:'rising' };
  if (trend === 'falling' || trend === 'down')  return { sym:'▼', cls:'falling' };
  return { sym:'—', cls:'stable' };
}

// ─── 监察可见度档次 ───
function getCorrVisibility() {
  var sup = ((GM.corruption || {}).supervision || {}).level || 0;
  if (sup >= 80) return 'accurate';
  if (sup >= 50) return 'moderate';
  if (sup >= 20) return 'vague';
  return 'blind';
}

// 同步挂到 TM.Lizhi·引用·非包装·后续 facade 读 window[name] 时拿到同一函数
window.TM = window.TM || {}; window.TM.Lizhi = window.TM.Lizhi || {};
TM.Lizhi.getLizhiPhase = getLizhiPhase;
TM.Lizhi.getTrendSymbol = getTrendSymbol;
TM.Lizhi.getCorrVisibility = getCorrVisibility;

// ─── 开启面板 ───
function openCorruptionPanel() {
  var ov = document.getElementById('lizhi-drawer-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'lizhi-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="lizhi-drawer">'+
      '<div class="var-drawer-header">'+
        '<div>'+
          '<div class="var-drawer-title">吏治之察 · 天下污浊图</div>'+
          '<div class="var-drawer-subtitle" id="lizhi-subtitle"></div>'+
        '</div>'+
        '<button class="var-drawer-close" onclick="closeCorruptionPanel()">×</button>'+
      '</div>'+
      '<div class="var-drawer-body" id="lizhi-body"></div>'+
    '</div>';
    ov.addEventListener('click', function(e) {
      if (e.target === ov) closeCorruptionPanel();
    });
    document.body.appendChild(ov);
  }
  renderCorruptionPanel();
  ov.classList.add('open');
}

function closeCorruptionPanel() {
  var ov = document.getElementById('lizhi-drawer-ov');
  if (ov) ov.classList.remove('open');
}

// ─── 面板主渲染 ───
function renderCorruptionPanel() {
  var body = document.getElementById('lizhi-body');
  var subt = document.getElementById('lizhi-subtitle');
  if (!body) return;

  var c = GM.corruption || {};
  var trueIdx = typeof c.trueIndex === 'number' ? c.trueIndex : (typeof c.overall === 'number' ? c.overall : 0);
  var perc = c.perceivedIndex !== undefined ? c.perceivedIndex : trueIdx;
  var sup = (c.supervision || {}).level || 0;
  var visibility = getCorrVisibility();
  var phaseT = getLizhiPhase(trueIdx);
  var phaseP = getLizhiPhase(perc);

  // 副标题
  if (subt) {
    subt.textContent = '监察 ' + sup + '·' +
      (visibility === 'accurate' ? '洞察' :
       visibility === 'moderate' ? '略知' :
       visibility === 'vague'    ? '朦胧' : '蒙蔽');
  }

  var html = '';

  // ─── § 总览 ───
  html += '<section class="vd-section">';
  html += '<div class="vd-overview">';
  html += '<div class="vd-ov-row">'+
          '<span class="vd-ov-label">朝廷视野</span>'+
          '<span class="vd-ov-value">' + renderInkDots(perc) +
            '&nbsp;<span class="vd-ov-phase">' + phaseP.name + '</span></span>'+
          '</div>';

  // 真实值仅监察 ≥ 50 显示
  if (visibility === 'accurate' || visibility === 'moderate') {
    html += '<div class="vd-ov-row">'+
            '<span class="vd-ov-label">真实浊度</span>'+
            '<span class="vd-ov-value">' + renderInkDots(trueIdx) +
              '&nbsp;<span class="vd-ov-phase">' + phaseT.name + '</span></span>'+
            '</div>';
    var gap = Math.abs(Math.round(trueIdx - perc));
    if (gap > 10) {
      html += '<div class="vd-ov-row">'+
              '<span class="vd-ov-label">粉饰差距</span>'+
              '<span class="vd-ov-value" style="color:var(--vermillion-400);">Δ' + gap + '（地方粉饰）</span>'+
              '</div>';
    }
  } else {
    html += '<div style="font-size:0.72rem;color:var(--txt-d);font-style:italic;margin-top:4px;">监察不足，实情不详——仅据地方所奏</div>';
  }
  html += '</div>';
  html += '</section>';

  // ─── § 监察力度 ───
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">监察力度 <span class="vd-badge">' + sup + ' / 100</span></div>';
  html += '<div class="vd-meter"><div class="vd-meter-fill" style="width:' + sup + '%;"></div></div>';
  var supHint = visibility === 'accurate' ? '御史布于郡县，百官无所遁形' :
                visibility === 'moderate' ? '常设监察，地方尚有粉饰余地' :
                visibility === 'vague'    ? '监察松弛，地方报喜不报忧' :
                                            '御史缺员，朝廷如盲人摸象';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);margin-top:4px;">' + supHint + '</div>';
  html += '</section>';

  // ─── § 三数对照（税收流向）───
  if (GM.guoku && GM.guoku.monthlyIncome > 0) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">税赋三数 <span class="vd-badge">名义 / 实收 / 民缴</span></div>';
    html += renderTaxThreeNumberBlock(GM.guoku.monthlyIncome, {
      label: '正赋钱粮 · 月入',
      unit: '两'
    });
    html += '</section>';
  }

  // ─── § 六部门分项 ───
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">部门污浊分布 <span class="vd-badge">监察越强 · 数字越准</span></div>';
  var sd = c.subDepts || {};
  var deptList = [
    ['central',    '京察'],
    ['provincial', '地方'],
    ['military',   '军队'],
    ['fiscal',     '税司'],
    ['judicial',   '司法'],
    ['imperial',   '内廷']
  ];
  for (var i = 0; i < deptList.length; i++) {
    var key = deptList[i][0], name = deptList[i][1];
    var d = sd[key] || {};
    var val = (visibility === 'accurate' || visibility === 'moderate')
              ? (d.true !== undefined ? d.true : 0)
              : (d.perceived !== undefined ? d.perceived : 0);
    var ph = getLizhiPhase(val);
    var tr = getTrendSymbol(d.trend);
    html += '<div class="vd-dept-row">'+
            '<span class="vd-dept-name">' + name + '</span>'+
            renderInkDots(val) +
            '<span class="vd-dept-phase">' + ph.name + '</span>'+
            '<span class="vd-dept-trend ' + tr.cls + '">' + tr.sym + '</span>'+
            '</div>';
  }
  html += '</section>';

  // ─── § 监察机构 ───
  html += '<section class="vd-section">';
  var insts = (c.supervision || {}).institutions || [];
  html += '<div class="vd-section-title">监察机构 <span class="vd-badge">' + insts.length + ' 个</span></div>';
  if (insts.length === 0) {
    html += '<div class="vd-empty">未设监察机构——可在制度设计中创设御史台/都察院/巡按等</div>';
  } else {
    for (var j = 0; j < insts.length; j++) {
      var inst = insts[j];
      html += '<div class="vd-inst-row">'+
              '<div>'+
                '<div class="vd-inst-name">' + (inst.name || '未命名') + '</div>'+
                '<div class="vd-inst-meta">覆盖：' + ((inst.coverage || []).join('/')||'—') + ' · 独立 ' + (inst.independence||0) + '</div>'+
              '</div>'+
              '<div class="vd-inst-stats">'+
                '腐败 ' + (inst.corruption || 0) + '<br>'+
                '缺员 ' + Math.round((inst.vacancies || 0) * 100) + '%'+
              '</div>'+
              '</div>';
    }
  }
  html += '</section>';

  // ─── § 待决弹章（activeCases 优先）───
  var activeCases = (c.activeCases || []).slice().reverse();
  if (activeCases.length > 0) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title" style="color:var(--vermillion-400);">待决弹章 <span class="vd-badge">' + activeCases.length + ' 件 · 超期即有代价</span></div>';
    for (var a = 0; a < activeCases.length; a++) {
      var ac = activeCases[a];
      var sevLbl = ac.severity === 'major' ? '大案' : ac.severity === 'moderate' ? '中案' : '小案';
      var turnsLeft = (ac.expireTurn || 0) - GM.turn;
      html += '<div class="vd-case-row" data-cred="high" style="border-left-color:var(--vermillion-400);">'+
              '<div class="vd-case-title">' + _escHtml(ac.text) + '</div>'+
              '<div class="vd-case-meta">'+
                '<span>' + sevLbl + ' · ' + (ac.dept || '') + '</span>'+
                '<span class="vd-case-cred high">待决</span>'+
                '<span>' + (turnsLeft > 0 ? '余 ' + turnsLeft + ' 月' : '已逾期') + '</span>'+
              '</div>'+
              '</div>';
    }
    html += _lizhiTabJump('到【奏疏】批答待决弹章', 'gt-memorial');
    html += '</section>';
  }

  // ─── § 近期弹章（从风闻录事过滤）───
  html += '<section class="vd-section">';
  var cases = _collectRecentCases();
  html += '<div class="vd-section-title">近期风闻 <span class="vd-badge">' + cases.length + ' 条</span></div>';
  if (cases.length === 0) {
    html += '<div class="vd-empty">暂无相关风闻——或监察力度不足以察觉</div>';
  } else {
    for (var k = 0; k < cases.length; k++) {
      var ca = cases[k];
      var credCls = ca.credibility || 'medium';
      var credLbl = credCls === 'high'   ? '可信' :
                    credCls === 'medium' ? '参考' :
                    credCls === 'low'    ? '风闻' :
                                           '偏颇';
      html += '<div class="vd-case-row" data-cred="' + credCls + '">'+
              '<div class="vd-case-title">' + _escHtml(ca.text) + '</div>'+
              '<div class="vd-case-meta">'+
                '<span>' + (ca.type || '弹章') + '</span>'+
                '<span class="vd-case-cred ' + credCls + '">' + credLbl + '</span>'+
                '<span>' + (ca.time || 'T' + (ca.turn || '?')) + '</span>'+
              '</div>'+
              '</div>';
    }
    html += _lizhiTabJump('到【奏疏】处理风闻弹章', 'gt-memorial');
  }
  html += '</section>';

  // ─── § 当前状态摘要（只读） ───
  var juannaActive = GM.juanna && GM.juanna.active;
  if (juannaActive) {
    html += '<section class="vd-section">';
    html += '<div style="padding:5px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.76rem;">'+
      '⚠ 捐纳（卖官）已开——月入 ' + Math.round(GM.juanna.monthlyIncome/1000) + ' 千两 · 长期腐败'+
      '</div>';
    html += '</section>';
  }

  // ─── § 如何措置（跳转中间标签页） ───
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">如何措置</div>';
  html += _lizhiTabJump('写诏（派钦差/肃贪/俸禄改革/开罢捐纳/酷吏/特务 皆由诏令发起）', 'gt-edict');
  html += _lizhiTabJump('看奏疏（御史/监察/科道 的弹劾与建言）', 'gt-memorial');
  html += _lizhiTabJump('问对御史大夫/都察院 察朝政风气', 'gt-wendui');
  html += _lizhiTabJump('朝议（设特务机构/肃贪运动 等重大争议）', 'gt-chaoyi');
  html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:6px;">※ AI 按当前腐败/民心/皇权/派系局势推演诏令结果（含党争反噬、冤狱、清流士人心离等副作用）。</div>';
  html += '</section>';

  // ─── § 盘根错节腐败集团（若存在） ───
  var factions = c.entrenchedFactions || [];
  if (factions.length > 0) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title" style="color:var(--vermillion-400);">⚠ 腐败集团 <span class="vd-badge">' + factions.length + ' 个</span></div>';
    for (var f = 0; f < factions.length; f++) {
      var fac = factions[f];
      html += '<div class="vd-case-row" data-cred="biased">'+
              '<div class="vd-case-title">' + (fac.name || '某集团') + '</div>'+
              '<div class="vd-case-meta">'+
                '<span>部门：' + (fac.dept || '—') + '</span>'+
                '<span>势力：' + (fac.strength || 0) + '</span>'+
                '<span>历时：' + (fac.years || 0) + ' 年</span>'+
              '</div>'+
              '</div>';
    }
    html += '</section>';
  }

  // ─── § 历史趋势（SVG 折线图）───
  html += _lizhi_renderTrendSection();

  body.innerHTML = html;
}

// ─── 趋势图渲染（全局+六部门）───
function _lizhi_renderTrendSection() {
  var snapshots = ((GM.corruption && GM.corruption.history && GM.corruption.history.snapshots) || []);
  if (snapshots.length < 2) {
    return '<section class="vd-section">'+
      '<div class="vd-section-title">历史趋势 <span class="vd-badge">待累积</span></div>'+
      '<div class="vd-empty">需至少 2 回合数据方可展示趋势</div>'+
    '</section>';
  }

  // 只展示最近 60 条
  var data = snapshots.slice(-60);
  var W = 400, H = 120, PAD = { l: 28, r: 8, t: 8, b: 22 };
  var innerW = W - PAD.l - PAD.r;
  var innerH = H - PAD.t - PAD.b;

  // 构造多条线：全局真实/全局感知
  var maxTurn = data[data.length - 1].turn;
  var minTurn = data[0].turn;
  var spanT = Math.max(1, maxTurn - minTurn);

  function xOf(t) { return PAD.l + (t - minTurn) / spanT * innerW; }
  function yOf(v) { return PAD.t + (1 - v / 100) * innerH; }

  function linePath(pts) {
    return pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');
  }

  var truePts = data.map(function(d) { return [xOf(d.turn), yOf(d.trueIndex)]; });
  var percPts = data.map(function(d) { return [xOf(d.turn), yOf(d.perceivedIndex)]; });

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">';
  // 背景刻度
  [0, 25, 50, 75, 100].forEach(function(v) {
    var y = yOf(v);
    svg += '<line x1="' + PAD.l + '" y1="' + y + '" x2="' + (W - PAD.r) + '" y2="' + y +
           '" stroke="rgba(184,154,83,0.1)" stroke-width="1"/>';
    svg += '<text x="4" y="' + (y + 3) + '" font-size="9" fill="var(--txt-d)">' + v + '</text>';
  });
  // 段位分隔横线
  var phaseLines = [
    { v: 25, label: '清明', color: '#6aa88a' },
    { v: 50, label: '尚可', color: '#9d917d' },
    { v: 70, label: '渐弊', color: '#8a6d2b' },
    { v: 85, label: '颓靡', color: 'var(--vermillion-400)' }
  ];
  phaseLines.forEach(function(p) {
    svg += '<line x1="' + PAD.l + '" y1="' + yOf(p.v) + '" x2="' + (W - PAD.r) + '" y2="' + yOf(p.v) +
           '" stroke="' + p.color + '" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.4"/>';
  });
  // 感知线（虚线，金色）
  svg += '<path d="' + linePath(percPts) + '" fill="none" stroke="var(--gold-400)" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.7"/>';
  // 真实线（实线，朱红）
  svg += '<path d="' + linePath(truePts) + '" fill="none" stroke="var(--vermillion-400)" stroke-width="2"/>';

  // x 轴标签（起止 turn）
  svg += '<text x="' + PAD.l + '" y="' + (H - 6) + '" font-size="9" fill="var(--txt-d)">T' + minTurn + '</text>';
  svg += '<text x="' + (W - PAD.r) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="var(--txt-d)">T' + maxTurn + '</text>';
  svg += '</svg>';

  var legend = '<div style="display:flex;gap:1rem;font-size:0.72rem;color:var(--txt-d);margin-top:4px;">'+
    '<span><span style="display:inline-block;width:14px;height:2px;background:var(--vermillion-400);vertical-align:middle;margin-right:4px;"></span>真实浊度</span>'+
    '<span><span style="display:inline-block;width:14px;height:0;border-top:2px dashed var(--gold-400);vertical-align:middle;margin-right:4px;"></span>朝廷视野</span>'+
    '</div>';

  // 部门 mini bars（最后一个快照）
  var last = data[data.length - 1];
  var miniBars = '<div style="margin-top:0.8rem;font-size:0.72rem;color:var(--txt-d);margin-bottom:4px;">各部门当前（Δ 与 ' + (data.length >= 13 ? '一年前' : '起始') + '）：</div>';
  var baseline = data.length >= 13 ? data[data.length - 13] : data[0];
  var deptList = [
    ['central',    '京察'], ['provincial', '地方'],
    ['military',   '军队'], ['fiscal',     '税司'],
    ['judicial',   '司法'], ['imperial',   '内廷']
  ];
  miniBars += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">';
  deptList.forEach(function(d) {
    var cur = last.depts[d[0]] || 0;
    var bas = baseline.depts[d[0]] || 0;
    var delta = cur - bas;
    var deltaStr = (delta > 0 ? '+' : '') + delta;
    var deltaColor = delta > 3 ? 'var(--vermillion-400)' :
                     delta < -3 ? '#6aa88a' : 'var(--txt-d)';
    miniBars += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 6px;background:var(--bg-2);border-radius:3px;">'+
      '<span style="font-size:0.74rem;">' + d[1] + '</span>'+
      '<span style="font-size:0.74rem;color:var(--txt);">' + cur +
      ' <span style="color:' + deltaColor + ';">' + deltaStr + '</span></span>'+
      '</div>';
  });
  miniBars += '</div>';

  return '<section class="vd-section">'+
    '<div class="vd-section-title">历史趋势 <span class="vd-badge">' + data.length + ' 月</span></div>'+
    '<div style="background:var(--bg-2);border-radius:4px;padding:4px 8px;">' + svg + '</div>' +
    legend + miniBars +
    '</section>';
}

// ─── 收集近期弹章（从风闻录事 GM.evtLog 过滤）───
function _collectRecentCases() {
  var cases = [];
  if (!GM.evtLog) return cases;
  var relevantTypes = { '告状':1, '密札':1, '耳报':1, '风议':1, '人事':1, '惩罚':1 };
  for (var i = Math.max(0, GM.evtLog.length - 40); i < GM.evtLog.length; i++) {
    var e = GM.evtLog[i];
    if (!e) continue;
    // 筛选吏治相关
    if (relevantTypes[e.type] ||
        (e.text && /贪|侵|克扣|收贿|冤|勒索|火耗/.test(e.text))) {
      cases.push({
        idx: i,
        text: e.text || '',
        type: e.type || '事件',
        turn: e.turn,
        time: e.time,
        credibility: e.credibility || 'medium'
      });
    }
  }
  // 倒序（最新在前），限 8 件
  cases.reverse();
  return cases.slice(0, 8);
}

function _escHtml(s) {
  if (typeof escHtml === 'function') return escHtml(s);
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ─── 点击待决案件 → 处置界面 ───
function _lizhi_handleActiveCase(caseId) {
  if (!GM.corruption || !GM.corruption.activeCases) return;
  var ac = GM.corruption.activeCases.find(function(a) { return a.id === caseId; });
  if (!ac) {
    if (typeof toast === 'function') toast('案件已结');
    return;
  }
  var sevLbl = ac.severity === 'major' ? '大案' :
               ac.severity === 'moderate' ? '中案' : '小案';

  var html = '<div style="padding:1rem;">';
  html += '<h4 style="color:var(--gold);margin-bottom:0.5rem;">' + ac.name + '</h4>';
  html += '<p style="font-size:0.88rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'
          + _escHtml(ac.text) + '</p>';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:0.6rem;">'
          + '部门：' + (CorruptionEngine && CorruptionEngine._deptName ? CorruptionEngine._deptName(ac.dept) : ac.dept)
          + ' · ' + sevLbl
          + ' · 证据：' + _escHtml(ac.evidence) + '</div>';

  var turnsLeft = (ac.expireTurn || 0) - GM.turn;
  if (turnsLeft > 0) {
    html += '<div style="font-size:0.72rem;color:var(--amber-400);margin-bottom:0.8rem;">余 '
            + turnsLeft + ' 月需定夺（逾期则民心 -2，皇威 -1，腐败增）</div>';
  } else {
    html += '<div style="font-size:0.72rem;color:var(--vermillion-400);margin-bottom:0.8rem;">已逾期</div>';
  }

  html += '<div style="font-size:0.78rem;color:var(--gold);margin-bottom:0.4rem;letter-spacing:0.05em;">陛下处置：</div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px;">';

  (ac.options || []).forEach(function(opt) {
    var costParts = [];
    var benParts = [];
    var cost = opt.cost || {};
    var ben = opt.benefit || {};
    if (cost.partyStrife)  costParts.push('党争 +' + cost.partyStrife);
    if (cost.huangquan)    costParts.push('皇权 -' + Math.abs(cost.huangquan));
    if (cost.huangwei)     costParts.push('皇威 -' + Math.abs(cost.huangwei));
    if (cost.minxin)       costParts.push('民心 -' + Math.abs(cost.minxin));
    if (cost.guoku)        costParts.push('帑廪 -' + Math.round(Math.abs(cost.guoku)/1000) + '千');
    if (cost.stress)       costParts.push('陛下神劳 +' + cost.stress);

    if (ben.corruption)    benParts.push('部门腐败 ' + ben.corruption);
    if (ben.minxin)        benParts.push('民心 +' + ben.minxin);
    if (ben.huangwei)      benParts.push('皇威 +' + ben.huangwei);
    if (ben.huangquan)     benParts.push('皇权 +' + ben.huangquan);
    if (ben.guoku)         benParts.push('帑廪 +' + Math.round(ben.guoku/1000) + '千');
    if (ben.neitang)       benParts.push('内帑 +' + Math.round(ben.neitang/1000) + '千');
    if (ben.partyStrife)   benParts.push('党争 ' + ben.partyStrife);
    if (ben.armyMorale)    benParts.push('军心 +' + ben.armyMorale);

    html += '<button class="vd-action-btn" '
         + 'onclick="_lizhi_applyHandling(\'' + ac.id + '\', \'' + opt.id + '\')">'
         + '<div style="font-weight:600;">' + opt.label + '</div>';
    if (costParts.length) html += '<span class="cost" style="color:var(--vermillion-400);">代价：' + costParts.join('·') + '</span>';
    if (benParts.length)  html += '<span class="cost" style="color:#6aa88a;">收益：' + benParts.join('·') + '</span>';
    if (opt.historical)   html += '<span class="cost" style="font-style:italic;">' + opt.historical + '</span>';
    html += '</button>';
  });

  html += '</div></div>';

  if (typeof openGenericModal === 'function') {
    openGenericModal(ac.name, html, null);
  }
}

function _lizhi_applyHandling(caseId, optionId) {
  if (!CorruptionEngine || !CorruptionEngine.applyCaseHandling) {
    if (typeof toast === 'function') toast('引擎未就绪');
    return;
  }
  var r = CorruptionEngine.applyCaseHandling(caseId, optionId);
  if (r.success) {
    if (typeof toast === 'function') toast('已施行：' + r.option.label);
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderCorruptionPanel();
    if (typeof renderTopBarVars === 'function') renderTopBarVars();
  } else {
    if (typeof toast === 'function') toast('未成：' + r.reason);
  }
}

// ─── 通用确认对话 + 执行后刷新 ───
function _lizhi_confirm(title, desc, costHtml, confirmLabel, fn) {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">' + title + '</h4>'+
    '<p style="font-size:0.85rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">' + desc + '</p>'+
    '<div style="font-size:0.78rem;color:var(--txt-d);padding:0.5rem 0.7rem;background:var(--bg-2);border-radius:4px;border-left:3px solid var(--gold-d);">'+
      costHtml + '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal(title, html, function() {
      try {
        var r = fn();
        if (r && r.success === false) {
          if (typeof toast === 'function') toast('未成：' + (r.reason || '条件不足'));
        } else {
          if (typeof toast === 'function') toast('已施行：' + title);
        }
      } catch(e) {
        console.error('[lizhi] action error:', e);
        if (typeof toast === 'function') toast('执行出错');
      }
      if (typeof closeGenericModal === 'function') closeGenericModal();
      // 刷新面板
      renderCorruptionPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
    // 替换按钮文字为中式风格
    setTimeout(function() {
      var sb = document.getElementById('gm-save-btn');
      if (sb && confirmLabel) sb.textContent = confirmLabel;
      var cb = document.querySelector('#gm-overlay .generic-modal-footer .bt.bs');
      if (cb) cb.textContent = '罢';
    }, 10);
  }
}

function _lizhi_dispatchCommissioner() {
  var cost = 50000;
  var bal = (GM.guoku && GM.guoku.balance) || 0;
  _lizhi_confirm('派遣钦差',
    '遣整直之臣赴地方专项调查。成功揭发则该部门腐败 -8~-16；3 回合内监察加强。',
    '代价：帑廪 ' + (cost/10000) + ' 万两（现余 ' + Math.round(bal/10000) + ' 万）',
    '遣使', function() {
      return CorruptionEngine.Actions.dispatchCommissioner({ cost: cost, targetDept: 'provincial' });
    });
}
function _lizhi_launchPurge() {
  // 先弹"AI 参议 / 直接行大计 / 罢"三选项
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">肃贪运动</h4>'+
    '<p style="font-size:0.85rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '大规模清洗贪官。六部门腐败 -20，但民心 -5、党争 +20、朝政瘫痪 6 回合。'+
    '</p>'+
    '<div style="font-size:0.76rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;margin-bottom:0.8rem;">'+
      '代价：民心 -5 · 朝政瘫痪 6 月 · 长期反弹'+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_lizhi_purgeAdvise()">'+
        '<div>⊕ 先听辅政参议</div>'+
        '<span class="cost">AI 分析时局 · 免费</span>'+
      '</button>'+
      '<button class="vd-action-btn dangerous" onclick="_lizhi_purgeExecute()">'+
        '<div>⚔ 立即行大计</div>'+
        '<span class="cost">无视参议 · 直接施行</span>'+
      '</button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('肃贪运动', html, null);
  }
}

function _lizhi_purgeExecute() {
  var r = CorruptionEngine.Actions.launchPurge({ scale: 'departmental' });
  if (r && r.success !== false) {
    if (typeof toast === 'function') toast('已施行：肃贪运动');
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderCorruptionPanel();
    if (typeof renderTopBarVars === 'function') renderTopBarVars();
  } else {
    if (typeof toast === 'function') toast('未成：' + (r && r.reason || '未知'));
  }
}

async function _lizhi_purgeAdvise() {
  // 关闭上级弹窗并显示加载中
  if (typeof closeGenericModal === 'function') closeGenericModal();
  var html = '<div style="padding:1.2rem;text-align:center;">'+
    '<div style="font-size:0.88rem;color:var(--txt-s);line-height:1.8;">'+
      '辅政大臣正在参议……'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('辅政参议', html, null);
  }
  // 异步调用 AI
  if (!CorruptionEngine || !CorruptionEngine.aiPurgeAdvisor) {
    _showPurgeAdvice('辅政系统未就绪', false);
    return;
  }
  try {
    var r = await CorruptionEngine.aiPurgeAdvisor();
    _showPurgeAdvice(r.analysis || '臣恭候陛下圣裁', r.available);
  } catch(e) {
    console.error('[lizhi] aiPurgeAdvisor error:', e);
    _showPurgeAdvice('辅政参议暂难作答', false);
  }
}

function _showPurgeAdvice(analysis, wasAI) {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">'+
      '辅政参议' + (wasAI ? '' : '（规则版）') +
    '</h4>'+
    '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
      'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:0.8rem;white-space:pre-wrap;">'+
      _escHtml(analysis || '') +
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:6px;">'+
      '<button class="vd-action-btn dangerous" onclick="_lizhi_purgeExecute()">'+
        '<div>⚔ 依臣议，行大计</div>'+
        '<span class="cost">民心 -5 · 朝政瘫痪</span>'+
      '</button>'+
      '<button class="vd-action-btn" onclick="if(typeof closeGenericModal===\'function\')closeGenericModal();">'+
        '<div>⊝ 再思而后行</div>'+
        '<span class="cost">容臣再议</span>'+
      '</button>'+
    '</div></div>';
  if (typeof closeGenericModal === 'function') closeGenericModal();
  if (typeof openGenericModal === 'function') {
    openGenericModal('辅政参议', html, null);
  }
}
function _lizhi_reformSalary() {
  _lizhi_confirm('俸禄改革（养廉银式）',
    '官员俸禄提至原 1.5 倍。lowSalary 腐败源大减，但帑廪月支倍增。',
    '代价：每月官员俸禄支出 +50%',
    '施行', function() {
      return CorruptionEngine.Actions.reformSalary({ multiplier: 1.5 });
    });
}
function _lizhi_factionExposure() {
  _lizhi_confirm('授意弹劾',
    '让一派揭发对立派。中央/地方/税司 -5~-10 腐败，但党争加剧。',
    '代价：党争升级 +30% · 政令效率略降',
    '默许', function() {
      return CorruptionEngine.Actions.factionExposure();
    });
}
function _lizhi_openAppeals() {
  _lizhi_confirm('登闻鼓疏通',
    '畅通民间告状通道。监察力度提升，长期抑腐。',
    '代价：每月新增告状卷宗（行政负担）',
    '开鼓', function() {
      return CorruptionEngine.Actions.openAppeals();
    });
}
function _lizhi_rotateOfficials() {
  _lizhi_confirm('官员三年一调',
    '定制地方官轮换。防止扎根腐化。',
    '代价：新任生疏地方 · 政令延迟',
    '定制', function() {
      return CorruptionEngine.Actions.rotateOfficials({ frequency: 3 });
    });
}
function _lizhi_harshRule() {
  _lizhi_confirm('酷吏肃贪',
    '任用酷吏。中央/地方/军队/税司腐败 -15，但司法腐败 +10（冤狱）、民心 -8。长期反噬严重。',
    '代价：民心 -8 · 司法冤狱 · 士人心离',
    '任用', function() {
      return CorruptionEngine.Actions.harshRule();
    });
}
function _lizhi_secretPolice() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">设特务机构</h4>'+
    '<p style="font-size:0.85rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">选择创设机构（每种自带覆盖/独立性/腐败三参数）：</p>'+
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">'+
      '<button class="vd-action-btn" onclick="_lizhi_doSetupSP(\'earlyCensorate\')">'+  /* 引擎键中立·原 yushitai·"御史台" 仅作显示 label (跨朝代铁律·对应 tm-corruption-engine setupSecretPolice) */
        '<div>御史台</div><span class="cost">独立60 · 费 2 万</span></button>'+
      '<button class="vd-action-btn" onclick="_lizhi_doSetupSP(\'censorate\')">'+  /* 引擎键中立·原 duchayuan·"都察院" 仅作显示 label */
        '<div>都察院</div><span class="cost">独立50 · 费 3.5 万</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_lizhi_doSetupSP(\'militarySecretPolice\')">'+  /* 引擎键中立·原 jinyiwei·"锦衣卫" 仅作显示 label */
        '<div>锦衣卫</div><span class="cost">独立20 · 费 5 万</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_lizhi_doSetupSP(\'innerCourtAgent\')">'+  /* 引擎键中立·原 dongchang·"东厂" 仅作显示 label (跨朝代铁律·对应 tm-corruption-engine setupSecretPolice) */
        '<div>东厂</div><span class="cost">独立5 · 费 6 万</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('设特务机构', html, null);
}
function _lizhi_doSetupSP(type) {
  var r = CorruptionEngine.Actions.setupSecretPolice(type);
  if (r.success) {
    if (typeof toast === 'function') toast('已设立');
    if (typeof closeGenericModal === 'function') closeGenericModal();
  } else {
    if (typeof toast === 'function') toast('未成：' + (r.reason || '失败'));
  }
  renderCorruptionPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}
function _lizhi_openInstitutionDesigner() {
  _lizhi_secretPolice();  // 目前复用特务机构菜单作为"新设监察机构"入口
}

// ─── 卖官切换 ───
function _lizhi_toggleJuanna() {
  if (!CorruptionEngine || !CorruptionEngine.openJuanna) return;
  if (GM.juanna && GM.juanna.active) {
    _lizhi_confirm('罢捐纳',
      '停开捐纳之门。清流拍手称快，但帑廪月入即刻减少。',
      '代价：每月减收 ' + Math.round(GM.juanna.monthlyIncome/1000) + ' 千两',
      '罢捐', function() {
        CorruptionEngine.closeJuanna();
        return { success: true };
      });
    return;
  }
  // 三档选择
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">开捐纳</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">历代财政紧急时行捐纳之制。选择档次：</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_lizhi_doOpenJuanna(\'restricted\')">'+
        '<div>限捐低阶（只许捐七品以下）</div>'+
        '<span class="cost">月入 +5% · 腐败轻微 · 中央/税司 +0.05/月</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_lizhi_doOpenJuanna(\'standard\')">'+
        '<div>有序捐纳（至五品）</div>'+
        '<span class="cost">月入 +12% · 腐败显著 · 士人渐离</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_lizhi_doOpenJuanna(\'open-any\')">'+
        '<div>开放捐纳（不限级）</div>'+
        '<span class="cost">月入 +25% · 腐败暴涨 · 汉灵帝式</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('开捐纳', html, null);
}

function _lizhi_doOpenJuanna(tier) {
  CorruptionEngine.openJuanna(tier);
  if (typeof toast === 'function') toast('已开捐纳（' + tier + '）');
  if (typeof closeGenericModal === 'function') closeGenericModal();
  renderCorruptionPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

// ─── 地图热力切换 ───
function _lizhi_toggleMapHeat() {
  if (!CorruptionEngine || !CorruptionEngine.toggleMapCorruptionOverlay) return;
  // 先更新区域腐败
  if (CorruptionEngine.updateRegionalCorruption) CorruptionEngine.updateRegionalCorruption();
  CorruptionEngine.toggleMapCorruptionOverlay();
  renderCorruptionPanel();
  if (typeof toast === 'function') {
    toast(GM.mapData.state.showCorruption ? '已开天下污浊图' : '已关污浊图');
  }
}

// ═══════════════════════════════════════════════════════
// §5.4 三数展示（名义/官府实收/民间实缴）—— 通用组件
// 暴露到全局，供 帑廪面板 / 税收奏疏 / 地方汇报 复用
// ═══════════════════════════════════════════════════════
// 浮收率·腐败贡献 + 全局浮收 + 苛捐底色 + 重税加成 - 反贪改革折扣
// 提取为独立 helper·让 cascade 路径与回退路径共用一致逻辑
function _calcOverCollectRate() {
  var c = (typeof GM !== 'undefined' && GM.corruption) || {};
  var _baseCorr = (c.trueIndex != null ? c.trueIndex : 30);
  var fc = ((c.subDepts && c.subDepts.fiscal) || {}).true;
  if (fc == null) fc = Math.max(_baseCorr, 25);
  var pc = ((c.subDepts && c.subDepts.provincial) || {}).true;
  if (pc == null) pc = Math.max(_baseCorr, 20);

  var rate = (fc + pc) / 200 * 0.5;
  var floating = (GM.fiscal && typeof GM.fiscal.floatingCollectionRate === 'number') ? GM.fiscal.floatingCollectionRate : 0;
  rate += floating + 0.05;  // 苛捐底色 5%

  var _taxLevelBonus = 0;
  try {
    if (GM.adminHierarchy) {
      var _hvyCount = 0, _totalLeaf = 0;
      (function _walk(nodes){
        (nodes||[]).forEach(function(d){
          var isLeaf = !d.children || d.children.length === 0;
          if (isLeaf) {
            _totalLeaf++;
            if (d.taxRate === '重税' || d.taxRate === 'heavy') _hvyCount++;
          } else _walk(d.children);
        });
      })((GM.adminHierarchy[Object.keys(GM.adminHierarchy)[0]] || {}).divisions || []);
      if (_totalLeaf > 0) _taxLevelBonus = (_hvyCount / _totalLeaf) * 0.05;
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-lizhi-panel·_calcOverCollectRate');}catch(_){}}
  rate += _taxLevelBonus;

  var cm = c.countermeasures || {};
  if (cm.salaryReform > 0) rate *= (1 - cm.salaryReform * 0.4);
  if (cm.publicAppeal > 0.5) rate *= (1 - (cm.publicAppeal - 0.5) * 0.3);
  return Math.max(0, Math.min(1.0, rate));
}

// ═══════════════════════════════════════════════════════
// 计算三数·名义/官府实收/民间实缴
// 优先从 CascadeTax._lastCascadeSummary 读·与钱账分项同源·避免 67 vs 201 撕裂
// 回退到老的 hukou × landTaxRate 估算·兼容 cascade 未跑过的早期回合
// ═══════════════════════════════════════════════════════
function computeTaxThreeNumber(nominalParam) {
  if(typeof FiscalEngine!=='undefined'&&FiscalEngine.readAccountStatement&&typeof CascadeTax!=='undefined'&&CascadeTax.isUnified&&CascadeTax.isUnified(GM,'player')){
    var statement=FiscalEngine.readAccountStatement({game:GM,account:GM.guoku,scope:'central'});
    var period=statement.account.accounting,turn=period&&period.turn!=null?period.turn:GM.turn||0;
    var current=GM._lastCascadeTaxTurn===turn&&GM._lastCascadeSummary;
    if(statement.budget)return FiscalStatement.taxThree(current||statement.budget.totals);
  }
  var c = GM.corruption || {};
  var _baseCorr = (c.trueIndex != null ? c.trueIndex : 30);
  var fc = ((c.subDepts && c.subDepts.fiscal) || {}).true;
  if (fc == null) fc = Math.max(_baseCorr, 25);
  var pc = ((c.subDepts && c.subDepts.provincial) || {}).true;
  if (pc == null) pc = Math.max(_baseCorr, 20);

  var overCollectRate = _calcOverCollectRate();

  // ── 优先路径：cascade 同源 ──
  // 读 GM._lastCascadeSummary·结构·{central,localRetain,skimmed,lostTransit}.{money,grain,cloth}
  // 钱账·名义(扣corruption/灾/抗税后) = central + localRetain + skimmed + lostTransit
  // 官收 = 实际入库(中央上解+地方公库) = central + localRetain
  // 民缴 = 名义 + 浮收 = 名义 × (1 + overCollectRate)
  // 差额三流向：
  //   州县吏胥(clerk) = 浮收·民多交那部分(歷史上胥吏火耗加派)
  //   各级私分(official) = cascade.skimmed·主官+幕僚私吞
  //   豪强抵偿(power) = cascade.lostTransit + 名义剩余·路上消失 + 抗税
  var summary = (typeof GM !== 'undefined' && GM._lastCascadeSummary) ? GM._lastCascadeSummary : null;
  if (summary && (summary.central.money > 0 || summary.localRetain.money > 0)) {
    var central = summary.central.money || 0;
    var localRetain = summary.localRetain.money || 0;
    var skimmed = summary.skimmed.money || 0;
    var lostTransit = summary.lostTransit.money || 0;
    var nominalNet = central + localRetain + skimmed + lostTransit;  // "扣损耗后名义"

    var actualReceived = central + localRetain;
    var floatingCollection = nominalNet * overCollectRate;
    var peasantPaid = nominalNet + floatingCollection;
    var totalLoss = peasantPaid - actualReceived;

    return {
      nominal: nominalNet,
      actualReceived: actualReceived,
      peasantPaid: peasantPaid,
      totalLoss: totalLoss,
      leakageRate: nominalNet > 0 ? (1 - actualReceived / nominalNet) : 0,
      overCollectRate: overCollectRate,
      gaps: {
        clerk:    floatingCollection,                // 浮收 → 州县吏胥
        official: skimmed,                            // 被贪 → 各级私分
        power:    0,
        transit:  lostTransit                         // 在途损耗单列，不等同豪强侵占
      },
      _source: 'cascade'
    };
  }

  // ── 回退路径·cascade 还没跑过(开局首回合前)·用老的估算 ──
  var nominal = nominalParam;
  if (!nominal) {
    return { nominal: 0, actualReceived: 0, peasantPaid: 0,
             leakageRate: 0, overCollectRate: 0, totalLoss: 0,
             gaps: { clerk:0, official:0, power:0, transit:0 }, _source: 'fallback_zero' };
  }
  var leakageRate = Math.min(0.7, (fc + pc) / 200 * 0.7);
  var actualReceived = nominal * (1 - leakageRate);
  var peasantPaid    = nominal * (1 + overCollectRate);
  var totalLoss      = peasantPaid - actualReceived;
  var clerkRatio    = 0.25 + (pc / 100) * 0.2;
  var officialRatio = 0.25 + (fc / 100) * 0.2;
  var powerRatio    = 1 - clerkRatio - officialRatio;

  return {
    nominal: nominal,
    actualReceived: actualReceived,
    peasantPaid: peasantPaid,
    totalLoss: totalLoss,
    leakageRate: leakageRate,
    overCollectRate: overCollectRate,
    gaps: {
      clerk:    totalLoss * clerkRatio,
      official: totalLoss * officialRatio,
      power:    totalLoss * powerRatio,
      transit:  0
    },
    _source: 'fallback_estimate'
  };
}

function renderTaxThreeNumberBlock(nominal, opts) {
  opts = opts || {};
  var f = opts.data || computeTaxThreeNumber(nominal);
  var gapLabels = opts.gapLabels || {clerk:'州县吏胥',official:'各级私分',power:f.collectionDeclared?'豪强截留':'豪强抵偿',transit:'在途损耗',unallocated:'未分计'};
  var gapText = function(key) { return String(gapLabels[key] || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var label = opts.label || '正赋钱粮';
  var unit = opts.unit || '两';
  var fmt = function(v) {
    v = Math.round(v);
    if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
    return v.toString();
  };
  var pct = function(v, base) {
    if (base === 0) return '0%';
    return (v > 0 ? '+' : '') + Math.round(v / base * 100) + '%';
  };

  var html = '<div style="background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:4px;padding:0.7rem 0.9rem;">';
  html += '<div style="font-size:0.78rem;color:var(--gold);margin-bottom:0.4rem;letter-spacing:0.08em;">' + label + '</div>';

  // 三数
  html += '<div style="display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;font-size:0.78rem;">';
  html += '<span style="color:var(--txt-d);">应征（名义）</span>'+
          '<span style="color:var(--txt);text-align:right;">' + fmt(f.nominal) + ' ' + unit + '</span>'+
          '<span style="color:var(--txt-d);font-size:0.71rem;">基准</span>';

  html += '<span style="color:var(--txt-d);">官府实收</span>'+
          '<span style="color:var(--vermillion-400);text-align:right;">' + fmt(f.actualReceived) + ' ' + unit + '</span>'+
          '<span style="color:var(--vermillion-400);font-size:0.71rem;">' + pct(f.actualReceived - f.nominal, f.nominal) + '</span>';

  html += '<span style="color:var(--txt-d);">民间实缴</span>'+
          '<span style="color:#c0603a;text-align:right;">' + fmt(f.peasantPaid) + ' ' + unit + '</span>'+
          '<span style="color:#c0603a;font-size:0.71rem;">' + pct(f.peasantPaid - f.nominal, f.nominal) + '</span>';
  html += '</div>';

  // 差额流向
  if (f.totalLoss > 0) {
    html += '<div style="margin-top:0.6rem;padding-top:0.4rem;border-top:1px dashed var(--color-border-subtle);">';
    html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-bottom:0.3rem;">差额去向（' + fmt(f.totalLoss) + ' ' + unit + '）</div>';
    html += '<div style="display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;font-size:0.72rem;color:var(--txt-d);">';
    html += '<span>' + gapText('clerk') + '</span><span style="text-align:right;">' + fmt(f.gaps.clerk) + '</span><span>' + Math.round(f.gaps.clerk/f.totalLoss*100) + '%</span>';
    html += '<span>' + gapText('official') + '</span><span style="text-align:right;">' + fmt(f.gaps.official) + '</span><span>' + Math.round(f.gaps.official/f.totalLoss*100) + '%</span>';
    html += '<span>' + gapText('power') + '</span><span style="text-align:right;">' + fmt(f.gaps.power) + '</span><span>' + Math.round(f.gaps.power/f.totalLoss*100) + '%</span>';
    html += '<span>' + gapText('transit') + '</span><span style="text-align:right;">' + fmt(f.gaps.transit || 0) + '</span><span>' + Math.round((f.gaps.transit || 0)/f.totalLoss*100) + '%</span>';
    if(f.collectionDeclared)html+='<span>'+gapText('unallocated')+'</span><span style="text-align:right;">'+fmt(f.gaps.unallocated||0)+'</span><span>'+Math.round((f.gaps.unallocated||0)/f.totalLoss*100)+'%</span>';
    html += '</div>';
    html += '</div>';
  }

  if(f.governmentScope==='central-and-regional'){
    html+='<div style="margin-top:0.5rem;font-size:0.72rem;color:var(--txt-d);">官收合计中央上供与地方留用。民间额外实缴 '+fmt(f.extraCollected||0)+' '+unit+'。</div>';
    var nc=f.notCollected;if(nc)html+='<div style="margin-top:0.3rem;font-size:0.72rem;color:var(--txt-d);">尚未征到：豪强抗纳 '+fmt(nc.resistance||0)+'，其余欠征 '+fmt(nc.other||0)+' '+unit+'；另有核减及征前损折 '+fmt(nc.assessmentReduction||0)+' '+unit+'。未缴之数不列入截留差额。</div>';
  }

  // 视觉化水槽（条形图）
  var maxVal = Math.max(f.nominal, f.peasantPaid, f.actualReceived);
  if (maxVal > 0) {
    var bar = function(label, val, color) {
      var pctW = val / maxVal * 100;
      return '<div style="margin-top:4px;">'+
        '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--txt-d);">'+
          '<span>' + label + '</span><span>' + fmt(val) + '</span></div>'+
        '<div style="height:5px;background:var(--bg-3);border-radius:2px;overflow:hidden;">'+
          '<div style="height:100%;width:' + pctW + '%;background:' + color + ';transition:width 0.4s;"></div>'+
        '</div></div>';
    };
    html += '<div style="margin-top:0.6rem;padding-top:0.4rem;border-top:1px dashed var(--color-border-subtle);">';
    html += bar('名义', f.nominal, 'var(--gold-400)');
    html += bar('官收', f.actualReceived, 'var(--vermillion-400)');
    html += bar('民缴', f.peasantPaid, '#c0603a');
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// 暴露到全局
if (typeof window !== 'undefined') {
  window.computeTaxThreeNumber = computeTaxThreeNumber;
  window.renderTaxThreeNumberBlock = renderTaxThreeNumberBlock;
  window._calcOverCollectRate = _calcOverCollectRate;
}

// ═══════════════════════════════════════════════════════
// §10.3 角色卡片廉洁图标（仅演义模式）
// ═══════════════════════════════════════════════════════
function _lizhiIntegrityBadge(char) {
  if (!char) return '';
  // 仅演义模式启用
  var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'light-history';
  if (mode !== 'romance') return '';

  // 若未被监察覆盖（即：监察力度极弱）则显示"未察"
  var sup = (GM.corruption && GM.corruption.supervision && GM.corruption.supervision.level) || 0;
  if (sup < 20) {
    return '<span class="char-integrity-badge" style="margin-left:8px;padding:2px 6px;background:rgba(107,93,79,0.15);border:1px solid var(--ink-300);border-radius:3px;font-size:0.7rem;color:var(--ink-300);" title="未纳入监察覆盖">❓ 未察</span>';
  }

  var integrity = char.integrity !== undefined ? char.integrity : 50;

  // 有弹章在案（根据 activeCases 或风闻录事）
  var hasCase = false;
  var cases = (GM.corruption && GM.corruption.activeCases) || [];
  for (var i = 0; i < cases.length; i++) {
    if ((cases[i].suspects || []).indexOf(char.name) !== -1 ||
        (cases[i].text && cases[i].text.indexOf(char.name) !== -1)) {
      hasCase = true;
      break;
    }
  }

  var label, symbol, color, bg, title;
  if (integrity > 80) {
    symbol = '🏮'; label = '清廉'; color = '#6aa88a';
    bg = 'rgba(106,168,138,0.15)';
    title = '清廉如水（integrity ' + Math.round(integrity) + '）';
  } else if (integrity >= 50) {
    symbol = '🏷'; label = '合格'; color = 'var(--gold-400)';
    bg = 'rgba(184,154,83,0.12)';
    title = '合格尚可（integrity ' + Math.round(integrity) + '）';
  } else if (integrity >= 30) {
    symbol = '💰'; label = '嫌疑'; color = '#a88a3a';
    bg = 'rgba(138,109,43,0.2)';
    title = '有贪腐嫌疑' + (hasCase ? '，已有弹章在案' : '') + '（integrity ' + Math.round(integrity) + '）';
  } else {
    symbol = '⚠'; label = '已揭发'; color = 'var(--vermillion-400)';
    bg = 'rgba(192,64,48,0.18)';
    title = '贪赃枉法' + (hasCase ? '，大案在案' : '') + '（integrity ' + Math.round(integrity) + '）';
  }

  return '<span class="char-integrity-badge" style="margin-left:8px;padding:2px 8px;background:' + bg +
         ';border:1px solid ' + color + ';border-radius:3px;font-size:0.7rem;color:' + color +
         ';vertical-align:middle;" title="' + title + '">' + symbol + ' ' + label + '</span>';
}

// ESC 关闭
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeCorruptionPanel();
});
