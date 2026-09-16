// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-ui-foundation.js - P4-beta merged UI foundation.
 *
 * Sources: tm-icons.js, tm-modal-system.js, tm-settings-ui.js,
 * tm-cheatsheet-overlay.js. Keep top-level globals unchanged.
 * ============================================================ */
/* === Source: tm-icons.js === */
// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// 天命 中国风SVG图标系统
// 25个手绘风格图标，统一viewBox 24x24, stroke=currentColor
// ============================================================

var TM_ICONS = {
  // ═══ 游戏标签页图标 ═══
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="M7 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7"/><path d="M5 15a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z"/><line x1="10" y1="9" x2="17" y2="9"/><line x1="10" y1="13" x2="15" y2="13"/></svg>',

  memorial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4l4 3h8l4-3"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="13" x2="14" y2="13"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',

  dialogue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h10v7H7l-3 3V6z"/><path d="M13 10h8v7h-4l-3 3v-3h-1v-7z"/></svg>',

  chronicle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="4" height="20" rx="1"/><rect x="10" y="2" width="4" height="20" rx="1"/><rect x="17" y="2" width="4" height="20" rx="1"/><line x1="5" y1="6" x2="5" y2="6.01"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="19" y1="6" x2="19" y2="6.01"/></svg>',

  office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10c0-4 3-7 6-7s6 3 6 7"/><path d="M4 10h16v2H4z"/><path d="M8 12v3"/><path d="M16 12v3"/><path d="M6 15h12v2H6z"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>',

  qiju: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M12 3c-1 2-4 3-4 6 0 2 2 3 4 3s4-1 4-3c0-3-3-4-4-6z"/><line x1="6" y1="20" x2="18" y2="20"/><line x1="8" y1="17" x2="8" y2="20"/></svg>',

  event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4h16l-2 2H6L4 4z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="12" x2="14" y2="12"/><line x1="8" y1="15" x2="12" y2="15"/></svg>',

  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v4h4"/><path d="M3 12h2"/><path d="M3 8h2"/><path d="M3 16h2"/><line x1="8" y1="9" x2="14" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/></svg>',

  // ═══ 资源/指标图标 ═══
  treasury: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',

  grain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V10"/><path d="M12 10c-2-4-6-5-8-4"/><path d="M12 10c2-4 6-5 8-4"/><path d="M12 14c-1.5-2-4-3-6-2.5"/><path d="M12 14c1.5-2 4-3 6-2.5"/><path d="M12 18c-1-1.5-3-2-4.5-1.5"/><path d="M12 18c1-1.5 3-2 4.5-1.5"/></svg>',

  troops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 8h8L12 2z"/><line x1="12" y1="8" x2="12" y2="20"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="20" x2="18" y2="20"/></svg>',

  prestige: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><line x1="10" y1="11" x2="14" y2="11"/><line x1="10" y1="13" x2="14" y2="13"/></svg>',

  execution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><circle cx="12" cy="14" r="2"/><line x1="12" y1="16" x2="12" y2="18"/></svg>',

  strife: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 18"/><path d="M19 3L5 21"/><circle cx="12" cy="12" r="3"/></svg>',

  unrest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z"/><path d="M12 22v-4"/></svg>',

  // ═══ 操作图标 ═══
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4l2-2h12l2 2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',

  load: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M4 8h16"/><path d="M9 12l3 3 3-3"/><line x1="12" y1="8" x2="12" y2="15"/></svg>',

  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>',

  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',

  policy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1" transform="rotate(5 12 12)"/><line x1="9" y1="10" x2="15" y2="10" transform="rotate(5 12 12)"/><line x1="9" y1="14" x2="13" y2="14" transform="rotate(5 12 12)"/></svg>',

  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v3H4z"/><path d="M4 7h16v13H4z"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="14" x2="14" y2="14"/><line x1="8" y1="17" x2="12" y2="17"/></svg>',

  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/><path d="M9 3c0-1 1.5-2 3-2s3 1 3 2"/></svg>',

  faction: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V5l7-3 7 3v16"/><line x1="12" y1="2" x2="12" y2="21"/><line x1="5" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="19" y2="12"/></svg>',

  'end-turn': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M3 12h1"/><path d="M20 12h1"/></svg>',

  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',

  // ═══ 风闻录事四类（告状/风议/密札/耳报） ═══
  // 告状 · 登闻鼓 —— 圆鼓+鼓槌
  drum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="8" rx="7" ry="2.5"/><path d="M5 8v8c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V8"/><line x1="7" y1="3" x2="5.5" y2="5.5"/><line x1="17" y1="3" x2="18.5" y2="5.5"/></svg>',

  // 风议 · 士林舆论 —— 云纹+点点议论
  rumor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14c-2 0-3-1-3-3s1-3 3-3c0-2 2-4 5-4s6 2 6 4c2 0 3 1 3 3s-1 3-3 3z"/><circle cx="8" cy="19" r="0.8" fill="currentColor"/><circle cx="12" cy="20" r="0.8" fill="currentColor"/><circle cx="16" cy="19" r="0.8" fill="currentColor"/></svg>',

  // 密札 · 门生书信 —— 信封+朱印
  letter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 8l8 5 8-5"/><circle cx="18" cy="16" r="1.3" fill="currentColor"/></svg>',

  // 耳报 · 内廷低语 —— 人耳+声波
  whisper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3a5 5 0 0 0-5 5v4c0 2 1 3 2 4v5h4v-5c1 0 2-1 2-3"/><path d="M9 8a1 1 0 0 1 0 2"/><path d="M15 6c2 2 2 6 0 8"/><path d="M18 4c3 3 3 9 0 12"/></svg>'
};

