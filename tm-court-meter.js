// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-court-meter.js — 勤政/怠政 朝会追踪 + post-turn 朝会决策
//
// R96 从 tm-endturn.js 抽出·原 L12896-13084 (189 行)
// 8 函数：recordCourtHeld / _settleCourtMeter /
//        _showPostTurnCourtPromptAndStartEndTurn / _postTurnCourtChoose /
//        _showPostTurnCourtBanner / _updatePostTurnCourtBanner / _hidePostTurnCourtBanner /
//        _onPostTurnCourtEnd (async)
//
// 外部调用：recordCourtHeld 和 _onPostTurnCourtEnd 被 tm-chaoyi-keju.js 调用
// 依赖外部：GM / P / _dbg 等 window 全局
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

// ═══ 勤政 / 怠政 累计 ═══
//   每次开朝（in-turn 或 post-turn）调用此函数增量 thisTurnCount
//   endTurn 时结算：count>=2 diligentStreak++/missedStreak=0, count==0 missedStreak++/diligentStreak=0
function recordCourtHeld(opts) {
  if (!GM._courtMeter) GM._courtMeter = { thisTurnCount: 0, missedStreak: 0, diligentStreak: 0, lastCourtTurn: 0 };
  var m = GM._courtMeter;
  // targetTurn 归属：post-turn 归下回合，in-turn 归本回合
  var targetTurn = (opts && opts.isPostTurn) ? (GM.turn + 1) : GM.turn;
  if (!m.byTurn) m.byTurn = {};
  m.byTurn[targetTurn] = (m.byTurn[targetTurn] || 0) + 1;
  m.lastCourtTurn = targetTurn;
}

// endTurn 末尾结算 streak
function _settleCourtMeter() {
  if (!GM._courtMeter) GM._courtMeter = { thisTurnCount: 0, missedStreak: 0, diligentStreak: 0, lastCourtTurn: 0, byTurn: {} };
  var m = GM._courtMeter;
  if (!m.byTurn) m.byTurn = {};
  var curCount = m.byTurn[GM.turn] || 0;
  m.thisTurnCount = curCount;
  if (curCount === 0) {
    m.missedStreak = (m.missedStreak || 0) + 1;
    m.diligentStreak = 0;
  } else if (curCount >= 2) {
    m.diligentStreak = (m.diligentStreak || 0) + 1;
    m.missedStreak = 0;
  } else {
    // 正好 1 次——中庸，两 streak 都不增
    m.missedStreak = Math.max(0, (m.missedStreak || 0) - 0);
    m.diligentStreak = Math.max(0, (m.diligentStreak || 0) - 0);
  }
  // 阈值触发（连续 3 回合）
  if (m.missedStreak >= 3 && !m._missedAlerted) {
    if (GM.vars) {
      if (GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') GM.vars['皇威'].value = Math.max(0, GM.vars['皇威'].value - 5);
    }
    (GM.chars || []).forEach(function(c) {
      if (c && c.alive !== false && (c.wuchang && (c.wuchang['义'] || 0) > 60)) {
        c.loyalty = Math.max(0, (c.loyalty || 50) - 2);
        if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '陛下连三月不视朝·忧国臣子皆患之', '忧', 6);
      }
    });
    if (typeof addEB === 'function') addEB('政局', '连三月不视朝·皇威-5·贤臣谏疏云集');
    m._missedAlerted = true;
    m._diligentAlerted = false;
  } else if (m.diligentStreak >= 3 && !m._diligentAlerted) {
    if (GM.vars) {
      if (GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') GM.vars['皇威'].value = Math.min(100, GM.vars['皇威'].value + 3);
    }
    (GM.chars || []).forEach(function(c) {
      if (c && c.alive !== false && (c.integrity || 50) > 60) {
        c.loyalty = Math.min(100, (c.loyalty || 50) + 1);
        if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '陛下勤勉·连三月双朝议事·臣等感佩', '敬', 5);
      }
    });
    if (typeof addEB === 'function') addEB('政局', '连三月勤政双朝·皇威+3·贤臣归心');
    m._diligentAlerted = true;
    m._missedAlerted = false;
  }
  // 清理过旧的 byTurn 记录
  var cur = GM.turn;
  Object.keys(m.byTurn).forEach(function(k) { if (+k < cur - 8) delete m.byTurn[k]; });
}

