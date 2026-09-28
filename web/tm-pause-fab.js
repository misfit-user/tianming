// @ts-check
// ============================================================
// tm-pause-fab.js — 御案正式界面「宝相团花」悬浮设置/暂停按钮
//   · 默认锚在御案顶栏时间 #tmf-tb-time 的【右下方】
//   · 可拖动重定位（拖后记住位置·localStorage·按舞台分数存·跨缩放不变）
//   · 右键／长按御案时间归位；拖动、重载、窗口变化均限制在可见舞台内
//   · 点击（未拖动）= 按 Esc：openPause()/closePause() 切换暂停菜单
//   · 挂 document.body（fixed-fit 舞台）+ 高 z-index → 压住地图 mapwrap·命中可点
//   · 仅游戏运行中（GM.running）且御案时间在场时显示
//   · 不依赖 TM_ICONS / styles.css，样式与铜质图标全部自带
//   · 注：老 #bar 顶栏在御案被 `body.tm-phase8-formal #bar{display:none}` 杀死·不可用
// ============================================================
(function () {
  'use strict';
  var FAB_ID = 'tm-pause-fab';
  var TIME_ID = 'tmf-tb-time';
  var SIZE = 48;
  var POS_KEY = 'tm_pause_fab_pos';   // 存舞台分数 {fx,fy}

  function rosetteSVG() {
    var big = 'M32 5 C25 13.5 25 22 32 28.5 C39 22 39 13.5 32 5 Z';
    var sml = 'M32 13 C28.7 17.5 28.7 22.5 32 26.5 C35.3 22.5 35.3 17.5 32 13 Z';
    var s = '<svg viewBox="0 0 64 64" aria-hidden="true">';
    s += '<defs>'
      + '<linearGradient id="tmFabBz" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#ecd9a0"/><stop offset=".32" stop-color="#cdae64"/>'
      + '<stop offset=".64" stop-color="#8f7230"/><stop offset="1" stop-color="#574119"/></linearGradient>'
      + '<linearGradient id="tmFabHi" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#fbf1cf"/><stop offset="1" stop-color="#d9bd7c"/></linearGradient></defs>';
    var i;
    s += '<g>';
    for (i = 0; i < 8; i++) s += '<path d="' + sml + '" fill="url(#tmFabBz)" opacity=".6" transform="rotate(' + (i * 45 + 22.5) + ' 32 32)"/>';
    s += '</g><g>';
    for (i = 0; i < 8; i++) {
      s += '<path d="' + big + '" fill="url(#tmFabBz)" stroke="#3a2c12" stroke-width=".7" opacity="' + (i % 2 ? '.84' : '.98') + '" transform="rotate(' + (i * 45) + ' 32 32)"/>';
      s += '<path d="M32 9 L32 25" fill="none" stroke="url(#tmFabHi)" stroke-width=".9" opacity=".5" stroke-linecap="round" transform="rotate(' + (i * 45) + ' 32 32)"/>';
    }
    s += '</g>';
    s += '<circle cx="32" cy="32" r="6.2" fill="#19120a" stroke="url(#tmFabBz)" stroke-width="2.7"/>';
    s += '<circle cx="32" cy="32" r="3.4" fill="none" stroke="url(#tmFabBz)" stroke-width="1" opacity=".55"/>';
    s += '<circle cx="30.6" cy="30.6" r="1.9" fill="url(#tmFabHi)"/>';
    s += '<circle cx="32" cy="32" r="28" fill="none" stroke="url(#tmFabBz)" stroke-width="1" opacity=".38"/>';
    s += '</svg>';
    return s;
  }

  function injectStyle() {
    if (document.getElementById('tm-pause-fab-style')) return;
    var css =
      '#' + FAB_ID + '{position:absolute;top:60px;left:0;width:' + SIZE + 'px;height:' + SIZE + 'px;'
      + 'border-radius:50%;display:none;place-items:center;cursor:grab;padding:0;z-index:1000;'
      + 'touch-action:none;-webkit-user-select:none;user-select:none;'
      + 'background:radial-gradient(circle at 36% 30%,#2c2417,#16110b 74%);border:1px solid var(--gold-d,#8a6d2b);'
      + 'box-shadow:0 4px 14px rgba(0,0,0,.55),inset 0 1px 0 rgba(212,190,122,.10);'
      + 'transition:box-shadow .3s,border-color .3s;'
      + '-webkit-app-region:no-drag;}'
      + '#' + FAB_ID + '.on{display:grid;}'
      + '#' + FAB_ID + '.tm-dragging{cursor:grabbing;transition:none;}'
      + '#' + FAB_ID + '::after{content:"";position:absolute;inset:-4px;border-radius:50%;'
      + 'border:1px solid rgba(184,154,83,.18);pointer-events:none;transition:.3s;}'
      + '#' + FAB_ID + ' svg{width:30px;height:30px;display:block;transition:transform .6s cubic-bezier(0,0,.2,1);pointer-events:none;}'
      + '#' + FAB_ID + ':hover{border-color:var(--gold-l,#d4be7a);'
      + 'box-shadow:0 6px 20px rgba(0,0,0,.6),0 0 18px rgba(184,154,83,.32),inset 0 1px 0 rgba(212,190,122,.18);}'
      + '#' + FAB_ID + ':hover::after{border-color:rgba(212,190,122,.45);inset:-5px;}'
      + '#' + FAB_ID + ':hover svg{transform:rotate(45deg);}'
      + '#' + FAB_ID + '.is-open{border-color:var(--gold-l,#d4be7a);'
      + 'box-shadow:0 0 0 3px rgba(184,154,83,.16),0 0 22px rgba(184,154,83,.4);}'
      + '#' + FAB_ID + '.is-open::after{border-color:rgba(212,190,122,.55);}';
    var st = document.createElement('style');
    st.id = 'tm-pause-fab-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  var btn = null, wired = false;
  var userPositioned = false, posFx = 0, posFy = 0;   // 拖后记住的舞台分数
  var justDragged = false, dragging = false;

  function loadPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && typeof o.fx === 'number' && typeof o.fy === 'number' && isFinite(o.fx) && isFinite(o.fy)) {
        posFx = o.fx; posFy = o.fy; userPositioned = true;
      }
    } catch (e) {}
  }
  function savePos(left, top, hostW, hostH) {
    if (!hostW || !hostH) return;
    posFx = left / hostW; posFy = top / hostH; userPositioned = true;
    try { localStorage.setItem(POS_KEY, JSON.stringify({ fx: posFx, fy: posFy })); } catch (e) {}
  }

  function ensureAppended() {
    if (btn && btn.parentElement !== document.body) document.body.appendChild(btn);
  }

  function updateVis() {
    if (!btn) return;
    ensureAppended();
    var run = (typeof window.GM !== 'undefined' && window.GM && window.GM.running);
    var time = document.getElementById(TIME_ID), inYuan = !!time;
    if (time && !time.title) time.title = '右键或长按：将悬浮设置按钮归位';
    var inGame = isGameSurfaceVisible();
    btn.classList.toggle('on', !!(run && inYuan && inGame));
  }

  function isGameSurfaceVisible() {
    var game = document.getElementById('G');
    if (!game) return false;
    if (typeof window.getComputedStyle === 'function') {
      return window.getComputedStyle(game).display !== 'none';
    }
    return game.style.display !== 'none';
  }

  // 将真实可见视口投回舞台坐标，兼容 fixed-fit 缩放、留黑边与软键盘缩小视口。
  function geometry() {
    var host = btn.offsetParent || document.body;
    var hr = host.getBoundingClientRect();
    var hw = host.offsetWidth || window.innerWidth, hh = host.offsetHeight || window.innerHeight;
    var sx = hr.width / hw || 1, sy = hr.height / hh || sx;
    var vv = window.visualViewport, vx = vv ? vv.offsetLeft : 0, vy = vv ? vv.offsetTop : 0;
    var vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
    var minX = Math.ceil(Math.max(0, (vx - hr.left) / sx) + 4);
    var minY = Math.ceil(Math.max(0, (vy - hr.top) / sy) + 4);
    return {
      hr: hr, hw: hw, hh: hh, sx: sx, sy: sy, minX: minX, minY: minY,
      maxX: Math.max(minX, Math.floor(Math.min(hw, (vx + vw - hr.left) / sx) - (btn.offsetWidth || SIZE) - 4)),
      maxY: Math.max(minY, Math.floor(Math.min(hh, (vy + vh - hr.top) / sy) - (btn.offsetHeight || SIZE) - 4))
    };
  }
  function setPosition(left, top, g) {
    left = Math.max(g.minX, Math.min(g.maxX, Math.round(left)));
    top = Math.max(g.minY, Math.min(g.maxY, Math.round(top)));
    btn.style.left = left + 'px'; btn.style.top = top + 'px';
    return { left: left, top: top };
  }

  // 锚位：拖过则按记忆分数·否则默认御案时间「右下方」；定时刷新不可抢正在拖的按钮。
  function place() {
    if (!btn || dragging) return;
    var g = geometry();
    if (userPositioned) {
      var left = posFx * g.hw, top = posFy * g.hh, p = setPosition(left, top, g);
      if (Math.abs(p.left - left) > 0.5 || Math.abs(p.top - top) > 0.5) savePos(p.left, p.top, g.hw, g.hh);
      return;
    }
    var time = document.getElementById(TIME_ID);
    if (!time) return;
    var tr = time.getBoundingClientRect();
    if (!tr.width) return;
    // 默认：右缘对齐时间右缘、略低 → 时间「右下方」
    setPosition((tr.right - g.hr.left) / g.sx - SIZE + 2, (tr.bottom - g.hr.top) / g.sy + 6, g);
  }

  function resetPos() {
    userPositioned = false;
    try { localStorage.removeItem(POS_KEY); } catch (e) {}
    place();
  }

  // 拖动：pointer 拖动重定位·与点击区分（动了算拖·没动算点）
  function setupDrag() {
    var moved = false, sx = 0, sy = 0, sl = 0, st = 0, scaleX = 1, scaleY = 1, pointerId = null;
    btn.addEventListener('pointerdown', function (e) {
      if (dragging || e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      pointerId = e.pointerId;
      var g = geometry(), r = btn.getBoundingClientRect();
      scaleX = g.sx; scaleY = g.sy;
      sl = (r.left - g.hr.left) / scaleX; st = (r.top - g.hr.top) / scaleY;
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault(); e.stopPropagation();
    });
    btn.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var ddx = e.clientX - sx, ddy = e.clientY - sy;
      if (!moved && Math.abs(ddx) + Math.abs(ddy) > 4) { moved = true; btn.classList.add('tm-dragging'); }
      if (!moved) return;
      setPosition(sl + ddx / scaleX, st + ddy / scaleY, geometry());
      e.preventDefault();
    });
    function end(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false; btn.classList.remove('tm-dragging');
      try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
      if (moved) {
        justDragged = true;                 // 抑制随后的 click
        var g = geometry(), p = setPosition(parseFloat(btn.style.left) || 0, parseFloat(btn.style.top) || 0, g);
        savePos(p.left, p.top, g.hw, g.hh);
        setTimeout(function () { justDragged = false; }, 60);
      }
    }
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('lostpointercapture', end);
  }

  function wireOnce() {
    if (wired) return;
    wired = true;
    var pb = document.getElementById('pause-bg');
    if (pb && window.MutationObserver) {
      new MutationObserver(function () {
        if (btn) btn.classList.toggle('is-open', pb.classList.contains('show'));
      }).observe(pb, { attributes: true, attributeFilter: ['class'] });
    }
    if (typeof window.renderGameState === 'function') {
      var _rgs = window.renderGameState;
      window.renderGameState = function () {
        var r = _rgs.apply(this, arguments);
        try { updateVis(); place(); } catch (e) {}
        return r;
      };
    }
    // 委托监听：正式界面的时间栏可能被重建；手机长按由 tm-touch-gestures 派发同一个事件。
    document.addEventListener('contextmenu', function (e) {
      var target = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement);
      if (!target || !target.closest('#' + TIME_ID) || !window.GM || !window.GM.running || !isGameSurfaceVisible()) return;
      e.preventDefault(); e.stopPropagation(); resetPos();
    });
    function viewportChanged() {
      // fixed-fit 同一 resize 中先排队更新舞台 transform，下一帧再读取新坐标。
      if (window.requestAnimationFrame) window.requestAnimationFrame(place); else setTimeout(place, 0);
    }
    window.addEventListener('resize', viewportChanged);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', viewportChanged);
      window.visualViewport.addEventListener('scroll', viewportChanged);
    }
    setInterval(function () { updateVis(); place(); }, 1500);
  }

  function mount() {
    if (!document.body) return false;
    if (!btn) {
      injectStyle();
      loadPos();
      btn = document.createElement('button');
      btn.id = FAB_ID;
      btn.type = 'button';
      btn.setAttribute('aria-label', '设置·暂停（可拖动）');
      btn.title = '设置·暂停（Esc）· 可拖动 · 右键或长按时间栏归位';
      btn.innerHTML = rosetteSVG();
      btn.addEventListener('click', function (e) {
        if (justDragged) { justDragged = false; e.preventDefault(); return; }  // 拖动结束的 click 不触发
        e.preventDefault();
        var pb2 = document.getElementById('pause-bg');
        if (pb2 && pb2.classList.contains('show')) {
          if (typeof window.closePause === 'function') window.closePause();
        } else {
          if (typeof window.openPause === 'function') window.openPause();
        }
      });
      setupDrag();
    }
    document.body.appendChild(btn);
    wireOnce();
    updateVis(); place();
    return true;
  }

  function init() { mount(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.TM = window.TM || {};
  window.TM.pauseFab = {
    init: init, place: place,
    refresh: function () { updateVis(); place(); },
    resetPos: resetPos
  };
})();