/**
 * 获取SVG图标HTML
 * @param {string} id - 图标ID（TM_ICONS中的key）
 * @param {number} [size=18] - 图标大小(px)
 * @param {string} [className=''] - 额外CSS类名
 * @returns {string} 包裹在span中的SVG HTML
 */
function tmIcon(id, size, className) {
  size = size || 18;
  var svg = TM_ICONS[id] || '';
  if (!svg) return '<span class="tm-icon" style="width:'+size+'px;height:'+size+'px"></span>';
  // 替换viewBox中的宽高为实际size
  svg = svg.replace('<svg ', '<svg width="'+size+'" height="'+size+'" ');
  return '<span class="tm-icon'+(className?' '+className:'')+'" style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;flex-shrink:0">'+svg+'</span>';
}


/* === Source: tm-modal-system.js === */
// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-modal-system.js — 通用模态框系统
 *
 * 来源：2026-04-24 R17 从 tm-patches.js:1861-1892 抽离
 *
 * 导出（挂到 window 全局）：
 *   gv(id)                              — 辅助：读取 input 值并 trim
 *   openGenericModal(title,bodyHTML,onSave) — 带【取消/保存】两按钮的编辑弹窗
 *   closeGenericModal()                 — 关闭当前通用弹窗
 *   showModal(title,bodyHTML,onClose)   — 带【确定】单按钮的信息弹窗
 *   closeModal()                        — 别名 closeGenericModal
 *
 * 依赖：
 *   - escHtml（全局工具，用于 showModal 的 title 转义）
 *   - _isPostTurnActive / _queuePostTurnModal（tm-endturn.js，后朝期间排队延后）
 *   - CSS class: .generic-modal-overlay / .generic-modal / header/body/footer / .bt .bs .bp .bsm
 *
 * 原位置（tm-patches.js）保留空注释作 redirect 标记。
 * ============================================================ */
function gv(id){var el=document.getElementById(id);return el?el.value.trim():"";}

