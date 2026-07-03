// map-editor-minimap.js
// Phase 16.3·mini-map·右下浮窗 200×140
// 显·全图·viewport 矩形·点 / drag → 跳 camera
// 自动·mutation / map-loaded / view-year-change 事件触发 redraw
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[minimap] core not loaded'); return; }

  var WIDTH = 200, HEIGHT = 140;
  var PADDING = 8;
  var MIN_BBOX = 100;     // 世界 px 最小 bbox 防过缩

  var _canvas = null;
  var _ctx = null;
  var _bounds = { x: 0, y: 0, w: 1, h: 1 };
  var _scale = 1;
  var _dragging = false;
  var _enabled = true;

  function init(){
    if (_canvas) return _canvas;
    var wrap = document.createElement('div');
    wrap.id = 'me-minimap';
    wrap.style.cssText = [
      'position:absolute',
      'right:392px',  // 让出 drawer
      'bottom:var(--sp-3)',
      'width:' + WIDTH + 'px',
      'height:' + HEIGHT + 'px',
      'background:linear-gradient(180deg, var(--ink-3), var(--ink-1))',
      'border:1px solid var(--bd-1)',
      'border-radius:var(--rd-3)',
      'box-shadow:var(--sh-2)',
      'overflow:hidden',
      'z-index:10',
      'cursor:crosshair',
      'user-select:none'
    ].join(';');

    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 8px; background:rgba(0,0,0,0.4); font-size:10px; color:var(--paper-3); letter-spacing:0.1em;';
    hdr.innerHTML = '<span>全圖</span><span class="me-mm-toggle" style="cursor:pointer; color:var(--paper-2);" title="收起">−</span>';

    _canvas = document.createElement('canvas');
    _canvas.width = WIDTH;
    _canvas.height = HEIGHT - 18;
    _canvas.style.cssText = 'display:block; width:100%; height:auto;';

    wrap.appendChild(hdr);
    wrap.appendChild(_canvas);

    var stage = document.querySelector('.me-stage');
    if (stage) stage.appendChild(wrap); else document.body.appendChild(wrap);

    _ctx = _canvas.getContext('2d');

    // 折叠按钮
    hdr.querySelector('.me-mm-toggle').addEventListener('click', function(e){
      e.stopPropagation();
      _enabled = !_enabled;
      _canvas.style.display = _enabled ? 'block' : 'none';
      hdr.querySelector('.me-mm-toggle').textContent = _enabled ? '−' : '+';
      try { localStorage.setItem('me.minimap', _enabled ? '1' : '0'); } catch(e){}
    });
    try {
      if (localStorage.getItem('me.minimap') === '0'){
        _enabled = false;
        _canvas.style.display = 'none';
        hdr.querySelector('.me-mm-toggle').textContent = '+';
      }
    } catch(e){}

    // 交互·click / drag → pan
    _canvas.addEventListener('mousedown', function(e){
      _dragging = true;
      panToClick(e);
    });
    document.addEventListener('mousemove', function(e){
      if (_dragging) panToClick(e);
    });
    document.addEventListener('mouseup', function(){ _dragging = false; });

    // 事件 hooks
    ME.on('mutation', schedule);
    ME.on('map-loaded', function(){ recalcBounds(); render(); });
    ME.on('view-year-change', schedule);
    ME.on('selection-change', schedule);

    // 初始
    recalcBounds();
    render();

    // viewport 跟随 camera·定时检 (camera 变没 event)
    // 注·必须 full render·否则 renderViewport 8% gold 叠 12 fps 累积成纯黄
    setInterval(function(){
      if (_enabled) render();
    }, 100);

    // 窗口 resize·minimap 不动·但 viewport 动
    window.addEventListener('resize', schedule);

    return wrap;
  }

  // ─── bounds·根据 map content 计 ─────────────────────────

  function recalcBounds(){
    var map = ME.EDITOR.map;
    var w = map.bitmapWidth || 1280;
    var h = map.bitmapHeight || 800;
    // 默用 bitmapWidth/Height·若 division 超出·扩
    var minX = 0, minY = 0, maxX = w, maxY = h;
    map.divisions.forEach(function(d){
      if (!d.bbox) return;
      if (d.bbox.x < minX) minX = d.bbox.x;
      if (d.bbox.y < minY) minY = d.bbox.y;
      if (d.bbox.x + d.bbox.w > maxX) maxX = d.bbox.x + d.bbox.w;
      if (d.bbox.y + d.bbox.h > maxY) maxY = d.bbox.y + d.bbox.h;
    });
    // 加 5% padding
    var bw = maxX - minX, bh = maxY - minY;
    bw = Math.max(MIN_BBOX, bw);
    bh = Math.max(MIN_BBOX, bh);
    minX -= bw * 0.04; minY -= bh * 0.04;
    bw *= 1.08; bh *= 1.08;

    _bounds = { x: minX, y: minY, w: bw, h: bh };
    var cw = _canvas ? _canvas.width : WIDTH;
    var ch = _canvas ? _canvas.height : HEIGHT - 18;
    _scale = Math.min(cw / bw, ch / bh);
  }

  // 世界 → minimap canvas
  function w2m(wx, wy){
    var cw = _canvas.width, ch = _canvas.height;
    var fittedW = _bounds.w * _scale;
    var fittedH = _bounds.h * _scale;
    var ox = (cw - fittedW) / 2;
    var oy = (ch - fittedH) / 2;
    return [
      ox + (wx - _bounds.x) * _scale,
      oy + (wy - _bounds.y) * _scale
    ];
  }
  function m2w(mx, my){
    var cw = _canvas.width, ch = _canvas.height;
    var fittedW = _bounds.w * _scale;
    var fittedH = _bounds.h * _scale;
    var ox = (cw - fittedW) / 2;
    var oy = (ch - fittedH) / 2;
    return [
      (mx - ox) / _scale + _bounds.x,
      (my - oy) / _scale + _bounds.y
    ];
  }

  // ─── render ─────────────────────────────────────────────

  var _renderQueued = false;
  function schedule(){
    if (!_enabled) return;
    if (_renderQueued) return;
    _renderQueued = true;
    requestAnimationFrame(function(){
      _renderQueued = false;
      recalcBounds();
      render();
    });
  }

  function render(){
    if (!_ctx || !_canvas) return;
    var ctx = _ctx;
    var cw = _canvas.width, ch = _canvas.height;

    // 底
    ctx.fillStyle = '#0a0805';
    ctx.fillRect(0, 0, cw, ch);

    // bitmap 边
    var p0 = w2m(0, 0);
    var p1 = w2m(ME.EDITOR.map.bitmapWidth || 1280, ME.EDITOR.map.bitmapHeight || 800);
    ctx.strokeStyle = 'rgba(217,181,102,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);

    // divisions·按 colorKey 或 autonomy 着色·小填
    var sel = {};
    ME.EDITOR.selectedIds.forEach(function(id){ sel[id] = true; });

    ME.EDITOR.map.divisions.forEach(function(d){
      if (!d.polygon || d.polygon.length < 3) return;
      ctx.beginPath();
      var first = w2m(d.polygon[0][0], d.polygon[0][1]);
      ctx.moveTo(first[0], first[1]);
      for (var i = 1; i < d.polygon.length; i++){
        var p = w2m(d.polygon[i][0], d.polygon[i][1]);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      // 色·选中金·否则按 colorKey / autonomy
      var color;
      if (sel[d.id]){
        color = 'rgba(217,181,102,0.85)';
      } else if (typeof d.colorKey === 'number'){
        var r = (d.colorKey >> 16) & 0xff;
        var g = (d.colorKey >> 8) & 0xff;
        var b = d.colorKey & 0xff;
        color = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
      } else {
        var typ = d.autonomy && d.autonomy.type;
        color = typ === 'fanguo' ? 'rgba(138,58,46,0.7)' :
                typ === 'fanzhen' ? 'rgba(182,90,48,0.7)' :
                typ === 'jimi' ? 'rgba(106,138,58,0.7)' :
                typ === 'chaogong' ? 'rgba(122,106,58,0.7)' :
                'rgba(61,79,106,0.7)';
      }
      ctx.fillStyle = color;
      ctx.fill();
    });

    renderViewport();
  }

  function renderViewport(){
    if (!_ctx || !_canvas || !ME.EDITOR.canvas) return;
    var ctx = _ctx;
    // viewport·camera·世界范围
    var canvasMain = ME.EDITOR.canvas;
    var z = ME.EDITOR.camera.zoom;
    var minX = -ME.EDITOR.camera.x / z;
    var minY = -ME.EDITOR.camera.y / z;
    var w = canvasMain.width / z;
    var h = canvasMain.height / z;

    // 重画 (包括 base map content) — 简化·先 redraw 全部
    // (如果 viewport 变更频繁·直接 mutate viewport rect 而非 full redraw)
    // 这里·最简版·只画 viewport rect·base map content 由 mutation/select event 主动 render() 重画
    var p0 = w2m(minX, minY);
    var p1 = w2m(minX + w, minY + h);
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#d9b566';
    ctx.fillStyle = 'rgba(217,181,102,0.08)';
    var rx = p0[0], ry = p0[1], rw = p1[0] - p0[0], rh = p1[1] - p0[1];
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();

    // viewport 标记 (短轴线指中心)
    ctx.beginPath();
    var cx = rx + rw/2, cy = ry + rh/2;
    ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
    ctx.strokeStyle = '#d9b566';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ─── interaction·click / drag → pan ─────────────────────

  function panToClick(e){
    if (!_canvas) return;
    var rect = _canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var w = m2w(mx, my);
    // camera·把 (w[0], w[1]) 设到 main canvas 中心
    var cv = ME.EDITOR.canvas;
    if (!cv) return;
    var z = ME.EDITOR.camera.zoom;
    ME.EDITOR.camera.x = cv.width / 2 - w[0] * z;
    ME.EDITOR.camera.y = cv.height / 2 - w[1] * z;
    ME.requestRender();
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.minimap = {
    init: init,
    render: render,
    schedule: schedule,
    setEnabled: function(b){
      _enabled = b;
      if (_canvas) _canvas.style.display = b ? 'block' : 'none';
    }
  };

})(typeof window !== 'undefined' ? window : this);
