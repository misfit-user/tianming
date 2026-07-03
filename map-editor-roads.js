// map-editor-roads.js
// 道路层·typed polyline·御道/驿道/商路/海路/古道
// schema·{ id, name, type, points, capacity, period, isOfficial, source, notes }
// 工具 'road'·click 加点·Enter/双击完成·Esc 取消
// 选中后·drag/alt-insert/shift-del·Delete 删整条
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[roads] core not loaded'); return; }

  var SNAP_PX = 8;
  var EDIT_VERTEX_PX = 6;
  var EDIT_EDGE_PX = 5;

  // type → { label, color, width, dash }
  var TYPES = {
    imperial: { label: '御道',  color: '#d4a017', width: 3.5, dash: [] },
    post:     { label: '驿道',  color: '#c9a96e', width: 2.5, dash: [10, 4] },
    caravan:  { label: '商路',  color: '#a87850', width: 2,   dash: [6, 4] },
    sea:      { label: '海路',  color: '#5a8aae', width: 2,   dash: [4, 6] },
    ancient:  { label: '古道',  color: '#8a8378', width: 1.5, dash: [2, 4] }
  };

  function pxToWorld(px){ return px / (ME.EDITOR.camera.zoom || 1); }

  function nextId(map){
    map._roadSeq = (map._roadSeq || 0) + 1;
    return 'rd_' + map._roadSeq.toString(36);
  }

  function createRoad(opts){
    opts = opts || {};
    return {
      id: opts.id || null,
      name: opts.name || '未名道',
      type: opts.type || 'post',
      points: opts.points || [],
      capacity: opts.capacity || 0,
      period: opts.period || '',
      isOfficial: opts.isOfficial != null ? !!opts.isOfficial : true,
      source: opts.source || '',
      notes: opts.notes || ''
    };
  }

  function add(map, road){
    if (!road.id) road.id = nextId(map);
    map.roads = map.roads || [];
    map.roads.push(road);
    return road;
  }
  function remove(map, id){
    if (!map.roads) return false;
    var i = map.roads.findIndex(function(r){ return r.id === id; });
    if (i < 0) return false;
    map.roads.splice(i, 1);
    return true;
  }
  function findById(map, id){
    return (map.roads || []).find(function(r){ return r.id === id; }) || null;
  }

  // ─── geometry hit test (与 rivers 同) ─────────────────────

  function pointToSegDist2(px, py, ax, ay, bx, by){
    var dx = bx-ax, dy = by-ay;
    var l2 = dx*dx + dy*dy;
    if (l2 < 1e-12) return (px-ax)*(px-ax) + (py-ay)*(py-ay);
    var t = ((px-ax)*dx + (py-ay)*dy) / l2;
    t = Math.max(0, Math.min(1, t));
    var qx = ax + t*dx, qy = ay + t*dy;
    return (px-qx)*(px-qx) + (py-qy)*(py-qy);
  }

  function findRoadAt(map, wx, wy, snapPx){
    snapPx = snapPx == null ? SNAP_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestId = null, bestD = dW * dW;
    (map.roads || []).forEach(function(r){
      var pts = r.points;
      for (var i = 0; i < pts.length - 1; i++){
        var d2 = pointToSegDist2(wx, wy, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
        if (d2 < bestD){ bestD = d2; bestId = r.id; }
      }
    });
    return bestId;
  }
  function findVertexAt(map, id, wx, wy, snapPx){
    var r = findById(map, id); if (!r) return -1;
    snapPx = snapPx == null ? EDIT_VERTEX_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestI = -1, bestD = dW * dW;
    r.points.forEach(function(p, i){
      var dx = p[0]-wx, dy = p[1]-wy;
      var d2 = dx*dx + dy*dy;
      if (d2 < bestD){ bestD = d2; bestI = i; }
    });
    return bestI;
  }
  function findEdgeAt(map, id, wx, wy, snapPx){
    var r = findById(map, id); if (!r) return -1;
    snapPx = snapPx == null ? EDIT_EDGE_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestI = -1, bestD = dW * dW;
    for (var i = 0; i < r.points.length - 1; i++){
      var d2 = pointToSegDist2(wx, wy, r.points[i][0], r.points[i][1], r.points[i+1][0], r.points[i+1][1]);
      if (d2 < bestD){ bestD = d2; bestI = i; }
    }
    return bestI;
  }

  function insertVertex(map, id, edgeIdx, x, y){
    var r = findById(map, id); if (!r) return false;
    if (edgeIdx < 0 || edgeIdx >= r.points.length - 1) return false;
    r.points.splice(edgeIdx + 1, 0, [x, y]);
    return true;
  }
  function removeVertex(map, id, idx){
    var r = findById(map, id); if (!r) return false;
    if (r.points.length <= 2) return false;
    r.points.splice(idx, 1);
    return true;
  }
  function moveVertex(map, id, idx, x, y){
    var r = findById(map, id); if (!r || !r.points[idx]) return false;
    r.points[idx][0] = x; r.points[idx][1] = y;
    return true;
  }

  // ─── tool callbacks ──────────────────────────────────────

  function onMouseDown(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'road') return false;

    if (EDITOR.selectedFeature && EDITOR.selectedFeature.kind === 'road'){
      var idx = findVertexAt(EDITOR.map, EDITOR.selectedFeature.id, wx, wy);
      if (idx >= 0){
        if (e.shiftKey){
          ME.commitMutation('road·删点', function(){
            removeVertex(EDITOR.map, EDITOR.selectedFeature.id, idx);
          });
          ME.requestRender();
          return true;
        }
        EDITOR._roadDrag = { id: EDITOR.selectedFeature.id, idx: idx };
        return true;
      }
      var ei = findEdgeAt(EDITOR.map, EDITOR.selectedFeature.id, wx, wy);
      if (e.altKey && ei >= 0){
        ME.commitMutation('road·插点', function(){
          insertVertex(EDITOR.map, EDITOR.selectedFeature.id, ei, wx, wy);
        });
        EDITOR._roadDrag = { id: EDITOR.selectedFeature.id, idx: ei + 1 };
        ME.requestRender();
        return true;
      }
    }

    if (e.button === 0){
      var now = Date.now();
      if (EDITOR._roadLastClick && now - EDITOR._roadLastClick < 300 &&
          EDITOR.featurePenPoints.length >= 2){
        finishPen();
        return true;
      }
      EDITOR._roadLastClick = now;

      if (EDITOR.featurePenPoints.length){
        EDITOR.featurePenPoints.push([wx, wy]);
        ME.requestRender();
        return true;
      }

      var hitId = findRoadAt(EDITOR.map, wx, wy);
      if (hitId){
        EDITOR.selectedFeature = { kind: 'road', id: hitId };
        ME.fire('feature-select', EDITOR.selectedFeature);
        ME.requestRender();
        return true;
      }
      EDITOR.featurePenPoints = [[wx, wy]];
      EDITOR.selectedFeature = null;
      ME.fire('feature-select', null);
      ME.requestRender();
      return true;
    }
    return false;
  }

  function finishPen(){
    var EDITOR = ME.EDITOR;
    var pts = EDITOR.featurePenPoints;
    if (pts.length < 2){ EDITOR.featurePenPoints = []; return; }
    // 默认 type·若 toolbar 选过·读取
    var defaultType = EDITOR._roadDefaultType || 'post';
    var newR;
    ME.commitMutation('road·新建', function(){
      newR = createRoad({ points: pts.slice(), type: defaultType });
      add(EDITOR.map, newR);
    });
    EDITOR.featurePenPoints = [];
    EDITOR.selectedFeature = { kind: 'road', id: newR.id };
    ME.fire('feature-select', EDITOR.selectedFeature);
    var statusEl = document.getElementById('status-tip');
    if (statusEl) statusEl.textContent = '新道·' + (TYPES[newR.type] || {}).label + '·' + newR.points.length + ' 顶';
    ME.requestRender();
  }

  function onMouseMove(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'road') return false;
    if (EDITOR._roadDrag){
      moveVertex(EDITOR.map, EDITOR._roadDrag.id, EDITOR._roadDrag.idx, wx, wy);
      EDITOR.dirty = true;
      ME.requestRender();
      return true;
    }
    if (EDITOR.featurePenPoints.length) ME.requestRender();
    return false;
  }

  function onMouseUp(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'road') return false;
    if (EDITOR._roadDrag){
      EDITOR._roadDrag = null;
      ME.fire('mutation', { label: 'road·move vertex' });
      return true;
    }
    return false;
  }

  function onKeyDown(e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'road') return false;
    if (e.key === 'Enter'){
      if (EDITOR.featurePenPoints.length >= 2){ finishPen(); return true; }
    }
    if (e.key === 'Escape'){
      if (EDITOR.featurePenPoints.length){
        EDITOR.featurePenPoints = []; ME.requestRender(); return true;
      }
      if (EDITOR.selectedFeature){
        EDITOR.selectedFeature = null; ME.fire('feature-select', null); ME.requestRender(); return true;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace'){
      if (EDITOR.selectedFeature && EDITOR.selectedFeature.kind === 'road'){
        if (confirm('删此道?')){
          var id = EDITOR.selectedFeature.id;
          ME.commitMutation('road·删', function(){ remove(EDITOR.map, id); });
          EDITOR.selectedFeature = null; ME.fire('feature-select', null);
          ME.requestRender(); return true;
        }
      }
    }
    return false;
  }

  // ─── render ─────────────────────────────────────────────

  function renderLayer(ctx, camera){
    var map = ME.EDITOR.map;
    if (!ME.EDITOR.layers.roads) return;
    if (!map.roads || !map.roads.length) return;
    var z = camera.zoom;

    map.roads.forEach(function(r){
      if (r.points.length < 2) return;
      var t = TYPES[r.type] || TYPES.post;

      ctx.beginPath();
      ctx.moveTo(r.points[0][0], r.points[0][1]);
      for (var i = 1; i < r.points.length; i++){
        ctx.lineTo(r.points[i][0], r.points[i][1]);
      }
      ctx.lineWidth = t.width;
      ctx.strokeStyle = t.color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (t.dash.length) ctx.setLineDash(t.dash.map(function(v){ return v / z; }));
      ctx.stroke();
      ctx.setLineDash([]);

      var sel = ME.EDITOR.selectedFeature;
      if (sel && sel.kind === 'road' && sel.id === r.id){
        ctx.lineWidth = t.width + 4 / z;
        ctx.strokeStyle = 'rgba(217,181,102,0.6)';
        ctx.stroke();
        r.points.forEach(function(p){
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4 / z, 0, Math.PI * 2);
          ctx.fillStyle = '#d9b566';
          ctx.fill();
          ctx.lineWidth = 1 / z;
          ctx.strokeStyle = '#1a1a1f';
          ctx.stroke();
        });
      }
    });
  }

  function renderPenPreview(ctx, camera){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'road') return;
    var pts = EDITOR.featurePenPoints;
    if (!pts.length) return;
    var z = camera.zoom;
    var t = TYPES[EDITOR._roadDefaultType || 'post'];

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (EDITOR.mouse && EDITOR.mouse.worldX != null){
      ctx.lineTo(EDITOR.mouse.worldX, EDITOR.mouse.worldY);
    }
    ctx.lineWidth = t.width;
    ctx.strokeStyle = t.color + 'a0';
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.stroke();
    ctx.setLineDash([]);

    pts.forEach(function(p){
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3 / z, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
    });
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.roads = {
    TYPES: TYPES,
    create: createRoad,
    add: add,
    remove: remove,
    findById: findById,
    findAt: findRoadAt,
    findVertexAt: findVertexAt,
    findEdgeAt: findEdgeAt,
    insertVertex: insertVertex,
    removeVertex: removeVertex,
    moveVertex: moveVertex,
    onMouseDown: onMouseDown,
    onMouseMove: onMouseMove,
    onMouseUp: onMouseUp,
    onKeyDown: onKeyDown,
    finishPen: finishPen,
    renderLayer: renderLayer,
    renderPenPreview: renderPenPreview,
    setDefaultType: function(t){ ME.EDITOR._roadDefaultType = t; }
  };

})(typeof window !== 'undefined' ? window : this);