// 同一发起界面上的后续弹窗共享层级与焦点，关闭时不碰下面的御案或草稿。
var _tmModalLayers = [];
function _tmTopModalLayer(){
  _tmModalLayers = _tmModalLayers.filter(function(x){ return x.node.isConnected !== false; });
  return _tmModalLayers[_tmModalLayers.length - 1] || null;
}
function _tmModalFocus(node){
  if (node && node.isConnected !== false && typeof node.focus === 'function') {
    try { node.focus({preventScroll:true}); } catch(_) { node.focus(); }
  }
}
function _tmModalFocusables(ov){
  if (!ov.querySelectorAll) return [];
  return Array.prototype.filter.call(ov.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'), function(n){
    var s = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(n) : n.style || {};
    return s.display !== 'none' && s.visibility !== 'hidden';
  });
}
function _tmPresentModal(ov, onCancel, initialFocus){
  if (!ov) return;
  _tmTopModalLayer();
  var own = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(ov) : ov.style || {};
  var top = Math.max(1100, Number(own.zIndex) || 0), opener = document.activeElement;
  function consider(n){
    if (!n || n === ov) return;
    var s = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(n) : n.style || {};
    if (s.display === 'none' || s.visibility === 'hidden') return;
    var z = Number(s.zIndex); if (isFinite(z)) top = Math.max(top, z);
  }
  if (document.querySelectorAll) Array.prototype.forEach.call(document.querySelectorAll('.tm-desk-overlay,.tmf-module-overlay,.generic-modal-overlay,[data-tm-modal-layer]'), consider);
  for (var p = opener; p && p !== document.body; p = p.parentElement) consider(p);
  ov.style.zIndex = String(top + 1);
  ov.tabIndex = -1;
  if (ov.setAttribute) { ov.setAttribute('data-tm-modal-layer', '1'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); }
  var entry = {node:ov, opener:opener, cancel:onCancel};
  ov.__tmModalLayer = entry;
  _tmModalLayers.push(entry);
  var target = typeof initialFocus === 'string' ? (ov.querySelector && ov.querySelector(initialFocus)) : initialFocus;
  if (!target && ov.querySelector) target = ov.querySelector('[autofocus],input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled])');
  _tmModalFocus(target || _tmModalFocusables(ov)[0] || ov);
}
function _tmCloseModalLayer(ov){
  if (!ov) return;
  var entry = ov.__tmModalLayer, top = _tmTopModalLayer();
  ov.remove();
  _tmModalLayers = _tmModalLayers.filter(function(x){ return x.node !== ov && x.node.isConnected !== false; });
  if (entry && entry === top) {
    var next = _tmTopModalLayer();
    _tmModalFocus(entry.opener && entry.opener.isConnected !== false ? entry.opener : next && next.node);
  }
}
document.addEventListener('keydown', function(e){
  var top = _tmTopModalLayer(); if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (typeof top.cancel === 'function') top.cancel();
    return;
  }
  if (e.key !== 'Tab') return;
  var items = _tmModalFocusables(top.node), active = document.activeElement, first = items[0], last = items[items.length - 1];
  if (!items.length || (!e.shiftKey && (active === last || !top.node.contains(active))) || (e.shiftKey && (active === first || !top.node.contains(active)))) {
    e.preventDefault(); _tmModalFocus(e.shiftKey ? last || top.node : first || top.node);
  }
}, true);

function openGenericModal(title,bodyHTML,onSave){
  // 后朝进行中·排队延后（史记弹窗之后再依次弹出）
  if (typeof _isPostTurnActive === 'function' && _isPostTurnActive()) {
    _queuePostTurnModal(function(){ openGenericModal(title, bodyHTML, onSave); }, title);
    return;
  }
  var ov=document.createElement("div");ov.className="generic-modal-overlay";ov.id="gm-overlay";
  ov.innerHTML='<div class="generic-modal">'+
    '<div class="generic-modal-header"><h3>'+title+'</h3><button class="bt bs bsm" onclick="closeGenericModal()">✕</button></div>'+
    '<div class="generic-modal-body">'+bodyHTML+'</div>'+
    '<div class="generic-modal-footer"><button class="bt bs" onclick="closeGenericModal()">取消</button><button class="bt bp" id="gm-save-btn">保存</button></div></div>';
  document.body.appendChild(ov);
  (ov.querySelector ? ov.querySelector("#gm-save-btn") : document.getElementById("gm-save-btn")).onclick=onSave;
  _tmPresentModal(ov, closeGenericModal);
}
function closeGenericModal(){
  var rows=_tmModalLayers.filter(function(x){return x.node.id==="gm-overlay" && x.node.isConnected !== false;});
  _tmCloseModalLayer(rows.length?rows[rows.length-1].node:document.getElementById("gm-overlay"));
}