// ═══ 后朝并发机制 ═══
//   · 过回合时弹 "是否例行朝会" → 选是：并发开后朝（targetTurn=GM.turn+1）+ AI 推演
//   · AI 先完：暂存 payload，绿 banner 提示；朝会毕时弹史记
//   · 朝会先完：若 AI 仍在跑，自然过渡到加载进度
function _showPostTurnCourtPromptAndStartEndTurn() {
  if (GM.busy) return;
  var _bg = document.createElement('div');
  _bg.className = 'modal-bg show';
  _bg.id = 'post-turn-court-prompt';
  _bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:5000;';
  _bg.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:10px;padding:1.4rem 1.6rem;min-width:360px;max-width:460px;text-align:center;">'
    + '<div style="font-size:1.05rem;color:var(--gold);font-weight:700;margin-bottom:0.7rem;">\u3014\u4ECA\u56DE\u5408\u5DF2\u7EC8\uFF0C\u6B32\u5F00\u4F8B\u884C\u671D\u4F1A\uFF1F\u3015</div>'
    + '<div style="font-size:0.8rem;color:var(--txt-s);line-height:1.7;margin-bottom:1.1rem;text-align:left;padding:0 0.4rem;">'
      + '\u00B7 \u9009\u5F00\u671D\uFF1A\u6709\u53F8\u540E\u53F0\u63A8\u6F14\u540C\u65F6\uFF0C\u5F00\u6B21\u6708\u6714\u671D\uFF1B\u672C\u671D\u4F1A\u7B97\u6B21\u56DE\u5408\u7684\u671D\u4F1A\uFF0C\u5F71\u54CD\u6B21\u56DE\u5408\u63A8\u6F14\n'
      + '\u00B7 \u9009\u5426\uFF1A\u76F4\u63A5\u7B49\u5F85\u63A8\u6F14\u5B8C\u6BD5\uFF0C\u4E0D\u5F00\u671D\n'
      + '\u00B7 \u52E4\u653F\u6807\u51C6\uFF1A\u6BCF\u56DE\u5408\u4EFB\u4E00\u6B21\u671D\u4F1A\uFF08\u6708\u521D\u6714\u671D\u6216\u6708\u4E2D\u5E38\u671D\uFF09\u5373\u8BA1\u52E4'
    + '</div>'
    + '<div style="display:flex;gap:0.6rem;justify-content:center;">'
      + '<button class="bt bp" style="padding:8px 24px;" onclick="_postTurnCourtChoose(true)">\uD83D\uDCDC \u5F00\u6714\u671D</button>'
      + '<button class="bt" style="padding:8px 24px;" onclick="_postTurnCourtChoose(false)">\u9759\u5019\u6709\u53F8</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(_bg);
}

function _postTurnCourtChoose(openCourt) {
  var _bg = _$('post-turn-court-prompt');
  if (_bg) _bg.remove();
  if (openCourt) {
    // 先标记 courtDone=false 并启动 AI 推演（后台）
    GM._pendingShijiModal = { aiReady: false, courtDone: false, payload: null };
    GM._isPostTurnCourt = true;
    // 并发：启动 endTurn 主流程（不 await·让 AI 在后台跑）
    _endTurnInternal();
    // 同时开朝——先打开 chaoyi-modal 再直跳常朝准备
    setTimeout(function(){
      try {
        // 朔朝·直接走 v3 _cc3_open（与早朝完全一致流程·区别仅在 GM._isPostTurnCourt 标志触发的标题/时间/system prompt）
        // 频次记录（post-turn 不受 in-turn 限制·_cc3_open 内有 _isPostTurnCourt 判定跳过频率闸）
        if (!GM._chaoyiCount) GM._chaoyiCount = {};
        if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
        if (typeof _cc3_open === 'function') {
          _cc3_open();
        } else if (typeof openChaoyi === 'function') {
          // 兜底·v3 未加载时退到 v1 模式选择页
          openChaoyi();
        }
        if (false && typeof openChaoyi === 'function') {
          // 旧路径已废·v2 _cc2_openPrepareDialog 已物理删除·跳过
          if (false) {} // sentinel·保留旧代码块结构
        }
        // 2) CY 设置为常朝模式（兼容兜底路径）
        if (typeof CY !== 'undefined') { CY.mode = 'changchao'; CY.topic = ''; }
        // 3) 不再覆盖 cy-body·v3 自有 modal
        var cyBody = null;
        if (cyBody) cyBody.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);padding:1rem;font-size:0.78rem;">\u3014\u6714\u671D\u00B7\u6B21\u6708\u521D\u671D\u3015\u7B79\u5907\u4E2D\u2026\u2026</div>';
        // _cc2_openPrepareDialog 已物理删除·此调用永不执行
        // 4) 添加底栏进度 banner
        if (typeof _showPostTurnCourtBanner === 'function') _showPostTurnCourtBanner();
      } catch(_e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'postTurnCourt] openFailed:') : console.error('[postTurnCourt] openFailed:', _e); }
    }, 200);
  } else {
    // 不开朝——直接跑 endTurn，显示加载条
    GM._pendingShijiModal = { aiReady: false, courtDone: true, payload: null };
    GM._isPostTurnCourt = false;
    _endTurnInternal();
  }
}

