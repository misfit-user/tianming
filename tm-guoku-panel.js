// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 帑廪（国库）详情面板
// 设计：设计方案-财政系统.md
// 数据：GM.guoku
// ═══════════════════════════════════════════════════════════════

// 数字格式化
function _guokuFmt(v) {
  v = Math.round(v || 0);
  if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 10000) return Math.round(v/10000) + '万';
  return v.toString();
}

// 跳转中间栏标签页（取代原操作按钮）
function _guokuTabJump(label, tabId) {
  var safeLabel = String(label).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
    'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '→ <b>' + safeLabel + '</b>（切至标签页处理）' +
  '</div>';
}

// 开启面板
function openGuokuPanel() {
  var ov = document.getElementById('guoku-drawer-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'guoku-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="guoku-drawer">'+
      '<div class="var-drawer-header">'+
        '<div>'+
          '<div class="var-drawer-title">帑廪之察 · 岁入岁出</div>'+
          '<div class="var-drawer-subtitle" id="guoku-subtitle"></div>'+
        '</div>'+
        '<button class="var-drawer-close" onclick="closeGuokuPanel()">×</button>'+
      '</div>'+
      '<div class="var-drawer-body" id="guoku-body"></div>'+
    '</div>';
    ov.addEventListener('click', function(e) {
      if (e.target === ov) closeGuokuPanel();
    });
    document.body.appendChild(ov);
  }
  ov.classList.add('open');   // 先打开抽屉（防止 render 抛错导致抽屉不弹）
  // 确保三账已初始化（首次打开时 CascadeTax 可能尚未跑过）
  try {
    if (typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.ensureModel === 'function') GuokuEngine.ensureModel();
    if (typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.ensureModel === 'function') NeitangEngine.ensureModel();
  } catch(_e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'openGuokuPanel] ensureModel') : console.warn('[openGuokuPanel] ensureModel', _e); }
  try { renderGuokuPanel(); } catch(_re) {
    console.error('[openGuokuPanel] renderGuokuPanel threw:', _re);
    var body = document.getElementById('guoku-body');
    if (body) body.innerHTML = '<div style="padding:1rem;color:var(--vermillion-400);font-size:0.78rem;">渲染失败：' + (_re.message||_re) + '</div><pre style="font-size:0.62rem;color:var(--color-foreground-muted);white-space:pre-wrap;padding:0.5rem;">' + (_re.stack||'') + '</pre>';
  }
}

function closeGuokuPanel() {
  var ov = document.getElementById('guoku-drawer-ov');
  if (ov) ov.classList.remove('open');
}