/** showModal/closeModal 兼容层 — 多个子系统使用此API显示信息弹窗 */
function showModal(title, bodyHTML, onClose) {
  var ov=document.createElement("div");ov.className="generic-modal-overlay";ov.id="gm-overlay";
  ov.innerHTML='<div class="generic-modal">'+
    '<div class="generic-modal-header"><h3>'+escHtml(title)+'</h3><button class="bt bs bsm" onclick="closeModal()">✕</button></div>'+
    '<div class="generic-modal-body">'+bodyHTML+'</div>'+
    '<div class="generic-modal-footer"><button class="bt bp" onclick="closeModal()">确定</button></div></div>';
  document.body.appendChild(ov);
  if(onClose){(ov.querySelector?ov.querySelector('.bt.bp'):document.querySelector('#gm-overlay .bt.bp')).onclick=function(){closeModal();onClose();};}
  _tmPresentModal(ov, closeModal);
}
function closeModal(){closeGenericModal();}


/* === Source: tm-settings-ui.js === */
// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-settings-ui.js — 设置界面 UI（占位）
 *
 * ⚠ 本文件当前是占位，实际实现仍在 tm-patches.js:1-512
 *
 * 为什么占位而不真迁移？
 *   原代码 512 行含 openSettings 完整重写 + 19 个 sXxx/_sXxx 辅助函数
 *   涉及：主 API / 次要 API / 生图 API 三套配置 + 模型检测 + 连接测试 +
 *        字数档位预览 + 上下文探测 + 输出上限检测
 *   风险：
 *     · openSettings 覆盖 game-engine 原版，innerHTML 内含 400+ 行字符串
 *     · sSaveAPI 涉及 localStorage + Electron autoSave 双路径
 *     · sDetectModels 发起真 AI API 请求
 *   没有测试环境无法验证迁移后等价性。
 *
 * 建议迁移路径（给未来维护者）：
 *   1. 先在 TM.test 补 smoke test：
 *      - openSettings 能开（不抛）
 *      - sSaveAPI 正确写 P.ai + localStorage
 *      - sToggleSecondaryEnabled 正确修改 P.conf.secondaryEnabled
 *      - _sVerbUpdatePreview 不抛 + 恢复 origV
 *   2. 按函数依赖顺序逐个迁移：
 *      ┌─ 最独立（先迁）：
 *      │    _sUpdateMaxoutInfo / _sMaxoutToggle
 *      │    _sShowCtxInfo / sReDetectCtx
 *      │    _sVerbUpdatePreview
 *      │    DEFAULT_PROMPT / DEFAULT_RULES 常量
 *      ├─ 中等依赖（_sXxx helper 迁完后）：
 *      │    sSaveAPI / sSaveAll / sTestConn / sDetectModels
 *      │    sPickModel / sSaveSecondaryAPI / sPickSecModel
 *      │    sTestSecondaryConn / sDetectSecondaryModels
 *      │    sClearSecondaryAPI / sToggleSecondaryEnabled
 *      │    _sTestImgConn / _sDetectImgCap / _sSaveImgAPI
 *      └─ 最后迁（依赖所有 helper）：
 *           openSettings (~200 行 innerHTML)
 *   3. 每迁完一批就在 tm-patches.js 顶部的 redirect 注释扩展"已迁移 XXX"
