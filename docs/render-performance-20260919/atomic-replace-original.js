// map-editor-rastermaps.js
// HeightMap + TerrainMap·raster overlay layer
// 借鉴 SGGameEditor HeightMapEntity·DrawHeightBrush·FloodFillHeightMap·CanvasPointToHeightMap
//                   ProvinceTerrainBrush·FloodFillTerrainMap
//
// schema·添到 map·
//   map.heightMap  = { width, height, dataB64 (image/png 序), unit ('m'·默) }
//   map.terrainMap = { width, height, dataB64, palette: { idx → terrain string } }
//
// 运行时·_canvas (offscreen)·_data (Uint8ClampedArray)·从 dataB64 lazy-decode
//
// 工具·'paint-height'·'paint-terrain'·click drag·brush size 由 EDITOR._rasterBrushSize
// brush mode·draw / fill / erase·切于 EDITOR._rasterBrushMode
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[rastermaps] core not loaded'); return; }

  var DEFAULT_BRUSH = 12;        // 世界 px
  var TERRAIN_PALETTE = {
    0: { key: 'plains',   label: '平原', color: [144, 168, 96] },
    1: { key: 'forest',   label: '林',   color: [70, 110, 60] },
    2: { key: 'hill',     label: '丘陵', color: [180, 158, 100] },
    3: { key: 'mountain', label: '山',   color: [120, 110, 100] },
    4: { key: 'desert',   label: '荒漠', color: [220, 190, 130] },
    5: { key: 'marsh',    label: '湿地', color: [120, 140, 130] },
    6: { key: 'water',    label: '水',   color: [80, 130, 175] },
    7: { key: 'tundra',   label: '冻土', color: [200, 210, 220] },
    8: { key: 'jungle',   label: '密林', color: [40, 90, 50] },
    9: { key: 'savanna',  label: '草原', color: [200, 180, 100] }
    // 0..255 留扩展
  };

  // ─── runtime cache·non-persistent ───────────────────────

  // 以 non-enumerable 定义运行时字段·使 JSON.stringify(map) 不把运行时缓存写进存档
  // (修复·terrainMap/heightMap 的 _data 等被 exportJSON/exportGamePMap/scenario/localStorage 误存·存档膨胀 ~32x)
  function defineRuntimeField(L, key, val){
    Object.defineProperty(L, key, { value: val, writable: true, enumerable: false, configurable: true });
  }

  function ensureLayer(layerName, opts){
    opts = opts || {};
    var map = ME.EDITOR.map;
    var src = map[layerName];
    var w = opts.width || (src && src.width) || map.bitmapWidth || 1280;
    var h = opts.height || (src && src.height) || map.bitmapHeight || 800;

    if (!map[layerName]){
      map[layerName] = { width: w, height: h, dataB64: null, unit: 'm' };
      if (layerName === 'terrainMap') map[layerName].palette = TERRAIN_PALETTE;
    }
    var L = map[layerName];

    // 历史存档可能把运行时字段(旧 bug)误存进 JSON·加载后 _canvas 是普通对象而非真 canvas·
    // 须丢弃重建·否则渲染失败且再次存档继续膨胀(加载旧膨胀文件会被此处自愈)
    if (L._canvas && typeof L._canvas.getContext !== 'function'){
      ['_canvas','_ctx','_data','_dirty','_version','_coloredCanvas','_heatCanvas'].forEach(function(k){
        try { delete L[k]; } catch(e){}
      });
    }

    // runtime cache·_canvas (off-screen)·_data (per-px byte)·全部 non-enumerable·不进存档
    if (!L._canvas){
      var c = document.createElement('canvas');
      c.width = L.width; c.height = L.height;
      var ctx = c.getContext('2d');
      // 若 dataB64 已存·decode
      if (L.dataB64){
        var img = new Image();
        img.onload = function(){
          ctx.drawImage(img, 0, 0);
          syncDataFromCanvas(L);
          ME.requestRender();
        };
        img.src = L.dataB64;
      } else {
        ctx.fillStyle = layerName === 'heightMap' ? '#000000' : 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, L.width, L.height);
      }
      defineRuntimeField(L, '_canvas', c);
      defineRuntimeField(L, '_ctx', ctx);
      defineRuntimeField(L, '_data', null);   // lazy init when needed
      defineRuntimeField(L, '_dirty', false);
      defineRuntimeField(L, '_version', 0);
      defineRuntimeField(L, '_coloredCanvas', null); // 预声明·后续赋值保持 non-enumerable
      defineRuntimeField(L, '_heatCanvas', null);
    }
    return L;
  }

  function syncDataFromCanvas(L){
    var imd = L._ctx.getImageData(0, 0, L.width, L.height);
    // 用 R 通道作 value (heightMap·terrainMap 都同·alpha 表示有/无)
    var n = L.width * L.height;
    var arr = new Uint8Array(n);
    for (var i = 0; i < n; i++){
      var a = imd.data[i * 4 + 3];
      arr[i] = a > 127 ? imd.data[i * 4] : 0;
    }
    L._data = arr;
  }

  function getData(L){
    if (!L._data){
      // 初始化·全 0
      L._data = new Uint8Array(L.width * L.height);
    }
    return L._data;
  }

  // ─── px-level access ────────────────────────────────────

  function setPx(L, x, y, value, alpha){
    if (x < 0 || y < 0 || x >= L.width || y >= L.height) return;
    var data = getData(L);
    data[y * L.width + x] = value;
    // canvas 同步·一像素 putImageData
    var imd = L._ctx.createImageData(1, 1);
    var v = value;
    imd.data[0] = v;
    imd.data[1] = v;
    imd.data[2] = v;
    imd.data[3] = alpha == null ? 255 : alpha;
    L._ctx.putImageData(imd, x, y);
    L._dirty = true; L._version = (L._version || 0) + 1;
  }

  function getPx(L, x, y){
    if (x < 0 || y < 0 || x >= L.width || y >= L.height) return 0;
    return getData(L)[y * L.width + x];
  }

  // ─── 圆 brush·画 (paint) / 擦 (erase) ────────────────────

  function paintCircle(L, cx, cy, r, value, mode){
    // mode: 'draw' (覆) | 'erase' (清·alpha=0)
    var data = getData(L);
    var x0 = Math.max(0, Math.floor(cx - r));
    var y0 = Math.max(0, Math.floor(cy - r));
    var x1 = Math.min(L.width - 1, Math.ceil(cx + r));
    var y1 = Math.min(L.height - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    var w = x1 - x0 + 1, h = y1 - y0 + 1;

    var imd = L._ctx.getImageData(x0, y0, w, h);
    var r2 = r * r;
    for (var y = y0; y <= y1; y++){
      for (var x = x0; x <= x1; x++){
        var dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy > r2) continue;
        var idx = (y - y0) * w + (x - x0);
        if (mode === 'erase'){
          imd.data[idx*4 + 3] = 0;
          data[y * L.width + x] = 0;
        } else {
          imd.data[idx*4]   = value;
          imd.data[idx*4+1] = value;
          imd.data[idx*4+2] = value;
          imd.data[idx*4+3] = 255;
          data[y * L.width + x] = value;
        }
      }
    }
    L._ctx.putImageData(imd, x0, y0);
    L._dirty = true; L._version = (L._version || 0) + 1;
  }

  // ─── flood fill ─────────────────────────────────────────

  function floodFill(L, sx, sy, newValue){
    sx = Math.round(sx); sy = Math.round(sy);
    if (sx < 0 || sy < 0 || sx >= L.width || sy >= L.height) return 0;
    var data = getData(L);
    var oldValue = data[sy * L.width + sx];
    if (oldValue === newValue) return 0;

    var stack = [[sx, sy]];
    var w = L.width, h = L.height;
    var changed = 0;
    while (stack.length){
      var p = stack.pop();
      var x = p[0], y = p[1];
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      var i = y * w + x;
      if (data[i] !== oldValue) continue;
      data[i] = newValue;
      changed++;
      stack.push([x+1,y]); stack.push([x-1,y]);
      stack.push([x,y+1]); stack.push([x,y-1]);
    }
    rebuildCanvas(L);
    L._dirty = true; L._version = (L._version || 0) + 1;
    return changed;
  }

  function rebuildCanvas(L){
    var imd = L._ctx.createImageData(L.width, L.height);
    var data = getData(L);
    for (var i = 0; i < data.length; i++){
      var v = data[i];
      imd.data[i*4] = v;
      imd.data[i*4+1] = v;
      imd.data[i*4+2] = v;
      imd.data[i*4+3] = v > 0 ? 255 : 0;
    }
    L._ctx.putImageData(imd, 0, 0);
  }

  // ─── load·save ──────────────────────────────────────────

  function loadFromImageFile(layerName, file, opts){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function(){
        var L = ensureLayer(layerName, { width: img.width, height: img.height });
        L._canvas.width = img.width; L._canvas.height = img.height;
        L.width = img.width; L.height = img.height;
        L._ctx.drawImage(img, 0, 0);
        syncDataFromCanvas(L);
        L._dirty = true; L._version = (L._version || 0) + 1;
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function saveToBase64(layerName){
    var L = ME.EDITOR.map[layerName];
    if (!L || !L._canvas) return null;
    var b64 = L._canvas.toDataURL('image/png');
    L.dataB64 = b64;
    L._dirty = false;
    return b64;
  }

  function downloadAsPNG(layerName, filename){
    var L = ME.EDITOR.map[layerName];
    if (!L || !L._canvas){ meAlert(layerName + ' 未初始化'); return; }
    L._canvas.toBlob(function(blob){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || (layerName + '.png');
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    });
  }

  // ─── render·overlay ─────────────────────────────────────

  function renderLayer(ctx, camera, layerName, opts){
    opts = opts || {};
    var L = ME.EDITOR.map[layerName];
    if (!L || !L._canvas) return;
    var alpha = opts.alpha != null ? opts.alpha : 0.55;

    if (layerName === 'terrainMap'){
      // 把 raw byte → terrain palette·建 colored canvas (lazy + cache)
      ensureColoredTerrainCanvas(L);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(L._coloredCanvas || L._canvas, 0, 0);
      ctx.restore();
      return;
    }

    // heightMap·灰 → heat 渐变·或纯灰
    if (opts.style === 'heatmap'){
      ensureHeatmapCanvas(L);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(L._heatCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(L._canvas, 0, 0);
      ctx.restore();
    }
  }

  function ensureColoredTerrainCanvas(L){
    if (L._coloredCanvas && !L._dirty) return L._coloredCanvas;
    var c = document.createElement('canvas');
    c.width = L.width; c.height = L.height;
    var ctx = c.getContext('2d');
    var imd = ctx.createImageData(L.width, L.height);
    var data = getData(L);
    var pal = L.palette || TERRAIN_PALETTE;
    for (var i = 0; i < data.length; i++){
      var v = data[i];
      var entry = pal[v];
      if (!entry || v === 0){ imd.data[i*4+3] = 0; continue; }
      imd.data[i*4]   = entry.color[0];
      imd.data[i*4+1] = entry.color[1];
      imd.data[i*4+2] = entry.color[2];
      imd.data[i*4+3] = 255;
    }
    ctx.putImageData(imd, 0, 0);
    L._coloredCanvas = c;
    return c;
  }

  function ensureHeatmapCanvas(L){
    if (L._heatCanvas && !L._dirty) return L._heatCanvas;
    var c = document.createElement('canvas');
    c.width = L.width; c.height = L.height;
    var ctx = c.getContext('2d');
    var imd = ctx.createImageData(L.width, L.height);
    var data = getData(L);
    for (var i = 0; i < data.length; i++){
      var v = data[i];
      if (v === 0){ imd.data[i*4+3] = 0; continue; }
      // 简易 heatmap·blue (低) → green → yellow → red (高)
      var t = v / 255;
      var r, g, b;
      if (t < 0.25){ r = 0; g = Math.round(t * 4 * 255); b = 255; }
      else if (t < 0.5){ r = 0; g = 255; b = Math.round((0.5 - t) * 4 * 255); }
      else if (t < 0.75){ r = Math.round((t - 0.5) * 4 * 255); g = 255; b = 0; }
      else { r = 255; g = Math.round((1 - t) * 4 * 255); b = 0; }
      imd.data[i*4] = r;
      imd.data[i*4+1] = g;
      imd.data[i*4+2] = b;
      imd.data[i*4+3] = 200;
    }
    ctx.putImageData(imd, 0, 0);
    L._heatCanvas = c;
    return c;
  }

  // ─── pick at world coord ────────────────────────────────

  function pickAt(layerName, wx, wy){
    var L = ME.EDITOR.map[layerName];
    if (!L) return null;
    var x = Math.round(wx), y = Math.round(wy);
    return getPx(L, x, y);
  }

  // ─── tool callbacks ─────────────────────────────────────

  function getCurrentBrushSize(){
    return ME.EDITOR._rasterBrushSize || DEFAULT_BRUSH;
  }
  function getCurrentBrushMode(){
    return ME.EDITOR._rasterBrushMode || 'draw';
  }
  function getCurrentValue(layerName){
    if (layerName === 'heightMap'){
      return ME.EDITOR._rasterHeightValue != null ? ME.EDITOR._rasterHeightValue : 128;
    }
    return ME.EDITOR._rasterTerrainValue != null ? ME.EDITOR._rasterTerrainValue : 1;
  }
  function setBrushSize(s){ ME.EDITOR._rasterBrushSize = Math.max(1, Math.min(200, s)); }
  function setBrushMode(m){ ME.EDITOR._rasterBrushMode = m; }
  function setValue(layerName, v){
    if (layerName === 'heightMap') ME.EDITOR._rasterHeightValue = v;
    else ME.EDITOR._rasterTerrainValue = v;
  }

  function onMouseDown(layerName, wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (e.button !== 0) return false;
    var L = ensureLayer(layerName);
    var mode = getCurrentBrushMode();
    var r = getCurrentBrushSize();
    var v = getCurrentValue(layerName);

    if (mode === 'fill'){
      ME.commitMutation(layerName + ' fill', function(){
        floodFill(L, wx, wy, v);
      });
      ME.requestRender();
      return true;
    }

    EDITOR._rasterPainting = { layer: layerName, lastX: wx, lastY: wy };
    paintCircle(L, wx, wy, r, v, mode);
    ME.requestRender();
    return true;
  }

  function onMouseMove(layerName, wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (!EDITOR._rasterPainting || EDITOR._rasterPainting.layer !== layerName) return false;
    var L = ensureLayer(layerName);
    var r = getCurrentBrushSize();
    var v = getCurrentValue(layerName);
    var mode = getCurrentBrushMode();
    var lx = EDITOR._rasterPainting.lastX, ly = EDITOR._rasterPainting.lastY;
    // 沿线插值
    var dx = wx - lx, dy = wy - ly;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var step = Math.max(1, r * 0.4);
    var n = Math.ceil(dist / step);
    if (n <= 1) paintCircle(L, wx, wy, r, v, mode);
    else for (var i = 1; i <= n; i++){
      var t = i / n;
      paintCircle(L, lx + dx * t, ly + dy * t, r, v, mode);
    }
    EDITOR._rasterPainting.lastX = wx;
    EDITOR._rasterPainting.lastY = wy;
    ME.requestRender();
    return true;
  }

  function onMouseUp(layerName, wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (!EDITOR._rasterPainting) return false;
    EDITOR._rasterPainting = null;
    // 把当前 mutation 标 dirty + commit snapshot
    ME.fire('mutation', { label: layerName + ' brush stroke' });
    EDITOR.dirty = true;
    return true;
  }

  function onKeyDown(layerName, e){
    var k = e.key;
    if (k === '['){ setBrushSize(getCurrentBrushSize() - 2); return true; }
    if (k === ']'){ setBrushSize(getCurrentBrushSize() + 2); return true; }
    if (k === 'd' || k === 'D'){ setBrushMode('draw'); return true; }
    if (k === 'f' || k === 'F'){ setBrushMode('fill'); return true; }
    if (k === 'x' || k === 'X'){ setBrushMode('erase'); return true; }
    return false;
  }

  // ─── pre-save·把 raster bake 到 dataB64 ────────────────

  function commitToBase64IfDirty(layerName){
    var L = ME.EDITOR.map[layerName];
    if (!L || !L._dirty || !L._canvas) return;
    L.dataB64 = L._canvas.toDataURL('image/png');
    L._dirty = false;
  }

  function commitAllDirty(){
    commitToBase64IfDirty('heightMap');
    commitToBase64IfDirty('terrainMap');
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.rastermaps = {
    TERRAIN_PALETTE: TERRAIN_PALETTE,
    DEFAULT_BRUSH: DEFAULT_BRUSH,

    ensureLayer: ensureLayer,
    getPx: getPx,
    setPx: setPx,
    paintCircle: paintCircle,
    floodFill: floodFill,
    pickAt: pickAt,
    rebuildCanvas: rebuildCanvas,

    loadFromImageFile: loadFromImageFile,
    saveToBase64: saveToBase64,
    downloadAsPNG: downloadAsPNG,
    commitToBase64IfDirty: commitToBase64IfDirty,
    commitAllDirty: commitAllDirty,

    renderLayer: renderLayer,

    setBrushSize: setBrushSize,
    setBrushMode: setBrushMode,
    setValue: setValue,
    onMouseDown: onMouseDown,
    onMouseMove: onMouseMove,
    onMouseUp: onMouseUp,
    onKeyDown: onKeyDown,

    height: {
      pickAt: function(wx, wy){ return pickAt('heightMap', wx, wy); }
    },
    terrain: {
      pickAt: function(wx, wy){ return pickAt('terrainMap', wx, wy); }
    }
  };

})(typeof window !== 'undefined' ? window : this);
