// map-editor-bookmarks.js
// Phase 18.2·视角 bookmarks·F1-F4 槽
// F1-F4·跳·Shift+F1-F4·设·右键 / Alt+F·清
// localStorage·key 'me.bookmarks.v1'·按 map.dynasty 索引
// 浮 column·canvas 左·4 slot 圆按钮·click 跳·shift-click 设·right-click 清
// (F5 留给 browser reload·不动)
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[bookmarks] core not loaded'); return; }

  var STORE_KEY = 'me.bookmarks.v1';
  var SLOTS = 4;
  var _bookmarks = null;     // { dynasty: [ {x,y,zoom,label} | null, ... ] }
  var _column = null;

  // ─── persist ───────────────────────────────────────────

  function load(){
    if (_bookmarks) return _bookmarks;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      _bookmarks = raw ? JSON.parse(raw) : {};
    } catch(e){ _bookmarks = {}; }
    return _bookmarks;
  }

  function save(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_bookmarks)); } catch(e){}
  }

  function getSlots(){
    var dyn = (ME.EDITOR.map && ME.EDITOR.map.dynasty) || '_default';
    var bm = load();
    if (!bm[dyn]) bm[dyn] = [null, null, null, null];
    return bm[dyn];
  }

  // ─── set / get / clear ─────────────────────────────────

  function setBookmark(idx){
    if (idx < 0 || idx >= SLOTS) return;
    var slots = getSlots();
    var c = ME.EDITOR.camera;
    var label = labelForCurrentView();
    slots[idx] = { x: c.x, y: c.y, zoom: c.zoom, label: label };
    save();
    renderColumn();
    if (global.meToast) meToast('视角 ' + (idx + 1) + ' 设·' + label, 'success', 1500);
  }

  function jumpBookmark(idx){
    if (idx < 0 || idx >= SLOTS) return;
    var slots = getSlots();
    var bm = slots[idx];
    if (!bm){
      if (global.meToast) meToast('视角 ' + (idx + 1) + ' 未设·Shift+F' + (idx + 1) + ' 先设', 'warn', 2000);
      return;
    }
    ME.EDITOR.camera.x = bm.x;
    ME.EDITOR.camera.y = bm.y;
    ME.EDITOR.camera.zoom = bm.zoom;
    ME.requestRender();
    if (global.meToast) meToast('跳·' + bm.label, 'info', 1200);
    renderColumn();
  }

  function clearBookmark(idx){
    if (idx < 0 || idx >= SLOTS) return;
    var slots = getSlots();
    if (!slots[idx]) return;
    slots[idx] = null;
    save();
    renderColumn();
    if (global.meToast) meToast('视角 ' + (idx + 1) + ' 清', 'info', 1200);
  }

  // 判 current camera 接近哪个 slot
  function currentSlot(){
    var slots = getSlots();
    var c = ME.EDITOR.camera;
    for (var i = 0; i < slots.length; i++){
      var b = slots[i];
      if (!b) continue;
      if (Math.abs(b.x - c.x) < 1 && Math.abs(b.y - c.y) < 1 && Math.abs(b.zoom - c.zoom) < 0.001){
        return i;
      }
    }
    return -1;
  }

  function labelForCurrentView(){
    // 试·选中的 division 名·或 region·或 zoom 描
    var sels = ME.getSelected ? ME.getSelected() : [];
    if (sels.length === 1) return sels[0].name || sels[0].id;
    if (sels.length > 1) return sels.length + ' 省';
    // viewport 中心·world coord
    var c = ME.EDITOR.camera;
    var cv = ME.EDITOR.canvas;
    if (!cv) return '视角';
    var wx = (cv.width / 2 - c.x) / c.zoom;
    var wy = (cv.height / 2 - c.y) / c.zoom;
    // 找最近 division
    var divs = ME.EDITOR.map && ME.EDITOR.map.divisions || [];
    var bestD = null, bestDist = Infinity;
    for (var i = 0; i < divs.length; i++){
      var d = divs[i];
      if (!d.bbox) continue;
      var dx = (d.bbox.x + d.bbox.w / 2) - wx;
      var dy = (d.bbox.y + d.bbox.h / 2) - wy;
      var dist = dx * dx + dy * dy;
      if (dist < bestDist){ bestDist = dist; bestD = d; }
    }
    if (bestD) return bestD.name + ' 周';
    return 'z=' + c.zoom.toFixed(2);
  }

  // ─── UI·浮 column ──────────────────────────────────────

  function ensureColumn(){
    if (_column) return _column;
    _column = document.createElement('div');
    _column.id = 'me-bookmarks';
    _column.style.cssText = [
      'position:absolute',
      'left:var(--sp-3)',
      'bottom:60px',
      'display:flex',
      'flex-direction:column',
      'gap:6px',
      'z-index:10',
      'pointer-events:auto'
    ].join(';');
    var stage = document.querySelector('.me-stage');
    if (stage) stage.appendChild(_column); else document.body.appendChild(_column);
    return _column;
  }

  function renderColumn(){
    var col = ensureColumn();
    var slots = getSlots();
    var cur = currentSlot();
    col.innerHTML = '';

    for (var i = 0; i < SLOTS; i++){
      var bm = slots[i];
      var active = i === cur;
      var btn = document.createElement('div');
      btn.style.cssText = [
        'width:36px',
        'height:36px',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'background:' + (active ? 'linear-gradient(180deg, var(--gold-3), var(--gold-4))' : (bm ? 'var(--ink-3)' : 'rgba(20,16,12,0.5)')),
        'border:1px solid ' + (active ? 'var(--gold-1)' : (bm ? 'var(--bd-1)' : 'rgba(82,72,58,0.4)')),
        'border-radius:var(--rd-2)',
        'cursor:pointer',
        'color:' + (active ? 'var(--ink-1)' : (bm ? 'var(--gold-2)' : 'var(--paper-4)')),
        'font-family:var(--font-serif)',
        'font-size:var(--fs-xs)',
        'font-weight:var(--fw-sb)',
        'box-shadow:' + (active ? '0 0 8px rgba(217,181,102,0.4)' : '0 1px 3px rgba(0,0,0,0.4)'),
        'transition:all var(--t-fast)',
        'user-select:none',
        'position:relative'
      ].join(';');
      btn.title = bm
        ? 'F' + (i + 1) + '·' + bm.label + '\nshift-click 改 / 右键 清'
        : 'F' + (i + 1) + '·空·shift-click 设当前视角';
      btn.innerHTML =
        '<div style="font-size:9px; opacity:0.7;">F' + (i + 1) + '</div>' +
        '<div style="font-size:11px;">' + (bm ? '●' : '○') + '</div>';

      (function(idx){
        btn.addEventListener('click', function(e){
          if (e.shiftKey) setBookmark(idx);
          else jumpBookmark(idx);
        });
        btn.addEventListener('contextmenu', function(e){
          e.preventDefault();
          clearBookmark(idx);
        });
      })(i);

      col.appendChild(btn);
    }
  }

  // ─── 键盘 ──────────────────────────────────────────────

  function bindKeys(){
    document.addEventListener('keydown', function(e){
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      var m = /^F([1-4])$/.exec(e.key);
      if (!m) return;
      var idx = parseInt(m[1], 10) - 1;
      e.preventDefault();
      if (e.shiftKey) setBookmark(idx);
      else if (e.altKey) clearBookmark(idx);
      else jumpBookmark(idx);
    });
  }

  // ─── init ──────────────────────────────────────────────

  function init(){
    ensureColumn();
    renderColumn();
    bindKeys();
    // camera 变·重 render column·indicator 跟随
    var lastCam = { x: NaN, y: NaN, zoom: NaN };
    setInterval(function(){
      var c = ME.EDITOR.camera;
      if (c.x !== lastCam.x || c.y !== lastCam.y || c.zoom !== lastCam.zoom){
        lastCam.x = c.x; lastCam.y = c.y; lastCam.zoom = c.zoom;
        renderColumn();
      }
    }, 500);
    ME.on('map-loaded', renderColumn);
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.bookmarks = {
    init: init,
    set: setBookmark,
    jump: jumpBookmark,
    clear: clearBookmark,
    current: currentSlot
  };

})(typeof window !== 'undefined' ? window : this);
