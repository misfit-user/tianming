// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 内帑（皇室私库）详情面板
// 设计：设计方案-财政系统.md 决策 F
// 数据：GM.neitang
// ═══════════════════════════════════════════════════════════════

function _neitangFmt(v) {
  if (v == null || !Number.isFinite(Number(v))) return '未具数';
  v = Math.round(Number(v));
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
  if (window.TM && TM.NativeFiscalUI && TM.NativeFiscalUI.open('private')) return;
  var ov = document.getElementById('neitang-drawer-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'neitang-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="neitang-drawer">'+
      '<div class="var-drawer-header">'+
        '<div>'+
          '<div class="var-drawer-title">内帑之察 · 宫中钱物</div>'+
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
  document.querySelectorAll('.var-drawer-overlay.open').forEach(function(other) { if (other !== ov) other.classList.remove('open'); });
  ov.classList.add('open');
}

function closeNeitangPanel() {
  if (window.TM && TM.NativeFiscalUI) TM.NativeFiscalUI.close();
  var ov = document.getElementById('neitang-drawer-ov');
  if (ov) ov.classList.remove('open');
}

function renderNeitangPanel() {
  var body = document.getElementById('neitang-body'), subt = document.getElementById('neitang-subtitle');
  if (!body) return;
  if (window.TM && TM.NativeFiscal && TM.NativeFiscal.enabled(GM) && TM.NativeFiscalUI) {
    body.innerHTML = TM.NativeFiscalUI.render(GM, 'private');
    if (subt) subt.textContent = GM.neitang && GM.neitang.enabled ? '本局明确私人账户' : '本开局未启用私库';
    return;
  }
  var n = GM.neitang || {}, F = typeof FiscalEngine !== 'undefined' ? FiscalEngine : {};
  var context = typeof NeitangEngine !== 'undefined' && NeitangEngine.getAccountContext ? NeitangEngine.getAccountContext() : null;
  if (context && (!context.internalRef || (context.view && !context.view.known))) {
    if (subt) subt.textContent = '内库簿籍未具';
    body.innerHTML = '<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">内库簿籍未具</span></div><div class="tr-alert"><span class="ds">尚未收到此廷宫中钱物的独立收支册。可令掌事者具报来源、现存与支用，再行议拨。</span></div>'+_neitangActionBtn('问对','召掌事者具报内库','gt-wendui')+'</section>';
    return;
  }
  var statement = F.readAccountStatement ? F.readAccountStatement({game:GM,account:n,scope:'internal'}) : {account:n,forecast:n.flowBasis==='forecast',unit:n.unit};
  _neitangRenderPanelBody(body, subt, statement.account, statement, context);
}

function _neitangRenderPanelBody(body, subt, n, statement, context) {
  var turnDays = n.turnDays || (n.accounting && n.accounting.days) || (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30);
  var periodLbl = statement.periodStatus === 'previous' ? '上期交割 ' + turnDays + ' 日' : (statement.forecast ? '预计' : '') + (turnDays === 30 ? '月' : '本期 ' + turnDays + ' 日');
  var lbl = periodLbl + '入 ' + _neitangFmt((n.turnIncome != null ? n.turnIncome : n.monthlyIncome != null ? n.monthlyIncome * turnDays / 30 : null)) +
            ' / ' + periodLbl + '支 ' + _neitangFmt((n.turnExpense != null ? n.turnExpense : n.monthlyExpense != null ? n.monthlyExpense * turnDays / 30 : null));
  if (n.crisis && n.crisis.active) lbl = '⚠ 空竭 · ' + lbl;
  if (subt) subt.textContent = lbl;

  var html = '';
  var U = statement.unit || n.unit || ((typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : {money:'两',grain:'石',cloth:'匹'});
  var books = _neitangAccountBooks(context, n, U);
  var titleNode = document.querySelector && document.querySelector('#neitang-drawer .var-drawer-title');
  if (titleNode) titleNode.textContent = (n.displayName || (context && context.view && context.view.name) || '内帑之察') + ' · 宫中钱物';
  var ledgers = n.ledgers || {};
  var moneyLed = ledgers.money || {};
  var grainLed = ledgers.grain || {};
  var clothLed = ledgers.cloth || {};
  var stockMoney = books.stocks ? books.stocks.money : (moneyLed.stock != null ? moneyLed.stock : n.balance);
  var stockGrain = books.stocks ? books.stocks.grain : grainLed.stock;
  var stockCloth = books.stocks ? books.stocks.cloth : clothLed.stock;

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
    statePillHtml = '<span class="tr-pill ok">钱储约支 ' + Math.round(months) + ' 月</span>';
  } else {
    statePillHtml = '<span class="tr-pill muted">用度待核</span>';
  }

  // tags
  var tagsHtml = '';
  // 内廷侵吞
  if (GM.corruption && GM.corruption.subDepts && GM.corruption.subDepts.imperial) {
    var ic = GM.corruption.subDepts.imperial.true;
    if (ic > 30) {
      var leakPct = Math.round(ic / 100 * 0.5 * 100);
      tagsHtml += statement.budget ? '<span class="tr-pill bad">内廷吏弊偏重</span>' : '<span class="tr-pill bad">⚠ 内廷侵吞 ' + leakPct + '%</span>';
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

  if (books.stocks) statePillHtml += '<span class="tr-pill gold">宫中诸库合计</span>';
  var deltaVal = n.lastDelta != null ? n.lastDelta : 0;
  var netLabel = statement.periodStatus === 'previous' ? '上期结余' : statement.forecast ? '本期预计结余' : '本期结余';
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
  html +=         '<span><b>' + netLabel + '</b>' + (deltaVal >= 0 ? '+' : '') + _neitangFmt(deltaVal) + '</span>';
  html +=         '<span><b>' + periodLbl + '入</b>' + _neitangFmt((n.turnIncome != null ? n.turnIncome : n.monthlyIncome != null ? n.monthlyIncome * turnDays / 30 : null)) + '</span>';
  html +=       '</div>';
  if (tagsHtml) html += '<div class="tr-hero-tags">' + tagsHtml + '</div>';
  html +=     '</div>';
  html +=   '</div>';
  html += '</div>';

  html += books.html;
  var outstanding = ['money','grain','cloth'].filter(function(k){return Number((ledgers[k]||{}).deficit)>0;});
  if(outstanding.length){
    html += '<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">已欠待给</span><span class="tr-section-badge">尚未支出</span></div>';
    outstanding.forEach(function(k){var led=ledgers[k];html+='<div class="tr-flow-tops"><b>'+(k==='money'?'钱':k==='grain'?'粮':'帛')+'</b><span>'+_neitangExact(led.deficit)+' '+_escHtml(U[k])+'</span></div>';Object.keys(led.deficitDetails||{}).forEach(function(tag){(led.deficitDetails[tag]||[]).filter(function(r){return r.amount>0;}).forEach(function(r){html+='<div class="tr-flow-tops"><span>'+_escHtml(r.name||'未署名欠款')+'</span><span>'+_neitangExact(r.amount)+' '+_escHtml(U[k])+'</span></div>';});});});
    html += '</section>';
  }

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
  html +=   '<div class="tr-section-head"><span class="tr-section-name">回合速察</span><span class="tr-section-badge">宫中钱物</span></div>';
  html +=   '<div class="tr-quickstats">';
  // 回合入
  var turnIn = (n.turnIncome != null ? n.turnIncome : n.monthlyIncome != null ? n.monthlyIncome * turnDays / 30 : null);
  html +=     '<div class="tr-qs"><div class="tr-qs-label">' + periodLbl + '入</div><div class="tr-qs-val up">' + _neitangFmt(turnIn) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 回合支
  var turnOut = (n.turnExpense != null ? n.turnExpense : n.monthlyExpense != null ? n.monthlyExpense * turnDays / 30 : null);
  html +=     '<div class="tr-qs"><div class="tr-qs-label">' + periodLbl + '支</div><div class="tr-qs-val">' + _neitangFmt(turnOut) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 增减
  var deltaCls2 = deltaVal > 0 ? 'up' : deltaVal < 0 ? 'down' : '';
  html +=     '<div class="tr-qs"><div class="tr-qs-label">' + netLabel + '</div><div class="tr-qs-val ' + deltaCls2 + '">' + (deltaVal >= 0 ? '+' : '') + _neitangFmt(deltaVal) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 内廷侵吞
  if (GM.corruption && GM.corruption.subDepts && GM.corruption.subDepts.imperial) {
    var ic2 = GM.corruption.subDepts.imperial.true || 0;
    var leakP = Math.round(ic2 / 100 * 0.5 * 100);
    var leakCls = leakP > 30 ? 'down' : leakP > 15 ? 'warn' : '';
    html += statement.budget ? '<div class="tr-qs"><div class="tr-qs-label">内廷吏弊</div><div class="tr-qs-val ' + leakCls + '">' + Math.round(ic2) + '</div><div class="tr-qs-sub">吏治察核 · 百分制</div></div>' : '<div class="tr-qs"><div class="tr-qs-label">内廷侵吞</div><div class="tr-qs-val ' + leakCls + '">' + leakP + '%</div><div class="tr-qs-sub">腐败 ' + Math.round(ic2) + '</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">内廷侵吞</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">未测</div></div>';
  }
  // 宗室口数
  if (n._royalClan) {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">宗室口数</div><div class="tr-qs-val warn">' + _neitangFmt(n._royalClan.population || 0) + '</div><div class="tr-qs-sub">宗支禄给</div></div>';
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
    html +=   '<div class="tr-qs"><div class="tr-qs-label">调拨阻力</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">尚待议定</div></div>';
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
    var led = ledgers[m.key] || {};
    var ti = led.thisTurnIn != null ? led.thisTurnIn : led.lastTurnIn;
    var to = led.thisTurnOut != null ? led.thisTurnOut : led.lastTurnOut;
    var net = (Number(ti) || 0) - (Number(to) || 0);
    var netCls = net >= 0 ? 'delta-up' : 'delta-down';
    html += '<div class="tr-led ' + m.cls + '">';
    html +=   '<div class="tr-led-name">' + m.name + '</div>';
    html +=   '<div class="tr-led-stock">' + _neitangFmt(led.stock) + '</div>';
    html +=   '<div class="tr-led-unit">' + m.unit + '</div>';
    if (ti != null || to != null) {
      html += '<div class="tr-led-flow"><span>' + (statement.forecast ? '预计入 ' : '实入 ') + _neitangFmt(ti) + '</span><span>' + (statement.forecast ? '预计支 ' : '实支 ') + _neitangFmt(to) + '</span></div>';
      html += '<div class="tr-led-flow"><span>' + netLabel + '</span><span class="' + netCls + '">' + (net >= 0 ? '+' : '') + _neitangFmt(net) + '</span></div>';
    }
    html += '</div>';
  });
  html +=   '</div>';
  html += '</section>';

  var srcLabels = {huangzhuang:'皇庄',huangchan:'皇产',specialTax:'特别税',confiscation:'抄没',tribute:'朝贡',guokuTransfer:'帑廪转运',other:'其余收入'};
  var expLabels = {gongting:'宫廷用度',dadian:'大典',shangci:'赏赐',houGongLingQin:'后宫陵寝',guokuRescue:'接济帑廪',other:'其余支用'};
  var expenses = n.expenses || {}, expTotal = Object.keys(expenses).reduce(function(total,k) {return total + (Number(expenses[k]) || 0);},0);
  html += _neitangAnnualDetails(n, statement, true, U, srcLabels);
  html += _neitangAnnualDetails(n, statement, false, U, expLabels);

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
    html +=   '<div class="tr-section-head"><span class="tr-section-name bad">宗室俸禄压力</span><span class="tr-section-badge bad">宗支禄给</span></div>';
    html +=   '<div class="tr-alert bad">';
    html +=     '<span class="ttl">⚠ 宗室人口 ' + (rc.population||0).toLocaleString() + '</span>';
    html +=     '<div class="ds" style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:0.7rem;margin-top:4px;">';
    html +=       '<span style="color:var(--ink-300);">月俸成本</span><span style="color:var(--vermillion-300);">' + _neitangFmt(rcMonthly) + ' ' + _escHtml(U.money) + '</span>';
    html +=       '<span style="color:var(--ink-300);">压库占年支</span><span style="color:var(--vermillion-300);">' + rcPctOfExp + '%</span>';
    html +=     '</div>';
    html +=     '<span class="chain">宗支禄给随在册人数及现行支给额计。</span>';
    html +=   '</div>';
    html += '</section>';
  }

  // ─── 当前特别税 ───
  if (n.specialTaxActive) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">当前特别税</span><span class="tr-section-badge warn">已开</span></div>';
    html +=   '<div class="tr-alert warn"><span class="ttl">' + _escHtml(n.specialTaxType || '特别税') + '</span><span class="ds">月收 ' + _neitangFmt(n.specialTaxMonthly || 0) + ' ' + _escHtml(U.money) + ' · 征收与支用另具凭由</span></div>';
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
  html +=     '<button class="tr-action-btn" onclick="_neitang_transferFromGuoku()"><span class="ac-name">⊕ 拨给宫中</span><span class="ac-hint">从国用移交内库</span></button>';
  html +=     '<button class="tr-action-btn" onclick="_neitang_rescueGuoku()"><span class="ac-name">⊕ 拨充国用</span><span class="ac-hint">据存量另立交割</span></button>';
  html +=   '</div>';
  html +=   '<div class="tr-action-tip">※ 定供、赐予、礼仪支用与移拨钱粮，可在【诏令】具明用途与所出之库。</div>';
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

function _neitangExact(v) {
  return v == null || !Number.isFinite(Number(v)) ? '未具数' : Number(v).toLocaleString('zh-CN',{maximumFractionDigits:4});
}
function _neitangAccountBooks(context, n, U) {
  var F=typeof FiscalEngine!=='undefined'?FiscalEngine:{}, factionId=context&&context.factionId, main=context&&context.view;
  var registry=F.listAccountViews?F.listAccountViews({game:GM,scope:'palace',factionId:factionId}):null;
  if(!registry||!registry.known)return {html:'',stocks:null};
  var whole=F.getConsolidatedView({game:GM,scope:'palace',factionId:factionId}), ids=whole&&whole.physicalAccountIds||[], seen={},stocks={},available={};
  ['money','grain','cloth'].forEach(function(k){stocks[k]=whole&&whole.resources&&whole.resources[k]&&whole.resources[k].stock;var r=main&&main.resources&&main.resources[k];available[k]=r&&(r.available!=null?r.available:r.stock);});
  function values(v){return ['money','grain','cloth'].map(function(k){return '<span><b>'+(k==='money'?'钱':k==='grain'?'粮':'帛')+'</b> '+_neitangExact(v[k])+' '+_escHtml(U[k])+'</span>';}).join('　');}
  var rows='';(registry.accounts||[]).forEach(function(a){var members=a.physicalAccountIds||[];if(a.kind==='pool'||!members.some(function(id){return ids.indexOf(id)>=0&&!seen[id];}))return;members.forEach(function(id){seen[id]=true;});var stock={};['money','grain','cloth'].forEach(function(k){stock[k]=a.resources&&a.resources[k]&&a.resources[k].stock;});rows+='<div class="tr-flow-tops"><b>'+_escHtml(a.name)+'</b><div>'+values(stock)+'</div></div>';});
  var html='<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">收掌与用度</span></div><div class="tr-alert"><span class="ds">'+_escHtml(n.accountScope||'宫中钱物各有收掌，供给、赐予与调拨分别立账。')+'</span><span class="ds">'+_escHtml(n.custodyNote||'钱物未交割，不作已收；已分各司者，各记所存。')+'</span></div></section>';
  if(rows)html+='<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">宫中分库簿</span><span class="tr-section-badge">各有专掌</span></div>'+rows+'<div class="tr-flow-tops"><b>合计</b><div>'+values(stocks)+'</div></div></section>';
  html+='<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">内库总库可支</span><span class="tr-section-badge">待命支拨</span></div>'+values(available)+'</section>';
  return {html:html,stocks:stocks};
}
function _neitangAnnualDetails(n, statement, income, U, labels) {
  var key=income?'sources':'expenses',byResource=income?statement.sourceDetailsByResource:statement.expenseDetailsByResource,kind=income?'income':'expense',title=income?'岁入分项':'岁出分项';
  var html='<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">'+title+'</span><span class="tr-section-badge">'+(statement.forecast?'预计年额':'本期折年')+'</span></div>',has=false;
  ['money','grain','cloth'].forEach(function(resource){
    var detail=byResource&&byResource[resource]||(resource==='money'?n[key+'Detail']:null)||{},totals=resource==='money'?n[key]||{}:{};
    if(resource!=='money')Object.keys(detail).forEach(function(category){totals[category]=(detail[category]||[]).reduce(function(sum,row){return sum+(Number(row.amount)||0);},0);});
    var cats=Object.keys(totals).filter(function(category){return Number(totals[category])>0;}),total=cats.reduce(function(sum,category){return sum+Number(totals[category]);},0);
    if(!cats.length)return;has=true;html+='<div class="tr-flow-group '+kind+'"><div class="tr-flow-head"><span>'+(resource==='money'?'钱':resource==='grain'?'粮':'帛')+'（年）</span><span class="total">'+_neitangExact(total)+' '+_escHtml(U[resource])+'</span></div>';
    cats.forEach(function(category){var val=Number(totals[category]),pct=total>0?val/total*100:0;html+='<div class="tr-flow-row '+kind+'"><span class="lbl">'+_escHtml(labels[category]||'其他已列款项')+'</span><div class="bar"><span style="width:'+pct.toFixed(1)+'%;"></span></div><span class="v">'+_neitangExact(val)+'<span class="pct">'+pct.toFixed(1)+'%</span></span></div>';
      (Array.isArray(detail[category])?detail[category]:[]).forEach(function(row){html+='<div class="tr-flow-tops"><span>'+_escHtml(row.name||labels[category]||'未署名款项')+'</span><span>'+_neitangExact(row.amount)+' '+_escHtml(U[resource])+'</span></div>';});
    });html+='</div>';
  });
  return html+(has?'':'<div class="vd-empty">本册尚无已列'+(income?'收入':'支用')+'。</div>')+'</section>';
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
      '<div class="vd-empty">尚待续记收支，方可观其增减。</div>'+
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
    '<div class="tr-section-head"><span class="tr-section-name">内帑趋势</span><span class="tr-section-badge">' + data.length + ' 期</span></div>'+
    '<div class="tr-trend-wrap">' + svg + '</div></section>';
}

// ─── 动作 handlers ───
function _neitang_transferFromGuoku() {
  if (NeitangEngine.isExplicit && NeitangEngine.isExplicit()) {var ctx=NeitangEngine.getAccountContext();return _neitangOpenResourceTransfer(ctx.centralRef,ctx.internalRef,'拨给宫中');}
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">帑廪调内帑</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '按支用缓急，从国用拨给宫中；钱物移交后，两库各留凭由。'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">调拨钱数（' + _escHtml((GM.neitang&&GM.neitang.unit&&GM.neitang.unit.money)||'两') + '）</label>'+
      '<input id="ntTransferAmt" type="number" value="100000" min="1" style="width:100%;padding:5px 8px;">'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('帑廪调内帑', html, function() {
      var amt = Number((document.getElementById('ntTransferAmt')||{}).value);
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
  if (NeitangEngine.isExplicit && NeitangEngine.isExplicit()) {var ctx=NeitangEngine.getAccountContext();return _neitangOpenResourceTransfer(ctx.internalRef,ctx.centralRef,'拨充国用');}
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">罄内帑济国</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '从宫中内库拨钱充国用。应先计宫中已定支给，勿使两处俱乏。'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">调拨钱数（' + _escHtml((GM.neitang&&GM.neitang.unit&&GM.neitang.unit.money)||'两') + '）</label>'+
      '<input id="ntRescueAmt" type="number" value="100000" min="1" style="width:100%;padding:5px 8px;">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '内库依数减存，国用依数收讫。'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('罄内帑济国', html, function() {
      var amt = Number((document.getElementById('ntRescueAmt')||{}).value);
      var r = NeitangEngine.Actions.rescueGuoku(amt);
      if (typeof toast === 'function') toast(r.success ? '已济国' : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderNeitangPanel();
      if (typeof renderGuokuPanel === 'function' && document.getElementById('guoku-drawer-ov')) renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _neitangOpenResourceTransfer(from,to,title) {
  if(!from||!to){if(typeof toast==='function')toast('两库簿籍未齐，尚无法调拨');return;}
  if(typeof openGenericModal!=='function')return;
  var budget=NeitangEngine.getBudgetView(), U=budget?budget.period.unit:((GM.neitang&&GM.neitang.unit)||{money:'贯',grain:'石',cloth:'匹'}), kinds=[['money','钱'],['grain','粮'],['cloth','帛']];
  var id='palace-transfer:'+String(GM.turn||0)+':'+String(Date.now())+':'+String(Math.random()).slice(2);
  var view=typeof FiscalEngine!=='undefined'&&FiscalEngine.getAccountView?FiscalEngine.getAccountView({game:GM,ref:from}):null;
  var html='<div style="padding:1rem"><p>请写明移交实数；各物各计，不折合挪补。</p>';
  kinds.forEach(function(m){var stock=view&&view.known&&view.resources&&view.resources[m[0]]?view.resources[m[0]].available:null;html+='<label style="display:block;margin:8px 0">'+m[1]+'（'+_escHtml(U[m[0]])+'）'+(stock==null?'':' · 可拨 '+Number(stock).toLocaleString('zh-CN',{maximumFractionDigits:4}))+'<input id="neitang-transfer-'+m[0]+'" type="number" min="0" value="0" style="width:100%;padding:6px"></label>';});
  html+='<p>支给库减存，承领库收讫，逐项交割。</p></div>';
  openGenericModal(title,html,function(){var amounts={};kinds.forEach(function(m){var n=document.getElementById('neitang-transfer-'+m[0]);amounts[m[0]]=Number(n&&n.value);});
    var result=NeitangEngine.Actions.transferResources({from:from,to:to,amounts:amounts,reason:title,transactionId:id});
    if(typeof toast==='function')toast(result.success?'钱物已交割':('未成：'+(result.reason||'请核调拨数目与库中实存')));
    if(!result.success)return;
    if(typeof closeGenericModal==='function')closeGenericModal();renderNeitangPanel();
    if(typeof renderGuokuPanel==='function'&&document.getElementById('guoku-drawer-ov'))renderGuokuPanel();
    if(typeof renderTopBarVars==='function')renderTopBarVars();
  });
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