*   4. 全部迁完后，index.html 加载顺序：tm-patches.js → tm-ui-foundation.js
 *   5. 等双保险稳定 1 周后，删除 tm-patches.js 对应原代码
 *
 * 预估工时：15-25 小时（含完整回归测试）
 * 先决条件：
 *   · 至少 8 个 smoke test（API 保存/连接测试/模型检测 路径）
 *   · 手工验证：打开设置 → 修改每项 → 保存 → 关闭 → 重开，设置应保持
 *
 * 详细切分方案：见 PATCH_CLASSIFICATION.md · tm-patches.js 段
 * ============================================================ */

// 本文件暂为占位，主逻辑在 tm-patches.js。
// 如果你看到这个注释并想做真迁移，按上述步骤执行。
// 切勿在测试环境之外直接动这段代码。

(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  // 记录到 DA.meta 以便统计
  window.TM = window.TM || {};
  window.TM._migrationPlaceholders = window.TM._migrationPlaceholders || [];
  window.TM._migrationPlaceholders.push({
    file: 'tm-ui-foundation.js',
    originalFile: 'tm-settings-ui.js',
    source: 'tm-patches.js:1-512',
    status: 'placeholder',
    estimatedHours: 20,
    createdBy: 'R22',
    date: '2026-04-24'
  });
})();


