// map-editor-culture-raster.js
// Phase 21.14·culture / religion 独立 raster layer
//
// 基于 byEthnicity / byFaith·插值生成 raster·overlay·CK3 风
// 算·每像素·找最近 division (centroid)·用其 dominant 色·插值边界 (距离 falloff)
//
// 切·Ctrl+Shift+U·culture·再 Ctrl+Shift+U·religion·再·关
//
// 2026-05-07

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[culture-raster] core not loaded'); return; }

  var _mode = 'off';   // 'off' | 'culture' | 'religion'
  var _canvas = null;
  var _hash = '';

  function dominantKey(byMap){
    if (!byMap) return null;
    var keys = Object.keys(byMap);
    if (!keys.length) return null;
    keys.sort(function(a, b){ return byMap[b] - byMap[a]; });
    return keys[0];
  }

  function getColor(d, mode){
    var L = TM.MapEditor.layers;
    if (!L) return null;
    if (mode === 'culture'){
      var k = dominantKey(d.byEthnicity);
      return k ? L.ETHNIC_COLOR[k] : null;
    }
    if (mode === 'religion'){
      var k2 = dominantKey(d.byFaith);
      return k2 ? L.FAITH_COLOR[k2] : null;
    }
    return null;
  }

  // 简易 hex → rgb
  function hexToRgb(hex){
    if (!hex) return [128, 128, 128];
    if (hex[0] === '#') hex = hex.slice(1);
    if (hex.length === 3){
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  // ─── build raster·coarse grid·每 step px 一格·扩到 bitmap 尺 ─

  // Exact 3-nearest search. Original entry order resolves equal-distance ties.
  function buildNearestTree(entries, depth){
    if (!entries.length) return null;
    var axis = depth % 2 ? 'y' : 'x', sorted = entries.slice().sort(function(a,b){ return a[axis]-b[axis] || a.order-b.order; }), mid = sorted.length >> 1;
    return { point: sorted[mid], axis: axis, left: buildNearestTree(sorted.slice(0,mid),depth+1), right: buildNearestTree(sorted.slice(mid+1),depth+1) };
  }
  function nearestThree(tree, x, y){
    var best = [];
    function visit(node){
      if (!node) return;
      var p = node.point, dx = p.x-x, dy = p.y-y, distance = dx*dx+dy*dy;
      if (distance < Infinity){
        var at = 0;
        while (at < best.length && (best[at].distance < distance || (best[at].distance === distance && best[at].entry.order < p.order))) at++;
        if (at < 3){ best.splice(at,0,{entry:p,distance:distance}); if (best.length>3) best.pop(); }
      }
      var delta = node.axis === 'x' ? x-p.x : y-p.y;
      visit(delta < 0 ? node.left : node.right);
      if (best.length < 3 || delta*delta <= best[2].distance) visit(delta < 0 ? node.right : node.left);
    }
    visit(tree); return best;
  }

  function buildRaster(){
    if (_mode === 'off'){
      _canvas = null; _hash = '';
      return null;
    }
    var map = ME.EDITOR.map;
    var bw = map.bitmapWidth || 1280, bh = map.bitmapHeight || 800;
    var divs = map.divisions || [];
    if (!divs.length){ _canvas = null; _hash = ''; return null; }

    // 提 centroid + color
    var entries = [];
    divs.forEach(function(d){
      var c = d.centroid;
      if (!c) return;
      var color = getColor(d, _mode);
      if (!color) return;
      var x = Number(c[0]), y = Number(c[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      entries.push({ x: x, y: y, rgb: hexToRgb(color), order: entries.length });
    });
    if (!entries.length){ _canvas = null; _hash = ''; return null; }
    // Validate every input that can change the rendered colors.
    var hash = _mode + ':' + bw + 'x' + bh + ':' + JSON.stringify(entries);
    if (_canvas && _hash === hash) return _canvas;
    var tree = buildNearestTree(entries, 0);

    // coarse·step px (e.g., 8)·结果 canvas 是 bw/8 × bh/8·然后 drawImage 缩到 bw × bh (smooth)
    var step = 8;
    var w = Math.ceil(bw / step);
    var h = Math.ceil(bh / step);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(w, h);
    var data = img.data;

    for (var y = 0; y < h; y++){
      for (var x = 0; x < w; x++){
        var wx = x * step;
        var wy = y * step;
        var hits = nearestThree(tree, wx, wy);
        var nearest = hits[0] && hits[0].entry, nDist = hits[0] ? hits[0].distance : Infinity;
        var second = hits[1] && hits[1].entry, sDist = hits[1] ? hits[1].distance : Infinity;
        var third = hits[2] && hits[2].entry, tDist = hits[2] ? hits[2].distance : Infinity;
        if (!nearest){
          var idx = (y * w + x) * 4;
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          continue;
        }
        // weights·1/d²
        var w1 = 1 / Math.max(1, nDist);
        var w2 = second ? 1 / Math.max(1, sDist) : 0;
        var w3 = third ? 1 / Math.max(1, tDist) : 0;
        var ws = w1 + w2 + w3;
        var r = (nearest.rgb[0] * w1 + (second ? second.rgb[0] : 0) * w2 + (third ? third.rgb[0] : 0) * w3) / ws;
        var g = (nearest.rgb[1] * w1 + (second ? second.rgb[1] : 0) * w2 + (third ? third.rgb[1] : 0) * w3) / ws;
        var b = (nearest.rgb[2] * w1 + (second ? second.rgb[2] : 0) * w2 + (third ? third.rgb[2] : 0) * w3) / ws;
        var idx2 = (y * w + x) * 4;
        data[idx2] = r | 0;
        data[idx2 + 1] = g | 0;
        data[idx2 + 2] = b | 0;
        data[idx2 + 3] = 180;
      }
    }
    ctx.putImageData(img, 0, 0);

    // 拉到全 size·smooth
    var c2 = document.createElement('canvas');
    c2.width = bw; c2.height = bh;
    var ctx2 = c2.getContext('2d');
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = 'high';
    ctx2.drawImage(c, 0, 0, bw, bh);

    _canvas = c2;
    _hash = hash;
    return c2;
  }

  // ─── render·overlay ──────────────────────────────────

  function render(ctx, camera){
    if (_mode === 'off') return;
    var c = buildRaster();
    if (!c) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  }

  // ─── toggle ────────────────────────────────────────────

  function setMode(m){
    if (m !== 'off' && m !== 'culture' && m !== 'religion') return;
    _mode = m;
    _hash = '';
    try { localStorage.setItem('me.cultureRaster', m); } catch(e){}
    ME.requestRender();
    if (global.meToast){
      meToast('文化层·' + (m === 'culture' ? '族群' : m === 'religion' ? '信仰' : '关'), 'info', 1500);
    }
  }

  function getMode(){ return _mode; }

  function cycleMode(){
    if (_mode === 'off') setMode('culture');
    else if (_mode === 'culture') setMode('religion');
    else setMode('off');
  }

  // ─── init ──────────────────────────────────────────────

  function init(){
    try {
      var v = localStorage.getItem('me.cultureRaster');
      if (v === 'culture' || v === 'religion') _mode = v;
    } catch(e){}
    document.addEventListener('keydown', function(e){
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.ctrlKey && e.altKey && (e.key === 'u' || e.key === 'U')){
        e.preventDefault();
        cycleMode();
      }
    });
    // 数据变·重 build
    ME.on('mutation', function(){ ME.requestRender(); });
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.cultureRaster = {
    init: init,
    render: render,
    setMode: setMode,
    getMode: getMode,
    cycleMode: cycleMode
  };

})(typeof window !== 'undefined' ? window : this);
