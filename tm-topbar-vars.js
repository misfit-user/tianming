// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 顶栏 · 七官方变量显示 + 悬停详情 + 全部变量模态
// 依赖：GM.guoku / GM.neitang / GM.hukou / GM.corruption / GM.minxin / GM.huangquan / GM.huangwei
// 详见 设计方案-变量联动总表.md
// ═══════════════════════════════════════════════════════════════

// 七变量配置（顺序即顶栏显示顺序）
var TOP_BAR_VARS = [
  { key:'guoku',     name:'帑廪',  display:'fiscal',       click:'openGuokuPanel' },
  { key:'neitang',   name:'内帑',  display:'fiscal',       click:'openNeitangPanel' },
  { key:'hukou',     name:'户口',  display:'population',   click:'openHukouPanel' },
  { key:'lizhi',     name:'吏治',  display:'corruption',   click:'openCorruptionPanel', dataPath:'corruption' }, // UI 名"吏治"，数据路径"corruption"
  { key:'minxin',    name:'民心',  display:'minxin',       click:'openMinxinPanel' },
  { key:'huangquan', name:'皇权',  display:'phase3',       click:'openHuangquanPanel' },
  { key:'huangwei',  name:'皇威',  display:'phase5',       click:'openHuangweiPanel' }
];