/* === Source: tm-cheatsheet-overlay.js === */
// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-cheatsheet-overlay.js — 游戏内速查卡浮层（Ctrl+Shift+/）
 *
 * 目的：把 DEBUG_CHEATSHEET.md 的核心内容内置为游戏内浮层，
 *      维护者调试时不用切屏去读 markdown 文件。
 *
 * 快捷键：Ctrl+Shift+/ 或 Ctrl+Shift+H（/ 比 H 不易与游戏功能冲突）
 * 也可：TM.cheatsheet.show() / TM.cheatsheet.toggle()
 *
 * 不动游戏代码——纯浮层，可关闭，不影响游戏。
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.cheatsheet) return;

  var overlayId = 'tm-cheatsheet-overlay';
  var isOpen = false;

  // R143·委托给 tm-utils.js:569 的 escHtml
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }

  function _codeBlock(code) {
    return '<pre style="background:#0a0806;border:1px solid #2a2010;border-radius:3px;padding:8px 10px;font-size:12px;color:#d9c77a;margin:4px 0;overflow-x:auto;line-height:1.5">' + _esc(code) + '</pre>';
  }

  function _section(title, inner) {
    return '<div style="margin-bottom:12px">'
      + '<div style="font-size:12px;font-weight:bold;color:#e8c66e;margin-bottom:4px;border-bottom:1px solid #3a2a10;padding-bottom:2px">' + title + '</div>'
      + inner
      + '</div>';
  }

  // 速查卡内容（精简版 DEBUG_CHEATSHEET.md）
  var SECTIONS = [
    {
      title: '⚡ 快捷键',
      items: [
        ['Ctrl+Shift+D', '统一诊断仪表板（★ 新增）'],
        ['Ctrl+Shift+E', '错误日志面板'],
        ['Ctrl+Shift+P', '性能采样面板'],
        ['Ctrl+Shift+/', '本速查卡'],
        ['?test=1', '启动时自动跑 smoke test']
      ]
    },
    {
      title: '🔍 数据查询 DA.*',
      code: [
        'DA.chars.player()                // 玩家角色',
        'DA.chars.findByName("张居正")    // O(1) 按名查',
        'DA.chars.allAlive()',
        'DA.chars.byFaction("大明")',
        'DA.guoku.money()  DA.guoku.grain()  DA.guoku.cloth()',
        'DA.guoku.isBankrupt()',
        'DA.officeTree.postsOf("袁崇焕")  // 某人所有兼任',
        'DA.admin.findDivision("陕西")',
        'DA.armies.totalTroops("大明")',
        'DA.authority.huangquan() / huangwei() / minxin()',
        'DA.issues.pending()  DA.turn.current()'
      ]
    },
    {
      title: '🐛 诊断 TM.*',
      code: [
        'TM.errors.openPanel()         // 打开错误面板',
        'TM.errors.getSummary()        // 按 module 汇总',
        'TM.getLastValidation()        // 最近 AI 校验',
        'TM.test.run()                 // 跑全部 smoke test',
        'TM.test.runOnly("DA.guoku")',
        'TM.invariants.check()         // 查不变量',
        'TM.guard.report()             // 全局污染统计',
        'TM.hooks.list()               // 所有 hook event',
        'TM.perf.print()               // tick 耗时表'
      ]
    },
    {
      title: '📸 状态快照 TM.state',
      code: [
        'TM.state.snapshot("before-xxx")',
        'TM.state.list()',
        'TM.diff.printBySnapshot("before-xxx", "after-xxx")',
        'TM.perf.lockBaseline()        // 锁定 p95 基准',
        'TM.perf.printCompare()        // 合并前后对比'
      ]
    },
    {
      title: '🔧 合并工作流（LAYERED 合并专用）',
      code: [
        '// 合并前（玩 5 回合后）',
        'TM.checklist.preMerge("corruption-p2")',
        '',
        '// 执行合并改代码',
        '',
        '// 合并后（再玩 5 回合后）',
        'TM.checklist.postMerge("corruption-p2")',
        '// → 自动 diff+perf compare+invariants+errors',
        '',
        'TM.checklist.lastReport()     // 查综合报告',
        'TM.checklist.downloadReport() // 下载 JSON'
      ]
    },
    {
      title: '🩺 常见问题',
      items: [
        ['AI 字段没生效', 'TM.getLastValidation() 看 warnings'],
        ['按钮不响应', 'Ctrl+Shift+E 看错误'],
        ['存档加载数据不全', '看 console [SaveMigration] 日志'],
        ['回合结算卡死', 'GM._turnAiResults.subcall1_raw 看 AI 原始返回'],
        ['某角色找不到', 'DA.chars.findByName 或 buildIndices()'],
        ['性能慢', 'TM.perf.print() 看 p95']
      ]
    },
    {
      title: '📚 文档位置',
      items: [
        ['ARCHITECTURE.md', '完整架构 10 章'],
        ['MODULE_REGISTRY.md', '92 文件索引'],
        ['PATCH_CLASSIFICATION.md', '18+ 补丁分类'],
        ['DEBUG_CHEATSHEET.md', '完整版速查（本卡精简版）'],
        ['GLOBAL_POLLUTION_REPORT.md', '1469 全局量化报告'],
        ['tm-endturn.js 顶部', 'endTurn 18k 行导航'],
        ['tm-game-engine.js 顶部', 'game-engine 9k 导航'],
        ['tm-chaoyi-keju.js 顶部', 'chaoyi-keju 9k 导航']
      ]
    }
  ];

  function renderHTML() {
    var html = SECTIONS.map(function(sec){
      var body = '';
      if (sec.code) body = _codeBlock(sec.code.join('\n'));
      if (sec.items) {
        body += '<table style="width:100%;border-collapse:collapse;font-size:12px">'
          + sec.items.map(function(it){
            return '<tr><td style="padding:2px 8px 2px 0;color:#9ac870;white-space:nowrap;vertical-align:top">' + _esc(it[0]) + '</td>'
              + '<td style="padding:2px 0;color:#ccc">' + _esc(it[1]) + '</td></tr>';
          }).join('')
          + '</table>';
      }
      return _section(sec.title, body);
    }).join('');
    return html;
  }

  function show() {
    if (isOpen) return;
    isOpen = true;
    var el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = 'position:fixed;right:20px;top:20px;width:640px;max-width:92vw;max-height:90vh;overflow-y:auto;'
      + 'background:#0f0c08;border:1px solid #5a3a1a;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,0.8);'
      + 'z-index:99993;color:#ddd;font-family:sans-serif;padding:12px';
    el.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:8px;border-bottom:1px solid #3a2a10;padding-bottom:8px">'
      + '<b style="color:#e8c66e;font-size:14px">🀄 天命 · 诊断速查卡</b>'
      + '<span style="color:#888;font-size:11px;margin-left:12px">Ctrl+Shift+/ 关闭</span>'
      + '<button onclick="TM.cheatsheet.hide()" style="margin-left:auto;background:#2a2a2a;color:#ccc;border:1px solid #4a4a4a;padding:3px 10px;cursor:pointer;font-size:12px">关闭</button>'
      + '</div>'
      + renderHTML();
    document.body.appendChild(el);
  }

  function hide() {
    var el = document.getElementById(overlayId);
    if (el) el.remove();
    isOpen = false;
  }

  function toggle() { isOpen ? hide() : show(); }

  function installHotkey() {
    if (window._tmCheatsheetHotkey) return;
    window._tmCheatsheetHotkey = true;
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        toggle();
      }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installHotkey);
    else installHotkey();
  }

  TM.cheatsheet = {
    show: show,
    hide: hide,
    toggle: toggle,
    sections: SECTIONS
  };
})();

