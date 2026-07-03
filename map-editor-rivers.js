// map-editor-rivers.js
// 河网层·polyline·非领土·overlay 在 division 之上
// schema·{ id, name, points: [[x,y]+], isMajor, navigable, width, source, notes }
// tool 'river'·click 加点·Enter/双击完成·Esc 取消
// 选中时·drag 顶点 / alt+click 边插点 / shift+click 顶点删点
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[rivers] core not loaded'); return; }

  var SNAP_PX = 8;            // 屏幕 px·hover/select 半径
  var EDIT_VERTEX_PX = 6;     // edit·顶点抓取
  var EDIT_EDGE_PX = 5;       // edit·边抓取
  var DEFAULT_WIDTH = 2.5;    // 世界 px

  // ─── factory ─────────────────────────────────────────────

  function nextId(map){
    map._riverSeq = (map._riverSeq || 0) + 1;
    return 'r_' + map._riverSeq.toString(36);
  }

  function createRiver(opts){
    opts = opts || {};
    return {
      id: opts.id || null,
      name: opts.name || '未名河',
      points: opts.points || [],
      isMajor: !!opts.isMajor,
      navigable: !!opts.navigable,
      width: opts.width != null ? opts.width : DEFAULT_WIDTH,
      source: opts.source || '',
      notes: opts.notes || ''
    };
  }

  function add(map, river){
    if (!river.id) river.id = nextId(map);
    map.rivers = map.rivers || [];
    map.rivers.push(river);
    return river;
  }

  function remove(map, id){
    if (!map.rivers) return false;
    var i = map.rivers.findIndex(function(r){ return r.id === id; });
    if (i < 0) return false;
    map.rivers.splice(i, 1);
    return true;
  }

  function findById(map, id){
    return (map.rivers || []).find(function(r){ return r.id === id; }) || null;
  }

  // ─── geometry hit test ───────────────────────────────────

  function pointToSegDist2(px, py, ax, ay, bx, by){
    var dx = bx - ax, dy = by - ay;
    var l2 = dx*dx + dy*dy;
    if (l2 < 1e-12) return (px-ax)*(px-ax) + (py-ay)*(py-ay);
    var t = ((px-ax)*dx + (py-ay)*dy) / l2;
    t = Math.max(0, Math.min(1, t));
    var qx = ax + t*dx, qy = ay + t*dy;
    return (px-qx)*(px-qx) + (py-qy)*(py-qy);
  }

  // 屏幕距阈 → 世界距阈
  function pxToWorld(px){
    var z = ME.EDITOR.camera.zoom || 1;
    return px / z;
  }

  function findRiverAt(map, wx, wy, snapPx){
    snapPx = snapPx == null ? SNAP_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestId = null, bestD = dW * dW;
    (map.rivers || []).forEach(function(r){
      var pts = r.points;
      for (var i = 0; i < pts.length - 1; i++){
        var d2 = pointToSegDist2(wx, wy, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
        if (d2 < bestD){ bestD = d2; bestId = r.id; }
      }
    });
    return bestId;
  }

  function findVertexAt(map, riverId, wx, wy, snapPx){
    var r = findById(map, riverId);
    if (!r) return -1;
    snapPx = snapPx == null ? EDIT_VERTEX_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestI = -1, bestD = dW * dW;
    r.points.forEach(function(p, i){
      var dx = p[0] - wx, dy = p[1] - wy;
      var d2 = dx*dx + dy*dy;
      if (d2 < bestD){ bestD = d2; bestI = i; }
    });
    return bestI;
  }

  function findEdgeAt(map, riverId, wx, wy, snapPx){
    var r = findById(map, riverId);
    if (!r) return -1;
    snapPx = snapPx == null ? EDIT_EDGE_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestI = -1, bestD = dW * dW;
    for (var i = 0; i < r.points.length - 1; i++){
      var d2 = pointToSegDist2(wx, wy, r.points[i][0], r.points[i][1], r.points[i+1][0], r.points[i+1][1]);
      if (d2 < bestD){ bestD = d2; bestI = i; }
    }
    return bestI;
  }

  // ─── mutation·插/删/移 vertex ────────────────────────────

  function insertVertex(map, riverId, edgeIdx, x, y){
    var r = findById(map, riverId);
    if (!r) return false;
    if (edgeIdx < 0 || edgeIdx >= r.points.length - 1) return false;
    r.points.splice(edgeIdx + 1, 0, [x, y]);
    return true;
  }

  function removeVertex(map, riverId, idx){
    var r = findById(map, riverId);
    if (!r) return false;
    if (r.points.length <= 2) return false;  // 至少留 2 点
    r.points.splice(idx, 1);
    return true;
  }

  function moveVertex(map, riverId, idx, x, y){
    var r = findById(map, riverId);
    if (!r || !r.points[idx]) return false;
    r.points[idx][0] = x;
    r.points[idx][1] = y;
    return true;
  }

  // ─── tool callbacks ──────────────────────────────────────

  // EDITOR.featurePenPoints + EDITOR.activeTool === 'river'
  // 拖 vertex·EDITOR._riverDrag = { id, idx }

  function onMouseDown(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'river') return false;

    // 双击或 ≥3 点击首点附近·完成
    if (EDITOR.featurePenPoints.length >= 2){
      var first = EDITOR.featurePenPoints[0];
      var closeW = pxToWorld(EDITOR.closingDistance || 12);
      var dx = first[0] - wx, dy = first[1] - wy;
      // 闭环 polyline 不要求 close·改用·click 相同 last 点判定 finish
      // 简化·用 Enter / 双击完成 (本函数下面)
    }

    // 拖 vertex·若有选中
    if (EDITOR.selectedFeature && EDITOR.selectedFeature.kind === 'river'){
      var idx = findVertexAt(EDITOR.map, EDITOR.selectedFeature.id, wx, wy);
      if (idx >= 0){
        // shift+click·删
        if (e.shiftKey){
          ME.commitMutation('river·删点', function(){
            removeVertex(EDITOR.map, EDITOR.selectedFeature.id, idx);
          });
          ME.requestRender();
          return true;
        }
        EDITOR._riverDrag = { id: EDITOR.selectedFeature.id, idx: idx };
        return true;
      }
      // alt+click 边·插点
      var ei = findEdgeAt(EDITOR.map, EDITOR.selectedFeature.id, wx, wy);
      if (e.altKey && ei >= 0){
        ME.commitMutation('river·插点', function(){
          insertVertex(EDITOR.map, EDITOR.selectedFeature.id, ei, wx, wy);
        });
        // 立即拖此新点
        EDITOR._riverDrag = { id: EDITOR.selectedFeature.id, idx: ei + 1 };
        ME.requestRender();
        return true;
      }
    }

    // 默 left-click·若已 pen·加点·否则若 click 中现有 river·选中
    if (e.button === 0){
      // 双击检测·last click 时间间隔 < 300ms 完成
      var now = Date.now();
      if (EDITOR._riverLastClick && now - EDITOR._riverLastClick < 300 &&
          EDITOR.featurePenPoints.length >= 2){
        finishPen();
        return true;
      }
      EDITOR._riverLastClick = now;

      // pen 进行中·加点
      if (EDITOR.featurePenPoints.length){
        EDITOR.featurePenPoints.push([wx, wy]);
        ME.requestRender();
        return true;
      }

      // 否则·若 click 中现有 river·选中
      var hitId = findRiverAt(EDITOR.map, wx, wy);
      if (hitId){
        EDITOR.selectedFeature = { kind: 'river', id: hitId };
        ME.fire('feature-select', EDITOR.selectedFeature);
        ME.requestRender();
        return true;
      }
      // 否则·开新 pen
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
    var newR;
    ME.commitMutation('river·新建', function(){
      newR = createRiver({ points: pts.slice() });
      add(EDITOR.map, newR);
    });
    EDITOR.featurePenPoints = [];
    EDITOR.selectedFeature = { kind: 'river', id: newR.id };
    ME.fire('feature-select', EDITOR.selectedFeature);
    var statusEl = document.getElementById('status-tip');
    if (statusEl) statusEl.textContent = '新河·' + newR.name + ' (' + newR.points.length + ' 顶)';
    ME.requestRender();
  }

  function onMouseMove(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'river') return false;
    if (EDITOR._riverDrag){
      moveVertex(EDITOR.map, EDITOR._riverDrag.id, EDITOR._riverDrag.idx, wx, wy);
      EDITOR.dirty = true;
      ME.requestRender();
      return true;
    }
    if (EDITOR.featurePenPoints.length){
      ME.requestRender();  // 让 preview 重画
    }
    return false;
  }

  function onMouseUp(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'river') return false;
    if (EDITOR._riverDrag){
      EDITOR._riverDrag = null;
      ME.fire('mutation', { label: 'river·move vertex' });
      return true;
    }
    return false;
  }

  function onKeyDown(e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'river') return false;
    if (e.key === 'Enter'){
      if (EDITOR.featurePenPoints.length >= 2){ finishPen(); return true; }
    }
    if (e.key === 'Escape'){
      if (EDITOR.featurePenPoints.length){
        EDITOR.featurePenPoints = [];
        ME.requestRender();
        return true;
      }
      if (EDITOR.selectedFeature){
        EDITOR.selectedFeature = null;
        ME.fire('feature-select', null);
        ME.requestRender();
        return true;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace'){
      if (EDITOR.selectedFeature && EDITOR.selectedFeature.kind === 'river'){
        if (confirm('删此河?')){
          var id = EDITOR.selectedFeature.id;
          ME.commitMutation('river·删', function(){ remove(EDITOR.map, id); });
          EDITOR.selectedFeature = null;
          ME.fire('feature-select', null);
          ME.requestRender();
          return true;
        }
      }
    }
    return false;
  }

  // ─── render ─────────────────────────────────────────────

  function renderLayer(ctx, camera){
    var map = ME.EDITOR.map;
    if (!ME.EDITOR.layers.rivers) return;
    if (!map.rivers || !map.rivers.length) return;
    var z = camera.zoom;

    // Phase 23.4·ink mode 时·改墨青
    var inkMode = global.TM && TM.MapEditor.playerView && TM.MapEditor.playerView.isInkMode && TM.MapEditor.playerView.isInkMode();

    map.rivers.forEach(function(r){
      if (r.points.length < 2) return;
      var w = (r.isMajor ? r.width * 1.8 : r.width);
      var color;
      if (inkMode){
        // 墨青·主河略深·支流较淡
        color = r.navigable ? 'rgba(45,75,90,0.85)' : 'rgba(70,100,115,0.7)';
      } else {
        color = r.navigable ? '#5aa6c8' : '#7ab8d8';
      }

      // Phase 21.8·宽度 taper·source 到 mouth·变粗
      // 分段画·每段独立 lineWidth·从 0.65w 到 w·用 round cap 避缝
      var pts = r.points;
      var nseg = pts.length - 1;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (var i = 0; i < nseg; i++){
        var t0 = i / nseg, t1 = (i + 1) / nseg;
        var w0 = w * (0.65 + 0.35 * t0);
        var w1 = w * (0.65 + 0.35 * t1);
        var wm = (w0 + w1) / 2;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.lineWidth = wm;
        ctx.stroke();
      }
      ctx.restore();

      // Phase 21.8·flow arrow·中段·小箭头
      if (nseg >= 2 && (r.isMajor || w > 1.5 / z)){
        var midI = Math.floor(nseg / 2);
        var p1 = pts[midI], p2 = pts[midI + 1];
        var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.1){
          var nx = dx / d, ny = dy / d;
          var mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
          var as = (3 + w) / z;
          ctx.beginPath();
          ctx.moveTo(mx + nx * as, my + ny * as);
          ctx.lineTo(mx - nx * as * 0.5 - ny * as * 0.7, my - ny * as * 0.5 + nx * as * 0.7);
          ctx.lineTo(mx - nx * as * 0.5 + ny * as * 0.7, my - ny * as * 0.5 - nx * as * 0.7);
          ctx.closePath();
          ctx.fillStyle = inkMode ? 'rgba(35,55,65,0.75)' : '#3a5a7a';
          ctx.fill();
        }
      }

      // 选中·加白边
      var sel = ME.EDITOR.selectedFeature;
      if (sel && sel.kind === 'river' && sel.id === r.id){
        ctx.lineWidth = (w + 4 / z);
        ctx.strokeStyle = 'rgba(217,181,102,0.6)';
        ctx.stroke();
        // 顶点点
        r.points.forEach(function(p, i){
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4 / z, 0, Math.PI * 2);
          ctx.fillStyle = '#d9b566';
          ctx.fill();
          ctx.lineWidth = 1 / z;
          ctx.strokeStyle = '#1a1a1f';
          ctx.stroke();
        });
      }

      // 河名·中段·若大河始显
      if (r.isMajor && ME.EDITOR.layers.label){
        var mid = r.points[Math.floor(r.points.length / 2)];
        ctx.font = (12 / z) + 'px "Noto Serif SC",serif';
        ctx.fillStyle = '#5aa6c8';
        ctx.strokeStyle = '#0f0f12';
        ctx.lineWidth = 3 / z;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(r.name, mid[0], mid[1] - 8 / z);
        ctx.fillText(r.name, mid[0], mid[1] - 8 / z);
      }
    });
  }

  function renderPenPreview(ctx, camera){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'river') return;
    var pts = EDITOR.featurePenPoints;
    if (!pts.length) return;
    var z = camera.zoom;

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++){
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    // 跟到当前 mouse·若 mouse 有
    if (EDITOR.mouse && EDITOR.mouse.worldX != null){
      ctx.lineTo(EDITOR.mouse.worldX, EDITOR.mouse.worldY);
    }
    ctx.lineWidth = DEFAULT_WIDTH;
    ctx.strokeStyle = 'rgba(122,184,216,0.6)';
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 顶点点
    pts.forEach(function(p){
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3 / z, 0, Math.PI * 2);
      ctx.fillStyle = '#7ab8d8';
      ctx.fill();
    });
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.rivers = {
    create: createRiver,
    add: add,
    remove: remove,
    findById: findById,
    findAt: findRiverAt,
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
    renderPenPreview: renderPenPreview
  };

})(typeof window !== 'undefined' ? window : this);
