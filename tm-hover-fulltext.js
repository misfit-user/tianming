/* tm-hover-fulltext.js — 全局「悬停显示完整文本」
 * 背景：游戏大量 UI 用 CSS 省略号（text-overflow:ellipsis / -webkit-line-clamp）截断文本，
 *       末尾一个「…」，玩家看不到完整内容。此模块加一个全局委托的悬停浮层：
 *       鼠标移到「确实被截断」的元素上时，弹出其完整文本。
 *
 * 设计：
 *  - 事件委托挂 document（capture）→ 覆盖所有现有 + 未来重渲染出的元素，零改各处渲染代码。
 *  - 触发条件（自动）：元素被 CSS 省略号/多行 clamp 截断，且实际溢出（scrollWidth>clientWidth
 *    或 scrollHeight>clientHeight），且【没有原生 title】（有 title 的交给浏览器原生提示，避免双重弹窗）。
 *  - 触发条件（显式）：任意元素带 [data-fulltip]（供个别 JS 手动截断处主动挂完整文本；独占属性名，
 *    不复用 FAB 的 data-tip，避免冲突）。
 *  - 仅在【有鼠标（hover:hover）】的设备安装 → 纯触屏（手机/平板）不装，绝不干扰长按手势。
 *  - 浮层 pointer-events:none → 永不吃鼠标、不闪、不挡点击。z-index 顶置于一切之上。
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__tmFulltipInstalled) return;            // 幂等：只装一次
  // 门控：仅【纯触屏】设备（既无可悬停输入、又无精细指针）跳过 → 手机不装、不扰长按手势。
  // 桌面 / 桌面带触屏 / 无头 Chromium 都有 fine 指针或 any-hover → 正常安装。
  try {
    var mm = window.matchMedia;
    if (mm && !mm('(any-hover: hover)').matches && !mm('(any-pointer: fine)').matches) return;
  } catch (e) { /* 老浏览器无 matchMedia：保守起见仍安装（桌面为主） */ }
  window.__tmFulltipInstalled = true;

  var SHOW_DELAY = 140;   // 悬停多久后弹出（ms）·避免划过时闪
  var MAX_DEPTH = 6;      // mouseover 命中子节点时，向上找截断祖先的最大层数
  var tip = null;         // 浮层元素
  var curEl = null;       // 当前正在展示（或排队展示）的目标元素
  var showTimer = null;

  // ── 注入浮层样式（不碰 owner 脏的 styles.css）──
  function ensureStyle() {
    if (document.getElementById('tm-fulltip-css')) return;
    var s = document.createElement('style');
    s.id = 'tm-fulltip-css';
    s.textContent =
      '#tm-fulltip{position:fixed;left:0;top:0;z-index:2147483000;max-width:min(480px,92vw);' +
      'max-height:60vh;overflow:hidden;padding:7px 11px;border-radius:7px;' +
      'background:rgba(28,24,18,.97);color:#f3ead6;font-size:13px;line-height:1.55;' +
      'box-shadow:0 6px 22px rgba(0,0,0,.45);border:1px solid rgba(190,158,104,.4);' +
      'white-space:normal;word-break:break-word;pointer-events:none;opacity:0;' +
      'transform:translateY(2px);transition:opacity .1s ease,transform .1s ease;' +
      'font-family:inherit;-webkit-font-smoothing:antialiased;}' +
      '#tm-fulltip.on{opacity:1;transform:translateY(0);}';
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureTip() {
    if (tip && tip.isConnected) return tip;
    ensureStyle();
    tip = document.createElement('div');
    tip.id = 'tm-fulltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    return tip;
  }

  // 判定单个元素是否「被截断需要展开」，返回 {full, el} 或 null
  function truncInfo(el) {
    if (!el || el.nodeType !== 1) return null;
    // 显式接口：任意元素主动挂 data-fulltip=完整文本
    if (el.hasAttribute('data-fulltip')) {
      var f = el.getAttribute('data-fulltip');
      return (f && f.trim()) ? { full: f.trim(), el: el } : null;
    }
    // 输入类不处理（其截断由用户可编辑）
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return null;
    var cs;
    try { cs = window.getComputedStyle(el); } catch (e) { return null; }
    if (!cs) return null;
    // 单行省略号：text-overflow:ellipsis 且横向溢出
    var to = cs.textOverflow || '';
    var horiz = to.indexOf('ellipsis') !== -1 && el.scrollWidth > el.clientWidth + 1;
    // 多行截断：-webkit-line-clamp 且纵向溢出
    var clamp = cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp') || '';
    var vert = clamp && clamp !== 'none' && parseInt(clamp, 10) > 0 &&
               el.scrollHeight > el.clientHeight + 1;
    if (!horiz && !vert) return null;
    // 已有原生 title → 交给浏览器原生提示，避免双重弹窗
    if ((el.getAttribute('title') || '').trim()) return null;
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t ? { full: t, el: el } : null;
  }

  // 从 mouseover 命中节点向上找第一个「被截断」的祖先
  function findTrunc(node) {
    var el = node, depth = 0;
    while (el && el !== document.body && el.nodeType && depth < MAX_DEPTH) {
      var info = truncInfo(el);
      if (info) return info;
      el = el.parentNode;
      depth++;
    }
    return null;
  }

  function place(el) {
    var t = ensureTip();
    var r;
    try { r = el.getBoundingClientRect(); } catch (e) { return; }
    var vw = window.innerWidth, vh = window.innerHeight;
    // 先量浮层尺寸（此时已填内容、display 生效）
    var tw = t.offsetWidth, th = t.offsetHeight;
    var gap = 6;
    // 默认放元素下方左对齐；下方放不下则放上方
    var top = r.bottom + gap;
    if (top + th > vh - 6) {
      var above = r.top - gap - th;
      top = above >= 6 ? above : Math.max(6, vh - th - 6);
    }
    var left = r.left;
    if (left + tw > vw - 6) left = vw - tw - 6;
    if (left < 6) left = 6;
    t.style.left = Math.round(left) + 'px';
    t.style.top = Math.round(top) + 'px';
  }

  function doShow(info) {
    if (!info || !info.el || !info.el.isConnected) return;
    var t = ensureTip();
    t.textContent = info.full;            // 纯文本，防注入
    t.style.display = 'block';
    t.setAttribute('aria-hidden', 'false');
    place(info.el);
    // 下一帧加 .on 触发淡入（先定位再显形，避免定位时抖动可见）
    if (window.requestAnimationFrame) requestAnimationFrame(function () { if (t) t.classList.add('on'); });
    else t.classList.add('on');
  }

  function scheduleShow(info) {
    clearTimeout(showTimer);
    showTimer = setTimeout(function () { doShow(info); }, SHOW_DELAY);
  }

  function hide() {
    clearTimeout(showTimer);
    curEl = null;
    if (tip) {
      tip.classList.remove('on');
      tip.style.display = 'none';
      tip.setAttribute('aria-hidden', 'true');
    }
  }

  // ── 委托监听 ──
  document.addEventListener('mouseover', function (e) {
    var info = findTrunc(e.target);
    if (!info) { if (curEl) hide(); return; }
    if (info.el === curEl) return;        // 同一元素内移动 → 不重排
    curEl = info.el;
    scheduleShow(info);
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (!curEl) return;
    var to = e.relatedTarget;
    // 离开当前元素（去往其外部 / 窗口外）→ 收起
    if (!to || (curEl !== to && !curEl.contains(to))) hide();
  }, true);

  // 滚动 / 滚轮 / 按下 / 键盘 → 立即收起（位置会失效，且用户已在操作）
  window.addEventListener('scroll', hide, true);
  window.addEventListener('wheel', hide, { passive: true, capture: true });
  window.addEventListener('mousedown', hide, true);
  window.addEventListener('keydown', hide, true);
  window.addEventListener('blur', hide, true);

  // 暴露给个别需要主动收起/查询的调用方
  window.tmFulltip = { hide: hide, _truncInfo: truncInfo };
})();