// 数字格式化（大数用"万/亿"）
function _barFmtNum(v) {
  if (v === undefined || v === null) return '—';
  if (typeof v !== 'number') return String(v);
  var abs = Math.abs(v);
  if (abs >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (abs >= 1e4) return Math.round(v / 1e4) + '万';
  return Math.round(v).toString();
}

// 趋势箭头
function _barTrendArrow(trend) {
  if (trend === 'up' || trend === 'rising')   return { sym:'▲', cls:'up' };
  if (trend === 'down' || trend === 'falling') return { sym:'▼', cls:'down' };
  return { sym:'—', cls:'stable' };
}

// ─────────────────────────────────────────────
// 各变量的渲染逻辑
// ─────────────────────────────────────────────

function _renderGuoku() {
  var g = GM.guoku || {};
  var money = (g.ledgers && g.ledgers.money && g.ledgers.money.stock) != null
    ? g.ledgers.money.stock
    : (g.money != null ? g.money : (g.balance || 0));
  var grain = (g.ledgers && g.ledgers.grain && g.ledgers.grain.stock) != null
    ? g.ledgers.grain.stock
    : (g.grain || 0);
  var cloth = (g.ledgers && g.ledgers.cloth && g.ledgers.cloth.stock) != null
    ? g.ledgers.cloth.stock
    : (g.cloth || 0);
  var phase = money < -(g.annualIncome || 1) * 0.5 ? 'bankrupt' : '';
  var U = (typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : { money:'两', grain:'石', cloth:'匹' };
  var turnDays = g.turnDays || 30;
  var incomeLabel = turnDays === 30 ? '月入' : ('每' + turnDays + '日入');
  var expenseLabel = turnDays === 30 ? '月支' : ('每' + turnDays + '日支');
  // 三账本回预估变化
  var moneyDelta = (g.turnIncome || g.monthlyIncome || 0) - (g.turnExpense || g.monthlyExpense || 0);
  var grainDelta = (g.ledgers && g.ledgers.grain && g.ledgers.grain.turnDelta != null)
    ? g.ledgers.grain.turnDelta
    : ((g.turnGrainIncome || 0) - (g.turnGrainExpense || 0));
  var clothDelta = (g.ledgers && g.ledgers.cloth && g.ledgers.cloth.turnDelta != null)
    ? g.ledgers.cloth.turnDelta
    : ((g.turnClothIncome || 0) - (g.turnClothExpense || 0));
  return {
    value: _barFmtNum(money),
    trend: g.trend || 'stable',
    phase: phase,
    subItems: [
      { k:'银', v:_barFmtNum(money), d:moneyDelta },
      { k:'粮', v:_barFmtNum(grain), d:grainDelta },
      { k:'布', v:_barFmtNum(cloth), d:clothDelta }
    ],
    tip: {
      title: '帑廪（国库·三账）',
      phase: phase === 'bankrupt' ? '⚠ 财政破产' : '正常',
      rows: [
        ['银',   _barFmtNum(money) + ' ' + U.money],
        ['粮',   _barFmtNum(grain) + ' ' + U.grain],
        ['布',   _barFmtNum(cloth) + ' ' + U.cloth],
        [incomeLabel, _barFmtNum(g.turnIncome || g.monthlyIncome || 0) + ' ' + U.money],
        [expenseLabel, _barFmtNum(g.turnExpense || g.monthlyExpense || 0) + ' ' + U.money],
        ['年入', _barFmtNum(g.annualIncome || 0) + ' ' + U.money]
      ],
      note: '点击查看帑廪详情'
    }
  };
}

function _renderNeitang() {
  var n = GM.neitang || {};
  var money = (n.ledgers && n.ledgers.money && n.ledgers.money.stock) != null
    ? n.ledgers.money.stock
    : (n.money != null ? n.money : (n.balance || 0));
  var grain = (n.ledgers && n.ledgers.grain && n.ledgers.grain.stock) != null
    ? n.ledgers.grain.stock
    : (n.grain || 0);
  var cloth = (n.ledgers && n.ledgers.cloth && n.ledgers.cloth.stock) != null
    ? n.ledgers.cloth.stock
    : (n.cloth || 0);
  var U = (typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : { money:'两', grain:'石', cloth:'匹' };
  var turnDays = (GM.guoku && GM.guoku.turnDays) || n.turnDays || 30;
  var incomeLabel = turnDays === 30 ? '月入' : ('每' + turnDays + '日入');
  var expenseLabel = turnDays === 30 ? '月支' : ('每' + turnDays + '日支');
  var moneyDelta = (n.turnIncome || n.monthlyIncome || 0) - (n.turnExpense || n.monthlyExpense || 0);
  var grainDelta = (n.ledgers && n.ledgers.grain && n.ledgers.grain.turnDelta != null)
    ? n.ledgers.grain.turnDelta
    : ((n.turnGrainIncome || 0) - (n.turnGrainExpense || 0));
  var clothDelta = (n.ledgers && n.ledgers.cloth && n.ledgers.cloth.turnDelta != null)
    ? n.ledgers.cloth.turnDelta
    : ((n.turnClothIncome || 0) - (n.turnClothExpense || 0));
  return {
    value: _barFmtNum(money),
    trend: n.trend || 'stable',
    phase: '',
    subItems: [
      { k:'银', v:_barFmtNum(money), d:moneyDelta },
      { k:'粮', v:_barFmtNum(grain), d:grainDelta },
      { k:'布', v:_barFmtNum(cloth), d:clothDelta }
    ],
    tip: {
      title: '内帑（皇室私库·三账）',
      phase: '皇室私产',
      rows: [
        ['银',   _barFmtNum(money) + ' ' + U.money],
        ['粮',   _barFmtNum(grain) + ' ' + U.grain],
        ['布',   _barFmtNum(cloth) + ' ' + U.cloth],
        [incomeLabel, _barFmtNum(n.turnIncome || n.monthlyIncome || 0) + ' ' + U.money],
        [expenseLabel, _barFmtNum(n.turnExpense || n.monthlyExpense || 0) + ' ' + U.money]
      ],
      note: '点击查看内帑详情'
    }
  };
}

function _renderHukou() {
  // 优先读新聚合（IntegrationBridge 写入 GM.population.national），fallback 老 hukou
  var pop = (GM.population && GM.population.national) || {};
  var legacy = GM.hukou || {};
  var total = pop.mouths || legacy.registeredTotal || 0;
  var households = pop.households || 0;
  var ding = pop.ding || 0;
  var fugitives = (GM.population && GM.population.fugitives) || 0;
  var hidden = (GM.population && GM.population.hiddenCount) || legacy.estimatedHidden || 0;
  var initial = (GM.scenarioMetadata && GM.scenarioMetadata.initialPopulation) || total;
  var phase = total < initial * 0.5 ? 'depopulation' : '';
  return {
    value: _barFmtNum(total),
    trend: legacy.trend || 'stable',
    phase: phase,
    tip: {
      title: '在籍户口',
      phase: phase === 'depopulation' ? '⚠ 人口锐减' : '常态',
      rows: [
        ['口',     _barFmtNum(total)],
        ['户',     _barFmtNum(households)],
        ['丁',     _barFmtNum(ding)],
        ['逃户',   _barFmtNum(fugitives)],
        ['隐户',   _barFmtNum(hidden)],
        ['隐户率', total > 0 ? ((hidden / (total + hidden)) * 100).toFixed(1) + '%' : '—']
      ],
      note: '点击查看户口详情'
    }
  };
}

function _renderLizhi() {
  var c = GM.corruption || {};
  var trueIdx = c.trueIndex || 0;
  var perc = c.perceivedIndex !== undefined ? c.perceivedIndex : trueIdx;
  // 吏治段位（腐败高=吏治差）
  var phase = '';
  if (trueIdx > 70) phase = 'corrupt-high';
  // 墨点指示（与 腐败系统 §5.2 一致）
  var dots = trueIdx < 25 ? '○○○○' :
             trueIdx < 50 ? '○○○●' :
             trueIdx < 70 ? '○○●●' :
             trueIdx < 85 ? '○●●●' : '●●●●';
  var phaseName = trueIdx < 25 ? '清明' :
                  trueIdx < 50 ? '尚可' :
                  trueIdx < 70 ? '渐弊' :
                  trueIdx < 85 ? '颓靡' : '积重';
  var sd = c.subDepts || {};
  return {
    value: dots,
    trend: 'stable',
    phase: phase,
    tip: {
      title: '吏治',
      phase: phaseName + '（朝廷视野：' + Math.round(perc) + '）',
      rows: [
        ['真实浊度', Math.round(trueIdx) + ' / 100'],
        ['朝廷视野', Math.round(perc) + '（地方可能粉饰）'],
        ['中央部门', Math.round((sd.central||{}).true || 0)],
        ['地方部门', Math.round((sd.provincial||{}).true || 0)],
        ['军队部门', Math.round((sd.military||{}).true || 0)],
        ['税司',    Math.round((sd.fiscal||{}).true || 0)],
        ['监察力度', ((c.supervision||{}).level || 0) + ' / 100']
      ],
      note: '真实浊度与朝廷视野的落差决定了"你以为的吏治"与"实际的吏治"。点击查看详情'
    }
  };
}

function _renderMinxin() {
  var m = GM.minxin || {};
  var trueIdx = m.trueIndex || 0;
  var perc = m.perceivedIndex !== undefined ? m.perceivedIndex : trueIdx;
  var phase = trueIdx < 20 ? 'revolt' :
              trueIdx < 40 ? 'thievery' :
              trueIdx < 60 ? 'endurance' :
              trueIdx < 80 ? 'peace' : 'acclaim';
  var phaseNames = {
    revolt:'揭竿',thievery:'窃盗',endurance:'忍耐',peace:'安居',acclaim:'颂圣'
  };
  return {
    value: Math.round(trueIdx),
    trend: m.trend || 'stable',
    phase: phase,
    tip: {
      title: '民心',
      phase: phaseNames[phase] + '段（朝廷视野：' + Math.round(perc) + '）',
      rows: [
        ['真实民心', Math.round(trueIdx) + ' / 100'],
        ['朝廷视野', Math.round(perc) + '（地方上报）'],
        ['段位',     phaseNames[phase]]
      ],
      note: '"天视自我民视"——但朝廷看到的民心未必真实。点击查看分区/分阶层详情'
    }
  };
}

function _renderHuangquan() {
  var h = GM.huangquan || {};
  var idx = h.index || 0;
  var phase = idx < 35 ? 'ministerDominance' : idx < 75 ? 'balance' : 'absolutism';
  var phaseNames = { ministerDominance:'权臣专政', balance:'制衡', absolutism:'专制' };
  var sd = h.subDims || {};
  var pm = h.powerMinister;
  return {
    value: Math.round(idx),
    trend: h.trend || 'stable',
    phase: phase,
    tip: {
      title: '皇权',
      phase: phaseNames[phase] + '段' + (phase === 'balance' ? '（最佳）' : ''),
      rows: [
        ['皇权指数', Math.round(idx) + ' / 100'],
        ['中央',    Math.round((sd.central||{}).value || 0)],
        ['地方',    Math.round((sd.provincial||{}).value || 0)],
        ['军队',    Math.round((sd.military||{}).value || 0)],
        ['内廷',    Math.round((sd.imperial||{}).value || 0)]
      ].concat(pm ? [['权臣',pm.name || '某氏']] : []),
      note: phase === 'absolutism' ? '专制段：诏书须详尽（时地人钱考），大臣多献媚' :
            phase === 'balance'    ? '制衡段（最佳）：诏书可简略，大臣补全方案' :
            '权臣段：诏书可能被驳回/修改/篡改'
    }
  };
}

function _renderHuangwei() {
  var w = GM.huangwei || {};
  var idx = w.index || 0;
  var perc = w.perceivedIndex !== undefined ? w.perceivedIndex : idx;
  var phase = idx >= 90 ? 'tyrant' :
              idx >= 70 ? 'majesty' :
              idx >= 50 ? 'normal' :
              idx >= 30 ? 'decline' : 'lost';
  var phaseNames = { tyrant:'暴君', majesty:'威严', normal:'常望', decline:'衰微', lost:'失威' };
  var sd = w.subDims || {};
  return {
    value: Math.round(idx),
    trend: w.trend || 'stable',
    phase: phase,
    tip: {
      title: '皇威',
      phase: phaseNames[phase] + '段' + (phase === 'majesty' ? '（最佳）' : phase === 'tyrant' ? '⚠' : phase === 'lost' ? '⚠' : ''),
      rows: [
        ['皇威真值', Math.round(idx) + ' / 100'],
        ['朝廷视野', Math.round(perc) + (phase === 'tyrant' ? '（颂声扭曲）' : '')],
        ['朝廷',    Math.round((sd.court||{}).value || 0)],
        ['地方',    Math.round((sd.provincial||{}).value || 0)],
        ['军中',    Math.round((sd.military||{}).value || 0)],
        ['外邦',    Math.round((sd.foreign||{}).value || 0)]
      ],
      note: phase === 'tyrant' ? '⚠ 暴君综合症激活：奏疏多颂圣，诏书被过度执行。点击查看隐藏代价' :
            phase === 'lost'   ? '⚠ 失威危机激活：抗疏暴增，诏书效率极低' :
            phase === 'majesty' ? '威严段（最佳）：有威而可谏，施行适当' :
            '点击查看详情'
    }
  };
}

// 变量 → 渲染函数 映射
var _VAR_RENDERERS = {
  guoku: _renderGuoku,
  neitang: _renderNeitang,
  hukou: _renderHukou,
  lizhi: _renderLizhi,
  minxin: _renderMinxin,
  huangquan: _renderHuangquan,
  huangwei: _renderHuangwei
};

// ─────────────────────────────────────────────
// 主渲染函数
// ─────────────────────────────────────────────

function renderTopBarVars() {
  var host = document.getElementById('bar-vars');
  if (!host) return;
  if (typeof GM === 'undefined' || !GM.running) { host.innerHTML = ''; return; }

  var html = '';
  for (var i = 0; i < TOP_BAR_VARS.length; i++) {
    var cfg = TOP_BAR_VARS[i];
    var renderer = _VAR_RENDERERS[cfg.key];
    if (!renderer) continue;
    var r = renderer();
    var arrow = _barTrendArrow(r.trend);
    var _isWide = !!(r.subItems && r.subItems.length);
    var _subHtml = '';
    if (_isWide) {
      _subHtml = '<div class="bar-var-sub">';
      for (var _si = 0; _si < r.subItems.length; _si++) {
        var _s = r.subItems[_si];
        var _d = _s.d || 0;
        var _dCls = _d > 0 ? 'up' : (_d < 0 ? 'down' : 'flat');
        var _dTxt = _d > 0 ? ('+' + _barFmtNum(_d)) : (_d < 0 ? ('-' + _barFmtNum(Math.abs(_d))) : '±0');
        _subHtml += '<div class="bar-var-sub-item"><span class="sk">' + _s.k + '</span>' +
                    '<span class="sv">' + _s.v + '</span>' +
                    '<span class="sd ' + _dCls + '">' + _dTxt + '</span></div>';
      }
      _subHtml += '</div>';
    }
    html += '<div class="bar-var' + (_isWide ? ' wide' : '') + '" data-var="' + cfg.key + '"' +
            ' data-phase="' + (r.phase || '') + '"' +
            ' data-tip-idx="' + i + '"' +
            ' onclick="_handleBarVarClick(\'' + cfg.key + '\')"' +
            ' onmouseenter="_showBarVarTip(event,' + i + ')"' +
            ' onmouseleave="_hideBarVarTip()"' +
            ' onmousemove="_moveBarVarTip(event)">' +
            '<span class="bar-var-name">' + cfg.name + '</span>' +
            (_isWide ? _subHtml : ('<span class="bar-var-value">' + r.value +
              ' <span class="bar-var-trend ' + arrow.cls + '">' + arrow.sym + '</span>' +
            '</span>')) +
            '</div>';
  }
  // 注：6 新徽标已撤销——子系统内容已并入对应 7 主变量详情面板：
  //   · 通胀(货币)/合规(央地财政) → 帑廪
  //   · 环境承载力 → 户口（承载力与人口耦合）
  //   · 奏疏(诏令)/抗疏 → 皇权
  //   · 民变 → 民心
  //   · 问对(诏书问对Help) → 左侧 Help 页（作为游戏介绍）
  host.innerHTML = html;
}

// 户口详情弹窗
function _openHujiPanel() {
  if (typeof HujiEngine === 'undefined' || !GM.population) return;
  var P = GM.population;
  var body = '<div style="max-width:680px;font-family:inherit;">';
  body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">户口 · 徭役 · 兵役</div>';
  body += '<div style="font-size:0.8rem;color:var(--ink-300);margin-bottom:0.6rem;">朝代：' + P.dynasty + '</div>';
  body += '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;">';
  body += '<tr><td>户</td><td>' + (P.national.households >= 10000 ? (P.national.households/10000).toFixed(1)+'万' : P.national.households) + '</td>';
  body += '<td>口</td><td>' + (P.national.mouths >= 10000 ? (P.national.mouths/10000).toFixed(0)+'万' : P.national.mouths) + '</td>';
  body += '<td>丁</td><td>' + (P.national.ding >= 10000 ? (P.national.ding/10000).toFixed(0)+'万' : P.national.ding) + '</td></tr>';
  body += '<tr><td>逃户</td><td colspan="3" style="color:var(--amber-400);">' + P.fugitives + '</td></tr>';
  body += '</table>';
  // 色目户
  body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">色目户</div>';
  body += '<div style="font-size:0.78rem;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">';
  Object.keys(P.byCategory || {}).forEach(function(k) {
    var c = P.byCategory[k];
    body += '<div>' + (HujiEngine.CATEGORY_TEMPLATES[k] ? HujiEngine.CATEGORY_TEMPLATES[k].name : k) + '：' + (c.households >= 10000 ? (c.households/10000).toFixed(1)+'万' : c.households) + '户</div>';
  });
  body += '</div>';
  // 徭役
  if (P.corvee) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">徭役</div>';
    body += '<div style="font-size:0.78rem;">' + (P.corvee.fullyCommuted ? '役银合一（一条鞭法后）' : '常役：丁年 ' + P.corvee.annualCorveeDays + ' 日') + '</div>';
  }
  // 兵役
  if (P.military) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">兵制</div>';
    body += '<div style="font-size:0.78rem;">';
    Object.keys(P.military.types).forEach(function(k) {
      var t = P.military.types[k];
      if (t.enabled) {
        body += (HujiEngine.MILITARY_TYPES[k] ? HujiEngine.MILITARY_TYPES[k].name : k) + ' ' + (t.strength >= 10000 ? (t.strength/10000).toFixed(1)+'万' : t.strength) + ' · ';
      }
    });
    body += '</div>';
  }
  // 大徭役
  if (P.largeCorveeActive && P.largeCorveeActive.length > 0) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">进行中大役</div>';
    P.largeCorveeActive.filter(function(a){return a.status==='ongoing';}).forEach(function(a) {
      body += '<div style="font-size:0.78rem;padding:3px;border-left:3px solid var(--gold-500);margin:2px 0;">' + a.name + ' · 进度 ' + (a.progress*100).toFixed(0) + '% · 死亡 ' + Math.round(a.totalDeaths) + '</div>';
    });
  }
  // 大徭役发起 UI（20 预设）
  if (HujiEngine.LARGE_CORVEE_PRESETS && HujiEngine.LARGE_CORVEE_PRESETS.length > 0) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">发起大徭役（20 预设）</div>';
    body += '<select id="_largeCorveePick" style="font-size:0.72rem;padding:3px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:3px;max-width:70%;">';
    body += '<option value="">-- 选择大役 --</option>';
    HujiEngine.LARGE_CORVEE_PRESETS.forEach(function(p) {
      body += '<option value="' + p.id + '">[' + p.dynasty + '] ' + p.name + '（调 ' + (p.laborDemand/10000).toFixed(0) + '万丁·' + p.duration + '年·死亡率' + (p.deathRate*100).toFixed(0) + '%）</option>';
    });
    body += '</select>';
    body += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-left:6px;" onclick="var s=document.getElementById(\'_largeCorveePick\');if(s.value){var r=HujiEngine.startLargeCorvee(s.value);if(r.ok)toast(\'已开工\');else toast(r.reason||\'失败\');document.querySelector(\'[onclick*=_openHujiPanel]\');this.closest(\'div[style*=position]\').remove();if(typeof _openHujiPanel===\'function\')_openHujiPanel();}">开工</button>';
  }
  // 民变镇压 UI
  if (GM.minxin && GM.minxin.revolts && typeof AuthorityComplete !== 'undefined') {
    var ongoing = GM.minxin.revolts.filter(function(r) { return r.status === 'ongoing'; });
    if (ongoing.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:0.6rem 0 0.2rem;">进行中民变（需镇压）</div>';
      var LEVELS = AuthorityComplete.REVOLT_LEVELS || [];
      ongoing.forEach(function(r) {
        var lv = LEVELS[(r.level||1) - 1] || {};
        body += '<div style="padding:6px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.72rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
        body += '<b style="color:var(--vermillion-300);">[' + (lv.name || ('L'+r.level)) + ']</b>';
        body += (r.region || '某地') + ' · 众 ' + (r.scale >= 10000 ? (r.scale/10000).toFixed(1)+'万' : r.scale);
        body += (r._suppressionOrder ? ' · <span style="color:var(--amber-400);">官军 ' + r._suppressionOrder.strength + ' 讨伐中</span>' : '');
        if (!r._suppressionOrder) {
          var suggestTroops = (r.scale || 5000) * 3;
          body += ' <input type="number" id="_revTroops_' + r.id + '" value="' + suggestTroops + '" style="width:80px;padding:1px 4px;font-size:0.7rem;">';
          body += ' <button class="btn" style="font-size:0.68rem;padding:2px 6px;" onclick="var v=parseInt(document.getElementById(\'_revTroops_' + r.id + '\').value)||0;var res=AuthorityComplete.suppressRevolt(\'' + r.id + '\',v);if(res.ok)toast(\'已调 \'+v+\' 兵镇压\');this.closest(\'div[style*=position]\').remove();if(typeof _openHujiPanel===\'function\')_openHujiPanel();">调兵镇压</button>';
        }
        body += '</div>';
      });
      body += '<div style="font-size:0.68rem;color:var(--txt-d);margin-top:4px;">需调兵力约 3×民变规模方可速平；不足则拉锯。</div>';
    }
  }
  // 军队调动 UI
  if (typeof HujiDeepFill !== 'undefined' && HujiDeepFill.dispatchTroops) {
    var regions = (GM.regions || []).map(function(r){return r.id;}).slice(0, 20);
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">军队调动</div>';
    body += '<div style="display:flex;gap:4px;align-items:center;font-size:0.72rem;flex-wrap:wrap;">';
    body += '从<select id="_troopFrom" style="font-size:0.7rem;padding:2px;"><option value="">起</option>';
    regions.forEach(function(r){ body += '<option value="' + r + '">' + r + '</option>'; });
    body += '</select>';
    body += '到<select id="_troopTo" style="font-size:0.7rem;padding:2px;"><option value="">止</option>';
    regions.forEach(function(r){ body += '<option value="' + r + '">' + r + '</option>'; });
    body += '</select>';
    body += '兵种<select id="_troopBranch" style="font-size:0.7rem;padding:2px;">';
    Object.keys(HujiDeepFill.MILITARY_BRANCHES).forEach(function(k){ body += '<option value="' + k + '">' + HujiDeepFill.MILITARY_BRANCHES[k].name + '</option>'; });
    body += '</select>';
    body += '兵力<input type="number" id="_troopStr" value="5000" style="width:70px;font-size:0.7rem;padding:2px;">';
    body += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;" onclick="var f=document.getElementById(\'_troopFrom\').value,t=document.getElementById(\'_troopTo\').value,b=document.getElementById(\'_troopBranch\').value,s=parseInt(document.getElementById(\'_troopStr\').value)||5000;if(!f||!t){toast(\'请选择起止\');return;}var r=HujiDeepFill.dispatchTroops({fromRegion:f,toRegion:t,branch:b,strength:s,travelMonths:1});if(r.ok)toast(\'已调\');">调兵</button>';
    body += '</div>';
    // 显示进行中调动
    if (GM.troopOrders && GM.troopOrders.length > 0) {
      var marching = GM.troopOrders.filter(function(o){return o.status==='marching';});
      if (marching.length > 0) {
        body += '<div style="font-size:0.72rem;margin-top:6px;">';
        marching.forEach(function(o) {
          body += '· ' + o.fromRegion + '→' + o.toRegion + ' ' + o.strength + ' 兵（剩 ' + Math.max(0, o.arriveTurn - GM.turn) + ' 月）<br>';
        });
        body += '</div>';
      }
    }
  }
  body += '</div>';
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:18000;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:720px;width:92%;max-height:82vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

// 环境承载力详情弹窗
function _openEnvPanel() {
  if (typeof EnvCapacityEngine === 'undefined' || !GM.environment) return;
  var E = GM.environment;
  var body = '<div style="max-width:680px;font-family:inherit;">';
  body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">环境承载力 · 生态疤痕</div>';
  body += '<div style="font-size:0.8rem;color:var(--ink-300);margin-bottom:0.6rem;">全国加载：' + (E.nationalLoad*100).toFixed(0) + '% · 气候：' + E.climatePhase + ' · 技术：' + E.techEra + '</div>';
  // 承载力
  var nc = E.nationalCarrying;
  body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.4rem 0 0.2rem;">五维承载力（全国）</div>';
  body += '<table style="width:100%;font-size:0.78rem;border-collapse:collapse;">';
  body += '<tr><td>田</td><td>' + (nc.farmland >= 10000 ? (nc.farmland/10000).toFixed(0)+'万' : nc.farmland) + '</td>';
  body += '<td>水</td><td>' + (nc.water >= 10000 ? (nc.water/10000).toFixed(0)+'万' : nc.water) + '</td>';
  body += '<td>薪</td><td>' + (nc.fuel >= 10000 ? (nc.fuel/10000).toFixed(0)+'万' : nc.fuel) + '</td></tr>';
  body += '<tr><td>居</td><td>' + (nc.housing >= 10000 ? (nc.housing/10000).toFixed(0)+'万' : nc.housing) + '</td>';
  body += '<td>卫</td><td colspan="3">' + (nc.sanitation >= 10000 ? (nc.sanitation/10000).toFixed(0)+'万' : nc.sanitation) + '</td></tr>';
  body += '</table>';
  // 严重疤痕
  var scarList = [];
  Object.keys(E.byRegion).forEach(function(rid) {
    var reg = E.byRegion[rid];
    EnvCapacityEngine.SCAR_TYPES.forEach(function(t) {
      if (reg.ecoScars[t] > 0.4) scarList.push({ rid: rid, type: t, val: reg.ecoScars[t] });
    });
  });
  scarList.sort(function(a,b){ return b.val - a.val; });
  if (scarList.length > 0) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">严重疤痕（前 10）</div>';
    scarList.slice(0, 10).forEach(function(s) {
      var col = s.val > 0.7 ? 'var(--vermillion-400)' : s.val > 0.5 ? 'var(--amber-400)' : 'var(--gold-400)';
      body += '<div style="font-size:0.78rem;color:' + col + ';">· ' + s.rid + ' ' + EnvCapacityEngine.SCAR_LABELS[s.type] + ' ' + (s.val*100).toFixed(0) + '%</div>';
    });
  }
  // 近期危机
  var recent = (E.crisisHistory || []).filter(function(c) { return (GM.turn||0) - c.turn < 36; });
  if (recent.length > 0) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">近三年危机</div>';
    recent.slice(-10).reverse().forEach(function(c) {
      body += '<div style="font-size:0.78rem;">· [T' + c.turn + '] ' + c.name + (c.regionId !== 'national' ? '（' + c.regionId + '）' : '') + '</div>';
    });
  }
  // 环政列表（13 类预防）
  var POLS = EnvCapacityEngine.ENV_POLICIES || [];
  body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">可推行环政（13 类·预防）</div>';
  body += '<select id="_envPolicyPick" style="font-size:0.72rem;padding:3px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:3px;max-width:60%;">';
  body += '<option value="">-- 选择政策 --</option>';
  POLS.forEach(function(p) {
    body += '<option value="' + p.id + '">' + p.name + (p.cost && p.cost.money ? '（' + p.cost.money + '贯）' : '') + '</option>';
  });
  body += '</select>';
  body += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-left:6px;" onclick="var s=document.getElementById(\'_envPolicyPick\');if(s.value){var r=EnvCapacityEngine.enactPolicy(s.value);if(r.ok)toast(\'已推行\');else toast(r.reason||\'失败\');}">推行</button>';
  // 恢复政策（10 类·主动治理）
  if (typeof EnvRecoveryFill !== 'undefined' && EnvRecoveryFill.RECOVERY_POLICIES) {
    var RECS = EnvRecoveryFill.RECOVERY_POLICIES;
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">主动恢复政策（10 类·治理）</div>';
    body += '<select id="_envRecoveryPick" style="font-size:0.72rem;padding:3px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:3px;max-width:60%;">';
    body += '<option value="">-- 选择恢复政策 --</option>';
    Object.keys(RECS).forEach(function(k) {
      var p = RECS[k];
      var costStr = p.cost && p.cost.money ? p.cost.money + '贯' : '—';
      if (p.cost && p.cost.grain) costStr += '+' + p.cost.grain + '石';
      body += '<option value="' + k + '">' + p.name + '（疤痕 ' + (p.target === 'multi' ? '多' : p.target) + '↓ · ' + costStr + '）</option>';
    });
    body += '</select>';
    body += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-left:6px;" onclick="var s=document.getElementById(\'_envRecoveryPick\');if(s.value){var r=EnvRecoveryFill.enactRecovery(s.value);if(r.ok)toast(\'已推行恢复\');else toast(r.reason||\'失败\');}">推行</button>';
  }
  // 当前生效政策列表
  var E = GM.environment;
  if (E && (E.activePolicies || E.activeRecoveries)) {
    var allActive = (E.activePolicies || []).concat(E.activeRecoveries || []);
    if (allActive.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">在行政策（' + allActive.length + '）</div>';
      body += '<div style="font-size:0.78rem;">';
      allActive.forEach(function(a) {
        var name = a.id;
        if (POLS) { var p = POLS.find(function(x){return x.id===a.id;}); if (p) name = p.name; }
        if (typeof EnvRecoveryFill !== 'undefined' && EnvRecoveryFill.RECOVERY_POLICIES[a.policyId]) name = EnvRecoveryFill.RECOVERY_POLICIES[a.policyId].name;
        body += '· ' + name + '（' + (a.regionId || 'all') + '）';
      });
      body += '</div>';
    }
  }
  body += '</div>';
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:18000;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:720px;width:92%;max-height:82vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

// 央地财政简览弹窗
function _openCentralLocalPanel() {
  if (typeof CentralLocalEngine === 'undefined' || !GM.fiscal) return;
  var body = '<div style="max-width:680px;font-family:inherit;">';
  body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">央地财政 · 合规监察</div>';
  body += '<div style="font-size:0.8rem;color:var(--ink-300);margin-bottom:0.6rem;">当前预设：' + (GM.fiscal._currentPreset || '—') + '</div>';
  var reports = CentralLocalEngine.getComplianceReport();
  if (reports.length > 0) {
    body += '<table style="width:100%;font-size:0.78rem;border-collapse:collapse;">';
    body += '<tr style="border-bottom:1px solid var(--bdr);"><th style="text-align:left;padding:4px;">区域</th><th>合规</th><th>自治</th><th>上缴/年</th><th>虚报/年</th></tr>';
    reports.slice(0, 20).forEach(function(r) {
      var comCol = r.compliance >= 0.7 ? 'var(--celadon-400)' : r.compliance >= 0.4 ? 'var(--amber-400)' : 'var(--vermillion-400)';
      body += '<tr style="border-bottom:1px solid var(--bdr);"><td style="padding:3px;">' + r.regionId + '</td>';
      body += '<td style="color:' + comCol + ';">' + (r.compliance*100).toFixed(0) + '%</td>';
      body += '<td>' + (r.autonomyLevel*100).toFixed(0) + '%</td>';
      body += '<td>' + (r.remittedThisYear >= 10000 ? (r.remittedThisYear/10000).toFixed(1)+'万' : Math.round(r.remittedThisYear)) + '</td>';
      body += '<td style="color:var(--amber-400);">' + (r.skimmedThisYear >= 10000 ? (r.skimmedThisYear/10000).toFixed(1)+'万' : Math.round(r.skimmedThisYear)) + '</td>';
      body += '</tr>';
    });
    body += '</table>';
  }
  // 监察系统
  if (GM.fiscal.auditSystem) {
    var aud = GM.fiscal.auditSystem;
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.8rem 0 0.2rem;">监察系统</div>';
    body += '<div style="font-size:0.78rem;">年预算 ' + aud.annualBudget + ' 贯 · 覆盖率 ' + (aud.coverageRatio*100).toFixed(0) + '% · 在查 ' + (aud.ongoingInspections||[]).length + ' 项</div>';
  }
  // 央地改革
  var CL_REFS = (typeof CentralLocalEngine !== 'undefined' && CentralLocalEngine.REFORM_PRESETS) || [];
  if (CL_REFS.length > 0 && typeof EconomyGapFill !== 'undefined') {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">可议央地改革</div>';
    body += '<select id="_clReformPick" style="font-size:0.72rem;padding:3px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:3px;max-width:60%;">';
    body += '<option value="">-- 选择改革 --</option>';
    CL_REFS.forEach(function(r) {
      body += '<option value="' + r.id + '">' + r.name + '（' + r.dynasty + '·' + (r.baseSuccessRate*100).toFixed(0) + '%）</option>';
    });
    body += '</select>';
    body += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-left:6px;" onclick="var s=document.getElementById(\'_clReformPick\');if(s.value){EconomyGapFill.submitReformToTinyi(\'central_local\',s.value);toast(\'已付廷议\');}">付廷议</button>';
  }
  // 土地兼并提示
  if (GM.landAnnexation) {
    var la = GM.landAnnexation;
    var laCol = la.concentration > 0.6 ? 'var(--vermillion-400)' : la.concentration > 0.4 ? 'var(--amber-400)' : 'var(--gold-400)';
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">土地兼并</div>';
    body += '<div style="font-size:0.78rem;color:' + laCol + ';">兼并度 ' + (la.concentration*100).toFixed(0) + '% · 危机级别 ' + la.crisisLevel + '/3</div>';
  }
  // 借贷
  if (GM.fiscal.loans) {
    var l = GM.fiscal.loans;
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">借贷在册</div>';
    body += '<div style="font-size:0.78rem;">在贷 ' + (l.outstanding||[]).length + ' 笔 · 累计本金 ' + l.totalPrincipal + ' · 已付息 ' + l.totalInterestPaid + '</div>';
  }
  body += '</div>';
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:18000;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:720px;width:92%;max-height:82vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

// 货币简览弹窗
function _openCurrencyPanel() {
  if (typeof CurrencyEngine === 'undefined' || !GM.currency) return;
  var C = GM.currency;
  var m = C.market || {};
  var body = '<div style="max-width:640px;font-family:inherit;">';
  body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">货币 · 市场概览</div>';
  body += '<div style="font-size:0.8rem;color:var(--ink-300);margin-bottom:0.6rem;">本位制：' + (C.currentStandard || '—') + ' · 朝代：' + (C.dynasty || '—') + '</div>';
  // 市场
  body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.4rem 0 0.2rem;">市场</div>';
  body += '<table style="width:100%;font-size:0.78rem;border-collapse:collapse;">';
  body += '<tr><td>粮价</td><td>' + Math.round(m.grainPrice||0) + ' 文/石</td><td>布价</td><td>' + Math.round(m.clothPrice||0) + ' 文/匹</td></tr>';
  body += '<tr><td>通胀</td><td style="color:' + CurrencyEngine.getInflationColor() + ';">' + ((m.inflation||0)*100).toFixed(1) + '%</td><td>年景</td><td>' + (m.yearFortune||1).toFixed(2) + '</td></tr>';
  body += '<tr><td>战时因子</td><td>' + (m.warInflation||1).toFixed(2) + '</td><td>货币供给比</td><td>' + (m.moneySupplyRatio||0).toFixed(2) + '</td></tr>';
  body += '</table>';
  // 币种
  // 货币改革按钮
  body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">可议货币改革</div>';
  var REFS_LIST = (typeof CurrencyEngine !== 'undefined' && CurrencyEngine.REFORM_PRESETS) || [];
  if (REFS_LIST.length > 0 && typeof EconomyGapFill !== 'undefined') {
    body += '<select id="_currReformPick" style="font-size:0.72rem;padding:3px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:3px;max-width:60%;">';
    body += '<option value="">-- 选择改革 --</option>';
    REFS_LIST.forEach(function(r) {
      body += '<option value="' + r.id + '">' + r.name + '（' + r.dynasty + '·' + (r.baseSuccessRate*100).toFixed(0) + '%）</option>';
    });
    body += '</select>';
    body += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-left:6px;" onclick="var s=document.getElementById(\'_currReformPick\');if(s.value){EconomyGapFill.submitReformToTinyi(\'currency\',s.value);toast(\'已付廷议\');}">付廷议</button>';
  }
  body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">币种</div>';
  body += '<table style="width:100%;font-size:0.78rem;border-collapse:collapse;">';
  body += '<tr style="border-bottom:1px solid var(--bdr);"><th>币</th><th>存量</th><th>成色</th><th>降级</th><th>私铸</th></tr>';
  ['copper','silver','iron','gold'].forEach(function(k) {
    var l = C.coins[k];
    if (!l || !l.enabled) return;
    body += '<tr><td>' + {copper:'铜',silver:'银',iron:'铁',gold:'金'}[k] + '</td>';
    body += '<td>' + (l.stock >= 10000 ? (l.stock/10000).toFixed(1)+'万' : Math.round(l.stock)) + '</td>';
    body += '<td>' + (l.purity*100).toFixed(0) + '%</td>';
    body += '<td>' + (l.debasementLevel*100).toFixed(0) + '%</td>';
    body += '<td>' + (l.privateMintShare*100).toFixed(0) + '%</td></tr>';
  });
  body += '</table>';
  // 纸币
  var actives = (C.paper.issuances||[]).filter(function(p){return p.state!=='abolish';});
  if (actives.length > 0) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">纸币</div>';
    actives.slice(0,5).forEach(function(p) {
      var stateCol = (p.state==='collapse')?'var(--vermillion-400)':(p.state==='depreciate')?'var(--amber-400)':'var(--gold-400)';
      body += '<div style="font-size:0.78rem;padding:4px 6px;margin:2px 0;background:var(--bg-2);border-left:3px solid ' + stateCol + ';">';
      body += '<b>' + p.name + '</b> <span style="color:' + stateCol + ';">[' + p.state + ']</span>';
      body += ' 准备金 ' + (p.reserveRatio*100).toFixed(0) + '% · 信用 ' + Math.round(p.creditLevel) + ' · 流通 ' + (p.currentCirculation >= 10000 ? (p.currentCirculation/10000).toFixed(1)+'万' : Math.round(p.currentCirculation));
      body += '</div>';
    });
  }
  // 海外银流
  if (C.foreignFlow && C.foreignFlow.enabled) {
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.2rem;">海外银流</div>';
    body += '<div style="font-size:0.78rem;">贸易模式：' + C.foreignFlow.tradeMode + ' · 累计净流：' + (C.foreignFlow.cumulativeNet >= 10000 ? (C.foreignFlow.cumulativeNet/10000).toFixed(1)+'万' : Math.round(C.foreignFlow.cumulativeNet)) + ' 两</div>';
  }
  body += '</div>';
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:18000;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:680px;width:90%;max-height:80vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

// ─────────────────────────────────────────────
// 悬停详情 Tooltip
// ─────────────────────────────────────────────

var _barVarTipEl = null;
function _getBarVarTipEl() {
  if (_barVarTipEl) return _barVarTipEl;
  _barVarTipEl = document.createElement('div');
  _barVarTipEl.className = 'bar-var-tip';
  document.body.appendChild(_barVarTipEl);
  return _barVarTipEl;
}

function _showBarVarTip(e, idx) {
  var cfg = TOP_BAR_VARS[idx];
  if (!cfg) return;
  var renderer = _VAR_RENDERERS[cfg.key];
  if (!renderer) return;
  var r = renderer();
  var tip = r.tip;

  var html = '<div class="bar-var-tip-title">' + tip.title + '</div>';
  if (tip.phase) html += '<div class="bar-var-tip-phase">' + tip.phase + '</div>';
  for (var i = 0; i < tip.rows.length; i++) {
    var row = tip.rows[i];
    html += '<div class="bar-var-tip-row"><span class="lbl">' + row[0] + '</span>'+
            '<span class="val">' + row[1] + '</span></div>';
  }
  if (tip.note) html += '<div class="bar-var-tip-note">' + tip.note + '</div>';

  var el = _getBarVarTipEl();
  el.innerHTML = html;
  el.classList.add('visible');
  _moveBarVarTip(e);
}

function _moveBarVarTip(e) {
  if (!_barVarTipEl || !_barVarTipEl.classList.contains('visible')) return;
  var rect = _barVarTipEl.getBoundingClientRect();
  var x = e.clientX + 12;
  var y = e.clientY + 18;
  // 溢出翻转
  if (x + rect.width + 8 > window.innerWidth) x = e.clientX - rect.width - 12;
  if (y + rect.height + 8 > window.innerHeight) y = e.clientY - rect.height - 12;
  if (x < 4) x = 4;
  if (y < 4) y = 4;
  _barVarTipEl.style.left = x + 'px';
  _barVarTipEl.style.top = y + 'px';
}

function _hideBarVarTip() {
  if (_barVarTipEl) _barVarTipEl.classList.remove('visible');
}

// ─────────────────────────────────────────────
// 点击变量 → 跳转详情面板（目前为 stub，各系统面板逐步实现）
// ─────────────────────────────────────────────

function _handleBarVarClick(varKey) {
  _hideBarVarTip();
  var handlers = {
    guoku:     function() {
      if (typeof openGuokuPanel === 'function') openGuokuPanel();
      else _openVarPanelWithSubsystems('帑廪', varKey);
    },
    neitang:   function() {
      if (typeof openNeitangPanel === 'function') openNeitangPanel();
      else _openVarPanelWithSubsystems('内帑', varKey);
    },
    hukou:     function() {
      if (typeof openHukouPanel === 'function') openHukouPanel();
      else _openVarPanelWithSubsystems('在籍户口', varKey);
    },
    lizhi:     function() {
      if (typeof openCorruptionPanel === 'function') openCorruptionPanel();
      else _openVarPanelWithSubsystems('吏治', varKey);
    },
    minxin:    function() {
      if (typeof openMinxinPanel === 'function') openMinxinPanel();
      else _openVarPanelWithSubsystems('民心', varKey);
    },
    huangquan: function() {
      if (typeof openHuangquanPanel === 'function') openHuangquanPanel();
      else _openVarPanelWithSubsystems('皇权', varKey);
    },
    huangwei:  function() {
      if (typeof openHuangweiPanel === 'function') openHuangweiPanel();
      else _openVarPanelWithSubsystems('皇威', varKey);
    }
  };
  var h = handlers[varKey];
  if (h) h();
}

// ═══════════════════════════════════════════════════════════════════
//  7 变量详情面板 — 整合子系统内容
//
//  子系统并入映射：
//    帑廪 ← 货币系统（通胀/铸币/纸币）+ 央地分账（合规/虚报）+ 借贷
//    内帑 ← 宗室压力
//    户口 ← 环境承载力 + 徭役 + 兵役 + 大徭役 + 军调 + 迁徙 + 阶层
//    吏治 ← 腐败明细 + 监察
//    民心 ← 民变 5 级 + 谶纬 + 天象
//    皇权 ← 奏疏待批 + 抗疏 + 权臣 + 执行率
//    皇威 ← 暴君综合症 + 失威危机 + 感知扭曲
// ═══════════════════════════════════════════════════════════════════

function _openVarPanelWithSubsystems(title, varKey) {
  var body = '<div style="max-width:800px;font-family:inherit;">';
  body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">' + title + '</div>';

  if (varKey === 'guoku') body += _renderGuokuFullPanel();
  else if (varKey === 'neitang') body += _renderNeitangFullPanel();
  else if (varKey === 'hukou') body += _renderHukouFullPanel();
  else if (varKey === 'lizhi') body += _renderLizhiFullPanel();
  else if (varKey === 'minxin') body += _renderMinxinFullPanel();
  else if (varKey === 'huangquan') body += _renderHuangquanFullPanel();
  else if (varKey === 'huangwei') body += _renderHuangweiFullPanel();

  body += '</div>';
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:18000;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:840px;width:92%;max-height:85vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

// ── 帑廪：包含货币+央地+借贷 ──
function _renderGuokuFullPanel() {
  var g = GM.guoku || {}; var h = '';
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">帑廪账本</div>';
  h += '<table style="width:100%;font-size:0.8rem;"><tr><td>现余</td><td>' + _barFmtNum(g.money||g.balance||0) + ' 两</td>';
  h += '<td>月入</td><td>' + _barFmtNum(g.monthlyIncome||0) + '</td></tr>';
  h += '<tr><td>月支</td><td>' + _barFmtNum(g.monthlyExpense||0) + '</td>';
  h += '<td>粮</td><td>' + _barFmtNum(g.grain||g.grainStock||0) + '</td></tr></table>';
  // 货币子系统
  if (GM.currency && GM.currency.market) {
    var m = GM.currency.market;
    var infCol = CurrencyEngine && CurrencyEngine.getInflationColor ? CurrencyEngine.getInflationColor() : 'var(--gold-400)';
    h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">货币·市场（子系统）</div>';
    h += '<div style="font-size:0.78rem;">通胀 <span style="color:' + infCol + ';">' + ((m.inflation||0)*100).toFixed(1) + '%</span> · 粮价 ' + Math.round(m.grainPrice||100) + ' 文/石 · 本位 ' + (GM.currency.currentStandard||'—') + '</div>';
    if (GM.currency.coins && GM.currency.coins.copper) {
      var cp = GM.currency.coins.copper;
      h += '<div style="font-size:0.76rem;">铜钱：存量 ' + _barFmtNum(cp.stock) + ' · 成色 ' + ((cp.purity||1)*100).toFixed(0) + '% · 私铸 ' + ((cp.privateMintShare||0)*100).toFixed(0) + '%</div>';
    }
    h += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;" onclick="if(typeof _openCurrencyPanel===\'function\')_openCurrencyPanel();">货币改革/详情</button>';
  }
  // 央地分账
  if (GM.fiscal && GM.fiscal.regions && typeof CentralLocalEngine !== 'undefined') {
    var rpts = CentralLocalEngine.getComplianceReport();
    if (rpts.length > 0) {
      var avgC = rpts.reduce(function(s,r){return s+r.compliance;},0)/rpts.length;
      var clCol = avgC >= 0.7 ? 'var(--celadon-400)' : avgC >= 0.4 ? 'var(--amber-400)' : 'var(--vermillion-400)';
      h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">央地分账（子系统）</div>';
      h += '<div style="font-size:0.78rem;">预设：' + (GM.fiscal._currentPreset||'—') + ' · 平均合规 <span style="color:' + clCol + ';">' + (avgC*100).toFixed(0) + '%</span> · 区域 ' + rpts.length + '</div>';
      h += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;" onclick="if(typeof _openCentralLocalPanel===\'function\')_openCentralLocalPanel();">央地详情</button>';
    }
  }
  // 借贷
  if (GM.fiscal && GM.fiscal.loans && GM.fiscal.loans.outstanding.length > 0) {
    h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">借贷在册</div>';
    h += '<div style="font-size:0.78rem;">' + GM.fiscal.loans.outstanding.length + ' 笔 · 本金 ' + _barFmtNum(GM.fiscal.loans.totalPrincipal) + '</div>';
  }
  return h;
}
function _renderNeitangFullPanel() {
  var n = GM.neitang || {}; var h = '';
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">内帑账本</div>';
  h += '<table style="width:100%;font-size:0.8rem;"><tr><td>现余</td><td>' + _barFmtNum(n.money||n.balance||0) + '</td>';
  h += '<td>月入</td><td>' + _barFmtNum(n.monthlyIncome||0) + '</td></tr>';
  h += '<tr><td>皇庄</td><td colspan="3">' + _barFmtNum(n.huangzhuangAcres||0) + ' 亩</td></tr></table>';
  return h;
}
// ── 户口：整合承载力+徭役+兵役+大徭役+军调+迁徙+阶层 ──
function _renderHukouFullPanel() {
  var P = GM.population; var h = '';
  if (!P || !P.national) return '<div style="color:#d4be7a;">户口未初始化</div>';
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">户口总览</div>';
  h += '<table style="width:100%;font-size:0.8rem;">';
  h += '<tr><td>户</td><td>' + _barFmtNum(P.national.households) + '</td>';
  h += '<td>口</td><td>' + _barFmtNum(P.national.mouths) + '</td>';
  h += '<td>丁</td><td>' + _barFmtNum(P.national.ding) + '</td></tr>';
  h += '<tr><td>逃户</td><td colspan="5" style="color:var(--amber-400);">' + (P.fugitives||0) + '</td></tr></table>';
  // 环境承载力
  if (GM.environment) {
    var nLoad = GM.environment.nationalLoad || 0.5;
    var envCol = nLoad < 0.8 ? 'var(--celadon-400)' : nLoad < 1.1 ? 'var(--gold-400)' : 'var(--vermillion-400)';
    h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">环境承载力（子系统）</div>';
    h += '<div style="font-size:0.78rem;">加载比 <span style="color:' + envCol + ';">' + (nLoad*100).toFixed(0) + '%</span> · 气候 ' + (GM.environment.climatePhase||'normal') + ' · 疤痕区域 ' + Object.keys(GM.environment.byRegion||{}).length + '</div>';
    h += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;" onclick="if(typeof _openEnvPanel===\'function\')_openEnvPanel();">环境详情</button>';
  }
  // 徭役/兵役
  if (P.corvee) h += '<div style="font-size:0.78rem;margin-top:0.4rem;">役法：' + (P.corvee.fullyCommuted?'役银合一':'丁年 '+P.corvee.annualCorveeDays+' 日') + '</div>';
  if (P.military && P.military.types) {
    var milS = [];
    Object.keys(P.military.types).forEach(function(k){ if(P.military.types[k].enabled && P.military.types[k].strength>1000) milS.push(k+' '+_barFmtNum(P.military.types[k].strength)); });
    if (milS.length) h += '<div style="font-size:0.78rem;">兵制：' + milS.join(' · ') + '</div>';
  }
  // 大徭役
  if (P.largeCorveeActive && P.largeCorveeActive.length > 0) {
    h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">进行中大徭役</div>';
    P.largeCorveeActive.filter(function(a){return a.status==='ongoing';}).forEach(function(a){
      h += '<div style="font-size:0.76rem;padding:3px;border-left:3px solid var(--gold-500);margin:2px 0;">' + a.name + ' · ' + (a.progress*100).toFixed(0) + '%</div>';
    });
  }
  // 阶层
  if (P.byClass) {
    var cls = P.byClass;
    var parts = [];
    ['landlord','merchant','peasant_self','peasant_tenant'].forEach(function(k){
      if(cls[k] && cls[k].mouths) parts.push({gentry_high:'高门',landlord:'豪强',merchant:'商',peasant_self:'自耕',peasant_tenant:'佃农'}[k] + ' ' + _barFmtNum(cls[k].mouths));
    });
    if (parts.length) h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">阶层</div><div style="font-size:0.78rem;">' + parts.join(' · ') + '</div>';
  }
  // 打开专门 panel 的按钮
  if (typeof _openHujiPanel === 'function') {
    h += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;margin-top:6px;" onclick="this.closest(\'div[style*=position]\').remove();_openHujiPanel();">完整户口面板（含大徭役发起/军调/民变镇压）</button>';
  }
  return h;
}
// ── 吏治（腐败）──
function _renderLizhiFullPanel() {
  var c = GM.corruption || {}; var h = '';
  var trueIdx = c.trueIndex || 0;
  var perc = c.perceivedIndex !== undefined ? c.perceivedIndex : trueIdx;
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">吏治（腐败真伪对比）</div>';
  h += '<div style="font-size:0.82rem;">真实浊度：' + Math.round(trueIdx) + ' / 100 · 朝廷视野：' + Math.round(perc) + '（差额 ' + Math.round(perc-trueIdx) + '）</div>';
  if (c.subDepts) {
    h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">部门细分</div>';
    Object.keys(c.subDepts).forEach(function(k){
      h += '<div style="font-size:0.78rem;">' + k + '：真 ' + Math.round((c.subDepts[k]||{}).true||0) + '</div>';
    });
  }
  return h;
}
// ── 民心：包含民变+谶纬+天象 ──
function _renderMinxinFullPanel() {
  var m = GM.minxin || {}; var h = '';
  var trueIdx = m.trueIndex || 0;
  var perc = m.perceivedIndex !== undefined ? m.perceivedIndex : trueIdx;
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">民心真伪</div>';
  h += '<div style="font-size:0.82rem;">真实：' + Math.round(trueIdx) + ' / 100 · 朝廷视野：' + Math.round(perc) + '</div>';
  // 民变 5 级
  if (m.revolts) {
    var ongoing = m.revolts.filter(function(r){return r.status==='ongoing';});
    if (ongoing.length > 0 && typeof AuthorityComplete !== 'undefined') {
      h += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:0.6rem 0 0.3rem;">进行中民变（子系统）</div>';
      var LEVELS = AuthorityComplete.REVOLT_LEVELS || [];
      ongoing.forEach(function(r) {
        var lv = LEVELS[(r.level||1) - 1] || {};
        h += '<div style="padding:6px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.74rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
        h += '<b style="color:var(--vermillion-300);">[' + (lv.name || ('L'+r.level)) + ']</b>';
        h += (r.region || '某地') + ' · ' + _barFmtNum(r.scale||5000);
        if (!r._suppressionOrder) {
          h += ' <input type="number" id="_revT_' + r.id + '" value="' + ((r.scale||5000)*3) + '" style="width:80px;padding:1px 4px;font-size:0.7rem;">';
          h += ' <button class="btn" style="font-size:0.68rem;padding:2px 6px;" onclick="var v=parseInt(document.getElementById(\'_revT_' + r.id + '\').value)||0;var rr=AuthorityComplete.suppressRevolt(\'' + r.id + '\',v);if(rr.ok)toast(\'已调 \'+v+\' 兵\');">调兵镇压</button>';
        } else {
          h += ' <span style="color:var(--amber-400);">官军 ' + r._suppressionOrder.strength + ' 讨伐中</span>';
        }
        h += '</div>';
      });
    }
  }
  // 谶纬
  if (m.prophecy && m.prophecy.intensity > 0.1) {
    h += '<div style="font-size:0.78rem;color:var(--amber-400);margin-top:0.4rem;">谶纬流传强度：' + (m.prophecy.intensity*100).toFixed(0) + '%</div>';
  }
  // 天象
  if (GM.heavenSigns && GM.heavenSigns.length > 0) {
    var recent = GM.heavenSigns.filter(function(s){return (GM.turn||0) - s.turn < 12;});
    if (recent.length > 0) {
      h += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.6rem 0 0.3rem;">近年天象/祥瑞</div>';
      recent.slice(-6).forEach(function(s) {
        var col = s.type === 'good' ? 'var(--celadon-400)' : 'var(--vermillion-400)';
        h += '<div style="font-size:0.76rem;color:' + col + ';">· [T' + s.turn + '] ' + s.name + '</div>';
      });
    }
  }
  return h;
}
// ── 皇权：包含奏疏+抗疏+权臣+执行率 ──
function _renderHuangquanFullPanel() {
  var hq = GM.huangquan || {}; var h = '';
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">皇权指数</div>';
  h += '<div style="font-size:0.82rem;">' + Math.round(hq.index||50) + ' / 100 · 段位 ' + (hq.phase||'moderate');
  if (hq.executionRate) h += ' · 诏令执行率 ' + (hq.executionRate*100).toFixed(0) + '%';
  h += '</div>';
  // 四维
  if (hq.subDims) {
    h += '<div style="font-size:0.78rem;margin-top:0.3rem;">中央 ' + Math.round(hq.subDims.central.value) + ' · 地方 ' + Math.round(hq.subDims.provincial.value) + ' · 军队 ' + Math.round(hq.subDims.military.value) + ' · 内廷 ' + Math.round(hq.subDims.imperial.value) + '</div>';
  }
  // 奏疏
  var pendN = (GM._pendingMemorials||[]).filter(function(m){return m.status==='drafted';}).length;
  if (pendN > 0) {
    h += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:0.6rem 0 0.3rem;">奏疏待朱批（' + pendN + '）</div>';
    h += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;" onclick="if(typeof openMemorialsPanel===\'function\')openMemorialsPanel();">查看奏疏</button>';
  }
  // 抗疏
  if (GM._abductions && GM._abductions.length > 0) {
    var recentAb = GM._abductions.filter(function(a){return (GM.turn||0) - a.turn < 6;});
    if (recentAb.length > 0) {
      h += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:0.6rem 0 0.3rem;">近年抗疏（' + recentAb.length + '）</div>';
      recentAb.slice(-3).forEach(function(a) {
        h += '<div style="font-size:0.76rem;">· ' + a.objector + '：' + (a.content||'').slice(0,40) + '</div>';
      });
    }
  }
  // 权臣
  if (hq.powerMinister) {
    h += '<div style="font-size:0.82rem;color:var(--vermillion-500);margin:0.6rem 0 0.3rem;">⚠ 权臣坐大</div>';
    h += '<div style="font-size:0.78rem;">' + hq.powerMinister.name + ' · 控制度 ' + (hq.powerMinister.controlLevel*100).toFixed(0) + '% · 党羽 ' + (hq.powerMinister.faction||[]).length + '</div>';
  }
  return h;
}
// ── 皇威：包含暴君综合症+失威危机+感知扭曲 ──
function _renderHuangweiFullPanel() {
  var w = GM.huangwei || {}; var h = '';
  h += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.3rem;">皇威指数</div>';
  h += '<div style="font-size:0.82rem;">真值：' + Math.round(w.index||50) + ' · 朝廷视野：' + Math.round(w.perceivedIndex||w.index||50) + ' · 段位 ' + (w.phase||'normal') + '</div>';
  if (w.subDims) {
    h += '<div style="font-size:0.78rem;margin-top:0.3rem;">朝廷 ' + Math.round(w.subDims.court.value) + ' · 地方 ' + Math.round(w.subDims.provincial.value) + ' · 军中 ' + Math.round(w.subDims.military.value) + ' · 外邦 ' + Math.round(w.subDims.foreign.value) + '</div>';
  }
  // 暴君
  if (w.tyrantSyndrome && w.tyrantSyndrome.active) {
    h += '<div style="font-size:0.82rem;color:var(--vermillion-500);margin:0.6rem 0 0.3rem;">⚠ 暴君综合症激活</div>';
    h += '<div style="font-size:0.76rem;">颂圣比例 ' + ((w.tyrantSyndrome.flatteryMemorialRatio||0)*100).toFixed(0) + '% · 过度执行 ' + (w.tyrantSyndrome.overExecutionLog||[]).length + ' 条</div>';
    var hd = w.tyrantSyndrome.hiddenDamage || {};
    h += '<div style="font-size:0.74rem;color:var(--amber-400);">隐伤：民心暗降 ' + Math.round(hd.unreportedMinxinDrop||0) + ' · 隐匿腐败 ' + Math.round(hd.concealedCorruption||0) + '</div>';
  }
  if (w.lostAuthorityCrisis && w.lostAuthorityCrisis.active) {
    h += '<div style="font-size:0.82rem;color:var(--vermillion-500);margin:0.6rem 0 0.3rem;">⚠ 失威危机激活</div>';
    h += '<div style="font-size:0.76rem;">抗疏频次 ×' + (w.lostAuthorityCrisis.objectionFrequency||1).toFixed(1) + ' · 外邦蠢动 ' + ((w.lostAuthorityCrisis.foreignEmboldened||0)*100).toFixed(0) + '%</div>';
  }
  return h;
}

function _showStubPanel(varName, designDoc) {
  var html = '<div style="padding:1.5rem;">'+
    '<h3 style="color:var(--gold);margin-bottom:0.8rem;">' + varName + ' · 详情面板</h3>'+
    '<p style="color:var(--txt-s);line-height:1.6;">详细的 UI 面板将按 <code style="color:var(--gold-l);">' + designDoc + '</code> 中的设计实现。</p>'+
    '<p style="color:var(--txt-d);font-size:0.82rem;margin-top:0.6rem;font-style:italic;">当前为占位，完整面板含分项雷达图、历史趋势、可选政策等。</p>'+
    '</div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal(varName + '（占位）', html, null);
  } else {
    alert(varName + ' 详情面板待实现（见 ' + designDoc + '）');
  }
}

// ─────────────────────────────────────────────
// 全部变量模态弹窗
// ─────────────────────────────────────────────

function openAllVarsModal() {
  _hideBarVarTip();
  var ov = document.getElementById('all-vars-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'all-vars-overlay';
    ov.className = 'all-vars-overlay';
    ov.innerHTML = '<div class="all-vars-panel">'+
      '<div class="all-vars-header">'+
        '<div class="all-vars-title">全部变量</div>'+
        '<button class="all-vars-close" onclick="closeAllVarsModal()">×</button>'+
      '</div>'+
      '<div class="all-vars-body" id="all-vars-body"></div>'+
    '</div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) closeAllVarsModal(); });
    document.body.appendChild(ov);
  }
  _renderAllVarsBody();
  ov.classList.add('open');
}

function closeAllVarsModal() {
  var ov = document.getElementById('all-vars-overlay');
  if (ov) ov.classList.remove('open');
}

function _renderAllVarsBody() {
  var body = document.getElementById('all-vars-body');
  if (!body) return;

  // 剧本编辑器定义的变量（P.variables）
  var scenarioVars = (typeof P !== 'undefined' && P.variables) ? P.variables : [];
  // 运行时的 GM.vars（玩家自定义或动态变量）
  var runtimeVars = (typeof GM !== 'undefined' && GM.vars) ? GM.vars : {};

  var html = '';

  // 过滤输入
  html += '<div class="all-vars-filter">'+
    '<input type="text" id="all-vars-search" placeholder="筛选变量名…" oninput="_filterAllVars(this.value)">'+
    '<span style="font-size:0.72rem;color:var(--txt-d);">七官方变量已在顶栏单独展示</span>'+
  '</div>';

  // 剧本定义变量
  if (scenarioVars && scenarioVars.length > 0) {
    html += '<div class="all-vars-group">';
    html += '<div class="all-vars-group-title">剧本编辑变量（' + scenarioVars.length + '）</div>';
    html += '<div class="all-vars-grid">';
    for (var i = 0; i < scenarioVars.length; i++) {
      var v = scenarioVars[i];
      var curVal = runtimeVars[v.name] !== undefined ? runtimeVars[v.name] : (v.initial !== undefined ? v.initial : '—');
      html += '<div class="all-vars-card" data-vname="' + (v.name || '').toLowerCase() + '">'+
        '<div class="all-vars-card-name">' + (v.displayName || v.name || '未命名') + '</div>'+
        '<div class="all-vars-card-value">' + curVal + '</div>'+
        (v.description ? '<div class="all-vars-card-desc">' + v.description + '</div>' : '')+
      '</div>';
    }
    html += '</div></div>';
  }

  // 运行时 GM.vars 中不在剧本定义的
  var extraKeys = [];
  for (var k in runtimeVars) {
    var inScenario = scenarioVars.some(function(sv) { return sv.name === k; });
    if (!inScenario) extraKeys.push(k);
  }
  if (extraKeys.length > 0) {
    html += '<div class="all-vars-group">';
    html += '<div class="all-vars-group-title">运行时变量（' + extraKeys.length + '）</div>';
    html += '<div class="all-vars-grid">';
    for (var j = 0; j < extraKeys.length; j++) {
      var ek = extraKeys[j];
      html += '<div class="all-vars-card" data-vname="' + ek.toLowerCase() + '">'+
        '<div class="all-vars-card-name">' + ek + '</div>'+
        '<div class="all-vars-card-value">' + runtimeVars[ek] + '</div>'+
      '</div>';
    }
    html += '</div></div>';
  }

  if (!scenarioVars.length && !extraKeys.length) {
    html += '<div class="all-vars-empty">此剧本未定义额外变量。<br>（七大官方变量已在顶栏展示）</div>';
  }

  body.innerHTML = html;
}

function _filterAllVars(query) {
  var cards = document.querySelectorAll('.all-vars-card');
  var q = (query || '').toLowerCase().trim();
  for (var i = 0; i < cards.length; i++) {
    var name = cards[i].getAttribute('data-vname') || '';
    cards[i].style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
  }
}

// 支持 ESC 关闭
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeAllVarsModal();
    _hideBarVarTip();
  }
});

// 事件委托兜底：若 inline onclick/onmouseenter 因某些原因失效，此兜底保证点击/悬停仍然可用
(function _bindBarVarDelegation() {
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(function() {
    var host = document.getElementById('bar-vars');
    if (!host) {
      // 容器可能还未渲染——每 500ms 重试一次，最多 20 次
      var tries = 0;
      var iv = setInterval(function() {
        host = document.getElementById('bar-vars');
        tries++;
        if (host || tries > 20) {
          clearInterval(iv);
          if (host) _attach(host);
        }
      }, 500);
      return;
    }
    _attach(host);
  });
  function _attach(host) {
    if (host._barVarDelegated) return;
    host._barVarDelegated = true;
    host.addEventListener('click', function(e) {
      var t = e.target.closest ? e.target.closest('.bar-var') : null;
      if (!t) return;
      var key = t.getAttribute('data-var');
      if (!key) return;
      // 7 主变量走 _handleBarVarClick
      var MAIN_KEYS = { guoku:1, neitang:1, hukou:1, lizhi:1, minxin:1, huangquan:1, huangwei:1 };
      if (MAIN_KEYS[key]) {
        try { _handleBarVarClick(key); } catch(err) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(err, 'topbarclick') : console.error('[topbar click]', key, err); }
        return;
      }
      // 新徽标
      // 6 新徽标已撤销，无额外映射
    });
    host.addEventListener('mouseover', function(e) {
      var t = e.target.closest ? e.target.closest('.bar-var[data-tip-idx]') : null;
      if (!t) return;
      var idx = parseInt(t.getAttribute('data-tip-idx'));
      if (isNaN(idx)) return;
      try { _showBarVarTip(e, idx); } catch(err) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(err, 'topbar hover') : console.error('[topbar hover]', err); }
    });
    host.addEventListener('mouseout', function(e) {
      var t = e.target.closest ? e.target.closest('.bar-var[data-tip-idx]') : null;
      if (!t) return;
      // 移出到 host 以外才关
      var related = e.relatedTarget;
      if (related && host.contains(related)) return;
      try { _hideBarVarTip(); } catch(err){try{window.TM&&TM.errors&&TM.errors.captureSilent(err,'tm-topbar-vars');}catch(_){}}
    });
    host.addEventListener('mousemove', function(e) {
      if (!_barVarTipEl || !_barVarTipEl.classList.contains('visible')) return;
      try { _moveBarVarTip(e); } catch(err){try{window.TM&&TM.errors&&TM.errors.captureSilent(err,'tm-topbar-vars');}catch(_){}}
    });
  }
})();
