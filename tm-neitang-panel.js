// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 内帑（皇室私库）详情面板
// 设计：设计方案-财政系统.md 决策 F
// 数据：GM.neitang
// ═══════════════════════════════════════════════════════════════

function _neitangFmt(v) {
  v = Math.round(v || 0);
  if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 10000) return Math.round(v/10000) + '万';
  return v.toString();
}

function _neitangTabJump(label, tabId) {
  var safeLabel = String(label).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
    'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '→ <b>' + safeLabel + '</b>（切至标签页处理）' +
  '</div>';
}

function openNeitangPanel() {
  var ov = document.getElementById('neitang-drawer-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'neitang-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="neitang-drawer">'+
      '<div class="var-drawer-header">'+
        '<div>'+
          '<div class="var-drawer-title">内帑之察 · 皇家私库</div>'+
          '<div class="var-drawer-subtitle" id="neitang-subtitle"></div>'+
        '</div>'+
        '<button class="var-drawer-close" onclick="closeNeitangPanel()">×</button>'+
      '</div>'+
      '<div class="var-drawer-body" id="neitang-body"></div>'+
    '</div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) closeNeitangPanel(); });
    document.body.appendChild(ov);
  }
  renderNeitangPanel();
  ov.classList.add('open');
}

function closeNeitangPanel() {
  var ov = document.getElementById('neitang-drawer-ov');
  if (ov) ov.classList.remove('open');
}