function renderGuokuPanel() {
  var body = document.getElementById('guoku-body');
  var subt = document.getElementById('guoku-subtitle');
  if (!body) return;

  var g = GM.guoku || {};
  var turnDays = g.turnDays || 30;
  var periodLbl = turnDays === 30 ? '月' : '回合';
  var subtLbl = periodLbl + '入 ' + _guokuFmt(g.turnIncome || g.monthlyIncome || 0) +
                ' / ' + periodLbl + '支 ' + _guokuFmt(g.turnExpense || g.monthlyExpense || 0);
  if (g.bankruptcy && g.bankruptcy.active) subtLbl = '⚠ 破产 · ' + subtLbl;
  if (subt) subt.textContent = subtLbl;

  var html = '';
  var U = (typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : { money:'两', grain:'石', cloth:'匹' };
  var ledgers = g.ledgers || {};
  var moneyLed = ledgers.money || { stock:0 };
  var grainLed = ledgers.grain || { stock:0 };
  var clothLed = ledgers.cloth || { stock:0 };

  // ─── Hero · 国库纪要 ───
  var stockMoney = (moneyLed.stock != null ? moneyLed.stock : (g.balance || 0));
  var stockGrain = grainLed.stock || 0;
  var stockCloth = clothLed.stock || 0;
  var balanceClass = stockMoney < 0 ? 'bad' :
                     stockMoney < (g.annualIncome || 1) * 0.2 ? 'warn' : '';
  // 状态标签
  var statePillHtml = '';
  if (g.bankruptcy && g.bankruptcy.active) {
    statePillHtml = '<span class="tr-pill bad">⚠ 破产 · ' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月</span>';
  } else if (stockMoney < 0) {
    statePillHtml = '<span class="tr-pill bad">亏空</span>';
  } else if (stockMoney < (g.annualIncome || 1) * 0.2) {
    statePillHtml = '<span class="tr-pill warn">紧 · 不足年入两成</span>';
  } else if (stockMoney < (g.annualIncome || 1) * 0.5) {
    statePillHtml = '<span class="tr-pill gold">尚可</span>';
  } else {
    statePillHtml = '<span class="tr-pill ok">充裕</span>';
  }
  // tags
  var tagsHtml = '';
  if (GM.currency && GM.currency.inflationPressure > 0.3) {
    tagsHtml += '<span class="tr-pill bad">通胀压力 ' + GM.currency.inflationPressure.toFixed(2) + '</span>';
  }
  if (g.emergency && g.emergency.loan && g.emergency.loan.active) {
    tagsHtml += '<span class="tr-pill warn">借贷在册 · 余 ' + Math.ceil(g.emergency.loan.monthsLeft || 0) + ' 月</span>';
  }
  if (GM.currency && GM.currency.privateCastBanned) {
    tagsHtml += '<span class="tr-pill ok">私铸已禁</span>';
  }
  if (GM.currency && GM.currency.latestCoin) {
    tagsHtml += '<span class="tr-pill gold">' + _escHtml(GM.currency.latestCoin) + '</span>';
  }
  if (GM.huangwei && GM.huangwei.index >= 90) {
    var bubble = (GM.huangwei.tyrantSyndrome && GM.huangwei.tyrantSyndrome.hiddenDamage && GM.huangwei.tyrantSyndrome.hiddenDamage.fiscalBubble) || 0;
    tagsHtml += '<span class="tr-pill bad">⚠ 暴君虚账 ' + _guokuFmt(bubble) + '</span>';
  }

  var deltaVal = g.lastDelta || 0;
  // ★ 中央年入 vs 全国官收·岁入与回合收入只统计中央上解部分·官府实收 = 中央 + 地方留存
  var _cas = (typeof GM !== 'undefined') ? GM._lastCascadeSummary : null;
  var _turnDaysForFrac = g.turnDays || turnDays || 30;
  var _turnFracOfYear = _turnDaysForFrac / 365;
  var _govActualAnnual = (_cas && _turnFracOfYear > 0)
    ? Math.round(((_cas.central.money || 0) + (_cas.localRetain.money || 0)) / _turnFracOfYear)
    : 0;
  html += '<div class="tr-hero">';
  html +=   '<div class="tr-hero-row">';
  html +=     '<div class="tr-hero-glyph">帑</div>';
  html +=     '<div class="tr-hero-main">';
  html +=       '<div class="tr-hero-stock-row">';
  html +=         '<span class="tr-hero-amount' + (balanceClass ? ' ' + balanceClass : '') + '">' + _guokuFmt(stockMoney) + '</span>';
  html +=         '<span class="tr-hero-unit">' + U.money + '</span>';
  html +=         statePillHtml;
  html +=       '</div>';
  html +=       '<div class="tr-hero-mini">';
  html +=         '<span><b>粮</b>' + _guokuFmt(stockGrain) + '<span class="mu">' + U.grain + '</span></span>';
  html +=         '<span><b>布</b>' + _guokuFmt(stockCloth) + '<span class="mu">' + U.cloth + '</span></span>';
  html +=         '<span><b>本回合</b>' + (deltaVal >= 0 ? '+' : '') + _guokuFmt(deltaVal) + '</span>';
  html +=         '<span title="仅中央上解部分（不含地方留存）·下方三数中的『官府实收』=中央+地方留存"><b>中央年入</b>' + _guokuFmt(g.annualIncome || 0) + '</span>';
  if (_govActualAnnual > 0) {
    html +=       '<span title="官府实收年化·中央上解 + 地方留存·与下方三数面板的『官府实收』同源"><b>全国官收(年)</b>' + _guokuFmt(_govActualAnnual) + '</span>';
  }
  html +=       '</div>';
  if (tagsHtml) html += '<div class="tr-hero-tags">' + tagsHtml + '</div>';
  html +=     '</div>';
  html +=   '</div>';
  html += '</div>';

  // ─── 6 格快览 ───
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">回合速察</span><span class="tr-section-badge">钱·中央实入·下方三数为全国口径</span></div>';
  html +=   '<div class="tr-quickstats">';
  // 回合入(中央)·与下方三数『官府实收』有别·此处只算上解中央部分
  var turnIn = g.turnIncome || g.monthlyIncome || 0;
  var _localRetainTurn = (_cas && _cas.localRetain) ? Math.round(_cas.localRetain.money || 0) : 0;
  var _qsInSub = _localRetainTurn > 0
    ? (U.money + ' · 地留 ' + _guokuFmt(_localRetainTurn))
    : U.money;
  html +=     '<div class="tr-qs" title="仅中央上解·若需全国官收看下方三数面板"><div class="tr-qs-label">中央' + periodLbl + '入</div><div class="tr-qs-val up">' + _guokuFmt(turnIn) + '</div><div class="tr-qs-sub">' + _qsInSub + '</div></div>';
  // 回合支
  var turnOut = g.turnExpense || g.monthlyExpense || 0;
  html +=     '<div class="tr-qs"><div class="tr-qs-label">' + periodLbl + '支</div><div class="tr-qs-val down">' + _guokuFmt(turnOut) + '</div><div class="tr-qs-sub">' + U.money + '</div></div>';
  // 增减
  var deltaCls = deltaVal >= 0 ? 'up' : 'down';
  var deltaCntStr = (g.bankruptcy && g.bankruptcy.consecutiveMonths > 0) ?
    ('连续赤字 ' + Math.round(g.bankruptcy.consecutiveMonths) + ' 月') : '';
  html +=     '<div class="tr-qs"><div class="tr-qs-label">回合增减</div><div class="tr-qs-val ' + deltaCls + '">' + (deltaVal >= 0 ? '+' : '') + _guokuFmt(deltaVal) + '</div><div class="tr-qs-sub">' + (deltaCntStr || (U.money)) + '</div></div>';
  // 实征率
  if (g.actualTaxRate !== undefined && g.actualTaxRate < 1) {
    var leakPct = Math.round((1 - g.actualTaxRate) * 100);
    var taxRateCls = g.actualTaxRate < 0.5 ? 'down' : g.actualTaxRate < 0.75 ? 'warn' : 'up';
    html +=   '<div class="tr-qs"><div class="tr-qs-label">实征率</div><div class="tr-qs-val ' + taxRateCls + '">' + Math.round(g.actualTaxRate * 100) + '%</div><div class="tr-qs-sub">漏损 ' + leakPct + '%</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">实征率</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">未结算</div></div>';
  }
  // 民心顺从
  if (GM.minxin && GM.minxin.trueIndex !== undefined) {
    var compl = Math.max(0.3, GM.minxin.trueIndex / 100 * 0.7 + 0.3);
    var complCls = compl > 0.9 ? 'up' : compl > 0.6 ? 'warn' : 'down';
    html +=   '<div class="tr-qs"><div class="tr-qs-label">民心顺从</div><div class="tr-qs-val ' + complCls + '">' + Math.round(compl * 100) + '%</div><div class="tr-qs-sub">民心 ' + Math.round(GM.minxin.trueIndex) + '</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">民心顺从</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">未测</div></div>';
  }
  // 皇权可调
  if (GM.huangquan) {
    var hq = GM.huangquan.index || 50;
    var hqLabel = hq < 35 ? '权臣段' : hq < 60 ? '制衡段' : hq > 80 ? '专制段' : '常态';
    var hqSub = hq < 35 ? '地方截留 50%' : hq < 60 ? '可支配 85%' : hq > 80 ? '压榨 +5%' : '可支配 95%';
    var hqCls = hq < 35 ? 'down' : hq > 80 ? 'warn' : '';
    html +=   '<div class="tr-qs"><div class="tr-qs-label">皇权可调</div><div class="tr-qs-val ' + hqCls + '" style="font-size:0.85rem;">' + hqLabel + '</div><div class="tr-qs-sub">' + hqSub + '</div></div>';
  } else {
    html +=   '<div class="tr-qs"><div class="tr-qs-label">皇权可调</div><div class="tr-qs-val">—</div><div class="tr-qs-sub">未测</div></div>';
  }
  html +=   '</div>';
  html += '</section>';

  // ─── 三账库存（钱/粮/布） ───
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
    var lowWarn = (m.key === 'grain' && (led.stock || 0) < 1000) ||
                  (m.key === 'money' && (led.stock || 0) < (g.annualIncome || 1) * 0.05);
    html += '<div class="tr-led ' + m.cls + '">';
    html +=   '<div class="tr-led-name">' + m.name + '</div>';
    html +=   '<div class="tr-led-stock">' + _guokuFmt(led.stock || 0) + '</div>';
    html +=   '<div class="tr-led-unit">' + m.unit + '</div>';
    if (ti || to) {
      html += '<div class="tr-led-flow"><span>入 ' + _guokuFmt(ti) + '</span><span class="' + netCls + '">Δ' + (net >= 0 ? '+' : '') + _guokuFmt(net) + '</span></div>';
    }
    if (lowWarn) html += '<div class="tr-led-warn">⚠ 见底</div>';
    html += '</div>';
  });
  html +=   '</div>';
  html += '</section>';

  // ─── 税赋三数（沿用 renderTaxThreeNumberBlock）───
  // cascade 跑过(GM._lastCascadeSummary 存在) 或 monthlyIncome > 0 即渲染·新版三数从 cascade 同源读
  var _hasCascade = !!(typeof GM !== 'undefined' && GM._lastCascadeSummary && (GM._lastCascadeSummary.central.money > 0 || GM._lastCascadeSummary.localRetain.money > 0));
  if (typeof renderTaxThreeNumberBlock === 'function' && (_hasCascade || g.monthlyIncome > 0)) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">税赋三数</span><span class="tr-section-badge">名义 / 官收 / 民缴 · ' + (turnDays === 30 ? '月入' : '回合') + '</span></div>';
    html +=   renderTaxThreeNumberBlock(g.monthlyIncome || 0, { label:'正赋钱粮 · ' + (turnDays === 30 ? '月入' : '回合'), unit:U.money });
    html += '</section>';
  }

  // ─── § 岁入分项·三账·本回合 ───
  var _tagNameMap = {
    tianfu:'田赋', tianfu_silver:'田赋折银', dingshui:'丁税',
    yongBu:'庸役折布', shangShui:'商税', yanlizhuan:'盐铁专卖',
    caoliang:'漕粮', shipaiShui:'市舶', quanShui:'榷税',
    juanNa:'捐纳', qita:'其他', mining:'矿冶', fishingTax:'渔课',
    // 自定义税种(剧本 fiscalConfig.customTaxes)·与 cascade _convertCustomTax 的 sourceTag 一致
    liaoxiang:'辽饷加派', chama:'茶马司', chaoguan:'钞关税',
    guanshui:'关税(月港)', junhu:'军户屯田'
  };
  // 兜底·若 sourceTag 不在 map 中·尝试从 scenario.fiscalConfig.customTaxes 找 name
  function _resolveTagName(tag) {
    if (_tagNameMap[tag]) return _tagNameMap[tag];
    try {
      var sc = (typeof findScenarioById === 'function' && GM && GM.sid) ? findScenarioById(GM.sid) : null;
      var cts = (sc && sc.fiscalConfig && sc.fiscalConfig.customTaxes) || [];
      for (var i = 0; i < cts.length; i++) {
        if (cts[i].id === tag || cts[i].sourceTag === tag) return cts[i].name || tag;
      }
    } catch(_){}
    return tag;
  }
  var _kindMeta = [
    { key:'money', name:'钱账', unit:U.money },
    { key:'grain', name:'粮账', unit:U.grain },
    { key:'cloth', name:'布账', unit:U.cloth }
  ];
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">岁入分项</span><span class="tr-section-badge">三账 · 本' + (turnDays === 30 ? '月' : '回合') + '</span></div>';
  var _anyIncome = false;
  _kindMeta.forEach(function(km) {
    var led = ledgers[km.key];
    if (!led) return;
    var srcMap = led.sources || {};
    var monthTotal = led.thisTurnIn || 0;
    var _sumSrc = 0;
    Object.keys(srcMap).forEach(function(t){ _sumSrc += srcMap[t] || 0; });
    var dispTotal = monthTotal || _sumSrc;
    if (dispTotal === 0) return;
    _anyIncome = true;
    html += '<div class="tr-flow-group income">';
    html +=   '<div class="tr-flow-head"><span>' + km.name + '（' + km.unit + '）</span><span class="total">本' + (turnDays === 30 ? '月' : '回') + ' ' + _guokuFmt(dispTotal) + '</span></div>';
    Object.keys(srcMap).forEach(function(tag){
      var val = srcMap[tag];
      if (!val) return;
      var pct = dispTotal > 0 ? (val / dispTotal * 100).toFixed(1) : 0;
      var barW = dispTotal > 0 ? Math.min(100, val / dispTotal * 100) : 0;
      html += '<div class="tr-flow-row income">';
      html +=   '<span class="lbl">' + _resolveTagName(tag) + '</span>';
      html +=   '<div class="bar"><span style="width:' + barW + '%;"></span></div>';
      html +=   '<span class="v">' + _guokuFmt(val) + '<span class="pct">' + pct + '%</span></span>';
      html += '</div>';
      // ★ 透明化『法定/侵占率/实收』- 仅 customTax 含 occupationRate 时显示
      var ctMeta = (g._customTaxMeta || {})[tag];
      if (ctMeta && ctMeta.occupationRate > 0) {
        var occPct = (ctMeta.occupationRate * 100).toFixed(1);
        var nominalDesc = '';
        if (ctMeta.formulaType === 'perMu' && ctMeta.nominalRate != null) {
          nominalDesc = '法定 ' + (ctMeta.nominalRate * 1000).toFixed(1) + ' 厘/亩';
        } else if (ctMeta.formulaType === 'perDing' && ctMeta.nominalRate != null) {
          nominalDesc = '法定 ' + (ctMeta.nominalRate).toFixed(2) + ' 两/丁';
        } else if (ctMeta.nominalAmount != null) {
          nominalDesc = '法定 ' + _guokuFmt(ctMeta.nominalAmount) + '/年';
        }
        html += '<div class="tr-flow-tops" style="font-size:0.66rem;color:var(--txt-d);padding-left:14px;">'+
                  '<span style="color:var(--gold-d);">' + nominalDesc + '</span>' +
                  '<span style="color:var(--vermillion-400);margin:0 6px;">▸ 侵占 ' + occPct + '%</span>' +
                  '<span style="color:var(--celadon-400);">▸ 实收 ' + _guokuFmt(val) + '</span>' +
                '</div>';
      }
      // 地方贡献：列前 3 + 显式标出其余省份合计·避免误以为"只结算这三省"
      if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.getTopContributors === 'function' && km.key === 'money') {
        var allContribs = CascadeTax.getTopContributors(tag, 999);  // 全部贡献省
        if (allContribs && allContribs.length > 0) {
          var topN = allContribs.slice(0, 3);
          var topsStr = topN.map(function(t){
            var safeName = String(t.name).replace(/'/g, '\\\'');
            return '<span class="top" onclick="if(typeof openDivisionDetail===\'function\')openDivisionDetail(\'' + safeName + '\')">' + _escHtml(t.name) + ' ' + t.pct.toFixed(0) + '%</span>';
          }).join('');
          var restCount = allContribs.length - topN.length;
          var restPct = 0;
          if (restCount > 0) {
            for (var ri = topN.length; ri < allContribs.length; ri++) restPct += allContribs[ri].pct;
          }
          var restStr = restCount > 0
            ? '<span class="top" style="opacity:0.7;cursor:default;">余 ' + restCount + ' 省 ' + restPct.toFixed(0) + '%</span>'
            : '';
          html += '<div class="tr-flow-tops"><span class="arrow">↳ 前三贡献</span>' + topsStr + restStr + '</div>';
        }
      }
    });
    html += '</div>';
  });
  if (!_anyIncome) {
    var srcLabels = {
      tianfu:'田赋', dingshui:'丁税', caoliang:'漕粮', yanlizhuan:'盐铁专卖',
      shipaiShui:'市舶', quanShui:'榷税', juanNa:'捐纳', qita:'其他'
    };
    var sources = g.sources || {};
    var sourceTotal = 0;
    for (var k in sources) sourceTotal += (sources[k] || 0);
    if (sourceTotal > 0) {
      html += '<div class="tr-flow-group income">';
      html +=   '<div class="tr-flow-head"><span>钱账（年）</span><span class="total">岁入 ' + _guokuFmt(sourceTotal) + '</span></div>';
      Object.keys(srcLabels).forEach(function(key) {
        var val = sources[key] || 0;
        if (!val && (key === 'shipaiShui' || key === 'juanNa' || key === 'qita')) return;
        var pct = (val / sourceTotal * 100).toFixed(1);
        var barW = Math.min(100, val / sourceTotal * 100);
        html += '<div class="tr-flow-row income"><span class="lbl">' + srcLabels[key] + '</span><div class="bar"><span style="width:' + barW + '%;"></span></div><span class="v">' + _guokuFmt(val) + '<span class="pct">' + pct + '%</span></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="vd-empty">岁入尚未结算（等首次 endTurn 或配置税制）</div>';
    }
  }
  // 自定义税种
  var customTaxes = g._customTaxStats || {};
  var customKeys = Object.keys(customTaxes);
  if (customKeys.length > 0) {
    var _ctTotal = 0;
    customKeys.forEach(function(k){ _ctTotal += (customTaxes[k].amount || 0); });
    if (_ctTotal > 0) {
      html += '<div class="tr-flow-group income">';
      html +=   '<div class="tr-flow-head"><span>自定义税种</span><span class="total">' + _guokuFmt(_ctTotal) + '</span></div>';
      customKeys.forEach(function(key) {
        var ct = customTaxes[key];
        if (!ct.amount) return;
        var w = Math.min(100, ct.amount / _ctTotal * 100);
        html += '<div class="tr-flow-row income"><span class="lbl">' + _escHtml(ct.name) + '</span><div class="bar"><span style="width:' + w + '%;"></span></div><span class="v">' + _guokuFmt(ct.amount) + '</span></div>';
      });
      html += '</div>';
    }
  }
  // 下回合 cascade 预览
  if (typeof CascadeTax !== 'undefined' && GM.adminHierarchy && GM._lastCascadeSummary) {
    var last = GM._lastCascadeSummary;
    html += '<div class="tr-alert ok" style="margin-top:6px;"><span class="ttl">本回合级联结算</span><span class="ds">中央 ' + _guokuFmt(last.central.money) + U.money + ' / ' + _guokuFmt(last.central.grain) + U.grain + ' / ' + _guokuFmt(last.central.cloth) + U.cloth + ' · 地方留存 ' + _guokuFmt(last.localRetain.money) + ' · 被贪 ' + _guokuFmt(last.skimmed.money) + ' · 路耗 ' + _guokuFmt(last.lostTransit.money) + '</span></div>';
  }
  html += '</section>';

  // ─── § 岁出分项·三账·本回合 ───
  var _expLabels = {
    fenglu:'俸禄', junxiang:'军饷', zhenzi:'赈济', gongcheng:'工程',
    jisi:'祭祀', shangci:'赏赐', neiting:'内廷转运', qita:'其他'
  };
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">岁出分项</span><span class="tr-section-badge">三账 · 本' + (turnDays === 30 ? '月' : '回合') + '</span></div>';
  var _anyExpense = false;
  _kindMeta.forEach(function(km) {
    var led = ledgers[km.key];
    if (!led) return;
    var sinkMap = led.sinks || {};
    var dispTotal = led.thisTurnOut || 0;
    var _sumSink = 0;
    Object.keys(sinkMap).forEach(function(t){ _sumSink += sinkMap[t] || 0; });
    if (!dispTotal) dispTotal = _sumSink;
    if (dispTotal === 0) return;
    _anyExpense = true;
    html += '<div class="tr-flow-group expense">';
    html +=   '<div class="tr-flow-head"><span>' + km.name + '（' + km.unit + '）</span><span class="total">本' + (turnDays === 30 ? '月' : '回') + '出 ' + _guokuFmt(dispTotal) + '</span></div>';
    Object.keys(sinkMap).forEach(function(tag){
      var val = sinkMap[tag];
      if (!val) return;
      var pct = dispTotal > 0 ? (val / dispTotal * 100).toFixed(1) : 0;
      var barW = dispTotal > 0 ? Math.min(100, val / dispTotal * 100) : 0;
      html += '<div class="tr-flow-row expense"><span class="lbl">' + (_expLabels[tag] || tag) + '</span><div class="bar"><span style="width:' + barW + '%;"></span></div><span class="v">' + _guokuFmt(val) + '<span class="pct">' + pct + '%</span></span></div>';
    });
    html += '</div>';
  });
  if (!_anyExpense) {
    var expenses = g.expenses || {};
    var expTotal = 0;
    for (var e in expenses) expTotal += (expenses[e] || 0);
    if (expTotal > 0) {
      html += '<div class="tr-flow-group expense">';
      html +=   '<div class="tr-flow-head"><span>钱账（年）</span><span class="total">岁出 ' + _guokuFmt(expTotal) + '</span></div>';
      Object.keys(_expLabels).forEach(function(key) {
        var val = expenses[key] || 0;
        if (!val && (key === 'zhenzi' || key === 'gongcheng' || key === 'qita')) return;
        var pct = (val / expTotal * 100).toFixed(1);
        var barW = Math.min(100, val / expTotal * 100);
        html += '<div class="tr-flow-row expense"><span class="lbl">' + _expLabels[key] + '</span><div class="bar"><span style="width:' + barW + '%;"></span></div><span class="v">' + _guokuFmt(val) + '<span class="pct">' + pct + '%</span></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="vd-empty">岁出尚未结算（俸禄/军饷/赈济 等在推演中叠加）</div>';
    }
  }
  html += '</section>';

  // ─── § 漕运详情 ───
  if (g._caoyunStats && g._caoyunStats.nominal > 0) {
    var cs = g._caoyunStats;
    var lossPct = Math.round(cs.lossRate * 100);
    var lossBadge = lossPct > 30 ? 'bad' : lossPct > 15 ? 'warn' : 'ok';
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">漕运详情</span><span class="tr-section-badge ' + lossBadge + '">损 ' + lossPct + '%</span></div>';
    html +=   '<div class="tr-cao-grid">';
    html +=     '<span>名义岁漕</span><span style="color:var(--gold-l);">' + _guokuFmt(cs.nominal) + ' ' + U.money + '</span>';
    html +=     '<span>损耗</span><span style="color:var(--vermillion-300);">−' + _guokuFmt(cs.lossAmount) + ' ' + U.money + '</span>';
    html +=     '<span>入仓</span><span style="color:var(--celadon-300);">' + _guokuFmt(cs.actual) + ' ' + U.money + '</span>';
    html +=   '</div>';
    if (lossPct > 25) {
      html += '<div class="tr-alert warn" style="margin-top:6px;"><span class="ttl">⚠ 漕运损耗过重</span><span class="ds">逼近 30% 阈值，漕弊随时可发。建议查 山东 / 直隶 漕规。</span></div>';
    }
    html += '</section>';
  }

  // ─── § 地域分账（cards grid） ───
  var byRegion = g.byRegion || {};
  var regionIds = Object.keys(byRegion);
  if (regionIds.length > 0 && !(regionIds.length === 1 && regionIds[0] === 'national')) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">地域分账</span><span class="tr-section-badge">' + regionIds.length + ' 区 · 按钱本回合</span></div>';
    var sorted = regionIds.map(function(id) { return { id: id, data: byRegion[id] }; })
      .sort(function(a, b) { return (b.data.stock || 0) - (a.data.stock || 0); })
      .slice(0, 10);
    html +=   '<div class="tr-region-grid">';
    sorted.forEach(function(r) {
      var d = r.data;
      var deltaR = (d.lastIn || 0) - (d.lastOut || 0);
      var deltaCls = deltaR >= 0 ? 'delta-up' : 'delta-down';
      var safeName = String(d.name || r.id).replace(/'/g, '\\\'');
      html += '<div class="tr-region-card" onclick="if(typeof openDivisionDetail===\'function\')openDivisionDetail(\'' + safeName + '\')">';
      html +=   '<span class="nm">' + _escHtml(d.name || r.id) + '</span>';
      html +=   '<span class="meta"><span>库 ' + _guokuFmt(d.stock || 0) + '</span><span class="' + deltaCls + '">Δ' + (deltaR >= 0 ? '+' : '') + _guokuFmt(deltaR) + '</span></span>';
      html += '</div>';
    });
    html +=   '</div>';
    if (regionIds.length > 10) {
      html += '<div class="tr-region-more">… 另 ' + (regionIds.length - 10) + ' 区</div>';
    }
    html += '</section>';
  }

  // ─── § 历史趋势 ───
  html += _guoku_renderTrendSection();

  // ─── § 财政改革 ───
  if (typeof GuokuEngine !== 'undefined' && GuokuEngine.FISCAL_REFORMS) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">财政改革</span><span class="tr-section-badge">千古变法</span></div>';
    var ongoing = (g.ongoingReforms || []);
    var completed = (g.completedReforms || []);
    if (ongoing.length > 0) {
      html += '<div class="tr-reform-stage s-on">施行中</div>';
      ongoing.forEach(function(o) {
        var r = GuokuEngine.FISCAL_REFORMS[o.id];
        if (!r) return;
        var leftTurn = Math.max(0, o.endTurn - GM.turn);
        html += '<div class="tr-reform-row ongoing"><span class="name">' + _escHtml(r.name) + '</span><span class="h-note">余 ' + leftTurn + ' 回合</span></div>';
      });
    }
    if (completed.length > 0) {
      html += '<div class="tr-reform-stage s-done">已完成</div>';
      completed.forEach(function(id) {
        var r = GuokuEngine.FISCAL_REFORMS[id];
        if (!r) return;
        html += '<div class="tr-reform-row completed"><span class="name">✓ ' + _escHtml(r.name) + '</span><span class="h-note">已收成效</span></div>';
      });
    }
    var available = [];
    Object.keys(GuokuEngine.FISCAL_REFORMS).forEach(function(id) {
      var check = GuokuEngine.canEnactReform(id);
      if (check.can) available.push(id);
    });
    html += '<div class="tr-reform-stage s-avail">可行参考</div>';
    if (available.length > 0) {
      available.forEach(function(id) {
        var r = GuokuEngine.FISCAL_REFORMS[id];
        html += '<div class="tr-reform-row"><span class="name">' + _escHtml(r.name) + '</span><span class="h-note">' + _escHtml(r.historical) + ' · ' + r.durationMonths + ' 月</span></div>';
      });
      html += '<div class="tr-reform-tip">※ 欲施行改革请在【诏令】写诏，如"推行一条鞭法…"</div>';
    } else {
      html += '<div class="vd-empty" style="padding:6px;">暂无改革可行（需皇权/皇威/民心达标）</div>';
    }
    var blocked = [];
    Object.keys(GuokuEngine.FISCAL_REFORMS).forEach(function(id) {
      if (available.indexOf(id) === -1 &&
          ongoing.findIndex(function(o) { return o.id === id; }) < 0 &&
          completed.indexOf(id) === -1) {
        blocked.push({ id: id, reason: GuokuEngine.canEnactReform(id).reason });
      }
    });
    if (blocked.length > 0) {
      html += '<details style="margin-top:4px;font-size:0.66rem;color:var(--ink-300);">' +
        '<summary style="cursor:pointer;letter-spacing:0.05em;">未达条件 (' + blocked.length + ')</summary>';
      blocked.forEach(function(b) {
        var r = GuokuEngine.FISCAL_REFORMS[b.id];
        html += '<div style="padding:3px 6px;margin-top:2px;color:var(--ink-200);"><b style="color:var(--gold-l);">' + _escHtml(r.name) + '</b>：' + _escHtml(b.reason || '') + '</div>';
      });
      html += '</details>';
    }
    html += '</section>';
  }

  // ─── § 告警 ───
  var anyAlert = false;
  var alertHtml = '';
  if (g.bankruptcy && g.bankruptcy.active) {
    anyAlert = true;
    alertHtml += '<div class="tr-alert bad">';
    alertHtml +=   '<span class="ttl">⚠ 财政破产 · 已 ' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月</span>';
    alertHtml +=   '<span class="ds">帑廪亏空超 ' + Math.round(g.bankruptcy.severity * 100) + '% 年入。' + ((g.bankruptcy.consecutiveMonths || 0) > 6 ? '持续 6+ 月，恐生兵变 / 民变。' : '') + '</span>';
    alertHtml +=   '<span class="chain">已连锁：皇权 −10 · 皇威 −15 · 俸薄腐败源 +15</span>';
    alertHtml += '</div>';
  } else if (stockMoney < (g.annualIncome || 1) * 0.2) {
    anyAlert = true;
    alertHtml += '<div class="tr-alert warn"><span class="ttl">⚠ 帑廪不足年入两成</span><span class="ds">现余 ' + _guokuFmt(stockMoney) + ' < 年入 ' + _guokuFmt(g.annualIncome || 0) + ' × 20% = ' + _guokuFmt((g.annualIncome || 0) * 0.2) + ' · 已逼近危境。</span></div>';
  }
  if (GM.currency && GM.currency.inflationPressure > 0.3) {
    anyAlert = true;
    alertHtml += '<div class="tr-alert bad"><span class="ttl">⚠ 通胀压力高企 · ' + GM.currency.inflationPressure.toFixed(2) + '</span><span class="ds">市面对' + (GM.currency.latestCoin || '当朝钱') + '信心动摇。</span></div>';
  } else if (GM.currency && GM.currency.latestCoin) {
    anyAlert = true;
    alertHtml += '<div class="tr-alert ok"><span class="ttl">✓ 当朝新钱：' + _escHtml(GM.currency.latestCoin) + '</span><span class="ds">钱法通行。</span></div>';
  }
  if (GM.currency && GM.currency.privateCastBanned) {
    anyAlert = true;
    alertHtml += '<div class="tr-alert ok"><span class="ttl">✓ 私铸已禁</span><span class="ds">钱法肃然，盗铸者受惩。</span></div>';
  }
  if (GM.fiscal && GM.fiscal.regions) {
    var _regs = Object.values(GM.fiscal.regions);
    if (_regs.length) {
      var _avgComp = _regs.reduce(function(s, r){ return s + (r.compliance || 1); }, 0) / _regs.length;
      var _skim = (1 - _avgComp) * 100;
      if (_skim > 5) {
        anyAlert = true;
        alertHtml += '<div class="tr-alert warn"><span class="ttl">⚠ 地方贪污率 ' + _skim.toFixed(0) + '%</span><span class="ds">' + _regs.length + ' 区均值，钱粮上解漏损严重。</span></div>';
      }
    }
  }
  if (GM.prices && GM.prices.grain) {
    var gp = GM.prices.grain;
    if (gp > 1.8) {
      anyAlert = true;
      alertHtml += '<div class="tr-alert bad"><span class="ttl">⚠ 粮价指数 ' + gp.toFixed(2) + '×</span><span class="ds">' + (gp > 2.0 ? '粮荒在即' : '粮贵市疑') + '，赈济急须。</span></div>';
    }
  }
  if (anyAlert) {
    html += '<section class="tr-section"><div class="tr-section-head"><span class="tr-section-name">告警</span></div>' + alertHtml + '</section>';
  }

  // ─── § 措置入口 ───
  html += '<section class="tr-section">';
  html +=   '<div class="tr-section-head"><span class="tr-section-name">如何措置</span><span class="tr-section-badge">陛下行止 4 道</span></div>';
  html +=   '<div class="tr-action-grid">';
  html +=     _guokuActionBtn('⊕ 写诏', '加派 / 赈济 / 减赋 / 改革 / 铸币 / 禁私铸', 'gt-edict');
  html +=     _guokuActionBtn('⊕ 看奏疏', '户部 / 漕运 / 铸币 主管的奏报', 'gt-memorial');
  html +=     _guokuActionBtn('⊕ 问对', '户部尚书 / 户部侍郎 请教', 'gt-wendui');
  html +=     _guokuActionBtn('⊕ 朝议', '发行纸钞 / 重大改革 等争议事', 'gt-chaoyi');
  html +=   '</div>';
  html +=   '<div class="tr-action-tip">※ 陛下只需写诏令（自然语言可），AI 按当前局势推演。</div>';
  html += '</section>';

  // ─── § 年度决算（含 byRegion） ───
  var yearly = (g.history && g.history.yearly) || [];
  if (yearly.length > 0) {
    html += '<section class="tr-section">';
    html +=   '<div class="tr-section-head"><span class="tr-section-name">年度决算</span><span class="tr-section-badge">' + yearly.length + ' 年</span></div>';
    yearly.slice(-5).reverse().forEach(function(y, idx) {
      var netCls = y.netChange >= 0 ? 'up' : 'down';
      var yId = 'ny-' + y.year + '-' + idx;
      html += '<div class="tr-yearly-row" onclick="document.getElementById(\'' + yId + '\').style.display=document.getElementById(\'' + yId + '\').style.display===\'none\'?\'block\':\'none\';">';
      html +=   '<span class="yr">' + y.year + '年</span>';
      html +=   '<span class="meta">入 ' + _guokuFmt(y.totalIncome) + ' · 出 ' + _guokuFmt(y.totalExpense) + '</span>';
      html +=   '<span class="net ' + netCls + '">' + (y.netChange >= 0 ? '+' : '') + _guokuFmt(y.netChange) + '</span>';
      html += '</div>';
      if (y.byRegion && Object.keys(y.byRegion).length > 0) {
        html += '<div id="' + yId + '" style="display:none;padding:4px 10px 8px;background:rgba(0,0,0,0.12);border-radius:0 0 4px 4px;margin-top:-4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.66rem;color:var(--ink-300);padding:3px 0;letter-spacing:0.05em;">地域分账（本年累计）</div>';
        var regionList = Object.keys(y.byRegion).map(function(rid) {
          return { id: rid, data: y.byRegion[rid] };
        }).sort(function(a, b) { return (b.data.net || 0) - (a.data.net || 0); });
        regionList.slice(0, 8).forEach(function(r) {
          var d = r.data;
          var rNetCls = d.net >= 0 ? 'delta-up' : 'delta-down';
          html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;padding:2px 4px;color:var(--ink-200);">'+
            '<span>' + _escHtml(d.name || r.id) + '</span>'+
            '<span style="color:var(--ink-300);">入 ' + _guokuFmt(d.cumIn) + ' · 出 ' + _guokuFmt(d.cumOut) + '</span>'+
            '<span class="' + rNetCls + '">' + (d.net >= 0 ? '+' : '') + _guokuFmt(d.net) + '</span>'+
            '</div>';
        });
        if (regionList.length > 8) {
          html += '<div style="font-size:0.6rem;color:var(--ink-400);text-align:center;margin-top:2px;">… 另 ' + (regionList.length - 8) + ' 区</div>';
        }
        html += '</div>';
      }
    });
    html += '</section>';
  }

  body.innerHTML = html;
}

// ─── 措置按钮 helper ───
function _guokuActionBtn(name, hint, tabId) {
  var safeName = String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  var safeHint = String(hint).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<button class="tr-action-btn" onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '<span class="ac-name">' + safeName + '</span>' +
    '<span class="ac-hint">' + safeHint + '</span>' +
  '</button>';
}

// ─── 趋势图（SVG）───
function _guoku_renderTrendSection() {
  var snapshots = ((GM.guoku && GM.guoku.history && GM.guoku.history.monthly) || []);
  if (snapshots.length < 2) {
    return '<section class="tr-section">'+
      '<div class="tr-section-head"><span class="tr-section-name">帑廪趋势</span><span class="tr-section-badge">待累积</span></div>'+
      '<div class="vd-empty">需至少 2 回合数据方可展示</div>'+
    '</section>';
  }
  var data = snapshots.slice(-60);
  var W = 400, H = 110, PAD = { l:40, r:8, t:8, b:22 };
  var innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;

  var maxB = 0, minB = 0;
  data.forEach(function(d) {
    if (d.balance > maxB) maxB = d.balance;
    if (d.balance < minB) minB = d.balance;
  });
  if (maxB === minB) maxB = minB + 1;

  var maxTurn = data[data.length - 1].turn, minTurn = data[0].turn;
  var spanT = Math.max(1, maxTurn - minTurn);
  function xOf(t) { return PAD.l + (t - minTurn) / spanT * innerW; }
  function yOf(v) { return PAD.t + (1 - (v - minB) / (maxB - minB)) * innerH; }

  var pts = data.map(function(d) { return [xOf(d.turn), yOf(d.balance)]; });
  var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">';
  // 零轴线
  if (minB < 0 && maxB > 0) {
    var zy = yOf(0);
    svg += '<line x1="' + PAD.l + '" y1="' + zy + '" x2="' + (W - PAD.r) + '" y2="' + zy +
           '" stroke="var(--vermillion-400)" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.5"/>';
  }
  // 起止值
  svg += '<text x="2" y="' + (PAD.t + 8) + '" font-size="9" fill="var(--txt-d)">' + _guokuFmt(maxB) + '</text>';
  svg += '<text x="2" y="' + (H - PAD.b + 4) + '" font-size="9" fill="var(--txt-d)">' + _guokuFmt(minB) + '</text>';
  // 填充区
  var fillPath = pathD + ' L' + pts[pts.length-1][0] + ',' + yOf(minB) + ' L' + pts[0][0] + ',' + yOf(minB) + ' Z';
  svg += '<path d="' + fillPath + '" fill="rgba(184,154,83,0.15)"/>';
  // 主线
  svg += '<path d="' + pathD + '" fill="none" stroke="var(--gold-400)" stroke-width="2"/>';
  // x 轴
  svg += '<text x="' + PAD.l + '" y="' + (H - 6) + '" font-size="9" fill="var(--txt-d)">T' + minTurn + '</text>';
  svg += '<text x="' + (W - PAD.r) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="var(--txt-d)">T' + maxTurn + '</text>';
  svg += '</svg>';

  return '<section class="vd-section">'+
    '<div class="vd-section-title">帑廪趋势 <span class="vd-badge">' + data.length + ' 月</span></div>'+
    '<div style="background:var(--bg-2);border-radius:4px;padding:4px 8px;">' + svg + '</div>'+
    '</section>';
}

// ─── 紧急措施按钮 handlers ───
function _guoku_confirm(title, desc, costHtml, confirmLabel, fn) {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">' + title + '</h4>'+
    '<p style="font-size:0.85rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">' + desc + '</p>'+
    '<div style="font-size:0.78rem;color:var(--txt-d);padding:0.5rem 0.7rem;background:var(--bg-2);border-radius:4px;border-left:3px solid var(--gold-d);">'+
      costHtml + '</div></div>';
  if (typeof openGenericModal !== 'function') return;
  openGenericModal(title, html, function() {
    try {
      var r = fn();
      if (r && r.success === false) {
        if (typeof toast === 'function') toast('未成：' + (r.reason || '条件不足'));
      } else {
        if (typeof toast === 'function') toast('已施行：' + title);
      }
    } catch(e) {
      console.error('[guoku] action error:', e);
      if (typeof toast === 'function') toast('执行出错');
    }
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderGuokuPanel();
    if (typeof renderTopBarVars === 'function') renderTopBarVars();
  });
  setTimeout(function() {
    var sb = document.getElementById('gm-save-btn');
    if (sb && confirmLabel) sb.textContent = confirmLabel;
    var cb = document.querySelector('#gm-overlay .generic-modal-footer .bt.bs');
    if (cb) cb.textContent = '罢';
  }, 10);
}

function _guoku_extraTax() {
  // 三档加派
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">加派赋税</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">历代财政紧急时行之。选档次：</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_doExtraTax(0.2)">'+
        '<div>20% · 薄赋加派</div><span class="cost">民心 -3 · 腐败 +2</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doExtraTax(0.5)">'+
        '<div>50% · 五成加派</div><span class="cost">民心 -7 · 腐败 +5</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doExtraTax(1.0)">'+
        '<div>100% · 三饷式加派</div><span class="cost">民心 -15 · 末世之兆</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('加派赋税', html, null);
}
function _guoku_doExtraTax(rate) {
  var r = GuokuEngine.Actions.extraTax(rate);
  if (r.success) {
    if (typeof toast === 'function') toast('已加派 ' + Math.round(rate*100) + '%');
    if (typeof closeGenericModal === 'function') closeGenericModal();
  }
  renderGuokuPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _guoku_openGranary() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">开仓赈济</h4>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_doOpenGranary(\'county\')">'+
        '<div>州县赈济</div><span class="cost">5 万两 · 民心 +3</span></button>'+
      '<button class="vd-action-btn" onclick="_guoku_doOpenGranary(\'regional\')">'+
        '<div>一省大赈</div><span class="cost">15 万两 · 民心 +8</span></button>'+
      '<button class="vd-action-btn" onclick="_guoku_doOpenGranary(\'national\')">'+
        '<div>普天大赈</div><span class="cost">50 万两 · 民心 +15</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('开仓赈济', html, null);
}
function _guoku_doOpenGranary(scale) {
  var r = GuokuEngine.Actions.openGranary(scale);
  if (typeof toast === 'function') toast(r.success ? '已开仓' : ('未成：' + r.reason));
  if (typeof closeGenericModal === 'function') closeGenericModal();
  renderGuokuPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _guoku_takeLoan() {
  var sources = GuokuEngine.LOAN_SOURCES || {};
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">借贷</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '可同时并存多笔借款。每月按本息折付。选来源：'+
    '</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">';
  Object.keys(sources).forEach(function(sid) {
    var s = sources[sid];
    var isForeign = sid === 'foreignLoan';
    var cls = isForeign ? 'vd-action-btn dangerous' : 'vd-action-btn';
    html += '<button class="' + cls + '" onclick="_guoku_openLoanDialog(\'' + sid + '\')">'+
      '<div>' + s.name + '（' + (s.interest * 100).toFixed(1) + '%/月）</div>'+
      '<span class="cost">上限 ' + Math.round(s.maxAmount/10000) + ' 万 · ' + s.historical + '</span>'+
      '</button>';
  });
  html += '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('选借贷来源', html, null);
}

function _guoku_openLoanDialog(sourceId) {
  var src = GuokuEngine.LOAN_SOURCES[sourceId];
  if (!src) return;
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.5rem;">' + src.name + '</h4>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:0.6rem;">' + src.historical + '</div>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">金额（两）</label>'+
      '<input id="loanAmt" type="number" value="' + Math.round(src.maxAmount * 0.5) +
      '" max="' + src.maxAmount + '" min="10000" style="width:100%;padding:5px 8px;">'+
      '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:2px;">上限 ' + src.maxAmount.toLocaleString() + '</div>'+
    '</div>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">期限（月）</label>'+
      '<input id="loanTerm" type="number" value="12" min="6" max="60" style="width:100%;padding:5px 8px;">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '利率：' + (src.interest * 100).toFixed(1) + '%/月 · 月付本金 = 本金/期限 + 本金×利率'+
    '</div>'+
    '</div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('借贷于' + src.name, html, function() {
      var amt = Number((document.getElementById('loanAmt')||{}).value) || 100000;
      var term = Number((document.getElementById('loanTerm')||{}).value) || 12;
      var r = GuokuEngine.takeLoanBySource(sourceId, amt, term);
      if (typeof toast === 'function') toast(r.success ? ('已借于' + src.name) : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _guoku_showLoans() {
  var loans = (GM.guoku.emergency && GM.guoku.emergency.loans) || [];
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">在借款项（' + loans.length + ' 笔）</h4>';
  if (loans.length === 0) {
    html += '<div class="vd-empty">无借款</div>';
  } else {
    loans.forEach(function(L) {
      var monthlyPayment = L.principal * (1 / L.totalTerm + L.interestRate);
      html += '<div style="padding:6px 10px;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:4px;font-size:0.78rem;">'+
        '<div style="color:var(--gold);font-weight:500;">' + L.sourceName + '</div>'+
        '<div style="color:var(--txt-d);margin-top:3px;">'+
          '本金 ' + _guokuFmt(L.principal) + ' · 利率 ' + (L.interestRate * 100).toFixed(1) + '% · 月付 ' + _guokuFmt(monthlyPayment) +
          ' · 余 ' + Math.round(L.monthsLeft) + '/' + L.totalTerm + ' 月</div>'+
        '</div>';
    });
  }
  html += '<div style="margin-top:0.6rem;"><button class="vd-action-btn" onclick="_guoku_takeLoan()">⊕ 新借一笔</button></div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('借贷详情', html, null);
}

async function _guoku_fiscalAdvisor() {
  // 加载中
  var html = '<div style="padding:1.2rem;text-align:center;">'+
    '<div style="font-size:0.88rem;color:var(--txt-s);line-height:1.8;">户部尚书参议中……</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('户部参议', html, null);

  if (!GuokuEngine || !GuokuEngine.aiFiscalAdvisor) {
    _showFiscalAdvice('户部系统未就绪', false);
    return;
  }
  try {
    var r = await GuokuEngine.aiFiscalAdvisor();
    _showFiscalAdvice(r.analysis || '臣恭候陛下圣裁', r.available);
  } catch(e) {
    console.error('[guoku] fiscalAdvisor:', e);
    _showFiscalAdvice('户部参议暂难作答', false);
  }
}

function _showFiscalAdvice(analysis, wasAI) {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">户部参议' + (wasAI ? '' : '（规则版）') + '</h4>'+
    '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
      'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;white-space:pre-wrap;">' +
      _escHtml(analysis || '') + '</div>'+
    '</div>';
  if (typeof closeGenericModal === 'function') closeGenericModal();
  if (typeof openGenericModal === 'function') openGenericModal('户部参议', html, null);
}

// ─── AI 漕运预警 ───
async function _guoku_caoyunWarning() {
  var html = '<div style="padding:1.2rem;text-align:center;"><div style="font-size:0.88rem;color:var(--txt-s);">漕运总督奏覆中……</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('漕运预警', html, null);
  try {
    var r = await GuokuEngine.aiCaoyunWarning();
    var wasAI = r.available;
    var out = '<div style="padding:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.6rem;">漕运预警' + (wasAI ? '' : '（规则版）') + '</h4>'+
      '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
        'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;white-space:pre-wrap;">' +
        _escHtml(r.analysis || '') + '</div></div>';
    if (typeof closeGenericModal === 'function') closeGenericModal();
    if (typeof openGenericModal === 'function') openGenericModal('漕运预警', out, null);
  } catch(e) {
    if (typeof toast === 'function') toast('预警失败：' + e.message);
  }
}

// ─── AI 税种建议 ───
async function _guoku_taxAdvisor() {
  var html = '<div style="padding:1.2rem;text-align:center;"><div style="font-size:0.88rem;color:var(--txt-s);">户部左侍郎参议中……</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('税制建言', html, null);
  try {
    var r = await GuokuEngine.aiTaxAdvisor();
    var wasAI = r.available;
    var out = '<div style="padding:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.6rem;">税制建言' + (wasAI ? '' : '（规则版）') + '</h4>'+
      '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
        'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;white-space:pre-wrap;">' +
        _escHtml(r.analysis || '') + '</div></div>';
    if (typeof closeGenericModal === 'function') closeGenericModal();
    if (typeof openGenericModal === 'function') openGenericModal('税制建言', out, null);
  } catch(e) {
    if (typeof toast === 'function') toast('参议失败：' + e.message);
  }
}

function _guoku_cutOfficials() {
  _guoku_confirm('裁冗员',
    '裁 10% 冗员，省俸禄。官员离心，皇权受损。',
    '代价：皇权 -2 · 官员怨气',
    '裁员', function() { return GuokuEngine.Actions.cutOfficials(0.1); });
}

function _guoku_reduceTax() {
  _guoku_confirm('减赋',
    '减 20% 田赋，长线惠民。短期帑廪入减，长线民心皇威升。',
    '代价：年入 -20% · 收益：民心 +6 · 皇威 +2',
    '减赋', function() { return GuokuEngine.Actions.reduceTax(0.2); });
}

function _guoku_issuePaper() {
  _guoku_confirm('发行纸钞',
    '宋金元明清险招。立得 50 万两，但皇威损、通胀风险、民信动摇。',
    '代价：皇威 -8 · 民心 -5 · 通胀压力',
    '发钞', function() { return GuokuEngine.Actions.issuePaperCurrency(500000); });
}

// ─── 改革详情查看与推行 ───
function _guoku_viewReform(reformId) {
  var r = GuokuEngine.FISCAL_REFORMS[reformId];
  if (!r) return;
  var eff = r.effects || {};

  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.4rem;">' + r.name + '</h4>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:0.6rem;">' + r.historical + '</div>'+
    '<p style="font-size:0.85rem;line-height:1.7;color:var(--txt);margin-bottom:0.8rem;">' + r.desc + '</p>';

  html += '<div style="font-size:0.78rem;padding:0.5rem 0.7rem;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;margin-bottom:0.6rem;">';
  html += '<div style="color:var(--gold);margin-bottom:4px;">前提</div>';
  var pre = r.prerequisites || {};
  var preLines = [];
  if (pre.huangquan) preLines.push('皇权 ≥ ' + pre.huangquan);
  if (pre.huangwei) preLines.push('皇威 ≥ ' + pre.huangwei);
  if (pre.minxin) preLines.push('民心 ≥ ' + pre.minxin);
  html += preLines.join(' · ');
  html += '<div style="color:var(--gold);margin-top:6px;margin-bottom:4px;">施行期</div>' +
          r.durationMonths + ' 月（期间月支增 8% 管理费）';
  html += '<div style="color:var(--gold);margin-top:6px;margin-bottom:4px;">成效</div>';
  var effLines = [];
  if (eff.sourceMultipliers) {
    var srcLabels = { tianfu:'田赋', dingshui:'丁税', caoliang:'漕粮' };
    for (var k in eff.sourceMultipliers) {
      effLines.push((srcLabels[k] || k) + ' ×' + eff.sourceMultipliers[k]);
    }
  }
  if (eff.corruptionDelta) {
    var corrLines = [];
    for (var d in eff.corruptionDelta) corrLines.push(d + ' ' + eff.corruptionDelta[d]);
    effLines.push('腐败：' + corrLines.join(' · '));
  }
  if (eff.minxinDelta) effLines.push('民心 ' + (eff.minxinDelta > 0 ? '+' : '') + eff.minxinDelta);
  if (eff.huangweiDelta) effLines.push('皇威 ' + (eff.huangweiDelta > 0 ? '+' : '') + eff.huangweiDelta);
  if (eff.hiddenHouseholdDelta) effLines.push('隐户 ' + Math.round(eff.hiddenHouseholdDelta*100) + '%');
  if (eff.populationGrowthBonus) effLines.push('户口增速 +' + Math.round(eff.populationGrowthBonus*100) + '%');
  html += effLines.join('<br>');
  if (eff.note) html += '<div style="margin-top:6px;color:var(--txt-d);font-style:italic;">备注：' + eff.note + '</div>';
  html += '</div>';

  html += '<button class="vd-action-btn" onclick="_guoku_doEnactReform(\'' + reformId + '\')" style="width:100%;">'+
    '<div>颁行</div>'+
    '<span class="cost">' + r.durationMonths + ' 月后见效</span>'+
    '</button></div>';

  if (typeof openGenericModal === 'function') openGenericModal(r.name, html, null);
}

function _guoku_doEnactReform(reformId) {
  var result = GuokuEngine.enactReform(reformId);
  if (result.success) {
    if (typeof toast === 'function') toast('已颁行：' + result.reform.name);
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderGuokuPanel();
  } else {
    if (typeof toast === 'function') toast('未成：' + result.reason);
  }
}

// ─── 铸币三策 ───
function _guoku_lightCoin() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">减重改铸</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '新铸钱减少含铜，一次性获大量铸币利，但市面疑虑通胀激升。选档次：'+
    '</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_doLightCoin(0.1)">'+
        '<div>减重 10%（小调）</div><span class="cost">获 2-4 月入 · 通胀 +0.05 · 皇威 -1</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doLightCoin(0.2)">'+
        '<div>减重 20%（常策）</div><span class="cost">获 5-8 月入 · 通胀 +0.1 · 皇威 -3 · 民心 -2</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doLightCoin(0.4)">'+
        '<div>减重 40%（险策）</div><span class="cost">获 10-15 月入 · 通胀 +0.2 · 皇威 -6 · 民心 -4</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('减重改铸', html, null);
}
function _guoku_doLightCoin(r) {
  var res = GuokuEngine.MintingActions.lightCoining(r);
  if (typeof toast === 'function') toast('已减重改铸：' + Math.round(r*100) + '%');
  if (typeof closeGenericModal === 'function') closeGenericModal();
  renderGuokuPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}
function _guoku_banPrivate() {
  _guoku_confirm('严禁私铸',
    '颁诏严法诛私铸。钱法肃然，但监察负担重。',
    '代价：税司腐败 +3（寻租空间）',
    '立法', function() { return GuokuEngine.MintingActions.banPrivateMint(); });
}
function _guoku_newCoin() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">新铸通宝</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '新铸钱号。成色精良 → 通胀消退、民信渐复、皇威 +5'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.8rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">钱号</label>'+
      '<input id="newCoinName" type="text" value="通宝" style="width:100%;padding:5px 8px;" placeholder="如开元通宝、乾隆通宝">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '代价：帑廪 -10 万两'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('新铸通宝', html, function() {
      var n = (document.getElementById('newCoinName')||{}).value || '通宝';
      var r = GuokuEngine.MintingActions.newCoining(n);
      if (typeof toast === 'function') toast('已新铸：' + n);
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderGuokuPanel();
    });
  }
}