// 底栏进度 banner（朝会期间常驻）
function _showPostTurnCourtBanner() {
  var _existing = _$('post-turn-court-banner');
  if (_existing) _existing.remove();
  var el = document.createElement('div');
  el.id = 'post-turn-court-banner';
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:4900;background:linear-gradient(90deg,rgba(184,154,83,0.18),rgba(184,154,83,0.08));border-top:2px solid var(--gold-d);padding:6px 14px;display:flex;align-items:center;gap:10px;font-size:0.76rem;color:var(--gold);';
  el.innerHTML = '<span style="font-weight:700;">〔朔朝〕</span><span id="post-turn-court-banner-msg">有司推演中……本朝决议施于次回合</span><span style="margin-left:auto;font-size:0.68rem;color:var(--txt-d);">AI 后台推演</span>';
  document.body.appendChild(el);
}

function _updatePostTurnCourtBanner(status) {
  var msgEl = _$('post-turn-court-banner-msg');
  if (!msgEl) return;
  if (status === 'aiReady') {
    msgEl.textContent = '\u2713 \u6709\u53F8\u63A8\u6F14\u5DF2\u6BD5\u00B7\u672C\u671D\u4F1A\u7ED3\u675F\u540E\u81EA\u52A8\u542F\u53F2\u8BB0';
    msgEl.style.color = 'var(--green,#6aa88a)';
  }
}

function _hidePostTurnCourtBanner() {
  var _el = _$('post-turn-court-banner');
  if (_el) _el.remove();
}

// 朝会结束时调用——顺序：先弹史记，其他模态（keju/事件等）排队其后
async function _onPostTurnCourtEnd() {
  if (!GM._pendingShijiModal) { GM._isPostTurnCourt = false; return; }
  _hidePostTurnCourtBanner();
  if (!(GM._pendingShijiModal.aiReady && GM._pendingShijiModal.payload)) {
    // AI 还没好——关闭后朝标志让后续 AI 完成时直接 render
    GM._isPostTurnCourt = false;
    GM._pendingShijiModal.courtDone = true;
    showLoading('\u5019\u6709\u53F8\u63A8\u6F14\u2026\u2026', 50);
    return;
  }
  var _payload = GM._pendingShijiModal.payload;
  var _deferredPhase5 = GM._pendingShijiModal.deferredPhase5;
  GM._pendingShijiModal.payload = null;
  GM._pendingShijiModal.aiReady = false;
  GM._pendingShijiModal.deferredPhase5 = null;

  // 1) 先弹史记（临时放开 courtDone，让 showTurnResult 直通）
  GM._pendingShijiModal.courtDone = true;
  try { _endTurn_render.apply(null, _payload); } catch(_e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'postTurnCourt] render:') : console.error('[postTurnCourt] render:', _e); }

  // 2) 重新启用"队列模式"，让 phase5 产生的模态都进队列·不立即弹
  GM._pendingShijiModal.courtDone = false; // 假装朝会还在
  if (typeof _deferredPhase5 === 'function') {
    try { await _deferredPhase5(); } catch(_ph5){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ph5, 'postTurnCourt] deferredPhase5:') : console.warn('[postTurnCourt] deferredPhase5:', _ph5); }
  }

  // 3) 收官：恢复正常状态 + 延迟 1s 后按队列依次弹出其他模态（给用户看史记的时间）
  GM._isPostTurnCourt = false;
  GM._pendingShijiModal.courtDone = true;
  setTimeout(function(){
    try { if (typeof _flushPostTurnModalQueue === 'function') _flushPostTurnModalQueue(); } catch(_fq){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fq, 'postTurnCourt] flush:') : console.warn('[postTurnCourt] flush:', _fq); }
  }, 1000);
}