function renderNeitangPanel() {
  var body = document.getElementById('neitang-body');
  var subt = document.getElementById('neitang-subtitle');
  if (!body) return;

  var n = GM.neitang || {};
  var turnDays = (GM.guoku && GM.guoku.turnDays) || n.turnDays || 30;
  var periodLbl = turnDays === 30 ? '月' : '回合';
  var lbl = periodLbl + '入 ' + _neitangFmt(n.turnIncome || n.monthlyIncome || 0) +
            ' / ' + periodLbl + '支 ' + _neitangFmt(n.turnExpense || n.monthlyExpense || 0);
  if (n.crisis && n.crisis.active) lbl = '⚠ 空竭 · ' + lbl;
  if (subt) subt.textContent = lbl;

  var html = '';
  var U = (typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : (n.unit || { money:'两', grain:'石', cloth:'匹' });
  var ledgers = n.ledgers || {};
  var moneyLed = ledgers.money || { stock:0 };
  var grainLed = ledgers.grain || { stock:0 };
  var clothLed = ledgers.cloth || { stock:0 };
  var stockMoney = (moneyLed.stock != null ? moneyLed.stock : (n.balance || 0));
  var stockGrain = grainLed.stock || 0;
  var stockCloth = clothLed.stock || 0;

  // ─── Hero · 朱红玺 ───
  var balanceClass = stockMoney < 0 ? 'bad' :
                     stockMoney < (n.monthlyExpense || 1) * 3 ? 'warn' : '';
  var statePillHtml = '';
  if (n.crisis && n.crisis.active) {
    statePillHtml = '<span class="tr-pill bad">⚠ 空竭 · ' + Math.round(n.crisis.consecutiveMonths || 0) + ' 月</span>';
  } else if (stockMoney < 0) {
    statePillHtml = '<span class="tr-pill bad">亏空</span>';
  } else if (stockMoney < (n.monthlyExpense || 1) * 3) {
    statePillHtml = '<span class="tr-pill warn">紧</span>';
  } else if ((n.monthlyExpense || 0) > 0) {
    var months = stockMoney / Math.max(1, n.monthlyExpense);
    statePillHtml = '<span class="tr-pill ok">充裕 · 可济 ' + Math.round(months) + ' 月</span>';
  } else {
    statePillHtml = '<span class="tr-pill ok">充裕</span>';
  }

  // tags
  var tagsHtml = '';
  // 内廷侵吞
  if (GM.corruption && GM.corruption.subDepts && GM.corruption.subDepts.imperial) {
    var ic = GM.corruption.subDepts.imperial.true;
    if (ic > 30) {
      var leakPct = Math.round(ic / 100 * 0.5 * 100);
      tagsHtml += '<span class="tr-pill bad">⚠ 内廷侵吞 ' + leakPct + '%</span>';
    }
  }
  if (n._royalClan) {
    tagsHtml += '<span class="tr-pill warn">宗室俸禄重</span>';
  }
  if (n.specialTaxActive) {
    tagsHtml += '<span class="tr-pill warn">特别税·' + _escHtml(n.specialTaxType || '已开') + '</span>';
  } else {
    tagsHtml += '<span class="tr-pill muted">无特别税</span>';
  }
  if (n._presetName) {
    tagsHtml += '<span class="tr-pill gold">' + _escHtml(n._presetName) + '</span>';
  }

  var deltaVal = n.lastDelta || 0;
  html += '<div class="tr-hero imperial">';
  html +=   '<div class="tr-hero-row">';
  html +=     '<div class="tr-hero-glyph imperial">内</div>';
  html +=     '<div class="tr-hero-main">';
  html +=       '<div class="tr-hero-stock-row">';
  html +=         '<span class="tr-hero-amount' + (balanceClass ? ' ' + balanceClass : '') + '">' + _neitangFmt(stockMoney) + '</span>';
  html +=         '<span class="tr-hero-unit">' + U.money + '</span>';
  html +=         statePillHtml;
  html +=       '</div>';
  html +=       '<div class="tr-hero-mini">';
  html +=         '<span><b>粮</b>' + _neitangFmt(stockGrain) + '<span class="mu">' + U.grain + '</span></span>';
  html +=         '<span><b>布</b>' + _neitangFmt(stockCloth) + '<span class="mu">' + U.cloth + '</span></span>';
  html +=         '<span><b>本回合</b>' + (deltaVal >= 0 ? '+' : '') + _neitangFmt(deltaVal) + '</span>';
  html +=         '<span><b>' + periodLbl + '入</b>' + _neitangFmt(n.turnIncome || n.monthlyIncome || 0) + '</span>';
  html +=       '</div>';
  if (tagsHtml) html += '<div class="tr-hero-tags">' + tagsHtml + '</div>';
  html +=     '</div>';
  html +=   '</div>';
  html += '</div>';

  // ─── 历史预设备注（保留） ───
  if (n._presetName && n._presetHistorical) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-preset-note">';
    html +=     '<div class="pn-name">' + _escHtml(n._presetName) + '</div>';
    html +=     '<div class="pn-hist">' + _escHtml(n._presetHistorical) + '</div>';
    html +=   '</div>';
    html += '</section>';
  }

  // ─── 6 格快览 ───
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">回合速察</span><span class="tr-section-badge">私库</span></div>';
  html +=   '<div class="tr-quickstats">';
  // 回合入
  var turnIn = n.turnIncome || n.monthlyIncome || 0;
  html +=     '<div class="tr-qs"><div class="tr-qs-label">' + periodLbl + '入</div><div class="tr-qs-val up">' + _neitangFmt(turnIn) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 回合支
  var turnOut = n.turnExpense || n.monthlyExpense || 0;
  html +=     '<div class="tr-qs"><div class="tr-qs-label">' + periodLbl + '支</div><div class="tr-qs-val">' + _neitangFmt(turnOut) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 增减
  var deltaCls2 = deltaVal > 0 ? 'up' : deltaVal < 0 ? 'down' : '';
  html +=     '<div class="tr-qs"><div class="tr-qs-label">回合增减</div><div class="tr-qs-val ' + deltaCls2 + '">' + (deltaVal >= 0 ? '+' : '') + _neitangFmt(deltaVal) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 内廷侵吞
  if (GM.corruption && GM.corruption.subDepts && GM.corruption.subDepts.imperial) {
    var ic2 = GM.corruption.subDepts.imperial.true || 0;
    var leakP = Math.round(ic2 / 100 * 0.5 * 100);
    var leakCls = leakP > 30 ? 'down' : leakP > 15 ? 'warn' : '';
    html +=   '<div class="tr-qs"><div class="tr-qs-label">内廷侵吞</div><div class="tr-qs-val ' + leakCls + '">' + leakP + '%</div><div class="tr-qs-sub">腐败 ' + Math.round(ic2) + '</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">内廷侵吞</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">未测</div></div>';
  }
  // 宗室口数
  if (n._royalClan) {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">宗室口数</div><div class="tr-qs-val warn">' + _neitangFmt(n._royalClan.population || 0) + '</div><div class="tr-qs-sub">明末压库之累</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">皇室人口</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">无统计</div></div>';
  }
  // 调拨阻力
  var rules = n.neicangRules || {};
  if (rules.transferResistance) {
    var tr2 = rules.transferResistance;
    var gnP = (tr2.guokuToNeicang || 0) * 100;
    var ngP = (tr2.neicangToGuoku || 0) * 100;
    var avgRes = (gnP + ngP) / 2;
    var resLabel = avgRes > 60 ? '高' : avgRes > 30 ? '中' : '低';
    var resCls = avgRes > 60 ? 'down' : avgRes > 30 ? 'warn' : 'up';
    html +=   '<div class="tr-qs"><div class="tr-qs-label">调拨阻力</div><div class="tr-qs-val ' + resCls + '">' + resLabel + '</div><div class="tr-qs-sub">外济 ' + Math.round(ngP) + '% / 内入 ' + Math.round(gnP) + '%</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">调拨阻力</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">未配置</div></div>';
  }
  html +=   '</div>';
  html += '</section>';

  // ─── 三账库存 ───
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">三账库存</span><span class="tr-section-badge">钱 · 粮 · 布</span></div>';
  html +=   '<div class="tr-3led">';
  var _3meta = [
    { key:'money', cls:'money', name:'钱', unit:U.money },
    { key:'grain', cls:'grain', name:'粮', unit:U.grain },
    { key:'cloth', cls:'cloth', name:'布', unit:U.cloth }
  ];
  _3meta.forEach(function(m) {
    var led = ledgers[m.key] || { stock:0 };
    var ti = (led.thisTurnIn || 0) || (led.lastTurnIn || 0);
    var to = (led.thisTurnOut || 0) || (led.lastTurnOut || 0);
    var net = ti - to;
    var netCls = net >= 0 ? 'delta-up' : 'delta-down';
    html += '<div class="tr-led ' + m.cls + '">';
    html +=   '<div class="tr-led-name">' + m.name + '</div>';
    html +=   '<div class="tr-led-stock">' + _neitangFmt(led.stock || 0) + '</div>';
    html +=   '<div class="tr-led-unit">' + m.unit + '</div>';
    if (ti || to) {
      html += '<div class="tr-led-flow"><span>入 ' + _neitangFmt(ti) + '</span><span class="' + netCls + '">Δ' + (net >= 0 ? '+' : '') + _neitangFmt(net) + '</span></div>';
    }
    html += '</div>';
  });
  html +=   '</div>';
  html += '</section>';

  // ─── 岁入分项 6 类 ───
  var srcLabels = {
    huangzhuang:'皇庄', huangchan:'皇产', specialTax:'特别税',
    confiscation:'抄没', tribute:'朝贡', guokuTransfer:'帑廪转运'
  };
  var sources = n.sources || {};
  var srcTotal = 0;
  for (var k in sources) srcTotal += (sources[k] || 0);
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">岁入分项</span><span class="tr-section-badge">六源 · 年度</span></div>';
  if (srcTotal > 0) {
    html += '<div class="tr-flow-group income">';
    html +=   '<div class="tr-flow-head"><span>钱（年）</span><span class="total">岁入 ' + _neitangFmt(srcTotal) + '</span></div>';
    Object.keys(srcLabels).forEach(function(key) {
      var val = sources[key] || 0;
      if (val === 0) return;
      var pct = (val / srcTotal * 100).toFixed(1);
      var barW = Math.min(100, val / srcTotal * 100);
      html += '<div class="tr-flow-row income"><span class="lbl">' + srcLabels[key] + '</span><div class="bar"><span style="width:' + barW + '%;"></span></div><span class="v">' + _neitangFmt(val) + '<span class="pct">' + pct + '%</span></span></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="vd-empty">岁入尚未结算</div>';
  }
  html += '</section>';

  // ─── 岁出分项 5 类 ───
  var expLabels = {
    gongting:'宫廷用度', dadian:'大典', shangci:'赏赐',
    houGongLingQin:'后宫陵寝', guokuRescue:'接济帑廪'
  };
  var expenses = n.expenses || {};
  var expTotal = 0;
  for (var e in expenses) expTotal += (expenses[e] || 0);
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">岁出分项</span><span class="tr-section-badge">五目 · 年度</span></div>';
  if (expTotal > 0) {
    html += '<div class="tr-flow-group expense">';
    html +=   '<div class="tr-flow-head"><span>钱（年）</span><span class="total">岁出 ' + _neitangFmt(expTotal) + '</span></div>';
    Object.keys(expLabels).forEach(function(key) {
      var val = expenses[key] || 0;
      if (val === 0 && key !== 'gongting') return;
      var pct = expTotal > 0 ? (val / expTotal * 100).toFixed(1) : 0;
      var barW = expTotal > 0 ? Math.min(100, val / expTotal * 100) : 0;
      html += '<div class="tr-flow-row expense"><span class="lbl">' + expLabels[key] + '</span><div class="bar"><span style="width:' + barW + '%;"></span></div><span class="v">' + _neitangFmt(val) + '<span class="pct">' + pct + '%</span></span></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="vd-empty">岁出尚未结算</div>';
  }
  html += '</section>';

  // ─── 危机告警 + 宗室俸禄压力 ───
  if (n.crisis && n.crisis.active) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name bad">内帑空竭</span><span class="tr-section-badge bad">' + Math.round(n.crisis.consecutiveMonths || 0) + ' 月</span></div>';
    html +=   '<div class="tr-alert bad"><span class="ttl">⚠ 皇家体面难维</span><span class="ds">宫人盗窃成风。内廷腐败激增。</span><span class="chain">已连锁：皇威 −5 · 皇权内廷分项 −8 · 内廷腐败持续 +0.5/月</span></div>';
    html += '</section>';
  }
  if (n._royalClan) {
    var rc = n._royalClan;
    var rcMonthly = rc.lastStipendCost || 0;
    var rcAnnual = rcMonthly * 12;
    var rcPctOfExp = expTotal > 0 ? Math.round(rcAnnual / expTotal * 100) : 0;
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name bad">宗室俸禄压力</span><span class="tr-section-badge bad">明末之累</span></div>';
    html +=   '<div class="tr-alert bad">';
    html +=     '<span class="ttl">⚠ 宗室人口 ' + (rc.population||0).toLocaleString() + '</span>';
    html +=     '<div class="ds" style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:0.66rem;margin-top:4px;">';
    html +=       '<span style="color:var(--ink-300);">月俸成本</span><span style="color:var(--vermillion-300);">' + _neitangFmt(rcMonthly) + ' 两</span>';
    html +=       '<span style="color:var(--ink-300);">压库占年支</span><span style="color:var(--vermillion-300);">' + rcPctOfExp + '%</span>';
    html +=     '</div>';
    html +=     '<span class="chain">明末宗室禄米压库的悲剧 —— 弘治时 28 王，万历末 86 王，崇祯朝郡王 168。</span>';
    html +=   '</div>';
    html += '</section>';
  }

  // ─── 当前特别税 ───
  if (n.specialTaxActive) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">当前特别税</span><span class="tr-section-badge warn">已开</span></div>';
    html +=   '<div class="tr-alert warn"><span class="ttl">' + _escHtml(n.specialTaxType || '特别税') + '</span><span class="ds">月收 ' + _neitangFmt(n.specialTaxMonthly || 0) + ' 两 · 代价：民心 −5 · 皇威 −3</span></div>';
    html += '</section>';
  }

  // ─── 非常规收入 ───
  var incidentals = rules.incidentalSources || [];
  if (incidentals.length > 0 && typeof NeitangEngine !== 'undefined' && NeitangEngine.INCIDENTAL_TEMPLATES) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">非常规收入</span><span class="tr-section-badge">进奉 / 议罪银 / 贡物</span></div>';
    incidentals.forEach(function(src) {
      var tpl = NeitangEngine.INCIDENTAL_TEMPLATES[src.id];
      if (!tpl) return;
      html += '<div class="tr-incidental"><div class="in-name">' + _escHtml(tpl.name) + '</div><div class="in-hist">' + _escHtml(tpl.historical) + '</div></div>';
    });
    html += '</section>';
  }

  // ─── 调拨阻力 ───
  if (rules.transferResistance) {
    var tr3 = rules.transferResistance;
    var gn = tr3.guokuToNeicang || 0;
    var ng = tr3.neicangToGuoku || 0;
    if (gn > 0 || ng > 0) {
      var gnCls = gn > 0.7 ? 'high' : gn > 0.4 ? 'mid' : 'low';
      var ngCls = ng > 0.7 ? 'high' : ng > 0.4 ? 'mid' : 'low';
      var gnLbl = gn > 0.7 ? '廷议激烈' : gn > 0.4 ? '受质疑' : '顺畅';
      var ngLbl = ng > 0.7 ? '近臣阻挠' : ng > 0.4 ? '受阻' : '多顺遂';
      html += '<section class="tr-section">';
      html +=   '<div class="tr-section-head"><span class="tr-section-name">调拨阻力</span><span class="tr-section-badge">廷议 / 近臣</span></div>';
      html +=   '<div style="padding:8px 10px;background:rgba(0,0,0,0.18);border:1px solid var(--bdr);border-radius:5px;">';
      html +=     '<div class="tr-resist-row"><span class="rs-lbl">帑廪 → 内帑</span><div class="rs-bar ' + gnCls + '"><span style="width:' + (gn*100).toFixed(0) + '%;"></span></div><span class="rs-val ' + gnCls + '">' + (gn*100).toFixed(0) + '% · ' + gnLbl + '</span></div>';
      html +=     '<div class="tr-resist-row"><span class="rs-lbl">内帑 → 帑廪</span><div class="rs-bar ' + ngCls + '"><span style="width:' + (ng*100).toFixed(0) + '%;"></span></div><span class="rs-val ' + ngCls + '">' + (ng*100).toFixed(0) + '% · ' + ngLbl + '</span></div>';
      html +=   '</div>';
      html += '</section>';
    }
  }

  // ─── 历史趋势 ───
  html += _neitang_renderTrendSection();

  // ─── 措置入口 ───
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">如何措置</span><span class="tr-section-badge">陛下行止 4 道</span></div>';
  html +=   '<div class="tr-action-grid">';
  html +=     _neitangActionBtn('⊕ 写诏', '帑廪⇄内帑互转 / 开特别税 / 大典', 'gt-edict');
  html +=     _neitangActionBtn('⊕ 看奏疏', '内廷近臣 / 户部 奏报', 'gt-memorial');
  html +=     _neitangActionBtn('⊕ 问对', '内廷近臣 商议敏感财政', 'gt-wendui');
  html +=     '<button class="tr-action-btn" onclick="if(typeof _neitang_rescueGuoku===\'function\')_neitang_rescueGuoku()"><span class="ac-name">⊕ 罄帑济国</span><span class="ac-hint">皇威 +3 · 民心 +2 · 群臣感泣</span></button>';
  html +=   '</div>';
  html +=   '<div class="tr-action-tip">※ 开矿税 / 织造贡 / 市舶抽分 / 大典 等举措，请在【诏令】写诏。</div>';
  html += '</section>';

  // ─── 年度决算 ───
  var yearly = (n.history && n.history.yearly) || [];
  if (yearly.length > 0) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">年度决算</span><span class="tr-section-badge">' + yearly.length + ' 年</span></div>';
    yearly.slice(-5).reverse().forEach(function(y) {
      var netCls = y.netChange >= 0 ? 'up' : 'down';
      html += '<div class="tr-yearly-row">'+
        '<span class="yr">' + y.year + '年</span>'+
        '<span class="meta">入 ' + _neitangFmt(y.totalIncome) + ' · 出 ' + _neitangFmt(y.totalExpense) + '</span>'+
        '<span class="net ' + netCls + '">' + (y.netChange >= 0 ? '+' : '') + _neitangFmt(y.netChange) + '</span>'+
        '</div>';
    });
    html += '</section>';
  }

  body.innerHTML = html;
}