// ─── AI 自拟诏令 ───
function _guoku_aiDecreeOpen() {
  var aiAvail = (typeof callAI === 'function') && (typeof P !== 'undefined') && P.ai && P.ai.key;
  if (!aiAvail) {
    if (typeof toast === 'function') toast('未配 AI API，不可用自拟诏令');
    return;
  }
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">陛下自拟诏令</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '陛下以自然语言颁诏，辅政大臣据此议定金额与规模。例：<br>'+
      '· "加三成赋税以备边" → AI 判 extraTax 0.3<br>'+
      '· "发帑二十万赈两淮水患" → AI 判 openGranary regional + 20 万<br>'+
      '· "借银三十万于两淮盐商" → AI 判 loan 30 万，12 月<br>'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">诏令文</label>'+
      '<textarea id="aiDecreeText" rows="4" style="width:100%;padding:8px;font-family:inherit;font-size:0.88rem;" placeholder="朕以两淮水患，发帑赈济……"></textarea>'+
    '</div>'+
    '<div class="form-group" style="margin-bottom:0.8rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">类别</label>'+
      '<select id="aiDecreeType" style="width:100%;padding:5px 8px;">'+
        '<option value="extraTax">加派</option>'+
        '<option value="openGranary">开仓赈济</option>'+
        '<option value="takeLoan">借贷</option>'+
        '<option value="reduceTax">减赋</option>'+
        '<option value="cutOfficials">裁冗员</option>'+
        '<option value="issuePaperCurrency">发行纸钞</option>'+
      '</select>'+
    '</div>'+
    '<div id="aiDecreeResult" style="font-size:0.78rem;color:var(--txt-d);min-height:30px;"></div>'+
    '<div style="display:flex;gap:6px;margin-top:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_aiDecreeParse()" style="flex:1;">⊕ 请参议</button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('陛下自拟诏令', html, null);
}

