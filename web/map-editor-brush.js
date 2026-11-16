// map-editor-brush.js
// 刷子工具·bitmap mask + Moore-neighbor 边追 + RDP 简化
// 选中单个 division → 进入 brush → 绘 add/subtract 圆 → mouseup 提交
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[brush] core not loaded'); return; }

  var DEFAULT_BRUSH_SIZE = 20;        // world px·radius
  var DEFAULT_RESOLUTION = 1;         // mask px / world px·1=同尺度·>1=高分辨率
  var MIN_AREA_PX = 50;               // mask 块若 < 此·丢弃
  var RDP_EPS = 1.5;                  // 简化阈值·world px
  var BORDER_PAD = 6;                 // mask 四周留白·避免 brush 触底

  // ─── state ─────────────────────────────────────────────────

  function getState(){
    return ME.EDITOR.brushState;
  }

  function ensureState(){
    if (!ME.EDITOR.brushState){
      ME.EDITOR.brushState = {
        active: false,
        divId: null,
        ringKind: 'polygon',     // 'polygon' | 'extra' | 'hole'
        polyIdx: 0,              // for extra/hole
        mode: 'add',             // 'add' | 'subtract'
        brushSize: DEFAULT_BRUSH_SIZE,
        maskCanvas: null,
        maskCtx: null,
        maskOriginX: 0,          // world px·mask (0,0) 对应世界坐标
        maskOriginY: 0,
        maskWidth: 0,
        maskHeight: 0,
        resolution: DEFAULT_RESOLUTION,
        painting: false,
        lastWX: 0,
        lastWY: 0,
        previewWX: 0,
        previewWY: 0,
        showPreview: false,
        dirty: false
      };
    }
    return ME.EDITOR.brushState;
  }

  // ─── ring management ───────────────────────────────────────

  function getCurrentRing(){
    var s = getState();
    if (!s.divId) return null;
    var d = findDivision(s.divId);
    if (!d) return null;
    if (s.ringKind === 'polygon') return d.polygon;
    if (s.ringKind === 'extra') return (d.extraPolygons || [])[s.polyIdx] || null;
    if (s.ringKind === 'hole') return (d.holes || [])[s.polyIdx] || null;
    return null;
  }

  function setCurrentRing(d, ring){
    var s = getState();
    if (s.ringKind === 'polygon') d.polygon = ring;
    else if (s.ringKind === 'extra') d.extraPolygons[s.polyIdx] = ring;
    else if (s.ringKind === 'hole') d.holes[s.polyIdx] = ring;
  }

  function findDivision(id){
    var divs = ME.EDITOR.map.divisions;
    for (var i = 0; i < divs.length; i++) if (divs[i].id === id) return divs[i];
    return null;
  }

  // ─── mask init·从 ring 渲染填充 ────────────────────────────

  function initMaskFromRing(ring){
    var s = ensureState();
    if (!ring || ring.length < 3) return false;

    var bbox = ringBBox(ring);
    var pad = Math.max(BORDER_PAD, s.brushSize * 2);
    var w = Math.ceil((bbox.maxX - bbox.minX + pad * 2) * s.resolution);
    var h = Math.ceil((bbox.maxY - bbox.minY + pad * 2) * s.resolution);

    if (w <= 0 || h <= 0 || w > 4096 || h > 4096){
      console.warn('[brush] mask size invalid', w, h);
      return false;
    }

    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');

    s.maskCanvas = c;
    s.maskCtx = ctx;
    s.maskOriginX = bbox.minX - pad;
    s.maskOriginY = bbox.minY - pad;
    s.maskWidth = w;
    s.maskHeight = h;

    // 填 ring 到 mask·world → mask 坐标
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    var p0 = ringToMask(ring[0]);
    ctx.moveTo(p0[0], p0[1]);
    for (var i = 1; i < ring.length; i++){
      var p = ringToMask(ring[i]);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fill();
    return true;
  }

  function ringToMask(p){
    var s = getState();
    return [
      (p[0] - s.maskOriginX) * s.resolution,
      (p[1] - s.maskOriginY) * s.resolution
    ];
  }

  function maskToWorld(mx, my){
    var s = getState();
    return [
      mx / s.resolution + s.maskOriginX,
      my / s.resolution + s.maskOriginY
    ];
  }

  function ringBBox(ring){
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < ring.length; i++){
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  // ─── paint·圆 brush·支持线段插值 ───────────────────────────

  // 移植 S2.4c·笔压 → 笔刷半径系数（仅 pen 指针·pressure 0..1 → 0.35..1.0；触屏/鼠标恒 1）
  function _penScale(e){
    return (e && e.pointerType === 'pen' && e.pressure > 0) ? (0.35 + 0.65 * Math.min(1, e.pressure)) : 1;
  }

  function paintAt(wx, wy){
    var s = getState();
    if (!s.maskCtx) return;
    var p = ringToMask([wx, wy]);
    var r = s.brushSize * s.resolution * (s.pressureScale || 1);
    var ctx = s.maskCtx;

    if (s.mode === 'add'){
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
    }
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    s.dirty = true;
  }

  function paintLine(wx0, wy0, wx1, wy1){
    var dx = wx1 - wx0, dy = wy1 - wy0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var s = getState();
    var step = Math.max(1, s.brushSize * 0.4);
    var n = Math.ceil(dist / step);
    if (n <= 1){ paintAt(wx1, wy1); return; }
    for (var i = 1; i <= n; i++){
      var t = i / n;
      paintAt(wx0 + dx * t, wy0 + dy * t);
    }
  }

  // ─── tracing·Moore-neighbor·8-邻接 ─────────────────────────

  function getMaskData(){
    var s = getState();
    if (!s.maskCtx) return null;
    return s.maskCtx.getImageData(0, 0, s.maskWidth, s.maskHeight);
  }

  function isFg(data, x, y, w, h){
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    var idx = (y * w + x) * 4 + 3; // alpha
    return data[idx] > 127;
  }

  function findStartPixel(data, w, h){
    // 扫·首个 fg 像素
    for (var y = 0; y < h; y++){
      for (var x = 0; x < w; x++){
        if (isFg(data, x, y, w, h)) return [x, y];
      }
    }
    return null;
  }

  // Moore-neighbor·从 start 沿 fg 边追·返回 mask 像素轮廓
  // 邻向·CW· [dx,dy]
  var MOORE_DIRS = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1]
  ];

  function trace(data, w, h, start){
    var contour = [start.slice()];
    var curr = start.slice();
    // 起方向·从入像素朝当前·入即虚拟 [start[0]-1, start[1]] (左)
    var prev = [start[0] - 1, start[1]];
    var maxSteps = w * h * 2;
    var steps = 0;

    while (steps++ < maxSteps){
      // 求 prev 在 curr 周围的 8-向 idx
      var dx = prev[0] - curr[0], dy = prev[1] - curr[1];
      var startDir = -1;
      for (var i = 0; i < 8; i++){
        if (MOORE_DIRS[i][0] === dx && MOORE_DIRS[i][1] === dy){ startDir = i; break; }
      }
      if (startDir < 0) startDir = 4; // fallback

      // 从 startDir 顺 CW 找下个 fg 邻
      var found = false;
      for (var k = 1; k <= 8; k++){
        var dir = (startDir + k) % 8;
        var nx = curr[0] + MOORE_DIRS[dir][0];
        var ny = curr[1] + MOORE_DIRS[dir][1];
        if (isFg(data, nx, ny, w, h)){
          prev = curr.slice();
          curr = [nx, ny];
          contour.push([nx, ny]);
          found = true;
          break;
        }
      }
      if (!found) break; // 孤立 px
      // 终止·回到 start 且 prev 与初始入向一致
      if (curr[0] === start[0] && curr[1] === start[1] && contour.length > 2){
        contour.pop();
        break;
      }
    }
    return contour;
  }

  // ─── RDP simplify ─────────────────────────────────────────

  function rdp(points, eps){
    if (points.length < 3) return points.slice();
    var out = [points[0]];
    var stack = [[0, points.length - 1]];
    // 迭代式·避深递
    var work = [];
    work.push([0, points.length - 1]);
    var marks = new Uint8Array(points.length);
    marks[0] = 1; marks[points.length - 1] = 1;
    while (work.length){
      var seg = work.pop();
      var lo2 = seg[0], hi2 = seg[1];
      var mx = 0, mi = -1;
      var a2 = points[lo2], b2 = points[hi2];
      for (var j = lo2 + 1; j < hi2; j++){
        var dd = pointSegDist(points[j], a2, b2);
        if (dd > mx){ mx = dd; mi = j; }
      }
      if (mx > eps && mi > 0){
        marks[mi] = 1;
        work.push([lo2, mi]);
        work.push([mi, hi2]);
      }
    }
    var result = [];
    for (var k = 0; k < points.length; k++) if (marks[k]) result.push(points[k]);
    return result;
  }

  function pointSegDist(p, a, b){
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-9){
      var ex = p[0] - a[0], ey = p[1] - a[1];
      return Math.sqrt(ex * ex + ey * ey);
    }
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var px = a[0] + t * dx, py = a[1] + t * dy;
    var ex2 = p[0] - px, ey2 = p[1] - py;
    return Math.sqrt(ex2 * ex2 + ey2 * ey2);
  }

  // ─── commit·从 mask 提取 ring → 替换 division ring ─────────

  function commit(){
    var s = getState();
    if (!s.dirty) return false;
    var data = getMaskData();
    if (!data) return false;
    var d = findDivision(s.divId);
    if (!d) return false;

    var w = s.maskWidth, h = s.maskHeight;
    var pixels = data.data;
    var start = findStartPixel(pixels, w, h);
    if (!start){
      // mask 全清空·若 hole 删空 / extra 删空·主 polygon 不允许变 0
      if (s.ringKind === 'hole'){
        ME.commitMutation('brush·删 hole', function(){
          d.holes.splice(s.polyIdx, 1);
          if (d.holesVids) d.holesVids.splice(s.polyIdx, 1);
        });
      } else if (s.ringKind === 'extra'){
        ME.commitMutation('brush·删飞地', function(){
          d.extraPolygons.splice(s.polyIdx, 1);
          if (d.extraPolygonsVids) d.extraPolygonsVids.splice(s.polyIdx, 1);
        });
      } else {
        meAlert('刷子·主 polygon 不可全擦');
        return false;
      }
      ME.recomputeDerived(d);
      syncTopology(d);
      s.dirty = false;
      return true;
    }

    var contour = trace(pixels, w, h, start);
    if (contour.length < 3) return false;

    // mask px → world
    var worldPts = contour.map(function(p){ return maskToWorld(p[0], p[1]); });
    var simplified = rdp(worldPts, RDP_EPS);
    if (simplified.length < 3){
      meAlert('刷子·提取轮廓 < 3 顶点');
      return false;
    }

    var label = s.ringKind === 'polygon' ? 'brush·主形' :
                s.ringKind === 'extra'   ? 'brush·飞地·' + s.polyIdx :
                                           'brush·圈·' + s.polyIdx;
    ME.commitMutation(label, function(){
      setCurrentRing(d, simplified);
      // vid 数组 invalidate·将由 topology re-sync 重建
      if (s.ringKind === 'polygon') d.polygonVids = null;
      else if (s.ringKind === 'extra' && d.extraPolygonsVids) d.extraPolygonsVids[s.polyIdx] = null;
      else if (s.ringKind === 'hole' && d.holesVids) d.holesVids[s.polyIdx] = null;
    });
    ME.recomputeDerived(d);
    syncTopology(d);
    s.dirty = false;

    // 提交后·重建 mask 以反映新 ring (可继续刷)
    initMaskFromRing(getCurrentRing());
    return true;
  }

  function syncTopology(d){
    if (global.TM && TM.MapEditor.topology && TM.MapEditor.topology.isEnabled()){
      TM.MapEditor.topology.removeDivisionFromTopology(d.id);
      TM.MapEditor.topology.syncDivisionToTopology(ME.EDITOR.map, d);
    }
  }

  // ─── enter / exit ─────────────────────────────────────────

  function enter(opts){
    opts = opts || {};
    var sel = ME.EDITOR.selectedIds;
    if (sel.length !== 1){
      meAlert('刷子·需先选中且仅 1 个 division');
      return false;
    }
    var d = findDivision(sel[0]);
    if (!d){
      meAlert('刷子·选中 division 未找到');
      return false;
    }

    var s = ensureState();
    s.divId = d.id;
    s.ringKind = opts.ringKind || 'polygon';
    s.polyIdx = opts.polyIdx || 0;
    s.mode = opts.mode || 'add';
    s.brushSize = opts.brushSize || DEFAULT_BRUSH_SIZE;
    s.dirty = false;

    var ring = getCurrentRing();
    if (!ring || ring.length < 3){
      meAlert('刷子·目标 ring 无效');
      return false;
    }
    if (!initMaskFromRing(ring)){
      meAlert('刷子·mask 初始化失败');
      return false;
    }
    s.active = true;
    ME.setTool('brush');
    var statusEl = document.getElementById('status-tip');
    if (statusEl) statusEl.textContent = '刷子·' + (s.mode === 'add' ? '加' : '减') +
                                          '·R=' + s.brushSize + '·目标·' + s.ringKind;
    ME.requestRender();
    return true;
  }

  function exit(commitFinal){
    var s = getState();
    if (!s || !s.active) return;
    if (commitFinal && s.dirty) commit();
    s.active = false;
    s.divId = null;
    s.maskCanvas = null;
    s.maskCtx = null;
    s.dirty = false;
    s.painting = false;
    ME.requestRender();
  }

  // ─── input·mouse hooks ────────────────────────────────────

  function onMouseDown(wx, wy, e){
    var s = getState();
    if (!s || !s.active) return false;
    if (e.button === 2){
      // 右键·切 add/subtract
      s.mode = s.mode === 'add' ? 'subtract' : 'add';
      var statusEl = document.getElementById('status-tip');
      if (statusEl) statusEl.textContent = '刷子·' + (s.mode === 'add' ? '加' : '减');
      return true;
    }
    s.painting = true;
    s.lastWX = wx; s.lastWY = wy;
    s.pressureScale = _penScale(e);   // S2.4c·笔压（仅笔·触屏/鼠标=1）
    paintAt(wx, wy);
    ME.requestRender();
    return true;
  }

  function onMouseMove(wx, wy, e){
    var s = getState();
    if (!s || !s.active) return false;
    s.previewWX = wx; s.previewWY = wy;
    s.showPreview = true;
    if (s.painting){
      s.pressureScale = _penScale(e);   // S2.4c·笔压
      paintLine(s.lastWX, s.lastWY, wx, wy);
      s.lastWX = wx; s.lastWY = wy;
    }
    ME.requestRender();
    return true;
  }

  function onMouseUp(wx, wy, e){
    var s = getState();
    if (!s || !s.active) return false;
    if (s.painting){
      s.painting = false;
      commit();
      ME.requestRender();
    }
    return true;
  }

  function onWheel(deltaY, e){
    var s = getState();
    if (!s || !s.active) return false;
    if (e.shiftKey){
      var d = deltaY > 0 ? -2 : 2;
      s.brushSize = Math.max(2, Math.min(200, s.brushSize + d));
      var statusEl = document.getElementById('status-tip');
      if (statusEl) statusEl.textContent = '刷子·R=' + s.brushSize;
      ME.requestRender();
      return true;
    }
    return false;
  }

  function onKeyDown(e){
    var s = getState();
    if (!s || !s.active) return false;
    if (e.key === 'Escape'){ exit(false); return true; }
    if (e.key === 'Enter'){ exit(true); return true; }
    if (e.key === '['){
      s.brushSize = Math.max(2, s.brushSize - 2);
      ME.requestRender(); return true;
    }
    if (e.key === ']'){
      s.brushSize = Math.min(200, s.brushSize + 2);
      ME.requestRender(); return true;
    }
    if (e.key === 'a' || e.key === 'A'){
      s.mode = 'add'; ME.requestRender(); return true;
    }
    if (e.key === 's' || e.key === 'S'){
      s.mode = 'subtract'; ME.requestRender(); return true;
    }
    return false;
  }

  // ─── render·overlay mask + preview brush ──────────────────

  function renderOverlay(ctx, camera){
    var s = getState();
    if (!s || !s.active || !s.maskCanvas) return;
    // 注·此处 ctx 已 camera-transform·所有坐标用 world
    ctx.save();

    // 半透明覆 mask 内容·世界坐标 drawImage
    var worldX = s.maskOriginX;
    var worldY = s.maskOriginY;
    var worldW = s.maskWidth / s.resolution;
    var worldH = s.maskHeight / s.resolution;

    ctx.globalAlpha = 0.30;
    ctx.drawImage(s.maskCanvas, worldX, worldY, worldW, worldH);

    // brush 圈 preview·world coords
    if (s.showPreview){
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeStyle = s.mode === 'add' ? '#42d18a' : '#dc4f3a';
      ctx.beginPath();
      ctx.arc(s.previewWX, s.previewWY, s.brushSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = s.mode === 'add' ? '#42d18a' : '#dc4f3a';
      ctx.fill();
    }

    ctx.restore();
  }

  // ─── expose ───────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.brush = {
    enter: enter,
    exit: exit,
    onMouseDown: onMouseDown,
    onMouseMove: onMouseMove,
    onMouseUp: onMouseUp,
    onWheel: onWheel,
    onKeyDown: onKeyDown,
    renderOverlay: renderOverlay,
    commit: commit,
    setMode: function(m){ var s = ensureState(); s.mode = m; ME.requestRender(); },
    setBrushSize: function(r){ var s = ensureState(); s.brushSize = Math.max(2, Math.min(200, r)); ME.requestRender(); },
    setRing: function(kind, idx){ var s = ensureState(); s.ringKind = kind; s.polyIdx = idx || 0; },
    isActive: function(){ var s = getState(); return s && s.active; },
    getState: getState
  };

})(typeof window !== 'undefined' ? window : this);