// 措置按钮 helper
function _neitangActionBtn(name, hint, tabId) {
  var safeName = String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  var safeHint = String(hint).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<button class="tr-action-btn" onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '<span class="ac-name">' + safeName + '</span>' +
    '<span class="ac-hint">' + safeHint + '</span>' +
  '</button>';
}

function _neitang_renderTrendSection() {
  var snaps = ((GM.neitang && GM.neitang.history && GM.neitang.history.monthly) || []);
  if (snaps.length < 2) {
    return '<section class="tr-section">'+
      '<div class="tr-section-head"><span class="tr-section-name">内帑趋势</span><span class="tr-section-badge">待累积</span></div>'+
      '<div class="vd-empty">需至少 2 回合数据方可展示</div>'+
    '</section>';
  }
  var data = snaps.slice(-60);
  var W = 400, H = 100, PAD = { l:40, r:8, t:8, b:20 };
  var innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  var maxB = 0, minB = 0;
  data.forEach(function(d) {
    if (d.balance > maxB) maxB = d.balance;
    if (d.balance < minB) minB = d.balance;
  });
  if (maxB === minB) maxB = minB + 1;
  var maxT = data[data.length-1].turn, minT = data[0].turn;
  var spanT = Math.max(1, maxT - minT);
  function xOf(t) { return PAD.l + (t - minT) / spanT * innerW; }
  function yOf(v) { return PAD.t + (1 - (v - minB) / (maxB - minB)) * innerH; }

  var pts = data.map(function(d) { return [xOf(d.turn), yOf(d.balance)]; });
  var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">';
  svg += '<text x="2" y="' + (PAD.t + 8) + '" font-size="9" fill="var(--txt-d)">' + _neitangFmt(maxB) + '</text>';
  svg += '<text x="2" y="' + (H - PAD.b + 4) + '" font-size="9" fill="var(--txt-d)">' + _neitangFmt(minB) + '</text>';
  svg += '<path d="' + pathD + '" fill="none" stroke="var(--gold-300)" stroke-width="2"/>';
  svg += '<text x="' + PAD.l + '" y="' + (H - 4) + '" font-size="9" fill="var(--txt-d)">T' + minT + '</text>';
  svg += '<text x="' + (W - PAD.r) + '" y="' + (H - 4) + '" text-anchor="end" font-size="9" fill="var(--txt-d)">T' + maxT + '</text>';
  svg += '</svg>';
  return '<section class="tr-section">'+
    '<div class="tr-section-head"><span class="tr-section-name">内帑趋势</span><span class="tr-section-badge">' + data.length + ' 月</span></div>'+
    '<div class="tr-trend-wrap">' + svg + '</div></section>';
}

