// phase8-formal-topbar.js·顶栏 (var 印石·时间·物候·action tray)
// split from phase8-formal-bridge.js·2026-05-26
// paradigm·head alias 块 / body 0 改动

(function(){
  'use strict';

  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-topbar] TMPhase8FormalBridge not init·bridge.js 必须先 load');
    return;
  }

  var state = bridge._state || window.TM_PHASE8_FORMAL;

  // ── alias 块 ─────────────────────────────────────────────────────
  var esc = bridge._esc;
  var attr = bridge._attr;
  var asset = bridge._asset;
  var textById = bridge._textById;

  // ── module body (P3 Wave 2 迁入·2026-05-26) ──────────────────────

  function formatRendererDelta(v){
    var n = Number(v || 0);
    if (!isFinite(n) || n === 0) return '±0';
    var fmt = (typeof window._barFmtNum === 'function')
      ? window._barFmtNum(Math.abs(n))
      : String(Math.round(Math.abs(n)));
    return (n > 0 ? '+' : '-') + fmt;
  }

  function readRendererVarCards(){
    var configs = (window.TOP_BAR_VARS && window.TOP_BAR_VARS.length) ? window.TOP_BAR_VARS : null;
    var renderers = window._VAR_RENDERERS || null;
    if (!configs || !renderers) return null;
    var cards = [];
    configs.slice(0, 7).forEach(function(cfg){
      if (!cfg || !cfg.key || typeof renderers[cfg.key] !== 'function') return;
      try {
        var r = renderers[cfg.key]() || {};
        var subs = Array.isArray(r.subItems) ? r.subItems.map(function(s){
          return [
            s && s.k != null ? String(s.k) : '',
            s && s.v != null ? String(s.v) : '--',
            formatRendererDelta(s && s.d)
          ];
        }) : [];
        cards.push({
          key: cfg.key,
          name: cfg.name || cfg.key,
          value: r.value != null ? String(r.value) : '--',
          wide: subs.length > 0,
          subs: subs
        });
      } catch(_) {}
    });
    return cards.length ? cards : null;
  }

  function readOldVarCards(){
    var liveCards = readRendererVarCards();
    if (liveCards) return liveCards;
    var cards = Array.prototype.slice.call(document.querySelectorAll('#bar-vars .bar-var')).slice(0, 7);
    if (!cards.length) {
      return [
        { key:'guoku', name:'帑廪', value:'待核', wide:true, subs:[['银','--',''],['粮','--',''],['布','--','']] },
        { key:'neitang', name:'内帑', value:'待核', wide:true, subs:[['银','--',''],['粮','--',''],['珍','--','']] },
        { key:'hukou', name:'户口', value:'--' },
        { key:'lizhi', name:'吏治', value:'--' },
        { key:'minxin', name:'民心', value:'--' },
        { key:'huangquan', name:'皇权', value:'--' },
        { key:'huangwei', name:'皇威', value:'--' }
      ];
    }
    return cards.map(function(card){
      var name = (card.querySelector('.bar-var-name') || {}).textContent || card.getAttribute('data-var') || '变量';
      var subs = Array.prototype.slice.call(card.querySelectorAll('.bar-var-sub-item')).map(function(item){
        return [
          (item.querySelector('.sk') || {}).textContent || '',
          (item.querySelector('.sv') || {}).textContent || '',
          (item.querySelector('.sd') || {}).textContent || ''
        ];
      });
      return {
        key: card.getAttribute('data-var') || card.getAttribute('data-key') || '',
        name: name.replace(/\s+/g, ''),
        value: ((card.querySelector('.bar-var-value') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        wide: card.classList.contains('wide') || subs.length > 1,
        subs: subs
      };
    });
  }

  function iconForVar(key, name){
    var raw = String(key || name || '');
    if (/huangwei|wei|皇威|威/.test(raw)) return '威';
    if (/huangquan|quan|皇权|权/.test(raw)) return '权';
    if (/guoku|帑|库|银|粮/.test(raw)) return '银';
    if (/neitang|内/.test(raw)) return '帑';
    if (/hu|户/.test(raw)) return '户';
    if (/min|民/.test(raw)) return '民';
    if (/huang|权/.test(raw)) return '权';
    if (/wei|威/.test(raw)) return '威';
    if (/li|吏/.test(raw)) return '吏';
    return (String(name || '?').slice(0, 1) || '?');
  }

  function stockKey(label){
    var raw = String(label || '');
    if (/银|钱|qian|yin/.test(raw)) return 'qian';
    if (/粮|liang/.test(raw)) return 'liang';
    if (/布|bu/.test(raw)) return 'bu';
    if (/珍|zhen/.test(raw)) return 'zhen';
    return raw ? raw.replace(/\s+/g, '').slice(0, 8) : 'misc';
  }

  // 钱/粮/布 线描印章图标（对齐 preview·治本换旧字符徽；stroke=currentColor 承 icn-* 配色）
  function stockIconSvg(stock){
    if (stock === 'qian') return '<svg class="tb-stk-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6.6" stroke-width="1.5"/><rect x="5.2" y="5.2" width="5.6" height="5.6" rx="0.5" stroke-width="1.2"/></svg>';
    if (stock === 'liang') return '<svg class="tb-stk-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M8 15 L8 3" stroke-width="1.4"/><path d="M8 6 L4 4 M8 6 L12 4 M8 9 L4.5 7 M8 9 L11.5 7 M8 12 L5 10 M8 12 L11 10" stroke-width="1.1"/></svg>';
    if (stock === 'bu') return '<svg class="tb-stk-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M3 4 h10 v7 q-2.5 2.2 -5 0 q-2.5 -2.2 -5 0 z" stroke-width="1.3"/><path d="M8 4 L8 9" stroke-width="0.9"/></svg>';
    return null;
  }

  function iconClassFor(key, name){
    var raw = String(key || name || '');
    if (/huangwei|wei|皇威|威/.test(raw)) return 'icn-wei';
    if (/huangquan|quan|皇权|权/.test(raw)) return 'icn-huang';
    if (/qian|yin|银|钱/.test(raw)) return 'icn-yin';
    if (/liang|粮/.test(raw)) return 'icn-liang';
    if (/bu|布/.test(raw)) return 'icn-bu';
    if (/zhen|珍/.test(raw)) return 'icn-zhen';
    if (/hukou|hu|户/.test(raw)) return 'icn-hu';
    if (/lizhi|li|吏/.test(raw)) return 'icn-li';
    if (/minxin|min|民/.test(raw)) return 'icn-min';
    if (/huangquan|huang|权/.test(raw)) return 'icn-huang';
    if (/huangwei|wei|威/.test(raw)) return 'icn-wei';
    return '';
  }

  function trendClass(text){
    var raw = String(text || '');
    if (/[+＋▲↑升增盈]/.test(raw)) return 'up';
    if (/[-－−▼↓降减亏]/.test(raw)) return 'dn';
    return 'flat';
  }

  function topbarVarTone(v){
    var key = String((v && v.key) || '');
    var raw = String((v && v.value) || '');
    if (/lizhi/.test(key) || /弊|危|乱|低|亏|降|▼/.test(raw)) return ' warn';
    if (/huangwei/.test(key) || /好|稳|升|▲/.test(raw)) return ' good';
    return '';
  }

  function topbarTipIndex(key, fallback){
    var order = ['guoku', 'neitang', 'hukou', 'lizhi', 'minxin', 'huangquan', 'huangwei'];
    var idx = order.indexOf(String(key || ''));
    return idx >= 0 ? idx : fallback;
  }

  // 四官印·真伪双值（读 GM 同源；吏固定紫，民/权/威按段位告警色；真伪条 fill=真实值·白标=朝廷所见）
  // 与 tm-topbar-vars.js 的 _renderLizhi/_renderMinxin/_renderHuangquan/_renderHuangwei 读同一字段
  function powerSealData(key){
    try {
      var G = window.GM || {};
      if (key === 'lizhi') {
        var c = G.corruption || {};
        var t = typeof c.trueIndex === 'number' ? c.trueIndex : (typeof c.overall === 'number' ? c.overall : 0);
        var p = c.perceivedIndex !== undefined ? c.perceivedIndex : t;
        // 失真层保卫·未揭真时条 fill 用据奏(perc)·真浊度从顶栏消失(与旧 _renderLizhi shownIdx 严格一致)·未开失真=直通真值
        var _lzFlip = (typeof window._barFlipToPerceived === 'function') && window._barFlipToPerceived('corruption', 'index');
        var lzShown = _lzFlip ? p : t;
        var lab = lzShown < 25 ? '清明' : lzShown < 50 ? '尚可' : lzShown < 70 ? '渐弊' : lzShown < 85 ? '颓靡' : '积重';
        // 浊度→清明度(100-浊)，使与民/权/威同向(越高越好)
        return { ch:'吏', label:lab, trueV:Math.round(100 - lzShown), seenV:Math.round(100 - p), tone:'purple' };
      }
      if (key === 'minxin') {
        var m = G.minxin || {};
        var mt = typeof m.trueIndex === 'number' ? m.trueIndex : (typeof m.index === 'number' ? m.index : (typeof m.value === 'number' ? m.value : 0));
        var mp = m.perceivedIndex !== undefined ? m.perceivedIndex : mt;
        // 失真层保卫·未揭真时 label/fill 用据奏(mp)·真民心从顶栏消失(与旧 _renderMinxin shownIdx 严格一致)·未开失真=直通真值
        var _mxFlip = (typeof window._barFlipToPerceived === 'function') && window._barFlipToPerceived('minxin', 'index');
        var mxShown = _mxFlip ? mp : mt;
        return { ch:'民', label:String(Math.round(mxShown)), trueV:Math.round(mxShown), seenV:Math.round(mp), tone:(mxShown < 40 ? 'red' : mxShown < 55 ? 'amber' : '') };
      }
      if (key === 'huangquan') {
        var h = G.huangquan || {};
        var hi = h.index || 0;
        var hp = h.perceivedIndex !== undefined ? h.perceivedIndex : hi;   // 皇权多无 perceived，退化为单值
        return { ch:'权', label:String(Math.round(hi)), trueV:Math.round(hi), seenV:Math.round(hp), tone:(hi < 35 ? 'red' : hi < 50 ? 'amber' : '') };
      }
      if (key === 'huangwei') {
        var w = G.huangwei || {};
        var wi = w.index || 0;
        var wp = w.perceivedIndex !== undefined ? w.perceivedIndex : wi;
        return { ch:'威', label:String(Math.round(wi)), trueV:Math.round(wi), seenV:Math.round(wp), tone:(wi < 30 ? 'red' : wi < 50 ? 'amber' : (wi >= 90 ? 'red' : '')) };
      }
    } catch(_) {}
    return null;
  }

  // 户口丁数（读 GM 同源·_renderHukou 用 GM.population.national.ding）
  function _hukouDingHtml(){
    try {
      var p = (window.GM && GM.population && GM.population.national) || {};
      if (typeof p.ding === 'number' && p.ding > 0) {
        // 据奏口径·丁数经失真层 _barReported('national.ding',…,'renli')(与 _renderHukou 同源)·未开失真=真值直通
        var dingShown = (typeof window._barReported === 'function') ? window._barReported('national.ding', p.ding, 'bad', 'renli').shown : p.ding;
        var f = (typeof window._barFmtNum === 'function') ? window._barFmtNum(dingShown) : String(dingShown);
        return '<div class="tb-vding"><span class="k">丁</span>' + esc(f) + '</div>';
      }
    } catch(_e) {}
    return '';
  }
  // 牌匾装饰：四角回纹角花 + 描金双线内框 + 顶心云头冠（前置于变量输出·随渲染重建）
  var _TB_CORNER = '<svg viewBox="0 0 16 16" fill="none" stroke="#d6b66c" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14 V5 Q2 2 5 2 H14"/><path d="M6 14 V9 Q6 8 7 8 H11"/><circle cx="2" cy="14" r="1" fill="#d6b66c" stroke="none"/><circle cx="14" cy="2" r="1" fill="#d6b66c" stroke="none"/></svg>';
  var _TB_CREST = '<svg viewBox="0 0 30 11" fill="none" stroke="#d8b86a" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8.6 C11.7 8.6 10 6.4 10 4.6 C10 3 11.8 1.9 15 1.9 C18.2 1.9 20 3 20 4.6 C20 6.4 18.3 8.6 15 8.6Z"/><path d="M10 5 C6.3 5 4.4 6.6 1 6.1"/><path d="M20 5 C23.7 5 25.6 6.6 29 6.1"/><circle cx="1" cy="6.1" r="1" fill="#d8b86a" stroke="none"/><circle cx="29" cy="6.1" r="1" fill="#d8b86a" stroke="none"/></svg>';
  var _TB_DECO = '<i class="tb-finner" aria-hidden="true"></i><i class="tb-fdeco tb-tl" aria-hidden="true">' + _TB_CORNER + '</i><i class="tb-fdeco tb-tr" aria-hidden="true">' + _TB_CORNER + '</i><i class="tb-fdeco tb-bl" aria-hidden="true">' + _TB_CORNER + '</i><i class="tb-fdeco tb-br" aria-hidden="true">' + _TB_CORNER + '</i><i class="tb-crest" aria-hidden="true">' + _TB_CREST + '</i>';
  function renderPreviewTopbarVars(){
    var cards = readOldVarCards();
    var H = {};
    cards.forEach(function(v, idx){
      var tipIdx = topbarTipIndex(v.key, idx);
      var tipAttr = tipIdx >= 0 ? ' data-tip-idx="' + attr(tipIdx) + '"' : '';
      if (v.wide) {
        var subs = (v.subs && v.subs.length ? v.subs : [['值', v.value || '--', '']]).slice(0, 3);
        H[v.key] = '<div class="tb-var wide' + topbarVarTone(v) + '" data-key="' + attr(v.key) + '"' + tipAttr + '><div class="tb-vn">' + esc(v.name) + '</div><div class="tb-vsubs">' +
          subs.map(function(s){
            var stock = stockKey(s[0]);
            var cls = iconClassFor(stock, s[0]);
            var tr = trendClass(s[2]);
            var icnInner = stockIconSvg(stock) || esc(iconForVar(s[0], s[0]));
            return '<span class="tb-vs" data-stock="' + attr(stock) + '"><span class="icn ' + esc(cls) + '">' + icnInner + '</span><span class="sv"><b>' + esc(s[1] || '--') + '</b><span class="sd ' + tr + '">' + esc(s[2] || '±0') + '</span></span></span>';
          }).join('') + '</div></div>';
        return;
      }
      // 四官印（吏/民/权/威）→ 方印 + 真伪双值条
      var _seal = powerSealData(v.key);
      if (_seal) {
        var _bar = '';
        if (typeof _seal.trueV === 'number') {
          var _tp = Math.max(4, Math.min(100, _seal.trueV));
          var _sp = Math.max(2, Math.min(98, typeof _seal.seenV === 'number' ? _seal.seenV : _seal.trueV));
          _bar = '<span class="tsi-bar"><i class="tsi-true" style="width:' + _tp + '%"></i><i class="tsi-seen" style="left:' + _sp + '%"></i></span>';
        }
        H[v.key] = '<div class="tb-var tb-seal-idx tone-' + (_seal.tone || 'none') + '" data-key="' + attr(v.key) + '"' + tipAttr + '><span class="tsi-ch">' + esc(_seal.ch) + '</span><span class="tsi-val">' + esc(_seal.label) + '</span>' + _bar + '</div>';
        return;
      }
      // 户口（非宽·非印）：名 + 口值 + 丁数
      var _ding = (v.key === 'hukou') ? _hukouDingHtml() : '';
      H[v.key] = '<div class="tb-var' + topbarVarTone(v) + '" data-key="' + attr(v.key) + '"' + tipAttr + '><span class="icn ' + esc(iconClassFor(v.key, v.name)) + '">' + esc(iconForVar(v.key, v.name)) + '</span><div class="tb-vbody"><div class="tb-vn">' + esc(v.name) + '</div><div class="tb-vv">' + esc(v.value || '--') + '</div>' + _ding + '</div></div>';
    });
    // 按义分组：财赋(帑廪·内帑) ｜ 民数(户口) ｜ 治理(吏民权威)·组间金线 tb-gsep
    var GS = '<span class="tb-gsep" aria-hidden="true"></span>';
    var caifu = (H.guoku || '') + (H.neitang || '');
    var minshu = (H.hukou || '');
    var zhili = ['lizhi', 'minxin', 'huangquan', 'huangwei'].map(function(k){ return H[k] || ''; }).join('');
    var groups = [];
    if (caifu)  groups.push('<span class="tb-vgrp tb-grp-caifu">' + caifu + '</span>');
    if (minshu) groups.push('<span class="tb-vgrp tb-grp-minshu">' + minshu + '</span>');
    if (zhili)  groups.push('<span class="tb-vgrp tb-grp-seals">' + zhili + '</span>');
    if (!groups.length) {  // 兜底：分组为空则按固定顺序平铺（防 key 缺失）
      return _TB_DECO + ['guoku','neitang','hukou','lizhi','minxin','huangquan','huangwei'].map(function(k){ return H[k] || ''; }).join('');
    }
    return _TB_DECO + groups.join(GS);
  }

  function renderTimePopoverHtml(){
    var main = textById('bar-time-main', textById('bar-date', ''));
    var sub = textById('bar-time-sub', textById('bar-turn-text', ''));
    var rows = [];
    rows.push('<div class="tp-title">时历</div>');
    rows.push('<div class="tp-pin-hint">移开自动收起 · 点时间区钉住</div>');
    if (main) rows.push('<div class="tp-row"><span class="tp-k">主历</span><span class="tp-v">' + esc(main) + '</span></div>');
    if (sub) rows.push('<div class="tp-row"><span class="tp-k">公元</span><span class="tp-v">' + esc(String(sub).replace(/^\s*公元\s*/, '')) + '</span></div>');
    try {
      if (typeof calcDateFromTurn === 'function' && window.GM) {
        var di = calcDateFromTurn(GM.turn || 1);
        if (di && di.gzYearStr) rows.push('<div class="tp-row"><span class="tp-k">岁次</span><span class="tp-v">' + esc(di.gzYearStr) + ' 年</span></div>');
        if (di && di.season) rows.push('<div class="tp-row"><span class="tp-k">时令</span><span class="tp-v">' + esc(di.season) + '</span></div>');
        if (di && di.gzDayStr) rows.push('<div class="tp-row"><span class="tp-k">日辰</span><span class="tp-v">' + esc(di.gzDayStr) + ' 日</span></div>');
      }
    } catch(_) {}
    rows.push('<div class="tp-row"><span class="tp-k">节气</span><span class="tp-v">' + esc(textById('bar-weather-name', '节候')) + '</span></div>');
    rows.push('<div class="tp-row"><span class="tp-k">物候</span><span class="tp-v">' + esc(textById('bar-weather-desc', '物候未记')) + '</span></div>');
    rows.push('<div class="tp-row"><span class="tp-k">回合</span><span class="tp-v">第 ' + esc((window.GM && GM.turn) || 1) + ' 回合</span></div>');
    return rows.join('');
  }

  function renderWeatherPopoverHtml(){
    var name = textById('bar-weather-name', '节候');
    var desc = textById('bar-weather-desc', '物候未记');
    var seal = textById('bar-weather-seal', '时').slice(0, 1);
    var disaster = '风调雨顺';
    try {
      if (window.GM && GM.activeDisasters && GM.activeDisasters.length) {
        disaster = GM.activeDisasters[0].name || GM.activeDisasters[0].type || disaster;
      }
    } catch(_) {}
    return '<div class="wp-head"><span>' + esc(seal) + '</span><b>' + esc(name) + '</b></div>' +
      '<div class="tp-row"><span class="tp-k">物候</span><span class="tp-v">' + esc(desc) + '</span></div>' +
      '<div class="tp-row"><span class="tp-k">天象</span><span class="tp-v">' + esc(disaster) + '</span></div>' +
      '<div class="tp-pin-hint">移开自动收起 · 点节候区钉住</div>';
  }

  function actionTraySpecs(){
    return [
      ['zhao-btn','edict','action-edict-card.png','撰写诏书','御案','起草政令','撰写诏书·起草政令'],
      ['zhao-btn-2','memorial','action-memorial-card.png','百官奏疏','章奏','御览奏报','百官奏疏·御览臣工奏报'],
      ['zhao-btn-3','letter','action-letter-card.png','鸿雁传书','驿传','遣使通信','鸿雁传书·遣使通信'],
      ['zhao-btn-4','records','action-annals-card.png','史官实录','史馆','回合档案','史官实录·阅览回合档案']
    ];
  }

  function renderActionTrayHtml(){
    return actionTraySpecs().map(function(x){
      return '<button type="button" id="' + esc(x[0]) + '" class="zb-btn zb-img-btn" data-tmf-action="' + esc(x[1]) + '" title="' + esc(x[6]) + '" aria-label="' + esc(x[3]) + '">' +
        '<img class="zb-img" src="' + esc(asset(x[2])) + '" alt="">' +
        '<span class="zb-action-copy"><span class="zb-action-kicker">' + esc(x[4]) + '</span><span class="zb-action-title">' + esc(x[3]) + '</span><span class="zb-action-sub">' + esc(x[5]) + '</span></span>' +
        '</button>';
    }).join('');
  }

  // ── public API attach ─────────────────────────────────────────────
  bridge.topbar = bridge.topbar || {};
  bridge.topbar.renderPreviewTopbarVars = renderPreviewTopbarVars;
  bridge.topbar.renderTimePopoverHtml = renderTimePopoverHtml;
  bridge.topbar.renderWeatherPopoverHtml = renderWeatherPopoverHtml;
  bridge.topbar.actionTraySpecs = actionTraySpecs;
  bridge.topbar.renderActionTrayHtml = renderActionTrayHtml;

  // 兼容·bridge.js 内部 hoisted 引用全部转向 bridge.topbar.*
  // (bridge.js 中原 def 已删除·callsite L911/L1352/L1182/L1197 改 bridge.topbar.X())
})();
