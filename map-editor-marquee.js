// map-editor-marquee.js
// Phase 16.1·rectangle marquee + lasso 圈选
// 在 select 工具下·空地 drag 起 marquee·按 L drag = lasso
// modifier·shift = 加·ctrl/meta = toggle·alt = 减·无 = 替换
//
// 同属性 / inverse selection·提供 helper·由 palette / 批量 panel 调
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[marquee] core not loaded'); return; }

  var DRAG_THRESHOLD = 4;     // 屏幕 px·拖距阈

  // ─── state ───────────────────────────────────────────────

  function getState(){
    return ME.EDITOR._marquee;
  }

  function ensureState(){
    if (!ME.EDITOR._marquee){
      ME.EDITOR._marquee = {
        active: false,
        kind: null,            // 'rect' | 'lasso'
        startX: 0, startY: 0,  // 世界·初点
        endX: 0, endY: 0,      // 世界·当前点
        path: null,            // lasso·世界 [[x,y],...]
        dragged: false,
        baseSelection: null    // 起拖时·已有 selection (modifier 用)
      };
    }
    return ME.EDITOR._marquee;
  }

  function isActive(){ var s = getState(); return !!(s && s.active); }

  // ─── start ──────────────────────────────────────────────

  function startRect(wx, wy){
    var s = ensureState();
    s.active = true;
    s.kind = 'rect';
    s.startX = wx; s.startY = wy;
    s.endX = wx; s.endY = wy;
    s.path = null;
    s.dragged = false;
    s.baseSelection = ME.EDITOR.selectedIds.slice();
  }

  function startLasso(wx, wy){
    var s = ensureState();
    s.active = true;
    s.kind = 'lasso';
    s.startX = wx; s.startY = wy;
    s.endX = wx; s.endY = wy;
    s.path = [[wx, wy]];
    s.dragged = false;
    s.baseSelection = ME.EDITOR.selectedIds.slice();
  }

  // ─── update ─────────────────────────────────────────────

  function update(wx, wy){
    var s = getState();
    if (!s || !s.active) return;
    s.endX = wx; s.endY = wy;
    var dx = wx - s.startX, dy = wy - s.startY;
    var minWorld = DRAG_THRESHOLD / (ME.EDITOR.camera.zoom || 1);
    if (dx*dx + dy*dy >= minWorld * minWorld) s.dragged = true;
    if (s.kind === 'lasso' && s.path){
      // 节流·距末点 ≥ 2 世界 px 才加
      var last = s.path[s.path.length - 1];
      var ldx = wx - last[0], ldy = wy - last[1];
      if (ldx*ldx + ldy*ldy >= 4) s.path.push([wx, wy]);
    }
    ME.requestRender();
  }

  // ─── end·提交 selection ────────────────────────────────

  function modeFromEvent(e){
    if (!e) return 'replace';
    if (e.altKey) return 'subtract';
    if (e.ctrlKey || e.metaKey) return 'toggle';
    if (e.shiftKey) return 'add';
    return 'replace';
  }

  function end(e){
    var s = getState();
    if (!s || !s.active) return null;
    var ret = null;
    if (s.dragged){
      var hits;
      if (s.kind === 'rect'){
        hits = computeRectHits(s.startX, s.startY, s.endX, s.endY);
      } else {
        hits = computeLassoHits(s.path);
      }
      applySelection(hits, modeFromEvent(e), s.baseSelection);
      ret = { kind: s.kind, count: hits.length };
    } else {
      // 没拖·点击空地行为·按原 select 工具规则·非 shift 就 clear
      if (!e || !e.shiftKey) ME.selectClear();
    }
    cancel();
    return ret;
  }

  function cancel(){
    var s = getState();
    if (!s) return;
    s.active = false;
    s.kind = null;
    s.path = null;
    s.dragged = false;
    s.baseSelection = null;
    ME.requestRender();
  }

  // ─── selection 计算 ───────────────────────────────────

  function computeRectHits(x1, y1, x2, y2){
    var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    var hits = [];
    var divs = ME.EDITOR.map.divisions;
    for (var i = 0; i < divs.length; i++){
      var d = divs[i];
      if (!d.centroid && !d.bbox) continue;
      // 用 bbox center·若无 bbox 用 centroid
      var cx, cy;
      if (d.centroid){ cx = d.centroid[0]; cy = d.centroid[1]; }
      else { cx = d.bbox.x + d.bbox.w/2; cy = d.bbox.y + d.bbox.h/2; }
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY){
        hits.push(d.id);
      }
    }
    return hits;
  }

  function computeLassoHits(path){
    if (!path || path.length < 3) return [];
    var hits = [];
    var divs = ME.EDITOR.map.divisions;
    for (var i = 0; i < divs.length; i++){
      var d = divs[i];
      var cx, cy;
      if (d.centroid){ cx = d.centroid[0]; cy = d.centroid[1]; }
      else if (d.bbox){ cx = d.bbox.x + d.bbox.w/2; cy = d.bbox.y + d.bbox.h/2; }
      else continue;
      if (pointInPolygon(cx, cy, path)) hits.push(d.id);
    }
    return hits;
  }

  function pointInPolygon(x, y, poly){
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++){
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      var intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ─── 应用·按 mode 合并 baseSelection 与 hits ────────────

  function applySelection(hits, mode, base){
    base = base || [];
    var setBase = {};
    base.forEach(function(id){ setBase[id] = true; });
    var setHits = {};
    hits.forEach(function(id){ setHits[id] = true; });

    var result = [];
    if (mode === 'replace'){
      result = hits.slice();
    } else if (mode === 'add'){
      result = base.slice();
      hits.forEach(function(id){ if (!setBase[id]) result.push(id); });
    } else if (mode === 'subtract'){
      result = base.filter(function(id){ return !setHits[id]; });
    } else if (mode === 'toggle'){
      var resultMap = {};
      base.forEach(function(id){ resultMap[id] = true; });
      hits.forEach(function(id){
        if (resultMap[id]) delete resultMap[id];
        else resultMap[id] = true;
      });
      result = Object.keys(resultMap);
    }
    ME.EDITOR.selectedIds = result;
    ME.fire('selection-change');
    ME.requestRender();
  }

  // ─── 同属性·inverse·all ─────────────────────────────────

  function selectAll(){
    var ids = ME.EDITOR.map.divisions.map(function(d){ return d.id; });
    ME.EDITOR.selectedIds = ids;
    ME.fire('selection-change');
    ME.requestRender();
    return ids.length;
  }

  function invertSelection(){
    var sel = {};
    ME.EDITOR.selectedIds.forEach(function(id){ sel[id] = true; });
    var ids = [];
    ME.EDITOR.map.divisions.forEach(function(d){
      if (!sel[d.id]) ids.push(d.id);
    });
    ME.EDITOR.selectedIds = ids;
    ME.fire('selection-change');
    ME.requestRender();
    return ids.length;
  }

  // 选属性同·从当前选中第一个 div 取属性·扩到全图同属性者
  // attrPath·string·如 'level'·'autonomy.type'·'terrain'
  function selectSameAttr(attrPath){
    var sel = ME.EDITOR.selectedIds;
    if (sel.length === 0){
      if (global.meToast) meToast('需先选 1 省·再扩同属性', 'warn');
      else alert('需先选 1 省·再扩同属性');
      return 0;
    }
    var anchor = ME.EDITOR.map.divisions.find(function(d){ return d.id === sel[0]; });
    if (!anchor) return 0;
    var target = getByPath(anchor, attrPath);
    var ids = ME.EDITOR.map.divisions
      .filter(function(d){ return getByPath(d, attrPath) === target; })
      .map(function(d){ return d.id; });
    ME.EDITOR.selectedIds = ids;
    ME.fire('selection-change');
    ME.requestRender();
    return ids.length;
  }

  function getByPath(obj, path){
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++){
      if (!cur) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // ─── render·preview·canvas-transform 内 ──────────────

  function renderPreview(ctx, camera){
    var s = getState();
    if (!s || !s.active) return;
    var z = camera.zoom;

    if (s.kind === 'rect'){
      var x = Math.min(s.startX, s.endX);
      var y = Math.min(s.startY, s.endY);
      var w = Math.abs(s.endX - s.startX);
      var h = Math.abs(s.endY - s.startY);
      ctx.save();
      ctx.fillStyle = 'rgba(217,181,102,0.08)';
      ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = '#d9b566';
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    } else if (s.kind === 'lasso' && s.path && s.path.length >= 2){
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.path[0][0], s.path[0][1]);
      for (var i = 1; i < s.path.length; i++){
        ctx.lineTo(s.path[i][0], s.path[i][1]);
      }
      // 闭线·viewport 显
      ctx.lineTo(s.path[0][0], s.path[0][1]);
      ctx.fillStyle = 'rgba(217,181,102,0.08)';
      ctx.fill();
      ctx.lineWidth = 1.5 / z;
      ctx.strokeStyle = '#d9b566';
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.marquee = {
    isActive: isActive,
    startRect: startRect,
    startLasso: startLasso,
    update: update,
    end: end,
    cancel: cancel,
    renderPreview: renderPreview,

    // selection helpers
    selectAll: selectAll,
    invertSelection: invertSelection,
    selectSameAttr: selectSameAttr
  };

})(typeof window !== 'undefined' ? window : this);