// ─── 动作 handlers ───
function _neitang_transferFromGuoku() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">帑廪调内帑</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '从国库拨银入内帑。常规操作。'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">调拨金额（两）</label>'+
      '<input id="ntTransferAmt" type="number" value="100000" min="1" style="width:100%;padding:5px 8px;">'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('帑廪调内帑', html, function() {
      var amt = Number((document.getElementById('ntTransferAmt')||{}).value) || 100000;
      var r = NeitangEngine.Actions.transferFromGuoku(amt);
      if (typeof toast === 'function') toast(r.success ? '已调拨' : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderNeitangPanel();
      if (typeof renderGuokuPanel === 'function' && document.getElementById('guoku-drawer-ov')) renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _neitang_rescueGuoku() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">罄内帑济国</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '陛下以私帑济国用。群臣感泣，民心皇威皆升。'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">捐输金额（两）</label>'+
      '<input id="ntRescueAmt" type="number" value="100000" min="1" style="width:100%;padding:5px 8px;">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '代价：内帑 - 金额 · 收益：皇威 +3 · 民心 +2'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('罄内帑济国', html, function() {
      var amt = Number((document.getElementById('ntRescueAmt')||{}).value) || 100000;
      var r = NeitangEngine.Actions.rescueGuoku(amt);
      if (typeof toast === 'function') toast(r.success ? '已济国' : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderNeitangPanel();
      if (typeof renderGuokuPanel === 'function' && document.getElementById('guoku-drawer-ov')) renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _neitang_enableSpecial(type, monthly) {
  var r = NeitangEngine.Actions.enableSpecialTax(type, monthly);
  if (typeof toast === 'function') toast(r.success ? ('已开' + type) : ('未成：' + r.reason));
  renderNeitangPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _neitang_disableSpecial() {
  var r = NeitangEngine.Actions.disableSpecialTax();
  if (typeof toast === 'function') toast(r.success ? '已罢' : ('未成：' + r.reason));
  renderNeitangPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _neitang_ceremony(type) {
  var typeLabels = { major:'封禅/万寿', middle:'千叟宴/大飨', minor:'郊祀/常礼' };
  var r = NeitangEngine.Actions.holdCeremony(type);
  if (typeof toast === 'function') toast(r.success ? ('已举' + typeLabels[type]) : ('未成：' + r.reason));
  renderNeitangPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeNeitangPanel();
});