async function _guoku_aiDecreeParse() {
  var text = (document.getElementById('aiDecreeText')||{}).value || '';
  var type = (document.getElementById('aiDecreeType')||{}).value || 'extraTax';
  var resEl = document.getElementById('aiDecreeResult');
  if (!text.trim()) { if (resEl) resEl.innerHTML = '<span style="color:var(--vermillion-400);">请先写诏令</span>'; return; }
  if (resEl) resEl.innerHTML = '<span style="color:var(--txt-s);">辅政大臣解读中……</span>';

  try {
    var parsed = await GuokuEngine.aiParseFiscalDecree(text, type);
    if (!parsed) {
      if (resEl) resEl.innerHTML = '<span style="color:var(--vermillion-400);">辅政大臣未能解读，请明示。</span>';
      return;
    }
    var amt = parsed.amount;
    var reason = parsed.reason || '';
    if (resEl) resEl.innerHTML =
      '<div style="padding:0.5rem 0.7rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;color:var(--txt);">' +
      '<b>臣议</b>：' + reason + '<br><b>拟行</b>：' + type + ' · 金额/规模 ' + amt +
      '<br><button class="vd-action-btn" style="margin-top:6px;" onclick="_guoku_aiDecreeExec(\'' + type + '\', ' + amt + ')">⚔ 依议施行</button>' +
      '</div>';
  } catch(e) {
    if (resEl) resEl.innerHTML = '<span style="color:var(--vermillion-400);">解读失败：' + e.message + '</span>';
  }
}

function _guoku_aiDecreeExec(type, amt) {
  var result;
  if (type === 'extraTax')            result = GuokuEngine.Actions.extraTax(amt);
  else if (type === 'openGranary')    result = GuokuEngine.Actions.openGranary(
      amt > 0.5 ? 'national' : amt > 0.2 ? 'regional' : 'county');
  else if (type === 'takeLoan')       result = GuokuEngine.Actions.takeLoan(amt, 12);
  else if (type === 'reduceTax')      result = GuokuEngine.Actions.reduceTax(amt);
  else if (type === 'cutOfficials')   result = GuokuEngine.Actions.cutOfficials(amt);
  else if (type === 'issuePaperCurrency') result = GuokuEngine.Actions.issuePaperCurrency(amt);

  if (result && result.success) {
    if (typeof toast === 'function') toast('已依议施行');
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderGuokuPanel();
    if (typeof renderTopBarVars === 'function') renderTopBarVars();
  } else {
    if (typeof toast === 'function') toast('未成：' + ((result && result.reason) || '未知'));
  }
}

// ESC 关闭
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeGuokuPanel();
});
