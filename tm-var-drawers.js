// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-var-drawers.js — 户口/民心/皇权/皇威 侧边抽屉（纯数据展示）
 *
 * === R116a (2026-04-24) 三代合并为单文件 ===
 * 本文件由三段 IIFE 顺序拼接：
 *   v1 基础层       : 定义 open/close/render*
 *   v2 Rich 替换    : 覆盖 render* 为富内容版 (原 tm-var-drawers-ext.js)
 *   v3 Extra wrap   : wrap render* 末尾追加 extra (原 tm-var-drawers-final.js)
 * 三段 IIFE 保留独立作用域，执行顺序与原三文件顺序加载等价，行为无差异。
 *
 * 原则：
 *   1. 抽屉只展示信息，不含任何操作按钮/表单。
 *   2. 玩家操作去游戏原有的中间栏标签页（诏令/奏疏/问对/鸿雁/朝议/朝政/官制/科举/
 *      起居注/纪事/史记/编年/文苑）。
 *   3. 突发事件通过 addEB 风闻录事 / 大臣奏疏 / NPC 求见 呈现。
 *   4. 点击 NPC 姓名 → 展开人物详情面板（preview-char-full.html）。
 */
(function(global) {
  'use strict';

  function _fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e8) return (n/1e8).toFixed(2) + '亿';
    if (abs >= 1e4) return (n/1e4).toFixed(1) + '万';
    return Math.round(n).toLocaleString();
  }
  // R143·委托给 tm-utils.js:569 的 escHtml
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')); }
  function _sec(title, badge, content) {
    return '<section class="vd-section"><div class="vd-section-title">' + _esc(title) + (badge ? ' <span class="vd-badge">' + _esc(badge) + '</span>' : '') + '</div>' + content + '</section>';
  }

  // 跳转提示块（点击跳到对应中间栏标签页）
  function _tabJump(label, tabId) {
    return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
      'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
      'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
      '→ <b>' + _esc(label) + '</b>（切至标签页处理）' +
    '</div>';
  }

  // NPC 姓名点击跳详情
  function _npcLink(name) {
    if (!name) return '';
    var safeName = _esc(name).replace(/'/g, "\\'");
    return '<span style="color:var(--gold-300);cursor:pointer;text-decoration:underline dotted;" ' +
      'onclick="if(typeof openCharDetail===\'function\')openCharDetail(\'' + safeName + '\');else if(typeof openCharRenwuPage===\'function\')openCharRenwuPage(\'' + safeName + '\');">' + _esc(name) + '</span>';
  }

  // 抽屉创建辅助
  function _createDrawer(id, title, subtitleId, bodyId, closeFn) {
    var ov = document.getElementById(id + '-drawer-ov');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = id + '-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="' + id + '-drawer">' +
      '<div class="var-drawer-header">' +
        '<div>' +
          '<div class="var-drawer-title">' + _esc(title) + '</div>' +
          '<div class="var-drawer-subtitle" id="' + subtitleId + '"></div>' +
        '</div>' +
        '<button class="var-drawer-close" onclick="' + closeFn + '()">×</button>' +
      '</div>' +
      '<div class="var-drawer-body" id="' + bodyId + '"></div>' +
    '</div>';
    ov.addEventListener('click', function(e) {
      if (e.target === ov) global[closeFn]();
    });
    document.body.appendChild(ov);
    return ov;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口之察 · 在籍图
  // ═══════════════════════════════════════════════════════════════════

  function openHukouPanel() {
    _createDrawer('hukou', '户口之察 · 在籍图', 'hukou-subtitle', 'hukou-body', 'closeHukouPanel');
    // 通过 global 查找，让 ext/final 的 Rich 版本能生效（ext.js 在 DOMContentLoaded 后替换 global.renderHukouPanel）
    (global.renderHukouPanel || renderHukouPanel)();
    document.getElementById('hukou-drawer-ov').classList.add('open');
  }
  function closeHukouPanel() {
    var ov = document.getElementById('hukou-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderHukouPanel() {
    var body = document.getElementById('hukou-body');
    var subt = document.getElementById('hukou-subtitle');
    if (!body) return;
    var G = global.GM || {}; var P = G.population || {};
    if (!P.national) { body.innerHTML = '<div class="vd-empty">户口未初始化</div>'; return; }
    if (subt) subt.textContent = '户 ' + _fmt(P.national.households) + ' · 口 ' + _fmt(P.national.mouths) + ' · 丁 ' + _fmt(P.national.ding);
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">户数</span><span class="vd-ov-value">' + _fmt(P.national.households) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">人口</span><span class="vd-ov-value">' + _fmt(P.national.mouths) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">丁壮</span><span class="vd-ov-value">' + _fmt(P.national.ding) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">逃户</span><span class="vd-ov-value" style="color:var(--amber-400);">' + _fmt(P.fugitives||0) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">隐户</span><span class="vd-ov-value" style="color:var(--amber-400);">' + _fmt(P.hiddenCount||0) + '</span></div>';
    if (P.meta && P.meta.registrationAccuracy !== undefined) {
      html += '<div class="vd-ov-row"><span class="vd-ov-label">黄册准确度</span><span class="vd-ov-value">' + (P.meta.registrationAccuracy*100).toFixed(0) + '%</span></div>';
    }
    html += '</div></section>';

    // 基础数据会由 ext + final 文件追加（承载力/色目/徭役/兵制/阶层/迁徙/疫病等）
    // 跳转提示：所有户口相关操作走诏令/官制/朝议
    html += _sec('如何操作', null,
      _tabJump('写诏治户口（清查/招抚/改土/迁徙/兴工）', 'gt-edict') +
      _tabJump('看官制树（各省督抚/公库/主官）', 'gt-office') +
      _tabJump('看编年（户口消长历史）', 'gt-biannian')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心之察 · 天下民情
  // ═══════════════════════════════════════════════════════════════════

  function openMinxinPanel() {
    _createDrawer('minxin', '民心之察 · 天下民情', 'minxin-subtitle', 'minxin-body', 'closeMinxinPanel');
    (global.renderMinxinPanel || renderMinxinPanel)();
    document.getElementById('minxin-drawer-ov').classList.add('open');
  }
  function closeMinxinPanel() {
    var ov = document.getElementById('minxin-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderMinxinPanel() {
    var body = document.getElementById('minxin-body');
    var subt = document.getElementById('minxin-subtitle');
    if (!body) return;
    var G = global.GM || {}; var m = G.minxin || {};
    var trueIdx = m.trueIndex || 60;
    var perc = m.perceivedIndex !== undefined ? m.perceivedIndex : trueIdx;
    if (subt) subt.textContent = '真 ' + Math.round(trueIdx) + ' · 视 ' + Math.round(perc) + ' · ' + _esc(m.phase||'peaceful');
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var trueCol = trueIdx >= 60 ? '#6aa88a' : trueIdx >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实民心</span><span class="vd-ov-value" style="color:' + trueCol + ';">' + Math.round(trueIdx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（粉饰 ' + (perc-trueIdx>=0?'+':'') + Math.round(perc-trueIdx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value">' + _esc(m.phase||'peaceful') + '</span></div>';
    html += '</div></section>';

    // 进行中民变（只展示，不干预）— 干预靠写诏/朱批奏疏
    if (m.revolts) {
      var ongoing = m.revolts.filter(function(r){return r.status==='ongoing';});
      if (ongoing.length > 0) {
        var LEVELS = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.REVOLT_LEVELS) || [];
        var rh = '';
        ongoing.forEach(function(r) {
          var lv = LEVELS[(r.level||1) - 1] || { name:'L'+r.level };
          rh += '<div style="padding:6px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;margin:2px 0;font-size:0.74rem;">';
          rh += '<b style="color:var(--vermillion-300);">[' + _esc(lv.name) + ']</b> ' + _esc(r.region||'某地') + ' · ' + _fmt(r.scale||5000) + (r.cause?' · 因 '+_esc(r.cause):'');
          if (r.leader) rh += ' · 首 ' + _npcLink(r.leader);
          rh += '</div>';
        });
        html += _sec('进行中民变', ongoing.length + ' 起', rh);
      }
    }

    // 近年异象（只展示）
    if (G.heavenSigns && G.heavenSigns.length > 0) {
      var recent = G.heavenSigns.filter(function(s){return (G.turn||0) - s.turn < 12;});
      if (recent.length > 0) {
        var sh = '';
        recent.slice(-8).forEach(function(s) {
          var col = s.type==='good' ? '#6aa88a' : 'var(--vermillion-400)';
          sh += '<div style="font-size:0.72rem;color:' + col + ';padding:1px 0;">' + (s.type==='good'?'🌟':'⚠') + ' [T' + s.turn + '] ' + _esc(s.name) + '</div>';
        });
        html += _sec('近年天象·祥瑞', recent.length + '', sh);
      }
    }

    // 跳转提示
    html += _sec('如何应对', null,
      _tabJump('看奏疏（大臣所献民变/天象应对策）', 'gt-memorial') +
      _tabJump('写诏（蠲免/赈济/招安/大赦等）', 'gt-edict') +
      _tabJump('召见大臣问对', 'gt-wendui') +
      _tabJump('鸿雁传书（密信地方督抚）', 'gt-letter') +
      _tabJump('重大议事朝议', 'gt-chaoyi')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  乾纲之察 · 皇权图
  // ═══════════════════════════════════════════════════════════════════

  function openHuangquanPanel() {
    _createDrawer('huangquan', '乾纲之察 · 皇权图', 'huangquan-subtitle', 'huangquan-body', 'closeHuangquanPanel');
    (global.renderHuangquanPanel || renderHuangquanPanel)();
    document.getElementById('huangquan-drawer-ov').classList.add('open');
  }
  function closeHuangquanPanel() {
    var ov = document.getElementById('huangquan-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderHuangquanPanel() {
    var body = document.getElementById('huangquan-body');
    var subt = document.getElementById('huangquan-subtitle');
    if (!body) return;
    var G = global.GM || {}; var hq = G.huangquan || {};
    var idx = hq.index || 50;
    var phase = idx >= 70 ? '专制' : idx >= 35 ? '制衡' : '权臣';
    if (subt) subt.textContent = Math.round(idx) + ' / 100 · ' + phase;
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var col = phase === '专制' ? 'var(--vermillion-300)' : phase === '制衡' ? 'var(--gold)' : 'var(--amber-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">皇权指数</span><span class="vd-ov-value" style="color:' + col + ';">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value">' + phase + '</span></div>';
    if (hq.executionRate) html += '<div class="vd-ov-row"><span class="vd-ov-label">执行率</span><span class="vd-ov-value">' + (hq.executionRate*100).toFixed(0) + '%</span></div>';
    html += '</div></section>';

    // 权臣（只展示，不操作）
    if (hq.powerMinister) {
      var pm = hq.powerMinister;
      var ph = '<div style="padding:8px 10px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.78rem;">';
      ph += '⚠ <b>' + _npcLink(pm.name) + '</b> · 控制 ' + ((pm.controlLevel||0)*100).toFixed(0) + '% · 党羽 ' + (pm.faction||[]).length + ' · 拦截 ' + (pm.interceptions||0) + ' · 自拟 ' + (pm.counterEdicts||0);
      ph += '</div>';
      html += _sec('权臣', null, ph);
    }

    // 奏疏/抗疏/问疑 计数（跳转到对应标签页）
    var pendM = (G._pendingMemorials||[]).filter(function(m){return m.status==='drafted';}).length;
    var pendAb = (G._abductions||[]).filter(function(a){return (G.turn||0) - a.turn < 6 && !a.status;}).length;
    var pendClar = (G._pendingClarifications||[]).filter(function(c){return c.status==='awaiting_answer';}).length;
    if (pendM + pendAb + pendClar > 0) {
      var nh = '<div style="font-size:0.76rem;">';
      if (pendM > 0) nh += '<div>· 奏疏待朱批 <b style="color:var(--amber-400);">' + pendM + '</b> 本</div>';
      if (pendAb > 0) nh += '<div>· 抗疏 <b style="color:var(--vermillion-400);">' + pendAb + '</b> 则</div>';
      if (pendClar > 0) nh += '<div>· 侍臣问疑 <b style="color:var(--amber-400);">' + pendClar + '</b> 则</div>';
      nh += '</div>';
      html += _sec('待处理', null, nh);
    }

    // 跳转提示
    html += _sec('如何操作', null,
      _tabJump('朱批奏疏（含抗疏/问疑 诸事）', 'gt-memorial') +
      _tabJump('写诏（任免/削藩/新设/清洗 诸事）', 'gt-edict') +
      _tabJump('召见大臣问对', 'gt-wendui') +
      _tabJump('密信（鸿雁传书）', 'gt-letter') +
      _tabJump('看官制树', 'gt-office') +
      _tabJump('重大议事朝议', 'gt-chaoyi')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  天威之察 · 皇威图
  // ═══════════════════════════════════════════════════════════════════

  function openHuangweiPanel() {
    _createDrawer('huangwei', '天威之察 · 皇威图', 'huangwei-subtitle', 'huangwei-body', 'closeHuangweiPanel');
    (global.renderHuangweiPanel || renderHuangweiPanel)();
    document.getElementById('huangwei-drawer-ov').classList.add('open');
  }
  function closeHuangweiPanel() {
    var ov = document.getElementById('huangwei-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderHuangweiPanel() {
    var body = document.getElementById('huangwei-body');
    var subt = document.getElementById('huangwei-subtitle');
    if (!body) return;
    var G = global.GM || {}; var w = G.huangwei || {};
    var idx = w.index || 50;
    var perc = w.perceivedIndex !== undefined ? w.perceivedIndex : idx;
    if (subt) subt.textContent = '真 ' + Math.round(idx) + ' · 视 ' + Math.round(perc) + ' · ' + _esc(w.phase||'normal');
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var phase = w.phase || 'normal';
    var phaseName = { tyrant:'暴君',majesty:'威严',normal:'常望',decline:'衰微',lost:'失威' }[phase] || phase;
    var col = phase==='tyrant' ? 'var(--vermillion-500)' : phase==='majesty' ? '#6aa88a' : phase==='normal' ? 'var(--gold)' : 'var(--amber-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实威望</span><span class="vd-ov-value" style="color:' + col + ';">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（差 ' + Math.round(perc-idx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value">' + phaseName + '段</span></div>';
    html += '</div></section>';

    // 四维/暴君综合症/失威危机/14源降 由 ext + final 追加

    // 跳转提示
    html += _sec('如何操作', null,
      _tabJump('写诏（亲征/大典/罪己/和亲等提升威望）', 'gt-edict') +
      _tabJump('看奏疏（大臣献策）', 'gt-memorial') +
      _tabJump('召见大臣问对', 'gt-wendui') +
      _tabJump('朝议大事', 'gt-chaoyi')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  全局 ESC 关闭 + Orphan UI 重定向（全部改为 toast 提示用标签页）
  // ═══════════════════════════════════════════════════════════════════

  function _closeAll() {
    closeHukouPanel(); closeMinxinPanel(); closeHuangquanPanel(); closeHuangweiPanel();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') _closeAll();
    });
  }

  function _jumpToTab(tabId) {
    return function() {
      if (typeof global.switchGTab === 'function') global.switchGTab(null, tabId);
      else if (global.toast) global.toast('请切至对应中间栏标签页');
    };
  }

  function _redirectOrphan() {
    // 所有操作 UI 重定向到现有中间栏标签页
    global.openPlayerActionMenu = function() { if (global.toast) global.toast('请用顶栏各变量与中间栏诸标签页'); };
    // 权威四察 → 抽屉
    global.openTianweiInspection = openHuangweiPanel;
    global.openQianGangInspection = openHuangquanPanel;
    global.openMinxinInspection = openMinxinPanel;
    global.openLizhiInspection = function() { if (typeof global.openCorruptionPanel==='function') global.openCorruptionPanel(); };
    global.openHujiDashboard = openHukouPanel;
    global.openMinxinHeatmap = openMinxinPanel;
    // 政务操作 → 诏令
    global.openMilitaryFarmUI = _jumpToTab('gt-edict');
    global.openGaituUI = _jumpToTab('gt-edict');
    global.openMoveCapitalUI = _jumpToTab('gt-edict');
    global.openFrontierUI = _jumpToTab('gt-edict');
    global.openFuyiSchemeComparison = _jumpToTab('gt-edict');
    global.openAnnualFuyiPanel = _jumpToTab('gt-edict');
    global.openEdictReferenceBar = _jumpToTab('gt-edict');
    // 反击权臣 / 朱批 / 问疑 → 奏疏 / 问对
    global.openPowerCounterUI = _jumpToTab('gt-memorial');
    global.openMemorialsPanel = _jumpToTab('gt-memorial');
    global.openRevoltInterventionPanel = _jumpToTab('gt-memorial');
    // 制度志 → 官制 tab
    global.openInstitutionsChronicle = _jumpToTab('gt-office');
    // 天时地利 → 史记/编年
    global.openEnvironmentChronicle = _jumpToTab('gt-biannian');
    // 承载力热力 → 户口抽屉（内嵌数据可看）
    global.openCarryingCapacityHeatmap = openHukouPanel;
    // 年度决算 → 史记
    global.openYearlyReport = _jumpToTab('gt-shiji');
    // 诏令 ABCD、迁都三轮、问疑 → 诏令/奏疏（玩家写诏/批奏）
    if (typeof global.PhaseG3 !== 'undefined') {
      global.PhaseG3.openCorveeABCDPanel = _jumpToTab('gt-edict');
      global.PhaseG3.initiateMovCapitalThreeRound = _jumpToTab('gt-chaoyi');
    }
    if (typeof global.EdictComplete !== 'undefined') {
      global.EdictComplete.openClarificationPanel = _jumpToTab('gt-memorial');
      global.EdictComplete.openMemorialsPanel = _jumpToTab('gt-memorial');
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _redirectOrphan);
    } else {
      setTimeout(_redirectOrphan, 100);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.openHukouPanel = openHukouPanel;
  global.closeHukouPanel = closeHukouPanel;
  global.renderHukouPanel = renderHukouPanel;
  global.openMinxinPanel = openMinxinPanel;
  global.closeMinxinPanel = closeMinxinPanel;
  global.renderMinxinPanel = renderMinxinPanel;
  global.openHuangquanPanel = openHuangquanPanel;
  global.closeHuangquanPanel = closeHuangquanPanel;
  global.renderHuangquanPanel = renderHuangquanPanel;
  global.openHuangweiPanel = openHuangweiPanel;
  global.closeHuangweiPanel = closeHuangweiPanel;
  global.renderHuangweiPanel = renderHuangweiPanel;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ═══════════════════════════════════════════════════════════════════
// 合并自 tm-var-drawers-ext.js (原 Phase 2: Rich 替换)
// ═══════════════════════════════════════════════════════════════════

/**
 * tm-var-drawers-ext.js — 抽屉内容极大扩充
 *
 * 覆盖 tm-var-drawers.js 中户口/民心/皇权/皇威四抽屉的 renderXxxPanel，
 * 展示所有实施的方案内容（含14源14降/民变5级/异象三库/
 * 朝代预设/历史案例/徭役25预设/迁徙通道等）。
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  中文标签库（把 source/drain key 翻译为古语）
  // ═══════════════════════════════════════════════════════════════════

  var HW_SRC_LABELS = {
    militaryVictory:'军胜', territoryExpansion:'拓疆', grandCeremony:'大典',
    executeRebelMinister:'诛逆', suppressRevolt:'平乱', auspicious:'祥瑞',
    benevolence:'德政', selfBlame:'罪己', tribute:'朝贡', imperialFuneral:'国丧',
    rehabilitation:'昭雪', culturalAchievement:'文治', personalCampaign:'亲征',
    structuralReform:'新制'
  };
  var HW_DRN_LABELS = {
    militaryDefeat:'军败', diplomaticHumiliation:'辱国', idleGovern:'怠政',
    courtScandal:'宫闱', heavenlySign:'天象', forcedAbdication:'逼禅',
    brokenPromise:'食言', deposeFailure:'废立挫', imperialFlight:'出奔',
    capitalFall:'京畿陷', personalCampaignFail:'亲征败', familyScandal:'帝家丑',
    memorialObjection:'抗疏', lostVirtueRumor:'失德谣'
  };
  var HQ_SRC_LABELS = {
    purge:'清洗', secretPolice:'厂卫', personalRule:'亲政',
    structureReform:'改制', militaryCentral:'收军权', tour:'巡狩',
    heirDecision:'定储', executePM:'诛权臣'
  };
  var HQ_DRN_LABELS = {
    trustedMinister:'托孤臣', eunuchsRelatives:'宦外戚', youngOrIllness:'主幼病',
    factionConsuming:'党争', idleGovern:'怠政', militaryDefeat:'大败',
    cabinetization:'票拟制', memorialObjection:'抗疏'
  };
  var MX_SRC_LABELS = {
    taxation:'赋税', corvee:'徭役', disasterRelief:'赈济',
    judicialFairness:'司法', localOfficial:'官吏', priceStability:'物价',
    security:'治安', socialMobility:'仕路', culturalPolicy:'文治',
    heavenSign:'天象', auspicious:'祥瑞', prophecy:'谶纬',
    warResult:'兵事', imperialVirtue:'帝德', policyBalance:'中道',
    policyExtreme:'极端'
  };
  var MX_PHASE_NAMES = { revolt:'揭竿', angry:'窃盗', uneasy:'忍耐', peaceful:'安居', adoring:'颂圣' };
  var HW_PHASE_NAMES = { tyrant:'暴君', majesty:'威严', normal:'常望', decline:'衰微', lost:'失威' };
  var HQ_PHASE_NAMES = { strong:'专制', absolute:'专制', moderate:'制衡', balanced:'制衡', weak:'权臣', minister:'权臣' };

  function _fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e8) return (n/1e8).toFixed(2) + '亿';
    if (abs >= 1e4) return (n/1e4).toFixed(1) + '万';
    return Math.round(n).toLocaleString();
  }
  // R143·委托给 tm-utils.js:569 的 escHtml
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')); }
  function _sec(title, badge, content) {
    return '<section class="vd-section"><div class="vd-section-title">' + _esc(title) + (badge ? ' <span class="vd-badge">' + _esc(badge) + '</span>' : '') + '</div>' + content + '</section>';
  }
  function _meter(value, max, color) {
    var pct = Math.max(0, Math.min(100, (value / (max||100)) * 100));
    return '<div style="height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (color||'var(--gold-400)') + ';"></div></div>';
  }
  function _wrap(label, innerHtml, closeExpr) {
    return '<section class="vd-section" style="background:linear-gradient(180deg,rgba(184,154,83,0.08),transparent);border:1px solid var(--gold-d);border-radius:6px;padding:0.8rem 1rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;padding-bottom:0.3rem;border-bottom:1px dashed var(--color-border-subtle);">' +
        '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;letter-spacing:0.08em;">' + _esc(label) + '</div>' +
        '<button style="background:none;border:none;color:var(--txt-d);cursor:pointer;font-size:1rem;" onclick="' + closeExpr + '">×</button>' +
      '</div>' + innerHtml + '</section>';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇威抽屉 · 详尽版
  // ═══════════════════════════════════════════════════════════════════

  function renderHuangweiPanelRich() {
    var body = document.getElementById('huangwei-body');
    var subt = document.getElementById('huangwei-subtitle');
    if (!body) return;
    var G = global.GM || {}; var w = G.huangwei || {};
    var idx = w.index || 50;
    var perc = w.perceivedIndex !== undefined ? w.perceivedIndex : idx;
    var phase = w.phase || 'normal';
    var phaseName = HW_PHASE_NAMES[phase] || phase;
    if (subt) subt.textContent = '真 ' + Math.round(idx) + ' · 视 ' + Math.round(perc) + ' · ' + phaseName;

    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var col = phase==='tyrant'?'var(--vermillion-500)':phase==='majesty'?'#6aa88a':phase==='normal'?'var(--gold)':phase==='decline'?'var(--amber-400)':'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实威望</span><span class="vd-ov-value" style="color:' + col + ';font-size:1.05rem;font-weight:600;">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（粉饰 ' + (perc-idx>=0?'+':'') + Math.round(perc-idx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value" style="color:' + col + ';"><b>' + phaseName + '</b>段</span></div>';
    var execMult = phase==='tyrant'?1.3:phase==='majesty'?1.0:phase==='normal'?0.85:phase==='decline'?0.65:0.35;
    var execCol = execMult>=1?'#6aa88a':execMult>=0.7?'var(--gold)':'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">执行度乘数</span><span class="vd-ov-value" style="color:' + execCol + ';">×' + execMult.toFixed(2) + '（' + (execMult>=1.2?'令出必行':execMult>=0.9?'诏命畅达':execMult>=0.6?'诏行有阻':'诏不出京') + '）</span></div>';
    // 朝代预设提示
    if (G.dynasty && typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.DYNASTY_AUTHORITY_PRESETS && global.PhaseG1.DYNASTY_AUTHORITY_PRESETS[G.dynasty]) {
      html += '<div class="vd-ov-row"><span class="vd-ov-label">朝代</span><span class="vd-ov-value" style="font-size:0.72rem;color:var(--txt-d);">' + _esc(G.dynasty) + '（参朝代预设表）</span></div>';
    }
    html += '</div></section>';

    // § 五段色条
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">五段谱 <span class="vd-badge">暴/威/常/衰/失</span></div>';
    html += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;position:relative;">';
    html += '<div style="width:30%;background:var(--vermillion-400);"></div><div style="width:20%;background:var(--amber-400);"></div><div style="width:20%;background:var(--ink-500);"></div><div style="width:20%;background:#6aa88a;"></div><div style="width:10%;background:var(--vermillion-500);"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + Math.max(0,Math.min(99,idx)) + '%;width:3px;height:20px;background:var(--gold);box-shadow:0 0 4px var(--gold);"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--txt-d);margin-top:2px;"><span>失威</span><span>衰微</span><span>常望</span><span>威严</span><span>暴君</span></div>';
    html += '</section>';

    // § 四维
    if (w.subDims) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
      var labels = {court:'朝廷',provincial:'藩屏',military:'军中',foreign:'外邦'};
      ['court','provincial','military','foreign'].forEach(function(k) {
        var v = (w.subDims[k] && w.subDims[k].value) || 0;
        var tr = (w.subDims[k] && w.subDims[k].trend) || '';
        var trs = tr==='rising'?' ↑':tr==='falling'?' ↓':'';
        var cc = v>=70?'#6aa88a':v>=50?'var(--gold)':v>=30?'var(--amber-400)':'var(--vermillion-400)';
        sh += '<div style="padding:6px;background:var(--bg-2);text-align:center;border-radius:3px;">' +
          '<div style="font-size:0.66rem;color:var(--txt-d);">' + labels[k] + '</div>' +
          '<div style="font-size:0.92rem;color:' + cc + ';font-weight:600;">' + Math.round(v) + trs + '</div>' +
        '</div>';
      });
      sh += '</div>';
      html += _sec('四维分项 · 天威所及', null, sh);
    }

    // § 14 上升源（带中文 label）
    if (w.sources) {
      var sh2 = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HW_SRC_LABELS).forEach(function(k) {
        var v = w.sources[k] || 0;
        var sCol = v>5?'#6aa88a':v>1?'var(--gold)':'var(--txt-d)';
        sh2 += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HW_SRC_LABELS[k] + '</span><span style="color:' + sCol + ';">+' + v.toFixed(1) + '</span></div>';
      });
      sh2 += '</div>';
      html += _sec('十四源 · 威所由生', '累计', sh2);
    }
    // § 14 下降源
    if (w.drains) {
      var dh2 = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HW_DRN_LABELS).forEach(function(k) {
        var v = w.drains[k] || 0;
        var dCol = v>5?'var(--vermillion-400)':v>1?'var(--amber-400)':'var(--txt-d)';
        dh2 += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HW_DRN_LABELS[k] + '</span><span style="color:' + dCol + ';">-' + v.toFixed(1) + '</span></div>';
      });
      dh2 += '</div>';
      html += _sec('十四降 · 威所由损', '累计', dh2);
    }

    // § 暴君综合症
    if (w.tyrantSyndrome && w.tyrantSyndrome.active) {
      var ts = w.tyrantSyndrome;
      var th = '<div style="padding:10px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-500);border-radius:3px;font-size:0.76rem;">';
      th += '<div style="font-size:0.78rem;color:var(--vermillion-300);margin-bottom:4px;">📍 第 ' + (ts.activatedTurn||0) + ' 回合激活</div>';
      th += '<div>颂圣奏疏率 <b style="color:var(--vermillion-400);">' + ((ts.flatteryMemorialRatio||0)*100).toFixed(0) + '%</b></div>';
      th += '<div>过度执行记录 <b>' + (ts.overExecutionLog||[]).length + '</b> 条</div>';
      // 显示近 3 条过度执行
      if (ts.overExecutionLog && ts.overExecutionLog.length > 0) {
        ts.overExecutionLog.slice(-3).forEach(function(e) {
          th += '<div style="font-size:0.68rem;color:var(--txt-d);padding-left:10px;">· T' + e.turn + ' ' + _esc(e.id||e.plan||'某诏') + ' 放大×' + (e.overScale||1.3) + '</div>';
        });
      }
      var hd = ts.hiddenDamage || {};
      th += '<div style="margin-top:6px;color:var(--amber-400);">隐伤四累：</div>';
      th += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:0.7rem;">';
      th += '<div>民心暗降：<b>' + Math.round(hd.unreportedMinxinDrop||0) + '</b></div>';
      th += '<div>腐败掩盖：<b>' + Math.round(hd.concealedCorruption||0) + '</b></div>';
      th += '<div>错判积累：<b>' + Math.round(hd.accumulatedMisjudgement||0) + '</b></div>';
      th += '<div>帑廪虚账：<b>' + _fmt(hd.fiscalBubble||0) + '</b></div>';
      th += '</div>';
      th += '<div style="margin-top:6px;font-size:0.7rem;color:var(--txt-d);font-style:italic;">诸隐伤将于觉醒时一次兑现（皇威 -25）</div>';
      // 5 觉醒触发
      var TRIG = (typeof global.PhaseD !== 'undefined' && global.PhaseD.TYRANT_AWAKENING_TRIGGERS) || [];
      if (TRIG.length > 0) {
        th += '<div style="margin-top:6px;font-size:0.7rem;color:var(--gold);">五觉醒触发：</div>';
        TRIG.forEach(function(t) {
          th += '<div style="font-size:0.66rem;color:var(--txt-d);padding-left:10px;">· ' + _esc(t.name) + '</div>';
        });
      }
      th += '</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-500);">⚠ 暴君综合症激活</div>' + th + '</section>';
    }

    // § 失威危机
    if (w.lostAuthorityCrisis && w.lostAuthorityCrisis.active) {
      var la = w.lostAuthorityCrisis;
      var lh = '<div style="padding:10px;background:rgba(140,40,30,0.12);border-left:3px solid var(--vermillion-500);border-radius:3px;font-size:0.76rem;">';
      lh += '<div style="font-size:0.78rem;color:var(--vermillion-300);margin-bottom:4px;">📍 第 ' + (la.activatedTurn||0) + ' 回合激活</div>';
      lh += '<div>抗疏倍频 <b style="color:var(--vermillion-400);">×' + (la.objectionFrequency||1).toFixed(1) + '</b>（失威段日甚）</div>';
      lh += '<div>地方观望 <b>' + (la.provincialWatching?'已是':'未现') + '</b>（执行速度 ×0.5）</div>';
      lh += '<div>外邦蠢动 <b>' + ((la.foreignEmboldened||0)*100).toFixed(0) + '%</b></div>';
      if (la._tributeStopped) lh += '<div style="color:var(--vermillion-400);">⚠ 朝贡已止</div>';
      lh += '</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-500);">⚠ 失威危机激活</div>' + lh + '</section>';
    }

    // § 史
    if (w.history) {
      var hi = w.history;
      var hasAny = (hi.tyrantPeriods && hi.tyrantPeriods.length) || (hi.crisisPeriods && hi.crisisPeriods.length) || (hi.pastHumiliations && hi.pastHumiliations.length);
      if (hasAny) {
        var hh = '<div style="font-size:0.74rem;">';
        if (hi.tyrantPeriods && hi.tyrantPeriods.length) hh += '<div style="color:var(--amber-400);padding:2px 0;">· 暴君期 <b>' + hi.tyrantPeriods.length + '</b> 度</div>';
        if (hi.crisisPeriods && hi.crisisPeriods.length) hh += '<div style="color:var(--amber-400);padding:2px 0;">· 失威期 <b>' + hi.crisisPeriods.length + '</b> 度</div>';
        if (hi.pastHumiliations && hi.pastHumiliations.length) {
          hh += '<div style="color:var(--vermillion-400);padding:2px 0;">· 耻辱史 <b>' + hi.pastHumiliations.length + '</b> 件</div>';
          hi.pastHumiliations.slice(-5).forEach(function(p) {
            hh += '<div style="font-size:0.68rem;color:var(--txt-d);padding-left:12px;">· ' + _esc(p.name||p.id||'耻辱') + '</div>';
          });
        }
        hh += '</div>';
        html += _sec('史 · 往日积压', null, hh);
      }
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇权抽屉 · 详尽版
  // ═══════════════════════════════════════════════════════════════════

  function renderHuangquanPanelRich() {
    var body = document.getElementById('huangquan-body');
    var subt = document.getElementById('huangquan-subtitle');
    if (!body) return;
    var G = global.GM || {}; var hq = G.huangquan || {};
    var idx = hq.index || 50;
    var phase = idx >= 70 ? 'absolute' : idx >= 35 ? 'balanced' : 'minister';
    var phaseName = HQ_PHASE_NAMES[phase];
    if (subt) subt.textContent = Math.round(idx) + ' / 100 · ' + phaseName;

    var html = '';
    // 先渲染 action slot（inline 操作面板）
    if (typeof global.__renderDrawerActionSlot === 'function') html += global.__renderDrawerActionSlot('huangquan');

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var col = phase==='absolute'?'var(--vermillion-300)':phase==='balanced'?'var(--gold)':'var(--amber-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">皇权指数</span><span class="vd-ov-value" style="color:' + col + ';font-size:1.05rem;font-weight:600;">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value" style="color:' + col + ';"><b>' + phaseName + '</b>段</span></div>';
    if (hq.executionRate) html += '<div class="vd-ov-row"><span class="vd-ov-label">诏令执行率</span><span class="vd-ov-value">' + (hq.executionRate*100).toFixed(0) + '%</span></div>';
    // 四象限
    if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.getAuthorityQuadrant) {
      var q = global.AuthorityComplete.getAuthorityQuadrant();
      html += '<div class="vd-ov-row"><span class="vd-ov-label">四象限</span><span class="vd-ov-value" style="color:#6aa88a;">' + _esc(q.name) + '</span></div>';
      if (q.description) html += '<div style="font-size:0.7rem;color:var(--txt-d);text-align:right;font-style:italic;">' + _esc(q.description) + '</div>';
    }
    // 进谏自由度
    if (hq.ministerFreedomToSpeak !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">进谏自由</span><span class="vd-ov-value">' + (hq.ministerFreedomToSpeak*100).toFixed(0) + '%</span></div>';
    if (hq.memorialQuality !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">奏疏质量</span><span class="vd-ov-value">' + (hq.memorialQuality*100).toFixed(0) + '%</span></div>';
    if (hq.reformDifficulty !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">改革难度</span><span class="vd-ov-value">×' + hq.reformDifficulty.toFixed(2) + '</span></div>';
    html += '</div></section>';

    // § 三段谱
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">三段谱 <span class="vd-badge">权臣/制衡/专制</span></div>';
    html += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;position:relative;">';
    html += '<div style="width:35%;background:var(--amber-400);"></div><div style="width:35%;background:#6aa88a;"></div><div style="width:30%;background:var(--vermillion-300);"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + Math.max(0,Math.min(99,idx)) + '%;width:3px;height:20px;background:var(--gold);box-shadow:0 0 4px var(--gold);"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--txt-d);margin-top:2px;"><span>权臣</span><span>制衡</span><span>专制</span></div>';
    html += '</section>';

    // § 四维
    if (hq.subDims) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
      var labels = {central:'中央',provincial:'地方',military:'军队',imperial:'内廷'};
      ['central','provincial','military','imperial'].forEach(function(k) {
        var v = (hq.subDims[k] && hq.subDims[k].value) || 0;
        var cc = v>=70?'#6aa88a':v>=50?'var(--gold)':v>=30?'var(--amber-400)':'var(--vermillion-400)';
        sh += '<div style="padding:6px;background:var(--bg-2);text-align:center;border-radius:3px;">' +
          '<div style="font-size:0.66rem;color:var(--txt-d);">' + labels[k] + '</div>' +
          '<div style="font-size:0.92rem;color:' + cc + ';font-weight:600;">' + Math.round(v) + '</div>' +
        '</div>';
      });
      sh += '</div>';
      html += _sec('四维 · 纲权所及', null, sh);
    }

    // § 8 上升源
    if (hq.sources) {
      var ssh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HQ_SRC_LABELS).forEach(function(k) {
        var v = hq.sources[k] || 0;
        var sCol = v>5?'#6aa88a':v>1?'var(--gold)':'var(--txt-d)';
        ssh += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HQ_SRC_LABELS[k] + '</span><span style="color:' + sCol + ';">+' + v.toFixed(1) + '</span></div>';
      });
      ssh += '</div>';
      html += _sec('八源 · 权所由立', '累计', ssh);
    }
    // § 8 下降源
    if (hq.drains) {
      var ddh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HQ_DRN_LABELS).forEach(function(k) {
        var v = hq.drains[k] || 0;
        var dCol = v>5?'var(--vermillion-400)':v>1?'var(--amber-400)':'var(--txt-d)';
        ddh += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HQ_DRN_LABELS[k] + '</span><span style="color:' + dCol + ';">-' + v.toFixed(1) + '</span></div>';
      });
      ddh += '</div>';
      html += _sec('八降 · 权所由夺', '累计', ddh);
    }

    // § 权臣（完整）+ 反击七策
    if (hq.powerMinister) {
      var pm = hq.powerMinister;
      var ph = '<div style="padding:10px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.78rem;margin-bottom:6px;">';
      ph += '<div><b style="font-size:0.86rem;color:var(--vermillion-300);">' + _esc(pm.name) + '</b></div>';
      ph += '<div style="margin-top:3px;">控制度 <b>' + ((pm.controlLevel||0)*100).toFixed(0) + '%</b> · 党羽 ' + (pm.faction||[]).length + ' · 拦截 ' + (pm.interceptions||0) + ' · 自拟 ' + (pm.counterEdicts||0) + '</div>';
      if (pm.faction && pm.faction.length > 0) {
        ph += '<div style="margin-top:4px;font-size:0.72rem;color:var(--amber-400);">党羽：' + pm.faction.slice(0,8).map(function(n){return _esc(n);}).join('、') + '</div>';
      }
      ph += '</div>';
      ph += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:4px;font-style:italic;">反击诸策（密诏/分党/借兵/清议/等死 等）可通过【诏令】【奏疏朱批】【鸿雁传书】诸渠道进行。</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-400);">⚠ 权臣坐大</div>' + ph + '</section>';
    }

    // § 奏疏待朱批（纯展示，朱批在 gt-memorial 标签页）
    var pendM = (G._pendingMemorials||[]).filter(function(m){return m.status==='drafted';});
    if (pendM.length > 0) {
      var mh = '';
      pendM.slice(0, 6).forEach(function(mm) {
        mh += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;margin-bottom:3px;font-size:0.72rem;">';
        mh += '<div style="color:var(--gold);">' + _esc(mm.subject||mm.typeName) + ' · ' + _esc(mm.drafter||'某官') + '</div>';
        mh += '<div style="color:var(--txt-d);line-height:1.5;">' + _esc((mm.draftText||'').slice(0,80)) + '…</div>';
        mh += '</div>';
      });
      mh += '<div style="font-size:0.68rem;color:var(--txt-d);font-style:italic;">→ 朱批请切至【奏疏】标签页</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--amber-400);">奏疏待朱批 <span class="vd-badge">' + pendM.length + ' 本</span></div>' + mh + '</section>';
    }

    // § 抗疏（纯展示）
    if (G._abductions && G._abductions.length > 0) {
      var recentAb = G._abductions.filter(function(a){return (G.turn||0) - a.turn < 6 && !a.status;});
      if (recentAb.length > 0) {
        var ah = '';
        recentAb.forEach(function(a) {
          ah += '<div style="padding:5px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);margin-bottom:3px;font-size:0.72rem;">';
          ah += '<b>' + _esc(a.objector||'某官') + '</b>：' + _esc((a.content||'').slice(0,80)) + '…';
          ah += '</div>';
        });
        ah += '<div style="font-size:0.68rem;color:var(--txt-d);font-style:italic;">→ 处置请切至【奏疏】标签页</div>';
        html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-400);">抗疏 <span class="vd-badge">' + recentAb.length + '</span></div>' + ah + '</section>';
      }
    }
    // 抗疏 12 典范
    var ABDUCTION_CASES = (typeof global.PhaseG3 !== 'undefined' && global.PhaseG3.ABDUCTION_12_CASES) || [];
    if (ABDUCTION_CASES.length > 0) {
      var ach = '<div style="max-height:100px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;">';
      ABDUCTION_CASES.forEach(function(c) {
        ach += '<div style="padding:1px 2px;">· <b>' + _esc(c.name) + '</b>（' + _esc(c.dynasty) + ' ' + c.year + '）→ ' + _esc(c.outcome||'') + '</div>';
      });
      ach += '</div>';
      html += _sec('十二抗疏典范', '历代', ach);
    }

    // § 侍臣问疑
    if (G._pendingClarifications) {
      var ac = G._pendingClarifications.filter(function(c){return c.status==='awaiting_answer';});
      if (ac.length > 0) {
        var ch = '';
        ac.forEach(function(c) {
          ch += '<div style="padding:6px 8px;background:var(--bg-2);margin-bottom:4px;font-size:0.74rem;border-left:3px solid var(--amber-400);">';
          ch += '<div>诏："' + _esc((c.originalText||'').slice(0,60)) + '…"</div>';
          ch += '<div style="color:var(--txt-d);margin:2px 0;">' + _esc((c.questions && c.questions[0]) || '') + '</div>';
          ch += '<div style="font-size:0.68rem;color:var(--txt-d);font-style:italic;margin-top:2px;">→ 答疑请切至【奏疏】或【问对】标签页</div>';
          ch += '</div>';
        });
        html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--amber-400);">侍臣问疑 <span class="vd-badge">' + ac.length + '</span></div>' + ch + '</section>';
      }
    }

    // § 动态机构·制度志
    if (G.dynamicInstitutions && G.dynamicInstitutions.length > 0) {
      var dh = '';
      G.dynamicInstitutions.forEach(function(inst) {
        var stCol = inst.stage === 'abolished' ? 'var(--vermillion-400)' : inst.stage === 'running' ? '#6aa88a' : 'var(--gold)';
        dh += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid ' + stCol + ';margin-bottom:3px;font-size:0.74rem;">';
        dh += '<b style="color:' + stCol + ';">' + _esc(inst.name) + '</b> · 品 ' + inst.rank + ' · ' + _esc(inst.stage) + ' · 员额 ' + (inst.staffSize||0) + ' · 岁支 ' + _fmt(inst.annualBudget||0);
        if (inst.effectiveness !== undefined) dh += '<br><span style="font-size:0.66rem;color:var(--txt-d);">效率 ' + ((inst.effectiveness||0)*100).toFixed(0) + '% · 腐败 ' + Math.round(inst.corruption||0) + '</span>';
        if (inst.stage !== 'abolished') {
          // 废除走诏令
        }
        dh += '</div>';
      });
      html += _sec('动态机构 · 制度志', G.dynamicInstitutions.length + '', dh);
    }

    // § 永制
    if (G._permanentReforms && G._permanentReforms.length > 0) {
      var prh = '';
      G._permanentReforms.forEach(function(r) {
        prh += '<div style="font-size:0.74rem;padding:2px 0;">· <b>' + _esc(r.id) + '</b> 立于 ' + _esc(r.enactedDynasty||'某朝') + ' 第 ' + r.enactedTurn + ' 回合</div>';
        if (r.effects && r.effects.memorialBurdenMult) prh += '<div style="font-size:0.68rem;color:var(--txt-d);padding-left:14px;">奏疏负担 ×' + r.effects.memorialBurdenMult + '</div>';
      });
      html += _sec('永制 · 跨朝遗产', null, prh);
    }

    // § 历代权臣案例（供参考）
    var HC = (typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.HISTORICAL_CASES) || {};
    if (HC.powerMinister && HC.powerMinister.length > 0) {
      var hch = '<div style="max-height:110px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;">';
      HC.powerMinister.slice(0, 10).forEach(function(c) {
        hch += '<div style="padding:1px 2px;">· <b>' + _esc(c.name) + '</b>（' + _esc(c.dynasty) + ' ' + c.year + '）控 ' + ((c.control||0)*100).toFixed(0) + '% → ' + _esc(c.ending||'') + '</div>';
      });
      hch += '</div>';
      html += _sec('历代权臣 · 鉴往知来', HC.powerMinister.length + '', hch);
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心抽屉 · 详尽版
  // ═══════════════════════════════════════════════════════════════════

  function renderMinxinPanelRich() {
    var body = document.getElementById('minxin-body');
    var subt = document.getElementById('minxin-subtitle');
    if (!body) return;
    var G = global.GM || {}; var m = G.minxin || {};
    var trueIdx = m.trueIndex || 60;
    var perc = m.perceivedIndex !== undefined ? m.perceivedIndex : trueIdx;
    var phase = m.phase || 'peaceful';
    if (subt) subt.textContent = '真 ' + Math.round(trueIdx) + ' · 视 ' + Math.round(perc) + ' · ' + (MX_PHASE_NAMES[phase]||phase);
    var html = '';
    // 先渲染 action slot（inline 操作面板）
    if (typeof global.__renderDrawerActionSlot === 'function') html += global.__renderDrawerActionSlot('minxin');

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var trueCol = trueIdx >= 60 ? '#6aa88a' : trueIdx >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实民心</span><span class="vd-ov-value" style="color:' + trueCol + ';font-size:1.05rem;font-weight:600;">' + Math.round(trueIdx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（粉饰 ' + (perc-trueIdx>=0?'+':'') + Math.round(perc-trueIdx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value" style="color:' + trueCol + ';"><b>' + (MX_PHASE_NAMES[phase]||phase) + '</b></span></div>';
    // 后果传导
    if (G._taxEfficiencyMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">征税效率</span><span class="vd-ov-value">' + (G._taxEfficiencyMult*100).toFixed(0) + '%</span></div>';
    if (G._conscriptEffMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">征兵效率</span><span class="vd-ov-value">' + (G._conscriptEffMult*100).toFixed(0) + '%</span></div>';
    if (G._reformToleranceMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">改革容忍度</span><span class="vd-ov-value">×' + G._reformToleranceMult.toFixed(2) + '</span></div>';
    if (G._scholarRecruitmentMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">士人投效</span><span class="vd-ov-value">×' + G._scholarRecruitmentMult.toFixed(2) + '</span></div>';
    html += '</div></section>';

    // § 五级谱
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">五级谱 <span class="vd-badge">揭/窃/忍/安/颂</span></div>';
    html += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;position:relative;">';
    html += '<div style="width:20%;background:var(--vermillion-500);"></div><div style="width:20%;background:var(--vermillion-400);"></div><div style="width:20%;background:var(--amber-400);"></div><div style="width:20%;background:#6aa88a;"></div><div style="width:20%;background:var(--gold);"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + Math.max(0,Math.min(99,trueIdx)) + '%;width:3px;height:20px;background:#fff;box-shadow:0 0 4px #fff;"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--txt-d);margin-top:2px;"><span>揭竿</span><span>窃盗</span><span>忍耐</span><span>安居</span><span>颂圣</span></div>';
    html += '</section>';

    // § 14 源累积
    if (m.sources) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(MX_SRC_LABELS).forEach(function(k) {
        if (m.sources[k] === undefined) return;
        var v = m.sources[k] || 0;
        var col = v>2?'#6aa88a':v>0?'var(--gold)':v<-2?'var(--vermillion-400)':v<0?'var(--amber-400)':'var(--txt-d)';
        sh += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + MX_SRC_LABELS[k] + '</span><span style="color:' + col + ';">' + (v>=0?'+':'') + v.toFixed(1) + '</span></div>';
      });
      sh += '</div>';
      html += _sec('十四源 · 民心所由', '累计', sh);
    }

    // § 分阶层
    if (m.byClass && Object.keys(m.byClass).length > 0) {
      var CLASS_NAMES = {imperial:'皇族',gentry_high:'门阀',gentry_mid:'中小士族',scholar:'寒士',merchant:'商贾',landlord:'地主',peasant_self:'自耕农',peasant_tenant:'佃农',craftsman:'工匠',debased:'贱民',clergy:'僧道',slave:'奴婢'};
      var ch = '';
      Object.keys(m.byClass).forEach(function(cl) {
        var cv = m.byClass[cl]; var col = cv.index >= 60 ? '#6aa88a' : cv.index >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
        ch += '<div style="display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.74rem;">' +
          '<span style="color:var(--txt-d);">' + _esc(CLASS_NAMES[cl]||cl) + '</span>' +
          _meter(cv.index, 100, col) +
          '<span style="color:' + col + ';">' + Math.round(cv.index) + (cv.trend==='rising'?' ↑':cv.trend==='falling'?' ↓':'') + '</span>' +
        '</div>';
      });
      html += _sec('分阶层 · 阶层民心', Object.keys(m.byClass).length + ' 层', ch);
    }

    // § 分区热力
    if (m.byRegion && Object.keys(m.byRegion).length > 0) {
      var rh = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(85px,1fr));gap:3px;">';
      Object.keys(m.byRegion).slice(0, 40).forEach(function(rid) {
        var r = m.byRegion[rid]; var v = r.index || 60;
        var col = v >= 80 ? '#6aa88a' : v >= 60 ? '#8fbb9e' : v >= 40 ? 'var(--gold)' : v >= 20 ? 'var(--amber-400)' : 'var(--vermillion-400)';
        rh += '<div style="padding:4px 5px;background:' + col + ';border-radius:2px;color:#fff;font-size:0.68rem;">' + _esc(rid).slice(0,6) + ' ' + Math.round(v) + '</div>';
      });
      rh += '</div>';
      html += _sec('天下民情图', Object.keys(m.byRegion).length + ' 区', rh);
    }

    // § 民变 5 级升级链 + 4 干预
    var LEVELS = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.REVOLT_LEVELS) || [];
    if (LEVELS.length > 0) {
      var lh = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:6px;">';
      LEVELS.forEach(function(lv) {
        var count = (m.revolts||[]).filter(function(r){return r.status==='ongoing' && r.level===lv.id;}).length;
        var act = count > 0 ? 'background:var(--vermillion-400);color:#fff;' : 'background:var(--bg-2);color:var(--txt-d);';
        lh += '<div style="padding:4px;text-align:center;border-radius:2px;font-size:0.66rem;' + act + '">' +
          '<div>' + _esc(lv.name) + '</div>' +
          '<div style="font-size:0.72rem;font-weight:600;">' + count + '</div>' +
        '</div>';
      });
      lh += '</div>';
      // 进行中民变详表 + 4 干预
      var ongoing = (m.revolts||[]).filter(function(r){return r.status==='ongoing';});
      if (ongoing.length > 0) {
        ongoing.forEach(function(r) {
          var lvDef = LEVELS[(r.level||1) - 1] || { name:'L'+r.level };
          lh += '<div style="padding:6px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;margin-bottom:4px;font-size:0.74rem;">';
          lh += '<div><b style="color:var(--vermillion-300);">[' + _esc(lvDef.name) + ']</b> ' + _esc(r.region||'某地') + ' · 众 ' + _fmt(r.scale||5000) + (r.cause?' · 因 '+_esc(r.cause):'') + '</div>';
          if (!r._suppressionOrder) {
            // 干预策由大臣奏疏献策，玩家朱批
          } else {
            lh += '<div style="color:var(--amber-400);margin-top:2px;">官军 ' + _fmt(r._suppressionOrder.strength) + ' 讨伐中</div>';
          }
          lh += '</div>';
        });
      }
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-400);">民变 · 五级升级链 <span class="vd-badge">流言→聚啸→暴动→起义→改朝</span></div>' + lh + '</section>';
    }

    // § 异象三库（天象/祥瑞/谶纬）
    if (G.heavenSigns && G.heavenSigns.length > 0) {
      var recent = G.heavenSigns.filter(function(s){return (G.turn||0) - s.turn < 12;});
      if (recent.length > 0) {
        var sh2 = '';
        recent.slice(-10).forEach(function(s) {
          var col = s.type==='good' ? '#6aa88a' : 'var(--vermillion-400)';
          sh2 += '<div style="font-size:0.72rem;color:' + col + ';padding:1px 0;">' + (s.type==='good'?'🌟':'⚠') + ' [T' + s.turn + '] ' + _esc(s.name) + '</div>';
        });
        html += _sec('近年天象·祥瑞', recent.length + '', sh2);
      }
    }
    // 谶纬库
    if (m.prophecy) {
      var pending = m.prophecy.pendingTriggers || [];
      if (pending.length > 0 || (m.prophecy.intensity||0) > 0.05) {
        var ph = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:3px;">流传强度 <b style="color:var(--amber-400);">' + ((m.prophecy.intensity||0)*100).toFixed(0) + '%</b></div>';
        pending.slice(-6).forEach(function(p) {
          ph += '<div style="font-size:0.72rem;color:var(--amber-400);padding:1px 0;">· "' + _esc(p.text) + '"（信度 ' + ((p.credibility||0.5)*100).toFixed(0) + '%）</div>';
        });
        html += _sec('谶纬·童谣', pending.length + '', ph);
      }
    }

    // § 粉饰文本示例
    var FLAT = (typeof global.PhaseD !== 'undefined' && global.PhaseD.FLATTERY_PHRASES) || [];
    if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active && FLAT.length > 0) {
      var fh = '<div style="font-size:0.7rem;color:var(--txt-d);max-height:70px;overflow-y:auto;background:var(--bg-2);padding:4px;font-style:italic;">';
      FLAT.slice(0,5).forEach(function(p) { fh += '<div>· 「' + _esc(p) + '」</div>'; });
      fh += '</div>';
      html += _sec('粉饰辞藻 · 暴君段常见', null, fh);
    }

    // § 风闻录事
    if (G._fengwenRecord && G._fengwenRecord.length > 0) {
      var fh2 = '<div style="max-height:130px;overflow-y:auto;background:var(--bg-2);padding:6px;font-size:0.7rem;border-radius:3px;">';
      G._fengwenRecord.slice(-15).reverse().forEach(function(f) {
        fh2 += '<div style="padding:1px 0;">[' + _esc(f.type) + '·T' + f.turn + '] ' + _esc(f.text) + '</div>';
      });
      fh2 += '</div>';
      html += _sec('风闻录事', '近 15', fh2);
    }

    // § 历代民变案例
    var HC = (typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.HISTORICAL_CASES) || {};
    if (HC.rebellion && HC.rebellion.length > 0) {
      var rch = '<div style="max-height:110px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;">';
      HC.rebellion.slice(0, 15).forEach(function(c) {
        var col = c.level >= 5 ? 'var(--vermillion-500)' : c.level >= 4 ? 'var(--vermillion-400)' : 'var(--amber-400)';
        rch += '<div style="padding:1px 2px;">· <b style="color:' + col + ';">[L' + c.level + ']</b> <b>' + _esc(c.name) + '</b>（' + _esc(c.dynasty) + ' ' + c.year + '）因 ' + _esc(c.cause||'') + ' → ' + _esc(c.result||'') + '</div>';
      });
      rch += '</div>';
      html += _sec('历代民变 · 鉴古', HC.rebellion.length + '', rch);
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口抽屉 · 详尽版（补三元、户等、朝代、迁徙、阶层）
  // ═══════════════════════════════════════════════════════════════════

  function renderHukouPanelRich() {
    // 只扩展原 renderHukouPanel 中缺的部分
    if (typeof global.__origRenderHukouPanel === 'function') {
      global.__origRenderHukouPanel();
    }
    // 在原基础上追加新 section（插入到圣裁之前）
    var body = document.getElementById('hukou-body');
    if (!body) return;
    var G = global.GM || {}; var P = G.population || {};
    if (!P.national) return;

    var extraHtml = '';

    // § 迁徙通道（若 PhaseB 有）
    var PATHS = (typeof global.PhaseB !== 'undefined' && global.PhaseB.MIGRATION_PATHWAYS) || {};
    if (Object.keys(PATHS).length > 0) {
      var ph = '';
      Object.keys(PATHS).forEach(function(k) {
        var p = PATHS[k];
        ph += '<div style="font-size:0.72rem;padding:2px 0;">· <b>' + _esc(p.name) + '</b>（' + p.from.join('/') + ' → ' + p.to.join('/') + '，耗×' + p.costFactor + '）</div>';
      });
      extraHtml += _sec('迁徙通道', Object.keys(PATHS).length + ' 道', ph);
    }

    // § 侨置事件
    var QZ = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.QIAOZHI_EVENTS) || [];
    if (QZ.length > 0) {
      var qzh = '';
      QZ.forEach(function(q) {
        var done = G._qiaozhiDone && G._qiaozhiDone[q.id];
        qzh += '<div style="font-size:0.72rem;padding:2px 0;color:' + (done?'var(--txt-d)':'var(--gold)') + ';">' + (done?'✓':'○') + ' ' + _esc(q.name) + '（' + q.triggerYear + '，' + _fmt(q.scale) + ' 口）</div>';
      });
      extraHtml += _sec('侨置三大徙', null, qzh);
    }

    // § 疫病谱
    var DISEASES = (typeof global.PhaseB !== 'undefined' && global.PhaseB.DISEASE_PROFILES) || {};
    if (Object.keys(DISEASES).length > 0 && P.dynamics && P.dynamics.plagueEvents && P.dynamics.plagueEvents.length > 0) {
      var dph = '<div style="max-height:90px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.7rem;">';
      P.dynamics.plagueEvents.slice(-8).forEach(function(e) {
        var profile = DISEASES[e.disease] || {};
        var col = e.status === 'active' ? 'var(--vermillion-400)' : 'var(--txt-d)';
        dph += '<div style="color:' + col + ';padding:1px 0;">· ' + _esc(profile.name||e.disease) + ' · ' + _esc(e.region||'某地') + ' · 染 ' + _fmt(e.affected||0) + ' · 殁 ' + _fmt(e.deaths||0) + (e.status==='active'?' · 行中':'') + '</div>';
      });
      dph += '</div>';
      extraHtml += _sec('疫病谱', '五种', dph);
    }

    // § 税基流失四手法
    if (P.taxEvasion && P.taxEvasion.methods) {
      var eh = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:3px;">总逃避率 <b style="color:var(--vermillion-400);">' + ((P.taxEvasion.totalRate||0)*100).toFixed(1) + '%</b></div>';
      P.taxEvasion.methods.forEach(function(m) {
        eh += '<div style="font-size:0.7rem;padding:1px 0;">· ' + _esc(m.name) + '：' + ((m.rate||0)*100).toFixed(2) + '%</div>';
      });
      extraHtml += _sec('税基流失四手法', null, eh);
    }

    // § 婚育习俗
    if (P.marriageCulture) {
      var mc = P.marriageCulture;
      var mch = '<div style="font-size:0.72rem;">';
      mch += '<div>· 溺女率 <b>' + ((mc.femaleInfanticideRate||0)*100).toFixed(2) + '%</b></div>';
      mch += '<div>· 寡妇再嫁率 <b>' + ((mc.widowRemarriageRate||0)*100).toFixed(0) + '%</b></div>';
      mch += '<div>· 汉胡通婚 <b>' + ((mc.hanOtherIntermarriage||0)*100).toFixed(1) + '%</b></div>';
      mch += '</div>';
      extraHtml += _sec('婚育习俗', null, mch);
    }

    // § 少数民族动态
    if (P.ethnicDynamics) {
      var ed = P.ethnicDynamics;
      var eth = '<div style="font-size:0.72rem;">';
      eth += '<div>· 汉化速率 ' + ((ed.sinicizationRate||0)*100).toFixed(2) + '%/年</div>';
      eth += '<div>· 叛乱风险 <b style="color:' + ((ed.rebellionRisk||0)>0.08?'var(--vermillion-400)':'var(--txt)') + ';">' + ((ed.rebellionRisk||0)*100).toFixed(1) + '%</b></div>';
      eth += '<div>· 羁縻忠诚 ' + ((ed.jimiLoyalty||0.7)*100).toFixed(0) + '%</div>';
      eth += '</div>';
      extraHtml += _sec('少数民族动态', null, eth);
    }

    // § 路引制度
    if (P.travelDocs) {
      var td = P.travelDocs;
      extraHtml += _sec('路引制度', null, '<div style="font-size:0.72rem;">· 需要：' + (td.required?'是':'否') + ' · 严格度 <b>' + ((td.strictness||0)*100).toFixed(0) + '%</b> · 违者 ' + _fmt(td.violations||0) + '</div>');
    }

    // § 阶层流动路径
    var MOB = [];
    try { if (typeof global.HujiDeepFill !== 'undefined' && global.HujiDeepFill.CLASS_MOBILITY_PATHS) MOB = global.HujiDeepFill.CLASS_MOBILITY_PATHS; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-ext');}catch(_){}}
    if (MOB.length > 0) {
      var mh2 = '';
      MOB.slice(0, 7).forEach(function(p) {
        mh2 += '<div style="font-size:0.7rem;padding:1px 0;">· ' + _esc(p.name||p.id) + (p.rate?'（' + (p.rate*100).toFixed(2) + '%/年）':'') + '</div>';
      });
      extraHtml += _sec('阶层流动七路径', null, mh2);
    }

    // § 户口衰落信号
    if (G._initialPopulation && G._initialPopulation.mouths) {
      var ratio = (P.national.mouths||0) / G._initialPopulation.mouths;
      var col = ratio < 0.5 ? 'var(--vermillion-500)' : ratio < 0.7 ? 'var(--amber-400)' : '#6aa88a';
      extraHtml += _sec('户口消长', null, '<div style="font-size:0.74rem;">· 较开局 <b style="color:' + col + ';">' + (ratio*100).toFixed(0) + '%</b>' + (ratio<0.5?' ⚠ 衰亡之兆':'') + '</div>');
    }

    // 把 extraHtml 追加进 body 的"圣裁"之前
    var curr = body.innerHTML;
    var idx = curr.lastIndexOf('<section class="vd-section"><div class="vd-section-title">圣裁');
    if (idx > 0 && extraHtml) {
      body.innerHTML = curr.slice(0, idx) + extraHtml + curr.slice(idx);
    } else if (extraHtml) {
      body.innerHTML = curr + extraHtml;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  挂载覆盖
  // ═══════════════════════════════════════════════════════════════════

  function _install() {
    if (typeof global.renderHukouPanel === 'function') {
      global.__origRenderHukouPanel = global.renderHukouPanel;
      global.renderHukouPanel = renderHukouPanelRich;
    }
    global.renderMinxinPanel = renderMinxinPanelRich;
    global.renderHuangquanPanel = renderHuangquanPanelRich;
    global.renderHuangweiPanel = renderHuangweiPanelRich;
  }

  // 立即安装（旧版 setTimeout 200ms 已移除 — 2026-04-24 · 加载顺序保证 v1 已定义基础 render）
  _install();

  global.VarDrawersExt = {
    install: _install,
    renderHuangweiPanelRich: renderHuangweiPanelRich,
    renderHuangquanPanelRich: renderHuangquanPanelRich,
    renderMinxinPanelRich: renderMinxinPanelRich,
    renderHukouPanelRich: renderHukouPanelRich,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ═══════════════════════════════════════════════════════════════════
// 合并自 tm-var-drawers-final.js (原 Phase 3: Extra wrap)
// ═══════════════════════════════════════════════════════════════════

/**
 * tm-var-drawers-final.js — 抽屉最终补齐
 *
 * 为 7 个抽屉 renderXxxPanel 追加所有方案应展示但尚缺的内容。
 * 保证"C:\\Users\\37814\\Desktop\\工作方案"下每一份设计方案的可展示/可操作
 * 内容都落在某个抽屉内。
 *
 * 覆盖方式：wrap 原 render，在其完成后 append 额外 section 到 body。
 */
(function(global) {
  'use strict';

  function _fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e8) return (n/1e8).toFixed(2) + '亿';
    if (abs >= 1e4) return (n/1e4).toFixed(1) + '万';
    return Math.round(n).toLocaleString();
  }
  // R143·委托给 tm-utils.js:569 的 escHtml
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')); }
  function _sec(title, badge, content) {
    return '<section class="vd-section"><div class="vd-section-title">' + _esc(title) + (badge ? ' <span class="vd-badge">' + _esc(badge) + '</span>' : '') + '</div>' + content + '</section>';
  }
  function _appendToBody(bodyId, html) {
    var body = document.getElementById(bodyId);
    if (!body || !html) return;
    // 插到圣裁/紧急措施之前
    var curr = body.innerHTML;
    var idx = curr.search(/<section class="vd-section"><div class="vd-section-title">(?:圣裁|紧急措施|铸币之政|财政改革)/);
    if (idx > 0) body.innerHTML = curr.slice(0, idx) + html + curr.slice(idx);
    else body.innerHTML = curr + html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  帑廪补齐：纸币25/监察/破产7步/漏损三角/封建5类/19税种
  // ═══════════════════════════════════════════════════════════════════

  function _extraForGuoku() {
    var G = global.GM || {}; var g = G.guoku || {}; var html = '';

    // § 19 原子税种（补 11 新）
    if (G.fiscalConfig && G.fiscalConfig.taxes) {
      var taxes = G.fiscalConfig.taxes;
      var extras = ['shangshui','chashui','jiushui','tieshui','tongshui','yongshou','diaoshou','suanmin','imperialEstate','shuimoShui','zajuan'];
      var active = extras.filter(function(k){return taxes[k] && taxes[k].enabled;});
      if (active.length > 0) {
        var th = '';
        active.forEach(function(k) {
          var t = taxes[k];
          th += '<div style="font-size:0.72rem;padding:1px 0;">· <b>' + _esc(t.name) + '</b>（' + _esc(t.base||'') + '，率 ' + ((t.rate||0)*100).toFixed(1) + '%）</div>';
        });
        html += _sec('十九原子税种 · 补启', active.length + ' 启', th);
      }
    }

    // § 纸币 25 预设状态
    if (G.currency && G.currency.coins && G.currency.coins.paper) {
      var pp = G.currency.coins.paper;
      if (pp.enabled) {
        var PRESETS = (typeof global.PhaseH !== 'undefined' && global.PhaseH.PAPER_DATA_25) || [];
        var current = PRESETS.find(function(p){return p.id === pp.activePreset;});
        var ph = '<div style="padding:6px 8px;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;font-size:0.76rem;">';
        if (current) {
          ph += '<div><b>' + _esc(current.name) + '</b>（' + current.dynasty + ' ' + current.startYear + '-' + current.endYear + '）</div>';
        }
        var stCol = pp.state==='collapse'?'var(--vermillion-500)':pp.state==='depreciate'?'var(--amber-400)':'#6aa88a';
        ph += '<div>状态 <span style="color:' + stCol + ';">' + _esc(pp.state||'—') + '</span> · 信用 ' + ((pp.trust||1)*100).toFixed(0) + '%</div>';
        if (pp.cumulativeInflation !== undefined) ph += '<div>累积通胀 <span style="color:var(--amber-400);">' + ((pp.cumulativeInflation||0)*100).toFixed(0) + '%</span></div>';
        if (pp.issuedAmount !== undefined) ph += '<div>发行量 ' + _fmt(pp.issuedAmount) + ' · 储备率 ' + ((pp.reserveRatio||0.3)*100).toFixed(0) + '%</div>';
        ph += '</div>';
        // 25 预设名录
        if (PRESETS.length > 0) {
          ph += '<details style="margin-top:4px;font-size:0.7rem;"><summary style="cursor:pointer;color:var(--txt-d);">25 条历代纸币预设</summary><div style="background:var(--bg-2);padding:4px;max-height:120px;overflow-y:auto;">';
          PRESETS.forEach(function(p) {
            var active = p.id === pp.activePreset;
            ph += '<div style="padding:1px 0;' + (active?'color:var(--gold);font-weight:600;':'color:var(--txt-d);') + '">· ' + _esc(p.name) + '（' + p.dynasty + ' ' + p.startYear + '-' + p.endYear + ' · ' + p.state + '）</div>';
          });
          ph += '</div></details>';
        }
        html += _sec('纸币·六态生命周期', null, ph);
      }
    }

    // § 海外银流（完整）
    if (G.currency && G.currency.foreignFlow && ((G.currency.foreignFlow.annualInflow||0)>0 || (G.currency.foreignFlow.annualOutflow||0)>0)) {
      var ff = G.currency.foreignFlow;
      var fh = '<div style="font-size:0.74rem;">';
      fh += '<div>· 年度流入 <span style="color:#6aa88a;">' + _fmt(ff.annualInflow||0) + '</span> 两</div>';
      fh += '<div>· 年度流出 <span style="color:var(--vermillion-400);">' + _fmt(ff.annualOutflow||0) + '</span> 两</div>';
      if (ff.sources) { fh += '<div style="color:var(--txt-d);margin-top:3px;">源：'; Object.keys(ff.sources).forEach(function(k){fh += _esc(k)+' '+_fmt(ff.sources[k])+' · ';}); fh += '</div>'; }
      if (ff.sinks) { fh += '<div style="color:var(--txt-d);">汇：'; Object.keys(ff.sinks).forEach(function(k){fh += _esc(k)+' '+_fmt(ff.sinks[k])+' · ';}); fh += '</div>'; }
      fh += '</div>';
      html += _sec('海外银流', ff.tradeMode||'', fh);
    }

    // § 央地分账 3 模式
    var preset = G.fiscalConfig && G.fiscalConfig.centralLocalRules && G.fiscalConfig.centralLocalRules.preset;
    if (G.fiscal && G.fiscal.regions) {
      var rids = Object.keys(G.fiscal.regions);
      var clh = '<div style="font-size:0.74rem;">';
      clh += '<div>· 当前预设：<b>' + _esc(preset||'qiyun_cunliu') + '</b></div>';
      var modeName = {tang_three:'唐三分（州留/道留/中央）',qiyun_cunliu:'明清起运存留',song_cash:'宋钱入中央',custom:'自定'}[preset||'qiyun_cunliu'];
      clh += '<div style="color:var(--txt-d);">' + _esc(modeName||'') + '</div>';
      // 表头
      clh += '<table style="width:100%;margin-top:4px;font-size:0.68rem;"><tr style="color:var(--gold-500);"><td>省</td><td>名义</td><td>实征</td><td>留存</td><td>起运</td><td>合规</td></tr>';
      rids.slice(0, 15).forEach(function(rid) {
        var r = G.fiscal.regions[rid];
        clh += '<tr><td>' + _esc(rid) + '</td>';
        clh += '<td>' + _fmt(r.claimedRevenue||0) + '</td>';
        clh += '<td>' + _fmt(r.actualRevenue||0) + '</td>';
        clh += '<td>' + _fmt(r.retainedBudget||0) + '</td>';
        clh += '<td>' + _fmt(r.remittedToCenter||0) + '</td>';
        clh += '<td>' + ((r.compliance||0.7)*100).toFixed(0) + '%</td></tr>';
      });
      clh += '</table>';
      clh += '</div>';
      html += _sec('央地分账', rids.length + ' 区', clh);
    }

    // § 五封建财政
    if (G.feudalHoldings && G.feudalHoldings.length > 0) {
      var fth = '';
      var TYPES = (typeof global.PhaseH !== 'undefined' && global.PhaseH.FEUDAL_HOLDING_TYPES) || {};
      G.feudalHoldings.forEach(function(fh2) {
        var rule = TYPES[fh2.type] || {};
        var col = fh2.loyalty < 0.3 ? 'var(--vermillion-400)' : fh2.loyalty < 0.6 ? 'var(--amber-400)' : '#6aa88a';
        fth += '<div style="padding:4px 6px;background:var(--bg-2);border-left:3px solid ' + col + ';margin-bottom:3px;font-size:0.72rem;">';
        fth += '<b>' + _esc(fh2.name) + '</b>（' + _esc(fh2.type) + ' · ' + _esc(rule.description||'') + '）· 忠 ' + ((fh2.loyalty||0.5)*100).toFixed(0) + '%';
        if (fh2.tribute && fh2.tribute.annual) fth += ' · 年贡 ' + _fmt(fh2.tribute.annual);
        fth += '</div>';
      });
      html += _sec('五类封建', G.feudalHoldings.length + ' 处', fth);
    }

    // § 破产 7 步
    if (G._bankruptcyState && G._bankruptcyState.activatedStep > 0) {
      var BS = (typeof global.PhaseF2 !== 'undefined' && global.PhaseF2.BANKRUPTCY_STEPS) || [];
      var bh = '<div style="font-size:0.74rem;">';
      BS.forEach(function(step, i) {
        var done = (i+1) <= G._bankruptcyState.activatedStep;
        var col = done ? 'var(--vermillion-400)' : 'var(--txt-d)';
        bh += '<div style="padding:2px 4px;color:' + col + ';">' + (done?'▣':'☐') + ' ' + step.id + '. ' + _esc(step.name) + '</div>';
      });
      bh += '</div>';
      html += _sec('破产七步', '阶段 ' + G._bankruptcyState.activatedStep + '/7', bh);
    }

    // § 漏损三角
    if (G._leakageState && G._leakageState.loss > 0) {
      var lh = '<div style="padding:6px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.74rem;">';
      lh += '<div>段位：<b>' + _esc(G._leakageState.phase) + '</b></div>';
      var phaseDesc = G._leakageState.phase==='majesty'?'威严段抑腐（低漏）':G._leakageState.phase==='tyrant'?'暴君段隐账（虚高账面）':G._leakageState.phase==='lost'?'失威段公开漏':G._leakageState.phase==='decline'?'衰微段贪漏':'常望段中漏';
      lh += '<div style="color:var(--txt-d);font-size:0.7rem;">' + phaseDesc + '</div>';
      lh += '<div>漏损率 <b style="color:var(--vermillion-400);">' + ((G._leakageState.rate||0)*100).toFixed(2) + '%</b></div>';
      lh += '<div>本月漏 <b style="color:var(--vermillion-400);">' + _fmt(G._leakageState.loss) + '</b> 钱</div>';
      lh += '</div>';
      html += _sec('漏损三角 · 腐败×皇威×帑廪', null, lh);
    }

    // § 监察预算+覆盖率
    if (G.auditSystem) {
      var ash = '<div style="font-size:0.74rem;">';
      ash += '<div>· 御史可用 ' + (G.auditSystem.inspectorsAvailable||0) + ' / 已查 ' + (G.auditSystem.totalAuditsCompleted||0) + ' 次</div>';
      ash += '<div>· 监察强度 <b>' + ((G.auditSystem.strength||0)*100).toFixed(0) + '%</b></div>';
      if (G.auditSystem.annualBudget) ash += '<div>· 年度预算 ' + _fmt(G.auditSystem.annualBudget) + ' · 已用 ' + _fmt(G.auditSystem.consumed||0) + '</div>';
      if (G.auditSystem.coverage) ash += '<div>· 覆盖率 ' + ((G.auditSystem.coverage||0)*100).toFixed(0) + '%（预算/需求）</div>';
      ash += '</div>';
      html += _sec('监察预算·覆盖', null, ash);
    }

    // § 事件钩子近触
    var recentEvents = [];
    if (G.guoku && G.guoku.money < 0) recentEvents.push('帑廪告罄');
    if (G._bankruptcyState && G._bankruptcyState.activatedStep > 0) recentEvents.push('破产触发');
    if (G.currency && G.currency.market && Math.abs(G.currency.market.inflation||0) > 0.15) recentEvents.push('通胀猛涨');
    if (G.fiscal && G.fiscal.regions) {
      var def = Object.keys(G.fiscal.regions).filter(function(rid){return G.fiscal.regions[rid].compliance < 0.3;}).length;
      if (def > 0) recentEvents.push('藩镇抗命 ' + def + ' 处');
    }
    if (G.landAnnexation && G.landAnnexation.concentration > 0.7) recentEvents.push('兼并危机');
    if (recentEvents.length > 0) {
      html += _sec('事件钩子 · 近触', recentEvents.length + '', '<div style="font-size:0.72rem;color:var(--amber-400);">' + recentEvents.map(function(e){return '· '+e;}).join('<br>') + '</div>');
    }

    _appendToBody('guoku-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  内帑补齐
  // ═══════════════════════════════════════════════════════════════════

  function _extraForNeitang() {
    var G = global.GM || {}; var n = G.neitang || {}; var html = '';
    // 宗室压力
    if (n.rules && n.rules.royalClanPressure) {
      var rcp = n.rules.royalClanPressure;
      html += _sec('宗室压力', null, '<div style="font-size:0.74rem;">' +
        '<div>· 宗室人数 ' + _fmt(rcp.clanSize||0) + '</div>' +
        '<div>· 月供 ' + _fmt(n.clanMonthlyCost||0) + ' 两</div>' +
      '</div>');
    }
    // 皇威×内帑大典
    if (n.recentCeremonies && n.recentCeremonies.length > 0) {
      var ch = '';
      n.recentCeremonies.slice(-5).forEach(function(c) {
        ch += '<div style="font-size:0.72rem;">· ' + _esc(c.name||'大典') + '（T' + (c.turn||0) + '）费 ' + _fmt(c.cost||0) + '</div>';
      });
      html += _sec('近岁大典', n.recentCeremonies.length + '', ch);
    }
    // 内帑×皇威联动提示
    if (G.huangwei) {
      html += _sec('内帑×皇威联动', null, '<div style="font-size:0.72rem;color:var(--txt-d);">· 大典由内帑出资，皇威 +20（礼）/+10（祭）/+5（宴）<br>· 奢侈消费过度 → 民心降 · 皇威加速消耗</div>');
    }
    // 内帑×皇权
    if (G.huangquan) {
      var hq = G.huangquan.index || 55;
      var note = hq < 35 ? '权臣段：外戚/宦官侵占 +30%' : hq > 70 ? '专制段：内帑独立性强' : '制衡段：正常';
      html += _sec('内帑×皇权联动', null, '<div style="font-size:0.72rem;color:var(--txt-d);">' + note + '</div>');
    }
    _appendToBody('neitang-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口补齐：五字段/10徭役/25预设/军种/将领/边防/年龄层/男女比/京畿虹吸
  // ═══════════════════════════════════════════════════════════════════

  function _extraForHukou() {
    var G = global.GM || {}; var P = G.population || {}; var html = '';
    if (!P.national) { _appendToBody('hukou-body', ''); return; }

    // § region 五字段（挑一个具代表性的 region）
    if (P.byRegion && Object.keys(P.byRegion).length > 0) {
      var firstRid = Object.keys(P.byRegion)[0];
      var r = P.byRegion[firstRid];
      if (r && r.bySettlement) {
        var rh = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:4px;">示：' + _esc(firstRid) + '</div>';
        // bySettlement
        rh += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:4px;font-size:0.7rem;">';
        ['fang','shi','zhen','cun'].forEach(function(k) {
          var s = r.bySettlement[k];
          if (s) rh += '<div style="padding:3px;background:var(--bg-2);text-align:center;">' + ({fang:'坊',shi:'市',zhen:'镇',cun:'村'}[k]) + ' ' + _fmt(s.mouths||0) + '</div>';
        });
        rh += '</div>';
        // byGender
        if (r.byGender) rh += '<div style="font-size:0.7rem;">· 男女比 ' + (r.byGender.sexRatio||1.04).toFixed(2) + '（男 ' + _fmt(r.byGender.male||0) + ' / 女 ' + _fmt(r.byGender.female||0) + '）</div>';
        // byAge.decade
        if (r.byAge && r.byAge.decade) {
          rh += '<div style="font-size:0.7rem;margin-top:3px;color:var(--txt-d);">年龄金字塔：</div>';
          rh += '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:2px;font-size:0.66rem;">';
          ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80+'].forEach(function(k) {
            rh += '<div style="padding:2px;background:var(--bg-2);text-align:center;">' + k + '<br>' + _fmt(r.byAge.decade[k]||0) + '</div>';
          });
          rh += '</div>';
        }
        // byEthnicity
        if (r.byEthnicity) {
          var eh = '<div style="font-size:0.7rem;margin-top:3px;">族群：';
          Object.keys(r.byEthnicity).forEach(function(k){ eh += _esc(k) + ' ' + ((r.byEthnicity[k]||0)*100).toFixed(0) + '% · '; });
          eh += '</div>';
          rh += eh;
        }
        // byFaith
        if (r.byFaith) {
          var fh = '<div style="font-size:0.7rem;">信仰：';
          Object.keys(r.byFaith).forEach(function(k){ if ((r.byFaith[k]||0)>0.01) fh += _esc(k) + ' ' + ((r.byFaith[k]||0)*100).toFixed(0) + '% · '; });
          fh += '</div>';
          rh += fh;
        }
        html += _sec('region 五字段（示一区）', null, rh);
      }
    }

    // § 10 类徭役详表
    var CV = [];
    try { if (typeof global.HujiEngine !== 'undefined' && global.HujiEngine.CORVEE_TYPES) CV = Object.keys(global.HujiEngine.CORVEE_TYPES).map(function(k){var t=global.HujiEngine.CORVEE_TYPES[k];t.key=k;return t;}); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-final');}catch(_){}}
    if (CV.length === 0) {
      // 尝试从 GM 读
      if (P.corvee && P.corvee.byType) CV = Object.keys(P.corvee.byType).map(function(k){return Object.assign({key:k},P.corvee.byType[k]);});
    }
    if (CV.length > 0) {
      var ch = '<div style="max-height:140px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.7rem;">';
      CV.slice(0, 10).forEach(function(t) {
        ch += '<div style="padding:1px 2px;">· <b>' + _esc(t.name||t.key) + '</b>' + (t.daysPerDing?'（丁年 ' + t.daysPerDing + ' 日）':'') + (t.deathRate?'，殁率 ' + ((t.deathRate||0)*100).toFixed(1) + '%':'') + '</div>';
      });
      ch += '</div>';
      html += _sec('十徭役分类', CV.length + '', ch);
    }

    // § 25 大徭役预设
    var GC = [];
    try {
      if (typeof global.HistoricalPresets !== 'undefined') {
        GC = (typeof global.HistoricalPresets.getGreatCorveeProjects === 'function')
          ? global.HistoricalPresets.getGreatCorveeProjects()
          : (global.HistoricalPresets.GREAT_CORVEE_PROJECTS || []);
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-final');}catch(_){}}
    if (GC.length > 0) {
      var gch = '<details><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">展 ' + GC.length + ' 大徭役历代预设</summary><div style="max-height:150px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;margin-top:4px;">';
      GC.forEach(function(p) {
        gch += '<div style="padding:1px 2px;">· <b>' + _esc(p.name||p.id) + '</b>（' + _esc(p.dynasty||'') + (p.year?' '+p.year:'') + '）' + (p.labor?' 丁 ' + _fmt(p.labor):'') + (p.deathRate?' 殁 ' + ((p.deathRate||0)*100).toFixed(0) + '%':'') + '</div>';
      });
      gch += '</div></details>';
      html += _sec('历代大徭役预设', GC.length + '', gch);
    }

    // § 6 军种详表
    var BRANCHES = (typeof global.PhaseB !== 'undefined' && global.PhaseB.MILITARY_BRANCHES) || {};
    if (Object.keys(BRANCHES).length > 0) {
      var bh = '';
      Object.keys(BRANCHES).forEach(function(k) {
        var b = BRANCHES[k];
        bh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(b.name) + '</b>：基费 ' + b.baseCost + ' · 粮 ' + b.grainPerSoldier + '/卒 · 战力 ×' + b.effectivenessCoef + (b.requiresHorses?' · 需马':'') + '</div>';
      });
      html += _sec('军种 · 六分', Object.keys(BRANCHES).length + '', bh);
    }

    // § 3 军粮供应
    var SUPPLY = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.SUPPLY_MODES) || (typeof global.PhaseB !== 'undefined' && global.PhaseB.MILITARY_SUPPLY_MODES) || {};
    if (Object.keys(SUPPLY).length > 0) {
      var sh = '';
      Object.keys(SUPPLY).forEach(function(k) {
        var s = SUPPLY[k];
        sh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(s.name) + '</b> 自给 ' + ((s.selfRatio||0)*100).toFixed(0) + '% · 国家 ' + ((s.stateLoad||0)*100).toFixed(0) + '%' + (s.description?' ('+_esc(s.description)+')':'') + '</div>';
      });
      html += _sec('军粮·三供', null, sh);
    }

    // § 4 将领出身
    var LB = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.LEADER_BACKGROUND_BONUSES) || {};
    if (Object.keys(LB).length > 0) {
      var lh = '';
      Object.keys(LB).forEach(function(k) {
        var l = LB[k];
        lh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(l.description) + '</b>：统兵 ' + (l.commandBonus>=0?'+':'') + l.commandBonus + ' · 忠 ' + (l.loyaltyToEmperor>=0?'+':'') + l.loyaltyToEmperor + ' · 野心 ' + (l.ambitionTendency>=0?'+':'') + l.ambitionTendency + '</div>';
      });
      html += _sec('将领·四出身', null, lh);
    }

    // § 5 边防区
    var FZ = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.FRONTIER_ZONES) || {};
    if (Object.keys(FZ).length > 0) {
      var fzh = '';
      Object.keys(FZ).forEach(function(k) {
        var z = FZ[k];
        fzh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc({north:'北疆',northeast:'东北',northwest:'西北',southwest:'西南',southeast:'东南'}[k]||k) + '</b>：' + _esc(z.description||'') + '（主 ' + _esc(z.focus||'') + '）</div>';
      });
      html += _sec('边防·五大区', null, fzh);
    }

    // § 阶层流动 7 路径
    var CMP = [];
    try { if (typeof global.HujiDeepFill !== 'undefined' && global.HujiDeepFill.CLASS_MOBILITY_PATHS) CMP = global.HujiDeepFill.CLASS_MOBILITY_PATHS; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-final');}catch(_){}}
    if (CMP.length > 0) {
      var ph = '';
      CMP.forEach(function(p) {
        ph += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(p.name||p.id) + '</b>' + (p.from?'：' + _esc(p.from) + ' → ' + _esc(p.to||''):'') + (p.rate?' · ' + (p.rate*100).toFixed(2) + '%/年':'') + '</div>';
      });
      html += _sec('阶层流动 · 七路', CMP.length + '', ph);
    }

    // § 京畿虹吸四因子
    if (G._capital && typeof global.PhaseB !== 'undefined' && global.PhaseB.computeCapitalSiphon) {
      var si = global.PhaseB.computeCapitalSiphon(G);
      if (si.total > 0) {
        var sih = '<div style="font-size:0.72rem;">';
        sih += '<div>· 科举汲引 <b>' + _fmt(si.keju||0) + '</b></div>';
        sih += '<div>· 贵族消费 <b>' + _fmt(si.nobility||0) + '</b></div>';
        sih += '<div>· 商业辐射 <b>' + _fmt(si.commerce||0) + '</b></div>';
        sih += '<div>· 官员员额 <b>' + _fmt(si.officials||0) + '</b></div>';
        sih += '<div style="margin-top:3px;">合计年吸 <b style="color:var(--gold);">' + _fmt(si.total) + '</b> 口 → ' + _esc(G._capital) + '</div>';
        sih += '</div>';
        html += _sec('京畿虹吸 · 四因子', null, sih);
      }
    }

    // § 120 色职业户籍（简略）
    if (P.byCategory) {
      var cats = Object.keys(P.byCategory);
      if (cats.length > 15) {
        html += _sec('扩展色目户籍', cats.length + ' 色', '<div style="font-size:0.7rem;color:var(--txt-d);">职业户籍扩展至 ' + cats.length + ' 色（含灶户/驿户/匠户/乐户等）</div>');
      }
    }

    _appendToBody('hukou-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  吏治补齐：9源详细/腐败集团/三模式
  // ═══════════════════════════════════════════════════════════════════

  function _extraForLizhi() {
    var G = global.GM || {}; var c = G.corruption || {}; var html = '';

    // § 9 源累积（完整 label）
    var SRC_LBL = {
      lowSalary:'俸薄',laxSupervision:'监弛',emergencyLevy:'急征',
      officeSelling:'鬻官',nepotism:'荐幸',innerCircle:'宠信',
      redundancy:'冗员',institutional:'制弊',lumpSumSpending:'巨支'
    };
    if (c.sources) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;">';
      Object.keys(SRC_LBL).forEach(function(k) {
        var v = c.sources[k] || 0;
        var col = v>5?'var(--vermillion-400)':v>1?'var(--amber-400)':'var(--txt-d)';
        sh += '<div style="padding:3px 5px;background:var(--bg-2);font-size:0.7rem;">' +
          '<div>' + SRC_LBL[k] + '</div>' +
          '<div style="color:' + col + ';font-weight:600;">' + v.toFixed(1) + '</div>' +
        '</div>';
      });
      sh += '</div>';
      html += _sec('九源 · 腐浊所由', null, sh);
    }

    // § 腐败集团凝聚
    if (G._corruptionCartel && G._corruptionCartel.formed) {
      var cch = '<div style="padding:8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-500);border-radius:3px;font-size:0.76rem;">';
      cch += '<div>立于 T' + (G._corruptionCartel.formedTurn||0) + ' · 凝聚度 <b>' + ((G._corruptionCartel.cohesion||0)*100).toFixed(0) + '%</b></div>';
      cch += '<div>成员 ' + (G._corruptionCartel.members||[]).length + ' · 反腐抗性 <b>' + ((G._corruptionCartel.resistance||0)*100).toFixed(0) + '%</b></div>';
      if (G._corruptionCartel.members && G._corruptionCartel.members.length > 0) {
        cch += '<div style="color:var(--txt-d);font-size:0.7rem;margin-top:3px;">核心：' + G._corruptionCartel.members.slice(0, 6).map(function(n){return _esc(n);}).join('、') + '</div>';
      }
      cch += '</div>';
      html += _sec('官僚集团 · 凝聚', '腐败>70 触发', cch);
    }

    // § 巨额预警
    if (G._lumpSumWarnings && G._lumpSumWarnings.length > 0) {
      var pending = G._lumpSumWarnings.filter(function(w){return w.status==='pending';});
      if (pending.length > 0) {
        var wh = '';
        pending.slice(-5).forEach(function(w) {
          var col = w.level === 'critical' ? 'var(--vermillion-400)' : 'var(--amber-400)';
          wh += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid ' + col + ';margin-bottom:3px;font-size:0.72rem;">';
          wh += '<div style="color:' + col + ';">' + _esc(w.drafter||'户部') + ' · T' + (w.turn||0) + '</div>';
          wh += '<div>' + _esc(w.content||'') + '</div>';
          wh += '</div>';
        });
        html += _sec('户部劝谏 · 巨额支出', pending.length + '', wh);
      }
    }

    // § 三模式（演义/史实/严格）
    var MODE = (typeof global.PhaseF4 !== 'undefined' && global.PhaseF4.getCurrentCorruptionMode) ? global.PhaseF4.getCurrentCorruptionMode() : null;
    if (MODE) {
      var mh = '<div style="padding:6px 8px;background:var(--bg-2);border-radius:3px;font-size:0.74rem;">';
      mh += '<div>当前模式：<b>' + _esc(MODE.name) + '</b></div>';
      mh += '<div style="color:var(--txt-d);">' + _esc(MODE.description||'') + '</div>';
      mh += '<div style="margin-top:3px;">贪腐可见 <b>' + ((MODE.corruptionVisibility||0)*100).toFixed(0) + '%</b> · 标注 ' + (MODE.memorialFlaggingEnabled?'启':'关') + '</div>';
      mh += '</div>';
      html += _sec('游戏模式 · 贪腐提示', null, mh);
    }

    // § 监察活动列表
    if (G.auditSystem && G.auditSystem.activeAudits) {
      var active = G.auditSystem.activeAudits.filter(function(a){return a.status==='in_progress';});
      var completed = G.auditSystem.activeAudits.filter(function(a){return a.status==='completed' && a.found;});
      if (active.length + completed.length > 0) {
        var ah = '';
        active.forEach(function(a) {
          ah += '<div style="font-size:0.72rem;padding:2px 0;color:var(--amber-400);">▶ ' + _esc(a.region) + '（' + _esc(a.intensity) + '）· 归 T' + a.expectedReturnTurn + '</div>';
        });
        completed.slice(-5).forEach(function(a) {
          ah += '<div style="font-size:0.72rem;padding:2px 0;color:var(--vermillion-300);">⚠ ' + _esc(a.region) + ' · 查实舞弊</div>';
        });
        html += _sec('监察中/已曝', (active.length + completed.length) + '', ah);
      }
    }

    _appendToBody('lizhi-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心补齐：9 旧分类映射 / 异象三库按类
  // ═══════════════════════════════════════════════════════════════════

  function _extraForMinxin() {
    var G = global.GM || {}; var m = G.minxin || {}; var html = '';

    // § 9 旧分类映射
    var MAP = (typeof global.PhaseF4 !== 'undefined' && global.PhaseF4.OLD_TO_NEW_CLASS_MAP) || {};
    if (Object.keys(MAP).length > 0 && m.byClass && typeof global.PhaseF4 !== 'undefined' && global.PhaseF4.getMinxinByOldClass) {
      var mh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;font-size:0.7rem;">';
      var labels = {shi:'士', nong:'农', gong:'工', shang:'商', bing:'兵', seng:'僧', xu:'胥', yi:'役', haoqiang:'豪强', liumin:'流民'};
      Object.keys(labels).forEach(function(k) {
        var v = global.PhaseF4.getMinxinByOldClass(k);
        var col = v >= 60 ? '#6aa88a' : v >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
        mh += '<div style="padding:3px 5px;background:var(--bg-2);"><span style="color:var(--txt-d);">' + labels[k] + '</span> <span style="color:' + col + ';float:right;">' + Math.round(v) + '</span></div>';
      });
      mh += '</div>';
      html += _sec('九旧分类映射', '士农工商兵僧胥役豪流', mh);
    }

    // § 异象三库按类
    var AC = (typeof global.AuthorityComplete !== 'undefined') ? global.AuthorityComplete : null;
    if (AC && AC.HEAVEN_SIGNS && AC.AUSPICIOUS_SIGNS) {
      var lih = '<div style="font-size:0.7rem;">';
      lih += '<div style="color:var(--vermillion-400);margin-bottom:2px;">天象库（' + AC.HEAVEN_SIGNS.length + '）：</div>';
      AC.HEAVEN_SIGNS.forEach(function(s) {
        lih += '<span style="padding:1px 5px;margin:1px;background:rgba(192,64,48,0.1);border-radius:2px;display:inline-block;">' + _esc(s.name) + '</span>';
      });
      lih += '<div style="color:#6aa88a;margin:4px 0 2px;">祥瑞库（' + AC.AUSPICIOUS_SIGNS.length + '）：</div>';
      AC.AUSPICIOUS_SIGNS.forEach(function(s) {
        lih += '<span style="padding:1px 5px;margin:1px;background:rgba(106,168,138,0.1);border-radius:2px;display:inline-block;">' + _esc(s.name) + '</span>';
      });
      var PL = (typeof global.PhaseD !== 'undefined' && global.PhaseD.PROPHECY_LIBRARY) || [];
      if (PL.length > 0) {
        lih += '<div style="color:var(--amber-400);margin:4px 0 2px;">谶纬库（' + PL.length + '）：</div>';
        PL.forEach(function(p) {
          lih += '<span style="padding:1px 5px;margin:1px;background:rgba(184,140,60,0.1);border-radius:2px;display:inline-block;">' + _esc(p.text) + '</span>';
        });
      }
      lih += '</div>';
      html += _sec('异象三库', '天7·瑞6·谶12', lih);
    }

    // § 天人感应状态
    if (G._recentHeavenSign !== undefined) {
      html += _sec('天人感应', null, '<div style="font-size:0.72rem;">近期 ' + (G._recentHeavenSign?'有天示':'无') + '</div>');
    }

    _appendToBody('minxin-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇权补齐：诏书五要素 / 执行率公式
  // ═══════════════════════════════════════════════════════════════════

  function _extraForHuangquan() {
    var G = global.GM || {}; var hq = G.huangquan || {}; var html = '';

    // § 执行率公式
    if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.computeEdictExecutionRate) {
      var execRate = global.AuthorityComplete.computeEdictExecutionRate(0.6);  // 假设 60% 完整度
      var hw = G.huangwei || {};
      var hqBase = hq ? (0.5 + hq.index / 200) : 0.75;
      var hwMult = hw.phase === 'tyrant'?1.3:hw.phase==='majesty'?1.1:hw.phase==='decline'?0.7:hw.phase==='lost'?0.35:1.0;
      var eh = '<div style="font-size:0.72rem;padding:6px 8px;background:var(--bg-2);border-radius:3px;">';
      eh += '<div>执行率 = <b>皇权基 × 皇威乘 × 诏详</b></div>';
      eh += '<div style="color:var(--txt-d);margin-top:2px;">= ' + (hqBase*100).toFixed(0) + '% × ' + hwMult.toFixed(2) + ' × 0.5~1.0</div>';
      eh += '<div style="margin-top:2px;">当前（假设完整度 60%）：<b style="color:var(--gold);">' + (execRate*100).toFixed(0) + '%</b></div>';
      eh += '</div>';
      html += _sec('执行率公式', null, eh);
    }

    // § 诏书五要素
    var fh = '<div style="font-size:0.72rem;color:var(--txt-d);">专制段（皇权 >= 70）时诏书须五要素齐备：</div>';
    fh += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:4px;">';
    ['时日','地点','执行人','经费','考核'].forEach(function(e) {
      fh += '<div style="padding:4px;background:var(--bg-2);text-align:center;font-size:0.7rem;">' + e + '</div>';
    });
    fh += '</div>';
    if (hq.index >= 70) fh += '<div style="font-size:0.68rem;color:var(--amber-400);margin-top:3px;">⚠ 当前专制段，缺要素将被侍臣请圣裁</div>';
    html += _sec('诏书·五要素', '专制段硬检', fh);

    // § 四象限原型
    var QP = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.getAuthorityQuadrant) ? global.AuthorityComplete.getAuthorityQuadrant() : null;
    // 还要显示所有象限原型
    var ALL_Q = {
      tyrant_peak: { name:'暴君顶点', desc:'朱元璋末/隋炀帝' },
      lonely_do: { name:'事必躬亲无人听', desc:'崇祯末' },
      revered_puppet: { name:'受敬傀儡', desc:'罕见' },
      puppet: { name:'汉献帝式傀儡', desc:'汉献帝' },
      optimal: { name:'制衡威严', desc:'唐太宗/康熙中期' }
    };
    var qh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;">';
    Object.keys(ALL_Q).forEach(function(k) {
      var p = ALL_Q[k]; var active = QP && QP.id === k;
      var col = active ? 'var(--gold)' : 'var(--txt-d)';
      qh += '<div style="padding:4px 6px;background:var(--bg-2);border-left:3px solid ' + col + ';font-size:0.7rem;">' +
        '<div style="color:' + col + ';">' + (active?'► ':'') + _esc(p.name) + '</div>' +
        '<div style="font-size:0.66rem;color:var(--txt-d);">' + _esc(p.desc) + '</div>' +
      '</div>';
    });
    qh += '</div>';
    html += _sec('四象限原型', '当前+5 原型', qh);

    _appendToBody('huangquan-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇威补齐：地方粉饰五段表 / 执行度乘数表 / 朝代预设参考
  // ═══════════════════════════════════════════════════════════════════

  function _extraForHuangwei() {
    var G = global.GM || {}; var w = G.huangwei || {}; var html = '';

    // § 粉饰公式五段表
    var idx = w.index || 50;
    var corr = (G.corruption && typeof G.corruption === 'object' ? G.corruption.overall : 0) || 0;
    var corrMult = 1 + corr / 200;
    var powder = [
      { seg:'暴君（≥90）', add:8, note:'奏疏 90% 颂圣，perceived 高估' },
      { seg:'威严（70-89）', add:2, note:'基本真实，轻微粉饰' },
      { seg:'常望（50-69）', add:3, note:'中等粉饰，低风险' },
      { seg:'衰微（30-49）', add:6, note:'粉饰愈急，地方抬值' },
      { seg:'失威（<30）', add:4, note:'抗疏公然，粉饰无力' }
    ];
    var ph = '<table style="width:100%;font-size:0.7rem;"><tr style="color:var(--gold-500);"><td>段位</td><td>基加</td><td>×腐败</td><td>说明</td></tr>';
    powder.forEach(function(p) {
      var curr = (idx >= 90 && p.seg.indexOf('暴君')===0) || (idx >= 70 && idx < 90 && p.seg.indexOf('威严')===0) || (idx >= 50 && idx < 70 && p.seg.indexOf('常望')===0) || (idx >= 30 && idx < 50 && p.seg.indexOf('衰微')===0) || (idx < 30 && p.seg.indexOf('失威')===0);
      var col = curr ? 'var(--gold)' : 'var(--txt-d)';
      ph += '<tr style="color:' + col + ';">' +
        '<td>' + (curr?'► ':'') + _esc(p.seg) + '</td>' +
        '<td>+' + p.add + '</td>' +
        '<td>×' + (curr?corrMult.toFixed(2):'?.??') + '</td>' +
        '<td style="font-size:0.66rem;">' + _esc(p.note) + '</td></tr>';
    });
    ph += '</table>';
    html += _sec('粉饰公式 · 五段', '地方视野修饰', ph);

    // § 执行度乘数表
    var emh = '<table style="width:100%;font-size:0.7rem;"><tr style="color:var(--gold-500);"><td>段位</td><td>乘数</td><td>含义</td></tr>';
    [
      { seg:'暴君', m:1.3, desc:'令出必行，过度执行' },
      { seg:'威严', m:1.0, desc:'诏命畅达' },
      { seg:'常望', m:0.85, desc:'略有阻' },
      { seg:'衰微', m:0.65, desc:'诏行有阻' },
      { seg:'失威', m:0.35, desc:'诏不出京' }
    ].forEach(function(e) {
      var wphase = w.phase === 'tyrant'?'暴君':w.phase==='majesty'?'威严':w.phase==='normal'?'常望':w.phase==='decline'?'衰微':'失威';
      var curr = e.seg === wphase;
      var col = curr ? 'var(--gold)' : 'var(--txt-d)';
      emh += '<tr style="color:' + col + ';">' +
        '<td>' + (curr?'► ':'') + e.seg + '</td>' +
        '<td>×' + e.m.toFixed(2) + '</td>' +
        '<td style="font-size:0.66rem;">' + e.desc + '</td></tr>';
    });
    emh += '</table>';
    html += _sec('执行度乘数表 · 五段', null, emh);

    // § 朝代预设参考
    var DAP = (typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.DYNASTY_AUTHORITY_PRESETS) || {};
    if (G.dynasty && DAP[G.dynasty]) {
      var preset = DAP[G.dynasty];
      var dh = '<div style="font-size:0.7rem;">朝代 <b>' + _esc(G.dynasty) + '</b>：</div>';
      dh += '<table style="width:100%;font-size:0.68rem;margin-top:3px;"><tr style="color:var(--gold-500);"><td>阶段</td><td>皇威</td><td>皇权</td><td>民心</td><td>腐败</td><td>典故</td></tr>';
      ['founding','peak','decline','collapse'].forEach(function(k) {
        var p = preset[k]; if (!p) return;
        dh += '<tr><td>' + ({founding:'开国',peak:'盛世',decline:'衰世',collapse:'末世'}[k]) + '</td>';
        dh += '<td>' + p.hw + '</td><td>' + p.hq + '</td><td>' + p.mx + '</td><td>' + p.corr + '</td>';
        dh += '<td style="font-size:0.64rem;">' + _esc(p.name||'') + '</td></tr>';
      });
      dh += '</table>';
      html += _sec('朝代预设 · 参考', _esc(G.dynasty), dh);
    }

    _appendToBody('huangwei-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Wrap 原 render 函数
  // ═══════════════════════════════════════════════════════════════════

  function _wrap(fnName, extraFn) {
    var orig = global[fnName];
    if (typeof orig !== 'function') return;
    global[fnName] = function() {
      orig.apply(this, arguments);
      try { extraFn(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'drawer-final') : console.error('[drawer-final]', fnName, e); }
    };
  }

  function _installFinal() {
    _wrap('renderGuokuPanel', _extraForGuoku);
    _wrap('renderNeitangPanel', _extraForNeitang);
    _wrap('renderHukouPanel', _extraForHukou);
    _wrap('renderCorruptionPanel', _extraForLizhi);
    _wrap('renderMinxinPanel', _extraForMinxin);
    _wrap('renderHuangquanPanel', _extraForHuangquan);
    _wrap('renderHuangweiPanel', _extraForHuangwei);
  }

  // 立即安装（旧版 setTimeout 400ms 已移除 — 2026-04-24 · ext 已同步完成 Rich 替换）
  _installFinal();

  global.VarDrawersFinal = { install: _installFinal, VERSION: 1 };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