/* === Source: tm-fulltext-tooltip.js === */
(function(){
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.fullTextTooltip) return;

  var activeEl = null;
  var tipEl = null;
  var lastPoint = { x: 0, y: 0 };
  var selector = '[data-tm-fulltext],.tm-fulltext-source,.tm-party-full,.tm-class-full,.tm-army-full,.gs-party-name,.gs-class-name,.gs-army-name,.gs-army-loc';

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fullTextAttr(text, always) {
    var v = String(text == null ? '' : text).trim();
    if (!v) return '';
    return ' data-tm-fulltext="' + escAttr(v) + '"' + (always ? ' data-tm-fulltext-always="1"' : '');
  }

  function getTip() {
    if (tipEl && document.body.contains(tipEl)) return tipEl;
    tipEl = document.createElement('div');
    tipEl.id = 'tm-fulltext-tooltip';
    tipEl.className = 'tm-fulltext-tooltip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function getText(el) {
    if (!el) return '';
    return String(el.getAttribute('data-tm-fulltext') || el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isClipped(el) {
    if (!el) return false;
    return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  }

  function place(x, y) {
    var tip = getTip();
    var pad = 14;
    var left = x + pad;
    var top = y + pad;
    var rect = tip.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (left + rect.width + 10 > vw) left = Math.max(8, x - rect.width - pad);
    if (top + rect.height + 10 > vh) top = Math.max(8, y - rect.height - pad);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function show(el, x, y) {
    var text = getText(el);
    if (!text) return;
    if (!el.hasAttribute('data-tm-fulltext') && !el.hasAttribute('data-tm-fulltext-always') && !isClipped(el)) return;
    activeEl = el;
    lastPoint.x = x || lastPoint.x;
    lastPoint.y = y || lastPoint.y;
    var tip = getTip();
    tip.textContent = text;
    tip.classList.add('show');
    place(lastPoint.x, lastPoint.y);
  }

  function hide() {
    activeEl = null;
    if (tipEl) tipEl.classList.remove('show');
  }

  document.addEventListener('mouseover', function(e){
    var el = e.target && e.target.closest ? e.target.closest(selector) : null;
    if (!el) return;
    show(el, e.clientX, e.clientY);
  }, true);

  document.addEventListener('mousemove', function(e){
    lastPoint.x = e.clientX;
    lastPoint.y = e.clientY;
    if (activeEl) place(lastPoint.x, lastPoint.y);
  }, true);

  document.addEventListener('mouseout', function(e){
    if (!activeEl) return;
    var to = e.relatedTarget;
    if (to && activeEl.contains && activeEl.contains(to)) return;
    hide();
  }, true);

  document.addEventListener('focusin', function(e){
    var el = e.target && e.target.closest ? e.target.closest(selector) : null;
    if (!el) return;
    var rect = el.getBoundingClientRect();
    show(el, rect.left + rect.width / 2, rect.bottom);
  }, true);

  document.addEventListener('focusout', hide, true);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') hide(); }, true);

  window.tmFullTextAttr = fullTextAttr;
  window.TM.fullTextTooltip = { attr: fullTextAttr, hide: hide };
})();
